// js/wd_core.js — 地圖 / 採集 / 攻城 / 野怪集結 核心邏輯(設計線③;純函式、無 DOM,可在 node 跑;資料表見 wd_data.js)。
// 依賴(呼叫時才用):cards.js(cardsUseGet / Block / Set / Clear、cardsStarLv)、bn_units.js(bnUnitSpec、bnBuildTeam、bnPower、bnDefaultTroop)、
//   bn_stages.js(bnStgChapter、bnStgV、bnStgBuildTeam)、bn_engine.js(bnHash、bnRng、bnRun、BN_REC_VER)、wm_data.js(WM_DROP_MATS 占位材料)。
// 與補兵 / 名聲 / 鍛造材料模組的接口(存在才呼叫,見 wdGuardCap / wdHeal / wdHealAll / wdFameAdd / wdMatDrop):rsvHeal rsvHealSweep rsvOrder fameGuardCap fameFor fameAdd matForgeDrop matBonusDrop matCampDrop matSplit matGrant。本檔不實作它們。
// 狀態 W(存檔鍵 WD_SAVE_KEY = lorddomain.world.v2):
//   v:2, seed, now, sd(戰鬥序號)、rn(戰報序號)、pc(點序號)、tc(行程序號)、kc(集結序號)、nr(下次資源刷新)、nb(下次野怪刷新)、
//   pts[]  點 {id, cat:'res'|'beast'|'camp'|'county'|'jun'|'pass', ty, lv, mins, nf(守軍隊數), fs(守軍種子), act, owner:null|'me', guard:null|{card,t0,t1,ac,perH},
//             foeHp:[[3 個單位 hpR]…], foeT(城池傷勢回血基準時刻;0 = 不回血), cl(山寨已討平), rs(山寨補新時刻)},
//   trips[]  行程 {id, team, name, pt, t0, tArrive, tHome, st:'go'|'back', rally, slots:[{id,row,col,troop}], auto, mins}
//   rallies[] 集結(行進中) {id, pt, order:[隊號…], t0, tArrive}
//   chains[] 領地連戰(逐場推進;抵達後一場一場打,場間 WD_LANDFOE.gapMs;見 wdChainStart / wdChainStep / wdChainRetreat) {id, pt, rid(集結 id), t0, next(下一場時刻), q:[隊號…](第 1 個 = 目前上陣隊), k(已打場數), ties, tie:null|{k, until, a, a2, d}, rows[], dmgBy{}, lastTeam, anyWipe};cc = 連戰序號
//   hurt{卡id:到期ms}、trp{卡id:{r:兵力比例 0~1, t:基準時刻}}、harv{糧,生鐵,獸皮,木炭,礪石}(駐守產出,已結算未收成;舊存檔的 木 / 鐵 / 石 鍵讀入時丟棄)、rp[](戰報,新→舊,最多 rpMax)、rc[]({i:recIdx, rec},最多 rcMax)、nw(未讀回城 / 到期數)。
// 時間一律絕對 ms;wdAdvance(W, cs, now) 依時間順序處理事件;now < W.now(時鐘倒退)→ 凍結不動(仿 wmAdvance)。
// 卡片占用:出發 cardsUseSet(e,'field','wd:'+tripId)、駐守 cardsUseSet(e,'garrison','wd:'+ptId);回城 / 到期解除。
var WD_SAVE_KEY = 'lorddomain.world.v2';
var WD_FOE_CACHE = {}, WD_FOE_N = 0;

function wdInt(x, lo, hi, d) {
  x = typeof x === 'number' && isFinite(x) ? Math.floor(x) : d;
  return Math.max(lo, Math.min(hi, x));
}
function wdNum(x, lo, hi, d) {
  x = typeof x === 'number' && isFinite(x) ? x : d;
  return Math.max(lo, Math.min(hi, x));
}
function wdClone(x) { return JSON.parse(JSON.stringify(x)); }
function wdR4(x) { return Math.round(x * 10000) / 10000; }

// ───────── 時間:每天 12:00、20:00(東八區)刷新 ─────────
function wdBoundaries(t, from, to) {
  var L = t + WD_CFG.dayShiftMs, ds = Math.floor(L / WD_CFG.DAY) * WD_CFG.DAY, out = [], d, i;
  for (d = from; d <= to; d++) for (i = 0; i < WD_CFG.refreshHours.length; i++) out.push(ds + d * WD_CFG.DAY + WD_CFG.refreshHours[i] * WD_CFG.HOUR - WD_CFG.dayShiftMs);
  return out;
}
function wdLastRefresh(t) {   // ≤ t 的最近一次刷新時刻
  var b = wdBoundaries(t, -1, 0), best = -Infinity, i;
  for (i = 0; i < b.length; i++) if (b[i] <= t && b[i] > best) best = b[i];
  return best;
}
function wdNextRefresh(t) {   // > t 的下一次刷新時刻
  var b = wdBoundaries(t, 0, 1), best = Infinity, i;
  for (i = 0; i < b.length; i++) if (b[i] > t && b[i] < best) best = b[i];
  return best;
}

// ───────── 點的產生(種子化:同 seed 同結果)─────────
var WD_PFX = { res: 'r', beast: 'b', camp: 'c', county: 'k', jun: 'j', pass: 'g' };
function wdMinsOf(lv, r) {
  return Math.max(WD_CFG.minsMin, Math.min(WD_CFG.minsMax, Math.round(1.5 + lv * 0.9 + (r - 0.5) * 2)));
}
function wdNewFoeHp(nf) {
  var a = [], i;
  for (i = 0; i < nf; i++) a.push([1, 1, 1]);
  return a;
}
// o:{ty, lv, nf, act, idx(固定點名稱索引)}
function wdGenPt(W, cat, o) {
  var n = ++W.pc, rng = bnRng(bnHash('wdp', W.seed, cat, n)), r1 = rng(), r2 = rng(), r3 = rng(), lv, ty, nf, fl, names;
  o = o || {};
  if (cat === 'res') { lv = 1 + Math.floor(r1 * WD_CFG.resLvMax); ty = WD_RES_TYPES[Math.floor(r2 * WD_RES_TYPES.length)]; nf = 1; }
  else if (cat === 'beast') { lv = 1 + Math.floor(r1 * WD_CFG.beastLvMax); names = WD_NAMES.beast; ty = names[Math.floor(r2 * names.length)]; nf = WD_CFG.beastTeams[0] + Math.floor(r3 * (WD_CFG.beastTeams[1] - WD_CFG.beastTeams[0] + 1)); }
  else if (cat === 'camp') { lv = 1 + Math.floor(r1 * WD_CFG.campLvMax); names = WD_NAMES.camp; ty = names[Math.floor(r2 * names.length)]; nf = WD_CFG.campTeams[0] + Math.floor(r3 * (WD_CFG.campTeams[1] - WD_CFG.campTeams[0] + 1)); }
  else { fl = WD_CFG.fixedLv[cat]; lv = fl[0] + Math.floor(r1 * (fl[1] - fl[0] + 1)); ty = WD_NAMES[cat][(o.idx | 0) % WD_NAMES[cat].length]; nf = WD_CFG.fixedTeams[cat]; }
  if (o.lv) lv = o.lv;
  if (o.ty) ty = o.ty;
  if (cat === 'res' && !o.nf && typeof WD_LANDFOE !== 'undefined') nf = wdLandTeams(lv);   // 領地守軍隊數:Lv1~6 = 1、Lv7~9 = 2、Lv10 = 3
  if (o.nf) nf = o.nf;
  return {
    id: WD_PFX[cat] + n, cat: cat, ty: ty, lv: lv, mins: wdMinsOf(lv, rng()), nf: nf, fs: Math.floor(rng() * 1e9), act: !!o.act,
    owner: null, guard: null, foeHp: wdNewFoeHp(nf), foeT: 0, cl: false, rs: 0
  };
}
function wdNew(seed, now) {
  var W = { v: 2, seed: seed >>> 0, now: now, sd: 0, rn: 0, pc: 0, tc: 0, kc: 0, nr: wdNextRefresh(now), nb: now + WD_CFG.beastEvery, pts: [], trips: [], rallies: [], hurt: {}, trp: {}, harv: wdHarvZero(), rp: [], rc: [], nw: 0, rsv: [], rsvLog: [], hs: 0, chains: [], cc: 0 }, i;   // rsv / rsvLog / hs:預約、預約結果、寶地碎片(js/ld_open_wd.js)
  for (i = 0; i < WD_CFG.resCount; i++) W.pts.push(wdGenPt(W, 'res'));
  W.pts.push(wdGenPt(W, 'beast'));
  for (i = 0; i < WD_CFG.campCount; i++) W.pts.push(wdGenPt(W, 'camp'));
  for (i = 0; i < WD_CFG.countyN; i++) W.pts.push(wdGenPt(W, 'county', { idx: i }));
  for (i = 0; i < WD_CFG.junN; i++) W.pts.push(wdGenPt(W, 'jun', { idx: i }));
  for (i = 0; i < WD_CFG.passN; i++) W.pts.push(wdGenPt(W, 'pass', { idx: i }));
  return W;
}
// 活動野怪(以後活動用):act:true,不計入同時 6 隻上限,打不死血量保留。o:{ty, lv, nf}
function wdSpawnEventBeast(W, now, o) {
  var pt;
  o = o || {};
  pt = wdGenPt(W, 'beast', { ty: o.ty, lv: o.lv, nf: o.nf, act: true });
  pt.act = true;
  W.pts.push(pt);
  return pt;
}

// ───────── 查詢 ─────────
function wdPt(W, id) {
  var i;
  for (i = 0; i < W.pts.length; i++) if (W.pts[i].id === id) return W.pts[i];
  return null;
}
function wdPtsOf(W, cat) { return W.pts.filter(function (p) { return p.cat === cat; }); }
function wdTripsTo(W, ptId) { return W.trips.filter(function (t) { return t.pt === ptId && t.st === 'go'; }); }
function wdPtBusy(W, ptId) { return wdTripsTo(W, ptId).length > 0; }
function wdTeamTrip(W, n) {
  var i;
  for (i = 0; i < W.trips.length; i++) if (W.trips[i].team === n) return W.trips[i];
  return null;
}
function wdCard(cs, id) {
  var i;
  if (!cs || !cs.roster) return null;
  for (i = 0; i < cs.roster.length; i++) if (cs.roster[i].id === id) return cs.roster[i];
  return null;
}
function wdCleanSlots(list) {
  return (Array.isArray(list) ? list : []).filter(function (m) { return m && typeof m.id === 'string'; }).slice(0, 3).map(function (m) {
    return { id: m.id, row: wdInt(m.row, 0, 2, 0), col: wdInt(m.col, 0, 2, 0), troop: String(m.troop || '') };
  });
}
// 領地 = 駐守中資源點 + 縣 + 郡 + 關口
function wdTerritoryOf(W) {
  var o = { res: 0, county: 0, jun: 0, pass: 0, total: 0 };
  W.pts.forEach(function (p) {
    if (p.cat === 'res' && p.guard) o.res++;
    else if ((p.cat === 'county' || p.cat === 'jun' || p.cat === 'pass') && p.owner === 'me') o[p.cat]++;
  });
  o.total = o.res + o.county + o.jun + o.pass;
  return o;
}
function wdGuardCap(W) {
  var c;
  if (typeof fameGuardCap === 'function') { c = fameGuardCap(); if (typeof c === 'number' && isFinite(c)) return Math.max(1, Math.min(99, Math.floor(c))); }
  return WD_CFG.guardMax;
}
function wdGuardUsed(W) { return W.pts.filter(function (p) { return !!p.guard; }).length; }
function wdOwnedWaiting(W) { return W.pts.filter(function (p) { return p.cat === 'res' && p.owner === 'me' && !p.guard; }).length; }

