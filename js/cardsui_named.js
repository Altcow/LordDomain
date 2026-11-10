// js/cardsui_named.js — 指名池邏輯(PLAN_INTERIORS I0 併入後):指名券招募的開批、結果標題與頭目首通贈抽任務資料。UI 組字在 cardsui_draw.js(cuDrawNamedHtml / cuBossHtml)。
// 引擎在 cards.js(cardsNamedDraw 等);按鈕動作 nmode / nkey / ndraw 由 cuNamedClick 處理(cardsui.js 點擊分派)。不發聲、不推播。ES2017;不用 ?. ??。
// 全域名稱:CU_NAMED_MSG cuNamedLabel cuBossList cuBossNext cuNamedClick
var CU_NAMED_MSG = { closed: '指定池尚未開放(需研發對應科技)', bad: '請先選擇陣營或職業分類', busy: '上一批還在開啟中', bagfull: '名冊已滿,先遣散或熔鍊幾張', ticket: '指名券不足' };

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
