// petui.js — 仙獸苑覆蓋層與流程(PLAN_PET §6、§7.3、§7.4、§8.1、§8.4)。
// 全域只用 pet / pu / PU_ 開頭的名稱。依賴:petdata.js、pet.js、petdraw.js、audio.js(auPlay)、fishui.js(fishEnter,可缺)。
// 原則:會改變資源的動作先經 pet.js 寫入存檔,動畫只負責播放;離開或重進不重複入帳。

var PU_YTOP = { climb: 600, craft: 430, summon: 540 };
var PU_SUM_DY = -40;
var PU_TABS = [['climb', '雲階'], ['craft', '煉丹爐'], ['summon', '招靈台'], ['dex', '圖鑑']];
var PU_HIDE = ['topbar', 'resbar', 'toolbar', 'pendBar', 'toast', 'shop', 'tplMenu', 'techPanel', 'pano', 'updateBar'];
var PU_DOCK_H = 48;
var PU_CSS = '' +
  '#petLayer{position:fixed;left:0;top:0;right:0;bottom:0;z-index:30;background:#f6efe0;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;color:#3b2314;font-size:14px}' +
  '#petLayer>canvas{position:absolute;left:0;top:0;width:100%;height:100%}' +
  '#petLayer .pu-chrome{position:absolute}' +
  '#petLayer .pu-btn{box-sizing:border-box;min-height:44px;margin:0;padding:0 10px;border:1.5px solid #3b2314;border-radius:10px;background:#fbf3dc;color:#3b2314;font-size:15px;font-weight:700;line-height:1.2;touch-action:manipulation;white-space:nowrap;cursor:pointer}' +
  '#petLayer .pu-on{background:#c4121a;color:#fff7e0;border-color:#7a0a10}' +
  '#petLayer .pu-dis{filter:grayscale(1);opacity:.5}' +
  '#petLayer .pu-bal{background:rgba(251,243,220,.96);font-size:14px}' +
  '#petLayer .pu-dock{background:#c4121a;color:#fff7e0;font-size:17px;border-color:#7a0a10}' +
  '#petLayer .pu-dock.pu-gold{box-shadow:0 0 0 3px #ffcf3a}' +
  '#petLayer .pu-panel{position:absolute;box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:6px 4px;display:flex;flex-direction:column;gap:6px}' +
  '#petLayer .pu-flow{position:static;flex:0 0 auto}' +
  '#petLayer .pu-panel>*{flex:0 0 auto}' +
  '#petLayer .pu-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}' +
  '#petLayer .pu-spread{justify-content:space-between}' +
  '#petLayer .pu-lbl{font-weight:700}' +
  '#petLayer .pu-wish{flex:1 1 0;min-width:44px;padding:0 4px}' +
  '#petLayer .pu-lan{display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background:#d8cfbb;margin-right:3px;font-size:11px}' +
  '#petLayer .pu-lan.on{background:#ffcf3a;box-shadow:0 0 6px #ffcf3a}' +
  '#petLayer .pu-charm.on{color:#c4121a;font-weight:700}' +
  '#petLayer .pu-note,#petLayer .pu-hint{font-size:12px;opacity:.85}' +
  '#petLayer .pu-link{background:transparent;border-style:dashed}' +
  '#petLayer .pu-shellwarn{font-size:13px;font-weight:700;color:#c4121a;background:#ffe9e4;border:1.5px solid #c4121a;border-radius:10px;padding:4px 6px}' +
  '#petLayer .pu-chiprow{display:flex;align-items:flex-start;gap:6px;overflow-x:auto;padding-bottom:6px}' +
  '#petLayer .pu-chip2{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;width:84px;padding:4px;border:1.5px solid #c9b48a;border-radius:10px;background:#fffaf0}' +
  '#petLayer .pu-chip2.pu-on{border-color:#c4121a;background:#ffe9e4;color:#3b2314}' +
  '#petLayer .pu-brow{display:flex;align-items:center;gap:8px;padding:4px;border:1px solid #d8cba9;border-radius:10px;background:#fffaf0}' +
  '#petLayer .pu-brow.pu-on{border-color:#c4121a;background:#ffe9e4;color:#3b2314}' +
  '#petLayer .pu-binfo{flex:1;min-width:0}' +
  '#petLayer .pu-bname{font-weight:700}' +
  '#petLayer .pu-recipe span{display:inline-block;margin-right:6px;font-size:12px}' +
  '#petLayer .pu-recipe .ok{color:#2e8b57;font-weight:700}' +
  '#petLayer .pu-recipe .no{color:#c4121a}' +
  '#petLayer .pu-mgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}' +
  '#petLayer .pu-mcell{display:flex;flex-direction:column;align-items:center;padding:4px;border-radius:8px;background:#fffaf0;border:1px solid #d8cba9;cursor:pointer}' +
  '#petLayer .pu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}' +
  '#petLayer .pu-card{border:2px solid #c9b48a;border-radius:10px;background:#fffaf0;padding:4px;text-align:center}' +
  '#petLayer .pu-card.own{background:#eef8f1;cursor:pointer}' +
  '#petLayer .pu-cname{font-weight:700;font-size:13px}' +
  '#petLayer .pu-crar{font-size:11px;opacity:.8}' +
  '#petLayer .pu-msg{position:absolute;padding:6px 14px;border-radius:999px;background:rgba(59,35,20,.9);color:#fff7e0;font-size:13px;text-align:center;pointer-events:none}' +
  '#petLayer .pu-stick{position:absolute;align-items:center;justify-content:center;box-sizing:border-box;border:2px solid #3b2314;border-radius:6px;font-weight:800;font-size:15px;color:#fff7e0;pointer-events:none}' +
  '#petLayer .pu-plate{position:absolute;align-items:center;justify-content:center;box-sizing:border-box;border-radius:8px;background:rgba(59,35,20,.88);color:#fff7e0;font-size:13px;font-weight:700;pointer-events:none}' +
  '#petLayer .pu-flash{position:absolute;box-sizing:border-box;padding:6px 10px;border-radius:10px;background:rgba(251,243,220,.96);border:1.5px solid #3b2314;font-size:13px;text-align:center;pointer-events:none}' +
  '#petLayer .pu-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(20,12,8,.45);padding:12px;box-sizing:border-box}' +
  '#petLayer .pu-cardbox{width:100%;max-width:360px;max-height:100%;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;padding:14px;border-radius:14px;background:#fbf3dc;border:2px solid #3b2314}' +
  '#petLayer .pu-ctitle{font-size:20px;font-weight:800;margin-bottom:6px;font-family:"Noto Serif TC","PMingLiU",serif}' +
  '#petLayer .pu-cline{margin:4px 0;font-size:14px}' +
  '#petLayer .pu-cbody{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y}' +
  '#petLayer .pu-crow{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;justify-content:flex-end}' +
  '#petLayer .pu-cbtn{min-width:44px;min-height:44px}' +
  '#petLayer .pu-gift{display:flex;align-items:center;gap:8px;width:100%;justify-content:flex-start}' +
  '#btnPet[hidden]{display:none}';

var puLayer = null, puCv = null, puCtx = null, puView = null, puPanelEl = null, puBackEl = null, puGearEl = null, puBalEl = null,
  puTabEls = [], puDockEl = null, puCardEl = null, puModalEl = null, puMsgEl = null, puStickEl = null, puPlateEl = null,
  puFlashEl = null, puProbe = null, puRaf = 0, puLast = 0, puT = 0, puPaused = false, puTab = 'climb', puSub = 'brew',
  puSel = null, puDetail = null, puAnim = null, puFx = null, puState = 'idle', puDexCvs = [], puDetCtx = null, puDetId = '',
  puHoldT = 0, puHoldI = 0, puHolding = false, puHidden = [], puLastGain = 0, puDockKey = '', puBalTxt = '', puDpr = 1,
  puConvInfo = null, puMsgUntil = 0, puFlashUntil = 0, puDetCv = null, puStyled = false, puTopTimer = 0;

// ---------------- 基礎 DOM 工具 ----------------
function puEl(parent, tag, cls, text) {
  var el = document.createElement(tag);
  if (cls) el.className = cls;
  el.setAttribute('data-ui', '1');
  if (text !== undefined && text !== null) el.textContent = String(text);
  if (parent) parent.appendChild(el);
  return el;
}

function puBtn(parent, text, cls, fn) {
  var b = puEl(parent, 'button', 'pu-btn ' + (cls || ''), text);
  b.addEventListener('click', function (e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (fn) fn();
  });
  return b;
}

function puPos(el, r) {
  if (!el || !r) return;
  el.style.left = r[0] + 'px';
  el.style.top = r[1] + 'px';
  if (r[2] !== undefined) el.style.width = r[2] + 'px';
  el.style.height = r[3] !== undefined ? r[3] + 'px' : '';
}

function puClear(el) {
  while (el && el.children && el.children.length) el.removeChild(el.children[0]);
}

function puCanvas(parent, w, h, cls) {
  var cv = document.createElement('canvas'), ctx;
  cv.width = Math.round(w * puDpr);
  cv.height = Math.round(h * puDpr);
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  if (cls) cv.className = cls;
  cv.setAttribute('data-ui', '1');
  if (parent) parent.appendChild(cv);
  ctx = cv.getContext('2d');
  ctx.setTransform(puDpr, 0, 0, puDpr, 0, 0);
  return { cv: cv, ctx: ctx };
}

function puSfx(name, opt) {
  if (typeof auPlay === 'function') auPlay(name, opt);
}

function puStars(n) {
  var t = '', i;
  for (i = 0; i < 5; i++) t += i < n ? '★' : '☆';
  return t;
}

function puMatName(id) {
  var i;
  for (i = 0; i < PET_MATS.length; i++) if (PET_MATS[i].id === id) return PET_MATS[i].name;
  return id;
}

