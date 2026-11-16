// js/wm_march.js — M1 MS1 行軍純函式(設計_行軍停止與相遇_規格.md 第 1~3 節;設計_M1視覺原型_實作計畫.md W3 / W4)。
// 做什麼:軍隊「現在在哪、算哪一格」由航段 lg(路徑 + 起點偏移 + 起始時刻 + 剩餘毫秒)這個純函式決定;
//        停止 / 繼續 / 改目標 / 撤退 / 閒置到期 / 相遇後改寫,全都只是「產生一個新航段」。純函式:不碰 DOM、不讀時間(now 由呼叫端傳)、不改傳入的 lg,node 可測。
// 整數:時間用整數毫秒、距離用整數千分格(直步 1000、斜步 1414,不用浮點 sqrt);格界用中點規則(d < 中點屬前一格,d >= 中點屬後一格)。
// 命名:全域一律 wmMarch* / WMARCH_*(舊外勤已佔 wm_*.js、WM_CFG、wmNorm…);ES2017,不用 ?. ??;UTF-8 + CRLF。
// 載入順序:不依賴任何檔(WMG_CFG 有就讀 size / goBase / goK / backDiv,沒有用預設);放在 wm_gen.js 之後即可。
//
// ───────── 航段 lg ─────────
//   {k:'mv'|'idle'|'back'|'wait'|'done', v:版本, t0:起點毫秒, p:[gi…轉折點], n:地圖邊長, a0:起點已走距離, L:p 全長, M:整數毫秒(mv / back:a0 走到 L 要多久;idle 不用),
//    w:起步延遲毫秒(交戰停頓,t0~t0+w 原地不動), on:'fight'|'hold'(mv:抵達後做什麼), g:目標 gi, rm:idle 剩餘毫秒, hu:idle 到期時刻,
//    b:{p, a0, L, M}(預先算好的回程段:mv(on:'fight')= 目標回主城;idle = 停止點回主城), bt:idle 時保存原 mv 的 b(繼續時還原), hm:1 = p[0] 就是主城, hd:閒置上限毫秒, fm:抵達交戰毫秒}
//   k:'wait' = 待發(站在 p[0]);k:'done' = 不畫。舊行程沒有 lg → wmMarchLegOf(trip) 現場轉成虛擬航段(存檔不用遷移)。
//
// ───────── 公開 API ─────────
//   WMARCH_CFG                          FIGHT 3000、HOLD 28800000(8h)、HOLD_OUT 7200000(2h,共享世界補給外)、CMD_GAP 5000、RESUME_MIN 1000、STEP 1000、DIAG 1414、BACK_DIV 4、ENC_GRACE 5000
//   wmMarchExpand(p, size) → {cells, D, cs, rs, dirs, L}   路徑逐格展開(快取在 p 陣列上,WeakMap)
//   wmMarchNew(o) → lg                  建新 mv 航段 o = {p, size, t0, M, g, on, hold, b:{p, M, a0?}, hm, v, w, fm}(L / b.L 自動算)
//   wmMarchLegOf(trip, size) → lg       trip.lg 優先;舊行程(path / t0 / goMs / backMs / state)轉虛擬航段
//   wmMarchAt(trip|lg, t, size) → st    {k, phase:'wait'|'go'|'fight'|'idle'|'back'|'done', seg, d, i(所屬格在 cells 的索引), gi(所屬格), c, r(格座標浮點), dir, mir, dc, dr, moving, X}
//   wmMarchCellAt(trip|lg, t) → gi | -1 此刻算哪一格(中點規則)
//   wmMarchPose(trip, t, o) → pose      與 wmapArmyPose 同形狀 {vis, phase, c, r, dir, mir, alpha, rolled, moving, dc, dr} + idle / gi;o = {size, q}
//   wmMarchEta(lg) → 毫秒              mv 抵達目標時刻(t0 + w + M)
//   wmMarchEnd(lg) → 毫秒|Infinity     整條鏈走完(回到主城)的時刻
//   wmMarchCut(seg, d, size) → {i, gi, other, a0, edge}    截段規則:所屬格 + 另一端 + 另一端到停止點距離
//   wmMarchStop(lg, now, o) / wmMarchResume(lg, now, o) / wmMarchRedirect(lg, now, o) / wmMarchRetreat(lg, now, o) → {ok, leg, err, cancel?}
//   wmMarchRetreatMins(cost, spd) → 分鐘   撤退公式 (1 + 0.375 × cost × spd) / 4(不夾值)
//   wmMarchOutcome(lg, tm, won, o) → {ok, leg}   相遇後改寫:勝方 mv 的 ETA 往後推 FIGHT、idle 續留;敗方 back(w = FIGHT)
//   wmMarchCells(lg) → [{gi, tIn, tOut, i}]   占格區間表(半開 [tIn, tOut);只含 mv 去程 / 交戰停頓 / 閒置,back 不在內)
//   wmMarchEncList(units, o) → 事件[]  units = [{id, s(席位), gd(公會,可空), leg}];事件 = {tm, g, def, atk, kind:'cell'|'swap'};依 tm / g / id 排序,與輸入順序無關
//   wmMarchEncFirst(units, o) → 事件|null
//   錯誤碼 err:'notmoving' 'notidle' 'cooldown' 'expired' 'route' 'needback' 'bad'
//
// 相遇引擎範圍:只做「找出相遇事件」(wmMarchEncList / wmMarchEncFirst)與「相遇後改寫航段」(wmMarchOutcome);
//   TODO(NE 系列):戰鬥結算、hp 延續、連打、事件迴圈(結算後重算受影響的隊)、arb 仲裁與 x/$eid 紀錄。

