// ambient.js — 環境音與生活小音效(PLAN_AUDIO §4.4、§6、§6.5)。全部合成、零音檔。
// 每 500 ms 輪詢:只在經營 / 拜訪模式、環境音開、非安靜、未縮到全圖時發聲。
// 規則:稀疏隨機間隔的單發(不循環);同時最多 2 單發 + 1 底;每 60 秒最多 8 單發;
// 只讓鏡頭中心附近最近 2 個運作中物件輪流發聲;自然音依季節 × 時段 × 地形 × 天氣。
// 只唯讀 world / view / viewport / game / pano / currentSeason / artTodKey / artWeather。
// 對外:ambStart()、ambStop()、ambStats(sec?)。

const AMB_POLL_MS = 500;
const AMB_MAX_SINGLES = 2;
const AMB_MAX_PER_MIN = 8;
const AMB_FIRE_P = 0.05;
const AMB_LOG_SEC = 600;

const AMB = {
  timer: null, watch: null, manual: false, tickN: 0, rr: 0, nLog: 0,
  next: {}, grpLast: {}, buf: {}, voices: [], log: [], fading: [], bed: null, bedId: ''
};

let AMB_RNG = 20261031;
function ambRand() {
  AMB_RNG = (Math.imul(AMB_RNG, 1103515245) + 12345) & 0x7fffffff;
  return AMB_RNG / 0x80000000;
}

function ambSamples(sec) { return new Float32Array(Math.max(1, Math.round(sec * AU_SR))); }

function ambNoise(n) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = ambRand() * 2 - 1;
  return a;
}

// RBJ 二階濾波:lp / hp / bp(0 dB 峰值)
function ambFilt(x, type, f, q) {
  const w0 = 2 * Math.PI * Math.min(f, AU_SR * 0.45) / AU_SR;
  const cw = Math.cos(w0), al = Math.sin(w0) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = (b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    y[i] = yi; x2 = x1; x1 = xi; y2 = y1; y1 = yi;
  }
  return y;
}

function ambAddAt(out, src, t0, amp) {
  const s0 = Math.round(t0 * AU_SR);
  for (let i = 0; i < src.length; i++) {
    const k = s0 + i;
    if (k < 0) continue;
    if (k >= out.length) break;
    out[k] += amp * src[i];
  }
}

// 單音:wave = sin | sq | saw;f0→f1 滑音;tau 指數衰減;vib 顫音深度(比例)
function ambTone(out, t0, dur, f0, f1, amp, wave, tau, vib) {
  const n = Math.max(1, Math.round(dur * AU_SR));
  const seg = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR, u = i / n;
    const f = (f0 + (f1 - f0) * u) * (1 + (vib || 0) * Math.sin(2 * Math.PI * 5.5 * t));
    ph += f / AU_SR;
    ph -= Math.floor(ph);
    let v;
    if (wave === 'sq') v = ph < 0.5 ? 1 : -1;
    else if (wave === 'saw') v = 2 * ph - 1;
    else v = Math.sin(2 * Math.PI * ph);
    seg[i] = v * Math.min(1, t / 0.004) * Math.exp(-t / (tau || dur)) * Math.min(1, (dur - t) / 0.01);
  }
  ambAddAt(out, seg, t0, amp);
}

// 帶通雜訊短爆:摩擦、水花、紙張、雨滴
function ambBurst(out, t0, dur, amp, f, q, tau) {
  const n = Math.max(1, Math.round(dur * AU_SR));
  const seg = ambFilt(ambNoise(n), 'bp', f, q);
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    seg[i] *= Math.exp(-t / tau) * Math.min(1, t / 0.002);
  }
  ambAddAt(out, seg, t0, amp);
}

// 木質敲擊:短正弦 + 高頻噪點
function ambKnock(out, t0, f, amp) {
  ambTone(out, t0, 0.1, f, f * 0.85, amp, 'sin', 0.02);
  ambBurst(out, t0, 0.02, amp * 0.6, f * 2.2, 2, 0.006);
}

// 金屬 / 磬 / 鐘:非諧和分音
function ambStrike(out, t0, f, amp, tau) {
  const r = [1, 2.32, 4.25], a = [1, 0.45, 0.2];
  for (let i = 0; i < 3; i++) ambTone(out, t0, tau * 3, f * r[i], f * r[i], amp * a[i], 'sin', tau / (1 + i));
}

function ambGust(sec, f) {
  const n = ambSamples(sec);
  const x = ambFilt(ambNoise(n.length), 'bp', f, 0.9);
  for (let i = 0; i < n.length; i++) {
    const t = i / AU_SR;
    n[i] = x[i] * Math.pow(Math.sin(Math.PI * t / sec), 2);
  }
  return n;
}

// 人聲嗡鳴:鋸齒波經兩組母音共振峰,音量隨節奏起伏(不可辨識語言)
function ambMurmur(sec, f0, f1, rhythm) {
  const out = ambSamples(sec);
  const raw = new Float32Array(out.length);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / AU_SR;
    ph += (f0 + (f1 - f0) * t / sec) * (1 + 0.01 * Math.sin(2 * Math.PI * 5 * t)) / AU_SR;
    ph -= Math.floor(ph);
    raw[i] = 2 * ph - 1;
  }
  const a = ambFilt(raw, 'bp', 700, 4), b = ambFilt(raw, 'bp', 1200, 5);
  for (let i = 0; i < out.length; i++) {
    const t = i / AU_SR;
    const g = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * rhythm * t)), 2);
    out[i] = (0.8 * a[i] + 0.6 * b[i]) * g * Math.min(1, t / 0.3) * Math.min(1, (sec - t) / 0.3);
  }
  return out;
}

