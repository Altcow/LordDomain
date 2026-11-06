// js/caravanui.js — 走鏢面板:路線地圖(本城 → 各目的地,選節點出車;出隊中的車以小車圖示沿線走去程、回程)、出車(馬車 + 鏢師 + 報價)、路上車隊、
//   馬車(同品階可多輛,受車棚上限)、鏢師名冊與今日招募、最近戰果。邏輯在 caravan.js,資料在 caravan_goods.js。
// 入口:右側邊欄「走鏢」(ui.js UI_SIDE_ITEMS key 'caravan',點 #btnCaravan);功能閘 NL_FEATURE_GATE.caravan(郵驛科技;出車另需驛站 + 道路連城門,見 caravanPrereq)。面板以 panelmgr 登錄為 big 面板。
// 地圖:SVG 程式繪製(扁平色塊 + 墨線);面板關著不更新;開著時每秒更新倒數與小車位置(省電模式每 5 秒移動一次小車)。去程到目的地後,回程沿同一路線走回本城(淡色鏡像小車),抵達本城才不再畫,時間照走到結算。
// ES2017;不用 ?. ??。

var caravanPanelOpen = false;
var cvUi = { cart: 'white', route: 'near', esc: [] };
var cvSig = '';
var cvTickN = 0;

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
function cvRouteLabel(r) { var t = caravanRouteTown(r); return caravanRouteName(r) + (t ? '(' + t + ')' : ''); }

// 讓選取狀態保持合法:車要擁有(優先選有閒置的品階)、路線存在、鏢師要在名冊且閒置、數量不超過車位
function cvFixSel() {
  var s = caravanGet(), c = caravanCart(cvUi.cart), busy = caravanBusyEscorts(), i;
  if (!c || !s.carts[cvUi.cart] || !caravanCartFree(cvUi.cart)) {
    if (!c || !s.carts[cvUi.cart]) cvUi.cart = 'white';
    for (i = 0; i < CARAVAN_CARTS.length; i++) if (!caravanCartFree(cvUi.cart) && caravanCartFree(CARAVAN_CARTS[i].id)) cvUi.cart = CARAVAN_CARTS[i].id;
  }
  if (!caravanRoute(cvUi.route)) cvUi.route = CARAVAN_ROUTES[0].id;
  c = caravanCart(cvUi.cart);
  cvUi.esc = cvUi.esc.filter(function (id) { return s.roster.indexOf(id) >= 0 && !busy[id]; }).slice(0, c.slots);
}

// 地圖上小車的位置:去程進度 f 沿路線;同一路線多趟時依序號往法線方向錯開
// 回程走另一側(ret = true),與去程的車不疊在同一條線上
function cvCarXY(routeId, f, k, ret) {
  var p = caravanMapPos(routeId, f), q = caravanMapPos(routeId, Math.min(1, f + 0.02)), dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy) || 1, o = (k % 3) * 7 - 7;
  if (ret) o = -o;
  return [Math.round((p[0] - dy / L * o) * 10) / 10, Math.round((p[1] + dx / L * o) * 10) / 10];
}
function cvTripKey(t) { return t.cart + '|' + (t.no || 1) + '|' + t.t0; }

