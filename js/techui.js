// js/techui.js — 科技樹頁(PLAN_NOLEVEL NL2):每分支一棵由左到右的樹(欄 = 前置鏈深度,SVG 連線)、點選節點看詳情 / 研發 / 研發到這裡、研發序列、研究院狀態;並提供「需研發〈X〉」鎖頭文案。
// 全域名稱:techPanelOpen(nodeId?) techPanelClose techPanelToggle techPanelIsOpen techUiHtml techUiAct techUiState techUiUnlockNames
//          techUiLayout techUiAncestors techUiSuccessors techUiHighlight techUiFirstReady techUiEraText techObjLockText techFeatLockText techFeatLockGo techLockedNames techCancelHint
// 依賴(皆 typeof 守衛):citytech.js、techtree_data.js、nolevel_data.js、panelmgr.js、goods.js。ES2017;不用 ?. ??。
var tu = { el: null, open: false, branch: 'ag', focus: '', sel: '', zoom: 1, confirm: '', sig: '', qSig: '', treeKey: '', builds: 0, last: {}, dragged: 0, timer: 0, msg: '', bodyEl: null, headEl: null, topEl: null, resEl: null, warnEl: null, qEl: null, tabsEl: null, eraEl: null, scEl: null, cvEl: null, detEl: null, lsZoom: 0, stripEl: null, sResEl: null, sCurEl: null, qOpen: false, sug: 1, sugSet: {}, sugWhy: {} };
var TU_STATE_TXT = { done: '已研', cur: '研發中', queued: '排隊中', ready: '可研', req: '前置未滿', era: '本時代未開', mega: '里程碑' };

function tuEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function tuToast(t) { if (typeof showToast === 'function') showToast(t); }
function tuEraName(e) { var r = (typeof NL_ERA_RULE !== 'undefined' && NL_ERA_RULE) ? NL_ERA_RULE[e] : null; return r && r.name ? r.name : ''; }
function tuNodeName(id) { var n = typeof techNode === 'function' ? techNode(id) : null; return n ? n.name : id; }

// ───────── 狀態 ─────────
// 回傳 { k: done|cur|queued|ready|req|era|mega, miss: [未滿足前置名] }
function techUiState(id) {
  var n = techNode(id), s = techState(), miss = [];
  if (!n) return { k: 'req', miss: [] };
  if (s.done[id]) return { k: 'done', miss: miss };
  if (techIsMega(n)) return { k: 'mega', miss: miss };
  if (s.cur.some(function (c) { return c.id === id; })) return { k: 'cur', miss: miss };
  if (s.queue.indexOf(id) >= 0) return { k: 'queued', miss: miss };
  if (!techReqMet(n)) {
    n.req.forEach(function (r) { if (!techDone(r)) miss.push(tuNodeName(r)); });
    return { k: 'req', miss: miss };
  }
  if (!techEraOpen(n.era)) return { k: 'era', miss: miss };
  return { k: 'ready', miss: miss };
}

// 解鎖內容中文名(NL_UNLOCK_NAMES → 物件名 → 原 id)
function techUiUnlockNames(n) {
  var out = [];
  (n.unlock || []).forEach(function (u) {
    var nm = (typeof NL_UNLOCK_NAMES !== 'undefined' && NL_UNLOCK_NAMES[u]) || (typeof OBJECTS !== 'undefined' && OBJECTS[u] && OBJECTS[u].name) || (typeof NL_NEW_OBJECTS !== 'undefined' && NL_NEW_OBJECTS[u] && NL_NEW_OBJECTS[u].name) || u;
    if (out.indexOf(nm) < 0) out.push(nm);
  });
  return out;
}
function tuCostText(id) {
  var c = techCostOf(id), p = [];
  if (!c) return '';
  p.push('金 ' + c.coin);
  if (c.xue) p.push('學識 ' + c.xue);
  if (c.goods && c.goods.n > 0) p.push('第' + (c.goods.tier + 1) + '階貨品 ×' + c.goods.n);
  return p.join('　');
}
function tuDurText(sec) { var m = Math.max(1, Math.round(sec / 60)); return m + ' 分'; }

// ───────── 鎖頭文案 ─────────
function techNodeOfObj(type) { var id = typeof nlObjTech === 'function' ? nlObjTech(type) : undefined; return (id && id !== 'start' && techNode(id)) ? id : ''; }
// 物件未開放文案:「需研發〈科技名〉(第 N 時代)」;無對應節點回 ''
function techObjLockText(type) {
  var id = techNodeOfObj(type), n;
  if (!id) return '';
  n = techNode(id);
  return '需研發〈' + n.name + '〉(第 ' + n.era + ' 時代)';
}
function techFeatLockText(fid, name) {
  var g = (typeof NL_FEATURE_GATE !== 'undefined' && NL_FEATURE_GATE) ? NL_FEATURE_GATE[fid] : null;
  if (g && g.type === 'node' && techNode(g.need)) return '需研發〈' + tuNodeName(g.need) + '〉才開放' + name;
  if (g && g.type === 'bld' && typeof OBJECTS !== 'undefined' && OBJECTS[g.need]) return '需先建造' + OBJECTS[g.need].name + '才開放' + name;
  return '尚未開放' + name;
}
function techFeatLockGo(fid) {
  var g = (typeof NL_FEATURE_GATE !== 'undefined' && NL_FEATURE_GATE) ? NL_FEATURE_GATE[fid] : null;
  if (g && g.type === 'node' && techNode(g.need)) techPanelOpen(g.need);
}
// 建造選單鎖頭提示:items [{name,id|combo}] → 未開放者;{ names, techName, nodeId };全開放回 null
function techLockedNames(items) {
  var names = [], nodes = [], i, j, id, ids, best = null, bn;
  for (i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.combo) {
      if (typeof comboUnlocked !== 'function' || comboUnlocked(it.combo)) continue;
      ids = typeof comboUnlockNodes === 'function' ? comboUnlockNodes(it.combo).filter(function (x) { return !techDone(x); }) : [];
    } else {
      if (typeof isUnlocked !== 'function' || isUnlocked('estate', it.id)) continue;
      id = techNodeOfObj(it.id);
      ids = id ? [id] : [];
    }
    names.push(it.name);
    for (j = 0; j < ids.length; j++) nodes.push(ids[j]);
  }
  if (!names.length) return null;
  nodes.forEach(function (x) {   // 最近可研:前置已滿者優先,其次時代最低
    var n = techNode(x), st = techUiState(x), rank = (st.k === 'ready' || st.k === 'queued' || st.k === 'cur' ? 0 : 10) + n.era;
    if (!best || rank < best.rank) best = { id: x, rank: rank };
  });
  bn = best ? techNode(best.id) : null;
  return { lv: 0, names: names, techName: bn ? bn.name : '', nodeId: best ? best.id : '' };
}

// ───────── 取消與退款提示 ─────────
function techCancelHint(id) {
  var s = techState(), i, c, p = [];
  for (i = 0; i < s.cur.length; i++) if (s.cur[i].id === id) {
    c = s.cur[i].paid || {};
    if (c.coin) p.push('金 ' + c.coin);
    if (c.xue) p.push('學識 ' + c.xue);
    Object.keys(c.goods || {}).forEach(function (g) { p.push(((typeof GOODS !== 'undefined' && GOODS[g] && GOODS[g].name) || g) + ' ×' + c.goods[g]); });
    return '取消將全額退還:' + (p.length ? p.join('、') : '(無)');
  }
  return '從序列移除(尚未扣費)';
}

