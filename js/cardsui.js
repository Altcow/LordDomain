// js/cardsui.js — 卡牌與酒館 第一階段介面(PLAN_CARDS §2.3 名帖、§3A.6 卡面、§4.13.8 職業條、§7A 名額與請辭):招募頁(酒館 / 縣試 / 殿試三分頁)+ 名冊頁(列表 + 詳情)。
// 文字卡 v1:品階用「色(--gr0~--gr4)+ 品字 + 角飾數」三重表示;陣營字用墨色;頭像 = 職業行 emoji,名人預留外部立繪 assets/portraits/<id>.webp(缺圖回退 emoji)。
// 入口:點酒館 / 考場 / 殿試台建築(ui.js tapObjectAt → cardsUiTap);或 cardsUiOpen(tab)。面板走 panelmgr('cards');引擎在 cards.js,資料在 carddata.js。
// 不發聲、不推播、不紅點。ES2017;不用 ?. ??。
// 全域名稱:cardsUiOpen cardsUiClose cardsUiToggle cardsUiTap cardsUiRender cardsUiHtmlCard cardsUiCtx cardsUiFmtCd
var CU_TAB_NAME = { T: '酒館', E: '縣試', G: '殿試', R: '名冊' };
var CU_TYPE_TAB = { tavern: 'T', kao_chang: 'E', dian_shi_tai: 'G' };
var CU_ROW_ICON = { '農': '🌾', '工': '🔨', '商': '💰', '文': '📖', '醫': '💊', '政': '📜', '武': '⚔️' };
var cu = { open: false, tab: 'T', detail: null, confirm: null, el: null, timer: 0, msg: '' };

function cuEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function cardsUiFmtCd(ms) {
  var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  s = s % 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
function cardsUiCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuStyle';
  st.textContent = ':root{--gr0:#e9e4d6;--gr1:#3e8a74;--gr2:#365fa3;--gr3:#76489a;--gr4:#c39a2e;--cu-paper:#f4efe2;--cu-ink:#2a2620}' +
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--gr0:#5b574d;--gr1:#5fb39a;--gr2:#6a8fd0;--gr3:#a37bc6;--gr4:#e2c066;--cu-paper:#2c2922;--cu-ink:#ece6d6}}' +
    ':root[data-theme="dark"]{--gr0:#5b574d;--gr1:#5fb39a;--gr2:#6a8fd0;--gr3:#a37bc6;--gr4:#e2c066;--cu-paper:#2c2922;--cu-ink:#ece6d6}' +
    '#cardsPanel{position:fixed;top:calc(44px + env(safe-area-inset-top));left:6px;width:min(380px,calc(100vw - var(--side-w,48px) - 18px));max-height:78vh;display:flex;flex-direction:column;z-index:6;border-radius:10px;background:rgba(32,30,26,.97);color:#eee;box-shadow:0 4px 18px rgba(0,0,0,.5);font-size:14px}' +
    '#cardsPanel[hidden]{display:none}#cardsPanel .cuhd{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.12)}' +
    '#cardsPanel .cuhd b{flex:1;font-size:15px}#cardsPanel .cutab{border:none;border-radius:6px;padding:6px 8px;min-height:40px;background:rgba(255,255,255,.1);color:#eee}' +
    '#cardsPanel .cutab.on{background:#f0b45a;color:#222}#cardsPanel .cux{border:none;background:none;color:#eee;font-size:20px;min-width:40px;min-height:40px}' +
    '#cardsPanel .cubd{overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:8px}#cardsPanel .cur{display:flex;justify-content:space-between;align-items:center;padding:3px 0;gap:6px}' +
    '#cardsPanel button.cub{min-height:40px;margin:3px 3px 0 0;padding:4px 12px;border:none;border-radius:6px;background:#3a5a8a;color:#fff}#cardsPanel button.cub[disabled]{opacity:.35}' +
    '#cardsPanel button.cub.warn{background:#8a3a3a}#cardsPanel .cusub{opacity:.7;font-size:12px}#cardsPanel .cusec{margin-top:8px;font-weight:bold;opacity:.85}' +
    '#cardsPanel .cucard{position:relative;margin:6px 0;padding:6px 8px 6px 10px;border-radius:8px;background:var(--cu-paper);color:var(--cu-ink);border:3px solid var(--g);outline:1px solid var(--cu-ink);outline-offset:-4px}' +
    '#cardsPanel .cucard.g0{--g:var(--gr0)}#cardsPanel .cucard.g1{--g:var(--gr1)}#cardsPanel .cucard.g2{--g:var(--gr2)}#cardsPanel .cucard.g3{--g:var(--gr3)}#cardsPanel .cucard.g4{--g:var(--gr4);border-style:double;border-width:5px}' +
    '#cardsPanel .cucard.taken{opacity:.45}#cardsPanel .cuhead{display:flex;align-items:center;gap:6px}#cardsPanel .cuav{width:40px;height:40px;border-radius:6px;background:rgba(128,128,128,.18);display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden;flex:none}' +
    '#cardsPanel .cuav img{width:100%;height:100%;object-fit:cover}#cardsPanel .cuname{font-weight:bold;font-size:16px}#cardsPanel .cugr{display:inline-block;min-width:22px;text-align:center;border:2px solid var(--g);border-radius:4px;font-weight:bold;margin-right:4px;color:var(--cu-ink)}' +
    '#cardsPanel .cucor{position:absolute;right:6px;top:2px;letter-spacing:1px;color:var(--g);filter:brightness(.8)}#cardsPanel .custat{display:flex;gap:8px;margin:4px 0;font-size:13px}' +
    '#cardsPanel .cujob{display:inline-block;margin:2px 4px 0 0;padding:1px 6px;border:1px solid var(--cu-ink);border-radius:4px;font-size:12px}#cardsPanel .cujob.zong{border-color:var(--gr4);box-shadow:0 0 0 1px var(--gr4)}' +
    '#cardsPanel .cutr{font-size:12px;margin-top:3px}#cardsPanel details{margin-top:4px;font-size:12px;opacity:.85}#cardsPanel .cuink{color:var(--cu-ink)}#cardsPanel .cuwarn{color:#f0a060}';
  document.head.appendChild(st);
}
function cuEnsure() {
  if (cu.el) return cu.el;
  if (typeof document === 'undefined' || !document.body) return null;
  cardsUiCss();
  var el = document.createElement('div');
  el.id = 'cardsPanel';
  el.hidden = true;
  el.addEventListener('click', cuClick);
  document.body.appendChild(el);
  cu.el = el;
  if (typeof panelRegister === 'function') panelRegister('cards', { kind: 'big', el: el, close: function () { cardsUiClose(true); } });
  return el;
}
function cuNow() { return Date.now(); }
function cuCs() { var cs = cardsGet(); if (cs) cardsSync(cs, cuNow(), cardsVenueOpen); return cs; }
function cardsUiCtx() {
  var res = (typeof world !== 'undefined' && world && world.res) || {};
  return { coin: res.coin || 0, xue: res.xue || 0 };   // academy / lessons 等:學院系統尚未實作,缺值即「尚未開放」
}

