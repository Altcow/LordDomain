// js/ld_open_ev.js — 活動與主線核心(設計_開場解鎖_預約_活動_定案.md 4、5.3 / 卡 5、7、8 的邏輯面;純邏輯,無 DOM)。前綴 ev / ldOpen。資料表在 ld_open_data.js(EV_CFG / EV_MAIN)。
// 存檔:localStorage 'lorddomain.ev.v1' = {v:1, s0 賽季起點, legacy, nb:{days,last,got:[],pick:0|1|2}, ss:{season,got:{}}, main:{done:{}}, cnt:{計數器}, tut, auto:{on,order}, boss:null|{…}, pend:[]};已加入 SAVE_SLOT_KEYS。
// 活動日曆以「賽季起點」計算(每 28 天一季,起點 = 第一次建立活動資料時當週週一 00:00 東八區);日後賽季模組提供起點時只改 evSeasonStart()。
// 團結關:用 wdRunFight 直接打(不走行程、不寫占用、不損兵、不重傷、一律滿兵快照);首領血量只減不回。獎勵直接入帳(evGive)。
// 只在旗標 ldui(且 shell)開啟時生效(@DORMANT ldui;unlockOn 判斷)。ES2017;不用 ?. ??。
// 全域:EV_KEY evRead evWrite evNorm evOn evSeasonStart evDayOfSeason evSeasonIdx evActive evTreasureOn evLoginTick evNbList evNbClaim evNbPick evSignList evSignClaim evBossGet evBossWindow evBossSlots evBossSlotNow evBossFight evBossSetAuto evBossRatio evBossEnsure evBossFoes evMainCur evMainList evMainCheck evGive evNote ldOpenNote evTutEnsure。

var EV_KEY = 'lorddomain.ev.v1';

