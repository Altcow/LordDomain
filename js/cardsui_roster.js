// js/cardsui_roster.js — 卡片面板 R 分頁主頁(卡包):2026-11-12 改為卡片網格(cardsui_grid.js 負責網格、篩選列、詳情底部面板與多選)。
// 本檔保留:卡包頁組裝(cuRosterPageHtml)、搜尋框輸入(cuRosterInput)、卡包頁動作鏈的入口(cuRosterClick:先道具 cuItemsClick、再網格 cuGridClick,其餘為熔鍊確認)、人物詳情內的單人熔鍊(cuRosterMeltHtml)與共用的熔鍊確認流程(cuRosterAsk / cuRosterDo)。
// 舊清單函式 cuRosterRowHtml / cuRosterListHtml / cuRosterFilterOf 已不在頁面使用,保留為相容包裝(直接呼叫者仍可得到文字清單)。
// 篩選 / 搜尋狀態 cu.ro(cuRoState 惰性建立):q 搜尋字、troop 兵種、gr 品階(-1 全部 / 4 金 / 3 紫 / 2 藍以下)、only ''/fig/spare、sort def/gr/star/troop/new、open 下拉(null/troop/gr/sort)、srch 搜尋展開、sel 多選模式。
// 熔鍊規則(cards.js cardsBagDissolve):名人不入多選 / 一鍵(只能在人物詳情手動熔,二次確認);鎖定(🔒)與派駐中者略過。ES2017;不用 ?. ??。
// 全域名稱:CU_RO_PAGE CU_RO_GR CU_RO_LE CU_RO_TROOP CU_RO_KIND CU_RO_SORT cuRoState cuRoChips cuRoGrLabel cuRosterCss cuRosterSelIds cuRosterAsk cuRosterDo cuRosterMeltHtml cuRosterRowHtml cuRosterFilterOf cuRosterListHtml cuRosterPageHtml cuRosterInput cuRosterClick
var CU_RO_PAGE = 40;   // 舊清單(cuRosterListHtml)一頁筆數
var CU_RO_GR = [[-1, '全'], [0, '白'], [1, '青'], [2, '藍'], [3, '紫'], [4, '金']];   // 熔爐分頁清單篩選共用
var CU_RO_LE = [[0, '白'], [1, '青'], [2, '藍'], [3, '紫']];
var CU_RO_TROOP = [['', '全'], ['槍', '槍'], ['騎', '騎'], ['盾', '盾'], ['弓', '弓'], ['械', '械']];
var CU_RO_KIND = [['', '全'], ['fig', '名人'], ['gen', '路人']];
var CU_RO_SORT = [['gr', '品質'], ['name', '名字'], ['star', '星數'], ['new', '新進']];

