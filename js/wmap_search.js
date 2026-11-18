// js/wmap_search.js — 搜尋標記(使用者 2026-11-18;設計_領地等級分佈與搜尋標記_規格.md 第 4 節;gv 6)。
// 做什麼:左下〔地圖〕〔回歸城池〕旁第三顆〔搜尋〕→ 滿版搜尋頁(等級 Lv1~10 多選 × 種類 全部 / 農田 / 礦坑 / 獵場 / 林場 / 採石場 / 空地 / 野怪;預設只找無主格)→ 地圖上符合的格畫「粗的紅白相間虛線、不填底色、整層緩慢明滅」的框;
//   已占領維持現行細朱紅實線 + 淡紅底(wmap_view 的 .wmap-own),兩者同格都看得到;標示中左下出現小膠囊「Lv5 農田 37 處 ‹ › ✕」;全螢幕地圖同步標示。
// 結構:① 核心(純函式,node 可測;不碰 DOM / 存檔 / 時間)wmapSearchRun / Label / Order / Next / Norm;② 地圖標示層(wmapSearchSet / wmapUpdateFind,wmap_view 在 wmapUpdateOverlay 之後呼叫,只為畫面內的格建節點);
//   ③ 搜尋頁 + 膠囊 + 全地圖疊圖(wmsearch*;wmap_home.js 的左下第三顆鈕呼叫 wmsearchOpen、wmfullBuild 尾端呼叫 wmsearchFullDraw)。標示狀態不進存檔;搜尋條件記在 localStorage['lorddomain.wmfind.v1'](只為方便,try / catch)。
// ES2017,不用 ?. ??;UTF-8 + CRLF。全域名一律 wmapSearch* / WMSEARCH* / wmsearch* / wmapUpdateFind。載入順序:wmap_mob.js 之後、wmap_home.js 之前(wmap_view.js 之後)。
//
// ───────── 公開 API(核心)─────────
//   WMSEARCH_TY = ['farm','mine','hunt','lumber','quarry','empty','mob'];WMSEARCH_NAME 顯示名;WMSEARCH_CFG {key, maxList 30, maxNodes 400, tickMs, label 14}
//   wmapSearchNorm(q) → {lv:[1..10 升冪], ty:[…], own:bool}   正規化(lv 空 = 全部等級;ty 空 = 五種資源;壞資料退預設)
//   wmapSearchRun(WG, W, q, now, o?) → {gis:[…依去程成本升冪、不重複], items:[{gi, kind:'res'|'empty'|'mob', ty, lv, cost}], n, n10(去程 ≤ 10 分的數量), label, q}
//        資源格 = WG.rt / rl;空地 = k 0 且非城池占地 / 城郊 / 席位保留圈 / 資源格(等級條件不適用);野怪 = wmapMobAlive(W, now, WG)(本批存活;等級照野怪 Lv);
//        預設只找無主:已被占(W.pts 裡 'w…' 有 owner、W.g2.em 空地占領)的格排除;q.own = true 才把「我的」領地 / 空地算進來(他人領地永遠排除);o.occ = {gi: owner} 可覆寫占領表(測試用)
//   wmapSearchLabel(q, n) → 'Lv5 農田 37 處';多選縮寫 'Lv4·Lv5 農田+礦坑 82 處',前段超過 14 字截斷加「…」
//   wmapSearchOrder(WG, gis, gi0) → gis 依離 gi0 的六邊形距離由近到遠;wmapSearchNext(order, cur, dir) → gi(cur 不在清單 = 從頭 / 從尾;循環)
//   wmapSearchLoad() / wmapSearchSave(q)   條件存取(localStorage,讀不到用預設 {lv:[5], ty:[], own:false})
// ───────── 地圖標示層 ─────────
//   wmapSearchSet(q | null, W?) → run 結果 | null   設定 / 清除標示(重算並排程重畫、開 / 關定時重算);WMAP.find = {q, gis, set, n, n10, label, rev, tm}
//   wmapUpdateFind(px, py)                 畫面內的格建節點(節點池 WMAP.fnode,上限 maxNodes,簽名沒變不動 DOM);所有節點放單一容器 .wmap-findL(明滅只動它)
//   WMAP_FIND_URI                          行內 SVG(外圈白底實線 + 紅虛線,不填色,往內縮 12%)
// ───────── UI ─────────
//   wmsearchOpen() / wmsearchClear() / wmsearchPill() / wmsearchFullDraw(g, N, px)

