// fishdata.js — 釣魚資料(PLAN_FISHING F0:單一釣場、三深度層各一種魚、均衡釣具;另含計分 / 稱號 / 船皮膚 / 排行榜常數)
// 欄位與數值出自 PLAN_FISHING §2、§3;F0 只啟用 鰷 / 鯉 / 鯰、竹竿、均衡組合(中繩 / 中鉤 / 重墜)。
// 季節、早晚、水域與地區欄位保留在資料中,F0 的生成器暫不讀取(見回報)。

const FISH = [
  { id:'minnow', name:'鰷', rar:'common', min:8, max:18, reg:['home','north','central','jing','yang','jiao'], w:['r','l'],
    sea:['spring','summer','autumn'], tod:['day'], bait:['worm','dough'],
    depth:1, crawl:false, spd:5, diff:1, mod:'', shy:true, legend:null,
    tpl:'fish', look:{ body:[1, 0.22], head:0.3, tail:'fork', dorsal:'short', barbel:0,
      c:['#9fd8e8','#f4fbff','#bfe6f0'], pat:'hband', patC:'#4a8fb0', glow:false, wing:false },
    desc:'《莊子·秋水》濠梁之辯:「儵魚出遊從容。」儵即鰷。成群游動,速度很快。',
    aq:{ school:true } },
  { id:'carp', name:'鯉', rar:'common', min:20, max:80, reg:['home','north','central','jing','yang'], w:['r','l'],
    sea:['spring','summer','autumn','winter'], tod:['day','dusk','night'], bait:['worm','dough'],
    depth:2, crawl:false, spd:2, diff:2, mod:'', shy:false, legend:null,
    tpl:'fish', look:{ body:[1, 0.42], head:0.3, tail:'fork', dorsal:'long', barbel:2,
      c:['#d9a441','#f7e7b0','#c97a2a'], pat:'scale', patC:'#8a5a1d', glow:false, wing:false },
    desc:'《詩經·陳風·衡門》:「豈其食魚,必河之鯉。」自古就是上等魚。據《孔子家語》,孔子之子因魯君所賜之鯉而取名為「鯉」。',
    aq:{ school:false } },
  { id:'catfish', name:'鯰', rar:'common', min:25, max:90, reg:['home','north','central','jing','yang'], w:['r','l'],
    sea:['summer','autumn'], tod:['dusk','night'], bait:['worm','minnow'],
    depth:3, crawl:false, spd:1, diff:2, mod:'pull+', shy:false, legend:null,
    tpl:'fish', look:{ body:[1, 0.28], head:0.3, tail:'round', dorsal:'short', barbel:2,
      c:['#5b5a4e','#cfc7a6','#3e3d35'], pat:'mottle', patC:'#2e2d26', glow:false, wing:false },
    desc:'《詩經·小雅·魚麗》:「魚麗于罶,鰋鯉。」鰋即鯰(推定通說)。有鬚,夜裡出來覓食。',
    aq:{ school:false } }
];

const FISH_RARITY = {
  common:    { name:'常見', w:60, c:'#9ea3ab' },
  uncommon:  { name:'少見', w:25, c:'#5ab4d8' },
  rare:      { name:'稀有', w:10, c:'#b07ce8' },
  legendary: { name:'傳說', w:2,  c:'#e6b84a' }
};

const FISH_SPD = [0, 0.06, 0.10, 0.15, 0.21, 0.28];

const FISH_DIFF = {
  1: { fight:false, tap:0, decay:0, thrash:0 },
  2: { fight:true, tap:8, decay:10, thrash:0 },
  3: { fight:true, tap:6, decay:14, thrash:[2, 3.5] }
};

