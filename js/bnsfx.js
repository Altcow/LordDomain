// js/bnsfx.js — 戰鬥 A 模式音效(B5;PLAN_BATTLE_A §B5、PLAN_AUDIO §4.3 / §5)。全程式合成,零音檔。
// 播放端:bndraw.js 的 bnPlSfx → bnSfxPlay(kind);結算 bnui.js → bnSfxEnd(winner);開戰 / 離場 bnPlNew / bnPlDispose → bnSfxBattle(on)。
// 只在 AU.ctx 已由使用者手勢解鎖後才發聲(本檔絕不建立 AudioContext);設定頁「音效」關閉、音量 0 時完全不碰 AudioContext。
// 安靜模式只留 P0(大招 / 勝負 / 開戰鼓)與介面音。合成在開戰時一次預渲染(audio.js auCached → audiocache.js IndexedDB 快取),之後播放 = AudioBufferSource。
// 同時發聲:本檔自己最多 BNSFX.max 聲(密度少 4 / 標準 6 / 多 8),並登記進 AU.voices 共用全域 16 聲上限;同種最短間隔 gap(實際秒,倍速不加密)。
// 戰鬥音樂:bgm.js 支援場景切換 → 開戰 bgmSetScene('battle'),結算改播 bgm 的勝 / 負短曲(此時不另播音效短旋律),離場 bgmSetScene(null) 回自動。
// 全域:BNSFX BNSFX_KINDS BNSFX_REC bnSfxPlay bnSfxWarm bnSfxBattle bnSfxEnd bnSfxStats。ES2017;不用 ?. ??。

var BNSFX_SR = 22050;
var BNSFX = { built: {}, bufs: {}, voices: [], last: {}, max: 6, muted: false, bgmOwn: false, stats: { req: {}, played: {}, dropped: {}, peak: 0 } };

// pri 0 最高(可偷低優先聲部);gap 同種最短間隔(秒);conc 同種同時上限;gain 基準增益
var BNSFX_KINDS = {
  atk_blade: { pri: 2, gap: 0.1, conc: 2, gain: 0.45 }, atk_spear: { pri: 2, gap: 0.1, conc: 2, gain: 0.45 }, atk_cav: { pri: 2, gap: 0.12, conc: 2, gain: 0.5 },
  atk_bow: { pri: 2, gap: 0.1, conc: 2, gain: 0.45 }, atk_strat: { pri: 2, gap: 0.12, conc: 2, gain: 0.4 },
  hit: { pri: 2, gap: 0.08, conc: 2, gain: 0.5 }, crit: { pri: 1, gap: 0.15, conc: 1, gain: 0.6 }, block: { pri: 2, gap: 0.12, conc: 1, gain: 0.4 }, evade: { pri: 2, gap: 0.15, conc: 1, gain: 0.35 },
  heal: { pri: 1, gap: 0.2, conc: 1, gain: 0.4 }, shield: { pri: 1, gap: 0.2, conc: 1, gain: 0.4 }, buff: { pri: 2, gap: 0.15, conc: 1, gain: 0.35 }, debuff: { pri: 2, gap: 0.15, conc: 1, gain: 0.35 },
  kill: { pri: 1, gap: 0.2, conc: 2, gain: 0.55 }, ult: { pri: 0, gap: 0.8, conc: 1, gain: 0.6 }, drum: { pri: 0, gap: 1.0, conc: 1, gain: 0.6 },
  win: { pri: 0, gap: 3.0, conc: 1, gain: 0.55 }, lose: { pri: 0, gap: 3.0, conc: 1, gain: 0.55 }, ui: { pri: 1, gap: 0.06, conc: 1, gain: 0.3, ui: 1 }
};

