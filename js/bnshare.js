// js/bnshare.js — 戰鬥 A 模式:對戰練習(挑戰碼 / 戰報碼,不需後端、不即時連線)。
// 「分享我的隊伍」把目前布陣 5 人壓成一串挑戰碼(可複製 / 分享連結 #bn=碼);「挑戰別人的隊伍」貼上碼 → 對方隊伍的複本(電腦操控)當敵方,用現有引擎與戰鬥畫面打一場;
// 「貼上戰報碼」用同一陣容與種子重打同一場,開啟現有文字戰報(bnlog.js)。練習戰不給獎勵、不計關卡進度、不改世界存檔(只多一筆「最近」戰報)。
// 碼格式:LDB2.<種類 T 隊伍 / R 戰報>.<資料版本>.<z 壓縮 / j 未壓縮>.<base64url>.<檢查碼>;資料版本 = 戰法 / 數值表 / 規則雜湊,與本機不同 → 拒絕(舊版規則的碼不能用)。
// 標準化模式(預設關,挑戰畫面開關):雙方品階倍率一律以紫階計、星等與信物歸零,只比配隊與戰法。偏好鍵 'lorddomain.bnshare.pref'(SAVE_PREF_KEYS,不隨世界)。
// 面板掛在 bnui.js 的 #bnLayer 內(#bnShare);Esc / 返回鍵先關面板(bnUiBack 先問 bnLogBack、再問 bnsBack)。不發聲。ES2017;不用 ?. ??。
// 我方快照:優先呼叫 bnteam.js 的 bnTeamSnapshot()(轉成碼格式的 U,順序仍依布陣 slots);缺或出錯時退回本檔依 bnu.slots + 名冊自行產生。
// 全域:BNS bnsOpen bnsClose bnsIsOpen bnsBack bnsBarBtn bnsDo bnsRender bnsOnResult bnsEncode bnsDecode bnsMyTeam bnsPackTeam bnsSpecs bnsDuelRec bnsFight bnsReplay bnsReportData bnsDataVer bnsPref bnsCheckHash

// LDB2(2026-11-06):單位陣列第 18 欄 = 研兵等級(兵書 / 傳授學到的戰法照舊在學習戰法欄);內層 v:2。
// 2026-11-09 決議(回合上限 50 → 10、新增機率閃避):不保留舊碼。格式版本(LDB?)或資料 / 規則版本(dv)與目前不同 → 一律拒絕,不再嘗試重打。
var BNS = {
  magic: 'LDB2', oldMsg: '這是舊版規則的碼,已不能使用,請對方用新版重新產生', drillPer: 0.02, drillMax: 5, eng: 1, maxIn: 8000, maxRaw: 32768, maxTeam: 3000, maxRep: 6000, stdGr: 3, prefKey: 'lorddomain.bnshare.pref',
  el: null, tab: 'share', inp: { chal: '', rep: '' }, msg: '', msgBad: false, busy: false, my: null, myCode: '', chk: null, last: null, rcode: '', duel: null, rep: null, dv: '', pref: null, n: 0, inv: null, invEl: null, invTry: 0
};
var BNS_GR = ['白', '青', '藍', '紫', '金'];
var BNS_ROW = ['前', '中', '後'];

function bnsEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bnsToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function bnsLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function bnsLsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function bnsInt(v, lo, hi, d) { return (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, Math.round(v))) : d; }
function bnsStr(v, n) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, n) : ''; }

// ───────── 偏好(標準化模式) ─────────
function bnsPref() {
  var raw, o = null;
  if (BNS.pref) return BNS.pref;
  raw = bnsLsGet(BNS.prefKey);
  if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  BNS.pref = { std: !!(o && o.std === 1) };
  return BNS.pref;
}
function bnsPrefSave() { bnsLsSet(BNS.prefKey, JSON.stringify({ std: bnsPref().std ? 1 : 0 })); }

// ───────── 資料版本(戰法 / 數值表 / 核心函式的雜湊;不同 = 舊版規則,拒絕) ─────────
function bnsDataVer() {
  var parts = ['e' + BNS.eng], tabs, fns;
  if (BNS.dv) return BNS.dv;
  try {
    tabs = [typeof BN_DATA !== 'undefined' ? BN_DATA : null, typeof BN_SKILLS !== 'undefined' ? BN_SKILLS : null, typeof BN_FIG_SKILLS !== 'undefined' ? BN_FIG_SKILLS : null,
      typeof BN_TRAIT_MODS !== 'undefined' ? BN_TRAIT_MODS : null, typeof BN_BONDS !== 'undefined' ? BN_BONDS : null, typeof BN_JOB_PRESET !== 'undefined' ? BN_JOB_PRESET : null,
      typeof BN_ULT_BY !== 'undefined' ? BN_ULT_BY : null, typeof BN_CARD_SKILL_MAP !== 'undefined' ? BN_CARD_SKILL_MAP : null, typeof BN_GENERIC !== 'undefined' ? BN_GENERIC : null,
      typeof CARD_FURNACE !== 'undefined' ? CARD_FURNACE.starBonus : null];
    fns = [typeof bnUnitSpec === 'function' ? bnUnitSpec : null, typeof bnBuildTeam === 'function' ? bnBuildTeam : null, typeof bnInit === 'function' ? bnInit : null, typeof bnHit === 'function' ? bnHit : null,
      typeof bnApplyDmg === 'function' ? bnApplyDmg : null, typeof bnAct === 'function' ? bnAct : null, typeof bnStartRound === 'function' ? bnStartRound : null, typeof bnEndRound === 'function' ? bnEndRound : null];
    parts.push(JSON.stringify(tabs));
    fns.forEach(function (f) { parts.push(f ? String(f) : '-'); });
  } catch (e) { parts.push('x'); }
  BNS.dv = bnHash.apply(null, parts).toString(36);
  return BNS.dv;
}

