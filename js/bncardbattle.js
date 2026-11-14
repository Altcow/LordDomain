// js/bncardbattle.js — 戰鬥畫面(規格 戰鬥畫面設計/戰鬥畫面_設計.md):戲台舞台由 js/bnstage.js 負責,本檔負責「事件 → 步 → 播放」與底部戰報、速度、重播、結果頁接線。
// 純函式 bncbSteps / bncbPlay / bncbLinesHtml / bncbStartIndex / bncbStateBefore / bncbSpeedNorm 不碰 DOM(node 可測);DOM:bncbOpen / bncbClose / bncbEnd。
// 資料:rec 用 bnRun 重跑(opts.events 強制 true);句子沿用 bnlog.js 的 bnLogEncOne + bnLogItems(不另寫一套),一個事件一行。
// 步的切法:開戰前(pre)/ 回合開始(round)/ 行動(act,含其後事件)/ 結束(end);round 後緊接的第一個 act 併入同一步。
// 步資料:{kind, r, n, pre:[], nums:[], lines:[{c,txt}], hp, dead}。pre 項目(播放前的演出,依順序):
//   {t:'act', u} 出手 · {t:'skill', u, id, name, th, kind, cat} 戰法發動 · {t:'hit', src, tgt, kind, cat, v, nv, crit, hp, big} 命中 · {t:'ult', u, id} 大招 ·
//   {t:'passive', u, label} 被動小圓牌 · {t:'prep', u, id} 大招準備(prep 事件) · {t:'move', moves:[{u, row}]} 換位(move 事件,相鄰的合併成一項)
//   hit 項目的 kill = 這一下致命(其後有該目標的 kill 事件),舞台在命中格後倒下;步的 rows = 該步結束時各單位排號(換位後站位還原用)
//   nums:{tgt, kind:'dmg'|'heal', v, crit, hooked} hooked = 數字已由命中掛鉤在命中格顯示,render 不再顯示。
// 每步播放順序:① 前置掛鉤(依 pre 順序;掛鉤回傳毫秒即等待)② 套用本步結果(兵力條、未掛鉤的數字、回合牌、戰報)③ 等 baseMs ÷ 速度。
// 掛鉤 BNCB.hooks = BNST.hooks(見 bnstage.js 檔頭)。播完 → BNST.hooks.onEnd(plan,false) 出勝敗牌與按鈕;不再自動開結果頁(按「看戰報」才開)。
// 速度 1× / 2× / 3×(3× 簡化:BNST.simple)。頂列右上「離」鈕 → 變暗 + 確認視窗(戰鬥內部凍結)→ 取消繼續 / 確認全黑淡出後離開。速度記在 localStorage(讀寫包 try/catch,失敗用 1×)。
// 舊版戰報(rec.v < BN_REC_VER)不可重播:bncbOpen 直接開結果頁(顯示「舊版戰報,無法重播」)。
// 測試入口:網址 ?cb=1&nocover=1 以 bnRptSampleRec() 自動開啟。
// ES2017;不用 ?. ??;不用 canvas;不發聲;全域 BNCB / bncb 前綴。

var BNCB = {
  el: null, rec: null, plan: null, mySide: 'A', speed: 1, baseMs: 600, run: 0, timer: null, stageEl: null, last: null, logWrap: null, ll: null, rdTxt: '', resizeFn: null,
  hooks: null, ultShow: {}, autoReport: false, conf: '', confTm: 0
};
var BNCB_OUT_MS = 350;
var BNCB_SPD_KEY = 'lorddomain.bncb.speed';

