// js/techui.js — 科技樹頁(PLAN_NOLEVEL NL2):分支分頁、節點卡、研發 / 研發到這裡、研發序列、研究院狀態;並提供「需研發〈X〉」鎖頭文案。
// 全域名稱:techPanelOpen(nodeId?) techPanelClose techPanelToggle techPanelIsOpen techUiHtml techUiAct techUiState techUiUnlockNames
//          techObjLockText techFeatLockText techFeatLockGo techLockedNames techCancelHint
// 依賴(皆 typeof 守衛):citytech.js、techtree_data.js、nolevel_data.js、panelmgr.js、goods.js。ES2017;不用 ?. ??。
var tu = { el: null, open: false, branch: 'ag', focus: '', confirm: '', sig: '', timer: 0, msg: '', bodyEl: null, headEl: null };
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

// ───────── 繪製 ─────────
function tuHeadHtml() {
  var s = techState(), labs = techLabCount(), cap = techLabCap(), slots = techSlots(), coin = (typeof world !== 'undefined' && world.res && world.res.coin) || 0, e = techEra();
  var h = '<div class="tu-top"><b>📜 科技樹</b><span class="tu-sp"></span><button class="tu-x" data-tu="close">✕</button></div>';
  h += '<div class="tu-res"><span>金 ' + Math.floor(coin) + '</span><span>學識 ' + Math.floor(s.xue) + '</span><span>時代 ' + e + (tuEraName(e) ? '〈' + tuEraName(e) + '〉' : '') + '</span><span>研究院 ' + labs + '/' + cap + '　槽位 ' + slots + '</span></div>';
  if (labs <= 0) h += '<div class="tu-warn">需建研究院才能研發<button data-tu="buildlab">去建研究院</button></div>';
  else if (slots < s.cur.length + 1 && !s.cur.length) h += '<div class="tu-warn">研究院槽位 0,請檢查研究院數量上限</div>';
  if (tu.msg) h += '<div class="tu-msg">' + tuEsc(tu.msg) + '</div>';
  h += '<div class="tu-qh">研發序列(進行中 ' + s.cur.length + '/' + Math.max(slots, s.cur.length) + ',排隊 ' + s.queue.length + '/' + TECH_QUEUE_MAX + ')</div>';
  if (!s.cur.length && !s.queue.length) h += '<div class="tu-empty">序列是空的。到下方挑一項點「研發」。</div>';
  s.cur.forEach(function (c) {
    var n = techNode(c.id), pct = c.total > 0 ? Math.max(0, Math.min(100, Math.round((1 - c.left / c.total) * 100))) : 0;
    h += '<div class="tu-q cur"><div class="tu-qn">⏳ ' + tuEsc(n ? n.name : c.id) + '<small> 剩 ' + techFmtTime(c.left) + '</small></div><div class="tu-bar"><i style="width:' + pct + '%"></i></div>';
    if (tu.confirm === c.id) h += '<div class="tu-cf">' + tuEsc(techCancelHint(c.id)) + '<button data-tu="cancelyes" data-id="' + c.id + '">確定取消</button><button data-tu="cancelno">不取消</button></div>';
    else h += '<button data-tu="cancel" data-id="' + c.id + '">取消</button>';
    h += '</div>';
  });
  s.queue.forEach(function (id, i) {
    var n = techNode(id), wait = techCanStart(id) ? '' : '(等待)';
    h += '<div class="tu-q"><div class="tu-qn">' + (i + 1) + '. ' + tuEsc(n ? n.name : id) + '<small> ' + wait + ' ' + tuDurText(techDurationOf(id)) + '</small></div>';
    if (tu.confirm === id) h += '<div class="tu-cf">' + tuEsc(techCancelHint(id)) + '<button data-tu="cancelyes" data-id="' + id + '">確定移除</button><button data-tu="cancelno">不移除</button></div>';
    else h += (i > 0 ? '<button data-tu="up" data-id="' + id + '">上移</button>' : '') + '<button data-tu="cancel" data-id="' + id + '">取消</button>';
    h += '</div>';
  });
  return h;
}

