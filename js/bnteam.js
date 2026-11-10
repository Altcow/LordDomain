// js/bnteam.js — 戰鬥 A:武將戰法卡(布陣 / 討伐地圖 / 結算中我方隊伍一律用卡片顯示:頭像、品階、星等、兵種、戰力、兵力條、戰法清單)、名冊搜尋 / 排序、隊伍預設 3 組(可命名、一鍵套用)。
// 掛在 bnui.js 的全螢幕 layer 內;卡片 / 預設的點擊經 bnUiDo → bnTeamDo。戰法清單一律取自 bn_text.js 的 bnCardSkillRows(card, {troop})(唯讀;含被動與大招)。戰法名可點 → 戰法說明浮層(內容 = bnSkillInfo,同名冊卡的 bnskill 說明)。
// 存檔:世界內 'lorddomain.bnteam.v1' = {v:1, p:[3 組 {name, slots:[{id,row,col,troop,nm}]} | null]}(有值才寫;壞檔 / 舊檔 = 空;沒有此鍵時沿用 bn.v1 的舊 forms 當初值,不改舊鍵)。
// 對外(給「對戰練習」等其他模組):bnTeamPresetGet(n) n=1..3 → {n, name, slots:[…], empty};bnTeamSnapshot() → 目前隊伍 ≤5 人快照。
// 依賴:bnui.js(bnu BNUI bnUiEntry bnUiSpec bnUiTroopOf bnUiEsc bnUiLsGet bnUiLsSet bnUiNormForm bnUiRosterIds bnUiCurSave bnUiRenderForm bnUiToast)、bn_units.js;bn_text.js / cardsui.js 可缺。ES2017;不用 ?. ??。
// 全域:BNTEAM bnTeamLoad bnTeamSave bnTeamPresetGet bnTeamPresetSave bnTeamPresetApply bnTeamPresetRename bnTeamSnapshot bnTeamSkillRows bnTeamCardHtml bnTeamStripHtml bnTeamRosterHtml bnTeamPresetHtml bnTeamSkillLinksHtml bnTeamDo bnTeamBack bnTeamIsOpen bnTeamInfoOpen bnTeamInfoClose bnTeamCss

var BNTEAM = { key: 'lorddomain.bnteam.v1', n: 3, show: 3, nameMax: 12, qMax: 20, rawMax: 200000, sort: 'pw', q: '', exp: {}, data: null, raw: undefined, info: '', infoEl: null, per: 40, pg: 0, fac: '', gr: '' };
var BNTEAM_SORT = [['pw', '戰力'], ['gr', '品階'], ['tr', '兵種']];
var BNTEAM_GR = ['白', '青', '藍', '紫', '金'];
var BNTEAM_CAT = { command: '指', active: '主', pursuit: '追', passive: '被', ult: '大' };
var BNTEAM_ROW = ['前', '中', '後'];

