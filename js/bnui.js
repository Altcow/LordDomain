// js/bnui.js — 戰鬥 A 模式(B2)入口、戰前布陣、全螢幕戰鬥場景 game.mode='bn'、結算。PLAN_BATTLE_A §1.2、§6、§8。
// 做法同 interior.js(全螢幕子畫面):game.mode='bn';main.js 此模式不畫城市(經濟 / 科技 tick 照跑);淡入淡出 ≤ 300ms;返回鍵(popstate)/ Esc / 左上返回鈕;離開時恢復城市鏡頭與選取。
// 一個全螢幕 layer(#bnLayer)含三個階段:布陣(DOM 表單)→ 戰鬥(canvas + DOM 頂列 / 順序條 / cut-in)→ 結算(DOM)。戰鬥畫面由 bndraw.js 的播放器繪製。
// 存檔:世界內 'lorddomain.bn.v1'(進度鍵,有值才寫)、偏好 'lorddomain.bn.pref'。B2 敵人 = 固定「練習戰 1-1」山賊樣板(依我方戰力縮放);完整討伐地圖與獎勵是 B3,這裡不做。
// 不發聲(音效經 bndraw 的 sfxwPlay,有守衛)、不新增音檔。ES2017;不用 ?. ??。
// 戰鬥中頂列只留左上返回(= 暫停:繼續 / 撤退;撤退一律算敗北);工具列(回合 / 倍速 1-2-3×)在畫面下方(戰鬥改版:沒有士氣,大招為機率戰法,已移除自動大招鈕與點角色放大招);無右上關閉、無略過鈕、無行動順序條。文字戰報見 js/bnlog.js。
// 全域:BNUI bnUnlocked bnUiOpen bnUiLeave bnUiActive bnUiState bnUiLoad bnUiSave bnUiPref bnUiFoes bnUiAct bnUiBuild bnUiBonds bnUiStart bnUiResultData bnUiPause bnUiBack bnUiStats bnUiCutTap

var BNUI = {
  key: 'lorddomain.bn.v1', prefKey: 'lorddomain.bn.pref', fadeMs: 240, barH: 48, maxUnits: 5, stage: 'P', minRoster: 5, minRank: 2, dprMax: 2, pixMax: 3.6e6,
  foeBase: ['bandit_chief', 'bandit_blade', 'bandit_hunter', 'bandit_blade', 'bandit_hunter'], foePos: [[0, 1], [0, 0], [2, 1], [0, 2], [2, 0]]
};
var BNUI_FOE = {
  bandit_chief: { name: '寨主', troop: '槍', hpK: 1.25, atkK: 1.12, skills: ['g_chongfeng'], ult: 'u_inf' },
  bandit_blade: { name: '刀匪', troop: '槍', hpK: 1, atkK: 1, skills: ['g_zhan'], ult: 'u_inf' },
  bandit_hunter: { name: '獵戶', troop: '弓', hpK: 1, atkK: 1, skills: ['g_lianshe'], ult: 'u_arc' }
};
var bnu = {
  open: false, leaving: false, layer: null, cv: null, ctx: null, top: null, bar: null, backBtn: null, titleEl: null, subEl: null, strip: null, stripEls: [], roundEl: null, formEl: null, resEl: null, pauseEl: null, cutEl: null, cutParts: null,
  btns: {}, mapEl: null, entEl: null, stg: { kind: 'practice', id: 'P' }, report: null, phase: 'form', slots: [], sel: null, tp: {}, filter: '', data: null, pref: null, P: null, L: null, rec: null, raf: 0, last: 0, gate: null, paused: false, histOn: false, histSkip: false, snap: null, rz: [], dpr: 1,
  vw: 0, vh: 0, result: null, msg: '', frames: 0, listeners: false, hudRound: '', pop: null, popEl: null, popSlot: -1, drag: null, dragAt: 0
};
function bnUiActive() { return !!bnu.open; }
function bnUiState() { return bnu; }
function bnUiEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bnUiToast(m) { if (typeof showToast === 'function') { try { showToast(typeof fxText === 'function' ? fxText(m) : m); } catch (e) { /* 略過 */ } } }   // 魔幻世界用語替換(歷史世界原樣)
function bnUiPs() { return (typeof isPowerSave === 'function') && !!isPowerSave(); }

// ───────── 功能閘(v58-C):名冊 ≥ 5 人即開(不看官階、建築、科技);城建專注模式下照樣可見 ─────────
function bnUiRosterList() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null;
  return cs && cs.roster ? cs.roster : [];
}
function bnUnlocked() {
  return bnUiRosterList().length >= BNUI.minRoster;
}

// ───────── 存檔 ─────────
function bnUiLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function bnUiLsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function bnUiNormForm(f, ids) {
  var out = { slots: [] }, seen = {}, used = {}, i, s;
  if (!f || !Array.isArray(f.slots)) return out;
  for (i = 0; i < f.slots.length && out.slots.length < BNUI.maxUnits; i++) {
    s = f.slots[i];
    if (!s || typeof s.id !== 'string' || seen[s.id] || (ids && !ids[s.id])) continue;
    if (!(s.row >= 0 && s.row <= 2 && s.col >= 0 && s.col <= 2) || used[s.row + ':' + s.col]) continue;
    seen[s.id] = 1; used[s.row + ':' + s.col] = 1;
    out.slots.push({ id: s.id, row: s.row | 0, col: s.col | 0, troop: bnTroopNorm(s.troop) });
  }
  return out;
}
function bnUiRosterIds() {
  var ids = {};
  bnUiRosterList().forEach(function (e) { ids[e.id] = 1; });
  return ids;
}
function bnUiLoad() {
  var raw = bnUiLsGet(BNUI.key), d = { v: 1, forms: [null, null, null], clear: {}, cur: null, last: null, got: {}, day: null, bounty: null, wk: null, gold: null, books: {} }, o, ids = bnUiRosterIds(), i;
  if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  if (o && typeof o === 'object') {
    for (i = 0; i < 3; i++) d.forms[i] = (o.forms && o.forms[i]) ? bnUiNormForm(o.forms[i], ids) : null;
    d.cur = o.cur ? bnUiNormForm(o.cur, ids) : null;
    if (o.clear && typeof o.clear === 'object') Object.keys(o.clear).forEach(function (k) { var v = o.clear[k] | 0; if (v >= 0 && v <= 3) d.clear[k] = v; });
    if (typeof bnStgNorm === 'function') bnStgNorm(o, d);
    if (o.last && typeof o.last === 'object') d.last = { stage: String(o.last.stage || ''), res: String(o.last.res || ''), rounds: o.last.rounds | 0, stars: o.last.stars | 0 };
  }
  bnu.data = d;
  return d;
}
// 有值才寫:沒有任何預設 / 通關 / 當前陣容 / 戰績時不寫鍵
function bnUiSave() {
  var d = bnu.data || bnUiLoad(), has = d.forms.some(function (f) { return f && f.slots.length; }) || Object.keys(d.clear).length || d.last || (d.cur && d.cur.slots.length) || (typeof bnStgHas === 'function' && bnStgHas(d));
  if (!has) return false;
  return bnUiLsSet(BNUI.key, JSON.stringify(Object.assign({ v: 1, forms: d.forms, clear: d.clear, cur: d.cur, last: d.last }, typeof bnStgPack === 'function' ? bnStgPack(d) : {})));
}
function bnUiPref() {
  var raw, o, p = { spd: 1, sb: true };
  if (bnu.pref) return bnu.pref;
  raw = bnUiLsGet(BNUI.prefKey);
  if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  if (o) { if (o.spd === 2 || o.spd === 3 || o.spd === 4) p.spd = 2; if (o.sb === 0) p.sb = false; }   // 倍速只剩 1× / 2×:舊偏好 3× / 4× 退成 2×;sb = 戰法條(預設開);舊 autoUlt 偏好忽略
  bnu.pref = p;
  return p;
}
function bnUiPrefSave() { var p = bnUiPref(), o = { spd: p.spd }; if (!p.sb) o.sb = 0; bnUiLsSet(BNUI.prefKey, JSON.stringify(o)); }

// ───────── 布陣資料 ─────────
function bnUiEntry(id) {
  var l = bnUiRosterList(), i;
  for (i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
  return null;
}
function bnUiSlotAt(r, c) {
  var i;
  for (i = 0; i < bnu.slots.length; i++) if (bnu.slots[i].row === r && bnu.slots[i].col === c) return bnu.slots[i];
  return null;
}
function bnUiSlotOf(id) {
  var i;
  for (i = 0; i < bnu.slots.length; i++) if (bnu.slots[i].id === id) return bnu.slots[i];
  return null;
}
function bnUiTroopOf(e) {
  var s = bnUiSlotOf(e.id);
  return (s && s.troop) || bnu.tp[e.id] || bnDefaultTroop(e);
}
function bnUiSpec(e, o) {
  o = o || {};
  var tr = o.troop || bnUiTroopOf(e);
  return bnUnitSpec(e, { troop: tr, row: o.row !== undefined ? o.row : bnRowOf(e, tr), col: o.col !== undefined ? o.col : 0 });
}
// 目前布陣 → 單位規格 + 羈絆(bnBuildTeam)
function bnUiBuild() {
  var specs = [], i, e, s;
  for (i = 0; i < bnu.slots.length; i++) {
    s = bnu.slots[i]; e = bnUiEntry(s.id);
    if (!e) continue;
    specs.push(bnUiSpec(e, { troop: s.troop || bnu.tp[s.id], row: s.row, col: s.col }));
  }
  return { specs: specs, team: specs.length ? bnBuildTeam(specs) : { units: [], bonds: [], formation: [] } };
}
function bnUiCheck() {
  var n = bnu.slots.length;
  if (n < 1) return '請先放入至少 1 人';
  if (!bnu.slots.some(function (s) { return s.row === 0; })) return '前排至少要有 1 人';
  return '';
}
// 動作:place(id,r,c) remove(id) swap(r1,c1,r2,c2) auto troop(id,troop) saveP(i) loadP(i) clear
function bnUiAct(a, p1, p2, p3, p4) {
  var e, s, o, i, d, list;
  if (a === 'place') {
    e = bnUiEntry(p1);
    if (!e || !(p2 >= 0 && p2 <= 2 && p3 >= 0 && p3 <= 2)) return false;
    s = bnUiSlotOf(p1); o = bnUiSlotAt(p2, p3);
    if (s && o && o !== s) { o.row = s.row; o.col = s.col; s.row = p2; s.col = p3; }   // 已上陣者拖到有人的格 = 互換
    else if (s) { s.row = p2; s.col = p3; }
    else {
      if (!o && bnu.slots.length >= BNUI.maxUnits) { bnUiToast('最多上陣 ' + BNUI.maxUnits + ' 人'); return false; }
      if (o) bnu.slots.splice(bnu.slots.indexOf(o), 1);
      bnu.slots.push({ id: p1, row: p2, col: p3, troop: bnu.tp[p1] || '' });
    }
    bnu.sel = null;
  } else if (a === 'remove') {
    s = bnUiSlotOf(p1);
    if (!s) return false;
    bnu.slots.splice(bnu.slots.indexOf(s), 1);
    bnu.sel = null;
  } else if (a === 'swap') {
    s = bnUiSlotAt(p1, p2); o = bnUiSlotAt(p3, p4);
    if (!s && !o) return false;
    if (s) { s.row = p3; s.col = p4; }
    if (o) { o.row = p1; o.col = p2; }
    bnu.sel = null;
  } else if (a === 'troop') {
    e = bnUiEntry(p1);
    if (!e || !BN_DATA.troops[p2]) return false;
    bnu.tp[p1] = p2;
    s = bnUiSlotOf(p1);
    if (s) s.troop = p2;
  } else if (a === 'auto') {
    list = bnUiRosterList().map(function (x) { var sp = bnUiSpec(x, { troop: bnu.tp[x.id] || bnDefaultTroop(x) }); return { e: x, sp: sp, pw: bnPower(sp) }; });
    list.sort(function (x, y) { return y.pw - x.pw; });
    list = list.slice(0, BNUI.maxUnits);
    bnAutoLayout(list.map(function (x) { return x.sp; }), null);
    bnu.slots = list.map(function (x) { return { id: x.e.id, row: x.sp.row, col: x.sp.col, troop: x.sp.troop }; });
    bnu.sel = null;
  } else if (a === 'clear') {
    bnu.slots = []; bnu.sel = null;
  } else if (a === 'saveP') {
    if (!bnu.slots.length) { bnUiToast('目前沒有陣容可存'); return false; }
    d = bnu.data || bnUiLoad();
    d.forms[p1] = bnUiNormForm({ slots: bnu.slots }, null);
    bnUiSave();
    bnUiToast('已存為預設陣容 ' + (p1 + 1));
  } else if (a === 'loadP') {
    d = bnu.data || bnUiLoad();
    if (!d.forms[p1] || !d.forms[p1].slots.length) { bnUiToast('預設陣容 ' + (p1 + 1) + ' 是空的'); return false; }
    bnu.slots = bnUiNormForm(d.forms[p1], bnUiRosterIds()).slots;
    bnu.slots.forEach(function (x) { if (x.troop) bnu.tp[x.id] = x.troop; });
    bnu.sel = null;
  } else return false;
  bnUiCurSave();
  if (bnu.open && bnu.phase === 'form') bnUiRenderForm();
  return true;
}
function bnUiCurSave() {
  var d = bnu.data || bnUiLoad();
  d.cur = bnUiNormForm({ slots: bnu.slots }, null);
}

// ───────── 羈絆提示(開戰前即時顯示)─────────
function bnUiBonds() {
  var b = bnUiBuild(), out = { on: b.team.bonds.concat(b.team.formation), hint: [] }, facCnt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], tagCnt = {}, i, e, j, fac, best = -1, bn = 0;
  for (i = 0; i < bnu.slots.length; i++) {
    e = bnUiEntry(bnu.slots[i].id);
    if (!e) continue;
    if ((e.fac >= 0 && e.fac <= 3) || (e.fac >= 5 && e.fac <= 13)) facCnt[e.fac]++;   // 同 bn_units.js bnBuildTeam:魏蜀吳黃巾 + 魔幻 5~13;中立(4)不計
    j = (e.main && typeof CARD_JOB_BY_ID !== 'undefined') ? CARD_JOB_BY_ID[e.main] : null;
    if (j) tagCnt[j.tag] = (tagCnt[j.tag] || 0) + 1;
  }
  for (fac = 0; fac < facCnt.length; fac++) if (fac !== 4 && facCnt[fac] > bn) { bn = facCnt[fac]; best = fac; }
  if (bn === 2 && best >= 0 && bnu.slots.length < BNUI.maxUnits) out.hint.push('同為' + (typeof CARD_FAC !== 'undefined' ? CARD_FAC[best] : '陣營') + '再 1 人:全隊攻 +' + Math.round(BN_BONDS.fac[3].atk * 100) + '%');
  Object.keys(tagCnt).forEach(function (t) { if (tagCnt[t] === 1 && BN_BONDS.tag[t] && out.hint.length < 3 && bnu.slots.length < BNUI.maxUnits) out.hint.push(t + ' 差 1 人'); });
  BN_BONDS.special.forEach(function (sp) {
    var present = 0, k;
    for (k = 0; k < bnu.slots.length; k++) { e = bnUiEntry(bnu.slots[k].id); if (e && e.fig && sp.members.indexOf(e.fig) >= 0) present++; }
    if (present > 0 && present < sp.need && out.hint.length < 4) out.hint.push(sp.name + ' 差 ' + (sp.need - present) + ' 人');
  });
  return out;
}