function tuCardHtml(n) {
  var st = techUiState(n.id), h, un = techUiUnlockNames(n), act = '', cls = 'tu-n ' + st.k + (tu.focus === n.id ? ' focus' : '');
  h = '<div class="' + cls + '" data-node="' + n.id + '"><div class="tu-nh"><b>' + tuEsc(n.name) + '</b><span class="tu-era">第' + n.era + '階</span><span class="tu-st ' + st.k + '">' + TU_STATE_TXT[st.k] + '</span></div>';
  if (n.desc) h += '<div class="tu-d">' + tuEsc(n.desc) + '</div>';
  if (st.k === 'mega') {
    h += '<div class="tu-c">條件:' + tuEsc((n.cost && n.cost.goodsText) || '大工程達成') + '</div><div class="tu-d">里程碑不走研發序列,由大工程完成後記入。</div>';
  } else {
    h += '<div class="tu-c">' + tuEsc(tuCostText(n.id)) + '　時長 ' + tuDurText(techDurationOf(n.id)) + '</div>';
  }
  if (un.length) h += '<div class="tu-u">解鎖:' + tuEsc(un.join('、')) + '</div>';
  if (st.k === 'req') h += '<div class="tu-lk">前置未滿:' + tuEsc(st.miss.join('、')) + '</div>';
  if (st.k === 'era') h += '<div class="tu-lk">第 ' + n.era + ' 時代尚未開放(需前一時代研完 ' + techEraNeed(n.era).k + ' 項' + (techEraNeed(n.era).groups ? ' 與里程碑' : '') + ')</div>';
  if (st.k === 'ready') act = '<button data-tu="add" data-id="' + n.id + '">研發</button>';
  else if (st.k === 'req') act = '<button data-tu="addto" data-id="' + n.id + '">研發到這裡</button>';
  h += act + '</div>';
  return h;
}
function tuBodyHtml() {
  var h = '<div class="tu-tabs">', list, e, any;
  TECH_BRANCHES.forEach(function (b) {
    var done = 0, tot = 0;
    CITY_TECHS.forEach(function (n) { if (n.branch === b.id) { tot++; if (techDone(n.id)) done++; } });
    h += '<button class="tu-tab' + (tu.branch === b.id ? ' on' : '') + '" data-tu="tab" data-id="' + b.id + '">' + tuEsc(b.name) + '<small> ' + done + '/' + tot + '</small></button>';
  });
  h += '</div><div class="tu-list">';
  list = CITY_TECHS.filter(function (n) { return n.branch === tu.branch; });
  for (e = 1; e <= 5; e++) {
    var cards = list.filter(function (n) { return n.era === e; });
    if (!cards.length) continue;
    h += '<div class="tu-eh">第 ' + e + ' 時代' + (tuEraName(e) ? '〈' + tuEraName(e) + '〉' : '') + (techEraOpen(e) ? '' : '(未開放)') + '</div>';
    cards.forEach(function (n) { h += tuCardHtml(n); });
    any = true;
  }
  if (!any) h += '<div class="tu-empty">此分支沒有節點</div>';
  return h + '</div>';
}
function techUiHtml() { return tuHeadHtml() + tuBodyHtml(); }

function tuSig() {
  var s = techState();
  return [Object.keys(s.done).length, s.cur.map(function (c) { return c.id; }).join(','), s.queue.join(','), techEra(), techLabCount(), tu.branch, tu.confirm, tu.msg, tu.focus].join('|');
}
function tuRender(force) {
  if (!tu.el) return;
  var sg = tuSig();
  if (tu.headEl) tu.headEl.innerHTML = tuHeadHtml();
  if (tu.bodyEl && (force || sg !== tu.sig)) tu.bodyEl.innerHTML = tuBodyHtml();
  tu.sig = sg;
}

// ───────── 動作 ─────────
var TU_WHY = { full: '序列已滿', era: '該時代尚未開放', mega: '里程碑不能研發', done: '已經研完', unknown: '找不到該科技', cycle: '科技資料有誤', nostate: '尚未就緒' };
function techUiAct(act, id) {
  var r, n;
  tu.msg = '';
  if (act === 'close') { techPanelClose(); return; }
  if (act === 'tab') { tu.branch = id; tu.focus = ''; tuRender(true); return; }
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
  techUiAct(b.getAttribute('data-tu'), b.getAttribute('data-id') || '');
}

