// js/wmap_mob.js — TR2 野怪核心(設計_地形資源與鋪路隊_規格.md 第 2 節;設計_行軍停止與相遇_規格.md 3.1)。純核心:不碰 DOM / localStorage、不讀時間(now 由呼叫端傳)、不用亂數;node 可測。
// 規則(使用者 2026-11-16 決議):每天 3 批,東八區 08:00 / 12:00 / 20:00;每批 9 隻 = 道路 3 隻(永遠 Lv1)+ 野外 6 隻(非資源空地,近 / 中 / 遠層各 2 隻,Lv 1~3 / 4~6 / 7~9);
//   只掉文(銅錢)60 × Lv 與糧(同等級農田 3 小時產量);不占領地格、不算名額;沒打的到下一批消失(不累積);輸了回滿血、留到本批結束;被行程當目標者鎖到那趟結算完。
// 戰鬥方式(使用者 2026-11-16 決議):野怪只能由玩家〔剿匪〕主動攻打(以野怪為目標出征,抵達單場結算,勝:掉落 + 野怪消失,敗:回程);路過野怪格不觸發戰鬥、不阻擋、不改 ETA。抵達時野怪已被打掉或已換批 → 撲空(wmapMobGone)。
// 整合:wd_core.js 的 wdArriveSingle 加 1 個條件呼叫 wmapMobGone;wdHandle 的舊 beast 事件在地圖模式停止生成。
//   wmap_settle.js 的 wmapSettleSync 尾端呼叫 wmapMobSync(對帳:掉落入帳 + 標記已擊殺 + 清舊 pt;冪等,靠 rp.ml 旗標只算一次)。
// 存檔:W.g2.yg = {bk:最近處理的批次, dead:[bk × 16 + 序號 …]}(沿用 world.v2,不新增鍵;wmapSettleNorm 保留)。被鎖的野怪 = 有行程 trip.pt 指向它(由 W.trips 推得,不另存 lk)。
//   行程目標野怪用 W.pts 一筆 cat 'yg'、id = 'y' + bk + '.' + 序號 + '.' + gi(本檔載入時把 'yg' 登錄進 WD_PFX,wdNormPt 才不會丟掉);沒有行程指向的 'yg' 點在對帳時清掉。
// ───────── 本檔依賴的外部介面(對接 wm_gen.js 新 WG.res / WG.rd 時請維持)─────────
//   WG.size WG.cx WG.cy WG.seed WG.k(Uint8Array,5 = 道路、0 = 平地、3 / 4 = 河 / 淺灘)WG.d(Float32Array 主城路徑成本,不可達 = Infinity)WG.zone(0 一般 / 1 城池 / 2 城郊)WG.nodeOf(Int8Array,城池 / 關門道 ≥ 0)
//   wmapInfoOf(gi) → {ty, lv}|null(資源格資訊;有資訊 = 資源格,野怪不放)
//   ※ 層次用 WG.d(近 ≤ 8、中 ≤ 16、遠 ≤ 24);WG.d0(凍結距離)出現後請把 wmapMobLayerOf 改讀 d0(鋪路改了 WG.d 也不影響野怪分層)。
//   WG.rd(鋪的路)出現後:道路候選要加 || rd[gi](見 wmapMobPool 的 TODO)。
//   wd_core:wdRun / wdAssault / wdTripHome / wdTripTurn / wdTripStart / wdPt / wdTrpSet、W.rp、W.trips、W.pts;wm_march.js:wmMarch*;wmap_go.js:wmapGoBackPlan / wmapGoApplyBack / wmapGoPlan / wmapGoSpd / wmapGoFast;wmap_settle.js:wmapSettleG2 / wmapSettleBonus
// ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:wmap_settle.js 之後。全域名一律 wmapMob* / WMOB*。
//
// ───────── 公開 API ─────────
//   WMOB_CFG                                {hours[8,12,20]、tz 8h、road 3、perLayer 2、layers[8,16,24]、gap 3、coinPerLv 60、grainH 3、names、deadKeep}
//   wmapMobBind(WG, infoFn?) / wmapMobWG()  綁定世界(UI 載入時綁 WMAP.WG);沒綁就讀全域 WMAP.WG;都沒有 = 野怪系統關閉(wmapMobOn() = false)
//   wmapMobBatchOf(t) → bk                  t 所屬批次序號(bk = 日序 × 3 + 時段);wmapMobBatchStart(bk) / wmapMobBatchEnd(bk) → 毫秒
//   wmapMobGen(WG, bk, infoFn?) → [{i, kind:'road'|'wild', gi, lv, layer(-1 道路 | 0 近 | 1 中 | 2 遠), key, id, ty}]   該批 9 隻(純函式、同 bk 同結果)
//   wmapMobCoin(lv) / wmapMobGrain(lv)      掉落:文 60 × Lv / 糧 = 同等級農田 3 小時產量;wmapMobLoot(lv) → {coin, grain}
//   wmapMobAlive(W, t, WG?) → mobs[]        t 時刻存在、未被打掉的野怪(加 locked:有行程前往)
//   wmapMobGone(W, pt, t) → bool            抵達時刻 t 該野怪點是否已打掉 / 已換批(撲空判斷)
//   wmapMobAt(W, gi, t) → mob|null          該格的存活野怪
//   wmapMobTarget / wmapMobDispatch(W, cs, team, mob, now, o)   〔剿匪〕 → {ok, reason, trip, pt, plan, events}   以野怪格為目標出征(o = {WG, fast})
//   wmapMobSync(W, cs, now, out)            對帳(wmapSettleSync 尾端呼叫):掉落進 out.credit、標記擊殺、清舊 pt
//   wmapMobNorm(raw) → yg;wmapMobIsPtId(id) / wmapMobParse(id) → {bk, i, gi}|null;wmapMobBrief(rp, size) → {…};wmapMobOn() → bool