function evOn() { return typeof unlockOn === 'function' && unlockOn(); }   // @DORMANT ldui
function evDayKey(now) { var d = new Date(now + EV_CFG.tz); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); }
// 週一 00:00(東八區)的絕對毫秒
function evMonday(now) {
  var L = now + EV_CFG.tz, d = Math.floor(L / EV_CFG.DAY), back = (d + 3) % 7;   // 1970-01-01 是週四:(d + 3) % 7 = 0 為週一
  return (d - back) * EV_CFG.DAY - EV_CFG.tz;
}
function evDefault(now) {
  return { v: 1, s0: evMonday(now), legacy: 0, nb: { days: 0, last: '', got: [], pick: 0 }, ss: { season: 0, got: {} }, main: { done: {} }, cnt: {}, tut: 0, auto: { on: 0, order: [1, 2, 3] }, boss: null, pend: [] };
}
function evNormBoss(b) {
  var o, i, j;
  if (!b || typeof b !== 'object' || !Array.isArray(b.hp)) return null;
  o = { key: ldOpenNum(b.key, 0, 1e9, 0), run: ldOpenNum(b.run, 0, 9, 0), t0: ldOpenNum(b.t0, 0, 1e15, 0), t1: ldOpenNum(b.t1, 0, 1e15, 0), seed: ldOpenNum(b.seed, 0, 4294967295, 1), mul: typeof b.mul === 'number' && isFinite(b.mul) ? Math.max(0.1, Math.min(10, b.mul)) : 1,
    hp: [], used: {}, dmg: typeof b.dmg === 'number' && isFinite(b.dmg) ? Math.max(0, Math.min(1, b.dmg)) : 0, got: { s25: 0, s50: 0, s75: 0, kill: 0, part: 0 }, n: ldOpenNum(b.n, 0, 1e9, 0), fin: b.fin ? 1 : 0, rp: [] };
  for (i = 0; i < EV_CFG.bossTeams; i++) {
    o.hp.push([0, 1, 2].map(function (k) { var x = b.hp[i] && b.hp[i][k]; return typeof x === 'number' && isFinite(x) ? Math.max(0, Math.min(1, x)) : 1; }));
  }
  if (b.used && typeof b.used === 'object') Object.keys(b.used).slice(0, 40).forEach(function (k) { if (b.used[k]) o.used[k] = 1; });
  if (b.got && typeof b.got === 'object') Object.keys(o.got).forEach(function (k) { if (b.got[k]) o.got[k] = 1; });
  o.rp = (Array.isArray(b.rp) ? b.rp : []).filter(function (r) { return r && typeof r === 'object'; }).slice(0, EV_CFG.bossRpMax);
  j = o.rp.length;
  return o;
}
// 正規化:壞檔 → null(由 evRead 重建)
function evNorm(raw, now) {
  var o = evDefault(now), nb, ss;
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  o.s0 = ldOpenNum(raw.s0, 1, 1e15, o.s0);
  o.legacy = raw.legacy ? 1 : 0;
  if (raw.nb && typeof raw.nb === 'object') {
    nb = raw.nb;
    o.nb.days = ldOpenNum(nb.days, 0, 1e5, 0); o.nb.last = typeof nb.last === 'string' ? nb.last.slice(0, 12) : '';
    o.nb.got = (Array.isArray(nb.got) ? nb.got : []).map(function (x) { return ldOpenNum(x, 1, 7, 0); }).filter(function (x, i, a) { return x > 0 && a.indexOf(x) === i; });
    o.nb.pick = ldOpenNum(nb.pick, 0, 2, 0);
  }
  if (raw.ss && typeof raw.ss === 'object') {
    ss = raw.ss; o.ss.season = ldOpenNum(ss.season, 0, 1e5, 0);
    if (ss.got && typeof ss.got === 'object') Object.keys(ss.got).slice(0, 40).forEach(function (k) { var d = ldOpenNum(+k, 1, 28, 0); if (d && ss.got[k]) o.ss.got[d] = 1; });
  }
  if (raw.main && raw.main.done && typeof raw.main.done === 'object') Object.keys(raw.main.done).slice(0, 40).forEach(function (k) { if (raw.main.done[k]) o.main.done[k] = 1; });
  if (raw.cnt && typeof raw.cnt === 'object') Object.keys(raw.cnt).slice(0, 40).forEach(function (k) { var n = ldOpenNum(raw.cnt[k], 0, 1e9, 0); if (n) o.cnt[k] = n; });
  o.tut = raw.tut ? 1 : 0;
  if (raw.auto && typeof raw.auto === 'object') {
    o.auto.on = raw.auto.on ? 1 : 0;
    if (Array.isArray(raw.auto.order)) o.auto.order = raw.auto.order.map(function (n) { return ldOpenNum(n, 1, 9, 0); }).filter(Boolean).slice(0, 5);
  }
  o.boss = evNormBoss(raw.boss);
  o.pend = (Array.isArray(raw.pend) ? raw.pend : []).filter(function (x) { return x && typeof x === 'object'; }).slice(0, EV_CFG.pendMax);
  return o;
}
function evRead(now) {
  var s = ldOpenLsGet(EV_KEY), o = null, d;
  now = now || Date.now();
  if (s) { try { o = evNorm(JSON.parse(s), now); } catch (e) { o = null; } }
  if (o) return o;
  d = evDefault(now);
  d.legacy = (typeof unlockRead === 'function' && unlockRead().legacy) ? 1 : 0;
  if (!unlockWorldReady()) return d;   // 世界尚未載入:不寫
  if (d.legacy) { d.main.done = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }; }   // 舊存檔:主線前 5 條標完成、不給獎
  evWrite(d);
  return d;
}
function evWrite(o) { return ldOpenLsSet(EV_KEY, JSON.stringify(o)); }

