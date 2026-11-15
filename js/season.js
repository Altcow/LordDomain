// js/season.js — 賽季核心(設計_賽季_規格.md S1;純邏輯、無 DOM)。前綴 season。數值在 season_data.js(SEASON_CFG,全部 PLACEHOLDER)。
// 存檔:localStorage 'lorddomain.season.v1' = {v:1, s0 第 0 季起點(週一 00:00 東八區), idx 存檔目前屬於第幾季, hi 看過的最晚時刻, part:{季號:1}(最近 3 季), job:null|{from,to,step:'settle'|'reset',tEnd,tw?,err?},
//   hist:[{idx,pow,rank,of,cities,tw,part,conv}](新→舊,最多 12)、pend:[{id,idx,rank,give:{pulls,shards,mats},conv,sweep:{from,to}|null}](待領結算)、twBest(休眠塔功能的歷史最高層;塔休眠時只保留、不顯示、不參與結算與排名)、seen、warn}(已加入 SAVE_SLOT_KEYS)。
// 換季 seasonTick(now):時鐘凍結 → 遷移(舊存檔只蓋章)→ 開 job → 'settle'(推到封榜、收成、名次、結餘換算)→ 'reset'(各模組 xxxSeasonReset,各自以 ss 冪等)→ 完成。做到一半當機,下次 tick 從 job.step 續做。
// 重置掛點(存在才呼叫):wdSeasonReset twSeasonReset rsvSeasonReset res4SeasonReset homeSeasonReset;另有模組註冊式 seasonRegister(name, {reset, settle, stamp, power})給首頁經營等後補模組。
// 各模組的季號戳記 ss:world.v2 的 W.ss、tower.v1 / rsv.v1 的 ss、world.res.ss(四資源;偏離規格的 world.resSs,因主存檔 saveWorldObj 只寫 world.res,resSs 不會被存下)、首頁經營自訂。
// 全域:SEASON_KEY seasonStart seasonIdxAt seasonIdxNow seasonBegin seasonDay seasonWeek seasonEnd seasonXpMul seasonNorm seasonRead seasonWrite seasonNpcPower seasonLordHits seasonRankAt seasonPower
//   seasonTick seasonMigrate seasonRegister seasonPendList seasonClaim seasonClaimAll seasonInfo seasonTowerBest seasonMarkSeen seasonMarkWarn。ES2017;不用 ?. ??。

var SEASON_KEY = 'lorddomain.season.v1';
var SEASON_MEM = { raw: null, obj: null, lastRaw: null, last: 0 };
var SEASON_REG = [];

function seasonInt(x, lo, hi, d) {
  x = typeof x === 'number' && isFinite(x) ? Math.floor(x) : d;
  return Math.max(lo, Math.min(hi, x));
}
function seasonLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function seasonLsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function seasonLen() { return SEASON_CFG.days * SEASON_CFG.DAY; }
// 週一 00:00(東八區)的絕對毫秒
function seasonMonday(now) {
  var L = now + SEASON_CFG.tz, d = Math.floor(L / SEASON_CFG.DAY), back = (d + 3) % 7;   // 1970-01-01 是週四
  return (d - back) * SEASON_CFG.DAY - SEASON_CFG.tz;
}

