// js/wmap_ui.js — M1 W2 主畫面外殼(設計_M1視覺原型_實作計畫.md 2.3~2.5、3.4、W2 列;設計_遊戲外殼與流程_規格.md 3、5.2~5.5、7.4)。
//   旗標 wmap(js/features.js;?wmap=1 / ?wmap=0 或 localStorage lorddomain.feature.wmap 覆寫)+ 外殼 ld 模式同時開時,主畫面 = 斜角地圖;旗標關 = 本檔載入後什麼都不做(首頁與原本逐像素相同)。
//   作法(最小改):不搬 ld_home.js。地圖層 #wmapRoot 疊在首頁場景(.sh-scene)上、頂列與底部導覽之下;點主城 = 地圖淡出 + 略放大,露出原本的建築首頁(= 主城內頁);出城 = 反向。
//   body class:wm-on = 地圖主畫面模式、wm-in-city = 目前在主城內頁(狀態不存檔,每次啟動回地圖)。CSS 在 css/wmap.css 尾段。
//   底部導覽(shell.js SHELL_DOCK_WM):武將 / 戰法 / 部隊 / 主城(城內換成出城)/ 更多;左圓鈕任務(ld_home.js 原有)、右綠圓鈕招募(本檔建);〔更多〕展開第二排(WMAPUI_MORE)。
//   返回順序(wmapUiBack,Esc / 手機返回鍵在 ldNav 堆疊為空時使用):① 收「更多」→ ② 取消地圖選取(資訊列)→ ③ 在主城內頁 → 出城 → ④ 地圖 = 不動作(沿用現行首頁行為)。堆疊有頁時由 ldNav 處理,本檔不插手。
//   鏡頭:偏好鍵 lorddomain.ui.wmcam = {u, v, s}(鏡頭中心格座標、格大小),每秒比對、有變才寫;開啟時還原。戰鬥舞台 / ldNav 頁都蓋在地圖上方,離開後地圖原樣(不卸載、不重置鏡頭)。
//   ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:shell.js 之後(index.html、sw.js PRECACHE 同步)。命名:全域一律 wmapUi* / WMAPUI*(wmap_view.js 用 wmap* / WMAP*)。
//
// ───────── 公開 API ─────────
//   wmapUiOn() → bool          旗標 wmap 開、外殼 ld 模式開、網址沒有 ?wmapui=0(shell.js 的 shellDockList / shellAct / ld_home.js 城門都靠它判斷)
//   wmapUiInit() → bool        shell.js shellInit 尾端呼叫:建地圖、更多列、招募圓鈕、事件;旗標關 / 已建 = false
//   wmapUiAct(a) → bool        底部導覽 / 更多列動作:skills team city city-out more forge yard,其他字串交給 shellAct
//   wmapUiEnterCity() / wmapUiExitCity()    進城 / 出城(已在該狀態 = 不動作)
//   wmapUiBack() → bool        依上列順序處理一次返回;回 true = 已處理
//   wmapUiDockSync()           依狀態更新〔主城 / 出城〕鈕與〔更多〕鈕外觀
//   WMAPUI                     狀態:{inited, city, more, moreEl, rr, rrDot, camKey, tid, histOn, skipUntil}

var WMAPUI = { inited: false, city: false, more: false, moreEl: null, rr: null, rrDot: null, camKey: '', tid: 0, histOn: false, skipUntil: 0, binds: [] };
var WMAPUI_CAMKEY = 'lorddomain.ui.wmcam';
// 〔更多〕第二排:k = 木牌字;act = shellAct 字串或 'wmap:*'。校場 = 預備兵頁(補兵);練兵 = 舊「訓練場」(S0 清理後入口移到這裡)。
var WMAPUI_MORE = [
  { k: '背包', act: 'ldbag' }, { k: '鍛造', act: 'wmap:forge' }, { k: '擂台', act: 'tour' }, { k: '活動', act: 'ldevent' }, { k: '戰報', act: 'wmap:report' },
  { k: '校場', act: 'wmap:yard' }, { k: '練兵', act: 'prac' }, { k: '圖鑑', act: 'cards:X' }, { k: '設定', act: 'settings' }, { k: '說明', act: 'help' }
];