var WMSEARCH_TY = ['farm', 'mine', 'hunt', 'lumber', 'quarry', 'empty', 'mob'];
var WMSEARCH_NAME = { farm: '農田', mine: '礦坑', hunt: '獵場', lumber: '林場', quarry: '採石場', empty: '空地', mob: '野怪' };
var WMSEARCH_OUT = { farm: '糧', mine: '生鐵', hunt: '獸皮', lumber: '木炭', quarry: '礪石' };
var WMSEARCH_CFG = { key: 'lorddomain.wmfind.v1', maxList: 30, maxNodes: 400, tickMs: 2500, label: 14 };
var WMSEARCH = { q: null, page: null, pill: null, list: null, order: null, cur: -1 };

// ───────── 核心 ─────────
function wmapSearchNorm(q) {
  var o = { lv: [], ty: [], own: false }, seen = {}, i, v;
  if (q && typeof q === 'object') {
    if (Array.isArray(q.lv)) for (i = 0; i < q.lv.length; i++) { v = Math.floor(Number(q.lv[i])); if (v >= 1 && v <= 10 && !seen[v]) { seen[v] = 1; o.lv.push(v); } }
    o.lv.sort(function (a, b) { return a - b; });
    seen = {};
    if (Array.isArray(q.ty)) for (i = 0; i < q.ty.length; i++) { v = q.ty[i]; if (WMSEARCH_TY.indexOf(v) >= 0 && !seen[v]) { seen[v] = 1; o.ty.push(v); } }
    o.ty.sort(function (a, b) { return WMSEARCH_TY.indexOf(a) - WMSEARCH_TY.indexOf(b); });
    o.own = !!q.own;
  }
  return o;
}
function wmapSearchOcc(WG, W) {   // 已被占的格:{gi: owner}(資源領地 pt owner、空地占領 = 'me')
  var occ = {}, i, p, k, em;
  if (W && W.pts) for (i = 0; i < W.pts.length; i++) { p = W.pts[i]; if (p && typeof p.id === 'string' && p.cat === 'res' && p.owner && /^w\d+$/.test(p.id)) occ[+p.id.slice(1)] = p.owner; }
  em = W && W.g2 && W.g2.em ? W.g2.em : null;
  if (em) for (k in em) occ[+k] = 'me';
  return occ;
}
function wmapSearchCost(WG, gi) {
  var d = WG.d0 ? WG.d0[gi] : WG.d[gi];
  return isFinite(d) ? d : (WG.d && isFinite(WG.d[gi]) ? WG.d[gi] : Infinity);
}
function wmapSearchRun(WG, W, q, now, o) {
  var N = WG.size, n = N * N, k = WG.k, rt = WG.rt, rl = WG.rl, zone = WG.zone, occ, lvOn = {}, resOn = [false, false, false, false, false], wantEmpty, wantMob, anyRes = false, items = [], seen = {}, mobs, i, t, v, cost, ow, gis, n10 = 0, reach, mine;
  q = wmapSearchNorm(q);
  o = o || {};
  occ = o.occ || wmapSearchOcc(WG, W);
  mine = function (gi) { ow = occ[gi]; return !ow || (q.own && ow === 'me'); };   // 預設只找無主;含我的 = 把 me 算進來(他人永遠排除)
  if (!q.lv.length) for (i = 1; i <= 10; i++) lvOn[i] = 1; else for (i = 0; i < q.lv.length; i++) lvOn[q.lv[i]] = 1;
  for (i = 0; i < 5; i++) if (q.ty.indexOf(WMSEARCH_TY[i]) >= 0) { resOn[i] = true; anyRes = true; }
  wantEmpty = q.ty.indexOf('empty') >= 0; wantMob = q.ty.indexOf('mob') >= 0;
  if (!anyRes && !wantEmpty && !wantMob) for (i = 0; i < 5; i++) resOn[i] = true;   // 沒選種類 = 五種資源
  for (i = 0; i < n; i++) {
    t = rt ? rt[i] : -1;
    if (t >= 0) {
      if (!resOn[t] || !lvOn[rl[i]] || !mine(i)) continue;
      items.push({ gi: i, kind: 'res', ty: WMSEARCH_TY[t], lv: rl[i], cost: wmapSearchCost(WG, i) });
    } else if (wantEmpty && k[i] === 0 && !(zone && zone[i]) && mine(i)) {
      items.push({ gi: i, kind: 'empty', ty: 'empty', lv: 0, cost: wmapSearchCost(WG, i) });
    }
  }
  if (wantMob && typeof wmapMobAlive === 'function' && W) {
    try { mobs = wmapMobAlive(W, now, WG); } catch (e) { mobs = []; }
    for (i = 0; i < mobs.length; i++) if (lvOn[mobs[i].lv]) items.push({ gi: mobs[i].gi, kind: 'mob', ty: 'mob', lv: mobs[i].lv, cost: wmapSearchCost(WG, mobs[i].gi), name: mobs[i].ty });
  }
  items.sort(function (a, b) { return a.cost - b.cost || a.gi - b.gi || (a.kind < b.kind ? -1 : 1); });
  gis = [];
  reach = typeof WMG_CFG !== 'undefined' ? WMG_CFG.reach : 24;
  for (i = 0; i < items.length; i++) {
    if (seen[items[i].gi]) continue;
    seen[items[i].gi] = 1; gis.push(items[i].gi);
    cost = items[i].cost;
    if (typeof wmGoMins === 'function' ? (isFinite(cost) && wmGoMins(cost, 1) <= 10) : cost <= reach) n10++;
  }
  return { gis: gis, items: items, n: gis.length, n10: n10, label: wmapSearchLabel(q, gis.length), q: q };
}
function wmapSearchLabel(q, n) {
  var lv, ty, head, i, only, names = [], lvTxt = '', tyTxt;
  q = wmapSearchNorm(q);
  only = q.ty.length === 1 && q.ty[0] === 'empty';   // 空地不分等級:標題不寫 Lv
  lv = q.lv.length ? q.lv : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  if (!only) lvTxt = lv.length === 10 ? 'Lv1~10' : 'Lv' + lv.join('·Lv');
  ty = q.ty.length ? q.ty : null;
  if (!ty || (ty.length === 5 && ty.every(function (x, j) { return j === WMSEARCH_TY.indexOf(x); }))) tyTxt = '資源';
  else { for (i = 0; i < ty.length; i++) names.push(WMSEARCH_NAME[ty[i]]); tyTxt = names.join('+'); }
  head = (lvTxt ? lvTxt + ' ' : '') + tyTxt;
  if (head.length > WMSEARCH_CFG.label) head = head.slice(0, WMSEARCH_CFG.label - 1) + '…';
  return head + ' ' + n + ' 處';
}
function wmapSearchOrder(WG, gis, gi0) {
  var N = WG.size, a = gis.slice(), d = {}, i;
  for (i = 0; i < a.length; i++) d[a[i]] = wmHexDistGi(a[i], gi0, N);
  a.sort(function (x, y) { return d[x] - d[y] || x - y; });
  return a;
}
function wmapSearchNext(order, cur, dir) {
  var i = order.indexOf(cur), n = order.length;
  if (!n) return -1;
  if (i < 0) return dir < 0 ? order[n - 1] : order[0];
  return order[(i + (dir < 0 ? -1 : 1) + n) % n];
}
function wmapSearchLoad() {
  var raw = null, q = null;
  try { raw = typeof localStorage !== 'undefined' ? localStorage.getItem(WMSEARCH_CFG.key) : null; if (raw) q = JSON.parse(raw); } catch (e) { q = null; }
  q = wmapSearchNorm(q);
  if (!raw || !q.lv.length) q.lv = q.lv.length ? q.lv : [5];
  return q;
}
function wmapSearchSave(q) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(WMSEARCH_CFG.key, JSON.stringify(wmapSearchNorm(q))); return true; } catch (e) { return false; }
}