var WMOB_CFG = { hours: [8, 12, 20], tz: 8 * 3600000, DAY: 86400000, road: 3, wild: 6, perLayer: 2, layers: [8, 16, 24], gap: 3, coinPerLv: 60, grainH: 3, names: ['流寇', '山賊', '悍匪'], bands: [[1, 3], [4, 6], [7, 9]], deadKeep: 4, scanMax: 6 };
var WMOB = { WG: null, info: null, pool: null, poolKey: null };
if (typeof WD_PFX !== 'undefined' && !WD_PFX.yg) WD_PFX.yg = 'y';   // 讓 wdNormPt 認得 cat 'yg'(存檔往返不丟掉被鎖的野怪點)

function wmapMobBind(WG, infoFn) { WMOB.WG = WG || null; WMOB.info = infoFn || null; WMOB.pool = null; WMOB.poolKey = null; }
function wmapMobWG() { return WMOB.WG || ((typeof WMAP !== 'undefined' && WMAP && WMAP.WG) ? WMAP.WG : null); }
function wmapMobOn() { return !!wmapMobWG(); }
function wmapMobInfo(gi) {
  if (WMOB.info) return WMOB.info(gi);
  return typeof wmapInfoOf === 'function' ? wmapInfoOf(gi) : null;
}

// ───────── 批次時刻 ─────────
function wmapMobBatchOf(t) {
  var C = WMOB_CFG, L = t + C.tz, day = Math.floor(L / C.DAY), h = L - day * C.DAY, s = h >= C.hours[2] * 3600000 ? 2 : (h >= C.hours[1] * 3600000 ? 1 : (h >= C.hours[0] * 3600000 ? 0 : -1));
  return s < 0 ? (day - 1) * 3 + 2 : day * 3 + s;
}
function wmapMobBatchStart(bk) {
  var C = WMOB_CFG, day = Math.floor(bk / 3), s = bk - day * 3;
  return day * C.DAY + C.hours[s] * 3600000 - C.tz;
}
function wmapMobBatchEnd(bk) { return wmapMobBatchStart(bk + 1); }