var WMARCH_CFG = { FIGHT: 3000, HOLD: 28800000, HOLD_OUT: 7200000, CMD_GAP: 5000, RESUME_MIN: 1000, STEP: 1000, DIAG: 1414, BACK_DIV: 4, ENC_GRACE: 5000 };
var WMARCH_CACHE = (typeof WeakMap === 'function') ? new WeakMap() : null;
var WMARCH_VCACHE = (typeof WeakMap === 'function') ? new WeakMap() : null;

// ───────── 整數除法(結果精確,不受浮點誤差影響)─────────
function wmMarchFloorDiv(a, b) { var q = Math.floor(a / b); while (q * b > a) q--; while ((q + 1) * b <= a) q++; return q; }
function wmMarchCeilDiv(a, b) { var q = Math.ceil(a / b); while (q * b < a) q++; while ((q - 1) * b >= a) q--; return q; }
function wmMarchSize(n) { return n > 0 ? n : ((typeof WMG_CFG !== 'undefined' && WMG_CFG.size) ? WMG_CFG.size : 64); }

// ───────── 方向(同 wmapArmyDirOf,本檔自備以免依賴)─────────
function wmMarchDirOf(dc, dr, prevMir) {
  var ac = Math.abs(dc), ar = Math.abs(dr), sc, sr, pm = prevMir ? 1 : 0;
  sc = ac < ar * 0.5 ? 0 : (dc > 0 ? 1 : -1);
  sr = ar < ac * 0.5 ? 0 : (dr > 0 ? 1 : -1);
  if (sc === 1 && sr === 0) return { dir: 0, mir: 0 };
  if (sc === 0 && sr === 1) return { dir: 0, mir: 1 };
  if (sc === -1 && sr === 0) return { dir: 1, mir: 1 };
  if (sc === 0 && sr === -1) return { dir: 1, mir: 0 };
  if (sc === 1 && sr === 1) return { dir: 0, mir: pm };
  if (sc === -1 && sr === -1) return { dir: 1, mir: pm };
  if (sc === 1 && sr === -1) return { dir: 0, mir: 0 };
  if (sc === -1 && sr === 1) return { dir: 0, mir: 1 };
  return { dir: 0, mir: pm };
}

// ───────── 路徑展開(整數千分格)─────────
function wmMarchExpand(p, size) {
  var hit = WMARCH_CACHE && p && WMARCH_CACHE.get(p), X, cells, cs, rs, D, dirs, k, cur, tg, cx, cy, tx, ty, dx, dy, st, i, pm, dc, dr, ln, d0;
  if (hit && hit.size === size) return hit.X;
  cells = [p[0]]; cs = [p[0] % size]; rs = [(p[0] - p[0] % size) / size]; D = [0];
  for (k = 1; k < p.length; k++) {
    cur = p[k - 1]; tg = p[k];
    cx = cur % size; cy = (cur - cx) / size; tx = tg % size; ty = (tg - tx) / size;
    while (cx !== tx || cy !== ty) {
      dx = tx > cx ? 1 : (tx < cx ? -1 : 0); dy = ty > cy ? 1 : (ty < cy ? -1 : 0);
      if (dx && dy && Math.abs(tx - cx) !== Math.abs(ty - cy)) { if (Math.abs(tx - cx) > Math.abs(ty - cy)) dy = 0; else dx = 0; }
      cx += dx; cy += dy;
      st = (dx && dy) ? WMARCH_CFG.DIAG : WMARCH_CFG.STEP;
      cells.push(cy * size + cx); cs.push(cx); rs.push(cy); D.push(D[D.length - 1] + st);
    }
  }
  dirs = []; pm = 0; d0 = { dir: 0, mir: 0, dc: 1, dr: 0 };
  for (i = 0; i + 1 < cells.length; i++) {
    dc = cs[i + 1] - cs[i]; dr = rs[i + 1] - rs[i]; ln = Math.sqrt(dc * dc + dr * dr);
    d0 = wmMarchDirOf(dc, dr, pm); pm = d0.mir;
    d0 = { dir: d0.dir, mir: d0.mir, dc: dc / ln, dr: dr / ln }; dirs.push(d0);
  }
  X = { cells: cells, D: D, cs: cs, rs: rs, dirs: dirs, L: D[D.length - 1], last: dirs.length ? dirs[dirs.length - 1] : { dir: 0, mir: 0, dc: 1, dr: 0 } };
  if (WMARCH_CACHE && p) WMARCH_CACHE.set(p, { size: size, X: X });
  return X;
}
function wmMarchLenOf(p, size) { return wmMarchExpand(p, size).L; }
function wmMarchRev(p) { return p.slice().reverse(); }
// 逐格(cells)壓成轉折點
function wmMarchTurns(cells, size) {
  var out, i, dx0, dy0, dx1, dy1;
  if (cells.length <= 2) return cells.slice();
  out = [cells[0]];
  dx0 = (cells[1] % size) - (cells[0] % size); dy0 = Math.floor(cells[1] / size) - Math.floor(cells[0] / size);
  for (i = 1; i < cells.length - 1; i++) {
    dx1 = (cells[i + 1] % size) - (cells[i] % size); dy1 = Math.floor(cells[i + 1] / size) - Math.floor(cells[i] / size);
    if (dx1 !== dx0 || dy1 !== dy0) out.push(cells[i]);
    dx0 = dx1; dy0 = dy1;
  }
  out.push(cells[cells.length - 1]);
  return out;
}

