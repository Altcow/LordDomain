// js/cards.js — 卡牌與酒館引擎 第一階段(PLAN_CARDS.md v3:§2.2~2.6 三場所/招募歲鐘/品階機率與保底/名額、§3A 品階與升階、§4.13 職業詞條、§7A 名額與請辭;第四批決議:開批的卡直接進卡包 cs.bag、酒令 = 任用成本、名人加權抽取)。
// 純資料邏輯,不寫 DOM;時間一律由呼叫端傳入 now(毫秒),模擬層不讀 Date.now()。資料表在 js/carddata.js,介面在 js/cardsui.js。
// 存檔:world.city.cards(goods.js goodsNormCity 帶過 cardsNormSave);名冊 roster 即派工用的 world.city.talents(同一批物件,不可列舉,不重複存檔)。
// 第一階段刻意未做:名冊人物/小兵卡/人物圈、取捨詞條 §4.4A、戰場技能內容(只記數量 skn)、記名簿、快速模式、文鬥小遊戲(星數固定 1)、結義。
// 全域名稱:cardsSkillList cardHash cardRng cardsStateNew cardsGet cardsNormSave cardsPeriodNo cardsSync cardsNextIn cardsVenueOpen cardsVenueTheme cardsGenBatch cardsOpenBatch
//          cardsDiscardBatch cardsCost cardsCap cardsClaimGift cardsRelease cardsUndoRelease cardsRecall cardsUpgradeCheck cardsUpgrade cardsStats cardsJobSlots
//          cardsGenNamed cardsNamedDraw cardsNamedOpen cardsAddNameTokens cardsNamedGive cardsNamedRankCheck cardsNamedTick cardsNamedKeyOk
//          cardsBagCap cardsBagRoom cardsBagAutoLv cardsBagSetAuto cardsBagStage cardsBagCommit cardsBagOpen cardsBagFlush cardsBagPut cardsBagFind cardsBagList cardsBagPick cardsBagEnlist
//          cardsBagDissolve cardsBagDissolveValue cardsBagFeed cardsShardGain cardFigWeight
//          cardsFind cardsSyncTalents cardsTalents cardsPatrolTalents cardsAccept cardsJobLine cardsAddTokens cardsOnTechDone cardsRankLv CARD_PIN

var CARD_PIN = ['上上', '上中', '上下', '中上', '中中', '中下', '下上', '下中', '下下'];
var CARD_RECALL_COST = 10;

// ───────── 確定性亂數 ─────────
function cardHash() {
  var s = Array.prototype.join.call(arguments, '|'), h = 2166136261, i;
  for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return h >>> 0;
}
function cardRng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function cardRint(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
function cardWPick(r, items, wf) {
  var tot = 0, i, w, x;
  for (i = 0; i < items.length; i++) tot += Math.max(0, wf(items[i]));
  if (tot <= 0) return items[Math.floor(r() * items.length)];
  x = r() * tot;
  for (i = 0; i < items.length; i++) { w = Math.max(0, wf(items[i])); if (x < w) return items[i]; x -= w; }
  return items[items.length - 1];
}

// ───────── 狀態 ─────────
function cardsStateNew(seed) {
  var s = (typeof seed === 'number' && isFinite(seed)) ? (seed >>> 0) : ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0);
  return {
    v: 1, seed: s, seq: 0, tok: CARD_WINE.startGift, nameTokens: 0, namedCount: 0, shards: 0, shardWk: { w: -1, n: 0 }, gift: { day: -1 },
    clock: { maxSeen: 0 }, tokenGiven: {}, last: { T: -1, E: -1, G: -1 }, acc: { T: [], E: [], G: [] }, cur: { T: null, E: null, G: null },
    pity: { T: 0, E: 0, G: 0 }, fame: { G: 0, E: 0 }, stars: { E: 1 }, roster: [], wait: [], wander: [], bag: [], lastRel: null
  };
}
function cardsGet() {
  var c = null;
  if (typeof goodsCity === 'function') c = goodsCity();
  else if (typeof world !== 'undefined' && world) c = world.city;
  if (!c) return null;
  if (!c.cards) c.cards = cardsStateNew();
  return c.cards;
}
function cardsAddTokens(cs, n) { cs.tok = Math.max(0, cs.tok + (n | 0)); return cs.tok; }
// 科技 / 里程碑完成發酒令(citytech.js 的 techFinish、techBigDone 呼叫):每節點只發一次(cs.tokenGiven);遷移出來的已研科技不走此路,不補發。回發放數
function cardsOnTechDone(id, big) {
  var cs = cardsGet(), g, node, n, name;
  if (!cs || !id) return 0;
  g = cs.tokenGiven || (cs.tokenGiven = {});
  if (g[id]) return 0;
  node = (typeof techNode === 'function') ? techNode(id) : null;
  big = !!big || String(id).indexOf('mg_') === 0;
  n = big ? CARD_WINE.mileGift : ((node && node.era >= CARD_WINE.techGiftEra) ? CARD_WINE.techGiftHi : CARD_WINE.techGift);
  g[id] = 1;
  cardsAddTokens(cs, n);
  if (big) cardsNamedGive(cs, id, '完成里程碑');   // 指名券占位來源:里程碑 +1(與酒令同為每節點一次)
  name = (node && node.name) || id;
  if (typeof showToast === 'function') showToast('研成〈' + name + '〉,得酒令 +' + n);
  return n;
}

// ───────── 招募歲鐘(§2.4) ─────────
function cardsTz(now) { return new Date(now).getTimezoneOffset() * 60000; }
function cardsPeriodNo(venue, now) { return Math.floor((now - cardsTz(now)) / CARD_VENUES[venue].periodMs); }
function cardsKey(venue, n) { return venue + ':' + n; }
function cardsKeyNo(key) { return parseInt(String(key).slice(2), 10); }
function cardsVenueOpen(venue) {
  var g = CARD_VENUES[venue] && CARD_VENUES[venue].gate, r;
  if (g && typeof nlFeatureOpen === 'function') { r = nlFeatureOpen(g); if (r !== null && r !== undefined) return !!r; }
  return true;
}
// 累積批次:回 {frozen, added}。isOpen(venue) 可選;未開放的場所不產生(開放當下的期鍵算第 1 批)
function cardsSync(cs, now, isOpen) {
  var floor = cs.clock.maxSeen - CARD_CFG.paceMin * 60000, added = 0, res = { frozen: false, added: 0 };
  if (cs.clock.maxSeen > 0 && now < floor) { res.frozen = true; return res; }
  if (now > cs.clock.maxSeen) cs.clock.maxSeen = now;
  CARD_VENUE_ORDER.forEach(function (v) {
    var V = CARD_VENUES[v], n, last, room, k, i;
    if (isOpen && !isOpen(v)) return;
    if (v === 'G') return;   // 殿試池已改為『指定池』(不靠計時,見 cardsNamedDraw):不再累積新批次;舊存檔既有 acc.G / cur.G / last.G 保留不動、不報錯
    n = cardsPeriodNo(v, now); last = cs.last[v];
    if (last < 0) { cs.acc[v].push(cardsKey(v, n)); cs.last[v] = n; added++; return; }
    if (n > last) {
      room = Math.max(0, V.cap - cs.acc[v].length);
      k = Math.min(n - last, room);
      for (i = 1; i <= k; i++) { cs.acc[v].push(cardsKey(v, last + i)); added++; }
      cs.last[v] = n;
    }
  });
  res.added = added;
  return res;
}
// 距下一批毫秒;已滿回 null(UI 不顯示倒數)
function cardsNextIn(cs, venue, now) {
  var V = CARD_VENUES[venue];
  if (cs.acc[venue].length >= V.cap) return null;
  return (cardsPeriodNo(venue, now) + 1) * V.periodMs + cardsTz(now) - now;
}
// 本期主題(顯示用):酒館酒客風向、縣試科目、殿試本日陣營
function cardsVenueTheme(venue, no) {
  if (venue === 'T') { var row = CARD_ROWS[Math.floor(no / 4) % CARD_ROWS.length]; return { kind: 'wind', row: row, text: '酒客風向:' + row }; }
  if (venue === 'E') { var s = CARD_EXAM_SUBJECTS[no % CARD_EXAM_SUBJECTS.length]; return { kind: 'subject', subject: s, text: '科目:' + s.name }; }
  var f = ((no % 5) + 5) % 5;
  return { kind: 'faction', fac: f, text: '本日:' + CARD_FAC[f] };
}

