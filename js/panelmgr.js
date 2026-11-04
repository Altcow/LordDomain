// js/panelmgr.js — 面板管理器(PLAN_NOLEVEL §7 / NL3a):同時最多 1 大面板 + 1 停靠面板 + 1 浮卡;互斥、單一 Esc、浮卡幾何、全螢幕隱藏、狀態還原。
// 全域名稱:panelRegister panelOpen panelClose panelCloseAll panelIsOpen panelTopId panelPlaceCard panelMapInputBlocked panelNoteMapGesture
//   panelFullscreen panelFsActive panelSyncFs panelBack panelSetStateHooks panelNoteIntentMove panelKindOpen;資料表 PANEL_Z PANEL_MUTEX PANEL_BLOCKED_BY PANEL_ESC_ORDER PANEL_FS_AUTO。 panelLsActive panelLsSet panelLsSync;常數 PANEL_LS。
// 漸進遷移:既有面板保留自己的 toggle 函式,只在開啟時呼叫 panelOpen(id)、關閉時呼叫 panelClose(id),並以 close 回呼讓管理器代為關閉互斥者。ES2017;不用 ?. ??。
var PANEL_Z = { hud: 10, dock: 20, card: 30, bigMask: 40, big: 41, dlgMask: 50, dlg: 51, transient: 60, guide: 70, fullscreen: 80, photoBack: 90 };
var PANEL_MUTEX = { big: ['big', 'card'], dock: ['dock'], card: ['card'] };      // 開啟某 kind 時,自動關閉這些 kind 的舊面板
var PANEL_BLOCKED_BY = { card: ['big'] };                                         // 這些 kind 開著時,該 kind 不能開
var PANEL_ESC_ORDER = ['big', 'card', 'dock'];                                    // Esc / 返回:由上而下關第一個
var PANEL_FS_AUTO = true;                                                         // 是否自動偵測拍照 / 錄影 / 戰鬥 / 釣魚 / 仙獸
var PANEL_CARD_LIMIT = { wFrac: 0.7, hFrac: 0.35 };
var PANEL_CENTER = { x0: 0.25, x1: 0.75, y0: 0.2, y1: 0.8 };
var PANEL_DRAG_PX = 6;
var PANEL_DIALOG_IDS = ['leaveDlg', 'settleDlg', 'stRoot'];

var panelDefs = {};
var panelOpenList = [];                 // 開啟順序(後開在後)
var panelFsReasons = {};
var panelFsHidden = [];                 // 全螢幕期間被隱藏的 el
var panelSnap = null;
var panelGesture = null;
var panelReplaying = false;
var panelMaskEl = null;
var panelHooks = { snap: null, restore: null };
var panelBound = false;

// ───── 橫版大面板模式(手機橫版:大面板開啟時隱藏城市 HUD、面板滿版、薄列 + 內容區上下滑動) ─────
// 規格常數(與 css/style.css 末段 :root 的 --ls-* 變數一致;tools/test_landscape.js 會核對)
var PANEL_LS = { query: '(orientation: landscape) and (max-height: 520px)', cls: 'panel-big-landscape', thin: 40, tap: 44, gap: 8, padX: 12, bodyFont: 14, subFont: 12, titleFont: 16, row: 48, iconMin: 28, iconMax: 40, ratio: 0.75 };
var panelLsExtra = {};                  // 非 panelmgr 管理的全版面板(例:城主府)以 panelLsSet(key,on) 登記
var panelLsMql = null;

function panelLsActive() {
  try {
    if (typeof window === 'undefined' || !window || typeof window.matchMedia !== 'function') return false;
    if (!panelLsMql) panelLsMql = window.matchMedia(PANEL_LS.query);
    return !!panelLsMql.matches;
  } catch (e) { return false; }
}
function panelLsSet(key, on) { if (on) panelLsExtra[key] = 1; else delete panelLsExtra[key]; panelLsSync(); }
function panelLsWant() { return panelLsActive() && !panelFsActive() && (!!panelKindOpen('big') || Object.keys(panelLsExtra).length > 0); }
function panelLsSync() {
  var on = panelLsWant();
  if (typeof document === 'undefined' || !document.body || !document.body.classList) return on;
  document.body.classList.toggle(PANEL_LS.cls, on);
  return on;
}