function wmapUiOff() { try { return typeof window !== 'undefined' && !!window.location && /[?&]wmapui=0(&|$)/.test(String(window.location.search || '')); } catch (e) { return false; } }   // ?wmapui=0:W1 單獨預覽(地圖蓋整頁、不接外殼;tools/shot_wmap.js 用)
function wmapUiOn() { return typeof featureOn === 'function' && featureOn('wmap') && typeof shellLdOn === 'function' && shellLdOn() && !wmapUiOff(); }   // @DORMANT wmap
function wmapUiEl(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined && txt !== null) e.textContent = txt;
  return e;
}
function wmapUiBodyCls(name, on) { try { document.body.classList.toggle(name, !!on); } catch (e) { /* 顯示用 */ } }
function wmapUiAdd(el, ev, fn, opt) { el.addEventListener(ev, fn, opt || false); WMAPUI.binds.push([el, ev, fn, opt || false]); }
function wmapUiDepth() { return typeof ldNavDepth === 'function' ? ldNavDepth() : 0; }
function wmapUiPanelBusy() { return (typeof panelOpenList !== 'undefined' && panelOpenList && panelOpenList.length > 0) || (typeof bnUiActive === 'function' && bnUiActive()); }

// ───────── 鏡頭偏好 ─────────
function wmapUiCamLoad() {
  var s = null, o, zi;
  try { s = localStorage.getItem(WMAPUI_CAMKEY); } catch (e) { s = null; }
  if (!s || typeof WMAP === 'undefined' || !WMAP.on) return false;
  try { o = JSON.parse(s); } catch (e2) { return false; }
  if (!o || typeof o.u !== 'number' || typeof o.v !== 'number' || !isFinite(o.u) || !isFinite(o.v)) return false;
  zi = typeof WMAP_CFG !== 'undefined' ? WMAP_CFG.zooms.indexOf(o.s) : -1;
  if (zi >= 0) wmapSetZoom(zi);
  wmapSetCam(o.u, o.v);
  return true;
}
function wmapUiCamSave() {
  var c, key, G;
  if (typeof WMAP === 'undefined' || !WMAP.on || !WMAP.G) return false;
  c = WMAP.cam; G = WMAP.G;
  key = c.u.toFixed(2) + ',' + c.v.toFixed(2) + ',' + G.s;
  if (key === WMAPUI.camKey) return false;
  WMAPUI.camKey = key;
  try { localStorage.setItem(WMAPUI_CAMKEY, JSON.stringify({ u: Math.round(c.u * 100) / 100, v: Math.round(c.v * 100) / 100, s: G.s })); } catch (e) { /* 略過:無法寫入時下次開啟回主城 */ }
  return true;
}

// ───────── 進城 / 出城 ─────────
function wmapUiCityOrigin() {   // 放大動畫的中心 = 主城在視窗內的位置
  var p, c;
  if (typeof WMAP === 'undefined' || !WMAP.on || !WMAP.root || !WMAP.WG) return;
  try {
    p = wmapCamPxNow(); c = wmapCellCenter(WMAP.G, WMAP.WG.cx, WMAP.WG.cy);
    WMAP.root.style.transformOrigin = Math.round(c.x - p.px) + 'px ' + Math.round(c.y - p.py) + 'px';
  } catch (e) { /* 顯示用 */ }
}
function wmapUiReflow() {   // 進出城後場景高度會變(直版讓出隊伍欄 / 圓鈕列):重排建築木牌與地圖視窗
  if (typeof ldHomeLayout === 'function') ldHomeLayout();
  if (typeof wmapResize === 'function') wmapResize();
}
function wmapUiEnterCity() {
  if (!WMAPUI.inited || WMAPUI.city) return false;
  WMAPUI.city = true;
  wmapUiCityOrigin();
  wmapUiMoreSet(false);
  wmapUiBodyCls('wm-in-city', true);
  wmapUiReflow();
  if (typeof ldHomeRefresh === 'function') ldHomeRefresh();
  wmapUiDockSync();
  if (!WMAPUI.histOn) { try { history.pushState({ wmcity: 1 }, ''); WMAPUI.histOn = true; } catch (e) { /* 略過 */ } }
  return true;
}
function wmapUiExitCity(fromPop) {
  if (!WMAPUI.inited || !WMAPUI.city) return false;
  WMAPUI.city = false;
  wmapUiMoreSet(false);
  wmapUiCityOrigin();
  wmapUiBodyCls('wm-in-city', false);
  wmapUiReflow();
  wmapUiDockSync();
  if (WMAPUI.histOn) {
    WMAPUI.histOn = false;
    if (!fromPop) { WMAPUI.skipUntil = Date.now() + 600; try { history.back(); } catch (e) { WMAPUI.skipUntil = 0; } }
  }
  return true;
}
// 手機返回鍵:落在「進城時掛的那筆」之外(= 從城內按返回)才出城;ldNav 自己的狀態與 wmcity 狀態都不處理
function wmapUiOnPop() {
  var st = null;
  if (WMAPUI.skipUntil) { WMAPUI.skipUntil = 0; return; }
  try { st = history.state; } catch (e) { st = null; }
  if (st && (st.ldnav || st.wmcity)) return;
  if (WMAPUI.city && WMAPUI.histOn && wmapUiDepth() === 0) { WMAPUI.histOn = false; wmapUiExitCity(true); }
}