// ───────── 兵力 / 重傷 ─────────
// 占位:在城每小時回 regenPerHour(補兵);之後換成校場預備兵補兵(rsvHeal 存在時由 wdHeal 處理,不再套用本函式)
function wdTroopRegen(o, now) {
  if (!o) return 1;
  return Math.min(1, Math.max(0, o.r) + WD_CFG.regenPerHour * Math.max(0, now - o.t) / WD_CFG.HOUR);
}
// 行軍中(field 且 ref 是 wd:):不補兵、不能出征;駐守中的卡兵源由校場送,照補
function wdIsField(e) {
  var u = (typeof cardsUseGet === 'function' && e) ? cardsUseGet(e) : null;
  return !!(u && u.k === 'field' && typeof u.ref === 'string' && u.ref.indexOf('wd:') === 0);
}
function wdIsOut(e) {
  var u = (typeof cardsUseGet === 'function' && e) ? cardsUseGet(e) : null;
  return !!(u && (u.k === 'field' || u.k === 'garrison') && typeof u.ref === 'string' && u.ref.indexOf('wd:') === 0);
}
// 目前兵力比例 0~1。外出(行軍 / 駐守)中不回復
function wdTroopR(W, cs, id, now) {
  var o = W.trp[id], e;
  if (!o) return 1;
  e = wdCard(cs, id);
  if (e && wdIsOut(e)) return o.r;
  if (typeof rsvHeal === 'function') return o.r;
  return wdTroopRegen(o, now);
}
function wdTrpSet(W, id, r, t) { W.trp[id] = { r: wdR4(Math.max(WD_CFG.trpMin, Math.min(1, r))), t: t }; }
function wdHurtLeft(W, id, now) { return Math.max(0, (W.hurt[id] || 0) - now); }
// 預備兵補兵(存在才呼叫):回城 / 解除後替未滿的卡補到滿
function wdHeal(W, cs, id, t) {
  var o = W.trp[id], e = wdCard(cs, id), got;
  if (typeof rsvHeal !== 'function' || !o || !e || wdIsField(e) || o.r >= 1) return;
  got = rsvHeal(cs, id, 1 - o.r, t);
  if (typeof got === 'number' && isFinite(got) && got > 0) wdTrpSet(W, id, Math.min(1, o.r + Math.min(got, 1 - o.r)), t);
}
// 在城(含駐守中,不含行軍中)沒滿兵的卡:[{id, r}]
function wdTroopList(W, cs) {
  var out = [];
  Object.keys(W.trp).forEach(function (id) {
    var o = W.trp[id], e = wdCard(cs, id);
    if (!o || !e || wdIsField(e) || o.r >= 1) return;
    out.push({ id: id, r: o.r });
  });
  return out;
}
// 補兵:自動(manual 假)走 rsvHealSweep(第 1 隊先、主將先、兵力低先);manual(校場「一鍵補兵」)逐卡 rsvHeal(..., true)。回補到的卡數
function wdHealAll(W, cs, now, manual) {
  var list = wdTroopList(W, cs), n = 0, ids, adds;
  if (manual) {
    if (typeof rsvHeal !== 'function') return 0;
    ids = (typeof rsvOrder === 'function') ? rsvOrder(cs, list.map(function (x) { return x.id; })) : list.map(function (x) { return x.id; });
    ids.forEach(function (id) {
      var o = W.trp[id], got = rsvHeal(cs, id, 1 - o.r, now, true);
      if (typeof got === 'number' && isFinite(got) && got > 0) { wdTrpSet(W, id, Math.min(1, o.r + got), now); n++; }
    });
    return n;
  }
  if (typeof rsvHealSweep !== 'function') return 0;
  adds = rsvHealSweep(cs, list, now) || [];
  adds.forEach(function (a) {
    var o = a && W.trp[a.id];
    if (o && typeof a.add === 'number' && a.add > 0) { wdTrpSet(W, a.id, Math.min(1, o.r + a.add), now); n++; }
  });
  return n;
}
// 打贏加名聲:數量查 fameFor(kind, lv)(數值只放 fame.js);回 {n, unlocked:[{label}]},沒有名聲模組 = n 0
function wdFameAdd(kind, lv) {
  var n = (typeof fameFor === 'function') ? fameFor(kind, lv) : 0, r;
  if (typeof fameAdd !== 'function' || !(n > 0)) return { n: 0, unlocked: [] };
  r = fameAdd(n, kind + ':' + lv);
  return { n: n, unlocked: (r && Array.isArray(r.unlocked)) ? r.unlocked : [] };
}

// ───────── 守軍(確定性:同 seed + 點 id 得同守軍)─────────
function wdFoeTeam(W, pt, j) {
  var key = W.seed + '|' + pt.id + '|' + pt.cat + '|' + pt.fs + '|' + pt.lv + '|' + j + '|L2', m, ch, pool, rng, ents = [], k, st, v, team, mul, sp, lfs, hit = WD_FOE_CACHE[key];   // 'L2' = 領地守軍 / 野怪新編制版本字(快取換版)
  if (hit) return hit;
  m = WD_CFG.lvMap[Math.max(1, Math.min(WD_CFG.lvMap.length - 1, pt.lv))];
  ch = bnStgChapter(m[0]);
  if (pt.cat === 'res' && typeof WD_LANDFOE !== 'undefined') hit = wdLandFoeTeam(W, pt, j);   // 資源領地:多隊 + 戰法成長 + 名將
  else {
    if (pt.cat === 'yg' && typeof wmapMobFoeSpec === 'function') sp = wmapMobFoeSpec(pt);   // 野怪四類(wmap_mob.js):固定編制 + 固定戰法
    if (sp) {
      st = { id: 'WD:' + pt.id + ':' + j, order: m[1], boss: false, idx: 0 };
      team = bnStgBuildTeam(sp.ents, sp.v, sp.ch, st, st.id, sp.lfs);
    } else {
      pool = ch.roster.filter(function (x) { return !(x && x.fig); });
      rng = bnRng(bnHash('wdf', W.seed, pt.id, pt.fs, j));
      for (k = 0; k < 3 && pool.length; k++) ents.push(pool[Math.floor(rng() * pool.length)]);
      st = { id: 'WD:' + pt.id + ':' + j, order: m[1], boss: !!WD_CFG.strong[pt.cat], idx: WD_CFG.strong[pt.cat] ? BN_STG.extraFrom : 0 };
      v = bnStgV(st) * (WD_CFG.foeMul[pt.cat] || 1) * (pt.tr && typeof EV_CFG !== 'undefined' ? EV_CFG.treasureFoeMul : 1) * (pt.tut && typeof EV_CFG !== 'undefined' ? EV_CFG.tutFoeMul : 1);   // 寶地守軍 × 1.2、新手寨 × 0.3(js/ld_open_data.js)
      team = bnStgBuildTeam(ents, v, ch, st, st.id);
    }
  }
  if (pt.cat === 'beast') {   // 野怪厚血:守軍單位 HP × 倍率
    mul = WD_CFG.beastHpMul[Math.max(1, Math.min(WD_CFG.beastHpMul.length - 1, pt.lv))] || 1;
    team.units.forEach(function (u) { u.stats.hp = Math.round(u.stats.hp * mul); });
  }
  if (WD_FOE_N > 400) { WD_FOE_CACHE = {}; WD_FOE_N = 0; }
  WD_FOE_CACHE[key] = hit || { units: team.units, power: team.power };
  WD_FOE_N++;
  return WD_FOE_CACHE[key];
}

