// js/wmap_army_art.js — M1 W4 軍隊模型的程式繪圖(設計_軍隊模型與旗幟_規格.md 1.2、1.3、2.1~2.3、3.2、3.4;設計_M1視覺原型_實作計畫.md 5.1)。
// 正式 GPT 圖到之前的替代:載入後第一次用到時畫進離屏 canvas 並快取,之後只 drawImage。圖到了只換本檔的三個登錄函式(wmapArmyArtSheet / wmapArmyArtFlag / wmapArmyArtBadge),wmap_army.js 不動。
// 風格:Q 版卡通、深褐 #4A2A14 粗描邊、平塗 + 一階陰影、光源左上;士兵兵種中性(皮甲、頭巾盔、長槍),旗手高杆大旗。
// ES2017,不用 ?. ??;UTF-8 + CRLF;無 DOM 時(node 測試)所有函式回 null,不報錯。全域名一律 wmapArmyArt* / WMAP_ARMY_ART_*。
// 公開:
//   WMAP_ARMY_ART_ARMY            常數 { F:192(每幀邊長), ax:0.5, ay:0.86(錨點), flagW:66, flagH:48 }
//   wmapArmyArtSheet() → { canvas, F, poleTop:[dir][fr]→{x,y} }   本體 sheet:5 欄(走 0~3、站 4)× 2 列(0 前斜 ↘、1 後斜 ↗),已含共同影子、4 步卒 + 旗手(含旗杆,旗布不含)
//   wmapArmyArtFlag(side, tag, mir, rolled, wave) → { canvas, hx, hy }   旗布(已著色、隊號 / 席位色帶 / 公會字);hx,hy = 旗布圖中旗杆掛點;side 'own'|'ally'|'foe'|'raid'
//   wmapArmyArtBadge(kind) → canvas   'fight' 交叉刀 | 'wait' 沙漏 | 'bag' 戰利袋
//   wmapArmyArtTroop(tp) → { canvas, F:128(實際像素), Fd:176(設計座標), Z } | null   兵種整隊陣列 sheet(tp = 槍 騎 盾 弓 械;3 欄 站 / 步 A / 步 B × 4 列 = 下 / 上 / 右下 / 右上,左下 / 左上靠鏡像、共 6 向;無臉、無旗;見「兵種模型」);另 wmapArmyArtCount(tp) 單位數、wmapArmyArtFormBounds(tp) 外框(純資料)
//   圖片模型模式(GPT 圖 → atlas、染色、狀態 / 方向選圖):見檔內「圖片模型模式」一節(WMAP_ARMY_IMG、wmapArmyTint、wmapArmyImgFor…)
//   wmapArmyArtMem() → {troops, sheet, flags, badges, total}   已快取 sprite 位元組數
//   wmapArmyArtSeatColor(n) → '#rrggbb'   席位色(避開土黃 / 草綠,規格 3.3)
var WMAP_ARMY_ART_ARMY = { F: 192, ax: 0.5, ay: 0.86, flagW: 66, flagH: 48, poleLen: 128 };
var WMAP_ARMY_ART_COL = {
  line: '#4A2A14', own: '#D8432E', ownEdge: '#E8B923', ally: '#2F8FC7', foe: '#2B2B33', cream: '#F4EBD0', gold: '#E8B923'
};
var wmapArmyArtCache = { sheet: null, flags: {}, badges: {} };

function wmapArmyArtCanvas(w, h) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function wmapArmyArtSeatColor(n) {
  n = Math.abs(n | 0);
  var h = (110 + (n * 137) % 250) % 360, l = 50 + ((n * 7) % 3) * 6;
  return 'hsl(' + h + ',72%,' + l + '%)';
}

// ───────── 單兵 / 旗手 ─────────
// (x, y) = 腳底中心;f = 走 0~3 / 站 4;dir 0 前斜 1 後斜;bearer = 旗手;回傳旗杆頂座標(旗手才有)
function wmapArmyArtFigure(g, x, y, f, dir, bearer, lean) {
  var C = WMAP_ARMY_ART_COL, back = dir === 1, walking = f < 4;
  var bob = (f === 1 || f === 3) ? -3 : 0;
  var sw = f === 0 ? 1 : (f === 2 ? -1 : 0);         // 左腳向前(1)/ 右腳向前(-1)
  var fwd = back ? -1 : 1;                          // 往畫面下方 = 前斜的「前」
  var lFy = y + (walking ? sw * 5 * fwd : 0) - (f === 1 ? 3 : 0), rFy = y - (walking ? sw * 5 * fwd : 0) - (f === 3 ? 3 : 0);
  var lFx = x - 7 - (walking ? sw * 1 : 0), rFx = x + 7 + (walking ? sw * 1 : 0);
  var hipY = y - 20 + bob;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // 腿(先描邊再填色)
  var legs = [[x - 5, lFx, lFy], [x + 5, rFx, rFy]], i;
  for (i = 0; i < 2; i++) { g.strokeStyle = C.line; g.lineWidth = 10; g.beginPath(); g.moveTo(legs[i][0], hipY); g.lineTo(legs[i][1], legs[i][2] - 3); g.stroke(); }
  for (i = 0; i < 2; i++) { g.strokeStyle = '#8a5f38'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(legs[i][0], hipY); g.lineTo(legs[i][1], legs[i][2] - 3); g.stroke(); }
  for (i = 0; i < 2; i++) {   // 鞋
    g.fillStyle = '#3a2414'; g.strokeStyle = C.line; g.lineWidth = 3;
    g.beginPath(); g.ellipse(legs[i][1] + (back ? 0 : 1), legs[i][2] - 2, 7.5, 4.5, 0, 0, 6.2832); g.fill(); g.stroke();
  }
  // 旗杆 / 長槍(在身體後面那一側先畫杆身)
  var px = x + 15, tipY = 0;
  if (bearer) {
    var top = y - WMAP_ARMY_ART_ARMY.poleLen + bob;
    g.strokeStyle = C.line; g.lineWidth = 8; g.beginPath(); g.moveTo(px, y - 4 + bob); g.lineTo(px, top); g.stroke();
    g.strokeStyle = '#a56a30'; g.lineWidth = 4; g.beginPath(); g.moveTo(px - 0.6, y - 4 + bob); g.lineTo(px - 0.6, top); g.stroke();
    g.strokeStyle = '#c98a4a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px - 1.8, y - 8 + bob); g.lineTo(px - 1.8, top + 6); g.stroke();
    g.fillStyle = C.gold; g.strokeStyle = C.line; g.lineWidth = 3;   // 杆頂金矛頭
    g.beginPath(); g.moveTo(px, top - 15); g.lineTo(px + 5.5, top - 2); g.lineTo(px, top + 2); g.lineTo(px - 5.5, top - 2); g.closePath(); g.fill(); g.stroke();
    tipY = top;
  } else {
    var tx = x + 22 + (lean || 0) + sw * 1.5, ty = y - 70 + bob;
    g.strokeStyle = C.line; g.lineWidth = 7; g.beginPath(); g.moveTo(x + 11, y - 12 + bob); g.lineTo(tx, ty); g.stroke();
    g.strokeStyle = '#a56a30'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x + 11, y - 12 + bob); g.lineTo(tx, ty); g.stroke();
    g.fillStyle = '#dfe3ea'; g.strokeStyle = C.line; g.lineWidth = 2.6;   // 槍尖
    g.beginPath(); g.moveTo(tx + 1.5, ty - 13); g.lineTo(tx + 5.5, ty + 1); g.lineTo(tx - 3, ty + 1); g.closePath(); g.fill(); g.stroke();
  }
  // 軀幹
  var by = y - 33 + bob, gr = g.createLinearGradient(x - 14, by - 16, x + 14, by + 16);
  gr.addColorStop(0, back ? '#b78a50' : '#d0a063'); gr.addColorStop(1, back ? '#8e6638' : '#a77742');
  g.fillStyle = gr; g.strokeStyle = C.line; g.lineWidth = 4;
  g.beginPath(); g.moveTo(x - 12, by - 14); g.quadraticCurveTo(x, by - 19, x + 12, by - 14); g.lineTo(x + 14, by + 12); g.quadraticCurveTo(x, by + 17, x - 14, by + 12); g.closePath(); g.fill(); g.stroke();
  if (!back) {   // 皮甲:斜肩帶 + 護心片
    g.strokeStyle = '#6a4220'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x - 9, by - 13); g.lineTo(x + 9, by + 10); g.stroke();
    g.fillStyle = '#e4bd82'; g.strokeStyle = C.line; g.lineWidth = 2.2;
    g.beginPath(); g.arc(x + 1, by - 2, 4.2, 0, 6.2832); g.fill(); g.stroke();
  } else {
    g.strokeStyle = '#6a4220'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 9, by - 13); g.lineTo(x + 9, by + 10); g.stroke();
  }
  g.strokeStyle = C.line; g.lineWidth = 3.6; g.beginPath(); g.moveTo(x - 13, by + 8); g.quadraticCurveTo(x, by + 12, x + 13, by + 8); g.stroke();   // 腰帶
  // 手臂與手
  var hx2 = bearer ? px : x + 14, hy2 = bearer ? by - 4 : by - 3;
  g.strokeStyle = C.line; g.lineWidth = 9; g.beginPath(); g.moveTo(x + 10, by - 10); g.lineTo(hx2, hy2); g.moveTo(x - 10, by - 10); g.lineTo(bearer ? px - 1 : x - 15, bearer ? by - 9 : by + 6); g.stroke();
  g.strokeStyle = '#c99a5c'; g.lineWidth = 4.2; g.beginPath(); g.moveTo(x + 10, by - 10); g.lineTo(hx2, hy2); g.moveTo(x - 10, by - 10); g.lineTo(bearer ? px - 1 : x - 15, bearer ? by - 9 : by + 6); g.stroke();
  g.fillStyle = '#f2c79a'; g.strokeStyle = C.line; g.lineWidth = 2.4;
  g.beginPath(); g.arc(hx2, hy2, 4.4, 0, 6.2832); g.fill(); g.stroke();
  g.beginPath(); g.arc(bearer ? px - 1 : x - 15, bearer ? by - 9 : by + 6, 4.4, 0, 6.2832); g.fill(); g.stroke();
  // 頭
  var hy = y - 58 + bob;
  g.fillStyle = back ? '#3b2a22' : '#f4cc9c'; g.strokeStyle = C.line; g.lineWidth = 4;
  g.beginPath(); g.arc(x, hy, 14, 0, 6.2832); g.fill(); g.stroke();
  if (!back) {
    g.fillStyle = '#2a1a10';
    g.beginPath(); g.ellipse(x - 5, hy + 2, 2.1, 2.8, 0, 0, 6.2832); g.fill(); g.beginPath(); g.ellipse(x + 5, hy + 2, 2.1, 2.8, 0, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(232,110,90,.55)'; g.beginPath(); g.ellipse(x - 9, hy + 6, 3, 2, 0, 0, 6.2832); g.fill(); g.beginPath(); g.ellipse(x + 9, hy + 6, 3, 2, 0, 0, 6.2832); g.fill();
    g.strokeStyle = '#7a3a20'; g.lineWidth = 1.8; g.beginPath(); g.arc(x, hy + 6, 3, 0.2, 2.94); g.stroke();
  }
  // 頭巾盔
  var cap = g.createLinearGradient(x - 14, hy - 16, x + 14, hy);
  cap.addColorStop(0, '#a3a9b4'); cap.addColorStop(1, '#6f7683');
  g.fillStyle = cap; g.strokeStyle = C.line; g.lineWidth = 4;
  g.beginPath(); g.arc(x, hy - 1, 14.5, Math.PI * (back ? 0.92 : 1.02), Math.PI * (back ? 0.08 : -0.02) + 2 * Math.PI * 0, false);
  if (back) { g.closePath(); } else { g.lineTo(x + 14, hy - 1); g.closePath(); }
  g.fill(); g.stroke();
  g.fillStyle = '#4a4f5a'; g.strokeStyle = C.line; g.lineWidth = 2.6;   // 盔緣布帶
  g.beginPath(); g.moveTo(x - 14.4, hy - 3); g.quadraticCurveTo(x, hy + (back ? 4 : 0), x + 14.4, hy - 3); g.lineTo(x + 14.4, hy - 8); g.quadraticCurveTo(x, hy - 5 + (back ? 4 : 0), x - 14.4, hy - 8); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = C.gold; g.strokeStyle = C.line; g.lineWidth = 2; g.beginPath(); g.arc(x, hy - 16, 3.4, 0, 6.2832); g.fill(); g.stroke();   // 盔頂小珠
  if (back) {   // 後腦布帶尾
    g.strokeStyle = C.line; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 2, hy - 2); g.quadraticCurveTo(x - 6, hy + 10, x - 11, hy + 12); g.stroke();
    g.strokeStyle = '#8a8f9a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 2, hy - 2); g.quadraticCurveTo(x - 6, hy + 10, x - 11, hy + 12); g.stroke();
  }
  return bearer ? { x: px, y: tipY - 15 } : null;
}

