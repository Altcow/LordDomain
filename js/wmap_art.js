// js/wmap_art.js — 六邊形大地圖:程式繪製的圖形登錄表 / 圖檔接口 / 地面貼圖取樣(設計_地圖六邊形改版_規格.md 第 1、3、4、5、6 節;工作流 5)。
// 載入時不畫、第一次 wmapArtGet(key) 才畫進離屏 canvas 並快取;鍵名 = 未來正式圖的代號。程式圖是「退路」:正式圖 / 貼圖到了就換,wmap_view.js 只呼叫下列介面。
// 資源領地(2026-11-16 起):沒有整格 res_* 圖、沒有建築 / 旗;只有 gt_(地面紋理)/ ro_(自然散布物),演算法在 wmap_res.js。ES2017,不用 ?. ??;UTF-8 + CRLF。
// 畫法:光源左上、深褐描邊、接觸陰影程式畫、物件不帶地面。命名:本檔全域一律 wmap* / WMAP_*(與 wm_hex.js 的 wmHex* 不撞名)。載入本檔不需要 wm_hex.js(只有 wmapArtIsoT 用到 G 的欄位)。
//
// ───────── 美術單位(規格 1.3):格寬 W = 256、頂面高 H = 144、側壁 T = 36;單格圖塊 256 × 180,錨點 = 頂面中心 (128, 72) ─────────
//   WMAP_HEX = {W, H, T, tileW, tileH, ax, ay, K}(K = 0.65 壓扁比)
//   單格六邊形(平頂,左右尖角):頂點 (−W/2,0)(−W/4,−H/2)(W/4,−H/2)(W/2,0)(W/4,H/2)(−W/4,H/2);鄰格 d 順序 0 N 1 NE 2 SE 3 S 4 SW 5 NW(同 wm_hex.js)
//   多格拼塊 / 城池:座標 (dc, dr) 格中心 = (ax + 0.75W(dc − dr), ay + 0.5H(dc + dr));圖塊錨點 (ax, ay) = 占地上角格 (c0, r0) 的頂面中心;cells = [[dr, dc]…]
//
// ───────── 公開 API(簽名定死) ─────────
//   WMAP_PAL / WMAP_RES / WMAP_GROUND_N / WMAP_HXN             色板 / 資源名 / 舊 g_ 款數 / 六邊形地磚款數
//   WMAP_PIECE  {id: {fw, fh, cw, ch, ax, ay, bw, bh, U, cells:[[dr,dc]…]}}   拼塊目錄:bw × bh = 底座(格群頂面範圍 + 側壁)= 0.75W(fw+fh−2)+W × 0.5H(fw+fh−2)+H+T;U = 底座上方可用高度(= round(bh × 0.6));cw = bw、ch = bh + U;(ax, ay) = (W/2 + 0.75W(fh−1), U + H/2)
//        鍵:M1 M1b M2c M2r M2v M3l M3r M4 O1 T1;城池 CITY(3×3,底座 1024×468)COUNTY(4×4,1408×612)JUN(6×6,2176×900)ZHOU(8×8,2944×1188)PASS0(2×4,沿 c)PASS1(4×2,沿 r;1024×468)
//        規格第 3 節:M3f / M3b 已刪;M2v = [[0,0],[1,1]] 新增。
//   WMAP_IMG    {key: {w, h, ax, ay}}  圖檔接口:正式圖(PNG / WebP)畫布尺寸與錨點(= WMAP_PIECE 的 cw ch ax ay;地磚類 hx_* / g_* / hxwall* 一律 256 × 180、(128, 72));wmapArtImgInfo(key) 取
//   wmapArtSetSrc(key, url) → Promise<bool>   正式圖:載入圖檔,載入前 wmapArtGet 仍回程式退路,載入後 wmapArtGet(key) 回 {c: Image, cw, ch, ax, ay, fw, fh}(cw ch = WMAP_IMG 尺寸,drawImage 按 cw × W/256 縮放);wmapArtSetSrc(key, null) 取消
//   wmapArtGet(key, q) → {c: canvas, cw, ch, ax, ay, fw, fh} | null     取圖(快取);key:
//        'hx_<地面>_<款>'  六邊形地磚頂面 + 倒角(不含側壁 / 描邊;貼圖已載入就用貼圖取樣,否則程式紋理);地面 = grass(a b c)dirt(a b)wood(a b)rock(a b)rammed suburb mine hunt river shoal road、farm(a = 青苗、b = 金穗);例 'hx_grass_a' 'hx_farm_b' 'hx_river_a'
//        'g_<地面>_<款>'   同上,但永遠程式紋理(舊鍵,type:grass dirt wood road rammed rock)
//        'hxwall' / 'hxwall_<1~7>'  側壁(sides 位元:1 左下 SW、2 正下 S、4 右下 SE;'hxwall' = 7),256 × 180,錨點同上
//        'mask_0'~'mask_11'  過渡遮罩:對著鄰格 d = k % 6 那條邊的鋸齒窄帶(k ≥ 6 為另一款)
//        'M1'… 山 / 大石('O1' 'T1');城池 'CITY' 'COUNTY' 'JUN' 'ZHOU' 'PASS0' 'PASS1':wmapArtGet(key, q) 按倍率重畫向量(見下);'FLAG_ME';'gt_<種類>';'ro_<種類>_<款>_<1~5>'
//   wmapArtHexKey(type, v) → 'hx_' + type + '_' + 'abc'[v % n]      wmapArtGroundKey(type, v) → 'g_…'(舊)
//   wmapArtHexPts(cx, cy, W, H, s) → [[x,y]×6];wmapArtHexPath(g, cx, cy, W, H, s) 開路徑(s = 縮放比,預設 1)
//   wmapArtHexWall(g, x, y, W, H, T, col, sides)   在頂面中心 (x, y) 下方畫側壁(帶描邊);col = 壁基色 '#rrggbb';sides 位元 1 SW(左下)2 S(正下)4 SE(右下),預設 7;先畫側壁再畫頂面
//   wmapArtHexBevel(g, x, y, W, H, inset) 倒角(亮 / 暗六條梯形帶,inset 預設 0.86);wmapArtHexLine(g, x, y, W, H, lw, col) 頂面描邊
//   wmapArtIsoT(g, G, c, r)   河 / 路畫在「格局部座標」:原點 = 格頂面中心、單位 = 鄰格距離(x 方向 0.866 W、y 方向 H);G = wmapGeom(W, size) 的 {W, H, ox, oy};g.save() 之後呼叫、畫完 g.restore()
//   wmapArtRiver(g, pass, nb, ford, h, dg) / wmapArtRoad(g, pass, nb, h)   在 wmapArtIsoT 座標畫河 / 路單格;pass 'bank' 'water' 'hi' / 'edge' 'fill';nb = [d0…d5] 六鄰是否同類;dg[i](i = 0~5)= 鄰向 i 與 i+1 與它們之間的斜鄰都同類 → 補滿該 1/6 角
//   WMAP_DIR6 = 六個鄰向的邊中點(局部座標)
//   wmapArtClear()    清快取(測試用;不清貼圖)
//
// ───────── 地面貼圖取樣(規格第 4 節 + tools/proto_hex_texture.html;貼圖 assets/wmap/tex/tex_<key>_<1024|512>.webp,key = grass mud wood rock rammed suburb mine farm_a farm_b hunt river shoal) ─────────
//   地面 → 貼圖鍵:grass→grass、dirt→mud、wood→wood、rock→rock、rammed→rammed、suburb→suburb、mine→mine、farm a / b→farm_a / farm_b、hunt→hunt、river→river、shoal→shoal(wmapTexKeyOf(type, vi))
//   wmapTexLoad(key) → Promise<bool>     非同步載入 + 快取;載入前所有呼叫端自動退回程式退路;載入完會清掉對應 hx_ 快取並呼叫 WMAP_TEX.onload(key)(畫面層據此重烘)
//   wmapTexReady(key) → bool;wmapTexSet(key, imgOrCanvas) 直接塞圖(測試 / 預載用);wmapTexReset(key) 釋放;wmapTexTrim(keepKeys[]) 只留清單內的貼圖(畫面只用到的幾種)
//   wmapTexPattern(ctx, key, sg, ox, oy) → CanvasPattern | null    取樣 pattern。sg = 每「1024 參考貼圖像素」對應畫布 px(512 版內部自動 ×2);矩陣 = translate(−ox, −oy) · scale(sg, sg × 0.65);(ox, oy) = 畫布原點的世界座標(整張畫布 / 同一世界共用 → 相鄰格紋理連續;省略 = 0)。fill 時目前 transform 要是單位矩陣
//   wmapTexSg(W, span) → W × span / 1024    一張貼圖涵蓋 span 格寬(預設 5)的 sg
//   wmapTexSat(v?) → 飽和度(0~1.5,預設 0.65;傳值就改並重建貼圖;rock 已調灰,不套)
//   wmapTexMirror(key, on?) → bool   該貼圖是否 2×2 鏡像拼貼(預設 true,兜底免無縫);farm_a / farm_b 強制 false(田壟有方向,單向平移);mud / shoal 可呼叫 wmapTexMirror('mud', false) 改成直接平移
//   wmapTexSetRes(res)  貼圖取樣解析度 256 | 512(預設)| 1024:每種貼圖鏡像拼貼後畫布 = (2 × res)² RGBA(512 → 4 MB、256 → 1 MB、1024 → 16 MB;不鏡像的只有 1 / 4 大);wmapTexAutoRes(W, dpr, lowQ, allowHi) → 建議 res;wmapTexMem() → 位元組
//   wmapArtTexHex(g, x, y, W, H, key, opts) → bool   用貼圖畫一格六邊形(側壁 → 頂面 → 倒角 → 描邊);key = 貼圖鍵;貼圖未載入 → 畫程式退路並回 false。
//        opts:{sg, ox, oy(同 wmapTexPattern), pat(已建好的 pattern,批次畫時重用)、sides(側壁位元,預設 7,0 不畫)、T(預設 H/4)、wallCol、bevel(預設 true)、line(描邊粗,預設 max(1, W × 0.032),0 不畫)、lineCol}
//
// ───────── 城池圖介面表(底座 = c×r 菱形格群的頂面範圍 + 側壁;規格第 3 節) ─────────
//   wmapArtGet(key, q) → {c, cw, ch, ax, ay, fw, fh, q, pw, ph};cw × ch = 邏輯尺寸(格寬 256),pw × ph = canvas 實際像素 = round(cw × q) × round(ch × q);q 省略 = 1
//   q 的算法:wmapArtCityQ(W, dpr, lowQ) = (W / 256) × min(dpr, dprCap 1.5)(lowQ 時 dpr 上限 1)→ 貼圖時 drawImage(a.c, x, y, cw × W / 256, ch × W / 256),canvas 1:1 不放大
//   同時只留一個倍率層(換 q 或低畫質旗標就整層清掉);缺 canvas / getContext 回 null(不丟例外)
//   | key    | 占地 fw×fh | 底座 bw × bh  | cw × ch (= bw × (bh + U)) | 用途 |
//   | CITY   | 3 × 3      | 1024 × 468    | 1024 × 749   | 主城(朱紅 + 金脊;正門在右下面 = u+1 面,左下面第二門) |
//   | COUNTY | 4 × 4      | 1408 × 612    | 1408 × 979   | 縣 |
//   | JUN    | 6 × 6      | 2176 × 900    | 2176 × 1440  | 郡 |
//   | ZHOU   | 8 × 8      | 2944 × 1188   | 2944 × 1901  | 州 |
//   | PASS0  | 2 × 4      | 1024 × 468    | 1024 × 749   | 關(沿路 c 方向 2、橫跨 r 方向 4;門道 = r 索引 1 那排 2 格) |
//   | PASS1  | 4 × 2      | 1024 × 468    | 1024 × 749   | 關(沿 r;門道 = c 索引 1 那排) |
//   圖內座標 pt(u, v) = (ax + 192 (u − v), ay + 72 (u + v − 1));u = c 方向、v = r 方向、單位 = 格(格 (c, r) 的中心 = u = c + 0.5、v = r + 0.5)。縣 / 郡 / 州門:side 1(u+1 面)/ side 2(v+1 面),位置 = 第 floor(n / 2) 格正中(= wm_gen gateIx)。
//   wmapArtCityGateAnchor(key, side) → {x, y} | null   門(樓頂)位置,圖內邏輯座標;wmapArtCityMem(q) → bytes(六鍵同時存在的 RGBA 估算);wmapArtCityQ(W, dpr, lowQ) → q;wmapArtLowQ()
//   低畫質(lowQ):dpr 上限 1、民居減半、不畫雉堞 / 攤棚 / 花

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
var WMAP_HXN = { grass: 3, dirt: 2, wood: 2, rock: 2, rammed: 1, suburb: 1, road: 1, mine: 1, farm: 2, hunt: 1, river: 1, shoal: 1 };
var WMAP_HEX = { W: 256, H: 144, T: 36, tileW: 256, tileH: 180, ax: 128, ay: 72, K: 0.65 };
function wmapArtCellsRect(fw, fh) { var a = [], r, c; for (r = 0; r < fh; r++) for (c = 0; c < fw; c++) a.push([r, c]); return a; }
function wmapArtPiece(fw, fh, U, cells, id) {   // 拼塊 / 城池底座(規格第 3 節公式)
  var sp = fw + fh - 2, bw = Math.round(0.75 * 256 * sp + 256), bh = Math.round(0.5 * 144 * sp + 144 + 36), u = U === undefined ? Math.round(bh * 0.6) : U;
  return { fw: fw, fh: fh, bw: bw, bh: bh, U: u, cw: bw, ch: bh + u, ax: Math.round(128 + 192 * (fh - 1)), ay: u + 72, cells: cells || wmapArtCellsRect(fw, fh) };
}
var WMAP_PIECE = {
  M1: wmapArtPiece(1, 1, 220, [[0, 0]]),
  M1b: wmapArtPiece(1, 1, 220, [[0, 0]]),
  M2c: wmapArtPiece(2, 1, 230, [[0, 0], [0, 1]]),            // SE 向
  M2r: wmapArtPiece(1, 2, 230, [[0, 0], [1, 0]]),            // SW 向(M2c 的鏡像)
  M2v: wmapArtPiece(2, 2, 240, [[0, 0], [1, 1]]),            // 垂直雙峰(N–S)
  M3l: wmapArtPiece(2, 2, 250, [[0, 0], [0, 1], [1, 1]]),    // 三格互鄰的三角
  M3r: wmapArtPiece(2, 2, 250, [[0, 0], [1, 0], [1, 1]]),    // M3l 的鏡像
  M4: wmapArtPiece(2, 2, 290, wmapArtCellsRect(2, 2)),       // 2×2 = 橫菱形 4 格
  O1: wmapArtPiece(1, 1, 90, [[0, 0]]),
  T1: { fw: 1, fh: 1, bw: 256, bh: 180, U: 108, cw: 256, ch: 288, ax: 134, ay: 232, cells: [[0, 0]] },
  CITY: wmapArtPiece(3, 3),
  COUNTY: wmapArtPiece(4, 4),
  JUN: wmapArtPiece(6, 6),
  ZHOU: wmapArtPiece(8, 8),
  PASS0: wmapArtPiece(2, 4),    // 關:道路沿 c(u)走、沿路 2 格、橫跨 4 格(門道 = r 索引 1 那排)
  PASS1: wmapArtPiece(4, 2)     // 關:道路沿 r(v)走(門道 = c 索引 1 那排)
};
var WMAP_IMG = {};   // 圖檔接口:key → {w, h, ax, ay}(見檔頭)
(function () { var k; for (k in WMAP_PIECE) WMAP_IMG[k] = { w: WMAP_PIECE[k].cw, h: WMAP_PIECE[k].ch, ax: WMAP_PIECE[k].ax, ay: WMAP_PIECE[k].ay }; })();
function wmapArtImgInfo(key) {
  if (WMAP_IMG[key]) return WMAP_IMG[key];
  if (key.indexOf('hx_') === 0 || key.indexOf('g_') === 0 || key.indexOf('hxwall') === 0 || key.indexOf('mask_') === 0) return { w: 256, h: 180, ax: 128, ay: 72 };
  return null;
}
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