// ───────── 純資料:事件 → 步 ─────────
// 回 {mySide, enemySide, mine:[單位], enemy:[單位], byId, open:{hp,dead}, steps, win, reason, reasonTxt, maxRound, endTxt, seed}
// 單位 = {id, side, name, fig, fac, sex, main, traits, gr, troop, row, pos, boss, star, mx, hp0};mine / enemy 依 row 0→2(前鋒、中衛、主將)
var BNCB_POS = ['前鋒', '中衛', '主將'];
function bncbPassLabel(name) { return Array.from(String(name || '')).slice(0, 2).join(''); }
function bncbSteps(rec, mySide) {
  var me = mySide === 'B' ? 'B' : 'A', stars = (rec.opts && rec.opts.stars) || [], rc, S, res, hp = {}, hp0 = {}, dead = {}, rows = {}, rows0 = {}, byId = {}, sides = { A: [], B: [] }, steps = [], st = null, cur = {}, k = [], idx = {}, rep, init, e, i, j, its, line, basic, endTxt = '', ultOn = false, nm, hitBig;
  rc = JSON.parse(JSON.stringify(rec));
  rc.opts = Object.assign({}, rec.opts || {}, { events: true });
  S = bnRun(rc);
  res = S.result || { winner: 'draw', reason: 'limit', rounds: S.round, hp: { A: 0, B: 0 } };
  init = S.events.filter(function (x) { return x.t === 'init'; })[0];
  init.units.forEach(function (x) {
    var su = S.units.filter(function (y) { return y.id === x.id; })[0], sp = su.spec, u;
    u = { id: x.id, side: x.side, name: sp.name, fig: sp.fig || '', fac: sp.fac, sex: sp.sex || '', main: sp.main || '', traits: (sp.traits || []).slice(), gr: sp.gr | 0, troop: x.troop, row: x.row, pos: BNCB_POS[x.row] || '', boss: x.row === 2,
      star: x.side === 'A' ? (stars[su.idx] | 0) : 0, mx: Math.round(x.mx), hp0: Math.max(0, Math.round(x.hp)) };
    sides[x.side].push(u); byId[u.id] = u; hp0[u.id] = x.hp; hp[u.id] = x.hp; dead[u.id] = false; rows[u.id] = x.row; rows0[u.id] = x.row;
  });
  sides.A.sort(function (a, b) { return a.row - b.row; });
  sides.B.sort(function (a, b) { return a.row - b.row; });
  function K(s) { s = String(s); if (!(s in idx)) { idx[s] = k.length; k.push(s); } return idx[s]; }
  rep = { A: bnLogUnits(rc.teamA, stars), B: bnLogUnits(rc.teamB, null), k: k, L: [], cut: 0 };
  var curR = 0, nAct = 0;   // 逐事件解碼時 bnLogItems 不知道回合與手數,自己記並改寫「【第 r 回合 · 第 n 手】」
  function closeStep() { if (st) { st.hp = Object.assign({}, hp); st.dead = Object.assign({}, dead); st.rows = Object.assign({}, rows); } }
  function newStep(kind, r) { closeStep(); st = { kind: kind, r: r | 0, n: 0, pre: [], nums: [], lines: [], hp: null, dead: null }; steps.push(st); }
  for (i = 0; i < S.events.length; i++) {
    e = S.events[i];
    if (e.t === 'init') continue;
    if (e.t === 'round') { newStep('round', e.n); ultOn = false; }
    else if (e.t === 'act') { if (st && st.kind === 'round' && st.n === 1) st.kind = 'act'; else newStep('act', e.r); ultOn = false; }
    else if (e.t === 'end') { newStep('end', res.rounds); ultOn = false; }
    else if (!st) newStep('pre', 0);
    st.n++;
    if (e.t === 'round') { curR = e.n | 0; nAct = 0; }
    else if (e.t === 'act') nAct++;
    line = bnLogEncOne(e, K);
    if (line) {
      rep.L = [line];
      its = bnLogItems(rep);
      for (j = 0; j < its.length; j++) if (!(its[j].c === 'rd' && its[j].txt.indexOf('══ 開戰前') === 0)) st.lines.push({ c: its[j].c, txt: its[j].c === 'act' ? its[j].txt.replace(/^【第 \d+ 回合 · 第 \d+ 手】/, '【第 ' + curR + ' 回合 · 第 ' + nAct + ' 手】') : its[j].txt });
    }
    if (e.t === 'skill') {
      cur[e.u] = e.cat || '';
      st.pre.push({ t: 'skill', u: e.u, id: e.id, name: e.name || (typeof bnLogSkName === 'function' ? bnLogSkName(e.id) : String(e.id || '')), th: e.th || '', kind: e.kind || '', cat: e.cat || '' });
    }
    else if (e.t === 'act') { cur[e.u] = ''; st.actor = e.u; st.pre.push({ t: 'act', u: e.u }); }
    else if (e.t === 'ult') { st.pre.push({ t: 'ult', u: e.u, id: e.id }); ultOn = true; }
    else if (e.t === 'prep') st.pre.push({ t: 'prep', u: e.u, id: e.id });
    else if (e.t === 'trigger') st.pre.push({ t: 'passive', u: e.u, label: bncbPassLabel(typeof bnLogSkName === 'function' ? bnLogSkName(e.id) : e.id) });
    else if (e.t === 'evade' && !e.miss) st.pre.push({ t: 'passive', u: e.tgt, label: '閃避' });
    else if (e.t === 'ccimm') st.pre.push({ t: 'passive', u: e.tgt, label: '免控' });
    else if (e.t === 'immune') st.pre.push({ t: 'passive', u: e.tgt, label: '免疫' });
    else if (e.t === 'react') st.pre.push({ t: 'passive', u: e.tgt, label: '反應' });
    else if (e.t === 'dmg') {
      hp[e.tgt] = e.hp;
      nm = null;
      if (e.v > 0) { nm = { tgt: e.tgt, kind: 'dmg', v: Math.round(e.v), crit: !!e.crit, hooked: false }; st.nums.push(nm); }
      if (!e.dot && e.src >= 0) {
        basic = !!(e.basic || e.ctr);
        if (e.ctr) st.pre.push({ t: 'passive', u: e.src, label: '反擊' });
        hitBig = ultOn ? 1 : 0;
        st.pre.push({ t: 'hit', src: e.src, tgt: e.tgt, kind: basic ? 'basic' : (e.rx ? 'react' : 'skill'), cat: basic ? 'basic' : (cur[e.src] || ''), v: e.v, nv: nm ? nm.v : 0, crit: !!e.crit, hp: e.hp, big: hitBig });
        if (nm) nm.hooked = true;
      }
    }
    else if (e.t === 'heal') { hp[e.tgt] = e.hp; if (e.v > 0) st.nums.push({ tgt: e.tgt, kind: 'heal', v: Math.round(e.v), crit: false, hooked: false }); }
    else if (e.t === 'revive') { hp[e.tgt] = e.hp; dead[e.tgt] = false; }
    else if (e.t === 'kill') {
      dead[e.tgt] = true;
      for (j = st.pre.length - 1; j >= 0; j--) if (st.pre[j].t === 'hit' && st.pre[j].tgt === e.tgt) { if (st.pre[j].hp <= 0) st.pre[j].kill = true; break; }
    }
    else if (e.t === 'move') {
      rows[e.u] = e.row;
      var lastPre = st.pre[st.pre.length - 1];
      if (lastPre && lastPre.t === 'move' && !lastPre.moves.some(function (m) { return m.u === e.u; })) lastPre.moves.push({ u: e.u, row: e.row });
      else st.pre.push({ t: 'move', moves: [{ u: e.u, row: e.row }] });
    }
  }
  closeStep();
  steps.forEach(function (s) { s.lines.forEach(function (ln) { if (ln.c === 'end' && ln.txt.indexOf('══ 戰鬥結束') === 0) endTxt = ln.txt.replace(/^══ /, ''); }); });
  return {
    mySide: me, enemySide: bnOpp(me), mine: sides[me], enemy: sides[bnOpp(me)], byId: byId, open: { hp: hp0, dead: {}, rows: rows0 }, steps: steps,
    win: res.winner, reason: res.reason, reasonTxt: BNLOG_WHY[res.reason] || String(res.reason || ''), maxRound: res.rounds | 0, endTxt: endTxt || '戰鬥結束', seed: rec.seed >>> 0, scene: (rec.opts && rec.opts.scene) || 'field'
  };
}

