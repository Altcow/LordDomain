// js/wmap_go.js — M1 W3 派兵 + MS2 存檔與時鐘(設計_M1視覺原型_實作計畫.md W3;設計_行軍停止與相遇_規格.md 1、2、6.1 MS2)。純核心:不碰 DOM / localStorage、不讀時間(now 由呼叫端傳)、不用亂數;node 可測。
// 做什麼:點地圖目標格 → 派一隊出征(寫進 W.trips,帶行軍航段 lg)→ 行軍中停止 / 繼續 / 改目標 / 撤退 → 抵達 / 閒置到期 / 回程 / 回城全部由 wd_core 的 wdRun 以時間推算(離線追趕 = 開啟時 wdRun 一次)。
// 資料:沿用舊 wd_core 的 W(存檔鍵 lorddomain.world.v2,已登錄 saveslots;不開新鍵)。地圖格目標「實體化」成 W.pts 一筆(id = 'w' + gi;資源格 cat 'res'、縣城 'county'、關口 'pass'),
//   抵達 / 戰鬥 / 戰報 / 傷亡 / 重傷 / 解卡全走既有 wdAssault / wdTripHome。行程 trip 多了:lg(航段,wm_march.js 格式)、gi、path、cost、goMs、backMs、spd、g2:1(wdNorm 保留);舊欄位 t0 / tArrive / tHome / mins 照寫(相容)。
// 鎖卡:wdTripStart 出發即 cardsUseSet(field, 'wd:行程id'),行軍 / 閒置 / 回程都占用,wdTripHome 才解(一卡一件事;閒置不解)。
// 時鐘:呼叫端一律傳 ldNow()(ld_clock.js);W.now > now(時鐘倒退 / 偏差)→ wdRun 回 frozen,本檔指令回 err 'frozen' 不動作;補回之後自然接續(不會提早結算)。
// ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:wm_gen.js、wm_march.js 之後(呼叫時才用 wd_core / wd_data / wm_march / wm_gen)。全域名一律 wmapGo* / WMAPGO_*。
//
// ───────── 公開 API ─────────
//   WMAPGO_CFG                                {skewMs 120000(時鐘偏差容忍)、fast 0.2、fastMinMs 24000(?wmfast=1:新行程去程 ×0.2、下限 0.4 分)、retMinMs 1000}
//   wmapGoFast() → bool                       網址 ?wmfast=1
//   wmapGoSpd(slots) → 係數                   全隊最慢兵種係數(WMG_CFG.spd:騎 0.85 弓 1 槍 1 械 1.25 盾 1.10;預設 1)
//   wmapGoPtId(gi) → 'w'+gi
//   wmapGoRoute(WG, src, goal) → {cells, cost}|null   Dijkstra(六邊形 6 向、每步 1、道路 / 鋪路層 ×0.5、淺灘 ×1.5;無斜步、無切牆角);goal = gi(可為縣 / 關單格)或 'home'(任一主城格)
//   wmapGoTarget(WG, gi, info, own?) → {ok, reason, kind:'res'|'county'|'jun'|'pass', gi, cost, cells, path, ty, lv, node}   info = {ty:'farm'..., lv}(資源格;wmapInfoOf(gi))
//        own = {gi:1} 己方領地(wmapGoOwnSet;沒傳則讀 WMAP.own):資源格超出 WG.d 可達上限(Infinity)時,緊鄰己方領地(6 鄰)才另算路徑可打,不相鄰仍 reason 'unreach'。
//        城池(gv 3):點城內任何格 / 關門道都算打這座;gi = node.gi(主城門格)。縣 / 郡:cells = 主城 → node.adj(主城門前格)的路徑 + node.gi(最後一步進門),cost = node.d + 1;
//        關:規格 1.5,走到朝主城端的門外格 node.adj 開打、不進門道:cells 止於 adj,cost = node.d。tg.end = cells 最後一格(改目標 / 繞路重算用)
//   wmapGoNeedMigrate(W, WG) → bool           存檔世界版本 g2.gv(沒記 = 2)≠ WG.gv
//   wmapGoMigrate(W, cs, WG, now) → {changed, from, to, home, node, res, keep, rd, dead}   gv 重排:g2 行程立即回城、縣 / 郡 / 關舊點清掉、資源點新地圖上不是平地 / 在城郊 / 已不是資源格(gv 4 起,WG.rt)→ 刪點與 g2.own(不補償);仍是資源格的保留並把 ty / lv 同步成新地圖的值;備份 .bak_gv<舊版> 由 UI 層寫
//   wmapGoPlan(W, WG, tg, team, now, o) → {goMs, backMs, goMins, backMins, cost, spd}   預估(不改任何狀態)
//   wmapGoDraft(W, WG, tg) → pt               目標的實體化草稿(不放進 W、不動 W.pc;算守軍戰力 / 勝算用)
//   wmapGoOdds(W, cs, team, tg, now) → {my, foe, tag:'穩勝'|'五五'|'難勝', cls}
//   wmapGoDispatch(W, cs, team, gi, now, o) → {ok, reason, trip, pt, plan, events}   o = {WG, info, fast};reason 同 wdDispatch + 'frozen' 'target' 'unreach' 'terrain' 'empty'
//   wmapGoCmd(W, cs, tripId, kind, now, o) → {ok, err, trip, leg, cancel, events}   kind = 'stop' | 'resume' | 'redirect' | 'retreat';o = {WG, fast, gi + info(redirect)}
//        err:frozen notrip back nopath notmoving notidle cooldown expired route target owned busy needback bad
//        停在主城格(出城後半格內)停止 / 撤退 = 取消出征直接回城(cancel:true)
//   wmapGoStatus(trip, now, WG?) → {k, phase, eta, tHome, huLeft, cdLeft, gi(所屬格), canStop, canResume, canRedirect, canRetreat, lg}   UI 用
//   wmapGoPlanRedirect(W, WG, trip, gi, info, now, o) → {ok, err, tg, goMs, goMins, cost}   改目標預覽(不改狀態)
//   wmapGoOwnSet(W) → {gi:1}                  已占領的資源領地(pt id 'w…'、cat 'res' 且 owner 'me';縣城 / 關口不算個人領地)
//   wmapGoSummary(events) → {arrive, report, win, lose, home, idleend, miss}   離線追趕 / 一次推進的事件統計
//   wmapGoClock(W, now) → {frozen, aheadMs, skew}   時鐘檢查:frozen = now < W.now;skew = 超過容忍(> skewMs)

