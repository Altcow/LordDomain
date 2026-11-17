// js/wm_hex.js — 大地圖六邊形格幾何純函式庫(設計_地圖六邊形改版_規格.md 第 1 節;工作流 1)。
// 命名:全域一律 wmHex* / WMHEX_*;純函式、無 DOM、無亂數;ES2017,不用 ?. ??;UTF-8 + CRLF。載入在 wm_gen.js 之前。
// 座標:格 (c, r) 為軸向座標,gi = r × N + c;c+1 = 螢幕右下鄰格、r+1 = 螢幕左下鄰格。棋盤是 c×r 菱形(N = WMG_CFG.size,呼叫端傳入)。
// 6 向 d(順時針,從螢幕正上起):0 N (−1,−1)、1 NE (0,−1)、2 SE (+1,0)、3 S (+1,+1)、4 SW (0,+1)、5 NW (−1,0);不相鄰:(+1,−1)、(−1,+1)。
//
// ───────── 公開 API ─────────
//   WMHEX_DC / WMHEX_DR   6 向位移表(長度 6)
//   WMHEX_SQUASH 0.65 / WMHEX_ZOOMS [64, 96] / WMHEX_HRATIO 9/16 / WMHEX_TRATIO 1/4 / WMHEX_ART {W:256, H:144, T:36, tileW:256, tileH:180, ax:128, ay:72}   投影常數(格寬 W;H = W × 9/16、T = H / 4)
//   wmHexDist(c0, r0, c1, r1) → 整數;wmHexDistGi(a, b, N) → 整數
//   wmHexNb(gi, d, N) → gi | −1(出界);wmHexNbs(gi, N, out?) → [gi…](界內,依 d 順序;out 有給就清空重用)
//   wmHexDirOf(dc, dr) → 0~5 | −1(不是單步鄰格);wmHexMirror(d) → (6 − d) % 6
//   wmHexRange(c, r, k, N) → [gi…](距離 ≤ k、界內,依 r、c 升冪);wmHexRing(c, r, k, N) → [gi…](距離 = k;k = 0 回自身)
//   wmHexGround(c, r) → {x, y}:地面等向座標 x = 0.8660254 × (c − r)、y = 0.5 × (c + r)(雜訊 / 角度 / 歐氏距離用,鄰格距離 = 1)
//   wmHexRound(u, v) → {c, r}:連續軸向座標 → 最近格(cube rounding;不檢查界內)
//   wmHexLine(c0, r0, c1, r1) → [[c, r]…](含兩端)
//   wmHexArt(d) → {dir, mir}:軍隊圖欄(規格 1.1 表;N / S 回 {dir:1|0, mir:−1},−1 = 呼叫端沿用上一段 mir)

var WMHEX_DC = [-1, 0, 1, 1, 0, -1];
var WMHEX_DR = [-1, -1, 0, 1, 1, 0];
var WMHEX_SQUASH = 0.65;
var WMHEX_ZOOMS = [64, 96];
var WMHEX_HRATIO = 9 / 16;
var WMHEX_TRATIO = 0.25;
var WMHEX_ART = { W: 256, H: 144, T: 36, tileW: 256, tileH: 180, ax: 128, ay: 72 };
var WMHEX_GX = 0.8660254;
var WMHEX_ARTTAB = [{ dir: 1, mir: -1 }, { dir: 1, mir: 0 }, { dir: 0, mir: 0 }, { dir: 0, mir: -1 }, { dir: 0, mir: 1 }, { dir: 1, mir: 1 }];

function wmHexDist(c0, r0, c1, r1) {
  var dc = c1 - c0, dr = r1 - r0;
  var ac = dc < 0 ? -dc : dc, ar = dr < 0 ? -dr : dr;
  if ((dc >= 0 && dr >= 0) || (dc <= 0 && dr <= 0)) return ac > ar ? ac : ar;
  return ac + ar;
}
function wmHexDistGi(a, b, N) {
  var ac = a % N, bc = b % N;
  return wmHexDist(ac, (a - ac) / N, bc, (b - bc) / N);
}
function wmHexNb(gi, d, N) {
  var c = gi % N, r = (gi - c) / N;
  c += WMHEX_DC[d]; r += WMHEX_DR[d];
  if (c < 0 || r < 0 || c >= N || r >= N) return -1;
  return r * N + c;
}
function wmHexNbs(gi, N, out) {
  var res = out || [], c = gi % N, r = (gi - c) / N, d, cc, rr;
  res.length = 0;
  for (d = 0; d < 6; d++) {
    cc = c + WMHEX_DC[d]; rr = r + WMHEX_DR[d];
    if (cc < 0 || rr < 0 || cc >= N || rr >= N) continue;
    res.push(rr * N + cc);
  }
  return res;
}
function wmHexDirOf(dc, dr) {
  for (var d = 0; d < 6; d++) if (WMHEX_DC[d] === dc && WMHEX_DR[d] === dr) return d;
  return -1;
}
function wmHexMirror(d) { return (6 - d) % 6; }
function wmHexRange(c, r, k, N) {
  var res = [], rr, cc, r0 = r - k, r1 = r + k, c0, c1;
  if (r0 < 0) r0 = 0;
  if (r1 > N - 1) r1 = N - 1;
  c0 = c - k; c1 = c + k;
  if (c0 < 0) c0 = 0;
  if (c1 > N - 1) c1 = N - 1;
  for (rr = r0; rr <= r1; rr++)
    for (cc = c0; cc <= c1; cc++)
      if (wmHexDist(c, r, cc, rr) <= k) res.push(rr * N + cc);
  return res;
}
function wmHexRing(c, r, k, N) {
  var res = [], rr, cc, r0 = r - k, r1 = r + k, c0 = c - k, c1 = c + k;
  if (r0 < 0) r0 = 0;
  if (r1 > N - 1) r1 = N - 1;
  if (c0 < 0) c0 = 0;
  if (c1 > N - 1) c1 = N - 1;
  for (rr = r0; rr <= r1; rr++)
    for (cc = c0; cc <= c1; cc++)
      if (wmHexDist(c, r, cc, rr) === k) res.push(rr * N + cc);
  return res;
}
function wmHexGround(c, r) { return { x: WMHEX_GX * (c - r), y: 0.5 * (c + r) }; }
function wmHexRound(u, v) {
  var q = u - v, s = v, t = -q - s;
  var rq = Math.round(q), rs = Math.round(s), rt = Math.round(t);
  var dq = Math.abs(rq - q), ds = Math.abs(rs - s), dt = Math.abs(rt - t);
  if (dq > ds && dq > dt) rq = -rs - rt;
  else if (ds > dt) rs = -rq - rt;
  return { c: rq + rs, r: rs };
}
function wmHexLine(c0, r0, c1, r1) {
  var n = wmHexDist(c0, r0, c1, r1), res = [], i, t, p;
  if (n === 0) return [[c0, r0]];
  for (i = 0; i <= n; i++) {
    t = i / n;
    p = wmHexRound(c0 + (c1 - c0) * t + 1e-6, r0 + (r1 - r0) * t + 2e-6);
    res.push([p.c, p.r]);
  }
  return res;
}
function wmHexArt(d) {
  var e = WMHEX_ARTTAB[d];
  return e ? { dir: e.dir, mir: e.mir } : null;
}
