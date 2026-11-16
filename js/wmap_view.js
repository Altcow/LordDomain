// js/wmap_view.js — M1 斜角大地圖畫面層(設計_M1視覺原型_實作計畫.md W1;設計_地圖斜角視覺_規格.md 1.3、1.5、6.2):
//   ?wmap=1 時掛載 #wmapRoot(整頁疊在最上,不動既有首頁 DOM);沒有 ?wmap=1 時本檔載入後什麼都不做(首頁逐像素不變)。
//   烘焙分塊:256 CSS px 見方的 canvas(只建視窗內 + 預取一圈、上限 20 塊、LRU 回收),整張 world 用 transform 平移;
//   覆蓋層 DOM = 只有「我的朱紅框」的格才有節點(節點池)+ 1 個選取框;領地等級靠烘焙畫面的物件疏密 / 大小 / 地面覆蓋 / 里程碑表現(wmap_res.js 演算法、wmap_art.js 圖形),地圖上沒有任何文字或數字;視窗外不渲染;拖曳 / 滾輪 / 雙指 / 按鈕三段縮放(格 44 / 64 / 104);點擊命中 → 選取框 + 資訊列。
//   目前資料 = wmGen(種子) 的世界(W0);領地(Lv / 種類)與我的占領是「示範資料」(wmapDemo*,由 W3 / W5 換成真資料,接口見下)。
//   ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:wm_gen.js、wmap_proj.js、wmap_art.js 之後。命名:全域一律 wmap* / WMAP_*。
//
// ───────── 公開 API(給 W2 / W3 / W5 / W6;W4 軍隊層請用 wmap_proj.js) ─────────
//   WMAP                      狀態物件:{WG, G, zi, cam, vw, vh, root, world, own:{gi:1}, sel:gi|−1, onSelect, cellInfo, ...}
//   wmapMount(o) → bool       o = {seed, size, parent}:建立畫面並開始;已掛載回 false。?wmap=1 時載入後自動以預設值呼叫
//   wmapUnmount()             移除畫面與監聽
//   wmapSetCam(u, v)          鏡頭置中到連續座標 (u, v)(格座標,中心 = c + 0.5);會夾住並重畫
//   wmapSetZoom(idx, ax, ay)  三段縮放(0 / 1 / 2);(ax, ay) = 視窗內錨點像素,省略 = 視窗中心
//   wmapSelect(gi)            選取一格(−1 = 取消);會呼叫 WMAP.onSelect(gi)
//   wmapInvalidate()          格內容改變(占領 / 刷新)後重烘全部可見分塊與朱紅框(W5 之後可改成只烘受影響分塊)
//   wmapCellText(gi) → 字串   資訊列文字(座標 / 地形 / Lv / 領地種類 / 去程);W3 換成地塊卡時替換
//   WMAP.cellInfo(gi) → {ty:'farm'|'mine'|'hunt'|'lumber'|'quarry', lv}|null   該格是否為資源領地、等級多少(畫成物件疏密 / 里程碑;預設 = 示範資料;W3 以 wmCell 取代)
//   wmapHit(x, y) → {gi, node}  視窗內像素的命中(含往上凸物件);node = wm_gen 的 WG.nodes 項({id, type:'county'|'pass', gi, adj, d})或 null(縣城 / 關口單格;不可走不可占領,出征請用 node.adj 與 node.d);點一下選取時 WMAP.onSelect(gi, node)
//   wmapStats() → {chunks, bakes, bakeAvgMs, dom, owns, zoom, vw, vh}      量測用

var WMAP = { on: false, WG: null, G: null, zi: 1, cam: { u: 32, v: 32 }, vw: 0, vh: 0, root: null, vp: null, world: null, own: {}, sel: -1, onSelect: null, cellInfo: null,
  chunks: {}, nChunks: 0, stamp: 0, sc: {}, dpr: 1, raf: 0, objs: [], res: {}, resList: [], F: null, pat: {}, fpool: [], bsig: '', bakes: 0, bakeMs: 0, ptrs: {}, drag: null, wheelAcc: 0, wheelT: 0,
  selEls: [], card: null, hud: null, dbg: false, ground: null, seed: 0, B: 4, N: 64, listeners: [] };
var WMAP_KNAME = ['平地', '山', '大石', '河', '淺灘', '道路', '主城', '邊界', '城內庭院', '縣城', '關口'];
var WMAP_TY = ['farm', 'mine', 'hunt', 'lumber', 'quarry'];
var WMAP_PRI = { grass: 6, wood: 5, dirt: 3, rammed: 2, rock: 0 };