var WMAPGO_CFG = { skewMs: 120000, fast: 0.2, fastMinMs: 24000, retMinMs: 1000 };
var WMAPGO_TY = { farm: '農田', mine: '礦坑', hunt: '獵場', lumber: '林場', quarry: '採石場' };

function wmapGoFast() {
  try { return typeof window !== 'undefined' && !!window.location && /[?&]wmfast=1(&|$)/.test(String(window.location.search || '')); } catch (e) { return false; }
}
function wmapGoScale(ms, fast, min) {
  if (!fast) return Math.round(ms);
  return Math.max(Math.round(ms * WMAPGO_CFG.fast), min);
}
function wmapGoSpd(slots) {
  var s = 0, i, v, sp = (typeof WMG_CFG !== 'undefined' && WMG_CFG.spd) ? WMG_CFG.spd : {};
  for (i = 0; i < (slots || []).length; i++) { v = sp[slots[i].troop]; if (v > s) s = v; }
  return s > 0 ? s : 1;
}
function wmapGoPtId(gi) { return 'w' + gi; }
function wmapGoIsPtId(id) { return typeof id === 'string' && /^w\d+$/.test(id); }

// ───────── 路徑(Dijkstra,同 wmDistCalc 的成本模型,單源)─────────
function wmapGoRoute(WG, src, goal) {
  var N = WG.size, n = N * N, k = WG.k, rd = WG.rd || null, dist = new Float64Array(n), pv = new Int32Array(n), done = new Uint8Array(n), h = wmgHeap(), i, u, ux, uy, j, x, y, v, w, nd, ok, cells, cur, home;
  if (!(src >= 0 && src < n)) return null;
  for (i = 0; i < n; i++) { dist[i] = Infinity; pv[i] = -1; }
  dist[src] = 0; h.push(0, src);
  home = src === WG.c0;   // 從主城中心出發:穿過主城占地(k 6)不計成本 = 與 WG.d / d0 同口徑(主城 7 格都是 0)
  while (h.size()) {
    u = h.pop();
    if (done[u]) continue;
    done[u] = 1;
    ok = goal === 'home' ? k[u] === 6 : u === goal;
    if (ok) {
      cells = []; cur = u;
      while (cur >= 0) { cells.push(cur); cur = pv[cur]; }
      cells.reverse();
      return { cells: cells, cost: dist[u] };
    }
    ux = u % N; uy = (u - ux) / N; nd = dist[u];
    for (j = 0; j < 6; j++) {
      x = ux + WMHEX_DC[j]; y = uy + WMHEX_DR[j];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      v = y * N + x;
      if (v !== goal && !wmgWalk(k[v])) continue;
      w = nd + (home && k[v] === 6 ? 0 : wmgMul(k[v], rd && rd[v]));
      if (w >= dist[v]) continue;
      dist[v] = w; pv[v] = u; h.push(w, v);
    }
  }
  return null;
}