// ───────── 存檔 ─────────
// 塔功能(FEATURES.tower)休眠時:結算不記塔層、不重置 / 掃蕩塔、不發塔材料(名次一律用本季名聲 / 領地戰力,見 seasonRankAt)
function seasonTowerOn() { return typeof featureOn === 'function' && featureOn('tower'); }   // @DORMANT tower
function seasonDefault(s0) { return { v: 1, s0: s0, idx: 0, hi: 0, part: {}, job: null, hist: [], pend: [], twBest: 0, seen: -1, warn: -1 }; }
function seasonNormGive(g) {
  var o = { pulls: 0, shards: 0, mats: {} };
  if (!g || typeof g !== 'object') return o;
  o.pulls = seasonInt(g.pulls, 0, 1e6, 0); o.shards = seasonInt(g.shards, 0, 1e6, 0);
  if (g.mats && typeof g.mats === 'object') Object.keys(g.mats).slice(0, 20).forEach(function (k) { var n = seasonInt(g.mats[k], 0, 99999, 0); if (n > 0) o.mats[k] = n; });
  return o;
}
// 正規化:壞檔 → null(呼叫端改走遷移);各欄夾住,不丟例外
function seasonNorm(raw, now) {
  var o, k;
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  if (typeof raw.s0 !== 'number' || !isFinite(raw.s0) || raw.s0 < 1) return null;
  o = seasonDefault(Math.floor(raw.s0));
  o.idx = seasonInt(raw.idx, 0, 1e5, 0);
  o.hi = seasonInt(raw.hi, 0, 1e15, 0);
  if (raw.part && typeof raw.part === 'object') {
    Object.keys(raw.part).map(function (x) { return +x; }).filter(function (x) { return isFinite(x) && x >= 0 && raw.part[x]; }).sort(function (a, b) { return b - a; }).slice(0, SEASON_CFG.partKeep).forEach(function (x) { o.part[x] = 1; });
  }
  if (raw.job && typeof raw.job === 'object' && (raw.job.step === 'settle' || raw.job.step === 'reset')) {
    k = raw.job;
    o.job = { from: seasonInt(k.from, 0, 1e5, 0), to: seasonInt(k.to, 0, 1e5, 0), step: k.step, tEnd: seasonInt(k.tEnd, 0, 1e15, 0) };
    if (k.tw && typeof k.tw === 'object') o.job.tw = { from: seasonInt(k.tw.from, 0, 100, 0), to: seasonInt(k.tw.to, 0, 100, 0), mats: seasonNormGive({ mats: k.tw.mats }).mats };
    if (typeof k.err === 'string') o.job.err = k.err.slice(0, 120);
  }
  o.hist = (Array.isArray(raw.hist) ? raw.hist : []).filter(function (h) { return h && typeof h === 'object'; }).slice(0, SEASON_CFG.histMax).map(function (h) {
    return { idx: seasonInt(h.idx, 0, 1e5, 0), pow: seasonInt(h.pow, 0, 1e9, 0), rank: seasonInt(h.rank, 0, 99, 0), of: seasonInt(h.of, 0, 99, 0), cities: seasonInt(h.cities, 0, 99, 0), tw: seasonInt(h.tw, 0, 100, 0), part: h.part ? 1 : 0, conv: seasonInt(h.conv, 0, 1e6, 0) };
  });
  o.pend = (Array.isArray(raw.pend) ? raw.pend : []).filter(function (p) { return p && typeof p === 'object' && typeof p.id === 'string'; }).slice(0, SEASON_CFG.pendMax).map(function (p) {
    var sw = null;
    if (p.sweep && typeof p.sweep === 'object') sw = { from: seasonInt(p.sweep.from, 0, 100, 0), to: seasonInt(p.sweep.to, 0, 100, 0) };
    return { id: p.id.slice(0, 16), idx: seasonInt(p.idx, 0, 1e5, 0), rank: seasonInt(p.rank, 0, 99, 0), give: seasonNormGive(p.give), conv: seasonInt(p.conv, 0, 1e6, 0), sweep: sw };
  });
  o.twBest = seasonInt(raw.twBest, 0, 100, 0);
  o.seen = seasonInt(raw.seen, -1, 1e5, -1);
  o.warn = seasonInt(raw.warn, -1, 1e5, -1);
  return o;
}
// 讀取:回正規化物件;沒有 / 壞檔 → null(尚未遷移)。以原字串快取解析結果
function seasonRaw() {
  var s = seasonLsGet(SEASON_KEY), o = null;
  if (!s) return null;
  if (s === SEASON_MEM.raw) return SEASON_MEM.obj;
  try { o = seasonNorm(JSON.parse(s), Date.now()); } catch (e) { o = null; }
  SEASON_MEM.raw = s; SEASON_MEM.obj = o;
  return o;
}
function seasonRead() {
  var o = seasonRaw();
  return o ? JSON.parse(JSON.stringify(o)) : null;
}
function seasonWrite(st) {
  var s = JSON.stringify(st);
  if (!seasonLsSet(SEASON_KEY, s)) return false;
  SEASON_MEM.raw = null; SEASON_MEM.obj = null;   // 下次讀取重新正規化
  return true;
}

