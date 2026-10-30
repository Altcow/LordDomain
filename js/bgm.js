// bgm.js — 程序化古風背景音樂與場景切換(PLAN_AUDIO §7.3、§7.4;AU1-02)。
// 零音檔:音色在 JS 內算成 PCM,預渲染成 AudioBuffer 快取;排程以 AudioContext 時間做 lookahead。
// 依賴 audio.js 的 AU(ctx、master、buses.music、ready)、auCfg()、auNow();game / battle / ART_TOD / currentSeason 只讀。
// 外部 API:bgmStart / bgmStop / bgmScene / bgmSetScene / bgmSetEnabled / bgmStats。檔案載入時自動 bgmStart,音訊解鎖後才出聲。

const BG_LOOK = 0.25;
const BG_TICK_MS = 100;
const BG_POLL_MS = 500;
const BG_WAIT_MS = 1000;
const BG_DEBOUNCE = 1.2;
const BG_MIN_DWELL = 8;
const BG_FADE = 1.5;
const BG_FADE_HARD = 0.6;
const BG_MAX_VOICES = 8;
const BG_PHRASE = 32;
const BG_TRACK_GAIN = 0.8;
const BG_WARM_MS = 6;
const BG_FADE_OUT_QUICK = 0.05;

const BG_MODES = {
  gong: [0, 2, 4, 7, 9],
  shang: [0, 2, 5, 7, 10],
  jue: [0, 3, 5, 8, 10],
  zhi: [0, 2, 5, 7, 9],
  yu: [0, 3, 5, 7, 10]
};

const BG_GAIN = { guz: 0.55, flute: 0.4, erhu: 0.4, pipa: 0.5, horn: 0.35, taiko: 0.7, wood: 0.5, gong: 0.45, chime: 0.35 };
const BG_DUR = { taiko: 0.7, wood: 0.12, gong: 2.6, chime: 2.2 };
const BG_BUF_DUR = { guz: 1.4, flute: 1.6, erhu: 1.6, pipa: 0.9, horn: 1.2 };
const BG_PITCHED = { guz: 1, flute: 1, erhu: 1, pipa: 1, horn: 1 };

// 場景表。percA / percB:A 段、B 段的鼓型樣式(每小節 16 格;X 重、x 中、o 輕、. 無)
// pad:持續音音量(0 = 不播);stream:流水底音量;woodEvery:隨機梆子間隔秒(觀察期)
const BG_SCENES = {
  estate_day: {
    bpm: 84, mode: 'gong', tonics: [60, 62, 65, 67], mel: [['guz', 0.6], ['flute', 0.4]],
    dens: 0.55, rhythm: 'slow', pad: 0.12, horn: 0,
    percA: { taiko: 'o.......o.......', wood: '....x.......x...' },
    percB: { taiko: 'o.......o.......', wood: '....x.......x...' }
  },
  design: {
    bpm: 66, mode: 'yu', tonics: [50, 52, 55], mel: [['guz', 1]], dens: 0.3, rhythm: 'slow', pad: 0.3, horn: 0,
    percA: { taiko: 'x.......o.......' }, percB: { taiko: 'x.......o.......' }
  },
  scout: {
    bpm: 60, mode: 'yu', tonics: [48, 50], mel: [], dens: 0, rhythm: 'slow', pad: 0.3, horn: 0,
    percA: {}, percB: {}, woodEvery: [6, 12]
  },
  battle: {
    bpm: 132, mode: 'yu', tonics: [57, 59, 62], mel: [['pipa', 1]], dens: 0.9, rhythm: 'fast', pad: 0.2, horn: 0.5,
    percA: { taiko: 'X.o.x.o.X.o.x.o.' },
    percB: { taiko: 'X.x.X.x.X.x.X.x.', wood: '..x...x...x...x.' }
  },
  fishing: {
    bpm: 76, mode: 'zhi', tonics: [62, 64, 67], mel: [['flute', 1]], dens: 0.5, rhythm: 'slow', pad: 0.12, horn: 0,
    percA: { wood: '..x.....x.......' }, percB: { wood: '..x.....x.......' }, stream: 0.25
  }
};

// 各場景會用到的音色(預渲染佇列依此排)
const BG_SCENE_INST = {
  estate_day: ['guz', 'flute', 'taiko', 'wood', 'pad'],
  design: ['guz', 'taiko', 'pad'],
  scout: ['pad', 'wood'],
  battle: ['pipa', 'horn', 'taiko', 'wood', 'pad'],
  fishing: ['flute', 'wood', 'pad', 'stream'],
  win: ['horn', 'guz', 'chime', 'gong'],
  lose: ['pipa', 'erhu', 'horn', 'gong']
};

