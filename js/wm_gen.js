// js/wm_gen.js — M1 大地圖世界生成 / 距離 / 去程(設計_M1視覺原型_實作計畫.md 第 3.1~3.3、3.6 節,W0;共享世界規格 4.1、5.1)。
// 純資料 + 純函式:不碰 DOM / 存檔、不讀時間、不用 Math.random(只吃 seed,同 seed 同圖);ES2017,不用 ?. ??;UTF-8 + CRLF。
// 載入順序:features.js 之後(index.html、sw.js PRECACHE 同步)。目前沒有任何遊戲程式引用;功能旗標 FEATURES.wmap 預設 false。
// 命名:本檔全域一律 wmg* / WMG_* / wmGen* / wmPath* / wmDist* / wmGo* / wmBack* ...;既有 js/wm_core.js、wm_ui.js、wm_data.js 是舊外勤(WM_CFG、wmNorm、wmDispatch、wmOpen…),新地圖程式不得沿用同名。
//
// ───────── 公開 API(W1 之後的人只靠這裡) ─────────
//   WMG_CFG    參數表:size 64(改成 160 即共享世界大小;全部參數化)、border 4、reach 24、goBase 1、goK 0.375、goMin 2、goMax 10、spd{騎 弓 槍 械 盾}、mode{steady 1, rush 0.67}…
//   WMG_K      格種類代號:{plain:0, mount:1, rock:2, river:3, ford:4, road:5, city:6, edge:7, yard:8, county:9, pass:10, jun:11};可走 = 0 / 4 / 5 / 6;可占領 = 只有 0
//   城池占地(gv 3,設計_地圖城池占地與美工_規格.md 第 1、2 節):縣 3×3 = k 9、郡 4×4 = k 11、關 = 兩側山壁 4 格 k 10 + 中間門道 2 格 k 5(道路,可通行,橫跨 3 沿路 2);城內格不可走、不可占領、不進 d(wmReach / wmCanTarget 皆 false),只有關的門道可通行。
//   每座城池外圍 1 圈 = 城郊(zone 2):山 / 大石 / 領地都不放。縣 / 郡四面有門,道路只接一面(= 主城門);出征一律打主城門前格 node.adj,node.gi = 主城門那一格(城內),存檔點 id = 'w' + node.gi。
//   WG.nodeOf = Int8Array(size²) 格 → 節點序號(城內 + 關門道;不屬於任何城池 = -1);WG.zone = Uint8Array(size²) 0 一般 / 1 城池占地(含門道)/ 2 城郊;WG.nfail = 放不下的原因(空 = 全放好)
//   WG.nodes = [{id, type:'county'|'jun'|'pass', ti:同類序號 0.., c0, r0, fw, fh:占地矩形, cells:[gi…]占地全部格(含門道), gates:[{side 0=r−1 1=c+1 2=r+1 3=c−1, gi:城內門格, out:門外格}…], mg:主城門在 gates 的索引, gi:主城門格, adj:主城門前格(道路), d:adj 的全圖路徑成本(有限), axis:只有關 0 = 道路沿 c、1 = 沿 r}]
//     縣 countyN(6)、郡 junN(2)、關 passN(3);縣依 6 扇區環繞主城(中心離主城 countyR 11~17),郡兩座相對(18~21),關前兩座跨在主城通邊的主路上、第 3 座靠邊另鋪路到邊界。
//   wmNodeAt(WG, gi) → node | null(查 nodeOf,O(1):點城內任何格 / 關門道都回該城池);道路網 = 主城 → 城池門前格的最小生成樹(A*,過河成橋)+ 原本主城 → 兩邊的路;道路格占可玩格 ≤ WMG_CFG.roadMax(8%)
//   主城足跡(H 形 7 格,2026-11-16 使用者決議):3×3 外框內左右兩直排各 3 格 + 正中央 1 格 = k 6(出發集合,d = 0);上下缺口 (中央欄, 上列) 與 (中央欄, 下列) 2 格 = 庭院 k 8(不可通行、不可占領、不計占領上限、不產生目標、d = Infinity)。
//   WMG_CITY_CELLS  7 格相對主城中心的 [dc, dr];WMG_CITY_YARD  2 格庭院 [dc, dr];WMG_CITY_BOX  3×3 外框 9 格(山 / 石 / 河 / 道路起點生成一律避讓整個外框)
//   wmCityCells(WG) → [gi×7](k=6,中心 c0 在內);wmCityYard(WG) → [gi×2];wmCityBox(WG) → [gi×9]
//   wmIsCity(WG, gi) → bool(k = 6);wmIsYard(WG, gi) → bool(k = 8);wmInCityBox(WG, gi) → bool(九宮格內,含庭院)
//   WMG_PIECES 拼塊 footprint:{M1, M2c, M2r, M3f, M3b, M3l, M3r, M4, O1} → [[dr, dc], …](與 tools/iso_tile_plan.js 同形狀與命名)
//   wmGen(seed, size?) → WG                    生成世界(同 seed 同結果);檢查失敗自動 seed+1 重試(≤ WMG_CFG.retry 次),仍失敗用 WMG_CFG.fallbackSeed
//       WG = { gv, size, seed /*實際使用*/, seed0 /*呼叫端給的*/, tries, fallback, border, cx, cy, c0 /*主城中心 gi*/,
//              k: Uint8Array(size²)    格種類(WMG_K),
//              g: Uint8Array(size²)    地面變體 0~2(依 hash),
//              pm: Int16Array(size²)   山 / 石格所屬拼塊序號(pcs 索引),無 = -1,
//              pcs: [{id:'M3l', gi:錨點}] 拼塊清單,錨點 = footprint 外框左上格(最小 r、最小 c)的 gi,格 = WMG_PIECES[id] 各 [dr, dc] 加上去,
//              nodes, nodeOf, zone, nfail  見上,
//              d: Float32Array(size²)  主城(3×3 任一格)到該格的路徑成本,成本 > reach 或不可達 = Infinity,主城格 = 0,
//              pv: Int32Array(size²)   Dijkstra 前驅格(回溯路徑用),無 = -1,
//              chk: {ok, reasons[], reachPlain, walkOk, pieceOk} }
//   wmGenCheck(WG) → {ok, reasons[], reachPlain /*成本 ≤ reach 的平地數*/, walkOk, pieceOk}   驗收條件(wmGen 內部已呼叫)
//   wmDistCalc(WG, maxCost?) → {d, pv}         重算距離(預設 WMG_CFG.reach;傳 Infinity = 全圖);8 方向、直 1 / 斜 1.414、斜走不切牆角;格成本 道路 ×0.5、淺灘 ×1.5(以進入格計)
//   wmReach(WG, gi) → bool                     成本有限(≤ reach 且可走)
//   wmCanTarget(WG, gi) → bool                 可當出征目標:平地(k = 0)且可達
//   wmPathCells(WG, gi) → [gi…] | null         主城邊格 → 目標格的逐格路徑(含兩端);不可達回 null
//   wmPathTurns(WG, gi) → [gi…] | null         同上但只留起點、轉折點、終點(存進 trip.path 的內容)
//   wmGoMins(cost, spd?, mode?) → 分鐘         去程 = clamp(2, 10, 1 + 0.375 × 成本 × 兵種 × 方式),四捨五入到 0.1;spd 可傳數字或 '騎' '弓' '槍' '械' '盾';mode 'steady'(預設)| 'rush'
//   wmBackMins(goMins) → 分鐘                  回程 = 去程 × 1/4(不四捨五入)
//   wmGenRing(cost) → 1~9                      圈 R = min(9, max(1, ceil(cost / 2.7)))(決定等級帶用,共享世界規格 3.6)
//   wmGi(c, r, size) → gi                      gi = r × size + c;wmXY(gi, size) → {c, r}
//   wmGenHash(seed, a, b) → uint32             確定性雜湊;wmGenHash01(seed, a, b) → [0, 1)
// 例:wmGoMins(1)=2.0(相鄰夾 2)、wmGoMins(8)=4.0、wmGoMins(24)=10.0;沿道路每格成本 0.5。

