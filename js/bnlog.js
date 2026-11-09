// js/bnlog.js — 戰鬥 A 模式:文字戰報(最近 N 場自動保留、手動儲存、刪除、逐步 / 逐回合回放、同陣容同種子重打驗證)。
// 資料來源 = 引擎事件日誌 S.events(bn_engine.js 檔頭註解)。存法:每個事件壓成一行短碼字串(類型 1 字母 + 逗號分隔欄位),字串欄位放進每場自己的字典 k;
// 每場最多 BNLOG.maxLines 行,超過截斷並註明;整鍵超過 BNLOG.maxChars 時先丟最舊的「最近」紀錄。檢視時才把短碼還原成中文句子。
// 存檔:世界內 'lorddomain.bnlog.v1'(SAVE_SLOT_KEYS,隨世界 / 回溯點切換)= {v:1, rules:BNLOG_RULES, recent:[戰報], saved:[戰報]};有值才寫;壞檔 / rules 不同 = 整批清除並提示一次。
// 面板掛在 bnui.js 的 #bnLayer 內(#bnLog);Esc / 返回鍵先關面板(bnUiBack 先問 bnLogBack)。不發聲。ES2017;不用 ?. ??。
// 戰鬥改版(2026-11-06):沒有士氣(舊戰報的 M 士氣行仍可顯示);新增 r = 戰法發動判定(哪個戰法擲骰成功 / 未發動、發動率)。
// 全域:BNLOG bnLogEncode bnLogBuild bnLogLoad bnLogRecord bnLogSave bnLogDel bnLogGet bnLogItems bnLogVerify bnLogOpen bnLogClose bnLogIsOpen bnLogBack bnLogDo bnLogRender

var BNLOG = {
  key: 'lorddomain.bnlog.v1', recentMax: 10, savedMax: 20, maxLines: 2500, maxChars: 900000, recsMax: 10,
  recs: {}, recIds: [], el: null, tab: 'recent', view: null, msg: ''
};
// 短碼:事件類型 → 1 字母(init / cd 不存:陣容另有快照,冷卻不影響數字與順序)
var BNLOG_CODE = { round: 'R', act: 'A', skill: 'K', ult: 'U', dmg: 'D', evade: 'E', heal: 'H', shield: 'S', revive: 'V', status: 'T', unstatus: 'X', resist: 'Q', immune: 'I', ccimm: 'C',
  roll: 'r', kill: 'Z', move: 'O', react: 'Y', bond: 'B', trigger: 'G', prep: 'P', skip: 'W', idle: 'L', chain: 'N', chaincap: 'J', end: 'F' };
var BNLOG_GR = ['白', '青', '藍', '紫', '金'];
var BNLOG_WHY = {
  hit: '受擊', kill: '擊倒', skill: '戰法', allydown: '友軍倒下', act: '行動', idle: '待命', ult: '施放大招', aura: '光環', chain: '連鎖', bond: '羈絆', rx: '反應', down: '被削', steal: '被奪', killskill: '戰法擊倒', antidote: '解毒',
  expire: '到期', used: '已生效', cleanse: '被淨化', dispel: '被驅散', stun: '暈眩', fear: '威懾', trap: '中伏', sleep: '沉睡中', paralyze: '麻痺中', wake: '受擊驚醒', pursuit: '追擊', wipe: '全滅決勝', limit: '回合上限判定', retreat: '撤退(算敗北)'
};
var BNLOG_TY = { phys: '攻擊', strat: '謀略', dot: '持續', self: '自損' };
var BNLOG_CAT = { command: '指揮', active: '主動', pursuit: '追擊', passive: '被動', ult: '大招', assist: '補刀', bond: '羈絆' };

function bnLogEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bnLogLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function bnLogLsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function bnLogToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function bnLogHash(s) { return typeof bnHash === 'function' ? bnHash(s) : s.length; }
function bnLogSkName(id) { return (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id] && BN_SKILLS[id].name) || String(id || ''); }
function bnLogStName(id) {
  if (typeof BN_ST_NAME !== 'undefined' && BN_ST_NAME[id]) return BN_ST_NAME[id];
  if (typeof BNT_ST !== 'undefined' && BNT_ST[id]) return BNT_ST[id];
  return { trap: '伏兵', summon: '召喚', reorder: '插隊' }[id] || String(id || '');
}

