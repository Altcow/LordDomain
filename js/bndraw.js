// js/bndraw.js — 戰鬥 A 模式(B2)戰鬥畫面:事件播放狀態機(bnPl*)+ 畫布繪製(bnDr*)。PLAN_BATTLE_A §6.2、§6.3、§7、§9.1。
// 播放器 P 逐事件消化引擎日誌(bn_engine.js 檔頭註解):每個事件改變「視覺狀態 vu」並排程動畫(前衝 / 受擊 / 特效 / 數字),dispatcher 以 wait 秒數控制下一個事件何時處理。
// 引擎是惰性推進的:佇列空了才呼叫 bnStep(S) 取下一個行動的事件;略過 = bnRunToEnd(S) 後直接跳到終局視覺(結果與播放必然相同,引擎確定性)。
// 繪製:只用 canvas 2D;全身圖直接 drawImage(原圖 ≤ 190×390,不另做縮圖快取),受擊閃白用預烘白剪影(lazy,≤ 20 張),特效用 assets/bnfx/ 黑底圖 + 'lighter' 加色混合;
// 物件池(數字 28 / 特效 64)不在每幀配置。缺圖一律回退:名人全身 → 半身頭像 → 程式小人;兵種圖 → 程式小人(ART.chibiSprite 可用時放大)。
// 不寫 DOM(DOM 由 bnui.js 透過 P.hooks 接手)、不發聲(音效經 sfxwPlay 且有 typeof 守衛、P.sfx=false 可關)。ES2017;不用 ?. ??。
// 全域:BNPL_T BNDR bnDrImg bnDrLook bnDrLayout bnDrFrame bnDrResize bnPlNew bnPlTick bnPlSkip bnPlDispose bnPlPredict bnPlStats bnPlHitUlt bnPlSetSpeed

var BNPL_T = {
  round: 0.55, act: 0.1, cast: 0.28, lunge: 0.2, proj: 0.24, basicWait: 0.52, skillHit: 0.2, skillWait: 0.36, multi: 0.14, multiDelay: 0.06,
  dot: 0.26, heal: 0.26, healMore: 0.12, status: 0.08, txt: 0.3, end: 0.8, chain: 0.28, cutFull: 1.0, cutSmall: 0.45, killDelay: 0.05, dying: 0.45
};
var BNDR = {
  imgs: {}, tint: {}, white: {}, glow: {}, bgKey: '', bg: null, dprMax: 2, whiteMax: 20, whiteN: 0,
  stats: { frames: 0, lastMs: 0, sumMs: 0, maxMs: 0, samples: [] }
};
var BN_NUM_N = 28, BN_FX_N = 64;
var BN_ST_ICON = { atk_up: 1, atk_down: 1, def_up: 1, def_down: 1, spd_up: 1, stun: 1, burn: 1, poison: 1, bleed: 1, shield: 1, silence: 1, taunt: 1, timid: 1, confuse: 1, heal_reduce: 'heal_block', ward: 1 };
var BN_ST_NAME = {
  stun: '暈眩', fear: '威懾', confuse: '擾亂', timid: '怯戰', silence: '計窮', ult_lock: '封大', atk_down: '攻↓', def_down: '防↓', spd_down: '速↓', mark: '標記',
  burn: '燃燒', poison: '中毒', bleed: '流血', heal_reduce: '禁療', atk_up: '攻↑', def_up: '防↑', spd_up: '速↑', crit_up: '暴↑', taunt: '嘲諷', guard: '援護', evade: '規避',
  ward: '抵禦', ccimm: '抗控', shield: '護盾', heal_hot: '回春'
};
var BN_ST_GOOD = { atk_up: 1, def_up: 1, spd_up: 1, crit_up: 1, taunt: 1, guard: 1, evade: 1, ward: 1, ccimm: 1, shield: 1, heal_hot: 1, amp_atk: 1 };
var BN_TONE = { '金光': 'gold', '赤焰': 'flame', '白霜': 'frost', '青雷': 'thunder', '墨影': 'ink', '紫光': 'purple', '碧風': 'wind' };
var BN_TONE_COL = { gold: '#ffd25a', flame: '#ff6a3a', frost: '#9fe0ff', thunder: '#7aa8ff', ink: '#b9a8d8', purple: '#c78bff', wind: '#6fe6b0', common: '#ffe9a8' };
var BN_BODY_OF = { '盾': 'shield', '步': 'inf', '騎': 'cav', '弓': 'arc', '謀': 'str' };
var BN_TINTS = ['', '#3a6ea8', '#a83a3a', '#3aa86e', '#8a4aa8', '#a8883a', '#3a8aa8', '#a85a8a'];
var BN_CROWD_OF = { '盾': 'guard', '步': 'guard', '騎': 'knight', '弓': 'escort', '謀': 'scholar' };

// ───────── 圖片 ─────────
function bnDrImg(path) {
  var e = BNDR.imgs[path], im;
  if (e) return e;
  e = BNDR.imgs[path] = { img: null, ok: false, fail: false, path: path };
  if (typeof Image === 'undefined') { e.fail = true; return e; }
  try {
    im = new Image();
    im.onload = function () { e.ok = true; };
    im.onerror = function () { e.fail = true; };
    e.img = im; im.src = path;
  } catch (err) { e.fail = true; }
  return e;
}
function bnDrNew(w, h) {
  var cv;
  if (typeof document === 'undefined' || !document.createElement) return null;
  cv = document.createElement('canvas'); cv.width = Math.max(1, w | 0); cv.height = Math.max(1, h | 0);
  return cv;
}
function bnDrIw(e) { return (e.img && (e.img.naturalWidth || e.img.width)) || 64; }
function bnDrIh(e) { return (e.img && (e.img.naturalHeight || e.img.height)) || 64; }
// 白剪影 / 染色版本(lazy 快取)
function bnDrWhite(e) {
  var k = e.path, cv, c;
  if (BNDR.white[k]) return BNDR.white[k];
  if (BNDR.whiteN >= BNDR.whiteMax) return null;
  cv = bnDrNew(bnDrIw(e), bnDrIh(e));
  if (!cv) return null;
  c = cv.getContext('2d');
  if (!c) return null;
  c.drawImage(e.img, 0, 0);
  c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
  BNDR.white[k] = cv; BNDR.whiteN++;
  return cv;
}
function bnDrTinted(e, ti) {
  var k = e.path + '|' + ti, cv, c;
  if (!ti || !BN_TINTS[ti]) return null;
  if (BNDR.tint[k]) return BNDR.tint[k];
  cv = bnDrNew(bnDrIw(e), bnDrIh(e));
  if (!cv) return null;
  c = cv.getContext('2d');
  if (!c) return null;
  c.drawImage(e.img, 0, 0);
  c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.3; c.fillStyle = BN_TINTS[ti]; c.fillRect(0, 0, cv.width, cv.height);
  BNDR.tint[k] = cv;
  return cv;
}
function bnDrGlow(col) {
  var k = col, cv, c, g;
  if (BNDR.glow[k]) return BNDR.glow[k];
  cv = bnDrNew(64, 64);
  if (!cv) return null;
  c = cv.getContext('2d');
  if (c && c.createRadialGradient) {
    g = c.createRadialGradient(32, 32, 1, 32, 32, 31);
    g.addColorStop(0, col); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  }
  BNDR.glow[k] = cv;
  return cv;
}

