// js/caravanui.js — 走鏢面板:馬車(買 / 選用)、出車(路線 + 鏢師 + 報價)、鏢師名冊與今日招募、最近戰果。邏輯在 caravan.js,資料在 caravan_goods.js。
// 入口:右側邊欄「走鏢」(ui.js UI_SIDE_ITEMS key 'caravan',點 #btnCaravan);功能閘 NL_FEATURE_GATE.caravan(郵驛科技;出車另需驛站 + 道路連城門,見 caravanPrereq)。面板以 panelmgr 登錄為 big 面板。
// ES2017;不用 ?. ??。

var caravanPanelOpen = false;
var cvUi = { cart: 'white', route: 'near', esc: [] };
var cvSig = '';

function cvEsc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
function cvTime(ms) {
  var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60);
  return m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
}
function cvItemsText(items) {
  var parts = [];
  Object.keys(items).sort(function (a, b) { return goodsTier(b) - goodsTier(a); }).forEach(function (id) {
    parts.push((GOODS[id] ? goodsIcon(id) : '') + goodsName(id) + '×' + items[id]);
  });
  return parts.length ? parts.join(' ') : '(空手而回)';
}
function cvCoin() { return (typeof world !== 'undefined' && world && world.res && world.res.coin) || 0; }
function cvPct(x) { return Math.round(x * 100) + '%'; }

// 讓選取狀態保持合法:車要擁有、鏢師要在名冊且閒置、數量不超過車位
function cvFixSel() {
  var s = caravanGet(), c = caravanCart(cvUi.cart), busy = caravanBusyEscorts();
  if (!c || !s.carts[cvUi.cart]) cvUi.cart = 'white';
  if (!caravanRoute(cvUi.route)) cvUi.route = CARAVAN_ROUTES[0].id;
  c = caravanCart(cvUi.cart);
  cvUi.esc = cvUi.esc.filter(function (id) { return s.roster.indexOf(id) >= 0 && !busy[id]; }).slice(0, c.slots);
}

