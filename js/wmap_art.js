// js/wmap_art.js — M1 斜角大地圖:程式繪製的圖形登錄表(設計_M1視覺原型_實作計畫.md 5.1;設計_地圖斜角視覺_規格.md 2~4)。
// 載入時不畫、第一次 wmapArtGet(key) 才畫進離屏 canvas 並快取;鍵名 = 未來正式圖的代號(M1 / M2c / O1 / res_farm / g_grass_a…)。
// 資源領地(2026-11-16 起):不再有整格 res_* 圖,也沒有任何建築 / 旗 / 里程碑;只有 gt_(地面紋理)/ ro_(自然散布物:樹 灌木 作物 草叢 岩石 礦石 野獸),演算法在 wmap_res.js。
// 正式圖到了:把該鍵的畫法換成「載入圖檔」(WMAP_ART_SRC[key] = '檔名'),其他程式(wmap_view.js)不動。ES2017,不用 ?. ??;UTF-8 + CRLF。
// 畫法依規格 4.1:光源左上、左亮右暗、深褐描邊(底緣不描邊)、接觸陰影程式畫、物件不帶地面(地面永遠是地磚);色板取 bigmap(黃綠草地、米黃土、岩灰褐、河藍)。
// 命名:本檔全域一律 wmap* / WMAP_*。
//
// ───────── 公開 API ─────────
//   WMAP_PAL                                  色板(cloud 雲海底色、fog 霧色…)
//   WMAP_PIECE                                拼塊目錄:{id: {fw, fh, cw, ch, cells:[[dr,dc]…]}};fw = footprint 欄數(c 方向)、fh = 列數(r 方向);cw × ch = 原圖畫布(1 格 = 256 px 寬)
//   WMAP_RES                                  資源領地名稱:{farm:'農田', mine:'礦坑', hunt:'獵場', lumber:'林場', quarry:'採石場'}(資訊列用;地圖上不畫文字)
//   wmapArtGet(key) → {c: canvas, cw, ch, fw, fh} | null     取圖(快取);key 例:'g_grass_a'(256×128 菱形地磚)、'mask_0'~'mask_7'(過渡遮罩)、'M1' 'M2c' 'M2r' 'M3f' 'M3b' 'M3l' 'M3r' 'M4' 'O1' 'T1' 'CITY'、'gt_<種類>'(512² 可平鋪紋理)、'ro_<種類>_<款>_<1~5>'(物件圖的 cw/ch/ax/ay 為格寬 256 邏輯單位,畫布 2 倍取樣,ax/ay = 腳點)
//   wmapArtGroundKey(type, v) → 'g_' + type + '_' + 'abc'[v % n]   type:grass dirt wood road rammed rock;a / b / c 款數見 WMAP_GROUND_N
//   wmapArtRiver(g, pass, nb, ford, h, dg) / wmapArtRoad(g, pass, nb, h)   在「單位 = 一格、原點 = 格頂點 (u=c, v=r)」的等角 transform 下畫河 / 路單格(pass:'bank' 'water' 'hi' / 'edge' 'fill';nb = [r−1, c+1, r+1, c−1] 四鄰是否同類)
//   城池 5 鍵 'CITY' 'COUNTY' 'JUN' 'PASS0' 'PASS1':wmapArtGet(key, q) 按倍率 q 重畫向量(見下方「城池圖介面表」);'gt_road' = 土道路紋理(路面用,世界錨定平鋪)
//
// ───────── 城池圖介面表(2026-11-16 MV2;規格 設計_地圖城池占地與美工_規格.md 第 3 節) ─────────
//   wmapArtGet(key, q) → {c: canvas, cw, ch, fw, fh, q, pw, ph} | null     key ∈ CITY COUNTY JUN PASS0 PASS1;cw × ch = 邏輯尺寸(1 格寬 = 256),pw × ph = canvas 實際像素 = round(cw × q) × round(ch × q);q 省略 = 1
//   q 的算法:wmapArtCityQ(s, dpr, lowQ) = (s / 128) × min(dpr, lowQ ? 1 : 2)  → 貼圖時 drawImage(a.c, x, y, cw × G.W / 256, ch × G.W / 256)(CSS px;與 wmapDrawArt 同公式),canvas 1:1 不再縮放
//   同時只留一個倍率層:換 q(差 > 0.0005)或低畫質旗標(wmapArtLowQ():WMAP.lowQ 或 navigator.deviceMemory ≤ 2)就整層清掉;沒有 1× 備份;缺 canvas / getContext 回 null(不丟例外)
//   放置:wmapPieceBox(G, c0, r0, fw, fh, cw, ch)(圖左緣 = 占地左角 (c0, r0 + fh)、圖底 = 占地前角 (c0 + fw, r0 + fh))。錨點 = 占地菱形:左角 (0, ch − (fw+fh)×32)、前角 (cw/2 + (fw−fh)×64, ch)、上角 (cw/2 − ... ) 見 WMAP_PIECE
//   | key    | 占地 fw×fh | cw × ch      | 往上可用 | 用途                                                    |
//   | CITY   | 3 × 3      | 768 × 680    | 296      | 主城(朱紅 + 金脊;城門在右前牆 u+1 面、左後牆小門樓)       |
//   | COUNTY | 3 × 3      | 768 × 560    | 176      | 縣城(青灰瓦、灰褐夯土牆;四面小門、前角哨樓)             |
//   | JUN    | 4 × 4      | 1024 × 800   | 288      | 郡城(黛藍琉璃瓦 + 金脊、青磚灰牆;四角樓、正面兩座城樓)   |
//   | PASS0  | 2 × 3      | 640 × 600    | 280      | 關(黑瓦石砌門樓 + 兩側山壁),道路沿 c;fw = 沿路 2、fh = 橫跨 3 |
//   | PASS1  | 3 × 2      | 640 × 600    | 280      | 關,道路沿 r;node.axis 0 → PASS0、1 → PASS1             |
//   圖內結構(邏輯座標,pt(u, v) = ((u − v + fh) × 128, ch − (fw+fh)×64 + (u + v) × 64);u = c 方向、v = r 方向、單位 = 格):
//     縣 / 郡 / 主城:牆面在 u、v = 0.12 與 fw / fh − 0.12;四個門在邊長 n 的第 floor((n−1)/2) 格正中(side 0 = v−1 面、1 = u+1 面、2 = v+1 面、3 = u−1 面),與 wm_gen 的 gates 一致;主城門固定 side 1(+ side 3 小門樓)
//     關:道路 = 沿路座標 s ∈ [0, 2]、橫跨座標 t ∈ [1, 2](PASS0:u = s、v = t;PASS1:u = t、v = s);門樓橫跨門道,門洞開在 +s 面
//   wmapArtCityGateAnchor(key, side) → {x, y} | null     門(樓頂)位置,圖內邏輯座標(往右加 wmapPieceBox 的 x、y;乘 W/256);給 FLAG_ME 小旗腳點用
//   'FLAG_ME'(64 × 96 邏輯、ax 14 / ay 92 = 旗桿腳,不分層):攻下後的朱紅小旗,畫在 wmapArtCityGateAnchor 上;朱紅只給我的
//   wmapArtCityMem(q) → bytes   五鍵(關 2 款)同時存在的 RGBA 記憶體估算;wmapArtCityQ(s, dpr, lowQ) → q
//   低畫質(lowQ):dpr 上限 1(由呼叫端用 wmapArtCityQ 傳 lowQ)、民居減半、不畫雉堞 / 攤棚 / 花
//   wmapArtIsoT(g, G, c, r)                   設好上述 transform(畫完 g.restore());G = wmapGeom 的結果
//   wmapArtClear()                            清快取(測試用)