// ───────── 候選人生成(§3A.2、§4.13.4) ─────────
// 性別('m'/'f'):與頭像性別綁定(js/portrait_gender.js、cardsui.js cardsUiAvatarVar);名字用字依性別分池
var CARD_NAME_GIV_F = ['婉', '貞', '蘭', '梅', '秀', '英', '蓮', '芳', '淑', '慧', '娥', '姬', '嫻', '春', '巧', '雲', '珍', '玉', '翠', '柔', '嬌', '菊', '荷', '霞', '月', '纖', '織', '娘'];
var CARD_NAME_GIV_M = CARD_NAME_GIV.filter(function (x) { return ['玉', '織', '純'].indexOf(x) < 0; });
function cardGenSex(cs, venue, key, slot, tag) { return cardRng(cardHash(cs.seed, venue, key, slot, (tag || '') + '|sex'))() < 0.42 ? 'f' : 'm'; }
function cardGenName(r, sex) {
  var P = sex === 'f' ? CARD_NAME_GIV_F : CARD_NAME_GIV_M;
  var s = CARD_NAME_SUR[Math.floor(r() * CARD_NAME_SUR.length)], g = P[Math.floor(r() * P.length)];
  if (r() < 0.5) g += P[Math.floor(r() * P.length)];
  return s + g;
}
function cardGenStats(r, G) {
  var st = [], sum = 0, i, lo = G.tai[0], hi = G.tai[1], k, guard = 0;
  for (i = 0; i < 5; i++) { st.push(G.lo + Math.floor(r() * (G.hi - G.lo + 1))); sum += st[i]; }
  k = sum < lo ? lo / sum : (sum > hi ? hi / sum : 1);
  sum = 0;
  for (i = 0; i < 5; i++) { st[i] = Math.max(10, Math.min(G.stCap, Math.round(st[i] * k))); sum += st[i]; }
  while (sum < lo && guard++ < 300) {
    var m = 0;
    for (i = 1; i < 5; i++) if (st[i] < st[m]) m = i;
    if (st[m] >= G.stCap) break;
    st[m]++; sum++;
  }
  return st;
}
function cardGenTraits(r, G, n) {
  var out = [], pool = CARD_TRAITS.filter(function (t) { return !t.conv; }), tries = 0, t, neg = 0;
  function w(t) {
    if (G.id === 0 && t.pw > 1) return 0;
    if (G.id === 1 && t.pw > 2) return 0;
    return t.pw === 1 ? 1 : (t.pw === 2 ? 0.4 : (G.id >= 3 ? 0.2 : 0.1));
  }
  while (out.length < n && tries++ < 60) {
    t = cardWPick(r, pool, w);
    if (out.indexOf(t.id) >= 0) continue;
    if (t.neg && neg >= 1) continue;
    if (out.some(function (id) { var o = CARD_TRAIT_BY_ID[id]; return (o.ex && o.ex.indexOf(t.id) >= 0) || (t.ex && t.ex.indexOf(id) >= 0); })) continue;
    out.push(t.id);
    if (t.neg) neg++;
  }
  return out;
}
// 職業詞條:回 {ja:{id:階}, main:id}
function cardGenJobs(r, G, learn, venue, no, row) {
  var theme = cardsVenueTheme(venue, no), ja = {}, jobs = CARD_JOBS, main, slots, t, others, i, j;
  function w(j) {
    if (venue === 'T' && j.row === theme.row) return 2;
    if (venue === 'E') {
      var s = theme.subject;
      if (s.jobs && s.jobs.indexOf(j.id) >= 0) return 3;
      if (s.rows && s.rows.indexOf(j.row) >= 0) return 3;
    }
    return 1;
  }
  function pickOther(n) {
    var left = jobs.filter(function (x) { return !ja[x.id]; }), k;
    for (k = 0; k < n && left.length; k++) {
      j = cardWPick(r, left, w);
      ja[j.id] = 1;
      left = left.filter(function (x) { return x.id !== j.id; });
    }
  }
  slots = cardRint(r, G.jobSlots[0], G.jobSlots[1]);
  if (learn === 0) {
    if (row) {   // 指定池職業分類:第一個職業詞條固定取自該分類
      j = cardWPick(r, jobs.filter(function (x) { return x.row === row; }), function () { return 1; });
      ja[j.id] = 1;
      pickOther(Math.max(0, slots - 1));
    } else pickOther(slots);
    main = Object.keys(ja)[0];
    return { ja: ja, main: main };
  }
  t = learn === 1 ? Math.min(G.jobMax, G.id >= 2 && r() < 0.5 ? 3 : 2) : (learn === 2 ? 3 : 4);
  main = cardWPick(r, row ? jobs.filter(function (x) { return x.row === row; }) : jobs, w).id;
  ja[main] = t;
  others = Math.max(0, slots - t);
  if (learn >= 2) others = r() < 0.5 ? 1 : 0;
  pickOther(others);
  for (i in ja) if (i !== main && ja[i] > 1) ja[i] = 1;
  return { ja: ja, main: main };
}
function cardPickLearn(r, G, forceZhuan) {
  var L = G.learn, x = r() * 100, i, acc = 0;
  if (forceZhuan) { var z = L[2] + L[3]; return z > 0 && r() * z >= L[2] ? 3 : 2; }
  for (i = 0; i < 4; i++) { acc += L[i]; if (x < acc) return i; }
  return 0;
}
function cardPinOf(card, G) {
  var m;
  if (card.fig) return 0;
  if (card.gr === 3) return card.tai >= 325 ? 1 : 2;
  if (card.gr === 2) return 3;
  if (card.gr === 1) return card.tai >= 245 ? 4 : 5;
  m = G.tai[0] + (G.tai[1] - G.tai[0]) * (2 / 3);
  if (card.tai >= m) return 6;
  return card.tai >= G.tai[0] + (G.tai[1] - G.tai[0]) / 3 ? 7 : 8;
}
// 名人:職業由五維自動推導(§5.4 未手填職業,第一階段 PLACEHOLDER;gr 4 = [IV,I,I]、gr 3 = [III,I,I])
function cardFigJobs(f) {
  var ov = (typeof CARD_FIG_JOB_OVERRIDE !== 'undefined') ? CARD_FIG_JOB_OVERRIDE[f.id] : null, oja = {}, omain = null, ok;
  if (ov && ov.ja && typeof ov.ja === 'object') {   // 手填覆寫優先:職業 id 須存在、階 1~4;無效項略過,全無效則退回推導
    Object.keys(ov.ja).forEach(function (id) { var t = ov.ja[id] | 0; if (CARD_JOB_BY_ID[id] && t >= 1 && t <= 4) { oja[id] = t; if (!omain) omain = id; } });
    ok = Object.keys(oja).length > 0;
    if (ok) return { ja: oja, main: (ov.main && oja[ov.main]) ? ov.main : omain };
  }
  var rules = [['bingshi'], ['bingshi', 'caishi'], ['wenshu', 'tianwen'], ['lizhi', 'jisuan', 'lvfa'], ['ciling', 'jiaohua', 'shangcai']];
  var ord = [0, 1, 2, 3, 4].sort(function (a, b) { return f.st[b] - f.st[a] || a - b; }), ja = {}, tiers = f.gr === 4 ? [4, 1, 1] : [3, 1, 1], main = null, k, i, j, list, pick;
  for (k = 0; k < 3; k++) {
    list = rules[ord[k]];
    pick = null;
    for (i = 0; i < list.length; i++) { j = list[(i + cardHash(f.id, k) % list.length) % list.length]; if (!ja[j]) { pick = j; break; } }
    if (!pick) continue;
    ja[pick] = tiers[k];
    if (!main) main = pick;
  }
  return { ja: ja, main: main };
}
function cardFigTraitIds(f) {
  var ids = [];
  f.tr.forEach(function (t) {
    var i;
    for (i = 0; i < CARD_TRAITS.length; i++) if (CARD_TRAITS[i].n === t[0] && !t[1] && ids.indexOf(CARD_TRAITS[i].id) < 0) { ids.push(CARD_TRAITS[i].id); break; }
  });
  return ids;
}
function cardFromFig(f, venue, slot) {
  var jb = cardFigJobs(f), V = CARD_VENUES[venue];
  return {
    slot: slot, fig: f.id, sex: (typeof portraitGenderOf === 'function' && portraitGenderOf(f.id)) || 'm', name: f.name, zi: f.zi, fac: f.fac, gr: f.gr, st: f.st.slice(), tai: f.tai, ja: jb.ja, main: jb.main, learn: f.gr === 4 ? 3 : 2,
    tr: cardFigTraitIds(f), trn: f.tr.map(function (t) { return [t[0], t[1] ? 1 : 0, t[2] || '']; }), skn: CARD_GRADE[f.gr].skn,
    org: { k: venue === 'E' ? 'pin' : V.org, v: venue === 'E' ? 0 : undefined }
  };
}
// 名人抽取權重(carddata.js CARD_FIG_WEIGHT;缺項金 10 / 紫 6)
function cardFigWeight(f) {
  var w = (typeof CARD_FIG_WEIGHT !== 'undefined') ? CARD_FIG_WEIGHT[f.id] : undefined;
  return (typeof w === 'number' && w > 0) ? w : (f.gr === 4 ? 10 : 6);
}
function cardGen(cs, venue, key, slot, gr, tag, opt) {
  var V = CARD_VENUES[venue], no = cardsKeyNo(key), r = cardRng(cardHash(cs.seed, venue, key, slot, tag || '')), G = CARD_GRADE[gr], card, pool, f, learn, jb, facW, i, tr;
  opt = opt || {};
  if (gr === 4) {
    pool = CARD_FIGS.filter(function (x) { return x.gr === 4 && (opt.fac === undefined || x.fac === opt.fac); });
    return cardFromFig(cardWPick(r, pool, cardFigWeight), venue, slot);   // 金階名人依 CARD_FIG_WEIGHT 加權
  }
  if (gr === 3 && V.bFig > 0 && !opt.noFig) {
    var fm = (venue === 'E') ? Math.min(V.bFig * 2, V.bFig + 0.002 * Math.max(0, cs.fame.E - CARD_CFG.fameAfter)) : V.bFig;
    if (r() < fm) {
      pool = CARD_FIGS.filter(function (x) { return x.gr === 3 && (opt.fac === undefined || x.fac === opt.fac); });
      if (pool.length) return cardFromFig(cardWPick(r, pool, cardFigWeight), venue, slot);   // 紫階名人依 CARD_FIG_WEIGHT 加權
    }
  }
  var sex = cardGenSex(cs, venue, key, slot, tag);
  facW = venue === 'G' ? ((no % 5) + 5) % 5 : -1;
  f = opt.fac !== undefined ? opt.fac : cardWPick(r, [0, 1, 2, 3, 4], function (x) { return x === facW ? 2 : 1; });
  learn = cardPickLearn(r, G, !!opt.zhuan);
  jb = cardGenJobs(r, G, learn, venue, no, opt.row);
  tr = cardGenTraits(r, G, cardRint(r, G.trN[0], G.trN[1]));
  card = { slot: slot, fig: null, sex: sex, name: cardGenName(r, sex), zi: '', fac: f, gr: gr, st: cardGenStats(r, G), tai: 0, ja: jb.ja, main: jb.main, learn: learn, tr: tr, trn: null, skn: G.skn, org: { k: V.org } };
  card.tai = card.st.reduce(function (a, b) { return a + b; }, 0);
  if (gr === 1 && card.tai >= 240) card.skn = 1;
  if (venue === 'E') card.org.v = cardPinOf(card, G);
  return card;
}
function cardIsUpper(c, V) { return c.gr > V.upper.gr || (c.gr === V.upper.gr && (!V.upper.zhuan || c.learn >= 2)); }
function cardRollGr(cs, venue, key, slot, star) {
  var V = CARD_VENUES[venue], p = (venue === 'E' && V.starGr[star]) ? V.starGr[star].slice() : V.gr.slice(), r = cardRng(cardHash(cs.seed, venue, key, slot, 'gr')), x = r() * 100, i, acc = 0;
  if (venue === 'G') {
    var gold = Math.min(CARD_CFG.goldMax, p[4] + Math.max(0, cs.fame.G - CARD_CFG.fameAfter) * CARD_CFG.fameStep);
    p[0] -= gold - p[4]; p[4] = gold;
  }
  for (i = 0; i < 5; i++) { acc += p[i]; if (x < acc) return i; }
  return p[4] > 0 ? 4 : 0;
}
// 生成一批 7 人(含批內保底與十批保底);不改 cs,只讀 cs.pity/fame/seed。回 {key, venue, cands, hasUpper, pityHit}
function cardsGenBatch(cs, venue, key) {
  var V = CARD_VENUES[venue], cands = [], i, star = cs.stars[venue] || 1, pityHit = false, best, hi, has;
  function highest() { var b = 0, k; for (k = 1; k < cands.length; k++) if (cands[k].tai > cands[b].tai) b = k; return b; }
  for (i = 0; i < V.batch; i++) cands.push(cardGen(cs, venue, key, i, cardRollGr(cs, venue, key, i, star)));
  has = cands.some(function (c) { return cardIsUpper(c, V); });
  if (!has && cs.pity[venue] >= CARD_CFG.pityBatches) {
    best = highest();
    cands[best] = cardGen(cs, venue, key, best, V.upper.gr, 'pity', { zhuan: !!V.upper.zhuan });
    pityHit = true;
  }
  if (!cands.some(function (c) { return c.gr >= V.floor; })) {
    best = highest();
    cands[best] = cardGen(cs, venue, key, best, V.floor, 'floor');
  }
  return { key: key, venue: venue, cands: cands, hasUpper: cands.some(function (c) { return cardIsUpper(c, V); }), pityHit: pityHit };
}
// 開下一批:已有待入包的當批就回它;否則由 acc 取最舊期鍵生成、更新保底計數、成為 cs.cur(= 『待入包批次』,隨後由 cardsBagCommit 放進卡包;存檔時 cardsNormSave 會把殘留的轉入卡包)
function cardsOpenBatch(cs, venue) {
  var b, key, V = CARD_VENUES[venue];
  if (cs.cur[venue]) return cs.cur[venue];
  if (!cs.acc[venue].length) return null;
  key = cs.acc[venue].shift();
  b = cardsGenBatch(cs, venue, key);
  cs.pity[venue] = b.hasUpper ? 0 : cs.pity[venue] + 1;
  if (venue === 'G') cs.fame.G = b.cands.some(function (c) { return c.gr === 4; }) ? 0 : cs.fame.G + 1;
  if (venue === 'E') cs.fame.E = b.cands.some(function (c) { return !!c.fig; }) ? 0 : cs.fame.E + 1;
  b.taken = b.cands.map(function () { return 0; });
  cs.cur[venue] = b;
  return b;
}
function cardsDiscardBatch(cs, venue) { cs.cur[venue] = null; }