// ───────── 外觀解析:回 {paths:[候選圖], bust:[索引→是否半身], tint, foe} ─────────
function bnDrLook(u) {
  var sp = u.spec || {}, look = sp.look || '', paths = [], bust = [], tint = 0, h = 0, i;
  if (look && look.indexOf('foe:') === 0) {
    paths.push('assets/fullbody/bn_foe_' + look.slice(4) + '.webp'); bust.push(false);
  } else if (u.fig) {
    paths.push('assets/fullbody/' + u.fig + '.webp'); bust.push(false);
    paths.push('assets/portraits/' + u.fig + '.webp'); bust.push(true);
  } else {
    paths.push('assets/fullbody/bn_body_' + (BN_BODY_OF[u.troop] || 'inf') + '.webp'); bust.push(false);
    for (i = 0; i < (u.name || '').length; i++) h = (h * 31 + u.name.charCodeAt(i)) >>> 0;
    tint = (h + (sp.gr || 0)) % BN_TINTS.length;
  }
  return { paths: paths, bust: bust, tint: tint };
}

// ───────── 版面 ─────────
// 回 L:{vw,vh,top,bot,colW,pitch,sh,pos:{A:[[{x,y}×3]×3],B:...},fs}。x = 腳底中心,y = 腳底。我方在左、前排靠中央。
function bnDrLayout(vw, vh, top, bot) {
  var half = vw / 2, colW = Math.max(30, (half - 6) / 3.05), fh = Math.max(80, vh - top - bot), avail = fh - 40, sh, pitch, bt, L = { vw: vw, vh: vh, top: top, bot: bot, pos: { A: [], B: [] } }, r, c, x, y;
  sh = Math.max(48, Math.min(colW * 1.8, avail / 2.35, 230));
  pitch = Math.min(sh + 24, (avail - sh * 1.06) / 2);
  bt = top + 24 + Math.max(0, (avail - (sh * 1.06 + 2 * pitch))) / 2;   // 區塊頂(最上格頭頂);頭上留 24px 給血條 / 狀態圖示
  for (r = 0; r < 3; r++) {
    L.pos.A[r] = []; L.pos.B[r] = [];
    for (c = 0; c < 3; c++) {
      x = half - colW * (0.5 + 0.95 * r) + (c - 1) * colW * 0.3;   // 斜排:上下格錯開,減少立繪垂直重疊
      y = bt + sh + c * pitch + (r === 1 ? sh * 0.03 : (r === 2 ? sh * 0.06 : 0));
      L.pos.A[r][c] = { x: x, y: y };
      L.pos.B[r][c] = { x: vw - x, y: y };
    }
  }
  L.colW = colW; L.pitch = pitch; L.sh = sh; L.fs = Math.max(11, Math.min(21, colW / 4.6));
  return L;
}

// ───────── 播放器 ─────────
function bnPlNewVu(u, L) {
  var lk = bnDrLook(u), p = L ? L.pos[u.side][u.row][u.col] : { x: 0, y: 0 };
  return {
    id: u.id, side: u.side, name: u.name, troop: u.troop, fig: u.fig, row: u.row, col: u.col, px: p.x, py: p.y, tx: p.x, ty: p.y, dx: 0, dy: 0, hp: u.hp, mx: u.maxHp, hpShow: u.hp, morale: u.morale, moraleShow: u.morale,
    alive: u.alive !== false, fade: 1, rot: 0, flash: 0, cast: 0, kb: 0, scale: 1, lunge: null, dying: -1, st: {}, shield: 0, look: lk, phase: (u.id * 1.713) % 6.28, sx: 1, sy: 1, sh: L ? L.sh : 100, nn: 0, hitAt: 0, ultReady: false, tone: ''
  };
}
function bnPlNew(S, L, o) {
  var P, i, u;
  o = o || {};
  P = {
    S: S, L: L, speed: o.speed || 1, clock: 0, wait: 0, vu: {}, order: [], tm: [], nums: [], fx: [], banner: null, cut: null, over: false, done: false, ended: false, endT: 0,
    ei: 0, round: 0, actor: -1, hitN: 0, sk: null, chainN: 0, sfx: o.sfx !== false, hooks: o.hooks || {}, ultSeen: {}, ps: !!o.powerSave, skipped: false, nev: 0, endEv: null, shake: 0, flashT: 0, result: null
  };
  for (i = 0; i < BN_NUM_N; i++) P.nums.push({ on: false, x: 0, y: 0, vy: 0, t: 0, dur: 1, text: '', col: '#fff', size: 14, kind: 0 });
  for (i = 0; i < (P.ps ? BN_FX_N / 2 : BN_FX_N); i++) P.fx.push({ on: false, name: '', x: 0, y: 0, x2: 0, y2: 0, t: 0, dur: 0.4, size: 40, rot: 0, col: '#fff', mode: 0, delay: 0 });
  for (i = 0; i < S.units.length; i++) { u = S.units[i]; P.vu[u.id] = bnPlNewVu(u, L); }
  return P;
}
function bnPlSetSpeed(P, s) { P.speed = s; }
function bnPlDispose(P) { P.over = true; P.tm = []; P.hooks = {}; }
function bnPlHook(P, name, a, b) { var f = P.hooks && P.hooks[name]; if (f) { try { f(a, b); } catch (e) { /* 略過 */ } } }
function bnPlSfx(P, kind) {
  if (!P.sfx || typeof sfxwPlay !== 'function') return;
  try { sfxwPlay(kind); } catch (e) { /* 略過 */ }
}
function bnPlAt(P, delay, fn) {
  var t = P.clock + delay, i = P.tm.length;
  P.tm.push({ t: t, fn: fn });
  while (i > 0 && P.tm[i - 1].t > t) { P.tm[i] = P.tm[i - 1]; i--; }
  P.tm[i] = { t: t, fn: fn };
}
function bnPlCenter(v) { return { x: v.px + v.dx, y: v.py + v.dy - v.sh * 0.5 }; }
function bnPlRelayout(P, L) {
  var id, v, p;
  P.L = L;
  for (id in P.vu) { v = P.vu[id]; v.sh = L.sh; p = L.pos[v.side][v.row][v.col]; v.px = v.tx = p.x; v.py = v.ty = p.y; }
}