// ───────── 賽季 / 日曆 ─────────
function evSeasonStart() { return (typeof seasonStart === 'function' && typeof SEASON_ON !== 'undefined' && SEASON_ON) ? seasonStart() : evRead().s0; }   // 賽季核心(season.js)旗標 SEASON_ON 開啟後才接管
function evSeasonIdx(now) { return Math.max(0, Math.floor((now - evSeasonStart()) / (EV_CFG.DAY * EV_CFG.seasonDays))); }
function evDayOfSeason(now) { var s0 = evSeasonStart(); return Math.floor(Math.max(0, now - s0) / EV_CFG.DAY) % EV_CFG.seasonDays + 1; }
// 目前進行中的活動:[{id:'boss'|'treasure'|'sign', t0, t1}]
function evActive(now) {
  var s0 = evSeasonStart(), k = evSeasonIdx(now), base = s0 + k * EV_CFG.seasonDays * EV_CFG.DAY, out = [], w;
  out.push({ id: 'sign', t0: base, t1: base + EV_CFG.seasonDays * EV_CFG.DAY });
  EV_CFG.treasure.forEach(function (r) {
    var t0 = base + (r[0] - 1) * EV_CFG.DAY, t1 = base + r[1] * EV_CFG.DAY;
    if (now >= t0 && now < t1) out.push({ id: 'treasure', t0: t0, t1: t1 });
  });
  w = evBossWindow(now);
  if (w) out.push({ id: 'boss', t0: w.t0, t1: w.t1 });
  return out;
}
// 下一個活動(顯示倒數用):回 {id, t0} 或 null;onlyId = 'boss' | 'treasure' 只看該種
function evNextStart(now, onlyId) {
  var s0 = evSeasonStart(), k = evSeasonIdx(now), best = null;
  [k, k + 1].forEach(function (kk) {
    var base = s0 + kk * EV_CFG.seasonDays * EV_CFG.DAY;
    if (!onlyId || onlyId === 'treasure') EV_CFG.treasure.forEach(function (r) { var t0 = base + (r[0] - 1) * EV_CFG.DAY; if (t0 > now && (!best || t0 < best.t0)) best = { id: 'treasure', t0: t0 }; });
    if (!onlyId || onlyId === 'boss') EV_CFG.boss.forEach(function (r) { var t0 = base + (r.d0 - 1) * EV_CFG.DAY + 12 * EV_CFG.HOUR; if (t0 > now && (!best || t0 < best.t0)) best = { id: 'boss', t0: t0 }; });
  });
  return best;
}
// 寶地:地圖刷新(wdRefreshRes)時呼叫,t = 刷新時刻
function evTreasureOn(t) {
  var a;
  if (!evOn()) return false;
  a = evActive(t);
  return a.some(function (x) { return x.id === 'treasure'; });
}
// 團結關視窗(now 落在哪一次):回 {run, key, t0, t1, mul} 或 null
function evBossWindow(now) {
  var s0 = evSeasonStart(), k = evSeasonIdx(now), base = s0 + k * EV_CFG.seasonDays * EV_CFG.DAY, i, r, t0, t1;
  for (i = 0; i < EV_CFG.boss.length; i++) {
    r = EV_CFG.boss[i];
    t0 = base + (r.d0 - 1) * EV_CFG.DAY + 12 * EV_CFG.HOUR;
    t1 = base + (r.d1 - 1) * EV_CFG.DAY + 20 * EV_CFG.HOUR;
    if (now >= t0 && now < t1) return { run: i + 1, key: k * 10 + i + 1, t0: t0, t1: t1, mul: r.mul };
  }
  return null;
}
// 時段(A:12:00~20:00、B:20:00~隔天 12:00):回 [{i, t0, t1, ab}],涵蓋整個視窗
function evBossSlots(b) {
  var out = [], t = b.t0, i = 0, ab, dur;
  while (t < b.t1 && i < 60) {
    ab = i % 2 === 0 ? 'A' : 'B';
    dur = ab === 'A' ? 8 * EV_CFG.HOUR : 16 * EV_CFG.HOUR;
    out.push({ i: i, t0: t, t1: Math.min(b.t1, t + dur), ab: ab });
    t += dur; i++;
  }
  return out;
}
function evBossSlotNow(b, now) {
  var s = evBossSlots(b), i;
  for (i = 0; i < s.length; i++) if (now >= s[i].t0 && now < s[i].t1) return s[i];
  return null;
}