// ───────── 地圖標示層 ─────────
// 外圈白底實線(寬 7)+ 內圈紅虛線(寬 7、9 6 交替,像警示帶)、無底色;往內縮 12%(與占領的細朱紅框同格時兩條都看得到);容器明滅(.wmap-findL,css/wmap_search.css)
var WMAP_FIND_URI = typeof encodeURIComponent === 'function' ? "url(\"data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 56.25' preserveAspectRatio='none'><path d='M9 28.1 29.8 5.6 70.2 5.6 91 28.1 70.2 50.6 29.8 50.6Z' fill='none' stroke='#fff' stroke-width='7' stroke-linejoin='round'/><path d='M9 28.1 29.8 5.6 70.2 5.6 91 28.1 70.2 50.6 29.8 50.6Z' fill='none' stroke='#ff2b2b' stroke-width='7' stroke-dasharray='9 6' stroke-linejoin='round'/></svg>") + "\")" : '';
function wmapSearchCtxW() { var c = null; try { c = typeof wmapGoUiCtx === 'function' ? wmapGoUiCtx() : null; } catch (e) { c = null; } return c ? c.W : null; }
function wmapSearchNow() { return typeof ldNow === 'function' ? ldNow() : Date.now(); }
function wmapSearchSet(q, W) {
  var F, r;
  if (typeof WMAP === 'undefined' || !WMAP.WG) return null;
  if (WMAP.find && WMAP.find.tm) { clearInterval(WMAP.find.tm); }
  if (!q) { WMAP.find = null; WMAP.fdraw = ''; wmsearchRefresh(); if (typeof wmapSchedule === 'function') wmapSchedule(); return null; }
  r = wmapSearchRun(WMAP.WG, W || wmapSearchCtxW(), q, wmapSearchNow());
  F = { q: r.q, gis: r.gis, set: {}, n: r.n, n10: r.n10, label: r.label, rev: ((WMAP.find && WMAP.find.rev) | 0) + 1, tm: 0 };
  r.gis.forEach(function (g) { F.set[g] = 1; });
  WMAP.find = F; WMAP.fdraw = '';
  if (typeof setInterval === 'function') F.tm = setInterval(wmapSearchTick, WMSEARCH_CFG.tickMs);
  wmsearchRefresh();
  if (typeof wmapSchedule === 'function') wmapSchedule();
  return r;
}
function wmapSearchTick() {   // 定時重算(占領 / 被打下 / 野怪換批):變了才換簽名並重畫
  var F = WMAP.find, r, same;
  if (!F || !WMAP.WG || !WMAP.on) return;
  r = wmapSearchRun(WMAP.WG, wmapSearchCtxW(), F.q, wmapSearchNow());
  same = r.n === F.n && r.n10 === F.n10 && r.gis.length === F.gis.length && r.gis.every(function (g, i) { return g === F.gis[i]; });
  if (same) return;
  F.gis = r.gis; F.n = r.n; F.n10 = r.n10; F.label = r.label; F.set = {}; r.gis.forEach(function (g) { F.set[g] = 1; }); F.rev++; WMAP.fdraw = '';
  wmsearchRefresh();
  if (typeof wmapSchedule === 'function') wmapSchedule();
}
function wmapUpdateFind(px, py) {
  var F = WMAP.find, G = WMAP.G, N, i, gi, c, r, t, pad, vis = [], sig, el, L, W = WMAP.world, vw = WMAP.vw, vh = WMAP.vh, mx, my;
  if (!W || !G) return;
  L = WMAP.fcon;
  if (!F || !F.gis || !F.gis.length) { if (L) L.style.display = 'none'; WMAP.fdraw = ''; return; }
  if (!L || L.parentNode !== W) { L = WMAP.fcon = document.createElement('div'); L.className = 'wmap-findL'; WMAP.fnode = []; W.appendChild(L); }
  else if (W.lastChild !== L) W.appendChild(L);   // 永遠排在占領框(.wmap-own)之後:同層 z-index 下蓋在占領框上、選取框(z-index 2)之下
  L.style.display = '';
  N = G.size; pad = G.W;
  for (i = 0; i < F.gis.length; i++) {
    gi = F.gis[i]; c = gi % N; r = (gi - c) / N; t = wmapCellTop(G, c, r);
    if (t.x + G.W / 2 < px - pad || t.x - G.W / 2 > px + vw + pad || t.y + G.H < py - pad || t.y > py + vh + pad) continue;
    vis.push(gi);
  }
  if (vis.length > WMSEARCH_CFG.maxNodes) {   // 上限:只畫離畫面中心最近的(實際不會發生)
    mx = px + vw / 2; my = py + vh / 2;
    vis.sort(function (a, b) { var ca = a % N, cb = b % N, ta = wmapCellTop(G, ca, (a - ca) / N), tb = wmapCellTop(G, cb, (b - cb) / N); return Math.abs(ta.x - mx) + Math.abs(ta.y - my) - Math.abs(tb.x - mx) - Math.abs(tb.y - my); });
    vis.length = WMSEARCH_CFG.maxNodes;
  }
  sig = G.s + ':' + F.rev + ':' + vis.join(',');
  if (sig === WMAP.fdraw) return;
  WMAP.fdraw = sig;
  for (i = 0; i < vis.length; i++) {
    gi = vis[i]; c = gi % N; r = (gi - c) / N; t = wmapCellTop(G, c, r);
    el = WMAP.fnode[i] || (WMAP.fnode[i] = wmapMkNode('wmap-find', L));
    el.style.display = ''; el.style.width = G.W + 'px'; el.style.height = G.H + 'px'; el.style.backgroundImage = WMAP_FIND_URI;
    el.style.transform = 'translate(' + Math.round(t.x - G.W / 2) + 'px,' + Math.round(t.y) + 'px)';
  }
  for (; i < WMAP.fnode.length; i++) WMAP.fnode[i].style.display = 'none';
}
function wmapSearchStats() { var F = typeof WMAP !== 'undefined' ? WMAP.find : null; return { on: !!F, n: F ? F.n : 0, n10: F ? F.n10 : 0, nodes: typeof WMAP !== 'undefined' && WMAP.fnode ? WMAP.fnode.filter(function (e) { return e.style.display !== 'none'; }).length : 0 }; }