// ───────── 編碼 ─────────
// 事件 → 一行短碼;K(str) 回字典索引
function bnLogEncOne(e, K) {
  var c = BNLOG_CODE[e.t], f, n = function (v) { return v === undefined || v === null ? '' : String(v); };
  if (!c) return null;
  switch (e.t) {
    case 'round': f = [e.n, e.fat || '', e.first === 'B' ? 1 : 0]; break;
    case 'act': f = [e.u, e.x ? 1 : '']; break;
    case 'skill': f = [e.u, K(e.name || bnLogSkName(e.id)), K(e.cat || ''), n(e.rc), n(e.as)]; break;
    case 'ult': f = [e.u, K(bnLogSkName(e.id))]; break;
    case 'dmg': f = [n(e.src), e.tgt, e.v | 0, e.abs ? e.abs | 0 : '', (e.crit ? 1 : 0) | (e.basic ? 2 : 0) | (e.ctr ? 4 : 0), e.hp | 0, K(e.ty || ''), n(e.via), e.dot ? K(e.dot) : '', e.rx ? K(e.rx) : '']; break;
    case 'evade': f = [n(e.src), e.tgt, e.miss ? 1 : '']; break;
    case 'heal': f = [n(e.src), e.tgt, e.v | 0, n(e.nom), e.hp | 0, e.blk ? 1 : '']; break;
    case 'shield': f = [n(e.src), e.tgt, e.v | 0]; break;
    case 'revive': f = [e.tgt, e.hp | 0]; break;
    case 'status': f = [n(e.src), n(e.tgt), K(e.id), n(e.left), n(e.val)]; break;
    case 'unstatus': f = [e.tgt, K(e.id), K(e.why || '')]; break;
    case 'resist': f = [e.tgt, K(e.id), n(e.layers)]; break;
    case 'immune': case 'ccimm': f = [e.tgt, K(e.id)]; break;
    case 'roll': f = [e.u, K(bnLogSkName(e.id)), e.p | 0, e.ok ? 1 : 0]; break;
    case 'kill': f = [n(e.src), e.tgt]; break;
    case 'move': f = [e.u, e.row, e.col]; break;
    case 'react': f = [K(e.name || e.id), n(e.tgt)]; break;
    case 'bond': f = [K(e.name || e.id)]; break;
    case 'trigger': f = [e.u, K(bnLogSkName(e.id)), K(e.trig || '')]; break;
    case 'prep': f = [e.u, K(bnLogSkName(e.id))]; break;
    case 'skip': f = [e.u, K(e.why || '')]; break;
    case 'idle': f = [e.u]; break;
    case 'chain': f = [e.n, K(e.k || '')]; break;
    case 'chaincap': f = [e.n]; break;
    case 'end': f = [K(e.winner), K(e.reason), e.rounds, Math.round((e.hp ? e.hp.A : 0) * 1000), Math.round((e.hp ? e.hp.B : 0) * 1000)]; break;
    default: return null;
  }
  while (f.length && f[f.length - 1] === '') f.pop();
  return c + f.join(',');
}
// events → {L, k, n, h}(L 未截斷;n = 行數;h = 全部行的雜湊)
function bnLogEncode(events) {
  var k = [], idx = {}, L = [], i, s;
  function K(str) { str = String(str); if (!(str in idx)) { idx[str] = k.length; k.push(str); } return idx[str]; }
  for (i = 0; i < (events || []).length; i++) { s = bnLogEncOne(events[i], K); if (s) L.push(s); }
  return { L: L, k: k, n: L.length, h: bnLogHash(L.join('\n')) };
}
// 單位快照:rec 規格 + 星等(我方從名冊)
function bnLogUnits(specs, stars) {
  return (specs || []).map(function (s, i) {
    var pw = 0;
    try { pw = typeof bnPower === 'function' ? bnPower(s) : 0; } catch (e) { pw = 0; }
    return { n: String(s.name || ''), g: s.gr | 0, s: stars ? (stars[i] | 0) : 0, t: String(s.troop || ''), p: [s.row | 0, s.col | 0], hp: Math.round(s.stats ? s.stats.hp : 0), pw: pw,
      sk: (s.skills || []).map(bnLogSkName), u: s.ult ? bnLogSkName(s.ult) : '' };
  });
}
// 建立一場戰報。S = 引擎狀態(可未結束 = 撤退)、rec = 開戰紀錄、m = {label, kind, sid, stars:[我方星等], res:{w, why, r, st}, manual}
function bnLogBuild(S, rec, m) {
  var en = bnLogEncode(S.events), res = m.res || {}, L = en.L, cut = 0, rep, endLine;
  if (L.length > BNLOG.maxLines) { cut = L.length - BNLOG.maxLines; L = L.slice(0, BNLOG.maxLines); }
  rep = {
    id: 'r' + Date.now().toString(36) + (rec.seed >>> 0).toString(36).slice(-4), ts: Date.now(), kind: m.kind || 'practice', sid: String(m.sid || ''), lb: String(m.label || ''), seed: rec.seed >>> 0,
    au: 1, mu: m.manual ? 1 : 0, w: res.w || 'draw', why: res.why || '', r: res.r | 0, st: res.st | 0,
    A: bnLogUnits(rec.teamA, m.stars), B: bnLogUnits(rec.teamB, null), bA: (rec.meta && rec.meta.bonds || []).concat(rec.meta && rec.meta.formation || []).map(String),
    k: en.k, L: L, ne: en.n, cut: cut, h: en.h
  };
  if (res.why === 'retreat') {   // 撤退:引擎沒有 end 事件,補一行結束(勝負 = 敗北)
    endLine = 'F' + [bnLogK(rep, 'B'), bnLogK(rep, 'retreat'), res.r | 0].join(',');
    rep.L.push(endLine);
  }
  return rep;
}
function bnLogK(rep, str) { var i = rep.k.indexOf(str); if (i < 0) { i = rep.k.length; rep.k.push(str); } return i; }

