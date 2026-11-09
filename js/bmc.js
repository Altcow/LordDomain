// js/bmc.js — 建築材料成本(BMC)執行層:蓋建築要消耗庫房的木 / 石與生產鏈貨品(資料 js/bmcdata.js,設計見 side-session-notes/building_material_cost_design.md)。
// 載入順序:goods.js、bmcdata.js 之後(index.html、sw.js PRECACHE 同步)。外部全域(world、game、pend、draft…)一律 typeof 守衛;bmcdata.js / 本檔未載入時,map.js / ui.js 的掛點完全不動作。
// 規則:金幣維持免費(PROG_FREE_BUILD),只收庫房貨品;扣款在 map.js pendCommit(整批全有或全無);缺料不寫進 draftCheck(旋轉誤報「空間不足」),由 draftSync 另算 draft.mat。
// 不收料:擺設 / 拖曳鋪設 / 起手 / 教學必蓋(不在表內)、移動 / 換外觀、舊存檔既有建築、戰陣板、魔幻世界(第一版)、BMC_ON = false。拆除不退料。
// 缺料三段式提示:缺 X(庫存)→ 去哪裡(goodsGapInfo)→ 〔前往〕〔市集收購〕〔走鏢〕。市集收購在 mktbuy.js(沒載入就不顯示按鈕)。
// 全域名稱:bmcOn bmcRawCost bmcCost bmcPendTotal bmcShortFor bmcShortText bmcCostParts bmcCostText bmcMenuText bmcCostHtml bmcPoor bmcSpentText bmcDeny bmcGapShow bmcGapSync bmcGapHide bmcSrHint bmcDemolishNote
// ES2017;不用 ?. ??

var BMC_MAX_LINES = 2;   // 缺料提示一次最多列幾種,其餘寫「另缺 N 種」

function bmcHasKeys(o) { var k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) return true; return false; }
function bmcAdd(a, b) { var r = {}, k; for (k in a) r[k] = a[k]; for (k in b) r[k] = (r[k] || 0) + b[k]; return r; }
function bmcEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function bmcFree() { return typeof PROG_FREE_BUILD !== 'undefined' && !!PROG_FREE_BUILD; }

// 總開關:BMC_ON、經營板、非魔幻世界。教學用到的建築都在表外(免費),所以教學期間不會被擋
function bmcOn() {
  try {
    if (typeof BMC_ON === 'undefined' || !BMC_ON) return false;
    if (typeof game === 'undefined' || !game || game.mode !== 'estate') return false;
    if (typeof goodsPackNow === 'function' && goodsPackNow()) return false;
    return true;
  } catch (e) { return false; }
}

// 表內成本(不看開關;BMC_OVERRIDE 優先,值為 null = 改免費)
function bmcRawCost(type) {
  var src = null, out = {}, k;
  if (typeof BMC_OVERRIDE !== 'undefined' && BMC_OVERRIDE && Object.prototype.hasOwnProperty.call(BMC_OVERRIDE, type)) src = BMC_OVERRIDE[type];
  else if (typeof BMC_COST !== 'undefined' && BMC_COST) src = BMC_COST[type];
  if (!src) return out;
  for (k in src) if (src[k] > 0) out[k] = src[k];
  return out;
}
// 實際要收的材料 { 貨品id: 數量 };開關關閉 = {}。非免費建造模式時,木 / 石已由 objCost 收,這裡只收貨品
function bmcCost(type) {
  var c, k;
  if (!bmcOn()) return {};
  c = bmcRawCost(type);
  if (!bmcFree()) { delete c.wood; delete c.stone; }
  return c;
}
// 待購清單的材料合計
function bmcPendTotal() {
  var t = {}, i, o;
  if (!bmcOn() || typeof pend === 'undefined' || !pend || !pend.list) return t;
  for (i = 0; i < pend.list.length; i++) { o = pend.list[i]; if (o && !o.bmcFree) t = bmcAdd(t, bmcCost(o.type)); }
  return t;
}
// 再放一件 type(連同待購)缺什麼:不缺 / 不收料 = null,缺 = { 貨品id: 缺口 }
function bmcShortFor(type) {
  var c = bmcCost(type), chk;
  if (!bmcHasKeys(c) || typeof cityGoodsReq !== 'function') return null;
  chk = cityGoodsReq(bmcAdd(bmcPendTotal(), c));
  return chk.ok ? null : chk.short;
}
function bmcPoor(type) { return !!bmcShortFor(type); }

