// js/ld_nav.js — 新介面骨架:頁面堆疊管理(設計_介面骨架實作計畫.md §3-1、§3-2、任務卡 0)。前綴 ldNav / LDNAV。
// 首頁不算層,最多 5 層;開已在堆疊中的頁 = 退回那一層(不繞圈);左上返回 = 退一層;右上 X = 全部關掉回首頁;Esc / 手機返回鍵 = 退一層。
// 頁面登錄:ldNavRegister({ id, title, build(el, ctx), onShow(el, ctx), onHide(el, ctx), res: fn→[[字,值]], legacy: { open(ctx), close(), isOpen() } })
//   build 的 el = 內容區;ctx.page = 整頁根元素、ctx.titleEl = 標題木牌、ctx.tabsEl = 頁籤區、ctx.resEl = 資源區;ctx.lvl = 第幾層、ctx.last = 是否第 5 層(不可再往下開頁)。
//   legacy 頁(舊面板)開在堆疊中:堆疊頂端是舊頁時,所有新頁隱藏;舊頁自己關掉後(isOpen() 為 false)下次動作前會被剪掉。
// 純函式 ldNavPlan(stack, id, max) 給測試用。z-index 45(高於舊大面板 41、低於舊底部面板 72 與戰鬥層 70)。ES2017,不用 ?. ??。
// 第 6 階段:舊頁(cards / goods / settings / log / tour / map / share)登錄在檔尾;舊頁 × 自行關閉由 ldNavPrune(動作前、250 ms 輪詢、shell 每秒)剪掉;
//   popstate 以 history.state 判斷落點(落在自己那筆 = 被彈掉的是上層戰鬥層,不處理)+ ldNavSkipPop(ms) 帶逾時的「略過下一次 popstate」;Esc 在 window 捕獲階段先於 panelmgr 處理(新頁在頂端時,不讓底下的舊面板先被關)。
var LDNAV = { max: 5, stack: [], reg: {}, histOn: false, histSkip: false, skipUntil: 0, bound: false, timer: 0, pollMs: 250 };
// 略過下一次 popstate(程式自己呼叫 history.back() 之前用);ms 內沒有 popstate 就自動失效,不會吞掉使用者之後的返回鍵
function ldNavSkipPop(ms) { LDNAV.histSkip = true; LDNAV.skipUntil = Date.now() + (ms > 0 ? ms : 1000); }
// stack = 目前堆疊的頁 id 陣列;回 { op:'push'|'rewind'|'deny', to }:rewind 的 to = 要退回的那一層索引;push 的 to = 新層索引
function ldNavPlan(stack, id, max) {
  var i = stack.indexOf(id), m = max || LDNAV.max;
  if (i >= 0) return { op: 'rewind', to: i };
  if (stack.length >= m) return { op: 'deny', to: -1 };
  return { op: 'push', to: stack.length };
}
function ldNavToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function ldNavRegister(def) { if (def && def.id) LDNAV.reg[def.id] = def; return def; }
function ldNavDepth() { ldNavPrune(); return LDNAV.stack.length; }
function ldNavTop() { ldNavPrune(); return LDNAV.stack.length ? LDNAV.stack[LDNAV.stack.length - 1].id : null; }
function ldNavIds() { return LDNAV.stack.map(function (s) { return s.id; }); }
function ldNavIsLegacyTop() { var n = LDNAV.stack.length; return n > 0 && !!LDNAV.stack[n - 1].legacy; }
// 剪掉已自行關閉的舊頁(自己按 × 、被別的面板互斥關掉、戰鬥層開啟時 panelCloseAll):堆疊任何位置都剪。
// 剪掉依 bn 戰鬥層開的舊頁(戰報 / 地圖 / 擂台 / 對戰)後,若戰鬥層停在入口頁且沒有其他子頁 → 一併離開戰鬥層(回首頁 / 回新頁)。
function ldNavPrune() {
  var s = LDNAV.stack, i, e, gone = 0, bn = false, topGone = false, d, t;
  if (LDNAV.pruning) return false;
  LDNAV.pruning = true;
  try {
    for (i = s.length - 1; i >= 0; i--) {
      e = s[i];
      if (e.legacy && !ldNavLegacyOpen(e)) {
        s.splice(i, 1); gone++;
        if (i === s.length) topGone = true;   // 被剪的是原本的頂端
        d = LDNAV.reg[e.id];
        if (d && d.legacy && d.legacy.bn) bn = true;
      }
    }
    if (!gone) return false;
    if (bn) ldNavBnSettle();
    ldNavShowTop(); ldNavHist();
    t = s[s.length - 1];
    if (topGone && t && !t.legacy) ldNavCall(t, 'onShow');
  } finally { LDNAV.pruning = false; }
  return true;
}
function ldNavLegacyOpen(e) {
  var d = LDNAV.reg[e.id];
  try { return !!(d && d.legacy && typeof d.legacy.isOpen === 'function' && d.legacy.isOpen()); } catch (er) { return false; }
}
function ldNavEl(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined && txt !== null) e.textContent = txt;
  return e;
}
function ldNavReduced() { try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
// ───────── 舊頁共用頂列(2026-11-15 橫版首頁外殼 / WP-5) ─────────
// 舊頁(卡包 / 庫房 / 設定 / 擂台 / 對戰 / 戰報 / 地圖)在堆疊頂端時,顯示一條固定在最上面的頂列(樣式同新頁 .ldp-top):左上 ‹ 返回、頁名、右上 ✕ 回首頁;
//   body 同時加 ld-leg 與 ld-leg-<id>,css/ld_page.css 據此把各舊頁內容讓到頂列之下、藏起各頁自己的返回 / 關閉鈕。副本(stage)是戰鬥畫面,不套。
// ‹ 先問舊頁有沒有「頁內返回」(def.legacy.back():例 地圖子頁、戰報檢視 → 回上一個畫面,回 true = 已處理),沒有才退一層。
var LDNAV_LEG = { cards: 1, goods: 1, settings: 1, log: 1, tour: 1, share: 1, map: 1 };
function ldNavBackSmart() {
  var n, e, d, ok = false;
  ldNavPrune();
  n = LDNAV.stack.length;
  e = n ? LDNAV.stack[n - 1] : null;
  d = e ? LDNAV.reg[e.id] : null;
  if (e && e.legacy && d && d.legacy && typeof d.legacy.back === 'function') {
    try { ok = !!d.legacy.back(); } catch (er) { ok = false; if (typeof console !== 'undefined' && console.error) console.error('ldNav legacy back ' + e.id, er); }
    if (ok) { ldNavPrune(); ldNavSyncBar(); return true; }
  }
  return ldNavBack();
}
function ldNavLegBarEl() {
  var bar, back, title, x;
  if (LDNAV.bar) return LDNAV.bar;
  if (typeof document === 'undefined' || !document.body || !document.createElement) return null;
  bar = ldNavEl('div', 'ldleg ld-noselect');
  bar.id = 'ldLegBar';
  back = ldNavEl('button', 'ldp-btn ldp-back', '‹'); back.setAttribute('data-ld', 'back'); back.setAttribute('aria-label', '返回'); back.setAttribute('type', 'button');
  title = ldNavEl('span', 'ld-plaque ldp-title', '');
  x = ldNavEl('button', 'ldp-btn ldp-x', '×'); x.setAttribute('data-ld', 'close'); x.setAttribute('aria-label', '關閉'); x.setAttribute('type', 'button');
  back.addEventListener('click', function () { ldNavBackSmart(); });
  x.addEventListener('click', function () { ldNavClose(); });
  bar.appendChild(back); bar.appendChild(title); bar.appendChild(x);
  bar.hidden = true;
  document.body.appendChild(bar);
  LDNAV.bar = bar; LDNAV.barTitle = title;
  return bar;
}
// 依堆疊頂端同步頂列與 body class(每次堆疊變動都會呼叫)
function ldNavSyncBar() {
  var n = LDNAV.stack.length, e = n ? LDNAV.stack[n - 1] : null, show = !!(e && e.legacy && LDNAV_LEG[e.id]), bar, d, cl, k, want;
  try {
    if (typeof document === 'undefined' || !document.body || !document.body.classList) return show;
    cl = document.body.classList;
    want = show ? 'ld-leg-' + e.id : '';
    for (k in LDNAV_LEG) if (('ld-leg-' + k) !== want) cl.remove('ld-leg-' + k);
    if (want) cl.add(want);
    if (show) cl.add('ld-leg'); else cl.remove('ld-leg');
    bar = show ? ldNavLegBarEl() : LDNAV.bar;   // 第一次需要時才建
    if (!bar) return show;
    bar.hidden = !show;
    if (show) { d = LDNAV.reg[e.id]; LDNAV.barTitle.textContent = (d && d.title) || ''; }
  } catch (er) { /* 顯示用:失敗不影響堆疊 */ }
  return show;
}
// 場景背景圖:登記時 def.bg = ld_art 鍵(或回傳鍵的函式,例如依直橫切換);鍵沒圖(has:false)就不放 img、不發請求
function ldNavSetBg(scene, def) {
  var k = def && def.bg, url, im;
  if (!scene || !k) return;
  if (typeof k === 'function') { try { k = k(); } catch (e) { k = ''; } }
  url = (k && typeof ldArtUrl === 'function') ? ldArtUrl(k) : null;
  im = scene.__ldBgImg || null;
  if (!url) { if (im && im.parentNode) im.parentNode.removeChild(im); scene.__ldBgImg = null; return; }
  if (!im) {
    im = document.createElement('img'); im.setAttribute('alt', '');
    im.onerror = function () { if (im.parentNode) im.parentNode.removeChild(im); scene.__ldBgImg = null; };
    scene.appendChild(im); scene.__ldBgImg = im;
  }
  if (im.getAttribute('src') !== url) im.setAttribute('src', url);
}
// 建一頁(含外框)
function ldNavMake(def, ctx) {
  var page = ldNavEl('div', 'ldp ld-noselect'), scene = ldNavEl('div', 'ldp-scene'), top = ldNavEl('div', 'ldp-top'), back = ldNavEl('button', 'ldp-btn ldp-back', '‹'),
    title = ldNavEl('span', 'ld-plaque ldp-title', def.title || ''), tabs = ldNavEl('div', 'ldp-tabs'), res = ldNavEl('div', 'ldp-res'), x = ldNavEl('button', 'ldp-btn ldp-x', '×'), body = ldNavEl('div', 'ldp-body');
  page.setAttribute('data-ldp', def.id);
  back.setAttribute('data-ld', 'back'); back.setAttribute('aria-label', '返回');
  x.setAttribute('data-ld', 'close'); x.setAttribute('aria-label', '關閉');
  back.addEventListener('click', function () { ldNavBack(); });
  x.addEventListener('click', function () { ldNavClose(); });
  top.appendChild(back); top.appendChild(title); top.appendChild(tabs); top.appendChild(res); top.appendChild(x);
  page.appendChild(scene); page.appendChild(top); page.appendChild(body);
  ldNavSetBg(scene, def); page.__ldScene = scene;
  ctx.page = page; ctx.titleEl = title; ctx.tabsEl = tabs; ctx.resEl = res; ctx.bodyEl = body;
  return { id: def.id, el: page, body: body, ctx: ctx, legacy: false };
}
function ldNavFillRes(e) {
  var d = LDNAV.reg[e.id], list = [], i, r, pill;
  if (!d || typeof d.res !== 'function' || !e.ctx || !e.ctx.resEl) return;
  try { list = d.res(e.ctx) || []; } catch (er) { list = []; }
  e.ctx.resEl.innerHTML = '';
  for (i = 0; i < list.length && i < 2; i++) {
    r = list[i]; pill = ldNavEl('span', 'ld-pill gold ldp-pill', String(r[0]) + ' ' + String(r[1]));
    e.ctx.resEl.appendChild(pill);
  }
}
function ldNavBuild(e) {
  var d = LDNAV.reg[e.id];
  e.body.innerHTML = '';
  if (d && typeof d.build === 'function') {
    try { d.build(e.body, e.ctx); } catch (er) { if (typeof console !== 'undefined' && console.error) console.error('ldNav build ' + e.id, er); e.body.textContent = '頁面載入失敗'; }
  }
  ldNavFillRes(e);
}
function ldNavCall(e, name) {
  var d = LDNAV.reg[e.id];
  if (d && typeof d[name] === 'function') {
    try { d[name](e.body, e.ctx); } catch (er) { if (typeof console !== 'undefined' && console.error) console.error('ldNav ' + name + ' ' + e.id, er); }
  }
}
function ldNavDrop(e, anim) {
  var el = e.el;
  ldNavCall(e, 'onHide');
  if (!el) return;
  if (anim && !ldNavReduced() && typeof setTimeout === 'function' && el.classList) {
    el.classList.remove('in'); el.classList.add('out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 240);
  } else if (el.parentNode) el.parentNode.removeChild(el);
}
// 頂端是舊頁 → 全部新頁隱藏;否則頂端頁顯示、其餘依序「under」
function ldNavShowTop() {
  var s = LDNAV.stack, n = s.length, i, e, leg = ldNavIsLegacyTop();
  for (i = 0; i < n; i++) {
    e = s[i];
    if (!e.el || !e.el.classList) continue;
    if (e.el.__ldScene) ldNavSetBg(e.el.__ldScene, LDNAV.reg[e.id]);   // 直橫切換後換背景圖
    e.el.classList.toggle('ldp-hid', leg);
    e.el.classList.toggle('under', i < n - 1);
  }
  ldNavSyncBar();
}
function ldNavEnter(e) {
  var host = document.body;
  if (!e.el) return;
  host.appendChild(e.el);
  if (typeof requestAnimationFrame === 'function' && !ldNavReduced()) requestAnimationFrame(function () { if (e.el && e.el.classList) e.el.classList.add('in'); });
  else if (e.el.classList) { e.el.classList.add('in'); e.el.classList.add('now'); }
}
// 開頁。回 true = 已顯示(或退回到該頁);false = 未登錄 / 層數已滿 / 舊頁開失敗
function ldNavPush(id, ctx) {
  var d = LDNAV.reg[id], c = ctx || {}, plan, e, i, old;
  ldNavPrune();
  if (!d) { ldNavToast('即將開放'); return false; }
  plan = ldNavPlan(ldNavIds(), id, LDNAV.max);
  if (plan.op === 'deny') { ldNavToast('頁面層數已達上限,請先返回'); return false; }
  if (plan.op === 'rewind') {
    while (LDNAV.stack.length > plan.to + 1) { old = LDNAV.stack.pop(); ldNavDropAny(old, false); }
    e = LDNAV.stack[plan.to];
    if (e.legacy) {   // 舊頁已在堆疊:退回到它,並以新參數重開(例:卡包換頁籤)
      c.lvl = plan.to + 1; c.last = c.lvl === LDNAV.max;
      e.ctx = Object.assign(e.ctx, c);
      try { if (d.legacy && typeof d.legacy.open === 'function') d.legacy.open(e.ctx); } catch (er2) { if (typeof console !== 'undefined' && console.error) console.error('ldNav legacy reopen ' + id, er2); }
      ldNavPrune(); ldNavShowTop();
      return true;
    }
    c.lvl = plan.to + 1; c.last = c.lvl === LDNAV.max;
    e.ctx = Object.assign(e.ctx, c);   // 保留 page / titleEl 等參照,蓋上新參數
    ldNavBuild(e); ldNavShowTop(); ldNavCall(e, 'onShow');
    return true;
  }
  c.lvl = plan.to + 1; c.last = c.lvl === LDNAV.max;
  try { if (typeof document !== 'undefined' && document.body && document.body.classList) document.body.classList.add('ld-ui'); } catch (er0) { /* 略過 */ }   // 新介面:舊頁外框改滿版(css/panelui.css .ld-ui)
  if (d.legacy) {
    ldNavHistEnsure();   // 先掛 ld_nav 自己那筆 history,讓舊頁(戰鬥層)自己的那筆疊在它上面
    try { d.legacy.open(c); } catch (er) { if (typeof console !== 'undefined' && console.error) console.error('ldNav legacy open ' + id, er); if (d.legacy.bn) ldNavBnSettle(); ldNavHist(); return false; }
    e = { id: id, el: null, body: null, ctx: c, legacy: true };
    if (!ldNavLegacyOpen(e)) { if (d.legacy.bn) ldNavBnSettle(); ldNavHist(); return false; }
    LDNAV.stack.push(e);
    ldNavPrune();   // 開這頁時被互斥關掉的其他舊面板(先入堆疊再剪,避免堆疊暫時為空而收掉 history)
    ldNavShowTop(); ldNavHist();
    return true;
  }
  e = ldNavMake(d, c);
  LDNAV.stack.push(e);
  ldNavBuild(e); ldNavEnter(e); ldNavShowTop(); ldNavHist();
  ldNavCall(e, 'onShow');
  return true;
}
function ldNavDropAny(e, anim) {
  if (!e) return;
  if (e.legacy) {
    var d = LDNAV.reg[e.id];
    try { if (d && d.legacy && typeof d.legacy.close === 'function' && ldNavLegacyOpen(e)) d.legacy.close(); } catch (er) { /* 略過 */ }
    try { if (d && d.legacy && d.legacy.bn) ldNavBnSettle(); } catch (er3) { /* 略過 */ }
    return;
  }
  ldNavDrop(e, anim);
}
// 退一層;回 false = 堆疊已空
function ldNavBack() {
  var e, t;
  ldNavPrune();
  if (!LDNAV.stack.length) return false;
  e = LDNAV.stack.pop();
  ldNavDropAny(e, true);
  ldNavPrune();
  ldNavShowTop();
  t = LDNAV.stack[LDNAV.stack.length - 1];
  if (t && !t.legacy) ldNavCall(t, 'onShow');
  ldNavHist();
  return true;
}
// 全部關掉回首頁
function ldNavClose() {
  var e;
  ldNavPrune();
  if (!LDNAV.stack.length) return false;
  while (LDNAV.stack.length) { e = LDNAV.stack.pop(); ldNavDropAny(e, true); }
  ldNavHist();
  return true;
}
// 重畫頂端(或指定 id)頁的內容與資源區
function ldNavRefresh(id) {
  var s = LDNAV.stack, i, e;
  for (i = s.length - 1; i >= 0; i--) {
    e = s[i];
    if (e.legacy || (id && e.id !== id)) continue;
    ldNavBuild(e);
    if (!id) return true;
  }
  return !!id;
}
function ldNavSetTitle(id, t) {
  var s = LDNAV.stack, i;
  for (i = 0; i < s.length; i++) if (s[i].id === id && s[i].ctx && s[i].ctx.titleEl) s[i].ctx.titleEl.textContent = t;
}
// ───────── Esc / 手機返回鍵 ─────────
// 堆疊非空時掛一筆 history 狀態({ldnav:1},整個堆疊只掛一筆);返回鍵 → popstate → 退一層(仍非空則補一筆)。戰鬥層(bnUiActive)開著時不處理,交給戰鬥層。
function ldNavBlocked() { return typeof bnUiActive === 'function' && bnUiActive(); }
function ldNavBind(on) {
  var f = on ? 'addEventListener' : 'removeEventListener';
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (on === LDNAV.bound) return;
  LDNAV.bound = on;
  document[f]('keydown', ldNavOnKey);
  window[f]('keydown', ldNavOnKeyCap, true);   // 捕獲階段:先於 panelmgr 的 Esc(它會把底下的舊面板先關掉)
  window[f]('popstate', ldNavOnPop);
  window[f]('resize', ldNavShowTop);
}
// 確保 ld_nav 那筆 history 存在(不論堆疊是否有頁);開 bn 舊頁前先呼叫,讓戰鬥層自己的那筆疊在它上面
function ldNavHistEnsure() {
  ldNavBind(true);
  if (LDNAV.histOn) return;
  try { history.pushState({ ldnav: 1 }, ''); LDNAV.histOn = true; } catch (e) { /* 略過 */ }
}
function ldNavHist() {
  var n = LDNAV.stack.length;
  ldNavSyncBar();
  ldNavBind(n > 0 || LDNAV.histOn);
  if (n > 0 && !LDNAV.histOn) {
    try { history.pushState({ ldnav: 1 }, ''); LDNAV.histOn = true; } catch (e) { /* 略過 */ }
  } else if (n === 0 && LDNAV.histOn) {
    LDNAV.histOn = false; ldNavSkipPop(300);
    try { history.back(); } catch (e2) { LDNAV.histSkip = false; }
    ldNavBind(false);
  }
  ldNavPoll();
}
// 堆疊內有舊頁時,每 pollMs 剪一次(舊頁自己的 × 關閉要同步);沒有舊頁就停
function ldNavPoll() {
  var i, has = false;
  for (i = 0; i < LDNAV.stack.length; i++) if (LDNAV.stack[i].legacy) has = true;
  if (has && !LDNAV.timer && typeof setInterval === 'function') LDNAV.timer = setInterval(ldNavPollTick, LDNAV.pollMs) || 0;
  else if (!has && LDNAV.timer && typeof clearInterval === 'function') { clearInterval(LDNAV.timer); LDNAV.timer = 0; }
}
function ldNavPollTick() { ldNavPrune(); }
function ldNavIsEsc(e) { return !!e && (e.key === 'Escape' || e.key === 'Esc'); }
// 文件階段:新頁頂端 → 退一層(測試與沒走捕獲的情況)。舊頁頂端由舊頁自己處理 Esc,這裡不動
function ldNavOnKey(e) {
  if (!ldNavIsEsc(e) || ldNavBlocked()) return;
  ldNavPrune();
  if (!LDNAV.stack.length || ldNavIsLegacyTop()) return;
  ldNavBack();
}
function ldNavOnKeyCap(e) {
  if (!ldNavIsEsc(e) || ldNavBlocked()) return;
  ldNavPrune();
  if (!LDNAV.stack.length || ldNavIsLegacyTop()) return;
  ldNavBack();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  if (e.preventDefault) e.preventDefault();
}
function ldNavOnPop() {
  var st = null;
  if (LDNAV.histSkip) {
    LDNAV.histSkip = false;
    if (!LDNAV.skipUntil || Date.now() <= LDNAV.skipUntil) return;   // 逾時的旗標不吞返回鍵
  }
  if (ldNavBlocked()) return;
  try { st = history.state; } catch (e) { st = null; }
  if (st && st.ldnav) return;   // 落在 ld_nav 自己那筆 = 被彈掉的是它上面那筆(例:戰鬥層),不是本堆疊的返回
  LDNAV.histOn = false;
  if (!LDNAV.stack.length) return;
  ldNavBack();
  if (LDNAV.stack.length) ldNavHist();
}
// ───────── 舊頁登錄 ─────────
// bn:true = 開在戰鬥層(#bnLayer)裡的舊頁(戰報 / 地圖 / 擂台 / 對戰):開啟時先開戰鬥層;關閉後戰鬥層若停在入口頁且沒有其他子頁 → 離開戰鬥層。
function ldNavBnBusy() {
  return (typeof bnLogIsOpen === 'function' && bnLogIsOpen()) || (typeof bnTourIsOpen === 'function' && bnTourIsOpen()) || (typeof bnsIsOpen === 'function' && bnsIsOpen()) ||
    (typeof wdIsOpen === 'function' && wdIsOpen()) || (typeof wmIsOpen === 'function' && wmIsOpen());
}
function ldNavBnSettle() {
  var ok = false;
  if (typeof bnu === 'undefined' || !bnu || !bnu.open || bnu.leaving || bnu.phase !== 'entry' || typeof bnUiLeave !== 'function') return false;
  if (ldNavBnBusy()) return false;
  ldNavSkipPop(300);
  try { ok = !!bnUiLeave(false); } catch (e) { ok = false; if (typeof console !== 'undefined' && console.error) console.error('ldNav bnUiLeave', e); }
  if (!ok) LDNAV.histSkip = false;
  return ok;
}
// 把統一外框(panelui.js)的第 2 層面板改成滿版:寬度 100%(橫向不再讓出舊分頁軌 64px)、隱藏 50 / 67 / 滿 三檔鈕(css/ld_page.css 的 [data-ldfull])
function ldNavFullFrame(id) {
  var f = (typeof PF_FR !== 'undefined' && PF_FR) ? PF_FR[id] : null;
  if (!f || !f.root) return false;
  if (typeof pfSetWidth === 'function') pfSetWidth(id, 100);
  f.root.setAttribute('data-ldfull', '1');
  if (f.root.style) f.root.style.width = '100%';
  return true;
}
// ld 模式下戰鬥層的舊『入口選單』不再給人看:bnui 的 bnUiToEntry 改呼叫這裡 = 立刻離開戰鬥層(回到呼叫它的新頁)。回 true = 已離開
function ldNavBnExit() {
  var ok = false;
  if (typeof bnu === 'undefined' || !bnu || !bnu.open || bnu.leaving || typeof bnUiLeave !== 'function') return false;
  ldNavSkipPop(300);
  try { ok = !!bnUiLeave(true); } catch (e) { ok = false; if (typeof console !== 'undefined' && console.error) console.error('ldNav bnUiLeave', e); }
  if (!ok) { LDNAV.histSkip = false; return false; }
  ldNavPrune();   // 堆疊上依戰鬥層開的舊頁(例:副本)立刻剪掉,新頁馬上露出,不等 250 ms 輪詢
  return true;
}
function ldNavBnOpen(fn) {
  var ok = (typeof bnu !== 'undefined' && bnu && bnu.open) ? true : (typeof bnUiOpen === 'function' ? !!bnUiOpen() : false);
  if (!ok) return false;
  fn();
  return true;
}
function ldNavRegLegacy() {
  ldNavRegister({ id: 'cards', title: '卡包', legacy: {
    open: function (c) { if (typeof cardsUiOpen === 'function') cardsUiOpen(c && c.tab); },
    close: function () { if (typeof cardsUiClose === 'function') cardsUiClose(); },
    isOpen: function () { return typeof cu !== 'undefined' && !!cu && !!cu.open && (typeof panelIsOpen !== 'function' || panelIsOpen('cards') || !!(cu.el && !cu.el.hidden)); } } });
  ldNavRegister({ id: 'goods', title: '背包', legacy: {
    open: function () { if (typeof goodsPanelToggle === 'function') goodsPanelToggle(true); },
    close: function () { if (typeof goodsPanelToggle === 'function') goodsPanelToggle(false); },
    isOpen: function () { return typeof panelIsOpen === 'function' ? panelIsOpen('goods') : false; } } });
  ldNavRegister({ id: 'settings', title: '設定', legacy: {
    open: function () { if (typeof stOpenPanel === 'function') stOpenPanel(); },
    close: function () { if (typeof stClosePanel === 'function') stClosePanel(); },
    isOpen: function () { return typeof stIsOpen !== 'undefined' && !!stIsOpen; } } });
  ldNavRegister({ id: 'log', title: '戰報', legacy: { bn: true,
    open: function (c) { return ldNavBnOpen(function () { if (typeof bnLogOpen === 'function') bnLogOpen(c && c.tab, c && c.rid); }); },
    close: function () { if (typeof bnLogClose === 'function') bnLogClose(); },
    back: function () { if (typeof BNLOG !== 'undefined' && BNLOG && BNLOG.view && typeof bnLogBack === 'function') { bnLogBack(); return true; } return false; },   // 檢視中 → 回清單
    isOpen: function () { return typeof bnLogIsOpen === 'function' && bnLogIsOpen(); } } });
  ldNavRegister({ id: 'tour', title: '擂台', legacy: { bn: true,
    open: function () { return ldNavBnOpen(function () { if (typeof bnTourOpen === 'function') bnTourOpen(); }); },
    close: function () { if (typeof bnTourClose === 'function') bnTourClose(); },
    isOpen: function () { return typeof bnTourIsOpen === 'function' && bnTourIsOpen(); } } });
  ldNavRegister({ id: 'share', title: '對戰', legacy: { bn: true,
    open: function () { return ldNavBnOpen(function () { if (typeof bnsOpen === 'function') bnsOpen('share'); }); },
    close: function () { if (typeof bnsClose === 'function') bnsClose(); },
    isOpen: function () { return typeof bnsIsOpen === 'function' && bnsIsOpen(); } } });
  // 副本(章節 / 關卡選擇、布陣、戰鬥、結算都在戰鬥層的非入口階段):戰鬥層回到入口階段(或關閉)= 這頁結束
  ldNavRegister({ id: 'stage', title: '副本', legacy: { bn: true,
    open: function () { return ldNavBnOpen(function () { if (typeof bnUiToMap === 'function') bnUiToMap(); }); },
    close: function () { if (typeof bnUiLeave === 'function') bnUiLeave(false); },
    isOpen: function () { return typeof bnu !== 'undefined' && !!bnu && !!bnu.open && !bnu.leaving && bnu.phase !== 'entry'; } } });
  ldNavRegister({ id: 'map', title: '地圖', legacy: { bn: true,
    open: function (c) {
      return ldNavBnOpen(function () {
        if (typeof wdOpen !== 'function' || wdOpen() === false) return;
        ldNavFullFrame('wd');   // 新介面一律滿版:地圖外框直接 100% 寬、不留寬度三檔鈕
        if (c && c.sub === 'rsv') {   // 校場 = 地圖層的預備兵頁
          if (typeof rsvSettle === 'function') rsvSettle(Date.now());
          if (typeof wdUiPush === 'function') wdUiPush({ v: 'rsv' });
        }
      });
    },
    close: function () { if (typeof wdClose === 'function') wdClose(); },
    back: function () { if (typeof WDUI !== 'undefined' && WDUI && WDUI.stack && WDUI.stack.length && typeof wdBack === 'function') { wdBack(); return true; } return false; },   // 子頁(校場 / 預約 / 戰報…)→ 回地圖
    isOpen: function () { return typeof wdIsOpen === 'function' && wdIsOpen(); } } });
}
ldNavRegLegacy();
if (typeof module !== 'undefined' && module.exports) module.exports = { LDNAV: LDNAV, ldNavPlan: ldNavPlan };