const BG = {
  want: false,
  enabled: true,
  running: false,
  forced: null,
  scene: null,
  sceneStart: 0,
  pending: null,
  cur: null,
  tracks: [],
  live: [],
  bufs: {},
  queue: [],
  queued: {},
  seq: 0,
  returnScene: 'estate_day',
  resultSeen: null,
  stingerEnd: 0,
  stats: { played: {}, dropped: {}, peak: 0 },
  pollTimer: null,
  pollMs: 0,
  schedTimer: null
};

function bgRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bgHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function bgIsScene(name) {
  return Object.prototype.hasOwnProperty.call(BG_SCENES, name);
}

function bgMidiOf(tonic, mode, d) {
  const n = BG_MODES[mode];
  const oct = Math.floor(d / 5);
  return tonic + 12 * oct + n[d - oct * 5];
}

// 依時段 / 季節微調 estate_day;其他場景照表
function bgStyleFor(scene) {
  const base = BG_SCENES[scene];
  const st = Object.assign({}, base);
  st.stream = base.stream || 0;
  st.woodEvery = base.woodEvery || null;
  if (scene === 'estate_day') {
    const season = typeof currentSeason === 'string' ? currentSeason : 'spring';
    const tod = typeof ART_TOD === 'string' ? ART_TOD : 'noon';
    if (season === 'spring') { st.bpm += 6; st.dens += 0.1; }
    else if (season === 'summer') { st.bpm -= 4; st.mode = 'shang'; }
    else if (season === 'autumn') { st.bpm -= 6; st.mode = 'yu'; st.dens *= 0.7; }
    else if (season === 'winter') { st.bpm -= 12; st.dens = 0.3; st.pad = 0.25; st.mode = 'yu'; st.mel = [['guz', 1]]; }
    if (tod === 'dusk') { st.bpm -= 4; st.mode = 'jue'; }
    if (tod === 'night') {
      st.bpm = 60; st.dens = 0.22; st.mode = 'yu'; st.pad = 0.2; st.mel = [['guz', 1]];
      st.percA = {}; st.percB = {};
    }
  }
  return st;
}

// 4 拍一小節(16 格)的動機:音符長度(格數)加總 = 16
function bgMotif(rng, rhythm) {
  const sizes = rhythm === 'fast' ? [2, 2, 4] : [2, 4, 4, 6, 8];
  const steps = [];
  let left = 16;
  while (left > 0) {
    const cand = sizes.filter(function (x) { return x <= left; });
    const pick = cand[Math.floor(rng() * cand.length)];
    steps.push(pick);
    left -= pick;
  }
  const out = [];
  let d = Math.floor(rng() * 3);
  for (let i = 0; i < steps.length; i++) {
    if (i > 0) d += [-2, -1, -1, 1, 1, 2, 3][Math.floor(rng() * 7)];
    d = Math.max(-3, Math.min(5, d));
    out.push({ d: d, n: steps[i] });
  }
  return out;
}

// 變形:模進、倒影、降一度或原樣(長度不變)
function bgVary(m, rng) {
  const op = Math.floor(rng() * 4);
  const d0 = m[0].d;
  return m.map(function (it) {
    let d = it.d;
    if (op === 0) d += 1;
    else if (op === 1) d = 2 * d0 - it.d;
    else if (op === 2) d -= 1;
    return { d: Math.max(-3, Math.min(5, d)), n: it.n };
  });
}

function bgPickMel(mel, rng) {
  if (!mel || !mel.length) return null;
  let total = 0;
  mel.forEach(function (x) { total += x[1]; });
  let r = rng() * total;
  for (let i = 0; i < mel.length; i++) {
    r -= mel[i][1];
    if (r <= 0) return mel[i][0];
  }
  return mel[mel.length - 1][0];
}

// 一句 = 2 小節(32 格)。A-B-A:每 12 句一輪,第 4~7 句為 B 段(移到屬)。
function bgMakePhrase(tr, pi) {
  const rng = tr.rng;
  const st = bgStyleFor(tr.scene);
  tr.style = st;
  if (pi % 12 === 0 || !tr.motifs) {
    tr.tonic = st.tonics[Math.floor(rng() * st.tonics.length)];
    tr.motifs = { A: bgMotif(rng, st.rhythm), B: bgMotif(rng, st.rhythm) };
  }
  const k = pi % 12;
  const sec = k >= 4 && k < 8 ? 'B' : 'A';
  const tonic = sec === 'B' ? tr.tonic + 7 : tr.tonic;
  const motif = sec === 'B' ? tr.motifs.B : tr.motifs.A;
  const bars = [motif, bgVary(motif, rng)];
  const mel = bgPickMel(st.mel, rng);
  const byStep = {};
  if (mel) {
    for (let b = 0; b < 2; b++) {
      const seq = bars[b];
      let s = b * 16;
      for (let i = 0; i < seq.length; i++) {
        const it = seq[i];
        const last = b === 1 && i === seq.length - 1;
        if (i === 0 || last || rng() < st.dens) {
          const n = last ? BG_PHRASE - s : it.n;
          const d = last ? 0 : it.d;
          (byStep[s] = byStep[s] || []).push({ inst: mel, midi: bgMidiOf(tonic, st.mode, d), n: n, v: 0.6 + 0.4 * rng() });
        }
        s += it.n;
      }
    }
  }
  if (st.horn > 0 && sec === 'A' && pi % 4 === 0 && rng() < st.horn) {
    (byStep[0] = byStep[0] || []).push({ inst: 'horn', midi: tonic, n: 12, v: 0.8 });
  }
  return { sec: sec, byStep: byStep, pads: [tonic - 12, tonic - 12 + (sec === 'B' ? 7 : 5)] };
}