// 動物叫聲近似:多段鋸齒滑音經兩組共振峰(品質僅為合成近似)
function ambAnimal(sec, bursts, fm, q, vib) {
  const raw = ambSamples(sec);
  bursts.forEach(function (b) { ambTone(raw, b[0], b[1], b[2], b[3], b[4], 'saw', b[1] * 0.8, vib); });
  const a = ambFilt(raw, 'bp', fm[0], q), c = ambFilt(raw, 'bp', fm[1], q);
  const out = new Float32Array(raw.length);
  for (let i = 0; i < out.length; i++) out[i] = 0.6 * a[i] + 0.5 * c[i];
  return out;
}

function ambNorm(out, peak) {
  let m = 0;
  for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i]));
  if (m > 0) {
    const k = peak / m;
    for (let i = 0; i < out.length; i++) out[i] *= k;
  }
  return out;
}

// 無縫迴圈:尾端淡入疊回頭端
function ambLoop(x, fadeSec) {
  const fn = Math.round(fadeSec * AU_SR), n = x.length - fn;
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (i < fn) {
      const w = i / fn;
      y[i] = x[i] * w + x[n + i] * (1 - w);
    } else {
      y[i] = x[i];
    }
  }
  return y;
}

// ---- 自然音 ----
function ambR_cicada() {
  const out = ambSamples(3);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / AU_SR;
    ph += (4200 + 300 * Math.sin(2 * Math.PI * 0.7 * t)) / AU_SR;
    const am = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 95 * t)), 2);
    const sw = 0.6 + 0.4 * Math.sin(2 * Math.PI * 1.3 * t);
    out[i] = 0.5 * Math.sin(2 * Math.PI * ph) * am * sw * Math.min(1, t / 0.2) * Math.min(1, (3 - t) / 0.2);
  }
  return out;
}

function ambR_frog() {
  const out = ambSamples(2.6);
  const k = 2 + Math.floor(ambRand() * 4);
  for (let c = 0; c < k; c++) ambTone(out, c * 0.42 + ambRand() * 0.05, 0.2, 230, 180, 0.6, 'sq', 0.09);
  return ambFilt(out, 'bp', 650, 1.5);
}

function ambR_cricket() {
  const out = ambSamples(8);
  for (let i = 0; i < out.length; i++) {
    const t = i / AU_SR;
    const gate = Math.sin(2 * Math.PI * 28 * t) > 0.2 ? 1 : 0;
    const slow = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.5 * t);
    out[i] = 0.3 * gate * slow * Math.sin(2 * Math.PI * 4500 * t);
  }
  return out;
}

function ambR_bird() {
  const out = ambSamples(1.6);
  const k = 1 + Math.floor(ambRand() * 3);
  for (let c = 0; c < k; c++) {
    const f = 2400 + ambRand() * 900;
    ambTone(out, c * 0.38 + ambRand() * 0.05, 0.11, f, f * 1.25, 0.4, 'sin', 0.07, 0.015);
  }
  return out;
}

function ambR_crow() {
  const out = ambSamples(1.6);
  const k = 1 + Math.floor(ambRand() * 2);
  for (let c = 0; c < k; c++) {
    const t0 = c * 0.7;
    ambTone(out, t0, 0.55, 230, 190, 0.5, 'saw', 0.35);
    ambBurst(out, t0, 0.5, 0.25, 700, 2, 0.25);
  }
  return ambFilt(out, 'lp', 1200, 0.7);
}

function ambR_wind() { return ambGust(2.2, 420); }

function ambR_bamboo() {
  const out = ambGust(2.6, 900);
  ambTone(out, 0.9, 0.05, 1800, 1500, 0.35, 'sin', 0.012);
  ambTone(out, 1.75, 0.05, 1700, 1400, 0.3, 'sin', 0.012);
  return out;
}

function ambR_water() {
  const out = ambSamples(3);
  const x = ambFilt(ambNoise(out.length), 'bp', 800, 0.8);
  for (let i = 0; i < out.length; i++) {
    const t = i / AU_SR;
    out[i] = x[i] * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.8 * t)) * Math.min(1, t / 0.3) * Math.min(1, (3 - t) / 0.3);
  }
  for (let k = 0; k < 5; k++) {
    const f = 400 + ambRand() * 500;
    ambTone(out, ambRand() * 2.6, 0.06, f, f * 2, 0.12, 'sin', 0.03);
  }
  return out;
}

function ambR_chime() {
  const out = ambSamples(2.8);
  [0, 0.45 + ambRand() * 0.4, 1.4].forEach(function (t0) {
    const f = 1500 + ambRand() * 800;
    ambTone(out, t0, 1.6, f, f, 0.3, 'sin', 0.7);
    ambTone(out, t0, 1.2, f * 2.76, f * 2.76, 0.12, 'sin', 0.35);
    ambTone(out, t0, 0.8, f * 5.4, f * 5.4, 0.05, 'sin', 0.2);
  });
  return out;
}

function ambR_watch() {
  const out = ambSamples(2.8);
  for (let k = 0; k < 3; k++) {
    ambTone(out, k * 0.9, 0.7, 120, 70, 0.6, 'sin', 0.22);
    ambBurst(out, k * 0.9, 0.1, 0.25, 300, 0.7, 0.05);
  }
  return out;
}

function ambR_drip() {
  const out = ambSamples(0.5);
  ambTone(out, 0, 0.3, 1500, 1200, 0.5, 'sin', 0.05);
  ambBurst(out, 0, 0.01, 0.3, 2000, 2, 0.003);
  return out;
}

