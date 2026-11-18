// js/wmap_view.js — 六邊形大地圖畫面層(設計_地圖六邊形改版_規格.md 1.3、3、5;工作流 4;前身:M1 斜角大地圖 設計_M1視覺原型_實作計畫.md W1):
//   ?wmap=1 時掛載 #wmapRoot(整頁疊在最上,不動既有首頁 DOM);沒有 ?wmap=1 時本檔載入後什麼都不做(首頁逐像素不變)。
//   烘焙分塊:256 CSS px 見方的 canvas(只建視窗內 + 預取一圈、上限 20 塊、LRU 回收),整張 world 用 transform 平移;
//   每格 = 一塊有厚度的六邊形地磚:頂面(貼圖取樣)+ 側壁(只在「正下 / 左下 / 右下鄰格不存在或比本格低」時畫)+ 倒角 + 深褐描邊;依格中心 y(c + r)由小到大畫,前排側壁 / 頂面蓋住後排;
//   水格(河 / 淺灘 / 橋下)頂面下沉 T/2,岸邊露出側壁;地形交界格疊「鄰格第二貼圖 + 漸層遮罩」過渡帶(WMAP_VCFG.trans 開關);邊界帶霧改六邊形。
//   覆蓋層 DOM = 只有「我的朱紅框」的格才有節點(節點池)+ 1 個選取框;領地等級靠烘焙畫面的物件疏密 / 大小 / 地面覆蓋表現(wmap_res.js 演算法、wmap_art.js 圖形),地圖上沒有任何文字或數字;視窗外不渲染;拖曳 / 滾輪 / 雙指 / 按鈕兩段縮放(格寬 64 / 96);點擊命中 → 選取框 + 資訊列。
//   目前資料 = wmGen(種子) 的世界;領地(Lv / 種類)與我的占領是「示範資料」(wmapDemo*,由 W3 / W5 換成真資料,接口見下)。
//   ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:wm_hex.js、wm_gen.js、wmap_proj.js、wmap_art.js、wmap_res.js 之後。命名:全域一律 wmap* / WMAP_*。
//
// ───────── 公開 API(給 W2 / W3 / W5 / W6;軍隊層請用 wmap_proj.js) ─────────
//   WMAP                      狀態物件:{WG, G, zi, cam, vw, vh, root, world, own:{gi:1}, sel:gi|−1, onSelect, cellInfo, lv(Uint8Array:1 = 水格下沉), ...}
//   WMAP_VCFG                 畫面參數(可調 / 可關):{edge: 'all' | 'diff' | 'none'(描邊:每格 / 只在不同地形交界 / 不畫), trans: 地形過渡帶開關, bevel: 倒角開關, lw: 描邊線寬(× 格寬), edgeA: 描邊透明度, wall: 側壁色}
//   wmapMount(o) → bool       o = {seed, size, parent}:建立畫面並開始;已掛載回 false。?wmap=1 時載入後自動以預設值呼叫(直向預設格寬 64、橫向 96)
//   wmapUnmount()             移除畫面與監聽
//   wmapSetCam(u, v)          鏡頭置中到連續座標 (u, v)(格座標,中心 = c + 0.5);會夾住並重畫
//   wmapSetZoom(idx, ax, ay)  兩段縮放(0 / 1);(ax, ay) = 視窗內錨點像素,省略 = 視窗中心
//   wmapSelect(gi)            選取一格(−1 = 取消);會呼叫 WMAP.onSelect(gi)
//   wmapInvalidate()          格內容改變(占領 / 刷新)後重烘全部可見分塊與朱紅框
//   wmapCellText(gi) → 字串   資訊列文字(座標 / 地形 / Lv / 領地種類 / 去程)
//   WMAP.cellInfo(gi) → {ty:'farm'|'mine'|'hunt'|'lumber'|'quarry', lv}|null   該格是否為資源領地、等級多少(預設 = 示範資料;W3 以 wmCell 取代)
//   wmapHit(x, y) → {gi, node}  視窗內像素的命中(含往上凸物件);城池(縣 4×4 / 郡 6×6 / 州 8×8 / 關 2×4)= 點占地頂面外殼往上拉高的凸多邊形內任何一點,gi = node.gi(主城門格)、node = wm_gen 的 WG.nodes 項;主城 = {gi: c0, node: null};點一下選取時 WMAP.onSelect(gi, node);選取框 = 單一元素(占地外框 + 內部六邊形格)
//   wmapNodeShapes() → [{node, gi, dep, p:[x,y…]}]   城池(含主城)的點選形(世界座標凸多邊形,隨縮放重算並快取),前面的在前
//   wmapNodeDim(key, fw, fh) → {cw, ch, ax, ay, art}   城池圖尺寸(規格 3:底座寬 = 192 × (fw + fh − 2) + 256、底座高 = 72 × (fw + fh − 2) + 180,往上 U = 底座高 × 0.6)
//   wmapRoadArms(gi) → 6 位元遮罩(bit d = 朝 d 向鄰格有路臂,d 同 wm_hex.js);wmapRiverNb(gi) / wmapRiverDg(gi) → 6 個布林;wmapBridge(gi) → bool
//   wmapStats() → {chunks, bakes, bakeAvgMs, dom, owns, zoom, vw, vh}      量測用
//
// ───────── 與 wmap_art.js(工作流 5)的接口 ─────────
//   頂面:貼圖已載入(wmapTexReady)→ 世界錨定 pattern(wmapTexPattern(g, 貼圖鍵, wmapTexSg(W), 0, 0))交給 wmapArtTexHex(側壁 / 描邊由本檔自畫:sides 0、line 0);未載入 → 貼 wmapArtGet(wmapArtHexKey(地面, 款))(程式紋理單格 256 × 180,錨點 (128, 72));
//   貼圖載入:wmapMount 呼叫 wmapTexLoad(…);載入完 WMAP_TEX.onload → 清分塊重烘(去抖 120 ms);過渡遮罩 = wmapArtGet('mask_<d + 6 × 款>');
//   圖塊放置:WMAP_IMG[key] = {w, h, ax, ay}(wmapNodeDim / 拼塊物件用它的錨點);沒有該鍵 → 程式色塊(六邊形稜柱)。
//   道路 / 河:道路形狀本檔自畫(6 臂、批次填 gt_road 紋理);河 = 下沉的水格頂面(貼圖 river / shoal)+ wmapArtRiver 'hi' 高光層。

var WMAP = { on: false, WG: null, G: null, zi: 1, cam: { u: 32, v: 32 }, vw: 0, vh: 0, root: null, vp: null, world: null, own: {}, sel: -1, onSelect: null, cellInfo: null,
  chunks: {}, nChunks: 0, stamp: 0, sc: {}, dpr: 1, raf: 0, objs: [], res: {}, resList: [], F: null, pat: {}, tile: {}, mask: {}, lv: null, lvWG: null, fpool: [], bsig: '', bakes: 0, bakeMs: 0, ptrs: {}, drag: null, wheelAcc: 0, wheelT: 0,
  selEls: [], card: null, hud: null, dbg: false, ground: null, seed: 0, B: 4, N: 64, listeners: [] };
var WMAP_KNAME = ['平地', '山', '大石', '河', '淺灘', '道路', '主城', '邊界', '城內庭院', '縣城', '關口', '郡城', '州城'];
var WMAP_TY = ['farm', 'mine', 'hunt', 'lumber', 'quarry'];
var WMAP_PRI = { grass: 6, wood: 5, sand: 4, dirt: 3, rammed: 2, rock: 0 };
// 畫面參數(規格待決 3:描邊遊戲內細一點;'diff' = 只在不同地形交界描邊;trans = 地形交界過渡帶開關)
var WMAP_VCFG = {
  edge: 'all', trans: true, bevel: true, lw: 0.016, edgeA: 0.5, ink: '#4a3b2c',
  wall: { grass: '#8d7a45', dirt: '#9c7c48', wood: '#6e7a40', rock: '#837b69', rammed: '#9a8a62', water: '#5f93ad', bank: '#c9b783' },
  col: { grass: ['#9fc95c', '#93be52', '#a7d065'], dirt: ['#cfa86a', '#c6a062'], wood: ['#79a64a', '#6f9c44'], rock: ['#a79f8c', '#9d9583'], rammed: ['#c9b78c', '#c1ae82'], water: ['#58a5d4', '#4f9bcb', '#62adda'], ford: ['#8ec6d6'] },
  fog: '#dfe9ec', n: { grass: 3, dirt: 2, wood: 2, rock: 2, rammed: 2 }   // 各地面的款數(v % n)
};
// 城池圖的邏輯尺寸(格寬 256 單位)= 底座(規格 3)+ 往上 U = 底座高 × 0.6;wmapNodeDim 依 fw / fh 算,不再查表