// ───────── 更多列 ─────────
function wmapUiMoreSet(on) {
  on = !!on;
  if (!WMAPUI.moreEl) return false;
  WMAPUI.more = on;
  WMAPUI.moreEl.hidden = !on;
  wmapUiDockSync();
  return true;
}
function wmapUiMoreBuild() {
  var el = wmapUiEl('div', 'wmap-more'), i, b;
  el.id = 'wmapMore'; el.hidden = true;
  for (i = 0; i < WMAPUI_MORE.length; i++) {
    b = wmapUiEl('button', 'wmap-mb', WMAPUI_MORE[i].k);
    b.setAttribute('type', 'button'); b.setAttribute('data-mact', WMAPUI_MORE[i].act);
    el.appendChild(b);
  }
  el.addEventListener('click', function (ev) {
    var t = ev.target, a;
    while (t && t !== el && !(t.getAttribute && t.getAttribute('data-mact'))) t = t.parentNode;
    if (!t || t === el) return;
    a = t.getAttribute('data-mact');
    wmapUiMoreSet(false);
    wmapUiAct(a);
  });
  SHELL.el.appendChild(el);
  WMAPUI.moreEl = el;
}

// ───────── 動作 ─────────
function wmapUiAct(a) {
  if (!WMAPUI.inited) return false;
  if (a === 'more') { wmapUiMoreSet(!WMAPUI.more); return true; }
  wmapUiMoreSet(false);
  if (a === 'city') return WMAPUI.city ? wmapUiExitCity() : wmapUiEnterCity();
  if (a === 'city-out') { wmapUiExitCity(); return true; }
  if (a === 'skills') return typeof ldNavPush === 'function' ? ldNavPush('skilldex') : false;
  if (a === 'team') return typeof ldNavPush === 'function' ? ldNavPush('team', { n: 1, mode: 'edit' }) : false;
  if (a === 'forge') return typeof ldNavPush === 'function' ? ldNavPush('forge') : false;
  if (a === 'yard') return typeof ldHomeYard === 'function' ? ldHomeYard() : false;
  if (a === 'report') return typeof ldNavPush === 'function' ? ldNavPush('wmgrp') : false;   // W6:戰報清單(wmap_settle_ui.js 的 wmgrp 頁)
  return typeof shellAct === 'function' ? shellAct(a) : false;
}
function wmapUiBack() {
  if (!WMAPUI.inited) return false;
  if (typeof wmapGoUiBack === 'function' && wmapGoUiBack()) return true;   // 改目標模式 / 軍隊選單先收
  if (WMAPUI.more) { wmapUiMoreSet(false); return true; }
  if (!WMAPUI.city && typeof WMAP !== 'undefined' && WMAP.on && WMAP.sel >= 0) { wmapSelect(-1); return true; }
  if (WMAPUI.city) return wmapUiExitCity();
  return false;
}
function wmapUiOnKey(ev) {   // window 捕獲階段:只在 ldNav 堆疊為空、沒有別的面板時處理(堆疊有頁時 ldNav / panelmgr 自己處理)
  if (!ev || (ev.key !== 'Escape' && ev.key !== 'Esc')) return;
  if (wmapUiDepth() > 0 || wmapUiPanelBusy()) return;
  if (wmapUiBack() && ev.preventDefault) ev.preventDefault();
}
function wmapUiOnSelect(gi) {
  if (WMAPUI.more) wmapUiMoreSet(false);
  if (gi >= 0 && WMAP.WG && gi === WMAP.WG.c0) {   // 點主城 = 進主城內頁(不開資訊卡)
    wmapSelect(-1);
    wmapUiEnterCity();
  }
}

// ───────── 外觀同步 ─────────
function wmapUiDockSync() {
  var d = SHELL.dk && SHELL.dk.city, b, lab, old, nu;
  if (d && d.b) {
    b = d.b; lab = b.querySelector('.sh-dl');
    if (lab && lab.textContent !== (WMAPUI.city ? '出城' : '主城')) {
      lab.textContent = WMAPUI.city ? '出城' : '主城';
      b.setAttribute('aria-label', lab.textContent);
      old = b.querySelector('.ldh-dic');
      if (old && typeof ldArt === 'function') { nu = ldArt(WMAPUI.city ? 'bld_men' : 'bld_fu', 'sh-dic ldh-dic'); b.replaceChild(nu, old); }
    }
    b.classList.toggle('on', WMAPUI.city);
  }
  d = SHELL.dk && SHELL.dk.more;
  if (d && d.b) { d.b.setAttribute('aria-expanded', WMAPUI.more ? 'true' : 'false'); d.b.classList.toggle('on', WMAPUI.more); }
}
function wmapUiTick() {
  var evs = [], i, rec = false, tour = false;
  wmapUiCamSave();
  try { if (typeof shellEvents === 'function') evs = shellEvents(Date.now()); } catch (e) { evs = []; }
  for (i = 0; i < evs.length; i++) if (evs[i].dot) { if (evs[i].id === 'tour') tour = true; else rec = true; }
  if (WMAPUI.rrDot) WMAPUI.rrDot.hidden = !rec;
  if (SHELL.dk && SHELL.dk.more && SHELL.dk.more.dot) SHELL.dk.more.dot.hidden = !tour;
}