// ───────── 版面:由左到右的科技樹(欄 = 分支內最長前置鏈長度;時代不參與版面分組) ─────────
var TU_ZOOMS = [{ n: '小', w: 96, h: 44, gx: 36, gy: 8, fs: 11 }, { n: '中', w: 124, h: 48, gx: 46, gy: 10, fs: 12 }, { n: '大', w: 156, h: 56, gx: 56, gy: 12, fs: 13 }];
var TU_CN = ['', '一', '二', '三', '四', '五'];
var TU_BADGE_H = 17;
var tuLayoutCache = {};

function techUiParents(n) {   // req + reqOr(去重)
  var out = [];
  (n.req || []).concat(n.reqOr || []).forEach(function (r) { if (out.indexOf(r) < 0) out.push(r); });
  return out;
}
function techUiBranchName(b) {
  var i, nm = b;
  for (i = 0; i < TECH_BRANCHES.length; i++) if (TECH_BRANCHES[i].id === b) nm = TECH_BRANCHES[i].name;
  return nm;
}
// 回傳 { pos:{id:{x,y,w,h,col}}, cols:[[id…]], depth:{id:欄}, edges:[{from,to,key,or}], ext:{id:[{id,branch,or}]}, w, h, Z };結果依 (分支, 縮放) 快取、決定性
function techUiLayout(branch, zoom) {
  var key = branch + ':' + zoom, Z = TU_ZOOMS[zoom] || TU_ZOOMS[1], nodes, byId = {}, idx = {}, depth = {}, busy = {}, cols = [], pos = {}, edges = [], ext = {}, maxD = 0, c, w, hgt = 0;
  if (tuLayoutCache[key]) return tuLayoutCache[key];
  nodes = CITY_TECHS.filter(function (n) { return n.branch === branch; });
  nodes.forEach(function (n, i) { byId[n.id] = n; idx[n.id] = i; });
  function inPar(n) { return techUiParents(n).filter(function (r) { return !!byId[r]; }); }
  function dep(id) {
    var d = 0;
    if (depth[id] !== undefined) return depth[id];
    if (busy[id]) return 0;
    busy[id] = 1;
    inPar(byId[id]).forEach(function (r) { d = Math.max(d, dep(r) + 1); });
    busy[id] = 0; depth[id] = d;
    return d;
  }
  nodes.forEach(function (n) {
    var d = dep(n.id), orFlag = !!(n.reqOr && n.reqOr.length);
    if (d > maxD) maxD = d;
    (cols[d] = cols[d] || []).push(n);
    inPar(n).forEach(function (r) { edges.push({ from: r, to: n.id, key: r + '>' + n.id, or: orFlag }); });
    techUiParents(n).forEach(function (r) {
      var rn = byId[r] ? null : techNode(r);
      if (rn) (ext[n.id] = ext[n.id] || []).push({ id: r, branch: rn.branch, or: orFlag });
    });
  });
  for (c = 0; c <= maxD; c++) {
    var list = cols[c] || [], cursor = Z.gy;
    var keyed = list.map(function (n) {
      var ps = inPar(n), k, sum = 0;
      if (!ps.length) k = n.era * 100000 + idx[n.id];
      else { ps.forEach(function (r) { sum += pos[r].y + Z.h / 2; }); k = sum / ps.length; }
      return { n: n, k: k, ps: ps.length };
    });
    keyed.sort(function (a, b) { return a.k - b.k || idx[a.n.id] - idx[b.n.id]; });
    cols[c] = keyed.map(function (o) { return o.n.id; });
    keyed.forEach(function (o) {
      var bh = Z.h + (ext[o.n.id] ? ext[o.n.id].length * TU_BADGE_H : 0), y = o.ps ? Math.max(cursor, Math.round(o.k - Z.h / 2)) : cursor;
      pos[o.n.id] = { x: Z.gx + c * (Z.w + Z.gx), y: y, w: Z.w, h: Z.h, bh: bh, col: c };
      cursor = y + bh + Z.gy;
    });
    if (cursor > hgt) hgt = cursor;
  }
  w = Z.gx + (maxD + 1) * (Z.w + Z.gx);
  return (tuLayoutCache[key] = { branch: branch, zoom: zoom, Z: Z, pos: pos, cols: cols, depth: depth, edges: edges, ext: ext, w: w, h: hgt + Z.gy });
}

// 祖先(遞移,含跨分支)/ 直接後繼 / 高亮集合
function techUiAncestors(id) {
  var out = {}, st = [id];
  while (st.length) {
    var n = techNode(st.pop());
    if (!n) continue;
    techUiParents(n).forEach(function (r) { if (!out[r]) { out[r] = 1; st.push(r); } });
  }
  delete out[id];
  return Object.keys(out);
}
function techUiSuccessors(id) { return CITY_TECHS.filter(function (n) { return techUiParents(n).indexOf(id) >= 0; }).map(function (n) { return n.id; }); }
function techUiHighlight(id) {
  var anc = techUiAncestors(id), nodes = {}, edges = {};
  nodes[id] = 1;
  anc.forEach(function (a) { nodes[a] = 1; });
  techUiSuccessors(id).forEach(function (s) { nodes[s] = 1; });
  CITY_TECHS.forEach(function (n) {
    techUiParents(n).forEach(function (r) { if (n.id === id || anc.indexOf(n.id) >= 0 || r === id) edges[r + '>' + n.id] = 1; });
  });
  return { nodes: nodes, edges: edges };
}
// 本分支(依欄、同欄由上到下)第一個可研節點;本分支沒有則找其他分支;皆無回 ''
function techUiFirstReady(branch) {
  var order = [branch].concat(TECH_BRANCHES.map(function (b) { return b.id; }).filter(function (b) { return b !== branch; })), i, j, lay, ids, k;
  for (i = 0; i < order.length; i++) {
    lay = techUiLayout(order[i], 1);
    for (j = 0; j < lay.cols.length; j++) {
      ids = lay.cols[j] || [];
      for (k = 0; k < ids.length; k++) if (techUiState(ids[k]).k === 'ready') return ids[k];
    }
  }
  return '';
}
// 時代閘文字:取自 NL_ERA_RULE(techEraNeed)
function techUiEraText(e) {
  var need = techEraNeed(e), t = '第 ' + e + ' 時代尚未開放:需先研完第 ' + (e - 1) + ' 時代' + (tuEraName(e - 1) ? '〈' + tuEraName(e - 1) + '〉' : '') + ' ' + need.k + ' 項(目前 ' + techEraDoneCount(e - 1) + '/' + need.k + ')';
  if (need.groups) t += ';並完成大工程:' + need.groups.map(function (g) { return g.map(tuNodeName).join(' + '); }).join(' 或 ');
  return t;
}