// 站位(腳底相對錨點;依 y 由小到大畫):[x, y, 相位, 旗手?]
var WMAP_ARMY_ART_SLOTS = [
  [[-48, -14, 0, 0, -8], [-16, -30, 2, 0, 2], [-34, 8, 1, 0, -4], [2, -6, 3, 0, 6], [30, 14, 1, 0, 0]],     // 前斜:旗手在前排右側
  [[-44, 6, 0, 0, -8], [-14, 10, 2, 0, 4], [-30, -10, 1, 0, -2], [0, -12, 3, 0, 8], [24, -30, 1, 0, 0]]     // 後斜:旗手領在前(畫面上方)
];

function wmapArmyArtSheet() {
  if (wmapArmyArtCache.sheet) return wmapArmyArtCache.sheet;
  var F = WMAP_ARMY_ART_ARMY.F, cv = wmapArmyArtCanvas(F * 5, F * 2);
  if (!cv) return null;
  var g = cv.getContext('2d'), poleTop = [[], []], d, f, k, ax = F * WMAP_ARMY_ART_ARMY.ax, ay = F * WMAP_ARMY_ART_ARMY.ay;
  for (d = 0; d < 2; d++) for (f = 0; f < 5; f++) {
    var ox = f * F, oy = d * F;
    g.save(); g.beginPath(); g.rect(ox, oy, F, F); g.clip();
    g.fillStyle = 'rgba(58,36,20,.26)'; g.beginPath(); g.ellipse(ox + ax + 5, oy + ay + 2, F * 0.31, F * 0.095, 0, 0, 6.2832); g.fill();   // 共同影子(不隨步伐動)
    var slots = WMAP_ARMY_ART_SLOTS[d].slice().sort(function (a, b) { return a[1] - b[1]; });
    for (k = 0; k < slots.length; k++) {
      var s = slots[k], fr = f === 4 ? 4 : (f + s[2]) % 4;
      var tp = wmapArmyArtFigure(g, ox + ax + s[0], oy + ay + s[1], fr, d, !!s[3], s[4]);
      if (tp) poleTop[d][f] = { x: tp.x - ox, y: tp.y - oy };
    }
    g.restore();
  }
  wmapArmyArtCache.sheet = { canvas: cv, F: F, poleTop: poleTop };
  return wmapArmyArtCache.sheet;
}

