// js/nextstepui.js — 「推薦下一步」右上角小卡:圖示、一句推薦、[前往][✕ 關閉這則][⋯]。引擎 nextstep.js、資料 nextstep_data.js。
// 面板管理:這是常駐的小提示條(HUD),不是浮卡 —— 只用 panelRegister('ns-card', {kind:'hud'}) 登記、從不 panelOpen,
//   所以不進開啟清單、不觸發 PANEL_MUTEX、不計入「同時最多一張浮卡」;z-index 低於側欄與所有面板。全螢幕(拍照 / 錄影 / 戰鬥…)時自己隱藏。
// 與縣丞:本功能開啟時,縣丞(cityadvisorui.js)只留小臉入口、不再跳氣泡(同一條提示不出現兩處);關閉本功能後縣丞氣泡恢復。
// 關閉總開關:整張卡隱藏且不再計算(nsGet / nsTick 直接 return)。樣式由本檔注入。不發聲。ES2017;不用 ?. ??。
// 全域名稱:initNsUI nsUiTick nsUiRefresh nsUiHidden nsUiGo nsUiDismiss nsUiMenu

var nsUi = { inited: false, el: null, sig: '', menu: false, why: false, timer: 0 };

function nsDoc() { return (typeof document !== 'undefined' && document && document.body) ? document : null; }
function nsE(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function nsBtn(text, cls, fn, label) {
  var b = nsE('button', cls, text);
  b.type = 'button';
  if (label) { b.setAttribute('aria-label', label); b.title = label; }
  b.addEventListener('click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); fn(ev); });
  return b;
}
function nsVp() {
  var w = 375, h = 667;
  if (typeof window !== 'undefined' && window) { if (window.innerWidth) w = window.innerWidth; if (window.innerHeight) h = window.innerHeight; }
  return { w: w, h: h };
}
function nsTopY() {
  var t, r;
  if (!nsDoc() || !document.getElementById) return 50;
  t = document.getElementById('topbar');
  r = t && t.getBoundingClientRect ? t.getBoundingClientRect() : null;
  return r && r.bottom > 0 ? Math.round(r.bottom) + 4 : 50;
}

var NS_CSS = [
  '#nsCard{position:fixed;z-index:2;box-sizing:border-box;overflow:hidden;background:rgba(30,38,52,.94);border:1px solid #6a82aa;border-left-width:4px;border-radius:8px;color:#e8edf2;font-size:12px;line-height:1.35;padding:4px 6px;display:flex;flex-direction:column;gap:3px}',
  '#nsCard[hidden]{display:none!important}',
  '#nsCard.ns-tR{border-left-color:#c0392b}#nsCard.ns-tY{border-left-color:#c99a1e}#nsCard.ns-tB{border-left-color:#4f86d6}#nsCard.ns-tC{border-left-color:#d9a441}',
  'body.photo-mode #nsCard,body.atk-mode #nsCard,body.replay-mode #nsCard,body.sandbox #nsCard,body.camp-mode #nsCard{display:none!important}',
  '#nsCard .ns-main{display:flex;gap:4px;align-items:flex-start;min-height:0;flex:1 1 auto;overflow:hidden;cursor:pointer}',
  '#nsCard .ns-ic{flex:0 0 auto;font-size:14px;line-height:1.2}',
  '#nsCard .ns-tx{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-width:0}',
  '#nsCard .ns-why{color:#aebbd0;font-size:11px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}',
  '#nsCard .ns-acts{display:flex;gap:4px;flex:0 0 auto;align-items:center}',
  '#nsCard .ns-b{background:#34445e;color:#e8edf2;border:1px solid #5a6f92;border-radius:6px;min-height:24px;padding:0 8px;font-size:12px;line-height:22px}',
  '#nsCard .ns-go{background:#46618a;color:#fff}',
  '#nsCard .ns-sq{min-width:26px;padding:0 4px}',
  '#nsCard .ns-menu{display:flex;flex-wrap:wrap;gap:4px;overflow:auto;min-height:0}'
].join('\n');

function nsInjectCss() {
  var st;
  if (!nsDoc() || document.getElementById('nsStyle')) return;
  st = nsE('style'); st.id = 'nsStyle'; st.textContent = NS_CSS;
  (document.head || document.body).appendChild(st);
}

function initNsUI() {
  if (nsUi.inited || !nsDoc()) return;
  nsInjectCss();
  nsUi.el = nsE('div'); nsUi.el.id = 'nsCard'; nsUi.el.hidden = true;
  nsUi.el.setAttribute('role', 'status');
  document.body.appendChild(nsUi.el);
  if (typeof panelRegister === 'function') panelRegister('ns-card', { kind: 'hud', el: nsUi.el, esc: false, place: false, closeOnMapDrag: false });
  nsUi.inited = true;
  if (typeof setInterval === 'function') nsUi.timer = setInterval(function () { nsUiTick(); }, 1000);
  nsUiTick();
}

// 不該顯示的情境:非經營板、拍照 / 錄影 / 戰鬥 / 釣魚 / 仙獸 / 沙盤、全螢幕面板
function nsUiHidden() {
  var b = document.body, m;
  if (typeof world === 'undefined' || !world) return true;
  m = (typeof game !== 'undefined' && game) ? game.mode : 'estate';
  if (m && m !== 'estate') return true;
  if (typeof game !== 'undefined' && game && game.backup) return true;
  if (b && b.classList && ['photo-mode', 'atk-mode', 'replay-mode', 'sandbox', 'camp-mode'].some(function (c) { return b.classList.contains(c); })) return true;
  if (typeof panelFsActive === 'function' && panelFsActive()) return true;
  return false;
}

function nsUiTick() {
  var c, cand;
  if (!nsUi.inited) return;
  if (typeof nsEnabled !== 'function' || !nsEnabled() || nsUiHidden()) { nsUi.el.hidden = true; return; }
  c = nsTick();
  cand = nsPick(c);
  if (!cand) { nsUi.el.hidden = true; return; }
  nsUiRender(cand, c.cands.length);
}
function nsUiRefresh(force) {
  if (!nsUi.inited) return;
  if (force) nsUi.sig = '';
  if (typeof nsEnabled === 'function' && nsEnabled() && typeof nsGet === 'function') nsGet(true);
  nsUiTick();
}

function nsUiRender(cand, n) {
  var e = nsUi.el, vp = nsVp(), top = nsTopY(), r = nsCardRect(vp.w, vp.h, top), sig, main, acts, mark, compact = false;
  sig = [cand.id, cand.text, nsUi.menu, nsUi.why, vp.w, vp.h, top, n > 1].join('|');
  e.hidden = false;
  if (sig === nsUi.sig) return;
  nsUi.sig = sig;
  e.style.left = r.x + 'px'; e.style.top = r.y + 'px'; e.style.width = r.w + 'px'; e.style.height = r.h + 'px';
  e.className = 'ns-t' + cand.tier;
  while (e.firstChild) e.removeChild(e.firstChild);
  if (nsUi.menu) {
    main = nsE('div', 'ns-menu');
    if (n > 1) main.appendChild(nsBtn('下一則', 'ns-b', function () { nsNext(); nsUi.menu = false; nsUiRefresh(true); }));
    main.appendChild(nsBtn('全部關閉', 'ns-b', function () { nsUiAllOff(); }, '全部關閉(不再提醒)'));
    main.appendChild(nsBtn('重新開啟', 'ns-b', function () { nsUndismissAll(); nsUi.menu = false; nsUiRefresh(true); }, '重新開啟已關閉的提示'));
    e.appendChild(main);
    acts = nsE('div', 'ns-acts');
    acts.appendChild(nsBtn('返回', 'ns-b', function () { nsUi.menu = false; nsUiRefresh(true); }));
    e.appendChild(acts);
    return;
  }
  mark = NS_TIER_MARK[cand.tier] || '';
  main = nsE('div', 'ns-main');
  main.appendChild(nsE('span', 'ns-ic', mark ? mark + cand.icon : cand.icon));
  main.appendChild(nsE('span', 'ns-tx', (nsUi.why && cand.why) ? cand.why : cand.text));
  main.title = cand.why || cand.text;
  main.addEventListener('click', function () { if (cand.why) { nsUi.why = !nsUi.why; nsUi.sig = ''; nsUiTick(); } });
  e.appendChild(main);
  if (r.showWhy && cand.why && !nsUi.why) e.appendChild(nsE('div', 'ns-why', cand.why));
  acts = nsE('div', 'ns-acts');
  acts.appendChild(nsBtn('前往', 'ns-b ns-go', function () { nsUiGo(cand); }));
  acts.appendChild(nsBtn('✕', 'ns-b ns-sq', function () { nsUiDismiss(cand); }, '關閉這則,不再提示'));
  acts.appendChild(nsBtn('⋯', 'ns-b ns-sq', function () { nsUi.menu = true; nsUi.sig = ''; nsUiTick(); }, '更多'));
  e.appendChild(acts);
}

function nsUiGo(cand) { if (typeof nsGo === 'function') nsGo(cand); nsUi.why = false; nsUiRefresh(true); }
function nsUiDismiss(cand) { nsUi.why = false; nsDismiss(cand.id); nsUiRefresh(true); }
function nsUiAllOff() { nsSetEnabled(false); nsUi.menu = false; nsUi.sig = ''; nsUi.el.hidden = true; }
function nsUiMenu(on) { nsUi.menu = !!on; nsUi.sig = ''; nsUiTick(); }

if (typeof document !== 'undefined' && document && document.body) initNsUI();
else if (typeof document !== 'undefined' && document && document.addEventListener) document.addEventListener('DOMContentLoaded', function () { initNsUI(); });
