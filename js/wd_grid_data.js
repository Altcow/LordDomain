// js/wd_grid_data.js — 大地圖(19×19 靜態格子)資料表與純查詢函式(設計_49格地圖_整合規格.md 第 7 版,第 14 節 A 包)。
// 純資料 + 純函式:不碰 DOM / 存檔、不讀時間(時間由呼叫端傳入)、不用 Math.random;不含路徑、占領、刷新邏輯(那是 K / B 包)。
// 所有數字 PLACEHOLDER,集中在這裡,最後統一調(工作包 I)。ES2017,不用 ?. ??,UTF-8 + CRLF。
// 載入順序:mat.js、wd_data.js 之後(index.html、sw.js PRECACHE 同步)。目前沒有任何程式引用本檔;功能旗標 FEATURES.grid49 預設 false(js/features.js,登錄為 planned)。
// 執行期只在呼叫時才讀 twPowerV(tower.js,只讀不改)與 MATS(mat.js,不讀,僅在測試驗證材料 id),因此載入先後不影響。
// 全域名:
//   資料:GRID_CFG GRID_RES GRID_FIXED GRID_TERR GRID_SPECIAL GRID_TPL GRID_OTPL GRID_WORK GRID_BLD GRID_BLD_RULE
//   函式:gridInterp gridVisionAt gridCapAt gridBandOf gridResOf gridRingOf gridMinsOfL gridFoePowOf gridBossFloor gridBossPowerV gridBldOf gridTplCells gridInnerToFull
// 座標:格號 gi = r × 19 + c(c、r 為 0~18),主城 (9,9) = gi 180;圈 R = max(|c−9|, |r−9|)(1~9,每圈 8R 格);內圈 = 第 1~5 圈(中央 11×11),外圍 = 第 6~9 圈。
// 內圈版型座標 (c, r) 為 0~10,放進全圖 = (c + 4, r + 4);外環版型座標就是全圖座標。
// 版型字元圖例(見 GRID_TERR / GRID_SPECIAL):. 空地(隨機格:資源領地 / 山寨)、~ 河、f 淺灘、^ 山、o 大石、x 障礙建築、R 廢墟;
//   C 主城、J 郡、G 關、K 縣、B 名將營(只出現在內圈版型,位置六張版型一致 = GRID_FIXED;外環版型內圈那塊以空白代替)。