// ───────── 領地守軍編制(資源領地;設計_領地守軍多隊與戰法成長_規格 1~2 節;資料表 WD_LANDFOE)─────────
function wdLandTeams(lv) { var T = WD_LANDFOE.teams; return T[Math.max(1, Math.min(T.length - 1, lv | 0))] || 1; }
function wdLandMul(lv) { var a = (typeof BN_SKLV !== 'undefined' && BN_SKLV && BN_SKLV.mul) ? BN_SKLV.mul : WD_LANDFOE.slMul; return (a && a[lv]) || 1; }
function wdLandV(lv, st) {   // 基準 v:vSrc 'grid' = GRID_CFG.foeV[lv-1](沒有 wd_grid_data.js 退回舊口徑 bnStgV)
  var g = typeof GRID_CFG !== 'undefined' && GRID_CFG && GRID_CFG.foeV;
  if (WD_LANDFOE.vSrc === 'grid' && g) return g[Math.max(1, Math.min(g.length, lv)) - 1];
  return bnStgV(st);
}
function wdLandSlot(lv, pos, j) {   // pos 0 主將 / 1 中衛 / 2 前鋒;回 {ult:'g'|'A'|'S', picks:['S'|'A'|'B'…]}
  var row = WD_LANDFOE.sk[lv] || WD_LANDFOE.sk[1], txt = pos === 2 ? row[0] : (pos === 1 ? row[1] : (j === 0 || !row[3] ? row[2] : row[3])), a = String(txt).split('/');
  return { ult: a[0] || 'g', picks: (a[1] || 'B').split('+') };
}
// 一塊領地全部守軍的編制(確定性;快取):{teams:[{ents, lfs}], famed:[fig…], gaps:[{j, pos, need}]}
function wdLandPlan(W, pt) {
  var key = W.seed + '|LP|' + pt.id + '|' + pt.fs + '|' + pt.lv + '|' + pt.nf, hit = WD_FOE_CACHE[key], lv, m, ch, base, usedEnt = {}, usedFig = {}, mainTr = [], plan, jj, pos, slot, rng, rg2, ent, fame, cand, i, arch, troop, key2, pick, kf, own, lf, ents, lfs, L = WD_LANDFOE, fk, troops;
  if (hit) return hit;
  lv = Math.max(1, Math.min(WD_CFG.lvMap.length - 1, pt.lv | 0));
  m = WD_CFG.lvMap[lv]; ch = bnStgChapter(m[0]);
  base = ch.roster.filter(function (x) { return !(x && x.fig); });
  plan = { teams: [], famed: [], gaps: [] };
  function archOf(e) { return BN_STG_ARCH[e[0]]; }
  function pickBase(pos2, jj2, rng3) {
    var filters = [], c, r;
    function ok(e, idx) { return !usedEnt[idx]; }
    if (pos2 === 2) filters.push(function (e) { var a = archOf(e); return a.troop === '盾' || a.troop === '槍'; });
    else if (pos2 === 1) filters.push(function (e) { var a = archOf(e); return a.troop === '槍' || a.troop === '騎' || a.troop === '弓'; });
    else {
      if (lv >= 7) filters.push(function (e) { return !!archOf(e).elite; });
      if (jj2 > 0) filters.push(function (e) { return mainTr.indexOf(archOf(e).troop) < 0; });
    }
    for (r = filters.length; r >= 0; r--) {   // 條件逐一放寬:全部條件 → 少一個條件 … → 任意
      c = [];
      base.forEach(function (e, idx) { if (ok(e, idx) && filters.slice(0, r).every(function (fn) { return fn(e); })) c.push(idx); });
      if (pos2 === 2 && r === 1) { var hp = c.filter(function (idx) { return archOf(base[idx]).hpK; }); if (hp.length) c = hp; }   // 前鋒:有 hpK 者優先
      if (c.length) return c[Math.floor(rng3() * c.length)];
    }
    usedEnt = {};   // 名冊用盡 → 重新開始(不重複只在名冊夠時成立)
    return Math.floor(rng3() * base.length);
  }
  for (jj = 0; jj < pt.nf; jj++) {
    ents = []; lfs = [];
    for (pos = 0; pos < 3; pos++) {
      slot = wdLandSlot(lv, pos, jj);
      rng = bnRng(bnHash('wdlf', W.seed, pt.id, pt.fs, jj, pos));
      ent = null; fame = null;
      if (slot.ult !== 'g') {
        troops = pos === 0 ? null : (pos === 1 ? ['槍', '騎', '弓'] : ['盾', '槍']);
        if (pos === 0 && jj > 0) { troops = ['槍', '騎', '盾', '弓'].filter(function (x) { return mainTr.indexOf(x) < 0; }); if (!troops.length) troops = null; }   // 多隊時主將兵種互不相同(名將主將也一樣;找不到才允許重複)
        fame = bnStgLandFame(troops, slot.ult, usedFig, rng, { soft: L.softUlt, softW: L.softW, noStrat: pos === 2 });
        if (!fame && pos === 0 && jj > 0 && troops) fame = bnStgLandFame(null, slot.ult, usedFig, rng, { soft: L.softUlt, softW: L.softW });
        if (fame) { usedFig[fame.fig] = 1; plan.famed.push(fame.fig); ent = { fig: fame.fig, title: L.fameTitle }; }
        else plan.gaps.push({ j: jj, pos: pos, need: slot.ult });   // 名將不足 → 退回無名 NPC + 通用大招
      }
      rg2 = bnRng(bnHash('wdls', W.seed, pt.id, pt.fs, jj, pos));
      if (ent) {
        fk = BN_FIG_SKILLS[ent.fig]; kf = BN_KIT_BY && BN_KIT_BY.figs && BN_KIT_BY.figs[ent.fig];
        troop = fk.troop; key2 = fk.dt === 'strat' ? '謀' : troop;
        own = kf && kf.pool ? kf.pool.filter(function (id) { return BN_SKILLS[id] && BN_SKILLS[id].cat !== 'passive' && BN_SKILLS[id].cat !== 'ult' && id !== kf.fixed; }) : [];
        pick = bnStgLandSkills(key2, null, ch, slot.picks, rg2, own);
        lf = { skills: pick, ult: fk.ult, mul: wdLandMul(lv), lv: lv };
      } else {
        i = pickBase(pos, jj, rng); usedEnt[i] = 1; ent = base[i];
        arch = archOf(ent); troop = arch.troop; key2 = arch.dt === 'strat' ? '謀' : troop;
        pick = bnStgLandSkills(key2, arch, ch, slot.picks, rg2, null);
        lf = { skills: pick, ult: arch.ult, mul: wdLandMul(lv), lv: lv };
        if (pos === 0) mainTr.push(troop);
      }
      if (pos === 0 && ent.fig) mainTr.push(troop);
      ents.push(ent); lfs.push(lf);
    }
    plan.teams.push({ ents: ents, lfs: lfs });
  }
  WD_FOE_CACHE[key] = plan;
  return plan;
}
function wdLandFoeTeam(W, pt, j) {
  var plan = wdLandPlan(W, pt), t = plan.teams[Math.min(j, plan.teams.length - 1)], lv = Math.max(1, Math.min(WD_CFG.lvMap.length - 1, pt.lv | 0)), m = WD_CFG.lvMap[lv], ch = bnStgChapter(m[0]), st, v, team;
  st = { id: 'WD:' + pt.id + ':' + j, order: m[1], boss: false, idx: 0 };
  v = wdLandV(lv, st) * (WD_CFG.foeMul[pt.cat] || 1) * (WD_LANDFOE.teamVK[j] || 1) * (pt.tr && typeof EV_CFG !== 'undefined' ? EV_CFG.treasureFoeMul : 1) * (pt.tut && typeof EV_CFG !== 'undefined' ? EV_CFG.tutFoeMul : 1);
  team = bnStgBuildTeam(t.ents, v, ch, st, st.id, t.lfs);
  return { units: team.units, power: team.power, famed: plan.famed.slice(), gaps: plan.gaps.slice() };
}
function wdFoeMax(foe) { return foe.units.map(function (u) { return Math.round(u.stats.hp); }); }
function wdFoeTotalMax(W, pt) {
  var s = 0, j;
  for (j = 0; j < pt.nf; j++) wdFoeMax(wdFoeTeam(W, pt, j)).forEach(function (x) { s += x; });
  return s;
}
// 目前(隨時間回血後)的守軍血量:城池 / 關口從 foeT 起 24 小時內線性回滿;野怪 / 山寨 / 資源點不回血(失敗時已另行回滿)
function wdFoeCur(pt, t) {
  var f = 1, rows;
  if (pt.hk && t >= pt.hk) return wdNewFoeHp(pt.nf);   // 領地多隊失敗後的傷勢保留(hk 到期時刻)到期:回滿
  if (!pt.foeT) return pt.foeHp.map(function (r) { return r.slice(); });
  f = Math.max(0, Math.min(1, (t - pt.foeT) / WD_CFG.foeRegenMs));
  rows = pt.foeHp.map(function (r) { return r.map(function (x) { return wdR4(x + (1 - x) * f); }); });
  return rows;
}
// 守軍剩餘血量比例 0~1(整體)
function wdFoeRatio(W, pt, t) {
  var cur = wdFoeCur(pt, t), s = 0, tot = 0, j, mx;
  for (j = 0; j < pt.nf; j++) {
    mx = wdFoeMax(wdFoeTeam(W, pt, j));
    mx.forEach(function (x, k) { s += x * (cur[j][k] || 0); tot += x; });
  }
  return tot ? s / tot : 0;
}
function wdFoeAlive(row) { return !!row && row.some(function (x) { return x > 0; }); }

// ───────── 我方隊伍 ─────────
function wdBuildMine(W, cs, slots, t) {
  var specs = [], ids = [], team, power = 0;
  slots.forEach(function (s) {
    var e = wdCard(cs, s.id), sp;
    if (!e) return;
    sp = bnUnitSpec(e, { troop: s.troop, row: s.row, col: s.col });
    sp.hpR = wdTroopR(W, cs, e.id, t);
    sp.wdId = e.id;
    specs.push(sp); ids.push(e.id);
  });
  team = bnBuildTeam(specs);
  team.units.forEach(function (u) { power += bnPower(u); });
  return { units: team.units, ids: ids, power: power };
}
function wdTeamPower(cs, slots) {
  var specs = [], p = 0, team;
  (slots || []).forEach(function (s) {
    var e = wdCard(cs, s.id);
    if (e) specs.push(bnUnitSpec(e, { troop: s.troop, row: s.row, col: s.col }));
  });
  if (!specs.length) return 0;
  team = bnBuildTeam(specs);
  team.units.forEach(function (u) { p += bnPower(u); });
  return p;
}
// 預設隊伍(bnteam.js):[{n, name, slots}],沒有 bnteam 時回空
function wdTeams() {
  var out = [], n = (typeof bnTeamN === 'function' ? bnTeamN() : (typeof BNTEAM !== 'undefined' && BNTEAM && BNTEAM.n)) || 3, i, p;
  if (typeof bnTeamPresetGet !== 'function') return out;
  for (i = 1; i <= n; i++) {
    p = bnTeamPresetGet(i);
    if (p && !p.empty && p.slots && p.slots.length) out.push({ n: i, name: p.name, slots: wdCleanSlots(p.slots) });
  }
  return out;
}
// 隊伍平均兵力比例 0~1(沒有紀錄 = 滿兵);戰力 × 比例 = 實際可打的戰力(自動派遣、勝算顯示用)
function wdTeamRatio(W, cs, slots, now) {
  var s = 0, n = 0;
  (slots || []).forEach(function (x) { if (wdCard(cs, x.id)) { s += wdTroopR(W, cs, x.id, now); n++; } });
  return n ? s / n : 1;
}
function wdTeamPowerR(W, cs, slots, now) { return wdTeamPower(cs, slots) * wdTeamRatio(W, cs, slots, now); }
function wdTeamIds(teams) {
  var m = {};
  (teams || wdTeams()).forEach(function (t) { t.slots.forEach(function (s) { m[s.id] = true; }); });
  return m;
}
// 檢查一隊能否出發:回 {ok, reason}。reason:size dup missing samefig hurt lowtrp(兵力低於 minGoR)field appoint garrison
function wdCheckSlots(W, cs, slots, now, used) {
  var ids = {}, figs = {}, k, s, e, b;
  if (!slots || !slots.length || slots.length > 3) return { ok: false, reason: 'size' };
  for (k = 0; k < slots.length; k++) {
    s = slots[k];
    if (ids[s.id] || (used && used[s.id])) return { ok: false, reason: 'dup' };
    ids[s.id] = true;
    e = wdCard(cs, s.id);
    if (!e) return { ok: false, reason: 'missing' };
    if (e.fig) { if (figs[e.fig]) return { ok: false, reason: 'samefig' }; figs[e.fig] = true; }
    if (wdHurtLeft(W, e.id, now) > 0) return { ok: false, reason: 'hurt' };
    if (W.trp[e.id] && wdTroopR(W, cs, e.id, now) < WD_CFG.minGoR) return { ok: false, reason: 'lowtrp' };
    if (typeof cardsUseBlock === 'function') { b = cardsUseBlock(e, 'field'); if (!b.ok) return { ok: false, reason: b.k }; }
  }
  return { ok: true, reason: '' };
}

// ───────── 出發 ─────────
function wdTripStart(W, cs, team, pt, rid, now, auto) {
  var trip = { id: 't' + (++W.tc), team: team.n, name: String(team.name || ''), pt: pt.id, t0: now, tArrive: now + pt.mins * WD_CFG.MIN, tHome: 0, st: 'go', rally: rid || null, slots: wdCleanSlots(team.slots), auto: !!auto, mins: pt.mins };
  trip.slots.forEach(function (s) {
    var e = wdCard(cs, s.id);
    wdTrpSet(W, s.id, wdTroopR(W, cs, s.id, now), now);
    if (e && typeof cardsUseSet === 'function') cardsUseSet(e, 'field', 'wd:' + trip.id);
  });
  W.trips.push(trip);
  return trip;
}
function wdTeamRef(team) { return { n: team.n | 0, name: team.name, slots: team.slots }; }
// 單隊出征:資源點 / 山寨。team = {n, name, slots:[{id,row,col,troop}]}。opts:{auto}。回 {ok, reason, trip, events}
function wdDispatch(W, cs, team, ptId, now, opts) {
  var r = wdRun(W, cs, now), pt, chk;
  opts = opts || {};
  if (r.frozen) return { ok: false, reason: 'frozen', events: r.events };
  pt = wdPt(W, ptId);
  if (!pt) return { ok: false, reason: 'nopt', events: r.events };
  if (pt.cat !== 'res' && pt.cat !== 'camp') return { ok: false, reason: 'cat', events: r.events };
  if (pt.owner) return { ok: false, reason: 'owned', events: r.events };
  if (pt.cl) return { ok: false, reason: 'cleared', events: r.events };
  if (wdPtBusy(W, pt.id)) return { ok: false, reason: 'busy', events: r.events };
  if (!team || wdTeamTrip(W, team.n)) return { ok: false, reason: 'army', events: r.events };
  chk = wdCheckSlots(W, cs, team.slots, now);
  if (!chk.ok) return { ok: false, reason: chk.reason, events: r.events };
  return { ok: true, reason: '', trip: wdTripStart(W, cs, team, pt, null, now, opts.auto), events: r.events };
}
// 集結 / 攻城:野怪、縣、郡、關口。teams = 依出場順序排列的隊伍陣列(最多 rallyMax)。回 {ok, reason, rally, events}
function wdRally(W, cs, teams, ptId, now) {
  var r = wdRun(W, cs, now), pt, used = {}, k, chk, rid, rl;
  if (r.frozen) return { ok: false, reason: 'frozen', events: r.events };
  pt = wdPt(W, ptId);
  if (!pt) return { ok: false, reason: 'nopt', events: r.events };
  if (pt.cat === 'camp' || (pt.cat === 'res' && typeof WD_LANDFOE === 'undefined')) return { ok: false, reason: 'cat', events: r.events };   // 資源領地可集結(連戰,WD_LANDFOE.rallyMax 隊)
  if (pt.owner) return { ok: false, reason: 'owned', events: r.events };
  if (wdPtBusy(W, pt.id)) return { ok: false, reason: 'busy', events: r.events };
  if (!teams || !teams.length) return { ok: false, reason: 'size', events: r.events };
  if (teams.length > (pt.cat === 'res' ? WD_LANDFOE.rallyMax : WD_CFG.rallyMax)) return { ok: false, reason: 'rallymax', events: r.events };
  for (k = 0; k < teams.length; k++) {
    if (wdTeamTrip(W, teams[k].n) || teams.some(function (x, i) { return i !== k && x.n === teams[k].n; })) return { ok: false, reason: 'army', events: r.events };
    chk = wdCheckSlots(W, cs, teams[k].slots, now, used);
    if (!chk.ok) return { ok: false, reason: chk.reason, events: r.events };
    teams[k].slots.forEach(function (s) { used[s.id] = true; });
  }
  rid = 'k' + (++W.kc);
  rl = { id: rid, pt: pt.id, order: teams.map(function (t) { return t.n; }), t0: now, tArrive: now + pt.mins * WD_CFG.MIN };
  W.rallies.push(rl);
  teams.forEach(function (t) { wdTripStart(W, cs, t, pt, rid, now, false); });
  return { ok: true, reason: '', rally: rl, events: r.events };
}