// 結算短曲(固定譜,不循環):win 約 7.8 秒、lose 約 7.1 秒
function bgStingerScore(kind) {
  const score = {};
  const win = kind === 'win';
  const tonic = win ? 62 : 57;
  const mode = win ? 'gong' : 'yu';
  function add(s, inst, d, n, v) {
    (score[s] = score[s] || []).push({ inst: inst, midi: bgMidiOf(tonic, mode, d), n: n, v: v });
  }
  if (win) {
    add(0, 'horn', 0, 6, 0.9); add(6, 'horn', 2, 4, 0.9); add(12, 'horn', 4, 8, 0.9);
    [0, 2, 4, 5, 4, 2].forEach(function (d, i) { add(20 + 2 * i, 'guz', d, 2, 0.8); });
    add(32, 'guz', 0, 16, 0.9); add(32, 'chime', 0, 1, 0.5); add(36, 'gong', 0, 1, 0.8);
  } else {
    add(0, 'pipa', 4, 2, 0.8); add(2, 'pipa', 3, 2, 0.8); add(4, 'pipa', 2, 2, 0.75);
    add(6, 'pipa', 1, 4, 0.7); add(10, 'pipa', 0, 4, 0.7);
    add(14, 'erhu', 0, 10, 0.7); add(24, 'erhu', -1, 8, 0.6); add(34, 'gong', 0, 1, 0.8);
  }
  return { score: score, len: win ? 52 : 42, stepSec: win ? 60 / 100 / 4 : 60 / 84 / 4 };
}

function bgBuf(key) {
  if (BG.bufs[key]) return BG.bufs[key];
  const pcm = bgRender(key);
  const buf = AU.ctx.createBuffer(1, pcm.length, AU_SR);
  buf.getChannelData(0).set(pcm);
  BG.bufs[key] = buf;
  return buf;
}

function bgRender(key) {
  const p = key.split(':');
  const inst = p[0];
  if (inst === 'guz') return bgKS(bgHz(+p[2]), BG_BUF_DUR.guz, p[1] === 's');
  if (inst === 'flute') return bgFlute(bgHz(+p[1]), BG_BUF_DUR.flute);
  if (inst === 'erhu') return bgErhu(bgHz(+p[1]), BG_BUF_DUR.erhu);
  if (inst === 'pipa') return bgPipa(bgHz(+p[1]), BG_BUF_DUR.pipa);
  if (inst === 'horn') return bgHorn(bgHz(+p[1]), BG_BUF_DUR.horn);
  if (inst === 'taiko') return bgTaiko();
  if (inst === 'wood') return bgWood();
  if (inst === 'gong') return bgGong();
  if (inst === 'chime') return bgChime();
  if (inst === 'pad') return bgPad();
  if (inst === 'stream') return bgStream();
  return new Float32Array(1);
}

function bgNorm(out, peak) {
  let m = 0;
  for (let i = 0; i < out.length; i++) {
    const a = Math.abs(out[i]);
    if (a > m) m = a;
  }
  if (m > 0) {
    const k = peak / m;
    for (let i = 0; i < out.length; i++) out[i] *= k;
  }
  return out;
}

// Karplus-Strong 撥弦(箏);soft 為較多平滑、音色較暗
function bgKS(f, dur, soft) {
  const N = Math.max(2, Math.round(AU_SR / f));
  const n = Math.floor(dur * AU_SR);
  const out = new Float32Array(n);
  const d = new Float32Array(N);
  const rnd = bgRng(N * 31 + (soft ? 7 : 3));
  for (let i = 0; i < N; i++) d[i] = rnd() * 2 - 1;
  const passes = soft ? 6 : 1;
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < N; i++) d[i] = 0.5 * (d[i] + d[(i + 1) % N]);
  }
  const decay = Math.pow(10, -2.5 / Math.max(0.5, f * dur));
  let p = 0;
  for (let i = 0; i < n; i++) {
    const a = d[p];
    out[i] = a;
    const q = p + 1 < N ? p + 1 : 0;
    d[p] = decay * 0.5 * (a + d[q]);
    p = q;
  }
  const fadeN = Math.floor(0.03 * AU_SR);
  for (let i = 0; i < fadeN && i < n; i++) out[n - 1 - i] *= i / fadeN;
  return bgNorm(out, 0.9);
}

