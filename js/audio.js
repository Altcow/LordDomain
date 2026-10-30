// audio.js — 音訊引擎 AU0(PLAN_AUDIO §4、§8、§10.3)。
// AudioContext 與 ui.js 的 audioCtx 共用(不另建第二個);合成音在解鎖時以 JS 直接算成 PCM 快取為 AudioBuffer。
// 外部只用 AU、auPlay、auSetVol、auSetMute、auQuiet;所有呼叫端請以 typeof 守門。

const AU_SR = 22050;
const AU_MAX_VOICES = 16;

const AU = {
  ctx: null,
  master: null,
  buses: {},
  buffers: {},
  voices: [],
  last: {},
  grpLast: {},
  ready: false,
  maxVoices: AU_MAX_VOICES,
  lastClick: -1,
  stats: { req: {}, played: {}, dropped: {}, peakVoices: 0, since: 0 }
};

function auNow() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now() / 1000;
  return Date.now() / 1000;
}

function auCfg() {
  return typeof settingsGet === 'function' ? settingsGet() : AUDIO_SETTINGS_DEFAULT;
}

function auClamp(v, lo, hi) {
  v = Number(v);
  if (!(v >= lo)) return lo;
  return v > hi ? hi : v;
}

function auDrop(id) {
  AU.stats.dropped[id] = (AU.stats.dropped[id] || 0) + 1;
  return false;
}

function auSetParam(param, v, ctx) {
  try {
    param.setTargetAtTime(v, ctx.currentTime, 0.02);
  } catch (e) {
    param.value = v;
  }
}

function auApplyGains() {
  if (!AU.buses.sfx || !AU.ctx) return;
  const cfg = auCfg();
  const c = AU.ctx;
  const quietMul = cfg.quiet ? 0.3 : 1;
  auSetParam(AU.buses.music.gain, cfg.music.on ? cfg.music.vol * quietMul : 0, c);
  auSetParam(AU.buses.sfx.gain, cfg.sfx.on ? cfg.sfx.vol : 0, c);
  auSetParam(AU.buses.amb.gain, (cfg.amb.on && !cfg.quiet) ? cfg.amb.vol : 0, c);
}

// §8:跟隨靜音鍵 → 'ambient';否則 'playback'(特性偵測,不支援就略過)
function auApplyAudioSession() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      navigator.audioSession.type = auCfg().followSilent ? 'ambient' : 'playback';
    }
  } catch (e) {
    console.warn('[au] audioSession unavailable', e);
  }
}

function auBuildGraph() {
  const c = AU.ctx;
  const comp = c.createDynamicsCompressor();
  AU.master = c.createGain();
  AU.master.connect(comp);
  comp.connect(c.destination);
  ['music', 'sfx', 'amb'].forEach(function (name) {
    const g = c.createGain();
    g.connect(AU.master);
    AU.buses[name] = g;
  });
  auApplyGains();
  auApplyAudioSession();
}

function auRenderLayer(out, L) {
  const n = Math.floor(L.d * AU_SR);
  const s0 = Math.floor((L.t || 0) * AU_SR);
  const f0 = L.f0 || 0;
  const f1 = L.f1 != null ? L.f1 : f0;
  const tau = L.tau || L.d;
  const k = L.lp ? 1 - Math.exp(-2 * Math.PI * L.lp / AU_SR) : 1;
  let ph = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    const idx = s0 + i;
    if (idx >= out.length) break;
    const t = i / AU_SR;
    const env = Math.min(1, t / 0.003) * Math.exp(-t / tau) * Math.min(1, (L.d - t) / 0.005);
    let v;
    if (L.w === 'noise') {
      y += k * ((Math.random() * 2 - 1) - y);
      v = y;
    } else {
      const f = n > 1 && f0 > 0 ? f0 * Math.pow(f1 / f0, i / n) : f0;
      ph += 2 * Math.PI * f / AU_SR;
      if (L.w === 'square') v = Math.sin(ph) >= 0 ? 1 : -1;
      else if (L.w === 'tri') v = 2 / Math.PI * Math.asin(Math.sin(ph));
      else v = Math.sin(ph);
    }
    out[idx] += (L.a || 0) * env * v;
  }
}