function ambR_snowgust() { return ambGust(2.4, 260); }

// ---- 天氣底(循環) ----
function ambR_rain() {
  const x = ambFilt(ambFilt(ambNoise(Math.round(8 * AU_SR)), 'hp', 1500, 0.7), 'lp', 6000, 0.7);
  for (let k = 0; k < 40; k++) ambBurst(x, ambRand() * 8, 0.01, 0.6, 3000 + ambRand() * 2000, 2, 0.003);
  return ambLoop(x, 0.5);
}

function ambR_snowbed() {
  const n = Math.round(8 * AU_SR);
  const x = ambFilt(ambNoise(n), 'bp', 350, 0.7);
  for (let i = 0; i < n; i++) x[i] *= 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.12 * i / AU_SR);
  return ambLoop(x, 0.5);
}

// ---- 生活 / 宗教 / 樂器(合成近似) ----
function ambR_anvil() {
  const out = ambSamples(2.2);
  ambStrike(out, 0, 1100, 0.35, 0.05);
  ambStrike(out, 0.28, 1100, 0.35, 0.05);
  ambStrike(out, 1.2, 1100, 0.3, 0.05);
  ambStrike(out, 1.48, 1100, 0.3, 0.05);
  return out;
}

function ambR_saw() {
  const out = ambSamples(2.4);
  const x = ambFilt(ambNoise(out.length), 'bp', 1500, 2);
  for (let i = 0; i < out.length; i++) out[i] = x[i] * 0.5 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 6.5 * i / AU_SR));
  ambTone(out, 0, 2.4, 1000, 1300, 0.05, 'sin', 1.0);
  return out;
}

function ambR_chop() {
  const out = ambSamples(1.2);
  ambBurst(out, 0, 0.08, 0.5, 800, 0.9, 0.03);
  ambTone(out, 0, 0.25, 130, 60, 0.6, 'sin', 0.06);
  ambBurst(out, 0.02, 0.05, 0.3, 2200, 2, 0.01);
  return out;
}

function ambR_loom() {
  const out = ambSamples(2.6);
  for (let k = 0; k < 4; k++) {
    ambKnock(out, k * 0.6, 520, 0.45);
    ambKnock(out, k * 0.6 + 0.3, 330, 0.35);
  }
  return out;
}

function ambR_cloth() {
  const out = ambSamples(1.6);
  for (let k = 0; k < 3; k++) ambBurst(out, k * 0.35, 0.3, 0.22, 2500, 1.4, 0.1);
  ambTone(out, 0.9, 0.12, 110, 80, 0.4, 'sin', 0.05);
  return out;
}

function ambR_sew() {
  const out = ambSamples(1.4);
  for (let k = 0; k < 6; k++) ambBurst(out, 0.12 * k, 0.02, 0.2, 4000, 2, 0.004);
  return out;
}

function ambR_pound() {
  const out = ambSamples(2);
  [0, 1.0].forEach(function (t) {
    ambTone(out, t, 0.3, 130, 70, 0.6, 'sin', 0.08);
    ambBurst(out, t, 0.1, 0.25, 400, 0.8, 0.03);
  });
  return out;
}

function ambR_wash() {
  const out = ambSamples(2.6);
  for (let k = 0; k < 4; k++) ambKnock(out, k * 0.45, 210 - k * 8, 0.4);
  ambBurst(out, 0, 2.2, 0.12, 1000, 0.6, 1.0);
  return out;
}

function ambR_net() {
  const out = ambSamples(2.4);
  ambBurst(out, 0, 0.7, 0.35, 1800, 1, 0.3);
  for (let k = 0; k < 3; k++) ambBurst(out, 0.8 + k * 0.22 + ambRand() * 0.05, 0.12, 0.25, 900 + ambRand() * 400, 1.2, 0.05);
  return out;
}

function ambR_mill() {
  const out = ambSamples(3);
  ambBurst(out, 0, 3, 0.25, 250, 0.7, 1.5);
  ambTone(out, 1.0, 0.3, 1200, 1000, 0.06, 'sin', 0.1);
  ambTone(out, 2.1, 0.3, 1200, 1000, 0.06, 'sin', 0.1);
  return out;
}

function ambR_well() {
  const out = ambSamples(3);
  ambTone(out, 0, 1.6, 500, 760, 0.25, 'sin', 1.0, 0.03);
  for (let i = 0; i < out.length; i++) out[i] *= 0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * i / AU_SR);
  ambBurst(out, 1.9, 0.3, 0.3, 900, 1.5, 0.15);
  return out;
}

function ambR_waterwheel() {
  const out = ambSamples(3);
  ambTone(out, 0, 3, 220, 230, 0.12, 'sin', 3);
  ambBurst(out, 0, 3, 0.2, 700, 1, 1.0);
  for (let k = 0; k < 4; k++) ambKnock(out, k * 0.65, 300, 0.2);
  return out;
}

function ambR_fire() {
  const out = ambSamples(2.5);
  const x = ambFilt(ambNoise(out.length), 'lp', 3000, 0.7);
  for (let i = 0; i < out.length; i++) out[i] = x[i] * 0.15;
  for (let k = 0; k < 8; k++) ambBurst(out, ambRand() * 2.4, 0.01, 0.25, 2200 + ambRand() * 1500, 2, 0.003);
  return out;
}

