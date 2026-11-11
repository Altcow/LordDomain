// js/wm_core.js — 外勤清單 v0 核心邏輯(R1a,純函式、無 DOM,可在 node 跑;資料表見 wm_data.js)。
// 依賴(呼叫時才用):bn_data.js(bnTroopNorm)、bn_units.js(bnUnitSpec、bnBuildTeam、bnDefaultTroop、bnRound)、
//   bn_stages.js(bnStgChapter、bnStgV、bnStgBuildTeam)、bn_engine.js(bnHash、bnRng、bnRun)。
// 守衛:公開入口 wmAdvance / wmDispatch / wmFight / wmQueueSet 在 FEATURES.worldmap 關閉時不動狀態(v60 預設開)。
// 狀態 W(存檔鍵 WM_SAVE_KEY):清單 sl[8]、部隊 ar[3]、命令佇列 q[3]、歷史 hist、種子 seed、戰鬥序號 sd、時間 now。
// 卡片兵力 / 體力寫在 cs.roster 的 entry.wm = {h: 兵力 ‰(0~1000), s: 體力(0~100), t: 基準時刻 ms};缺欄位 = 滿。
// 時間一律絕對 ms;wmAdvance(W, cs, now) 冪等,分段或一次跑完結果逐位相同;now < W.now(時鐘倒轉)→ 凍結不動。
var WM_SAVE_KEY = 'lorddomain.wm.v1';
var WM_STATES = ['home', 'march', 'camp', 'ready', 'back'];
var WM_SILVER_KEY = '散銀';

function wmGuardOff() { return typeof featureOn === 'function' && !featureOn('worldmap'); }   // @DORMANT worldmap