function caravanPanelHtml() {
  var s = caravanGet(), now = Date.now(), h = '', busy = caravanBusyEscorts(), c, q, trip, pre = caravanPrereq();
  cvFixSel();
  c = caravanCart(cvUi.cart);
  h += '<button class="close" data-cv="close" title="關閉">✕</button><b>🛻 ' + cvEsc(caravanOfficeName()) + '</b>';
  if (!pre.ok) h += '<div class="cvsub" data-cv-pre="1" style="color:#c0392b"><b>暫時不能出車</b>:' + cvEsc(pre.reason) + '。(已在路上的車隊照常結算。)</div>';
  h += '<div class="cvsub">今日車次 ' + (CARAVAN_DAILY_MAX - caravanLeft(now)) + ' / ' + CARAVAN_DAILY_MAX + ' · 金幣 ' + cvCoin() + '。高階貨品(T1~T4)由走鏢帶回,品階機率只看馬車品階。</div>';

  h += '<div class="cvh">馬車</div>';
  CARAVAN_CARTS.forEach(function (k) {
    var own = !!s.carts[k.id], tr = caravanTrip(k.id), odds = caravanOdds(k.id);
    h += '<div class="cvrow' + (own && k.id === cvUi.cart ? ' sel' : '') + '"><span class="cvsw" style="background:' + k.color + '"></span><b>' + k.name + '</b> ' + cvEsc(caravanCartTitle(k)) +
      '<small>T1~T4 ' + odds.map(cvPct).join(' / ') + ' · 抽 ' + k.draws + ' · ' + caravanEscortTitle() + ' ' + k.slots + '</small>';
    if (tr) h += '<span class="cvr" data-cvt="' + tr.t1 + '">路上 ' + cvTime(tr.t1 - now) + '</span>';
    else if (own) h += '<button class="cvmini" data-cv="cart" data-k="' + k.id + '">' + (k.id === cvUi.cart ? '已選' : '選用') + '</button>';
    else h += '<button class="cvmini" data-cv="buy" data-k="' + k.id + '"' + (cvCoin() < k.cost ? ' disabled' : '') + '>購買 ' + k.cost + '</button>';
    h += '</div>';
  });

  h += '<div class="cvh">出車:' + c.name + '車</div>';
  trip = caravanTrip(c.id);
  if (trip) h += '<div class="cvsub">這輛車還在路上。</div>';
  else {
    h += '<div class="cvrow">';
    CARAVAN_ROUTES.forEach(function (r) {
      h += '<button class="cvmini' + (r.id === cvUi.route ? ' on' : '') + '" data-cv="route" data-k="' + r.id + '">' + cvEsc(caravanRouteName(r)) + '</button>';
    });
    h += '</div>';
    h += '<div class="cvsub">' + caravanEscortTitle() + '(最多 ' + c.slots + ' 位):</div><div class="cvrow">';
    var any = false;
    s.roster.forEach(function (id) {
      if (busy[id]) return;
      any = true;
      h += '<button class="cvmini' + (cvUi.esc.indexOf(id) >= 0 ? ' on' : '') + '" data-cv="esc" data-k="' + id + '">' + cvEsc(caravanEscortName(id)) + ' 戰' + caravanEscortPower(id) + '</button>';
    });
    if (!any) h += '<span class="cvsub">沒有閒置的鏢師(可空車上路,風險較高)</span>';
    h += '</div>';
    q = caravanQuote(c.id, cvUi.route, cvUi.esc);
    h += '<div class="cvsub">保鑣費 ' + q.fee + '(路線 ' + q.route + ' + 鏢師 ' + q.wage + ') · 路程 ' + cvTime(q.sec * 1000) + ' · 受阻機率 ' + cvPct(q.pFail) +
      '(建議戰力 ' + caravanRoute(cvUi.route).power + ',目前 ' + q.power + ')。護衛與路線只影響帶回的件數。</div>';
    h += '<button class="cvgo" data-cv="go"' + (cvCoin() < q.fee || caravanLeft(now) <= 0 || !pre.ok ? ' disabled' : '') + '>出發</button>';
  }

  h += '<div class="cvh">' + caravanEscortTitle() + '名冊 ' + s.roster.length + ' / ' + CARAVAN_ROSTER_MAX + '</div>';
  if (!s.roster.length) h += '<div class="cvsub">還沒有鏢師,從下面的今日招募請人。</div>';
  s.roster.forEach(function (id) {
    h += '<div class="cvrow"><img src="' + caravanEscortImg(id) + '" alt="" loading="lazy"><b>' + cvEsc(caravanEscortName(id)) + '</b> 戰力 ' + caravanEscortPower(id) + '(' + caravanEscortGrade(caravanEscortPower(id)) + ')' +
      '<small>出勤費 ' + caravanEscortWage(id) + '</small>' +
      (busy[id] ? '<span class="cvr">出勤中</span>' : '<button class="cvmini" data-cv="fire" data-k="' + id + '">解僱</button>') + '</div>';
  });

  h += '<div class="cvh">今日招募</div>';
  var pool = caravanPoolToday(now);
  if (!pool.length) h += '<div class="cvsub">今天的候選都已是自己人。</div>';
  pool.forEach(function (id) {
    var cost = caravanEscortHire(id);
    h += '<div class="cvrow"><img src="' + caravanEscortImg(id) + '" alt="" loading="lazy"><b>' + cvEsc(caravanEscortName(id)) + '</b> 戰力 ' + caravanEscortPower(id) + '(' + caravanEscortGrade(caravanEscortPower(id)) + ')' +
      '<button class="cvmini" data-cv="hire" data-k="' + id + '"' + (cvCoin() < cost || s.roster.length >= CARAVAN_ROSTER_MAX ? ' disabled' : '') + '>僱用 ' + cost + '</button></div>';
  });

  h += '<div class="cvh">最近戰果</div>';
  if (!s.log.length) h += '<div class="cvsub">還沒有走過鏢。</div>';
  s.log.slice().reverse().forEach(function (e) {
    h += '<div class="cvsub"><b>' + cvEsc(caravanCart(e.cart).name) + '車 · ' + cvEsc(caravanRouteName(caravanRoute(e.route))) + ' · ' + CARAVAN_OUTCOMES[e.outcome].name + '</b><br>' + cvEsc(cvItemsText(e.items)) + '</div>';
  });
  return h;
}

function caravanSig() {
  var s = caravanGet();
  return s.trips.length + '|' + s.log.length + '|' + s.roster.length + '|' + (caravanPrereq().reason || 'ok');
}
function caravanPanelRender() {
  if (typeof document === 'undefined') return;
  var el = document.getElementById('caravanPanel');
  if (!el) return;
  el.hidden = !caravanPanelOpen;
  if (!caravanPanelOpen) return;
  var top = el.scrollTop;
  el.innerHTML = caravanPanelHtml();
  el.scrollTop = top;
  cvSig = caravanSig();
}
function caravanPanelToggle(open) {
  caravanPanelOpen = open === undefined ? !caravanPanelOpen : !!open;
  caravanPanelRender();
  if (caravanPanelOpen) { if (typeof panelOpen === 'function') panelOpen('caravan'); } else if (typeof panelClose === 'function') panelClose('caravan');
}
function cvToast(msg) { if (typeof showToast === 'function') { try { showToast(msg); } catch (e) { /* 略過 */ } } }
function caravanPanelClick(e) {
  var t = e.target && e.target.closest ? e.target.closest('[data-cv]') : null;
  if (!t || t.disabled) return;
  var a = t.getAttribute('data-cv'), k = t.getAttribute('data-k'), r;
  if (a === 'close') { caravanPanelToggle(false); return; }
  if (a === 'cart') { cvUi.cart = k; cvUi.esc = []; }
  else if (a === 'route') cvUi.route = k;
  else if (a === 'esc') {
    var id = Number(k), i = cvUi.esc.indexOf(id);
    if (i >= 0) cvUi.esc.splice(i, 1);
    else if (cvUi.esc.length < caravanCart(cvUi.cart).slots) cvUi.esc.push(id);
    else cvToast('這輛車最多派 ' + caravanCart(cvUi.cart).slots + ' 位鏢師');
  } else if (a === 'buy') { r = caravanBuyCart(k); if (r.ok) { cvUi.cart = k; cvUi.esc = []; cvToast('買下' + caravanCart(k).name + '車'); } else cvToast(r.reason); }
  else if (a === 'hire') { r = caravanHire(Number(k)); cvToast(r.ok ? '僱用 ' + caravanEscortName(Number(k)) : r.reason); }
  else if (a === 'fire') { r = caravanDismiss(Number(k)); if (!r.ok) cvToast(r.reason); }
  else if (a === 'go') {
    r = caravanStart(cvUi.cart, cvUi.route, cvUi.esc.slice());
    if (r.ok) { cvUi.esc = []; cvToast('車隊從驛站出發,保鑣費 ' + r.fee); } else cvToast(r.reason);
  }
  if (typeof updateResBar === 'function' && (a === 'buy' || a === 'hire' || a === 'go')) { try { updateResBar(); } catch (e2) { /* 略過 */ } }
  caravanPanelRender();
}

