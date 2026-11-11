// js/bn_tourney.js — 戰隊擂台(第一版:單機 + 系統隊伍)。純邏輯、無 DOM、不讀時間(時間由呼叫端傳入)、不用 Math.random。ES2017;不用 ?. ??。
// 16 隊單淘汰:16→8→4→決賽,加一場季軍賽(半決賽敗者),比出第 1 / 2 / 3 名。Bo 數見 BN_TOURNEY.bo(決賽 Bo3)。
// 快照清單 snaps = [{name, specs:[bnUnitSpec…]}](1~16 隊;玩家隊伍由呼叫端給,不足 16 隊由 bnTourFill 依種子補系統隊伍)。
// 系統隊伍強度以『玩家平均戰力 refP』為基準(戰力 = 各人 bnPower 加總),依 BN_TOURNEY.npc.bands 分檔;> capAbove 的最多 capN 支。
// 整屆確定性:同 seed + 同快照 = 同結果(bnTourRun);每場每局的種子 = bnHash('bntg', seed, 場次 id, 第幾局)。
// 載入順序:bn_data.js → bn_skills_data.js → bn_units.js → bn_engine.js → bn_tourney.js(隨機名冊卡另需 carddata.js / cards.js)。
// 全域:BN_TOURNEY bnTourPower bnTourArch bnTourBandCounts bnTourCheckSnaps bnTourFill bnTourBracket bnTourPlay bnTourRun bnTourRewardPlan bnTourNorm bnTourCooldown bnTourHistAdd

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
    capAbove: 1.10, capN: 2, tol: 0.05, exact: 0.03, tries: 30, archMax: 4, size: 5
  },
  // 名次獎勵(mat = 第 1 章貨物數量;shards = 碎片;coin = 金幣)。冠 > 亞 > 季 > 參加
  reward: {
    champ: { coin: 3000, mat: 4, shards: 30 },
    runner: { coin: 1800, mat: 3, shards: 20 },
    third: { coin: 1000, mat: 2, shards: 12 },
    join: { coin: 300, mat: 1, shards: 0 }
  },
  names: ['赤羽營', '北風隊', '黑山寨', '青龍軍', '白虎隊', '玄甲騎', '鐵壁營', '烈火隊', '飛雲寨', '虎賁營', '潛龍隊', '西涼軍', '江東隊', '河北營', '荊州隊', '潼關寨', '斷橋隊', '洛陽營', '長坂軍', '隴右隊', '渤海寨', '濮陽營', '巴丘隊', '并州軍'],
  ver: 1
};

function bnTourInt(v, lo, hi, d) { v = +v; if (!isFinite(v)) return d; v = Math.floor(v); return v < lo ? lo : (v > hi ? hi : v); }