// ───────── 狀態建立 / 正規化 / 存檔 ─────────
function wmHomeArmy(n) {
  return { n: n, st: 'home', tm: [], si: -1, it: '', kind: '', t0: 0, t1: 0, go: 0, rt: 0, cw: 0, cms: 0, tE: 0, auto: true, try: 0, qw: 0 };
}
function wmNew(seed, now) {
  var W = { v: 1, seed: (seed >>> 0), now: now, sd: 0, sl: [], q: [], ar: [], hist: { last: {}, bl: [], fr: { d: -1, n: 0 } } }, i;
  for (i = 0; i < WM_CFG.slotCount; i++) W.sl.push({ g: 0, it: null, nx: now });
  for (i = 0; i < WM_CFG.armyCap; i++) { W.ar.push(wmHomeArmy(i + 1)); W.q.push({ tm: [], cm: [], au: true }); }
  wmRun(W, null, now);   // 初始化:刷出 8 格(不走守衛,僅建立狀態)
  return W;
}
function wmSave(W) { return JSON.stringify(W); }
function wmLoad(str, now, seed, cs) {
  var raw = null;
  try { raw = JSON.parse(str); } catch (e) { raw = null; }
  return wmNorm(raw, now, seed, cs);
}
function wmInt(x, lo, hi, dflt) {
  x = typeof x === 'number' && isFinite(x) ? Math.floor(x) : dflt;
  return Math.max(lo, Math.min(hi, x));
}
function wmCleanTm(list) {
  return (Array.isArray(list) ? list : []).filter(function (m) { return m && typeof m.id === 'string'; }).slice(0, 5).map(function (m) {
    return { id: m.id, row: wmInt(m.row, 0, 2, 0), col: wmInt(m.col, 0, 2, 0), troop: String(m.troop || '') };
  });
}
// 存檔正規化:壞檔 / 版本不符 → 全新;數值夾住;找不到的格子或人員 → 部隊回村
function wmNorm(raw, now, seed, cs) {
  var W, i, r, it, q, k, cm, a, hit, sd;
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return wmNew(seed, now);
  sd = typeof raw.seed === 'number' && isFinite(raw.seed) ? raw.seed : seed;
  W = wmNew(sd, now);
  W.seed = sd >>> 0;
  W.now = wmInt(raw.now, 0, now, now);
  W.sd = wmInt(raw.sd, 0, 1e9, 0);
  for (i = 0; i < WM_CFG.slotCount; i++) {
    r = raw.sl && raw.sl[i];
    W.sl[i] = { g: 0, it: null, nx: now };
    if (!r || typeof r !== 'object') continue;
    W.sl[i].g = wmInt(r.g, 0, 1e9, 0);
    W.sl[i].nx = wmInt(r.nx, 0, 1e15, now);
    it = r.it;
    if (it && typeof it === 'object' && typeof it.id === 'string') {
      W.sl[i].it = {
        id: it.id, si: i, g: wmInt(it.g, 0, 1e9, 0), cls: it.cls === 'n' ? 'n' : 'g', ty: String(it.ty || ''), drop: String(it.drop || ''), rar: String(it.rar || ''),
        mat: String(it.mat || ''), dist: wmInt(it.dist, 0, 500, 10), ch: wmInt(it.ch, 1, 6, 1), lv: wmInt(it.lv, 0, 35, 0),
        left: Math.max(0, Number(it.left) || 0), stock: Math.max(0, Number(it.stock) || 0), born: wmInt(it.born, 0, 1e15, 0), exp: wmInt(it.exp, 0, 1e15, 0),
        lock: wmInt(it.lock, 0, WM_CFG.armyCap, 0), fragFig: typeof it.fragFig === 'string' ? it.fragFig : null
      };
    }
  }
  if (raw.hist && typeof raw.hist === 'object') {
    if (raw.hist.last && typeof raw.hist.last === 'object') {
      Object.keys(raw.hist.last).forEach(function (kk) { W.hist.last[kk] = wmInt(raw.hist.last[kk], 0, 1e15, 0); });
    }
    if (Array.isArray(raw.hist.bl)) W.hist.bl = raw.hist.bl.filter(function (x) { return typeof x === 'number' && isFinite(x); }).slice(-50);
    if (raw.hist.fr && typeof raw.hist.fr === 'object') W.hist.fr = { d: wmInt(raw.hist.fr.d, -1, 1e9, -1), n: wmInt(raw.hist.fr.n, 0, 1e9, 0) };
  }
  for (i = 0; i < WM_CFG.armyCap; i++) {
    r = raw.ar && raw.ar[i];
    if (!r || typeof r !== 'object' || WM_STATES.indexOf(r.st) < 0 || r.st === 'home' || !Array.isArray(r.tm)) continue;
    a = W.ar[i];
    a.tm = wmCleanTm(r.tm);
    if (!a.tm.length) continue;
    a.st = r.st; a.si = wmInt(r.si, 0, WM_CFG.slotCount - 1, 0); a.it = String(r.it || ''); a.kind = r.kind === 'n' ? 'n' : 'g';
    a.t0 = wmInt(r.t0, 0, 1e15, now);
    a.t1 = wmInt(r.t1, a.t0, a.t0 + 2 * WM_CFG.DAY, a.t0);
    a.go = wmInt(r.go, 0, 1e6, 0); a.rt = wmInt(r.rt, 0, 1e9, 0); a.cw = wmInt(r.cw, 0, 1e9, 0); a.cms = wmInt(r.cms, 0, 1e9, 0);
    a.tE = wmInt(r.tE, a.t1, a.t1 + WM_CFG.gatherMaxMin * WM_CFG.MIN, a.t1);
    a.auto = r.auto !== false; a.try = wmInt(r.try, 0, 1e9, 0); a.qw = wmInt(r.qw, 0, 1e15, 0);
    hit = !!a.it && !!W.sl[a.si].it && W.sl[a.si].it.id === a.it;
    if (!hit && a.st !== 'back') { W.ar[i] = wmHomeArmy(i + 1); continue; }
    if ((a.st === 'camp' && a.kind !== 'g') || (a.st === 'ready' && a.kind !== 'n')) W.ar[i] = wmHomeArmy(i + 1);
  }
  for (i = 0; i < WM_CFG.armyCap; i++) {
    q = raw.q && raw.q[i];
    W.q[i] = { tm: [], cm: [], au: true };
    if (!q || typeof q !== 'object') continue;
    W.q[i].au = q.au !== false;
    W.q[i].tm = wmCleanTm(q.tm);
    cm = Array.isArray(q.cm) ? q.cm : [];
    for (k = 0; k < cm.length && W.q[i].cm.length < WM_CFG.queueMax; k++) {
      if (cm[k] && typeof cm[k] === 'object') W.q[i].cm.push({ sl: wmInt(cm[k].sl, 0, WM_CFG.slotCount - 1, 0), rf: wmInt(cm[k].rf, 0, 100, 0) });
    }
    if (!W.q[i].tm.length) W.q[i].cm = [];
  }
  if (cs && cs.roster) wmNormCards(W, cs, now);
  return W;
}
// 卡片 wm 欄位正規化;部隊 / 佇列中找不到的人員 → 部隊回村、佇列清空
function wmNormCards(W, cs, now) {
  cs.roster.forEach(function (e) {
    var w = e.wm;
    if (!w || typeof w !== 'object') { delete e.wm; return; }
    e.wm = { h: wmInt(w.h, 0, WM_CFG.hpMax, WM_CFG.hpMax), s: wmInt(w.s, 0, WM_CFG.staMax, WM_CFG.staMax), t: wmInt(w.t, 0, now, now) };
  });
  W.ar.forEach(function (a, n) {
    if (a.st === 'home') return;
    if (a.tm.some(function (m) { return !wmCardOf(cs, m.id); })) W.ar[n] = wmHomeArmy(n + 1);
  });
  W.q.forEach(function (q) {
    if (q.tm.some(function (m) { return !wmCardOf(cs, m.id); })) { q.tm = []; q.cm = []; }
  });
}