// ───────── 戰鬥 ─────────
// 一場:我方 mine(wdBuildMine)對守軍第 j 隊(目前血量 row)。回 {win, wiped, rounds, newRow, dmgAbs, rec, S}
function wdRunFight(mine, foe, row, seed) {
  var fu = [], map = [], k, u, rec, S, newRow = row.slice(), mx = wdFoeMax(foe), dmg = 0, wiped;
  for (k = 0; k < foe.units.length; k++) {
    if (!(row[k] > 0)) continue;
    u = wdClone(foe.units[k]);
    if (row[k] < 1) u.hpR = row[k]; else delete u.hpR;
    fu.push(u); map.push(k);
  }
  rec = { v: BN_REC_VER, seed: seed, teamA: wdClone(mine.units), teamB: fu, opts: { events: false } };
  S = bnRun(wdClone(rec));
  S.units.forEach(function (x) {
    var kk;
    if (x.side !== 'B') return;
    kk = map[x.idx];
    newRow[kk] = x.alive ? Math.max(0.001, Math.min(1, wdR4(x.hp / mx[kk]))) : 0;   // 以守軍原始上限(stats.hp)為分母,戰鬥開場加成不影響累計傷害
  });
  for (k = 0; k < newRow.length; k++) dmg += (row[k] - newRow[k]) * mx[k];   // 淨傷害(守軍的治療已抵銷),各場加總才會等於總血量減剩餘
  dmg = Math.max(0, dmg);
  wiped = S.result.deadA >= mine.units.length && S.result.winner !== 'A';
  return { win: S.result.winner === 'A', draw: S.result.winner === 'draw', wiped: wiped, rounds: S.result.rounds, newRow: newRow, dmgAbs: dmg, rec: rec };
}
function wdRecAdd(W, rec) {
  W.sd++;
  W.rc.unshift({ i: W.sd, rec: rec });
  if (W.rc.length > WD_CFG.rcMax) W.rc.length = WD_CFG.rcMax;
  return W.sd;
}
function wdRecOf(W, idx) {
  var i;
  for (i = 0; i < W.rc.length; i++) if (W.rc[i].i === idx) return W.rc[i].rec;
  return null;
}
// 損兵:輸方 40~60%、贏方 10~30%(種子化),乘到每張卡目前兵力。回損失比例
function wdCasualty(W, cs, ids, win, rng, t) {
  var rg = win ? WD_CFG.lossWin : WD_CFG.lossLose, loss = rg[0] + rng() * (rg[1] - rg[0]);
  ids.forEach(function (id) { wdTrpSet(W, id, wdTroopR(W, cs, id, t) * (1 - loss), t); });
  return wdR4(loss);
}
// 依比例分配整數(最大餘數法),總和恆等於 total
function wdSplitInt(total, shares) {
  var sum = 0, out = [], rem = [], used = 0, i, left;
  shares.forEach(function (s) { sum += s; });
  if (!shares.length) return out;
  if (sum <= 0) { shares = shares.map(function () { return 1; }); sum = shares.length; }
  shares.forEach(function (s, k) { var x = total * s / sum, f = Math.floor(x + 1e-9); out.push(f); rem.push({ k: k, r: x - f }); used += f; });
  rem.sort(function (a, b) { return b.r - a.r || a.k - b.k; });
  left = total - used;
  for (i = 0; i < left; i++) out[rem[i % rem.length].k]++;
  return out;
}
function wdMatDrop(rng, lv) {
  var m, out = {}, k, id, dice;
  if (typeof matForgeDrop === 'function') {
    m = matForgeDrop(rng, lv);
    if (m && typeof m === 'object') { Object.keys(m).forEach(function (id2) { var n = Math.floor(Number(m[id2]) || 0); if (n > 0) out[id2] = n; }); return { mats: out, forge: true }; }
  }
  dice = WD_CFG.beastLootDice[Math.max(1, Math.min(WD_CFG.beastLootDice.length - 1, lv))] || 3;
  for (k = 0; k < dice; k++) { id = WM_DROP_MATS[Math.floor(rng() * WM_DROP_MATS.length)]; out[id] = (out[id] || 0) + 1; }
  return { mats: out, forge: false };
}
function wdMergeMats(a, b) {
  var o = {};
  Object.keys(a || {}).forEach(function (k) { o[k] = (o[k] || 0) + a[k]; });
  Object.keys(b || {}).forEach(function (k) { o[k] = (o[k] || 0) + b[k]; });
  return o;
}
// 野怪獎勵:材料池按傷害比例分配;最後一刀的隊額外一份隨機。rows = [{team, dmg}],lastTeam = 打最後一刀的隊號。回 {mats, coin, alloc:[{team, pct, mats}], extra:{team, mats}, forge}
function wdBeastLoot(W, pt, rows, lastTeam, t) {
  var rng = bnRng(bnHash('wdl', W.seed, pt.id, W.sd)), base = wdMatDrop(rng, pt.lv), ex, exMats = {}, pick, sh, pcts, alloc = [], total, ks = Object.keys(base.mats), per = [], bonus;
  if (base.forge && typeof matBonusDrop === 'function') {   // 材料模組:最後一刀額外 1 個取該等級最高品質欄
    bonus = matBonusDrop(rng, pt.lv);
    Object.keys(bonus || {}).forEach(function (id) { var n = Math.floor(Number(bonus[id]) || 0); if (n > 0) exMats[id] = n; });
  } else {
    ex = wdMatDrop(rng, pt.lv);
    pick = Object.keys(ex.mats);
    if (pick.length) { exMats[pick[Math.floor(rng() * pick.length)]] = 1; }
  }
  sh = rows.map(function (r) { return r.dmg; });
  pcts = wdSplitInt(100, sh);
  if (base.forge && typeof matSplit === 'function') per = matSplit(base.mats, sh);   // 材料模組:每種用最大餘數法分整數,總和不變
  while (per.length < rows.length) per.push({});
  if (!(base.forge && typeof matSplit === 'function')) ks.forEach(function (id) {
    var parts = wdSplitInt(base.mats[id], sh);
    parts.forEach(function (n, i) { if (n > 0) per[i][id] = n; });
  });
  rows.forEach(function (r, i) { alloc.push({ team: r.team, pct: pcts[i], mats: per[i] }); });
  total = wdMergeMats(base.mats, exMats);
  return { mats: total, coin: 0, alloc: alloc, extra: { team: lastTeam, mats: exMats }, forge: base.forge || ex.forge };
}
function wdCampLoot(W, pt) {
  var rng = bnRng(bnHash('wdl', W.seed, pt.id, W.sd)), mats = {}, k, id, m;
  if (typeof matCampDrop === 'function') {   // 材料模組:山寨只出白、藍
    m = matCampDrop(rng, pt.lv);
    Object.keys(m || {}).forEach(function (id2) { var n = Math.floor(Number(m[id2]) || 0); if (n > 0) mats[id2] = n; });
    return { mats: mats, coin: WD_CFG.campGold * pt.lv, forge: true };
  }
  for (k = 0; k < WD_CFG.campDice; k++) { id = WM_DROP_MATS[Math.floor(rng() * WM_DROP_MATS.length)]; mats[id] = (mats[id] || 0) + 1; }
  return { mats: mats, coin: WD_CFG.campGold * pt.lv, forge: false };
}