// ───────── 兵種模型(槍 / 騎 / 盾 / 弓 / 械):整隊陣列預烘成一張小 sprite,純色塊 + 少量線,不畫臉 / 五官,不畫旗 / 旗杆 / 隊號 ─────────
// 使用者 11/17:馬 ≥ 9、槍盾弓 ≥ 14、械(投石車)≥ 6;單位數固定、不隨兵力變動(兵力不可被探知);旗幟全部拿掉。
// 11/17 改六邊形格:行進方向只有 6 個(畫面上:下 / 上 / 右下 / 右上 / 左下 / 左上),4 個基礎視角 + 水平鏡像:
//   列 0 = 下(正面,朝向畫面)、列 1 = 上(背面)、列 2 = 右下(前斜)、列 3 = 右上(後斜);左下 = 列 2 鏡像、左上 = 列 3 鏡像;上 / 下左右對稱,不鏡像。
//   (方向判定在 wmap_army.js 的 wmapArmyDir6;這裡只管 dir 0~3 的圖。)
// 每兵種一張 sheet:3 欄(站 0、步 A 1、步 B 2)× 4 列(上述 4 視角),每幀 WMAP_ARMY_ART_TPX = 128 px(設計座標仍是 176,烘圖時整體縮放),整隊陣列已烘進去(含共同影子),顯示時 1 次 drawImage。
// 陣列(a 沿前進軸、b 沿橫軸,單位 = 設計座標 px):槍 / 盾 = 4×4 方陣(16);弓 = 5×3 錯位散兵(15);騎 = 2×5 縱隊(10);械 = 3×2 間隔(6 台投石車)。上 / 下視角行距壓成 0.8(垂直壓扁),奇數排錯半格以免後排被完全擋住。
// 繪製只用 moveTo / lineTo / quadraticCurveTo 與多邊形(頭 = 無五官盔形、輪 = 十邊形),整張 sheet 只有 1 個 ellipse(影子)、零 arc:測試以此判「無臉」。
// 走路動畫 = 步 A / 站 / 步 B / 站 四拍 + 整體上下起伏(wmapArmyDraw 依 WMAP_ARMY_ART_BOB 平移);投石臂 站 / 動 兩種姿勢;低畫質只用站立幀。
var WMAP_ARMY_ART_TF = 176;   // 兵種設計座標邊長(陣列座標 / 外框 / 命中框都用這個)
var WMAP_ARMY_ART_TPX = 128;  // 兵種 sprite 每幀實際像素(4 列 × 3 欄;調小省記憶體)
var WMAP_ARMY_ART_Z = 1.3;    // 顯示邊長 = s × Z
var WMAP_ARMY_ART_TAY = 0.7;  // 整隊 sprite 的錨點(陣列中心 = 腳底)在幀內的縱向位置(陣列向下延伸,要留空間)
var WMAP_ARMY_ART_VY = 0.8;   // 上 / 下視角:前進軸的垂直壓縮(行距 = da × VY)
var WMAP_ARMY_ART_TROOPS = ['槍', '騎', '盾', '弓', '械'];
var WMAP_ARMY_ART_BOB = { '槍': 0.025, '騎': 0.045, '盾': 0.02, '弓': 0.025, '械': 0.012 };   // 走路時奇數拍上下起伏(× 顯示邊長 s)
var WMAP_ARMY_ART_LWM = 1;   // 描邊倍率(烘整隊時縮小單位,描邊加粗補償)
var WMAP_ARMY_ART_TC = {
  line: '#4A2A14', wood: '#a56a30', woodD: '#6b4a2a', steel: '#dfe3ea', gold: '#E8B923', leg: '#5a3b20',
  shield: '#4f7396', horse: '#8b5a34', horseD: '#4f3320', rider: '#35507a', cart: '#a77a45', helm: '#8f95a1'
};
var WMAP_ARMY_ART_FORM = {
  '槍': { rows: [4, 4, 4, 4], da: 20, db: 22, k: 0.62, ext: [-12, 16, -46, 3] },
  '盾': { rows: [4, 4, 4, 4], da: 20, db: 22, k: 0.62, ext: [-12, 16, -46, 3] },
  '弓': { rows: [5, 5, 5], da: 26, db: 19, k: 0.62, stag: 1, ext: [-12, 22, -40, 3] },
  '騎': { rows: [2, 2, 2, 2, 2], da: 26, db: 28, k: 0.55, ext: [-26, 30, -56, 3] },
  '械': { rows: [3, 3], da: 40, db: 40, k: 0.8, ext: [-22, 22, -46, 5] }
};
wmapArmyArtCache.troops = {};

// 單位數(固定,與兵力無關)
function wmapArmyArtCount(tp) {
  var F = WMAP_ARMY_ART_FORM[tp], i, n = 0;
  if (!F) return 0;
  for (i = 0; i < F.rows.length; i++) n += F.rows[i];
  return n;
}
// 各單位的畫面座標 [x, y, 相位偏移](相對錨點、設計座標 px;d 0 = 下(前進軸朝畫面下)、1 = 上、2 = 右下、3 = 右上),依 y 由小到大(遠到近)
function wmapArmyArtFormPos(tp, d) {
  var F = WMAP_ARMY_ART_FORM[tp], out = [], i, j, n, a, b, sh, VY = WMAP_ARMY_ART_VY;
  if (!F) return out;
  for (i = 0; i < F.rows.length; i++) {
    n = F.rows[i]; a = ((F.rows.length - 1) / 2 - i) * F.da;
    sh = F.stag ? (i % 2 ? 1 : -1) * F.db * 0.22 : 0;
    if (d < 2 && !F.stag) sh = (i % 2 ? 1 : -1) * F.db * 0.25;   // 上 / 下:奇偶排錯半格
    for (j = 0; j < n; j++) {
      b = (j - (n - 1) / 2) * F.db * (d < 2 ? 1.15 : 1) + sh + (F.stag ? (((i * 7 + j * 13) % 5) - 2) * 1.4 : 0);
      if (d === 0) out.push([b, a * VY, (i + j) % 2]);
      else if (d === 1) out.push([b, -a * VY, (i + j) % 2]);
      else if (d === 3) out.push([a + b, (b - a) / 2, (i + j) % 2]);
      else out.push([a - b, (a + b) / 2, (i + j) % 2]);
    }
  }
  out.sort(function (p, q) { return p[1] - q[1]; });
  return out;
}
// 整隊外框(相對錨點、設計座標 px,未鏡像)→ {x0, y0, x1, y1, F, Z};d = 0~3 取該列方向,省略 = 四方向聯集;純資料,node 也能算(命中框 / 扇形用)
function wmapArmyArtFormBounds(tp, d) {
  var F = WMAP_ARMY_ART_FORM[tp], k, p, dd, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  if (!F) return null;
  for (dd = 0; dd < 4; dd++) {
    if (d === 0 || d === 1 || d === 2 || d === 3) { if (dd !== d) continue; }
    p = wmapArmyArtFormPos(tp, dd);
    for (k = 0; k < p.length; k++) {
      x0 = Math.min(x0, p[k][0] + F.ext[0] * F.k); x1 = Math.max(x1, p[k][0] + F.ext[1] * F.k);
      y0 = Math.min(y0, p[k][1] + F.ext[2] * F.k); y1 = Math.max(y1, p[k][1] + F.ext[3] * F.k);
    }
  }
  return { x0: x0, y0: y0, x1: x1, y1: y1, F: WMAP_ARMY_ART_TF, Z: WMAP_ARMY_ART_Z };
}

function wmapArmyArtPoly(g, p, fill, lw) {
  var i; g.beginPath(); g.moveTo(p[0], p[1]);
  for (i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (lw) { g.strokeStyle = WMAP_ARMY_ART_TC.line; g.lineWidth = lw * WMAP_ARMY_ART_LWM; g.stroke(); }
}
// 圓形色塊用 10 邊形(不用 arc)
function wmapArmyArtBlob(g, cx, cy, rx, ry, fill, lw) {
  var p = [], i, a;
  for (i = 0; i < 10; i++) { a = i * 0.62832; p.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); }
  wmapArmyArtPoly(g, p, fill, lw);
}
// 粗線(先描邊再上色)
function wmapArmyArtBar(g, x0, y0, x1, y1, w, col) {
  g.lineCap = 'round';
  g.strokeStyle = WMAP_ARMY_ART_TC.line; g.lineWidth = w + 2.2 * WMAP_ARMY_ART_LWM; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}