// ───────── 時鐘 ─────────
// 第 0 季起點:season.v1.s0 → 舊活動日曆 ev.v1.s0(直接讀原字串,不呼叫 evRead,避免與 evSeasonStart 互相遞迴)→ 本週週一 00:00
function seasonStart() {
  var st = seasonRaw(), s, o;
  if (st) return st.s0;
  s = seasonLsGet('lorddomain.ev.v1');
  if (s) { try { o = JSON.parse(s); if (o && typeof o.s0 === 'number' && isFinite(o.s0) && o.s0 > 0) return Math.floor(o.s0); } catch (e) { /* 壞檔略過 */ } }
  return seasonMonday(Date.now());
}
function seasonIdxAt(t) { return Math.max(0, Math.floor((t - seasonStart()) / seasonLen())); }
function seasonIdxNow(t) { return seasonIdxAt(typeof t === 'number' && isFinite(t) ? t : Date.now()); }
function seasonBegin(idx) { return seasonStart() + idx * seasonLen(); }
function seasonDay(t) { return Math.floor(Math.max(0, t - seasonStart()) / SEASON_CFG.DAY) % SEASON_CFG.days + 1; }
function seasonWeek(t) { return Math.ceil(seasonDay(t) / 7); }
function seasonEnd(t) { return seasonBegin(seasonIdxAt(t) + 1); }   // t 所在季的封榜時刻
function seasonXpMul(t) { return seasonDay(t) >= SEASON_CFG.catchDay ? SEASON_CFG.catchMul : 1; }

// ───────── 排名 ─────────
function seasonPower() {
  var p = 0;
  if (typeof homePower === 'function') { try { p = Number(homePower()); } catch (e) { p = 0; } return isFinite(p) && p > 0 ? Math.floor(p) : 0; }
  SEASON_REG.forEach(function (m) { var v; if (m.power) { v = Number(m.power()); if (isFinite(v) && v > 0) p += v; } });
  return Math.floor(p);
}
// W 內已被玩家占領且有 lord 的縣郡關口 → {NPC id: {county:n, jun:n, pass:n}}
function seasonLordHits(W) {
  var out = {};
  if (!W || !Array.isArray(W.pts)) return out;
  W.pts.forEach(function (p) {
    if (!p || p.owner !== 'me' || !p.lord || !SEASON_CFG.cityHit[p.cat]) return;
    if (!out[p.lord]) out[p.lord] = { county: 0, jun: 0, pass: 0 };
    out[p.lord][p.cat]++;
  });
  return out;
}
function seasonHitSum(h) {
  var s = 0, avg;
  if (typeof h === 'number') { avg = (SEASON_CFG.cityHit.county + SEASON_CFG.cityHit.jun + SEASON_CFG.cityHit.pass) / 3; return h * avg; }
  if (h && typeof h === 'object') Object.keys(SEASON_CFG.cityHit).forEach(function (c) { s += (h[c] | 0) * SEASON_CFG.cityHit[c]; });
  return s;
}
// 第 i 家 NPC 在第 idx 季的 t 時刻勢力;lordHits = seasonLordHits 的結果(數字也可:當平均每座扣分)
function seasonNpcPower(i, idx, t, lordHits) {
  var n = SEASON_CFG.npc[i], x, g;
  if (!n) return 0;
  x = Math.max(0, Math.min(1, (t - seasonBegin(idx)) / seasonLen()));
  g = 1 - (1 - x) * (1 - x);
  return Math.max(0, Math.round(SEASON_CFG.pRef * n.k * g - SEASON_CFG.pRef * seasonHitSum(lordHits ? lordHits[n.id] : 0)));
}
// 回 {rank, of, rows:[{id,name,pow,me,cities}]};cities:玩家列 = 目前占領縣郡關口數、NPC 列 = 被玩家攻下的座數;同分玩家排前面
function seasonRankAt(idx, t, W) {
  var hits = seasonLordHits(W), rows = [], mine = 0, rank = 1;
  if (W && Array.isArray(W.pts)) W.pts.forEach(function (p) { if (p && p.owner === 'me' && SEASON_CFG.cityHit[p.cat]) mine++; });
  rows.push({ id: 'me', name: '你', pow: seasonPower(), me: true, cities: mine, o: -1 });
  SEASON_CFG.npc.forEach(function (n, i) {
    var h = hits[n.id], c = h ? (h.county | 0) + (h.jun | 0) + (h.pass | 0) : 0;
    rows.push({ id: n.id, name: n.name, pow: seasonNpcPower(i, idx, t, hits), me: false, cities: c, o: i });
  });
  rows.sort(function (a, b) { return b.pow - a.pow || a.o - b.o; });
  rows.forEach(function (r, i) { if (r.me) rank = i + 1; delete r.o; });
  return { rank: rank, of: rows.length, rows: rows };
}
function seasonRankGive(rank) {
  var i, r;
  for (i = 0; i < SEASON_CFG.rankGive.length; i++) {
    r = SEASON_CFG.rankGive[i];
    if (rank <= r.max) return seasonNormGive(r);
  }
  return seasonNormGive(null);
}