function puEasBack(k) {
  var c1 = 1.70158, c3 = c1 + 1, x = k - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

// ---------------- 版面(只看方向、視窗尺寸與安全區;同方向下位置固定) ----------------
// 回傳 v:back / gear / bal / tabs[4] / dock 皆為 [x, y, w, h];Rc 為畫布區;s / ox / oy 為邏輯 390×844 的映射。
function puLayout(sw, sh, ins) {
  var I = ins || { t: 0, r: 0, b: 0, l: 0 }, M = 8, B = 44, GAP = 6, uw = Math.max(1, sw - I.l - I.r), uh = Math.max(1, sh - I.t - I.b),
    land = sw > sh, v = { sw: sw, sh: sh, ins: I, orient: land ? 'landscape' : 'portrait', dpr: 1, s: 1, ox: 0, oy: 0 },
    tabY = I.t + M + B + GAP, rx, rw, cw, tw, i;
  v.back = [I.l + M, I.t + M, B, B];
  v.bal = [sw - I.r - M - 120, I.t + M, 120, B];
  v.gear = [v.bal[0] - GAP - B, I.t + M, B, B];
  v.tabY = tabY;
  v.msgY = tabY + B + GAP + 4;
  v.tabs = [];
  if (land) {
    cw = Math.round(Math.max(200, Math.min(uw * 0.42, 360)));
    v.Rc = [I.l, I.t, cw, uh];
    v.s = Math.min(cw / 390, uh / 844);
    v.ox = I.l + (cw - 390 * v.s) / 2;
    v.oy = I.t + (uh - 844 * v.s) / 2;
    rx = I.l + cw + M;
    rw = sw - I.r - M - rx;
    v.panelX = rx;
    v.panelW = rw;
    v.panelTop = tabY + B + GAP;
    v.dock = [rx, sh - I.b - M - PU_DOCK_H, rw, PU_DOCK_H];
    tw = (rw - 3 * GAP) / 4;
    for (i = 0; i < 4; i++) v.tabs.push([rx + i * (tw + GAP), tabY, tw, B]);
  } else {
    v.Rc = [I.l, tabY + B + GAP, uw, sh - I.b - (tabY + B + GAP)];
    v.s = Math.min(uw / 390, v.Rc[3] / 844);
    v.ox = I.l + (uw - 390 * v.s) / 2;
    v.oy = v.Rc[1] + (v.Rc[3] - 844 * v.s) / 2;
    tw = (uw - 2 * M - 3 * GAP) / 4;
    for (i = 0; i < 4; i++) v.tabs.push([I.l + M + i * (tw + GAP), tabY, tw, B]);
    v.dock = [I.l + M, sh - I.b - M - PU_DOCK_H, uw - 2 * M, PU_DOCK_H];
    v.panelW = Math.min(uw - 2 * M, 480);
    v.panelX = I.l + (uw - v.panelW) / 2;
    v.panelTop = tabY + B + GAP;
  }
  return v;
}

// 內容面板矩形:雲階 / 招靈台以 PU_YTOP 對齊邏輯座標(直式);圖鑑全寬;煉丹爐無丟球鈕。
function puPanelRect(v, tab) {
  var I = v.ins, M = 8, x = v.panelX, w = v.panelW, top = v.panelTop, bottom;
  if (tab === 'dex') {
    x = I.l + M;
    w = v.sw - I.l - I.r - 2 * M;
  } else if (v.orient === 'portrait') {
    top = v.oy + PU_YTOP[tab] * v.s;
  }
  bottom = (tab === 'dex' || tab === 'craft') ? v.sh - I.b - M : v.dock[1] - M;
  if (top + 120 > bottom) top = bottom - 120;
  return [x, top, w, bottom - top];
}

function puInsets() {
  var r = { t: 0, r: 0, b: 0, l: 0 }, cs;
  try {
    if (!puProbe) {
      puProbe = document.createElement('div');
      puProbe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      puLayer.appendChild(puProbe);
    }
    cs = window.getComputedStyle(puProbe);
    r.t = parseFloat(cs.paddingTop) || 0;
    r.r = parseFloat(cs.paddingRight) || 0;
    r.b = parseFloat(cs.paddingBottom) || 0;
    r.l = parseFloat(cs.paddingLeft) || 0;
  } catch (e) {}
  return r;
}

function puPlaceChrome() {
  var v = puView, i;
  if (!v) return;
  puPos(puBackEl, v.back);
  puPos(puGearEl, v.gear);
  puPos(puBalEl, v.bal);
  for (i = 0; i < puTabEls.length; i++) puPos(puTabEls[i], v.tabs[i]);
  puPos(puDockEl, v.dock);
  puPos(puMsgEl, [v.ins.l + 12, v.msgY, v.sw - v.ins.l - v.ins.r - 24]);
  puPlaceFx();
}

function puPlaceFx() {
  var v = puView;
  if (!v) return;
  puPos(puStickEl, [v.ox + 195 * v.s - 75, v.oy + 230 * v.s - 23, 150, 46]);
  puPos(puPlateEl, [v.ox + 195 * v.s - 110, v.oy + (292 + PU_SUM_DY) * v.s - 20, 220, 40]);
  puPos(puFlashEl, [v.ox + 195 * v.s - 130, v.oy + 330 * v.s - 26, 260]);
}

function puPlacePanel() {
  var r;
  if (!puPanelEl || !puView) return;
  r = puPanelRect(puView, puTab);
  puPos(puPanelEl, r);
}

// ---------------- 覆蓋層建立 / 尺寸 ----------------
function puEnsureCss() {
  var st;
  if (puStyled) return;
  puStyled = true;
  try {
    st = document.createElement('style');
    st.id = 'petStyle';
    st.textContent = PU_CSS;
    (document.head || document.body).appendChild(st);
  } catch (e) {
    console.warn('[pet] style inject failed', e);
  }
}

function puBuild() {
  var layer = document.createElement('div'), i;
  layer.id = 'petLayer';
  puEnsureCss();
  puCv = document.createElement('canvas');
  puCv.id = 'petCv';
  puCv.setAttribute('data-ui', '1');
  puCtx = puCv.getContext('2d');
  layer.appendChild(puCv);
  puCv.addEventListener('pointerdown', puOnCanvasDown);
  puBackEl = puBtn(layer, '↩', 'pu-chrome', function () { petClose(); });
  puGearEl = puBtn(layer, '⚙', 'pu-chrome', puToggleFast);
  puBalEl = puBtn(layer, '', 'pu-chrome pu-bal', function () { puModal('exchange'); });
  puTabEls = [];
  for (i = 0; i < PU_TABS.length; i++) {
    puTabEls.push(puBtn(layer, PU_TABS[i][1], 'pu-chrome', (function (k) {
      return function () { puSetTab(k); };
    })(PU_TABS[i][0])));
  }
  puDockEl = puBtn(layer, '', 'pu-chrome pu-dock', puDock);
  puPanelEl = puEl(layer, 'div', 'pu-panel', '');
  puMsgEl = puEl(layer, 'div', 'pu-msg', '');
  puStickEl = puEl(layer, 'div', 'pu-stick', '');
  puPlateEl = puEl(layer, 'div', 'pu-plate', '');
  puFlashEl = puEl(layer, 'div', 'pu-flash', '');
  puCardEl = puEl(layer, 'div', 'pu-wrap', '');
  puModalEl = puEl(layer, 'div', 'pu-wrap', '');
  puMsgEl.style.display = 'none';
  puStickEl.style.display = 'none';
  puPlateEl.style.display = 'none';
  puFlashEl.style.display = 'none';
  puCardEl.style.display = 'none';
  puModalEl.style.display = 'none';
  document.body.appendChild(layer);
  puLayer = layer;
}

function puResize() {
  var sw, sh, v;
  if (!puLayer) return;
  sw = window.innerWidth || 390;
  sh = window.innerHeight || 844;
  puDpr = window.devicePixelRatio || 1;
  v = puLayout(sw, sh, puInsets());
  v.dpr = puDpr;
  puView = v;
  puCv.width = Math.round(sw * puDpr);
  puCv.height = Math.round(sh * puDpr);
  puPlaceChrome();
  puPlacePanel();
}

function puOnResize() { puResize(); }

function puBindResize(on) {
  window.removeEventListener('resize', puOnResize);
  window.removeEventListener('orientationchange', puOnResize);
  if (on) {
    window.addEventListener('resize', puOnResize);
    window.addEventListener('orientationchange', puOnResize);
  }
}

// ---------------- 訊息 / 閃字 / 卡片 / 模態 ----------------
function puMsg(text) {
  if (!puMsgEl) return;
  puMsgEl.textContent = text;
  puMsgEl.style.display = '';
  puMsgUntil = puT + 2.2;
}

function puFlashShow(text, sec) {
  if (!puFlashEl) return;
  puFlashEl.textContent = text;
  puFlashEl.style.display = '';
  puFlashUntil = puT + (sec || 1.6);
}

function puFlashHide() {
  if (puFlashEl) puFlashEl.style.display = 'none';
}

function puCardShow(title, lines, btns) {
  var box, body, row, i;
  if (!puCardEl) return;
  puClear(puCardEl);
  box = puEl(puCardEl, 'div', 'pu-cardbox', '');
  body = puEl(box, 'div', 'pu-cbody', '');
  puEl(body, 'div', 'pu-ctitle', title);
  for (i = 0; i < lines.length; i++) puEl(body, 'div', 'pu-cline', lines[i]);
  row = puEl(box, 'div', 'pu-crow', '');
  for (i = 0; i < btns.length; i++) puBtn(row, btns[i].t, 'pu-flow pu-cbtn', btns[i].f);
  puCardEl.style.display = '';
}

function puCardHide() {
  if (!puCardEl) return;
  puCardEl.style.display = 'none';
  puClear(puCardEl);
}

function puModal(kind) {
  var box, body, s, i, j, p, row, btn, cvObj, el, lin, sum, canBuy;
  if (!puModalEl) return;
  s = petEnsure();
  puClear(puModalEl);
  box = puEl(puModalEl, 'div', 'pu-cardbox', '');
  body = puEl(box, 'div', 'pu-cbody', '');
  if (kind === 'bands') {
    puEl(body, 'div', 'pu-ctitle', '雲階籤譜');
    for (i = 0; i < PET_BANDS.length; i++) {
      lin = '段 ' + PET_BANDS[i].name + '(' + PET_BANDS[i].from + '~' + PET_BANDS[i].to + ' 層):';
      sum = PET_BANDS[i].w.reduce(function (a, c) { return a + c; }, 0) || 100;
      for (j = 0; j < PET_ROLL.length; j++) {
        if (PET_BANDS[i].w[j] > 0) lin += ' ' + ['+3', '+2', '+1', '0', '−1', '−2', '歸零'][j] + ' ' + PET_BANDS[i].w[j] + '%';
      }
      puEl(body, 'div', 'pu-cline', lin + (sum === 100 ? '' : '(合計 ' + sum + ')'));
    }
    puEl(body, 'div', 'pu-cline', '否極泰來:連續 3 次結果不往上,下一次必定往上。');
    puEl(body, 'div', 'pu-cline', '平安符:墜回 0 層時得到 1 張;下次抽到歸零時燒掉,改為 −2。');
    puEl(body, 'div', 'pu-cline', '登頂(20 層)後回到 0 層,並得到天門寶匣。');
    row = puEl(box, 'div', 'pu-crow', '');
    puBtn(row, '關閉', 'pu-flow pu-cbtn', puModalHide);
  } else if (kind === 'exchange') {
    puEl(body, 'div', 'pu-ctitle', '靈貝');
    puEl(body, 'div', 'pu-cline', '釣魚得分會自動換成靈貝(1 分 = 1 🐚)。上次同步:+' + puLastGain);
    puEl(body, 'div', 'pu-cline', '目前靈貝 🐚 ' + s.shell + ' · 金幣 🪙 ' + puCoin());
    row = puEl(box, 'div', 'pu-crow', '');
    canBuy = puCoin() >= PET_COIN_RATE * PET_COIN_LOT;
    btn = puBtn(row, '用金幣兌換:' + (PET_COIN_RATE * PET_COIN_LOT) + ' 🪙 → ' + PET_COIN_LOT + ' 🐚', 'pu-flow pu-cbtn' + (canBuy ? '' : ' pu-dis'), function () {
      if (!petExchangeCoin()) { puMsg('金幣不足'); return; }
      puMsg('兌換成功 +' + PET_COIN_LOT + ' 🐚');
      puSyncDock(true);
      puRenderPanel();
      puModal('exchange');
    });
    row = puEl(box, 'div', 'pu-crow', '');
    puBtn(row, '去釣魚 🎣', 'pu-flow pu-cbtn', function () {
      petClose();
      if (typeof fishEnter === 'function') fishEnter('top');
    });
    puBtn(row, '關閉', 'pu-flow pu-cbtn', puModalHide);
  } else if (kind === 'gift') {
    puEl(body, 'div', 'pu-ctitle', '開園禮');
    puEl(body, 'div', 'pu-cline', '選一個你喜歡的五行。送你該系靈級餌的全部材料與 300 🐚,並把它設為祈願五行。');
    for (i = 0; i < PET_EL_LIST.length; i++) {
      el = PET_EL_LIST[i];
      p = puLingOf(el);
      btn = puBtn(body, '', 'pu-flow pu-gift', (function (e) {
        return function () { puPickGift(e); };
      })(el));
      cvObj = puCanvas(btn, 56, 56, '');
      if (p) pdPet(cvObj.ctx, p.id, 28, 50, 0.85, { silhouette: true });
      puEl(btn, 'span', '', PET_EL[el].name + '行 · 靈級餌');
    }
    row = puEl(box, 'div', 'pu-crow', '');
    puBtn(row, '稍後再說', 'pu-flow pu-cbtn', puModalHide);
  }
  puModalEl.style.display = '';
}

function puModalHide() {
  if (!puModalEl) return;
  puModalEl.style.display = 'none';
  puClear(puModalEl);
}

function puCoin() {
  try {
    return (typeof world !== 'undefined' && world && world.res) ? Math.floor(world.res.coin || 0) : 0;
  } catch (e) {
    return 0;
  }
}

function puLingOf(el) {
  var i;
  for (i = 0; i < PETS.length; i++) {
    if (PETS[i].el === el && PETS[i].rare === 'ling') return PETS[i];
  }
  return null;
}

function puPickGift(el) {
  var s = petEnsure(), bait = null, i;
  if (!petGift(el)) { puMsg('開園禮已領取過'); puModalHide(); return; }
  for (i = 0; i < PET_BAITS.length; i++) {
    if (PET_BAITS[i].el === el && PET_BAITS[i].tier === 'ling') { bait = PET_BAITS[i]; break; }
  }
  puSel.bait = bait ? bait.id : null;
  puSel.add = 0;
  puSub = 'brew';
  puModalHide();
  puMsg('開園禮已領取!依序:煉餌 → 招喚 → 丟靈球');
  puSetTab('craft');
}

// ---------------- 分頁 / 底部主要鈕 ----------------
function puSetTab(k) {
  if (k === puTab) return;
  puFinishAnim();
  puDetail = null;
  puDetId = '';
  puTab = k;
  puRenderAll();
}

function puRenderAll() {
  var i;
  if (!puLayer) return;
  for (i = 0; i < PU_TABS.length; i++) {
    puTabEls[i].className = 'pu-btn pu-chrome' + (PU_TABS[i][0] === puTab ? ' pu-on' : '');
  }
  puDockEl.style.display = (puTab === 'climb' || puTab === 'summon') ? '' : 'none';
  puCv.style.display = puTab === 'dex' ? 'none' : '';
  puDockKey = '';
  puSyncDock(true);
  puPlacePanel();
  puRenderPanel();
}

function puSpeed() {
  var s = petEnsure();
  return s.opt && s.opt.fast ? 2.5 : 1;
}

function puToggleFast() {
  var s = petEnsure();
  s.opt.fast = !s.opt.fast;
  petSave();
  puMsg('快速動畫:' + (s.opt.fast ? '開' : '關'));
}

function puSyncDock(force) {
  var s = petEnsure(), lbl = '', dis = false, cls = 'pu-btn pu-chrome pu-dock', bt = '🐚 ' + s.shell, key;
  if (puBalTxt !== bt || force) {
    puBalTxt = bt;
    puBalEl.textContent = '🐚 ' + s.shell;
  }
  if (puTab === 'climb') {
    if (s.shell < PET_CLIMB_COST) { lbl = '靈貝不足'; dis = true; } else { lbl = '攀登 🐚' + PET_CLIMB_COST; }
    if (puAnim) dis = true;
    if (s.bad >= 3) cls += ' pu-gold';
  } else if (puTab === 'summon') {
    if (puState === 'ready') {
      lbl = '丟靈球';
    } else if (puState === 'busy') {
      lbl = '…';
      dis = true;
    } else {
      lbl = '招喚';
      dis = !(puSel && puSel.bait && s.bait[puSel.bait] > 0);
    }
  }
  if (dis) cls += ' pu-dis';
  key = lbl + '|' + dis + '|' + cls;
  if (!force && key === puDockKey) return;
  puDockKey = key;
  puDockEl.className = cls;
  puDockEl.textContent = lbl;
}

function puDock() {
  if (puTab === 'climb') {
    puClimbGo();
  } else if (puTab === 'summon') {
    if (puState === 'ready') puThrowGo();
    else if (puState === 'idle') puSummonGo();
  }
  puSyncDock(false);
}

// ---------------- 面板內容 ----------------
function puRenderPanel() {
  var s;
  if (!puPanelEl || !puLayer) return;
  puClear(puPanelEl);
  puDexCvs = [];
  puDetCtx = null;
  puDetCv = null;
  puConvInfo = null;
  s = petEnsure();
  if (puTab === 'climb') puRenderClimb(s);
  else if (puTab === 'craft') puRenderCraft(s);
  else if (puTab === 'summon') puRenderSummon(s);
  else puRenderDex(s);
  puSyncDock(false);
}

function puRenderClimb(s) {
  var P = puPanelEl, row, lan, i, fl = PET_FLOORS[s.floor], e;
  row = puEl(P, 'div', 'pu-row pu-spread', '');
  lan = puEl(row, 'div', '', '');
  for (i = 0; i < 3; i++) puEl(lan, 'span', 'pu-lan' + (i < s.bad ? ' on' : ''), '燈');
  puEl(row, 'div', 'pu-fl', '第 ' + s.floor + ' 層 / 20 · ' + (fl ? fl.zone : ''));
  puEl(row, 'div', 'pu-charm' + (s.charm ? ' on' : ''), s.charm ? '平安符 ✓' : '平安符 —');
  row = puEl(P, 'div', 'pu-row', '');
  puEl(row, 'span', 'pu-lbl', '祈願');
  for (i = 0; i < PET_EL_LIST.length; i++) {
    e = PET_EL_LIST[i];
    puBtn(row, PET_EL[e].name, 'pu-flow pu-wish' + (s.focus === e ? ' pu-on' : ''), (function (el) {
      return function () {
        s.focus = el;
        petSave();
        puRenderPanel();
      };
    })(e));
  }
  puEl(P, 'div', 'pu-hint', '祈願五行:掉落的材料約六成是該五行。結果由籤決定,選擇只影響掉落。');
  puEl(P, 'div', 'pu-note', s.bad >= 3 ? '否極泰來:下一次必定往上!' : '每次攀登花 ' + PET_CLIMB_COST + ' 🐚。連續 3 次不往上,下一次必定往上。');
  puBtn(P, 'ⓘ 籤譜(公開機率)', 'pu-flow pu-link', function () { puModal('bands'); });
  if (s.shell < PET_CLIMB_COST) {
    row = puEl(P, 'div', 'pu-row pu-shellwarn', '');
    puEl(row, 'span', '', '🐚 靈貝不足!靈貝來源:釣魚 1 分 = 1 貝;或點餘額用金幣兌換');
    puBtn(row, '去釣魚 🎣', 'pu-flow', function () {
      petClose();
      if (typeof fishEnter === 'function') fishEnter('top');
    });
  } else {
    puEl(P, 'div', 'pu-hint', '靈貝來源:釣魚 1 分 = 1 貝;或點餘額用金幣兌換');
  }
}

function puBaitOwned(s) {
  var out = [], i, b;
  for (i = 0; i < PET_BAITS.length; i++) {
    b = PET_BAITS[i];
    if ((s.bait[b.id] || 0) > 0) out.push(b);
  }
  return out;
}

function puAddMax(s, el) {
  if (el === 'all') return 0;
  return Math.min(PET_ADD_MAX, s.mat[el + '_p'] || 0);
}

function puAllOwned(s) {
  var i;
  for (i = 0; i < PETS.length; i++) {
    if (PETS[i].hidden) continue;
    if (!s.pets[PETS[i].id]) return false;
  }
  return true;
}

function puOwnedQ(s, bait, q) {
  var id, n = 0;
  for (id in bait.mats) if (id.slice(-2) === '_' + q) n += s.mat[id] || 0;
  return n;
}

function puNeedQ(bait, q) {
  var id, n = 0;
  for (id in bait.mats) if (id.slice(-2) === '_' + q) n += bait.mats[id];
  return n;
}

function puRenderCraft(s) {
  var P = puPanelEl, row, subs = [['brew', '煉餌'], ['conv', '轉化'], ['mats', '材料庫']], i;
  row = puEl(P, 'div', 'pu-row', '');
  for (i = 0; i < subs.length; i++) {
    puBtn(row, subs[i][1], 'pu-flow' + (puSub === subs[i][0] ? ' pu-on' : ''), (function (k) {
      return function () { puSub = k; puRenderPanel(); };
    })(subs[i][0]));
  }
  if (puSub === 'brew') puRenderBrew(s, P);
  else if (puSub === 'conv') puRenderConv(s, P);
  else puRenderMats(s, P);
}

function puRenderBrew(s, P) {
  var list = puEl(P, 'div', '', ''), i, bait, pet, row, info, rec, q, qs = [['p', '紫'], ['c', '青'], ['b', '藍']], hid, all, own, can, cvT, cvP, n, ok, qq;
  all = puAllOwned(s);
  for (i = 0; i < PET_BAITS.length; i++) {
    bait = PET_BAITS[i];
    pet = petFindByBait(bait.id);
    hid = bait.tier === 'yin' && !all;
    own = !!(pet && s.pets[pet.id]);
    can = petCanCraft(bait.id);
    row = puEl(list, 'div', 'pu-brow' + (puSel.bait === bait.id ? ' pu-on' : ''), '');
    row.addEventListener('click', (function (id) {
      return function () { puSel.bait = id; puSel.add = 0; puRenderPanel(); };
    })(bait.id));
    cvP = puCanvas(row, 44, 44, '');
    if (hid) {
      cvP.ctx.fillStyle = '#3b2314';
      cvP.ctx.font = 'bold 22px sans-serif';
      cvP.ctx.textAlign = 'center';
      cvP.ctx.fillText('？', 22, 30);
    } else if (pet) {
      pdPet(cvP.ctx, pet.id, 22, 40, 0.6, { silhouette: !own });
    }
    cvT = puCanvas(row, 40, 40, '');
    pdBait(cvT.ctx, bait.id, 20, 24, 0.8);
    info = puEl(row, 'div', 'pu-binfo', '');
    puEl(info, 'div', 'pu-bname', (hid ? '？？？' : (pet ? pet.name : '')) + ' · ' + bait.name);
    rec = puEl(info, 'div', 'pu-recipe', '');
    for (q = 0; q < qs.length; q++) {
      qq = qs[q][0];
      n = puOwnedQ(s, bait, qq);
      ok = n >= puNeedQ(bait, qq);
      puEl(rec, 'span', ok ? 'ok' : 'no', hid ? '？' : (qs[q][1] + ' ' + n + '/' + puNeedQ(bait, qq)));
    }
    puBtn(row, '煉製', 'pu-flow pu-craftbtn' + (can ? '' : ' pu-dis'), (function (id) {
      return function () { puCraft(id); };
    })(bait.id));
  }
}

function puCraft(id) {
  var bait = petBaitFind(id);
  if (!bait) return;
  if (!petCraft(id)) {
    puMsg(petCanCraft(id) ? '煉製失敗' : '材料不足');
    return;
  }
  puFx.smoke = puT;
  puFx.smokeEl = bait.el;
  puSfx('pet_craft');
  puFlashShow('煉成:' + bait.name + ' ×1', 1.4);
  puRenderPanel();
}

function puConvFrom(s) {
  var best = null, bn = -1, i, el, n;
  if (puSel.cf && puSel.cf !== puSel.ct) return puSel.cf;
  for (i = 0; i < PET_EL_LIST.length; i++) {
    el = PET_EL_LIST[i];
    if (el === puSel.ct) continue;
    n = s.mat[el + '_' + puSel.cq] || 0;
    if (n > bn) { bn = n; best = el; }
  }
  return best;
}

function puRenderConv(s, P) {
  var row, i, qs = [['b', '藍'], ['c', '青'], ['p', '紫']], from, cnt, bt;
  row = puEl(P, 'div', 'pu-row', '');
  puEl(row, 'span', 'pu-lbl', '品質');
  for (i = 0; i < qs.length; i++) {
    puBtn(row, qs[i][1], 'pu-flow' + (puSel.cq === qs[i][0] ? ' pu-on' : ''), (function (q) {
      return function () { puSel.cq = q; puSel.cf = null; puRenderPanel(); };
    })(qs[i][0]));
  }
  row = puEl(P, 'div', 'pu-row', '');
  puEl(row, 'span', 'pu-lbl', '來源');
  puBtn(row, '自動', 'pu-flow' + (puSel.cf ? '' : ' pu-on'), function () { puSel.cf = null; puRenderPanel(); });
  for (i = 0; i < PET_EL_LIST.length; i++) {
    puBtn(row, PET_EL[PET_EL_LIST[i]].name, 'pu-flow' + (puSel.cf === PET_EL_LIST[i] ? ' pu-on' : ''), (function (e) {
      return function () { puSel.cf = e; puRenderPanel(); };
    })(PET_EL_LIST[i]));
  }
  row = puEl(P, 'div', 'pu-row', '');
  puEl(row, 'span', 'pu-lbl', '目標');
  for (i = 0; i < PET_EL_LIST.length; i++) {
    puBtn(row, PET_EL[PET_EL_LIST[i]].name, 'pu-flow' + (puSel.ct === PET_EL_LIST[i] ? ' pu-on' : ''), (function (e) {
      return function () { puSel.ct = e; puSel.cf = null; puRenderPanel(); };
    })(PET_EL_LIST[i]));
  }
  from = puConvFrom(s);
  cnt = from ? (s.mat[from + '_' + puSel.cq] || 0) : 0;
  puConvInfo = puEl(P, 'div', 'pu-note', puConvText(s, from, cnt));
  bt = puBtn(P, PET_CONVERT + ' 換 1(按住連續轉化)', 'pu-flow pu-dock pu-big', null);
  bt.addEventListener('pointerdown', function (e) {
    if (e && e.preventDefault) e.preventDefault();
    puHoldStop(false);
    puHolding = true;
    puConvOnce();
    puHoldT = setTimeout(function () {
      puHoldI = setInterval(puConvOnce, 150);
    }, 400);
  });
  bt.addEventListener('pointerup', function () { puHoldStop(true); });
  bt.addEventListener('pointerleave', function () { puHoldStop(true); });
  bt.addEventListener('pointercancel', function () { puHoldStop(true); });
  puEl(P, 'div', 'pu-hint', '同品質的 3 個任意五行材料換 1 個指定五行的材料。不能跨品質。');
}

function puConvText(s, from, cnt) {
  if (!from) return '沒有可用來源';
  return '來源 ' + PET_EL[from].name + ' 持有 ' + cnt + ' 個,目標 ' + PET_EL[puSel.ct].name + '。';
}

function puConvOnce() {
  var s = petEnsure(), from = puConvFrom(s), ok;
  ok = from ? petConvert(puSel.cq, from, puSel.ct) : false;
  if (!ok) {
    puHoldStop(true);
    puMsg('材料不足:需要 ' + PET_CONVERT + ' 個同品質材料');
    return;
  }
  if (puConvInfo) {
    from = puConvFrom(s);
    puConvInfo.textContent = puConvText(s, from, from ? (s.mat[from + '_' + puSel.cq] || 0) : 0);
  }
}

function puHoldStop(rerender) {
  var was = puHolding;
  puHolding = false;
  if (puHoldT) clearTimeout(puHoldT);
  if (puHoldI) clearInterval(puHoldI);
  puHoldT = 0;
  puHoldI = 0;
  if (was && rerender && puTab === 'craft' && puSub === 'conv') puRenderPanel();
}

function puRenderMats(s, P) {
  var grid = puEl(P, 'div', 'pu-mgrid', ''), note = puEl(P, 'div', 'pu-note', '點材料看說明'), i, j, el, id, m, cell, cvObj, qs = ['b', 'c', 'p'];
  puEl(grid, 'div', '', '');
  for (j = 0; j < qs.length; j++) puEl(grid, 'div', 'pu-lbl', PET_Q[qs[j]].name);
  for (i = 0; i < PET_EL_LIST.length; i++) {
    el = PET_EL_LIST[i];
    puEl(grid, 'div', 'pu-lbl', PET_EL[el].name);
    for (j = 0; j < qs.length; j++) {
      id = el + '_' + qs[j];
      m = null;
      for (var t = 0; t < PET_MATS.length; t++) if (PET_MATS[t].id === id) m = PET_MATS[t];
      cell = puEl(grid, 'div', 'pu-mcell', '');
      cvObj = puCanvas(cell, 36, 36, '');
      pdMat(cvObj.ctx, id, 18, 18, 0.9);
      puEl(cell, 'span', '', '×' + (s.mat[id] || 0));
      cell.addEventListener('click', (function (mm, nn) {
        return function () { note.textContent = (mm ? mm.name : nn) + ':' + (mm ? mm.desc : ''); };
      })(m, id));
    }
  }
}

function puRenderSummon(s) {
  var P = puPanelEl, owned = puBaitOwned(s), row, i, b, chip, cvObj, bait, pet, add, maxAdd, rate, info, pity, pt, st;
  if (puSel.bait && !(s.bait[puSel.bait] > 0)) { puSel.bait = null; puSel.add = 0; }
  row = puEl(P, 'div', 'pu-chiprow', '');
  for (i = 0; i < owned.length; i++) {
    b = owned[i];
    chip = puEl(row, 'div', 'pu-chip2' + (puSel.bait === b.id ? ' pu-on' : ''), '');
    cvObj = puCanvas(chip, 40, 40, '');
    pdBait(cvObj.ctx, b.id, 20, 24, 0.8);
    puEl(chip, 'span', '', b.name);
    puEl(chip, 'span', '', '×' + s.bait[b.id]);
    chip.addEventListener('click', (function (id) {
      return function () {
        if (puState === 'busy') return;
        if (puSel.bait !== id) { puSel.bait = id; puSel.add = 0; puResetSummon(); }
        puRenderPanel();
      };
    })(b.id));
  }
  if (!owned.length) puEl(P, 'div', 'pu-note', '沒有捕獸餌。到「煉丹爐」煉製;或先去雲階攀登取得材料。');
  if (!puSel.bait) return;
  bait = petBaitFind(puSel.bait);
  pet = petFindByBait(puSel.bait);
  if (!bait || !pet) return;
  info = puEl(P, 'div', 'pu-bname', (bait.tier === 'yin' && !puAllOwned(s) && !s.pets[pet.id] ? '？？？' : pet.name) + ' · ' + PET_RARITY[pet.rare].name + ' · ' + (pet.el === 'all' ? '五行' : PET_EL[pet.el].name + '行'));
  if (bait.el !== 'all') {
    maxAdd = puAddMax(s, bait.el);
    if (puSel.add > maxAdd) puSel.add = maxAdd;
    row = puEl(P, 'div', 'pu-row', '');
    puEl(row, 'span', 'pu-lbl', '加料(本系紫材料)');
    puBtn(row, '−', 'pu-flow', function () {
      if (puState !== 'idle') return;
      puSel.add = Math.max(0, puSel.add - 1);
      puRenderPanel();
    });
    puEl(row, 'span', '', puSel.add + ' / ' + maxAdd + '(持有 ' + (s.mat[bait.el + '_p'] || 0) + ')');
    puBtn(row, '+', 'pu-flow', function () {
      if (puState !== 'idle') return;
      if (puSel.add < maxAdd) puSel.add += 1;
      puRenderPanel();
    });
  }
  add = bait.el === 'all' ? 0 : puSel.add;
  rate = petCatchRate(pet.id, add);
  pity = s.pity[pet.id] || 0;
  pt = '';
  for (i = 0; i < pity && i < 8; i++) pt += '🔥';
  puEl(P, 'div', 'pu-bname', '捕獲率 ' + Math.round(rate * 100) + '%' + (pity > 0 ? '  誠意 ' + pt + ' ×' + pity : ''));
  st = puState === 'idle' ? '按「招喚」請出仙獸。' : (puState === 'ready' ? '按「丟靈球」試試運氣。' : '');
  puEl(P, 'div', 'pu-note', st);
}

function puResetSummon() {
  if (!puFx) return;
  puFx.sumOn = false;
  puState = 'idle';
  puFx.ballOn = false;
}

function puRenderDex(s) {
  var P = puPanelEl, head, n = 0, i, p, card, cvObj, owned, hidFx, grid, titles = [], all;
  for (i = 0; i < PETS.length; i++) if (s.pets[PETS[i].id]) n++;
  all = puAllOwned(s);
  for (i = 0; i < PET_TITLES.length; i++) if (s.tops >= PET_TITLES[i].tops) titles.push(PET_TITLES[i].name);
  head = puEl(P, 'div', 'pu-bname', '收集 ' + n + ' / ' + PETS.length);
  puEl(P, 'div', 'pu-note', '稱號:' + (titles.length ? titles.join('、') : '尚無') + ' · 登頂 ' + s.tops + ' 次 · 攀登 ' + s.climbs + ' 次 · 歸零 ' + s.resets + ' 次');
  if (puDetail && petFind(puDetail)) {
    puRenderDetail(s, P);
    return;
  }
  puDetail = null;
  grid = puEl(P, 'div', 'pu-grid', '');
  for (i = 0; i < PETS.length; i++) {
    p = PETS[i];
    owned = !!s.pets[p.id];
    hidFx = !!p.hidden && !all;
    card = puEl(grid, 'div', 'pu-card' + (owned ? ' own' : ''), '');
    cvObj = puCanvas(card, 72, 72, '');
    if (hidFx) {
      cvObj.ctx.fillStyle = '#3b2314';
      cvObj.ctx.font = 'bold 30px sans-serif';
      cvObj.ctx.textAlign = 'center';
      cvObj.ctx.fillText('?', 36, 46);
    } else {
      puDexCvs.push({ id: p.id, ctx: cvObj.ctx, sil: !owned });
    }
    puEl(card, 'div', 'pu-cname', owned ? p.name : '？？？');
    puEl(card, 'div', 'pu-crar', owned ? (PET_RARITY[p.rare].name + ' ' + puStars(s.pets[p.id].star)) : PET_RARITY[p.rare].name);
    if (owned) {
      card.addEventListener('click', (function (id) {
        return function () { puDetail = id; puDetId = id; puRenderPanel(); };
      })(p.id));
    }
  }
  void head;
}

function puRenderDetail(s, P) {
  var p = petFind(puDetail), owned = !!s.pets[p.id], cvObj, e, d, dt;
  puBtn(P, '‹ 返回圖鑑', 'pu-flow pu-link', function () { puDetail = null; puDetId = ''; puRenderPanel(); });
  cvObj = puCanvas(P, 200, 200, '');
  puDetCv = cvObj.cv;
  puDetCtx = cvObj.ctx;
  puDetCv.addEventListener('click', function () {
    if (!s.pets[p.id]) return;
    puFx.hopT = puT;
    puFx.heartT = puT;
    puPetPoke(puFx);
    puSfx('pet_pat');
  });
  puEl(P, 'div', 'pu-bname', (owned ? p.name : '？？？') + ' · ' + PET_RARITY[p.rare].name + (owned ? ' · ' + puStars(s.pets[p.id].star) : ''));
  puEl(P, 'div', 'pu-note', owned ? '五行:' + (p.el === 'all' ? '五行' : PET_EL[p.el].name) + ' · 捕獲 ' + s.pets[p.id].n + ' 次' : '尚未收錄。');
  if (owned) {
    e = s.pets[p.id];
    d = new Date(e.first || 0);
    dt = d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
    puEl(P, 'div', 'pu-note', '首次收錄:' + dt);
    puEl(P, 'div', 'pu-note', p.desc);
    puEl(P, 'div', 'pu-hint', '點仙獸可以摸摸牠。');
    puBtn(P, '再抓一隻(去煉丹爐)', 'pu-flow pu-link', function () {
      puSel.bait = p.bait;
      puSel.add = 0;
      puDetail = null;
      puDetId = '';
      puSub = 'brew';
      puTab = 'craft';
      puRenderAll();
    });
  } else {
    puEl(P, 'div', 'pu-note', p.hidden ? '隱藏仙獸:收齊其餘 15 隻後才會解鎖配方。' : '抓到牠之後,這裡會顯示出典描述。');
  }
}

// ---------------- 動畫播放器 ----------------
// tl 每段 {t, d, snd, sopt, draw(k)};t 與 d 為秒(原速),播放速度由 puSpeed 決定。
function puPlay(tl, onEnd) {
  var total = 0, i;
  for (i = 0; i < tl.length; i++) total = Math.max(total, tl[i].t + tl[i].d);
  puAnim = { tl: tl, el: 0, total: total, onEnd: onEnd || null, speed: puSpeed(), on: [], end: [] };
}

function puAnimStep(dt) {
  var a = puAnim, i, sg, k, names;
  if (!a) return;
  a.el += dt * a.speed;
  for (i = 0; i < a.tl.length; i++) {
    sg = a.tl[i];
    if (a.el < sg.t) continue;
    if (!a.on[i]) {
      a.on[i] = true;
      if (sg.snd) {
        names = typeof sg.snd === 'string' ? [sg.snd] : sg.snd;
        for (k = 0; k < names.length; k++) puSfx(names[k], sg.sopt);
      }
    }
    if (a.el < sg.t + sg.d) {
      if (sg.draw) sg.draw(Math.max(0, (a.el - sg.t) / sg.d));
    } else if (!a.end[i]) {
      a.end[i] = true;
      if (sg.draw) sg.draw(1);
    }
  }
  if (a.el >= a.total) {
    puAnim = null;
    if (a.onEnd) a.onEnd();
  }
}

// 立即結束目前的動畫(切換分頁時使用),仍會執行結束回呼以完成 UI 狀態。
function puFinishAnim() {
  var a = puAnim;
  if (!a) return;
  puAnim = null;
  if (a.onEnd) a.onEnd();
}

function puOnCanvasDown() {
  if (puAnim) puAnim.speed = 60;
  else if (puTab === 'summon' && puFx && puFx.sumOn && !puFx.sumSil) puPetPoke(puFx);
}

// ---------------- 雲階(攀登) ----------------
function puClimbGo() {
  var s = petEnsure(), r, d;
  if (puAnim) return;
  d = petSyncFish();
  if (d > 0) { puLastGain = d; puMsg('釣魚入帳 +' + d + ' 🐚'); }
  if (s.shell < PET_CLIMB_COST) { puModal('exchange'); return; }
  r = petClimb();
  if (!r) { puModal('exchange'); return; }
  puFx.p = r.from;
  puFx.avS = 1.1;
  puBuildClimb(r);
  puSyncDock(false);
}

function puStickMode(mode, k, name, col) {
  var f = puStickEl;
  if (!f) return;
  f.style.display = '';
  if (mode === 0) {
    if (f.textContent !== '搖籤…') f.textContent = '搖籤…';
    f.style.background = '#c8a86a';
    f.style.transform = 'translateX(' + (Math.sin(k * 40) * 6).toFixed(1) + 'px) rotate(' + (Math.sin(k * 30) * 6).toFixed(1) + 'deg)';
  } else {
    if (f.textContent !== name) f.textContent = name;
    f.style.background = col;
    f.style.transform = 'scale(' + (0.85 + 0.15 * k).toFixed(3) + ')';
  }
}

function puBuildClimb(r) {
  var tl = [], f = puFx, from = r.from, to = r.to, n, dir, t0 = 1.1, tEnd, j, isReset = r.d === -99, roll = PET_ROLL[r.idx],
    stickName = r.charmUsed ? PET_ROLL[6].charmName : roll.name, stickCol = r.charmUsed ? '#6a5a8c' : roll.color, lootTxt, lootShown = false;
  tl.push({ t: 0, d: 0.6, snd: 'pet_shake', draw: function (k) { puStickMode(0, k); } });
  tl.push({ t: 0.6, d: 0.5, snd: 'ui_tap', draw: function (k) { puStickMode(1, k, stickName, stickCol); } });
  if (r.charmUsed) {
    tl.push({ t: t0, d: 0.4, snd: 'pet_charm', draw: function (k) { f.charmOn = true; f.burn = k; } });
    tl.push({ t: t0 + 0.4, d: 0.001, draw: function () { f.charmOn = false; f.burn = 0; } });
    t0 += 0.4;
  }
  if (isReset) {
    tl.push({ t: t0, d: 0.4, snd: 'pet_fall', draw: function (k) { f.avS = 1.1 * (1 - 0.8 * k); f.qx = Math.sin(k * 60) * 6 * (1 - k); } });
    tl.push({ t: t0 + 0.4, d: 0.001, draw: function () { f.p = 0; f.avS = 0.2; f.qx = 0; } });
    tl.push({ t: t0 + 0.4, d: 0.6, draw: function (k) { f.fallY = -220 * (1 - k) * (1 - k); f.avS = 0.2 + 0.9 * Math.min(1, k * 1.6); } });
    tEnd = t0 + 1.0;
  } else {
    n = Math.abs(to - from);
    dir = to >= from ? 1 : -1;
    if (n === 0) {
      tl.push({ t: t0, d: 0.8, draw: function (k) { f.think = k < 1; } });
      tEnd = t0 + 0.8;
    } else {
      for (j = 0; j < n; j++) {
        (function (jj) {
          tl.push({ t: t0 + jj * 0.18, d: 0.18, snd: dir > 0 ? 'pet_step_up' : 'pet_step_down', draw: function (k) {
            f.p = from + dir * (jj + k);
            f.hopY = Math.sin(k * Math.PI) * 30;
          } });
        })(j);
      }
      tEnd = t0 + n * 0.18;
    }
  }
  if (r.top) {
    tl.push({ t: tEnd, d: 1.2, snd: 'pet_success', draw: function (k) { f.fxT = 'success'; f.fxTxt = '登頂!'; f.fxTk = k * 1.2; } });
    tEnd += 1.2;
  }
  lootTxt = puLootText(r.loot, r.top);
  tl.push({ t: tEnd, d: 1.4, snd: 'coin', draw: function () {
    if (lootShown) return;
    lootShown = true;
    f.fxT = '';
    puFlashShow(lootTxt, 2.2);
  } });
  puPlay(tl, function () {
    var s = petEnsure();
    f.p = s.floor;
    f.hopY = 0;
    f.think = false;
    f.fallY = 0;
    f.avS = 1.1;
    f.qx = 0;
    f.charmOn = false;
    f.burn = 0;
    f.fxT = '';
    if (puStickEl) puStickEl.style.display = 'none';
    puFlashHide();
    puRenderPanel();
  });
}

function puLootText(loot, top) {
  var ids = Object.keys(loot), out = [], i;
  for (i = 0; i < ids.length; i++) {
    if (loot[ids[i]] > 0) out.push(puMatName(ids[i]) + '×' + loot[ids[i]]);
  }
  return (top ? '天門寶匣!' : '獲得:') + (out.length ? out.join(' ') : '無');
}

// ---------------- 招靈台(招喚 / 丟球) ----------------
function puSummonGo() {
  var s = petEnsure(), bait, pet, f = puFx, shown = false, tl = [];
  if (puAnim || !puSel || !puSel.bait || !(s.bait[puSel.bait] > 0)) { puMsg('沒有可用的餌'); return; }
  bait = petBaitFind(puSel.bait);
  pet = petFindByBait(puSel.bait);
  if (!bait || !pet) return;
  puState = 'busy';
  f.sumId = pet.id;
  f.sumOn = true;
  f.sumSil = true;
  f.sumA = 0;
  f.sumS = 2.2 * 0.6;
  f.sumX = 195;
  f.sumY = 478;
  f.sumFace = 'normal';
  f.sumHop = 0;
  f.sumSmoke = -1;
  f.ballOn = false;
  f.sumElc = bait.el === 'all' ? 'wood' : bait.el;
  tl.push({ t: 0, d: 0.9, snd: 'pet_summon', draw: function (k) { f.sumSmoke = k; } });
  tl.push({ t: 0.9, d: 0.5, draw: function (k) { f.sumSmoke = -1; f.sumA = k; f.sumS = 2.2 * (0.6 + 0.4 * k); } });
  tl.push({ t: 1.4, d: 0.2, snd: 'pet_pat', draw: function (k) { f.sumSil = false; f.flash = 1 - k; f.sumA = 1; f.sumS = 2.2; } });
  tl.push({ t: 1.6, d: 0.4, draw: function () {
    if (shown) return;
    shown = true;
    if (puPlateEl) {
      puPlateEl.textContent = (bait.tier === 'yin' && !puAllOwned(s) && !s.pets[pet.id] ? '？？？' : pet.name) + ' · ' + PET_RARITY[pet.rare].name;
      puPlateEl.style.display = '';
    }
  } });
  puPlay(tl, function () {
    puState = 'ready';
    f.flash = 0;
    f.sumSil = false;
    f.sumA = 1;
    f.sumS = 2.2;
    puRenderPanel();
  });
}

function puThrowGo() {
  var s = petEnsure(), bait, pet, add, pre, r, post, nextAdd, tl, bid = puSel.bait;
  if (puAnim || puState !== 'ready' || !bid) return;
  bait = petBaitFind(bid);
  pet = petFindByBait(bid);
  if (!bait || !pet) return;
  add = bait.el === 'all' ? 0 : Math.min(puSel.add, puAddMax(s, bait.el));
  pre = petCatchRate(pet.id, add);
  r = petThrow(bid, add);
  if (!r) { puMsg('沒有可用的餌'); return; }
  puState = 'busy';
  puSel.add = 0;
  if (puPlateEl) puPlateEl.style.display = 'none';
  tl = puBuildThrow(r);
  puPlay(tl, function () { puThrowEnd(r, pet, bait, pre); });
  puSyncDock(false);
}

function puThrowEnd(r, pet, bait, pre) {
  var s = petEnsure(), f = puFx, post, nextAdd, lines, btns;
  f.ballOn = false;
  f.fxS = -1;
  f.fxA = -1;
  f.fxT = '';
  f.sink = 0;
  f.bash = 0;
  f.hum = false;
  f.beam = 0;
  f.ring = 0;
  f.absorb = 0;
  f.btilt = 0;
  f.bs = 1.5;
  if (r.ok) {
    puState = 'idle';
    f.sumOn = false;
    lines = [pet.name + '  ' + PET_RARITY[pet.rare].name + '  ' + puStars(s.pets[pet.id] ? s.pets[pet.id].star : 1)];
    if (r.isNew) lines.push('新收錄!已放入圖鑑。');
    else if (r.refund) lines.push('重複捕獲且已滿 5 星,仙獸回贈 ' + PET_EL[r.refund.mat.split('_')[0]].name + '行青材料 ×2。');
    else lines.push('重複捕獲,星級 +1。');
    lines.push('本次捕獲率 ' + Math.round(pre * 100) + '%');
    puCardShow('捕獲成功', lines, [{ t: '放入圖鑑', f: function () { puCardHide(); puRenderPanel(); } }]);
  } else {
    puState = 'idle';
    f.sumOn = false;
    nextAdd = bait.el === 'all' ? 0 : Math.min(PET_ADD_MAX, s.mat[bait.el + '_p'] || 0);
    post = petCatchRate(pet.id, nextAdd);
    lines = ['誠意 +1:下次捕獲率 ' + Math.round(pre * 100) + '% → ' + Math.round(post * 100) + '%'];
    if (!s.seen.failTip) {
      s.seen.failTip = true;
      petSave();
      lines.push('失敗會累積誠意,同一隻仙獸越抓越容易。');
    }
    btns = [];
    if (s.bait[bait.id] > 0) btns.push({ t: '再試一次', f: function () { puCardHide(); puSummonGo(); puRenderPanel(); } });
    btns.push({ t: '回招靈台', f: function () { puCardHide(); puRenderPanel(); } });
    puCardShow('仙獸逃走了', lines, btns);
  }
  puRenderPanel();
}

function puBuildThrow(r) {
  var f = puFx, tl = [], ok = r.ok, shakes = r.shakes, tb = 1.3, tc, sw = 0.314, heartShown = false;
  f.ballOn = true;
  f.bx = 195; f.by = 575; f.bs = 1.5; f.brot = 0; f.bopen = 0; f.bcrack = 0; f.bash = 0; f.balpha = 1; f.btilt = 0;
  f.absorb = 0; f.beam = 0; f.ring = 0; f.fxS = -1; f.fxA = -1; f.fxT = ''; f.hum = false; f.sink = 0;
  f.sumOn = true; f.sumSil = false; f.sumA = 1; f.sumS = 2.2; f.sumX = 195; f.sumY = 478; f.sumFace = 'normal'; f.sumHop = 0;
  tl.push({ t: 0, d: 0.6, snd: 'pet_throw', draw: function (k) {
    f.bx = 195;
    f.by = 575 + (408 - 575) * k - Math.sin(k * Math.PI) * 90;
    f.brot = k * 4 * Math.PI;
  } });
  tl.push({ t: 0.6, d: 0.4, snd: 'pet_absorb', draw: function (k) {
    f.bx = 195; f.by = 408; f.brot += 0.2;
    f.absorb = k; f.sumA = 1 - k; f.sumS = 2.2 * (1 - 0.7 * k); f.bopen = 0.27 * k;
  } });
  tl.push({ t: 1.0, d: 0.3, snd: ['pet_lock'], sopt: { gain: 0.3 }, draw: function (k) {
    f.absorb = 0; f.sumOn = false; f.bopen = 0;
    f.bx = 195;
    f.by = 408 + 62 * Math.min(1, k * 1.4) - 20 * Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k);
  } });
  if (ok) {
    tl.push({ t: tb, d: 0.5, snd: 'pet_shake', draw: function (k) { f.btilt = Math.sin(k * 2 * Math.PI) * sw; } });
    tl.push({ t: tb + 0.8, d: 0.5, snd: 'pet_shake', draw: function (k) { f.btilt = Math.sin(k * 2 * Math.PI) * sw; } });
    tl.push({ t: tb + 1.7, d: 0.35, snd: ['pet_lock', 'pet_success'], draw: function (k) {
      f.btilt = 0;
      f.bs = 1.5 * (1 + 0.6 * puEasBack(k));
      f.by = 470;
      f.fxS = 0.5 * k;
    } });
    tl.push({ t: tb + 2.05, d: 0.3, draw: function (k) { f.fxS = 0.5 + 0.5 * k; f.fxT = 'success'; f.fxTxt = '捕獲成功'; f.fxTk = k * 0.3; } });
    tl.push({ t: tb + 2.9, d: 0.6, snd: 'pet_pat', draw: function (k) {
      if (!heartShown) { heartShown = true; f.heartT = puT; }
      f.fxS = -1;
      f.by = 470;
      f.bopen = k;
      f.balpha = 1 - k;
      f.sumOn = true; f.sumA = 1; f.sumSil = false; f.sumFace = 'happy';
      f.sumS = 2.2 * (0.2 + 0.8 * k);
      if (f.actN !== 'cheer') { f.actN = 'cheer'; f.actT0 = puT; f.actSay = ''; }
    } });
    return tl;
  }
  tc = shakes === 2 ? tb + 0.8 : tb + 0.5;
  tl.push({ t: tb, d: 0.5, snd: 'pet_shake', draw: function (k) { f.btilt = Math.sin(k * 2 * Math.PI) * sw; } });
  if (shakes === 2) tl.push({ t: tb + 0.5, d: 0.3, snd: 'pet_shake', draw: function (k) { f.btilt = Math.sin(k * 2 * Math.PI) * sw * (1 - 0.5 * k); } });
  tl.push({ t: tc, d: 0.25, snd: 'pet_crack', draw: function (k) {
    f.btilt = 0;
    f.bx = 195 + Math.sin(k * Math.PI * 40) * 6 * (1 - k * 0.3);
    f.by = 470;
    f.bcrack = k;
  } });
  tl.push({ t: tc + 0.25, d: 0.2, snd: 'pet_open', draw: function (k) { f.bx = 195; f.bcrack = 1; f.bopen = k; } });
  tl.push({ t: tc + 0.45, d: 0.3, snd: 'pet_open', sopt: { gain: 0.5 }, draw: function (k) { f.beam = k; f.ring = k; f.bopen = 1; } });
  tl.push({ t: tc + 0.75, d: 0.3, draw: function (k) {
    f.beam = 0; f.ring = 0;
    f.sumOn = true; f.sumA = 1; f.sumSil = false; f.sumFace = 'smug'; f.sumS = 2.2 * Math.max(0.01, k);
    f.sumX = 195; f.sumY = 478;
    if (f.actN !== 'bow') { f.actN = 'bow'; f.actT0 = puT; f.actSay = ''; }
  } });
  tl.push({ t: tc + 0.75, d: 0.5, draw: function (k) { f.bopen = 0; f.bash = k; f.balpha = 1 - k; } });
  tl.push({ t: tc + 1.05, d: 1.2, snd: 'pet_fail', draw: function (k) { f.fxA = k; f.sink = 6 * k; } });
  tl.push({ t: tc + 1.3, d: 1.6, draw: function (k) { f.fxT = 'fail'; f.fxTxt = '捕獲失敗'; f.fxTk = k * 0.8; } });
  tl.push({ t: tc + 2.3, d: 0.6, draw: function (k) { f.sumX = 195 + k * 420; f.sumA = 1 - 0.3 * k; f.hum = k < 0.8; f.sumFace = 'smug'; } });
  tl.push({ t: tc + 2.9, d: 0.4, draw: function (k) { f.fxA = 1 - k; f.fxT = ''; f.sumOn = false; f.hum = false; f.sink = 6 * (1 - k); } });
  return tl;
}

