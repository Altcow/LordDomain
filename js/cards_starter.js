// js/cards_starter.js — 新手禮包與新手期抽卡加成(純資料邏輯,不寫 DOM;數值在 carddata.js CARD_STARTER)。介面在 js/cardsui_starter.js。
// 存檔:cs.starter = { done 0/1, at 領取時間(毫秒), left 未開批數, nt 禮包指名券剩餘(指名池未研發也可用), nb {n 新手期已抽張數, p 距上次紫以上張數, g 距上次金張數}, na 不適用(舊存檔), old 舊存檔待判定 }。
// 判定:全新世界(cardsStateNew)= 可領;舊存檔(讀檔時沒有 starter 欄,或沒有教學資料的城)第一次查詢時判定 —— 已有卡片或已畢業教學 = 不適用、不補發。
// 禮包的卡:確定性(種子 = cs.seed),分 CARD_STARTER.batches 批放進 cs.cur.G(待入包批次,沿用抽卡特效 → cardsBagCommit:先進名冊、滿了放卡包;不自動熔爐、不動任何保底計數)。
// 全域名稱:cardsStarterNorm cardsStarterState cardsStarterClaim cardsStarterCards cardsStarterStage cardsStarterHint cardsNbOn cardsNbPity cardsNbCount cardsNbLeft。ES2017;不用 ?. ??。