// 重播 / 跳轉:第 r 回合(round 或 act 步)的步索引;找不到回 -1
function bncbStartIndex(plan, r) {
  var i;
  for (i = 0; i < plan.steps.length; i++) {
    if ((plan.steps[i].kind === 'round' || plan.steps[i].kind === 'act') && plan.steps[i].r === (r | 0)) return i;
  }
  return -1;
}
// 從第 idx 步開始播前的狀態(兵力、陣亡);idx = 0 回開場
function bncbStateBefore(plan, idx) {
  if (idx <= 0 || !plan.steps[idx - 1]) return { hp: plan.open.hp, dead: plan.open.dead, rows: plan.open.rows };
  return { hp: plan.steps[idx - 1].hp, dead: plan.steps[idx - 1].dead, rows: plan.steps[idx - 1].rows };
}
// 速度正規化:1 / 2 / 3,其他 → 1
function bncbSpeedNorm(n) { n = +n; return n === 2 || n === 3 ? n : 1; }
// 戰報行 HTML(逐行跳脫;回合標題可點 → 從該回合重播)
function bncbLinesHtml(lines) {
  return (lines || []).map(function (ln) {
    var m = ln.c === 'rd' ? /第 (\d+) 回合/.exec(ln.txt) : null;
    return '<div class="bcb-ln c-' + bnRptEsc(ln.c) + '"' + (m ? ' data-act="from" data-r="' + m[1] + '"' : '') + '>' + bnRptEsc(ln.txt) + '</div>';
  }).join('');
}