// 頭 = 盔形色塊(無五官)
function wmapArmyArtHead(g, x, y, col) {
  wmapArmyArtBlob(g, x, y, 5.4, 5.2, col, 1.6);
  wmapArmyArtPoly(g, [x - 5.6, y + 0.5, x + 5.6, y + 0.5, x + 4.6, y + 2.6, x - 4.6, y + 2.6], WMAP_ARMY_ART_TC.leg, 0);   // 盔緣深色帶
}
// 步兵(槍 / 盾 / 弓)斜向視角(右下 / 右上,面朝右、鏡像由繪製端處理):(x, y) = 腳底;ph 0 站 1 步 A 2 步 B;back = 右上(後斜)
function wmapArmyArtInf(g, tp, x, y, ph, back) {
  var C = WMAP_ARMY_ART_TC, LW = WMAP_ARMY_ART_LWM, sw = ph === 1 ? 1 : (ph === 2 ? -1 : 0), tun = tp === '槍' ? '#b5803f' : (tp === '盾' ? '#6b6f78' : '#6a8f52'), hel = tp === '盾' ? '#9aa0ab' : (tp === '弓' ? '#5d7f48' : C.helm);
  if (tp === '弓') {   // 箭袋(背後,先畫)
    wmapArmyArtPoly(g, [x - 9, y - 31, x - 4, y - 33, x - 1, y - 16, x - 6, y - 14], '#8a5f38', 1.6);
    g.strokeStyle = '#e8ecf2'; g.lineWidth = 1.4 * LW; g.beginPath(); g.moveTo(x - 8, y - 31); g.lineTo(x - 9, y - 37); g.moveTo(x - 6, y - 32); g.lineTo(x - 6.5, y - 38); g.moveTo(x - 4.4, y - 33); g.lineTo(x - 4, y - 38.5); g.stroke();
  }
  wmapArmyArtBar(g, x - 2.6, y - 10, x - 3.4 - sw * 0.6, y + sw * 2.4, 3.6, C.leg);
  wmapArmyArtBar(g, x + 2.6, y - 10, x + 3.4 + sw * 0.6, y - sw * 2.4, 3.6, C.leg);
  if (tp === '槍') {   // 長槍
    var tx = x + 15 + sw * 1.2 + (back ? -2 : 0), ty = y - 45;
    wmapArmyArtBar(g, x + 6, y - 12, tx, ty, 2.4, C.wood);
    wmapArmyArtPoly(g, [tx + 0.5, ty - 9, tx + 3, ty + 1, tx - 2.4, ty + 1], C.steel, 1.4);
  }
  wmapArmyArtPoly(g, [x - 6, y - 25, x + 6, y - 25, x + 7, y - 9, x - 7, y - 9], tun, 1.8);
  wmapArmyArtHead(g, x, y - 30, hel);
  if (tp === '盾') {   // 大盾:矩形,前斜面朝畫面(藍灰 + 金盾心);後斜背在背上(木色橫條)
    var sx = x - 11, sy = y - 31;
    wmapArmyArtPoly(g, [sx, sy, sx + 16, sy, sx + 16, sy + 25, sx, sy + 25], back ? '#8a6a44' : C.shield, 2);
    if (back) { g.strokeStyle = '#5b3f22'; g.lineWidth = 1.6 * LW; g.beginPath(); g.moveTo(sx + 1, sy + 8); g.lineTo(sx + 15, sy + 8); g.moveTo(sx + 1, sy + 17); g.lineTo(sx + 15, sy + 17); g.stroke(); }
    else wmapArmyArtPoly(g, [sx + 5, sy + 8, sx + 11, sy + 8, sx + 11, sy + 17, sx + 5, sy + 17], C.gold, 1.4);
  }
  if (tp === '弓') {   // 弓弧 + 弦
    g.lineCap = 'round';
    g.strokeStyle = C.line; g.lineWidth = 2.4 + 2.2 * LW; g.beginPath(); g.moveTo(x + 9, y - 38); g.quadraticCurveTo(x + 21, y - 22, x + 9, y - 6); g.stroke();
    g.strokeStyle = '#b9824a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x + 9, y - 38); g.quadraticCurveTo(x + 21, y - 22, x + 9, y - 6); g.stroke();
    g.strokeStyle = '#f4ebd0'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 9, y - 38); g.lineTo(x + 9, y - 6); g.stroke();
  }
}
// 步兵 正面 / 背面(下 / 上,左右對稱):back = 背面(上)。槍:右手長槍直立;盾:正面大盾擋身、背面盾背在背上;弓:左手持弓、箭袋露肩(背面斜背整個袋)
function wmapArmyArtInfV(g, tp, x, y, ph, back) {
  var C = WMAP_ARMY_ART_TC, LW = WMAP_ARMY_ART_LWM, sw = ph === 1 ? 1 : (ph === 2 ? -1 : 0), tun = tp === '槍' ? '#b5803f' : (tp === '盾' ? '#6b6f78' : '#6a8f52'), hel = tp === '盾' ? '#9aa0ab' : (tp === '弓' ? '#5d7f48' : C.helm);
  if (tp === '槍') {   // 長槍(身後,先畫):右手側直立
    var tx = x + 10 + sw * 0.8, ty = y - 46;
    wmapArmyArtBar(g, x + 9, y - 6, tx, ty, 2.4, C.wood);
    wmapArmyArtPoly(g, [tx + 0.4, ty - 9, tx + 3, ty + 1, tx - 2.4, ty + 1], C.steel, 1.4);
  }
  if (tp === '弓' && !back) {   // 正面:箭袋從右肩後露出
    wmapArmyArtPoly(g, [x + 2, y - 31, x + 7, y - 32, x + 9, y - 18, x + 4, y - 17], '#8a5f38', 1.6);
    g.strokeStyle = '#e8ecf2'; g.lineWidth = 1.4 * LW; g.beginPath(); g.moveTo(x + 3.5, y - 31); g.lineTo(x + 3, y - 37); g.moveTo(x + 5.5, y - 32); g.lineTo(x + 6, y - 38); g.stroke();
  }
  wmapArmyArtBar(g, x - 2.8, y - 10, x - 3.4 - sw * 0.5, y + sw * 2.4, 3.6, C.leg);
  wmapArmyArtBar(g, x + 2.8, y - 10, x + 3.4 + sw * 0.5, y - sw * 2.4, 3.6, C.leg);
  wmapArmyArtPoly(g, [x - 6.5, y - 25, x + 6.5, y - 25, x + 7.5, y - 9, x - 7.5, y - 9], tun, 1.8);
  wmapArmyArtPoly(g, [x - 7.4, y - 15.5, x + 7.4, y - 15.5, x + 7.5, y - 12.5, x - 7.5, y - 12.5], '#6a4220', 0);   // 腰帶
  if (back) {   // 背面:肩上交叉背帶
    g.strokeStyle = '#6a4220'; g.lineWidth = 1.8 * LW; g.beginPath(); g.moveTo(x - 5, y - 24); g.lineTo(x + 5, y - 14); g.moveTo(x + 5, y - 24); g.lineTo(x - 5, y - 14); g.stroke();
  }
  wmapArmyArtHead(g, x, y - 30, hel);
  if (back) wmapArmyArtPoly(g, [x - 3, y - 27, x + 3, y - 27, x + 2, y - 22, x - 2, y - 22], C.leg, 1.2);   // 後頸布帶尾
  if (tp === '盾') {
    if (back) {   // 盾背在背上:木色板 + 橫條
      wmapArmyArtPoly(g, [x - 9, y - 28, x + 9, y - 28, x + 9, y - 7, x - 9, y - 7], '#8a6a44', 2);
      g.strokeStyle = '#5b3f22'; g.lineWidth = 1.6 * LW; g.beginPath(); g.moveTo(x - 8, y - 20); g.lineTo(x + 8, y - 20); g.moveTo(x - 8, y - 13); g.lineTo(x + 8, y - 13); g.stroke();
    } else {      // 正面:大盾擋身,金盾心
      wmapArmyArtPoly(g, [x - 10, y - 28, x + 10, y - 28, x + 10, y - 6, x - 10, y - 6], C.shield, 2);
      wmapArmyArtPoly(g, [x - 4, y - 21, x + 4, y - 21, x + 4, y - 12, x - 4, y - 12], C.gold, 1.4);
    }
  }
  if (tp === '弓') {
    if (back) {   // 斜背箭袋 + 箭羽露出肩上
      wmapArmyArtPoly(g, [x - 4, y - 28, x + 0.5, y - 26, x + 6, y - 11, x + 1.5, y - 9], '#8a5f38', 1.6);
      g.strokeStyle = '#e8ecf2'; g.lineWidth = 1.4 * LW; g.beginPath(); g.moveTo(x - 3, y - 28); g.lineTo(x - 4, y - 35); g.moveTo(x - 0.5, y - 27); g.lineTo(x - 0.6, y - 34); g.stroke();
    }
    g.lineCap = 'round';   // 左手持弓(畫面左側直立弧)
    g.strokeStyle = C.line; g.lineWidth = 2.4 + 2.2 * LW; g.beginPath(); g.moveTo(x - 10, y - 38); g.quadraticCurveTo(x - 21, y - 22, x - 10, y - 6); g.stroke();
    g.strokeStyle = '#b9824a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x - 10, y - 38); g.quadraticCurveTo(x - 21, y - 22, x - 10, y - 6); g.stroke();
    g.strokeStyle = '#f4ebd0'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 10, y - 38); g.lineTo(x - 10, y - 6); g.stroke();
  }
}
// 馬與騎士斜向視角(面朝右;鏡像由繪製端處理)。ph 0 站 1 騰躍(四蹄伸展)2 收蹄
function wmapArmyArtRider(g, x, y, ph, back) {
  var C = WMAP_ARMY_ART_TC, fx = ph === 1 ? 1 : 0, bk = ph === 2 ? 1 : 0, lx = back ? 22 : 25, ly = back ? 42 : 38, i, lg = [
    [x - 9, x - 9 - (fx ? 9 : (bk ? -3 : 0)), y - (fx ? 5 : (bk ? 2 : 0))], [x - 5, x - 5 - (fx ? 4 : (bk ? -5 : 0)), y - (fx ? 1 : (bk ? 3 : 0))],
    [x + 6, x + 6 + (fx ? 4 : (bk ? -5 : 0)), y - (fx ? 1 : (bk ? 3 : 0))], [x + 10, x + 10 + (fx ? 9 : (bk ? -3 : 0)), y - (fx ? 5 : (bk ? 2 : 0))]
  ];
  for (i = 0; i < 4; i++) wmapArmyArtBar(g, lg[i][0], y - 12, lg[i][1], lg[i][2], 3.2, i === 0 || i === 3 ? C.horse : C.horseD);
  wmapArmyArtPoly(g, [x - 13, y - 21, x - 22, y - 14, x - 20, y - 8, x - 12, y - 15], C.horseD, 1.4);                              // 尾
  wmapArmyArtBlob(g, x, y - 17, 15, 7.2, C.horse, 1.8);                                                                           // 身
  wmapArmyArtPoly(g, [x + 8, y - 20, x + 13, y - 33, x + 19, y - 30, x + 16, y - 17], C.horse, 1.6);                              // 頸
  wmapArmyArtPoly(g, [x + 13.5, y - 33, x + 17, y - 34, x + 26, y - 26, x + 24, y - 23, x + 16, y - 28], C.horse, 1.6);           // 頭
  wmapArmyArtPoly(g, [x - 3, y - 34, x + 6, y - 34, x + 7, y - 21, x - 4, y - 21], C.rider, 1.8);                                  // 騎士身
  wmapArmyArtHead(g, x + 2, y - 39, C.helm);
  wmapArmyArtBar(g, x + 5, y - 27, x + lx, y - ly, 2.2, C.wood);                                                                  // 長槍前傾
  wmapArmyArtPoly(g, [x + lx + 0.6, y - ly - 8, x + lx + 3, y - ly + 1, x + lx - 2.4, y - ly + 1], C.steel, 1.2);
}
// 馬與騎士 正面 / 背面(下 / 上):back = 背面(馬臀 + 馬尾)。ph 0 站 1 / 2 左右蹄交替抬起
function wmapArmyArtRiderV(g, x, y, ph, back) {
  var C = WMAP_ARMY_ART_TC, l1 = ph === 1 ? 4 : 0, l2 = ph === 2 ? 4 : 0;
  // 遠側兩腿(稍高、深色),近側兩腿最後畫
  wmapArmyArtBar(g, x - 8, y - 14, x - 8.4, y - 3 - l2, 3.2, C.horseD);
  wmapArmyArtBar(g, x + 8, y - 14, x + 8.4, y - 3 - l1, 3.2, C.horseD);
  wmapArmyArtBlob(g, x, y - 20, 11.5, 8.5, C.horse, 1.8);                                                                          // 胸 / 臀
  wmapArmyArtPoly(g, [x - 4.6, y - 39, x + 4.6, y - 39, x + 5.4, y - 26, x - 5.4, y - 26], C.rider, 1.8);                          // 騎士身
  wmapArmyArtHead(g, x, y - 44, C.helm);
  var sx = x + 9;                                                                                                                  // 長槍直立(右手側)
  wmapArmyArtBar(g, sx, y - 22, sx + 1, y - 50, 2.2, C.wood);
  wmapArmyArtPoly(g, [sx + 1.6, y - 58, sx + 4, y - 49, sx - 1.6, y - 49], C.steel, 1.2);
  if (back) {   // 背面:馬尾垂在臀上
    wmapArmyArtPoly(g, [x - 3, y - 25, x + 3, y - 25, x + 4.5, y - 7, x - 4.5, y - 7], C.horseD, 1.4);
  } else {      // 正面:馬頸 + 馬頭朝向畫面,兩耳
    wmapArmyArtPoly(g, [x - 3.6, y - 31, x + 3.6, y - 31, x + 4.2, y - 28, x + 3, y - 12, x - 3, y - 12, x - 4.2, y - 28], C.horse, 1.6);
    wmapArmyArtPoly(g, [x - 4, y - 31, x - 2.6, y - 36, x - 1, y - 31], C.horseD, 1.2);
    wmapArmyArtPoly(g, [x + 1, y - 31, x + 2.6, y - 36, x + 4, y - 31], C.horseD, 1.2);
  }
  wmapArmyArtBar(g, x - 5.4, y - 14, x - 5.8, y + 1 - l1, 3.4, C.horse);
  wmapArmyArtBar(g, x + 5.4, y - 14, x + 5.8, y + 1 - l2, 3.4, C.horse);
}
// 投石車斜向視角(面朝右;無人、無臉)。ph 0 站(臂斜立)1 動(臂前甩)2 動(臂後拉,石彈在杓)
function wmapArmyArtCart(g, x, y, ph, back) {
  var C = WMAP_ARMY_ART_TC, wc = back ? '#8a6338' : C.cart, tipx, tipy, rx, ry;
  wmapArmyArtBlob(g, x - 11, y - 5, 5.2, 5.2, C.woodD, 1.6);                                   // 後輪
  wmapArmyArtBlob(g, x + 11, y - 5, 5.2, 5.2, C.woodD, 1.6);                                   // 前輪
  wmapArmyArtPoly(g, [x - 16, y - 8, x + 16, y - 8, x + 13, y - 15, x - 13, y - 15], wc, 1.8);   // 底座
  wmapArmyArtPoly(g, [x - 8, y - 15, x - 1, y - 31, x + 6, y - 31, x + 9, y - 15], C.wood, 1.6);   // A 形架
  if (ph === 1) { tipx = x + 20; tipy = y - 30; rx = x - 10; ry = y - 24; }
  else if (ph === 2) { tipx = x - 8; tipy = y - 42; rx = x + 6; ry = y - 20; }
  else { tipx = x + 11; tipy = y - 44; rx = x - 7; ry = y - 20; }
  wmapArmyArtBar(g, rx, ry, tipx, tipy, 3, C.woodD);                                           // 投石臂
  wmapArmyArtBlob(g, rx, ry, 3.6, 3.6, '#6b6f78', 1.4);                                         // 配重
  if (ph !== 1) wmapArmyArtBlob(g, tipx, tipy - 3, 3, 3, '#aeb3bb', 1.2);                       // 石彈
}
// 投石車 正面 / 背面(下 / 上):兩側輪只見窄邊、A 形架兩柱、臂近乎直立(前甩時從正面看變短)。back = 背面:底部可見大配重箱
function wmapArmyArtCartV(g, x, y, ph, back) {
  var C = WMAP_ARMY_ART_TC, wc = back ? '#8a6338' : C.cart, tipy = ph === 1 ? y - 33 : (ph === 2 ? y - 47 : y - 44), tipx = x + (ph === 1 ? 0 : 1.5);
  wmapArmyArtPoly(g, [x - 19, y - 12, x - 13, y - 12, x - 13, y, x - 19, y], C.woodD, 1.6);       // 左輪(側面窄)
  wmapArmyArtPoly(g, [x + 13, y - 12, x + 19, y - 12, x + 19, y, x + 13, y], C.woodD, 1.6);       // 右輪
  wmapArmyArtPoly(g, [x - 14, y - 7, x + 14, y - 7, x + 12, y - 15, x - 12, y - 15], wc, 1.8);    // 底座
  wmapArmyArtPoly(g, [x - 10, y - 15, x - 6.5, y - 34, x - 3, y - 34, x - 4.5, y - 15], C.wood, 1.6);   // 左架柱
  wmapArmyArtPoly(g, [x + 10, y - 15, x + 6.5, y - 34, x + 3, y - 34, x + 4.5, y - 15], C.wood, 1.6);   // 右架柱
  wmapArmyArtPoly(g, [x - 8, y - 35, x + 8, y - 35, x + 8, y - 31, x - 8, y - 31], C.woodD, 1.4);      // 頂橫木
  wmapArmyArtBar(g, x, y - 18, tipx, tipy, 3, C.woodD);                                          // 投石臂
  if (back) wmapArmyArtPoly(g, [x - 6.5, y - 22, x + 6.5, y - 22, x + 6.5, y - 11, x - 6.5, y - 11], '#6b6f78', 1.6);   // 背面:大配重箱
  else wmapArmyArtBlob(g, x, y - 18, 3.6, 3.6, '#6b6f78', 1.4);
  if (ph !== 1) wmapArmyArtBlob(g, tipx, tipy - 3, 3, 3, '#aeb3bb', 1.2);                          // 石彈
}
// → { canvas, F(實際像素), Fd(設計座標邊長), Z, ay, tp } | null(無 DOM / 沒有此兵種);4 列 = 下 / 上 / 右下 / 右上,3 欄 = 站 / 步 A / 步 B
function wmapArmyArtTroop(tp) {
  var hit = wmapArmyArtCache.troops[tp];
  if (hit !== undefined) return hit;
  var FM = WMAP_ARMY_ART_FORM[tp];
  if (!FM) { wmapArmyArtCache.troops[tp] = null; return null; }
  var Fd = WMAP_ARMY_ART_TF, FP = WMAP_ARMY_ART_TPX, cv = wmapArmyArtCanvas(FP * 3, FP * 4);
  if (!cv) { wmapArmyArtCache.troops[tp] = null; return null; }
  var g = cv.getContext('2d'), d, c, k, ax = Fd * WMAP_ARMY_ART_ARMY.ax, ay = Fd * WMAP_ARMY_ART_TAY, s, ph, ox, oy, pos, lwm0 = WMAP_ARMY_ART_LWM, sc = FP / Fd, vert, bk;
  WMAP_ARMY_ART_LWM = 0.95 / FM.k;
  for (d = 0; d < 4; d++) {
    pos = wmapArmyArtFormPos(tp, d); vert = d < 2; bk = d === 1 || d === 3;
    for (c = 0; c < 3; c++) {
      ox = c * FP; oy = d * FP;
      g.save(); g.beginPath(); g.rect(ox, oy, FP, FP); g.clip();
      g.translate(ox, oy); g.scale(sc, sc);
      g.fillStyle = 'rgba(58,36,20,.26)'; g.beginPath(); g.ellipse(ax, ay + 2, Fd * 0.38, Fd * 0.17, 0, 0, 6.2832); g.fill();   // 共同影子(整張 sheet 唯一的 ellipse)
      for (k = 0; k < pos.length; k++) {
        s = pos[k]; ph = c === 0 ? 0 : ((c + s[2]) % 2 + 1);   // 站 0;步 A / 步 B 各人錯開
        g.save(); g.translate(ax + s[0], ay + s[1]); g.scale(FM.k, FM.k);
        if (tp === '騎') (vert ? wmapArmyArtRiderV : wmapArmyArtRider)(g, 0, 0, ph, bk);
        else if (tp === '械') (vert ? wmapArmyArtCartV : wmapArmyArtCart)(g, 0, 0, ph, bk);
        else (vert ? wmapArmyArtInfV : wmapArmyArtInf)(g, tp, 0, 0, ph, bk);
        g.restore();
      }
      g.restore();
    }
  }
  WMAP_ARMY_ART_LWM = lwm0;
  hit = { canvas: cv, F: FP, Fd: Fd, Z: WMAP_ARMY_ART_Z, ay: WMAP_ARMY_ART_TAY, tp: tp };
  wmapArmyArtCache.troops[tp] = hit;
  return hit;
}
// 目前已快取的 sprite 位元組數(兵種 sheet / 退回用的舊旗手 sheet / 旗布 / 徽章;RGBA 每像素 4 B)
function wmapArmyArtMem() {
  var o = { troops: 0, sheet: 0, flags: 0, badges: 0, total: 0 }, k, c = wmapArmyArtCache;
  for (k in c.troops) if (c.troops[k]) o.troops += c.troops[k].canvas.width * c.troops[k].canvas.height * 4;
  if (c.sheet) o.sheet = c.sheet.canvas.width * c.sheet.canvas.height * 4;
  for (k in c.flags) if (c.flags[k]) o.flags += c.flags[k].canvas.width * c.flags[k].canvas.height * 4;
  for (k in c.badges) if (c.badges[k]) o.badges += c.badges[k].width * c.badges[k].height * 4;
  o.total = o.troops + o.sheet + o.flags + o.badges;
  return o;
}