var WMAP_PAL = {
  cloud: '#d6e4e8', fog: '#dfe9ec', ink: '#4a3b2c',
  grass: ['#9fc95c', '#93be52', '#a7d065'], grassDark: '#6e9f3c', grassLite: '#c6e486',
  dirt: '#cfa86a', dirtDark: '#a98650', dirtLite: '#e3c892',
  wood: '#79a64a', woodDark: '#4f7d38',
  road: '#d8c594', roadEdge: '#9f8758',
  rammed: '#c9b78c', rammedDark: '#a79366',
  rock: '#a79f8c', rockDark: '#7b7463',
  water: '#58a5d4', waterDeep: '#3d86b8', waterHi: '#a9def0', bank: '#c9b783'
};
var WMAP_GROUND_N = { grass: 3, dirt: 2, wood: 2, road: 2, rammed: 2, rock: 2 };
function wmapArtCellsRect(fw, fh) { var a = [], r, c; for (r = 0; r < fh; r++) for (c = 0; c < fw; c++) a.push([r, c]); return a; }
var WMAP_PIECE = {
  M1: { fw: 1, fh: 1, cw: 256, ch: 256, cells: [[0, 0]] },
  M2c: { fw: 2, fh: 1, cw: 384, ch: 352, cells: [[0, 0], [0, 1]] },
  M2r: { fw: 1, fh: 2, cw: 384, ch: 352, cells: [[0, 0], [1, 0]] },
  M3f: { fw: 2, fh: 2, cw: 512, ch: 448, cells: [[0, 0], [0, 1], [1, 0]] },
  M3b: { fw: 2, fh: 2, cw: 512, ch: 448, cells: [[0, 1], [1, 0], [1, 1]] },
  M3l: { fw: 2, fh: 2, cw: 512, ch: 448, cells: [[0, 0], [0, 1], [1, 1]] },
  M3r: { fw: 2, fh: 2, cw: 512, ch: 448, cells: [[0, 0], [1, 0], [1, 1]] },
  M4: { fw: 2, fh: 2, cw: 512, ch: 448, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  O1: { fw: 1, fh: 1, cw: 256, ch: 192, cells: [[0, 0]] },
  T1: { fw: 1, fh: 1, cw: 256, ch: 288, cells: [[0, 0]] },
  // 城池圖(2026-11-16 MV2):cw = (fw + fh) × 128;圖左緣 = 占地左角、圖底 = 占地前角(wmapPieceBox);cells = 占地全部格 [dr, dc]
  COUNTY: { fw: 3, fh: 3, cw: 768, ch: 560, cells: wmapArtCellsRect(3, 3) },   // 縣城 3×3
  JUN: { fw: 4, fh: 4, cw: 1024, ch: 800, cells: wmapArtCellsRect(4, 4) },     // 郡城 4×4
  PASS0: { fw: 2, fh: 3, cw: 640, ch: 600, cells: wmapArtCellsRect(2, 3) },    // 關:道路沿 c(u)走、沿路 2 格、橫跨 3 格(門道 = 中間 r 那排)
  PASS1: { fw: 3, fh: 2, cw: 640, ch: 600, cells: wmapArtCellsRect(3, 2) },    // 關:道路沿 r(v)走
  CITY: { fw: 3, fh: 3, cw: 768, ch: 680, cells: wmapArtCellsRect(3, 3) }
};
var WMAP_RES = { farm: '農田', mine: '礦坑', hunt: '獵場', lumber: '林場', quarry: '採石場' };
var WMAP_ART_SRC = {};   // 正式圖到了:WMAP_ART_SRC['M1'] = 'assets/iso/M1_a.webp'(目前未使用,保留接口)
var wmapArtCache = {};

// ───────── 小工具 ─────────
function wmapArtCv(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function wmapArtRng(seed) {
  var a = seed >>> 0;
  return function () {
    var t;
    a = (a + 0x6D2B79F5) >>> 0;
    t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function wmapArtStr(s) { var h = 2166136261, i; for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function wmapArtDia(g, x, y, w, h) { g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w, y + h / 2); g.lineTo(x + w / 2, y + h); g.lineTo(x, y + h / 2); g.closePath(); }
function wmapArtPoly(g, pts) { var i; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
function wmapArtFillStroke(g, pts, fill, stroke, lw) {
  wmapArtPoly(g, pts); g.fillStyle = fill; g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2.5; g.lineJoin = 'round'; g.stroke(); }
}
function wmapArtShade(hex, k) {   // 亮度倍率(k < 1 變暗,> 1 變亮)
  var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * k))); gg = Math.max(0, Math.min(255, Math.round(gg * k))); b = Math.max(0, Math.min(255, Math.round(b * k)));
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
}
// 等角方塊:底面菱形中心 (cx, cy)、半寬 hw、半高 hh、高 h;面色 l(左)r(右)t(頂),描邊 ol
function wmapArtIsoBox(g, cx, cy, hw, hh, h, l, r, t, ol) {
  var L = [cx - hw, cy], R = [cx + hw, cy], F = [cx, cy + hh], B = [cx, cy - hh];
  wmapArtFillStroke(g, [L, F, [F[0], F[1] - h], [L[0], L[1] - h]], l, ol, 2.5);
  wmapArtFillStroke(g, [F, R, [R[0], R[1] - h], [F[0], F[1] - h]], r, ol, 2.5);
  wmapArtFillStroke(g, [[B[0], B[1] - h], [R[0], R[1] - h], [F[0], F[1] - h], [L[0], L[1] - h]], t, ol, 2.5);
}
// 金字塔屋頂:底(已抬高)中心 (cx, cy)、半寬 hw、半高 hh、屋頂高 rh
function wmapArtRoof(g, cx, cy, hw, hh, rh, l, r, ol) {
  var L = [cx - hw, cy], R = [cx + hw, cy], F = [cx, cy + hh], A = [cx, cy - rh];
  wmapArtFillStroke(g, [L, F, A], l, ol, 2.5);
  wmapArtFillStroke(g, [F, R, A], r, ol, 2.5);
}
function wmapArtShadow(g, cx, cy, rx, ry, a) {
  g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
  var gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, 'rgba(40,52,22,' + a + ')'); gr.addColorStop(0.7, 'rgba(40,52,22,' + (a * 0.6) + ')'); gr.addColorStop(1, 'rgba(40,52,22,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
}

// ───────── 地磚(256×128 菱形;有層次:底色漸層、斑塊、細點、草叢、內緣高光 / 暗邊) ─────────
function wmapArtGroundKey(type, v) { var n = WMAP_GROUND_N[type] || 1; return 'g_' + type + '_' + 'abc'.charAt(((v | 0) % n + n) % n); }
function wmapArtMakeGround(key) {
  var p = key.split('_'), type = p[1], vi = 'abc'.indexOf(p[2]), c = wmapArtCv(256, 128), g = c.getContext('2d'), rng = wmapArtRng(wmapArtStr(key)), i, x, y, base, dark, lite, gr, sp;
  if (type === 'grass') { base = WMAP_PAL.grass[vi]; dark = WMAP_PAL.grassDark; lite = WMAP_PAL.grassLite; }
  else if (type === 'dirt') { base = WMAP_PAL.dirt; dark = WMAP_PAL.dirtDark; lite = WMAP_PAL.dirtLite; }
  else if (type === 'wood') { base = WMAP_PAL.wood; dark = WMAP_PAL.woodDark; lite = '#9cc56a'; }
  else if (type === 'road') { base = WMAP_PAL.road; dark = WMAP_PAL.roadEdge; lite = '#ece0b8'; }
  else if (type === 'rammed') { base = WMAP_PAL.rammed; dark = WMAP_PAL.rammedDark; lite = '#e0d3ac'; }
  else { base = WMAP_PAL.rock; dark = WMAP_PAL.rockDark; lite = '#c5beac'; }
  if (vi === 1) base = wmapArtShade(base, 0.95);
  g.save(); wmapArtDia(g, 0, 0, 256, 128); g.clip();
  gr = g.createLinearGradient(40, 0, 216, 128); gr.addColorStop(0, wmapArtShade(base, 1.07)); gr.addColorStop(1, wmapArtShade(base, 0.92));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  for (i = 0; i < 9; i++) {   // 大斑塊(明暗各半)
    x = 20 + rng() * 216; y = 10 + rng() * 108; sp = 26 + rng() * 34;
    gr = g.createRadialGradient(x, y, 0, x, y, sp); gr.addColorStop(0, i & 1 ? 'rgba(255,255,220,.16)' : 'rgba(40,70,20,.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - sp, y - sp, sp * 2, sp * 2);
  }
  for (i = 0; i < 150; i++) {   // 細點
    x = rng() * 256; y = rng() * 128;
    g.fillStyle = rng() < 0.5 ? dark : lite; g.globalAlpha = 0.22 + rng() * 0.2;
    g.fillRect(x, y, 2 + (rng() * 2 | 0), 2);
  }
  g.globalAlpha = 1;
  if (type === 'grass' || type === 'wood') {   // 草叢:三筆短弧
    g.lineCap = 'round';
    for (i = 0; i < 16; i++) {
      x = 24 + rng() * 208; y = 14 + rng() * 100;
      if (Math.abs(x - 128) / 128 + Math.abs(y - 64) / 64 > 0.86) continue;
      g.strokeStyle = i & 1 ? dark : lite; g.globalAlpha = 0.55; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x - 5, y - 6); g.moveTo(x, y); g.lineTo(x, y - 8); g.moveTo(x + 3, y); g.lineTo(x + 5, y - 6); g.stroke();
    }
    g.globalAlpha = 1;
  } else if (type === 'dirt' || type === 'rock') {   // 小石子
    for (i = 0; i < 10; i++) {
      x = 30 + rng() * 196; y = 18 + rng() * 92;
      g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(x, y, 4 + rng() * 3, 2.2, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(60,40,20,.2)'; g.beginPath(); g.ellipse(x + 1.5, y + 1.8, 4, 2, 0, 0, 7); g.fill();
    }
  } else if (type === 'rammed' || type === 'road') {   // 夯土裂紋
    g.strokeStyle = 'rgba(80,60,30,.25)'; g.lineWidth = 1.5;
    for (i = 0; i < 6; i++) { x = 40 + rng() * 170; y = 20 + rng() * 80; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14 + rng() * 14, y + rng() * 10 - 5); g.lineTo(x + 30 + rng() * 10, y + rng() * 14 - 7); g.stroke(); }
  }
  // 內緣:左上兩邊亮、右下兩邊暗(讓格與格有層次,又不是死板格線)
  g.lineWidth = 5; g.lineJoin = 'miter';
  g.strokeStyle = 'rgba(255,255,230,.30)'; g.beginPath(); g.moveTo(0, 64); g.lineTo(128, 0); g.lineTo(256, 64); g.stroke();
  g.strokeStyle = 'rgba(30,45,15,.22)'; g.beginPath(); g.moveTo(0, 64); g.lineTo(128, 128); g.lineTo(256, 64); g.stroke();
  g.restore();
  return { c: c, cw: 256, ch: 128, fw: 1, fh: 1 };
}
// 過渡遮罩:對著某一邊(0 = r−1 右上、1 = c+1 右下、2 = r+1 左下、3 = c−1 左上)的鋸齒窄帶;4~7 = 另一款
function wmapArtMakeMask(key) {
  var k = parseInt(key.slice(5), 10), e = k & 3, c = wmapArtCv(256, 128), g = c.getContext('2d'), rng = wmapArtRng(777 + k * 31), P = [[128, 0], [256, 64], [128, 128], [0, 64]], a = P[e], b = P[(e + 1) & 3], i, t, d, px, py;
  g.fillStyle = '#000'; g.beginPath(); g.moveTo(a[0], a[1]);
  for (i = 0; i <= 12; i++) { t = i / 12; d = 0.18 + rng() * 0.16; px = a[0] + (b[0] - a[0]) * t; py = a[1] + (b[1] - a[1]) * t; g.lineTo(px + (128 - px) * d, py + (64 - py) * d); }
  g.lineTo(b[0], b[1]); g.closePath(); g.fill();
  return { c: c, cw: 256, ch: 128, fw: 1, fh: 1 };
}

// ───────── 河 / 路(等角 transform 下,單位 = 一格,原點 = 格頂點) ─────────
function wmapArtIsoT(g, G, c, r) {   // 畫在 world 座標系:把單位方格 (u, v) 映到菱形;呼叫端 g.save() 之後呼叫,畫完 g.restore()
  var t = wmapUV2World(G, c, r);
  g.transform(G.W / 2, G.H / 2, -G.W / 2, G.H / 2, t.x, t.y);
}
var WMAP_DIR4 = [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]];   // r−1、c+1、r+1、c−1 的邊中點相對中心位移(格單位)
function wmapArtBand(g, nb, lw, color) {
  var i, n = 0;
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'butt';
  for (i = 0; i < 4; i++) {
    if (!nb[i]) continue;
    n++;
    g.beginPath(); g.moveTo(0.5, 0.5); g.lineTo(0.5 + WMAP_DIR4[i][0], 0.5 + WMAP_DIR4[i][1]); g.stroke();
  }
  g.beginPath(); g.arc(0.5, 0.5, lw / 2 * (n === 1 || n === 0 ? 1.0 : 1.0), 0, Math.PI * 2); g.fill();
}
var WMAP_QUAD = [[0.5, 0.5, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5]];   // 相鄰兩方向 (i, i+1) 的四分之一格 [u, v, w, h]:1→2 右下、2→3 左下、3→0 左上、0→1 右上
function wmapArtQuads(g, dg, color) {   // dg[i] = 兩個鄰向 (i, i+1) 與其斜角鄰格都是河 → 補滿該四分之一格(2×2 河塊中央的洞)
  var i, q;
  if (!dg) return;
  g.fillStyle = color;
  for (i = 0; i < 4; i++) { if (!dg[i]) continue; q = WMAP_QUAD[(i + 1) & 3]; g.fillRect(q[0], q[1], q[2], q[3]); }
}
function wmapArtRiver(g, pass, nb, ford, h, dg) {
  var i;
  if (pass === 'bank') { wmapArtBand(g, nb, 0.74, WMAP_PAL.bank); wmapArtQuads(g, dg, WMAP_PAL.bank); }
  else if (pass === 'water') {
    wmapArtBand(g, nb, 0.54, ford ? '#86cde2' : WMAP_PAL.water);
    if (!ford) wmapArtBand(g, nb, 0.3, WMAP_PAL.waterDeep);
    wmapArtQuads(g, dg, ford ? '#86cde2' : WMAP_PAL.water);
  } else if (pass === 'hi') {
    if (ford) {   // 淺灘:三顆踏石
      g.fillStyle = '#cfc8b4'; g.strokeStyle = '#7a705c'; g.lineWidth = 0.025;
      for (i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0.5 + (i - 1) * 0.2, 0.5 + ((h >> i) & 1 ? 0.04 : -0.04), 0.075, 0.06, 0, 0, 7); g.fill(); g.stroke(); }
    } else {
      g.strokeStyle = WMAP_PAL.waterHi; g.globalAlpha = 0.75; g.lineWidth = 0.05; g.lineCap = 'round';
      for (i = 0; i < 4; i++) {
        if (!nb[i]) continue;
        g.beginPath(); g.moveTo(0.5 + (i & 1 ? 0.08 : -0.1), 0.5 + (i & 1 ? -0.1 : 0.08)); g.lineTo(0.5 + WMAP_DIR4[i][0] * 0.8, 0.5 + WMAP_DIR4[i][1] * 0.8); g.stroke();
      }
      g.globalAlpha = 1;
    }
  }
}
function wmapArtRoad(g, pass, nb, h) {
  if (pass === 'edge') wmapArtBand(g, nb, 0.5, WMAP_PAL.roadEdge);
  else if (pass === 'fill') { wmapArtBand(g, nb, 0.4, WMAP_PAL.road); wmapArtBand(g, nb, 0.14, '#e9dcb0'); }
}