// ───────── 目標 ─────────
// 己方領地鄰格(六邊形 6 鄰,含放棄倒數中):own = {gi:1}(wmapGoOwnSet);沒傳且 WMAP.WG 是同一張圖時讀 WMAP.own(UI 每秒同步)
function wmapGoAdjOwn(WG, gi, own) {
  var nb, i;
  if (!own && typeof WMAP !== 'undefined' && WMAP && WMAP.WG === WG) own = WMAP.own;
  if (!own) return false;
  nb = wmHexNbs(gi, WG.size);
  for (i = 0; i < nb.length; i++) if (own[nb[i]]) return true;
  return false;
}
function wmapGoPaveAdj(WG, gi, own, W) {   // 空地緊鄰己方錨點(主城占地 / 己方領地 / 已占空地 / 己方道路)?有 W 才用 wmapSettleAnchors,否則只看 own + 主城占地
  var anc, nb, i, c;
  if (W && typeof wmapSettleAnchors === 'function') anc = wmapSettleAnchors(W, WG);
  else { anc = new Uint8Array(WG.size * WG.size); c = wmCityCells(WG).concat(wmCityYard(WG)); for (i = 0; i < c.length; i++) anc[c[i]] = 1; if (own) for (i in own) anc[+i] = 1; }
  nb = wmHexNbs(gi, WG.size);
  for (i = 0; i < nb.length; i++) if (anc[nb[i]]) return true;
  return false;
}
function wmapGoTarget(WG, gi, info, own, W) {
  var N, k, nd, cells, base, cost, pass, rt;
  if (!WG || !(gi >= 0 && gi < WG.k.length)) return { ok: false, reason: 'target' };
  N = WG.size; k = WG.k[gi];
  nd = wmNodeAt(WG, gi);
  if (nd) {
    gi = nd.gi; pass = nd.type === 'pass';
    base = (nd.adj >= 0 && isFinite(nd.d)) ? wmPathCells(WG, nd.adj) : null;
    if (base) { cells = pass ? base : base.concat([gi]); cost = pass ? nd.d : nd.d + 1; }
    else {   // 超出可達上限(d = Infinity):另算整條路,去程時間由 wmGoMins 夾在最大 10 分
      base = wmapGoRoute(WG, WG.c0, pass ? nd.adj : gi);
      if (!base) return { ok: false, reason: 'unreach' };
      cells = base.cells; cost = base.cost;
    }
    return { ok: true, reason: '', kind: nd.type, gi: gi, WG: WG, node: nd, cost: cost, cells: cells, end: cells[cells.length - 1], path: wmMarchTurns(cells, N), ty: '', lv: 0 };
  }
  if (k === 0) {
    if (!info) {   // 空地:傳了 W(wmapGoDispatch)且緊鄰己方錨點 → kind 'pave'(跳過戰鬥,由 wmap_eng / wmapSettleEmptyStart 接手;不設距離上限、系統自選最優路線);否則 'empty'
      if (W && !(WG.zone && WG.zone[gi]) && !(WG.rt && WG.rt[gi] >= 0) && wmapGoPaveAdj(WG, gi, own, W)) {
        rt = isFinite(WG.d[gi]) ? { cells: wmPathCells(WG, gi), cost: WG.d[gi] } : wmapGoRoute(WG, WG.c0, gi);
        if (!rt || !rt.cells) return { ok: false, reason: 'unreach' };
        return { ok: true, reason: '', kind: 'pave', gi: gi, WG: WG, node: null, cost: rt.cost, cells: rt.cells, end: gi, path: wmMarchTurns(rt.cells, N), ty: '', lv: 0 };
      }
      return { ok: false, reason: 'empty' };
    }
    if (!isFinite(WG.d[gi])) {   // 超出 WG.d 可達上限(24):緊鄰己方領地的資源格仍可打(長途出兵不設距離上限,11/17),另算整條路;不相鄰的維持 unreach
      if (!wmapGoAdjOwn(WG, gi, own)) return { ok: false, reason: 'unreach' };
      rt = wmapGoRoute(WG, WG.c0, gi);
      if (!rt) return { ok: false, reason: 'unreach' };
      return { ok: true, reason: '', kind: 'res', gi: gi, WG: WG, node: null, cost: rt.cost, cells: rt.cells, end: gi, path: wmMarchTurns(rt.cells, N), ty: WMAPGO_TY[info.ty] || String(info.ty || '農田'), lv: info.lv | 0 };
    }
    cells = wmPathCells(WG, gi);
    if (!cells) return { ok: false, reason: 'unreach' };
    return { ok: true, reason: '', kind: 'res', gi: gi, WG: WG, node: null, cost: WG.d[gi], cells: cells, end: gi, path: wmMarchTurns(cells, N), ty: WMAPGO_TY[info.ty] || String(info.ty || '農田'), lv: info.lv | 0 };
  }
  return { ok: false, reason: 'terrain' };
}
function wmapGoCat(tg) { return tg.kind === 'res' ? 'res' : tg.kind; }
// 草稿:呼叫 wdGenPt 但還原 W.pc,不放進 W.pts
function wmapGoDraft(W, WG, tg) {
  var pc = W.pc, o, pt;
  o = tg.kind === 'res' ? { lv: Math.max(1, Math.min(10, tg.lv)), ty: tg.ty } : { idx: tg.node ? tg.node.ti : 0 };
  pt = wdGenPt(W, wmapGoCat(tg), o);
  W.pc = pc;
  pt.id = wmapGoPtId(tg.gi);
  pt.fs = wmGenHash(WG.seed, tg.gi, 1) % 1000000000;
  return pt;
}
function wmapGoEnsurePt(W, WG, tg) {
  var pt = wdPt(W, wmapGoPtId(tg.gi)), pc;
  if (pt) return pt;
  pc = W.pc;
  pt = wmapGoDraft(W, WG, tg);
  W.pc = pc + 1;
  W.pts.push(pt);
  return pt;
}
function wmapGoFoePower(W, pt) {
  var s = 0, j;
  for (j = 0; j < pt.nf; j++) s += wdFoeTeam(W, pt, j).power;
  return s;
}
function wmapGoOdds(W, cs, team, tg, now) {
  var pt = wdPt(W, wmapGoPtId(tg.gi)) || wmapGoDraft(W, tg.WG, tg), my = wdTeamPowerR(W, cs, team.slots, now), foe = wmapGoFoePower(W, pt), r = foe > 0 ? my / foe : 9;
  return { my: Math.round(my), foe: Math.round(foe), tag: r >= WD_CFG.autoMul ? '穩勝' : (r >= 1 ? '五五' : '難勝'), cls: r >= WD_CFG.autoMul ? 'good' : (r >= 1 ? 'mid' : 'bad') };
}