// ───────── 圖片模型模式(GPT 軍隊模型圖,11/17)─────────
// 有圖時取代上面程式畫的兵種模型(wmapArmyArtTroop 保留作備用:圖未載入 / 載入失敗 / WMAP_ARMY_IMG.on = false / 無 DOM 時 wmap_army.js 自動退回)。
// 素材:assets/wmap/army/army_{key}_{keep|strip}_{1x|2x}.webp(tools/wmap_army_img_prep.py 產生;key:sp 槍 sh 盾 ar 弓 ca 騎 en 械;meta = army_meta.json 的摘要,換圖重跑 prep 後把 cell / anchor 抄進下面 meta)。
//   atlas = 4 欄 × 3 列,每格 cell(1x 像素),錨點 anchor = 六邊形底座中心(格內);列 0 行進、列 1 返回(欄 0 左下 1 左上 2 下 3 上);列 2:欄 0 暫停、欄 1 駐守(面朝下)。圖是「左向」,右下 / 右上 = 水平鏡像。2x 檔 = 全部 ×2。
// 行程狀態(wmapArmyImgStateOf):trip.mode = 'march' | 'back' | 'pause' | 'garrison' 可明指;省略時由 phase 推:go → march、back → back、fight / wait / idle → pause。
//   現有資料沒有「駐守」:要畫駐守圖,呼叫端要在 trip 設 mode = 'garrison'(不動 wm_march.js / wmap_go.js)。
// 勢力色:trip.team = 'red' | 'yellow' | 'blue' | 'green' | 'black' | 'purple' 或 '#rrggbb'(預設 'red' = 原圖不染色)。wmapArmyTint 只動紅色系像素(色相 ±14° 全額、26° 內軟邊,飽和度 ≥ 0.6 全額),保留明暗;褐 / 灰 / 膚色 / 木頭不受影響。
//   染色後的 atlas 依 (兵種, 底座, 解析度, 勢力色) 快取成 canvas,只在第一次用到時建;wmapArmyImgMem() 回報位元組數。
// 公開:WMAP_ARMY_IMG(設定 + meta)、wmapArmyImgStateOf(it)、wmapArmyImgCellOf(state, dir, mir) → {row, col, flip}、wmapArmyImgDim(tp, s, res)、wmapArmyImgBox(tp, s)、
//       wmapArmyTint(src, team) → 同型別(ImageData | canvas)、wmapArmyTintData(data, rgb)(純函式)、wmapArmyTeamRGB(team)、wmapArmyImgFor(tp, team, D, dpr) → {img, ...}|null、wmapArmyImgMem()
var WMAP_ARMY_IMG = {
  on: true, base: 'keep', dir: 'assets/wmap/army/', baseK: 1.0, hi: 80,   // base:'keep' | 'strip';baseK:底座寬 = s × baseK(s = 格寬);hi:顯示底座寬(含 dpr)> hi px 用 2x 檔
  keys: { '槍': 'sp', '盾': 'sh', '弓': 'ar', '騎': 'ca', '械': 'en' },
  meta: {
    sp: { cell: [78, 65], anchor: [39, 42], baseW: 64 },
    sh: { cell: [70, 61], anchor: [35, 38], baseW: 64 },
    ar: { cell: [72, 60], anchor: [36, 37], baseW: 64 },
    ca: { cell: [72, 59], anchor: [36, 36], baseW: 64 },
    en: { cell: [72, 53], anchor: [36, 30], baseW: 64 }
  }
};
var WMAP_ARMY_TEAMS = { red: null, yellow: '#F2C21B', blue: '#2F6FD6', green: '#2E9E48', black: '#3B3B46', purple: '#8B3FBF' };   // red = 原圖(不染色)
wmapArmyArtCache.img = { raw: {}, tint: {}, warned: false };

