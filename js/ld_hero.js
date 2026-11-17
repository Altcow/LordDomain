// js/ld_hero.js — 武將詳情頁(設計_介面骨架實作計畫.md §3-4、任務卡 2;第 2 階段)。前綴 ldHero。頁 id 'hero'、'heroInfo'(滿版詳情頁)、'heroSkills'(推薦戰法頁)與 'heroSkillPick'(戰法選擇,第 5 層時不開)。
// ctx = { id, list:[卡片 id 依序] };ctx 內部狀態:tab(attr|bio|inh)、inhConfirm。‹ › 只換 ctx.id,不新增層。
// 2026-11-16:點適性 / 數值 / 裝備 / 自帶戰法 → 開 heroInfo 滿版詳情頁(全文可捲動);點選擇槽 → 開 heroSkills 推薦戰法頁(上方戰法格 + 下方整區可捲動說明;格子標「推薦」徽章與 可拆 / 未得 狀態)。三頁都只有左上返回、沒有右上 ×(noClose)。
// 版面:橫式(基準 844x390)左立繪 34% + 右面板 + 右側書籤直排;直式立繪在上、書籤一排、面板可捲動(CSS 以 orientation 切換,見 css/ld_hero.css)。
// 資料來源:cardsFind / cardsStats / bnPower(bnUnitSpec) / bnAptOf / CARD_FAC / cardsStarLv;戰法 bnSkillInfo / cuCSkillRows;裝卸 bnSkcCanEquip / bnSkcEquip / bnSkcUnequip;傳承 cuInhState / bnSkcInherit。
// e.star 是「鎖定防誤遣散」旗標(不是星等,星等 e.starLv):青銅六角 = 鎖定切換(同 cardsui.js 的 a === 'star')。升星入口不在武將介面(由熔爐頁自己處理)。
// 素材走 ld_art.js 佔位(has:false = CSS 徽章 + 單一漢字)。純函式與 DOM 分開,供 tools/test_ld_hero.js 測試。ES2017,不用 ?. ??。
var LDHERO_TABS = [['attr', '屬性'], ['inh', '傳承'], ['bio', '傳記']];
var LDHERO_EQ = [['eq_weapon', '武器'], ['eq_armor', '防具'], ['eq_horse', '馬'], ['eq_treasure', '寶具']];
var LDHERO_ST = [['st_tong', '統'], ['st_wu', '武'], ['st_zhi', '智'], ['st_zheng', '政'], ['st_mei', '魅']];
var LDHERO_ST_INFO = [
  '統率:主要提高兵力與防禦。',
  '武力:主要提高攻擊,也加兵力與速度。',
  '智謀:主要提高謀略(法術傷害),也加速度、治療與法術抵抗。',
  '政務:提高治療、減益抵抗與護盾。',
  '魅力:人望與號召相關,目前戰鬥數值公式沒有直接使用。'
];
var LDHERO_REASON = { none: '此人不在卡包,不能裝備', own: '此戰法尚未解鎖', slot: '此槽位目前未開放', dup: '同一人兩槽不可裝同一戰法', legion: '兵種卡每人 1 張,且限同兵種', troop: '此戰法限特定兵種裝備', full: '已達同時裝備上限,需先卸下他人' };
var LDHERO_INH_REASON = { none: '沒有可傳承的戰法', grade: '品階未達紫,不可傳承', locked: '已鎖定,先解除鎖定才能傳承', owned: '此人的傳承戰法已擁有,可改用熔爐' };
var LDHERO_TIER_ORD = ['S', 'A', 'B', 'C'];
var LDHERO_DEF_INFO = '點上方任一格,這裡會顯示說明。';

function ldHeroEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function ldHeroToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function ldHeroCs() { return typeof cardsGet === 'function' ? cardsGet() : null; }
// 素材佔位(HTML 字串版):has:false = CSS 徽章 + 單一漢字;has:true 才用 ldArt 產生的元素(圖到後 ld_art.js 該筆改 true 即可)
function ldHeroArt(key, cls) {
  var a = (typeof LD_ART !== 'undefined') ? LD_ART[key] : null, el;
  if (a && typeof ldArtHas === 'function' && ldArtHas(key) && typeof ldArt === 'function') {
    try { el = ldArt(key, cls); if (el && el.outerHTML) return el.outerHTML; } catch (e) { /* 退回佔位 */ }
  }
  return '<span class="ld-ph ' + (cls || '') + '" data-art="' + ldHeroEsc(key) + '">' + ldHeroEsc(a ? a.ph : '') + '</span>';
}
function ldHeroSave() { if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } } }
// 變更後同步:存檔 + 底下的卡包網格重畫(卡包面板開著才需要)
function ldHeroSync() {
  ldHeroSave();
  try { if (typeof cu !== 'undefined' && cu && cu.open && typeof cardsUiRender === 'function') cardsUiRender(); } catch (e) { /* 略過 */ }
}
function ldHeroTroop(e) { return (typeof bnDefaultTroop === 'function') ? (bnDefaultTroop(e) || '') : ''; }
function ldHeroPower(e) {
  try { return bnPower(bnUnitSpec(e, { troop: ldHeroTroop(e) })); } catch (er) { return null; }
}
function ldHeroApt(e) {
  var r = bnAptOf(e), list = (typeof BN_DATA !== 'undefined' && BN_DATA.troopList) || ['槍', '騎', '盾', '弓', '械'];
  return list.map(function (t) { return { t: t, g: r.apt[t], sc: r.scores[t] }; });
}
function ldHeroFacName(e) { return (typeof CARD_FAC !== 'undefined' && CARD_FAC[e.fac]) || ''; }
// 立繪網址:名人 fullbody,沒圖由 <img onerror> 退到兵種站姿圖(bn_body_*)
function ldHeroFallbackSrc(e) {
  if (typeof bnstTroopSrc === 'function') return bnstTroopSrc(ldHeroTroop(e));
  return 'assets/fullbody/bn_body_inf.webp';
}
function ldHeroFigSrc(e) {
  if (e.fig) return (typeof fxFigImg === 'function' && fxFigImg(e.fig, 'fullbody')) || ('assets/fullbody/' + e.fig + '.webp');
  return ldHeroFallbackSrc(e);
}
// ‹ › 依 ctx.list 切換:回 { idx, total, prev, next };清單找不到本人時 idx = -1
function ldHeroNav(cs, ctx) {
  var list = (ctx.list && ctx.list.length) ? ctx.list : [ctx.id], idx = list.indexOf(ctx.id), g, top;
  if (idx < 0 && typeof cuGridItemOf === 'function' && cs) {
    try { g = cuGridItemOf(cs, ctx.id); top = g && g.top ? g.top.id : null; if (top) idx = list.indexOf(top); } catch (e) { idx = -1; }
  }
  return { idx: idx, total: list.length, prev: idx > 0 ? list[idx - 1] : null, next: (idx >= 0 && idx < list.length - 1) ? list[idx + 1] : null };
}
// 三個技能槽:第 1 槽 = 自帶戰法;第 2、3 = 選擇槽 0、1。回 [{ kind:'fixed'|'none'|'sel'|'empty'|'lock', id, i, flag }]
function ldHeroSlots(cs, f) {
  var e = f.e, inR = f.list === 'roster', rows = (typeof cuCSkillRows === 'function') ? cuCSkillRows(e, inR) : [], fixed = null, out = [], eq = bnSkcLoad().eq[e.id] || [null, null], n = bnSkcSlots(e), i, ok;
  rows.forEach(function (r) { if (r.id && r.slot < 0 && !r.auto && !fixed && r.cat === 'ult') fixed = r; });
  if (!fixed) rows.forEach(function (r) { if (r.id && r.slot < 0 && !r.auto && !fixed) fixed = r; });
  out.push(fixed ? { kind: 'fixed', id: fixed.id, i: -1, tag: '自帶' } : { kind: 'none', id: '', i: -1, tag: '自帶' });
  for (i = 0; i < 2; i++) {
    if (i >= n) out.push({ kind: 'lock', id: '', i: i, tag: '選擇槽' });
    else if (eq[i]) out.push({ kind: 'sel', id: eq[i], i: i, tag: '選擇槽' });
    else { ok = inR && ldHeroCanAny(cs, e, i); out.push({ kind: 'empty', id: '', i: i, tag: '選擇槽', flag: !!ok }); }
  }
  return out;
}
// 這個空槽有沒有任何已解鎖戰法可以裝(紅小旗)
function ldHeroCanAny(cs, e, slot) {
  var own = Object.keys(bnSkcLoad().own), i;
  for (i = 0; i < own.length; i++) if (bnSkcTier(own[i]) && bnSkcCanEquip(cs, e, slot, own[i]).ok) return true;
  return false;
}
function ldHeroSkName(id) { return (typeof cuCSkName === 'function') ? cuCSkName(id) : ((typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]) ? BN_SKILLS[id].name : String(id)); }
function ldHeroSkShort(id) { return (typeof cuCShort === 'function') ? cuCShort(id) : ''; }
function ldHeroSkInfo(id) { return (typeof cuCInfo === 'function') ? cuCInfo(id) : (typeof bnSkillInfo === 'function' ? bnSkillInfo(id) : null); }