// ───────── 六邊形幾何(頂面 / 倒角 / 側壁 / 描邊) ─────────
function wmapArtHexPts(cx, cy, W, H, s) {
  var k = s || 1;
  return [[cx - W / 2 * k, cy], [cx - W / 4 * k, cy - H / 2 * k], [cx + W / 4 * k, cy - H / 2 * k], [cx + W / 2 * k, cy], [cx + W / 4 * k, cy + H / 2 * k], [cx - W / 4 * k, cy + H / 2 * k]];
}
function wmapArtHexPath(g, cx, cy, W, H, s) { wmapArtPoly(g, wmapArtHexPts(cx, cy, W, H, s)); }
var WMAP_BEVEL_COL = ['rgba(255,244,200,0.30)', 'rgba(255,250,215,0.42)', 'rgba(255,244,200,0.22)', 'rgba(40,20,0,0.22)', 'rgba(30,15,0,0.34)', 'rgba(40,20,0,0.22)'];   // 邊 e = 頂點 e → e+1:NW 上 NE | SE 下 SW
function wmapArtHexBevel(g, x, y, W, H, inset) {
  var hp = wmapArtHexPts(x, y, W, H, 1), ip = wmapArtHexPts(x, y, W, H, inset || 0.86), e, e2;
  for (e = 0; e < 6; e++) {
    e2 = (e + 1) % 6;
    g.beginPath(); g.moveTo(hp[e][0], hp[e][1]); g.lineTo(hp[e2][0], hp[e2][1]); g.lineTo(ip[e2][0], ip[e2][1]); g.lineTo(ip[e][0], ip[e][1]); g.closePath();
    g.fillStyle = WMAP_BEVEL_COL[e]; g.fill();
  }
}
function wmapArtHexLine(g, x, y, W, H, lw, col) {
  wmapArtHexPath(g, x, y, W, H, 1); g.lineWidth = lw; g.strokeStyle = col || '#2a1608'; g.lineJoin = 'round'; g.stroke();
}
// 側壁:sides 位元 1 = SW(頂點 5 → 0)、2 = S(4 → 5)、4 = SE(3 → 4);左亮右暗;先畫側壁再畫頂面
function wmapArtHexWall(g, x, y, W, H, T, col, sides) {
  var s = sides === undefined ? 7 : sides, v = wmapArtHexPts(x, y, W, H, 1), base = col || '#5a4126', lw = Math.max(1, W * 0.032), F = [[5, 0, 0.9, 1], [4, 5, 0.72, 2], [3, 4, 0.55, 4]], i, f, a, b, gr;
  g.lineJoin = 'round';
  for (i = 0; i < 3; i++) {
    f = F[i]; if (!(s & f[3])) continue;
    a = v[f[0]]; b = v[f[1]];
    gr = g.createLinearGradient(0, y, 0, y + H / 2 + T);
    gr.addColorStop(0, wmapArtShade(base, f[2])); gr.addColorStop(1, wmapArtShade(base, f[2] * 0.55));
    wmapArtPoly(g, [[a[0], a[1]], [b[0], b[1]], [b[0], b[1] + T], [a[0], a[1] + T]]);
    g.fillStyle = gr; g.fill(); g.lineWidth = lw; g.strokeStyle = '#2a1608'; g.stroke();
  }
}