// ───────── 預估 ─────────
function wmapGoPlan(W, WG, tg, team, now, o) {
  var spd = wmapGoSpd(team ? team.slots : []), goMins = wmGoMins(tg.cost, spd), goMs = wmapGoScale(goMins * 60000, o && o.fast, WMAPGO_CFG.fastMinMs), backMs = Math.round(goMs / WD_CFG.retDiv);
  return { cost: tg.cost, spd: spd, goMins: goMins, backMins: wmBackMins(goMins), goMs: goMs, backMs: backMs };
}

// ───────── 出發 ─────────
function wmapGoDispatch(W, cs, team, gi, now, o) {
  o = o || {};
  var WG = o.WG, r = wdRun(W, cs, now), tg, pt0, chk, pt, plan, trip;
  if (r.frozen) return { ok: false, reason: 'frozen', events: r.events };
  tg = wmapGoTarget(WG, gi, o.info, wmapGoOwnSet(W), W);
  if (!tg.ok) return { ok: false, reason: tg.reason, events: r.events };
  if (tg.kind === 'pave') return { ok: false, reason: 'pave', tg: tg, events: r.events };   // 空地:不打,資料層由 wmapSettleEmptyStart / wmap_eng 接手(UI 之後接)
  gi = tg.gi;
  pt0 = wdPt(W, wmapGoPtId(gi));
  if (pt0 && (pt0.owner || pt0.cl)) return { ok: false, reason: 'owned', events: r.events };
  if (pt0 && wdPtBusy(W, pt0.id)) return { ok: false, reason: 'busy', events: r.events };
  if (!team || wdTeamTrip(W, team.n)) return { ok: false, reason: 'army', events: r.events };
  chk = wdCheckSlots(W, cs, team.slots, now);
  if (!chk.ok) return { ok: false, reason: chk.reason, events: r.events };
  pt = wmapGoEnsurePt(W, WG, tg);
  plan = wmapGoPlan(W, WG, tg, team, now, o);
  trip = wdTripStart(W, cs, team, pt, null, now, false);
  trip.tArrive = now + plan.goMs;
  trip.mins = Math.max(1, Math.min(60, Math.round(plan.goMs / 60000)));
  trip.path = tg.path; trip.goMs = plan.goMs; trip.backMs = plan.backMs; trip.gi = gi; trip.cost = tg.cost; trip.spd = plan.spd; trip.g2 = 1;
  trip.lg = wmMarchNew({ p: tg.path, size: WG.size, t0: now, M: plan.goMs, g: gi, on: 'fight', hm: 1, b: { p: wmMarchRev(tg.path), M: plan.backMs } });
  return { ok: true, reason: '', trip: trip, pt: pt, plan: plan, events: r.events };
}