function bgFlute(f, dur) {
  const n = Math.floor(dur * AU_SR);
  const out = new Float32Array(n);
  const rnd = bgRng(Math.round(f * 10) + 3);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    const vib = 1 + 0.006 * Math.min(1, t / 0.4) * Math.sin(2 * Math.PI * 5.2 * t);
    ph += 2 * Math.PI * f * vib / AU_SR;
    const x = rnd() * 2 - 1;
    lp += 0.5 * (x - lp);
    const body = Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.07 * Math.sin(3 * ph);
    out[i] = Math.min(1, t / 0.09) * (body * 0.75 + 0.05 * (x - lp));
  }
  return bgNorm(out, 0.9);
}

// 二胡:鋸齒波(諧波 1/k)+ 漸入顫音
function bgErhu(f, dur) {
  const n = Math.floor(dur * AU_SR);
  const out = new Float32Array(n);
  const K = Math.max(1, Math.min(12, Math.floor(2600 / f)));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    const depth = 0.012 * Math.min(1, Math.max(0, (t - 0.15) / 0.5));
    ph += 2 * Math.PI * f * (1 + depth * Math.sin(2 * Math.PI * 5.8 * t)) / AU_SR;
    let s = 0;
    for (let k = 1; k <= K; k++) s += Math.sin(k * ph) / k;
    out[i] = s * Math.min(1, t / 0.06);
  }
  return bgNorm(out, 0.9);
}

// 琵琶:鋸齒波諧波,高次諧波衰減較快(撥弦感)
function bgPipa(f, dur) {
  const n = Math.floor(dur * AU_SR);
  const out = new Float32Array(n);
  const K = Math.max(1, Math.min(8, Math.floor(2600 / f)));
  const dk = [];
  for (let k = 1; k <= K; k++) dk.push((1 + 1.2 * k) / 0.45);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    ph += 2 * Math.PI * f / AU_SR;
    let s = 0;
    for (let k = 1; k <= K; k++) s += Math.exp(-t * dk[k - 1]) * Math.sin(k * ph) / k;
    out[i] = Math.min(1, t / 0.004) * s;
  }
  return bgNorm(out, 0.9);
}

// 號角:鋸齒波諧波 + 漸入顫音(合成號角,作為戰鬥 / 結算的號聲)
function bgHorn(f, dur) {
  const n = Math.floor(dur * AU_SR);
  const out = new Float32Array(n);
  const K = Math.max(1, Math.min(10, Math.floor(2400 / f)));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    const vib = 1 + 0.008 * Math.min(1, Math.max(0, (t - 0.25) / 0.4)) * Math.sin(2 * Math.PI * 5.5 * t);
    ph += 2 * Math.PI * f * vib / AU_SR;
    let s = 0;
    for (let k = 1; k <= K; k++) s += Math.sin(k * ph) / k;
    out[i] = s * Math.min(1, t / 0.07);
  }
  return bgNorm(out, 0.9);
}

function bgTaiko() {
  const n = Math.floor(0.7 * AU_SR);
  const out = new Float32Array(n);
  const rnd = bgRng(101);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    ph += 2 * Math.PI * (55 + 80 * Math.exp(-t / 0.025)) / AU_SR;
    const x = rnd() * 2 - 1;
    lp += 0.3 * (x - lp);
    out[i] = Math.sin(ph) * Math.exp(-t / 0.2) + 0.4 * lp * Math.exp(-t / 0.012);
  }
  return bgNorm(out, 0.9);
}

function bgWood() {
  const n = Math.floor(0.12 * AU_SR);
  const out = new Float32Array(n);
  const rnd = bgRng(202);
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    const x = rnd() * 2 - 1;
    out[i] = Math.sin(2 * Math.PI * 1250 * t) * Math.exp(-t / 0.012)
      + 0.4 * Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t / 0.006)
      + 0.2 * x * Math.exp(-t / 0.004);
  }
  return bgNorm(out, 0.9);
}

function bgGong() {
  const n = Math.floor(2.6 * AU_SR);
  const out = new Float32Array(n);
  const rnd = bgRng(303);
  const R = [1, 1.48, 1.93, 2.53, 3.1, 4.2];
  const A = [1, 0.6, 0.5, 0.35, 0.22, 0.12];
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    let s = 0;
    for (let j = 0; j < R.length; j++) s += A[j] * Math.sin(2 * Math.PI * 110 * R[j] * t);
    out[i] = s * Math.exp(-t / 1.5) + 0.25 * (rnd() * 2 - 1) * Math.exp(-t / 0.01);
  }
  return bgNorm(out, 0.9);
}