// ───────── 指定池(取代殿試池;PLAN_INTERIORS I-1):不靠計時,消耗『指名券』(cs.nameTokens)。結果批次放 cs.cur.G(同殿試的存檔格式,pool 'G')─────────
// mode 'fac' key = 陣營 0~4(CARD_FAC 序);mode 'row' key = 職業分類字(CARD_ROWS)。名人只在 fac 模式出現;row 模式的金檔降為紫。
function cardsNamedKeyOk(mode, key) {
  if (mode === 'fac') return typeof key === 'number' && key >= 0 && key < CARD_FAC.length && key === Math.floor(key);
  if (mode === 'row') return CARD_ROWS.indexOf(key) >= 0;
  return false;
}
function cardsNamedOpen() { return cardsVenueOpen('G'); }   // 開放條件沿用原殿試閘(科技 dianshi),不新增條件
function cardsAddNameTokens(cs, n) { cs.nameTokens = Math.max(0, (cs.nameTokens | 0) + (n | 0)); return cs.nameTokens; }
// 確定性:種子 = hash(cs.seed, 'named', mode, key, seedKey);seedKey = 已抽次數。不改 cs(除讀 cs.pity.G)。回批次 {key, venue:'G', cands, hasUpper, pityHit, named:{mode,key}}
function cardsGenNamed(cs, mode, key, seedKey) {
  var V = CARD_VENUES.G, cands = [], i, pityHit = false, best, bkey = 'G:' + (seedKey | 0), tag = 'named|' + mode + '|' + key, opt = {};
  function rollGr(slot) {
    var r = cardRng(cardHash(cs.seed, 'named', mode, key, seedKey, slot, 'gr')), x = r() * 100, acc = 0, g;
    for (g = 0; g < 5; g++) { acc += V.gr[g]; if (x < acc) return (g === 4 && mode === 'row') ? 3 : g; }
    return 0;
  }
  function highest() { var b = 0, k; for (k = 1; k < cands.length; k++) if (cands[k].tai > cands[b].tai) b = k; return b; }
  if (mode === 'fac') opt.fac = key; else { opt.row = key; opt.noFig = true; }
  function gen(slot, gr, t) { return cardGen(cs, 'G', bkey, slot, gr, tag + (t ? '|' + t : '') + '|' + seedKey, opt); }
  for (i = 0; i < V.batch; i++) cands.push(gen(i, rollGr(i), ''));
  if (!cands.some(function (c) { return c.gr >= 3; }) && cs.pity.G >= CARD_CFG.pityBatches) {
    best = highest(); cands[best] = gen(best, 3, 'pity'); pityHit = true;
  }
  if (!cands.some(function (c) { return c.gr >= 2; })) { best = highest(); cands[best] = gen(best, 2, 'floor'); }
  return { key: bkey, venue: 'G', cands: cands, hasUpper: cands.some(function (c) { return c.gr >= 3; }), pityHit: pityHit, named: { mode: mode, key: key } };
}
// 指名一次:扣 1 券、遞增已抽次數、結果成為 cs.cur.G(待入包批次,隨後 cardsBagCommit(cs, 'G'))。reason:closed 未開放 bad 參數錯 busy 上一批尚未入包 bagfull 卡包空位不足(不扣券) ticket 指名券不足
function cardsNamedDraw(cs, mode, key) {
  var b;
  if (!cardsNamedOpen()) return { ok: false, reason: 'closed' };
  if (!cardsNamedKeyOk(mode, key)) return { ok: false, reason: 'bad' };
  if (cs.cur.G) return { ok: false, reason: 'busy' };
  if (cs.bag.length + CARD_BAG.batchNeed > cardsBagCap()) return { ok: false, reason: 'bagfull' };
  if ((cs.nameTokens | 0) < 1) return { ok: false, reason: 'ticket' };
  b = cardsGenNamed(cs, mode, key, cs.namedCount | 0);
  cs.nameTokens -= 1; cs.namedCount = (cs.namedCount | 0) + 1;
  cs.pity.G = b.hasUpper ? 0 : cs.pity.G + 1;
  b.taken = b.cands.map(function () { return 0; });
  cs.cur.G = b;
  return { ok: true, batch: b };
}
// 指名券來源(占位):里程碑完成 +1、官階晉升 +1。每個事件只發一次(記在 cs.tokenGiven.named)。回發放張數
function cardsNamedFlags(cs) {
  var g = cs.tokenGiven || (cs.tokenGiven = {});
  if (!g.named || typeof g.named !== 'object') g.named = { ids: {}, rank: -1 };
  if (!g.named.ids) g.named.ids = {};
  return g.named;
}
function cardsNamedGive(cs, evId, why) {
  var f = cardsNamedFlags(cs);
  if (!evId || f.ids[evId]) return 0;
  f.ids[evId] = 1;
  cardsAddNameTokens(cs, 1);
  if (typeof showToast === 'function') showToast((why || '') + ',得指名券 +1');
  return 1;
}
// 官階晉升檢查:首次檢查只記錄現況(舊存檔不補發);之後每升一階發一張。回發放張數
function cardsNamedRankCheck(cs) {
  var lv = cardsRankLv(), f, n = 0, i;
  if (lv <= 0) return 0;
  f = cardsNamedFlags(cs);
  if (f.rank < 0) { f.rank = lv; return 0; }
  for (i = f.rank + 1; i <= lv; i++) n += cardsNamedGive(cs, 'rank' + i, '官階晉升');
  if (lv > f.rank) f.rank = lv;
  return n;
}
var cardsNamedClock = 0;
// 主迴圈掛點(main.js frame):每 5 秒檢查一次官階;無資料 / 例外一律略過
function cardsNamedTick(dt) {
  var cs;
  cardsNamedClock += dt || 0;
  if (cardsNamedClock < 5) return 0;
  cardsNamedClock = 0;
  try { if (typeof academyTick === 'function') academyTick(5); if (typeof npcTick === 'function') npcTick(5); cs = cardsGet(); return cs ? cardsNamedRankCheck(cs) : 0; } catch (e) { return 0; }   // npcTick:人物互動(親近年資 / 請託)
}