// 戰力:各人 bnPower 加總(與 bnsPower 同義)
function bnTourPower(specs) { var p = 0; (specs || []).forEach(function (s) { p += bnPower(s); }); return p; }
// 兵種傾向:人數最多的兵種(平手依字母序取先者)
function bnTourArch(specs) {
  var c = {}, best = '', n = -1;
  (specs || []).forEach(function (s) { c[s.troop] = (c[s.troop] || 0) + 1; });
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
// 快照清單驗證:1~16 隊;每隊 1~5 人
function bnTourCheckSnaps(snaps) {
  var i, s;
  if (!Array.isArray(snaps) || snaps.length < 1 || snaps.length > BN_TOURNEY.n) return { ok: false, why: '隊伍數需 1~' + BN_TOURNEY.n + ' 隊' };
  for (i = 0; i < snaps.length; i++) {
    s = snaps[i];
    if (!s || !Array.isArray(s.specs) || s.specs.length < 1 || s.specs.length > 5) return { ok: false, why: '第 ' + (i + 1) + ' 隊人數需 1~5 人' };
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
  return bnRandomTeam(rng, size, function () { return b.gr[Math.floor(rng() * b.gr.length)]; }, figs);
}
// 補位:snaps 為玩家隊伍,其餘依 BN_TOURNEY.npc 生成;回 {ok, entrants:[16 隊,已依種子洗牌], refP, size, stats}
// entrants[i] = {id, name, owner:'me'|'npc', specs, power, ratio, band, inBand, arch}
function bnTourFill(seed, snaps) {
  var T = BN_TOURNEY, chk = bnTourCheckSnaps(snaps), m, refP = 0, sizeSum = 0, size, cnt, rng, figIds, teams = [], ctx = { above: 0, arch: {} }, bands = [], i, j, k, b, bi, t, best, sc, c, p, arch, inBand, names, list, nm, specs, archOk, score;
  if (!chk.ok) return { ok: false, why: chk.why };
  m = T.n - snaps.length;
  snaps.forEach(function (s, i2) {
    var p2 = bnTourPower(s.specs);
    refP += p2; sizeSum += s.specs.length;
    teams.push({ id: 'p' + i2, name: String(s.name || ('隊伍 ' + (i2 + 1))).slice(0, 12), owner: 'me', specs: s.specs, power: p2, ratio: 0, band: 'me', inBand: true, arch: bnTourArch(s.specs) });
  });
  refP = refP / snaps.length;
  teams.forEach(function (x) { x.ratio = refP > 0 ? x.power / refP : 0; });
  size = bnTourInt(Math.round(sizeSum / snaps.length), 1, 5, T.npc.size);
  cnt = bnTourBandCounts(m);
  rng = bnRng(bnHash('bntf', seed >>> 0));
  figIds = Object.keys(BN_FIG_SKILLS).sort();
  for (i = 0; i < T.npc.bands.length; i++) for (j = 0; j < cnt[i]; j++) bands.push(i);
  names = T.names.slice();
  for (k = 0; k < bands.length; k++) {
    bi = bands[k]; b = T.npc.bands[bi];
    t = b.lo + (b.hi - b.lo) * rng();
    best = null; sc = Infinity;
    for (c = 0; c < T.tryMax; c++) {
      specs = bnTourCand(rng, size, b, figIds);
      p = bnTourPower(specs) / refP;
      if (p > T.npc.capAbove && ctx.above >= T.npc.capN) continue;   // 超過 110% 的名額已滿
      arch = bnTourArch(specs);
      inBand = p >= b.lo - T.npc.tol && p <= b.hi + T.npc.tol;
      archOk = (ctx.arch[arch] | 0) < T.npc.archMax;
      if (!archOk && c < T.tryMax - 1) continue;   // 兵種傾向名額已滿:一直抽到上限前都不收;真的抽不到才放寬(最後一次)
      score = Math.abs(p - t) + (archOk ? 0 : 10);
      if (score < sc) { sc = score; best = { specs: specs, p: p, arch: arch, inBand: inBand }; }
      if (inBand && archOk && Math.abs(p - t) <= T.npc.exact) break;
      if (c + 1 >= T.npc.tries && best) break;
    }
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
    rec = { v: 1, seed: gs, teamA: JSON.parse(JSON.stringify(unitsA)), teamB: JSON.parse(JSON.stringify(unitsB)), opts: { events: false } };
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
  var d = { v: 1, seq: 0, cd: 0, last: null, hist: [], rw: 0 }, l;
  if (!o || typeof o !== 'object') return d;
  d.seq = bnTourInt(o.seq, 0, 1e9, 0);
  d.cd = bnTourInt(o.cd, 0, 1e15, 0);
  d.rw = bnTourInt(o.rw, 0, 1e9, 0);
  if (Array.isArray(o.hist)) d.hist = o.hist.filter(function (h) { return h && typeof h === 'object'; }).slice(0, BN_TOURNEY.histMax).map(function (h) {
    return { id: bnTourInt(h.id, 0, 1e9, 0), ts: bnTourInt(h.ts, 0, 1e15, 0), champ: String(h.champ || '').slice(0, 12), champOwn: h.champOwn === 'me' ? 'me' : 'npc', runner: String(h.runner || '').slice(0, 12), third: String(h.third || '').slice(0, 12), mine: bnTourInt(h.mine, 0, 16, 0), mineN: bnTourInt(h.mineN, 0, 16, 0) };
  });
  if (o.last && typeof o.last === 'object' && Array.isArray(o.last.pl) && o.last.pl.length >= 1 && o.last.pl.length <= BN_TOURNEY.n) {
    l = { id: bnTourInt(o.last.id, 0, 1e9, 0), seed: bnTourInt(o.last.seed, 0, 4294967295, 0), ts: bnTourInt(o.last.ts, 0, 1e15, 0), dv: String(o.last.dv || '').slice(0, 24), pl: o.last.pl, lid: {} };
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
if (typeof module !== 'undefined' && module.exports) module.exports = { BN_TOURNEY: BN_TOURNEY };