// ───────── 純播放器:cfg = {speed():數字, baseMs, sleep(ms)→Promise, render(步, 索引), hooks, ultShow, cancelled():bool, from:步索引(預設 0)}
// 回 Promise<boolean>:true = 播完;false = 中途取消。不吞例外(掛鉤拋錯會 reject)。
function bncbPlay(plan, cfg) {
  var i = cfg.from | 0, H = cfg.hooks || {}, US = cfg.ultShow || {};
  function sp() { var v = cfg.speed ? cfg.speed() : 1; return v > 0 ? v : 1; }
  function stop() { return cfg.cancelled ? !!cfg.cancelled() : false; }
  function wait(ms) { return cfg.sleep(ms / sp()); }
  function call(name, args) { return typeof H[name] === 'function' ? H[name].apply(null, args) : 0; }
  function pre(st) {
    var j = 0;
    function go() {
      var x, u, ms = 0;
      if (stop() || j >= st.pre.length) return Promise.resolve();
      x = st.pre[j++];
      u = plan.byId[x.u];
      if (x.t === 'ult') {
        if (u && u.fig && Object.prototype.hasOwnProperty.call(US, u.fig) && US[u.fig]) ms = call('onUltShow', [u.fig, x.id, u]);
        else if (u) ms = call('onUltCard', [u, x.id]);
      }
      else if (x.t === 'hit') ms = call('onHit', [plan.byId[x.src], plan.byId[x.tgt], x.kind, x.cat, x]);
      else if (x.t === 'act') ms = call('onAct', [u]);
      else if (x.t === 'skill') ms = call('onSkill', [u, x]);
      else if (x.t === 'passive') ms = call('onPassive', [u, x.label]);
      else if (x.t === 'prep') ms = call('onPrep', [u, x.id]);
      else if (x.t === 'move') ms = call('onMove', [x.moves]);
      ms = typeof ms === 'number' && ms > 0 ? ms : 0;
      return ms > 0 ? wait(ms).then(go) : go();
    }
    return go();
  }
  function next() {
    var idx;
    if (stop()) return Promise.resolve(false);
    if (i >= plan.steps.length) return Promise.resolve(true);
    idx = i++;
    return pre(plan.steps[idx]).then(function () {
      if (stop()) return false;
      cfg.render(plan.steps[idx], idx);
      return wait(cfg.baseMs).then(next);
    });
  }
  return next();
}