// 結算一次攻擊。trips = 依出場順序的行程;mode:'seq'(單隊,依序打守軍各隊直到輸)/'rally'(每隊只打一場)。回報告
function wdAssault(W, cs, pt, trips, mode, t, events) {
  var rows = [], total = wdFoeTotalMax(W, pt), foes = [], j, lastTeam = 0, dmgBy = {}, anyWipe = false, rp, win, loot = null, fm = null, kind = trips.length > 1 || mode === 'rally' ? 'rally' : 'one';
  for (j = 0; j < pt.nf; j++) foes.push(wdFoeTeam(W, pt, j));
  pt.foeHp = wdFoeCur(pt, t);
  trips.forEach(function (trip) {
    var ids = trip.slots.map(function (s) { return s.id; }), nfight = 0, fj, mine, res, rng, loss, idx, row, dead;
    while (nfight < 8) {
      fj = -1;
      for (j = 0; j < pt.nf; j++) if (wdFoeAlive(pt.foeHp[j])) { fj = j; break; }
      if (fj < 0) break;
      nfight++;
      mine = wdBuildMine(W, cs, trip.slots, t);
      if (!mine.ids.length) break;
      res = wdRunFight(mine, foes[fj], pt.foeHp[fj], bnHash('wdb', W.seed, pt.id, W.sd + 1));
      idx = wdRecAdd(W, res.rec);
      pt.foeHp[fj] = res.newRow;
      rng = bnRng(bnHash('wdc', W.seed, pt.id, idx));
      loss = wdCasualty(W, cs, ids, res.win, rng, t);
      dead = !wdFoeAlive(res.newRow);
      row = { team: trip.team, name: trip.name, foe: fj, dmg: total ? res.dmgAbs / total : 0, rounds: res.rounds, wiped: res.wiped, win: res.win, loss: loss, last: false, recIdx: idx, killed: dead };
      rows.push(row);
      dmgBy[trip.team] = (dmgBy[trip.team] || 0) + row.dmg;
      if (!pt.foeHp.some(wdFoeAlive)) lastTeam = trip.team;
      if (res.wiped) { trip.wiped = true; anyWipe = true; break; }
      if (mode !== 'seq' || !res.win || !dead) break;
    }
    if (!nfight) rows.push({ team: trip.team, name: trip.name, foe: -1, dmg: 0, rounds: 0, wiped: false, win: false, loss: 0, last: false, recIdx: 0, killed: false, skipped: true });
  });
  win = !pt.foeHp.some(wdFoeAlive);
  return wdAssaultEnd(W, pt, trips, rows, { kind: kind, win: win, lastTeam: lastTeam, dmgBy: dmgBy, anyWipe: anyWipe }, t, events);
}
// 收尾(單次結算與連戰共用):o = {kind, win, lastTeam, dmgBy, anyWipe, retreat};依種類處理點的狀態 / 獎勵,寫戰報與事件
function wdAssaultEnd(W, pt, trips, rows, o, t, events) {
  var win = o.win, kind = o.kind, lastTeam = o.lastTeam, dmgBy = o.dmgBy, anyWipe = o.anyWipe, loot = null, fm = null, rp, j, down;
  rows.forEach(function (r) { r.dmg = wdR4(r.dmg); });
  if (win && lastTeam) rows.forEach(function (r) { r.last = false; });
  if (win && lastTeam) {
    for (j = rows.length - 1; j >= 0; j--) if (rows[j].team === lastTeam && rows[j].killed) { rows[j].last = true; break; }
  }
  down = pt.foeHp.filter(function (r) { return !wdFoeAlive(r); }).length;   // 擊潰的守軍隊數(失敗時戰報顯示「守軍 x/N 隊擊潰」)
  // 收尾:依種類處理點的狀態 / 獎勵
  if (win) {
    if (pt.cat === 'res') { pt.owner = 'me'; pt.foeHp = wdNewFoeHp(pt.nf); pt.hk = 0; }
    else if (pt.cat === 'camp') { pt.cl = true; pt.rs = t + WD_CFG.campRespawn; pt.foeHp = wdNewFoeHp(pt.nf); loot = wdCampLoot(W, pt); }
    else if (pt.cat === 'beast') {
      loot = wdBeastLoot(W, pt, Object.keys(dmgBy).map(function (k) { return { team: +k, dmg: dmgBy[k] }; }).sort(function (a, b) { return trips.findIndex(function (x) { return x.team === a.team; }) - trips.findIndex(function (x) { return x.team === b.team; }); }), lastTeam, t);
      W.pts = W.pts.filter(function (p) { return p !== pt; });
    } else { pt.owner = 'me'; pt.foeHp = wdNewFoeHp(pt.nf); pt.foeT = 0; }
    fm = wdFameAdd(pt.cat, pt.lv);   // 打贏加名聲:資源點 / 山寨 / 野怪 / 縣 / 郡 / 關口(數量查 fameFor)
  } else if (pt.cat === 'county' || pt.cat === 'jun' || pt.cat === 'pass') pt.foeT = t;   // 傷勢保留,24 小時內線性回滿
  else if (pt.cat === 'beast' && pt.act) pt.foeT = 0;                                        // 活動野怪:血量保留、不回血
  else if (pt.cat === 'res' && pt.nf > 1) pt.hk = t + WD_LANDFOE.holdMs;                     // 領地多隊失敗:守軍傷勢保留 holdMs(30 分),到期回滿(wdFoeCur);Lv1~6 單隊照舊失敗回滿
  else pt.foeHp = wdNewFoeHp(pt.nf);                                                          // 一般野怪 / 山寨 / 資源點:失敗回滿
  rp = { id: 'p' + (++W.rn), t: t, kind: kind, pt: pt.id, ptName: pt.ty, cat: pt.cat, lv: pt.lv, win: win, rows: rows, loot: loot, wipe: anyWipe, fame: fm ? fm.n : 0, nf: pt.nf, down: win ? pt.nf : down };
  if (o.retreat) rp.retreat = true;
  if (!win && pt.hk > t) rp.hold = pt.hk;
  W.rp.unshift(rp);
  if (W.rp.length > WD_CFG.rpMax) W.rp.length = WD_CFG.rpMax;
  if (typeof ldOpenNote === 'function') ldOpenNote('assault', { cat: pt.cat, lv: pt.lv, win: win, tut: !!pt.tut, rally: kind === 'rally', auto: !!(trips[0] && trips[0].auto), W: W, t: t });   // 開場解鎖 / 主線計數(ldui)
  events.push({ t: t, k: 'report', pt: pt.id, ptName: pt.ty, cat: pt.cat, win: win, rp: rp.id, loot: loot, kind: kind, wipe: anyWipe, fame: rp.fame, unlocked: fm ? fm.unlocked.map(function (u) { return u.label; }) : [] });
  return rp;
}