// ───────── 地面貼圖(2026-11-17:12 張俯視貼圖 + 世界座標取樣;見檔頭) ─────────
var WMAP_TEX_KEYS = ['grass', 'mud', 'wood', 'rock', 'rammed', 'suburb', 'mine', 'farm_a', 'farm_b', 'hunt', 'river', 'shoal'];
var WMAP_TEX_OF = { grass: 'grass', dirt: 'mud', wood: 'wood', rock: 'rock', rammed: 'rammed', suburb: 'suburb', mine: 'mine', hunt: 'hunt', river: 'river', shoal: 'shoal' };
var WMAP_TEX_PROC = { grass: ['grass', 0], mud: ['dirt', 0], wood: ['wood', 0], rock: ['rock', 0], rammed: ['rammed', 0], suburb: ['suburb', 0], mine: ['mine', 0], farm_a: ['farm', 0], farm_b: ['farm', 1], hunt: ['hunt', 0], river: ['river', 0], shoal: ['shoal', 0] };
var WMAP_TEX = { base: 'assets/wmap/tex/', res: 512, sat: 0.65, span: 5, m: {}, mir: {}, nomirror: { farm_a: 1, farm_b: 1 }, nosat: { rock: 1 }, onload: null };
function wmapTexKeyOf(type, vi) {
  if (type === 'farm') return (vi === 'b' || vi === 1) ? 'farm_b' : 'farm_a';
  return WMAP_TEX_OF[type] || null;
}
function wmapTexEnt(key) { var e = WMAP_TEX.m[key]; if (!e) e = WMAP_TEX.m[key] = { st: 0, img: null, tile: null, R: 0, fres: 0, p: null }; return e; }
function wmapTexReady(key) { var e = WMAP_TEX.m[key]; return !!(e && e.st === 2 && e.tile); }
function wmapTexMirror(key, on) {
  if (on !== undefined && !WMAP_TEX.nomirror[key]) { WMAP_TEX.mir[key] = !!on; if (wmapTexReady(key)) { wmapTexBuild(key); wmapTexDone(key); } }
  if (WMAP_TEX.nomirror[key]) return false;
  return WMAP_TEX.mir[key] !== false;
}
function wmapTexSg(W, span) { return W * (span > 0 ? span : WMAP_TEX.span) / 1024; }
function wmapTexBuild(key) {   // 由 e.img 重建取樣瓦片(鏡像 2R × 2R / 不鏡像 R × R),飽和度在這裡套一次
  var e = WMAP_TEX.m[key], R = WMAP_TEX.res, mir = wmapTexMirror(key), n = mir ? R * 2 : R, sat = WMAP_TEX.nosat[key] ? 1 : WMAP_TEX.sat, c, g, useF, id, d, i, l, r0, g0, b0;
  if (!e || !e.img) return;
  c = wmapArtCv(n, n); g = c.getContext ? c.getContext('2d') : null;
  if (!g) return;
  useF = sat !== 1 && ('filter' in g);
  if (useF) g.filter = 'saturate(' + Math.round(sat * 100) + '%)';
  g.drawImage(e.img, 0, 0, R, R);
  if (mir) {
    g.save(); g.translate(2 * R, 0); g.scale(-1, 1); g.drawImage(e.img, 0, 0, R, R); g.restore();
    g.save(); g.translate(0, 2 * R); g.scale(1, -1); g.drawImage(e.img, 0, 0, R, R); g.restore();
    g.save(); g.translate(2 * R, 2 * R); g.scale(-1, -1); g.drawImage(e.img, 0, 0, R, R); g.restore();
  }
  if (useF) g.filter = 'none';
  else if (sat !== 1) {   // 沒有 ctx.filter 的瀏覽器:像素迴圈一次
    try {
      id = g.getImageData(0, 0, n, n);
      if (id && id.data) {
        d = id.data;
        for (i = 0; i < d.length; i += 4) { r0 = d[i]; g0 = d[i + 1]; b0 = d[i + 2]; l = 0.299 * r0 + 0.587 * g0 + 0.114 * b0; d[i] = l + (r0 - l) * sat; d[i + 1] = l + (g0 - l) * sat; d[i + 2] = l + (b0 - l) * sat; }
        g.putImageData(id, 0, 0);
      }
    } catch (err) { /* 取不到像素就維持原色 */ }
  }
  e.tile = c; e.R = R;
}
function wmapTexDone(key) {   // 貼圖狀態變了:清掉用到它的 hx_ 快取,通知畫面層
  var k, p;
  for (k in wmapArtCache) {
    if (k.indexOf('hx_') !== 0) continue;
    p = k.split('_');
    if (wmapTexKeyOf(p[1], p[2]) === key) delete wmapArtCache[k];
  }
  if (typeof WMAP_TEX.onload === 'function') { try { WMAP_TEX.onload(key); } catch (err) { if (typeof console !== 'undefined') console.warn('WMAP_TEX.onload', err); } }
}
function wmapTexLoad(key) {
  var e, res = WMAP_TEX.res > 512 ? 1024 : 512;
  if (WMAP_TEX_KEYS.indexOf(key) < 0 || typeof Promise === 'undefined') return typeof Promise === 'undefined' ? null : Promise.resolve(false);
  e = wmapTexEnt(key);
  if (e.st === 1 || e.st === 2) return e.p || Promise.resolve(true);
  if (e.st === 3 || typeof Image === 'undefined') { e.st = 3; return Promise.resolve(false); }
  e.st = 1; e.fres = res;
  e.p = new Promise(function (ok) {
    var img = new Image();
    img.onload = function () { e.img = img; e.st = 2; wmapTexBuild(key); wmapTexDone(key); ok(true); };
    img.onerror = function () { e.st = 3; ok(false); };
    img.src = WMAP_TEX.base + 'tex_' + key + '_' + res + '.webp';
  });
  return e.p;
}
function wmapTexSet(key, src) {   // 直接塞圖(Image / canvas):測試或預載
  var e = wmapTexEnt(key);
  e.img = src; e.st = 2; e.fres = 0; e.p = null;
  wmapTexBuild(key); wmapTexDone(key);
}
function wmapTexReset(key) { var e = WMAP_TEX.m[key]; if (!e) return; e.st = 0; e.img = null; e.tile = null; e.p = null; wmapTexDone(key); }
function wmapTexTrim(keep) {   // 只留清單內的貼圖,其餘釋放(畫面只需要看得到的那幾種;重新用到時再 wmapTexLoad)
  var k, a = keep || [];
  for (k in WMAP_TEX.m) if (a.indexOf(k) < 0 && WMAP_TEX.m[k].st !== 0) wmapTexReset(k);
}
function wmapTexMem() { var k, n = 0, t; for (k in WMAP_TEX.m) { t = WMAP_TEX.m[k].tile; if (t) n += t.width * t.height * 4; } return n; }
function wmapTexSat(v) {
  var k;
  if (v === undefined) return WMAP_TEX.sat;
  v = Math.max(0, Math.min(1.5, +v || 0));
  if (Math.abs(v - WMAP_TEX.sat) < 1e-6) return v;
  WMAP_TEX.sat = v;
  for (k in WMAP_TEX.m) if (wmapTexReady(k)) { wmapTexBuild(k); wmapTexDone(k); }
  return v;
}
function wmapTexSetRes(res) {
  var r = res >= 1024 ? 1024 : (res >= 512 ? 512 : 256), k, e;
  if (r === WMAP_TEX.res) return r;
  WMAP_TEX.res = r;
  for (k in WMAP_TEX.m) {
    e = WMAP_TEX.m[k];
    if (e.st !== 2) continue;
    if (e.fres && (e.fres > 512) !== (r > 512)) { wmapTexReset(k); wmapTexLoad(k); }   // 檔案要換(512 ↔ 1024 版)
    else { wmapTexBuild(k); wmapTexDone(k); }
  }
  return r;
}
function wmapTexAutoRes(W, dpr, lowQ, allowHi) {   // 建議解析度:1 個來源像素 ≤ 1 個裝置像素的最小檔位;預設最高 512(記憶體),allowHi 才給 1024
  var need = wmapTexSg(W) * (dpr > 0 ? dpr : 1) * 1024;
  if (lowQ) return 256;
  if (need <= 256) return 256;
  if (need <= 512 || !allowHi) return 512;
  return 1024;
}
function wmapTexPattern(ctx, key, sg, ox, oy) {
  var e = WMAP_TEX.m[key], p, s, M;
  if (!e || e.st !== 2 || !e.tile || !ctx || !ctx.createPattern) return null;
  p = ctx.createPattern(e.tile, 'repeat');
  if (!p) return null;
  s = (sg > 0 ? sg : 1) * 1024 / e.R;
  if (p.setTransform && typeof DOMMatrix !== 'undefined') {
    M = new DOMMatrix();
    M = M.translate(-(ox || 0), -(oy || 0)).scale(s, s * WMAP_HEX.K);
    p.setTransform(M);
  }
  return p;
}
function wmapArtProcTile(texKey) {   // 貼圖未載入時的程式退路單格(含倒角),快取
  var k = 'p_' + texKey, a = wmapArtCache[k], t;
  if (a !== undefined) return a;
  t = WMAP_TEX_PROC[texKey] || ['grass', 0];
  a = wmapArtHexTile(t[0], t[1], false, k);
  wmapArtCache[k] = a;
  return a;
}
function wmapArtTexHex(g, x, y, W, H, key, opts) {
  var o = opts || {}, T = o.T !== undefined ? o.T : H / 4, sides = o.sides === undefined ? 7 : o.sides, lw = o.line === undefined ? Math.max(1, W * 0.032) : o.line, pat = null, ok = false, a, k;
  if (sides) wmapArtHexWall(g, x, y, W, H, T, o.wallCol || '#5a4126', sides);
  pat = o.pat || wmapTexPattern(g, key, o.sg > 0 ? o.sg : wmapTexSg(W), o.ox, o.oy);
  if (pat) {
    wmapArtHexPath(g, x, y, W, H, 1); g.fillStyle = pat; g.fill(); ok = true;
    if (o.bevel !== false) wmapArtHexBevel(g, x, y, W, H, 0.86);
  } else {
    a = wmapArtProcTile(key);
    k = W / 256;
    if (a && a.c) g.drawImage(a.c, x - 128 * k, y - 72 * k, a.cw * k, a.ch * k);   // 退路單格已含倒角
  }
  if (lw > 0) wmapArtHexLine(g, x, y, W, H, lw, o.lineCol);
  return ok;
}

