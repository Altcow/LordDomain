// js/cardsui_named.js — 招募介面合併(PLAN_INTERIORS I0):『總覽』(次數錢包 + 各池單抽 / 連抽 + 頭目贈抽任務)與『指名』(指定池:選陣營或職業分類,消耗指名券)兩個分頁。開批的卡直接加入名冊,名冊滿了先放卡包(cardsui_bag.js)。
// 掛在 cardsui.js(cuOverviewHtml / cuNamedHtml / cuNamedClick / cuChainRun 由其 typeof 守衛呼叫)。引擎在 cards.js(cardsNamedDraw 等)。不發聲、不推播。ES2017;不用 ?. ??。
// 全域名稱:cuOverviewHtml cuNamedHtml cuNamedClick cuBossHtml cuBossList cuBossNext
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
// 頭目首通贈抽任務(bn_stages.js 各章第 6 關):compact = 只列下一個未領的一行;否則六章全列(領過打勾)
function cuBossList() { return (typeof BN_STAGES !== 'undefined') ? BN_STAGES.filter(function (st) { return st.boss; }) : []; }
function cuBossNext(cs) { var l = cuBossList(), i; for (i = 0; i < l.length; i++) if (!(cs.boss && cs.boss[l[i].id])) return l[i]; return null; }
function cuBossHtml(cs, compact) {
  var l = cuBossList(), P = CARD_BOSS.pulls, nx = cuBossNext(cs), h;
  if (!l.length) return '';
  if (compact) return nx ? '<div class="cusub">任務:首次通關第 ' + nx.ch + ' 章頭目〈' + cuEsc(nx.name) + '〉→ +' + P + ' 抽</div>' : '<div class="cusub">各章頭目首通贈抽已全數領取</div>';
  h = '<div class="cuov"><div class="cur"><b>任務 · 頭目贈抽</b><span class="cusub">每章頭目首次通關 +' + P + ' 抽</span></div>';
  l.forEach(function (st) {
    var got = !!(cs.boss && cs.boss[st.id]);
    h += '<div class="cur"><span>' + (got ? '✅ ' : '⬜ ') + '第 ' + st.ch + ' 章頭目〈' + cuEsc(st.name) + '〉</span><span class="cusub">' + (got ? '已領 +' + P + ' 抽' : '+' + P + ' 抽') + '</span></div>';
  });
  return h + '</div>';
}
function cuOverviewHtml(cs) {
  var h = '';
  cuNamedCss();
  if (typeof cuStarterBanner === 'function') h += cuStarterBanner(cs) + cuNbLine(cs);   // 新手禮包入口 / 新手期(cardsui_starter.js)
  if (typeof cuRosterLine === 'function') h += cuRosterLine(cs);   // 名冊 n/名額、滿額提示(cardsui_starter.js)
  h += '<div class="cur"><span>碎片 <b>' + (cs.shards | 0) + '</b></span><span>指名券 <b>🎫 ' + (cs.nameTokens | 0) + '</b></span></div>';
  h += cuPullsHtml(cs);
  if (cs.bag.length || cs.bagOver) h += cuBagLine(cs);
  ['T', 'E'].forEach(function (v) {
    var V = CARD_VENUES[v], open = cardsVenueOpen(v), cur = cs.cur[v] ? 1 : 0;
    if (!open) { h += '<div class="cuov"><b>' + V.name + '</b> <span class="cusub">' + cuEsc(cuGateTxt(v).replace(V.name, '')) + '</span></div>'; return; }
    h += '<div class="cuov"><div class="cur"><b>' + V.name + '</b><span class="cusub">' + (v === 'T' ? '白青藍' : '白至紫') + (cur ? ' · 開啟中' : '') + '</span></div>' +
      '<div class="cusub">保底 ' + Math.min(cs.pity[v] | 0, CARD_DRAW.pity) + '/' + CARD_DRAW.pity + '</div>' + ((typeof cuPityLine === 'function') ? cuPityLine(cs, v) : '') + cuPullBtns(cs, v) + '</div>';
  });
  h += '<div class="cuov"><div class="cur"><b>指名</b><span class="cusub">不靠次數,消耗指名券 · 白至金</span></div><div class="cur"><span>' +
    (cardsNamedOpen(cs) ? '持有 <b>🎫 ' + (cs.nameTokens | 0) + '</b> · 已指名 ' + (cs.namedCount | 0) + ' 次' : cuEsc(cuGateTxt('G').replace(CARD_VENUES.G.name, '指名卡池'))) + '</span>' +
    '<button class="cub" data-a="tab" data-t="N" style="margin:0">前往</button></div></div>';
  h += cuBossHtml(cs, false);
  h += '<div class="cusub">抽到的人直接加入名冊,名冊滿了先放卡包(卡包也滿了進溢出區,24 小時);名冊、卡包、溢出區空位用完時會先停下,不扣次數。</div>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  return h + cuLastHtml();
}
function cuNamedHtml(cs) {
  var h = '', fac = cu.nmode === 'fac', tk = cs.nameTokens | 0, b = cs.cur.G, list, canDraw, full = !cardsBagCanOpen(cs);
  cuNamedCss();
  if (!cardsNamedOpen(cs)) return '<div class="cur"><span>' + cuEsc(cuGateTxt('G').replace(CARD_VENUES.G.name, '指名卡池')) + '</span></div>';
  h += '<div class="cur"><span>持有指名券 <b>🎫 ' + tk + '</b></span><span class="cusub">已指名 ' + (cs.namedCount | 0) + ' 次 · 保底 ' + Math.min(cs.pity.G, CARD_CFG.pityBatches) + '/' + CARD_CFG.pityBatches + '</span></div>';
  h += '<div class="cusub">每次消耗 1 券,一次出 ' + CARD_VENUES.G.batch + ' 張直接加入名冊(名冊滿了先放卡包);每 ' + (CARD_CFG.pityBatches + 1) + ' 次至少 1 位紫以上。指名券來源:新手禮包、完成里程碑、官階晉升、碎片兌換。' + (cardsVenueOpen('G') ? '' : '(目前用的是新手禮包的指名券,研發對應科技後才會一直開放。)') + '</div>';
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
function cuNamedClick(a, b, cs) {
  var r, k;
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
