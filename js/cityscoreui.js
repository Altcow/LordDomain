// js/cityscoreui.js — 城建評分介面(PLAN_CITY §2.3 §2.4):頂列繁榮度晶片、繁榮度面板(六軸橫條 + 貢獻前五 + 評語)、放置前浮字預覽、升級抽屜的城建條件列。
// 只在城建專注模式(isCityOnly())顯示。引擎在 cityscore.js,資料在 cityscore_data.js。DOM 全由本檔建立,樣式在 css/style.css 的「城建評分」區塊。
// 載入順序:progui.js 之後(借用 puiEl / puiBtn / puiReq / puiToast)。外部全域一律 typeof 守衛。
// 全域名稱:initCityScoreUI csTick csPreviewTick csOpen csClose csRefresh cityRenderReq cityGoTo;其餘內部一律 cs / csXxx。ES2017;不用 ?. ??。

var cs = { inited: false, open: false, chip: null, chipTxt: null, panel: null, body: null, head: null, preview: null, pvKey: '', pvTxt: '', exp: {}, tick: 0 };

function csCity() { return typeof isCityOnly === 'function' && isCityOnly(); }
function csLv() { return (typeof prog !== 'undefined' && prog) ? prog.lv : 1; }
function csEl(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined && txt !== null) e.textContent = txt;
  return e;
}
function csFmt(v) { return String(Math.round(v)); }

// 面板顯示該軸時用的星字串
function csStarText(n) { var s = '', i; for (i = 0; i < 5; i++) s += i < n ? '★' : '☆'; return s; }

// ───── 頂列晶片 ─────
function csChipUpdate() {
  var S;
  if (!cs.chip) return;
  cs.chip.hidden = !csCity();
  if (cs.chip.hidden) return;
  S = cityscoreGet(false);
  cs.chipTxt.textContent = '繁榮 ' + csFmt(S.pros) + ' · 👥' + csFmt(S.pop);
  cs.chip.setAttribute('title', '城市繁榮度與人口(點開看六軸)');
}

// ───── 面板 ─────
function csBar(frac, cls) {
  var bar = csEl('div', 'cs-bar'), fill = csEl('i', cls || 'cs-fill');
  fill.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
  bar.appendChild(fill);
  return bar;
}

function csRefresh() {
  var S, lv, B, req, popReq, row, a, st, target, i, tops, wrap, line, anyHidden = null, covTxt = [], svcs = ['water', 'food', 'goods', 'safe', 'fun', 'cul'], svcLv = { water: 1, food: 2, goods: 3, safe: 4, fun: 5, cul: 7 };
  if (!cs.inited || !cs.open) return;
  S = cityscoreGet(false);
  lv = csLv();
  B = cs.body;
  B.textContent = '';
  req = cityProsperityReq(lv);
  popReq = cityPopReq(lv);
  row = csEl('div', 'cs-big');
  row.appendChild(csEl('span', 'cs-bigl', '繁榮度'));
  row.appendChild(csEl('b', 'cs-bign', csFmt(S.pros)));
  row.appendChild(csEl('span', 'cs-bigs', lv < PROG_LV_MAX ? '升級門檻 ' + req : '已滿級'));
  B.appendChild(row);
  if (lv < PROG_LV_MAX) B.appendChild(csBar(S.pros / req));
  row = csEl('div', 'cs-big');
  row.appendChild(csEl('span', 'cs-bigl', '人口'));
  row.appendChild(csEl('b', 'cs-bign', csFmt(S.pop)));
  row.appendChild(csEl('span', 'cs-bigs', lv < PROG_LV_MAX ? '升級門檻 ' + popReq : ''));
  B.appendChild(row);
  if (lv < PROG_LV_MAX) B.appendChild(csBar(S.pop / popReq, 'cs-fill cs-fill2'));
  for (i = 0; i < CITY_AXES.length; i++) {
    a = CITY_AXES[i];
    if (!cityAxisVisible(a.id, lv)) { if (!anyHidden || a.reveal < anyHidden.reveal) anyHidden = a; continue; }
    st = cityStars(S, a.id, lv);
    target = cityProsperityReq(Math.min(PROG_LV_MAX - 1, lv + 1)) * CITY_AXIS_WEIGHT[a.id];
    wrap = csEl('div', 'cs-ax' + (cs.exp[a.id] ? ' open' : ''));
    line = csEl('div', 'cs-axl');
    line.setAttribute('role', 'button');
    line.appendChild(csEl('span', 'cs-axn', a.name));
    line.appendChild(csBar(S.axes[a.id] / Math.max(1, target)));
    line.appendChild(csEl('span', 'cs-axv', csFmt(S.axes[a.id])));
    line.appendChild(csEl('span', 'cs-axs', csStarText(st)));
    (function (id) { line.addEventListener('click', function () { cs.exp[id] = !cs.exp[id]; csRefresh(); }); })(a.id);
    wrap.appendChild(line);
    if (cs.exp[a.id]) {
      tops = cityscoreTop(S, a.id, 5);
      if (!tops.length) wrap.appendChild(csEl('div', 'cs-top', '還沒有貢獻,多蓋點相關建築吧。'));
      tops.forEach(function (t) { wrap.appendChild(csEl('div', 'cs-top', t.name + (t.n > 1 ? ' ×' + t.n : '') + '  +' + csFmt(t.v))); });
    }
    B.appendChild(wrap);
  }
  if (anyHidden) B.appendChild(csEl('div', 'cs-hint', '升到 Lv' + anyHidden.reveal + ' 開放「' + anyHidden.name + '」軸(其他軸之後逐步開放)。'));
  svcs.forEach(function (s) { if (lv >= svcLv[s] && S.houses > 0) covTxt.push(CITY_SVC[s].name + ' ' + Math.floor(S.cover[s] * 100 + 1e-6) + '%'); });
  if (covTxt.length) B.appendChild(csEl('div', 'cs-cov', '民居 ' + S.houses + ' 戶 · 服務覆蓋:' + covTxt.join('、')));
  B.appendChild(csEl('div', 'cs-say', cityComment(S, lv)));
}