// ───────── 六邊形地磚(256 × 180,錨點 (128, 72);頂面 + 倒角,不含側壁 / 描邊) ─────────
// 色板 [底, 暗, 亮, 紋理模式]
var WMAP_HXPAL = {
  grass: [null, WMAP_PAL.grassDark, WMAP_PAL.grassLite, 'tuft'], dirt: [WMAP_PAL.dirt, WMAP_PAL.dirtDark, WMAP_PAL.dirtLite, 'stone'], wood: [WMAP_PAL.wood, WMAP_PAL.woodDark, '#9cc56a', 'tuft'],
  rock: [WMAP_PAL.rock, WMAP_PAL.rockDark, '#c5beac', 'stone'], rammed: [WMAP_PAL.rammed, WMAP_PAL.rammedDark, '#e0d3ac', 'crack'], road: [WMAP_PAL.road, WMAP_PAL.roadEdge, '#ece0b8', 'crack'],
  suburb: ['#aed46e', '#79a843', '#d3ec9a', 'tuft'], mine: ['#80604a', '#5e4535', '#9c7a5c', 'ore'], hunt: ['#c9b27a', '#b09a63', '#dccb98', 'tuft'],
  farm: [null, '#5b8f2a', '#a3cf5e', 'ridge'], river: [WMAP_PAL.water, WMAP_PAL.waterDeep, WMAP_PAL.waterHi, 'water'], shoal: ['#86cde2', '#58a5d4', '#cfeaf2', 'water']
};
function wmapArtHexIn(x, y, k) { var dy = Math.abs(y - 72); return dy <= 72 * k && Math.abs(x - 128) <= (128 - dy * 0.8889) * k; }
function wmapArtHexDetail(g, type, vi, rng) {   // 程式紋理:裁在六邊形內;細節只放在 0.9 內縮範圍(邊緣只剩底色 → 同類相鄰不突兀)
  var pal = WMAP_HXPAL[type] || WMAP_HXPAL.grass, base = pal[0], dark = pal[1], lite = pal[2], mode = pal[3], i, x, y, gr, sp, k;
  if (type === 'grass') base = WMAP_PAL.grass[vi % 3];
  else if (type === 'farm') base = vi === 1 ? '#e0c25a' : '#7fb040';
  if (type === 'farm' && vi === 1) { dark = '#c29a38'; lite = '#f1dc86'; }
  if (vi === 1 && type !== 'farm') base = wmapArtShade(base, 0.95);
  g.save(); wmapArtHexPath(g, 128, 72, 256, 144, 1); g.clip();
  gr = g.createLinearGradient(40, 0, 216, 144); gr.addColorStop(0, wmapArtShade(base, 1.07)); gr.addColorStop(1, wmapArtShade(base, 0.92));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 144);
  for (i = 0; i < 9; i++) {   // 大斑塊
    x = 30 + rng() * 196; y = 14 + rng() * 116; sp = 26 + rng() * 34;
    gr = g.createRadialGradient(x, y, 0, x, y, sp); gr.addColorStop(0, i & 1 ? 'rgba(255,255,220,.16)' : 'rgba(40,70,20,.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - sp, y - sp, sp * 2, sp * 2);
  }
  if (mode === 'ridge') {   // 田壟:沿 c 軸(右下 20.6°:斜率 72 / 192)
    for (k = -10; k < 11; k++) {
      y = 72 + k * 15;
      g.strokeStyle = k & 1 ? dark : lite; g.globalAlpha = 0.55; g.lineWidth = 7;
      g.beginPath(); g.moveTo(-10, y - 0.375 * 138); g.lineTo(266, y + 0.375 * 138); g.stroke();
    }
    g.globalAlpha = 1;
  }
  for (i = 0; i < 150; i++) {   // 細點
    x = rng() * 256; y = rng() * 144;
    if (!wmapArtHexIn(x, y, 0.92)) continue;
    g.fillStyle = rng() < 0.5 ? dark : lite; g.globalAlpha = 0.22 + rng() * 0.2;
    g.fillRect(x, y, 2 + (rng() * 2 | 0), 2);
  }
  g.globalAlpha = 1;
  if (mode === 'tuft') {   // 草叢三筆短弧
    g.lineCap = 'round';
    for (i = 0; i < 16; i++) {
      x = 40 + rng() * 176; y = 14 + rng() * 112;
      if (!wmapArtHexIn(x, y, 0.84)) continue;
      g.strokeStyle = i & 1 ? dark : lite; g.globalAlpha = 0.55; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x - 5, y - 6); g.moveTo(x, y); g.lineTo(x, y - 8); g.moveTo(x + 3, y); g.lineTo(x + 5, y - 6); g.stroke();
    }
    g.globalAlpha = 1;
  } else if (mode === 'stone' || mode === 'ore') {   // 小石子 / 礦粒
    for (i = 0; i < 10; i++) {
      x = 40 + rng() * 176; y = 18 + rng() * 108;
      if (!wmapArtHexIn(x, y, 0.82)) continue;
      g.fillStyle = mode === 'ore' && (i % 3 === 0) ? '#d08a3a' : 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(x, y, 4 + rng() * 3, 2.2, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(60,40,20,.2)'; g.beginPath(); g.ellipse(x + 1.5, y + 1.8, 4, 2, 0, 0, 7); g.fill();
    }
  } else if (mode === 'crack') {   // 夯土裂紋
    g.strokeStyle = 'rgba(80,60,30,.25)'; g.lineWidth = 1.5;
    for (i = 0; i < 6; i++) { x = 60 + rng() * 120; y = 30 + rng() * 70; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14 + rng() * 14, y + rng() * 10 - 5); g.lineTo(x + 30 + rng() * 10, y + rng() * 14 - 7); g.stroke(); }
  } else if (mode === 'water') {   // 水面波紋(淺灘多幾顆踏石)
    g.strokeStyle = lite; g.globalAlpha = 0.6; g.lineWidth = 2.5; g.lineCap = 'round';
    for (i = 0; i < 9; i++) {
      x = 50 + rng() * 150; y = 20 + rng() * 104;
      if (!wmapArtHexIn(x, y, 0.8)) continue;
      g.beginPath(); g.moveTo(x - 12, y); g.quadraticCurveTo(x - 4, y - 5, x, y); g.quadraticCurveTo(x + 4, y + 5, x + 12, y); g.stroke();
    }
    g.globalAlpha = 1;
    if (type === 'shoal') for (i = 0; i < 7; i++) {
      x = 60 + rng() * 136; y = 26 + rng() * 92;
      if (!wmapArtHexIn(x, y, 0.78)) continue;
      g.fillStyle = '#cfc8b4'; g.strokeStyle = '#7a705c'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, 9 + rng() * 4, 6, 0, 0, 7); g.fill(); g.stroke();
    }
  }
  g.restore();
}
function wmapArtHexTile(type, vi, useTex, key) {
  var c = wmapArtCv(256, 180), g = c.getContext ? c.getContext('2d') : null, rng = wmapArtRng(wmapArtStr(key)), tk, pat = null, ok = false, ox, oy;
  if (!g) return null;
  tk = wmapTexKeyOf(type, vi === 1 ? 'b' : 'a');
  if (useTex && tk && wmapTexReady(tk)) {   // 貼圖取樣:每個鍵以雜湊位移取不同的一塊
    ox = (wmapArtStr(key + 'x') % 4096); oy = (wmapArtStr(key + 'y') % 4096);
    pat = wmapTexPattern(g, tk, wmapTexSg(256), ox, oy);
    if (pat) { wmapArtHexPath(g, 128, 72, 256, 144, 1); g.fillStyle = pat; g.fill(); ok = true; }
  }
  if (!ok) wmapArtHexDetail(g, type, vi, rng);
  wmapArtHexBevel(g, 128, 72, 256, 144, 0.86);
  return { c: c, cw: 256, ch: 180, ax: 128, ay: 72, fw: 1, fh: 1 };
}
function wmapArtHexKey(type, v) { var n = WMAP_HXN[type] || 1; return 'hx_' + type + '_' + 'abc'.charAt(((v | 0) % n + n) % n); }
function wmapArtGroundKey(type, v) { var n = WMAP_GROUND_N[type] || 1; return 'g_' + type + '_' + 'abc'.charAt(((v | 0) % n + n) % n); }
function wmapArtMakeGround(key) {   // 'g_<type>_<款>' 舊鍵(永遠程式紋理)與 'hx_<type>_<款>'(貼圖優先);
  var p = key.split('_'), type = p[1], vi = 'abc'.indexOf(p[2]);
  if (!WMAP_HXPAL[type] || vi < 0) return null;
  return wmapArtHexTile(type, vi, key.indexOf('hx_') === 0, key);
}
function wmapArtMakeWall(key) {   // 'hxwall' / 'hxwall_<sides>'
  var s = key === 'hxwall' ? 7 : parseInt(key.slice(7), 10), c, g;
  if (!(s >= 1 && s <= 7)) return null;
  c = wmapArtCv(256, 180); g = c.getContext ? c.getContext('2d') : null;
  if (!g) return null;
  wmapArtHexWall(g, 128, 72, 256, 144, 36, '#5a4126', s);
  return { c: c, cw: 256, ch: 180, ax: 128, ay: 72, fw: 1, fh: 1 };
}
// 過渡遮罩:對著鄰格 d = k % 6 那條邊(頂點 d+1 → d+2)的鋸齒窄帶;k = 6~11 為另一款
function wmapArtMakeMask(key) {
  var k = parseInt(key.slice(5), 10), e = k % 6, c = wmapArtCv(256, 180), g = c.getContext ? c.getContext('2d') : null, rng = wmapArtRng(777 + k * 31), P, a, b, i, t, d, px, py;
  if (!g || !(k >= 0 && k < 12)) return null;
  P = wmapArtHexPts(128, 72, 256, 144, 1); a = P[(e + 1) % 6]; b = P[(e + 2) % 6];
  g.fillStyle = '#000'; g.beginPath(); g.moveTo(a[0], a[1]);
  for (i = 0; i <= 12; i++) { t = i / 12; d = 0.18 + rng() * 0.16; px = a[0] + (b[0] - a[0]) * t; py = a[1] + (b[1] - a[1]) * t; g.lineTo(px + (128 - px) * d, py + (72 - py) * d); }
  g.lineTo(b[0], b[1]); g.closePath(); g.fill();
  return { c: c, cw: 256, ch: 180, ax: 128, ay: 72, fw: 1, fh: 1 };
}

