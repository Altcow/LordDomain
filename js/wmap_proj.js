// js/wmap_proj.js — 六邊形大地圖:投影 / 反投影命中 / 分塊座標 / 鏡頭與縮放限制(設計_地圖六邊形改版_規格.md 1.3、5;工作流 4)。
// 純函式:不碰 DOM / 存檔、不讀時間;ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:wm_hex.js、wm_gen.js 之後(index.html、sw.js PRECACHE 同步)。
// 命名:本檔全域一律 wmap* / WMAP_*(舊外勤已占用 wm_*、WM_CFG、wmNorm、wmDispatch、wmOpen;wm_gen.js 用 wmg* / wmGen*;wm_hex.js 用 wmHex*),測試 tools/test_wmap_view.js 會掃描全域重名。
//
// ───────── 座標約定(與 wm_gen.js / wm_hex.js 相同:gi = r × size + c;c 增加 = 畫面右下、r 增加 = 畫面左下;6 向見 wm_hex.js) ─────────
//   平頂正六邊形(左右尖角、上下平邊),只做垂直壓扁:格寬 W、頂面高 H = W × 9/16(壓扁比 0.65)、側壁 T = H / 4。
//   連續座標 (u, v)(格中心 = c + 0.5、r + 0.5,沿用舊約定)與世界座標(CSS px,原點 = world 容器左上):
//     x = ox + 0.75 W × (u − v),   y = oy + 0.5 H × (u + v)
//   反投影:X = (x − ox)/(0.75 W)、Y = (y − oy)/(0.5 H) → u = (X + Y)/2、v = (Y − X)/2 → 格 = wmHexRound(u − 0.5, v − 0.5)(O(1),命中只看頂面)。
//   ox = size × 0.75 W + W/2;oy = padUp × H(上方留山 / 樹往上凸的空間);worldW = 1.5 W × size + W;worldH = oy + H × size + T。
//   頂面六頂點(相對中心):(−W/2, 0)、(−W/4, −H/2)、(W/4, −H/2)、(W/2, 0)、(W/4, H/2)、(−W/4, H/2);側壁 = 下方三條邊往下 T。
//   鏡頭 cam = {u, v}:視窗中心對應的連續座標;視窗左上的世界座標 px = x(cam) − vw/2、py = y(cam) − vh/2。
//   畫的順序:依格中心 y 由小到大(= c + r 由小到大),同 y 由左到右(c 小的先);物件依「占地中最前(c + r 最大)那格」的中心 y。
//
// ───────── 公開 API(軍隊層、面板、畫面層只靠這裡) ─────────
//   WMAP_CFG                                   {zooms:[64, 96](格寬 W), zoomDef:1, dprCap:1.5, chunk:256, maxChunks:20, camMargin:1.5, padUp:3, tapPx:8}
//   wmapGeom(W, size) → G                      G = {s, W, H, T, size, ox, oy, worldW, worldH};s = W(別名,讓舊的 wmapGeom(G.s, size) 往返不變);W 不在 WMAP_CFG.zooms 內也可
//   wmapUV2World(G, u, v) → {x, y}             連續座標 → 世界座標
//   wmapWorld2UV(G, x, y) → {u, v}             世界座標 → 連續座標(未取整)
//   wmapCellCenter(G, c, r) → {x, y}           格中心(頂面中心)的世界座標(軍隊 / 路線走格中心)
//   wmapCellTop(G, c, r) → {x, y}              頂面外框上緣中點 = (中心 x, 中心 y − H/2);「translate(t.x − W/2, t.y) + W × H 框」剛好蓋住頂面外框
//   wmapCellRect(G, c, r) → {x, y, w, h}       六邊形外框含側壁(世界座標):(中心 x − W/2, 中心 y − H/2, W, H + T)
//   wmapCellAt(G, x, y) → {c, r}               世界座標 → 格(wmHexRound;可能在地圖外,不檢查範圍)
//   wmapGiAt(G, x, y, o) → gi | −1             命中測試:o = {border: 邊界帶格數(預設 0;帶內與地圖外回 −1), tall: function(c, r) → {x,y,w,h}|null 往上凸物件的點擊框(世界座標)}
//                                              先查本格前方 3 格((c+1,r+1)=S、(c,r+1)=SW、(c+1,r)=SE)的 tall 框,有命中取最前面那格;否則取頂面所在格
//   wmapPieceBox(G, c0, r0, fw, fh, cw, ch, ax, ay) → {x, y, w, h}   圖塊放置:錨點 = 占地上角格 (c0, r0) 的頂面中心;圖原尺度 cw × ch(格寬 256)、圖內錨點 (ax, ay)(省略 = 規格 3 公式:ax = 128 + 192 × (fh − 1)、ay = ch − 底座高 + 72,底座高 = 72 × (fw + fh − 2) + 180);回世界座標矩形(已乘 W/256)
//   wmapCamPx(G, cam, vw, vh) → {px, py}      視窗左上世界座標(world 容器 transform = translate(−px, −py))
//   wmapCamFromPx(G, px, py, vw, vh) → cam     反向:由視窗左上算鏡頭
//   wmapCamClamp(G, cam, o) → cam              夾住:u、v 各夾在 [border − margin, size − border + margin](o = {border, margin};預設 WMG 4 / WMAP_CFG.camMargin)→ 畫面上是菱形範圍
//   wmapZoomIdx(idx, dir) → idx                縮放段(0 / 1 = 格寬 64 / 96)加減一段並夾住;dir = +1 放大、−1 縮小
//   wmapAnchorZoom(G0, G1, cam, vw, vh, ax, ay) → cam   縮放時保持視窗內 (ax, ay) 那點對到同一個連續座標
//   wmapCellsInRect(G, x0, y0, x1, y1, padUp, padSide) → {c0, c1, r0, r1}   世界矩形(往上加 padUp px 給往上凸的圖塊、左右加 padSide)覆蓋到的格範圍(已外擴 1 格,夾在 0 ~ size − 1)
//   wmapChunkRange(px, py, vw, vh, chunk, pad) → {ix0, ix1, iy0, iy1}       視窗(外擴 pad px)覆蓋的分塊索引範圍;分塊 (ix, iy) 的世界矩形 = [ix × chunk, (ix + 1) × chunk)
//   wmapChunkKey(ix, iy) → 'ix,iy'
//   wmapChunkCap(vw, vh, chunk) → 數字        可見分塊最壞數量 (ceil(vw / chunk) + 1) × (ceil(vh / chunk) + 1)
//   wmapTapOk(dx, dy, ms) → bool               點擊判定(位移 ≤ WMAP_CFG.tapPx 且 ms < 500)
//   wmapCellsDist(c0, r0, c1, r1) → 數字       兩格中心的格距離(軍隊 / 去程估算用,地面等向座標歐氏;鄰格 = 1)