function panelKindOf(id) { return panelDefs[id] ? panelDefs[id].kind : ''; }

// def: {kind:'big'|'dock'|'card', el, close:fn, mutexGroup, closeOnMapDrag, esc, mask, place, ignore:fn(target), onClose}
function panelEl(d) {
  if (!d.el && d.elId && typeof document !== 'undefined' && document.getElementById) d.el = document.getElementById(d.elId);
  return d.el;
}
function panelRegister(id, def) {
  var d = def || {};
  panelDefs[id] = {
    id: id, kind: d.kind || 'big', el: d.el || null, elId: d.elId || '', close: d.close || null, mutexGroup: d.mutexGroup || '',
    closeOnMapDrag: d.closeOnMapDrag !== undefined ? !!d.closeOnMapDrag : (d.kind === 'card'),
    esc: d.esc !== undefined ? !!d.esc : true, mask: d.mask !== undefined ? !!d.mask : false,
    place: d.place !== undefined ? !!d.place : true, ignore: d.ignore || null, onClose: d.onClose || null,
    anchor: null, anchorEl: d.anchorEl || null, hiddenByFs: false, legacy: d.legacy !== undefined ? !!d.legacy : !!d.close
  };
  panelBind();
  return panelDefs[id];
}

function panelIsOpen(id) { return panelOpenList.indexOf(id) >= 0; }
function panelKindOpen(kind) {
  var i;
  for (i = panelOpenList.length - 1; i >= 0; i--) if (panelKind(panelOpenList[i]) === kind) return panelOpenList[i];
  return '';
}
function panelKind(id) { return panelKindOf(id); }

function panelTopId() {
  var i, id;
  for (i = 0; i < PANEL_ESC_ORDER.length; i++) {
    id = panelKindOpen(PANEL_ESC_ORDER[i]);
    if (id) return id;
  }
  return '';
}

function panelBigMasked() {
  var i, d;
  for (i = 0; i < panelOpenList.length; i++) {
    d = panelDefs[panelOpenList[i]];
    if (d && d.kind === 'big' && d.mask) return true;
  }
  return false;
}
function panelMapInputBlocked() { return panelBigMasked(); }

function panelRemove(id) {
  var i = panelOpenList.indexOf(id);
  if (i >= 0) panelOpenList.splice(i, 1);
}

function panelOpen(id, opts) {
  var d = panelDefs[id], o = opts || {}, k, i, other, list, blocked;
  if (!d) {
    if (!o.kind) return false;
    d = panelRegister(id, o);
  }
  if (o.kind && o.kind !== d.kind) d.kind = o.kind;
  if (o.onClose) d.onClose = o.onClose;
  if (o.anchor) d.anchor = o.anchor;
  if (panelIsOpen(id)) { panelPlaceNow(d, o); return true; }
  blocked = PANEL_BLOCKED_BY[d.kind] || [];
  for (i = 0; i < blocked.length; i++) if (panelKindOpen(blocked[i])) return false;
  if (d.kind === 'card' && panelFsActive()) return false;
  // 互斥:同 kind 組關舊的
  list = PANEL_MUTEX[d.kind] || [d.kind];
  for (k = panelOpenList.length - 1; k >= 0; k--) {
    other = panelOpenList[k];
    if (other === id || !panelDefs[other]) continue;
    if (list.indexOf(panelDefs[other].kind) >= 0 || (d.mutexGroup && panelDefs[other].mutexGroup === d.mutexGroup)) panelClose(other);
  }
  if (d.kind === 'big' && !panelKindOpen('big')) panelSnap = panelSnapshot();
  panelOpenList.push(id);
  panelLsSync();
  if (panelEl(d) && !d.legacy && o.show !== false) panelEl(d).hidden = false;
  panelPlaceNow(d, o);
  panelApplyMask();
  if (panelFsActive()) panelFsHide(d);
  return true;
}

