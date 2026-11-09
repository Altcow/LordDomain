// js/cardsui_named.js — 招募介面合併(PLAN_INTERIORS I0):『總覽』(各池一覽 + 全部開啟)與『指名』(指定池:選陣營或職業分類,消耗指名券)兩個分頁。開批的卡直接加入名冊,名冊滿了先放卡包(cardsui_bag.js)。
// 掛在 cardsui.js(cuOverviewHtml / cuNamedHtml / cuNamedClick / cuChainRun 由其 typeof 守衛呼叫)。引擎在 cards.js(cardsNamedDraw 等)。不發聲、不推播。ES2017;不用 ?. ??。
// 全域名稱:cuOverviewHtml cuNamedHtml cuNamedClick cuChainRun CU_CHAIN_ORDER
var CU_CHAIN_ORDER = ['E', 'T'];   // 全部開啟順序:縣試 → 酒館(指名要選條件、花券,不納入連開)
var CU_NAMED_MSG = { closed: '指定池尚未開放(需研發對應科技)', bad: '請先選擇陣營或職業分類', busy: '上一批還在開啟中', bagfull: '名冊與卡包都滿了,先遣散或熔鍊幾張', ticket: '指名券不足' };

function cuNamedCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuNamedStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuNamedStyle';
  st.textContent = '#cardsPanel button.cub.on{background:#f0b45a;color:#222}#cardsPanel .cuov{margin:6px 0;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.07)}#cardsPanel .cuchips{display:flex;flex-wrap:wrap;gap:0}';
  document.head.appendChild(st);
}
// 結果批次標題:指名批次(b.named)顯示「指名 · 陣營 / 職業分類」,舊殿試批次顯示原期鍵
function cuNamedLabel(b) {
  var nm = b && b.named;
  if (!nm) return '名帖 · ' + b.key + '(舊殿試)';
  return '指名 · ' + (nm.mode === 'fac' ? '陣營 ' + (CARD_FAC[nm.key] || '') : '職業分類 ' + nm.key) + ' · 第 ' + ((parseInt(String(b.key).slice(2), 10) | 0) + 1) + ' 次';
}
function cuOverviewHtml(cs) {
  var now = cuNow(), h = '', total = 0, ov;
  cuNamedCss();
  if (typeof cuStarterBanner === 'function') h += cuStarterBanner(cs) + cuNbLine(cs);   // 新手禮包入口 / 新手期(cardsui_starter.js)
  if (typeof cuRosterLine === 'function') h += cuRosterLine(cs);   // 名冊 n/名額、滿額提示(cardsui_starter.js)
  h += '<div class="cur"><span>碎片 <b>' + (cs.shards | 0) + '</b></span><span>指名券 <b>🎫 ' + (cs.nameTokens | 0) + '</b></span></div>';
  if (cs.bag.length || cs.bagOver) h += cuBagLine(cs);
  ['T', 'E'].forEach(function (v) {
    var V = CARD_VENUES[v], n = cs.acc[v].length, open = cardsVenueOpen(v), cur = cs.cur[v] ? 1 : 0, T = cardsDrawTier();
    total += open ? n : 0;
    if (!open) { h += '<div class="cuov"><b>' + V.name + '</b> <span class="cusub">尚未開放(需研發對應科技)</span></div>'; return; }
    h += '<div class="cuov"><div class="cur"><b>' + V.name + '</b><span class="cusub">每 ' + T.h + ' 小時一批 · 每批 ' + T.n + ' 張 · ' + (v === 'T' ? '白青藍' : '白至紫') + (cur ? ' · 開啟中' : '') + '</span></div>' +
      cuDrawHtml(cs, v) + '<div class="cusub">保底 ' + Math.min(cs.pity[v], CARD_DRAW.pity) + '/' + CARD_DRAW.pity + '</div>' + ((typeof cuPityLine === 'function') ? cuPityLine(cs, v) : '') + '</div>';
  });
  h += '<div class="cuov"><div class="cur"><b>指名</b><span class="cusub">不靠計時,消耗指名券 · 白至金</span></div><div class="cur"><span>' +
    (cardsNamedOpen(cs) ? '持有 <b>🎫 ' + (cs.nameTokens | 0) + '</b> · 已指名 ' + (cs.namedCount | 0) + ' 次' : '尚未開放(需研發對應科技)') + '</span>' +
    '<button class="cub" data-a="tab" data-t="N" style="margin:0">前往</button></div></div>';
  h += '<button class="cub" data-a="chainall"' + (total && cardsBagCanOpen(cs) ? '' : ' disabled') + '>' + (total ? '全部抽(' + total + ' 批)' : '還沒到時間') + '</button>';
  h += '<div class="cusub">順序:' + CARD_VENUES.E.name + ' → ' + CARD_VENUES.T.name + ';抽到的人直接加入名冊,名冊滿了先放卡包(卡包也滿了進溢出區,24 小時);名冊、卡包、溢出區空位合計不足 ' + CARD_BAG.batchNeed + ' 張時停下。</div>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  return h + cuLastHtml();
}
function cuNamedHtml(cs) {
  var h = '', fac = cu.nmode === 'fac', tk = cs.nameTokens | 0, b = cs.cur.G, list, canDraw, full = !cardsBagCanOpen(cs);
  cuNamedCss();
  if (!cardsNamedOpen(cs)) return '<div class="cur"><span>指名尚未開放(需研發對應科技)</span></div>';
  h += '<div class="cur"><span>持有指名券 <b>🎫 ' + tk + '</b></span><span class="cusub">已指名 ' + (cs.namedCount | 0) + ' 次 · 保底 ' + Math.min(cs.pity.G, CARD_CFG.pityBatches) + '/' + CARD_CFG.pityBatches + '</span></div>';
  h += '<div class="cusub">每次消耗 1 券,出一批 ' + CARD_VENUES.G.batch + ' 張直接加入名冊(名冊滿了先放卡包);每 ' + (CARD_CFG.pityBatches + 1) + ' 次至少 1 位紫以上。指名券來源:新手禮包、完成里程碑、官階晉升、碎片兌換。' + (cardsVenueOpen('G') ? '' : '(目前用的是新手禮包的指名券,研發對應科技後才會一直開放。)') + '</div>';
  if (typeof cuPityLine === 'function') h += cuPityLine(cs, 'G');
  if (typeof cuRosterLine === 'function') h += cuRosterLine(cs);
  if (cs.bag.length || cs.bagOver) h += cuBagLine(cs);
  h += '<div class="cuchips"><button class="cub' + (fac ? ' on' : '') + '" data-a="nmode" data-m="fac">陣營</button><button class="cub' + (fac ? '' : ' on') + '" data-a="nmode" data-m="row">職業分類</button></div>';
  if (fac && cardsFacList().indexOf(cu.nkey) < 0) cu.nkey = cardsFacList()[0];   // 魔幻世界陣營為 5~13(本族在前)
  list = fac ? cardsFacList().map(function (i) { return [i, CARD_FAC[i]]; }) : CARD_ROWS.map(function (n) { return [n, n]; });
  h += '<div class="cuchips">' + list.map(function (e) { return '<button class="cub' + (cu.nkey === e[0] ? ' on' : '') + '" data-a="nkey" data-k="' + e[0] + '">' + cuEsc(e[1]) + '</button>'; }).join('') + '</div>';
  h += '<div class="cusub">' + (fac ? '指定陣營:該陣營的人物,金 / 紫檔可能出現該陣營名人(重複者化為信物)。' : '指定職業分類:主職業取自該分類;不出名人。') + '</div>';
  canDraw = !b && tk >= 1 && !full;
  if (!b) h += '<button class="cub" data-a="ndraw"' + (canDraw ? '' : ' disabled') + '>招募一次(消耗 1 券)</button>';
  if (!b && full) h += '<div class="cuwarn">名冊、卡包與溢出區空位合計不足 ' + CARD_BAG.batchNeed + ' 張,先遣散或熔鍊幾張(不會扣券)。</div>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  return h + cuLastHtml('N');
}
// 全部開啟:縣試 → 酒館,逐批「開批 → 特效 → 入包」,直到沒有待開批次或卡包空位不足;摘要合併成一份。特效是非同步的,所以用遞迴接力
function cuChainRun(first) {
  var cs = cardsGet(), i, v, r;
  if (!cs || !cu.chain) return;
  if (!cu.open) { cu.chain = false; return; }   // 面板關掉就停(已開的批次都已入包)
  for (i = 0; i < CU_CHAIN_ORDER.length; i++) {
    v = CU_CHAIN_ORDER[i];
    if (!cardsVenueOpen(v) || !cs.acc[v].length) continue;
    r = cardsBagStage(cs, v);
    if (!r.ok) { cu.chain = false; cu.msg = CU_OPEN_MSG[r.reason] || '無法開批'; cardsUiRender(); return; }
    cuSave();
    cuRevealThen(r.cards, function () {
      cuFinishBatch(v, '全部開啟', first, 'O');
      cuChainRun(false);
    }, !first);   // 只有第一批播完整特效,其餘直接入包 + 摘要
    return;
  }
  cu.chain = false; cu.tab = 'O';
  cu.msg = first ? '還沒到時間,沒有可抽的批次' : '已全部抽完' + (cu.last && cu.last.roster ? ',加入名冊 ' + cu.last.roster + ' 人' : '');
  cardsUiRender();
}
function cuNamedClick(a, b, cs) {
  var r, k;
  if (a === 'chainall') { cu.chain = true; cu.tab = 'O'; cuChainRun(true); return true; }
  if (a === 'nmode') { cu.nmode = b.getAttribute('data-m') === 'row' ? 'row' : 'fac'; cu.nkey = cu.nmode === 'fac' ? cardsFacList()[0] : CARD_ROWS[0]; return true; }
  if (a === 'nkey') { k = b.getAttribute('data-k'); cu.nkey = cu.nmode === 'fac' ? +k : k; return true; }
  if (a === 'ndraw') {
    r = cardsNamedDraw(cs, cu.nmode, cu.nkey);
    if (!r.ok) { cu.msg = CU_NAMED_MSG[r.reason] || '無法招募'; if (typeof showToast === 'function') showToast(cu.msg); cuSave(); return true; }
    cuSave();
    cuRevealThen(r.batch.cands, function () {
      var res = cuFinishBatch('G', '指名', true);
      if (typeof cuJoinToast === 'function') cuJoinToast(res);
      if (cu.open) cardsUiRender();
    });
    return true;
  }
  return false;
}
