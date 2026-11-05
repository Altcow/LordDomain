// js/bnui.js — 戰鬥 A 模式(B2)入口、戰前布陣、全螢幕戰鬥場景 game.mode='bn'、結算。PLAN_BATTLE_A §1.2、§6、§8。
// 做法同 interior.js(全螢幕子畫面):game.mode='bn';main.js 此模式不畫城市(經濟 / 科技 tick 照跑);淡入淡出 ≤ 300ms;返回鍵(popstate)/ Esc / 左上返回鈕;離開時恢復城市鏡頭與選取。
// 一個全螢幕 layer(#bnLayer)含三個階段:布陣(DOM 表單)→ 戰鬥(canvas + DOM 頂列 / 順序條 / cut-in)→ 結算(DOM)。戰鬥畫面由 bndraw.js 的播放器繪製。
// 存檔:世界內 'lorddomain.bn.v1'(進度鍵,有值才寫)、偏好 'lorddomain.bn.pref'。B2 敵人 = 固定「練習戰 1-1」山賊樣板(依我方戰力縮放);完整討伐地圖與獎勵是 B3,這裡不做。
// 不發聲(音效經 bndraw 的 sfxwPlay,有守衛)、不新增音檔。ES2017;不用 ?. ??。
// 全域:BNUI bnUnlocked bnUiOpen bnUiLeave bnUiActive bnUiState bnUiLoad bnUiSave bnUiPref bnUiFoes bnUiAct bnUiBuild bnUiBonds bnUiStart bnUiResultData bnUiPause bnUiBack bnUiStats

var BNUI = {
  key: 'lorddomain.bn.v1', prefKey: 'lorddomain.bn.pref', fadeMs: 240, barH: 48, maxUnits: 5, stage: 'P', minRoster: 3, minRank: 2, dprMax: 2, pixMax: 3.6e6,
  foeBase: ['bandit_chief', 'bandit_blade', 'bandit_hunter', 'bandit_blade', 'bandit_hunter'], foePos: [[0, 1], [0, 0], [2, 1], [0, 2], [2, 0]]
};
var BNUI_FOE = {
  bandit_chief: { name: '寨主', troop: '步', hpK: 1.25, atkK: 1.12, skills: ['g_chongfeng'], ult: 'u_inf' },
  bandit_blade: { name: '刀匪', troop: '步', hpK: 1, atkK: 1, skills: ['g_zhan'], ult: 'u_inf' },
  bandit_hunter: { name: '獵戶', troop: '弓', hpK: 1, atkK: 1, skills: ['g_lianshe'], ult: 'u_arc' }
};
var bnu = {
  open: false, leaving: false, layer: null, cv: null, ctx: null, top: null, bar: null, backBtn: null, titleEl: null, subEl: null, strip: null, stripEls: [], roundEl: null, formEl: null, resEl: null, pauseEl: null, cutEl: null, cutParts: null,
  btns: {}, mapEl: null, stg: { kind: 'practice', id: 'P' }, report: null, phase: 'form', slots: [], sel: null, tp: {}, filter: '', data: null, pref: null, P: null, L: null, rec: null, raf: 0, last: 0, gate: null, paused: false, histOn: false, histSkip: false, snap: null, rz: [], dpr: 1,
  vw: 0, vh: 0, result: null, msg: '', frames: 0, listeners: false, hudRound: ''
};
function bnUiActive() { return !!bnu.open; }
function bnUiState() { return bnu; }
function bnUiEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bnUiToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function bnUiPs() { return (typeof isPowerSave === 'function') && !!isPowerSave(); }