// ───────── UI:搜尋頁 / 膠囊 / 全地圖疊圖 ─────────
function wmsearchEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
function wmsearchIcon() {   // 左下第三顆鈕的自繪圖示(放大鏡,同〔地圖〕〔回歸城池〕的 32×32 SVG 樣式)
  return '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><circle cx="13" cy="13" r="8" fill="#fff3cf" stroke="#3b2410" stroke-width="2.4"/><path d="M8.5 10.5a5.4 5.4 0 0 1 4.2-2.6" fill="none" stroke="#d03a22" stroke-width="2" stroke-linecap="round"/><path d="M19.2 19.2 27 27" stroke="#3b2410" stroke-width="4" stroke-linecap="round"/><path d="M19.2 19.2 27 27" stroke="#d03a22" stroke-width="1.4" stroke-linecap="round"/></svg>';
}
function wmsearchOpen() { return typeof ldNavPush === 'function' ? ldNavPush('wmfind') : false; }
function wmsearchClear() { wmapSearchSet(null); WMSEARCH.order = null; WMSEARCH.cur = -1; }
function wmsearchCamGi() {   // 畫面中心所在格
  var WG = WMAP.WG, c, r, h;
  if (!WG || !WMAP.cam) return WG ? WG.c0 : -1;
  h = typeof wmHexRound === 'function' ? wmHexRound(WMAP.cam.u - 0.5, WMAP.cam.v - 0.5) : { c: Math.round(WMAP.cam.u - 0.5), r: Math.round(WMAP.cam.v - 0.5) };
  c = Math.max(0, Math.min(WG.size - 1, h.c)); r = Math.max(0, Math.min(WG.size - 1, h.r));
  return r * WG.size + c;
}
function wmsearchGoto(gi, select) {
  var N = WMAP.WG.size, c = gi % N, r = (gi - c) / N;
  if (typeof wmapSetCam === 'function') wmapSetCam(c + 0.5, r + 0.5);
  if (select && typeof wmapSelect === 'function') { try { wmapSelect(gi); } catch (e) { /* 資訊卡失敗不影響跳轉 */ } }
}
function wmsearchJump(dir) {
  var F = WMAP.find;
  if (!F || !F.gis.length) return -1;
  if (!WMSEARCH.order || WMSEARCH.rev !== F.rev) { WMSEARCH.order = wmapSearchOrder(WMAP.WG, F.gis, wmsearchCamGi()); WMSEARCH.rev = F.rev; WMSEARCH.cur = -1; }
  WMSEARCH.cur = wmapSearchNext(WMSEARCH.order, WMSEARCH.cur, dir);
  wmsearchGoto(WMSEARCH.cur, true);
  return WMSEARCH.cur;
}
function wmsearchPill() {   // 標示中才存在(不是固定說明欄);文字隨計數更新
  var F = typeof WMAP !== 'undefined' ? WMAP.find : null, P = WMSEARCH.pill, root = typeof WMAP !== 'undefined' ? WMAP.root : null;
  if (!F || !root) { if (P && P.parentNode) P.parentNode.removeChild(P); WMSEARCH.pill = null; return null; }
  if (!P || P.parentNode !== root) {
    P = WMSEARCH.pill = wmsearchEl('div', 'wmsr-pill');
    P.innerHTML = '<button type="button" class="wmsr-pt" aria-label="回搜尋頁"></button><button type="button" class="wmsr-pb" data-d="-1" aria-label="上一處">‹</button><button type="button" class="wmsr-pb" data-d="1" aria-label="下一處">›</button><button type="button" class="wmsr-pb wmsr-px" data-d="0" aria-label="清除標示">✕</button>';
    P.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    P.addEventListener('click', function (ev) {
      var t = ev.target, d;
      if (t && t.classList && t.classList.contains('wmsr-pt')) { wmsearchOpen(); return; }
      d = t && t.getAttribute ? t.getAttribute('data-d') : null;
      if (d === null) return;
      if (d === '0') wmsearchClear(); else wmsearchJump(+d);
    });
    root.appendChild(P);
  }
  P.firstChild.textContent = F.label;
  return P;
}
function wmsearchRefresh() { var d = wmsearchPill(); if (WMSEARCH.page && WMSEARCH.page.__draw) WMSEARCH.page.__draw(); return d; }
function wmsearchFullDraw(g, N, px) {   // 全螢幕地圖:同條件的格畫紅色小六邊形外框(線寬 2、不填色);條件沒開就什麼都不畫
  var F = typeof WMAP !== 'undefined' ? WMAP.find : null, i, p, r = 4.2, j, a;
  if (!F || !g || typeof wmapPnlMiniXY !== 'function') return 0;
  g.save(); g.lineWidth = 2; g.strokeStyle = '#ff2b2b';
  for (i = 0; i < F.gis.length; i++) {
    p = wmapPnlMiniXY(F.gis[i], N, px);
    g.beginPath();
    for (j = 0; j < 6; j++) { a = Math.PI / 3 * j; g.lineTo(p.x + Math.cos(a) * r * 1.2, p.y + Math.sin(a) * r * 0.75); }
    g.closePath(); g.stroke();
  }
  g.restore();
  return F.gis.length;
}
function wmsearchPageBuild(el) {
  var q = wmapSearchLoad(), page = el, lvBox, tyBox, cnt, list, goBtn, clrBtn, own1, own2, W, run = null;
  WMSEARCH.page = page;
  page.innerHTML = '';
  page.className = (page.className ? page.className + ' ' : '') + 'wmsr-page';
  function head(t) { return wmsearchEl('div', 'wmsr-h', t); }
  function chip(t, on, fn, cls) { var b = wmsearchEl('button', 'wmsr-c' + (cls ? ' ' + cls : '') + (on ? ' on' : ''), t); b.setAttribute('type', 'button'); b.addEventListener('click', fn); return b; }
  function pos(gi) { var N = WMAP.WG.size, c = gi % N; return '(' + c + ', ' + ((gi - c) / N) + ')'; }
  function itemName(it) { return it.kind === 'res' ? 'Lv' + it.lv + ' ' + WMSEARCH_NAME[it.ty] : (it.kind === 'mob' ? 'Lv' + it.lv + ' 野怪' : '空地'); }
  function mins(cost) { return isFinite(cost) ? (typeof wmGoMins === 'function' ? wmGoMins(cost, 1) : cost) : 0; }
  function save() { wmapSearchSave(q); }
  function draw() {
    var i, rows, it, row, b, lvs = q.lv.length ? q.lv : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], nEmpty, anyTy = q.ty.length > 0, only;
    if (!WMAP.WG) return;
    W = wmapSearchCtxW();
    run = wmapSearchRun(WMAP.WG, W, q, wmapSearchNow());
    lvBox.innerHTML = '';
    lvBox.appendChild(chip('全部', q.lv.length === 10, function () { q.lv = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; save(); draw(); }, 'wmsr-ca'));
    lvBox.appendChild(chip('清空', false, function () { q.lv = []; save(); draw(); }, 'wmsr-ca'));
    for (i = 1; i <= 10; i++) lvBox.appendChild((function (L) { return chip('Lv' + L, q.lv.indexOf(L) >= 0, function () { var j = q.lv.indexOf(L); if (j >= 0) q.lv.splice(j, 1); else q.lv.push(L); q.lv.sort(function (a, b2) { return a - b2; }); save(); draw(); }); })(i));
    only = q.ty.length === 1 && q.ty[0] === 'empty';
    lvBox.parentNode.classList.toggle('dim', only);
    lvBox.parentNode.firstChild.textContent = only ? '等級(空地不分等級)' : '等級(可多選)';
    tyBox.innerHTML = '';
    tyBox.appendChild(chip('全部', !anyTy, function () { q.ty = []; save(); draw(); }, 'wmsr-ca'));
    WMSEARCH_TY.forEach(function (t) {
      var lab = WMSEARCH_NAME[t] + (WMSEARCH_OUT[t] ? '(' + WMSEARCH_OUT[t] + ')' : '');
      tyBox.appendChild(chip(lab, q.ty.indexOf(t) >= 0, function () { var j = q.ty.indexOf(t); if (j >= 0) q.ty.splice(j, 1); else q.ty.push(t); q = wmapSearchNorm(q); save(); draw(); }));
    });
    own1.classList.toggle('on', !q.own); own2.classList.toggle('on', q.own);
    cnt.textContent = '符合 ' + run.n + ' 處(10 分鐘內 ' + run.n10 + ' 處)';
    list.innerHTML = '';
    rows = run.items.filter(function (x, idx) { return idx === run.items.findIndex(function (y) { return y.gi === x.gi; }); }).slice(0, WMSEARCH_CFG.maxList);
    if (!rows.length) list.appendChild(wmsearchEl('div', 'wmsr-empty', '沒有符合的地點'));
    rows.forEach(function (x) {
      row = wmsearchEl('div', 'wmsr-r');
      row.appendChild(wmsearchEl('span', 'wmsr-rt', itemName(x) + ' · 去程 ' + mins(x.cost).toFixed(1) + ' 分 · ' + pos(x.gi)));
      b = wmsearchEl('button', 'wmsr-go', '移至'); b.setAttribute('type', 'button');
      b.addEventListener('click', function () { var g = x.gi; if (typeof ldNavBack === 'function') ldNavBack(); wmsearchGoto(g, false); });
      row.appendChild(b); list.appendChild(row);
    });
    goBtn.disabled = run.n === 0; goBtn.classList.toggle('off', run.n === 0);
    clrBtn.hidden = !WMAP.find;
  }
  function sec(title) { var s = wmsearchEl('div', 'wmsr-s'); s.appendChild(head(title)); return s; }
  var s1 = sec('等級(可多選)'), s2 = sec('種類(可多選;全部 = 五種資源)'), s3 = sec('範圍'), foot = wmsearchEl('div', 'wmsr-foot');
  lvBox = wmsearchEl('div', 'wmsr-cs'); s1.appendChild(lvBox);
  tyBox = wmsearchEl('div', 'wmsr-cs'); s2.appendChild(tyBox);
  own1 = chip('只找無主', true, function () { q.own = false; save(); draw(); });
  own2 = chip('含我的領地', false, function () { q.own = true; save(); draw(); });
  var cs3 = wmsearchEl('div', 'wmsr-cs'); cs3.appendChild(own1); cs3.appendChild(own2); s3.appendChild(cs3);
  cnt = wmsearchEl('div', 'wmsr-cnt');
  list = wmsearchEl('div', 'wmsr-list');
  goBtn = wmsearchEl('button', 'wmsr-do', '在地圖上標示'); goBtn.setAttribute('type', 'button');
  goBtn.addEventListener('click', function () {
    var r;
    if (!run || run.n === 0) return;
    save(); r = wmapSearchSet(q, W);
    if (r && typeof ldNavBack === 'function') ldNavBack();
  });
  clrBtn = wmsearchEl('button', 'wmsr-clr', '清除標示'); clrBtn.setAttribute('type', 'button');
  clrBtn.addEventListener('click', function () { wmsearchClear(); draw(); });
  foot.appendChild(clrBtn); foot.appendChild(goBtn);
  page.appendChild(s1); page.appendChild(s2); page.appendChild(s3); page.appendChild(cnt); page.appendChild(list); page.appendChild(foot);
  page.__draw = draw;
  draw();
}
if (typeof ldNavRegister === 'function') {
  ldNavRegister({ id: 'wmfind', title: '搜尋', build: function (el) { wmsearchPageBuild(el); }, onShow: function (el) { if (el && el.__draw) el.__draw(); }, onHide: function () { WMSEARCH.page = null; }, noClose: true });
}