var GRID_CFG = {
  size: 19, center: 9, gi0: 180,                 // 邊長、中心座標、主城格號
  rings: 9, innerRings: 5, innerSize: 11, innerOff: 4,
  ringCells: [8, 16, 24, 32, 40, 48, 56, 64, 72],   // 每圈格數 8R(index = 圈 − 1)

  // 視野:第 R 圈開放所需「本季名聲」(index = 圈 − 1);第 1~2 圈開局
  visionAt: [0, 0, 600, 1500, 3000, 5500, 9000, 12000, 16000],
  // 占領上限錨點 [名聲, 上限],中間線性內插、取整(無條件捨去);20,000 以上 = 200
  capCurve: [[0, 5], [600, 12], [1500, 22], [3000, 40], [5500, 65], [9000, 100], [14000, 145], [20000, 200]],

  // 等級帶:index = 圈 − 1;lo = 未開放高級地、hi = 開放後;項目 [Lv, 權重%](每列加總 100)
  band: [
    { lo: [[1, 60], [2, 40]], hi: [[1, 60], [2, 40]] },
    { lo: [[2, 50], [3, 50]], hi: [[2, 50], [3, 50]] },
    { lo: [[3, 50], [4, 50]], hi: [[3, 50], [4, 50]] },
    { lo: [[4, 50], [5, 50]], hi: [[4, 50], [5, 50]] },
    { lo: [[5, 50], [6, 50]], hi: [[5, 50], [6, 50]] },
    { lo: [[5, 40], [6, 60]], hi: [[6, 60], [7, 40]] },
    { lo: [[6, 100]], hi: [[6, 30], [7, 40], [8, 30]] },
    { lo: [[6, 100]], hi: [[7, 30], [8, 40], [9, 30]] },
    { lo: [[6, 100]], hi: [[8, 35], [9, 40], [10, 25]] }
  ],
  hiMinRing: 6,                                  // Lv7+ 只出現在第 6~9 圈
  // 高級地開放條件:本季名聲 ≥ fame、本季打下 Lv ≥ lv 的領地累計 w5 塊、開檔滿 days 天(三者都要)
  hi: { fame: 2000, lv: 5, w5: 8, days: 3 },

  // 行軍:去程(分)= clamp(minsMin, minsMax, minBase + minK × L × spd × 行軍方式),四捨五入到 0.1;回程 = 去程 ÷ retDiv
  minK: 0.6, minBase: 1.0, minsMin: 2, minsMax: 10, retDiv: 4,
  spd: { '騎': 0.85, '弓': 1.0, '槍': 1.0, '械': 1.25, '謀': 1.05, '盾': 1.10 },   // 取隊上最慢兵種
  march: { steady: { mul: 1, troop: 1 }, rush: { mul: 0.67, troop: 0.9 } },   // 穩進 / 急行(抵達兵力 −10%)

  // 野怪(靜態):每 everyMs 在 1 個「無主、可占、去程 ≤ maxMins、在視野內」的格出現 1 隻,最多 max 隻;受傷後 resetMs 重置
  beast: { max: 6, everyMs: 5 * 60000, maxMins: 7, resetMs: 10 * 60000 },
  // 山寨:最多 max 座,疊在可占格上、第 minRing 圈以外,不算個人領地
  camp: { max: 6, minRing: 3 },
  // 守軍強度查表(index = Lv − 1)。foeV = 基準 v(採集領地規格 2.1,直接由領地等級查表);
  // foePow = 估計戰力(只給自動派遣快速篩選與清單排序,不用於格上;PLACEHOLDER:2026-11-15 以現行 bnStgBuildTeam 對各章名冊抽樣 40 次平均後平滑,戰鬥引擎改動後要重量)
  foeV: [34, 40, 46, 52, 58, 64, 76, 88, 100, 115],
  foePow: [1200, 1300, 1400, 1500, 1650, 1800, 2000, 2200, 2450, 2600],
  // 新手旋鈕:開季前 newbieHours 小時產量 × newbieMul(預設 1 = 關;規格需決定 N3,玩過覺得前期太窮才設 2)
  newbieMul: 1, newbieHours: 72,

  // 名將營(承接高塔):count 座 × steps 階;第 k 座第 j 階 = 高塔第 (k−1)×steps + j 層,強度 = twPowerV(層)
  boss: { count: 10, steps: 10 },

  tplDefault: 'A', otplDefault: 'A'              // 驗證失敗時退回「內圈 A + 外環 A」
};

// 資源領地:每塊空地一定是五種之一。base = Lv1 每小時基礎產量(已 × 0.22);w = 出現權重 %;out = 產出物(材料 id 或糧);
// 每格每小時 = base × mul[Lv − 1] ×(寶地 treasure);累積上限 accH 小時、一鍵收取。key 同時是 GRID_BLD 的資源種類鍵。
var GRID_RES = {
  list: [
    { key: 'grain', name: '農田', out: 'grain', outName: '糧', base: 6.6, w: 40, via: 'res4Add' },
    { key: 'm_iron1', name: '礦坑', out: 'm_iron1', outName: '生鐵', base: 0.044, w: 18, via: 'matGrant' },
    { key: 'm_hide1', name: '獵場', out: 'm_hide1', outName: '獸皮', base: 0.044, w: 18, via: 'matGrant' },
    { key: 'm_coal', name: '林場', out: 'm_coal', outName: '木炭', base: 0.066, w: 16, via: 'matGrant' },
    { key: 'm_whet', name: '採石場', out: 'm_whet', outName: '礪石', base: 0.022, w: 8, via: 'matGrant' }
  ],
  mul: [1, 1.5, 2.2, 3.2, 4.5, 6.5, 10, 13, 17, 22],   // 等級倍率 Lv1~10
  treasure: 2,                                          // 寶地 ×2
  accH: 12                                              // 累積上限(小時)
};

