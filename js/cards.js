// js/cards.js — 卡牌與酒館引擎 第一階段(PLAN_CARDS.md v3:§2.2~2.6 三場所/招募歲鐘/品階機率與保底/名額、§3A 品階與升階、§4.13 職業詞條、§7A 名額與遣散;第四批決議:名人加權抽取)。
// 2026-11-09 使用者決議:移除酒令與『任用』—— 抽到的卡直接進名冊(名冊滿了先放卡包 cs.bag,有空位自動補進);酒館 / 縣試改『每日一抽』(CARD_DRAW:每批 4~7 張、每 24~8 小時一批,離線最多 2 批)。舊存檔一次性遷移見 cardsNormSave(cs.v 2)。
// 2026-11-09 再改『抽卡次數制』:全域次數錢包 cs.pl = {n 可抽次數, t 下次補充時間戳, tot 累計抽數}(酒館 / 縣試池共用),依 CARD_DRAW 階梯每 8~24 小時 +4~7 抽(離線補算),累積上限 CARD_DRAW.cap;單抽 / 連抽走 cardsPullStage;頭目首通贈抽 cardsBossGive(cs.boss 防重領);cs.v 3。
// 純資料邏輯,不寫 DOM;時間一律由呼叫端傳入 now(毫秒),模擬層不讀 Date.now()。資料表在 js/carddata.js,介面在 js/cardsui.js。
// 存檔:world.city.cards(goods.js goodsNormCity 帶過 cardsNormSave);名冊 roster 即派工用的 world.city.talents(同一批物件,不可列舉,不重複存檔)。
// 第一階段刻意未做:名冊人物/小兵卡/人物圈、取捨詞條 §4.4A、戰場技能內容(只記數量 skn)、記名簿、快速模式、文鬥小遊戲(星數固定 1)、結義。
// 全域名稱:cardsSkillList cardHash cardRng cardsStateNew cardsGet cardsNormSave cardsPeriodNo cardsSync cardsNextIn cardsVenueOpen cardsVenueTheme cardsGenBatch cardsOpenBatch
//          cardsDiscardBatch cardsCost cardsCap cardsRelShards cardsRosterRoom cardsRosterFill cardsDrawTier cardsDrawSize cardsMigNoteTake cardsRelease cardsUndoRelease cardsRecall cardsStats cardsJobSlots
//          cardsGenNamed cardsNamedDraw cardsNamedOpen cardsAddNameTokens cardsNamedGive cardsNamedRankCheck cardsNamedTick cardsNamedKeyOk
//          cardsBagAutoLv cardsBagSetAuto cardsBagStage cardsBagCommit cardsBagOpen cardsBagFlush cardsRosterFind cardsRosterList cardsBagPick
//          cardsBagDissolve cardsBagDissolveValue cardsFurnaceValue cardsFurnaceSum cardsShardGain cardFigWeight cardsBagCanOpen
//          (2026-11-10:卡包 cs.bag / 溢出區 cs.bagOver 已移除;cardsBagCap / cardsBagRoom / cardsBagPut / cardsBagFind / cardsBagEnlist / cardsRosterFill / cardsOver* 刪除)
//          cardsWeekNo cardsStarLv cardsStarCost cardsStarUp cardsStarBonus cardsExchangeLeft cardsExchange
//          cardsFind cardsSyncTalents cardsTalents cardsPatrolTalents cardsAccept cardsJobLine cardsOnTechDone cardsRankLv CARD_PIN

var CARD_PIN = ['上上', '上中', '上下', '中上', '中中', '中下', '下上', '下中', '下下'];
var CARD_RECALL_COST = CARD_DRAW.recallShard;   // 請回流浪名人的碎片(原 10 酒令)

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
    v: 5, pl: { n: 0, t: 0, tot: 0 }, boss: {}, seed: s, seq: 0, nameTokens: 0, namedCount: 0, shards: 0, dr: {},
    clock: { maxSeen: 0 }, tokenGiven: {}, last: { T: -1, E: -1, G: -1 }, acc: { T: [], E: [], G: [] }, cur: { T: null, E: null, G: null },
    pity: { T: 0, E: 0, G: 0 }, fame: { G: 0, E: 0 }, stars: { E: 1 }, roster: [], wait: [], wander: [], lastRel: null, starter: { done: 0 }
  };
}
function cardsGet() {
  var c = null;
  if (typeof goodsCity === 'function') c = goodsCity();
  else if (typeof world !== 'undefined' && world) c = world.city;
  if (!c) return null;
  if (!c.cards) { c.cards = cardsStateNew(); if (typeof tutHas === 'function' && !tutHas()) c.cards.starter.old = 1; }   // 沒有教學資料的城 = 舊存檔:新手禮包待判定(cardsStarterState)
  return c.cards;
}
// 科技 / 里程碑完成(citytech.js 的 techFinish、techBigDone 呼叫):每節點只處理一次(cs.tokenGiven)。里程碑 +碎片(原 +10 酒令)與指名券 +1;
// 該科技若是抽卡節奏階梯(CARD_DRAW)的一階,提示升級內容。遷移出來的已研科技不走此路,不補發。回發放碎片數
function cardsOnTechDone(id, big) {
  var cs = cardsGet(), g, node, n = 0, name, up;
  if (!cs || !id) return 0;
  g = cs.tokenGiven || (cs.tokenGiven = {});
  if (g[id]) return 0;
  node = (typeof techNode === 'function') ? techNode(id) : null;
  big = !!big || String(id).indexOf('mg_') === 0;
  g[id] = 1;
  name = (node && ((typeof techLabelOf === 'function') ? techLabelOf(node) : node.name)) || id;
  if (big) {
    n = CARD_DRAW.mileShard;
    cardsShardGain(cs, n);
    cardsNamedGive(cs, id, '完成里程碑');   // 指名券占位來源:里程碑 +1(每節點一次)
    if (typeof showToast === 'function') showToast('完成〈' + name + '〉,得碎片 +' + n);
  }
  up = cardsDrawUpText(id);
  if (up && typeof showToast === 'function') showToast('研成〈' + name + '〉:' + up);
  return n;
}

