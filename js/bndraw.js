// js/bndraw.js — 戰鬥 A 模式(B2)戰鬥畫面:事件播放狀態機(bnPl*)+ 畫布繪製(bnDr*)。PLAN_BATTLE_A §6.2、§6.3、§7、§9.1。
// 播放器 P 逐事件消化引擎日誌(bn_engine.js 檔頭註解):每個事件改變「視覺狀態 vu」並排程動畫(前衝 / 受擊 / 特效 / 數字),dispatcher 以 wait 秒數控制下一個事件何時處理。
// 引擎是惰性推進的:佇列空了才呼叫 bnStep(S) 取下一個行動的事件;略過 = bnRunToEnd(S) 後直接跳到終局視覺(結果與播放必然相同,引擎確定性)。
// 繪製:只用 canvas 2D;全身圖直接 drawImage(原圖 ≤ 190×390,不另做縮圖快取),受擊閃白用預烘白剪影(lazy,≤ 20 張),特效用 assets/bnfx/ 黑底圖 + 'lighter' 加色混合;
// 物件池(數字 28 / 特效 64)不在每幀配置。缺圖一律回退:名人全身 → 半身頭像 → 程式小人;兵種圖 → 程式小人(ART.chibiSprite 可用時放大)。
// 不寫 DOM(DOM 由 bnui.js 透過 P.hooks 接手)、不直接發聲(音效經 js/bnsfx.js 的 bnSfxPlay,缺檔退回 sfxwPlay;皆有 typeof 守衛、P.sfx=false 可關)。ES2017;不用 ?. ??。
// B5 動畫:前衝前傾 lean、受擊閃白(全身 / 半身 / 程式小人)與後退、閃避側閃 ev、倒下下沉淡出、治療 / 護盾 / 增減益粒子(物件池 BN_PT_N)、狀態圖示彈出、暴擊微震與放大浮字、待機呼吸晃動。
// 視覺時間 = 模擬秒 ÷ bnPlStK(倍速時拉長,不閃一下就沒;前衝與命中同步仍用模擬秒);省電:待機靜止、無微震、粒子減量;低階機(平均繪製 > BNDR.lowMs)自動 BNDR.low 粒子減半。
// 戰鬥改版(2026-11-06):沒有士氣條;文化主題施放特效 fxc_*、狀態圖示 stc_*、輔助虛影 fxg_*、主角專屬 fxhero_*(assets/bnfx/,透明底,一般混合;缺圖退回原 fx_* 特效)。
// 全域:BNPL_T BNDR bnDrImg bnDrLook bnDrLayout bnDrFrame bnDrResize bnPlNew bnPlTick bnPlSkip bnPlCutSkip bnPlDispose bnPlPredict bnPlStats bnPlSetSpeed BN_FX_THEME BN_FX_GHOST BN_FX_HERO BN_PT_KIND BN_ATK_SFX bnPlBurst bnDrIdle

var BNPL_T = {
  round: 0.55, act: 0.1, cast: 0.28, lunge: 0.2, proj: 0.24, basicWait: 0.52, skillHit: 0.2, skillWait: 0.36, multi: 0.14, multiDelay: 0.06,
  dot: 0.26, heal: 0.26, healMore: 0.12, status: 0.08, txt: 0.3, end: 0.8, chain: 0.28, cutFull: 1.0, cutSmall: 0.45, killDelay: 0.05, dying: 0.45
};
var BNPL_PACE = 0.8;   // 基礎節奏:模擬秒 = 實際秒 × 倍速 × 0.8(1× 比改前慢 25%:出手間隔、動畫、浮字停留一併拉長)
var BNDR = {
  imgs: {}, tint: {}, white: {}, glow: {}, bgKey: '', bg: null, dprMax: 2, whiteMax: 20, whiteN: 0, low: false, lowMs: 8,
  stats: { frames: 0, lastMs: 0, sumMs: 0, maxMs: 0, samples: [] }
};
var BN_NUM_N = 28, BN_FX_N = 64, BN_PT_N = 48;
// 粒子爆發:n 顆、顏色、形狀(0 光點 1 十字 2 上箭 3 下箭)、初速 vy、重力 g、存活秒
var BN_PT_KIND = {
  heal: { n: 8, col: '#7af09a', sh: 1, vy: -55, g: -10, dur: 0.75 }, shield: { n: 8, col: '#8ec7ff', sh: 0, vy: -10, g: 0, dur: 0.6, ring: 1 },
  buff: { n: 5, col: '#ffd75a', sh: 2, vy: -60, g: 0, dur: 0.6 }, debuff: { n: 5, col: '#c890ff', sh: 3, vy: 45, g: 0, dur: 0.6 }, crit: { n: 6, col: '#ffb040', sh: 0, vy: -70, g: 160, dur: 0.4, burst: 1 }
};
var BN_ATK_SFX = { '盾': 'atk_blade', '步': 'atk_spear', '騎': 'atk_cav', '弓': 'atk_bow', '謀': 'atk_strat' };
var BN_SFX_ALT = { atk_blade: 'melee', atk_spear: 'blade', atk_cav: 'hoofH', atk_bow: 'arrow', atk_strat: 'bolt', block: 'shieldHit', kill: 'grunt', ult: 'flag', drum: 'drum' };   // 沒有 bnsfx.js 時退回 sfxwar 舊音色
var BN_NUM_DMG = '#ff3b30', BN_NUM_HEAL = '#3ee05a', BN_NUM_MIN = 15;   // 浮字:扣血紅、補血綠,一律黑色描邊;最小字級(px)
var BN_ST_ICON = { atk_up: 1, atk_down: 1, def_up: 1, def_down: 1, spd_up: 1, stun: 1, burn: 1, poison: 1, bleed: 1, shield: 1, silence: 1, taunt: 1, timid: 1, confuse: 1, heal_reduce: 'heal_block', ward: 1, rate_up: 'stc_rate_up', debuff_hit: 'stc_ink_blind', wx_mark: 'stc_wx_mark' };
var BN_ST_NAME = {
  stun: '暈眩', fear: '威懾', confuse: '擾亂', timid: '怯戰', silence: '計窮', ult_lock: '封大', atk_down: '攻↓', def_down: '防↓', spd_down: '速↓', mark: '標記',
  burn: '燃燒', poison: '中毒', bleed: '流血', heal_reduce: '禁療', atk_up: '攻↑', def_up: '防↑', spd_up: '速↑', crit_up: '暴↑', taunt: '嘲諷', guard: '援護', evade: '規避',
  ward: '抵禦', ccimm: '抗控', shield: '護盾', heal_hot: '回春', rate_up: '率↑', rate_down: '率↓', debuff_hit: '盲', wx_mark: '五行印', stealth: '隱匿', undying: '不倒'
};
var BN_ST_GOOD = { atk_up: 1, def_up: 1, spd_up: 1, crit_up: 1, taunt: 1, guard: 1, evade: 1, ward: 1, ccimm: 1, shield: 1, heal_hot: 1, amp_atk: 1, rate_up: 1, stealth: 1, undying: 1 };
// 文化主題特效(new_heroes_draft §六):cast = 施放者身上、hit = 每個目標、area = 多目標時在目標群中央。缺圖時 alt = 原 fx_* 特效
var BN_FX_THEME = {
  herb: { cast: 'fxc_herb_mortar', hit: 'fxc_herb_leaves', area: 'fxc_herb_smoke', alt: 'heal_motes' },
  ink: { cast: 'fxc_ink_brush', hit: 'fxc_ink_splash', area: 'fxc_ink_scroll', alt: 'spark' },
  wuxing: { cast: 'fxc_wx_disc', hit: 'wx', alt: 'bolt_fork' },
  yinyang: { cast: 'fxc_yy_taiji', hit: 'fxc_yy_flip', alt: 'morale_burst' },
  bagua: { cast: 'fxc_bagua_disc', alt: 'impact_ring' },
  talisman: { cast: 'fxc_talisman', hit: 'fxc_talisman_burn', alt: 'fire_s' },
  charm: { cast: 'fxc_mirage', hit: 'fxc_mirage', alt: 'morale_burst' },
  fireox: { cast: 'fxc_fireox_charge', hit: 'fxc_fireox_trail', alt: 'fire_l' },
  drum: { cast: 'fxc_drum_wave', alt: 'impact_ring' },
  banner: { cast: 'fxc_banner', alt: 'morale_burst' },
  crossbow: { cast: 'fxc_crossbow_volley', hit: 'fxc_crossbow_volley', alt: 'spark' },
  thunder: { cast: 'fxc_thunder_cloud', hit: 'fxc_thunder_strike', area: 'fxc_thunder_blast', alt: 'bolt_fork' }
};
var BN_FX_RX = { rx_ice_shatter: { file: 'fxc_wx_water', alt: 'impact_ring' }, rx_electrocute: { file: 'fxc_thunder_chain', alt: 'bolt_fork' } };
var BN_FX_WX = { '金': 'fxc_wx_metal', '木': 'fxc_wx_wood', '水': 'fxc_wx_water', '火': 'fxc_wx_fire', '土': 'fxc_wx_earth' };
// 輔助虛影:施放時在施放者身後半透明顯示(彈琴、跳舞、擊鼓 …)
var BN_FX_GHOST = { s_xiaoqiao_3: 'fxg_qin', p_caiyong: 'fxg_qin', s_zhugeliang_2: 'fxg_qin', s_zhouyu_3: 'fxg_qin', s_diaochan_1: 'fxg_dance', s_zhenji_1: 'fxg_dance', s_yanyan_2: 'fxg_drum', s_dingfeng_1: 'fxg_drum',
  s_caiyong_1: 'fxg_flute', s_daqiao_1: 'fxg_fan', s_zhugeliang_3: 'fxg_fan', u_caozhi: 'fxg_poem', s_caiyan_2: 'fxg_poem', s_kanze_1: 'fxg_poem', s_huatuo_1: 'fxg_herb', u_huatuo: 'fxg_herb', s_huatuo_vs1: 'fxg_herb', s_nanhua_2: 'fxg_herb', s_ganfuren_1: 'fxg_herb',
  s_zhangjiao_vs1: 'fxg_talisman', s_yuji_1: 'fxg_talisman', s_nanhua_1: 'fxg_talisman', s_caiyan_1: 'fxg_hujia', s_heyi_1: 'fxg_horn', s_chengyuanzhi_1: 'fxg_horn', s_masu_2: 'fxg_banner', s_yuanshu_1: 'fxg_banner', s_panfeng_1: 'fxg_banner',
  s_peiyuanshao_2: 'fxg_banner', s_sunshangxiang_1: 'fxg_banner', s_diaochan_3: 'fxg_moon', u_zhenji: 'fxg_moon' };
// 主角專屬大招特效(12 位):大招發動時在敵陣中央播放
var BN_FX_HERO = { u_caocao: 'fxhero_caocao', u_liubei: 'fxhero_liubei', u_sunquan: 'fxhero_sunquan', u_guanyu: 'fxhero_guanyu', u_zhugeliang: 'fxhero_zhugeliang', u_zhouyu: 'fxhero_zhouyu', u_lvbu: 'fxhero_lvbu',
  u_zhangjiao: 'fxhero_zhangjiao', u_simayi: 'fxhero_simayi', u_diaochan: 'fxhero_diaochan', u_zuoci: 'fxhero_zuoci', u_nanhua: 'fxhero_nanhua' };
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
  var sp = u.spec || {}, look = sp.look || '', paths = [], bust = [], tint = 0, h = 0, i, fb, pt;
  if (look && look.indexOf('foe:') === 0) {
    paths.push('assets/fullbody/bn_foe_' + look.slice(4) + '.webp'); bust.push(false);
  } else if (u.fig) {
    // 魔幻英雄(fxFigImg):全身 / 頭像在 assets/fullbody/fx/、assets/portraits/fx/;其餘沿用歷史路徑
    fb = typeof fxFigImg === 'function' ? fxFigImg(u.fig, 'fullbody') : null; pt = typeof fxFigImg === 'function' ? fxFigImg(u.fig) : null;
    paths.push(fb || 'assets/fullbody/' + u.fig + '.webp'); bust.push(false);
    paths.push(pt || 'assets/portraits/' + u.fig + '.webp'); bust.push(true);
  } else {
    paths.push('assets/fullbody/bn_body_' + (BN_BODY_OF[u.troop] || 'inf') + '.webp'); bust.push(false);
    for (i = 0; i < (u.name || '').length; i++) h = (h * 31 + u.name.charCodeAt(i)) >>> 0;
    tint = (h + (sp.gr || 0)) % BN_TINTS.length;
  }
  return { paths: paths, bust: bust, tint: tint };
}

// ───────── 版面 ─────────
// 回 L:{vw,vh,top,bot,colW,pitch,sh,pos:{A:[[{x,y}×3]×3],B:...},fs,gap,bt,labY,labH,labX0,banY}。x = 腳底中心,y = 腳底。我方在左、前排靠中央。
// 每方 3×3 九宮格:排(row 0 前 1 中 2 後)= 橫向,列(col)= 縱向;雙方中間留 gap。每格垂直佔用 = 頭上 head(血條 + 狀態圖示)+ 立繪 sh + 腳下 foot(名字),列距 pitch ≥ 這三者,立繪不互相蓋住血條。
// 技能名標籤(bnDrLabels)放在各自陣營上方天空的牆角:區塊上方有空間就放 top 下方,否則放在頂端帶(左方讓出左上返回鈕 labX0)。
function bnDrLayout(vw, vh, top, bot) {
  var gap = Math.max(28, vw * 0.07), side = (vw - gap) / 2 - 10, colW = Math.max(30, side / 3), fh = Math.max(80, vh - top - bot), head = 34, foot = 28, sh, pitch, bt, L = { vw: vw, vh: vh, top: top, bot: bot, pos: { A: [], B: [] } }, r, c, x, y, fs, labH, room, stag;
  pitch = Math.max(30, (fh - head - foot) / 3);
  sh = Math.max(40, Math.min(colW * 1.35, pitch - 18, 170));
  pitch = Math.min(pitch, sh + head + foot + 10);
  // 斜排:列距不夠放「立繪 + 血條 + 名字」時(橫式),上下列水平錯開一個血條寬,血條 / 名字不互蓋
  // (錯開一個血條寬不夠時改縮立繪,讓上下列垂直不重疊)
  stag = colW * 0.16;
  if (pitch < sh + head + foot + 6) {
    x = Math.max(32, Math.min(colW * 0.86, sh * 0.72)) + 8;
    if (x <= colW * 0.45) stag = Math.max(stag, x);
    else sh = Math.max(40, pitch - head - foot - 6);
  }
  colW = Math.max(30, Math.min(colW, (vw / 2 - gap / 2 - stag - 10 - sh * 0.3) / 2.5));   // 最外側(後排錯開列)立繪不出畫面
  bt = top + head + Math.max(0, (fh - head - foot - (sh + 2 * pitch))) * 0.55;   // 區塊頂(最上格頭頂),略偏下(地面)
  for (r = 0; r < 3; r++) {
    L.pos.A[r] = []; L.pos.B[r] = [];
    for (c = 0; c < 3; c++) {
      x = vw / 2 - gap / 2 - colW * (0.5 + r) + (c - 1) * stag;
      y = bt + sh + c * pitch;
      L.pos.A[r][c] = { x: x, y: y };
      L.pos.B[r][c] = { x: vw - x, y: y };
    }
  }
  fs = Math.max(11, Math.min(21, colW / 4.6, sh / 4));
  labH = Math.max(22, Math.min(30, fs * 1.9));
  room = bt - head - top;
  L.colW = colW; L.pitch = pitch; L.sh = sh; L.fs = fs; L.gap = gap; L.bt = bt; L.labH = labH;
  if (room >= labH * 2 + 12) { L.labY = top + 2; L.labX0 = 6; L.banY = top + labH + 8 + (room - labH - 8) / 2; }
  else { L.labY = Math.max(4, top - labH - 6); L.labX0 = 60; L.banY = L.labY + labH / 2; }
  return L;
}

