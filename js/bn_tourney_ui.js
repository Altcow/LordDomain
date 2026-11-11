// js/bn_tourney_ui.js — 戰隊擂台 UI(面板掛在 #bnLayer 內,沿用 bnshare 的面板模式;回播沿用戰鬥畫面 bnu / bnPl*,結果畫面沿用 bnui 的結算)。
// 入口:戰鬥入口第 5 顆鈕 data-t="tourney" → bnUiEntryDo → bnTourOpen()。返回鍵:bnUiBack → bnTourBack()(結算畫面 → 回擂台面板)。
// 流程:選隊(3 組預設或目前布陣)→ 開一屆(bnTourRun 一次算完 16 場,寫存檔 lorddomain.tourney.v1、戰報箱記下玩家的局)→ 對陣圖逐場回播 / 直接看結果 → 名次獎勵(只發一次,st.rw 防重領)。
// 回播不自動寫戰報(bnu.rec = null);玩家的局在開一屆時已寫入戰報箱,結算畫面的『查看戰報』開該局。
// 不發聲(回播音效經 bndraw 的守衛)。ES2017;不用 ?. ??。
// 全域:BNT bnTourOpen bnTourClose bnTourIsOpen bnTourBack bnTourOnResult bnTourLoad bnTourSave bnTourStart bnTourRender

var BNT = { el: null, timer: 0, pick: 0, store: null, run: null, runSeed: -1, stale: false, cur: null, seen: {}, css: false, msg: '' };

function bnTourLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function bnTourLsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function bnTourEsc(s) { return (typeof bnUiEsc === 'function') ? bnUiEsc(s) : String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bnTourToast(m) { if (typeof bnUiToast === 'function') bnUiToast(m); }
function bnTourLoad() {
  var raw = bnTourLsGet(BN_TOURNEY.key), o = null;
  if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  BNT.store = bnTourNorm(o);
  return BNT.store;
}
function bnTourSave() {
  try { return bnTourLsSet(BN_TOURNEY.key, JSON.stringify(BNT.store)); } catch (e) { return false; }
}
function bnTourFmt(ms) {
  var s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, p = function (n) { return (n < 10 ? '0' : '') + n; };
  return p(h) + ':' + p(m) + ':' + p(x);
}
// 玩家可選的隊伍:3 組預設(有人才列)+ 目前布陣。回 [{key, name, specs}]
function bnTourSpecsOf(slots) {
  var out = [], list = (typeof bnTeamOrder === 'function') ? bnTeamOrder(slots) : slots;
  list.forEach(function (s) {
    var e = bnUiEntry(s.id), sp;
    if (!e || out.length >= 5) return;
    sp = bnUiSpec(e, { troop: s.troop || (bnu.tp && bnu.tp[s.id]) || '', row: s.row, col: s.col });
    out.push(JSON.parse(JSON.stringify(sp)));
  });
  return out;
}
function bnTourSources() {
  var out = [], i, p, sp;
  for (i = 1; i <= 3; i++) {
    p = bnTeamPresetGet(i);
    if (!p || p.empty) continue;
    sp = bnTourSpecsOf(p.slots);
    if (sp.length) out.push({ key: 'preset' + i, name: p.name, specs: sp });
  }
  if (bnu.slots && bnu.slots.length) {
    sp = bnTourSpecsOf(bnu.slots);
    if (sp.length) out.push({ key: 'cur', name: '目前布陣', specs: sp });
  }
  return out;
}
// 名次 → 文字
var BNT_RK = { r16: '16 強', qf: '8 強', sf: '4 強', third: '季軍賽', final: '決賽' };
var BNT_COL = [['r16', [0, 1, 2, 3, 4, 5, 6, 7]], ['qf', [8, 9, 10, 11]], ['sf', [12, 13]], ['fin', [15, 14]]];

// 開一屆:選隊 → 整屆一次算完 → 存檔 + 戰報箱(玩家的局)+ 歷屆。回 true / false(訊息經 toast)
function bnTourStart() {
  var st = bnTourLoad(), now = Date.now(), cd = bnTourCooldown(st, now), list = bnTourSources(), sel, snaps, seed, r, dv;
  if (!cd.ok) { bnTourToast('冷卻中,' + bnTourFmt(cd.left) + ' 後可再開'); return false; }
  sel = list[BNT.pick] || list[0];
  if (!sel) { bnTourToast('先在布陣放好隊伍,或存入一組預設隊伍'); return false; }
  snaps = [{ name: sel.name, specs: sel.specs }];
  if (!bnTourCheckSnaps(snaps).ok) { bnTourToast('隊伍人數需 1~5 人'); return false; }
  st.seq += 1;
  seed = bnHash('bntour', st.seq, now) >>> 0;
  r = bnTourRun(seed, snaps);
  if (!r.ok) { bnTourToast(r.why); return false; }
  dv = (typeof bnsDataVer === 'function') ? bnsDataVer() : '';
  st.last = { id: st.seq, seed: seed, ts: now, dv: dv, pl: [{ name: sel.name, specs: sel.specs }], lid: {} };
  st.cd = now + BN_TOURNEY.cooldownH * 3600000;
  bnTourLogMine(st, r);
  bnTourHistAdd(st, bnTourHistRec(st, r));
  bnTourSave();
  BNT.run = r; BNT.runSeed = seed; BNT.stale = false; BNT.seen = {}; BNT.cur = null;
  bnTourRender();
  return true;
}
// 玩家的局寫入戰報箱(events 開啟重跑同一局,結果與回播一致)
function bnTourLogMine(st, r) {
  var mine = -1, i, rec, S, lg, stg;
  for (i = 0; i < r.entrants.length; i++) if (r.entrants[i].owner === 'me') { mine = i; break; }
  if (mine < 0 || typeof bnLogRecord !== 'function') return;
  r.matches.forEach(function (mt) {
    if (mt.ea !== mine && mt.eb !== mine) return;
    mt.games.forEach(function (gm, gi) {
      try {
        rec = bnTourRec(r, mt, gi);
        S = bnRun(JSON.parse(JSON.stringify(rec)));
        stg = { w: S.result.winner, why: S.result.reason, r: S.result.rounds, st: 0 };
        lg = bnLogBuild(S, rec, { label: '擂台 ' + BNT_RK[mt.rk] + (mt.games.length > 1 ? ' 第' + (gi + 1) + '局' : ''), kind: 'tourney', sid: 'T', stars: [], res: stg });
        bnLogRecord(lg, rec);
        st.last.lid[mt.id + ':' + gi] = lg.id;
      } catch (e) { /* 單局寫戰報失敗不影響整屆 */ }
    });
  });
}
// 一局的開戰紀錄(與 bnui bnUiRec 同形;種子取自該局)
function bnTourRec(r, mt, gi) {
  var A = bnBuildTeam(r.entrants[mt.ea].specs), B = bnBuildTeam(r.entrants[mt.eb].specs);
  return { v: 1, seed: mt.games[gi].seed, teamA: A.units, teamB: B.units, opts: { events: true, scene: '' }, meta: { stage: 'T', kind: 'tourney', ch: 0, foePower: 0, scale: 1, bonds: A.bonds, formation: A.formation } };
}
function bnTourHistRec(st, r) {
  var mine = -1, i, best = 99, mineN = 0, champ = r.entrants[r.rank.indexOf(1)], run = r.entrants[r.rank.indexOf(2)], th = r.entrants[r.rank.indexOf(3)];
  for (i = 0; i < r.entrants.length; i++) if (r.entrants[i].owner === 'me') { mineN++; if (mine < 0) mine = i; if (r.rank[i] < best) best = r.rank[i]; }
  return { id: st.last.id, ts: st.last.ts, champ: champ ? champ.name : '', champOwn: champ && champ.owner === 'me' ? 'me' : 'npc', runner: run ? run.name : '', third: th ? th.name : '', mine: mineN ? best : 0, mineN: mineN };
}
// 讀入目前屆(存檔有但記憶體沒有時,依 seed + pl 確定性重算)
function bnTourEnsureRun() {
  var st = BNT.store, L = st && st.last;
  if (!L) { BNT.run = null; return null; }
  if (BNT.run && BNT.runSeed === L.seed) return BNT.run;
  BNT.stale = !!(typeof bnsDataVer === 'function' && L.dv && L.dv !== bnsDataVer());
  if (BNT.stale) { BNT.run = null; return null; }
  BNT.run = bnTourRun(L.seed, L.pl); BNT.runSeed = L.seed;
  if (!BNT.run.ok) { BNT.run = null; BNT.stale = true; }
  return BNT.run;
}
// 整屆獎勵(只發一次):玩家隊的名次 → bnTourRewardPlan。env 與戰鬥結算同一組(bnStgEnv)
function bnTourGrant() {
  var st = BNT.store, r, mine = -1, i, plan, env, gid, rank;
  if (!st || !st.last || st.rw === st.last.id) return null;
  r = bnTourEnsureRun();
  if (!r || !r.ok) return null;
  for (i = 0; i < r.entrants.length; i++) if (r.entrants[i].owner === 'me') { mine = i; break; }
  if (mine < 0) return null;
  rank = r.rank[mine];
  plan = bnTourRewardPlan(rank);
  env = (typeof bnStgEnv === 'function') ? bnStgEnv() : null;
  if (env) {
    if (plan.coin) env.coin(plan.coin);
    if (plan.shards) env.shards(plan.shards);
    gid = (typeof bnStgChapter === 'function' && bnStgChapter(1)) ? bnStgChapter(1).mats[0] : '';
    if (plan.mat && gid) env.goods(gid, plan.mat);
  }
  st.rw = st.last.id;
  bnTourSave();
  try { if (typeof saveWorld === 'function') saveWorld(); } catch (e) { /* 略過 */ }
  return { rank: rank, plan: plan };
}
function bnTourNext() {
  var r = BNT.run, i, m, g;
  if (!r) return null;
  for (i = 0; i < r.matches.length; i++) {
    m = r.matches[i];
    for (g = 0; g < m.games.length; g++) if (!BNT.seen[m.id + ':' + g]) return { mid: m.id, g: g };
  }
  return null;
}
// 回播一局(沿用戰鬥畫面;bnu.rec = null 不另寫戰報)
function bnTourReplay(mid, g) {
  var r = bnTourEnsureRun(), mt, rec;
  if (!r || !r.ok) { bnTourToast('此屆為舊版規則,無法回播'); return false; }
  mt = r.matches.filter(function (x) { return x.id === mid; })[0];
  if (!mt || !mt.games[g]) return false;
  rec = bnTourRec(r, mt, g);
  BNT.cur = { mid: mid, g: g };
  return bnTourFight(rec);
}
function bnTourFight(rec) {
  var S, P;
  if (typeof bnu === 'undefined' || !bnu.open || !bnu.layer) return false;
  bnTourClose();
  if (typeof bnLogClose === 'function') bnLogClose();
  if (bnu.P) { bnPlDispose(bnu.P); bnu.P = null; }
  bnUiStopLoop();
  bnu.stg = { kind: 'tourney', id: 'T' }; BNUI.stage = 'T';
  bnu.rec = null;
  S = bnInit(rec);
  bnUiSetPhase('fight');
  bnUiShowRes(false); bnUiShowPause(false); bnUiCutRender(null);
  bnUiResize();
  P = bnPlNew(S, bnu.L, { speed: bnUiPref().spd, hooks: bnUiHooks(), powerSave: bnUiPs(), sfx: true });
  bnu.P = P; bnu.result = null; bnu.paused = false; bnu.retreat = false; bnu.manual = false; bnu.logId = '';
  bnUiSyncBtns();
  if (bnu.roundEl) bnu.roundEl.textContent = '';
  bnUiResize();
  bnUiLoop(true);
  return true;
}
// bnui.js bnUiShowResult 結尾呼叫:擂台回播 → 還原說明、改按鈕(查看戰報 / 回擂台),標記已看;全部看完就發獎勵
function bnTourOnResult(d) {
  var C = BNT.cur, g = bnu.stg, lid, h, row, p, all;
  if (!C || !g || g.kind !== 'tourney' || !bnu.resEl) return false;
  BNT.seen[C.mid + ':' + C.g] = 1;
  lid = (BNT.store && BNT.store.last && BNT.store.last.lid[C.mid + ':' + C.g]) || '';
  bnu.logId = lid;
  h = bnu.resEl.innerHTML;
  h = h.replace(/<p[^>]*>練兵不計戰績、不給獎勵<\/p>/, '<p class="bs-rn">擂台回播:名次獎勵於整屆看完後發放</p>');
  row = '<div class="row bnres-row">' + (lid ? '<button data-tt="log" class="pri">查看戰報</button>' : '') + '<button data-tt="back"' + (lid ? '' : ' class="pri"') + '>回擂台</button></div>';
  h = h.replace(/<div class="row bnres-row">[\s\S]*?<\/div>/, row);
  bnu.resEl.innerHTML = h;
  if (!bnu.resEl.bnTourOn) { bnu.resEl.addEventListener('click', bnTourResClick); bnu.resEl.bnTourOn = 1; }
  all = bnTourNext() === null;
  if (all) { p = bnTourGrant(); if (p) bnTourToast('擂台名次獎勵已發放'); }
  bnu.stg = { kind: 'tourney', id: 'T' };
  return true;
}
function bnTourResClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-tt]') : null, a;
  if (!b) return;
  if (e.stopPropagation) e.stopPropagation();
  a = b.getAttribute('data-tt');
  if (a === 'log' && typeof bnLogOpen === 'function') bnLogOpen('recent', bnu.logId || '');
  else if (a === 'back') bnTourLeaveFight();
}
// 結算畫面 → 回擂台面板(戰鬥結束後的狀態還原,不回布陣)
function bnTourLeaveFight() {
  if (bnu.P) { bnPlDispose(bnu.P); bnu.P = null; }
  bnUiStopLoop();
  bnUiShowRes(false); bnUiShowPause(false); bnUiCutRender(null);
  bnu.paused = false;
  bnu.stg = { kind: 'practice', id: 'P' }; BNUI.stage = 'P';
  bnUiSetPhase('entry');
  bnUiRenderEntry();
  bnTourOpen();
}
// bnui.js bnUiBack 呼叫:只處理結算畫面(戰鬥中由暫停選單處理)
function bnTourBack() {
  if (bnTourIsOpen()) { bnTourClose(); return true; }
  if (bnu.stg && bnu.stg.kind === 'tourney' && bnu.phase === 'res') { bnTourLeaveFight(); return true; }
  return false;
}