// ───────── 研發建議(T4):只標不鎖,前 3 名加 ★;可關(偏好存 localStorage)─────────
var TU_SUG_BAR = { ag: 'food', wa: 'water', md: 'sani', ed: 'mood', df: 'order' };   // 分支 → 城市指標
var TU_SUG_BARN = { food: '糧食', water: '水源', sani: '衛生', mood: '民心', order: '治安' };
function tuSugLoad() { try { if (typeof localStorage !== 'undefined' && localStorage.getItem('techui_sug') === '0') tu.sug = 0; } catch (e) { /* 略過 */ } }
function tuSugSave() { try { if (typeof localStorage !== 'undefined') localStorage.setItem('techui_sug', tu.sug ? '1' : '0'); } catch (e) { /* 略過 */ } }
// 回傳 [{id,score,why}](分數高者在前,最多 3 筆)。依 (a) 指標偏低的對口分支 (b) 解鎖物件數 (c) 目前時代且下一時代未開
function techUiSuggest() {
  var low = {}, cur = typeof techEra === 'function' ? techEra() : 1, nextClosed = cur < 5 && !techEraOpen(cur + 1), out = [], built = true;
  if (typeof estateObjects === 'function') { try { built = (estateObjects() || []).length > 3; } catch (e0) { built = true; } }
  Object.keys(TU_SUG_BAR).forEach(function (b) {
    var k = TU_SUG_BAR[b], v;
    if (typeof cityFxCity !== 'function' || !built) return;
    try { v = cityFxCity(k); } catch (e) { v = null; }
    if (typeof v === 'number' && isFinite(v) && v < 50) low[b] = k;
  });
  CITY_TECHS.forEach(function (n) {
    var sc = 0, why = [];
    if (techIsStyle(n) || techIsMega(n) || techUiState(n.id).k !== 'ready') return;
    if (low[n.branch]) { sc += 5; why.push(TU_SUG_BARN[low[n.branch]] + '偏低'); }
    if (nextClosed && n.era === cur) { sc += 2; why.push('邁向下一時代'); }
    if (n.unlock && n.unlock.length) { sc += Math.min(2, n.unlock.length * 0.5); if (!why.length) why.push('解鎖 ' + n.unlock.length + ' 項'); }
    sc -= n.era * 0.01;
    if (sc > 0) out.push({ id: n.id, score: sc, why: why.join('、') });
  });
  out.sort(function (a, b) { return b.score - a.score || (a.id < b.id ? -1 : 1); });
  return out.slice(0, 3);
}
function tuSugCalc() {
  var l = tu.sug ? techUiSuggest() : [];
  tu.sugSet = {}; tu.sugWhy = {};
  l.forEach(function (o) { tu.sugSet[o.id] = 1; tu.sugWhy[o.id] = o.why; });
}

// ───────── 時代進度(T6)─────────
// e 時代 → 開下一時代的進度:{ done, k, ms(大工程是否滿足,無條件為 true), hasMs, groups };第 5 時代回 null
function techUiEraProg(e) {
  var need, ms;
  if (e >= 5) return null;
  need = techEraNeed(e + 1);
  ms = !need.groups || techState().bigWaive >= e + 1 || need.groups.some(function (g) { return g.every(techBigHas); });
  return { done: techEraDoneCount(e), k: need.k, ms: ms, hasMs: !!need.groups, groups: need.groups };
}
// 點時代色帶要跳去的節點:該時代第一個可研 → 尚缺的大工程 → ''
function techUiEraTarget(e) {
  var order = TECH_BRANCHES.map(function (b) { return b.id; }), i, j, k, lay, ids, n, p = techUiEraProg(e), found = '';
  for (i = 0; i < order.length && !found; i++) {
    lay = techUiLayout(order[i], 1);
    for (j = 0; j < lay.cols.length && !found; j++) {
      ids = lay.cols[j] || [];
      for (k = 0; k < ids.length; k++) { n = techNode(ids[k]); if (n.era === e && !techIsStyle(n) && !techIsMega(n) && techUiState(ids[k]).k === 'ready') { found = ids[k]; break; } }
    }
  }
  if (found) return found;
  if (p && p.hasMs && !p.ms) p.groups.forEach(function (g) { g.forEach(function (x) { if (!found && techNode(x) && !techBigHas(x)) found = x; }); });
  return found;
}

// ───────── 詳情輔助:路徑總成本(T5 部分)/ 路線進度(T3 部分)/ 去建造(T2 部分)─────────
function techUiChainCost(id) {
  var ex = techExpand(id), coin = 0, xue = 0, g = {}, tiers = [];
  if (!ex.ok || ex.list.length < 2) return null;
  ex.list.forEach(function (x) {
    var c = techCostOf(x);
    if (!c) return;
    coin += c.coin; xue += c.xue;
    if (c.goods && c.goods.n > 0) g[c.goods.tier] = (g[c.goods.tier] || 0) + c.goods.n;
  });
  Object.keys(g).forEach(function (t) {
    var have = 0;
    techGoodsIds(+t).forEach(function (gid) { have += techHave(gid); });
    tiers.push({ tier: +t, n: g[t], have: have });
  });
  return { count: ex.list.length, coin: coin, xue: xue, tiers: tiers };
}
function techUiChainHtml(id) {
  var c = techUiChainCost(id), coin = (typeof world !== 'undefined' && world.res && world.res.coin) || 0, s = techState(), p = [];
  if (!c) return '';
  p.push('金 ' + c.coin + (coin < c.coin ? '(缺 ' + Math.ceil(c.coin - coin) + ')' : ''));
  if (c.xue) p.push('學識 ' + c.xue + (s.xue < c.xue ? '(缺 ' + Math.ceil(c.xue - s.xue) + ')' : ''));
  c.tiers.forEach(function (t) { p.push('第' + (t.tier + 1) + '階貨品 ×' + t.n + (t.have < t.n ? '(缺 ' + (t.n - t.have) + ')' : '')); });
  return '<div class="tu-c tu-chain">研發到這裡共 ' + c.count + ' 項,總需求:' + tuEsc(p.join('　')) + '</div>';
}
function techUiBuildable(n) {   // 已研成後可直接去蓋的物件 id(最多 3 個)
  var out = [];
  (n.unlock || []).forEach(function (u) { if (out.length < 3 && typeof OBJECTS !== 'undefined' && OBJECTS[u] && !OBJECTS[u].retired && out.indexOf(u) < 0) out.push(u); });
  return out;
}