// 固定格(內圈版型座標,六張版型一致;旋轉 / 鏡射時整組一起轉,縣郡關名稱在旋轉後才指定)
// boss 依「圈由內往外、同圈由正北順時針」排序 = 第 1~10 座名將營(第 k 座要先通過第 k−1 座第 10 階)
var GRID_FIXED = {
  city: [5, 5],
  jun: [[0, 0], [10, 10]],
  pass: [[5, 0], [10, 5], [0, 5]],
  county: [[5, 2], [8, 5], [5, 8], [2, 5], [2, 2], [8, 8]],
  boss: [[5, 3], [7, 6], [8, 3], [2, 7], [9, 8], [4, 9], [1, 3], [10, 1], [7, 10], [0, 9]]
};

// 地形(不算領地、不占名額)。walk:能走;mul:路徑成本倍率;第一季永遠不可改(work 預留給第二季工程)
var GRID_TERR = {
  '~': { id: 'river', name: '河', walk: false, mul: 0, note: '不能通行', work: 'bridge' },
  'f': { id: 'ford', name: '淺灘', walk: true, mul: 1.5, note: '可通行 ×1.5,不能占', work: 'bridge' },
  '^': { id: 'mount', name: '山', walk: false, mul: 0, note: '不能通行', work: 'path' },
  'o': { id: 'rock', name: '大石', walk: false, mul: 0, note: '不能通行', work: 'clear' },
  'x': { id: 'block', name: '障礙建築', walk: false, mul: 0, note: '不能通行', work: 'clear' },
  'R': { id: 'ruin', name: '廢墟', walk: false, mul: 0, note: '不能通行(純地形,不承載軍事建築)', work: 'clear' }
};
// 第二季以後工程結果的地形值域(第一季存檔只預留,讀到一律忽略):橋 ×1 可走、山道 ×1.5 可走、清除 = 空地
var GRID_TERR_WORK = { bridge: { walk: true, mul: 1 }, path: { walk: true, mul: 1.5 }, clear: { walk: true, mul: 1, becomesLand: true } };
// 特殊格(都能走、都不算個人領地)
var GRID_SPECIAL = {
  'C': { id: 'city', name: '主城' },
  'J': { id: 'jun', name: '郡' },
  'G': { id: 'pass', name: '關' },
  'K': { id: 'county', name: '縣' },
  'B': { id: 'boss', name: '名將營' }
};

// 內圈版型(11×11,每個 11 字元一列,列 r = 0~10、字元 c = 0~10)。A = 預設版型(規格 2.3 原樣)。
var GRID_TPL = {
  A: { name: '河谷', rows: [
      'J....G.~.R.',
      '...^^..~..B',
      '..K..Kx.f..',
      '.B...B..B~.',
      '...o......~',
      'G.K..C..K.G',
      '...R...B.^.',
      '~~B......^.',
      '..f..K.oKB.',
      'BR..B......',
      '.......B..J'
  ] },
  B: { name: '雙山', rows: [
      'J....G.....',
      '......x..fB',
      '..K^.K...~.',
      '.B.^^B..B~.',
      '...^.....~.',
      'G.K..C..KoG',
      '.R.....B...',
      '..B....^^..',
      '.o...K^^KB.',
      'B...B......',
      '.~f~...B..J'
  ] },
  C: { name: '斷橋', rows: [
      'J....G.~...',
      '.......~R.B',
      '..Ko.K.f...',
      '.B...B.~B..',
      '..o....~...',
      'G.K..C..K.G',
      '...x...B.^.',
      '..B......^^',
      '~f~~.K..KB^',
      'B...B.o....',
      '.......B..J'
  ] },
  D: { name: '亂石崗', rows: [
      'J....G.....',
      '..........B',
      '..Ko.K.o..f',
      '.B...Bx.B.~',
      '..o......o~',
      'G.K..C..K.G',
      'fo.....B.x.',
      '~.Bo.......',
      '~...xK.oKB.',
      'B...B.o.R..',
      '.......B..J'
  ] },
  E: { name: '古城廢墟', rows: [
      'J....G..^^.',
      '~...x....^B',
      'f.K..K.R...',
      '~B.R.B..B..',
      '.........x.',
      'G.K..C..K.G',
      '..R....B..~',
      '..B.....R.~',
      '...x.K..KBf',
      'B...B.R...~',
      '.......B..J'
  ] },
  F: { name: '山河交錯', rows: [
      'J....G.....',
      '..........B',
      '..K..K.f...',
      '.BR.xB.~B..',
      '.......~.R.',
      'G.K..C..K.G',
      '...~...B.o.',
      '..Bf..o....',
      '.^.~.K..KB.',
      'B^^~B...^^.',
      '.......BR^J'
  ] }
};

