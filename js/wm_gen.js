// js/wm_gen.js — M1 大地圖世界生成 / 距離 / 去程(設計_M1視覺原型_實作計畫.md 第 3.1~3.3、3.6 節,W0;共享世界規格 4.1、5.1)。
// 六邊形改版(gv 5):距離 / 泛洪 / BFS / A* 全部 6 向(js/wm_hex.js,須先載入;設計_地圖六邊形改版_規格.md 第 1~3 節),每步成本 1;沒有切牆角規則。
// 純資料 + 純函式:不碰 DOM / 存檔、不讀時間、不用 Math.random(只吃 seed,同 seed 同圖);ES2017,不用 ?. ??;UTF-8 + CRLF。
// 載入順序:features.js 之後(index.html、sw.js PRECACHE 同步)。目前沒有任何遊戲程式引用;功能旗標 FEATURES.wmap 預設 false。
// 命名:本檔全域一律 wmg* / WMG_* / wmGen* / wmPath* / wmDist* / wmGo* / wmBack* ...;既有 js/wm_core.js、wm_ui.js、wm_data.js 是舊外勤(WM_CFG、wmNorm、wmDispatch、wmOpen…),新地圖程式不得沿用同名。
//
// ───────── 公開 API(W1 之後的人只靠這裡) ─────────
//   WMG_CFG    參數表:size 64(改成 160 即共享世界大小;全部參數化)、border 4、reach 24、goBase 1、goK 0.375、goMin 2、goMax 10、spd{騎 弓 槍 械 盾}、mode{steady 1, rush 0.67}…
//   WMG_K      格種類代號:{plain:0, mount:1, rock:2, river:3, ford:4, road:5, city:6, edge:7, yard:8, county:9, pass:10, jun:11, zhou:12};可走 = 0 / 4 / 5 / 6;可占領 = 只有 0
//   城池占地(gv 4 起,設計_地圖城池占地與美工_規格_修訂2_GPT圖版.md MW1):縣 4×4 = k 9、郡 6×6 = k 11、州城 8×8 = k 12(使用者 11/16 改:不是 6×6;M1 zhouN = 0 不出現,共享世界 13 座)、關 2×4 = 兩側山壁 6 格 k 10 + 中間門道 2 格 k 5(道路,可通行,橫跨 4 沿路 2);城內格不可走、不可占領、不進 d(wmReach / wmCanTarget 皆 false),只有關的門道可通行。
//   每座城池外圍 1 圈 = 城郊(zone 2):山 / 大石 / 領地都不放。縣 / 郡 / 州只開前面兩個門(side 1 = c+1 面、side 2 = r+1 面,位置 = WMG_CFG.gateIx),道路只接一面(= 主城門);node.flip = 主城門 side 2 ? 1 : 0(圖水平鏡像),關 flip = axis;出征一律打主城門前格 node.adj,node.gi = 主城門那一格(城內),存檔點 id = 'w' + node.gi。
//   WG.nodeOf = Int8Array(size²) 格 → 節點序號(城內 + 關門道;不屬於任何城池 = -1);WG.zone = Uint8Array(size²) 0 一般 / 1 城池占地(含門道)/ 2 城郊;WG.nfail = 放不下的原因(空 = 全放好)
//   WG.nodes = [{id, type:'county'|'jun'|'zhou'|'pass', flip:0|1, ti:同類序號 0.., c0, r0, fw, fh:占地矩形, cells:[gi…]占地全部格(含門道), gates:[{side 0=r−1 1=c+1 2=r+1 3=c−1, gi:城內門格, out:門外格}…], mg:主城門在 gates 的索引, gi:主城門格, adj:主城門前格(道路), d:adj 的全圖路徑成本(有限), axis:只有關 0 = 道路沿 c、1 = 沿 r}]
//     縣 countyN(6)、郡 junN(2)、州 zhouN(M1 = 0;黃金角散開、先放)、關 passN(3);縣依 6 扇區環繞主城(中心離主城 countyR 11~17),郡兩座相對(18~21),放置螺旋搜尋半徑 spiralR(9),關前兩座跨在主城通邊的主路上、第 3 座靠邊另鋪路到邊界。
//   wmNodeAt(WG, gi) → node | null(查 nodeOf,O(1):點城內任何格 / 關門道都回該城池);道路網 = 主城 → 城池門前格的最小生成樹(A*,過河成橋)+ 原本主城 → 兩邊的路;道路格占可玩格 ≤ WMG_CFG.roadMax(8%)
//   主城足跡(gv 5,六邊形:半徑 1 = 中心 + 6 鄰共 7 格 = k 6(出發集合,d = 0);3×3 外框內其餘兩格 (+1, −1)、(−1, +1)(螢幕左右兩角)= 庭院 k 8(不可通行、不可占領、不計占領上限、不產生目標、d = Infinity)。
//   WMG_CITY_CELLS  7 格相對主城中心的 [dc, dr];WMG_CITY_YARD  2 格庭院 [dc, dr];WMG_CITY_BOX  3×3 外框 9 格(山 / 石 / 河 / 道路起點生成一律避讓整個外框)
//   wmCityCells(WG) → [gi×7](k=6,中心 c0 在內);wmCityYard(WG) → [gi×2];wmCityBox(WG) → [gi×9]
//   wmIsCity(WG, gi) → bool(k = 6);wmIsYard(WG, gi) → bool(k = 8);wmInCityBox(WG, gi) → bool(九宮格內,含庭院)
//   WMG_PIECES 拼塊 footprint(gv 5):{M1, M2c, M2r, M2v, M3l, M3r, M4, O1} → [[dr, dc], …](與 tools/iso_tile_plan.js 同形狀與命名)
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
//   資源(gv 4,設計_地形資源與鋪路隊_規格.md 1):WG.d0 = Float32Array 全圖路徑成本(生成當下,凍結,不隨鋪路變);WG.rt = Int8Array 資源種類(−1 無;0 農田 1 礦坑 2 獵場 3 林場 4 採石場 = WMG_RES_TY 索引,與 WMAP_TY 同序)、WG.rl = Uint8Array 等級 1~10(無 = 0)、
//       WG.rg = Int16Array 範圍號(−1 不在候選;0~4 近、5~14 中、15~24 遠、25~34 外圍)、WG.res = {ty, ranges[{id,layer,cells,seats,miss}], layerCells, layerSeats, cand, placed, s1, s2, relax, miss, missReach, minSlack, density, stage2}
//   wmGenResAt(WG, gi) → {ty:'farm'.., lv} | null;wmGenGround(WG, gi) → 0 草 / 1 林地 / 2 泥地(k 0 格;雜訊吃 wmHexGround(c, r) 的 x、y,wmgNoise(seed, gx, gy, sc);wmap_view wmapGroundType 須同公式)
//   疊加道路層(鋪路隊):WG.rd = Uint8Array | null;wmGenRdSet(WG, gis) 整層重設並重算 d / pv / 各城池 d(回傳套用格數;[] = 清空);wmGenRdAdd(WG, gi) 加鋪一格(k 0 才收,回傳是否新增);道路層格成本 ×0.5;wmgMul(k, rdv)
//   wmGenCheck(WG) → {ok, reasons[], reachPlain /*成本 ≤ reach 的平地數*/, walkOk, pieceOk}   驗收條件(wmGen 內部已呼叫)
//   wmDistCalc(WG, maxCost?) → {d, pv}         重算距離(預設 WMG_CFG.reach;傳 Infinity = 全圖);6 方向(wmHex)、每步 1;格成本 道路 ×0.5、淺灘 ×1.5(以進入格計)
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
  size: 128, border: 4, reach: 24, keep: 4,         // 世界邊長(gv 6:128;舊 64 仍可傳參數);邊界帶格數(不可點不可走);可達成本上限;主城外保留平地圈(wmHexDist ≤ keep)
  seats: 30, seatSize: 96, seatMargin: 8, seatGap: 22, seatJit: 2,   // 席位數(世界邊長 < seatSize 只有 1 席 = 舊單機圖)、席位離邊界帶最小距離、六角晶格最大間距(自動縮到放得下)、位置抖動(格)
  countyPer: 1, junPer: 1 / 3, passPer: 0.4,        // 多席位:每席縣數、每席郡數、每席關數(單席維持 countyN / junN / passN)
  gv: 6,                                            // 生成器版本(改演算法就遞增;存檔記錄,不同 = 重新生成)
  mtnCount: 40, mtnRef: 3136,                       // 山拼塊數 40 / 3136 個可玩格(64×64 扣邊界帶 = 56×56);其他尺寸按可玩格數等比例
  mtnW: [['M1', 3], ['M2c', 1.5], ['M2r', 1.5], ['M2v', 1], ['M3l', 2], ['M3r', 2], ['M4', 2]],   // 拼塊權重
  rockP: 0.02,                                      // 大石散佈機率(平地格)
  riverGap: 7, fordEvery: 11,                       // 河與主城的最小距離;每 11 格一個淺灘
  minPlain: 900, retry: 5, fallbackSeed: 20261116,  // 成本 ≤ reach 的可達平地下限;重試次數;保底種子
  goBase: 1, goK: 0.375, goMin: 2, goMax: 10, backDiv: 4,
  spd: { '騎': 0.85, '弓': 1.0, '槍': 1.0, '械': 1.25, '謀': 1.05, '盾': 1.10 },
  mode: { steady: 1, rush: 0.67 },
  ringDiv: 2.7,
  countyN: 6, passN: 3, junN: 2, zhouN: 0, countyR: [11, 17], junR: [18, 21], zhouR: [20, 0], spiralR: 9, gapE: 3, ring: 1, roadMax: 0.085,   // 縣數、關數、郡數、縣 / 郡中心離主城格數範圍、城池間最小間隔(占地矩形邊對邊空 3 格)、城郊圈數、道路格占可玩格上限
  fp: { county: [4, 4], jun: [6, 6], zhou: [8, 8], pass: [2, 4] },   // 占地 [fw, fh];關 = [沿路, 橫跨](axis 1 時對調)
  gateIx: { county: 2, jun: 3, zhou: 4 },           // 縣 / 郡 / 州正門在前面(side 1 / 2)上的格索引(從 r / c 小的一端數;圖上實量後回填)
  // 資源配額(gv 6;設計_領地等級分佈與搜尋標記_規格.md 2.3):單席 = 可達範圍(去程 ≤ 10 分)每位玩家 Lv1 5、Lv2 10、Lv3 150、Lv4 325、Lv5 300、Lv6 50;Lv7~10 只在縣 / 郡 / 關外圍
  res: { rho: 0.55, w: 3, slack: 1.25, outMax: 0.9, blockMax: 0.35, layers: [3.5, 9, 17, 24], ranges: [1, 5, 10, 10], dmin: [2, 3, 4, 5], outRanges: 10, outDmin: 5,
    bulk: [{ 1: 1, 2: 2 }, { 3: 4, 4: 1 }, { 3: 1, 4: 4, 5: 2 }, { 4: 2, 5: 4, 6: 1 }],
    nodeHigh: { county: [7, 7, 8], pass: [7, 8, 8, 9], jun: [8, 9, 9, 10, 10] }, nodeR: 3, nodeGap: 2, nodeMinHex: { 7: 12, 8: 13, 9: 15, 10: 17 }, outLv: [5, 4, 5, 3, 5, 4, 6, 5, 4, 5] },
  // 多席位(每席自然領域約 420 格:路徑成本最近的席位;配額 = 單席每席約 ×0.4,讓總密度維持約 52%;等級帶以「核心環 + 其餘格依成本排名等比例切層」避免小領域缺格)
  resM: { rho: 0.55, w: 3, slack: 1.25, outMax: 0.9, blockMax: 0.35, rank: true, core: 3.5, frac: [0.28, 0.74, 1], dMin: 0.4, fMin: 0.3, fMax: 1.8, dens: 0.66, base: 200, layers: [], ranges: [1, 3, 4, 2], dmin: [2, 3, 3, 4], outRanges: 0, outDmin: 5, missTol: 2,
    bulk: [{ 1: 1, 2: 2 }, { 3: 3, 4: 1 }, { 3: 1, 4: 2, 5: 2 }, { 4: 1, 5: 2, 6: 1 }],
    nodeHigh: { county: [7, 7, 8], pass: [7, 8, 8, 9], jun: [8, 9, 9, 10, 10] }, nodeR: 3, nodeGap: 2, nodeMinHex: { 7: 9, 8: 10, 9: 11, 10: 12 }, outLv: [5, 4, 5, 3, 5, 4, 6, 5, 4, 5] }
};
var WMG_K = { plain: 0, mount: 1, rock: 2, river: 3, ford: 4, road: 5, city: 6, edge: 7, yard: 8, county: 9, pass: 10, jun: 11, zhou: 12 };
var WMG_CITY_CELLS = [[-1, -1], [0, -1], [1, 0], [1, 1], [0, 1], [-1, 0], [0, 0]];   // [dc, dr]:6 鄰(WMHEX 順序)+ 中央
var WMG_CITY_YARD = [[1, -1], [-1, 1]];                                              // 庭院 2 格(螢幕右 / 左兩角)
var WMG_CITY_BOX = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
var WMG_PIECES = {
  M1: [[0, 0]], M2c: [[0, 0], [0, 1]], M2r: [[0, 0], [1, 0]], M2v: [[0, 0], [1, 1]],
  M3l: [[0, 0], [0, 1], [1, 1]], M3r: [[0, 0], [1, 0], [1, 1]],
  M4: [[0, 0], [0, 1], [1, 0], [1, 1]], O1: [[0, 0]]
};
var WMG_WALK = new Uint8Array([1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);   // wmgWalk 的查表版(熱迴圈用,避開全域函式呼叫)

// ───────── 雜湊 / 亂數 / 雜訊 ─────────
function wmGenHash(seed, a, b) {
  var h = (seed ^ 0x9e3779b9) | 0;
  h = Math.imul(h ^ (a | 0), 0x85ebca6b); h ^= h >>> 13;
  h = Math.imul(h ^ (b | 0), 0xc2b2ae35); h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 15;
  return h >>> 0;
}
function wmGenHash01(seed, a, b) {   // = wmGenHash(...) / 2³²(內聯,不呼叫 wmGenHash:熱迴圈少一次全域函式查找)
  var h = (seed ^ 0x9e3779b9) | 0;
  h = Math.imul(h ^ (a | 0), 0x85ebca6b); h ^= h >>> 13;
  h = Math.imul(h ^ (b | 0), 0xc2b2ae35); h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
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
function wmgNoise(seed, x, y, sc) {   // 值雜訊,格距 sc;x、y = 地面等向座標(wmHexGround 的 x、y)
  var hh = wmGenHash01, fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, s = seed ^ (sc * 0x2545), a, b, c, d;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  a = hh(s, x0, y0); b = hh(s, x0 + 1, y0); c = hh(s, x0, y0 + 1); d = hh(s, x0 + 1, y0 + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function wmgFbm(seed, x, y) { return 0.55 * wmgNoise(seed, x, y, 24) + 0.30 * wmgNoise(seed, x, y, 11) + 0.15 * wmgNoise(seed, x, y, 5); }   // x、y = 地面等向座標
function wmgFbmCR(seed, c, r) { var g = wmHexGround(c, r); return wmgFbm(seed, g.x, g.y); }   // 吃格座標(c, r,可浮點)

// ───────── 小工具 ─────────
function wmGi(c, r, size) { return r * size + c; }
function wmXY(gi, size) { var c = gi % size; return { c: c, r: (gi - c) / size }; }
function wmgWalk(k) { return k === 0 || k === 4 || k === 5 || k === 6; }
function wmgMul(k, rdv) { return (k === 5 || rdv) ? 0.5 : (k === 4 ? 1.5 : 1); }   // rdv = 疊加道路層 WG.rd[gi](鋪路隊鋪的路,只出現在平地,成本同道路 ×0.5)
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
// 回 {d: Float32Array, pv: Int32Array};成本 > maxCost 的格不展開(d = Infinity)。6 向(wmHex),進入格的成本 = 1 × 該格倍率。
function wmDistCalc(WG, maxCost, src) {   // src = 起點格清單(席位 s 的 7 格);不傳 = 主城(k 6)
  var N = WG.size, n = N * N, k = WG.k, rd = WG.rd || null, WK = WMG_WALK, HC = WMHEX_DC, HR = WMHEX_DR, dist = new Float64Array(n), pv = new Int32Array(n), d32 = new Float32Array(n), done = new Uint8Array(n), h = wmgHeap(), i, u, ux, uy, j, x, y, v, w, nd;
  if (!(maxCost >= 0)) maxCost = WMG_CFG.reach;
  for (i = 0; i < n; i++) { dist[i] = Infinity; pv[i] = -1; }
  if (src) { for (i = 0; i < src.length; i++) { dist[src[i]] = 0; h.push(0, src[i]); } }
  else for (i = 0; i < n; i++) if (k[i] === 6) { dist[i] = 0; h.push(0, i); }
  while (h.size()) {
    u = h.pop();
    if (done[u]) continue;
    done[u] = 1;
    ux = u % N; uy = (u - ux) / N;
    nd = dist[u];
    for (j = 0; j < 6; j++) {
      x = ux + HC[j]; y = uy + HR[j];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      v = y * N + x;
      if (!WK[k[v]]) continue;
      w = nd + ((k[v] === 5 || (rd && rd[v])) ? 0.5 : (k[v] === 4 ? 1.5 : 1));   // = wmgMul(k, rd)
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
  v = Math.max(C.goMin, cost <= C.reach ? Math.min(C.goMax, v) : v);   // gv 6:可達範圍(成本 ≤ reach)內夾 2~10 分;超出範圍不封頂(1 + 0.375 × 成本,系統自選最優路線由 wmapGoRoute 負責)
  return Math.round(v * 10) / 10;
}
function wmBackMins(goMins) { return Number(goMins) / WMG_CFG.backDiv; }
function wmGenRing(cost) { return Math.min(9, Math.max(1, Math.ceil(Number(cost) / WMG_CFG.ringDiv))); }

// ───────── 驗收 ─────────
function wmGenCheck(WG) {
  var WK = WMG_WALK, N = WG.size, n = N * N, k = WG.k, pm = WG.pm, reasons = [], seen = new Uint8Array(n), q = new Int32Array(n), qh = 0, qt = 0, i, u, ux, uy, j, x, y, v, walkOk = true, pieceOk = true, reachPlain = 0, own, pc, cells, ci, gi2, cnt = new Uint8Array(n), r0, c0, dr, dc, ii, HC = WMHEX_DC, HR = WMHEX_DR;
  // 1 主城可走格泛洪(6 向):所有可走格都到得了
  seen[WG.c0] = 1; q[qt++] = WG.c0;
  while (qh < qt) {
    u = q[qh++]; ux = u % N; uy = (u - ux) / N;
    for (j = 0; j < 6; j++) {
      x = ux + HC[j]; y = uy + HR[j];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      v = y * N + x;
      if (seen[v] || !WK[k[v]]) continue;
      seen[v] = 1; q[qt++] = v;
    }
  }
  for (i = 0; i < n; i++) if (WK[k[i]] && !seen[i]) { walkOk = false; break; }
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
    if (WG.nodes.length !== (WG.nodeN >= 0 ? WG.nodeN : WMG_CFG.countyN + WMG_CFG.junN + WMG_CFG.zhouN + WMG_CFG.passN)) reasons.push('城池數量 ' + WG.nodes.length);
    for (i = 0; i < WG.nodes.length; i++) if (!(WG.nodes[i].adj >= 0 && isFinite(WG.nodes[i].d))) { reasons.push('城池 ' + i + ' 主城到不了'); break; }
  }
  // 5 資源(gv 4,規格 1.5):配額達成、每層候選格 ≥ 座位 × slack、全圖密度 ≥ 50%、任一 3×3 區塊山 + 石 + 河 + 淺灘 ≤ blockMax
  if (WG.res) wmgResCheck(WG, reasons);
  return { ok: reasons.length === 0, reasons: reasons, reachPlain: reachPlain, walkOk: walkOk, pieceOk: pieceOk };
}

// ───────── 資源(gv 4;設計_地形資源與鋪路隊_規格.md 1)─────────
// 平衡單位 = 範圍:候選格(k 0、非城池占地 / 城郊、d0 有限)依 d0 切 近 ≤ 8 / 中 ≤ 16 / 遠 ≤ 24 三層,每層依「相對主城角度 + 種子旋轉」排序後按格數均分成 5 / 10 / 10 個範圍;
// 每個範圍照同一張「種類 × 等級」配額表放,所以每位玩家的可達範圍組合完全相同。階段 1 依地形偏好、階段 2 在同一範圍任意空平地補齊(不跨範圍、不降級);外圍(d0 > 24)另補到全圖 rho。
// 種類序 = WMG_RES_TY(與 wmap_view 的 WMAP_TY 同序):0 農田 1 礦坑 2 獵場 3 林場 4 採石場。
var WMG_RES_TY = ['farm', 'mine', 'hunt', 'lumber', 'quarry'];
function wmGenGround(WG, gi) {   // 平地格的地面種類:0 草、1 林地、2 泥地(與 wmap_view wmapGroundType 的雜訊規則相同,只對 k 0 有意義)
  var N = WG.size, c = gi % N, r = (gi - c) / N, gx = WMHEX_GX * (c - r), gy = 0.5 * (c + r);
  if (wmgNoise(WG.seed, gx, gy, 9) > 0.72) return 2;
  return wmgNoise(WG.seed + 7, gx, gy, 7) > 0.7 ? 1 : 0;
}
function wmGenResAt(WG, gi) { return WG.rt && gi >= 0 && gi < WG.rt.length && WG.rt[gi] >= 0 ? { ty: WMG_RES_TY[WG.rt[gi]], lv: WG.rl[gi] } : null; }
function wmgBfs(N, src) {   // 6 向多源 BFS 格距(上限 99)
  var n = N * N, d = new Uint8Array(n), q = new Int32Array(n), qt = 0, qh = 0, i, u, x, y, v, j, nx, ny, HC = WMHEX_DC, HR = WMHEX_DR;
  d.fill(99);
  for (i = 0; i < n; i++) if (src[i]) { d[i] = 0; q[qt++] = i; }
  while (qh < qt) {
    u = q[qh++]; x = u % N; y = (u - x) / N;
    for (j = 0; j < 6; j++) {
      nx = x + HC[j]; ny = y + HR[j];
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      v = ny * N + nx;
      if (d[v] > d[u] + 1) { d[v] = d[u] + 1; q[qt++] = v; }
    }
  }
  return d;
}
// ───────── 席位(gv 6;設計_多人共享世界影響評估.md B.1 / D.1 第 6 項)─────────
// 世界一次生成 S 個席位(每席一座主城 3×3 外框):席位 0 = 世界中心(= 現行主城,k 6 / 8,單機玩家);其餘席位只「保留」九宮格(zone 3、k 0,資源 / 山 / 城池 / 野怪都不放),
// 之後某席啟用時由多人層把九宮格改成主城(wmGenSeatCells 給 7 格)。席位位置 = 六角晶格(地面等向座標)+ 雜湊抖動,離中心由近到遠排序(「由中間往外填」的出生點順序)。
function wmgSeatsFor(N) { var C = WMG_CFG, P = N - 2 * C.border; return N < C.seatSize ? 1 : Math.max(1, Math.min(C.seats, Math.round(P * P / 480))); }   // 世界邊長 < seatSize = 單席舊圖;之後每 480 個可玩格一席(96 → 16、128 → 30、160 → 30)
function wmgSeatPos(N, n, seed) {
  var C = WMG_CFG, cx = N >> 1, cy = N >> 1, lo = C.border + C.seatMargin, hi = N - 1 - C.border - C.seatMargin, out = [{ c: cx, r: cy }], s, pts = [], i, j, a, b, c, r, q, jit = C.seatJit, h, jc, jr, d;
  if (n <= 1) return out;
  for (s = C.seatGap; s >= 6; s -= 0.25) {
    pts = [];
    for (j = -16; j <= 16; j++) for (i = -16; i <= 16; i++) {
      if (!i && !j) continue;
      a = (i + (j & 1) * 0.5) * s / 0.8660254; b = 2 * j * s * 0.8660254;   // a = c − r、b = c + r(相對中心)
      c = cx + Math.round((a + b) / 2); r = cy + Math.round((b - a) / 2);
      if (c < lo || c > hi || r < lo || r > hi) continue;
      pts.push({ c: c, r: r, d: 0, o: j * 100 + i });
    }
    if (pts.length >= n - 1) break;
  }
  for (i = 0; i < pts.length; i++) pts[i].d = wmHexDist(cx, cy, pts[i].c, pts[i].r);
  pts.sort(function (p, q2) { return p.d - q2.d || p.o - q2.o; });
  for (q = 0; q < pts.length && out.length < n; q++) {
    h = wmGenHash01(seed, q, 41); d = wmGenHash01(seed, q, 42);
    jc = Math.round((h - 0.5) * 2 * jit); jr = Math.round((d - 0.5) * 2 * jit);
    out.push({ c: Math.max(lo, Math.min(hi, pts[q].c + jc)), r: Math.max(lo, Math.min(hi, pts[q].r + jr)) });
  }
  return out;
}
function wmGenSeatCells(WG, s) { var o = WG.seats[s], N = WG.size; return o ? WMG_CITY_CELLS.map(function (p) { return (o.r + p[1]) * N + o.c + p[0]; }) : []; }
function wmGenSeatYard(WG, s) { var o = WG.seats[s], N = WG.size; return o ? WMG_CITY_YARD.map(function (p) { return (o.r + p[1]) * N + o.c + p[0]; }) : []; }
function wmGenSeatDist(WG, s, maxCost) {   // 席位 s 的路徑成本場(同 wmDistCalc;預設 reach = 10 分鐘可達範圍;席位 0 = WG.d0 / WG.d 的來源)
  var src = wmGenSeatCells(WG, s);
  return src.length ? wmDistCalc(WG, maxCost, src) : null;
}
function wmGenSeatOf(WG, gi) { return WG.so && gi >= 0 && gi < WG.so.length ? WG.so[gi] : -1; }   // 格所屬席位(路徑成本最近 = 自然領域;−1 = 不可達)
function wmgSeatDist(WG) {   // 全席位多源 Dijkstra:ds = 到最近席位的成本、so = 該席位序號(資源配額 / 等級帶的依據)
  var N = WG.size, n = N * N, k = WG.k, rd = WG.rd || null, WK = WMG_WALK, HC = WMHEX_DC, HR = WMHEX_DR, dist = new Float64Array(n), so = new Int8Array(n), d32 = new Float32Array(n), done = new Uint8Array(n), h = wmgHeap(), i, s, q, u, ux, uy, j, x, y, v, w, nd, cs;
  for (i = 0; i < n; i++) { dist[i] = Infinity; so[i] = -1; }
  for (s = 0; s < WG.seats.length; s++) { cs = wmGenSeatCells(WG, s); for (q = 0; q < cs.length; q++) { dist[cs[q]] = 0; so[cs[q]] = s; h.push(0, cs[q]); } }
  while (h.size()) {
    u = h.pop();
    if (done[u]) continue;
    done[u] = 1;
    ux = u % N; uy = (u - ux) / N; nd = dist[u];
    for (j = 0; j < 6; j++) {
      x = ux + HC[j]; y = uy + HR[j];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      v = y * N + x;
      if (!WK[k[v]]) continue;
      w = nd + ((k[v] === 5 || (rd && rd[v])) ? 0.5 : (k[v] === 4 ? 1.5 : 1));
      if (w >= dist[v]) continue;
      dist[v] = w; so[v] = so[u]; h.push(w, v);
    }
  }
  for (i = 0; i < n; i++) d32[i] = dist[i];
  return { d: d32, so: so };
}

function wmgRes(WG) {
  var C = WMG_CFG, N = WG.size, n = N * N, k = WG.k, seed = WG.seed, d0 = WG.d0, ds = WG.ds || WG.d0, so = WG.so, zone = WG.zone, seats = WG.seats, S = seats.length,
    R = S > 1 ? C.resM : C.res, W = R.w, rho = R.rho, LY = R.layers, L = R.ranges.length, rank = !!R.rank,
    rt = new Int8Array(n), rl = new Uint8Array(n), rg = new Int16Array(n), wood = new Uint8Array(n), dirt = new Uint8Array(n), sM = new Uint8Array(n), sK = new Uint8Array(n), sR = new Uint8Array(n), isC = new Uint8Array(n), posG = new Float32Array(n),
    cand = [], fit = [], nearTab = {}, ranges = [], layerCells = [], layerSeats = [], st = { s1: 0, s2: 0, relax: 0, miss: 0, missReach: 0, placed: 0, minSlack: 99, high: 0, highMiss: 0, highRelax: 0 },
    rots = [], bySeat = [], ang = new Float64Array(n), i, x, y, g, ggx, ggy, dM, dK, dR, dW, t, b, r, rid = 0, TP = 2 * Math.PI, kk, seatsOf, split, cl, out, need, sec, ci, kb, bulkL, hh, s, sd, lay, fS = 1;
  var floor = Math.floor, atan2 = Math.atan2, imul = Math.imul;
  function hx(sx, a, b) {   // = wmGenHash01(sx, a, b)(本地內聯)
    var h = imul(((sx ^ 0x9e3779b9) | 0) ^ a, 0x85ebca6b); h ^= h >>> 13;
    h = imul(h ^ b, 0xc2b2ae35); h ^= h >>> 16;
    h = imul(h, 0x27d4eb2d); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function nz(sx, px, py, sc) {   // = wmgNoise(sx, px, py, sc)
    var fx = px / sc, fy = py / sc, x0 = floor(fx), y0 = floor(fy), tx = fx - x0, ty = fy - y0, s3 = sx ^ (sc * 0x2545), a, b, c, d;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    a = hx(s3, x0, y0); b = hx(s3, x0 + 1, y0); c = hx(s3, x0, y0 + 1); d = hx(s3, x0 + 1, y0 + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  if (!so) { so = new Int8Array(n); for (i = 0; i < n; i++) so[i] = isFinite(d0[i]) ? 0 : -1; }
  for (s = 0; s < S; s++) { rots.push(wmGenHash(seed, 1, 600 + s) / 4294967296); bySeat.push([]); }
  rt.fill(-1); rg.fill(-1);
  for (i = 0; i < n; i++) {
    kk = k[i];
    if (kk === 1 || kk === 10) sM[i] = 1; else if (kk === 2) sK[i] = 1; else if (kk === 3 || kk === 4) sR[i] = 1;
    if (kk === 0) {   // 地面:泥地 / 林地(同 wmGenGround;雜訊座標 = 地面等向座標)
      x = i % N; y = (i - x) / N; ggx = 0.8660254 * (x - y); ggy = 0.5 * (x + y);
      if (nz(seed, ggx, ggy, 9) > 0.72) dirt[i] = 1; else if (nz(seed + 7, ggx, ggy, 7) > 0.7) wood[i] = 1;
    }
    if (kk === 0 && !zone[i] && isFinite(d0[i]) && so[i] >= 0) {
      cand.push(i); isC[i] = 1; x = i % N; y = (i - x) / N; sd = seats[so[i]];
      g = atan2(0.5 * ((x - sd.c) + (y - sd.r)), 0.8660254 * ((x - sd.c) - (y - sd.r))) / TP; if (g < 0) g += 1;   // 相對所屬席位主城的地面角度
      ang[i] = (g + rots[so[i]]) % 1;
      bySeat[so[i]].push(i);
    }
  }
  dM = wmgBfs(N, sM); dK = wmgBfs(N, sK); dR = wmgBfs(N, sR); dW = wmgBfs(N, wood);
  for (t = 0; t < 5; t++) fit.push(new Float32Array(n));
  for (b = 0; b < cand.length; b++) {   // 地形吻合度 0 ~ 1(0 = 不合適);規格 1.4
    i = cand[b];
    if (dR[i] <= 5) fit[0][i] = 1 - dR[i] / 6;
    if (dM[i] <= 3) fit[1][i] = 1 - dM[i] / 4;
    if (!wood[i] && !dirt[i] && dM[i] >= 2 && dW[i] >= 2 && dR[i] >= 2) fit[2][i] = Math.min(dM[i], dW[i], dR[i], 6) / 6;
    if (dW[i] <= 2) fit[3][i] = 1 - dW[i] / 3;
    if (dK[i] <= 3 || dM[i] <= 2) fit[4][i] = 1 - Math.min(dK[i], dM[i] + 1) / 4;
  }
  function nearOf(t2, L2) {   // 每「種類 × 等級」一張:到最近同種同級已放格的六邊形距離(255 = 沒有 / 夠遠)
    var key = t2 * 11 + L2, a = nearTab[key];
    if (!a) { a = nearTab[key] = new Uint8Array(n); a.fill(255); }
    return a;
  }
  function eqSplit(cells, S2) {
    var a = cells.slice().sort(function (p, q) { return ang[p] - ang[q] || p - q; }), o = [], j;
    for (j = 0; j < S2; j++) o.push([]);
    for (j = 0; j < a.length; j++) o[Math.floor(j * S2 / a.length)].push(a[j]);
    return o;
  }
  var sd0 = (seed ^ 0x9e3779b9) | 0, posA = null;
  function h01(a, b) {   // = wmGenHash01(seed, a, b)(本地內聯:vm / 全域函式查找在熱迴圈很慢)
    var h = imul(sd0 ^ a, 0x85ebca6b); h ^= h >>> 13;
    h = imul(h ^ b, 0xc2b2ae35); h ^= h >>> 16;
    h = imul(h, 0x27d4eb2d); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function pick(cells, t2, L2, stage, dmin, pT) {
    var nr = nearOf(t2, L2), ft = fit[t2], dm, best, bs, ci2, j, f, sc, p, wx, wy, dx, dy, cx2, cy2, c2, q2, hb = 603 + L2;
    for (dm = dmin; dm >= 1; dm--) {
      best = -1; bs = -1e9;
      for (ci2 = 0; ci2 < cells.length; ci2++) {
        j = cells[ci2];
        if (rt[j] >= 0 || nr[j] < dm) continue;
        f = 0;
        if (stage === 1) { f = ft[j]; if (f <= 0) continue; }
        p = posA[ci2] - pT;
        sc = W * f + h01(j, hb) - 1.5 * (p < 0 ? -p : p);
        if (sc > bs) { bs = sc; best = j; }
      }
      if (best >= 0) {
        rt[best] = t2; rl[best] = L2; if (dm < dmin) st.relax++;
        wx = best % N; wy = (best - wx) / N;
        for (dy = -5; dy <= 5; dy++) {
          cy2 = wy + dy; if (cy2 < 0 || cy2 >= N) continue;
          for (dx = -5; dx <= 5; dx++) {
            cx2 = wx + dx; if (cx2 < 0 || cx2 >= N) continue;
            c2 = (dx >= 0) === (dy >= 0) || dx === 0 || dy === 0 ? ((dx < 0 ? -dx : dx) > (dy < 0 ? -dy : dy) ? (dx < 0 ? -dx : dx) : (dy < 0 ? -dy : dy)) : (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
            if (c2 > 5) continue;
            q2 = cy2 * N + cx2;
            if (nr[q2] > c2) nr[q2] = c2;
          }
        }
        return true;
      }
      if (stage === 1) return false;
    }
    return false;
  }
  function fillRange(cells, dmin, seatsL, layer) {
    var Lmin = 99, Lmax = 0, defer = [], j, s2, ok, m0 = st.miss, id = rid++, pT;
    for (j = 0; j < seatsL.length; j++) { if (seatsL[j][1] < Lmin) Lmin = seatsL[j][1]; if (seatsL[j][1] > Lmax) Lmax = seatsL[j][1]; }
    if (seatsL.length && cells.length / seatsL.length < st.minSlack) st.minSlack = cells.length / seatsL.length;
    posA = new Float64Array(cells.length);
    for (j = 0; j < cells.length; j++) { rg[cells[j]] = id; posA[j] = posG[cells[j]]; }
    seatsL.sort(function (p, q) { return q[1] - p[1] || p[0] - q[0]; });
    for (j = 0; j < seatsL.length; j++) {
      s2 = seatsL[j]; pT = Lmax === Lmin ? 0.5 : (s2[1] - Lmin) / (Lmax - Lmin);
      if (pick(cells, s2[0], s2[1], 1, dmin, pT)) { st.s1++; st.placed++; } else defer.push(s2);
    }
    for (j = 0; j < defer.length; j++) {
      s2 = defer[j]; pT = Lmax === Lmin ? 0.5 : (s2[1] - Lmin) / (Lmax - Lmin);
      ok = pick(cells, s2[0], s2[1], 2, dmin, pT);
      if (ok) { st.s2++; st.placed++; } else { st.miss++; if (layer < L) st.missReach++; }
    }
    ranges.push({ id: id, layer: layer, cells: cells.length, seats: seatsL.length, miss: st.miss - m0 });
  }
  // 城池外圍高等級群(Lv7~10;規格 2.3):先放,各層配額的 pick 會自然跳過這些格
  (function () {
    var NH = R.nodeHigh, nodes = WG.nodes || [], seatC = new Uint8Array(n), dSeat, hb = new Uint8Array(n), ni, nd, cl2, cells2, slots, sl, lv, best, bs, rad, q, e, minHex, sc2, x0, y0, x1, y1, xx, yy, gi2, hd, cc, ci3, rr2, hr, px, py, hexD = wmHexDist;
    if (!NH) return;
    for (i = 0; i < S; i++) seatC[seats[i].r * N + seats[i].c] = 1;
    dSeat = wmgBfs(N, seatC);
    for (ni = 0; ni < nodes.length; ni++) {
      nd = nodes[ni]; slots = NH[nd.type];
      if (!slots || !slots.length) continue;
      cl2 = []; cells2 = nd.cells;
      x0 = Math.max(0, nd.c0 - R.nodeR - 3); x1 = Math.min(N - 1, nd.c0 + nd.fw - 1 + R.nodeR + 3);
      y0 = Math.max(0, nd.r0 - R.nodeR - 3); y1 = Math.min(N - 1, nd.r0 + nd.fh - 1 + R.nodeR + 3);
      for (yy = y0; yy <= y1; yy++) for (xx = x0; xx <= x1; xx++) {
        gi2 = yy * N + xx;
        if (!isC[gi2]) continue;
        hd = 99;
        for (ci3 = 0; ci3 < cells2.length; ci3++) { cc = cells2[ci3]; px = cc % N; py = (cc - px) / N; q = hexD(xx, yy, px, py); if (q < hd) hd = q; }
        if (hd >= 2 && hd <= R.nodeR + 2) cl2.push({ gi: gi2, hd: hd });
      }
      for (sl = 0; sl < slots.length; sl++) {
        lv = slots[sl]; minHex = R.nodeMinHex[lv]; best = -1;
        for (rr2 = 0; rr2 < 2 && best < 0; rr2++) {   // 第 2 輪:離席位最小距離不限
          for (rad = R.nodeR; rad <= R.nodeR + 2 && best < 0; rad++) {
            bs = -1;
            for (q = 0; q < cl2.length; q++) {
              e = cl2[q];
              if (e.hd > rad || rt[e.gi] >= 0 || hb[e.gi]) continue;
              if (rr2 === 0 && dSeat[e.gi] < minHex) continue;
              sc2 = h01(e.gi, 700 + ni * 16 + sl);
              if (sc2 > bs) { bs = sc2; best = e.gi; }
            }
          }
          if (best >= 0 && rr2 === 1) st.highRelax++;
        }
        if (best < 0) { st.highMiss++; continue; }
        rt[best] = (ni + sl * 3) % 5; rl[best] = lv; rg[best] = 99; st.high++;
        px = best % N; py = (best - px) / N;
        hr = wmHexRange(px, py, R.nodeGap - 1, N);
        for (q = 0; q < hr.length; q++) hb[hr[q]] = 1;
      }
    }
  })();
  // 每席位:自然領域(路徑成本最近)的候選格 → 等級帶(cost 模式:依成本切層;rank 模式:核心環以外依成本排名等比例切層)→ 每層依角度均分成範圍 → 每範圍同一張配額表
  for (b = 0; b < L; b++) { layerCells.push(0); layerSeats.push(0); }
  out = [];
  for (s = 0; s < S; s++) {
    cl = bySeat[s];
    if (rank) {   // rank 模式:核心環以外的配額依自然領域大小縮放(領地小的席位不硬塞滿、大的席位多一些),組成比例不變
      hh = 0;
      for (ci = 0; ci < cl.length; ci++) if (ds[cl[ci]] <= R.core) hh++;
      fS = Math.max(R.fMin, Math.min(R.fMax, (cl.length - hh) * R.dens / R.base)); hh = 0;
    }
    lay = []; for (b = 0; b < L; b++) lay.push([]);
    if (!rank) {
      for (ci = 0; ci < cl.length; ci++) {
        i = cl[ci]; t = ds[i];
        for (b = 0; b < L; b++) if (t <= LY[b]) break;
        if (b >= L) { out.push(i); continue; }
        lay[b].push(i);
        posG[i] = (Math.min(t, 40) - (b === 0 ? 0 : LY[b - 1])) / (Math.min(LY[b], 40) - (b === 0 ? 0 : LY[b - 1]));
      }
    } else {
      cl = cl.slice().sort(function (p, q) { return ds[p] - ds[q] || p - q; });
      for (ci = 0; ci < cl.length && ds[cl[ci]] <= R.core; ci++) { lay[0].push(cl[ci]); posG[cl[ci]] = ds[cl[ci]] / R.core; }
      x = cl.length - ci; y = ci;
      for (b = 1; b < L; b++) {
        t = b === L - 1 ? cl.length : y + Math.round(x * (R.frac[b - 1] - (b > 1 ? R.frac[b - 2] : 0)));
        if (t > cl.length) t = cl.length;
        for (g = y; g < t; g++) { lay[b].push(cl[g]); posG[cl[g]] = (g - y) / Math.max(1, t - y - 1); }
        y = t;
      }
    }
    for (b = 0; b < L; b++) {
      layerCells[b] += lay[b].length;
      split = eqSplit(lay[b], R.ranges[b]);
      bulkL = Object.keys(R.bulk[b]);
      for (r = 0; r < R.ranges[b]; r++) {
        seatsOf = [];
        for (t = 0; t < 5; t++) for (kb = 0; kb < bulkL.length; kb++) for (hh = 0, kk = rank && b > 0 ? Math.floor(R.bulk[b][bulkL[kb]] * fS + h01(s * 977 + r * 31 + b, t * 16 + kb)) : R.bulk[b][bulkL[kb]]; hh < kk; hh++) seatsOf.push([t, +bulkL[kb]]);
        layerSeats[b] += seatsOf.length;
        fillRange(split[r], R.dmin[b], seatsOf, b);
      }
    }
  }
  if (!rank) for (ci = 0; ci < out.length; ci++) { i = out[ci]; posG[i] = (Math.min(ds[i], 40) - LY[L - 1]) / (40 - LY[L - 1]); }
  need = Math.max(0, Math.ceil(rho * cand.length) - st.placed - st.high);
  need = Math.min(need, Math.floor(out.length * R.outMax));
  if (R.outRanges && out.length) {
    sec = eqSplit(out, R.outRanges);
    for (r = 0; r < R.outRanges; r++) {
      seatsOf = [];
      for (hh = 0; hh < Math.floor(need / R.outRanges) + (r < need % R.outRanges ? 1 : 0); hh++) seatsOf.push([(hh + r) % 5, R.outLv[(hh * 7 + r) % R.outLv.length]]);
      fillRange(sec[r], R.outDmin, seatsOf, L);
    }
  }
  WG.rt = rt; WG.rl = rl; WG.rg = rg;
  WG.res = { ty: WMG_RES_TY, ranges: ranges, layerCells: layerCells, layerSeats: layerSeats, cand: cand.length, placed: st.placed, s1: st.s1, s2: st.s2, relax: st.relax, miss: st.miss, missReach: st.missReach,
    minSlack: st.minSlack, density: cand.length ? (st.placed + st.high) / cand.length : 0, stage2: st.s1 + st.s2 ? st.s2 / (st.s1 + st.s2) : 0, high: st.high, highMiss: st.highMiss, highRelax: st.highRelax, seats: S };
  return WG;
}
function wmgResCheck(WG, reasons) {
  var R = WG.seats && WG.seats.length > 1 ? WMG_CFG.resM : WMG_CFG.res, s = WG.res, N = WG.size, k = WG.k, B = WG.border, P = N - 2 * B, e = [0, Math.floor(P / 3), Math.floor(2 * P / 3), P], b, x2, y2, x, y, tt, cc, kk, bad = false, dMin, tol = Math.floor((R.missTol || 0) * (WG.seats ? WG.seats.length : 1));
  if (s.missReach > tol) reasons.push('資源配額缺 ' + s.missReach + ' 座');
  for (b = 0; b < s.layerCells.length; b++) if (s.layerCells[b] < s.layerSeats[b] * R.slack) { reasons.push('資源第 ' + (b + 1) + ' 層候選格 ' + s.layerCells[b] + ' < 座位 × ' + R.slack); break; }
  dMin = (R.dMin || 0.5) * (WG.seats && WG.seats.length > 1 ? Math.min(1, WG.seats.length / wmgSeatsFor(N)) : 1);   // 多席位:席位數少於這個邊長的預設數時(例如 128×128 只放 10 席),每席配額封頂,密度下限照比例降
  if (s.density < dMin) reasons.push('資源密度 ' + Math.round(s.density * 1000) / 10 + '% < ' + Math.round(dMin * 100) + '%');
  for (y2 = 0; y2 < 3 && !bad; y2++) for (x2 = 0; x2 < 3 && !bad; x2++) {
    tt = 0; cc = 0;
    for (y = B + e[y2]; y < B + e[y2 + 1]; y++) for (x = B + e[x2]; x < B + e[x2 + 1]; x++) { cc++; kk = k[y * N + x]; if (kk >= 1 && kk <= 4) tt++; }
    if (cc && tt / cc > R.blockMax) bad = true;
  }
  if (bad) reasons.push('有區塊山石河 > ' + Math.round(R.blockMax * 100) + '%');
}

// ───────── 疊加道路層(鋪路隊,TR3;規則 / 體力 / UI 由 wmap 端負責,這裡只管距離)─────────
// WG.rd = Uint8Array(size²) | null:1 = 鋪過的平地(路徑成本 ×0.5,格種類 / 資源不變)。不升 gv;d0 / 資源範圍凍結不變。
function wmGenRdSet(WG, gis) {   // 整層重設(載入存檔 / 賽季重置傳 [])並重算 d / pv / 各城池 d;只收 k 0 的平地格;回傳實際套用格數
  var n = WG.size * WG.size, rd = null, c = 0, i, g, r;
  if (gis && gis.length) {
    rd = new Uint8Array(n);
    for (i = 0; i < gis.length; i++) { g = gis[i]; if (g >= 0 && g < n && WG.k[g] === 0 && !rd[g]) { rd[g] = 1; c++; } }
    if (!c) rd = null;
  }
  WG.rd = rd;
  r = wmDistCalc(WG, WMG_CFG.reach); WG.d = r.d; WG.pv = r.pv;
  wmgNodeD(WG);
  return c;
}
function wmGenRdAdd(WG, gi) {   // 加鋪一格(k 0 才收)並重算;回傳是否新增
  var n = WG.size * WG.size, r;
  if (!(gi >= 0 && gi < n) || WG.k[gi] !== 0 || (WG.rd && WG.rd[gi])) return false;
  if (!WG.rd) WG.rd = new Uint8Array(n);
  WG.rd[gi] = 1;
  r = wmDistCalc(WG, WMG_CFG.reach); WG.d = r.d; WG.pv = r.pv;
  wmgNodeD(WG);
  return true;
}

// ───────── 生成(一次) ─────────
var wmgRP = { n: 0 };   // A* 暫存緩衝(同尺寸重用,每次呼叫前重設)
function wmgRoadPath(k, N, seed, sx, sy, tx, ty) {   // 6 向 A*(啟發 0.8 × wmHexDist);平地 1(+雜湊擾動)、道路 0.3、淺灘 2、河 8、主城 / 邊界不可走
  var hash01 = wmGenHash01, hd = wmHexDist, HC = WMHEX_DC, HR = WMHEX_DR, n = N * N, S = wmgRP.n === n ? wmgRP : (wmgRP = { n: n, gs: new Float64Array(n), pr: new Int32Array(n), done: new Uint8Array(n) }), gs = S.gs, pr = S.pr, done = S.done, h = wmgHeap(), si = sy * N + sx, ti = ty * N + tx, i, u, ux, uy, j, x, y, v, kk, cost, nd, out, cur;
  gs.fill(Infinity); pr.fill(-1); done.fill(0);
  gs[si] = 0; h.push(0.8 * hd(sx, sy, tx, ty), si);
  while (h.size()) {
    u = h.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === ti) break;
    ux = u % N; uy = (u - ux) / N;
    for (j = 0; j < 6; j++) {
      x = ux + HC[j]; y = uy + HR[j];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      v = y * N + x; kk = k[v];
      if (kk === 6 || kk === 7 || kk === 8 || kk === 1 || kk === 2 || kk === 9 || kk === 10 || kk === 11 || kk === 12) continue;
      cost = kk === 5 ? 0.3 : (kk === 3 ? 8 : (kk === 4 ? 2 : 1 + 0.6 * hash01(seed, v, 11)));
      nd = gs[u] + cost;
      if (nd < gs[v]) { gs[v] = nd; pr[v] = u; h.push(nd + 0.8 * hd(x, y, tx, ty), v); }
    }
  }
  if (!done[ti]) return null;
  out = []; cur = ti;
  while (cur >= 0) { out.push(cur); cur = pr[cur]; }
  return out;
}
function wmgNodeAdj(WG, all0) {   // 回傳全圖距離(= WG.d0)。每座城池:全圖 Dijkstra(不受 reach 限制)→ 主城門 / 門前格 adj / d;關的主城門 = 門外格 d 較小的那一端(朝主城)
  var all = all0 || wmDistCalc(WG, Infinity).d, i, j, nd, g, best, bd;
  for (i = 0; i < WG.nodes.length; i++) {
    nd = WG.nodes[i];
    if (nd.type === 'pass' || nd.mg < 0) {
      best = 0; bd = Infinity;
      for (j = 0; j < nd.gates.length; j++) if (all[nd.gates[j].out] < bd) { bd = all[nd.gates[j].out]; best = j; }
      nd.mg = best;
    }
    g = nd.gates[nd.mg];
    nd.gi = g.gi; nd.adj = g.out; nd.d = all[g.out];
    nd.flip = nd.type === 'pass' ? nd.axis : (g.side === 2 ? 1 : 0);   // 圖水平鏡像:縣 / 郡 / 州 = 主城門在左前(side 2);關 = axis
  }
  return all;
}
function wmgNodeD(WG) {   // 只重算每座城池門前格的路徑成本(鋪路後;不動主城門)
  var all = wmDistCalc(WG, Infinity).d, i;
  for (i = 0; i < WG.nodes.length; i++) WG.nodes[i].d = all[WG.nodes[i].adj];
  return all;
}
function wmgBuild(seed, N, S) {
  S = S >= 1 ? Math.floor(S) : 1;
  var C = WMG_CFG, multi = S > 1, seats = wmgSeatPos(N, S, seed), nC = multi ? Math.round(S * C.countyPer) : C.countyN, nJ = multi ? Math.round(S * C.junPer) : C.junN, nP = multi ? Math.round(S * C.passPer) : C.passN, SPR = multi ? 14 : C.spiralR, keepMap = new Uint8Array(N * N), gapMap = new Uint8Array(N * N), si, sq, sr, B = C.border, n = N * N, k = new Uint8Array(n), g = new Uint8Array(n), pm = new Int16Array(n), pcs = [], rng = wmgRng(seed),
    nodesOut = null, zone = new Uint8Array(n), nodeOf = new Int8Array(n), nfail = [], mainPaths = [], cx = N >> 1, cy = N >> 1, c0 = cy * N + cx, lo = B, hi = N - 1 - B, i, x, y, dx, dy, WG, r, t;
  for (i = 0; i < n; i++) {
    x = i % N; y = (i - x) / N;
    pm[i] = -1; nodeOf[i] = -1; g[i] = wmGenHash(seed, i, 3) % 3;
    if (x < B || y < B || x > hi || y > hi) k[i] = 7;
  }
  for (i = 0; i < WMG_CITY_CELLS.length; i++) k[(cy + WMG_CITY_CELLS[i][1]) * N + cx + WMG_CITY_CELLS[i][0]] = 6;
  for (i = 0; i < WMG_CITY_YARD.length; i++) k[(cy + WMG_CITY_YARD[i][1]) * N + cx + WMG_CITY_YARD[i][0]] = 8;
  var KEEP = C.keep;
  for (si = 0; si < S; si++) {   // 席位:保留圈(山 / 石 / 城池不放)、河讓出圈;席位 1~ 先蓋成主城形狀(k 6 / 8、zone 3)讓路 / 城池 / 山避開,生成尾端還原成平地(只留 zone 3)
    sq = wmHexRange(seats[si].c, seats[si].r, KEEP, N);
    for (i = 0; i < sq.length; i++) keepMap[sq[i]] = 1;
    sq = wmHexRange(seats[si].c, seats[si].r, C.riverGap - 1, N);
    for (i = 0; i < sq.length; i++) gapMap[sq[i]] = 1;
    if (si === 0) continue;
    for (i = 0; i < WMG_CITY_CELLS.length; i++) { sr = (seats[si].r + WMG_CITY_CELLS[i][1]) * N + seats[si].c + WMG_CITY_CELLS[i][0]; k[sr] = 6; zone[sr] = 3; }
    for (i = 0; i < WMG_CITY_YARD.length; i++) { sr = (seats[si].r + WMG_CITY_YARD[i][1]) * N + seats[si].c + WMG_CITY_YARD[i][0]; k[sr] = 8; zone[sr] = 3; }
  }
  function keep(gx, gy) { return keepMap[gy * N + gx] === 1; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function addPiece(id, gi) {
    var cells = WMG_PIECES[id], r0 = Math.floor(gi / N), c0b = gi % N, m, q, idx = pcs.length;
    pcs.push({ id: id, gi: gi });
    for (m = 0; m < cells.length; m++) { q = (r0 + cells[m][0]) * N + c0b + cells[m][1]; k[q] = id === 'O1' ? 2 : 1; pm[q] = idx; }
  }

  // 1 河:一條,從可玩區一邊走到對邊(c / r 單步 = 六邊形鄰格,連通,偏向低處),離主城 ≥ riverGap,每 fordEvery 格一個淺灘
  (function () {
    var vert = rng() < 0.5, side = rng() < 0.5 ? 1 : -1, a, b, rlo, rhi, db, nb, hl, hh, list = [], gx, gy, step;
    if (side > 0) { rlo = cx + C.riverGap; rhi = hi; } else { rlo = lo; rhi = cx - C.riverGap; }
    b = clamp(cx + side * (9 + Math.floor(rng() * 12)), rlo, rhi);
    function mark(aa, bb) { gx = vert ? bb : aa; gy = vert ? aa : bb; var q = gy * N + gx; if (k[q] === 0 && !gapMap[q]) { k[q] = 3; list.push(q); } }
    for (a = lo; a <= hi; a++) {
      db = 0;
      if (rng() < 0.45) {
        hl = wmgFbmCR(seed, vert ? b - 1 : a, vert ? a : b - 1); hh = wmgFbmCR(seed, vert ? b + 1 : a, vert ? a : b + 1);
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

  // 2 道路:主城 → 兩個邊(一條沿 c 向、一條沿 r 向;起點 = 主城距離 2 圈上的格),6 向 A*;過河的河格變橋(道路),原淺灘維持淺灘
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
    var nodes = [], FP = C.fp, npass = 0, sd, sIdx, seatPts = [], hexD = wmHexDist, h01 = function (a1, b1) { return wmGenHash01(seed, a1, b1 + 700); }, p, pa, j, c, a, rr, tx, ty, tries, R, R2, m, q, d, bd, bi, bj, inN, conn, pt, sp, ports, cl, path, s0, o0, fr, e, d1, d2, dir, ax, cc0, rr0, ord = { county: 0, jun: 1, zhou: 2, pass: 3 };
    function mk(type, c0b, r0, axis) {
      var f = FP[type], sw = type === 'pass' && axis === 1;
      return { type: type, c0: c0b, r0: r0, fw: sw ? f[1] : f[0], fh: sw ? f[0] : f[1], axis: type === 'pass' ? axis : -1 };
    }
    function gatesOf(Q) {   // 縣 / 郡 / 州:門只開前面兩邊(side 1 = c+1 面、side 2 = r+1 面),位置 = gateIx 索引;關只有門道兩端
      var mc, mr, ix;
      if (Q.type === 'pass') {
        if (Q.axis === 0) { mr = Q.r0 + 1; return [{ side: 3, c: Q.c0, r: mr, oc: Q.c0 - 1, ro: mr }, { side: 1, c: Q.c0 + 1, r: mr, oc: Q.c0 + 2, ro: mr }]; }
        mc = Q.c0 + 1; return [{ side: 0, c: mc, r: Q.r0, oc: mc, ro: Q.r0 - 1 }, { side: 2, c: mc, r: Q.r0 + 1, oc: mc, ro: Q.r0 + 2 }];
      }
      ix = C.gateIx[Q.type]; mc = Q.c0 + ix; mr = Q.r0 + ix;
      return [{ side: 1, c: Q.c0 + Q.fw - 1, r: mr, oc: Q.c0 + Q.fw, ro: mr }, { side: 2, c: mc, r: Q.r0 + Q.fh - 1, oc: mc, ro: Q.r0 + Q.fh }];
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
      var gx, gy, gi, kv = Q.type === 'county' ? 9 : (Q.type === 'jun' ? 11 : (Q.type === 'zhou' ? 12 : 10)), g, door = {};
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
    function around(type, sd2, a2, rr2) {   // 目標附近螺旋找;放不下換角度 / 半徑再找(第 0 次 = 舊行為)
      var f = FP[type], t2, R3, aa, r3;
      for (t2 = 0; t2 < (multi ? 8 : 1); t2++) {
        aa = a2 + t2 * 0.9; r3 = rr2 + (t2 % 3) * 2;
        R3 = spiral(type, Math.round(sd2.c + Math.cos(aa) * r3) - Math.floor(f[0] / 2), Math.round(sd2.r + Math.sin(aa) * r3) - Math.floor(f[1] / 2), 0, SPR, null);
        if (R3) return R3;
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
        if (Math.abs(d2 - d1) !== 1 && Math.abs(d2 - d1) !== N) continue;   // 只收沿 c / r 軸的直段(關 2×4 的軸向),斜走(±(N + 1)、±(N − 1))略過
        ax = Math.abs(d2 - d1) === 1 ? 0 : 1;
        if (ax === 0) { cc0 = Math.min(d1 % N, d2 % N); rr0 = Math.floor(d1 / N) - 1; } else { cc0 = d1 % N - 1; rr0 = Math.min(Math.floor(d1 / N), Math.floor(d2 / N)); }
        fr = {}; fr[pa[j]] = 1; fr[d1] = 1; fr[d2] = 1; fr[pa[j + 3]] = 1;
        R2 = mk('pass', cc0, rr0, ax);
        if (canPlace(R2, fr)) R = R2;
      }
      if (R) { put(R); R.ti = npass++; }
    }
    // 關(其餘):靠邊的雜湊角度;軸 = 最近邊界方向;外端門外格離邊 2~3 格,另鋪一條路到邊界
    for (tries = 0; npass < nP && tries < nP * 3 + 12; tries++) {
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
    while (npass < nP) { nfail.push('關放不下'); npass++; }
    // 州城(共享世界;M1 zhouN = 0):黃金角螺旋散開、半徑依序外擴,先於郡 / 縣放(大的先放)
    for (j = 0; j < C.zhouN; j++) {
      a = h01(0, 7) * 2 * Math.PI + j * 2.399963229728653;
      rr = C.zhouR[0] + ((C.zhouR[1] > 0 ? C.zhouR[1] : (hi - lo) / 2 - 8) - C.zhouR[0]) * Math.sqrt((j + 0.5) / C.zhouN);
      R = spiral('zhou', Math.round(cx + Math.cos(a) * rr) - Math.floor(FP.zhou[0] / 2), Math.round(cy + Math.sin(a) * rr) - Math.floor(FP.zhou[1] / 2), 0, SPR, null);
      if (R) { put(R); R.ti = j; } else nfail.push('州 ' + j + ' 放不下');
    }
    // 郡:兩座相對(a0 與 a0 + π),中心離主城 junR
    for (j = 0; j < nJ; j++) {
      sd = multi ? seats[(j * 3 + 1) % S] : { c: cx, r: cy };
      a = multi ? h01(j, 5) * 2 * Math.PI : h01(0, 5) * 2 * Math.PI + j * Math.PI;
      rr = C.junR[0] + h01(j, 6) * (C.junR[1] - C.junR[0]);
      R = around('jun', sd, a, rr);
      if (R) { put(R); R.ti = j; } else nfail.push('郡 ' + j + ' 放不下');
    }
    // 縣:6 個扇區環繞主城,角度加抖動,中心離主城 countyR
    for (c = 0; c < nC; c++) {
      sd = multi ? seats[c % S] : { c: cx, r: cy };
      a = multi ? h01(c, 1) * 2 * Math.PI : ((c + 0.2 + 0.6 * h01(c, 1)) / nC) * 2 * Math.PI;
      rr = C.countyR[0] + h01(c, 2) * (C.countyR[1] - C.countyR[0]);
      R = around('county', sd, a, rr);
      if (R) { put(R); R.ti = c; } else nfail.push('縣 ' + c + ' 放不下');
    }
    // 道路網:Prim 最小生成樹(主城為根)。每座城池挑「已連上的接路格 → 門外格」曼哈頓距離最近的一組,A* 鋪到門外格;那一門 = 主城門
    ports = wmHexRing(cx, cy, 2, N).map(function (gi2) { return [gi2 % N, Math.floor(gi2 / N)]; }).filter(function (z) { return wmgWalk(k[z[1] * N + z[0]]); });   // 主城距離 2 的 12 格中可走的
    conn = [{ city: true, type: 'city', src: ports.length ? ports : [[cx + 2, cy]] }];
    inN = nodes.slice();
    for (sIdx = 1; sIdx < S; sIdx++) {   // 其他席位:接進同一棵道路樹(ports = 主城外 2 圈的可走格,每 3 格取 1)
      seatPts = wmHexRing(seats[sIdx].c, seats[sIdx].r, 2, N).filter(function (gi2) { return wmgWalk(k[gi2]); }).filter(function (gi2, ix) { return ix % 3 === 0; });
      inN.push({ type: 'seat', ti: sIdx, mg: -1, g: seatPts.map(function (gi2) { return { oc: gi2 % N, ro: Math.floor(gi2 / N) }; }) });
    }
    function pairD(cq, nn) {   // 已連上的 cq 與待連 nn 的距離(含偏好加成)
      var dd = Infinity, j2, c2, e2;
      for (j2 = 0; j2 < cq.src.length; j2++) for (c2 = 0; c2 < nn.g.length; c2++) { e2 = hexD(cq.src[j2][0], cq.src[j2][1], nn.g[c2].oc, nn.g[c2].ro); if (e2 < dd) dd = e2; }
      if (cq.city || cq.type === 'seat') dd += 4;   // 主城端偏好縣連主城、關接縣
      if (nn.type === 'pass' && cq.type === 'pass') dd += 6;
      return dd;
    }
    for (m = 0; m < inN.length; m++) { inN[m].bd = pairD(conn[0], inN[m]); inN[m].bq = 0; }   // Prim:每個待連節點記「到已連集合」的最近一筆(新連上的只更新一次,同距離保留先到者 = 與全量掃描同結果)
    while (inN.length) {
      bd = Infinity; bi = -1; bj = -1;
      for (m = 0; m < inN.length; m++) if (inN[m].bd < bd) { bd = inN[m].bd; bi = m; bj = inN[m].bq; }
      pt = inN.splice(bi, 1)[0]; sp = conn[bj];
      cl = [];
      for (j = 0; j < sp.src.length; j++) for (c = 0; c < pt.g.length; c++) cl.push({ d: hexD(sp.src[j][0], sp.src[j][1], pt.g[c].oc, pt.g[c].ro), s: j, g: c });
      cl.sort(function (u, v) { return u.d - v.d || u.g - v.g || u.s - v.s; });
      path = null;
      for (m = 0; m < cl.length && m < 8 && !path; m++) {
        path = wmgRoadPath(k, N, seed, sp.src[cl[m].s][0], sp.src[cl[m].s][1], pt.g[cl[m].g].oc, pt.g[cl[m].g].ro);
        if (path) { lay(path); pt.mg = cl[m].g; }
      }
      if (!path && pt.type !== 'seat') nfail.push((pt.type === 'pass' ? '關 ' : (pt.type === 'jun' ? '郡 ' : (pt.type === 'zhou' ? '州 ' : '縣 '))) + pt.ti + ' 鋪不到路');
      conn.push({ type: pt.type, src: pt.type === 'pass' || pt.type === 'seat' || pt.mg < 0 ? pt.g.map(function (g) { return [g.oc, g.ro]; }) : [[pt.g[pt.mg].oc, pt.g[pt.mg].ro]] });
      for (m = 0; m < inN.length; m++) { d = pairD(conn[conn.length - 1], inN[m]); if (d < inN[m].bd) { inN[m].bd = d; inN[m].bq = conn.length - 1; } }
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
      h = wmgFbmCR(seed, c0b + 0.5, r0 + 0.5);
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

  // 5 連通:主城泛洪(6 向),封閉區的平地改成大石(淺灘改河、道路改石;城池占地與城郊不改),保證所有可走格到得了
  (function () {
    var seen = new Uint8Array(n), q = new Int32Array(n), qh = 0, qt = 0, u, ux, uy, j, vx, vy, v, HC = WMHEX_DC, HR = WMHEX_DR;
    seen[c0] = 1; q[qt++] = c0;
    while (qh < qt) {
      u = q[qh++]; ux = u % N; uy = (u - ux) / N;
      for (j = 0; j < 6; j++) {
        vx = ux + HC[j]; vy = uy + HR[j];
        if (vx < 0 || vy < 0 || vx >= N || vy >= N) continue;
        v = vy * N + vx;
        if (seen[v] || !WMG_WALK[k[v]]) continue;
        seen[v] = 1; q[qt++] = v;
      }
    }
    for (u = 0; u < n; u++) {
      if (!WMG_WALK[k[u]] || seen[u] || zone[u]) continue;   // 城池占地 / 城郊不改石(封閉 → walkOk 失敗 → 重試)
      if (k[u] === 4) k[u] = 3; else addPiece('O1', u);
    }
  })();

  for (si = 1; si < S; si++) {   // 其他席位的九宮格還原成平地(zone 3 保留;之後啟用時由多人層改回主城)
    for (i = 0; i < WMG_CITY_CELLS.length; i++) k[(seats[si].r + WMG_CITY_CELLS[i][1]) * N + seats[si].c + WMG_CITY_CELLS[i][0]] = 0;
    for (i = 0; i < WMG_CITY_YARD.length; i++) k[(seats[si].r + WMG_CITY_YARD[i][1]) * N + seats[si].c + WMG_CITY_YARD[i][0]] = 0;
  }
  nodesOut = nodesOut || [];
  WG = { gv: C.gv, size: N, seed: seed, seed0: seed, tries: 1, fallback: false, border: B, cx: cx, cy: cy, c0: c0, k: k, g: g, pm: pm, pcs: pcs, nodes: nodesOut, nodeOf: nodeOf, zone: zone, nfail: nfail, d: null, pv: null, chk: null, seats: seats.map(function (o, idx) { return { id: idx, c: o.c, r: o.r, gi: o.r * N + o.c, act: idx === 0 }; }), seatN: S, nodeN: nC + nJ + nP + C.zhouN, ds: null, so: null };
  r = wmDistCalc(WG, Infinity);   // 只跑一次全圖 Dijkstra:d / pv = 成本 ≤ reach 的部分(Dijkstra 到某格的值與是否設上限無關),d0 = 全圖
  WG.d0 = r.d; WG.d = new Float32Array(n); WG.pv = new Int32Array(n);
  for (i = 0; i < n; i++) { if (r.d[i] <= C.reach) { WG.d[i] = r.d[i]; WG.pv[i] = r.pv[i]; } else { WG.d[i] = Infinity; WG.pv[i] = -1; } }
  wmgNodeAdj(WG, WG.d0);
  WG.rd = null;
  if (multi) { r = wmgSeatDist(WG); WG.ds = r.d; WG.so = r.so; }
  else { WG.ds = WG.d0; WG.so = new Int8Array(n); for (i = 0; i < n; i++) WG.so[i] = isFinite(WG.d0[i]) ? 0 : -1; }
  wmgRes(WG);
  t = wmGenCheck(WG);
  WG.chk = t;
  return WG;
}

// 生成世界:seed 整數(0~2³²−1);size 預設 WMG_CFG.size。檢查失敗 seed+1 重試最多 retry 次,仍失敗用保底種子(wmGenCheck 結果在 WG.chk)
function wmGen(seed, size, opt) {   // opt = {seats: 席位數(預設 wmgSeatsFor(size):size ≥ 96 → 30、否則 1 = 舊單機圖;單機只啟用席位 0)}
  var C = WMG_CFG, N = Math.floor(Number(size)) || C.size, s, t, WG, S;
  if (N < 2 * C.border + 15) N = 2 * C.border + 15;
  s = (Math.floor(Number(seed)) || 0) >>> 0;
  seed = s;
  S = opt && opt.seats >= 1 ? Math.floor(opt.seats) : wmgSeatsFor(N);
  for (t = 0; t < C.retry; t++) {
    WG = wmgBuild(s, N, S);
    if (WG.chk.ok) { WG.seed0 = seed; WG.tries = t + 1; return WG; }
    s = (s + 1) >>> 0;
  }
  WG = wmgBuild(C.fallbackSeed, N, S);
  WG.seed0 = seed; WG.tries = C.retry + 1; WG.fallback = true;
  return WG;
}