function caravanUiInit() {
  if (typeof document === 'undefined' || !document.getElementById || !document.createElement || !document.body) return;
  try {
    if (document.getElementById('caravanPanel')) return;
    var css = document.createElement('style');
    css.id = 'caravanCss';
    css.textContent = '#caravanPanel{position:fixed;top:calc(40px + env(safe-area-inset-top));right:calc(var(--side-w) + 6px);width:min(360px,calc(100vw - var(--side-w) - 16px));max-height:70vh;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;z-index:3;padding:10px;border-radius:10px;background:rgba(20,26,36,.94);box-shadow:0 4px 16px rgba(0,0,0,.4);font-size:13px}' +
      '#caravanPanel[hidden]{display:none}#caravanPanel .close{position:sticky;top:0;float:right;background:rgba(20,26,36,.9);border:none;padding:2px 8px;min-height:32px}' +
      '#caravanPanel .cvh{margin-top:10px;padding-top:4px;border-top:1px solid rgba(255,255,255,.15);opacity:.75;font-size:12px}#caravanPanel .cvsub{margin-top:4px;font-size:12px;opacity:.88}' +
      '#caravanPanel .cvrow{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:5px;padding:2px 4px;border-radius:6px}#caravanPanel .cvrow.sel{background:rgba(240,180,90,.14)}' +
      '#caravanPanel .cvrow small{flex:0 0 100%;opacity:.7;font-size:11px}#caravanPanel .cvrow img{width:40px;height:40px;border-radius:6px;object-fit:cover}' +
      '#caravanPanel .cvsw{display:inline-block;width:14px;height:14px;border-radius:3px}#caravanPanel .cvr{margin-left:auto;color:#f0b45a}' +
      '#caravanPanel .cvmini{min-height:34px;padding:2px 10px;font-size:12px;margin-left:auto}#caravanPanel .cvrow .cvmini+.cvmini{margin-left:0}#caravanPanel .cvmini.on{background:#c9892f;border-color:#f0b45a;color:#1b1308}' +
      '#caravanPanel .cvgo{width:100%;min-height:42px;margin-top:8px;font-size:15px;background:#c9892f;border-color:#f0b45a;color:#1b1308}#caravanPanel .cvgo:disabled,#caravanPanel .cvmini:disabled{opacity:.4}';
    document.head.appendChild(css);
    var panel = document.createElement('div');
    panel.id = 'caravanPanel';
    panel.hidden = true;
    panel.addEventListener('click', caravanPanelClick);
    document.body.appendChild(panel);
    var btn = document.createElement('button');
    btn.id = 'btnCaravan';
    btn.title = '走鏢';
    btn.textContent = '走鏢';
    btn.hidden = true;
    btn.style.display = 'none';   // 入口在右側邊欄(ui.js UI_SIDE_ITEMS 'caravan' 代為 click);頂列不顯示
    btn.addEventListener('click', function () { caravanPanelToggle(); });
    var top = document.getElementById('topbar');
    if (top) top.appendChild(btn);
    var sync = function () { if (!document.hidden) btn.hidden = !(typeof isUnlocked === 'function' && isUnlocked('feature', 'caravan')); };
    sync();
    setInterval(sync, 1000);
    setInterval(function () {
      if (!caravanPanelOpen || document.hidden) return;
      if (caravanSig() !== cvSig) { caravanPanelRender(); return; }
      var now = Date.now();
      Array.prototype.forEach.call(panel.querySelectorAll('[data-cvt]'), function (n) { n.textContent = '路上 ' + cvTime(Number(n.getAttribute('data-cvt')) - now); });
    }, 1000);
    if (typeof panelRegister === 'function') panelRegister('caravan', { kind: 'big', elId: 'caravanPanel', close: function () { caravanPanelToggle(false); } });
  } catch (e) { if (typeof console !== 'undefined') console.warn('[caravan] UI 初始化失敗', e); }
}
if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', caravanUiInit);
  else caravanUiInit();
}
