// js/wmap_proj.js — M1 斜角大地圖:投影 / 反投影命中 / 分塊座標 / 鏡頭與縮放限制(設計_地圖斜角視覺_規格.md 1.1~1.3、1.5;M1 計畫 W1)。
// 純函式:不碰 DOM / 存檔、不讀時間;ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:wm_gen.js 之後(index.html、sw.js PRECACHE 同步)。
// 命名:本檔全域一律 wmap* / WMAP_*(舊外勤已占用 wm_*、WM_CFG、wmNorm、wmDispatch、wmOpen;wm_gen.js 用 wmg* / wmGen*),測試 tools/test_wmap_view.js 會掃描全域重名。
//
// ───────── 座標約定(與 wm_gen.js 相同:gi = r × size + c;c 增加 = 畫面往右下,r 增加 = 畫面往左下) ─────────
//   格 (c, r) 的菱形:頂點在 (u = c, v = r),中心在 (c + 0.5, r + 0.5)。連續座標 (u, v) 與世界座標(CSS px,原點 = world 容器左上):
//     x = ox + (u − v) × W/2,   y = oy + (u + v) × H/2          W = 2s、H = s(s = 格大小 44 / 64 / 104,等面積菱形 88×44 / 128×64 / 208×104)
//   反投影:X = (x − ox)/(W/2) = u − v,Y = (y − oy)/(H/2) = u + v → u = (X + Y)/2,v = (Y − X)/2;命中格 c = floor(u)、r = floor(v)(與 render.js screenToCell 同公式,O(1))。
//   ox = size × W/2(讓最左頂點 x = 0)、oy = 3 × H(上方留山 / 樹往上凸的空間);worldW = size × W、worldH = oy + (size + 1) × H。
//   鏡頭 cam = {u, v}:視窗中心對應的連續座標;視窗左上的世界座標 px = x(cam) − vw/2、py = y(cam) − vh/2。
//
// ───────── 公開 API(W4 軍隊層、W3 之後的人只靠這裡) ─────────
//   WMAP_CFG                                   {zooms:[44,64,104], zoomDef:1, chunk:256, maxChunks:20, camMargin:1.5, padUp:3, tapPx:8}
//   wmapGeom(s, size) → G                      G = {s, W, H, size, ox, oy, worldW, worldH};s 不在 WMAP_CFG.zooms 內也可(任意正數)
//   wmapUV2World(G, u, v) → {x, y}             連續座標 → 世界座標
//   wmapWorld2UV(G, x, y) → {u, v}             世界座標 → 連續座標(未取整)
//   wmapCellCenter(G, c, r) → {x, y}           格中心的世界座標(軍隊 / 路線走格中心,W4 用這個)
//   wmapCellTop(G, c, r) → {x, y}              菱形頂點(= (u=c, v=r))
//   wmapCellRect(G, c, r) → {x, y, w, h}       菱形外框(世界座標)
//   wmapCellAt(G, x, y) → {c, r}               世界座標 → 格(可能在地圖外,不檢查範圍)
//   wmapGiAt(G, x, y, o) → gi | −1             命中測試:o = {border: 邊界帶格數(預設 0;帶內與地圖外回 −1), tall: function(c, r) → {x,y,w,h}|null 往上凸物件的點擊框(世界座標)}
//                                              先查本格前方 3 格((c+1,r+1)、(c,r+1)、(c+1,r))的 tall 框,有命中取最前面那格;否則取菱形所在格
//   wmapPieceBox(G, c0, r0, fw, fh, cw, ch) → {x, y, w, h}   拼塊圖放置(footprint 外框左上格 (c0, r0)、寬 fw 欄 × 高 fh 列;圖原尺度 cw × ch,1 格 = 256 px 寬):
//                                              左頂點對齊 footprint 左角、底緣對齊前(下)頂點;回世界座標矩形(已乘 W/256)
//   wmapCamPx(G, cam, vw, vh) → {px, py}      視窗左上世界座標(world 容器 transform = translate(−px, −py))
//   wmapCamFromPx(G, px, py, vw, vh) → cam     反向:由視窗左上算鏡頭
//   wmapCamClamp(G, cam, o) → cam              夾住:u、v 各夾在 [border − margin, size − border + margin](o = {border, margin};預設 WMG 4 / WMAP_CFG.camMargin)→ 畫面上是菱形範圍,不能拖出邊界帶
//   wmapZoomIdx(idx, dir) → idx                縮放段(0 / 1 / 2 = 格 44 / 64 / 104)加減一段並夾住;dir = +1 放大、−1 縮小
//   wmapAnchorZoom(G0, G1, cam, vw, vh, ax, ay) → cam   縮放時保持視窗內 (ax, ay) 那點對到同一個連續座標(滾輪 / 雙指的錨點)
//   wmapCellsInRect(G, x0, y0, x1, y1, padUp, padSide) → {c0, c1, r0, r1}   世界矩形(往上加 padUp px 給往上凸的拼塊)覆蓋到的格範圍(夾在 0 ~ size − 1)
//   wmapChunkRange(px, py, vw, vh, chunk, pad) → {ix0, ix1, iy0, iy1}       視窗(外擴 pad px)覆蓋的分塊索引範圍;分塊 (ix, iy) 的世界矩形 = [ix × chunk, (ix + 1) × chunk)
//   wmapChunkKey(ix, iy) → 'ix,iy'
//   wmapChunkCap(vw, vh, chunk) → 數字        可見分塊最壞數量 (ceil(vw / chunk) + 1) × (ceil(vh / chunk) + 1)
//   wmapTapOk(dx, dy, ms) → bool               點擊判定(位移 ≤ WMAP_CFG.tapPx 且 ms < 500)
//   wmapCellsDist(c0, r0, c1, r1) → 數字       兩格中心的格距離(軍隊 / 去程估算用,歐氏)

