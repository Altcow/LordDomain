// js/cityadvisorui.js — 民情總覽長條圖、指標辭典、錨點小浮卡、縣丞精靈(PLAN_NOLEVEL §4.4 §5 §6 NL3b/NL3c 最小版)。
// 入口:頂列繁榮度晶片(#csChip)旁一顆小圖示 #advChip(角標 = 最危急層與數量);點開底部停靠面板 #advDock(長條 / 清單 / 顧問 三分頁)。
// 面板規則:同時最多一個大面板(辭典 #advDict)與一個浮卡(#advCard);浮卡與氣泡不進正中央(x25~75% × y20~80%),直版落在 y ≥ 80% 底帶、橫版落在 x ≥ 75% 右欄。
// 面板管理器 js/panelmgr.js 存在時透過 panelOpen/panelClose(typeof 守衛)接入;不存在時用自管開關。樣式由本檔注入(<style id="advStyle">)。
// 引擎 cityadvisor.js、資料 cityadvisor_data.js。不發聲。ES2017;不用 ?. ??。
// 全域名稱:initAdvUI advUiToggle advUiOpenDock advUiCloseDock advUiCard advUiCardClose advUiHelp advUiDictClose advUiRefresh advUiMode advUiTick

var ADV_MODE_KEY = 'lorddomain.adv.mode';
var ADV_MODES = ['full', 'mini', 'off'];
var ADV_MODE_NAME = { full: '完整', mini: '縮小', off: '關閉' };
var ADV_LONGPRESS_MS = 450;
var ADV_BUBBLE_GAP_SEC = 90;

var advUi = { inited: false, dockOpen: false, tab: 'bars', card: null, dict: null, mode: 'full', sig: '', lastPop: -1e9, lastMainId: '', bubbleId: '', tipTimer: 0, pressTimer: 0, pressed: false, el: {} };

function advDoc() { return (typeof document !== 'undefined' && document && document.body) ? document : null; }
function advE(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function advBtn(text, cls, fn, label) {
  var b = advE('button', cls || 'adv-btn', text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); fn(ev); });
  return b;
}
function advVp() {
  var w = 375, h = 667;
  if (typeof window !== 'undefined' && window) { if (window.innerWidth) w = window.innerWidth; if (window.innerHeight) h = window.innerHeight; }
  return { w: w, h: h, land: w >= h };
}
function advUiMode() {
  var m = advUi.mode;
  try { m = localStorage.getItem(ADV_MODE_KEY) || m; } catch (e) { /* 略過 */ }
  if (ADV_MODES.indexOf(m) < 0) m = 'full';
  advUi.mode = m;
  return m;
}
function advUiSetMode(m) {
  advUi.mode = m;
  try { localStorage.setItem(ADV_MODE_KEY, m); } catch (e) { /* 略過 */ }
  advUiRefresh(true);
}
function advCityActive() {
  if (typeof world === 'undefined' || !world) return false;
  if (typeof isCityOnly === 'function') { try { return !!isCityOnly(); } catch (e) { return false; } }
  return true;
}
// 指標小圖示節點(js/uiicons.js 存在且開啟時回 <img>;否則回 fallback 文字或 null)
function advIcon(id, px, fb) { return typeof uiIconNode === 'function' ? uiIconNode(id, px, fb) : (fb ? advE('span', null, fb) : null); }
function advObjName(id) { return (typeof OBJECTS !== 'undefined' && OBJECTS[id] && OBJECTS[id].name) || id; }
function advTechName(id) { return (typeof TECHS !== 'undefined' && TECHS[id] && TECHS[id].name) || id; }