// ───────── 文字 ─────────
function bmcGoodName(id) { return typeof goodsName === 'function' ? goodsName(id) : id; }
function bmcGoodIcon(id) { return typeof goodsIcon === 'function' ? goodsIcon(id) : ''; }
function bmcOrder(c) {   // 木、石在前,其餘依貨品階別
  return Object.keys(c).sort(function (a, b) {
    var ra = a === 'wood' ? 0 : a === 'stone' ? 1 : 2, rb = b === 'wood' ? 0 : b === 'stone' ? 1 : 2;
    if (ra !== rb) return ra - rb;
    return (typeof goodsTier === 'function' ? goodsTier(a) - goodsTier(b) : 0) || (a < b ? -1 : a > b ? 1 : 0);
  });
}
// [{ id, name, icon, need, have, lack }]
function bmcCostParts(type) {
  var c = bmcCost(type);
  return bmcOrder(c).map(function (id) {
    var have = typeof cityGoodsHave === 'function' ? cityGoodsHave(id) : 0;
    return { id: id, name: bmcGoodName(id), icon: bmcGoodIcon(id), need: c[id], have: have, lack: Math.max(0, c[id] - have) };
  });
}
// 純文字(含庫存):「木材 15、石材 10、木板 1」;withHave 時「木板 0/1」
function bmcCostText(type, withHave) {
  return bmcCostParts(type).map(function (p) { return p.name + ' ' + (withHave ? p.have + '/' : '') + p.need; }).join('、');
}
// 建造選單按鈕下方小字:有貨品就只列貨品(圖示 + 數量),否則列木 / 石
function bmcMenuText(type) {
  var ps = bmcCostParts(type), g = ps.filter(function (p) { return p.id !== 'wood' && p.id !== 'stone'; });
  return (g.length ? g : ps).map(function (p) { return p.icon + p.need; }).join(' ');
}
// 預覽卡 / 草稿列:圖示 + 庫存/需要,不足標紅
function bmcCostHtml(type, compact) {   // compact:草稿列用,只列圖示 + 庫存/需要
  return bmcCostParts(type).map(function (p) {
    return '<span class="bmc-p' + (p.lack ? ' bmc-lack' : '') + '">' + bmcEsc(p.icon) + (compact ? '' : bmcEsc(p.name) + ' ') + p.have + '/' + p.need + '</span>';
  }).join(' ');
}
function bmcShortText(short) {
  return Object.keys(short).map(function (id) { return bmcGoodName(id) + ' ×' + short[id]; }).join('、');
}
function bmcSpentText(req) {
  if (!req) return '';
  return bmcOrder(req).map(function (id) { return bmcGoodName(id) + ' ×' + req[id]; }).join('、');
}
// 拆除確認多一句(有材料成本的建築)
function bmcDemolishNote(type) { return bmcOn() && bmcHasKeys(bmcRawCost(type)) ? '拆除不退還材料。' : ''; }
// 搜尋面板詳情的缺料提示
function bmcSrHint(type) {
  var s = bmcShortFor(type);
  return s ? '目前材料不足,缺 ' + bmcShortText(s) : '';
}