// 數字 / 文字物件池
function bnPlText(P, v, text, col, size, kind, dur, dxj) {
  var i, n = null, L = P.L;
  for (i = 0; i < P.nums.length; i++) if (!P.nums[i].on) { n = P.nums[i]; break; }
  if (!n) n = P.nums[0];
  n.on = true; n.text = text; n.col = col; n.size = size || 1; n.kind = kind || 0; n.t = 0; n.dur = dur || 0.8; n.vy = kind === 2 ? -L.sh * 0.18 : -L.sh * 0.55;
  n.x = v.px + v.dx + (dxj !== undefined ? dxj : ((v.nn++ % 3) - 1) * L.colW * 0.22);
  n.y = v.py + v.dy - L.sh * 0.78 - (kind === 2 ? L.sh * 0.14 : 0);
  return n;
}
// 特效物件池。mode:0 圖(加色)1 箭 2 球 3 環 4 閃線(斬擊) 5 光柱
function bnPlFx(P, name, x, y, o) {
  var i, f = null;
  o = o || {};
  for (i = 0; i < P.fx.length; i++) if (!P.fx[i].on) { f = P.fx[i]; break; }
  if (!f) return null;
  f.on = true; f.name = name; f.x = x; f.y = y; f.x2 = o.x2 !== undefined ? o.x2 : x; f.y2 = o.y2 !== undefined ? o.y2 : y; f.t = -(o.delay || 0); f.dur = o.dur || 0.4; f.size = o.size || 60;
  f.rot = o.rot || 0; f.col = o.col || '#ffe9a8'; f.mode = o.mode || 0;
  return f;
}

function bnPlIsMelee(v, sk) {
  var k = sk ? sk.kind : '';
  if (v.troop === '弓' || v.troop === '謀') return false;
  if (!sk) return true;
  return k === 'atk_single' || k === 'atk_exec' || k === 'atk_multi' || k === 'stun' || k === 'atk_pierce' || k === 'atk_cross';
}
function bnPlTone(id) {
  var d = (typeof BN_SKILLS !== 'undefined') ? BN_SKILLS[id] : null, t = d && d.vfx ? BN_TONE[d.vfx] : '';
  if (t) return t;
  if (d && d.kind) {
    if (d.kind === 'atk_front' || d.kind === 'atk_all') return d.tags && d.tags.indexOf('fire') >= 0 ? 'flame' : 'common';
    if (d.kind.indexOf('heal') === 0) return 'wind';
  }
  return 'common';
}
// 技能特效選用(依 kind 與 tags):回圖名(assets/bnfx/fx_<name>.webp)與大小倍率
function bnPlFxFor(sk, many) {
  var k = sk ? sk.kind : '', tg = sk && sk.tags ? sk.tags : [];
  if (tg.indexOf('fire') >= 0) return { n: many ? 'fire_wall' : 'fire_l', s: many ? 1.1 : 1 };
  if (tg.indexOf('chain') >= 0) return { n: 'bolt_fork', s: 1 };
  if (tg.indexOf('ambush') >= 0) return { n: 'slash_x', s: 1 };
  if (tg.indexOf('arrow') >= 0) return { n: 'spark', s: 0.8 };
  if (tg.indexOf('charge') >= 0) return { n: 'impact_ring', s: 1 };
  if (tg.indexOf('water') >= 0) return { n: 'poison_mist', s: 1 };
  if (k.indexOf('heal') === 0) return { n: many ? 'heal_motes' : 'heal_pillar', s: 1 };
  if (k.indexOf('shield') === 0) return { n: 'shield_dome', s: 1 };
  if (k.indexOf('buff') === 0 || k === 'inspire' || k === 'morale_up' || k === 'cleanse') return { n: 'morale_burst', s: 0.9 };
  if (k === 'dot_poison') return { n: 'poison_mist', s: 1 };
  if (k === 'dot_burn') return { n: 'fire_s', s: 1 };
  if (k === 'stun' || k === 'silence' || k === 'fear' || k === 'taunt') return { n: 'impact_ring', s: 0.9 };
  if (k === 'atk_pierce') return { n: 'slash_h', s: 1.1 };
  if (k === 'atk_cross') return { n: 'slash_x', s: 1 };
  if (k === 'atk_multi') return { n: 'slash_d', s: 0.9 };
  if (k === 'atk_all') return { n: 'bolt_fork', s: 1.2 };
  if (k === 'atk_front') return { n: 'slash_h', s: 1.2 };
  if (k.indexOf('debuff') === 0 || k === 'mark' || k === 'morale_down') return { n: 'spark', s: 1 };
  return { n: 'slash_d', s: 1 };
}
function bnPlHitFx(P, vt, e, first) {
  var c = bnPlCenter(vt), sk = P.sk, f, s = P.L.sh;
  if (!sk || e.basic) {
    f = e.ty === 'strat' ? { n: 'bolt', s: 0.9 } : (e.crit ? { n: 'slash_x', s: 1 } : { n: 'slash_d', s: 0.85 });
    if (vt.troop === '盾' && !e.crit) f = { n: 'impact_ring', s: 0.7 };
  } else f = bnPlFxFor(sk, !first);
  bnPlFx(P, f.n, c.x, c.y, { size: s * 0.8 * f.s, dur: 0.38, rot: (vt.id * 0.7) % 3 - 1.2 });
}
function bnPlProj(P, vs, vt, e, delay) {
  var a = bnPlCenter(vs), b = bnPlCenter(vt), L = P.L;
  if (vs.troop === '弓') bnPlFx(P, 'arrow', a.x, a.y, { x2: b.x, y2: b.y, mode: 1, dur: delay, size: L.sh * 0.3, col: '#ffe9a8' });
  else bnPlFx(P, 'orb', a.x, a.y, { x2: b.x, y2: b.y, mode: 2, dur: delay, size: L.sh * 0.22, col: BN_TONE_COL[P.sk ? bnPlTone(P.sk.id) : 'common'] });
}