// ───────── 位置 / 格子歸屬 ─────────
// 本航段在 t 時刻沿 p 走了多遠:d(t) = a0 + floor((t − t0 − w) × (L − a0) / M),夾在 [a0, L]
function wmMarchDistOf(seg, t) {
  var el = t - seg.t0 - (seg.w || 0), span = seg.L - seg.a0;
  if (el <= 0) return seg.a0;
  if (!(seg.M > 0) || el >= seg.M) return seg.L;
  return seg.a0 + wmMarchFloorDiv(el * span, seg.M);
}
// d 所在邊索引 j:D[j] <= d < D[j+1](d >= L 回最後一格索引)
function wmMarchEdgeIdx(X, d) {
  var lo = 0, hi = X.D.length - 1, m;
  if (d >= X.L) return hi;
  while (hi - lo > 1) { m = (lo + hi) >> 1; if (X.D[m] <= d) lo = m; else hi = m; }
  return lo;
}
// 所屬格索引(中點規則:d < 中點屬 X,d >= 中點屬 Y)
function wmMarchOwnerIdx(X, d) {
  var j = wmMarchEdgeIdx(X, d);
  if (j >= X.cells.length - 1) return X.cells.length - 1;
  return (d < (X.D[j] + X.D[j + 1]) / 2) ? j : j + 1;
}
// 進入第 i 格的時刻(i >= 1;須 i 的前一個中點 > a0):t0 + w + ceil((mid − a0) × M / (L − a0))
function wmMarchTin(seg, X, i) {
  var mid = (X.D[i - 1] + X.D[i]) / 2;
  return seg.t0 + (seg.w || 0) + wmMarchCeilDiv((mid - seg.a0) * seg.M, seg.L - seg.a0);
}

// ───────── 舊行程 → 虛擬航段 ─────────
function wmMarchNew(o) {
  var size = wmMarchSize(o.size), L = wmMarchLenOf(o.p, size), b = null, leg;
  if (o.b) b = { p: o.b.p, a0: o.b.a0 || 0, L: wmMarchLenOf(o.b.p, size), M: o.b.M };
  leg = { k: 'mv', v: o.v | 0, t0: o.t0, p: o.p, n: size, a0: o.a0 || 0, L: L, M: o.M, w: o.w || 0, on: o.on || 'fight', g: o.g !== undefined ? o.g : o.p[o.p.length - 1] };
  if (b) leg.b = b;
  if (o.hm) leg.hm = 1;
  if (o.hold) leg.hd = o.hold;
  if (o.fm !== undefined) leg.fm = o.fm;
  return leg;
}
function wmMarchLegOf(trip, size) {
  var key, c, st, p, leg, sz;
  if (trip.lg) return trip.lg;
  sz = wmMarchSize(size);
  p = trip.path; st = trip.state || 'go';
  key = [sz, st, trip.t0, trip.goMs, trip.backMs, trip.fightMs, p ? p.length : 0].join('|');
  c = WMARCH_VCACHE && WMARCH_VCACHE.get(trip);
  if (c && c.key === key && c.p === p) return c.leg;
  if (!p || !p.length || st === 'done') leg = { k: 'done', v: 0, t0: 0, p: p || [0], n: sz, a0: 0, L: 0, M: 0 };
  else if (st === 'wait') leg = { k: 'wait', v: 0, t0: trip.t0 || 0, p: p, n: sz, a0: 0, L: wmMarchLenOf(p, sz), M: 0 };
  else if (st === 'back') leg = { k: 'back', v: 0, t0: trip.t0 || 0, p: wmMarchRev(p), n: sz, a0: 0, L: wmMarchLenOf(p, sz), M: trip.backMs || 0, w: 0 };
  else {
    leg = wmMarchNew({ p: p, size: sz, t0: trip.t0 || 0, M: trip.goMs || 0, on: 'fight', hm: 1, fm: trip.fightMs !== undefined ? trip.fightMs : ((typeof WMAP_ARMY_CFG !== 'undefined' && WMAP_ARMY_CFG.fightMs !== undefined) ? WMAP_ARMY_CFG.fightMs : WMARCH_CFG.FIGHT),
      b: { p: wmMarchRev(p), M: trip.backMs || 0 } });
  }
  if (WMARCH_VCACHE) WMARCH_VCACHE.set(trip, { key: key, p: p, leg: leg });
  return leg;
}