// ---------------- 繪製 ----------------
function puDrawScene() {
  var ctx = puCtx, v = puView, f = puFx;
  if (!ctx || !v || !f) return;
  ctx.setTransform(v.dpr * v.s, 0, 0, v.dpr * v.s, v.dpr * v.ox, v.dpr * v.oy);
  ctx.clearRect(-800, -800, 2400, 2400);
  if (puTab === 'dex') return;
  ctx.save();
  ctx.translate(f.qx || 0, f.sink || 0);
  if (puTab === 'climb') puDrawClimb(ctx, f);
  else if (puTab === 'craft') puDrawCraft(ctx, f);
  else puDrawSummon(ctx, f);
  ctx.restore();
}

function puDrawClimb(ctx, f) {
  var fl = Math.max(0, Math.min(20, Math.round(f.p))), lo = Math.max(0, Math.min(16, Math.floor(f.p) - 2)), k, xy;
  pdStairs(ctx, { floor: fl, lo: lo }, puT);
  k = f.p - lo;
  xy = pdStepXY(k);
  ctx.save();
  ctx.globalAlpha = f.avA === undefined ? 1 : f.avA;
  if (f.charmOn) pdCharm(ctx, xy[0] - 46, xy[1] - 96, 1.6, { burn: f.burn });
  if (f.avS > 0.01) pdAvatar(ctx, xy[0], xy[1] - f.hopY + f.fallY, f.avS, puT);
  if (f.think) {
    ctx.fillStyle = '#3b2314';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('…', xy[0] + 26, xy[1] - 70);
  }
  ctx.restore();
  if (f.fxT) drawBigText(ctx, f);
}