// 把一組配方算成單聲道 PCM(純 JS,不需要 OfflineAudioContext)
function auRenderRecipe(layers) {
  let len = 0;
  layers.forEach(function (L) { len = Math.max(len, (L.t || 0) + L.d); });
  const out = new Float32Array(Math.ceil(len * AU_SR) + 1);
  layers.forEach(function (L) { auRenderLayer(out, L); });
  for (let i = 0; i < out.length; i++) out[i] = auClamp(out[i], -0.95, 0.95);
  return out;
}

function auBuildBuffers() {
  const c = AU.ctx;
  for (const id in AUDIO_DEFS) {
    const def = AUDIO_DEFS[id];
    const layers = AUDIO_SYNTH[def.recipe];
    if (!layers) continue;
    const pcm = auRenderRecipe(layers);
    const buf = c.createBuffer(1, pcm.length, AU_SR);
    buf.getChannelData(0).set(pcm);
    AU.buffers[id] = buf;
  }
  AU.ready = true;
}

// 手勢內呼叫;回傳 AudioContext 或 null。第一次成功時建圖與預渲染。
AU.unlock = function () {
  try {
    if (!AU.ctx) {
      if (typeof audioCtx !== 'undefined' && audioCtx) {
        AU.ctx = audioCtx;
      } else {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        AU.ctx = new AC();
        if (typeof audioCtx !== 'undefined') audioCtx = AU.ctx;
      }
    }
    if (!AU.master) auBuildGraph();
    if (AU.ctx.state !== 'running' && AU.ctx.resume) {
      const p = AU.ctx.resume();
      if (p && p.catch) p.catch(function (e) { console.warn('[au] resume failed', e); });
    }
    if (!AU.ready) auBuildBuffers();
    return AU.ctx;
  } catch (e) {
    console.warn('[au] unlock failed', e);
    return null;
  }
};

AU.applySettings = function () {
  auApplyGains();
  auApplyAudioSession();
};

// 錄影分流(recorder.js 用):在 master 之後多接一條 MediaStreamDestination,不影響既有播放路徑。
AU.recTap = null;
AU.recordTap = function () {
  if (!AU.ctx || !AU.master || !AU.ctx.createMediaStreamDestination) return null;
  try {
    if (AU.recTap) AU.recordUntap();
    const dest = AU.ctx.createMediaStreamDestination();
    AU.master.connect(dest);
    AU.recTap = dest;
    return dest.stream;
  } catch (e) {
    console.warn('[au] recordTap failed', e);
    return null;
  }
};

AU.recordUntap = function () {
  if (!AU.recTap) return;
  try { AU.master.disconnect(AU.recTap); } catch (e) { /* 已斷開 */ }
  AU.recTap = null;
};

function auSteal(v) {
  try { v.src.stop(); } catch (e) { /* 已停止 */ }
  AU.voices = AU.voices.filter(function (x) { return x !== v; });
}