// ───────── 航段鏈:此刻處於哪一段、什麼階段 ─────────
function wmMarchBackSeg(base, b, t0) {
  var sz = base.n;
  return { k: 'back', v: base.v, t0: t0, p: b.p, n: sz, a0: b.a0 || 0, L: b.L !== undefined ? b.L : wmMarchLenOf(b.p, sz), M: b.M, w: 0, hm: 0 };
}
function wmMarchFm(leg) { return leg.fm !== undefined ? leg.fm : WMARCH_CFG.FIGHT; }
function wmMarchHold(leg) { return leg.hd || WMARCH_CFG.HOLD; }
// 回 {phase, seg, d}(seg = 此刻所處的實際航段,d = 沿 seg.p 的距離)
function wmMarchSegAt(leg, t) {
  var tA, fm, idle, bk;
  if (leg.k === 'done') return { phase: 'done', seg: leg, d: 0 };
  if (leg.k === 'wait') return { phase: 'wait', seg: leg, d: 0 };
  if (leg.k === 'back') {
    if (t < leg.t0) return { phase: 'wait', seg: leg, d: leg.a0 };
    if (t < leg.t0 + (leg.w || 0)) return { phase: 'fight', seg: leg, d: leg.a0 };
    if (t >= leg.t0 + (leg.w || 0) + leg.M) return { phase: 'done', seg: leg, d: leg.L };
    return { phase: 'back', seg: leg, d: wmMarchDistOf(leg, t) };
  }
  if (leg.k === 'idle') {
    if (t < leg.hu) return { phase: 'idle', seg: leg, d: leg.a0 };
    if (!leg.b) return { phase: 'done', seg: leg, d: leg.a0 };
    return wmMarchSegAt(wmMarchBackSeg(leg, leg.b, leg.hu), t);
  }
  // mv
  if (t < leg.t0) return { phase: 'wait', seg: leg, d: leg.a0 };
  tA = leg.t0 + (leg.w || 0) + leg.M;
  if (t < leg.t0 + (leg.w || 0)) return { phase: 'fight', seg: leg, d: leg.a0 };
  if (t < tA) return { phase: 'go', seg: leg, d: wmMarchDistOf(leg, t) };
  if (leg.on === 'hold') {
    idle = { k: 'idle', v: leg.v, t0: tA, p: leg.p, n: leg.n, a0: leg.L, L: leg.L, M: 0, w: 0, g: leg.g, hu: tA + wmMarchHold(leg), b: leg.b };
    return wmMarchSegAt(idle, t);
  }
  fm = wmMarchFm(leg);
  if (t < tA + fm) return { phase: 'fight', seg: leg, d: leg.L };
  if (!leg.b) return { phase: 'done', seg: leg, d: leg.L };
  bk = wmMarchBackSeg(leg, leg.b, tA + fm);
  return wmMarchSegAt(bk, t);
}
function wmMarchAt(tripOrLeg, t, size) {
  var leg = tripOrLeg.k ? tripOrLeg : wmMarchLegOf(tripOrLeg, size), s = wmMarchSegAt(leg, t), seg = s.seg, sz = wmMarchSize(seg.n), X = wmMarchExpand(seg.p, sz), d = s.d, j, i, e, fx, A, out;
  j = wmMarchEdgeIdx(X, d); i = wmMarchOwnerIdx(X, d);
  if (X.cells.length === 1 || j >= X.cells.length - 1) { A = { c: X.cs[X.cells.length - 1], r: X.rs[X.cells.length - 1] }; e = X.dirs.length ? X.dirs[X.dirs.length - 1] : X.last; }
  else {
    fx = (d - X.D[j]) / (X.D[j + 1] - X.D[j]);
    A = { c: X.cs[j] + (X.cs[j + 1] - X.cs[j]) * fx, r: X.rs[j] + (X.rs[j + 1] - X.rs[j]) * fx }; e = X.dirs[j];
  }
  out = { k: seg.k, phase: s.phase, seg: seg, d: d, i: i, gi: X.cells[i], c: A.c, r: A.r, dir: e.dir, mir: e.mir, dc: e.dc, dr: e.dr, moving: s.phase === 'go' || s.phase === 'back', X: X };
  return out;
}
function wmMarchCellAt(tripOrLeg, t, size) {
  var s = wmMarchAt(tripOrLeg, t, size);
  return (s.phase === 'done' || s.phase === 'wait') ? -1 : s.gi;
}
function wmMarchEta(leg) { return leg.t0 + (leg.w || 0) + leg.M; }
function wmMarchEnd(leg) {
  var tA;
  if (leg.k === 'done' || leg.k === 'wait') return Infinity;
  if (leg.k === 'back') return leg.t0 + (leg.w || 0) + leg.M;
  if (leg.k === 'idle') return leg.b ? leg.hu + leg.b.M : Infinity;
  tA = wmMarchEta(leg);
  if (leg.on === 'hold') return leg.b ? tA + wmMarchHold(leg) + leg.b.M : Infinity;
  return leg.b ? tA + wmMarchFm(leg) + leg.b.M : Infinity;
}