function bgChime() {
  const n = Math.floor(2.2 * AU_SR);
  const out = new Float32Array(n);
  const R = [1, 2.76, 5.4, 8.93];
  const A = [1, 0.5, 0.25, 0.12];
  const T = [0.9, 0.5, 0.25, 0.15];
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    let s = 0;
    for (let j = 0; j < R.length; j++) s += A[j] * Math.exp(-t / T[j]) * Math.sin(2 * Math.PI * 660 * R[j] * t);
    out[i] = s;
  }
  return bgNorm(out, 0.9);
}

// 持續音(低音墊):全部分音為 110 Hz 的整數倍、包絡週期 4 秒,故 4 秒循環無縫
function bgPad() {
  const n = 4 * AU_SR;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    const env = 0.75 + 0.25 * Math.sin(2 * Math.PI * t / 4);
    out[i] = env * (0.6 * Math.sin(2 * Math.PI * 110 * t) + 0.3 * Math.sin(2 * Math.PI * 165 * t) + 0.15 * Math.sin(2 * Math.PI * 220 * t));
  }
  return bgNorm(out, 0.9);
}

// 流水底:環狀平滑的白噪音(循環無縫)+ 慢起伏 + 偶發水泡
function bgStream() {
  const n = 4 * AU_SR;
  const rnd = bgRng(404);
  let src = new Float32Array(n);
  for (let i = 0; i < n; i++) src[i] = rnd() * 2 - 1;
  for (let pass = 0; pass < 2; pass++) {
    const dst = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = -3; k <= 3; k++) s += src[(i + k + n) % n];
      dst[i] = s / 7;
    }
    src = dst;
  }
  for (let i = 0; i < n; i++) src[i] *= 1 + 0.5 * Math.sin(2 * Math.PI * i / n);
  const bl = Math.floor(0.12 * AU_SR);
  for (let k = 0; k < 8; k++) {
    const st = Math.floor(rnd() * n);
    const f = 500 + rnd() * 900;
    for (let j = 0; j < bl; j++) {
      const idx = (st + j) % n;
      src[idx] += 0.6 * Math.sin(2 * Math.PI * f * j / AU_SR) * Math.exp(-j / (0.03 * AU_SR));
    }
  }
  return bgNorm(src, 0.9);
}

// 音色規格:箏 / 笛 / 二胡 / 琵琶 以 60~71 的 12 個音預渲染,其餘音以 playbackRate 移八度
function bgSpec(inst, midi, vel) {
  if (inst === 'horn') return { buf: bgBuf('horn:62'), rate: Math.pow(2, (midi - 62) / 12) };
  if (BG_PITCHED[inst] !== 1) return { buf: bgBuf(inst), rate: 1 };
  const base = 60 + (((midi - 60) % 12) + 12) % 12;
  const key = inst === 'guz' ? 'guz:' + (vel < 0.8 ? 's' : 'h') + ':' + base : inst + ':' + base;
  return { buf: bgBuf(key), rate: Math.pow(2, (midi - base) / 12) };
}

function bgVoices(t) {
  let n = 0;
  for (let i = 0; i < BG.live.length; i++) {
    if (BG.live[i].end > t) n++;
  }
  return n;
}

// 單發音:先過聲部上限(旋律留一格給鼓),再建 BufferSource + 包絡增益
function bgPlay(tr, t, inst, midi, vel, dur) {
  const melodic = BG_PITCHED[inst] === 1;
  if (bgVoices(t) >= (melodic ? BG_MAX_VOICES - 1 : BG_MAX_VOICES)) {
    BG.stats.dropped[inst] = (BG.stats.dropped[inst] || 0) + 1;
    return false;
  }
  const sp = bgSpec(inst, midi, vel);
  const ctx = AU.ctx;
  const src = ctx.createBufferSource();
  src.buffer = sp.buf;
  const jig = (inst === 'taiko' || inst === 'wood' || inst === 'gong' || inst === 'chime') ? 1 + (tr.rng() * 2 - 1) * 0.02 : 1;
  src.playbackRate.setValueAtTime(sp.rate * jig, t);
  let end = t + (dur != null ? dur : (BG_DUR[inst] || 1));
  end = Math.min(end, t + sp.buf.duration / (sp.rate * jig));
  if (end - t < 0.05) end = t + 0.05;
  const peak = BG_GAIN[inst] * vel;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.008);
  g.gain.setValueAtTime(peak, Math.max(t + 0.01, end - 0.06));
  g.gain.linearRampToValueAtTime(0, end);
  src.connect(g);
  g.connect(tr.gain);
  src.start(t);
  src.stop(end + 0.02);
  BG.live.push({ start: t, end: end, src: src, tr: tr });
  BG.stats.played[inst] = (BG.stats.played[inst] || 0) + 1;
  const v = bgVoices(t);
  if (v > BG.stats.peak) BG.stats.peak = v;
  return true;
}