// 合成配方(與 sfxwar.js 同格式):{ w: sine|tri|square|noise, t 起點, d 長度, f0/f1 頻率掃頻, a 振幅, tau 衰減, hp 高通, lp / lp1 低通起迄 }
var BNSFX_REC = {
  atk_blade: [   // 刀:揮砍風聲 + 金屬短鳴
    { w: 'noise', t: 0, d: 0.14, a: 0.3, tau: 0.06, hp: 1500, lp: 6500, lp1: 2000 },
    { w: 'sine', t: 0.08, d: 0.12, f0: 2300, f1: 1800, a: 0.14, tau: 0.035 },
    { w: 'noise', t: 0.08, d: 0.03, a: 0.2, tau: 0.008, hp: 3000, lp: 9000 }
  ],
  atk_spear: [   // 槍:突刺尖銳氣聲
    { w: 'noise', t: 0, d: 0.1, a: 0.28, tau: 0.04, hp: 2500, lp: 9000, lp1: 3500 },
    { w: 'sine', t: 0.05, d: 0.07, f0: 1700, f1: 1300, a: 0.12, tau: 0.02 }
  ],
  atk_cav: [   // 騎:兩下馬蹄 + 揮擊
    { w: 'sine', t: 0, d: 0.12, f0: 95, f1: 55, a: 0.42, tau: 0.045 },
    { w: 'noise', t: 0, d: 0.05, a: 0.18, tau: 0.012, hp: 900, lp: 2500 },
    { w: 'sine', t: 0.11, d: 0.12, f0: 95, f1: 55, a: 0.38, tau: 0.045 },
    { w: 'noise', t: 0.11, d: 0.05, a: 0.18, tau: 0.012, hp: 900, lp: 2500 },
    { w: 'noise', t: 0.16, d: 0.12, a: 0.22, tau: 0.05, hp: 1600, lp: 5000, lp1: 2000 }
  ],
  atk_bow: [   // 弓:弓弦 + 箭咻
    { w: 'sine', t: 0, d: 0.12, f0: 190, f1: 120, a: 0.32, tau: 0.04 },
    { w: 'tri', t: 0, d: 0.08, f0: 380, f1: 260, a: 0.1, tau: 0.03 },
    { w: 'noise', t: 0.03, d: 0.22, a: 0.18, tau: 0.09, hp: 3000, lp: 8000, lp1: 3500 }
  ],
  atk_strat: [   // 謀略:上揚的法術光
    { w: 'sine', t: 0, d: 0.3, f0: 660, f1: 1320, a: 0.16, tau: 0.14 },
    { w: 'sine', t: 0.04, d: 0.26, f0: 990, f1: 1980, a: 0.07, tau: 0.12 },
    { w: 'noise', t: 0, d: 0.25, a: 0.06, tau: 0.1, hp: 4000, lp: 9000 }
  ],
  hit: [   // 命中:悶擊
    { w: 'sine', t: 0, d: 0.12, f0: 170, f1: 70, a: 0.45, tau: 0.04 },
    { w: 'noise', t: 0, d: 0.06, a: 0.25, tau: 0.015, lp: 1400 }
  ],
  crit: [   // 暴擊:重擊 + 爆裂 + 金屬亮音
    { w: 'sine', t: 0, d: 0.26, f0: 130, f1: 45, a: 0.6, tau: 0.08 },
    { w: 'noise', t: 0, d: 0.06, a: 0.4, tau: 0.012, hp: 2000, lp: 8000 },
    { w: 'sine', t: 0.01, d: 0.14, f0: 2600, f1: 1800, a: 0.12, tau: 0.045 },
    { w: 'noise', t: 0.02, d: 0.2, a: 0.18, tau: 0.07, lp: 900 }
  ],
  block: [   // 護盾吸收:鏗
    { w: 'sine', t: 0, d: 0.14, f0: 950, f1: 720, a: 0.25, tau: 0.04 },
    { w: 'noise', t: 0, d: 0.04, a: 0.2, tau: 0.01, hp: 2500, lp: 7000 }
  ],
  evade: [   // 閃避:快速上掃風聲
    { w: 'noise', t: 0, d: 0.18, a: 0.24, tau: 0.08, hp: 800, lp: 2500, lp1: 7500 }
  ],
  heal: [   // 治療:五聲音階雙音鈴(徵 → 宮)
    { w: 'sine', t: 0, d: 0.35, f0: 784, a: 0.2, tau: 0.14 },
    { w: 'sine', t: 0.08, d: 0.42, f0: 1046.5, a: 0.18, tau: 0.18 },
    { w: 'sine', t: 0.08, d: 0.3, f0: 2093, a: 0.04, tau: 0.1 }
  ],
  shield: [   // 護盾:金屬共鳴 + 微光
    { w: 'sine', t: 0, d: 0.42, f0: 523.25, a: 0.16, tau: 0.2 },
    { w: 'sine', t: 0, d: 0.3, f0: 1308, a: 0.08, tau: 0.12 },
    { w: 'noise', t: 0, d: 0.25, a: 0.05, tau: 0.1, hp: 3000, lp: 8000, lp1: 3000 }
  ],
  buff: [   // 增益:短上行
    { w: 'tri', t: 0, d: 0.1, f0: 523.25, f1: 587.3, a: 0.14, tau: 0.06 },
    { w: 'tri', t: 0.07, d: 0.2, f0: 784, a: 0.14, tau: 0.09 }
  ],
  debuff: [   // 減益:下滑
    { w: 'tri', t: 0, d: 0.26, f0: 440, f1: 311, a: 0.15, tau: 0.12 },
    { w: 'sine', t: 0, d: 0.3, f0: 220, f1: 155, a: 0.12, tau: 0.13 }
  ],
  kill: [   // 擊倒:倒地悶響
    { w: 'sine', t: 0, d: 0.4, f0: 110, f1: 40, a: 0.5, tau: 0.13 },
    { w: 'noise', t: 0.03, d: 0.3, a: 0.25, tau: 0.09, lp: 500 },
    { w: 'noise', t: 0.18, d: 0.06, a: 0.12, tau: 0.02, hp: 1200, lp: 3000 }
  ],
  ult: [   // 大招:鑼 + 低音膨脹
    { w: 'sine', t: 0, d: 1.2, f0: 196, f1: 205, a: 0.3, tau: 0.5 },
    { w: 'sine', t: 0, d: 1.0, f0: 290, a: 0.14, tau: 0.4 },
    { w: 'sine', t: 0, d: 0.8, f0: 378, a: 0.1, tau: 0.3 },
    { w: 'sine', t: 0, d: 0.6, f0: 496, a: 0.06, tau: 0.2 },
    { w: 'noise', t: 0, d: 0.5, a: 0.1, tau: 0.2, hp: 1500, lp: 5000, lp1: 1000 },
    { w: 'sine', t: 0, d: 1.0, f0: 98, a: 0.25, tau: 0.5 }
  ],
  drum: [   // 開戰鼓:兩通
    { w: 'sine', t: 0, d: 0.35, f0: 120, f1: 50, a: 0.8, tau: 0.12 },
    { w: 'noise', t: 0, d: 0.2, a: 0.12, tau: 0.03, lp: 300 },
    { w: 'sine', t: 0.24, d: 0.4, f0: 120, f1: 50, a: 0.75, tau: 0.13 },
    { w: 'noise', t: 0.24, d: 0.2, a: 0.12, tau: 0.03, lp: 300 }
  ],
  win: [   // 勝利:五聲音階上行(徵 羽 宮 商 徵)+ 鼓
    { w: 'tri', t: 0.00, d: 0.22, f0: 392, a: 0.22, tau: 0.12 },
    { w: 'tri', t: 0.14, d: 0.22, f0: 440, a: 0.22, tau: 0.12 },
    { w: 'tri', t: 0.28, d: 0.22, f0: 523.25, a: 0.22, tau: 0.12 },
    { w: 'tri', t: 0.42, d: 0.22, f0: 587.3, a: 0.22, tau: 0.12 },
    { w: 'tri', t: 0.56, d: 0.8, f0: 784, a: 0.26, tau: 0.4 },
    { w: 'sine', t: 0.56, d: 0.8, f0: 1568, a: 0.04, tau: 0.3 },
    { w: 'sine', t: 0.00, d: 0.35, f0: 110, f1: 55, a: 0.4, tau: 0.12 },
    { w: 'sine', t: 0.56, d: 0.45, f0: 110, f1: 50, a: 0.45, tau: 0.15 }
  ],
  lose: [   // 敗北:緩慢下行(羽 徵 角 商)+ 低鼓
    { w: 'tri', t: 0.00, d: 0.4, f0: 440, a: 0.18, tau: 0.22 },
    { w: 'tri', t: 0.3, d: 0.4, f0: 392, a: 0.17, tau: 0.22 },
    { w: 'tri', t: 0.6, d: 0.4, f0: 329.6, a: 0.16, tau: 0.22 },
    { w: 'tri', t: 0.9, d: 0.8, f0: 293.7, f1: 285, a: 0.17, tau: 0.4 },
    { w: 'sine', t: 0.9, d: 0.6, f0: 80, f1: 42, a: 0.4, tau: 0.2 }
  ],
  ui: [   // 介面點擊
    { w: 'sine', t: 0, d: 0.035, f0: 1250, f1: 900, a: 0.22, tau: 0.012 }
  ]
};