// ───────── 與 wmapArmyPose 相容的位姿 ─────────
function wmMarchPose(trip, now, o) {
  o = o || {};
  var size = wmMarchSize(o.size), q = o.q || 'mid', t = q === 'low' ? Math.floor(now / 1000) * 1000 : now, leg = wmMarchLegOf(trip, size), s, ba;
  var out = { vis: false, phase: 'done', c: 0, r: 0, dir: 0, mir: 0, alpha: 1, rolled: false, moving: false, dc: 1, dr: 0, gi: -1 };
  s = wmMarchAt(leg, t, size);
  if (s.phase === 'done') return out;
  ba = (typeof WMAP_ARMY_CFG !== 'undefined' && WMAP_ARMY_CFG.backAlpha !== undefined) ? WMAP_ARMY_CFG.backAlpha : 0.6;
  out.vis = true; out.phase = s.phase; out.c = s.c; out.r = s.r; out.dir = s.dir; out.mir = s.mir; out.dc = s.dc; out.dr = s.dr; out.moving = s.moving; out.gi = s.gi;
  if (s.phase === 'back') { out.rolled = true; out.alpha = ba; }
  else if (s.seg.k === 'back' && s.phase === 'fight') { out.rolled = true; out.alpha = ba; }
  return out;
}

// ───────── 截段規則 ─────────
// d 落在 X→Y 之間:所屬格 o;另一端 other = 與所屬格相鄰、停止點在其間的那一格;a0 = 另一端到停止點的距離;edge = 該邊長
function wmMarchCut(seg, d, size) {
  var X = wmMarchExpand(seg.p, wmMarchSize(size || seg.n)), o = wmMarchOwnerIdx(X, d), n = X.cells.length;
  if (d >= X.D[o]) {
    if (o + 1 < n) return { i: o, gi: X.cells[o], other: X.cells[o + 1], a0: X.D[o + 1] - d, edge: X.D[o + 1] - X.D[o] };
    return { i: o, gi: X.cells[o], other: -1, a0: 0, edge: 0 };
  }
  return { i: o, gi: X.cells[o], other: X.cells[o - 1], a0: d - X.D[o - 1], edge: X.D[o] - X.D[o - 1] };
}
// 由截段資訊 + 所屬格出發的 route(轉折點,route[0] 必須 === 所屬格)組出新路徑與 a0;失敗回 null
function wmMarchSplice(cut, route) {
  if (!route || !route.length || route[0] !== cut.gi) return null;
  if (cut.other < 0) return { p: route.slice(), a0: 0 };
  if (route.length >= 2 && route[1] === cut.other) return { p: [cut.gi].concat(route.slice(1)), a0: cut.edge - cut.a0 };   // 路線本來就走回另一端:直接往回走,不繞所屬格
  return { p: [cut.other].concat(route), a0: cut.a0 };
}
function wmMarchCmdOk(leg, now, force) {
  if (!force && leg.v > 0 && now < leg.t0 + WMARCH_CFG.CMD_GAP) return false;
  return true;
}
function wmMarchRetreatMins(cost, spd) {
  var c = (typeof WMG_CFG !== 'undefined') ? WMG_CFG : { goBase: 1, goK: 0.375 }, s = typeof spd === 'string' ? ((typeof WMG_CFG !== 'undefined' && WMG_CFG.spd) ? WMG_CFG.spd[spd] : 1) : spd;
  if (!(s > 0)) s = 1;
  cost = Number(cost); if (!isFinite(cost) || cost < 0) cost = 0;
  return (c.goBase + c.goK * cost * s) / (WMARCH_CFG.BACK_DIV);
}

// 預設回程段(只適用 hm:1 的原始航段;改過目標的航段必須由呼叫端用 Dijkstra 提供 o.back):停止點沿原路回主城,速度 = 去程速度 ÷ BACK_DIV
function wmMarchBackFallback(seg, cut, size) {
  var X, route, sp, dist, M;
  if (!seg.hm) return null;
  X = wmMarchExpand(seg.p, size);
  route = wmMarchTurns(X.cells.slice(0, cut.i + 1).reverse(), size);
  sp = wmMarchSplice(cut, route);
  if (!sp) return null;
  dist = wmMarchLenOf(sp.p, size) - sp.a0;
  M = seg.M > 0 && seg.L > seg.a0 ? wmMarchCeilDiv(dist * seg.M, (seg.L - seg.a0) * WMARCH_CFG.BACK_DIV) : 0;
  return { p: sp.p, a0: sp.a0, L: wmMarchLenOf(sp.p, size), M: M };
}