// 回程小車:鏡像(朝向本城)並淡化
function cvRetAttr(ret) { return ret ? ' transform="scale(-1,1)" opacity=".55"' : ''; }
function caravanMapSvg(s, now) {
  var M = CARAVAN_MAP, h = '', hallLv = caravanHall().lv, perRoute = {};
  h += '<svg class="cvsvg" viewBox="0 0 ' + M.w + ' ' + M.h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="走鏢路線地圖">';
  h += '<rect x="2" y="2" width="' + (M.w - 4) + '" height="' + (M.h - 4) + '" rx="10" fill="#e8dfc6" stroke="#6b5a40" stroke-width="2"/>';
  // 地景:遠山、河、林(純裝飾)
  h += '<path d="M8 150 Q60 140 96 160 T190 150 T312 140" fill="none" stroke="#9fbcc0" stroke-width="7" stroke-linecap="round" opacity=".75"/>';
  h += '<polygon points="140,52 158,26 176,52" fill="#c9bb98"/><polygon points="162,54 184,22 208,54" fill="#b8a982"/><polygon points="34,150 48,128 62,150" fill="#c9bb98"/>';
  h += '<circle cx="110" cy="176" r="7" fill="#a9b98a"/><circle cx="122" cy="182" r="6" fill="#98aa7a"/><circle cx="292" cy="96" r="7" fill="#a9b98a"/>';
  CARAVAN_ROUTES.forEach(function (r) {
    var open = hallLv >= (r.hall || 1), on = r.id === cvUi.route;
    h += '<path class="cvln' + (on ? ' on' : '') + (open ? '' : ' lock') + '" d="M' + M.hx + ' ' + M.hy + ' Q' + r.cx + ' ' + r.cy + ' ' + r.mx + ' ' + r.my + '" fill="none" stroke="' + (on ? '#8a2f1c' : (open ? '#4a3d2c' : '#9a917e')) + '" stroke-width="' + (on ? 4 : 2.5) + '"' + (open ? '' : ' stroke-dasharray="5 5"') + ' stroke-linecap="round"/>';
  });
  // 本城
  h += '<g class="cvhome"><rect x="' + (M.hx - 15) + '" y="' + (M.hy - 13) + '" width="30" height="24" rx="4" fill="#8a2f1c" stroke="#3b2a1a" stroke-width="2"/>' +
    '<polygon points="' + (M.hx - 19) + ',' + (M.hy - 12) + ' ' + M.hx + ',' + (M.hy - 25) + ' ' + (M.hx + 19) + ',' + (M.hy - 12) + '" fill="#3b2a1a"/>' +
    '<text x="' + M.hx + '" y="' + (M.hy + 4) + '" text-anchor="middle" font-size="12" fill="#fbe9c4" font-weight="bold">本城</text></g>';
  // 目的地節點(整個 g 可點;透明大圓當觸控區,直徑約 48 單位)
  CARAVAN_ROUTES.forEach(function (r, idx) {
    var open = hallLv >= (r.hall || 1), on = r.id === cvUi.route, town = caravanRouteTown(r) || caravanRouteName(r), ly = r.my > M.hy ? r.my + 27 : r.my - 32;   // 標籤放在遠離本城的一側,不壓路線
    h += '<g class="cvnd' + (on ? ' on' : '') + (open ? '' : ' lock') + '" data-cv="route" data-k="' + r.id + '" role="button" aria-label="' + cvEsc(cvRouteLabel(r)) + '">' +
      '<circle cx="' + r.mx + '" cy="' + r.my + '" r="28" fill="transparent"/>' +
      '<circle cx="' + r.mx + '" cy="' + r.my + '" r="' + (on ? 13 : 11) + '" fill="' + (open ? (on ? '#d9a441' : '#f4ecd6') : '#cfc6b0') + '" stroke="' + (on ? '#8a2f1c' : '#4a3d2c') + '" stroke-width="' + (on ? 3 : 2) + '"/>' +
      '<text x="' + r.mx + '" y="' + (r.my + 4) + '" text-anchor="middle" font-size="11" fill="#3b2a1a" font-weight="bold">' + (open ? (idx + 1) : '🔒') + '</text>' +
      '<text x="' + r.mx + '" y="' + ly + '" text-anchor="middle" font-size="12" fill="' + (open ? '#2c2116' : '#7d7462') + '" font-weight="bold">' + cvEsc(town) + '</text>' +
      '<text x="' + r.mx + '" y="' + (ly + 12) + '" text-anchor="middle" font-size="9.5" fill="#5a4a34">' + (open ? '險' + cvPct(r.risk) + ' · 件×' + r.yieldMul : '鏢局 Lv' + r.hall + ' 開放') + '</text></g>';
  });
  // 出隊中的小車(去程與回程都畫;回程為淡色鏡像小車,表示載貨返回;抵達本城後不畫)
  s.trips.forEach(function (t) {
    var tr = { t0: t.t0, t1: t.t1 }, f = caravanMapGo(tr, now), ret = caravanMapRet(tr, now), c = caravanCart(t.cart), k = perRoute[t.route] = (perRoute[t.route] || 0) + 1, xy = cvCarXY(t.route, f < 0 ? 1 : f, k - 1, ret);
    h += '<g class="cvcar" data-cvm="' + cvEsc(cvTripKey(t)) + '" data-r="' + t.route + '" data-k2="' + (k - 1) + '" data-t0="' + t.t0 + '" data-t1="' + t.t1 + '" transform="translate(' + xy[0] + ',' + xy[1] + ')"' + (f < 0 ? ' visibility="hidden"' : '') + '><g' + cvRetAttr(ret) + '>' +
      '<rect x="-9" y="-9" width="18" height="10" rx="2" fill="' + (c ? c.color : '#d8d8d8') + '" stroke="#2c2116" stroke-width="1.5"/>' +
      '<circle cx="-5" cy="3" r="3" fill="#2c2116"/><circle cx="5" cy="3" r="3" fill="#2c2116"/>' +
      '<circle cx="13" cy="-4" r="3.2" fill="#7a4a2a" stroke="#2c2116" stroke-width="1"/>' +
      (t.esc.length ? '<circle cx="-14" cy="-3" r="3" fill="#d9a77a" stroke="#2c2116" stroke-width="1"/>' : '') + '</g></g>';
  });
  return h + '</svg>';
}

