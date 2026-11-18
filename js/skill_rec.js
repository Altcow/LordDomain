// js/skill_rec.js — 推薦戰法執行邏輯(設計_傳承選擇與推薦戰法.md 第③節 R2;純函式,不寫 DOM、不發聲)。
// 資料:SKREC(js/skill_rec_data.js,tools/gen_skill_rec.js 產生)。依賴:bn_skcard.js(解鎖 / 裝備 / 持有人)、cards.js(卡片占用、碎片)、carddata.js、bn_stages.js;全部 typeof 守衛,缺資料時回空結果、不丟例外。
// 全域:skrSource skrHeroPlan skrTeamPlan skrApply skrInhAdvice skrSkillHeroes skrWhyText skrSkName
// 約定:cs = cardsGet() 的存檔;e = 名冊 entry。S/A 戰法同時只能 1 人裝(bnSkcMaxUse)。
// 搶用規則(使用者決策 2026-11-15):想要的招牌戰法被別人裝著 → 對方閒著(不在任何隊伍、也不在外勤 / 委任 / 駐守)就自動卸下拿過來,回傳 take(從誰身上拿);對方在隊伍中或忙碌就不拿,改推次一個(記在 busy)。opt.grab === false 可關閉搶用。
// ES2017;不用 ?. ??。