// ───────── 事件處理:回等待秒數 ─────────
function bnPlHit(P, e, vt) {
  var abs = e.abs | 0, v = e.v | 0, L = P.L, ty = e.ty, col;
  vt.hp = e.hp;
  if (abs > 0) { vt.shield = Math.max(0, vt.shield - abs); if (v <= 0) bnPlText(P, vt, '盾 -' + abs, '#8ec7ff', 1, 0, 0.8); else bnPlText(P, vt, '-' + abs, '#8ec7ff', 0.8, 0, 0.7, -L.colW * 0.3); bnPlSfx(P, 'shieldHit'); }
  if (v > 0) {
    col = ty === 'dot' ? '#c38aff' : (ty === 'strat' ? '#9fb8ff' : '#fff1d0');
    if (e.crit) { bnPlText(P, vt, '-' + v + '!', '#ffd25a', 1.35, 1, 0.95); P.shake = 0.12; }
    else bnPlText(P, vt, '-' + v, col, 1, 0, 0.8);
    if (ty !== 'dot') { vt.flash = 1; vt.kb = 1; }
  }
  if (e.ctr) bnPlText(P, vt, '反擊', '#ffb36a', 0.75, 2, 0.7);
  if (e.via !== undefined && P.vu[e.via]) bnPlText(P, P.vu[e.via], '援護', '#8ec7ff', 0.75, 2, 0.7);
}
function bnPlStartLunge(P, vs, vt, dur) {
  vs.lunge = { t: 0, dur: dur || 0.5, tx: vt.px - vs.px, ty: vt.py - vs.py };
}
function bnPlDmg(P, e) {
  var vs = P.vu[e.src], vt = P.vu[e.tgt], first, delay = BNPL_T.multiDelay, wait = BNPL_T.multi, sk = P.sk, basic = !!e.basic, dot = e.ty === 'dot' || e.dot, self = e.ty === 'self' || e.src === e.tgt;
  if (!vt) return 0;
  first = P.hitN++ === 0;
  if (dot || self) { delay = 0; wait = BNPL_T.dot; }
  else if (first) {
    if (vs && basic) {
      if (bnPlIsMelee(vs, null)) { delay = BNPL_T.lunge; bnPlStartLunge(P, vs, vt, 0.52); }
      else { delay = BNPL_T.proj; bnPlProj(P, vs, vt, e, delay); }
      wait = BNPL_T.basicWait;
      bnPlSfx(P, vs.troop === '弓' ? 'arrow' : (vs.troop === '騎' ? 'hoofH' : (vs.troop === '謀' ? 'bolt' : (vs.troop === '盾' ? 'melee' : 'blade'))));
    } else if (vs) {
      delay = BNPL_T.skillHit; wait = BNPL_T.skillWait;
      if (bnPlIsMelee(vs, sk)) bnPlStartLunge(P, vs, vt, 0.5); else if (sk && (sk.kind === 'atk_back' || sk.kind === 'atk_snipe' || vs.troop === '弓' || vs.troop === '謀')) bnPlProj(P, vs, vt, e, delay);
      bnPlSfx(P, vs.troop === '謀' ? 'bolt' : (vs.troop === '弓' ? 'arrow' : 'melee'));
    }
  }
  if (e.ctr && vs) { bnPlStartLunge(P, vs, vt, 0.4); }
  vt.hitAt = P.clock + delay;
  if (delay <= 0) bnPlHit(P, e, vt);
  else bnPlAt(P, delay, function () { if (!P.skipped) { bnPlHit(P, e, vt); if (!dot && !self) bnPlHitFx(P, vt, e, first); } });
  return wait;
}
function bnPlStatus(P, e) {
  var v = P.vu[e.tgt], nm = BN_ST_NAME[e.id], good = BN_ST_GOOD[e.id];
  if (!v) return 0;
  v.st[e.id] = 1;
  if (e.id === 'shield') return 0;
  if (nm && e.id !== 'ccimm') bnPlText(P, v, nm, good ? '#9be39b' : '#ff9a8a', 0.7, 2, 0.75);
  return BNPL_T.status;
}
function bnPlKill(P, e) {
  var v = P.vu[e.tgt], d;
  if (!v) return 0;
  d = Math.max(0, v.hitAt - P.clock) + BNPL_T.killDelay;
  bnPlAt(P, d, function () { v.dying = 0; v.alive = false; v.st = {}; v.shield = 0; if (!P.skipped) bnPlSfx(P, 'grunt'); });
  return 0;
}
function bnPlCutin(P, e) {
  var u = P.S.units[e.u], v = P.vu[e.u], tone = bnPlTone(e.id), d = (typeof BN_SKILLS !== 'undefined') ? BN_SKILLS[e.id] : null, full = false, dur;
  if (!v) return 0;
  full = !!v.fig && !P.ultSeen[e.u] && !P.ps && P.speed < 4;
  P.ultSeen[e.u] = true;
  v.tone = tone;
  dur = full ? BNPL_T.cutFull : BNPL_T.cutSmall;
  P.cut = { full: full, t: 0, dur: dur, side: v.side, name: v.name, fig: v.fig, skill: d ? d.name : '', tone: tone, uid: e.u, path: v.look.paths[0], big: !!v.fig };
  if (!full) { bnPlFx(P, 'morale_burst', v.px, v.py - P.L.sh * 0.5, { size: P.L.sh * 1.3, dur: 0.5, delay: 0 }); bnPlText(P, v, d ? d.name : '大招', BN_TONE_COL[tone] || '#ffe9a8', 1.1, 2, 0.9); }
  bnPlSfx(P, 'flag');
  bnPlHook(P, 'cut', P.cut);
  return dur;
}
function bnPlEvent(P, e) {
  var v, t = BNPL_T, c, L = P.L, i, w = 0;
  P.nev++;
  switch (e.t) {
    case 'init':
      for (i = 0; i < e.units.length; i++) { v = P.vu[e.units[i].id]; if (v) { v.hp = e.units[i].hp; v.mx = e.units[i].mx; v.hpShow = v.hp; v.morale = e.units[i].morale; v.moraleShow = v.morale; } }
      return 0;
    case 'round':
      P.round = e.n; P.chainN = 0;
      P.banner = { text: '第 ' + e.n + ' 回合' + (e.fat ? ' · 疲兵' + e.fat : ''), t: 0, dur: 0.9, big: true };
      if (e.n === 1) bnPlSfx(P, 'drum');
      bnPlHook(P, 'round', e.n);
      bnPlHook(P, 'order', -1, bnPlPredict(P.S, 6));
      return t.round;
    case 'act':
      P.actor = e.u; P.hitN = 0; P.sk = null; P.chainN = 0;
      bnPlHook(P, 'order', e.u, bnPlPredict(P.S, 5));
      return t.act;
    case 'skip':
      v = P.vu[e.u];
      if (v) bnPlText(P, v, e.why === 'stun' ? '暈眩!' : (e.why === 'fear' ? '威懾!' : '中伏'), '#ff9a8a', 1, 2, 0.8);
      return t.txt;
    case 'idle':
      v = P.vu[e.u];
      if (v) bnPlText(P, v, '待命', '#cfd6e0', 0.75, 2, 0.6);
      return 0.15;
    case 'prep':
      v = P.vu[e.u];
      if (v) { v.cast = 1; bnPlText(P, v, '蓄力…', '#ffd25a', 0.8, 2, 0.8); }
      return t.txt;
    case 'ult':
      return bnPlCutin(P, e);
    case 'skill': {
      v = P.vu[e.u];
      P.sk = { id: e.id, kind: e.kind, cat: e.cat, tags: (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[e.id] && BN_SKILLS[e.id].tags) || [], name: e.name };
      if (!v) return 0;
      v.cast = 1;
      if (e.cat !== 'ult') bnPlText(P, v, (e.rc ? '再放·' : (e.as !== undefined ? '補刀·' : '')) + (e.name || ''), '#ffe9a8', 0.95, 2, 1.0);
      if (/^(heal|shield|buff|inspire|morale|cleanse|revive|guard|evade|reorder|taunt)/.test(e.kind || '')) { c = bnPlCenter(v); bnPlFx(P, 'morale_burst', c.x, c.y, { size: L.sh * 0.9, dur: 0.4 }); }
      if (P.sk.tags.indexOf('charge') >= 0) { bnPlFx(P, 'dust', v.px, v.py - L.sh * 0.1, { size: L.sh * 0.7, dur: 0.5 }); }
      return e.cat === 'ult' ? 0.12 : t.cast;
    }
    case 'dmg': return bnPlDmg(P, e);
    case 'evade':
      v = P.vu[e.tgt]; if (v) bnPlText(P, v, '閃避', '#cfe8ff', 0.9, 2, 0.7);
      return t.status;
    case 'heal': {
      v = P.vu[e.tgt];
      if (!v) return 0;
      v.hp = e.hp;
      if (e.v > 0) { bnPlText(P, v, '+' + e.v, '#8ff0a0', 1, 0, 0.85); c = bnPlCenter(v); bnPlFx(P, P.sk && P.sk.kind === 'heal_all' ? 'heal_motes' : 'heal_pillar', c.x, c.y, { size: L.sh * 0.9, dur: 0.5 }); }
      return P.hitN++ === 0 ? t.heal : t.healMore;
    }
    case 'shield':
      v = P.vu[e.tgt];
      if (!v) return 0;
      v.shield = e.tot; v.st.shield = 1;
      bnPlText(P, v, '盾 +' + e.v, '#8ec7ff', 0.95, 0, 0.85);
      c = bnPlCenter(v); bnPlFx(P, 'shield_dome', c.x, c.y, { size: L.sh * 1.0, dur: 0.5 });
      return P.hitN++ === 0 ? t.heal : t.healMore;
    case 'revive':
      v = P.vu[e.tgt];
      if (v) { v.alive = true; v.dying = -1; v.fade = 0; v.rot = 0; v.hp = e.hp; bnPlText(P, v, '復活', '#8ff0a0', 1.1, 2, 0.9); c = bnPlCenter(v); bnPlFx(P, 'heal_pillar', c.x, c.y, { size: L.sh * 1.1, dur: 0.6 }); }
      return t.heal;
    case 'status': return bnPlStatus(P, e);
    case 'unstatus':
      v = P.vu[e.tgt];
      if (v) { delete v.st[e.id]; if (e.id === 'shield') v.shield = 0; }
      return 0;
    case 'resist': case 'immune': case 'ccimm':
      v = P.vu[e.tgt]; if (v) bnPlText(P, v, e.t === 'resist' ? '抵禦' : '免疫', '#cfe8ff', 0.75, 2, 0.7);
      return 0.1;
    case 'morale':
      v = P.vu[e.u];
      if (v) { v.morale = e.now; }
      return 0;
    case 'kill': return bnPlKill(P, e);
    case 'move':
      v = P.vu[e.u];
      if (v) { v.row = e.row; v.col = e.col; c = L.pos[v.side][e.row][e.col]; v.tx = c.x; v.ty = c.y; }
      return 0.3;
    case 'react':
      v = P.vu[e.tgt]; if (v) bnPlText(P, v, e.name || '連環', '#ffb36a', 0.9, 2, 0.8);
      return 0.2;
    case 'bond':
      P.banner = { text: e.name || '羈絆', t: 0, dur: 0.8, big: false };
      return 0;
    case 'chain':
      P.chainN = e.n;
      return t.chain;
    case 'chaincap':
      P.banner = { text: '連鎖上限', t: 0, dur: 0.8, big: false };
      return 0.2;
    case 'end':
      P.endEv = e;
      return t.end;
    default: return 0;
  }
}