// ===== 版面(PLAN_FISHING §1.6 的延伸:直版 / 橫版) =====
// 邏輯座標:直版固定 390×844;橫版高固定 390、寬依螢幕長寬比(水面至少佔 60% 寬,不拉伸)。
// 方向決定版面,遊戲狀態不影響版面:同一方向下所有按鈕矩形永遠相同,只有旋轉螢幕才換一套。
//
// 按鈕座標表(px 為螢幕 CSS 像素,邏輯座標 ×s 後加 ox/oy;安全區 = env(safe-area-inset-*),M = 12 px 額外邊距,鈕 ≥ 44 px):
//   ┌ 直版 portrait(sw ≤ sh)──────────────────────────────────────────┐
//   │ ↩ 離開   左上 (安全左+12, 安全上+12)  44×44                        │
//   │ 📖 圖鑑  右上 (sw−安全右−12−44, 安全上+12)  44×44                  │
//   │ 資訊 HUD 左上,位於 ↩ 之下 (x 安全左+12, y 安全上+66),寬 ≤ 250     │
//   │ 角度盤  邏輯 (200,736) 半徑 62(下半弧)                           │
//   │ ◀ 中心 邏輯 (38,774)   ▶ 中心 邏輯 (92,774)   各 44×44 px           │
//   │ 拋/收/拉 邏輯 (334,774) 半徑 38(直徑約 73 px)                     │
//   └────────────────────────────────────────────────────────────────┘
//   ┌ 橫版 landscape(sw > sh):左欄 ↩ 📖 與資訊 HUD;中央水面;右欄角度盤與拋 ──┐
//   │ ↩ 離開   左欄第一顆 (安全左+12, 安全上+12)  44×44                     │
//   │ 📖 圖鑑  左欄第二顆 (安全左+12, 安全上+64)  44×44                     │
//   │ 資訊 HUD 左欄 (x 安全左+12, y 安全上+118),寬 = 左欄寬 −24              │
//   │ 右欄中心 cxR = W + 右欄寬邏輯/2                                       │
//   │ 角度盤  邏輯 (cxR,118) 半徑 40                                       │
//   │ ◀ 中心 邏輯 (cxR−26,186)   ▶ 中心 邏輯 (cxR+26,186)                    │
//   │ 拋/收/拉 邏輯 (cxR,H−62=328) 半徑 38                                  │
//   └──────────────────────────────────────────────────────────────────────┘
// 停用(例如拋竿中的 ◀ ▶、非可拋時的拋鈕)只改灰階與透明度(.fu-dis),位置與尺寸不變。
//
// 1~3 = 深度層的上下界(邏輯 y);floor = 水底;surf = 水面線(直版 = 844 × 18%,天空與 HUD 帶在上方)。
// ui 為角度盤與拋鈕的邏輯座標(fishui.js 與 fishdraw.js 共用);physics 只讀 W、H、surf、floor、1~3。
function fishClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 依螢幕尺寸與安全區算版面。ins = {t,r,b,l}(px,可為 null)。回傳 view,fishLayerSet 會寫入 FISH_LAYER。
function fishLayoutCalc(sw, sh, ins) {
  var I = ins || { t: 0, r: 0, b: 0, l: 0 }, uw = Math.max(1, sw - I.l - I.r), uh = Math.max(1, sh - I.t - I.b),
    v, cl, cr, cxR;
  v = { sw: sw, sh: sh, ins: I, orient: sw > sh ? 'landscape' : 'portrait', s: 1, ox: 0, oy: 0, W: 390, H: 844, colL: 0, colR: 0 };
  if (v.orient === 'landscape') {
    v.H = 390;
    v.s = uh / v.H;
    cl = fishClamp(Math.round(uw * 0.14), 100, 140);
    cr = fishClamp(Math.round(uw * 0.18), 110, 170);
    while (uw - cl - cr < uw * 0.6 && (cl > 100 || cr > 110)) { if (cr > 110) cr--; else cl--; }
    v.colL = cl; v.colR = cr;
    v.W = (uw - cl - cr) / v.s;
    v.ox = I.l + cl; v.oy = I.t;
    cxR = v.W + (cr / v.s) / 2;
    v.ui = { dialX: cxR, dialY: 118, dialR: 40, mainX: cxR, mainY: 328, mainR: 38, angLX: cxR - 26, angLY: 186, angRX: cxR + 26, angRY: 186 };
  } else {
    v.s = Math.min(uw / 390, uh / 844);
    v.ox = I.l + (uw - 390 * v.s) / 2; v.oy = I.t + (uh - 844 * v.s) / 2;
    v.ui = { dialX: 200, dialY: 736, dialR: 62, mainX: 334, mainY: 774, mainR: 38, angLX: 38, angLY: 774, angRX: 92, angRY: 774 };
  }
  // 螢幕在邏輯座標中的範圍(含左右欄與邊界外),供 fishdraw 補底色
  v.bg = { x0: -v.ox / v.s, y0: -v.oy / v.s, x1: (sw - v.ox) / v.s, y1: (sh - v.oy) / v.s };
  return v;
}

