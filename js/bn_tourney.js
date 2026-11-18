// js/bn_tourney.js — 戰隊擂台(第一版:單機 + 系統隊伍)。純邏輯、無 DOM、不讀時間(時間由呼叫端傳入)、不用 Math.random。ES2017;不用 ?. ??。
// 16 隊單淘汰:16→8→4→決賽,加一場季軍賽(半決賽敗者),比出第 1 / 2 / 3 名。Bo 數見 BN_TOURNEY.bo(決賽 Bo3)。
// 快照清單 snaps = [{name, specs:[bnUnitSpec…]}](1~16 隊;玩家隊伍由呼叫端給,不足 16 隊由 bnTourFill 依種子補系統隊伍)。
// 系統隊伍強度以『玩家平均戰力 refP』為基準(戰力 = 各人 bnPower 加總),依 BN_TOURNEY.npc.bands 分檔;> capAbove 的最多 capN 支。
// 整屆確定性:同 seed + 同快照 = 同結果(bnTourRun);每場每局的種子 = bnHash('bntg', seed, 場次 id, 第幾局)。
// 載入順序:bn_data.js → bn_skills_data.js → bn_units.js → bn_engine.js → bn_tourney.js(隨機名冊卡另需 carddata.js / cards.js)。
// 2026-11-15 固定時間排程:開賽時間集中在 BN_TOURNEY.sched(預設每日 20:00,報名窗口開賽前 30 分鐘);時間一律由呼叫端傳入(毫秒時間戳),本檔不讀時鐘。
// 一個『時段』= {id, day, si, start, open, seed};id = 日號 * 100 + 時段序(日號依 sched.tz 切日),seed = bnHash('bnts', id),整屆由種子 + 報名快照確定性算出。
// 存檔(lorddomain.tourney.v1,v2 加欄位,舊檔相容):reg = 目前報名 {id, start, ts, name, specs};shown = 已彈過公告的最大時段 id;done = 已結算的最大時段 id;
// mute = 『今天不再提醒』的日號;remind / auto = 提醒開關 / 自動報名;last.rk = 我方名次(結算時記下,之後領獎不必重算)。冷卻(cd / bnTourCooldown)舊制保留但已不使用。
// 全域:BN_TOURNEY bnTourPower bnTourArch bnTourBandCounts bnTourCheckSnaps bnTourFill bnTourBracket bnTourPlay bnTourRun bnTourRewardPlan bnTourNorm bnTourCooldown bnTourHistAdd
//       bnTourSlotsText bnTourSlot bnTourSched bnTourSeedOf bnTourClock bnTourStatus bnTourRegister bnTourPopupDue bnTourAutoDue bnTourSettleDue

var BN_TOURNEY = {
  v: 1, key: 'lorddomain.tourney.v1', n: 16, playerMax: 1, bo: { r16: 1, qf: 1, sf: 1, third: 1, final: 3 }, cooldownH: 2, histMax: 10, tryMax: 200,
  // 系統隊伍強度檔:w = 權重(補位隊依權重分配,最大餘數法);lo / hi = 相對玩家平均戰力 P 的範圍;gr = 可抽品階(0 白 1 青 2 藍 3 紫 4 金);pFig = 每人為名人的機率
  npc: {
    bands: [
      { k: 'strong', w: 1, lo: 1.15, hi: 1.30, gr: [3, 4], pFig: 0.4 },
      { k: 'midhi', w: 3, lo: 1.00, hi: 1.10, gr: [2, 3], pFig: 0.35 },
      { k: 'mid', w: 6, lo: 0.85, hi: 1.00, gr: [2, 3], pFig: 0.2 },
      { k: 'weak', w: 5, lo: 0.65, hi: 0.85, gr: [1, 2], pFig: 0.1 }
    ],
    capAbove: 1.10, capN: 2, tol: 0.05, exact: 0.03, tries: 30, archMax: 4, size: 3
  },
  // 名次獎勵(mat = 第 1 章貨物數量;shards = 碎片;coin = 金幣)。冠 > 亞 > 季 > 參加
  reward: {
    champ: { coin: 3000, mat: 4, shards: 30 },
    runner: { coin: 1800, mat: 3, shards: 20 },
    third: { coin: 1000, mat: 2, shards: 12 },
    join: { coin: 300, mat: 1, shards: 0 }
  },
  // 排程:slots = 每日開賽時刻(當地時間的『分鐘數』,1200 = 20:00;一天多場就多填,例 [720, 1200] = 12:00 與 20:00);winMin = 開賽前多少分鐘開放報名(公告窗口);tz = 切日與時刻的時區(東八區,同 EV_CFG.tz)
  sched: { tz: 8 * 3600000, slots: [1200], winMin: 30 },
  names: ['赤羽營', '北風隊', '黑山寨', '青龍軍', '白虎隊', '玄甲騎', '鐵壁營', '烈火隊', '飛雲寨', '虎賁營', '潛龍隊', '西涼軍', '江東隊', '河北營', '荊州隊', '潼關寨', '斷橋隊', '洛陽營', '長坂軍', '隴右隊', '渤海寨', '濮陽營', '巴丘隊', '并州軍'],
  ver: 1
};