// ───────── 樣式 ─────────
var ADV_CSS = [
  '#advChip{flex:0 0 auto;position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:rgba(47,59,77,.9);border:1px solid #45566e;color:#e8edf2;font-size:15px;line-height:1;cursor:pointer;padding:0}',
  '#advChip .adv-badge{position:absolute;right:-4px;top:-5px;min-width:15px;height:15px;border-radius:8px;font-size:10px;line-height:15px;text-align:center;font-weight:700;padding:0 2px;color:#fff}',
  '.adv-t0{background:#2f8f4e}.adv-t1{background:#c99a1e;color:#1d1600!important}.adv-t2{background:#c0392b}',
  '#advChip[hidden],#advDock[hidden],#advCard[hidden],#advDict[hidden],#advSprite[hidden],#advTip[hidden]{display:none!important}',
  'body.photo-mode #advChip,body.photo-mode #advDock,body.photo-mode #advSprite,body.atk-mode #advChip,body.atk-mode #advDock,body.atk-mode #advSprite,body.sandbox #advChip,body.sandbox #advDock,body.sandbox #advSprite{display:none!important}',
  '#advDock{position:fixed;left:0;right:0;bottom:0;height:22vh;min-height:150px;z-index:20;background:rgba(24,30,40,.96);border-top:1px solid #45566e;color:#e8edf2;font-size:12px;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)}',
  '#advDock.adv-land{left:75%;top:0;height:auto;min-height:0;border-top:0;border-left:1px solid #45566e}',
  '.adv-head{display:flex;align-items:center;gap:4px;padding:3px 6px;flex:0 0 auto;border-bottom:1px solid #35425a}',
  '.adv-tab{background:#2a3547;color:#cfd8e3;border:1px solid #45566e;border-radius:6px;padding:3px 7px;font-size:12px;min-height:26px}',
  '.adv-tab.on{background:#46618a;color:#fff}',
  '.adv-btn{background:#34445e;color:#e8edf2;border:1px solid #5a6f92;border-radius:6px;padding:4px 9px;font-size:12px;min-height:28px}',
  '.adv-x{margin-left:auto;background:#3a2a2a;color:#fff;border:1px solid #7a4a4a;border-radius:6px;min-width:30px;min-height:28px;font-size:14px}',
  '.adv-gear{background:transparent;color:#cfd8e3;border:1px solid #45566e;border-radius:6px;min-height:26px;font-size:11px;padding:2px 5px}',
  '.adv-body{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 6px}',
  '.adv-bars{display:flex;gap:6px;align-items:stretch;height:100%;overflow-x:auto}',
  '.adv-col{flex:0 0 36px;display:flex;flex-direction:column;align-items:center;cursor:pointer;touch-action:manipulation}',
  '.adv-col .ui-ic{margin-bottom:1px}.adv-row .ui-ic{flex:0 0 auto}',
  '.adv-mk{font-size:11px;line-height:13px;white-space:nowrap}',
  '.adv-track{position:relative;flex:1 1 auto;width:30px;min-height:48px;border-radius:4px;overflow:hidden;border:1px solid #4a5a72}',
  '.adv-band{position:absolute;left:0;right:0}',
  '.adv-bg0{background:rgba(60,160,90,.30)}.adv-bg1{background:rgba(210,170,40,.32)}.adv-bg2{background:rgba(200,70,55,.34)}',
  '.adv-line{position:absolute;left:0;right:0;height:0;border-top:1px dashed #e8edf2;opacity:.8}',
  '.adv-fill{position:absolute;left:5px;right:5px;bottom:0;border-radius:3px 3px 0 0;border:1px solid rgba(255,255,255,.7)}',
  '.adv-f0{background:#3fae66}',
  '.adv-f1{background:repeating-linear-gradient(45deg,#e0b43a 0 4px,#8a6a10 4px 7px)}',
  '.adv-f2{background:repeating-linear-gradient(45deg,#d4503f 0 3px,#6c1f17 3px 5px),repeating-linear-gradient(-45deg,transparent 0 3px,rgba(0,0,0,.45) 3px 5px);background-blend-mode:normal}',
  '.adv-nm{font-size:11px;line-height:14px;white-space:nowrap}',
  '.adv-blink .adv-mk{animation:advBlink 1s steps(2,jump-none) infinite}',
  '@keyframes advBlink{50%{opacity:.25}}',
  '@media (prefers-reduced-motion:reduce){.adv-blink .adv-mk{animation:none}}',
  '.adv-rows .adv-row{display:flex;align-items:center;gap:5px;padding:3px 0;cursor:pointer}',
  '.adv-row .adv-hb{position:relative;flex:1 1 auto;height:12px;border:1px solid #4a5a72;border-radius:3px;overflow:hidden}',
  '.adv-row .adv-hf{position:absolute;left:0;top:1px;bottom:1px;border-radius:2px}',
  '.adv-item{display:flex;gap:6px;align-items:flex-start;padding:5px 0;border-bottom:1px solid #2d3a4e}',
  '.adv-item .adv-it{flex:1 1 auto;line-height:1.45}',
  '.adv-empty{color:#9fb0c6;padding:6px 0}',
  '#advCard{position:fixed;z-index:30;width:290px;max-width:calc(100vw - 16px);box-sizing:border-box;background:rgba(30,38,52,.98);border:1px solid #6a82aa;border-radius:8px;color:#e8edf2;font-size:12px;padding:6px 34px 6px 8px;line-height:1.45;overflow:auto}',
  '#advCard .adv-x{position:absolute;right:3px;top:3px;margin:0}',
  '#advCard .adv-q{font-weight:700;display:flex;align-items:center;gap:6px;min-height:40px}',
  '#advCard .adv-acts{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap}',
  '#advTip{position:fixed;z-index:60;max-width:160px;max-height:64px;overflow:hidden;background:rgba(20,26,36,.96);border:1px solid #6a82aa;border-radius:6px;color:#e8edf2;font-size:11px;padding:3px 6px;pointer-events:none}',
  '#advDict{position:fixed;left:8px;right:8px;top:8px;bottom:8px;z-index:41;background:rgba(24,30,40,.99);border:1px solid #6a82aa;border-radius:10px;color:#e8edf2;display:flex;flex-direction:column;font-size:13px;line-height:1.6}',
  '#advDict .adv-dh{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid #35425a;font-size:15px;font-weight:700;flex:0 0 auto}',
  '#advDict .adv-db{flex:1 1 auto;overflow:auto;padding:8px 12px;min-height:0}',
  '#advDict .adv-df{display:flex;gap:8px;justify-content:center;padding:6px;border-top:1px solid #35425a;flex:0 0 auto}',
  '#advDict h4{margin:8px 0 2px;color:#e0c06a;font-size:13px}',
  '#advDict .adv-link{color:#8fc0ff;text-decoration:underline;cursor:pointer}',
  '#advSprite{position:fixed;z-index:19;display:flex;align-items:flex-start;gap:4px;pointer-events:none}',
  '#advSprite .adv-face{pointer-events:auto;position:relative;width:38px;height:38px;border-radius:50%;background:#f0d9a8;border:2px solid #7a5a2a;font-size:22px;line-height:34px;text-align:center;cursor:pointer;flex:0 0 auto}',
  '#advSprite .adv-face .adv-dot{position:absolute;right:-3px;top:-3px;width:13px;height:13px;border-radius:50%;border:1px solid #fff}',
  '#advSprite .adv-bub{pointer-events:auto;background:rgba(40,32,18,.96);border:1px solid #c9a24a;border-radius:8px;color:#f6ecd0;font-size:12px;line-height:1.4;padding:4px 7px;min-width:0}',
  '#advSprite .adv-bub .adv-acts{display:flex;gap:6px;margin-top:3px}',
  '#advSprite .adv-bub .adv-btn{min-height:24px;padding:2px 8px}'
].join('\n');