// ───────── 名冊 / 任用 / 請辭 ─────────
function cardsCost(c) { return CARD_GRADE[c.gr].cost + ((c.gr === 3 && c.learn === 3) ? CARD_COST.zongBonus : 0); }
// 官階等級 1~(LH_RANKS 序號 + 1);缺 lordhallui / cityscore 時回 0(名額退回 capBase)
function cardsRankLv() {
  var s, r, i;
  if (typeof lordhallRank !== 'function' || typeof cityscoreGet !== 'function') return 0;
  try { s = cityscoreGet(false); r = lordhallRank(s ? s.pop : 0, s ? s.pros : 0); } catch (e) { return 0; }
  if (typeof r === 'number') return Math.max(0, r | 0);
  if (typeof LH_RANKS !== 'undefined') for (i = 0; i < LH_RANKS.length; i++) if (LH_RANKS[i].n === r) return i + 1;
  return 0;
}
// 名額 = 10 + 官階等級 × 2(上限 40);無官階資料退回 capBase;再加 cardsCapBonus()。官階降低時名額減少但不踢人(roster 超額僅不能再任用)
function cardsCap() {
  var lv = cardsRankLv(), base = lv > 0 ? Math.min(CARD_CFG.capMax, CARD_CFG.capRank0 + lv * CARD_CFG.capPerRank) : CARD_CFG.capBase;
  return base + ((typeof cardsCapBonus === 'function') ? (cardsCapBonus() | 0) : 0);
}
function cardsFind(cs, id) {
  var lists = ['roster', 'wait', 'wander'], i, j;
  for (i = 0; i < lists.length; i++) for (j = 0; j < cs[lists[i]].length; j++) if (cs[lists[i]][j].id === id) return { e: cs[lists[i]][j], list: lists[i], idx: j };
  return null;
}
function cardsFindFig(cs, fig) {   // 含卡包:名人同時只會有一份(重複抽到轉信物 / 碎片)
  var lists = ['roster', 'wait', 'wander', 'bag'], i, j;
  for (i = 0; i < lists.length; i++) for (j = 0; j < cs[lists[i]].length; j++) if (cs[lists[i]][j].fig === fig) return cs[lists[i]][j];
  return null;
}
function cardsJobLine(c) {
  return Object.keys(c.ja || {}).map(function (id) { var j = CARD_JOB_BY_ID[id]; return j ? j.t[Math.max(0, c.ja[id] - 1)] : id; }).join('、');
}
function cardsRefreshEntry(e) {
  var j = CARD_JOB_BY_ID[e.main];
  e.grade = e.gr;
  e.job = j ? CARD_POST_GROUP[j.row] : '工';
  return e;
}
// 戰場技能清單:依職業行(主職優先)逐張取用,不足以通用技補滿 skn 張;回傳 CARD_SKILLS 項目(尚無獨立存檔欄位,由職業推導)
function cardsSkillList(c) {
  var rows = [], out = [], ids = Object.keys(c.ja || {}), n = Math.max(0, c.skn | 0), i, j, k;
  if (c.main && ids.indexOf(c.main) > 0) { ids.splice(ids.indexOf(c.main), 1); ids.unshift(c.main); }
  for (i = 0; i < ids.length; i++) { j = CARD_JOB_BY_ID[ids[i]]; if (j && rows.indexOf(j.row) < 0) rows.push(j.row); }
  for (i = 0; i < n; i++) {
    k = CARD_SKILL_BY_ROW[rows[i]] || CARD_SKILL_BY_ROW['通'];
    out.push(k);
  }
  return out;
}
function cardsStats(e) { var t = e.tok || 0; return e.st.map(function (v) { return v + t; }); }
function cardsJobSlots(e) {
  var used = 0, k;
  for (k in e.ja) used += e.ja[k];
  return { used: used, cap: Math.max(used, CARD_GRADE[e.gr].jobSlots[1]) };
}
// ───────── 卡包(cs.bag):開批的卡直接入包,不再先花酒令挑人;從卡包『任用』到名冊才花酒令(任用成本 = cardsCost) ─────────
// 流程:cardsBagStage(開批,批次暫放 cs.cur[v])→(可選)抽卡特效→ cardsBagCommit(入包:重複名人轉信物 / 碎片、白階依設定自動分解)。cardsBagOpen = 兩步連做(無特效 / 離線路徑)。
function cardsBagCap() {   // 容量 = capBase + (官階等級 − 1) × capPerRank,上限 capMax;缺官階資料 = capBase
  var lv = cardsRankLv(), B = CARD_BAG;
  return lv > 0 ? Math.min(B.capMax, B.capBase + (lv - 1) * B.capPerRank) : B.capBase;
}
function cardsBagRoom(cs) { return Math.max(0, cardsBagCap() - cs.bag.length); }
function cardsBagAutoLv(cs) {   // 自動分解門檻:-1 = 關,0~autoMax = 品階 ≤ 此值的路人自動分解(未設定 = autoDefault)
  var a = cs.bagAuto;
  return (typeof a !== 'number' || !isFinite(a)) ? CARD_BAG.autoDefault : Math.max(-1, Math.min(CARD_BAG.autoMax, a | 0));
}
function cardsBagSetAuto(cs, lv) {   // 回設定後的值;等於預設時刪欄位(有值才寫)
  lv = Math.max(-1, Math.min(CARD_BAG.autoMax, lv | 0));
  if (lv === CARD_BAG.autoDefault) delete cs.bagAuto; else cs.bagAuto = lv;
  return lv;
}
function cardsBagDissolveValue(c) { return Math.round(cardsCost(c) * CARD_WINE.refundRate * CARD_WINE.shardPerToken); }   // 沿用請辭回收 20 %(碎片)
// 碎片入帳:capped = 受每週上限(shardWeekCap)限制(分解 / 自動分解);5 碎 = 1 令。回 {shards 實得, tokens 轉出的令, lost 超出上限而損失}
function cardsShardGain(cs, shards, now, capped) {
  var add = Math.max(0, shards | 0), wk, dTok;
  if (capped) {
    wk = Math.floor(((now || 0) - cardsTz(now || 0)) / (7 * 86400000));
    if (cs.shardWk.w !== wk) cs.shardWk = { w: wk, n: 0 };
    add = Math.max(0, Math.min(add, CARD_WINE.shardWeekCap - cs.shardWk.n));
    cs.shardWk.n += add;
  }
  cs.shards += add;
  dTok = Math.floor(cs.shards / CARD_WINE.shardPerToken);
  cs.shards -= dTok * CARD_WINE.shardPerToken; cs.tok += dTok;
  return { shards: add, tokens: dTok, lost: Math.max(0, (shards | 0) - add) };
}
function cardsBagFind(cs, bid) {
  var i;
  for (i = 0; i < cs.bag.length; i++) if (cs.bag[i].bid === bid) return { c: cs.bag[i], idx: i };
  return null;
}
// 放一張卡進卡包(複本,不檢查容量 / 重複名人);回卡包卡物件
function cardsBagPut(cs, c, pool, key) {
  var o = JSON.parse(JSON.stringify(c));
  cs.bagSeq = (cs.bagSeq | 0) + 1;
  o.bid = 'b' + cs.bagSeq; o.pool = pool || 'T'; o.key = String(key || '');
  delete o.taken;
  cs.bag.push(o);
  return o;
}
// 開批但先不入包(給抽卡特效用):reason none 無待開批次 busy 上一批尚未入包 bagfull 卡包空位不足 7 張(該批暫存在 acc,不開)
function cardsBagStage(cs, venue) {
  var b;
  if (cs.cur[venue]) return { ok: false, reason: 'busy' };
  if (!cs.acc[venue] || !cs.acc[venue].length) return { ok: false, reason: 'none' };
  if (cs.bag.length + CARD_BAG.batchNeed > cardsBagCap()) return { ok: false, reason: 'bagfull' };
  b = cardsOpenBatch(cs, venue);
  return { ok: true, batch: b, cards: b.cands };
}
// 把待入包批次放進卡包。o {now, noAuto}。每張的去向 how:bag 入包 / auto 自動分解 / token 名人重複 → 信物 +1 / shard 名人重複且信物已滿 → 碎片 / skip 舊批次已處理
function cardsBagCommit(cs, venue, o) {
  var b = cs.cur[venue], opt = o || {}, auto = opt.noAuto ? -1 : cardsBagAutoLv(cs), res, raw = 0, figShards = 0, g, g2;
  if (!b) return { ok: false, reason: 'none' };
  cs.cur[venue] = null;
  res = { ok: true, venue: venue, key: b.key, items: [], added: 0, dissolved: 0, tokenN: 0, shardN: 0, shards: 0, tokens: 0, lost: 0 };
  b.cands.forEach(function (c, i) {
    var owner, how, put, sh;
    if (b.taken && b.taken[i]) { res.items.push({ c: c, how: 'skip' }); return; }
    owner = c.fig ? cardsFindFig(cs, c.fig) : null;
    if (owner) {
      if ((owner.tok || 0) < CARD_CFG.tokMax) { owner.tok = (owner.tok || 0) + 1; how = 'token'; res.tokenN++; }
      else { sh = CARD_BAG.figDupShard[c.gr] || CARD_BAG.figDupShard[4]; figShards += sh; how = 'shard'; res.shardN++; }
      res.items.push({ c: c, how: how, shards: how === 'shard' ? sh : 0 });
      return;
    }
    if (!c.fig && auto >= 0 && c.gr <= auto) { sh = cardsBagDissolveValue(c); raw += sh; res.dissolved++; res.items.push({ c: c, how: 'auto', shards: sh }); return; }
    put = cardsBagPut(cs, c, venue, b.key);
    res.added++;
    res.items.push({ c: c, how: 'bag', bid: put.bid });
  });
  if (raw > 0) { g = cardsShardGain(cs, raw, opt.now, true); res.shards += g.shards; res.tokens += g.tokens; res.lost += g.lost; }
  if (figShards > 0) { g2 = cardsShardGain(cs, figShards, opt.now, false); res.shards += g2.shards; res.tokens += g2.tokens; }
  cs.lastRel = null;
  return res;
}
function cardsBagOpen(cs, venue, o) {
  var r = cardsBagStage(cs, venue);
  return r.ok ? cardsBagCommit(cs, venue, o) : r;
}
// 殘留的待入包批次(中斷 / 舊存檔 / 無特效)全部入包;回處理的批數
function cardsBagFlush(cs, o) {
  var n = 0;
  CARD_VENUE_ORDER.forEach(function (v) { if (cs.cur[v]) { cardsBagCommit(cs, v, o); n++; } });
  return n;
}
// 卡包列表:f {gr: -1 全部 / 0~4, row: '' 全部 / 職業分類字, sort: 'gr' 品階 / 'tai' 才 / 'new' 最新}
function cardsBagList(cs, f) {
  var o = f || {}, list = cs.bag.filter(function (c) {
    var j;
    if (typeof o.gr === 'number' && o.gr >= 0 && c.gr !== o.gr) return false;
    if (o.row) { j = CARD_JOB_BY_ID[c.main]; if (!j || j.row !== o.row) return false; }
    return true;
  });
  function no(c) { return parseInt(String(c.bid).slice(1), 10) || 0; }
  list.sort(function (a, b) {
    if (o.sort === 'new') return no(b) - no(a);
    if (o.sort === 'tai') return b.tai - a.tai || b.gr - a.gr || no(b) - no(a);
    return b.gr - a.gr || b.tai - a.tai || no(b) - no(a);
  });
  return list;
}
// 一鍵分解的候選:路人且品階 ≤ maxGr(名人永不入選);回 bid 陣列
function cardsBagPick(cs, maxGr) {
  return cs.bag.filter(function (c) { return !c.fig && c.gr <= maxGr; }).map(function (c) { return c.bid; });
}
// 分解(單張 / 批量):路人 → 碎片(受每週上限),名人不可分解。o {now}。回 {ok, n, shards, tokens, lost, skippedFig, reason?}
function cardsBagDissolve(cs, ids, o) {
  var opt = o || {}, drop = {}, n = 0, raw = 0, skippedFig = 0, g;
  (ids || []).forEach(function (id) {
    var f = cardsBagFind(cs, id);
    if (!f || drop[id]) return;
    if (f.c.fig) { skippedFig++; return; }
    drop[id] = 1; n++; raw += cardsBagDissolveValue(f.c);
  });
  if (!n) return { ok: false, reason: skippedFig ? 'fig' : 'none', n: 0, shards: 0, tokens: 0, lost: 0, skippedFig: skippedFig };
  cs.bag = cs.bag.filter(function (c) { return !drop[c.bid]; });
  g = cardsShardGain(cs, raw, opt.now, true);
  cs.lastRel = null;
  return { ok: true, n: n, shards: g.shards, tokens: g.tokens, lost: g.lost, skippedFig: skippedFig };
}
// 餵養入口(預留,尚未實作;UI 不顯示):之後以卡包內的路人卡當素材強化名冊人物
function cardsBagFeed() { return { ok: false, reason: 'todo' }; }
// 名冊項目:由卡包卡建立(id 依 cs.seq 遞增)
function cardsMakeEntry(cs, c, pool, key, cost) {
  var e = {
    id: 'r' + (++cs.seq), no: cs.seq, name: c.name, zi: c.zi, fig: c.fig, fac: c.fac, gr: c.gr, st: c.st.slice(), tai: c.tai, ja: JSON.parse(JSON.stringify(c.ja)), main: c.main,
    learn: c.learn, tr: c.tr.slice(), trn: c.trn ? c.trn.map(function (t) { return t.slice(); }) : null, skn: c.skn, org: { k: c.org.k, v: c.org.v }, pool: pool, key: key,
    at: null, star: 0, tok: 0, up: 0, cost: cost
  };
  if (c.sex) e.sex = c.sex;
  if (c.tok) e.tok = c.tok | 0;
  cardsRefreshEntry(e);
  return e;
}
// 任用:卡包 → 名冊,花 cardsCost 酒令(開批免費,酒令只在這裡花)。回 {ok, reason?, entry?}。reason:none 卡包無此卡 tok 酒令不足 full 名冊已滿(須先請辭或提升官階)
function cardsBagEnlist(cs, bid) {
  var f = cardsBagFind(cs, bid), c, cost, e;
  if (!f) return { ok: false, reason: 'none' };
  c = f.c; cost = cardsCost(c);
  if (cs.tok < cost) return { ok: false, reason: 'tok' };
  if (cs.roster.length >= cardsCap()) return { ok: false, reason: 'full' };
  e = cardsMakeEntry(cs, c, c.pool || 'T', c.key || '', cost);
  cs.tok -= cost; cs.bag.splice(f.idx, 1); cs.roster.push(e); cs.lastRel = null;
  return { ok: true, entry: e };
}
// 待定席 → 名冊(需有名額)
function cardsAccept(cs, id) {
  var f = cardsFind(cs, id);
  if (!f || f.list !== 'wait') return false;
  if (cs.roster.length >= cardsCap()) return false;
  cs.wait.splice(f.idx, 1); cs.roster.push(f.e);
  return true;
}
// 每日小禮:回本次領到的酒令數(0 = 今日已領)
function cardsClaimGift(cs, now) {
  var day = Math.floor((now - cardsTz(now)) / 86400000), days, n;
  days = cs.gift.day < 0 ? 1 : Math.max(0, Math.min(CARD_WINE.dailyDaysMax, day - cs.gift.day));
  if (days <= 0) return 0;
  n = days * CARD_WINE.dailyGift; cs.tok += n; cs.gift.day = day;
  return n;
}
// 請辭:opts {unassign, now}。路人回收 20 %(碎片,每週上限);名人轉流浪不給碎片。回 {ok, reason?, shards?, tokens?}
function cardsRelease(cs, id, opts) {
  var f = cardsFind(cs, id), e, o = opts || {}, shards, wk, add, dTok, snapS, snapW;
  if (!f || f.list === 'wander') return { ok: false, reason: 'none' };
  e = f.e;
  if (e.star) return { ok: false, reason: 'locked' };
  if (e.study) return { ok: false, reason: 'study' };   // 進修中(academy.js)不可請辭
  if (e.at && !o.unassign) return { ok: false, reason: 'busy' };
  cs[f.list].splice(f.idx, 1);
  e.at = null;
  if (e.fig) { cs.wander.push(e); cs.lastRel = { e: e, list: f.list, idx: f.idx, wander: true }; return { ok: true, shards: 0, tokens: 0 }; }
  wk = Math.floor(((o.now || 0) - cardsTz(o.now || 0)) / (7 * 86400000));
  snapS = cs.shards; snapW = { w: cs.shardWk.w, n: cs.shardWk.n };
  if (cs.shardWk.w !== wk) cs.shardWk = { w: wk, n: 0 };
  shards = Math.round((e.cost || CARD_GRADE[e.gr].cost) * CARD_WINE.refundRate * CARD_WINE.shardPerToken);
  add = Math.max(0, Math.min(shards, CARD_WINE.shardWeekCap - cs.shardWk.n));
  cs.shardWk.n += add; cs.shards += add;
  dTok = Math.floor(cs.shards / CARD_WINE.shardPerToken);
  cs.shards -= dTok * CARD_WINE.shardPerToken; cs.tok += dTok;
  cs.lastRel = { e: e, list: f.list, idx: f.idx, dTok: dTok, snapS: snapS, snapW: snapW };
  return { ok: true, shards: add, tokens: dTok };
}
function cardsUndoRelease(cs) {
  var L = cs.lastRel, arr;
  if (!L) return false;
  arr = cs[L.list];
  if (L.wander) cs.wander = cs.wander.filter(function (x) { return x !== L.e; });
  else {
    if (cs.tok < L.dTok) return false;
    cs.tok -= L.dTok; cs.shards = L.snapS; cs.shardWk = L.snapW;
  }
  arr.splice(Math.min(L.idx, arr.length), 0, L.e);
  cs.lastRel = null;
  return true;
}
// 請回流浪名人:花 CARD_RECALL_COST 酒令 + 1 名額
function cardsRecall(cs, id) {
  var f = cardsFind(cs, id);
  if (!f || f.list !== 'wander') return { ok: false, reason: 'none' };
  if (cs.tok < CARD_RECALL_COST) return { ok: false, reason: 'tok' };
  if (cs.roster.length >= cardsCap()) return { ok: false, reason: 'full' };
  cs.tok -= CARD_RECALL_COST; cs.wander.splice(f.idx, 1); cs.roster.push(f.e);
  return { ok: true, entry: f.e };
}