// ───────── 位元組 / base64url / 壓縮 ─────────
function bnsUtf8(s) {
  var b, i, out;
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(s);
  b = unescape(encodeURIComponent(s)); out = new Uint8Array(b.length);
  for (i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
function bnsUnUtf8(u8) {
  var s = '', i;
  if (typeof TextDecoder === 'function') return new TextDecoder('utf-8', { fatal: true }).decode(u8);
  for (i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return decodeURIComponent(escape(s));
}
function bnsB64(u8) {
  var s = '', i;
  for (i = 0; i < u8.length; i += 4096) s += String.fromCharCode.apply(null, Array.prototype.slice.call(u8, i, i + 4096));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function bnsUnB64(s) {
  var b, out, i;
  if (s.length % 4 === 1) return null;
  try { b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); } catch (e) { return null; }
  out = new Uint8Array(b.length);
  for (i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
// comp = true 壓縮、false 解壓;不支援或失敗回 null(解壓超過 maxRaw 位元組即中止,防壓縮炸彈)
function bnsZip(u8, comp) {
  var C = comp ? (typeof CompressionStream === 'function' ? CompressionStream : null) : (typeof DecompressionStream === 'function' ? DecompressionStream : null), st, w, rd, chunks = [], n = 0;
  if (!C) return Promise.resolve(null);
  try {
    st = new C('deflate'); w = st.writable.getWriter(); rd = st.readable.getReader();
    w.write(u8).then(function () { return w.close(); }).catch(function (e) { return e; });   // 寫入端錯誤會由讀取端 read() 拒絕回報
  } catch (e) { return Promise.resolve(null); }
  function pump() {
    return rd.read().then(function (r) {
      var out, off = 0;
      if (r.done) { out = new Uint8Array(n); chunks.forEach(function (c) { out.set(c, off); off += c.length; }); return out; }
      n += r.value.length;
      if (n > BNS.maxRaw) { rd.cancel().catch(function (e) { return e; }); return null; }
      chunks.push(r.value);
      return pump();
    });
  }
  return pump().catch(function () { return null; });
}

// ───────── 隊伍資料:名冊 entry → 單位快照 U → 碼內陣列 ─────────
// U = {fig, name, gr, fac, st[5], ja{職業:等級}, main, tr[詞條], tok, up, learn, star, lr[學習戰法(含兵書 / 傳授)], troop, row, col, sex, dr 研兵等級}
function bnsDrillPer() { return (typeof BNBOOK !== 'undefined' && BNBOOK.drillPer) || BNS.drillPer; }
function bnsDrillLv(sp) { return sp && sp.drill ? Math.round(sp.drill / bnsDrillPer()) : 0; }
function bnsTeamFromSnap(snap, slots) {
  var u = [], i, j, s, c, tr, nat;
  for (i = 0; i < slots.length && u.length < 5; i++) {
    s = slots[i];
    for (j = 0; j < snap.length; j++) if (snap[j].id === s.id && snap[j].row === s.row && snap[j].col === s.col) break;
    if (j >= snap.length) continue;
    c = snap[j].card || {};
    if (!Array.isArray(c.st)) continue;
    tr = snap[j].troop;
    nat = c.fig ? [] : bnNativeSkills(c, tr);
    u.push({
      fig: c.fig || '', name: String(c.name || ''), gr: c.gr | 0, fac: c.fac | 0, st: c.st.slice(), ja: Object.assign({}, c.ja || {}), main: c.main || '', tr: (c.tr || []).slice(),
      tok: c.tok | 0, up: c.up | 0, learn: c.learn | 0, star: c.starLv | 0, lr: c.fig ? [] : snap[j].skills.filter(function (id) { return nat.indexOf(id) < 0; }), troop: tr, row: s.row | 0, col: s.col | 0, sex: c.sex || '',
      dr: snap[j].drillLv !== undefined ? snap[j].drillLv | 0 : bnsDrillLv(snap[j].spec)
    });
  }
  return u;
}
function bnsMyTeam() {
  var slots = (typeof bnu !== 'undefined' && bnu.slots) || [], u = [], i, s, e, tr, sp, nat, snap = null;
  if (typeof bnTeamSnapshot === 'function') { try { snap = bnTeamSnapshot(); } catch (er) { snap = null; } }
  if (snap) return { u: bnsTeamFromSnap(snap, slots) };
  for (i = 0; i < slots.length && u.length < 5; i++) {
    s = slots[i]; e = typeof bnUiEntry === 'function' ? bnUiEntry(s.id) : null;
    if (!e || !Array.isArray(e.st)) continue;
    tr = s.troop || (bnu.tp && bnu.tp[s.id]) || bnDefaultTroop(e);
    sp = bnUnitSpec(e, { troop: tr, row: s.row, col: s.col });
    nat = e.fig ? [] : bnNativeSkills(e, tr);
    u.push({
      fig: e.fig || '', name: String(e.name || ''), gr: e.gr | 0, fac: e.fac | 0, st: e.st.slice(), ja: Object.assign({}, e.ja || {}), main: e.main || '', tr: (e.tr || []).slice(),
      tok: e.tok | 0, up: e.up | 0, learn: e.learn | 0, star: e.starLv | 0, lr: e.fig ? [] : sp.skills.filter(function (id) { return nat.indexOf(id) < 0; }), troop: tr, row: s.row | 0, col: s.col | 0, sex: e.sex || '',
      dr: bnsDrillLv(sp)
    });
  }
  return { u: u };
}
function bnsTeamCheck(t) {
  if (!t || !t.u.length) return '請先在布陣放好你的隊伍(至少 1 人)';
  if (!t.u.some(function (x) { return x.row === 0; })) return '你的隊伍前排至少要有 1 人';
  return '';
}
function bnsPackTeam(t) {
  return { v: 2, u: t.u.map(function (U) { return [U.fig, U.name, U.gr, U.fac, U.st, Object.keys(U.ja).map(function (k) { return [k, U.ja[k]]; }), U.main, U.tr, U.tok, U.up, U.learn, U.star, U.lr, U.troop, U.row, U.col, U.sex, U.dr | 0]; }) };
}
// 碼內陣列 → U(驗證 / 夾值;不認識的名人 / 戰法 / 職業 / 詞條略過並記入 warn)
function bnsNormUnit(a, warn) {
  var U, st, i, k, lv, nm, bad = 0;
  if (!Array.isArray(a) || a.length < 16 || !Array.isArray(a[4]) || a[4].length !== 5) return null;
  st = a[4].map(function (v) { return bnsInt(v, 0, 130, -1); });
  if (st.some(function (v) { return v < 0; })) return null;
  nm = bnsStr(a[1], 12) || '無名';
  U = { fig: bnsStr(a[0], 24), name: nm, gr: bnsInt(a[2], 0, 4, 0), fac: bnsInt(a[3], 0, 4, 4), st: st, ja: {}, main: '', tr: [], tok: bnsInt(a[8], 0, (typeof CARD_CFG !== 'undefined' && CARD_CFG.tokMax) || 5, 0),
    up: bnsInt(a[9], 0, (typeof CARD_CFG !== 'undefined' && CARD_CFG.upMax) || 2, 0), learn: bnsInt(a[10], 0, 3, 0), star: bnsInt(a[11], 0, (typeof CARD_FURNACE !== 'undefined' && CARD_FURNACE.starMax) || 5, 0),
    lr: [], troop: '', row: bnsInt(a[14], 0, 2, -1), col: bnsInt(a[15], 0, 2, -1), sex: a[16] === 'f' ? 'f' : 'm', dr: bnsInt(a[17], 0, (typeof BNBOOK !== 'undefined' && BNBOOK.drillMax) || BNS.drillMax, 0) };
  if (U.row < 0 || U.col < 0) return null;
  if (U.fig && !((typeof CARD_FIG_BY_ID === 'undefined' || CARD_FIG_BY_ID[U.fig]) && typeof BN_FIG_SKILLS !== 'undefined' && BN_FIG_SKILLS[U.fig])) { warn.push('不認識的名人「' + nm + '」,改用一般武將計算'); U.fig = ''; }
  if (Array.isArray(a[5])) for (i = 0; i < a[5].length && i < 12; i++) {
    k = Array.isArray(a[5][i]) ? a[5][i][0] : null; lv = Array.isArray(a[5][i]) ? a[5][i][1] : 0;
    if (typeof k === 'string' && (typeof CARD_JOB_BY_ID === 'undefined' || CARD_JOB_BY_ID[k])) U.ja[k] = bnsInt(lv, 1, 4, 1); else bad++;
  }
  U.main = (typeof a[6] === 'string' && U.ja[a[6]]) ? a[6] : (Object.keys(U.ja)[0] || '');
  if (Array.isArray(a[7])) a[7].slice(0, 8).forEach(function (id) { if (typeof id === 'string' && (typeof CARD_TRAIT_BY_ID === 'undefined' || CARD_TRAIT_BY_ID[id])) U.tr.push(id); else bad++; });
  if (Array.isArray(a[12])) a[12].slice(0, 6).forEach(function (id) {
    if (typeof id === 'string' && BN_SKILLS[id] && BN_SKILLS[id].cat !== 'ult' && U.lr.indexOf(id) < 0) U.lr.push(id);
    else warn.push('「' + nm + '」有不認識的戰法,已略過');
  });
  if (bad) warn.push('「' + nm + '」有 ' + bad + ' 項不認識的職業或詞條,已略過');
  U.troop = bnTroopNorm(a[13]);
  return U;
}
function bnsNormTeam(o, warn) {
  var u = [], used = {}, i, U;
  if (!o || typeof o !== 'object' || o.v !== 2 || !Array.isArray(o.u)) return { ok: false, why: '隊伍資料不完整' };
  if (o.u.length < 1 || o.u.length > 5) return { ok: false, why: '隊伍人數不對(要 1~5 人)' };
  for (i = 0; i < o.u.length; i++) {
    U = bnsNormUnit(o.u[i], warn);
    if (!U) return { ok: false, why: '隊伍資料不完整(第 ' + (i + 1) + ' 人)' };
    if (used[U.row + ':' + U.col]) return { ok: false, why: '隊伍站位重複,碼可能被改過' };
    used[U.row + ':' + U.col] = 1;
    u.push(U);
  }
  return { ok: true, team: { u: u } };
}

// ───────── U → 單位規格(std = 標準化模式) ─────────
function bnsCard(U, std) {
  return { slot: 0, fig: U.fig || null, sex: U.sex, name: U.name, zi: '', fac: U.fac, gr: std ? BNS.stdGr : U.gr, st: U.st.slice(), ja: Object.assign({}, U.ja), main: U.main || null, learn: U.learn, tr: U.tr.slice(),
    tok: std ? 0 : U.tok, up: U.up, starLv: std ? 0 : U.star, bnLearn: U.lr.slice() };
}
function bnsSpecs(t, std) {
  return t.u.map(function (U) {
    var c = bnsCard(U, std), tr = U.troop || bnDefaultTroop(c);
    return bnUnitSpec(c, { troop: tr, row: U.row, col: U.col, learned: c.fig ? null : c.bnLearn, drill: std ? 0 : (U.dr | 0) * bnsDrillPer() });   // 研兵照碼(標準化模式歸零)
  });
}
function bnsPower(specs) { var p = 0; specs.forEach(function (s) { p += bnPower(s); }); return p; }
// 開戰紀錄(與 bnui.js bnUiRec 同形);A = 我方(挑戰者)、B = 對方複本
function bnsDuelRec(A, B, std, seed) {
  var a = bnBuildTeam(bnsSpecs(A, std)), b = bnBuildTeam(bnsSpecs(B, std));
  return { v: 1, seed: seed >>> 0, teamA: a.units, teamB: b.units, opts: { events: true, scene: '' },
    meta: { stage: 'D', kind: 'duel', ch: 0, foePower: bnsPower(b.units), scale: 1, bonds: a.bonds, formation: a.formation, std: std ? 1 : 0 } };
}

// ───────── 編碼 / 解碼 ─────────
function bnsEncode(kind, obj) {
  var raw = bnsUtf8(JSON.stringify(obj));
  return bnsZip(raw, true).then(function (z) {
    var m = (z && z.length < raw.length) ? 'z' : 'j', b = bnsB64(m === 'z' ? z : raw), dv = bnsDataVer();
    return [BNS.magic, kind, dv, m, b, bnHash(kind, dv, m, b).toString(36)].join('.');
  });
}
// 從貼上的文字取出碼(可含連結 #bn=…、前後雜字與換行)
function bnsExtract(t) {
  var s = String(t === undefined || t === null ? '' : t), i, m;
  if (s.length > BNS.maxIn * 4) return { s: '', big: true };
  i = s.indexOf('#bn=');
  if (i >= 0) { s = s.slice(i + 4); try { s = decodeURIComponent(s); } catch (e) { /* 原字串照用 */ } }
  s = s.replace(/\s+/g, '');
  if (s.length > BNS.maxIn) return { s: '', big: true };
  i = s.indexOf('LDB');
  if (i > 0) s = s.slice(i);
  m = /^[A-Za-z0-9._-]+/.exec(s);
  return { s: m ? m[0] : s, big: false };
}
// 回 Promise {ok, why, kind 'T'|'R', dv, same, warn[], team?, rep?}
function bnsDecode(txt) {
  var out = { ok: false, why: '', kind: '', dv: '', same: true, warn: [] }, x, p, bytes;
  function fail(w) { out.why = w; return Promise.resolve(out); }
  try {
    x = bnsExtract(txt);
    if (x.big) return fail('內容太長了(上限 ' + BNS.maxIn + ' 字),請確認貼的是對戰練習的碼');
    if (!x.s) return fail('請先貼上碼');
    p = x.s.split('.');
    if (!/^LDB\d+$/.test(p[0])) return fail('這不是對戰練習的碼');
    if (p[0] !== BNS.magic) return fail(BNS.oldMsg);
    if (p.length !== 6) return fail('碼不完整,可能沒複製完全');
    if (p[1] !== 'T' && p[1] !== 'R') return fail('看不懂這個碼的種類');
    if (!/^[0-9a-z]{1,8}$/.test(p[2]) || (p[3] !== 'z' && p[3] !== 'j') || !/^[A-Za-z0-9_-]+$/.test(p[4])) return fail('碼的格式不對,可能沒複製完全');
    if (bnHash(p[1], p[2], p[3], p[4]).toString(36) !== p[5]) return fail('碼不完整或被改過(檢查碼不符),請重新複製一次');
    if (p[2] !== bnsDataVer()) return fail(BNS.oldMsg);   // 規則 / 數值版本不同:一律拒絕(2026-11-09 決議:不保留舊碼)
    bytes = bnsUnB64(p[4]);
    if (!bytes) return fail('碼已損壞,讀不了');
  } catch (e) { return fail('碼已損壞,讀不了'); }
  out.kind = p[1]; out.dv = p[2]; out.same = p[2] === bnsDataVer();
  return (p[3] === 'z' ? bnsZip(bytes, false) : Promise.resolve(bytes)).then(function (u8) {
    var o, t, A, B;
    if (!u8) { out.why = (typeof DecompressionStream !== 'function') ? '這台裝置的瀏覽器太舊,解不開這個碼' : '碼已損壞,讀不了'; return out; }
    if (u8.length > BNS.maxRaw) { out.why = '碼的內容太大,讀不了'; return out; }
    try { o = JSON.parse(bnsUnUtf8(u8)); } catch (e) { out.why = '碼已損壞,讀不了'; return out; }
    if (out.kind === 'T') {
      t = bnsNormTeam(o, out.warn);
      if (!t.ok) { out.why = t.why; return out; }
      out.team = t.team;
    } else {
      if (!o || o.v !== 2 || typeof o.s !== 'number') { out.why = '戰報資料不完整'; return out; }
      A = bnsNormTeam(o.A, out.warn); B = bnsNormTeam(o.B, out.warn);
      if (!A.ok || !B.ok) { out.why = '戰報裡的隊伍資料不完整'; return out; }
      out.rep = { s: o.s >>> 0, m: o.m === 1 ? 1 : 0, A: A.team, B: B.team, w: (o.w === 'A' || o.w === 'B') ? o.w : 'draw', r: bnsInt(o.r, 0, 99, 0), h: typeof o.h === 'number' ? o.h >>> 0 : -1, ne: bnsInt(o.ne, 0, 1e6, 0) };
    }
    out.warn = out.warn.filter(function (w, i) { return out.warn.indexOf(w) === i; }).slice(0, 8);
    out.ok = true;
    return out;
  }).catch(function () { out.why = '碼已損壞,讀不了'; return out; });
}
function bnsReportData(L) { return { v: 2, s: L.s >>> 0, m: L.m ? 1 : 0, A: bnsPackTeam(L.A), B: bnsPackTeam(L.B), w: L.w, r: L.r, h: L.h >>> 0, ne: L.ne }; }

// ───────── 重播戰報碼:同陣容同種子重打 → 記入最近戰報 → 回 {ok, same, id, res, warn} ─────────
function bnsStarsOf(S) {
  var r = S.result, n = 0;
  if (r.winner !== 'A') return 0;
  n = 1; if (r.deadA === 0) n++; if (r.reason === 'wipe' && r.rounds <= 5) n++;
  return n;
}
function bnsReplay(txt) {
  return bnsDecode(txt).then(function (d) {
    var R, rec, S, en, same, lg;
    if (!d.ok) return { ok: false, why: d.why };
    if (d.kind !== 'R') return { ok: false, why: '這是挑戰碼,請到「挑戰別人的隊伍」貼上' };
    R = d.rep;
    try {
      rec = bnsDuelRec(R.A, R.B, R.m, R.s);
      S = bnRun(JSON.parse(JSON.stringify(rec)));
      en = bnLogEncode(S.events);
    } catch (e) { return { ok: false, why: '重打時發生問題,這個戰報碼可能不相容' }; }
    same = en.h === R.h && S.result.winner === R.w && S.result.rounds === R.r;
    lg = bnLogBuild(S, rec, { label: '戰報碼重播' + (R.m ? '(標準化)' : ''), kind: 'duel', sid: '對戰練習', stars: R.A.u.map(function (U) { return R.m ? 0 : U.star; }), res: { w: S.result.winner, why: S.result.reason, r: S.result.rounds, st: bnsStarsOf(S) } });
    bnLogRecord(lg, rec);
    return { ok: true, same: same, id: lg.id, res: S.result, orig: { w: R.w, r: R.r }, warn: d.warn, sameVer: d.same };
  });
}

// ───────── 開打(沿用 bnui.js 戰鬥畫面流程;練習戰 bnu.stg.kind = 'duel':不給獎勵、不計進度) ─────────
function bnsFight(D) {
  var rec, S, P, hk, d0;
  if (typeof bnu === 'undefined' || !bnu.open || !bnu.layer) return false;
  rec = bnsDuelRec(D.A, D.B, D.m, D.s);
  d0 = bnu.data || bnUiLoad();
  bnsClose();
  if (typeof bnLogClose === 'function') bnLogClose();
  if (bnu.P) { bnPlDispose(bnu.P); bnu.P = null; }
  bnUiStopLoop();
  BNS.duel = { A: D.A, B: D.B, m: D.m ? 1 : 0, s: D.s >>> 0, keepLast: d0.last ? JSON.parse(JSON.stringify(d0.last)) : null };
  bnu.stg = { kind: 'duel', id: 'D' }; BNUI.stage = 'D';
  bnu.rec = rec;
  S = bnInit(rec);
  bnUiSetPhase('fight');
  if (bnu.titleEl) bnu.titleEl.textContent = '對戰練習' + (D.m ? '(標準化)' : '');
  bnUiShowRes(false); bnUiShowPause(false); bnUiCutRender(null);
  bnUiResize();
  hk = bnUiHooks();
  P = bnPlNew(S, bnu.L, { speed: bnUiPref().spd, hooks: hk, powerSave: bnUiPs(), sfx: true });
  bnu.P = P; bnu.result = null; bnu.paused = false; bnu.retreat = false; bnu.manual = false; bnu.logId = '';
  bnUiSyncBtns();
  if (bnu.roundEl) bnu.roundEl.textContent = '';
  bnUiResize();
  bnUiLoop(true);
  return true;
}
// bnui.js bnUiShowResult 結尾呼叫:對戰練習才處理 —— 還原戰績欄、改戰報標籤、改結算按鈕、留下戰報碼資料
function bnsOnResult(d) {
  var D = BNS.duel, g = (typeof bnu !== 'undefined') ? bnu.stg : null, S, d0, en = null, L, h, row, re;
  if (!D || !g || g.kind !== 'duel') return false;
  S = bnu.P && bnu.P.S;
  BNS.duel = null;
  d0 = bnu.data || bnUiLoad();
  d0.last = D.keepLast;
  bnUiSave();
  try { en = S && S.events ? bnLogEncode(S.events) : null; } catch (e) { en = null; }
  BNS.last = (d.reason === 'retreat' || !en) ? null : { A: D.A, B: D.B, m: D.m, s: D.s, w: d.winner, r: d.rounds, h: en.h >>> 0, ne: en.n };
  BNS.rcode = '';
  if (bnu.logId && typeof bnLogLoad === 'function') {
    L = bnLogLoad();
    L.recent.forEach(function (r) { if (r.id === bnu.logId) { r.lb = '對戰練習' + (D.m ? '(標準化)' : ''); r.kind = 'duel'; r.sid = '對戰練習'; } });
    bnLogStore(L);
  }
  if (bnu.resEl) {
    h = bnu.resEl.innerHTML;
    h = h.replace(/<p[^>]*>練兵不計戰績、不給獎勵<\/p>/, '<p class="bs-rn">對戰練習:只看勝負與戰報,不給獎勵、不計進度' + (D.m ? '(標準化模式)' : '') + '</p>');
    // 結算只留「查看戰報 / 離開」(bnui.js);分享戰報碼改在戰報檢視面板(bnlog.js data-l="share")
    row = '';
    re = null;
    bnu.resEl.innerHTML = h;
    if (!bnu.resEl.bnsOn) { bnu.resEl.addEventListener('click', bnsResClick); bnu.resEl.bnsOn = 1; }
  }
  BNS.again = { A: D.A, B: D.B, m: D.m };
  bnu.stg = { kind: 'practice', id: 'P' }; BNUI.stage = 'P';
  return true;
}
function bnsResClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-bns]') : null;
  if (!b) return;
  if (e.stopPropagation) e.stopPropagation();
  bnsDo(b.getAttribute('data-bns'));
}

// ───────── 面板 ─────────
function bnsIsOpen() { return !!(BNS.el && BNS.el.parentNode); }
function bnsBarBtn() {
  return bnUiBtn('對戰', '對戰練習', function () { bnsOpen('share'); }, 'nf ne');
}
function bnsOpen(tab, code) {
  var host = (typeof bnu !== 'undefined' && bnu.open && bnu.layer) || null, el;
  if (!host || typeof document === 'undefined') return false;
  if (bnu.phase === 'fight') return false;
  if (!bnsIsOpen()) {
    el = document.createElement('div'); el.id = 'bnShare';
    el.addEventListener('click', bnsOnClick);
    el.addEventListener('input', bnsOnInput);
    host.appendChild(el);
    BNS.el = el;
  }
  BNS.tab = (tab === 'chal' || tab === 'rep' || tab === 'rout') ? tab : 'share';
  BNS.msg = ''; BNS.msgBad = false;
  if (code && BNS.tab === 'chal') { BNS.inp.chal = String(code).slice(0, BNS.maxIn); BNS.chk = null; }
  if (code && BNS.tab === 'rep') BNS.inp.rep = String(code).slice(0, BNS.maxIn);
  bnsRender();
  if (BNS.tab === 'share') return bnsMakeMy();
  if (code && BNS.tab === 'chal') return bnsDo('check');
  if (code && BNS.tab === 'rep') return bnsDo('replay');
  return Promise.resolve(true);
}
function bnsClose() {
  var el = BNS.el;
  if (!el) return false;
  el.removeEventListener('click', bnsOnClick);
  el.removeEventListener('input', bnsOnInput);
  if (el.parentNode) el.parentNode.removeChild(el);
  BNS.el = null; BNS.msg = '';
  return true;
}
function bnsBack() { if (!bnsIsOpen()) { BNS.el = null; return false; } bnsClose(); return true; }
function bnsOnClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-s]') : null;
  if (e && e.stopPropagation) e.stopPropagation();
  if (b && !b.disabled) bnsDo(b.getAttribute('data-s'), b.getAttribute('data-t'));
}
function bnsOnInput(e) {
  var t = e && e.target;
  if (!t || typeof t.value !== 'string') return;
  if (t.id === 'bnsIn') { BNS.inp.chal = t.value.slice(0, BNS.maxIn); BNS.chk = null; }
  else if (t.id === 'bnsRep') BNS.inp.rep = t.value.slice(0, BNS.maxIn);
}
function bnsSay(m, bad) { BNS.msg = m; BNS.msgBad = !!bad; }
function bnsGetIn(id, key) {
  var el = typeof document !== 'undefined' && document.getElementById ? document.getElementById(id) : null;
  if (el && typeof el.value === 'string') BNS.inp[key] = el.value.slice(0, BNS.maxIn);
  return BNS.inp[key];
}
function bnsMakeMy() {
  var t = bnsMyTeam(), why = bnsTeamCheck(t);
  BNS.my = t; BNS.myCode = '';
  if (why) { bnsSay(why, true); bnsRender(); return Promise.resolve(false); }
  return bnsEncode('T', bnsPackTeam(t)).then(function (c) {
    if (c.length > BNS.maxTeam) { bnsSay('隊伍資料太大,做不出挑戰碼', true); c = ''; }
    BNS.myCode = c;
    if (bnsIsOpen() && BNS.tab === 'share') bnsRender();
    return !!c;
  });
}
function bnsCopy(txt, taId) {
  function ok() { bnsSay('已複製到剪貼簿'); bnsRender(); }
  function fail() {
    var ta;
    bnsSay('沒辦法自動複製,請長按下方文字框「全選」後複製', true); bnsRender();
    ta = typeof document !== 'undefined' && document.getElementById ? document.getElementById(taId) : null;
    try { if (ta && ta.focus) { ta.focus(); ta.select(); } } catch (e) { /* 選取失敗時使用者可手動選 */ }
  }
  if (!txt) return Promise.resolve(false);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function () { ok(); return true; }, function () { fail(); return false; });
  } catch (e) { /* 改走手動複製 */ }
  fail();
  return Promise.resolve(false);
}
function bnsLinkOf(code) {
  var base = '';
  try { base = String(location.href).split('#')[0]; } catch (e) { base = ''; }
  return base + '#bn=' + code;
}
function bnsShareLink() {
  var url = bnsLinkOf(BNS.myCode);
  if (!BNS.myCode) return Promise.resolve(false);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      return navigator.share({ title: '城主領地 對戰練習', text: '來挑戰我的隊伍!', url: url }).then(function () { return true; }, function (e) {
        if (e && e.name === 'AbortError') return false;
        return bnsCopy(url, 'bnsMyCode');
      });
    }
  } catch (e) { /* 改用複製連結 */ }
  return bnsCopy(url, 'bnsMyCode');
}
// 動作:tab(t) close copy link check clr std go replay rclr rcode rcopy again
function bnsDo(a, t) {
  var txt, my, why, pr;
  if (a === 'close') { bnsClose(); return Promise.resolve(true); }
  if (a === 'tab') { BNS.tab = (t === 'chal' || t === 'rep') ? t : 'share'; bnsSay(''); bnsRender(); return BNS.tab === 'share' ? bnsMakeMy() : Promise.resolve(true); }
  if (a === 'copy') return bnsCopy(BNS.myCode, 'bnsMyCode');
  if (a === 'link') return bnsShareLink();
  if (a === 'rcopy') return bnsCopy(BNS.rcode, 'bnsRCode');
  if (a === 'std') { pr = bnsPref(); pr.std = !pr.std; bnsPrefSave(); bnsRender(); return Promise.resolve(true); }
  if (a === 'clr') { BNS.inp.chal = ''; BNS.chk = null; bnsSay(''); bnsRender(); return Promise.resolve(true); }
  if (a === 'relog') { if (BNS.rep && BNS.rep.ok && typeof bnLogOpen === 'function') bnLogOpen('recent', BNS.rep.id); return Promise.resolve(true); }
  if (a === 'rclr') { BNS.inp.rep = ''; BNS.rep = null; bnsSay(''); bnsRender(); return Promise.resolve(true); }
  if (BNS.busy) return Promise.resolve(false);
  if (a === 'check') {
    txt = t !== undefined && t !== null ? String(t) : bnsGetIn('bnsIn', 'chal');
    if (t !== undefined && t !== null) BNS.inp.chal = txt.slice(0, BNS.maxIn);
    BNS.busy = true; BNS.chk = null; bnsSay('檢查中…'); bnsRender();
    return bnsDecode(txt).then(function (d) {
      BNS.busy = false;
      if (d.ok && d.kind === 'R') { d.ok = false; d.why = '這是戰報碼,請到「貼上戰報碼」貼上'; }
      if (d.ok) { BNS.chk = d; bnsSay('讀取成功,可以開始對戰'); } else bnsSay(d.why, true);
      bnsRender();
      return d.ok;
    });
  }
  if (a === 'go') {
    if (!BNS.chk || !BNS.chk.team) { bnsSay('請先貼上挑戰碼並按「檢查」', true); bnsRender(); return Promise.resolve(false); }
    my = bnsMyTeam(); why = bnsTeamCheck(my);
    if (why) { bnsSay(why, true); bnsRender(); return Promise.resolve(false); }
    return Promise.resolve(bnsFight({ A: my, B: BNS.chk.team, m: bnsPref().std ? 1 : 0, s: bnHash('duel', Date.now(), BNS.n++, my.u.length) }));
  }
  if (a === 'again') {
    if (!BNS.again) return Promise.resolve(false);
    return Promise.resolve(bnsFight({ A: BNS.again.A, B: BNS.again.B, m: BNS.again.m, s: bnHash('duel', Date.now(), BNS.n++, 'again') }));
  }
  if (a === 'rcode') {
    if (!BNS.last) { bnsToast('這場沒有戰報碼'); return Promise.resolve(false); }
    BNS.busy = true;
    return bnsEncode('R', bnsReportData(BNS.last)).then(function (c) {
      BNS.busy = false;
      BNS.rcode = c.length > BNS.maxRep ? '' : c;
      bnsOpen('rout');
      if (!BNS.rcode) { bnsSay('這場的戰報碼太大,做不出來', true); bnsRender(); }
      return !!BNS.rcode;
    });
  }
  if (a === 'replay') {
    txt = t !== undefined && t !== null ? String(t) : bnsGetIn('bnsRep', 'rep');
    if (t !== undefined && t !== null) BNS.inp.rep = txt.slice(0, BNS.maxIn);
    BNS.busy = true; BNS.rep = null; bnsSay('重打中…'); bnsRender();
    return bnsReplay(txt).then(function (r) {
      BNS.busy = false; BNS.rep = r;
      if (!r.ok) { bnsSay(r.why, true); bnsRender(); return false; }
      bnsSay(r.same ? '重打結果和原本那場完全一致' : '重打結果和原本那場不同(雙方遊戲版本或數值可能不同)', !r.same);
      bnsRender();
      if (typeof bnLogOpen === 'function') bnLogOpen('recent', r.id);
      return true;
    }, function () { BNS.busy = false; bnsSay('重打時發生問題', true); bnsRender(); return false; });
  }
  return Promise.resolve(false);
}