// ───────── 存檔 ─────────
function bnLogValid(r) { return r && typeof r === 'object' && typeof r.id === 'string' && Array.isArray(r.L) && Array.isArray(r.k) && r.L.every(function (x) { return typeof x === 'string'; }); }
function bnLogNormRep(r) {
  r.A = Array.isArray(r.A) ? r.A.filter(function (u) { return u && typeof u === 'object'; }) : [];
  r.B = Array.isArray(r.B) ? r.B.filter(function (u) { return u && typeof u === 'object'; }) : [];
  r.bA = Array.isArray(r.bA) ? r.bA : [];
  r.ts = +r.ts || 0; r.r = r.r | 0; r.st = r.st | 0; r.cut = r.cut | 0; r.ne = r.ne | 0; r.seed = r.seed >>> 0;
  return r;
}
// 戰鬥規則版本:存檔記 rules;載入時與目前不同(含壞檔 / 沒有版本欄位的舊戰報)→ 最近與已儲存整批清掉,提示一次(清完即寫入新版本記號,不會重複提示)
var BNLOG_RULES = 'r50-sp2-20261109';   // 2026-11-09:回合上限 8 → 50;同日加入睡眠 / 麻痺狀態(sp);再加神醫 / 禁療戰法並移除華佗睡眠戰法(sp2)
function bnLogLoad() {
  var raw = bnLogLsGet(BNLOG.key), o = null, d = { v: 1, recent: [], saved: [] }, had;
  if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  if (raw && (!o || typeof o !== 'object' || o.rules !== BNLOG_RULES)) {
    had = !o || (Array.isArray(o.recent) && o.recent.length > 0) || (Array.isArray(o.saved) && o.saved.length > 0);
    bnLogLsSet(BNLOG.key, JSON.stringify({ v: 1, rules: BNLOG_RULES, recent: [], saved: [] }));
    BNLOG.recs = {}; BNLOG.recIds = []; BNLOG.view = null;
    if (had) bnLogToast('戰鬥規則已更新,舊戰報已清除');
    return d;
  }
  if (o && typeof o === 'object') {
    if (Array.isArray(o.recent)) d.recent = o.recent.filter(bnLogValid).map(bnLogNormRep).slice(0, BNLOG.recentMax);
    if (Array.isArray(o.saved)) d.saved = o.saved.filter(bnLogValid).map(bnLogNormRep).slice(0, BNLOG.savedMax);
  }
  return d;
}
// 寫回:超過 maxChars 或寫入失敗(容量滿)→ 先丟最舊的「最近」再試;已儲存的不自動丟
function bnLogStore(d) {
  var s;
  if (!d.recent.length && !d.saved.length) { if (bnLogLsGet(BNLOG.key) !== null) bnLogLsSet(BNLOG.key, JSON.stringify({ v: 1, rules: BNLOG_RULES, recent: [], saved: [] })); return true; }
  for (;;) {
    s = JSON.stringify({ v: 1, rules: BNLOG_RULES, recent: d.recent, saved: d.saved });
    if (s.length <= BNLOG.maxChars && bnLogLsSet(BNLOG.key, s)) return true;
    if (!d.recent.length) return false;
    d.recent.pop();
  }
}
// 記一場到「最近」(最新在前;同 id 不重複)。rec 留在記憶體供重打驗證
function bnLogRecord(rep, rec) {
  var d = bnLogLoad();
  d.recent = d.recent.filter(function (x) { return x.id !== rep.id; });
  d.recent.unshift(rep);
  if (d.recent.length > BNLOG.recentMax) d.recent.length = BNLOG.recentMax;
  if (rec) {
    BNLOG.recs[rep.id] = rec; BNLOG.recIds.push(rep.id);
    while (BNLOG.recIds.length > BNLOG.recsMax) delete BNLOG.recs[BNLOG.recIds.shift()];
  }
  return bnLogStore(d);
}
function bnLogGet(id) {
  var d = bnLogLoad(), i;
  for (i = 0; i < d.saved.length; i++) if (d.saved[i].id === id) return d.saved[i];
  for (i = 0; i < d.recent.length; i++) if (d.recent[i].id === id) return d.recent[i];
  return null;
}
// 手動儲存:回 {ok, why}
function bnLogSave(id) {
  var d = bnLogLoad(), r = null, i;
  if (d.saved.some(function (x) { return x.id === id; })) return { ok: false, why: '這場戰報已儲存過' };
  for (i = 0; i < d.recent.length; i++) if (d.recent[i].id === id) r = d.recent[i];
  if (!r) return { ok: false, why: '找不到這場戰報' };
  if (d.saved.length >= BNLOG.savedMax) return { ok: false, why: '已儲存 ' + BNLOG.savedMax + ' 筆(上限),請先刪除舊的戰報' };
  d.saved.unshift(r);
  if (!bnLogStore(d)) return { ok: false, why: '儲存空間不足,請先刪除舊的戰報' };
  return { ok: true, why: '' };
}
function bnLogDel(id) {
  var d = bnLogLoad(), n = d.saved.length;
  d.saved = d.saved.filter(function (x) { return x.id !== id; });
  if (d.saved.length === n) return false;
  bnLogStore(d);
  return true;
}