// ───────── 建置 ─────────
function wmapUiInit() {
  var scene, rr, bld, nm;
  if (WMAPUI.inited || !wmapUiOn() || !SHELL.el || typeof document === 'undefined') return false;
  scene = SHELL.el.querySelector ? SHELL.el.querySelector('.sh-scene') : null;
  if (!scene || typeof wmapMount !== 'function') return false;
  if (!(typeof WMAP !== 'undefined' && WMAP.on) && !wmapMount({ parent: scene })) return false;
  if (WMAP.root && WMAP.root.parentNode !== scene) scene.appendChild(WMAP.root);
  WMAPUI.inited = true;
  wmapUiBodyCls('wm-on', true);
  WMAP.onSelect = wmapUiOnSelect;
  wmapUiReflow();
  wmapUiCamLoad();
  wmapUiMoreBuild();
  rr = wmapUiEl('button', 'ldh-rb ldh-rr');   // 右綠圓鈕 = 招募(開卡包的抽卡分頁)
  rr.setAttribute('type', 'button'); rr.setAttribute('aria-label', '招募'); rr.setAttribute('data-rb', 'recruit');
  rr.appendChild(ldArt('nav_recruit', 'ldh-ric'));
  WMAPUI.rrDot = wmapUiEl('i', 'ldh-dot'); WMAPUI.rrDot.hidden = true;
  rr.appendChild(WMAPUI.rrDot);
  rr.addEventListener('click', function () { wmapUiMoreSet(false); if (typeof shellAct === 'function') shellAct('cards:D'); });
  SHELL.el.appendChild(rr);
  WMAPUI.rr = rr;
  if (typeof LDH !== 'undefined' && LDH.plq && LDH.plq.gate) {   // 城門木牌 = 出城
    nm = LDH.plq.gate.querySelector ? LDH.plq.gate.querySelector('.ldh-nm') : null;
    if (nm) nm.textContent = '出城';
    LDH.plq.gate.setAttribute('aria-label', '出城');
  }
  bld = WMAP.vp;
  if (bld) wmapUiAdd(bld, 'pointerdown', function () { if (WMAPUI.more) wmapUiMoreSet(false); });   // 點地圖任何處收起〔更多〕
  wmapUiAdd(window, 'keydown', wmapUiOnKey, true);
  wmapUiAdd(window, 'popstate', wmapUiOnPop);
  wmapUiAdd(window, 'pagehide', wmapUiCamSave);
  wmapUiAdd(document, 'visibilitychange', function () { if (document.hidden) wmapUiCamSave(); });
  wmapUiDockSync();
  if (typeof setInterval === 'function') WMAPUI.tid = setInterval(wmapUiTick, 1000);
  wmapUiTick();
  if (typeof wmapGoUiInit === 'function') wmapGoUiInit();   // W3 派兵 / 行軍指令 / 行軍層(js/wmap_go_ui.js)
  if (typeof wmapPnlInit === 'function') wmapPnlInit();   // W6 部隊面板 / 倒數浮條 / 勢力名聲膠囊 / 迷你地圖(js/wmap_panels.js)
  return true;
}

// v65 發版:舊存檔(v64 以前的 world.v2 / wm.v1)第一次在 wmap 開啟下載入時各備份一份(後綴 .bak_v64,只寫一次、不覆蓋;存檔格式不遷移,舊行程由 wd_core 照舊結算)。
(function () {
  var keys = ['lorddomain.world.v2', 'lorddomain.wm.v1'], i, v;
  try {
    if (typeof localStorage === 'undefined' || typeof featureOn !== 'function' || !featureOn('wmap')) return;   // @DORMANT wmap
    for (i = 0; i < keys.length; i++) {
      v = localStorage.getItem(keys[i]);
      if (v && localStorage.getItem(keys[i] + '.bak_v64') === null) localStorage.setItem(keys[i] + '.bak_v64', v);
    }
  } catch (e) { /* 備份失敗(容量 / 無痕)不影響遊戲 */ }
})();