// ───────── 模組註冊(首頁經營等後補模組)─────────
// def = {reset(idx, tStart), settle(tEnd), stamp(idx), power()};name 相同 → 覆蓋。reset 在內建 5 個掛點之後依註冊順序呼叫,須自己以 ss 冪等
function seasonRegister(name, def) {
  var i;
  if (typeof name !== 'string' || !def || typeof def !== 'object') return false;
  for (i = 0; i < SEASON_REG.length; i++) if (SEASON_REG[i].name === name) { SEASON_REG[i] = Object.assign({ name: name }, def); return true; }
  SEASON_REG.push(Object.assign({ name: name }, def));
  return true;
}
function seasonRegEach(key, a, b) {
  SEASON_REG.forEach(function (m) { if (typeof m[key] === 'function') m[key](a, b); });
}

// ───────── 遷移(舊存檔第一次載入:只蓋章,不重置)─────────
function seasonWorldReady() { return typeof world !== 'undefined' && !!world && !!world.res && typeof world.res === 'object'; }
// 對 JSON 存檔鍵補 ss(沒有才補);回是否有寫入
function seasonStampKey(key, idx) {
  var s = seasonLsGet(key), o;
  if (!s) return false;
  try { o = JSON.parse(s); } catch (e) { return false; }
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.ss !== undefined) return false;
  o.ss = idx;
  return seasonLsSet(key, JSON.stringify(o));
}
function seasonMigrate(now) {
  var s0, idx, st, top = 0, f, n, o;
  now = typeof now === 'number' && isFinite(now) ? now : Date.now();
  if (!seasonWorldReady()) return null;   // 世界尚未載入:不寫,等下次
  s0 = seasonStart();
  idx = Math.max(0, Math.floor((now - s0) / seasonLen()));
  st = seasonDefault(s0);
  st.idx = idx; st.hi = now; st.part[idx] = 1;
  ['lorddomain.world.v2', 'lorddomain.tower.v1', 'lorddomain.rsv.v1'].forEach(function (k) { seasonStampKey(k, idx); });
  if (world.res.ss === undefined) { world.res.ss = idx; if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 存檔失敗:下次 tick 因 ss 仍缺會再補 */ } } }
  if (typeof homeSeasonStamp === 'function') homeSeasonStamp(idx);
  seasonRegEach('stamp', idx);
  if (typeof twRead === 'function') { try { top = twRead().top | 0; } catch (e2) { top = 0; } }
  st.twBest = Math.max(0, Math.min(100, top));
  if (top > 0 && typeof fameRead === 'function' && typeof fameWrite === 'function') {   // 這些層名聲已給過,以後不再給
    f = fameRead();
    if (!f.tw || typeof f.tw !== 'object') f.tw = {};
    for (n = 1; n <= top; n++) f.tw[String(n)] = 1;
    fameWrite(f);
  }
  seasonWrite(st);
  return st;
}