// ───────── 繪製 ─────────
function tuSet(el, k, html) { if (!el) return; if (tu.last[k] !== html) { tu.last[k] = html; el.innerHTML = html; } }
function tuTopHtml() {
  return '<b>📜 科技樹</b><span class="tu-sp"></span><button data-tu="locate">定位可研</button><button data-tu="sug">建議:' + (tu.sug ? '開' : '關') + '</button><button data-tu="zoom">縮放:' + TU_ZOOMS[tu.zoom].n + '</button><button class="tu-x" data-tu="close">✕</button>';
}
function tuResHtml() {
  var s = techState(), labs = techLabCount(), cap = techLabCap(), slots = techSlots(), coin = (typeof world !== 'undefined' && world.res && world.res.coin) || 0, e = techEra();
  return '<div class="tu-res"><span>金 ' + Math.floor(coin) + '</span><span>學識 ' + Math.floor(s.xue) + '</span><span>時代 ' + e + (tuEraName(e) ? '〈' + tuEraName(e) + '〉' : '') + '</span><span>研究院 ' + labs + '/' + cap + '　槽位 ' + slots + '</span></div>';
}
function tuWarnHtml() {
  var s = techState(), labs = techLabCount(), slots = techSlots(), h = '';
  if (labs <= 0) h += '<div class="tu-warn">需建研究院才能研發<button data-tu="buildlab">去建研究院</button></div>';
  else if (slots < s.cur.length + 1 && !s.cur.length) h += '<div class="tu-warn">研究院槽位 0,請檢查研究院數量上限</div>';
  if (tu.msg) h += '<div class="tu-msg">' + tuEsc(tu.msg) + '</div>';
  return h;
}
function tuQueueSig() {
  var s = techState();
  return [s.cur.map(function (c) { return c.id; }).join(','), s.queue.join(','), tu.confirm, techSlots()].join('|');
}
function tuQueueHtml() {
  var s = techState(), slots = techSlots(), h;
  h = '<div class="tu-qh">研發序列(進行中 ' + s.cur.length + '/' + Math.max(slots, s.cur.length) + ',排隊 ' + s.queue.length + '/' + TECH_QUEUE_MAX + ')</div>';
  if (!s.cur.length && !s.queue.length) h += '<div class="tu-empty">序列是空的。點樹上節點,在下方詳情按「研發」。</div>';
  s.cur.forEach(function (c) {
    var n = techNode(c.id), pct = c.total > 0 ? Math.max(0, Math.min(100, Math.round((1 - c.left / c.total) * 100))) : 0;
    h += '<div class="tu-q cur"><div class="tu-qn">⏳ ' + (n ? tuBrIcon(n.branch, 20) : '') + tuEsc(n ? n.name : c.id) + '<small class="tu-left" data-left="' + c.id + '"> 剩 ' + techFmtTime(c.left) + '</small></div><div class="tu-bar"><i data-bar="' + c.id + '" style="width:' + pct + '%"></i></div>';
    if (tu.confirm === c.id) h += '<div class="tu-cf">' + tuEsc(techCancelHint(c.id)) + '<button data-tu="cancelyes" data-id="' + c.id + '">確定取消</button><button data-tu="cancelno">不取消</button></div>';
    else h += '<button data-tu="cancel" data-id="' + c.id + '">取消</button>';
    h += '</div>';
  });
  s.queue.forEach(function (id, i) {
    var n = techNode(id), wait = techCanStart(id) ? '' : '(等待)';
    h += '<div class="tu-q"><div class="tu-qn">' + (i + 1) + '. ' + (n ? tuBrIcon(n.branch, 20) : '') + tuEsc(n ? n.name : id) + '<small> ' + wait + ' ' + tuDurText(techDurationOf(id)) + '</small></div>';
    if (tu.confirm === id) h += '<div class="tu-cf">' + tuEsc(techCancelHint(id)) + '<button data-tu="cancelyes" data-id="' + id + '">確定移除</button><button data-tu="cancelno">不移除</button></div>';
    else h += (i > 0 ? '<button data-tu="up" data-id="' + id + '">上移</button>' : '') + '<button data-tu="cancel" data-id="' + id + '">取消</button>';
    h += '</div>';
  });
  return h;
}
// 每秒只更新倒數文字與進度條,不重建序列區(按鈕不被換掉)
function tuTickQueue() {
  var s = techState(), L, B;
  if (!tu.qEl || !tu.qEl.querySelectorAll) return;
  s.cur.forEach(function (c) {
    var pct = c.total > 0 ? Math.max(0, Math.min(100, Math.round((1 - c.left / c.total) * 100))) : 0, t = ' 剩 ' + techFmtTime(c.left);
    L = tu.qEl.querySelector('[data-left="' + c.id + '"]'); B = tu.qEl.querySelector('[data-bar="' + c.id + '"]');
    if (L && L.textContent !== t) L.textContent = t;
    if (B && B.style) B.style.width = pct + '%';
  });
}
// 橫版底部單行(浮動):資源 + 進行中摘要 + 展開鈕;每秒只改 span 文字,不重建節點
function tuStripRes() { var s = techState(), coin = (typeof world !== 'undefined' && world.res && world.res.coin) || 0; return '金 ' + Math.floor(coin) + '　學識 ' + Math.floor(s.xue); }
function tuStripCur() {
  var s = techState(), c = s.cur[0], n;
  if (c) { n = techNode(c.id); return '⏳ 進行中:' + (n ? n.name : c.id) + ' 剩 ' + techFmtTime(c.left) + (s.cur.length + s.queue.length > 1 ? '(+' + (s.cur.length + s.queue.length - 1) + ')' : ''); }
  if (techLabCount() <= 0) return '⚠ 需建研究院才能研發';
  return s.queue.length ? '排隊中 ' + s.queue.length + ' 項' : '研發序列是空的';
}
function tuTickStrip() {
  var a = tuStripRes(), b = tuStripCur();
  if (tu.sResEl && tu.sResEl.textContent !== a) tu.sResEl.textContent = a;
  if (tu.sCurEl && tu.sCurEl.textContent !== b) tu.sCurEl.textContent = b;
}
function tuSyncCls() {
  if (!tu.el || !tu.el.classList) return;
  tu.el.classList.toggle('tu-sel', !!tu.sel);
  tu.el.classList.toggle('tu-qopen', !!tu.qOpen);
}
function tuHeadHtml() { return tuTopHtml() + tuResHtml() + tuWarnHtml() + tuQueueHtml(); }

// 分支圖示(js/uiicons.js 存在且偏好開啟才有;否則回空字串,頁籤維持純文字)
function tuIconOn() { return typeof uiIconHtml === 'function' && typeof uiIconsOn === 'function' && uiIconsOn(); }
function tuBrIcon(id, px, fb) { return tuIconOn() ? uiIconHtml(id, px, fb || '') : ''; }
function tuTabsHtml() {
  var h = '', ic = tuIconOn();
  TECH_BRANCHES.forEach(function (b) {
    var done = 0, tot = 0;
    CITY_TECHS.forEach(function (n) { if (n.branch === b.id) { tot++; if (techDone(n.id)) done++; } });
    if (ic) h += '<button class="tu-tab ic' + (tu.branch === b.id ? ' on' : '') + '" data-tu="tab" data-id="' + b.id + '" title="' + tuEsc(b.name) + '" aria-label="' + tuEsc(b.name) + '">' + tuBrIcon(b.id, 32, b.name.charAt(0)) + '<span class="tu-tn">' + tuEsc(b.name) + '</span><small> ' + done + '/' + tot + '</small></button>';
    else h += '<button class="tu-tab' + (tu.branch === b.id ? ' on' : '') + '" data-tu="tab" data-id="' + b.id + '">' + tuEsc(b.name) + '<small> ' + done + '/' + tot + '</small></button>';
  });
  return ic ? '<div class="tu-tr">' + h + '</div>' : h;
}
// 時代僅作為頂部參考色帶(階別顏色對照),不參與節點分組
function tuEraHtml() {
  var h = '', e, p;
  for (e = 1; e <= 5; e++) {
    p = techUiEraProg(e);
    h += '<span class="tu-ec e' + e + (techEraOpen(e) ? '' : ' off') + '" data-tu="era" data-id="' + e + '">第' + TU_CN[e] + '時代' + (tuEraName(e) ? '〈' + tuEraName(e) + '〉' : '') + (techEraOpen(e) ? '' : '🔒') +
      (p ? ' ' + Math.min(p.done, p.k) + '/' + p.k + (p.hasMs ? ' 大工程' + (p.ms ? '✔' : '✘') : '') : '') + '</span>';
  }
  return h + '<span class="tu-ecn">色條 = 節點階別;數字 = 開下一時代進度,點了跳到缺的節點</span>';
}

function tuNodeClass(id, hs, st) {
  var n = techNode(id), s = st || techUiState(id), lk = s.k !== 'done' && s.k !== 'mega' && !techEraOpen(n.era);
  return 'tu-n e' + n.era + ' ' + s.k + (lk ? ' lk' : '') + (tu.focus === id ? ' focus' : '') + (tu.sel === id ? ' sel' : '') + (tu.sugSet[id] ? ' sug' : '') + (hs ? (hs.nodes[id] ? ' hl' : ' dim') : '');
}
function tuEdgeStatus(e) { return techDone(e.from) ? (techDone(e.to) ? 'done' : 'ready') : 'todo'; }
function tuEdgeClass(e, hs) { return 'tu-e ' + tuEdgeStatus(e) + (e.or ? ' or' : '') + (hs ? (hs.edges[e.key] ? ' hl' : ' dim') : ''); }