function panelClose(id) {
  var d = panelDefs[id], hadBig;
  if (!d || !panelIsOpen(id)) return false;
  panelRemove(id);
  if (d.close) { try { d.close(); } catch (e) { /* 略過 */ } }
  else if (panelEl(d)) panelEl(d).hidden = true;
  if (d.onClose) { try { d.onClose(id); } catch (e2) { /* 略過 */ } }
  d.anchor = null;
  hadBig = d.kind === 'big';
  panelApplyMask();
  panelLsSync();
  if (hadBig && !panelKindOpen('big')) panelRestoreState();
  return true;
}

function panelCloseAll() {
  var n = 0, i, list = panelOpenList.slice();
  for (i = list.length - 1; i >= 0; i--) if (panelClose(list[i])) n++;
  return n;
}

function panelBack() {
  var id = panelTopId();
  if (!id) return false;
  panelClose(id);
  return true;
}

// ───── 浮卡幾何(純函式) ─────
function panelClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

// anchorRect {x,y,w,h};size {w,h};vp {w,h,safe:{t,r,b,l}} → {x,y,w,h,flip,zone} 或 null(放不下:改用 dock 翻頁或升級 large)
function panelPlaceCard(anchorRect, size, vp) {
  var a = anchorRect || { x: 0, y: 0, w: 0, h: 0 };
  var s = vp.safe || { t: 0, r: 0, b: 0, l: 0 };
  var vw = vp.w, vh = vp.h, gap = 6;
  var maxW = vw * PANEL_CARD_LIMIT.wFrac, maxH = vh * PANEL_CARD_LIMIT.hFrac;
  var cx0 = vw * PANEL_CENTER.x0, cx1 = vw * PANEL_CENTER.x1, cy0 = vh * PANEL_CENTER.y0, cy1 = vh * PANEL_CENTER.y1;
  var sx0 = s.l || 0, sx1 = vw - (s.r || 0), sy0 = s.t || 0, sy1 = vh - (s.b || 0);
  var zones = [
    { n: 'top', x: sx0, y: sy0, w: sx1 - sx0, h: cy0 - sy0 },
    { n: 'bottom', x: sx0, y: cy1, w: sx1 - sx0, h: sy1 - cy1 },
    { n: 'left', x: sx0, y: sy0, w: cx0 - sx0, h: sy1 - sy0 },
    { n: 'right', x: cx1, y: sy0, w: sx1 - cx1, h: sy1 - sy0 }
  ];
  var best = null, zi, z, w, h, mods, mi, px, py, x, y, cost, flip, minW = 72, minH = 40;
  var ax = a.x, ay = a.y, aw = a.w || 0, ah = a.h || 0;
  for (zi = 0; zi < zones.length; zi++) {
    z = zones[zi];
    if (z.w < minW || z.h < minH) continue;
    w = Math.min(size.w, maxW, z.w);
    h = Math.min(size.h, maxH, z.h);
    if (w < minW || h < minH) continue;
    mods = ['below', 'above', 'right', 'left'];
    for (mi = 0; mi < mods.length; mi++) {
      flip = mods[mi];
      if (flip === 'below') { px = ax + aw / 2 - w / 2; py = ay + ah + gap; }
      else if (flip === 'above') { px = ax + aw / 2 - w / 2; py = ay - h - gap; }
      else if (flip === 'right') { px = ax + aw + gap; py = ay + ah / 2 - h / 2; }
      else { px = ax - w - gap; py = ay + ah / 2 - h / 2; }
      x = panelClamp(px, z.x, z.x + z.w - w);
      y = panelClamp(py, z.y, z.y + z.h - h);
      cost = Math.abs(x - px) + Math.abs(y - py) + (mi * 0.01) + (mi >= 2 ? 20 : 0);
      // 貼著錨點才不算「翻轉」:靠近下緣 → 往上、靠近右緣 → 往左,由距離最小自然得出
      if (!best || cost < best.cost) best = { cost: cost, x: x, y: y, w: w, h: h, flip: flip, zone: z.n };
    }
  }
  if (!best) return null;
  return { x: best.x, y: best.y, w: best.w, h: best.h, flip: best.flip, zone: best.zone };
}