function bnTourInt(v, lo, hi, d) { v = +v; if (!isFinite(v)) return d; v = Math.floor(v); return v < lo ? lo : (v > hi ? hi : v); }

// 戰力:各人 bnPower 加總(與 bnsPower 同義)
function bnTourPower(specs) { var p = 0; (specs || []).forEach(function (s) { p += bnPower(s); }); return p; }
// 兵種傾向:人數最多的兵種(平手依字母序取先者)
function bnTourArch(specs) {
  var c = {}, best = '', n = -1;
  (specs || []).forEach(function (s) { var k = s.dt === 'strat' ? '謀' : s.troop; c[k] = (c[k] || 0) + 1; });   // 謀略型算『謀』傾向(2026-11-16 謀不再是兵種)
  Object.keys(c).sort().forEach(function (k) { if (c[k] > n) { n = c[k]; best = k; } });
  return best;
}
// 各檔人數:最大餘數法,總和恰為 m
function bnTourBandCounts(m) {
  var bands = BN_TOURNEY.npc.bands, W = 0, out = [], rem = [], i, tot = 0, k, q;
  bands.forEach(function (b) { W += b.w; });
  for (i = 0; i < bands.length; i++) { q = m * bands[i].w / W; out.push(Math.floor(q)); rem.push({ i: i, f: q - Math.floor(q) }); tot += Math.floor(q); }
  rem.sort(function (a, b) { return b.f - a.f || a.i - b.i; });
  for (k = 0; tot < m && k < rem.length; k++) { out[rem[k].i]++; tot++; }
  return out;
}
// 快照清單驗證:1~16 隊;每隊 1~3 人(3 人隊伍)
function bnTourCheckSnaps(snaps) {
  var i, s;
  if (!Array.isArray(snaps) || snaps.length < 1 || snaps.length > BN_TOURNEY.n) return { ok: false, why: '隊伍數需 1~' + BN_TOURNEY.n + ' 隊' };
  for (i = 0; i < snaps.length; i++) {
    s = snaps[i];
    if (!s || !Array.isArray(s.specs) || s.specs.length < 1 || s.specs.length > 3) return { ok: false, why: '第 ' + (i + 1) + ' 隊人數需 1~3 人' };
  }
  return { ok: true };
}
// 單一系統隊候選:size 人,名人以 pFig 機率插入(同隊不重複),品階從 b.gr 隨機
function bnTourCand(rng, size, b, figIds) {
  var figs = [], i, id, used = {}, k;
  for (i = 0; i < size; i++) {
    id = null;
    if (rng() < b.pFig) {
      for (k = 0; k < 50; k++) { id = figIds[Math.floor(rng() * figIds.length)]; if (!used[id]) break; id = null; }
      if (id) used[id] = 1;
    }
    figs.push(id);
  }
  var team = bnRandomTeam(rng, size, function () { return b.gr[Math.floor(rng() * b.gr.length)]; }, figs);
  team.forEach(function (sp, k) { sp.row = [2, 1, 0][k]; sp.col = 0; });   // 3 人隊伍站位:主將 row 2 / 副將 row 1 / 副將 row 0,col 0
  return team;
}
// 補位:snaps 為玩家隊伍,其餘依 BN_TOURNEY.npc 生成;回 {ok, entrants:[16 隊,已依種子洗牌], refP, size, stats}
// entrants[i] = {id, name, owner:'me'|'npc', specs, power, ratio, band, inBand, arch}
function bnTourFill(seed, snaps) {
  var T = BN_TOURNEY, chk = bnTourCheckSnaps(snaps), m, refP = 0, sizeSum = 0, size, cnt, rng, figIds, teams = [], ctx = { above: 0, arch: {} }, bands = [], i, j, k, b, bi, t, best, fb, sc, c, p, arch, inBand, names, list, nm, specs, archOk, score;
  if (!chk.ok) return { ok: false, why: chk.why };
  m = T.n - snaps.length;
  snaps.forEach(function (s, i2) {
    var p2 = bnTourPower(s.specs);
    refP += p2; sizeSum += s.specs.length;
    teams.push({ id: 'p' + i2, name: String(s.name || ('隊伍 ' + (i2 + 1))).slice(0, 12), owner: 'me', specs: s.specs, power: p2, ratio: 0, band: 'me', inBand: true, arch: bnTourArch(s.specs) });
  });
  refP = refP / snaps.length;
  teams.forEach(function (x) { x.ratio = refP > 0 ? x.power / refP : 0; });
  size = bnTourInt(Math.round(sizeSum / snaps.length), 1, 3, T.npc.size);
  cnt = bnTourBandCounts(m);
  rng = bnRng(bnHash('bntf', seed >>> 0));
  figIds = Object.keys(BN_FIG_SKILLS).sort();
  for (i = 0; i < T.npc.bands.length; i++) for (j = 0; j < cnt[i]; j++) bands.push(i);
  names = T.names.slice();
  for (k = 0; k < bands.length; k++) {
    bi = bands[k]; b = T.npc.bands[bi];
    t = b.lo + (b.hi - b.lo) * rng();
    best = null; sc = Infinity; fb = null;
    for (c = 0; c < T.tryMax; c++) {
      specs = bnTourCand(rng, size, b, figIds);
      p = bnTourPower(specs) / refP;
      if (p > T.npc.capAbove && ctx.above >= T.npc.capN) {   // 超過 110% 的名額已滿:不收;但記下最接近目標者當保底(玩家隊伍很弱時 200 次全超標,不能整屆失敗)
        if (!fb || Math.abs(p - t) < fb.d) fb = { specs: specs, p: p, arch: bnTourArch(specs), inBand: false, d: Math.abs(p - t) };
        continue;
      }
      arch = bnTourArch(specs);
      inBand = p >= b.lo - T.npc.tol && p <= b.hi + T.npc.tol;
      archOk = (ctx.arch[arch] | 0) < T.npc.archMax;
      if (!archOk && c < T.tryMax - 1) continue;   // 兵種傾向名額已滿:一直抽到上限前都不收;真的抽不到才放寬(最後一次)
      score = Math.abs(p - t) + (archOk ? 0 : 10);
      if (score < sc) { sc = score; best = { specs: specs, p: p, arch: arch, inBand: inBand }; }
      if (inBand && archOk && Math.abs(p - t) <= T.npc.exact) break;
      if (c + 1 >= T.npc.tries && best) break;
    }
    if (!best) best = fb;
    if (!best) return { ok: false, why: '系統隊伍生成失敗(種子 ' + seed + ')' };
    if (best.p > T.npc.capAbove) ctx.above++;
    ctx.arch[best.arch] = (ctx.arch[best.arch] | 0) + 1;
    nm = names.splice(Math.floor(rng() * names.length), 1)[0] || ('系統隊 ' + (k + 1));
    teams.push({ id: 'n' + k, name: nm, owner: 'npc', specs: best.specs, power: bnTourPower(best.specs), ratio: best.p, band: b.k, inBand: best.inBand, arch: best.arch });
  }
  // 依種子洗牌,決定落位(玩家隊隨機落位)
  list = teams.slice();
  for (i = list.length - 1; i > 0; i--) { j = Math.floor(rng() * (i + 1)); t = list[i]; list[i] = list[j]; list[j] = t; }
  return { ok: true, entrants: list, refP: refP, size: size, stats: bnTourStats(list, refP) };
}
// 強度統計(供 UI 印出 / 測試):各檔數量、>cap 支數、NPC 平均相對戰力、兵種傾向、超出 ±tol 的支數
function bnTourStats(list, refP) {
  var st = { over: 0, npcN: 0, npcAvg: 0, bands: {}, arch: {}, outTol: 0, ratios: [], refP: refP }, sum = 0;
  list.forEach(function (x) {
    if (x.owner !== 'npc') return;
    st.npcN++; sum += x.ratio;
    st.ratios.push(Math.round(x.ratio * 1000) / 1000);
    if (x.ratio > BN_TOURNEY.npc.capAbove) st.over++;
    st.bands[x.band] = (st.bands[x.band] | 0) + 1;
    st.arch[x.arch] = (st.arch[x.arch] | 0) + 1;
    if (!x.inBand) st.outTol++;
  });
  st.npcAvg = st.npcN ? sum / st.npcN : 0;
  return st;
}

