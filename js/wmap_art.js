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
//   'COUNTY' 縣城、'PASS0' / 'PASS1' 關口(1×1 單格建築圖,PASSn = 道路沿 u / v 走的兩款);'gt_road' = 土道路紋理(路面用,世界錨定平鋪)
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
  COUNTY: { fw: 1, fh: 1, cw: 256, ch: 256, cells: [[0, 0]] },   // 縣城(單格小城鎮)
  PASS0: { fw: 1, fh: 1, cw: 256, ch: 320, cells: [[0, 0]] },    // 關口:路沿 u(c 方向)走
  PASS1: { fw: 1, fh: 1, cw: 256, ch: 320, cells: [[0, 0]] },    // 關口:路沿 v(r 方向)走
  CITY: { fw: 3, fh: 3, cw: 768, ch: 680, cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] }
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

// ───────── 主城 3×3(城牆圈 + 四角塔 + 中央城樓 + 民居) ─────────
function wmapArtMakeCity() {
  var P = WMAP_PIECE.CITY, c = wmapArtCv(P.cw, P.ch), g = c.getContext('2d'), ink = WMAP_PAL.ink;
  function pt(u, v) { return [(u - v + 3) * 128, P.ch - 384 + (u + v) * 64]; }
  function wall(a, b, h, fill, topFill) {   // 牆段:a → b(畫面點),高 h
    wmapArtFillStroke(g, [a, b, [b[0], b[1] - h], [a[0], a[1] - h]], fill, ink, 2.5);
    g.strokeStyle = topFill; g.lineWidth = 7; g.setLineDash([9, 7]); g.beginPath(); g.moveTo(a[0], a[1] - h - 2); g.lineTo(b[0], b[1] - h - 2); g.stroke(); g.setLineDash([]);
  }
  var A = pt(0.14, 0.14), B = pt(2.86, 0.14), C = pt(2.86, 2.86), D = pt(0.14, 2.86), i, q, hh = 62, mid;
  wmapArtShadow(g, 384, P.ch - 192, 330, 150, 0.3);
  wall(A, B, hh, '#bfae8a', '#8f7d58'); wall(A, D, hh, '#cdbd9a', '#8f7d58');   // 後牆(看到內側面)
  // 內部(H 形 7 格:左右兩直排各 3 格建築 + 正中央城樓;上下兩個缺口 = 庭院:水池 / 花園)
  g.save(); g.transform(128, 64, -128, 64, 384, P.ch - 384);   // 單位 = 一格(u 往右下、v 往左下)
  g.fillStyle = '#7fa2a0'; g.strokeStyle = ink; g.lineWidth = 0.03; g.beginPath(); g.ellipse(1.5, 0.5, 0.36, 0.3, 0, 0, 7); g.fill(); g.stroke();   // 庭院一:水池
  g.fillStyle = '#58a5d4'; g.beginPath(); g.ellipse(1.5, 0.5, 0.28, 0.22, 0, 0, 7); g.fill();
  g.fillStyle = '#6f9f3c'; g.strokeStyle = ink; g.beginPath(); g.rect(1.18, 2.2, 0.64, 0.6); g.fill(); g.stroke();   // 庭院二:花園
  g.fillStyle = '#e07a9a'; for (i = 0; i < 6; i++) { g.beginPath(); g.arc(1.3 + (i % 3) * 0.2, 2.4 + ((i / 3) | 0) * 0.25, 0.04, 0, 7); g.fill(); }
  g.restore();
  var items = [], it;
  for (i = 0; i < 3; i++) { items.push({ u: 0.55, v: i + 0.5, t: 'hall' }); items.push({ u: 2.45, v: i + 0.5, t: 'hall' }); }
  items.push({ u: 1.5, v: 1.5, t: 'keep' });
  items.sort(function (x, y) { return (x.u + x.v) - (y.u + y.v); });
  for (i = 0; i < items.length; i++) {
    it = items[i]; q = pt(it.u + 0.5 - 0.5 + 0, it.v + 0.0 + 0.0);
    if (it.t === 'hall') {
      q = pt(it.u, it.v);
      wmapArtIsoBox(g, q[0], q[1], 40, 20, 46, '#e4d6b6', '#b9a77f', '#d6c59f', ink);
      wmapArtRoof(g, q[0], q[1] - 46, 46, 23, 30, '#b4553a', '#8e3d2a', ink);
    } else {
      q = pt(1.5, 1.5);
      wmapArtIsoBox(g, q[0], q[1] + 16, 84, 42, 80, '#e0d1ae', '#b2a07a', '#d0c09b', ink);
      wmapArtIsoBox(g, q[0], q[1] - 64, 58, 29, 44, '#e6d9b8', '#b9a77f', '#d8c8a2', ink);
      wmapArtRoof(g, q[0], q[1] - 108, 76, 38, 52, '#c44a30', '#99351f', ink);
      g.strokeStyle = '#5a3d22'; g.lineWidth = 4; g.beginPath(); g.moveTo(q[0], q[1] - 160); g.lineTo(q[0], q[1] - 214); g.stroke();
      wmapArtFillStroke(g, [[q[0], q[1] - 214], [q[0] + 46, q[1] - 200], [q[0] + 34, q[1] - 192], [q[0] + 46, q[1] - 182], [q[0], q[1] - 190]], '#c8321e', ink, 2);
    }
  }
  wall(D, C, hh, '#d8c8a2', '#8f7d58'); wall(C, B, hh, '#a99677', '#7d6b4a');   // 前牆(外側面)
  mid = [(D[0] + C[0]) / 2, (D[1] + C[1]) / 2];   // 城門(左前牆正中)
  wmapArtFillStroke(g, [[mid[0] - 22, mid[1] + 11], [mid[0] - 22, mid[1] - 26], [mid[0] + 22, mid[1] - 48], [mid[0] + 22, mid[1] - 11]], '#3a2a1c', ink, 2.5);
  var corners = [A, B, C, D];
  for (i = 0; i < 4; i++) {   // 四角塔
    q = corners[i];
    wmapArtIsoBox(g, q[0], q[1], 30, 15, 98, '#d4c4a0', '#a99677', '#c9b891', ink);
    wmapArtRoof(g, q[0], q[1] - 98, 38, 19, 40, '#b4402a', '#8a2f1f', ink);
  }
  return { c: c, cw: P.cw, ch: P.ch, fw: 3, fh: 3 };
}