function tuTreeInner(branch, zoom) {
  tuSugCalc();
  var lay = techUiLayout(branch, zoom), Z = lay.Z, hs = tu.sel ? techUiHighlight(tu.sel) : null, h;
  h = '<svg class="tu-svg" width="' + lay.w + '" height="' + lay.h + '" xmlns="http://www.w3.org/2000/svg">';
  lay.edges.forEach(function (e) {
    var a = lay.pos[e.from], b = lay.pos[e.to], x1 = a.x + Z.w, y1 = a.y + Z.h / 2, x2 = b.x, y2 = b.y + Z.h / 2, dx = (x2 - x1) / 2;
    h += '<g class="' + tuEdgeClass(e, hs) + '" data-e="' + e.key + '"><path d="M' + x1 + ' ' + y1 + 'C' + (x1 + dx) + ' ' + y1 + ',' + (x2 - dx) + ' ' + y2 + ',' + x2 + ' ' + y2 + '"/>' +
      (e.or ? '<text x="' + Math.round((x1 + x2) / 2) + '" y="' + (Math.round((y1 + y2) / 2) - 3) + '">或</text>' : '') + '</g>';
  });
  h += '</svg>';
  CITY_TECHS.forEach(function (n) {
    if (n.branch !== branch) return;
    var p = lay.pos[n.id], st = techUiState(n.id);
    h += '<div class="tu-nw" style="left:' + p.x + 'px;top:' + p.y + 'px;width:' + Z.w + 'px"><div class="' + tuNodeClass(n.id, hs, st) + '" data-tu="sel" data-id="' + n.id + '" data-node="' + n.id + '" style="height:' + Z.h + 'px">' +
      '<span class="tu-nm">' + tuEsc(n.name) + '</span><span class="tu-nf"><span class="tu-era">第' + n.era + '階</span><i class="tu-lock">🔒</i><span class="tu-st ' + st.k + '">' + TU_STATE_TXT[st.k] + '</span></span></div>';
    (lay.ext[n.id] || []).forEach(function (x) {
      h += '<span class="tu-xb" data-tu="goto" data-id="' + x.id + '" style="height:' + (TU_BADGE_H - 1) + 'px">' + (x.or ? '或 ' : '') + '← ' + tuEsc(techUiBranchName(x.branch)) + '·' + tuEsc(tuNodeName(x.id)) + '</span>';
    });
    h += '</div>';
  });
  return h;
}
function tuBuildTree(force) {
  var key = tu.branch + ':' + tu.zoom, lay;
  if (!tu.cvEl || (!force && tu.treeKey === key)) return;
  lay = techUiLayout(tu.branch, tu.zoom);
  tu.cvEl.innerHTML = tuTreeInner(tu.branch, tu.zoom);
  if (tu.cvEl.style) { tu.cvEl.style.width = lay.w + 'px'; tu.cvEl.style.height = lay.h + 'px'; tu.cvEl.style.fontSize = lay.Z.fs + 'px'; }
  tu.treeKey = key; tu.builds++;
}
// 狀態變化只改 class / 文字(不重建節點)
function tuApply() {
  var hs = tu.sel ? techUiHighlight(tu.sel) : null, els, i, el, id, st, c, s, t, e, lay;
  if (!tu.cvEl || !tu.cvEl.querySelectorAll) return;
  tuSugCalc();
  els = tu.cvEl.querySelectorAll('[data-node]');
  for (i = 0; i < els.length; i++) {
    el = els[i]; id = el.getAttribute('data-node'); st = techUiState(id); c = tuNodeClass(id, hs, st);
    if (el.getAttribute('class') !== c) el.setAttribute('class', c);
    s = el.querySelector ? el.querySelector('.tu-st') : null; t = TU_STATE_TXT[st.k];
    if (s && s.textContent !== t) { s.textContent = t; s.setAttribute('class', 'tu-st ' + st.k); }
  }
  lay = techUiLayout(tu.branch, tu.zoom);
  els = tu.cvEl.querySelectorAll('[data-e]');
  for (i = 0; i < els.length; i++) {
    el = els[i]; id = el.getAttribute('data-e');
    for (t = 0; t < lay.edges.length; t++) if (lay.edges[t].key === id) { e = lay.edges[t]; break; }
    if (!e) continue;
    c = tuEdgeClass(e, hs);
    if (el.getAttribute('class') !== c) el.setAttribute('class', c);
  }
}

function tuDetailHtml() {
  var n = tu.sel ? techNode(tu.sel) : null, st, h, un, c, pr;
  if (!n) return '<div class="tu-hint">點選節點看條件、成本與解鎖內容;選取後會高亮它的前置路徑與後繼,其餘淡化。</div>';
  st = techUiState(n.id); un = techUiUnlockNames(n);
  h = '<div class="tu-dt"><b>' + tuEsc(n.name) + '</b><span class="tu-era">第' + n.era + '階</span><span class="tu-st ' + st.k + '">' + TU_STATE_TXT[st.k] + '</span><span class="tu-sp"></span><button data-tu="desel">收起</button></div>';
  if (n.desc) h += '<div class="tu-d">' + tuEsc(n.desc) + '</div>';
  if (st.k === 'mega') h += '<div class="tu-c">條件:' + tuEsc((n.cost && n.cost.goodsText) || '大工程達成') + '</div><div class="tu-d">里程碑不走研發序列,由大工程完成後記入。</div>';
  else h += '<div class="tu-c">' + tuEsc(tuCostText(n.id)) + '　時長 ' + tuDurText(techDurationOf(n.id)) + '</div>';
  if (tu.sugSet[n.id] && tu.sugWhy[n.id]) h += '<div class="tu-sg">★ 建議先研:' + tuEsc(tu.sugWhy[n.id]) + '</div>';
  if (un.length) h += '<div class="tu-u">解鎖:' + tuEsc(un.join('、')) + '</div>';
  pr = function (r) { return '<button class="tu-pr ' + (techDone(r) ? 'ok' : 'no') + '" data-tu="goto" data-id="' + r + '">' + (techDone(r) ? '✓ ' : '✗ ') + tuEsc(tuNodeName(r)) + '</button>'; };
  if (n.req && n.req.length) h += '<div class="tu-pq">前置:' + n.req.map(pr).join('') + (n.reqOr && n.reqOr.length ? ' <b>或</b> ' + n.reqOr.map(pr).join('') : '') + '</div>';
  if (st.k === 'req') h += '<div class="tu-lk">前置未滿:' + tuEsc(st.miss.join('、')) + (n.reqOr && n.reqOr.length ? '(或 ' + tuEsc(n.reqOr.map(tuNodeName).join('、')) + ')' : '') + '</div>';
  if (st.k !== 'done' && st.k !== 'mega' && !techEraOpen(n.era)) h += '<div class="tu-lk">🔒 ' + tuEsc(techUiEraText(n.era)) + '</div>';
  c = '';
  if (st.k === 'ready') c = '<button data-tu="add" data-id="' + n.id + '">研發</button>';
  else if (st.k === 'req') c = techUiChainHtml(n.id) + '<button data-tu="addto" data-id="' + n.id + '">研發到這裡</button>';
  else if (st.k === 'done') techUiBuildable(n).forEach(function (u) { c += '<button data-tu="build" data-id="' + u + '">去蓋 ' + tuEsc(OBJECTS[u].name || u) + '</button>'; });
  return h + c;
}
function techUiHtml() {
  return tuHeadHtml() + '<div class="tu-tabs">' + tuTabsHtml() + '</div><div class="tu-es">' + tuEraHtml() + '</div><div class="tu-cv">' + tuTreeInner(tu.branch, tu.zoom) + '</div><div class="tu-det">' + tuDetailHtml() + '</div>';
}