function cardsStarterNorm(v) {
  var S = CARD_STARTER, o, k;
  if (!v || typeof v !== 'object') return { done: 0, old: 1 };
  o = { done: v.done ? 1 : 0 };
  if (!o.done) { if (v.na) o.na = 1; else if (v.old) o.old = 1; return o; }
  o.at = cardNum(v.at, 0, 1e15, 0);
  k = cardNum(v.left, 0, S.batches, 0) | 0; if (k) o.left = k;
  k = cardNum(v.nt, 0, S.namedTokens, 0) | 0; if (k) o.nt = k;
  if (v.nb && typeof v.nb === 'object') o.nb = { n: cardNum(v.nb.n, 0, 1e6, 0) | 0, p: cardNum(v.nb.p, 0, 1e6, 0) | 0, g: cardNum(v.nb.g, 0, 1e6, 0) | 0 };
  return o;
}
// 舊存檔是否不適用:已有卡片(名冊 / 待定 / 流浪 / 卡包 / 溢出區,或曾收入名冊 / 指名過)或已畢業教學(沒有教學資料也算已畢業)
function cardsStarterLegacyNa(cs) {
  var has = cs.roster.length || cs.wait.length || cs.wander.length || cs.bag.length || (cs.bagOver && cs.bagOver.length) || (cs.seq | 0) > 0 || (cs.namedCount | 0) > 0 || (cs.bagSeq | 0) > 0;
  if (has) return true;
  if (typeof tutHas === 'function' && (!tutHas() || (typeof tutGraduated === 'function' && tutGraduated()))) return true;
  return false;
}
// 回 'ready' 可領 / 'open' 已領、還有批次沒開 / 'done' 已領完 / 'na' 不適用
function cardsStarterState(cs) {
  var s;
  if (!cs) return 'na';
  s = cs.starter || (cs.starter = { done: 0, old: 1 });
  if (s.done) return (s.left | 0) > 0 ? 'open' : 'done';
  if (s.old) { delete s.old; if (cardsStarterLegacyNa(cs)) s.na = 1; }
  return s.na ? 'na' : 'ready';
}
// 領取:發指名券與抽卡次數(S.pulls)、記錄時間、開始新手期;抽到的直接進名冊。回 {ok, reason?, named, pulls}
function cardsStarterClaim(cs, now) {
  var S = CARD_STARTER, st = cardsStarterState(cs);
  if (st !== 'ready') return { ok: false, reason: st };
  cs.starter = { done: 1, at: (typeof now === 'number' && isFinite(now)) ? now : 0, nt: S.namedTokens, nb: { n: 0, p: 0, g: 0 } };   // 2026-11-09 起禮包直接送『抽卡次數』(S.pulls 抽,進 cs.pl.n,不受累積上限截斷);舊存檔留下的 left 批次仍可由 cardsStarterStage 開完
  cardsAddNameTokens(cs, S.namedTokens);
  cardsPullGrant(cs, S.pulls);
  return { ok: true, named: S.namedTokens, pulls: S.pulls };
}
// 金階名人:魔幻世界優先本族英雄;避開已擁有與禮包內已出現者(都沒有就退回整池)
function cardsStarterFig(cs, r, venue, slot, seen) {
  var pool = cardsFigPool(4), race = (typeof fxCardPack === 'function') ? fxCardPack() : null, own, free;
  own = race ? pool.filter(function (f) { return f.race === race; }) : pool;
  if (own.length) pool = own;
  free = pool.filter(function (f) { return !seen[f.id] && !cardsFindFig(cs, f.id); });
  if (free.length) pool = free;
  return cardFromFig(cardWPick(r, pool, cardFigWeight), venue, slot);
}
// 禮包全部卡片(確定性):回批次陣列 [[卡…], …]。先依 CARD_STARTER.gr 擲品階,再補保底:金放第 1 批、紫放第 2 批起
function cardsStarterCards(cs) {
  var S = CARD_STARTER, n = S.legacyPulls, per = Math.ceil(n / S.batches), gr = [], i, j, r, x, acc, g, b, lo, hi, k, need, out = [], seen = {}, c;
  for (i = 0; i < n; i++) {
    r = cardRng(cardHash(cs.seed, 'starter', i, 'gr')); x = r() * 100; acc = 0; g = 0;
    for (k = 0; k < 5; k++) { acc += S.gr[k]; if (x < acc) { g = k; break; } }
    gr.push(g);
  }
  function place(b0, want, tag) {   // 在第 b0 批找一格(雜湊起點,往後找品階低於 want 者)改成 want
    lo = b0 * per; hi = Math.min(n, lo + per);
    if (lo >= hi) { lo = 0; hi = Math.min(n, per); }
    k = cardHash(cs.seed, 'starter', tag) % (hi - lo);
    for (j = 0; j < hi - lo; j++) { i = lo + (k + j) % (hi - lo); if (gr[i] < want) { gr[i] = want; return; } }
  }
  need = S.goldGuarantee - gr.filter(function (v) { return v >= 4; }).length;
  for (j = 0; j < need; j++) place(j % S.batches, 4, 'g' + j);
  need = S.purpleGuarantee - gr.filter(function (v) { return v === 3; }).length;
  for (b = 0; b < need; b++) place((1 + b) % S.batches, 3, 'p' + b);
  for (i = 0; i < n; i++) {
    b = Math.floor(i / per);
    if (!out[b]) out[b] = [];
    r = cardRng(cardHash(cs.seed, 'starter', i, 'fig'));
    if (gr[i] >= 4) c = cardsStarterFig(cs, r, 'G', i - b * per, seen);
    else {
      c = cardGen(cs, 'G', 'G:' + (-1 - b), i - b * per, gr[i], 'starter' + i);
      if (c.fig && (seen[c.fig] || cardsFindFig(cs, c.fig))) c = cardGen(cs, 'G', 'G:' + (-1 - b), i - b * per, gr[i], 'starter' + i + '|nf', { noFig: true });   // 紫階名人重複 → 換路人紫,保住紫卡張數
    }
    if (c.fig) seen[c.fig] = 1;
    out[b].push(c);
  }
  return out;
}
// 開禮包的下一批(放進 cs.cur.G,之後走抽卡特效與 cardsBagCommit(cs, 'G'))。reason:none 沒有未開批 busy 上一批尚未入包 bagfull 卡包空位不足
function cardsStarterStage(cs) {
  var S = CARD_STARTER, idx, cards, b;
  if (cardsStarterState(cs) !== 'open') return { ok: false, reason: 'none' };
  if (cs.cur.G) return { ok: false, reason: 'busy' };
  if (!cardsBagCanOpen(cs)) return { ok: false, reason: 'bagfull' };
  idx = S.batches - (cs.starter.left | 0);
  cards = cardsStarterCards(cs)[idx] || [];
  if (!cards.length) { cs.starter.left = 0; return { ok: false, reason: 'none' }; }
  b = { key: 'G:' + (-1 - idx), venue: 'G', cands: cards, hasUpper: cards.some(function (c) { return c.gr >= 3; }), pityHit: false, starter: idx + 1, noAuto: true };
  b.taken = cards.map(function () { return 0; });
  cs.starter.left = (cs.starter.left | 0) - 1;
  if (!cs.starter.left) delete cs.starter.left;
  cs.cur.G = b;
  return { ok: true, batch: b, cards: cards, no: idx + 1, of: S.batches };
}
// 教學畢業掛點(tutorial.js tutGrad):禮包可領時提示一次
function cardsStarterHint() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null;
  if (!cs || cardsStarterState(cs) !== 'ready') return false;
  if (typeof showToast === 'function') showToast('新手禮包已備好:打開側欄〈卡包〉就能領(' + CARD_STARTER.pulls + ' 抽,保底 1 張金卡)');
  return true;
}

// ───────── 新手期(領取禮包後前 nbCards 張酒館 / 縣試卡)─────────
function cardsNbOn(cs, venue) {
  var s = cs && cs.starter;
  return (venue === 'T' || venue === 'E') && !!(s && s.done && s.nb && s.nb.n < CARD_STARTER.nbCards);
}
// 新手期剩餘張數(UI 用;不在新手期回 0)
function cardsNbLeft(cs) { var s = cs && cs.starter; return (s && s.done && s.nb) ? Math.max(0, CARD_STARTER.nbCards - s.nb.n) : 0; }
// 逐張保底:連續 nbGold − 1 張沒有金 → 這張換成金(名人);否則連續 nbPurple − 1 張沒有紫以上 → 這張換成紫。直接改 cands(cardsGenBatch 內呼叫,不改 cs)
function cardsNbPity(cs, venue, key, cands) {
  var S = CARD_STARTER, nb = cs.starter.nb, p = nb.p | 0, g = nb.g | 0, i, c;
  for (i = 0; i < cands.length; i++) {
    c = cands[i];
    if (c.gr < 4 && g + 1 >= S.nbGold) c = cands[i] = cardsStarterFig(cs, cardRng(cardHash(cs.seed, venue, key, i, 'nbg')), venue, i, {});
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