// 預測接下來出手順序(僅顯示用;忽略先機)
function bnPlPredict(S, n) {
  var lists = { A: [], B: [] }, out = [], side;
  try {
    ['A', 'B'].forEach(function (sd) {
      var us = S.teams[sd].units.filter(function (u) { return u.alive && !u.acted; });
      us.sort(function (a, b) {
        var sa = bnSpd(S, a), sb = bnSpd(S, b), ra, rb;
        if (sa !== sb) return sb - sa;
        ra = bnRank(S, a); rb = bnRank(S, b);
        if (ra !== rb) return ra - rb;
        return a.col - b.col;
      });
      lists[sd] = us;
    });
  } catch (e) { return out; }
  side = S.turnSide || 'A';
  while (out.length < n && (lists.A.length || lists.B.length)) {
    if (!lists[side].length) side = side === 'A' ? 'B' : 'A';
    out.push(lists[side].shift().id);
    side = side === 'A' ? 'B' : 'A';
  }
  return out;
}

// ───────── 推進 ─────────
function bnPlAnim(P, dt) {
  var id, v, n, f, i, l, tm;
  for (id in P.vu) {
    v = P.vu[id];
    if (v.px !== v.tx || v.py !== v.ty) {
      v.px += (v.tx - v.px) * Math.min(1, dt * 9); v.py += (v.ty - v.py) * Math.min(1, dt * 9);
      if (Math.abs(v.tx - v.px) < 0.4 && Math.abs(v.ty - v.py) < 0.4) { v.px = v.tx; v.py = v.ty; }
    }
    v.hpShow += (v.hp - v.hpShow) * Math.min(1, dt * 8);
    if (Math.abs(v.hp - v.hpShow) < 0.5) v.hpShow = v.hp;
    v.moraleShow += (v.morale - v.moraleShow) * Math.min(1, dt * 8);
    if (v.flash > 0) v.flash = Math.max(0, v.flash - dt / 0.2);
    if (v.kb > 0) v.kb = Math.max(0, v.kb - dt / 0.25);
    if (v.cast > 0) v.cast = Math.max(0, v.cast - dt / 0.32);
    v.dx = 0; v.dy = 0; v.scale = 1; v.sx = 1; v.sy = 1;
    l = v.lunge;
    if (l) {
      l.t += dt;
      i = l.t / l.dur;
      if (i >= 1) v.lunge = null;
      else {
        n = i < 0.4 ? i / 0.4 : (i < 0.55 ? 1 : 1 - (i - 0.55) / 0.45);
        n = n * n * (3 - 2 * n);
        v.dx = l.tx * 0.38 * n; v.dy = l.ty * 0.38 * n;
        v.sx = 1 + 0.12 * n * (i < 0.4 ? 1 : -0.6); v.sy = 1 - 0.07 * n * (i < 0.4 ? 1 : -0.6);
      }
    }
    if (v.kb > 0) { v.dx += (v.side === 'A' ? -1 : 1) * v.kb * P.L.colW * 0.1; }
    if (v.dying >= 0) {
      v.dying += dt;
      i = Math.min(1, v.dying / BNPL_T.dying);
      v.rot = i * 1.22 * (v.side === 'A' ? -1 : 1); v.fade = 1 - i;
    } else if (v.fade < 1) v.fade = Math.min(1, v.fade + dt * 3);
  }
  for (i = 0; i < P.nums.length; i++) {
    n = P.nums[i];
    if (!n.on) continue;
    n.t += dt; n.y += n.vy * dt; n.vy *= Math.max(0, 1 - dt * 3.2);
    if (n.t >= n.dur) n.on = false;
  }
  for (i = 0; i < P.fx.length; i++) {
    f = P.fx[i];
    if (!f.on) continue;
    f.t += dt;
    if (f.t >= f.dur) f.on = false;
  }
  if (P.banner) { P.banner.t += dt; if (P.banner.t >= P.banner.dur) P.banner = null; }
  if (P.shake > 0) P.shake = Math.max(0, P.shake - dt);
  if (P.cut) {
    P.cut.t += dt;
    if (P.cut.t >= P.cut.dur) { P.cut = null; bnPlHook(P, 'cut', null); } else bnPlHook(P, 'cut', P.cut);
  }
  tm = P.tm;
  while (tm.length && tm[0].t <= P.clock) { f = tm.shift(); f.fn(); }
}
// 推進 dt 秒(實際秒;內部乘倍速)。回是否仍在播放
function bnPlTick(P, dtReal) {
  var dt = Math.min(0.1, Math.max(0, dtReal)) * P.speed, guard = 0, e, S = P.S, n0;
  if (P.over || P.done) return false;
  P.clock += dt;
  bnPlAnim(P, dt);
  P.wait -= dt;
  while (P.wait <= 0 && guard++ < 80 && !P.over && !P.done) {
    if (P.ei >= S.events.length) {
      if (P.endEv) { bnPlFinish(P); break; }
      if (S.over) { P.endEv = S.events[S.events.length - 1]; continue; }
      n0 = S.events.length;
      bnStep(S);
      if (S.events.length === n0 && !S.over) { bnRunToEnd(S); }
      continue;
    }
    e = S.events[P.ei++];
    P.wait += bnPlEvent(P, e);
    if (e.t === 'end') break;
  }
  return !P.done;
}
function bnPlFinish(P) {
  if (P.done) return;
  P.done = true;
  P.result = P.S.result;
  bnPlHook(P, 'end', P.S.result);
}
// 略過:直接算到終局並把視覺調成終局狀態
function bnPlSkip(P) {
  var S = P.S, id, v, u, i;
  if (P.done) return;
  P.skipped = true;
  if (!S.over) bnRunToEnd(S);
  P.ei = S.events.length; P.tm = []; P.cut = null; P.banner = null; bnPlHook(P, 'cut', null);
  for (i = 0; i < P.nums.length; i++) P.nums[i].on = false;
  for (i = 0; i < P.fx.length; i++) P.fx[i].on = false;
  for (id in P.vu) {
    v = P.vu[id]; u = S.units[id];
    v.hp = u.hp; v.hpShow = u.hp; v.morale = u.morale; v.moraleShow = u.morale; v.alive = u.alive; v.lunge = null; v.flash = 0; v.kb = 0; v.cast = 0; v.st = {}; v.shield = 0;
    v.dying = u.alive ? -1 : 2; v.fade = u.alive ? 1 : 0; v.rot = u.alive ? 0 : 1.22 * (v.side === 'A' ? -1 : 1);
    if (u.alive) { Object.keys(u.st || {}).forEach(function (k) { v.st[k] = 1; }); if (u.st && u.st.shield) v.shield = u.st.shield.val; }
  }
  P.endEv = S.events[S.events.length - 1];
  bnPlFinish(P);
}
// 手動大招:點我方士氣滿的單位 → 回該單位 id(否則 -1)
function bnPlHitUlt(P, x, y) {
  var id, v, h = P.L.sh, w = Math.max(44, P.L.colW);
  for (id in P.vu) {
    v = P.vu[id];
    if (v.side !== 'A' || !v.alive) continue;
    if (v.morale >= 100 && Math.abs(x - v.px) <= w / 2 && y <= v.py + 8 && y >= v.py - Math.max(44, h)) return v.id | 0;
  }
  return -1;
}
// 統計(給結算畫面):依完整事件日誌算傷害 / 治療 / 承傷 / 擊殺
function bnPlStats(S) {
  var st = {}, i, e;
  function g(id) { return st[id] || (st[id] = { dmg: 0, heal: 0, taken: 0, kills: 0 }); }
  for (i = 0; i < S.events.length; i++) {
    e = S.events[i];
    if (e.t === 'dmg' && e.src !== undefined && e.src >= 0 && e.src !== e.tgt) { g(e.src).dmg += (e.v | 0); g(e.tgt).taken += (e.v | 0) + (e.abs | 0); }
    else if (e.t === 'heal' && e.src >= 0) g(e.src).heal += (e.v | 0);
    else if (e.t === 'kill' && e.src >= 0) g(e.src).kills++;
  }
  return st;
}