// ───────── 山 / 石 / 樹 ─────────
function wmapArtPeak(g, cx, by, w, h, rng, snow) {
  var lx = cx - w / 2, rx = cx + w / 2, ax = cx + (rng() - 0.5) * w * 0.16, ay = by - h, rd = cx + w * 0.04, i, gr;
  var left = [[lx, by], [lx + w * 0.10, by - h * 0.42], [ax - w * 0.09, ay + h * 0.24], [ax, ay], [ax + w * 0.02, by - h * 0.52], [rd, by + 3]];
  var right = [[ax, ay], [ax + w * 0.1, ay + h * 0.27], [rx - w * 0.1, by - h * 0.36], [rx, by], [rd, by + 3], [ax + w * 0.02, by - h * 0.52]];
  gr = g.createLinearGradient(0, ay, 0, by); gr.addColorStop(0, '#dcd1b8'); gr.addColorStop(1, '#a89c80');
  wmapArtFillStroke(g, left, gr, WMAP_PAL.ink, 3);
  gr = g.createLinearGradient(0, ay, 0, by); gr.addColorStop(0, '#a99d84'); gr.addColorStop(1, '#6c624e');
  wmapArtFillStroke(g, right, gr, WMAP_PAL.ink, 3);
  g.strokeStyle = 'rgba(40,30,20,.22)'; g.lineWidth = 2.5; g.lineCap = 'round';
  for (i = 1; i <= 3; i++) {   // 暗面岩層線
    g.beginPath(); g.moveTo(ax + w * 0.04, ay + h * (0.28 + i * 0.16)); g.lineTo(rx - w * (0.12 + i * 0.04), ay + h * (0.34 + i * 0.15)); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,240,.45)'; g.lineWidth = 3;   // 左緣高光
  g.beginPath(); g.moveTo(lx + w * 0.07, by - h * 0.2); g.lineTo(lx + w * 0.14, by - h * 0.46); g.lineTo(ax - w * 0.1, ay + h * 0.28); g.stroke();
  if (snow) {
    wmapArtFillStroke(g, [[ax, ay], [ax - w * 0.08, ay + h * 0.2], [ax - w * 0.03, ay + h * 0.17], [ax + w * 0.01, ay + h * 0.25], [ax + w * 0.05, ay + h * 0.17], [ax + w * 0.09, ay + h * 0.22]], '#f3f1ea', null);
    g.strokeStyle = WMAP_PAL.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(ax - w * 0.08, ay + h * 0.2); g.lineTo(ax, ay); g.lineTo(ax + w * 0.09, ay + h * 0.22); g.stroke();
  }
  g.fillStyle = '#5f9a3a';   // 山腳草叢
  g.beginPath(); g.ellipse(lx + w * 0.1, by + 1, w * 0.1, 7, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(rx - w * 0.08, by + 2, w * 0.09, 6, 0, 0, 7); g.fill();
}
function wmapArtMakeMountain(id) {
  var P = WMAP_PIECE[id], c = wmapArtCv(P.cw, P.ch), g = c.getContext('2d'), rng = wmapArtRng(wmapArtStr(id)), list = [], i, cell, cx, cy, big = id === 'M4';
  for (i = 0; i < P.cells.length; i++) {
    cell = P.cells[i];
    cx = (cell[1] - cell[0] + P.fh) * 128; cy = P.ch - (P.fw + P.fh) * 64 + (cell[1] + cell[0] + 1) * 64;
    list.push({ cx: cx, cy: cy, d: cell[0] + cell[1] });
    wmapArtShadow(g, cx + 8, cy + 6, 118, 50, 0.34);
  }
  list.sort(function (a, b) { return a.d - b.d; });
  for (i = 0; i < list.length; i++) {
    cell = list[i];
    wmapArtPeak(g, cell.cx + (rng() - 0.5) * 24, cell.cy + 14, 188 + rng() * 40, (id === 'M1' ? 168 : 150) + rng() * 40, rng, id === 'M1' ? rng() < 0.5 : rng() < 0.4);
  }
  if (big) wmapArtPeak(g, 256 + (rng() - 0.5) * 20, P.ch - 192 + 84, 250, 262, rng, true);
  return { c: c, cw: P.cw, ch: P.ch, fw: P.fw, fh: P.fh };
}
function wmapArtBoulder(g, cx, cy, r, rng) {
  var n = 9, pts = [], i, a, k, gr;
  for (i = 0; i < n; i++) { a = Math.PI * 2 * i / n + rng() * 0.2; k = r * (0.8 + rng() * 0.25); pts.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k * 0.82]); }
  gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gr.addColorStop(0, '#d2cab6'); gr.addColorStop(0.55, '#a39b88'); gr.addColorStop(1, '#6f6857');
  wmapArtFillStroke(g, pts, gr, WMAP_PAL.ink, 3);
  g.strokeStyle = 'rgba(255,255,240,.5)'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.arc(cx - r * 0.1, cy - r * 0.05, r * 0.62, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
  g.strokeStyle = 'rgba(40,30,20,.3)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx + r * 0.1, cy - r * 0.1); g.lineTo(cx + r * 0.3, cy + r * 0.15); g.stroke();
}
function wmapArtMakeRock() {
  var c = wmapArtCv(256, 192), g = c.getContext('2d'), rng = wmapArtRng(901);
  wmapArtShadow(g, 136, 136, 100, 42, 0.34);
  wmapArtBoulder(g, 88, 132, 36, rng); wmapArtBoulder(g, 176, 134, 34, rng); wmapArtBoulder(g, 128, 112, 54, rng);
  return { c: c, cw: 256, ch: 192, fw: 1, fh: 1 };
}
function wmapArtMakeTree() {
  var c = wmapArtCv(256, 288), g = c.getContext('2d'), rng = wmapArtRng(33), cr = [[104, 192, 40], [154, 196, 40], [128, 150, 50], [92, 142, 38], [166, 144, 36], [128, 100, 42]], i, gr, k;
  wmapArtShadow(g, 134, 232, 90, 36, 0.32);
  g.fillStyle = '#6b4a2b'; g.strokeStyle = WMAP_PAL.ink; g.lineWidth = 3; g.fillRect(118, 188, 22, 46); g.strokeRect(118, 188, 22, 46);
  for (i = 0; i < cr.length; i++) {
    k = cr[i]; gr = g.createRadialGradient(k[0] - k[2] * 0.35, k[1] - k[2] * 0.4, 2, k[0], k[1], k[2] * 1.1);
    gr.addColorStop(0, '#8fc65a'); gr.addColorStop(0.6, '#4f9a3c'); gr.addColorStop(1, '#2f6a2c');
    g.fillStyle = gr; g.beginPath(); g.arc(k[0], k[1], k[2], 0, Math.PI * 2); g.fill(); g.strokeStyle = '#25502a'; g.lineWidth = 2.5; g.stroke();
  }
  return { c: c, cw: 256, ch: 288, fw: 1, fh: 1 };
}