// ───────── 功能閘(PLAN §1.2):官階 ≥ 亭長 且 名冊 ≥ 3 人;不需蓋建築,城建專注模式下照樣可見 ─────────
function bnUiRosterList() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null;
  return cs && cs.roster ? cs.roster : [];
}
function bnUnlocked() {
  var lv = 0;
  try { lv = (typeof cardsRankLv === 'function') ? cardsRankLv() : 0; } catch (e) { lv = 0; }
  return lv >= BNUI.minRank && bnUiRosterList().length >= BNUI.minRoster;
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
    out.slots.push({ id: s.id, row: s.row | 0, col: s.col | 0, troop: BN_DATA.troops[s.troop] ? s.troop : '' });
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
  var raw, o, p = { spd: 1, autoUlt: 1 };
  if (bnu.pref) return bnu.pref;
  raw = bnUiLsGet(BNUI.prefKey);
  if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  if (o) { if (o.spd === 2 || o.spd === 4) p.spd = o.spd; if (o.autoUlt === 0) p.autoUlt = 0; }
  bnu.pref = p;
  return p;
}
function bnUiPrefSave() { var p = bnUiPref(); bnUiLsSet(BNUI.prefKey, JSON.stringify({ spd: p.spd, autoUlt: p.autoUlt })); }

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
  var b = bnUiBuild(), out = { on: b.team.bonds.concat(b.team.formation), hint: [] }, facCnt = [0, 0, 0, 0], tagCnt = {}, i, e, j, fac, best = -1, bn = 0;
  for (i = 0; i < bnu.slots.length; i++) {
    e = bnUiEntry(bnu.slots[i].id);
    if (!e) continue;
    if (e.fac >= 0 && e.fac <= 3) facCnt[e.fac]++;
    j = (e.main && typeof CARD_JOB_BY_ID !== 'undefined') ? CARD_JOB_BY_ID[e.main] : null;
    if (j) tagCnt[j.tag] = (tagCnt[j.tag] || 0) + 1;
  }
  for (fac = 0; fac < 4; fac++) if (facCnt[fac] > bn) { bn = facCnt[fac]; best = fac; }
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
    sres: Math.round(40 * k), spd: Math.round(50 + 15 + 10 + c.spd), heal: 90, sh: 140, crit: 0.05, res: 0.04, morale0: 30, mgain: 1, skills: t.skills.slice(), ult: t.ult
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
    v: 1, seed: bnHash('bn', (cs && cs.seed) | 0, BNUI.stage, bnUiDayNo(), fp), teamA: b.team.units, teamB: foes.specs, opts: { autoUlt: bnUiPref().autoUlt !== 0, events: true, scene: '' },
    meta: { stage: BNUI.stage, kind: (bnu.stg && bnu.stg.kind) || 'practice', ch: (bnu.stg && bnu.stg.def && bnu.stg.def.ch) || 0, foePower: foes.power, scale: foes.scale, bonds: b.team.bonds, formation: b.team.formation }
  };
}