// ───────── 換季流程 ─────────
function seasonCall(fn, args) { return typeof fn === 'function' ? fn.apply(null, args) : undefined; }
function seasonLoadW(now) {
  var raw = seasonLsGet('lorddomain.world.v2'), cs;
  if (!raw || typeof wdLoad !== 'function' || typeof cardsGet !== 'function') return null;
  cs = cardsGet();
  if (!cs) return null;
  return { W: wdLoad(raw, now, cs.seed, cs), cs: cs };
}
function seasonSaveW(W) {
  seasonLsSet('lorddomain.world.v2', wdSave(W));
  if (typeof saveWorld === 'function') saveWorld();
}
function seasonLootGrant(loot) {
  var k;
  if (!loot) return;
  if (typeof wdUiGrant === 'function') { wdUiGrant(loot); return; }
  if (loot.coin > 0 && seasonWorldReady()) world.res.coin = (world.res.coin || 0) + loot.coin;
  if (loot.forge && typeof matGrant === 'function') { matGrant(loot.mats); return; }
  if (typeof cityGoodsAdd === 'function') for (k in loot.mats || {}) if (loot.mats[k] > 0) cityGoodsAdd(k, loot.mats[k]);
}
function seasonHistPut(st, e) {
  st.hist = st.hist.filter(function (h) { return h.idx !== e.idx; });
  st.hist.push(e);
  st.hist.sort(function (a, b) { return b.idx - a.idx; });
  st.hist = st.hist.slice(0, SEASON_CFG.histMax);
}
function seasonPendPut(st, p) {
  st.pend = st.pend.filter(function (x) { return x.id !== p.id; });
  st.pend.push(p);
  st.pend.sort(function (a, b) { return b.idx - a.idx; });
  st.pend = st.pend.slice(0, SEASON_CFG.pendMax);
}
// step 'settle':只結算 from 這一季
function seasonSettle(st, job) {
  var from = job.from, tEnd = job.tEnd, lw = null, W = null, cs = null, r, got, rk, part, conv, give, twTop = 0, e, k, j;
  seasonCall(typeof rsvSettle === 'function' ? rsvSettle : null, [tEnd]);
  lw = seasonLoadW(tEnd);
  if (lw) {
    W = lw.W; cs = lw.cs;
    r = wdAdvance(W, cs, tEnd);   // 季末前的行程照打、事件照記
    (r.events || []).forEach(function (ev) { if (ev.k === 'report') seasonLootGrant(ev.loot); });
    got = wdCollect(W, tEnd);
    if (typeof WD_HARV_KEYS !== 'undefined' && typeof res4Add === 'function') WD_HARV_KEYS.forEach(function (key) { var g = {}; if (got[key] > 0) { if (WD_HARV_RES4[key]) { g[WD_HARV_RES4[key]] = got[key]; res4Add(g); } else if (WD_HARV_MAT[key] && typeof matGrant === 'function') { g[WD_HARV_MAT[key]] = got[key]; matGrant(g); } } });
    if (got.shards > 0 && typeof cardsShardGain === 'function') cardsShardGain(cs, got.shards);
    seasonSaveW(W);
  }
  seasonCall(typeof homeSettle === 'function' ? homeSettle : null, [tEnd]);
  seasonRegEach('settle', tEnd);
  part = st.part[from] ? 1 : 0;
  rk = seasonRankAt(from, tEnd, W);
  conv = 0;   // 方案 A:剩餘資源換碎片已移除(欄位保留給舊存檔 hist / pend 讀取)
  if (seasonTowerOn() && typeof twRead === 'function') { try { twTop = twRead().top | 0; } catch (e2) { twTop = 0; } }   // @DORMANT tower
  e = { idx: from, pow: 0, rank: part ? rk.rank : 0, of: part ? rk.of : 0, cities: 0, tw: twTop, part: part, conv: conv };
  rk.rows.forEach(function (row) { if (row.me) { e.pow = row.pow; e.cities = row.cities; } });
  for (j = job.to - 1; j > from && job.to - j <= SEASON_CFG.histMax; j--) seasonHistPut(st, { idx: j, pow: 0, rank: 0, of: 0, cities: 0, tw: 0, part: 0, conv: 0 });   // 中間沒參加的季
  seasonHistPut(st, e);
  give = part ? seasonRankGive(rk.rank) : seasonNormGive(null);
  if (part || conv > 0) seasonPendPut(st, { id: 's' + from, idx: from, rank: e.rank, give: give, conv: conv, sweep: null });
  job.step = 'reset';
  st.job = job;
  seasonWrite(st);
}
// step 'reset':全部重置到 to 這一季。任何一步丟例外 → 由呼叫端記在 job.err,下次續做(各掛點自己冪等)
function seasonReset(st, job) {
  var to = job.to, tStart = seasonBegin(to), lw, r, p, k;
  if (typeof wdSeasonReset === 'function') {
    lw = seasonLoadW(tStart);
    if (lw) { wdSeasonReset(lw.W, lw.cs, to, tStart); seasonSaveW(lw.W); }
  }
  if (seasonTowerOn() && typeof twSeasonReset === 'function') {   // @DORMANT tower(休眠:塔存檔原樣保留,不重置不掃蕩)
    r = twSeasonReset(to, st.twBest);
    if (r && !r.skipped) { job.tw = { from: r.from | 0, to: r.to | 0, mats: seasonNormGive({ mats: r.mats }).mats }; st.job = job; seasonWrite(st); }
  }
  seasonCall(typeof rsvSeasonReset === 'function' ? rsvSeasonReset : null, [to, tStart]);
  seasonCall(typeof res4SeasonReset === 'function' ? res4SeasonReset : null, [to]);
  seasonCall(typeof homeSeasonReset === 'function' ? homeSeasonReset : null, [to, tStart]);
  SEASON_REG.forEach(function (m) { if (typeof m.reset === 'function') m.reset(to, tStart); });
  // 完成:塔掃蕩結果併入上季結算(塔休眠時 job.tw 不會產生)
  if (job.tw && (job.tw.to > 0 || Object.keys(job.tw.mats).length)) {
    p = st.pend.filter(function (x) { return x.id === 's' + job.from; })[0];
    if (!p) { p = { id: 's' + job.from, idx: job.from, rank: 0, give: seasonNormGive(null), conv: 0, sweep: null }; seasonPendPut(st, p); }
    p.sweep = { from: job.tw.from, to: job.tw.to };
    for (k in job.tw.mats) p.give.mats[k] = Math.min(99999, (p.give.mats[k] | 0) + job.tw.mats[k]);
  }
  st.idx = to; st.job = null;
  st.part[to] = 1;
}
function seasonDropWorldCache() {
  if (typeof wdUiDrop === 'function') { wdUiDrop(); return; }
  if (typeof WDUI !== 'undefined' && WDUI) WDUI.W = null;
}
// 開機 / 回前景呼叫(要在所有推進時間的模組之前)。回 {changed, from, to, frozen, throttled, migrated, error}
function seasonTick(now, force) {
  var st, raw, cur, job, out = { changed: false, from: -1, to: -1, frozen: false, throttled: false, migrated: false, error: '' }, p;
  now = typeof now === 'number' && isFinite(now) ? now : Date.now();
  if (typeof SEASON_ON === 'undefined' || !SEASON_ON) { out.off = true; return out; }   // 休眠:旗標關閉時什麼都不做
  raw = seasonLsGet(SEASON_KEY);
  if (!force && raw && raw === SEASON_MEM.lastRaw && now >= SEASON_MEM.last && now - SEASON_MEM.last < SEASON_CFG.throttleMs) { out.throttled = true; return out; }
  st = seasonRaw();
  if (!st) {
    st = seasonMigrate(now);
    if (!st) return out;   // 世界尚未載入
    out.migrated = true;
  }
  if (now < st.hi - SEASON_CFG.clockSlack) { out.frozen = true; return out; }   // 時鐘倒退:凍結
  st = seasonRead();
  st.hi = Math.max(st.hi, now);
  cur = Math.max(0, Math.floor((now - st.s0) / seasonLen()));
  if (!st.job && cur > st.idx) {
    if (typeof savesBackupUndo === 'function') {   // 換季前復原點:同步擷取、非同步寫入;失敗只提示不中止
      try { p = savesBackupUndo('換季前 第 ' + (st.idx + 1) + ' 季'); if (p && typeof p.catch === 'function') p.catch(function () { if (typeof showToast === 'function') showToast('換季前復原點建立失敗'); }); }
      catch (e0) { if (typeof showToast === 'function') showToast('換季前復原點建立失敗'); }
    }
    st.job = { from: st.idx, to: cur, step: 'settle', tEnd: st.s0 + (st.idx + 1) * seasonLen() };
    seasonWrite(st);
  }
  if (st.job) {
    job = st.job;
    out.from = job.from; out.to = job.to;
    try {
      if (job.step === 'settle') seasonSettle(st, job);
      if (job.step === 'reset') {
        seasonReset(st, job);
        out.changed = true;
      }
      delete job.err;
    } catch (e) {
      job.err = String(e && e.message ? e.message : e).slice(0, 120);
      st.job = job;
      seasonWrite(st);
      out.error = job.err;
      return out;
    }
    seasonWrite(st);
    seasonDropWorldCache();
  } else {
    if (!st.part[cur]) { st.part[cur] = 1; }
    seasonWrite(st);
  }
  if (!st.part[cur]) { st.part[cur] = 1; seasonWrite(st); }
  SEASON_MEM.lastRaw = seasonLsGet(SEASON_KEY); SEASON_MEM.last = now;
  return out;
}

