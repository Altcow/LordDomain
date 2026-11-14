// js/ld_open_cards.js — 開場抽卡規則(設計_開場解鎖_預約_活動_定案.md 2.4 / 卡 4;純資料邏輯,無 DOM)。前綴 cards。
// 掛點在 cards.js(cardsGenBatch / cardsBagCommit):存在才呼叫。只在旗標 ldui 開啟、且不是舊存檔(unlock.legacy)時生效(@DORMANT ldui)。
//   cardsFirstTen:存檔的第一次十連固定含 1 金 + 2 紫名人(隨機),其餘照新手期機率;用 cs.starter.ft 記「已用掉」(cardsOpenBatch 寫入)。
//   cardsOpenMeltFig:白 / 藍名人(品階 ≤ 藍)同名第 3 張起抽到即熔成碎片;紫、金名人永不自動熔。
// ES2017;不用 ?. ??。

function cardsOpenNew() { return typeof unlockOn === 'function' && unlockOn() && typeof unlockRead === 'function' && !unlockRead().legacy; }
// 從名人池挑 1 位(gr 品階),避開已擁有與本批已出現者(都沒有就退回整池)
function cardsOpenFig(cs, r, gr, venue, slot, seen) {
  var pool = cardsFigPool(gr), free = pool.filter(function (f) { return !seen[f.id] && !cardsFindFig(cs, f.id); });
  if (free.length) pool = free;
  return cardFromFig(cardWPick(r, pool, cardFigWeight), venue, slot);
}
// 回 true = 已套用(cands 直接被改);第一次十連才會 true
function cardsFirstTen(cs, venue, key, size, cands) {
  var seen = {}, gold = 0, pur = 0, i, c, r;
  if (venue !== 'E' || size !== 10 || cands.length !== 10 || !cs.starter || cs.starter.ft || !cardsOpenNew()) return false;
  cands.forEach(function (x) { if (x.fig) seen[x.fig] = 1; if (x.gr >= 4) gold++; else if (x.gr === 3) pur++; });
  for (i = 0; i < cands.length && gold < 1; i++) {   // 補 1 金:換掉第一張非紫非金的
    if (cands[i].gr >= 3) continue;
    c = cardsOpenFig(cs, cardRng(cardHash(cs.seed, venue, key, i, 'ft4')), 4, venue, i, seen);
    cands[i] = c; seen[c.fig] = 1; gold++;
  }
  for (i = 0; i < cands.length && pur < 2; i++) {   // 補到 2 紫:換掉非紫非金的
    if (cands[i].gr >= 3) continue;
    c = cardsOpenFig(cs, cardRng(cardHash(cs.seed, venue, key, i, 'ft3')), 3, venue, i, seen);
    cands[i] = c; seen[c.fig] = 1; pur++;
  }
  return true;
}
function cardsOpenMeltFig(cs, c) {
  if (!c || !c.fig || c.gr > 2 || !cardsOpenNew()) return false;
  return cardsFigCount(cs, c.fig) >= 2;
}