// ───────── 卡片狀態(惰性計算,離線照算) ─────────
function wmCardOf(cs, id) {
  var i;
  if (!cs || !cs.roster) return null;
  for (i = 0; i < cs.roster.length; i++) if (cs.roster[i].id === id) return cs.roster[i];
  return null;
}
function wmOutOf(W, id) {
  var i, a;
  for (i = 0; i < W.ar.length; i++) {
    a = W.ar[i];
    if (a.st !== 'home' && a.tm.some(function (m) { return m.id === id; })) return a.n;
  }
  return 0;
}
// 回傳 {h, s}。外出中的卡不回復(值 = 最後結算值);在村則依 t 起算線性回復(整數運算,分段或一次算結果相同)
function wmCardState(e, W, now) {
  var w = e && e.wm, dt;
  if (!w || typeof w.h !== 'number') return { h: WM_CFG.hpMax, s: WM_CFG.staMax };
  if (W && wmOutOf(W, e.id)) return { h: w.h, s: w.s };
  dt = Math.max(0, now - w.t);
  return {
    h: Math.min(WM_CFG.hpMax, w.h + Math.floor(dt * WM_CFG.hpPerHour / WM_CFG.HOUR)),
    s: Math.min(WM_CFG.staMax, w.s + Math.floor(dt * WM_CFG.staPerHour / WM_CFG.HOUR))
  };
}
function wmSetCard(e, h, s, t) { e.wm = { h: h, s: s, t: t }; }
function wmTroopOf(e, slot) { return bnTroopNorm(slot && slot.troop) || bnDefaultTroop(e); }
function wmItemAt(W, si) { return (si >= 0 && si < W.sl.length && W.sl[si].it) || null; }
function wmItemById(W, id) {
  var i;
  for (i = 0; i < W.sl.length; i++) if (W.sl[i].it && W.sl[i].it.id === id) return W.sl[i].it;
  return null;
}
function wmCountType(W, ty) {
  var n = 0, i;
  for (i = 0; i < W.sl.length; i++) if (W.sl[i].it && W.sl[i].it.ty === ty) n++;
  return n;
}
// 碎片每日上限(日界東八區);回傳實得數量。實際發放由 R5 接
function wmFragGrant(W, want, t) {
  var d = Math.floor((t + WM_CFG.dayShiftMs) / WM_CFG.DAY), g;
  if (W.hist.fr.d !== d) W.hist.fr = { d: d, n: 0 };
  g = Math.max(0, Math.min(want, WM_CFG.fragDailyCap - W.hist.fr.n));
  W.hist.fr.n += g;
  return g;
}

// 急補(花文):每 1% 缺額 × 品階價(WM_CFG.rushGoldPerPct;品階 = gr 1~5 → index 0~4,gr 量表待核)。只算價不扣款,扣款由呼叫端做
function wmRushQuote(W, cs, id, now) {
  var e = wmCardOf(cs, id), c, tier, missPct;
  if (!e) return { ok: false, reason: 'missing' };
  if (wmOutOf(W, id)) return { ok: false, reason: 'busy' };
  c = wmCardState(e, W, now);
  tier = Math.min(4, Math.max(0, (e.gr | 0) - 1));
  missPct = Math.ceil((WM_CFG.hpMax - c.h) / 10);
  return { ok: true, reason: '', cost: missPct * WM_CFG.rushGoldPerPct[tier], h0: c.h, s: c.s };
}
// 急補兵力到滿(體力不能急補)。回 quote;呼叫前應已推進到 now
function wmRush(W, cs, id, now) {
  var q = wmRushQuote(W, cs, id, now), e;
  if (wmGuardOff()) return { ok: false, reason: 'off' };   // @DORMANT worldmap
  if (!q.ok) return q;
  e = wmCardOf(cs, id);
  wmSetCard(e, WM_CFG.hpMax, q.s, now);
  return q;
}