function tuSig() {
  var s = techState();
  return [Object.keys(s.done).length, s.cur.map(function (c) { return c.id; }).join(','), s.queue.join(','), techEra(), techLabCount(), tu.branch, tu.zoom, tu.confirm, tu.msg, tu.focus, tu.sel, tu.sug].join('|');
}
function tuRender(rebuild) {
  var qs;
  if (!tu.el) return;
  tuSet(tu.topEl, 'top', tuTopHtml()); tuSet(tu.resEl, 'res', tuResHtml()); tuSet(tu.warnEl, 'warn', tuWarnHtml());
  qs = tuQueueSig();
  if (tu.qEl && (rebuild || qs !== tu.qSig)) { tu.qSig = qs; tu.qEl.innerHTML = tuQueueHtml(); }
  tuTickQueue();
  tuSet(tu.tabsEl, 'tabs', tuTabsHtml()); tuSet(tu.eraEl, 'era', tuEraHtml());
  tuSugCalc();
  tuBuildTree(rebuild === 'tree');
  tuApply();
  tuSet(tu.detEl, 'det', tuDetailHtml());
  tuTickStrip(); tuSyncCls();
  tu.sig = tuSig();
}
// 每秒:只更新資源數字與倒數;只有序列 / 已研 / 時代 等簽章改變才局部刷新(節點不重建)
function tuTick() {
  if (!tu.el) return;
  tuSet(tu.resEl, 'res', tuResHtml());
  tuTickQueue(); tuTickStrip();
  if (tuSig() !== tu.sig) tuRender(false);
}
function tuScrollTo(id) {
  var lay = techUiLayout(tu.branch, tu.zoom), p = lay.pos[id], vw, vh;
  if (!p || !tu.scEl) return;
  vw = tu.scEl.clientWidth || 320; vh = tu.scEl.clientHeight || 300;
  tu.scEl.scrollLeft = Math.max(0, Math.round(p.x - vw / 2 + lay.Z.w / 2));
  tu.scEl.scrollTop = Math.max(0, Math.round(p.y - vh / 2 + lay.Z.h / 2));
}

// ───────── 動作 ─────────
var TU_WHY = { full: '序列已滿', era: '該時代尚未開放', mega: '里程碑不能研發', done: '已經研完', unknown: '找不到該科技', cycle: '科技資料有誤', nostate: '尚未就緒' };
function tuGoto(id) {
  var n = techNode(id);
  if (!n) return;
  tu.branch = n.branch; tu.sel = id; tu.focus = id;
  tuRender(false); tuScrollTo(id);
}
function techUiAct(act, id) {
  var r, n;
  tu.msg = '';
  if (act === 'close') { techPanelClose(); return; }
  if (act === 'tab') { tu.branch = id; tu.focus = ''; tu.sel = ''; tuRender(false); if (tu.scEl) { tu.scEl.scrollLeft = 0; tu.scEl.scrollTop = 0; } return; }
  if (act === 'qtoggle') { tu.qOpen = !tu.qOpen; tuSyncCls(); return; }
  if (act === 'sel') { tu.sel = tu.sel === id ? '' : id; tuRender(false); return; }
  if (act === 'desel') { tu.sel = ''; tuRender(false); return; }
  if (act === 'goto') { tuGoto(id); return; }
  if (act === 'zoom') { tu.zoom = (tu.zoom + 1) % TU_ZOOMS.length; tuRender(false); if (tu.sel) tuScrollTo(tu.sel); return; }
  if (act === 'sug') { tu.sug = tu.sug ? 0 : 1; tuSugSave(); tuRender(false); return; }
  if (act === 'era') {
    id = techUiEraTarget(+id);
    if (id) tuGoto(id); else { tu.msg = '這個時代目前沒有可研的節點'; tuRender(false); }
    return;
  }
  if (act === 'build') {
    if (typeof OBJECTS !== 'undefined' && OBJECTS[id] && typeof setTool === 'function') { techPanelClose(); setTool(id); tuToast('已選 ' + (OBJECTS[id].name || id) + ',點地面放置'); }
    return;
  }
  if (act === 'locate') {
    id = techUiFirstReady(tu.branch);
    if (id) tuGoto(id); else { tu.msg = '目前沒有可研的節點(前置未滿或該時代尚未開放)'; tuRender(false); }
    return;
  }
  if (act === 'add' || act === 'addto') {
    r = act === 'add' ? techQueueAdd(id) : techQueueAddTo(id);
    n = tuNodeName(id);
    if (r.ok && !r.added.length) tu.msg = n + ' 已在序列中';
    else if (r.ok || r.added.length) tu.msg = '已排入:' + r.added.map(tuNodeName).join(' → ') + (r.ok ? '' : '(序列放不下,其餘未排入)');
    else if (r.reason === 'full') tu.msg = '序列放不下(需 ' + r.need + ' 項,剩 ' + r.room + ' 格)。可改用「研發到這裡」先排一部分。';
    else tu.msg = TU_WHY[r.reason] || '無法排入';
    if (techLabCount() <= 0 && (r.ok || r.added.length)) tu.msg += '。需建研究院才會開始研發';
    tuRender(true); return;
  }
  if (act === 'cancel') { tu.confirm = id; tuRender(true); return; }
  if (act === 'cancelno') { tu.confirm = ''; tuRender(true); return; }
  if (act === 'cancelyes') {
    var s = techState(), hint = techCancelHint(id);
    if (s.cur.some(function (c) { return c.id === id; })) { techCancel(id); tu.msg = '已取消 ' + tuNodeName(id) + '。' + hint; }
    else { r = techQueueRemove(id, { cascade: true }); tu.msg = '已移除 ' + r.removed.map(tuNodeName).join('、'); }
    tu.confirm = ''; tuRender(true); return;
  }
  if (act === 'up') { var q = techState().queue, i = q.indexOf(id); if (i > 0) techQueueMove(id, i - 1); tuRender(true); return; }
  if (act === 'buildlab') {
    techPanelClose();
    if (typeof OBJECTS !== 'undefined' && OBJECTS.research && typeof setTool === 'function') { setTool('research'); tuToast('已選研究院,點地面放置'); }
  }
}
function tuOnClick(e) {
  var b = e.target && e.target.closest ? e.target.closest('[data-tu]') : null;
  if (!b) return;
  if (tu.dragged && Date.now() - tu.dragged < 300) return;   // 滑鼠拖曳捲動結束的那一下不算點擊
  techUiAct(b.getAttribute('data-tu'), b.getAttribute('data-id') || '');
}
function tuBindDrag(sc) {   // 桌機滑鼠拖曳捲動;觸控交給原生捲動
  var d = null;
  if (!sc.addEventListener || typeof document === 'undefined' || !document.addEventListener) return;
  sc.addEventListener('mousedown', function (e) { if (e.button) return; d = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop, m: false }; });
  document.addEventListener('mousemove', function (e) {
    if (!d) return;
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.m && Math.abs(dx) + Math.abs(dy) > 5) d.m = true;
    if (d.m) { sc.scrollLeft = d.l - dx; sc.scrollTop = d.t - dy; }
  });
  document.addEventListener('mouseup', function () { if (d && d.m) tu.dragged = Date.now(); d = null; });
}