// ───────── 登入 / 新手七日 / 簽到 ─────────
function evGiveText(g) {
  var p = [];
  if (g.pulls) p.push('抽數 +' + g.pulls);
  if (g.shards) p.push('碎片 +' + g.shards);
  if (g.grain) p.push('糧 +' + g.grain);
  Object.keys(g.mats || {}).forEach(function (id) { p.push((typeof matName === 'function' ? matName(id) : id) + ' +' + g.mats[id]); });
  return p.join(' ');
}
// 發獎:抽數 → 大池贈抽、碎片 → cardsShardGain、糧 → res4Add、材料 → matGrant。回 {ok, text}
function evGive(give) {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, g = give || {};
  if (!cs) return { ok: false, text: '' };
  if (g.pulls > 0 && typeof cardsPullGrant === 'function') cardsPullGrant(cs, g.pulls, 'E');
  if (g.shards > 0 && typeof cardsShardGain === 'function') cardsShardGain(cs, g.shards);
  if (g.grain > 0 && typeof res4Add === 'function') res4Add({ grain: g.grain });
  if (g.mats && typeof matGrant === 'function') matGrant(g.mats);
  if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 存檔失敗不影響入帳結果 */ } }
  return { ok: true, text: evGiveText(g) };
}
// 開遊戲 / 回前景時呼叫:登入日 +1(同日不重複)、賽季換季重置簽到、團結關開關與自動出戰、主線檢查。回 {newDay, season, bossAuto:[]}
function evLoginTick(now) {
  var o, today, out = { newDay: false, season: false, bossAuto: [] }, k, cs;
  if (!evOn()) return out;
  now = now || Date.now();
  o = evRead(now);
  today = evDayKey(now);
  if (o.nb.last !== today) { o.nb.days = Math.min(1e5, o.nb.days + 1); o.nb.last = today; out.newDay = true; }
  k = evSeasonIdx(now);
  if (o.ss.season !== k) { o.ss.season = k; o.ss.got = {}; out.season = true; }
  evWrite(o);
  evBossEnsure(now);
  o = evRead(now);
  if (o.boss && !o.boss.fin && o.auto.on) {
    cs = (typeof cardsGet === 'function') ? cardsGet() : null;
    evBossSlots(o.boss).forEach(function (sl) {
      var r;
      if (sl.t0 > now || sl.t1 <= sl.t0) return;
      if (evRead(now).boss && evRead(now).boss.used['S' + sl.i]) return;
      r = evBossFight(cs, o.auto.order, now, { slot: sl.i });
      if (r.ok) out.bossAuto.push({ slot: sl.i, dmg: r.dmg });
    });
  }
  evMainCheck(now);
  return out;
}
// 新手七日:[{day, got, can, pulls, pick}],can = 登入日數已到且沒領
function evNbList() {
  var o = evRead(), i, out = [];
  for (i = 1; i <= 7; i++) out.push({ day: i, got: o.nb.got.indexOf(i) >= 0, can: i <= o.nb.days && o.nb.got.indexOf(i) < 0, pulls: EV_CFG.nbPulls[i - 1], give: EV_CFG.nbGive ? EV_CFG.nbGive[i - 1] : null, pick: i === EV_CFG.nbPickDay, legacy: !!o.legacy });
  return out;
}
function evNbGive(day, legacy) {
  var g = { grain: (EV_CFG.nbExtra[day] || {}).grain || 0 };
  var ng = EV_CFG.nbGive && EV_CFG.nbGive[day - 1];
  if (legacy) g.shards = EV_CFG.legacyShards;
  else if (ng) { if (ng.shards) g.shards = ng.shards; if (ng.mats) g.mats = JSON.parse(JSON.stringify(ng.mats)); }
  else if (EV_CFG.nbPulls[day - 1] > 0) g.pulls = EV_CFG.nbPulls[day - 1];
  return g;
}
function evNbClaim(day) {
  var o = evRead(), r;
  day = ldOpenNum(day, 1, 7, 0);
  if (!evOn() || !day) return { ok: false, reason: 'bad' };
  if (day > o.nb.days) return { ok: false, reason: 'notyet' };
  if (o.nb.got.indexOf(day) >= 0) return { ok: false, reason: 'got' };
  r = evGive(evNbGive(day, !!o.legacy));
  if (!r.ok) return { ok: false, reason: 'nocards' };
  o = evRead();   // 發獎過程可能重入而寫過存檔,重讀再改
  o.nb.got.push(day);
  if (day === EV_CFG.nbPickDay && !o.nb.pick) o.nb.pick = 1;   // 第 7 天:另送 1 張自選紫名人(待選)
  evWrite(o);
  return { ok: true, text: r.text, pick: day === EV_CFG.nbPickDay };
}
// 第 7 天自選紫名人:figId 取自 cardsFigPool(3);只給一次
function evNbPick(figId) {
  var o = evRead(), cs = (typeof cardsGet === 'function') ? cardsGet() : null, pool, f, c, e, i;
  if (!evOn() || o.nb.pick !== 1 || !cs) return { ok: false, reason: o.nb.pick === 2 ? 'done' : 'notyet' };
  pool = (typeof cardsFigPool === 'function') ? cardsFigPool(3) : [];
  for (i = 0; i < pool.length; i++) if (pool[i].id === figId) f = pool[i];
  if (!f) return { ok: false, reason: 'nofig' };
  if (typeof cardsRosterRoom === 'function' && cardsRosterRoom(cs) < 1) return { ok: false, reason: 'full' };
  c = cardFromFig(f, 'E', 0);
  e = cardsMakeEntry(cs, c, 'E', 'nbpick', cardsCost(c));
  cs.roster.push(e);
  o.nb.pick = 2;
  evWrite(o);
  if (typeof saveWorld === 'function') { try { saveWorld(); } catch (er) { /* 略過 */ } }
  return { ok: true, name: f.name };
}
// 賽季簽到:[{day, got, today, past, big}];不可補(只有今天可領)
function evSignList(now) {
  var o = evRead(now), d = evDayOfSeason(now || Date.now()), i, out = [];
  for (i = 1; i <= EV_CFG.seasonDays; i++) out.push({ day: i, got: !!o.ss.got[i], today: i === d, past: i < d, big: EV_CFG.signBig.indexOf(i) >= 0 });
  return out;
}
function evSignClaim(day, now) {
  var o, d, big, g, r;
  if (!evOn()) return { ok: false, reason: 'off' };
  now = now || Date.now();
  o = evRead(now);
  day = ldOpenNum(day, 1, 28, 0);
  d = evDayOfSeason(now);
  if (!day || day > d) return { ok: false, reason: 'future' };
  if (day < d) return { ok: false, reason: 'missed' };
  if (o.ss.got[day]) return { ok: false, reason: 'got' };
  big = EV_CFG.signBig.indexOf(day) >= 0;
  g = { pulls: EV_CFG.signPulls + (big ? EV_CFG.signBigPulls : 0), grain: EV_CFG.signGrain, shards: EV_CFG.signShards };
  if (big) g.mats = EV_CFG.signBigMat;
  r = evGive(g);
  if (!r.ok) return { ok: false, reason: 'nocards' };
  o = evRead(now);   // 發獎過程可能重入而寫過存檔,重讀再改
  o.ss.got[day] = 1;
  evWrite(o);
  return { ok: true, text: r.text };
}