// 循環音(持續音墊 / 流水底):只建一次,之後用 playbackRate 改音高
function bgStartLoop(tr, inst, level, t) {
  const ctx = AU.ctx;
  const src = ctx.createBufferSource();
  src.buffer = bgBuf(inst);
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = src.buffer.duration;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  src.connect(g);
  g.connect(tr.gain);
  src.start(t);
  BG.live.push({ start: t, end: Infinity, src: src, tr: tr });
  return src;
}

function bgPadAt(tr, t, midi) {
  if (!tr.pad) tr.pad = bgStartLoop(tr, 'pad', tr.style.pad, t);
  tr.pad.playbackRate.setValueAtTime(Math.pow(2, (midi - 45) / 12), t);
}

function bgStingerStep(tr, t, s) {
  if (s >= tr.len) {
    tr.done = true;
    tr.endT = t + 2.6;
    return;
  }
  const list = tr.score[s];
  if (list) list.forEach(function (ev) { bgPlay(tr, t, ev.inst, ev.midi, ev.v, ev.n * tr.stepSec * 1.2); });
}

// 一個 16 分音格:鼓型樣式、句首音墊、隨機梆子、旋律音
function bgStep(tr, t) {
  if (tr.stinger) {
    bgStingerStep(tr, t, tr.step);
    return;
  }
  const s = tr.step;
  const sp = s % BG_PHRASE;
  if (sp === 0) {
    tr.phrase = bgMakePhrase(tr, tr.pi);
    tr.pi++;
    tr.stepSec = 60 / tr.style.bpm / 4;
  }
  const ph = tr.phrase;
  const bar = s % 16;
  if (bar === 0 && tr.style.pad > 0) bgPadAt(tr, t, ph.pads[sp >= 16 ? 1 : 0]);
  const pat = (ph.sec === 'B' ? tr.style.percB : tr.style.percA) || {};
  for (const name in pat) {
    const ch = pat[name].charAt(bar);
    if (ch === 'X') bgPlay(tr, t, name, 0, 1);
    else if (ch === 'x') bgPlay(tr, t, name, 0, 0.75);
    else if (ch === 'o') bgPlay(tr, t, name, 0, 0.45);
  }
  if (tr.style.woodEvery && t >= tr.nextWood) {
    const w = tr.style.woodEvery;
    bgPlay(tr, t, 'wood', 0, 0.6);
    tr.nextWood = t + w[0] + (w[1] - w[0]) * tr.rng();
  }
  const list = ph.byStep[sp];
  if (list) {
    list.forEach(function (ev) {
      bgPlay(tr, t, ev.inst, ev.midi, ev.v, ev.n * tr.stepSec * (ev.inst === 'guz' ? 1.6 : 1));
    });
  }
}

function bgNewTrack(scene, now, fade) {
  BG.seq++;
  const gain = AU.ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(BG_TRACK_GAIN, now + fade);
  gain.connect(AU.buses.music);
  const tr = {
    scene: scene, gain: gain, rng: bgRng(918273 + BG.seq * 7919), style: null, tonic: 62, motifs: null,
    phrase: null, pi: 0, step: 0, stepSec: 0.2, nextT: now + 0.05, out: false, done: false, fadeEnd: 0,
    endT: 0, pad: null, nextWood: now + 3, stinger: false, score: null, len: 0
  };
  if (scene === 'win' || scene === 'lose') {
    const sc = bgStingerScore(scene);
    tr.stinger = true;
    tr.score = sc.score;
    tr.len = sc.len;
    tr.stepSec = sc.stepSec;
  } else {
    tr.style = bgStyleFor(scene);
    tr.stepSec = 60 / tr.style.bpm / 4;
    if (tr.style.stream > 0) bgStartLoop(tr, 'stream', tr.style.stream, now);
  }
  return tr;
}

// 淡出:從目前音量線性降到 0;循環音在淡出結束時停止
function bgFadeOut(tr, now, sec) {
  const g = tr.gain.gain;
  const cur = typeof g.value === 'number' ? g.value : 0;
  try {
    g.cancelScheduledValues(now);
    g.setValueAtTime(cur, now);
    g.linearRampToValueAtTime(0, now + sec);
  } catch (e) {
    g.value = 0;
  }
  tr.out = true;
  tr.fadeEnd = now + sec + 0.05;
  BG.live.forEach(function (e) {
    if (e.tr === tr && e.end === Infinity) {
      e.end = tr.fadeEnd;
      try { e.src.stop(tr.fadeEnd); } catch (err) { /* 已停止 */ }
    }
  });
}