function panelViewport() {
  var w = 375, h = 667, safe = { t: 0, r: 0, b: 0, l: 0 };
  if (typeof window !== 'undefined' && window) {
    if (window.innerWidth) w = window.innerWidth;
    if (window.innerHeight) h = window.innerHeight;
  }
  return { w: w, h: h, safe: safe };
}

function panelPlaceNow(d, o) {
  var size, r, vp, rect;
  if (d.kind !== 'card' || !panelEl(d) || !d.place || !d.anchor) return null;
  vp = panelViewport();
  size = o.size;
  if (!size && panelEl(d).getBoundingClientRect) {
    rect = panelEl(d).getBoundingClientRect();
    size = { w: rect.width || 200, h: rect.height || 120 };
  }
  if (!size) size = { w: 200, h: 120 };
  r = panelPlaceCard(d.anchor, size, vp);
  if (!r) return null;
  if (panelEl(d).style) {
    panelEl(d).style.position = 'fixed';
    panelEl(d).style.left = Math.round(r.x) + 'px';
    panelEl(d).style.top = Math.round(r.y) + 'px';
    panelEl(d).style.maxWidth = Math.round(r.w) + 'px';
    panelEl(d).style.maxHeight = Math.round(r.h) + 'px';
  }
  d.placed = r;
  return r;
}

// ───── 大面板遮罩(輸入暫停) ─────
function panelApplyMask() {
  var on = panelBigMasked(), e;
  if (typeof document === 'undefined' || !document.createElement) return;
  if (!panelMaskEl) {
    if (!on) return;
    e = document.createElement('div');
    e.id = 'panelMask';
    e.className = 'panel-mask';
    e.hidden = true;
    e.addEventListener('pointerdown', function (ev) { if (ev.stopPropagation) ev.stopPropagation(); });
    e.addEventListener('click', function (ev) {
      var id = panelKindOpen('big');
      if (ev.stopPropagation) ev.stopPropagation();
      if (id) panelClose(id);
    });
    if (document.body && document.body.appendChild) document.body.appendChild(e);
    panelMaskEl = e;
  }
  panelMaskEl.hidden = !on;
}

// ───── 狀態保留與還原 ─────
function panelSetStateHooks(snap, restore) { panelHooks.snap = snap || null; panelHooks.restore = restore || null; }
function panelSnapshot() {
  var s = {};
  if (panelHooks.snap) return panelHooks.snap();
  try {
    if (typeof pend !== 'undefined' && pend) { s.sel = pend.sel; s.moving = pend.moving; }
    if (typeof draft !== 'undefined') s.draft = !!draft;
    if (typeof view !== 'undefined' && view) s.cam = { x: view.x, y: view.y, zoom: view.zoom };
  } catch (e) { /* 略過 */ }
  return s;
}
function panelNoteIntentMove() { if (panelSnap) panelSnap.cam = null; }       // 「一鍵前往」等明確移鏡頭:不還原鏡頭
function panelRestoreState() {
  var s = panelSnap, c;
  panelSnap = null;
  if (!s) return;
  if (panelHooks.restore) { panelHooks.restore(s); return; }
  try {
    if (typeof pend !== 'undefined' && pend && s.sel !== undefined) {
      if (pend.sel !== s.sel) pend.sel = s.sel;
      if (pend.moving !== s.moving) pend.moving = s.moving;
    }
    c = s.cam;
    if (c && typeof view !== 'undefined' && view && (view.x !== c.x || view.y !== c.y || view.zoom !== c.zoom)) {
      view.x = c.x; view.y = c.y; view.zoom = typeof clampZoom === 'function' ? clampZoom(c.zoom) : c.zoom;
    }
  } catch (e) { /* 略過 */ }
}

