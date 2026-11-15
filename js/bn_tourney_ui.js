// js/bn_tourney_ui.js — 戰隊擂台 UI(面板掛在 #bnLayer 內,沿用 bnshare 的面板模式;回播沿用戰鬥畫面 bnu / bnPl*,結果畫面沿用 bnui 的結算)。
// 入口:戰鬥入口第 5 顆鈕 data-t="tourney" → bnUiEntryDo → bnTourOpen()。返回鍵:bnUiBack → bnTourBack()(結算畫面 → 回擂台面板)。
// 2026-11-15 改為固定時間排程(排程設定在 BN_TOURNEY.sched):每日固定時段開賽,報名窗口開啟時彈一次公告(用代表隊伍參加 / 稍後 / 今天不再提醒),
//   也可在擂台頁報名或開『自動報名』;報名當下取代表隊伍快照(bnRepGet),開賽時間到(在線或離線後開遊戲)由 bnTourSettle 以確定性種子整屆算完、寫存檔 + 戰報箱 + 歷屆;
//   結果在擂台頁逐場回播 / 直接看結果 → 名次獎勵(只發一次,st.rw 防重領;下一屆結算前會先補發未領的上一屆)。bnTourPulse(now) 由 shell.js 每秒呼叫(及擂台頁自己的計時器)。
//   舊制『玩家手動開新一屆 + 2 小時冷卻』(bnTourStart / bnTourCooldown)程式保留,UI 不再呼叫。
// 回播不自動寫戰報(bnu.rec = null);玩家的局在開一屆時已寫入戰報箱,結算畫面的『查看戰報』開該局。
// 不發聲(回播音效經 bndraw 的守衛)。ES2017;不用 ?. ??。
// 全域:BNT bnTourOpen bnTourClose bnTourIsOpen bnTourBack bnTourOnResult bnTourLoad bnTourSave bnTourStart bnTourRender bnTourPulse bnTourSettle bnTourBrief bnTourOpt bnTourOptSet bnTourRepSnap bnTourLocked bnTourPopOpen bnTourPopClose