// ───────── 敵人:練習戰 / 討伐 1-1(山賊樣板,依我方戰力縮放;B3 才做完整討伐地圖)─────────
function bnUiFoeRaw(key, scale, pos) {
  var t = BNUI_FOE[key], c = BN_DATA.troops[t.troop], k = scale, r;
  r = {
    name: t.name, troop: t.troop, row: pos[0], col: pos[1], fac: 4, gr: 0,
    hp: Math.round((150 + 4 * 50 + 2 * 50) * c.hp * t.hpK * k), atk: Math.round((30 + 50 + 10) * c.atk * t.atkK * k), mag: Math.round(90 * k), def: Math.round((10 + 25 + 5) * c.def * k),
    sres: Math.round(40 * k), spd: Math.round(50 + 15 + 10 + c.spd), heal: 90, sh: 140, crit: 0.05, res: 0.04, skills: t.skills.slice(), ult: t.ult
  };
  r = bnSpecRaw(r);
  r.look = 'foe:' + key;
  return r;
}
function bnUiFoes(mySpecs) {
  var n = Math.max(3, Math.min(5, (mySpecs && mySpecs.length) || 3)), base = [], i, mine = 0, foe = 0, s;
  for (i = 0; i < n; i++) base.push(bnUiFoeRaw(BNUI.foeBase[i], 1, BNUI.foePos[i]));
  base.forEach(function (x) { foe += bnPower(x); });
  (mySpecs || []).forEach(function (x) { mine += bnPower(x); });
  s = mine > 0 ? Math.max(0.5, Math.min(3, mine / foe * 0.95)) : 1;
  s = Math.round(s * 1000) / 1000;
  return { specs: base.map(function (x, k) { return bnUiFoeRaw(BNUI.foeBase[k], s, BNUI.foePos[k]); }), scale: s, power: Math.round(foe * s) };
}
// 目前關卡的敵將隊:討伐 = bn_stages 的關卡;每日流寇;練兵 = 山賊樣板依我方戰力縮放
function bnUiCurFoes(mySpecs) {
  var g = bnu.stg || { kind: 'practice' }, f, st;
  if (g.kind === 'stage' && typeof bnStgFoes === 'function') {
    f = bnStgFoes(g.id); st = f.stage;
    return { specs: f.units, scale: 1, power: f.rec, label: '討伐 ' + st.id + ' ' + st.name, boss: st.boss, kind: 'stage' };
  }
  if (g.kind === 'bounty' && g.def) return { specs: g.def.units, scale: 1, power: g.def.rec, label: '每日流寇', kind: 'bounty' };
  f = bnUiFoes(mySpecs);
  f.label = '練兵'; f.kind = 'practice';
  return f;
}
function bnUiStageLabel() { var g = bnu.stg || {}; return g.kind === 'stage' ? '討伐 ' + g.id : (g.kind === 'bounty' ? '每日流寇' : '練兵'); }
function bnUiDayNo() { var d = new Date(); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); }
function bnUiRec() {
  var b = bnUiBuild(), foes = bnUiCurFoes(b.team.units), cs = (typeof cardsGet === 'function') ? cardsGet() : null, fp = bnu.slots.map(function (s) { return s.id + ':' + s.row + s.col + (s.troop || bnu.tp[s.id] || ''); }).join(',');
  return {
    v: 1, seed: bnHash('bn', (cs && cs.seed) | 0, BNUI.stage, bnUiDayNo(), fp), teamA: b.team.units, teamB: foes.specs, opts: { events: true, scene: '' },
    meta: { stage: BNUI.stage, kind: (bnu.stg && bnu.stg.kind) || 'practice', ch: (bnu.stg && bnu.stg.def && bnu.stg.def.ch) || 0, foePower: foes.power, scale: foes.scale, bonds: b.team.bonds, formation: b.team.formation }
  };
}