// 外環版型(第 6~9 圈,全圖座標 19×19 每列 19 字元;內圈 11×11 以空白代替)。第 6 圈沒有不可走格,保證與內圈接得上。
// 每張:河 2 段(各帶 1 淺灘)、山 3~4 群、大石 6、障礙建築 2~3、廢墟 1~2。
var GRID_OTPL = {
  A: { name: '雙河', rows: [
      '........x...~......',
      '.^^...o.....~f~....',
      '.^.......o....~..R.',
      '...................',
      '....           ....',
      '....           ..o.',
      '^...           ....',
      '^^..           ....',
      '.^..           ....',
      '....           ....',
      '....           ..^^',
      '.~..           ..^^',
      '.~o.           ....',
      '.f..           ...x',
      '.~..           ....',
      '.~................^',
      '.................^^',
      '............o......',
      '.....x.........o...'
  ] },
  B: { name: '四山', rows: [
      '...o.^^.......o....',
      '.....^^....^^....x.',
      '............^...R..',
      'o..................',
      '....           ...o',
      '....           ....',
      '....           ....',
      '~~..           ....',
      '.f~.           ....',
      '..~.           ....',
      '....           ....',
      '....           ..~~',
      '....           .~f.',
      '....           .~..',
      '....           ....',
      '..................o',
      'o......^.......^...',
      '...R...^^.....^^...',
      '........^x.........'
  ] },
  C: { name: '環河', rows: [
      '...^^....o..o..^^..',
      '...^...........^^..',
      '.............o.....',
      '...................',
      '....           ....',
      '....           .o.R',
      '.~..           ....',
      '.~..           ....',
      '.f..           ...^',
      '.~..           ..^^',
      '.~..           ....',
      '....           ....',
      '....           ....',
      'o...           ....',
      '....           ..x.',
      '...................',
      '.x...o.............',
      '....R..~~f~~..^^...',
      '.............^^....'
  ] },
  D: { name: '四隅山', rows: [
      '^^.....^^.........o',
      '^^......^..........',
      '.....o...x....R..~.',
      '.................~.',
      '....           ..f.',
      '....           ..~.',
      '..o.           ..~.',
      '....           ..~.',
      '....           ....',
      'x...           ...x',
      '....           ....',
      '....           ....',
      '~...           .o..',
      'f...           ....',
      '~...           ....',
      '...................',
      '....R........o.....',
      '..........^......^^',
      'o.........^^.....^^'
  ] },
  E: { name: '遺跡', rows: [
      'R...o...^^^..o.....',
      '.........^.........',
      '.......x.........^^',
      '................o.^',
      '....           ....',
      '..~.           ....',
      '..~.           ..o.',
      '..f.           ....',
      '..~.           ....',
      '..~.           .~..',
      '....           .~..',
      '....           .f..',
      '.o..           .~..',
      '....           .~..',
      '....           ....',
      '^................x.',
      '^^..........x......',
      '....^^.............',
      '.....^.....o......R'
  ] },
  F: { name: '山河環', rows: [
      '.........^^..x.....',
      '......o...^........',
      '........o..........',
      '.~..............o..',
      '.~..           ....',
      '.f..           ....',
      '.~..           ...^',
      '.~..           ..^^',
      '....           ....',
      '....           ....',
      '^...           .~..',
      '^^..           .~..',
      '.^..           .fo.',
      '....           .~..',
      '..o.           .~..',
      '...................',
      '.x.R...............',
      '........^^^........',
      '.....o...^.........'
  ] }
};