function bnTeamEsc(s) { return (typeof bnUiEsc === 'function') ? bnUiEsc(s) : String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bnTeamToast(m) { if (typeof bnUiToast === 'function') bnUiToast(m); }

// ───────── 隊伍預設(存檔)─────────
function bnTeamDefName(i) { return '隊伍 ' + (i + 1); }
function bnTeamNormName(s, i) {
  var t = typeof s === 'string' ? s.replace(/[\u0000-\u001f<>"&]/g, '').trim() : '';
  t = Array.from(t).slice(0, BNTEAM.nameMax).join('');
  return t || bnTeamDefName(i);
}
function bnTeamNormSlots(a) {
  var src = Array.isArray(a) ? a.slice(0, 20) : [], out = bnUiNormForm({ slots: src }, null).slots, nm = {};
  src.forEach(function (s) { if (s && typeof s.id === 'string' && typeof s.nm === 'string') nm[s.id] = Array.from(s.nm).slice(0, 12).join(''); });
  out.forEach(function (s) { s.nm = nm[s.id] || ''; });
  return out;
}
function bnTeamLoad() {
  var raw = bnUiLsGet(BNTEAM.key), o = null, d = { v: 1, p: [] }, i, f, s, old;
  for (i = 0; i < BNTEAM.n; i++) d.p.push(null);
  if (raw && raw.length < BNTEAM.rawMax) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  if (o && typeof o === 'object' && Array.isArray(o.p)) {
    for (i = 0; i < BNTEAM.n; i++) {
      f = o.p[i];
      if (!f || typeof f !== 'object') continue;
      s = bnTeamNormSlots(f.slots);
      if (s.length) d.p[i] = { name: bnTeamNormName(f.name, i), slots: s };
    }
  } else if (raw === null) {   // 舊存檔:沿用 bn.v1 的 3 套預設陣容當初值(只讀,不改舊鍵)
    old = ((typeof bnu !== 'undefined' && bnu.data) || (typeof bnUiLoad === 'function' ? bnUiLoad() : null) || {}).forms || [];
    for (i = 0; i < BNTEAM.n; i++) {
      if (!old[i] || !old[i].slots || !old[i].slots.length) continue;
      s = bnTeamNormSlots(old[i].slots);
      s.forEach(function (x) { var e = bnUiEntry(x.id); if (e) x.nm = Array.from(String(e.name)).slice(0, 12).join(''); });
      if (s.length) d.p[i] = { name: bnTeamDefName(i), slots: s };
    }
  }
  BNTEAM.data = d; BNTEAM.raw = raw;
  return d;
}
// 讀取快取:鍵內容變了(切換世界 / 回溯點)就重讀
function bnTeamData() {
  var raw = bnUiLsGet(BNTEAM.key);
  if (!BNTEAM.data || raw !== BNTEAM.raw) return bnTeamLoad();
  return BNTEAM.data;
}
// 有值才寫:3 組都空且原本沒有鍵時不寫
function bnTeamSave() {
  var d = BNTEAM.data || bnTeamLoad(), has = d.p.some(function (x) { return x && x.slots.length; }), s;
  if (!has && BNTEAM.raw === null) return false;
  s = JSON.stringify({ v: 1, p: d.p });
  if (!bnUiLsSet(BNTEAM.key, s)) return false;
  BNTEAM.raw = s;
  return true;
}
function bnTeamIdx(n) { n = n | 0; return (n >= 1 && n <= BNTEAM.n) ? n - 1 : -1; }
// n = 1..3(隊伍 n)→ {n, name, slots:[{id,row,col,troop,nm}], empty};n 不合法回 null
function bnTeamPresetGet(n) {
  var i = bnTeamIdx(n), p;
  if (i < 0) return null;
  p = bnTeamData().p[i];
  return { n: i + 1, name: p ? p.name : bnTeamDefName(i), slots: p ? p.slots.map(function (s) { return { id: s.id, row: s.row, col: s.col, troop: s.troop, nm: s.nm }; }) : [], empty: !p };
}
function bnTeamPresetSave(n) {
  var i = bnTeamIdx(n), d, p, s;
  if (i < 0) return false;
  if (!bnu.slots || !bnu.slots.length) { bnTeamToast('目前沒有陣容可存'); return false; }
  d = bnTeamData(); p = d.p[i];
  s = bnTeamNormSlots(bnu.slots.map(function (x) { var e = bnUiEntry(x.id); return { id: x.id, row: x.row, col: x.col, troop: x.troop || bnu.tp[x.id] || '', nm: e ? String(e.name) : '' }; }));
  d.p[i] = { name: p ? p.name : bnTeamDefName(i), slots: s };
  bnTeamSave();
  bnTeamToast('已存到「' + d.p[i].name + '」');
  return true;
}
// 套用:名冊已沒有的人(遣散 / 卸任)留空並提示。回 {ok, placed, missing:[姓名]}
function bnTeamPresetApply(n) {
  var p = bnTeamPresetGet(n), ids, miss, keep;
  if (!p) return { ok: false, placed: 0, missing: [] };
  if (p.empty) { bnTeamToast('「' + p.name + '」是空的,先按「存入」'); return { ok: false, placed: 0, missing: [] }; }
  ids = bnUiRosterIds();
  miss = p.slots.filter(function (s) { return !ids[s.id]; }).map(function (s) { return s.nm || '(不明人物)'; });
  keep = bnUiNormForm({ slots: p.slots }, ids).slots;
  bnu.slots = keep.map(function (s) { return { id: s.id, row: s.row, col: s.col, troop: s.troop }; });
  bnu.slots.forEach(function (x) { if (x.troop) bnu.tp[x.id] = x.troop; });
  bnu.sel = null;
  if (typeof bnUiCurSave === 'function') bnUiCurSave();
  if (bnu.open && bnu.phase === 'form' && typeof bnUiRenderForm === 'function') bnUiRenderForm();
  bnTeamToast(miss.length ? '已套用「' + p.name + '」;' + miss.join('、') + ' 已不在名冊,該位置留空' : '已套用「' + p.name + '」');
  return { ok: true, placed: keep.length, missing: miss };
}
function bnTeamPresetRename(n, name) {
  var i = bnTeamIdx(n), d, v;
  if (i < 0) return false;
  d = bnTeamData();
  if (!d.p[i]) { bnTeamToast('先存入隊伍再改名'); return false; }
  v = name;
  if (v === undefined) {
    if (typeof prompt !== 'function') return false;
    try { v = prompt('隊伍名稱(最多 ' + BNTEAM.nameMax + ' 字)', d.p[i].name); } catch (e) { v = null; }
  }
  if (v === null || v === undefined) return false;
  d.p[i].name = bnTeamNormName(String(v), i);
  bnTeamSave();
  if (bnu.open && bnu.phase === 'form' && typeof bnUiRenderForm === 'function') bnUiRenderForm();
  return true;
}

// ───────── 目前隊伍快照(給對戰練習等模組;純 JSON)─────────
var BNTEAM_CARD_KEYS = ['name', 'zi', 'fig', 'fac', 'gr', 'st', 'ja', 'main', 'tr', 'tok', 'learn', 'up', 'sex', 'no', 'starLv', 'bnLearn'];
function bnTeamJson(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return null; } }
// [{id, name, fig, gr, starLv, bnLearn, learned, learnSrc, drill, drillLv, row, col, troop, power, hp, skills:[戰法 id], ult, card:{名冊卡屬性}, spec:{單位規格}}],依前排→後排、上→下
// learned = 路人學習欄實際戰法(自帶以外);learnSrc = 'skc' 戰法傳承裝備(bn_skcard.js)、'card' 卡面 bnLearn、'auto' 自動補;drill / drillLv = 研兵加成比例 / 等級(隊伍碼帶出,對方重建戰力一致)
function bnTeamSnapshot() {
  var out = [], per = (typeof BNBOOK !== 'undefined' && BNBOOK.drillPer) || 0.02;
  bnTeamOrder(bnu.slots || []).slice(0, BNUI.maxUnits).forEach(function (s) {
    var e = bnUiEntry(s.id), tr, sp, card = {}, nat;
    if (!e) return;
    tr = s.troop || bnUiTroopOf(e);
    sp = bnUiSpec(e, { troop: tr, row: s.row, col: s.col });
    BNTEAM_CARD_KEYS.forEach(function (k) { if (e[k] !== undefined) card[k] = bnTeamJson(e[k]); });
    nat = e.fig ? [] : bnNativeSkills(e, tr);
    out.push({
      id: e.id, name: String(e.name), fig: e.fig || '', gr: e.gr | 0, starLv: (typeof cardsStarLv === 'function') ? cardsStarLv(e) : ((e.starLv | 0) || 0),
      bnLearn: Array.isArray(e.bnLearn) ? e.bnLearn.slice() : null, row: s.row, col: s.col, troop: tr,
      learned: e.fig ? [] : sp.skills.filter(function (id) { return nat.indexOf(id) < 0; }),
      learnSrc: e.fig ? '' : (Array.isArray(e.bnLearn) ? 'card' : ((typeof bnSkcLearnOf === 'function' && bnSkcLearnOf(e)) ? 'skc' : 'auto')),
      drill: sp.drill || 0, drillLv: sp.drill ? Math.round(sp.drill / per) : 0,
      power: bnPower(sp), hp: sp.stats.hp, skills: sp.skills.slice(), ult: sp.ult || '', card: card, spec: bnTeamJson(sp)
    });
  });
  return out;
}
function bnTeamOrder(slots) { return slots.slice().sort(function (a, b) { return a.row - b.row || a.col - b.col; }); }

// ───────── 戰法清單 ─────────
// 依所選兵種取戰法(bn_text 的 bnCardSkillRows;缺時從單位規格只取名稱)
function bnTeamSkillRows(e, troop) {
  var sp;
  if (typeof bnCardSkillRows === 'function') { try { return bnCardSkillRows(e, { troop: troop }); } catch (er) { return []; } }
  try { sp = bnUiSpec(e, { troop: troop }); } catch (er) { return []; }
  return sp.skills.concat(sp.ult ? [sp.ult] : []).filter(function (id) { return typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]; }).map(function (id) { return { id: id, name: BN_SKILLS[id].name, cat: BN_SKILLS[id].cat }; });
}
function bnTeamSkRowHtml(r, link) {
  return '<span class="bntc-s k-' + bnTeamEsc(r.cat) + '"' + (link ? ' role="button" data-a="bskinfo" data-id="' + bnTeamEsc(r.id) + '"' : '') + '><i>' + (BNTEAM_CAT[r.cat] || '戰') + '</i><em>' + bnTeamEsc(r.name) + '</em></span>';
}
// 已選人物詳情內的戰法連結列(名稱可點開說明)
function bnTeamSkillLinksHtml(e, troop) {
  return '<span class="bntm-links">' + bnTeamSkillRows(e, troop).map(function (r) { return bnTeamSkRowHtml(r, true); }).join('') + '</span>';
}

// ───────── 武將戰法卡 ─────────
function bnTeamPortrait(e) {
  var h = '';
  if (typeof fxSilHtml === 'function') { try { h = fxSilHtml(e) || ''; } catch (er) { h = ''; } }   // 魔幻世界路人:剪影(fx_text.js);歷史世界 / 名人回 null → 原頭像
  if (!h && typeof cuPortraitImg === 'function') { try { h = cuPortraitImg(e, true); } catch (er) { h = ''; } }
  return '<span class="bntc-pt">' + (h || '<b>' + bnTeamEsc(Array.from(String(e.name))[0] || '?') + '</b>') + '</span>';
}
// o: {troop, row, col, act:'card'|'' (點卡片動作), sel, on, mini(名冊 / 地圖 / 結算縮小版:戰法只列文字), hp, hpMax, hpBar(0~1), pos}
function bnTeamCardHtml(e, o) {
  o = o || {};
  var tr = o.troop || bnUiTroopOf(e), sp = bnUiSpec(e, { troop: tr }), pw = bnPower(sp), rows = bnTeamSkillRows(e, tr), star = (typeof cardsStarLv === 'function') ? cardsStarLv(e) : (e.starLv | 0),
    apt = (bnAptOf(e).apt[tr] || 'C'), hp = o.hp !== undefined ? o.hp : sp.stats.hp, bar = o.hpBar !== undefined ? o.hpBar : 1, exp = !o.mini && !!BNTEAM.exp[e.id], n = exp ? rows.length : Math.min(BNTEAM.show, rows.length), h;
  bar = Math.max(0, Math.min(1, bar));
  h = '<div class="bntc g' + (e.gr | 0) + (o.mini ? ' mini' : '') + (o.sel ? ' sel' : '') + (o.on ? ' on' : '') + '"' + (o.act ? ' role="button" data-a="' + o.act + '" data-id="' + bnTeamEsc(e.id) + '"' : '') + '>' +
    '<div class="bntc-hd">' + bnTeamPortrait(e) + '<span class="bntc-gr">' + (BNTEAM_GR[e.gr] || '') + '</span><span class="bntc-tr' + (apt === 'C' ? ' bad' : '') + '">' + (typeof bnTroopIconHtml === 'function' ? bnTroopIconHtml(tr) : '') + bnTeamEsc(tr) + apt + '</span>' + (o.pos ? '<span class="bntc-pos">' + o.pos + '</span>' : '') + '</div>' +
    '<div class="bntc-nm">' + bnTeamEsc(e.name) + '</div>' +
    '<div class="bntc-st">' + (star > 0 ? '★'.repeat(star) : '<u>0 星</u>') + '</div>' +
    '<div class="bntc-pw">戰力 <b>' + pw + '</b></div>' +
    '<div class="bntc-hp"><span>兵力 ' + Math.round(hp) + '</span><i><b style="width:' + Math.round(bar * 100) + '%"></b></i></div>' +
    '<div class="bntc-sk">' + rows.slice(0, n).map(function (r) { return bnTeamSkRowHtml(r, !o.mini); }).join('') +
    (!o.mini && rows.length > BNTEAM.show ? '<span class="bntc-more" role="button" data-a="bexp" data-id="' + bnTeamEsc(e.id) + '">' + (exp ? '收起' : '＋' + (rows.length - BNTEAM.show) + ' 更多') + '</span>' : '') +
    (o.mini && rows.length > n ? '<span class="bntc-m2">＋' + (rows.length - n) + '</span>' : '') + '</div></div>';
  return h;
}
// 整隊 5 人並排。o: {mini, title, S(戰後狀態:兵力條顯示剩餘)}
function bnTeamStripHtml(o) {
  o = o || {};
  bnTeamCss();
  var sl = bnTeamOrder(bnu.slots || []).filter(function (s) { return !!bnUiEntry(s.id); }), tot = 0, cards = [], i, S = o.S, uA = S && S.teams && S.teams.A ? S.teams.A.units : [];
  sl.forEach(function (s) {
    var e = bnUiEntry(s.id), tr = s.troop || bnUiTroopOf(e), sp = bnUiSpec(e, { troop: tr, row: s.row, col: s.col }), u = null, k, op;
    tot += bnPower(sp);
    for (k = 0; k < uA.length; k++) if (uA[k].row === s.row && uA[k].col === s.col && uA[k].name === sp.name) { u = uA[k]; break; }
    op = { troop: tr, mini: !!o.mini, act: o.mini ? '' : 'tcard', sel: !o.mini && bnu.sel === e.id, pos: BNTEAM_ROW[s.row] + (s.col + 1) };
    if (u) { op.hp = Math.max(0, u.hp); op.hpBar = u.maxHp > 0 ? u.hp / u.maxHp : 0; }
    cards.push(bnTeamCardHtml(e, op));
  });
  for (i = sl.length; i < BNUI.maxUnits; i++) cards.push('<div class="bntc empty' + (o.mini ? ' mini' : '') + '"><span>空位</span></div>');
  return '<div class="bntm-strip' + (o.mini ? ' mini' : '') + '"><div class="bntm-h">' + bnTeamEsc(o.title || '我方隊伍') + ' · ' + sl.length + '/' + BNUI.maxUnits + ' 人 · 戰力 <b>' + tot + '</b>' + (sl.length ? '' : ' · 尚未布陣') + '</div><div class="bntm-row">' + cards.join('') + '</div></div>';
}

// ───────── 名冊:搜尋 / 排序 / 兵種篩選(篩選沿用 bnu.filter)─────────
function bnTeamRosterList() {
  var q = String(BNTEAM.q || '').trim().toLowerCase(), tl = BN_DATA.troopList, list;
  list = bnUiRosterList().map(function (x) { var t = bnUiTroopOf(x); return { e: x, t: t, pw: bnPower(bnUiSpec(x, { troop: t })) }; }).filter(function (x) { return (!bnu.filter || x.t === bnu.filter) && (BNTEAM.fac === '' || String(x.e.fac) === BNTEAM.fac) && (BNTEAM.gr === '' || String(x.e.gr) === BNTEAM.gr); });
  if (q) list = list.filter(function (x) {
    if ((String(x.e.name) + ' ' + (x.e.zi || '')).toLowerCase().indexOf(q) >= 0) return true;
    return bnTeamSkillRows(x.e, x.t).some(function (r) { return String(r.name).toLowerCase().indexOf(q) >= 0; });
  });
  list.sort(function (a, b) {
    if (BNTEAM.sort === 'gr' && b.e.gr !== a.e.gr) return b.e.gr - a.e.gr;
    if (BNTEAM.sort === 'tr' && a.t !== b.t) return tl.indexOf(a.t) - tl.indexOf(b.t);
    return b.pw - a.pw;
  });
  return list;
}
// 名冊卡(拖曳來源):縮圖 + 姓名 + 兵種圖示與適性 + 戰力;已上陣者標「上陣」。點一下 = 選取(替代操作),按住拖曳 = 上陣
function bnTeamRosterCardHtml(x) {
  var e = x.e, on = !!bnUiSlotOf(e.id), apt = (bnAptOf(e).apt[x.t] || 'C');
  return '<div class="bntm-rc g' + (e.gr | 0) + (bnu.sel === e.id ? ' sel' : '') + (on ? ' on' : '') + '" role="button" data-drag="r" data-a="card" data-id="' + bnTeamEsc(e.id) + '" aria-label="' + bnTeamEsc(e.name) + '">' +
    '<span class="bntm-th">' + bnTeamPortrait(e) + '</span>' +
    '<span class="bntm-rn">' + bnTeamEsc(e.name) + '</span>' +
    '<span class="bntm-rt">' + (typeof bnTroopIconHtml === 'function' ? bnTroopIconHtml(x.t) : '') + bnTeamEsc(x.t) + ' ' + apt + (on ? ' <em>上陣</em>' : '') + '</span>' +
    '<span class="bntm-rp">戰力 ' + x.pw + '</span></div>';
}
// 每頁 BNTEAM.per 人(300 人分頁);頁數超出時夾回最後一頁
function bnTeamRosterCards() {
  var list = bnTeamRosterList(), np, pg, from;
  if (!list.length) return '<div class="bntm-none">' + (BNTEAM.q ? '找不到「' + bnTeamEsc(BNTEAM.q) + '」' : '沒有符合的人物') + '</div>';
  np = Math.max(1, Math.ceil(list.length / BNTEAM.per));
  pg = Math.max(0, Math.min(np - 1, BNTEAM.pg | 0));
  BNTEAM.pg = pg;
  from = pg * BNTEAM.per;
  return list.slice(from, from + BNTEAM.per).map(bnTeamRosterCardHtml).join('');
}
function bnTeamPagerInner() {
  var n = bnTeamRosterList().length, np = Math.max(1, Math.ceil(n / BNTEAM.per)), pg = Math.max(0, Math.min(np - 1, BNTEAM.pg | 0));
  BNTEAM.pg = pg;
  return '<button data-a="bpg" data-t="-1"' + (pg <= 0 ? ' disabled' : '') + '>‹ 上一頁</button><span>第 ' + (pg + 1) + '/' + np + ' 頁 · 共 ' + n + ' 人</span><button data-a="bpg" data-t="1"' + (pg >= np - 1 ? ' disabled' : '') + '>下一頁 ›</button>';
}
function bnTeamRosterHtml() {
  var fac = BNTEAM.fac, gr = BNTEAM.gr, FAC = (typeof CARD_FAC !== 'undefined') ? CARD_FAC : [];
  bnTeamCss(); bnTeamBindForm(bnu.formEl);
  return '<div class="bntm-tool"><input type="search" class="bntm-q" data-in="bq" maxlength="' + BNTEAM.qMax + '" placeholder="搜尋姓名或戰法" aria-label="搜尋名冊" value="' + bnTeamEsc(BNTEAM.q) + '">' +
    BNTEAM_SORT.map(function (s) { return '<button class="' + (BNTEAM.sort === s[0] ? 'on' : '') + '" data-a="bsort" data-t="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>' +
    '<div class="bntm-tool"><select class="bntm-sel" data-in="bfac" aria-label="陣營篩選"><option value="">全部陣營</option>' + FAC.map(function (n, k) { return '<option value="' + k + '"' + (fac === String(k) ? ' selected' : '') + '>' + bnTeamEsc(n) + '</option>'; }).join('') + '</select>' +
    '<select class="bntm-sel" data-in="bgr" aria-label="品階篩選"><option value="">全品階</option>' + BNTEAM_GR.map(function (n, k) { return '<option value="' + k + '"' + (gr === String(k) ? ' selected' : '') + '>' + n + '階</option>'; }).join('') + '</select></div>' +
    '<div class="bntm-ro" data-drop="roster">' + bnTeamRosterCards() + '</div>' +
    '<div class="bntm-pgr">' + bnTeamPagerInner() + '</div>';
}
function bnTeamOnInput(ev) {
  var t = ev && ev.target, k, ro, pg, f = bnu.formEl;
  if (!t || !t.getAttribute) return;
  k = t.getAttribute('data-in');
  if (k === 'bq') BNTEAM.q = Array.from(String(t.value || '')).slice(0, BNTEAM.qMax).join('');
  else if (k === 'bfac') BNTEAM.fac = String(t.value || '');
  else if (k === 'bgr') BNTEAM.gr = String(t.value || '');
  else return;
  BNTEAM.pg = 0;
  ro = f && f.querySelector ? f.querySelector('.bntm-ro') : null;
  if (ro) ro.innerHTML = bnTeamRosterCards();
  pg = f && f.querySelector ? f.querySelector('.bntm-pgr') : null;
  if (pg) pg.innerHTML = bnTeamPagerInner();
}
function bnTeamBindForm(el) {
  if (!el || el.__bntIn) return;
  el.__bntIn = 1;
  el.addEventListener('input', bnTeamOnInput);
  el.addEventListener('change', bnTeamOnInput);
}

// ───────── 隊伍預設列 ─────────
function bnTeamPresetHtml() {
  bnTeamCss();
  var h = '<div class="bntm-pre"><div class="bntm-h">隊伍預設 <small>存入目前陣容,之後一鍵套用</small></div><div class="bntm-pl">', i, p;
  for (i = 1; i <= BNTEAM.n; i++) {
    p = bnTeamPresetGet(i);
    h += '<div class="bntm-p' + (p.empty ? ' emp' : '') + '"><button class="bntm-pn" data-a="tren" data-i="' + (i - 1) + '" aria-label="改名">' + bnTeamEsc(p.name) + (p.empty ? '' : ' ✎') + '</button><small>' + (p.empty ? '空' : p.slots.length + ' 人') + '</small>' +
      '<div class="bntm-pb"><button data-a="tload" data-i="' + (i - 1) + '"' + (p.empty ? ' disabled' : '') + '>套用</button><button data-a="tsave" data-i="' + (i - 1) + '">存入</button></div></div>';
  }
  return h + '</div></div>';
}

// ───────── 戰法說明浮層(Esc / 返回先關)─────────
function bnTeamIsOpen() { return !!(BNTEAM.infoEl && BNTEAM.infoEl.parentNode && typeof bnu !== 'undefined' && bnu.layer && BNTEAM.infoEl.parentNode === bnu.layer); }
function bnTeamInfoClick(ev) {
  var t = ev && ev.target, b = t && t.closest ? t.closest('[data-a]') : null;
  if (ev && ev.stopPropagation) ev.stopPropagation();
  if (!b || b.getAttribute('data-a') === 'bskx') bnTeamInfoClose();
}
function bnTeamInfoOpen(id) {
  var o = (typeof bnSkillInfo === 'function') ? bnSkillInfo(id) : null, el;
  if (!o && typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]) o = { title: BN_SKILLS[id].name, tags: [], lines: [] };
  if (!o || typeof bnu === 'undefined' || !bnu.layer || typeof document === 'undefined') return false;
  bnTeamCss();
  bnTeamInfoClose();
  el = document.createElement('div'); el.id = 'bnSkInfo';
  el.innerHTML = '<div class="bnsi-box" data-a="bskbox"><h4>' + bnTeamEsc(o.title) + '</h4><div class="bnsi-tags">' + (o.tags || []).map(function (t) { return '<span>' + bnTeamEsc(t) + '</span>'; }).join('') + '</div>' +
    (o.lines || []).map(function (l) { return '<p><b>' + bnTeamEsc(l[0]) + '</b> ' + bnTeamEsc(l[1]) + '</p>'; }).join('') + '<button class="bnbtn" data-a="bskx">關閉</button></div>';
  el.addEventListener('click', bnTeamInfoClick);
  bnu.layer.appendChild(el);
  BNTEAM.infoEl = el; BNTEAM.info = id;
  return true;
}
function bnTeamInfoClose() {
  var el = BNTEAM.infoEl;
  BNTEAM.infoEl = null; BNTEAM.info = '';
  if (!el) return false;
  el.removeEventListener('click', bnTeamInfoClick);
  if (el.parentNode) el.parentNode.removeChild(el);
  return true;
}
function bnTeamBack() { if (!bnTeamIsOpen()) { BNTEAM.infoEl = null; return false; } bnTeamInfoClose(); return true; }

// ───────── 動作(bnUiDo 先轉給這裡;處理了回 true)─────────
function bnTeamDo(a, id, r, c, t, i) {
  if (a === 'bskinfo') { bnTeamInfoOpen(String(id || '')); return true; }
  if (a === 'bexp') { if (BNTEAM.exp[id]) delete BNTEAM.exp[id]; else BNTEAM.exp[id] = 1; bnTeamRerender(); return true; }
  if (a === 'tcard') { bnu.sel = (bnu.sel === id) ? null : id; bnUiRenderForm(); return true; }
  if (a === 'bsort') { BNTEAM.sort = (t === 'gr' || t === 'tr') ? t : 'pw'; BNTEAM.pg = 0; bnUiRenderForm(); return true; }
  if (a === 'bpg') { BNTEAM.pg = Math.max(0, (BNTEAM.pg | 0) + (+t || 0)); bnUiRenderForm(); return true; }
  if (a === 'tsave') {
    if (!bnTeamPresetGet(i + 1)) return true;
    if (!bnTeamPresetGet(i + 1).empty && typeof confirm === 'function') { try { if (!confirm('覆蓋「' + bnTeamPresetGet(i + 1).name + '」?')) return true; } catch (er) { /* 略過 */ } }
    if (bnTeamPresetSave(i + 1) && bnu.open && bnu.phase === 'form') bnUiRenderForm();
    return true;
  }
  if (a === 'tload') { bnTeamPresetApply(i + 1); return true; }
  if (a === 'tren') { bnTeamPresetRename(i + 1); return true; }
  return false;
}
function bnTeamRerender() {
  if (!bnu.open) return;
  if (bnu.phase === 'form') bnUiRenderForm();
  else if (bnu.phase === 'map' && typeof bnMapRender === 'function') bnMapRender();
}

// ───────── CSS ─────────
function bnTeamCss() {
  var st;
  if (typeof document === 'undefined' || !document.head || document.getElementById('bnTeamStyle')) return;
  st = document.createElement('style');
  st.id = 'bnTeamStyle';
  st.textContent = '.bntm-strip{margin:4px 0 6px}.bntm-h{font-size:13px;margin:2px 0 4px;opacity:.95}.bntm-h b{color:#ffd25a}.bntm-h small{opacity:.7;font-size:12px}' +
    '.bntm-row{display:grid;grid-template-columns:repeat(5,minmax(74px,1fr));gap:4px;align-items:start;overflow-x:auto;scrollbar-width:none}.bntm-row::-webkit-scrollbar{display:none}' +
    '.bntc{position:relative;min-width:0;border-radius:8px;border:2px solid #8a8a8a;background:rgba(255,255,255,.07);color:#f4ead2;padding:3px;display:flex;flex-direction:column;gap:1px;font-size:12px;line-height:1.25;text-align:left;cursor:pointer;overflow:hidden}' +
    '.bntc.g1{border-color:#5fb878}.bntc.g2{border-color:#4f86d6}.bntc.g3{border-color:#a464d8}.bntc.g4{border-color:#e0b030}.bntc.sel{box-shadow:0 0 0 3px #ffd25a}.bntc.on{opacity:.55}' +
    '.bntc.empty{border-style:dashed;border-color:rgba(255,255,255,.28);align-items:center;justify-content:center;min-height:120px;opacity:.6;cursor:default}' +
    '.bntc-hd{position:relative;height:52px;border-radius:6px;overflow:hidden;background:rgba(0,0,0,.35)}.bntc-pt{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center}.bntc-pt img{width:100%;height:100%;object-fit:cover;object-position:50% 15%}.bntc-pt b{font-size:24px;opacity:.8}' +
    '.bntc-gr{position:absolute;left:2px;top:2px;padding:0 4px;border-radius:4px;background:rgba(0,0,0,.65);font-size:11px;font-weight:bold}.g0 .bntc-gr{color:#e6e6e6}.g1 .bntc-gr{color:#8fd9a0}.g2 .bntc-gr{color:#8ab8ff}.g3 .bntc-gr{color:#d9a0ff}.g4 .bntc-gr{color:#ffd25a}' +
    '.bntc-tr{position:absolute;right:2px;top:2px;padding:0 4px;border-radius:4px;background:rgba(0,0,0,.65);font-size:11px}.bntc-tr.bad{color:#ff9a8a}.bntc-pos{position:absolute;left:2px;bottom:2px;padding:0 4px;border-radius:4px;background:rgba(58,110,168,.85);font-size:10px}' +
    '.bntc-nm{font-size:13px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bntc-st{color:#ffd25a;font-size:11px;letter-spacing:-1px;min-height:14px}.bntc-st u{text-decoration:none;color:#f4ead2;opacity:.5;letter-spacing:0}.bntc-pw{font-size:11px}.bntc-pw b{color:#ffd25a;font-size:12px}' +
    '.bntc-hp span{font-size:11px}.bntc-hp i{display:block;height:5px;border-radius:3px;background:rgba(0,0,0,.5);overflow:hidden}.bntc-hp i b{display:block;height:100%;background:linear-gradient(90deg,#4caf50,#8fd960)}' +
    '.bntc-sk{display:flex;flex-direction:column;gap:2px;margin-top:2px}' +
    '.bntc-s{display:flex;align-items:center;gap:3px;min-height:44px;padding:0 2px;border-radius:5px;background:rgba(255,255,255,.06);font-size:12px;line-height:1.15}.bntc-s em{font-style:normal;overflow-wrap:anywhere;min-width:0}.bntm-links .bntc-s em,.bntc:not(.mini) .bntc-s em{color:#cfe3ff;text-decoration:underline}' +
    '.bntc-s i{flex:0 0 auto;font-style:normal;font-size:10px;width:16px;height:16px;line-height:16px;text-align:center;border-radius:3px;color:#fff;background:#666}' +
    '.k-command i{background:#7a4aa0}.k-active i{background:#2f6fb5}.k-pursuit i{background:#b8571f}.k-passive i{background:#3b8a5a}.k-ult i{background:#b8902a}' +
    '.bntc.mini .bntc-s{min-height:0;padding:1px 2px;font-size:11px;background:none}.bntc.mini .bntc-s i{width:14px;height:14px;line-height:14px}.bntc-m2{font-size:10px;opacity:.7}' +
    '.bntc-more{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:5px;background:rgba(201,137,47,.3);font-size:12px}' +
    '.bntm-links{display:flex;flex-wrap:wrap;gap:4px;margin:2px 0}.bntm-links .bntc-s{padding:0 8px;background:rgba(255,255,255,.1)}' +
    '.bntm-tool{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin:4px 0}.bntm-q{flex:1 1 140px;min-width:0;min-height:44px;box-sizing:border-box;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.3);color:#f4ead2;font-size:16px;padding:0 10px}' +
    '.bntm-tool button{min-height:44px;min-width:52px;border:none;border-radius:8px;background:rgba(255,255,255,.12);color:#f4ead2;font-size:13px}.bntm-tool button.on{background:#c9892f;color:#1b1308;font-weight:bold}' +
    '.bntm-ro .bntc{flex:0 0 auto;width:96px}.bntm-none{font-size:13px;opacity:.7;padding:10px}' +
    '#bnForm .bnf-chips button{min-height:44px}.bntm-pre{margin:6px 0}.bntm-pl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.bntm-p{display:flex;flex-direction:column;gap:2px;padding:3px;border-radius:8px;background:rgba(255,255,255,.08);border:1px solid rgba(201,137,47,.6);min-width:0}.bntm-p.emp{border-color:rgba(255,255,255,.2)}' +
    '.bntm-p small{font-size:11px;opacity:.75;text-align:center}.bntm-pn{min-height:44px;border:none;border-radius:6px;background:none;color:#ffd25a;font-size:14px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bntm-p.emp .bntm-pn{color:#f4ead2;opacity:.75}' +
    '.bntm-pb{display:flex;gap:3px}.bntm-pb button{flex:1;min-width:0;min-height:44px;border:none;border-radius:6px;background:rgba(255,255,255,.14);color:#f4ead2;font-size:13px;padding:0}.bntm-pb button[disabled]{opacity:.35}' +
    '.bntm-strip.mini .bntc-hd{height:40px}.bntm-strip.mini .bntc.empty{min-height:80px}.bnbox .bntm-strip{text-align:left}.bnbox .bntm-row{grid-template-columns:repeat(5,minmax(60px,1fr))}' +
    '@media (orientation:landscape) and (min-width:700px){.bntm-ro{flex-wrap:wrap}.bntm-row{grid-template-columns:repeat(5,minmax(0,1fr))}}' +
    '#bnSkInfo{position:absolute;left:0;top:0;right:0;bottom:0;z-index:7;display:flex;align-items:center;justify-content:center;background:rgba(10,8,6,.6)}' +
    '.bnsi-box{width:min(92vw,400px);max-height:86vh;overflow:auto;box-sizing:border-box;border-radius:12px;background:#2a2118;border:2px solid #c9892f;padding:12px 14px;color:#f4ead2}.bnsi-box h4{margin:0 0 6px;font-size:18px}.bnsi-box p{margin:5px 0;font-size:14px;line-height:1.5}.bnsi-box p b{color:#f0b45a}' +
    '.bnsi-tags span{display:inline-block;margin:0 4px 4px 0;padding:0 6px;border:1px solid rgba(255,255,255,.4);border-radius:4px;font-size:12px}.bnsi-box .bnbtn{display:block;width:100%;margin-top:8px}' +
    '.bntm-ro{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:5px;margin:4px 0}' +
    '.bntm-rc{position:relative;min-width:0;box-sizing:border-box;padding:3px;border-radius:8px;border:2px solid #8a8a8a;background:rgba(255,255,255,.07);color:#f4ead2;display:flex;flex-direction:column;gap:2px;font-size:12px;line-height:1.2;text-align:left;cursor:grab;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}' +
    '.bntm-rc.g1{border-color:#5fb878}.bntm-rc.g2{border-color:#4f86d6}.bntm-rc.g3{border-color:#a464d8}.bntm-rc.g4{border-color:#e0b030}.bntm-rc.sel{box-shadow:0 0 0 3px #ffd25a}.bntm-rc.on{opacity:.55}' +
    '.bntm-th{position:relative;display:block;height:44px;border-radius:5px;overflow:hidden;background:rgba(0,0,0,.35)}.bntm-rc img,.bntm-th img{pointer-events:none;-webkit-user-drag:none}' +
    '.bntm-rn{font-size:13px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bntm-rt{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bntm-rt em{font-style:normal;color:#ffd25a}.bntm-rp{font-size:11px;opacity:.85}' +
    '.bntm-pgr{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:4px 0 8px;font-size:13px}.bntm-pgr button{min-height:44px;min-width:84px;border:none;border-radius:8px;background:rgba(255,255,255,.14);color:#f4ead2;font-size:14px}.bntm-pgr button[disabled]{opacity:.35}' +
    '.bntm-sel{flex:1 1 120px;min-width:0;min-height:44px;box-sizing:border-box;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.3);color:#f4ead2;font-size:14px;padding:0 6px}.bntm-sel option{background:#2a2118;color:#f4ead2}';
  document.head.appendChild(st);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { BNTEAM: BNTEAM };