// ───────── 狀態(UI 用)─────────
function wmapGoLegOf(trip, size) {
  if (trip.lg) return trip.lg;
  if (trip.path && trip.path.length) return wmMarchLegOf(trip, size);
  return null;
}
function wmapGoStatus(trip, now, WG) {
  var size = WG ? WG.size : (trip.lg ? trip.lg.n : 64), lg = wmapGoLegOf(trip, size), s, seg, out;
  if (!lg) return { k: 'none', phase: 'done', eta: 0, tHome: trip.tHome || 0, huLeft: 0, cdLeft: 0, gi: -1, canStop: false, canResume: false, canRedirect: false, canRetreat: false, lg: null };
  s = wmMarchAt(lg, now, size); seg = s.seg;
  out = { k: s.phase, phase: s.phase, eta: wmMarchEta(lg), tHome: wmMarchEnd(lg), huLeft: 0, cdLeft: 0, gi: s.gi, canStop: false, canResume: false, canRedirect: false, canRetreat: false, lg: lg };
  if (s.phase === 'go' && seg.k === 'mv') { out.canStop = out.canRedirect = out.canRetreat = true; }
  else if (s.phase === 'idle') { out.canResume = out.canRedirect = out.canRetreat = true; out.huLeft = Math.max(0, seg.hu - now); }
  if ((out.canStop || out.canResume || out.canRedirect) && (seg.v | 0) > 0) out.cdLeft = Math.max(0, seg.t0 + WMARCH_CFG.CMD_GAP - now);
  if (trip.st === 'back' && s.phase !== 'back') { out.canStop = out.canResume = out.canRedirect = out.canRetreat = false; }
  return out;
}
function wmapGoClock(W, now) {
  var ahead = W.now - now;
  return { frozen: now < W.now, aheadMs: Math.max(0, ahead), skew: ahead > WMAPGO_CFG.skewMs };
}