// ───────── 版面 ─────────
function bnUiViewport() {
  var w = (typeof window !== 'undefined' && window.innerWidth) || 390, h = (typeof window !== 'undefined' && window.innerHeight) || 780;
  return { w: Math.max(120, Math.floor(w)), h: Math.max(160, Math.floor(h)) };
}
function bnUiResize() {
  var vp, dpr, top, bot, rc, P = bnu.P;
  if (!bnu.open || !bnu.cv) return;
  vp = bnUiViewport();
  dpr = Math.min(BNUI.dprMax, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  if (bnUiPs()) dpr = Math.min(dpr, 1.5);
  if (vp.w * vp.h * dpr * dpr > BNUI.pixMax) dpr = Math.sqrt(BNUI.pixMax / (vp.w * vp.h));
  bnu.vw = vp.w; bnu.vh = vp.h; bnu.dpr = dpr;
  bnu.cv.width = Math.round(vp.w * dpr); bnu.cv.height = Math.round(vp.h * dpr);
  if (bnu.cv.style) { bnu.cv.style.width = vp.w + 'px'; bnu.cv.style.height = vp.h + 'px'; }
  if (bnu.phase === 'fight' || bnu.phase === 'res') {   // 工具列在下方;上方只扣左上返回鈕
    rc = bnu.backBtn && bnu.backBtn.getBoundingClientRect ? bnu.backBtn.getBoundingClientRect() : null;
    top = (rc && rc.bottom > 0 ? rc.bottom : BNUI.barH + 4);
    bot = ((bnu.top && bnu.top.offsetHeight) || BNUI.barH) + 4;
    bnu.feedTop = vp.w > vp.h;   // 橫式:播報放上緣中央(返回鈕那一列,戰場上方),不再壓縮戰場高度
    if (bnu.phase === 'fight' && bnu.feedEl) { if (!bnu.feedTop) bot += bnUiFeedH() + 2; bnUiFeedRender(); }   // 直式:播報占用底部一條,戰場往上收,不蓋人物
  } else {
    top = (bnu.top && bnu.top.offsetHeight) || BNUI.barH;
    bot = 30;
  }
  bnu.L = bnDrLayout(vp.w, vp.h, top + 4, bot);
  if (P) { bnPlRelayout(P, bnu.L); if (bnu.phase !== 'fight' || P.done) bnUiDrawOnce(); }
}
function bnUiOnResize() {
  bnu.rz.forEach(function (h) { clearTimeout(h); });
  bnu.rz = [60, 160, 450].map(function (m) { return setTimeout(bnUiResize, m); });
}

// ───────── CSS / DOM ─────────
function bnUiCss() {
  var st;
  if (typeof document === 'undefined' || !document.head || document.getElementById('bnStyle')) return;
  st = document.createElement('style');
  st.id = 'bnStyle';
  st.textContent = '#bnLayer{position:fixed;left:0;top:0;right:0;bottom:0;z-index:70;background:#14110c;opacity:0;transition:opacity ' + BNUI.fadeMs + 'ms ease;touch-action:manipulation;user-select:none;-webkit-user-select:none;color:#f4ead2;display:flex;flex-direction:column;overflow:hidden}' +
    '#bnLayer.on{opacity:1}#bnCv{position:absolute;left:0;top:0;display:none}#bnLayer.ph-fight #bnCv,#bnLayer.ph-res #bnCv{display:block}' +
    '#bnTop{position:relative;z-index:3;order:-1;flex:0 0 auto;background:rgba(28,20,14,.9);padding-top:env(safe-area-inset-top)}' +
    '#bnBar{display:flex;align-items:center;gap:6px;min-height:48px;padding:2px calc(8px + env(safe-area-inset-right)) 2px calc(8px + env(safe-area-inset-left))}' +
    '#bnBar button,.bnbtn{min-width:44px;min-height:44px;border:none;border-radius:8px;background:rgba(255,255,255,.14);color:#f4ead2;font-size:16px;padding:0 10px;cursor:pointer}#bnBar button.on{background:#c9892f;color:#1b1308;font-weight:bold}' +
    '#bnBar b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px}#bnBar span{font-size:13px;opacity:.85;white-space:nowrap}' +
    '#bnLayer .fo{display:none}#bnLayer.ph-fight .fo{display:inline-block}#bnLayer.ph-fight .fo.ib{display:inline-flex}#bnLayer.ph-fight .nf{display:none}' +
    // 戰鬥中:工具列移到畫面下方(直 / 橫皆同),上方整片給戰場;只有返回鈕浮在左上角
    '#bnLayer.ph-fight #bnTop{position:absolute;left:0;right:0;top:auto;bottom:0;padding-top:0;padding-bottom:env(safe-area-inset-bottom);background:rgba(28,20,14,.82)}' +
    '#bnLayer.ph-fight #bnBar .bk{position:fixed;z-index:4;left:calc(6px + env(safe-area-inset-left));top:calc(4px + env(safe-area-inset-top));background:rgba(20,14,10,.6)}' +
    '#bnLayer.ph-fight #bnBar{justify-content:flex-end}' +
    '#bnForm{position:relative;z-index:2;flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));display:none}#bnLayer.ph-form #bnForm{display:block}' +
    '.bnf-foe,.bnf-bonds,.bnf-sel{font-size:13px;line-height:1.5;margin:0 0 6px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.07)}.bnf-foe i{font-style:normal;display:inline-block;margin:0 6px 0 0;padding:0 6px;border-radius:6px;background:rgba(168,74,58,.35)}' +
    '.bnf-bonds i{font-style:normal;display:inline-block;margin:2px 6px 2px 0;padding:0 8px;border-radius:10px;background:#c9892f;color:#1b1308;font-weight:bold}.bnf-bonds u{text-decoration:none;display:inline-block;margin:2px 6px 2px 0;opacity:.6}' +
    '.bnf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:420px;margin:0 auto 4px}.bnf-gh{font-size:12px;text-align:center;opacity:.7}' +
    '.bnf-cell{min-height:60px;border-radius:10px;border:2px dashed rgba(255,255,255,.28);background:rgba(255,255,255,.06);color:#f4ead2;font-size:13px;line-height:1.25;padding:2px;display:flex;flex-direction:column;align-items:center;justify-content:center}' +
    '.bnf-cell.occ{border-style:solid;border-color:#3a6ea8;background:rgba(58,110,168,.3)}.bnf-cell.sel{box-shadow:0 0 0 3px #ffd25a}.bnf-cell small{opacity:.85;font-size:11px}' +
    '.bnf-roster{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:4px 0 8px}.bnf-roster::-webkit-scrollbar{display:none}.bnf-card{flex:0 0 auto;min-width:78px;min-height:58px;border-radius:8px;border:2px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#f4ead2;font-size:12px;line-height:1.3;padding:3px 6px;text-align:left}' +
    '.bnf-card.sel{border-color:#ffd25a}.bnf-card.on{opacity:.55}.bnf-card b{font-size:13px}.g0 b{color:#e6e6e6}.g1 b{color:#8fd9a0}.g2 b{color:#8ab8ff}.g3 b{color:#d9a0ff}.g4 b{color:#ffd25a}' +
    '.bnf-chips{display:flex;gap:4px;flex-wrap:wrap;margin:2px 0 4px}.bnf-chips button{min-height:34px;min-width:44px;border:none;border-radius:8px;background:rgba(255,255,255,.12);color:#f4ead2;font-size:12px}.bnf-chips button.on{background:#c9892f;color:#1b1308}.bnf-chips button.bad{color:#ff9a8a}' +
    '.bnf-foot{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.bnf-go{flex:1 1 140px;min-height:50px;border:none;border-radius:10px;background:#c9892f;color:#1b1308;font-size:18px;font-weight:bold}.bnf-go[disabled]{opacity:.4}' +
    '.bnf-msg{color:#ff9a8a;font-size:13px;margin:4px 0}' +
    '.py{font-style:normal;font-size:10px;font-weight:bold;margin-left:3px;padding:0 3px;border-radius:5px;white-space:nowrap}.py.u{background:#3f7d38;color:#eaffdc}.py.d{background:#9a4638;color:#ffe3dc}' +
    '.bnf-prey{font-size:12px;line-height:1.5;margin:0 0 6px;padding:4px 8px;border-radius:8px;background:rgba(255,255,255,.07)}.bnf-prey summary{min-height:30px;display:flex;align-items:center;gap:2px;cursor:pointer}.bnf-prey .pt{margin:2px 0 4px;opacity:.92}' +
    '.bnf-prey table{border-collapse:collapse;width:100%;margin-bottom:2px}.bnf-prey th{width:2em;text-align:center;color:#ffd25a}.bnf-prey td{padding:1px 4px}.bnf-prey td.u{color:#a6e58f}.bnf-prey td.d{color:#ffa595}' +
    '@media (orientation:landscape) and (min-width:700px){#bnForm{display:none}#bnLayer.ph-form #bnForm{display:grid;grid-template-columns:minmax(300px,1fr) minmax(300px,1.2fr);column-gap:14px;align-content:start}#bnForm .c1{grid-column:1}#bnForm .c2{grid-column:2}.bnf-roster{flex-wrap:wrap;overflow-x:visible}}' +
    '#bnMap{position:relative;z-index:2;flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));display:none}#bnLayer.ph-map #bnMap{display:block}' +
    '#bnEntry{position:relative;z-index:2;flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:12px calc(12px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));display:none}#bnLayer.ph-entry #bnEntry{display:block}' +
    '.bnen{display:flex;flex-direction:column;gap:10px;max-width:520px;margin:0 auto}.bnen-sum{margin:0;font-size:13px;text-align:center;opacity:.9}' +
    '.bnen-b{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-height:76px;padding:12px 14px;border:2px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.1);color:#f4ead2;text-align:left;font-size:13px;cursor:pointer}.bnen-b b{font-size:20px;color:#ffd25a}.bnen-b small{font-size:12px;line-height:1.4;opacity:.85}' +
    '#bnBar .mf{display:none}#bnLayer.ph-map #bnBar .mf{display:inline-block;background:#c9892f;color:#1b1308;font-weight:bold;min-width:76px}#bnLayer.ph-map #bnBar .mf[disabled]{opacity:.4;background:rgba(255,255,255,.14);color:#f4ead2}' +
    '#bnLayer.ph-map .ne,#bnLayer.ph-entry .ne{display:none}' +
    '.bnm-hint{margin:0 0 6px;padding:6px 8px;border-radius:8px;background:rgba(201,137,47,.22);font-size:13px;line-height:1.5}' +
    '.bnm-dbtn{display:block;margin-top:6px;min-height:44px;padding:0 14px;border:none;border-radius:8px;background:rgba(255,255,255,.14);color:#f4ead2;font-size:15px}' +
    '.bnm-foot .bnm-b{display:block;width:100%;box-sizing:border-box;text-align:left;border:2px solid rgba(255,255,255,.18);color:#f4ead2;font-family:inherit;font-size:13px;line-height:1.6;cursor:pointer}.bnm-foot .bnm-b.sel{border-color:#ffd25a}' +
    '.bnm-ov{position:fixed;left:0;top:0;right:0;bottom:0;z-index:8;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(10,8,6,.72)}' +
    '.bnm-dlg{box-sizing:border-box;width:min(92vw,420px);max-height:86vh;overflow:auto;border-radius:14px;background:#2a2118;border:2px solid #c9892f;padding:14px 16px;font-size:14px;line-height:1.5}.bnm-dlg h3{margin:0 0 6px;font-size:17px}.bnm-dlg .bnm-dbtn{width:100%;margin-top:10px}' +
    '.bnm-head{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;margin:0 0 6px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.07)}.bnm-head b{color:#ffd25a}' +
    '.bnm-chs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:0 0 6px}.bnm-chs::-webkit-scrollbar{display:none}.bnm-chs button{flex:0 0 auto;min-height:40px;min-width:44px;padding:0 10px;border:none;border-radius:8px;background:rgba(255,255,255,.12);color:#f4ead2;font-size:14px}.bnm-chs button.on{background:#c9892f;color:#1b1308;font-weight:bold}.bnm-chs button.lock{opacity:.45}' +
    '.bnm-chn{font-size:14px;margin:0 0 4px}.bnm-chn small{opacity:.75;font-size:12px}.bnm-list{display:flex;flex-direction:column;gap:4px}' +
    '.bnm-row{display:grid;grid-template-columns:34px 1fr auto;grid-template-rows:auto auto;column-gap:6px;align-items:center;min-height:50px;padding:4px 8px;border-radius:8px;border:2px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#f4ead2;text-align:left;font-size:14px}' +
    '.bnm-row .n{grid-row:1/3;font-size:15px;font-weight:bold;color:#ffd25a}.bnm-row .t{font-size:14px}.bnm-row .t i,.bnm-det h3 i{font-style:normal;font-size:11px;padding:0 5px;border-radius:6px;background:#a84a3a}.bnm-row .s{color:#ffd25a;font-size:13px;letter-spacing:1px}.bnm-row .p{grid-column:2/4;font-size:12px;opacity:.9}' +
    '.bnm-row.sel{border-color:#ffd25a}.bnm-row.lock{opacity:.5}.bnm-row.clr{background:rgba(80,140,80,.2)}.bnm-row.boss .n{color:#ff9a8a}' +
    '.g{color:#8fd9a0}.m{color:#ffd25a}.o{color:#ffb070}.b{color:#ff8a7a}em.g,em.m,em.o,em.b{font-style:normal;font-weight:bold}' +
    '.bnm-det{margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.08)}.bnm-det h3{margin:0 0 4px;font-size:17px}.bnm-det p{margin:3px 0;font-size:14px;line-height:1.5}.bnm-det .sm,.bnm-foot .sm{font-size:12px;opacity:.85}' +
    '.bnm-foes{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}.bnm-foes span{padding:2px 8px;border-radius:8px;background:rgba(168,74,58,.3);font-size:13px}.bnm-foes small{opacity:.8;margin-right:4px}.bnm-foes u{text-decoration:none;opacity:.8;font-size:11px}' +
    '.bnm-foot{display:flex;flex-direction:column;gap:6px;margin-top:8px}.bnm-b{padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.07);font-size:13px;line-height:1.6}.bnm-b small{opacity:.8}.bnm-b .bnbtn{display:block;margin-top:4px;width:100%}.bnm-b .bnbtn[disabled]{opacity:.4}' +
    '.bnbox .rw{color:#ffd25a;font-size:14px}.bnbox .sm{font-size:12px;opacity:.8}' +
    '@media (orientation:landscape) and (min-width:700px){.bnm-cols{display:grid;grid-template-columns:minmax(300px,1fr) minmax(300px,1fr);column-gap:14px;align-items:start}.bnm-det{margin-top:0}.bnm-foot{flex-direction:row}.bnm-b{flex:1}}' +
    '#bnCut{position:absolute;left:0;top:0;right:0;bottom:0;z-index:5;pointer-events:none;display:none;overflow:hidden;background:rgba(0,0,0,.6)}#bnCut .bg{position:absolute;left:-5%;top:-5%;width:110%;height:110%;background-size:cover;background-position:center;mix-blend-mode:screen}' +
    '#bnCut .fig{position:absolute;bottom:6%;height:62%;max-width:70%;object-fit:contain;filter:drop-shadow(0 0 14px rgba(255,220,120,.8))}#bnCut .nm{position:absolute;left:0;right:0;top:14%;text-align:center;font-size:38px;font-weight:bold;letter-spacing:6px;color:#fff3c4;text-shadow:0 0 12px #000,0 0 6px #c9892f}' +
    '#bnCut .sk{position:absolute;left:0;right:0;bottom:12%;text-align:center;font-size:28px;font-weight:bold;color:#ffd25a;text-shadow:0 0 10px #000,2px 2px 0 #000}' +
    '#bnRes,#bnPause{position:absolute;left:0;top:0;right:0;bottom:0;z-index:6;display:none;align-items:center;justify-content:center;background:rgba(10,8,6,.72)}#bnRes.on,#bnPause.on{display:flex}' +
    '.bnbox{width:min(92vw,400px);max-height:90vh;overflow:auto;border-radius:14px;background:#2a2118;border:2px solid #c9892f;padding:14px 16px;text-align:center}.bnbox h2{margin:0 0 6px;font-size:30px;letter-spacing:4px}.bnbox p{margin:3px 0;font-size:14px;line-height:1.5}.bnbox .row{display:flex;gap:8px;margin-top:10px}.bnbox .row button{flex:1;min-height:48px;border:none;border-radius:10px;background:rgba(255,255,255,.16);color:#f4ead2;font-size:16px}.bnbox .row button.pri{background:#c9892f;color:#1b1308;font-weight:bold}' +
    '#bnFeed{position:absolute;left:calc(6px + env(safe-area-inset-left));z-index:4;display:none;max-width:min(70vw,520px);padding:2px 8px 3px;border-radius:8px;background:rgba(10,8,6,.55);color:#f0e6cf;font-size:11px;line-height:14px;pointer-events:auto}#bnLayer.ph-fight #bnFeed{display:block}#bnFeed.top{top:calc(2px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);max-width:38vw;line-height:12px}' +
    '#bnFeed .fl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#bnFeed .fl:last-child{color:#fff3c4}#bnFeed .fh{color:#c9b98f;font-size:10px}' +
    '.bnm-route{margin:0 0 6px;padding:4px 8px 6px;border-radius:8px;background:rgba(255,255,255,.06)}.bnm-route .rt{font-size:13px;margin-bottom:4px}.bnm-route .dots{color:#ffd25a;letter-spacing:2px;margin-left:6px}' +
    '.bnm-route .rp{display:flex;align-items:center}.bnm-route .ln{flex:1;height:3px;min-width:8px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 5px,transparent 5px 9px)}.bnm-route .ln.on{background:repeating-linear-gradient(90deg,#c9892f 0 5px,transparent 5px 9px)}' +
    '.bnm-route .nd{flex:0 0 auto;width:32px;height:32px;border-radius:50%;border:2px solid rgba(255,255,255,.4);background:rgba(255,255,255,.1);color:#f4ead2;font-size:13px;padding:0}.bnm-route .nd.clr{background:#c9892f;color:#1b1308;border-color:#ffd25a}.bnm-route .nd.lock{opacity:.4}.bnm-route .nd.sel{box-shadow:0 0 0 3px #ffd25a,0 0 10px #ffd25a;transform:scale(1.12)}' +
    '.bnf-egrid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin:4px 0 6px;padding:4px;border-radius:8px;background:rgba(168,74,58,.18)}.bnf-egrid .bnf-gh{font-size:11px;opacity:.8;text-align:center}' +
    '.bnf-cell.foe{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:44px;padding:2px;border-radius:6px;background:rgba(168,74,58,.3);font-size:12px;line-height:1.2;text-align:center}.bnf-cell.foe.empty{background:rgba(255,255,255,.04)}.bnf-cell.foe .av{display:inline-block;width:20px;height:20px;border-radius:50%;background:#7a3a2a;color:#fff;font-size:12px;line-height:20px}.bnf-cell.foe small{font-size:10px;opacity:.85}' +
    '.bnbox.bninfo{text-align:left}.bninfo h2{font-size:22px;letter-spacing:1px;text-align:center}.bninfo .sk{margin:6px 0;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.07);font-size:13px;line-height:1.5}.bninfo .sk b{color:#ffd25a}.bninfo .sk small{opacity:.8}.bninfo .st{font-size:13px}' +
'.bnf-top{position:sticky;top:-8px;z-index:3;background:#14110c;padding:8px 0 4px;margin:-8px 0 4px}.bnf-sumline{font-size:12px;text-align:center;margin:0 0 3px;opacity:.9}.bnf-sumline b{color:#ffd25a}.bnf-hint{font-size:11px;text-align:center;opacity:.7;margin-top:3px}' +
'.bnf-cell{touch-action:none;min-height:58px;color:#f4ead2}.bnf-cell.em{border-color:rgba(255,210,90,.35);opacity:.85}#bnLayer.dragging .bnf-cell.em{border-color:#ffd25a;background:rgba(255,210,90,.16);opacity:1}.bnf-cell.over{box-shadow:0 0 0 3px #ffd25a inset}#bnLayer.dragging .bnf-cell.occ{opacity:.75}' +
'.bnf-trash{position:absolute;top:34%;height:30%;width:48px;z-index:5;display:none;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;background:rgba(150,60,50,.55);color:#fff;border:2px dashed #ffb4a6;font-size:22px;line-height:1.1}.bnf-trash small{font-size:11px;margin-top:2px}' +
'.bnf-trash.l{left:0;border-radius:0 12px 12px 0}.bnf-trash.r{right:0;border-radius:12px 0 0 12px}#bnLayer.dragging .bnf-trash{display:flex}.bnf-trash.over{background:rgba(230,70,50,.95);border-style:solid}' +
'.bnf-ghost{position:fixed;z-index:9;pointer-events:none;width:80px;box-sizing:border-box;padding:3px;border-radius:8px;background:rgba(40,30,20,.94);border:2px solid #ffd25a;font-size:11px;line-height:1.2;text-align:center;transform:translate(-50%,-100%);color:#f4ead2}' +
'.bnf-gth{display:block;position:relative;height:40px;border-radius:5px;overflow:hidden;background:rgba(0,0,0,.35)}.bnf-ghost b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bnf-gth img,.bnf-cell img{pointer-events:none;-webkit-user-drag:none}' +
'.bnPop{position:absolute;left:0;top:0;right:0;bottom:0;z-index:6;display:none;align-items:center;justify-content:center;background:rgba(10,8,6,.66)}.bnPop.on{display:flex}.bnpop{box-sizing:border-box;width:min(92vw,400px);max-height:88vh;overflow:auto;-webkit-overflow-scrolling:touch}.bnpop .bnf-chips{justify-content:center}.bnpop .sk{margin:6px 0}' +
'.bnpop-eq{display:flex;flex-direction:column;gap:4px;margin:6px 0}.bnpop-eq>b{font-size:13px}.bnpop-eq>button{min-height:44px;border:none;border-radius:8px;background:rgba(255,255,255,.14);color:#f4ead2;font-size:14px;padding:0 8px;text-align:left}.bnpop-eq>button.on{background:#c9892f;color:#1b1308}' +
'.bnpop-cand{display:flex;flex-wrap:wrap;gap:4px}.bnpop-cand button{flex:1 1 44%;min-height:44px;border:none;border-radius:8px;background:rgba(58,110,168,.35);color:#f4ead2;font-size:13px}' +
'@media (orientation:landscape) and (min-width:700px){.bnf-top{grid-column:1/3}}' +

    'html body.in-bn #toast{z-index:80}';
  document.head.appendChild(st);
}
function bnUiMk(tag, id, cls) {
  var el = document.createElement(tag);
  if (id) el.id = id;
  if (cls) el.className = cls;
  return el;
}
function bnUiBtn(txt, label, fn, cls) {
  var b = bnUiMk('button', '', cls || '');
  b.textContent = txt;
  b.setAttribute('aria-label', label);
  b.title = label;
  b.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); fn(); });
  return b;
}
function bnUiBuildLayer() {
  var layer = bnUiMk('div', 'bnLayer', 'ph-form'), top = bnUiMk('div', 'bnTop'), bar = bnUiMk('div', 'bnBar'), cv = bnUiMk('canvas', 'bnCv');
  bnUiCss();
  bnu.backBtn = bnUiBtn('↩', '返回', function () { bnUiBack(); }, 'bk');
  bnu.titleEl = bnUiMk('b'); bnu.subEl = bnUiMk('span');
  bnu.roundEl = bnUiMk('span', 'bnRound', 'fo');
  bar.appendChild(bnu.backBtn); bar.appendChild(bnu.titleEl); bar.appendChild(bnu.roundEl);
  bnu.btns.spd = bnUiBtn('1×', '倍速', function () { bnUiSetSpeed(); }, 'fo ib');
  // 頂列只留左上返回(戰鬥中 = 暫停選單,內含撤退);不放右上關閉 / 略過鈕。戰報鈕只在非戰鬥階段顯示
  bnu.btns.log = bnUiBtn('戰報', '戰報', function () { bnUiDo('log'); }, 'nf ne');
  ['spd', 'log'].forEach(function (k) { bar.appendChild(bnu.btns[k]); });
  if (typeof bnsBarBtn === 'function') bar.appendChild(bnsBarBtn());   // 對戰練習(js/bnshare.js;非戰鬥階段顯示)
  bnu.btns.mfight = bnUiBtn('出戰', '出戰', function () { bnUiDo('mfight'); }, 'mf');   // 副本的出戰鈕(右上;依目前選取的關卡 / 流寇,沒選時灰掉)
  bar.appendChild(bnu.btns.mfight);
  bnu.stripEls = [];   // 行動順序條已移除(出手太快看不到;先後順序改看文字戰報)
  top.appendChild(bar);
  bnu.formEl = bnUiMk('div', 'bnForm');
  bnu.formEl.addEventListener('click', bnUiFormClick);
  bnu.cutEl = bnUiMk('div', 'bnCut');
  bnu.cutParts = { bg: bnUiMk('div', '', 'bg'), fig: bnUiMk('img', '', 'fig'), nm: bnUiMk('div', '', 'nm'), sk: bnUiMk('div', '', 'sk') };
  bnu.cutParts.fig.setAttribute('alt', '');
  bnu.cutParts.fig.addEventListener('error', function () { var f = bnu.cutParts.fig, a = f.getAttribute('data-alt'); if (a) { f.removeAttribute('data-alt'); f.setAttribute('src', a); } else if (f.style) f.style.display = 'none'; });
  ['bg', 'fig', 'nm', 'sk'].forEach(function (k) { bnu.cutEl.appendChild(bnu.cutParts[k]); });
  bnu.mapEl = bnUiMk('div', 'bnMap'); bnu.mapEl.addEventListener('click', bnUiFormClick);
  bnu.entEl = bnUiMk('div', 'bnEntry'); bnu.entEl.addEventListener('click', bnUiFormClick);
  bnu.resEl = bnUiMk('div', 'bnRes'); bnu.resEl.addEventListener('click', bnUiFormClick);
  bnu.pauseEl = bnUiMk('div', 'bnPause'); bnu.pauseEl.addEventListener('click', bnUiFormClick);
  bnu.feedEl = bnUiMk('div', 'bnFeed'); bnu.feedEl.addEventListener('click', function () { bnu.feedOff = !bnu.feedOff; bnUiFeedRender(); bnUiResize(); });   // 戰況播報(點一下收合 / 展開)
  layer.appendChild(cv); layer.appendChild(bnu.formEl); layer.appendChild(bnu.mapEl); layer.appendChild(bnu.entEl); layer.appendChild(top); layer.appendChild(bnu.feedEl); layer.appendChild(bnu.cutEl); layer.appendChild(bnu.resEl); layer.appendChild(bnu.pauseEl);
  bnu.formEl.addEventListener('pointerdown', bnUiDragDown);
  ['l', 'r'].forEach(function (k) { var tz = bnUiMk('div', '', 'bnf-trash ' + k); tz.setAttribute('data-drop', 'trash'); tz.innerHTML = '<span>🗑</span><small>下陣</small>'; layer.appendChild(tz); });
  cv.addEventListener('pointerup', bnUiCvTap);
  cv.addEventListener('pointerup', bnUiCutTap);   // 點畫面跳過大招 cut-in(#bnCut 不吃點擊,點擊落在畫布)
  document.body.appendChild(layer);
  bnu.popEl = null; bnu.pop = null; bnu.popSlot = -1; bnu.drag = null; bnu.layer = layer; bnu.cv = cv; bnu.ctx = cv.getContext('2d'); bnu.top = top; bnu.bar = bar; bnu.strip = null;
}
function bnUiSetPhase(ph) {
  var cl = bnu.layer && bnu.layer.classList;
  bnu.phase = ph;
  if (cl) { cl.remove('ph-form'); cl.remove('ph-map'); cl.remove('ph-entry'); cl.remove('ph-fight'); cl.remove('ph-res'); cl.add('ph-' + ph); }
  if (bnu.titleEl) bnu.titleEl.textContent = ph === 'entry' ? '戰鬥' : (ph === 'map' ? '副本' : (ph === 'form' ? '戰前布陣 · ' + bnUiStageLabel() : (ph === 'fight' ? bnUiStageLabel() : '戰果')));
  if (bnu.subEl) bnu.subEl.textContent = '';
}