// ───────── 資源領地等級畫像:地面紋理 gt_*、散布物件 ro_*、里程碑 rm_*、等級旗 rf_*(設計_領地資源等級畫像.md 4.2;演算法在 wmap_res.js) ─────────
// 命名 = 未來 GPT 正式圖的代號:'gt_farm_a' 'gt_farm_b' 'gt_lumber' 'gt_quarry' 'gt_mine' 'gt_hunt'(512×512 可平鋪俯視紋理,1 張 = 世界 4×4 格);
//   'ro_<種類>_<款>_<1~5>'(S1~S5 散布物件);'rm_<種類>_A' / '_B'(里程碑 A:Lv5~9、B:Lv10);'rf_flax' 'rf_indigo' 'rf_gold'(旗)。
// 物件圖的 cw / ch / ax / ay 用「格寬 256」為單位(邏輯尺寸),實際畫布 2 倍取樣;ax, ay = 腳點。禁用朱紅(朱紅只留給我的領地框)。
var WMAP_GT = {   // 紋理色板:[底色, 暗, 亮, 點綴]
  farm_a: ['#7fb040', '#5b8f2a', '#a3cf5e', '#4f7f26', '#9a7a48'], farm_b: ['#e0c25a', '#c29a38', '#f1dc86', '#a87f28', '#9a7a48'],
  lumber: ['#5f8f3a', '#4a7a30', '#78a84a', '#7a5a35'], quarry: ['#bdb7a6', '#9b9484', '#d9d3c2', '#8a8474'],
  mine: ['#80604a', '#5e4535', '#9c7a5c', '#d08a3a'], hunt: ['#c9b27a', '#b09a63', '#dccb98', '#8fa050'],
  road: ['#d6bf88', '#b99d64', '#e8d7a6', '#9a7f4c']
};
function wmapArtCv2(w, h) { var c = wmapArtCv(w * 2, h * 2), g = c.getContext('2d'); g.scale(2, 2); return { c: c, g: g }; }
function wmapArtMakeGT(key) {
  var S = 512, c = wmapArtCv(S, S), g = c.getContext('2d'), rng = wmapArtRng(wmapArtStr(key)), id = key.slice(3), P = WMAP_GT[id], i, j, x, y, r, a;
  if (!P) return null;
  function tile(px, py, rad, fn) {   // 靠近邊緣的形狀,在對側也畫一份 → 四邊無縫
    var xs = [0], ys = [0], ix, iy;
    if (px - rad < 0) xs.push(S); if (px + rad > S) xs.push(-S);
    if (py - rad < 0) ys.push(S); if (py + rad > S) ys.push(-S);
    for (ix = 0; ix < xs.length; ix++) for (iy = 0; iy < ys.length; iy++) fn(px + xs[ix], py + ys[iy]);
  }
  g.fillStyle = P[0]; g.fillRect(0, 0, S, S);
  if (id === 'farm_a' || id === 'farm_b') {   // 田壟:沿 u(畫布水平)每 32 px 一條(512 整除)
    for (y = 0; y < S; y += 32) {   // 作物壟(明暗兩條)+ 一條裸土溝
      g.fillStyle = P[4]; g.fillRect(0, y + 24, S, 8);
      g.fillStyle = P[1]; g.fillRect(0, y + 3, S, 11);
      g.fillStyle = P[2]; g.fillRect(0, y + 14, S, 8);
    }
    for (i = 0; i < 260; i++) {   // 壟上作物小點
      x = rng() * S; y = ((rng() * 16) | 0) * 32 + 4 + rng() * 8;
      g.fillStyle = rng() < 0.5 ? P[3] : P[2]; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(x, y, 3 + rng() * 3, 2 + rng() * 2, 0, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    return { c: c, cw: S, ch: S, fw: 1, fh: 1 };
  }
  for (i = 0; i < 16; i++) {   // 大斑塊(明暗各半,柔邊)
    x = rng() * S; y = rng() * S; r = 40 + rng() * 50; a = i & 1 ? 0.2 : 0.18;
    tile(x, y, r, function (px, py) {
      var gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, (i & 1 ? P[2] : P[1]) + 'cc'); gr.addColorStop(1, (i & 1 ? P[2] : P[1]) + '00');
      g.globalAlpha = a * 2.2; g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2); g.globalAlpha = 1;
    });
  }
  for (i = 0; i < 520; i++) {   // 細點 / 筆觸
    x = rng() * S; y = rng() * S; r = 2 + rng() * 4;
    tile(x, y, r + 8, function (px, py) {
      g.globalAlpha = 0.3 + rng() * 0.3; g.fillStyle = rng() < 0.5 ? P[1] : P[2];
      if (id === 'lumber' || id === 'hunt') { g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(px - 2, py); g.lineTo(px - 3, py - 6); g.moveTo(px, py); g.lineTo(px, py - 8); g.moveTo(px + 2, py); g.lineTo(px + 3, py - 6); g.stroke(); }
      else { g.beginPath(); g.ellipse(px, py, r, r * 0.7, 0, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    });
  }
  for (i = 0; i < 70; i++) {   // 種類特有:落葉 / 碎石 / 礦粒 / 土塊
    x = rng() * S; y = rng() * S; r = 3 + rng() * 4;
    tile(x, y, r + 6, function (px, py) {
      if (id === 'lumber') { g.fillStyle = P[3]; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(px, py, r + 1, r * 0.55, rng() * 3, 0, 7); g.fill(); }
      else if (id === 'quarry') { g.fillStyle = P[2]; g.globalAlpha = 0.8; g.beginPath(); g.ellipse(px, py, r + 2, r, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(60,50,40,.28)'; g.beginPath(); g.ellipse(px + 1.5, py + 2, r + 1, r * 0.7, 0, 0, 7); g.fill(); }
      else if (id === 'mine') { g.fillStyle = rng() < 0.4 ? P[3] : P[1]; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(px, py, r * 0.7, r * 0.55, rng() * 3, 0, 7); g.fill(); }
      else { g.fillStyle = P[1]; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(px, py, r + 4, r * 0.8, 0, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    });
  }
  return { c: c, cw: S, ch: S, fw: 1, fh: 1 };
}

// ───────── 散布物件 ─────────
function wmapArtPine(g, cx, by, w, ink, rng) {
  var th = w * 0.2, i, n = 3, tw = w * 0.13, y = by - th, tw2, hh = w * 0.5, gr;
  g.fillStyle = '#6b4a2b'; g.fillRect(cx - tw / 2, by - th - 1, tw, th + 1); g.strokeStyle = ink; g.lineWidth = Math.max(1.5, w * 0.025); g.strokeRect(cx - tw / 2, by - th - 1, tw, th + 1);
  for (i = 0; i < n; i++) {
    tw2 = w * (0.98 - i * 0.22); y = by - th - hh * 0.55 * i;
    wmapArtFillStroke(g, [[cx - tw2 / 2, y], [cx, y - hh], [cx + tw2 / 2, y]], '#3f8a3c', ink, Math.max(1.5, w * 0.025));
    wmapArtFillStroke(g, [[cx, y - hh], [cx + tw2 / 2, y], [cx + tw2 * 0.08, y]], '#2e6d2f', null);
    g.strokeStyle = 'rgba(220,255,160,.45)'; g.lineWidth = Math.max(1.5, w * 0.03); g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - tw2 * 0.3, y - hh * 0.1); g.lineTo(cx - tw2 * 0.06, y - hh * 0.62); g.stroke();
  }
}
function wmapArtBroad(g, cx, by, w, ink) {
  var th = w * 0.28, tw = w * 0.14, k = [[0, -0.5, 0.3], [-0.26, -0.36, 0.26], [0.26, -0.36, 0.26], [-0.1, -0.78, 0.24], [0.14, -0.7, 0.22]], i, gr, rr, lw = Math.max(1.5, w * 0.025);
  g.fillStyle = '#6b4a2b'; g.fillRect(cx - tw / 2, by - th, tw, th + 1); g.strokeStyle = ink; g.lineWidth = lw; g.strokeRect(cx - tw / 2, by - th, tw, th + 1);
  for (i = 0; i < k.length; i++) {
    rr = k[i][2] * w; gr = g.createRadialGradient(cx + k[i][0] * w - rr * 0.35, by + k[i][1] * w - rr * 0.4, 1, cx + k[i][0] * w, by + k[i][1] * w, rr * 1.1);
    gr.addColorStop(0, '#9fd06a'); gr.addColorStop(0.6, '#55a040'); gr.addColorStop(1, '#2f6a2c');
    g.fillStyle = gr; g.beginPath(); g.arc(cx + k[i][0] * w, by + k[i][1] * w, rr, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#25502a'; g.lineWidth = lw; g.stroke();
  }
}
function wmapArtShrub(g, cx, by, w, ink, c1, c2) {
  var k = [[-0.24, -0.16, 0.26], [0.22, -0.18, 0.28], [0, -0.34, 0.28], [-0.1, -0.12, 0.24]], i, rr, gr, lw = Math.max(1.5, w * 0.03);
  for (i = 0; i < k.length; i++) {
    rr = k[i][2] * w; gr = g.createRadialGradient(cx + k[i][0] * w - rr * 0.3, by + k[i][1] * w - rr * 0.4, 1, cx + k[i][0] * w, by + k[i][1] * w, rr * 1.1);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx + k[i][0] * w, by + k[i][1] * w, rr, rr * 0.82, 0, 0, 7); g.fill(); g.strokeStyle = '#25502a'; g.lineWidth = lw; g.stroke();
  }
}
function wmapArtStalks(g, cx, by, w, n, h, body, ear, rng, ink, lw) {
  var i, x, tx, hh, sx;
  for (i = 0; i < n; i++) {
    x = cx + (i / Math.max(1, n - 1) - 0.5) * w * 0.8; hh = h * (0.75 + rng() * 0.3); tx = x + (rng() - 0.5) * w * 0.25; sx = tx - x;
    g.strokeStyle = ink; g.lineWidth = lw * 2.2; g.beginPath(); g.moveTo(x, by); g.quadraticCurveTo(x + sx * 0.2, by - hh * 0.6, tx, by - hh); g.stroke();
    g.strokeStyle = body; g.lineWidth = lw * 1.1; g.beginPath(); g.moveTo(x, by); g.quadraticCurveTo(x + sx * 0.2, by - hh * 0.6, tx, by - hh); g.stroke();
    if (ear) { g.fillStyle = ear; g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.ellipse(tx, by - hh - w * 0.04, w * 0.045, w * 0.1, sx * 0.01, 0, 7); g.fill(); g.stroke(); }
  }
}
function wmapArtShard(g, cx, by, w, h, l, r, ink, lw) {
  wmapArtFillStroke(g, [[cx - w / 2, by], [cx - w * 0.38, by - h * 0.62], [cx - w * 0.06, by - h], [cx + w * 0.02, by - h * 0.55], [cx + w * 0.02, by + 2]], l, ink, lw);
  wmapArtFillStroke(g, [[cx + w * 0.02, by + 2], [cx + w * 0.02, by - h * 0.55], [cx - w * 0.06, by - h], [cx + w * 0.34, by - h * 0.7], [cx + w / 2, by]], r, ink, lw);
}
function wmapArtCrystal(g, cx, by, w, h, ink, lw) {
  wmapArtFillStroke(g, [[cx - w / 2, by], [cx - w * 0.3, by - h * 0.7], [cx, by - h], [cx, by]], '#ffd24a', ink, lw);
  wmapArtFillStroke(g, [[cx, by], [cx, by - h], [cx + w * 0.3, by - h * 0.7], [cx + w / 2, by]], '#d9961a', ink, lw);
}
function wmapArtAnimal(g, cx, by, w, kd, ink, lw) {
  var s = w / 100, body, belly, i, j;
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (kd === 'rabbit') {
    g.fillStyle = '#d8cdb8'; g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.ellipse(cx - 6 * s, by - 20 * s, 26 * s, 18 * s, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(cx + 22 * s, by - 28 * s, 13 * s, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(cx + 20 * s, by - 50 * s, 4 * s, 12 * s, -0.2, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.ellipse(cx + 29 * s, by - 49 * s, 4 * s, 12 * s, 0.25, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 31 * s, by - 24 * s, 6 * s, 0, 7); g.fill(); g.stroke(); g.fillStyle = ink; g.beginPath(); g.arc(cx + 26 * s, by - 30 * s, 2 * s, 0, 7); g.fill();
    return;
  }
  body = kd === 'boar' ? '#6b5440' : '#b9854a'; belly = kd === 'boar' ? '#52402f' : '#d9b27a';
  [[-28, 24], [-14, 22], [16, 22], [30, 24]].forEach(function (a) {
    g.strokeStyle = ink; g.lineWidth = 7 * s + lw; g.beginPath(); g.moveTo(cx + a[0] * s, by - a[1] * s); g.lineTo(cx + a[0] * s, by - 1); g.stroke();
    g.strokeStyle = body; g.lineWidth = 7 * s; g.beginPath(); g.moveTo(cx + a[0] * s, by - a[1] * s); g.lineTo(cx + a[0] * s, by - 1); g.stroke();
  });
  g.fillStyle = body; g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.ellipse(cx, by - 38 * s, 42 * s, kd === 'boar' ? 25 * s : 20 * s, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = belly; g.beginPath(); g.ellipse(cx, by - 30 * s, 34 * s, 8 * s, 0, 0, Math.PI); g.fill();
  if (kd === 'boar') {
    g.fillStyle = body; g.beginPath(); g.ellipse(cx + 44 * s, by - 34 * s, 17 * s, 14 * s, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#d9c9a0'; g.beginPath(); g.moveTo(cx + 52 * s, by - 28 * s); g.lineTo(cx + 60 * s, by - 40 * s); g.lineTo(cx + 47 * s, by - 28 * s); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = ink; g.beginPath(); g.arc(cx + 44 * s, by - 40 * s, 2.5 * s, 0, 7); g.fill();
    g.strokeStyle = '#3d2f22'; g.lineWidth = 3 * s; for (i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx - 26 * s + i * 9 * s, by - 58 * s); g.lineTo(cx - 29 * s + i * 9 * s, by - 50 * s); g.stroke(); }
  } else {   // deer
    g.strokeStyle = ink; g.lineWidth = 10 * s + lw; g.beginPath(); g.moveTo(cx + 32 * s, by - 46 * s); g.lineTo(cx + 46 * s, by - 74 * s); g.stroke();
    g.strokeStyle = body; g.lineWidth = 10 * s; g.beginPath(); g.moveTo(cx + 32 * s, by - 46 * s); g.lineTo(cx + 46 * s, by - 74 * s); g.stroke();
    g.fillStyle = body; g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.ellipse(cx + 52 * s, by - 78 * s, 12 * s, 8 * s, -0.3, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = '#6b4a2b'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(cx + 48 * s, by - 84 * s); g.lineTo(cx + 44 * s, by - 106 * s); g.moveTo(cx + 46 * s, by - 96 * s); g.lineTo(cx + 36 * s, by - 102 * s); g.moveTo(cx + 52 * s, by - 84 * s); g.lineTo(cx + 58 * s, by - 106 * s); g.moveTo(cx + 54 * s, by - 96 * s); g.lineTo(cx + 64 * s, by - 100 * s); g.stroke();
    g.fillStyle = '#fff'; for (j = 0; j < 4; j++) { g.beginPath(); g.arc(cx - 20 * s + j * 14 * s, by - 44 * s + (j & 1) * 6 * s, 2.5 * s, 0, 7); g.fill(); }
  }
}
function wmapArtMakeRO(key) {   // 'ro_<種類>_<款>_<階>':只有自然物(樹 / 灌木 / 作物 / 草叢 / 岩石 / 礦石 / 野獸),沒有任何建築
  var p = key.split('_'), ty = p[1], kd = p[2], sz = (parseInt(p[3], 10) || 1) - 1, w = WMAP_RES_SIZE[sz], pad = 10, cw = w + pad * 2, ch = Math.round(w * 1.5) + pad * 2, o = wmapArtCv2(cw, ch), g = o.g, ink = WMAP_PAL.ink, rng = wmapArtRng(wmapArtStr(key)), cx = cw / 2, by = ch - pad, lw = Math.max(1.5, w * 0.03), i, n;
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (ty === 'lumber') {
    if (kd === 'broad') wmapArtBroad(g, cx, by, w, ink); else if (kd === 'pine') wmapArtPine(g, cx, by, w, ink, rng);
    else wmapArtShrub(g, cx, by, w, ink, '#8fc65a', '#3f7d3a');
  } else if (ty === 'quarry') {
    if (kd === 'rockb') {
      n = w > 90 ? 3 : (w > 50 ? 2 : 1);
      wmapArtShard(g, cx - (n > 1 ? w * 0.18 : 0), by, w * (n > 1 ? 0.6 : 0.9), w * 0.62, '#d8d1be', '#a39c8a', ink, lw);
      if (n > 1) wmapArtShard(g, cx + w * 0.22, by - 2, w * 0.5, w * 0.42, '#cfc8b4', '#9a937f', ink, lw);
      if (n > 2) wmapArtShard(g, cx - w * 0.02, by - w * 0.1, w * 0.36, w * 0.82, '#e2dbc8', '#aca593', ink, lw);
    } else {
      wmapArtBoulder(g, cx, by - w * 0.2, w * 0.4, rng);
      if (w > 40) wmapArtBoulder(g, cx + w * 0.3, by - w * 0.1, w * 0.2, rng);
      if (w > 90) wmapArtBoulder(g, cx - w * 0.32, by - w * 0.12, w * 0.22, rng);
    }
  } else if (ty === 'farm') {
    if (kd === 'sprout' || kd === 'sprout2') {
      for (i = -2; i <= 2; i++) { g.fillStyle = i & 1 ? '#8cc24a' : '#6fa83a'; g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.moveTo(cx + i * w * 0.14, by); g.quadraticCurveTo(cx + i * w * 0.2 - w * 0.08, by - w * 0.4, cx + i * w * 0.2, by - w * (0.55 - Math.abs(i) * 0.08)); g.quadraticCurveTo(cx + i * w * 0.2 + w * 0.1, by - w * 0.3, cx + i * w * 0.14 + w * 0.08, by); g.closePath(); g.fill(); g.stroke(); }
    } else if (kd === 'wheat') wmapArtStalks(g, cx, by, w, 6 + (w / 14 | 0), w * 0.85, '#c9a840', '#ecd060', rng, '#7a5a1c', lw);
    else if (kd === 'millet') wmapArtStalks(g, cx, by, w, 5 + (w / 18 | 0), w * 1.2, '#7ea03a', '#b9783a', rng, '#3f5a1c', lw);
    else wmapArtStalks(g, cx, by, w, 6 + (w / 16 | 0), w * 1.1, '#5f9a3a', '#7a4a22', rng, '#2f5a22', lw);   // reeds 水草(蒲棒)
  } else if (ty === 'mine') {
    if (kd === 'rubble') { wmapArtBoulder(g, cx - w * 0.2, by - w * 0.14, w * 0.2, rng); wmapArtBoulder(g, cx + w * 0.16, by - w * 0.12, w * 0.24, rng); }
    else if (kd === 'ore') { for (i = 0; i < 4; i++) wmapArtBoulder(g, cx + (i - 1.5) * w * 0.2, by - w * 0.12 - (i % 2) * w * 0.14, w * 0.18, rng); g.fillStyle = '#f2b830'; g.strokeStyle = ink; g.lineWidth = lw * 0.7; for (i = 0; i < 4; i++) { g.beginPath(); g.arc(cx - w * 0.25 + i * w * 0.17, by - w * 0.3 - (i & 1) * w * 0.08, w * 0.06, 0, 7); g.fill(); g.stroke(); } }
    else if (kd === 'vein') {
      wmapArtShard(g, cx - w * 0.14, by, w * 0.7, w * 0.62, '#8a6e58', '#5e4535', ink, lw); wmapArtShard(g, cx + w * 0.26, by - 2, w * 0.46, w * 0.42, '#7d6350', '#54402f', ink, lw);
      g.strokeStyle = '#f2b830'; g.lineWidth = Math.max(2, w * 0.05); g.beginPath(); g.moveTo(cx - w * 0.34, by - w * 0.1); g.lineTo(cx - w * 0.14, by - w * 0.36); g.lineTo(cx - w * 0.02, by - w * 0.2); g.lineTo(cx + w * 0.2, by - w * 0.3); g.stroke();
      if (w > 60) wmapArtCrystal(g, cx + w * 0.02, by - w * 0.04, w * 0.14, w * 0.26, ink, lw);
    } else {   // crystal 礦脈露頭:暗岩底 + 金色礦晶簇
      wmapArtShard(g, cx, by, w * 0.95, w * 0.5, '#7d6350', '#54402f', ink, lw);
      n = w > 90 ? 6 : 4;
      for (i = 0; i < n; i++) wmapArtCrystal(g, cx + (i - (n - 1) / 2) * w * 0.14, by - w * 0.08 - (i % 2) * w * 0.06, w * 0.14, w * (0.3 + (i % 3) * 0.1), ink, lw * 0.8);
    }
  } else if (ty === 'hunt') {
    if (kd === 'tuft' || kd === 'bush') {
      if (kd === 'bush') wmapArtShrub(g, cx, by, w, ink, '#b3c46a', '#6f8a3a');
      else { g.strokeStyle = '#4f7d38'; g.lineWidth = w * 0.07; for (i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * w * 0.1, by); g.quadraticCurveTo(cx + i * w * 0.14, by - w * 0.3, cx + i * w * 0.2, by - w * (0.55 - Math.abs(i) * 0.06)); g.stroke(); } g.strokeStyle = '#8fb050'; g.lineWidth = w * 0.04; for (i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * w * 0.12, by); g.quadraticCurveTo(cx + i * w * 0.16, by - w * 0.28, cx + i * w * 0.22, by - w * (0.42 - Math.abs(i) * 0.05)); g.stroke(); } }
    } else if (kd === 'track') {
      g.fillStyle = '#5e4a30'; g.globalAlpha = 0.8; for (i = 0; i < 4; i++) { g.beginPath(); g.ellipse(cx - w * 0.36 + i * w * 0.24, by - w * 0.1 - (i & 1) * w * 0.1, w * 0.07, w * 0.045, 0.3, 0, 7); g.fill(); g.beginPath(); g.arc(cx - w * 0.36 + i * w * 0.24 + w * 0.05, by - w * 0.15 - (i & 1) * w * 0.1, w * 0.025, 0, 7); g.fill(); } g.globalAlpha = 1;
    } else wmapArtAnimal(g, cx, by, w * 0.95, kd, ink, lw);
  } else return null;
  return { c: o.c, cw: cw, ch: ch, ax: cx, ay: by, fw: 1, fh: 1 };
}

// 軸向長方體(城池圖共用):u / v 範圍、底 z0 頂 z1;只畫看得到的左前(v1 面)、右前(u1 面)與頂面
function wmapArtBoxUV(g, pt, u0, u1, v0, v1, z0, z1, cl, cr, ct, ol) {   // 三面各自填色,輪廓合成一次 stroke(省光柵時間)
  var a = pt(u0, v1), b = pt(u1, v1), c = pt(u1, v0), d = pt(u0, v0), P1 = [[a[0], a[1] - z0], [b[0], b[1] - z0], [b[0], b[1] - z1], [a[0], a[1] - z1]], P2 = [[b[0], b[1] - z0], [c[0], c[1] - z0], [c[0], c[1] - z1], [b[0], b[1] - z1]], P3 = [[d[0], d[1] - z1], [c[0], c[1] - z1], [b[0], b[1] - z1], [a[0], a[1] - z1]];
  wmapArtPoly(g, P1); g.fillStyle = cl; g.fill(); wmapArtPoly(g, P2); g.fillStyle = cr; g.fill(); wmapArtPoly(g, P3); g.fillStyle = ct; g.fill();
  g.beginPath(); g.moveTo(P1[0][0], P1[0][1]); g.lineTo(P1[1][0], P1[1][1]); g.lineTo(P2[1][0], P2[1][1]); g.lineTo(P2[2][0], P2[2][1]); g.lineTo(P3[0][0], P3[0][1]); g.lineTo(P1[3][0], P1[3][1]); g.closePath();   // 外輪廓
  g.moveTo(P1[1][0], P1[1][1]); g.lineTo(P1[2][0], P1[2][1]); g.lineTo(P1[3][0], P1[3][1]); g.moveTo(P1[2][0], P1[2][1]); g.lineTo(P2[2][0], P2[2][1]);   // 中間稜線與頂面前緣
  g.strokeStyle = ol; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke();
}

// ───────── 城池圖(CITY COUNTY JUN PASS0 PASS1):向量按倍率 q 重畫(設計_地圖城池占地與美工_規格.md 第 3 節) ─────────
// 倍率 q = (s / 128) × min(dpr, 2)(低畫質 min(dpr, 1));畫布像素 = round(cw × q) × round(ch × q),直接在目標尺寸畫向量,不放大點陣。
// 同一時間只留一個倍率層(換 q 或換低畫質旗標就清掉整層);沒有 1× 原圖備份。畫法只用 fill / stroke / fillRect(雉堞),不用 setLineDash。
// 圖不超出占地菱形下緣(只往上長);陰影最多超出 0.15 格。座標 pt(u, v):u = c 方向(往右下)、v = r 方向(往左下),單位 = 一格,1 格 = 256 邏輯寬。
var WMAP_CITY_KEYS = { CITY: 1, COUNTY: 1, JUN: 1, PASS0: 1, PASS1: 1 };
var WMAP_CITY_LAYER = { q: 0, lo: false, m: {} };
var WMAP_CITY_INS = 0.12;   // 縣 / 郡 / 主城牆面離占地邊緣的內縮(格)
function wmapArtLowQ() {
  var w = typeof WMAP !== 'undefined' ? WMAP : null;
  if (w && w.lowQ) return true;
  return typeof navigator !== 'undefined' && !!navigator && navigator.deviceMemory > 0 && navigator.deviceMemory <= 2;
}
function wmapArtCityQ(s, dpr, lowQ) {   // 給 wmapArtGet(key, q) 用的倍率;s = 格大小(44 / 64 / 104)
  var d = dpr > 0 ? dpr : 1, cap = lowQ ? 1 : 2;
  return Math.round(s / 128 * Math.min(d, cap) * 1000) / 1000;
}
function wmapArtCityMem(q) {   // 五個鍵(關 2 款)同時存在的 RGBA 位元組數
  var ks = ['CITY', 'COUNTY', 'JUN', 'PASS0', 'PASS1'], i, P, n = 0;
  for (i = 0; i < ks.length; i++) { P = WMAP_PIECE[ks[i]]; n += Math.max(1, Math.round(P.cw * q)) * Math.max(1, Math.round(P.ch * q)) * 4; }
  return n;
}
function wmapArtCityScene(key, q, lo) {
  var P = WMAP_PIECE[key], pw = Math.max(1, Math.round(P.cw * q)), ph = Math.max(1, Math.round(P.ch * q)), c, g, S;
  if (typeof document === 'undefined' || !document || !document.createElement) return null;
  c = wmapArtCv(pw, ph); g = c.getContext ? c.getContext('2d') : null;
  if (!g) return null;
  g.setTransform(pw / P.cw, 0, 0, ph / P.ch, 0, 0);
  S = { c: c, g: g, P: P, fw: P.fw, fh: P.fh, lo: lo, ink: WMAP_PAL.ink, rng: wmapArtRng(wmapArtStr(key)), base: P.ch - (P.fw + P.fh) * 64 };
  S.pt = function (u, v) { return [(u - v + P.fh) * 128, S.base + (u + v) * 64]; };
  g.lineJoin = 'round';
  return S;
}
// 把「單位 = 一格」的方格 (u, v) 貼到畫面(地面平面;畫街道 / 地面色塊)
function wmapArtCGround(S) { S.g.transform(128, 64, -128, 64, S.fh * 128, S.base); }
function wmapArtCBox(S, u0, u1, v0, v1, z0, z1, pal) { wmapArtBoxUV(S.g, S.pt, u0, u1, v0, v1, z0, z1, pal[0], pal[1], pal[2], S.ink); }
function wmapArtCRoof(S, u0, u1, v0, v1, z, rh, rl, rr, ridge, ov) {   // 廡殿頂:底 u / v 範圍(外擴 ov)、底高 z、屋頂高 rh;ridge = 脊色(沒有就不畫)
  var g = S.g, pt = S.pt, o = ov === undefined ? 0.04 : ov, a0 = u0 - o, a1 = u1 + o, b0 = v0 - o, b1 = v1 + o, uw = a1 - a0, vw = b1 - b0, um = (a0 + a1) / 2, vm = (b0 + b1) / 2, ins, r1, r2, ea, eb, ec, f1, f2;
  function E(u, v) { var p = pt(u, v); return [p[0], p[1] - z]; }
  function H(u, v) { var p = pt(u, v); return [p[0], p[1] - z - rh]; }
  ea = E(a0, b1); eb = E(a1, b1); ec = E(a1, b0);
  if (uw >= vw) { ins = vw / 2; r1 = H(a0 + ins, vm); r2 = H(a1 - ins, vm); f1 = [ea, eb, r2, r1]; f2 = [eb, ec, r2]; }
  else { ins = uw / 2; r1 = H(um, b0 + ins); r2 = H(um, b1 - ins); f1 = [ea, eb, r2]; f2 = [eb, ec, r1, r2]; }
  wmapArtPoly(g, f1); g.fillStyle = rl; g.fill(); wmapArtPoly(g, f2); g.fillStyle = rr; g.fill();
  wmapArtPoly(g, f1); for (ins = 0; ins < f2.length; ins++) { if (ins) g.lineTo(f2[ins][0], f2[ins][1]); else g.moveTo(f2[0][0], f2[0][1]); } g.closePath(); g.strokeStyle = S.ink; g.lineWidth = 2.5; g.stroke();
  if (ridge) {
    g.strokeStyle = ridge; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(r1[0], r1[1]); g.lineTo(r2[0], r2[1]); g.stroke();
    if (Math.abs(r1[0] - r2[0]) < 1) { g.fillStyle = ridge; g.beginPath(); g.arc(r1[0], r1[1] - 2, 5, 0, 7); g.fill(); }
    g.lineCap = 'butt';
  }
}
function wmapArtCFlag(S, x, y, h, color, sz) {   // 旗:桿底 (x, y)、桿高 h;sz = 旗大小倍率
  var g = S.g, k = sz || 1, ty = y - h;
  g.strokeStyle = '#5a3d22'; g.lineWidth = 4 * Math.max(0.7, k); g.lineCap = 'butt'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, ty); g.stroke();
  wmapArtFillStroke(g, [[x, ty], [x + 46 * k, ty + 14 * k], [x + 34 * k, ty + 22 * k], [x + 46 * k, ty + 32 * k], [x, ty + 24 * k]], color, S.ink, 2);
}
function wmapArtCArch(S, face, fixed, c0, hw, ah, z0) {   // 城門洞:face 'u' = 貼在 u = fixed 的面(中心 v = c0)、'v' = 貼在 v = fixed 的面(中心 u = c0)
  var g = S.g, a, b;
  if (face === 'u') { a = S.pt(fixed, c0 + hw); b = S.pt(fixed, c0 - hw); } else { a = S.pt(c0 - hw, fixed); b = S.pt(c0 + hw, fixed); }
  g.beginPath(); g.moveTo(a[0], a[1] - z0); g.lineTo(a[0], a[1] - z0 - ah * 0.62);
  g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - z0 - ah * 1.38, b[0], b[1] - z0 - ah * 0.62);
  g.lineTo(b[0], b[1] - z0); g.closePath(); g.fillStyle = '#33261a'; g.fill(); g.strokeStyle = S.ink; g.lineWidth = 2; g.stroke();
}
function wmapArtCWall(S, ua, va, ub, vb, h, fill, mer, rows) {   // 牆面(一個平面):(ua, va) → (ub, vb)、高 h;mer = 雉堞色(fillRect 小方塊,低畫質不畫);rows = 條石紋道數
  var g = S.g, a = S.pt(ua, va), b = S.pt(ub, vb), i, n, len, t, x, y, dx = b[0] - a[0], dy = b[1] - a[1];
  wmapArtFillStroke(g, [a, b, [b[0], b[1] - h], [a[0], a[1] - h]], fill, S.ink, 2.5);
  if (rows) {
    g.strokeStyle = 'rgba(50,40,28,.3)'; g.lineWidth = 1.6; g.beginPath();
    for (i = 1; i <= rows; i++) { y = h * i / (rows + 1); g.moveTo(a[0], a[1] - y); g.lineTo(b[0], b[1] - y); }
    g.stroke();
  }
  if (mer && !S.lo) {
    len = Math.sqrt(dx * dx + dy * dy); n = Math.max(2, Math.round(len / 24));
    g.beginPath();
    for (i = 0; i < n; i++) { t = (i + 0.5) / n; g.rect(a[0] + dx * t - 7, a[1] + dy * t - h - 11, 14, 12); }
    g.fillStyle = mer; g.fill(); g.strokeStyle = S.ink; g.lineWidth = 2; g.stroke();
  }
}
function wmapArtCGateUV(S, side, ins) {   // 城門(牆面上)的 uv:side 0 = v−1 面(右上)、1 = u+1 面(右下)、2 = v+1 面(左下)、3 = u−1 面(左上);門在邊長 n 的第 floor((n−1)/2) 格正中
  var gu = Math.floor((S.fw - 1) / 2) + 0.5, gv = Math.floor((S.fh - 1) / 2) + 0.5;
  if (side === 0) return { u: gu, v: ins, face: 'v' };
  if (side === 1) return { u: S.fw - ins, v: gv, face: 'u' };
  if (side === 2) return { u: gu, v: S.fh - ins, face: 'v' };
  return { u: ins, v: gv, face: 'u' };
}
function wmapArtCTower(S, u, v, hw, z1, bodyPal, roofL, roofR, ridge, rh, tiers) {   // 角樓 / 哨樓:tiers 2 = 兩層(下層 + 腰檐 + 上層 + 屋頂)
  var h1 = tiers === 2 ? Math.round(z1 * 0.56) : z1, zt;
  wmapArtCBox(S, u - hw, u + hw, v - hw, v + hw, 0, h1, bodyPal);
  if (tiers === 2) {
    wmapArtCRoof(S, u - hw, u + hw, v - hw, v + hw, h1, 12, roofL, roofR, null, 0.045);
    zt = h1 + 8; wmapArtCBox(S, u - hw * 0.72, u + hw * 0.72, v - hw * 0.72, v + hw * 0.72, zt, z1, bodyPal);
    wmapArtCRoof(S, u - hw * 0.72, u + hw * 0.72, v - hw * 0.72, v + hw * 0.72, z1, rh, roofL, roofR, ridge, 0.05);
  } else wmapArtCRoof(S, u - hw, u + hw, v - hw, v + hw, z1, rh, roofL, roofR, ridge, 0.04);
}
function wmapArtCHouse(S, u, v, hw, hd, h, rh, wallPal, roofL, roofR, ridge) {
  wmapArtCBox(S, u - hw, u + hw, v - hd, v + hd, 0, h, wallPal);
  wmapArtCRoof(S, u - hw, u + hw, v - hd, v + hd, h, rh, roofL, roofR, ridge, 0.03);
}
function wmapArtCShadow(S, k) {   // 接觸陰影:占地菱形內接橢圓(k = 半徑比例)
  var P = S.P, hwid = (S.fw + S.fh) * 64, hh = (S.fw + S.fh) * 32;
  wmapArtShadow(S.g, hwid, S.base + hh, hwid * k, hh * k, 0.3);
}

// ── 主城 3×3:H 形格局不動;城門改在右前牆(u+1 面)正中、左後牆(u−1 面)加小門樓;朱紅屋頂 + 金脊 ──
function wmapArtDrawCity(S) {
  var g = S.g, pt = S.pt, ink = S.ink, ins = WMAP_CITY_INS, hh = 64, lo = S.lo, i, it, items = [], q, gu, GOLD = '#d9b44a', hallPal = ['#e4d6b6', '#b9a77f', '#d6c59f'], towPal = ['#d4c4a0', '#a99677', '#c9b891'], keepPal = ['#e0d1ae', '#b2a07a', '#d0c09b'];
  wmapArtCShadow(S, 0.76);
  wmapArtCWall(S, ins, ins, 3 - ins, ins, hh, '#bfae8a', '#d3c4a0');   // 後牆(看到內側面)
  wmapArtCWall(S, ins, ins, ins, 3 - ins, hh, '#cdbd9a', '#dccdac');
  wmapArtCTower(S, ins, ins, 0.12, 112, towPal, '#b4402a', '#8a2f1f', GOLD, 40, 1);   // 後角塔
  g.save(); wmapArtCGround(S);   // 庭院:水池 / 花園(H 形上下缺口)
  g.fillStyle = '#7fa2a0'; g.strokeStyle = ink; g.lineWidth = 0.03; g.beginPath(); g.ellipse(1.5, 0.5, 0.36, 0.3, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#58a5d4'; g.beginPath(); g.ellipse(1.5, 0.5, 0.28, 0.22, 0, 0, 7); g.fill();
  g.fillStyle = '#6f9f3c'; g.strokeStyle = ink; g.beginPath(); g.rect(1.18, 2.2, 0.64, 0.6); g.fill(); g.stroke();
  if (!lo) { g.fillStyle = '#e07a9a'; for (i = 0; i < 6; i++) { g.beginPath(); g.arc(1.3 + (i % 3) * 0.2, 2.4 + ((i / 3) | 0) * 0.25, 0.04, 0, 7); g.fill(); } }
  g.restore();
  for (i = 0; i < 3; i++) { items.push({ d: 0.55 + i + 0.5, t: 'h', u: 0.55, v: i + 0.5 }); items.push({ d: 2.45 + i + 0.5, t: 'h', u: 2.45, v: i + 0.5 }); }
  items.push({ d: 3.25, t: 'k' });
  items.push({ d: 1.65, t: 'g' });   // 左後牆小門樓
  items.sort(function (x, y) { return x.d - y.d; });
  for (i = 0; i < items.length; i++) {
    it = items[i];
    if (it.t === 'h') wmapArtCHouse(S, it.u, it.v, 0.156, 0.156, 46, 30, hallPal, '#b4553a', '#8e3d2a', GOLD);
    else if (it.t === 'k') {   // 中央兩層主樓 + 大旗(最高)
      wmapArtCBox(S, 1.625 - 0.328, 1.625 + 0.328, 1.625 - 0.328, 1.625 + 0.328, 0, 80, keepPal);
      wmapArtCBox(S, 1.625 - 0.227, 1.625 + 0.227, 1.625 - 0.227, 1.625 + 0.227, 80, 124, hallPal);
      wmapArtCRoof(S, 1.625 - 0.227, 1.625 + 0.227, 1.625 - 0.227, 1.625 + 0.227, 124, 56, '#c44a30', '#99351f', GOLD, 0.07);
      q = pt(1.625, 1.625); wmapArtCFlag(S, q[0], q[1] - 124 - 56 + 4, 76, '#c8321e', 1.2);
    } else {   // 左後牆(u−1 面)小門樓:門洞開在朝內的面
      wmapArtCBox(S, 0, 0.26, 1.5 - 0.2, 1.5 + 0.2, 0, hh + 18, towPal);
      wmapArtCRoof(S, 0, 0.26, 1.5 - 0.2, 1.5 + 0.2, hh + 18, 26, '#b4553a', '#8e3d2a', GOLD, 0.03);
      wmapArtCArch(S, 'u', 0.26, 1.5, 0.14, 46, 0);
    }
  }
  wmapArtCWall(S, ins, 3 - ins, 3 - ins, 3 - ins, hh, '#d8c8a2', '#e6d8b4');   // 前牆(外側面)
  wmapArtCWall(S, 3 - ins, 3 - ins, 3 - ins, ins, hh, '#a99677', '#b9a685');
  wmapArtCTower(S, ins, 3 - ins, 0.12, 112, towPal, '#b4402a', '#8a2f1f', GOLD, 40, 1);
  wmapArtCTower(S, 3 - ins, ins, 0.12, 112, towPal, '#b4402a', '#8a2f1f', GOLD, 40, 1);
  wmapArtCTower(S, 3 - ins, 3 - ins, 0.12, 112, towPal, '#b4402a', '#8a2f1f', GOLD, 40, 1);
  gu = 3.0;   // 右前牆(u+1 面)城門:門樓 + 門洞(道路從這一面進來)
  wmapArtCBox(S, 2.72, gu, 1.5 - 0.22, 1.5 + 0.22, 0, hh + 24, towPal);
  wmapArtCRoof(S, 2.72, gu, 1.5 - 0.22, 1.5 + 0.22, hh + 24, 30, '#c44a30', '#99351f', GOLD, 0.03);
  wmapArtCArch(S, 'u', gu, 1.5, 0.15, 52, 0);
}

// ── 縣城 3×3:低矮樸素;灰褐夯土牆(主城 55% 高)、青灰瓦、衙署 1 + 民居 7、四面小門無門樓、只有前角 1 座矮哨樓、土黃小旗 ──
function wmapArtDrawCounty(S) {
  var g = S.g, ins = WMAP_CITY_INS, wh = 34, i, items = [], it, s, o, hp = ['#e1d6b8', '#b9ab88', '#d0c4a2'], rl = '#6f7f86', rr = '#56646b', houses, sd;
  wmapArtCShadow(S, 0.76);
  wmapArtCWall(S, ins, ins, 3 - ins, ins, wh, '#a99b7e');   // 後牆(內側面,略暗)
  wmapArtCWall(S, ins, ins, ins, 3 - ins, wh, '#8f8268');
  g.save(); wmapArtCGround(S); g.fillStyle = 'rgba(120,100,60,.28)';   // 十字街
  g.fillRect(ins + 0.05, 1.5 - 0.1, 3 - 2 * ins - 0.1, 0.2); g.fillRect(1.5 - 0.1, ins + 0.05, 0.2, 3 - 2 * ins - 0.1); g.restore();
  for (i = 0; i < 4; i++) { sd = [0, 1, 2, 3][i]; o = wmapArtCGateUV(S, sd, ins); if (sd === 0 || sd === 3) wmapArtCArch(S, o.face, o.face === 'u' ? o.u : o.v, o.face === 'u' ? o.v : o.u, 0.13, 28, 0); }
  houses = [[0.5, 0.55], [1.05, 0.45], [1.0, 1.0], [2.0, 0.6], [2.5, 1.05], [0.55, 2.05], [0.95, 2.5]];
  for (i = 0; i < houses.length; i++) {
    if (S.lo && (i & 1)) continue;
    s = S.rng(); items.push({ d: houses[i][0] + houses[i][1], t: 'h', u: houses[i][0], v: houses[i][1], hw: 0.13 + s * 0.03, h: 16 + (s * 8 | 0) });
  }
  items.push({ d: 4.0, t: 'o' });
  items.sort(function (x, y) { return x.d - y.d; });
  for (i = 0; i < items.length; i++) {
    it = items[i];
    if (it.t === 'h') wmapArtCHouse(S, it.u, it.v, it.hw, 0.12, it.h, 16, hp, rl, rr, null);
    else {   // 衙署:稍大 + 土黃小旗
      wmapArtCBox(S, 2.0 - 0.3, 2.0 + 0.3, 2.0 - 0.24, 2.0 + 0.24, 0, 34, ['#e0d1ae', '#b2a07a', '#d0c09b']);
      wmapArtCRoof(S, 2.0 - 0.3, 2.0 + 0.3, 2.0 - 0.24, 2.0 + 0.24, 34, 30, rl, rr, null, 0.05);
      o = S.pt(2.0, 2.0); wmapArtCFlag(S, o[0], o[1] - 34 - 30 + 4, 40, '#d9b44a', 0.8);
    }
  }
  wmapArtCWall(S, ins, 3 - ins, 3 - ins, 3 - ins, wh, '#b9ab8e');   // 前牆(外側面)
  wmapArtCWall(S, 3 - ins, 3 - ins, 3 - ins, ins, wh, '#8f8268');
  for (i = 1; i <= 2; i++) { o = wmapArtCGateUV(S, i, ins); wmapArtCArch(S, o.face, o.face === 'u' ? o.u : o.v, o.face === 'u' ? o.v : o.u, 0.13, 28, 0); }
  wmapArtCTower(S, 3 - ins, 3 - ins, 0.1, 58, ['#c4b79a', '#9a8d72', '#b6a98c'], rl, rr, null, 22, 1);   // 前角矮哨樓
}

// ── 郡城 4×4:大而氣派;青磚灰高牆(主城 90%)+ 明顯雉堞、黛藍琉璃瓦配金脊、四角兩層角樓、正面兩座重簷城樓、郡府大殿 + 民居 12 + 市街攤棚 + 市集旗 ──
function wmapArtDrawJun(S) {
  var g = S.g, pt = S.pt, ins = WMAP_CITY_INS, wh = 56, i, items = [], it, s, o, GOLD = '#d9b44a', wp = ['#a3a8a6', '#7c827f', '#b4b9b6'], hp = ['#e1d6b8', '#b9ab88', '#d0c09b'], rl = '#3f5d7a', rr = '#2f4a63', hs, stalls, cols = ['#4f8fb0', '#d9b44a', '#e8e0c8', '#6a9a58', '#8a6aa8'], F = 4 - ins, pal;
  wmapArtCShadow(S, 0.74);
  wmapArtCWall(S, ins, ins, F, ins, wh, '#8f9593', '#b4bab7', 1);   // 後牆(內側面)
  wmapArtCWall(S, ins, ins, ins, F, wh, '#7c827f', '#a3a8a6', 1);
  wmapArtCTower(S, ins, ins, 0.15, 132, wp, rl, rr, GOLD, 36, 2);   // 後角樓
  g.save(); wmapArtCGround(S); g.fillStyle = 'rgba(110,100,70,.30)';   // 十字市街
  g.fillRect(ins + 0.05, 1.5 - 0.17, 4 - 2 * ins - 0.1, 0.34); g.fillRect(1.5 - 0.17, ins + 0.05, 0.34, 4 - 2 * ins - 0.1); g.restore();
  for (i = 0; i < 2; i++) { o = wmapArtCGateUV(S, i === 0 ? 0 : 3, ins); wmapArtCArch(S, o.face, o.face === 'u' ? o.u : o.v, o.face === 'u' ? o.v : o.u, 0.17, 42, 0); }
  hs = [[0.55, 0.55], [1.05, 0.45], [0.5, 1.05], [2.0, 0.5], [2.6, 0.55], [3.2, 0.6], [2.3, 1.05], [0.5, 2.0], [0.55, 2.6], [1.0, 3.2], [3.3, 2.0], [2.0, 3.3]];
  for (i = 0; i < hs.length; i++) {
    if (S.lo && (i & 1)) continue;
    s = S.rng(); items.push({ d: hs[i][0] + hs[i][1], t: 'h', u: hs[i][0], v: hs[i][1], hw: 0.13 + s * 0.04, hd: 0.11 + s * 0.03, h: 16 + (s * 10 | 0), c: s > 0.5 });
  }
  items.push({ d: 5.4, t: 'f' });
  if (!S.lo) {   // 攤棚:色塊小棚,沿兩條街
    stalls = [[0.8, 1.26], [2.1, 1.26], [2.5, 1.74], [1.26, 0.85], [1.74, 2.1], [1.26, 3.1]];
    for (i = 0; i < stalls.length; i++) items.push({ d: stalls[i][0] + stalls[i][1], t: 's', u: stalls[i][0], v: stalls[i][1], c: cols[i % cols.length] });
    items.push({ d: 3.0, t: 'm', u: 1.34, v: 1.34, c: '#d9b44a' }); items.push({ d: 3.4, t: 'm', u: 1.7, v: 1.66, c: '#4f8fb0' });
  }
  items.sort(function (x, y) { return x.d - y.d; });
  for (i = 0; i < items.length; i++) {
    it = items[i];
    if (it.t === 'h') wmapArtCHouse(S, it.u, it.v, it.hw, it.hd, it.h, 17, hp, it.c ? rl : '#4d6c88', it.c ? rr : '#3a566f', null);
    else if (it.t === 's') { pal = ['#d8cfb4', '#a89e84', it.c]; wmapArtCBox(S, it.u - 0.09, it.u + 0.09, it.v - 0.07, it.v + 0.07, 0, 14, pal); }
    else if (it.t === 'm') { o = pt(it.u, it.v); wmapArtCFlag(S, o[0], o[1], 44, it.c, 0.6); }
    else {   // 郡府大殿:兩層、黛藍瓦 + 金脊
      wmapArtCBox(S, 2.75 - 0.5, 2.75 + 0.5, 2.75 - 0.4, 2.75 + 0.4, 0, 52, hp);
      wmapArtCRoof(S, 2.75 - 0.5, 2.75 + 0.5, 2.75 - 0.4, 2.75 + 0.4, 52, 20, rl, rr, null, 0.06);
      wmapArtCBox(S, 2.75 - 0.32, 2.75 + 0.32, 2.75 - 0.26, 2.75 + 0.26, 58, 90, hp);
      wmapArtCRoof(S, 2.75 - 0.32, 2.75 + 0.32, 2.75 - 0.26, 2.75 + 0.26, 90, 40, rl, rr, GOLD, 0.06);
    }
  }
  wmapArtCWall(S, ins, 4 - ins, F, 4 - ins, wh, '#a3a8a6', '#c0c5c2', 1);   // 前牆(外側面)
  wmapArtCWall(S, F, 4 - ins, F, ins, wh, '#7c827f', '#989e9b', 1);
  wmapArtCTower(S, ins, 4 - ins, 0.15, 132, wp, rl, rr, GOLD, 36, 2);
  wmapArtCTower(S, F, ins, 0.15, 132, wp, rl, rr, GOLD, 36, 2);
  wmapArtCTower(S, F, 4 - ins, 0.15, 132, wp, rl, rr, GOLD, 36, 2);
  // 正面兩座重簷城樓(u+1 面、v+1 面)
  for (i = 1; i <= 2; i++) {
    o = wmapArtCGateUV(S, i, ins); s = i === 1;   // s:u 面
    if (s) { wmapArtCBox(S, 4 - 0.38, 4, 1.5 - 0.42, 1.5 + 0.42, 0, 70, wp); wmapArtCRoof(S, 4 - 0.38, 4, 1.5 - 0.42, 1.5 + 0.42, 70, 18, rl, rr, GOLD, 0.05); }
    else { wmapArtCBox(S, 1.5 - 0.42, 1.5 + 0.42, 4 - 0.38, 4, 0, 70, wp); wmapArtCRoof(S, 1.5 - 0.42, 1.5 + 0.42, 4 - 0.38, 4, 70, 18, rl, rr, GOLD, 0.05); }
    q2(S, s);
  }
  function q2(Sx, isU) {
    var uc = isU ? 4 - 0.19 : 1.5, vc = isU ? 1.5 : 4 - 0.19, p;
    wmapArtCBox(Sx, uc - 0.14, uc + 0.14, vc - 0.14, vc + 0.14, 76, 106, hp);
    wmapArtCRoof(Sx, uc - 0.14, uc + 0.14, vc - 0.14, vc + 0.14, 106, 34, rl, rr, GOLD, 0.06);
    p = Sx.pt(uc, vc); wmapArtCFlag(Sx, p[0], p[1] - 106 - 34 + 4, 58, '#d9b44a', 1.1);
    if (isU) wmapArtCArch(Sx, 'u', 4, 1.5, 0.17, 52, 0); else wmapArtCArch(Sx, 'v', 4, 1.5, 0.17, 52, 0);
  }
}

// ── 關:兩側山壁(不可走)+ 中間 2 格門道(路)上的黑瓦石砌門樓;PASS0 = 路沿 u(c)走、PASS1 = 沿 v(r)走 ──
function wmapArtDrawPass(S, axis) {
  var g = S.g, pt = S.pt, i, p, GOLD = null, sp = ['#a69d8a', '#6b6355', '#b3aa97'], rl = '#4a4d52', rr = '#33363a', rng = S.rng;
  function at(s, t) { return axis ? pt(t, s) : pt(s, t); }
  function box(s0, s1, t0, t1, z0, z1, pal) { if (axis) wmapArtCBox(S, t0, t1, s0, s1, z0, z1, pal); else wmapArtCBox(S, s0, s1, t0, t1, z0, z1, pal); }
  function roof(s0, s1, t0, t1, z, rh, ov) { if (axis) wmapArtCRoof(S, t0, t1, s0, s1, z, rh, rl, rr, GOLD, ov); else wmapArtCRoof(S, s0, s1, t0, t1, z, rh, rl, rr, GOLD, ov); }
  function course(s0, s1, t0, t1, hgt, n) {   // 條石紋:畫在這個方塊兩個看得見的面
    var a, b, c, k, y;
    g.strokeStyle = 'rgba(40,32,22,.34)'; g.lineWidth = 1.6; g.beginPath();
    a = axis ? pt(t0, s1) : pt(s0, t1); b = axis ? pt(t1, s1) : pt(s1, t1); c = axis ? pt(t1, s0) : pt(s1, t0);
    for (k = 1; k <= n; k++) { y = hgt * k / (n + 1); g.moveTo(a[0], a[1] - y); g.lineTo(b[0], b[1] - y); g.lineTo(c[0], c[1] - y); }
    g.stroke();
  }
  wmapArtCShadow(S, 0.72);
  p = at(0.5, 0.55); wmapArtPeak(g, p[0], p[1] + 8, 176, 236, rng, true);   // 後側山壁(2 峰)
  p = at(1.5, 0.5); wmapArtPeak(g, p[0], p[1] + 8, 190, 212, rng, false);
  box(0.7, 1.3, 0.5, 0.96, 0, 38, sp); box(0.7, 1.3, 2.04, 2.5, 0, 38, sp);   // 兩翼石牆接進山壁
  course(0.7, 1.3, 0.5, 0.96, 38, 2); course(0.7, 1.3, 2.04, 2.5, 38, 2);
  box(0.52, 1.48, 0.96, 2.04, 0, 72, sp); course(0.52, 1.48, 0.96, 2.04, 72, 3);   // 門樓主體(跨在門道上)
  if (axis) wmapArtCArch(S, 'v', 1.48, 1.5, 0.27, 52, 0); else wmapArtCArch(S, 'u', 1.48, 1.5, 0.27, 52, 0);   // 門洞開在朝 +s 的面
  box(0.66, 1.34, 1.1, 1.9, 72, 100, sp); roof(0.66, 1.34, 1.1, 1.9, 100, 36, 0.07);
  p = at(1.0, 1.5); wmapArtCFlag(S, p[0], p[1] - 100 - 36 + 3, 56, '#d9b44a', 1.0);
  p = at(0.45, 2.65); wmapArtPeak(g, p[0], p[1] + 4, 130, 120, rng, false);   // 前側山壁
  p = at(1.55, 2.62); wmapArtPeak(g, p[0], p[1] + 4, 140, 140, rng, true);
}

// ── 小旗:攻下後加畫在該城主城門(朱紅 = 我的);腳點 (ax, ay) ──
function wmapArtMakeFlagMe() {
  var o = wmapArtCv2(64, 96), g = o.g, ink = WMAP_PAL.ink;
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = '#5a3d22'; g.lineWidth = 4; g.beginPath(); g.moveTo(14, 92); g.lineTo(14, 8); g.stroke();
  wmapArtFillStroke(g, [[14, 8], [58, 22], [46, 32], [58, 44], [14, 40]], '#c8321e', ink, 2.5);
  g.fillStyle = '#d9b44a'; g.beginPath(); g.arc(14, 7, 4, 0, 7); g.fill();
  return { c: o.c, cw: 64, ch: 96, ax: 14, ay: 92, fw: 1, fh: 1 };
}

function wmapArtCityDraw(key, q, lo) {
  var S = wmapArtCityScene(key, q, lo), P = WMAP_PIECE[key];
  if (!S) return null;
  if (key === 'CITY') wmapArtDrawCity(S); else if (key === 'COUNTY') wmapArtDrawCounty(S); else if (key === 'JUN') wmapArtDrawJun(S); else wmapArtDrawPass(S, key === 'PASS1' ? 1 : 0);
  return { c: S.c, cw: P.cw, ch: P.ch, fw: P.fw, fh: P.fh, q: q, pw: S.c.width, ph: S.c.height };
}
function wmapArtCityGet(key, q) {
  var qq = q > 0 ? Math.round(Math.min(4, Math.max(0.1, q)) * 1000) / 1000 : 1, lo = wmapArtLowQ(), L = WMAP_CITY_LAYER, a;
  if (Math.abs(L.q - qq) > 0.0005 || L.lo !== lo) { L.q = qq; L.lo = lo; L.m = {}; }
  a = L.m[key];
  if (a !== undefined) return a;
  try { a = wmapArtCityDraw(key, qq, lo); } catch (e) { a = null; if (typeof console !== 'undefined') console.warn('wmapArtCityDraw ' + key + ' 失敗', e); }
  L.m[key] = a;
  return a;
}
// 主城門 / 城門上方的位置(圖內邏輯座標,給 FLAG_ME 小旗腳點用):CITY 一律 side 1;縣 / 郡 side 0~3(= node.gates[node.mg].side);關忽略 side(門樓頂)
function wmapArtCityGateAnchor(key, side) {
  var P = WMAP_PIECE[key], S, ins = WMAP_CITY_INS, o, p, z;
  if (!P || !WMAP_CITY_KEYS[key]) return null;
  S = { fw: P.fw, fh: P.fh, base: P.ch - (P.fw + P.fh) * 64 };
  S.pt = function (u, v) { return [(u - v + P.fh) * 128, S.base + (u + v) * 64]; };
  if (key === 'PASS0' || key === 'PASS1') { p = key === 'PASS1' ? S.pt(1.5, 1.0) : S.pt(1.0, 1.5); return { x: p[0], y: p[1] - 76 }; }
  o = wmapArtCGateUV(S, key === 'CITY' ? 1 : side, ins); p = S.pt(o.u, o.v);
  z = key === 'CITY' ? 90 : (key === 'COUNTY' ? 34 : (side === 1 || side === 2 ? 72 : 56));
  return { x: p[0], y: p[1] - z };
}

// ───────── 登錄表 ─────────
function wmapArtGet(key, q) {
  var a;
  if (WMAP_CITY_KEYS[key] === 1) return wmapArtCityGet(key, q);   // 城池 5 鍵:按倍率 q 重畫向量(q 省略 = 1),只留一個倍率層
  a = wmapArtCache[key];
  if (a !== undefined) return a;
  a = null;
  if (key.indexOf('g_') === 0) a = wmapArtMakeGround(key);
  else if (key.indexOf('mask_') === 0) a = wmapArtMakeMask(key);
  else if (/^M[1-4][a-z]?$/.test(key)) a = wmapArtMakeMountain(key);
  else if (key === 'O1') a = wmapArtMakeRock();
  else if (key === 'T1') a = wmapArtMakeTree();
  else if (key === 'FLAG_ME') a = wmapArtMakeFlagMe();
  else if (key.indexOf('gt_') === 0) a = wmapArtMakeGT(key);
  else if (key.indexOf('ro_') === 0) a = wmapArtMakeRO(key);
  wmapArtCache[key] = a;
  return a;
}
function wmapArtClear() { wmapArtCache = {}; WMAP_CITY_LAYER.q = 0; WMAP_CITY_LAYER.m = {}; }