// ───────── 指令 ─────────
function wmMarchErr(err) { return { ok: false, err: err }; }
// 停止:mv 行進中 → idle。o = {hold(上限毫秒), back(預先算好的 {p,a0,L,M}), force(略過冷卻)}
function wmMarchStop(leg, now, o) {
  o = o || {};
  var s = wmMarchAt(leg, now), seg = s.seg, size = wmMarchSize(seg.n), cut, back, hold, idle;
  if (s.phase !== 'go' || seg.k !== 'mv') return wmMarchErr('notmoving');
  if (!wmMarchCmdOk(seg, now, o.force)) return wmMarchErr('cooldown');
  cut = wmMarchCut(seg, s.d, size);
  if (seg.hm && cut.i === 0) return { ok: true, cancel: true, cut: cut };   // 停在主城格:取消出征,直接回城
  back = o.back ? { p: o.back.p, a0: o.back.a0 || 0, L: o.back.L !== undefined ? o.back.L : wmMarchLenOf(o.back.p, size), M: o.back.M } : wmMarchBackFallback(seg, cut, size);
  if (!back) return wmMarchErr('needback');
  hold = o.hold || wmMarchHold(seg);
  idle = { k: 'idle', v: (seg.v | 0) + 1, t0: now, p: seg.p, n: size, a0: s.d, L: seg.L, M: 0, w: 0, on: seg.on, g: seg.g, rm: wmMarchEta(seg) - now, hu: now + hold, b: back };
  if (seg.b) idle.bt = seg.b;
  if (seg.hm) idle.hm = 1;
  if (seg.hd) idle.hd = seg.hd;
  if (seg.fm !== undefined) idle.fm = seg.fm;
  return { ok: true, leg: idle, cut: cut };
}
// 繼續:idle → mv(同路徑、同目標、a0 不變、M = rm → ETA 不變)
function wmMarchResume(leg, now, o) {
  o = o || {};
  if (leg.k !== 'idle' || now >= leg.hu) return wmMarchErr(leg.k === 'idle' ? 'expired' : 'notidle');
  if (!wmMarchCmdOk(leg, now, o.force)) return wmMarchErr('cooldown');
  var mv = { k: 'mv', v: leg.v + 1, t0: now, p: leg.p, n: leg.n, a0: leg.a0, L: leg.L, M: Math.max(leg.rm, WMARCH_CFG.RESUME_MIN), w: 0, on: leg.on, g: leg.g };
  if (leg.bt) mv.b = leg.bt;
  if (leg.hm) mv.hm = 1;
  if (leg.hd) mv.hd = leg.hd;
  if (leg.fm !== undefined) mv.fm = leg.fm;
  return { ok: true, leg: mv };
}
// 改目標:mv 行進中或 idle → mv(截段 + o.route)。o = {route(所屬格 → 新目標的轉折點,由呼叫端 Dijkstra), M(毫秒,wmGoMins 算好), g, on, back(新目標回主城 {p, M}), hold, force}
function wmMarchRedirect(leg, now, o) {
  o = o || {};
  var s = wmMarchAt(leg, now), seg = s.seg, size = wmMarchSize(seg.n), cut, sp, mv, b;
  if (!((s.phase === 'go' && seg.k === 'mv') || s.phase === 'idle')) return wmMarchErr('notmoving');
  if (!wmMarchCmdOk(seg, now, o.force)) return wmMarchErr('cooldown');
  cut = wmMarchCut(seg, s.d, size);
  sp = wmMarchSplice(cut, o.route);
  if (!sp || !(o.M >= 0)) return wmMarchErr('route');
  mv = { k: 'mv', v: (seg.v | 0) + 1, t0: now, p: sp.p, n: size, a0: sp.a0, L: wmMarchLenOf(sp.p, size), M: Math.max(o.M, WMARCH_CFG.RESUME_MIN), w: 0, on: o.on || seg.on || 'fight', g: o.g !== undefined ? o.g : sp.p[sp.p.length - 1] };
  if (o.back) { b = { p: o.back.p, a0: o.back.a0 || 0, M: o.back.M }; b.L = o.back.L !== undefined ? o.back.L : wmMarchLenOf(b.p, size); mv.b = b; }
  if (o.hold) mv.hd = o.hold; else if (seg.hd) mv.hd = seg.hd;
  if (seg.fm !== undefined) mv.fm = seg.fm;
  return { ok: true, leg: mv, cut: cut };
}
// 撤退:mv 行進中或 idle → back。o = {route(所屬格 → 主城轉折點)| 省略則 hm 航段用原路, M(毫秒,wmMarchRetreatMins × 60000 取整)| 省略則依速度比例, w(起步延遲,相遇戰敗用 FIGHT), force}
function wmMarchRetreat(leg, now, o) {
  o = o || {};
  var s = wmMarchAt(leg, now), seg = s.seg, size = wmMarchSize(seg.n), cut, sp, bk, fb, M, w = o.w || 0;
  if (!((s.phase === 'go' && seg.k === 'mv') || s.phase === 'idle')) return wmMarchErr('notmoving');
  if (!wmMarchCmdOk(seg, now, o.force)) return wmMarchErr('cooldown');
  cut = wmMarchCut(seg, s.d, size);
  if (seg.hm && cut.i === 0) return { ok: true, cancel: true, cut: cut };
  if (o.route) {
    sp = wmMarchSplice(cut, o.route);
    if (!sp) return wmMarchErr('route');
    M = o.M;
    if (!(M >= 0)) return wmMarchErr('route');
    bk = { p: sp.p, a0: sp.a0, L: wmMarchLenOf(sp.p, size), M: M };
  } else {
    fb = seg.k === 'idle' ? seg.b : null;                                   // idle 已預先算好從停止點回主城
    if (!fb) fb = wmMarchBackFallback(seg, cut, size);
    if (!fb) return wmMarchErr('needback');
    bk = { p: fb.p, a0: fb.a0, L: fb.L, M: o.M >= 0 ? o.M : fb.M };
  }
  return { ok: true, leg: { k: 'back', v: (seg.v | 0) + 1, t0: now, p: bk.p, n: size, a0: bk.a0, L: bk.L, M: bk.M, w: w }, cut: cut };
}