function advInjectCss() {
  var st;
  if (!advDoc() || document.getElementById('advStyle')) return;
  st = advE('style'); st.id = 'advStyle'; st.textContent = ADV_CSS;
  (document.head || document.body).appendChild(st);
}

// ───────── 面板管理器接口(typeof 守衛)─────────
function advPmOpen(id, kind, el, anchor, size) {
  var ok = true;
  if (typeof panelOpen === 'function') {
    ok = panelOpen(id, { kind: kind, el: el, anchor: anchor || null, size: size || null, onClose: function () { advOnPanelClosed(id); } });
    if (!ok) return false;
  } else {
    el.hidden = false;
    if (kind === 'big') { advUiCardClose(); }
    if (kind === 'card' && advUi.dict) return false;
  }
  return true;
}
function advPmClose(id, el) {
  if (typeof panelClose === 'function' && typeof panelIsOpen === 'function' && panelIsOpen(id)) panelClose(id);
  else if (el) el.hidden = true;
  advOnPanelClosed(id);
}
function advOnPanelClosed(id) {
  if (id === 'adv-dock') { advUi.dockOpen = false; if (advUi.el.dock) advUi.el.dock.hidden = true; }
  else if (id === 'adv-card') { advUi.card = null; if (advUi.el.card) advUi.el.card.hidden = true; }
  else if (id === 'adv-dict') { advUi.dict = null; if (advUi.el.dict) advUi.el.dict.hidden = true; }
  if (advDoc()) advUiRefresh(true);
}