// ───────── 升階(只做資料邏輯與條件檢查,§3A.5) ─────────
function cardsUpgradeCheck(e, ctx) {
  var why = [], rule = null, i, mx = 0, k, c = ctx || {};
  for (i = 0; i < CARD_UPGRADE.length; i++) if (CARD_UPGRADE[i].from === e.gr) rule = CARD_UPGRADE[i];
  if (e.fig) why.push('名人不可升階');
  if (!rule) why.push('已是最高品階');
  if (e.up >= CARD_CFG.upMax) why.push('升階次數已用完');
  if (!rule) return { ok: false, reasons: why, rule: null };
  for (k in e.ja) mx = Math.max(mx, e.ja[k]);
  if (c.academy === undefined) why.push('學院尚未開放');
  else if (c.academy < rule.academy) why.push('學院院級需 ' + rule.academy);
  if (rule.lv && (c.lv || 0) < rule.lv) why.push('人物等級需 ' + rule.lv);
  if (rule.cityLv && (c.cityLv || 0) < rule.cityLv) why.push('城級需 ' + rule.cityLv);
  if (mx < rule.jobMin) why.push('任一職業需達 ' + ['', 'I', 'II', 'III', 'IV'][rule.jobMin] + ' 階');
  if ((c.xue || 0) < rule.xue) why.push('學識需 ' + rule.xue);
  if ((c.coin || 0) < rule.coin) why.push('金幣需 ' + rule.coin);
  if (rule.lessons && (c.lessons || 0) < rule.lessons) why.push('需完成 ' + rule.lessons + ' 課');
  if (rule.flag && !c.flag) why.push('需先達成「' + rule.route + '」');
  return { ok: why.length === 0, reasons: why, rule: rule, cost: { xue: rule.xue, coin: rule.coin, lessons: rule.lessons } };
}
// 套用升階(不扣資源,資源由呼叫端依 cost 扣)。屬性:最高兩項 +4、其餘 +2(夾 privStCap)
function cardsUpgrade(e, ctx) {
  var chk = cardsUpgradeCheck(e, ctx), ord, i;
  if (!chk.ok) return chk;
  ord = [0, 1, 2, 3, 4].sort(function (a, b) { return e.st[b] - e.st[a] || a - b; });
  for (i = 0; i < 5; i++) e.st[ord[i]] = Math.min(CARD_CFG.privStCap, e.st[ord[i]] + (i < 2 ? 4 : 2));
  e.tai = e.st.reduce(function (a, b) { return a + b; }, 0);
  e.gr += 1; e.up += 1;
  e.skn = Math.max(e.skn || 0, CARD_GRADE[e.gr].skn);
  cardsRefreshEntry(e);
  return chk;
}