// ───────── 播放器 ─────────
function bnPlNewVu(u, L) {
  var lk = bnDrLook(u), p = L ? L.pos[u.side][u.row][u.col] : { x: 0, y: 0 };
  return {
    id: u.id, side: u.side, name: u.name, troop: u.troop, fig: u.fig, row: u.row, col: u.col, px: p.x, py: p.y, tx: p.x, ty: p.y, dx: 0, dy: 0, hp: u.hp, mx: u.maxHp, hpShow: u.hp, hpLag: u.hp, lagHold: 0, hitGlow: 0,
    alive: u.alive !== false, fade: 1, rot: 0, flash: 0, cast: 0, kb: 0, scale: 1, lunge: null, dying: -1, st: {}, shield: 0, look: lk, phase: (u.id * 1.713) % 6.28, sx: 1, sy: 1, sh: L ? L.sh : 100, nn: 0, hitAt: 0, ultReady: false, tone: '',
    lean: 0, ev: 0, stp: {}, ibr: 1, itl: 0, isw: 0
  };
}
function bnPlNew(S, L, o) {
  var P, i, u;
  o = o || {};
  P = {
    S: S, L: L, speed: o.speed || 1, clock: 0, wait: 0, vu: {}, order: [], tm: [], nums: [], fx: [], banner: null, cut: null, over: false, done: false, ended: false, endT: 0,
    ei: 0, round: 0, actor: -1, hitN: 0, sk: null, chainN: 0, sfx: o.sfx !== false, hooks: o.hooks || {}, ultSeen: {}, ps: !!o.powerSave, skipped: false, nev: 0, endEv: null, shake: 0, flashT: 0, result: null,
    lab: { A: { cur: null, q: [] }, B: { cur: null, q: [] } }
  };
  for (i = 0; i < BN_NUM_N; i++) P.nums.push({ on: false, x: 0, y: 0, vy: 0, t: 0, dur: 1, text: '', col: '#fff', size: 14, kind: 0 });
  for (i = 0; i < (P.ps ? BN_FX_N / 2 : BN_FX_N); i++) P.fx.push({ on: false, name: '', x: 0, y: 0, x2: 0, y2: 0, t: 0, dur: 0.4, size: 40, rot: 0, col: '#fff', mode: 0, delay: 0 });
  P.pt = [];
  for (i = 0; i < (P.ps ? BN_PT_N / 3 : BN_PT_N); i++) P.pt.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, t: 0, dur: 0.5, col: '#fff', sh: 0, sz: 4 });
  for (i = 0; i < S.units.length; i++) { u = S.units[i]; P.vu[u.id] = bnPlNewVu(u, L); }
  if (P.sfx && typeof bnSfxBattle === 'function') { try { bnSfxBattle(true); } catch (e) { /* 略過 */ } }
  return P;
}
function bnPlSetSpeed(P, s) { P.speed = s; }
function bnPlDispose(P) {
  P.over = true; P.tm = []; P.hooks = {};
  if (P.sfx && typeof bnSfxBattle === 'function') { try { bnSfxBattle(false); } catch (e) { /* 略過 */ } }
}
function bnPlHook(P, name, a, b) { var f = P.hooks && P.hooks[name]; if (f) { try { f(a, b); } catch (e) { /* 略過 */ } } }
function bnPlSfx(P, kind, o) {
  if (!P.sfx || P.skipped) return;
  try {
    if (typeof bnSfxPlay === 'function') bnSfxPlay(kind, o);
    else if (typeof sfxwPlay === 'function' && BN_SFX_ALT[kind]) sfxwPlay(BN_SFX_ALT[kind]);
  } catch (e) { /* 略過 */ }
}
// 粒子爆發(治療 / 護盾 / 增益 / 減益 / 暴擊);池滿就少發,不配置新物件。省電 0.4 倍、低階機 0.5 倍數量
function bnPlBurst(P, v, kind) {
  var K = BN_PT_KIND[kind], L = P.L, c, n, i, j = 0, p, a, r;
  if (!K || !v || !P.pt) return 0;
  c = bnPlCenter(v);
  n = Math.max(2, Math.round(K.n * (P.ps ? 0.4 : 1) * (BNDR.low ? 0.5 : 1)));
  for (i = 0; i < P.pt.length && j < n; i++) {
    p = P.pt[i];
    if (p.on) continue;
    a = (j / n) * 6.283 + (v.id % 5) * 0.4; r = L.colW * 0.28;
    p.on = true; p.t = -j * 0.03; p.dur = K.dur; p.col = K.col; p.sh = K.sh; p.g = K.g; p.sz = Math.max(K.sh > 1 ? 7 : 4, L.sh * (K.sh > 1 ? 0.1 : (K.sh ? 0.08 : 0.05)));
    if (K.ring) { p.x = c.x + Math.cos(a) * r; p.y = c.y + Math.sin(a) * r * 0.9; p.vx = -Math.sin(a) * 40; p.vy = Math.cos(a) * 36 + K.vy; p.t = 0; }
    else if (K.burst) { p.x = c.x; p.y = c.y; p.vx = Math.cos(a) * 110; p.vy = Math.sin(a) * 80 + K.vy; p.t = 0; }
    else { p.x = c.x + Math.cos(a) * r; p.y = c.y + (K.vy > 0 ? -L.sh * 0.35 : L.sh * 0.25) + ((j * 7) % 5) * 2; p.vx = Math.cos(a) * 8; p.vy = K.vy * (0.8 + ((j * 3) % 4) * 0.1); }
    j++;
  }
  return j;
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
  var i, k, n = null, L = P.L;
  for (i = 0; i < P.nums.length; i++) if (!P.nums[i].on) { n = P.nums[i]; break; }
  if (!n) n = P.nums[0];
  n.on = true; n.uid = v.id; n.st = 0; n.text = text; n.col = col; n.size = size || 1; n.kind = kind || 0; n.t = 0; n.pk = bnPlStK(P); n.dur = (dur || 0.8) * n.pk; n.vy = kind === 2 ? -L.sh * 0.18 : -L.sh * 0.55;
  n.x = v.px + v.dx + (dxj !== undefined ? dxj : ((v.nn++ % 3) - 1) * L.colW * 0.22);
  n.y = v.py + v.dy - L.sh - 24 - (kind === 2 ? 16 : 0);   // 從兵力條上方浮起:不被人物 / 血條遮住,也不蓋血條
  if (kind !== 2) {   // 同一人短時間內多個數字(連擊 / 治療):後出的往上錯開一格,不疊在一起
    for (i = 0, k = 0; i < P.nums.length; i++) if (P.nums[i] !== n && P.nums[i].on && P.nums[i].uid === v.id && P.nums[i].kind !== 2 && P.nums[i].t < 0.35) k++;
    n.y -= Math.min(2, k) * Math.max(BN_NUM_MIN, L.fs * 1.25) * 1.05;
  }
  return n;
}
// 技能名標籤:每方一格(左方 = 左上角、右方 = 右上角),一次只顯示一個;後到的排隊,目前這個至少顯示 BNLAB.min 秒後淡出再換下一個(不堆疊)
var BNLAB = { dur: 1.1, min: 0.45, fade: 0.15, qMax: 3 };
// 陣營旗色(CARD_FAC 順序:魏 蜀 吳 黃巾 中立);無陣營 / 敵方小怪 = 中性色
var BN_FAC_COL = ['#3a6ec8', '#2f9a5a', '#c8443a', '#d8b23a', '#8a8a8a'];
var BN_FAC_NEUTRAL = '#8a8a8a';
function bnPlLabel(P, v, text, sub) {
  var u = P.S && P.S.units[v.id], fac = u && u.fac >= 0 && BN_FAC_COL[u.fac] ? u.fac : -1, lb = P.lab[v.side], it;
  if (!text || !lb) return;
  it = { text: text, sub: sub || '', col: fac >= 0 ? BN_FAC_COL[fac] : BN_FAC_NEUTRAL, t: 0, out: -1 };
  if (!lb.cur) lb.cur = it;
  else { lb.q.push(it); if (lb.q.length > BNLAB.qMax) lb.q.shift(); }
}
// 戰法白話短句(bn_text bnSkillShort,≤ 16 字;缺 bn_text 時不顯示)
function bnPlSkShort(id) {
  var d = (typeof BN_SKILLS !== 'undefined') ? BN_SKILLS[id] : null;
  if (!d || typeof bnSkillShort !== 'function') return '';
  try { return bnSkillShort(d) || ''; } catch (er) { return ''; }
}
// 戰況播報:一次戰法(含其傷害 / 治療)整理成一行,經 hooks.feed 交給介面(只留最近幾行)
function bnPlFeedStart(P, e) {
  var v = P.vu[e.u];
  bnPlFeedFlush(P);
  if (!v || P.skipped) return;
  P.fd = { u: e.u, who: v.name, sk: e.name || '', ult: e.cat === 'ult', tg: [], by: {} };
}
function bnPlFeedHit(P, e, heal) {
  var f = P.fd, t, k;
  if (!f || e.src !== f.u || !(e.v > 0) || e.ty === 'self') return;
  k = (heal ? 'h' : 'd') + e.tgt;
  if (!f.by[k]) { t = P.vu[e.tgt]; if (!t) return; f.by[k] = { n: t.name, v: 0, h: heal }; f.tg.push(f.by[k]); }
  f.by[k].v += e.v;
}
function bnPlFeedFlush(P) {
  var f = P.fd, s, a;
  P.fd = null;
  if (!f || P.skipped) return;
  a = f.tg.slice(0, 2).map(function (x) { return x.n + ' ' + (x.h ? '+' : '−') + x.v; });
  s = f.who + ' 發動' + (f.ult ? '大招' : '') + '「' + f.sk + '」' + (a.length ? '→ ' + a.join('、') + (f.tg.length > 2 ? ' 等' : '') : '');
  bnPlHook(P, 'feed', s);
}
function bnPlLabAnim(P, dt) {
  ['A', 'B'].forEach(function (sd) {
    var lb = P.lab[sd], c = lb.cur;
    if (!c) return;
    c.t += dt;
    if (c.out < 0 && (c.t >= BNLAB.dur || (lb.q.length && c.t >= BNLAB.min))) c.out = 0;
    if (c.out >= 0) { c.out += dt; if (c.out >= BNLAB.fade) lb.cur = lb.q.length ? lb.q.shift() : null; }
  });
}
// 特效物件池。mode:0 圖(加色)1 箭 2 球 3 環 4 閃線(斬擊) 5 光柱
function bnPlFx(P, name, x, y, o) {
  var i, f = null;
  o = o || {};
  for (i = 0; i < P.fx.length; i++) if (!P.fx[i].on) { f = P.fx[i]; break; }
  if (!f) return null;
  f.on = true; f.name = name; f.x = x; f.y = y; f.x2 = o.x2 !== undefined ? o.x2 : x; f.y2 = o.y2 !== undefined ? o.y2 : y; f.t = -(o.delay || 0); f.dur = o.dur || 0.4; f.size = o.size || 60;
  f.rot = o.rot || 0; f.col = o.col || '#ffe9a8'; f.mode = o.mode || 0; f.file = o.file || ''; f.alt = o.alt || ''; f.tint = o.tint || ''; f.ex = o.ex || null; f.under = o.under ? 1 : 0;
  if (f.mode !== 1 && f.mode !== 2) f.dur *= bnPlStK(P);   // 飛行物(箭 / 球)須與命中同步,維持模擬秒
  return f;
}

// 全體技範圍標示:在該方存活單位的中心畫一個大範圍環,大小涵蓋整個陣
function bnPlAreaFx(P, side, delay) {
  var k, w, xs = 0, ys = 0, n = 0, x0 = 1e9, x1 = -1e9;
  for (k in P.vu) { w = P.vu[k]; if (w.side === side && w.alive) { xs += w.px; ys += w.py; n++; x0 = Math.min(x0, w.px); x1 = Math.max(x1, w.px); } }
  if (!n) return;
  bnPlFx(P, 'impact_ring', xs / n, ys / n - P.L.sh * 0.4, { size: Math.max(P.L.sh * 1.4, (x1 - x0) + P.L.colW), dur: 0.5, delay: delay || 0 });
}
function bnPlIsMelee(v, sk) {
  var k = sk ? sk.kind : '';
  if (v.troop === '弓' || v.troop === '謀') return false;
  if (!sk) return true;
  return k === 'atk_single' || k === 'atk_exec' || k === 'atk_multi' || k === 'stun' || k === 'atk_pierce' || k === 'atk_cross' || k === 'atk_snipe' || k === 'atk_back' || k === 'lifesteal' || k === 'execute_chain';   // 近戰兵種的單體類主動 / 追擊:前衝到目標身上打
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
  if (k.indexOf('buff') === 0 || k === 'rate_up' || k === 'cleanse' || k === 'invert') return { n: 'morale_burst', s: 0.9 };
  if (k === 'dot_poison') return { n: 'poison_mist', s: 1 };
  if (k === 'dot_burn') return { n: 'fire_s', s: 1 };
  if (k === 'stun' || k === 'silence' || k === 'fear' || k === 'taunt') return { n: 'impact_ring', s: 0.9 };
  if (k === 'atk_pierce') return { n: 'slash_h', s: 1.1 };
  if (k === 'atk_cross') return { n: 'slash_x', s: 1 };
  if (k === 'atk_multi') return { n: 'slash_d', s: 0.9 };
  if (k === 'atk_all') return { n: 'bolt_fork', s: 1.2 };
  if (k === 'atk_front') return { n: 'slash_h', s: 1.2 };
  if (k.indexOf('debuff') === 0 || k === 'mark' || k === 'rate_down' || k === 'buff_steal' || k === 'wx_mark') return { n: 'spark', s: 1 };
  return { n: 'slash_d', s: 1 };
}
function bnPlHitFx(P, vt, e, first) {
  var c = bnPlCenter(vt), sk = P.sk, f, s = P.L.sh;
  if (!sk || e.basic) {
    f = e.ty === 'strat' ? { n: 'bolt', s: 0.9 } : (e.crit ? { n: 'slash_x', s: 1 } : { n: 'slash_d', s: 0.85 });
    if (vt.troop === '盾' && !e.crit) f = { n: 'impact_ring', s: 0.7 };
  } else f = bnPlFxFor(sk, !first);
  if (!(sk && !e.basic && bnPlSigHit(P, vt, sk, c, s, f))) bnPlFx(P, f.n, c.x, c.y, { size: s * 0.8 * f.s, dur: 0.38, rot: (vt.id * 0.7) % 3 - 1.2 });
  if (sk && !e.basic && sk.theme && BN_FX_THEME[sk.theme]) bnPlThemeHit(P, vt, sk);
}
// 文化主題:命中特效(五行 = 施放者屬性;其餘依主題)
function bnPlThemeHit(P, vt, sk) {
  var T = BN_FX_THEME[sk.theme], c = bnPlCenter(vt), u = P.S.units[sk.u], file = T.hit;
  if (!file) return;
  if (file === 'wx') file = u && BN_FX_WX[u.el] ? BN_FX_WX[u.el] : 'fxc_wx_disc';
  bnPlFx(P, file, c.x, c.y, { file: file, alt: T.alt, mode: 7, size: P.L.sh * 0.9, dur: 0.5 });
}
// 文化主題施放特效 + 輔助虛影 + 主角專屬(skill / ult 事件時呼叫)
function bnPlThemeCast(P, v, e) {
  var d = (typeof BN_SKILLS !== 'undefined') ? BN_SKILLS[e.id] : null, th = e.th || (d && d.theme) || '', T = BN_FX_THEME[th], c = bnPlCenter(v), L = P.L, g = BN_FX_GHOST[e.id];
  if (g) bnPlFx(P, g, v.px + (v.side === 'A' ? -1 : 1) * L.colW * 0.25, v.py - L.sh * 0.55, { file: g, alt: 'morale_burst', mode: 6, size: L.sh * 1.25, dur: 0.9 });
  if (T && T.cast) bnPlFx(P, T.cast, c.x, c.y - L.sh * 0.15, { file: T.cast, alt: T.alt, mode: 7, size: L.sh * 1.05, dur: 0.6, delay: BNPL_POSE.delay * bnPlStK(P) });   // 施法姿勢之後才出特效
}
function bnPlHeroFx(P, v, id) {
  var file = BN_FX_HERO[id], L = P.L, side, xs = 0, n = 0, k, w;
  if (!file || !v) return;
  side = v.side === 'A' ? 'B' : 'A';
  for (k in P.vu) { w = P.vu[k]; if (w.side === side && w.alive) { xs += w.px; n++; } }
  bnPlFx(P, file, n ? xs / n : L.vw / 2, L.top + (L.vh - L.top - L.bot) * 0.5, { file: file, alt: 'bolt_fork', mode: 7, size: Math.min(L.vw * 0.5, L.sh * 2.4), dur: 1.0, delay: 0.1 });
}
function bnPlProj(P, vs, vt, e, delay) {
  var a = bnPlCenter(vs), b = bnPlCenter(vt), L = P.L;
  if (vs.troop === '弓') bnPlFx(P, 'arrow', a.x, a.y, { x2: b.x, y2: b.y, mode: 1, dur: delay, size: L.sh * 0.3, col: '#ffe9a8' });
  else bnPlFx(P, 'orb', a.x, a.y, { x2: b.x, y2: b.y, mode: 2, dur: delay, size: L.sh * 0.22, col: BN_TONE_COL[P.sk ? bnPlTone(P.sk.id) : 'common'] });
}