// ───────── 河 / 路(六邊形格局部座標:原點 = 格頂面中心、單位 = 鄰格距離;x 方向 0.866 W、y 方向 H) ─────────
function wmapArtIsoT(g, G, c, r) {   // 呼叫端 g.save() 之後呼叫,畫完 g.restore();G = wmapGeom 的結果(W H ox oy)
  var cx = G.ox + 0.75 * G.W * (c - r), cy = G.oy + 0.5 * G.H * (c + r + 1);
  g.transform(0.8660254 * G.W, 0, 0, G.H, cx, cy);
}
var WMAP_DIR6 = [[0, -0.5], [0.433, -0.25], [0.433, 0.25], [0, 0.5], [-0.433, 0.25], [-0.433, -0.25]];   // d0 N … d5 NW 的邊中點(局部座標)
function wmapArtBand(g, nb, lw, color) {
  var i;
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'butt';
  for (i = 0; i < 6; i++) {
    if (!nb[i]) continue;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(WMAP_DIR6[i][0], WMAP_DIR6[i][1]); g.stroke();
  }
  g.beginPath(); g.arc(0, 0, lw / 2, 0, Math.PI * 2); g.fill();
}
function wmapArtTris(g, dg, color) {   // dg[i] = 鄰向 i、i+1 與其間斜鄰都是同類 → 補滿中心 – 邊中點 i – 頂點 – 邊中點 i+1 的 1/6 角
  var i, a, b, vx, vy;
  if (!dg) return;
  g.fillStyle = color;
  for (i = 0; i < 6; i++) {
    if (!dg[i]) continue;
    a = WMAP_DIR6[i]; b = WMAP_DIR6[(i + 1) % 6]; vx = (a[0] + b[0]) * 2 / 3; vy = (a[1] + b[1]) * 2 / 3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(a[0], a[1]); g.lineTo(vx, vy); g.lineTo(b[0], b[1]); g.closePath(); g.fill();
  }
}
function wmapArtRiver(g, pass, nb, ford, h, dg) {
  var i;
  if (pass === 'bank') { wmapArtBand(g, nb, 0.66, WMAP_PAL.bank); wmapArtTris(g, dg, WMAP_PAL.bank); }
  else if (pass === 'water') {
    wmapArtBand(g, nb, 0.5, ford ? '#86cde2' : WMAP_PAL.water);
    if (!ford) wmapArtBand(g, nb, 0.28, WMAP_PAL.waterDeep);
    wmapArtTris(g, dg, ford ? '#86cde2' : WMAP_PAL.water);
  } else if (pass === 'hi') {
    if (ford) {   // 淺灘:三顆踏石
      g.fillStyle = '#cfc8b4'; g.strokeStyle = '#7a705c'; g.lineWidth = 0.025;
      for (i = 0; i < 3; i++) { g.beginPath(); g.ellipse((i - 1) * 0.2, ((h >> i) & 1 ? 0.04 : -0.04), 0.075, 0.06, 0, 0, 7); g.fill(); g.stroke(); }
    } else {
      g.strokeStyle = WMAP_PAL.waterHi; g.globalAlpha = 0.75; g.lineWidth = 0.05; g.lineCap = 'round';
      for (i = 0; i < 6; i++) {
        if (!nb[i]) continue;
        g.beginPath(); g.moveTo(i & 1 ? 0.08 : -0.1, i & 1 ? -0.1 : 0.08); g.lineTo(WMAP_DIR6[i][0] * 0.8, WMAP_DIR6[i][1] * 0.8); g.stroke();
      }
      g.globalAlpha = 1;
    }
  }
}
function wmapArtRoad(g, pass, nb, h) {
  if (pass === 'edge') wmapArtBand(g, nb, 0.4, WMAP_PAL.roadEdge);
  else if (pass === 'fill') { wmapArtBand(g, nb, 0.3, WMAP_PAL.road); wmapArtBand(g, nb, 0.11, '#e9dcb0'); }
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
function wmapArtCellXY(P, dr, dc) { return [P.ax + 192 * (dc - dr), P.ay + 72 * (dc + dr)]; }   // 拼塊內格 (dr, dc) 頂面中心
function wmapArtMakeMountain(id) {
  var P = WMAP_PIECE[id], c = wmapArtCv(P.cw, P.ch), g = c.getContext ? c.getContext('2d') : null, rng = wmapArtRng(wmapArtStr(id)), list = [], i, cell, xy, sx = 0, sy = 0, big = id === 'M4', one = id === 'M1' || id === 'M1b';
  if (!g) return null;
  for (i = 0; i < P.cells.length; i++) {
    cell = P.cells[i]; xy = wmapArtCellXY(P, cell[0], cell[1]);
    list.push({ cx: xy[0], cy: xy[1], d: cell[0] + cell[1] }); sx += xy[0]; sy += xy[1];
    wmapArtShadow(g, xy[0] + 8, xy[1] + 8, 112, 46, 0.34);
  }
  list.sort(function (a, b) { return a.d - b.d; });
  for (i = 0; i < list.length; i++) {
    cell = list[i];
    wmapArtPeak(g, cell.cx + (rng() - 0.5) * 24, cell.cy + 22, 176 + rng() * 36, (one ? 160 : 140) + rng() * 36, rng, one ? rng() < 0.5 : rng() < 0.4);
  }
  if (big) wmapArtPeak(g, sx / list.length + (rng() - 0.5) * 20, sy / list.length + 30, 250, 250, rng, true);
  return { c: c, cw: P.cw, ch: P.ch, ax: P.ax, ay: P.ay, fw: P.fw, fh: P.fh };
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
  var P = WMAP_PIECE.O1, c = wmapArtCv(P.cw, P.ch), g = c.getContext ? c.getContext('2d') : null, rng = wmapArtRng(901);
  if (!g) return null;
  g.translate(0, P.ay - 88);
  wmapArtShadow(g, 136, 136, 100, 42, 0.34);
  wmapArtBoulder(g, 88, 132, 36, rng); wmapArtBoulder(g, 176, 134, 34, rng); wmapArtBoulder(g, 128, 112, 54, rng);
  return { c: c, cw: P.cw, ch: P.ch, ax: P.ax, ay: P.ay, fw: 1, fh: 1 };
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
  return { c: c, cw: 256, ch: 288, ax: 134, ay: 232, fw: 1, fh: 1 };
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
// 倍率 q = (s / 128) × min(dpr, WMAP_CFG.dprCap = 1.5)(低畫質 min(dpr, 1);中景 64 最大 q = 0.75);畫布像素 = round(cw × q) × round(ch × q),直接在目標尺寸畫向量,不放大點陣。
// 同一時間只留一個倍率層(換 q 或換低畫質旗標就清掉整層);沒有 1× 原圖備份。畫法只用 fill / stroke / fillRect(雉堞),不用 setLineDash。
// 圖不超出占地菱形下緣(只往上長);陰影最多超出 0.15 格。座標 pt(u, v):u = c 方向(往右下)、v = r 方向(往左下),單位 = 一格,1 格 = 256 邏輯寬。
var WMAP_CITY_KEYS = { CITY: 1, COUNTY: 1, JUN: 1, ZHOU: 1, PASS0: 1, PASS1: 1 };
var WMAP_CITY_LAYER = { q: 0, lo: false, m: {} };
var WMAP_CITY_INS = 0.4;   // 城牆面離占地菱形邊緣的內縮(格):六邊形格群的左右尖角比菱形角內縮 0.17 格,角樓半寬 0.15 再加外框,所以取 0.4
function wmapArtLowQ() {
  var w = typeof WMAP !== 'undefined' ? WMAP : null;
  if (w && w.lowQ) return true;
  return typeof navigator !== 'undefined' && !!navigator && navigator.deviceMemory > 0 && navigator.deviceMemory <= 2;
}
function wmapArtCityQ(s, dpr, lowQ) {   // 給 wmapArtGet(key, q) 用的倍率;s = 格寬 W(CSS px,64 / 96);q = W / 256 × min(dpr, cap) → canvas 與螢幕裝置像素 1:1
  var d = dpr > 0 ? dpr : 1, cap = lowQ ? 1 : (typeof WMAP_CFG !== 'undefined' && WMAP_CFG.dprCap ? WMAP_CFG.dprCap : 1.5);
  return Math.round(s / 256 * Math.min(d, cap) * 1000) / 1000;
}
function wmapArtCityMem(q) {   // 六個鍵(關 2 款)同時存在的 RGBA 位元組數
  var ks = ['CITY', 'COUNTY', 'JUN', 'ZHOU', 'PASS0', 'PASS1'], i, P, n = 0;
  for (i = 0; i < ks.length; i++) { P = WMAP_PIECE[ks[i]]; n += Math.max(1, Math.round(P.cw * q)) * Math.max(1, Math.round(P.ch * q)) * 4; }
  return n;
}
function wmapArtCityScene(key, q, lo) {
  var P = WMAP_PIECE[key], pw = Math.max(1, Math.round(P.cw * q)), ph = Math.max(1, Math.round(P.ch * q)), c, g, S;
  if (typeof document === 'undefined' || !document || !document.createElement) return null;
  c = wmapArtCv(pw, ph); g = c.getContext ? c.getContext('2d') : null;
  if (!g) return null;
  g.setTransform(pw / P.cw, 0, 0, ph / P.ch, 0, 0);
  S = { c: c, g: g, P: P, fw: P.fw, fh: P.fh, lo: lo, ink: WMAP_PAL.ink, rng: wmapArtRng(wmapArtStr(key)), base: P.ay };
  S.pt = function (u, v) { return [P.ax + 192 * (u - v), P.ay + 72 * (u + v - 1)]; };
  g.lineJoin = 'round';
  return S;
}
// 把「單位 = 一格」的方格 (u, v) 貼到畫面(地面平面;畫街道 / 地面色塊)
function wmapArtCGround(S) { S.g.transform(192, 72, -192, 72, S.P.ax, S.P.ay - 72); }
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
function wmapArtCGateUV(S, side, ins) {   // 城門(牆面上)的 uv:side 0 = v−1 面(右上)、1 = u+1 面(右下)、2 = v+1 面(左下)、3 = u−1 面(左上);門在邊長 n 的第 floor(n / 2) 格正中(= wm_gen gateIx)
  var gu = Math.floor(S.fw / 2) + 0.5, gv = Math.floor(S.fh / 2) + 0.5;
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
function wmapArtCShadow(S, k) {   // 接觸陰影:格群頂面範圍的內接橢圓(k = 半徑比例)
  var P = S.P, sp = S.fw + S.fh - 2, c = S.pt(S.fw / 2, S.fh / 2);
  wmapArtShadow(S.g, c[0], c[1] + 36, (0.75 * 256 * sp + 256) / 2 * k, (0.5 * 144 * sp + 144) / 2 * k, 0.3);
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
  items.sort(function (x, y) { return x.d - y.d; });
  for (i = 0; i < items.length; i++) {
    it = items[i];
    if (it.t === 'h') wmapArtCHouse(S, it.u, it.v, 0.156, 0.156, 46, 30, hallPal, '#b4553a', '#8e3d2a', GOLD);
    else if (it.t === 'k') {   // 中央兩層主樓 + 大旗(最高)
      wmapArtCBox(S, 1.625 - 0.328, 1.625 + 0.328, 1.625 - 0.328, 1.625 + 0.328, 0, 80, keepPal);
      wmapArtCBox(S, 1.625 - 0.227, 1.625 + 0.227, 1.625 - 0.227, 1.625 + 0.227, 80, 124, hallPal);
      wmapArtCRoof(S, 1.625 - 0.227, 1.625 + 0.227, 1.625 - 0.227, 1.625 + 0.227, 124, 56, '#c44a30', '#99351f', GOLD, 0.07);
      q = pt(1.625, 1.625); wmapArtCFlag(S, q[0], q[1] - 124 - 56 + 4, 76, '#c8321e', 1.2);
    }
  }
  wmapArtCWall(S, ins, 3 - ins, 3 - ins, 3 - ins, hh, '#d8c8a2', '#e6d8b4');   // 前牆(外側面)
  wmapArtCWall(S, 3 - ins, 3 - ins, 3 - ins, ins, hh, '#a99677', '#b9a685');
  wmapArtCTower(S, ins, 3 - ins, 0.12, 112, towPal, '#b4402a', '#8a2f1f', GOLD, 40, 1);
  wmapArtCTower(S, 3 - ins, ins, 0.12, 112, towPal, '#b4402a', '#8a2f1f', GOLD, 40, 1);
  wmapArtCTower(S, 3 - ins, 3 - ins, 0.12, 112, towPal, '#b4402a', '#8a2f1f', GOLD, 40, 1);
  wmapArtCBox(S, 1.5 - 0.2, 1.5 + 0.2, 2.74, 3.0, 0, hh + 18, towPal);   // 左下面(v+1 面)第二門:小門樓 + 門洞
  wmapArtCRoof(S, 1.5 - 0.2, 1.5 + 0.2, 2.74, 3.0, hh + 18, 26, '#b4553a', '#8e3d2a', GOLD, 0.03);
  wmapArtCArch(S, 'v', 3.0, 1.5, 0.14, 46, 0);
  gu = 3.0;   // 右前牆(u+1 面)城門:門樓 + 門洞(道路從這一面進來)
  wmapArtCBox(S, 2.72, gu, 1.5 - 0.22, 1.5 + 0.22, 0, hh + 24, towPal);
  wmapArtCRoof(S, 2.72, gu, 1.5 - 0.22, 1.5 + 0.22, hh + 24, 30, '#c44a30', '#99351f', GOLD, 0.03);
  wmapArtCArch(S, 'u', gu, 1.5, 0.15, 52, 0);
}

// ── 縣 4×4 / 郡 6×6 / 州 8×8(同一套畫法,按邊長 n 擴張):縣 = 低矮樸素、灰褐夯土牆、青灰瓦、只有前角矮哨樓;郡 / 州 = 青磚高牆 + 雉堞、琉璃瓦 + 金脊、四角兩層角樓、正面兩座重簷城樓、大殿 + 民居 + 市街攤棚 ──
// 門:side 1(u+1 面)/ side 2(v+1 面)在第 floor(n / 2) 格正中(= wm_gen gateIx);後牆(side 0 / 3)只有郡 / 州畫小門洞
function wmapArtDrawTown(S, kind) {
  var g = S.g, pt = S.pt, ins = WMAP_CITY_INS, n = S.fw, F = n - ins, gm = Math.floor(n / 2) + 0.5, big = kind !== 'county', zhou = kind === 'zhou', wh = big ? (zhou ? 64 : 56) : 34, tz = big ? 132 : 58, GOLD = '#d9b44a', i, j, k, u, v, s, o, p, it, items = [], stp = big ? 0.72 : 0.8, hc = ins + (n - 2 * ins) * 0.27, hs = zhou ? 0.62 : (big ? 0.5 : 0.3), pal, cols = ['#4f8fb0', '#d9b44a', '#e8e0c8', '#6a9a58', '#8a6aa8'],
    wp = big ? ['#a3a8a6', '#7c827f', '#b4b9b6'] : ['#c4b79a', '#9a8d72', '#b6a98c'], hp = big ? ['#e1d6b8', '#b9ab88', '#d0c09b'] : ['#e1d6b8', '#b9ab88', '#d0c4a2'],
    rl = big ? (zhou ? '#4d4a7a' : '#3f5d7a') : '#6f7f86', rr = big ? (zhou ? '#3a3763' : '#2f4a63') : '#56646b',
    wBack = big ? ['#8f9593', '#7c827f'] : ['#a99b7e', '#8f8268'], wFront = big ? ['#a3a8a6', '#7c827f'] : ['#b9ab8e', '#8f8268'];
  wmapArtCShadow(S, 0.78);
  wmapArtCWall(S, ins, ins, F, ins, wh, wBack[0], big ? '#b4bab7' : null, big ? 1 : 0);    // 後牆(內側面)
  wmapArtCWall(S, ins, ins, ins, F, wh, wBack[1], big ? '#a3a8a6' : null, big ? 1 : 0);
  if (big) wmapArtCTower(S, ins, ins, 0.15, tz, wp, rl, rr, GOLD, 36, 2);                 // 後角樓
  g.save(); wmapArtCGround(S); g.fillStyle = 'rgba(110,100,70,.30)';                       // 十字街
  k = big ? 0.17 : 0.1;
  g.fillRect(ins + 0.05, gm - k, n - 2 * ins - 0.1, k * 2); g.fillRect(gm - k, ins + 0.05, k * 2, n - 2 * ins - 0.1); g.restore();
  if (big) { o = wmapArtCGateUV(S, 0, ins); wmapArtCArch(S, 'v', ins, gm, 0.17, 42, 0); wmapArtCArch(S, 'u', ins, gm, 0.17, 42, 0); }
  else { wmapArtCArch(S, 'v', ins, gm, 0.13, 28, 0); wmapArtCArch(S, 'u', ins, gm, 0.13, 28, 0); }
  for (i = 0; ins + 0.45 + i * stp < F - 0.3; i++) for (j = 0; ins + 0.45 + j * stp < F - 0.3; j++) {   // 民居網格(避開街、大殿)
    u = ins + 0.45 + i * stp; v = ins + 0.45 + j * stp;
    if (Math.abs(u - gm) < (big ? 0.42 : 0.36) || Math.abs(v - gm) < (big ? 0.42 : 0.36)) continue;
    if (Math.abs(u - hc) < hs + 0.25 && Math.abs(v - hc) < hs + 0.25) continue;
    if (S.lo && ((i + j) & 1)) continue;
    s = S.rng();
    items.push({ d: u + v, t: 'h', u: u + (s - 0.5) * 0.1, v: v, hw: 0.13 + s * 0.04, hd: 0.11 + s * 0.03, h: 16 + (s * 10 | 0), c: s > 0.5 });
  }
  if (big && !S.lo) {   // 攤棚:沿兩條街
    for (i = 0; ins + 0.9 + i * 0.95 < F - 0.5; i++) {
      u = ins + 0.9 + i * 0.95;
      if (Math.abs(u - hc) < hs + 0.2) { continue; }
      items.push({ d: u + gm - 0.33, t: 's', u: u, v: gm - 0.34, c: cols[i % 5] }); items.push({ d: gm - 0.34 + u, t: 's', u: gm - 0.34, v: u, c: cols[(i + 2) % 5] });
    }
    items.push({ d: 2 * gm - 0.3, t: 'm', u: gm - 0.16, v: gm - 0.16, c: GOLD }); items.push({ d: 2 * gm + 0.1, t: 'm', u: gm + 0.18, v: gm + 0.16, c: '#4f8fb0' });
  }
  items.push({ d: 2 * hc, t: 'o' });
  items.sort(function (x, y) { return x.d - y.d; });
  for (i = 0; i < items.length; i++) {
    it = items[i];
    if (it.t === 'h') wmapArtCHouse(S, it.u, it.v, it.hw, it.hd, it.h, big ? 17 : 16, hp, big ? (it.c ? rl : '#4d6c88') : rl, big ? (it.c ? rr : '#3a566f') : rr, null);
    else if (it.t === 's') wmapArtCBox(S, it.u - 0.09, it.u + 0.09, it.v - 0.07, it.v + 0.07, 0, 14, ['#d8cfb4', '#a89e84', it.c]);
    else if (it.t === 'm') { o = pt(it.u, it.v); wmapArtCFlag(S, o[0], o[1], 44, it.c, 0.6); }
    else if (big) {   // 大殿:兩層、瓦 + 金脊
      wmapArtCBox(S, hc - hs, hc + hs, hc - hs * 0.8, hc + hs * 0.8, 0, 52, hp);
      wmapArtCRoof(S, hc - hs, hc + hs, hc - hs * 0.8, hc + hs * 0.8, 52, 20, rl, rr, null, 0.06);
      wmapArtCBox(S, hc - hs * 0.64, hc + hs * 0.64, hc - hs * 0.52, hc + hs * 0.52, 58, 90, hp);
      wmapArtCRoof(S, hc - hs * 0.64, hc + hs * 0.64, hc - hs * 0.52, hc + hs * 0.52, 90, 40, rl, rr, GOLD, 0.06);
    } else {   // 衙署:稍大 + 土黃小旗
      wmapArtCBox(S, hc - 0.3, hc + 0.3, hc - 0.24, hc + 0.24, 0, 34, ['#e0d1ae', '#b2a07a', '#d0c09b']);
      wmapArtCRoof(S, hc - 0.3, hc + 0.3, hc - 0.24, hc + 0.24, 34, 30, rl, rr, null, 0.05);
      o = pt(hc, hc); wmapArtCFlag(S, o[0], o[1] - 34 - 30 + 4, 40, GOLD, 0.8);
    }
  }
  wmapArtCWall(S, ins, F, F, F, wh, wFront[0], big ? '#c0c5c2' : null, big ? 1 : 0);        // 前牆(外側面)
  wmapArtCWall(S, F, F, F, ins, wh, wFront[1], big ? '#989e9b' : null, big ? 1 : 0);
  if (big) {
    wmapArtCTower(S, ins, F, 0.15, tz, wp, rl, rr, GOLD, 36, 2);
    wmapArtCTower(S, F, ins, 0.15, tz, wp, rl, rr, GOLD, 36, 2);
    wmapArtCTower(S, F, F, 0.15, tz, wp, rl, rr, GOLD, 36, 2);
    for (i = 1; i <= 2; i++) {   // 正面兩座重簷城樓(u+1 面、v+1 面)
      s = i === 1;
      u = s ? F : gm; v = s ? gm : F;
      if (s) { wmapArtCBox(S, F - 0.38, F + 0.1, gm - 0.42, gm + 0.42, 0, 70, wp); wmapArtCRoof(S, F - 0.38, F + 0.1, gm - 0.42, gm + 0.42, 70, 18, rl, rr, GOLD, 0.05); }
      else { wmapArtCBox(S, gm - 0.42, gm + 0.42, F - 0.38, F + 0.1, 0, 70, wp); wmapArtCRoof(S, gm - 0.42, gm + 0.42, F - 0.38, F + 0.1, 70, 18, rl, rr, GOLD, 0.05); }
      p = s ? [F - 0.09, gm] : [gm, F - 0.09];
      wmapArtCBox(S, p[0] - 0.14, p[0] + 0.14, p[1] - 0.14, p[1] + 0.14, 76, 106, hp);
      wmapArtCRoof(S, p[0] - 0.14, p[0] + 0.14, p[1] - 0.14, p[1] + 0.14, 106, 34, rl, rr, GOLD, 0.06);
      o = pt(p[0], p[1]); wmapArtCFlag(S, o[0], o[1] - 106 - 34 + 4, 58, GOLD, 1.1);
      if (s) wmapArtCArch(S, 'u', F + 0.1, gm, 0.17, 52, 0); else wmapArtCArch(S, 'v', F + 0.1, gm, 0.17, 52, 0);
    }
  } else {
    for (i = 1; i <= 2; i++) wmapArtCArch(S, i === 1 ? 'u' : 'v', F, gm, 0.13, 28, 0);
    wmapArtCTower(S, F, F, 0.1, tz, wp, rl, rr, null, 22, 1);   // 前角矮哨樓
  }
}

// ── 關:兩側山壁(不可走)+ 中間 1 排 2 格門道(路)上的黑瓦石砌門樓;PASS0 = 路沿 u(c)走(s = u、t = v)、PASS1 = 沿 v(r)走(s = v、t = u);橫跨 t 共 4 格,門道 = t ∈ [1, 2] ──
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
  p = at(0.62, 0.55); wmapArtPeak(g, p[0], p[1] + 14, 190, 236, rng, true);    // 後側山壁(t < 1,2 峰)
  p = at(1.42, 0.5); wmapArtPeak(g, p[0], p[1] + 14, 200, 212, rng, false);
  box(0.7, 1.3, 0.5, 0.98, 0, 38, sp); box(0.7, 1.3, 2.02, 2.5, 0, 38, sp);    // 兩翼石牆接進山壁
  course(0.7, 1.3, 0.5, 0.98, 38, 2); course(0.7, 1.3, 2.02, 2.5, 38, 2);
  box(0.5, 1.5, 1.0, 2.0, 0, 72, sp); course(0.5, 1.5, 1.0, 2.0, 72, 3);        // 門樓主體(跨在門道上)
  if (axis) wmapArtCArch(S, 'v', 1.5, 1.5, 0.27, 52, 0); else wmapArtCArch(S, 'u', 1.5, 1.5, 0.27, 52, 0);   // 門洞開在朝 +s 的面
  box(0.62, 1.38, 1.1, 1.9, 72, 100, sp); roof(0.62, 1.38, 1.1, 1.9, 100, 36, 0.07);
  p = at(1.0, 1.5); wmapArtCFlag(S, p[0], p[1] - 100 - 36 + 3, 56, '#d9b44a', 1.0);
  for (i = 0; i < 4; i++) {   // 前側山壁(t > 2,2 × 2 格)
    p = at(0.55 + (i & 1) * 0.9, 2.6 + (i >> 1) * 0.9 + (i & 1) * 0.05);
    wmapArtPeak(g, p[0], p[1] + 12, 150 + (i === 3 ? 20 : 0), 120 + (i * 17 % 40), rng, i === 3);
  }
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
  if (key === 'CITY') wmapArtDrawCity(S); else if (key === 'COUNTY') wmapArtDrawTown(S, 'county'); else if (key === 'JUN') wmapArtDrawTown(S, 'jun'); else if (key === 'ZHOU') wmapArtDrawTown(S, 'zhou'); else wmapArtDrawPass(S, key === 'PASS1' ? 1 : 0);
  return { c: S.c, cw: P.cw, ch: P.ch, ax: P.ax, ay: P.ay, fw: P.fw, fh: P.fh, q: q, pw: S.c.width, ph: S.c.height };
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
// 主城門 / 城門上方的位置(圖內邏輯座標,給 FLAG_ME 小旗腳點用):CITY 一律 side 1;縣 / 郡 / 州 side 1 / 2(= node.gates[node.mg].side),0 / 3 回後牆門;關忽略 side(門樓頂)
function wmapArtCityGateAnchor(key, side) {
  var P = WMAP_PIECE[key], S, ins = WMAP_CITY_INS, o, p, z, big;
  if (!P || !WMAP_CITY_KEYS[key]) return null;
  S = { fw: P.fw, fh: P.fh };
  S.pt = function (u, v) { return [P.ax + 192 * (u - v), P.ay + 72 * (u + v - 1)]; };
  if (key === 'PASS0' || key === 'PASS1') { p = key === 'PASS1' ? S.pt(1.5, 1.0) : S.pt(1.0, 1.5); return { x: p[0], y: p[1] - 76 }; }
  o = wmapArtCGateUV(S, key === 'CITY' ? 1 : side, ins); p = S.pt(o.u, o.v);
  big = key === 'JUN' || key === 'ZHOU';
  z = key === 'CITY' ? 90 : (key === 'COUNTY' ? 34 : (side === 1 || side === 2 ? 72 : 56));
  return { x: p[0], y: p[1] - z };
}

// ───────── 圖檔接口:正式圖載入後取代程式退路 ─────────
var wmapArtImgs = {};
function wmapArtSetSrc(key, url) {
  var info = wmapArtImgInfo(key), P = WMAP_PIECE[key];
  if (!url) { delete WMAP_ART_SRC[key]; delete wmapArtImgs[key]; delete wmapArtCache[key]; return typeof Promise === 'undefined' ? null : Promise.resolve(false); }
  WMAP_ART_SRC[key] = url;
  if (!info || typeof Image === 'undefined' || typeof Promise === 'undefined') return typeof Promise === 'undefined' ? null : Promise.resolve(false);
  return new Promise(function (ok) {
    var img = new Image();
    img.onload = function () { wmapArtImgs[key] = { c: img, cw: info.w, ch: info.h, ax: info.ax, ay: info.ay, fw: P ? P.fw : 1, fh: P ? P.fh : 1, q: 1, pw: img.width, ph: img.height, img: true }; delete wmapArtCache[key]; if (typeof WMAP_TEX === 'object' && typeof WMAP_TEX.onload === 'function') { try { WMAP_TEX.onload(key); } catch (err) { /* 畫面層回呼出錯不影響圖檔載入 */ } } ok(true); };
    img.onerror = function () { ok(false); };
    img.src = url;
  });
}

// ───────── 登錄表 ─────────
function wmapArtGet(key, q) {
  var a = wmapArtImgs[key];
  if (a !== undefined) return a;
  if (WMAP_CITY_KEYS[key] === 1) return wmapArtCityGet(key, q);   // 城池 6 鍵:按倍率 q 重畫向量(q 省略 = 1),只留一個倍率層
  a = wmapArtCache[key];
  if (a !== undefined) return a;
  a = null;
  if (key.indexOf('g_') === 0 || key.indexOf('hx_') === 0) a = wmapArtMakeGround(key);
  else if (key.indexOf('hxwall') === 0) a = wmapArtMakeWall(key);
  else if (key.indexOf('mask_') === 0) a = wmapArtMakeMask(key);
  else if (/^M[1-4][a-z]?$/.test(key)) a = WMAP_PIECE[key] ? wmapArtMakeMountain(key) : null;
  else if (key === 'O1') a = wmapArtMakeRock();
  else if (key === 'T1') a = wmapArtMakeTree();
  else if (key === 'FLAG_ME') a = wmapArtMakeFlagMe();
  else if (key.indexOf('gt_') === 0) a = wmapArtMakeGT(key);
  else if (key.indexOf('ro_') === 0) a = wmapArtMakeRO(key);
  wmapArtCache[key] = a;
  return a;
}
function wmapArtClear() { wmapArtCache = {}; WMAP_CITY_LAYER.q = 0; WMAP_CITY_LAYER.m = {}; }
