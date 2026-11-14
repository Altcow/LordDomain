// js/ld_open_wd.js — 地圖層擴充:預約、新手寨、寶地(設計_開場解鎖_預約_活動_定案.md 3、4.4、2.5 / 卡 3、6、8;純邏輯,無 DOM,可在 node 跑)。前綴 wdRsv / wdSpawnTut / wdMarkTreasure。
// wd_core.js 只留最小掛點(W.rsv / 事件 'rsvgo' / 寶地欄位 / 新手點正規化),都「存在才呼叫」本檔函式。載入順序:wd_core.js 之後。
// W.rsv = [{id, pt, order:[隊號], tFight, tGo, st:'wait'}](只存隊號,出發時才讀軍營當下的成員與兵力);W.rsvLog = [{t, msg}](最近 10 筆,預約結果)。
// 預約規則(3.3):開打時刻只有 12:00 / 20:00(wdBoundaries)、36 小時內、同時最多 3 筆、同隊占用區間 [出發, 開打 + 回程] 不可重疊、同點同時刻 1 筆;出發時略過不能出的隊,全不行 → 取消並不扣任何東西。
// 同刻處理順序:刷新 0 → 回城 1 → 預約出發 1.5 → 抵達 / 集結 2(wdNextEvent)。ES2017;不用 ?. ??。

var WD_RSV_CATS = { beast: 1, county: 1, jun: 1, pass: 1 };
var WD_RSV_REASON = { nopt: '這個點已經不在了', cat: '只能預約野怪 / 縣 / 郡 / 關口', owned: '已經被占下了', time: '開打時間只能選 12:00 / 20:00(36 小時內)', late: '來不及(出發時刻已過)', max: '預約已滿 3 筆', dup: '同一點同一時刻已有預約', size: '請選隊伍', overlap: '隊伍時間重疊', noteam: '沒有這個隊伍', rallymax: '隊數太多' };