// ───────── 初始化 ─────────
function initAdvUI() {
  var top, ref, e = advUi.el;
  if (advUi.inited || !advDoc()) return;
  advInjectCss();
  advUiMode();
  e.chip = advE('button', null, '🧭'); e.chip.id = 'advChip'; e.chip.type = 'button'; e.chip.hidden = true;
  e.chip.title = '民情總覽與縣丞建議'; e.chip.setAttribute('aria-label', '民情總覽與縣丞建議');
  e.badge = advE('span', 'adv-badge'); e.badge.hidden = true; e.chip.appendChild(e.badge);
  e.chip.addEventListener('click', function () { advUiToggle(); });
  top = document.getElementById('topbar');
  if (top) { ref = document.getElementById('csChip'); top.insertBefore(e.chip, ref && ref.nextSibling ? ref.nextSibling : null); }
  else document.body.appendChild(e.chip);
  e.dock = advE('div'); e.dock.id = 'advDock'; e.dock.hidden = true; document.body.appendChild(e.dock);
  e.card = advE('div'); e.card.id = 'advCard'; e.card.hidden = true; document.body.appendChild(e.card);
  e.dict = advE('div'); e.dict.id = 'advDict'; e.dict.hidden = true; document.body.appendChild(e.dict);
  e.tip = advE('div'); e.tip.id = 'advTip'; e.tip.hidden = true; document.body.appendChild(e.tip);
  e.sprite = advE('div'); e.sprite.id = 'advSprite'; e.sprite.hidden = true; document.body.appendChild(e.sprite);
  if (typeof panelRegister === 'function') {
    panelRegister('adv-dock', { kind: 'dock', el: e.dock });
    panelRegister('adv-card', { kind: 'card', el: e.card });
    panelRegister('adv-dict', { kind: 'big', el: e.dict });
  } else {
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (advUi.dict) advUiDictClose(); else if (advUi.card) advUiCardClose(); else if (advUi.dockOpen) advUiCloseDock();
    });
  }
  advUi.inited = true;
  if (typeof setInterval === 'function') setInterval(function () { advUiTick(1); }, 1000);
  advUiTick(0);
}

function advUiTick(dt) {
  var c;
  if (!advUi.inited) return;
  if (!advCityActive()) { advUi.el.chip.hidden = true; advUi.el.sprite.hidden = true; if (advUi.dockOpen) advUiCloseDock(); return; }
  advUi.el.chip.hidden = false;
  if (typeof advTick !== 'function') return;
  c = advTick(dt);
  if (!c) return;
  advUiRefresh(false);
}

// ───────── 開關 ─────────
function advUiToggle() { if (advUi.dockOpen) advUiCloseDock(); else advUiOpenDock('bars'); }
function advUiOpenDock(tab) {
  if (!advUi.inited) return;
  advUi.tab = tab || advUi.tab || 'bars';
  advUi.dockOpen = true;
  advUi.el.dock.hidden = false;
  if (!advPmOpen('adv-dock', 'dock', advUi.el.dock)) { advUi.dockOpen = false; return; }
  advUiRefresh(true);
}
function advUiCloseDock() { advUiCardClose(); advPmClose('adv-dock', advUi.el.dock); }

// ───────── 長條圖 ─────────
function advSig(c) {
  return advUi.tab + '|' + advVp().land + '|' + advUi.mode + '|' + c.bars.map(function (b) { return b.id + b.level + Math.round(b.val); }).join(',') + '|' + c.items.map(function (i) { return i.id; }).join(',');
}
function advTopItem() { var c = advGet(false); return c.items.filter(function (i) { return i.tier !== 'B'; })[0] || null; }