// ───────── 派工接口(talents) ─────────
function cardsTalents() {
  var cs = cardsGet();
  return (cs && cs.roster.length) ? cs.roster : null;
}
// world.city.talents ← 名冊(同一批物件,defineProperty 不可列舉,避免存檔重複);名冊為空時不動占位資料
function cardsSyncTalents() {
  var cs = cardsGet(), c;
  if (!cs || !cs.roster.length || typeof world === 'undefined' || !world || !world.city) return null;
  c = world.city;
  if (c.talents === cs.roster) return c.talents;
  try { Object.defineProperty(c, 'talents', { value: cs.roster, enumerable: false, writable: true, configurable: true }); } catch (err) { c.talents = cs.roster; }
  return c.talents;
}
// 巡視用:把 at = 'type@x,y' 的名冊人物轉成 {id,name,bids:[物件索引+1]}(talentpatrol.js 讀取)
function cardsPatrolTalents() {
  var cs = cardsGet(), out = [], objs;
  if (!cs || !cs.roster.length || typeof world === 'undefined' || !world || !world.objects) return null;
  objs = world.objects;
  cs.roster.forEach(function (e) {
    var i, o;
    if (!e.at) return;
    for (i = 0; i < objs.length; i++) {
      o = objs[i];
      if (o && (o.type + '@' + o.x + ',' + o.y) === e.at) { out.push({ id: e.id, name: e.name, bids: [i + 1] }); return; }
    }
  });
  return out;
}