// ───────── 面板 ─────────
function bnTourIsOpen() { return !!(BNT.el && BNT.el.parentNode && typeof bnu !== 'undefined' && BNT.el.parentNode === bnu.layer); }
function bnTourClose() {
  var el = BNT.el;
  if (BNT.timer && typeof clearInterval === 'function') clearInterval(BNT.timer);
  BNT.timer = 0;
  if (!el) return false;
  el.removeEventListener('click', bnTourOnClick);
  if (el.parentNode) el.parentNode.removeChild(el);
  BNT.el = null;
  return true;
}
function bnTourOpen() {
  var el;
  if (typeof bnu === 'undefined' || !bnu.open || !bnu.layer) return false;
  if (bnu.phase === 'fight') return false;
  bnTourCss();
  if (!bnTourIsOpen()) {
    el = document.createElement('div');
    el.id = 'bnTour';
    el.addEventListener('click', bnTourOnClick);
    bnu.layer.appendChild(el);
    BNT.el = el;
  }
  bnTourLoad();
  BNT.msg = '';
  bnTourRender();
  if (!BNT.timer && typeof setInterval === 'function') BNT.timer = setInterval(bnTourTick, 1000);
  return true;
}
function bnTourTick() {
  var c = BNT.el && BNT.el.querySelector ? BNT.el.querySelector('#btCd') : null, cd;
  if (!bnTourIsOpen()) { if (BNT.timer && typeof clearInterval === 'function') clearInterval(BNT.timer); BNT.timer = 0; return; }
  if (!c || !BNT.store) return;
  cd = bnTourCooldown(BNT.store, Date.now());
  c.textContent = cd.ok ? '可開新一屆' : '冷卻中 ' + bnTourFmt(cd.left);
}
function bnTourOnClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-tt]') : null, a;
  if (!b) return;
  if (e.stopPropagation) e.stopPropagation();
  a = b.getAttribute('data-tt');
  if (a === 'close') { bnTourClose(); bnUiRenderEntry(); return; }
  if (a === 'pick') { BNT.pick = +b.getAttribute('data-i') | 0; bnTourRender(); return; }
  if (a === 'start') { bnTourStart(); return; }
  if (a === 'play') { bnTourReplay(+b.getAttribute('data-m'), +b.getAttribute('data-g')); return; }
  if (a === 'next') { var n = bnTourNext(); if (n) bnTourReplay(n.mid, n.g); else bnTourToast('已全部看完'); return; }
  if (a === 'all') { BNT.seen = {}; bnTourEnsureRun(); if (BNT.run) BNT.run.matches.forEach(function (m) { m.games.forEach(function (x, gi) { BNT.seen[m.id + ':' + gi] = 1; }); }); bnTourGrant(); bnTourRender(); return; }
  if (a === 'reward') { var p = bnTourGrant(); bnTourToast(p ? '名次獎勵已發放' : '沒有可領的獎勵'); bnTourRender(); return; }
}
function bnTourCss() {
  var s;
  if (BNT.css || typeof document === 'undefined' || !document.createElement) return;
  s = document.createElement('style');
  s.id = 'bnTourCss';
  s.textContent = '#bnTour{position:absolute;left:0;top:0;right:0;bottom:0;z-index:9;overflow:auto;background:#1b150f;color:#f4ead2;font-size:13px;padding:10px 12px 24px;box-sizing:border-box;-webkit-overflow-scrolling:touch}' +
    '#bnTour .bt-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}' +
    '#bnTour .bt-h b{font-size:17px;color:#ffd25a}' +
    '#bnTour button{font:inherit;color:#f4ead2;background:#3a2c1c;border:1px solid #6b5230;border-radius:6px;padding:6px 10px;margin:2px 4px 2px 0}' +
    '#bnTour button.pri{background:#7a5418;border-color:#c9952e}' +
    '#bnTour button:disabled{opacity:.45}' +
    '#bnTour .bt-sub{margin:4px 0 8px;opacity:.8;font-size:12px}' +
    '#bnTour .bt-pick label{display:block;padding:4px 0}' +
    '#bnTour .bt-br{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px}' +
    '#bnTour .bt-col{flex:0 0 150px;display:flex;flex-direction:column;justify-content:space-around;gap:6px}' +
    '#bnTour .bt-col h4{margin:0;font-size:12px;color:#ffd25a;text-align:center}' +
    '#bnTour .bt-m{border:1px solid #6b5230;border-radius:6px;padding:4px 6px;background:#2a2016}' +
    '#bnTour .bt-m.mine{border-color:#ffd25a}' +
    '#bnTour .bt-r{display:flex;justify-content:space-between;gap:4px;padding:2px 0;white-space:nowrap;overflow:hidden}' +
    '#bnTour .bt-r.win{color:#ffd25a;font-weight:bold}' +
    '#bnTour .bt-r span{overflow:hidden;text-overflow:ellipsis}' +
    '#bnTour .bt-g{display:flex;flex-wrap:wrap}' +
    '#bnTour .bt-g button{padding:2px 6px;font-size:11px}' +
    '#bnTour .bt-g button.seen{opacity:.6}' +
    '#bnTour .bt-hist{font-size:12px;line-height:1.7}' +
    '@media (max-width:700px){#bnTour .bt-col{flex-basis:140px}}';
  (document.head || document.body).appendChild(s);
  BNT.css = true;
}
function bnTourNm(e) { return (e.owner === 'me' ? '★ ' : '') + bnTourEsc(e.name) + ' <small>' + Math.round(e.ratio * 100) + '%</small>'; }
function bnTourMatchHtml(m, ent, mine) {
  var A = ent[m.ea], B = ent[m.eb], g, gl = '', i, isMine = (m.ea === mine || m.eb === mine);
  for (i = 0; i < m.games.length; i++) gl += '<button data-tt="play" data-m="' + m.id + '" data-g="' + i + '" class="' + (BNT.seen[m.id + ':' + i] ? 'seen' : '') + '">第' + (i + 1) + '局</button>';
  return '<div class="bt-m' + (isMine ? ' mine' : '') + '">' +
    '<div class="bt-r' + (m.w === 'A' ? ' win' : '') + '"><span>' + bnTourNm(A) + '</span><b>' + m.wins.A + '</b></div>' +
    '<div class="bt-r' + (m.w === 'B' ? ' win' : '') + '"><span>' + bnTourNm(B) + '</span><b>' + m.wins.B + '</b></div>' +
    (BNT.stale ? '' : '<div class="bt-g">' + gl + '</div>') + '</div>';
}
function bnTourRender() {
  var st = BNT.store || bnTourLoad(), cd = bnTourCooldown(st, Date.now()), h, r, nx, src, i, ent, mine = -1, rk, cols = '', hist = '', done = true;
  if (!BNT.el) return;
  h = '<div class="bt-h"><b>戰隊擂台</b><button data-tt="close">關閉</button></div>' +
    '<p class="bt-sub">16 隊單淘汰,比出第 1、2、3 名(季軍賽 = 兩名半決賽敗者)。每 2 小時可開一屆(離線也計時)。系統隊伍依種子與玩家實力補滿。</p>' +
    '<p>狀態:<b id="btCd">' + (cd.ok ? '可開新一屆' : '冷卻中 ' + bnTourFmt(cd.left)) + '</b></p>';
  if (st.last) r = bnTourEnsureRun();
  if (st.last && !r) {
    h += '<p>目前這屆是舊版規則(戰鬥規則已更新),無法重算回播。可開新一屆。</p>';
  }
  if (r && r.ok) {
    for (i = 0; i < r.entrants.length; i++) if (r.entrants[i].owner === 'me' && mine < 0) mine = i;
    ent = r.entrants;
    nx = bnTourNext();
    done = nx === null;
    h += '<p>當前:' + (nx ? '<b>' + BNT_RK[r.matches.filter(function (x) { return x.id === nx.mid; })[0].rk] + '</b> 尚未放送第 ' + (nx.g + 1) + ' 局' : '整屆已看完') + '</p>' +
      '<p><button class="pri" data-tt="next"' + (nx ? '' : ' disabled') + '>放送下一場</button><button data-tt="all">直接看結果</button>' +
      (done && st.rw !== st.last.id && mine >= 0 ? '<button data-tt="reward">領取名次獎勵</button>' : '') + '</p>';
    for (i = 0; i < BNT_COL.length; i++) {
      var key = BNT_COL[i][0], ids = BNT_COL[i][1], ms = '';
      ids.forEach(function (id) {
        var m = r.matches.filter(function (x) { return x.id === id; })[0];
        if (m) ms += bnTourMatchHtml(m, ent, mine);
      });
      cols += '<div class="bt-col"><h4>' + (key === 'r16' ? '16 強' : (key === 'qf' ? '8 強' : (key === 'sf' ? '4 強' : '決賽 / 季軍賽'))) + '</h4>' + ms + '</div>';
    }
    h += '<div class="bt-br">' + cols + '</div>';
    if (done) {
      rk = function (k) { var j = r.rank.indexOf(k); return j >= 0 ? ent[j] : null; };
      h += '<p>冠軍:<b>' + bnTourEsc(rk(1).name) + '</b>　亞軍:' + bnTourEsc(rk(2).name) + '　季軍:' + bnTourEsc(rk(3).name) +
        (mine >= 0 ? '　我方名次:第 ' + r.rank[mine] + ' 名' : '') + '</p>';
    }
    h += '<p class="bt-sub">系統隊伍強度:補位 ' + r.stats.npcN + ' 支,平均 ' + Math.round(r.stats.npcAvg * 100) + '%P,超過 110%P 的 ' + r.stats.over + ' 支。</p>';
  } else {
    src = bnTourSources();
    if (BNT.pick >= src.length) BNT.pick = 0;
    h += '<p>選擇參賽隊伍(第一版 1 隊):</p><div class="bt-pick">' +
      (src.length ? src.map(function (x, k) { return '<label><input type="radio" name="btp" data-tt="pick" data-i="' + k + '"' + (k === BNT.pick ? ' checked' : '') + '> ' + bnTourEsc(x.name) + '(' + x.specs.length + ' 人)</label>'; }).join('') : '<p class="bt-sub">沒有可用隊伍:請先在布陣放好隊伍,或按「存入」存一組預設隊伍。</p>') +
      '</div>' +
      '<p><button class="pri" data-tt="start"' + (cd.ok && src.length ? '' : ' disabled') + '>開一屆</button></p>';
  }
  hist = (st.hist || []).map(function (x) {
    return '第 ' + x.id + ' 屆 · 冠軍 ' + bnTourEsc(x.champ) + (x.champOwn === 'me' ? '(我方)' : '') + ' · 亞 ' + bnTourEsc(x.runner) + ' · 季 ' + bnTourEsc(x.third) + (x.mineN ? ' · 我方第 ' + x.mine + ' 名' : '');
  }).join('<br>');
  h += '<h3 style="font-size:14px;margin:12px 0 4px">歷屆紀錄(最近 ' + BN_TOURNEY.histMax + ' 屆)</h3><div class="bt-hist">' + (hist || '尚無紀錄') + '</div>';
  BNT.el.innerHTML = h;
  BNT.el.scrollTop = 0;
}