// ───────── 指令 ─────────
function wmapGoTripOf(W, id) {
  var i;
  for (i = 0; i < W.trips.length; i++) if (W.trips[i].id === id) return W.trips[i];
  return null;
}
// 截段後回主城的方案:{route(轉折點,從所屬格出發), cost, M(ms), back:{p, a0, L, M}}
function wmapGoBackPlan(WG, cut, spd, fast) {
  var N = WG.size, rt, route, sp, extra = 0, cost, M;
  rt = wmapGoRoute(WG, cut.gi, 'home');
  if (!rt) return null;
  route = wmMarchTurns(rt.cells, N);
  sp = wmMarchSplice(cut, route);
  if (!sp) return null;
  if (cut.other >= 0 && sp.p[0] === cut.other) extra = ((cut.edge - cut.a0) / 1000) * wmgMul(WG.k[cut.gi]);
  cost = rt.cost + extra;
  M = wmapGoScale(Math.round(wmMarchRetreatMins(cost, spd) * 60000), fast, WMAPGO_CFG.retMinMs);
  return { route: route, cost: cost, M: M, back: { p: sp.p, a0: sp.a0, L: wmMarchLenOf(sp.p, N), M: M } };
}
// 改目標方案(預覽與指令共用):不改任何狀態
function wmapGoPlanRedirect(W, WG, trip, gi, info, now, o) {
  o = o || {};
  var size = WG.size, lg = wmapGoLegOf(trip, size), tg, pt0, s, seg, cut, rt, route, sp, extra = 0, cost, spd, goMins, goMs, backMs;
  if (!lg) return { ok: false, err: 'nopath' };
  tg = wmapGoTarget(WG, gi, info, wmapGoOwnSet(W));
  if (!tg.ok) return { ok: false, err: 'target', reason: tg.reason };
  gi = tg.gi;
  pt0 = wdPt(W, wmapGoPtId(gi));
  if (pt0 && (pt0.owner || pt0.cl)) return { ok: false, err: 'owned' };
  if (pt0 && wdTripsTo(W, pt0.id).some(function (x) { return x !== trip; })) return { ok: false, err: 'busy' };
  s = wmMarchAt(lg, now, size); seg = s.seg;
  if (!((s.phase === 'go' && seg.k === 'mv') || s.phase === 'idle')) return { ok: false, err: 'notmoving' };
  cut = wmMarchCut(seg, s.d, size);
  rt = wmapGoRoute(WG, cut.gi, tg.end);   // 關 = 門外格(不進門道)
  if (!rt) return { ok: false, err: 'route' };
  route = wmMarchTurns(rt.cells, size);
  sp = wmMarchSplice(cut, route);
  if (!sp) return { ok: false, err: 'route' };
  if (cut.other >= 0 && sp.p[0] === cut.other) extra = ((cut.edge - cut.a0) / 1000) * wmgMul(WG.k[cut.gi]);
  cost = rt.cost + extra;
  spd = trip.spd > 0 ? trip.spd : wmapGoSpd(trip.slots);
  goMins = wmGoMins(cost, spd);
  goMs = wmapGoScale(goMins * 60000, o.fast, WMAPGO_CFG.fastMinMs);
  backMs = Math.round(wmapGoScale(wmGoMins(tg.cost, spd) * 60000, o.fast, WMAPGO_CFG.fastMinMs) / WD_CFG.retDiv);
  return { ok: true, tg: tg, route: route, cost: cost, goMins: goMins, goMs: goMs, backMs: backMs, spd: spd, cut: cut };
}
function wmapGoApplyBack(W, cs, trip, leg) {   // 撤退:行程切成 back,回城事件由 wdRun 接手
  trip.lg = leg;
  trip.st = 'back';
  trip.tHome = wmMarchEnd(leg);
}
function wmapGoCmd(W, cs, tripId, kind, now, o) {
  o = o || {};
  var WG = o.WG, size = WG ? WG.size : 64, r = wdRun(W, cs, now), events = r.events, trip, leg, s, seg, cut, spd, res, plan, pl, pt, old, ev2;
  if (r.frozen) return { ok: false, err: 'frozen', events: events };
  trip = wmapGoTripOf(W, tripId);
  if (!trip || trip.rally) return { ok: false, err: 'notrip', events: events };
  if (trip.st === 'back') return { ok: false, err: 'back', events: events };
  leg = wmapGoLegOf(trip, size);
  if (!leg) return { ok: false, err: 'nopath', events: events };
  spd = trip.spd > 0 ? trip.spd : wmapGoSpd(trip.slots);
  if (kind === 'resume') {
    res = wmMarchResume(leg, now, { force: o.force });
    if (!res.ok) return { ok: false, err: res.err, events: events };
    trip.lg = res.leg; trip.tArrive = wmMarchEta(res.leg);
    return { ok: true, trip: trip, leg: res.leg, events: events };
  }
  s = wmMarchAt(leg, now, size); seg = s.seg;
  if (kind === 'stop' || kind === 'retreat') {
    if (!((s.phase === 'go' && seg.k === 'mv') || (kind === 'retreat' && s.phase === 'idle'))) return { ok: false, err: 'notmoving', events: events };
    cut = wmMarchCut(seg, s.d, size);
    if (seg.hm && cut.i === 0) {   // 還在主城格:取消出征,直接回城(卡解鎖、兵力不變)
      if (!(o.force || !((seg.v | 0) > 0 && now < seg.t0 + WMARCH_CFG.CMD_GAP))) return { ok: false, err: 'cooldown', events: events };
      ev2 = [];
      wdTripHome(W, cs, trip, now, ev2, false);
      return { ok: true, cancel: true, trip: trip, events: events.concat(ev2) };
    }
    if (!WG) return { ok: false, err: 'bad', events: events };
    pl = wmapGoBackPlan(WG, cut, spd, o.fast);
    if (!pl) return { ok: false, err: 'route', events: events };
    if (kind === 'stop') {
      res = wmMarchStop(leg, now, { back: pl.back, hold: o.hold, force: o.force });
      if (!res.ok) return { ok: false, err: res.err, events: events };
      trip.lg = res.leg;
      return { ok: true, trip: trip, leg: res.leg, events: events };
    }
    res = wmMarchRetreat(leg, now, { route: pl.route, M: pl.M, force: o.force });
    if (!res.ok) return { ok: false, err: res.err, events: events };
    wmapGoApplyBack(W, cs, trip, res.leg);
    return { ok: true, trip: trip, leg: res.leg, events: events };
  }
  if (kind === 'redirect') {
    if (!WG) return { ok: false, err: 'bad', events: events };
    plan = wmapGoPlanRedirect(W, WG, trip, o.gi, o.info, now, o);
    if (!plan.ok) return { ok: false, err: plan.err, events: events };
    res = wmMarchRedirect(leg, now, { route: plan.route, M: plan.goMs, g: plan.tg.gi, on: 'fight', back: { p: wmMarchRev(plan.tg.path), M: plan.backMs }, hold: o.hold, force: o.force });
    if (!res.ok) return { ok: false, err: res.err, events: events };
    old = wdPt(W, trip.pt);
    pt = wmapGoEnsurePt(W, WG, plan.tg);
    trip.pt = pt.id; trip.gi = plan.tg.gi; trip.cost = plan.cost; trip.lg = res.leg; trip.path = res.leg.p; trip.goMs = plan.goMs; trip.backMs = plan.backMs;
    trip.tArrive = wmMarchEta(res.leg); trip.mins = Math.max(1, Math.min(60, Math.round(plan.goMs / 60000)));
    if (old && old !== pt && wmapGoIsPtId(old.id) && old.cat === 'res' && !old.owner && !old.guard && !W.trips.some(function (x) { return x.pt === old.id; })) W.pts = W.pts.filter(function (x) { return x !== old; });   // 無主、沒人要去的舊資源格:丟掉(無主格不存檔)
    return { ok: true, trip: trip, leg: res.leg, plan: plan, events: events };
  }
  return { ok: false, err: 'bad', events: events };
}