// ───────── 事件處理 ─────────
function wdBackMs(trip) {   // 回程 = 去程 × 1/4;帶航段 lg 的行程(wmap_go.js)= 預先算好的回程段 b.M + 抵達交戰停頓 fm(與 wmMarchEnd 同刻)
  var lg = trip.lg;
  if (lg && lg.k === 'mv' && lg.b && lg.b.M >= 0) return lg.b.M + (lg.fm !== undefined ? lg.fm : (typeof WMARCH_CFG !== 'undefined' ? WMARCH_CFG.FIGHT : 3000));
  return Math.round((trip.tArrive - trip.t0) / WD_CFG.retDiv);
}
function wdTripHome(W, cs, trip, t, events, wiped) {
  trip.slots.forEach(function (s) {
    var e = wdCard(cs, s.id), o = W.trp[s.id];
    if (e && typeof cardsUseClear === 'function') cardsUseClear(e, 'field');
    wdTrpSet(W, s.id, o ? o.r : 1, t);
    wdHeal(W, cs, s.id, t);
  });
  W.trips = W.trips.filter(function (x) { return x !== trip; });
  W.nw++;
  events.push({ t: t, k: 'home', team: trip.team, wiped: !!wiped });
}
function wdTripTurn(W, cs, trip, t, events) {   // 打完:隊伍開始回程;全滅 → 瞬間回城並重傷
  var wiped = !!trip.wiped;
  if (wiped) {
    trip.slots.forEach(function (s) { W.hurt[s.id] = t + Math.round(WD_CFG.hurtMs * wdHmMul('hurt')); });
    wdTripHome(W, cs, trip, t, events, true);
  } else { trip.st = 'back'; trip.tHome = t + wdBackMs(trip); }
}
// 首頁經營乘數(hm_core.js 的 hmMul;未載入 / 非有限正數 → 1,行為與未接掛鉤完全相同)
function wdHmMul(k) {
  var m = 1;
  if (typeof hmMul === 'function') { try { m = Number(hmMul(k)); } catch (e) { m = 1; } }
  return isFinite(m) && m > 0 ? m : 1;
}
// 兵種契合 / 星階 → 每小時產出
function wdStarOf(e) { return typeof cardsStarLv === 'function' ? cardsStarLv(e) : ((e && e.starLv) | 0); }
function wdTroopOfCard(e) { return (typeof bnDefaultTroop === 'function' && e) ? bnDefaultTroop(e) : ''; }
function wdYieldPerHour(pt, e) {
  var fit = WD_CFG.fit[wdTroopOfCard(e)] === pt.ty;
  return (WD_CFG.yield[pt.ty] || 0) * pt.lv * (1 + WD_CFG.starBonus * wdStarOf(e)) * (fit ? WD_CFG.fitMul : 1);
}
function wdGuardSettle(W, pt, t) {
  var g = pt.guard, dt, key;
  if (!g) return;
  if (pt.tr && typeof wdTreasureShards === 'function') W.hs = (W.hs || 0) + wdTreasureShards(g, t);   // 寶地:每駐守滿 6 小時碎片 3
  dt = Math.min(t, g.t1) - g.ac;
  if (dt <= 0) return;
  key = WD_RES_KEY[pt.ty];
  if (key) W.harv[key] = (W.harv[key] || 0) + g.perH * dt / WD_CFG.HOUR;
  g.ac += dt;
}
// 閒置卡:不在任何預設隊伍、非重傷、非占用;契合優先,其次星階高,其次戰力高
function wdPickGuard(W, cs, pt, now, teams) {
  var inTeam = wdTeamIds(teams), best = null, bk = null;
  (cs && cs.roster || []).forEach(function (e) {
    var fit, k;
    if (inTeam[e.id] || wdHurtLeft(W, e.id, now) > 0) return;
    if (typeof cardsUseFree === 'function' && !cardsUseFree(e)) return;
    if (typeof cardsUseBlock === 'function' && !cardsUseBlock(e, 'garrison').ok) return;
    fit = WD_CFG.fit[wdTroopOfCard(e)] === pt.ty ? 1 : 0;
    k = [fit, wdStarOf(e), wdTeamPower(cs, [{ id: e.id, row: 0, col: 0, troop: '' }])];
    if (!best || k[0] > bk[0] || (k[0] === bk[0] && (k[1] > bk[1] || (k[1] === bk[1] && k[2] > bk[2])))) { best = e; bk = k; }
  });
  return best;
}
// 派 1 張卡駐守(24 小時)。回 {ok, reason, guard}。reason:nopt cat notowned guarded cap missing hurt field appoint garrison
function wdGarrison(W, cs, ptId, cardId, now) {
  var r = wdRun(W, cs, now), pt = wdPt(W, ptId), e, b;
  if (r.frozen) return { ok: false, reason: 'frozen' };
  if (!pt) return { ok: false, reason: 'nopt' };
  if (pt.cat !== 'res') return { ok: false, reason: 'cat' };
  if (pt.owner !== 'me') return { ok: false, reason: 'notowned' };
  if (pt.guard) return { ok: false, reason: 'guarded' };
  return wdGarrisonDo(W, cs, pt, cardId, now);
}
function wdGarrisonDo(W, cs, pt, cardId, now) {
  var e = wdCard(cs, cardId), b;
  if (wdGuardUsed(W) >= wdGuardCap(W)) return { ok: false, reason: 'cap' };
  if (!e) return { ok: false, reason: 'missing' };
  if (wdHurtLeft(W, cardId, now) > 0) return { ok: false, reason: 'hurt' };
  if (typeof cardsUseBlock === 'function') { b = cardsUseBlock(e, 'garrison'); if (!b.ok) return { ok: false, reason: b.k }; }
  pt.guard = { card: cardId, t0: now, t1: now + WD_CFG.guardMs, ac: now, perH: wdYieldPerHour(pt, e) * wdHmMul('guardYield') * (pt.tr && typeof EV_CFG !== 'undefined' ? EV_CFG.treasureYieldMul : 1), hb: 0 };   // 寶地產量 × 2(駐守當下算進 perH)
  if (typeof ldOpenNote === 'function') ldOpenNote('garrison', { t: now });
  wdTrpSet(W, cardId, wdTroopR(W, cs, cardId, now), now);
  if (typeof cardsUseSet === 'function') cardsUseSet(e, 'garrison', 'wd:' + pt.id);
  return { ok: true, reason: '', guard: pt.guard };
}
function wdGuardEnd(W, cs, pt, t, events) {
  var g = pt.guard, e;
  if (!g) return;
  wdGuardSettle(W, pt, t);
  e = wdCard(cs, g.card);
  if (e && typeof cardsUseClear === 'function') cardsUseClear(e, 'garrison');
  wdTrpSet(W, g.card, (W.trp[g.card] ? W.trp[g.card].r : 1), t);
  wdHeal(W, cs, g.card, t);
  pt.guard = null; pt.owner = null;
  W.nw++;
  events.push({ t: t, k: 'gend', pt: pt.id, ptName: pt.ty, card: g.card });
}
// 單隊抵達(資源點 / 山寨)
function wdArriveSingle(W, cs, trip, t, events) {
  var pt = wdPt(W, trip.pt), rp, pick, teams;
  events.push({ t: t, k: 'arrive', team: trip.team, pt: trip.pt });
  if (!pt || (pt.cat === 'res' && pt.owner) || pt.cl || (pt.cat === 'yg' && typeof wmapMobGone === 'function' && wmapMobGone(W, pt, t))) { trip.st = 'back'; trip.tHome = t + wdBackMs(trip); events.push({ t: t, k: 'miss', team: trip.team, pt: trip.pt }); return; }
  rp = wdAssault(W, cs, pt, [trip], 'seq', t, events);
  if (rp.win && pt.cat === 'res' && trip.auto) {   // 自動派遣打下的點:自動挑 1 張閒置卡駐守
    teams = wdTeams();
    pick = wdPickGuard(W, cs, pt, t, teams);
    if (pick && wdGarrisonDo(W, cs, pt, pick.id, t).ok) { rp.guard = pick.id; rp.guardName = String(pick.name || ''); events.push({ t: t, k: 'autoguard', pt: pt.id, card: pick.id }); }   // 戰報記下自動駐守的人(詳情顯示)
  }
  wdTripTurn(W, cs, trip, t, events);
}
// ───────── 領地連戰(逐場推進;設計_領地守軍多隊與戰法成長_規格 3.2)─────────
// 集結組抵達資源領地後一場一場打:每場 = 目前上陣隊(c.q[0])對守軍第一支還活著的隊;贏了留場、下一場打下一支守軍;輸 / 全滅該隊離場回程(全滅 = 瞬間回城 + 重傷)、下一隊接手打殘血守軍;
// 場與場之間隔 WD_LANDFOE.gapMs,期間開團者可 wdChainRetreat〔退〕:全部上陣 / 未上陣的隊立刻回程,守軍傷勢照失敗規則保留(nf > 1 保留 holdMs)。
// 平手(戰鬥逾時雙方都沒贏):該場卡「戰鬥中」tieMs(10 分);期間雙方後隊撞進來 —— 防守方優先(守軍下一隊先、攻方下一隊後,記在該列 row.join);到期雙方脫離(該場不分勝負),
//   然後『加入者與倖存者合成新一場重算』= 攻方後隊(沒有後隊 = 原隊重打)對守軍倖存隊重新打一場(同一份戰報多一列)。同一連戰連續平手超過 tieMax 次 → 雙方都脫離結束(視為失敗,保留傷勢)。
// 全部事件由 wdRun 依時間推進(離線補算與逐分推進結果相同)。
function wdChainOf(W, id) {
  var i;
  for (i = 0; i < (W.chains || []).length; i++) if (W.chains[i].id === id) return W.chains[i];
  return null;
}
function wdChainOfPt(W, ptId) {
  var i;
  for (i = 0; i < (W.chains || []).length; i++) if (W.chains[i].pt === ptId) return W.chains[i];
  return null;
}
function wdChainTrip(W, c, n) {
  var i;
  for (i = 0; i < W.trips.length; i++) if (W.trips[i].rally === c.rid && W.trips[i].team === n && W.trips[i].st === 'go') return W.trips[i];
  return null;
}
function wdFoeFirst(pt, not) {
  var j;
  for (j = 0; j < pt.nf; j++) if (j !== not && wdFoeAlive(pt.foeHp[j])) return j;
  return -1;
}
function wdChainStart(W, cs, rl, trips, pt, t, events) {
  var c = { id: 'c' + (++W.cc), pt: pt.id, rid: rl.id, t0: t, next: t, q: trips.map(function (tr) { return tr.team; }), k: 0, ties: 0, tie: null, rows: [], dmgBy: {}, lastTeam: 0, anyWipe: false };
  W.chains.push(c);
  pt.foeHp = wdFoeCur(pt, t);
  if (pt.hk && t >= pt.hk) pt.hk = 0;
  wdChainStep(W, cs, c, t, events);
  return c;
}
function wdChainEnd(W, cs, c, pt, t, events, why) {
  var left = c.q.map(function (n) { return wdChainTrip(W, c, n); }).filter(Boolean), win, rp;
  W.chains = W.chains.filter(function (x) { return x !== c; });
  if (!pt || pt.owner) {
    left.forEach(function (tr) { tr.st = 'back'; tr.tHome = t + wdBackMs(tr); });
    events.push({ t: t, k: 'miss', team: 0, pt: c.pt });
    return null;
  }
  win = !pt.foeHp.some(wdFoeAlive);
  rp = wdAssaultEnd(W, pt, left, c.rows, { kind: 'rally', win: win, lastTeam: c.lastTeam, dmgBy: c.dmgBy, anyWipe: c.anyWipe, retreat: why === 'retreat' }, t, events);
  if (typeof ldOpenNote === 'function') ldOpenNote('rally', { t: t });
  left.forEach(function (tr) { wdTripTurn(W, cs, tr, t, events); });
  return rp;
}
// 在時刻 t 推進連戰一步(c.next 到點時由 wdRun 呼叫);每次呼叫要嘛結束連戰、要嘛把 c.next 往後推
function wdChainStep(W, cs, c, t, events) {
  var pt = wdPt(W, c.pt), L = WD_LANDFOE, tie = c.tie, trip = null, mine = null, fj, res, idx, rng, loss, row, dead, wiped, isTie, a2, nd, total;
  if (!pt || pt.owner) return wdChainEnd(W, cs, c, pt, t, events, 'miss');
  if (tie) {
    if (t < tie.until) { c.next = tie.until; return null; }
    c.tie = null;   // 平手到期:雙方脫離;攻方後隊(若有)與倖存守軍合成新一場
    if (tie.a2 && c.q.indexOf(tie.a2) > 0) c.q = [tie.a2].concat(c.q.filter(function (n) { return n !== tie.a2; }));
  }
  fj = wdFoeFirst(pt);
  if (fj < 0) return wdChainEnd(W, cs, c, pt, t, events, 'win');
  while (c.q.length) {
    trip = wdChainTrip(W, c, c.q[0]);
    if (trip) { mine = wdBuildMine(W, cs, trip.slots, t); if (mine.ids.length) break; wdTripTurn(W, cs, trip, t, events); }   // 名冊找不到人:直接回程
    c.q.shift(); trip = null;
  }
  if (!trip) return wdChainEnd(W, cs, c, pt, t, events, 'lose');
  total = wdFoeTotalMax(W, pt);
  c.k++;
  res = wdRunFight(mine, wdFoeTeam(W, pt, fj), pt.foeHp[fj], bnHash('wdb', W.seed, pt.id, W.sd + 1));
  idx = wdRecAdd(W, res.rec);
  pt.foeHp[fj] = res.newRow;
  rng = bnRng(bnHash('wdc', W.seed, pt.id, idx));
  loss = wdCasualty(W, cs, trip.slots.map(function (x) { return x.id; }), res.win, rng, t);
  dead = !wdFoeAlive(res.newRow);
  isTie = !!res.draw && !dead;   // 逾時平手才卡戰鬥中;雙方同歸於盡的 draw 視為攻方全滅、守軍該隊倒下
  wiped = !!res.wiped && !isTie;
  row = { team: trip.team, name: trip.name, foe: fj, dmg: total ? res.dmgAbs / total : 0, rounds: res.rounds, wiped: wiped, win: !!res.win, loss: loss, last: false, recIdx: idx, killed: dead, k: c.k, t: t };
  if (isTie) row.tie = true;
  c.rows.push(row);
  c.dmgBy[trip.team] = (c.dmgBy[trip.team] || 0) + row.dmg;
  if (!pt.foeHp.some(wdFoeAlive)) c.lastTeam = trip.team;
  if (isTie) {
    c.ties++;
    nd = wdFoeFirst(pt, fj);
    a2 = c.q.length > 1 ? c.q[1] : 0;
    row.join = [];
    if (nd >= 0) row.join.push({ side: 'D', foe: nd });          // 防守方優先:守軍下一隊先撞進
    if (a2) row.join.push({ side: 'A', team: a2 });              // 攻方下一隊後撞進
    if (c.ties > L.tieMax) return wdChainEnd(W, cs, c, pt, t, events, 'tie');
    c.tie = { k: c.k, until: t + L.tieMs, a: c.q[0], a2: a2, d: nd };
    c.next = c.tie.until;
    return null;
  }
  if (res.win) {
    if (!pt.foeHp.some(wdFoeAlive)) return wdChainEnd(W, cs, c, pt, t, events, 'win');
    c.next = t + L.gapMs;
    return null;
  }
  c.q.shift();
  if (wiped) c.anyWipe = true;
  trip.wiped = wiped;
  wdTripTurn(W, cs, trip, t, events);
  if (!pt.foeHp.some(wdFoeAlive)) return wdChainEnd(W, cs, c, pt, t, events, 'win');
  if (!c.q.length) return wdChainEnd(W, cs, c, pt, t, events, 'lose');
  c.next = t + L.gapMs;
  return null;
}
// 〔退〕:開團者在場與場之間按(平手「戰鬥中」不能退)。回 {ok, reason, rp, events}
function wdChainRetreat(W, cs, cid, now) {
  var r = wdRun(W, cs, now), c = wdChainOf(W, cid), pt, rp;
  if (r.frozen) return { ok: false, reason: 'frozen', events: r.events };
  if (!c) return { ok: false, reason: 'nochain', events: r.events };
  if (c.tie) return { ok: false, reason: 'tie', events: r.events };
  pt = wdPt(W, c.pt);
  rp = wdChainEnd(W, cs, c, pt, now, r.events, 'retreat');
  return { ok: true, reason: '', rp: rp, events: r.events };
}
function wdArriveRally(W, cs, rl, t, events) {
  var pt = wdPt(W, rl.pt), trips = [], rp;
  rl.order.forEach(function (n) {
    var i;
    for (i = 0; i < W.trips.length; i++) if (W.trips[i].rally === rl.id && W.trips[i].team === n) { trips.push(W.trips[i]); return; }
  });
  W.rallies = W.rallies.filter(function (x) { return x !== rl; });
  if (!trips.length) return;
  events.push({ t: t, k: 'arrive', team: 0, pt: rl.pt, rally: rl.id });
  if (!pt || pt.owner) { trips.forEach(function (tr) { tr.st = 'back'; tr.tHome = t + wdBackMs(tr); }); events.push({ t: t, k: 'miss', team: 0, pt: rl.pt }); return; }
  if (pt.cat === 'res' && typeof WD_LANDFOE !== 'undefined') { wdChainStart(W, cs, rl, trips, pt, t, events); return; }   // 資源領地:逐場連戰(之後由 'chain' 事件推進)
  rp = wdAssault(W, cs, pt, trips, 'rally', t, events);
  if (typeof ldOpenNote === 'function') ldOpenNote('rally', { t: t });
  trips.forEach(function (tr) { wdTripTurn(W, cs, tr, t, events); });
}
// 資源點刷新:有人駐守、已占領待駐守、有隊伍前往的點保留,其他換新補滿
function wdRefreshRes(W, t, events) {
  var keep = {}, kept, fresh = [], i;
  W.trips.forEach(function (tr) { keep[tr.pt] = true; });
  kept = W.pts.filter(function (p) { return p.cat === 'res' && (p.owner || p.guard || keep[p.id]); });
  for (i = kept.length; i < WD_CFG.resCount; i++) fresh.push(wdGenPt(W, 'res'));
  if (typeof evTreasureOn === 'function' && typeof wdMarkTreasure === 'function' && evTreasureOn(t)) wdMarkTreasure(W, fresh);   // 寶地採集活動:新點中 2 個設 tr:1
  W.pts = kept.concat(fresh, W.pts.filter(function (p) { return p.cat !== 'res'; }));
  events.push({ t: t, k: 'refresh', kept: kept.length, added: fresh.length });
}
function wdNextEvent(W, now) {
  var best = null, i;
  function cand(t, r, idx, k, ref) {
    if (t > now) return;
    if (!best || t < best.t || (t === best.t && (r < best.r || (r === best.r && idx < best.i)))) best = { t: t, r: r, i: idx, k: k, ref: ref };
  }
  if (W.nr <= now) cand(wdLastRefresh(now), 0, 0, 'refresh');
  for (i = 0; i < W.trips.length; i++) {
    if (W.trips[i].st === 'back') cand(W.trips[i].tHome, 1, i, 'home', W.trips[i]);
    else if (!W.trips[i].rally) {
      if (W.trips[i].lg && W.trips[i].lg.k === 'idle') cand(W.trips[i].lg.hu, 1.2, i, 'idleend', W.trips[i]);   // 行軍中停下閒置(wmap_go.js):不抵達;到期自動撤退
      else cand(W.trips[i].tArrive, 2, i, 'arrive', W.trips[i]);
    }
  }
  for (i = 0; i < W.rallies.length; i++) cand(W.rallies[i].tArrive, 2, 1000 + i, 'rally', W.rallies[i]);
  for (i = 0; i < (W.chains || []).length; i++) cand(W.chains[i].next, 2.5, 3000 + i, 'chain', W.chains[i]);
  for (i = 0; i < W.pts.length; i++) {
    if (W.pts[i].guard) cand(W.pts[i].guard.t1, 3, i, 'gend', W.pts[i]);
    if (W.pts[i].cat === 'camp' && W.pts[i].cl) cand(W.pts[i].rs, 5, i, 'camp', W.pts[i]);
  }
  if (W.rsv) for (i = 0; i < W.rsv.length; i++) if (W.rsv[i].st === 'wait') cand(W.rsv[i].tGo, 1.5, 2000 + i, 'rsvgo', W.rsv[i]);   // 預約出發:回城之後、抵達之前
  cand(W.nb, 4, 0, 'beast');
  return best;
}
function wdHandle(W, cs, ev, events) {
  var i, pt, n;
  if (ev.k === 'refresh') { wdRefreshRes(W, ev.t, events); }
  else if (ev.k === 'home') wdTripHome(W, cs, ev.ref, ev.t, events, false);
  else if (ev.k === 'arrive') wdArriveSingle(W, cs, ev.ref, ev.t, events);
  else if (ev.k === 'idleend') {   // 閒置到期:自動撤退(航段本身由 wmMarchSegAt 推得;這裡只把行程切成 back,讓回城事件接手)
    ev.ref.st = 'back';
    ev.ref.tHome = (typeof wmMarchEnd === 'function' && isFinite(wmMarchEnd(ev.ref.lg))) ? wmMarchEnd(ev.ref.lg) : ev.t;
    events.push({ t: ev.t, k: 'idleend', team: ev.ref.team, pt: ev.ref.pt });
  }
  else if (ev.k === 'rally') wdArriveRally(W, cs, ev.ref, ev.t, events);
  else if (ev.k === 'chain') wdChainStep(W, cs, ev.ref, ev.t, events);
  else if (ev.k === 'gend') wdGuardEnd(W, cs, ev.ref, ev.t, events);
  else if (ev.k === 'rsvgo') { if (typeof wdRsvGo === 'function') wdRsvGo(W, cs, ev.ref, ev.t, events); else W.rsv = W.rsv.filter(function (x) { return x !== ev.ref; }); }
  else if (ev.k === 'beast') {
    n = W.pts.filter(function (p) { return p.cat === 'beast' && !p.act; }).length;
    W.nb += WD_CFG.beastEvery;
    if (n < WD_CFG.beastMax && !(typeof wmapMobOn === 'function' && wmapMobOn())) { pt = wdGenPt(W, 'beast'); W.pts.push(pt); events.push({ t: ev.t, k: 'beast', pt: pt.id, ptName: pt.ty }); }
  } else if (ev.k === 'camp') {
    pt = wdGenPt(W, 'camp');
    i = W.pts.indexOf(ev.ref);
    if (i >= 0) W.pts[i] = pt; else W.pts.push(pt);
    events.push({ t: ev.t, k: 'camp', pt: pt.id, ptName: pt.ty });
  }
}
// 推進到 now。回 {frozen, events}。cs 可為 null(視為空名冊)
function wdRun(W, cs, now) {
  var events = [], guard = 0, ev, ids;
  if (now < W.now) return { frozen: true, events: events };
  cs = cs || { roster: [] };
  while (guard++ < 200000) {
    ev = wdNextEvent(W, now);
    if (!ev) break;
    wdHandle(W, cs, ev, events);
    if (ev.k === 'refresh') W.nr = wdNextRefresh(now);
  }
  W.now = now;
  ids = Object.keys(W.hurt);
  ids.forEach(function (id) { if (W.hurt[id] <= now) delete W.hurt[id]; });
  wdHealAll(W, cs, now, false);   // 征兵完成 / 自然招募之後:在城沒滿兵的卡依優先順序補(rsvHealSweep;auto 關閉回空)
  return { frozen: false, events: events };
}
function wdAdvance(W, cs, now) { return wdRun(W, cs, now); }