function ambR_herb() {
  const out = ambSamples(2.6);
  const x = ambFilt(ambNoise(out.length), 'lp', 300, 0.7);
  for (let i = 0; i < out.length; i++) out[i] = x[i] * 0.05;
  for (let k = 0; k < 7; k++) {
    const f = 260 + ambRand() * 200;
    ambTone(out, ambRand() * 2.4, 0.14, f, f * 2, 0.25, 'sin', 0.04);
  }
  return out;
}

function ambR_page() {
  const out = ambSamples(1.1);
  ambBurst(out, 0, 0.3, 0.3, 3000, 1.2, 0.12);
  ambBurst(out, 0.45, 0.25, 0.25, 2500, 1, 0.09);
  ambBurst(out, 0.7, 0.2, 0.2, 3500, 1.5, 0.05);
  return out;
}

function ambR_recite() {
  const out = ambMurmur(3, 200, 220, 1.2);
  ambBurst(out, 1.9, 0.15, 0.2, 3500, 1.5, 0.04);
  return out;
}

function ambR_chant() {
  const out = ambMurmur(3, 110, 130, 0.5);
  for (let k = 0; k < 5; k++) ambKnock(out, k * 0.6, 700, 0.35);
  return out;
}

function ambR_woodfish() {
  const out = ambSamples(2.2);
  for (let k = 0; k < 3; k++) ambKnock(out, k * 0.6, 720, 0.5);
  return out;
}

function ambR_qing() {
  const out = ambSamples(3);
  ambStrike(out, 0, 660, 0.5, 1.0);
  return out;
}

function ambR_bell() {
  const out = ambSamples(3);
  ambBurst(out, 0, 0.03, 0.4, 2000, 1, 0.01);
  ambStrike(out, 0, 240, 0.5, 0.9);
  return out;
}

function ambR_abacus() {
  const out = ambSamples(1.8);
  let t = 0;
  for (let k = 0; k < 5; k++) {
    ambKnock(out, t, 1700 + ambRand() * 300, 0.35);
    t += 0.09 + ambRand() * 0.06;
  }
  [1.0, 1.15].forEach(function (t0) {
    ambTone(out, t0, 0.3, 2600, 2600, 0.2, 'sin', 0.08);
    ambTone(out, t0, 0.3, 3900, 3900, 0.1, 'sin', 0.06);
  });
  return out;
}

function ambR_crowd() {
  const sec = 3.0, out = ambSamples(sec);
  for (let k = 0; k < 4; k++) {
    const x = ambFilt(ambNoise(out.length), 'bp', 350 + k * 230 + ambRand() * 120, 3);
    const m = 2 + ambRand() * 3, ph = ambRand() * 6.28;
    for (let i = 0; i < out.length; i++) out[i] += x[i] * (0.5 + 0.5 * Math.sin(2 * Math.PI * m * i / AU_SR + ph));
  }
  for (let i = 0; i < out.length; i++) {
    const t = i / AU_SR;
    out[i] *= Math.min(1, t / 0.6) * Math.min(1, (sec - t) / 0.6);
  }
  return out;
}

// 五聲音階零星旋律(合成)
function ambR_tune() {
  const out = ambSamples(3);
  const ratios = [1, 1.122, 1.26, 1.498, 1.682];
  const base = 262 * (ambRand() < 0.5 ? 1 : 1.189);
  const n = 4 + Math.floor(ambRand() * 4);
  let t = 0;
  for (let k = 0; k < n; k++) {
    const f = base * ratios[Math.floor(ambRand() * 5)] * (ambRand() < 0.5 ? 1 : 2);
    ambTone(out, t, 0.9, f, f, 0.35, 'sin', 0.35);
    ambTone(out, t, 0.9, f * 2, f * 2, 0.08, 'sin', 0.12);
    t += 0.3 + ambRand() * 0.25;
  }
  return out;
}

// 動物(合成近似,音質待聽感確認)
function ambR_chicken() {
  return ambAnimal(1.1, [[0, 0.1, 1300, 1700, 0.5], [0.14, 0.1, 1250, 1650, 0.5], [0.3, 0.2, 1500, 1100, 0.5]], [1700, 2600], 3, 0.02);
}
function ambR_duck() {
  return ambAnimal(1.0, [[0, 0.22, 650, 420, 0.7], [0.4, 0.22, 650, 420, 0.7]], [900, 1400], 3, 0.02);
}
function ambR_ox() {
  return ambAnimal(2.2, [[0, 1.8, 120, 90, 0.7]], [400, 800], 4, 0.03);
}
function ambR_sheep() {
  return ambAnimal(1.6, [[0, 0.5, 300, 260, 0.6], [0.7, 0.5, 300, 260, 0.6]], [900, 1800], 3, 0.04);
}
function ambR_pig() {
  return ambAnimal(1.1, [[0, 0.3, 260, 150, 0.6], [0.45, 0.3, 260, 150, 0.6]], [700, 1400], 2, 0.01);
}
function ambR_horse() {
  return ambAnimal(2.4, [[0, 1.2, 600, 1100, 0.55], [1.2, 1.0, 1100, 700, 0.45]], [1000, 2200], 2, 0.05);
}

