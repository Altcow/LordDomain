// js/cardsui_named.js — 招募介面合併(PLAN_INTERIORS I0):『總覽』(三池一覽 + 全部翻閱)與『指名』(指定池:選陣營或職業分類,消耗指名券)兩個分頁。
// 掛在 cardsui.js(cuOverviewHtml / cuNamedHtml / cuNamedClick / cuChainNext 由其 typeof 守衛呼叫)。引擎在 cards.js(cardsNamedDraw 等)。不發聲、不推播。ES2017;不用 ?. ??。
// 全域名稱:cuOverviewHtml cuNamedHtml cuNamedClick cuChainNext CU_CHAIN_ORDER
var CU_CHAIN_ORDER = ['G', 'E', 'T'];   // 全部翻閱順序:指定 → 縣試 → 酒館(G = 指定池的結果批次 cs.cur.G)
var CU_NAMED_MSG = { closed: '指定池尚未開放(需研發對應科技)', bad: '請先選擇陣營或職業分類', busy: '還有一批名帖未處理,請先延請或略過', ticket: '指名券不足' };

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
function cuPending(cs, v) {   // 該池待閱批次數(含手上未處理的一批)
  return (v === 'G' ? 0 : cs.acc[v].length) + (cs.cur[v] ? 1 : 0);
}
function cuOverviewHtml(cs) {
  var now = cuNow(), h = '', total = 0, ov;
  cuNamedCss();
  h += '<div class="cur"><span>持有酒令 <b>🎴 ' + cs.tok + '</b></span><span>指名券 <b>🎫 ' + (cs.nameTokens | 0) + '</b></span></div>';
  ['T', 'E'].forEach(function (v) {
    var V = CARD_VENUES[v], n = cs.acc[v].length, nx, open = cardsVenueOpen(v), cur = cs.cur[v] ? 1 : 0;
    total += open ? n + cur : cur;
    if (!open) { h += '<div class="cuov"><b>' + V.name + '</b> <span class="cusub">尚未開放(需研發對應科技)</span></div>'; return; }
    nx = cardsNextIn(cs, v, now);
    h += '<div class="cuov"><div class="cur"><b>' + V.name + '</b><span class="cusub">每 ' + V.unit + '一批 · ' + (v === 'T' ? '白青藍' : '白至紫') + '</span></div>' +
      '<div class="cur"><span>待閱 <b>' + n + '/' + V.cap + '</b> 批(約 ' + (n + cur) * V.batch + ' 人)' + (cur ? ' · 手上 1 批' : '') + '</span><span class="cusub">' +
      (nx === null ? '已滿' : '下一批 <span data-cd="' + v + '">' + cardsUiFmtCd(nx) + '</span>') + '</span></div>' +
      '<div class="cusub">保底 ' + Math.min(cs.pity[v], CARD_CFG.pityBatches) + '/' + CARD_CFG.pityBatches + '</div></div>';
  });
  total += cs.cur.G ? 1 : 0;
  h += '<div class="cuov"><div class="cur"><b>指名</b><span class="cusub">不靠計時,消耗指名券 · 白至金</span></div><div class="cur"><span>' +
    (cardsNamedOpen() ? '持有 <b>🎫 ' + (cs.nameTokens | 0) + '</b> · 已延請 ' + (cs.namedCount | 0) + ' 次' + (cs.cur.G ? ' · 手上 1 批' : '') : '尚未開放(需研發對應科技)') + '</span>' +
    '<button class="cub" data-a="tab" data-t="N" style="margin:0">前往</button></div></div>';
  h += '<button class="cub' + (total ? '' : '') + '" data-a="chainall"' + (total ? '' : ' disabled') + '>全部翻閱(' + total + ' 批)</button>';
  h += '<div class="cusub">順序:指名 → 縣試 → 酒館;每池由舊到新、不可跳批。名額與待定席都滿時請先到名冊請辭。</div>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  return h;
}
function cuNamedHtml(cs) {
  var h = '', fac = cu.nmode === 'fac', tk = cs.nameTokens | 0, b = cs.cur.G, list, canDraw;
  cuNamedCss();
  if (!cardsNamedOpen()) return '<div class="cur"><span>指名尚未開放(需研發對應科技)</span></div>';
  h += '<div class="cur"><span>持有指名券 <b>🎫 ' + tk + '</b></span><span class="cusub">已延請 ' + (cs.namedCount | 0) + ' 次 · 保底 ' + Math.min(cs.pity.G, CARD_CFG.pityBatches) + '/' + CARD_CFG.pityBatches + '</span></div>';
  h += '<div class="cusub">每次消耗 1 券,出一批 7 位名帖;每 10 次至少 1 位紫以上。指名券來源:完成里程碑、官階晉升。</div>';
  h += '<div class="cuchips"><button class="cub' + (fac ? ' on' : '') + '" data-a="nmode" data-m="fac">陣營</button><button class="cub' + (fac ? '' : ' on') + '" data-a="nmode" data-m="row">職業分類</button></div>';
  list = fac ? CARD_FAC.map(function (n, i) { return [i, n]; }) : CARD_ROWS.map(function (n) { return [n, n]; });
  h += '<div class="cuchips">' + list.map(function (e) { return '<button class="cub' + (cu.nkey === e[0] ? ' on' : '') + '" data-a="nkey" data-k="' + e[0] + '">' + cuEsc(e[1]) + '</button>'; }).join('') + '</div>';
  h += '<div class="cusub">' + (fac ? '指定陣營:該陣營的人物,金 / 紫檔可能出現該陣營名人(重複者化為信物)。' : '指定職業分類:主職業取自該分類;不出名人。') + '</div>';
  canDraw = !b && tk >= 1;
  if (!b) h += '<button class="cub" data-a="ndraw"' + (canDraw ? '' : ' disabled') + '>延請一次(消耗 1 券)</button>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  if (b) h += cuBatchHtml(cs, 'G', b);
  return h;
}
// 全部翻閱:找第一個有東西可看的池(手上有批次優先,否則由 acc 翻最舊一批),切到該分頁;都沒有就結束連翻回總覽
function cuChainNext(cs) {
  var i, v, tab;
  for (i = 0; i < CU_CHAIN_ORDER.length; i++) {
    v = CU_CHAIN_ORDER[i];
    if (!cs.cur[v] && v !== 'G' && cs.acc[v].length && cardsVenueOpen(v)) { cardsOpenBatch(cs, v); cuSave(); }
    if (cs.cur[v]) { cu.tab = v === 'G' ? 'N' : v; cu.detail = null; return true; }
  }
  cu.chain = false; cu.tab = 'O'; cu.msg = '已全部翻閱';
  return false;
}
function cuNamedClick(a, b, cs) {
  var r, k;
  if (a === 'chainall') { cu.chain = true; if (!cuChainNext(cs)) cu.msg = '沒有待閱的批次'; return true; }
  if (a === 'nmode') { cu.nmode = b.getAttribute('data-m') === 'row' ? 'row' : 'fac'; cu.nkey = cu.nmode === 'fac' ? 0 : CARD_ROWS[0]; return true; }
  if (a === 'nkey') { k = b.getAttribute('data-k'); cu.nkey = cu.nmode === 'fac' ? +k : k; return true; }
  if (a === 'ndraw') {
    r = cardsNamedDraw(cs, cu.nmode, cu.nkey);
    if (!r.ok) { cu.msg = CU_NAMED_MSG[r.reason] || '無法延請'; if (typeof showToast === 'function') showToast(cu.msg); }
    cuSave();
    return true;
  }
  return false;
}