// ───────── 相遇後改寫(雙方各呼叫一次)─────────
// won = true:mv → 同路徑,t0 = tm,w = FIGHT(+ 原本還沒演完的停頓),M 縮短 → ETA = 原 ETA + FIGHT;idle → 續留(t0 = tm)
// won = false:撤退成 back(w = FIGHT),o.route / o.M 同 wmMarchRetreat
function wmMarchOutcome(leg, tm, won, o) {
  o = o || {};
  var s = wmMarchAt(leg, tm), seg = s.seg, fm = o.fight !== undefined ? o.fight : WMARCH_CFG.FIGHT, tA, ws, r, nl;
  if (s.phase === 'idle') {
    if (won) { nl = {}; for (r in seg) nl[r] = seg[r]; nl.v = (seg.v | 0) + 1; nl.t0 = tm; return { ok: true, leg: nl }; }
    r = wmMarchRetreat(seg, tm, { route: o.route, M: o.M, w: fm, force: true });
    return r;
  }
  if (!((s.phase === 'go' || s.phase === 'fight') && seg.k === 'mv')) return wmMarchErr('notmoving');
  if (won) {
    tA = wmMarchEta(seg); ws = seg.t0 + (seg.w || 0);
    nl = {}; for (r in seg) nl[r] = seg[r];
    nl.v = (seg.v | 0) + 1; nl.t0 = tm; nl.a0 = s.d;
    nl.w = fm + Math.max(0, ws - tm); nl.M = tA - Math.max(tm, ws);
    return { ok: true, leg: nl };
  }
  return wmMarchRetreat(seg, tm, { route: o.route, M: o.M, w: fm, force: true });
}

