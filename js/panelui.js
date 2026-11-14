// js/panelui.js — 統一面板外框(B 包 App Shell P1,app_shell_design §5.1 / §5.2):第 2 層主面板(kind 'big')與第 3 層底部面板(kind 'sheet')。
// 外框 = 標題列 .pf-hd(標題、橫版寬三檔 50/67/100、×)+ 內容區 .pf-bd(scrollSel 指定的捲動容器回報給轉向保存)。第 3 層直立有拖曳把手(40%~80%)。
// 層級:直立第 2 層滿高、第 3 層底部約 40%;橫向第 2 層靠左半(寬三檔,100% 讓出分頁軌 64px)、第 3 層在右半(扣分頁軌 64px)。
// 連鎖:開某層 → 同層與以上舊面板關閉;下層關閉 → panelCloseAbove 關上層全部;Esc / 返回由 panelmgr 逐層關(PANEL_ESC_ORDER 含 sheet)。
// 轉向:resize / orientationchange → 快照開啟中外框(id、層、寬檔、scrollTop),重排後於 120ms、450ms 各還原一次(不跳回頂)。
//   未走 panelSetStateHooks:該鉤子是 panelmgr 的單一槽位(大面板關閉時還原城市鏡頭),此處不占用。
// 用法:panelOpen({id, layer, title, build(bodyEl), widthMode, onClose, scrollSel, anchor, root}) 轉交 pfOpen;panelClose(id) 不變;panelCloseAbove(layer)。
//   第 3 層 z 72(panelmgr PANEL_Z.sheet、css --z-sheet):須高於戰鬥層 #bnLayer(z70),外勤 / 擂台上方的底部面板才看得到。
//   root:既有元素(例:外勤 #wmPanel)改由外框接管(內容搬入 .pf-bd;關閉後外框記錄丟棄,下次開啟重建)。
// 全域名稱:PF_FR PF_TOP PF_RAIL pfLayout pfSheetClamp pfAnchorShift pfOpen pfFrame pfSetTitle pfSetWidth pfBody pfScrollEl pfSnapshot pfRestore pfBind panelCloseAbove
// 幾何常數與 css/panelui.css 一致(tools/test_panelui.js 核對純函式;無頭 Chrome 實測核對 DOM 落位)。ES2017;不用 ?. ??。
var PF_TOP = 44, PF_RAIL = 64, PF_SHEET_DEF = 0.4, PF_SHEET_MIN = 0.4, PF_SHEET_MAX = 0.8, PF_WIDTHS = [50, 67, 100], PF_W_DEF = 50;
var PF_FR = {};          // id → 外框紀錄 {id, layer, root, hd, title, bd, grip, scrollSel, widthMode, sheetFrac, adopt, wbtns, lastTop, lastEl}
var PF_DRAG = null;
var PF_BOUND = false;

// 純函式:外框幾何。vw / vh 為視窗尺寸;直橫依 vw > vh 判定(與 CSS orientation 一致)。回 {x, y, w, h}。
function pfLayout(layer, mode, vw, vh, sheetFrac) {
  var m = pfWidth(mode), h;
  if (vw > vh) {
    if (layer === 3) return { x: vw * 0.5, y: 0, w: vw * 0.5 - PF_RAIL, h: vh };
    return { x: 0, y: 0, w: m === 100 ? vw - PF_RAIL : vw * m / 100, h: vh };
  }
  if (layer === 3) { h = vh * pfSheetClamp(sheetFrac || PF_SHEET_DEF); return { x: 0, y: vh - h, w: vw, h: h }; }
  return { x: 0, y: PF_TOP, w: vw, h: vh - PF_TOP };
}
function pfSheetClamp(f) { return f < PF_SHEET_MIN ? PF_SHEET_MIN : (f > PF_SHEET_MAX ? PF_SHEET_MAX : f); }
function pfWidth(w) { var n = +w; return PF_WIDTHS.indexOf(n) >= 0 ? n : PF_W_DEF; }
// 底部面板遮住被點的列時,內容需上捲的像素(0 = 不用動)。anchorBottom 為列下緣、sheetTop 為面板上緣、margin 為留白。
function pfAnchorShift(anchorBottom, sheetTop, margin) {
  var lim = sheetTop - (margin === undefined ? 8 : margin);
  return anchorBottom > lim ? anchorBottom - lim : 0;
}