// ───────── 說明區 ─────────
function ldHeroInfoLines(title, lines) {
  return '<b>' + ldHeroEsc(title) + '</b>' + lines.map(function (l) { return '<span>' + ldHeroEsc(l) + '</span>'; }).join('');
}
// key:apt:槍 / st:0 / pow / eq:0 / sk:戰法id / sl:0(選擇槽 0)/ 空字串 = 預設
function ldHeroInfoHtml(cs, f, ctx) {
  var e = f.e, key = ctx.info || '', p = key.split(':'), k = p[0], v = p.slice(1).join(':'), info, ap, g, m, i, sl, lines;
  if (!key) return '<span>' + LDHERO_DEF_INFO + '</span>';
  if (k === 'apt') {
    ap = bnAptOf(e); g = ap.apt[v];
    m = (typeof BN_DATA !== 'undefined' && BN_DATA.apt) ? BN_DATA.apt : { S: 1.1, A: 1, B: 0.9, C: 0.8 };
    return ldHeroInfoLines(v + '兵適性 ' + g, ['評分 ' + Math.round(ap.scores[v]) + ';此兵種的兵力、攻擊、防禦 ×' + (m[g] || 1).toFixed(2) + '(S ' + m.S.toFixed(2) + ' / A ' + m.A.toFixed(2) + ' / B ' + m.B.toFixed(2) + ' / C ' + m.C.toFixed(2) + ')。' + (v === ldHeroTroop(e) ? '目前主力兵種。' : '')]);
  }
  if (k === 'st') { i = +v; return ldHeroInfoLines(LDHERO_ST[i][1] + ' ' + cardsStats(e)[i], [LDHERO_ST_INFO[i]]); }
  if (k === 'pow') return ldHeroInfoLines('戰力 ' + (ldHeroPower(e) === null ? '—' : ldHeroPower(e)), ['依兵力、攻擊、謀略、防禦、速度與戰法數換算的綜合評分,只用來顯示,不影響戰鬥。']);
  if (k === 'eq') return (typeof ldEquipInfoHtml === 'function') ? ldEquipInfoHtml(e.id, +v) : ldHeroInfoLines(LDHERO_EQ[+v][1], ['目前尚未開放。']);   // js/ld_equip_ui.js
  if (k === 'sk') {
    info = ldHeroSkInfo(v);
    if (!info) return '<span>查無此戰法</span>';
    lines = info.lines.map(function (l) { return l[0] + ':' + l[1]; });
    return ldHeroInfoLines(info.title, lines);
  }
  if (k === 'sl') {
    i = +v; sl = ldHeroSlots(cs, f)[i + 1];
    if (!sl || sl.kind === 'lock') return ldHeroInfoLines('選擇槽 ' + (i + 1), ['品階提升到青以上才開放第 2 個選擇槽。']);
    return ldHeroInfoLines('選擇槽 ' + (i + 1), [f.list === 'roster' ? '尚未裝備戰法。點選擇槽進入推薦戰法頁選擇。' : '非卡包人員不能裝備戰法(先收入卡包)。']);
  }
  return '<span>' + LDHERO_DEF_INFO + '</span>';
}