var BNT = { el: null, timer: 0, pick: 0, store: null, run: null, runSeed: -1, stale: false, cur: null, seen: {}, css: false, msg: '', pop: null, pcss: false, busy: false, sig: '' };

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
  var out = [], i, p, sp, rp = (typeof bnRepGet === 'function') ? bnRepGet() : null;
  if (rp && !rp.empty) {   // 代表隊伍排第一(預設選它);空 = 退回原本的預設隊伍 / 目前布陣
    sp = bnTourSpecsOf(rp.slots);
    if (sp.length) out.push({ key: 'rep', name: rp.name, specs: sp });
  }
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
// 代表隊伍快照(報名用):{name, specs} 或 null(未設定 / 空)。同 bnTourSources() 的 'rep' 項
function bnTourRepSnap() {
  var rp, sp;
  try {
    rp = (typeof bnRepGet === 'function') ? bnRepGet() : null;
    if (!rp || rp.empty) return null;
    sp = bnTourSpecsOf(rp.slots);
    return sp.length ? { name: rp.name, specs: sp } : null;
  } catch (e) { return null; }
}
// 我方名次(多隊取最好);沒有我方 = 0
function bnTourMyRank(r) {
  var i, best = 0;
  for (i = 0; i < r.entrants.length; i++) if (r.entrants[i].owner === 'me' && (!best || r.rank[i] < best)) best = r.rank[i];
  return best;
}
// 報名門檻(名聲,UNLOCK_CFG 'arena'):只擋『報名』(公告彈窗 / 自動報名 / 報名鈕),擂台頁與入口都可進去觀看;沒有解鎖模組 = 不鎖
function bnTourLocked() { try { return typeof unlockIs === 'function' && !unlockIs('arena'); } catch (e) { return false; } }
function bnTourLockText() {
  var c = null;
  try { c = (typeof unlockCfg === 'function') ? unlockCfg('arena') : null; } catch (e) { c = null; }
  return '名聲 ' + (c && c.fame ? c.fame : 1800) + ' 開放報名';
}
// 存檔選項:remind(擂台提醒)/ auto(自動報名)
function bnTourOpt(k) { var st = BNT.store || bnTourLoad(); return !!st[k]; }
function bnTourOptSet(k, v) {
  var st = BNT.store || bnTourLoad();
  if (k !== 'remind' && k !== 'auto') return false;
  st[k] = !!v;
  bnTourSave();
  return true;
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
  if (!bnTourCheckSnaps(snaps).ok) { bnTourToast('隊伍人數需 1~3 人'); return false; }
  st.seq += 1;
  seed = bnHash('bntour', st.seq, now) >>> 0;
  r = bnTourRun(seed, snaps);
  if (!r.ok) { bnTourToast(r.why); return false; }
  dv = (typeof bnsDataVer === 'function') ? bnsDataVer() : '';
  st.last = { id: st.seq, seed: seed, ts: now, dv: dv, pl: [{ name: sel.name, specs: sel.specs }], lid: {}, rk: bnTourMyRank(r) };
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
  return { v: BN_REC_VER, seed: mt.games[gi].seed,teamA: A.units, teamB: B.units, opts: { events: true, scene: '' }, meta: { stage: 'T', kind: 'tourney', ch: 0, foePower: 0, scale: 1, bonds: A.bonds, formation: A.formation } };
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
  rank = st.last.rk | 0;   // 結算時已記下名次;舊制存檔沒有 → 重算
  if (!rank) {
    r = bnTourEnsureRun();
    if (!r || !r.ok) return null;
    for (i = 0; i < r.entrants.length; i++) if (r.entrants[i].owner === 'me') { mine = i; break; }
    if (mine < 0) return null;
    rank = r.rank[mine];
  }
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
  return bnTourFight(rec, bnTourSideOf(r, mt));
}
// 擂台回播:玩家自己的局(mySide = 'A' | 'B')播舞台,播完進結果頁;其他局只出結算畫面(文字 / 結果,bnTourOnResult 改按鈕)
function bnTourFight(rec, mySide) {
  var S;
  if (typeof bnu === 'undefined' || !bnu.open || !bnu.layer) return false;
  bnTourClose();
  if (typeof bnLogClose === 'function') bnLogClose();
  if (bnu.P) { bnPlDispose(bnu.P); bnu.P = null; }
  bnUiStopLoop();
  bnu.stg = { kind: 'tourney', id: 'T' }; BNUI.stage = 'T';
  bnu.rec = null;
  S = bnInit(rec); bnRunToEnd(S);
  bnUiSetPhase('fight');
  bnUiShowRes(false); bnUiShowPause(false); bnUiCutRender(null);
  bnu.P = null; bnu.result = null; bnu.paused = false; bnu.retreat = false; bnu.manual = false; bnu.logId = '';
  bnUiSyncBtns();
  if (bnu.roundEl) bnu.roundEl.textContent = '';
  bnUiShowResult(S);
  if (mySide) bnBattleShow(rec, { mode: 'play', mySide: mySide });
  return true;
}
// 玩家在這局的哪一側(A / B);不是玩家的局回 ''
function bnTourSideOf(r, mt) {
  var i;
  for (i = 0; i < r.entrants.length; i++) if (r.entrants[i].owner === 'me') return mt.ea === i ? 'A' : (mt.eb === i ? 'B' : '');
  return '';
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
  var c, s, now = Date.now();
  if (!bnTourIsOpen()) { if (BNT.timer && typeof clearInterval === 'function') clearInterval(BNT.timer); BNT.timer = 0; return; }
  bnTourPulse(now);
  if (!BNT.el || !BNT.el.querySelector || !BNT.store || !bnTourIsOpen()) return;
  s = bnTourStatus(BNT.store, now);
  if (bnTourSig(s) !== BNT.sig) { bnTourRender(); return; }   // 報名窗口開 / 關、已報名狀態變了:整頁重畫
  c = BNT.el.querySelector('#btCd');
  if (c) c.textContent = bnTourFmt(s.left);
  c = BNT.el.querySelector('#btSt');
  if (c) c.textContent = bnTourStText(BNT.store, s);
}
function bnTourSig(s) { return s.phase + ':' + (s.slot ? s.slot.id : 0) + ':' + (s.reg ? 1 : 0) + ':' + (BNT.store && BNT.store.last ? BNT.store.last.id : 0) + ':' + (BNT.store ? BNT.store.rw : 0); }
function bnTourStText(st, s) {
  if (s.reg) return '已報名(' + bnTourEsc(st.reg.name) + '),開賽後可看結果';
  if (st.reg && st.reg.id > st.done && Date.now() >= st.reg.start) return '已報名,結算中…';
  if (s.phase === 'open') return '報名中(截止 ' + bnTourClock(s.slot.start) + ')';
  return bnTourClock(s.slot.start - BN_TOURNEY.sched.winMin * 60000) + ' 開放報名';
}
// 給首頁 / 活動頁 / 城門的簡述:{phase, reg, dot, stat}
function bnTourBrief(now) {
  var st = BNT.store || bnTourLoad(), s = bnTourStatus(st, now), pend = !!(st.last && st.rw !== st.last.id);
  var lk = bnTourLocked();
  return { phase: s.phase, reg: s.reg, pend: pend, locked: lk, dot: pend || (!lk && s.phase === 'open' && !s.reg),
    stat: pend ? '有名次獎勵可領' : (lk ? bnTourLockText() + ' · 下一屆 ' + bnTourClock(s.slot.start) : null) || (s.phase === 'open' ? (s.reg ? '已報名 · ' + bnTourFmt(s.left) + ' 後開賽' : '報名中 · ' + bnTourFmt(s.left) + ' 後開賽') : '下一屆 ' + bnTourClock(s.slot.start) + ' · ' + bnTourFmt(s.left)) };
}
function bnTourOnClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-tt]') : null, a;
  if (!b) return;
  if (e.stopPropagation) e.stopPropagation();
  a = b.getAttribute('data-tt');
  if (a === 'close') { bnTourClose(); bnUiRenderEntry(); return; }
  if (a === 'join') { bnTourJoin(true); return; }
  if (a === 'gorep') { bnTourGoRep(); return; }
  if (a === 'remind' || a === 'auto') {
    var on = !bnTourOpt(a);
    if (a === 'auto' && on && !bnTourRepSnap()) { bnTourToast('先設定代表隊伍,自動報名才會生效'); }
    bnTourOptSet(a, on); bnTourRender(); return;
  }
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
    '#bnTour .bt-card{border:2px solid #6b5230;border-radius:10px;background:#2a2016;padding:8px 10px;margin:6px 0}' +
    '#bnTour .bt-big{font-size:18px;color:#ffd25a}' +
    '#bnTour .bt-warn{color:#ffb38a}' +
    '#bnTour button.dim{opacity:.5}' +
    '#bnTour button.on{background:#2f6b2f;border-color:#6bc46b}' +
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
  var st = BNT.store || bnTourLoad(), now = Date.now(), s = bnTourStatus(st, now), h, r = null, nx, snap = bnTourRepSnap(), i, ent, mine = -1, rk, cols = '', hist = '', done = true, key, ids, ms, pend;
  if (!BNT.el) return;
  BNT.sig = bnTourSig(s);
  h = '<div class="bt-h"><b>戰隊擂台</b><button data-tt="close">關閉</button></div>' +
    '<p class="bt-sub">每天 ' + bnTourSlotsText() + ' 開賽,開賽前 ' + BN_TOURNEY.sched.winMin + ' 分鐘開放報名。16 隊單淘汰,比出第 1、2、3 名(季軍賽 = 兩名半決賽敗者);以報名當下的代表隊伍出賽,不足的隊伍由系統隊伍補滿。沒報名的該屆沒有成績。</p>' +
    '<div class="bt-card"><p>下一屆開賽:<b class="bt-big">' + bnTourClock(s.slot.start) + '</b>　距開賽 <b id="btCd">' + bnTourFmt(s.left) + '</b></p>' +
    '<p>報名狀態:<b id="btSt">' + bnTourStText(st, s) + '</b></p>';
  if (snap) h += '<p class="bt-sub">代表隊伍:' + bnTourEsc(snap.name) + '(' + snap.specs.length + ' 人)。報名後以當下陣容出賽,之後再改隊伍不影響該屆。</p>';
  else h += '<p class="bt-warn">尚未設定代表隊伍:請先到隊伍頁的「代表」分頁放好 1~3 人。</p><p><button class="pri" data-tt="gorep">前往設定代表隊伍</button></p>';
  if (bnTourLocked()) h += '<p><button class="dim" data-tt="join">' + bnTourLockText() + '</button></p>';   // 名聲不足:灰色,點了給一行提示
  else if (s.phase === 'open' && !s.reg && snap) h += '<p><button class="pri" data-tt="join">用代表隊伍報名</button></p>';
  h += '<p><button data-tt="remind" class="' + (st.remind ? 'on' : '') + '">擂台提醒:' + (st.remind ? '開' : '關') + '</button><button data-tt="auto" class="' + (st.auto ? 'on' : '') + '">自動報名:' + (st.auto ? '開' : '關') + '</button></p>' +
    '<p class="bt-sub">擂台提醒:報名開始時彈出公告。自動報名:開啟且已設定代表隊伍時,報名開始自動幫你報名(離線時不會報名)。</p></div>';
  if (st.last) r = bnTourEnsureRun();
  pend = !!(st.last && st.rw !== st.last.id);
  if (!st.last) {
    h += '<p class="bt-sub">還沒有參賽紀錄。報名並等開賽後,這裡會顯示對陣、回播與名次。</p>';
  } else {
    h += '<h3 style="font-size:14px;margin:10px 0 4px">上一屆(' + bnTourClock(st.last.ts) + ' 開賽)' + (st.last.rk ? ' · 我方第 ' + st.last.rk + ' 名' : '') + '</h3>';
    if (!r) h += '<p>這屆是舊版規則(戰鬥規則已更新),無法重算回播。</p>' + (pend && st.last.rk ? '<p><button data-tt="reward">領取名次獎勵</button></p>' : '');
  }
  if (r && r.ok) {
    for (i = 0; i < r.entrants.length; i++) if (r.entrants[i].owner === 'me' && mine < 0) mine = i;
    ent = r.entrants;
    nx = bnTourNext();
    done = nx === null;
    h += '<p>當前:' + (nx ? '<b>' + BNT_RK[r.matches.filter(function (x) { return x.id === nx.mid; })[0].rk] + '</b> 尚未放送第 ' + (nx.g + 1) + ' 局' : '整屆已看完') + '</p>' +
      '<p><button class="pri" data-tt="next"' + (nx ? '' : ' disabled') + '>放送下一場</button><button data-tt="all">直接看結果</button>' +
      (pend && mine >= 0 ? '<button data-tt="reward">領取名次獎勵</button>' : '') + '</p>';
    for (i = 0; i < BNT_COL.length; i++) {
      key = BNT_COL[i][0]; ids = BNT_COL[i][1]; ms = '';
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
  }
  hist = (st.hist || []).map(function (x) {
    return bnTourClock(x.ts) + ' 場 · 冠軍 ' + bnTourEsc(x.champ) + (x.champOwn === 'me' ? '(我方)' : '') + ' · 亞 ' + bnTourEsc(x.runner) + ' · 季 ' + bnTourEsc(x.third) + (x.mineN ? ' · 我方第 ' + x.mine + ' 名' : '');
  }).join('<br>');
  h += '<h3 style="font-size:14px;margin:12px 0 4px">歷屆紀錄(最近 ' + BN_TOURNEY.histMax + ' 屆,只記有參賽的)</h3><div class="bt-hist">' + (hist || '尚無紀錄') + '</div>';
  BNT.el.innerHTML = h;
  BNT.el.scrollTop = 0;
}