function advRenderBars(body, c) {
  var land = advVp().land, wrap = advE('div', land ? 'adv-rows' : 'adv-bars');
  if (!c.bars.length) { body.appendChild(advE('div', 'adv-empty', '還沒有可看的民情,先蓋幾戶民居吧。')); return; }
  c.bars.forEach(function (b) {
    var el = land ? advBarRow(b) : advBarCol(b);
    advBindPress(el, b.id);
    wrap.appendChild(el);
  });
  body.appendChild(wrap);
}
function advBarCol(b) {
  var col = advE('div', 'adv-col' + (b.level === 2 ? ' adv-blink' : '')), tr = advE('div', 'adv-track'), mk = advE('div', 'adv-mk', b.mark + b.word), fill, ic;
  mk.style.color = b.level === 2 ? '#ff8a7a' : (b.level === 1 ? '#f0cf6a' : '#8fe0a8');
  col.setAttribute('role', 'button'); col.setAttribute('aria-label', b.name + ' ' + Math.round(b.val) + b.unit + ' ' + b.word);
  col.setAttribute('data-bar', b.id);
  ic = advIcon(b.id, 28, '');
  if (ic) col.appendChild(ic);
  col.appendChild(mk);
  advBand(tr, 0, b.yFrac, 'adv-bg2'); advBand(tr, b.yFrac, b.gFrac, 'adv-bg1'); advBand(tr, b.gFrac, 1, 'adv-bg0');
  advLineAt(tr, b.yFrac); advLineAt(tr, b.gFrac);
  fill = advE('div', 'adv-fill adv-f' + b.level); fill.style.height = Math.round(b.frac * 100) + '%';
  tr.appendChild(fill);
  col.appendChild(tr);
  col.appendChild(advE('div', 'adv-nm', b.name));
  return col;
}
function advBand(tr, a, z, cls) { var d = advE('div', 'adv-band ' + cls); d.style.bottom = Math.round(a * 100) + '%'; d.style.height = Math.round((z - a) * 100) + '%'; tr.appendChild(d); }
function advLineAt(tr, f) { if (f <= 0 || f >= 1) return; var d = advE('div', 'adv-line'); d.style.bottom = Math.round(f * 100) + '%'; tr.appendChild(d); }
function advBarRow(b) {
  var row = advE('div', 'adv-row'), hb = advE('div', 'adv-hb'), f = advE('div', 'adv-hf adv-f' + b.level), mk = advE('span', 'adv-mk', b.mark + b.word), ic;
  row.setAttribute('data-bar', b.id);
  mk.style.color = b.level === 2 ? '#ff8a7a' : (b.level === 1 ? '#f0cf6a' : '#8fe0a8');
  ic = advIcon(b.id, 28, '');
  if (ic) row.appendChild(ic);
  row.appendChild(advE('span', 'adv-nm', b.name));
  f.style.width = Math.round(b.frac * 100) + '%';
  hb.appendChild(f); row.appendChild(hb); row.appendChild(mk);
  row.appendChild(advE('span', 'adv-nm', Math.round(b.val) + b.unit));
  return row;
}
// 點 = 浮卡;長按 = 簡短說明
function advBindPress(el, id) {
  el.addEventListener('pointerdown', function () {
    advUi.pressed = false;
    if (advUi.pressTimer) clearTimeout(advUi.pressTimer);
    advUi.pressTimer = setTimeout(function () { advUi.pressed = true; advShowTip(id, el); }, ADV_LONGPRESS_MS);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { el.addEventListener(t, function () { if (advUi.pressTimer) { clearTimeout(advUi.pressTimer); advUi.pressTimer = 0; } }); });
  el.addEventListener('click', function () { if (advUi.pressed) { advUi.pressed = false; return; } advUiCard(id, el); });
}
function advShowTip(id, el) {
  var h = STAT_HELP[id], r, vp = advVp(), t = advUi.el.tip, rect;
  if (!h) return;
  t.textContent = h.brief.split('。')[0] + '。';
  t.hidden = false;
  r = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: 30, height: 30 };
  rect = advTipRect(r, vp);
  t.style.left = Math.round(rect.x) + 'px'; t.style.top = Math.round(rect.y) + 'px';
  if (advUi.tipTimer) clearTimeout(advUi.tipTimer);
  advUi.tipTimer = setTimeout(function () { t.hidden = true; }, 2500);
}
// 暫態氣泡(≤160×64)放在錨點上方;若與中央區重疊,改貼底帶 / 右欄的邊緣
function advTipRect(r, vp) {
  var w = 160, h = 64, x = Math.max(4, Math.min(vp.w - w - 4, r.left + r.width / 2 - w / 2)), y = r.top - h - 4, c = advCentralRect(vp.w, vp.h), t = { x: x, y: y, w: w, h: h };
  if (advRectsOverlap(t, c)) { t.y = Math.max(4, vp.h * ADV_CENTER.y0 - h - 2); if (advRectsOverlap(t, c)) t.y = Math.max(4, c.y - h - 2); }
  return t;
}

// ───────── 清單(警示面板)與顧問 ─────────
function advRenderAlerts(body, c) {
  if (!c.alerts.length) { body.appendChild(advE('div', 'adv-empty', '■ ▲ 目前沒有危急或警示,一切安好。')); return; }
  c.alerts.forEach(function (it) { body.appendChild(advItemRow(it, true)); });
}
function advRenderAdviser(body, c) {
  var q = c.expand, mode = advUi.mode;
  body.appendChild(advE('div', 'adv-empty', '縣丞進言(' + c.counts.R + ' 危急 · ' + c.counts.Y + ' 警示 · ' + c.counts.B + ' 建議)'));
  q.forEach(function (it, i) { body.appendChild(advItemRow(it, i === 0)); });
  if (!q.length) body.appendChild(advE('div', 'adv-empty', '暫無進言。'));
  if (mode !== 'full') body.appendChild(advE('div', 'adv-empty', '縣丞目前為「' + ADV_MODE_NAME[mode] + '」模式(右上 ⚙ 切換)。'));
}
function advItemRow(it, withGo) {
  var row = advE('div', 'adv-item'), mk = advE('span', 'adv-mk', ADV_TIER_MARK[it.tier] + ADV_TIER_NAME[it.tier]), tx = advE('div', 'adv-it', it.text), acts = advE('div', 'adv-acts');
  mk.style.color = it.tier === 'R' ? '#ff8a7a' : (it.tier === 'Y' ? '#f0cf6a' : '#8fc0ff');
  row.appendChild(mk);
  if (STAT_HELP[it.stat]) acts.appendChild(advBtn('說明', 'adv-btn', function () { advUiHelp(it.stat); }));
  acts.appendChild(advBtn(it.go && it.go.kind === 'help' ? '詳情' : '前往', 'adv-btn', function () { advUiGoItem(it); }));
  if (it.tier !== 'R' && !it.core) acts.appendChild(advBtn('知道了', 'adv-btn', function () { advUiAck(it); }));
  tx.appendChild(acts);
  row.appendChild(tx);
  return row;
}
function advUiGoItem(it) { if (typeof advGo === 'function') advGo(it); advUiAfterGo(); }
function advUiAfterGo() { if (advUi.card) advUiCardClose(); }
function advUiAck(it) { var m = advBind(); advAck(m, it.id, advXun()); advUiRefresh(true); advGet(true); advUiRefresh(true); }