var WMAP_CFG = { zooms: [44, 64, 104], zoomDef: 1, chunk: 256, maxChunks: 20, camMargin: 1.5, padUp: 3, tapPx: 8 };

function wmapGeom(s, size) {
  var W = 2 * s, H = s, oy = WMAP_CFG.padUp * H;
  return { s: s, W: W, H: H, size: size, ox: size * W / 2, oy: oy, worldW: size * W, worldH: oy + (size + 1) * H };
}
function wmapUV2World(G, u, v) { return { x: G.ox + (u - v) * G.W / 2, y: G.oy + (u + v) * G.H / 2 }; }
function wmapWorld2UV(G, x, y) {
  var X = (x - G.ox) / (G.W / 2), Y = (y - G.oy) / (G.H / 2);
  return { u: (X + Y) / 2, v: (Y - X) / 2 };
}
function wmapCellCenter(G, c, r) { return wmapUV2World(G, c + 0.5, r + 0.5); }
function wmapCellTop(G, c, r) { return wmapUV2World(G, c, r); }
function wmapCellRect(G, c, r) { var t = wmapUV2World(G, c, r); return { x: t.x - G.W / 2, y: t.y, w: G.W, h: G.H }; }
function wmapCellAt(G, x, y) { var p = wmapWorld2UV(G, x, y); return { c: Math.floor(p.u), r: Math.floor(p.v) }; }
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
function wmapPieceBox(G, c0, r0, fw, fh, cw, ch) {
  var k = G.W / 256, left = wmapUV2World(G, c0, r0 + fh), front = wmapUV2World(G, c0 + fw, r0 + fh);
  return { x: left.x, y: front.y - ch * k, w: cw * k, h: ch * k };
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
function wmapCellsInRect(G, x0, y0, x1, y1, padUp, padSide) {
  var N = G.size, pu = padUp > 0 ? padUp : 0, ps = padSide > 0 ? padSide : 0, a = wmapWorld2UV(G, x0 - ps, y0 - pu), b = wmapWorld2UV(G, x1 + ps, y0 - pu), c = wmapWorld2UV(G, x0 - ps, y1), d = wmapWorld2UV(G, x1 + ps, y1),
    u0 = Math.min(a.u, b.u, c.u, d.u), u1 = Math.max(a.u, b.u, c.u, d.u), v0 = Math.min(a.v, b.v, c.v, d.v), v1 = Math.max(a.v, b.v, c.v, d.v);
  return { c0: Math.max(0, Math.floor(u0)), c1: Math.min(N - 1, Math.floor(u1)), r0: Math.max(0, Math.floor(v0)), r1: Math.min(N - 1, Math.floor(v1)) };
}
function wmapChunkRange(px, py, vw, vh, chunk, pad) {
  var p = pad > 0 ? pad : 0;
  return { ix0: Math.floor((px - p) / chunk), ix1: Math.floor((px + vw + p - 1e-6) / chunk), iy0: Math.floor((py - p) / chunk), iy1: Math.floor((py + vh + p - 1e-6) / chunk) };
}
function wmapChunkKey(ix, iy) { return ix + ',' + iy; }
function wmapChunkCap(vw, vh, chunk) { return (Math.ceil(vw / chunk) + 1) * (Math.ceil(vh / chunk) + 1); }
function wmapTapOk(dx, dy, ms) { return Math.abs(dx) <= WMAP_CFG.tapPx && Math.abs(dy) <= WMAP_CFG.tapPx && ms < 500; }
function wmapCellsDist(c0, r0, c1, r1) { return Math.sqrt((c1 - c0) * (c1 - c0) + (r1 - r0) * (r1 - r0)); }