// ---- 頻率表(gap 最短間隔秒、jit 抖動 ±%、grp 同類冷卻鍵、gain 單發增益、wx 限定天氣)----
const AMB_DEFS = {
  amb_cicada:    { gap: 25, jit: 30, grp: 'nature', gain: 0.35, render: ambR_cicada },
  amb_frog:      { gap: 18, jit: 40, grp: 'nature', gain: 0.4, render: ambR_frog },
  amb_bird:      { gap: 14, jit: 40, grp: 'nature', gain: 0.35, render: ambR_bird },
  amb_crow:      { gap: 40, jit: 40, grp: 'nature', gain: 0.4, render: ambR_crow },
  amb_wind:      { gap: 20, jit: 30, grp: 'nature', gain: 0.35, render: ambR_wind },
  amb_bamboo:    { gap: 20, jit: 30, grp: 'nature', gain: 0.3, render: ambR_bamboo },
  amb_water:     { gap: 15, jit: 30, grp: 'water', gain: 0.3, render: ambR_water },
  amb_chime:     { gap: 20, jit: 40, grp: 'bell', gain: 0.3, render: ambR_chime },
  amb_watch:     { gap: 180, jit: 20, grp: null, gain: 0.45, render: ambR_watch },
  amb_rain_drip: { gap: 8, jit: 40, grp: 'nature', gain: 0.25, render: ambR_drip, wx: 'rain' },
  amb_snow_gust: { gap: 30, jit: 40, grp: 'nature', gain: 0.3, render: ambR_snowgust, wx: 'snow' },
  amb_rain:      { bed: true, gain: 0.18, render: ambR_rain },
  amb_snow:      { bed: true, gain: 0.12, render: ambR_snowbed },
  amb_cricket:   { bed: true, gain: 0.10, render: ambR_cricket },
  life_crowd:    { gap: 20, jit: 30, grp: 'trade', gain: 0.35, render: ambR_crowd },
  life_anvil:    { gap: 10, jit: 30, grp: 'work', gain: 0.4, render: ambR_anvil },
  life_saw:      { gap: 12, jit: 30, grp: 'work', gain: 0.35, render: ambR_saw },
  life_chop:     { gap: 12, jit: 30, grp: 'work', gain: 0.4, render: ambR_chop },
  life_loom:     { gap: 12, jit: 30, grp: 'work', gain: 0.35, render: ambR_loom },
  life_cloth:    { gap: 15, jit: 30, grp: 'work', gain: 0.3, render: ambR_cloth },
  life_sew:      { gap: 15, jit: 30, grp: 'work', gain: 0.2, render: ambR_sew },
  life_pound:    { gap: 12, jit: 30, grp: 'work', gain: 0.4, render: ambR_pound },
  life_wash:     { gap: 15, jit: 30, grp: 'water', gain: 0.35, render: ambR_wash },
  life_net:      { gap: 20, jit: 30, grp: 'water', gain: 0.35, render: ambR_net },
  life_mill:     { gap: 15, jit: 30, grp: 'work', gain: 0.35, render: ambR_mill },
  life_well:     { gap: 15, jit: 30, grp: 'work', gain: 0.35, render: ambR_well },
  life_waterwheel: { gap: 15, jit: 30, grp: 'water', gain: 0.35, render: ambR_waterwheel },
  life_fire:     { gap: 15, jit: 30, grp: 'work', gain: 0.3, render: ambR_fire },
  life_herb:     { gap: 15, jit: 30, grp: 'work', gain: 0.3, render: ambR_herb },
  life_page:     { gap: 15, jit: 30, grp: 'work', gain: 0.25, render: ambR_page },
  life_recite:   { gap: 25, jit: 30, grp: 'work', gain: 0.3, render: ambR_recite },
  life_abacus:   { gap: 12, jit: 30, grp: 'trade', gain: 0.35, render: ambR_abacus },
  life_tune:     { gap: 25, jit: 30, grp: 'music', gain: 0.3, render: ambR_tune },
  wooden_fish:   { gap: 30, jit: 30, grp: 'religion', gain: 0.4, render: ambR_woodfish },
  life_chant:    { gap: 30, jit: 30, grp: 'religion', gain: 0.3, render: ambR_chant },
  qing:          { gap: 20, jit: 30, grp: 'religion', gain: 0.3, render: ambR_qing },
  temple_bell:   { gap: 90, jit: 30, grp: 'religion', gain: 0.4, render: ambR_bell },
  ani_chicken:   { gap: 25, jit: 40, grp: 'animal', gain: 0.3, render: ambR_chicken },
  ani_duck:      { gap: 30, jit: 40, grp: 'animal', gain: 0.3, render: ambR_duck },
  ani_ox:        { gap: 35, jit: 40, grp: 'animal', gain: 0.3, render: ambR_ox },
  ani_sheep:     { gap: 30, jit: 40, grp: 'animal', gain: 0.3, render: ambR_sheep },
  ani_pig:       { gap: 35, jit: 40, grp: 'animal', gain: 0.3, render: ambR_pig },
  ani_horse:     { gap: 40, jit: 40, grp: 'animal', gain: 0.3, render: ambR_horse }
};