function bnSfxNow() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now() / 1000;
  return Date.now() / 1000;
}
function bnSfxDrop(k) { BNSFX.stats.dropped[k] = (BNSFX.stats.dropped[k] || 0) + 1; return false; }
// 讀設定:音效開關、音量、安靜、密度(缺設定模組 = 預設開)
function bnSfxCfg() {
  var s = typeof settingsGet === 'function' ? settingsGet() : null, sf = s && s.sfx ? s.sfx : null;
  return { on: !sf || sf.on !== false, vol: sf && typeof sf.vol === 'number' ? sf.vol : 1, quiet: !!(s && s.quiet), density: s && s.density ? s.density : 'normal' };
}
function bnSfxAudioOk() { return typeof AU === 'object' && !!AU && !!AU.ctx && !!AU.master && !!AU.buses && !!AU.buses.sfx && typeof AU.ctx.createBuffer === 'function'; }
function bnSfxRender(layers) {
  if (typeof sfxwRenderRec === 'function') return sfxwRenderRec(layers);
  if (typeof auRenderRecipe === 'function') return auRenderRecipe(layers);
  return null;
}
// 建一個種類的 AudioBuffer(有 audiocache 就走 IndexedDB 快取)
function bnSfxBuild(k) {
  var rec = BNSFX_REC[k], pcm, buf;
  if (BNSFX.bufs[k]) return BNSFX.bufs[k];
  if (!rec || BNSFX.built[k] === false || !bnSfxAudioOk()) return null;
  try {
    pcm = typeof auCached === 'function' ? auCached('bn:' + k, BNSFX_SR, function () { return bnSfxRender(rec); }, JSON.stringify(rec)) : bnSfxRender(rec);
    if (!pcm || !pcm.length) { BNSFX.built[k] = false; return null; }
    buf = AU.ctx.createBuffer(1, pcm.length, BNSFX_SR);
    buf.getChannelData(0).set(pcm);
    BNSFX.bufs[k] = buf; BNSFX.built[k] = true;
    return buf;
  } catch (e) {
    BNSFX.built[k] = false;
    console.warn('[bnsfx] build failed', k, e);
    return null;
  }
}
// 預先合成全部(開戰時;音效關閉或未解鎖時不做)
function bnSfxWarm() {
  var k, n = 0;
  if (!bnSfxCfg().on || !bnSfxAudioOk()) return 0;
  for (k in BNSFX_REC) if (bnSfxBuild(k)) n++;
  return n;
}
function bnSfxStop(v) {
  try { v.src.stop(); } catch (e) { /* 已停止 */ }
  BNSFX.voices = BNSFX.voices.filter(function (x) { return x !== v; });
  if (AU && AU.voices) AU.voices = AU.voices.filter(function (x) { return x !== v; });
}
// 播放一聲;回是否實際發聲。閘門順序:靜音 / 關閉 / 音量 0 → 安靜模式 → 未解鎖 → 同種間隔 → 同種上限 → 本檔上限(P0/P1 可偷低優先)→ 全域 16 聲
function bnSfxPlay(kind, opt) {
  var def = BNSFX_KINDS[kind], cfg, now, max, same, victim, buf, c, src, g, rate, entry;
  if (!def) return false;
  opt = opt || {};
  BNSFX.stats.req[kind] = (BNSFX.stats.req[kind] || 0) + 1;
  if (BNSFX.muted) return bnSfxDrop(kind);
  cfg = bnSfxCfg();
  if (!cfg.on || !(cfg.vol > 0)) return bnSfxDrop(kind);
  if (cfg.quiet && def.pri > 0 && !def.ui) return bnSfxDrop(kind);
  if (!bnSfxAudioOk()) return bnSfxDrop(kind);
  now = bnSfxNow();
  if (BNSFX.last[kind] !== undefined && now - BNSFX.last[kind] < def.gap) return bnSfxDrop(kind);
  BNSFX.voices = BNSFX.voices.filter(function (v) { return v.end > now; });
  if (AU.voices) AU.voices = AU.voices.filter(function (v) { return v.end > now; });
  same = BNSFX.voices.filter(function (v) { return v.k === kind; });
  if (same.length >= def.conc) {
    if (def.pri > 1) return bnSfxDrop(kind);
    bnSfxStop(same[0]);
  }
  max = cfg.density === 'low' ? 4 : (cfg.density === 'high' ? 8 : BNSFX.max);
  if (BNSFX.voices.length >= max) {
    victim = null;
    BNSFX.voices.forEach(function (v) { if (v.pri > def.pri && (!victim || v.pri > victim.pri)) victim = v; });
    if (!victim || def.pri > 1) return bnSfxDrop(kind);
    bnSfxStop(victim);
  }
  if (AU.voices && AU.voices.length >= (AU.maxVoices || 16)) {
    if (def.pri > 1) return bnSfxDrop(kind);
    victim = AU.voices.find(function (v) { return v.pri > 1; });
    if (!victim) return bnSfxDrop(kind);
    bnSfxStop(victim);
  }
  buf = bnSfxBuild(kind);
  if (!buf) return bnSfxDrop(kind);
  try {
    c = AU.ctx;
    rate = def.pri === 0 ? 1 : 1 + (Math.random() * 2 - 1) * 0.04;   // 旋律類不變調
    src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    g = c.createGain();
    g.gain.value = def.gain * (opt.gain == null ? 1 : opt.gain) * (def.pri === 0 ? 1 : Math.pow(10, (Math.random() * 2 - 1) * 1.5 / 20));
    src.connect(g);
    g.connect(AU.buses.sfx);
    src.start(0);
    entry = { id: 'bn_' + kind, k: kind, pri: def.pri, end: now + buf.duration / rate + 0.02, src: src };
    BNSFX.voices.push(entry);
    if (AU.voices) AU.voices.push(entry);
    BNSFX.last[kind] = now;
    BNSFX.stats.played[kind] = (BNSFX.stats.played[kind] || 0) + 1;
    BNSFX.stats.peak = Math.max(BNSFX.stats.peak, BNSFX.voices.length);
    return true;
  } catch (e) {
    console.warn('[bnsfx] play failed', e);
    return bnSfxDrop(kind);
  }
}
// 開戰 / 離場:預渲染 + 戰鬥音樂(別的模組已強制場景時不搶)
function bnSfxBattle(on) {
  var forced = typeof BG === 'object' && BG ? BG.forced : null;
  if (on) {
    bnSfxWarm();
    if (typeof bgmSetScene === 'function' && (!forced || BNSFX.bgmOwn)) { try { bgmSetScene('battle'); BNSFX.bgmOwn = true; } catch (e) { console.warn('[bnsfx] bgm', e); } }
  } else if (BNSFX.bgmOwn) {
    BNSFX.bgmOwn = false;
    if (typeof bgmSetScene === 'function') { try { bgmSetScene(null); } catch (e) { console.warn('[bnsfx] bgm', e); } }
  }
}
function bnSfxMusicOn() {
  var s = typeof settingsGet === 'function' ? settingsGet() : null;
  return !!(s && s.music && s.music.on && s.music.vol > 0 && typeof bgmSetScene === 'function' && (typeof BG !== 'object' || !BG || BG.enabled !== false));
}
// 結算:音樂開著 → 換 bgm 勝 / 負短曲;否則播音效短旋律。平手 = 一聲鼓
function bnSfxEnd(w) {
  var sc = w === 'A' ? 'win' : (w === 'B' ? 'lose' : '');
  if (!sc) return bnSfxPlay('drum');
  if (BNSFX.bgmOwn && bnSfxMusicOn()) { try { bgmSetScene(sc); return true; } catch (e) { console.warn('[bnsfx] bgm', e); } }
  return bnSfxPlay(sc);
}
function bnSfxStats() { return { req: BNSFX.stats.req, played: BNSFX.stats.played, dropped: BNSFX.stats.dropped, peak: BNSFX.stats.peak, voices: BNSFX.voices.length, bufs: Object.keys(BNSFX.bufs).length }; }

// 戰鬥畫面內的按鈕點擊音(#bnLayer 內的 button;與 audio.js 工具列點擊音分開)
function bnSfxOnClick(e) {
  var el = e && e.target, i, btn = false;
  for (i = 0; el && i < 8; i++, el = el.parentNode) {
    if (el.tagName === 'BUTTON') btn = true;
    if (el.id === 'bnLayer') { if (btn) bnSfxPlay('ui'); return; }
  }
}
if (typeof document !== 'undefined' && document && document.addEventListener) document.addEventListener('click', bnSfxOnClick, false);