// ───────── 占領 / 統計 ─────────
function wmapGoOwnSet(W) {
  var out = {}, i, p;
  for (i = 0; i < W.pts.length; i++) {
    p = W.pts[i];
    if (wmapGoIsPtId(p.id) && p.cat === 'res' && p.owner === 'me') out[+p.id.slice(1)] = 1;
  }
  return out;
}
function wmapGoOwnSetAll(W, now) {   // 資源領地 + 已完成占領的空地(連地 / 相鄰判斷用;不含作業中;now 預設 ldNow())
  var out = wmapGoOwnSet(W), em = W.g2 && W.g2.em ? W.g2.em : null, k;
  if (!(now >= 0)) now = typeof ldNow === 'function' ? ldNow() : Date.now();
  if (em) for (k in em) if (em[k].t1 <= now) out[+k] = 1;
  return out;
}
function wmapGoMigNotice(W) { var m = W && W.g2 ? W.g2.mg : null; return m && m.n > 0 ? { n: m.n, from: m.from, to: m.to, t: m.t } : null; }   // 開檔第一次顯示「地圖資源重排,收回 N 塊領地」;顯示後呼叫 wmapGoMigAck
function wmapGoMigAck(W) { if (W && W.g2 && W.g2.mg) { delete W.g2.mg; return true; } return false; }
function wmapGoSummary(events) {
  var o = { arrive: 0, report: 0, win: 0, lose: 0, home: 0, idleend: 0, miss: 0 }, i, e;
  for (i = 0; i < (events || []).length; i++) {
    e = events[i];
    if (e.k === 'arrive') o.arrive++;
    else if (e.k === 'report') { o.report++; if (e.win) o.win++; else o.lose++; }
    else if (e.k === 'home') o.home++;
    else if (e.k === 'idleend') o.idleend++;
    else if (e.k === 'miss') o.miss++;
  }
  return o;
}