function wdRsvList(W) { return (W && Array.isArray(W.rsv)) ? W.rsv.slice() : []; }
function wdRsvBackMs(pt) { return Math.round(pt.mins * WD_CFG.MIN / WD_CFG.retDiv); }
function wdRsvLogAdd(W, t, msg) {
  if (!Array.isArray(W.rsvLog)) W.rsvLog = [];
  W.rsvLog.unshift({ t: t, msg: String(msg).slice(0, 80) });
  if (W.rsvLog.length > 10) W.rsvLog.length = 10;
}
// 可選的開打時刻:[{t, label}](now 之後 36 小時內的 12:00 / 20:00);pt 有給就排除「出發時刻已過」的
function wdRsvTimes(now, pt) {
  var b = wdBoundaries(now, 0, 2), out = [];
  b.sort(function (x, y) { return x - y; });
  b.forEach(function (t) {
    if (t <= now || t > now + 36 * WD_CFG.HOUR) return;
    if (pt && t - pt.mins * WD_CFG.MIN <= now) return;
    out.push({ t: t, label: wdRsvLabel(t, now) });
  });
  return out;
}
function wdRsvHM(t) { var L = new Date(t + WD_CFG.dayShiftMs), p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(L.getUTCHours()) + ':' + p(L.getUTCMinutes()); }
function wdRsvLabel(t, now) {
  var d0 = Math.floor((now + WD_CFG.dayShiftMs) / WD_CFG.DAY), d1 = Math.floor((t + WD_CFG.dayShiftMs) / WD_CFG.DAY);
  return (d1 === d0 ? '今天 ' : (d1 === d0 + 1 ? '明天 ' : '後天 ')) + wdRsvHM(t);
}
// 新增預約。teams = [{n, name, slots}](依出場順序)。回 {ok, reason, rsv, team}
function wdRsvAdd(W, cs, teams, ptId, tFight, now) {
  var pt = wdPt(W, ptId), tGo, i, j, r2, b1, b2, ok = false, bs;
  if (!pt) return { ok: false, reason: 'nopt' };
  if (!WD_RSV_CATS[pt.cat]) return { ok: false, reason: 'cat' };
  if (pt.owner) return { ok: false, reason: 'owned' };
  if (!teams || !teams.length) return { ok: false, reason: 'size' };
  if (teams.length > WD_CFG.rallyMax) return { ok: false, reason: 'rallymax' };
  bs = wdBoundaries(now, 0, 2);
  for (i = 0; i < bs.length; i++) if (bs[i] === tFight) ok = true;
  if (!ok || tFight <= now || tFight > now + 36 * WD_CFG.HOUR) return { ok: false, reason: 'time' };
  tGo = tFight - pt.mins * WD_CFG.MIN;
  if (tGo <= now) return { ok: false, reason: 'late' };
  if (!Array.isArray(W.rsv)) W.rsv = [];
  if (W.rsv.length >= 3) return { ok: false, reason: 'max' };
  for (i = 0; i < W.rsv.length; i++) if (W.rsv[i].pt === ptId && W.rsv[i].tFight === tFight) return { ok: false, reason: 'dup' };
  b1 = wdRsvBackMs(pt);
  for (i = 0; i < teams.length; i++) {
    for (j = 0; j < W.rsv.length; j++) {
      r2 = W.rsv[j];
      if (r2.order.indexOf(teams[i].n) < 0) continue;
      b2 = wdRsvBackMs(wdPt(W, r2.pt) || pt);
      if (tGo < r2.tFight + b2 && r2.tGo < tFight + b1) return { ok: false, reason: 'overlap', team: teams[i].n, rsv: r2 };
    }
  }
  W.rsv.push({ id: 'v' + tFight + '_' + ptId, pt: ptId, order: teams.map(function (t) { return t.n; }), tFight: tFight, tGo: tGo, st: 'wait' });
  if (typeof ldOpenNote === 'function') ldOpenNote('rsvAdd', { t: now });
  return { ok: true, reason: '', rsv: W.rsv[W.rsv.length - 1] };
}
// 出發前取消:無代價。已出發的用 wdRecall
function wdRsvCancel(W, id) {
  var n = (W.rsv || []).length;
  W.rsv = (W.rsv || []).filter(function (r) { return r.id !== id; });
  return W.rsv.length < n;
}
// 某隊在 tEnd 之前有預約出發 → true(自動派遣用:預估回城時間超過下一筆預約出發時間就不派這隊)
function wdRsvBusyBefore(W, n, tEnd) {
  return (W.rsv || []).some(function (r) { return r.st === 'wait' && r.order.indexOf(n) >= 0 && r.tGo < tEnd; });
}
// 出發時刻處理(wdHandle 'rsvgo'):逐隊檢查,可出的建行程(抵達 = 開打時刻),其他略過寫戰報;全不行 → 取消
function wdRsvGo(W, cs, r, t, events) {
  var pt = wdPt(W, r.pt), rid, rl, ok = [], used = {}, cur = (typeof wdTeams === 'function') ? wdTeams() : [], names = {};
  W.rsv = (W.rsv || []).filter(function (x) { return x !== r; });
  if (!pt || pt.owner || wdPtBusy(W, pt.id)) {
    events.push({ t: t, k: 'rsvcancel', pt: r.pt, reason: !pt ? 'nopt' : 'owned' });
    wdRsvLogAdd(W, t, '預約取消:' + (pt ? pt.ty : '目標') + (pt ? '(已被占下或有人前往)' : '已消失'));
    return false;
  }
  r.order.forEach(function (n) {
    var team = null, chk, i, why;
    for (i = 0; i < cur.length; i++) if (cur[i].n === n) team = cur[i];
    if (!team) { why = 'noteam'; }
    else if (wdTeamTrip(W, n)) why = 'army';
    else { chk = wdCheckSlots(W, cs, team.slots, t, used); if (!chk.ok) why = chk.reason; }
    if (why) {
      events.push({ t: t, k: 'rsvskip', team: n, reason: why });
      wdRsvLogAdd(W, t, '第 ' + n + ' 隊未到(' + wdRsvWhy(why) + ')');
      return;
    }
    team.slots.forEach(function (s) { used[s.id] = true; });
    ok.push(team);
  });
  if (!ok.length) {
    events.push({ t: t, k: 'rsvcancel', pt: r.pt, reason: 'noteam' });
    wdRsvLogAdd(W, t, '預約取消:沒有隊伍可以出發(' + pt.ty + ')');
    return false;
  }
  rid = 'k' + (++W.kc);
  rl = { id: rid, pt: pt.id, order: ok.map(function (x) { return x.n; }), t0: t, tArrive: r.tFight };
  W.rallies.push(rl);
  ok.forEach(function (team) { var tr = wdTripStart(W, cs, team, pt, rid, t, false); tr.tArrive = r.tFight; tr.rsv = 1; });
  events.push({ t: t, k: 'rsvgo', pt: pt.id, ptName: pt.ty, teams: rl.order.slice() });
  wdRsvLogAdd(W, t, '預約出發:' + pt.ty + '(' + rl.order.length + ' 隊)');
  return true;
}
function wdRsvWhy(r) { return { hurt: '重傷', lowtrp: '兵力不足', field: '外勤中', garrison: '駐守中', appoint: '委任中', missing: '成員不在名冊', dup: '成員重複', samefig: '同名武將', army: '還在外面', noteam: '隊伍沒了', size: '隊伍人數不對' }[r] || '無法出發'; }
// 撤回:行軍中(尚未開打)整批回城,回程 = 已走時間 × 1/4,本次作廢。回 {ok, reason}
function wdRecall(W, cs, rallyId, now) {
  var rl = null, i, n = 0;
  for (i = 0; i < W.rallies.length; i++) if (W.rallies[i].id === rallyId) rl = W.rallies[i];
  if (!rl || now >= rl.tArrive) return { ok: false, reason: 'late' };
  W.trips.forEach(function (tr) {
    if (tr.rally === rallyId && tr.st === 'go') { tr.st = 'back'; tr.tHome = now + Math.round(Math.max(0, now - tr.t0) / WD_CFG.retDiv); n++; }
  });
  W.rallies = W.rallies.filter(function (x) { return x !== rl; });
  return { ok: n > 0, reason: n ? '' : 'none', n: n };
}
function wdRsvNorm(raw, W) {
  var out = [];
  (Array.isArray(raw) ? raw : []).forEach(function (r) {
    if (out.length >= 3 || !r || typeof r !== 'object' || typeof r.id !== 'string' || typeof r.pt !== 'string' || !Array.isArray(r.order)) return;
    var order = r.order.map(function (n) { return wdInt(n, 1, 99, 0); }).filter(Boolean).slice(0, WD_CFG.rallyMax);
    if (!order.length) return;
    out.push({ id: r.id, pt: r.pt, order: order, tFight: wdInt(r.tFight, 0, 1e15, 0), tGo: wdInt(r.tGo, 0, 1e15, 0), st: 'wait' });
  });
  W.rsv = out;
  W.rsvLog = (Array.isArray(W.rsvLog) ? W.rsvLog : []).filter(function (x) { return x && typeof x.msg === 'string'; }).slice(0, 10).map(function (x) { return { t: wdInt(x.t, 0, 1e15, 0), msg: x.msg.slice(0, 80) }; });
}

