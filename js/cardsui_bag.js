// js/cardsui_bag.js — 卡包分頁 + 卡片熔爐(PLAN_CARDS 第四批決議 + 使用者決議:卡片熔爐):開批的卡直接進卡包;列表可依品階 / 職業分類篩選、排序;
// 熔爐流程 = 放入卡片 → 預覽可得碎片 → 熔鍊(單張 / 勾選批量 / 一鍵品階 ≤ X / 自動熔爐設定);名人不入一鍵與自動,只能在詳情頁手動熔並二次確認(碎片較高)。
// 碎片用途:(1)名冊詳情『強化(升星)』(cuStarHtml,動作 starup)(2)『碎片兌換』指名券(每週上限)(3)學院進修(4)請回流浪名人。
// 2026-11-09:酒令與『任用』已移除 —— 卡包只是名冊滿額時的暫存,名冊有空位會自動補進(cardsRosterFill);詳情頁在名冊有空位時可按『加入名冊』(免費)。
// 掛在 cardsui.js(cuBagHtml / cuBagClick / cuStarHtml 由其 typeof 守衛呼叫)。引擎在 cards.js(cardsBag* / cardsFurnace* / cardsStar* / cardsExchange)。不發聲、不推播。ES2017;不用 ?. ??。
// 全域名稱:cuBagHtml cuBagClick cuBagCss cuStarHtml CU_BAG_PAGE CU_BAG_MSG
var CU_BAG_PAGE = 40;   // 列表一頁筆數(「顯示更多」每次再加一頁)
var CU_BAG_MSG = { over: '溢出區的卡需先納入卡包(清出空位後自動納入;也可直接熔鍊)', full: '名冊已滿,先遣散一人或等官階晉升', none: '此卡已不在卡包', fig: '名人需在詳情頁手動熔鍊(二次確認)' };
var CU_BAG_AUTO = [[-1, '關'], [0, '白'], [1, '青以下'], [2, '藍以下']];
var CU_BAG_LE = [[0, '白'], [1, '青'], [2, '藍'], [3, '紫']];   // 一鍵熔爐「品階 ≤ X」可選

function cuBagCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuBagStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuBagStyle';
  st.textContent = '#cardsPanel button.cub.on{background:#f0b45a;color:#222}#cardsPanel .cuchips{display:flex;flex-wrap:wrap;gap:0}#cardsPanel .cubr{align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}#cardsPanel .cubr .cubn{flex:1 1 auto;min-width:0;cursor:pointer;min-height:44px;display:flex;align-items:center}' +
    '#cardsPanel .cubr button.cub{margin:0;padding:4px 8px;min-width:44px}#cardsPanel .cubsec{margin:8px 0 2px;font-size:12px;opacity:.7}' +
    '#cardsPanel .cuovb{display:inline-block;padding:2px 10px;border-radius:12px;background:#c0392b;color:#fff;font-weight:bold;white-space:nowrap}#cardsPanel .cuovb.urg{background:#ffb020;color:#2a1a00;outline:2px solid #fff}#cardsPanel .cuovt{color:#ff7a6a;white-space:nowrap;padding:0 6px}#cardsPanel .cuovt.urg{color:#ffc040;font-weight:bold}#cardsPanel .cuovbox{margin:6px 0;padding:6px 8px;border:1px solid #c0392b;border-radius:8px;background:rgba(192,57,43,.12)}#cardsPanel .cuovbox.urg{border-color:#ffb020;background:rgba(255,176,32,.14)}#cardsPanel .cuovn{padding:4px 6px;border-radius:6px;background:rgba(255,176,32,.18)}';
  document.head.appendChild(st);
}
function cuBagGrLabel(gr) { var G = CARD_GRADE[gr], c = '', i; for (i = 0; i < G.corner; i++) c += '◆'; return G.ch + c; }
function cuBagSelIds(cs) {   // 勾選中且仍在卡包的 bid(順便清掉已不存在的)
  var out = [];
  Object.keys(cu.bsel).forEach(function (id) { var f = cardsAnyFind(cs, id); if (f && !f.c.fig) out.push(id); else delete cu.bsel[id]; });
  return out;
}
function cuBagSum(cs, ids) {
  var o = cardsFurnaceSum(cs, ids, true);   // 勾選 / 一鍵的清單本就不含名人;單張名人另走確認
  return { n: o.n, raw: o.shards, top: o.top, figs: o.figs };
}
function cuBagChips(items, cur, act, key) {
  return '<div class="cuchips">' + items.map(function (e) { return '<button class="cub' + (cur === e[0] ? ' on' : '') + '" data-a="' + act + '" data-v="' + e[0] + '">' + cuEsc(e[1]) + '</button>'; }).join('') + '</div>';
}
// ---- 溢出區(cs.bagOver):剩餘時間 hh:mm、頂部區塊、列表;到期結算與每秒更新由 cuOverTick(cardsui.js cuTick 掛點)----
function cuOverFmt(ms) {
  var m = Math.max(0, Math.ceil(ms / 60000)), h = Math.floor(m / 60);
  m = m % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
function cuOverRowHtml(cs, c) {
  var j = CARD_JOB_BY_ID[c.main], left = cardsOverLeft(cs, c, cuNow());
  return '<div class="cur cubr" style="border-left:5px solid var(--gr' + c.gr + ');padding-left:4px"><button class="cub" data-a="bsel" data-id="' + c.bid + '" aria-label="勾選">' + (cu.bsel[c.bid] ? '☑' : '☐') + '</button>' +
    '<span class="cubn" data-a="bdet" data-id="' + c.bid + '">' + (typeof cuArtThumb === 'function' ? cuArtThumb(c) : '') + '<span><b>' + cuBagGrLabel(c.gr) + '</b> ' + cuEsc(c.name) + '<span class="cusub"> ' + (j ? j.t[(c.ja[c.main] || 1) - 1] : '') + ' · 才 ' + c.tai + '</span></span></span>' +
    '<span class="cuovt' + (left < CARD_BAG.overWarnMs ? ' urg' : '') + '" data-ovl="' + c.bid + '">' + cuOverFmt(left) + '</span></div>';
}
function cuOverHtml(cs) {
  var m = cardsOverMin(cs, cuNow()), list, sum, t, h, shown, i;
  if (!m.n) return '';
  list = cardsOverList(cs);
  sum = cuBagSum(cs, list.map(function (c) { return c.bid; }));
  t = cuOverFmt(m.ms);
  h = '<div class="cuovbox' + (m.urgent ? ' urg' : '') + '"><div class="cur"><span><b>溢出區 ' + m.n + ' 張</b>,最短剩 <span data-ovmin="1">' + t + '</span> <span class="cusub">(上限 ' + cardsBagCap() + ')</span></span>' +
    '<span class="cuovb' + (m.urgent ? ' urg' : '') + '" data-ovbadge="1">⏳ <span data-ovmin="1">' + t + '</span></span></div>';
  h += '<div class="cusub">卡包滿時多出的卡暫放這裡;卡包有空位(熔鍊、補進名冊、官階提升)會依剩餘時間短者先自動納入,24 小時內沒納入就熔成碎片。名人不受影響。' + (m.urgent ? ' <b class="cuwarn">快到期了!</b>' : '') + '</div>';
  h += '<button class="cub warn" data-a="ovall">熔鍊整個溢出區(' + sum.n + ' 張,可得 ' + sum.raw + ' 碎)</button>';
  shown = list.slice(0, 30);
  for (i = 0; i < shown.length; i++) h += cuOverRowHtml(cs, shown[i]);
  if (list.length > shown.length) h += '<div class="cusub">另有 ' + (list.length - shown.length) + ' 張(剩餘時間較長)。</div>';
  return h + '</div>';
}
// cuTick 掛點:先結算,到期 / 納入 / 張數變化回 true(整頁重畫);否則只更新倒數文字
function cuOverTick(cs) {
  var r = cardsOverSettle(cs, cuNow()), m = cardsOverMin(cs, cuNow()), nodes, i, shown = 0, c;
  if (r.roster && typeof cardsSyncTalents === 'function') cardsSyncTalents();
  if (r.expired || r.filled || r.roster) { cuSave(); return true; }
  if (!cu.el || !cu.el.querySelectorAll) return false;
  nodes = cu.el.querySelectorAll('[data-ovmin]');
  for (i = 0; i < nodes.length; i++) { nodes[i].textContent = m.ms === null ? '' : cuOverFmt(m.ms); shown++; }
  if (shown && m.urgent !== !!cu.el.querySelector('.cuovbox.urg')) return true;   // 進入 < 2 小時:換提示色
  nodes = cu.el.querySelectorAll('[data-ovl]');
  for (i = 0; i < nodes.length; i++) { c = cardsAnyFind(cs, nodes[i].getAttribute('data-ovl')); if (c && c.over) nodes[i].textContent = cuOverFmt(cardsOverLeft(cs, c.c, cuNow())); }
  return false;
}
function cuBagRowHtml(c) {
  var j = CARD_JOB_BY_ID[c.main];
  return '<div class="cur cubr" style="border-left:5px solid var(--gr' + c.gr + ');padding-left:4px">' +
    (c.fig ? '<span class="cusub" style="min-width:44px;text-align:center">名人</span>' : '<button class="cub" data-a="bsel" data-id="' + c.bid + '" aria-label="勾選">' + (cu.bsel[c.bid] ? '☑' : '☐') + '</button>') +
    '<span class="cubn" data-a="bdet" data-id="' + c.bid + '">' + (typeof cuArtThumb === 'function' ? cuArtThumb(c) : '') + '<span><b>' + cuBagGrLabel(c.gr) + '</b> ' + cuEsc(c.name) + (c.tok ? ' <span class="cusub">信物' + c.tok + '</span>' : '') +
    '<span class="cusub"> ' + (j ? j.t[(c.ja[c.main] || 1) - 1] : '') + ' · 才 ' + c.tai + '</span></span></span></div>';
}
function cuBagDetailHtml(cs, f) {
  var c = f.c, h = '<button class="cub" data-a="bback">‹ 返回卡包</button>', val = cardsFurnaceValue(c), room = cardsRosterRoom(cs);
  h += cardsUiHtmlCard(c, { full: true, extra: '<div class="cusub cuink">出身:' + (c.org.k === 'pin' ? CARD_VENUES.E.name + ' ' + CARD_PIN[c.org.v] : CARD_VENUES[c.pool || 'T'].orgName) + (c.tok ? ' · 信物 ' + c.tok : '') + '</div>' });
  if (f.over) h += '<div class="cuwarn">溢出區 · 剩 <span data-ovl="' + c.bid + '">' + cuOverFmt(cardsOverLeft(cs, c, cuNow())) + '</span>。卡包有空位會自動納入;也可直接熔鍊清出空間。</div>';
  else if (room > 0) h += '<button class="cub" data-a="benl" data-id="' + c.bid + '">加入名冊</button>';
  else h += '<div class="cuwarn">名冊已滿(' + cs.roster.length + '/' + cardsCap() + '),這張先放卡包。遣散名冊裡的人或提升官階後,會自動補進名冊。</div>';
  if (!c.fig) h += '<button class="cub warn" data-a="bdis" data-id="' + c.bid + '">熔鍊(+' + val + ' 碎)</button>';
  else h += '<button class="cub warn" data-a="bdis" data-id="' + c.bid + '">熔鍊名人(+' + val + ' 碎,需確認)</button><div class="cusub">名人不在一鍵與自動熔爐範圍;重複抽到會化為信物,信物滿了轉碎片。</div>';
  if (cu.bpend) h += cuBagPendHtml();
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  return h;
}
function cuBagPendHtml() {
  return '<div class="cuwarn">' + cuEsc(cu.bpend.text) + '</div><button class="cub" data-a="bcfno">否</button><button class="cub warn" data-a="bcfyes">是,熔鍊</button>';
}
function cuBagHtml(cs) {
  var cap = cardsBagCap(), n = cs.bag.length, h = '', auto = cardsBagAutoLv(cs), list, shown, sel, leIds, leSum, f, rows = [[-1, '全'], [0, '白'], [1, '青'], [2, '藍'], [3, '紫'], [4, '金']], i, X = CARD_FURNACE.exchange, left;
  cuBagCss();
  var note = cardsOverNoteTake(cs);
  if (note) cu.omsg = note.n + ' 張溢出卡到期,已熔成 ' + note.shards + ' 碎片';
  if (cu.bid) { f = cardsAnyFind(cs, cu.bid); if (f) return cuBagDetailHtml(cs, f); cu.bid = null; }
  h += '<div class="cur"><span>卡包 <b>' + n + '/' + cap + '</b></span><span class="cusub">碎片 ' + cs.shards + ' · 指名券 ' + (cs.nameTokens | 0) + '</span></div>';
  if (typeof cuRosterLine === 'function') h += cuRosterLine(cs);   // 名冊 n/名額、滿額提示(cardsui_starter.js)
  h += '<div class="cusub">抽到的卡直接加入名冊;名冊滿了才放卡包,名冊有空位會自動補進。<b>卡片熔爐</b>:放入不要的卡 → 預覽可得碎片 → 熔鍊。碎片可到名冊詳情強化武將(升星)、在下方兌換指名券,也用於學院進修。</div>';
  if (cu.omsg) h += '<div class="cuovn">' + cuEsc(cu.omsg) + '</div>';
  h += cuOverHtml(cs);
  if (!cardsBagCanOpen(cs)) h += '<div class="cuwarn">名冊、卡包與溢出區空位合計不足 ' + CARD_BAG.batchNeed + ' 張,新批暫存不開;請先遣散或熔鍊幾張。</div>';
  else if (cardsBagRoom(cs) < CARD_BAG.batchNeed) h += '<div class="cusub">卡包空位不足 ' + CARD_BAG.batchNeed + ' 張:多出的卡會進溢出區(24 小時內沒空位納入就熔成碎片)。</div>';
  if (typeof furnaceUiOpen === 'function') h += '<button class="cub" data-a="tofurnace">🔥 前往卡片熔爐</button>';   // 熔爐面板(furnaceui.js)
  left = cardsExchangeLeft(cs, cuNow());
  h += '<div class="cubsec">碎片兌換(' + X.shards + ' 碎 = 1 張指名券;本週還可換 ' + left + '/' + X.weekMax + ' 張)</div>';
  h += '<button class="cub" data-a="bex"' + (left > 0 && cs.shards >= X.shards ? '' : ' disabled') + '>兌換指名券 ×1(' + X.shards + ' 碎)</button>';
  h += '<div class="cubsec">自動熔爐(名冊已滿時,新抽到的路人品階 ≤ 此值直接熔成碎片;名人不入)</div>' + cuBagChips(CU_BAG_AUTO, auto, 'bauto');
  leIds = cardsBagPick(cs, cu.ble); leSum = cuBagSum(cs, leIds);
  h += '<div class="cubsec">一鍵熔爐(品階 ≤ 所選,名人不入選)</div>' + cuBagChips(CU_BAG_LE, cu.ble, 'ble');
  h += '<button class="cub warn" data-a="bledo"' + (leIds.length ? '' : ' disabled') + '>熔鍊 品階 ≤ ' + CARD_GRADE[cu.ble].name + '(' + leIds.length + ' 張,可得 ' + leSum.raw + ' 碎)</button>';
  if (cu.bpend) h += cuBagPendHtml();
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  h += '<div class="cubsec">篩選 · 品階</div>' + cuBagChips(rows, cu.bf, 'bf');
  h += '<div class="cubsec">篩選 · 職業分類</div>' + cuBagChips([['', '全']].concat(CARD_ROWS.map(function (r) { return [r, r]; })), cu.br, 'br');
  h += '<div class="cubsec">排序</div>' + cuBagChips([['gr', '品階'], ['tai', '才'], ['new', '最新']], cu.bs, 'bs');
  list = cardsBagList(cs, { gr: cu.bf, row: cu.br, sort: cu.bs });
  sel = cuBagSelIds(cs);
  leSum = cuBagSum(cs, sel);
  h += '<div class="cuchips"><button class="cub" data-a="bselall"' + (list.length ? '' : ' disabled') + '>全選目前篩選</button><button class="cub" data-a="bselclr"' + (sel.length ? '' : ' disabled') + '>取消選取</button>' +
    '<button class="cub warn" data-a="bseldo"' + (sel.length ? '' : ' disabled') + '>熔鍊已選(' + sel.length + ',可得 ' + leSum.raw + ' 碎)</button></div>';
  if (!n) return h + '<div class="cusub">卡包是空的。名冊滿了之後,新抽到的卡才會先放這裡。</div>';
  if (!list.length) return h + '<div class="cusub">沒有符合篩選的卡。</div>';
  shown = list.slice(0, cu.bn * CU_BAG_PAGE);
  h += '<div class="cubsec">共 ' + list.length + ' 張(顯示 ' + shown.length + ')</div>';
  for (i = 0; i < shown.length; i++) h += cuBagRowHtml(shown[i]);
  if (shown.length < list.length) h += '<button class="cub" data-a="bmore">顯示更多(尚有 ' + (list.length - shown.length) + ' 張)</button>';
  return h;
}
// 要求熔鍊:單張白青直接做;批量或含藍以上先確認;名人(figOk)一律先二次確認(bpend 存 bid 清單與提示字,按「是」才執行)
function cuBagAsk(cs, ids, figOk) {
  var s = cardsFurnaceSum(cs, ids, !!figOk);
  if (!s.n) { cu.msg = s.skippedFig ? CU_BAG_MSG.fig : '沒有可熔鍊的卡'; return; }
  if (s.figs) {
    cu.bpend = { ids: ids, figOk: true, text: '確定熔掉名人?熔鍊後該名人與信物一併消失(日後可能再抽到),可得 ' + s.shards + ' 碎片。熔鍊後無法復原。' };
    return;
  }
  if (s.n > 1 || s.top >= 2) {
    cu.bpend = { ids: ids, text: '確定熔鍊 ' + s.n + ' 張(最高 ' + CARD_GRADE[s.top].name + '階)?可得 ' + s.shards + ' 碎片。熔鍊後無法復原。' };
    return;
  }
  cuBagDo(cs, ids, false);
}
function cuBagDo(cs, ids, figOk) {
  var r = cardsBagDissolve(cs, ids, { figOk: !!figOk, now: cuNow() });
  cu.bpend = null; cu.bid = null;
  if (!r.ok) { cu.msg = CU_BAG_MSG[r.reason] || '無法熔鍊'; return; }
  ids.forEach(function (id) { delete cu.bsel[id]; });
  cu.msg = '熔鍊 ' + r.n + ' 張,得碎片 ' + r.shards + '(現有 ' + cs.shards + ')';
  cuSave();
}
// 名冊詳情『強化(升星)』區塊:星 0~5,花碎片;名人成本 ×2,每個信物抵 30 %;每星攻 / 防 / HP 加成、3 星技能強化、5 星專屬標記
function cuStarHtml(cs, e) {
  var F = CARD_FURNACE, B = F.starBonus, c = cardsStarCost(e), lv = cardsStarLv(e), stars = '', i, h;
  for (i = 1; i <= F.starMax; i++) stars += i <= lv ? '★' : '☆';
  h = '<div class="cusec">強化(升星)</div><div class="cusub" style="opacity:1">' + stars + '(' + lv + '/' + F.starMax + ')· 攻 / 防 / HP 各 +' + Math.round(lv * B.atk * 100) + ' %' +
    (lv >= B.skillStar ? ' · 技能強化' : '') + (lv >= B.markStar ? ' · 專屬標記' : '') + '<br>每星 +' + Math.round(B.atk * 100) + ' %;' + B.skillStar + ' 星起解鎖技能強化、' + B.markStar + ' 星專屬標記。碎片 ' + cs.shards + '。</div>';
  if (c.max) return h + '<div class="cusub">已達最高星。</div>';
  h += '<button class="cub" data-a="starup" data-id="' + e.id + '"' + (cs.shards >= c.cost ? '' : ' disabled') + '>升至 ' + (lv + 1) + ' 星(' + c.cost + ' 碎)</button>';
  if (e.fig || e.tok) h += '<div class="cusub">' + (e.fig ? '名人成本 ×' + F.figMul : '') + (e.tok ? (e.fig ? ';' : '') + '信物 ' + e.tok + ' 個抵 ' + c.off + ' 碎(原價 ' + c.base + ')' : '') + '</div>';
  return h;
}
function cuBagClick(a, b, cs) {
  var v = b.getAttribute('data-v'), id = b.getAttribute('data-id'), r, f;
  if (a === 'tofurnace') { if (typeof furnaceUiOpen === 'function') furnaceUiOpen(); return true; }
  if (a === 'bauto') { cardsBagSetAuto(cs, +v); cuSave(); return true; }
  if (a === 'ble') { cu.ble = Math.max(0, Math.min(3, +v | 0)); cu.bpend = null; return true; }
  if (a === 'ovall') { cuBagAsk(cs, cardsOverList(cs).filter(function (c) { return !c.fig; }).map(function (c) { return c.bid; }), false); return true; }
  if (a === 'bledo') { cuBagAsk(cs, cardsBagPick(cs, cu.ble), false); return true; }
  if (a === 'bf') { cu.bf = +v; cu.bn = 1; return true; }
  if (a === 'br') { cu.br = v || ''; cu.bn = 1; return true; }
  if (a === 'bs') { cu.bs = (v === 'tai' || v === 'new') ? v : 'gr'; cu.bn = 1; return true; }
  if (a === 'bmore') { cu.bn++; return true; }
  if (a === 'bsel') { if (cu.bsel[id]) delete cu.bsel[id]; else cu.bsel[id] = 1; return true; }
  if (a === 'bselall') { cardsBagList(cs, { gr: cu.bf, row: cu.br, sort: cu.bs }).forEach(function (c) { if (!c.fig) cu.bsel[c.bid] = 1; }); return true; }
  if (a === 'bselclr') { cu.bsel = {}; return true; }
  if (a === 'bseldo') { cuBagAsk(cs, cuBagSelIds(cs), false); return true; }
  if (a === 'bdet') { cu.bid = id; cu.bpend = null; return true; }
  if (a === 'bback') { cu.bid = null; cu.bpend = null; return true; }
  if (a === 'bdis') { f = cardsBagFind(cs, id); cuBagAsk(cs, [id], !!(f && f.c.fig)); return true; }
  if (a === 'bcfno') { cu.bpend = null; return true; }
  if (a === 'bcfyes') { if (cu.bpend) cuBagDo(cs, cu.bpend.ids, cu.bpend.figOk); return true; }
  if (a === 'bex') {
    r = cardsExchange(cs, 1, cuNow());
    cu.msg = r.ok ? '兌換指名券 +1(花 ' + r.shards + ' 碎)' : (r.reason === 'week' ? '本週兌換已達上限' : '碎片不足(需 ' + r.need + ')');
    if (r.ok) cuSave();
    return true;
  }
  if (a === 'starup') {
    r = cardsStarUp(cs, id);
    cu.msg = r.ok ? '升至 ' + r.lv + ' 星(花 ' + r.cost + ' 碎)' : (r.reason === 'max' ? '已達最高星' : r.reason === 'shards' ? '碎片不足(需 ' + r.need + ')' : '無法升星');
    if (r.ok) cuSave();
    return true;
  }
  if (a === 'benl') {
    r = cardsBagEnlist(cs, id, { now: cuNow() });
    if (r.ok) { cardsSyncTalents(); cu.bid = null; delete cu.bsel[id]; cu.msg = '「' + r.entry.name + '」已加入名冊'; cuSave(); }
    else {
      cu.msg = CU_BAG_MSG[r.reason] || '無法加入名冊';
      if (typeof showToast === 'function') showToast(cu.msg);
    }
    return true;
  }
  return false;
}
