// js/cardsui_roster.js — 名冊頁(卡包面板 R 分頁主頁,2026-11-10):名冊人數與格數、搜尋(名字 / 字 / 職業 / 陣營 / 兵種)、篩選(品質、陣營、兵種、名人或路人、已派駐)、
// 排序(品質 / 名字 / 星數 / 新進)、列表分頁(每頁 CU_RO_PAGE 列,『顯示更多』累加;一列一行,點開才看人物卡)、多選熔鍊、一鍵熔爐(品階 ≤ X)、自動熔爐設定、前往熔爐、碎片兌換。
// 熔鍊規則(cards.js cardsBagDissolve):名人不入多選 / 一鍵(只能在人物詳情手動熔,二次確認);鎖定(🔒)與派駐中者略過。熔鍊後 bnSkcOnLeave 清裝備(bn_skcard.js)。
// 掛在 cardsui.js:cuRosterTabHtml → cuRosterPageHtml(cs);cuClick → cuRosterClick(a, b, cs);cuEnsure 的 input 事件 → cuRosterInput(ev)。
// 篩選 / 搜尋狀態 cu.ro(cuRoState 惰性建立);多選沿用 cu.bsel(與卡片熔爐 furnaceui.js 共用)。ES2017;不用 ?. ??。
// 全域名稱:CU_RO_PAGE CU_RO_AUTO CU_RO_LE cuRoState cuRoChips cuRosterCss cuRosterSelIds cuRosterAsk cuRosterDo cuRosterMeltHtml cuRosterRowHtml cuRosterListHtml cuRosterPageHtml cuRosterInput cuRosterClick
var CU_RO_PAGE = 40;   // 列表一頁筆數(『顯示更多』每次再加一頁)
var CU_RO_AUTO = [[-1, '關'], [0, '白'], [1, '青以下'], [2, '藍以下']];
var CU_RO_GR = [[-1, '全'], [0, '白'], [1, '青'], [2, '藍'], [3, '紫'], [4, '金']];
var CU_RO_LE = [[0, '白'], [1, '青'], [2, '藍'], [3, '紫']];
var CU_RO_TROOP = [['', '全'], ['槍', '槍'], ['騎', '騎'], ['盾', '盾'], ['弓', '弓'], ['謀', '謀']];
var CU_RO_KIND = [['', '全'], ['fig', '名人'], ['gen', '路人']];
var CU_RO_SORT = [['gr', '品質'], ['name', '名字'], ['star', '星數'], ['new', '新進']];