// ───────── 事件處理:回等待秒數 ─────────
function bnPlHit(P, e, vt) {
  var abs = e.abs | 0, v = e.v | 0, L = P.L, ty = e.ty, col;
  if (v > 0) { vt.hpLag = Math.max(vt.hpLag, vt.hpShow, vt.hp); vt.lagHold = 0.4; vt.hitGlow = 1; }   // 殘影:舊血量淡紅段停 0.4 秒再縮;血條短暫加亮
  vt.hp = e.hp;
  if (abs > 0) { vt.shield = Math.max(0, vt.shield - abs); if (v <= 0) bnPlText(P, vt, '盾 -' + abs, '#8ec7ff', 1, 0, 0.8); else bnPlText(P, vt, '-' + abs, '#8ec7ff', 0.8, 0, 0.7, -L.colW * 0.3); bnPlSfx(P, 'block'); }
  if (v > 0) {
    col = BN_NUM_DMG;   // 扣血一律紅字黑框(攻擊 / 謀略 / 持續傷害皆同);暴擊更大(浮字放大彈出 + 畫面微震 + 火花)
    if (e.crit) { bnPlText(P, vt, '-' + v + '!', BN_NUM_DMG, 1.4, 1, 0.95); P.shake = 0.16; bnPlBurst(P, vt, 'crit'); }
    else bnPlText(P, vt, '-' + v, col, 1, 0, 0.8);
    if (ty !== 'dot') { vt.flash = 1; vt.kb = 1; bnPlSfx(P, e.crit ? 'crit' : 'hit'); }
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
      bnPlSfx(P, BN_ATK_SFX[vs.troop] || 'atk_blade');   // 出手音依兵種:盾刀、步槍、騎、弓、謀略
    } else if (vs) {
      delay = BNPL_T.skillHit; wait = BNPL_T.skillWait;
      if (sk && (sk.kind === 'atk_all' || sk.kind === 'dot_spread')) bnPlAreaFx(P, vt.side, delay);   // 全體:整個敵陣標一圈範圍(稍延遲)
      if (bnPlIsMelee(vs, sk)) bnPlStartLunge(P, vs, vt, 0.5); else if (sk && (sk.kind === 'atk_back' || sk.kind === 'atk_snipe' || vs.troop === '弓' || vs.troop === '謀')) bnPlProj(P, vs, vt, e, delay);
      bnPlSfx(P, BN_ATK_SFX[vs.troop] || 'atk_blade');
    }
  }
  if (e.ctr && vs) { bnPlStartLunge(P, vs, vt, 0.4); }
  vt.hitAt = P.clock + delay;
  if (P.uh && P.uh.src === e.src && !dot && !self && !basic) bnUltHit(P, vt, e, delay);   // 大招:該受害者的落點演出(峰值 = 命中刻)
  if (delay <= 0) bnPlHit(P, e, vt);
  else bnPlAt(P, delay, function () { if (!P.skipped) { bnPlHit(P, e, vt); if (!dot && !self) bnPlHitFx(P, vt, e, first); } });
  return wait;
}
function bnPlStatus(P, e) {
  var v = P.vu[e.tgt], nm = BN_ST_NAME[e.id], good = BN_ST_GOOD[e.id];
  if (!v) return 0;
  v.st[e.id] = 1;
  if (e.id === 'shield') return 0;
  if (v.stp) v.stp[e.id] = 1;   // 狀態圖示彈出
  if (nm && e.id !== 'ccimm') { bnPlStPop(P, v, e.id); bnPlBurst(P, v, good ? 'buff' : 'debuff'); bnPlSfx(P, good ? 'buff' : 'debuff', { uid: e.tgt, st: e.id, ult: P.ultOn ? 1 : 0 }); }   // 狀態音:大招期間或該單位第一次被施加此狀態才播(bnsfx.js 閘門)
  return BNPL_T.status;
}
// 狀態浮字:「+中毒」「−防禦」…;同一人連續被施加時排隊(間隔 BNST_POP.gap)、水平錯開,小字快速淡出。
// 時間用「模擬秒」:倍速時依 bnPlStK 拉長,實際停留不會閃一下就沒
// 配色(使用者定案):增益 = 金色「+名」、減益 = 紫色「−名」,與傷害紅字 / 治療綠字分開;比數字小一號、飄得更短更快,一律黑色描邊
var BNST_POP = { dur: 0.6, gap: 0.12, size: 0.8, good: '#ffd75a', bad: '#c890ff' };
var BN_ST_POP = {
  atk_up: '攻擊提升', def_up: '防禦提升', spd_up: '速度提升', crit_up: '暴擊提升', atk_down: '攻擊', def_down: '防禦', spd_down: '速度',
  stun: '暈眩', fear: '威懾', confuse: '擾亂', timid: '怯戰', silence: '計窮', ult_lock: '封大招', mark: '標記', burn: '燃燒', poison: '中毒', bleed: '流血', heal_reduce: '禁療',
  taunt: '嘲諷', guard: '援護', evade: '規避', ward: '抵禦', heal_hot: '回春', amp_atk: '增傷', shield: '護盾', rate_up: '發動率', rate_down: '發動率', debuff_hit: '命中', wx_mark: '五行印', stealth: '隱匿', undying: '不倒'
};
function bnPlStK(P) { var s = P.speed || 1; return s <= 1 ? 1 : 1 + (s - 1) * 0.6; }   // 3× → 2.2 倍模擬秒 ≈ 實際 0.44 秒
function bnPlStPopTxt(id) { var nm = BN_ST_POP[id] || BN_ST_NAME[id] || ''; return nm ? (BN_ST_GOOD[id] ? '+' : '−') + nm : ''; }
function bnPlStPop(P, v, id) {
  var txt = bnPlStPopTxt(id), good = !!BN_ST_GOOD[id], k = bnPlStK(P), at, d, slot;
  if (!txt) return;
  at = Math.max(P.clock, v.stNext || 0);
  v.stNext = at + BNST_POP.gap * k;
  slot = (v.stN = ((v.stN || 0) + 1) % 3);
  d = at - P.clock;
  function go() {   // 同一人仍在畫面上的狀態字往上疊一格(最多 4 格),左右輕微交錯
    var lane = 0, up, i, n, lh = Math.max(BN_NUM_MIN * 0.9, P.L.fs * 1.25) * BNST_POP.size + 3;
    if (P.skipped) return;
    for (i = 0; i < P.nums.length; i++) if (P.nums[i].on && P.nums[i].kind === 2 && P.nums[i].uid === v.id && P.nums[i].st) lane++;
    n = bnPlText(P, v, txt, good ? BNST_POP.good : BNST_POP.bad, BNST_POP.size, 2, BNST_POP.dur, (slot - 1) * P.L.colW * 0.12);   // bnPlText 已依倍速拉長
    n.st = 1;
    up = Math.max(0, Math.floor((n.y - 12) / lh));   // 上方剩幾格(橫式第一列很靠頂):放不下就改排到左右兩側
    lane = Math.min(3, lane);
    if (lane <= up) n.y -= lane * lh;
    else { n.y -= ((lane - up - 1) % (up + 1)) * lh; n.x += (Math.floor((lane - up - 1) / (up + 1)) % 2 ? -1 : 1) * P.L.colW * 0.55; }
  }
  if (d <= 0) go(); else bnPlAt(P, d, go);
}
function bnPlKill(P, e) {
  var v = P.vu[e.tgt], d;
  if (!v) return 0;
  d = Math.max(0, v.hitAt - P.clock) + BNPL_T.killDelay;
  bnPlAt(P, d, function () { v.dying = 0; v.alive = false; v.st = {}; v.stp = {}; v.shield = 0; if (!P.skipped) bnPlSfx(P, 'kill'); });
  return 0;
}
function bnPlCutin(P, e) {
  var u = P.S.units[e.u], v = P.vu[e.u], tone = bnPlTone(e.id), d = (typeof BN_SKILLS !== 'undefined') ? BN_SKILLS[e.id] : null, full = false, dur;
  if (!v) return 0;
  full = !!v.fig && !P.ultSeen[e.u] && !P.ps && P.speed < 4;
  P.ultSeen[e.u] = true;
  P.noScene = false;
  v.tone = tone;
  dur = (full ? BNPL_T.cutFull : BNPL_T.cutSmall) * bnPlStK(P);   // 倍速時 cut-in 不縮成一閃(3× 實際約 0.7 秒)
  P.cut = { full: full, t: 0, dur: dur, side: v.side, name: v.name, fig: v.fig, skill: d ? d.name : '', tone: tone, uid: e.u, path: v.look.paths[0], big: !!v.fig };
  if (!full) { bnPlFx(P, 'morale_burst', v.px, v.py - P.L.sh * 0.5, { size: P.L.sh * 1.3, dur: 0.5, delay: 0 }); bnPlLabel(P, v, '大招·' + (d ? d.name : ''), bnPlSkShort(e.id)); }
  bnPlHeroFx(P, v, e.id);
  bnPlSfx(P, 'ult');
  bnPlHook(P, 'cut', P.cut);
  return dur;
}
function bnPlEvent(P, e) {
  var v, t = BNPL_T, c, L = P.L, i, w = 0;
  P.nev++;
  switch (e.t) {
    case 'init':
      for (i = 0; i < e.units.length; i++) { v = P.vu[e.units[i].id]; if (v) { v.hp = e.units[i].hp; v.mx = e.units[i].mx; v.hpShow = v.hp; } }
      return 0;
    case 'round':
      P.round = e.n; P.chainN = 0; P.ultOn = false;
      P.banner = { text: '第 ' + e.n + ' 回合' + (e.fat ? ' · 疲兵' + e.fat : ''), t: 0, dur: 0.9, big: true };
      if (e.n === 1) bnPlSfx(P, 'drum');
      bnPlHook(P, 'round', e.n);
      bnPlHook(P, 'order', -1, bnPlPredict(P.S, 6));
      return t.round;
    case 'act':
      bnPlFeedFlush(P);
      P.actor = e.u; P.hitN = 0; P.sk = null; P.chainN = 0; P.ultOn = false; P.uh = null;
      bnPlHook(P, 'order', e.u, bnPlPredict(P.S, 5));
      return t.act;
    case 'skip':
      v = P.vu[e.u];
      if (v) bnPlText(P, v, e.why === 'stun' ? '暈眩!' : (e.why === 'fear' ? '威懾!' : (e.why === 'retreat' ? '退場' : '中伏')), '#ff9a8a', 1, 2, 0.8);
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
      P.ultOn = true;   // 大招期間(到下一次 act 為止)
      return bnPlCutin(P, e);
    case 'skill': {
      v = P.vu[e.u];
      P.sk = { id: e.id, kind: e.kind, cat: e.cat, tags: (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[e.id] && BN_SKILLS[e.id].tags) || [], name: e.name, theme: e.th || (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[e.id] && BN_SKILLS[e.id].theme) || '', u: e.u };
      if (!v) return 0;
      v.cast = 1;
      if (e.cat !== 'ult') bnPlLabel(P, v, (e.rc ? '再放·' : (e.as !== undefined ? '補刀·' : '')) + (e.name || ''), bnPlSkShort(e.id));   // 技能名 → 己方天空角落標籤(下附白話效果)
      bnPlFeedStart(P, e);
      if (/^(heal|shield|buff|rate_up|cleanse|revive|guard|evade|reorder|taunt)/.test(e.kind || '')) { c = bnPlCenter(v); bnPlFx(P, 'morale_burst', c.x, c.y, { size: L.sh * 0.9, dur: 0.4, delay: BNPL_POSE.delay * bnPlStK(P) }); }
      bnPlThemeCast(P, v, e); bnPlSigCast(P, v, e);
      if (e.cat === 'ult') bnPlUltScene(P, v, e.id); else P.uh = null;
      if (P.sk.tags.indexOf('charge') >= 0) { bnPlFx(P, 'dust', v.px, v.py - L.sh * 0.1, { size: L.sh * 0.7, dur: 0.5 }); }
      return e.cat === 'ult' ? 0.12 : t.cast;
    }
    case 'dmg': bnPlFeedHit(P, e, false); return bnPlDmg(P, e);
    case 'evade':
      v = P.vu[e.tgt]; if (v) { bnPlText(P, v, e.miss ? '落空' : '閃避', '#cfe8ff', 0.9, 2, 0.7); v.ev = 1; bnPlSfx(P, 'evade'); }
      return t.status;
    case 'heal': {
      bnPlFeedHit(P, e, true);
      v = P.vu[e.tgt];
      if (!v) return 0;
      v.hp = e.hp;
      if (e.v > 0) { bnPlText(P, v, '+' + e.v, BN_NUM_HEAL, 1, 0, 0.85); c = bnPlCenter(v); bnPlFx(P, P.sk && P.sk.kind === 'heal_all' ? 'heal_motes' : 'heal_pillar', c.x, c.y, { size: L.sh * 0.9, dur: 0.5 }); bnPlBurst(P, v, 'heal'); bnPlSfx(P, 'heal'); }
      return P.hitN++ === 0 ? t.heal : t.healMore;
    }
    case 'shield':
      v = P.vu[e.tgt];
      if (!v) return 0;
      v.shield = e.tot; v.st.shield = 1;
      bnPlText(P, v, '盾 +' + e.v, '#8ec7ff', 0.95, 0, 0.85);
      c = bnPlCenter(v); bnPlFx(P, 'shield_dome', c.x, c.y, { size: L.sh * 1.0, dur: 0.5 }); bnPlBurst(P, v, 'shield'); bnPlSfx(P, 'shield');
      if (v.stp) v.stp.shield = 1;
      return P.hitN++ === 0 ? t.heal : t.healMore;
    case 'revive':
      v = P.vu[e.tgt];
      if (v) { v.alive = true; v.dying = -1; v.fade = 0; v.rot = 0; v.hp = e.hp; bnPlText(P, v, '復活', '#8ff0a0', 1.1, 2, 0.9); c = bnPlCenter(v); bnPlFx(P, 'heal_pillar', c.x, c.y, { size: L.sh * 1.1, dur: 0.6 }); bnPlBurst(P, v, 'heal'); bnPlSfx(P, 'heal'); }
      return t.heal;
    case 'status': return bnPlStatus(P, e);
    case 'unstatus':
      v = P.vu[e.tgt];
      if (v) { delete v.st[e.id]; if (e.id === 'shield') v.shield = 0; if (e.why === 'cleanse' && (e.id === 'poison' || e.id === 'heal_reduce')) { c = bnPlCenter(v); bnPlFx(P, 'stc_herb_detox', c.x, c.y - L.sh * 0.35, { file: 'stc_herb_detox', alt: 'heal_motes', mode: 7, size: L.sh * 0.45, dur: 0.6 }); } }
      return 0;
    case 'resist': case 'immune': case 'ccimm':
      v = P.vu[e.tgt]; if (v) bnPlText(P, v, e.t === 'resist' ? '抵禦' : '免疫', '#cfe8ff', 0.75, 2, 0.7);
      return 0.1;
    case 'kill': return bnPlKill(P, e);
    case 'move':
      v = P.vu[e.u];
      if (v) { v.row = e.row; v.col = e.col; c = L.pos[v.side][e.row][e.col]; v.tx = c.x; v.ty = c.y; }
      return 0.3;
    case 'react':
      v = P.vu[e.tgt]; if (v) bnPlText(P, v, e.name || '連環', '#ffb36a', 0.9, 2, 0.8);
      if (v && e.id === 'rx_invert') { c = bnPlCenter(v); bnPlFx(P, 'stc_yinyang_flip', c.x, c.y, { file: 'fxc_yy_flip', alt: 'morale_burst', mode: 7, size: L.sh * 0.9, dur: 0.55 }); }
      if (v && BN_FX_RX[e.id]) { c = bnPlCenter(v); bnPlFx(P, BN_FX_RX[e.id].file, c.x, c.y, { file: BN_FX_RX[e.id].file, alt: BN_FX_RX[e.id].alt, mode: 7, size: L.sh * 0.95, dur: 0.5 }); }   // 魔幻反應:冰裂 / 感電(缺圖退回 fx_*)
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
      bnPlFeedFlush(P);
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

// 施法姿勢(v.cast 1 → 0,約 0.32 模擬秒):弓兵後拉弓(身體後仰、往後縮)、謀士舉手 / 舉杖 / 揮扇(上抬拉長 + 左右擺)、近戰蓄勢(下蹲壓扁、前傾);
// 只動位移 / 縮放 / 傾斜,不需素材;省電模式只留輕微上下位移。範圍不超過半格,不遮血條
var BNPL_POSE = { delay: 0.15 };   // 戰法特效在姿勢之後出現(模擬秒;倍速再乘 bnPlStK)
function bnPlPose(P, v) {
  var c = v.cast, d = v.side === 'A' ? 1 : -1, k = Math.sin(Math.min(1, c) * 3.1416 * 0.5), L = P.L;
  if (P.ps) { v.dy -= L.sh * 0.03 * k; return; }
  if (v.troop === '弓') { v.dx -= d * L.colW * 0.07 * k; v.lean -= 0.5 * k; v.sx *= 1 - 0.04 * k; }
  else if (v.troop === '謀') { v.dy -= L.sh * 0.06 * k; v.sy *= 1 + 0.06 * k; v.lean += Math.sin(c * 12) * 0.25 * k; }
  else { v.sy *= 1 - 0.07 * k; v.sx *= 1 + 0.05 * k; v.lean += 0.45 * k; v.dx -= d * L.colW * 0.03 * k; }
}
// ───────── 推進 ─────────
function bnPlAnim(P, dt) {
  var id, v, n, f, i, l, tm, k, dv = dt / bnPlStK(P), pt = P.pt;   // dv = 視覺秒(倍速時較慢,短動畫不一閃即逝)
  for (id in P.vu) {
    v = P.vu[id];
    if (v.px !== v.tx || v.py !== v.ty) {
      v.px += (v.tx - v.px) * Math.min(1, dt * 9); v.py += (v.ty - v.py) * Math.min(1, dt * 9);
      if (Math.abs(v.tx - v.px) < 0.4 && Math.abs(v.ty - v.py) < 0.4) { v.px = v.tx; v.py = v.ty; }
    }
    v.hpShow += (v.hp - v.hpShow) * Math.min(1, dt * 8);
    if (Math.abs(v.hp - v.hpShow) < 0.5) v.hpShow = v.hp;
    if (v.lagHold > 0) v.lagHold = Math.max(0, v.lagHold - dt);
    else if (v.hpLag > v.hpShow) { v.hpLag += (v.hpShow - v.hpLag) * Math.min(1, dt * 2.2); if (v.hpLag - v.hpShow < 0.5) v.hpLag = v.hpShow; }
    if (v.hpLag < v.hpShow) v.hpLag = v.hpShow;
    if (v.hitGlow > 0) v.hitGlow = Math.max(0, v.hitGlow - dt / 0.35);
    if (v.flash > 0) v.flash = Math.max(0, v.flash - dv / 0.2);
    if (v.kb > 0) v.kb = Math.max(0, v.kb - dv / 0.25);
    if (v.ev > 0) v.ev = Math.max(0, v.ev - dv / 0.3);
    if (v.cast > 0) v.cast = Math.max(0, v.cast - dt / 0.32);
    if (v.stp) for (k in v.stp) { v.stp[k] -= dv / 0.3; if (v.stp[k] <= 0) delete v.stp[k]; }
    v.dx = 0; v.dy = 0; v.scale = 1; v.sx = 1; v.sy = 1; v.lean = 0;
    l = v.lunge;
    if (l) {
      l.t += dt;
      i = l.t / l.dur;
      if (i >= 1) v.lunge = null;
      else {
        n = i < 0.4 ? i / 0.4 : (i < 0.55 ? 1 : 1 - (i - 0.55) / 0.45);
        n = n * n * (3 - 2 * n);
        v.dx = l.tx * 0.38 * n; v.dy = l.ty * 0.38 * n;
        if (i < 0.12) { v.dx -= l.tx * 0.04 * (i / 0.12); }   // 出手前微微後拉(蓄勢)
        v.sx = 1 + 0.12 * n * (i < 0.4 ? 1 : -0.6); v.sy = 1 - 0.07 * n * (i < 0.4 ? 1 : -0.6);
        v.lean = n;   // 前傾
      }
    }
    if (v.cast > 0 && !v.lunge) bnPlPose(P, v);
    if (v.kb > 0) { v.dx += (v.side === 'A' ? -1 : 1) * v.kb * P.L.colW * 0.1; }
    if (v.ev > 0) { v.dx += (v.side === 'A' ? -1 : 1) * Math.sin(v.ev * 3.1416) * P.L.colW * 0.18; v.dy -= Math.sin(v.ev * 3.1416) * P.L.sh * 0.04; }   // 閃避:側身後閃再回位
    if (v.dying >= 0) {
      v.dying += dv;
      i = Math.min(1, v.dying / BNPL_T.dying);
      v.rot = i * 1.22 * (v.side === 'A' ? -1 : 1); v.fade = 1 - i; v.dy += i * P.L.sh * 0.06;   // 倒下:側倒、下沉、淡出
    } else if (v.fade < 1) v.fade = Math.min(1, v.fade + dt * 3);
  }
  if (pt) for (i = 0; i < pt.length; i++) {
    f = pt[i];
    if (!f.on) continue;
    f.t += dv;
    if (f.t < 0) continue;
    f.x += f.vx * dv; f.y += f.vy * dv; f.vy += f.g * dv;
    if (f.t >= f.dur) f.on = false;
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
  bnPlLabAnim(P, dt);
  if (P.shake > 0) P.shake = Math.max(0, P.shake - dv);
  if (P.cut) {
    P.cut.t += dt;
    if (P.cut.t >= P.cut.dur) { P.cut = null; bnPlHook(P, 'cut', null); } else bnPlHook(P, 'cut', P.cut);
  }
  tm = P.tm;
  while (tm.length && tm[0].t <= P.clock) { f = tm.shift(); f.fn(); }
}
// 推進 dt 秒(實際秒;內部乘倍速)。回是否仍在播放
function bnPlTick(P, dtReal) {
  var dt = Math.min(0.1, Math.max(0, dtReal)) * P.speed * BNPL_PACE, guard = 0, e, S = P.S, n0;
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
// 點擊跳過大招 cut-in:只收掉演出並把等待歸零,戰鬥事件與戰報照常;回是否有跳過
function bnPlCutSkip(P) {
  if (!P || P.done || !P.cut) return false;
  P.cut = null;
  P.noScene = true;   // 點擊跳過大招特寫:整段全螢幕演出也不播
  if (P.wait > 0) P.wait = 0;
  bnPlHook(P, 'cut', null);
  return true;
}
// 略過:直接算到終局並把視覺調成終局狀態
function bnPlSkip(P) {
  var S = P.S, id, v, u, i;
  if (P.done) return;
  P.skipped = true;
  if (!S.over) bnRunToEnd(S);
  P.ei = S.events.length; P.tm = []; P.cut = null; P.banner = null; P.lab = { A: { cur: null, q: [] }, B: { cur: null, q: [] } }; bnPlHook(P, 'cut', null);
  for (i = 0; i < P.nums.length; i++) P.nums[i].on = false;
  for (i = 0; i < P.fx.length; i++) P.fx[i].on = false;
  for (i = 0; i < (P.pt || []).length; i++) P.pt[i].on = false;
  P.shake = 0;
  for (id in P.vu) {
    v = P.vu[id]; u = S.units[id];
    v.hp = u.hp; v.hpShow = u.hp; v.hpLag = u.hp; v.lagHold = 0; v.hitGlow = 0; v.alive = u.alive; v.lunge = null; v.flash = 0; v.kb = 0; v.cast = 0; v.st = {}; v.shield = 0; v.lean = 0; v.ev = 0; v.stp = {};
    v.dying = u.alive ? -1 : 2; v.fade = u.alive ? 1 : 0; v.rot = u.alive ? 0 : 1.22 * (v.side === 'A' ? -1 : 1);
    if (u.alive) { Object.keys(u.st || {}).forEach(function (k) { v.st[k] = 1; }); if (u.st && u.st.shield) v.shield = u.st.shield.val; }
  }
  P.endEv = S.events[S.events.length - 1];
  bnPlFinish(P);
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
// 待機呼吸:縮放 ±1.5 %、前後輕晃(傾角 + 水平位移);省電模式 / 倒下 = 靜止。寫入 v.ibr / v.itl / v.isw(不配置物件)
function bnDrIdle(P, v, t) {
  if (P.ps || v.dying >= 0 || !v.alive) { v.ibr = 1; v.itl = 0; v.isw = 0; return v; }
  v.ibr = 1 + 0.015 * Math.sin(t * 2.1 + v.phase);
  v.itl = Math.sin(t * 1.5 + v.phase) * 0.026;
  v.isw = Math.sin(t * 1.1 + v.phase * 1.3) * (v.sh || 100) * 0.012;
  return v;
}
function bnDrUnit(ctx, P, v, t, L, pw) {
  var h = L.sh, lk = v.look, i, e, src = null, bust = false, w, dir = v.side === 'A' ? 1 : -1, br, tilt, flashSrc = null, pend = false, tinted, g, stc = '', ov;
  if (v.fade <= 0.01) return;
  bnDrIdle(P, v, t);
  br = v.ibr;
  tilt = v.itl - v.kb * 0.1 * dir + v.lean * 0.14 * dir + v.rot;
  for (i = 0; i < lk.paths.length; i++) {
    e = bnDrImg(lk.paths[i]);
    if (e.ok) { src = e; bust = lk.bust[i]; break; }
    if (!e.fail) { pend = true; break; }
  }
  ctx.save();
  ctx.globalAlpha = v.fade;
  ctx.translate(v.px + v.dx + v.isw * dir, v.py + v.dy);
  // 地面陰影
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath();
  if (ctx.ellipse) ctx.ellipse(0, -2, h * 0.24, h * 0.055, 0, 0, 6.283); else ctx.arc(0, -2, h * 0.2, 0, 6.283);
  ctx.fill();
  ctx.rotate(tilt);
  ctx.scale(dir * v.sx * (1 + (br - 1) * 0.5), v.sy * br * (1 + v.cast * 0.06));
  if (src) {
    if (bust) {
      w = h * 0.7; ctx.drawImage(src.img, -w / 2, -h * 0.78, w, w * bnDrIh(src) / bnDrIw(src));
      if (!P.ps && (stc = bnStTint(v)) && (ov = bnStTinted(src.path, stc, src.img))) ctx.drawImage(ov, -w / 2, -h * 0.78, w, w * bnDrIh(src) / bnDrIw(src));   // 狀態染色(快取)
      if (v.flash > 0) { flashSrc = bnDrWhite(src); if (flashSrc) { ctx.globalAlpha = v.fade * v.flash * 0.85; ctx.drawImage(flashSrc, -w / 2, -h * 0.78, w, w * bnDrIh(src) / bnDrIw(src)); ctx.globalAlpha = v.fade; } }
    } else {
      w = h * bnDrIw(src) / bnDrIh(src);
      tinted = lk.tint ? bnDrTinted(src, lk.tint) : null;
      ctx.drawImage(tinted || src.img, -w / 2, -h, w, h);
      if (!P.ps && (stc = bnStTint(v)) && (ov = bnStTinted(src.path, stc, src.img))) ctx.drawImage(ov, -w / 2, -h, w, h);   // 狀態染色(快取)
      if (v.flash > 0) { flashSrc = bnDrWhite(src); if (flashSrc) { ctx.globalAlpha = v.fade * v.flash * 0.85; ctx.drawImage(flashSrc, -w / 2, -h, w, h); ctx.globalAlpha = v.fade; } }
    }
  } else if (!pend || true) {
    if (!bnDrCrowd(ctx, v, h)) bnDrFallbackBody(ctx, v, h);
    if (v.flash > 0 && (g = bnDrGlow('#ffffff'))) {   // 程式小人沒有剪影:疊一層白光代替閃白
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = v.fade * v.flash * 0.7;
      ctx.drawImage(g, -h * 0.4, -h * 0.95, h * 0.8, h * 0.95);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = v.fade;
    }
  }
  ctx.restore();
}
// 兵力條幾何(測試也用):頭頂上方、不遮臉;粗 7~10px + 黑框
function bnDrBarBox(v, L) {
  var w = Math.max(32, Math.min(L.colW * 0.86, L.sh * 0.72)), bh = Math.max(7, Math.min(10, Math.round(L.sh * 0.075)));
  return { x: v.px + v.dx - w / 2, y: v.py + v.dy - L.sh - bh - 6, w: w, h: bh };
}
function bnDrBars(ctx, P, v, t, L) {
  var bb = bnDrBarBox(v, L), w = bb.w, x = bb.x, y = bb.y, bh = bb.h, hp = Math.max(0, Math.min(1, v.hpShow / v.mx)), lag = Math.max(hp, Math.min(1, (v.hpLag || 0) / v.mx)), keys, n = 0, i, ic, k, sz = Math.max(11, L.fs * 0.95), ex, iy, pp;
  if (v.fade <= 0.05) return;
  ctx.globalAlpha = v.fade;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, w + 4, bh + 4);                         // 黑框
  ctx.fillStyle = 'rgba(70,24,20,.9)'; ctx.fillRect(x, y, w, bh);                              // 空槽
  if (lag > hp) { ctx.fillStyle = 'rgba(255,140,120,.85)'; ctx.fillRect(x + w * hp, y, w * (lag - hp), bh); }   // 殘影(舊血量淡紅段)
  ctx.fillStyle = hp > 0.5 ? '#5ed05e' : (hp > 0.25 ? '#e0b43a' : '#e0503a'); ctx.fillRect(x, y, w * hp, bh);
  if (v.hitGlow > 0) { ctx.globalAlpha = v.fade * v.hitGlow * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w * lag, bh); ctx.globalAlpha = v.fade; ctx.strokeStyle = 'rgba(255,240,200,' + (0.9 * v.hitGlow) + ')'; ctx.lineWidth = 2; ctx.strokeRect(x - 2, y - 2, w + 4, bh + 4); }   // 受擊加亮
  if (v.shield > 0) { ctx.fillStyle = 'rgba(142,199,255,.95)'; ctx.fillRect(x, y, Math.min(w, w * v.shield / v.mx), 2); }
  keys = Object.keys(v.st); iy = y - sz - 3;
  for (i = 0; i < keys.length && n < 3; i++) {
    k = keys[i]; ic = BN_ST_ICON[k];
    ex = ic ? bnDrImg('assets/bnfx/' + (typeof ic === 'string' && ic.indexOf('stc_') === 0 ? ic : 'st_' + (ic === 1 ? k : ic)) + '.webp') : null;
    pp = v.stp && v.stp[k] > 0 ? v.stp[k] * 0.6 * sz : 0;   // 剛施加:圖示放大後縮回
    if (ex && ex.ok) ctx.drawImage(ex.img, x + n * (sz + 1) - pp / 2, iy - pp / 2, sz + pp, sz + pp);
    else { ctx.fillStyle = BN_ST_GOOD[k] ? '#4a8a4a' : '#9a4a3a'; ctx.fillRect(x + n * (sz + 1), iy, sz, sz); ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(sz * 0.7) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((BN_ST_NAME[k] || k).charAt(0), x + n * (sz + 1) + sz / 2, iy + sz / 2); }
    n++;
  }
  if (keys.length > 3) { ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(sz * 0.7) + 'px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('+' + (keys.length - 3), x + 3 * (sz + 1), iy + sz / 2); }
  ctx.fillStyle = '#f0e6cf'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; ctx.font = Math.round(L.fs * 0.82) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.strokeText(v.name, v.px + v.dx, v.py + v.dy + 2); ctx.fillText(v.name, v.px + v.dx, v.py + v.dy + 2);
  if (v.side === 'A' && P.sb !== false && v.alive) bnDrSkillBar(ctx, P, v, L, v.py + v.dy + 4 + Math.round(L.fs * 0.82));
  ctx.globalAlpha = 1;
}
// 戰法條(我方):名字下方最多 3 個戰法短名;被動 / 指揮淡色,主動 / 追擊 / 大招顯示剩餘冷卻(「火 2」= 還要 2 回合),可用就亮
var BNSB = { n: 3, chars: 2, pas: '#9aa3ad', ready: '#ffe28a', cd: '#8f96a0' };
function bnDrSkillBarItems(P, v) {
  var u = P.S && P.S.units[v.id], out = [], list, i, inst, d, cd, nm;
  if (!u) return out;
  list = u.act.filter(function (x) { return x.def.cat !== 'ult'; }).concat(u.ult ? [u.ult] : []).concat(u.pas);
  for (i = 0; i < list.length && out.length < BNSB.n; i++) {
    inst = list[i]; d = inst.def;
    nm = Array.from(String(d.name || '')).slice(0, BNSB.chars).join('');
    if (d.cat === 'passive' || d.cat === 'command') { out.push({ id: d.id, t: nm, cd: 0, pas: 1 }); continue; }
    cd = inst.cd | 0;
    if (d.cat === 'ult' && P.S.round < BN_DATA.rate.ultFrom) cd = Math.max(cd, BN_DATA.rate.ultFrom - Math.max(1, P.S.round));
    out.push({ id: d.id, t: nm + (cd > 0 ? ' ' + cd : ''), cd: cd, pas: 0 });
  }
  return out;
}
function bnDrSkillBar(ctx, P, v, L, y) {
  var it = bnDrSkillBarItems(P, v), fz = Math.max(9, Math.round(L.fs * 0.62)), gap = 4, w = 0, maxW = L.colW * 0.92, x, i, ws = [];
  if (!it.length) return;
  ctx.font = fz + 'px sans-serif';
  for (i = 0; i < it.length; i++) { ws.push(ctx.measureText(it[i].t).width); w += ws[i] + (i ? gap : 0); }
  if (w > maxW) { fz = Math.max(8, Math.floor(fz * maxW / w)); ctx.font = fz + 'px sans-serif'; w = 0; ws = []; for (i = 0; i < it.length; i++) { ws.push(ctx.measureText(it[i].t).width); w += ws[i] + (i ? gap : 0); } }
  while (w > maxW && it.length > 1) { w -= ws.pop() + gap; it.pop(); }   // 最小字級仍太寬:少顯示一項,避免和隔壁單位疊字
  x = Math.max(2, Math.min(L.vw - w - 2, v.px + v.dx - w / 2));   // 不出畫面
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.75)';
  for (i = 0; i < it.length; i++) {
    ctx.fillStyle = it[i].pas ? BNSB.pas : (it[i].cd > 0 ? BNSB.cd : BNSB.ready);
    ctx.strokeText(it[i].t, x, y); ctx.fillText(it[i].t, x, y);
    x += ws[i] + gap;
  }
}
// ───────── 持續狀態附體(程式繪製,不需素材)─────────
// 狀態 id(v.st 的 key,來自 status 事件)→ 視覺:fx 附體樣式、col 色、tint 身體染色(有色才染,快取)。
// 粒子:每幀總數 ≤ BN_ST_BUDGET(40;低階機 20),每單位最多 2 種;省電全關;死亡 / 倒下 / 淡出中不畫(狀態表本身於 unstatus / kill 清除)。
// 缺對映的 id 直接略過。寒凍(chill)需引擎在 status 事件帶 ice 旗標,目前事件不帶,故此項暫不會出現。
var BN_ST_VIS = {
  poison: { fx: 'bubble', col: '#b6f57a', tint: '#7fd04a' },   // 中毒:身體偏綠 + 冒綠泡
  burn: { fx: 'flame', col: '#ff8a3a' },                        // 燃燒:身上掛火苗
  chill: { fx: 'ice', col: '#dff4ff', tint: '#8fc8ff' },        // 寒凍:偏藍 + 冰晶(待 ice 旗標)
  paralyze: { fx: 'arc', col: '#9ad0ff' },                      // 麻痺:電流在身上傳導跑動
  stun: { fx: 'star', col: '#ffe27a' },                         // 暈眩:頭頂旋轉星星
  sleep: { fx: 'zzz', col: '#cfd8ff' },                         // 睡眠:頭上飄 Z z z
  silence: { fx: 'seal', col: '#b8a0ff' },                      // 封技(計窮 / 沉默)
  ult_lock: { fx: 'seal', col: '#ff7a7a' },                     // 封大招
  fear: { fx: 'sweat', col: '#9ad0ff' },                        // 恐懼(威懾):冷汗
  bleed: { fx: 'drip', col: '#e0302a' },                        // 流血:滴血
  confuse: { fx: 'heart', col: '#ff9ad0' },                     // 擾亂 / 魅惑:粉色繞心
  timid: { fx: 'rope', col: '#c8b890' },                        // 怯戰 / 定身(bind 別名):腳下束縛圈
};
(function () {   // 增益 / 減益圈(金色上升 / 紫色下落)
  var g = ['atk_up', 'def_up', 'spd_up', 'crit_up', 'rate_up', 'evade', 'ward', 'guard', 'taunt', 'heal_hot', 'undying', 'stealth', 'amp_atk'], b = ['atk_down', 'def_down', 'spd_down', 'rate_down', 'debuff_hit', 'mark', 'wx_mark', 'heal_reduce'], i;
  for (i = 0; i < g.length; i++) BN_ST_VIS[g[i]] = { fx: 'buff', col: '#ffd75a' };
  for (i = 0; i < b.length; i++) BN_ST_VIS[b[i]] = { fx: 'debuff', col: '#c890ff' };
})();
var BN_ST_CACHE = { n: 0, max: 24, map: {} };   // 身體染色快取(上限 24 張,超過就不染色,不報錯)
var BN_ST_BUDGET = 40;                          // 附體粒子每幀上限(低階機減半)
function bnStTint(v) {
  var k, d;
  if (!v || !v.alive || v.dying >= 0 || v.fade < 0.5 || !v.st) return '';
  for (k in v.st) { d = BN_ST_VIS.hasOwnProperty(k) ? BN_ST_VIS[k] : null; if (d && d.tint) return d.tint; }
  return '';
}
function bnStTinted(path, col, img) {
  var k = path + '|' + col, C = BN_ST_CACHE, w, h, cv, c;
  if (!col || !img) return null;
  if (C.map[k]) return C.map[k];
  if (C.n >= C.max) return null;
  w = img.naturalWidth || img.width || 64; h = img.naturalHeight || img.height || 64;
  cv = bnDrNew(w, h); c = cv ? cv.getContext('2d') : null;
  if (!c) return null;
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.35; c.fillStyle = col; c.fillRect(0, 0, w, h);
  C.map[k] = cv; C.n++;
  return cv;
}
function bnStPart(sb) { if (sb.n >= sb.max) return false; sb.n++; return true; }
var BN_ST_FX = {
  bubble: function (ctx, d, x, y0, h, t, v, sb) {
    var i, p, bx, by, r;
    for (i = 0; i < 4 && bnStPart(sb); i++) {
      p = (t * 0.7 + i * 0.25 + v.phase * 0.1) % 1; bx = x + Math.sin(i * 2.3 + v.phase) * h * 0.18; by = y0 - h * 0.15 - p * h * 0.75; r = h * (0.02 + 0.01 * Math.sin(i + t * 4));
      ctx.globalAlpha = 0.85 * (1 - p); ctx.strokeStyle = d.col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(bx, by, r, 0, 6.2832); ctx.stroke();
    }
  },
  flame: function (ctx, d, x, y0, h, t, v, sb) {
    var i, px, base, tip, hw = h * 0.05, fl;
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = d.col; ctx.globalAlpha = 0.8;
    for (i = 0; i < 4 && bnStPart(sb); i++) {
      px = x + (i - 1.5) * h * 0.14; base = y0 - h * (0.3 + 0.12 * (i % 2)); fl = Math.sin(t * 14 + i * 1.7); tip = base - h * (0.22 + 0.06 * fl);
      ctx.beginPath(); ctx.moveTo(px - hw, base); ctx.quadraticCurveTo(px - hw, (base + tip) / 2, px + fl * h * 0.02, tip); ctx.quadraticCurveTo(px + hw, (base + tip) / 2, px + hw, base); ctx.fill();
    }
  },
  ice: function (ctx, d, x, y0, h, t, v, sb) {
    var i, a, cx, cy, s = h * 0.035;
    ctx.fillStyle = d.col; ctx.strokeStyle = '#4a7aa8'; ctx.lineWidth = 1; ctx.globalAlpha = 0.9;
    for (i = 0; i < 3 && bnStPart(sb); i++) {
      a = i * 2.094 + t * 0.6; cx = x + Math.cos(a) * h * 0.24; cy = y0 - h * 0.5 + Math.sin(a) * h * 0.4;
      ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s * 0.6, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  },
  arc: function (ctx, d, x, y0, h, t, v, sb) {
    var seg = Math.floor(t * 10), j, xx, yy;
    if (!bnStPart(sb)) return;
    ctx.strokeStyle = d.col; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.55 + 0.45 * (seg % 2); ctx.lineJoin = 'round'; ctx.beginPath();
    for (j = 0; j < 6; j++) { yy = y0 - h * (0.1 + 0.14 * j); xx = x + (j % 2 ? 1 : -1) * h * 0.12 * Math.sin(seg * 3.1 + j * 2.2); if (j === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
    ctx.stroke();
  },
  star: function (ctx, d, x, y0, h, t, v, sb) {
    var i, a, sx, sy, s = h * 0.04, hy = y0 - h - 24;
    ctx.strokeStyle = d.col; ctx.lineWidth = 2; ctx.globalAlpha = 0.95;
    for (i = 0; i < 3 && bnStPart(sb); i++) {
      a = t * 4 + i * 2.094; sx = x + Math.cos(a) * h * 0.2; sy = hy + Math.sin(a) * h * 0.05;
      ctx.beginPath(); ctx.moveTo(sx - s, sy); ctx.lineTo(sx + s, sy); ctx.moveTo(sx, sy - s); ctx.lineTo(sx, sy + s); ctx.stroke();
    }
  },
  zzz: function (ctx, d, x, y0, h, t, v, sb) {
    var i, p, zx, zy, sz;
    ctx.fillStyle = d.col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < 3 && bnStPart(sb); i++) {
      p = (t * 0.45 + i / 3) % 1; zx = x + h * 0.14 + p * h * 0.12; zy = y0 - h - 26 - p * h * 0.25; sz = Math.max(9, Math.round(h * (0.1 + 0.06 * p)));
      ctx.globalAlpha = Math.sin(p * 3.1416) * 0.95; ctx.font = 'bold ' + sz + 'px sans-serif'; ctx.fillText('Z', zx, zy);
    }
  },
  seal: function (ctx, d, x, y0, h, t, v, sb) {
    var cx = x, cy = y0 - h * 0.55, r = h * 0.12;
    if (!bnStPart(sb)) return;
    ctx.strokeStyle = d.col; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.moveTo(cx - r * 0.7, cy + r * 0.7); ctx.lineTo(cx + r * 0.7, cy - r * 0.7); ctx.stroke();
  },
  sweat: function (ctx, d, x, y0, h, t, v, sb) {
    var i, p;
    ctx.fillStyle = d.col;
    for (i = 0; i < 2 && bnStPart(sb); i++) {
      p = (t * 0.9 + i * 0.5) % 1; ctx.globalAlpha = 1 - p;
      ctx.beginPath(); ctx.arc(x + (i ? 1 : -1) * h * 0.18, y0 - h * 0.85 + p * h * 0.25, h * 0.022, 0, 6.2832); ctx.fill();
    }
  },
  drip: function (ctx, d, x, y0, h, t, v, sb) {
    var i, p;
    ctx.fillStyle = d.col;
    for (i = 0; i < 3 && bnStPart(sb); i++) {
      p = (t * 0.8 + i / 3) % 1; ctx.globalAlpha = 0.9 * (1 - p * 0.5);
      ctx.beginPath(); ctx.arc(x + (i - 1) * h * 0.12, y0 - h * 0.6 + p * h * 0.5, h * 0.022, 0, 6.2832); ctx.fill();
    }
  },
  heart: function (ctx, d, x, y0, h, t, v, sb) {
    var i, a;
    ctx.fillStyle = d.col; ctx.globalAlpha = 0.9;
    for (i = 0; i < 3 && bnStPart(sb); i++) {
      a = t * 2 + i * 2.094; ctx.beginPath(); ctx.arc(x + Math.cos(a) * h * 0.26, y0 - h * 0.62 + Math.sin(a) * h * 0.08, h * 0.03, 0, 6.2832); ctx.fill();
    }
  },
  rope: function (ctx, d, x, y0, h, t, v, sb) {
    if (!bnStPart(sb)) return;
    ctx.strokeStyle = d.col; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
    if (ctx.setLineDash) ctx.setLineDash([4, 3]);
    ctx.beginPath(); if (ctx.ellipse) ctx.ellipse(x, y0 - 2, h * 0.22, h * 0.05, 0, 0, 6.2832); else ctx.arc(x, y0 - 2, h * 0.2, 0, 6.2832); ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
  },
  buff: function (ctx, d, x, y0, h, t, v, sb) { BN_ST_FX.motes(ctx, d, x, y0, h, t, sb, 1); },
  debuff: function (ctx, d, x, y0, h, t, v, sb) { BN_ST_FX.motes(ctx, d, x, y0, h, t, sb, -1); },
  motes: function (ctx, d, x, y0, h, t, sb, dir) {   // 增益上升(dir 1)/ 減益下落(dir -1)的小點
    var i, p, by;
    ctx.fillStyle = d.col; ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < 3 && bnStPart(sb); i++) {
      p = (t * 0.6 + i / 3) % 1; ctx.globalAlpha = 0.9 * (1 - p);
      by = dir > 0 ? y0 - h * 0.1 - p * h * 0.7 : y0 - h * 0.9 + p * h * 0.7;
      ctx.beginPath(); ctx.arc(x + (i - 1) * h * 0.16, by, h * 0.022, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
};
// 單位附體(bnDrFrame 於單位之後、非 under 特效之前呼叫):只畫存活、未倒下、未淡出的單位;省電不畫
function bnStDraw(ctx, P, v, t, L, sb) {
  var keys, i, d, n = 0, h, x, y0;
  if (P.ps || !v || !L || !sb || !v.alive || v.dying >= 0 || v.fade < 0.5 || !v.st) return;
  keys = Object.keys(v.st); x = v.px + v.dx; y0 = v.py + v.dy; h = L.sh;
  ctx.save();
  for (i = 0; i < keys.length && n < 2 && sb.n < sb.max; i++) {
    d = BN_ST_VIS.hasOwnProperty(keys[i]) ? BN_ST_VIS[keys[i]] : null;
    if (!d || !BN_ST_FX[d.fx]) continue;
    BN_ST_FX[d.fx](ctx, d, x, y0, h, t, v, sb);
    n++;
  }
  ctx.restore();
}
function bnDrFx(ctx, P, f, L) {
  var k = f.t / f.dur, a, x, y, s, e, g;
  if (f.t < 0) return;
  if (f.mode === 14) { bnSigPillarDraw(ctx, f, k, L); return; }   // 旋轉柱狀(五行色系)
  if (f.mode >= 11) { bnScDraw(ctx, P, f, k, L); return; }   // 大招演出實例
  if (f.mode >= 8) { bnSigDraw(ctx, f, k, L); return; }   // 名人招牌:軌跡 / 落款 / 閃屏(bnfx 配方)
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
  if (f.file) {   // 第二批特效(透明底,一般混合;6 = 虛影半透明)。缺圖 / 載入中 → 退回原 fx_* 特效
    e = bnSigPick(f, bnDrImg('assets/bnfx/' + f.file + '.webp'), 'assets/bnfx/' + f.file + '.webp', false);
    if (e.ok) {
      s = f.size * (f.mode === 6 ? 1 : 0.85 + 0.25 * k);
      ctx.globalAlpha = Math.max(0, Math.min(1, a)) * (f.mode === 6 ? 0.55 : 1);
      ctx.drawImage(e.img, f.x - s / 2, f.y - s / 2, s, s);
      ctx.globalAlpha = 1;
      return;
    }
    if (!f.alt) return;
    f.name = f.alt;
  }
  e = bnSigPick(f, bnDrImg('assets/bnfx/fx_' + f.name + '.webp'), 'assets/bnfx/fx_' + f.name + '.webp', true);
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
// 粒子:光點 = 快取光暈圖加色;十字 / 箭頭 = 兩三個 fillRect / 一條路徑。總數受池大小限制(≤ 48)
function bnDrPts(ctx, P) {
  var pt = P.pt, i, p, a, s, g;
  if (!pt) return;
  for (i = 0; i < pt.length; i++) {
    p = pt[i];
    if (!p.on || p.t < 0) continue;
    a = p.t < 0.1 ? p.t / 0.1 : Math.max(0, 1 - (p.t - 0.1) / Math.max(0.05, p.dur - 0.1));
    s = p.sz;
    ctx.globalAlpha = a;
    if (p.sh === 0) {
      g = bnDrGlow(p.col);
      if (g) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(g, p.x - s * 1.6, p.y - s * 1.6, s * 3.2, s * 3.2); ctx.globalCompositeOperation = 'source-over'; }
    } else if (p.sh === 1) {
      ctx.fillStyle = p.col; ctx.fillRect(p.x - s / 2, p.y - s / 6, s, s / 3); ctx.fillRect(p.x - s / 6, p.y - s / 2, s / 3, s);
    } else {
      ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(2, s / 3.5); ctx.lineJoin = 'round'; ctx.beginPath();
      if (p.sh === 2) { ctx.moveTo(p.x - s / 2, p.y + s / 3); ctx.lineTo(p.x, p.y - s / 3); ctx.lineTo(p.x + s / 2, p.y + s / 3); }
      else { ctx.moveTo(p.x - s / 2, p.y - s / 3); ctx.lineTo(p.x, p.y + s / 3); ctx.lineTo(p.x + s / 2, p.y - s / 3); }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
// 技能名標籤:斜角色塊,靠牆的一半填陣營旗色(半透明)、另一半透明;文字描黑邊。回各方標籤的矩形(測試用)
function bnDrLabRect(P, L, sd, tw) {
  var h = L.labH || 26, w = tw + h * 1.4 + h * 0.45, x0 = sd === 'A' ? Math.max(0, (L.labX0 || 6) - 6) : L.vw - w;
  return { x: x0, y: L.labY !== undefined ? L.labY : 4, w: w, h: h };
}
function bnDrLabels(ctx, P, L) {
  var sides = ['A', 'B'], k, sd, c, a, h = L.labH || 26, fz, tw, R, sl = h * 0.45, half, maxW = L.vw / 2 - (L.gap || 28) / 2 - (L.labX0 || 6) - h * 1.9, slide;
  if (!P.lab) return;
  for (k = 0; k < 2; k++) {
    sd = sides[k]; c = P.lab[sd].cur;
    if (!c) continue;
    a = Math.min(1, c.t / 0.12); if (c.out >= 0) a = Math.max(0, 1 - c.out / BNLAB.fade);
    slide = (1 - Math.min(1, c.t / 0.15)) * 14 * (sd === 'A' ? -1 : 1);
    fz = Math.round(h * 0.62);
    ctx.font = 'bold ' + fz + 'px sans-serif';
    tw = ctx.measureText(c.text).width;
    if (tw > maxW && maxW > 20) { fz = Math.max(10, Math.floor(fz * maxW / tw)); ctx.font = 'bold ' + fz + 'px sans-serif'; tw = Math.min(maxW, ctx.measureText(c.text).width); }
    R = bnDrLabRect(P, L, sd, tw); half = R.w / 2;
    ctx.save();
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = c.col; ctx.beginPath();
    if (sd === 'A') { ctx.moveTo(R.x + slide, R.y); ctx.lineTo(R.x + half + sl + slide, R.y); ctx.lineTo(R.x + half + slide, R.y + R.h); ctx.lineTo(R.x + slide, R.y + R.h); }
    else { ctx.moveTo(R.x + R.w + slide, R.y); ctx.lineTo(R.x + half - sl + slide, R.y); ctx.lineTo(R.x + half + slide, R.y + R.h); ctx.lineTo(R.x + R.w + slide, R.y + R.h); }
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = a; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.fillStyle = '#fff3d0';
    ctx.textAlign = sd === 'A' ? 'left' : 'right';
    ctx.strokeText(c.text, sd === 'A' ? R.x + h * 0.6 + slide : R.x + R.w - h * 0.6 + slide, R.y + R.h / 2);
    ctx.fillText(c.text, sd === 'A' ? R.x + h * 0.6 + slide : R.x + R.w - h * 0.6 + slide, R.y + R.h / 2);
    if (c.sub) {   // 白話效果(≤ 16 字):標籤下方一行小字
      ctx.font = Math.max(10, Math.round(h * 0.44)) + 'px sans-serif'; ctx.textBaseline = 'top'; ctx.lineWidth = 3; ctx.fillStyle = '#e8f0ff';
      ctx.strokeText(c.sub, sd === 'A' ? R.x + h * 0.6 + slide : R.x + R.w - h * 0.6 + slide, R.y + R.h + 1);
      ctx.fillText(c.sub, sd === 'A' ? R.x + h * 0.6 + slide : R.x + R.w - h * 0.6 + slide, R.y + R.h + 1);
    }
    ctx.restore();
  }
}
function bnDrFrame(ctx, P, dpr, nowSec) {
  var L = P.L, S0 = (typeof performance !== 'undefined') ? performance.now() : 0, list = [], id, i, v, n, bg, sx = 0, sy = 0, b, by, fz, ps = P.ps, cut = P.cut, sb;
  bg = bnDrBgFor(L, dpr, ps);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = '#3a4228'; ctx.fillRect(0, 0, L.vw * dpr, L.vh * dpr); }
  if (P.shake > 0 && !ps) { b = Math.min(1.3, P.shake / 0.12); sx = Math.sin(nowSec * 90) * 3 * b; sy = Math.cos(nowSec * 73) * 2.2 * b; }   // 暴擊微震(省電不震)
  ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
  for (id in P.vu) list.push(P.vu[id]);
  list.sort(function (a, c) { return (a.py + a.dy) - (c.py + c.dy); });
  for (i = 0; i < P.fx.length; i++) if (P.fx[i].on && (P.fx[i].mode === 6 || P.fx[i].under)) bnDrFx(ctx, P, P.fx[i], L);   // 輔助虛影畫在人物後面
  for (i = 0; i < list.length; i++) bnDrUnit(ctx, P, list[i], nowSec, L);
  sb = { n: 0, max: BNDR.low ? BN_ST_BUDGET / 2 : BN_ST_BUDGET }; BNDR.stN = 0;
  if (!ps) for (i = 0; i < list.length; i++) bnStDraw(ctx, P, list[i], nowSec, L, sb);   // 狀態附體(粒子上限 40 / 低階 20;省電關)
  BNDR.stN = sb.n;
  for (i = 0; i < P.fx.length; i++) if (P.fx[i].on && P.fx[i].mode !== 6 && !P.fx[i].under) bnDrFx(ctx, P, P.fx[i], L);
  bnDrPts(ctx, P);
  for (i = 0; i < list.length; i++) bnDrBars(ctx, P, list[i], nowSec, L);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (i = 0; i < P.nums.length; i++) {
    n = P.nums[i];
    if (!n.on) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, (n.dur - n.t) / 0.25));
    fz = Math.round(Math.max(BN_NUM_MIN * (n.size < 1 ? 0.9 : 1), L.fs * 1.25) * n.size * (n.kind === 2 ? 1 : 1 + (n.kind === 1 ? 0.6 : 0.18) * Math.max(0, 1 - n.t / (0.16 * (n.pk || 1)))));   // 彈出:暴擊先放大 1.6 倍再縮回
    ctx.font = 'bold ' + fz + 'px sans-serif';
    ctx.lineWidth = Math.max(3, fz * 0.22); ctx.strokeStyle = '#000'; ctx.strokeText(n.text, n.x, n.y);   // 黑色描邊(所有浮字)
    ctx.fillStyle = n.col; ctx.fillText(n.text, n.x, n.y);
  }
  ctx.globalAlpha = 1;
  b = P.banner;
  by = L.banY !== undefined ? L.banY : L.top + (L.vh - L.top - L.bot) * 0.12;
  if (b) {
    ctx.globalAlpha = Math.max(0, Math.min(1, Math.min(b.t / 0.12, (b.dur - b.t) / 0.25)));
    ctx.font = 'bold ' + Math.round(Math.min(L.fs * (b.big ? 2.1 : 1.3), (L.labH || 30) * 1.1)) + 'px sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText(b.text, L.vw / 2, by); ctx.fillStyle = '#ffe9a8'; ctx.fillText(b.text, L.vw / 2, by);
    ctx.globalAlpha = 1;
  } else if (P.chainN > 0) {
    ctx.font = 'bold ' + Math.round(Math.min(L.fs * 1.2, (L.labH || 30) * 0.8)) + 'px sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText('連 ×' + (P.chainN + 1), L.vw / 2, by); ctx.fillStyle = '#ffb36a'; ctx.fillText('連 ×' + (P.chainN + 1), L.vw / 2, by);
  }
  bnDrLabels(ctx, P, L);
  if (S0) { v = performance.now() - S0; BNDR.stats.lastMs = v; BNDR.stats.frames++; BNDR.stats.sumMs += v; if (v > BNDR.stats.maxMs) BNDR.stats.maxMs = v; if (BNDR.stats.samples.length < 600) BNDR.stats.samples.push(v); }
  if (!BNDR.low && BNDR.stats.frames >= 90 && BNDR.stats.sumMs / BNDR.stats.frames > BNDR.lowMs) BNDR.low = true;   // 低階機自動降級(粒子減半)
}
// 低階裝置提示(記憶體 ≤ 2 GB 或 ≤ 2 核):一開始就降級
try { if (typeof navigator !== 'undefined' && navigator && ((navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2))) BNDR.low = true; } catch (e) { /* 略過 */ }

// ───────── 名人招牌戰法特效(程式組合,不新增素材)─────────
// 配方 BN_FX_SIGNATURE[戰法 id]:base 命中基礎特效(fx_* 黑底加色 / fxc_* 等透明底;缺圖退回 bnPlFxFor 原特效)、tint 染色(快取,不每幀著色)、
// trail 程式繪製軌跡(arc 刀光月牙 / thrust 槍突刺 / cross 劍氣十字 / sweep 戟橫掃 / arrows 箭雨 / charge 騎兵塵土 / bolt 雷電分叉)、col 軌跡色、
// flash [色, 強度] 全畫面閃屏、stamp 書法落款(名人名,紅印)。
// 掛接:skill 事件 → bnPlSigCast(軌跡 / 落款 / 閃屏,施法姿勢之後);hit 事件 → bnPlSigHit(基礎特效換成染色版)。
// 省電:只留命中基礎特效(無軌跡 / 落款 / 閃屏);低階機與減少動態偏好:關閉閃屏與落款。1× / 2× 時長沿用 bnPlFx 的 bnPlStK 縮放。
var BN_FX_SIGNATURE = {
  s_caocao_1: { base: 'fx_morale_burst', tint: '#ffd25a', trail: 'sweep', col: '#ffe9a8', flash: ['#ffd25a', 0.1], stamp: '曹操' },
  s_liubei_2: { base: 'fx_shield_dome', tint: '#7fd39a', trail: '', col: '', flash: null, stamp: '劉備' },
  s_sunquan_1: { base: 'fx_morale_burst', tint: '#9fe0c0', trail: '', col: '', flash: ['#ffe9a8', 0.08], stamp: '孫權' },
  s_guanyu_2: { base: 'fx_slash_x', tint: '#7ad7ff', trail: 'arc', col: '#bfefff', flash: null, stamp: '關羽' },
  s_zhugeliang_1: { base: 'fx_fire_l', tint: '', trail: 'cross', col: '#ff9a4a', flash: ['#ff7a30', 0.12], stamp: '諸葛亮' },
  s_zhouyu_1: { base: 'fx_fire_wall', tint: '', trail: 'sweep', col: '#ff7a30', flash: ['#ff5a20', 0.12], stamp: '周瑜' },
  s_lvbu_1: { base: 'fx_slash_h', tint: '#ffe0c0', trail: 'sweep', col: '#ffe9d0', flash: null, stamp: '呂布' },
  s_simayi_1: { base: 'fxc_mirage', tint: '#b9a8d8', trail: '', col: '', flash: null, stamp: '司馬懿' },
  s_zhangfei_3: { base: 'fx_impact_ring', tint: '', trail: 'thrust', col: '#ffd08a', flash: ['#ffffff', 0.08], stamp: '張飛' },
  s_zhaoyun_1: { base: 'fx_shield_dome', tint: '#8ec7ff', trail: 'thrust', col: '#cfe8ff', flash: null, stamp: '趙雲' },
  s_zhangliao_2: { base: 'fx_slash_h', tint: '#9fd0ff', trail: 'charge', col: '#d8c8a0', flash: null, stamp: '張遼' },
  s_xuchu_2: { base: 'fx_slash_d', tint: '#ff8a6a', trail: 'arc', col: '#ffb070', flash: null, stamp: '許褚' },
  s_dianwei_2: { base: 'fx_slash_d', tint: '#e0e0e0', trail: 'sweep', col: '#e8e8f0', flash: null, stamp: '典韋' },
  s_xiahoudun_3: { base: 'fx_slash_x', tint: '#ff6a3a', trail: 'arc', col: '#ff8a5a', flash: ['#ff4a20', 0.1], stamp: '夏侯惇' },
  s_machao_1: { base: 'fx_dust', tint: '#c8e0ff', trail: 'charge', col: '#e0d0b0', flash: null, stamp: '馬超' },
  s_huangzhong_1: { base: 'fx_spark', tint: '#ffe9a8', trail: 'arrows', col: '#ffe9a8', flash: null, stamp: '黃忠' },
  s_weiyan_1: { base: 'fx_slash_x', tint: '#7aa0c8', trail: 'arc', col: '#9ec8ff', flash: null, stamp: '魏延' },
  s_luxun_1: { base: 'fx_fire_s', tint: '', trail: 'cross', col: '#ff9a4a', flash: ['#ff7a30', 0.1], stamp: '陸遜' },
  s_ganning_1: { base: 'fx_slash_d', tint: '#3ac0a0', trail: 'arc', col: '#7ff0d0', flash: null, stamp: '甘寧' },
  s_taishici_2: { base: 'fx_slash_h', tint: '', trail: 'thrust', col: '#ffe9a8', flash: null, stamp: '太史慈' },
  s_sunce_1: { base: 'fx_impact_ring', tint: '#ff8a6a', trail: 'thrust', col: '#ffb08a', flash: null, stamp: '孫策' },
  s_guojia_2: { base: 'fxc_ink_splash', tint: '#b9a8d8', trail: 'cross', col: '#d8c8ff', flash: null, stamp: '郭嘉' },
  s_xunyu_1: { base: 'fx_morale_burst', tint: '#ffe9a8', trail: '', col: '', flash: null, stamp: '荀彧' },
  s_diaochan_1: { base: 'fxc_mirage', tint: '#ff9ad0', trail: '', col: '', flash: null, stamp: '貂蟬' },
  s_dongzhuo_1: { base: 'fx_spark', tint: '#ff9a6a', trail: 'arrows', col: '#ff9a6a', flash: ['#ff4a20', 0.08], stamp: '董卓' },
  s_yuanshao_2: { base: 'fxc_banner', tint: '', trail: '', col: '', flash: null, stamp: '袁紹' },
  s_zhangjiao_1: { base: 'fxc_talisman', tint: '#7af09a', trail: '', col: '', flash: null, stamp: '張角' },
  s_huatuo_1: { base: 'fxc_herb_leaves', tint: '', trail: '', col: '', flash: null, stamp: '華佗' },
  s_caiyan_1: { base: 'fxc_drum_wave', tint: '#ffb0c8', trail: '', col: '', flash: null, stamp: '蔡文姬' },
  s_caozhi_1: { base: 'fxc_ink_brush', tint: '#b9a8d8', trail: 'sweep', col: '#d8c8ff', flash: null, stamp: '曹植' },
  s_yangxiu_2: { base: 'fxc_ink_scroll', tint: '', trail: 'arc', col: '#e8e0ff', flash: null, stamp: '楊修' },
  s_huangyueying_1: { base: 'fxc_crossbow_volley', tint: '', trail: 'arrows', col: '#ffe0a0', flash: null, stamp: '黃月英' },
  s_sunshangxiang_2: { base: 'fx_slash_h', tint: '#ffc0d8', trail: 'sweep', col: '#ffd0e0', flash: null, stamp: '孫尚香' },
  s_daqiao_1: { base: 'fx_heal_motes', tint: '#7ad7ff', trail: '', col: '', flash: null, stamp: '大喬' },
  s_xiaoqiao_2: { base: 'fxc_mirage', tint: '#ffd0e8', trail: '', col: '', flash: null, stamp: '小喬' },
  s_nanhua_2: { base: 'fxc_herb_smoke', tint: '', trail: '', col: '', flash: null, stamp: '南華' },
  s_zuoci_1: { base: 'fxc_yy_taiji', tint: '#c78bff', trail: '', col: '', flash: null, stamp: '左慈' },
  s_yuji_1: { base: 'fxc_talisman', tint: '#7af09a', trail: '', col: '', flash: null, stamp: '于吉' },
  s_panfeng_2: { base: 'fx_slash_d', tint: '#ffb070', trail: 'sweep', col: '#ffd0a0', flash: null, stamp: '潘鳳' },
  s_mateng_1: { base: 'fx_dust', tint: '#d8c8a0', trail: 'charge', col: '#e0c890', flash: null, stamp: '馬騰' },
  s_gongsunzan_1: { base: 'fx_slash_h', tint: '#cfe8ff', trail: 'thrust', col: '#e8f4ff', flash: null, stamp: '公孫瓚' },
  s_elf_qinglan_2: { base: 'fx_spark', tint: '#7af09a', trail: 'arrows', col: '#9ff0b0', flash: null, stamp: '青嵐' },
  s_elf_shuanghua_1: { base: 'fx_impact_ring', tint: '#9fe0ff', trail: 'thrust', col: '#cfefff', flash: null, stamp: '霜華' },
  s_elf_yueyao_1: { base: 'fx_heal_motes', tint: '#e8f4ff', trail: '', col: '', flash: null, stamp: '月瑤' },
  s_elf_xingchen_1: { base: 'fx_spark', tint: '#c8a8ff', trail: 'cross', col: '#d8c0ff', flash: ['#b090ff', 0.1], stamp: '星沉' },
  s_dw_duanlei_1: { base: 'fxc_thunder_strike', tint: '', trail: 'bolt', col: '#8ab8ff', flash: ['#9ac0ff', 0.12], stamp: '鍛雷' },
  s_dw_lielu_1: { base: 'fx_fire_s', tint: '#ff8a3a', trail: 'cross', col: '#ff7a30', flash: ['#ff6020', 0.1], stamp: '烈爐' },
  s_dw_heiyao_1: { base: 'fxc_crossbow_volley', tint: '#c8c8d8', trail: 'arrows', col: '#e0e0e8', flash: null, stamp: '黑曜' },
  s_dw_panshan_1: { base: 'fx_shield_dome', tint: '#f0c060', trail: '', col: '', flash: null, stamp: '磐山' },
  s_kd_zhaoming_1: { base: 'fx_slash_h', tint: '#ffd25a', trail: 'charge', col: '#ffe9a8', flash: null, stamp: '昭明' },
  s_kd_lingfeng_1: { base: 'fx_slash_h', tint: '#fff0c0', trail: 'thrust', col: '#ffffff', flash: ['#ffffff', 0.06], stamp: '凌鋒' },
  s_kd_xuandeng_1: { base: 'fxc_thunder_chain', tint: '', trail: 'bolt', col: '#9ad0ff', flash: ['#9ad0ff', 0.1], stamp: '玄燈' }
};
var BN_FX_SIG_MAX = 40;   // 染色 sprite 快取上限(超過就用原圖,不報錯)
var BN_FX_SIG_CACHE = { n: 0, map: {} };
function bnSigOf(id) { return BN_FX_SIGNATURE.hasOwnProperty(id) ? BN_FX_SIGNATURE[id] : null; }
// 減少動態偏好(系統設定);取不到 matchMedia 時視為未開
function bnSigReduce() {
  try { return typeof matchMedia === 'function' && !!matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
// 各類特效是否關閉:軌跡只在省電關;落款省電 / 低階機關;閃屏省電 / 低階機 / 減少動態皆關
function bnSigQuiet(P, what) {
  if (what === 'trail') return !!P.ps;
  if (what === 'stamp') return !!(P.ps || BNDR.low);
  return !!(P.ps || BNDR.low || bnSigReduce());
}
// 染色 sprite(快取鍵 key|col,上限 BN_FX_SIG_MAX 張)。mul:黑底 fx_* 用正片疊底(黑仍黑、亮部上色);透明底用 source-atop 半透明上色
function bnSigTint(key, col, img, mul) {
  var k = key + '|' + col, C = BN_FX_SIG_CACHE, w, h, cv, c;
  if (!col || !img) return null;
  if (C.map[k]) return C.map[k];
  if (C.n >= BN_FX_SIG_MAX) return null;
  w = img.naturalWidth || img.width || 64; h = img.naturalHeight || img.height || 64;
  cv = bnDrNew(w, h);
  c = cv ? cv.getContext('2d') : null;
  if (!c) return null;
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = mul ? 'multiply' : 'source-atop'; c.globalAlpha = mul ? 1 : 0.55;
  c.fillStyle = col; c.fillRect(0, 0, w, h);
  C.map[k] = cv; C.n++;
  return cv;
}
// bnDrFx 取圖時的選擇:有染色且圖已載入 → 染色版(同樣 ok = true);否則原樣回傳
function bnSigPick(f, e, key, mul) {
  var t;
  if (!f.tint || !e || !e.ok) return e;
  t = bnSigTint(key, f.tint, e.img, mul);
  return t ? { ok: true, img: t, path: key } : e;
}
// 離 caster 最近的存活敵人中心(找不到就往前方一段)
function bnSigAim(P, v) {
  var best = null, bd = 1e18, id, w, dd, d = v.side === 'A' ? 1 : -1;
  for (id in P.vu) {
    w = P.vu[id];
    if (w.side === v.side || !w.alive) continue;
    dd = Math.abs(w.px - v.px) + Math.abs(w.py - v.py);
    if (dd < bd) { bd = dd; best = w; }
  }
  if (!best) return { x: v.px + d * P.L.colW * 1.5, y: v.py - P.L.sh * 0.5 };
  return bnPlCenter(best);
}
// skill 事件:施法者身上的軌跡(朝最近敵人)、落款、閃屏;皆在施法姿勢之後(BNPL_POSE.delay)
function bnPlSigCast(P, v, e) {
  var S = bnSigOf(e.id), L = P.L, d, c, tg, dl, fl;
  if (!S || !v || !L) return;
  d = v.side === 'A' ? 1 : -1; c = bnPlCenter(v); tg = bnSigAim(P, v); dl = BNPL_POSE.delay * bnPlStK(P);
  if (S.trail && !bnSigQuiet(P, 'trail')) bnPlFx(P, S.trail, c.x + d * L.colW * 0.2, c.y, { mode: 8, x2: tg.x, y2: tg.y, size: L.sh * 0.75, col: S.col || '#ffffff', dur: 0.42, delay: dl });
  if (S.stamp && !bnSigQuiet(P, 'stamp')) bnPlFx(P, S.stamp, c.x + d * L.colW * 0.85, c.y - L.sh * 0.42, { mode: 9, size: L.fs * 2.2, col: '#c0392b', dur: 0.9, delay: dl });
  fl = S.flash;
  if (fl && !bnSigQuiet(P, 'flash')) bnPlFx(P, 'flash', 0, 0, { mode: 10, size: fl[1], col: fl[0], dur: 0.32, delay: dl });
}
// hit 事件:配方有 base 時以染色基礎特效取代原 bnPlFxFor 特效(回 true);沒有或缺資料回 false → 走原流程
function bnPlSigHit(P, vt, sk, c, s, f) {
  var S = bnSigOf(sk.id), base, mul;
  if (!S || !S.base || !f) return false;
  base = S.base; mul = base.indexOf('fx_') === 0;
  bnPlFx(P, mul ? base.slice(3) : f.n, c.x, c.y, { file: mul ? '' : base, alt: f.n, tint: S.tint || '', mode: mul ? 0 : 7, size: s * 0.8 * f.s * 1.15, dur: 0.38, rot: (vt.id * 0.7) % 3 - 1.2 });
  return true;
}
// 軌跡(mode 8):f.name = 種類、f.x/y 起點、f.x2/y2 目標、f.size 大小、f.col 色;k 為進度 0..1
function bnSigTrail(ctx, f, k, a) {
  var t = f.name, x = f.x, y = f.y, R = f.size, dx = f.x2 - x, dy = f.y2 - y, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len, base = Math.atan2(uy, ux), i, sw, cx, cy, hx, hy, sx, sy, ex, ey, q, px, py, j, mx, my;
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a); ctx.strokeStyle = f.col; ctx.fillStyle = f.col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (t === 'arc') {   // 刀光月牙:弧線沿揮砍方向展開,外粗內細兩層
    sw = Math.min(1, k * 1.6) * 1.5; cx = x + ux * R * 0.3; cy = y + uy * R * 0.3;
    ctx.lineWidth = Math.max(2, R * 0.14) * (1 - k * 0.5); ctx.beginPath(); ctx.arc(cx, cy, R * 0.7, base - 0.75, base - 0.75 + sw); ctx.stroke();
    ctx.globalAlpha *= 0.45; ctx.lineWidth *= 2.6; ctx.stroke();
  } else if (t === 'thrust') {   // 槍突刺:一道直線刺向目標,頭端亮、尾端淡
    hx = x + dx * Math.min(1, k * 1.6); hy = y + dy * Math.min(1, k * 1.6); sx = hx - ux * R * 0.8; sy = hy - uy * R * 0.8;
    ctx.lineWidth = Math.max(2, R * 0.05); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.globalAlpha *= 0.4; ctx.lineWidth *= 3; ctx.stroke();
  } else if (t === 'cross') {   // 劍氣十字:由中心擴張
    sw = R * (0.4 + 0.6 * Math.min(1, k * 2)); ctx.lineWidth = Math.max(2, R * 0.06); ctx.beginPath();
    ctx.moveTo(x - sw, y); ctx.lineTo(x + sw, y); ctx.moveTo(x, y - sw * 0.7); ctx.lineTo(x, y + sw * 0.7); ctx.stroke();
  } else if (t === 'sweep') {   // 戟橫掃大弧
    sw = Math.min(1, k * 1.4) * 2.4; ctx.lineWidth = Math.max(3, R * 0.1); ctx.beginPath(); ctx.arc(x, y, R * 0.9, base - 1.2, base - 1.2 + sw); ctx.stroke();
  } else if (t === 'arrows') {   // 箭雨斜線:四支依序落在目標上方
    for (i = 0; i < 4; i++) {
      q = Math.max(0, Math.min(1, (k - i * 0.12) * 1.6)); if (q <= 0) continue;
      ex = f.x2 + (i - 1.5) * R * 0.3; ey = f.y2; sx = ex - R * 0.4; sy = ey - R * 1.1;
      hx = sx + (ex - sx) * q; hy = sy + (ey - sy) * q;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - (ex - sx) * 0.25, hy - (ey - sy) * 0.25); ctx.lineTo(hx, hy); ctx.stroke();
    }
  } else if (t === 'charge') {   // 騎兵衝撞:沿地面的塵土帶(一般混合)
    ctx.globalCompositeOperation = 'source-over';
    for (i = 0; i < 6; i++) {
      px = x + ux * R * (0.15 + i * 0.22) * Math.min(1, k * 1.3); py = y + R * 0.2 + Math.sin(i * 2.3) * R * 0.05;
      ctx.globalAlpha = Math.min(1, a) * 0.35; ctx.beginPath(); ctx.arc(px, py, R * (0.09 + 0.03 * i) * (0.6 + k), 0, 6.2832); ctx.fill();
    }
  } else if (t === 'bolt') {   // 雷電分叉:鋸齒主線(每 1/6 秒換形)+ 一道分叉
    j = Math.floor(k * 6); ctx.lineWidth = Math.max(2, R * 0.04); ctx.beginPath(); ctx.moveTo(x, y);
    for (i = 1; i <= 6; i++) { sw = Math.sin(i * 12.9898 + j * 78.233) * R * 0.22; ctx.lineTo(x + dx * i / 6 - uy * sw, y + dy * i / 6 + ux * sw); }
    ctx.stroke();
    mx = x + dx * 0.5; my = y + dy * 0.5; ctx.lineWidth = Math.max(1, R * 0.02); ctx.beginPath(); ctx.moveTo(mx, my);
    ctx.lineTo(mx - uy * R * 0.3 + ux * R * 0.1, my + ux * R * 0.3 + uy * R * 0.1); ctx.stroke();
  }
  ctx.restore();
}
// 落款(mode 9):紅色方印 + 名字(書法字體);進場縮放、結尾淡出。f.name = 名字、f.size = 印大小
function bnSigStamp(ctx, f, k) {
  var a = k < 0.12 ? k / 0.12 : (k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1), s = f.size, sc = 0.6 + 0.4 * Math.min(1, k / 0.12);
  if (!f.name || a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * 0.92; ctx.translate(f.x, f.y); ctx.scale(sc, sc);
  ctx.fillStyle = f.col; ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = 'rgba(255,236,214,.85)'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.strokeRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84);
  ctx.fillStyle = '#fff6e6'; ctx.font = 'bold ' + Math.max(8, Math.round(s * (f.name.length > 2 ? 0.24 : 0.36))) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(f.name, 0, s * 0.03);
  ctx.restore();
}
// 閃屏(mode 10):f.col 色、f.size 強度(上限 0.2);快進慢出
function bnSigFlash(ctx, f, k, L) {
  var a = k < 0.3 ? k / 0.3 : Math.max(0, 1 - (k - 0.3) / 0.7);
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(0.2, f.size) * Math.min(1, a); ctx.fillStyle = f.col; ctx.fillRect(0, 0, L.vw, L.vh); ctx.restore();
}
function bnSigDraw(ctx, f, k, L) {
  var a = k < 0.2 ? k / 0.2 : Math.max(0, 1 - (k - 0.2) / 0.8);
  if (f.mode === 8) bnSigTrail(ctx, f, k, a);
  else if (f.mode === 9) bnSigStamp(ctx, f, k);
  else if (f.mode === 10) bnSigFlash(ctx, f, k, L);
}
// ───────── 旋轉柱狀(bnSigPillar,mode 14)五行色系:火 / 雷 / 水 / 風 / 幽 ─────────
// 柱身預烘一張(每系一張,共 5 張,不每幀著色);繪製只做水平縮放(旋轉投影 |cos|)與加色混合。
// H = 峰值刻(模擬秒,自呼叫起算)= 受害者 hitAt,與傷害數字 / 閃白 / 血條下降同一刻;峰值前升起、峰值後淡出。
// o:{ el 色系, big 放大 1.25 倍(暴擊或高傷害), box {w,h} 受害者外框(峰值前後短暫標示), ph 旋轉相位, quiet 減少動態(不轉、無外框) }
var BN_PILLAR_PAL = { '火': { core: '#fff0b0', edge: '#ff5a18', key: 'fire' }, '雷': { core: '#f4faff', edge: '#5a9cff', key: 'thunder' }, '水': { core: '#e2fbff', edge: '#2a9ad8', key: 'water' }, '風': { core: '#ecfff6', edge: '#4fd8a0', key: 'wind' }, '幽': { core: '#e6dcff', edge: '#5a2a9a', key: 'dark' } };
var BN_PILLAR_SPR = {};   // 色系 key → 預烘柱身(固定 5 張)
function bnPillarSpr(el) {
  var pal = BN_PILLAR_PAL.hasOwnProperty(el) ? BN_PILLAR_PAL[el] : BN_PILLAR_PAL['火'], k = pal.key, cv, c, g, y;
  if (BN_PILLAR_SPR[k]) return BN_PILLAR_SPR[k];
  cv = bnDrNew(32, 128); c = cv ? cv.getContext('2d') : null;
  if (!c) return null;
  if (c.createLinearGradient) { g = c.createLinearGradient(0, 0, 32, 0); g.addColorStop(0, pal.edge); g.addColorStop(0.5, pal.core); g.addColorStop(1, pal.edge); c.fillStyle = g; } else c.fillStyle = pal.edge;
  c.fillRect(0, 0, 32, 128);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  for (y = 0; y < 128; y += 16) c.fillRect(0, y, 32, 5);   // 紋路:每 16px 一條亮帶,隨旋轉投影即成螺旋感
  BN_PILLAR_SPR[k] = cv;
  return cv;
}
// 施放一根柱:c = 腳底座標,H = 峰值刻(模擬秒)。時長 1.0 由 bnPlFx 依倍速縮放;峰值刻 pkT = min(0.25 × 時長, H),故 delay = H − pkT ≥ 0
function bnSigPillar(P, c, H, o) {
  var L = P.L, o2 = o || {}, durS, pkT;
  if (!c || !L) return null;
  H = Math.max(0, H || 0);
  durS = 1.0 * bnPlStK(P);
  pkT = Math.min(0.25 * durS, H);
  return bnPlFx(P, 'pillar', c.x, c.y, { mode: 14, size: L.sh * (o2.big ? 1.25 : 1), dur: 1.0, delay: H - pkT,
    ex: { el: o2.el || '火', pkT: pkT, ph: o2.ph || 0, box: o2.box || null, quiet: !!o2.quiet } });
}
// 柱身繪製(mode 14);f.t 與 f.dur 同為模擬秒。f.ex.pkT = 峰值刻
function bnSigPillarDraw(ctx, f, k, L) {
  var ex = f.ex || {}, t = f.t, dur = f.dur, pk = ex.pkT > 0 ? ex.pkT : 0.01, a, rise, cw, hh, wid, spr, ao, bx;
  if (dur <= pk) dur = pk + 0.01;
  a = t < pk ? t / pk : (dur - t) / (dur - pk);
  a = Math.max(0, Math.min(1, a));
  rise = Math.max(0.25, Math.min(1, t / pk));
  hh = f.size * 1.45 * rise;
  cw = ex.quiet ? 0.8 : Math.abs(Math.cos(t * 9 + (ex.ph || 0)));   // 旋轉:柱身寬度隨旋轉週期起伏(減少動態時不轉)
  wid = f.size * 0.34 * (0.3 + 0.7 * cw);
  spr = bnPillarSpr(ex.el);
  ctx.save();
  if (spr) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(spr, f.x - wid / 2, f.y - hh, wid, hh); }
  bx = ex.box;
  if (bx && !ex.quiet && t > -0.001) {   // 受害者外框:峰值前後約 0.25 模擬秒短暫標示
    ao = t < pk ? Math.max(0, t / pk) : Math.max(0, 1 - (t - pk) / 0.25);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9 * ao; ctx.strokeStyle = '#fff3d0'; ctx.lineWidth = 2;
    ctx.strokeRect(f.x - bx.w / 2, f.y - bx.h, bx.w, bx.h);
  }
  ctx.restore();
}
// ───────── 主角大招全螢幕演出(bnPlUltScene,純視覺;BN_FX_ULT_SCENE 配方)─────────
// 演出由多個浮動實例組成(沿用 bnPlFx 池):spot 圖(mode 12:上飄 rise / 下落 rise<0 / 旋轉 spin / 消散 dissolve / 加色 add)、
// ghost 黑化 / 血色剪影(mode 13,去色壓暗的結果於 bnScSil 快取一次)、trail 軌跡(mode 8,沿用 bnSigTrail)、dragon 青龍纏刀(mode 11)、
// flash 閃屏(mode 10,≤ 0.2)、shake 微震(P.shake,≤ 0.16)。under = 畫在單位之下(半透明,血條與浮字仍在最上層)。
// 時間(模擬秒):大招 cut-in 結束後的 skill 事件即開演;命中在演出後約 0.32 秒,配方峰值 delay ≈ 0.3,總長約 1 秒(dur 依 bnPlStK 縮放)。
// 上限:全場 ≤ 24 個實例;省電 ≤ 6 且略過 ghost / dragon;低階機 ≤ 12 且略過 ghost / dragon / trail;減少動態略過閃屏與微震。
// 跳過:大招特寫點擊跳過(bnPlCutSkip → P.noScene)或略過(P.skipped)時整段不演出。缺圖的 spot 退回光暈圓;ghost 缺圖退回 BN_FX_HERO 單張。
var BN_FX_ULT_SCENE = {
  u_caocao: { items: [   // 天下歸心:黑化虛影(四方聚攏向敵陣)+ 黑金旗海落下 + 暗色閃屏,最後化為黑霧
    { g: 'flash', col: '#1b0f2a', str: 0.2, dur: 0.6, delay: 0 },
    { g: 'ghost', at: 'ring', n: 4, to: 'center', pal: 'dark', sz: 1.5, a: 0.5, dur: 0.95, delay: 0, stag: 0.05, dissolve: 1 },
    { g: 'spot', file: 'fxc_banner', tint: '#d8b23a', at: 'above', n: 3, sz: 1.1, rise: -0.6, dur: 0.9, delay: 0.05 },
    { g: 'trail', kind: 'sweep', col: '#d8c8ff', from: 'self', at: 'cells', sz: 1.0, dur: 0.42, delay: 0.2 },
    { g: 'shake', amt: 0.1, delay: 0.3 },
    { g: 'spot', file: 'fxc_ink_splash', tint: '#2a2030', hit: 1, sz: 0.9, dur: 0.5, delay: 0.23, dissolve: 1 }
  ] },
  u_liubei: { items: [   // 桃園誓盟:雙劍十字 + 桃花漫天 + 粉色薄幕
    { g: 'flash', col: '#ffb0c8', str: 0.08, dur: 0.5, delay: 0 },
    { g: 'trail', kind: 'cross', col: '#ffd0e0', from: 'self', at: 'cells', sz: 0.9, dur: 0.4, delay: 0.2 },
    { g: 'spot', file: 'fx_heal_motes', tint: '#ffb0c8', at: 'grid', sz: 0.9, rise: 0.35, dur: 1.0, delay: 0.05, add: 1 },
    { g: 'spot', file: 'fxc_mirage', tint: '#ffd0e0', at: 'screen', sz: 2.0, dur: 0.9, delay: 0.1, under: 1 },
    { g: 'spot', file: 'fx_morale_burst', tint: '#ffd0e0', hit: 1, sz: 0.7, dur: 0.6, add: 1 },
    { g: 'shake', amt: 0.05, delay: 0.3 }
  ] },
  u_sunquan: { items: [   // 坐斷東南:江潮拍岸,全屏波浪
    { g: 'spot', file: 'fxc_wx_water', tint: '#9fe0c0', at: 'row', sz: 1.4, rise: 0.25, dur: 0.95, delay: 0 },
    { g: 'spot', file: 'fxc_wx_water', tint: '#7ad7ff', at: 'screen', sz: 2.2, dur: 0.9, delay: 0.1, a: 0.6, under: 1 },
    { g: 'spot', file: 'fxc_wx_water', tint: '#9fe0c0', hit: 1, sz: 0.8, dur: 0.6, add: 1 },
    { g: 'flash', col: '#ffe9a8', str: 0.08, dur: 0.5, delay: 0.3 },
    { g: 'shake', amt: 0.08, delay: 0.3 }
  ] },
  u_guanyu: { items: [   // 水淹七軍(本次改為青龍纏刀):多條青龍光帶從施放者飛向各敵並纏繞
    { g: 'dragon', from: 'self', at: 'cells', n: 5, col: '#7ff0c8', sz: 1.1, dur: 0.9, delay: 0, stag: 0.08 },
    { g: 'flash', col: '#7ad7ff', str: 0.12, dur: 0.45, delay: 0.3 },
    { g: 'spot', file: 'fx_slash_x', tint: '#bfefff', hit: 1, sz: 1.0, add: 1, dur: 0.38 },
    { g: 'shake', amt: 0.1, delay: 0.32 },
    { g: 'spot', file: 'fxc_wx_water', tint: '#7ad7ff', at: 'row', sz: 1.2, rise: 0.2, dur: 0.8, delay: 0.5, a: 0.7 }
  ] },
  u_zhugeliang: { items: [   // 八陣石兵:九宮石陣升起
    { g: 'spot', file: 'fxc_bagua_disc', at: 'grid', sz: 0.8, dur: 1.0, delay: 0, under: 1 },
    { g: 'spot', file: 'fxc_wx_earth', tint: '#c8b070', at: 'grid', sz: 0.9, rise: 0.5, dur: 0.8, delay: 0.05, under: 1 },
    { g: 'spot', file: 'fx_impact_ring', tint: '#e0d0a0', hit: 1, sz: 1.2, dur: 0.5, add: 1 },
    { g: 'flash', col: '#c8b070', str: 0.08, dur: 0.4, delay: 0.3 },
    { g: 'shake', amt: 0.08, delay: 0.3 }
  ] },
  u_zhouyu: { items: [   // 火燒連營:整片敵陣火海蔓延、火星上飄、紅色閃屏與熱浪微震
    { g: 'flash', col: '#ff5a20', str: 0.14, dur: 0.5, delay: 0.05 },
    { g: 'spot', file: 'fx_fire_wall', at: 'row', sz: 1.3, rise: 0.3, dur: 1.0, delay: 0, add: 1, under: 1 },
    { g: 'spot', file: 'fxc_fireox_trail', hit: 1, sz: 1.0, dur: 0.7 },
    { g: 'pillar', el: '火', hit: 1 },
    { g: 'spot', file: 'fx_spark', tint: '#ffb070', at: 'row', sz: 0.6, rise: 0.7, dur: 0.9, delay: 0.3, add: 1 },
    { g: 'shake', amt: 0.08, delay: 0.3 },
    { g: 'flash', col: '#ff5a20', str: 0.1, dur: 0.4, delay: 0.5 }
  ] },
  u_lvbu: { items: [   // 飛將無雙(鬼神附體):紅黑閃屏微震 → 鬼神虛影從四周附身 → 方天畫戟巨大刀影 + 多道紅色戟光連斬
    { g: 'flash', col: '#c0102a', str: 0.18, dur: 0.45, delay: 0 },
    { g: 'flash', col: '#000000', str: 0.14, dur: 0.4, delay: 0.1 },
    { g: 'shake', amt: 0.14, delay: 0 },
    { g: 'ghost', at: 'ring', n: 4, to: 'self', pal: 'red', sz: 1.4, a: 0.45, dur: 0.85, delay: 0, stag: 0.04, dissolve: 1 },
    { g: 'trail', kind: 'sweep', col: '#ff3030', from: 'self', at: 'cells', sz: 1.7, dur: 0.5, delay: 0.12 },
    { g: 'trail', kind: 'thrust', col: '#ff4040', from: 'self', at: 'cells', sz: 1.0, dur: 0.28, delay: 0.3, stag: 0.05 },
    { g: 'trail', kind: 'cross', col: '#ff3030', from: 'self', at: 'cells', sz: 0.8, dur: 0.3, delay: 0.42 },
    { g: 'spot', file: 'fx_slash_h', tint: '#ff3030', hit: 1, sz: 1.2, add: 1, dur: 0.38 },
    { g: 'shake', amt: 0.1, delay: 0.32 }
  ] },
  u_zhangjiao: { items: [   // 蒼天已死 / 天公落雷:多道雷柱從天劈下
    { g: 'trail', kind: 'bolt', col: '#8ab8ff', from: 'sky', at: 'cells', sz: 1.0, dur: 0.3, delay: 0, stag: 0.04 },
    { g: 'flash', col: '#9ac0ff', str: 0.12, dur: 0.4, delay: 0.3 },
    { g: 'spot', file: 'fxc_thunder_blast', hit: 1, sz: 1.1, dur: 0.5 },
    { g: 'shake', amt: 0.12, delay: 0.3 },
    { g: 'spot', file: 'fxc_thunder_scorch', hit: 1, sz: 0.9, dur: 0.6, delay: 0.2, under: 1 }
  ] },
  u_simayi: { items: [   // 高平陵變:紫黑旋風籠罩敵陣
    { g: 'flash', col: '#2a1040', str: 0.12, dur: 0.5, delay: 0 },
    { g: 'spot', file: 'fxc_mirage', tint: '#b9a8d8', at: 'ring', n: 4, sz: 1.3, spin: 1, dur: 0.9, delay: 0, under: 1, a: 0.6 },
    { g: 'trail', kind: 'arc', col: '#a070e0', from: 'center', at: 'cells', sz: 1.4, dur: 0.45, delay: 0.15 },
    { g: 'spot', file: 'fx_impact_ring', tint: '#8a5ac8', at: 'screen', sz: 2.2, add: 1, dur: 0.6, delay: 0.3 },
    { g: 'spot', file: 'fx_impact_ring', tint: '#8a5ac8', hit: 1, sz: 0.8, dur: 0.45, add: 1 },
    { g: 'shake', amt: 0.06, delay: 0.3 }
  ] },
  u_diaochan: { items: [   // 連環計:金色連環環扣擴散
    { g: 'spot', file: 'fx_impact_ring', tint: '#ffd25a', hit: 1, sz: 0.9, dur: 0.5, add: 1 },
    { g: 'trail', kind: 'arc', col: '#ffd0e8', from: 'self', at: 'cells', sz: 0.8, dur: 0.35, delay: 0.12, stag: 0.05 },
    { g: 'spot', file: 'fxc_mirage', tint: '#ff9ad0', at: 'ring', n: 3, sz: 1.2, dur: 0.9, delay: 0.1, under: 1 },
    { g: 'flash', col: '#ffd25a', str: 0.08, dur: 0.4, delay: 0.32 },
    { g: 'shake', amt: 0.06, delay: 0.3 }
  ] },
  u_zuoci: { items: [   // 陰陽幻術:太極大圓盤全屏旋轉
    { g: 'spot', file: 'fxc_yy_taiji', tint: '#c78bff', at: 'screen', sz: 2.0, spin: 1, dur: 1.0, delay: 0, under: 1, a: 0.8 },
    { g: 'flash', col: '#c78bff', str: 0.12, dur: 0.45, delay: 0.1 },
    { g: 'spot', file: 'fxc_yy_flip', tint: '#c78bff', hit: 1, sz: 1.0, dur: 0.6 },
    { g: 'shake', amt: 0.07, delay: 0.3 }
  ] },
  u_nanhua: { items: [   // 五行天書:五色光柱圍陣
    { g: 'spot', file: 'fxc_wx_metal', at: 'pillar', idx: 0, sz: 1.2, rise: 0.4, dur: 0.9, delay: 0 },
    { g: 'spot', file: 'fxc_wx_wood', at: 'pillar', idx: 1, sz: 1.2, rise: 0.4, dur: 0.9, delay: 0 },
    { g: 'spot', file: 'fxc_wx_water', at: 'pillar', idx: 2, sz: 1.2, rise: 0.4, dur: 0.9, delay: 0 },
    { g: 'spot', file: 'fxc_wx_fire', at: 'pillar', idx: 3, sz: 1.2, rise: 0.4, dur: 0.9, delay: 0 },
    { g: 'spot', file: 'fxc_wx_earth', at: 'pillar', idx: 4, sz: 1.2, rise: 0.4, dur: 0.9, delay: 0 },
    { g: 'spot', file: 'fxc_wx_disc', at: 'screen', sz: 1.6, spin: 1, dur: 0.9, delay: 0.1, under: 1 },
    { g: 'flash', col: '#ffe9a8', str: 0.08, dur: 0.4, delay: 0.3 },
    { g: 'spot', file: 'fxc_wx_earth', tint: '#c8b070', hit: 1, sz: 0.7, dur: 0.6, add: 1 },
    { g: 'shake', amt: 0.06, delay: 0.3 }
  ] }
};
var BNSC = { n: 0, max: 16, map: {} };   // 黑化 / 血色剪影快取(上限 16 張,超過就不做剪影)
// 演出用的敵方陣型:存活敵人中心、包圍盒(含邊界補值)、中心
function bnScFormation(P, v) {
  var sd = v.side === 'A' ? 'B' : 'A', L = P.L, k, w, c, F = { list: [], x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, cx: 0, cy: 0 };
  for (k in P.vu) { w = P.vu[k]; if (w.side !== sd || !w.alive) continue; c = bnPlCenter(w); F.list.push(c); F.x0 = Math.min(F.x0, c.x); F.x1 = Math.max(F.x1, c.x); F.y0 = Math.min(F.y0, c.y); F.y1 = Math.max(F.y1, c.y); }
  if (!F.list.length) { F.x0 = F.x1 = L.vw / 2; F.y0 = F.y1 = L.top + (L.vh - L.top - L.bot) * 0.5; }
  F.cx = (F.x0 + F.x1) / 2; F.cy = (F.y0 + F.y1) / 2;
  return F;
}
// 依配置名稱取得實例位置(at):self / center / cells / grid(敵陣 3×3)/ row(陣下三點)/ above(陣上 n 點)/ screen / ring(敵陣周圍 n 點)/ pillar(螢幕環狀第 idx 根)
function bnScPts(P, v, F, at, n, idx) {
  var L = P.L, c = bnPlCenter(v), X0 = F.x0 - L.colW * 0.5, X1 = F.x1 + L.colW * 0.5, Y0 = F.y0 - L.sh * 0.35, Y1 = F.y1 + L.sh * 0.15, out = [], i, a, rx, ry, r, mid = L.top + (L.vh - L.top - L.bot) * 0.5;
  n = n || 1;
  if (at === 'self') out.push(c);
  else if (at === 'center') out.push({ x: F.cx, y: F.cy });
  else if (at === 'cells') { if (F.list.length) out = F.list.slice(); else out.push({ x: F.cx, y: F.cy }); }
  else if (at === 'grid') { for (i = 0; i < 9; i++) out.push({ x: X0 + (X1 - X0) * (i % 3) / 2, y: Y0 + (Y1 - Y0) * Math.floor(i / 3) / 2 }); }
  else if (at === 'row') { for (i = 0; i < 3; i++) out.push({ x: X0 + (X1 - X0) * i / 2, y: Y1 + L.sh * 0.05 }); }
  else if (at === 'above') { for (i = 0; i < n; i++) out.push({ x: X0 + (X1 - X0) * (n < 2 ? 0.5 : i / (n - 1)), y: Y0 - L.sh * 0.2 }); }
  else if (at === 'screen') out.push({ x: L.vw / 2, y: mid });
  else if (at === 'ring') {
    rx = Math.max(L.colW * 1.6, (X1 - X0) * 0.7); ry = Math.max(L.sh * 0.6, (Y1 - Y0) * 0.7);
    for (i = 0; i < n; i++) { a = i / n * 6.283 + 0.5; out.push({ x: Math.max(4, Math.min(L.vw - 4, F.cx + Math.cos(a) * rx)), y: Math.max(L.top, Math.min(L.vh - L.bot, F.cy + Math.sin(a) * ry)) }); }
  } else if (at === 'pillar') { a = (idx | 0) / 5 * 6.283 - 1.571; r = L.vw * 0.3; out.push({ x: L.vw / 2 + Math.cos(a) * r, y: mid + Math.sin(a) * r * 0.5 }); }
  return out;
}
// 剪影來源:施放者第一張已載入的圖(未載入回 null,下一次再用)
function bnScSrc(v) {
  var i, e;
  if (!v || !v.look || !v.look.paths) return null;
  for (i = 0; i < v.look.paths.length; i++) { e = bnDrImg(v.look.paths[i]); if (e.ok) return v.look.paths[i]; }
  return null;
}
// 去色壓暗的剪影(一次處理、快取):透明區不動;dark = 紫黑虛影、red = 血色鬼神。回 canvas 或 null(快取滿 / 圖未載入)
function bnScSil(path, variant) {
  var key = path + '|' + variant, e, cv, c, w, h;
  if (BNSC.map[key]) return BNSC.map[key];
  if (BNSC.n >= BNSC.max) return null;
  e = bnDrImg(path);
  if (!e.ok || !e.img) return null;
  w = e.img.naturalWidth || e.img.width || 64; h = e.img.naturalHeight || e.img.height || 64;
  cv = bnDrNew(w, h); c = cv ? cv.getContext('2d') : null;
  if (!c) return null;
  c.drawImage(e.img, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = variant === 'red' ? 'rgba(150,18,34,0.9)' : 'rgba(18,8,28,0.86)'; c.fillRect(0, 0, w, h);
  c.fillStyle = variant === 'red' ? 'rgba(60,0,8,0.25)' : 'rgba(0,0,0,0.2)'; c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  BNSC.map[key] = cv; BNSC.n++;
  return cv;
}
function bnScShake(P, amt) { return function () { if (!P.skipped && !P.over) P.shake = Math.max(P.shake, Math.min(0.16, amt)); }; }
// 大招逐一受害者演出(BN_FX_ULT_SCENE 的 hit 項):bnPlDmg 在該受害者命中時呼叫(hd = 命中延遲,模擬秒),峰值 = 命中刻(與傷害數字 / 閃白 / 血條同刻)。
// 不在施放時先鋪滿敵陣,而是落在實際受害者身上(閃避 / 未中者不出)。暴擊或單次傷害 ≥ 最大兵力 20% 時放大 1.25 倍。
// 名額 P.uh.left = 該場大招剩餘上限(bnPlUltScene 設定),整場實例仍不超過 24(一般)/ 6(省電)/ 12(低階)。
function bnUltHit(P, vt, e, hd) {
  var uh = P.uh, R = uh && BN_FX_ULT_SCENE.hasOwnProperty(uh.id) ? BN_FX_ULT_SCENE[uh.id] : null, L = P.L, c, feet, big, i, it, H, dur, pkF, f, quiet = bnSigReduce();
  if (!R || !L || !vt || P.skipped || P.noScene || uh.left <= 0) return 0;
  c = bnPlCenter(vt); feet = { x: c.x, y: c.y + L.sh * 0.5 };
  big = !!e.crit || (e.v | 0) >= Math.max(1, vt.mx || 1) * 0.2;
  for (i = 0; i < R.items.length && uh.left > 0; i++) {
    it = R.items[i];
    if (!it.hit) continue;
    H = hd + (it.delay || 0);
    if (it.g === 'pillar') {
      if (bnSigPillar(P, feet, H, { el: it.el, big: big, ph: vt.id * 0.9, quiet: quiet, box: quiet ? null : { w: L.sh * 0.5, h: L.sh * 0.9 } })) uh.left--;
      continue;
    }
    if (it.g === 'spot') {
      dur = (it.dur || 0.8) * bnPlStK(P);
      pkF = Math.max(0.02, Math.min(0.15, H / Math.max(0.01, dur)));   // 峰值正好落在 H(H 很小時峰值前移,不會從半透明跳出)
      f = bnPlFx(P, it.file, c.x, c.y, { file: it.file, tint: it.tint || '', mode: 12, size: L.sh * (it.sz || 1) * (big ? 1.25 : 1), dur: it.dur || 0.8, delay: H - pkF * dur, under: 0,
        ex: { rise: it.rise || 0, add: it.add ? 1 : 0, spin: it.spin || 0, dis: it.dissolve ? 1 : 0, a: it.a || 1, ph: vt.id * 1.7, col: it.col || '#ffe9a8', pk: pkF } });
      if (f) uh.left--;
    }
  }
  return 0;
}
// 大招全螢幕演出(skill 事件、cat = ult 時呼叫;cut-in 之後)。回實際放出的實例數(測試用)
function bnPlUltScene(P, v, id) {
  var R = BN_FX_ULT_SCENE.hasOwnProperty(id) ? BN_FX_ULT_SCENE[id] : null, L = P.L, quiet = bnSigReduce(), ps = !!P.ps, low = !!BNDR.low;
  var cap = ps ? 6 : (low ? 12 : 24), used = 0, F, c, i, j, it, pts, p, f, tg, src, from, fb, ox, oy, e, cutSz;
  P.uh = null;
  if (!R || !v || !L || P.skipped || P.noScene) return 0;
  F = bnScFormation(P, v); c = bnPlCenter(v);
  for (i = 0; i < R.items.length && used < cap; i++) {
    it = R.items[i];
    if (it.hit) continue;   // 逐一受害者的項目由 bnUltHit 於命中刻播放
    if ((it.g === 'flash' || it.g === 'shake') && quiet) continue;
    if ((ps || low) && (it.g === 'ghost' || it.g === 'dragon')) continue;
    if (low && it.g === 'trail') continue;
    if (it.g === 'flash') { if (bnPlFx(P, 'flash', 0, 0, { mode: 10, size: Math.min(0.2, it.str), col: it.col, dur: it.dur || 0.4, delay: it.delay || 0 })) used++; continue; }
    if (it.g === 'shake') { bnPlAt(P, it.delay || 0, bnScShake(P, it.amt)); continue; }
    if (it.g === 'spot') {
      pts = bnScPts(P, v, F, it.at || 'cells', it.n, it.idx);
      for (j = 0; j < pts.length && used < cap; j++) {
        p = pts[j];
        f = bnPlFx(P, it.file, p.x, p.y, { file: it.file, tint: it.tint || '', mode: 12, size: L.sh * (it.sz || 1) * (0.92 + 0.16 * ((j * 7) % 3) / 2), dur: it.dur || 0.8, delay: (it.delay || 0) + j * (it.stag || 0), under: it.under ? 1 : 0,
          ex: { rise: it.rise || 0, add: it.add ? 1 : 0, spin: it.spin || 0, dis: it.dissolve ? 1 : 0, a: it.a || 1, ph: j * 1.7, col: it.col || '#ffe9a8' } });
        if (f) used++;
      }
      continue;
    }
    if (it.g === 'ghost') {
      src = bnScSrc(v); pts = bnScPts(P, v, F, it.at || 'ring', it.n || 4);
      if (!src) { if (used < cap && bnPlFx(P, BN_FX_HERO[id] || 'fx_morale_burst', F.cx, F.cy, { file: BN_FX_HERO[id] || '', alt: 'morale_burst', mode: 7, size: L.sh * 1.6, dur: it.dur || 0.9, delay: it.delay || 0 })) used++; continue; }
      for (j = 0; j < pts.length && used < cap; j++) {
        p = pts[j];
        tg = it.to === 'self' ? c : (it.to === 'up' ? { x: p.x, y: p.y - L.sh * 0.6 } : { x: F.cx, y: F.cy });
        f = bnPlFx(P, 'ghost', p.x, p.y, { x2: tg.x, y2: tg.y, file: src, alt: it.pal || 'dark', mode: 13, size: L.sh * (it.sz || 1.4), dur: it.dur || 0.9, delay: (it.delay || 0) + j * (it.stag || 0), under: 1,
          ex: { a: it.a || 0.5, dis: it.dissolve ? 1 : 0 } });
        if (f) used++;
      }
      continue;
    }
    if (it.g === 'trail') {
      pts = bnScPts(P, v, F, it.at || 'cells', it.n);
      for (j = 0; j < pts.length && used < cap; j++) {
        tg = pts[j];
        if (it.from === 'sky') { ox = tg.x; oy = L.top + L.sh * 0.1; }
        else if (it.from === 'center') { ox = F.cx; oy = F.cy; }
        else { ox = c.x; oy = c.y; }
        f = bnPlFx(P, it.kind, ox, oy, { mode: 8, x2: tg.x, y2: tg.y, size: L.sh * (it.sz || 0.75), col: it.col || '#ffffff', dur: it.dur || 0.42, delay: (it.delay || 0) + j * (it.stag || 0), under: 0 });
        if (f) used++;
      }
      continue;
    }
    if (it.g === 'dragon') {
      pts = bnScPts(P, v, F, it.at || 'cells', it.n);
      for (j = 0; j < pts.length && j < (it.n || 5) && used < cap; j++) {
        tg = pts[j];
        f = bnPlFx(P, 'dragon', c.x, c.y, { mode: 11, x2: tg.x, y2: tg.y, size: L.sh * (it.sz || 1), col: it.col || '#7ff0c8', dur: it.dur || 0.9, delay: (it.delay || 0) + j * (it.stag || 0), ex: { ph: j * 2.1 } });
        if (f) used++;
      }
      continue;
    }
  }
  P.uh = { id: id, src: v.id, left: Math.max(0, cap - used) };   // 逐一命中演出共用的剩餘名額
  return used;
}
// 演出繪製(mode 11 龍形光帶、12 圖片實例、13 剪影);f.t < 0 已由 bnDrFx 略過
function bnScDraw(ctx, P, f, k, L) {
  var ex = f.ex || {}, a, s, x, y, e, e2, sil, h, w, ease, ang, hx, hy, N = 14, i, t, px, py, nx, ny, amp, head, dx, dy, len, ux, uy, ph, sc, pkF;
  function clamp01(q) { return Math.max(0, Math.min(1, q)); }
  if (f.mode === 12) {
    pkF = ex.pk || 0.15;   // 峰值比例(hit 項依命中刻設定;預設 0.15)
    a = k < pkF ? k / pkF : 1 - (k - pkF) / (1 - pkF);
    if (ex.dis) a = k < 0.1 ? k / 0.1 : (1 - k) / 0.9;
    a = clamp01(a) * clamp01(0.85 + 0.15 * Math.sin(k * 38 + (ex.ph || 0))) * (ex.a || 1);
    y = f.y - (ex.rise || 0) * L.sh * k;
    s = f.size * (0.8 + 0.4 * k) * (ex.dis ? 1 + 0.6 * k : 1);
    e = bnDrImg('assets/bnfx/' + f.file + '.webp');
    e2 = e.ok ? bnSigPick(f, e, 'assets/bnfx/' + f.file + '.webp', f.file.indexOf('fx_') === 0) : null;
    ctx.save();
    ctx.globalCompositeOperation = (ex.add || f.file.indexOf('fx_') === 0) ? 'lighter' : 'source-over';
    ctx.globalAlpha = a;
    if (e2) {
      if (ex.spin) { ctx.translate(f.x, y); ctx.rotate(ex.spin * k * 6.283); ctx.drawImage(e2.img, -s / 2, -s / 2, s, s); }
      else ctx.drawImage(e2.img, f.x - s / 2, y - s / 2, s, s);
    } else {
      sc = bnDrGlow(ex.col || '#ffe9a8');
      if (sc) ctx.drawImage(sc, f.x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();
    return;
  }
  if (f.mode === 13) {   // 剪影虛影:由 f.x/f.y(腳下)移向 f.x2/f.y2(smoothstep),淡入後淡出,dissolve 時尾段消散
    a = k < 0.2 ? k / 0.2 : (1 - k) / 0.8;
    if (ex.dis) a = k < 0.2 ? k / 0.2 : Math.max(0, (1 - k) / 0.8);
    a = clamp01(a) * (ex.a || 0.5);
    ease = k * k * (3 - 2 * k);
    x = f.x + (f.x2 - f.x) * ease; y = f.y + (f.y2 - f.y) * ease;
    sil = bnScSil(f.file, f.alt || 'dark');
    if (!sil) { e = bnDrImg(f.file); if (!e.ok) return; sil = e.img; }
    h = f.size * (0.9 + 0.2 * k); w = h * (sil.width || sil.naturalWidth || 1) / (sil.height || sil.naturalHeight || 1);
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
    ctx.drawImage(sil, x - w / 2, y - h, w, h);
    ctx.restore();
    return;
  }
  if (f.mode === 11) {   // 青龍纏刀:沿正弦曲線螺旋的光帶,頭端月牙、尾端淡;命中後在目標身上纏繞
    a = k < 0.1 ? k / 0.1 : Math.max(0, (1 - k) / 0.9);
    head = Math.min(1, k * 1.5);
    dx = f.x2 - f.x; dy = f.y2 - f.y; len = Math.sqrt(dx * dx + dy * dy) || 1; ux = dx / len; uy = dy / len; nx = -uy; ny = ux;
    amp = f.size * 0.22; ph = ex.ph || 0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = f.col; ctx.globalAlpha = a * 0.35; ctx.lineWidth = Math.max(4, f.size * 0.16);
    ctx.beginPath();
    for (i = 0; i <= N; i++) {
      t = i / N * head; px = f.x + dx * t + nx * Math.sin(t * 12.57 + ph + k * 6) * amp * (1 - t * 0.4); py = f.y + dy * t + ny * Math.sin(t * 12.57 + ph + k * 6) * amp * (1 - t * 0.4);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      if (i === N) { hx = px; hy = py; }
    }
    ctx.stroke();
    ctx.globalAlpha = a; ctx.lineWidth = Math.max(1.5, f.size * 0.04); ctx.strokeStyle = '#eafff4'; ctx.stroke();
    ang = Math.atan2(uy, ux);
    if (head > 0) { ctx.strokeStyle = f.col; ctx.lineWidth = Math.max(2, f.size * 0.07); ctx.beginPath(); ctx.arc(hx, hy, f.size * 0.12, ang - 0.9, ang + 0.9); ctx.stroke(); }
    if (k > 0.5 && ctx.ellipse) {   // 纏刀:目標身上的繞環
      ctx.globalAlpha = a * 0.8; ctx.strokeStyle = f.col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(f.x2, f.y2, f.size * 0.35, f.size * 0.12, k * 8, 0, 6.283); ctx.stroke();
    }
    ctx.restore();
  }
}
if (typeof module !== 'undefined' && module.exports) module.exports = { BNPL_T: BNPL_T };
