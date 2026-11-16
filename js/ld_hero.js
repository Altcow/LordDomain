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
// ───────── 推薦裝備與一鍵套用(R4;設計 3-3) ─────────
function ldHeroRecPlan(cs, f) {
  var p;
  if (!f || f.list !== 'roster' || typeof skrHeroPlan !== 'function') return null;
  try { p = skrHeroPlan(cs, f.e); } catch (er) { return null; }
  return (p && p.ok) ? p : null;
}
// 缺的戰法:「拆〇〇卡可得」+ 可去拆的卡(inh / inhWait / inhRoster 有 e)
function ldHeroMissRow(ctx, m) {
  var s = m.src || {}, e = s.e, go = '';
  if (e && e.id && !ctx.last && (s.k === 'inh' || s.k === 'inhWait' || s.k === 'inhRoster')) go = '<button class="ldh-mini" data-act="skgo" data-v="' + ldHeroEsc(e.id) + '">去拆</button>';
  return '<div class="ldh-row off"><i class="tg t' + ldHeroEsc(ldHeroTier(m.id)) + '">' + ldHeroEsc(ldHeroTier(m.id)) + '</i><b>' + ldHeroEsc(m.name || ldHeroSkName(m.id)) + '</b><span>缺。' + ldHeroEsc(s.text || '目前無法取得') + '</span>' + go + ldHeroSkBtn(m.id) + '</div>';
}
function ldHeroSkBtn(id) { return '<button class="ldh-mini sm" data-act="skview" data-v="' + ldHeroEsc(id) + '">看戰法詳情 ›</button>'; }
function ldHeroTier(id) { try { return (typeof bnSkcTier === 'function' && bnSkcTier(id)) || ''; } catch (er) { return ''; } }
function ldHeroRecHtml(cs, f, ctx) {
  var p = ldHeroRecPlan(cs, f), h = '', replaced, apply = '';
  if (!p || (!p.rec.length && !p.miss.length)) return '';
  h = '<div class="ldh-rec" data-skr="rec"><div class="ldh-sech">推薦裝備<i>' + p.n + ' 個選擇槽</i></div>';
  p.rec.forEach(function (id, i) {
    var on = p.cur.indexOf(id) >= 0, tk = p.take.filter(function (t) { return t.id === id; })[0], st = on ? '已裝 ✓' : (tk ? '會從 ' + (tk.fromName || '別人') + ' 身上拿來' : '可裝上'), why = skrWhyText(p.why[i]);
    h += '<div class="ldh-row rec' + (on ? ' done' : '') + ldHeroSel(ctx, 'sk:' + id) + '" role="button" tabindex="0" data-info="sk:' + ldHeroEsc(id) + '"><i class="tg t' + ldHeroEsc(ldHeroTier(id)) + '">' + ldHeroEsc(ldHeroTier(id)) + '</i><b>' + ldHeroEsc(ldHeroSkName(id)) + '</b><span>' + ldHeroEsc((why ? why + '。' : '') + st) + '</span>' + ldHeroSkBtn(id) + '</div>';
  });
  p.miss.forEach(function (m) { h += ldHeroMissRow(ctx, m); });
  p.busy.forEach(function (b) { if (p.rec.indexOf(b.id) < 0) h += '<div class="ldh-note">『' + ldHeroEsc(ldHeroSkName(b.id)) + '』目前在 ' + ldHeroEsc(b.holderName || '別人') + '(' + ldHeroEsc(b.why || '使用中') + ')身上,先不拿。</div>'; });
  if (!p.changes.length) apply = '<div class="ldh-note">' + (p.rec.length ? '目前已經是推薦配置。' : '推薦的戰法你都還沒解鎖。') + '</div>';
  else if (ctx.recConfirm) {
    replaced = p.changes.filter(function (c) { return c.old && c.old !== c.id; }).map(function (c) { return '『' + ldHeroSkName(c.old) + '』'; });
    apply = '<div class="ldh-warn">會換掉 ' + ldHeroEsc(replaced.join('、')) + ',確定?</div><div class="ldh-acts"><button class="ldh-mini" data-act="recno">取消</button><button class="ldh-mini warn" data-act="recyes">確定套用</button></div>';
  } else apply = '<div class="ldh-acts"><button class="ldh-mini warn" data-act="recapply">一鍵套用</button></div>';
  return h + apply + '<div class="ldh-acts"><button class="ldh-mini" data-act="skdex">看更多候選 ›</button></div></div>';
}
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
function ldHeroTabSkill(cs, f, ctx) {
  var e = f.e, inR = f.list === 'roster', rows = (typeof cuCSkillRows === 'function') ? cuCSkillRows(e, inR) : [], h = ldHeroRecHtml(cs, f, ctx);
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
    h += '<div class="ldh-row' + (c.auto ? ' auto' : '') + ldHeroSel(ctx, 'sk:' + c.id) + '" role="button" tabindex="0" data-info="sk:' + ldHeroEsc(c.id) + '"><i class="tg">' + ldHeroEsc(tag) + '</i><b>' + ldHeroEsc(nm) + '</b><span>' + ldHeroEsc(ldHeroSkShort(c.id)) + '</span>' + acts + (ldHeroTier(c.id) ? ldHeroSkBtn(c.id) : '') + '</div>';
  });
  if (ctx.last && inR) h += '<div class="ldh-note">請從卡包進入更換選擇槽的戰法(頁面層數已達上限)。</div>';
  if (!inR) h += '<div class="ldh-note">非卡包人員不能裝備戰法(先收入卡包)。</div>';
  return h || '<div class="ldh-note">沒有戰法資料。</div>';
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
function ldHeroInhSkill(x) {
  var info = ldHeroSkInfo(x.id), lines = (info && info.lines) ? info.lines : [];
  return '<div class="ldh-isk"><div class="hd"><i class="tg t' + ldHeroEsc(x.tier) + '">' + ldHeroEsc(x.tier) + '</i><b>' + ldHeroEsc(ldHeroSkName(x.id)) + '</b><u class="' + (x.owned ? 'own' : '') + '">' + (x.owned ? '已擁有' : '未得') + '</u></div>' +
    lines.map(function (l) { return '<p class="' + (String(l[0]).indexOf('典故') >= 0 ? 'fl' : 'ln') + '"><em>' + ldHeroEsc(String(l[0]).replace('事蹟 / 典故', '典故')) + '</em>' + ldHeroEsc(l[1]) + '</p>'; }).join('') + '</div>';
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
  h += '<p class="lbl">推薦給(點頭像直接裝上)</p><div class="ldh-heroes">' + hs.map(function (x) { return ldHeroHeroBtn(x, 'inhhero', x.fig); }).join('') + '</div><div class="ldh-acts">' + ldHeroSkBtn(sid) + '<button class="ldh-mini" data-act="skdex">看更多候選 ›</button></div>';
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
// 拆卡確認(行內)
function ldHeroInhConfirm(cs, f, T, list) {
  var tg = T.target.e, adv = T.adv, fig = !!tg.fig, fresh = list.filter(function (x) { return !x.owned; }), gain = fresh.map(function (x) { return '『' + ldHeroSkName(x.id) + '』'; }).join('、'), cp = (fig && typeof skrCopies === 'function') ? skrCopies(cs, tg.fig) : null, who = fig ? ldHeroFigName(tg.fig) || tg.name : tg.name, h;
  h = '<p class="big">確定拆掉「' + ldHeroEsc(tg.name) + ' ★' + cardsStarLv(tg) + (T.spare ? '(副卡)' : '') + '」?</p>' +
    '<p><em>得到</em>' + ldHeroEsc(gain) + '(永久)、碎片 ' + bnSkcFrag(tg) + '</p>' +
    '<p><em>失去</em>' + (fig ? '這張' + ldHeroEsc(who) + '轉為流浪(星等保留,花 ' + adv.nums.recall + ' 碎片可請回)' : '這位路人消失,不能請回') + '</p>';
  if (T.spare && cp && cp.main) h += '<p>主力' + ldHeroEsc(who) + ' ★' + cardsStarLv(cp.main) + ' 不受影響。</p>';
  else if (fig) h += '<p>拆完後卡包裡就沒有' + ldHeroEsc(who) + '了;他身上的武器、防具會退回背包。</p>';
  return h + '<div class="ldh-acts"><button class="ldh-mini" data-act="inhno">取消</button><button class="ldh-mini warn" data-act="inhyes">確定拆卡</button></div>';
}
function ldHeroTabInh(cs, f, ctx) {
  var e = f.e, fig = !!e.fig, list = bnSkcInheritList(e), T = ldHeroInhTarget(cs, f), adv = T.adv, h = '', sid = list.length ? list[0].id : '', body;
  if (!list.length) return '<div class="ldh-note">此人沒有可傳承的戰法。</div>';
  if (ctx.inhDone && ctx.inhDone.sid) h += ldHeroInhDoneHtml(cs, ctx.inhDone);
  h += ldHeroSec('', fig ? '傳承戰法' : '卡面戰法(傳承可得)', list.map(ldHeroInhSkill).join(''));
  h += ldHeroSec('', '拆了會怎樣', ldHeroInhEffect(cs, f, list, adv, T));
  if (fig) h += ldHeroSec('', '誰裝最強', ldHeroInhBest(cs, sid, e.fig));
  if (ctx.inhConfirm && T.st.ok) return h + ldHeroSec('adv yellow', '再確認一次', ldHeroInhConfirm(cs, f, T, list));
  body = '<p>' + ldHeroEsc(adv.text) + '</p>';
  if (adv.k !== 'gray' && T.st.ok) body += '<div class="ldh-acts"><button class="ldh-mini' + (adv.k === 'yellow' ? '' : ' warn') + '" data-act="inh">' + ldHeroEsc(adv.btn || '拆這張取得傳承') + '</button></div>';
  else if (adv.code === 'owned' && fig) body += '<div class="ldh-acts"><button class="ldh-mini" data-act="up">' + ldHeroEsc(adv.btn || '去熔爐') + '</button></div>';
  return h + ldHeroSec('adv ' + adv.k, '這張要不要拆?', '<p class="big">' + ldHeroEsc(adv.title) + '</p>' + body);
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
    '<button class="ldh-hex gold" data-act="up" aria-label="升星">升</button>' +
    '<button class="ldh-hex bronze' + (e.star ? ' on' : '') + '" data-act="lock" aria-label="' + (e.star ? '已鎖定,點擊解除' : '鎖定防誤遣散') + '">' + (e.star ? '鎖' : '開') + '</button></div></div></div>';
}
function ldHeroPanelHtml(cs, f, ctx) {
  var t = ctx.tab || 'attr', h;
  h = t === 'skill' ? ldHeroTabSkill(cs, f, ctx) : t === 'bio' ? ldHeroTabBio(cs, f) : t === 'inh' ? ldHeroTabInh(cs, f, ctx) : ldHeroTabAttr(cs, f, ctx);
  return '<div class="ldh-panel ld-panel' + (t === 'inh' ? ' noinfo' : '') + '"><div class="ldh-scroll" data-tab="' + t + '">' + h + '</div><div class="ldh-info" aria-live="polite">' + ldHeroInfoHtml(cs, f, ctx) + '</div></div>';
}
function ldHeroTabsHtml(ctx, cs, f) {
  var t = ctx.tab || 'attr';
  return '<div class="ldh-tabs">' + LDHERO_TABS.map(function (x) { return '<button class="ldh-bm' + (x[0] === t ? ' on' : '') + '" data-act="tab" data-v="' + x[0] + '">' + x[1] + (x[0] === 'inh' && t !== 'inh' && cs && f && ldHeroInhDot(cs, f) ? '<em class="ldh-dot" aria-label="可傳承"></em>' : '') + '</button>'; }).join('') + '</div>';
}
function ldHeroHtml(cs, f, ctx) { return '<div class="ldh">' + ldHeroFigHtml(cs, f, ctx) + ldHeroPanelHtml(cs, f, ctx) + ldHeroTabsHtml(ctx, cs, f) + '</div>'; }
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
  var cs = ldHeroCs(), f = cs ? cardsFind(cs, ctx.id) : null, nv, g, i, r, T, name, list, sid;
  if (!f) return false;
  if (act === 'tab') { ctx.tab = v || 'attr'; ctx.info = ''; ctx.inhConfirm = false; ctx.inhDone = null; ctx.recConfirm = false; }
  else if (act === 'prev' || act === 'next') {
    nv = ldHeroNav(cs, ctx);
    if (act === 'prev' && nv.prev) ctx.id = nv.prev; else if (act === 'next' && nv.next) ctx.id = nv.next; else return false;
    ctx.info = ''; ctx.inhConfirm = false; ctx.inhDone = null; ctx.recConfirm = false;
  }
  else if (act === 'stk') {
    g = (typeof cuGridItemOf === 'function') ? cuGridItemOf(cs, f.e.id) : null;
    if (!g || g.n < 2) return false;
    for (i = 0; i < g.members.length; i++) if (g.members[i].id === f.e.id) break;
    ctx.id = g.members[(i + 1) % g.members.length].id; ctx.info = ''; ctx.inhConfirm = false; ctx.inhDone = null; ctx.recConfirm = false;
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
    list = bnSkcInheritList(T.target.e);
    sid = (list.filter(function (x) { return !x.owned; })[0] || list[0] || {}).id;
    r = bnSkcInherit(cs, T.target.e);
    if (!r.ok) { ctx.inhConfirm = false; ldHeroToast(LDHERO_INH_REASON[r.reason] || '無法傳承'); ldHeroRender(ctx.heroEl, ctx); return true; }
    if (typeof cardsSyncTalents === 'function') { try { cardsSyncTalents(); } catch (er) { /* 略過 */ } }
    if (typeof cu !== 'undefined' && cu) cu.detail = null;
    ldHeroSync();
    ctx.inhConfirm = false;
    ldHeroToast('取得『' + ldHeroSkName(sid) + '』!碎片 +' + r.shards + (r.wander ? ';' + name + ' 轉為流浪' : ''));
    if (!cardsFind(cs, ctx.id)) { if (typeof ldNavBack === 'function') ldNavBack(); return true; }   // 本卡已消失(路人)→ 退回上一層
    ctx.inhDone = { sid: sid, fig: T.target.e.fig || '' };   // 接續動作:要現在裝上嗎?
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
  else if (act === 'recapply') ldHeroRecApply(ctx, cs, f, false);
  else if (act === 'recyes') ldHeroRecApply(ctx, cs, f, true);
  else if (act === 'recno') { ctx.recConfirm = false; }
  else return false;
  ldHeroRender(ctx.heroEl, ctx);
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
  id: 'hero', title: '武將',
  res: function () { return []; },
  build: function (el, ctx) {
    if (!ctx.tab) ctx.tab = 'attr';
    if (!ctx.list || !ctx.list.length) ctx.list = [ctx.id];
    ctx.info = ''; ctx.inhConfirm = false; ctx.inhDone = null; ctx.recConfirm = false; ctx.heroSkip = 1;
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