// ───────── 世界版本重排(gv 2 → 3:縣 / 郡 / 關改占地,地形全變)─────────
// 規則:g2 行程立即回城(兵力不損);cat county / jun / pass 的 'w…' 點全刪(新城池重新可打,名聲不追回);
//   資源點(cat 'res')與 g2.own:新地圖上該格仍是平地(k 0)、不在城郊 / 占地、且(有 WG.rt 時)仍是資源格 → 保留並把 ty / lv 同步成新地圖的資源,否則刪點與 own 記錄,不補償;完成後 g2.gv = WG.gv。
function wmapGoNeedMigrate(W, WG) {
  var gv = W && W.g2 && W.g2.gv > 0 ? W.g2.gv : 2;   // 沒記錄的舊存檔 = gv 2(v66 以前的 wmap 世界都是 gv 2)
  return !!(WG && WG.gv > 0 && gv !== WG.gv);
}
// gv 6(128×128 + 席位 + 等級重排):世界邊長可能變了(舊世界 64),舊領地座標依「離主城的相對位置」平移到新圖(c、r 各 + (新邊長 − 舊邊長) / 2),再套同一套規則;
//   收回數量(owner 'me' 的領地不再是資源格)= out.taken,寫進 g2.mg 讓 UI 在開檔後顯示一次「地圖資源重排,收回 N 塊領地」(wmapGoMigNotice / wmapGoMigAck);不補償。
//   道路層 g2.rd:只在地形沒變(同邊長、WG.tries === 1、種子相同或舊檔沒記)時保留,並只留仍是平地的格;否則清空。
function wmapGoMigrate(W, cs, WG, now) {
  var out = { changed: false, from: 0, to: 0, home: 0, node: 0, res: 0, keep: 0, rd: 0, rdKeep: 0, dead: 0, taken: 0, em: 0 }, g, i, p, gi, ev, trips, key, bad, sync, oldN, N, shift, remap, taken = {}, terrainSame, ng, nk, oh2, em2;
  if (!W || !WG || !wmapGoNeedMigrate(W, WG)) return out;
  g = typeof wmapSettleG2 === 'function' ? wmapSettleG2(W) : (W.g2 = W.g2 && W.g2.own ? W.g2 : { v: 1, own: {}, n: 0, oh: {} });
  out.changed = true; out.from = g.gv > 0 ? g.gv : 2; out.to = WG.gv;
  N = WG.size; oldN = g.sz > 0 ? g.sz : 64; shift = (N - oldN) / 2;
  terrainSame = oldN === N && WG.tries === 1 && (typeof g.sd !== 'number' || g.sd === WG.seed);
  ev = [];
  trips = W.trips.slice();
  for (i = 0; i < trips.length; i++) if (trips[i].g2) { wdTripHome(W, cs, trips[i], now, ev, false); out.home++; }
  remap = function (old) {   // 舊格號 → 新格號(邊長沒變 = 同號;出界 = −1)
    var c, r;
    if (oldN === N) return old;
    c = old % oldN + shift; r = Math.floor(old / oldN) + shift;
    return (c >= 0 && r >= 0 && c < N && r < N) ? r * N + c : -1;
  };
  bad = function (c) { return c < 0 || !(WG.k[c] === 0 && !(WG.zone && WG.zone[c])) || (WG.rt && !(WG.rt[c] >= 0)); };
  sync = function (o, c) {   // gv 4:資源重排後同一格的種類 / 等級可能變了,以新地圖為準(與 wmapGoDraft 同樣上限 10;gv 5 起清空 g2.yg.dead 與道路層 rd 清單)
    if (!WG.rt || !(WG.rt[c] >= 0) || typeof WMG_RES_TY === 'undefined') return;
    o.ty = WMAPGO_TY[WMG_RES_TY[WG.rt[c]]] || o.ty; o.lv = Math.max(1, Math.min(10, WG.rl[c] | 0));
  };
  W.pts = W.pts.filter(function (x) {
    if (!wmapGoIsPtId(x.id)) return true;
    if (x.cat === 'county' || x.cat === 'jun' || x.cat === 'pass') { out.node++; return false; }
    gi = remap(+x.id.slice(1));
    if (x.cat === 'res' && bad(gi)) { out.res++; if (x.owner === 'me') taken[+x.id.slice(1)] = 1; return false; }
    if (x.cat === 'res') { out.keep++; x.id = 'w' + gi; sync(x, gi); }
    return true;
  });
  ng = {};
  for (key in g.own) {
    gi = remap(+key);
    if (bad(gi)) { taken[+key] = 1; continue; }
    sync(g.own[key], gi); ng[gi] = g.own[key];
  }
  g.own = ng;
  oh2 = {};
  for (key in g.oh) { gi = remap(+key); if (gi >= 0) oh2[gi] = g.oh[key]; }
  g.oh = oh2;
  if (g.em) {   // 空地占領:搬到新位置;新位置不再是空地(變成資源格 / 地形)就丟(不算領地)
    em2 = {};
    for (key in g.em) { gi = remap(+key); if (gi >= 0 && typeof wmapSettleEmptyAt === 'function' && wmapSettleEmptyAt(WG, gi)) em2[gi] = g.em[key]; else out.em++; }
    g.em = em2;
  }
  if (Array.isArray(g.rd)) {   // 道路層(鋪路隊)清單:地形沒變才留(只留仍是平地的格)
    out.rd = g.rd.length;
    if (terrainSame) { g.rd = g.rd.filter(function (c) { return c >= 0 && c < N * N && WG.k[c] === 0; }); out.rdKeep = g.rd.length; } else g.rd = [];
  }
  if (g.yg && Array.isArray(g.yg.dead)) { out.dead = g.yg.dead.length; g.yg.dead = []; }   // 野怪已擊殺紀錄(key = bk × 16 + 序號,新地圖野怪位置全變)
  out.taken = Object.keys(taken).length;
  if (out.taken > 0) g.mg = { n: out.taken, from: out.from, to: out.to, t: now };
  g.gv = WG.gv; g.sz = WG.size; g.sd = WG.seed;
  return out;
}