// ───────── 示範資料(W3 / W5 換掉) ─────────
function wmapNoise(seed, x, y, sc) {
  var fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, a, b, c, d, s = seed ^ (sc * 0x2545);
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  a = wmGenHash01(s, x0, y0); b = wmGenHash01(s, x0 + 1, y0); c = wmGenHash01(s, x0, y0 + 1); d = wmGenHash01(s, x0 + 1, y0 + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function wmapDemoCellInfo(gi) {
  var WG = WMAP.WG, h, cost, lv;
  if (!WG || WG.k[gi] !== 0 || !isFinite(WG.d[gi])) return null;
  h = wmGenHash(WG.seed, gi, 77);
  if (h % 100 >= 20) return null;
  cost = WG.d[gi]; lv = Math.max(1, Math.min(10, wmGenRing(cost) + ((h >>> 12) % 3) - 1));
  return { ty: WMAP_TY[(h >>> 8) % 5], lv: lv };
}
function wmapInfoOf(gi) { return WMAP.cellInfo ? WMAP.cellInfo(gi) : wmapDemoCellInfo(gi); }

// ───────── 資料準備 ─────────
function wmapGroundType(gi) {   // 地面種類(只影響外觀)
  var WG = WMAP.WG, N = WG.size, k = WG.k[gi], x = gi % N, y = (gi - x) / N, n1, n2;
  if (k === 6 || k === 8 || k === 9) return 'rammed';
  if (k === 10) return 'dirt';
  if (k === 1) return 'rock';
  n1 = wmapNoise(WG.seed, x, y, 9); n2 = wmapNoise(WG.seed + 7, x, y, 7);
  if (k === 7) return n1 > 0.45 ? 'wood' : 'rock';
  if (n1 > 0.72) return 'dirt';
  if (n2 > 0.7) return 'wood';
  return 'grass';
}
function wmapPassAxis(nd) {   // 關口門牆朝向:0 = 道路沿 c(u)方向進出、1 = 沿 r(v)方向
  var WG = WMAP.WG, N = WG.size, c = nd.gi % N, r = (nd.gi - c) / N;
  if (WG.k[nd.gi - 1] === 5 || WG.k[nd.gi + 1] === 5) return 0;
  if (r > 0 && (WG.k[nd.gi - N] === 5 || WG.k[nd.gi + N] === 5)) return 1;
  return nd.adj >= 0 && nd.adj % N !== c ? 0 : 1;
}
function wmapBuildData() {
  var WG = WMAP.WG, N = WG.size, B = WG.border, n = N * N, i, x, y, gt = new Array(n), objs = [], p, id, P, info, h, c0, r0, tall, e, rty = new Int8Array(n).fill(-1), rlv = new Uint8Array(n), rok = new Uint8Array(n);
  WMAP.N = N; WMAP.B = B; WMAP.res = {}; WMAP.resList = []; WMAP.own = {};
  for (i = 0; i < n; i++) gt[i] = wmapGroundType(i);
  WMAP.ground = gt;
  for (i = 0; i < WG.pcs.length; i++) {   // 山 / 大石
    p = WG.pcs[i]; id = p.id; P = WMAP_PIECE[id]; if (!P) continue;
    objs.push({ key: id, c0: p.gi % N, r0: Math.floor(p.gi / N), fw: P.fw, fh: P.fh, cw: P.cw, ch: P.ch, al: 1 });
  }
  if (WG.nodes) for (i = 0; i < WG.nodes.length; i++) {   // 縣城 / 關口(單格建築,畫在道路上)
    e = WG.nodes[i]; id = e.type === 'pass' ? 'PASS' + wmapPassAxis(e) : 'COUNTY'; P = WMAP_PIECE[id];
    objs.push({ key: id, c0: e.gi % N, r0: Math.floor(e.gi / N), fw: 1, fh: 1, cw: P.cw, ch: P.ch, al: 1 });
  }
  if (!WG.noCity) objs.push({ key: 'CITY', c0: WG.cx - 1, r0: WG.cy - 1, fw: 3, fh: 3, cw: WMAP_PIECE.CITY.cw, ch: WMAP_PIECE.CITY.ch, al: 1 });
  for (i = 0; i < n; i++) {   // 領地(示範)與邊界帶裝飾
    x = i % N; y = (i - x) / N;
    if (WG.k[i] === 0) {
      rok[i] = 1;
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
      if (id) { P = WMAP_PIECE[id]; objs.push({ key: id, c0: x, r0: y, fw: 1, fh: 1, cw: P.cw, ch: P.ch, al: 0.95 - 0.16 * (B - 1 - e) }); }
    }
  }
  WMAP.F = wmapResPrep({ N: N, rty: rty, rlv: rlv, rok: rok });
  objs.sort(function (a, b) { return ((a.r0 + a.fh - 1) + (a.c0 + a.fw - 1)) - ((b.r0 + b.fh - 1) + (b.c0 + b.fw - 1)) || (a.c0 - a.r0) - (b.c0 - b.r0); });
  WMAP.objs = objs;
}

// ───────── 縮放後的圖(依格大小與 DPR 預縮,分塊畫的時候 1:1 貼) ─────────
function wmapScaled(key) {
  var s = WMAP.sc[key], a, k, w, h, c, g;
  if (s) return s;
  a = wmapArtGet(key); if (!a) return null;
  k = WMAP.G.W / 256 * WMAP.dpr;
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
  var s = wmapScaled(key), k = WMAP.G.W / 256;
  if (!s) return;
  g.drawImage(s.c, x, y, cw * k, ch * k);
}

// ───────── 烘焙一塊 ─────────
function wmapBakeChunk(ix, iy) {
  var t0 = performance.now(), CH = WMAP_CFG.chunk, G = WMAP.G, WG = WMAP.WG, N = G.size, B = WMAP.B, dpr = WMAP.dpr, x0 = ix * CH, y0 = iy * CH, x1 = x0 + CH, y1 = y0 + CH,
    key = wmapChunkKey(ix, iy), rg = wmapCellsInRect(G, x0, y0, x1, y1, 0, G.W / 2), ch, g, c, r, gi, t, k, rc, i, o, bx, nb, e, d, tmp, tg, ent;
  ent = { used: WMAP.stamp, empty: false, cv: null };
  WMAP.chunks[key] = ent; WMAP.nChunks++;
  // 物件先挑出來(有重疊的):畫在最後;若沒有任何格也沒有物件 → 空塊
  var objs = [], cells = [];
  for (r = rg.r0; r <= rg.r1; r++) for (c = rg.c0; c <= rg.c1; c++) {
    rc = wmapCellRect(G, c, r);
    if (rc.x + rc.w < x0 || rc.x > x1 || rc.y + rc.h < y0 || rc.y > y1) continue;
    cells.push(r * N + c);
  }
  for (i = 0; i < WMAP.objs.length; i++) {
    o = WMAP.objs[i];
    bx = wmapPieceBox(G, o.c0, o.r0, o.fw, o.fh, o.cw, o.ch);
    if (bx.x + bx.w < x0 || bx.x > x1 || bx.y + bx.h < y0 || bx.y > y1) continue;
    objs.push(o);
  }
  if (!cells.length && !objs.length) { ent.empty = true; WMAP.bakes++; WMAP.bakeMs += performance.now() - t0; return ent; }
  ch = document.createElement('canvas'); ch.width = CH * dpr; ch.height = CH * dpr; ch.style.width = CH + 'px'; ch.style.height = CH + 'px'; ch.style.transform = 'translate(' + x0 + 'px,' + y0 + 'px)';
  g = ch.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
  // 1 地面 + 過渡
  for (i = 0; i < cells.length; i++) {
    gi = cells[i]; c = gi % N; r = (gi - c) / N;
    t = wmapCellTop(G, c, r);
    wmapBakeGround(g, gi, c, r, t.x - G.W / 2, t.y);
  }
  // 2 河(岸 → 水 → 高光)、路(邊 → 面)
  for (i = 0; i < cells.length; i++) {
    gi = cells[i]; k = WG.k[gi];
    if (k === 3 || k === 4 || wmapBridge(gi)) {
      c = gi % N; r = (gi - c) / N; nb = wmapRiverNb(gi);
      g.save(); wmapArtIsoT(g, G, c, r); wmapArtRiver(g, 'bank', nb, false, 0, wmapRiverDg(gi)); g.restore();
    }
  }
  for (i = 0; i < cells.length; i++) {
    gi = cells[i]; k = WG.k[gi];
    if (k === 3 || k === 4 || wmapBridge(gi)) {
      c = gi % N; r = (gi - c) / N; nb = wmapRiverNb(gi);
      g.save(); wmapArtIsoT(g, G, c, r); wmapArtRiver(g, 'water', nb, k === 4, 0, wmapRiverDg(gi)); wmapArtRiver(g, 'hi', nb, k === 4, wmGenHash(WG.seed, gi, 9)); g.restore();
    }
  }
  wmapBakeRoads(g, G, cells);
  // 3 資源地面層(斑塊 / 田塊 / 田埂,世界錨定)
  wmapBakeResGround(g, G, x0, y0, x1, y1);
  // 4 物件層(既有山 / 大石 / 主城 / 邊界裝飾 + 散布物件 + 里程碑 + 旗,合併深度排序)
  wmapBakeObjects(g, G, x0, y0, x1, y1, objs);
  // 5 邊界帶霧(離地圖越遠越濃)
  g.fillStyle = WMAP_PAL.fog;
  for (i = 0; i < cells.length; i++) {
    gi = cells[i]; if (WG.k[gi] !== 7) continue;
    c = gi % N; r = (gi - c) / N; e = Math.min(c, r, N - 1 - c, N - 1 - r);
    g.globalAlpha = 0.2 + 0.2 * (B - 1 - e);
    t = wmapCellTop(G, c, r);
    g.beginPath(); g.moveTo(t.x, t.y - 1); g.lineTo(t.x + G.W / 2 + 1, t.y + G.H / 2); g.lineTo(t.x, t.y + G.H + 1); g.lineTo(t.x - G.W / 2 - 1, t.y + G.H / 2); g.closePath(); g.fill();
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
function wmapResPat(g, id) {   // 紋理 pattern:1 張 = 世界 4×4 格,錨定世界原點(在「單位 = 格」的 transform 下填)
  var pt, a;
  WMAP.pat = WMAP.pat || {};
  if (WMAP.pat[id]) return WMAP.pat[id];
  a = wmapArtGet(id); if (!a) return '#888';
  pt = g.createPattern(a.c, 'repeat');
  if (pt && pt.setTransform && typeof DOMMatrix !== 'undefined') pt.setTransform(new DOMMatrix().scale(4 / a.cw));
  WMAP.pat[id] = pt || '#888';
  return WMAP.pat[id];
}
function wmapBakeResGround(g, G, x0, y0, x1, y1) {
  var F = WMAP.F, m = G.W * 0.5, b, pa, pc, i, j, p, an, x, y, tt, n, c, r, c0, c1, r0, r1;
  if (!F || !WMAP.resList.length) return;
  b = wmapResUV(G, x0 - m, y0 - m, x1 + m, y1 + m);
  pa = wmapResPatches(F, WMAP.seed, b.u0, b.v0, b.u1, b.v1);
  pc = wmapResParcels(F, WMAP.seed, b.u0, b.v0, b.u1, b.v1);
  g.save(); wmapArtIsoT(g, G, 0, 0);   // 整塊共用一次等角 transform(單位 = 格)
  c0 = Math.max(0, Math.floor(b.u0)); c1 = Math.min(F.N - 1, Math.floor(b.u1)); r0 = Math.max(0, Math.floor(b.v0)); r1 = Math.min(F.N - 1, Math.floor(b.v1));
  for (tt = 0; tt < 5; tt++) {   // 資源格整格鋪滿該種類紋理:每種 1 次 fill
    n = 0; g.beginPath();
    for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) if (F.rty[r * F.N + c] === tt) { g.rect(c - 0.004, r - 0.004, 1.008, 1.008); n++; }
    if (n) { g.fillStyle = wmapResPat(g, tt === 0 ? 'gt_farm_a' : 'gt_' + WMAP_RES_ORDER[tt]); g.fill(); }
  }
  for (tt = 1; tt < 5; tt++) {   // 斑塊依種類合併成一條路徑填色(每種 1 次 fill)
    n = 0; g.beginPath();
    for (i = 0; i < pa.length; i++) {
      p = pa[i]; if (p.t !== tt) continue;
      n++;
      for (j = 0; j < 8; j++) {
        an = j / 8 * Math.PI * 2; x = p.u + Math.cos(an) * p.r * p.k[j]; y = p.v + Math.sin(an) * p.r * p.k[j];
        if (j) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
    }
    if (n) { g.fillStyle = wmapResPat(g, 'gt_' + WMAP_RES_ORDER[tt]); g.fill(); }
  }
  g.globalAlpha = 1;
  for (i = 0; i < pc.length; i++) { p = pc[i]; g.fillStyle = wmapResPat(g, p.gold ? 'gt_farm_b' : 'gt_farm_a'); g.fillRect(p.u - 0.005, p.v - 0.005, 0.51, 0.51); }
  g.strokeStyle = '#c8a36a'; g.lineWidth = 0.03; g.lineCap = 'square'; g.beginPath();
  for (i = 0; i < pc.length; i++) {
    p = pc[i];
    if (p.eT) { g.moveTo(p.u, p.v); g.lineTo(p.u + 0.5, p.v); }
    if (p.eB) { g.moveTo(p.u, p.v + 0.5); g.lineTo(p.u + 0.5, p.v + 0.5); }
    if (p.eL) { g.moveTo(p.u, p.v); g.lineTo(p.u, p.v + 0.5); }
    if (p.eR) { g.moveTo(p.u + 0.5, p.v); g.lineTo(p.u + 0.5, p.v + 0.5); }
  }
  g.stroke();
  g.restore();
}
// 土道路:整塊共用一次等角 transform(單位 = 格),所有路格的臂合併成一條路徑,邊 1 次 fill + 面 1 次 fill(世界錨定的 gt_road 紋理);橋另畫木板
var WMAP_RD = { edge: 0.26, fill: 0.2, ext: 0.02, edgeCol: 'rgba(132,102,58,0.78)', bEdge: '#4a3b2c', bFill: '#a9835a', bPlank: '#7a5a36' };
function wmapRoadShape(g, c, r, m, hw) {   // 一個路格的形狀:中心圓 + 朝 4 向(m 低 4 位)的臂 + 只有斜向相連時的斜臂(m 高 4 位)
  var x = c + 0.5, y = r + 0.5, e = WMAP_RD.ext, i, dx, dy, k, ax, ay, px, py;
  g.moveTo(x + hw, y); g.arc(x, y, hw, 0, 6.2831853);
  if (m & 1) g.rect(x - hw, y - 0.5 - e, hw * 2, 0.5 + e);
  if (m & 2) g.rect(x, y - hw, 0.5 + e, hw * 2);
  if (m & 4) g.rect(x - hw, y, hw * 2, 0.5 + e);
  if (m & 8) g.rect(x - 0.5 - e, y - hw, 0.5 + e, hw * 2);
  if (m & 240) {
    for (i = 0; i < 4; i++) {
      if (!(m & (16 << i))) continue;
      dx = i === 0 || i === 1 ? 1 : -1; dy = i === 1 || i === 2 ? 1 : -1;   // 右上、右下、左下、左上
      k = 0.70710678; ax = x + dx * 0.5; ay = y + dy * 0.5; px = -dy * hw * k; py = dx * hw * k;
      g.moveTo(x + px, y + py); g.lineTo(x - px, y - py); g.lineTo(ax - px, ay - py); g.lineTo(ax + px, ay + py);
      g.closePath();
    }
  }
}
function wmapBakeRoads(g, G, cells) {
  var WG = WMAP.WG, N = G.size, list = [], br = [], i, j, gi, k, c, r, m, x, y, h;
  for (i = 0; i < cells.length; i++) {
    gi = cells[i]; k = WG.k[gi];
    if (k !== 5 && k !== 9 && k !== 10) continue;
    c = gi % N; r = (gi - c) / N; m = wmapRoadArms(gi);
    if (k === 5 && wmapBridge(gi)) br.push(c, r, m); else list.push(c, r, m);
  }
  if (!list.length && !br.length) return;
  g.save(); wmapArtIsoT(g, G, 0, 0);
  if (list.length) {
    g.beginPath(); for (i = 0; i < list.length; i += 3) wmapRoadShape(g, list[i], list[i + 1], list[i + 2], WMAP_RD.edge);
    g.fillStyle = WMAP_RD.edgeCol; g.fill();
    g.beginPath(); for (i = 0; i < list.length; i += 3) wmapRoadShape(g, list[i], list[i + 1], list[i + 2], WMAP_RD.fill);
    g.fillStyle = wmapResPat(g, 'gt_road'); g.fill();
  }
  if (br.length) {   // 橋:深邊 + 木板面 + 橫木板線
    g.beginPath(); for (i = 0; i < br.length; i += 3) wmapRoadShape(g, br[i], br[i + 1], br[i + 2] & 15, WMAP_RD.edge + 0.04);
    g.fillStyle = WMAP_RD.bEdge; g.fill();
    g.beginPath(); for (i = 0; i < br.length; i += 3) wmapRoadShape(g, br[i], br[i + 1], br[i + 2] & 15, WMAP_RD.fill + 0.03);
    g.fillStyle = WMAP_RD.bFill; g.fill();
    g.strokeStyle = WMAP_RD.bPlank; g.lineWidth = 0.03; g.beginPath();
    for (i = 0; i < br.length; i += 3) {
      x = br[i] + 0.5; y = br[i + 1] + 0.5; m = br[i + 2]; h = WMAP_RD.fill + 0.03;
      for (j = 0; j < 4; j++) {
        k = 0.14 + j * 0.24 - 0.5;
        if (m & 10) { g.moveTo(x + k, y - h); g.lineTo(x + k, y + h); }
        if (m & 5) { g.moveTo(x - h, y + k); g.lineTo(x + h, y + k); }
      }
    }
    g.stroke();
  }
  g.restore();
}
function wmapBakeObjects(g, G, x0, y0, x1, y1, objs) {
  var F = WMAP.F, k = G.W / 256, W = G.W, cfg = WMAP_RES_CFG, zi = WMAP.zi, items = [], sc = [], i, j, o, bx, b, pts, p, a, q, rg, ms, m, n, key, pos, f, it, ssz, rx;
  function hit(fx, fy, an) { return fx - an.ax * k < x1 && fx + (an.cw - an.ax) * k > x0 && fy - an.ay * k < y1 && fy + (an.ch - an.ay) * k > y0; }
  for (i = 0; i < objs.length; i++) { o = objs[i]; items.push({ dep: (o.r0 + o.fh - 1) + (o.c0 + o.fw - 1), tie: o.c0 - o.r0, id: 0, ty: 0, o: o }); }
  if (F && WMAP.resList.length) {
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
      o = it.o; bx = wmapPieceBox(G, o.c0, o.r0, o.fw, o.fh, o.cw, o.ch);
      if (o.al < 1) g.globalAlpha = Math.max(0.3, o.al);
      wmapDrawArt(g, o.key, bx.x, bx.y, o.cw, o.ch);
      if (o.al < 1) g.globalAlpha = 1;
      continue;
    }
    wmapDrawArt(g, it.key, it.fx - it.a.ax * k, it.fy - it.a.ay * k, it.a.cw, it.a.ch);
  }
}
function wmapBakeGround(g, gi, c, r, x, y) {
  var G = WMAP.G, WG = WMAP.WG, N = G.size, gt = WMAP.ground[gi], v = WG.g[gi], key = wmapArtGroundKey(gt, v), s = wmapScaled(key), D = [[0, -1], [1, 0], [0, 1], [-1, 0]], e, nc, nr, ngi, ngt, tmp, tg, ms, ns, dpr = WMAP.dpr, w = G.W, h = G.H;
  if (s) g.drawImage(s.c, x - 0.5, y - 0.3, w + 1, h + 0.6);
  for (e = 0; e < 4; e++) {   // 地面優先序較高的鄰格往本格滲(只在兩邊都是野外地面時)
    nc = c + D[e][0]; nr = r + D[e][1];
    if (nc < 0 || nr < 0 || nc >= N || nr >= N) continue;
    ngi = nr * N + nc; ngt = WMAP.ground[ngi];
    if (ngt === gt || !(ngt in WMAP_PRI) || !(gt in WMAP_PRI) || WMAP_PRI[ngt] <= WMAP_PRI[gt]) continue;
    ns = wmapScaled(wmapArtGroundKey(ngt, WG.g[ngi])); ms = wmapScaled('mask_' + (e + 4 * ((wmGenHash(WG.seed, gi, 5)) & 1)));
    if (!ns || !ms) continue;
    tmp = WMAP.tmp; if (!tmp || tmp.width !== ns.c.width || tmp.height !== ns.c.height) { tmp = WMAP.tmp = document.createElement('canvas'); tmp.width = ns.c.width; tmp.height = ns.c.height; }
    tg = tmp.getContext('2d'); tg.globalCompositeOperation = 'copy'; tg.drawImage(ns.c, 0, 0);
    tg.globalCompositeOperation = 'destination-in'; tg.drawImage(ms.c, 0, 0, tmp.width, tmp.height);
    tg.globalCompositeOperation = 'source-over';
    g.drawImage(tmp, x, y, w, h);
  }
}
function wmapKAt(c, r) { var N = WMAP.N; if (c < 0 || r < 0 || c >= N || r >= N) return 7; return WMAP.WG.k[r * N + c]; }
function wmapBridge(gi) {   // 道路格兩側(上下或左右)都是河 = 橋
  var N = WMAP.N, c = gi % N, r = (gi - c) / N, k;
  if (WMAP.WG.k[gi] !== 5) return false;
  k = function (a, b) { var v = wmapKAt(a, b); return v === 3 || v === 4; };
  return (k(c, r - 1) && k(c, r + 1)) || (k(c - 1, r) && k(c + 1, r));
}
function wmapRiverNb(gi) {   // 河四鄰:[r−1, c+1, r+1, c−1]
  var N = WMAP.N, c = gi % N, r = (gi - c) / N, D = [[0, -1], [1, 0], [0, 1], [-1, 0]], out = [false, false, false, false], i, v, kk = WMAP.WG.k[gi];
  for (i = 0; i < 4; i++) {
    v = wmapKAt(c + D[i][0], r + D[i][1]);
    out[i] = v === 3 || v === 4 || v === 7;
  }
  if (kk === 5) {   // 橋:只畫河的兩個方向
    if ((out[0] && out[2]) && !(out[1] && out[3])) { out[1] = false; out[3] = false; } else if (out[1] && out[3]) { out[0] = false; out[2] = false; }
  }
  return out;
}
function wmapRiverDg(gi) {   // 兩個相鄰方向與其斜角鄰格都是河 → 補洞用
  var N = WMAP.N, c = gi % N, r = (gi - c) / N, D = [[0, -1], [1, 0], [0, 1], [-1, 0]], out = [false, false, false, false], i, a, b, v1, v2, v3;
  for (i = 0; i < 4; i++) {
    a = D[i]; b = D[(i + 1) & 3];
    v1 = wmapKAt(c + a[0], r + a[1]); v2 = wmapKAt(c + b[0], r + b[1]); v3 = wmapKAt(c + a[0] + b[0], r + a[1] + b[1]);
    out[i] = (v1 === 3 || v1 === 4) && (v2 === 3 || v2 === 4) && (v3 === 3 || v3 === 4);
  }
  return out;
}
function wmapRoadArms(gi) {   // 路格 / 縣關格的接邊:低 4 位 = 4 向 [r−1, c+1, r+1, c−1] 相連;高 4 位 = 只有斜向相連(8 鄰)[右上, 右下, 左下, 左上]
  var N = WMAP.N, WG = WMAP.WG, c = gi % N, r = (gi - c) / N, node = WG.k[gi] !== 5, D = [[0, -1], [1, 0], [0, 1], [-1, 0]], X = [[1, -1], [1, 1], [-1, 1], [-1, -1]], m = 0, i, v, a, b;
  for (i = 0; i < 4; i++) {
    v = wmapKAt(c + D[i][0], r + D[i][1]);
    if (v === 5 || (!node && (v === 9 || v === 10 || v === 6 || v === 7 || v === 8))) m |= 1 << i;   // 縣關只接路;路還接城 / 庭院 / 邊界(通到地圖邊)
  }
  for (i = 0; i < 4; i++) {   // 斜向:斜鄰是路 / 縣 / 關,且夾著它的兩個直鄰都不是(沒有直角相連)
    v = wmapKAt(c + X[i][0], r + X[i][1]);
    if (v !== 5 && v !== 9 && v !== 10) continue;
    a = wmapKAt(c + X[i][0], r); b = wmapKAt(c, r + X[i][1]);
    if (a === 5 || a === 9 || a === 10 || b === 5 || b === 9 || b === 10) continue;
    m |= 16 << i;
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

// ───────── 覆蓋層:我的框 / 選取框 ─────────
function wmapMkNode(cls, parent) { var d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }
function wmapUpdateOverlay(px, py) {
  var G = WMAP.G, i, gi, c, r, t, sig, el, pad = G.W, fl = [], vw = WMAP.vw, vh = WMAP.vh, N = G.size, k;
  for (k in WMAP.own) {   // 我的領地:朱紅菱形框(唯一的格線,代表產權);只放視窗內的
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
    el.style.display = ''; el.style.width = G.W + 'px'; el.style.height = G.H + 'px';
    el.style.transform = 'translate(' + Math.round(t.x - G.W / 2) + 'px,' + Math.round(t.y) + 'px)';
  }
  for (; i < WMAP.fpool.length; i++) WMAP.fpool[i].style.display = 'none';
}
function wmapPlaceSel() {
  var G = WMAP.G, N = G.size, gi = WMAP.sel, list, i, c, r, t, el;
  WMAP.selEls = WMAP.selEls || [];
  list = gi < 0 ? [] : (WMAP.WG.k[gi] === 6 ? wmCityCells(WMAP.WG) : [gi]);   // 主城 = H 形 7 格各一個框
  for (i = 0; i < list.length; i++) {
    c = list[i] % N; r = (list[i] - c) / N; t = wmapCellTop(G, c, r);
    el = WMAP.selEls[i] || (WMAP.selEls[i] = wmapMkNode('wmap-sel', WMAP.world));
    el.style.display = ''; el.style.width = G.W + 'px'; el.style.height = G.H + 'px';
    el.style.transform = 'translate(' + Math.round(t.x - G.W / 2) + 'px,' + Math.round(t.y) + 'px)';
  }
  for (; i < WMAP.selEls.length; i++) WMAP.selEls[i].style.display = 'none';
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
  if (WMAP.hud) WMAP.hud.textContent = 's=' + WMAP.G.s + ' 塊 ' + WMAP.nChunks + ' 烘 ' + WMAP.bakes + ' 節點 ' + WMAP.root.getElementsByTagName('*').length;
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
function wmapSetZoom(idx, ax, ay) {
  var i = Math.max(0, Math.min(WMAP_CFG.zooms.length - 1, idx | 0)), G0 = WMAP.G, G1;
  if (i === WMAP.zi) return;
  if (ax === undefined) { ax = WMAP.vw / 2; ay = WMAP.vh / 2; }
  G1 = wmapGeom(WMAP_CFG.zooms[i], WMAP.N);
  WMAP.cam = wmapCamClamp(G1, wmapAnchorZoom(G0, G1, WMAP.cam, WMAP.vw, WMAP.vh, ax, ay), { border: WMAP.B });
  WMAP.zi = i; WMAP.G = G1; WMAP.sc = {}; WMAP.tmp = null; WMAP.bsig = '';
  wmapClearChunks(); wmapPlaceSel();
  var p = wmapCamPxNow();
  WMAP.world.style.transform = 'translate3d(' + (-p.px) + 'px,' + (-p.py) + 'px,0)';
  wmapEnsureChunks(p.px, p.py, 99);   // 縮放後可見塊同步烘好,不閃
  wmapSchedule();
  if (WMAP.zoomEl) WMAP.zoomEl.textContent = ['遠', '中', '近'][i];
}
function wmapInvalidate() { wmapClearChunks(); WMAP.bsig = ''; WMAP.sc = {}; wmapBuildData(); wmapSchedule(); }

// ───────── 命中 / 選取 ─────────
function wmapTall(c, r) {   // 往上凸物件(領地、主城)的點擊框(世界座標)
  var G = WMAP.G, N = G.size, gi = r * N + c, bx;
  if (WMAP.res[gi]) { bx = wmapCellTop(G, c, r); return { x: bx.x - G.W * 0.28, y: bx.y - G.H * 0.6, w: G.W * 0.56, h: G.H * 1.1 }; }   // 資源格:整格菱形偏上 + 往上 0.6 格(里程碑 / 大樹的高度)
  if (WMAP.WG.k[gi] === 9 || WMAP.WG.k[gi] === 10) { bx = wmapCellTop(G, c, r); return { x: bx.x - G.W * 0.3, y: bx.y - G.H * 0.9, w: G.W * 0.6, h: G.H * 1.5 }; }   // 縣城 / 關口:單格建築(山與門樓高),取整座建築框
  if (WMAP.WG.k[gi] === 6 || WMAP.WG.k[gi] === 8) { bx = wmapPieceBox(G, WMAP.WG.cx - 1, WMAP.WG.cy - 1, 3, 3, 768, 680); return { x: bx.x + bx.w * 0.18, y: bx.y + bx.h * 0.12, w: bx.w * 0.64, h: bx.h * 0.62 }; }
  return null;
}
function wmapCellText(gi) {
  var WG = WMAP.WG, N = WG.size, c = gi % N, r = (gi - c) / N, k = WG.k[gi], info = WMAP.res[gi], s = '(' + c + ',' + r + ') ' + WMAP_KNAME[k];
  if (k === 6 || k === 8) return '(' + WG.cx + ',' + WG.cy + ') 我的主城(H 形 7 格)';
  if (k === 9 || k === 10) {
    var nd = wmNodeAt(WG, gi);
    return s + ' · 不可走不可占領' + (nd && isFinite(nd.d) ? ' · 沿道路去程 ' + wmGoMins(nd.d).toFixed(1) + ' 分' : '');
  }
  if (k !== 0) return s + (k === 1 || k === 2 || k === 3 ? ' · 不能通行' : '');
  if (info) s += ' Lv' + info.lv + ' ' + WMAP_RES[info.ty];
  else s += ' Lv' + Math.max(1, Math.min(10, wmGenRing(WG.d[gi])));
  if (!isFinite(WG.d[gi])) return s + ' · 超出行軍範圍';
  return s + ' · 去程 ' + wmGoMins(WG.d[gi]).toFixed(1) + ' 分';
}
function wmapHit(x, y) {   // x, y = 視窗內像素 → {gi, node}
  var p = wmapCamPxNow(), gi = wmapGiAt(WMAP.G, p.px + x, p.py + y, { border: WMAP.B, tall: wmapTall });
  return { gi: gi, node: gi >= 0 ? wmNodeAt(WMAP.WG, gi) : null };
}
function wmapSelect(gi) {
  if (gi >= 0 && (WMAP.WG.k[gi] === 6 || WMAP.WG.k[gi] === 8)) gi = WMAP.WG.c0;   // 主城任一格 / 庭院缺口 = 點主城
  WMAP.sel = gi;
  wmapPlaceSel();
  if (WMAP.card) { if (gi >= 0) { WMAP.card.textContent = wmapCellText(gi); WMAP.card.style.display = ''; } else WMAP.card.style.display = 'none'; }
  if (typeof WMAP.onSelect === 'function') WMAP.onSelect(gi, gi >= 0 ? wmNodeAt(WMAP.WG, gi) : null);
}
function wmapTap(x, y) {   // x, y = 視窗內像素
  var gi = wmapHit(x, y).gi;
  wmapSelect(gi === WMAP.sel ? -1 : gi);
}

// ───────── 輸入 ─────────
function wmapAdd(el, ev, fn, opt) { el.addEventListener(ev, fn, opt || false); WMAP.listeners.push([el, ev, fn, opt || false]); }
function wmapPtrDist() { var ks = Object.keys(WMAP.ptrs), a = WMAP.ptrs[ks[0]], b = WMAP.ptrs[ks[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
function wmapBindInput() {
  var vp = WMAP.vp;
  wmapAdd(vp, 'pointerdown', function (e) {
    var rc = vp.getBoundingClientRect(), n;
    if (e.target.closest && e.target.closest('.wmap-btn')) return;
    WMAP.ptrs[e.pointerId] = { x: e.clientX - rc.left, y: e.clientY - rc.top };
    try { vp.setPointerCapture(e.pointerId); } catch (er) { /* 略過 */ }
    n = Object.keys(WMAP.ptrs).length;
    if (n === 1) { var p = wmapCamPxNow(); WMAP.drag = { x0: e.clientX, y0: e.clientY, t0: performance.now(), px: p.px, py: p.py, moved: false }; }
    else if (n === 2) { WMAP.drag = null; WMAP.pinch = { d0: wmapPtrDist() }; }
    e.preventDefault();
  });
  wmapAdd(vp, 'pointermove', function (e) {
    var rc = vp.getBoundingClientRect(), d = WMAP.drag, n, dx, dy, mx, my, ks, a, b, r;
    if (!WMAP.ptrs[e.pointerId]) return;
    WMAP.ptrs[e.pointerId] = { x: e.clientX - rc.left, y: e.clientY - rc.top };
    n = Object.keys(WMAP.ptrs).length;
    if (n >= 2 && WMAP.pinch) {
      r = wmapPtrDist() / WMAP.pinch.d0; ks = Object.keys(WMAP.ptrs); a = WMAP.ptrs[ks[0]]; b = WMAP.ptrs[ks[1]];
      if (r > 1.3 || r < 0.77) { wmapSetZoom(WMAP.zi + (r > 1 ? 1 : -1), (a.x + b.x) / 2, (a.y + b.y) / 2); WMAP.pinch.d0 = wmapPtrDist(); }
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
    if (Object.keys(WMAP.ptrs).length < 2) WMAP.pinch = null;
    if (d && e.type === 'pointerup' && wmapTapOk(e.clientX - d.x0, e.clientY - d.y0, performance.now() - d.t0)) wmapTap(e.clientX - rc.left, e.clientY - rc.top);
    WMAP.drag = null;
  }
  wmapAdd(vp, 'pointerup', up); wmapAdd(vp, 'pointercancel', up);
  wmapAdd(vp, 'wheel', function (e) {
    var rc = vp.getBoundingClientRect(), t = performance.now();
    e.preventDefault();
    if (t - WMAP.wheelT < 160) return;
    WMAP.wheelT = t;
    wmapSetZoom(wmapZoomIdx(WMAP.zi, e.deltaY < 0 ? 1 : -1), e.clientX - rc.left, e.clientY - rc.top);
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
  WMAP.dpr = Math.min(2, window.devicePixelRatio || 1);
  WMAP.zi = WMAP_CFG.zoomDef; WMAP.G = wmapGeom(WMAP_CFG.zooms[WMAP.zi], WG.size);
  WMAP.dbg = /[?&]wmapdbg=1(&|$)/.test(String(window.location.search || ''));
  WMAP.chunks = {}; WMAP.nChunks = 0; WMAP.sc = {}; WMAP.pat = {}; WMAP.fpool = []; WMAP.bsig = ''; WMAP.bakes = 0; WMAP.bakeMs = 0; WMAP.ptrs = {}; WMAP.drag = null; WMAP.pinch = null; WMAP.sel = -1; WMAP.listeners = [];
  wmapBuildData();
  parent = o.parent || document.body;
  html = '<div id="wmapVp"><div id="wmapWorld"></div></div><div class="wmap-ctl"><button type="button" class="wmap-btn" data-z="1" aria-label="放大">+</button><span class="wmap-zl"></span><button type="button" class="wmap-btn" data-z="-1" aria-label="縮小">−</button>'
    + '<button type="button" class="wmap-btn wmap-home" data-z="0" aria-label="回主城">城</button></div><div class="wmap-card" style="display:none"></div>' + (WMAP.dbg ? '<div class="wmap-hud"></div>' : '');
  WMAP.root = document.createElement('div'); WMAP.root.id = 'wmapRoot'; WMAP.root.innerHTML = html; parent.appendChild(WMAP.root);
  WMAP.vp = WMAP.root.querySelector('#wmapVp'); WMAP.world = WMAP.root.querySelector('#wmapWorld'); WMAP.card = WMAP.root.querySelector('.wmap-card'); WMAP.hud = WMAP.root.querySelector('.wmap-hud'); WMAP.zoomEl = WMAP.root.querySelector('.wmap-zl');
  WMAP.zoomEl.textContent = ['遠', '中', '近'][WMAP.zi];
  WMAP.selEls = [];
  WMAP.root.querySelector('.wmap-ctl').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.wmap-btn') : null, z;
    if (!b) return;
    z = parseInt(b.getAttribute('data-z'), 10);
    if (z === 0) wmapSetCam(WG.cx + 0.5, WG.cy + 0.5); else wmapSetZoom(wmapZoomIdx(WMAP.zi, z));
  });
  WMAP.on = true;
  WMAP.vw = WMAP.vp.clientWidth || window.innerWidth; WMAP.vh = WMAP.vp.clientHeight || window.innerHeight;
  WMAP.cam = wmapCamClamp(WMAP.G, { u: WG.cx + 0.5, v: WG.cy + 0.5 }, { border: WMAP.B });
  wmapBindInput();
  var p = wmapCamPxNow();
  WMAP.world.style.transform = 'translate3d(' + (-p.px) + 'px,' + (-p.py) + 'px,0)';
  wmapEnsureChunks(p.px, p.py, 99);
  wmapUpdateOverlay(p.px, p.py);
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