// ───────── 版面 ─────────
function bnUiViewport() {
  var w = (typeof window !== 'undefined' && window.innerWidth) || 390, h = (typeof window !== 'undefined' && window.innerHeight) || 780;
  return { w: Math.max(120, Math.floor(w)), h: Math.max(160, Math.floor(h)) };
}
function bnUiResize() {
  var vp, dpr, top, bot, P = bnu.P;
  if (!bnu.open || !bnu.cv) return;
  vp = bnUiViewport();
  dpr = Math.min(BNUI.dprMax, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  if (bnUiPs()) dpr = Math.min(dpr, 1.5);
  if (vp.w * vp.h * dpr * dpr > BNUI.pixMax) dpr = Math.sqrt(BNUI.pixMax / (vp.w * vp.h));
  bnu.vw = vp.w; bnu.vh = vp.h; bnu.dpr = dpr;
  bnu.cv.width = Math.round(vp.w * dpr); bnu.cv.height = Math.round(vp.h * dpr);
  if (bnu.cv.style) { bnu.cv.style.width = vp.w + 'px'; bnu.cv.style.height = vp.h + 'px'; }
  top = (bnu.top && bnu.top.offsetHeight) || BNUI.barH;
  bot = 30;
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
    '#bnLayer .fo{display:none}#bnLayer.ph-fight .fo{display:inline-block}#bnLayer.ph-fight .fo.ib{display:inline-flex}' +
    '#bnStrip{display:none;gap:4px;padding:0 calc(8px + env(safe-area-inset-right)) 4px calc(8px + env(safe-area-inset-left));align-items:center;overflow:hidden}#bnLayer.ph-fight #bnStrip{display:flex}' +
    '.bno{flex:0 0 auto;min-width:32px;height:28px;padding:0 4px;border-radius:6px;border:2px solid #3a6ea8;background:rgba(58,110,168,.28);font-size:12px;line-height:24px;text-align:center;white-space:nowrap}.bno.e{border-color:#a84a3a;background:rgba(168,74,58,.28)}.bno.cur{box-shadow:0 0 0 2px #ffd25a;background:#ffd25a;color:#1b1308}.bno.x{opacity:.3}' +
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
    '@media (orientation:landscape) and (min-width:700px){#bnForm{display:none}#bnLayer.ph-form #bnForm{display:grid;grid-template-columns:minmax(300px,1fr) minmax(300px,1.2fr);column-gap:14px;align-content:start}#bnForm .c1{grid-column:1}#bnForm .c2{grid-column:2}.bnf-roster{flex-wrap:wrap;overflow-x:visible}}' +
    '#bnMap{position:relative;z-index:2;flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));display:none}#bnLayer.ph-map #bnMap{display:block}' +
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
  var layer = bnUiMk('div', 'bnLayer', 'ph-form'), top = bnUiMk('div', 'bnTop'), bar = bnUiMk('div', 'bnBar'), strip = bnUiMk('div', 'bnStrip'), cv = bnUiMk('canvas', 'bnCv'), i, el;
  bnUiCss();
  bnu.backBtn = bnUiBtn('↩', '返回', function () { bnUiBack(); });
  bnu.titleEl = bnUiMk('b'); bnu.subEl = bnUiMk('span');
  bnu.roundEl = bnUiMk('span', 'bnRound', 'fo');
  bar.appendChild(bnu.backBtn); bar.appendChild(bnu.titleEl); bar.appendChild(bnu.roundEl);
  bnu.btns.spd = bnUiBtn('1×', '倍速', function () { bnUiSetSpeed(); }, 'fo ib'); bnu.btns.auto = bnUiBtn('⚡', '自動大招', function () { bnUiToggleAuto(); }, 'fo ib');
  bnu.btns.skip = bnUiBtn('⏭', '略過', function () { bnUiSkip(); }, 'fo ib'); bnu.btns.quit = bnUiBtn('✕', '撤退', function () { bnUiPause(true); }, 'fo ib');
  ['spd', 'auto', 'skip', 'quit'].forEach(function (k) { bar.appendChild(bnu.btns[k]); });
  bnu.stripEls = [];
  for (i = 0; i < 6; i++) { el = bnUiMk('div', '', 'bno x'); strip.appendChild(el); bnu.stripEls.push(el); }
  top.appendChild(bar); top.appendChild(strip);
  bnu.formEl = bnUiMk('div', 'bnForm');
  bnu.formEl.addEventListener('click', bnUiFormClick);
  bnu.cutEl = bnUiMk('div', 'bnCut');
  bnu.cutParts = { bg: bnUiMk('div', '', 'bg'), fig: bnUiMk('img', '', 'fig'), nm: bnUiMk('div', '', 'nm'), sk: bnUiMk('div', '', 'sk') };
  bnu.cutParts.fig.setAttribute('alt', '');
  bnu.cutParts.fig.addEventListener('error', function () { var f = bnu.cutParts.fig, a = f.getAttribute('data-alt'); if (a) { f.removeAttribute('data-alt'); f.setAttribute('src', a); } else if (f.style) f.style.display = 'none'; });
  ['bg', 'fig', 'nm', 'sk'].forEach(function (k) { bnu.cutEl.appendChild(bnu.cutParts[k]); });
  bnu.mapEl = bnUiMk('div', 'bnMap'); bnu.mapEl.addEventListener('click', bnUiFormClick);
  bnu.resEl = bnUiMk('div', 'bnRes'); bnu.resEl.addEventListener('click', bnUiFormClick);
  bnu.pauseEl = bnUiMk('div', 'bnPause'); bnu.pauseEl.addEventListener('click', bnUiFormClick);
  layer.appendChild(cv); layer.appendChild(bnu.formEl); layer.appendChild(bnu.mapEl); layer.appendChild(top); layer.appendChild(bnu.cutEl); layer.appendChild(bnu.resEl); layer.appendChild(bnu.pauseEl);
  cv.addEventListener('pointerup', bnUiCvTap);
  document.body.appendChild(layer);
  bnu.layer = layer; bnu.cv = cv; bnu.ctx = cv.getContext('2d'); bnu.top = top; bnu.bar = bar; bnu.strip = strip;
}
function bnUiSetPhase(ph) {
  var cl = bnu.layer && bnu.layer.classList;
  bnu.phase = ph;
  if (cl) { cl.remove('ph-form'); cl.remove('ph-map'); cl.remove('ph-fight'); cl.remove('ph-res'); cl.add('ph-' + ph); }
  if (bnu.titleEl) bnu.titleEl.textContent = ph === 'map' ? '討伐' : (ph === 'form' ? '戰前布陣 · ' + bnUiStageLabel() : (ph === 'fight' ? bnUiStageLabel() : '戰果'));
  if (bnu.subEl) bnu.subEl.textContent = '';
}

// ───────── 布陣畫面 ─────────
var BNUI_GR = ['白', '青', '藍', '紫', '金'];
function bnUiAptTxt(e, tr) { var a = bnAptOf(e).apt[tr] || 'C'; return a; }
function bnUiRenderForm() {
  var el = bnu.formEl, h = '', roster = bnUiRosterList(), build = bnUiBuild(), bonds = bnUiBonds(), foes, foeP = 0, mineP = 0, rows = [2, 1, 0], r, c, s, e, tr, list, i, sel = bnu.sel, selE = sel ? bnUiEntry(sel) : null, sc, msg = bnUiCheck(), keepL = 0, ro;
  if (!el) return;
  ro = el.querySelector ? el.querySelector('.bnf-roster') : null;
  if (ro && ro.scrollLeft) keepL = ro.scrollLeft;
  foes = bnUiCurFoes(build.team.units);
  build.team.units.forEach(function (x) { mineP += bnPower(x); });
  h += '<div class="c1"><div class="bnf-foe">' + (foes.kind === 'practice' ? '敵將:山賊(練兵)' : '敵將:' + bnUiEsc(foes.label)) + ' · 建議戰力 <b>' + foes.power + '</b> · 我方 <b>' + mineP + '</b><br>' +
    foes.specs.map(function (x) { return '<i>' + (x.title ? bnUiEsc(x.title) + ' ' : '') + bnUiEsc(x.name) + ' ' + bnUiEsc(x.troop) + '</i>'; }).join('') + '</div>';
  h += '<div class="bnf-bonds">羈絆:' + (bonds.on.length ? bonds.on.map(function (x) { return '<i>' + bnUiEsc(x) + '</i>'; }).join('') : '<u>尚未成立</u>') + bonds.hint.map(function (x) { return '<u>' + bnUiEsc(x) + '</u>'; }).join('') + '</div>';
  h += '<div class="bnf-grid"><div class="bnf-gh">後排</div><div class="bnf-gh">中排</div><div class="bnf-gh">前排 ▶ 敵</div>';
  for (c = 0; c < 3; c++) {
    for (i = 0; i < 3; i++) {
      r = rows[i]; s = bnUiSlotAt(r, c); e = s ? bnUiEntry(s.id) : null;
      if (e) {
        tr = s.troop || bnUiTroopOf(e);
        h += '<button class="bnf-cell occ' + (sel === e.id ? ' sel' : '') + '" data-a="cell" data-r="' + r + '" data-c="' + c + '"><b>' + bnUiEsc(e.name) + '</b><small>' + tr + ' ' + bnUiAptTxt(e, tr) + '</small></button>';
      } else h += '<button class="bnf-cell" data-a="cell" data-r="' + r + '" data-c="' + c + '" aria-label="空格">＋</button>';
    }
  }
  h += '</div></div><div class="c2">';
  if (selE) {
    tr = bnUiTroopOf(selE); sc = bnUiSpec(selE, { troop: tr });
    h += '<div class="bnf-sel"><b>' + bnUiEsc(selE.name) + '</b>(' + BNUI_GR[selE.gr] + '階)戰力 ' + bnPower(sc) + ' · 建議站 ' + ['前', '中', '後'][bnRowOf(selE, tr)] + '排<br>' +
      '戰法:' + sc.skills.concat(sc.ult ? [sc.ult] : []).map(function (id) { return BN_SKILLS[id] ? bnUiEsc(BN_SKILLS[id].name) : ''; }).filter(Boolean).join('、') + '<div class="bnf-chips">' +
      BN_DATA.troopList.map(function (t) { var a = bnUiAptTxt(selE, t); return '<button class="' + (t === tr ? 'on' : '') + (a === 'C' ? ' bad' : '') + '" data-a="troop" data-id="' + bnUiEsc(selE.id) + '" data-t="' + t + '">' + t + ' ' + a + '</button>'; }).join('') +
      (bnUiSlotOf(selE.id) ? '<button data-a="remove" data-id="' + bnUiEsc(selE.id) + '">撤下</button>' : '') + '</div></div>';
  } else h += '<div class="bnf-sel">點名冊人物,再點上方格子放入(最多 ' + BNUI.maxUnits + ' 人);點已上陣者可換兵種或撤下,再點另一格互換。</div>';
  h += '<div class="bnf-chips">' + [['', '全部']].concat(BN_DATA.troopList.map(function (t) { return [t, t]; })).map(function (f) { return '<button class="' + (bnu.filter === f[0] ? 'on' : '') + '" data-a="filter" data-t="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
  list = roster.map(function (x) { var t = bnUiTroopOf(x); return { e: x, t: t, pw: bnPower(bnUiSpec(x, { troop: t })) }; }).filter(function (x) { return !bnu.filter || x.t === bnu.filter; });
  list.sort(function (a, b) { return b.pw - a.pw; });
  h += '<div class="bnf-roster">' + list.map(function (x) {
    return '<button class="bnf-card g' + x.e.gr + (sel === x.e.id ? ' sel' : '') + (bnUiSlotOf(x.e.id) ? ' on' : '') + '" data-a="card" data-id="' + bnUiEsc(x.e.id) + '"><b>' + bnUiEsc(x.e.name) + '</b><br>' + x.t + ' ' + bnUiAptTxt(x.e, x.t) + ' · ' + x.pw + '</button>';
  }).join('') + '</div>';
  h += '<div class="bnf-chips">預設:' + [0, 1, 2].map(function (k) { var f = bnu.data && bnu.data.forms[k]; return '<button data-a="loadP" data-i="' + k + '"' + (f && f.slots.length ? ' class="on"' : '') + '>載入' + (k + 1) + '</button>'; }).join('') +
    [0, 1, 2].map(function (k) { return '<button data-a="saveP" data-i="' + k + '">存為' + (k + 1) + '</button>'; }).join('') + '</div>';
  h += (msg ? '<div class="bnf-msg">' + msg + '</div>' : '') + '<div class="bnf-foot"><button class="bnbtn" data-a="auto">一鍵布陣</button><button class="bnbtn" data-a="clear">清空</button><button class="bnf-go" data-a="go"' + (msg ? ' disabled' : '') + '>出戰</button></div></div>';
  el.innerHTML = h;
  ro = el.querySelector ? el.querySelector('.bnf-roster') : null;
  if (ro && keepL) ro.scrollLeft = keepL;
  bnu.hudRound = '';
}
function bnUiFormClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-a]') : null, a, id, r, c, s;
  if (!b) return;
  a = b.getAttribute('data-a'); id = b.getAttribute('data-id');
  bnUiDo(a, id, +b.getAttribute('data-r'), +b.getAttribute('data-c'), b.getAttribute('data-t'), +b.getAttribute('data-i'));
}
// 表單 / 對話框的統一動作入口(測試也直接呼叫)
function bnUiDo(a, id, r, c, t, i) {
  var s, o;
  if (typeof bnMapDo === 'function' && bnMapDo(a, id, r, c, t, i)) return;
  if (a === 'card') { bnu.sel = (bnu.sel === id) ? null : id; bnUiRenderForm(); }
  else if (a === 'cell') {
    s = bnUiSlotAt(r, c);
    if (bnu.sel) {
      o = bnUiSlotOf(bnu.sel);
      if (o && s && s === o) { bnu.sel = null; bnUiRenderForm(); }
      else bnUiAct('place', bnu.sel, r, c);
    } else if (s) { bnu.sel = s.id; bnUiRenderForm(); }
  }
  else if (a === 'troop') bnUiAct('troop', id, t);
  else if (a === 'remove') bnUiAct('remove', id);
  else if (a === 'filter') { bnu.filter = t || ''; bnUiRenderForm(); }
  else if (a === 'auto' || a === 'clear') bnUiAct(a);
  else if (a === 'saveP' || a === 'loadP') bnUiAct(a, i);
  else if (a === 'go') bnUiStart();
  else if (a === 'again') { bnUiToForm(); }
  else if (a === 'leave') bnUiLeave();
  else if (a === 'resume') bnUiPause(false);
  else if (a === 'skip') { bnUiPause(false); bnUiSkip(); }
  else if (a === 'retreat') bnUiRetreat();
}

// ───────── 戰鬥 ─────────
function bnUiHooks() {
  return {
    order: function (cur, list) {
      var ids = (cur >= 0 ? [cur] : []).concat(list || []).slice(0, 6), i, el, u, S = bnu.P && bnu.P.S;
      for (i = 0; i < bnu.stripEls.length; i++) {
        el = bnu.stripEls[i]; u = (i < ids.length && S) ? S.units[ids[i]] : null;
        if (!u) { el.className = 'bno x'; el.textContent = ''; continue; }
        el.className = 'bno' + (u.side === 'B' ? ' e' : '') + (i === 0 && cur >= 0 ? ' cur' : '');
        el.textContent = u.name.slice(0, 2);
      }
    },
    round: function (n) { if (bnu.roundEl) bnu.roundEl.textContent = n + ' / ' + BN_DATA.maxRound; },
    cut: function (c) { bnUiCutRender(c); },
    end: function (res) { bnUiShowResult(); }
  };
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
    p.fig.setAttribute('src', c.path || ''); p.fig.setAttribute('data-alt', 'assets/portraits/' + c.fig + '.webp');
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
  if (bnu.stg && bnu.stg.kind === 'bounty' && typeof bnStgBountyDone === 'function' && bnStgBountyDone(bnu.data || bnUiLoad(), bnStgEnv(BNUI.env))) { bnUiToast('今日流寇已討平'); return false; }
  rec = bnUiRec();
  bnu.rec = rec;
  S = bnInit(rec);
  bnUiSetPhase('fight');
  bnUiShowRes(false); bnUiShowPause(false); bnUiCutRender(null);
  bnUiResize();
  L = bnu.L;
  pr = bnUiPref();
  P = bnPlNew(S, L, { speed: pr.spd, hooks: bnUiHooks(), powerSave: bnUiPs(), sfx: true });
  bnu.P = P; bnu.result = null; bnu.paused = false;
  bnUiSyncBtns();
  if (bnu.roundEl) bnu.roundEl.textContent = '';
  bnUiResize();
  bnUiLoop(true);
  return true;
}
function bnUiSyncBtns() {
  var pr = bnUiPref();
  if (bnu.btns.spd) bnu.btns.spd.textContent = pr.spd + '×';
  if (bnu.btns.auto) { bnu.btns.auto.classList.toggle('on', pr.autoUlt !== 0); bnu.btns.auto.setAttribute('aria-pressed', pr.autoUlt !== 0 ? 'true' : 'false'); }
}
function bnUiSetSpeed() {
  var pr = bnUiPref();
  pr.spd = pr.spd === 1 ? 2 : (pr.spd === 2 ? 4 : 1);
  if (bnu.P) bnPlSetSpeed(bnu.P, pr.spd);
  bnUiPrefSave(); bnUiSyncBtns();
}
function bnUiToggleAuto() {
  var pr = bnUiPref();
  pr.autoUlt = pr.autoUlt === 0 ? 1 : 0;
  if (bnu.P) bnu.P.S.opts.autoUlt = pr.autoUlt !== 0;
  bnUiPrefSave(); bnUiSyncBtns();
  bnUiToast(pr.autoUlt ? '大招自動施放' : '大招手動:士氣滿時點該角色');
}
function bnUiSkip() {
  if (bnu.phase !== 'fight' || !bnu.P || bnu.P.done) return;
  bnPlSkip(bnu.P);
}
function bnUiCvTap(e) {
  var P = bnu.P, id, r;
  if (bnu.phase !== 'fight' || !P || P.done || bnUiPref().autoUlt !== 0) return;
  r = bnu.cv.getBoundingClientRect ? bnu.cv.getBoundingClientRect() : { left: 0, top: 0 };
  id = bnPlHitUlt(P, (e.clientX || 0) - r.left, (e.clientY || 0) - r.top);
  if (id >= 0) { P.S.manualUlt[id] = true; bnUiToast(P.S.units[id].name + ' 準備發動大招'); }
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
  var S = bnu.P && bnu.P.S, d, h, w, d0, rep, g;
  if (!S || !S.result || bnu.phase === 'res') return;
  d = bnUiResultData(S);
  bnu.result = d;
  bnUiSetPhase('res');
  w = d.winner === 'A' ? '勝利' : (d.winner === 'B' ? '敗北' : '平手');
  h = '<div class="bnbox"><h2 style="color:' + (d.winner === 'A' ? '#ffd25a' : (d.winner === 'B' ? '#ff9a8a' : '#cfd6e0')) + '">' + w + '</h2>' +
    '<p style="font-size:26px;color:#ffd25a;letter-spacing:6px">' + (d.winner === 'A' ? '★'.repeat(d.stars) + '☆'.repeat(3 - d.stars) : '') + '</p>' +
    '<p>' + (d.reason === 'limit' ? '回合上限判定' : '全滅決勝') + ' · 共 ' + d.rounds + ' 回合 · 我方存活 ' + d.alive + '/' + d.total + '</p>' +
    (d.mvp ? '<p>本場 MVP:<b>' + bnUiEsc(d.mvp.name) + '</b><br>傷害 ' + d.mvp.dmg + ' · 治療 ' + d.mvp.heal + ' · 承傷 ' + d.mvp.taken + ' · 擊倒 ' + d.mvp.kills + '</p>' : '') +
    '@RW@' +
    '<div class="row"><button data-a="again" class="pri">再戰</button><button data-a="tomap">討伐地圖</button><button data-a="leave">離開</button></div></div>';
  // 戰績與獎勵(有值才寫)。討伐 / 流寇依 bn_stages 規則結算;練兵不計戰績、不給獎勵
  d0 = bnu.data || bnUiLoad();
  rep = null;
  g = bnu.stg || { kind: 'practice' };
  if (g.kind === 'stage' && typeof bnStgSettle === 'function') rep = bnStgSettle(d0, g.id, { winner: d.winner, stars: d.stars, seed: bnu.rec ? bnu.rec.seed : 0 }, bnStgEnv(BNUI.env));
  else if (g.kind === 'bounty' && typeof bnStgBountySettle === 'function') rep = bnStgBountySettle(d0, { winner: d.winner, ch: g.def ? g.def.ch : 1 }, bnStgEnv(BNUI.env));
  bnu.report = rep;
  h = h.replace('@RW@', rep ? bnMapRewardHtml(rep) : '<p style="opacity:.75;font-size:12px">練兵不計戰績、不給獎勵</p>');
  bnu.resEl.innerHTML = h;
  bnUiShowRes(true);
  d0.last = { stage: BNUI.stage, res: d.winner, rounds: d.rounds, stars: d.stars };
  bnUiCurSave(); bnUiSave();
  if (rep && rep.win && typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  if (bnu.P) bnPlSfxEnd(d.winner);
  bnUiDrawOnce();
}
function bnPlSfxEnd(w) { if (typeof sfxwPlay === 'function') { try { sfxwPlay(w === 'A' ? 'win' : (w === 'B' ? 'lose' : 'flag')); } catch (e) { /* 略過 */ } } }
function bnUiToForm() {
  if (bnu.P) { bnPlDispose(bnu.P); bnu.P = null; }
  bnUiStopLoop();
  bnUiShowRes(false); bnUiShowPause(false); bnUiCutRender(null);
  bnu.paused = false;
  bnUiSetPhase('form');
  bnUiRenderForm();
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
  // 撤退 = 結果平手、不計戰績
  bnUiShowPause(false);
  bnUiToForm();
}
function bnUiPause(on) {
  if (bnu.phase !== 'fight' || !bnu.P || bnu.P.done) { if (!on) bnUiShowPause(false); return; }
  if (on) {
    bnu.paused = true; bnUiStopLoop();
    bnu.pauseEl.innerHTML = '<div class="bnbox"><h2>暫停</h2><p>撤退不計戰績,回到布陣。</p><div class="row"><button class="pri" data-a="resume">繼續</button><button data-a="skip">略過</button><button data-a="retreat">撤退</button></div></div>';
    bnUiShowPause(true);
  } else {
    bnu.paused = false; bnUiShowPause(false);
    bnUiLoop(true);
  }
}
function bnUiBack() {
  if (bnu.leaving || !bnu.open) return false;
  if (bnu.phase === 'fight') { bnUiPause(!bnu.paused); return true; }
  if (bnu.phase === 'res') { bnUiToForm(); return true; }
  if (bnu.phase === 'form' && typeof bnMapRender === 'function') { bnUiToMap(); return true; }
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
  if (bnu.phase !== 'map' && !(bnu.phase === 'form' && typeof bnMapRender !== 'function')) {
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
  if (!bnUnlocked()) { bnUiToast(bnUiRosterList().length < BNUI.minRoster ? '名冊要有 ' + BNUI.minRoster + ' 人以上才能出戰' : '官階達「亭長」後開放戰鬥'); return false; }
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
  if (typeof bnMapRender === 'function') { bnUiSetPhase('map'); bnMapRender(); }
  else { bnUiSetPhase('form'); bnUiRenderForm(); }
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
    bnu.layer = null; bnu.cv = null; bnu.ctx = null; bnu.bar = null; bnu.top = null; bnu.backBtn = null; bnu.titleEl = null; bnu.subEl = null; bnu.roundEl = null; bnu.formEl = null; bnu.mapEl = null; bnu.resEl = null; bnu.pauseEl = null; bnu.cutEl = null; bnu.cutParts = null; bnu.strip = null; bnu.stripEls = []; bnu.btns = {};
    bnu.leaving = false; bnu.L = null;
    if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  }
  if (immediate || !layer || !layer.classList || typeof setTimeout !== 'function') done();
  else { layer.classList.remove('on'); setTimeout(done, BNUI.fadeMs + 20); }
  return true;
}
function bnUiStats() { return { draw: BNDR.stats, enterMs: BNUI.enterMs || 0, frames: bnu.frames }; }

if (typeof module !== 'undefined' && module.exports) module.exports = { BNUI: BNUI };