// ───────── 團結關 ─────────
function evBossGet() { var o = evRead(); return o.boss; }
// 進入 / 離開視窗時建立 / 結算首領。回目前的首領(可能已結束,fin = 1)或 null
function evBossEnsure(now) {
  var o = evRead(now), w, seed;
  if (!evOn()) return null;
  w = evBossWindow(now);
  if (o.boss && (!w || o.boss.key !== w.key)) {
    if (!o.boss.fin) { evWrite(o); evBossFinish(now, true); o = evRead(now); }
    o.boss = null;
  }
  if (w && !o.boss) {
    seed = ((Math.floor(o.s0 / 60000) * 2654435761) + w.key * 40503) >>> 0;
    o.boss = evNormBoss({ key: w.key, run: w.run, t0: w.t0, t1: w.t1, seed: seed, mul: w.mul, hp: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] });
  }
  evWrite(o);
  return o.boss;
}
// 結束(視窗過了沒打死):首領撤退,發參與獎 = 擊殺獎 × 已打掉比例 × 0.5;只發一次
function evBossFinish(now, retreat) {
  var o = evRead(now), b = o.boss, k = EV_CFG.bossKill, g, r, any;
  if (!b || b.fin) return null;
  b.fin = 1;
  if (retreat && !b.got.kill && !b.got.part && b.dmg > 0) {
    b.got.part = 1;
    g = { pulls: Math.floor(k.pulls * b.dmg * EV_CFG.bossPartRate), shards: Math.floor((k.shards || 0) * b.dmg * EV_CFG.bossPartRate), mats: {} };
    Object.keys(k.mats || {}).forEach(function (id) { var n = Math.floor(k.mats[id] * b.dmg * EV_CFG.bossPartRate); if (n > 0) g.mats[id] = n; });
    any = g.pulls > 0 || g.shards > 0 || Object.keys(g.mats).length > 0;
    if (any) r = evGive(g);
  }
  evWrite(o);
  return r ? r.text : '';
}
// 首領守軍 3 隊(複製快取的守軍並放大血量):回 {foes:[{units, power}], max:[[hp…]…], total}
function evBossFoes(b) {
  var Wd = { seed: b.seed }, pt = { id: 'EVB' + b.key, cat: 'beast', ty: EV_CFG.bossName, lv: EV_CFG.bossLv, fs: b.seed, nf: EV_CFG.bossTeams }, foes = [], j, base = 0, f, mul, tot = 0, max = [];
  for (j = 0; j < pt.nf; j++) { f = wdClone(wdFoeTeam(Wd, pt, j)); foes.push(f); f.units.forEach(function (u) { base += u.stats.hp; }); }
  if (EV_CFG.bossDmgRef > 0 && base > 0) mul = EV_CFG.bossDmgRef * 32 * b.mul / base; else mul = EV_CFG.bossHpMul * b.mul;
  foes.forEach(function (fo) { fo.units.forEach(function (u) { u.stats.hp = Math.round(u.stats.hp * mul); }); });
  foes.forEach(function (fo) { var m = wdFoeMax(fo); max.push(m); m.forEach(function (x) { tot += x; }); });
  return { foes: foes, max: max, total: tot };
}
function evBossRatio(b) {
  var F, cur = 0, j, k;
  if (!b) return 0;
  F = evBossFoes(b);
  for (j = 0; j < b.hp.length; j++) for (k = 0; k < 3; k++) cur += F.max[j][k] * b.hp[j][k];
  return F.total ? cur / F.total : 0;
}
function evBossAlive(b) { return b.hp.some(function (r) { return r.some(function (x) { return x > 0; }); }); }
// 出戰:cs = 名冊;teamNos = 依出場順序的隊號;opt.slot = 指定時段索引(自動出戰補打用)。每隊對「目前第一個還活著的守軍隊」打一場。
// 我方快照 = 開打當下的卡 / 星階 / 裝備 / 隊伍編制,一律滿兵(wdBuildMine 以空 trp 建構)、不看重傷、不寫占用、不改 W。回 {ok, reason, rows, dmg, got:[], killed}
function evBossFight(cs, teamNos, now, opt) {
  var o, b, sl, si, teams, F, rows = [], got = [], j, killed = false, before, fameN, lastTeam = 0, empty = { trp: {}, hurt: {} };
  opt = opt || {};
  if (!evOn()) return { ok: false, reason: 'off' };
  now = now || Date.now();
  b = evBossEnsure(now);
  if (!b || b.fin || now >= b.t1) return { ok: false, reason: 'noboss' };
  sl = opt.slot !== undefined ? { i: opt.slot } : evBossSlotNow(b, now);
  if (!sl) return { ok: false, reason: 'noslot' };
  si = 'S' + sl.i;
  if (b.used[si]) return { ok: false, reason: 'used' };
  if (!cs || typeof wdTeams !== 'function') return { ok: false, reason: 'nocards' };
  teams = [];
  (teamNos || []).forEach(function (n) { wdTeams().forEach(function (t) { if (t.n === n && !teams.some(function (x) { return x.n === n; })) teams.push(t); }); });
  if (!teams.length) return { ok: false, reason: 'noteam' };
  F = evBossFoes(b);
  before = evBossRatio(b);
  teams.forEach(function (t) {
    var fj = -1, mine, res, row, k;
    for (k = 0; k < b.hp.length; k++) if (b.hp[k].some(function (x) { return x > 0; })) { fj = k; break; }
    if (fj < 0) return;
    mine = wdBuildMine(empty, cs, t.slots, now);
    if (!mine.ids.length) return;
    b.n++;
    res = wdRunFight(mine, F.foes[fj], b.hp[fj], bnHash('evb', b.seed, b.n));
    b.hp[fj] = res.newRow;
    row = { team: t.n, name: t.name, foe: fj, dmg: F.total ? Math.round(res.dmgAbs / F.total * 10000) / 10000 : 0, rounds: res.rounds, win: res.win };
    rows.push(row);
    if (!evBossAlive(b)) lastTeam = t.n;
  });
  if (!rows.length) return { ok: false, reason: 'noteam' };
  b.used[si] = 1;
  b.dmg = Math.max(b.dmg, Math.round((1 - evBossRatio(b)) * 10000) / 10000);
  EV_CFG.bossStage.forEach(function (th, i) {
    var key = 's' + Math.round(th * 100), r;
    if (b.dmg + 1e-9 >= th && !b.got[key]) { b.got[key] = 1; r = evGive(EV_CFG.bossStageGive[i]); got.push('打掉 ' + Math.round(th * 100) + '%:' + (r.text || '')); }
  });
  if (!evBossAlive(b) && !b.got.kill) {
    b.got.kill = 1; b.fin = 1; killed = true;
    got.push('擊殺:' + evGive(EV_CFG.bossKill).text);
    if (EV_CFG.bossLast.length) {
      j = Math.floor(bnRng(bnHash('evl', b.seed, b.n))() * EV_CFG.bossLast.length);
      var lm = {}; lm[EV_CFG.bossLast[j]] = 1;
      got.push('最後一刀:' + evGive({ mats: lm }).text);
    }
    if (typeof fameFor === 'function' && typeof fameAdd === 'function') { fameN = fameFor('beast', EV_CFG.bossLv); if (fameN > 0) { fameAdd(fameN, 'evboss'); got.push('名聲 +' + fameN); } }
  }
  b.rp.unshift({ t: now, slot: sl.i, rows: rows, dmg: Math.round((before - evBossRatio(b)) * 10000) / 10000, killed: killed });
  if (b.rp.length > EV_CFG.bossRpMax) b.rp.length = EV_CFG.bossRpMax;
  o = evRead(now);
  o.boss = b;
  evWrite(o);
  return { ok: true, reason: '', rows: rows, dmg: Math.round((before - evBossRatio(b)) * 10000) / 10000, got: got, killed: killed, last: lastTeam };
}
function evBossSetAuto(on, teamNos) {
  var o = evRead();
  if (!evOn()) return false;
  o.auto.on = on ? 1 : 0;
  if (Array.isArray(teamNos) && teamNos.length) o.auto.order = teamNos.map(function (n) { return ldOpenNum(n, 1, 9, 0); }).filter(Boolean).slice(0, 5);
  return evWrite(o);
}