// ───────── 繪製 ─────────
function bnDrResize(vw, vh, dpr, top, bot) {
  return bnDrLayout(vw, vh, top, bot);
}
// 背景:程式繪製的野外(漸層天空 + 地面帶 + 暈角),依尺寸烘進離屏一次
function bnDrBgFor(L, dpr, ps) {
  var key = L.vw + 'x' + L.vh + '@' + dpr + (ps ? 'p' : ''), cv, c, g, i, hz = L.top + (L.vh - L.top - L.bot) * 0.22;
  if (BNDR.bgKey === key && BNDR.bg) return BNDR.bg;
  cv = bnDrNew(L.vw * dpr, L.vh * dpr);
  if (!cv) return null;
  c = cv.getContext('2d');
  if (!c) return null;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (c.createLinearGradient) {
    g = c.createLinearGradient(0, 0, 0, hz + 30); g.addColorStop(0, '#26324a'); g.addColorStop(1, '#8a7a62'); c.fillStyle = g; c.fillRect(0, 0, L.vw, hz + 30);
    g = c.createLinearGradient(0, hz, 0, L.vh); g.addColorStop(0, '#6f6a45'); g.addColorStop(0.5, '#4f5636'); g.addColorStop(1, '#2d3322'); c.fillStyle = g; c.fillRect(0, hz, L.vw, L.vh - hz);
  } else { c.fillStyle = '#4f5636'; c.fillRect(0, 0, L.vw, L.vh); }
  if (!ps) {
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1;
    for (i = 0; i < 7; i++) { c.beginPath(); c.moveTo(0, hz + (L.vh - hz) * (i / 7) * (i / 7) + 6); c.lineTo(L.vw, hz + (L.vh - hz) * (i / 7) * (i / 7) + 6); c.stroke(); }
    c.fillStyle = 'rgba(20,24,16,.55)'; c.beginPath(); c.moveTo(0, hz + 6);
    for (i = 0; i <= 8; i++) c.lineTo(L.vw * i / 8, hz - 8 - ((i * 37) % 5) * 5);
    c.lineTo(L.vw, hz + 6); c.closePath(); c.fill();
  }
  if (c.createRadialGradient) {
    g = c.createRadialGradient(L.vw / 2, L.vh * 0.5, Math.min(L.vw, L.vh) * 0.3, L.vw / 2, L.vh * 0.5, Math.max(L.vw, L.vh) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); c.fillStyle = g; c.fillRect(0, 0, L.vw, L.vh);
  }
  BNDR.bg = cv; BNDR.bgKey = key;
  return cv;
}
function bnDrFallbackBody(ctx, v, h) {
  var col = v.side === 'A' ? '#3a6ea8' : '#a84a3a', w = h * 0.5;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); if (ctx.ellipse) ctx.ellipse(0, 0, w * 0.55, h * 0.05, 0, 0, 6.283); else ctx.arc(0, 0, w * 0.5, 0, 6.283); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath();
  if (ctx.ellipse) ctx.ellipse(0, -h * 0.34, w * 0.42, h * 0.3, 0, 0, 6.283); else ctx.arc(0, -h * 0.34, w * 0.42, 0, 6.283);
  ctx.fill();
  ctx.fillStyle = '#e8c9a0'; ctx.beginPath(); ctx.arc(0, -h * 0.76, w * 0.26, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(h * 0.2) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(v.troop || '', 0, -h * 0.36);
}
// 嘗試 ART.chibiSprite 放大(缺 ART 時回 false)
function bnDrCrowd(ctx, v, h) {
  var A = (typeof ART !== 'undefined') ? ART : null, spec, spr, sc;
  if (!A || !A.chibiSprite || typeof crowdLook !== 'function') return false;
  try {
    spec = v.crowdSpec || (v.crowdSpec = crowdLook(BN_CROWD_OF[v.troop] || 'guard', v.id * 7 + 3, null));
    if (!spec) return false;
    spr = A.chibiSprite(spec, 0, 0, 2, 'noon', '');
  } catch (e) { return false; }
  if (!spr || !spr.cv) return false;
  sc = h / 70;
  ctx.drawImage(spr.cv, spr.l * sc, spr.t * sc, spr.cv.width / spr.res * sc, spr.cv.height / spr.res * sc);
  return true;
}
function bnDrUnit(ctx, P, v, t, L, pw) {
  var h = L.sh, lk = v.look, i, e, src = null, bust = false, w, dir = v.side === 'A' ? 1 : -1, br, tilt, flashSrc = null, pend = false, tinted;
  if (v.fade <= 0.01) return;
  br = 1 + 0.015 * Math.sin(t * 2.1 + v.phase);
  tilt = Math.sin(t * 1.5 + v.phase) * 0.026 - v.kb * 0.1 * dir + v.rot;
  for (i = 0; i < lk.paths.length; i++) {
    e = bnDrImg(lk.paths[i]);
    if (e.ok) { src = e; bust = lk.bust[i]; break; }
    if (!e.fail) { pend = true; break; }
  }
  ctx.save();
  ctx.globalAlpha = v.fade;
  ctx.translate(v.px + v.dx, v.py + v.dy);
  // 地面陰影
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath();
  if (ctx.ellipse) ctx.ellipse(0, -2, h * 0.24, h * 0.055, 0, 0, 6.283); else ctx.arc(0, -2, h * 0.2, 0, 6.283);
  ctx.fill();
  ctx.rotate(tilt);
  ctx.scale(dir * v.sx * (1 + (br - 1) * 0.5), v.sy * br * (1 + v.cast * 0.06));
  if (src) {
    if (bust) { w = h * 0.7; ctx.drawImage(src.img, -w / 2, -h * 0.78, w, w * bnDrIh(src) / bnDrIw(src)); }
    else {
      w = h * bnDrIw(src) / bnDrIh(src);
      tinted = lk.tint ? bnDrTinted(src, lk.tint) : null;
      ctx.drawImage(tinted || src.img, -w / 2, -h, w, h);
      if (v.flash > 0) { flashSrc = bnDrWhite(src); if (flashSrc) { ctx.globalAlpha = v.fade * v.flash * 0.85; ctx.drawImage(flashSrc, -w / 2, -h, w, h); ctx.globalAlpha = v.fade; } }
    }
  } else if (!pend || true) {
    if (!bnDrCrowd(ctx, v, h)) bnDrFallbackBody(ctx, v, h);
  }
  ctx.restore();
}
function bnDrBars(ctx, P, v, t, L) {
  var w = Math.max(34, L.colW * 0.82), x = v.px + v.dx - w / 2, y = v.py + v.dy - L.sh - 4, hp = Math.max(0, v.hpShow / v.mx), keys, n = 0, i, ic, k, sz = Math.max(12, L.fs * 1.05), ex;
  if (v.fade <= 0.05) return;
  ctx.globalAlpha = v.fade;
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
  ctx.fillStyle = hp > 0.5 ? '#5ed05e' : (hp > 0.25 ? '#e0b43a' : '#e0503a'); ctx.fillRect(x, y, w * hp, 5);
  if (v.shield > 0) { ctx.fillStyle = 'rgba(142,199,255,.9)'; ctx.fillRect(x, y - 2, Math.min(w, w * v.shield / v.mx), 2); }
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, y + 6, w + 2, 4);
  ctx.fillStyle = v.morale >= 100 ? '#fff2a0' : '#d9a441'; ctx.fillRect(x, y + 7, w * Math.min(1, v.moraleShow / 100), 2);
  keys = Object.keys(v.st);
  for (i = 0; i < keys.length && n < 3; i++) {
    k = keys[i]; ic = BN_ST_ICON[k];
    ex = ic ? bnDrImg('assets/bnfx/st_' + (ic === 1 ? k : ic) + '.webp') : null;
    if (ex && ex.ok) ctx.drawImage(ex.img, x + n * (sz + 1), y - sz - 3, sz, sz);
    else { ctx.fillStyle = BN_ST_GOOD[k] ? '#4a8a4a' : '#9a4a3a'; ctx.fillRect(x + n * (sz + 1), y - sz - 3, sz, sz); ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(sz * 0.7) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((BN_ST_NAME[k] || k).charAt(0), x + n * (sz + 1) + sz / 2, y - sz / 2 - 3); }
    n++;
  }
  if (keys.length > 3) { ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(sz * 0.7) + 'px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('+' + (keys.length - 3), x + 3 * (sz + 1), y - sz / 2 - 3); }
  ctx.fillStyle = '#f0e6cf'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; ctx.font = Math.round(L.fs * 0.82) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.strokeText(v.name, v.px + v.dx, v.py + v.dy + 2); ctx.fillText(v.name, v.px + v.dx, v.py + v.dy + 2);
  if (v.morale >= 100 && v.alive) {
    ctx.strokeStyle = 'rgba(255,226,120,' + (0.55 + 0.35 * Math.sin(t * 8)) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); if (ctx.ellipse) ctx.ellipse(v.px, v.py - 2, L.sh * 0.3, L.sh * 0.08, 0, 0, 6.283); else ctx.arc(v.px, v.py - 2, L.sh * 0.25, 0, 6.283); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function bnDrFx(ctx, P, f, L) {
  var k = f.t / f.dur, a, x, y, s, e, g;
  if (f.t < 0) return;
  a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
  if (f.mode === 1) {   // 箭
    x = f.x + (f.x2 - f.x) * k; y = f.y + (f.y2 - f.y) * k - Math.sin(k * 3.14) * L.sh * 0.15;
    ctx.strokeStyle = f.col; ctx.lineWidth = 2; ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(x - (f.x2 - f.x) * 0.06, y - (f.y2 - f.y) * 0.06); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    return;
  }
  if (f.mode === 2) {   // 球
    x = f.x + (f.x2 - f.x) * k; y = f.y + (f.y2 - f.y) * k;
    g = bnDrGlow(f.col);
    ctx.globalCompositeOperation = 'lighter';
    if (g) { ctx.globalAlpha = 0.9; ctx.drawImage(g, x - f.size, y - f.size, f.size * 2, f.size * 2); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    return;
  }
  e = bnDrImg('assets/bnfx/fx_' + f.name + '.webp');
  s = f.size * (0.7 + 0.5 * k);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  if (e.ok) {
    if (f.rot) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.drawImage(e.img, -s / 2, -s / 2, s, s); ctx.restore(); }
    else ctx.drawImage(e.img, f.x - s / 2, f.y - s / 2, s, s);
  } else {
    g = bnDrGlow(f.name.indexOf('fire') >= 0 ? '#ff7a30' : (f.name.indexOf('heal') >= 0 ? '#7af09a' : (f.name.indexOf('shield') >= 0 ? '#8ec7ff' : '#ffe9a8')));
    if (g) ctx.drawImage(g, f.x - s / 2, f.y - s / 2, s, s);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function bnDrFrame(ctx, P, dpr, nowSec) {
  var L = P.L, S0 = (typeof performance !== 'undefined') ? performance.now() : 0, list = [], id, i, v, n, bg, sx = 0, sy = 0, b, ps = P.ps, cut = P.cut;
  bg = bnDrBgFor(L, dpr, ps);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = '#3a4228'; ctx.fillRect(0, 0, L.vw * dpr, L.vh * dpr); }
  if (P.shake > 0 && !ps) { sx = Math.sin(nowSec * 90) * 2.5 * (P.shake / 0.12); sy = Math.cos(nowSec * 73) * 2; }
  ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
  for (id in P.vu) list.push(P.vu[id]);
  list.sort(function (a, c) { return (a.py + a.dy) - (c.py + c.dy); });
  for (i = 0; i < list.length; i++) bnDrUnit(ctx, P, list[i], nowSec, L);
  for (i = 0; i < P.fx.length; i++) if (P.fx[i].on) bnDrFx(ctx, P, P.fx[i], L);
  for (i = 0; i < list.length; i++) bnDrBars(ctx, P, list[i], nowSec, L);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (i = 0; i < P.nums.length; i++) {
    n = P.nums[i];
    if (!n.on) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, (n.dur - n.t) / 0.25));
    ctx.font = 'bold ' + Math.round(L.fs * 1.25 * n.size) + 'px sans-serif';
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(n.text, n.x, n.y);
    ctx.fillStyle = n.col; ctx.fillText(n.text, n.x, n.y);
  }
  ctx.globalAlpha = 1;
  b = P.banner;
  if (b) {
    ctx.globalAlpha = Math.max(0, Math.min(1, Math.min(b.t / 0.12, (b.dur - b.t) / 0.25)));
    ctx.font = 'bold ' + Math.round(L.fs * (b.big ? 2.1 : 1.3)) + 'px sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText(b.text, L.vw / 2, L.top + (L.vh - L.top - L.bot) * 0.12); ctx.fillStyle = '#ffe9a8'; ctx.fillText(b.text, L.vw / 2, L.top + (L.vh - L.top - L.bot) * 0.12);
    ctx.globalAlpha = 1;
  }
  if (P.chainN > 0) {
    ctx.font = 'bold ' + Math.round(L.fs * 1.2) + 'px sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText('連 ×' + (P.chainN + 1), L.vw / 2, L.top + (L.vh - L.top - L.bot) * 0.22); ctx.fillStyle = '#ffb36a'; ctx.fillText('連 ×' + (P.chainN + 1), L.vw / 2, L.top + (L.vh - L.top - L.bot) * 0.22);
  }
  if (S0) { v = performance.now() - S0; BNDR.stats.lastMs = v; BNDR.stats.frames++; BNDR.stats.sumMs += v; if (v > BNDR.stats.maxMs) BNDR.stats.maxMs = v; if (BNDR.stats.samples.length < 600) BNDR.stats.samples.push(v); }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { BNPL_T: BNPL_T };