// ───────── 候選格(每個世界算一次)─────────
function wmapMobSector(dc, dr) { var g = wmHexGround(dc, dr), dx = g.x, dy = g.y; return ((dx >= 0 ? 1 : 0) + (dy >= 0 ? 2 : 0)) * 2 + (Math.abs(dx) >= Math.abs(dy) ? 1 : 0); }   // 8 扇區:(dc, dr) = 相對主城的軸向格差,先轉地面等向座標 (wmHexGround) 再分扇區(六邊形格;確定性,無亂數)
function wmapMobLayerOf(WG, gi) {
  var d = WG.d[gi], L = WMOB_CFG.layers;
  return d <= L[0] ? 0 : (d <= L[1] ? 1 : (d <= L[2] ? 2 : -1));
}
function wmapMobPool(WG, infoFn) {
  var key = WMOB, N = WG.size, n = N * N, road = [], wild = [[], [], []], gi, x, y, k, k2, cx = WG.cx, cy = WG.cy, bad, j, nb, ly, info = infoFn || wmapMobInfo;
  if (WMOB.pool && WMOB.poolKey === WG && !infoFn) return WMOB.pool;
  for (gi = 0; gi < n; gi++) {
    if (!isFinite(WG.d[gi])) continue;
    if (WG.zone && WG.zone[gi]) continue;                     // 城池占地 / 城郊
    if (WG.nodeOf && WG.nodeOf[gi] >= 0) continue;            // 城內 / 關門道
    x = gi % N; y = (gi - x) / N;
    if (wmHexDist(x, y, cx, cy) <= 2) continue;   // 主城 2 格內(六邊形距離)
    k = WG.k[gi];
    if (k === 5) {   // 道路:不含橋(旁邊有河 / 淺灘者視為橋頭,保守排除)
      bad = false; nb = wmHexNbs(gi, N);   // 6 鄰
      for (j = 0; j < nb.length; j++) { k2 = WG.k[nb[j]]; if (k2 === 3 || k2 === 4) bad = true; }
      if (!bad) road.push(gi);
    } else if (k === 0) {   // TODO(TR3):WG.rd 出現後,鋪過路的平地也算道路格(rd[gi] → road)
      if (info(gi)) continue;                                  // 資源格
      ly = wmapMobLayerOf(WG, gi);
      if (ly >= 0) wild[ly].push(gi);
    }
  }
  key = { road: road, wild: wild };
  if (!infoFn) { WMOB.pool = key; WMOB.poolKey = WG; }
  return key;
}

// ───────── 每批 9 隻(確定性)─────────
function wmapMobCheb(a, b, N) { return wmHexDistGi(a, b, N); }   // 沿用舊名;六邊形格距離(wm_hex.js)
function wmapMobKey(bk, i) { return bk * 16 + i; }
function wmapMobId(bk, i, gi) { return 'y' + bk + '.' + i + '.' + gi; }
function wmapMobParse(id) {
  var m = typeof id === 'string' ? /^y(-?\d+)\.(\d+)\.(\d+)$/.exec(id) : null;
  return m ? { bk: +m[1], i: +m[2], gi: +m[3] } : null;
}
function wmapMobIsPtId(id) { return !!wmapMobParse(id); }
function wmapMobNameOf(lv) { return WMOB_CFG.names[lv <= 3 ? 0 : (lv <= 6 ? 1 : 2)]; }
function wmapMobPick(WG, list, bk, slot, taken, secBan) {
  var N = WG.size, t, gi, ok, j, sec, cx = WG.cx, cy = WG.cy, gap, tries = 160;
  if (!list.length) return -1;
  for (t = 0; t < tries; t++) {
    gi = list[wmGenHash(WG.seed, bk, slot * 1009 + t) % list.length];
    gap = t < 100 ? WMOB_CFG.gap : 1;                         // 100 次找不到才放寬間距
    ok = true;
    for (j = 0; j < taken.length; j++) if (taken[j] === gi || wmapMobCheb(taken[j], gi, N) < gap) { ok = false; break; }
    if (ok && secBan !== undefined && t < 60) { sec = wmapMobSector(gi % N - cx, Math.floor(gi / N) - cy); if (sec === secBan) ok = false; }
    if (ok) return gi;
  }
  return list[wmGenHash(WG.seed, bk, slot * 1009 + 777) % list.length];
}
function wmapMobGen(WG, bk, infoFn) {
  var P = wmapMobPool(WG, infoFn), out = [], taken = [], i = 0, ly, s, gi, lv, b, first, N = WG.size, C = WMOB_CFG, secPrev;
  for (s = 0; s < C.road; s++) {
    gi = wmapMobPick(WG, P.road, bk, s, taken);
    if (gi < 0) continue;
    taken.push(gi);
    out.push({ i: i, kind: 'road', gi: gi, lv: 1, layer: -1 });
    i++;
  }
  i = C.road;
  for (ly = 0; ly < 3; ly++) {
    secPrev = undefined;
    for (s = 0; s < C.perLayer; s++) {
      gi = wmapMobPick(WG, P.wild[ly], bk, 10 + ly * 2 + s, taken, secPrev);
      if (gi < 0) { i++; continue; }
      taken.push(gi);
      b = C.bands[ly];
      lv = b[0] + wmGenHash(WG.seed, bk, 5000 + ly * 2 + s) % (b[1] - b[0] + 1);
      out.push({ i: i, kind: 'wild', gi: gi, lv: lv, layer: ly });
      secPrev = wmapMobSector(gi % N - WG.cx, Math.floor(gi / N) - WG.cy);
      i++;
    }
  }
  out.forEach(function (m) { m.bk = bk; m.key = wmapMobKey(bk, m.i); m.id = wmapMobId(bk, m.i, m.gi); m.ty = wmapMobNameOf(m.lv); });
  return out;
}