function bnsTeamHtml(t, std) {
  var specs;
  try { specs = bnsSpecs(t, std); } catch (e) { return '<p class="bs-warn">隊伍資料無法顯示</p>'; }
  return specs.map(function (sp, i) {
    var U = t.u[i], sk = sp.skills.concat(sp.ult ? [sp.ult] : []).map(function (id) { return BN_SKILLS[id] ? BN_SKILLS[id].name : ''; }).filter(Boolean);
    return '<div class="bs-u"><b class="g' + (std ? BNS.stdGr : U.gr) + '">' + bnsEsc(U.name) + '</b> <small>' + BNS_GR[std ? BNS.stdGr : U.gr] + '階' + ((std ? 0 : U.star) ? ' ★' + U.star : '') + ' · ' + bnsEsc(sp.troop) + ' · ' + BNS_ROW[U.row] + '排' + (U.col + 1) + ' · 戰力 ' + bnPower(sp) + '</small><br><small>戰法:' + bnsEsc(sk.join('、')) + '</small></div>';
  }).join('') + '<p class="bs-sm">合計戰力 <b>' + bnsPower(specs) + '</b></p>';
}
function bnsRender() {
  var el = BNS.el, h = '', tb = BNS.tab, pr = bnsPref(), c, my, why;
  if (!el) return;
  h += '<div class="bs-h"><b>對戰練習</b><button data-s="close" aria-label="關閉">✕</button></div><div class="bs-b"><div class="bs-in">';
  if (tb !== 'rout') h += '<div class="bs-tabs">' + [['share', '分享我的隊伍'], ['chal', '挑戰別人的隊伍'], ['rep', '貼上戰報碼']].map(function (x) { return '<button data-s="tab" data-t="' + x[0] + '"' + (tb === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>';
  if (tb === 'share') {
    my = BNS.my || bnsMyTeam();
    h += '<p class="bs-sm">把目前布陣的隊伍做成「挑戰碼」傳給朋友。朋友貼上後,會跟你這支隊伍的複本(電腦操控)打一場練習戰。不需要連線。</p><div class="bs-cols"><div>' +
      (my.u.length ? bnsTeamHtml(my, false) : '<p class="bs-warn">目前沒有上陣的人</p>') + '</div><div>' +
      '<textarea id="bnsMyCode" class="bs-code" readonly rows="4" aria-label="我的挑戰碼">' + bnsEsc(BNS.myCode || (BNS.msgBad ? '' : '產生中…')) + '</textarea>' +
      (BNS.myCode ? '<p class="bs-sm">碼長 ' + BNS.myCode.length + ' 字</p>' : '') +
      '<div class="bs-row"><button class="pri" data-s="copy"' + (BNS.myCode ? '' : ' disabled') + '>複製挑戰碼</button><button data-s="link"' + (BNS.myCode ? '' : ' disabled') + '>分享連結</button></div></div></div>';
  } else if (tb === 'chal') {
    c = BNS.chk;
    my = bnsMyTeam(); why = bnsTeamCheck(my);
    h += '<p class="bs-sm">把朋友給的挑戰碼(或連結)貼在下面,按「檢查」。對方隊伍由電腦操控,跟你目前布陣的隊伍對打。練習戰不給獎勵、不計進度。</p><div class="bs-cols"><div>' +
      '<textarea id="bnsIn" rows="4" maxlength="' + BNS.maxIn + '" placeholder="把挑戰碼貼在這裡" aria-label="挑戰碼">' + bnsEsc(BNS.inp.chal) + '</textarea>' +
      '<div class="bs-row"><button data-s="check" class="pri">檢查</button><button data-s="clr">清除</button></div>' +
      '<button class="bs-tg' + (pr.std ? ' on' : '') + '" data-s="std" aria-pressed="' + (pr.std ? 'true' : 'false') + '">標準化模式:' + (pr.std ? '開' : '關') + '</button>' +
      '<p class="bs-sm">開啟後,雙方的品階都當紫階算、星等和信物都歸零,只比配隊和戰法。</p></div><div>';
    if (c && c.team) {
      h += c.warn.map(function (w) { return '<p class="bs-warn">' + bnsEsc(w) + '</p>'; }).join('') + '<p class="bs-p">對方隊伍(電腦操控):</p>' + bnsTeamHtml(c.team, pr.std) +
        '<p class="bs-p">我方:目前布陣 ' + my.u.length + ' 人' + (my.u.length ? ' · 戰力 ' + bnsPower(bnsSpecs(my, pr.std)) : '') + '</p>' + (why ? '<p class="bs-warn">' + bnsEsc(why) + '</p>' : '') +
        '<div class="bs-row"><button class="pri" data-s="go"' + (why ? ' disabled' : '') + '>開始對戰</button></div>';
    }
    h += '</div></div>';
  } else if (tb === 'rep') {
    h += '<p class="bs-sm">把朋友給的戰報碼貼在下面。會用同一組隊伍和同一個亂數種子重打一次,再打開文字戰報(戰報裡的「我」= 產生戰報碼的那一方)。</p>' +
      '<textarea id="bnsRep" rows="4" maxlength="' + BNS.maxIn + '" placeholder="把戰報碼貼在這裡" aria-label="戰報碼">' + bnsEsc(BNS.inp.rep) + '</textarea>' +
      '<div class="bs-row"><button data-s="replay" class="pri">重播並看戰報</button><button data-s="rclr">清除</button></div>' +
      (BNS.rep && BNS.rep.ok ? (BNS.rep.warn || []).map(function (w) { return '<p class="bs-warn">' + bnsEsc(w) + '</p>'; }).join('') + '<p class="bs-p">結果:' + (BNS.rep.res.winner === 'A' ? '分享者勝' : (BNS.rep.res.winner === 'B' ? '分享者敗' : '平手')) + ' · ' + BNS.rep.res.rounds + ' 回合</p><div class="bs-row"><button data-s="relog">再看一次戰報</button></div>' : '');
  } else {
    h += '<p class="bs-p">這場的戰報碼:</p><textarea id="bnsRCode" class="bs-code" readonly rows="5" aria-label="戰報碼">' + bnsEsc(BNS.rcode) + '</textarea>' +
      (BNS.rcode ? '<p class="bs-sm">碼長 ' + BNS.rcode.length + ' 字。朋友在「對戰練習 → 貼上戰報碼」貼上,就能重看同一場。</p>' : '') +
      '<div class="bs-row"><button class="pri" data-s="rcopy"' + (BNS.rcode ? '' : ' disabled') + '>複製戰報碼</button><button data-s="close">關閉</button></div>';
  }
  h += '<p class="bs-msg' + (BNS.msgBad ? ' bs-err' : '') + '" role="status">' + bnsEsc(BNS.msg) + '</p></div></div>';
  el.innerHTML = h;
}

// ───────── 收到連結 #bn=碼:提示「收到挑戰隊伍」,不自動執行 ─────────
function bnsCheckHash() {
  var h = '', i, code;
  try { h = String(location.hash || ''); } catch (e) { h = ''; }
  i = h.indexOf('bn=');
  if (i < 0) return false;
  code = h.slice(i + 3);
  try { history.replaceState(null, '', String(location.href).split('#')[0]); } catch (e) { /* 舊瀏覽器:保留網址片段 */ }
  if (code.length > BNS.maxIn * 3) return false;
  try { code = decodeURIComponent(code); } catch (e) { /* 原字串照用 */ }
  if (!/^LDB/.test(code)) return false;
  BNS.inv = code.slice(0, BNS.maxIn); BNS.invTry = 0;
  bnsInvWait();
  return true;
}
function bnsInvWait() {
  if (!BNS.inv) return;
  if (typeof game !== 'undefined' && game && (game.mode === 'estate' || game.mode === 'bn') && typeof document !== 'undefined' && document.body) { bnsInvShow(); return; }
  if (++BNS.invTry > 30 || typeof setTimeout !== 'function') return;   // 最多等 30 秒遊戲載入
  setTimeout(bnsInvWait, 1000);
}
function bnsInvShow() {
  var el, code = BNS.inv, isRep = /^LDB\d+\.R\./.test(code), can = typeof bnUnlocked === 'function' && bnUnlocked();
  bnsInvClose();
  el = document.createElement('div'); el.id = 'bnsInv';
  el.innerHTML = '<div class="box" role="dialog" aria-label="' + (isRep ? '收到戰報' : '收到挑戰隊伍') + '"><h2>' + (isRep ? '收到戰報' : '收到挑戰隊伍') + '</h2>' +
    '<p>' + (isRep ? '朋友傳來一場對戰練習的戰報,要打開來看嗎?' : '朋友傳來一支隊伍,要跟它打一場練習戰嗎?(不給獎勵、不影響進度)') + '</p>' +
    (can ? '' : '<p class="bs-warn">戰鬥要卡包 5 人以上才開放。可以先複製碼留著,開放後到「戰鬥 → 對戰」貼上。</p><textarea id="bnsInvCode" readonly rows="3">' + bnsEsc(code) + '</textarea>') +
    '<div class="row">' + (can ? '<button class="pri" data-v="go">' + (isRep ? '打開戰報' : '去挑戰') + '</button>' : '<button class="pri" data-v="copy">複製碼</button>') + '<button data-v="no">先不要</button></div></div>';
  el.addEventListener('click', bnsInvClick);
  document.body.appendChild(el);
  document.addEventListener('keydown', bnsInvKey);
  BNS.invEl = el;
}
function bnsInvClose() {
  if (!BNS.invEl) return false;
  BNS.invEl.removeEventListener('click', bnsInvClick);
  if (typeof document !== 'undefined') document.removeEventListener('keydown', bnsInvKey);
  if (BNS.invEl.parentNode) BNS.invEl.parentNode.removeChild(BNS.invEl);
  BNS.invEl = null;
  return true;
}
function bnsInvKey(e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) { if (e.stopPropagation) e.stopPropagation(); bnsInvClose(); BNS.inv = null; } }
function bnsInvClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-v]') : null, v, code = BNS.inv;
  if (e && e.stopPropagation) e.stopPropagation();
  if (!b) return;
  v = b.getAttribute('data-v');
  if (v === 'copy') {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code).then(function () { bnsToast('已複製'); }, function () { bnsToast('請長按文字框手動複製'); }); return; } } catch (err) { /* 改手動 */ }
    bnsToast('請長按文字框手動複製');
    return;
  }
  bnsInvClose(); BNS.inv = null;
  if (v !== 'go' || !code) return;
  if (!(typeof bnu !== 'undefined' && bnu.open) && !(typeof bnUiOpen === 'function' && bnUiOpen())) { bnsToast('現在無法進入戰鬥,請回到城市畫面再試'); return; }
  if (bnu.phase === 'fight') { bnsToast('戰鬥中,打完再看'); return; }
  bnsOpen(/^LDB\d+\.R\./.test(code) ? 'rep' : 'chal', code);
}
if (typeof window !== 'undefined' && window.addEventListener && typeof location !== 'undefined') {
  window.addEventListener('hashchange', bnsCheckHash);
  if (typeof document !== 'undefined' && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bnsCheckHash);
  else bnsCheckHash();
}

if (typeof module !== 'undefined' && module.exports) module.exports = { BNS: BNS };