// ───────── 布陣畫面 ─────────
var BNUI_GR = ['白', '青', '藍', '紫', '金'];
function bnUiAptTxt(e, tr) { var a = bnAptOf(e).apt[tr] || 'C'; return a; }
// 戰前準備:敵方陣容對照(依站位;只顯示頭像字、名稱、兵種、兵力 / 戰力,不顯示戰法 — 戰法開打後才看得到)
// 兵種克制徽章:▲ = 克制幾名(綠)、▼ = 被幾名克制(紅);0 不顯示
function bnUiTI(t) { return (typeof bnTroopIconHtml === 'function') ? bnTroopIconHtml(t) : ''; }   // 兵種小圖示(assets/troopicon/;載入失敗自動隱藏)
function bnUiPreyChips(c) { return (c.up ? '<em class="py u">▲' + c.up + '</em>' : '') + (c.down ? '<em class="py d">▼' + c.down + '</em>' : ''); }
// 敵方格從『我方』角度看:▲ = 我方克制它的人數(對我有利)、▼ = 它克制我方的人數;bnPreyCounts 是從該兵種自己的角度算,這裡對調
function bnUiPreySwap(c) { return { up: c.down, down: c.up }; }
function bnUiTroopsOf(list) { return (list || []).map(function (x) { return x.troop; }); }
function bnUiFoeGridHtml(foes, mine) {
  var h = '<div class="bnf-egrid"><div class="bnf-gh">敵 ◀ 前排</div><div class="bnf-gh">中排</div><div class="bnf-gh">後排</div>', r, c, x, i;
  for (c = 0; c < 3; c++) for (r = 0; r < 3; r++) {
    x = null;
    for (i = 0; i < foes.specs.length; i++) if (foes.specs[i].row === r && (foes.specs[i].col | 0) === c) x = foes.specs[i];
    h += x ? '<div class="bnf-cell foe"><span class="av">' + bnUiEsc(Array.from(String(x.name))[0] || '?') + '</span><b>' + bnUiEsc(x.name) + '</b><small>' + bnUiTI(x.troop) + bnUiEsc(x.troop) + bnUiPreyChips(typeof bnPreyCounts === 'function' ? bnUiPreySwap(bnPreyCounts(x.troop, bnUiTroopsOf(mine))) : { up: 0, down: 0 }) + ' · 兵力 ' + x.stats.hp + ' · 戰力 ' + bnPower(x) + '</small></div>' : '<div class="bnf-cell foe empty"></div>';
  }
  return h + '</div>';
}
// 兵種相剋說明(點開;文字 + 小表格)
function bnUiPreyHelpHtml() {
  if (typeof bnPreyText !== 'function') return '';
  return '<details class="bnf-prey"><summary>兵種相剋 <em class="py u">▲</em>克制 <em class="py d">▼</em>被克(點開說明)</summary><div class="pt">' + bnUiEsc(bnPreyText()) + '。<br>' + bnUiEsc(bnPreyRule()) + '。<br>下方格子的 ▲n = 這名武將克制 n 名敵人、▼n = 被 n 名敵人克制;敵方格的 ▲n = 我方有 n 人克制它、▼n = 它克制我方 n 人。戰鬥中傷害數字旁的「克制↑ / 被克↓」= 這一擊因兵種克制變強 / 變弱。</div><table>' +
    bnPreyRows().map(function (r) { return '<tr><th>' + bnUiEsc(r.t) + '</th><td class="u">克 ' + (bnUiEsc(r.beats.join('、')) || '—') + '</td><td class="d">被克 ' + (bnUiEsc(r.beaten.join('、')) || '—') + '</td></tr>'; }).join('') + '</table></details>';
}
function bnUiRenderForm() {
  var el = bnu.formEl, h = '', top = '', roster = bnUiRosterList(), build = bnUiBuild(), bonds = bnUiBonds(), foes, mineP = 0, rows = [2, 1, 0], r, c, s, e, tr, list, i, sel = bnu.sel, selE = sel ? bnUiEntry(sel) : null, sc, msg = bnUiCheck(), keepT = 0;
  if (!el) return;
  keepT = el.scrollTop || 0;
  foes = bnUiCurFoes(build.team.units);
  build.team.units.forEach(function (x) { mineP += bnPower(x); });
  // 上方黏頂:3×3 九宮格(拖曳上陣 / 移位 / 下陣的目標);下方是名冊選取區
  top = '<div class="bnf-top"><div class="bnf-sumline">上陣 <b>' + bnu.slots.length + '/' + BNUI.maxUnits + '</b> 人 · 戰力 <b>' + mineP + '</b></div>' +
    '<div class="bnf-grid"><div class="bnf-gh">後排</div><div class="bnf-gh">中排</div><div class="bnf-gh">前排 ▶ 敵</div>';
  for (c = 0; c < 3; c++) {
    for (i = 0; i < 3; i++) {
      r = rows[i]; s = bnUiSlotAt(r, c); e = s ? bnUiEntry(s.id) : null;
      if (e) {
        tr = s.troop || bnUiTroopOf(e);
        top += '<button class="bnf-cell occ' + (sel === e.id ? ' sel' : '') + '" data-a="cell" data-drag="s" data-drop="cell" data-id="' + bnUiEsc(e.id) + '" data-r="' + r + '" data-c="' + c + '"><b>' + bnUiEsc(e.name) + '</b><small>' + bnUiTI(tr) + tr + ' ' + bnUiAptTxt(e, tr) + (typeof bnPreyCounts === 'function' ? bnUiPreyChips(bnPreyCounts(tr, bnUiTroopsOf(foes.specs))) : '') + '</small></button>';
      } else top += '<button class="bnf-cell em" data-a="cell" data-drop="cell" data-r="' + r + '" data-c="' + c + '" aria-label="空格,可放入人物"><small>＋ 放這裡</small></button>';
    }
  }
  top += '</div><div class="bnf-hint">拖卡包人物進空格上陣 · 拖格內人物可移位 / 交換 · 拖到兩側 🗑 下陣 · 點人物看詳情</div></div>';
  h = top + '<div class="c1"><div class="bnf-foe">' + (foes.kind === 'practice' ? '敵將:山賊(練兵)' : '敵將:' + bnUiEsc(foes.label)) + ' · 建議戰力 <b>' + foes.power + '</b> · 我方 <b>' + mineP + '</b><br>' +
    foes.specs.map(function (x) { return '<i>' + (x.title ? bnUiEsc(x.title) + ' ' : '') + bnUiEsc(x.name) + ' ' + bnUiTI(x.troop) + bnUiEsc(x.troop) + '</i>'; }).join('') + '</div>';
  h += '<div class="bnf-bonds">羈絆:' + (bonds.on.length ? bonds.on.map(function (x) { return '<i>' + bnUiEsc(x) + '</i>'; }).join('') : '<u>尚未成立</u>') + bonds.hint.map(function (x) { return '<u>' + bnUiEsc(x) + '</u>'; }).join('') + '</div>';
  h += bnUiPreyHelpHtml();
  h += bnUiFoeGridHtml(foes, build.team.units) + '</div><div class="c2">';
  if (selE) {
    tr = bnUiTroopOf(selE); sc = bnUiSpec(selE, { troop: tr });
    h += '<div class="bnf-sel"><b>' + bnUiEsc(selE.name) + '</b>(' + BNUI_GR[selE.gr] + '階)戰力 ' + bnPower(sc) + ' · 建議站 ' + ['前', '中', '後'][bnRowOf(selE, tr)] + '排<br>' +
      '戰法:' + (typeof bnTeamSkillLinksHtml === 'function' ? bnTeamSkillLinksHtml(selE, tr) : sc.skills.concat(sc.ult ? [sc.ult] : []).map(function (id) { return BN_SKILLS[id] ? bnUiEsc(BN_SKILLS[id].name) : ''; }).filter(Boolean).join('、')) + '<div class="bnf-chips">' +
      BN_DATA.troopList.map(function (t) { var a = bnUiAptTxt(selE, t); return '<button class="' + (t === tr ? 'on' : '') + (a === 'C' ? ' bad' : '') + '" data-a="troop" data-id="' + bnUiEsc(selE.id) + '" data-t="' + t + '">' + bnUiTI(t) + t + ' ' + a + '</button>'; }).join('') +
      (bnUiSlotOf(selE.id) ? '<button data-a="remove" data-id="' + bnUiEsc(selE.id) + '">撤下</button>' : '') + '</div></div>';
  } else h += '<div class="bnf-sel">拖卡包人物到上方空格上陣(最多 ' + BNUI.maxUnits + ' 人);也可先點卡包人物,再點空格。點上陣人物看詳情與裝備。</div>';
  h += '<div class="bnf-chips">' + [['', '全部']].concat(BN_DATA.troopList.map(function (t) { return [t, bnUiTI(t) + t]; })).map(function (f) { return '<button class="' + (bnu.filter === f[0] ? 'on' : '') + '" data-a="filter" data-t="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
  if (typeof bnTeamRosterHtml === 'function') h += bnTeamRosterHtml();   // 名冊:搜尋 / 排序 / 陣營 / 品階 / 分頁 / 可拖曳縮圖(js/bnteam.js)
  else {
    list = roster.map(function (x) { var t = bnUiTroopOf(x); return { e: x, t: t, pw: bnPower(bnUiSpec(x, { troop: t })) }; }).filter(function (x) { return !bnu.filter || x.t === bnu.filter; });
    list.sort(function (a, b) { return b.pw - a.pw; });
    h += '<div class="bnf-roster">' + list.map(function (x) {
      return '<button class="bnf-card g' + x.e.gr + (sel === x.e.id ? ' sel' : '') + (bnUiSlotOf(x.e.id) ? ' on' : '') + '" data-a="card" data-id="' + bnUiEsc(x.e.id) + '"><b>' + bnUiEsc(x.e.name) + '</b><br>' + x.t + ' ' + bnUiAptTxt(x.e, x.t) + ' · ' + x.pw + '</button>';
    }).join('') + '</div>';
  }
  if (typeof bnTeamPresetHtml === 'function') h += bnTeamPresetHtml();   // 隊伍預設 3 組(具名;js/bnteam.js)
  else h += '<div class="bnf-chips">預設:' + [0, 1, 2].map(function (k) { var f = bnu.data && bnu.data.forms[k]; return '<button data-a="loadP" data-i="' + k + '"' + (f && f.slots.length ? ' class="on"' : '') + '>載入' + (k + 1) + '</button>'; }).join('') +
    [0, 1, 2].map(function (k) { return '<button data-a="saveP" data-i="' + k + '">存為' + (k + 1) + '</button>'; }).join('') + '</div>';
  h += (msg ? '<div class="bnf-msg">' + msg + '</div>' : '') + '<div class="bnf-foot"><button class="bnbtn" data-a="auto">一鍵布陣</button><button class="bnbtn" data-a="clear">清空</button><button class="bnf-go" data-a="go"' + (msg ? ' disabled' : '') + '>出戰</button></div></div>';
  el.innerHTML = h;
  el.scrollTop = keepT;
  bnu.hudRound = '';
  if (bnu.pop) bnUiPopRender();
}
function bnUiFormClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-a]') : null, a, id;
  if (!b) return;
  if (bnu.dragAt && Date.now() - bnu.dragAt < 150) return;   // 拖曳放下後瀏覽器補發的 click 不再觸發動作
  a = b.getAttribute('data-a'); id = b.getAttribute('data-id');
  bnUiDo(a, id, +b.getAttribute('data-r'), +b.getAttribute('data-c'), b.getAttribute('data-t'), +b.getAttribute('data-i'));
}