// ───────── 示範資料(W3 / W5 換掉) ─────────
function wmapNoise(seed, x, y, sc) {
  var fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, a, b, c, d, s = seed ^ (sc * 0x2545);
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  a = wmGenHash01(s, x0, y0); b = wmGenHash01(s, x0 + 1, y0); c = wmGenHash01(s, x0, y0 + 1); d = wmGenHash01(s, x0 + 1, y0 + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function wmapDemoCellInfo(gi) {
  var WG = WMAP.WG, h, cost, lv;
  if (WG && WG.rt) return WG.rt[gi] >= 0 ? { ty: WMAP_TY[WG.rt[gi]], lv: WG.rl[gi] } : null;   // gv 4+:資源由 wm_gen 範圍配額生成(WG.rt / rl;WMAP_TY 與 WMG_RES_TY 同序),外圍(d > reach)資源也回傳
  if (!WG || WG.k[gi] !== 0 || !isFinite(WG.d[gi]) || (WG.zone && WG.zone[gi])) return null;   // 城郊(zone 2)不放領地
  h = wmGenHash(WG.seed, gi, 77);
  if (h % 100 >= 20) return null;
  cost = WG.d[gi]; lv = Math.max(1, Math.min(10, wmGenRing(cost) + ((h >>> 12) % 3) - 1));
  return { ty: WMAP_TY[(h >>> 8) % 5], lv: lv };
}
function wmapInfoOf(gi) { return WMAP.cellInfo ? WMAP.cellInfo(gi) : wmapDemoCellInfo(gi); }

// ───────── 資料準備 ─────────
var WMAP_SAND = { river: 0.6, mine: 0.20 };   // 沙地機率(規格 4.1):6 鄰有河 / 淺灘、6 鄰有礦坑資源格;外觀專用,不影響走法 / 成本 / 資源
function wmapSandAt(gi) {   // 無資源、非城郊 / 城池占地的平地格 → 是否為沙地(確定性雜湊 wmGenHash01(seed, gi, 21 / 22);不讀時間 / 亂數)
  var WG = WMAP.WG, N = WG.size, nb, i, j, k, hasR = false, hasM = false;
  if (WG.k[gi] !== 0 || (WG.zone && WG.zone[gi]) || (WG.rt && WG.rt[gi] >= 0)) return false;
  nb = wmHexNbs(gi, N);
  for (i = 0; i < nb.length; i++) { j = nb[i]; k = WG.k[j]; if (k === 3 || k === 4) hasR = true; if (WG.rt && WG.rt[j] === 1 && WG.k[j] === 0) hasM = true; }
  if (hasR && wmGenHash01(WG.seed, gi, 21) < WMAP_SAND.river) return true;
  if (hasM && wmGenHash01(WG.seed, gi, 22) < WMAP_SAND.mine) return true;
  return false;
}
function wmapGroundType(gi) {   // 地面種類(只影響外觀);雜訊用地面等向座標 wmHexGround(否則被拉伸)
  var WG = WMAP.WG, N = WG.size, k = WG.k[gi], x = gi % N, y = (gi - x) / N, n1, n2, q = wmHexGround(x, y);
  if (k === 6 || k === 8 || k === 9 || k === 11 || k === 12) return 'rammed';   // 主城 / 縣 / 郡 / 州:夯土
  if (k === 10) return 'rock';                                     // 關的山壁
  if (k === 1) return 'rock';
  n1 = wmapNoise(WG.seed, q.x + 64, q.y + 64, 9); n2 = wmapNoise(WG.seed + 7, q.x + 64, q.y + 64, 7);
  if (k === 7) return n1 > 0.45 ? 'wood' : 'rock';
  if (k === 0 && wmapSandAt(gi)) return 'sand';                    // 沙地(外觀地面,規格 4.1):河岸 / 淺灘旁 6 成、礦坑旁 3.5 成;只在無資源的一般平地,雜訊結果不變
  if (n1 > 0.72) return 'dirt';
  if (n2 > 0.7) return 'wood';
  return 'grass';
}
function wmapPassAxis(nd) {   // 關口門牆朝向:0 = 道路沿 c(u)方向進出、1 = 沿 r(v)方向(gv 3 起直接讀 node.axis)
  var WG = WMAP.WG, N = WG.size, c = nd.gi % N, r = (nd.gi - c) / N;
  if (nd.axis === 0 || nd.axis === 1) return nd.axis;
  if (WG.k[nd.gi - 1] === 5 || WG.k[nd.gi + 1] === 5) return 0;
  if (r > 0 && (WG.k[nd.gi - N] === 5 || WG.k[nd.gi + N] === 5)) return 1;
  return nd.adj >= 0 && nd.adj % N !== c ? 0 : 1;
}
function wmapNodeKey(nd) { return nd.type === 'pass' ? 'PASS' + wmapPassAxis(nd) : (nd.type === 'jun' ? 'JUN' : (nd.type === 'zhou' ? 'ZHOU' : 'COUNTY')); }
function wmapImgOf(key, fw, fh) {   // 圖塊的畫布尺寸與錨點:WMAP_IMG(正式圖接口)優先,其次 WMAP_PIECE(程式圖;fw / fh 給了就要占地相符);都沒有 → null(畫六邊形稜柱色塊)
  var im = typeof WMAP_IMG !== 'undefined' && WMAP_IMG ? WMAP_IMG[key] : null, P = typeof WMAP_PIECE !== 'undefined' && WMAP_PIECE ? WMAP_PIECE[key] : null;
  if (P && fw !== undefined && (P.fw !== fw || P.fh !== fh)) return null;
  if (im && im.w && im.h) return im;
  if (P && P.cw && P.ch && P.ax !== undefined) return { w: P.cw, h: P.ch, ax: P.ax, ay: P.ay };
  return null;
}
function wmapBaseH(fw, fh) { return 72 * (fw + fh - 2) + 180; }   // 圖塊底座高(格寬 256 單位;含側壁)
function wmapNodeDim(key, fw, fh) {   // → {cw, ch, ax, ay, art}:有圖檔接口 WMAP_IMG[key] = 用圖;否則依規格 3 公式算尺寸 + 色塊
  var im = wmapImgOf(key, fw, fh), bw = 192 * (fw + fh - 2) + 256, bh = wmapBaseH(fw, fh);
  if (im && im.w && im.h) return { cw: im.w, ch: im.h, ax: im.ax !== undefined ? im.ax : 128 + 192 * (fh - 1), ay: im.ay !== undefined ? im.ay : im.h - bh + 72, art: true };
  return { cw: bw, ch: Math.round(bh * 1.6), ax: 128 + 192 * (fh - 1), ay: Math.round(bh * 1.6) - bh + 72, art: false };
}
function wmapBuildLv() {   // 水格(河 / 淺灘 / 橋格)= 1:頂面下沉 T/2
  var WG = WMAP.WG, n = WG.size * WG.size, i, k, lv = new Uint8Array(n);
  WMAP.N = WG.size;
  for (i = 0; i < n; i++) { k = WG.k[i]; if (k === 3 || k === 4 || (k === 5 && wmapBridge(i))) lv[i] = 1; }
  WMAP.lv = lv; WMAP.lvWG = WG;
}
function wmapBuildData() {
  var WG = WMAP.WG, N = WG.size, B = WG.border, n = N * N, i, j, x, y, gt = new Array(n), objs = [], p, id, P, info, h, tall, e, rty = new Int8Array(n).fill(-1), rlv = new Uint8Array(n), rok = new Uint8Array(n), im, dmax, cl;
  WMAP.N = N; WMAP.B = B; WMAP.res = {}; WMAP.resList = []; WMAP.own = {};
  wmapBuildLv();
  for (i = 0; i < n; i++) gt[i] = wmapGroundType(i);
  WMAP.ground = gt;
  for (i = 0; i < WG.pcs.length; i++) {   // 山 / 大石
    p = WG.pcs[i]; id = p.id; P = WMAP_PIECE[id]; if (!P) continue;
    im = wmapImgOf(id); dmax = 0;
    for (j = 0; j < P.cells.length; j++) dmax = Math.max(dmax, P.cells[j][0] + P.cells[j][1]);   // 最前格 = c + r 最大(cells = [dr, dc])
    objs.push({ key: id, c0: p.gi % N, r0: Math.floor(p.gi / N), fw: P.fw, fh: P.fh, cw: im ? im.w : P.cw, ch: im ? im.h : P.ch, ax: im ? im.ax : undefined, ay: im ? im.ay : undefined, art: !!im, cells: P.cells, dep: (p.gi % N) + Math.floor(p.gi / N) + dmax, al: 1 });
  }
  if (WG.nodes) for (i = 0; i < WG.nodes.length; i++) {   // 縣 4×4 / 郡 6×6 / 州 8×8 / 關 2×4(整座一個物件;占地全部格,深度排序取最前格)
    e = WG.nodes[i]; id = wmapNodeKey(e); P = wmapNodeDim(id, e.fw, e.fh);
    objs.push({ key: id, c0: e.c0, r0: e.r0, fw: e.fw, fh: e.fh, cw: P.cw, ch: P.ch, ax: P.ax, ay: P.ay, al: 1, art: P.art, block: !P.art, dep: e.c0 + e.r0 + e.fw + e.fh - 2, nd: e });
  }
  if (!WG.noCity) { P = wmapNodeDim('CITY', 3, 3); objs.push({ key: 'CITY', c0: WG.cx - 1, r0: WG.cy - 1, fw: 3, fh: 3, cw: P.cw, ch: P.ch, ax: P.ax, ay: P.ay, al: 1, art: P.art, block: !P.art, dep: WG.cx + WG.cy + 1, nd: null }); }
  for (i = 0; i < n; i++) {   // 領地(示範)與邊界帶裝飾
    x = i % N; y = (i - x) / N;
    if (WG.k[i] === 0) {
      rok[i] = WG.zone && WG.zone[i] ? 0 : 1;   // 城郊(zone 2)不放散布物件
      info = wmapInfoOf(i);
      if (info) {
        WMAP.res[i] = info; WMAP.resList.push(i); rty[i] = WMAP_RES_ORDER.indexOf(info.ty); rlv[i] = info.lv;
        h = wmGenHash(WG.seed, i, 78);
        if (WG.d[i] < 5 && h % 3 === 0 && WMAP.resList.length < 400) WMAP.own[i] = 1;
      }
    } else if (WG.k[i] === 7) {
      h = wmGenHash(WG.seed, i, 79) % 100;
      tall = (x < B || y < B) && x < N - B && y < N - B;
      e = Math.min(x, y, N - 1 - x, N - 1 - y);
      id = null;
      if (tall) id = h < 34 ? 'T1' : (h < 52 ? 'M1' : (h < 56 ? 'O1' : null));
      else id = h < 14 ? 'O1' : null;
      if (id) { P = WMAP_PIECE[id]; im = wmapImgOf(id); objs.push({ key: id, c0: x, r0: y, fw: 1, fh: 1, cw: im ? im.w : P.cw, ch: im ? im.h : P.ch, ax: im ? im.ax : undefined, ay: im ? im.ay : undefined, art: !!im, cells: [[0, 0]], dep: x + y, al: 0.95 - 0.16 * (B - 1 - e) }); }
    }
  }
  WMAP.F = wmapResPrep({ N: N, rty: rty, rlv: rlv, rok: rok });
  objs.sort(function (a, b) { return a.dep - b.dep || (a.c0 - a.r0) - (b.c0 - b.r0); });   // 排序鍵 = 占地中最前(c + r 最大)那格的中心 y
  WMAP.objs = objs;
}

// ───────── 縮放後的圖(依格寬與 DPR 預縮,分塊畫的時候 1:1 貼) ─────────
function wmapScaled(key) {
  var s = WMAP.sc[key], a, k, w, h, c, g;
  if (s) return s;
  k = WMAP.G.W / 256 * WMAP.dpr;
  if (typeof WMAP_CITY_KEYS !== 'undefined' && WMAP_CITY_KEYS[key] === 1 && typeof wmapArtCityQ === 'function') {   // 城池:直接按目標倍率(= k)畫向量,不再先畫 1× 再縮(wmapArtCityQ 的第一參數 = 格寬 W)
    a = wmapArtGet(key, wmapArtCityQ(WMAP.G.W, WMAP.dpr, WMAP.dpr <= 1));
    if (!a) return null;
    if (a.spr && typeof wmapArtSprScaled === 'function') { s = wmapArtSprScaled(a, k); s.k = 1 / WMAP.dpr; s.spr = a.spr; WMAP.sc[key] = s; return s; }   // 正式精靈圖(wmap_art.js wmapArtSprKick)
    s = { c: a.c, k: 1 / WMAP.dpr }; WMAP.sc[key] = s; return s;
  }
  a = wmapArtGet(key); if (!a) return null;
  if (a.spr && typeof wmapArtSprScaled === 'function') { s = wmapArtSprScaled(a, k); s.k = 1 / WMAP.dpr; s.spr = a.spr; WMAP.sc[key] = s; return s; }
  if (Math.abs(k - 1) < 0.03) { s = { c: a.c, k: 1 / WMAP.dpr }; }
  else {
    w = Math.max(1, Math.round(a.cw * k)); h = Math.max(1, Math.round(a.ch * k));
    c = document.createElement('canvas'); c.width = w; c.height = h; g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (k < 0.6) {   // 縮得多:先半縮再縮,避免鋸齒
      var m = document.createElement('canvas'); m.width = Math.round(a.cw / 2); m.height = Math.round(a.ch / 2);
      var mg = m.getContext('2d'); mg.imageSmoothingQuality = 'high'; mg.drawImage(a.c, 0, 0, m.width, m.height); g.drawImage(m, 0, 0, w, h);
    } else g.drawImage(a.c, 0, 0, w, h);
    s = { c: c, k: 1 / WMAP.dpr };
  }
  WMAP.sc[key] = s;
  return s;
}
function wmapDrawArt(g, key, x, y, cw, ch) {   // (x, y) = 圖左上世界座標;cw / ch 原圖尺寸;畫成 cw × k 的 CSS px
  var s = wmapScaled(key), k = WMAP.G.W / 256, p;
  if (!s) return;
  if (s.spr) {   // 精靈圖:只畫圖內不透明範圍(畫布左上 + (ox, oy) × k);鏡像鍵 = 水平翻轉
    p = s.spr;
    if (p.mir) { g.save(); g.translate(x + (p.ox + p.ow) * k, y + p.oy * k); g.scale(-1, 1); g.drawImage(s.c, s.sx, s.sy, s.sw, s.sh, 0, 0, p.ow * k, p.oh * k); g.restore(); }
    else g.drawImage(s.c, s.sx, s.sy, s.sw, s.sh, x + p.ox * k, y + p.oy * k, p.ow * k, p.oh * k);
    return;
  }
  g.drawImage(s.c, x, y, cw * k, ch * k);
}

// ───────── 六邊形頂面貼圖(程式退路:256 × 180 單格圖塊,錨點 (128, 72);正式圖到了由 wmapArtTexHex 提供) ─────────
function wmapVRng(seed) {
  var a = seed >>> 0;
  return function () {
    var t;
    a = (a + 0x6D2B79F5) >>> 0;
    t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function wmapVShade(hex, k) {
  var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * k))); gg = Math.max(0, Math.min(255, Math.round(gg * k))); b = Math.max(0, Math.min(255, Math.round(b * k)));
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
}
function wmapHexVerts(cx, cy, W, H, infl) {   // 頂面六頂點(infl = 外擴 px)
  var w = W / 2 + infl, h = H / 2 + infl * 0.6, q = W / 4;
  return [cx - w, cy, cx - q, cy - h, cx + q, cy - h, cx + w, cy, cx + q, cy + h, cx - q, cy + h];
}
function wmapHexPath(g, cx, cy, W, H, infl) {
  var p = wmapHexVerts(cx, cy, W, H, infl || 0);
  g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); g.lineTo(p[4], p[5]); g.lineTo(p[6], p[7]); g.lineTo(p[8], p[9]); g.lineTo(p[10], p[11]); g.closePath();
}
function wmapTexNeeded() { return ['grass', 'mud', 'wood', 'rock', 'rammed', 'river', 'shoal', 'farm_a', 'farm_b', 'mine', 'hunt', 'sand']; }
function wmapTexKickLoad() {   // 非同步載入頂面貼圖;載入完重烘(去抖);沒有 wmap_art.js 的貼圖函式 / 沒有 Promise → 全部走程式退路
  var ks = wmapTexNeeded(), i;
  if (typeof wmapTexLoad !== 'function' || typeof WMAP_TEX === 'undefined') return;
  try { if (typeof wmapTexAutoRes === 'function') wmapTexSetRes(wmapTexAutoRes(WMAP.G.W, WMAP.dpr, WMAP.dpr <= 1, false)); if (typeof wmapTexTrim === 'function') wmapTexTrim(ks); } catch (e) { /* 用預設解析度 */ }
  WMAP_TEX.onload = function () {
    if (!WMAP.on) return;
    if (WMAP.texT) return;
    WMAP.texT = setTimeout(function () { WMAP.texT = 0; if (!WMAP.on) return; wmapClearChunks(); WMAP.pat = {}; WMAP.sc = {}; WMAP.bsig = ''; wmapSchedule(); }, 120);
  };
  for (i = 0; i < ks.length; i++) { try { wmapTexLoad(ks[i]); } catch (e) { /* 載入失敗 → 保持退路 */ } }
}
function wmapTexPat(g, key) {   // 貼圖鍵 → 世界錨定 pattern(未載入回 null);每縮放段快取
  var k = 'tex_' + key, pc = WMAP.bakePat, p;
  if (!pc || pc.g !== g) pc = WMAP.bakePat = { g: g };   // 同一張畫布每種貼圖只建一次 pattern(重用 → 相鄰格紋理連續)
  p = pc[k];
  if (p !== undefined) return p;
  p = (typeof wmapTexReady === 'function' && wmapTexReady(key)) ? wmapTexPattern(g, key, wmapTexSg(WMAP.G.W), 0, 0) : null;
  if (p) pc[k] = p;   // 沒載入不快取(載入後下一次烘焙就拿得到)
  return p;
}
function wmapHexTileOf(type, v) { return wmapScaled(wmapArtHexKey(type, v)); }   // 程式 / 貼圖紋理的單格 256 × 180(已縮到格寬 × DPR)