// ───────── 縣城 / 關口(1×1 單格建築圖;風格同主城、小得多;烘焙時每個只 drawImage 一次) ─────────
function wmapArtBoxUV(g, pt, u0, u1, v0, v1, z0, z1, cl, cr, ct, ol) {   // 軸向長方體:u / v 範圍、底 z0 頂 z1;只畫看得到的左前(v1 面)、右前(u1 面)與頂面
  var a = pt(u0, v1), b = pt(u1, v1), c = pt(u1, v0), d = pt(u0, v0);
  wmapArtFillStroke(g, [[a[0], a[1] - z0], [b[0], b[1] - z0], [b[0], b[1] - z1], [a[0], a[1] - z1]], cl, ol, 2.5);
  wmapArtFillStroke(g, [[b[0], b[1] - z0], [c[0], c[1] - z0], [c[0], c[1] - z1], [b[0], b[1] - z1]], cr, ol, 2.5);
  wmapArtFillStroke(g, [[d[0], d[1] - z1], [c[0], c[1] - z1], [b[0], b[1] - z1], [a[0], a[1] - z1]], ct, ol, 2.5);
}
function wmapArtMakeCounty() {
  var P = WMAP_PIECE.COUNTY, c = wmapArtCv(P.cw, P.ch), g = c.getContext('2d'), ink = WMAP_PAL.ink, i, q, it, items = [], mid, wh = 24, corners;
  function pt(u, v) { return [(u - v + 1) * 128, P.ch - 128 + (u + v) * 64]; }
  function wall(a, b, h, fill, topFill) {
    wmapArtFillStroke(g, [a, b, [b[0], b[1] - h], [a[0], a[1] - h]], fill, ink, 2.5);
    g.strokeStyle = topFill; g.lineWidth = 5; g.setLineDash([7, 5]); g.beginPath(); g.moveTo(a[0], a[1] - h - 1.5); g.lineTo(b[0], b[1] - h - 1.5); g.stroke(); g.setLineDash([]);
  }
  var A = pt(0.12, 0.12), B = pt(0.88, 0.12), C = pt(0.88, 0.88), D = pt(0.12, 0.88);
  wmapArtShadow(g, 128, P.ch - 60, 120, 52, 0.3);
  wall(A, B, wh, '#bfae8a', '#8f7d58'); wall(A, D, wh, '#cdbd9a', '#8f7d58');   // 後牆(看到內側面)
  items.push({ u: 0.3, v: 0.3, t: 'h' }, { u: 0.7, v: 0.3, t: 'h' }, { u: 0.3, v: 0.7, t: 'h' }, { u: 0.7, v: 0.7, t: 'h' }, { u: 0.5, v: 0.5, t: 'k' });
  items.sort(function (x, y) { return (x.u + x.v) - (y.u + y.v); });
  for (i = 0; i < items.length; i++) {
    it = items[i]; q = pt(it.u, it.v);
    if (it.t === 'h') { wmapArtIsoBox(g, q[0], q[1], 22, 11, 18, '#e4d6b6', '#b9a77f', '#d6c59f', ink); wmapArtRoof(g, q[0], q[1] - 18, 26, 13, 20, '#b4553a', '#8e3d2a', ink); }
    else { wmapArtIsoBox(g, q[0], q[1], 28, 14, 30, '#e0d1ae', '#b2a07a', '#d0c09b', ink); wmapArtRoof(g, q[0], q[1] - 30, 34, 17, 26, '#c44a30', '#99351f', ink); }
  }
  wall(D, C, wh, '#d8c8a2', '#8f7d58'); wall(C, B, wh, '#a99677', '#7d6b4a');   // 前牆(外側面)
  mid = [(D[0] + C[0]) / 2, (D[1] + C[1]) / 2];   // 城門(左前牆正中)
  wmapArtFillStroke(g, [[mid[0] - 14, mid[1] - 7], [mid[0] - 14, mid[1] - 7 - 19], [mid[0] + 14, mid[1] + 7 - 25], [mid[0] + 14, mid[1] + 7]], '#3a2a1c', ink, 2);
  corners = [A, B, C, D];
  for (i = 0; i < 4; i++) { q = corners[i]; wmapArtIsoBox(g, q[0], q[1], 15, 7.5, 44, '#d4c4a0', '#a99677', '#c9b891', ink); wmapArtRoof(g, q[0], q[1] - 44, 20, 10, 20, '#b4402a', '#8a2f1f', ink); }
  return { c: c, cw: P.cw, ch: P.ch, fw: 1, fh: 1 };
}
function wmapArtMakePass(axis) {   // 兩側山 + 中間城門樓;axis 0 = 道路沿 u 走(門牆橫跨 v)、1 = 沿 v 走
  var P = WMAP_PIECE['PASS' + axis], c = wmapArtCv(P.cw, P.ch), g = c.getContext('2d'), ink = WMAP_PAL.ink, rng = wmapArtRng(wmapArtStr('PASS' + axis)), q, a1, a2, xm, ym;
  function pt(u, v) { return [(u - v + 1) * 128, P.ch - 128 + (u + v) * 64]; }
  function at(s, t2) { return axis ? pt(t2, s) : pt(s, t2); }   // s = 沿路座標、t2 = 橫跨座標
  wmapArtShadow(g, 128, P.ch - 64, 112, 48, 0.3);
  q = at(0.5, 0.12); wmapArtPeak(g, q[0], q[1] + 8, 118, 170, rng, true);   // 後側山
  if (axis) wmapArtBoxUV(g, pt, 0.2, 0.8, 0.38, 0.62, 0, 54, '#cdbd9a', '#a08e6b', '#bfae88', ink);
  else wmapArtBoxUV(g, pt, 0.38, 0.62, 0.2, 0.8, 0, 54, '#cdbd9a', '#a08e6b', '#bfae88', ink);
  // 城門洞:面向 +s 的那一面(axis 0 = 右前面、axis 1 = 左前面)
  if (!axis) { a1 = pt(0.62, 0.62); a2 = pt(0.62, 0.38); } else { a1 = pt(0.38, 0.62); a2 = pt(0.62, 0.62); }
  xm = (a1[0] + a2[0]) / 2; ym = (a1[1] + a2[1]) / 2;
  wmapArtFillStroke(g, [[a1[0], a1[1]], [a1[0], a1[1] - 28], [xm, ym - 38], [a2[0], a2[1] - 28], [a2[0], a2[1]]], '#3a2a1c', ink, 2);
  q = pt(0.5, 0.5); wmapArtIsoBox(g, q[0], q[1] - 54, 34, 17, 34, '#e0d1ae', '#b2a07a', '#d0c09b', ink); wmapArtRoof(g, q[0], q[1] - 88, 44, 22, 34, '#c44a30', '#99351f', ink);
  q = at(0.5, 0.88); wmapArtPeak(g, q[0], q[1] + 8, 118, 150, rng, false);   // 前側山
  return { c: c, cw: P.cw, ch: P.ch, fw: 1, fh: 1 };
}

// ───────── 登錄表 ─────────
function wmapArtGet(key) {
  var a = wmapArtCache[key];
  if (a !== undefined) return a;
  a = null;
  if (key.indexOf('g_') === 0) a = wmapArtMakeGround(key);
  else if (key.indexOf('mask_') === 0) a = wmapArtMakeMask(key);
  else if (/^M[1-4][a-z]?$/.test(key)) a = wmapArtMakeMountain(key);
  else if (key === 'O1') a = wmapArtMakeRock();
  else if (key === 'T1') a = wmapArtMakeTree();
  else if (key === 'CITY') a = wmapArtMakeCity();
  else if (key === 'COUNTY') a = wmapArtMakeCounty();
  else if (key === 'PASS0' || key === 'PASS1') a = wmapArtMakePass(key === 'PASS1' ? 1 : 0);
  else if (key.indexOf('gt_') === 0) a = wmapArtMakeGT(key);
  else if (key.indexOf('ro_') === 0) a = wmapArtMakeRO(key);
  wmapArtCache[key] = a;
  return a;
}
function wmapArtClear() { wmapArtCache = {}; }