// ───────── 抽卡節奏『抽卡次數制』(CARD_DRAW) ─────────
function cardsDrawStep(list) {   // 已研成的最高一階(第 0 階無科技)
  var k = 0, i;
  for (i = 1; i < list.length; i++) if (list[i].tech && typeof techDone === 'function' && techDone(list[i].tech)) k = i;
  return k;
}
// 目前節奏:{n 每批張數, h 間隔小時, ms 間隔毫秒, sizeLv, gapLv}
function cardsDrawTier() {
  var D = CARD_DRAW, s = cardsDrawStep(D.size), g = cardsDrawStep(D.gap);
  return { n: D.size[s].n, h: D.gap[g].h, ms: D.gap[g].h * 3600000, sizeLv: s, gapLv: g };
}
function cardsDrawSize() { return cardsDrawTier().n; }
// 某科技對應的節奏升級說明(不是階梯科技回 '')
function cardsDrawUpText(id) {
  var D = CARD_DRAW, out = [];
  D.size.forEach(function (x) { if (x.tech === id) out.push('每次補充 ' + x.n + ' 抽'); });
  D.gap.forEach(function (x) { if (x.tech === id) out.push('每 ' + x.h + ' 小時補充一次'); });
  return out.join('、');
}
// 舊存檔遷移提示(cardsNormSave 寫 cs.migNote):取走並清除;回提示字或 ''
function cardsMigNoteTake(cs) {
  var m = cs && cs.migNote;
  if (!m) return '';
  delete cs.migNote;
  return '卡包改版:改為抽卡次數制,依時間累積(上限 ' + CARD_DRAW.cap + ' 抽)' + (m.pl ? ';原有待抽批次已換成 ' + m.pl + ' 抽' : '') + (m.sh ? ';酒令已換成碎片 ' + m.sh : '') + '。';
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
// 次數累積(抽卡次數制):回 {frozen, added}。cs.pl = {n 可抽次數, t 下一次補充時間戳, tot 累計抽數};第一次呼叫只設定下次補充時間(新手禮另給)。
// 每到 t 補 cardsDrawTier().n 抽(離線期間依經過的間隔數一次補算),n 已達 CARD_DRAW.cap 時時間照走、不再增加(新手禮 / 贈抽可使 n 超過 cap,不被截斷)。
// 時鐘回撥:沿用 maxSeen − paceMin 凍結;科技縮短間隔或小幅回撥時,下一次補充最多再等一個間隔。isOpen 參數保留相容(次數與卡池開放無關)。
function cardsSync(cs, now, isOpen) {
  var floor = cs.clock.maxSeen - CARD_CFG.paceMin * 60000, res = { frozen: false, added: 0 }, T, pl, k, room;
  if (cs.clock.maxSeen > 0 && now < floor) { res.frozen = true; return res; }
  if (now > cs.clock.maxSeen) cs.clock.maxSeen = now;
  pl = cs.pl || (cs.pl = { n: 0, t: 0, tot: 0 });
  T = cardsDrawTier();
  if (!(pl.t > 0)) { pl.t = now + T.ms; return res; }
  if (pl.t - now > T.ms) pl.t = now + T.ms;
  if (now < pl.t) return res;
  k = Math.floor((now - pl.t) / T.ms) + 1;
  room = Math.max(0, CARD_DRAW.cap - pl.n);
  res.added = Math.min(room, k * T.n);
  pl.n += res.added;
  pl.t += k * T.ms;
  return res;
}
// 距下次補充毫秒;次數已滿(≥ cap)回 null(UI 不顯示倒數)。venue 參數保留相容(全池共用)
function cardsNextIn(cs, venue, now) {
  var pl = cs.pl;
  if (!pl || pl.n >= CARD_DRAW.cap) return null;
  if (!(pl.t > 0)) return 0;
  return Math.max(0, Math.min(pl.t - now, cardsDrawTier().ms));
}
function cardsPulls(cs) { return (cs && cs.pl) ? Math.max(0, cs.pl.n | 0) : 0; }
// 贈抽(新手禮 / 頭目首通 / 任務):直接加次數,不受累積上限截斷。回加了多少
function cardsPullGrant(cs, n) {
  n = Math.max(0, n | 0);
  if (!cs.pl) cs.pl = { n: 0, t: 0, tot: 0 };
  cs.pl.n = Math.min(1e6, (cs.pl.n | 0) + n);
  return n;
}
// 舊存檔補領:討伐存檔 clearMap({關卡id: 星數})中已通關的頭目關,尚未記在 cs.boss 的補發一次。回補發抽數
function cardsBossRetro(cs, clearMap) {
  var n = 0;
  if (!cs || !clearMap || typeof BN_STAGES === 'undefined') return 0;
  BN_STAGES.forEach(function (st) { if (st.boss && (clearMap[st.id] | 0) >= 1 && !(cs.boss && cs.boss[st.id])) n += cardsBossGive(cs, st.id); });
  return n;
}
// 頭目首通贈抽:id = 關卡 id('1-6'…);cs.boss[id] 記錄,同一關只發一次。回發放抽數(已領過 / 參數錯 = 0)
function cardsBossGive(cs, id, n) {
  var key = String(id || '');
  if (!cs || !key || key.length > 12) return 0;
  if (!cs.boss) cs.boss = {};
  if (cs.boss[key]) return 0;
  n = (n === undefined) ? CARD_BOSS.pulls : Math.max(0, n | 0);
  cs.boss[key] = 1;
  return cardsPullGrant(cs, n);
}
// 本期主題(顯示用):酒館酒客風向、縣試科目、殿試本日陣營
function cardsVenueTheme(venue, no) {
  if (venue === 'T') { var row = CARD_ROWS[Math.floor(no / 4) % CARD_ROWS.length]; return { kind: 'wind', row: row, text: '酒客風向:' + row }; }
  if (venue === 'E') { var s = CARD_EXAM_SUBJECTS[no % CARD_EXAM_SUBJECTS.length]; return { kind: 'subject', subject: s, text: '科目:' + s.name }; }
  var fl = cardsFacGen(), f = fl[((no % fl.length) + fl.length) % fl.length];
  return { kind: 'faction', fac: f, text: '本日:' + CARD_FAC[f] };
}
// 世界的名人來源與陣營(js/fx_cards.js:魔幻世界 = 42 位傳說英雄與 9 個魔幻陣營;歷史世界 = CARD_FIGS 與 0~4,行為不變)
function cardsFigSrc() { return (typeof fxFigSrc === 'function' && fxFigSrc()) || CARD_FIGS; }
function cardsFacList() { return (typeof fxFacList === 'function' && fxFacList()) || [0, 1, 2, 3, 4]; }   // 指名可選陣營
function cardsFacGen() { return (typeof fxFacGen === 'function' && fxFacGen()) || [0, 1, 2, 3, 4]; }     // 路人卡陣營 / 殿試本日陣營
function cardsFigPool(gr, fac) {
  var src = cardsFigSrc(), pool = src.filter(function (x) { return x.gr === gr && (fac === undefined || x.fac === fac); });
  return pool.length ? pool : src.filter(function (x) { return x.gr === gr; });
}

// ───────── 候選人生成(§3A.2、§4.13.4) ─────────
// 性別('m'/'f'):與頭像性別綁定(js/portrait_gender.js、cardsui.js cardsUiAvatarVar);名字用字依性別分池
var CARD_NAME_GIV_F = ['婉', '貞', '蘭', '梅', '秀', '英', '蓮', '芳', '淑', '慧', '娥', '姬', '嫻', '春', '巧', '雲', '珍', '玉', '翠', '柔', '嬌', '菊', '荷', '霞', '月', '纖', '織', '娘'];
var CARD_NAME_GIV_M = CARD_NAME_GIV.filter(function (x) { return ['玉', '織', '純'].indexOf(x) < 0; });
function cardGenSex(cs, venue, key, slot, tag) { return cardRng(cardHash(cs.seed, venue, key, slot, (tag || '') + '|sex'))() < 0.42 ? 'f' : 'm'; }
function cardGenName(r, sex) {
  var fxn = (typeof fxGenName === 'function') ? fxGenName(r, sex) : null;   // 魔幻世界:依族取名(js/fx_text.js);歷史世界回 null、不耗亂數
  if (fxn) return fxn;
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
  w = (typeof w === 'number' && w > 0) ? w : (f.gr === 4 ? 10 : 6);
  return (typeof fxFigRaceMul === 'function') ? w * fxFigRaceMul(f) : w;   // 魔幻世界:他族英雄(遠客)×0.3
}
function cardGen(cs, venue, key, slot, gr, tag, opt) {
  var V = CARD_VENUES[venue], no = cardsKeyNo(key), r = cardRng(cardHash(cs.seed, venue, key, slot, tag || '')), G = CARD_GRADE[gr], card, pool, f, learn, jb, facW, i, tr;
  opt = opt || {};
  if (gr === 4) {
    pool = cardsFigPool(4, opt.fac);
    return cardFromFig(cardWPick(r, pool, cardFigWeight), venue, slot);   // 金階名人依 CARD_FIG_WEIGHT 加權
  }
  if (gr === 3 && V.bFig > 0 && !opt.noFig) {
    var fm = (venue === 'E') ? Math.min(V.bFig * 2, V.bFig + 0.002 * Math.max(0, cs.fame.E - CARD_CFG.fameAfter)) : V.bFig;
    if (r() < fm) {
      pool = cardsFigPool(3, opt.fac);
      if (pool.length) return cardFromFig(cardWPick(r, pool, cardFigWeight), venue, slot);   // 紫階名人依 CARD_FIG_WEIGHT 加權
    }
  }
  var sex = cardGenSex(cs, venue, key, slot, tag);
  facW = venue === 'G' ? cardsVenueTheme('G', no).fac : -1;
  f = opt.fac !== undefined ? opt.fac : cardWPick(r, cardsFacGen(), function (x) { return x === facW ? 2 : 1; });
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
  if (typeof cardsNbOn === 'function' && cardsNbOn(cs, venue)) p = CARD_STARTER.nbGr[venue].slice();   // 新手期品階機率(CARD_STARTER;js/cards_starter.js)
  if (venue === 'G') {
    var gold = Math.min(CARD_CFG.goldMax, p[4] + Math.max(0, cs.fame.G - CARD_CFG.fameAfter) * CARD_CFG.fameStep);
    p[0] -= gold - p[4]; p[4] = gold;
  }
  for (i = 0; i < 5; i++) { acc += p[i]; if (x < acc) return i; }
  return p[4] > 0 ? 4 : 0;
}
// 生成一次抽卡結果(酒館 / 縣試池 = size 張,size 預設一階的次數;含逐張保底與連抽底線);不改 cs,只讀 cs.pity/fame/seed。回 {key, venue, cands, hasUpper, pityHit, pityEnd}
// 逐張保底:cs.pity[v] = 連續沒出上等(V.upper)的張數,達 CARD_DRAW.pity 後下一張必出上等;連抽 ≥ floorMin 張才套用批內底線(V.floor)。舊殿試池(G)沿用整批規則
function cardsGenBatch(cs, venue, key, size) {
  var V = CARD_VENUES[venue], cands = [], i, star = cs.stars[venue] || 1, pityHit = false, best, rep = [], p, pityN, nb = (typeof cardsNbOn === 'function' && cardsNbOn(cs, venue)), c;
  function highest() { var b = 0, k; for (k = 1; k < cands.length; k++) if (cands[k].tai > cands[b].tai) b = k; return b; }
  if (venue === 'G') {
    for (i = 0; i < V.batch; i++) cands.push(cardGen(cs, venue, key, i, cardRollGr(cs, venue, key, i, star)));
    if (!cands.some(function (x) { return cardIsUpper(x, V); }) && cs.pity[venue] >= CARD_CFG.pityBatches) {
      best = highest(); cands[best] = cardGen(cs, venue, key, best, V.upper.gr, 'pity', { zhuan: !!V.upper.zhuan }); pityHit = true; rep.push(best);
    }
    if (!cands.some(function (x) { return x.gr >= V.floor; })) { best = highest(); cands[best] = cardGen(cs, venue, key, best, V.floor, 'floor'); rep.push(best); }
    return { key: key, venue: venue, cands: cands, hasUpper: cands.some(function (x) { return cardIsUpper(x, V); }), pityHit: pityHit, pityEnd: 0 };
  }
  size = Math.max(1, Math.min((size | 0) || cardsDrawSize(), CARD_DRAW.maxOne));
  pityN = CARD_DRAW.pity;
  for (i = 0; i < size; i++) cands.push(cardGen(cs, venue, key, i, cardRollGr(cs, venue, key, i, star)));
  if (nb) cardsNbPity(cs, venue, key, cands);   // 新手期逐張保底(紫 / 金)
  p = cs.pity[venue] | 0;
  for (i = 0; i < cands.length; i++) {   // 連續保底(逐張)
    if (p >= pityN && !cardIsUpper(cands[i], V)) { cands[i] = cardGen(cs, venue, key, i, V.upper.gr, 'pity', { zhuan: !!V.upper.zhuan }); pityHit = true; rep.push(i); }
    p = cardIsUpper(cands[i], V) ? 0 : p + 1;
  }
  if (size >= CARD_DRAW.floorMin) {
    if (!cands.some(function (x) { return x.gr >= V.floor; })) { best = highest(); cands[best] = cardGen(cs, venue, key, best, V.floor, 'floor'); rep.push(best); }
  }
  p = cs.pity[venue] | 0;
  cands.forEach(function (x) { p = cardIsUpper(x, V) ? 0 : p + 1; });
  return { key: key, venue: venue, cands: cands, hasUpper: cands.some(function (x) { return cardIsUpper(x, V); }), pityHit: pityHit, pityEnd: p, nb: nb ? cardsNbCount(cs, cands) : undefined };
}
// 抽 n 次:扣次數、依 cs.pl.tot 起算期鍵生成結果、更新保底計數、成為 cs.cur[v](= 『待入包批次』,隨後由 cardsBagCommit 放進名冊 / 卡包)。已有待入包批次就回它(不扣)
function cardsOpenBatch(cs, venue, n) {
  var b, key, V = CARD_VENUES[venue];
  if (cs.cur[venue]) return cs.cur[venue];
  if (venue === 'G') return null;
  n = Math.max(1, Math.min(n | 0 || 1, CARD_DRAW.maxOne, cardsPulls(cs)));
  if (cardsPulls(cs) < 1) return null;
  key = cardsKey(venue, cs.pl.tot | 0);
  b = cardsGenBatch(cs, venue, key, n);
  cs.pl.n -= b.cands.length; cs.pl.tot = (cs.pl.tot | 0) + b.cands.length;
  cs.pity[venue] = b.pityEnd | 0;
  if (venue === 'E') cs.fame.E = b.cands.some(function (c) { return !!c.fig; }) ? 0 : cs.fame.E + 1;
  if (b.nb) { cs.starter.nb = b.nb; delete b.nb; }   // 新手期計數(張數 / 距上次紫以上 / 距上次金)
  delete b.pityEnd;
  b.taken = b.cands.map(function () { return 0; });
  cs.cur[venue] = b;
  return b;
}
function cardsDiscardBatch(cs, venue) { cs.cur[venue] = null; }

// ───────── 指定池(取代殿試池;PLAN_INTERIORS I-1):不靠計時,消耗『指名券』(cs.nameTokens)。結果批次放 cs.cur.G(同殿試的存檔格式,pool 'G')─────────
// mode 'fac' key = 陣營 0~4(CARD_FAC 序;魔幻世界 = cardsFacList() 的 5~13);mode 'row' key = 職業分類字(CARD_ROWS)。名人只在 fac 模式出現;row 模式的金檔降為紫。
function cardsNamedKeyOk(mode, key) {
  if (mode === 'fac') return typeof key === 'number' && cardsFacList().indexOf(key) >= 0;
  if (mode === 'row') return CARD_ROWS.indexOf(key) >= 0;
  return false;
}
function cardsNamedOpen(cs) { return cardsVenueOpen('G') || !!(cs && cs.starter && (cs.starter.nt | 0) > 0); }   // 開放條件沿用原殿試閘(科技 dianshi);新手禮包的指名券(cs.starter.nt)未研發也可用
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
  if (!cardsNamedOpen(cs)) return { ok: false, reason: 'closed' };
  if (!cardsNamedKeyOk(mode, key)) return { ok: false, reason: 'bad' };
  if (cs.cur.G) return { ok: false, reason: 'busy' };
  if (!cardsBagCanOpen(cs)) return { ok: false, reason: 'bagfull' };
  if ((cs.nameTokens | 0) < 1) return { ok: false, reason: 'ticket' };
  b = cardsGenNamed(cs, mode, key, cs.namedCount | 0);
  cs.nameTokens -= 1; cs.namedCount = (cs.namedCount | 0) + 1;
  if (cs.starter && (cs.starter.nt | 0) > 0) cs.starter.nt--;
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
// 主迴圈掛點(main.js frame):每 5 秒檢查一次官階、溢出區與『名冊有空位 → 卡包的卡補進名冊』;舊存檔遷移提示只跳一次。無資料 / 例外一律略過
function cardsNamedTick(dt) {
  var cs, m;
  cardsNamedClock += dt || 0;
  if (cardsNamedClock < 5) return 0;
  cardsNamedClock = 0;
  try {
    if (typeof npcTick === 'function') npcTick(5);   // npcTick:人物互動(親近年資 / 請託)
    cs = cardsGet();
    if (!cs) return 0;
    m = cardsMigNoteTake(cs);
    if (m && typeof showToast === 'function') showToast(m);
    return cardsNamedRankCheck(cs);
  } catch (e) { return 0; }
}

// ───────── 名冊 / 遣散 ─────────
// 卡的『身價』(白1 青2 藍4 紫8 金16,紫宗師 +4):記在名冊項目 e.cost,只用來算遣散碎片(cardsRelShards);不再是花費
function cardsCost(c) { return CARD_GRADE[c.gr].cost + ((c.gr === 3 && c.learn === 3) ? CARD_COST.zongBonus : 0); }
function cardsRelShards(e) { return Math.round((e.cost || CARD_GRADE[e.gr].cost) * CARD_DRAW.relRate); }
// 官階等級 1~(LH_RANKS 序號 + 1);缺 lordhallui / cityscore 時回 0(名額退回 capBase)
function cardsRankLv() {
  var s, r, i;
  if (typeof lordhallRank !== 'function' || typeof cityscoreGet !== 'function') return 0;
  try { s = cityscoreGet(false); r = lordhallRank(s ? s.pop : 0, s ? s.pros : 0); } catch (e) { return 0; }
  if (typeof r === 'number') return Math.max(0, r | 0);
  if (typeof LH_RANKS !== 'undefined') for (i = 0; i < LH_RANKS.length; i++) if (LH_RANKS[i].n === r) return i + 1;
  return 0;
}
// 名冊格數固定 CARD_CFG.cap(300),不隨官階(2026-11-10 決議)。滿了停止抽卡,需先熔鍊或遣散。
function cardsCap() { return CARD_CFG.cap; }
function cardsFind(cs, id) {
  var lists = ['roster', 'wait', 'wander'], i, j;
  for (i = 0; i < lists.length; i++) for (j = 0; j < cs[lists[i]].length; j++) if (cs[lists[i]][j].id === id) return { e: cs[lists[i]][j], list: lists[i], idx: j };
  return null;
}
function cardsFindFig(cs, fig) {   // 名冊 / 待定席 / 流浪:名人同時只會有一份(重複抽到轉信物 / 碎片)
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
// ───────── 抽卡入冊 / 熔鍊 / 自動熔爐(2026-11-10:卡包 cs.bag 與溢出區 cs.bagOver 已移除;抽到的卡直接進名冊,名冊滿 CARD_CFG.cap 停止抽卡) ─────────
// 流程:cardsBagStage(開批,批次暫放 cs.cur[v];名冊無空位回 bagfull、不扣次數)→(可選)抽卡特效→ cardsBagCommit(進名冊;重複名人轉信物 / 碎片;白階依設定自動熔爐)。cardsBagOpen = 兩步連做。
function cardsBagAutoLv(cs) {   // 自動熔爐門檻:-1 = 關,0~autoMax = 品階 ≤ 此值的路人自動熔爐(未設定 = autoDefault)
  var a = cs.bagAuto;
  return (typeof a !== 'number' || !isFinite(a)) ? CARD_BAG.autoDefault : Math.max(-1, Math.min(CARD_BAG.autoMax, a | 0));
}
function cardsBagSetAuto(cs, lv) {   // 自動熔爐門檻;回設定後的值;等於預設時刪欄位(有值才寫)
  lv = Math.max(-1, Math.min(CARD_BAG.autoMax, lv | 0));
  if (lv === CARD_BAG.autoDefault) delete cs.bagAuto; else cs.bagAuto = lv;
  return lv;
}
// 卡片熔爐碎片(碎片值集中於 carddata.js CARD_FURNACE):路人 白2 青4 藍8 紫16(宗師型 +8)、帶星(starLv)額外 +星數 × 品階基礎 × 0.5;名人手動熔 紫20 金40
function cardsFurnaceValue(c) {
  var F = CARD_FURNACE, base, v;
  if (c.fig) return F.fig[c.gr] || F.fig[4];
  base = F.shard[Math.min(c.gr, F.shard.length - 1)];
  v = base + (c.learn === 3 ? F.zongBonus : 0);
  if (c.starLv > 0) v += Math.round(c.starLv * base * F.starHalf);
  return v;
}
function cardsBagDissolveValue(c) { return cardsFurnaceValue(c); }   // 舊名保留(= cardsFurnaceValue)
// 名冊內找人(熔鍊 / 熔爐的對象只看名冊):回 {c, idx} 或 null
function cardsRosterFind(cs, id) {
  var i;
  for (i = 0; i < cs.roster.length; i++) if (cs.roster[i].id === id) return { c: cs.roster[i], idx: i };
  return null;
}
// 熔爐可熔的人:名冊內、未鎖定(🔒)、未派駐;名人另由 figOk 決定
function cardsRosterMeltable(c) { return !c.star && !c.at; }
// 熔爐預覽:ids 為名冊 entry id;figOk = false 時名人不計入(skippedFig);鎖定 / 派駐者不計入(skippedLock)。回 {n, shards, top, figs, skippedFig, skippedLock}
function cardsFurnaceSum(cs, ids, figOk) {
  var o = { n: 0, shards: 0, top: 0, figs: 0, skippedFig: 0, skippedLock: 0 }, seen = {};
  (ids || []).forEach(function (id) {
    var f = cardsRosterFind(cs, id);
    if (!f || seen[id]) return;
    seen[id] = 1;
    if (f.c.fig && !figOk) { o.skippedFig++; return; }
    if (!cardsRosterMeltable(f.c)) { o.skippedLock++; return; }
    if (f.c.fig) o.figs++;
    o.n++; o.shards += cardsFurnaceValue(f.c); if (f.c.gr > o.top) o.top = f.c.gr;
  });
  return o;
}
// 碎片入帳:同一碎片池 cs.shards(無週上限)。回 {shards 實得, tokens 0, lost 0}(後兩欄保留給舊呼叫端)
function cardsShardGain(cs, shards) {
  var add = Math.max(0, shards | 0);
  cs.shards += add;
  return { shards: add, tokens: 0, lost: 0 };
}
function cardsRosterRoom(cs) { return Math.max(0, cardsCap() - cs.roster.length); }
// 抽 n 張(整數;省略 = batchNeed)需要名冊空位 >= n
function cardsBagCanOpen(cs, n) { return cardsRosterRoom(cs) >= Math.max(1, n | 0 || CARD_BAG.batchNeed); }
// 名冊搜尋用的正規化(srNorm 在 search.js;測試環境沒有時退回小寫去空白)
function cardsRosterQ(s) {
  var t = String(s || '');
  return (typeof srNorm === 'function') ? srNorm(t) : t.toLowerCase().replace(/\s+/g, '');
}
// 兵種(bn_units.js bnDefaultTroop 的結果:槍 騎 盾 弓 謀);無 bn 模組時 ''
function cardsRosterTroop(e) {
  var t = (typeof bnDefaultTroop === 'function') ? bnDefaultTroop(e) : '';
  return t || '';
}
function cardsRosterHay(e) {   // 搜尋範圍:名字、字、職業、陣營、兵種
  return cardsRosterQ([e.name, e.zi, cardsJobLine(e), CARD_FAC[e.fac] || '', cardsRosterTroop(e)].join('|'));
}
// 名冊列表:f {q 搜尋字, gr 品階 -1 全部, fac 陣營 -1 全部, troop 兵種字 '' 全部, kind '' / 'fig' 名人 / 'gen' 路人, dep 只看已派駐, sort 'gr' 品階 / 'name' 名字 / 'star' 星數 / 'new' 最新}
function cardsRosterList(cs, f) {
  var o = f || {}, q = o.q ? cardsRosterQ(o.q) : '', list;
  list = cs.roster.filter(function (e) {
    if (typeof o.gr === 'number' && o.gr >= 0 && e.gr !== o.gr) return false;
    if (typeof o.fac === 'number' && o.fac >= 0 && e.fac !== o.fac) return false;
    if (o.troop && cardsRosterTroop(e) !== o.troop) return false;
    if (o.kind === 'fig' && !e.fig) return false;
    if (o.kind === 'gen' && e.fig) return false;
    if (o.dep && !e.at) return false;
    if (q && cardsRosterHay(e).indexOf(q) < 0) return false;
    return true;
  });
  list.sort(function (a, b) {
    if (o.sort === 'new') return b.no - a.no;
    if (o.sort === 'name') return a.name < b.name ? -1 : (a.name > b.name ? 1 : a.no - b.no);
    if (o.sort === 'star') return (cardsStarLv(b) - cardsStarLv(a)) || (b.gr - a.gr) || (a.no - b.no);
    return (b.gr - a.gr) || (b.tai - a.tai) || (a.no - b.no);
  });
  return list;
}
// 一鍵熔爐 / 自動候選:名冊內路人、品階 ≤ maxGr、可熔(未鎖定、未派駐);名人永不入選。回 entry id 陣列
function cardsBagPick(cs, maxGr) {
  return cs.roster.filter(function (c) { return !c.fig && cardsRosterMeltable(c) && c.gr <= maxGr; }).map(function (c) { return c.id; });
}
// 開批(抽卡):n 次(受次數與名冊空位限制;空位不足回 bagfull,不扣次數)。reason none 次數不足 busy 上一批尚未入冊 bagfull 名冊已滿 closed 卡池未開放 bad 參數錯
function cardsBagStage(cs, venue, n) {
  var b, room;
  if (venue !== 'T' && venue !== 'E') return { ok: false, reason: 'bad' };
  if (!cardsVenueOpen(venue)) return { ok: false, reason: 'closed' };
  if (cs.cur[venue]) return { ok: false, reason: 'busy' };
  n = Math.max(1, Math.min(n | 0 || 1, CARD_DRAW.maxOne));
  if (cardsPulls(cs) < 1) return { ok: false, reason: 'none' };
  n = Math.min(n, cardsPulls(cs));
  room = cardsRosterRoom(cs);
  if (room < 1) return { ok: false, reason: 'bagfull' };
  n = Math.min(n, room);   // 空位不足時只開到名冊剩餘格數(實際張數以 r.cards.length 為準)
  b = cardsOpenBatch(cs, venue, n);
  return { ok: true, batch: b, cards: b.cands };
}
// 把待入冊批次放進名冊。o {now, noAuto, noSync(讀檔正規化時不同步派工接口)}。
// 每張的去向 how:roster 入名冊 / auto 白階依設定自動熔爐 / token 名人重複 → 信物 +1 / shard 名人重複且信物已滿 → 碎片 / full 名冊已滿(舊批次極少見)→ 碎片 / skip 舊批次已處理
function cardsBagCommit(cs, venue, o) {
  var b = cs.cur[venue], opt = o || {}, auto = (opt.noAuto || (b && b.noAuto)) ? -1 : cardsBagAutoLv(cs), res, raw = 0, g;   // b.noAuto:新手禮包批次不自動熔爐
  if (!b) return { ok: false, reason: 'none' };
  cs.cur[venue] = null;
  res = { ok: true, venue: venue, key: b.key, items: [], roster: 0, added: 0, over: 0, full: 0, dissolved: 0, tokenN: 0, shardN: 0, shards: 0, tokens: 0, lost: 0 };
  b.cands.forEach(function (c, i) {
    var owner, sh, e;
    if (b.taken && b.taken[i]) { res.items.push({ c: c, how: 'skip' }); return; }
    owner = c.fig ? cardsFindFig(cs, c.fig) : null;
    if (owner) {   // 名人重複:信物未滿 → 信物 +1;信物已滿 → 碎片
      if ((owner.tok || 0) < CARD_CFG.tokMax) { owner.tok = (owner.tok || 0) + 1; res.tokenN++; res.items.push({ c: c, how: 'token' }); }
      else { sh = CARD_BAG.figDupShard[c.gr] || CARD_BAG.figDupShard[4]; raw += sh; res.shardN++; res.items.push({ c: c, how: 'shard', shards: sh }); }
      return;
    }
    if (!c.fig && auto >= 0 && c.gr <= auto) { sh = cardsFurnaceValue(c); raw += sh; res.dissolved++; res.items.push({ c: c, how: 'auto', shards: sh }); return; }
    if (cardsRosterRoom(cs) > 0) {   // 抽到就是自己的:名冊有空位直接加入
      e = cardsMakeEntry(cs, c, venue, b.key, cardsCost(c));
      cs.roster.push(e);
      res.roster++;
      res.items.push({ c: c, how: 'roster', id: e.id });
      return;
    }
    sh = cardsFurnaceValue(c); raw += sh; res.full++; res.items.push({ c: c, how: 'full', shards: sh });   // 名冊已滿(舊批次 / 讀檔殘留):轉碎片,不丟失
  });
  if (raw > 0) { g = cardsShardGain(cs, raw); res.shards += g.shards; }
  cs.lastRel = null;
  if (res.roster && !opt.noSync && typeof cardsSyncTalents === 'function') { try { cardsSyncTalents(); } catch (err) { /* 無城資料時略過 */ } }
  return res;
}
function cardsBagOpen(cs, venue, o) {
  var r = cardsBagStage(cs, venue, (o && o.n) || 1);
  return r.ok ? cardsBagCommit(cs, venue, o) : r;
}
// 殘留的待入冊批次(中斷 / 舊存檔 / 無特效)全部入冊;回處理的批數
function cardsBagFlush(cs, o) {
  var n = 0;
  CARD_VENUE_ORDER.forEach(function (v) { if (cs.cur[v]) { cardsBagCommit(cs, v, o); n++; } });
  return n;
}
// 熔鍊(名冊 entry id;函式名沿用 Dissolve):路人 → 碎片。名人預設不熔(reason fig),o.figOk = true(UI 二次確認後)才熔。
// 鎖定(🔒)或派駐中者略過(reason locked,計入 skippedLock)。成功移出名冊(就地 splice,保留 world.city.talents 同一陣列參照)並通知 bnSkcOnLeave。回 {ok, n, shards, tokens, lost, skippedFig, skippedLock, reason?}
function cardsBagDissolve(cs, ids, o) {
  var opt = o || {}, drop = {}, n = 0, raw = 0, skippedFig = 0, skippedLock = 0, gone = [], g, i;
  (ids || []).forEach(function (id) {
    var f = cardsRosterFind(cs, id);
    if (!f || drop[id]) return;
    if (f.c.fig && !opt.figOk) { skippedFig++; return; }
    if (!cardsRosterMeltable(f.c)) { skippedLock++; return; }
    drop[id] = 1; n++; raw += cardsFurnaceValue(f.c);
  });
  if (!n) return { ok: false, reason: skippedFig ? 'fig' : (skippedLock ? 'locked' : 'none'), n: 0, shards: 0, tokens: 0, lost: 0, skippedFig: skippedFig, skippedLock: skippedLock };
  for (i = cs.roster.length - 1; i >= 0; i--) if (drop[cs.roster[i].id]) { gone.push(cs.roster[i].id); cs.roster.splice(i, 1); }
  gone.forEach(function (id) { if (typeof bnSkcOnLeave === 'function') bnSkcOnLeave(id); });
  g = cardsShardGain(cs, raw);
  cs.lastRel = null;
  return { ok: true, n: n, shards: g.shards, tokens: 0, lost: 0, skippedFig: skippedFig, skippedLock: skippedLock };
}
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
// 待定席 → 名冊(需有名額)
function cardsAccept(cs, id) {
  var f = cardsFind(cs, id);
  if (!f || f.list !== 'wait') return false;
  if (cs.roster.length >= cardsCap()) return false;
  cs.wait.splice(f.idx, 1); cs.roster.push(f.e);
  return true;
}
// 遣散:opts {unassign}。路人換碎片 cardsRelShards(白1 青2 藍4 紫8,無每週上限);名人轉流浪不給碎片(可花碎片請回)。回 {ok, reason?, shards?, tokens?}
function cardsRelease(cs, id, opts) {
  var f = cardsFind(cs, id), e, o = opts || {}, shards, snapS;
  if (!f || f.list === 'wander') return { ok: false, reason: 'none' };
  e = f.e;
  if (e.star) return { ok: false, reason: 'locked' };
  if (e.at && !o.unassign) return { ok: false, reason: 'busy' };
  cs[f.list].splice(f.idx, 1);
  e.at = null;
  if (f.list === 'roster' && typeof bnSkcOnLeave === 'function') bnSkcOnLeave(e.id);   // 離開名冊:清掉其戰法裝備(bn_skcard.js)
  if (e.fig) { cs.wander.push(e); cs.lastRel = { e: e, list: f.list, idx: f.idx, wander: true }; return { ok: true, shards: 0, tokens: 0 }; }
  snapS = cs.shards;
  shards = cardsRelShards(e);
  cs.shards += shards;
  cs.lastRel = { e: e, list: f.list, idx: f.idx, dTok: 0, snapS: snapS };
  return { ok: true, shards: shards, tokens: 0 };
}
function cardsUndoRelease(cs) {
  var L = cs.lastRel, arr;
  if (!L) return false;
  arr = cs[L.list];
  if (L.wander) cs.wander = cs.wander.filter(function (x) { return x !== L.e; });
  else {
    cs.shards = L.snapS;
  }
  arr.splice(Math.min(L.idx, arr.length), 0, L.e);
  cs.lastRel = null;
  return true;
}
// 請回流浪名人:花 CARD_RECALL_COST 碎片 + 1 名額。reason:none / shards 碎片不足 / full 名冊已滿
function cardsRecall(cs, id) {
  var f = cardsFind(cs, id);
  if (!f || f.list !== 'wander') return { ok: false, reason: 'none' };
  if (cs.shards < CARD_RECALL_COST) return { ok: false, reason: 'shards', need: CARD_RECALL_COST };
  if (cs.roster.length >= cardsCap()) return { ok: false, reason: 'full' };
  cs.shards -= CARD_RECALL_COST; cs.wander.splice(f.idx, 1); cs.roster.push(f.e);
  return { ok: true, entry: f.e };
}


// ───────── 卡片熔爐:強化武將(升星)與碎片兌換指名券(數值在 carddata.js CARD_FURNACE,PLACEHOLDER) ─────────
// 星等欄位 = entry.starLv(0~5,有值才寫);注意 entry.star 是『鎖定防誤遣散』旗標(PLAN_BATTLE_A §2),兩者無關、不可混用。
function cardsWeekNo(now) { return Math.floor(((now || 0) - cardsTz(now || 0)) / (7 * 86400000)); }
function cardsStarLv(e) { return Math.max(0, Math.min(CARD_FURNACE.starMax, (e && e.starLv) | 0)); }
// 下一星花費:base = 表值(名人 × figMul)、off = 信物折抵(每個 tokOff,上限 tokOffMax)、cost = 實付(至少 1)。滿星回 {max: true}
function cardsStarCost(e) {
  var F = CARD_FURNACE, lv = cardsStarLv(e), base, pct, cost;
  if (lv >= F.starMax) return { max: true, lv: lv, cost: 0, base: 0, off: 0 };
  base = F.starCost[Math.min(e.gr, F.starCost.length - 1)][lv] * (e.fig ? F.figMul : 1);
  pct = Math.min(F.tokOffMax, Math.max(0, (e.tok | 0) * F.tokOff));
  cost = Math.max(1, Math.ceil(base * (1 - pct) - 1e-9));
  return { max: false, lv: lv, base: base, off: base - cost, cost: cost };
}
// 升星(名冊 / 待定席皆可,流浪不可)。reason:none 查無 / max 已滿星 / shards 碎片不足。成功回 {ok, lv, cost}
function cardsStarUp(cs, id) {
  var f = cardsFind(cs, id), e, c;
  if (!f || f.list === 'wander') return { ok: false, reason: 'none' };
  e = f.e; c = cardsStarCost(e);
  if (c.max) return { ok: false, reason: 'max' };
  if (cs.shards < c.cost) return { ok: false, reason: 'shards', need: c.cost };
  cs.shards -= c.cost;
  e.starLv = c.lv + 1;
  return { ok: true, lv: e.starLv, cost: c.cost };
}
// 星加成係數(給戰鬥引擎讀;乘算 1 + 值):{lv, atk, def, hp, skill(3 星起技能強化旗標), mark(5 星專屬標記)}
function cardsStarBonus(e) {
  var B = CARD_FURNACE.starBonus, lv = cardsStarLv(e);
  return { lv: lv, atk: lv * B.atk, def: lv * B.def, hp: lv * B.hp, skill: lv >= B.skillStar, mark: lv >= B.markStar };
}
// 碎片兌換指名券:每週上限 exchange.weekMax 張(cs.exWk = {w 週序, n 本週已換},首次兌換才寫)
function cardsExchangeLeft(cs, now) {
  var X = CARD_FURNACE.exchange, wk = cardsWeekNo(now);
  return Math.max(0, X.weekMax - ((cs.exWk && cs.exWk.w === wk) ? cs.exWk.n : 0));
}
function cardsExchange(cs, n, now) {
  var X = CARD_FURNACE.exchange, wk = cardsWeekNo(now), left = cardsExchangeLeft(cs, now);
  n = Math.max(1, n | 0);
  if (left < 1) return { ok: false, reason: 'week' };
  if (n > left) return { ok: false, reason: 'week', left: left };
  if (cs.shards < n * X.shards) return { ok: false, reason: 'shards', need: n * X.shards };
  cs.shards -= n * X.shards;
  cardsAddNameTokens(cs, n);
  cs.exWk = { w: wk, n: ((cs.exWk && cs.exWk.w === wk) ? cs.exWk.n : 0) + n };
  return { ok: true, n: n, shards: n * X.shards };
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
// 舊卡包併入名冊(讀檔用,cs.v ≤ 4 遷移):list 為正規化後的卡包卡;依名人 > 品階 > 才排序;名人重複 → 信物 / 碎片;名冊滿 → 碎片(不丟失)
function cardsLegacyBagMerge(n, list) {
  var ord = list.slice().sort(function (a, b) { return (b.fig ? 1 : 0) - (a.fig ? 1 : 0) || b.gr - a.gr || b.tai - a.tai || (a.bid < b.bid ? -1 : 1); }), shards = 0, owner;
  ord.forEach(function (c) {
    if (c.fig) {
      owner = cardsFindFig(n, c.fig);
      if (owner) {
        if ((owner.tok || 0) < CARD_CFG.tokMax) owner.tok = (owner.tok || 0) + 1;
        else shards += CARD_BAG.figDupShard[c.gr] || CARD_BAG.figDupShard[4];
        return;
      }
    }
    if (cardsRosterRoom(n) > 0) { n.roster.push(cardsMakeEntry(n, c, c.pool || 'T', c.key || '', cardsCost(c))); return; }
    shards += cardsFurnaceValue(c);
  });
  if (shards > 0) cardsShardGain(n, shards);
  return n;
}
function cardNum(v, lo, hi, d) { return (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : d; }
function cardNormCard(c, isEntry, isBag) {
  var o, k, j;
  if (!c || typeof c !== 'object' || !Array.isArray(c.st) || c.st.length !== 5) return null;
  o = { name: String(c.name || '').slice(0, 12), zi: String(c.zi || '').slice(0, 6), fig: (c.fig && CARD_FIG_BY_ID[c.fig]) ? c.fig : null, fac: cardNum(c.fac, 0, CARD_FAC.length - 1, 4) | 0,
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
    o.at = (typeof c.at === 'string' && c.at) ? c.at.slice(0, 40) : null; o.star = c.star ? 1 : 0; if (cardNum(c.starLv, 0, CARD_FURNACE.starMax, 0) | 0) o.starLv = cardNum(c.starLv, 0, CARD_FURNACE.starMax, 0) | 0; o.tok = cardNum(c.tok, 0, CARD_CFG.tokMax, 0) | 0;
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
function cardsNormSave(v, now) {
  var n, k, V, seenB = {}, legacyPl, tierN, tmin, dn, tNow = (typeof now === 'number' && isFinite(now)) ? now : Date.now();
  if (!v || typeof v !== 'object') return null;
  n = cardsStateNew(typeof v.seed === 'number' ? v.seed : undefined);
  n.seq = cardNum(v.seq, 0, 1e9, 0) | 0; n.nameTokens = cardNum(v.nameTokens, 0, 1e6, 0) | 0; n.namedCount = cardNum(v.namedCount, 0, 1e9, 0) | 0; n.shards = cardNum(v.shards, 0, 1e7, 0) | 0;
  if ((cardNum(v.v, 0, 99, 1) | 0) < 2) {   // 舊存檔(v 1)一次性遷移:酒令 → 碎片(× CARD_DRAW.wineShard),記 migNote 供提示一次;卡包卡由 cardsRosterFill 於遊戲中補進名冊。舊的每日小禮(gift)欄位丟棄
    k = (cardNum(v.tok, 0, 1e6, 0) | 0) * CARD_DRAW.wineShard;
    n.shards = Math.min(1e7, n.shards + k);
    n.migNote = { sh: k };
  } else if (v.migNote && typeof v.migNote === 'object') n.migNote = { sh: cardNum(v.migNote.sh, 0, 1e7, 0) | 0 };   // 還沒提示過就存檔
  if (n.migNote === undefined && v.migNote && typeof v.migNote === 'object') n.migNote = { sh: cardNum(v.migNote.sh, 0, 1e7, 0) | 0 };
  if (n.migNote && v.migNote && typeof v.migNote === 'object' && (cardNum(v.migNote.pl, 0, 1e6, 0) | 0) > 0) n.migNote.pl = cardNum(v.migNote.pl, 0, 1e6, 0) | 0;
  // 次數錢包 cs.pl:cs.v ≥ 3 直接讀;舊存檔(每日一抽,v ≤ 2)一次性遷移 —— 待開批數(acc,T / E / 舊殿試)× 當階每批張數 → 次數、計時取 T / E 兩池較早的下次時間、保底批數 × 當階張數(上限 pity)→ 張數;遷移後 acc / dr 清空(重複載入已是 v 3,不再轉)
  legacyPl = (cardNum(v.v, 0, 99, 1) | 0) < 3;
  if (!legacyPl && v.pl && typeof v.pl === 'object') n.pl = { n: cardNum(v.pl.n, 0, 1e6, 0) | 0, t: cardNum(v.pl.t, 0, 1e15, 0), tot: cardNum(v.pl.tot, 0, 1e9, 0) | 0 };
  else if (legacyPl) {
    try { tierN = cardsDrawTier().n; } catch (e0) { tierN = CARD_DRAW.size[0].n; }
    k = 0; tmin = 0; dn = 0;
    ['T', 'E', 'G'].forEach(function (x) { if (v.acc && Array.isArray(v.acc[x])) k += v.acc[x].filter(function (s) { return typeof s === 'string' && s.indexOf(x + ':') === 0 && isFinite(cardsKeyNo(s)); }).length; });
    ['T', 'E'].forEach(function (x) {
      var d = v.dr && v.dr[x];
      if (d && typeof d === 'object' && typeof d.t === 'number' && isFinite(d.t)) { if (!tmin || d.t < tmin) tmin = d.t; dn += cardNum(d.n, 0, 1e9, 0) | 0; }
    });
    n.pl = { n: Math.min(1e6, k * tierN), t: cardNum(tmin, 0, 1e15, 0), tot: Math.min(1e9, dn) };
    if (k > 0) n.migNote = { sh: n.migNote ? n.migNote.sh : 0, pl: n.pl.n };
  }
  if (v.boss && typeof v.boss === 'object') Object.keys(v.boss).slice(0, 200).forEach(function (id) { if (v.boss[id] && id.length <= 12) n.boss[id] = 1; });
  if (v.exWk && typeof v.exWk === 'object' && (cardNum(v.exWk.n, 0, 1e6, 0) | 0) > 0) n.exWk = { w: cardNum(v.exWk.w, -1, 1e9, -1) | 0, n: cardNum(v.exWk.n, 0, CARD_FURNACE.exchange.weekMax, 0) | 0 };   // 碎片兌換券的本週計數(有值才寫);舊存檔的 shardWk(遣散週上限)已廢,讀檔時丟棄
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
    n.acc[x] = [];   // 舊『待開批次』已在上面轉成次數
    n.pity[x] = (v.pity && typeof v.pity[x] === 'number') ? Math.max(0, v.pity[x] | 0) : 0;
    if (legacyPl && x !== 'G') n.pity[x] = Math.min(CARD_DRAW.pity, n.pity[x] * (tierN || CARD_DRAW.size[0].n));   // 舊保底以『批』計 → 換成『張』
    if (v.cur && v.cur[x] && Array.isArray(v.cur[x].cands) && v.cur[x].cands.length >= 1 && v.cur[x].cands.length <= Math.max(V.batch, CARD_DRAW.maxOne)) {   // 新手禮包最後一批可少於 7 張   // 舊存檔(或特效播放中途存檔)的未處理批次:遷入卡包(未被任用者),已任用的不動
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
  // 舊存檔(cs.v ≤ 4)的卡包 cs.bag / 溢出區 cs.bagOver(2026-11-10 移除):一次性併入名冊(名人 > 品階 > 才),名冊滿 CARD_CFG.cap 為止,其餘熔成碎片(安靜處理,不提示)
  if (Array.isArray(v.bag) || Array.isArray(v.bagOver)) {
    var oldBag = [];
    if (Array.isArray(v.bag)) v.bag.slice(0, 600).forEach(function (c) { var o = cardNormCard(c, false, true); if (o) oldBag.push(o); });
    if (Array.isArray(v.bagOver)) v.bagOver.slice(0, 600).forEach(function (c) { var o = cardNormCard(c, false, true); if (o) oldBag.push(o); });
    cardsLegacyBagMerge(n, oldBag);
  }
  if (typeof v.bagAuto === 'number' && isFinite(v.bagAuto)) cardsBagSetAuto(n, v.bagAuto);
  CARD_VENUE_ORDER.forEach(function (x) {   // 殘留的待入冊批次(舊 cur.*)入冊;派工接口待遊戲中再同步
    if (!n.cur[x]) return;
    cardsBagCommit(n, x, { noAuto: true, noSync: true, now: tNow });
  });
  if (Array.isArray(v.errand)) n.errand = v.errand.slice(0, 4).filter(function (q) { return q && typeof q.id === 'string' && typeof q.eid === 'string' && (q.kind === 'goods' || q.kind === 'build'); }).map(function (q) {   // 人物請託(npcinteract.js)
    return { id: q.id.slice(0, 12), eid: q.eid.slice(0, 12), kind: q.kind, text: String(q.text || '').slice(0, 60), day: cardNum(q.day, 0, 1e9, 0) | 0, goods: q.goods ? String(q.goods).slice(0, 24) : undefined, n: cardNum(q.n, 0, 999, 0) | 0, type: q.type ? String(q.type).slice(0, 32) : undefined, base: cardNum(q.base, 0, 9999, 0) | 0 };
  });
  if (cardNum(v.errDay, -1, 1e9, -1) > -1) n.errDay = cardNum(v.errDay, -1, 1e9, -1) | 0;
  if (cardNum(v.errSeq, 0, 1e9, 0) > 0) n.errSeq = cardNum(v.errSeq, 0, 1e9, 0) | 0;
  if (typeof cardsStarterNorm === 'function') n.starter = cardsStarterNorm(v.starter);   // 新手禮包(js/cards_starter.js;舊存檔沒有此欄 = 待判定)
  for (k = 0; k < n.roster.length; k++) { var m =/^r(\d+)$/.exec(n.roster[k].id); if (m && +m[1] > n.seq) n.seq = +m[1]; }
  return n;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { cardHash: cardHash, cardRng: cardRng };