// 頻率控制器(§4.3):冷卻 → 同 id 上限 → 全域上限;P0/P1 可偷聲,P2/P3 直接丟。
function auSfx(name, opt) {
  opt = opt || {};
  const id = AUDIO_ALIAS[name] || name;
  AU.stats.req[id] = (AU.stats.req[id] || 0) + 1;
  try {
    const def = AUDIO_DEFS[id];
    if (!def) return auDrop(id);
    if (!AU.ctx || !AU.master || !AU.buffers[id]) return auDrop(id);
    const cfg = auCfg();
    if (!cfg.sfx.on) return auDrop(id);
    if (cfg.quiet && def.cat !== 'ui' && def.pri > 0) return auDrop(id);

    const now = auNow();
    const jitter = 1 + (def.jit / 100) * (2 * Math.random() - 1);
    if (AU.last[id] !== undefined && now - AU.last[id] < def.gap * jitter) return auDrop(id);
    const grp = def.grp;
    if (grp && AUDIO_GROUP_GAP[grp] && AU.grpLast[grp] !== undefined && now - AU.grpLast[grp] < AUDIO_GROUP_GAP[grp]) {
      return auDrop(id);
    }

    AU.voices = AU.voices.filter(function (v) { return v.end > now; });
    let maxN = def.maxN || 1;
    if (def.dens) maxN = Math.max(1, Math.round(maxN * (AUDIO_DENSITY_MUL[cfg.density] || 1)));
    const same = AU.voices.filter(function (v) { return v.id === id; });
    if (same.length >= maxN) {
      if (def.pri > 1) return auDrop(id);
      auSteal(same[0]);
    }
    if (AU.voices.length >= AU.maxVoices) {
      if (def.pri > 1) return auDrop(id);
      const victim = AU.voices.find(function (v) { return v.pri > 1; });
      if (!victim) return auDrop(id);
      auSteal(victim);
    }

    const c = AU.ctx;
    const rate = 1 + (Math.random() * 2 - 1) * 0.04;
    const src = c.createBufferSource();
    src.buffer = AU.buffers[id];
    src.playbackRate.value = rate;
    const g = c.createGain();
    const db = (Math.random() * 2 - 1) * 2;
    g.gain.value = def.gain * (opt.gain == null ? 1 : opt.gain) * Math.pow(10, db / 20);
    src.connect(g);
    g.connect(AU.buses[def.bus || 'sfx']);
    src.start(0);

    const dur = AU.buffers[id].duration / rate + 0.02;
    AU.voices.push({ id: id, pri: def.pri, end: now + dur, src: src });
    AU.last[id] = now;
    if (grp) AU.grpLast[grp] = now;
    AU.stats.played[id] = (AU.stats.played[id] || 0) + 1;
    AU.stats.peakVoices = Math.max(AU.stats.peakVoices, AU.voices.length);
    return true;
  } catch (e) {
    console.warn('[au] play failed', e);
    return auDrop(id);
  }
}

AU.sfx = auSfx;

function auPlay(name, opts) {
  return auSfx(name, opts);
}

const AU_BUS_NAMES = ['music', 'sfx', 'amb'];

function auSetVol(bus, v) {
  if (AU_BUS_NAMES.indexOf(bus) < 0 || typeof settingsSet !== 'function') return;
  settingsSet(bus + '.vol', auClamp(v, 0, 1));
}

// on = true 代表靜音此匯流排(寫入 bus.on = false)
function auSetMute(bus, on) {
  if (AU_BUS_NAMES.indexOf(bus) < 0 || typeof settingsSet !== 'function') return;
  settingsSet(bus + '.on', !on);
}

function auQuiet(on) {
  if (typeof settingsSet !== 'function') return;
  settingsSet('quiet', !!on);
}

// 點擊按鈕的輕量音:只限 #toolbar / #topbar 的直接子按鈕,20 ms 內去重
function auOnClick(e) {
  let el = e.target;
  let hit = false;
  for (let i = 0; el && i < 4; i++, el = el.parentNode) {
    if (el.tagName === 'BUTTON' && el.parentNode && (el.parentNode.id === 'toolbar' || el.parentNode.id === 'topbar')) {
      hit = true;
      break;
    }
  }
  if (!hit) return;
  const now = auNow();
  if (now - AU.lastClick < 0.02) return;
  AU.lastClick = now;
  auSfx('click');
}

function auOnGesture() {
  AU.unlock();
}

// 切到背景:主增益淡出後 suspend;回前景 resume。被系統 interrupted 時等下一次手勢再 resume(見 AU.unlock)。
function auOnVisibility() {
  if (!AU.ctx || !AU.master) return;
  try {
    if (document.hidden) {
      auSetParam(AU.master.gain, 0, AU.ctx);
      setTimeout(function () {
        if (document.hidden && AU.ctx && AU.ctx.suspend) {
          const p = AU.ctx.suspend();
          if (p && p.catch) p.catch(function (e) { console.warn('[au] suspend failed', e); });
        }
      }, 250);
    } else {
      AU.unlock();
      auSetParam(AU.master.gain, 1, AU.ctx);
    }
  } catch (e) {
    console.warn('[au] visibility failed', e);
  }
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('pointerdown', auOnGesture, true);
  document.addEventListener('click', auOnClick, false);
  document.addEventListener('visibilitychange', auOnVisibility, false);
}