// ---------- 卡面(文字卡 v1) ----------
function cuJobChips(c) {
  var h = '';
  Object.keys(c.ja).forEach(function (id) {
    var j = CARD_JOB_BY_ID[id], t = c.ja[id], dots = '';
    var i;
    if (!j) return;
    for (i = 1; i <= 4; i++) dots += i <= t ? '●' : '○';
    h += '<span class="cujob' + (t === 4 ? ' zong' : '') + '">' + cuEsc(j.t[t - 1]) + ' ' + dots + '</span>';
  });
  return h;
}
function cuTraitsHtml(c, full) {
  var city = [], war = [], list = [];
  if (c.trn) c.trn.forEach(function (t) { list.push({ n: t[0], d: t[2], ex: t[1], city: 1 }); });
  c.tr.forEach(function (id) { var t = CARD_TRAIT_BY_ID[id]; if (t && !(c.trn && c.trn.some(function (x) { return x[0] === t.n; }))) list.push({ n: t.n, d: t.d, ex: 0, city: t.city ? 1 : 0 }); });
  list.forEach(function (t) { (t.city ? city : war).push(t); });
  function one(t) { return '<span>' + (t.ex ? '★' : '') + cuEsc(t.n) + (full && t.d ? '(' + cuEsc(t.d) + ')' : '') + '</span>'; }
  var h = '';
  if (city.length) h += '<div class="cutr">' + city.map(one).join('、') + '</div>';
  if (war.length) h += '<details><summary>武略 ▸ ' + war.length + ' 條(戰事重開後生效)</summary>' + war.map(one).join('、') + '</details>';
  return h;
}
function cardsUiHtmlCard(c, opt) {
  var G = CARD_GRADE[c.gr], j = CARD_JOB_BY_ID[c.main], icon = j ? CU_ROW_ICON[j.row] : '👤', corner = '', i, st = (opt && opt.stats) || c.st, av;
  for (i = 0; i < G.corner; i++) corner += '◆';
  av = c.fig ? '<img alt="" src="assets/portraits/' + cuEsc(c.fig) + '.webp" onerror="this.remove()">' : '';
  var h = '<div class="cucard g' + c.gr + (opt && opt.taken ? ' taken' : '') + '"><span class="cucor">' + corner + '</span>';
  h += '<div class="cuhead"><div class="cuav"><span>' + icon + '</span>' + av + '</div><div><div><span class="cugr">' + G.ch + '</span><span class="cuname">' + cuEsc(c.name) + '</span>' +
    (c.zi ? '<span class="cusub">(' + cuEsc(c.zi) + ')</span>' : '') + '</div><div class="cusub cuink">' + CARD_FAC[c.fac] + ' · ' + CARD_LEARN[c.learn] + ' · 才 ' + c.tai + (c.fig ? ' · 名人' : '') + '</div></div></div>';
  h += '<div class="custat">' + CARD_STATS.map(function (n, k) { return '<span>' + n + ' ' + st[k] + '</span>'; }).join('') + '</div>';
  h += '<div>' + cuJobChips(c) + '</div>' + cuTraitsHtml(c, !!(opt && opt.full));
  return h + (opt && opt.extra ? opt.extra : '') + '</div>';
}

// ---------- 招募頁 ----------
function cuVenueHtml(cs, v) {
  var V = CARD_VENUES[v], now = cuNow(), no = cardsPeriodNo(v, now), th = cardsVenueTheme(v, no), n = cs.acc[v].length, b = cs.cur[v], h = '', nx, i;
  if (!cardsVenueOpen(v)) return '<div class="cur"><span>' + V.name + '尚未開放(需研發對應科技)</span></div>';
  nx = cardsNextIn(cs, v, now);
  h += '<div class="cur"><span>' + V.alias + ' · 每 ' + V.unit + '一批</span><span class="cusub">' + cuEsc(th.text) + '</span></div>';
  h += '<div class="cur"><span>待閱批次 <b>' + n + '/' + V.cap + '</b></span><span class="cusub">' + (nx === null ? '已滿 ' + n + '/' + V.cap : '下一批 <span data-cd="' + v + '">' + cardsUiFmtCd(nx) + '</span>') + '</span></div>';
  if (v === 'E') h += '<div class="cusub">文鬥小遊戲尚未實作,星數固定 1★</div>';
  if (!b) {
    h += '<button class="cub" data-a="open" data-v="' + v + '"' + (n ? '' : ' disabled') + '>' + (n ? '翻閱下一批' : '尚無新批次') + '</button>';
    return h;
  }
  h += '<div class="cusec">名帖 · ' + cuEsc(b.key) + '</div>';
  for (i = 0; i < b.cands.length; i++) {
    var c = b.cands[i], tk = b.taken[i], cost = cardsCost(c);
    h += cardsUiHtmlCard(c, { taken: !!tk, extra: '<div class="cur"><span class="cusub cuink">' + (c.org.k === 'pin' ? '品第 ' + CARD_PIN[c.org.v] : V.orgName) + ' · 延請 🎴' + cost + '</span>' +
      (tk ? '<span class="cuink">' + (tk === -1 ? '已化為信物' : '已延請') + '</span>' : '<button class="cub" data-a="hire" data-v="' + v + '" data-i="' + i + '"' + (cs.tok < cost ? ' disabled' : '') + '>延請</button>') + '</div>' });
  }
  h += '<button class="cub warn" data-a="skip" data-v="' + v + '">' + (b.taken.some(function (x) { return x; }) ? '結束本批' : '略過本批(其餘散去)') + '</button>';
  return h;
}

