// js/ld_hunt.js — 尋訪(書院;設計_裝備與尋訪_定案.md 第四節、任務卡 5)。前綴 study / STUDY。純邏輯,無 DOM。
// 存檔:localStorage 'lorddomain.study.v1' = {v:1, ctr, day:'YYYY-MM-DD', cnt:{talent,horse}, sta:{n,t}, intro, pity:{rP,rG,hP,hG}, clue:{wei,shu,wu,qun}, ex:{season, s0, figs:{名人id:1}}}(SAVE_SLOT_KEYS)。
// 次數:人才·寶物 7 / 天(上限 14)、馬 3 / 天(上限 6),每天 0:00(東八區)補;城主體力上限 120、每 6 分鐘 +1(只存「數值 + 時間戳」);近訪 ⚡10、遠訪 ⚡30、各扣 1 次。
// 所有亂數用 存檔種子(gear.v1 的 seed)+ 本檔計數器;先寫存檔(扣次數 / 體力 / 計數器 / 保底)再發獎勵,重整不重抽。壞檔 → 正規化,不丟例外。
// 全域:STUDY_KEY STUDY_CFG studyRead studyWrite studyNorm studyTick studyStamina studyOpen studyIntro studyIntroList studyBonus studyRoll studyExchange studyDayStr studySeasonKey studyClueOf。ES2017;不用 ?. ??。