// ───────── 烘焙一塊 ─────────
function wmapBakeChunk(ix, iy) {
  var t0 = performance.now(), CH = WMAP_CFG.chunk, G = WMAP.G, WG = WMAP.WG, N = G.size, B = WMAP.B, dpr = WMAP.dpr, x0 = ix * CH, y0 = iy * CH, x1 = x0 + CH, y1 = y0 + CH,
    key = wmapChunkKey(ix, iy), rg = wmapCellsInRect(G, x0, y0, x1, y1, 0, 0), ch, g, c, r, gi, t, k, rc, i, o, bx, e, ent, cells = [], objs = [];
  ent = { used: WMAP.stamp, empty: false, cv: null };
  WMAP.chunks[key] = ent; WMAP.nChunks++;
  if (!WMAP.lv || WMAP.lvWG !== WG) wmapBuildLv();
  // 格:頂面外框(含側壁、水格下沉)與分塊相交者;依格中心 y(c + r)由小到大、同 y 由左到右(c 小的先)排序 = 前排蓋後排
  for (r = rg.r0; r <= rg.r1; r++) for (c = rg.c0; c <= rg.c1; c++) {
    rc = wmapCellRect(G, c, r);
    if (rc.x + rc.w < x0 || rc.x > x1 || rc.y + rc.h + G.T < y0 || rc.y > y1) continue;
    cells.push(r * N + c);
  }
  cells.sort(function (a, b) { var ca = a % N, cb = b % N; return ((ca + (a - ca) / N) - (cb + (b - cb) / N)) || (ca - cb); });
  for (i = 0; i < WMAP.objs.length; i++) {
    o = WMAP.objs[i];
    bx = wmapPieceBox(G, o.c0, o.r0, o.fw, o.fh, o.cw, o.ch, o.ax, o.ay);
    if (o.block || !o.art) { bx = { x: bx.x - G.W, y: bx.y - G.H * 3, w: bx.w + 2 * G.W, h: bx.h + G.H * 3 }; }   // 色塊退路:稜柱高度不照圖框,外擴一點
    if (bx.x + bx.w < x0 || bx.x > x1 || bx.y + bx.h < y0 || bx.y > y1) continue;
    objs.push(o);
  }
  if (!cells.length && !objs.length) { ent.empty = true; WMAP.bakes++; WMAP.bakeMs += performance.now() - t0; return ent; }
  ch = document.createElement('canvas'); ch.width = CH * dpr; ch.height = CH * dpr; ch.style.width = CH + 'px'; ch.style.height = CH + 'px'; ch.style.transform = 'translate(' + x0 + 'px,' + y0 + 'px)';
  g = ch.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
  // 1 地面:側壁 → 水格頂面(下沉 T/2)→ 陸地頂面 → 過渡 → 描邊(依貼圖鍵批次;前排蓋後排)
  wmapBakeGround(g, cells);
  // 2 路(邊 → 面)
  wmapBakeRoads(g, G, cells);
  // 3 資源地面層(斑塊 / 田塊 / 田埂,世界錨定)
  wmapBakeResGround(g, G, x0, y0, x1, y1);
  // 3b 裝飾散布(wmap_obj.js:烘焙進地面層,在物件層之前)
  if (typeof wmapObjBakeDecor === 'function') wmapObjBakeDecor(g, G, x0, y0, x1, y1);
  // 4 物件層(山 / 大石 / 城池 / 邊界裝飾 + 散布物件,合併深度排序)
  wmapBakeObjects(g, G, x0, y0, x1, y1, objs);
  // 5 邊界帶霧(離地圖越遠越濃;六邊形頂面)
  g.fillStyle = WMAP_VCFG.fog;
  for (i = 0; i < cells.length; i++) {
    gi = cells[i]; if (WG.k[gi] !== 7) continue;
    c = gi % N; r = (gi - c) / N; e = Math.min(c, r, N - 1 - c, N - 1 - r);
    g.globalAlpha = 0.2 + 0.2 * (B - 1 - e);
    t = wmapCellCenter(G, c, r);
    g.beginPath(); wmapHexPath(g, t.x, t.y, G.W, G.H, 0.6); g.fill();
  }
  g.globalAlpha = 1;
  ent.cv = ch; WMAP.world.appendChild(ch);
  WMAP.bakes++; WMAP.bakeMs += performance.now() - t0;
  return ent;
}
// 世界矩形 → (u, v) 外框
function wmapResUV(G, x0, y0, x1, y1) {
  var a = wmapWorld2UV(G, x0, y0), b = wmapWorld2UV(G, x1, y0), c = wmapWorld2UV(G, x0, y1), d = wmapWorld2UV(G, x1, y1);
  return { u0: Math.min(a.u, b.u, c.u, d.u), u1: Math.max(a.u, b.u, c.u, d.u), v0: Math.min(a.v, b.v, c.v, d.v), v1: Math.max(a.v, b.v, c.v, d.v) };
}
var WMAP_RES_TEX = ['farm_a', 'wood', 'rock', 'mine', 'hunt'];   // 與 WMAP_RES_ORDER 同序(farm lumber quarry mine hunt)的貼圖鍵:農田 / 林場 = 林地 / 採石場 = 岩地 / 礦土 / 獵場草土
function wmapResFillStyle(g, tt, gold) {   // 資源地面填色:貼圖已載入用貼圖 pattern(田壟沿 c 軸是貼圖本身的屬性),否則舊程式紋理 gt_*
  var key = tt === 0 && gold ? 'farm_b' : WMAP_RES_TEX[tt], p = wmapTexPat(g, key);
  if (p) return p;
  return wmapResPat(g, tt === 0 ? (gold ? 'gt_farm_b' : 'gt_farm_a') : 'gt_' + WMAP_RES_ORDER[tt]);
}
function wmapResPat(g, id) {   // 紋理 pattern:1 張 = 地面 3 × 3 格(世界錨定),轉 30°(地面座標)再套投影 → 田壟沿 c 軸(螢幕右下 20.6°);縮放時 WMAP.pat 清空重建
  var pt, a, G = WMAP.G, s;
  WMAP.pat = WMAP.pat || {};
  if (WMAP.pat[id]) return WMAP.pat[id];
  a = wmapArtGet(id); if (!a) return '#888';   // TODO(WF5):wmapTexPattern 就緒後改呼叫
  pt = g.createPattern(a.c, 'repeat');
  if (pt && pt.setTransform && typeof DOMMatrix !== 'undefined') { s = 3 / a.cw; pt.setTransform(new DOMMatrix().scale(0.8660254 * G.W, G.H).rotate(30).scale(s)); }
  WMAP.pat[id] = pt || '#888';
  return WMAP.pat[id];
}
function wmapBakeResGround(g, G, x0, y0, x1, y1) {
  var F = WMAP.F, m = G.W * 0.5, b, pa, pc, i, j, p, tt, n, c, r, rg, q, pts, ra, e, rd, pu, gx;
  if (!F || !WMAP.resList.length) return;
  b = wmapResUV(G, x0 - m, y0 - m, x1 + m, y1 + m);
  pa = wmapResPatches(F, WMAP.seed, b.u0, b.v0, b.u1, b.v1);
  pc = wmapResParcels(F, WMAP.seed, b.u0, b.v0, b.u1, b.v1);
  rg = wmapCellsInRect(G, x0 - m, y0 - m, x1 + m, y1 + m, 0, 0);
  for (tt = 0; tt < 5; tt++) {   // 資源格整格鋪滿該種類紋理(六邊形頂面):每種 1 次 fill
    n = 0; g.beginPath();
    for (r = rg.r0; r <= rg.r1; r++) for (c = rg.c0; c <= rg.c1; c++) if (F.rty[r * F.N + c] === tt) { q = wmapCellCenter(G, c, r); wmapHexPath(g, q.x, q.y, G.W, G.H, 0.4); n++; }
    if (n) { g.fillStyle = wmapResFillStyle(g, tt, false); g.fill(); }
  }
  for (tt = 1; tt < 5; tt++) {   // 斑塊依種類合併成一條路徑填色(每種 1 次 fill)
    n = 0; g.beginPath();
    for (i = 0; i < pa.length; i++) {
      p = pa[i]; if (p.t !== tt) continue;
      n++; pts = wmapResBlob(F, p);
      for (j = 0; j < 8; j++) { q = wmapUV2World(G, pts[2 * j], pts[2 * j + 1]); if (j) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }
      g.closePath();
    }
    if (n) { g.fillStyle = wmapResFillStyle(g, tt, false); g.fill(); }
  }
  g.globalAlpha = 1;
  for (gx = 0; gx < 2; gx++) {   // 田塊(c 向 0.5 × r 向 0.25 的平行四邊形)青苗 / 金穗各 1 次 fill
    n = 0; g.beginPath();
    for (i = 0; i < pc.length; i++) {
      p = pc[i]; if ((p.gold ? 1 : 0) !== gx) continue;
      n++;
      q = wmapUV2World(G, p.u - 0.005, p.v - 0.005); g.moveTo(q.x, q.y);
      q = wmapUV2World(G, p.u + p.w + 0.005, p.v - 0.005); g.lineTo(q.x, q.y);
      q = wmapUV2World(G, p.u + p.w + 0.005, p.v + p.h + 0.005); g.lineTo(q.x, q.y);
      q = wmapUV2World(G, p.u - 0.005, p.v + p.h + 0.005); g.lineTo(q.x, q.y);
      g.closePath();
    }
    if (n) { g.fillStyle = wmapResFillStyle(g, 0, gx === 1); g.fill(); }
  }
  g.strokeStyle = '#c8a36a'; g.lineWidth = Math.max(0.6, G.W * 0.011); g.lineCap = 'square'; g.beginPath();
  for (i = 0; i < pc.length; i++) {
    p = pc[i];
    if (p.eT) { q = wmapUV2World(G, p.u, p.v); e = wmapUV2World(G, p.u + p.w, p.v); g.moveTo(q.x, q.y); g.lineTo(e.x, e.y); }
    if (p.eB) { q = wmapUV2World(G, p.u, p.v + p.h); e = wmapUV2World(G, p.u + p.w, p.v + p.h); g.moveTo(q.x, q.y); g.lineTo(e.x, e.y); }
    if (p.eL) { q = wmapUV2World(G, p.u, p.v); e = wmapUV2World(G, p.u, p.v + p.h); g.moveTo(q.x, q.y); g.lineTo(e.x, e.y); }
    if (p.eR) { q = wmapUV2World(G, p.u + p.w, p.v); e = wmapUV2World(G, p.u + p.w, p.v + p.h); g.moveTo(q.x, q.y); g.lineTo(e.x, e.y); }
  }
  g.stroke();
}
// 土道路:所有路格的臂合併成一條路徑,邊 1 次 fill + 面 1 次 fill(世界錨定的 gt_road 紋理);橋另畫木板。形狀在「地面等向座標」畫寬度再投影 → 與六邊形頂面同透視
var WMAP_RD = { edge: 0.26, fill: 0.2, ext: 0.02, edgeCol: 'rgba(132,102,58,0.78)', bEdge: '#4a3b2c', bFill: '#a9835a', bPlank: '#7a5a36' };
function wmapRoadShape(g, c, r, m, hw) {   // 一個路格的形狀:中心橢圓 + 朝 6 向(m 低 6 位,bit d = d 向鄰格)的臂,臂端到共用邊中點(再外延 ext)
  var G = WMAP.G, p = wmapCellCenter(G, c, r), Sx = 0.8660254 * G.W, Sy = G.H, e = WMAP_RD.ext, d, gx, gy, L = 0.5 + e, px, py, pts, ar, i, j, n;
  g.moveTo(p.x + hw * Sx, p.y); g.ellipse(p.x, p.y, hw * Sx, hw * Sy, 0, 0, 6.2831853);
  for (d = 0; d < 6; d++) {
    if (!(m & (1 << d))) continue;
    gx = 0.8660254 * (WMHEX_DC[d] - WMHEX_DR[d]); gy = 0.5 * (WMHEX_DC[d] + WMHEX_DR[d]);   // d 向單位向量(地面座標,長度 1)
    px = -gy * hw; py = gx * hw;
    pts = [[p.x + px * Sx, p.y + py * Sy], [p.x - px * Sx, p.y - py * Sy], [p.x + (gx * L - px) * Sx, p.y + (gy * L - py) * Sy], [p.x + (gx * L + px) * Sx, p.y + (gy * L + py) * Sy]];
    ar = 0; n = pts.length;
    for (i = 0; i < n; i++) { j = (i + 1) % n; ar += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; }
    if (ar < 0) pts.reverse();   // 與橢圓同繞向(螢幕座標順時針為正),nonzero 填色重疊不會挖洞
    g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.lineTo(pts[3][0], pts[3][1]); g.closePath();
  }
}
function wmapBakeRoads(g, G, cells) {
  var WG = WMAP.WG, N = G.size, list = [], br = [], i, j, gi, k, c, r, m, x, y, h, d, gx, gy, p, Sx = 0.8660254 * G.W, Sy = G.H, t, px, py, ln;
  for (i = 0; i < cells.length; i++) {
    gi = cells[i]; k = WG.k[gi];
    if (k !== 5 && !wmapGateMask()[gi]) continue;   // 路格 + 縣 / 郡 / 州的城門格(只接門格,牆格不接)
    c = gi % N; r = (gi - c) / N; m = wmapRoadArms(gi);
    if (k !== 5 && !m) continue;                      // 門外沒路的門不畫
    if (k === 5 && wmapBridge(gi)) br.push(c, r, m); else list.push(c, r, m);
  }
  if (!list.length && !br.length) return;
  if (list.length) {
    g.beginPath(); for (i = 0; i < list.length; i += 3) wmapRoadShape(g, list[i], list[i + 1], list[i + 2], WMAP_RD.edge);
    g.fillStyle = WMAP_RD.edgeCol; g.fill();
    if (!(typeof wmapObjRoadFill === 'function' && wmapObjRoadFill(g, G, list))) {   // 車轍貼圖(wmap_obj.js)就緒走貼圖,否則舊程式紋理
      g.beginPath(); for (i = 0; i < list.length; i += 3) wmapRoadShape(g, list[i], list[i + 1], list[i + 2], WMAP_RD.fill);
      g.fillStyle = wmapResPat(g, 'gt_road'); g.fill();
    }
  }
  if (br.length && !(typeof wmapObjBridgeDraw === 'function' && wmapObjBridgeDraw(g, G, br))) {   // 橋圖(wmap_obj.js)就緒走橋圖,否則舊程式橋:深邊 + 木板面 + 橫木板線(橋格頂面是下沉的水面,橋面畫在陸地高度 = 比水面高 T/2)
    g.beginPath(); for (i = 0; i < br.length; i += 3) wmapRoadShape(g, br[i], br[i + 1], br[i + 2], WMAP_RD.edge + 0.04);
    g.fillStyle = WMAP_RD.bEdge; g.fill();
    g.beginPath(); for (i = 0; i < br.length; i += 3) wmapRoadShape(g, br[i], br[i + 1], br[i + 2], WMAP_RD.fill + 0.03);
    g.fillStyle = WMAP_RD.bFill; g.fill();
    g.strokeStyle = WMAP_RD.bPlank; g.lineWidth = Math.max(0.6, G.W * 0.011); g.beginPath();
    for (i = 0; i < br.length; i += 3) {
      p = wmapCellCenter(G, br[i], br[i + 1]); m = br[i + 2]; h = WMAP_RD.fill + 0.03;
      for (d = 0; d < 6; d++) {
        if (!(m & (1 << d))) continue;
        gx = 0.8660254 * (WMHEX_DC[d] - WMHEX_DR[d]); gy = 0.5 * (WMHEX_DC[d] + WMHEX_DR[d]); px = -gy * h; py = gx * h;
        for (j = 0; j < 4; j++) {
          t = 0.06 + j * 0.13;
          g.moveTo(p.x + (gx * t + px) * Sx, p.y + (gy * t + py) * Sy); g.lineTo(p.x + (gx * t - px) * Sx, p.y + (gy * t - py) * Sy);
        }
      }
    }
    g.stroke();
  }
}
function wmapBakeObjects(g, G, x0, y0, x1, y1, objs) {
  var F = WMAP.F, k = G.W / 256, W = G.W, cfg = WMAP_RES_CFG, zi = WMAP.zi, items = [], sc = [], i, j, o, bx, b, pts, p, a, q, rg, ms, m, n, key, pos, f, it, ssz, rx;
  function hit(fx, fy, an) { return fx - an.ax * k < x1 && fx + (an.cw - an.ax) * k > x0 && fy - an.ay * k < y1 && fy + (an.ch - an.ay) * k > y0; }
  for (i = 0; i < objs.length; i++) { o = objs[i]; items.push({ dep: o.dep, tie: o.c0 - o.r0, id: 0, ty: 0, o: o }); }
  if (typeof wmapObjResItems === 'function') { ms = wmapObjResItems(G, x0, y0, x1, y1); for (i = 0; i < ms.length; i++) items.push(ms[i]); }   // 資源地物件 + 等級旗標(wmap_obj.js)
  if (F && WMAP.resList.length && !(typeof wmapObjReplacesScatter === 'function' && wmapObjReplacesScatter())) {
    b = wmapResUV(G, x0 - 0.6 * W, y0 - 0.15 * W, x1 + 0.6 * W, y1 + 1.4 * W);
    pts = wmapResPoints(F, WMAP.seed, b.u0, b.v0, b.u1, b.v1, zi);
    for (i = 0; i < pts.length; i++) {
      p = pts[i]; a = wmapArtGet(p.key); if (!a) continue;
      q = wmapUV2World(G, p.u, p.v);
      if (!hit(q.x, q.y, a)) continue;
      sc.push({ dep: p.dep, tie: p.tie, id: p.id, ty: 1, a: a, fx: q.x, fy: q.y, sz: p.sz, key: p.key });
    }
    for (j = 0; j < 2 && sc.length > cfg.maxObjPerChunk; j++) sc = sc.filter(function (e) { return e.sz > j; });   // 超量時依序丟 S1 → S2
    for (i = 0; i < sc.length; i++) items.push(sc[i]);
  }
  items.sort(function (u, v) { return (u.dep - v.dep) || (u.tie - v.tie) || (u.id - v.id); });
  for (i = 0; i < items.length; i++) {
    it = items[i];
    if (it.ty === 0) {
      o = it.o;
      if (o.al < 1) g.globalAlpha = Math.max(0.3, o.al);
      if (o.block || !o.art) wmapBakeBlock(g, G, o);
      else { bx = wmapPieceBox(G, o.c0, o.r0, o.fw, o.fh, o.cw, o.ch, o.ax, o.ay); wmapDrawArt(g, o.key, bx.x, bx.y, o.cw, o.ch); }
      if (o.al < 1) g.globalAlpha = 1;
      continue;
    }
    if (it.ty === 2) { wmapObjDrawItem(g, G, it); continue; }
    wmapDrawArt(g, it.key, it.fx - it.a.ax * k, it.fy - it.a.ay * k, it.a.cw, it.a.ch);
  }
}
// 缺圖退路:物件畫成六邊形稜柱(縣 / 郡 / 州 / 主城 = 占地每格一根;關 = 兩側山壁各格一根,門道留給道路;多格山 = 依 WMAP_PIECE.cells)
function wmapHexPrism(g, G, cx, cy, up, cols) {   // (cx, cy) = 底面頂面中心(地面層);稜柱頂面升高 up;cols = [左面, 右面, 頂面]
  var W = G.W, H = G.H, T = G.T, ty = cy - up, w2 = W / 2, q = W / 4, h2 = H / 2;
  g.lineJoin = 'round'; g.strokeStyle = WMAP_VCFG.ink; g.lineWidth = Math.max(0.8, W * 0.012);
  g.fillStyle = cols[0]; g.beginPath(); g.moveTo(cx - w2, ty); g.lineTo(cx - q, ty + h2); g.lineTo(cx - q, cy + h2 + T); g.lineTo(cx - w2, cy + T); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = wmapVShade(cols[0], 0.9); g.beginPath(); g.moveTo(cx - q, ty + h2); g.lineTo(cx + q, ty + h2); g.lineTo(cx + q, cy + h2 + T); g.lineTo(cx - q, cy + h2 + T); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = cols[1]; g.beginPath(); g.moveTo(cx + q, ty + h2); g.lineTo(cx + w2, ty); g.lineTo(cx + w2, cy + T); g.lineTo(cx + q, cy + h2 + T); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = cols[2]; g.beginPath(); wmapHexPath(g, cx, ty, W, H, 0); g.fill(); g.stroke();
}
function wmapBlock(g, G, cl, up, cols) {   // cl = [[c, r], …] 占地格
  var i, c, r, p, a = cl.slice();
  a.sort(function (u, v) { return (u[0] + u[1]) - (v[0] + v[1]) || u[0] - v[0]; });
  for (i = 0; i < a.length; i++) { c = a[i][0]; r = a[i][1]; p = wmapCellCenter(G, c, r); wmapHexPrism(g, G, p.x, p.y, up, cols); }
}
function wmapBakeBlock(g, G, o) {
  var k = G.W / 256, bh = wmapBaseH(o.fw, o.fh), up = Math.max(G.H * 0.6, Math.min(G.H * 3, 0.45 * (o.ch - bh) * k)), WG = WMAP.WG, N = G.size, i, gi, c, r, nd = o.nd, cl = [], P,
    cols = o.key === 'JUN' ? ['#a3a8a6', '#7c827f', '#c2c7c4'] : (o.key === 'ZHOU' ? ['#b4a9bd', '#8a8095', '#cfc6d8'] : (o.key === 'COUNTY' ? ['#b9ab8e', '#8f8268', '#d3c7aa'] : (o.key === 'CITY' ? ['#d8c594', '#a79366', '#ecdcae'] : ['#8f8676', '#6b6355', '#aaa292'])));
  if (nd && nd.type === 'pass') {
    for (i = 0; i < nd.cells.length; i++) {
      gi = nd.cells[i]; if (WG.k[gi] !== 10) continue;
      c = gi % N; r = (gi - c) / N; cl.push([c, r]);
    }
    wmapBlock(g, G, cl, G.H * 1.3, cols);
    return;
  }
  if (!nd && o.key === 'CITY') {   // 主城:只畫真的是主城 / 庭院的格
    for (r = o.r0; r < o.r0 + o.fh; r++) for (c = o.c0; c < o.c0 + o.fw; c++) { gi = r * N + c; if (c >= 0 && r >= 0 && c < N && r < N && (WG.k[gi] === 6 || WG.k[gi] === 8)) cl.push([c, r]); }
    wmapBlock(g, G, cl, up, cols);
    return;
  }
  if (!nd && o.cells) {   // 山 / 大石(多格):依拼塊格
    P = o.cells; for (i = 0; i < P.length; i++) cl.push([o.c0 + P[i][1], o.r0 + P[i][0]]);
    wmapBlock(g, G, cl, G.H * (o.key === 'O1' ? 0.5 : 1.6), ['#a79f8c', '#7b7463', '#c5beac']);
    return;
  }
  for (r = o.r0; r < o.r0 + o.fh; r++) for (c = o.c0; c < o.c0 + o.fw; c++) cl.push([c, r]);
  wmapBlock(g, G, cl, up, cols);
}
// ───────── 單格:側壁 + 頂面 + 過渡 + 描邊 ─────────
function wmapLvAt(c, r) { var N = WMAP.N; if (c < 0 || r < 0 || c >= N || r >= N) return -1; return WMAP.lv[r * N + c]; }
function wmapTopFill(g, list, W, H) {   // 頂面:同貼圖鍵的格合成一條路徑 + 1 次 fill(世界錨定 pattern;相鄰格紋理連續);沒有 pattern(貼圖未載入)→ 逐格貼程式紋理單格
  var k = W / 256, groups = {}, i, e, key, tile;
  for (i = 0; i < list.length; i++) {
    e = list[i];
    if (e.pat) { (groups[e.tkey] || (groups[e.tkey] = [])).push(e); continue; }
    tile = wmapHexTileOf(e.atype, e.atype === 'river' || e.atype === 'shoal' ? (e.gi + (e.gi >> 3)) % 3 : e.v);
    if (tile) g.drawImage(tile.c, e.cx - 128 * k, e.ty - 72 * k, 256 * k, 180 * k);
  }
  for (key in groups) {
    g.beginPath();
    for (i = 0; i < groups[key].length; i++) wmapHexPath(g, groups[key][i].cx, groups[key][i].ty, W, H, 0.5);
    g.fillStyle = groups[key][0].pat; g.fill();
  }
}
function wmapTopBevel(g, list, W, H) {   // 倒角(只給用 pattern 填的格;程式單格紋理自帶):6 條邊各 1 次 fill
  var cols = typeof WMAP_BEVEL_COL !== 'undefined' ? WMAP_BEVEL_COL : ['rgba(255,244,200,0.3)', 'rgba(255,250,215,0.42)', 'rgba(255,244,200,0.22)', 'rgba(40,20,0,0.22)', 'rgba(30,15,0,0.34)', 'rgba(40,20,0,0.22)'], e, i, hp, ip, e2, n = 0, any = false, s = 0.86, ent;
  for (i = 0; i < list.length; i++) if (list[i].pat) { any = true; break; }
  if (!any) return;
  for (e = 0; e < 6; e++) {
    e2 = (e + 1) % 6;
    g.beginPath();
    for (i = 0; i < list.length; i++) {
      ent = list[i]; if (!ent.pat) continue;
      hp = wmapHexVerts(ent.cx, ent.ty, W, H, 0); ip = wmapHexVerts(ent.cx, ent.ty, W * s, H * s, 0);
      g.moveTo(hp[2 * e], hp[2 * e + 1]); g.lineTo(hp[2 * e2], hp[2 * e2 + 1]); g.lineTo(ip[2 * e2], ip[2 * e2 + 1]); g.lineTo(ip[2 * e], ip[2 * e + 1]); g.closePath();
    }
    g.fillStyle = cols[e]; g.fill();
  }
}
function wmapGroundWall(g, e, W, H, T, lw) {   // 側壁:SE / S / SW 面(左亮右暗),只畫「鄰格不存在或比本格低」的面
  var cx = e.cx, ty = e.ty, w2 = W / 2, q = W / 4, h2 = H / 2, wc = e.water ? WMAP_VCFG.wall.water : (e.nbw ? WMAP_VCFG.wall.bank : (WMAP_VCFG.wall[e.gt] || WMAP_VCFG.wall.grass));
  g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = WMAP_VCFG.ink;
  if (e.f[2]) { g.fillStyle = wmapVShade(wc, 0.92); g.beginPath(); g.moveTo(cx - w2, ty); g.lineTo(cx - q, ty + h2); g.lineTo(cx - q, ty + h2 + T); g.lineTo(cx - w2, ty + T); g.closePath(); g.fill(); g.stroke(); }   // SW 面(左,亮)
  if (e.f[1]) { g.fillStyle = wmapVShade(wc, 0.76); g.beginPath(); g.moveTo(cx - q, ty + h2); g.lineTo(cx + q, ty + h2); g.lineTo(cx + q, ty + h2 + T); g.lineTo(cx - q, ty + h2 + T); g.closePath(); g.fill(); g.stroke(); }   // S 面
  if (e.f[0]) { g.fillStyle = wmapVShade(wc, 0.62); g.beginPath(); g.moveTo(cx + q, ty + h2); g.lineTo(cx + w2, ty); g.lineTo(cx + w2, ty + T); g.lineTo(cx + q, ty + h2 + T); g.closePath(); g.fill(); g.stroke(); }   // SE 面(右,暗)
}
function wmapGroundTrans(g, e) {   // 地形交界過渡帶:優先序較高的鄰格往本格滲(只在兩邊都是野外地面、本格不是水時);每個交界邊 1 張鄰格紋理 × 遮罩
  var G = WMAP.G, WG = WMAP.WG, N = G.size, k = G.W / 256, d, nc, nr, ngi, ngt, nt, mk, tmp, tg;
  for (d = 0; d < 6; d++) {
    nc = e.c + WMHEX_DC[d]; nr = e.r + WMHEX_DR[d];
    if (nc < 0 || nr < 0 || nc >= N || nr >= N) continue;
    ngi = nr * N + nc; if (WMAP.lv[ngi] === 1) continue; ngt = WMAP.ground[ngi];
    if (ngt === e.gt || !(ngt in WMAP_PRI) || !(e.gt in WMAP_PRI) || WMAP_PRI[ngt] <= WMAP_PRI[e.gt]) continue;
    nt = wmapHexTileOf(ngt, WG.g[ngi]); mk = wmapScaled('mask_' + (d + 6 * (wmGenHash(WG.seed, e.gi, 5) & 1)));
    if (!nt || !mk) continue;
    tmp = WMAP.tmp; if (!tmp || tmp.width !== nt.c.width || tmp.height !== nt.c.height) { tmp = WMAP.tmp = document.createElement('canvas'); tmp.width = nt.c.width; tmp.height = nt.c.height; }
    tg = tmp.getContext('2d'); tg.globalCompositeOperation = 'copy'; tg.drawImage(nt.c, 0, 0);
    tg.globalCompositeOperation = 'destination-in'; tg.drawImage(mk.c, 0, 0, tmp.width, tmp.height);
    tg.globalCompositeOperation = 'source-over';
    g.drawImage(tmp, e.cx - 128 * k, e.ty - 72 * k, 256 * k, 180 * k);
  }
}
function wmapBakeGround(g, cells) {   // 一塊內所有格(cells 已依 c + r、c 排序):① 側壁 ② 水格頂面(下沉 T/2)+ 倒角 + 高光 ③ 陸地頂面 + 倒角 ④ 交界過渡 ⑤ 描邊;頂面依貼圖鍵批次填
  var G = WMAP.G, WG = WMAP.WG, N = G.size, W = G.W, H = G.H, T = G.T, w2 = W / 2, q = W / 4, h2 = H / 2, lw = Math.max(0.7, W * WMAP_VCFG.lw), E = [], water = [], land = [], i, j, d, gi, c, r, p, nc, nr, nl, e, kk, wl, atype, tkey;
  for (i = 0; i < cells.length; i++) {
    gi = cells[i]; c = gi % N; r = (gi - c) / N; p = wmapCellCenter(G, c, r); kk = WG.k[gi]; wl = WMAP.lv[gi] === 1;
    atype = wl ? (kk === 4 ? 'shoal' : 'river') : WMAP.ground[gi];
    e = { gi: gi, c: c, r: r, cx: p.x, ty: p.y + (wl ? T * 0.5 : 0), water: wl, ford: kk === 4, gt: WMAP.ground[gi], atype: atype, v: WG.g[gi], f: [false, false, false], nbw: false, pat: null, tkey: null };
    for (d = 2; d <= 4; d++) {   // 側壁面:鄰格不存在或比本格低才看得到(全圖平地同高;水格下沉)
      nl = wmapLvAt(c + WMHEX_DC[d], r + WMHEX_DR[d]);
      if (nl < 0 || nl > WMAP.lv[gi]) { e.f[d - 2] = true; if (nl > 0) e.nbw = true; }
    }
    tkey = typeof wmapTexKeyOf === 'function' ? wmapTexKeyOf(atype, atype === 'dirt' ? 0 : e.v) : null;
    if (tkey) { e.tkey = tkey; e.pat = wmapTexPat(g, tkey); }
    E.push(e); (wl ? water : land).push(e);
  }
  for (i = 0; i < E.length; i++) if (E[i].f[0] || E[i].f[1] || E[i].f[2]) wmapGroundWall(g, E[i], W, H, T, lw);
  if (water.length) {
    wmapTopFill(g, water, W, H); wmapTopBevel(g, water, W, H);
    for (i = 0; i < water.length; i++) {   // 水面高光:流向線(河)/ 踏石(淺灘),wmapArtRiver 的 'hi' 層;局部座標 = 頂面中心、x 單位 0.866W、y 單位 H
      e = water[i]; g.save(); wmapArtIsoT(g, G, e.c, e.r); g.translate(0, T * 0.5 / H); wmapArtRiver(g, 'hi', wmapRiverNb(e.gi), e.ford, wmGenHash(WG.seed, e.gi, 9), wmapRiverDg(e.gi)); g.restore();
    }
  }
  if (land.length) {
    wmapTopFill(g, land, W, H); wmapTopBevel(g, land, W, H);
    if (WMAP_VCFG.trans) for (i = 0; i < land.length; i++) wmapGroundTrans(g, land[i]);
  }
  if (WMAP_VCFG.edge !== 'none') {   // 描邊:每格只畫上方三邊(N / NE / NW,與後排共用)+ 可見側壁的下緣;全部合成一條路徑 1 次 stroke
    g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = 'rgba(74,59,44,' + WMAP_VCFG.edgeA + ')'; g.beginPath();
    for (i = 0; i < E.length; i++) {
      e = E[i];
      for (j = 0; j < 3; j++) {
        d = j === 0 ? 0 : (j === 1 ? 1 : 5);
        if (WMAP_VCFG.edge === 'diff') {
          nc = e.c + WMHEX_DC[d]; nr = e.r + WMHEX_DR[d];
          if (nc >= 0 && nr >= 0 && nc < N && nr < N && WMAP.ground[nr * N + nc] === e.gt && WMAP.lv[nr * N + nc] === WMAP.lv[e.gi]) continue;
        }
        if (d === 0) { g.moveTo(e.cx - q, e.ty - h2); g.lineTo(e.cx + q, e.ty - h2); }
        else if (d === 1) { g.moveTo(e.cx + q, e.ty - h2); g.lineTo(e.cx + w2, e.ty); }
        else { g.moveTo(e.cx - w2, e.ty); g.lineTo(e.cx - q, e.ty - h2); }
      }
      if (e.f[2]) { g.moveTo(e.cx - w2, e.ty); g.lineTo(e.cx - q, e.ty + h2); }
      if (e.f[1]) { g.moveTo(e.cx - q, e.ty + h2); g.lineTo(e.cx + q, e.ty + h2); }
      if (e.f[0]) { g.moveTo(e.cx + q, e.ty + h2); g.lineTo(e.cx + w2, e.ty); }
    }
    g.stroke();
  }
}
function wmapKAt(c, r) { var N = WMAP.N; if (c < 0 || r < 0 || c >= N || r >= N) return 7; return WMAP.WG.k[r * N + c]; }
function wmapBridge(gi) {   // 道路格在某一軸的兩側(6 向中相對的一對)都是河 = 橋
  var N = WMAP.N, c = gi % N, r = (gi - c) / N, k, d;
  if (WMAP.WG.k[gi] !== 5) return false;
  k = function (a, b) { var v = wmapKAt(a, b); return v === 3 || v === 4; };
  for (d = 0; d < 3; d++) if (k(c + WMHEX_DC[d], r + WMHEX_DR[d]) && k(c + WMHEX_DC[d + 3], r + WMHEX_DR[d + 3])) return true;
  return false;
}
function wmapRiverNb(gi) {   // 河 6 鄰:[d 0~5] 是水 / 淺灘 / 邊界(橋格只留河的那一軸)
  var N = WMAP.N, c = gi % N, r = (gi - c) / N, out = [false, false, false, false, false, false], d, v, kk = WMAP.WG.k[gi], pair = -1;
  for (d = 0; d < 6; d++) { v = wmapKAt(c + WMHEX_DC[d], r + WMHEX_DR[d]); out[d] = v === 3 || v === 4 || v === 7; }
  if (kk === 5) {   // 橋:只畫河的那一軸(兩側都是水的那對)
    for (d = 0; d < 3; d++) if (out[d] && out[d + 3]) { pair = d; break; }
    for (d = 0; d < 6; d++) if (d % 3 !== pair) out[d] = false;
  }
  return out;
}
function wmapRiverDg(gi) {   // 相鄰兩向 (d, d + 1) 都是水(補角用)
  var nb = wmapRiverNb(gi), out = [false, false, false, false, false, false], d;
  for (d = 0; d < 6; d++) out[d] = nb[d] && nb[(d + 1) % 6];
  return out;
}
function wmapGateMask() {   // 縣 / 郡 / 州 / 關的城門格(node.gates[*].gi)= 1;道路只接這些格,不接其他占地格
  var WG = WMAP.WG, N = WG.size || WMAP.N, m, i, j, nd;
  if (WMAP.gmWG === WG && WMAP.gm) return WMAP.gm;
  m = new Uint8Array(N * N);
  if (WG.nodes) for (i = 0; i < WG.nodes.length; i++) { nd = WG.nodes[i]; if (nd.gates) for (j = 0; j < nd.gates.length; j++) m[nd.gates[j].gi] = 1; }
  WMAP.gmWG = WG; WMAP.gm = m;
  return m;
}
function wmapRoadArms(gi) {   // 路格 / 城門格的接邊:bit d = 朝 d 向(0 N、1 NE、2 SE、3 S、4 SW、5 NW)鄰格相連;城池牆格(非門格)= 0
  var N = WMAP.N, WG = WMAP.WG, gm = wmapGateMask(), c = gi % N, r = (gi - c) / N, road = WG.k[gi] === 5, m = 0, d, v, nc, nr;
  if (!road && !gm[gi]) return 0;
  for (d = 0; d < 6; d++) {
    nc = c + WMHEX_DC[d]; nr = r + WMHEX_DR[d]; v = wmapKAt(nc, nr);
    if (v === 5) m |= 1 << d;
    else if (road && (v === 6 || v === 7 || v === 8)) m |= 1 << d;                                                                     // 路還接城 / 庭院 / 邊界(通到地圖邊)
    else if (road && (v === 9 || v === 11 || v === 12) && nc >= 0 && nr >= 0 && nc < N && nr < N && gm[nr * N + nc] === 1) m |= 1 << d;   // 縣 / 郡 / 州:只接城門格
  }
  return m;
}

