// js/cardsui_bag.js — 卡包人物的升星(cuStarHtml)。2026-11-11:碎片兌換指名券已移除(指名券刪除);碎片換抽數預留下一批。卡包列表在 cardsui_roster.js,熔鍊在熔爐分頁(cardsui_furnace.js)。
// 碎片用途:(1)卡包詳情『強化(升星)』(cuStarHtml,動作 starup)(2)請回流浪名人。
// 掛在 cardsui.js(cuStarHtml 由 typeof 守衛呼叫;cuBagClick 由 cuClick 呼叫)。引擎在 cards.js(cardsStar*)。不發聲、不推播。ES2017;不用 ?. ??。
// 全域名稱:cuStarHtml cuBagClick CU_BAG_MSG
var CU_BAG_MSG = { fig: '名人需在詳情頁手動熔鍊(二次確認)', locked: '派駐中或已鎖定的人員不能熔鍊,請先卸任或解除鎖定', none: '此人已不在卡包', full: '卡包已滿,先遣散一人' };

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
  var r;
  if (a === 'starup') {
    r = cardsStarUp(cs, b.getAttribute('data-id'));
    cu.msg = r.ok ? '升至 ' + r.lv + ' 星(花 ' + r.cost + ' 碎)' : (r.reason === 'max' ? '已達最高星' : r.reason === 'shards' ? '碎片不足(需 ' + r.need + ')' : '無法升星');
    if (r.ok) cuSave();
    return true;
  }
  return false;
}