var STUDY_KEY = 'lorddomain.study.v1';
var STUDY_FACS = ['wei', 'shu', 'wu', 'qun'];
var STUDY_FAC_NAME = { wei: '魏', shu: '蜀', wu: '吳', qun: '群' };
var STUDY_CFG = {
  openFame: 1200,
  day: 86400000, dayShiftMs: 8 * 3600000, seasonDays: 28,
  cnt: { talent: { per: 7, max: 14 }, horse: { per: 3, max: 6 } },
  sta: { max: 120, ms: 360000, near: 10, far: 30 },
  intro: { base: 60, cap: 40, defMei: 50, gold: 0.05, purple: 0.15 },   // 魅力 - base 夾 0~cap,每點:金 +gold、紫 +purple 個百分點
  cat: { near: { shard: 45, clue: 30, card: 10, relic: 15 }, far: { shard: 35, clue: 30, card: 10, relic: 25 } },
  shard: { near: 5, far: 10 }, clue: { near: 1, far: 2 }, horseMiss: 3,
  q: {   // 白 / 藍 / 紫 / 金(百分比)
    relic: { near: [50, 35, 13, 2], far: [25, 45, 24, 6] },
    horse: { near: [50, 35, 13, 2], far: [25, 45, 24, 6] },
    card: { near: [60, 35, 5, 0], far: [30, 55, 15, 0] }   // 白板 / 藍將 / 紫名人 / (不出金)
  },
  horseHit: { near: 0.6, far: 0.8 },
  pity: { purple: 10, gold: 40 },
  clueCost: { purple: 30, gold: 60 }
};
function studyHas(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function studyInt(x, lo, hi, d) { x = Math.floor(Number(x)); return isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; }
function studyDayNo(now) { return Math.floor((now + STUDY_CFG.dayShiftMs) / STUDY_CFG.day); }
function studyDayStr(now) { return new Date(studyDayNo(now) * STUDY_CFG.day).toISOString().slice(0, 10); }
function studyDayParse(s) { var t = Date.parse(String(s) + 'T00:00:00Z'); return isFinite(t) ? Math.floor(t / STUDY_CFG.day) : NaN; }

// ───────── 存檔 ─────────
function studyNew(now) {
  var C = STUDY_CFG;
  return { v: 1, ctr: 0, day: studyDayStr(now || Date.now()), cnt: { talent: C.cnt.talent.per, horse: C.cnt.horse.per }, sta: { n: C.sta.max, t: now || Date.now() }, intro: '',
    pity: { rP: 0, rG: 0, hP: 0, hG: 0 }, clue: { wei: 0, shu: 0, wu: 0, qun: 0 }, ex: { season: 0, s0: 0, figs: {} } };
}
function studyNorm(v, now) {
  var C = STUDY_CFG, o = studyNew(now), k;
  if (!v || typeof v !== 'object') return o;
  o.ctr = studyInt(v.ctr, 0, 1e9, 0);
  if (typeof v.day === 'string' && isFinite(studyDayParse(v.day))) o.day = v.day;
  if (v.cnt && typeof v.cnt === 'object') { o.cnt.talent = studyInt(v.cnt.talent, 0, C.cnt.talent.max, o.cnt.talent); o.cnt.horse = studyInt(v.cnt.horse, 0, C.cnt.horse.max, o.cnt.horse); }
  if (v.sta && typeof v.sta === 'object') { o.sta.n = studyInt(v.sta.n, 0, C.sta.max, o.sta.n); o.sta.t = studyInt(v.sta.t, 0, 9e15, o.sta.t); }
  o.intro = (typeof v.intro === 'string' && v.intro.length <= 20) ? v.intro : '';
  if (v.pity && typeof v.pity === 'object') ['rP', 'rG', 'hP', 'hG'].forEach(function (x) { o.pity[x] = studyInt(v.pity[x], 0, 100000, 0); });
  if (v.clue && typeof v.clue === 'object') STUDY_FACS.forEach(function (x) { o.clue[x] = studyInt(v.clue[x], 0, 100000, 0); });
  if (v.ex && typeof v.ex === 'object') {
    o.ex.season = studyInt(v.ex.season, 0, 9e15, 0); o.ex.s0 = studyInt(v.ex.s0, 0, 1e9, 0);
    if (v.ex.figs && typeof v.ex.figs === 'object') for (k in v.ex.figs) if (studyHas(v.ex.figs, k) && v.ex.figs[k] && k.length < 40) o.ex.figs[k] = 1;
  }
  return o;
}
function studyRead(now) {
  var s = null;
  try { s = localStorage.getItem(STUDY_KEY); } catch (e) { return studyNew(now); }
  if (!s) return studyNew(now);
  try { return studyNorm(JSON.parse(s), now); } catch (e2) { return studyNew(now); }
}
function studyWrite(st) { try { localStorage.setItem(STUDY_KEY, JSON.stringify(st)); return true; } catch (e) { return false; } }

// ───────── 日界補次數 / 體力 ─────────
function studyStaSync(st, now) {
  var C = STUDY_CFG.sta, g;
  if (st.sta.t > now) st.sta.t = now;   // 時鐘回撥
  if (st.sta.n >= C.max) { st.sta.n = C.max; st.sta.t = now; return; }
  g = Math.floor((now - st.sta.t) / C.ms);
  if (g > 0) { st.sta.n = Math.min(C.max, st.sta.n + g); st.sta.t = st.sta.n >= C.max ? now : st.sta.t + g * C.ms; }
}
// 對記憶體裡的 st 就地更新(日界補次數、體力回復);回 st
function studyTickSt(st, now) {
  var C = STUDY_CFG, last = studyDayParse(st.day), today = studyDayNo(now), d = today - last;
  if (d > 0) {
    st.cnt.talent = Math.min(C.cnt.talent.max, st.cnt.talent + C.cnt.talent.per * d);
    st.cnt.horse = Math.min(C.cnt.horse.max, st.cnt.horse + C.cnt.horse.per * d);
    st.day = studyDayStr(now);
  } else if (d < 0) st.day = studyDayStr(now);
  studyStaSync(st, now);
  return st;
}
// 讀檔 + 補到 now 並寫回(有變才寫)
function studyTick(now) {
  var st = studyRead(now), before = JSON.stringify(st);
  now = now || Date.now();
  studyTickSt(st, now);
  if (JSON.stringify(st) !== before) studyWrite(st);
  return st;
}
// 回 {n, max, nextIn(ms,滿了 = 0)}
function studyStamina(now) {
  var st = studyTick(now), C = STUDY_CFG.sta;
  return { n: st.sta.n, max: C.max, nextIn: st.sta.n >= C.max ? 0 : Math.max(0, C.ms - (now - st.sta.t)) };
}
function studyOpen() {
  if (typeof unlockOn === 'function' && unlockOn() && typeof unlockIs === 'function') return !!unlockIs('study');   // ld_open_unlock.js 的開放表(名聲 1,200)
  return (typeof fameGet !== 'function') || fameGet() >= STUDY_CFG.openFame;
}

// ───────── 引薦人(魅力加成)─────────
function studyMei(e) { return (e && e.st && typeof e.st[4] === 'number') ? e.st[4] : STUDY_CFG.intro.defMei; }
function studyFacKey(e) {
  if (!e || !e.fig) return null;   // 路人 → 隨機四陣營之一
  return e.fac === 0 ? 'wei' : e.fac === 1 ? 'shu' : e.fac === 2 ? 'wu' : e.fac === 3 ? 'qun' : null;   // 中立 / 魔幻陣營 → 隨機
}
// 預設 = 名冊魅力最高的卡(同值取先入名冊者);st.intro 指定且仍在名冊 → 用它。回 {e, mei, pts, facKey, auto} 或 null(名冊空)
function studyIntro(cs, st) {
  var ro = (cs && cs.roster) ? cs.roster : [], best = null, i, e, want = (st || studyRead()).intro, pick = null;
  for (i = 0; i < ro.length; i++) {
    e = ro[i];
    if (want && e.id === want) pick = e;
    if (!best || studyMei(e) > studyMei(best)) best = e;
  }
  e = pick || best;
  if (!e) return null;
  return { e: e, mei: studyMei(e), pts: Math.max(0, Math.min(STUDY_CFG.intro.cap, studyMei(e) - STUDY_CFG.intro.base)), facKey: studyFacKey(e), auto: !pick };
}
function studyIntroList(cs, n) {
  var ro = (cs && cs.roster) ? cs.roster.slice() : [];
  ro.sort(function (a, b) { return studyMei(b) - studyMei(a); });
  return ro.slice(0, n || 12);
}
// 品質分布加成:金 +0.05 × pts、紫 +0.15 × pts,從白扣(不夠再從藍扣);noGold = 人才卡(不出金,只加紫)。回新陣列
function studyBonus(dist, pts, noGold) {
  var C = STUDY_CFG.intro, d = dist.slice(), g = noGold ? 0 : C.gold * pts, p = C.purple * pts, take = g + p, fromW = Math.min(d[0], take), fromB = take - fromW;
  d[0] -= fromW; d[1] = Math.max(0, d[1] - fromB);
  d[2] += p; d[3] += g;
  return d;
}
function studyPick(dist, r) {
  var x = r() * 100, acc = 0, i;
  for (i = 0; i < dist.length; i++) { acc += dist[i]; if (x < acc) return i; }
  for (i = dist.length - 1; i > 0; i--) if (dist[i] > 0) return i;
  return 0;
}

// ───────── 賽季(線索兌換每季限 1 次)─────────
// 活動模組的賽季(evSeasonStart,不存在時以第一次尋訪當週週一起每 28 天)。回數字鍵;st.ex.s0 = 第一次尋訪當週週一的日號
function studySeasonKey(st, now) {
  var C = STUDY_CFG, d, mon;
  if (typeof evSeasonIdx === 'function' && typeof evSeasonStart === 'function') { try { d = evSeasonIdx(now); if (isFinite(d)) return Number(d) + 1; } catch (e) { /* 退回 28 天制 */ } }   // ld_open_ev.js 的賽季
  if (!st.ex.s0) { d = studyDayNo(now); mon = d - ((d + 3) % 7); st.ex.s0 = mon; }
  return Math.floor((studyDayNo(now) - st.ex.s0) / C.seasonDays) + 1;
}
function studyClueOf(fac) { var st = studyRead(); return st.clue[fac] | 0; }

// ───────── 一次尋訪 ─────────
function studyGrantShards(cs, n) {
  if (!cs || !(n > 0)) return 0;
  cs.shards = (cs.shards | 0) + n;
  return n;
}
function studyPickFig(cs, gr, facKey, r) {
  var src = (typeof cardsFigSrc === 'function') ? cardsFigSrc() : [], pool = src.filter(function (f) { return f.gr === gr && (facKey === 'qun' ? (f.fac === 3 || f.fac === 4) : f.fac === STUDY_FACS.indexOf(facKey)); });
  if (!pool.length) pool = src.filter(function (f) { return f.gr === gr; });
  if (!pool.length) return null;
  return pool[Math.floor(r() * pool.length) % pool.length];
}
// 發一張人才卡進名冊;名冊滿 → 轉碎片。回 {c, how:'roster'|'full', id?, shards?}
function studyGiveCard(cs, c, key) {
  var e, sh;
  if (cardsRosterRoom(cs) > 0) {
    e = cardsMakeEntry(cs, c, 'E', key, cardsCost(c));
    cs.roster.push(e);
    if (typeof cardsSyncTalents === 'function') { try { cardsSyncTalents(); } catch (er) { /* 無城資料時略過 */ } }
    return { c: c, how: 'roster', id: e.id };
  }
  sh = cardsFurnaceValue(c);
  studyGrantShards(cs, sh);
  return { c: c, how: 'full', shards: sh };
}
// kind = 'talent' | 'horse';far = 0 近訪 / 1 遠訪;cs = cardsGet()。
// reason:closed 書院未開放 / bad / cnt 次數不足 / sta 體力不足 / nocard 沒有名冊(沒有引薦人)
// 成功回 {ok, result:{cat:'shard'|'clue'|'card'|'relic'|'horse'|'none', q, n, fac, item, card, gain}, intro, cnt, sta, pityHit}
function studyRoll(kind, far, cs, now, opt) {
  var C = STUDY_CFG, st, gst, r, ib, pts, fk, band = far ? 'far' : 'near', cost, res = {}, u, acc, k, cat, dist, q, pityHit = '', P, G, made, key, c, f, add, pk;
  opt = opt || {};
  now = now || Date.now();
  if (kind !== 'talent' && kind !== 'horse') return { ok: false, reason: 'bad' };
  if (!opt.ignoreOpen && !studyOpen()) return { ok: false, reason: 'closed' };
  st = studyRead(now);
  studyTickSt(st, now);
  cost = far ? C.sta.far : C.sta.near;
  if (st.cnt[kind] < 1) { studyWrite(st); return { ok: false, reason: 'cnt' }; }
  if (st.sta.n < cost) { studyWrite(st); return { ok: false, reason: 'sta', need: cost }; }
  ib = studyIntro(cs, st);
  if (!ib) { studyWrite(st); return { ok: false, reason: 'nocard' }; }
  gst = gearRead();   // 亂數種子用 gear.v1 的 seed;計數器用本檔 ctr
  r = gearRngMake(gearHash('study', gst.seed, st.ctr, kind, far));
  st.ctr++;
  st.cnt[kind]--;
  if (st.sta.n >= C.sta.max) st.sta.t = now;
  st.sta.n -= cost;
  pts = ib.pts;
  fk = ib.facKey || STUDY_FACS[Math.floor(r() * 4) % 4];
  if (kind === 'talent') {
    u = r() * 100; acc = 0; cat = 'shard';
    for (k in C.cat[band]) { if (!studyHas(C.cat[band], k)) continue; acc += C.cat[band][k]; if (u < acc) { cat = k; break; } }
    if (cat === 'shard') { res = { cat: 'shard', n: C.shard[band] }; }
    else if (cat === 'clue') { res = { cat: 'clue', n: C.clue[band], fac: fk }; st.clue[fk] += C.clue[band]; }
    else if (cat === 'card') { q = studyPick(studyBonus(C.q.card[band], pts, true), r); res = { cat: 'card', q: q, fac: fk }; }
    else { res = { cat: 'relic' }; }
  } else {
    if (r() < C.horseHit[band]) res = { cat: 'horse' }; else res = { cat: 'none', n: C.horseMiss };
  }
  if (res.cat === 'relic' || res.cat === 'horse') {   // 寶具 / 馬:品質 + 保底
    dist = studyBonus(C.q[res.cat][band], pts, false);
    q = studyPick(dist, r);
    pk = res.cat === 'relic' ? ['rP', 'rG'] : ['hP', 'hG'];
    P = st.pity[pk[0]]; G = st.pity[pk[1]];
    if (G >= C.pity.gold) { if (q < 3) pityHit = 'gold'; q = 3; }
    else if (P >= C.pity.purple && q < 2) { q = 2; pityHit = 'purple'; }
    if (q === 3) { st.pity[pk[0]] = 0; st.pity[pk[1]] = 0; }
    else if (q === 2) { st.pity[pk[0]] = 0; st.pity[pk[1]] = G + 1; }
    else { st.pity[pk[0]] = P + 1; st.pity[pk[1]] = G + 1; }
    res.q = q;
    made = gearMake(res.cat === 'relic' ? 'relic' : 'horse', q, res.cat === 'relic' ? 'relic' : 'horse', r, false);
  }
  if (res.cat === 'card') {
    key = (typeof cardsKey === 'function') ? cardsKey('E', 9000000 + st.ctr) : 'E:' + (9000000 + st.ctr);
    // 白板 = 白階路人(gr 0)、藍將 = 藍階路人(gr 2)、紫名人 = 引薦人陣營的紫階名人(找不到退回藍階路人);陣營跟引薦人(中立 / 路人引薦 = 隨機四陣營,fk)
    c = cardGen(cs, 'E', key, 0, res.q === 0 ? 0 : 2, 'study', { fac: STUDY_FACS.indexOf(fk) });
    if (res.q === 2) { f = studyPickFig(cs, 3, fk, r); if (f) c = cardFromFig(f, 'E', 0); }
  }
  studyWrite(st);   // 先把扣次數 / 體力 / 計數器 / 保底 / 線索寫進存檔,再發獎勵
  if (res.cat === 'shard' || res.cat === 'none') { studyGrantShards(cs, res.n); res.gain = { shards: res.n }; }
  else if (made) { add = gearAdd(made); res.item = add; }
  else if (c) res.card = studyGiveCard(cs, c, key);
  if (typeof saveWorld === 'function' && (res.cat === 'shard' || res.cat === 'none' || res.cat === 'card')) { try { saveWorld(); } catch (e2) { /* 略過 */ } }
  return { ok: true, result: res, intro: { id: ib.e.id, name: ib.e.name, mei: ib.mei, pts: pts, fac: fk }, cnt: { talent: st.cnt.talent, horse: st.cnt.horse }, sta: st.sta.n, pityHit: pityHit, far: far ? 1 : 0 };
}

// ───────── 線索兌換 ─────────
// fac = wei/shu/wu/qun;figId = 名人 id(只限第一季名單中的紫 / 金名人;紫 30、金 60)。
// reason:bad / closed / clue 線索不足(need)/ used 本季已換 / full 名冊滿(不扣線索)
function studyExchange(fac, figId, cs, now, opt) {
  var C = STUDY_CFG, st, f, need, key, c, season, give;
  opt = opt || {};
  now = now || Date.now();
  if (STUDY_FACS.indexOf(fac) < 0) return { ok: false, reason: 'bad' };
  if (!opt.ignoreOpen && !studyOpen()) return { ok: false, reason: 'closed' };
  f = (typeof cardsFigSrc === 'function') ? cardsFigSrc().filter(function (x) { return x.id === figId; })[0] : null;
  if (!f || (f.gr !== 3 && f.gr !== 4)) return { ok: false, reason: 'bad' };
  if ((fac === 'qun' ? !(f.fac === 3 || f.fac === 4) : f.fac !== STUDY_FACS.indexOf(fac))) return { ok: false, reason: 'bad' };
  need = f.gr === 4 ? C.clueCost.gold : C.clueCost.purple;
  st = studyRead(now);
  season = studySeasonKey(st, now);
  if (st.ex.season !== season) { st.ex.season = season; st.ex.figs = {}; }
  if (st.ex.figs[figId]) { studyWrite(st); return { ok: false, reason: 'used' }; }
  if (st.clue[fac] < need) { studyWrite(st); return { ok: false, reason: 'clue', need: need, have: st.clue[fac] }; }
  if (cardsRosterRoom(cs) < 1) { studyWrite(st); return { ok: false, reason: 'full' }; }
  st.clue[fac] -= need; st.ex.figs[figId] = 1;
  st.ctr++;
  key = (typeof cardsKey === 'function') ? cardsKey('E', 9000000 + st.ctr) : 'E:' + (9000000 + st.ctr);
  c = cardFromFig(f, 'E', 0);
  studyWrite(st);
  give = studyGiveCard(cs, c, key);
  if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  return { ok: true, card: give, cost: need, left: st.clue[fac] };
}
// 兌換名單(給 UI):該陣營的紫 / 金名人,附本季已換旗標
function studyExchangeList(fac, now) {
  var st = studyRead(now), season = studySeasonKey(st, now || Date.now()), src = (typeof cardsFigSrc === 'function') ? cardsFigSrc() : [], used = (st.ex.season === season) ? st.ex.figs : {};
  return src.filter(function (f) { return (f.gr === 3 || f.gr === 4) && (fac === 'qun' ? (f.fac === 3 || f.fac === 4) : f.fac === STUDY_FACS.indexOf(fac)); })
    .sort(function (a, b) { return b.gr - a.gr || (b.st[4] - a.st[4]); })
    .map(function (f) { return { id: f.id, name: f.name, gr: f.gr, cost: f.gr === 4 ? STUDY_CFG.clueCost.gold : STUDY_CFG.clueCost.purple, used: !!used[f.id] }; });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { studyRoll: studyRoll };