function bgPrune(now) {
  BG.tracks = BG.tracks.filter(function (tr) {
    const dead = (tr.out && now > tr.fadeEnd) || (tr.done && now > tr.endT + 0.3);
    if (dead) {
      try { tr.gain.disconnect(); } catch (e) { /* 已斷開 */ }
    }
    return !dead;
  });
  BG.live = BG.live.filter(function (e) { return e.end > now - 0.5; });
}

function bgHalt(now) {
  BG.tracks.forEach(function (tr) {
    if (!tr.out) bgFadeOut(tr, now, 0.3);
  });
  BG.cur = null;
  BG.running = false;
  BG.scene = null;
  BG.pending = null;
}

function bgQueueScene(scene) {
  (BG_SCENE_INST[scene] || []).forEach(function (inst) {
    bgKeysOf(inst).forEach(function (k) {
      if (!BG.bufs[k] && !BG.queued[k]) {
        BG.queued[k] = true;
        BG.queue.unshift(k);
      }
    });
  });
}

function bgKeysOf(inst) {
  const out = [];
  if (inst === 'guz') {
    for (let m = 60; m < 72; m++) { out.push('guz:s:' + m); out.push('guz:h:' + m); }
  } else if (inst === 'flute' || inst === 'erhu' || inst === 'pipa') {
    for (let m = 60; m < 72; m++) out.push(inst + ':' + m);
  } else if (inst === 'horn') {
    out.push('horn:62');
  } else {
    out.push(inst);
  }
  return out;
}

// 預渲染佇列:每個 tick 最多用 ms 毫秒,避免一次渲染造成卡頓
function bgWarm(ms) {
  const t0 = auNow();
  while (BG.queue.length && auNow() - t0 < ms / 1000) {
    const k = BG.queue.shift();
    BG.queued[k] = false;
    if (!BG.bufs[k]) bgBuf(k);
  }
}

// 切換場景:舊場景淡出、新場景淡入;同時最多 2 條音樂(淡出中的先硬停)
function bgSwitch(scene, fade, now) {
  if (!bgIsScene(scene) && scene !== 'win' && scene !== 'lose') return;
  BG.tracks.forEach(function (t) {
    if (t.out) bgFadeOut(t, now, BG_FADE_OUT_QUICK);
  });
  if (BG.cur && !BG.cur.out) bgFadeOut(BG.cur, now, fade);
  const tr = bgNewTrack(scene, now, fade);
  BG.tracks.push(tr);
  BG.cur = tr;
  BG.scene = scene;
  BG.sceneStart = now;
  BG.pending = null;
  if (scene === 'win' || scene === 'lose') {
    BG.resultSeen = bgCurBattle();
    BG.stingerEnd = now + tr.len * tr.stepSec;
  }
  bgQueueScene(scene);
}

// 目標場景 → 是否切換(去抖動 1.2 s、最短停留 8 s;進戰鬥與結算硬切 0.6 s)
function bgRequest(want, now) {
  if (want === BG.scene) {
    BG.pending = null;
    return;
  }
  if (!BG.scene) { bgSwitch(want, BG_FADE_HARD, now); return; }
  if (want === 'win' || want === 'lose' || want === 'battle') { bgSwitch(want, BG_FADE_HARD, now); return; }
  if ((BG.scene === 'win' || BG.scene === 'lose') && now < BG.stingerEnd) return;
  if (!BG.pending || BG.pending.scene !== want) {
    BG.pending = { scene: want, since: now };
    return;
  }
  if (now - BG.pending.since < BG_DEBOUNCE) return;
  if (now - BG.sceneStart < BG_MIN_DWELL) return;
  bgSwitch(want, BG_FADE, now);
}

function bgSceneFor(mode, phase, sandbox) {
  if (mode === 'estate' || mode === 'visit') return 'estate_day';
  if (mode === 'battleDesign') return 'design';
  if (mode === 'attack') {
    if (phase === 'scout') return 'scout';
    if (phase === 'march') return 'battle';
    if (sandbox) return 'battle';
    return null;
  }
  if (mode === 'replay') return 'battle';
  if (mode === 'fishing') return 'fishing';
  return null;
}

function bgStarsOf(b) {
  if (b && b.result && typeof b.result.stars === 'number') return b.result.stars | 0;
  if (b && typeof mioStarsOf === 'function') return mioStarsOf(b) | 0;
  return 0;
}

function bgCurBattle() {
  return typeof battle !== 'undefined' ? battle : null;
}

function bgSandbox() {
  return typeof document !== 'undefined' && !!document.body && !!document.body.classList &&
    document.body.classList.contains('sandbox');
}