// ───────── 布陣拖曳:名冊 → 九宮格上陣;格內 → 移位 / 交換;拖到左右兩側 🗑 = 下陣(回名冊,人物不遺失)─────────
// 滑鼠移動 8px 即開始;觸控:格內人物同樣 8px 開始,名冊縮圖在可捲動列表內需長按 250ms(移動超過 8px 則視為捲動)
var BNUI_DRAG = { slop: 8, lp: 250 };
function bnUiDragDown(ev) {
  var t = ev && ev.target, el = t && t.closest ? t.closest('[data-drag]') : null, d, pt;
  if (!el || bnu.phase !== 'form' || bnu.drag || (ev.button !== undefined && ev.button > 0)) return;
  pt = ev.pointerType || 'mouse';
  d = { type: el.getAttribute('data-drag'), id: el.getAttribute('data-id') || '', r: +el.getAttribute('data-r'), c: +el.getAttribute('data-c'), x0: ev.clientX || 0, y0: ev.clientY || 0, x: ev.clientX || 0, y: ev.clientY || 0, on: false, lp: false, over: null, ghost: null, timer: 0 };
  d.lp = d.type === 'r' && pt !== 'mouse';
  bnu.drag = d;
  if (d.lp) d.timer = setTimeout(function () { if (bnu.drag === d && !d.on) bnUiDragStart(d); }, BNUI_DRAG.lp);
  window.addEventListener('pointermove', bnUiDragMove);
  window.addEventListener('pointerup', bnUiDragUp);
  window.addEventListener('pointercancel', bnUiDragCancel);
}
function bnUiDragStart(d) {
  var e = bnUiEntry(d.id), tr, g;
  if (d.timer) { clearTimeout(d.timer); d.timer = 0; }
  if (!e || !bnu.layer) { bnUiDragCancel(); return; }
  tr = bnUiTroopOf(e);
  d.on = true;
  if (bnu.layer.classList) bnu.layer.classList.add('dragging');
  g = bnUiMk('div', '', 'bnf-ghost');
  g.innerHTML = '<span class="bnf-gth">' + (typeof bnTeamPortrait === 'function' ? bnTeamPortrait(e) : '') + '</span><b>' + bnUiEsc(e.name) + '</b><small>' + bnUiTI(tr) + bnUiEsc(tr) + '</small>';
  bnu.layer.appendChild(g); d.ghost = g;
  document.addEventListener('touchmove', bnUiDragTouch, { passive: false });
  bnUiDragPlace(d, d.x, d.y);
}
function bnUiDragTouch(ev) { if (bnu.drag && bnu.drag.on && ev && ev.cancelable) ev.preventDefault(); }
function bnUiDropEl(x, y) {
  var el = (typeof document !== 'undefined' && document.elementFromPoint) ? document.elementFromPoint(x, y) : null;
  return el && el.closest ? el.closest('[data-drop]') : null;
}
function bnUiDragPlace(d, x, y) {
  var tgt;
  if (d.ghost) { d.ghost.style.left = x + 'px'; d.ghost.style.top = (y - 46) + 'px'; }
  tgt = bnUiDropEl(x, y);
  if (tgt === d.over) return;
  if (d.over && d.over.classList) d.over.classList.remove('over');
  d.over = tgt;
  if (tgt && tgt.classList) tgt.classList.add('over');
}
function bnUiDragMove(ev) {
  var d = bnu.drag, dx, dy, dist;
  if (!d) return;
  d.x = ev.clientX || 0; d.y = ev.clientY || 0;
  dx = d.x - d.x0; dy = d.y - d.y0; dist = Math.sqrt(dx * dx + dy * dy);
  if (!d.on) {
    if (d.lp) { if (dist > BNUI_DRAG.slop) bnUiDragCancel(); return; }   // 長按前就移動 = 捲動,放棄拖曳
    if (dist < BNUI_DRAG.slop) return;
    bnUiDragStart(d);
    if (!d.on) return;
  }
  bnUiDragPlace(d, d.x, d.y);
}
function bnUiDragUp(ev) {
  var d = bnu.drag, tgt, kind, r, c;
  if (!d) return;
  if (!d.on) { bnUiDragCancel(); return; }   // 只是點一下:交給 click
  tgt = bnUiDropEl(ev.clientX || d.x, ev.clientY || d.y);
  bnUiDragCancel();
  bnu.dragAt = Date.now();
  kind = tgt ? tgt.getAttribute('data-drop') : '';
  if (kind === 'cell') {
    r = +tgt.getAttribute('data-r'); c = +tgt.getAttribute('data-c');
    if (!(d.type === 's' && d.r === r && d.c === c)) bnUiAct('place', d.id, r, c);   // 名冊 → 空格 = 上陣;有人的格 = 取代(被換下者回名冊);格內 → 移位 / 交換
  } else if (kind === 'trash' || kind === 'roster') {
    if (d.type === 's') bnUiAct('remove', d.id);   // 下陣:回名冊,人物與裝備保留
  }
}
function bnUiDragCancel() {
  var d = bnu.drag;
  bnu.drag = null;
  window.removeEventListener('pointermove', bnUiDragMove);
  window.removeEventListener('pointerup', bnUiDragUp);
  window.removeEventListener('pointercancel', bnUiDragCancel);
  document.removeEventListener('touchmove', bnUiDragTouch);
  if (bnu.layer && bnu.layer.classList) bnu.layer.classList.remove('dragging');
  if (!d) return;
  if (d.timer) clearTimeout(d.timer);
  if (d.over && d.over.classList) d.over.classList.remove('over');
  if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
}