// ───────── 存讀檔(goods.js goodsNormCity 呼叫) ─────────
function cardNum(v, lo, hi, d) { return (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : d; }
function cardNormCard(c, isEntry, isBag) {
  var o, k, j;
  if (!c || typeof c !== 'object' || !Array.isArray(c.st) || c.st.length !== 5) return null;
  o = { name: String(c.name || '').slice(0, 12), zi: String(c.zi || '').slice(0, 6), fig: (c.fig && CARD_FIG_BY_ID[c.fig]) ? c.fig : null, fac: cardNum(c.fac, 0, 4, 4) | 0,
    gr: cardNum(c.gr, 0, 4, 0) | 0, st: c.st.map(function (v) { return cardNum(v, 0, 130, 10) | 0; }), tai: 0, ja: {}, main: null, learn: cardNum(c.learn, 0, 3, 0) | 0, tr: [], trn: null, skn: cardNum(c.skn, 0, 3, 0) | 0, org: { k: 'bu' } };
  if (!o.name) return null;
  o.tai = o.st.reduce(function (a, b) { return a + b; }, 0);
  if (c.ja && typeof c.ja === 'object') for (k in c.ja) if (CARD_JOB_BY_ID[k]) o.ja[k] = cardNum(c.ja[k], 1, 4, 1) | 0;
  o.main = (c.main && o.ja[c.main]) ? c.main : Object.keys(o.ja)[0] || null;
  if (Array.isArray(c.tr)) o.tr = c.tr.filter(function (id) { return CARD_TRAIT_BY_ID[id]; }).slice(0, 8);
  if (Array.isArray(c.trn)) o.trn = c.trn.slice(0, 8).map(function (t) { return [String(t[0] || '').slice(0, 12), t[1] ? 1 : 0, String(t[2] || '').slice(0, 60)]; });
  if (c.org && typeof c.org === 'object') { o.org.k = String(c.org.k || 'bu').slice(0, 8); if (typeof c.org.v === 'number') o.org.v = c.org.v | 0; }
  if (isEntry) {
    o.id = String(c.id || ''); if (!o.id) return null;
    o.no = cardNum(c.no, 0, 1e9, 0) | 0; o.pool = (c.pool === 'T' || c.pool === 'E' || c.pool === 'G') ? c.pool : 'T'; o.key = String(c.key || '').slice(0, 20);
    o.at = (typeof c.at === 'string' && c.at) ? c.at.slice(0, 40) : null; o.star = c.star ? 1 : 0; o.tok = cardNum(c.tok, 0, CARD_CFG.tokMax, 0) | 0;
    if (cardNum(c.sn, 0, 9999, 0) | 0) o.sn = cardNum(c.sn, 0, 9999, 0) | 0;   // 學院進修次數(有值才寫)
    if (!o.fig && c.study && typeof c.study === 'object' && (c.study.k === 'up' || c.study.k === 'learn' || c.study.k === 'adv') && (c.study.k === 'up' || CARD_JOB_BY_ID[c.study.j])) {   // 進修中(academy.js):k 類別 j 職業 n 課數 l 已完成 p 本課已累積秒 cs/cc 已付碎片 / 金幣
      o.study = { k: c.study.k, n: cardNum(c.study.n, 1, 9, 1) | 0, l: 0, p: Math.round(cardNum(c.study.p, 0, 1e5, 0)), cs: cardNum(c.study.cs, 0, 1e6, 0) | 0, cc: cardNum(c.study.cc, 0, 1e9, 0) | 0 };
      o.study.l = Math.min(o.study.n - 1, cardNum(c.study.l, 0, 9, 0) | 0);
      if (c.study.k !== 'up') o.study.j = c.study.j;
      o.at = null;
    }
    o.up = cardNum(c.up, 0, CARD_CFG.upMax, 0) | 0; o.cost = cardNum(c.cost, 0, 99, CARD_GRADE[o.gr].cost) | 0;
    if (cardNum(c.fav, 0, 5, 0) | 0) o.fav = cardNum(c.fav, 0, 5, 0) | 0; if (c.gift) o.gift = 1; if (typeof c.favDay === 'number' && isFinite(c.favDay)) o.favDay = c.favDay | 0; if (typeof c.since === 'number' && isFinite(c.since)) o.since = c.since | 0;   // 人物互動(npcinteract.js):親近 / 小禮旗標 / 最近加親近日 / 派駐起始日
    cardsRefreshEntry(o);
  } else o.slot = cardNum(c.slot, 0, 6, 0) | 0;
  if (isBag) {   // 卡包卡:bid(b + 序號)、出身池 / 期鍵、信物數(有值才寫)
    if (!/^b\d{1,9}$/.test(String(c.bid))) return null;
    o.bid = String(c.bid); o.pool = (c.pool === 'T' || c.pool === 'E' || c.pool === 'G') ? c.pool : 'T'; o.key = String(c.key || '').slice(0, 20);
    if (cardNum(c.tok, 0, CARD_CFG.tokMax, 0) | 0) o.tok = cardNum(c.tok, 0, CARD_CFG.tokMax, 0) | 0;
  }
  j = 0;
  // 性別:名人固定查表;路人有值才採用,舊存檔沒有時依其目前頭像查表補上(頭像不變)
  if (o.fig) { o.sex = (typeof portraitGenderOf === 'function' && portraitGenderOf(o.fig)) || 'm'; }
  else if (c.sex === 'm' || c.sex === 'f') o.sex = c.sex;
  else if (typeof cardsUiPortraitJob === 'function' && typeof cardsUiAvatarVar === 'function' && typeof portraitGenderOf === 'function' && (j = cardsUiPortraitJob(o))) { k = portraitGenderOf('generic/' + j + '_' + cardsUiAvatarVar(o)); if (k) o.sex = k; }
  return o;
}
function cardsNormSave(v) {
  var n, k, V;
  if (!v || typeof v !== 'object') return null;
  n = cardsStateNew(typeof v.seed === 'number' ? v.seed : undefined);
  n.seq = cardNum(v.seq, 0, 1e9, 0) | 0; n.tok = cardNum(v.tok, 0, 1e6, 0) | 0; n.nameTokens = cardNum(v.nameTokens, 0, 1e6, 0) | 0; n.namedCount = cardNum(v.namedCount, 0, 1e9, 0) | 0; n.shards = cardNum(v.shards, 0, 1e6, 0) | 0;
  if (v.shardWk) n.shardWk = { w: cardNum(v.shardWk.w, -1, 1e9, -1) | 0, n: cardNum(v.shardWk.n, 0, 1e6, 0) | 0 };
  if (v.gift) n.gift.day = cardNum(v.gift.day, -1, 1e9, -1) | 0;
  if (v.clock) n.clock.maxSeen = cardNum(v.clock.maxSeen, 0, 1e15, 0);
  if (v.tokenGiven && typeof v.tokenGiven === 'object') Object.keys(v.tokenGiven).slice(0, 600).forEach(function (k) {
    var nm = v.tokenGiven[k];
    if (k === 'named') {   // 指名券一次性旗標:{ids:{事件id:1}, rank:已記錄的官階等級}
      if (nm && typeof nm === 'object') {
        n.tokenGiven.named = { ids: {}, rank: cardNum(nm.rank, -1, 99, -1) | 0 };
        if (nm.ids && typeof nm.ids === 'object') Object.keys(nm.ids).slice(0, 600).forEach(function (e) { if (nm.ids[e] && e.length <= 40) n.tokenGiven.named.ids[e] = 1; });
      }
      return;
    }
    if (nm && k.length <= 40) n.tokenGiven[k] = 1;
  });
  CARD_VENUE_ORDER.forEach(function (x) {
    V = CARD_VENUES[x];
    n.last[x] = (v.last && typeof v.last[x] === 'number') ? (v.last[x] | 0) : -1;
    n.acc[x] = (v.acc && Array.isArray(v.acc[x])) ? v.acc[x].filter(function (s) { return typeof s === 'string' && s.indexOf(x + ':') === 0 && isFinite(cardsKeyNo(s)); }).slice(0, V.cap) : [];
    n.pity[x] = (v.pity && typeof v.pity[x] === 'number') ? Math.max(0, v.pity[x] | 0) : 0;
    if (v.cur && v.cur[x] && Array.isArray(v.cur[x].cands) && v.cur[x].cands.length === V.batch) {   // 舊存檔(或特效播放中途存檔)的未處理批次:遷入卡包(未被任用者),已任用的不動
      var cands = v.cur[x].cands.map(function (c) { return cardNormCard(c, false); });
      if (cands.every(function (c) { return !!c; })) {
        n.cur[x] = { key: String(v.cur[x].key), venue: x, cands: cands, hasUpper: !!v.cur[x].hasUpper, pityHit: !!v.cur[x].pityHit,
          named: (x === 'G' && v.cur[x].named && cardsNamedKeyOk(v.cur[x].named.mode, v.cur[x].named.key)) ? { mode: v.cur[x].named.mode, key: v.cur[x].named.key } : undefined,
          taken: cands.map(function (c, i) { var t = v.cur[x].taken && v.cur[x].taken[i]; return t === -1 ? -1 : (typeof t === 'string' ? t : 0); }) };
      }
    }
  });
  if (v.fame) { n.fame.G = Math.max(0, cardNum(v.fame.G, 0, 1e6, 0) | 0); n.fame.E = Math.max(0, cardNum(v.fame.E, 0, 1e6, 0) | 0); }
  if (v.stars && v.stars.E >= 1 && v.stars.E <= 3) n.stars.E = v.stars.E | 0;
  ['roster', 'wait', 'wander'].forEach(function (l) {
    var seen = {};
    n[l] = Array.isArray(v[l]) ? v[l].map(function (c) { return cardNormCard(c, true); }).filter(function (c) { if (!c || seen[c.id]) return false; seen[c.id] = 1; return true; }) : [];
  });
  // 卡包:正規化現有 cs.bag,再把殘留的 cur.*(舊候選批次)轉入(不自動分解;重複名人依信物規則)
  if (Array.isArray(v.bag)) {
    var seenB = {};
    n.bag = v.bag.slice(0, 600).map(function (c) { return cardNormCard(c, false, true); }).filter(function (c) { if (!c || seenB[c.bid]) return false; seenB[c.bid] = 1; return true; });
  }
  k = cardNum(v.bagSeq, 0, 1e9, 0) | 0;
  n.bag.forEach(function (c) { var m2 = /^b(\d+)$/.exec(c.bid); if (m2 && +m2[1] > k) k = +m2[1]; });
  if (k > 0) n.bagSeq = k;
  if (typeof v.bagAuto === 'number' && isFinite(v.bagAuto)) cardsBagSetAuto(n, v.bagAuto);
  CARD_VENUE_ORDER.forEach(function (x) {
    if (!n.cur[x]) return;
    cardsBagCommit(n, x, { noAuto: true });
  });
  if (Array.isArray(v.errand)) n.errand = v.errand.slice(0, 4).filter(function (q) { return q && typeof q.id === 'string' && typeof q.eid === 'string' && (q.kind === 'goods' || q.kind === 'build' || q.kind === 'study'); }).map(function (q) {   // 人物請託(npcinteract.js)
    return { id: q.id.slice(0, 12), eid: q.eid.slice(0, 12), kind: q.kind, text: String(q.text || '').slice(0, 60), day: cardNum(q.day, 0, 1e9, 0) | 0, goods: q.goods ? String(q.goods).slice(0, 24) : undefined, n: cardNum(q.n, 0, 999, 0) | 0, type: q.type ? String(q.type).slice(0, 32) : undefined, base: cardNum(q.base, 0, 9999, 0) | 0 };
  });
  if (cardNum(v.errDay, -1, 1e9, -1) > -1) n.errDay = cardNum(v.errDay, -1, 1e9, -1) | 0;
  if (cardNum(v.errSeq, 0, 1e9, 0) > 0) n.errSeq = cardNum(v.errSeq, 0, 1e9, 0) | 0;
  for (k = 0; k < n.roster.length; k++) { var m =/^r(\d+)$/.exec(n.roster[k].id); if (m && +m[1] > n.seq) n.seq = +m[1]; }
  return n;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { cardHash: cardHash, cardRng: cardRng };