// 物件 type → 可能發聲的音效(隨機取一;只有鏡頭附近最近 2 個運作中物件會被抽到)
const AMB_OBJ = {
  shop_smith: ['life_anvil'], anvil: ['life_anvil'], smelter: ['life_fire', 'life_anvil'],
  lumber: ['life_saw'], lumberyard: ['life_saw'], sawbench: ['life_saw'], shipyard: ['life_saw'],
  woodpile: ['life_chop'],
  weavery: ['life_loom', 'life_cloth'], loom: ['life_loom'],
  shop_cloth: ['life_sew', 'life_cloth'],
  dyehouse: ['life_wash'], dyevat: ['life_wash'],
  millstone: ['life_mill'], pestle: ['life_pound'],
  waterwheel: ['life_waterwheel', 'amb_water'],
  shop_book: ['life_page', 'life_recite'], research: ['life_recite', 'life_page'],
  desk: ['life_page'], scroll_rack: ['life_page'], stall_book: ['life_page'],
  market: ['life_crowd'],
  well: ['life_well'], well_sweep: ['life_well'],
  fishery: ['life_net'], dock: ['life_net'],
  stove: ['life_fire'], kitchen_shed: ['life_fire'],
  shop_herb: ['life_herb'], herb_stove: ['life_herb'],
  bank: ['life_abacus'],
  drum: ['amb_watch'], drum_tower: ['amb_watch'],
  temple_futu: ['wooden_fish', 'life_chant', 'temple_bell'],
  temple_dao: ['wooden_fish', 'life_chant', 'temple_bell'],
  altar: ['wooden_fish', 'temple_bell'],
  bell_chime: ['qing', 'amb_chime'],
  shop_wine: ['life_tune'], shop_tea: ['life_tune'], brothel: ['life_tune'],
  stable: ['ani_horse'], horse: ['ani_horse'],
  chicken: ['ani_chicken'], chicken_coop: ['ani_chicken'],
  duck: ['ani_duck'], goose: ['ani_duck'],
  ox: ['ani_ox'], cowshed: ['ani_ox'],
  sheep: ['ani_sheep'], sheepfold: ['ani_sheep'],
  pig: ['ani_pig'], pigsty_privy: ['ani_pig'],
  bamboo: ['amb_bamboo'], pond: ['amb_water']
};

const AMB_FIELD_TYPES = ['vegetable_plot', 'herb_garden', 'tea_garden', 'orchard', 'mulberry_grove'];
// 夜間仍運作的物件(灶、酒館、藥爐等發光者,§6.1)
const AMB_NIGHT_OK = ['stove', 'kitchen_shed', 'shop_wine', 'shop_tea', 'brothel', 'herb_stove', 'smelter',
  'drum', 'drum_tower', 'temple_futu', 'temple_dao', 'altar', 'bell_chime', 'bamboo', 'pond', 'waterwheel'];

function ambObjIds(type) {
  if (Object.prototype.hasOwnProperty.call(AMB_OBJ, type)) return AMB_OBJ[type];
  if (type.indexOf('stall_') === 0) return ['life_crowd'];
  return null;
}

function ambIsField(type) {
  return type.indexOf('field_') === 0 || AMB_FIELD_TYPES.indexOf(type) >= 0;
}

function ambTodMul(id, tod) {
  const d = AMB_DEFS[id];
  if (id === 'ani_chicken') return { dawn: 3, noon: 0.5, dusk: 0.3, night: 0 }[tod];
  if (d && d.grp === 'work' && (tod === 'dawn' || tod === 'dusk')) return 0.6;
  return 1;
}

function ambGetBuf(id) {
  if (AMB.buf[id]) return AMB.buf[id];
  const def = AMB_DEFS[id];
  if (!def || !AU.ctx) return null;
  const pcm = ambNorm(def.render(), 0.7);
  const buf = AU.ctx.createBuffer(1, pcm.length, AU_SR);
  buf.getChannelData(0).set(pcm);
  AMB.buf[id] = buf;
  return buf;
}

function ambNow() { return auNow(); }

function ambLog(id, kind, now, x, y, end) {
  AMB.log.push({ t: now, id: id, kind: kind, x: x, y: y, end: end });
  AMB.nLog++;
  while (AMB.log.length && AMB.log[0].t < now - AMB_LOG_SEC) AMB.log.shift();
}

function ambCountSingles(now) {
  let n = 0;
  for (let i = AMB.log.length - 1; i >= 0; i--) {
    const e = AMB.log[i];
    if (e.t < now - 60) break;
    if (e.kind === 'single') n++;
  }
  return n;
}

function ambRamp(param, v, tc) {
  try {
    param.setTargetAtTime(v, AU.ctx.currentTime, tc);
  } catch (e) {
    param.value = v;
  }
}

function ambPruneFading(now) {
  AMB.fading = AMB.fading.filter(function (f) {
    if (f.stopAt > now) return true;
    try { f.src.stop(); } catch (e) { /* 已停止 */ }
    return false;
  });
}

function ambFlushFading() {
  AMB.fading.forEach(function (f) {
    try { f.src.stop(); } catch (e) { /* 已停止 */ }
  });
  AMB.fading = [];
}

// 底:換底時舊底淡出 1.2 s 後停止、新底淡入 1.2 s(約 4 秒交叉淡化)
function ambSetBed(id, zg) {
  const want = id || '';
  const now = ambNow();
  if (AMB.bed && AMB.bedId !== want) {
    ambRamp(AMB.bed.gain, 0, 1.2);
    AMB.fading.push({ src: AMB.bed.src, stopAt: now + 5 });
    AMB.bed = null;
  }
  AMB.bedId = want;
  if (!want) return;
  const def = AMB_DEFS[want];
  if (!def || !def.bed) return;
  if (!AMB.bed) {
    const buf = ambGetBuf(want);
    if (!buf) return;
    const ctx = AU.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g);
    g.connect(AU.buses.amb);
    src.start(0);
    AMB.bed = { id: want, src: src, gain: g };
    ambLog(want, 'bed', now, 0, 0, 0);
  }
  ambRamp(AMB.bed.gain, def.gain * zg, 1.2);
}

// 單發閘門:同種冷卻(gap 為下限,抖動只拉長)、群組冷卻、同時 ≤2、每分鐘 ≤8
function ambCanFire(id, now) {
  const def = AMB_DEFS[id];
  if (!def || def.bed) return false;
  if (AMB.next[id] !== undefined && now < AMB.next[id]) return false;
  const gg = def.grp ? AUDIO_GROUP_GAP[def.grp] : undefined;
  if (gg && AMB.grpLast[def.grp] !== undefined && now - AMB.grpLast[def.grp] < gg) return false;
  return true;
}