function cuRoState() {
  if (!cu.ro) cu.ro = { q: '', gr: -1, troop: '', only: '', sort: 'def', open: null, srch: false, sel: false };
  return cu.ro;
}
function cuRosterCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuRosterStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuRosterStyle';
  st.textContent = '#cardsPanel input.curq{width:100%;box-sizing:border-box;min-height:44px;margin:6px 0;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.25);color:inherit;font-size:16px}' +
    '#cardsPanel .curow{min-height:44px;padding:2px 0}#cardsPanel .curow .curb{flex:1 1 auto;min-width:0;cursor:pointer;display:flex;align-items:center;min-height:44px}' +
    '#cardsPanel .curck{display:inline-block;min-width:32px;font-size:18px;text-align:center}' +
    '#cardsPanel .cuchips2{display:flex;flex-wrap:wrap;gap:0 2px;align-items:center}#cardsPanel .cuchips2 button.cub{min-height:40px;padding:2px 8px;margin:2px 2px 0 0}';
  document.head.appendChild(st);
}
// 篩選 / 排序 / 熔爐設定的 chip 列(data-a 動作、data-v 值;cur 為目前值)
function cuRoChips(items, cur, act) {
  return '<div class="cuchips2">' + items.map(function (e) { return '<button class="cub' + (String(cur) === String(e[0]) ? ' on' : '') + '" data-a="' + act + '" data-v="' + cuEsc(e[0]) + '">' + cuEsc(e[1]) + '</button>'; }).join('') + '</div>';
}
function cuRoGrLabel(e) { var G = CARD_GRADE[e.gr], c = '', i; for (i = 0; i < G.corner; i++) c += '◆'; return G.ch + c; }
// 目前多選中且仍可熔(卡包內、路人、未鎖定、未派駐)的 entry id;其餘勾選自動清掉(熔爐分頁共用 cu.bsel)
function cuRosterSelIds(cs) {
  var out = [];
  Object.keys(cu.bsel).forEach(function (id) {
    var f = cardsRosterFind(cs, id);
    if (f && !f.c.fig && cardsRosterMeltable(f.c)) out.push(id);
    else delete cu.bsel[id];
  });
  return out;
}
// 熔鍊要求:單張白 / 青直接做;多張或藍以上先確認;含名人 → 二次確認(figOk)
function cuRosterAsk(cs, ids, figOk) {
  var s = cardsFurnaceSum(cs, ids, !!figOk), g;
  if (!s.n) { cu.msg = s.skippedFig ? CU_BAG_MSG.fig : (s.skippedLock ? CU_BAG_MSG.locked : '沒有可熔鍊的人'); return; }
  if (s.figs) { cu.bpend = { ids: ids, figOk: true, text: '確定熔掉名人?熔鍊後該名人的所有張數一併消失(日後可能再抽到),可得 ' + s.shards + ' 碎片。熔鍊後無法復原。' }; return; }
  if (s.n > 1 || s.top >= 2) {
    g = CARD_GRADE[s.top] ? CARD_GRADE[s.top].name : '';
    cu.bpend = { ids: ids, figOk: false, text: '確定熔鍊 ' + s.n + ' 人(最高 ' + g + '階)?可得 ' + s.shards + ' 碎片。熔鍊後無法復原。' };
    return;
  }
  cuRosterDo(cs, ids, false);
}
function cuRosterDo(cs, ids, figOk) {
  var r = cardsBagDissolve(cs, ids, { figOk: !!figOk });
  cu.bpend = null;
  if (!r.ok) { cu.msg = CU_BAG_MSG[r.reason] || '無法熔鍊'; return; }
  ids.forEach(function (id) { delete cu.bsel[id]; });
  cu.detail = null;
  cardsSyncTalents();
  cu.msg = '熔鍊 ' + r.n + ' 人,得碎片 ' + r.shards + '(現有 ' + cs.shards + ')';
  cuSave();
}
// 人物詳情內的熔鍊區塊(卡包人員;cuDetailHtml 呼叫):派駐 / 鎖定者不給鈕
function cuRosterMeltHtml(cs, e) {
  var tg = e, lp = null, val, h = '', pend;
  // 名人同名還有副卡 → 熔鍊預設對象切到副卡(cardsLegacyPick),並標註『已為你選副卡』
  if (e.fig && typeof cardsLegacyPick === 'function') { lp = cardsLegacyPick(cs, e.fig); if (lp && lp.id !== e.id && cardsRosterMeltable(lp)) tg = lp; else lp = null; }
  val = cardsFurnaceValue(tg);
  pend = !!(cu.bpend && cu.bpend.ids && cu.bpend.ids.length === 1 && cu.bpend.ids[0] === tg.id);
  if (!cardsRosterMeltable(tg)) return '<div class="cusub" style="opacity:1">' + (tg.at ? '派駐中' : '鎖定中') + ',不能熔鍊(先' + (tg.at ? '卸任' : '解除鎖定') + ')。</div>';
  if (lp) h += '<div class="cusub" style="opacity:1">已為你選副卡(同名主力 ★' + cardsStarLv(e) + ' 不動)。</div>';
  if (!tg.fig) h += '<button class="cub warn" data-a="rdis" data-id="' + tg.id + '">熔鍊(+' + val + ' 碎)</button>';
  else h += '<button class="cub warn" data-a="rdis" data-id="' + tg.id + '">熔鍊' + (lp ? '副卡' : '名人') + '(+' + val + ' 碎,需確認)</button><div class="cusub">名人不在熔爐分頁的清單與一鍵熔範圍;同名名人可有多張,多餘的可拿來傳承。</div>';
  if (pend) h += '<div class="cuwarn">' + cuEsc(cu.bpend.text) + '</div><button class="cub" data-a="rcfno">否</button><button class="cub warn" data-a="rcfyes">是,熔鍊</button>';
  return h;
}
// 舊文字清單(相容包裝,頁面已不使用):一列一行,點列開人物詳情
function cuRosterRowHtml(e) {
  var j = CARD_JOB_BY_ID[e.main];
  return '<div class="cur curow" style="border-left:5px solid var(--gr' + e.gr + ');padding-left:6px">' +
    '<span class="curb" data-a="detail" data-id="' + e.id + '">' + (typeof cuArtThumb === 'function' ? cuArtThumb(e) : '') +
    '<span><b>' + cuRoGrLabel(e) + '</b> ' + cuEsc(e.name) + (e.fig ? ' <span class="cusub">名人</span>' : '') + (e.star ? ' 🔒' : '') + (e.starLv ? ' ★' + e.starLv : '') +
    '<span class="cusub"> ' + (j ? cuEsc(j.name) : '') + ' · ' + cuTroopTag(e) + (e.at ? ' · 派駐' : '') + '</span></span></span>' +
    '</div>';
}
function cuRosterFilterOf(R) { return { q: R.q, gr: R.gr, fac: R.fac, troop: R.troop, kind: R.kind, dep: R.dep, sort: R.sort }; }
// 舊文字清單(相容包裝,頁面已不使用)
function cuRosterListHtml(cs) {
  var R = cuRoState(), list = cardsRosterList(cs, cuRosterFilterOf(R)), shown, h = '', i;
  h = '<div class="cusub" id="curcnt">符合 ' + list.length + ' / ' + cs.roster.length + ' 人</div>';
  if (!list.length) return h + '<div class="cusub">沒有符合條件的人。</div>';
  shown = list.slice(0, (R.n || 1) * CU_RO_PAGE);
  for (i = 0; i < shown.length; i++) h += cuRosterRowHtml(shown[i]);
  if (shown.length < list.length) h += '<button class="cub" data-a="rmore">顯示更多(尚有 ' + (list.length - shown.length) + ' 人)</button>';
  return h;
}
// 卡包頁(R 分頁):道具子頁(若在道具子頁直接回道具內容)→ 卡包提示列 → 篩選列 + 網格(cardsui_grid.js)→ 待定席 / 流浪
function cuRosterPageHtml(cs) {
  var R = cuRoState(), h = '', cap = cardsCap(), n = cs.roster.length, bar = '';
  cuRosterCss();
  if (typeof cuGridBind === 'function') cuGridBind();
  if (typeof itemsSubBarHtml === 'function') bar = itemsSubBarHtml();   // 卡包頁頂部『卡片 | 道具』子頁(items_ui.js)
  if (bar && IU.sub === 'item') return bar + itemsTabHtml() + itemsPopHtml();
  h += bar;
  if (n >= cap) h += '<div class="cuwarn">卡包已滿(' + cap + ')、停止抽卡。先到『熔爐』熔鍊或遣散,騰出空位才能再抽。</div>';
  else if (n >= cap - 10) h += '<div class="cusub">卡包剩 ' + (cap - n) + ' 格。</div>';
  if (cs.lastRel) h += '<button class="cub" data-a="undo">復原最近遣散</button>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  if (typeof cuGridBarInner !== 'function') h += cuRosterListHtml(cs);   // 未載入 cardsui_grid.js 時退回舊文字清單(相容)
  else {
    h += '<div id="cugbarw" class="cugbarw">' + cuGridBarInner(cs, R) + '</div>';
    h += '<div id="cugridw">' + cuGridGridHtml(cs, R) + '</div>';
  }
  if (cs.wait.length) { h += '<div class="cusec">待定席</div>'; cs.wait.forEach(function (e) { h += cuRowHtml(e, true); }); }
  if (cs.wander.length) { h += '<div class="cusec">故人(流浪)</div>'; cs.wander.forEach(function (e) { h += cuRowHtml(e, false, true); }); }
  return h;
}
// 搜尋框輸入:只重畫網格(保留輸入焦點與篩選列)
function cuRosterInput(ev) {
  var t = ev && ev.target, R = cuRoState();
  if (!t || t.id !== 'curq') return;
  R.q = t.value;
  if (typeof cuGridPaintGrid === 'function' && cu.el && cu.el.querySelector && cu.el.querySelector('#cugridw')) { cuGridPaintGrid(); return; }
  cardsUiRender();
}
// 卡包頁的點擊動作(cuClick 呼叫;不認得的動作回 false)
function cuRosterClick(a, b, cs) {
  var id = b.getAttribute('data-id'), f;
  if (typeof cuItemsClick === 'function' && cuItemsClick(a, b, cs)) return true;   // 道具子頁 / 道具選單(items_ui.js)
  if (typeof cuGridClick === 'function' && cuGridClick(a, b, cs)) return true;     // 卡片網格 / 篩選列 / 多選 / 詳情面板(cardsui_grid.js)
  if (a === 'rdis') {   // 人物詳情的單人熔鍊(名人需二次確認)
    f = cardsRosterFind(cs, id);
    if (!f) { cu.msg = CU_BAG_MSG.none; return true; }
    cuRosterAsk(cs, [id], !!f.c.fig);
    if (cu.bpend) cu.bpend.single = true;
    return true;
  }
  if (a === 'rcfno') { cu.bpend = null; return true; }
  if (a === 'rcfyes') { if (cu.bpend) cuRosterDo(cs, cu.bpend.ids, cu.bpend.figOk); return true; }
  return false;
}