var WMAP_CFG = { zooms: [64, 96], zoomDef: 1, dprCap: 1.5, chunk: 256, maxChunks: 20, camMargin: 1.5, padUp: 3, tapPx: 8 };   // zooms = 格寬 W;dprCap = 地圖 / 城池 / 行軍的 DPR 上限(低畫質另限 1)

function wmapGeom(W, size) {
  var H = W * 9 / 16, T = H / 4, oy = WMAP_CFG.padUp * H;
  return { s: W, W: W, H: H, T: T, size: size, ox: size * 0.75 * W + W / 2, oy: oy, worldW: 1.5 * W * size + W, worldH: oy + H * size + T };
}
function wmapUV2World(G, u, v) { return { x: G.ox + (u - v) * 0.75 * G.W, y: G.oy + (u + v) * 0.5 * G.H }; }
function wmapWorld2UV(G, x, y) {
  var X = (x - G.ox) / (0.75 * G.W), Y = (y - G.oy) / (0.5 * G.H);
  return { u: (X + Y) / 2, v: (Y - X) / 2 };
}
function wmapCellCenter(G, c, r) { return wmapUV2World(G, c + 0.5, r + 0.5); }
function wmapCellTop(G, c, r) { var m = wmapUV2World(G, c + 0.5, r + 0.5); return { x: m.x, y: m.y - G.H / 2 }; }
function wmapCellRect(G, c, r) { var m = wmapUV2World(G, c + 0.5, r + 0.5); return { x: m.x - G.W / 2, y: m.y - G.H / 2, w: G.W, h: G.H + G.T }; }
function wmapCellAt(G, x, y) { var p = wmapWorld2UV(G, x, y), h = wmHexRound(p.u - 0.5, p.v - 0.5); return { c: h.c, r: h.r }; }
function wmapGiAt(G, x, y, o) {
  var B = o && o.border > 0 ? o.border : 0, N = G.size, p = wmapCellAt(G, x, y), c = p.c, r = p.r, tall = o && o.tall, i, t, cc, rr, offs = [[1, 1], [0, 1], [1, 0]];
  if (tall) {
    for (i = 0; i < offs.length; i++) {
      cc = c + offs[i][0]; rr = r + offs[i][1];
      if (cc < B || rr < B || cc >= N - B || rr >= N - B) continue;
      t = tall(cc, rr);
      if (t && x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) return rr * N + cc;
    }
  }
  if (c < B || r < B || c >= N - B || r >= N - B) return -1;
  return r * N + c;
}
function wmapPieceBox(G, c0, r0, fw, fh, cw, ch, ax, ay) {
  var k = G.W / 256, m = wmapUV2World(G, c0 + 0.5, r0 + 0.5);
  if (ax === undefined || ax === null) ax = 128 + 192 * (fh - 1);
  if (ay === undefined || ay === null) ay = ch - (72 * (fw + fh - 2) + 180) + 72;
  return { x: m.x - ax * k, y: m.y - ay * k, w: cw * k, h: ch * k };
}
function wmapCamPx(G, cam, vw, vh) { var p = wmapUV2World(G, cam.u, cam.v); return { px: p.x - vw / 2, py: p.y - vh / 2 }; }
function wmapCamFromPx(G, px, py, vw, vh) { var p = wmapWorld2UV(G, px + vw / 2, py + vh / 2); return { u: p.u, v: p.v }; }
function wmapCamClamp(G, cam, o) {
  var B = o && o.border >= 0 ? o.border : 4, m = o && o.margin >= 0 ? o.margin : WMAP_CFG.camMargin, lo = B - m, hi = G.size - B + m;
  return { u: cam.u < lo ? lo : (cam.u > hi ? hi : cam.u), v: cam.v < lo ? lo : (cam.v > hi ? hi : cam.v) };
}
function wmapZoomIdx(idx, dir) {
  var n = WMAP_CFG.zooms.length - 1, i = idx + (dir > 0 ? 1 : (dir < 0 ? -1 : 0));
  return i < 0 ? 0 : (i > n ? n : i);
}
function wmapAnchorZoom(G0, G1, cam, vw, vh, ax, ay) {
  var p0 = wmapCamPx(G0, cam, vw, vh), uv = wmapWorld2UV(G0, p0.px + ax, p0.py + ay), q = wmapUV2World(G1, uv.u, uv.v);
  return wmapCamFromPx(G1, q.x - ax, q.y - ay, vw, vh);
}
function wmapCellsInRect(G, x0, y0, x1, y1, padUp, padSide) {   // 矩形外擴(左右 W/2 + padSide、上 H/2 + padUp、下 H/2 + T)後的 uv 外框,再外擴 1 格
  var N = G.size, pu = padUp > 0 ? padUp : 0, ps = (padSide > 0 ? padSide : 0) + G.W / 2, ex = G.H / 2,
    a = wmapWorld2UV(G, x0 - ps, y0 - pu - ex), b = wmapWorld2UV(G, x1 + ps, y0 - pu - ex), c = wmapWorld2UV(G, x0 - ps, y1 + ex + G.T), d = wmapWorld2UV(G, x1 + ps, y1 + ex + G.T),
    u0 = Math.min(a.u, b.u, c.u, d.u), u1 = Math.max(a.u, b.u, c.u, d.u), v0 = Math.min(a.v, b.v, c.v, d.v), v1 = Math.max(a.v, b.v, c.v, d.v);
  return { c0: Math.max(0, Math.floor(u0) - 1), c1: Math.min(N - 1, Math.floor(u1) + 1), r0: Math.max(0, Math.floor(v0) - 1), r1: Math.min(N - 1, Math.floor(v1) + 1) };
}
function wmapChunkRange(px, py, vw, vh, chunk, pad) {
  var p = pad > 0 ? pad : 0;
  return { ix0: Math.floor((px - p) / chunk), ix1: Math.floor((px + vw + p - 1e-6) / chunk), iy0: Math.floor((py - p) / chunk), iy1: Math.floor((py + vh + p - 1e-6) / chunk) };
}
function wmapChunkKey(ix, iy) { return ix + ',' + iy; }
function wmapChunkCap(vw, vh, chunk) { return (Math.ceil(vw / chunk) + 1) * (Math.ceil(vh / chunk) + 1); }
function wmapTapOk(dx, dy, ms) { return Math.abs(dx) <= WMAP_CFG.tapPx && Math.abs(dy) <= WMAP_CFG.tapPx && ms < 500; }
function wmapCellsDist(c0, r0, c1, r1) { var a = wmHexGround(c0, r0), b = wmHexGround(c1, r1), dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }
