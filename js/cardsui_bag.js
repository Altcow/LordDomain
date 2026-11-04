// js/cardsui_bag.js — 卡包分頁(PLAN_CARDS 第四批決議):開批的卡直接進卡包;列表可依品階 / 職業分類篩選、排序;單張與批量分解(路人 → 碎片,名人不可分解)、
// 一鍵分解(品階 ≤ X)、自動分解設定(預設白階自動分解,可關);任用(卡包 → 名冊,花酒令 = 任用成本)。「餵養」入口預留(cardsBagFeed,UI 不顯示)。
// 掛在 cardsui.js(cuBagHtml / cuBagClick 由其 typeof 守衛呼叫)。引擎在 cards.js(cardsBag*)。不發聲、不推播。ES2017;不用 ?. ??。
// 全域名稱:cuBagHtml cuBagClick cuBagCss cuBagLabel CU_BAG_PAGE CU_BAG_MSG
var CU_BAG_PAGE = 40;   // 列表一頁筆數(「顯示更多」每次再加一頁)
var CU_BAG_MSG = { tok: '酒令不足', full: '名冊已滿,先請辭一人或等官階晉升', none: '此卡已不在卡包', fig: '名人不可分解' };
var CU_BAG_AUTO = [[-1, '關'], [0, '白'], [1, '青以下'], [2, '藍以下']];
var CU_BAG_LE = [[0, '白'], [1, '青'], [2, '藍'], [3, '紫']];   // 一鍵分解「品階 ≤ X」可選

function cuBagCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuBagStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuBagStyle';
  st.textContent = '#cardsPanel button.cub.on{background:#f0b45a;color:#222}#cardsPanel .cuchips{display:flex;flex-wrap:wrap;gap:0}#cardsPanel .cubr{align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}#cardsPanel .cubr .cubn{flex:1 1 auto;min-width:0;cursor:pointer;min-height:44px;display:flex;align-items:center}' +
    '#cardsPanel .cubr button.cub{margin:0;padding:4px 8px;min-width:44px}#cardsPanel .cubsec{margin:8px 0 2px;font-size:12px;opacity:.7}';
  document.head.appendChild(st);
}
function cuBagGrLabel(gr) { var G = CARD_GRADE[gr], c = '', i; for (i = 0; i < G.corner; i++) c += '◆'; return G.ch + c; }
// 本週還能領的碎片額度(受 CARD_WINE.shardWeekCap 限制)
function cuBagWeekLeft(cs) {
  var wk = Math.floor((cuNow() - cardsTz(cuNow())) / (7 * 86400000));
  return Math.max(0, CARD_WINE.shardWeekCap - (cs.shardWk.w === wk ? cs.shardWk.n : 0));
}
function cuBagSelIds(cs) {   // 勾選中且仍在卡包的 bid(順便清掉已不存在的)
  var out = [];
  Object.keys(cu.bsel).forEach(function (id) { var f = cardsBagFind(cs, id); if (f && !f.c.fig) out.push(id); else delete cu.bsel[id]; });
  return out;
}
function cuBagSum(cs, ids) {
  var raw = 0, top = 0;
  ids.forEach(function (id) { var f = cardsBagFind(cs, id); if (f) { raw += cardsBagDissolveValue(f.c); if (f.c.gr > top) top = f.c.gr; } });
  return { n: ids.length, raw: raw, top: top };
}
function cuBagChips(items, cur, act, key) {
  return '<div class="cuchips">' + items.map(function (e) { return '<button class="cub' + (cur === e[0] ? ' on' : '') + '" data-a="' + act + '" data-v="' + e[0] + '">' + cuEsc(e[1]) + '</button>'; }).join('') + '</div>';
}
function cuBagRowHtml(c) {
  var j = CARD_JOB_BY_ID[c.main], cost = cardsCost(c);
  return '<div class="cur cubr" style="border-left:5px solid var(--gr' + c.gr + ');padding-left:4px">' +
    (c.fig ? '<span class="cusub" style="min-width:44px;text-align:center">名人</span>' : '<button class="cub" data-a="bsel" data-id="' + c.bid + '" aria-label="勾選">' + (cu.bsel[c.bid] ? '☑' : '☐') + '</button>') +
    '<span class="cubn" data-a="bdet" data-id="' + c.bid + '"><span><b>' + cuBagGrLabel(c.gr) + '</b> ' + cuEsc(c.name) + (c.tok ? ' <span class="cusub">信物' + c.tok + '</span>' : '') +
    '<span class="cusub"> ' + (j ? j.t[(c.ja[c.main] || 1) - 1] : '') + ' · 才 ' + c.tai + '</span></span></span>' +
    '<button class="cub" data-a="benl" data-id="' + c.bid + '">任用 🎴' + cost + '</button></div>';
}
function cuBagDetailHtml(cs, f) {
  var c = f.c, cost = cardsCost(c), h = '<button class="cub" data-a="bback">‹ 返回卡包</button>', val = cardsBagDissolveValue(c);
  h += cardsUiHtmlCard(c, { full: true, extra: '<div class="cusub cuink">出身:' + (c.org.k === 'pin' ? '縣試 ' + CARD_PIN[c.org.v] : CARD_VENUES[c.pool || 'T'].orgName) + (c.tok ? ' · 信物 ' + c.tok : '') + ' · 任用成本 🎴' + cost + '</div>' });
  h += '<button class="cub" data-a="benl" data-id="' + c.bid + '">任用(🎴' + cost + ')</button>';
  if (!c.fig) h += '<button class="cub warn" data-a="bdis" data-id="' + c.bid + '">分解(+' + val + ' 碎)</button>';
  else h += '<div class="cusub">名人不可分解;重複抽到會化為信物。</div>';
  if (cu.bpend) h += cuBagPendHtml();
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  return h;
}
function cuBagPendHtml() {
  return '<div class="cuwarn">' + cuEsc(cu.bpend.text) + '</div><button class="cub" data-a="bcfno">否</button><button class="cub warn" data-a="bcfyes">是,分解</button>';
}
function cuBagHtml(cs) {
  var cap = cardsBagCap(), n = cs.bag.length, h = '', auto = cardsBagAutoLv(cs), list, shown, sel, leIds, leSum, f, rows = [[-1, '全'], [0, '白'], [1, '青'], [2, '藍'], [3, '紫'], [4, '金']], i;
  cuBagCss();
  if (cu.bid) { f = cardsBagFind(cs, cu.bid); if (f) return cuBagDetailHtml(cs, f); cu.bid = null; }
  h += '<div class="cur"><span>卡包 <b>' + n + '/' + cap + '</b></span><span class="cusub">碎片 ' + cs.shards + '/5 · 本週還可得 ' + cuBagWeekLeft(cs) + ' 碎</span></div>';
  h += '<div class="cusub">開批的卡直接放進卡包;酒令只在「任用」(卡包 → 名冊,名額 ' + cs.roster.length + '/' + cardsCap() + ')時花。路人可分解成碎片(5 碎 = 1 令),名人不可分解。</div>';
  if (n + CARD_BAG.batchNeed > cap) h += '<div class="cuwarn">卡包空位不足 ' + CARD_BAG.batchNeed + ' 張,新批暫存不開;請先分解或任用。</div>';
  h += '<div class="cubsec">自動分解(開批時,路人品階 ≤ 此值直接分解)</div>' + cuBagChips(CU_BAG_AUTO, auto, 'bauto');
  leIds = cardsBagPick(cs, cu.ble); leSum = cuBagSum(cs, leIds);
  h += '<div class="cubsec">一鍵分解(品階 ≤ 所選,名人不入選)</div>' + cuBagChips(CU_BAG_LE, cu.ble, 'ble');
  h += '<button class="cub warn" data-a="bledo"' + (leIds.length ? '' : ' disabled') + '>分解 品階 ≤ ' + CARD_GRADE[cu.ble].name + '(' + leIds.length + ' 張,約 ' + leSum.raw + ' 碎)</button>';
  if (cu.bpend) h += cuBagPendHtml();
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  h += '<div class="cubsec">篩選 · 品階</div>' + cuBagChips(rows, cu.bf, 'bf');
  h += '<div class="cubsec">篩選 · 職業分類</div>' + cuBagChips([['', '全']].concat(CARD_ROWS.map(function (r) { return [r, r]; })), cu.br, 'br');
  h += '<div class="cubsec">排序</div>' + cuBagChips([['gr', '品階'], ['tai', '才'], ['new', '最新']], cu.bs, 'bs');
  list = cardsBagList(cs, { gr: cu.bf, row: cu.br, sort: cu.bs });
  sel = cuBagSelIds(cs);
  h += '<div class="cuchips"><button class="cub" data-a="bselall"' + (list.length ? '' : ' disabled') + '>全選目前篩選</button><button class="cub" data-a="bselclr"' + (sel.length ? '' : ' disabled') + '>取消選取</button>' +
    '<button class="cub warn" data-a="bseldo"' + (sel.length ? '' : ' disabled') + '>分解已選(' + sel.length + ')</button></div>';
  if (!n) return h + '<div class="cusub">卡包是空的。到酒館、縣試、指名開批吧。</div>';
  if (!list.length) return h + '<div class="cusub">沒有符合篩選的卡。</div>';
  shown = list.slice(0, cu.bn * CU_BAG_PAGE);
  h += '<div class="cubsec">共 ' + list.length + ' 張(顯示 ' + shown.length + ')</div>';
  for (i = 0; i < shown.length; i++) h += cuBagRowHtml(shown[i]);
  if (shown.length < list.length) h += '<button class="cub" data-a="bmore">顯示更多(尚有 ' + (list.length - shown.length) + ' 張)</button>';
  return h;
}
// 要求分解:單張白青直接做;批量或含藍以上先確認(bpend 存 bid 清單與提示字,按「是」才執行)
function cuBagAsk(cs, ids) {
  var s = cuBagSum(cs, ids);
  if (!ids.length) { cu.msg = '沒有可分解的卡'; return; }
  if (ids.length > 1 || s.top >= 2) {
    cu.bpend = { ids: ids, text: '確定分解 ' + s.n + ' 張(最高 ' + CARD_GRADE[s.top].name + '階)?約得 ' + s.raw + ' 碎片(受每週上限)。分解後無法復原。' };
    return;
  }
  cuBagDo(cs, ids);
}
function cuBagDo(cs, ids) {
  var r = cardsBagDissolve(cs, ids, { now: cuNow() });
  cu.bpend = null; cu.bid = null;
  if (!r.ok) { cu.msg = CU_BAG_MSG[r.reason] || '無法分解'; return; }
  ids.forEach(function (id) { delete cu.bsel[id]; });
  cu.msg = '分解 ' + r.n + ' 張,得碎片 ' + r.shards + (r.tokens ? '(轉得酒令 ' + r.tokens + ')' : '') + (r.lost ? ';超出本週上限 ' + r.lost + ' 碎未計' : '');
  cuSave();
}
function cuBagClick(a, b, cs) {
  var v = b.getAttribute('data-v'), id = b.getAttribute('data-id'), r, ids;
  if (a === 'bauto') { cardsBagSetAuto(cs, +v); cuSave(); return true; }
  if (a === 'ble') { cu.ble = Math.max(0, Math.min(3, +v | 0)); cu.bpend = null; return true; }
  if (a === 'bledo') { cuBagAsk(cs, cardsBagPick(cs, cu.ble)); return true; }
  if (a === 'bf') { cu.bf = +v; cu.bn = 1; return true; }
  if (a === 'br') { cu.br = v || ''; cu.bn = 1; return true; }
  if (a === 'bs') { cu.bs = (v === 'tai' || v === 'new') ? v : 'gr'; cu.bn = 1; return true; }
  if (a === 'bmore') { cu.bn++; return true; }
  if (a === 'bsel') { if (cu.bsel[id]) delete cu.bsel[id]; else cu.bsel[id] = 1; return true; }
  if (a === 'bselall') { cardsBagList(cs, { gr: cu.bf, row: cu.br, sort: cu.bs }).forEach(function (c) { if (!c.fig) cu.bsel[c.bid] = 1; }); return true; }
  if (a === 'bselclr') { cu.bsel = {}; return true; }
  if (a === 'bseldo') { cuBagAsk(cs, cuBagSelIds(cs)); return true; }
  if (a === 'bdet') { cu.bid = id; cu.bpend = null; return true; }
  if (a === 'bback') { cu.bid = null; cu.bpend = null; return true; }
  if (a === 'bdis') { ids = [id]; cuBagAsk(cs, ids); return true; }
  if (a === 'bcfno') { cu.bpend = null; return true; }
  if (a === 'bcfyes') { if (cu.bpend) cuBagDo(cs, cu.bpend.ids); return true; }
  if (a === 'benl') {
    r = cardsBagEnlist(cs, id);
    if (r.ok) { cardsSyncTalents(); cu.bid = null; delete cu.bsel[id]; cu.msg = '任用「' + r.entry.name + '」,已進名冊'; cuSave(); }
    else { cu.msg = CU_BAG_MSG[r.reason] || '無法任用'; if (typeof showToast === 'function') showToast(cu.msg); }
    return true;
  }
  return false;
}