// ───────── 獎勵 ─────────
function seasonPendList() { var st = seasonRaw(); return st ? JSON.parse(JSON.stringify(st.pend)) : []; }
// 先刪 pend、寫存檔,再 evGive;發放失敗(沒有卡牌存檔)→ 放回去
function seasonClaim(id) {
  var st = seasonRead(), i, p, g, r;
  if (!st) return { ok: false, reason: 'none' };
  for (i = 0; i < st.pend.length; i++) if (st.pend[i].id === id) break;
  if (i >= st.pend.length) return { ok: false, reason: 'none' };
  p = st.pend[i];
  if (typeof evGive !== 'function') return { ok: false, reason: 'nogive' };
  st.pend.splice(i, 1);
  seasonWrite(st);
  g = { pulls: p.give.pulls, shards: p.give.shards + p.conv, mats: p.give.mats };
  r = evGive(g);
  if (!r || !r.ok) {
    st = seasonRead(); st.pend.push(p); seasonWrite(st);
    return { ok: false, reason: 'give' };
  }
  return { ok: true, text: r.text, give: g };
}
function seasonClaimAll() {
  var ids = seasonPendList().map(function (p) { return p.id; }), n = 0, texts = [];
  ids.forEach(function (id) { var r = seasonClaim(id); if (r.ok) { n++; texts.push(r.text); } });
  return { ok: n === ids.length, n: n, text: texts.join(' ') };
}
function seasonMarkSeen(idx) { var st = seasonRead(); if (!st) return false; st.seen = seasonInt(idx, -1, 1e5, st.seen); return seasonWrite(st); }
function seasonMarkWarn(idx) { var st = seasonRead(); if (!st) return false; st.warn = seasonInt(idx, -1, 1e5, st.warn); return seasonWrite(st); }
// 塔歷史最高(只增不減;塔休眠時沒有呼叫端)
function seasonTowerBest(top) {
  var st = seasonRead();
  top = seasonInt(top, 0, 100, 0);
  if (!st || top <= st.twBest) return st ? st.twBest : 0;
  st.twBest = top;
  seasonWrite(st);
  return top;
}
// 給畫面:{idx, day, week, tEnd, xpMul, warn(要不要顯示季末倒數橫幅), pendN, job}
function seasonInfo(now) {
  var st = seasonRaw(), day;
  now = typeof now === 'number' && isFinite(now) ? now : Date.now();
  day = seasonDay(now);
  return { idx: seasonIdxAt(now), day: day, week: seasonWeek(now), tEnd: seasonEnd(now), xpMul: seasonXpMul(now), warn: !!st && day >= SEASON_CFG.warnDay && st.warn !== seasonIdxAt(now), pendN: st ? st.pend.length : 0, job: !!(st && st.job) };
}