// ───────── 分塊管理 ─────────
function wmapDropChunk(key) {
  var e = WMAP.chunks[key];
  if (!e) return;
  if (e.cv) { e.cv.width = 0; if (e.cv.parentNode) e.cv.parentNode.removeChild(e.cv); }
  delete WMAP.chunks[key]; WMAP.nChunks--;
}
function wmapClearChunks() { var k; for (k in WMAP.chunks) wmapDropChunk(k); WMAP.nChunks = 0; }
function wmapEnsureChunks(px, py, budget) {
  var CH = WMAP_CFG.chunk, G = WMAP.G, vr = wmapChunkRange(px, py, WMAP.vw, WMAP.vh, CH, 0), pr = wmapChunkRange(px, py, WMAP.vw, WMAP.vh, CH, 130), maxI = Math.floor(G.worldW / CH), maxJ = Math.floor(G.worldH / CH),
    ix, iy, key, n = 0, vis = {}, nvis = 0, cap, k, lru, lk, miss = 0;
  WMAP.stamp++;
  for (iy = Math.max(0, vr.iy0); iy <= Math.min(maxJ, vr.iy1); iy++) for (ix = Math.max(0, vr.ix0); ix <= Math.min(maxI, vr.ix1); ix++) {
    key = wmapChunkKey(ix, iy); vis[key] = 1; nvis++;
    if (WMAP.chunks[key]) { WMAP.chunks[key].used = WMAP.stamp; continue; }
    if (n < budget) { wmapBakeChunk(ix, iy); n++; } else miss++;
  }
  cap = Math.max(WMAP_CFG.maxChunks, nvis);
  if (!miss && n < budget) {   // 預取:視窗外一圈,不超過上限
    for (iy = Math.max(0, pr.iy0); iy <= Math.min(maxJ, pr.iy1) && n < 1; iy++) for (ix = Math.max(0, pr.ix0); ix <= Math.min(maxI, pr.ix1) && n < 1; ix++) {
      key = wmapChunkKey(ix, iy);
      if (WMAP.chunks[key] || WMAP.nChunks >= cap) continue;
      wmapBakeChunk(ix, iy); n++; WMAP.chunks[key].used = WMAP.stamp - 0.5; miss = -1;
    }
  }
  while (WMAP.nChunks > cap) {   // LRU 回收(不回收可見塊)
    lru = null; lk = null;
    for (k in WMAP.chunks) { if (vis[k]) continue; if (lru === null || WMAP.chunks[k].used < lru) { lru = WMAP.chunks[k].used; lk = k; } }
    if (lk === null) break;
    wmapDropChunk(lk);
  }
  return miss !== 0;   // true = 還有東西要烘(下一幀繼續)
}