// 深度層與水面:直版水底固定 690;橫版水底 = H − 40。
function fishLayerOf(W, H, portrait) {
  var surf = Math.round(H * 0.18), fl = portrait ? 690 : H - 40, span = fl - surf,
    l1 = surf + Math.round(span * 218 / 648), l2 = surf + Math.round(span * 438 / 648);
  return { 1: [surf, l1], 2: [l1, l2], 3: [l2, fl], floor: fl, surf: surf, W: W, H: H };
}

var FISH_LAYER = {};
function fishLayerSet(v) {
  var L = fishLayerOf(v.W, v.H, v.orient === 'portrait'), k;
  for (k in L) FISH_LAYER[k] = L[k];
  FISH_LAYER.ui = v.ui;
  FISH_LAYER.bg = v.bg;
}
fishLayerSet(fishLayoutCalc(390, 844, null));

const FISH_RODS = {
  bamboo: { name:'竹竿', ang:45, cap:3, reel:1.0, note:'無特殊能力,預設' }
};

const FISH_LINES = {
  fast: { name:'快繩', vh:420, ang:30 },
  mid:  { name:'中繩', vh:300, ang:45 },
  slow: { name:'慢繩', vh:220, ang:60 }
};

const FISH_HOOKS = {
  small: { name:'小鉤', hr:5,  mult:1.1 },
  mid:   { name:'中鉤', hr:10, mult:1.0 },
  big:   { name:'大鉤', hr:18, mult:0.8 }
};

const FISH_SINKS = {
  shallow: { name:'輕墜', y:FISH_LAYER[1][1] },
  mid:     { name:'中墜', y:FISH_LAYER[2][1] },
  deep:    { name:'重墜', y:FISH_LAYER.floor }
};

// 彩頭:計分(PLAN_FISHING「計分帶」):每層一條互不重疊的基礎分帶(連擊前),層內依稀有度與尺寸浮動;連擊倍率 1.0~1.3(見 fishing.js fishScoreOf)。
// 分數帶表與不重疊驗證見 PLAN_FISHING.md 與 tools/test_fish.js。雜物 / 奇物固定分、稱號門檻、船皮膚、挑戰時限選項、排行榜筆數、金幣換算(分數 / 20)。
const FISH_BAND = { 1: [4, 8], 2: [11, 20], 3: [26, 40] };
const FISH_RAR_Q = { common: 0, uncommon: 1 / 3, rare: 2 / 3, legendary: 1 };
const FISH_COMBO_STEP = 0.03;
const FISH_COMBO_CAP = 10;
const FISH_JUNK_PTS = -5;
const FISH_ODD_PTS = 40;
const FISH_TITLES = [
  { min: 100,  name: '初出茅廬' },
  { min: 300,  name: '垂釣能手' },
  { min: 600,  name: '漁翁得利' },
  { min: 1000, name: '江湖釣叟' },
  { min: 2000, name: '釣魚神' }
];
const FISH_SKINS = {
  raft: { name: '竹筏', need: '' },
  wu:   { name: '烏篷船', need: '垂釣能手' },
  hua:  { name: '畫舫', need: '江湖釣叟' }
};
const FISH_TIME_OPTS = [60, 90, 120];
const FISH_BOARD_N = 10;
const FISH_GOLD_DIV = 20;

const FISH_PRESETS = {
  balanced: { name:'均衡', rod:'bamboo', line:'mid', hook:'mid', sink:'deep' }
};

const FISH_BAITS = {
  worm: { name:'蚯蚓' }
};

const FISH_REGIONS = {
  home: { name:'自家水域', on:true }
};

const FISH_KEY = 'lorddomain.fish.v1';