// ───────── 小工具 ─────────
function skrSk(id) { return (typeof BN_SKILLS !== 'undefined' && BN_SKILLS && typeof id === 'string' && Object.prototype.hasOwnProperty.call(BN_SKILLS, id)) ? BN_SKILLS[id] : null; }
function skrSkName(id) { var d = skrSk(id); return d ? d.name : String(id || ''); }
function skrTier(id) { try { return (typeof bnSkcTier === 'function') ? bnSkcTier(id) : null; } catch (er) { return null; } }
function skrCs(cs) { try { return cs || ((typeof cardsGet === 'function') ? cardsGet() : null); } catch (er) { return null; } }
function skrEntry(cs, e) { var id = (e && typeof e === 'object') ? e.id : e; if (!id || typeof bnSkcEntry !== 'function') return null; try { return bnSkcEntry(cs, id); } catch (er) { return null; } }
function skrRec() { return (typeof SKREC !== 'undefined' && SKREC) ? SKREC : null; }
function skrWhyText(code) { var r = skrRec(); return (r && r.why && r.why[code]) || ''; }
function skrFigName(fig) { var f = (typeof CARD_FIG_BY_ID !== 'undefined' && fig) ? CARD_FIG_BY_ID[fig] : null; return f ? f.name : String(fig || ''); }
function skrIsGeneric(id) { var d = skrSk(id); return !!(d && !d.fig); }
// 傳承戰法 → 名人(BN_KIT_BY.figs[fig].legacy;複本 id s_<武將>_inh 也在此表,重跑產生器不必改這裡)
var skrLegacyMap = null;
function skrLegacyFig(id) {
  var K, f;
  if (!skrLegacyMap || skrLegacyMap.n !== ((typeof BN_KIT_BY !== 'undefined' && BN_KIT_BY && BN_KIT_BY.figs) ? Object.keys(BN_KIT_BY.figs).length : 0)) {
    skrLegacyMap = { n: 0, m: {} };
    K = (typeof BN_KIT_BY !== 'undefined' && BN_KIT_BY && BN_KIT_BY.figs) ? BN_KIT_BY.figs : {};
    for (f in K) if (K[f] && K[f].legacy) { skrLegacyMap.m[K[f].legacy] = f; skrLegacyMap.n++; }
  }
  return skrLegacyMap.m[id] || '';
}
// 同名卡:主力 / 副卡(沿用 cardsFigCopies;沒載入 cardsui_card.js 時自己算)
function skrCopies(cs, fig) {
  var lists = ['roster', 'wait', 'wander'], all = [], i, j, lv = function (e) { return (typeof cardsStarLv === 'function') ? cardsStarLv(e) : ((e && e.starLv) | 0); }, idn = function (e) { return parseInt(String(e.id).replace(/\D/g, ''), 10) || 0; };
  if (!cs || !fig) return { main: null, spares: [] };
  if (typeof cardsFigCopies === 'function') { try { return cardsFigCopies(cs, fig); } catch (er) { /* 退回自己算 */ } }
  for (i = 0; i < lists.length; i++) for (j = 0; j < (cs[lists[i]] || []).length; j++) if (cs[lists[i]][j].fig === fig) all.push(cs[lists[i]][j]);
  all.sort(function (a, b) { return lv(b) - lv(a) || (b.gr | 0) - (a.gr | 0) || idn(a) - idn(b); });
  return { main: all[0] || null, spares: all.slice(1) };
}
// 名冊中此卡現在能不能拆(在名冊、未鎖、未派駐 / 外勤、品階夠)
function skrCanInherit(cs, e) {
  var r = skrEntry(cs, e), chk, ub;
  if (!r) return { ok: false, reason: '待定或流浪中的人不能傳承,請先收入武將' };
  if (r.at) return { ok: false, reason: '派駐中,請先卸任再傳承' };
  if (typeof cardsUseBlock === 'function') { ub = cardsUseBlock(r, 'release'); if (!ub.ok) return { ok: false, reason: ub.reason + ',先讓他回來再傳承' }; }
  chk = bnSkcInheritCheck(cs, r);
  if (!chk.ok) return { ok: false, reason: (typeof CUC_INH_REASON !== 'undefined' && CUC_INH_REASON[chk.reason]) || '不可傳承', code: chk.reason };
  return { ok: true, reason: '', fresh: chk.fresh };
}
// 隊伍名單:{entryId: 隊號};opt.teamMap 優先(測試 / 呼叫端可帶)
function skrTeamMap(opt) {
  var m = {}, n, i, p, cap;
  if (opt && opt.teamMap && typeof opt.teamMap === 'object') return opt.teamMap;
  try {
    cap = (typeof bnTeamN === 'function') ? bnTeamN() : 0;
    if (typeof bnTeamPresetGet === 'function') for (n = 1; n <= cap; n++) { p = bnTeamPresetGet(n); if (p && !p.empty) for (i = 0; i < p.slots.length; i++) if (!m[p.slots[i].id]) m[p.slots[i].id] = n; }
  } catch (er) { /* 讀不到隊伍就視為沒有 */ }
  return m;
}
// 這個持有人現在閒著嗎(不在任何隊伍、也不在外勤 / 委任 / 駐守)。回 {free, why}
function skrIdle(cs, eid, teamMap) {
  var r = skrEntry(cs, eid), u;
  if (!r) return { free: true, why: '' };
  if (teamMap && teamMap[eid]) return { free: false, why: '在第 ' + teamMap[eid] + ' 隊' };
  if (typeof cardsUseGet === 'function') { u = cardsUseGet(r); if (u.k !== 'idle') return { free: false, why: (typeof CARD_USE_K !== 'undefined' && CARD_USE_K[u.k]) || u.k }; }
  else if (r.at || (r.use && r.use.k)) return { free: false, why: '忙碌中' };
  return { free: true, why: '' };
}
function skrSlotsOf(cs, e) { var r = skrEntry(cs, e); return r ? bnSkcSlots(r) : 0; }
function skrCur(r, n) { var eq = (typeof bnSkcLoad === 'function' && bnSkcLoad().eq[r.id]) || [null, null], out = [], i; for (i = 0; i < n; i++) out.push(eq[i] || null); return out; }
// 武將的候選清單:[[id, score, whyCode]];第一季名人用 SKREC.hero,其他(路人 / 非第一季)用兵種表
function skrCands(e) {
  var R = skrRec(), t, a;
  if (!R || !e) return [];
  if (e.fig && R.hero && R.hero[e.fig]) a = R.hero[e.fig];
  else { t = (typeof bnDtOf === 'function' && bnDtOf(e) === 'strat') ? '謀' : ((typeof bnDefaultTroop === 'function') ? bnDefaultTroop(e) : ''); a = (R.troop && R.troop[t]) || []; }   // 謀略型路人查『謀』鍵(2026-11-16 謀不再是兵種)
  return Array.isArray(a) ? a.filter(function (x) { return Array.isArray(x) && skrSk(x[0]); }) : [];
}