// ───────── 人物詳情(點九宮格上陣人物開啟):兵種 / 戰法 / 裝備槽(規則沿用 bn_skcard.js)─────────
function bnUiPopOpen(id) {
  if (!bnUiEntry(id) || !bnu.layer) return false;
  if (!bnu.popEl) { bnu.popEl = bnUiMk('div', '', 'bnPop'); bnu.popEl.addEventListener('click', bnUiFormClick); bnu.layer.appendChild(bnu.popEl); }
  bnu.pop = id; bnu.popSlot = -1;
  bnUiPopRender();
  return true;
}
function bnUiPopClose() {
  bnu.pop = null; bnu.popSlot = -1;
  if (bnu.popEl) { bnu.popEl.classList.remove('on'); bnu.popEl.innerHTML = ''; }
  return true;
}
function bnPopIsOpen() { return !!bnu.pop; }
function bnPopBack() { if (!bnu.pop) return false; bnUiPopClose(); return true; }
function bnUiPopRender() {
  var e, s, tr, sp, apt, cs, pos, fac, h, id;
  if (!bnu.popEl) return;
  e = bnu.pop ? bnUiEntry(bnu.pop) : null;
  if (!e) { bnUiPopClose(); return; }
  id = bnUiEsc(e.id);
  s = bnUiSlotOf(e.id);
  tr = (s && s.troop) || bnUiTroopOf(e);
  sp = bnUiSpec(e, { troop: tr }); apt = bnAptOf(e).apt[tr] || 'C';
  cs = (typeof cardsGet === 'function') ? cardsGet() : null;
  pos = s ? ['前', '中', '後'][s.row] + '排 ' + (s.col + 1) + ' 號' : '未上陣';
  fac = (typeof CARD_FAC !== 'undefined' && CARD_FAC[e.fac]) || '';
  h = '<div class="bnbox bninfo bnpop"><h2>' + bnUiEsc(e.name) + '</h2>' +
    '<p style="text-align:center">' + BNUI_GR[e.gr] + '階 · ' + bnUiEsc(fac) + ' · ' + (e.fig ? '名人' : '路人') + ' · 戰力 <b>' + bnPower(sp) + '</b> · ' + pos + '</p>' +
    '<div class="bnf-chips">' + BN_DATA.troopList.map(function (t) { var a = bnAptOf(e).apt[t] || 'C'; return '<button class="' + (t === tr ? 'on' : '') + (a === 'C' ? ' bad' : '') + '" data-a="troop" data-id="' + id + '" data-t="' + t + '">' + bnUiTI(t) + t + ' ' + a + '</button>'; }).join('') + '</div>' +
    '<div class="sk"><b>戰法</b> <small>點名稱看說明</small><br>' + (typeof bnTeamSkillLinksHtml === 'function' ? bnTeamSkillLinksHtml(e, tr) : '') + '</div>';
  if (typeof bnSkcSlots === 'function' && typeof bnSkcLoad === 'function') h += bnUiPopEquipHtml(e, cs);
  h += '<div class="row">' + (s ? '<button data-a="remove" data-id="' + id + '">下陣</button>' : '') + '<button class="pri" data-a="pclose">關閉</button></div></div>';
  bnu.popEl.innerHTML = h;
  bnu.popEl.classList.add('on');
}
function bnUiPopEquipHtml(e, cs) {
  var n = bnSkcSlots(e), d = bnSkcLoad(), eq = d.eq[e.id] || [], h = '<div class="bnpop-eq"><b>裝備槽(戰法傳承)</b>', i, cur, cand, id = bnUiEsc(e.id);
  if (!n) return '<div class="bnpop-eq"><u>此品階沒有裝備槽</u></div>';
  for (i = 0; i < n; i++) {
    cur = eq[i] || null;
    h += '<button class="' + (bnu.popSlot === i ? 'on' : '') + '" data-a="pslot" data-id="' + id + '" data-i="' + i + '">' + (i + 1) + ' 號:' + (cur && bnSkcSkill(cur) ? bnUiEsc(bnSkcSkill(cur).name) : '空槽') + '</button>';
  }
  if (bnu.popSlot >= 0 && bnu.popSlot < n) {
    cand = Object.keys(d.own).filter(function (k) { return bnSkcSkill(k) && bnSkcCanEquip(cs, e, bnu.popSlot, k).ok; });
    h += '<div class="bnpop-cand">' + (cand.length ? cand.map(function (k) { return '<button data-a="peq" data-id="' + id + '" data-t="' + bnUiEsc(k) + '" data-i="' + bnu.popSlot + '">' + bnUiEsc(bnSkcSkill(k).name) + '</button>'; }).join('') : '<u>沒有可裝備的戰法</u>') + '</div>';
    if (eq[bnu.popSlot]) h += '<button data-a="puneq" data-id="' + id + '" data-i="' + bnu.popSlot + '">卸下此槽</button>';
  }
  return h + '</div>';
}
function bnUiPopEquip(id, slot, sk) {
  var e = bnUiEntry(id), r;
  if (!e || typeof bnSkcEquip !== 'function') return false;
  r = bnSkcEquip((typeof cardsGet === 'function') ? cardsGet() : null, e, slot, sk);
  if (r.ok) bnu.popSlot = -1;
  else bnUiToast(r.msg || '無法裝備(' + r.reason + ')');
  bnUiRenderForm();
  return r.ok;
}

// 表單 / 對話框的統一動作入口(測試也直接呼叫)
function bnUiDo(a, id, r, c, t, i) {
  var s, o;
  if (typeof bnTeamDo === 'function' && bnTeamDo(a, id, r, c, t, i)) return;
  if (typeof bnMapDo === 'function' && bnMapDo(a, id, r, c, t, i)) return;
  if (a === 'card') { bnu.sel = (bnu.sel === id) ? null : id; bnUiRenderForm(); }
  else if (a === 'cell') {
    s = bnUiSlotAt(r, c);
    if (bnu.sel) {
      o = bnUiSlotOf(bnu.sel);
      if (o && s && s === o) { bnu.sel = null; bnUiRenderForm(); }
      else bnUiAct('place', bnu.sel, r, c);
    } else if (s) bnUiPopOpen(s.id);   // 點上陣人物 = 詳細介紹
    else bnUiToast('先點卡包人物再點空格,或直接拖曳上陣');
  }
  else if (a === 'troop') bnUiAct('troop', id, t);
  else if (a === 'remove') bnUiAct('remove', id);
  else if (a === 'filter') { bnu.filter = t || ''; bnUiRenderForm(); }
  else if (a === 'auto' || a === 'clear') bnUiAct(a);
  else if (a === 'saveP' || a === 'loadP') bnUiAct(a, i);
  else if (a === 'go') bnUiStart();
  else if (a === 'ent') bnUiEntryDo(t);
  else if (a === 'pop') bnUiPopOpen(id);
  else if (a === 'pclose') bnUiPopClose();
  else if (a === 'pslot') { bnu.popSlot = (bnu.popSlot === i) ? -1 : i; bnUiPopRender(); }
  else if (a === 'peq') bnUiPopEquip(id, i, t);
  else if (a === 'puneq') { if (typeof bnSkcUnequip === 'function') bnSkcUnequip(id, i); bnu.popSlot = -1; bnUiRenderForm(); }
  else if (a === 'again') { bnUiToForm(); }
  else if (a === 'leave') bnUiLeave();
  else if (a === 'resume') bnUiPause(false);
  else if (a === 'sbar') { o = bnUiPref(); o.sb = o.sb === false; bnUiPrefSave(); if (bnu.P) bnu.P.sb = o.sb; if (bnu.paused && !bnu.info) bnUiPause(true); bnUiDrawOnce(); }   // 戰鬥設定:顯示戰法條
  else if (a === 'retreat') bnUiRetreat();
  else if (a === 'log' && typeof bnLogOpen === 'function') bnLogOpen('recent');
  else if (a === 'logview' && typeof bnLogOpen === 'function') bnLogOpen('recent', bnu.logId || '');
  else if (a === 'logsave' && typeof bnLogSave === 'function') { o = bnu.logId ? bnLogSave(bnu.logId) : { ok: false, why: '這場沒有戰報' }; bnUiToast(o.ok ? '已儲存戰報' : o.why); }
}