// ───────── 面板 ─────────
var TU_CSS = '#techTreePanel{position:fixed;left:50%;top:6%;transform:translateX(-50%);width:min(560px,96vw);max-height:88vh;display:flex;flex-direction:column;background:rgba(24,20,14,.97);color:#f1e6cf;border:1px solid #8a6d3b;border-radius:10px;z-index:41;font-size:13px}' +
  '#techTreePanel[hidden]{display:none}#techTreePanel button{background:#4a3a20;color:#f1e6cf;border:1px solid #8a6d3b;border-radius:6px;padding:4px 8px;margin:2px;font-size:12px}' +
  '#techTreePanel .tu-head{padding:8px 10px;border-bottom:1px solid #5a4727;max-height:38vh;overflow:auto}#techTreePanel .tu-body{flex:1;overflow:auto;padding:6px 8px;-webkit-overflow-scrolling:touch}' +
  '.tu-top{display:flex;align-items:center}.tu-sp{flex:1}.tu-res{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0}.tu-warn{color:#ffb4a0;margin:4px 0}.tu-msg{color:#9fe0a0;margin:4px 0}' +
  '.tu-qh{margin-top:6px;font-weight:bold}.tu-q{display:flex;flex-wrap:wrap;align-items:center;gap:4px;border-top:1px dashed #5a4727;padding:3px 0}.tu-qn{flex:1;min-width:140px}.tu-bar{width:100%;height:5px;background:#3a2f1a;border-radius:3px}.tu-bar i{display:block;height:100%;background:#f0b45a;border-radius:3px}.tu-cf{color:#ffd9a0;width:100%}.tu-empty{opacity:.7;padding:6px 0}' +
  '.tu-tabs{display:flex;overflow-x:auto;white-space:nowrap;gap:2px;position:sticky;top:0;background:rgba(24,20,14,.97);padding-bottom:4px}.tu-tab.on{background:#8a6d3b!important}.tu-tab small{opacity:.7}' +
  '.tu-eh{margin:8px 0 2px;color:#f0b45a;font-weight:bold}.tu-n{border:1px solid #5a4727;border-radius:8px;padding:6px 8px;margin:4px 0;background:rgba(255,255,255,.04)}.tu-n.done{opacity:.55}.tu-n.focus{outline:2px solid #f0b45a}' +
  '.tu-nh{display:flex;align-items:center;gap:6px}.tu-nh b{flex:1}.tu-era{opacity:.7;font-size:11px}.tu-st{font-size:11px;border-radius:8px;padding:0 6px;background:#3a2f1a}.tu-st.ready{background:#2f5a2f}.tu-st.done{background:#2a4a6a}.tu-st.cur,.tu-st.queued{background:#6a5a1a}' +
  '.tu-d,.tu-c,.tu-u,.tu-lk{margin-top:2px;opacity:.9}.tu-lk{color:#ffb4a0}.tu-u{color:#cfe3ff}';
function tuEnsure() {
  var st, el;
  if (tu.el) return tu.el;
  if (typeof document === 'undefined' || !document.createElement) return null;
  st = document.createElement('style'); st.id = 'techuiCss'; st.textContent = TU_CSS;
  if (document.head && document.head.appendChild) document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'techTreePanel'; el.hidden = true;
  tu.headEl = document.createElement('div'); tu.headEl.className = 'tu-head';
  tu.bodyEl = document.createElement('div'); tu.bodyEl.className = 'tu-body';
  el.appendChild(tu.headEl); el.appendChild(tu.bodyEl);
  el.addEventListener('click', tuOnClick);
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
  tu.msg = ''; tu.confirm = '';
  if (n) { tu.branch = n.branch; tu.focus = nodeId; } else tu.focus = '';
  if (el && typeof panelOpen === 'function') panelOpen('techtree');
  tu.open = true;
  if (el) el.hidden = false;
  tuRender(true);
  if (n && tu.bodyEl && tu.bodyEl.querySelector) {
    var c = tu.bodyEl.querySelector('[data-node="' + nodeId + '"]');
    if (c && c.scrollIntoView) { try { c.scrollIntoView({ block: 'center' }); } catch (e) { /* 略過 */ } }
  }
  if (!tu.timer && typeof setInterval === 'function') tu.timer = setInterval(function () { if (tu.open) tuRender(false); }, 1000);
  return true;
}
function techPanelClose() {
  if (!tu.open) return;
  if (typeof panelClose === 'function' && typeof panelIsOpen === 'function' && panelIsOpen('techtree')) panelClose('techtree');
  else tuHide();
}
function techPanelToggle() { if (tu.open) techPanelClose(); else techPanelOpen(); }