// 單淘汰對陣表(16 隊依 entrants 順序兩兩配對)。ref:{t:'e', i} 入場隊 / {t:'w', m} 某場勝者 / {t:'l', m} 某場敗者
function bnTourBracket() {
  var ms = [], i;
  for (i = 0; i < 8; i++) ms.push({ id: i, rk: 'r16', a: { t: 'e', i: 2 * i }, b: { t: 'e', i: 2 * i + 1 } });
  for (i = 0; i < 4; i++) ms.push({ id: 8 + i, rk: 'qf', a: { t: 'w', m: 2 * i }, b: { t: 'w', m: 2 * i + 1 } });
  for (i = 0; i < 2; i++) ms.push({ id: 12 + i, rk: 'sf', a: { t: 'w', m: 8 + 2 * i }, b: { t: 'w', m: 8 + 2 * i + 1 } });
  ms.push({ id: 14, rk: 'third', a: { t: 'l', m: 12 }, b: { t: 'l', m: 13 } });
  ms.push({ id: 15, rk: 'final', a: { t: 'w', m: 12 }, b: { t: 'w', m: 13 } });
  return ms;
}
// 一場(局數依 rk 的 Bo 數;先到半數以上獲勝)。unitsA / unitsB = bnBuildTeam(specs).units。平手以種子雜湊決勝(確定性)
function bnTourPlay(seed, mid, rk, unitsA, unitsB) {
  var bo = BN_TOURNEY.bo[rk] || 1, need = (bo >> 1) + 1, wins = { A: 0, B: 0 }, games = [], g, gs, S, w, rec;
  for (g = 0; g < bo && wins.A < need && wins.B < need; g++) {
    gs = bnHash('bntg', seed >>> 0, mid, g);
    rec = { v: BN_REC_VER, seed: gs,teamA: JSON.parse(JSON.stringify(unitsA)), teamB: JSON.parse(JSON.stringify(unitsB)), opts: { events: false } };
    S = bnRun(rec);
    w = S.result.winner;
    if (w === 'draw') w = (bnHash('bntd', gs) % 2 === 0) ? 'A' : 'B';
    wins[w]++;
    games.push({ seed: gs, w: w, r: S.result.rounds, why: S.result.reason });
  }
  return { w: wins.A > wins.B ? 'A' : 'B', wins: wins, games: games };
}
// 整屆:補位 → 對陣 → 逐場結果 → 名次。
// 回 {ok, seed, entrants, refP, stats, matches:[{id, rk, ea, eb, w, wins, games}], rank:[entrant 索引→名次]}
// rank:1 冠、2 亞、3 季、4 殿軍(季軍賽敗者)、5 八強(QF 敗者)、9 十六強(R16 敗者)
function bnTourRun(seed, snaps) {
  var fill = bnTourFill(seed, snaps), ms, out = [], units = [], i, r, rank = [], winnerOf = {}, loserOf = {};
  if (!fill.ok) return fill;
  fill.entrants.forEach(function (x, k) { units[k] = bnBuildTeam(x.specs).units; });
  ms = bnTourBracket();
  ms.forEach(function (mt) {
    var ea, eb, rec;
    ea = mt.a.t === 'e' ? mt.a.i : (mt.a.t === 'w' ? winnerOf[mt.a.m] : loserOf[mt.a.m]);
    eb = mt.b.t === 'e' ? mt.b.i : (mt.b.t === 'w' ? winnerOf[mt.b.m] : loserOf[mt.b.m]);
    r = bnTourPlay(seed, mt.id, mt.rk, units[ea], units[eb]);
    winnerOf[mt.id] = r.w === 'A' ? ea : eb;
    loserOf[mt.id] = r.w === 'A' ? eb : ea;
    rec = { id: mt.id, rk: mt.rk, ea: ea, eb: eb, w: r.w, wins: r.wins, games: r.games };
    out.push(rec);
  });
  rank[winnerOf[15]] = 1; rank[loserOf[15]] = 2; rank[winnerOf[14]] = 3; rank[loserOf[14]] = 4;
  ms.forEach(function (mt) { if (mt.rk === 'qf') rank[loserOf[mt.id]] = 5; if (mt.rk === 'r16') rank[loserOf[mt.id]] = 9; });
  for (i = 0; i < fill.entrants.length; i++) if (!rank[i]) rank[i] = 9;
  return { ok: true, seed: seed >>> 0, entrants: fill.entrants, refP: fill.refP, stats: fill.stats, matches: out, rank: rank };
}
// 獎勵方案(依名次;1 / 2 / 3 各一檔,其餘 = 參加獎)
function bnTourRewardPlan(rank) {
  var R = BN_TOURNEY.reward;
  if (rank === 1) return R.champ;
  if (rank === 2) return R.runner;
  if (rank === 3) return R.third;
  return R.join;
}
// 存檔正規化(壞值夾住;不認得的欄位丟棄)。d = {v, seq, cd, last, hist, rw}
// last = {id, seed, ts, dv, pl:[{name, specs}], lid:{'場次:局': 戰報 id}};hist = [{id, ts, champ, champOwn, runner, third, mine, mineN}]
// 整屆由 seed + pl 確定性重算,不存對陣結果以外的快照
function bnTourNorm(o) {
  var d = { v: 2, seq: 0, cd: 0, last: null, hist: [], rw: 0, reg: null, shown: 0, done: 0, mute: 0, remind: true, auto: false, tt: null }, l, g;
  if (!o || typeof o !== 'object') return d;
  d.shown = bnTourInt(o.shown, 0, 1e12, 0);
  d.done = bnTourInt(o.done, 0, 1e12, 0);
  d.mute = bnTourInt(o.mute, 0, 1e12, 0);
  d.remind = o.remind === false ? false : true;
  d.auto = o.auto === true;
  g = o.reg;
  if (g && typeof g === 'object' && Array.isArray(g.specs) && g.specs.length >= 1 && g.specs.length <= 3 && g.specs.every(function (s) { return s && typeof s === 'object'; }) && bnTourInt(g.id, 0, 1e12, 0) > 0) {
    d.reg = { id: bnTourInt(g.id, 0, 1e12, 0), start: bnTourInt(g.start, 0, 1e15, 0), ts: bnTourInt(g.ts, 0, 1e15, 0), name: String(g.name || '').slice(0, 12), specs: g.specs };
  }
  if (o.tt && typeof o.tt === 'object' && Array.isArray(o.tt.slots)) {   // 擂台隊伍儲存當下的快照(來源隊號 / 兵種;js/bn_tourney_team.js 用來標「與出征隊伍不同步」)
    d.tt = { ts: bnTourInt(o.tt.ts, 0, 1e15, 0), slots: o.tt.slots.filter(function (x) { return x && typeof x.id === 'string'; }).slice(0, 3).map(function (x) { return { id: String(x.id).slice(0, 40), n: bnTourInt(x.n, 0, 5, 0), troop: String(x.troop || '').slice(0, 2) }; }) };
  }
  d.seq = bnTourInt(o.seq, 0, 1e9, 0);
  d.cd = bnTourInt(o.cd, 0, 1e15, 0);
  d.rw = bnTourInt(o.rw, 0, 1e9, 0);
  if (Array.isArray(o.hist)) d.hist = o.hist.filter(function (h) { return h && typeof h === 'object'; }).slice(0, BN_TOURNEY.histMax).map(function (h) {
    return { id: bnTourInt(h.id, 0, 1e9, 0), ts: bnTourInt(h.ts, 0, 1e15, 0), champ: String(h.champ || '').slice(0, 12), champOwn: h.champOwn === 'me' ? 'me' : 'npc', runner: String(h.runner || '').slice(0, 12), third: String(h.third || '').slice(0, 12), mine: bnTourInt(h.mine, 0, 16, 0), mineN: bnTourInt(h.mineN, 0, 16, 0) };
  });
  if (o.last && typeof o.last === 'object' && Array.isArray(o.last.pl) && o.last.pl.length >= 1 && o.last.pl.length <= BN_TOURNEY.n) {
    l = { id: bnTourInt(o.last.id, 0, 1e9, 0), seed: bnTourInt(o.last.seed, 0, 4294967295, 0), ts: bnTourInt(o.last.ts, 0, 1e15, 0), dv: String(o.last.dv || '').slice(0, 24), pl: o.last.pl, lid: {}, rk: bnTourInt(o.last.rk, 0, 16, 0) };
    if (o.last.lid && typeof o.last.lid === 'object') Object.keys(o.last.lid).forEach(function (k) { if (/^\d+:\d+$/.test(k) && typeof o.last.lid[k] === 'string') l.lid[k] = o.last.lid[k].slice(0, 40); });
    d.last = l;
  }
  return d;
}
// 冷卻:絕對時間點(離線也算)。回 {ok, left 毫秒}
function bnTourCooldown(d, now) {
  var left = (d.cd | 0) - now;
  return { ok: left <= 0, left: left > 0 ? left : 0 };
}
// 寫入歷屆紀錄(最新在前,最多 histMax 筆)
function bnTourHistAdd(d, rec) {
  d.hist = [rec].concat(d.hist || []).slice(0, BN_TOURNEY.histMax);
  return d;
}