// ───────── 收成 ─────────
function wdHarvZero() { var o = {}; WD_HARV_KEYS.forEach(function (k) { o[k] = 0; }); return o; }
function wdHarvPending(W, now) {
  var o = wdHarvZero();
  WD_HARV_KEYS.forEach(function (k) { o[k] = W.harv[k] || 0; });
  W.pts.forEach(function (p) {
    var g = p.guard, dt, key;
    if (!g) return;
    dt = Math.min(now, g.t1) - g.ac;
    key = WD_RES_KEY[p.ty];
    if (dt > 0 && key) o[key] += g.perH * dt / WD_CFG.HOUR;
  });
  return o;
}
// 一鍵收成:結算進行中的駐守,把整數部分取出(小數留著)。回 {糧,生鐵,獸皮,木炭,礪石}(整數);呼叫端轉入遊戲資源庫
function wdCollect(W, now) {
  var got = wdHarvZero();
  W.pts.forEach(function (p) { if (p.guard) wdGuardSettle(W, p, now); });
  WD_HARV_KEYS.forEach(function (k) {
    var n = Math.floor((W.harv[k] || 0) + 1e-9);
    got[k] = n;
    W.harv[k] = Math.max(0, (W.harv[k] || 0) - n);
  });
  if ((W.hs | 0) > 0) { got.shards = W.hs | 0; W.hs = 0; }   // 寶地碎片
  if (typeof ldOpenNote === 'function' && (WD_HARV_KEYS.some(function (k) { return got[k] > 0; }) || got.shards)) ldOpenNote('collect', { t: now });
  return got;
}
function wdBadgeOf(W, now) {
  var p = wdHarvPending(W, now);
  return W.nw > 0 || WD_HARV_KEYS.some(function (k) { return p[k] >= 1; });
}

// ───────── 自動派遣 ─────────
// 只回計畫(純讀):[{team, pt, ptName, lv, myPower, foePower, mins, backMins}]。規則:只派穩勝(我方 ≥ 守軍 × autoMul)、
// 只對無主且沒人前往的資源點、從等級高的點開始、每點派剛好打得贏的最弱一隊、到沒有閒置隊或駐守名額滿為止
function wdAutoPlan(W, cs, now, teams) {
  var free = [], used = {}, targets, slots, plan = [];
  teams = teams || wdTeams();
  teams.forEach(function (t) {
    if (wdTeamTrip(W, t.n)) return;
    if (!wdCheckSlots(W, cs, t.slots, now).ok) return;
    free.push({ team: t, power: wdTeamPowerR(W, cs, t.slots, now) });   // 戰力 × 兵力比例
  });
  free.sort(function (a, b) { return a.power - b.power || a.team.n - b.team.n; });
  targets = W.pts.filter(function (p) { return p.cat === 'res' && !p.owner && !wdPtBusy(W, p.id) && p.nf === 1; }).sort(function (a, b) { return (b.tr | 0) - (a.tr | 0) || b.lv - a.lv || (a.id < b.id ? -1 : 1); });   // 寶地先排
  slots = wdGuardCap(W) - wdGuardUsed(W) - wdOwnedWaiting(W);
  targets.forEach(function (pt) {
    var fp, i, f, hit;
    if (plan.length >= slots) return;
    fp = wdFoeTeam(W, pt, 0).power;
    for (i = 0; i < free.length; i++) {
      f = free[i];
      if (f.team.slots.some(function (s) { return used[s.id]; })) continue;
      if (typeof wdRsvBusyBefore === 'function' && wdRsvBusyBefore(W, f.team.n, now + (pt.mins + pt.mins / WD_CFG.retDiv) * WD_CFG.MIN)) continue;   // 預估回城前就有預約出發的隊不派
      if (f.power >= fp * WD_CFG.autoMul) { hit = i; break; }
    }
    if (hit === undefined) return;
    f = free.splice(hit, 1)[0];
    f.team.slots.forEach(function (s) { used[s.id] = true; });
    plan.push({ team: f.team, pt: pt.id, ptName: pt.ty, lv: pt.lv, myPower: f.power, foePower: fp, mins: pt.mins, backMins: Math.round(pt.mins / WD_CFG.retDiv * 10) / 10 });
  });
  return plan;
}
function wdAutoGo(W, cs, plan, now) {
  var res = [];
  (plan || []).forEach(function (row) {
    var r = wdDispatch(W, cs, row.team, row.pt, now, { auto: true });
    res.push({ team: row.team.n, pt: row.pt, ok: r.ok, reason: r.reason });
  });
  if (typeof ldOpenNote === 'function' && res.some(function (x) { return x.ok; })) ldOpenNote('auto', { n: res.filter(function (x) { return x.ok; }).length, t: now });
  return res;
}