var WMG_CFG = {
  size: 64, border: 4, reach: 24, keep: 4,          // 世界邊長;邊界帶格數(不可點不可走);可達成本上限;主城外保留平地圈(切比雪夫距離 ≤ keep)
  gv: 3,                                            // 生成器版本(改演算法就遞增;存檔記錄,不同 = 重新生成)
  mtnCount: 40, mtnRef: 3136,                       // 山拼塊數 40 / 3136 個可玩格(64×64 扣邊界帶 = 56×56);其他尺寸按可玩格數等比例
  mtnW: [['M1', 3], ['M2c', 1.5], ['M2r', 1.5], ['M3f', 1], ['M3b', 1], ['M3l', 1], ['M3r', 1], ['M4', 2]],   // 拼塊權重
  rockP: 0.02,                                      // 大石散佈機率(平地格)
  riverGap: 7, fordEvery: 11,                       // 河與主城的最小距離;每 11 格一個淺灘
  minPlain: 900, retry: 5, fallbackSeed: 20261116,  // 成本 ≤ reach 的可達平地下限;重試次數;保底種子
  goBase: 1, goK: 0.375, goMin: 2, goMax: 10, backDiv: 4,
  spd: { '騎': 0.85, '弓': 1.0, '槍': 1.0, '械': 1.25, '謀': 1.05, '盾': 1.10 },
  mode: { steady: 1, rush: 0.67 },
  ringDiv: 2.7,
  countyN: 6, passN: 3, junN: 2, countyR: [11, 17], junR: [18, 21], gapE: 3, ring: 1, roadMax: 0.08,   // 縣數、關數、郡數、縣 / 郡中心離主城格數範圍、城池間最小間隔(占地矩形邊對邊空 3 格)、城郊圈數、道路格占可玩格上限
  fp: { county: [3, 3], jun: [4, 4], pass: [2, 3] }   // 占地 [fw, fh];關 = [沿路, 橫跨](axis 1 時對調)
};
var WMG_K = { plain: 0, mount: 1, rock: 2, river: 3, ford: 4, road: 5, city: 6, edge: 7, yard: 8, county: 9, pass: 10, jun: 11 };
var WMG_CITY_CELLS = [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1], [0, 0]];   // [dc, dr]:左右兩直排各 3 格 + 中央
var WMG_CITY_YARD = [[0, -1], [0, 1]];                                                // 庭院缺口(上、下)
var WMG_CITY_BOX = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
var WMG_PIECES = {
  M1: [[0, 0]], M2c: [[0, 0], [0, 1]], M2r: [[0, 0], [1, 0]],
  M3f: [[0, 0], [0, 1], [1, 0]], M3b: [[0, 1], [1, 0], [1, 1]], M3l: [[0, 0], [0, 1], [1, 1]], M3r: [[0, 0], [1, 0], [1, 1]],
  M4: [[0, 0], [0, 1], [1, 0], [1, 1]], O1: [[0, 0]]
};
var WMG_DX8 = [1, -1, 0, 0, 1, 1, -1, -1], WMG_DY8 = [0, 0, 1, -1, 1, -1, 1, -1];