// ───────── 覆蓋層:我的框 / 選取框(六邊形;背景圖用行內 SVG,不依賴 css 的菱形底圖) ─────────
function wmapMkNode(cls, parent) { var d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }
var WMAP_OWN_URI = "url(\"data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 56.25' preserveAspectRatio='none'><path d='M3 28.1 26 2.5 74 2.5 97 28.1 74 53.7 26 53.7Z' fill='#d03a22' fill-opacity='.14' stroke='#c4301b' stroke-width='3.2' stroke-linejoin='round'/></svg>") + "\")";
function wmapUpdateOverlay(px, py) {
  var G = WMAP.G, i, gi, c, r, t, sig, el, pad = G.W, fl = [], vw = WMAP.vw, vh = WMAP.vh, N = G.size, k;
  for (k in WMAP.own) {   // 我的領地:朱紅六邊形框(唯一的格線,代表產權);只放視窗內的
    gi = +k; c = gi % N; r = (gi - c) / N;
    t = wmapCellTop(G, c, r);
    if (t.x + G.W / 2 < px - pad || t.x - G.W / 2 > px + vw + pad || t.y + G.H < py - pad || t.y > py + vh + pad) continue;
    fl.push(gi);
  }
  sig = WMAP.G.s + ':' + fl.join(',');
  if (sig === WMAP.bsig) return;
  WMAP.bsig = sig;
  for (i = 0; i < fl.length; i++) {
    gi = fl[i]; c = gi % N; r = (gi - c) / N; t = wmapCellTop(G, c, r);
    el = WMAP.fpool[i] || (WMAP.fpool[i] = wmapMkNode('wmap-own', WMAP.world));
    el.style.display = ''; el.style.width = G.W + 'px'; el.style.height = G.H + 'px'; el.style.backgroundImage = WMAP_OWN_URI;
    el.style.transform = 'translate(' + Math.round(t.x - G.W / 2) + 'px,' + Math.round(t.y) + 'px)';
  }
  for (; i < WMAP.fpool.length; i++) WMAP.fpool[i].style.display = 'none';
}
function wmapHexVert(G, d) {   // 頂面第 d 個頂點相對中心(0 = 左尖角,順時針:左、左上、右上、右、右下、左下)
  var W = G.W, H = G.H;
  return [[-W / 2, 0], [-W / 4, -H / 2], [W / 4, -H / 2], [W / 2, 0], [W / 4, H / 2], [-W / 4, H / 2]][d];
}
function wmapSelShape(G, cl) {   // 占地格群的選取框:外框 bbox + SVG(每格六邊形淡填 + 外緣邊線);cl = [[c, r]…] → {x, y, w, h, uri}
  var set = {}, i, d, e, c, r, p, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, w, h, d1 = '', d2 = '', pad = Math.max(2, G.H * 0.08), V, a, b, sw, sh, svg, rc;
  function f(n) { return Math.round(n * 10) / 10; }
  for (i = 0; i < cl.length; i++) set[cl[i][0] + ',' + cl[i][1]] = 1;
  for (i = 0; i < cl.length; i++) {
    p = wmapCellCenter(G, cl[i][0], cl[i][1]);
    x0 = Math.min(x0, p.x - G.W / 2); x1 = Math.max(x1, p.x + G.W / 2); y0 = Math.min(y0, p.y - G.H / 2); y1 = Math.max(y1, p.y + G.H / 2);
  }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad; w = x1 - x0; h = y1 - y0;
  for (i = 0; i < cl.length; i++) {
    c = cl[i][0]; r = cl[i][1]; p = wmapCellCenter(G, c, r);
    for (d = 0; d < 6; d++) { V = wmapHexVert(G, d); d1 += (d ? 'L' : 'M') + f(p.x - x0 + V[0]) + ' ' + f(p.y - y0 + V[1]); }
    d1 += 'Z';
    for (d = 0; d < 6; d++) {   // 方向 d(0 N…5 NW)對應邊 = 頂點 (d + 1) % 6 → (d + 2) % 6(N = 左上 → 右上)
      if (set[(c + WMHEX_DC[d]) + ',' + (r + WMHEX_DR[d])]) continue;
      a = wmapHexVert(G, (d + 1) % 6); b = wmapHexVert(G, (d + 2) % 6);
      d2 += 'M' + f(p.x - x0 + a[0]) + ' ' + f(p.y - y0 + a[1]) + 'L' + f(p.x - x0 + b[0]) + ' ' + f(p.y - y0 + b[1]);
    }
  }
  sw = Math.max(1.6, G.H * 0.11); sh = Math.max(0.9, G.H * 0.055);
  svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 " + f(w) + ' ' + f(h) + "'><path d='" + d1 + "' fill='#fff1a8' fill-opacity='.22'/><path d='" + d2 + "' fill='none' stroke='#fff6c8' stroke-width='" + f(sw) + "' stroke-linecap='round'/><path d='" + d2 + "' fill='none' stroke='#d99a12' stroke-width='" + f(sh) + "' stroke-linecap='round'/></svg>";
  rc = { x: x0, y: y0, w: w, h: h, uri: 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")' };
  return rc;
}
function wmapSelCells(gi) {   // 選取 gi 對應的占地格群:城池 = 整塊 c × r 矩形、主城 = 主城 / 庭院格、其他 = 該格
  var WG = WMAP.WG, N = WG.size, nd, cl = [], c, r, c0, r0, city = WG.k[gi] === 6 || WG.k[gi] === 8, i;
  nd = city ? null : wmNodeAt(WG, gi);
  if (nd) { for (r = nd.r0; r < nd.r0 + nd.fh; r++) for (c = nd.c0; c < nd.c0 + nd.fw; c++) cl.push([c, r]); }
  else if (city) { for (r = WG.cy - 1; r <= WG.cy + 1; r++) for (c = WG.cx - 1; c <= WG.cx + 1; c++) if (c >= 0 && r >= 0 && c < N && r < N && (WG.k[r * N + c] === 6 || WG.k[r * N + c] === 8)) cl.push([c, r]); }
  if (!cl.length) { c0 = gi % N; r0 = (gi - c0) / N; cl.push([c0, r0]); }
  void i;
  return cl;
}
function wmapPlaceSel() {   // 選取框 = 單一元素:資源格 1 格、城池 = 整個占地(縣 4×4 / 郡 6×6 / 州 8×8 / 關 2×4)、主城 7 + 庭院格
  var G = WMAP.G, gi = WMAP.sel, el, sh, i;
  WMAP.selEls = WMAP.selEls || [];
  for (i = 1; i < WMAP.selEls.length; i++) WMAP.selEls[i].style.display = 'none';
  if (gi < 0) { if (WMAP.selEls[0]) WMAP.selEls[0].style.display = 'none'; return; }
  sh = wmapSelShape(G, wmapSelCells(gi));
  el = WMAP.selEls[0] || (WMAP.selEls[0] = wmapMkNode('wmap-sel', WMAP.world));
  el.style.display = ''; el.style.width = Math.round(sh.w) + 'px'; el.style.height = Math.round(sh.h) + 'px';
  el.style.backgroundImage = sh.uri;
  el.style.transform = 'translate(' + Math.round(sh.x) + 'px,' + Math.round(sh.y) + 'px)';
  el.setAttribute('data-w', String(Math.round(sh.w))); el.setAttribute('data-h', String(Math.round(sh.h)));
}

// ───────── 畫面更新 ─────────
function wmapCamPxNow() { return wmapCamPx(WMAP.G, WMAP.cam, WMAP.vw, WMAP.vh); }
function wmapFrame() {
  var p, more;
  WMAP.raf = 0;
  if (!WMAP.on) return;
  p = wmapCamPxNow();
  WMAP.world.style.transform = 'translate3d(' + (-p.px) + 'px,' + (-p.py) + 'px,0)';
  more = wmapEnsureChunks(p.px, p.py, 3);
  wmapUpdateOverlay(p.px, p.py);
  if (typeof wmapUpdateFind === 'function') wmapUpdateFind(p.px, p.py);   // 搜尋標記層(js/wmap_search.js;沒載入 / 沒在搜尋 = 不動)
  if (WMAP.hud) WMAP.hud.textContent = 'W=' + WMAP.G.W + ' 塊 ' + WMAP.nChunks + ' 烘 ' + WMAP.bakes + ' 節點 ' + WMAP.root.getElementsByTagName('*').length;
  if (more) wmapSchedule();
}
function wmapSchedule() { if (WMAP.raf || !WMAP.on) return; WMAP.raf = requestAnimationFrame(wmapFrame); }
function wmapResize() {
  if (!WMAP.on) return;
  WMAP.vw = WMAP.vp.clientWidth || window.innerWidth; WMAP.vh = WMAP.vp.clientHeight || window.innerHeight;
  WMAP.cam = wmapCamClamp(WMAP.G, WMAP.cam, { border: WMAP.B });
  wmapSchedule();
}
function wmapSetCam(u, v) { WMAP.cam = wmapCamClamp(WMAP.G, { u: u, v: v }, { border: WMAP.B }); wmapSchedule(); }
function wmapZoomUi() {   // 縮放標籤 + 放大鈕在最大段時停用
  var b;
  if (WMAP.zoomEl) WMAP.zoomEl.textContent = ['遠', '中', '近'][WMAP.zi];
  b = WMAP.root ? WMAP.root.querySelector('.wmap-btn[data-z="1"]') : null;
  if (b) { b.disabled = WMAP.zi >= WMAP_CFG.zooms.length - 1; b.style.opacity = b.disabled ? '0.35' : ''; }
}
// 連續縮放(2026-11-18):格寬 W 夾在 [zMin, zMax];(ax, ay) = 視窗內錨點(保持該點對到同一個連續座標),(dx, dy) = 錨點之後再平移的螢幕位移(雙指中心移動)
function wmapZoomClamp(W) { return Math.max(WMAP_CFG.zMin, Math.min(WMAP_CFG.zMax, W)); }
function wmapSetZoom(idx, ax, ay) {
  var i = Math.max(0, Math.min(WMAP_CFG.zooms.length - 1, idx | 0));
  wmapSetZoomW(WMAP_CFG.zooms[i], ax, ay);
}
function wmapSetZoomW(W, ax, ay, dx, dy) {
  var G0 = WMAP.G, G1, p, cam, i, best = 0, bd = 1e9;
  W = Math.round(wmapZoomClamp(W));
  if (W === G0.W && !dx && !dy) return;
  if (ax === undefined) { ax = WMAP.vw / 2; ay = WMAP.vh / 2; }
  G1 = wmapGeom(W, WMAP.N);
  cam = wmapAnchorZoom(G0, G1, WMAP.cam, WMAP.vw, WMAP.vh, ax, ay);
  if (dx || dy) { p = wmapCamPx(G1, cam, WMAP.vw, WMAP.vh); cam = wmapCamFromPx(G1, p.px - (dx || 0), p.py - (dy || 0), WMAP.vw, WMAP.vh); }
  WMAP.cam = wmapCamClamp(G1, cam, { border: WMAP.B });
  for (i = 0; i < WMAP_CFG.zooms.length; i++) if (Math.abs(WMAP_CFG.zooms[i] - W) < bd) { bd = Math.abs(WMAP_CFG.zooms[i] - W); best = i; }
  WMAP.zi = best; WMAP.G = G1; WMAP.sc = {}; WMAP.tmp = null; WMAP.bsig = ''; WMAP.pat = {}; WMAP.tile = {}; WMAP.mask = {};
  wmapClearChunks(); wmapPlaceSel();
  var p = wmapCamPxNow();
  WMAP.world.style.transform = 'translate3d(' + (-p.px) + 'px,' + (-p.py) + 'px,0)';
  wmapEnsureChunks(p.px, p.py, 99);   // 縮放後可見塊同步烘好,不閃
  wmapSchedule();
  wmapZoomUi();
  if (typeof WMAP.onZoom === 'function') WMAP.onZoom();
}
// 手勢預覽:縮放過程用 CSS scale / translate 套在 vp 的每個子層(地圖、行軍層、野怪層…),跟手、不重烘;停手(pinchSettleMs)、放開、或預覽倍率離基準太遠(< 0.75 或 > 1.33)才以整數格寬重烘一次
function wmapPvLayers() { return WMAP.vp ? WMAP.vp.children : []; }
function wmapPvApply() {
  var pv = WMAP.pv, L = wmapPvLayers(), i, e;
  for (i = 0; i < L.length; i++) {
    e = L[i];
    if (!pv) { e.style.scale = ''; e.style.translate = ''; e.style.transformOrigin = ''; continue; }
    e.style.transformOrigin = pv.ox + 'px ' + pv.oy + 'px';
    e.style.scale = String(pv.k);
    e.style.translate = (pv.cx - pv.ox) + 'px ' + (pv.cy - pv.oy) + 'px';
  }
}
function wmapPvTo(W, cx, cy, ox, oy) {   // 預覽到格寬 W、錨點 (ox, oy) 對到螢幕 (cx, cy);第一次呼叫以 (ox, oy) 建基準
  var pv = WMAP.pv;
  if (!pv) pv = WMAP.pv = { W0: WMAP.G.W, ox: ox, oy: oy, cx: cx, cy: cy, k: 1 };
  pv.k = wmapZoomClamp(W) / pv.W0; pv.cx = cx; pv.cy = cy;
  if (WMAP.pvT) clearTimeout(WMAP.pvT);
  WMAP.pvT = setTimeout(wmapPvCommit, WMAP_CFG.pinchSettleMs);
  wmapPvApply();
  return pv.k;
}
function wmapPvCommit() {
  var pv = WMAP.pv;
  if (WMAP.pvT) { clearTimeout(WMAP.pvT); WMAP.pvT = 0; }
  if (!pv) return false;
  WMAP.pv = null;
  wmapPvApply();   // 先清掉預覽 transform,再以新幾何重烘(同一個同步流程內,不閃)
  wmapSetZoomW(pv.W0 * pv.k, pv.ox, pv.oy, pv.cx - pv.ox, pv.cy - pv.oy);
  return true;
}
function wmapInvalidate() { wmapClearChunks(); WMAP.bsig = ''; WMAP.sc = {}; WMAP.pat = {}; WMAP.tile = {}; WMAP.mask = {}; wmapBuildData(); wmapSchedule(); }

// ───────── 命中 / 選取 ─────────
function wmapTall(c, r) {   // 往上凸的資源領地點擊框(世界座標);城池(縣 / 郡 / 州 / 關 / 主城)改走 wmapNodeShapes 的點選形
  var G = WMAP.G, N = G.size, gi = r * N + c, bx;
  if (WMAP.res[gi]) { bx = wmapCellCenter(G, c, r); return { x: bx.x - G.W * 0.28, y: bx.y - G.H * 1.1, w: G.W * 0.56, h: G.H * 1.1 }; }   // 資源格:頂面中心往上 1.1 格高(里程碑 / 大樹的高度)
  return null;
}
function wmapPolyHas(p, x, y) {   // 多邊形(攤平 [x0,y0,x1,y1…])包含點?(射線法)
  var n = p.length / 2, i, j = n - 1, ins = false, xi, yi, xj, yj;
  for (i = 0; i < n; i++) {
    xi = p[2 * i]; yi = p[2 * i + 1]; xj = p[2 * j]; yj = p[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    j = i;
  }
  return ins;
}
function wmapHull(pts) {   // 凸包(Andrew monotone chain);pts = [[x, y]…] → 攤平 [x0, y0, …]
  var a = pts.slice().sort(function (u, v) { return u[0] - v[0] || u[1] - v[1]; }), lo = [], up = [], i, out = [];
  function cr(o, p, q) { return (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]); }
  for (i = 0; i < a.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], a[i]) <= 0) lo.pop(); lo.push(a[i]); }
  for (i = a.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], a[i]) <= 0) up.pop(); up.push(a[i]); }
  lo.pop(); up.pop(); lo = lo.concat(up);
  for (i = 0; i < lo.length; i++) out.push(lo[i][0], lo[i][1]);
  return out;
}
function wmapNodeShapes() {   // 城池點選形:占地頂面外殼 + 往上拉高 0.8 × (圖高 − 底座高) 的凸包;依最前格由前到後排序(前面的先測);縮放 / 換世界才重算
  var WG = WMAP.WG, G = WMAP.G, k = G.W / 256, list = [], i, nd, d, key;
  if (WMAP.nsWG === WG && WMAP.nsS === G.s && WMAP.ns) return WMAP.ns;
  function add(node, gi, c0, r0, fw, fh, ch) {
    var up = 0.8 * Math.max(0, ch - wmapBaseH(fw, fh)) * k, ca = [[c0, r0], [c0 + fw - 1, r0], [c0, r0 + fh - 1], [c0 + fw - 1, r0 + fh - 1]], pts = [], j, e, p, V;
    for (j = 0; j < 4; j++) {
      p = wmapCellCenter(G, ca[j][0], ca[j][1]);
      for (e = 0; e < 6; e++) { V = wmapHexVert(G, e); pts.push([p.x + V[0], p.y + V[1]], [p.x + V[0], p.y + V[1] - up]); }
    }
    list.push({ node: node, gi: gi, dep: c0 + r0 + fw + fh - 2, p: wmapHull(pts) });
  }
  if (WG.nodes) for (i = 0; i < WG.nodes.length; i++) {
    nd = WG.nodes[i]; key = wmapNodeKey(nd); d = wmapNodeDim(key, nd.fw, nd.fh);
    add(nd, nd.gi, nd.c0, nd.r0, nd.fw, nd.fh, d.ch);
  }
  if (!WG.noCity) { d = wmapNodeDim('CITY', 3, 3); add(null, WG.c0, WG.cx - 1, WG.cy - 1, 3, 3, d.ch); }
  list.sort(function (a, b) { return b.dep - a.dep; });
  WMAP.ns = list; WMAP.nsWG = WG; WMAP.nsS = G.s;
  return list;
}
function wmapCellText(gi) {
  var WG = WMAP.WG, N = WG.size, c = gi % N, r = (gi - c) / N, k = WG.k[gi], info = WMAP.res[gi], s = '(' + c + ',' + r + ') ' + WMAP_KNAME[k], nd;
  if (k === 6 || k === 8) return '(' + WG.cx + ',' + WG.cy + ') 我的主城(中心 + 6 鄰 + 庭院)';
  nd = wmNodeAt(WG, gi);
  if (nd) {   // 縣 4×4 / 郡 6×6 / 州 8×8 / 關 2×4:點城內任何格(含關門道)都是同一座
    return '(' + (nd.gi % N) + ',' + Math.floor(nd.gi / N) + ') ' + (nd.type === 'pass' ? '關口' : (nd.type === 'jun' ? '郡城' : (nd.type === 'zhou' ? '州城' : '縣城'))) + ' ' + Math.min(nd.fw, nd.fh) + '×' + Math.max(nd.fw, nd.fh)
      + (nd.type === 'pass' ? ' · 門道可通行・不可占領' : ' · 城內不可走不可占領') + (isFinite(nd.d) ? ' · 沿道路去程 ' + wmGoMins(nd.type === 'pass' ? nd.d : nd.d + 1).toFixed(1) + ' 分' : '');   // 關走到門外格就開打(cost = d),縣 / 郡 / 州最後一步進門(d + 1)
  }
  if (k !== 0) return s + (k === 1 || k === 2 || k === 3 ? ' · 不能通行' : '');
  if (info) s += ' Lv' + info.lv + ' ' + WMAP_RES[info.ty];
  else if (!(WG.zone && WG.zone[gi]) && !(WG.rt && WG.rt[gi] >= 0)) {   // 空地(不是資源格):不顯示 Lv;緊鄰己方錨點 = 可直接占領(wmapGoPaveAdj)
    s = '(' + c + ',' + r + ') 空地' + (typeof wmapGoPaveAdj === 'function' && wmapGoPaveAdj(WG, gi, WMAP.own, typeof WDUI !== 'undefined' ? WDUI.W : null) ? ' · 可直接占領' : ' · 需先連到己方領地');
  } else s += ' Lv' + Math.max(1, Math.min(10, wmGenRing(WG.d[gi])));
  if (!isFinite(WG.d[gi])) return s + ' · 超出行軍範圍';
  return s + ' · 去程 ' + wmGoMins(WG.d[gi]).toFixed(1) + ' 分';
}
function wmapHit(x, y) {   // x, y = 視窗內像素 → {gi, node};先測城池點選形(縣 / 郡 / 州 / 關 / 主城),再測格(含資源領地往上凸的框)
  var p = wmapCamPxNow(), wx = p.px + x, wy = p.py + y, sh = wmapNodeShapes(), i, gi;
  for (i = 0; i < sh.length; i++) if (wmapPolyHas(sh[i].p, wx, wy)) return { gi: sh[i].gi, node: sh[i].node };
  gi = wmapGiAt(WMAP.G, wx, wy, { border: WMAP.B, tall: wmapTall });
  return { gi: gi, node: gi >= 0 ? wmNodeAt(WMAP.WG, gi) : null };
}
function wmapSelect(gi) {
  var nd = null;
  if (gi >= 0) {
    if (WMAP.WG.k[gi] === 6 || WMAP.WG.k[gi] === 8) gi = WMAP.WG.c0;   // 主城任一格 / 庭院 = 點主城
    else { nd = wmNodeAt(WMAP.WG, gi); if (nd) gi = nd.gi; }           // 城池任一格 / 關門道 = 該城池(以主城門格代表)
  }
  WMAP.sel = gi;
  wmapPlaceSel();
  if (WMAP.card) { if (gi >= 0) { WMAP.card.textContent = wmapCellText(gi); WMAP.card.style.display = ''; } else WMAP.card.style.display = 'none'; }
  if (typeof WMAP.onSelect === 'function') WMAP.onSelect(gi, nd);
}
function wmapTap(x, y) {   // x, y = 視窗內像素
  var gi = wmapHit(x, y).gi;
  wmapSelect(gi === WMAP.sel ? -1 : gi);
}