// ───────── 主繪製 ─────────
function advUiRefresh(force) {
  var c, e = advUi.el, w, hd, body, b, tabs, i, nR, cnt, sig;
  if (!advUi.inited || !advCityActive()) return;
  c = advGet(false);
  if (!c) return;
  advUiMode();
  // 小圖示角標:符號 + 數量,不只靠顏色
  cnt = c.counts.R || c.counts.Y;
  e.badge.hidden = !cnt;
  if (cnt) { e.badge.textContent = (c.counts.R ? '■' : '▲') + cnt; e.badge.className = 'adv-badge ' + (c.counts.R ? 'adv-t2' : 'adv-t1'); }
  advUiSprite(c);
  advUiAutoHelp(c);
  if (!advUi.dockOpen) return;
  sig = advSig(c);
  if (!force && sig === advUi.sig) return;
  advUi.sig = sig;
  w = e.dock; while (w.firstChild) w.removeChild(w.firstChild);
  w.className = advVp().land ? 'adv-land' : '';
  hd = advE('div', 'adv-head');
  [['bars', '長條'], ['list', '清單' + (c.alerts.length ? ' ' + (c.counts.R ? '■' + c.counts.R : '') + (c.counts.Y ? '▲' + c.counts.Y : '') : '')], ['adv', '顧問']].forEach(function (t) {
    var tb = advBtn(t[1], 'adv-tab' + (advUi.tab === t[0] ? ' on' : ''), function () { advUi.tab = t[0]; advUiCardClose(); advUiRefresh(true); });
    hd.appendChild(tb);
  });
  hd.appendChild(advBtn('⚙' + ADV_MODE_NAME[advUi.mode], 'adv-gear', function () { advUiSetMode(ADV_MODES[(ADV_MODES.indexOf(advUi.mode) + 1) % ADV_MODES.length]); }, '縣丞顯示模式'));
  hd.appendChild(advBtn('✕', 'adv-x', function () { advUiCloseDock(); }, '關閉'));
  w.appendChild(hd);
  body = advE('div', 'adv-body');
  if (advUi.tab === 'bars') advRenderBars(body, c); else if (advUi.tab === 'list') advRenderAlerts(body, c); else advRenderAdviser(body, c);
  w.appendChild(body);
}

// ───────── 錨點小浮卡 ─────────
function advUiCard(id, anchorEl) {
  var h = STAT_HELP[id], c = advGet(false), bar, it, card = advUi.el.card, r, vp = advVp(), size = { w: 290, h: 150 }, fb, anchor, q, ic;
  if (!h || !advUi.inited) return false;
  if (advUi.dict) return false;
  bar = c.bars.filter(function (b) { return b.id === id; })[0];
  it = c.items.filter(function (x) { return x.stat === id && x.tier !== 'B'; })[0] || c.items.filter(function (x) { return x.stat === id; })[0] || null;
  while (card.firstChild) card.removeChild(card.firstChild);
  card.appendChild(advBtn('✕', 'adv-x', function () { advUiCardClose(); }, '關閉'));
  q = advE('div', 'adv-q');
  ic = advIcon(id, 40, h.icon);
  if (ic) q.appendChild(ic);
  q.appendChild(advE('span', null, (ic && ic.tagName !== 'IMG' && ic.tagName !== 'img' ? ' ' : '') + h.name + ' · 這是什麼?'));
  card.appendChild(q);
  card.appendChild(advE('div', null, h.brief));
  if (bar) card.appendChild(advE('div', null, bar.mark + bar.word + ' 現值 ' + Math.round(bar.val) + bar.unit + ' · ' + h.range.split('、')[0].replace(/^.*?:/, '')));
  if (it) card.appendChild(advE('div', null, '建議:' + it.text));
  var acts = advE('div', 'adv-acts');
  acts.appendChild(advBtn('詳細說明', 'adv-btn', function () { advUiHelp(id); }));
  acts.appendChild(advBtn(it ? '前往' : '怎麼解決', 'adv-btn', function () { if (it) advUiGoItem(it); else advUiHelp(id); }));
  card.appendChild(acts);
  advUi.card = id;
  fb = advCardRect(vp.w, vp.h, size);       // 自管預設位置(不進正中央)
  card.style.position = 'fixed'; card.style.left = Math.round(fb.x) + 'px'; card.style.top = Math.round(fb.y) + 'px';
  card.style.maxHeight = Math.round(fb.h) + 'px'; card.style.maxWidth = Math.round(fb.w) + 'px';
  r = anchorEl && anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : null;
  anchor = r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  if (anchor && !vp.land && anchorEl === advUi.el.chip) anchor.x = Math.round((vp.w - anchor.w) / 2);   // 直版 🧭 靠左上:卡片仍對正中上方展開(否則被擠進窄的左欄)
  if (!advPmOpen('adv-card', 'card', card, anchor, size)) { advUi.card = null; card.hidden = true; return false; }
  card.hidden = false;
  return true;
}
function advUiCardClose() { if (advUi.card || (advUi.el.card && !advUi.el.card.hidden)) advPmClose('adv-card', advUi.el.card); }