function ambFire(id, zg, x, y, src, now) {
  const def = AMB_DEFS[id];
  if (!ambCanFire(id, now) || !AU.ctx || !AU.buses.amb) return false;
  AMB.voices = AMB.voices.filter(function (v) { return v.end > now; });
  if (AMB.voices.length >= AMB_MAX_SINGLES) return false;
  if (ambCountSingles(now) >= AMB_MAX_PER_MIN) return false;
  const buf = ambGetBuf(id);
  if (!buf) return false;
  const ctx = AU.ctx;
  const rate = 1 + (ambRand() * 2 - 1) * 0.03;
  const node = ctx.createBufferSource();
  node.buffer = buf;
  node.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = def.gain * zg * Math.pow(10, ((ambRand() * 2 - 1) * 1.5) / 20);
  node.connect(g);
  g.connect(AU.buses.amb);
  node.start(0);
  const end = now + buf.duration / rate + 0.05;
  AMB.voices.push({ id: id, end: end });
  AMB.next[id] = now + def.gap * (1 + def.jit / 100 * ambRand());
  if (def.grp) AMB.grpLast[def.grp] = now;
  ambLog(id, 'single', now, x, y, end);
  if (src) AMB.log[AMB.log.length - 1].src = src;
  return true;
}

function ambGate() {
  if (typeof AU !== 'object' || !AU.ready || !AU.ctx || !AU.buses || !AU.buses.amb) return 0;
  const cfg = auCfg();
  if (!cfg.amb || !cfg.amb.on || cfg.quiet) return 0;
  if (typeof game === 'undefined' || (game.mode !== 'estate' && game.mode !== 'visit')) return 0;
  if (typeof pano !== 'undefined' && pano.open) return 0;
  if (typeof document !== 'undefined' && document.body && document.body.classList &&
      document.body.classList.contains('sandbox')) return 0;
  const zoom = typeof view === 'object' ? view.zoom : 1;
  if (!(zoom >= 0.35)) return 0;
  return zoom < 0.8 ? 0.5 : 1;
}

function ambSeason() {
  return typeof currentSeason === 'string' ? currentSeason : 'spring';
}

function ambTod() {
  if (typeof artTodKey === 'function') return artTodKey();
  const d = new Date();
  return ['dawn', 'noon', 'dusk', 'night'][Math.floor((d.getHours() * 60 + d.getMinutes()) / 15) % 4];
}

function ambWeatherKind() {
  const cfg = auCfg();
  if (cfg.weatherFx === false) return 'clear';
  try {
    if (typeof artWeather === 'function') {
      const w = artWeather();
      const k = typeof w === 'string' ? w : (w && w.kind);
      if (k === 'rain' || k === 'snow') return k;
    }
  } catch (e) {
    return 'clear';
  }
  return 'clear';
}

function ambCenterCell() {
  let c = null;
  try {
    if (typeof screenToCell === 'function') {
      const vw = typeof viewport === 'object' ? viewport.w : 800;
      const vh = typeof viewport === 'object' ? viewport.h : 600;
      c = screenToCell(vw / 2, vh / 2);
    }
  } catch (e) {
    c = null;
  }
  return c || { x: Math.floor(MAP_W / 2), y: Math.floor(MAP_H / 2) };
}

// 掃描中心附近 R 格:地形 / 樹 / 竹 / 田 計數,以及運作中的物件候選(取最近 2 個)
function ambScan(cell, R, tod) {
  const cx = cell.x, cy = cell.y;
  const res = { near: [], trees: 0, bamboo: 0, fields: 0, water: 0 };
  for (let y = Math.max(0, cy - R); y <= Math.min(MAP_H - 1, cy + R); y++) {
    for (let x = Math.max(0, cx - R); x <= Math.min(MAP_W - 1, cx + R); x++) {
      const t = world.terrain[y * MAP_W + x];
      if (t === T_LAKE || t === T_RIVER) res.water++;
    }
  }
  const cands = [];
  const objs = world.objects;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    const dx = o.x - cx, dy = o.y - cy;
    if (Math.abs(dx) > R || Math.abs(dy) > R) continue;
    if (o.type === 'tree') res.trees++;
    else if (o.type === 'bamboo') res.bamboo++;
    else if (o.type === 'pond') res.water++;
    if (ambIsField(o.type)) res.fields++;
    const ids = ambObjIds(o.type);
    if (!ids) continue;
    if (tod === 'night' && AMB_NIGHT_OK.indexOf(o.type) < 0) continue;
    cands.push({ o: o, ids: ids, d: Math.sqrt(dx * dx + dy * dy) });
  }
  cands.sort(function (a, b) { return a.d - b.d; });
  res.near = cands.slice(0, 2);
  return res;
}

function ambObjectSlot(scan, tod, zg, now) {
  const near = scan.near;
  if (!near.length) return;
  const c = near[AMB.rr % near.length];
  AMB.rr++;
  const ids = c.ids.filter(function (id) {
    return !(id === 'amb_watch' && tod !== 'night') && ambCanFire(id, now);
  });
  if (!ids.length) return;
  const id = ids[Math.floor(ambRand() * ids.length)];
  if (ambRand() >= AMB_FIRE_P * ambTodMul(id, tod)) return;
  ambFire(id, zg, c.o.x, c.o.y, 'obj', now);
}