// ───────── skrSource:戰法去哪拿 ─────────
// 回 {k:'own'} | {k:'inh', fig, e, spare} | {k:'inhWait', fig, why} | {k:'draw', fig} | {k:'inhRoster', e} | {k:'book', ch:[章…]} | {k:'none'};另附 text(白話一句)
function skrSource(cs, id) {
  var r, fig, cp, ci, e, ch = [], i, roster, rows, nm;
  try {
    cs = skrCs(cs);
    if (!skrSk(id) || !skrTier(id)) return { k: 'none', text: '無法傳承或取得' };
    nm = skrSkName(id);
    if (bnSkcOwned(id)) return { k: 'own', text: '已解鎖' };
    fig = skrLegacyFig(id) || ((skrSk(id).fig && !skrIsGeneric(id)) ? skrSk(id).fig : '');
    if (fig && skrLegacyFig(id)) {
      cp = skrCopies(cs, fig);
      if (cp.main) {
        // 先找能拆的副卡;沒有就看主力這張能不能拆(只有一張 = 先想想,歸 inhWait)
        for (i = 0; i < cp.spares.length; i++) { ci = skrCanInherit(cs, cp.spares[i]); if (ci.ok) return { k: 'inh', fig: fig, e: cp.spares[i], spare: true, text: '拆一張' + skrFigName(fig) + '卡可得' }; }
        ci = skrCanInherit(cs, cp.main);
        return { k: 'inhWait', fig: fig, e: cp.main, why: ci.ok ? '你只有一張' : ci.reason, text: '拆' + skrFigName(fig) + '卡可得(' + (ci.ok ? '你只有一張' : ci.reason) + ')' };
      }
      return { k: 'draw', fig: fig, text: '抽到' + skrFigName(fig) + '後拆他的卡可得' };
    }
    // 通用戰法:紫路人卡面帶它 → 拆路人;否則通用戰法
    roster = (cs && Array.isArray(cs.roster)) ? cs.roster : [];
    for (i = 0; i < roster.length; i++) {
      e = roster[i];
      if (e.fig || (e.gr | 0) < 3) continue;
      try { rows = bnSkcNatural(e); } catch (er) { rows = []; }
      if (rows.indexOf(id) >= 0 && skrCanInherit(cs, e).ok) return { k: 'inhRoster', e: e, text: '拆紫路人' + (e.name || '') + '可得' };
    }
    if (typeof BN_CHAPTERS !== 'undefined') BN_CHAPTERS.forEach(function (c, idx) { if (c.books && c.books.indexOf(id) >= 0) ch.push(c.n || idx + 1); });
    if (ch.length) return { k: 'book', ch: ch, text: '討伐第 ' + ch.join('、') + ' 章掉落通用戰法' };
    return { k: 'none', text: '目前無法取得' };
  } catch (er) { return { k: 'none', text: '目前無法取得' }; }
}