// ---------- 名冊頁 ----------
function cuRosterHtml(cs) {
  var cap = cardsCap(), h = '', list = cs.roster.slice().sort(function (a, b) { return b.gr - a.gr || b.tai - a.tai || a.no - b.no; });
  if (cu.detail) { var f = cardsFind(cs, cu.detail); if (f) return cuDetailHtml(cs, f); cu.detail = null; }
  h += '<div class="cur"><span>名額 <b>' + cs.roster.length + '/' + cap + '</b></span><span class="cusub">待定席 ' + cs.wait.length + '/' + CARD_CFG.waitSeats + '</span></div>';
  if (cs.lastRel) h += '<button class="cub" data-a="undo">復原最近請辭</button>';
  if (!list.length) h += '<div class="cusub">名冊空空如也。到酒館、縣試、殿試延請人才吧。</div>';
  list.forEach(function (e) { h += cuRowHtml(e, false); });
  if (cs.wait.length) { h += '<div class="cusec">待定席</div>'; cs.wait.forEach(function (e) { h += cuRowHtml(e, true); }); }
  if (cs.wander.length) { h += '<div class="cusec">故人(流浪)</div>'; cs.wander.forEach(function (e) { h += cuRowHtml(e, false, true); }); }
  return h;
}
function cuRowHtml(e, wait, wander) {
  var G = CARD_GRADE[e.gr], j = CARD_JOB_BY_ID[e.main], corner = '', i;
  for (i = 0; i < G.corner; i++) corner += '◆';
  return '<div class="cur" data-a="detail" data-id="' + e.id + '" style="border-left:5px solid var(--gr' + e.gr + ');padding-left:6px;min-height:44px;cursor:pointer"><span><b>' + G.ch + corner + '</b> ' + cuEsc(e.name) + ' ' + (e.star ? '★' : '') +
    '<span class="cusub"> ' + (j ? j.t[(e.ja[e.main] || 1) - 1] : '') + (e.at ? ' · 派駐' : '') + '</span></span><span class="cusub">才 ' + e.tai + (wait ? ' · 待定' : '') + (wander ? ' · 流浪' : '') + '</span></div>';
}
function cuDetailHtml(cs, f) {
  var e = f.e, h = '<button class="cub" data-a="back">‹ 返回名冊</button>', k, chk, sl = cardsJobSlots(e);
  h += cardsUiHtmlCard(e, { full: true, stats: cardsStats(e), extra: '<div class="cusub cuink">出身:' + (e.org.k === 'pin' ? '縣試 ' + CARD_PIN[e.org.v] : CARD_VENUES[e.pool].orgName) + ' · 招募序 ' + e.no + (e.tok ? ' · 信物 ' + e.tok : '') + ' · 職業槽 ' + sl.used + '/' + sl.cap + '</div>' });
  h += '<div class="cusec">職業專精</div>';
  for (k in e.ja) {
    var j = CARD_JOB_BY_ID[k], t = e.ja[k];
    h += '<div class="cusub" style="opacity:1">' + cuEsc(j.name) + ':' + j.t.map(function (n, i) { return i < t ? '<b>' + n + '</b>' : n; }).join(' → ') + '<br>對口 ' + cuEsc(j.post) + ' · 加成 +' + CARD_JOB_TIERPCT[t] + ' %(' + cuEsc(j.eff) + ')' + (t === 4 ? ' · 宗師舞台:' + cuEsc(j.stage) : '') + '</div>';
  }
  chk = cardsUpgradeCheck(e, cardsUiCtx());
  h += '<div class="cusec">升階</div><div class="cusub" style="opacity:1">' + (chk.ok ? '條件已達(尚未開放執行)' : cuEsc(chk.reasons.join(';'))) + '</div>';
  h += '<div class="cusec">管理</div>';
  if (f.list === 'wait') h += '<button class="cub" data-a="accept" data-id="' + e.id + '"' + (cs.roster.length >= cardsCap() ? ' disabled' : '') + '>收入名冊</button>';
  if (f.list === 'wander') h += '<button class="cub" data-a="recall" data-id="' + e.id + '">請回(🎴' + CARD_RECALL_COST + ' + 1 名額)</button>';
  if (f.list !== 'wander') h += '<button class="cub" data-a="star" data-id="' + e.id + '">' + (e.star ? '取消鎖定 ★' : '鎖定 ☆') + '</button>';
  if (f.list !== 'wander' && cu.confirm !== e.id) h += '<button class="cub warn" data-a="rel" data-id="' + e.id + '">請辭</button>';
  if (cu.confirm === e.id) {
    var back = e.fig ? '名人將轉為流浪,可花酒令請回。' : '返還 ' + Math.round((e.cost || 0) * CARD_WINE.refundRate * CARD_WINE.shardPerToken) + ' 酒令碎片(5 碎 = 1 令,每週有上限)。';
    h += '<div class="cuwarn">確定請辭「' + cuEsc(e.name) + '」?' + back + (e.at ? ' 目前派駐中,將一併卸任。' : '') + '</div><button class="cub" data-a="relno">否</button><button class="cub warn" data-a="relyes" data-id="' + e.id + '">是,請辭</button>';
  }
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  return h;
}