// 依遊戲狀態決定目標場景;戰鬥結束時先播結算短曲,之後回到 returnScene
function bgDesired() {
  if (BG.forced) return BG.forced;
  if (typeof game !== 'object' || !game) return null;
  const b = bgCurBattle();
  if (b && game.mode !== 'replay' && (b.over || game.phase === 'result')) {
    if (BG.resultSeen !== b) return bgStarsOf(b) >= 1 ? 'win' : 'lose';
    return BG.returnScene;
  }
  const s = bgSceneFor(game.mode, game.phase, bgSandbox());
  if (s === 'estate_day' || s === 'design' || s === 'fishing') BG.returnScene = s;
  return s;
}

function bgNow() {
  if (AU.ctx && typeof AU.ctx.currentTime === 'number') return AU.ctx.currentTime;
  return auNow();
}

function bgAudioReady() {
  return typeof AU === 'object' && !!AU && !!AU.ready && !!AU.ctx && !!AU.master && !!AU.buses && !!AU.buses.music;
}

function bgMusicOn() {
  if (!BG.enabled || typeof auCfg !== 'function') return false;
  const cfg = auCfg();
  return !!(cfg && cfg.music && cfg.music.on);
}

function bgSetPollMs(ms) {
  if (BG.pollTimer && BG.pollMs === ms) return;
  if (BG.pollTimer) clearInterval(BG.pollTimer);
  BG.pollTimer = setInterval(bgmPoll, ms);
  BG.pollMs = ms;
}

function bgmPoll() {
  if (!BG.want) return;
  if (!bgAudioReady()) {
    bgSetPollMs(BG_WAIT_MS);
    return;
  }
  bgSetPollMs(BG_POLL_MS);
  const now = bgNow();
  if (!bgMusicOn()) {
    if (BG.running) bgHalt(now);
    return;
  }
  BG.running = true;
  const want = bgDesired();
  if (want) bgRequest(want, now);
}

// 排程:每 100 ms 把 0.25 s 內的格子排進 AudioContext 時間軸
function bgmTick() {
  if (!BG.want || !bgAudioReady()) return;
  const now = bgNow();
  bgPrune(now);
  bgWarm(BG_WARM_MS);
  if (!BG.running) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  BG.tracks.forEach(function (tr) {
    if (tr.out || tr.done) return;
    if (tr.nextT < now) tr.nextT = now + 0.02;
    let guard = 0;
    while (tr.nextT < now + BG_LOOK && !tr.done && guard < 64) {
      bgStep(tr, tr.nextT);
      tr.nextT += tr.stepSec;
      tr.step++;
      guard++;
    }
  });
}

function bgmStart() {
  BG.want = true;
  if (!BG.schedTimer && typeof setInterval === 'function') BG.schedTimer = setInterval(bgmTick, BG_TICK_MS);
  bgSetPollMs(BG_WAIT_MS);
  bgmPoll();
}

function bgmStop() {
  BG.want = false;
  if (BG.tracks.length && bgAudioReady()) bgHalt(bgNow());
  BG.running = false;
  BG.scene = null;
  BG.pending = null;
  if (BG.pollTimer) clearInterval(BG.pollTimer);
  if (BG.schedTimer) clearInterval(BG.schedTimer);
  BG.pollTimer = null;
  BG.schedTimer = null;
  BG.pollMs = 0;
}

// 手動指定場景(測試 / 試聽);傳 null 回到自動判定
function bgmSetScene(name) {
  if (!name) {
    BG.forced = null;
    BG.pending = null;
    return;
  }
  if (!bgIsScene(name) && name !== 'win' && name !== 'lose') return;
  BG.forced = name;
  if (bgAudioReady() && bgMusicOn() && name !== BG.scene) {
    BG.running = true;
    bgSwitch(name, BG_FADE, bgNow());
  }
}

function bgmScene() {
  return BG.scene;
}

// 面板或其他模組要求暫停程序化 BGM(例:自訂音樂替換模式)
function bgmSetEnabled(on) {
  BG.enabled = !!on;
  if (!BG.enabled && BG.running && bgAudioReady()) bgHalt(bgNow());
}

function bgmStats() {
  const now = bgNow();
  let lead = 0;
  BG.tracks.forEach(function (tr) {
    if (!tr.out && !tr.done) lead = Math.max(lead, tr.nextT - now);
  });
  return {
    scene: BG.scene,
    running: BG.running,
    forced: BG.forced,
    tracks: BG.tracks.length,
    voices: bgVoices(now),
    peakVoices: BG.stats.peak,
    lead: lead,
    played: Object.assign({}, BG.stats.played),
    dropped: Object.assign({}, BG.stats.dropped),
    warmLeft: BG.queue.length,
    buffers: Object.keys(BG.bufs).length
  };
}

// 載入即啟動等待:音訊解鎖(第一次觸控)後,輪詢會自動開始播放
bgmStart();