// ───────── 清單刷新(種子化:同種子同結果) ─────────
function wmRespawnDelay(W, si, t) {
  var rng = bnRng(bnHash('wmr', W.seed, si, t));
  return WM_CFG.respawnMin + Math.floor(rng() * WM_CFG.respawnRand);
}
function wmNpcPick(u) {
  if (u < WM_NPC[0].w) return WM_NPC[0];
  if (u < WM_NPC[0].w + WM_NPC[1].w) return WM_NPC[1];
  if (u < WM_NPC[0].w + WM_NPC[1].w + WM_NPC[2].w) return WM_NPC[2];
  return WM_NPC[3];
}
// 產生第 g 代的格子物件。固定抽 6 個亂數,故與逐步推進結果一致
function wmGenItem(W, si, t) {
  var sl = W.sl[si], g = sl.g + 1, cls = si < WM_CFG.gatherSlots ? 'g' : 'n', rng, r = [], k, forced = -1, minLast = Infinity, blueN, rar = '白', ty, drop = '', dist, ch = 1, lv = 0, stock, life, it, npc, gat;
  sl.g = g;
  rng = bnRng(bnHash('wmg', W.seed, si, g));
  for (k = 0; k < 6; k++) r.push(rng());
  W.hist.bl = W.hist.bl.filter(function (x) { return x > t - WM_CFG.blueWindow; });
  blueN = W.hist.bl.length;
  life = WM_CFG.lifeMin + Math.floor(r[5] * WM_CFG.lifeRand);
  if (cls === 'n') {
    npc = wmNpcPick(r[0] * 100);
    ty = npc.k; drop = npc.drop;
    dist = WM_DIST.npc[0] + Math.floor(r[1] * (WM_DIST.npc[1] - WM_DIST.npc[0] + 1));
    ch = Math.min(6, 1 + Math.floor((dist - WM_DIST.npc[0]) / 7));
    lv = Math.min(35, (ch - 1) * 6 + Math.floor(r[2] * 6));
    it = { id: 'i' + si + '-' + g, si: si, g: g, cls: 'n', ty: ty, drop: drop, rar: 'npc', mat: '', dist: dist, ch: ch, lv: lv, left: 1, stock: 1, born: t, exp: t + life, lock: 0, fragFig: null };
    return it;
  }
  // 採集:強制類型(12 小時內 7 類都要出現過;最久未出現者優先)
  WM_GATHER.forEach(function (x, idx) {
    var last = W.hist.last[x.k] || 0;
    if (last < minLast) { minLast = last; forced = idx; }
  });
  if (t - minLast < WM_CFG.typeWindow) forced = -1;
  if (forced >= 0) gat = WM_GATHER[forced];
  else if (r[1] < 0.1) gat = null;   // 散銀
  else {
    var cands = WM_GATHER.filter(function (x) { return wmCountType(W, x.k) < WM_CFG.sameTypeMax; });
    if (!cands.length) cands = WM_GATHER;
    gat = cands[Math.floor(r[2] * cands.length)];
  }
  if (gat) {
    ty = gat.k;
    // 稀有度:藍 2~4 保底 / 上限(24 小時內)
    if (blueN < WM_CFG.blueMin) rar = '藍';
    else if (blueN >= WM_CFG.blueMax) rar = r[0] * 100 < WM_CFG.rollGreen ? '青' : '白';
    else rar = r[0] * 100 < WM_CFG.rollBlue ? '藍' : (r[0] * 100 < WM_CFG.rollGreen ? '青' : '白');
    W.hist.last[ty] = t;
    if (rar === '藍') W.hist.bl.push(t);
    stock = WM_STOCK[rar] + Math.floor(r[4] * WM_STOCK_RAND);
  } else {
    ty = WM_SILVER_KEY;
    rar = '白';
    stock = WM_STOCK['白'] + Math.floor(r[4] * WM_STOCK_RAND);
  }
  dist = WM_DIST[rar][0] + Math.floor(r[3] * (WM_DIST[rar][1] - WM_DIST[rar][0] + 1));
  it = { id: 'i' + si + '-' + g, si: si, g: g, cls: 'g', ty: ty, drop: '', rar: rar, mat: gat ? gat.mat : '', dist: dist, ch: 1, lv: 0, left: stock, stock: stock, born: t, exp: t + life, lock: 0, fragFig: null };
  return it;
}
// 過期後原格 relistDelay 換新;被採空 / 討平 → 空 20~45 分
function wmUnlock(W, it, t, events) {
  var sl = W.sl[it.si];
  it.lock = 0;
  if (sl.it && sl.it.id === it.id && it.exp <= t) {
    sl.it = null; sl.nx = it.exp + WM_CFG.relistDelay;
    events.push({ t: t, k: 'exp', si: it.si });
  }
}
// 事件查找:依 (時刻, 類別, 序號) 排序,保證分段與一次推進相同
function wmNextEvent(W, now) {
  var best = null, i, n, a, sl;
  function cand(t, r, idx, k) {
    if (t > now) return;
    if (!best || t < best.t || (t === best.t && (r < best.r || (r === best.r && idx < best.i)))) best = { t: t, r: r, i: idx, k: k };
  }
  for (i = 0; i < W.sl.length; i++) {
    sl = W.sl[i];
    if (sl.it) { if (!sl.it.lock) cand(sl.it.exp, 0, i, 'exp'); }
    else cand(sl.nx, 1, i, 'spawn');
  }
  for (n = 1; n <= W.ar.length; n++) {
    a = W.ar[n - 1];
    if (a.st === 'march') cand(a.t1, 2, n, 'arrive');
    else if (a.st === 'camp') cand(a.tE, 3, n, 'gdone');
    else if (a.st === 'back') cand(a.t1, 4, n, 'home');
    else if (a.st === 'home' && a.qw > 0) cand(a.qw, 5, n, 'qchk');
  }
  return best;
}
function wmHandle(W, cs, ev, events) {
  var sl, it, a;
  if (ev.k === 'exp') {
    sl = W.sl[ev.i]; it = sl.it;
    sl.it = null; sl.nx = it.exp + WM_CFG.relistDelay;
    events.push({ t: ev.t, k: 'exp', si: ev.i });
  } else if (ev.k === 'spawn') {
    it = wmGenItem(W, ev.i, ev.t);
    W.sl[ev.i].it = it; W.sl[ev.i].nx = 0;
    events.push({ t: ev.t, k: 'new', si: ev.i, id: it.id, ty: it.ty, rar: it.rar });
  } else if (ev.k === 'arrive') {
    a = W.ar[ev.i - 1];
    events.push({ t: ev.t, k: 'arrive', n: a.n, si: a.si });
    if (!wmItemById(W, a.it)) { a.st = 'back'; a.t0 = ev.t; a.t1 = ev.t + a.rt; events.push({ t: ev.t, k: 'miss', n: a.n }); }
    else if (a.kind === 'g') a.st = 'camp';
    else if (a.auto) wmFightInner(W, cs, a.n, ev.t, events);
    else a.st = 'ready';
  } else if (ev.k === 'gdone') {
    wmGatherEnd(W, cs, ev.i, ev.t, events);
  } else if (ev.k === 'home') {
    wmGoHome(W, cs, ev.i, ev.t, events);
  }
  // 'qchk' 只是喚醒佇列檢查(由 wmRun 之後的 wmQueueAll 處理)
}
// 採集完成:扣採集體力、格子減量(空了即清除並進入重生)、部隊轉回村
function wmGatherEnd(W, cs, n, t, events) {
  var a = W.ar[n - 1], it = wmItemById(W, a.it), gcost = Math.ceil(a.cms / (WM_CFG.MIN * WM_CFG.gatherStaMin)), loot = { mats: {}, gold: 0 }, mats, cw = a.cw;
  a.tm.forEach(function (m) {
    var e = wmCardOf(cs, m.id), c;
    if (!e) return;
    c = wmCardState(e, W, t);
    e.wm = { h: c.h, s: Math.max(0, c.s - gcost), t: e.wm ? e.wm.t : t };
  });
  if (it) {
    if (it.ty === WM_SILVER_KEY) loot.gold = cw * WM_CFG.silverGoldPerW;
    else {
      mats = Math.floor(cw / WM_CFG.rarW[it.rar]);
      if (mats > 0) loot.mats[it.mat] = mats;
    }
    it.left -= cw;
    if (it.left <= 0) {
      it.lock = 0;
      W.sl[it.si].it = null; W.sl[it.si].nx = t + wmRespawnDelay(W, it.si, t);
    } else wmUnlock(W, it, t, events);
  }
  a.st = 'back'; a.t0 = t; a.t1 = t + a.rt;
  events.push({ t: t, k: 'gather', n: n, si: a.si, cw: cw, loot: loot, sta: gcost });
}
// 回村:卡片回復基準時刻改為回村時刻
function wmGoHome(W, cs, n, t, events) {
  var a = W.ar[n - 1];
  a.tm.forEach(function (m) {
    var e = wmCardOf(cs, m.id), c;
    if (!e) return;
    c = wmCardState(e, W, t);
    wmSetCard(e, c.h, c.s, t);
  });
  a.st = 'home'; a.tm = []; a.it = ''; a.kind = ''; a.si = -1; a.qw = 0;
  events.push({ t: t, k: 'home', n: n });
}
// 部隊 → 戰鬥單位:hpR = 兵力比例;體力 < 30 攻擊 / 謀略 ×0.85(spec 層,bnUnitSpec 本身不改)
function wmArmyUnits(W, cs, a, t) {
  var specs = [];
  a.tm.forEach(function (m) {
    var e = wmCardOf(cs, m.id), c, sp;
    if (!e) return;
    c = wmCardState(e, W, t);
    sp = bnUnitSpec(e, { troop: m.troop, row: m.row, col: m.col });
    sp.hpR = c.h / WM_CFG.hpMax;
    if (c.s < WM_CFG.lowStaThr) { sp.stats.atk = bnRound(sp.stats.atk * WM_CFG.lowStaAtkMul); sp.stats.mag = bnRound(sp.stats.mag * WM_CFG.lowStaAtkMul); }
    sp.wmId = e.id;
    specs.push(sp);
  });
  return bnBuildTeam(specs);
}
// 據點敵隊(確定性:同 seed + 格子 id 同結果;敵將取自該章 roster 的非名人條目)
function wmFoes(W, it) {
  var ch = bnStgChapter(it.ch), rng = bnRng(bnHash('wmf', W.seed, it.id)), pool = ch.roster.filter(function (x) { return !(x && x.fig); }), n = 3 + Math.floor(rng() * 3), ents = [], k, st;
  st = { id: 'W:' + it.id, order: it.lv, boss: false, idx: 0 };
  for (k = 0; k < n && pool.length; k++) ents.push(pool[Math.floor(rng() * pool.length)]);
  return bnStgBuildTeam(ents, bnStgV(st), ch, st, 'W:' + it.id);
}
// 據點掉落:材料抽數(占位)+ 文 × 章 + 碎片(每日上限)
function wmNpcLoot(W, it, a, t) {
  var D = WM_DROP[it.drop], rng = bnRng(bnHash('wml', W.seed, it.id, a.try)), mats = {}, k, id, got;
  for (k = 0; k < D.dice; k++) {
    id = WM_DROP_MATS[Math.floor(rng() * WM_DROP_MATS.length)];
    mats[id] = (mats[id] || 0) + 1;
  }
  got = wmFragGrant(W, D.frag, t);
  return { mats: mats, gold: D.gold * it.ch, frag: { fig: it.fragFig, want: D.frag, got: got } };
}
// 一場自動快速戰鬥(bnRun,不記事件)→ 寫回每卡兵力 / 體力 → 勝則掉落並清除格子 → 部隊回村
function wmFightInner(W, cs, n, t, events) {
  var a = W.ar[n - 1], it = wmItemById(W, a.it), mine, foes, S, win, loot = null, seed, k, u, e, c, s, h;
  if (!it) return;
  mine = wmArmyUnits(W, cs, a, t);
  foes = wmFoes(W, it);
  seed = bnHash('wmb', W.seed, it.id, a.try);
  S = bnRun({ v: 1, seed: seed, teamA: mine.units, teamB: foes.units, opts: { events: false } });
  W.sd++;
  win = S.result.winner === 'A';
  loot = win ? wmNpcLoot(W, it, a, t) : null;
  a.tm.forEach(function (m) {
    e = wmCardOf(cs, m.id);
    if (!e) return;
    u = null;
    for (k = 0; k < S.units.length; k++) {
      if (S.units[k].side === 'A' && S.units[k].spec && S.units[k].spec.wmId === e.id) { u = S.units[k]; break; }
    }
    c = wmCardState(e, W, t);
    s = Math.max(0, c.s - WM_CFG.staPerFight - (win ? 0 : WM_CFG.staLoseExtra));
    h = u && u.alive ? Math.min(WM_CFG.hpMax, Math.max(WM_CFG.hpDead, Math.round(WM_CFG.hpMax * u.hp / u.maxHp))) : WM_CFG.hpDead;
    wmSetCard(e, h, s, t);
  });
  a.try++;
  if (win) {
    it.lock = 0;
    W.sl[it.si].it = null; W.sl[it.si].nx = t + wmRespawnDelay(W, it.si, t);
  } else wmUnlock(W, it, t, events);
  a.st = 'back'; a.t0 = t; a.t1 = t + a.rt;
  events.push({ t: t, k: 'fight', n: n, si: a.si, win: win, reason: S.result.reason, rounds: S.result.rounds, loot: loot });
}