// ───────── 主線 ─────────
function ldOpenPoll(name) {
  var i, t;
  try {
    if (name === 'team1') { t = typeof wdTeams === 'function' ? wdTeams() : []; for (i = 0; i < t.length; i++) if (t[i].n === 1) return true; return false; }
  } catch (e) { return false; }
  return false;
}
function ldOpenHasFn(name) { try { return /^[A-Za-z_$][\w$]*$/.test(name) && Function('return typeof ' + name + ' === "function"')(); } catch (e) { return false; } }
function evMainAvail(q) { if (q.feat && !(typeof featureOn === 'function' && featureOn(q.feat))) return false; return !q.need || ldOpenHasFn(q.need); }   // feat:該功能旗標關閉 = 視為不存在(目前無主線使用)
// 主線計數:mapWin 為 2026-11-15 新增,舊存檔沒有 → 以山寨 + 野怪集結 + 縣的舊計數墊底
function evMainHave(q, o) { var h = o.cnt[q.k] | 0; if (q.k === 'mapWin') h = Math.max(h, (o.cnt.campWin | 0) + (o.cnt.beastKill | 0) + (o.cnt.countyWin | 0)); return h; }
function evMainMet(q, o) {
  if (q.poll) return ldOpenPoll(q.poll);
  return evMainHave(q, o) >= q.n;
}
// 主線清單:[{id, t, done, cur, skip, give, n, have}]
function evMainList() {
  var o = evRead(), curId = 0, out = [];
  EV_MAIN.forEach(function (q) { if (!curId && !o.main.done[q.id] && evMainAvail(q)) curId = q.id; });
  EV_MAIN.forEach(function (q) { out.push({ id: q.id, t: q.t, done: !!o.main.done[q.id], cur: q.id === curId, skip: !evMainAvail(q), give: q.give, n: q.n || 1, have: q.k ? Math.min(q.n, evMainHave(q, o)) : 0, text: evGiveText(q.give) }); });
  return out;
}
function evMainCur() { var l = evMainList(), i; for (i = 0; i < l.length; i++) if (l[i].cur) return l[i]; return null; }
// 檢查並發獎(一次可連續完成多條);回新完成的 [{id, t, text}]
function evMainCheck(now) {
  var o, out = [], i, q, g = 0, r;
  if (!evOn()) return out;
  o = evRead(now);
  for (i = 0; i < EV_MAIN.length && g++ < 30; i++) {
    q = EV_MAIN[i];
    if (o.main.done[q.id] || !evMainAvail(q)) continue;
    if (!evMainMet(q, o)) break;   // 一次一條:卡在目前這條就停
    o.main.done[q.id] = 1;   // 先記完成再發獎:matGrant / cardsShardGain 內會再呼叫 ldOpenNote → evMainCheck(重入),不先記會同一條獎勵無限重發
    evWrite(o);
    r = evGive(q.give);
    o = evRead(now);
    if (!r.ok) { delete o.main.done[q.id]; evWrite(o); break; }
    out.push({ id: q.id, t: q.t, text: r.text });
  }
  return out;
}