// ───────── 面板 ─────────
var TU_CSS = '#techTreePanel{position:fixed;left:50%;top:3%;transform:translateX(-50%);width:min(1000px,98vw);height:94vh;height:94dvh;display:flex;flex-direction:column;background:rgba(24,20,14,.97);color:#f1e6cf;border:1px solid #8a6d3b;border-radius:10px;z-index:41;font-size:13px}' +
  '#techTreePanel[hidden]{display:none}#techTreePanel button{background:#4a3a20;color:#f1e6cf;border:1px solid #8a6d3b;border-radius:6px;padding:4px 8px;margin:2px;font-size:12px;min-height:34px}' +
  '#techTreePanel .tu-topbar{display:flex;align-items:center;gap:2px;padding:6px 8px;border-bottom:1px solid #5a4727;flex:none}#techTreePanel .tu-x{min-width:44px;min-height:44px;font-size:16px}' +
  '#techTreePanel .tu-head{padding:4px 10px;border-bottom:1px solid #5a4727;max-height:24vh;overflow:auto;flex:none;-webkit-overflow-scrolling:touch}' +
  '#techTreePanel .tu-body{flex:1;min-height:0;display:flex;flex-direction:column}' +
  '#techTreePanel .tu-sc{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-x pan-y;position:relative;cursor:grab}' +
  '#techTreePanel .tu-det{flex:none;max-height:34vh;overflow:auto;border-top:1px solid #8a6d3b;padding:6px 10px;background:rgba(40,32,20,.98)}' +
  '.tu-sp{flex:1}.tu-res{display:flex;gap:10px;flex-wrap:wrap;margin:2px 0}.tu-warn{color:#ffb4a0;margin:2px 0}.tu-msg{color:#9fe0a0;margin:2px 0}' +
  '.tu-qh{margin-top:4px;font-weight:bold}.tu-q{display:flex;flex-wrap:wrap;align-items:center;gap:4px;border-top:1px dashed #5a4727;padding:2px 0}.tu-qn{flex:1;min-width:140px}.tu-bar{width:100%;height:5px;background:#3a2f1a;border-radius:3px}.tu-bar i{display:block;height:100%;background:#f0b45a;border-radius:3px}.tu-cf{color:#ffd9a0;width:100%}.tu-empty{opacity:.7;padding:4px 0}' +
  '.tu-tabs{display:flex;overflow-x:auto;white-space:nowrap;gap:2px;padding:4px 8px 2px;flex:none}.tu-tab.on{background:#8a6d3b!important}.tu-tab small{opacity:.7}' +
  '.tu-tr{display:flex;gap:2px;flex:none}.tu-tab.ic{display:inline-flex;align-items:center;gap:4px;min-height:44px;padding:2px 8px}.tu-tab.ic.on{outline:2px solid #f0b45a}' +
  '@media (max-width:480px){.tu-tr{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));width:100%}.tu-tab.ic{flex-direction:column;justify-content:center;gap:0;padding:2px;margin:0;min-width:44px}.tu-tab.ic .tu-tn{display:none}.tu-tab.ic small{font-size:10px}}' +
  '.tu-es{display:flex;overflow-x:auto;white-space:nowrap;gap:4px;padding:2px 8px 4px;flex:none;align-items:center;font-size:11px}.tu-ec{padding:1px 8px;border-radius:9px;color:#111;opacity:.9}.tu-ec.off{opacity:.45}.tu-ecn{opacity:.55;margin-left:4px}' +
  '.tu-n.e1{--ec:#6aa86a}.tu-n.e2{--ec:#5aa0c8}.tu-n.e3{--ec:#c8a24a}.tu-n.e4{--ec:#c8704a}.tu-n.e5{--ec:#a86ac8}' +
  '.tu-ec.e1{background:#6aa86a}.tu-ec.e2{background:#5aa0c8}.tu-ec.e3{background:#c8a24a}.tu-ec.e4{background:#c8704a}.tu-ec.e5{background:#a86ac8}' +
  '.tu-cv{position:relative}.tu-svg{position:absolute;left:0;top:0;pointer-events:none}.tu-nw{position:absolute}' +
  '.tu-n{box-sizing:border-box;border:1px solid #5a4727;border-left:5px solid var(--ec,#888);border-radius:8px;padding:3px 5px;background:#2b2418;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;cursor:pointer;min-height:44px}' +
  '.tu-nm{font-weight:bold;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.tu-nf{display:flex;align-items:center;gap:4px;font-size:.85em}.tu-era{opacity:.7}.tu-lock{display:none;font-style:normal}.tu-n.lk .tu-lock{display:inline}' +
  '.tu-st{font-size:.85em;border-radius:8px;padding:0 6px;background:#3a2f1a}.tu-st.ready{background:#2f5a2f}.tu-st.done{background:#2a4a6a}.tu-st.cur,.tu-st.queued{background:#6a5a1a}.tu-st.mega{background:#5a3a5a}.tu-st.era{background:#444}' +
  '.tu-n.ready{background-color:#294a29;border-color:#7fd37f}.tu-n.done{background-color:#1f3550}.tu-n.cur,.tu-n.queued{background-color:#52461a;border-color:#f0b45a}.tu-n.req{background-color:#2b2418;opacity:.85}.tu-n.era{background-color:#2a2a2a;opacity:.75}.tu-n.mega{background-color:#4a2f4a;border-color:#c89ac8}' +
  '.tu-n.focus{outline:2px solid #f0b45a}.tu-n.sel{outline:3px solid #fff}.tu-n.dim{opacity:.25}.tu-n.hl{opacity:1}' +
  '.tu-ec[data-tu]{cursor:pointer}.tu-n{position:relative}.tu-n.sug::after{content:"★";position:absolute;right:3px;top:0;color:#ffd36a;font-size:14px;line-height:1}.tu-sg{margin-top:3px;color:#ffd36a}.tu-chain{color:#ffd9a0}' +
  '.tu-xb{display:block;box-sizing:border-box;width:100%;font-size:10px;line-height:16px;color:#cfe3ff;background:#2a3a55;border-radius:8px;margin-top:1px;padding:0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}' +
  '.tu-e path{fill:none;stroke-width:2}.tu-e text{fill:#e8c6ff;font-size:11px;text-anchor:middle}.tu-e.done path{stroke:#f0b45a}.tu-e.ready path{stroke:#7fd37f}.tu-e.todo path{stroke:#6c675c;stroke-dasharray:5 4}.tu-e.or path{stroke-dasharray:7 3}.tu-e.or.todo path{stroke:#9a7ab0}.tu-e.dim{opacity:.1}.tu-e.hl path{stroke-width:3}' +
  '.tu-dt{display:flex;align-items:center;gap:6px}.tu-d,.tu-c,.tu-u,.tu-lk,.tu-pq,.tu-hint{margin-top:3px;opacity:.92}.tu-hint{opacity:.7}.tu-lk{color:#ffb4a0}.tu-u{color:#cfe3ff}#techTreePanel .tu-pr.ok{border-color:#7fd37f}#techTreePanel .tu-pr.no{border-color:#c0705a}' +
  // ── 橫版大面板模式(body.panel-big-landscape):滿版;單一薄列 = 分支圖示頁籤 + 定位 / 縮放 / 關閉;樹區滿版可拖曳捲動;研發序列收成浮動單行、詳情為右側浮層(皆不占樹區高度)
  'body.panel-big-landscape #techTreePanel:not([hidden]){position:fixed;left:0;top:0;right:0;bottom:0;width:auto;height:auto;transform:none;border:0;border-radius:0;z-index:41;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;grid-template-rows:var(--ls-bar,44px) minmax(0,1fr);box-sizing:border-box;padding:env(safe-area-inset-top) var(--ls-sr,12px) env(safe-area-inset-bottom) var(--ls-sl,12px);max-height:none}' +
  'body.panel-big-landscape #techTreePanel .tu-topbar,body.panel-big-landscape #techTreePanel .tu-body{display:contents}' +
  'body.panel-big-landscape #techTreePanel .tu-topbar>b,body.panel-big-landscape #techTreePanel .tu-topbar>.tu-sp,body.panel-big-landscape #techTreePanel .tu-es{display:none}' +
  'body.panel-big-landscape #techTreePanel .tu-topbar>button{grid-row:1;min-height:var(--ls-tap,44px);min-width:var(--ls-tap,44px);margin:0 0 0 var(--ls-gap,8px);padding:0 10px;font-size:14px;align-self:center}' +
  'body.panel-big-landscape #techTreePanel .tu-tabs{grid-row:1;grid-column:1;display:flex;align-items:center;overflow-x:auto;overflow-y:hidden;padding:0;gap:var(--ls-gap,8px);min-height:var(--ls-bar,44px);-webkit-overflow-scrolling:touch;touch-action:pan-x}' +
  'body.panel-big-landscape #techTreePanel .tu-tr{display:flex;gap:var(--ls-gap,8px)}' +
  'body.panel-big-landscape #techTreePanel .tu-tab{margin:0;min-height:var(--ls-tap,44px);min-width:var(--ls-tap,44px);font-size:14px;flex:none}' +
  'body.panel-big-landscape #techTreePanel .tu-tab.ic{display:inline-flex;justify-content:center;padding:2px 6px}body.panel-big-landscape #techTreePanel .tu-tab.ic .tu-tn,body.panel-big-landscape #techTreePanel .tu-tab.ic small{display:none}' +
  'body.panel-big-landscape #techTreePanel .tu-sc{grid-row:2;grid-column:1/-1;min-height:0}body.panel-big-landscape #techTreePanel .tu-sc::after{content:"";display:block;height:56px}' +
  'body.panel-big-landscape #techTreePanel .tu-head{display:none}' +
  'body.panel-big-landscape #techTreePanel.tu-qopen .tu-head{display:block;position:absolute;left:var(--ls-sl,12px);right:var(--ls-sr,12px);bottom:calc(env(safe-area-inset-bottom) + 52px);max-height:55%;z-index:3;border:1px solid #8a6d3b;border-radius:8px;background:rgba(40,32,20,.98)}' +
  'body.panel-big-landscape #techTreePanel .tu-det{display:none}' +
  'body.panel-big-landscape #techTreePanel.tu-sel .tu-det{display:block;position:absolute;right:var(--ls-sr,12px);top:calc(env(safe-area-inset-top) + var(--ls-bar,44px));bottom:calc(env(safe-area-inset-bottom) + 4px);width:min(360px,46%);max-height:none;z-index:4;border:1px solid #8a6d3b;border-radius:8px;overscroll-behavior:contain;touch-action:pan-y}' +
  'body.panel-big-landscape #techTreePanel .tu-strip{display:flex;align-items:center;gap:var(--ls-gap,8px);position:absolute;left:var(--ls-sl,12px);bottom:calc(env(safe-area-inset-bottom) + 6px);height:var(--ls-thin,40px);max-width:calc(100% - var(--ls-sl,12px) - var(--ls-sr,12px));box-sizing:border-box;padding:0 4px 0 12px;z-index:3;border:1px solid #8a6d3b;border-radius:20px;background:rgba(40,32,20,.96);font-size:14px;white-space:nowrap}' +
  'body.panel-big-landscape #techTreePanel.tu-sel .tu-strip{max-width:calc(100% - 380px - var(--ls-sl,12px))}body.panel-big-landscape #techTreePanel.tu-sel .tu-s-res{display:none}' +
  'body.panel-big-landscape #techTreePanel .tu-s-btn{margin:0;min-height:var(--ls-tap,44px);min-width:var(--ls-tap,44px)}' +
  'body.panel-big-landscape #techTreePanel .tu-det button,body.panel-big-landscape #techTreePanel .tu-head button{min-height:var(--ls-tap,44px);min-width:var(--ls-tap,44px);font-size:14px}body.panel-big-landscape #techTreePanel .tu-det,body.panel-big-landscape #techTreePanel .tu-head{font-size:14px}' +
  'body.panel-big-landscape #techTreePanel .tu-cv{font-size:14px!important}body.panel-big-landscape #techTreePanel :is(.tu-nf,.tu-xb,.tu-st,.tu-era,.tu-ecn,.tu-e text){font-size:12px}' +
  '.tu-strip{display:none}';