// ───────── 核心:單人 / 整隊分配 ─────────
// 把「要的戰法 id 清單」放進槽:已裝的留在原槽;新的先放空槽,再取代非推薦的。回 final(長度 n,保留未動的原裝備)
function skrPlace(cur, ids, n) {
  var fin = cur.slice(0, n), placed = [], i, j, s;
  ids.forEach(function (id) { var k = fin.indexOf(id); if (k >= 0) placed[k] = 1; });
  ids.forEach(function (id) {
    if (fin.indexOf(id) >= 0) return;
    s = -1;
    for (j = 0; j < n; j++) if (!fin[j] && !placed[j]) { s = j; break; }
    if (s < 0) for (j = 0; j < n; j++) if (!placed[j] && ids.indexOf(fin[j]) < 0) { s = j; break; }
    if (s < 0) return;
    fin[s] = id; placed[s] = 1;
  });
  for (i = 0; i < n; i++) if (typeof fin[i] === 'undefined') fin[i] = null;
  return fin;
}
function skrCore(cs, entries, opt) {
  var o = opt || {}, grab = o.grab !== false, tm = skrTeamMap(o), H = [], teamSet = {}, pairs = [], use = {}, takenFrom = {}, per = [], hi, ri;
  entries.forEach(function (x) { var r = skrEntry(cs, x); if (r && !teamSet[r.id]) { teamSet[r.id] = 1; } });
  entries.forEach(function (x) {
    var r = skrEntry(cs, x), n, cur;
    if (!r || H.some(function (h) { return h.r.id === r.id; })) return;
    n = bnSkcSlots(r); cur = skrCur(r, n);
    H.push({ r: r, n: n, cur: cur, cands: skrCands(r), got: [], take: [], busy: [], takeIds: {} });
  });
  H.forEach(function (h, i) { h.cands.forEach(function (c, k) { pairs.push({ hi: i, id: c[0], s: +c[1] || 0, rank: k, why: c[2] }); }); });
  pairs.sort(function (a, b) { return (b.s - a.s) || (a.hi - b.hi) || (a.rank - b.rank); });
  function holdersOf(id) {   // 隊外持有人分 free / busy;隊內持有人另列
    var hs = bnSkcHolders(id, cs), ext = { free: [], busy: [], inner: [] };
    hs.forEach(function (k) {
      var st;
      if (teamSet[k]) { ext.inner.push(k); return; }
      st = skrIdle(cs, k, tm);
      if (takenFrom[id] && takenFrom[id].indexOf(k) >= 0) return;
      if (st.free) ext.free.push(k); else ext.busy.push({ eid: k, why: st.why });
    });
    return ext;
  }
  pairs.forEach(function (p) {
    var h = H[p.hi], id = p.id, chk, ext, maxU, need, used, d, i, tk = [], slot;
    if (h.got.length >= h.n || h.got.some(function (g) { return g.id === id; })) return;
    if (!skrTier(id) || !bnSkcOwned(id)) return;
    slot = h.cur.indexOf(id); if (slot < 0) slot = 0;
    chk = bnSkcCanEquip(cs, h.r, slot, id);
    if (!chk.ok && chk.reason !== 'full') return;   // 兵種 / 槽位 / 未解鎖等:跳過
    maxU = bnSkcMaxUse(id); ext = holdersOf(id);
    used = (use[id] || 0) + ext.busy.length;
    if (used >= maxU) {
      ext.busy.forEach(function (b) { if (!h.busy.some(function (x) { return x.id === id; })) h.busy.push({ id: id, holder: b.eid, holderName: (skrEntry(cs, b.eid) || {}).name || '', why: b.why }); });
      return;
    }
    need = Math.max(0, (use[id] || 0) + 1 + ext.busy.length + ext.free.length - maxU);
    if (need > 0) {
      if (!grab || need > ext.free.length) {
        ext.free.forEach(function (k) { if (!h.busy.some(function (x) { return x.id === id; })) h.busy.push({ id: id, holder: k, holderName: (skrEntry(cs, k) || {}).name || '', why: '閒置(未啟用搶用)' }); });
        return;
      }
      for (i = 0; i < need; i++) tk.push(ext.free[i]);
      takenFrom[id] = (takenFrom[id] || []).concat(tk);
      tk.forEach(function (k) { h.take.push({ id: id, from: k, fromName: (skrEntry(cs, k) || {}).name || '' }); });
    }
    use[id] = (use[id] || 0) + 1;
    h.got.push({ id: id, why: p.why, score: p.s });
  });
  // 隊內持有人超量:已分給別人的戰法,原本裝在隊友身上(沒分到)的,總數超過上限就讓他放掉(記進接收者的 take)
  (function () {
    var done = {};
    H.forEach(function (h) {
      h.got.forEach(function (g) {
        var assigned = H.filter(function (x) { return x.got.some(function (y) { return y.id === g.id; }); }), ext, over, inner;
        if (done[g.id]) return;
        done[g.id] = 1;
        ext = holdersOf(g.id);
        inner = ext.inner.filter(function (k) { return !assigned.some(function (x) { return x.r.id === k; }); });
        over = assigned.length + ext.busy.length + ext.free.length + inner.length - bnSkcMaxUse(g.id);
        inner.forEach(function (k) {
          if (over <= 0) return;
          over--;
          assigned[0].take.push({ id: g.id, from: k, fromName: (skrEntry(cs, k) || {}).name || '', mate: true });
        });
      });
    });
  })();
  H.forEach(function (h) {
    var ids = h.got.map(function (g) { return g.id; }), gotIds = {}, miss = [], i, c, left = h.n - ids.length, mateGot = {};
    H.forEach(function (x) { x.got.forEach(function (g) { mateGot[g.id] = 1; }); });
    h.got.forEach(function (g) { gotIds[g.id] = 1; });
    for (i = 0; i < h.cands.length && miss.length < left; i++) {
      c = h.cands[i];
      if (!skrTier(c[0]) || bnSkcOwned(c[0]) || gotIds[c[0]]) continue;
      miss.push({ id: c[0], name: skrSkName(c[0]), src: skrSource(cs, c[0]), why: c[2], rank: i + 1 });
    }
    var fin = skrPlace(h.cur, ids, h.n), changes = [];
    fin.forEach(function (id, s) { if (id !== h.cur[s]) changes.push({ slot: s, id: id, old: h.cur[s] }); });
    per.push({ eid: h.r.id, name: h.r.name || '', fig: h.r.fig || '', n: h.n, cur: h.cur, rec: ids, sel: fin, why: h.got.map(function (g) { return g.why; }), changes: changes, miss: miss, take: h.take, busy: h.busy });
  });
  return per;
}
function skrSummary(per) {
  var eq = 0, miss = 0, tk = 0, s;
  per.forEach(function (p) { eq += p.changes.length; miss += p.miss.length; tk += p.take.length; });
  if (!per.length) return '沒有可分配的武將';
  s = eq ? '可裝 ' + eq + ' 個戰法' : '目前已經是推薦配置';
  if (tk) s += ',其中 ' + tk + ' 個要從別人身上拿';
  if (miss) s += ';還缺 ' + miss + ' 個';
  return s;
}
// 單人推薦:回 {eid, name, n, cur, rec, sel, why, changes, miss, take, busy, ok};壞資料回 ok:false 的空計畫
function skrHeroPlan(cs, e, opt) {
  var p;
  try {
    cs = skrCs(cs);
    p = cs ? skrCore(cs, [e], opt) : [];
    if (!p.length) return { ok: false, eid: (e && e.id) || '', name: '', n: 0, cur: [], rec: [], sel: [], why: [], changes: [], miss: [], take: [], busy: [] };
    p[0].ok = true;
    return p[0];
  } catch (er) { return { ok: false, eid: (e && e.id) || '', name: '', n: 0, cur: [], rec: [], sel: [], why: [], changes: [], miss: [], take: [], busy: [] }; }
}
// 整隊分配:entries = 名冊 entry 陣列(或 id);同一戰法依分數由高到低分配,S/A(同時 1 人)只給最高分者;回 {ok, per:[…], summary, take:[…全部], miss:[…全部]}
function skrTeamPlan(cs, entries, opt) {
  var per, take = [], miss = [];
  try {
    cs = skrCs(cs);
    if (!cs || !Array.isArray(entries)) return { ok: false, per: [], summary: '沒有可分配的武將', take: [], miss: [] };
    per = skrCore(cs, entries, opt);
    per.forEach(function (p) { p.take.forEach(function (t) { take.push({ id: t.id, from: t.from, fromName: t.fromName, to: p.eid }); }); p.miss.forEach(function (m) { miss.push({ eid: p.eid, id: m.id, src: m.src }); }); });
    return { ok: true, per: per, summary: skrSummary(per), take: take, miss: miss };
  } catch (er) { return { ok: false, per: [], summary: '沒有可分配的武將', take: [], miss: [] }; }
}