// ───────── 掉落 ─────────
function wmapMobCoin(lv) { return WMOB_CFG.coinPerLv * lv; }
function wmapMobGrain(lv) {
  var b = typeof wmapSettleBonus === 'function' ? wmapSettleBonus('農田', lv) : null;
  return b && b.grain > 0 ? b.grain : 0;   // 6.6 × GRID_RES.mul[lv-1] × 3 小時(wmapSettleBonus 同口徑)
}
function wmapMobLoot(lv) { return { coin: wmapMobCoin(lv), grain: wmapMobGrain(lv) }; }

// ───────── 存檔 ─────────
function wmapMobNorm(raw) {
  var o = { bk: 0, dead: [] }, i, v;
  if (!raw || typeof raw !== 'object') return o;
  o.bk = typeof raw.bk === 'number' && isFinite(raw.bk) ? Math.floor(raw.bk) : 0;
  if (Array.isArray(raw.dead)) for (i = 0; i < raw.dead.length && o.dead.length < 120; i++) { v = raw.dead[i]; if (typeof v === 'number' && isFinite(v)) o.dead.push(Math.floor(v)); }
  return o;
}
function wmapMobG(W) {
  var g2 = typeof wmapSettleG2 === 'function' ? wmapSettleG2(W) : (W.g2 = (W.g2 && W.g2.own) ? W.g2 : { v: 1, own: {}, n: 0, oh: {} });
  if (!g2.yg || !Array.isArray(g2.yg.dead)) g2.yg = wmapMobNorm(g2.yg);
  return g2.yg;
}
function wmapMobIsDead(W, key) { return wmapMobG(W).dead.indexOf(key) >= 0; }
function wmapMobKill(W, key, bk) {
  var g = wmapMobG(W), lo = bk - WMOB_CFG.deadKeep;
  if (g.dead.indexOf(key) < 0) g.dead.push(key);
  if (bk > g.bk) g.bk = bk;
  g.dead = g.dead.filter(function (k) { return Math.floor(k / 16) >= lo; });
}

// ───────── 查詢 ─────────
function wmapMobLocked(W, id) {
  var i;
  for (i = 0; i < W.trips.length; i++) if (W.trips[i].pt === id) return W.trips[i].id;
  return null;
}
function wmapMobAlive(W, t, WG) {
  WG = WG || wmapMobWG();
  if (!WG) return [];
  return wmapMobGen(WG, wmapMobBatchOf(t)).filter(function (m) { return !wmapMobIsDead(W, m.key); }).map(function (m) { m.locked = !!wmapMobLocked(W, m.id); return m; });
}
function wmapMobAt(W, gi, t) {
  var a = wmapMobAlive(W, t), i;
  for (i = 0; i < a.length; i++) if (a[i].gi === gi) return a[i];
  return null;
}

// ───────── 野怪點(只有被當目標或打的時候才實體化)─────────
function wmapMobMakePt(W, mob) {
  return { id: mob.id, cat: 'yg', ty: mob.ty, lv: mob.lv, mins: 2, nf: 1, fs: wmGenHash(W.seed >>> 0, mob.key, 4242) % 1000000000, act: false, owner: null, guard: null, foeHp: wdNewFoeHp(1), foeT: 0, cl: false, rs: 0 };
}
function wmapMobEnsurePt(W, mob) {
  var pt = wdPt(W, mob.id);
  if (pt) return pt;
  pt = wmapMobMakePt(W, mob);
  W.pts.push(pt);
  return pt;
}

// ───────── 剿匪抵達時野怪是否已不在(wd_core 的 wdArriveSingle 掛鉤)─────────
// 已被打掉或已換批 → 撲空(行程轉回程、報「miss」)。t = 抵達時刻
function wmapMobGone(W, pt, t) {
  var m = wmapMobParse(pt.id);
  if (!m) return true;
  return m.bk !== wmapMobBatchOf(t) || wmapMobIsDead(W, wmapMobKey(m.bk, m.i));
}