function tuEnsure() {
  var st, el, mk;
  if (tu.el) return tu.el;
  tuSugLoad();
  if (typeof document === 'undefined' || !document.createElement) return null;
  mk = function (cls) { var d = document.createElement('div'); d.className = cls; return d; };
  st = document.createElement('style'); st.id = 'techuiCss'; st.textContent = TU_CSS;
  if (document.head && document.head.appendChild) document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'techTreePanel'; el.hidden = true;
  tu.topEl = mk('tu-topbar'); tu.headEl = mk('tu-head');
  tu.resEl = document.createElement('div'); tu.warnEl = document.createElement('div'); tu.qEl = document.createElement('div');
  tu.headEl.appendChild(tu.resEl); tu.headEl.appendChild(tu.warnEl); tu.headEl.appendChild(tu.qEl);
  tu.bodyEl = mk('tu-body'); tu.tabsEl = mk('tu-tabs'); tu.eraEl = mk('tu-es'); tu.scEl = mk('tu-sc'); tu.cvEl = mk('tu-cv');
  tu.scEl.appendChild(tu.cvEl);
  tu.bodyEl.appendChild(tu.tabsEl); tu.bodyEl.appendChild(tu.eraEl); tu.bodyEl.appendChild(tu.scEl);
  tu.detEl = mk('tu-det');
  tu.stripEl = mk('tu-strip'); tu.sResEl = document.createElement('span'); tu.sResEl.className = 'tu-s-res'; tu.sCurEl = document.createElement('span'); tu.sCurEl.className = 'tu-s-cur';
  tu.stripEl.appendChild(tu.sResEl); tu.stripEl.appendChild(tu.sCurEl);
  mk = document.createElement('button'); mk.className = 'tu-s-btn'; if (mk.setAttribute) mk.setAttribute('data-tu', 'qtoggle'); mk.textContent = '序列 ▲'; tu.stripEl.appendChild(mk);
  el.appendChild(tu.topEl); el.appendChild(tu.headEl); el.appendChild(tu.bodyEl); el.appendChild(tu.detEl); el.appendChild(tu.stripEl);
  el.addEventListener('click', tuOnClick);
  tuBindDrag(tu.scEl);
  if (document.body && document.body.appendChild) document.body.appendChild(el);
  tu.el = el;
  if (typeof panelRegister === 'function') panelRegister('techtree', { kind: 'big', el: el, close: tuHide });
  return el;
}
function tuHide() {
  tu.open = false;
  if (tu.el) tu.el.hidden = true;
  if (tu.timer && typeof clearInterval === 'function') { clearInterval(tu.timer); tu.timer = 0; }
}
function techPanelIsOpen() { return !!tu.open; }
function techPanelOpen(nodeId) {
  var el = tuEnsure(), n = nodeId ? techNode(nodeId) : null;
  if (typeof CITY_TECHS === 'undefined' || typeof techState !== 'function') return false;
  tu.msg = ''; tu.confirm = ''; tu.qOpen = false;
  if (typeof panelLsActive === 'function' && panelLsActive() && !tu.lsZoom) { tu.zoom = TU_ZOOMS.length - 1; tu.lsZoom = 1; }   // 橫版首次開啟:節點用「大」(高 56,容得下 14px 兩行名稱 + 狀態列)
  if (n) { tu.branch = n.branch; tu.focus = nodeId; tu.sel = nodeId; } else tu.focus = '';
  if (el && typeof panelOpen === 'function') panelOpen('techtree');
  tu.open = true;
  if (el) el.hidden = false;
  tuRender(false);
  if (n) tuScrollTo(nodeId);
  if (!tu.timer && typeof setInterval === 'function') tu.timer = setInterval(function () { if (tu.open) tuTick(); }, 1000);
  return true;
}
function techPanelClose() {
  if (!tu.open) return;
  if (typeof panelClose === 'function' && typeof panelIsOpen === 'function' && panelIsOpen('techtree')) panelClose('techtree');
  else tuHide();
}
function techPanelToggle() { if (tu.open) techPanelClose(); else techPanelOpen(); }