// ───────── 雜湊 / 亂數 / 雜訊 ─────────
function wmGenHash(seed, a, b) {
  var h = (seed ^ 0x9e3779b9) | 0;
  h = Math.imul(h ^ (a | 0), 0x85ebca6b); h ^= h >>> 13;
  h = Math.imul(h ^ (b | 0), 0xc2b2ae35); h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 15;
  return h >>> 0;
}
function wmGenHash01(seed, a, b) { return wmGenHash(seed, a, b) / 4294967296; }
function wmgRng(seed) {   // mulberry32
  var a = seed >>> 0;
  return function () {
    var t;
    a = (a + 0x6D2B79F5) >>> 0;
    t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function wmgNoise(seed, x, y, sc) {   // 值雜訊,格距 sc
  var fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, s = seed ^ (sc * 0x2545), a, b, c, d;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  a = wmGenHash01(s, x0, y0); b = wmGenHash01(s, x0 + 1, y0); c = wmGenHash01(s, x0, y0 + 1); d = wmGenHash01(s, x0 + 1, y0 + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function wmgFbm(seed, x, y) { return 0.55 * wmgNoise(seed, x, y, 24) + 0.30 * wmgNoise(seed, x, y, 11) + 0.15 * wmgNoise(seed, x, y, 5); }

// ───────── 小工具 ─────────
function wmGi(c, r, size) { return r * size + c; }
function wmXY(gi, size) { var c = gi % size; return { c: c, r: (gi - c) / size }; }
function wmgWalk(k) { return k === 0 || k === 4 || k === 5 || k === 6; }
function wmgMul(k) { return k === 5 ? 0.5 : (k === 4 ? 1.5 : 1); }
function wmgHeap() {   // 最小堆積(鍵, 值);允許重複值(惰性刪除)
  var K = [], V = [];
  return {
    size: function () { return K.length; },
    push: function (key, val) {
      var i = K.length, p;
      K.push(key); V.push(val);
      while (i > 0) {
        p = (i - 1) >> 1;
        if (K[p] <= K[i]) break;
        t2(i, p); i = p;
      }
    },
    pop: function () {
      var top = V[0], lk = K.pop(), lv = V.pop(), i = 0, a, b, m, n = K.length;
      if (n) {
        K[0] = lk; V[0] = lv;
        for (;;) {
          a = 2 * i + 1; b = a + 1; m = i;
          if (a < n && K[a] < K[m]) m = a;
          if (b < n && K[b] < K[m]) m = b;
          if (m === i) break;
          t2(i, m); i = m;
        }
      }
      return top;
    }
  };
  function t2(i, j) { var tk = K[i], tv = V[i]; K[i] = K[j]; V[i] = V[j]; K[j] = tk; V[j] = tv; }
}

// ───────── 距離(Dijkstra,多源 = 主城 7 格) ─────────
// 回 {d: Float32Array, pv: Int32Array};成本 > maxCost 的格不展開(d = Infinity)。進入格的成本 = 步長(1 / 1.414)× 該格倍率。
function wmDistCalc(WG, maxCost) {
  var N = WG.size, n = N * N, k = WG.k, dist = new Float64Array(n), pv = new Int32Array(n), d32 = new Float32Array(n), done = new Uint8Array(n), h = wmgHeap(), i, u, ux, uy, j, x, y, v, w, nd;
  if (!(maxCost >= 0)) maxCost = WMG_CFG.reach;
  for (i = 0; i < n; i++) { dist[i] = Infinity; pv[i] = -1; }
  for (i = 0; i < n; i++) if (k[i] === 6) { dist[i] = 0; h.push(0, i); }
  while (h.size()) {
    u = h.pop();
    if (done[u]) continue;
    done[u] = 1;
    ux = u % N; uy = (u - ux) / N;
    nd = dist[u];
    for (j = 0; j < 8; j++) {
      x = ux + WMG_DX8[j]; y = uy + WMG_DY8[j];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      v = y * N + x;
      if (!wmgWalk(k[v])) continue;
      if (j >= 4 && (!wmgWalk(k[uy * N + x]) || !wmgWalk(k[y * N + ux]))) continue;   // 斜走不切牆角
      w = nd + (j >= 4 ? 1.4142135623730951 : 1) * wmgMul(k[v]);
      if (w > maxCost || w >= dist[v]) continue;
      dist[v] = w; pv[v] = u; h.push(w, v);
    }
  }
  for (i = 0; i < n; i++) d32[i] = dist[i];
  return { d: d32, pv: pv };
}
function wmCityCells(WG) { return WMG_CITY_CELLS.map(function (o) { return (WG.cy + o[1]) * WG.size + WG.cx + o[0]; }); }
function wmCityYard(WG) { return WMG_CITY_YARD.map(function (o) { return (WG.cy + o[1]) * WG.size + WG.cx + o[0]; }); }
function wmCityBox(WG) { return WMG_CITY_BOX.map(function (o) { return (WG.cy + o[1]) * WG.size + WG.cx + o[0]; }); }
function wmIsCity(WG, gi) { return gi >= 0 && gi < WG.k.length && WG.k[gi] === 6; }
function wmIsYard(WG, gi) { return gi >= 0 && gi < WG.k.length && WG.k[gi] === 8; }
function wmInCityBox(WG, gi) {
  var N = WG.size, c, r;
  if (!(gi >= 0 && gi < N * N)) return false;
  c = gi % N; r = (gi - c) / N;
  return Math.abs(c - WG.cx) <= 1 && Math.abs(r - WG.cy) <= 1;
}
function wmNodeAt(WG, gi) {
  var i;
  if (!WG.nodes) return null;
  if (WG.nodeOf) { i = gi >= 0 && gi < WG.nodeOf.length ? WG.nodeOf[gi] : -1; return i >= 0 ? (WG.nodes[i] || null) : null; }
  for (i = 0; i < WG.nodes.length; i++) if (WG.nodes[i].gi === gi) return WG.nodes[i];
  return null;
}
function wmReach(WG, gi) { return gi >= 0 && gi < WG.d.length && isFinite(WG.d[gi]) && WG.k[gi] !== 6 && WG.k[gi] !== 8; }
function wmCanTarget(WG, gi) { return wmReach(WG, gi) && WG.k[gi] === 0; }
function wmPathCells(WG, gi) {
  var out = [], cur = gi, guard = WG.d.length + 2;
  if (!(gi >= 0 && gi < WG.d.length) || !isFinite(WG.d[gi]) || WG.k[gi] === 6 || WG.k[gi] === 8) return null;
  while (cur >= 0 && guard-- > 0) { out.push(cur); cur = WG.pv[cur]; }
  out.reverse();
  return out;
}
function wmPathTurns(WG, gi) {
  var p = wmPathCells(WG, gi), N = WG.size, out, i, dx0, dy0, dx1, dy1;
  if (!p) return null;
  if (p.length <= 2) return p;
  out = [p[0]];
  dx0 = (p[1] % N) - (p[0] % N); dy0 = Math.floor(p[1] / N) - Math.floor(p[0] / N);
  for (i = 1; i < p.length - 1; i++) {
    dx1 = (p[i + 1] % N) - (p[i] % N); dy1 = Math.floor(p[i + 1] / N) - Math.floor(p[i] / N);
    if (dx1 !== dx0 || dy1 !== dy0) out.push(p[i]);
    dx0 = dx1; dy0 = dy1;
  }
  out.push(p[p.length - 1]);
  return out;
}

// ───────── 去程 / 回程 ─────────
function wmGoMins(cost, spd, mode) {
  var C = WMG_CFG, s = typeof spd === 'string' ? C.spd[spd] : spd, m = C.mode[mode], v;
  if (!(s > 0)) s = 1;
  if (!(m > 0)) m = 1;
  cost = Number(cost);
  if (!isFinite(cost) || cost < 0) cost = 0;
  v = C.goBase + C.goK * cost * s * m;
  v = Math.max(C.goMin, Math.min(C.goMax, v));
  return Math.round(v * 10) / 10;
}
function wmBackMins(goMins) { return Number(goMins) / WMG_CFG.backDiv; }
function wmGenRing(cost) { return Math.min(9, Math.max(1, Math.ceil(Number(cost) / WMG_CFG.ringDiv))); }

// ───────── 驗收 ─────────
function wmGenCheck(WG) {
  var N = WG.size, n = N * N, k = WG.k, pm = WG.pm, reasons = [], seen = new Uint8Array(n), q = new Int32Array(n), qh = 0, qt = 0, i, u, ux, uy, j, x, y, v, walkOk = true, pieceOk = true, reachPlain = 0, own, pc, cells, ci, gi2, cnt = new Uint8Array(n), r0, c0, dr, dc, ii;
  // 1 主城可走格泛洪(4 向):所有可走格都到得了
  seen[WG.c0] = 1; q[qt++] = WG.c0;
  while (qh < qt) {
    u = q[qh++]; ux = u % N; uy = (u - ux) / N;
    for (j = 0; j < 4; j++) {
      x = ux + WMG_DX8[j]; y = uy + WMG_DY8[j];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      v = y * N + x;
      if (seen[v] || !wmgWalk(k[v])) continue;
      seen[v] = 1; q[qt++] = v;
    }
  }
  for (i = 0; i < n; i++) if (wmgWalk(k[i]) && !seen[i]) { walkOk = false; break; }
  if (!walkOk) reasons.push('有可走格主城到不了');
  // 2 拼塊:每個山 / 石格屬於恰一個拼塊,拼塊 footprint 與格種類吻合、不重疊
  for (i = 0; i < WG.pcs.length; i++) {
    pc = WG.pcs[i]; cells = WMG_PIECES[pc.id];
    if (!cells) { pieceOk = false; break; }
    r0 = Math.floor(pc.gi / N); c0 = pc.gi % N;
    for (ci = 0; ci < cells.length; ci++) {
      dr = r0 + cells[ci][0]; dc = c0 + cells[ci][1];
      if (dr >= N || dc >= N) { pieceOk = false; break; }
      gi2 = dr * N + dc; cnt[gi2]++;
      if (pm[gi2] !== i || k[gi2] !== (pc.id === 'O1' ? 2 : 1)) pieceOk = false;
    }
  }
  for (i = 0; i < n; i++) {
    own = k[i] === 1 || k[i] === 2;
    ii = cnt[i];
    if (own ? ii !== 1 : (ii !== 0 || pm[i] !== -1)) { pieceOk = false; break; }
  }
  if (!pieceOk) reasons.push('山 / 石格與拼塊不吻合或重疊');
  // 3 主城可達(成本 ≤ reach)平地數
  for (i = 0; i < n; i++) if (k[i] === 0 && isFinite(WG.d[i])) reachPlain++;
  if (reachPlain < WMG_CFG.minPlain) reasons.push('可達平地 ' + reachPlain + ' < ' + WMG_CFG.minPlain);
  // 4 城池:放得下(數量)、每座主城門前格主城到得了
  if (WG.nfail && WG.nfail.length) for (i = 0; i < WG.nfail.length; i++) reasons.push(WG.nfail[i]);
  if (WG.nodes) {
    if (WG.nodes.length !== WMG_CFG.countyN + WMG_CFG.junN + WMG_CFG.passN) reasons.push('城池數量 ' + WG.nodes.length);
    for (i = 0; i < WG.nodes.length; i++) if (!(WG.nodes[i].adj >= 0 && isFinite(WG.nodes[i].d))) { reasons.push('城池 ' + i + ' 主城到不了'); break; }
  }
  return { ok: reasons.length === 0, reasons: reasons, reachPlain: reachPlain, walkOk: walkOk, pieceOk: pieceOk };
}

// ───────── 生成(一次) ─────────
var wmgRP = { n: 0 };   // A* 暫存緩衝(同尺寸重用,每次呼叫前重設)
function wmgRoadPath(k, N, seed, sx, sy, tx, ty) {   // 4 向 A*;平地 1(+雜湊擾動)、道路 0.3、淺灘 2、河 8、主城 / 邊界不可走
  var n = N * N, S = wmgRP.n === n ? wmgRP : (wmgRP = { n: n, gs: new Float64Array(n), pr: new Int32Array(n), done: new Uint8Array(n) }), gs = S.gs, pr = S.pr, done = S.done, h = wmgHeap(), si = sy * N + sx, ti = ty * N + tx, i, u, ux, uy, j, x, y, v, kk, cost, nd, out, cur;
  gs.fill(Infinity); pr.fill(-1); done.fill(0);
  gs[si] = 0; h.push(0.8 * (Math.abs(sx - tx) + Math.abs(sy - ty)), si);
  while (h.size()) {
    u = h.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === ti) break;
    ux = u % N; uy = (u - ux) / N;
    for (j = 0; j < 4; j++) {
      x = ux + WMG_DX8[j]; y = uy + WMG_DY8[j];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      v = y * N + x; kk = k[v];
      if (kk === 6 || kk === 7 || kk === 8 || kk === 1 || kk === 2 || kk === 9 || kk === 10 || kk === 11) continue;
      cost = kk === 5 ? 0.3 : (kk === 3 ? 8 : (kk === 4 ? 2 : 1 + 0.6 * wmGenHash01(seed, v, 11)));
      nd = gs[u] + cost;
      if (nd < gs[v]) { gs[v] = nd; pr[v] = u; h.push(nd + 0.8 * (Math.abs(x - tx) + Math.abs(y - ty)), v); }
    }
  }
  if (!done[ti]) return null;
  out = []; cur = ti;
  while (cur >= 0) { out.push(cur); cur = pr[cur]; }
  return out;
}
function wmgNodeAdj(WG) {   // 每座城池:全圖 Dijkstra(不受 reach 限制)→ 主城門 / 門前格 adj / d;關的主城門 = 門外格 d 較小的那一端(朝主城)
  var all = wmDistCalc(WG, Infinity).d, i, j, nd, g, best, bd;
  for (i = 0; i < WG.nodes.length; i++) {
    nd = WG.nodes[i];
    if (nd.type === 'pass' || nd.mg < 0) {
      best = 0; bd = Infinity;
      for (j = 0; j < nd.gates.length; j++) if (all[nd.gates[j].out] < bd) { bd = all[nd.gates[j].out]; best = j; }
      nd.mg = best;
    }
    g = nd.gates[nd.mg];
    nd.gi = g.gi; nd.adj = g.out; nd.d = all[g.out];
  }
}
function wmgBuild(seed, N) {
  var C = WMG_CFG, B = C.border, n = N * N, k = new Uint8Array(n), g = new Uint8Array(n), pm = new Int16Array(n), pcs = [], rng = wmgRng(seed),
    nodesOut = null, zone = new Uint8Array(n), nodeOf = new Int8Array(n), nfail = [], mainPaths = [], cx = N >> 1, cy = N >> 1, c0 = cy * N + cx, lo = B, hi = N - 1 - B, i, x, y, dx, dy, WG, r, t;
  for (i = 0; i < n; i++) {
    x = i % N; y = (i - x) / N;
    pm[i] = -1; nodeOf[i] = -1; g[i] = wmGenHash(seed, i, 3) % 3;
    if (x < B || y < B || x > hi || y > hi) k[i] = 7;
  }
  for (i = 0; i < WMG_CITY_CELLS.length; i++) k[(cy + WMG_CITY_CELLS[i][1]) * N + cx + WMG_CITY_CELLS[i][0]] = 6;
  for (i = 0; i < WMG_CITY_YARD.length; i++) k[(cy + WMG_CITY_YARD[i][1]) * N + cx + WMG_CITY_YARD[i][0]] = 8;
  function keep(gx, gy) { return Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) <= C.keep; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function addPiece(id, gi) {
    var cells = WMG_PIECES[id], r0 = Math.floor(gi / N), c0b = gi % N, m, q, idx = pcs.length;
    pcs.push({ id: id, gi: gi });
    for (m = 0; m < cells.length; m++) { q = (r0 + cells[m][0]) * N + c0b + cells[m][1]; k[q] = id === 'O1' ? 2 : 1; pm[q] = idx; }
  }

  // 1 河:一條,從可玩區一邊走到對邊(4 向連通,偏向低處),離主城 ≥ riverGap,每 fordEvery 格一個淺灘
  (function () {
    var vert = rng() < 0.5, side = rng() < 0.5 ? 1 : -1, a, b, rlo, rhi, db, nb, hl, hh, list = [], gx, gy, step;
    if (side > 0) { rlo = cx + C.riverGap; rhi = hi; } else { rlo = lo; rhi = cx - C.riverGap; }
    b = clamp(cx + side * (9 + Math.floor(rng() * 12)), rlo, rhi);
    function mark(aa, bb) { gx = vert ? bb : aa; gy = vert ? aa : bb; var q = gy * N + gx; if (k[q] === 0) { k[q] = 3; list.push(q); } }
    for (a = lo; a <= hi; a++) {
      db = 0;
      if (rng() < 0.45) {
        hl = wmgFbm(seed, vert ? b - 1 : a, vert ? a : b - 1); hh = wmgFbm(seed, vert ? b + 1 : a, vert ? a : b + 1);
        db = hl < hh ? -1 : 1;
        if (rng() < 0.25) db = -db;
      }
      nb = b + db;
      if (nb < rlo || nb > rhi) { db = 0; nb = b; }
      mark(a, b);
      if (db) mark(a, nb);
      b = nb;
    }
    for (step = C.fordEvery - 1; step < list.length; step += C.fordEvery) k[list[step]] = 4;
  })();

  // 2 道路:主城 → 兩個邊(一條東西向、一條南北向;起點一律貼著主城左右兩直排的外側,庭院上下不出路),A*;過河的河格變橋(道路),原淺灘維持淺灘
  (function () {
    var starts = [[cx + 2, cy, hi, null], [cx - 2, cy, lo, null], [cx + 2, cy + 1, null, hi], [cx - 2, cy - 1, null, lo]], ew = rng() < 0.5 ? 0 : 1, ns = rng() < 0.5 ? 2 : 3, pick = [ew, ns], p, s, tx, ty, path, m, q;
    for (p = 0; p < 2; p++) {
      s = starts[pick[p]];
      tx = s[2] !== null ? s[2] : clamp(cx + Math.floor(rng() * 25) - 12, lo, hi);
      ty = s[3] !== null ? s[3] : clamp(cy + Math.floor(rng() * 25) - 12, lo, hi);
      path = wmgRoadPath(k, N, seed, s[0], s[1], tx, ty);
      if (!path) continue;
      mainPaths.push(path);
      for (m = 0; m < path.length; m++) { q = path[m]; if (k[q] === 0 || k[q] === 3) k[q] = 5; }
    }
  })();

  // 2b 縣 / 郡 / 關(gv 3):占地矩形 + 外圍 1 圈城郊(zone 2)。先放關(前兩座跨在兩條通邊主路上、第 3 座靠邊另鋪路到邊界),再放郡、縣;
  //    道路網 = 主城 → 各城池「門前格」的最小生成樹(A*,過河成橋):縣 / 郡四面有門只接一面(= 主城門),關的門道本身就是道路
  (function () {
    var nodes = [], FP = C.fp, npass = 0, h01 = function (a1, b1) { return wmGenHash01(seed, a1, b1 + 700); }, p, pa, j, c, a, rr, tx, ty, tries, R, R2, m, q, d, bd, bi, bj, inN, conn, pt, sp, ports, cl, path, s0, o0, fr, e, d1, d2, dir, ax, cc0, rr0, ord = { county: 0, jun: 1, pass: 2 };
    function mk(type, c0b, r0, axis) {
      var f = FP[type], sw = type === 'pass' && axis === 1;
      return { type: type, c0: c0b, r0: r0, fw: sw ? f[1] : f[0], fh: sw ? f[0] : f[1], axis: type === 'pass' ? axis : -1 };
    }
    function gatesOf(Q) {   // 門格 = 該邊第 floor((n−1)/2) 格;關只有門道兩端
      var mc, mr;
      if (Q.type === 'pass') {
        if (Q.axis === 0) { mr = Q.r0 + 1; return [{ side: 3, c: Q.c0, r: mr, oc: Q.c0 - 1, ro: mr }, { side: 1, c: Q.c0 + 1, r: mr, oc: Q.c0 + 2, ro: mr }]; }
        mc = Q.c0 + 1; return [{ side: 0, c: mc, r: Q.r0, oc: mc, ro: Q.r0 - 1 }, { side: 2, c: mc, r: Q.r0 + 1, oc: mc, ro: Q.r0 + 2 }];
      }
      mc = Q.c0 + Math.floor((Q.fw - 1) / 2); mr = Q.r0 + Math.floor((Q.fh - 1) / 2);
      return [{ side: 0, c: mc, r: Q.r0, oc: mc, ro: Q.r0 - 1 }, { side: 1, c: Q.c0 + Q.fw - 1, r: mr, oc: Q.c0 + Q.fw, ro: mr },
        { side: 2, c: mc, r: Q.r0 + Q.fh - 1, oc: mc, ro: Q.r0 + Q.fh }, { side: 3, c: Q.c0, r: mr, oc: Q.c0 - 1, ro: mr }];
    }
    function edgeD(gi) { var gx = gi % N, gy = (gi - gx) / N; return Math.min(gx - lo, hi - gx, gy - lo, hi - gy); }
    function canPlace(Q, free5) {   // 占地 + 城郊都在 lo+1..hi−1 內、全是平地(free5 內的道路格除外)、不碰主城保留圈與其他城池、與其他城池空 ≥ gapE 格
      var gx, gy, gi, kk, j2, z;
      if (Q.c0 - C.ring < lo + 1 || Q.r0 - C.ring < lo + 1 || Q.c0 + Q.fw - 1 + C.ring > hi - 1 || Q.r0 + Q.fh - 1 + C.ring > hi - 1) return false;
      for (gy = Q.r0 - C.ring; gy <= Q.r0 + Q.fh - 1 + C.ring; gy++) for (gx = Q.c0 - C.ring; gx <= Q.c0 + Q.fw - 1 + C.ring; gx++) {
        gi = gy * N + gx; kk = k[gi];
        if (keep(gx, gy) || zone[gi]) return false;
        if (kk !== 0 && !(kk === 5 && free5 && free5[gi])) return false;
      }
      for (j2 = 0; j2 < nodes.length; j2++) {
        z = nodes[j2];
        if (Math.max(Q.c0 - (z.c0 + z.fw - 1), z.c0 - (Q.c0 + Q.fw - 1), Q.r0 - (z.r0 + z.fh - 1), z.r0 - (Q.r0 + Q.fh - 1)) < C.gapE + 1) return false;
      }
      return true;
    }
    function put(Q) {
      var gx, gy, gi, kv = Q.type === 'county' ? 9 : (Q.type === 'jun' ? 11 : 10), g, door = {};
      Q.g = gatesOf(Q); Q.cells = []; Q.mg = -1;
      if (Q.type === 'pass') for (g = 0; g < Q.g.length; g++) door[Q.g[g].r * N + Q.g[g].c] = 1;
      for (gy = Q.r0; gy < Q.r0 + Q.fh; gy++) for (gx = Q.c0; gx < Q.c0 + Q.fw; gx++) { gi = gy * N + gx; k[gi] = door[gi] ? 5 : kv; zone[gi] = 1; Q.cells.push(gi); }
      for (gy = Q.r0 - C.ring; gy <= Q.r0 + Q.fh - 1 + C.ring; gy++) for (gx = Q.c0 - C.ring; gx <= Q.c0 + Q.fw - 1 + C.ring; gx++) { gi = gy * N + gx; if (!zone[gi]) zone[gi] = 2; }
      nodes.push(Q);
      return Q;
    }
    function spiral(type, c0b, r0, axis, rad, free5) {   // 目標附近螺旋找可放的位置
      var rd, ox, oy, Q;
      for (rd = 0; rd <= rad; rd++) for (oy = -rd; oy <= rd; oy++) for (ox = -rd; ox <= rd; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== rd) continue;
        Q = mk(type, c0b + ox, r0 + oy, axis);
        if (canPlace(Q, free5)) return Q;
      }
      return null;
    }
    function lay(pth) { var z; for (z = 0; z < pth.length; z++) if (k[pth[z]] === 0 || k[pth[z]] === 3) k[pth[z]] = 5; }

    // 關 1~2:沿兩條主路(path[0] = 邊界端)從外往內找「門外 1 + 門道 2 + 門外 1」連續 4 格同向的直段,外端門外格離可玩區邊 1 起,最遠 14 格(1~4 優先)
    for (p = 0; p < mainPaths.length; p++) {
      pa = mainPaths[p]; R = null;
      for (j = 1; j + 3 < pa.length && !R; j++) {
        e = edgeD(pa[j]);
        if (e > 14) break;
        if (e < 1) continue;
        d1 = pa[j + 1]; d2 = pa[j + 2];
        if (d1 - pa[j] !== d2 - d1 || pa[j + 3] - d2 !== d2 - d1) continue;
        ax = Math.abs(d2 - d1) === 1 ? 0 : 1;
        if (ax === 0) { cc0 = Math.min(d1 % N, d2 % N); rr0 = Math.floor(d1 / N) - 1; } else { cc0 = d1 % N - 1; rr0 = Math.min(Math.floor(d1 / N), Math.floor(d2 / N)); }
        fr = {}; fr[pa[j]] = 1; fr[d1] = 1; fr[d2] = 1; fr[pa[j + 3]] = 1;
        R2 = mk('pass', cc0, rr0, ax);
        if (canPlace(R2, fr)) R = R2;
      }
      if (R) { put(R); R.ti = npass++; }
    }
    // 關(其餘):靠邊的雜湊角度;軸 = 最近邊界方向;外端門外格離邊 2~3 格,另鋪一條路到邊界
    for (tries = 0; npass < C.passN && tries < 12; tries++) {
      a = h01(tries, 3) * 2 * Math.PI;
      tx = Math.max(lo + 3, Math.min(hi - 3, Math.round(cx + Math.cos(a) * 60))); ty = Math.max(lo + 3, Math.min(hi - 3, Math.round(cy + Math.sin(a) * 60)));
      d1 = tx - lo; d2 = hi - tx; e = ty - lo; dir = hi - ty; q = Math.min(d1, d2, e, dir);
      m = 2 + (h01(tries, 4) < 0.5 ? 0 : 1);   // 外端門外格離邊 2 或 3
      if (q === d1) { ax = 0; cc0 = lo + m + 1; rr0 = ty - 1; }
      else if (q === d2) { ax = 0; cc0 = hi - m - 2; rr0 = ty - 1; }
      else if (q === e) { ax = 1; cc0 = tx - 1; rr0 = lo + m + 1; }
      else { ax = 1; cc0 = tx - 1; rr0 = hi - m - 2; }
      R = null;
      for (j = 0; j <= 6 && !R; j++) for (c = -j; c <= j && !R; c++) for (q = -j; q <= j && !R; q++) {
        if (Math.max(Math.abs(c), Math.abs(q)) !== j) continue;
        R2 = mk('pass', cc0 + c, rr0 + q, ax); R2.g = gatesOf(R2); fr = {};
        R2.g.forEach(function (g) { fr[g.r * N + g.c] = 1; fr[g.ro * N + g.oc] = 1; });
        if (canPlace(R2, fr)) R = R2;
      }
      if (!R) continue;
      put(R); R.ti = npass++;
      s0 = edgeD(R.g[0].ro * N + R.g[0].oc) <= edgeD(R.g[1].ro * N + R.g[1].oc) ? R.g[0] : R.g[1];   // 外端 = 離邊近的那一端
      tx = s0.side === 3 ? lo : (s0.side === 1 ? hi : s0.oc); ty = s0.side === 0 ? lo : (s0.side === 2 ? hi : s0.ro);
      path = wmgRoadPath(k, N, seed, s0.oc, s0.ro, tx, ty);
      if (path) lay(path); else nfail.push('關 ' + R.ti + ' 外端鋪不到邊界');
    }
    while (npass < C.passN) { nfail.push('關放不下'); npass++; }
    // 郡:兩座相對(a0 與 a0 + π),中心離主城 junR
    for (j = 0; j < C.junN; j++) {
      a = h01(0, 5) * 2 * Math.PI + j * Math.PI;
      rr = C.junR[0] + h01(j, 6) * (C.junR[1] - C.junR[0]);
      R = spiral('jun', Math.round(cx + Math.cos(a) * rr) - 1, Math.round(cy + Math.sin(a) * rr) - 1, 0, 6, null);
      if (R) { put(R); R.ti = j; } else nfail.push('郡 ' + j + ' 放不下');
    }
    // 縣:6 個扇區環繞主城,角度加抖動,中心離主城 countyR
    for (c = 0; c < C.countyN; c++) {
      a = ((c + 0.2 + 0.6 * h01(c, 1)) / C.countyN) * 2 * Math.PI;
      rr = C.countyR[0] + h01(c, 2) * (C.countyR[1] - C.countyR[0]);
      R = spiral('county', Math.round(cx + Math.cos(a) * rr) - 1, Math.round(cy + Math.sin(a) * rr) - 1, 0, 6, null);
      if (R) { put(R); R.ti = c; } else nfail.push('縣 ' + c + ' 放不下');
    }
    // 道路網:Prim 最小生成樹(主城為根)。每座城池挑「已連上的接路格 → 門外格」曼哈頓距離最近的一組,A* 鋪到門外格;那一門 = 主城門
    ports = [[cx + 2, cy], [cx - 2, cy], [cx + 2, cy + 1], [cx - 2, cy + 1], [cx + 2, cy - 1], [cx - 2, cy - 1]].filter(function (z) { return wmgWalk(k[z[1] * N + z[0]]); });
    conn = [{ city: true, type: 'city', src: ports.length ? ports : [[cx + 2, cy]] }];
    inN = nodes.slice();
    while (inN.length) {
      bd = Infinity; bi = -1; bj = -1;
      for (m = 0; m < inN.length; m++) for (q = 0; q < conn.length; q++) {
        d = Infinity;
        for (j = 0; j < conn[q].src.length; j++) for (c = 0; c < inN[m].g.length; c++) d = Math.min(d, Math.abs(conn[q].src[j][0] - inN[m].g[c].oc) + Math.abs(conn[q].src[j][1] - inN[m].g[c].ro));
        if (conn[q].city) d += 4;   // 主城端偏好縣連主城、關接縣
        if (inN[m].type === 'pass' && conn[q].type === 'pass') d += 6;
        if (d < bd) { bd = d; bi = m; bj = q; }
      }
      pt = inN.splice(bi, 1)[0]; sp = conn[bj];
      cl = [];
      for (j = 0; j < sp.src.length; j++) for (c = 0; c < pt.g.length; c++) cl.push({ d: Math.abs(sp.src[j][0] - pt.g[c].oc) + Math.abs(sp.src[j][1] - pt.g[c].ro), s: j, g: c });
      cl.sort(function (u, v) { return u.d - v.d || u.g - v.g || u.s - v.s; });
      path = null;
      for (m = 0; m < cl.length && m < 8 && !path; m++) {
        path = wmgRoadPath(k, N, seed, sp.src[cl[m].s][0], sp.src[cl[m].s][1], pt.g[cl[m].g].oc, pt.g[cl[m].g].ro);
        if (path) { lay(path); pt.mg = cl[m].g; }
      }
      if (!path) nfail.push((pt.type === 'pass' ? '關 ' : (pt.type === 'jun' ? '郡 ' : '縣 ')) + pt.ti + ' 鋪不到路');
      conn.push({ type: pt.type, src: pt.type === 'pass' || pt.mg < 0 ? pt.g.map(function (g) { return [g.oc, g.ro]; }) : [[pt.g[pt.mg].oc, pt.g[pt.mg].ro]] });
    }
    for (j = 0; j < nodes.length; j++) if (nodes[j].type === 'pass') for (c = 0; c < 2; c++) { q = nodes[j].g[c].ro * N + nodes[j].g[c].oc; if (k[q] === 0) k[q] = 5; }   // 關兩端門外格一定是路
    // 輸出:縣 → 郡 → 關,同類依 ti;id = 序號
    nodes.sort(function (u, v) { return ord[u.type] - ord[v.type] || u.ti - v.ti; });
    nodesOut = nodes.map(function (z, idx) {
      var o = { id: idx, type: z.type, ti: z.ti, c0: z.c0, r0: z.r0, fw: z.fw, fh: z.fh, cells: z.cells, gates: z.g.map(function (g) { return { side: g.side, gi: g.r * N + g.c, out: g.ro * N + g.oc }; }), mg: z.mg, gi: -1, adj: -1, d: Infinity }, u;
      if (z.type === 'pass') o.axis = z.axis;
      for (u = 0; u < o.cells.length; u++) nodeOf[o.cells[u]] = idx;
      return o;
    });
  })();

  // 3 山:依值雜訊高處蓋拼塊章(不重疊、只蓋平地、避開主城保留圈與邊界帶);每個山格必屬於某一拼塊
  (function () {
    var area = (N - 2 * B) * (N - 2 * B), want = Math.max(1, Math.round(C.mtnCount * area / C.mtnRef)), maxTry = want * 120, tries = 0, placed = 0, W = C.mtnW, wsum = 0, j, pick, id, cells, r0, c0b, ok, m, q, thr, h, rr, cc;
    for (j = 0; j < W.length; j++) wsum += W[j][1];
    while (placed < want && tries < maxTry) {
      tries++;
      rr = rng() * wsum; id = W[0][0];
      for (j = 0; j < W.length; j++) { rr -= W[j][1]; if (rr < 0) { id = W[j][0]; break; } }
      r0 = lo + Math.floor(rng() * (hi - lo)); c0b = lo + Math.floor(rng() * (hi - lo));
      thr = 0.6 - 0.15 * tries / maxTry;
      h = wmgFbm(seed, c0b + 0.5, r0 + 0.5);
      if (h < thr) continue;
      cells = WMG_PIECES[id]; ok = true;
      for (m = 0; m < cells.length; m++) {
        rr = r0 + cells[m][0]; cc = c0b + cells[m][1];
        if (rr > hi || cc > hi || k[rr * N + cc] !== 0 || keep(cc, rr) || zone[rr * N + cc]) { ok = false; break; }
      }
      if (!ok) continue;
      addPiece(id, r0 * N + c0b); placed++;
    }
  })();

  // 4 大石:平地格散佈 rockP
  for (i = 0; i < n; i++) {
    if (k[i] !== 0) continue;
    x = i % N; y = (i - x) / N;
    if (keep(x, y) || zone[i]) continue;
    if (wmGenHash01(seed, i, 5) < C.rockP) addPiece('O1', i);
  }

  // 5 連通:主城泛洪,封閉區的平地改成大石(淺灘改河、道路改石;城池占地與城郊不改),保證所有可走格到得了
  (function () {
    var seen = new Uint8Array(n), q = new Int32Array(n), qh = 0, qt = 0, u, ux, uy, j, vx, vy, v;
    seen[c0] = 1; q[qt++] = c0;
    while (qh < qt) {
      u = q[qh++]; ux = u % N; uy = (u - ux) / N;
      for (j = 0; j < 4; j++) {
        vx = ux + WMG_DX8[j]; vy = uy + WMG_DY8[j];
        if (vx < 0 || vy < 0 || vx >= N || vy >= N) continue;
        v = vy * N + vx;
        if (seen[v] || !wmgWalk(k[v])) continue;
        seen[v] = 1; q[qt++] = v;
      }
    }
    for (u = 0; u < n; u++) {
      if (!wmgWalk(k[u]) || seen[u] || zone[u]) continue;   // 城池占地 / 城郊不改石(封閉 → walkOk 失敗 → 重試)
      if (k[u] === 4) k[u] = 3; else addPiece('O1', u);
    }
  })();

  nodesOut = nodesOut || [];
  WG = { gv: C.gv, size: N, seed: seed, seed0: seed, tries: 1, fallback: false, border: B, cx: cx, cy: cy, c0: c0, k: k, g: g, pm: pm, pcs: pcs, nodes: nodesOut, nodeOf: nodeOf, zone: zone, nfail: nfail, d: null, pv: null, chk: null };
  r = wmDistCalc(WG, C.reach);
  WG.d = r.d; WG.pv = r.pv;
  wmgNodeAdj(WG);
  t = wmGenCheck(WG);
  WG.chk = t;
  return WG;
}

// 生成世界:seed 整數(0~2³²−1);size 預設 WMG_CFG.size。檢查失敗 seed+1 重試最多 retry 次,仍失敗用保底種子(wmGenCheck 結果在 WG.chk)
function wmGen(seed, size) {
  var C = WMG_CFG, N = Math.floor(Number(size)) || C.size, s, t, WG;
  if (N < 2 * C.border + 15) N = 2 * C.border + 15;
  s = (Math.floor(Number(seed)) || 0) >>> 0;
  seed = s;
  for (t = 0; t < C.retry; t++) {
    WG = wmgBuild(s, N);
    if (WG.chk.ok) { WG.seed0 = seed; WG.tries = t + 1; return WG; }
    s = (s + 1) >>> 0;
  }
  WG = wmgBuild(C.fallbackSeed, N);
  WG.seed0 = seed; WG.tries = C.retry + 1; WG.fallback = true;
  return WG;
}