function csOpen() {
  if (!cs.inited || !csCity()) return;
  cs.open = true;
  cs.panel.hidden = false;
  if (typeof panelOpen === 'function') panelOpen('cs');
  csRefresh();
}
function csClose() {
  if (!cs.inited) return;
  cs.open = false;
  cs.panel.hidden = true;
  if (typeof panelClose === 'function') panelClose('cs');
}

// ───── 放置預覽浮字 ─────
// 草稿(ui.js draft)位置 / 方向變動時,試算「放下後」的各軸差,顯示在頂列下方小浮字;不遮畫面中央
function csPreviewText(p, lv) {
  var parts = [], list = [];
  if (!p) return '';
  CITY_AXES.forEach(function (a) { if (cityAxisVisible(a.id, lv) && Math.abs(p.d[a.id]) >= 0.5) list.push({ sh: a.sh, v: p.d[a.id] }); });
  list.sort(function (x, y) { return Math.abs(y.v) - Math.abs(x.v); });
  list.slice(0, 3).forEach(function (it) { parts.push((it.v > 0 ? '+' : '') + Math.round(it.v) + ' ' + it.sh); });
  if (Math.abs(p.pop) >= 1) parts.push((p.pop > 0 ? '+' : '') + Math.round(p.pop) + ' 口');
  if (Math.abs(p.pros) >= 1 && parts.length) parts.push('繁榮 ' + (p.pros > 0 ? '+' : '') + Math.round(p.pros));
  return parts.join('  ');
}

function csPreviewTick() {
  var d, key, p, txt;
  if (!cs.preview) return;
  d = (typeof draft !== 'undefined') ? draft : null;
  if (!d || !csCity() || d.combo || !d.ok) {
    if (cs.pvKey) { cs.pvKey = ''; cs.pvTxt = ''; cs.preview.hidden = true; }
    return;
  }
  key = d.type + '|' + d.x + '|' + d.y + '|' + d.rot;
  if (key === cs.pvKey) return;
  cs.pvKey = key;
  p = cityscorePreview(d.type, d.x, d.y, d.rot, d.orig || null);
  txt = csPreviewText(p, csLv());
  cs.pvTxt = txt;
  cs.preview.textContent = txt;
  cs.preview.hidden = !txt;
}

// 約 250ms 一次:預覽;每 4 次(約 1 秒)更新晶片與面板
function csTick() {
  if (!cs.inited) return;
  csPreviewTick();
  cs.tick++;
  if (cs.tick % 4 === 0) {
    csChipUpdate();
    if (cs.open) { if (csCity()) csRefresh(); else csClose(); }
  }
}