// ───────── 派遣 / 報價 ─────────
// 報價(純讀取)。go、rt 為秒;cms 為採集毫秒;cw 為採集量(重);mats 為材料件數;gold 為文
function wmQuote(W, cs, tm, si, now) {
  var out = { ok: false, reason: '', go: 0, rt: 0, load: 0, rate: 0, cw: 0, cms: 0, sta: 0, mats: 0, gold: 0, lowSta: false }, it = wmItemAt(W, si), fac = 0, low = false, load = 0, rate = 0, ids = {}, k, e, c, slot, t, ld;
  if (!it) { out.reason = 'noitem'; return out; }
  if (it.lock) { out.reason = 'locked'; return out; }
  if (!tm || !tm.length || tm.length > 5) { out.reason = 'size'; return out; }
  for (k = 0; k < tm.length; k++) {
    slot = tm[k];
    if (ids[slot.id]) { out.reason = 'dup'; return out; }
    ids[slot.id] = true;
    e = wmCardOf(cs, slot.id);
    if (!e) { out.reason = 'missing'; return out; }
    if (wmOutOf(W, e.id)) { out.reason = 'busy'; return out; }
    c = wmCardState(e, W, now);
    if (c.h < WM_CFG.minHpDispatch) { out.reason = 'hp'; return out; }
    if (c.s < WM_CFG.minStaDispatch) { out.reason = 'sta'; return out; }
    t = wmTroopOf(e, slot);
    fac = Math.max(fac, WM_CFG.troopSpd[t] || 1);
    if (c.s < WM_CFG.lowStaThr) low = true;
    ld = Math.floor((WM_CFG.load[t] || 0) * (1 + (e.up | 0) * WM_CFG.loadPerStar) * Math.max(WM_CFG.loadHpFloor, c.h / WM_CFG.hpMax));
    load += ld;
    rate += WM_CFG.gatherPerMin * (c.s < WM_CFG.lowStaThr ? WM_CFG.lowStaGatherMul : 1);
  }
  out.lowSta = low;
  out.go = Math.min(WM_CFG.goMax, Math.max(WM_CFG.goMin, Math.round(it.dist * WM_CFG.goSecPerLi * fac * (low ? WM_CFG.lowStaGoMul : 1))));
  out.rt = Math.floor(out.go / WM_CFG.retDiv);
  out.sta = Math.floor(it.dist / WM_CFG.staPerLi);
  out.load = load; out.rate = rate;
  if (it.cls === 'g') {
    out.cw = Math.min(it.left, load, Math.floor(rate * WM_CFG.gatherMaxMin));
    out.cms = out.cw > 0 ? Math.ceil(out.cw / rate * WM_CFG.MIN) : 0;
    if (it.ty === WM_SILVER_KEY) out.gold = out.cw * WM_CFG.silverGoldPerW;
    else out.mats = Math.floor(out.cw / WM_CFG.rarW[it.rar]);
  }
  out.ok = true;
  return out;
}
// 出發(內部):行軍體力一次扣完、記部隊、鎖格子。前提已由 wmQuote 驗過
function wmStartMarch(W, cs, n, tm, si, now, auto) {
  var a = W.ar[n - 1], it = wmItemAt(W, si), out = wmQuote(W, cs, tm, si, now);
  tm.forEach(function (m) {
    var e = wmCardOf(cs, m.id), c;
    if (!e) return;
    c = wmCardState(e, W, now);
    wmSetCard(e, c.h, Math.max(0, c.s - out.sta), now);
  });
  a.st = 'march'; a.si = si; a.it = it.id; a.kind = it.cls; a.t0 = now; a.go = out.go; a.rt = out.rt * 1000;
  a.t1 = now + out.go * 1000; a.cw = out.cw; a.cms = out.cms; a.tE = a.t1 + out.cms; a.auto = auto !== false; a.qw = 0;
  a.tm = tm.map(function (m) {
    return { id: m.id, row: m.row | 0, col: m.col | 0, troop: wmTroopOf(wmCardOf(cs, m.id), m) };
  });
  it.lock = n;
  return out;
}
// 佇列就緒條件。cmd.rf > 0 且有人低於 rf% → 須補滿到 100% 才出;否則兵力 ≥ 300、體力 ≥ 10。
// 回 {at: 就緒時刻 ms(≤ t 即可出發), skip: 人員不存在須跳過, wait: 人員外出中}
function wmReadyAt(W, cs, tm, rf, t) {
  var target = WM_CFG.minHpDispatch, at = t, needFull = false, k, e, w;
  for (k = 0; k < tm.length; k++) {
    e = wmCardOf(cs, tm[k].id);
    if (!e) return { at: t, skip: true, wait: false };
    if (wmOutOf(W, e.id)) return { at: t, skip: false, wait: true };
    if (rf > 0 && wmCardState(e, W, t).h < rf * 10) needFull = true;
  }
  if (needFull) target = WM_CFG.hpMax;
  for (k = 0; k < tm.length; k++) {
    e = wmCardOf(cs, tm[k].id);
    w = e.wm || { h: WM_CFG.hpMax, s: WM_CFG.staMax, t: t };
    if (w.h < target) at = Math.max(at, w.t + Math.ceil((target - w.h) * WM_CFG.HOUR / WM_CFG.hpPerHour));
    if (w.s < WM_CFG.minStaDispatch) at = Math.max(at, w.t + Math.ceil((WM_CFG.minStaDispatch - w.s) * WM_CFG.HOUR / WM_CFG.staPerHour));
  }
  return { at: at, skip: false, wait: false };
}
function wmQueueCheck(W, cs, n, t, events) {
  var a = W.ar[n - 1], q = W.q[n - 1], cmd, it, rd, quote;
  a.qw = 0;
  while (a.st === 'home' && q.cm.length) {
    cmd = q.cm[0];
    it = wmItemAt(W, cmd.sl);
    if (!it || it.lock) return;
    rd = wmReadyAt(W, cs, q.tm, cmd.rf, t);
    if (rd.skip) { q.cm.shift(); events.push({ t: t, k: 'qskip', n: n, si: cmd.sl }); continue; }
    if (rd.wait) return;
    if (rd.at > t) { a.qw = rd.at; return; }
    quote = wmQuote(W, cs, q.tm, cmd.sl, t);
    if (!quote.ok) return;
    wmStartMarch(W, cs, n, q.tm, cmd.sl, t, q.au);
    q.cm.shift();
    events.push({ t: t, k: 'dispatch', n: n, si: cmd.sl, queued: true });
    return;
  }
}
function wmQueueAll(W, cs, t, events) {
  var n, a;
  for (n = 1; n <= W.ar.length; n++) {
    a = W.ar[n - 1];
    if (a.st !== 'home') continue;
    if (W.q[n - 1].cm.length) wmQueueCheck(W, cs, n, t, events);
    else a.qw = 0;
  }
}
// 內部推進(不含守衛)。cs 可為 null(視為空名冊)。回 {frozen, events}
function wmRun(W, cs, now) {
  var events = [], guard = 0, ev;
  if (now < W.now) return { frozen: true, events: events };
  cs = cs || { roster: [] };
  while (guard++ < 200000) {
    ev = wmNextEvent(W, now);
    if (!ev) break;
    wmHandle(W, cs, ev, events);
    wmQueueAll(W, cs, ev.t, events);
  }
  W.now = now;
  return { frozen: false, events: events };
}