// ───── 全螢幕 / 拍照 / 錄影 / 戰鬥:隱藏城市浮層 ─────
function panelFsActive() {
  var k;
  for (k in panelFsReasons) if (panelFsReasons[k]) return true;
  return false;
}
function panelFsHide(d) {
  if (!panelEl(d) || !panelEl(d).style || d.kind === 'card') return;
  d.hiddenByFs = true;
  panelEl(d).style.visibility = 'hidden';
}
function panelFullscreen(reason, on) {
  var was = panelFsActive(), i, d, list;
  panelFsReasons[reason] = !!on;
  if (typeof document !== 'undefined' && document.body && document.body.classList) {
    document.body.classList.toggle('panel-fs', panelFsActive());
  }
  if (panelFsActive() && !was) {
    list = panelOpenList.slice();
    for (i = list.length - 1; i >= 0; i--) {
      d = panelDefs[list[i]];
      if (!d) continue;
      if (d.kind === 'card') panelClose(list[i]);
      else panelFsHide(d);
    }
    if (panelMaskEl) panelMaskEl.hidden = true;
  } else if (!panelFsActive() && was) {
    for (i in panelDefs) {
      d = panelDefs[i];
      if (d.hiddenByFs) { d.hiddenByFs = false; if (panelEl(d) && panelEl(d).style) panelEl(d).style.visibility = ''; }
    }
    panelApplyMask();
  }
  panelLsSync();
}
function panelSyncFs() {
  var m = '', rs = '';
  if (!PANEL_FS_AUTO) return;
  try {
    if (typeof uiIsPhoto === 'function') panelFullscreen('photo', uiIsPhoto());
    if (typeof game !== 'undefined' && game) m = game.mode;
    panelFullscreen('battle', m === 'attack' || m === 'replay');
    panelFullscreen('fishing', m === 'fishing');
    panelFullscreen('pet', m === 'pet');
    if (typeof REC !== 'undefined' && REC) rs = REC.state;
    panelFullscreen('record', rs === 'countdown' || rs === 'recording' || rs === 'stopping');
  } catch (e) { /* 略過 */ }
}

// ───── 地圖手勢:拖曳 / 縮放開始時收起浮卡 ─────
function panelNoteMapGesture() {
  var n = 0, i, list = panelOpenList.slice(), d;
  for (i = 0; i < list.length; i++) {
    d = panelDefs[list[i]];
    if (d && d.closeOnMapDrag && panelClose(list[i])) n++;
  }
  return n;
}

function panelInside(d, t) {
  if (d.ignore) { try { if (d.ignore(t)) return true; } catch (e) { /* 略過 */ } }
  if (panelEl(d) && panelEl(d).contains && t && panelEl(d).contains(t)) return true;
  if (d.anchorEl && d.anchorEl.contains && t && d.anchorEl.contains(t)) return true;
  return false;
}

function panelOpenCard() { var id = panelKindOpen('card'); return id ? panelDefs[id] : null; }

function panelReplay(g) {
  var ev;
  if (!g || !g.target) return;
  panelReplaying = true;
  try {
    if (typeof PointerEvent === 'function') {
      ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: g.x, clientY: g.y, pointerId: g.id, pointerType: g.type || 'touch', isPrimary: true, button: 0, buttons: 1 });
      g.target.dispatchEvent(ev);
    } else if (panelReplayHook) panelReplayHook(g);
  } catch (e) { /* 略過 */ }
  panelReplaying = false;
}
var panelReplayHook = null;
function panelSetReplayHook(fn) { panelReplayHook = fn; }