// ───── 升級抽屜:城建條件列(由 progui.js puiRenderReq 在城建專注模式呼叫)─────
// 一鍵前往:關抽屜、選好該建築工具,並提示怎麼放
function cityGoTo(cond) {
  var lv = csLv(), id = null, i, nm;
  for (i = 0; i < (cond.go || []).length; i++) {
    var gid = (typeof fxGoType === 'function') ? fxGoType(cond.go[i]) : cond.go[i];   // 魔幻世界:隱藏的漢式物件換成魔幻件
    if (typeof OBJECTS !== 'undefined' && OBJECTS[gid] && (typeof isUnlocked !== 'function' || isUnlocked('estate', gid))) { id = gid; break; }
  }
  if (typeof progUiClose === 'function') progUiClose();
  if (!id) { if (typeof showToast === 'function') showToast('提示:' + cond.text); return false; }
  nm = OBJECTS[id].name || id;
  try { if (typeof setTool === 'function') setTool(id); } catch (e) { console.warn('[cityscoreui] 選工具失敗', e); }
  if (typeof showToast === 'function') showToast('營造要求:' + cond.text + '。已選「' + nm + '」,點地面放置');
  return true;
}

function cityRenderReq(R, p, c) {
  var S = cityscoreGet(false), lv = p.lv, rl, ok;
  R.appendChild(puiReq(S.pros >= c.pros, '繁榮度', csFmt(S.pros), c.pros, '六軸總和;點頂列「繁榮」看各軸與貢獻'));
  R.appendChild(puiReq(S.pop >= c.pop, '人口', csFmt(S.pop), c.pop, '民居住戶;民居旁有水井、糧食等服務,入住率更高'));
  rl = cityReqList(lv, S);
  if (rl) {
    R.appendChild(puiEl('div', 'pg-sec', (rl.big ? '大工程:' : '營造要求:') + rl.title));
    rl.conds.forEach(function (cd) {
      var pct = cd.cond.k === 'cover' || cd.cond.k === 'roadnear', row;
      row = puiReq(cd.ok, cd.text + (pct ? '(%)' : ''), cd.have, cd.need);
      if (!cd.ok) row.appendChild(puiBtn('pg-go', '前往', function () { cityGoTo(cd.cond); }));
      R.appendChild(row);
    });
  }
  ok = c.goods && Object.keys(c.goods).length;
  if (ok && typeof goodsRenderReq === 'function') goodsRenderReq(R, c.goods);   // 貨品需求列:貨品系統可自訂
  else if (ok) {   // 預設列:名稱 + 庫存 / 需求(接入貨品需求表 goodsUpgradeReq 後才有內容)
    R.appendChild(puiEl('div', 'pg-sec', '工程貨品'));
    Object.keys(c.goods).forEach(function (id) {
      var have = typeof cityGoodsHave === 'function' ? cityGoodsHave(id) : 0, nm = (typeof GOODS !== 'undefined' && GOODS[id] && (typeof goodsName === 'function' ? goodsName(id) : GOODS[id].name)) || id;
      R.appendChild(puiReq(have >= c.goods[id], nm, have, c.goods[id]));
    });
  }
}

// ───── 建立 ─────
function initCityScoreUI() {
  var top, head, ref;
  if (cs.inited) return;
  if (typeof document === 'undefined' || !document.body) return;
  top = document.getElementById('topbar');
  cs.chip = csEl('span', 'cs-chip');
  cs.chip.id = 'csChip';
  cs.chip.setAttribute('role', 'button');
  cs.chip.setAttribute('tabindex', '0');
  cs.chip.hidden = true;
  cs.chipTxt = csEl('b', 'cs-chipt', '繁榮 0');
  cs.chip.appendChild(cs.chipTxt);
  cs.chip.addEventListener('click', function () { if (cs.open) csClose(); else csOpen(); });
  cs.chip.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { if (cs.open) csClose(); else csOpen(); } });
  if (top) {
    ref = (typeof pui !== 'undefined' && pui && pui.chip && pui.chip.parentNode === top) ? pui.chip : document.getElementById('info');
    top.insertBefore(cs.chip, ref || null);
  } else document.body.appendChild(cs.chip);
  cs.panel = csEl('div');
  cs.panel.id = 'csPanel';
  cs.panel.setAttribute('role', 'dialog');
  cs.panel.hidden = true;
  head = csEl('div', 'cs-head');
  head.appendChild(csEl('b', 'cs-title', '城市繁榮'));
  head.appendChild(csEl('span', 'cs-sp'));
  ref = csEl('button', 'cs-x', '✕');
  ref.addEventListener('click', function () { csClose(); });
  head.appendChild(ref);
  cs.body = csEl('div', 'cs-body');
  cs.panel.appendChild(head);
  cs.panel.appendChild(cs.body);
  document.body.appendChild(cs.panel);
  cs.preview = csEl('div');
  cs.preview.id = 'csPreview';
  cs.preview.setAttribute('role', 'status');
  cs.preview.hidden = true;
  document.body.appendChild(cs.preview);
  cs.inited = true;
  if (typeof setInterval === 'function') setInterval(csTick, 250);
  csChipUpdate();
}

if (typeof document !== 'undefined' && document.body) initCityScoreUI();