// ───────── 以野怪為目標出征 ─────────
function wmapMobTarget(WG, mob) {
  var N = WG.size, cells;
  if (!isFinite(WG.d[mob.gi])) return { ok: false, reason: 'unreach' };
  cells = wmPathCells(WG, mob.gi);
  if (!cells) return { ok: false, reason: 'unreach' };
  return { ok: true, reason: '', kind: 'yg', gi: mob.gi, WG: WG, node: null, cost: WG.d[mob.gi], cells: cells, end: mob.gi, path: wmMarchTurns(cells, N), ty: mob.ty, lv: mob.lv };
}
function wmapMobDispatch(W, cs, team, mob, now, o) {
  o = o || {};
  var WG = o.WG || wmapMobWG(), r = wdRun(W, cs, now), cur, tg, chk, pt, plan, trip;
  if (r.frozen) return { ok: false, reason: 'frozen', events: r.events };
  cur = wmapMobAt(W, mob.gi, now);
  if (!cur || cur.key !== mob.key) return { ok: false, reason: 'gone', events: r.events };
  if (cur.locked) return { ok: false, reason: 'busy', events: r.events };
  tg = wmapMobTarget(WG, cur);
  if (!tg.ok) return { ok: false, reason: tg.reason, events: r.events };
  if (!team || wdTeamTrip(W, team.n)) return { ok: false, reason: 'army', events: r.events };
  chk = wdCheckSlots(W, cs, team.slots, now);
  if (!chk.ok) return { ok: false, reason: chk.reason, events: r.events };
  pt = wmapMobEnsurePt(W, cur);
  plan = wmapGoPlan(W, WG, tg, team, now, o);
  trip = wdTripStart(W, cs, team, pt, null, now, false);
  trip.tArrive = now + plan.goMs;
  trip.mins = Math.max(1, Math.min(60, Math.round(plan.goMs / 60000)));
  trip.path = tg.path; trip.goMs = plan.goMs; trip.backMs = plan.backMs; trip.gi = cur.gi; trip.cost = tg.cost; trip.spd = plan.spd; trip.g2 = 1;
  trip.lg = wmMarchNew({ p: tg.path, size: WG.size, t0: now, M: plan.goMs, g: cur.gi, on: 'fight', hm: 1, b: { p: wmMarchRev(tg.path), M: plan.backMs } });
  return { ok: true, reason: '', trip: trip, pt: pt, plan: plan, events: r.events };
}
// ───────── 對帳(冪等)─────────
function wmapMobSync(W, cs, now, out) {
  var i, rp, p, m, loot, tgt = {}, bkNow = wmapMobBatchOf(now), g = wmapMobG(W), keep;
  for (i = 0; i < W.rp.length; i++) {
    rp = W.rp[i];
    if (rp.cat !== 'yg' || !rp.win || rp.ml) continue;
    m = wmapMobParse(rp.pt);
    if (!m) continue;
    loot = wmapMobLoot(rp.lv);
    rp.ml = { coin: loot.coin };
    if (loot.grain > 0) rp.ml.grain = loot.grain;
    wmapMobKill(W, wmapMobKey(m.bk, m.i), m.bk);
    if (out) {
      out.credit.coin = (out.credit.coin || 0) + loot.coin;
      if (loot.grain > 0) out.credit.grain = (out.credit.grain || 0) + loot.grain;
      out.changed = true;
    }
  }
  for (i = 0; i < W.trips.length; i++) tgt[W.trips[i].pt] = 1;
  keep = W.pts.filter(function (p2) {
    if (p2.cat !== 'yg') return true;
    m = wmapMobParse(p2.id);
    if (!tgt[p2.id] || !m || wmapMobIsDead(W, wmapMobKey(m.bk, m.i))) { if (out) out.changed = true; return false; }
    return true;
  });
  W.pts = keep;
  if (bkNow > g.bk) g.bk = bkNow;
  return out;
}

// ───────── 快報文字 ─────────
function wmapMobBrief(rp, size) {
  var m = wmapMobParse(rp.pt), c = m ? m.gi % size : 0, r = m ? (m.gi - c) / size : 0, head, tone, lines = [];
  if (rp.win) { head = '勝・剿匪成功'; tone = 'win'; } else { head = '敗' + (rp.wipe ? '・全滅,重傷 15 分' : '・撤回'); tone = 'lose'; }
  if (rp.ml && typeof wmapSettleText === 'function') lines.push('掉落 ' + wmapSettleText(rp.ml));
  return { id: rp.id, win: !!rp.win, gi: m ? m.gi : -1, kind: 'yg', title: '(' + c + ',' + r + ') Lv' + rp.lv + ' ' + rp.ptName, head: head, lines: lines, tone: tone, t: rp.t };
}