// ───────── 報名 / 結算 / 公告 ─────────
// 報名(用代表隊伍快照)。toast = true 時用 Toast 回報。回 {ok, why}
function bnTourJoin(toast) {
  var st = BNT.store || bnTourLoad(), now = Date.now(), snap, r, sl;
  if (bnTourLocked()) { if (toast) bnTourToast(bnTourLockText()); return { ok: false, why: 'locked' }; }
  snap = bnTourRepSnap();
  if (!snap) { if (toast) bnTourToast('先到隊伍頁「代表」分頁設定代表隊伍'); return { ok: false, why: 'norep' }; }
  r = bnTourRegister(st, now, snap);
  if (!r.ok) { if (toast) bnTourToast(r.why); return r; }
  sl = r.slot;
  if (sl.id > st.shown) st.shown = sl.id;
  bnTourSave();
  if (toast) bnTourToast(r.already ? '本屆已報名' : '已報名,' + bnTourClock(sl.start) + ' 開賽');
  bnTourPopClose();
  if (bnTourIsOpen()) bnTourRender();
  return r;
}
// 前往隊伍頁「代表」分頁
function bnTourGoRep() {
  bnTourPopClose();
  if (typeof ldNavPush === 'function') return ldNavPush('team', { n: 0, mode: 'edit' });
  bnTourToast('請到隊伍頁的「代表」分頁設定');
  return false;
}
// 結算:開賽時間已到的報名 → 以種子 + 報名快照整屆算完,寫存檔 / 戰報箱 / 歷屆。先補發上一屆未領的獎勵(避免被覆蓋掉)。回 run 或 null
function bnTourSettle(now) {
  var st = BNT.store || bnTourLoad(), g = bnTourSettleDue(st, now), snaps, r, dv, rk, id;
  if (!g) {
    if (st.reg && st.reg.id <= st.done) { st.reg = null; bnTourSave(); }   // 殘留的舊報名(時鐘倒退等):丟掉,不重複結算
    return null;
  }
  if (st.last && st.rw !== st.last.id) bnTourGrant();
  snaps = [{ name: g.name, specs: g.specs }];
  id = g.id;
  r = bnTourRun(bnTourSeedOf(id), snaps);
  st.reg = null; st.done = id; st.seq += 1;   // 失敗也算結束(不每秒重試)
  if (!r.ok) { bnTourSave(); bnTourToast('擂台結算失敗:' + r.why); return null; }
  dv = (typeof bnsDataVer === 'function') ? bnsDataVer() : '';
  rk = bnTourMyRank(r);
  st.last = { id: id, seed: r.seed, ts: g.start, dv: dv, pl: snaps, lid: {}, rk: rk };
  bnTourLogMine(st, r);
  bnTourHistAdd(st, bnTourHistRec(st, r));
  bnTourSave();
  BNT.run = r; BNT.runSeed = r.seed; BNT.stale = false; BNT.seen = {}; BNT.cur = null;
  bnTourToast('擂台結果出爐:你的隊伍第 ' + rk + ' 名,到擂台領取獎勵');
  if (bnTourIsOpen()) bnTourRender();
  return r;
}
// 每秒脈衝(shell.js shellRefresh 與擂台頁計時器呼叫):結算 → 自動報名 → 公告。全部以傳入的 now 判斷;名聲未達擂台門檻不報名、不公告
function bnTourPulse(now) {
  var st, sl, snap, r, cur;
  if (BNT.busy) return null;
  BNT.busy = true;
  try {
    now = now || Date.now();
    st = BNT.store || bnTourLoad();
    if (st.reg) bnTourSettle(now);
    if (bnTourLocked()) return null;
    sl = bnTourAutoDue(st, now);
    if (sl) {
      snap = bnTourRepSnap();
      if (snap) {
        r = bnTourRegister(st, now, snap);
        if (r.ok) { st.shown = Math.max(st.shown, sl.id); bnTourSave(); bnTourToast('擂台已自動報名,' + bnTourClock(sl.start) + ' 開賽'); if (bnTourIsOpen()) bnTourRender(); }
      }
    }
    sl = bnTourPopupDue(st, now);
    if (sl && bnTourCanPop()) bnTourPopOpen(sl, now);
    else if (BNT.pop) {
      cur = bnTourSched(now).cur;
      if (!cur || cur.id !== BNT.pop.id || (st.reg && st.reg.id === cur.id)) bnTourPopClose();
      else bnTourPopTick(now);
    }
  } catch (e) { if (typeof console !== 'undefined' && console.error) console.error('bnTourPulse', e); }
  finally { BNT.busy = false; }
  return null;
}
function bnTourCanPop() {
  if (BNT.pop || typeof document === 'undefined' || !document.body || document.hidden) return false;
  if (typeof bnu !== 'undefined' && bnu.open && bnu.phase === 'fight') return false;
  return true;
}
function bnTourPopCss() {
  var s;
  if (BNT.pcss || typeof document === 'undefined' || !document.createElement) return;
  s = document.createElement('style');
  s.id = 'bnTourPopCss';
  s.textContent = '#bnTourPop{position:fixed;left:0;top:0;right:0;bottom:0;z-index:95;display:flex;align-items:center;justify-content:center;background:rgba(18,10,5,.9);padding:16px;box-sizing:border-box;font-family:var(--ld-font,sans-serif);color:#fbeed2}' +
    '#bnTourPop .btp-box{width:min(420px,100%);max-height:100%;overflow:auto;box-sizing:border-box;padding:18px 16px 14px;text-align:center;border:3px solid #2b1a10;border-radius:14px;background:linear-gradient(#5b3a1e,#3a2414);box-shadow:inset 0 0 0 1px #f5c54288,0 4px 0 #0007}' +
    '#bnTourPop .btp-ttl{font-size:20px;font-weight:900;color:#ffd25a;margin-bottom:8px}' +
    '#bnTourPop .btp-main{font-size:17px;margin:6px 0}#bnTourPop .btp-main b{font-size:26px;color:#ffd25a}' +
    '#bnTourPop .btp-sub{font-size:13px;opacity:.85;margin:6px 0}#bnTourPop .btp-warn{font-size:13px;color:#ffb38a;margin:6px 0}' +
    '#bnTourPop button{display:block;width:100%;min-height:44px;margin:8px 0 0;font:inherit;font-size:15px;font-weight:900;color:#2b1a10;border:2px solid #2b1a10;border-radius:10px;background:linear-gradient(#f5d37a,#d9a52f);box-shadow:0 3px 0 #0007;cursor:pointer}' +
    '#bnTourPop button.sec{color:#fbeed2;background:linear-gradient(#7a5a3a,#5b3f26)}';
  (document.head || document.body).appendChild(s);
  BNT.pcss = true;
}
// 公告彈窗(全螢幕遮罩 + 置中面板):sl = 目前窗口的時段;彈出即記下 shown(同一時段只彈一次,存檔)
function bnTourPopOpen(sl, now) {
  var st = BNT.store || bnTourLoad(), el, snap = bnTourRepSnap(), n = Math.max(1, Math.ceil((sl.start - now) / 60000)), h;
  if (BNT.pop || typeof document === 'undefined' || !document.body) return false;
  bnTourPopCss();
  st.shown = Math.max(st.shown, sl.id);
  bnTourSave();
  el = document.createElement('div');
  el.id = 'bnTourPop';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '擂台報名公告');
  h = '<div class="btp-box"><div class="btp-ttl">擂台開始報名</div>' +
    '<p class="btp-main"><b id="btpN">' + n + '</b> 分鐘後開賽</p>' +
    '<p class="btp-sub">開賽時間 ' + bnTourClock(sl.start) + '。報名後以代表隊伍當下的陣容出賽。</p>' +
    (snap ? '<p class="btp-sub">代表隊伍:' + bnTourEsc(snap.name) + '(' + snap.specs.length + ' 人)</p><button type="button" data-tp="join">用代表隊伍參加</button>'
      : '<p class="btp-warn">尚未設定代表隊伍,請先到隊伍頁「代表」分頁放好 1~3 人。</p><button type="button" data-tp="gorep">前往設定代表隊伍</button>') +
    '<button type="button" class="sec" data-tp="later">稍後</button><button type="button" class="sec" data-tp="mute">今天不再提醒</button></div>';
  el.innerHTML = h;
  el.addEventListener('click', bnTourPopClick);
  document.body.appendChild(el);
  BNT.pop = { id: sl.id, day: sl.day, start: sl.start, el: el };
  return true;
}
function bnTourPopTick(now) {
  var P = BNT.pop, c;
  if (!P || !P.el || !P.el.querySelector) return;
  c = P.el.querySelector('#btpN');
  if (c) c.textContent = String(Math.max(1, Math.ceil((P.start - now) / 60000)));
}
function bnTourPopClose() {
  var P = BNT.pop;
  if (!P) return false;
  BNT.pop = null;
  if (P.el) { P.el.removeEventListener('click', bnTourPopClick); if (P.el.parentNode) P.el.parentNode.removeChild(P.el); }
  return true;
}
function bnTourPopClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-tp]') : null, a, st, P = BNT.pop;
  if (!b || !P) return;
  if (e.stopPropagation) e.stopPropagation();
  a = b.getAttribute('data-tp');
  if (a === 'join') { bnTourJoin(true); return; }
  if (a === 'gorep') { bnTourGoRep(); return; }
  if (a === 'mute') { st = BNT.store || bnTourLoad(); st.mute = P.day; bnTourSave(); bnTourPopClose(); return; }
  bnTourPopClose();   // 稍後
}
