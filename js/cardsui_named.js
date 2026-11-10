// js/cardsui_named.js — 指名池邏輯(PLAN_INTERIORS I0 併入後):指名券招募的開批(單抽 / 10 抽 / 全抽連開)、結果標題與頭目首通贈抽任務資料。UI 組字在 cardsui_draw.js(cuBossHtml、指名選擇 pop)。
// 引擎在 cards.js(cardsNamedDraw 等);按鈕動作 nmode / nkey(選擇 pop)、ndraw(單抽)、nrun(10 抽 / 全抽)由 cuNamedClick 處理(cardsui.js 點擊分派)。不發聲、不推播。ES2017;不用 ?. ??。
// 全域名稱:CU_NAMED_MSG cuNamedLabel cuBossList cuBossNext cuNamedClick cuNamedRun
var CU_NAMED_MSG = { closed: '指定池尚未開放', bad: '請先選擇陣營或職業分類', busy: '上一批還在開啟中', bagfull: '名冊已滿,先遣散或熔鍊幾張', ticket: '指名券不足' };

// 結果批次標題:指名批次(b.named)顯示「指名 · 陣營 / 職業分類」,舊殿試批次顯示原期鍵
function cuNamedLabel(b) {
  var nm = b && b.named;
  if (!nm) return '名帖 · ' + b.key + '(舊殿試)';
  return '指名 · ' + (nm.mode === 'fac' ? '陣營 ' + (CARD_FAC[nm.key] || '') : '職業分類 ' + nm.key) + ' · 第 ' + ((parseInt(String(b.key).slice(2), 10) | 0) + 1) + ' 次';
}
// 頭目首通贈抽任務(bn_stages.js 各章第 6 關):compact = 只列下一個未領的一行;否則六章全列(領過打勾)
function cuBossList() { return (typeof BN_STAGES !== 'undefined') ? BN_STAGES.filter(function (st) { return st.boss; }) : []; }
function cuBossNext(cs) { var l = cuBossList(), i; for (i = 0; i < l.length; i++) if (!(cs.boss && cs.boss[l[i].id])) return l[i]; return null; }
function cuNamedClick(a, b, cs) {
  var k;
  if (a === 'nmode') { cu.nmode = b.getAttribute('data-m') === 'row' ? 'row' : 'fac'; cu.nkey = cu.nmode === 'fac' ? cardsFacList()[0] : CARD_ROWS[0]; return true; }
  if (a === 'nkey') { k = b.getAttribute('data-k'); cu.nkey = cu.nmode === 'fac' ? +k : k; return true; }
  if (a === 'ndraw') { cu.skipAll = false; cuNamedRun(1, true); return true; }   // 單抽:1 券、1 批
  if (a === 'nrun') {   // 10 抽 / 全抽:每批 1 券、逐批播完整特效(按『全部跳過』後剩餘批次 quick)
    cu.skipAll = false;
    k = b.getAttribute('data-n');
    cuNamedRun(k === 'all' ? (cs.nameTokens | 0) : (parseInt(k, 10) | 0), true);
    return true;
  }
  return false;
}
// 指名連抽:left 次(每次扣 1 券、出 1 批)。與 cardsui.js cuPullRun 同一套鏈式流程;first = 本鏈第一批(快照摘要從這裡起算)
function cuNamedRun(left, first) {
  var cs = cardsGet(), r, more;
  if (!cs) return;
  if (first) left = Math.max(1, Math.min(left, cs.nameTokens | 0));   // 券不足時至少送一次,由 cardsNamedDraw 回 ticket 訊息
  if (left < 1 || (!first && !cu.open)) { if (cu.open) cardsUiRender(); return; }
  r = cardsNamedDraw(cs, cu.nmode, cu.nkey);
  if (!r.ok) {
    cu.msg = CU_NAMED_MSG[r.reason] || '無法招募';
    if (typeof showToast === 'function') showToast(cu.msg);
    cuNamedEnd(!first);
    return;
  }
  cuSave();
  more = left - 1 > 0 && (cs.nameTokens | 0) > 0;
  cu.chain = more;
  cuRevealThen(r.batch.cands, function () {
    var res = cuFinishBatch('G', '指名', first);
    if (more && cardsGet() && (cardsGet().nameTokens | 0) > 0) { cuNamedRun(left - 1, false); return; }
    cuNamedEnd(!first, res);
  }, cu.skipAll, { more: more, onSkipAll: function () { cu.skipAll = true; } });
}
// 指名收尾:連抽(chained)彙整摘要提示;單抽(res = 本批入冊結果)提示該批;重畫面板
function cuNamedEnd(chained, res) {
  var L = cu.last;
  cu.chain = false;
  if (typeof cuJoinToast === 'function') {
    if (chained && L) cuJoinToast({ roster: L.roster, full: L.full, dissolved: L.dissolved, tokenN: L.tokenN });
    else if (!chained && res) cuJoinToast(res);
  }
  if (cu.open) cardsUiRender();
}
