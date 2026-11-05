// js/cardsui_named.js — 招募介面合併(PLAN_INTERIORS I0):『總覽』(各池一覽 + 全部開啟)與『指名』(指定池:選陣營或職業分類,消耗指名券)兩個分頁。開批的卡一律直接進卡包(cardsui_bag.js)。
// 掛在 cardsui.js(cuOverviewHtml / cuNamedHtml / cuNamedClick / cuChainRun 由其 typeof 守衛呼叫)。引擎在 cards.js(cardsNamedDraw 等)。不發聲、不推播。ES2017;不用 ?. ??。
// 全域名稱:cuOverviewHtml cuNamedHtml cuNamedClick cuChainRun CU_CHAIN_ORDER
var CU_CHAIN_ORDER = ['E', 'T'];   // 全部開啟順序:縣試 → 酒館(指名要選條件、花券,不納入連開)
var CU_NAMED_MSG = { closed: '指定池尚未開放(需研發對應科技)', bad: '請先選擇陣營或職業分類', busy: '上一批還在開啟中', bagfull: '卡包空位不足,先熔鍊或任用', ticket: '指名券不足' };

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
  h += '<div class="cur"><span>持有酒令 <b>🎴 ' + cs.tok + '</b></span><span>指名券 <b>🎫 ' + (cs.nameTokens | 0) + '</b></span></div>';
  h += cuBagLine(cs);
  ['T', 'E'].forEach(function (v) {
    var V = CARD_VENUES[v], n = cs.acc[v].length, nx, open = cardsVenueOpen(v), cur = cs.cur[v] ? 1 : 0;
    total += open ? n : 0;
    if (!open) { h += '<div class="cuov"><b>' + V.name + '</b> <span class="cusub">尚未開放(需研發對應科技)</span></div>'; return; }
    nx = cardsNextIn(cs, v, now);
    h += '<div class="cuov"><div class="cur"><b>' + V.name + '</b><span class="cusub">每 ' + V.unit + '一批 · ' + (v === 'T' ? '白青藍' : '白至紫') + '</span></div>' +
      '<div class="cur"><span>待閱 <b>' + n + '/' + V.cap + '</b> 批(約 ' + (n + cur) * V.batch + ' 人)' + (cur ? ' · 開啟中' : '') + '</span><span class="cusub">' +
      (nx === null ? '已滿' : '下一批 <span data-cd="' + v + '">' + cardsUiFmtCd(nx) + '</span>') + '</span></div>' +
      '<div class="cusub">保底 ' + Math.min(cs.pity[v], CARD_CFG.pityBatches) + '/' + CARD_CFG.pityBatches + '</div></div>';
  });
  h += '<div class="cuov"><div class="cur"><b>指名</b><span class="cusub">不靠計時,消耗指名券 · 白至金</span></div><div class="cur"><span>' +
    (cardsNamedOpen() ? '持有 <b>🎫 ' + (cs.nameTokens | 0) + '</b> · 已指名 ' + (cs.namedCount | 0) + ' 次' : '尚未開放(需研發對應科技)') + '</span>' +
    '<button class="cub" data-a="tab" data-t="N" style="margin:0">前往</button></div></div>';
  h += '<button class="cub" data-a="chainall"' + (total && cs.bag.length + CARD_BAG.batchNeed <= cardsBagCap() ? '' : ' disabled') + '>全部開啟(' + total + ' 批)</button>';
  h += '<div class="cusub">順序:縣試 → 酒館;每池由舊到新、不可跳批;開出的卡直接進卡包,卡包空位不足 ' + CARD_BAG.batchNeed + ' 張時停下。酒令只在從卡包任用時花。</div>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  return h + cuLastHtml();
}
function cuNamedHtml(cs) {
  var h = '', fac = cu.nmode === 'fac', tk = cs.nameTokens | 0, b = cs.cur.G, list, canDraw, full = cs.bag.length + CARD_BAG.batchNeed > cardsBagCap();
  cuNamedCss();
  if (!cardsNamedOpen()) return '<div class="cur"><span>指名尚未開放(需研發對應科技)</span></div>';
  h += '<div class="cur"><span>持有指名券 <b>🎫 ' + tk + '</b></span><span class="cusub">已指名 ' + (cs.namedCount | 0) + ' 次 · 保底 ' + Math.min(cs.pity.G, CARD_CFG.pityBatches) + '/' + CARD_CFG.pityBatches + '</span></div>';
  h += '<div class="cusub">每次消耗 1 券,出一批 7 張直接進卡包;每 10 次至少 1 位紫以上。指名券來源:完成里程碑、官階晉升。</div>';
  h += cuBagLine(cs);
  h += '<div class="cuchips"><button class="cub' + (fac ? ' on' : '') + '" data-a="nmode" data-m="fac">陣營</button><button class="cub' + (fac ? '' : ' on') + '" data-a="nmode" data-m="row">職業分類</button></div>';
  list = fac ? CARD_FAC.map(function (n, i) { return [i, n]; }) : CARD_ROWS.map(function (n) { return [n, n]; });
  h += '<div class="cuchips">' + list.map(function (e) { return '<button class="cub' + (cu.nkey === e[0] ? ' on' : '') + '" data-a="nkey" data-k="' + e[0] + '">' + cuEsc(e[1]) + '</button>'; }).join('') + '</div>';
  h += '<div class="cusub">' + (fac ? '指定陣營:該陣營的人物,金 / 紫檔可能出現該陣營名人(重複者化為信物)。' : '指定職業分類:主職業取自該分類;不出名人。') + '</div>';
  canDraw = !b && tk >= 1 && !full;
  if (!b) h += '<button class="cub" data-a="ndraw"' + (canDraw ? '' : ' disabled') + '>招募一次(消耗 1 券)</button>';
  if (!b && full) h += '<div class="cuwarn">卡包空位不足 ' + CARD_BAG.batchNeed + ' 張,先熔鍊或任用卡包裡的人(不會扣券)。</div>';
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
  cu.msg = first ? '沒有待開的批次' : '已全部開啟';
  cardsUiRender();
}
function cuNamedClick(a, b, cs) {
  var r, k;
  if (a === 'chainall') { cu.chain = true; cu.tab = 'O'; cuChainRun(true); return true; }
  if (a === 'nmode') { cu.nmode = b.getAttribute('data-m') === 'row' ? 'row' : 'fac'; cu.nkey = cu.nmode === 'fac' ? 0 : CARD_ROWS[0]; return true; }
  if (a === 'nkey') { k = b.getAttribute('data-k'); cu.nkey = cu.nmode === 'fac' ? +k : k; return true; }
  if (a === 'ndraw') {
    r = cardsNamedDraw(cs, cu.nmode, cu.nkey);
    if (!r.ok) { cu.msg = CU_NAMED_MSG[r.reason] || '無法招募'; if (typeof showToast === 'function') showToast(cu.msg); cuSave(); return true; }
    cuSave();
    cuRevealThen(r.batch.cands, function () {
      cuFinishBatch('G', '指名', true);
      if (cu.open) cardsUiRender();
    });
    return true;
  }
  return false;
}
