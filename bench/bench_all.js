// bench_all.js — 城主領地 一鍵總測試(約 12 分鐘):大地圖 × 渲染比較 × 發熱/降頻 → 可分享報告檔
// 重用自 tools/bigmap_bench/bench.js(載入器、INNER 驅動、分塊原型)與 tools/render_bench/bench.js(Canvas2D vs WebGL 批次),
// 複製後改寫,不改原檔。全程無聲(不含任何音訊;NoSleep 備援影片為無音軌且 muted)。
// 檔案結構:Core(純邏輯,可在 node 以假時鐘單元測試)→ 報告分析/文字 → INNER(注入 iframe)→ 瀏覽器 UI。
(function () {
  'use strict';
  var IS_BROWSER = typeof document !== 'undefined';

  // ==================================================================== Core(純邏輯)
  var Core = {};
  var LOAD_EST = 3, LIFE_EST = 2, CELL_OVH = 0.15, CASE_OVH = 0.3;

  function pct(a, p) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; }
  function avg(a) { if (!a.length) return 0; var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function med(a) { return pct(a, 0.5); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function errStr(e) { return String(e && e.message || e); }
  Core.util = { pct: pct, avg: avg, med: med, r1: r1, r2: r2 };

  Core.makePlan = function (fast) {
    if (fast) return {
      fast: true,
      s1: { sizes: [56, 112], lifes: [120], modes: ['A', 'B'], zooms: [0.15, 0.4, 1.0], sec: 0.6, warm: 0.3 },
      s2: { counts: [500, 2000], rounds: 1, sec: 1, warm: 0.3 },
      s3: { size: 112, life: 120, zoom: 0.4, phases: [{ mode: 'A', sec: 8 }, { mode: 'B', sec: 8 }], warm: 1, sample: 2 }
    };
    return {
      fast: false,
      s1: { sizes: [56, 84, 112], lifes: [120, 200], modes: ['A', 'B'], zooms: [0.15, 0.25, 0.4, 0.6, 1.0, 1.6], sec: 2, warm: 0.7 },
      s2: { counts: [500, 1000, 2000, 4000], rounds: 3, sec: 3, warm: 0.5 },
      s3: { size: 112, life: 120, zoom: 0.4, phases: [{ mode: 'A', sec: 210 }, { mode: 'B', sec: 210 }], warm: 3, sample: 15 }
    };
  };
  Core.estimate = function (plan) {
    var p1 = plan.s1, p2 = plan.s2, p3 = plan.s3;
    var s1 = p1.sizes.length * (LOAD_EST + p1.lifes.length * (LIFE_EST + p1.modes.length * p1.zooms.length * (p1.warm + p1.sec + CELL_OVH)));
    var s2 = 1 + p2.rounds * p2.counts.length * 2 * (p2.warm + p2.sec + CASE_OVH);
    var s3 = LOAD_EST + LIFE_EST + p3.phases.reduce(function (a, ph) { return a + p3.warm + ph.sec + CELL_OVH; }, 0);
    return { s1: s1, s2: s2, s3: s3, total: s1 + s2 + s3 };
  };

  // ---------- 進度/剩餘時間 ----------
  function Progress(total, nowMs) {
    this.total = total; this.now = nowMs; this.start = nowMs(); this.done = 0; this.cur = null; this.stage = ''; this.label = '';
  }
  Progress.prototype.begin = function (est, label) { this.cur = { est: est, t0: this.now() }; this.label = label || ''; };
  Progress.prototype.end = function () { if (this.cur) this.done += this.cur.est; this.cur = null; };
  Progress.prototype.snapshot = function () {
    var elapsed = (this.now() - this.start) / 1000;
    var partial = this.cur ? Math.min(this.cur.est, (this.now() - this.cur.t0) / 1000) : 0;
    var d = this.done + partial, f = 1;
    if (d > 5) f = Math.max(0.8, Math.min(1.6, elapsed / d));
    return { elapsed: elapsed, frac: Math.min(1, d / this.total), remaining: Math.max(0, (this.total - d) * f), stage: this.stage, label: this.label };
  };
  Core.Progress = Progress;

  // ---------- 判定 ----------
  Core.verdict = function (r) {
    if (!r) return { k: 'n', t: '-' };
    if (r.error) return { k: 'x', t: '錯誤' };
    if (r.untrusted) return { k: 'u', t: '不可信' };
    if (r.fps >= 30 && r.fpsLow >= 20) return { k: 'g', t: '綠' };
    if (r.fps >= 20) return { k: 'y', t: '黃' };
    return { k: 'r', t: '紅' };
  };
  Core.can30 = function (r) { return !!r && !r.error && r.p95Ms <= 24 && r.avgMs <= 18; };

  // ---------- 流程編排(可用假時鐘測試) ----------
  // env: { now(), sleep(ms), waitVisible(), interrupts(), loadGame(size)->handle, render:{init(),runCase(mode,n,sec,warm),done()} }
  // handle: { build(), setLife(n), prep(mode), runCell(o), runSoak(o,onSample), close() }
  Core.newState = function (plan) {
    return { schema: 'lorddomain.benchall/1', fast: !!plan.fast, plan: plan, started: null, ended: null, totalSec: 0, aborted: false,
      s1: { sizes: {}, life: {}, cells: [], errors: [] }, s2: { info: null, cases: [], errors: [] }, s3: { phases: [], errors: [], notes: [] },
      errors: [], interrupts: [], device: {}, wake: {} };
  };

  Core.orchestrate = async function (plan, env, hooks, state) {
    hooks = hooks || {};
    var est = Core.estimate(plan), prog = new Progress(est.total, env.now);
    state.progress = prog;
    function stage(n) { prog.stage = n; if (hooks.onStage) hooks.onStage(n); }
    function fire(k) { if (hooks.onStageEnd) { try { hooks.onStageEnd(k, state); } catch (e) { /* ignore */ } } }

    // ---- 階段 1:大地圖 ----
    stage('階段 1/3:大地圖尺寸 × 路人 × 繪製模式 × 縮放');
    try {
      var p1 = plan.s1;
      for (var si = 0; si < p1.sizes.length; si++) {
        var size = p1.sizes[si], G = null;
        try {
          await env.waitVisible();
          prog.begin(LOAD_EST, '載入 ' + size + '×' + size + ' 地圖');
          G = await env.loadGame(size);
          state.s1.sizes[size] = await G.build();
        } catch (e) { state.s1.errors.push(size + ': 載入失敗 ' + errStr(e)); if (G) { try { G.close(); } catch (e2) { /* */ } } G = null; }
        prog.end();
        for (var li = 0; li < p1.lifes.length; li++) {
          var life = p1.lifes[li], lifeOk = !!G;
          prog.begin(LIFE_EST, size + '² 生成路人 ' + life);
          if (G) { try { state.s1.life[size + '/' + life] = await G.setLife(life); } catch (e) { lifeOk = false; state.s1.errors.push(size + '/' + life + ': 路人失敗 ' + errStr(e)); } }
          prog.end();
          for (var mi = 0; mi < p1.modes.length; mi++) {
            var mode = p1.modes[mi];
            if (G && lifeOk) { try { await G.prep(mode); } catch (e) { lifeOk = false; state.s1.errors.push(size + '/' + life + '/' + mode + ': prep 失敗 ' + errStr(e)); } }
            for (var zi = 0; zi < p1.zooms.length; zi++) {
              var zoom = p1.zooms[zi], rec = { size: size, life: life, mode: mode, zoom: zoom };
              prog.begin(p1.warm + p1.sec + CELL_OVH, size + '² 路人' + life + ' 模式' + mode + ' 縮放' + zoom);
              if (!G || !lifeOk) { rec.error = '前置失敗,略過'; }
              else {
                try {
                  await env.waitVisible();
                  var c0 = env.interrupts();
                  var r = await G.runCell({ mode: mode, zoom: zoom, sec: p1.sec, warm: p1.warm, cap30: false });
                  for (var k in r) rec[k] = r[k];
                  if (env.interrupts() !== c0 || (r.maxIv && r.maxIv > 2000)) rec.untrusted = true;
                } catch (e) { rec.error = errStr(e); }
              }
              state.s1.cells.push(rec);
              prog.end();
              if (hooks.onTick) hooks.onTick();
            }
          }
        }
        if (G) { try { G.close(); } catch (e) { state.s1.errors.push('close: ' + errStr(e)); } }
        await env.sleep(200);
      }
    } catch (e) { state.s1.errors.push('階段 1 例外: ' + errStr(e)); }
    fire('s1');

    // ---- 階段 2:渲染比較 ----
    stage('階段 2/3:Canvas 2D 與 WebGL 批次貼圖');
    var p2 = plan.s2, glOk = false;
    try {
      prog.begin(1, '初始化渲染比較');
      state.s2.info = await env.render.init();
      glOk = !!(state.s2.info && state.s2.info.glOk);
    } catch (e) { state.s2.errors.push('初始化失敗: ' + errStr(e)); }
    prog.end();
    try {
      for (var rd = 1; rd <= p2.rounds; rd++) for (var ci = 0; ci < p2.counts.length; ci++) for (var mm = 0; mm < 2; mm++) {
        var rmode = mm === 0 ? '2d' : 'gl', n = p2.counts[ci], rc = { mode: rmode, n: n, round: rd };
        prog.begin(p2.warm + p2.sec + CASE_OVH, (rmode === '2d' ? 'Canvas2D ' : 'WebGL ') + n + ' 張 第' + rd + '輪');
        if (!state.s2.info) rc.error = '初始化失敗,略過';
        else if (rmode === 'gl' && !glOk) rc.error = 'WebGL 不可用';
        else {
          try {
            await env.waitVisible();
            var d0 = env.interrupts();
            var rr = await env.render.runCase(rmode, n, p2.sec, p2.warm);
            for (var kk in rr) rc[kk] = rr[kk];
            if (env.interrupts() !== d0) rc.untrusted = true;
          } catch (e) { rc.error = errStr(e); }
        }
        state.s2.cases.push(rc);
        prog.end();
        if (hooks.onTick) hooks.onTick();
        await env.sleep(rc.error ? 0 : 300);
      }
    } catch (e) { state.s2.errors.push('階段 2 例外: ' + errStr(e)); }
    try { if (env.render.done) env.render.done(); } catch (e) { /* */ }
    fire('s2');

    // ---- 階段 3:發熱/降頻 ----
    stage('階段 3/3:發熱/降頻(兩段各連續 ' + r1(plan.s3.phases[0].sec / 60) + ' 分鐘)');
    var p3 = plan.s3, G3 = null, ok3 = false;
    try {
      await env.waitVisible();
      prog.begin(LOAD_EST, '載入 ' + p3.size + '×' + p3.size + ' 地圖');
      G3 = await env.loadGame(p3.size);
      state.s3.map = await G3.build();
      prog.end();
      prog.begin(LIFE_EST, '生成路人 ' + p3.life);
      state.s3.lifeInfo = await G3.setLife(p3.life);
      ok3 = true;
    } catch (e) { state.s3.errors.push('載入失敗: ' + errStr(e)); }
    prog.end();
    for (var pi = 0; pi < p3.phases.length; pi++) {
      var ph = p3.phases[pi], prec = { mode: ph.mode, sec: ph.sec, zoom: p3.zoom, samples: [] };
      prog.begin(p3.warm + ph.sec + CELL_OVH, '發熱測試 ' + (ph.mode === 'A' ? 'Canvas 2D(模式A)' : '分塊預畫(模式B)'));
      if (!ok3) prec.error = '前置失敗,略過';
      else {
        try {
          await env.waitVisible();
          await G3.prep(ph.mode);
          var e0 = env.interrupts();
          await G3.runSoak({ mode: ph.mode, zoom: p3.zoom, warm: p3.warm, sec: ph.sec, sample: p3.sample }, function (s) {
            prec.samples.push(JSON.parse(JSON.stringify(s)));
            if (hooks.onTick) hooks.onTick();
          });
          if (env.interrupts() !== e0) prec.untrusted = true;
        } catch (e) { prec.error = errStr(e); }
      }
      state.s3.phases.push(prec);
      prog.end();
      fire('s3p' + pi);
    }
    if (G3) { try { G3.close(); } catch (e) { /* */ } }
    prog.stage = '完成';
    return state;
  };


  // ==================================================================== 分析與報告文字(純邏輯)
  var MODE_NAME = { A: 'A 現行', B: 'B 分塊' };
  function zl(zs) { return zs.join('/'); }

  Core.analyze = function (state) {
    var A = { rows: [], sizeLines: [], recs: [], gl: null, heat: [], conclusions: [], untrusted: 0, errors: 0, headline: '' };
    var plan = state.plan, zooms = plan.s1.zooms, cells = state.s1.cells || [];

    // ---- 階段 1 ----
    var rows = {}, order = [];
    cells.forEach(function (r) {
      var k = r.size + '|' + r.life + '|' + r.mode;
      if (!rows[k]) { rows[k] = { size: r.size, life: r.life, mode: r.mode, cells: {} }; order.push(k); }
      rows[k].cells[r.zoom] = r;
      if (r.untrusted) A.untrusted++;
      if (r.error) A.errors++;
    });
    A.rows = order.map(function (k) { return rows[k]; });
    var bad = {};   // bad[size][mode] = {red:[], yel:[]}
    A.rows.forEach(function (row) {
      bad[row.size] = bad[row.size] || {}; var b = bad[row.size][row.mode] = bad[row.size][row.mode] || { red: [], yel: [], n: 0 };
      zooms.forEach(function (z) {
        var v = Core.verdict(row.cells[z]);
        if (v.k === 'g' || v.k === 'y' || v.k === 'r') b.n++;
        if (v.k === 'r' && b.red.indexOf(z) < 0) b.red.push(z);
        if (v.k === 'y' && b.yel.indexOf(z) < 0 && b.red.indexOf(z) < 0) b.yel.push(z);
      });
    });
    var sizes = plan.s1.sizes.slice().sort(function (a, b) { return a - b; });
    sizes.forEach(function (s) {
      ['A', 'B'].forEach(function (m) {
        var b = bad[s] && bad[s][m]; if (!b || !b.n) return;
        b.yel = b.yel.filter(function (z) { return b.red.indexOf(z) < 0; });
        b.red.sort(function (x, y) { return x - y; }); b.yel.sort(function (x, y) { return x - y; });
        A.sizeLines.push(s + '×' + s + ' ' + MODE_NAME[m] + ':' + (b.red.length ? ' [紅] @縮放 ' + zl(b.red) : '') + (b.yel.length ? ' [黃] @縮放 ' + zl(b.yel) : '') + (!b.red.length && !b.yel.length ? ' 全部 [綠]' : '') + '(路人 120/200 取最差)');
      });
    });
    // 建議
    function okSizes(m) { return sizes.filter(function (s) { var b = bad[s] && bad[s][m]; return b && b.n && !b.red.length; }); }
    var okA = okSizes('A'), okB = okSizes('B'), maxS = sizes[sizes.length - 1];
    var bigA = okA.length ? okA[okA.length - 1] : 0, bigB = okB.length ? okB[okB.length - 1] : 0;
    if (bad[maxS] && bad[maxS].A && bad[maxS].A.n) {
      var bA = bad[maxS].A, bB = bad[maxS].B;
      if (!bA.red.length) A.recs.push(maxS + ' 在此手機以現行渲染(A)全縮放都沒有紅燈,可直接做 ' + maxS + '。');
      else {
        A.recs.push(maxS + ' 在此手機以現行渲染(A)縮放 ' + zl(bA.red) + ' 為紅。');
        if (bB && bB.n && !bB.red.length) A.recs.push('採用地形分塊預畫(B)後 ' + maxS + ' 全縮放無紅燈,建議先做分塊預畫再開 ' + maxS + '。');
        else if (bB && bB.n) {
          A.recs.push('即使採用分塊預畫(B),' + maxS + ' 在縮放 ' + zl(bB.red) + ' 仍為紅。' + (bigB && bigB < maxS ? '建議先做 ' + bigB + '(B 模式下無紅燈的最大尺寸)。' : (bigA ? '建議先做 ' + bigA + '。' : '連較小尺寸也有紅燈,請先看原始資料。')));
        }
      }
    }
    if (!A.recs.length) A.recs.push('階段 1 沒有足夠的有效資料可下建議(見錯誤/不可信)。');

    // ---- 階段 2 ----
    var per = {};
    (state.s2.cases || []).forEach(function (c) {
      if (c.untrusted) A.untrusted++;
      if (c.error) { A.errors++; return; }
      per[c.n] = per[c.n] || { '2d': [], gl: [] }; per[c.n][c.mode].push(c.cpuAvg);
    });
    var pc = Object.keys(per).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
      var a = per[n]['2d'], g = per[n].gl;
      var m2 = a.length ? med(a) : null, mg = g.length ? med(g) : null;
      return { n: n, c2d: m2, gl: mg, ratio: (m2 && mg) ? m2 / Math.max(mg, 0.01) : null };
    });
    var glInfo = state.s2.info || {};
    A.gl = { perCount: pc, ratio: null, ratioN: null, text: '' };
    var withRatio = pc.filter(function (p) { return p.ratio; });
    if (withRatio.length) {
      var pick = withRatio.filter(function (p) { return p.n === 2000; })[0] || withRatio[withRatio.length - 1];
      A.gl.ratio = pick.ratio; A.gl.ratioN = pick.n;
      var rr = pick.ratio;
      A.gl.text = rr >= 1.5 ? 'WebGL 批次貼圖比 Canvas 2D 快 ' + r1(rr) + ' 倍(' + pick.n + ' 張,每幀 CPU 提交耗時)。'
        : (rr >= 1.15 ? 'WebGL 只比 Canvas 2D 略快(' + r1(rr) + ' 倍,' + pick.n + ' 張),差距不大。' : 'WebGL 與 Canvas 2D 沒有明顯差異(' + r1(rr) + ' 倍,' + pick.n + ' 張)。');
      if (rr < 1.5) A.gl.text += ' 依 PLAN_RENDER §11,差 < 1.5 倍時建議留在 Canvas 2D、集中做分塊與 LOD。';
    } else A.gl.text = (glInfo.glOk === false ? '此裝置 WebGL 不可用,無法比較。' : '階段 2 沒有有效的比較資料。');

    // ---- 階段 3 ----
    function win(s, f0, f1) {
      var n = s.length; if (!n) return null;
      var i0 = Math.floor(n * f0), i1 = Math.max(i0 + 1, Math.floor(n * f1));
      var w = s.slice(i0, i1), ok = w.filter(function (x) { return !x.stall; });
      if (ok.length) w = ok;
      return { ms: avg(w.map(function (x) { return x.avgMs; })), fps: avg(w.map(function (x) { return x.fps; })), p95: avg(w.map(function (x) { return x.p95Ms; })) };
    }
    (state.s3.phases || []).forEach(function (ph) {
      if (ph.untrusted) A.untrusted++;
      if (ph.error) A.errors++;
      var h = { mode: ph.mode, n: (ph.samples || []).length, error: ph.error, untrusted: !!ph.untrusted };
      if (h.n >= 2) {
        var w1 = win(ph.samples, 0, 4 / 14), w3 = win(ph.samples, 8 / 14, 12 / 14);
        h.ms1 = w1.ms; h.ms3 = w3.ms; h.fps1 = w1.fps; h.fps3 = w3.fps;
        h.rise = w1.ms > 0.05 ? (w3.ms - w1.ms) / w1.ms * 100 : 0;
        h.fpsDrop = w1.fps > 1 ? (w1.fps - w3.fps) / w1.fps * 100 : 0;
        h.level = (h.rise >= 15 || h.fpsDrop >= 10) ? 'throttle' : ((h.rise >= 5 || h.fpsDrop >= 5) ? 'mild' : 'stable');
        var first = ph.samples[0], last = ph.samples[ph.samples.length - 1];
        h.msFirst = first.avgMs; h.msLast = last.avgMs;
      }
      A.heat.push(h);
    });

    // ---- 結論 ----
    var C = A.conclusions;
    A.sizeLines.forEach(function (l) { C.push(l); });
    A.recs.forEach(function (l) { C.push('建議:' + l); });
    C.push(A.gl.text);
    A.heat.forEach(function (h) {
      var nm = h.mode === 'A' ? 'Canvas 2D 現行(A)' : '分塊預畫(B)';
      if (h.error) { C.push('發熱測試 ' + nm + ':失敗(' + h.error + ')。'); return; }
      if (h.n < 2) { C.push('發熱測試 ' + nm + ':樣本不足。'); return; }
      var t = '發熱測試 ' + nm + ':第1分鐘平均 ' + r1(h.ms1) + 'ms → 第3分鐘平均 ' + r1(h.ms3) + 'ms,' + (h.rise >= 0 ? '上升 ' : '下降 ') + r1(Math.abs(h.rise)) + '%;fps ' + r1(h.fps1) + ' → ' + r1(h.fps3) + '。';
      t += h.level === 'throttle' ? ' 連續跑 3 分鐘後明顯變慢,疑似降頻(手機發熱)。' : (h.level === 'mild' ? ' 輕微上升,可能開始發熱,需看溫度備註。' : ' 沒有隨時間變慢,未見降頻跡象。');
      if (h.untrusted) t += '(此段曾被中斷,不可信)';
      C.push(t);
    });
    var hA = A.heat.filter(function (h) { return h.mode === 'A' && h.n >= 2; })[0], hB = A.heat.filter(function (h) { return h.mode === 'B' && h.n >= 2; })[0];
    if (hA && hB) C.push('同場景比較(112 縮放 0.4):A 平均約 ' + r1((hA.ms1 + hA.ms3) / 2) + 'ms,B 平均約 ' + r1((hB.ms1 + hB.ms3) / 2) + 'ms。階段 3 第二段用 B(地形分塊預畫);遊戲內尚無 WebGL 合成層原型,故以 B 代替。');
    if (A.untrusted) C.push('警告:有 ' + A.untrusted + ' 項結果因切換 App/鎖屏/畫面停頓被標為「不可信」,建議保持螢幕亮著重測。');
    if (A.errors) C.push('注意:有 ' + A.errors + ' 項因錯誤而缺漏,見「錯誤」段。');
    C.push('限制:draw 耗時只量 CPU 同步時間,iOS 的 Canvas 2D 為延遲提交,GPU 成本未計入;fps 為 rAF 實測(iOS 最高 60,低電量模式會被限到 30)。');

    // 一行摘要
    var worst = bad[maxS] && bad[maxS].A;
    A.headline = (worst && worst.n ? maxS + '現行' + (worst.red.length ? '紅@' + zl(worst.red) : '無紅') : maxS + '無資料')
      + ' | GL/2D ' + (A.gl.ratio ? r1(A.gl.ratio) + 'x' : 'n/a')
      + ' | 發熱 ' + (hA ? (hA.rise >= 0 ? '+' : '') + r1(hA.rise) + '%' : 'n/a') + '/' + (hB ? (hB.rise >= 0 ? '+' : '') + r1(hB.rise) + '%' : 'n/a')
      + ' | 不可信' + A.untrusted + ' 錯誤' + A.errors;
    return A;
  };

  Core.stamp = function (iso) {
    var d = iso ? new Date(iso) : new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
  };
  Core.fileName = function (state) { return 'LordDomain-bench-' + Core.stamp(state.ended || state.started) + '.txt'; };

  function padR(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
  Core.buildText = function (state, inputs) {
    inputs = inputs || {};
    var A = Core.analyze(state), L = [], dv = state.device || {}, zooms = state.plan.s1.zooms;
    var when = state.started ? new Date(state.started) : new Date();
    var dstr = when.getFullYear() + '-' + pad2(when.getMonth() + 1) + '-' + pad2(when.getDate()) + ' ' + pad2(when.getHours()) + ':' + pad2(when.getMinutes());
    L.push('城主領地效能測試 ' + dstr + ' | ' + (dv.model || dv.platform || '?') + ' | ' + A.headline + (state.fast ? ' | 快速演示模式(非正式)' : '') + (state.aborted ? ' | 未完成' : ''));
    L.push('');
    L.push('=== 結論與建議 ===');
    A.conclusions.forEach(function (c) { L.push('- ' + c); });
    L.push('');
    L.push('=== 判定表(每格:平均ms/幀 p95 fps 判定;判定 綠=fps>=30且低檔>=20、黃=20~30、紅<20;+30=draw p95<=24ms) ===');
    L.push(padR('尺寸/路人/模式', 16) + zooms.map(function (z) { return padR('z' + z, 34); }).join(''));
    A.rows.forEach(function (row) {
      L.push(padR(row.size + '/' + row.life + '/' + row.mode, 16) + zooms.map(function (z) {
        var r = row.cells[z], v = Core.verdict(r);
        if (!r || r.error || r.untrusted) return padR('[' + v.t + ']' + (r && r.error ? ' ' + r.error.slice(0, 14) : ''), 34);
        return padR(r1(r.avgMs) + 'ms p95=' + r1(r.p95Ms) + ' ' + Math.round(r.fps) + 'fps [' + v.t + ']' + (Core.can30(r) ? '+30' : ''), 34);
      }).join(''));
    });
    L.push('');
    L.push('=== 渲染比較(每幀 CPU 提交 ms,多輪取中位;倍率 = Canvas2D / WebGL) ===');
    L.push(padR('sprite數', 10) + padR('Canvas2D', 12) + padR('WebGL', 12) + '倍率');
    A.gl.perCount.forEach(function (p) { L.push(padR(p.n, 10) + padR(p.c2d === null ? '-' : r2(p.c2d), 12) + padR(p.gl === null ? '-' : r2(p.gl), 12) + (p.ratio ? r1(p.ratio) + 'x' : '-')); });
    L.push('');
    L.push('=== 發熱/降頻時間序列(112×112、縮放 0.4、路人 120;每筆為該時間窗的平均) ===');
    (state.s3.phases || []).forEach(function (ph) {
      L.push('--- ' + (ph.mode === 'A' ? 'Canvas 2D 現行 (A)' : '地形分塊預畫 (B,代替 WebGL)') + (ph.error ? ' 錯誤:' + ph.error : '') + (ph.untrusted ? ' [不可信]' : '') + ' ---');
      L.push('筆 | 起算秒 | 時間 | 平均ms | p95ms | fps | 幀數 | 備註');
      (ph.samples || []).forEach(function (s, i) {
        L.push((i + 1) + ' | ' + s.t + ' | ' + s.time + ' | ' + r2(s.avgMs) + ' | ' + r2(s.p95Ms) + ' | ' + r1(s.fps) + ' | ' + s.frames + ' | ' + (s.stall ? '畫面停頓' : '') + (s.heapMB ? ' heap' + r1(s.heapMB) + 'MB' : ''));
      });
    });
    L.push('');
    L.push('=== 裝置資訊 ===');
    L.push('userAgent: ' + (dv.ua || '?'));
    L.push('螢幕 ' + dv.screen + ' 視窗 ' + dv.inner + ' dpr ' + dv.dpr + ' standalone(主畫面App) ' + dv.standalone + ' iOS推測 ' + (dv.ios || '-'));
    L.push('hardwareConcurrency ' + (dv.cores || '?') + ' deviceMemory ' + (dv.mem || '?') + ' performance.memory ' + (dv.perfMem || '無'));
    var gi = state.s2.info || dv.webgl || {};
    L.push('WebGL ' + (gi.glOk === false ? '不可用' : (gi.version || '?')) + ' 渲染器 ' + (gi.renderer || '?') + ' 廠商 ' + (gi.vendor || '?') + ' MAX_TEXTURE_SIZE ' + (gi.maxTex || '?') + ' WebGL2 ' + (gi.webgl2 ? '有' : '無'));
    L.push('防休眠: ' + (state.wake.method || '?') + (state.wake.note ? '(' + state.wake.note + ')' : '') + ' 遊戲路徑 BASE ' + (dv.base || '?') + ' 腳本數 ' + (dv.scripts || '?'));
    L.push('起訖: ' + (state.started || '') + ' ~ ' + (state.ended || '') + ' (' + r1(state.totalSec || 0) + ' 秒)');
    L.push('');
    L.push('=== 使用者輸入 ===');
    L.push('開始前電量 ' + (inputs.bat0 || '-') + '% 結束後電量 ' + (inputs.bat1 || '-') + '% 手感溫度 ' + (inputs.temp || '-'));
    L.push('備註: ' + (inputs.note || '-'));
    L.push('');
    var errs = [].concat(state.errors || [], state.s1.errors || [], state.s2.errors || [], state.s3.errors || []);
    L.push('=== 錯誤與中斷 ===');
    if (!errs.length && !(state.interrupts || []).length) L.push('無');
    errs.slice(0, 20).forEach(function (e) { L.push('錯誤: ' + e); });
    (state.interrupts || []).slice(0, 20).forEach(function (e) { L.push('中斷: ' + e.type + ' @ ' + e.at + ' (測試第 ' + e.off + ' 秒)'); });
    L.push('');
    L.push('=== 原始資料:階段 1(每行一格) ===');
    L.push('size/life/mode zoom | avgMs medMs p95Ms maxMs | fps fpsLow | 判定 | 可見格 物件 路人(畫面/總) | sprite張數 MB miss | 分塊MB 烘焙次數 | heapMB | 旗標');
    (state.s1.cells || []).forEach(function (r) {
      if (r.error) { L.push(r.size + '/' + r.life + '/' + r.mode + ' z' + r.zoom + ' | 錯誤: ' + r.error); return; }
      L.push(r.size + '/' + r.life + '/' + r.mode + ' z' + r.zoom + ' | ' + r2(r.avgMs) + ' ' + r2(r.medMs) + ' ' + r2(r.p95Ms) + ' ' + r2(r.maxMs) + ' | ' + r1(r.fps) + ' ' + r1(r.fpsLow) + ' | ' + Core.verdict(r).t + (Core.can30(r) ? '+30' : '') +
        ' | ' + r.cells + ' ' + r.objs + ' ' + r.npcsOnScreen + '/' + r.npcsTotal + ' | ' + r.sprCount + ' ' + r1(r.sprMB) + ' ' + r.sprMiss + ' | ' + r1(r.chunkMB) + ' ' + r.bakes + ' | ' + (r.heapMB === null || r.heapMB === undefined ? '-' : r1(r.heapMB)) + ' | ' + (r.untrusted ? '不可信' : ''));
    });
    L.push('');
    L.push('=== 原始資料:階段 2(每輪) ===');
    L.push('mode n round | cpuAvg cpuMed cpuP95 | gapAvg gapP95 | fps');
    (state.s2.cases || []).forEach(function (c) {
      if (c.error) { L.push(c.mode + ' ' + c.n + ' r' + c.round + ' | 錯誤: ' + c.error); return; }
      L.push(c.mode + ' ' + c.n + ' r' + c.round + ' | ' + r2(c.cpuAvg) + ' ' + r2(c.cpuMed) + ' ' + r2(c.cpuP95) + ' | ' + r2(c.gapAvg) + ' ' + r2(c.gapP95) + ' | ' + r1(c.fps) + (c.untrusted ? ' 不可信' : ''));
    });
    L.push('');
    // JSON
    function cj(r) {
      if (r.error) return { s: r.size, l: r.life, m: r.mode, z: r.zoom, err: r.error };
      return { s: r.size, l: r.life, m: r.mode, z: r.zoom, avg: r2(r.avgMs), med: r2(r.medMs), p95: r2(r.p95Ms), max: r2(r.maxMs), fps: r1(r.fps), low: r1(r.fpsLow), cells: r.cells, objs: r.objs, npc: r.npcsOnScreen, sprMB: r1(r.sprMB), miss: r.sprMiss, ckMB: r1(r.chunkMB), bakes: r.bakes, v: Core.verdict(r).t, u: r.untrusted ? 1 : 0 };
    }
    var json = {
      schema: state.schema, fast: state.fast, started: state.started, ended: state.ended, totalSec: r1(state.totalSec || 0), aborted: state.aborted,
      device: dv, inputs: inputs, wake: state.wake, headline: A.headline, conclusions: A.conclusions,
      s1: state.s1.cells.map(cj),
      s2: { info: state.s2.info, cases: (state.s2.cases || []).map(function (c) { return c.error ? { m: c.mode, n: c.n, r: c.round, err: c.error } : { m: c.mode, n: c.n, r: c.round, cpuAvg: r2(c.cpuAvg), cpuMed: r2(c.cpuMed), cpuP95: r2(c.cpuP95), gapAvg: r2(c.gapAvg), fps: r1(c.fps), u: c.untrusted ? 1 : 0 }; }), perCount: A.gl.perCount.map(function (p) { return { n: p.n, c2d: p.c2d && r2(p.c2d), gl: p.gl && r2(p.gl), ratio: p.ratio && r2(p.ratio) }; }) },
      s3: (state.s3.phases || []).map(function (ph) { return { mode: ph.mode, error: ph.error, untrusted: ph.untrusted ? 1 : 0, samples: (ph.samples || []).map(function (s) { return { t: s.t, time: s.time, avg: r2(s.avgMs), p95: r2(s.p95Ms), fps: r1(s.fps), frames: s.frames, stall: s.stall ? 1 : 0 }; }) }; }),
      heat: A.heat.map(function (h) { return { mode: h.mode, ms1: h.ms1 && r2(h.ms1), ms3: h.ms3 && r2(h.ms3), risePct: h.rise !== undefined ? r1(h.rise) : null, fpsDropPct: h.fpsDrop !== undefined ? r1(h.fpsDrop) : null, level: h.level }; }),
      errors: errs.slice(0, 20), interrupts: state.interrupts || []
    };
    L.push('BEGIN_JSON');
    L.push(JSON.stringify(json));
    L.push('END_JSON');
    return L.join('\n');
  };
  Core.fileText = function (text) { return '﻿' + text.replace(/\r?\n/g, '\r\n'); };

  function INNER() {
    var BB = window.__bb = {};
    var ZOOMS_DEFAULT = [0.15, 0.25, 0.4, 0.6, 1.0, 1.6];
    var CH = 16;                         // 分塊邊長(格)
    var CHUNK_LIMIT = 48 * 1048576;      // 分塊記憶體上限(bytes)
    var chunks = new Map(), ckBytes = 0, ckTick = 0, ckStat = { bakes: 0, bakeMs: 0, hit: 0 };
    var ctxG = null, cvG = null;
    var miss = 0;
    var origVariant = null;

    function pct(a, p) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; }
    function avg(a) { if (!a.length) return 0; var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }

    // ---------- 建圖:先以遊戲 applyTemplate 置中放 city_lv25(56×56),再以週期 56 平鋪填滿 ----------
    BB.build = function () {
      cvG = document.getElementById('game');
      ctxG = cvG.getContext('2d');
      resizeCanvas(cvG);
      game.mode = 'estate';
      // 固定中午、關閉自適應降載,確保各設定可比
      window.artTodKey = function () { return 'noon'; };
      window.lifeTod = function () { return 'noon'; };
      window.lifeAdapt = function () {};
      // 計 sprite 快取 miss 數
      if (window.ART && !ART.__wrapped) {
        var os = ART.sprite;
        ART.sprite = function (key) { if (!ART.cache[key]) miss++; return os.apply(ART, arguments); };
        ART.__wrapped = true;
      }
      origVariant = window.artVariant;
      if (typeof progGet === 'function') { progGet(); if (typeof prog !== 'undefined' && prog) prog.lv = PROG_LV_MAX; }   // Lv25:土地全開、不遮罩
      var r = applyTemplate('city_lv25');
      if (!r) throw new Error('applyTemplate(city_lv25) 失敗');
      var TW56 = 56, ox = r.ox, oy = r.oy;
      var N = MAP_W * MAP_H;
      var src = { t: world.terrain.slice(), h: world.height.slice(), f: world.flow.slice(), b: world.block.slice(), z: world.zone.slice() };
      for (var y = 0; y < MAP_H; y++) for (var x = 0; x < MAP_W; x++) {
        var sx = ox + (((x - ox) % TW56) + TW56) % TW56, sy = oy + (((y - oy) % TW56) + TW56) % TW56;
        var si = sy * MAP_W + sx, di = y * MAP_W + x;
        world.terrain[di] = src.t[si]; world.height[di] = src.h[si]; world.flow[di] = src.f[si]; world.block[di] = src.b[si]; world.zone[di] = src.z[si];
      }
      var base = world.objects.slice(), out = base.slice();
      var span = Math.ceil(MAP_W / TW56) + 1;
      base.forEach(function (o) {
        var fp = footprint(o.type, o.rot);
        for (var k = -span; k <= span; k++) for (var l = -span; l <= span; l++) {
          if (!k && !l) continue;
          var nx = o.x + k * TW56, ny = o.y + l * TW56;
          if (nx < 0 || ny < 0 || nx + fp[0] > MAP_W || ny + fp[1] > MAP_H) continue;
          var c = {}; for (var key in o) c[key] = o[key];
          c.x = nx; c.y = ny; out.push(c);
        }
      });
      world.objects = out;
      rebuildOcc();
      if (typeof landDrawInvalidate === 'function') landDrawInvalidate();
      var water = 0, road = 0, byType = {};
      for (var i = 0; i < N; i++) { var t = world.terrain[i]; if (t === T_LAKE || t === T_RIVER) water++; else if (t === T_ROAD) road++; }
      out.forEach(function (o) { byType[o.type] = (byType[o.type] || 0) + 1; });
      return { size: MAP_W + 'x' + MAP_H, cells: N, objects: out.length, baseObjects: base.length, water: water, road: road, types: Object.keys(byType).length, byType: byType,
        viewport: viewport.w + 'x' + viewport.h, dpr: viewport.dpr };
    };

    // ---------- 路人:強制設定人數,以 lifeFrame 暖機(不繪製)直到接近目標 ----------
    BB.setLife = function (n) {
      LIFE_DENSITY.crowd = n;
      LIFE.density = 'crowd'; LIFE.on = true; LIFE.adj = 1; LIFE.level = 0; LIFE.healthy = 0;
      lifeReset(); LIFE.road = null; LIFE.lastT = null;
      return new Promise(function (resolve) {
        var t = 1, steps = 0;
        (function loop() {
          for (var i = 0; i < 40; i++) { t += 1 / 30; lifeFrame(t); steps++; }
          if ((LIFE.live >= LIFE.target * 0.95 && LIFE.target > 0 && steps > 120) || steps > 2400) {
            resolve({ want: n, target: LIFE.target, live: LIFE.live, npcs: LIFE.npcs.length, roadCells: LIFE.road ? LIFE.road.list.length : 0, dests: LIFE.road ? LIFE.road.dests.length : 0, steps: steps });
          } else setTimeout(loop, 0);
        })();
      });
    };

    // ---------- 模式 C:sprite seed 量化(PLAN_BIGMAP B0) ----------
    BB.setQuant = function (on) {
      if (on) window.artVariant = function (o) { var v = origVariant(o); v.seed = v.seed % 4; return v; };
      else window.artVariant = origVariant;
    };
    BB.clearCache = function () { if (window.ART && ART.clearCache) ART.clearCache(); chunks.clear(); ckBytes = 0; ckStat = { bakes: 0, bakeMs: 0, hit: 0 }; };

    // ---------- 模式 B:地形分塊預烘焙原型 ----------
    function isWet(t) { return t === T_LAKE || t === T_RIVER; }
    function chunkScale() {
      var s = view.zoom * viewport.dpr;
      return s <= 0.25 ? 0.25 : (s <= 0.5 ? 0.5 : (s <= 1 ? 1 : 0));
    }
    function chunkBox(cx, cy) {
      var x0 = cx * CH, y0 = cy * CH;
      var wx0 = isoX(x0, y0 + CH) - 4, wx1 = isoX(x0 + CH, y0) + 4;
      var wy0 = isoY(x0, y0, MAX_H) - 4, wy1 = isoY(x0 + CH, y0 + CH, 0) + MAX_H * HL + 4;
      return [wx0, wy0, wx1, wy1];
    }
    function bakeChunk(cx, cy, sc, det) {
      var a = performance.now();
      var b = chunkBox(cx, cy), w = b[2] - b[0], h = b[3] - b[1];
      var cv = document.createElement('canvas');
      cv.width = Math.ceil(w * sc); cv.height = Math.ceil(h * sc);
      var c = cv.getContext('2d');
      c.setTransform(sc, 0, 0, sc, -b[0] * sc, -b[1] * sc);
      var x0 = cx * CH, y0 = cy * CH;
      for (var d = 0; d <= 2 * CH - 2; d++) {
        for (var lx = Math.max(0, d - CH + 1); lx <= Math.min(d, CH - 1); lx++) {
          var gx = x0 + lx, gy = y0 + d - lx;
          if (gx >= MAP_W || gy >= MAP_H) continue;
          if (isWet(world.terrain[idx(gx, gy)])) continue;
          drawTile(c, gx, gy, 0);
        }
      }
      var ent = { cv: cv, box: b, bytes: cv.width * cv.height * 4, last: ++ckTick };
      chunks.set(cx + '|' + cy + '|' + sc + '|' + det, ent);
      ckBytes += ent.bytes;
      ckStat.bakes++; ckStat.bakeMs += performance.now() - a;
      // LRU
      while (ckBytes > CHUNK_LIMIT && chunks.size > 1) {
        var ok = null, ov = null;
        chunks.forEach(function (v, k) { if (v !== ent && (!ov || v.last < ov.last)) { ov = v; ok = k; } });
        if (!ok) break;
        chunks.delete(ok); ckBytes -= ov.bytes;
      }
      return ent;
    }

    var readyArr = null;
    function drawB(ctx, time) {
      drawNow = time;
      var cv = ctx.canvas;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var bgCol = PAL.bg;
      if (typeof artSky === 'function') bgCol = artSky(bgCol);
      ctx.fillStyle = bgCol; ctx.fillRect(0, 0, cv.width, cv.height);
      var z = view.zoom, r = viewport.dpr;
      ctx.setTransform(r * z, 0, 0, r * z, r * (viewport.w / 2 - view.x * z), r * (viewport.h / 2 - view.y * z));
      var landOn = landMaskOn(), lm = landOn ? landMaskGet() : null;
      if (typeof tdZonePrep === 'function') tdZonePrep(time);
      if (typeof lifeFrame === 'function') lifeFrame(time);

      var tl = screenToWorld(0, 0), br = screenToWorld(viewport.w, viewport.h);
      var wxL = tl[0], wxR = br[0], wyT = tl[1], wyB = br[1];

      // 地形分塊
      var sc = chunkScale(), det = (z >= 0.35 ? 1 : 0) + (z >= 0.5 ? 1 : 0);
      var ncx = Math.ceil(MAP_W / CH), ncy = Math.ceil(MAP_H / CH);
      if (!readyArr || readyArr.length !== ncx * ncy) readyArr = new Uint8Array(ncx * ncy);
      readyArr.fill(0);
      if (sc > 0) {
        var nbake = 0;
        for (var cd = 0; cd <= ncx + ncy - 2; cd++) {
          for (var ccx = Math.max(0, cd - ncy + 1); ccx <= Math.min(cd, ncx - 1); ccx++) {
            var ccy = cd - ccx, bb = chunkBox(ccx, ccy);
            if (!rectVisible(bb[0], bb[1], bb[2], bb[3])) continue;
            var key = ccx + '|' + ccy + '|' + sc + '|' + det, ent = chunks.get(key);
            if (!ent && nbake < 2) { ent = bakeChunk(ccx, ccy, sc, det); nbake++; }
            if (ent) {
              ent.last = ++ckTick; ckStat.hit++;
              ctx.drawImage(ent.cv, ent.box[0], ent.box[1], ent.box[2] - ent.box[0], ent.box[3] - ent.box[1]);
              readyArr[ccy * ncx + ccx] = 1;
            }
          }
        }
      }

      // 視錐:對角線範圍 + 每條對角線的 x 範圍(PLAN_BIGMAP §3.1)
      var DMAX = MAP_W + MAP_H - 2;
      var d0 = Math.max(0, Math.floor((wyT - 64) / 16) - 2), d1 = Math.min(DMAX, Math.ceil((wyB + 144) / 16) + 1);
      var uLo = Math.ceil((wxL - 32) / 32) - 1, uHi = Math.floor((wxR + 32) / 32) + 1;
      for (var d = d0; d <= d1; d++) {
        var xa = Math.max(0, d - MAP_H + 1, Math.ceil((d + uLo) / 2)), xb = Math.min(d, MAP_W - 1, Math.floor((d + uHi) / 2));
        for (var x = xa; x <= xb; x++) {
          var y = d - x;
          if (!cellVisible(x, y)) continue;
          var i = idx(x, y);
          if (landOn && lm.out[i]) { drawWasteTile(ctx, x, y); }
          else if (readyArr[((y / CH) | 0) * ncx + ((x / CH) | 0)] && !isWet(world.terrain[i])) { /* 已由分塊貼上 */ }
          else drawTile(ctx, x, y, time);
          if (typeof tdZoneCell === 'function') tdZoneCell(ctx, x, y);
        }
        if (typeof drawOverlayDiag === 'function') drawOverlayDiag(ctx, d, time);
        var list = world.objDiag[d];
        if (list) {
          list.slice().sort(function (a, b) { return a.x - b.x; }).forEach(function (o) {
            if (!objVisible(o) || (typeof tdObjSkip === 'function' && tdObjSkip(o))) return;
            var dim = landOn && lm.out[idx(o.x, o.y)] === 1;
            if (view.zoom < OBJ_BLOB_ZOOM) {
              if (dim) { ctx.save(); ctx.globalAlpha = LAND_DIM_ALPHA; drawObjBlob(ctx, o); ctx.restore(); } else drawObjBlob(ctx, o);
            } else drawObject(ctx, o, dim ? LAND_DIM_ALPHA : 1);
          });
        }
        var pl = pend.diag[d];
        if (pl) pl.slice().sort(function (a, b) { return a.x - b.x; }).forEach(function (o) { if (objVisible(o)) drawPendingObj(ctx, o); });
        if (typeof drawBattleDiag === 'function') drawBattleDiag(ctx, d, time);
        if (typeof lifeDrawDiag === 'function') lifeDrawDiag(ctx, d, time);
      }
      if (landOn) drawLandBorder(ctx, lm);
      if (typeof drawWorldOverlay === 'function') drawWorldOverlay(ctx, time);
      if (typeof tdDrawDrop === 'function') tdDrawDrop(ctx, time);
      if (typeof artLights === 'function') artLights(ctx, time);
      if (typeof lifeDrawTop === 'function') lifeDrawTop(ctx, time);
      ctx.setTransform(r, 0, 0, r, 0, 0);
    }


    // ---------- 長時間量測(發熱/降頻):每 sample 秒記一筆 ----------
    BB.runSoak = function (o, onSample) {
      return new Promise(function (resolve) {
        var drawFn = o.mode === 'A' ? draw : drawB;
        view.zoom = o.zoom;
        var cxW = isoX(MAP_W / 2, MAP_H / 2), cyW = isoY(MAP_W / 2, MAP_H / 2, 0);
        var A = Math.min(150 / o.zoom * 1.27, MAP_W * 32 * 0.35), Ay = A * 0.4;
        var t0 = null, winStart = null, last = -1, ms = [], iv = [], stall = false, samples = [];
        function emit(ts, partial) {
          if (!ms.length) return;
          var mean = avg(iv), s = { t: Math.round((ts - t0) / 1000 - o.warm), time: new Date().toTimeString().slice(0, 8), avgMs: avg(ms), p95Ms: pct(ms, 0.95), fps: mean > 0 ? 1000 / mean : 0,
            frames: ms.length, stall: stall, heapMB: (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null) };
          samples.push(s); if (onSample) onSample(s);
        }
        function step(ts) {
          if (t0 === null) t0 = ts;
          var el = (ts - t0) / 1000;
          view.x = cxW + A * Math.sin(el * 2 * Math.PI / 8);
          view.y = cyW + Ay * Math.sin(el * 2 * Math.PI / 11);
          clampView();
          var a = performance.now();
          drawFn(ctxG, ts / 1000);
          var d = performance.now() - a;
          if (el >= o.warm) {
            if (winStart === null) { winStart = ts; ms = []; iv = []; last = ts; stall = false; }
            else {
              ms.push(d);
              var g = ts - last; iv.push(g); last = ts; if (g > 2000) stall = true;
              if (ts - winStart >= o.sample * 1000) { emit(ts); winStart = ts; ms = []; iv = []; stall = false; }
            }
          }
          if (el < o.warm + o.sec && !BB.cancel) requestAnimationFrame(step); else { if (ms.length > 10 && (ts - winStart) >= o.sample * 800) emit(ts); resolve({ samples: samples }); }
        }
        requestAnimationFrame(step);
      });
    };

    // ---------- 單一量測格 ----------
    BB.runCell = function (o) {
      return new Promise(function (resolve) {
        var drawFn = o.mode === 'A' ? draw : drawB;
        view.zoom = o.zoom;
        var cxW = isoX(MAP_W / 2, MAP_H / 2), cyW = isoY(MAP_W / 2, MAP_H / 2, 0);
        var A = Math.min(150 / o.zoom * 1.27, MAP_W * 32 * 0.35), Ay = A * 0.4;
        var total = o.warm + o.sec, t0 = null, lastDraw = -1e9, started = false, prevOk = false;
        var ms = [], iv = [], missStart = 0, bakeStart = null, framesAll = 0, rafs = 0, rafFirst = 0, rafLast = 0, maxIv = 0;
        function step(ts) {
          if (t0 === null) t0 = ts;
          var el = (ts - t0) / 1000;
          view.x = cxW + A * Math.sin(el * 2 * Math.PI / 8);
          view.y = cyW + Ay * Math.sin(el * 2 * Math.PI / 11);
          clampView();
          var skip = o.cap30 && (ts - lastDraw) < 1000 / 30 - 3;
          if (!skip) {
            var a = performance.now();
            drawFn(ctxG, ts / 1000);
            var dms = performance.now() - a;
            if (el >= o.warm) {
              if (!started) { started = true; prevOk = false; missStart = miss; bakeStart = [ckStat.bakes, ckStat.bakeMs]; rafFirst = ts; }
              ms.push(dms);
              if (prevOk) { iv.push(ts - lastDraw); if (ts - lastDraw > maxIv) maxIv = ts - lastDraw; }
              prevOk = true; rafLast = ts;
            }
            lastDraw = ts;
          }
          if (el < total && !BB.cancel) requestAnimationFrame(step); else finish();
        }
        function finish() {
          // 一次性取樣:可見格 / 可見物件 / 螢幕內路人
          var cells = 0, objs = 0, npcs = 0, y, x;
          for (y = 0; y < MAP_H; y++) for (x = 0; x < MAP_W; x++) if (cellVisible(x, y)) cells++;
          world.objects.forEach(function (ob) { if (objVisible(ob)) objs++; });
          LIFE.npcs.forEach(function (n) { if (n.onS) npcs++; });
          var wall = (rafLast - rafFirst) / 1000, mean = avg(iv);
          var res = {
            mode: o.mode, zoom: o.zoom, cap30: !!o.cap30, frames: ms.length, maxIv: maxIv,
            avgMs: avg(ms), medMs: pct(ms, 0.5), p95Ms: pct(ms, 0.95), maxMs: ms.length ? Math.max.apply(null, ms) : 0,
            ivMean: mean, ivP95: pct(iv, 0.95), fps: mean > 0 ? 1000 / mean : 0, fpsLow: pct(iv, 0.95) > 0 ? 1000 / pct(iv, 0.95) : 0,
            wallSec: wall, cells: cells, objs: objs, npcsOnScreen: npcs, npcsTotal: LIFE.npcs.length, npcsLive: LIFE.live,
            sprCount: ART.cacheCount, sprMB: ART.cacheBytes / 1048576, sprMiss: miss - missStart,
            chunkMB: ckBytes / 1048576, chunkCount: chunks.size, bakes: bakeStart ? ckStat.bakes - bakeStart[0] : 0, bakeMs: bakeStart ? ckStat.bakeMs - bakeStart[1] : 0,
            heapMB: (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null)
          };
          resolve(res);
        }
        requestAnimationFrame(step);
      });
    };
  }


  // ==================================================================== 匯出(node 單元測試用)
  if (!IS_BROWSER) { module.exports = Core; return; }

  // ==================================================================== 瀏覽器端
  var $ = function (id) { return document.getElementById(id); };
  var Q = new URLSearchParams(location.search);
  var FAST = Q.get('fast') === '1';
  var STORE_KEY = 'lorddomain.benchall.report';
  var EXCLUDE = /(^|\/)(audio|audiodata|audiocache|bgm|sfxwar|ambient|mymusic|recorder|ui|settingsui|progui|guide|mapedit|battleui|fishui|fishing|pet|petdata|petdraw|petui|main|pwa)\.js$/;
  var FALLBACK_SCRIPTS = ['data', 'units', 'unitinfo', 'wallskin', 'progdata', 'cityonly', 'stratagems', 'fishdata', 'map', 'mapio', 'prog', 'tech', 'templates', 'npc', 'playerpool',
    'progmod_arch', 'progmod', 'path', 'hazards', 'td', 'perf', 'art', 'art_objects', 'art_units', 'art_deco1', 'art_deco2', 'art_deco3', 'art_deco4', 'art_deco5', 'art_port', 'art_town', 'art_set',
    'combos', 'art_traffic', 'art_wallskin', 'render', 'tddraw', 'fishdraw', 'lifedata', 'roster_data', 'citylife', 'citytraffic', 'panorama'].map(function (n) { return 'js/' + n + '.js'; });
  var BASE = null, SCRIPT_LIST = null, CSS_TEXT = '';
  var state = null, plan = null, running = false, inputs = { bat0: '', bat1: '', temp: '', note: '' };
  var progTimer = null, T0 = 0;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function nocache(u) { return u + (u.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(); }

  // ---------- 切走/鎖屏偵測 ----------
  var icount = 0;
  function markInterrupt(type) {
    if (!running || !state) return;
    icount++;
    state.interrupts.push({ type: type, at: new Date().toTimeString().slice(0, 8), off: Math.round((performance.now() - T0) / 1000) });
    updateRunUi();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) markInterrupt('hidden(切走App/鎖屏)');
    else if (running) { acquireWake(); markInterrupt('visible(返回)'); }
  });
  window.addEventListener('pagehide', function () { markInterrupt('pagehide'); });
  document.addEventListener('freeze', function () { markInterrupt('freeze'); });
  function waitVisible() {
    if (!document.hidden) return Promise.resolve();
    return new Promise(function (res) { var f = function () { if (!document.hidden) { document.removeEventListener('visibilitychange', f); res(); } }; document.addEventListener('visibilitychange', f); });
  }

  // ---------- 防休眠:Wake Lock → NoSleep(無音軌 muted 影片) ----------
  var wakeSentinel = null, nsVideo = null, nsTimer = null, wake = { method: 'none', note: '' };
  async function acquireWake() {
    if (navigator.wakeLock && navigator.wakeLock.request) {
      try {
        if (wakeSentinel && !wakeSentinel.released) { wake.method = 'wakeLock'; return; }
        wakeSentinel = await navigator.wakeLock.request('screen');
        wake.method = 'wakeLock'; wake.note = '';
        wakeSentinel.addEventListener('release', function () { if (running && !document.hidden) acquireWake(); });
        stopNoSleep();
        return;
      } catch (e) { wake.note = 'wakeLock 失敗 ' + (e && e.name) + ',改用 NoSleep'; }
    } else wake.note = '無 Wake Lock API,改用 NoSleep';
    startNoSleep();
  }
  function startNoSleep() {
    if (nsVideo) return;
    try {
      var c = document.createElement('canvas'); c.width = c.height = 16;
      var x = c.getContext('2d');
      if (!c.captureStream) { wake.method = 'none'; wake.note += ';無 captureStream,無法防休眠,請手動把「自動鎖定」設為永不'; return; }
      var v = document.createElement('video');
      v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
      v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:.02;pointer-events:none;z-index:0';
      v.srcObject = c.captureStream(10);
      document.body.appendChild(v);
      var p = v.play(); if (p && p.catch) p.catch(function () { wake.note += ';影片播放被擋'; });
      nsTimer = setInterval(function () { x.fillStyle = 'rgb(' + (Math.random() * 255 | 0) + ',0,0)'; x.fillRect(0, 0, 16, 16); }, 100);
      nsVideo = v; wake.method = 'noSleep(畫布串流影片,無聲)';
    } catch (e) { wake.method = 'none'; wake.note += ';NoSleep 失敗 ' + errStr(e); }
  }
  function stopNoSleep() { if (nsTimer) { clearInterval(nsTimer); nsTimer = null; } if (nsVideo) { try { nsVideo.pause(); nsVideo.srcObject = null; nsVideo.remove(); } catch (e) { /* */ } nsVideo = null; } }
  function releaseWake() { stopNoSleep(); if (wakeSentinel) { try { wakeSentinel.release(); } catch (e) { /* */ } wakeSentinel = null; } }

  // ---------- 遊戲載入器(複製自 bigmap_bench,改為 no-store + ?t=) ----------
  async function detectBase() {
    var cands = Q.get('base') ? [Q.get('base')] : ['../../', '../'];
    for (var i = 0; i < cands.length; i++) {
      try {
        var r = await fetch(nocache(cands[i] + 'js/data.js'), { cache: 'no-store' });
        if (r.ok) { var t = await r.text(); if (t.indexOf('MAP_W') >= 0) return cands[i]; }
      } catch (e) { /* 試下一個 */ }
    }
    throw new Error('找不到遊戲的 js/data.js(試過 ' + cands.join(' 、 ') + ');可用 ?base=路徑/ 指定');
  }
  async function prepareSources() {
    if (!BASE) BASE = await detectBase();
    var list = null;
    try {
      var h = await (await fetch(nocache(BASE + 'index.html'), { cache: 'no-store' })).text();
      var re = /<script[^>]+src="(js\/[^"]+)"/g, m, all = [];
      while ((m = re.exec(h))) all.push(m[1]);
      if (all.length > 10) list = all;
    } catch (e) { /* 用備援清單 */ }
    list = (list || FALLBACK_SCRIPTS).filter(function (s) { return !EXCLUDE.test(s); });
    var texts = await Promise.all(list.map(function (s) { return fetch(nocache(BASE + s), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(s + ' ' + r.status); return r.text(); }); }));
    SCRIPT_LIST = list.map(function (s, i) { return { name: s, text: texts[i] }; });
    try { CSS_TEXT = await (await fetch(nocache(BASE + 'css/style.css'), { cache: 'no-store' })).text(); } catch (e) { CSS_TEXT = ''; }
  }
  function injectScript(doc, text, name) {
    var s = doc.createElement('script');
    s.textContent = text + '\n//# sourceURL=' + name;
    doc.head.appendChild(s);
  }
  function killGame() {
    var old = $('gf');
    if (old) { try { old.contentWindow.__bb && (old.contentWindow.__bb.cancel = true); old.src = 'about:blank'; } catch (e) { /* */ } old.remove(); }
  }
  async function makeGame(size) {
    killGame();
    var f = document.createElement('iframe');
    f.id = 'gf'; f.title = 'game';
    document.body.insertBefore(f, document.body.firstChild);
    var W = f.contentWindow, doc = f.contentDocument;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><style>' + CSS_TEXT + '\nhtml,body{margin:0;height:100%;overflow:hidden;background:#1c2430}#game{position:fixed;inset:0;width:100%;height:100%;display:block}</style></head><body><canvas id="game"></canvas></body></html>');
    doc.close();
    var errs = [];
    W.addEventListener('error', function (e) { errs.push((e.message || 'error') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
    var dprQ = Q.get('dpr');
    injectScript(doc, '(function(){var m={};var P=Storage.prototype;P.getItem=function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null};P.setItem=function(k,v){m[k]=String(v)};P.removeItem=function(k){delete m[k]};P.clear=function(){m={}};' +
      (dprQ ? 'try{Object.defineProperty(window,"devicePixelRatio",{get:function(){return ' + Number(dprQ) + '},configurable:true})}catch(e){}' : '') + '})();', 'prelude.js');
    SCRIPT_LIST.forEach(function (s) {
      var t = s.text;
      if (/(^|\/)data\.js$/.test(s.name)) {
        var re = /MAP_W\s*=\s*56\s*,\s*MAP_H\s*=\s*56/;
        if (!re.test(t)) throw new Error('data.js 找不到 "MAP_W = 56, MAP_H = 56",無法代換尺寸');
        t = t.replace(re, 'MAP_W = ' + size + ', MAP_H = ' + size);
      }
      injectScript(doc, t, s.name);
    });
    ['sfx', 'sfxPlay', 'audioPlay', 'audioInit', 'bgmPlay'].forEach(function (n) { if (typeof W[n] === 'undefined') W[n] = function () {}; });
    injectScript(doc, '(' + INNER.toString() + ')();', 'inner.js');
    await sleep(50);
    var B = W.__bb;
    function J(p) { return p.then(function (v) { return JSON.parse(JSON.stringify(v)); }); }
    return {
      build: function () { return Promise.resolve().then(function () { var i = B.build(); if (errs.length) i.loadErrors = errs.slice(0, 3); return JSON.parse(JSON.stringify(i)); }); },
      setLife: function (n) { return J(B.setLife(n)); },
      prep: function (mode) { B.clearCache(); B.setQuant(false); return sleep(0); },
      runCell: function (o) { return J(B.runCell(o)); },
      runSoak: function (o, cb) { return J(B.runSoak(o, cb)); },
      close: function () { B.cancel = true; killGame(); }
    };
  }

  // ---------- 階段 2:Canvas2D vs WebGL 批次(複製自 render_bench) ----------
  var RB = (function () {
    var DPR = Math.min(2, window.devicePixelRatio || 1);
    if (Q.get('dpr')) DPR = parseFloat(Q.get('dpr')) || DPR;
    var SPR_N = 32, SPR_W = 64, SPR_H = 80, RES = 2, TILES = 1800;
    var c2 = null, cg = null, ctx2 = null, sprites = [], scene = { objs: [], tiles: [] };
    var gl = null, glOk = false, prog = null, uRes = null, vbuf = null, tex = null, atlasUV = [], whiteUV = null;
    var MAXQ = 8192, STRIDE = 20, ab = new ArrayBuffer(MAXQ * 4 * STRIDE), f32 = new Float32Array(ab), u32 = new Uint32Array(ab), nq = 0;
    var VS = 'attribute vec2 p;attribute vec2 uv;attribute vec4 c;uniform vec2 res;varying vec2 vu;varying vec4 vc;void main(){vu=uv;vc=c;gl_Position=vec4(p.x/res.x*2.0-1.0,1.0-p.y/res.y*2.0,0.0,1.0);}';
    var FS = 'precision mediump float;uniform sampler2D t;varying vec2 vu;varying vec4 vc;void main(){gl_FragColor=texture2D(t,vu)*vc;}';
    var info = null;
    function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    function poly(c, pts, col) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(59,35,20,0.5)'; c.lineWidth = 0.8; c.stroke(); }
    function makeSprite(i) {
      var w = SPR_W * RES, h = SPR_H * RES, body = mk(w, h), b = body.getContext('2d');
      b.setTransform(RES, 0, 0, RES, 0, 0);
      var hue = (i * 47) % 360, cx = 32, base = 74;
      if (i < 24) {
        var bw = 16 + (i % 4) * 4, bh = 14 + (i % 5) * 5;
        var L = [cx - bw, base - bw / 2], B = [cx, base], R = [cx + bw, base - bw / 2];
        poly(b, [L, B, [B[0], B[1] - bh], [L[0], L[1] - bh]], 'hsl(' + hue + ',30%,70%)');
        poly(b, [B, R, [R[0], R[1] - bh], [B[0], B[1] - bh]], 'hsl(' + hue + ',30%,55%)');
        var g = b.createLinearGradient(cx - bw, 0, cx + bw, 0);
        g.addColorStop(0, 'hsl(' + ((hue + 180) % 360) + ',45%,48%)'); g.addColorStop(1, 'hsl(' + ((hue + 180) % 360) + ',45%,32%)');
        var ap = [cx, base - bw / 2 - bh - 14];
        b.beginPath(); b.moveTo(L[0] - 3, L[1] - bh); b.lineTo(ap[0], ap[1]); b.lineTo(R[0] + 3, R[1] - bh); b.lineTo(B[0], B[1] - bh + 4); b.closePath();
        b.fillStyle = g; b.fill();
      } else {
        b.fillStyle = 'hsl(' + hue + ',50%,50%)'; b.fillRect(cx - 7, base - 26, 14, 20);
        b.beginPath(); b.arc(cx, base - 34, 9, 0, Math.PI * 2); b.fillStyle = '#f2d2b0'; b.fill();
      }
      var sil = mk(w, h), s = sil.getContext('2d');
      s.drawImage(body, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#3b2314'; s.fillRect(0, 0, w, h);
      var out = mk(w, h), o = out.getContext('2d'), px = 1.6 * RES;
      for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2; o.drawImage(sil, Math.cos(a) * px, Math.sin(a) * px); }
      o.drawImage(body, 0, 0);
      return out;
    }
    function buildScene(n) {
      var rnd = 12345; function r() { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; }
      var W = 1800, H = 1000;
      scene.objs = [];
      for (var i = 0; i < n; i++) scene.objs.push({ x: r() * W, y: r() * H, s: (i % 7 === 0) ? 24 + (i % 8) : (i % SPR_N < 24 ? i % 24 : 24 + i % 8) });
      scene.objs.sort(function (a, b) { return a.y - b.y; });
      scene.tiles = [];
      var side = Math.ceil(Math.sqrt(TILES));
      for (var t = 0; t < TILES; t++) {
        var gx = t % side, gy = (t / side) | 0, hs = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
        scene.tiles.push({ x: (gx - gy) * 32 + W / 2, y: (gx + gy) * 16, col: ['#7fb069', '#76a862', '#88b872'][hs % 3], rgba: [[127, 176, 105], [118, 168, 98], [136, 184, 114]][hs % 3] });
      }
    }
    function cam(t) { return { x: 300 + Math.sin(t * 0.0004) * 200, y: 200 + Math.cos(t * 0.0003) * 120, z: 0.6 }; }
    function draw2d(t) {
      var c = cam(t), z = c.z, cw = c2.width, ch = c2.height;
      ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.fillStyle = '#26303c'; ctx2.fillRect(0, 0, cw, ch);
      ctx2.setTransform(DPR * z, 0, 0, DPR * z, -c.x * DPR * z, -c.y * DPR * z);
      var T = scene.tiles;
      for (var i = 0; i < T.length; i++) {
        var p = T[i]; ctx2.beginPath(); ctx2.moveTo(p.x, p.y); ctx2.lineTo(p.x + 32, p.y + 16); ctx2.lineTo(p.x, p.y + 32); ctx2.lineTo(p.x - 32, p.y + 16); ctx2.closePath();
        ctx2.fillStyle = p.col; ctx2.fill(); ctx2.strokeStyle = 'rgba(0,0,0,0.06)'; ctx2.lineWidth = 1; ctx2.stroke();
      }
      var O = scene.objs;
      for (var j = 0; j < O.length; j++) { var o = O[j]; ctx2.drawImage(sprites[o.s], o.x - 32, o.y - 74, SPR_W, SPR_H); }
    }
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    function glInit() {
      gl = cg.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false });
      if (!gl) return false;
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog); uRes = gl.getUniformLocation(prog, 'res');
      var idx = new Uint16Array(MAXQ * 6);
      for (var q = 0; q < MAXQ; q++) { var v = q * 4, k = q * 6; idx[k] = v; idx[k + 1] = v + 1; idx[k + 2] = v + 2; idx[k + 3] = v; idx[k + 4] = v + 2; idx[k + 5] = v + 3; }
      var ibuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      vbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbuf); gl.bufferData(gl.ARRAY_BUFFER, ab.byteLength, gl.DYNAMIC_DRAW);
      var lp = gl.getAttribLocation(prog, 'p'), lu = gl.getAttribLocation(prog, 'uv'), lc = gl.getAttribLocation(prog, 'c');
      gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, STRIDE, 0);
      gl.enableVertexAttribArray(lu); gl.vertexAttribPointer(lu, 2, gl.FLOAT, false, STRIDE, 8);
      gl.enableVertexAttribArray(lc); gl.vertexAttribPointer(lc, 4, gl.UNSIGNED_BYTE, true, STRIDE, 16);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      var A = 2048, atlas = mk(A, A), ac = atlas.getContext('2d'), cw = SPR_W * RES, chh = SPR_H * RES, per = Math.floor(A / (cw + 2));
      atlasUV = [];
      for (var i = 0; i < sprites.length; i++) {
        var ax = (i % per) * (cw + 2), ay = Math.floor(i / per) * (chh + 2);
        ac.drawImage(sprites[i], ax, ay);
        atlasUV.push([ax / A, ay / A, (ax + cw) / A, (ay + chh) / A]);
      }
      ac.fillStyle = '#fff'; ac.fillRect(A - 8, A - 8, 8, 8); whiteUV = [(A - 6) / A, (A - 6) / A, (A - 2) / A, (A - 2) / A];
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      atlas.width = atlas.height = 0;
      cg.addEventListener('webglcontextlost', function (e) { e.preventDefault(); glOk = false; }, false);
      return true;
    }
    function quad(x0, y0, x1, y1, x2, y2, x3, y3, uv, rgba) {
      if (nq >= MAXQ) flush();
      var o = nq * 20;
      f32[o] = x0; f32[o + 1] = y0; f32[o + 2] = uv[0]; f32[o + 3] = uv[1]; u32[o + 4] = rgba;
      f32[o + 5] = x1; f32[o + 6] = y1; f32[o + 7] = uv[2]; f32[o + 8] = uv[1]; u32[o + 9] = rgba;
      f32[o + 10] = x2; f32[o + 11] = y2; f32[o + 12] = uv[2]; f32[o + 13] = uv[3]; u32[o + 14] = rgba;
      f32[o + 15] = x3; f32[o + 16] = y3; f32[o + 17] = uv[0]; f32[o + 18] = uv[3]; u32[o + 19] = rgba;
      nq++;
    }
    function flush() { if (!nq) return; gl.bufferSubData(gl.ARRAY_BUFFER, 0, f32.subarray(0, nq * 20)); gl.drawElements(gl.TRIANGLES, nq * 6, gl.UNSIGNED_SHORT, 0); nq = 0; }
    function packRGB(c) { return (255 << 24 | c[2] << 16 | c[1] << 8 | c[0]) >>> 0; }
    function drawGl(t) {
      if (!glOk) throw new Error('WebGL context lost');
      var c = cam(t), k = DPR * c.z, ox = -c.x * k, oy = -c.y * k;
      gl.viewport(0, 0, cg.width, cg.height); gl.uniform2f(uRes, cg.width, cg.height);
      gl.clearColor(0.15, 0.19, 0.235, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      var T = scene.tiles;
      for (var i = 0; i < T.length; i++) {
        var p = T[i], x = p.x * k + ox, y = p.y * k + oy, col = p.packed || (p.packed = packRGB(p.rgba));
        quad(x, y, x + 32 * k, y + 16 * k, x, y + 32 * k, x - 32 * k, y + 16 * k, whiteUV, col);
      }
      var O = scene.objs;
      for (var j = 0; j < O.length; j++) {
        var o = O[j], sx = (o.x - 32) * k + ox, sy = (o.y - 74) * k + oy, w = SPR_W * k, h = SPR_H * k;
        quad(sx, sy, sx + w, sy, sx + w, sy + h, sx, sy + h, atlasUV[o.s], 0xffffffff);
      }
      flush();
    }
    function resize() {
      var w = Math.round(innerWidth * DPR), h = Math.round(innerHeight * DPR);
      if (c2.width !== w || c2.height !== h) { c2.width = w; c2.height = h; }
      if (cg.width !== w || cg.height !== h) { cg.width = w; cg.height = h; }
    }
    function stat(a) { if (!a.length) return { avg: 0, med: 0, p95: 0 }; var s = a.slice().sort(function (x, y) { return x - y; }); var sum = 0; for (var i = 0; i < s.length; i++) sum += s[i]; return { avg: sum / s.length, med: s[s.length >> 1], p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] }; }
    return {
      init: function () {
        $('rbwrap').style.display = 'block';
        c2 = $('c2d'); cg = $('cgl'); ctx2 = c2.getContext('2d');
        if (!sprites.length) for (var i = 0; i < SPR_N; i++) sprites.push(makeSprite(i));
        info = { glOk: false, dpr: DPR };
        try {
          info.glOk = !!glInit() && true; glOk = info.glOk;
          if (gl) {
            info.version = gl.getParameter(gl.VERSION); info.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            var ext = gl.getExtension('WEBGL_debug_renderer_info');
            if (ext) { info.renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); info.vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL); }
            else { info.renderer = gl.getParameter(gl.RENDERER); info.vendor = gl.getParameter(gl.VENDOR); info.note = '無 WEBGL_debug_renderer_info,顯示遮罩值'; }
          }
        } catch (e) { info.glOk = false; glOk = false; info.error = errStr(e); }
        try { var t = document.createElement('canvas').getContext('webgl2'); info.webgl2 = !!t; if (t) { var le = t.getExtension('WEBGL_lose_context'); if (le) le.loseContext(); } } catch (e) { info.webgl2 = false; }
        info.offscreenCanvas = typeof OffscreenCanvas !== 'undefined'; info.webgpu = !!navigator.gpu;
        return info;
      },
      runCase: function (mode, n, sec, warm) {
        return new Promise(function (resolve, reject) {
          try {
            buildScene(n); c2.hidden = mode !== '2d'; cg.hidden = mode !== 'gl'; resize();
            var drawFn = mode === '2d' ? draw2d : drawGl, cpu = [], gaps = [], t0 = -1, last = -1;
            var step = function (now) {
              try {
                if (t0 < 0) t0 = now;
                var el = now - t0, a = performance.now(); drawFn(now); var b = performance.now();
                if (el > warm * 1000) { cpu.push(b - a); if (last >= 0) gaps.push(now - last); }
                last = now;
                if (el < (warm + sec) * 1000) requestAnimationFrame(step);
                else { var c = stat(cpu), g = stat(gaps); resolve({ cpuAvg: c.avg, cpuMed: c.med, cpuP95: c.p95, gapAvg: g.avg, gapP95: g.p95, fps: 1000 / Math.max(1, g.avg), frames: cpu.length }); }
              } catch (e) { reject(e); }
            };
            requestAnimationFrame(step);
          } catch (e) { reject(e); }
        });
      },
      done: function () { $('rbwrap').style.display = 'none'; }
    };
  })();

  // ---------- 裝置資訊 ----------
  function collectDevice() {
    var ua = navigator.userAgent, m = /OS (\d+)[_.](\d+)/.exec(ua), v = /Version\/([\d.]+)/.exec(ua);
    var pm = null; try { if (performance.memory) pm = Math.round(performance.memory.usedJSHeapSize / 1048576) + '/' + Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' MB(已用/上限)'; } catch (e) { /* */ }
    var standalone = false; try { standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); } catch (e) { /* */ }
    return {
      ua: ua, model: /iPhone/.test(ua) ? 'iPhone' : (/iPad/.test(ua) ? 'iPad' : (navigator.platform || 'PC')), platform: navigator.platform,
      screen: screen.width + 'x' + screen.height, inner: innerWidth + 'x' + innerHeight, dpr: window.devicePixelRatio || 1,
      cores: navigator.hardwareConcurrency || null, mem: navigator.deviceMemory || null, standalone: standalone,
      ios: m ? m[1] + '.' + m[2] + '(UA;Safari 26 起 UA 可能凍結為 18.x)' : (v ? 'Safari/Version ' + v[1] : null), perfMem: pm, base: BASE, scripts: SCRIPT_LIST ? SCRIPT_LIST.length : 0,
      lang: navigator.language, lowPowerHint: '無法偵測,請自行確認未開啟低電量模式'
    };
  }

  // ---------- UI:執行中 ----------
  function fmtTime(s) { s = Math.max(0, Math.round(s)); return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60); }
  function updateRunUi() {
    if (!state || !state.progress) return;
    var s = state.progress.snapshot();
    $('runBar').style.width = (s.frac * 100).toFixed(1) + '%';
    $('runPct').textContent = Math.round(s.frac * 100) + '%';
    $('runRemain').textContent = fmtTime(s.remaining);
    $('runStage').textContent = s.stage;
    $('runLabel').textContent = s.label;
    var warn = state.interrupts.filter(function (e) { return /^hidden|^pagehide|^freeze/.test(e.type); }).length;
    $('runWake').textContent = '防休眠:' + wake.method + (warn ? ' | 偵測到切走 ' + warn + ' 次(該段結果會標為不可信)' : '');
    $('runWake').className = warn ? 'bad' : '';
  }

  // ---------- 儲存 ----------
  function saveReport(partial) {
    try {
      var copy = JSON.stringify({ savedAt: new Date().toISOString(), partial: !!partial, inputs: inputs, state: state }, function (k, v) { return k === 'progress' ? undefined : v; });
      localStorage.setItem(STORE_KEY, copy);
    } catch (e) { /* 私密模式或滿了:忽略 */ }
  }
  function loadSaved() {
    try { var t = localStorage.getItem(STORE_KEY); if (!t) return null; var o = JSON.parse(t); return o && o.state ? o : null; } catch (e) { return null; }
  }

  // ---------- 報告畫面 ----------
  var curText = '';
  function currentText() { curText = Core.buildText(state, inputs); return curText; }
  function msg(t, bad) { var m = $('shareMsg'); m.textContent = t; m.className = bad ? 'bad' : 'ok'; }
  function renderReport(banner) {
    var A = Core.analyze(state), zooms = state.plan.s1.zooms, h = '';
    $('repBanner').innerHTML = banner ? esc(banner) : '';
    $('repBanner').style.display = banner ? 'block' : 'none';
    h += '<h2>結論與建議</h2><ul class="concl">' + A.conclusions.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>';
    h += '<h2>判定表</h2><div class="muted">每格:平均 ms/幀、判定文字。綠=fps≥30 且低檔≥20、黃=20~30、紅=&lt;20;+30 = draw p95≤24ms。列 = 地圖尺寸/路人數/模式(A 現行、B 分塊)。</div><div class="tw"><table><tr><th>尺寸/路人/模式</th>' + zooms.map(function (z) { return '<th>縮放 ' + z + '</th>'; }).join('') + '</tr>';
    A.rows.forEach(function (row) {
      h += '<tr><th>' + row.size + '/' + row.life + '/' + row.mode + '</th>';
      zooms.forEach(function (z) {
        var r = row.cells[z], v = Core.verdict(r);
        h += '<td class="' + v.k + '">' + (r && !r.error ? '<b>' + v.t + '</b> ' + r1(r.avgMs) + 'ms<small>p95 ' + r1(r.p95Ms) + ' · ' + Math.round(r.fps) + 'fps' + (Core.can30(r) ? ' +30' : '') + '</small>' : '<b>' + v.t + '</b>' + (r && r.error ? '<small>' + esc(r.error.slice(0, 20)) + '</small>' : '')) + '</td>';
      });
      h += '</tr>';
    });
    h += '</table></div>';
    h += '<h2>Canvas 2D vs WebGL(每幀 CPU 提交 ms)</h2><div class="tw"><table><tr><th>sprite 數</th><th>Canvas2D</th><th>WebGL</th><th>倍率</th></tr>' +
      A.gl.perCount.map(function (p) { return '<tr><td>' + p.n + '</td><td>' + (p.c2d === null ? '-' : r2(p.c2d)) + '</td><td>' + (p.gl === null ? '-' : r2(p.gl)) + '</td><td><b>' + (p.ratio ? r1(p.ratio) + 'x' : '-') + '</b></td></tr>'; }).join('') + '</table></div>';
    h += '<h2>發熱/降頻(耗時隨時間)</h2>';
    A.heat.forEach(function (x) {
      h += '<div class="muted">' + (x.mode === 'A' ? 'Canvas 2D 現行 (A)' : '分塊預畫 (B,代替 WebGL)') + (x.n >= 2 ? ':第1分鐘 ' + r1(x.ms1) + 'ms → 第3分鐘 ' + r1(x.ms3) + 'ms,<b>' + (x.rise >= 0 ? '+' : '') + r1(x.rise) + '%</b>,' + (x.level === 'throttle' ? '<b class="r">疑似降頻</b>' : (x.level === 'mild' ? '<b class="y">輕微上升</b>' : '<b class="g">穩定</b>')) : ':' + esc(x.error || '樣本不足')) + '</div>';
    });
    h += '<h2>輸入電量/溫度(請測完後填寫)</h2>' +
      '<div class="row">結束後電量 <input id="bat1" type="text" inputmode="numeric" size="3" placeholder="%" value="' + esc(inputs.bat1) + '"> 開始前電量 <b>' + esc(inputs.bat0 || '-') + '</b>%</div>' +
      '<div class="row">手感溫度 <span id="tempBtns">' + ['涼', '微溫', '燙', '很燙'].map(function (t) { return '<button class="tb' + (inputs.temp === t ? ' on' : '') + '" data-t="' + t + '">' + t + '</button>'; }).join('') + '</span></div>' +
      '<textarea id="noteBox" placeholder="備註(機型、是否充電、低電量模式…)">' + esc(inputs.note) + '</textarea>';
    h += '<h2>完整報告文字(同分享檔內容)</h2><pre id="txt"></pre><textarea id="copyTa" aria-hidden="true"></textarea>';
    $('repBody').innerHTML = h;
    $('txt').textContent = currentText();
    var upd = function () { $('txt').textContent = currentText(); saveReport(false); };
    $('bat1').oninput = function () { inputs.bat1 = this.value.replace(/[^\d]/g, '').slice(0, 3); upd(); };
    $('noteBox').oninput = function () { inputs.note = this.value.slice(0, 300); upd(); };
    Array.prototype.forEach.call(document.querySelectorAll('#tempBtns .tb'), function (b) {
      b.onclick = function () { inputs.temp = b.getAttribute('data-t'); Array.prototype.forEach.call(document.querySelectorAll('#tempBtns .tb'), function (x) { x.classList.toggle('on', x === b); }); upd(); };
    });
    show('report');
    window.BENCHALL = { state: state, inputs: inputs, text: currentText };
  }
  function show(which) { ['home', 'run', 'report'].forEach(function (k) { $(k).style.display = k === which ? 'block' : 'none'; }); document.body.className = which; if (which !== 'run') window.scrollTo(0, 0); }

  // ---------- 三個分享按鈕 ----------
  async function doShare() {
    var text = currentText(), name = Core.fileName(state);
    try {
      var file = new File([Core.fileText(text)], name, { type: 'text/plain' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); msg('已叫出分享表(選 LINE / 存到檔案 / AirDrop)'); }
      else if (navigator.share) { await navigator.share({ title: name, text: text }); msg('此瀏覽器不支援分享檔案,已改分享文字'); }
      else msg('此瀏覽器不支援分享,請改用「複製報告文字」或「下載報告檔」', true);
    } catch (e) {
      if (e && e.name === 'AbortError') msg('已取消分享');
      else msg('分享失敗(' + (e && e.name) + '),請改用「複製報告文字」或「下載報告檔」', true);
    }
  }
  function fallbackCopy(text) {
    var ta = $('copyTa'), ok = false;
    try { ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0'; ta.value = text; ta.focus(); ta.select(); ta.setSelectionRange(0, text.length); ok = document.execCommand('copy'); } catch (e) { ok = false; }
    if (ok) msg('已複製報告文字'); else {
      try { var r = document.createRange(); r.selectNodeContents($('txt')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* */ }
      msg('自動複製失敗,已選取下方全部文字,請長按 → 拷貝', true);
    }
  }
  function doCopy() {
    var text = currentText();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { msg('已複製報告文字'); }, function () { fallbackCopy(text); });
    else fallbackCopy(text);
  }
  function doDownload() {
    try {
      var text = Core.fileText(currentText()), name = Core.fileName(state);
      var url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      msg('已嘗試下載「' + name + '」。若在主畫面 App 沒反應,請改用「分享報告檔」');
    } catch (e) { msg('下載失敗,請改用「分享報告檔」', true); }
  }

  // ---------- 主流程 ----------
  var env = {
    now: function () { return performance.now(); },
    sleep: sleep, waitVisible: waitVisible, interrupts: function () { return icount; },
    loadGame: makeGame,
    render: RB
  };
  async function startTest() {
    if (running) return;
    inputs.bat0 = $('bat0').value.replace(/[^\d]/g, '').slice(0, 3); inputs.bat1 = ''; inputs.temp = ''; inputs.note = '';
    $('btnStart').disabled = true; $('homeMsg').textContent = '準備中…(讀取遊戲腳本)';
    await acquireWake();                       // 必須在使用者點擊的事件鏈內
    try { await prepareSources(); } catch (e) { $('homeMsg').textContent = '載入失敗:' + errStr(e); $('btnStart').disabled = false; releaseWake(); return; }
    plan = Core.makePlan(FAST);
    state = Core.newState(plan);
    state.device = collectDevice(); state.wake = wake;
    state.started = new Date().toISOString();
    running = true; icount = 0; T0 = performance.now();
    show('run');
    $('runFast').style.display = FAST ? 'block' : 'none';
    progTimer = setInterval(updateRunUi, 250);
    try {
      await Core.orchestrate(plan, env, {
        onStage: function () { updateRunUi(); },
        onStageEnd: function () { saveReport(true); },
        onTick: function () { updateRunUi(); }
      }, state);
    } catch (e) { state.errors.push('流程例外: ' + errStr(e)); }
    running = false; clearInterval(progTimer);
    killGame(); try { RB.done(); } catch (e) { /* */ }
    state.ended = new Date().toISOString(); state.totalSec = (performance.now() - T0) / 1000;
    state.device = collectDevice(); state.wake = wake;
    releaseWake();
    saveReport(false);
    renderReport('測試完成。請在下方填入「結束後電量」與「手感溫度」,再按上方按鈕分享檔案。');
    $('btnStart').disabled = false; $('homeMsg').textContent = '';
  }

  async function init() {
    document.documentElement.classList.toggle('fastmode', FAST);
    $('fastTag').style.display = FAST ? 'inline' : 'none';
    $('btnStart').onclick = startTest;
    $('btnShare').onclick = doShare; $('btnCopy').onclick = doCopy; $('btnDl').onclick = doDownload;
    $('btnAgain').onclick = function () { show('home'); };
    var sup = [];
    sup.push('Wake Lock ' + ((navigator.wakeLock && navigator.wakeLock.request) ? '支援' : '不支援(將用 NoSleep 備援)'));
    sup.push('分享檔案 ' + ((navigator.canShare && navigator.share) ? '可能支援' : '不支援'));
    $('envline').textContent = sup.join(' | ');
    var saved = loadSaved();
    var ok = true;
    try { BASE = await detectBase(); $('envline').textContent += ' | 遊戲路徑 ' + BASE; }
    catch (e) { ok = false; $('homeMsg').textContent = '找不到遊戲腳本:' + errStr(e); }
    $('btnStart').disabled = !ok;
    if (saved && !Q.get('auto')) {
      state = saved.state; plan = state.plan; inputs = saved.inputs || inputs;
      try { renderReport('這是上次的報告(' + new Date(saved.savedAt).toLocaleString() + (saved.partial ? ',上次未跑完' : '') + ')。要重測請按下方「重新測試」。'); } catch (e) { show('home'); }
    } else show('home');
    if (Q.get('auto') === '1' && ok) startTest();
  }
  init();
})();
