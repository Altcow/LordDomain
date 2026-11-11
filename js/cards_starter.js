// js/cards_starter.js — 補償與新手期(純資料邏輯,不寫 DOM;數值在 carddata.js CARD_GIFT / CARD_STARTER)。介面在 js/cardsui_starter.js、js/cardsui_draw.js。
// 2026-11-11(v59):新手禮包『領取』流程與禮包批次(cur.G、三批開批)已刪除。v60 起禮包為道具『新手禮包』(items.js),需到卡包的道具頁籤點『使用』才入大池(CARD_GIFT.pulls 抽,E 池,不受上限截斷)。
//   抽到的卡與抽卡一樣入冊(cardsBagCommit);禮包使用只加次數,不動保底計數。
// 存檔:cs.gift200 = 禮包版本字串(與道具鍵的 gv 同步,發放以道具鍵為準,見 items.js itemGiftGrant);cs.starter = { done 0/1, at 開局時間, nb {n 新手期已抽張數, p 距上次紫以上張數, g 距上次金張數} }。
//   已停用欄位:gift200Msg(舊版待顯示的補償 toast,已無寫入端;讀入仍保留,不影響功能)。
// 全域名稱:cardsStarterNorm cardsGiftCheck cardsStarterFig cardsNbOn cardsNbLeft cardsNbPity cardsNbCount。ES2017;不用 ?. ??。

function cardsStarterNorm(v) {
  var o = { done: (v && v.done) ? 1 : 0 }, k;
  if (!v || typeof v !== 'object') return o;
  o.at = cardNum(v.at, 0, 1e15, 0);
  if (v.nb && typeof v.nb === 'object') o.nb = { n: cardNum(v.nb.n, 0, 1e6, 0) | 0, p: cardNum(v.nb.p, 0, 1e6, 0) | 0, g: cardNum(v.nb.g, 0, 1e6, 0) | 0 };
  return o;
}
// 新手禮包(道具化,v60):cs.gift200 ≠ CARD_GIFT.ver → itemGiftGrant(ver)(js/items.js)在道具鍵同一次寫入內發『新手禮包』、記發放版本 gv、設進遊戲提示;再同步 cs.gift200 與新手期。
// 發放以道具鍵的 gv 為準:道具已寫入但卡片存檔未落盤(重開)時不會重發,只補同步 cs 旗標。不直接加抽數;玩家在卡包的道具頁籤點『使用』才入大池(items.js itemUse 讀 CARD_GIFT.pulls)。道具系統未載入時不發、不設旗標。
// 新開世界 / 重啟(沒有卡、沒有開過卡)才重開新手期計數;已在玩的帳號保留既有新手期計數。回 1 = 本次發了禮包,0 = 已發過 / 未發。
function cardsGiftCheck(cs) {
  var G = CARD_GIFT, fresh, got;
  if (!cs || cs.gift200 === G.ver) return 0;
  if (typeof worldReadyFlag === 'undefined' || !worldReadyFlag) return 0;   // 世界尚未載入(開機前的占位狀態):不發、不存檔,免得把占位狀態寫進 save.v1 蓋掉真存檔
  if (typeof itemGiftGrant !== 'function') return 0;
  got = itemGiftGrant(G.ver);
  if (got < 0) return 0;
  fresh = !(cs.seq | 0) && !(cs.roster && cs.roster.length);
  cs.gift200 = G.ver;
  if (fresh || !cs.starter) cs.starter = { done: 1, at: (cs.clock && cs.clock.maxSeen) || 0, nb: { n: 0, p: 0, g: 0 } };
  else cs.starter.done = 1;
  if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 存檔失敗不影響禮包 */ } }
  return got;
}
// 金階名人:魔幻世界優先本族英雄;避開已擁有與本批已出現者(都沒有就退回整池)
function cardsStarterFig(cs, r, venue, slot, seen) {
  var pool = cardsFigPool(4), race = (typeof fxCardPack === 'function') ? fxCardPack() : null, own, free;
  own = race ? pool.filter(function (f) { return f.race === race; }) : pool;
  if (own.length) pool = own;
  free = pool.filter(function (f) { return !seen[f.id] && !cardsFindFig(cs, f.id); });
  if (free.length) pool = free;
  return cardFromFig(cardWPick(r, pool, cardFigWeight), venue, slot);
}
// 新手期(開局 / 重啟後的前 nbCards 張小池 / 大池卡)
function cardsNbOn(cs, venue) {
  var s = cs && cs.starter;
  return (venue === 'T' || venue === 'E') && !!(s && s.done && s.nb && s.nb.n < CARD_STARTER.nbCards);
}
// 新手期剩餘張數(UI 用;不在新手期回 0)
function cardsNbLeft(cs) { var s = cs && cs.starter; return (s && s.done && s.nb) ? Math.max(0, CARD_STARTER.nbCards - s.nb.n) : 0; }
// 逐張保底:大池連續 nbGold − 1 張沒有金 → 這張換成金(名人);連續 nbPurple − 1 張沒有紫以上 → 這張換成紫(小池 / 大池)。小池不出金,不套金保底。直接改 cands(cardsGenBatch 內呼叫,不改 cs)
function cardsNbPity(cs, venue, key, cands) {
  var S = CARD_STARTER, nb = cs.starter.nb, p = nb.p | 0, g = nb.g | 0, i, c;
  for (i = 0; i < cands.length; i++) {
    c = cands[i];
    if (venue === 'E' && c.gr < 4 && g + 1 >= S.nbGold) c = cands[i] = cardsStarterFig(cs, cardRng(cardHash(cs.seed, venue, key, i, 'nbg')), venue, i, {});
    else if (c.gr < 3 && p + 1 >= S.nbPurple) c = cands[i] = cardGen(cs, venue, key, i, 3, 'nbp');
    g = c.gr >= 4 ? 0 : g + 1; p = c.gr >= 3 ? 0 : p + 1;
  }
}
// 本批之後的新手期計數(以最終 cands 計;cardsOpenBatch 寫回 cs.starter.nb)
function cardsNbCount(cs, cands) {
  var nb = cs.starter.nb, p = nb.p | 0, g = nb.g | 0;
  cands.forEach(function (c) { g = c.gr >= 4 ? 0 : g + 1; p = c.gr >= 3 ? 0 : p + 1; });
  return { n: (nb.n | 0) + cands.length, p: p, g: g };
}