// ───────── 固定時間排程(純邏輯;now = 毫秒時間戳,由呼叫端傳入)─────────
// 第 day 日(依 sched.tz 切日)第 si 個時段
function bnTourSlot(day, si) {
  var S = BN_TOURNEY.sched, DAY = 86400000, start = day * DAY - S.tz + S.slots[si] * 60000;
  return { id: day * 100 + si, day: day, si: si, start: start, open: start - S.winMin * 60000, seed: bnTourSeedOf(day * 100 + si) };
}
// 開賽時刻文字,例 '20:00' / '12:00、20:00'
function bnTourSlotsText() {
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return BN_TOURNEY.sched.slots.slice().sort(function (a, b) { return a - b; }).map(function (m) { return p(Math.floor(m / 60)) + ':' + p(m % 60); }).join('、');
}
function bnTourSeedOf(id) { return bnHash('bnts', id) >>> 0; }
// → {cur: 報名窗口開著的時段 | null, next: 開賽時間在 now 之後的最近時段, prev: 開賽時間 <= now 的最近時段 | null, day}
function bnTourSched(now) {
  var S = BN_TOURNEY.sched, DAY = 86400000, day = Math.floor((now + S.tz) / DAY), out = { cur: null, next: null, prev: null, day: day }, dd, i, sl, order = [];
  for (i = 0; i < S.slots.length; i++) order.push(i);
  order.sort(function (a, b) { return S.slots[a] - S.slots[b]; });
  for (dd = day - 2; dd <= day + 2; dd++) {
    for (i = 0; i < order.length; i++) {
      sl = bnTourSlot(dd, order[i]);
      if (sl.start <= now) out.prev = sl;
      else if (!out.next) out.next = sl;
      if (!out.cur && now >= sl.open && now < sl.start) out.cur = sl;
    }
  }
  return out;
}
// 時間 → 'M/D HH:MM'(sched.tz)
function bnTourClock(ts) {
  var d = new Date(ts + BN_TOURNEY.sched.tz), p = function (n) { return (n < 10 ? '0' : '') + n; };
  return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}