// 行程 / item → 圖片狀態
function wmapArmyImgStateOf(it) {
  var m = it.mode;
  if (m === 'march' || m === 'back' || m === 'pause' || m === 'garrison') return m;
  var ph = it.phase;
  return ph === 'go' ? 'march' : (ph === 'back' ? 'back' : 'pause');
}
// 狀態 + 方向 → atlas 的列 / 欄與是否水平鏡像。dir 0 下 1 上 2 右下 3 右上(mir = 1 → 左向);圖本身是左向:左下 / 左上不翻,右下 / 右上要翻。暫停 / 駐守面朝下、不翻。
function wmapArmyImgCellOf(state, dir, mir) {
  if (state === 'pause') return { row: 2, col: 0, flip: false };
  if (state === 'garrison') return { row: 2, col: 1, flip: false };
  var row = state === 'back' ? 1 : 0;
  if (dir === 1) return { row: row, col: 3, flip: false };
  if (dir === 2) return { row: row, col: 0, flip: !mir };
  if (dir === 3) return { row: row, col: 1, flip: !mir };
  return { row: row, col: 2, flip: false };
}
// 畫面尺寸(純資料):res 1 | 2;s = 格寬(顯示底座寬 = s × baseK)。cw, ch = 該解析度下一格像素;ax, ay = 錨點像素;sc = 圖片像素 → 螢幕 px 的倍率
function wmapArmyImgDim(tp, s, res) {
  var key = WMAP_ARMY_IMG.keys[tp], m = key ? WMAP_ARMY_IMG.meta[key] : null;
  if (!m) return null;
  res = res || 1;
  return { cw: m.cell[0] * res, ch: m.cell[1] * res, ax: m.anchor[0] * res, ay: m.anchor[1] * res, sc: s * WMAP_ARMY_IMG.baseK / (m.baseW * res), key: key };
}
// 相對錨點(底座中心)的命中框 [x0, y0, x1, y1],未鏡像(錨點在格中央,鏡像不變);無圖資料 → null
function wmapArmyImgBox(tp, s) {
  if (!WMAP_ARMY_IMG.on) return null;
  var d = wmapArmyImgDim(tp, s, 1);
  if (!d) return null;
  return [-d.ax * d.sc, -d.ay * d.sc, (d.cw - d.ax) * d.sc, (d.ch - d.ay) * d.sc];
}