// ───────── 戰鬥 ─────────
function bnUiHooks() {
  return {   // 不接 order 鉤子:不預告下一位行動者
    round: function (n) { if (bnu.roundEl) bnu.roundEl.textContent = '第 ' + n + '/' + BN_DATA.maxRound + ' 回合'; },
    cut: function (c) { bnUiCutRender(c); },
    feed: function (s) { bnUiFeed(s); },
    end: function (res) { bnUiShowResult(); }
  };
}
// 戰況播報:最近 BNUI_FEED.n 行;預設展開,點一下收合(只剩標題列)。位置 = 底部工具列正上方,bnUiResize 已把這塊高度從戰場扣掉,不蓋人物 / 血條
var BNUI_FEED = { n: 3, lineH: 14, pad: 5 };
function bnUiFeed(s) {
  if (!bnu.feed) bnu.feed = [];
  if (s === null) bnu.feed = []; else bnu.feed.push(String(s));
  if (bnu.feed.length > BNUI_FEED.n) bnu.feed = bnu.feed.slice(-BNUI_FEED.n);
  bnUiFeedRender();
}
function bnUiFeedH() { return bnu.feedOff ? BNUI_FEED.lineH + BNUI_FEED.pad : BNUI_FEED.lineH * (BNUI_FEED.n + 1) + BNUI_FEED.pad; }
function bnUiFeedRender() {
  var el = bnu.feedEl, h, i, L = bnu.feed || [];
  if (!el) return;
  h = (bnu.feedTop && !bnu.feedOff) ? '' : '<div class="fh">戰況播報 ' + (bnu.feedOff ? '▸ 點開' : '▾ 點收合') + '</div>';   // 橫式展開時省掉標題列(上緣空間小)
  if (!bnu.feedOff) for (i = 0; i < BNUI_FEED.n; i++) h += '<div class="fl">' + (L[i] ? bnUiEsc(L[i]) : '&nbsp;') + '</div>';
  el.innerHTML = h;
  if (el.classList) el.classList.toggle('top', !!bnu.feedTop);
  if (el.style) el.style.bottom = bnu.feedTop ? 'auto' : (((bnu.top && bnu.top.offsetHeight) || BNUI.barH) + 2) + 'px';
}
// 單位資訊卡:點任一單位 → 暫停並顯示完整戰法(白話 / 發動率 / 冷卻 / 對象條件)、目前狀態與兵力;「繼續」關閉後接著打
function bnUiUnitAt(x, y) {
  var P = bnu.P, L = bnu.L, k, v, best = null, bd = 1e9, dx, dy;
  if (!P || !L) return null;
  for (k in P.vu) {
    v = P.vu[k];
    if (!v.alive) continue;
    dx = Math.abs(x - v.px); dy = y - v.py;
    if (dx > L.colW * 0.55 || dy < -L.sh * 1.15 || dy > L.fs * 2.4) continue;
    if (dx + Math.abs(dy + L.sh * 0.5) < bd) { bd = dx + Math.abs(dy + L.sh * 0.5); best = v; }
  }
  return best;
}
function bnUiInfoHtml(uid) {
  var S = bnu.P.S, u = S.units[uid], h, list, k, s, ST = (typeof BN_ST_NAME !== 'undefined') ? BN_ST_NAME : {}, sts = [];
  if (!u) return '';
  h = '<div class="bnbox bninfo"><h2>' + bnUiEsc(u.name) + '</h2><p style="text-align:center">' + (u.side === 'A' ? '我方' : '敵方') + ' · ' + bnUiTI(u.troop) + bnUiEsc(u.troop) + '兵 · 兵力 ' + Math.max(0, Math.round(u.hp)) + ' / ' + u.maxHp + '</p>';
  for (k in u.st) {
    s = u.st[k];
    if (!ST[k] || !s) continue;
    sts.push(ST[k] + (s.left && s.left < 900 ? ' ' + s.left + ' 回合' : (s.act ? '(到下次行動)' : (s.left >= 900 ? '(全程)' : ''))));
  }
  h += '<p class="st">狀態:' + (sts.length ? bnUiEsc(sts.join('、')) : '無') + '</p>';
  list = u.pas.concat(u.act);
  list.forEach(function (inst) {
    var d = inst.def, rate = '', cd = '', txt = '';
    if (d.cat !== 'passive' && d.cat !== 'command') {
      if (typeof bnRateOf === 'function') { try { rate = '發動率 ' + Math.round(bnRateOf(S, u, inst) * 100) + '%'; } catch (er) { rate = ''; } }
      cd = (inst.cd | 0) > 0 ? '冷卻中:還要 ' + inst.cd + ' 回合' : '可發動';
      if (d.cat === 'ult' && S.round < BN_DATA.rate.ultFrom) cd = '第 ' + BN_DATA.rate.ultFrom + ' 回合起可發動';
    }
    if (typeof bnSkillText === 'function') { try { txt = bnSkillText(d); } catch (er) { txt = ''; } }
    h += '<div class="sk"><b>' + bnUiEsc(d.name) + '</b> <small>' + bnUiEsc((typeof BN_TEXT_CATS !== 'undefined' && BN_TEXT_CATS[d.cat]) || d.cat) + (rate ? ' · ' + rate : '') + (cd ? ' · ' + cd : '') + '</small><br>' + bnUiEsc(txt || d.desc || '') + '</div>';
  });
  return h + '<div class="row"><button class="pri" data-a="resume">繼續</button></div></div>';
}
function bnUiInfo(uid) {
  if (bnu.phase !== 'fight' || !bnu.P || bnu.P.done || !bnu.P.S.units[uid]) return false;
  bnu.paused = true; bnUiStopLoop();
  bnu.info = uid;
  bnu.pauseEl.innerHTML = bnUiInfoHtml(uid);
  bnUiShowPause(true);
  return true;
}
function bnUiCutRender(c) {
  var el = bnu.cutEl, p = bnu.cutParts, k, op, sl, TONE;
  if (!el) return;
  if (!c) { el.style.display = 'none'; return; }
  if (!c.full) { el.style.display = 'none'; return; }
  if (!c.init) {
    c.init = true;
    p.bg.style.backgroundImage = 'url(assets/bnfx/ult_bg_' + c.tone + '.webp)';
    p.fig.style.display = '';
    p.fig.setAttribute('src', c.path || ''); p.fig.setAttribute('data-alt', (typeof fxFigImg === 'function' && fxFigImg(c.fig)) || 'assets/portraits/' + c.fig + '.webp');
    p.fig.style[c.side === 'A' ? 'left' : 'right'] = '2%'; p.fig.style[c.side === 'A' ? 'right' : 'left'] = 'auto';
    p.nm.textContent = c.name; p.sk.textContent = c.skill;
    p.sk.style.color = (typeof BN_TONE_COL !== 'undefined' && BN_TONE_COL[c.tone]) || '#ffd25a';
  }
  el.style.display = 'block';
  k = c.t / c.dur;
  op = Math.max(0, Math.min(1, k / 0.15, (1 - k) / 0.2));
  sl = (1 - Math.min(1, k / 0.3));
  el.style.opacity = String(op);
  p.fig.style.transform = 'translateX(' + ((c.side === 'A' ? -1 : 1) * sl * 60) + '%) scale(' + (1 + k * 0.06) + ')';
  p.bg.style.transform = 'scale(' + (1 + k * 0.1) + ')';
  p.nm.style.transform = 'translateX(' + ((c.side === 'A' ? 1 : -1) * sl * 30) + '%)';
}
function bnUiStart() {
  var msg = bnUiCheck(), rec, S, L, P, pr;
  if (msg) { bnUiToast(msg); return false; }
  if (bnu.stg && bnu.stg.kind === 'stage' && typeof bnStgCanStart === 'function') { pr = bnStgCanStart(bnu.data || bnUiLoad(), bnu.stg.id, bnStgEnv(BNUI.env)); if (!pr.ok) { bnUiToast(pr.why); return false; } }
  // 流寇可重複討伐(無每日一次限制),開打不再檢查已討平
  rec = bnUiRec();
  bnu.rec = rec;
  S = bnInit(rec);
  bnUiSetPhase('fight');
  bnUiShowRes(false); bnUiShowPause(false); bnUiCutRender(null);
  bnUiResize();
  L = bnu.L;
  pr = bnUiPref();
  P = bnPlNew(S, L, { speed: pr.spd, hooks: bnUiHooks(), powerSave: bnUiPs(), sfx: true });
  P.sb = pr.sb !== false;   // 戰法條(我方)
  bnUiFeed(null);
  bnu.P = P; bnu.result = null; bnu.info = null; bnu.paused = false; bnu.retreat = false; bnu.manual = false; bnu.logId = '';
  bnUiSyncBtns();
  if (bnu.roundEl) bnu.roundEl.textContent = '';
  bnUiResize();
  bnUiLoop(true);
  return true;
}
function bnUiSyncBtns() {
  var pr = bnUiPref();
  if (bnu.btns.spd) bnu.btns.spd.textContent = pr.spd + '×';
  if (typeof bnMapSyncFight === 'function') bnMapSyncFight();
}
function bnUiSetSpeed() {
  var pr = bnUiPref();
  pr.spd = pr.spd === 1 ? 2 : 1;   // 倍速只有 1× / 2×
  if (bnu.P) bnPlSetSpeed(bnu.P, pr.spd);
  bnUiPrefSave(); bnUiSyncBtns();
}
function bnUiSkip() {   // 介面已無「略過 / 直接結束」入口;保留給測試與截圖工具(驗證略過結果 = 播放結果)
  if (bnu.phase !== 'fight' || !bnu.P || bnu.P.done) return;
  bnPlSkip(bnu.P);
}
function bnUiCvTap(e) {   // 戰鬥中點任一單位 → 暫停並開單位資訊卡(大招 cut-in 播放中則交給 bnUiCutTap 跳過)
  var rc, v;
  if (bnu.phase !== 'fight' || !bnu.P || bnu.P.done || bnu.paused || bnu.P.cut || !e) return false;
  rc = bnu.cv && bnu.cv.getBoundingClientRect ? bnu.cv.getBoundingClientRect() : { left: 0, top: 0 };
  v = bnUiUnitAt((e.clientX || 0) - (rc.left || 0), (e.clientY || 0) - (rc.top || 0));
  return v ? bnUiInfo(v.id) : false;
}
function bnUiCutTap() {
  if (bnu.phase !== 'fight' || !bnu.P || bnu.paused || typeof bnPlCutSkip !== 'function') return false;
  return bnPlCutSkip(bnu.P);
}
function bnUiDrawOnce() {
  if (bnu.P && bnu.ctx && bnu.L) bnDrFrame(bnu.ctx, bnu.P, bnu.dpr, (typeof performance !== 'undefined' ? performance.now() : 0) / 1000);
}
function bnUiLoop(start) {
  if (start && !bnu.raf && typeof requestAnimationFrame === 'function') { bnu.last = 0; bnu.raf = requestAnimationFrame(bnUiFrame); }
}
function bnUiFrame(now) {
  var P = bnu.P, dt;
  bnu.raf = 0;
  if (!bnu.open || bnu.paused || !P || bnu.phase === 'form') return;
  if (typeof perfGateOk === 'function' && !perfGateOk(bnu.gate || (bnu.gate = perfGateNew()), now)) { bnu.raf = requestAnimationFrame(bnUiFrame); return; }
  dt = bnu.last ? (now - bnu.last) / 1000 : 0.016;
  bnu.last = now;
  bnPlTick(P, dt);
  bnDrFrame(bnu.ctx, P, bnu.dpr, now / 1000);
  bnu.frames++;
  if (P.done && !P.fx.some(function (f) { return f.on; })) return;   // 動畫空檔停止 RAF(0 fps)
  bnu.raf = requestAnimationFrame(bnUiFrame);
}
function bnUiStopLoop() {
  if (bnu.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(bnu.raf);
  bnu.raf = 0;
}

// ───────── 結算 ─────────
function bnUiResultData(S) {
  var r = S.result, st = bnPlStats(S), best = null, bv = -1, id, u, stars = 0, mv = null, sc, win = r.winner === 'A';
  for (id in st) {
    u = S.units[id];
    if (!u || u.side !== 'A') continue;
    sc = st[id].dmg + st[id].heal * 0.8 + st[id].taken * 0.3;
    if (sc > bv) { bv = sc; best = id; }
  }
  if (best !== null) { u = S.units[best]; mv = { id: +best, name: u.name, dmg: st[best].dmg, heal: st[best].heal, taken: st[best].taken, kills: st[best].kills }; }
  if (win) { stars = 1; if (r.deadA === 0) stars++; if (r.reason === 'wipe' && r.rounds <= 5) stars++; }
  return { winner: r.winner, reason: r.reason, rounds: r.rounds, deadA: r.deadA, deadB: r.deadB, total: S.teams.A.units.length, alive: S.teams.A.units.length - r.deadA, stars: stars, mvp: mv, hp: r.hp };
}
function bnUiShowRes(on) { if (bnu.resEl) bnu.resEl.classList.toggle('on', !!on); }
function bnUiShowPause(on) { if (bnu.pauseEl) bnu.pauseEl.classList.toggle('on', !!on); }
function bnUiShowResult() {
  var S = bnu.P && bnu.P.S, d, h, w, d0, rep, g, lg;
  if (!S || !S.result || bnu.phase === 'res') return;
  d = bnUiResultData(S);
  bnu.result = d;
  bnUiSetPhase('res');
  w = d.winner === 'A' ? '勝利' : (d.winner === 'B' ? '敗北' : '平手');
  h = '<div class="bnbox"><h2 style="color:' + (d.winner === 'A' ? '#ffd25a' : (d.winner === 'B' ? '#ff9a8a' : '#cfd6e0')) + '">' + w + '</h2>' +
    '<p style="font-size:26px;color:#ffd25a;letter-spacing:6px">' + (d.winner === 'A' ? '★'.repeat(d.stars) + '☆'.repeat(3 - d.stars) : '') + '</p>' +
    '<p>' + (d.reason === 'retreat' ? '撤退(算敗北,不計通關、不給獎勵)' : (d.reason === 'limit' ? '回合上限,以剩餘兵力判定' : '全滅決勝')) + ' · 共 ' + d.rounds + ' 回合 · 我方存活 ' + d.alive + '/' + d.total + '</p>' +
    (d.mvp ? '<p>本場 MVP:<b>' + bnUiEsc(d.mvp.name) + '</b><br>傷害 ' + d.mvp.dmg + ' · 治療 ' + d.mvp.heal + ' · 承傷 ' + d.mvp.taken + ' · 擊倒 ' + d.mvp.kills + '</p>' : '') +
    '@RW@' +
    '@LOG@' + (typeof bnTeamStripHtml === 'function' ? bnTeamStripHtml({ mini: true, title: '我方戰後', S: S }) : '') + '</div>';
  // 戰績與獎勵(有值才寫)。討伐 / 流寇依 bn_stages 規則結算;練兵不計戰績、不給獎勵
  d0 = bnu.data || bnUiLoad();
  rep = null;
  g = bnu.stg || { kind: 'practice' };
  if (g.kind === 'stage' && typeof bnStgSettle === 'function') rep = bnStgSettle(d0, g.id, { winner: d.winner, stars: d.stars, seed: bnu.rec ? bnu.rec.seed : 0 }, bnStgEnv(BNUI.env));
  else if (g.kind === 'bounty' && typeof bnStgBountySettle === 'function') rep = bnStgBountySettle(d0, { winner: d.winner, ch: g.def ? g.def.ch : 1 }, bnStgEnv(BNUI.env));
  bnu.report = rep;
  h = h.replace('@RW@', rep ? bnMapRewardHtml(rep) : '<p style="opacity:.75;font-size:12px">練兵不計戰績、不給獎勵</p>');
  // 文字戰報:自動記入「最近」;結算畫面可查看 / 儲存
  bnu.logId = '';
  if (bnu.rec && typeof bnLogBuild === 'function' && typeof bnLogRecord === 'function') {
    lg = bnLogBuild(S, bnu.rec, {
      label: bnUiStageLabel() + (g.kind === 'stage' && typeof bnStgById === 'function' && bnStgById(g.id) ? ' ' + bnStgById(g.id).name : ''), kind: g.kind, sid: g.id || BNUI.stage, manual: bnu.manual,
      stars: bnu.slots.filter(function (s) { return !!bnUiEntry(s.id); }).map(function (s) { return bnUiEntry(s.id).starLv | 0; }),
      res: { w: d.winner, why: d.reason, r: d.rounds, st: d.stars }
    });
    bnLogRecord(lg, bnu.rec);
    bnu.logId = lg.id;
  }
  // 結算只留兩個按鈕:查看戰報(內含儲存 / 分享戰報碼)、離開(回討伐地圖,聚焦下一關)
  h = h.replace('@LOG@', '<div class="row bnres-row">' + (bnu.logId ? '<button data-a="logview" class="pri">查看戰報</button>' : '') + '<button data-a="tomap"' + (bnu.logId ? '' : ' class="pri"') + '>離開</button></div>');
  bnu.resEl.innerHTML = h;
  bnUiShowRes(true);
  d0.last = { stage: BNUI.stage, res: d.winner, rounds: d.rounds, stars: d.stars };
  bnUiCurSave(); bnUiSave();
  if (rep && rep.win && typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  if (rep && rep.win && g.kind === 'stage' && typeof BNMAP !== 'undefined') { BNMAP.sel = null; BNMAP.ch = 0; }   // 勝利 → 回地圖時預設選下一關(bnMapRender 預設選第一個未通關的已解鎖關)
  if (bnu.P) bnPlSfxEnd(d.winner);
  bnUiDrawOnce();
  if (typeof bnsOnResult === 'function') bnsOnResult(d);   // 對戰練習(js/bnshare.js):不計進度、改結算按鈕
}
function bnPlSfxEnd(w) { if (typeof bnSfxEnd === 'function') { try { bnSfxEnd(w); } catch (e) { /* 略過 */ } } else if (typeof sfxwPlay === 'function') { try { sfxwPlay(w === 'A' ? 'win' : (w === 'B' ? 'lose' : 'flag')); } catch (e) { /* 略過 */ } } }
function bnUiToForm() {
  if (bnu.P) { bnPlDispose(bnu.P); bnu.P = null; }
  bnUiStopLoop();
  bnUiShowRes(false); bnUiShowPause(false); bnUiCutRender(null);
  bnu.paused = false;
  bnUiSetPhase('form');
  bnUiRenderForm();
}
// 戰鬥入口(側欄『戰鬥』開啟後的第一個畫面):副本 / 對戰 / 戰報 / 練兵
function bnUiRenderEntry() {
  var el = bnu.entEl, d, done = 0, tot = 0;
  if (!el) return;
  d = bnu.data || bnUiLoad();
  if (typeof bnMapStageStats === 'function' && typeof BN_STAGES !== 'undefined') { done = bnMapStageStats(d).cleared; tot = BN_STAGES.length; }
  el.innerHTML = '<div class="bnen"><p class="bnen-sum">卡包 ' + bnUiRosterList().length + ' 人 · 討伐進度 ' + done + '/' + tot + '</p>' +
    '<button class="bnen-b" data-a="ent" data-t="stage"><b>副本</b><small>討伐地圖:選章節與關卡,首通有獎勵,可重複通關</small></button>' +
    '<button class="bnen-b" data-a="ent" data-t="share"><b>對戰</b><small>對戰碼與擂台(不計進度、不給獎勵)</small></button>' +
    '<button class="bnen-b" data-a="ent" data-t="log"><b>戰報</b><small>最近的戰報,可查看與儲存</small></button>' +
    '<button class="bnen-b" data-a="ent" data-t="prac"><b>練兵</b><small>不計戰績、不給獎勵,敵將依我方戰力縮放,可自由試陣</small></button></div>';
}
function bnUiEntryDo(t) {
  if (t === 'stage') bnUiToMap();
  else if (t === 'share') { if (typeof bnsOpen === 'function') bnsOpen('share'); }
  else if (t === 'log') { if (typeof bnLogOpen === 'function') bnLogOpen('recent'); }
  else if (t === 'prac') { if (typeof bnMapEnter === 'function') bnMapEnter('practice'); }
}
function bnUiToEntry() {
  if (bnu.P) { bnPlDispose(bnu.P); bnu.P = null; }
  bnUiStopLoop();
  bnUiShowRes(false); bnUiShowPause(false); bnUiCutRender(null);
  bnu.paused = false;
  bnUiSetPhase('entry');
  bnUiRenderEntry();
}
function bnUiToMap() {
  if (bnu.P) { bnPlDispose(bnu.P); bnu.P = null; }
  bnUiStopLoop();
  bnUiShowRes(false); bnUiShowPause(false); bnUiCutRender(null);
  bnu.paused = false;
  bnUiSetPhase('map');
  if (typeof bnMapRender === 'function') bnMapRender();
}
function bnUiRetreat() {
  // 撤退 = 一律算敗北:走一般敗北結算(不通關、不發獎勵),戰報註明撤退
  var P = bnu.P, S = P && P.S, ca, cb;
  bnUiShowPause(false);
  if (bnu.phase !== 'fight' || !S) { bnUiToForm(); return; }
  bnUiStopLoop();
  bnu.paused = false; bnu.retreat = true;
  if (!S.over) {
    ca = bnAlive(S, 'A').length; cb = bnAlive(S, 'B').length;
    S.over = true;
    S.result = { winner: 'B', reason: 'retreat', rounds: S.round, hp: { A: Math.round(bnTeamHpPct(S, 'A') * 1000) / 1000, B: Math.round(bnTeamHpPct(S, 'B') * 1000) / 1000 }, deadA: S.teams.A.units.length - ca, deadB: S.teams.B.units.length - cb };
  }
  P.tm = []; P.cut = null; bnUiCutRender(null);
  P.done = true; P.result = S.result;
  bnUiShowResult();
}
function bnUiPause(on) {
  if (bnu.phase !== 'fight' || !bnu.P || bnu.P.done) { if (!on) bnUiShowPause(false); return; }
  if (on) {
    bnu.paused = true; bnUiStopLoop();
    bnu.info = null;
    bnu.pauseEl.innerHTML = '<div class="bnbox"><h2>暫停</h2><p>撤退一律算敗北:不計通關、不給獎勵。</p><div class="row"><button class="pri" data-a="resume">繼續</button><button data-a="retreat">撤退</button></div>' +
      '<div class="row"><button data-a="sbar">顯示戰法條:' + (bnUiPref().sb !== false ? '開' : '關') + '</button></div></div>';
    bnUiShowPause(true);
  } else {
    bnu.paused = false; bnu.info = null; bnUiShowPause(false);
    bnUiLoop(true);
  }
}
function bnUiBack() {
  if (bnu.leaving || !bnu.open) return false;
  if (typeof bnTeamBack === 'function' && bnTeamBack()) return true;
  if (bnPopBack()) return true;   // 人物詳情開著:先關   // 戰法說明浮層開著:先關
  if (typeof BNMAP !== 'undefined' && BNMAP.det) { BNMAP.det = false; bnMapRender(); return true; }   // 副本關卡詳細說明開著:先關
  if (typeof bnLogBack === 'function' && bnLogBack()) return true;   // 戰報面板開著:先關面板
  if (typeof bnsBack === 'function' && bnsBack()) return true;   // 對戰練習面板開著:先關面板
  if (bnu.phase === 'fight') { bnUiPause(!bnu.paused); return true; }
  if (bnu.phase === 'res') { bnUiToForm(); return true; }
  if (bnu.phase === 'form' && typeof bnMapRender === 'function') { if (bnu.stg && bnu.stg.kind === 'practice') bnUiToEntry(); else bnUiToMap(); return true; }
  if (bnu.phase === 'map') { bnUiToEntry(); return true; }
  return bnUiLeave();
}

// ───────── 進出 ─────────
function bnUiSnap() {
  var s = {};
  try {
    if (typeof panelSnapshot === 'function') s = panelSnapshot() || {};
    else {
      if (typeof pend !== 'undefined' && pend) { s.sel = pend.sel; s.moving = pend.moving; }
      if (typeof view !== 'undefined' && view) s.cam = { x: view.x, y: view.y, zoom: view.zoom };
    }
  } catch (e) { s = {}; }
  return s;
}
function bnUiRestore(s) {
  var c;
  if (!s) return;
  try {
    if (typeof pend !== 'undefined' && pend && s.sel !== undefined) { pend.sel = s.sel; pend.moving = s.moving; }
    c = s.cam;
    if (c && typeof view !== 'undefined' && view) { view.x = c.x; view.y = c.y; view.zoom = c.zoom; }
  } catch (e) { /* 略過 */ }
}
function bnUiCanEnter() {
  if (bnu.open || bnu.leaving || typeof game === 'undefined' || !game || game.mode !== 'estate') return false;
  if (typeof draft !== 'undefined' && draft) return false;
  if (typeof document === 'undefined' || !document.body) return false;
  return true;
}
function bnUiOnKey(e) { if (bnu.open && (e.key === 'Escape' || e.key === 'Esc')) bnUiBack(); }
function bnUiOnPop() {
  if (!bnu.open) return;
  if (bnu.histSkip) { bnu.histSkip = false; return; }
  bnu.histOn = false;
  if (bnPopIsOpen() || (typeof bnLogIsOpen === 'function' && bnLogIsOpen()) || (typeof bnTeamIsOpen === 'function' && bnTeamIsOpen()) || (typeof bnsIsOpen === 'function' && bnsIsOpen()) || (typeof BNMAP !== 'undefined' && BNMAP.det) || bnu.phase !== 'entry') {
    try { history.pushState({ bn: 1 }, ''); bnu.histOn = true; } catch (e) { /* 略過 */ }
    bnUiBack();
    return;
  }
  bnUiLeave(false, true);
}
function bnUiOnVis() {
  if (!bnu.open) return;
  if (document.visibilityState === 'hidden') {
    bnUiStopLoop();
    if (bnu.phase === 'fight' && bnu.P && !bnu.P.done && !bnu.paused) bnUiPause(true);
    if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  }
}
function bnUiBind(on) {
  var f = on ? 'addEventListener' : 'removeEventListener';
  document[f]('visibilitychange', bnUiOnVis);
  document[f]('keydown', bnUiOnKey);
  window[f]('popstate', bnUiOnPop);
  window[f]('resize', bnUiOnResize);
  window[f]('orientationchange', bnUiOnResize);
}
function bnUiOpen() {
  var t0 = (typeof performance !== 'undefined') ? performance.now() : 0, d;
  if (!bnUnlocked()) { bnUiToast('卡包至少 ' + BNUI.minRoster + ' 人才能出戰(目前 ' + bnUiRosterList().length + ' 人)'); return false; }
  if (!bnUiCanEnter()) return false;
  bnu.snap = bnUiSnap();
  try { if (typeof pend !== 'undefined' && pend) { pend.sel = null; pend.moving = null; } } catch (e) { /* 略過 */ }
  if (typeof cardsUiClose === 'function') { try { cardsUiClose(); } catch (e) { /* 略過 */ } }
  if (typeof panelCloseAll === 'function') { try { panelCloseAll(); } catch (e) { /* 略過 */ } }
  d = bnUiLoad();
  bnu.slots = (d.cur && d.cur.slots.length) ? d.cur.slots.map(function (s) { return { id: s.id, row: s.row, col: s.col, troop: s.troop }; }) : [];
  bnu.tp = {}; bnu.slots.forEach(function (s) { if (s.troop) bnu.tp[s.id] = s.troop; });
  if (!bnu.slots.length) bnUiAct('auto');
  bnu.sel = null; bnu.filter = ''; bnu.P = null; bnu.result = null; bnu.paused = false; bnu.frames = 0; bnu.gate = null; bnu.last = 0;
  bnUiBuildLayer();
  bnu.open = true; bnu.leaving = false;
  game.mode = 'bn';
  if (document.body.classList) document.body.classList.add('in-bn');
  bnu.stg = { kind: 'practice', id: 'P' }; BNUI.stage = 'P';
  if (typeof BNMAP !== 'undefined') BNMAP.det = false;
  bnUiSetPhase('entry'); bnUiRenderEntry();
  bnUiResize();
  bnUiSyncBtns();
  bnUiBind(true);
  bnu.histOn = false; bnu.histSkip = false;
  try { history.pushState({ bn: 1 }, ''); bnu.histOn = true; } catch (e) { /* 略過 */ }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { if (bnu.layer && bnu.layer.classList) bnu.layer.classList.add('on'); });
  BNUI.enterMs = (typeof performance !== 'undefined') ? performance.now() - t0 : 0;
  return true;
}
function bnUiLeave(immediate, fromPop) {
  var layer = bnu.layer;
  if (!bnu.open || bnu.leaving) return false;
  bnu.leaving = true;
  bnu.open = false;
  if (typeof bnLogClose === 'function') bnLogClose();
  if (typeof bnTeamInfoClose === 'function') bnTeamInfoClose();
  bnUiDragCancel(); bnu.pop = null;
  bnUiStopLoop();
  if (bnu.P) { bnPlDispose(bnu.P); bnu.P = null; }
  bnUiBind(false);
  bnu.rz.forEach(function (h) { clearTimeout(h); });
  bnu.rz = [];
  if (bnu.histOn && !fromPop) {
    bnu.histOn = false; bnu.histSkip = true;
    try { history.back(); } catch (e) { bnu.histSkip = false; }
  }
  bnu.histOn = false;
  bnUiCurSave(); bnUiSave();
  if (document.body.classList) document.body.classList.remove('in-bn');
  game.mode = 'estate';
  bnUiRestore(bnu.snap);
  bnu.snap = null;
  function done() {
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    bnu.layer = null; bnu.popEl = null; bnu.cv = null; bnu.ctx = null; bnu.bar = null; bnu.top = null; bnu.backBtn = null; bnu.titleEl = null; bnu.subEl = null; bnu.roundEl = null; bnu.formEl = null; bnu.mapEl = null; bnu.entEl = null; bnu.resEl = null; bnu.pauseEl = null; bnu.cutEl = null; bnu.cutParts = null; bnu.strip = null; bnu.stripEls = []; bnu.btns = {};
    bnu.leaving = false; bnu.L = null;
    if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  }
  if (immediate || !layer || !layer.classList || typeof setTimeout !== 'function') done();
  else { layer.classList.remove('on'); setTimeout(done, BNUI.fadeMs + 20); }
  return true;
}
function bnUiStats() { return { draw: BNDR.stats, enterMs: BNUI.enterMs || 0, frames: bnu.frames }; }

if (typeof module !== 'undefined' && module.exports) module.exports = { BNUI: BNUI };