// ───────── skrApply:先全部檢查完再寫(原子) ─────────
// plan = skrHeroPlan 的結果或 skrTeamPlan 的結果。回 {ok, reason, id?, eid?, equipped:[{eid,name,slot,id}], took:[{id,from,fromName,to}], text}
function skrApply(cs, plan) {
  var fail = function (reason, extra) { var o = { ok: false, reason: reason, equipped: [], took: [], text: '' }, k; if (extra) for (k in extra) o[k] = extra[k]; return o; };
  var list, d, sim = {}, k, inner = {}, eids = {}, snapshot, tm, i, j, p, r, n, row, id, cnt = {}, equipped = [], took = [], hs;
  try {
    cs = skrCs(cs);
    if (!cs || !plan || typeof plan !== 'object' || typeof bnSkcLoad !== 'function') return fail('bad');
    list = Array.isArray(plan.per) ? plan.per : (plan.eid ? [plan] : null);
    if (!list || !list.length) return fail('bad');
    d = bnSkcLoad();
    for (k in d.eq) sim[k] = d.eq[k].slice();
    tm = skrTeamMap({});
    list.forEach(function (x) { if (x && x.eid) inner[x.eid] = 1; });
    // 1. 檢查並模擬「卸下」
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (!p || typeof p.eid !== 'string' || !Array.isArray(p.sel) || !skrEntry(cs, p.eid)) return fail('none', { eid: p && p.eid });
      for (j = 0; j < (p.take || []).length; j++) {
        var t = p.take[j], arr = sim[t.from], found = -1, q;
        if (!t || typeof t.id !== 'string' || typeof t.from !== 'string') return fail('bad');
        if (!arr || arr.indexOf(t.id) < 0) continue;   // 對方已經沒裝了,不用卸
        if (!inner[t.from]) {
          q = skrIdle(cs, t.from, tm);
          if (!q.free) return fail('busy', { id: t.id, eid: t.from, why: q.why });
        }
        found = arr.indexOf(t.id); arr[found] = null;
        took.push({ id: t.id, from: t.from, fromName: t.fromName || (skrEntry(cs, t.from) || {}).name || '', to: p.eid });
      }
    }
    // 2. 模擬「裝上」
    for (i = 0; i < list.length; i++) {
      p = list[i]; r = skrEntry(cs, p.eid); n = bnSkcSlots(r);
      row = (sim[p.eid] || [null, null]).slice(0, 2);
      while (row.length < 2) row.push(null);
      for (j = 0; j < 2; j++) {
        id = p.sel[j];
        if (typeof id === 'undefined' || id === null) continue;
        if (typeof id !== 'string') return fail('bad');
        if (j >= n) return fail('slot', { id: id, eid: p.eid });
        if (row[j] === id) continue;
        if (!skrTier(id) || !bnSkcOwned(id)) return fail('own', { id: id, eid: p.eid });
        row[j] = id;
        equipped.push({ eid: p.eid, name: r.name || '', slot: j, id: id });
      }
      sim[p.eid] = row; eids[p.eid] = 1;
    }
    // 3. 驗證最終狀態(受影響的人與被卸的人)
    for (k in sim) {
      if (!eids[k] && !took.some(function (t) { return t.from === k; })) continue;
      r = skrEntry(cs, k); if (!r) continue;
      row = sim[k];
      for (j = 0; j < row.length; j++) {
        id = row[j]; if (!id) continue;
        if (j >= bnSkcSlots(r)) return fail('slot', { id: id, eid: k });
        if (row.indexOf(id) !== j) return fail('dup', { id: id, eid: k });
        if (!bnSkcOwned(id)) return fail('own', { id: id, eid: k });
        if (!bnSkcTroopOk(r, id)) return fail('troop', { id: id, eid: k });
        if (bnSkcIsLegion(id) && !bnLgTroopOk(id, r)) return fail('legion', { id: id, eid: k });
      }
    }
    for (k in sim) {
      if (!skrEntry(cs, k)) continue;
      sim[k].forEach(function (x) { if (x) cnt[x] = (cnt[x] || 0) + 1; });
    }
    for (id in cnt) if (cnt[id] > bnSkcMaxUse(id) && equipped.some(function (x) { return x.id === id; })) {
      hs = bnSkcHolders(id, cs);
      return fail('full', { id: id, holders: hs });
    }
    if (!equipped.length && !took.length) return { ok: true, reason: '', equipped: [], took: [], text: '目前已經是推薦配置' };
    // 4. 寫入(失敗還原)
    snapshot = JSON.stringify(d.eq);
    try {
      for (k in sim) {
        if (!eids[k] && !took.some(function (t) { return t.from === k; })) continue;
        if (sim[k].some(function (x) { return !!x; })) d.eq[k] = sim[k].slice(); else delete d.eq[k];
      }
      if (bnSkcSave(d) === false) throw new Error('save');
    } catch (er) {
      d.eq = JSON.parse(snapshot);
      return fail('write');
    }
    return { ok: true, reason: '', equipped: equipped, took: took, text: skrApplyText(equipped, took) };
  } catch (er2) { return fail('error'); }
}
function skrApplyText(equipped, took) {
  var s = equipped.length ? '已裝上 ' + equipped.map(function (x) { return skrSkName(x.id); }).join('、') : '';
  if (took.length) s += (s ? ';' : '') + took.map(function (t) { return '已從 ' + (t.fromName || '別人') + ' 卸下 ' + skrSkName(t.id); }).join('、');
  return s;
}