// ───── 染色 ─────
function wmapArmyTeamRGB(team) {
  if (team === undefined || team === null || team === '' || team === 'red') return null;
  var c = Object.prototype.hasOwnProperty.call(WMAP_ARMY_TEAMS, team) ? WMAP_ARMY_TEAMS[team] : team;
  if (!c) return null;
  var m = /^#?([0-9a-f]{6})$/i.exec(String(c));
  if (!m) return null;
  var n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function wmapArmyRgb2Hsv(r, g, b) {
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn, h = 0;
  if (c > 0) {
    if (mx === r) h = ((g - b) / c) % 6; else if (mx === g) h = (b - r) / c + 2; else h = (r - g) / c + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? c / mx : 0, mx / 255];
}
function wmapArmyHsv2Rgb(h, s, v) {
  var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r, g, b;
  if (h < 60) { r = c; g = x; b = 0; } else if (h < 120) { r = x; g = c; b = 0; } else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; } else if (h < 300) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
// 純函式:data = RGBA 位元組陣列(原地改);rgb = 目標色 [r, g, b]。只動「紅色系」像素:R 最大、色相離 0° ≤ 14° 全額(26° 軟邊)、飽和度 ≥ 0.6 全額(0.45 軟邊)、非極暗。
// 明暗:新亮度 = 目標色亮度 × (像素亮度 / 0.9)(0.9 ≈ 純紅 #E01010 的亮度),所以暗紅陰影仍是較暗的目標色;與原像素依權重 w 混合。
function wmapArmyTintData(data, rgb) {
  if (!rgb) return data;
  var th = wmapArmyRgb2Hsv(rgb[0], rgb[1], rgb[2]), n = data.length, i, r, g, b, mx, mn, c, s, v, dh, wh, ws, w, rel, nv, ns, o;
  for (i = 0; i < n; i += 4) {
    if (data[i + 3] === 0) continue;
    r = data[i]; g = data[i + 1]; b = data[i + 2];
    mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    if (mx !== r || mx < 40) continue;
    mn = g < b ? g : b; c = mx - mn;
    if (c === 0) continue;
    s = c / mx; if (s <= 0.45) continue;
    dh = Math.abs(60 * (g - b) / c);
    if (dh >= 26) continue;
    wh = dh <= 14 ? 1 : (26 - dh) / 12;
    ws = s >= 0.6 ? 1 : (s - 0.45) / 0.15;
    w = wh * ws; if (w <= 0) continue;
    v = mx / 255; rel = v / 0.9; if (rel > 1.15) rel = 1.15;
    nv = Math.min(1, th[2] * rel); ns = Math.min(1, th[1] * Math.min(1, s / 0.93));
    o = wmapArmyHsv2Rgb(th[0], ns, nv);
    data[i] = r + (o[0] - r) * w + 0.5 | 0; data[i + 1] = g + (o[1] - g) * w + 0.5 | 0; data[i + 2] = b + (o[2] - b) * w + 0.5 | 0;
  }
  return data;
}
// src = ImageData({data,width,height}) → 原地染色後回傳同一物件;src = canvas / image → 回傳染色後的新 canvas(無 DOM → null)。team 見檔頭;red / 未知 → 回原物。
function wmapArmyTint(src, team) {
  var rgb = wmapArmyTeamRGB(team);
  if (!rgb || !src) return src;
  if (src.data && src.width) { wmapArmyTintData(src.data, rgb); return src; }
  var w = src.width, h = src.height, cv = wmapArmyArtCanvas(w, h);
  if (!cv) return null;
  var g = cv.getContext('2d'), id;
  g.drawImage(src, 0, 0);
  id = g.getImageData(0, 0, w, h);
  wmapArmyTintData(id.data, rgb);
  g.putImageData(id, 0, 0);
  return cv;
}

// ───── 載入 / 快取 ─────
function wmapArmyImgUrl(key, base, res) { return WMAP_ARMY_IMG.dir + 'army_' + key + '_' + base + '_' + (res === 2 ? '2x' : '1x') + '.webp'; }
function wmapArmyImgRaw(url, noLoad) {
  var C = wmapArmyArtCache.img, e = C.raw[url];
  if (e || noLoad) return e || null;
  if (typeof Image === 'undefined') return null;
  e = C.raw[url] = { img: new Image(), st: 0 };
  e.img.onload = function () { e.st = 1; };
  e.img.onerror = function () { e.st = -1; };
  e.img.src = url;
  return e;
}
function wmapArmyImgCanvasOf(key, res, team, noLoad) {   // → 圖(img 或染色 canvas)| null(還沒載入 / 失敗)
  var C = wmapArmyArtCache.img, url = wmapArmyImgUrl(key, WMAP_ARMY_IMG.base, res), e = wmapArmyImgRaw(url, noLoad);
  if (!e || e.st !== 1) return null;
  if (!wmapArmyTeamRGB(team)) return e.img;
  var tk = url + '|' + team, hit = C.tint[tk];
  if (hit !== undefined) return hit;
  try { hit = wmapArmyTint(e.img, team); }
  catch (err) { if (!C.warned) { C.warned = true; if (typeof console !== 'undefined') console.warn('wmapArmyTint 失敗(畫布受汙染?),改用原色圖:', err && err.message); } hit = e.img; }
  C.tint[tk] = hit || e.img;
  return C.tint[tk];
}
// 繪製用:回傳 {img, res, cw, ch, ax, ay, sc} 或 null(圖模式關閉 / 無此兵種 / 沒載入 → 呼叫端退回程式畫)
function wmapArmyImgFor(tp, team, D, dpr) {
  if (!WMAP_ARMY_IMG.on || typeof document === 'undefined') return null;
  var key = WMAP_ARMY_IMG.keys[tp];
  if (!key) return null;
  var want = D * WMAP_ARMY_IMG.baseK * (dpr || 1) > WMAP_ARMY_IMG.hi ? 2 : 1, res = want, img = wmapArmyImgCanvasOf(key, want, team);
  if (!img) { res = 3 - want; img = wmapArmyImgCanvasOf(key, res, team, true); if (!img) return null; }   // 退而求其次只看已載入的另一檔,不額外發起下載
  var d = wmapArmyImgDim(tp, D, res);
  d.img = img; d.res = res;
  return d;
}
// 已快取的圖片模式位元組數:raw = 原圖解碼後(寬 × 高 × 4)、tint = 染色後 canvas
function wmapArmyImgMem() {
  var C = wmapArmyArtCache.img, o = { raw: 0, tint: 0, total: 0 }, k, e, t;
  for (k in C.raw) { e = C.raw[k]; if (e && e.st === 1) o.raw += e.img.naturalWidth * e.img.naturalHeight * 4; }
  for (k in C.tint) { t = C.tint[k]; if (t && t.width) o.tint += t.width * t.height * 4; }
  o.total = o.raw + o.tint;
  return o;
}

// ───────── 旗布 ─────────
// side → 旗形:own 燕尾、ally 方、foe / raid 三角牙旗
function wmapArmyArtFlagPath(g, shape, w, h, wv) {
  g.beginPath();
  g.moveTo(0, 0);
  if (shape === 'swallow') {
    g.quadraticCurveTo(w * 0.5, -5 + wv, w, wv); g.lineTo(w - 17, h * 0.5 + wv); g.lineTo(w, h + wv);
    g.quadraticCurveTo(w * 0.5, h - 5 - wv * 0.6, 0, h);
  } else if (shape === 'square') {
    g.quadraticCurveTo(w * 0.5, -5 + wv, w, wv); g.lineTo(w, h + wv);
    g.quadraticCurveTo(w * 0.5, h - 5 - wv * 0.6, 0, h);
  } else {   // 三角牙旗:右指三角,下緣鋸齒
    g.quadraticCurveTo(w * 0.5, -3 + wv, w, h * 0.5 + wv);
    var n = 4, i, t, bx, by;
    for (i = 1; i <= n * 2; i++) {   // 由尖端沿下緣回到 (0, h),奇偶交替內縮成牙
      t = i / (n * 2); bx = w * (1 - t); by = h * 0.5 + wv * (1 - t) + (h * 0.5 - wv * (1 - t)) * t;
      if (i < n * 2 && (i & 1)) { bx -= 3; by -= 7; } else if (i < n * 2) { bx += 2; by += 2; }
      g.lineTo(bx, by);
    }
  }
  g.closePath();
}
function wmapArmyArtFlag(side, tag, mir, rolled, wave) {
  var key = side + '|' + tag + '|' + (mir ? 1 : 0) + '|' + (rolled ? 1 : 0) + '|' + (wave ? 1 : 0), hit = wmapArmyArtCache.flags[key];
  if (hit !== undefined) return hit;
  var C = WMAP_ARMY_ART_COL, A = WMAP_ARMY_ART_ARMY, w = A.flagW, h = A.flagH, pad = 8, cw = w + pad * 2 + 6, ch = h + pad * 2 + 10;
  var cv = wmapArmyArtCanvas(cw, ch);
  if (!cv) { wmapArmyArtCache.flags[key] = null; return null; }
  var g = cv.getContext('2d'), isOwn = side === 'own', isAlly = side === 'ally';
  var shape = isOwn ? 'swallow' : (isAlly ? 'square' : 'tri');
  var fill = isOwn ? C.own : (isAlly ? C.ally : C.foe), edge = isOwn ? C.ownEdge : C.cream;
  var hs = rolled ? 0.5 : 1, wv = rolled ? 0 : (wave ? 5 : -2), hx = mir ? cw - pad : pad, hy = pad + 4;
  g.save(); g.translate(hx, hy); if (mir) g.scale(-1, 1); g.scale(rolled ? 0.82 : 1, hs);
  wmapArmyArtFlagPath(g, shape, w, h, wv);
  g.fillStyle = fill; g.fill();
  g.save(); g.clip();
  var sh = g.createLinearGradient(0, 0, 0, h);   // 一階陰影:下緣變暗、上緣略亮
  sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = sh; g.fillRect(-4, -12, w + 8, h + 24);
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(w * 0.34, 2); g.quadraticCurveTo(w * 0.40, h * 0.5 + wv * 0.4, w * 0.32, h); g.stroke();   // 摺痕
  if (!isOwn && !isAlly) {   // 敵旗:席位色橫帶(下緣)
    g.fillStyle = (typeof tag === 'number') ? wmapArmyArtSeatColor(tag) : (tag || '#c9a227');
    g.fillRect(-4, h * 0.56, w + 8, h * 0.2); g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(-4, h * 0.56, w + 8, h * 0.2);
  }
  g.strokeStyle = edge; g.lineWidth = 9; wmapArmyArtFlagPath(g, shape, w, h, wv); g.stroke();   // 內緣色邊(clip 後只剩內側一半)
  g.restore();
  wmapArmyArtFlagPath(g, shape, w, h, wv); g.strokeStyle = C.line; g.lineWidth = 4; g.lineJoin = 'round'; g.stroke();
  g.restore();
  // 旗面文字(不鏡像;捲旗不畫)
  if (!rolled) {
    var cx = mir ? hx - w * 0.5 : hx + w * 0.5, cy = hy + h * 0.5 + (wave ? 1 : -1);
    if (isOwn && tag) {
      g.fillStyle = C.gold; g.strokeStyle = C.line; g.lineWidth = 3; g.beginPath(); g.arc(cx - (mir ? -3 : 3), cy, 13, 0, 6.2832); g.fill(); g.stroke();
      g.fillStyle = C.line; g.font = 'bold 19px "Noto Serif TC","Microsoft JhengHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(tag), cx - (mir ? -3 : 3), cy + 1);
    } else if (isAlly && tag && typeof tag === 'string') {
      g.fillStyle = C.cream; g.strokeStyle = C.line; g.lineWidth = 3; g.font = 'bold 22px "Noto Serif TC","Microsoft JhengHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.strokeText(tag.charAt(0), cx, cy + 1); g.fillText(tag.charAt(0), cx, cy + 1);
    }
  }
  var o = { canvas: cv, hx: hx, hy: hy };
  wmapArmyArtCache.flags[key] = o;
  return o;
}

// ───────── 徽章 ─────────
function wmapArmyArtBadge(kind) {
  if (wmapArmyArtCache.badges[kind] !== undefined) return wmapArmyArtCache.badges[kind];
  var C = WMAP_ARMY_ART_COL, cv = wmapArmyArtCanvas(56, 56);
  if (!cv) { wmapArmyArtCache.badges[kind] = null; return null; }
  var g = cv.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'bag') {
    g.fillStyle = '#c9a063'; g.strokeStyle = C.line; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(20, 18); g.quadraticCurveTo(6, 28, 10, 44); g.quadraticCurveTo(28, 52, 46, 44); g.quadraticCurveTo(50, 28, 36, 18); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8a5f38'; g.beginPath(); g.moveTo(18, 14); g.lineTo(38, 14); g.lineTo(36, 20); g.lineTo(20, 20); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = C.gold; g.beginPath(); g.arc(28, 33, 5, 0, 6.2832); g.fill(); g.stroke();
  } else {
    g.fillStyle = '#f4ebd0'; g.strokeStyle = C.line; g.lineWidth = 4; g.beginPath(); g.arc(28, 28, 22, 0, 6.2832); g.fill(); g.stroke();
    if (kind === 'wait') {   // 沙漏
      g.fillStyle = '#d9b24a'; g.lineWidth = 3; g.beginPath(); g.moveTo(18, 14); g.lineTo(38, 14); g.lineTo(30, 28); g.lineTo(38, 42); g.lineTo(18, 42); g.lineTo(26, 28); g.closePath(); g.fill(); g.stroke();
    } else {   // 交叉刀
      var sd = [[-1, 1], [1, 1]], i;
      for (i = 0; i < 2; i++) {
        g.save(); g.translate(28, 28); g.rotate(i ? 0.8 : -0.8);
        g.strokeStyle = C.line; g.lineWidth = 8; g.beginPath(); g.moveTo(0, -17); g.lineTo(0, 11); g.stroke();
        g.strokeStyle = '#e8ecf2'; g.lineWidth = 3.6; g.beginPath(); g.moveTo(0, -16); g.lineTo(0, 9); g.stroke();
        g.strokeStyle = C.line; g.lineWidth = 6; g.beginPath(); g.moveTo(-6, 11); g.lineTo(6, 11); g.stroke();
        g.strokeStyle = '#c9892f'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-5, 11); g.lineTo(5, 11); g.stroke();
        g.strokeStyle = C.line; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 12); g.lineTo(0, 18); g.stroke();
        g.restore();
      }
    }
  }
  wmapArmyArtCache.badges[kind] = cv;
  return cv;
}