// ───────── 占格區間表 / 相遇 ─────────
function wmMarchCells(leg) {
  var out = [], seg = leg, X, s, sz, i, last, tA, tin, prev, hu;
  if (seg.k === 'idle') {
    sz = wmMarchSize(seg.n); X = wmMarchExpand(seg.p, sz); i = wmMarchOwnerIdx(X, seg.a0);
    return seg.hu > seg.t0 ? [{ gi: X.cells[i], tIn: seg.t0, tOut: seg.hu, i: i }] : [];
  }
  if (seg.k !== 'mv') return out;
  sz = wmMarchSize(seg.n); X = wmMarchExpand(seg.p, sz); s = wmMarchOwnerIdx(X, seg.a0); last = X.cells.length - 1; tA = wmMarchEta(seg);
  prev = seg.t0;
  if (!(seg.L > seg.a0) || !(seg.M > 0)) {
    out.push({ gi: X.cells[s], tIn: seg.t0, tOut: tA, i: s });
  } else {
    for (i = s + 1; i <= last; i++) {
      tin = wmMarchTin(seg, X, i);
      if (tin > prev) out.push({ gi: X.cells[i - 1], tIn: prev, tOut: tin, i: i - 1 });
      prev = tin;
    }
    out.push({ gi: X.cells[last], tIn: prev, tOut: tA, i: last });
  }
  if (seg.on === 'hold') {   // 抵達後閒置:最後一格延長到 hu
    hu = tA + wmMarchHold(seg);
    out[out.length - 1].tOut = hu;
  }
  return out.filter(function (c) { return c.tOut > c.tIn; });
}
function wmMarchHostile(a, b) { return a.s !== b.s && !(a.gd && a.gd === b.gd); }
function wmMarchHostile2(ua, ub) { return wmMarchHostile(ua, ub); }
function wmMarchStrCmp(a, b) { a = String(a); b = String(b); return a < b ? -1 : (a > b ? 1 : 0); }
// 同毫秒決勝:① 已停著者為守方 ② t0 較早 ③ 席位字串小 ④ 隊號小;回 < 0 = a 為守方
function wmMarchDefCmp(ua, sa, ub, sb) {
  if (sa !== sb) return sa ? -1 : 1;
  if (ua.leg.t0 !== ub.leg.t0) return ua.leg.t0 < ub.leg.t0 ? -1 : 1;
  var c = wmMarchStrCmp(ua.s, ub.s);
  if (c) return c;
  return wmMarchStrCmp(ua.id, ub.id);
}
function wmMarchEvCmp(a, b) {
  if (a.tm !== b.tm) return a.tm < b.tm ? -1 : 1;
  if (a.g !== b.g) return a.g < b.g ? -1 : 1;
  var c = wmMarchStrCmp(a.def.id, b.def.id) || wmMarchStrCmp(a.atk.id, b.atk.id);
  if (c) return c;
  return a.kind < b.kind ? -1 : (a.kind > b.kind ? 1 : 0);
}
// o = {hostile(ua, ub), skip(ev)(新手保護等:回 true 略過此事件)}
function wmMarchEncList(units, o) {
  o = o || {};
  var hostile = o.hostile || wmMarchHostile2, buckets = {}, trans = {}, evs = [], items = [], ui, ci, occ, it, k, arr, a, b, tm, def, atk, key, first, other, cmp;
  for (ui = 0; ui < units.length; ui++) {
    occ = wmMarchCells(units[ui].leg);
    for (ci = 0; ci < occ.length; ci++) {
      it = { u: units[ui], gi: occ[ci].gi, tIn: occ[ci].tIn, tOut: occ[ci].tOut, st: units[ui].leg.k === 'idle' || (occ[ci].tIn === units[ui].leg.t0 && (units[ui].leg.v | 0) > 0) || (units[ui].leg.on === 'hold' && occ[ci].tIn >= wmMarchEta(units[ui].leg)) };
      (buckets[it.gi] || (buckets[it.gi] = [])).push(it);
      if (ci > 0 && occ[ci - 1].tOut === occ[ci].tIn && occ[ci - 1].gi !== occ[ci].gi) {   // 換格紀錄(對穿邊用)
        key = occ[ci - 1].gi + '>' + occ[ci].gi + '@' + occ[ci].tIn;
        (trans[key] || (trans[key] = [])).push({ u: units[ui], from: occ[ci - 1], st: units[ui].leg.k === 'idle' });
      }
    }
  }
  for (k in buckets) {
    arr = buckets[k];
    for (a = 0; a < arr.length; a++) for (b = a + 1; b < arr.length; b++) {
      if (arr[a].u === arr[b].u || !hostile(arr[a].u, arr[b].u)) continue;
      if (!(arr[a].tIn < arr[b].tOut && arr[b].tIn < arr[a].tOut)) continue;
      tm = Math.max(arr[a].tIn, arr[b].tIn);
      if (arr[a].tIn !== arr[b].tIn) { first = arr[a].tIn < arr[b].tIn ? arr[a] : arr[b]; other = first === arr[a] ? arr[b] : arr[a]; def = first.u; atk = other.u; }
      else { cmp = wmMarchDefCmp(arr[a].u, arr[a].st, arr[b].u, arr[b].st); def = cmp < 0 ? arr[a].u : arr[b].u; atk = cmp < 0 ? arr[b].u : arr[a].u; }
      evs.push({ tm: tm, g: arr[a].gi, def: def, atk: atk, kind: 'cell' });
    }
  }
  for (key in trans) {   // 對穿同一條邊:A: X→Y、B: Y→X 在同一毫秒換格
    var m = /^(\d+)>(\d+)@(\d+)$/.exec(key), rkey, ra, i1, i2;
    if (!m || Number(m[1]) > Number(m[2])) continue;
    rkey = m[2] + '>' + m[1] + '@' + m[3]; ra = trans[rkey];
    if (!ra) continue;
    for (i1 = 0; i1 < trans[key].length; i1++) for (i2 = 0; i2 < ra.length; i2++) {
      a = trans[key][i1]; b = ra[i2];
      if (a.u === b.u || !hostile(a.u, b.u)) continue;
      cmp = wmMarchDefCmp(a.u, a.st, b.u, b.st);
      def = cmp < 0 ? a : b; atk = cmp < 0 ? b : a;
      evs.push({ tm: Number(m[3]), g: def.from.gi, def: def.u, atk: atk.u, kind: 'swap' });
    }
  }
  if (o.skip) evs = evs.filter(function (e) { return !o.skip(e); });
  evs.sort(wmMarchEvCmp);
  return evs;
}
function wmMarchEncFirst(units, o) { var l = wmMarchEncList(units, o); return l.length ? l[0] : null; }