// 出發鈕為何不能按(空字串 = 可出發)
function cvWhy(s, now, pre, q, r) {
  var hall = caravanHall();
  if (!pre.ok) return pre.reason;
  if (!caravanRouteOpen(r.id)) return '這條路線要鏢局 Lv' + r.hall + ' 才開放';
  if (s.trips.length >= hall.trips) return '同時出隊已達上限(' + hall.trips + ' 隊),等車隊回來,或提升鏢局等級';
  if (!caravanCartFree(cvUi.cart)) return '這種車都在路上,換一輛閒置的車';
  if (caravanLeft(now) <= 0) return '今天的車次用完了';
  if (cvCoin() < q.fee) return '金幣不足(需 ' + q.fee + ')';
  return '';
}

function caravanPanelHtml() {
  var s = caravanGet(), now = Date.now(), h = '', busy = caravanBusyEscorts(), c, q, pre = caravanPrereq(), hall = caravanHall(), r, why, shed = caravanShedUsed();
  cvFixSel();
  c = caravanCart(cvUi.cart);
  r = caravanRoute(cvUi.route);
  h += '<button class="close" data-cv="close" title="關閉">✕</button><b>🛻 ' + cvEsc(caravanOfficeName()) + '</b>';
  if (!pre.ok) h += '<div class="cvsub" data-cv-pre="1" style="color:#e8735f"><b>暫時不能出車</b>:' + cvEsc(pre.reason) + '。(已在路上的車隊照常結算。)</div>';
  h += '<div class="cvsub">鏢局 Lv' + hall.lv + ' · 同時出隊 ' + s.trips.length + ' / ' + hall.trips + ' · 車棚 ' + shed + ' / ' + hall.shed + ' · 今日車次 ' + (CARAVAN_DAILY_MAX - caravanLeft(now)) + ' / ' + CARAVAN_DAILY_MAX + ' · 金幣 ' + cvCoin() + '</div>';

  h += '<div class="cvtop"><div class="cvmap" data-cv-map="1">' + caravanMapSvg(s, now) + '</div><div class="cvside">';
  // 目的地切換(地圖節點之外的大按鈕,方便觸控)
  h += '<div class="cvrow cvdest">';
  CARAVAN_ROUTES.forEach(function (x) {
    var open = caravanRouteOpen(x.id);
    h += '<button class="cvmini' + (x.id === cvUi.route ? ' on' : '') + (open ? '' : ' lock') + '" data-cv="route" data-k="' + x.id + '">' + cvEsc(caravanRouteTown(x) || caravanRouteName(x)) + (open ? '' : ' 🔒') + '</button>';
  });
  h += '</div>';
  h += '<div class="cvh">目的地:' + cvEsc(cvRouteLabel(r)) + '</div>';
  if (!caravanRouteOpen(r.id)) h += '<div class="cvsub">🔒 鏢局 Lv' + r.hall + ' 開放(目前 Lv' + hall.lv + ')。</div>';
  q = caravanQuote(c.id, r.id, cvUi.esc);
  h += '<div class="cvsub">路程 ' + cvTime(q.sec * 1000) + '(去回)· 路線費 ' + r.fee + ' · 基本風險 ' + cvPct(r.risk) + ' · 件數 ×' + r.yieldMul + ' · 建議戰力 ' + r.power + '</div>';
  h += '<div class="cvsub">馬車(灰 = 全在路上):</div><div class="cvrow">';
  CARAVAN_CARTS.forEach(function (k) {
    var n = caravanCartCount(k.id), fr;
    if (!n) return;
    fr = caravanCartFree(k.id);
    h += '<button class="cvmini' + (k.id === cvUi.cart ? ' on' : '') + '" data-cv="cart" data-k="' + k.id + '"' + (fr ? '' : ' disabled') + '><span class="cvsw" style="background:' + k.color + '"></span>' + k.name + ' 閒' + fr + '/' + n + '</button>';
  });
  h += '</div>';
  h += '<div class="cvsub">' + caravanEscortTitle() + '(' + c.name + '車最多 ' + c.slots + ' 位;出隊中的不能用):</div><div class="cvrow">';
  var any = false;
  s.roster.forEach(function (id) {
    if (busy[id]) return;
    any = true;
    h += '<button class="cvmini' + (cvUi.esc.indexOf(id) >= 0 ? ' on' : '') + '" data-cv="esc" data-k="' + id + '">' + cvEsc(caravanEscortName(id)) + ' 戰' + caravanEscortPower(id) + '</button>';
  });
  if (!any) h += '<span class="cvsub">沒有閒置的鏢師(可空車上路,風險較高)</span>';
  h += '</div>';
  h += '<div class="cvsub">保鑣費 ' + q.fee + '(路線 ' + q.route + ' + 鏢師 ' + q.wage + ') · 受阻機率 ' + cvPct(q.pFail) + '(目前戰力 ' + q.power + ')。護衛與路線只影響帶回的件數。</div>';
  why = cvWhy(s, now, pre, q, r);
  h += '<button class="cvgo" data-cv="go"' + (why ? ' disabled' : '') + '>出發 → ' + cvEsc(caravanRouteTown(r) || caravanRouteName(r)) + '</button>';
  if (why) h += '<div class="cvsub cvwhy">' + cvEsc(why) + '</div>';
  h += '</div></div>';

  h += '<div class="cvh">路上車隊 ' + s.trips.length + ' / ' + hall.trips + '</div>';
  if (!s.trips.length) h += '<div class="cvsub">目前沒有車隊在路上。</div>';
  s.trips.forEach(function (t) {
    var k = caravanCart(t.cart), rt = caravanRoute(t.route), names = t.esc.map(caravanEscortName).join('、');
    h += '<div class="cvrow cvtrip"><span class="cvsw" style="background:' + k.color + '"></span><b>' + k.name + '車 #' + (t.no || 1) + '</b> → ' + cvEsc(caravanRouteTown(rt) || caravanRouteName(rt)) +
      '<span class="cvr" data-cvt="' + t.t1 + '" data-cvt0="' + t.t0 + '">' + cvTripText(t, now) + '</span>' +
      '<small>' + (names ? caravanEscortTitle() + ' ' + cvEsc(names) : '趟子手押車') + '</small></div>';
  });

  h += '<div class="cvh">馬車 · 車棚 ' + shed + ' / ' + hall.shed + '(同品階可多輛)</div>';
  CARAVAN_CARTS.forEach(function (k) {
    var n = caravanCartCount(k.id), b = caravanCartBusy(k.id), odds = caravanOdds(k.id), price = caravanCartPrice(k.id);
    h += '<div class="cvrow' + (n && k.id === cvUi.cart ? ' sel' : '') + '"><span class="cvsw" style="background:' + k.color + '"></span><b>' + k.name + '</b> ' + cvEsc(caravanCartTitle(k)) +
      (n ? ' <span class="cvcnt">×' + n + (b ? '(路上 ' + b + ')' : '') + '</span>' : '') +
      '<small>T1~T4 ' + odds.map(cvPct).join(' / ') + ' · 抽 ' + k.draws + ' · ' + caravanEscortTitle() + ' ' + k.slots + '</small>';
    h += '<button class="cvmini" data-cv="buy" data-k="' + k.id + '"' + (cvCoin() < price || shed >= hall.shed ? ' disabled' : '') + '>' + (n ? '添購 ' : '購買 ') + price + '</button>';
    h += '</div>';
  });
  if (shed >= hall.shed) h += '<div class="cvsub">車棚已滿(' + hall.shed + ' 輛);提升鏢局等級可擴充。</div>';

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
function cvTripText(t, now) { return (now < (t.t0 + t.t1) / 2 ? '去程' : '回程') + ' · 歸來 ' + cvTime(t.t1 - now); }

function caravanSig() {
  var s = caravanGet();
  return s.trips.length + '|' + s.log.length + '|' + s.roster.length + '|' + caravanShedUsed() + '|' + caravanHall().lv + '|' + (caravanPrereq().reason || 'ok');
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
// 每秒:倒數文字;小車位置(省電模式每 5 秒一次)
function caravanPanelTick(panel, now) {
  cvTickN++;
  Array.prototype.forEach.call(panel.querySelectorAll('[data-cvt]'), function (n) {
    n.textContent = cvTripText({ t0: Number(n.getAttribute('data-cvt0')), t1: Number(n.getAttribute('data-cvt')) }, now);
  });
  if (typeof isPowerSave === 'function' && isPowerSave() && cvTickN % 5) return;
  Array.prototype.forEach.call(panel.querySelectorAll('[data-cvm]'), function (g) {
    var tr = { t0: Number(g.getAttribute('data-t0')), t1: Number(g.getAttribute('data-t1')) }, f = caravanMapGo(tr, now), ret = caravanMapRet(tr, now), xy, body = g.querySelector('g');
    if (f < 0) { g.setAttribute('visibility', 'hidden'); return; }
    xy = cvCarXY(g.getAttribute('data-r'), f, Number(g.getAttribute('data-k2')) || 0, ret);
    g.setAttribute('visibility', 'visible');
    g.setAttribute('transform', 'translate(' + xy[0] + ',' + xy[1] + ')');
    if (body) { body.removeAttribute('transform'); body.removeAttribute('opacity'); if (ret) { body.setAttribute('transform', 'scale(-1,1)'); body.setAttribute('opacity', '.55'); } }
  });
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
  else if (a === 'route') { cvUi.route = k; if (!caravanRouteOpen(k)) cvToast('這條路線要鏢局 Lv' + caravanRoute(k).hall + ' 才開放'); }
  else if (a === 'esc') {
    var id = Number(k), i = cvUi.esc.indexOf(id);
    if (i >= 0) cvUi.esc.splice(i, 1);
    else if (cvUi.esc.length < caravanCart(cvUi.cart).slots) cvUi.esc.push(id);
    else cvToast('這輛車最多派 ' + caravanCart(cvUi.cart).slots + ' 位鏢師');
  } else if (a === 'buy') { r = caravanBuyCart(k); if (r.ok) { cvUi.cart = k; cvUi.esc = []; cvToast('買下' + caravanCart(k).name + '車(共 ' + r.n + ' 輛)'); } else cvToast(r.reason); }
  else if (a === 'hire') { r = caravanHire(Number(k)); cvToast(r.ok ? '僱用 ' + caravanEscortName(Number(k)) : r.reason); }
  else if (a === 'fire') { r = caravanDismiss(Number(k)); if (!r.ok) cvToast(r.reason); }
  else if (a === 'go') {
    r = caravanStart(cvUi.cart, cvUi.route, cvUi.esc.slice());
    if (r.ok) { cvUi.esc = []; cvToast(caravanCart(cvUi.cart).name + '車 #' + r.no + ' 從驛站出發,保鑣費 ' + r.fee); } else cvToast(r.reason);
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
    css.textContent = '#caravanPanel{position:fixed;top:calc(40px + env(safe-area-inset-top));right:calc(var(--side-w) + 6px);width:min(360px,calc(100vw - var(--side-w) - 16px));max-height:76vh;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;z-index:4;padding:10px;border-radius:10px;background:rgba(20,26,36,.94);box-shadow:0 4px 16px rgba(0,0,0,.4);font-size:13px;box-sizing:border-box}' +
      '#caravanPanel[hidden]{display:none}#caravanPanel .close{position:sticky;top:0;float:right;background:rgba(20,26,36,.9);border:none;padding:2px 8px;min-height:44px;min-width:44px;z-index:1}' +
      '#caravanPanel .cvh{margin-top:10px;padding-top:4px;border-top:1px solid rgba(255,255,255,.15);opacity:.75;font-size:12px}#caravanPanel .cvsub{margin-top:4px;font-size:12px;opacity:.88;overflow-wrap:anywhere}' +
      '#caravanPanel .cvrow{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:5px;padding:2px 4px;border-radius:6px}#caravanPanel .cvrow.sel{background:rgba(240,180,90,.14)}' +
      '#caravanPanel .cvrow small{flex:0 0 100%;opacity:.7;font-size:11px}#caravanPanel .cvrow img{width:40px;height:40px;border-radius:6px;object-fit:cover}' +
      '#caravanPanel .cvsw{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:3px}#caravanPanel .cvr{margin-left:auto;color:#f0b45a}#caravanPanel .cvcnt{color:#f0b45a}' +
      '#caravanPanel .cvmini{min-height:44px;padding:2px 10px;font-size:12px;margin-left:auto}#caravanPanel .cvrow .cvmini+.cvmini{margin-left:0}#caravanPanel .cvmini.on{background:#c9892f;border-color:#f0b45a;color:#1b1308}#caravanPanel .cvmini.lock{opacity:.6}' +
      '#caravanPanel .cvdest .cvmini{margin-left:0;flex:1 1 0;min-width:0}#caravanPanel .cvwhy{color:#f0b45a}' +
      '#caravanPanel .cvgo{width:100%;min-height:46px;margin-top:8px;font-size:15px;background:#c9892f;border-color:#f0b45a;color:#1b1308}#caravanPanel .cvgo:disabled,#caravanPanel .cvmini:disabled{opacity:.4}' +
      '#caravanPanel .cvmap{margin-top:6px;clear:both}#caravanPanel .cvsvg{display:block;width:100%;height:auto;max-height:44vh;touch-action:pan-y}#caravanPanel .cvnd{cursor:pointer}' +
      '#caravanPanel .cvsvg text{font-family:inherit;pointer-events:none;user-select:none;-webkit-user-select:none}' +
      '@media (orientation:landscape) and (max-height:520px){#caravanPanel{width:min(680px,calc(100vw - var(--side-w) - 16px));max-height:calc(100vh - 125px - env(safe-area-inset-top))}' +
      '#caravanPanel .cvtop{display:flex;gap:10px;align-items:flex-start}#caravanPanel .cvtop .cvmap{flex:0 0 46%;position:sticky;top:0}#caravanPanel .cvtop .cvside{flex:1 1 0;min-width:0}#caravanPanel .cvsvg{max-height:calc(100vh - 150px)}}';
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
      caravanPanelTick(panel, Date.now());
    }, 1000);
    if (typeof panelRegister === 'function') panelRegister('caravan', { kind: 'big', elId: 'caravanPanel', close: function () { caravanPanelToggle(false); } });
  } catch (e) { if (typeof console !== 'undefined') console.warn('[caravan] UI 初始化失敗', e); }
}
if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', caravanUiInit);
  else caravanUiInit();
}