function pfSetAttr(el, k, v) { if (el && el.setAttribute) el.setAttribute(k, v); }
function pfSetVar(el, k, v) { if (el && el.style && el.style.setProperty) el.style.setProperty(k, v); }
function pfKids(el) { return (el && (el.childNodes || el.children)) ? Array.prototype.slice.call(el.childNodes || el.children) : []; }
function pfMk(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

function pfFrame(o) {
  var id = o.id, layer = o.layer === 3 ? 3 : 2, f = PF_FR[id], root, hd, bd, tt, grip, btn, i, kids;
  if (typeof document === 'undefined' || !document || !document.createElement) return null;
  if (f && (f.root === o.root || (!o.root && !f.adopt))) return f;
  if (f) delete PF_FR[id];
  root = o.root || pfMk('div');
  if (!o.root) {
    root.id = o.rootId || ('pf_' + id);
    root.hidden = true;
    if (document.body && document.body.appendChild) document.body.appendChild(root);
  }
  root.className = ((root.className ? root.className + ' ' : '') + 'pf-frame ' + (layer === 3 ? 'pf-sheet' : 'pf-l2')).replace(/\s+/g, ' ');
  hd = pfMk('div', 'pf-hd');
  tt = pfMk('b', 'pf-title');
  hd.appendChild(tt);
  f = { id: id, layer: layer, root: root, hd: hd, title: tt, bd: null, grip: null, scrollSel: o.scrollSel || '.pf-scroll', widthMode: PF_W_DEF, sheetFrac: PF_SHEET_DEF, adopt: !!o.root, wbtns: [], lastTop: null, lastEl: null };
  if (layer === 2) {
    for (i = 0; i < PF_WIDTHS.length; i++) {
      btn = pfMk('button', 'pf-w');
      pfSetAttr(btn, 'data-pf', 'w');
      pfSetAttr(btn, 'data-w', String(PF_WIDTHS[i]));
      btn.textContent = PF_WIDTHS[i] === 100 ? '滿' : PF_WIDTHS[i] + '%';
      hd.appendChild(btn);
      f.wbtns.push(btn);
    }
  }
  btn = pfMk('button', 'pf-x');
  pfSetAttr(btn, 'data-pf', 'x');
  pfSetAttr(btn, 'aria-label', '關閉');
  btn.textContent = '×';
  hd.appendChild(btn);
  bd = pfMk('div', 'pf-bd');
  f.bd = bd;
  if (o.root) {
    kids = pfKids(root);
    for (i = 0; i < kids.length; i++) { root.removeChild(kids[i]); bd.appendChild(kids[i]); }
  }
  root.appendChild(hd);
  if (layer === 3) {
    grip = pfMk('div', 'pf-grip');
    f.grip = grip;
    root.appendChild(grip);
    grip.addEventListener('pointerdown', function (ev) { PF_DRAG = { f: f, y: ev.clientY, s: f.sheetFrac }; });
  }
  root.appendChild(bd);
  hd.addEventListener('click', function (ev) { pfHdClick(f, ev); });
  bd.addEventListener('scroll', function (ev) { pfOnScroll(f, ev); }, true);
  PF_FR[id] = f;
  if (typeof panelRegister === 'function') {
    panelRegister(id, { kind: layer === 3 ? 'sheet' : 'big', el: root, close: function () { panelCloseAbove(layer); pfHide(id); } });
  }
  pfBind();
  return f;
}
function pfHdClick(f, ev) {
  var t = ev && ev.target, a;
  while (t && t !== f.hd && !(t.getAttribute && t.getAttribute('data-pf'))) t = t.parentNode;
  if (!t || t === f.hd) return;
  a = t.getAttribute('data-pf');
  if (a === 'x') { panelClose(f.id); return; }
  if (a === 'w') pfSetWidth(f.id, t.getAttribute('data-w'));
}
function pfHide(id) {
  var f = PF_FR[id];
  if (!f) return;
  f.root.hidden = true;
  if (f.adopt) delete PF_FR[id];
}
function pfOnScroll(f, ev) {
  var t = ev && ev.target, sc = pfScrollEl(f);
  if (t && sc && t === sc) { f.lastTop = t.scrollTop | 0; f.lastEl = t; }
}

function pfSetTitle(id, text) { var f = PF_FR[id]; if (f && f.title) f.title.textContent = String(text === undefined || text === null ? '' : text); }
function pfSetWidth(id, w) {
  var f = PF_FR[id], i;
  if (!f || f.layer !== 2) return;
  f.widthMode = pfWidth(w);
  pfSetAttr(f.root, 'data-w', String(f.widthMode));
  for (i = 0; i < f.wbtns.length; i++) pfSetAttr(f.wbtns[i], 'aria-pressed', f.wbtns[i].getAttribute('data-w') === String(f.widthMode) ? 'true' : 'false');
}
function pfBody(id) { var f = PF_FR[id]; return f ? f.bd : null; }
function pfScrollEl(f) {
  var e;
  if (!f || !f.bd) return null;
  e = (f.bd.querySelector && f.scrollSel) ? f.bd.querySelector(f.scrollSel) : null;
  return e || f.bd;
}

// 同層與以上(keep 除外)的外框關閉
function pfCloseFrom(layer, keep) {
  var list = panelOpenList.slice(), i, f;
  for (i = 0; i < list.length; i++) {
    f = PF_FR[list[i]];
    if (f && list[i] !== keep && f.layer >= layer) panelClose(list[i]);
  }
}
// 下層關閉 / 切分頁 → 只留 layer 以下(含 layer)的外框;上層全部關閉
function panelCloseAbove(layer) {
  var list = panelOpenList.slice(), i, f, n = 0;
  for (i = 0; i < list.length; i++) {
    f = PF_FR[list[i]];
    if (f && f.layer > layer && panelClose(list[i])) n++;
  }
  return n;
}

// 開啟(panelOpen 物件參數轉交至此)。build 每次開啟都會呼叫,內容由呼叫端自己畫。
function pfOpen(o) {
  var f, id, layer, sc;
  if (!o || !o.id || typeof document === 'undefined') return false;
  id = o.id; layer = o.layer === 3 ? 3 : 2;
  f = pfFrame(o);
  if (!f) return false;
  if (o.title !== undefined) pfSetTitle(id, o.title);
  if (o.widthMode !== undefined) f.widthMode = pfWidth(o.widthMode);
  if (o.sheetFrac) f.sheetFrac = pfSheetClamp(o.sheetFrac);
  pfCloseFrom(layer, id);
  f.root.hidden = false;
  if (o.build) o.build(f.bd);
  if (!panelOpen(id, { kind: layer === 3 ? 'sheet' : 'big', onClose: o.onClose })) { f.root.hidden = true; return false; }
  pfSetWidth(id, f.widthMode);
  if (layer === 3) pfSetVar(f.root, '--pf-h', Math.round(f.sheetFrac * 1000) / 10 + 'vh');
  if (o.anchor && layer === 3) pfKeepAnchor(f, o.anchor);
  return true;
}
// 底部面板(直立)遮住被點的列時,把下層第 2 層內容捲到面板上緣之上
function pfKeepAnchor(f, el) {
  var below = null, i, g, sr, ar, sc, sh, shift;
  if (!el || !el.getBoundingClientRect || typeof window === 'undefined' || !window) return 0;
  if ((window.innerWidth || 0) > (window.innerHeight || 0)) return 0;
  for (i = 0; i < panelOpenList.length; i++) { g = PF_FR[panelOpenList[i]]; if (g && g.layer === 2) below = g; }
  if (!below) return 0;
  sc = pfScrollEl(below);
  sr = f.root.getBoundingClientRect();
  ar = el.getBoundingClientRect();
  shift = pfAnchorShift(ar.bottom, sr.top, 8);
  if (shift > 0 && sc) { sh = sc.scrollTop | 0; sc.scrollTop = sh + shift; }
  return shift;
}

// 轉向保存:快照 → 重排後還原(寬檔、底部面板高度、捲動位置)
function pfSnapshot() {
  var out = [], i, id, f, el;
  for (i = 0; i < panelOpenList.length; i++) {
    id = panelOpenList[i]; f = PF_FR[id];
    if (!f) continue;
    el = pfScrollEl(f);
    out.push({ id: id, layer: f.layer, w: f.widthMode, f: f.sheetFrac, top: (f.lastEl && el === f.lastEl) ? f.lastTop : (el ? el.scrollTop | 0 : 0) });
  }
  return out;
}
function pfRestore(snap) {
  var i, s, f, el;
  if (!snap) return;
  for (i = 0; i < snap.length; i++) {
    s = snap[i]; f = PF_FR[s.id];
    if (!f || !panelIsOpen(s.id)) continue;
    if (f.layer === 2) pfSetWidth(s.id, s.w);
    if (f.layer === 3) { f.sheetFrac = pfSheetClamp(s.f || PF_SHEET_DEF); pfSetVar(f.root, '--pf-h', Math.round(f.sheetFrac * 1000) / 10 + 'vh'); }
    el = pfScrollEl(f);
    if (el && s.top) el.scrollTop = s.top;
  }
}
function pfOnResize() {
  var snap = pfSnapshot();
  pfRestore(snap);
  if (typeof setTimeout === 'function') {
    setTimeout(function () { pfRestore(snap); }, 120);
    setTimeout(function () { pfRestore(snap); }, 450);
  }
}
// 第 3 層把手拖曳(直立 40%~80%)
function pfOnDragMove(ev) {
  var d = PF_DRAG, vh;
  if (!d || typeof window === 'undefined' || !window) return;
  vh = window.innerHeight || 1;
  d.f.sheetFrac = pfSheetClamp(d.s + (d.y - ev.clientY) / vh);
  pfSetVar(d.f.root, '--pf-h', Math.round(d.f.sheetFrac * 1000) / 10 + 'vh');
}
function pfOnDragEnd() { PF_DRAG = null; }

function pfBind() {
  if (PF_BOUND || typeof window === 'undefined' || !window || !window.addEventListener) return;
  PF_BOUND = true;
  window.addEventListener('resize', pfOnResize);
  window.addEventListener('orientationchange', pfOnResize);
  if (typeof document !== 'undefined' && document && document.addEventListener) {
    document.addEventListener('pointermove', pfOnDragMove, true);
    document.addEventListener('pointerup', pfOnDragEnd, true);
    document.addEventListener('pointercancel', pfOnDragEnd, true);
  }
}