// ───────── 指標辭典(大面板)─────────
function advDictOrder() {
  var c = advGet(false), ids = c.bars.map(function (b) { return b.id; });
  if (advUi.dict && ids.indexOf(advUi.dict) < 0) ids.push(advUi.dict);
  return ids;
}
function advUiHelp(id) {
  var h = STAT_HELP[id], d = advUi.el.dict, order, idx, hd, bd, ft, m, ic;
  if (!h || !advUi.inited) return false;
  advUi.dict = id;
  if (!advPmOpen('adv-dict', 'big', d)) { advUi.dict = null; return false; }
  advUiCardClose();
  while (d.firstChild) d.removeChild(d.firstChild);
  order = advDictOrder(); idx = order.indexOf(id);
  hd = advE('div', 'adv-dh');
  ic = advIcon(id, 40, h.icon);
  if (ic) hd.appendChild(ic);
  hd.appendChild(advE('span', null, (ic && ic.tagName !== 'IMG' && ic.tagName !== 'img' ? ' ' : '') + h.name + ' · 指標辭典'));
  hd.appendChild(advBtn('✕', 'adv-x', function () { advUiDictClose(); }, '關閉'));
  d.appendChild(hd);
  bd = advE('div', 'adv-db');
  bd.appendChild(advE('div', null, h.briefNovice));
  bd.appendChild(advE('div', null, h.brief));
  h.detail.forEach(function (p) { bd.appendChild(advE('p', null, p)); });
  bd.appendChild(advE('h4', null, '範圍與門檻')); bd.appendChild(advE('div', null, h.range));
  bd.appendChild(advE('h4', null, '影響來源'));
  bd.appendChild(advE('div', null, h.causes.map(function (x) { return advObjName(x.id); }).join('、') || '—'));
  bd.appendChild(advE('h4', null, '變紅的後果')); bd.appendChild(advE('div', null, h.redResult));
  bd.appendChild(advE('h4', null, '三步解法'));
  h.fix.forEach(function (f, i) { bd.appendChild(advE('div', null, (i + 1) + '. ' + f)); });
  if (h.techs && h.techs.length) { bd.appendChild(advE('h4', null, '相關科技')); bd.appendChild(advE('div', null, h.techs.map(advTechName).join('、'))); }
  if (h.links && h.links.length) {
    bd.appendChild(advE('h4', null, '相關指標'));
    h.links.forEach(function (l) {
      var a = advE('div', 'adv-link', (STAT_HELP[l.stat] ? STAT_HELP[l.stat].name : l.stat) + ':' + l.text);
      a.addEventListener('click', function () { advUiHelp(l.stat); });
      bd.appendChild(a);
    });
  }
  d.appendChild(bd);
  ft = advE('div', 'adv-df');
  ft.appendChild(advBtn('◀ 上一個', 'adv-btn', function () { if (order.length) advUiHelp(order[(idx - 1 + order.length) % order.length]); }));
  ft.appendChild(advBtn('回長條圖', 'adv-btn', function () { advUiDictClose(); advUiOpenDock('bars'); }));
  ft.appendChild(advBtn('下一個 ▶', 'adv-btn', function () { if (order.length) advUiHelp(order[(idx + 1) % order.length]); }));
  d.appendChild(ft);
  m = advBind(); advSeenHelp(m, id); advFlush();
  d.hidden = false;
  return true;
}
function advUiDictClose() { if (advUi.dict || (advUi.el.dict && !advUi.el.dict.hidden)) advPmClose('adv-dict', advUi.el.dict); }