function panelOnPointerDown(ev) {
  var cd;
  if (panelReplaying) return;
  cd = panelOpenCard();
  if (!cd) { panelGesture = null; return; }
  if (panelInside(cd, ev.target)) return;
  if (panelGesture) {            // 第二指:視為縮放 → 收卡,補送第一指的按下
    var g0 = panelGesture;
    panelGesture = null;
    panelNoteMapGesture();
    panelReplay(g0);
    return;
  }
  if (!cd.closeOnMapDrag) { panelClose(cd.id); if (ev.stopPropagation) ev.stopPropagation(); return; }
  panelGesture = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, target: ev.target, type: ev.pointerType };
  if (ev.stopPropagation) ev.stopPropagation();       // 單點先攔下:只關閉、不傳給地圖
}
function panelOnPointerMove(ev) {
  var g = panelGesture, dx, dy;
  if (!g || ev.pointerId !== g.id) return;
  dx = ev.clientX - g.x; dy = ev.clientY - g.y;
  if (dx * dx + dy * dy < PANEL_DRAG_PX * PANEL_DRAG_PX) return;
  panelGesture = null;
  panelNoteMapGesture();
  panelReplay(g);                                      // 拖曳:收卡並把手勢交給地圖
}
function panelOnPointerUp(ev) {
  var g = panelGesture;
  if (!g || ev.pointerId !== g.id) return;
  panelGesture = null;
  panelNoteMapGesture();
  panelCloseCardsAny();
  if (ev.stopPropagation) ev.stopPropagation();
}
function panelCloseCardsAny() { var id; while ((id = panelKindOpen('card'))) if (!panelClose(id)) break; }
function panelOnWheel() { panelNoteMapGesture(); }
function panelDialogOpen() {
  var i, e;
  try {
    if (typeof ldAnyOpen === 'function' && ldAnyOpen()) return true;
    if (typeof document === 'undefined' || !document.getElementById) return false;
    for (i = 0; i < PANEL_DIALOG_IDS.length; i++) { e = document.getElementById(PANEL_DIALOG_IDS[i]); if (e && !e.hidden) return true; }
  } catch (x) { /* 略過 */ }
  return false;
}
function panelOnKey(ev) {
  var id;
  if (!ev || (ev.key !== 'Escape' && ev.key !== 'Esc')) return;
  if (panelDialogOpen()) return;                      // 模態對話優先,由它們自己的 Esc 處理
  id = panelTopId();
  if (!id || !panelDefs[id].esc) return;
  panelClose(id);
  if (ev.stopPropagation) ev.stopPropagation();
  if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
  if (ev.preventDefault) ev.preventDefault();
}

function panelBind() {
  if (panelBound || typeof document === 'undefined' || !document.addEventListener) return;
  panelBound = true;
  document.addEventListener('pointerdown', panelOnPointerDown, true);
  document.addEventListener('pointermove', panelOnPointerMove, true);
  document.addEventListener('pointerup', panelOnPointerUp, true);
  document.addEventListener('pointercancel', function () { panelGesture = null; }, true);
  document.addEventListener('wheel', panelOnWheel, { capture: true, passive: true });
  document.addEventListener('keydown', panelOnKey, true);
  if (typeof setInterval === 'function') setInterval(panelSyncFs, 400);
  try {                                                // 旋轉 / 視窗變動:重算橫版大面板模式
    panelLsActive();
    if (panelLsMql && panelLsMql.addEventListener) panelLsMql.addEventListener('change', panelLsSync);
    else if (panelLsMql && panelLsMql.addListener) panelLsMql.addListener(panelLsSync);
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', panelLsSync);
  } catch (e) { /* 略過 */ }
}

// ───── 既有面板登錄(漸進遷移;各 toggle 函式保留,開啟 / 關閉時通知管理器,管理器代為關閉互斥者) ─────
function panelLegacyCall(name, arg) { if (typeof window !== 'undefined' && typeof window[name] === 'function') window[name](arg); else if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') globalThis[name](arg); }
function panelRegisterLegacy() {
  panelRegister('shop', { kind: 'big', elId: 'shop', close: function () { panelLegacyCall('toggleShop', false); } });
  panelRegister('tpl', { kind: 'big', elId: 'tplMenu', close: function () { panelLegacyCall('toggleTplMenu', false); } });
  panelRegister('tech', { kind: 'big', elId: 'techPanel', close: function () { panelLegacyCall('toggleTechPanel', false); } });
  panelRegister('goods', { kind: 'big', elId: 'goodsPanel', close: function () { panelLegacyCall('goodsPanelToggle', false); } });
  panelRegister('toolHelp', { kind: 'big', elId: 'toolHelp', close: function () { panelLegacyCall('toggleToolHelp', false); } });
  panelRegister('cs', { kind: 'big', elId: 'csPanel', close: function () { panelLegacyCall('csClose'); } });
  panelRegister('prog', { kind: 'big', elId: 'progDrawer', close: function () { panelLegacyCall('progUiClose'); } });
  panelRegister('slotPop', {
    kind: 'card', elId: 'slotPop', place: false, close: function () { panelLegacyCall('slotPopClose'); },
    ignore: function (t) { return !!(t && t.closest && t.closest('#sideBar')); }
  });
  panelRegister('cityfx', { kind: 'dock', elId: 'cityFxSec', esc: false });
}
panelRegisterLegacy();