// ───────── 新手寨(2.5):把第一個山寨改成 lv1 的新手寨,去程 30 秒 ─────────
function wdSpawnTut(W) {
  var camps = W.pts.filter(function (p) { return p.cat === 'camp' && !p.cl; }), pt = camps[0];
  if (!pt) { pt = wdGenPt(W, 'camp'); W.pts.push(pt); }
  pt.lv = 1; pt.nf = 1; pt.ty = '新手寨'; pt.mins = EV_CFG.tutMins; pt.tut = 1; pt.foeHp = wdNewFoeHp(1); pt.foeT = 0;
  return pt;
}
// 活動期間每次刷新:新產生的資源點中 2 個設為寶地(tr:1)
function wdMarkTreasure(W, fresh) {
  var i, n = 0;
  for (i = 0; i < fresh.length && n < EV_CFG.treasureCount; i++) { fresh[i].tr = 1; n++; }
  return n;
}
// 寶地駐守碎片:每駐守滿 6 小時 3 片(固定值);呼叫端(wdGuardSettle)傳入 guard 與結算時刻 t,回新增碎片數
function wdTreasureShards(g, t) {
  var blocks = Math.floor((Math.min(t, g.t1) - g.t0) / EV_CFG.treasureShardEvery), add;
  if (blocks < 0) blocks = 0;
  add = Math.max(0, blocks - (g.hb | 0)) * EV_CFG.treasureShard;
  g.hb = Math.max(g.hb | 0, blocks);
  return add;
}

// 新手寨:新存檔載入地圖時補上(舊存檔 legacy 不補;只補一次)
function evTutEnsure(W, now) {
  var o;
  if (!evOn() || !W || !Array.isArray(W.pts)) return false;
  o = evRead(now);
  if (o.legacy || o.tut) return false;
  if (!W.pts.some(function (p) { return p.tut; })) wdSpawnTut(W);
  o.tut = 1;
  evWrite(o);
  return true;
}