// ───────── 輸入 ─────────
function wmapAdd(el, ev, fn, opt) { el.addEventListener(ev, fn, opt || false); WMAP.listeners.push([el, ev, fn, opt || false]); }
// 滾輪 / 觸控板:每次只累加目標格寬(單次最多 ±19%),用 rAF 緩動追上(每幀走 30% 差距),停手後才重烘
function wmapWheelZoom(dy, ax, ay) {
  var f = Math.exp(-Math.max(-0.12, Math.min(0.12, dy * WMAP_CFG.wheelK * 1.6))), w = WMAP.wz;
  if (!w) w = WMAP.wz = { cur: WMAP.pv ? WMAP.pv.W0 * WMAP.pv.k : WMAP.G.W, tgt: 0, ax: ax, ay: ay, raf: 0 };
  w.tgt = wmapZoomClamp((w.tgt || w.cur) * f); w.ax = ax; w.ay = ay;
  if (!w.raf) w.raf = requestAnimationFrame(wmapWheelStep);
}
function wmapWheelStep() {
  var w = WMAP.wz;
  if (!w) return;
  w.raf = 0;
  w.cur += (w.tgt - w.cur) * 0.3;
  if (Math.abs(w.tgt - w.cur) < 0.05) w.cur = w.tgt;
  if (WMAP.pv && (WMAP.pv.ox !== w.ax || WMAP.pv.oy !== w.ay)) wmapPvCommit();
  wmapPvTo(w.cur, w.ax, w.ay, w.ax, w.ay);
  if (w.cur !== w.tgt) w.raf = requestAnimationFrame(wmapWheelStep); else WMAP.wz = null;
}
function wmapPtrDist() { var ks = Object.keys(WMAP.ptrs), a = WMAP.ptrs[ks[0]], b = WMAP.ptrs[ks[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
function wmapBindInput() {
  var vp = WMAP.vp;
  wmapAdd(vp, 'pointerdown', function (e) {
    var rc = vp.getBoundingClientRect(), n;
    if (e.target.closest && e.target.closest('.wmap-btn')) return;
    if (WMAP.pv) wmapPvCommit();
    WMAP.wz = null;
    WMAP.ptrs[e.pointerId] = { x: e.clientX - rc.left, y: e.clientY - rc.top };
    try { vp.setPointerCapture(e.pointerId); } catch (er) { /* 略過 */ }
    n = Object.keys(WMAP.ptrs).length;
    if (n === 1) { var p = wmapCamPxNow(); WMAP.drag = { x0: e.clientX, y0: e.clientY, t0: performance.now(), px: p.px, py: p.py, moved: false }; }
    else if (n === 2) { WMAP.drag = null; WMAP.pinch = { d0: wmapPtrDist(), W0: WMAP.G.W }; }
    e.preventDefault();
  });
  wmapAdd(vp, 'pointermove', function (e) {
    var rc = vp.getBoundingClientRect(), d = WMAP.drag, n, dx, dy, mx, my, ks, a, b, r, k;
    if (!WMAP.ptrs[e.pointerId]) return;
    WMAP.ptrs[e.pointerId] = { x: e.clientX - rc.left, y: e.clientY - rc.top };
    n = Object.keys(WMAP.ptrs).length;
    if (n >= 2 && WMAP.pinch) {
      r = wmapPtrDist() / WMAP.pinch.d0; ks = Object.keys(WMAP.ptrs); a = WMAP.ptrs[ks[0]]; b = WMAP.ptrs[ks[1]];
      if (!WMAP.pinch.o) WMAP.pinch.o = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      k = wmapPvTo(WMAP.pinch.W0 * r, (a.x + b.x) / 2, (a.y + b.y) / 2, WMAP.pinch.o.x, WMAP.pinch.o.y);
      if (k < 0.75 || k > 1.33) { wmapPvCommit(); WMAP.pinch = { d0: wmapPtrDist(), W0: WMAP.G.W, o: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; }
      return;
    }
    if (!d) return;
    dx = e.clientX - d.x0; dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    d.moved = true;
    WMAP.cam = wmapCamClamp(WMAP.G, wmapCamFromPx(WMAP.G, d.px - dx, d.py - dy, WMAP.vw, WMAP.vh), { border: WMAP.B });
    wmapSchedule();
  });
  function up(e) {
    var d = WMAP.drag, rc = vp.getBoundingClientRect();
    if (!WMAP.ptrs[e.pointerId]) return;
    delete WMAP.ptrs[e.pointerId];
    try { vp.releasePointerCapture(e.pointerId); } catch (er) { /* 略過 */ }
    if (Object.keys(WMAP.ptrs).length < 2 && WMAP.pinch) {   // 雙指結束:立刻定案縮放;剩下的一指接著拖曳(不當成點選)
      WMAP.pinch = null; wmapPvCommit();
      var rest = Object.keys(WMAP.ptrs)[0], pp = rest !== undefined ? WMAP.ptrs[rest] : null, p0;
      if (pp) { p0 = wmapCamPxNow(); WMAP.drag = { x0: pp.x + rc.left, y0: pp.y + rc.top, t0: 0, px: p0.px, py: p0.py, moved: true, noTap: true }; return; }
    }
    if (d && !d.noTap && e.type === 'pointerup' && wmapTapOk(e.clientX - d.x0, e.clientY - d.y0, performance.now() - d.t0)) wmapTap(e.clientX - rc.left, e.clientY - rc.top);
    WMAP.drag = null;
  }
  wmapAdd(vp, 'pointerup', up); wmapAdd(vp, 'pointercancel', up);
  wmapAdd(vp, 'wheel', function (e) {
    var rc = vp.getBoundingClientRect(), t = performance.now();
    e.preventDefault();
    wmapWheelZoom(e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 4 : 1), e.clientX - rc.left, e.clientY - rc.top);
  }, { passive: false });
  wmapAdd(window, 'resize', wmapResize);
  wmapAdd(window, 'orientationchange', wmapResize);
}

// ───────── 掛載 ─────────
function wmapMount(o) {
  var parent, WG, html;
  if (WMAP.on || typeof document === 'undefined') return false;
  o = o || {};
  WG = wmGen(o.seed !== undefined ? o.seed : 20261116, o.size);
  WMAP.WG = WG; WMAP.N = WG.size; WMAP.B = WG.border; WMAP.seed = WG.seed;
  WMAP.dpr = (typeof wmapArtLowQ === 'function' && wmapArtLowQ()) ? 1 : Math.min(WMAP_CFG.dprCap, window.devicePixelRatio || 1);
  WMAP.zi = 0; WMAP.pv = null; WMAP.wz = null;
  WMAP.G = wmapGeom(WMAP_CFG.zDef, WG.size);   // 2026-11-18:連續縮放,預設格寬 56(範圍 36~72)
  WMAP.dbg = /[?&]wmapdbg=1(&|$)/.test(String(window.location.search || ''));
  WMAP.chunks = {}; WMAP.nChunks = 0; WMAP.sc = {}; WMAP.pat = {}; WMAP.tile = {}; WMAP.mask = {}; WMAP.lv = null; WMAP.tmp = null; WMAP.fpool = []; WMAP.bsig = ''; WMAP.bakes = 0; WMAP.bakeMs = 0; WMAP.ptrs = {}; WMAP.drag = null; WMAP.pinch = null; WMAP.sel = -1; WMAP.listeners = [];
  wmapBuildData();
  wmapTexKickLoad();
  if (typeof wmapObjKickLoad === 'function') wmapObjKickLoad();
  parent = o.parent || document.body;
  html = '<div id="wmapVp"><div id="wmapWorld"></div></div><div class="wmap-card" style="display:none"></div>' + (WMAP.dbg ? '<div class="wmap-hud"></div>' : '');
  WMAP.root = document.createElement('div'); WMAP.root.id = 'wmapRoot'; WMAP.root.innerHTML = html; parent.appendChild(WMAP.root);
  WMAP.vp = WMAP.root.querySelector('#wmapVp'); WMAP.world = WMAP.root.querySelector('#wmapWorld'); WMAP.card = WMAP.root.querySelector('.wmap-card'); WMAP.hud = WMAP.root.querySelector('.wmap-hud'); WMAP.zoomEl = WMAP.root.querySelector('.wmap-zl');
  wmapZoomUi();
  WMAP.selEls = [];
  WMAP.on = true;
  WMAP.vw = WMAP.vp.clientWidth || window.innerWidth; WMAP.vh = WMAP.vp.clientHeight || window.innerHeight;
  WMAP.cam = wmapCamClamp(WMAP.G, { u: WG.cx + 0.5, v: WG.cy + 0.5 }, { border: WMAP.B });
  wmapBindInput();
  var p = wmapCamPxNow();
  WMAP.world.style.transform = 'translate3d(' + (-p.px) + 'px,' + (-p.py) + 'px,0)';
  wmapEnsureChunks(p.px, p.py, 99);
  wmapUpdateOverlay(p.px, p.py);
  if (typeof wmapUpdateFind === 'function') wmapUpdateFind(p.px, p.py);
  wmapSchedule();
  return true;
}
function wmapUnmount() {
  var i, l;
  if (!WMAP.on) return;
  for (i = 0; i < WMAP.listeners.length; i++) { l = WMAP.listeners[i]; l[0].removeEventListener(l[1], l[2], l[3]); }
  WMAP.listeners = []; wmapClearChunks();
  if (WMAP.raf) { cancelAnimationFrame(WMAP.raf); WMAP.raf = 0; }
  if (WMAP.root && WMAP.root.parentNode) WMAP.root.parentNode.removeChild(WMAP.root);
  if (typeof wmapSearchSet === 'function') { try { wmapSearchSet(null); } catch (e) { /* 標示狀態清理失敗不影響卸載 */ } }
  WMAP.fcon = null; WMAP.fnode = []; WMAP.fdraw = '';
  WMAP.root = null; WMAP.on = false;
}
function wmapStats() {
  return { chunks: WMAP.nChunks, bakes: WMAP.bakes, bakeAvgMs: WMAP.bakes ? WMAP.bakeMs / WMAP.bakes : 0, dom: WMAP.root ? WMAP.root.getElementsByTagName('*').length : 0,
    owns: Object.keys(WMAP.own).length, zoom: WMAP.G ? WMAP.G.s : 0, vw: WMAP.vw, vh: WMAP.vh };
}

// ───────── 自動掛載:只有網址 ?wmap=1 才動(其餘情況本檔載入後不做任何事) ─────────
(function () {
  var want = false;
  try { want = typeof window !== 'undefined' && !!window.location && /[?&]wmap=1(&|$)/.test(String(window.location.search || '')); } catch (e) { want = false; }
  if (!want || typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { if (typeof wmapUiOn === 'function' && wmapUiOn()) return; wmapMount(); });   // W2:外殼 ld 模式 + 旗標 wmap 開時改由 wmap_ui.js 掛進主畫面場景
  else if (!(typeof wmapUiOn === 'function' && wmapUiOn())) wmapMount();
})();