// ───────── 公開入口(守衛) ─────────
// 推進到 now(冪等)。回 {frozen, events};守衛關閉時回 {off: true, events: []}
function wmAdvance(W, cs, now) {
  if (wmGuardOff()) return { off: true, frozen: false, events: [] };   // @DORMANT worldmap
  return wmRun(W, cs, now);
}
// 派遣:先推進到 now 再檢查出發。tm = [{id, row, col, troop}](bnteam 的 slots 格式)。opts = {now, n, auto}
function wmDispatch(W, cs, tm, si, opts) {
  var r, n, a, quote;
  opts = opts || {};
  if (wmGuardOff()) return { ok: false, reason: 'off' };   // @DORMANT worldmap
  r = wmRun(W, cs, opts.now);
  if (r.frozen) return { ok: false, reason: 'frozen', events: r.events };
  n = opts.n || 0;
  if (!n) for (n = 1; n <= W.ar.length && W.ar[n - 1].st !== 'home'; n++);
  a = W.ar[n - 1];
  if (!a || a.st !== 'home' || W.q[n - 1].cm.length) return { ok: false, reason: 'army', events: r.events };
  quote = wmQuote(W, cs || { roster: [] }, tm, si, opts.now);
  if (!quote.ok) return { ok: false, reason: quote.reason, events: r.events };
  wmStartMarch(W, cs || { roster: [] }, n, tm, si, opts.now, opts.auto !== false);
  r.events.push({ t: opts.now, k: 'dispatch', n: n, si: si, queued: false });
  return { ok: true, n: n, quote: quote, events: r.events };
}
// 手動開戰(部隊在 ready 時)。先推進到 now 再打
function wmFight(W, cs, n, now) {
  var r, a;
  if (wmGuardOff()) return { ok: false, reason: 'off' };   // @DORMANT worldmap
  r = wmRun(W, cs, now);
  a = W.ar[n - 1];
  if (r.frozen || !a || a.st !== 'ready') return { ok: false, reason: 'state', events: r.events };
  wmFightInner(W, cs || { roster: [] }, n, now, r.events);
  return { ok: true, events: r.events };
}
// 設定命令佇列:tm 為隊伍快照,cmds = [{sl, rf}](最多 5 筆)。呼叫前應已推進到 now;設定後於 W.now 檢查
function wmQueueSet(W, cs, n, tm, cmds, opts) {
  var events = [], q;
  if (wmGuardOff()) return { ok: false, reason: 'off' };   // @DORMANT worldmap
  if (!cmds || cmds.length > WM_CFG.queueMax) return { ok: false, reason: 'size' };
  q = { tm: wmCleanTm(tm), cm: cmds.map(function (c) { return { sl: wmInt(c.sl, 0, WM_CFG.slotCount - 1, 0), rf: wmInt(c.rf, 0, 100, 0) }; }), au: !(opts && opts.auto === false) };
  W.q[n - 1] = q;
  wmQueueCheck(W, cs || { roster: [] }, n, W.now, events);
  return { ok: true, events: events };
}