// 首次某指標變紅:自動彈一次簡短說明浮卡(記入 seenHelp)
function advUiAutoHelp(c) {
  var m = advBind(), i, b;
  if (advUi.mode === 'off' || advUi.card || advUi.dict || advUi.dockOpen) return;
  if (typeof tutActive === 'function' && tutActive()) return;   // 新手教學期間顧問不搶卡片(首次紅燈的說明浮卡留到教學結束後)
  for (i = 0; i < c.bars.length; i++) {
    b = c.bars[i];
    if (b.level === 2 && !m.seenHelp[b.id] && STAT_HELP[b.id]) {
      advSeenHelp(m, b.id); advFlush();
      advUiCard(b.id, advUi.el.chip);
      return;
    }
  }
}

// ───────── 縣丞精靈(Q 版 emoji + 氣泡)─────────
function advUiSprite(c) {
  var e = advUi.el, sp = e.sprite, vp = advVp(), mode = advUi.mode, main = c.main, show, pop, now, face, dot, bub, acts, rect, nowSec;
  if (mode === 'off' || !main) { sp.hidden = true; return; }
  nowSec = advGetSec();
  show = mode === 'full' && !advUi.dockOpen && main.tier !== 'B' ? true : (mode === 'full' && !advUi.dockOpen && main.id === advUi.bubbleId);
  if (mode === 'full' && !advUi.dockOpen && main.id !== advUi.lastMainId && (main.tier === 'R' || nowSec - advUi.lastPop >= ADV_BUBBLE_GAP_SEC)) {
    advUi.bubbleId = main.id; advUi.lastPop = nowSec; show = true;
  }
  advUi.lastMainId = main.id;
  if (advUi.dockOpen) { sp.hidden = true; return; }
  sp.hidden = false;
  while (sp.firstChild) sp.removeChild(sp.firstChild);
  face = advE('div', 'adv-face', main.tier === 'R' ? '😰' : (main.tier === 'Y' ? '🧐' : '🙂'));
  face.setAttribute('role', 'button'); face.setAttribute('aria-label', '縣丞');
  dot = advE('span', 'adv-dot adv-t' + (main.tier === 'R' ? 2 : (main.tier === 'Y' ? 1 : 0))); face.appendChild(dot);
  face.addEventListener('click', function () { advUiOpenDock('adv'); });
  sp.appendChild(face);
  if (show && mode === 'full' && main.id === advUi.bubbleId && !(typeof nsEnabled === 'function' && nsEnabled())) {   // 「推薦下一步」開啟時由右上角小卡接手,縣丞不再跳氣泡(只留小臉入口)
    bub = advE('div', 'adv-bub', ADV_TIER_MARK[main.tier] + ' ' + main.text);
    acts = advE('div', 'adv-acts');
    acts.appendChild(advBtn('前往', 'adv-btn', function () { advUiGoItem(main); }));
    acts.appendChild(advBtn(main.tier === 'R' ? '收起' : '知道了', 'adv-btn', function () { if (main.tier !== 'R') advUi.bubbleId = main.id + '#ack'; else advUi.bubbleId = main.id + '#hide'; if (main.tier !== 'R') advUiAck(main); advUiRefresh(true); }));
    bub.appendChild(acts);
    bub.addEventListener('click', function () { advUiOpenDock('adv'); });
    sp.appendChild(bub);
  }
  // 位置:直版 = 底帶左側(y ≥ 80%);橫版 = 左側欄(x < 25%)中下;氣泡最大寬度限制在不進中央的範圍
  if (vp.land) { sp.style.left = '6px'; sp.style.top = Math.round(vp.h * 0.6) + 'px'; sp.style.right = 'auto'; sp.style.bottom = 'auto'; sp.style.maxWidth = Math.round(vp.w * 0.23) + 'px'; }
  else { rect = advCardRect(vp.w, vp.h, { w: vp.w - 12, h: 60 }); sp.style.left = '6px'; sp.style.top = Math.round(rect.y) + 'px'; sp.style.right = 'auto'; sp.style.bottom = 'auto'; sp.style.maxWidth = Math.round(vp.w - 12) + 'px'; }
}
function advGetSec() { return (typeof advRt !== 'undefined') ? advRt.playSec : 0; }

if (typeof document !== 'undefined' && document && document.body) initAdvUI();
else if (typeof document !== 'undefined' && document && document.addEventListener) document.addEventListener('DOMContentLoaded', function () { initAdvUI(); });