// ───────── skrInhAdvice:這張要不要拆 ─────────
// 回 {k:'gray'|'green'|'yellow', code, title, text, btn, spare, nums:{frag, recall, furnace, net}};壞資料回灰色 none
function skrInhAdvice(cs, e) {
  var r, chk, f, list, id, nm, cp, sp = null, i, ci, nums, who, fig;
  try {
    cs = skrCs(cs);
    nums = { frag: 0, recall: (typeof CARD_RECALL_COST !== 'undefined') ? CARD_RECALL_COST : 0, furnace: 0, net: 0 };
    if (!cs || !e) return { k: 'gray', code: 'none', title: '現在不能拆', text: '找不到這張卡', btn: '', spare: null, nums: nums };
    r = skrEntry(cs, e);
    if (!r) return { k: 'gray', code: 'blocked', title: '現在不能拆', text: '待定或流浪中的人不能傳承,請先收入武將', btn: '', spare: null, nums: nums };
    fig = r.fig || '';
    nums.frag = bnSkcFrag(r);
    nums.furnace = (fig && typeof CARD_FURNACE !== 'undefined' && CARD_FURNACE.fig) ? (CARD_FURNACE.fig[r.gr | 0] || 0) : 0;
    nums.net = nums.recall - nums.frag;
    ci = skrCanInherit(cs, r);
    if (!ci.ok && ci.code !== 'owned') return { k: 'gray', code: 'blocked', title: '現在不能拆', text: ci.reason, btn: '', spare: null, nums: nums };
    list = bnSkcInheritList(r); id = list.length ? list[0].id : ''; nm = skrSkName(id); who = skrFigName(fig) || r.name || '';
    if (!ci.ok) {   // owned
      return { k: 'gray', code: 'owned', title: '不用拆', text: fig ? (nm + '你已經有了,再拆不會多給。多的' + who + '建議放分解,可換 ' + nums.furnace + ' 碎片升星。') : ('這位路人的卡面戰法你都有了,再拆不會多給。'), btn: fig ? '去分解' : '', spare: null, nums: nums };
    }
    if (!fig) return { k: 'yellow', code: 'roster', title: '先想一下', text: '拆了這位路人就消失(不能請回),得碎片 ' + nums.frag + ',解鎖卡面戰法「' + nm + '」。', btn: '仍要拆這張', spare: null, nums: nums };
    cp = skrCopies(cs, fig);
    if (cp.main && cp.main.id !== r.id) return { k: 'green', code: 'isSpare', title: '建議拆', text: '這是副卡,主力' + who + ' ★' + starOf(cp.main) + ' 不受影響。', btn: '拆這張取得傳承', spare: r, nums: nums };
    for (i = 0; i < cp.spares.length; i++) if (skrCanInherit(cs, cp.spares[i]).ok) { sp = cp.spares[i]; break; }
    if (sp) return { k: 'green', code: 'hasSpare', title: '建議拆副卡', text: '你有 ' + (1 + cp.spares.length) + ' 張' + who + '。拆一張 ★' + starOf(sp) + ' 副卡就能解鎖' + nm + ',主力 ★' + starOf(cp.main) + ' 不受影響。', btn: '拆副卡 ★' + starOf(sp) + ' 取得傳承', spare: sp, nums: nums };
    return { k: 'yellow', code: 'single', title: '先想一下', text: '你只有這一張' + who + '。拆了會轉為流浪,花 ' + nums.recall + ' 碎片可請回(拆卡給 ' + nums.frag + ',等於花 ' + nums.net + ' 碎片換到戰法)。建議等抽到第二張再拆。', btn: '仍要拆這張', spare: null, nums: nums };
  } catch (er) { return { k: 'gray', code: 'none', title: '現在不能拆', text: '無法判斷', btn: '', spare: null, nums: { frag: 0, recall: 0, furnace: 0, net: 0 } }; }
}
function starOf(e) { return (typeof cardsStarLv === 'function') ? cardsStarLv(e) : ((e && e.starLv) | 0); }