// ───────── 事件計數與總掛點(核心 / 其他模組「存在才呼叫」)─────────
function evNote(k, n) {
  var o;
  if (!evOn()) return false;
  o = evRead();
  o.cnt[k] = Math.min(1e9, (o.cnt[k] | 0) + (n === undefined ? 1 : n));
  return evWrite(o);
}
// kind:'assault'{cat,lv,win,tut,rally,auto,W,t} 'garrison' 'collect' 'auto'{n} 'rsvAdd' 'gift' 'pull'{n} 'mat' 'rally' 'fame'。回新開放的木牌 / 功能 id 陣列
function ldOpenNote(kind, o) {
  var t, opened = [], c, ev;
  if (!evOn()) return opened;
  o = o || {};
  t = o.t || Date.now();
  try {
    if (kind === 'assault') {
      opened = opened.concat(unlockMark('firstBattle', t));
      if (o.win) {
        if (o.cat === 'res') { evNote('resWin'); if (!o.auto) { evNote('resWinMan'); if ((evRead().cnt.resWinMan | 0) >= 3) opened = opened.concat(unlockMark('res3', t)); } }
        else if (o.cat === 'camp') { evNote('mapWin'); evNote('campWin'); if (o.tut) { evNote('tut'); if (o.W && o.W.harv && !(evRead().cnt.tutGrain | 0)) { o.W.harv['糧'] = (o.W.harv['糧'] || 0) + EV_CFG.tutGrain; evNote('tutGrain'); } } }
        else if (o.cat === 'beast') { evNote('mapWin'); if (o.rally) evNote('beastKill'); }
        else if (o.cat === 'county') { evNote('mapWin'); evNote('countyWin'); }
      }
    } else if (kind === 'garrison') evNote('garrison');
    else if (kind === 'collect') { evNote('harv'); opened = opened.concat(unlockMark('harvest', t)); }
    else if (kind === 'auto') evNote('auto', o.n === undefined ? 1 : o.n);
    else if (kind === 'rsvAdd') evNote('rsvAdd');
    else if (kind === 'gift') evNote('gift');
    else if (kind === 'pull') { if ((o.n | 0) >= 10) evNote('ten'); }
    else if (kind === 'mat') opened = opened.concat(unlockMark('firstMat', t));
    else if (kind === 'rally') opened = opened.concat(unlockMark('firstRally', t));
    else if (kind === 'fame') opened = opened.concat(unlockSync(t));
    evMainCheck(t);
  } catch (e) { /* 掛點不可影響核心結算 */ }
  return opened;
}