// ───────── 各書籤內容 ─────────
function ldHeroSel(ctx, key) { return ''; }   // 說明已改開滿版頁,格子不再有選取態(保留函式讓各處組字不用改)
function ldHeroTabAttr(cs, f, ctx) {
  var e = f.e, st = cardsStats(e), pow = ldHeroPower(e), h = '', apts = ldHeroApt(e), troop = ldHeroTroop(e), sl = ldHeroSlots(cs, f), i;
  h += '<div class="ldh-apts">' + apts.map(function (a) {
    return '<div class="ldh-cap g' + ldHeroEsc(a.g) + (a.t === troop ? ' main' : '') + ldHeroSel(ctx, 'apt:' + a.t) + '" role="button" tabindex="0" data-info="apt:' + ldHeroEsc(a.t) + '"><i>' + ldHeroEsc(a.t) + '</i><b>' + ldHeroEsc(a.g) + '</b></div>';
  }).join('') + '</div>';
  h += '<div class="ldh-sts">';
  for (i = 0; i < 5; i++) h += '<div class="ldh-st' + ldHeroSel(ctx, 'st:' + i) + '" role="button" tabindex="0" data-info="st:' + i + '">' + ldHeroArt(LDHERO_ST[i][0], 'ldh-ico') + '<i>' + LDHERO_ST[i][1] + '</i><b>' + st[i] + '</b></div>';
  h += '<div class="ldh-st pow' + ldHeroSel(ctx, 'pow') + '" role="button" tabindex="0" data-info="pow">' + ldHeroArt('st_pow', 'ldh-ico') + '<i>戰力</i><b>' + (pow === null ? '—' : pow) + '</b></div></div>';
  h += '<div class="ldh-eqs">' + LDHERO_EQ.map(function (q, k) {
    return '<button class="ldh-eq' + ldHeroSel(ctx, 'eq:' + k) + '" data-info="eq:' + k + '" aria-label="' + q[1] + '">' + ((typeof ldEquipSlotInner === 'function' && ldEquipSlotInner(e.id, k, q)) || (ldHeroArt(q[0], 'ldh-eqi') + '<i>' + q[1] + '</i>')) + '</button>';
  }).join('') + '</div>';
  h += '<div class="ldh-sks">' + sl.map(function (s, k) {
    var key = s.kind === 'fixed' ? 'sk:' + s.id : '', go = (s.kind === 'sel' || s.kind === 'empty' || s.kind === 'lock'), cls = 'ldh-sk ' + s.kind + (k === 0 ? ' fx' : ''), body;
    if (s.kind === 'fixed' || s.kind === 'sel') body = '<b>' + ldHeroEsc(ldHeroSkName(s.id)) + '</b>';
    else if (s.kind === 'lock') body = '<b class="lk">鎖</b><u>青階開放</u>';
    else if (s.kind === 'empty') body = '<b class="em">空槽</b>';
    else body = '<b class="em">—</b>';
    return '<button class="' + cls + '"' + (key ? ' data-info="' + ldHeroEsc(key) + '"' : (go ? ' data-act="skills" data-v="' + s.i + '"' : '')) + '><i>' + s.tag + '</i>' + body + (s.flag ? '<em class="ldh-flag" aria-label="可裝備"></em>' : '') + '</button>';
  }).join('') + '</div>';
  return h;
}
// ───────── 推薦裝備與一鍵套用(R4;設計 3-3) ─────────
function ldHeroRecPlan(cs, f) {
  var p;
  if (!f || f.list !== 'roster' || typeof skrHeroPlan !== 'function') return null;
  try { p = skrHeroPlan(cs, f.e); } catch (er) { return null; }
  return (p && p.ok) ? p : null;
}
function ldHeroSkBtn(id) { return '<button class="ldh-mini sm" data-act="skview" data-v="' + ldHeroEsc(id) + '">看戰法詳情 ›</button>'; }
function ldHeroTier(id) { try { return (typeof bnSkcTier === 'function' && bnSkcTier(id)) || ''; } catch (er) { return ''; } }
// 套用推薦:有要換掉現有戰法時先行內確認(confirmed = true 才真的寫)
function ldHeroRecApply(ctx, cs, f, confirmed) {
  var p = ldHeroRecPlan(cs, f), r, msg, miss;
  if (!p) return false;
  if (!p.changes.length) { ldHeroToast('目前已經是推薦配置'); return true; }
  if (!confirmed && p.changes.some(function (c) { return c.old && c.old !== c.id; })) { ctx.recConfirm = true; return false; }
  r = skrApply(cs, p);
  ctx.recConfirm = false;
  if (!r.ok) { ldHeroToast('無法套用:' + (r.reason === 'busy' ? '對方在隊伍或外勤中' : (LDHERO_REASON[r.reason] || '請稍後再試'))); return true; }
  ldHeroSync();
  msg = r.text || '已套用';
  p.miss.forEach(function (m) { msg += ';缺『' + (m.name || ldHeroSkName(m.id)) + '』:' + ((m.src && m.src.text) || '目前無法取得'); });
  ldHeroToast(msg);
  return true;
}
// ───────── 推薦戰法頁(選擇槽):上方 1~2 行戰法格、下方整區說明(可捲動);格子標「推薦」小徽章,狀態 = 自帶 / 已裝 / 可裝 / 可拆 / 未得 ─────────
// 缺的戰法來源在某張卡上(傳承)= 可拆:說明區給〔拆〕鈕,開那張卡的傳承頁,沿用原本的拆卡確認流程;其餘 = 未得
function ldHeroSkSrcCard(m) { var s = (m && m.src) || {}, e = s.e; return (e && e.id && (s.k === 'inh' || s.k === 'inhWait' || s.k === 'inhRoster')) ? e : null; }
// 回 [{ key, kind:'sk'|'empty'|'lock', id, slot, st:'自帶'|'自動'|'已裝'|'可裝'|'可傳承'|'未得'|'空槽'|'鎖', rec, m, tk, why }]
function ldHeroSkCells(cs, f) {
  var e = f.e, inR = f.list === 'roster', p = ldHeroRecPlan(cs, f), rows = (typeof cuCSkillRows === 'function') ? cuCSkillRows(e, inR) : [], out = [], seen = {}, recIdx = {}, eqs = [];
  function add(c) { if (c.kind === 'sk') { if (!c.id) return; if (c.slot === -1) c.key = 'fx:' + c.id; else { if (seen[c.id]) return; seen[c.id] = 1; c.key = 'sk:' + c.id; } } out.push(c); }   // 自帶 / 自動戰法的格子另用 fx: 鍵(同一戰法也可能同時是推薦的缺項)
  if (p) p.rec.forEach(function (id, i) { recIdx[id] = i; });
  rows.forEach(function (r) {
    if (r.lock) add({ key: 'lock:' + r.slot, kind: 'lock', id: '', slot: r.slot, st: '鎖' });
    else if (r.empty) add({ key: 'empty:' + r.slot, kind: 'empty', id: '', slot: r.slot, st: '空槽' });
    else if (r.id && r.slot < 0) add({ kind: 'sk', id: r.id, slot: -1, st: r.auto ? '自動' : '自帶', rec: false });
    else if (r.id) eqs.push(r);
  });
  if (p) {
    p.rec.forEach(function (id, i) {
      var on = p.cur.indexOf(id) >= 0, tk = p.take.filter(function (t) { return t.id === id; })[0] || null;
      add({ kind: 'sk', id: id, slot: on ? p.cur.indexOf(id) : -2, st: on ? '已裝' : '可裝', rec: true, tk: tk, why: skrWhyText(p.why[i]) });
    });
    p.miss.forEach(function (m) { add({ kind: 'sk', id: m.id, slot: -2, st: ldHeroSkSrcCard(m) ? '可傳承' : '未得', rec: true, m: m }); });
  }
  eqs.forEach(function (r) { add({ kind: 'sk', id: r.id, slot: r.slot, st: '已裝', rec: false }); });
  return out;
}
// 一列一筆(2026-11-16):列首標籤(自帶 / 已裝備 / 推薦 / 空槽 / 鎖)+ 階級小標 + 戰法名 + 列尾狀態(只有推薦列:可學習 / 可裝備 / 未得)。「自動」與「自帶」玩家介面不區分,一律標「自帶」
function ldHeroSkGroup(c) { return (c.st === '自帶' || c.st === '自動') ? 0 : (c.st === '已裝' || c.kind === 'empty' || c.kind === 'lock') ? 1 : 2; }
function ldHeroSkTag(c) { var g = ldHeroSkGroup(c); return c.kind === 'empty' ? '空槽' : c.kind === 'lock' ? '鎖' : g === 0 ? '自帶' : g === 1 ? '已裝備' : '推薦'; }
function ldHeroSkRst(c) { return ldHeroSkGroup(c) === 2 ? (c.st === '可傳承' ? ['可傳承', 'cut'] : c.st === '可裝' ? ['可裝備', 'can'] : ['未得', 'no']) : null; }
// 固定排序:自帶 → 已裝備(含空槽,依槽位)→ 推薦(維持推薦順序)
function ldHeroSkSorted(cells) {
  return cells.map(function (c, i) { return { c: c, i: i }; }).sort(function (x, y) {
    var gx = ldHeroSkGroup(x.c), gy = ldHeroSkGroup(y.c);
    if (gx !== gy) return gx - gy;
    if (gx === 1) { var sx = x.c.slot < 0 || x.c.slot === undefined ? 9 : x.c.slot, sy = y.c.slot < 0 || y.c.slot === undefined ? 9 : y.c.slot; if (sx !== sy) return sx - sy; }
    return x.i - y.i;
  }).map(function (o) { return o.c; });
}
function ldHeroSkRowHtml(c, ctx, first) {
  var nm, t = '', g = ldHeroSkGroup(c), rs = ldHeroSkRst(c);
  if (c.kind === 'sk') { nm = ldHeroSkName(c.id); t = ldHeroTier(c.id); }
  else nm = c.kind === 'lock' ? '選擇槽(青階開放)' : '(尚未裝備)';
  return '<div class="ldh-skr g' + g + ' k' + c.kind + (first ? ' first' : '') + (ctx.skSel === c.key ? ' sel' : '') + '" role="button" tabindex="0" data-act="skpick" data-v="' + ldHeroEsc(c.key) + '">' +
    '<u class="tag t' + g + '">' + ldHeroSkTag(c) + '</u>' + (t ? '<i class="tg t' + ldHeroEsc(t) + '">' + ldHeroEsc(t) + '</i>' : '') + '<b>' + ldHeroEsc(nm) + '</b>' + (rs ? (c.st === '可傳承' && ldHeroSkSrcCard(c.m) ? '<button class="rst cut btn" data-act="skinh" data-v="' + ldHeroEsc(ldHeroSkSrcCard(c.m).id) + '" aria-label="可傳承,按下確認">傳承</button>' : '<span class="rst ' + rs[1] + '">' + rs[0] + '</span>') : '') + '</div>';
}
function ldHeroSkLines(id) {
  var info = ldHeroSkInfo(id), lines = (info && info.lines) ? info.lines : [];
  if (!info) return '<p>查無此戰法</p>';
  return lines.map(function (l) { return '<p><em>' + ldHeroEsc(String(l[0]).replace('事蹟 / 典故', '典故')) + '</em>' + ldHeroEsc(l[1]) + '</p>'; }).join('');
}
// 「拆」的資訊:來源卡、結果預覽(得到碎片 / 轉流浪)、成本(請回碎片),全部沿用 skrInhAdvice 的算法
function ldHeroSkCutInfo(cs, c) {
  var src = ldHeroSkSrcCard(c.m), adv, h = '', n;
  h += '<p class="ldh-cuts"><em>來源</em>' + ldHeroEsc((c.m.src && c.m.src.text) || '拆卡可得') + '</p>';
  if (src) {
    try { adv = ldHeroAdvice(cs, src); } catch (er) { adv = null; }
    if (adv && adv.nums) {
      n = adv.nums;
      h += '<p><em>拆了會</em>得到碎片 ' + n.frag + ';' + (src.fig ? '這張轉為流浪(星等保留),之後要請回花 ' + n.recall + ' 碎片' : '這位路人會消失,不能請回') + '</p>';
    }
    if (adv && adv.text) h += '<p><em>建議</em>' + ldHeroEsc(adv.title ? adv.title + '。' : '') + ldHeroEsc(adv.text) + '</p>';
  }
  return h;
}
function ldHeroSkApplyHtml(cs, f, ctx) {
  var p = ldHeroRecPlan(cs, f), replaced;
  if (!p || (!p.rec.length && !p.miss.length)) return '';
  if (!p.changes.length) return '<p class="ldh-mute">' + (p.rec.length ? '目前已經是推薦配置。' : '推薦的戰法你都還沒解鎖。') + '</p>';
  if (ctx.recConfirm) {
    replaced = p.changes.filter(function (c) { return c.old && c.old !== c.id; }).map(function (c) { return '『' + ldHeroSkName(c.old) + '』'; });
    return '<div class="ldh-warn">會換掉 ' + ldHeroEsc(replaced.join('、')) + ',確定?</div><div class="ldh-acts"><button class="ldh-mini" data-act="recno">取消</button><button class="ldh-mini warn" data-act="recyes">確定套用</button></div>';
  }
  return '<div class="ldh-acts"><button class="ldh-mini warn" data-act="recapply">一鍵套用推薦(' + p.n + ' 個選擇槽)</button></div>';
}
function ldHeroSkDescHtml(cs, f, ctx, cells) {
  var c = cells.filter(function (x) { return x.key === ctx.skSel; })[0], inR = f.list === 'roster', h = '', acts = '', p = ldHeroRecPlan(cs, f), t, src;
  if (!c) {
    h = '<b>選擇槽</b><p>點上方任一列,這裡會顯示說明與狀態。標「推薦」的是依武將特性推薦的戰法。</p>' + (inR ? '' : '<p>非卡包人員不能裝備戰法(先收入卡包)。</p>');
    if (p) p.busy.forEach(function (b) { if (p.rec.indexOf(b.id) < 0) h += '<p class="ldh-mute">『' + ldHeroEsc(ldHeroSkName(b.id)) + '』目前在 ' + ldHeroEsc(b.holderName || '別人') + '(' + ldHeroEsc(b.why || '使用中') + ')身上,先不拿。</p>'; });
    return h + ldHeroSkApplyHtml(cs, f, ctx) + '<div class="ldh-acts"><button class="ldh-mini" data-act="skdex">看更多候選 ›</button></div>';
  }
  if (c.kind === 'lock') return '<b>選擇槽 ' + (c.slot + 1) + '(未開放)</b><p>品階提升到青以上才有第 2 個選擇槽。</p>';
  if (c.kind === 'empty') {
    h = '<b>空槽(選擇槽 ' + (c.slot + 1) + ')</b><p>' + (ctx.last ? '請從卡包進入更換。' : '尚未裝備戰法。') + '</p>';
    if (inR && !ctx.last) h += '<div class="ldh-acts"><button class="ldh-mini" data-act="pick" data-v="' + c.slot + '">選擇戰法</button></div>';
    return h;
  }
  t = ldHeroTier(c.id);
  h = '<b>' + (t ? '<i class="tg t' + ldHeroEsc(t) + '">' + ldHeroEsc(t) + '</i> ' : '') + ldHeroEsc(ldHeroSkName(c.id)) + (c.rec ? ' <i class="tg star">推薦</i>' : '') + '</b>';
  if (c.st === '可傳承') {
    src = ldHeroSkSrcCard(c.m);
    h += '<p class="ldh-stl cut">狀態:可傳承 — 還沒解鎖,拆「' + ldHeroEsc(src ? src.name : '') + '」的傳承即可取得。</p>' + ldHeroSkCutInfo(cs, c);
    acts = src ? '<button class="ldh-mini warn" data-act="skinh" data-v="' + ldHeroEsc(src.id) + '">傳承</button>' : '<p class="ldh-mute">這個戰法的來源卡目前不在,先到卡包確認。</p>';
  } else if (c.st === '未得') {
    h += '<p class="ldh-stl no">狀態:未得 — ' + ldHeroEsc((c.m && c.m.src && c.m.src.text) || '目前無法取得') + '</p>';
  } else if (c.st === '已裝') {
    h += '<p class="ldh-stl have">狀態:已裝備' + (c.slot >= 0 ? '(選擇槽 ' + (c.slot + 1) + ')' : '') + '。</p>' + (c.why ? '<p>' + ldHeroEsc(c.why) + '</p>' : '');
    if (inR && c.slot >= 0) acts = (ctx.last ? '' : '<button class="ldh-mini" data-act="pick" data-v="' + c.slot + '">更換</button>') + '<button class="ldh-mini warn" data-act="uneq" data-v="' + c.slot + '">卸下</button>';
  } else if (c.st === '可裝') {
    h += '<p class="ldh-stl can">狀態:可裝備 — 已解鎖,還沒裝上。' + (c.tk ? '會從 ' + ldHeroEsc(c.tk.fromName || '別人') + ' 身上拿來。' : '') + '</p>' + (c.why ? '<p>' + ldHeroEsc(c.why) + '。</p>' : '');
    if (inR) acts = '<button class="ldh-mini warn" data-act="skequip" data-v="' + ldHeroEsc(c.id) + '">裝上</button>';
  } else h += '<p class="ldh-stl have">狀態:自帶 — ' + (c.st === '自動' ? '預設習得,不用裝備。' : '武將本來就有的固定戰法。') + '</p>';
  h += ldHeroSkLines(c.id);
  if (ldHeroTier(c.id)) acts += ldHeroSkBtn(c.id);
  return h + (acts ? '<div class="ldh-acts">' + acts + '</div>' : '');
}
function ldHeroTabBio(cs, f) {
  var t = (typeof cuBioText === 'function') ? cuBioText(f.e) : '';
  return '<div class="ldh-bio">' + String(t).split('\n').filter(function (s) { return s; }).map(function (s) { return '<p>' + ldHeroEsc(s) + '</p>'; }).join('') + '</div>';
}
// ───────── 傳承分頁(R3;設計_傳承選擇與推薦戰法.md 第二節):傳承戰法 / 拆了會怎樣 / 誰裝最強 / 這張要不要拆 ─────────
function ldHeroKit() { return (typeof BN_KIT_CFG !== 'undefined' && BN_KIT_CFG) || {}; }
function ldHeroPct(x) { return Math.round((+x || 0) * 100); }
function ldHeroFigName(fig) { return (typeof skrFigName === 'function') ? skrFigName(fig) : String(fig || ''); }
function ldHeroAdvice(cs, e) { return (typeof skrInhAdvice === 'function') ? skrInhAdvice(cs, e) : { k: 'gray', code: 'none', title: '現在不能拆', text: '無法判斷', btn: '', spare: null, nums: { frag: 0, recall: 0, furnace: 0, net: 0 } }; }
// 這位名人在我這裡的狀態:roster(在卡包,優先主力)/ owned(只在待定或流浪)/ none
function ldHeroFigState(cs, fig) {
  var cp = (typeof skrCopies === 'function') ? skrCopies(cs, fig) : { main: null, spares: [] }, k = (cs.roster || []).filter(function (z) { return z.fig === fig; }), mf;
  if (k.length) { mf = cp.main ? cardsFind(cs, cp.main.id) : null; return { state: 'roster', e: (mf && mf.list === 'roster') ? mf.e : k[0] }; }
  return cp.main ? { state: 'owned', e: cp.main } : { state: 'none', e: null };
}
function ldHeroAvatar(fig, name) {
  var src = (typeof fxFigImg === 'function' && fxFigImg(fig)) || ('assets/portraits/' + fig + '.webp');
  return '<span class="ldh-av"><u>' + ldHeroEsc(String(name || '').charAt(0)) + '</u><img alt="" src="' + ldHeroEsc(src) + '" onerror="this.remove()"></span>';
}
// 推薦頭像清單(本命排第一,再接 skrSkillHeroes 的順序);回 [{fig, name, state, e, home, whyText}]
function ldHeroInhHeroes(cs, sid, fig, n) {
  var out = [], seen = {}, list = (typeof skrSkillHeroes === 'function') ? skrSkillHeroes(cs, sid) : [], st;
  function add(h) { if (!h || seen[h.fig]) return; seen[h.fig] = 1; out.push(h); }
  if (fig) { st = ldHeroFigState(cs, fig); add({ fig: fig, name: ldHeroFigName(fig), state: st.state, e: st.e, home: true, whyText: '' }); }
  list.forEach(add);
  return out.slice(0, n || 3);
}
function ldHeroHeroBtn(h, act, val) {
  var tag = h.home ? '本命' : (h.state === 'roster' ? '在卡包' : h.state === 'owned' ? '不在卡包' : '未擁有');
  return '<button class="ldh-hero ' + h.state + (h.home ? ' home' : '') + '" data-act="' + act + '" data-v="' + ldHeroEsc(val) + '">' + ldHeroAvatar(h.fig, h.name) + '<b>' + ldHeroEsc(h.name) + '</b><i>' + tag + '</i>' + (h.home || !h.whyText ? '' : '<em>' + ldHeroEsc(h.whyText) + '</em>') + '</button>';
}
function ldHeroSec(cls, title, body) { return '<div class="ldh-sec ' + cls + '"><h4>' + ldHeroEsc(title) + '</h4>' + body + '</div>'; }
// 傳承對象:依 skrInhAdvice 決定(有副卡 → 拆副卡);回 { target(cardsFind 形), spare:bool(拆的是副卡), st, adv }
function ldHeroInhTarget(cs, f) {
  var adv = ldHeroAdvice(cs, f.e), tg = null, st;
  if (adv.k !== 'gray') tg = adv.spare ? cardsFind(cs, adv.spare.id) : f;
  st = tg ? cuInhState(cs, tg) : { ok: false, n: 0, reason: adv.text };
  return { target: tg || f, spare: adv.code === 'hasSpare' || adv.code === 'isSpare', st: st, adv: adv };
}
// 拆了會怎樣
function ldHeroInhEffect(cs, f, list, adv, T) {
  var e = f.e, fig = !!e.fig, nums = adv.nums, fresh = list.filter(function (x) { return !x.owned; }), names = list.map(function (x) { return '『' + ldHeroSkName(x.id) + '』'; }).join('、'), maxU = (typeof bnSkcMaxUse === 'function' && list.length) ? bnSkcMaxUse(list[0].id) : 1, h = '', frag = T.target && T.target.e ? bnSkcFrag(T.target.e) : nums.frag;
  h += '<ul class="ldh-ul">';
  if (!fresh.length) h += '<li class="no">' + ldHeroEsc(names) + '你已經有了,再拆不會多給戰法</li>';
  else h += '<li class="ok">永久解鎖' + ldHeroEsc(names) + ',可裝在任何武將身上' + (fig ? '(同時只能 ' + maxU + ' 人裝)' : '') + '</li>';
  h += '<li class="ok">得到碎片 ' + frag + '</li>';
  if (fig) {
    h += '<li class="no">這張卡離開卡包,轉為流浪(星等保留)</li><li class="no">要再用他,得花 ' + nums.recall + ' 碎片請回(卡包要有空位)</li><li class="no">他身上的武器、防具退回背包,戰法卸下</li>';
    if (adv.code !== 'hasSpare' && adv.code !== 'isSpare' && adv.code !== 'owned') h += '<li class="tip">只有一張就拆再請回:拆得 ' + frag + '、請回花 ' + nums.recall + ',實際花 ' + (nums.recall - frag) + ' 碎片換到戰法。同名副卡改放熔爐可換 ' + nums.furnace + ' 碎片。</li>';
  } else h += '<li class="no">這位路人會消失,不能請回</li>';
  return h + '</ul>';
}
// 誰裝最強(只有名人)
function ldHeroInhBest(cs, sid, fig) {
  var K = ldHeroKit(), hs = ldHeroInhHeroes(cs, sid, fig, 3), h;
  h = '<p>本人裝(本命):效果 100%、發動率 +' + ldHeroPct(K.homeRate) + '%</p><p>別人裝:效果 ' + ldHeroPct(K.otherDefaultMul) + '%</p>';
  if (!bnSkcOwned(sid)) h += '<p class="ldh-mute">還沒解鎖,拆卡取得後才能裝給他們。</p>';
  h += ldHeroInhTeam(sid) + '<p class="lbl">推薦給(點頭像直接裝上)</p><div class="ldh-heroes">' + hs.map(function (x) { return ldHeroHeroBtn(x, 'inhhero', x.fig); }).join('') + '</div><div class="ldh-acts">' + ldHeroSkBtn(sid) + '<button class="ldh-mini" data-act="skdex">看更多候選 ›</button></div>';
  return h;
}
// 拆完的接續動作:要現在裝上嗎?(只列卡包中、有空槽或能裝的人)
function ldHeroInhDoneHtml(cs, d) {
  var hs = ldHeroInhHeroes(cs, d.sid, d.fig, 6).filter(function (x) { return x.state === 'roster' && x.e && bnSkcSlots(x.e) > 0; }).slice(0, 3), seen = {}, more = [];
  hs.forEach(function (x) { seen[x.e.id] = 1; });
  if (hs.length < 3 && typeof bnSkcRecommend === 'function') { try { more = bnSkcRecommend(d.sid, 3, cs); } catch (er) { more = []; } }
  more.forEach(function (r) { if (hs.length < 3 && !seen[r.id]) { seen[r.id] = 1; hs.push({ fig: r.fig || '', name: r.name, state: 'roster', e: r, home: false, whyText: '' }); } });
  return ldHeroSec('done', '已取得『' + ldHeroSkName(d.sid) + '』!要現在裝上嗎?',
    (hs.length ? '<p>點頭像,直接裝到他的第一個空槽。</p><div class="ldh-heroes">' + hs.map(function (x) { return ldHeroHeroBtn(x, 'inhequip', x.e.id); }).join('') + '</div>' : '<p>目前卡包裡沒有能裝的人,之後到武將頁的「戰法」書籤再裝。</p>') +
    '<div class="ldh-acts"><button class="ldh-mini" data-act="inhdone">先不裝</button></div>');
}
// 傳承確認視窗(浮層,不是 ldNav 頁;兩個入口共用:推薦戰法頁列尾〔傳承〕/ 武將傳承頁〔傳承〕):來源卡、得到、失去、建議、淨損益;可捲動,〔取消〕/ 點視窗外 = 關閉,〔確定傳承〕才執行(沿用 bnSkcInherit)
function ldHeroModalHtml(cs, ctx) {
  var f = (ctx && ctx.modal) ? cardsFind(cs, ctx.modal.cid) : null, T, list, fresh, tg, adv, n, fig, frag, sid, cp, who, h;
  if (!f) return '';
  T = ldHeroInhTarget(cs, f); list = bnSkcInheritList(f.e); fresh = list.filter(function (x) { return !x.owned; });
  if (!T.st.ok || !fresh.length) return '';
  tg = T.target.e; adv = T.adv; n = adv.nums; fig = !!tg.fig; frag = bnSkcFrag(tg); sid = fresh[0].id;
  who = fig ? ldHeroFigName(tg.fig) || tg.name : tg.name;
  cp = (fig && typeof skrCopies === 'function') ? skrCopies(cs, tg.fig) : null;
  h = '<p><em>來源</em>' + ldHeroEsc(tg.name) + ' ★' + cardsStarLv(tg) + (T.spare ? '(副卡)' : '') + ' 這張卡(傳承 = 拆卡)</p>';
  h += '<p><em>得到</em>永久解鎖' + ldHeroEsc(fresh.map(function (x) { return '『' + ldHeroSkName(x.id) + '』'; }).join('、')) + ';碎片 ' + frag + '</p>';
  h += '<p><em>失去</em>' + (fig ? '這張' + ldHeroEsc(who) + '轉為流浪(星等保留),之後請回要花 ' + n.recall + ' 碎片,且卡包要有空位;他身上的武器、防具退回背包,戰法卸下' : '這位路人會消失,不能請回') + '</p>';
  if (T.spare && cp && cp.main) h += '<p class="ldh-mute">主力' + ldHeroEsc(who) + ' ★' + cardsStarLv(cp.main) + ' 不受影響。</p>';
  else if (fig) h += '<p class="ldh-mute">拆完後卡包裡就沒有' + ldHeroEsc(who) + '了。</p>';
  h += '<p class="ldh-adv ' + adv.k + '"><em>建議</em>' + ldHeroEsc(adv.title) + '。' + ldHeroEsc(adv.text) + '</p>';
  h += '<p class="ldh-net"><em>淨損益</em>' + (fig ? '拆得 ' + frag + ' 碎片、請回花 ' + n.recall + ' 碎片,' + (T.spare ? '副卡本來就是多的,不用請回' : '實際 ' + (n.recall - frag) + ' 碎片換到戰法') : '拆得 ' + frag + ' 碎片,路人不能請回') + '</p>';
  return '<div class="ldh-modal" data-act="mdno"><div class="ldh-mbox" role="dialog" aria-modal="true"><h4>傳承:' + ldHeroEsc(ldHeroSkName(sid)) + '</h4><div class="ldh-mbody">' + h + '</div>' +
    '<div class="ldh-acts"><button class="ldh-mini" data-act="mdno">取消</button><button class="ldh-mini warn" data-act="mdyes">確定傳承</button></div></div></div>';
}
// 傳承頁(2026-11-16 改版):兩個小分頁 戰法 / 推薦。「戰法」= 一整面可捲動(戰法名稱 + 階級 + 狀態、技能介紹、拆了會怎樣、〔拆〕鈕 / 行內確認),沒有戰法格 / 方塊;
// 「推薦」= 拆完接續動作、誰裝最強(本命加成、推薦頭像)、適合戰隊。〔拆〕只在「可拆」時出現在戰法分頁內;已得 / 未得只有狀態文字。沒有底部操作列。
var LDHERO_INH_SUBS = [['main', '戰法'], ['rec', '推薦']];
// 傳承戰法的狀態:已得(已解鎖)/ 可拆(拆這張或其副卡就能得到)/ 未得(現在不能拆,原因在建議句)
function ldHeroInhCells(cs, f) {
  var list = bnSkcInheritList(f.e), T = ldHeroInhTarget(cs, f), canCut = T.adv.k !== 'gray' && T.st.ok;
  return list.map(function (x, i) { return { i: i, id: x.id, tier: x.tier, owned: !!x.owned, st: x.owned ? '已得' : (canCut ? '可傳承' : '未得') }; });
}
function ldHeroInhSubsHtml(ctx) {
  var t = ctx.inhSub === 'rec' ? 'rec' : 'main';
  return '<div class="ldh-subtabs">' + LDHERO_INH_SUBS.map(function (x) { return '<button class="ldh-sub' + (x[0] === t ? ' on' : '') + '" data-act="inhsub" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
}
function ldHeroInhHead(c) {
  return '<div class="ldh-ih"><i class="tg t' + ldHeroEsc(c.tier) + '">' + ldHeroEsc(c.tier) + '</i><b>' + ldHeroEsc(ldHeroSkName(c.id)) + '</b><u class="st' + (c.st === '可傳承' ? 'cut' : c.st === '未得' ? 'no' : 'have') + '">' + c.st + '</u></div>';
}
function ldHeroInhMainHtml(cs, f, ctx) {
  var list = bnSkcInheritList(f.e), cells = ldHeroInhCells(cs, f), T = ldHeroInhTarget(cs, f), adv = T.adv, fresh = list.some(function (x) { return !x.owned; }), h = '<div class="ldh-inh">';
  cells.forEach(function (c, i) { h += (i ? '<hr>' : '') + ldHeroInhHead(c) + ldHeroSkLines(c.id); });
  h += '<p class="ldh-adv ' + adv.k + '"><em>建議</em>' + ldHeroEsc(adv.title) + '。' + ldHeroEsc(adv.text) + '</p>';
  if (fresh) h += '<hr><h5>拆了會怎樣</h5>' + ldHeroInhEffect(cs, f, list, adv, T);
  if (cells.some(function (c) { return c.st === '可傳承'; })) h += '<div class="ldh-cutrow"><button class="ldh-mini' + (adv.k === 'yellow' ? '' : ' warn') + '" data-act="inh" aria-label="' + ldHeroEsc(adv.btn || '傳承這張卡') + '">傳承</button></div>';
  return h + '</div>';
}
function ldHeroInhRecHtml(cs, f, ctx) {
  var e = f.e, list = bnSkcInheritList(e), h = '';
  if (ctx.inhDone && ctx.inhDone.sid) h += ldHeroInhDoneHtml(cs, ctx.inhDone);
  if (e.fig && list.length) h += ldHeroSec('', '誰裝最強', ldHeroInhBest(cs, list[0].id, e.fig));
  else if (list.length) h += ldHeroSec('', '適合戰隊', ldHeroInhTeam(list[0].id) || '<p class="ldh-mute">沒有推薦資料。</p>');
  return h || '<div class="ldh-note">沒有推薦。</div>';
}
// 適合戰隊:戰法資料自帶的標籤(兵種 / 流派);缺資料回空字串(省略該行)
function ldHeroInhTeam(sid) {
  var info = ldHeroSkInfo(sid), tags = (info && info.tags) ? info.tags.filter(function (t) { return t; }) : [];
  return tags.length ? '<p><em>適合戰隊</em>' + ldHeroEsc(tags.join('、')) + '</p>' : '';
}
function ldHeroTabInh(cs, f, ctx) {
  var list = bnSkcInheritList(f.e);
  if (!list.length) return '<div class="ldh-note">此人沒有可傳承的戰法。</div>';
  return ldHeroInhSubsHtml(ctx) + '<div class="ldh-subbody">' + (ctx.inhSub === 'rec' ? ldHeroInhRecHtml(cs, f, ctx) : ldHeroInhMainHtml(cs, f, ctx)) + '</div>';
}
// 傳承書籤紅點:名人、可傳承且他的傳承戰法還沒擁有
function ldHeroInhDot(cs, f) {
  try { return !!(f && f.e && f.e.fig && f.list === 'roster' && cuInhState(cs, f).ok); } catch (er) { return false; }
}
// 把戰法裝給某位名冊武將:找第一個能裝的空槽;沒空槽就開他的選擇頁。回 true = 已處理
function ldHeroEquipTo(ctx, cs, e, sid) {
  var n = bnSkcSlots(e), cur = bnSkcLoad().eq[e.id] || [null, null], i, c, full = null;
  if (cur.indexOf(sid) >= 0) { ldHeroToast(e.name + ' 已經裝著『' + ldHeroSkName(sid) + '』'); return true; }
  for (i = 0; i < n; i++) {
    c = bnSkcCanEquip(cs, e, i, sid);
    if (!c.ok) { if (c.reason === 'full') full = c; continue; }
    if (cur[i]) continue;
    if (bnSkcEquip(cs, e, i, sid).ok) { ldHeroSync(); ldHeroToast('已讓 ' + e.name + ' 裝上『' + ldHeroSkName(sid) + '』'); ctx.inhDone = null; return true; }
  }
  if (full) { ldHeroToast('『' + ldHeroSkName(sid) + '』已被別人裝著,先到對方武將頁卸下'); return true; }
  if (!n) { ldHeroToast(e.name + ' 品階不足,沒有可裝的選擇槽'); return true; }
  if (!ctx.last && typeof ldNavPush === 'function') { ldHeroToast(e.name + ' 的選擇槽都滿了,請選要換掉哪一格'); ldNavPush('heroSkillPick', { eid: e.id, slot: 0 }); return true; }
  ldHeroToast(e.name + ' 的選擇槽都滿了,請到他的武將頁更換');
  return true;
}

// ───────── 整頁組字 ─────────
function ldHeroFigHtml(cs, f, ctx) {
  var e = f.e, lv = cardsStarLv(e), starMax = (typeof CARD_FURNACE !== 'undefined' && CARD_FURNACE.starMax) || 5, stars = '', i, g, stk = '', gr = Math.max(1, Math.min(4, e.gr | 0 || 1));
  for (i = 1; i <= starMax; i++) stars += '<i class="' + (i <= lv ? 'lit' : 'dim') + '">★</i>';
  if (typeof cuGridItemOf === 'function') { try { g = cuGridItemOf(cs, e.id); } catch (er) { g = null; } }
  if (g && g.n >= 2) stk = '<button class="ldh-stk" data-act="stk">本疊 ' + g.n + ' 張 ›</button>';
  return '<div class="ldh-fig q' + gr + '"><div class="ldh-glow"></div>' +
    '<img class="ldh-img" alt="" src="' + ldHeroEsc(ldHeroFigSrc(e)) + '" onerror="this.onerror=null;this.src=\'' + ldHeroEsc(ldHeroFallbackSrc(e)) + '\'">' +
    '<div class="ldh-name"><b>' + ldHeroEsc(e.name) + '</b>' + (e.zi ? '<i>字' + ldHeroEsc(e.zi) + '</i>' : '') + '</div>' +
    '<div class="ldh-stamp" aria-label="陣營">' + ldHeroEsc(ldHeroFacName(e)) + '</div>' + stk +
    '<div class="ldh-ft"><div class="ldh-stars" aria-label="星階 ' + lv + '">' + stars + '</div><div class="ldh-hexes">' +
    '<button class="ldh-hex bronze' + (e.star ? ' on' : '') + '" data-act="lock" aria-label="' + (e.star ? '已鎖定,點擊解除' : '鎖定防誤遣散') + '">' + (e.star ? '鎖' : '開') + '</button></div></div></div>';
}
function ldHeroPanelHtml(cs, f, ctx) {
  var t = ctx.tab || 'attr', h;
  h = t === 'bio' ? ldHeroTabBio(cs, f) : t === 'inh' ? ldHeroTabInh(cs, f, ctx) : ldHeroTabAttr(cs, f, ctx);
  return '<div class="ldh-panel ld-panel"><div class="ldh-scroll" data-tab="' + t + '">' + h + '</div></div>';
}
function ldHeroTabsHtml(ctx, cs, f) {
  var t = ctx.tab || 'attr';
  return '<div class="ldh-tabs">' + LDHERO_TABS.map(function (x) { return '<button class="ldh-bm' + (x[0] === t ? ' on' : '') + '" data-act="tab" data-v="' + x[0] + '">' + x[1] + (x[0] === 'inh' && t !== 'inh' && cs && f && ldHeroInhDot(cs, f) ? '<em class="ldh-dot" aria-label="可傳承"></em>' : '') + '</button>'; }).join('') + '</div>';
}
function ldHeroHtml(cs, f, ctx) { return '<div class="ldh">' + ldHeroFigHtml(cs, f, ctx) + ldHeroPanelHtml(cs, f, ctx) + ldHeroTabsHtml(ctx, cs, f) + ldHeroModalHtml(cs, ctx) + '</div>'; }
// 頂列中間:‹ 名字牌 ›
function ldHeroTopHtml(cs, f, ctx) {
  var nv = ldHeroNav(cs, ctx);
  return '<button class="ldp-btn ldh-pn" data-act="prev" aria-label="上一位"' + (nv.prev ? '' : ' disabled') + '>‹</button>' +
    '<span class="ldh-plate"><b>' + ldHeroEsc(f.e.name) + '</b><i>' + (nv.idx >= 0 ? (nv.idx + 1) + ' / ' + nv.total : '') + '</i></span>' +
    '<button class="ldp-btn ldh-pn" data-act="next" aria-label="下一位"' + (nv.next ? '' : ' disabled') + '>›</button>';
}

// ───────── 渲染與動作 ─────────
function ldHeroRender(el, ctx) {
  var cs = ldHeroCs(), f = cs ? cardsFind(cs, ctx.id) : null, sc = null, y = 0, el2;
  if (ctx.sub) return ldHeroSubRender(el, ctx);   // heroInfo / heroSkills 滿版子頁
  ctx.heroEl = el; ctx.popEl = null; ctx.popKey = '';   // 重畫(切分頁 / 換人 / 動作後)= 浮泡自動關
  if (!f) {
    el.innerHTML = '<p class="ldp-empty">找不到此武將</p>';
    if (ctx.tabsEl) ctx.tabsEl.innerHTML = '';
    return false;
  }
  if (typeof el.querySelector === 'function') { sc = el.querySelector('.ldh-scroll'); y = sc ? sc.scrollTop : 0; }
  el.innerHTML = ldHeroHtml(cs, f, ctx);
  if (ctx.tabsEl) { ctx.tabsEl.innerHTML = ldHeroTopHtml(cs, f, ctx); ctx.tabsEl.onclick = function (ev) { ldHeroOnClick(ctx, ev); }; }
  el.onclick = function (ev) { ldHeroOnClick(ctx, ev); };
  if (typeof el.querySelector === 'function') { el2 = el.querySelector('.ldh-scroll'); if (el2) { if (y) el2.scrollTop = y; if (el2.addEventListener) el2.addEventListener('scroll', function () { if (ctx.popKey) ldHeroPopClose(ctx); }); } }
  return true;
}
function ldHeroOnClick(ctx, ev) {
  var n = ev ? ev.target : null, act = null, info = null, v = null, wasPop = !!ctx.popKey;
  while (n && n !== ctx.heroEl && n.getAttribute) {
    if (n.className === 'ldh-pop' || n.className === 'ldh-mbox') return true;   // 點浮泡 / 確認視窗本身:不動
    if (n.getAttribute('data-act')) { act = n.getAttribute('data-act'); v = n.getAttribute('data-v'); break; }
    if (n.getAttribute('data-info')) { info = n.getAttribute('data-info'); break; }
    n = n.parentNode;
  }
  if (info !== null && ldHeroIsPop(info) && !ctx.sub) return ldHeroPopOpen(ctx, n, info);   // 兵種 / 六圍:小浮泡
  if (wasPop) { ldHeroPopClose(ctx); if (act === null) return true; }   // 點浮泡外:先關;若點的是按鈕(分頁 / 鎖定 / ‹ ›)照常動作,其餘只關不動
  if (act !== null) { if (n.hasAttribute && n.hasAttribute('disabled')) return false; return ldHeroAct(ctx, act, v); }
  if (info !== null) return ldHeroOpenInfo(ctx, info);
  return false;
}
// 動作(純邏輯 + 重畫);回 true = 已處理
function ldHeroAct(ctx, act, v) {
  var cs = ldHeroCs(), f = cs ? cardsFind(cs, ctx.id) : null, nv, g, i, r, T, name, list, sid;
  if (!f) return false;
  if (act === 'tab') { ctx.tab = ldHeroTabOk(v); ctx.info = ''; ctx.modal = null; ctx.inhDone = null; ctx.recConfirm = false; ctx.inhSub = 'main'; }
  else if (act === 'prev' || act === 'next') {
    nv = ldHeroNav(cs, ctx);
    if (act === 'prev' && nv.prev) ctx.id = nv.prev; else if (act === 'next' && nv.next) ctx.id = nv.next; else return false;
    ctx.info = ''; ctx.modal = null; ctx.inhDone = null; ctx.recConfirm = false; ctx.inhSub = 'main';
  }
  else if (act === 'stk') {
    g = (typeof cuGridItemOf === 'function') ? cuGridItemOf(cs, f.e.id) : null;
    if (!g || g.n < 2) return false;
    for (i = 0; i < g.members.length; i++) if (g.members[i].id === f.e.id) break;
    ctx.id = g.members[(i + 1) % g.members.length].id; ctx.info = ''; ctx.modal = null; ctx.inhDone = null; ctx.recConfirm = false; ctx.inhSub = 'main';
  }
  else if (act === 'skills') {
    if (typeof ldNavPush !== 'function') { ldHeroToast('即將開放'); return true; }
    ldNavPush('heroSkills', { id: f.e.id });   // 選擇槽 → 推薦戰法滿版頁
    return true;
  }
  else if (act === 'lock') {
    f.e.star = f.e.star ? 0 : 1;
    ldHeroSync();
    ldHeroToast(f.e.star ? '已鎖定,不會被誤遣散' : '已解除鎖定');
  }
  else if (act === 'pick') {
    if (ctx.last || typeof ldNavPush !== 'function') { ldHeroToast('請從卡包進入更換'); return true; }
    ldNavPush('heroSkillPick', { eid: f.e.id, slot: +v });
    return true;
  }
  else if (act === 'uneq') {
    if (f.list !== 'roster') return false;
    bnSkcUnequip(f.e.id, +v);
    ldHeroSync();
    ldHeroToast('已卸下');
  }
  else if ((act === 'eqpick' || act === 'eqdet' || act === 'equnq') && typeof ldEquipHeroAct === 'function') return ldEquipHeroAct(ctx, act, v);   // 裝備(js/ld_equip_ui.js)
  else if (act === 'inhsub') { ctx.inhSub = v === 'rec' ? 'rec' : 'main'; }
  else if (act === 'inh') { ctx.modal = { cid: f.e.id }; ctx.inhSub = 'main'; }
  else if (act === 'skinh') { g = cardsFind(cs, v); if (!g) { ldHeroToast('找不到來源卡'); return true; } ctx.modal = { cid: g.e.id }; }
  else if (act === 'mdno') { ctx.modal = null; }
  else if (act === 'mdyes') {
    g = ctx.modal ? cardsFind(cs, ctx.modal.cid) : null;
    if (!g) { ctx.modal = null; ldHeroRender(ctx.heroEl, ctx); return true; }
    T = ldHeroInhTarget(cs, g);
    if (!T.st.ok) { ctx.modal = null; ldHeroToast(T.st.reason); ldHeroRender(ctx.heroEl, ctx); return true; }
    name = T.target.e.name;
    list = bnSkcInheritList(T.target.e);
    sid = (list.filter(function (x) { return !x.owned; })[0] || list[0] || {}).id;
    r = bnSkcInherit(cs, T.target.e);
    if (!r.ok) { ctx.modal = null; ldHeroToast(LDHERO_INH_REASON[r.reason] || '無法傳承'); ldHeroRender(ctx.heroEl, ctx); return true; }
    if (typeof cardsSyncTalents === 'function') { try { cardsSyncTalents(); } catch (er) { /* 略過 */ } }
    if (typeof cu !== 'undefined' && cu) cu.detail = null;
    ldHeroSync();
    ctx.modal = null;
    ldHeroToast('取得『' + ldHeroSkName(sid) + '』!碎片 +' + r.shards + (r.wander ? ';' + name + ' 轉為流浪' : ''));
    if (!cardsFind(cs, ctx.id)) { if (typeof ldNavBack === 'function') ldNavBack(); return true; }   // 本卡已消失(路人)→ 退回上一層
    if (!ctx.sub) { ctx.inhDone = { sid: sid, fig: T.target.e.fig || '' }; ctx.inhSub = 'rec'; }   // 接續動作:要現在裝上嗎?(在「推薦」分頁)
  }
  else if (act === 'inhdone') { ctx.inhDone = null; }
  else if (act === 'inhhero' || act === 'inhequip') {
    list = bnSkcInheritList(f.e); sid = list.length ? list[0].id : '';
    if (act === 'inhhero') {
      T = ldHeroFigState(cs, v);
      if (!sid || !bnSkcOwned(sid)) { ldHeroToast('先拆卡取得『' + ldHeroSkName(sid) + '』,才能裝給他'); return true; }
      if (T.state !== 'roster') { ldHeroToast(ldHeroFigName(v) + (T.state === 'owned' ? ' 不在卡包,先收入卡包' : ' 你還沒有,抽到後才能裝')); return true; }
      i = T.e;
    } else {
      sid = ctx.inhDone ? ctx.inhDone.sid : sid; g = cardsFind(cs, v); i = (g && g.list === 'roster') ? g.e : null;
      if (!i) { ldHeroToast('找不到這位武將'); return true; }
    }
    ldHeroEquipTo(ctx, cs, i, sid);
  }
  else if (act === 'skgo') {
    if (ctx.last || typeof ldNavPush !== 'function') { ldHeroToast('請返回卡包後,從卡包進入那張卡的「傳承」書籤'); return true; }
    ldNavPush('hero', { id: v, list: [v], tab: 'inh' });
    return true;
  }
  else if (act === 'skview') {
    if (typeof ldNavPush !== 'function') { ldHeroToast('即將開放'); return true; }
    ldNavPush('skill', { id: v });   // 戰法詳情(js/ld_skilldex.js);已在堆疊 = 退回;層數滿了 ldNavPush 自己提示
    return true;
  }
  else if (act === 'skdex') {
    if (typeof ldNavPush !== 'function') { ldHeroToast('即將開放'); return true; }
    ldNavPush('skilldex', { forEid: f.list === 'roster' ? f.e.id : '' });   // 戰法大全,篩成推薦給此人
    return true;
  }
  else if (act === 'skpick') { ctx.skSel = (ctx.skSel === v) ? '' : (v || ''); }
  else if (act === 'skequip') { ldHeroEquipTo(ctx, cs, f.e, v); }
  else if (act === 'recapply') ldHeroRecApply(ctx, cs, f, false);
  else if (act === 'recyes') ldHeroRecApply(ctx, cs, f, true);
  else if (act === 'recno') { ctx.recConfirm = false; }
  else return false;
  ldHeroRender(ctx.heroEl, ctx);
  return true;
}

// ───────── 滿版子頁:heroInfo 詳情頁 / heroSkills 推薦戰法頁(左上返回,沒有右上 ×;內容區整頁可捲動、不截字) ─────────
function ldHeroTabOk(t) { var i; for (i = 0; i < LDHERO_TABS.length; i++) if (LDHERO_TABS[i][0] === t) return t; return 'attr'; }   // 舊值(例:'skill')一律回屬性頁
// ───────── 小浮泡(兵種適性 / 六圍數值 / 戰力):點一下在被點元素旁顯示 1~3 行說明,點外面 / 再點同一個 / 捲動 / 重畫都會關;同時只開一個;不加 ×,不遮住被點元素 ─────────
function ldHeroIsPop(key) { var k = String(key || '').split(':')[0]; return k === 'apt' || k === 'st' || k === 'pow'; }
function ldHeroPopClose(ctx) {
  var el = ctx.popEl;
  if (el && el.parentNode && el.parentNode.removeChild) { try { el.parentNode.removeChild(el); } catch (er) { /* 略過 */ } }
  ctx.popEl = null; ctx.popKey = '';
}
// 兵種克制摘要:資料全讀 BN_DATA.prey(克制 > 1、被剋 < 1、對械另列);沒資料就空字串
function ldHeroPreyText(t) {
  var pr = (typeof BN_DATA !== 'undefined' && BN_DATA.prey) ? BN_DATA.prey : null, row = pr ? pr[t] : null, win = [], lose = [], k;
  if (!row) return '';
  for (k in row) if (k !== '械' || t === '械') { if (row[k] > 1) win.push(k + ' ×' + row[k]); else if (row[k] < 1) lose.push(k + ' ×' + row[k]); }
  if (t === '械') return '打槍騎盾弓都 ×' + (row['槍'] || 1) + ';四兵種打械 ×' + ((pr['槍'] && pr['槍']['械']) || 1) + '。不在克制循環內。';
  return '克制:打 ' + (win.join('、') || '—') + ';被剋:打 ' + (lose.join('、') || '—') + '(數字 = 我方傷害倍率)。';
}
function ldHeroPopHtml(cs, f, key) {
  var p = key.split(':'), k = p[0], v = p.slice(1).join(':'), e = f.e, ap, g, m;
  if (k === 'apt') {
    ap = bnAptOf(e); g = ap.apt[v];
    m = (typeof BN_DATA !== 'undefined' && BN_DATA.apt) ? BN_DATA.apt : { S: 1.1, A: 1, B: 0.9, C: 0.8 };
    return ldHeroInfoLines(v + '兵適性 ' + g, ['兵力、攻擊、防禦 ×' + (m[g] || 1).toFixed(2) + (v === ldHeroTroop(e) ? '(目前主力兵種)' : ''), ldHeroPreyText(v)].filter(function (x) { return x; }));
  }
  return ldHeroInfoHtml(cs, f, { info: key });
}
function ldHeroPopOpen(ctx, node, key) {
  var cs = ldHeroCs(), f = cs ? cardsFind(cs, ctx.id) : null, host = ctx.heroEl, pop, r, er, left, w = 250, doc = (typeof document !== 'undefined') ? document : null;
  if (ctx.popKey === key) { ldHeroPopClose(ctx); return true; }   // 再點同一個 = 關
  ldHeroPopClose(ctx);
  if (!f || !host || !doc || !doc.createElement) return false;
  pop = doc.createElement('div'); pop.className = 'ldh-pop'; pop.setAttribute('role', 'tooltip');
  pop.innerHTML = ldHeroPopHtml(cs, f, key);
  try {
    r = node.getBoundingClientRect(); er = host.getBoundingClientRect();
    left = Math.max(4, Math.min(r.left - er.left, er.width - w - 4));
    pop.style.left = Math.round(left) + 'px';
    if (r.bottom - er.top + 80 > er.height) pop.style.bottom = Math.round(er.bottom - r.top + 6) + 'px';   // 下面放不下 → 放在被點元素上方
    else pop.style.top = Math.round(r.bottom - er.top + 6) + 'px';
  } catch (er2) { /* 沒有版面資訊(測試假 DOM)就用 CSS 預設位置 */ }
  host.appendChild(pop);
  ctx.popEl = pop; ctx.popKey = key;
  return true;
}
function ldHeroOpenInfo(ctx, key) {
  if (typeof ldNavPush !== 'function') { ldHeroToast('即將開放'); return false; }
  return !!ldNavPush('heroInfo', { id: ctx.id, info: key });
}
function ldHeroInfoPageHtml(cs, f, ctx) {
  var key = ctx.info || '', k = key.split(':')[0], v = key.split(':').slice(1).join(':'), h = ldHeroInfoHtml(cs, f, ctx);
  if (k === 'sk' && ldHeroTier(v)) h += '<div class="ldh-acts">' + ldHeroSkBtn(v) + '</div>';
  return '<div class="ldh-detail ld-panel"><div class="ldh-who">' + ldHeroEsc(f.e.name) + '</div><div class="ldh-info full" aria-live="polite">' + h + '</div></div>';
}
function ldHeroSkListHtml(cells, ctx) {
  var prev = -1;
  return '<div class="ldh-skrows">' + ldHeroSkSorted(cells).map(function (c) { var g = ldHeroSkGroup(c), f = prev >= 0 && g !== prev; prev = g; return ldHeroSkRowHtml(c, ctx, f); }).join('') + '</div>';
}
function ldHeroSkillsPageHtml(cs, f, ctx) {
  var cells = ldHeroSkCells(cs, f), p = ldHeroRecPlan(cs, f);
  return '<div class="ldh-skp ld-panel"><div class="ldh-who">' + ldHeroEsc(f.e.name) + ' · 選擇槽' + (p ? '<i>推薦 ' + p.n + ' 格</i>' : '') + '</div>' + ldHeroSkListHtml(cells, ctx) + '<div class="ldh-skdesc ldh-info full" aria-live="polite">' + ldHeroSkDescHtml(cs, f, ctx, cells) + '</div>' + ldHeroModalHtml(cs, ctx) + '</div>';
}
function ldHeroSubRender(el, ctx) {
  var cs = ldHeroCs(), f = cs ? cardsFind(cs, ctx.id) : null, y = el && el.scrollTop ? el.scrollTop : 0, ly = 0, lst, sr;
  ctx.heroEl = el;
  if (!f) { el.innerHTML = '<p class="ldp-empty">找不到此武將</p>'; return false; }
  if (ctx.sub !== 'info' && typeof el.querySelector === 'function') { lst = el.querySelector('.ldh-skrows'); ly = lst ? lst.scrollTop : 0; }
  el.innerHTML = ctx.sub === 'info' ? ldHeroInfoPageHtml(cs, f, ctx) : ldHeroSkillsPageHtml(cs, f, ctx);
  if (ctx.sub !== 'info' && typeof el.querySelector === 'function') {   // 清單:保留捲動位置,選取的列捲進可視範圍
    lst = el.querySelector('.ldh-skrows'); sr = lst ? lst.querySelector('.sel') : null;
    if (lst) { lst.scrollTop = ly; if (sr && (sr.offsetTop < lst.scrollTop || sr.offsetTop + sr.offsetHeight > lst.scrollTop + lst.clientHeight)) lst.scrollTop = Math.max(0, sr.offsetTop - 4); }
  }
  el.onclick = function (ev) { ldHeroOnClick(ctx, ev); };
  if (y) el.scrollTop = y;
  return true;
}

// ───────── 戰法選擇頁(id heroSkillPick;只在 hero 不是第 5 層時開) ─────────
function ldHeroPickHtml(cs, f, slot, msg) {
  var e = f.e, own, h = '', holders, cands = (typeof skrCands === 'function') ? skrCands(e) : [], rank = {}, ownSet = {}, miss = [];
  if (f.list !== 'roster') return '<div class="ldh-warn">非卡包人員不能裝備戰法(先收入卡包)</div>';
  if (slot < 0 || slot >= bnSkcSlots(e)) return '<div class="ldh-warn">此槽位目前未開放</div>';
  cands.forEach(function (c, i) { if (!(c[0] in rank)) rank[c[0]] = { i: i, why: c[2] }; });
  own = Object.keys(bnSkcLoad().own).filter(function (id) { return !!bnSkcTier(id); });
  own.forEach(function (id) { ownSet[id] = 1; });
  // 推薦的排最前面(依推薦順序),其餘依階級
  own.sort(function (a, b) {
    var ra = a in rank, rb = b in rank;
    if (ra !== rb) return ra ? -1 : 1;
    if (ra) return rank[a].i - rank[b].i;
    return LDHERO_TIER_ORD.indexOf(bnSkcTier(a)) - LDHERO_TIER_ORD.indexOf(bnSkcTier(b));
  });
  h += '<div class="ldh-note">' + ldHeroEsc(e.name) + ' · 選擇槽 ' + (slot + 1) + '。從已解鎖的戰法選一個;每個戰法有同時裝備人數上限,已滿的需先從對方卸下。</div>';
  if (msg) h += '<div class="ldh-warn">' + ldHeroEsc(msg) + '</div>';
  if (!own.length) h += '<div class="ldh-note">尚未解鎖任何選擇戰法。拆名人卡(傳承)即可解鎖該名人的傳承戰法。</div>';
  own.forEach(function (id) {
    var c = bnSkcCanEquip(cs, e, slot, id), t = bnSkcTier(id), act = '', why = '', hd = null, rc = rank[id], rw = rc ? skrWhyText(rc.why) : '';
    if (c.ok) act = '<button class="ldh-mini" data-act="peq" data-id="' + ldHeroEsc(id) + '">裝備</button>';
    else if (c.reason === 'full') {
      holders = (typeof cuCHolders === 'function') ? cuCHolders(cs, id) : [];
      hd = holders.filter(function (x) { return x.eid === (c.holders || [])[0]; })[0] || null;
      why = '已被 ' + (c.holders || []).length + ' 位裝備(上限 ' + c.max + ')' + (hd ? ':' + hd.name : '');
      if (hd && c.max === 1) act = '<button class="ldh-mini warn" data-act="pun" data-eid="' + ldHeroEsc(hd.eid) + '" data-slot="' + hd.slot + '">從' + ldHeroEsc(hd.name) + '卸下</button>';
    } else why = LDHERO_REASON[c.reason] || '無法裝備';
    h += '<div class="ldh-row' + (rc ? ' rec' : '') + '"><i class="tg t' + ldHeroEsc(t) + '">' + ldHeroEsc(t) + '</i><b>' + ldHeroEsc(ldHeroSkName(id)) + '</b>' + (rc ? '<i class="tg star">推薦</i>' : '') + '<span>' + ldHeroEsc((rw ? rw + '。' : '') + (why || ldHeroSkShort(id))) + '</span>' + act + '</div>';
  });
  cands.forEach(function (c) { if (miss.length < 4 && bnSkcTier(c[0]) && !ownSet[c[0]]) miss.push(c); });
  if (miss.length) {
    h += '<div class="ldh-sech">還沒有的推薦戰法</div>';
    miss.forEach(function (c) {
      var s = (typeof skrSource === 'function') ? skrSource(cs, c[0]) : { text: '' }, t = bnSkcTier(c[0]);
      h += '<div class="ldh-row off"><i class="tg t' + ldHeroEsc(t) + '">' + ldHeroEsc(t) + '</i><b>' + ldHeroEsc(ldHeroSkName(c[0])) + '</b><span>' + ldHeroEsc(s.text || '目前無法取得') + '</span></div>';
    });
  }
  return h;
}
function ldHeroPickRender(el, ctx, msg) {
  var cs = ldHeroCs(), f = cs ? cardsFind(cs, ctx.eid) : null;
  ctx.heroEl = el;
  el.innerHTML = '<div class="ldh-pick ld-panel">' + (f ? ldHeroPickHtml(cs, f, ctx.slot, msg) : '<p class="ldp-empty">找不到此武將</p>') + '</div>';
  el.onclick = function (ev) { ldHeroPickClick(ctx, ev); };
}
function ldHeroPickClick(ctx, ev) {
  var n = ev ? ev.target : null;
  while (n && n !== ctx.heroEl && n.getAttribute && !n.getAttribute('data-act')) n = n.parentNode;
  if (!n || !n.getAttribute || !n.getAttribute('data-act')) return false;
  return ldHeroPickAct(ctx, n.getAttribute('data-act'), n);
}
function ldHeroPickAct(ctx, act, b) {
  var cs = ldHeroCs(), f = cs ? cardsFind(cs, ctx.eid) : null, r, id;
  if (!f) return false;
  if (act === 'peq') {
    id = b.getAttribute('data-id');
    r = bnSkcEquip(cs, f.e, ctx.slot, id);
    if (r.ok) { ldHeroSync(); ldHeroToast('已裝備『' + ldHeroSkName(id) + '』'); if (typeof ldNavBack === 'function') ldNavBack(); return true; }
    ldHeroPickRender(ctx.heroEl, ctx, LDHERO_REASON[r.reason] || '無法裝備');
    return true;
  }
  if (act === 'pun') {
    bnSkcUnequip(b.getAttribute('data-eid'), +b.getAttribute('data-slot'));
    ldHeroSync();
    ldHeroPickRender(ctx.heroEl, ctx, '');
    return true;
  }
  return false;
}

ldNavRegister({
  id: 'hero', title: '武將', noClose: true,
  res: function () { return []; },
  build: function (el, ctx) {
    ctx.tab = ldHeroTabOk(ctx.tab);
    if (!ctx.list || !ctx.list.length) ctx.list = [ctx.id];
    ctx.info = ''; ctx.modal = null; ctx.inhDone = null; ctx.recConfirm = false; ctx.inhSub = 'main'; ctx.heroSkip = 1; ctx.sub = '';
    if (el.classList) el.classList.add('ldh-body');
    if (ctx.tabsEl && ctx.tabsEl.classList) ctx.tabsEl.classList.add('ldh-top');
    ldHeroRender(el, ctx);
  },
  onShow: function (el, ctx) {
    if (ctx.heroSkip) { ctx.heroSkip = 0; return; }
    ldHeroRender(el, ctx);   // 從戰法選擇頁退回:重畫(裝備可能已變)
  }
});
ldNavRegister({
  id: 'heroInfo', title: '詳情', noClose: true,
  build: function (el, ctx) { ctx.sub = 'info'; if (el.classList) el.classList.remove('ldh-body'); ldHeroSubRender(el, ctx); },
  onShow: function (el, ctx) { ldHeroSubRender(el, ctx); }   // 從換裝頁等退回:重畫(裝備可能已變)
});
ldNavRegister({
  id: 'heroSkills', title: '推薦戰法', noClose: true,
  build: function (el, ctx) { ctx.sub = 'skills'; ctx.recConfirm = false; ctx.skSel = ''; if (el.classList) el.classList.add('ldh-body'); ldHeroSubRender(el, ctx); },
  onShow: function (el, ctx) { ldHeroSubRender(el, ctx); }   // 從戰法選擇頁退回:重畫(裝備已變)
});
ldNavRegister({
  id: 'heroSkillPick', title: '選擇戰法', noClose: true,
  build: function (el, ctx) { ldHeroPickRender(el, ctx, ''); }
});
if (typeof module !== 'undefined' && module.exports) module.exports = { ldHeroHtml: ldHeroHtml };