// 第一季預留空表:工程不開放(清障 / 修橋 / 鑿山道 等第二季以後才填)
var GRID_WORK = { open: false, list: {} };

// 軍事建築(蓋在自己已占領的資源領地上;不另占名額、產量照常):minLv 土地等級門檻、kinds 資源種類('any' 或 GRID_RES key 陣列)、
// cap 單類上限、fame 本季名聲門檻、cost 成本({鍵: 數量};grain = 糧,其餘材料 id)、hours 建造時間(小時)。
var GRID_BLD = {
  sentry: { name: '哨站', minLv: 3, kinds: 'any', cap: 2, fame: 3000, cost: { grain: 3000, m_iron1: 15, m_coal: 15 }, hours: 1,
            effect: { tripMul: 0.8, ring: 2, stack: false } },          // 2 圈內目標格去程 −20%,多座取最近一座不疊加
  barracks: { name: '軍營', minLv: 6, kinds: 'any', cap: 1, fame: 5500, cost: { grain: 6000, m_iron1: 30, m_hide1: 30 }, hours: 2,
            effect: { rsvCostMul: 0.8 } },                              // 補兵糧耗 −20%(1 兵 = 0.8 糧)
  granary: { name: '糧倉', minLv: 7, kinds: ['grain'], cap: 1, fame: 9000, cost: { grain: 8000, m_coal: 30, m_whet: 15 }, hours: 3,
            effect: { accH: 16 } },                                     // 所有領地累積上限 12 → 16 小時
  beacon: { name: '烽燧', minLv: 8, kinds: 'any', cap: 1, fame: 9000, cost: { grain: 5000, m_whet: 20, m_coal: 20 }, hours: 3,
            effect: { fogRing: 2 } }                                    // 2 圈內提前去霧
};
var GRID_BLD_RULE = { total: 4, concurrent: 1, refund: 0.5 };           // 個人合計最多 4 座、同時只能建 1 座;取消 / 拆除退 50% 材料(糧規則見規格 5.3)