// ───────── 存檔 / 載入 ─────────
function wdSave(W) { return JSON.stringify(W); }
function wdLoad(str, now, seed, cs) {
  var raw = null;
  try { raw = JSON.parse(str); } catch (e) { raw = null; }
  return wdNorm(raw, now, seed, cs);
}
function wdNormFoeHp(rows, nf) {
  var out = [], i;
  for (i = 0; i < nf; i++) {
    out.push(Array.isArray(rows && rows[i]) && rows[i].length === 3 ? rows[i].map(function (x) { return wdNum(x, 0, 1, 1); }) : [1, 1, 1]);
  }
  return out;
}
// 行軍航段 lg(js/wm_march.js 的格式)正規化:壞的回 null(行程退回舊欄位)。p 最多 64 個轉折點
function wdNormPath(p) {
  var out = [], i;
  if (!Array.isArray(p) || !p.length || p.length > 64) return null;
  for (i = 0; i < p.length; i++) { if (typeof p[i] !== 'number' || !isFinite(p[i]) || p[i] < 0 || p[i] > 1e7) return null; out.push(p[i] | 0); }
  return out;
}
function wdNormBack(b) {
  var p;
  if (!b || typeof b !== 'object') return null;
  p = wdNormPath(b.p);
  if (!p) return null;
  return { p: p, a0: wdInt(b.a0, 0, 1e9, 0), L: wdInt(b.L, 0, 1e9, 0), M: wdInt(b.M, 0, 1e12, 0) };
}
function wdNormLeg(g) {
  var o, p, b, bt;
  if (!g || typeof g !== 'object' || ['mv', 'idle', 'back', 'wait', 'done'].indexOf(g.k) < 0) return null;
  p = wdNormPath(g.p);
  if (!p) return null;
  o = { k: g.k, v: wdInt(g.v, 0, 1e9, 0), t0: wdInt(g.t0, 0, 1e15, 0), p: p, n: wdInt(g.n, 8, 1024, 64), a0: wdInt(g.a0, 0, 1e9, 0), L: wdInt(g.L, 0, 1e9, 0), M: wdInt(g.M, 0, 1e12, 0), w: wdInt(g.w, 0, 1e12, 0), on: g.on === 'hold' ? 'hold' : 'fight', g: wdInt(g.g, 0, 1e7, p[p.length - 1]) };
  if (g.k === 'idle') { o.rm = wdInt(g.rm, 0, 1e12, 0); o.hu = wdInt(g.hu, 0, 1e15, o.t0); }
  b = wdNormBack(g.b); if (b) o.b = b;
  bt = wdNormBack(g.bt); if (bt) o.bt = bt;
  if (g.hm) o.hm = 1;
  if (g.hd) o.hd = wdInt(g.hd, 0, 1e12, 0);
  if (g.fm !== undefined) o.fm = wdInt(g.fm, 0, 1e9, 3000);
  return o;
}
function wdNormPt(r) {
  var g, nf, o;
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !WD_PFX[r.cat]) return null;
  nf = wdInt(r.nf, 1, 5, 1);
  o = { id: r.id, cat: r.cat, ty: String(r.ty || ''), lv: wdInt(r.lv, 1, WD_CFG.lvMap.length - 1, 1), mins: r.tut ? wdNum(r.mins, 0.5, WD_CFG.minsMax, 0.5) : wdInt(r.mins, WD_CFG.minsMin, WD_CFG.minsMax, WD_CFG.minsMin), nf: nf, fs: wdInt(r.fs, 0, 4294967295, 0), act: !!r.act,
    owner: r.owner === 'me' ? 'me' : null, guard: null, foeHp: wdNormFoeHp(r.foeHp, nf), foeT: wdInt(r.foeT, 0, 1e15, 0), cl: !!r.cl, rs: wdInt(r.rs, 0, 1e15, 0) };
  if (r.hk) o.hk = wdInt(r.hk, 0, 1e15, 0);   // 領地多隊失敗後守軍傷勢保留到期時刻(0 / 沒有 = 無)
  if (r.guard && typeof r.guard === 'object' && typeof r.guard.card === 'string' && o.cat === 'res') {
    g = r.guard;
    o.guard = { card: g.card, t0: wdInt(g.t0, 0, 1e15, 0), t1: wdInt(g.t1, 0, 1e15, 0), ac: wdInt(g.ac, 0, 1e15, 0), perH: wdNum(g.perH, 0, 1e9, 0), hb: wdInt(g.hb, 0, 1e6, 0) };
    o.owner = 'me';
  }
  if (r.tr) o.tr = 1;       // 寶地(ld_open_wd.js)
  if (r.tut) o.tut = 1;     // 新手寨
  if (o.cat === 'camp' && o.cl && !o.rs) o.rs = 1;
  return o;
}
function wdNormChain(c) {
  var tie = null, rows;
  if (!c || typeof c !== 'object' || typeof c.id !== 'string' || typeof c.pt !== 'string' || typeof c.rid !== 'string' || !Array.isArray(c.q)) return null;
  if (c.tie && typeof c.tie === 'object') tie = { k: wdInt(c.tie.k, 0, 1e6, 0), until: wdInt(c.tie.until, 0, 1e15, 0), a: wdInt(c.tie.a, 0, 99, 0), a2: wdInt(c.tie.a2, 0, 99, 0), d: wdInt(c.tie.d, -1, 99, -1) };
  rows = (Array.isArray(c.rows) ? c.rows : []).filter(function (r) { return r && typeof r === 'object'; }).slice(0, 60);
  return { id: c.id, pt: c.pt, rid: c.rid, t0: wdInt(c.t0, 0, 1e15, 0), next: wdInt(c.next, 0, 1e15, 0), q: c.q.map(function (n) { return wdInt(n, 1, 99, 1); }).slice(0, 10), k: wdInt(c.k, 0, 1e6, 0), ties: wdInt(c.ties, 0, 1e6, 0), tie: tie, rows: rows, dmgBy: (c.dmgBy && typeof c.dmgBy === 'object') ? c.dmgBy : {}, lastTeam: wdInt(c.lastTeam, 0, 99, 0), anyWipe: !!c.anyWipe };
}
// 存檔正規化:壞檔 / 版本不符 → 全新(不丟例外);數值夾住;缺的點補齊;名冊占用狀態與行程對齊
function wdNorm(raw, now, seed, cs) {
  var W, sd, i;
  if (!raw || typeof raw !== 'object' || raw.v !== 2 || !Array.isArray(raw.pts)) return wdNew(seed, now);
  try {
    sd = typeof raw.seed === 'number' && isFinite(raw.seed) ? raw.seed : seed;
    W = wdNew(sd, now);
    W.pts = []; W.pc = wdInt(raw.pc, 0, 1e9, 0);
    W.now = wdInt(raw.now, 0, now, now);
    W.sd = wdInt(raw.sd, 0, 1e9, 0); W.rn = wdInt(raw.rn, 0, 1e9, 0); W.tc = wdInt(raw.tc, 0, 1e9, 0); W.kc = wdInt(raw.kc, 0, 1e9, 0);
    W.nr = wdInt(raw.nr, 0, 1e15, wdNextRefresh(now)); W.nb = wdInt(raw.nb, 0, 1e15, now + WD_CFG.beastEvery); W.nw = wdInt(raw.nw, 0, 1e6, 0);
    raw.pts.forEach(function (r) { var p = wdNormPt(r); if (p) W.pts.push(p); });
    if (raw.hurt && typeof raw.hurt === 'object') Object.keys(raw.hurt).forEach(function (k) { var v = wdInt(raw.hurt[k], 0, 1e15, 0); if (v > 0) W.hurt[k] = v; });
    if (raw.trp && typeof raw.trp === 'object') Object.keys(raw.trp).forEach(function (k) { var o = raw.trp[k]; if (o && typeof o === 'object') W.trp[k] = { r: wdNum(o.r, WD_CFG.trpMin, 1, 1), t: wdInt(o.t, 0, 1e15, now) }; });
    if (raw.harv && typeof raw.harv === 'object') WD_HARV_KEYS.forEach(function (k) { W.harv[k] = wdNum(raw.harv[k], 0, 1e12, 0); });
    W.trips = (Array.isArray(raw.trips) ? raw.trips : []).map(function (t) {
      var slots, st, o, lg;
      if (!t || typeof t !== 'object' || typeof t.id !== 'string' || typeof t.pt !== 'string') return null;
      slots = wdCleanSlots(t.slots);
      if (!slots.length) return null;
      st = t.st === 'back' ? 'back' : 'go';
      if (st === 'go' && !W.pts.some(function (p) { return p.id === t.pt; })) return null;
      o = { id: t.id, team: wdInt(t.team, 1, 99, 1), name: String(t.name || ''), pt: t.pt, t0: wdInt(t.t0, 0, 1e15, now), tArrive: wdInt(t.tArrive, 0, 1e15, now), tHome: wdInt(t.tHome, 0, 1e15, 0), st: st, rally: typeof t.rally === 'string' ? t.rally : null, slots: slots, auto: !!t.auto, mins: wdInt(t.mins, 1, 60, 1) };
      lg = wdNormLeg(t.lg);   // 新地圖行程(js/wmap_go.js):航段與目標格 / 路徑一併保留;壞航段 = 當舊行程處理
      if (lg) { o.lg = lg; o.gi = wdInt(t.gi, 0, 1e7, lg.g); o.cost = wdNum(t.cost, 0, 1e4, 0); o.spd = wdNum(t.spd, 0.1, 10, 1); o.g2 = 1; if (t.path) { o.path = wdNormPath(t.path) || lg.p; o.goMs = wdInt(t.goMs, 0, 1e12, 0); o.backMs = wdInt(t.backMs, 0, 1e12, 0); } }
      return o;
    }).filter(Boolean);
    W.cc = wdInt(raw.cc, 0, 1e9, 0);
    W.chains = (Array.isArray(raw.chains) ? raw.chains : []).map(wdNormChain).filter(function (c) { return c && W.trips.some(function (t) { return t.rally === c.rid && t.st === 'go'; }); });
    W.rallies = (Array.isArray(raw.rallies) ? raw.rallies : []).map(function (r) {
      if (!r || typeof r !== 'object' || typeof r.id !== 'string' || typeof r.pt !== 'string' || !Array.isArray(r.order)) return null;
      return { id: r.id, pt: r.pt, order: r.order.map(function (n) { return wdInt(n, 1, 99, 1); }).slice(0, WD_CFG.rallyMax), t0: wdInt(r.t0, 0, 1e15, now), tArrive: wdInt(r.tArrive, 0, 1e15, now) };
    }).filter(function (r) { return r && W.trips.some(function (t) { return t.rally === r.id && t.st === 'go'; }); });
    W.trips = W.trips.filter(function (t) { return !t.rally || t.st === 'back' || W.rallies.some(function (r) { return r.id === t.rally; }) || W.chains.some(function (c) { return c.rid === t.rally; }); });
    W.rp = (Array.isArray(raw.rp) ? raw.rp : []).filter(function (r) { return r && typeof r.id === 'string' && Array.isArray(r.rows); }).slice(0, WD_CFG.rpMax);
    W.rc = (Array.isArray(raw.rc) ? raw.rc : []).filter(function (r) { return r && typeof r.i === 'number' && r.rec && typeof r.rec === 'object'; }).slice(0, WD_CFG.rcMax);
    W.hs = wdInt(raw.hs, 0, 1e9, 0);
    if (raw.g2 && typeof wmapSettleNorm === 'function') W.g2 = wmapSettleNorm(raw.g2, now);   // 新地圖領地產出記錄(js/wmap_settle.js)
    if (typeof wdRsvNorm === 'function') wdRsvNorm(raw.rsv, W);
    wdFill(W, now);
    if (cs && cs.roster) wdNormCards(W, cs);
  } catch (e) {
    return wdNew(seed, now);
  }
  return W;
}
// 補齊缺的點:資源 10、山寨 4、縣 / 郡 / 關口固定數量
function wdFill(W, now) {
  var i;
  function cnt(cat) { return W.pts.filter(function (p) { return p.cat === cat; }).length; }
  while (cnt('res') < WD_CFG.resCount) W.pts.push(wdGenPt(W, 'res'));
  while (cnt('camp') < WD_CFG.campCount) W.pts.push(wdGenPt(W, 'camp'));
  [['county', WD_CFG.countyN], ['jun', WD_CFG.junN], ['pass', WD_CFG.passN]].forEach(function (x) { while (cnt(x[0]) < x[1]) W.pts.push(wdGenPt(W, x[0], { idx: cnt(x[0]) })); });
}
// 開檔清理殘留占用:外勤中但對不到進行中行程(含舊外勤的 field,ref 不是 'wd:')→ 清除;駐守 'wd:' 對不到點 → 清除;行程中的卡補標
function wdNormCards(W, cs) {
  var tripIds = {}, guardOf = {};
  W.trips.forEach(function (t) { tripIds['wd:' + t.id] = t.slots.map(function (s) { return s.id; }); });   // 值 = 該行程的成員 id(舊存檔超過 3 人的隊伍已被 wdCleanSlots 截成前 3 人)
  W.pts.forEach(function (p) { if (p.guard) guardOf[p.guard.card] = 'wd:' + p.id; });
  if (typeof cardsUseGet !== 'function' || typeof cardsUseClear !== 'function') return;
  cs.roster.forEach(function (e) {
    var u = cardsUseGet(e);
    if (u.k === 'field' && (!tripIds[u.ref] || tripIds[u.ref].indexOf(e.id) < 0)) cardsUseClear(e, 'field');   // 行程不存在,或這張卡已不在該行程成員內(舊存檔被截掉的第 4、5 人)→ 解鎖
    else if (u.k === 'garrison' && typeof u.ref === 'string' && u.ref.indexOf('wd:') === 0 && guardOf[e.id] !== u.ref) cardsUseClear(e, 'garrison');
  });
  W.trips.forEach(function (t) {
    t.slots.forEach(function (s) {
      var e = wdCard(cs, s.id);
      if (e && typeof cardsUseSet === 'function' && cardsUseGet(e).k === 'idle') cardsUseSet(e, 'field', 'wd:' + t.id);
    });
  });
  W.pts.forEach(function (p) {
    var e;
    if (!p.guard) return;
    e = wdCard(cs, p.guard.card);
    if (e && typeof cardsUseSet === 'function' && cardsUseGet(e).k === 'idle') cardsUseSet(e, 'garrison', 'wd:' + p.id);
  });
}
