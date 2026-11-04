// js/cards.js — 卡牌與酒館引擎 第一階段(PLAN_CARDS.md v3:§2.2~2.6 三場所/招募歲鐘/品階機率與保底/名額、§3A 品階與升階、§4.13 職業詞條、§7A 名額與請辭)。
// 純資料邏輯,不寫 DOM;時間一律由呼叫端傳入 now(毫秒),模擬層不讀 Date.now()。資料表在 js/carddata.js,介面在 js/cardsui.js。
// 存檔:world.city.cards(goods.js goodsNormCity 帶過 cardsNormSave);名冊 roster 即派工用的 world.city.talents(同一批物件,不可列舉,不重複存檔)。
// 第一階段刻意未做:名冊人物/小兵卡/人物圈、取捨詞條 §4.4A、戰場技能內容(只記數量 skn)、記名簿、快速模式、文鬥小遊戲(星數固定 1)、結義。
// 全域名稱:cardsSkillList cardHash cardRng cardsStateNew cardsGet cardsNormSave cardsPeriodNo cardsSync cardsNextIn cardsVenueOpen cardsVenueTheme cardsGenBatch cardsOpenBatch
//          cardsDiscardBatch cardsCost cardsCap cardsHire cardsClaimGift cardsRelease cardsUndoRelease cardsRecall cardsUpgradeCheck cardsUpgrade cardsStats cardsJobSlots
//          cardsFind cardsSyncTalents cardsTalents cardsPatrolTalents cardsAccept cardsJobLine cardsAddTokens CARD_PIN

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
    v: 1, seed: s, seq: 0, tok: CARD_WINE.startGift, shards: 0, shardWk: { w: -1, n: 0 }, gift: { day: -1 },
    clock: { maxSeen: 0 }, last: { T: -1, E: -1, G: -1 }, acc: { T: [], E: [], G: [] }, cur: { T: null, E: null, G: null },
    pity: { T: 0, E: 0, G: 0 }, fame: { G: 0, E: 0 }, stars: { E: 1 }, roster: [], wait: [], wander: [], lastRel: null
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
function cardGenName(r) {
  var s = CARD_NAME_SUR[Math.floor(r() * CARD_NAME_SUR.length)], g = CARD_NAME_GIV[Math.floor(r() * CARD_NAME_GIV.length)];
  if (r() < 0.5) g += CARD_NAME_GIV[Math.floor(r() * CARD_NAME_GIV.length)];
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
function cardGenJobs(r, G, learn, venue, no) {
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
    pickOther(slots);
    main = Object.keys(ja)[0];
    return { ja: ja, main: main };
  }
  t = learn === 1 ? Math.min(G.jobMax, G.id >= 2 && r() < 0.5 ? 3 : 2) : (learn === 2 ? 3 : 4);
  main = cardWPick(r, jobs, w).id;
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
    slot: slot, fig: f.id, name: f.name, zi: f.zi, fac: f.fac, gr: f.gr, st: f.st.slice(), tai: f.tai, ja: jb.ja, main: jb.main, learn: f.gr === 4 ? 3 : 2,
    tr: cardFigTraitIds(f), trn: f.tr.map(function (t) { return [t[0], t[1] ? 1 : 0, t[2] || '']; }), skn: CARD_GRADE[f.gr].skn,
    org: { k: venue === 'E' ? 'pin' : V.org, v: venue === 'E' ? 0 : undefined }
  };
}
function cardGen(cs, venue, key, slot, gr, tag, opt) {
  var V = CARD_VENUES[venue], no = cardsKeyNo(key), r = cardRng(cardHash(cs.seed, venue, key, slot, tag || '')), G = CARD_GRADE[gr], card, pool, f, learn, jb, facW, i, tr;
  opt = opt || {};
  if (gr === 4) {
    pool = CARD_FIGS.filter(function (x) { return x.gr === 4; });
    return cardFromFig(pool[Math.floor(r() * pool.length)], venue, slot);
  }
  if (gr === 3 && V.bFig > 0) {
    var fm = (venue === 'E') ? Math.min(V.bFig * 2, V.bFig + 0.002 * Math.max(0, cs.fame.E - CARD_CFG.fameAfter)) : V.bFig;
    if (r() < fm) { pool = CARD_FIGS.filter(function (x) { return x.gr === 3; }); return cardFromFig(pool[Math.floor(r() * pool.length)], venue, slot); }
  }
  facW = venue === 'G' ? ((no % 5) + 5) % 5 : -1;
  f = cardWPick(r, [0, 1, 2, 3, 4], function (x) { return x === facW ? 2 : 1; });
  learn = cardPickLearn(r, G, !!opt.zhuan);
  jb = cardGenJobs(r, G, learn, venue, no);
  tr = cardGenTraits(r, G, cardRint(r, G.trN[0], G.trN[1]));
  card = { slot: slot, fig: null, name: cardGenName(r), zi: '', fac: f, gr: gr, st: cardGenStats(r, G), tai: 0, ja: jb.ja, main: jb.main, learn: learn, tr: tr, trn: null, skn: G.skn, org: { k: V.org } };
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
// 翻閱下一批:已有未處理的當批就回它;否則由 acc 取最舊期鍵生成、更新保底計數、立即成為 cs.cur(呼叫端隨後存檔)
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

// ───────── 名冊 / 延請 / 請辭 ─────────
function cardsCost(c) { return CARD_GRADE[c.gr].cost + ((c.gr === 3 && c.learn === 3) ? CARD_COST.zongBonus : 0); }
function cardsCap() { return CARD_CFG.capBase + ((typeof cardsCapBonus === 'function') ? (cardsCapBonus() | 0) : 0); }
function cardsFind(cs, id) {
  var lists = ['roster', 'wait', 'wander'], i, j;
  for (i = 0; i < lists.length; i++) for (j = 0; j < cs[lists[i]].length; j++) if (cs[lists[i]][j].id === id) return { e: cs[lists[i]][j], list: lists[i], idx: j };
  return null;
}
function cardsFindFig(cs, fig) {
  var lists = ['roster', 'wait', 'wander'], i, j;
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
// 延請:回 {ok, reason?, entry?, token?}。reason:none 無此人/已處理 tok 酒令不足 full 名額與待定席皆滿 maxtok 信物已滿
function cardsHire(cs, venue, slot) {
  var b = cs.cur[venue], c, cost, owner, e, wait = false;
  if (!b || !b.cands[slot] || b.taken[slot]) return { ok: false, reason: 'none' };
  c = b.cands[slot]; cost = cardsCost(c);
  if (cs.tok < cost) return { ok: false, reason: 'tok' };
  if (c.fig && (owner = cardsFindFig(cs, c.fig))) {
    if ((owner.tok || 0) >= CARD_CFG.tokMax) return { ok: false, reason: 'maxtok' };
    cs.tok -= cost; owner.tok = (owner.tok || 0) + 1; b.taken[slot] = -1; cs.lastRel = null;
    return { ok: true, token: true, entry: owner };
  }
  if (cs.roster.length >= cardsCap()) {
    if (cs.wait.length >= CARD_CFG.waitSeats) return { ok: false, reason: 'full' };
    wait = true;
  }
  e = {
    id: 'r' + (++cs.seq), no: cs.seq, name: c.name, zi: c.zi, fig: c.fig, fac: c.fac, gr: c.gr, st: c.st.slice(), tai: c.tai, ja: JSON.parse(JSON.stringify(c.ja)), main: c.main,
    learn: c.learn, tr: c.tr.slice(), trn: c.trn ? c.trn.map(function (t) { return t.slice(); }) : null, skn: c.skn, org: { k: c.org.k, v: c.org.v }, pool: venue, key: b.key,
    at: null, star: 0, tok: 0, up: 0, cost: cost
  };
  cardsRefreshEntry(e);
  cs.tok -= cost; b.taken[slot] = e.id; cs.lastRel = null;
  if (wait) cs.wait.push(e); else cs.roster.push(e);
  return { ok: true, entry: e, wait: wait };
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
function cardNormCard(c, isEntry) {
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
    o.up = cardNum(c.up, 0, CARD_CFG.upMax, 0) | 0; o.cost = cardNum(c.cost, 0, 99, CARD_GRADE[o.gr].cost) | 0;
    cardsRefreshEntry(o);
  } else o.slot = cardNum(c.slot, 0, 6, 0) | 0;
  j = 0;
  return o;
}
function cardsNormSave(v) {
  var n, k, V;
  if (!v || typeof v !== 'object') return null;
  n = cardsStateNew(typeof v.seed === 'number' ? v.seed : undefined);
  n.seq = cardNum(v.seq, 0, 1e9, 0) | 0; n.tok = cardNum(v.tok, 0, 1e6, 0) | 0; n.shards = cardNum(v.shards, 0, 1e6, 0) | 0;
  if (v.shardWk) n.shardWk = { w: cardNum(v.shardWk.w, -1, 1e9, -1) | 0, n: cardNum(v.shardWk.n, 0, 1e6, 0) | 0 };
  if (v.gift) n.gift.day = cardNum(v.gift.day, -1, 1e9, -1) | 0;
  if (v.clock) n.clock.maxSeen = cardNum(v.clock.maxSeen, 0, 1e15, 0);
  CARD_VENUE_ORDER.forEach(function (x) {
    V = CARD_VENUES[x];
    n.last[x] = (v.last && typeof v.last[x] === 'number') ? (v.last[x] | 0) : -1;
    n.acc[x] = (v.acc && Array.isArray(v.acc[x])) ? v.acc[x].filter(function (s) { return typeof s === 'string' && s.indexOf(x + ':') === 0 && isFinite(cardsKeyNo(s)); }).slice(0, V.cap) : [];
    n.pity[x] = (v.pity && typeof v.pity[x] === 'number') ? Math.max(0, v.pity[x] | 0) : 0;
    if (v.cur && v.cur[x] && Array.isArray(v.cur[x].cands) && v.cur[x].cands.length === V.batch) {
      var cands = v.cur[x].cands.map(function (c) { return cardNormCard(c, false); });
      if (cands.every(function (c) { return !!c; })) {
        n.cur[x] = { key: String(v.cur[x].key), venue: x, cands: cands, hasUpper: !!v.cur[x].hasUpper, pityHit: !!v.cur[x].pityHit,
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
  for (k = 0; k < n.roster.length; k++) { var m = /^r(\d+)$/.exec(n.roster[k].id); if (m && +m[1] > n.seq) n.seq = +m[1]; }
  return n;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { cardHash: cardHash, cardRng: cardRng };