// ───────── 純函式(只查表與內插) ─────────
// 錨點內插:anchors = [[x, y], …](x 遞增);小於首點取首點、大於末點取末點;回傳實數(呼叫端取整)
function gridInterp(anchors, x) {
  var i, a, b;
  x = Number(x);
  if (!isFinite(x)) x = 0;
  if (x <= anchors[0][0]) return anchors[0][1];
  for (i = 1; i < anchors.length; i++) {
    if (x < anchors[i][0]) { a = anchors[i - 1]; b = anchors[i]; return a[1] + (x - a[0]) / (b[0] - a[0]) * (b[1] - a[1]); }
  }
  return anchors[anchors.length - 1][1];
}
// 名聲 → 視野圈(2~9):名聲 ≥ visionAt[R − 1] 的最大 R
function gridVisionAt(fame) {
  var v = GRID_CFG.visionAt, R = 0, i;
  fame = Number(fame);
  if (!isFinite(fame) || fame < 0) fame = 0;
  for (i = 0; i < v.length; i++) if (fame >= v[i]) R = i + 1;
  return R;
}
// 名聲 → 占領上限(5~200):錨點線性內插、無條件捨去
function gridCapAt(fame) { return Math.floor(gridInterp(GRID_CFG.capCurve, fame) + 1e-9); }
// 某圈(1~9)的等級帶:[{lv, p}](p = 權重 / 100,加總 1);hi = 是否已開放高級地
function gridBandOf(ring, hi) {
  var b, t;
  ring = Math.floor(Number(ring));
  if (!(ring >= 1)) ring = 1;
  if (ring > GRID_CFG.rings) ring = GRID_CFG.rings;
  b = GRID_CFG.band[ring - 1];
  t = hi ? b.hi : b.lo;
  return t.map(function (x) { return { lv: x[0], p: x[1] / 100 }; });
}
// 格號 → 圈 R(0 = 主城);超出範圍回 −1
function gridRingOf(gi) {
  var n = GRID_CFG.size, c, r;
  gi = Math.floor(Number(gi));
  if (!(gi >= 0 && gi < n * n)) return -1;
  c = gi % n; r = (gi - c) / n;
  return Math.max(Math.abs(c - GRID_CFG.center), Math.abs(r - GRID_CFG.center));
}
// 資源領地每小時 / 每天產量:type = key(grain、m_iron1…)或格名(農田…);lv 1~10;回 {key, name, out, outName, lv, perHour, perDay} 或 null
function gridResOf(type, lv) {
  var L = GRID_RES.list, i, e = null, m, ph;
  for (i = 0; i < L.length; i++) if (L[i].key === type || L[i].name === type || L[i].out === type || L[i].outName === type) { e = L[i]; break; }
  if (!e) return null;
  lv = Math.floor(Number(lv));
  if (!(lv >= 1)) lv = 1;
  if (lv > GRID_RES.mul.length) lv = GRID_RES.mul.length;
  m = GRID_RES.mul[lv - 1];
  ph = Math.round(e.base * m * 1e6) / 1e6;
  return { key: e.key, name: e.name, out: e.out, outName: e.outName, lv: lv, perHour: ph, perDay: Math.round(ph * 24 * 1e6) / 1e6 };
}
// 去程分鐘(只算公式,不含路徑):L = 路徑長;spd = 兵種係數(GRID_CFG.spd);mode = 'steady' | 'rush'
function gridMinsOfL(L, spd, mode) {
  var C = GRID_CFG, mm = C.march[mode] || C.march.steady, v = C.minBase + C.minK * Number(L) * (spd > 0 ? spd : 1) * mm.mul;
  v = Math.max(C.minsMin, Math.min(C.minsMax, v));
  return Math.round(v * 10) / 10;
}
// Lv(1~10)→ 守軍估計戰力
function gridFoePowOf(lv) {
  lv = Math.floor(Number(lv));
  if (!(lv >= 1)) lv = 1;
  if (lv > GRID_CFG.foePow.length) lv = GRID_CFG.foePow.length;
  return GRID_CFG.foePow[lv - 1];
}
// 名將營:第 k 座(1~10)第 j 階(1~10)→ 高塔層數 (k−1)×10 + j
function gridBossFloor(k, j) {
  var B = GRID_CFG.boss;
  k = Math.max(1, Math.min(B.count, Math.floor(Number(k)) || 1));
  j = Math.max(1, Math.min(B.steps, Math.floor(Number(j)) || 1));
  return (k - 1) * B.steps + j;
}
// 名將營該階敵方基準 v:只引用 tower.js 的 twPowerV(不改);沒載入 tower.js 回 null
function gridBossPowerV(k, j) { return (typeof twPowerV === 'function') ? twPowerV(gridBossFloor(k, j)) : null; }
// 軍事建築定義(找不到回 null)
function gridBldOf(id) { return GRID_BLD.hasOwnProperty(id) ? GRID_BLD[id] : null; }
// 內圈座標 → 全圖座標 / 格號
function gridInnerToFull(c, r) { var o = GRID_CFG.innerOff; return { c: c + o, r: r + o, gi: (r + o) * GRID_CFG.size + c + o }; }
// 版型 rows → 格清單 [{c, r, ch}](只列非空地、非空白字元;內圈版型回內圈座標,外環版型回全圖座標)
function gridTplCells(rows) {
  var out = [], r, c, ch;
  for (r = 0; r < rows.length; r++) for (c = 0; c < rows[r].length; c++) {
    ch = rows[r].charAt(c);
    if (ch !== '.' && ch !== ' ') out.push({ c: c, r: r, ch: ch });
  }
  return out;
}