// ---------- 面板 ----------
function cardsUiRender() {
  var el = cuEnsure(), cs, h, tabs = ['T', 'E', 'G', 'R'];
  if (!el) return;
  cs = cuCs();
  if (!cs) { el.innerHTML = '<div class="cubd">尚無城邦資料</div>'; return; }
  h = '<div class="cuhd"><b>🍶 招賢 · 🎴 ' + cs.tok + '</b>' + tabs.map(function (t) { return '<button class="cutab' + (cu.tab === t ? ' on' : '') + '" data-a="tab" data-t="' + t + '">' + CU_TAB_NAME[t] + '</button>'; }).join('') + '<button class="cux" data-a="close" aria-label="關閉">×</button></div><div class="cubd">';
  if (cu.tab === 'R') h += cuRosterHtml(cs);
  else h += cuVenueHtml(cs, cu.tab);
  el.innerHTML = h + '</div>';
}
function cuTick() {
  var cs, nodes, i, v;
  if (!cu.open || !cu.el || !cu.el.querySelectorAll) return;
  cs = cardsGet();
  if (!cs) return;
  nodes = cu.el.querySelectorAll('[data-cd]');
  for (i = 0; i < nodes.length; i++) {
    v = nodes[i].getAttribute('data-cd');
    var nx = cardsNextIn(cs, v, cuNow());
    if (nx === null || nx < 1000) { cardsUiRender(); return; }
    nodes[i].textContent = cardsUiFmtCd(nx);
  }
}
function cuSave() { if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } } }
function cuClick(ev) {
  var b = ev.target, a, cs = cardsGet(), v, r, id;
  while (b && b !== cu.el && !(b.getAttribute && b.getAttribute('data-a'))) b = b.parentNode;
  if (!b || b === cu.el || !cs) return;
  a = b.getAttribute('data-a'); v = b.getAttribute('data-v'); id = b.getAttribute('data-id');
  cu.msg = '';
  if (a === 'close') { cardsUiClose(); return; }
  if (a === 'tab') { cu.tab = b.getAttribute('data-t'); cu.detail = null; cu.confirm = null; }
  else if (a === 'open') { cardsOpenBatch(cs, v); cuSave(); }
  else if (a === 'skip') { cardsDiscardBatch(cs, v); cuSave(); }
  else if (a === 'hire') {
    r = cardsHire(cs, v, +b.getAttribute('data-i'));
    if (!r.ok) cu.msg = { tok: '酒令不足', full: '名額與待定席都滿了,先請辭一人', maxtok: '信物已滿', none: '此人已不在' }[r.reason] || '無法延請';
    if (r.ok && typeof cardsSyncTalents === 'function') cardsSyncTalents();
    cuSave();
    if (cu.msg && typeof showToast === 'function') showToast(cu.msg);
  }
  else if (a === 'detail') { cu.detail = id; cu.confirm = null; }
  else if (a === 'back') { cu.detail = null; cu.confirm = null; }
  else if (a === 'star') { var f = cardsFind(cs, id); if (f) f.e.star = f.e.star ? 0 : 1; cuSave(); }
  else if (a === 'rel') cu.confirm = id;
  else if (a === 'relno') cu.confirm = null;
  else if (a === 'relyes') {
    r = cardsRelease(cs, id, { unassign: true, now: cuNow() });
    cu.confirm = null;
    if (r.ok) { cu.detail = null; cardsSyncTalents(); } else cu.msg = r.reason === 'locked' ? '已鎖定,先取消 ★' : '無法請辭';
    cuSave();
  }
  else if (a === 'undo') { cardsUndoRelease(cs); cardsSyncTalents(); cuSave(); }
  else if (a === 'accept') { cardsAccept(cs, id); cardsSyncTalents(); cuSave(); }
  else if (a === 'recall') { r = cardsRecall(cs, id); if (!r.ok) cu.msg = r.reason === 'tok' ? '酒令不足' : '名額已滿'; else cardsSyncTalents(); cuSave(); }
  cardsUiRender();
}
function cardsUiOpen(tab) {
  var el = cuEnsure(), cs;
  if (!el) return;
  cs = cuCs();
  if (!cs) return;
  if (tab && CU_TAB_NAME[tab]) cu.tab = tab;
  if (cardsClaimGift(cs, cuNow()) > 0) cuSave();
  cu.open = true; cu.detail = null; cu.confirm = null; cu.msg = '';
  if (typeof panelOpen === 'function') { try { panelOpen('cards'); } catch (e) { /* 略過 */ } }
  cardsUiRender();
  el.hidden = false;
  if (!cu.timer && typeof setInterval === 'function') cu.timer = setInterval(cuTick, 1000);
}
function cardsUiClose(fromMgr) {
  if (!cu.open && !(cu.el && !cu.el.hidden)) return;
  cu.open = false;
  if (cu.el) cu.el.hidden = true;
  if (cu.timer && typeof clearInterval === 'function') { clearInterval(cu.timer); cu.timer = 0; }
  if (!fromMgr && typeof panelClose === 'function') { try { panelClose('cards'); } catch (e) { /* 略過 */ } }
}
function cardsUiToggle(tab) { if (cu.open) cardsUiClose(); else cardsUiOpen(tab); }
// 點擊掛點:ui.js tapObjectAt 呼叫;是酒館 / 考場 / 殿試台就開面板並回傳 true
function cardsUiTap(o) {
  if (!o || !CU_TYPE_TAB[o.type]) return false;
  cardsUiToggle(CU_TYPE_TAB[o.type]);
  return true;
}