function drawBigText(ctx, f) {
  ctx.save();
  ctx.translate(195, 300);
  pdBigText(ctx, f.fxTxt || '', f.fxT === 'fail' ? 'fail' : 'success', f.fxTk || 0);
  ctx.restore();
}

function puDrawCraft(ctx, f) {
  var bait = puSel && puSel.bait ? petBaitFind(puSel.bait) : null, sm = null;
  if (f.smoke >= 0 && puT - f.smoke < 0.8) sm = f.smokeEl;
  ctx.save();
  ctx.translate(195, 420);
  pdCauldron(ctx, puT, sm);
  ctx.restore();
  if (bait) pdBait(ctx, bait.id, 195, 262, 1.5);
}

function puDrawSummon(ctx, f) {
  var el = (puSel && puSel.bait && petBaitFind(puSel.bait)) ? petBaitFind(puSel.bait).el : 'wood', i, ph, a, d, hx, hy, hi;
  if (el === 'all') el = 'wood';
  ctx.translate(0, PU_SUM_DY);
  ctx.save();
  ctx.translate(195, 560);
  pdAltar(ctx, el, puT);
  ctx.restore();
  if (f.sumSmoke >= 0) {
    for (i = 0; i < 6; i++) {
      ph = ((f.sumSmoke * 0.9 + i / 6) % 1 + 1) % 1;
      ctx.save();
      ctx.globalAlpha = 0.45 * (1 - ph);
      ctx.fillStyle = PET_EL[el] ? PET_EL[el].color : '#ffffff';
      ctx.beginPath();
      ctx.arc(195 + Math.sin(i * 1.7 + ph * 4) * 14, 430 - ph * 120, 6 + ph * 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  if (f.sumOn) {
    ctx.save();
    ctx.globalAlpha = f.sumA;
    pdPet(ctx, f.sumId, f.sumX, f.sumY - f.sumHop, f.sumS, { silhouette: f.sumSil, face: f.sumFace === 'normal' ? undefined : f.sumFace, anim: puPetAnim(f), say: puPetSay(f) });
    ctx.restore();
  }
  if (f.absorb > 0) {
    ctx.save();
    ctx.globalAlpha = 0.9 * f.absorb;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(195, 408, 50 * f.absorb + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (f.flash > 0) {
    ctx.save();
    ctx.globalAlpha = f.flash * 0.8;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(195, 408, 40 + (1 - f.flash) * 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (f.ballOn) {
    ctx.save();
    ctx.globalAlpha = f.balpha;
    ctx.translate(f.bx, f.by);
    ctx.rotate(f.btilt || 0);
    pdBall(ctx, 0, 0, f.bs, { open: f.bopen, rot: f.brot, crack: f.bcrack, ash: f.bash });
    ctx.restore();
  }
  if (f.beam > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.35 * f.beam;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(195, 300); ctx.lineTo(195, 478); ctx.stroke();
    ctx.globalAlpha = f.beam;
    ctx.lineWidth = 6 - 4 * f.beam;
    ctx.beginPath(); ctx.moveTo(195, 300); ctx.lineTo(195, 478); ctx.stroke();
    ctx.restore();
  }
  if (f.ring > 0) {
    ctx.save();
    ctx.globalAlpha = 1 - f.ring;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(195, 478, 10 + 60 * f.ring, (10 + 60 * f.ring) * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (f.fxS >= 0) {
    ctx.save();
    ctx.translate(f.sumX, f.sumY - 60);
    pdFxSuccess(ctx, f.fxS);
    ctx.restore();
  }
  if (f.fxA >= 0) {
    ctx.save();
    ctx.translate(195, 422);
    pdFxAbyss(ctx, f.fxA);
    ctx.restore();
  }
  if (f.fxT) drawBigText(ctx, f);
  if (f.hum) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('哼!', f.sumX + 30, f.sumY - 150);
  }
  if (f.heartT !== undefined && puT - f.heartT < 1.2) {
    ctx.fillStyle = '#ff5d7a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    for (d = 0; d < 3; d++) {
      a = puT - f.heartT;
      hx = f.sumX - 30 + d * 30;
      hy = f.sumY - 170 - a * 40 - d * 8;
      hi = Math.max(0, 1 - a / 1.2);
      ctx.globalAlpha = hi;
      ctx.fillText('♥', hx, hy);
    }
    ctx.globalAlpha = 1;
  }
}

// 仙獸互動動作:預設 idle 循環;點擊輪流 greet / punch / nod / happy-hop 並配一句泡泡
var PU_POKE = [['greet', '你好呀!'], ['punch', '喝!'], ['nod', '嗯嗯!'], ['happy-hop', '好開心!']];
function puPetPoke(f) {
  var p = PU_POKE[(f.actI = ((f.actI || 0) + 1)) % PU_POKE.length];
  f.actN = p[0]; f.actT0 = puT; f.actSay = p[1];
}
function puPetAnim(f) {
  var a = f && f.actN && typeof _PD_ACT !== 'undefined' ? _PD_ACT[f.actN] : null;
  if (a && puT - f.actT0 < a.dur) return { name: f.actN, t: puT - f.actT0 };
  return { name: 'idle', t: puT, loop: true };
}
function puPetSay(f) { return f && f.actSay && f.actN && puT - f.actT0 < 1.2 ? f.actSay : ''; }

function puDrawDex() {
  var i, c, t = puT, d;
  for (i = 0; i < puDexCvs.length; i++) {
    c = puDexCvs[i];
    c.ctx.setTransform(puDpr, 0, 0, puDpr, 0, 0);
    c.ctx.clearRect(0, 0, 72, 72);
    pdPet(c.ctx, c.id, 36, 62, 0.95, { silhouette: c.sil, breath: 1 + 0.03 * Math.sin(t * Math.PI) });
  }
  if (puDetCtx && puDetId) {
    d = petFind(puDetId);
    if (!d) return;
    puDetCtx.setTransform(puDpr, 0, 0, puDpr, 0, 0);
    puDetCtx.clearRect(0, 0, 200, 200);
    pdPet(puDetCtx, puDetId, 100, 180, 2.2, {
      silhouette: !(petEnsure().pets[puDetId]),
      anim: puPetAnim(puFx),
      say: puPetSay(puFx)
    });
    if (puFx && puFx.heartT !== undefined && t - puFx.heartT < 1) {
      puDetCtx.fillStyle = '#ff5d7a';
      puDetCtx.font = 'bold 16px sans-serif';
      puDetCtx.textAlign = 'center';
      puDetCtx.fillText('♥', 60 + (t - puFx.heartT) * 20, 60 - (t - puFx.heartT) * 60);
      puDetCtx.fillText('♥', 140 - (t - puFx.heartT) * 10, 70 - (t - puFx.heartT) * 50);
    }
  }
}

// ---------------- 主迴圈 / 進出 ----------------
function puFxReset() {
  puFx = {
    p: 0, avS: 1.1, avA: 1, hopY: 0, fallY: 0, qx: 0, burn: 0, charmOn: false, think: false, topK: 0,
    sumOn: false, sumId: '', sumX: 195, sumY: 478, sumS: 2.2, sumA: 1, sumSil: false, sumFace: 'normal', sumHop: 0,
    sumSmoke: -1, sumElc: 'wood', ballOn: false, bx: 195, by: 470, bs: 1.5, brot: 0, bopen: 0, bcrack: 0, bash: 0,
    balpha: 1, btilt: 0, absorb: 0, beam: 0, ring: 0, flash: 0, fxS: -1, fxA: -1, fxT: '', fxTxt: '', fxTk: 0,
    hum: false, sink: 0, smoke: -1, smokeEl: null, hopT: undefined, heartT: undefined
  };
}

function puFrame(now) {
  var dt;
  puRaf = 0;
  if (!puLayer || puPaused) return;
  dt = Math.min(1 / 30, Math.max(0, (now - puLast) / 1000));
  puLast = now;
  puT += dt;
  puAnimStep(dt);
  if (puMsgUntil && puT > puMsgUntil) { puMsgUntil = 0; if (puMsgEl) puMsgEl.style.display = 'none'; }
  if (puFlashUntil && puT > puFlashUntil) { puFlashUntil = 0; puFlashHide(); }
  if (puTab === 'dex') puDrawDex();
  else puDrawScene();
  puSyncDock(false);
  puRaf = requestAnimationFrame(puFrame);
}

function puOnVis() {
  if (!puLayer) return;
  if (document.visibilityState === 'hidden') {
    puPaused = true;
    cancelAnimationFrame(puRaf);
    puRaf = 0;
    petSave();
  } else if (puPaused) {
    puPaused = false;
    puLast = performance.now();
    puRaf = requestAnimationFrame(puFrame);
  }
}

var PU_HIDE_SAVED = [];

function puHideOthers(on) {
  var i, el;
  if (on) {
    PU_HIDE_SAVED = [];
    for (i = 0; i < PU_HIDE.length; i++) {
      el = document.getElementById(PU_HIDE[i]);
      if (!el) continue;
      PU_HIDE_SAVED.push([el, el.style.visibility || '']);
      el.style.visibility = 'hidden';
    }
  } else {
    for (i = 0; i < PU_HIDE_SAVED.length; i++) PU_HIDE_SAVED[i][0].style.visibility = PU_HIDE_SAVED[i][1];
    PU_HIDE_SAVED = [];
  }
}

function petOpen() {
  var s, gained;
  if (puLayer) return true;
  if (typeof game === 'undefined' || game.mode !== 'estate') return false;
  s = petEnsure();
  gained = petSyncFish();
  puLastGain = gained;
  puDpr = window.devicePixelRatio || 1;
  puHideOthers(true);
  puBuild();
  puFxReset();
  puAnim = null;
  puT = 0;
  puSel = { bait: null, add: 0, cq: 'b', cf: null, ct: 'wood' };
  puDetail = null;
  puDetId = '';
  puState = 'idle';
  puSub = 'brew';
  puTab = 'climb';
  puDexCvs = [];
  puDetCtx = null;
  puDetCv = null;
  puBalTxt = '';
  puDockKey = '';
  puPaused = false;
  puFx.p = s.floor;
  game.mode = 'pet';
  puSyncTop();
  puLast = performance.now();
  document.addEventListener('visibilitychange', puOnVis);
  puBindResize(true);
  puResize();
  puRenderAll();
  puRaf = requestAnimationFrame(puFrame);
  if (gained > 0) puMsg('釣魚入帳 +' + gained + ' 🐚');
  if (!s.gift) puModal('gift');
  return true;
}

function petClose() {
  var ok = true;
  if (!puLayer) return false;
  ok = petSave();
  cancelAnimationFrame(puRaf);
  puRaf = 0;
  puHoldStop(false);
  puAnim = null;
  document.removeEventListener('visibilitychange', puOnVis);
  puBindResize(false);
  puLayer.parentNode.removeChild(puLayer);
  puLayer = null; puCv = null; puCtx = null; puView = null; puPanelEl = null; puBackEl = null; puGearEl = null; puBalEl = null;
  puTabEls = []; puDockEl = null; puCardEl = null; puModalEl = null; puMsgEl = null; puStickEl = null; puPlateEl = null;
  puFlashEl = null; puProbe = null; puDexCvs = []; puDetCtx = null; puDetCv = null; puFx = null; puSel = null; puDetail = null;
  puDetId = ''; puState = 'idle'; puPaused = false; puDockKey = ''; puBalTxt = ''; puConvInfo = null; puMsgUntil = 0; puFlashUntil = 0;
  puHideOthers(false);
  if (game.mode === 'pet') game.mode = 'estate';
  puSyncTop();
  if (!ok && typeof showToast === 'function') showToast('儲存空間不足,仙獸苑紀錄可能未保存');
  return true;
}

// ---------------- 頂列鈕 / 設定列 / 音效註冊 ----------------
function puSyncTop() {
  var b = document.getElementById('btnPet'), cls = '';
  if (!b || typeof game === 'undefined') return;
  if (document.body && document.body.className) cls = String(document.body.className);
  b.hidden = !(game.mode === 'estate' && cls.indexOf('sandbox') < 0);
}

function puMountButton() {
  var top = document.getElementById('topbar'), btn, kids, fb = document.getElementById('btnFish'), ref = null, i, idx = -1;
  if (!top || document.getElementById('btnPet')) return;
  btn = document.createElement('button');
  btn.id = 'btnPet';
  btn.title = '仙獸苑';
  btn.textContent = '🐾';
  btn.addEventListener('click', function () { petOpen(); });
  kids = top.children || [];
  for (i = 0; fb && i < kids.length; i++) if (kids[i] === fb) idx = i;
  if (idx >= 0) ref = kids[idx + 1] || null;
  else ref = document.getElementById('btnClear');
  top.insertBefore(btn, ref);
  puTopTimer = setInterval(puSyncTop, 300);
  puSyncTop();
}

(function puInit() {
  if (typeof AUDIO_DEFS !== 'undefined' && typeof AUDIO_SYNTH !== 'undefined' && typeof PET_AUDIO_DEFS !== 'undefined') {
    Object.assign(AUDIO_DEFS, PET_AUDIO_DEFS);
    Object.assign(AUDIO_SYNTH, PET_AUDIO_SYNTH);
  }
  puMountButton();
})();