// ───────── skrSkillHeroes:戰法的推薦武將 ─────────
// 回 [{fig, name, score, why, whyText, state:'roster'|'owned'|'none', e, home}];排序:武將中 > 已擁有但不在名冊 > 未擁有,同組維持資料順序
function skrSkillHeroes(cs, id) {
  var R = skrRec(), a, out = [];
  try {
    cs = skrCs(cs);
    a = (R && R.skill && Array.isArray(R.skill[id])) ? R.skill[id] : [];
    a.forEach(function (x, i) {
      var fig = x[0], cp, st = 'none', e = null, k;
      cp = cs ? skrCopies(cs, fig) : { main: null, spares: [] };
      if (cp.main) {
        k = (cs.roster || []).filter(function (z) { return z.fig === fig; });
        if (k.length) { st = 'roster'; e = k[0]; } else { st = 'owned'; e = cp.main; }
      }
      out.push({ fig: fig, name: skrFigName(fig), score: x[1], why: x[2], whyText: skrWhyText(x[2]), state: st, e: e, home: skrLegacyFig(id) === fig, i: i });
    });
    out.sort(function (p, q) { var w = { roster: 0, owned: 1, none: 2 }; return (w[p.state] - w[q.state]) || (p.i - q.i); });
  } catch (er) { return []; }
  return out;
}