// ───────── DOM ─────────
function bncbShellHtml(plan, title) {
  void plan;
  return '<div class="bst-stage" id="bstStage">' + bnstStageHtml() +
    '<div class="bst-top"><span class="bst-ttl">' + bnRptEsc(title || '戰鬥') + '</span>' +
    '<button type="button" data-act="leave" class="bcb-exit" aria-label="離開">離</button></div>' +
    '<div class="bst-spd"><button type="button" data-act="spd1" class="ld-btn on" aria-label="1倍速">1×</button><button type="button" data-act="spd2" class="ld-btn sub" aria-label="2倍速">2×</button><button type="button" data-act="spd3" class="ld-btn sub" aria-label="3倍速">3×</button></div>' +
    '<div class="bcb-log ld-panel collapsed"><div class="bcb-lh"><button type="button" class="ld-btn sub" data-act="log">戰報 ▲</button><span class="bcb-last"></span></div><div class="bcb-ll"></div></div>' +
    '<div class="bcb-dim" data-act="noop"></div><div class="bcb-dlg" role="alertdialog" aria-label="離開確認"><b>確定要離開戰鬥嗎?</b><div class="bcb-db"><button type="button" class="ld-btn" data-act="leave-ok">確認</button><button type="button" class="ld-btn sub" data-act="leave-no">取消</button></div></div><div class="bcb-black"></div></div><div class="bst-rot">請將手機轉橫</div>';
}
function bncbSpeedLoad() {
  try { return bncbSpeedNorm(localStorage.getItem(BNCB_SPD_KEY)); } catch (e) { return 1; }
}
function bncbSpeedSave(n) {
  try { localStorage.setItem(BNCB_SPD_KEY, String(n)); } catch (e) { /* 無法寫入時略過 */ }
}
function bncbSpeedUi() {
  var list, i;
  if (!BNCB.el) return;
  list = BNCB.el.querySelectorAll('[data-act^="spd"]');
  for (i = 0; i < list.length; i++) list[i].className = list[i].getAttribute('data-act') === 'spd' + BNCB.speed ? 'ld-btn on' : 'ld-btn sub';
}
function bncbSpeed(n) {
  BNCB.speed = bncbSpeedNorm(n);
  BNST.simple = BNCB.speed >= 3;
  bncbSpeedSave(BNCB.speed);
  bncbSpeedUi();
}
function bncbRenderLog(upTo) {
  var plan = BNCB.plan, i, lines = [], last = '';
  if (!plan || !BNCB.ll) return;
  for (i = 0; i < upTo && i < plan.steps.length; i++) lines = lines.concat(plan.steps[i].lines);
  BNCB.ll.innerHTML = bncbLinesHtml(lines);
  if (lines.length) last = lines[lines.length - 1].txt;
  BNCB.last.textContent = last || '戰鬥開始';
  BNCB.ll.scrollTop = BNCB.ll.scrollHeight;
}
// 每步套用:回合牌、兵力、未掛鉤的數字、戰報
function bncbRender(st) {
  var plan = BNCB.plan, lines = st.lines || [], txt, h;
  if (!plan || !BNCB.el) return;
  txt = st.kind === 'end' ? '戰鬥結束' : (st.r > 0 ? '第 ' + st.r + ' 回合' : '開戰前');
  if (txt !== BNCB.rdTxt) { BNCB.rdTxt = txt; bnstSetRound(txt); }
  bnstSetState(st.hp || plan.open.hp, st.dead || plan.open.dead, st.rows || plan.open.rows);
  (st.nums || []).forEach(function (nm) {
    if (nm.hooked) return;
    if (nm.kind === 'heal') bnstHealNum(String(nm.tgt), nm.v);
    else if (BNST.U[nm.tgt]) bnstNum(BNST.U[nm.tgt], nm.v, nm.crit ? 'crit' : '');
  });
  if (lines.length) {
    h = bncbLinesHtml(lines);
    BNCB.ll.insertAdjacentHTML('beforeend', h);
    BNCB.last.textContent = lines[lines.length - 1].txt;
    BNCB.ll.scrollTop = BNCB.ll.scrollHeight;
  }
}
function bncbToggleLog() {
  var expanded, b;
  if (!BNCB.logWrap) return;
  expanded = BNCB.logWrap.className.indexOf('collapsed') < 0;
  BNCB.logWrap.className = 'bcb-log ld-panel' + (expanded ? ' collapsed' : '');
  b = BNCB.el.querySelector('[data-act="log"]');
  if (b) b.textContent = expanded ? '戰報 ▲' : '戰報 ▼';
  if (!expanded && BNCB.ll) BNCB.ll.scrollTop = BNCB.ll.scrollHeight;
}
// 停止播放(計時器與播放迴圈都失效)
function bncbStop() {
  BNCB.run++;
  BNST.tok++;
  if (BNCB.timer) bnstCancel(BNCB.timer);
  BNCB.timer = null;
}
// 離開確認:bncbAsk 變暗 + 跳視窗並內部凍結戰鬥(不顯示暫停 UI);bncbAskNo 取消、繼續;bncbAskOk 全黑淡出後才離開
function bncbSetConf(c) {
  BNCB.conf = c;
  if (BNCB.stageEl && BNCB.stageEl.classList) {
    BNCB.stageEl.classList.toggle('bcb-ask', c === 'ask' || c === 'out');
    BNCB.stageEl.classList.toggle('bcb-out', c === 'out');
  }
}
function bncbAsk() {
  if (!BNCB.el || BNCB.conf) return false;
  bnstPause(true);
  bncbSetConf('ask');
  return true;
}
function bncbAskNo() {
  if (!BNCB.el || BNCB.conf !== 'ask') return false;
  bncbSetConf('');
  bnstPause(false);
  return true;
}
function bncbAskOk() {
  var el = BNCB.el;
  if (!el || BNCB.conf !== 'ask') return false;
  bncbSetConf('out');
  BNCB.confTm = setTimeout(function () { BNCB.confTm = 0; if (BNCB.el === el) bnBattleClose(); }, BNCB_OUT_MS);
  return true;
}
function bncbOnClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-act]') : null, a;
  if (!b) return;
  a = b.getAttribute('data-act');
  if (a === 'spd1') bncbSpeed(1);
  else if (a === 'spd2') bncbSpeed(2);
  else if (a === 'spd3') bncbSpeed(3);
  else if (a === 'log') bncbToggleLog();
  else if (a === 'replay') { var rpl = BNCB.rec, rs = BNCB.mySide, ra = BNCB.autoReport; bncbOpen(rpl, { mySide: rs, autoReport: ra }); }
  else if (a === 'report') { var rp = BNCB.rec, side = BNCB.mySide; bncbClose(); if (rp) bnRptOpen(rp, { mySide: side }); }
  else if (a === 'close') bncbClose();
  else if (a === 'leave') bncbAsk();   // 離開鈕:先確認;確認後才走 bnBattleClose(結果早已結算,只關掉畫面,不撤退、不改結果)
  else if (a === 'leave-ok') bncbAskOk();
  else if (a === 'leave-no') bncbAskNo();
  else if (a === 'from') { if (!BNCB.conf) bncbFrom(+b.getAttribute('data-r')); }
}
// 從第 r 回合開始重播:套用該回合開始前的狀態與戰報,再從那步播
function bncbFrom(r) {
  var plan = BNCB.plan, idx, st, my;
  if (!plan || !BNCB.el) return;
  idx = bncbStartIndex(plan, r);
  if (idx < 0) return;
  bncbStop();
  my = BNCB.run;
  st = bncbStateBefore(plan, idx);
  bnstEndHide();
  BNCB.ended = false;
  bnstSetState(st.hp, st.dead, st.rows);
  bnstRevealAll();
  BNCB.rdTxt = '';
  bncbRenderLog(idx);
  bncbRun(idx, my);
}
// 播完:出勝敗牌;autoReport(由 bnBattleShow 'play' 開啟)時停約 1.6 秒後自動進結果頁(bnreport.js)
var BNCB_REPORT_MS = 1600;
function bncbFinish(plan, instant) {
  var rp, sd;
  BNCB.ended = true;
  BNST.hooks.onEnd(plan, instant);
  if (!BNCB.autoReport) return;
  rp = BNCB.rec; sd = BNCB.mySide;
  bnstLater(instant ? 0 : BNCB_REPORT_MS, function () {
    if (rp && BNCB.rec === rp) { bncbClose(); bnRptOpen(rp, { mySide: sd }); }
  });
}
function bncbRun(from, my) {
  var plan = BNCB.plan;
  bncbPlay(plan, {
    speed: function () { return BNCB.speed; },
    baseMs: BNCB.baseMs,
    from: from,
    sleep: function (ms) { return new Promise(function (res) { BNCB.timer = bnstTimer(res, ms); }); },
    hooks: BNST.hooks,
    ultShow: BNCB.ultShow,
    cancelled: function () { return my !== BNCB.run; },
    render: bncbRender
  }).then(function (done) {
    if (done && my === BNCB.run) bncbFinish(plan, false);
  }, function (err) {
    bncbClose();
    console.error('[bncardbattle]', err);
  });
}
// 關掉畫面並取消播放。回 true = 原本有開
function bncbClose() {
  var el = BNCB.el;
  bncbStop();
  bnstPause(false); BNCB.conf = ''; BNCB.ended = false;
  if (BNCB.confTm) { clearTimeout(BNCB.confTm); BNCB.confTm = 0; }
  if (BNCB.resizeFn && typeof window !== 'undefined') window.removeEventListener('resize', BNCB.resizeFn);
  BNCB.resizeFn = null;
  if (el) {
    el.removeEventListener('click', bncbOnClick);
    if (el.parentNode) el.parentNode.removeChild(el);
  }
  BNCB.el = null; BNCB.autoReport = false; BNCB.plan = null; BNCB.rec = null; BNCB.stageEl = null; BNCB.last = null; BNCB.logWrap = null; BNCB.ll = null; BNCB.rdTxt = '';
  return !!el;
}
// 預載:最多等 8 秒,失敗的圖不擋播放
function bncbPreload(list) {
  return Promise.all(list.map(function (s) {
    return new Promise(function (res) {
      var im = new Image(), tm = setTimeout(res, 8000);
      im.onload = im.onerror = function () { clearTimeout(tm); res(); };
      im.src = s;
    });
  }));
}
// 開卡牌戰鬥畫面並開始播放。opts = {mySide:'A'|'B'}。舊版戰報(rec.v < BN_REC_VER)不播,直接開結果頁。
function bncbOpen(rec, opts) {
  var o = opts || {}, el, plan, my, stageEl, fit;
  if (typeof document === 'undefined' || !document.body) return false;
  if (BNCB.el) bncbClose();
  if (!bnRptReplayable(rec)) { bnRptOpen(rec, { mySide: o.mySide === 'B' ? 'B' : 'A' }); return false; }
  plan = bncbSteps(rec, o.mySide === 'B' ? 'B' : 'A');
  BNCB.rec = rec; BNCB.plan = plan; BNCB.mySide = plan.mySide; BNCB.autoReport = !!o.autoReport; BNCB.speed = bncbSpeedLoad(); BNST.simple = BNCB.speed >= 3;
  BNCB.ultShow = {};
  (plan.mine || []).concat(plan.enemy || []).forEach(function (u) { if (bnstAnimOf(u.fig) && bnstAnimOf(u.fig).ult) BNCB.ultShow[u.fig] = true; });
  el = document.createElement('div');
  el.id = 'bnCB';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '卡牌戰鬥');
  el.className = 'ld-noselect';
  el.innerHTML = bncbShellHtml(plan, o.title || bncbTitle(rec));
  el.addEventListener('click', bncbOnClick);
  document.body.appendChild(el);
  BNCB.el = el;
  stageEl = el.querySelector('.bst-stage');
  BNCB.stageEl = stageEl;
  BNCB.last = el.querySelector('.bcb-last');
  BNCB.ll = el.querySelector('.bcb-ll');
  BNCB.logWrap = el.querySelector('.bcb-log');
  fit = function () { bnstFit(stageEl); };
  fit();
  BNCB.resizeFn = fit;
  window.addEventListener('resize', fit);
  bnstMount(stageEl, plan, function () { return BNCB.speed; });
  bncbSpeedUi();
  bnstSetState(plan.open.hp, plan.open.dead, plan.open.rows);
  bnstSetRound('開戰前');
  BNCB.rdTxt = '開戰前';
  BNCB.last.textContent = '戰鬥開始';
  my = ++BNCB.run;
  bncbPreload(bnstPreloadList(plan)).then(function () {
    if (my !== BNCB.run) return;
    if (o.fromRound > 0 && bncbStartIndex(plan, o.fromRound) >= 0) { bncbFrom(o.fromRound); return; }   // 戰報「從這回合重播」:跳過開場演出直接從第 N 回合播
    bnstIntro(plan, function () { if (my === BNCB.run) bncbRun(0, my); });
  });
  return true;
}
// 頂列戰鬥名稱:呼叫端 opts.title 優先;否則是 bnui 目前這場就用關卡名;再不然「戰鬥」
function bncbTitle(rec) {
  try { if (typeof bnu !== 'undefined' && bnu && bnu.rec === rec && typeof bnUiStageLabel === 'function') return bnUiStageLabel(); } catch (e) { /* 取不到名稱時用預設 */ }
  return '戰鬥';
}
function bncbIsOpen() { return !!(BNCB.el && BNCB.el.parentNode); }
// 共用入口(戰役 / 擂台 / 切磋 / 外勤 / 戰報列表)。mode:'play' = 播舞台,播完自動進結果頁;'report' = 直接開結果頁(結果頁「重播」可進舞台)。opts.mySide 預設 'A'。
function bnBattleShow(rec, opts) {
  var o = opts || {}, side = o.mySide === 'B' ? 'B' : 'A';
  if (!rec) return false;
  if (o.mode === 'report') return bnRptOpen(rec, { mySide: side, loot: o.loot, logId: o.logId });
  return bncbOpen(rec, { mySide: side, autoReport: true, fromRound: o.fromRound | 0 });
}
// 返回鍵 / Esc:戲台開著時,無視窗 = 按離開(跳確認),視窗開著 = 取消;否則關結果頁。回 true = 有處理
function bnBattleBack() {
  if (bncbIsOpen()) { if (BNCB.conf === 'ask') bncbAskNo(); else if (!BNCB.conf) bncbAsk(); return true; }
  if (typeof bnRptIsOpen === 'function' && bnRptIsOpen()) { bnRptClose(); return true; }
  return false;
}
function bnBattleClose() {
  bncbClose();
  if (typeof bnRptClose === 'function') bnRptClose();
}

// 測試入口:網址 ?cb=1&nocover=1 時以範例戰鬥自動開啟(正式流程接線不在本批)
if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.location) {
  (function () {
    var q = String(window.location.search || '');
    if (/[?&]cb=1(&|$)/.test(q) && /[?&]nocover=1(&|$)/.test(q)) window.addEventListener('load', function () { bncbOpen(bnRptSampleRec(), { mySide: 'A' }); });
  })();
}