// ───────── 三段式缺料提示 ─────────
// 每種缺料一組:① 缺 X ×N(庫存 H)② → 去哪裡取得(goodsGapInfo.where)③ 按鈕
var bmcGap = { el: null, type: '', short: null };
function bmcGapItem(id, n) {
  var gp = typeof goodsGapInfo === 'function' ? goodsGapInfo(id, undefined, n) : { where: '', act: '', label: '', arg: '', buy: false, mkt: null };
  var have = typeof cityGoodsHave === 'function' ? cityGoodsHave(id) : 0, b = '', mk = gp.mkt;
  if (gp.act === 'build') b += '<button class="gmini" data-bg="build" data-v="' + bmcEsc(gp.arg) + '">' + bmcEsc(gp.label) + '</button>';
  else if (gp.act === 'tech') b += '<button class="gmini" data-bg="tech" data-v="' + bmcEsc(gp.arg) + '">' + bmcEsc(gp.label) + '</button>';
  else if (gp.act === 'go') b += '<button class="gmini" data-bg="go" data-v="' + bmcEsc(gp.arg) + '">' + bmcEsc(gp.label) + '</button>';
  if (mk && mk.can > 0) b += '<button class="gmini" data-bg="mkt" data-v="' + bmcEsc(id) + '" data-n="' + n + '">市集收購 🪙' + mk.total + '</button>';
  if (gp.buy) b += '<button class="gmini" data-bg="buy">走鏢</button>';
  return '<div class="bg-i"><div class="bg-1">缺 <b>' + bmcEsc(bmcGoodIcon(id) + bmcGoodName(id)) + ' ×' + n + '</b>(庫存 ' + have + ')</div>' +
    (gp.where ? '<div class="bg-2">→ ' + bmcEsc(gp.where) + '</div>' : '') + (mk && mk.why === 'nomarket' ? '<div class="bg-2">蓋「市集」後可用金幣收購</div>' : '') + (b ? '<div class="bg-3">' + b + '</div>' : '') + '</div>';
}
function bmcGapHtml(short, type) {
  var ids = Object.keys(short), h = '<div class="bg-h"><b>材料不足' + (type && typeof OBJECTS !== 'undefined' && OBJECTS[type] ? ':' + bmcEsc(OBJECTS[type].name) : '') + '</b><button class="bg-x" data-bg="x" title="關閉">✕</button></div>';
  ids.slice(0, BMC_MAX_LINES).forEach(function (id) { h += bmcGapItem(id, short[id]); });
  if (ids.length > BMC_MAX_LINES) h += '<div class="bg-more">另缺 ' + (ids.length - BMC_MAX_LINES) + ' 種</div>';
  return h;
}
function bmcGapCss() {
  if (typeof document === 'undefined' || !document.getElementById || document.getElementById('bmcCss')) return;
  var css = document.createElement('style');
  css.id = 'bmcCss';
  css.textContent = '#bmcGap{position:fixed;left:50%;transform:translateX(-50%);width:min(360px,calc(100vw - 90px));max-height:46vh;overflow-y:auto;overscroll-behavior:contain;z-index:5;padding:8px 10px;border-radius:10px;background:rgba(20,26,36,.96);border:1px solid #e08a6a;box-shadow:0 4px 16px rgba(0,0,0,.45);font-size:13px;line-height:1.45}' +
    '#bmcGap[hidden]{display:none}#bmcGap .bg-h{display:flex;align-items:center;justify-content:space-between;gap:6px}#bmcGap .bg-x{min-height:28px;padding:2px 8px;border:none;background:transparent}' +
    '#bmcGap .bg-i{margin-top:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,.14)}#bmcGap .bg-1 b{color:#ff9d8a}#bmcGap .bg-2{opacity:.88;font-size:12px}#bmcGap .bg-3{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}' +
    '#bmcGap .gmini{min-height:34px;padding:3px 10px;font-size:12px}#bmcGap .bg-more{margin-top:6px;opacity:.75;font-size:12px}' +
    '.bmc-lack{color:#ff8a7a;font-weight:bold}#draftBar .drow.mat{font-size:12px;opacity:.95;flex-wrap:wrap;gap:2px 8px}';
  if (document.head) document.head.appendChild(css);
}
function bmcGapEl() {
  var el;
  if (typeof document === 'undefined' || !document.createElement || !document.body) return null;
  if (bmcGap.el) return bmcGap.el;
  bmcGapCss();
  el = document.createElement('div');
  el.id = 'bmcGap';
  el.hidden = true;
  el.addEventListener('pointerdown', function (e) { if (e.stopPropagation) e.stopPropagation(); });
  el.addEventListener('click', bmcGapClick);
  document.body.appendChild(el);
  bmcGap.el = el;
  return el;
}
function bmcGapHide() {
  bmcGap.type = ''; bmcGap.short = null;
  if (bmcGap.el && !bmcGap.el.hidden) bmcGap.el.hidden = true;
}
// 豎版放在草稿列正上方;橫版(草稿列是窄欄)放在草稿列右側;草稿列沒顯示就貼在底部。高度一律限制在螢幕內(超過就捲動)
function bmcGapPlace(el) {
  var bar = typeof document !== 'undefined' && document.getElementById ? document.getElementById('draftBar') : null, vh = (typeof window !== 'undefined' && window.innerHeight) || 600, vw = (typeof window !== 'undefined' && window.innerWidth) || 400, r, bottom = 80;
  el.style.left = '50%'; el.style.transform = 'translateX(-50%)'; el.style.width = '';
  try {
    if (bar && !bar.hidden && bar.getBoundingClientRect) {
      r = bar.getBoundingClientRect();
      if (vw > vh) {   // 橫版:貼在草稿列右側,底邊對齊草稿列底邊
        el.style.transform = 'none';
        el.style.left = Math.round(r.right + 8) + 'px';
        el.style.width = Math.max(200, Math.min(360, vw - r.right - 8 - 76)) + 'px';
        bottom = Math.max(8, Math.round(vh - r.bottom));
      } else bottom = Math.max(8, Math.round(vh - r.top + 6));
    }
  } catch (e) { /* 取不到位置就用預設 */ }
  el.style.bottom = bottom + 'px';
  el.style.maxHeight = Math.max(120, vh - bottom - 8) + 'px';
}
function bmcGapShow(short, type) {
  var el;
  try { el = bmcGapEl(); } catch (e) { el = null; }   // 提示卡建不起來(沒有 DOM)時,仍有 toast
  bmcGap.type = type || ''; bmcGap.short = short;
  if (!el) return false;
  el.innerHTML = bmcGapHtml(short, type);
  el.hidden = false;
  bmcGapPlace(el);
  return true;
}
// 草稿消失或已補齊就收起(updateDraftBar 每次更新時呼叫);仍缺料時重畫庫存
function bmcGapSync() {
  var d, s;
  if (!bmcGap.el || bmcGap.el.hidden) return;
  d = typeof draft !== 'undefined' ? draft : null;
  if (!d || d.orig || d.combo || d.type !== bmcGap.type) { bmcGapHide(); return; }
  s = bmcShortFor(d.type);
  if (!s) { bmcGapHide(); return; }
  if (JSON.stringify(s) !== JSON.stringify(bmcGap.short)) bmcGapShow(s, d.type);
  else bmcGapPlace(bmcGap.el);
}
function bmcLeave() {   // 「前往」前先捨棄虛影,避免殘留
  if (typeof draft !== 'undefined' && draft && typeof draftCancel === 'function') draftCancel();
  bmcGapHide();
}
function bmcGapClick(e) {
  var t = e.target && e.target.closest ? e.target.closest('[data-bg]') : null, a, v, kk;
  if (!t) return;
  a = t.getAttribute('data-bg'); v = t.getAttribute('data-v');
  if (a === 'x') bmcGapHide();
  else if (a === 'build') { bmcLeave(); if (typeof goodsGoBuild === 'function') goodsGoBuild(v); }
  else if (a === 'tech') { bmcLeave(); if (typeof goodsGoTech === 'function') goodsGoTech(v); }
  else if (a === 'buy') { bmcLeave(); if (typeof goodsGoBuy === 'function') goodsGoBuy(); }
  else if (a === 'go') {
    kk = (v || '').split(',');
    bmcLeave();
    if (typeof centerOnCell === 'function' && kk.length === 2) { centerOnCell(+kk[0], +kk[1]); if (typeof clampView === 'function') clampView(); }
  }
  else if (a === 'mkt' && typeof mktBuyUi === 'function') mktBuyUi(v, +t.getAttribute('data-n') || 1, function () {
    if (typeof draftSync === 'function' && typeof draft !== 'undefined' && draft) draftSync();
    bmcGapSync();
    if (typeof updateResBar === 'function') updateResBar();
  });
}

// 缺料:提示 + 三段式卡片(type = 想蓋的建築;可省略)
function bmcDeny(short, type) {
  var nm = type && typeof OBJECTS !== 'undefined' && OBJECTS[type] ? OBJECTS[type].name : '';
  if (typeof beep === 'function') { try { beep(); } catch (e) { /* 無音效不影響 */ } }
  if (typeof showToast === 'function') showToast('材料不足' + (nm ? ',無法建造' + nm : '') + ':缺 ' + bmcShortText(short));
  if (type) bmcGapShow(short, type);
}
