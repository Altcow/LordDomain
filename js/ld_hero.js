// js/ld_hero.js — 武將詳情頁(設計_介面骨架實作計畫.md §3-4、任務卡 2;第 2 階段)。前綴 ldHero。頁 id 'hero' 與 'heroSkillPick'(戰法選擇,第 5 層時不開)。
// ctx = { id, list:[卡片 id 依序] };ctx 內部狀態:tab(attr|skill|bio|inh)、info(說明區顯示哪一格)、inhConfirm。‹ › 只換 ctx.id,不新增層。
// 版面:橫式(基準 844x390)左立繪 34% + 右面板 + 右側書籤直排;直式立繪在上、書籤一排、面板可捲動(CSS 以 orientation 切換,見 css/ld_hero.css)。
// 資料來源:cardsFind / cardsStats / bnPower(bnUnitSpec) / bnAptOf / CARD_FAC / cardsStarLv;戰法 bnSkillInfo / cuCSkillRows;裝卸 bnSkcCanEquip / bnSkcEquip / bnSkcUnequip;傳承 cuInhState / bnSkcInherit。
// e.star 是「鎖定防誤遣散」旗標(不是星等,星等 e.starLv):青銅六角 = 鎖定切換(同 cardsui.js 的 a === 'star')。金六角 = 升星(開熔爐 ldNavPush('cards', {tab:'F'}))。
// 素材走 ld_art.js 佔位(has:false = CSS 徽章 + 單一漢字)。純函式與 DOM 分開,供 tools/test_ld_hero.js 測試。ES2017,不用 ?. ??。
var LDHERO_TABS = [['attr', '屬性'], ['skill', '戰法'], ['bio', '傳記'], ['inh', '傳承']];
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
var LDHERO_INH_REASON = { none: '沒有可傳承的戰法', grade: '品階未達紫,不可傳承', locked: '已鎖定,先解除鎖定才能傳承', owned: '可傳承戰法已全部擁有,可改用熔爐' };
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
  var r = bnAptOf(e), list = (typeof BN_DATA !== 'undefined' && BN_DATA.troopList) || ['槍', '騎', '盾', '弓', '謀'];
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
    return ldHeroInfoLines('選擇槽 ' + (i + 1), [f.list === 'roster' ? '尚未裝備戰法。到「戰法」書籤選擇。' : '非卡包人員不能裝備戰法(先收入卡包)。']);
  }
  return '<span>' + LDHERO_DEF_INFO + '</span>';
}