function cuRoState() {
  if (!cu.ro) cu.ro = { q: '', gr: -1, fac: -1, troop: '', kind: '', dep: false, sort: 'gr', n: 1, mode: false, le: 0 };
  return cu.ro;
}
function cuRosterCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuRosterStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuRosterStyle';
  st.textContent = '#cardsPanel input.curq{width:100%;box-sizing:border-box;min-height:44px;margin:6px 0;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.25);color:inherit;font-size:16px}' +
    '#cardsPanel .curow{min-height:44px;padding:2px 0}#cardsPanel .curow .curb{flex:1 1 auto;min-width:0;cursor:pointer;display:flex;align-items:center;min-height:44px}#cardsPanel .curow.dim{opacity:.45}' +
    '#cardsPanel .curck{display:inline-block;min-width:32px;font-size:18px;text-align:center}' +
    '#cardsPanel .cuchips2{display:flex;flex-wrap:wrap;gap:0 2px;align-items:center}#cardsPanel .cuchips2 button.cub{min-height:40px;padding:2px 8px;margin:2px 2px 0 0}' +
    '#cardsPanel .curbar{position:sticky;bottom:0;display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:6px 0;background:rgba(20,20,28,.94);border-top:1px solid rgba(255,255,255,.2)}';
  document.head.appendChild(st);
}
// 篩選 / 排序 / 自動熔爐的 chip 列(data-a 動作、data-v 值;cur 為目前值)
function cuRoChips(items, cur, act) {
  return '<div class="cuchips2">' + items.map(function (e) { return '<button class="cub' + (String(cur) === String(e[0]) ? ' on' : '') + '" data-a="' + act + '" data-v="' + cuEsc(e[0]) + '">' + cuEsc(e[1]) + '</button>'; }).join('') + '</div>';
}
function cuRoGrLabel(e) { var G = CARD_GRADE[e.gr], c = '', i; for (i = 0; i < G.corner; i++) c += '◆'; return G.ch + c; }
// 目前多選中且仍可熔(名冊內、路人、未鎖定、未派駐)的 entry id;其餘勾選自動清掉
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
  if (s.figs) { cu.bpend = { ids: ids, figOk: true, text: '確定熔掉名人?熔鍊後該名人與信物一併消失(日後可能再抽到),可得 ' + s.shards + ' 碎片。熔鍊後無法復原。' }; return; }
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
// 人物詳情內的熔鍊區塊(名冊人員;cuDetailHtml 呼叫):派駐 / 鎖定者不給鈕
function cuRosterMeltHtml(cs, e) {
  var val = cardsFurnaceValue(e), h = '', pend = !!(cu.bpend && cu.bpend.ids && cu.bpend.ids.length === 1 && cu.bpend.ids[0] === e.id);
  if (!cardsRosterMeltable(e)) return '<div class="cusub" style="opacity:1">' + (e.at ? '派駐中' : '鎖定中') + ',不能熔鍊(先' + (e.at ? '卸任' : '解除鎖定') + ')。</div>';
  if (!e.fig) h += '<button class="cub warn" data-a="rdis" data-id="' + e.id + '">熔鍊(+' + val + ' 碎)</button>';
  else h += '<button class="cub warn" data-a="rdis" data-id="' + e.id + '">熔鍊名人(+' + val + ' 碎,需確認)</button><div class="cusub">名人不在多選與一鍵熔爐範圍;重複抽到會化為信物,信物滿了轉碎片。</div>';
  if (pend) h += '<div class="cuwarn">' + cuEsc(cu.bpend.text) + '</div><button class="cub" data-a="rcfno">否</button><button class="cub warn" data-a="rcfyes">是,熔鍊</button>';
  return h;
}
// 列:多選模式為勾選列(點列切換;名人不能勾),一般模式點列開人物詳情
function cuRosterRowHtml(e, mode) {
  var G = CARD_GRADE[e.gr], j = CARD_JOB_BY_ID[e.main], canSel = !e.fig && cardsRosterMeltable(e), sel = !!cu.bsel[e.id], act = mode ? (e.fig ? 'rnofig' : 'rsel') : 'detail';
  var mark = mode ? '<span class="curck">' + (sel ? '☑' : '☐') + '</span>' : '';
  return '<div class="cur curow' + (mode && !canSel ? ' dim' : '') + '" style="border-left:5px solid var(--gr' + e.gr + ');padding-left:6px">' + mark +
    '<span class="curb" data-a="' + act + '" data-id="' + e.id + '">' + (typeof cuArtThumb === 'function' ? cuArtThumb(e) : '') +
    '<span><b>' + cuRoGrLabel(e) + '</b> ' + cuEsc(e.name) + (e.fig ? ' <span class="cusub">名人</span>' : '') + (e.star ? ' 🔒' : '') + (e.starLv ? ' ★' + e.starLv : '') +
    '<span class="cusub"> ' + (j ? j.t[(e.ja[e.main] || 1) - 1] : '') + (e.at ? ' · 派駐' : '') + '</span></span></span>' +
    '<span class="cusub">才 ' + e.tai + '</span></div>';
}
function cuRosterFilterOf(R) { return { q: R.q, gr: R.gr, fac: R.fac, troop: R.troop, kind: R.kind, dep: R.dep, sort: R.sort }; }
// 列表區(搜尋時只重畫這塊,輸入框保留焦點)
function cuRosterListHtml(cs) {
  var R = cuRoState(), list = cardsRosterList(cs, cuRosterFilterOf(R)), shown, h, i;
  h = '<div class="cusub" id="curcnt">符合 ' + list.length + ' / ' + cs.roster.length + ' 人' + (R.mode ? '(多選模式:點列勾選,名人不能勾)' : '') + '</div>';
  if (!list.length) return h + '<div class="cusub">沒有符合條件的人。</div>';
  shown = list.slice(0, R.n * CU_RO_PAGE);
  for (i = 0; i < shown.length; i++) h += cuRosterRowHtml(shown[i], R.mode);
  if (shown.length < list.length) h += '<button class="cub" data-a="rmore">顯示更多(尚有 ' + (list.length - shown.length) + ' 人)</button>';
  return h;
}
function cuRosterPageHtml(cs) {
  var R = cuRoState(), h = '', cap = cardsCap(), n = cs.roster.length, sel, selS, le, f, total;
  cuRosterCss();
  if (cu.detail) { f = cardsFind(cs, cu.detail); if (f) return cuDetailHtml(cs, f); cu.detail = null; }
  h += '<div class="cur"><span>名冊 <b>' + n + '/' + cap + '</b></span><span class="cusub">待定席 ' + cs.wait.length + '/' + CARD_CFG.waitSeats + '</span></div>';
  if (n >= cap) h += '<div class="cuwarn">名冊已滿(' + cap + ')、停止抽卡。先熔鍊或遣散,騰出空位才能再抽。</div>';
  else if (n >= cap - 10) h += '<div class="cusub">名冊剩 ' + (cap - n) + ' 格。</div>';
  h += '<div class="cusub">碎片 ' + cs.shards + ' · 指名券 ' + (cs.nameTokens | 0) + '。多選熔鍊:勾選不要的路人 → 預覽可得碎片 → 熔鍊;碎片可到人物詳情強化(升星),下方兌換指名券。</div>';
  if (cs.lastRel) h += '<button class="cub" data-a="undo">復原最近遣散</button>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  h += '<input class="curq" id="curq" type="search" placeholder="搜尋名字 / 職業 / 陣營 / 兵種" value="' + cuEsc(R.q) + '">';
  h += '<div class="cubsec">篩選 · 品質</div>' + cuRoChips(CU_RO_GR, R.gr, 'rgr');
  h += '<div class="cubsec">篩選 · 陣營</div>' + cuRoChips([[-1, '全']].concat(CARD_FAC.map(function (x, i) { return [i, x]; })), R.fac, 'rfac');
  h += '<div class="cubsec">篩選 · 兵種</div>' + cuRoChips(CU_RO_TROOP, R.troop, 'rtroop');
  h += '<div class="cubsec">篩選 · 名人 / 路人 / 派駐</div>' + cuRoChips(CU_RO_KIND, R.kind, 'rkind') + cuRoChips([['1', '只看已派駐']], R.dep ? '1' : '', 'rdep');
  h += '<div class="cubsec">排序</div>' + cuRoChips(CU_RO_SORT, R.sort, 'rsort');
  h += '<div class="cubsec">自動熔爐(名冊外新抽到的路人,品階 ≤ 此值直接熔成碎片;名人不入)</div>' + cuRoChips(CU_RO_AUTO, cardsBagAutoLv(cs), 'rauto');
  h += '<div class="cubsec">一鍵熔爐(品階 ≤ 所選;名人、派駐與鎖定不入)</div>' + cuRoChips(CU_RO_LE, R.le, 'rle');
  le = cardsBagPick(cs, R.le);
  h += '<button class="cub warn" data-a="rledo"' + (le.length ? '' : ' disabled') + '>熔鍊 品階 ≤ ' + CARD_GRADE[R.le].name + '(' + le.length + ' 人)</button>';
  h += '<div>' + (typeof furnaceUiOpen === 'function' ? '<button class="cub" data-a="rto">🔥 前往卡片熔爐</button>' : '') + '<button class="cub" data-a="rmode">' + (R.mode ? '結束多選' : '多選熔鍊') + '</button></div>';
  if (cu.bpend && !cu.bpend.single) h += '<div class="cuwarn">' + cuEsc(cu.bpend.text) + '</div><button class="cub" data-a="rcfno">否</button><button class="cub warn" data-a="rcfyes">是,熔鍊</button>';
  h += '<div id="curlist">' + cuRosterListHtml(cs) + '</div>';
  if (R.mode) {
    sel = cuRosterSelIds(cs); selS = cardsFurnaceSum(cs, sel, false); total = cardsRosterList(cs, cuRosterFilterOf(R)).length;
    h += '<div class="curbar"><span>已選 ' + sel.length + ' · 可得 ' + selS.shards + ' 碎</span><button class="cub" data-a="rall"' + (total ? '' : ' disabled') + '>全選目前篩選</button><button class="cub" data-a="rclr"' + (sel.length ? '' : ' disabled') + '>取消選取</button>' +
      '<button class="cub warn" data-a="rdo"' + (sel.length ? '' : ' disabled') + '>熔鍊已選</button></div>';
  }
  if (cs.wait.length) { h += '<div class="cusec">待定席</div>'; cs.wait.forEach(function (e) { h += cuRowHtml(e, true); }); }
  if (cs.wander.length) { h += '<div class="cusec">故人(流浪)</div>'; cs.wander.forEach(function (e) { h += cuRowHtml(e, false, true); }); }
  h += (typeof cuExchangeHtml === 'function') ? cuExchangeHtml(cs) : '';
  return h;
}
// 搜尋框輸入:只重畫列表區(保留輸入焦點)
function cuRosterInput(ev) {
  var t = ev && ev.target, R = cuRoState(), box, cs;
  if (!t || t.id !== 'curq') return;
  R.q = t.value; R.n = 1;
  box = (cu.el && cu.el.querySelector) ? cu.el.querySelector('#curlist') : null;
  cs = cardsGet();
  if (box && cs) box.innerHTML = cuRosterListHtml(cs);
  else cardsUiRender();
}
// 名冊頁的點擊動作(cuClick 呼叫;不認得的動作回 false)
function cuRosterClick(a, b, cs) {
  var R = cuRoState(), v = b.getAttribute('data-v'), id = b.getAttribute('data-id'), f, ids;
  if (a === 'rgr') { R.gr = +v; R.n = 1; return true; }
  if (a === 'rfac') { R.fac = +v; R.n = 1; return true; }
  if (a === 'rtroop') { R.troop = v || ''; R.n = 1; return true; }
  if (a === 'rkind') { R.kind = v || ''; R.n = 1; return true; }
  if (a === 'rdep') { R.dep = !R.dep; R.n = 1; return true; }
  if (a === 'rsort') { R.sort = v || 'gr'; R.n = 1; return true; }
  if (a === 'rmore') { R.n++; return true; }
  if (a === 'rauto') { cardsBagSetAuto(cs, +v); cuSave(); return true; }
  if (a === 'rle') { R.le = Math.max(0, Math.min(3, +v | 0)); return true; }
  if (a === 'rledo') { cuRosterAsk(cs, cardsBagPick(cs, R.le), false); return true; }
  if (a === 'rto') { if (typeof furnaceUiOpen === 'function') furnaceUiOpen(); return true; }
  if (a === 'rmode') { R.mode = !R.mode; cu.bsel = {}; cu.bpend = null; return true; }
  if (a === 'rsel') {
    f = cardsRosterFind(cs, id);
    if (!f || f.c.fig || !cardsRosterMeltable(f.c)) { cu.msg = (f && f.c.fig) ? CU_BAG_MSG.fig : CU_BAG_MSG.locked; return true; }
    if (cu.bsel[id]) delete cu.bsel[id]; else cu.bsel[id] = 1;
    cu.bpend = null;
    return true;
  }
  if (a === 'rnofig') { cu.msg = CU_BAG_MSG.fig; return true; }
  if (a === 'rall') {
    ids = cardsRosterList(cs, cuRosterFilterOf(R)).filter(function (c) { return !c.fig && cardsRosterMeltable(c); });
    ids.forEach(function (c) { cu.bsel[c.id] = 1; });
    return true;
  }
  if (a === 'rclr') { cu.bsel = {}; cu.bpend = null; return true; }
  if (a === 'rdo') { cuRosterAsk(cs, cuRosterSelIds(cs), false); return true; }
  if (a === 'rdis') {
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