// 自然音權重:季節 × 時段 × 地形 × 天氣(§6.3、§6.4.1、§6.5)
function ambNatureWeights(s, season, tod, wx) {
  const rainy = wx === 'rain', snowy = wx === 'snow';
  const wet = s.water >= 3;
  const dawnDusk = tod === 'dawn' || tod === 'dusk';
  const w = {};
  const seasonMul = function (m) { return m[season] || 0; };

  w.amb_cicada = season === 'summer' && tod === 'noon' ? (s.trees >= 4 ? 2 : 0.5) : (season === 'summer' && dawnDusk ? 0.4 : 0);
  if (rainy || snowy) w.amb_cicada = 0;

  const frogSeason = { summer: 1, spring: 0.5 }[season] || 0;
  const frogTod = { dusk: 0.6, night: 1 }[tod] || 0;
  w.amb_frog = frogSeason * frogTod * (wet ? 2 : (s.fields >= 2 ? 1 : 0)) * (rainy ? 1.5 : 1) * (snowy ? 0 : 1);

  const birdSeason = seasonMul({ spring: 1.5, summer: 1, autumn: 0.7, winter: 0 });
  const birdTod = { dawn: 2, noon: 1, dusk: 0.5 }[tod] || 0;
  w.amb_bird = s.trees >= 5 ? birdSeason * birdTod * (rainy ? 0.3 : 1) * (snowy ? 0 : 1) : 0;

  const crowSeason = seasonMul({ autumn: 0.4, winter: 1 });
  w.amb_crow = dawnDusk ? crowSeason * (snowy ? 0.5 : 1) : 0;

  w.amb_wind = seasonMul({ spring: 1, summer: 1, autumn: 1.3, winter: 2 }) * (rainy ? 0.5 : 1);
  w.amb_bamboo = s.bamboo >= 1 ? 1 : 0;
  w.amb_water = wet && season !== 'winter' ? 1 : 0;
  w.amb_rain_drip = rainy ? 1 : 0;
  w.amb_snow_gust = snowy ? 1 : 0;

  // 夏夜只留蛙(與底蟲);冬天只留風、烏鴉與雪風
  if (season === 'summer' && tod === 'night') {
    return { amb_frog: w.amb_frog };
  }
  if (season === 'winter') {
    return { amb_wind: w.amb_wind, amb_crow: w.amb_crow, amb_snow_gust: w.amb_snow_gust, amb_rain_drip: w.amb_rain_drip };
  }
  return w;
}

function ambNatureSlot(scan, season, tod, wx, zg, now) {
  const weights = ambNatureWeights(scan, season, tod, wx);
  const pool = [];
  let total = 0;
  Object.keys(weights).forEach(function (id) {
    if (weights[id] > 0 && ambCanFire(id, now)) {
      pool.push([id, weights[id]]);
      total += weights[id];
    }
  });
  if (!pool.length) return;
  let r = ambRand() * total;
  let pick = pool[pool.length - 1][0];
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i][1];
    if (r < 0) { pick = pool[i][0]; break; }
  }
  if (ambRand() >= AMB_FIRE_P) return;
  ambFire(pick, zg, scan.cx, scan.cy, 'nat', now);
}

function ambBedFor(season, tod, wx) {
  if (wx === 'rain') return 'amb_rain';
  if (wx === 'snow') return 'amb_snow';
  if ((season === 'summer' || season === 'autumn') && (tod === 'dusk' || tod === 'night')) return 'amb_cricket';
  return null;
}

function ambTick() {
  const now = ambNow();
  ambPruneFading(now);
  const zg = ambGate();
  if (!zg) {
    ambSetBed(null, 0);
    return;
  }
  const cell = ambCenterCell();
  const R = Math.min(14, Math.max(4, Math.round(10 / view.zoom)));
  const season = ambSeason(), tod = ambTod(), wx = ambWeatherKind();
  const scan = ambScan(cell, R, tod);
  scan.cx = cell.x;
  scan.cy = cell.y;
  ambSetBed(ambBedFor(season, tod, wx), zg);
  AMB.tickN++;
  if (AMB.tickN % 2) ambObjectSlot(scan, tod, zg, now);
  else ambNatureSlot(scan, season, tod, wx, zg, now);
}

function ambStart() {
  AMB.manual = false;
  if (AMB.timer != null) return true;
  if (typeof setInterval !== 'function') return false;
  AMB.timer = setInterval(ambTick, AMB_POLL_MS);
  return true;
}

function ambStop() {
  AMB.manual = true;
  if (AMB.timer != null) {
    if (typeof clearInterval === 'function') clearInterval(AMB.timer);
    AMB.timer = null;
  }
  ambSetBed(null, 0);
  if (typeof setTimeout === 'function') setTimeout(ambFlushFading, 6000);
  return true;
}

// 統計近 sec 秒(預設 60)的單發次數與底狀態,供驗收
function ambStats(sec) {
  const now = ambNow(), win = sec || 60;
  const counts = {};
  let total = 0;
  for (let i = AMB.log.length - 1; i >= 0; i--) {
    const e = AMB.log[i];
    if (e.t < now - win) break;
    if (e.kind !== 'single') continue;
    counts[e.id] = (counts[e.id] || 0) + 1;
    total++;
  }
  return {
    sec: win,
    total: total,
    counts: counts,
    active: AMB.voices.filter(function (v) { return v.end > now; }).length,
    bed: AMB.bed ? AMB.bed.id : ''
  };
}

function ambWatch() {
  if (AMB.manual || AMB.timer != null) return;
  if (typeof AU === 'object' && AU.ready) ambStart();
}

if (typeof setInterval === 'function') AMB.watch = setInterval(ambWatch, 1000);