// ───────── 各書籤內容 ─────────
function ldHeroSel(ctx, key) { return ctx.info === key ? ' sel' : ''; }
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
    var key = (s.kind === 'fixed' || s.kind === 'sel') ? 'sk:' + s.id : (s.kind === 'none' ? '' : 'sl:' + s.i), cls = 'ldh-sk ' + s.kind + (k === 0 ? ' fx' : '') + ldHeroSel(ctx, key), body;
    if (s.kind === 'fixed' || s.kind === 'sel') body = '<b>' + ldHeroEsc(ldHeroSkName(s.id)) + '</b>';
    else if (s.kind === 'lock') body = '<b class="lk">鎖</b><u>青階開放</u>';
    else if (s.kind === 'empty') body = '<b class="em">空槽</b>';
    else body = '<b class="em">—</b>';
    return '<button class="' + cls + '"' + (key ? ' data-info="' + ldHeroEsc(key) + '"' : '') + '><i>' + s.tag + '</i>' + body + (s.flag ? '<em class="ldh-flag" aria-label="可裝備"></em>' : '') + '</button>';
  }).join('') + '</div>';
  return h;
}
function ldHeroTabSkill(cs, f, ctx) {
  var e = f.e, inR = f.list === 'roster', rows = (typeof cuCSkillRows === 'function') ? cuCSkillRows(e, inR) : [], h = '';
  rows.forEach(function (c) {
    var acts = '', nm, tag;
    if (c.lock) { h += '<div class="ldh-row off"><i class="tg">選擇槽</i><b>青階開放</b><span>品階提升到青以上才有第 2 個選擇槽。</span></div>'; return; }
    if (c.empty) {
      if (!ctx.last) acts = '<button class="ldh-mini" data-act="pick" data-v="' + c.slot + '">選擇</button>';
      h += '<div class="ldh-row"><i class="tg">選擇槽</i><b>空槽</b><span>' + (ctx.last ? '請從卡包進入更換。' : '尚未裝備戰法。') + '</span>' + acts + '</div>';
      return;
    }
    nm = ldHeroSkName(c.id); tag = c.tag;
    if (c.slot >= 0 && inR) {
      acts = (ctx.last ? '' : '<button class="ldh-mini" data-act="pick" data-v="' + c.slot + '">更換</button>') + '<button class="ldh-mini warn" data-act="uneq" data-v="' + c.slot + '">卸下</button>';
    }
    h += '<div class="ldh-row' + (c.auto ? ' auto' : '') + ldHeroSel(ctx, 'sk:' + c.id) + '" role="button" tabindex="0" data-info="sk:' + ldHeroEsc(c.id) + '"><i class="tg">' + ldHeroEsc(tag) + '</i><b>' + ldHeroEsc(nm) + '</b><span>' + ldHeroEsc(ldHeroSkShort(c.id)) + '</span>' + acts + '</div>';
  });
  if (ctx.last && inR) h += '<div class="ldh-note">請從卡包進入更換選擇槽的戰法(頁面層數已達上限)。</div>';
  if (!inR) h += '<div class="ldh-note">非卡包人員不能裝備戰法(先收入卡包)。</div>';
  return h || '<div class="ldh-note">沒有戰法資料。</div>';
}
function ldHeroTabBio(cs, f) {
  var t = (typeof cuBioText === 'function') ? cuBioText(f.e) : '';
  return '<div class="ldh-bio">' + String(t).split('\n').filter(function (s) { return s; }).map(function (s) { return '<p>' + ldHeroEsc(s) + '</p>'; }).join('') + '</div>';
}
// 傳承對象:名人主力且同名另有副卡 → 預設拆副卡(同 cuPopInherit);回 { target(cardsFind 形), spare:bool, st }
function ldHeroInhTarget(cs, f) {
  var spf = (typeof cuInhSpare === 'function') ? cuInhSpare(cs, f.e) : null, tg = spf || f;
  return { target: tg, spare: !!spf, st: cuInhState(cs, tg) };
}
function ldHeroTabInh(cs, f, ctx) {
  var e = f.e, T = ldHeroInhTarget(cs, f), list = bnSkcInheritList(e), h = '', tiers = {}, fresh, sum, frag, fig = !!e.fig;
  h += '<div class="ldh-note">傳承後此卡離開卡包(' + (fig ? '名人轉流浪,可花 ' + (typeof CARD_RECALL_COST !== 'undefined' ? CARD_RECALL_COST : '') + ' 碎片請回' : '路人消失') + '),以下戰法永久解鎖。</div>';
  list.forEach(function (x) {
    h += '<div class="ldh-row' + ldHeroSel(ctx, 'sk:' + x.id) + '" role="button" tabindex="0" data-info="sk:' + ldHeroEsc(x.id) + '"><i class="tg t' + x.tier + '">' + x.tier + '</i><b>' + ldHeroEsc(ldHeroSkName(x.id)) + '</b><span>' + (x.owned ? '已擁有' : '未得') + '</span></div>';
  });
  if (!list.length) h += '<div class="ldh-note">此人沒有可傳承的戰法。</div>';
  if (!T.st.ok) { h += '<div class="ldh-warn">' + ldHeroEsc(T.st.reason) + '</div>'; return h; }
  if (!ctx.inhConfirm) return h + '<div class="ldh-acts"><button class="ldh-mini warn" data-act="inh">傳承此卡' + (T.spare ? '(副卡)' : '') + '</button></div>';
  fresh = list.filter(function (x) { return !x.owned; });
  fresh.forEach(function (x) { tiers[x.tier] = (tiers[x.tier] || 0) + 1; });
  sum = LDHERO_TIER_ORD.filter(function (t) { return tiers[t]; }).map(function (t) { return t + ' 戰法 ' + tiers[t] + ' 個'; });
  frag = (typeof bnSkcFrag === 'function') ? bnSkcFrag(T.target.e) : 0;
  h += '<div class="ldh-warn">確定傳承『' + ldHeroEsc(T.target.e.name) + '』?解鎖 ' + ldHeroEsc(sum.join('、')) + ';得碎片 ' + frag + ';' + (T.target.e.fig ? ldHeroEsc(T.target.e.name) + ' 將轉為流浪。' : '此路人將消失。') + '</div>';
  return h + '<div class="ldh-acts"><button class="ldh-mini" data-act="inhno">取消</button><button class="ldh-mini warn" data-act="inhyes">確定傳承</button></div>';
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
    '<button class="ldh-hex gold" data-act="up" aria-label="升星">升</button>' +
    '<button class="ldh-hex bronze' + (e.star ? ' on' : '') + '" data-act="lock" aria-label="' + (e.star ? '已鎖定,點擊解除' : '鎖定防誤遣散') + '">' + (e.star ? '鎖' : '開') + '</button></div></div></div>';
}
function ldHeroPanelHtml(cs, f, ctx) {
  var t = ctx.tab || 'attr', h;
  h = t === 'skill' ? ldHeroTabSkill(cs, f, ctx) : t === 'bio' ? ldHeroTabBio(cs, f) : t === 'inh' ? ldHeroTabInh(cs, f, ctx) : ldHeroTabAttr(cs, f, ctx);
  return '<div class="ldh-panel ld-panel"><div class="ldh-scroll" data-tab="' + t + '">' + h + '</div><div class="ldh-info" aria-live="polite">' + ldHeroInfoHtml(cs, f, ctx) + '</div></div>';
}
function ldHeroTabsHtml(ctx) {
  var t = ctx.tab || 'attr';
  return '<div class="ldh-tabs">' + LDHERO_TABS.map(function (x) { return '<button class="ldh-bm' + (x[0] === t ? ' on' : '') + '" data-act="tab" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
}
function ldHeroHtml(cs, f, ctx) { return '<div class="ldh">' + ldHeroFigHtml(cs, f, ctx) + ldHeroPanelHtml(cs, f, ctx) + ldHeroTabsHtml(ctx) + '</div>'; }
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
  ctx.heroEl = el;
  if (!f) {
    el.innerHTML = '<p class="ldp-empty">找不到此武將</p>';
    if (ctx.tabsEl) ctx.tabsEl.innerHTML = '';
    return false;
  }
  if (typeof el.querySelector === 'function') { sc = el.querySelector('.ldh-scroll'); y = sc ? sc.scrollTop : 0; }
  el.innerHTML = ldHeroHtml(cs, f, ctx);
  if (ctx.tabsEl) { ctx.tabsEl.innerHTML = ldHeroTopHtml(cs, f, ctx); ctx.tabsEl.onclick = function (ev) { ldHeroOnClick(ctx, ev); }; }
  el.onclick = function (ev) { ldHeroOnClick(ctx, ev); };
  if (y && typeof el.querySelector === 'function') { el2 = el.querySelector('.ldh-scroll'); if (el2) el2.scrollTop = y; }
  return true;
}
function ldHeroOnClick(ctx, ev) {
  var n = ev ? ev.target : null, act = null, info = null, v = null;
  while (n && n !== ctx.heroEl && n.getAttribute) {
    if (n.getAttribute('data-act')) { act = n.getAttribute('data-act'); v = n.getAttribute('data-v'); break; }
    if (n.getAttribute('data-info')) { info = n.getAttribute('data-info'); break; }
    n = n.parentNode;
  }
  if (act !== null) { if (n.hasAttribute && n.hasAttribute('disabled')) return false; return ldHeroAct(ctx, act, v); }
  if (info !== null) { ctx.info = info; ldHeroRender(ctx.heroEl, ctx); return true; }
  return false;
}
// 動作(純邏輯 + 重畫);回 true = 已處理
function ldHeroAct(ctx, act, v) {
  var cs = ldHeroCs(), f = cs ? cardsFind(cs, ctx.id) : null, nv, g, i, r, T, name;
  if (!f) return false;
  if (act === 'tab') { ctx.tab = v || 'attr'; ctx.info = ''; ctx.inhConfirm = false; }
  else if (act === 'prev' || act === 'next') {
    nv = ldHeroNav(cs, ctx);
    if (act === 'prev' && nv.prev) ctx.id = nv.prev; else if (act === 'next' && nv.next) ctx.id = nv.next; else return false;
    ctx.info = ''; ctx.inhConfirm = false;
  }
  else if (act === 'stk') {
    g = (typeof cuGridItemOf === 'function') ? cuGridItemOf(cs, f.e.id) : null;
    if (!g || g.n < 2) return false;
    for (i = 0; i < g.members.length; i++) if (g.members[i].id === f.e.id) break;
    ctx.id = g.members[(i + 1) % g.members.length].id; ctx.info = ''; ctx.inhConfirm = false;
  }
  else if (act === 'up') {
    if (typeof ldNavPush !== 'function') { ldHeroToast('即將開放'); return true; }
    ldNavPush('cards', { tab: 'F' });   // 熔爐 = 卡包的 F 頁籤(舊頁疊在本頁上面;卡包已在堆疊 → 退回到它並切頁籤);× / 返回回到本頁
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
  else if (act === 'inh') { ctx.inhConfirm = true; }
  else if (act === 'inhno') { ctx.inhConfirm = false; }
  else if (act === 'inhyes') {
    T = ldHeroInhTarget(cs, f);
    if (!T.st.ok) { ctx.inhConfirm = false; ldHeroToast(T.st.reason); ldHeroRender(ctx.heroEl, ctx); return true; }
    name = T.target.e.name;
    r = bnSkcInherit(cs, T.target.e);
    if (!r.ok) { ctx.inhConfirm = false; ldHeroToast(LDHERO_INH_REASON[r.reason] || '無法傳承'); ldHeroRender(ctx.heroEl, ctx); return true; }
    if (typeof cardsSyncTalents === 'function') { try { cardsSyncTalents(); } catch (er) { /* 略過 */ } }
    if (typeof cu !== 'undefined' && cu) cu.detail = null;
    ldHeroSync();
    ldHeroToast('已傳承『' + name + '』:解鎖 ' + r.unlocked.length + ' 個戰法,碎片 +' + r.shards + (r.wander ? ';' + name + ' 轉為流浪' : ''));
    ctx.inhConfirm = false;
    if (T.target.e.id === ctx.id) { if (typeof ldNavBack === 'function') ldNavBack(); return true; }   // 本卡已離開卡包 → 退回上一層
  }
  else return false;
  ldHeroRender(ctx.heroEl, ctx);
  return true;
}

// ───────── 戰法選擇頁(id heroSkillPick;只在 hero 不是第 5 層時開) ─────────
function ldHeroPickHtml(cs, f, slot, msg) {
  var e = f.e, own, h = '', holders;
  if (f.list !== 'roster') return '<div class="ldh-warn">非卡包人員不能裝備戰法(先收入卡包)</div>';
  if (slot < 0 || slot >= bnSkcSlots(e)) return '<div class="ldh-warn">此槽位目前未開放</div>';
  own = Object.keys(bnSkcLoad().own).filter(function (id) { return !!bnSkcTier(id); });
  own.sort(function (a, b) { return LDHERO_TIER_ORD.indexOf(bnSkcTier(a)) - LDHERO_TIER_ORD.indexOf(bnSkcTier(b)); });
  h += '<div class="ldh-note">' + ldHeroEsc(e.name) + ' · 選擇槽 ' + (slot + 1) + '。從已解鎖的戰法選一個;每個戰法有同時裝備人數上限,已滿的需先從對方卸下。</div>';
  if (msg) h += '<div class="ldh-warn">' + ldHeroEsc(msg) + '</div>';
  if (!own.length) h += '<div class="ldh-note">尚未解鎖任何選擇戰法。拆名人卡(傳承)即可解鎖該名人的全部戰法。</div>';
  own.forEach(function (id) {
    var c = bnSkcCanEquip(cs, e, slot, id), t = bnSkcTier(id), act = '', why = '', hd = null;
    if (c.ok) act = '<button class="ldh-mini" data-act="peq" data-id="' + ldHeroEsc(id) + '">裝備</button>';
    else if (c.reason === 'full') {
      holders = (typeof cuCHolders === 'function') ? cuCHolders(cs, id) : [];
      hd = holders.filter(function (x) { return x.eid === (c.holders || [])[0]; })[0] || null;
      why = '已被 ' + (c.holders || []).length + ' 位裝備(上限 ' + c.max + ')' + (hd ? ':' + hd.name : '');
      if (hd && c.max === 1) act = '<button class="ldh-mini warn" data-act="pun" data-eid="' + ldHeroEsc(hd.eid) + '" data-slot="' + hd.slot + '">從' + ldHeroEsc(hd.name) + '卸下</button>';
    } else why = LDHERO_REASON[c.reason] || '無法裝備';
    h += '<div class="ldh-row"><i class="tg t' + ldHeroEsc(t) + '">' + ldHeroEsc(t) + '</i><b>' + ldHeroEsc(ldHeroSkName(id)) + '</b><span>' + ldHeroEsc(why || ldHeroSkShort(id)) + '</span>' + act + '</div>';
  });
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
  id: 'hero', title: '武將',
  res: function () { return []; },
  build: function (el, ctx) {
    if (!ctx.tab) ctx.tab = 'attr';
    if (!ctx.list || !ctx.list.length) ctx.list = [ctx.id];
    ctx.info = ''; ctx.inhConfirm = false; ctx.heroSkip = 1;
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
  id: 'heroSkillPick', title: '選擇戰法',
  build: function (el, ctx) { ldHeroPickRender(el, ctx, ''); }
});
if (typeof module !== 'undefined' && module.exports) module.exports = { ldHeroHtml: ldHeroHtml };