// ───────── 還原成文字 ─────────
// 回 [{r 回合, g 行動組序(0 起;回合列自成一組), c 類別, txt}]
function bnLogItems(rep) {
  var out = [], k = rep.k, r = 0, g = -1, nAct = 0, i, s, f, code, x, units = rep.A.map(function (u) { return { n: u.n, side: 'A' }; }).concat(rep.B.map(function (u) { return { n: u.n, side: 'B' }; }));
  function nm(id) { id = id === '' || id === undefined ? -1 : +id; var u = units[id]; return id < 0 ? '場面' : (u ? (u.side === 'A' ? '我·' : '敵·') + u.n : '#' + id); }
  function D(j) { return k[+j] === undefined ? '' : k[+j]; }
  function W(s2) { return BNLOG_WHY[s2] || s2; }
  function push(c, t) { out.push({ r: r, g: g < 0 ? 0 : g, c: c, txt: t }); }
  if (rep.L.length && rep.L[0].charAt(0) !== 'R') { g = 0; push('rd', '══ 開戰前(被動 / 指揮 / 羈絆)══'); }
  for (i = 0; i < rep.L.length; i++) {
    s = rep.L[i]; code = s.charAt(0); f = s.slice(1).split(',');
    switch (code) {
      case 'R': r = +f[0]; g++; nAct = 0; push('rd', '══ 第 ' + r + ' 回合 ══ 先手:' + (f[2] === '1' ? '敵方' : '我方') + (f[1] ? ' · 疲兵 ' + f[1] + ' 層' : '')); break;
      case 'A': g++; nAct++; push('act', '【第 ' + r + ' 回合 · 第 ' + nAct + ' 手】' + nm(f[0]) + (f[1] === '1' ? ' 追加行動' : ' 行動')); break;
      case 'K': x = D(f[2]); push('sk', nm(f[0]) + ' 發動' + (BNLOG_CAT[x] ? BNLOG_CAT[x] : '') + '戰法「' + D(f[1]) + '」' + (f[3] ? '(第 ' + f[3] + ' 次再放)' : '') + (f[4] ? '(' + nm(f[4]) + ' 補刀)' : '')); break;
      case 'U': push('sk', nm(f[0]) + ' 施放大招「' + D(f[1]) + '」'); break;
      case 'P': push('sk', nm(f[0]) + ' 蓄力準備「' + D(f[1]) + '」'); break;
      case 'D':
        x = +f[4] || 0;
        push('dmg', nm(f[0]) + ' → ' + nm(f[1]) + ' ' + (x & 2 ? '普攻' : (BNLOG_TY[D(f[6])] || '')) + (x & 4 ? '反擊' : '') + (f[8] ? '(' + bnLogStName(D(f[8])) + ')' : '') + '傷害 ' + f[2] +
          (f[3] ? '(護盾吸收 ' + f[3] + ')' : '') + (x & 1 ? ' 暴擊' : '') + (f[7] ? '(' + nm(f[7]) + ' 援護代受)' : '') + (f[9] ? '〔反應:' + D(f[9]) + '〕' : '') + ' · 剩兵力 ' + f[5]);
        break;
      case 'E': push('ef', f[2] === '1' ? nm(f[0]) + ' 命中下降,攻擊落空' : nm(f[1]) + ' 閃避了 ' + nm(f[0]) + ' 的攻擊'); break;
      case 'H': push('heal', nm(f[0]) + ' 治療 ' + nm(f[1]) + ' +' + f[2] + (f[3] && +f[3] !== +f[2] ? '(原 ' + f[3] + (f[5] ? ',禁療減少' : '') + ')' : '') + ' · 剩兵力 ' + f[4]); break;
      case 'S': push('heal', nm(f[0]) + ' 給 ' + nm(f[1]) + ' 護盾 +' + f[2]); break;
      case 'V': push('heal', nm(f[0]) + ' 復活,兵力 ' + f[1]); break;
      case 'T':
        x = D(f[2]);
        if (x === 'sleep' || x === 'paralyze') { push('st', nm(f[1]) + (x === 'sleep' ? ' 沉睡' : ' 麻痺') + (f[3] ? ' ' + f[3] + ' 回合' : '') + (f[0] && f[0] !== '-1' ? '(' + nm(f[0]) + ' 施加)' : '')); break; }   // 睡眠 / 麻痺(2026-11-09)
        push('st', nm(f[0]) + ' 對 ' + (f[1] === '-1' ? '全場' : nm(f[1])) + ' 施加〔' + bnLogStName(D(f[2])) + '〕' + (f[3] ? ' ' + f[3] + ' 回合' : '') + (f[4] ? ' 值 ' + f[4] : '')); break;
      case 'X':
        if (D(f[1]) === 'sleep' && (D(f[2]) === 'wake' || D(f[2]) === 'expire')) { push('st', nm(f[0]) + (D(f[2]) === 'wake' ? ' 受到攻擊,被喚醒' : ' 睡醒了')); break; }
        push('st', nm(f[0]) + ' 的〔' + bnLogStName(D(f[1])) + '〕解除(' + W(D(f[2])) + ')'); break;
      case 'Q': push('ef', nm(f[0]) + ' 抵禦了〔' + bnLogStName(D(f[1])) + '〕' + (f[2] ? '(剩 ' + f[2] + ' 層)' : '')); break;
      case 'I': push('ef', nm(f[0]) + ' 免疫〔' + bnLogStName(D(f[1])) + '〕'); break;
      case 'C': push('ef', nm(f[0]) + ' 抗控擋下〔' + bnLogStName(D(f[1])) + '〕'); break;
      case 'r': push(f[3] === '1' ? 'ro' : 'mo', nm(f[0]) + '「' + D(f[1]) + '」發動率 ' + f[2] + '% → ' + (f[3] === '1' ? '發動' : '未發動')); break;
      case 'M': push('mo', nm(f[0]) + ' 士氣 ' + (+f[1] > 0 ? '+' : '') + f[1] + ' → ' + f[2] + '(' + W(D(f[3])) + ')'); break;   // 舊戰報(戰鬥改版前)
      case 'Z': push('kill', '✖ ' + nm(f[0]) + ' 擊倒 ' + nm(f[1])); break;
      case 'O': push('ef', nm(f[0]) + ' 移到' + ['前', '中', '後'][+f[1]] + '排第 ' + (+f[2] + 1) + ' 格'); break;
      case 'Y': push('ef', '反應「' + D(f[0]) + '」' + (f[1] && f[1] !== '-1' ? '→ ' + nm(f[1]) : '')); break;
      case 'B': push('ef', '羈絆「' + D(f[0]) + '」生效'); break;
      case 'G': push('sk', nm(f[0]) + ' 觸發「' + D(f[1]) + '」' + (D(f[2]) ? '(' + ((typeof BNT_TRIG !== 'undefined' && BNT_TRIG[D(f[2])]) || D(f[2])) + ')' : '')); break;
      case 'W': push('ef', nm(f[0]) + (D(f[1]) === 'sleep' || D(f[1]) === 'paralyze' ? ' ' + W(D(f[1])) + ',無法行動' : ' 無法行動(' + W(D(f[1])) + ')')); break;
      case 'L': push('ef', nm(f[0]) + ' 射程不足,待命'); break;
      case 'N': push('ef', '連鎖第 ' + f[0] + ' 步(' + W(D(f[1])) + ')'); break;
      case 'J': push('ef', '連鎖達上限(' + f[0] + ' 步)'); break;
      case 'F':
        x = D(f[0]); g++;
        push('end', '══ 戰鬥結束:' + (x === 'A' ? '我方勝利' : (x === 'B' ? '我方敗北' : '平手')) + ' · ' + W(D(f[1])) + ' · 共 ' + f[2] + ' 回合' + (f[3] !== undefined && D(f[1]) !== 'retreat' ? ' · 剩餘兵力 我 ' + (f[3] / 10).toFixed(1) + '% / 敵 ' + (f[4] / 10).toFixed(1) + '%' : ''));
        break;
      default: break;
    }
  }
  if (rep.cut) out.push({ r: r, g: g + 1, c: 'end', txt: '(戰報過長,已截斷後面 ' + rep.cut + ' 行)' });
  return out;
}
function bnLogResTxt(rep) {
  var w = rep.w === 'A' ? '勝利' : (rep.w === 'B' ? '敗北' : '平手');
  return w + (rep.why === 'retreat' ? '(撤退)' : '') + (rep.w === 'A' && rep.st ? ' ' + '★'.repeat(rep.st) : '') + ' · ' + rep.r + ' 回合';
}
function bnLogDate(ts) { var d = new Date(ts || 0), p = function (n) { return (n < 10 ? '0' : '') + n; }; return (d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

// ───────── 重打驗證:同陣容同種子重跑引擎,比對前 ne 行雜湊 ─────────
function bnLogVerify(rep, rec) {
  var S, en, h;
  rec = rec || BNLOG.recs[rep.id];
  if (!rec) return { ok: false, why: '只有本次遊戲中打的場次能重打驗證(陣容資料不存檔)' };
  if (rep.mu) return { ok: false, why: '這場中途有手動操作,無法用種子重現' };
  if (typeof bnRun !== 'function') return { ok: false, why: '引擎未載入' };
  S = bnRun(JSON.parse(JSON.stringify(rec)));
  en = bnLogEncode(S.events);
  h = bnLogHash(en.L.slice(0, rep.ne).join('\n'));
  return { ok: true, same: h === rep.h, why: h === rep.h ? '重打結果與戰報完全一致(' + rep.ne + ' 行)' : '重打結果與戰報不同(引擎或數值已變動)' };
}

// ───────── 面板 ─────────
var BNLOG_CSS = '#bnLog{position:absolute;left:0;top:0;right:0;bottom:0;z-index:9;display:flex;flex-direction:column;background:#1b150f;color:#f4ead2}' +
  '#bnLog .lh{display:flex;align-items:center;gap:6px;min-height:48px;padding:calc(2px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) 2px calc(8px + env(safe-area-inset-left));background:rgba(28,20,14,.95);flex:0 0 auto}' +
  '#bnLog .lh b{flex:1;min-width:0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '#bnLog button{min-width:44px;min-height:44px;border:none;border-radius:8px;background:rgba(255,255,255,.14);color:#f4ead2;font-size:15px;padding:0 10px;cursor:pointer}#bnLog button.on{background:#c9892f;color:#1b1308;font-weight:bold}#bnLog button[disabled]{opacity:.4}' +
  '#bnLog .lb{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left))}' +
  '#bnLog .tabs{display:flex;gap:6px;margin:0 0 8px}#bnLog .tabs button{flex:1}' +
  '#bnLog .it{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;margin:0 0 6px;border-radius:10px;background:rgba(255,255,255,.07)}#bnLog .it .t{flex:1 1 180px;min-width:0;font-size:14px;line-height:1.4;overflow-wrap:anywhere}#bnLog .it small{opacity:.8;font-size:12px}' +
  '#bnLog .sm{font-size:12px;opacity:.8;margin:4px 0}#bnLog .em{padding:20px 0;text-align:center;opacity:.75;font-size:14px}#bnLog .msg{color:#ffd25a;font-size:13px;margin:4px 0}' +
  '#bnLog .sum{font-size:13px;line-height:1.5;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.07);margin:0 0 6px;overflow-wrap:anywhere}' +
  '#bnLog .tm{width:100%;border-collapse:collapse;font-size:12px;margin:2px 0 6px}#bnLog .tm td,#bnLog .tm th{padding:2px 4px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left;vertical-align:top;overflow-wrap:anywhere}#bnLog .tm th{opacity:.75;font-weight:normal}#bnLog .tm td:not(:last-child),#bnLog .tm th{white-space:nowrap}#bnLog details{margin:0 0 6px}#bnLog summary{min-height:44px;line-height:44px;font-size:14px;cursor:pointer}' +
  '#bnLog .stk{position:sticky;top:-8px;z-index:1;background:#1b150f;padding:4px 0 2px}#bnLog .ctl{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}#bnLog .rds{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:0 0 6px}#bnLog .rds::-webkit-scrollbar{display:none}#bnLog .rds button{flex:0 0 auto}' +
  '#bnLog .ln{font-size:13px;line-height:1.45;padding:1px 6px;overflow-wrap:anywhere;border-left:3px solid transparent}#bnLog .ln.rd,#bnLog .ln.end{color:#ffd25a;font-weight:bold;margin-top:6px}#bnLog .ln.act{color:#9fc8ff;margin-top:4px}' +
  '#bnLog .ln.dmg{color:#ffb0a0}#bnLog .ln.heal{color:#9be39b}#bnLog .ln.kill{color:#ff7a6a;font-weight:bold}#bnLog .ln.mo{opacity:.7;font-size:12px}#bnLog .ln.ro{color:#ffe6a0;font-size:12px}#bnLog .ln.st{color:#e0c8ff}#bnLog .ln.cur{background:rgba(255,210,90,.14);border-left-color:#ffd25a}' +
  '#bnLog .g0{color:#e6e6e6}#bnLog .g1{color:#8fd9a0}#bnLog .g2{color:#8ab8ff}#bnLog .g3{color:#d9a0ff}#bnLog .g4{color:#ffd25a}' +
  '@media (orientation:landscape) and (min-width:700px){#bnLog .cols{display:grid;grid-template-columns:minmax(260px,1fr) minmax(300px,1.4fr);column-gap:12px;align-items:start}}';
function bnLogCss() {
  var st;
  if (typeof document === 'undefined' || !document.head || document.getElementById('bnLogStyle')) return;
  st = document.createElement('style'); st.id = 'bnLogStyle'; st.textContent = BNLOG_CSS;
  document.head.appendChild(st);
}
function bnLogIsOpen() { return !!(BNLOG.el && BNLOG.el.parentNode); }
function bnLogOnClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-l]') : null;
  if (e && e.stopPropagation) e.stopPropagation();
  if (!b) return;
  bnLogDo(b.getAttribute('data-l'), b.getAttribute('data-id'), +b.getAttribute('data-i'));
}
// 開啟面板。tab = 'recent' | 'saved';id 給了就直接檢視該場
function bnLogOpen(tab, id) {
  var host = (typeof bnu !== 'undefined' && bnu.layer) || null, el;
  if (!host || typeof document === 'undefined') return false;
  if (typeof bnu !== 'undefined' && bnu.phase === 'fight' && bnu.P && !bnu.P.done && !bnu.paused && typeof bnUiPause === 'function') bnUiPause(true);
  bnLogCss();
  if (!bnLogIsOpen()) {
    el = document.createElement('div'); el.id = 'bnLog';
    el.addEventListener('click', bnLogOnClick);
    host.appendChild(el);
    BNLOG.el = el;
  }
  BNLOG.tab = tab === 'saved' ? 'saved' : 'recent'; BNLOG.view = null; BNLOG.msg = '';
  if (id) bnLogDo('view', id);
  else bnLogRender();
  return true;
}
function bnLogClose() {
  var el = BNLOG.el;
  if (!el) return false;
  el.removeEventListener('click', bnLogOnClick);
  if (el.parentNode) el.parentNode.removeChild(el);
  BNLOG.el = null; BNLOG.view = null; BNLOG.msg = '';
  return true;
}
// 返回 / Esc:檢視中 → 回清單;清單 → 關面板。回是否有處理
function bnLogBack() {
  if (!bnLogIsOpen()) { BNLOG.el = null; return false; }
  if (BNLOG.view) { BNLOG.view = null; BNLOG.msg = ''; bnLogRender(); return true; }
  bnLogClose();
  return true;
}
function bnLogViewGroups(items) { var n = 0; items.forEach(function (x) { if (x.g + 1 > n) n = x.g + 1; }); return n; }
// 動作:tab(id='recent'|'saved') view(id) save(id) del(id) back close first prev next all rd(i=回合;0=全部) verify
function bnLogDo(a, id, i) {
  var v = BNLOG.view, r, items, n, g;
  if (a === 'close') { bnLogClose(); return true; }
  if (a === 'back') return bnLogBack();
  if (a === 'tab') { BNLOG.tab = id === 'saved' ? 'saved' : 'recent'; BNLOG.view = null; BNLOG.msg = ''; }
  else if (a === 'view') {
    r = bnLogGet(id);
    if (!r) { BNLOG.msg = '找不到這場戰報'; }
    else { items = bnLogItems(r); BNLOG.view = { rep: r, items: items, n: bnLogViewGroups(items), step: -1, rd: 0 }; BNLOG.msg = ''; }
  } else if (a === 'save') { r = bnLogSave(id); BNLOG.msg = r.ok ? '已儲存戰報' : r.why; bnLogToast(BNLOG.msg); }
  else if (a === 'share') { if (typeof bnsDo === 'function') { bnLogClose(); bnsDo('rcode'); return true; } }   // 分享戰報碼(對戰練習;結算畫面只留「查看戰報 / 離開」,分享移到這裡)
  else if (a === 'del') { if (bnLogDel(id)) { BNLOG.msg = '已刪除'; if (v && v.rep.id === id) BNLOG.view = null; } }
  else if (v && (a === 'first' || a === 'prev' || a === 'next' || a === 'all' || a === 'rd')) {
    if (a === 'all') { v.step = -1; v.rd = 0; }
    else if (a === 'rd') { v.rd = i | 0; v.step = -1; }
    else {
      g = v.step;
      if (a === 'first') g = 0;
      else if (a === 'next') g = g < 0 ? (v.rd ? bnLogFirstOf(v, v.rd) : 0) : Math.min(v.n - 1, g + 1);
      else g = g < 0 ? v.n - 1 : Math.max(0, g - 1);
      v.step = g;
      if (v.rd) { n = bnLogRoundOf(v, g); if (n !== v.rd) v.rd = n; }
    }
  } else if (v && a === 'verify') { r = bnLogVerify(v.rep); BNLOG.msg = r.why; }
  else return false;
  bnLogRender();
  return true;
}
function bnLogFirstOf(v, rd) { var i; for (i = 0; i < v.items.length; i++) if (v.items[i].r === rd) return v.items[i].g; return 0; }
function bnLogRoundOf(v, g) { var i; for (i = 0; i < v.items.length; i++) if (v.items[i].g === g) return v.items[i].r; return v.rd; }
function bnLogUnitRows(list, mine) {
  return '<table class="tm"><tr><th>武將</th><th>品階</th>' + (mine ? '<th>星</th>' : '') + '<th>兵種</th><th>位置</th><th>兵力</th><th>戰力</th><th>戰法</th></tr>' + list.map(function (u) {
    return '<tr><td class="g' + (u.g | 0) + '">' + bnLogEsc(u.n) + '</td><td>' + (BNLOG_GR[u.g] || '') + '</td>' + (mine ? '<td>' + (u.s | 0) + '</td>' : '') + '<td>' + bnLogEsc(u.t) + '</td><td>' + (u.p ? ['前', '中', '後'][u.p[0]] + (u.p[1] + 1) : '') + '</td><td>' + (u.hp | 0) + '</td><td>' + (u.pw | 0) + '</td><td>' +
      bnLogEsc((u.sk || []).concat(u.u ? ['大招:' + u.u] : []).join('、')) + '</td></tr>';
  }).join('') + '</table>';
}
function bnLogRender() {
  var el = BNLOG.el, h = '', v = BNLOG.view, d, list, rep, items, maxR = 0, saved, cur;
  if (!el) return;
  if (v) {
    rep = v.rep;
    h += '<div class="lh"><button data-l="back" aria-label="返回">↩</button><b>戰報 · ' + bnLogEsc(rep.lb) + '</b></div><div class="lb"><div class="cols"><div class="c1">';
    h += '<div class="sum"><b>' + bnLogEsc(bnLogResTxt(rep)) + '</b> · ' + bnLogDate(rep.ts) + '<br>關卡 ' + bnLogEsc(rep.sid || '-') + ' · 種子 ' + rep.seed + (rep.mu ? ' · 有手動操作' : '') +
      (rep.bA.length ? '<br>羈絆 / 陣型:' + bnLogEsc(rep.bA.join('、')) : '') + '</div>';
    h += '<details' + (bnLogWide() ? ' open' : '') + '><summary>陣容快照(武將 / 品階 / 星 / 兵種 / 位置 / 兵力 / 戰力 / 戰法)</summary><div class="sm">我方陣容</div>' + bnLogUnitRows(rep.A, true) + '<div class="sm">敵方陣容</div>' + bnLogUnitRows(rep.B, false) + '</details>';
    saved = bnLogLoad().saved.some(function (x) { return x.id === rep.id; });
    h += '<div class="ctl">' + (saved ? '<button data-l="del" data-id="' + bnLogEsc(rep.id) + '">刪除</button>' : '<button data-l="save" data-id="' + bnLogEsc(rep.id) + '">儲存戰報</button>') + (BNLOG.recs[rep.id] ? '<button data-l="verify">重打驗證</button>' : '') +
      (rep.kind === 'duel' && typeof BNS !== 'undefined' && BNS.last && typeof bnu !== 'undefined' && rep.id === bnu.logId ? '<button data-l="share">分享戰報碼</button>' : '') + '</div>';
    if (BNLOG.msg) h += '<div class="msg">' + bnLogEsc(BNLOG.msg) + '</div>';
    h += '</div><div class="c2">';
    v.items.forEach(function (x) { if (x.r > maxR) maxR = x.r; });
    h += '<div class="stk"><div class="rds"><button data-l="rd" data-i="0"' + (v.rd === 0 ? ' class="on"' : '') + '>全部</button>';
    for (cur = 1; cur <= maxR; cur++) h += '<button data-l="rd" data-i="' + cur + '"' + (v.rd === cur ? ' class="on"' : '') + '>第' + cur + '回</button>';
    h += '</div><div class="ctl"><button data-l="first" aria-label="從頭逐步">⏮</button><button data-l="prev" aria-label="上一步">◀ 上一步</button><button data-l="next" aria-label="下一步">下一步 ▶</button><button data-l="all"' + (v.step < 0 ? ' class="on"' : '') + '>全部展開</button></div>';
    h += '<div class="sm">' + (v.step >= 0 ? '逐步:第 ' + (v.step + 1) + ' / ' + v.n + ' 步' : '共 ' + v.n + ' 步、' + rep.L.length + ' 行') + '</div></div>';
    items = v.items.filter(function (x) { return (!v.rd || x.r === v.rd) && (v.step < 0 || x.g <= v.step); });
    h += '<div class="lines">' + items.map(function (x) { return '<div class="ln ' + x.c + (v.step >= 0 && x.g === v.step ? ' cur' : '') + '">' + bnLogEsc(x.txt) + '</div>'; }).join('') + '</div>';
    h += '</div></div></div>';
  } else {
    d = bnLogLoad();
    list = BNLOG.tab === 'saved' ? d.saved : d.recent;
    h += '<div class="lh"><button data-l="back" aria-label="返回">↩</button><b>戰報</b></div><div class="lb">';
    h += '<div class="tabs"><button data-l="tab" data-id="recent"' + (BNLOG.tab === 'recent' ? ' class="on"' : '') + '>最近 ' + d.recent.length + '/' + BNLOG.recentMax + '</button><button data-l="tab" data-id="saved"' + (BNLOG.tab === 'saved' ? ' class="on"' : '') + '>已儲存 ' + d.saved.length + '/' + BNLOG.savedMax + '</button></div>';
    if (BNLOG.msg) h += '<div class="msg">' + bnLogEsc(BNLOG.msg) + '</div>';
    h += '<div class="sm">' + (BNLOG.tab === 'saved' ? '手動儲存的戰報,最多 ' + BNLOG.savedMax + ' 筆;滿了要先刪除。' : '自動保留最近 ' + BNLOG.recentMax + ' 場,較舊的會被新戰報取代;想留下的請按「儲存」。') + '</div>';
    if (!list.length) h += '<div class="em">' + (BNLOG.tab === 'saved' ? '還沒有儲存的戰報' : '還沒有戰報,打一場就會出現') + '</div>';
    h += list.map(function (r) {
      var isSaved = BNLOG.tab === 'saved' || d.saved.some(function (x) { return x.id === r.id; });
      return '<div class="it"><div class="t"><b>' + bnLogEsc(r.lb) + '</b> · ' + bnLogEsc(bnLogResTxt(r)) + '<br><small>' + bnLogDate(r.ts) + ' · ' + bnLogEsc(r.A.map(function (u) { return u.n; }).join('、')) + '</small></div>' +
        '<button data-l="view" data-id="' + bnLogEsc(r.id) + '">檢視</button>' +
        (BNLOG.tab === 'saved' ? '<button data-l="del" data-id="' + bnLogEsc(r.id) + '">刪除</button>' : (isSaved ? '<button disabled>已儲存</button>' : '<button data-l="save" data-id="' + bnLogEsc(r.id) + '">儲存</button>')) + '</div>';
    }).join('');
    h += '</div>';
  }
  el.innerHTML = h;
  cur = v && v.step >= 0 && el.querySelector ? el.querySelector('.ln.cur') : null;
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'center' });
}
function bnLogWide() { return typeof window !== 'undefined' && window.innerWidth > window.innerHeight && window.innerWidth >= 700; }

if (typeof module !== 'undefined' && module.exports) module.exports = { BNLOG: BNLOG };