// 目前狀態:phase = 'open'(報名窗口)| 'wait'(等下一屆);left = 距離下一次開賽毫秒;winLeft = open 時距窗口結束(= 開賽)毫秒;reg = 本時段已報名;
// slot = open 時是目前窗口的時段,wait 時是下一屆時段;toOpen = wait 時距窗口開啟毫秒
function bnTourStatus(d, now) {
  var sc = bnTourSched(now), sl = sc.cur || sc.next;
  return { phase: sc.cur ? 'open' : 'wait', slot: sl, left: sl ? sl.start - now : 0, toOpen: sc.cur ? 0 : (sl ? sl.open - now : 0), winLeft: sc.cur ? sc.cur.start - now : 0, reg: !!(d && d.reg && sl && d.reg.id === sl.id), prev: sc.prev };
}
// 報名:窗口內、尚未結算過該時段、快照合格 → 寫入 d.reg。回 {ok, why, slot}
function bnTourRegister(d, now, snap) {
  var sc = bnTourSched(now), sl = sc.cur, chk;
  if (!sl) return { ok: false, why: '目前不在報名時間' };
  if (sl.id <= d.done) return { ok: false, why: '該屆已結束' };
  if (d.reg && d.reg.id === sl.id) return { ok: true, already: true, slot: sl };
  chk = bnTourCheckSnaps([snap]);
  if (!chk.ok) return { ok: false, why: chk.why };
  d.reg = { id: sl.id, start: sl.start, ts: now, name: String(snap.name || '代表隊伍').slice(0, 12), specs: JSON.parse(JSON.stringify(snap.specs)) };
  return { ok: true, slot: sl };
}
// 該彈公告嗎?窗口內、提醒開著、此時段沒彈過 / 沒結算 / 沒報名、今天沒按『不再提醒』。回時段或 null(錯過窗口不補彈;時間倒退因 shown 單調不重彈)
function bnTourPopupDue(d, now) {
  var sl = bnTourSched(now).cur;
  if (!sl || !d.remind) return null;
  if (sl.id <= d.shown || sl.id <= d.done || (d.reg && d.reg.id === sl.id) || d.mute === sl.day) return null;
  return sl;
}
// 該自動報名嗎?窗口內、自動報名開著、此時段沒處理過 / 沒結算 / 沒報名。回時段或 null
function bnTourAutoDue(d, now) {
  var sl = bnTourSched(now).cur;
  if (!sl || !d.auto) return null;
  if (sl.id <= d.shown || sl.id <= d.done || (d.reg && d.reg.id === sl.id)) return null;
  return sl;
}
// 有報名的屆已開賽、還沒結算 → 回 d.reg(結算 / 補算);已結算過(id <= done)的殘留報名不算
function bnTourSettleDue(d, now) {
  if (!d.reg || d.reg.id <= d.done) return null;
  return now >= d.reg.start ? d.reg : null;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { BN_TOURNEY: BN_TOURNEY };
