// js/cardsui_card.js — 人物卡(card_ui_redesign §3 / K5):名冊詳情的橫向人物卡(畫像、五維、品質、星數、兵種、陣營、姓名、戰法清單、傳記與傳承入口),以及共用底部浮層(技能明細 / 選擇槽裝備 / 人物傳記 / 傳承二次確認)。
// 掛在 cardsui.js:cuDetailHtml → cuPersonCardHtml(cs, f);cuClick → cuCardClick(a, b, cs)(卡上的 cpop 動作)。浮層是 body 底下的 #cuCardPop(接在 #cardsPanel 之後,面板關閉時隱藏),浮層內按鈕的 click 也轉到 cuCardClick,之後重畫。
// 戰法規則與 API 在 bn_skcard.js(bnSkcInheritCheck / bnSkcInherit / bnSkcCanEquip / bnSkcEquip / bnSkcUnequip / bnSkcTier);本檔只組字、決定按鈕、推薦分數(§3.3 公式)。
// 全域名稱:CUC cuPersonCardHtml cuCardCss cuCardClick cuPopSync cuPopSkill cuPopPick cuPopBio cuPopInherit cuBioText cuRecScore cuRecommend cuInhState
// 不發聲、不推播。ES2017;不用 ?. ??。

var CUC = { pop: null, stack: [], el: null, key: false, rec: null };   // pop = {k:'skill'|'pick'|'bio'|'inherit', id, eid, slot, confirm, err};stack = 浮層返回用
var CUC_TIER_COL = { S: '#b8432a', A: '#76489a', B: '#365fa3', C: '#7a6a58' };
var CUC_TIER_ORD = ['S', 'A', 'B', 'C'];
var CUC_APT_PT = { S: 3, A: 2, B: 1, C: 0 };
var CUC_CAT = { ult: '大', passive: '被', active: '主', pursuit: '追', command: '指', legion: '兵' };
var CUC_ROLE = { ult: '固定', native: '固定', passive: '被動', bond: '聯動' };
var CUC_REASON = { none: '此人不在名冊,不能裝備', own: '此戰法尚未解鎖', slot: '此槽位目前未開放', dup: '同一人兩槽不可裝同一戰法', legion: '兵種卡每人 1 張,且限同兵種', held: '已由他人裝備中,換人要先卸下' };
var CUC_INH_REASON = { none: '沒有可傳承的戰法', grade: '品階未達紫,不可傳承', locked: '已鎖定(🔒),先解除鎖定才能傳承', owned: '可傳承戰法已全部擁有,可改用熔爐' };

function cuCardCss() {
  var st;
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuCardStyle')) return;
  st = document.createElement('style');
  st.id = 'cuCardStyle';
  st.textContent = ':root{--cu-gold:#8a6a00}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--cu-gold:#e2c066}}:root[data-theme="dark"]{--cu-gold:#e2c066}' +
    '#cardsPanel .cupc{display:flex;gap:8px;box-sizing:border-box;width:100%;min-height:250px;margin:6px 0;padding:8px;border-radius:10px;background:var(--cu-paper);color:var(--cu-ink);border:3px solid var(--g);outline:1px solid var(--cu-ink);outline-offset:-4px}' +
    '#cardsPanel .cupc.g0{--g:var(--gr0)}#cardsPanel .cupc.g1{--g:var(--gr1)}#cardsPanel .cupc.g2{--g:var(--gr2)}#cardsPanel .cupc.g3{--g:var(--gr3)}#cardsPanel .cupc.g4{--g:var(--gr4);border-style:double;border-width:5px}' +
    '#cardsPanel .cupc .cupt{position:relative;flex:0 0 110px;width:110px;height:168px;overflow:hidden;border-radius:6px;border:2px solid var(--g);background:rgba(128,128,128,.14)}' +
    '#cardsPanel .cupc .cupt img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}#cardsPanel .cupc .cupt .cusil{position:absolute;left:0;top:0;width:100%;height:100%;fill:var(--g);opacity:.55}' +
    '#cardsPanel .cupc .cupc-tl,#cardsPanel .cupc .cupc-tr{position:absolute;top:2px;z-index:1;height:24px;line-height:24px;min-width:24px;padding:0 3px;border-radius:4px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;text-align:center}' +
    '#cardsPanel .cupc .cupc-tl{left:2px}#cardsPanel .cupc .cupc-tr{right:2px}#cardsPanel .cupc .cupc-tl .tri{width:18px!important;height:18px!important;margin:0!important;vertical-align:middle!important}' +
    '#cardsPanel .cupc .cupst{position:absolute;left:0;right:0;bottom:0;z-index:1;padding:2px 0;text-align:center;font-size:13px;line-height:18px;color:#fff;background:rgba(0,0,0,.5)}' +
    '#cardsPanel .cupc .cupr{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}#cardsPanel .cupc .cuph{display:flex;align-items:baseline;flex-wrap:wrap;gap:0 4px;min-width:0}' +
    '#cardsPanel .cupc .cupn{font-size:18px;line-height:24px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}#cardsPanel .cupc .cupgem{color:var(--g);font-size:11px;letter-spacing:1px}' +
    '#cardsPanel .cupc .cupsb{font-size:12px;line-height:17px}#cardsPanel .cupc .cupsb .tri{width:14px!important;height:14px!important;margin:0 2px 0 0!important;vertical-align:-2px!important}' +
    '#cardsPanel .cupc .cupstat{display:grid;grid-template-columns:repeat(5,1fr);gap:3px}#cardsPanel .cupc .cupstat span{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:40px;border-radius:6px;background:rgba(128,128,128,.14);line-height:1.15}' +
    '#cardsPanel .cupc .cupstat i{font-style:normal;font-size:11px}#cardsPanel .cupc .cupstat b{font-size:16px}' +
    '#cardsPanel .cupc .cupsk{display:grid;grid-template-columns:1fr 1fr;gap:4px}' +
    '#cardsPanel .cupc .cpsk,#cuCardPop .cpsk{display:flex;flex-wrap:wrap;align-items:center;align-content:center;gap:0 4px;min-width:0;min-height:40px;margin:0;padding:2px 4px;box-sizing:border-box;border:1px solid var(--cu-ink);border-radius:6px;background:rgba(54,95,163,.12);color:inherit;font:inherit;font-size:12px;text-align:left;overflow:hidden}' +
    '#cardsPanel .cupc .cpsk.ex .cpn,#cuCardPop .cpsk.ex .cpn{color:var(--cu-gold);font-weight:bold}#cardsPanel .cupc .cpsk.auto{color:#7a7a7a}#cardsPanel .cupc .cpsk.empty{border-style:dashed}#cardsPanel .cupc .cpsk.lock{opacity:.5;border-style:dotted;justify-content:center}' +
    '#cardsPanel .cpcat,#cuCardPop .cpcat{flex:none;width:18px;height:18px;line-height:18px;text-align:center;font-style:normal;font-size:11px;border-radius:3px;background:var(--cu-ink);color:var(--cu-paper)}' +
    '#cardsPanel .cpn,#cuCardPop .cpn{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#cardsPanel .cprole,#cuCardPop .cprole{flex:0 0 100%;padding-left:22px;font-style:normal;font-size:10px;line-height:12px;opacity:.7;text-align:left}' +
    '#cardsPanel .cupc .cupbt{display:flex;gap:6px;margin-top:auto}#cardsPanel .cupc .cupbt .cub{flex:1 1 0;min-width:0;min-height:44px;margin:0;padding:4px 2px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#cardsPanel .cupc .cupbt .cub.cpno{opacity:.8}' +
    '#cardsPanel .cuph .cupn{color:var(--cu-ink)}' +
    '#cuCardPop .cpnm{flex:1 1 auto;min-width:0;min-height:40px;margin:0;padding:0;border:none;background:none;color:inherit;font:inherit;text-align:left;text-decoration:underline;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#cuCardPop{position:fixed;left:0;top:0;right:0;bottom:0;z-index:30;color:var(--cu-ink);font-size:14px}#cardsPanel[hidden] ~ #cuCardPop,#cuCardPop[hidden]{display:none}' +
    '#cuCardPop .cucp-mask{position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.45)}' +
    '#cuCardPop .cucp-sheet{position:absolute;left:0;right:0;bottom:0;max-height:80vh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;box-sizing:border-box;padding:0 14px calc(14px + env(safe-area-inset-bottom));border-radius:14px 14px 0 0;background:var(--cu-paper);box-shadow:0 -4px 18px rgba(0,0,0,.4)}' +
    '#cuCardPop .cucp-hd{display:flex;align-items:center;gap:6px;position:sticky;top:0;z-index:1;margin:0 -14px;padding:0 6px 0 14px;min-height:52px;background:var(--cu-paper);border-bottom:1px solid rgba(128,128,128,.35)}' +
    '#cuCardPop .cucp-hd b{flex:1 1 auto;min-width:0;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#cuCardPop .cucp-x{flex:none;min-width:44px;min-height:44px;border:none;background:none;color:inherit;font-size:26px;line-height:1}' +
    '#cuCardPop .cub{min-height:44px;margin:6px 6px 0 0;padding:4px 12px;border:none;border-radius:6px;background:#3a5a8a;color:#fff;font-size:14px}#cuCardPop .cub.warn{background:#8a3a3a}#cuCardPop .cub[disabled]{opacity:.35}' +
    '#cuCardPop .cucp-bk{margin:0;min-width:44px}' +
    '#cuCardPop .cpl{margin:8px 0;line-height:1.6;font-size:13px}#cuCardPop .cpl b{color:var(--cu-gold);margin-right:4px}' +
    '#cuCardPop .cptier{flex:none;display:inline-block;min-width:22px;text-align:center;border-radius:4px;color:#fff;font-weight:bold;padding:0 4px;font-size:12px;line-height:20px}' +
    '#cuCardPop .cptag{display:inline-block;margin:0 4px 6px 0;padding:0 6px;border:1px solid var(--cu-ink);border-radius:4px;font-size:12px}' +
    '#cuCardPop .cprow{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;min-height:44px;margin:4px 0;padding:4px 0;border-bottom:1px dashed rgba(128,128,128,.35)}' +
    '#cuCardPop .cpwhy{font-size:12px;opacity:.85;flex-basis:100%}#cuCardPop .cpok{color:var(--cu-gold);font-size:12px}#cuCardPop .cpno2{opacity:.6;font-size:12px}' +
    '#cuCardPop .cpwarn{color:#b04a2a;font-size:13px;margin:6px 0;line-height:1.5}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #cuCardPop .cpwarn{color:#f0a060}}:root[data-theme="dark"] #cuCardPop .cpwarn{color:#f0a060}' +
    '#cuCardPop .cpfb{float:left;width:120px;margin:4px 12px 6px 0;border-radius:6px}#cuCardPop .cpt p{margin:0 0 8px;line-height:1.6}#cuCardPop .cpt{overflow:hidden}' +
    '#cuCardPop .cprh{position:relative;display:inline-block;flex:none;width:28px;height:28px;border-radius:50%;overflow:hidden;vertical-align:middle;background:rgba(128,128,128,.2)}#cuCardPop .cprh img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}#cuCardPop .cprh .cusil{position:absolute;left:0;top:0;width:100%;height:100%;fill:var(--cu-ink);opacity:.55}' +
    '#cuCardPop .cprc{display:inline-flex;align-items:center;gap:4px;min-height:36px;margin:2px 4px 2px 0;padding:0 6px 0 2px;border:1px solid var(--cu-ink);border-radius:18px;background:none;color:inherit;font:inherit;font-size:12px}#cuCardPop .cprc.off{opacity:.6;border-style:dashed}#cuCardPop .cprc em{font-style:normal;font-size:10px;opacity:.8}' +
    '#cuCardPop .cprl{font-size:12px;margin-top:2px}';
  document.head.appendChild(st);
}

// ---------- 小工具(讀取、組字) ----------
function cuCFig(id) { return (typeof CARD_FIG_BY_ID !== 'undefined' && CARD_FIG_BY_ID[id]) || (typeof FX_FIG_BY_ID !== 'undefined' && FX_FIG_BY_ID[id]) || null; }
function cuCFigName(id) { var f = cuCFig(id); return f ? f.name : (id || ''); }
function cuCEndDot(s) { return /[。!?」]$/.test(s) ? s : s + '。'; }
function cuCPp(x) { var v = Math.round(x * 100); return (v > 0 ? '+' : '−') + Math.abs(v) + ' pp'; }
function cuCGem(G) { var s = '', i; for (i = 0; i < G.corner; i++) s += '◆'; return s; }
function cuCTroop(e) { return (typeof bnDefaultTroop === 'function') ? (bnDefaultTroop(e) || '') : ''; }
function cuCTroopIcon(e) { return (typeof bnTroopIconHtml === 'function') ? bnTroopIconHtml(cuCTroop(e)) : ''; }
// 戰法基本資料:BN_SKILLS;兵種卡(BN_LEGION)轉成同形狀(legion = true)
function cuCSkill(id) {
  var d = (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]) || null, L;
  if (d) return d;
  L = (typeof BN_LEGION !== 'undefined' && BN_LEGION.cards && BN_LEGION.cards[id]) || null;
  return L ? { id: id, name: L.name, cat: 'legion', troop: L.troop, srcFig: L.srcFig, legion: true } : null;
}
function cuCSkName(id) { var d = cuCSkill(id); return d ? d.name : String(id); }
function cuCShort(id) {
  var d = cuCSkill(id), L;
  if (!d) return '';
  if (!d.legion) return (typeof bnSkillShort === 'function') ? bnSkillShort(id) : '';
  L = BN_LEGION.cards[id];
  return (L.pros && L.pros[0] && L.pros[0].t) || '';
}
// 說明列(與 cardsUiInfo 同形:lines = [[標題, 內文]]):一般戰法用 bnSkillInfo,兵種卡列優勢 / 代價
function cuCInfo(id) {
  var d = cuCSkill(id), L;
  if (!d) return null;
  if (!d.legion) return (typeof bnSkillInfo === 'function') ? bnSkillInfo(id) : null;
  L = BN_LEGION.cards[id];
  return { title: L.name, tags: ['兵種卡', L.troop + '兵'], tagCls: [], lines: [
    ['效果', (L.pros || []).map(function (x) { return x.t; }).join(';') || '—'],
    ['代價', (L.cons || []).map(function (x) { return x.t; }).join(';') || '—']] };
}
// 目前裝在誰身上:[{eid, slot, name}](只看名冊 eq 表)
function cuCHolders(cs, id) {
  var eq = bnSkcLoad().eq, out = [], k, i, f;
  for (k in eq) for (i = 0; i < 2; i++) if (eq[k][i] === id) { f = cardsFind(cs, k); out.push({ eid: k, slot: i, name: f ? f.e.name : '(已離隊)' }); }
  return out;
}
function cuCOtherTxt(o) {
  var s = '效果 ×' + (Math.round(o.mul * 100) / 100);
  if (o.ratePP) s += ';發動率 ' + cuCPp(o.ratePP);
  if (o.tgtCut) s += ';目標少 ' + o.tgtCut + ' 個';
  return s;
}

// ---------- 傳承狀態(卡上按鈕與傳承浮層共用) ----------
// 回 {ok, n(未擁有可傳承數), reason};派駐中 / 非名冊 / 鎖定 / 品階 / 全部擁有 皆不可傳承
function cuInhState(cs, f) {
  var e = f.e, chk;
  if (f.list !== 'roster') return { ok: false, n: 0, reason: '待定或流浪中的人不能傳承,請先收入名冊' };
  if (e.at) return { ok: false, n: 0, reason: '派駐中,請先卸任再傳承' };
  chk = bnSkcInheritCheck(cs, e);
  if (!chk.ok) return { ok: false, n: 0, reason: CUC_INH_REASON[chk.reason] || '不可傳承' };
  return { ok: true, n: chk.fresh.length, reason: '' };
}

// ---------- 人物卡 ----------
// 卡面戰法列:固定 / 被動 / 聯動(職業預設)+ 選擇槽 0、1(依裝備表;白階第 2 槽顯示「青階開放」;名人空槽可點裝備)+ 自動配(灰字)
function cuCSkillRows(e, inR) {
  var eq = bnSkcLoad().eq[e.id] || [null, null], rows = (typeof bnCardSkillRows === 'function') ? bnCardSkillRows(e) : [], out = [], n = bnSkcSlots(e), eqIds = eq.filter(function (x) { return !!x; }), i;
  rows.forEach(function (r) {
    if (r.role === 'slot' || r.role === 'learned') { if (eqIds.indexOf(r.id) < 0) out.push({ id: r.id, cat: r.cat, tag: '自動', slot: -1, auto: true }); return; }
    out.push({ id: r.id, cat: r.cat, tag: CUC_ROLE[r.role] || '聯動', slot: -1 });
  });
  for (i = 0; i < 2; i++) {
    if (i >= n) out.push({ lock: true, slot: i });
    else if (eq[i]) out.push({ id: eq[i], cat: (cuCSkill(eq[i]) || {}).cat, tag: '選擇槽', slot: i });
    else if (inR && e.fig) out.push({ empty: true, slot: i });
  }
  return out;
}
function cuCChipHtml(c, eid) {
  var d, t;
  if (c.lock) return '<span class="cpsk lock"><span class="cpn">青階開放</span></span>';
  if (c.empty) return '<button class="cpsk empty" data-a="cpop" data-k="pick" data-eid="' + cuEsc(eid) + '" data-slot="' + c.slot + '"><span class="cpn">空槽</span><em class="cprole">點選裝備</em></button>';
  d = cuCSkill(c.id);
  t = bnSkcTier(c.id);
  return '<button class="cpsk' + (t === 'S' || t === 'A' ? ' ex' : '') + (c.auto ? ' auto' : '') + '" data-a="cpop" data-k="skill" data-id="' + cuEsc(c.id) + '" data-eid="' + cuEsc(eid) + '" data-slot="' + c.slot + '">' +
    '<i class="cpcat">' + (CUC_CAT[(d && d.cat) || ''] || '') + '</i><span class="cpn">' + cuEsc(d ? d.name : c.id) + '</span><em class="cprole">' + cuEsc(c.tag) + '</em></button>';
}
// 人物卡(取代 cuDetailHtml 原本的 cardsUiHtmlCard):橫向卡片,內含畫像 / 星數 / 兵種 / 陣營 / 姓名 / 五維 / 戰法清單 / 底列兩鈕
function cuPersonCardHtml(cs, f) {
  var e = f.e, G = CARD_GRADE[e.gr] || CARD_GRADE[0], st = cardsStats(e), lv = cardsStarLv(e), inR = f.list === 'roster', j = CARD_JOB_BY_ID[e.main], stars = '', chips = '', ck, i, h;
  cuCardCss();
  if (CUC.pop && CUC.pop.eid !== e.id) { CUC.pop = null; CUC.stack = []; }   // 換了人 → 舊浮層收掉
  for (i = 1; i <= CARD_FURNACE.starMax; i++) stars += i <= lv ? '★' : '☆';
  cuCSkillRows(e, inR).forEach(function (c) { chips += cuCChipHtml(c, e.id); });
  ck = cuInhState(cs, f);
  h = '<div class="cupc g' + e.gr + '"><div class="cupt">' + cuSilPortrait(e, false) + '<span class="cupc-tl">' + cuCTroopIcon(e) + '</span><span class="cupc-tr">' + cuEsc(CARD_FAC[e.fac] || '') + '</span>' +
    '<span class="cupst">' + stars + (e.star ? ' 🔒' : '') + '</span></div>' +
    '<div class="cupr"><div class="cuph"><span class="cugr">' + G.ch + '</span><b class="cupn">' + cuEsc(e.name) + '</b>' + (e.zi ? '<span class="cusub">(' + cuEsc(e.zi) + ')</span>' : '') + '<span class="cupgem">' + cuCGem(G) + '</span></div>' +
    '<div class="cupsb">' + cuEsc(CARD_FAC[e.fac] || '') + ' · ' + cuCTroopIcon(e) + cuEsc(cuCTroop(e)) + '兵 · ' + cuEsc(CARD_LEARN[e.learn] || '') + '</div>' +
    '<div class="cupsb cuink">' + (e.fig ? '名人' : '路人') + (j ? ' · ' + cuEsc(j.name) : '') + '</div>' +
    '<div class="cupstat">' + CARD_STATS.map(function (nm, k) { return '<span><i>' + nm + '</i><b>' + st[k] + '</b></span>'; }).join('') + '</div>' +
    '<div class="cupsk">' + chips + '</div>' +
    '<div class="cupbt"><button class="cub" data-a="cpop" data-k="bio" data-eid="' + cuEsc(e.id) + '">📜 人物傳記</button>' +
    '<button class="cub' + (ck.ok ? '' : ' cpno') + '" data-a="cpop" data-k="inherit" data-eid="' + cuEsc(e.id) + '">🔱 傳承' + (ck.ok ? ' (' + ck.n + ')' : '') + '</button></div>' +
    '</div></div>';
  if (!ck.ok) h += '<div class="cusub cuink">傳承:' + cuEsc(ck.reason) + '</div>';
  cuPopSync();
  return h;
}

// ---------- 底部浮層 ----------
function cuPopEl() {
  var el, pn;
  if (CUC.el) return CUC.el;
  if (typeof document === 'undefined' || !document.body || !document.createElement) return null;
  cuCardCss();
  el = document.createElement('div');
  el.id = 'cuCardPop';
  el.hidden = true;
  el.addEventListener('click', function (ev) {
    var b = ev ? ev.target : null, a, cs = cardsGet();
    while (b && b !== el && !(b.getAttribute && b.getAttribute('data-a'))) b = b.parentNode;
    if (!b || b === el || !cs || cu.revealing) return;
    a = b.getAttribute('data-a');
    if (cuCardClick(a, b, cs) && cu.open) cardsUiRender();
  });
  document.body.appendChild(el);
  CUC.el = el;
  cuCardKeys();
  // 面板被關(hidden 變更)→ 浮層同步收掉,不殘留到下次開啟
  pn = document.getElementById('cardsPanel');
  if (pn && typeof MutationObserver === 'function') new MutationObserver(function () { cuPopSync(); }).observe(pn, { attributes: true, attributeFilter: ['hidden'] });
  return el;
}
// Esc:先關底部浮層(capture 階段攔下,不讓面板管理器一起關掉名冊面板)
function cuCardKeys() {
  if (CUC.key || typeof window === 'undefined' || !window.addEventListener) return;
  CUC.key = true;
  window.addEventListener('keydown', function (ev) {
    if (!ev || (ev.key !== 'Escape' && ev.key !== 'Esc') || !CUC.pop) return;
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    CUC.pop = null; CUC.stack = []; cuPopSync();
    if (cu.open) cardsUiRender();
  }, true);
}
function cuPopGo(p, push) {
  if (push) { if (CUC.pop) CUC.stack.push(CUC.pop); }
  else CUC.stack = [];
  CUC.pop = p;
  cuCardKeys();
}
function cuPopErr(msg) { if (CUC.pop) CUC.pop.err = msg; }
// 依 CUC.pop 重畫浮層;面板未開、人已不在、或無浮層 → 隱藏並清狀態
function cuPopSync() {
  var el = cuPopEl(), cs = cardsGet(), p = CUC.pop, f = null, r = null, sheetTitle;
  if (!el) return;
  if (p && p.eid && cs) f = cardsFind(cs, p.eid);
  if (!p || !cs || !cu.open || !cu.detail || (p.eid && !f)) { CUC.pop = null; CUC.stack = []; el.hidden = true; el.innerHTML = ''; return; }
  if (p.k === 'skill') r = cuPopSkill(cs, f, p);
  else if (p.k === 'pick') r = cuPopPick(cs, f, p);
  else if (p.k === 'bio' && f) r = cuPopBio(cs, f);
  else if (p.k === 'inherit' && f) r = cuPopInherit(cs, f, p);
  if (!r) { CUC.pop = null; CUC.stack = []; el.hidden = true; el.innerHTML = ''; return; }
  sheetTitle = r.title || '';
  el.innerHTML = '<div class="cucp-mask" data-a="cpclose"></div><div class="cucp-sheet" role="dialog" aria-label="' + cuEsc(sheetTitle) + '">' +
    '<div class="cucp-hd">' + (CUC.stack.length ? '<button class="cub cucp-bk" data-a="cpback">‹ 返回</button>' : '') + '<b>' + cuEsc(sheetTitle) + '</b><button class="cucp-x" data-a="cpclose" aria-label="關閉">×</button></div>' +
    r.html + '</div>';
  el.hidden = false;
}
function cuPopTierChip(t) { return t ? '<span class="cptier" style="background:' + CUC_TIER_COL[t] + '">' + t + '</span>' : ''; }

// 技能明細:階級 / 類別 / 說明(bnSkillInfo)/ 來源 / 原主與他人效果 / 適合兵種 / 目前裝於;選擇槽上的戰法才有 更換 / 卸下
function cuPopSkill(cs, f, p) {
  var d = cuCSkill(p.id), lines, e = f ? f.e : null, inR = !!(f && f.list === 'roster'), tier, holders, eqRow, o, troops, h = '', fg, info;
  if (!d) return { title: '戰法', html: '<div class="cpl">查無此戰法</div>' };
  info = cuCInfo(p.id);
  lines = info ? info.lines.slice() : [];
  tier = bnSkcTier(p.id);
  if (d.cat === 'ult') lines.push(['來源', '名人固定大招(不可傳承)']);
  else if (d.cat === 'passive') lines.push(['來源', '名人被動(不可傳承)']);
  else if (d.legion) lines.push(['來源', '兵種卡 · 得自 ' + cuCFigName(d.srcFig) + '(' + d.troop + '兵)']);
  else if (d.fig) {
    fg = cuCFig(d.fig);
    lines.push(['來源', '傳承自 ' + cuCFigName(d.fig) + '(' + (fg && fg.gr === 4 ? '金' : '紫') + '名人)']);
    if (e && e.fig === d.fig) lines.push(['原主效果', '本人(原主)裝備:發動率 ' + cuCPp(BN_KIT_CFG.homeRate || 0) + ' 本命加成']);
    else { o = bnSkcOtherOf(p.id, e || { fig: '' }); lines.push(['原主效果', '原主本人裝備時依上方效果;他人裝備時 ' + (o ? cuCOtherTxt(o) : '')]); }
  } else lines.push(['來源', '通用戰法(B / C 不限人數裝備)']);
  if (tier) lines.push(['傳承階級', tier + '(' + (bnSkcExclusive(p.id) ? 'S / A 同時只能一人裝備' : 'B / C 可多人裝備') + ')']);
  troops = d.legion ? [d.troop] : (d.fig && typeof BN_FIG_SKILLS !== 'undefined' && BN_FIG_SKILLS[d.fig]) ? [BN_FIG_SKILLS[d.fig].troop] : ((d.fit && d.fit.troops) || []);
  if (troops.length) lines.push(['適合兵種', troops.join('、') + '兵']);
  holders = cuCHolders(cs, p.id);
  lines.push(['目前裝於', holders.length ? holders.map(function (x) { return x.name; }).join('、') : '未裝備']);
  lines.forEach(function (l) { h += '<div class="cpl"><b>' + cuEsc(l[0]) + '</b>' + cuEsc(l[1]) + '</div>'; });
  if (inR && p.slot >= 0) {
    eqRow = bnSkcLoad().eq[e.id] || [null, null];
    h += '<div class="cprow"><button class="cub" data-a="cpgo" data-k="pick" data-eid="' + cuEsc(e.id) + '" data-slot="' + p.slot + '">更換</button>';
    if (eqRow[p.slot] === p.id) h += '<button class="cub warn" data-a="cpuneq" data-eid="' + cuEsc(e.id) + '" data-slot="' + p.slot + '">卸下</button>';
    h += '</div>';
  }
  return { title: d.name, html: '<div>' + cuPopTierChip(tier) + '<span class="cptag">' + cuEsc((typeof BN_TEXT_CATS !== 'undefined' && BN_TEXT_CATS[d.cat]) || (d.legion ? '兵種卡' : d.cat)) + '</span></div>' + h + (p.err ? '<div class="cpwarn">' + cuEsc(p.err) + '</div>' : '') + '</div>' };
}

// 選擇槽裝備清單:只列已解鎖的戰法;可裝 → [裝備];S/A 被他人持有 → 顯示持有者與 [從 X 卸下](不自動搶)
function cuPopPick(cs, f, p) {
  var e = f ? f.e : null, slot = p.slot, owned, h = '';
  if (!e || f.list !== 'roster') return { title: '裝備戰法', html: '<div class="cpwarn">非名冊人員不能裝備戰法(先收入名冊)</div>' };
  if (slot < 0 || slot >= bnSkcSlots(e)) return { title: '裝備戰法', html: '<div class="cpwarn">此槽位目前未開放</div>' };
  owned = Object.keys(bnSkcLoad().own).filter(function (id) { return !!bnSkcTier(id); });
  owned.sort(function (a, b) { return CUC_TIER_ORD.indexOf(bnSkcTier(a)) - CUC_TIER_ORD.indexOf(bnSkcTier(b)); });
  h += '<div class="cpl">' + cuEsc(e.name) + ' · 第 ' + (slot + 1) + ' 槽。從已解鎖的戰法選一個;S / A 同時只能裝在一人身上,換人要先從對方卸下。</div>';
  if (p.err) h += '<div class="cpwarn">' + cuEsc(p.err) + '</div>';
  if (!owned.length) h += '<div class="cpl">尚未解鎖任何選擇戰法。傳承其他人可解鎖。</div>';
  owned.forEach(function (id) {
    var c = bnSkcCanEquip(cs, e, slot, id), t = bnSkcTier(id), act = '', why = '', hd;
    if (c.ok) act = '<button class="cub" data-a="cpeq" data-id="' + cuEsc(id) + '" data-eid="' + cuEsc(e.id) + '" data-slot="' + slot + '">裝備</button>';
    else if (c.reason === 'held') {
      hd = cuCHolders(cs, id).filter(function (x) { return x.eid === c.holder; })[0] || null;
      why = '由『' + (hd ? cuEsc(hd.name) : '他人') + '』裝備中,換人要先卸下';
      if (hd) act = '<button class="cub warn" data-a="cpuneq" data-eid="' + cuEsc(hd.eid) + '" data-slot="' + hd.slot + '">從' + cuEsc(hd.name) + '卸下</button>';
    } else if (c.reason === 'fit') why = c.msg || '條件不符';
    else why = CUC_REASON[c.reason] || '無法裝備';
    h += '<div class="cprow">' + cuPopTierChip(t) + '<button class="cpnm" data-a="cpgo" data-k="skill" data-id="' + cuEsc(id) + '" data-eid="' + cuEsc(e.id) + '" data-slot="-1">' + cuEsc(cuCSkName(id)) + '</button>' + act + (why ? '<span class="cpwhy">' + cuEsc(why) + '</span>' : '') + '</div>';
  });
  return { title: '選擇槽 · ' + e.name, html: h };
}

// 人物傳記:立繪(名人,有檔才顯示)+ cuBioText 組字
function cuPopBio(cs, f) {
  var e = f.e, src = '', h = '';
  if (e.fig) src = (typeof fxFigImg === 'function' && fxFigImg(e.fig, 'fullbody')) || ('assets/fullbody/' + e.fig + '.webp');
  if (src) h += '<img class="cpfb" alt="" src="' + cuEsc(src) + '" onerror="this.remove()">';
  h += '<div class="cpt">' + cuBioText(e).split('\n').map(function (s) { return '<p>' + cuEsc(s) + '</p>'; }).join('') + '</div>';
  return { title: '人物傳記 · ' + e.name, html: h + '<div style="clear:both"></div>' };
}

// 傳承:規則 2 行 → 清單(階級 / 名 / 摘要 / 已擁有或未得 / 推薦 3 名)→ [傳承此卡] → 二次確認
function cuPopInherit(cs, f, p) {
  var e = f.e, fig = !!e.fig, st = cuInhState(cs, f), list = bnSkcInheritList(e), tiers = {}, fresh, frag, sum, h = '';
  h += '<div class="cpl">傳承後此卡離開名冊(' + (fig ? '名人轉流浪,可花 ' + CARD_RECALL_COST + ' 碎片請回' : '路人消失') + '),以下戰法永久解鎖。S / A 同時只能一人裝備;B / C 可多人裝備。</div>';
  list.forEach(function (x) {
    var recs = cuRecommend(cs, x.id, e, 3), rh = '';
    recs.forEach(function (r) {
      var c = r.c, av = '<span class="cprh">' + cuSilPortrait(c, true) + '</span>';
      rh += r.e ? '<button class="cprc" data-a="cprec" data-id="' + cuEsc(r.e.id) + '">' + av + cuEsc(c.name) + '</button>' : '<span class="cprc off">' + av + cuEsc(c.name) + '<em>未擁有</em></span>';
    });
    h += '<div class="cprow">' + cuPopTierChip(x.tier) + '<button class="cpnm" data-a="cpgo" data-k="skill" data-id="' + cuEsc(x.id) + '" data-eid="' + cuEsc(e.id) + '" data-slot="-1">' + cuEsc(cuCSkName(x.id)) + '</button>' +
      (x.owned ? '<span class="cpok">已擁有</span>' : '<span class="cpno2">未得</span>') +
      '<span class="cpwhy">' + cuEsc(cuCShort(x.id)) + '</span>' +
      '<div class="cprl">推薦:' + (rh || '<span class="cpno2">沒有適合的人選</span>') + '</div></div>';
  });
  if (!list.length) h += '<div class="cpl">此人沒有可傳承的戰法。</div>';
  if (!st.ok) h += '<div class="cpwarn">' + cuEsc(st.reason) + '</div>';
  else if (!p.confirm) h += '<div class="cprow"><button class="cub warn" data-a="cpinh" data-eid="' + cuEsc(e.id) + '">傳承此卡</button></div>';
  else {
    fresh = list.filter(function (x) { return !x.owned; });
    fresh.forEach(function (x) { tiers[x.tier] = (tiers[x.tier] || 0) + 1; });
    sum = CUC_TIER_ORD.filter(function (t) { return tiers[t]; }).map(function (t) { return t + ' 戰法 ' + tiers[t] + ' 個'; });
    frag = (typeof bnSkcFrag === 'function') ? bnSkcFrag(e) : 0;
    h += '<div class="cpwarn">確定傳承『' + cuEsc(e.name) + '』?解鎖 ' + cuEsc(sum.join('、')) + ';得碎片 ' + frag + ';' + (fig ? cuEsc(e.name) + ' 將轉為流浪(可花 ' + CARD_RECALL_COST + ' 碎片請回)。' : '此路人將消失。') + '</div>' +
      '<div class="cprow"><button class="cub" data-a="cpinhno">取消</button><button class="cub warn" data-a="cpinhyes" data-eid="' + cuEsc(e.id) + '">確定傳承</button></div>';
  }
  if (p.err) h += '<div class="cpwarn">' + cuEsc(p.err) + '</div>';
  return { title: '傳承 · ' + e.name, html: h };
}

// 人物傳記組字(純函式):名人 = 「{name},字{zi},{home}人({birth})。」+ bio +「(依據:{fb})」+ 羈絆名單 + 名言 ≤2 句;
// 路人 = 「{name},{陣營}{出身池}出身,{職業階稱}。才 {tai},擅長{兵種}兵。」+ 詞條名。缺欄位就略過該句,不編造。回傳以換行分段的字串。
function cuBioText(c) {
  var out = [], f, s, fac, org, j, tm, names, t;
  if (!c) return '';
  if (c.fig) {
    f = cuCFig(c.fig);
    s = (f && f.name) || c.name || '';
    if (f && f.zi) s += ',字' + f.zi;
    if (f && f.home) s += ',' + f.home + '人';
    if (f && f.birth) s += '(' + f.birth + ')';
    out.push(cuCEndDot(s));
    if (f && f.bio) out.push(cuCEndDot(f.bio + (f.fb ? '(依據:' + f.fb + ')' : '')));
    if (typeof cxBondsOf === 'function') {
      names = cxBondsOf(c.fig).map(function (b) { return b.name; });
      if (names.length) out.push('羈絆:' + names.join('、') + '。');
    }
    if (typeof FAMOUS_LINES !== 'undefined' && FAMOUS_LINES[c.fig]) FAMOUS_LINES[c.fig].slice(0, 2).forEach(function (x) { out.push('「' + x + '」'); });
  } else {
    fac = CARD_FAC[c.fac] || '';
    org = (c.org && c.org.k === 'pin') ? '縣試' : (CARD_VENUES[c.pool] ? CARD_VENUES[c.pool].orgName : '');
    j = CARD_JOB_BY_ID[c.main];
    t = cuCTroop(c);
    out.push(cuCEndDot(c.name + ',' + fac + org + '出身'));
    out.push(cuCEndDot(t === '謀' ? '擅長謀略' : '擅長' + t + '兵'));
    names = [];
    (c.tr || []).forEach(function (id) { var x = (typeof CARD_TRAIT_BY_ID !== 'undefined') ? CARD_TRAIT_BY_ID[id] : null; if (x && names.indexOf(x.n) < 0) names.push(x.n); });
    (c.trn || []).forEach(function (x) { if (names.indexOf(x[0]) < 0) names.push(x[0]); });
    if (names.length) out.push('詞條:' + names.join('、') + '。');
  }
  return out.join('\n');
}

// ---------- 推薦(§3.3 分數公式) ----------
// 兵種適性(S3 A2 B1 C0,取戰法適合兵種的最高)+ 職業相符 2 + 同羈絆夥伴 1 + 同隊 1 − 兩槽已滿 1 − 已裝其他 S/A 0.5。
// 『戰法 tags 與人物詞條相符 1』未計:名人資料(CARD_FIGS)沒有 tags 欄。
function cuRecScore(c, id) {
  var d = cuCSkill(id), L = !!(d && d.legion), src, troops, apt, best = 0, s = 0, eq, filled = 0;
  if (!d) return 0;
  src = d.fig || d.srcFig || '';
  troops = L ? [d.troop] : (d.fig && typeof BN_FIG_SKILLS !== 'undefined' && BN_FIG_SKILLS[d.fig]) ? [BN_FIG_SKILLS[d.fig].troop] : ((d.fit && d.fit.troops) || []);
  apt = bnAptOf(c).apt;
  troops.forEach(function (t) { var v = CUC_APT_PT[apt[t]] || 0; if (v > best) best = v; });
  s += best;
  if (!L && d.fit && d.fit.jobs && c.ja && d.fit.jobs.some(function (j) { return !!c.ja[j]; })) s += 2;
  if (src && c.fig && src !== c.fig) {
    if (typeof cxBondsOf === 'function' && cxBondsOf(src).some(function (b) { return b.members.indexOf(c.fig) >= 0; })) s += 1;
    if (typeof CODEX_TEAMS !== 'undefined' && CODEX_TEAMS && CODEX_TEAMS.teams && CODEX_TEAMS.teams.some(function (t) {
      return t.slots.some(function (x) { return x.fig === src; }) && t.slots.some(function (x) { return x.fig === c.fig; });
    })) s += 1;
  }
  eq = (c.id && bnSkcLoad().eq[c.id]) || [null, null];
  filled = eq.filter(function (x) { return !!x; }).length;
  if (c.id && filled >= bnSkcSlots(c)) s -= 1;
  if (eq.some(function (x) { return !!x && bnSkcExclusive(x); })) s -= 0.5;
  return s;
}
function cuCRecSort(a, b) { return (b.score - a.score) || ((b.c.gr | 0) - (a.c.gr | 0)) || ((b.c.tai | 0) - (a.c.tai | 0)); }
// 推薦 n 名:名冊人優先(可裝、依分數),不足再補名人(未擁有,灰字);兵種卡只列同兵種。結果依名冊變動(人數 / 順序 / 裝備表)快取
function cuRecommend(cs, id, exclude, n) {
  var d = cuCSkill(id), L = !!(d && d.legion), troop = L ? d.troop : '', ex = exclude || {}, key, list = [], fills = [], src, ck;
  bnSkcLoad();
  key = cs.roster.map(function (r) { return r.id; }).join(',') + '#' + (bnskc.raw || '') + '#' + (ex.id || ex.fig || '');
  if (!CUC.rec || CUC.rec.key !== key) CUC.rec = { key: key, map: {} };
  ck = id + '|' + n;
  if (CUC.rec.map[ck]) return CUC.rec.map[ck];
  cs.roster.forEach(function (r) {
    if (r.id === ex.id) return;
    if (L && cuCTroop(r) !== troop) return;
    if (bnSkcFit(r, id)) return;
    list.push({ e: r, c: r, score: cuRecScore(r, id) });
  });
  list.sort(cuCRecSort);
  if (list.length < n) {
    src = (typeof fxFigSrc === 'function' && fxFigSrc()) || (typeof CARD_FIGS !== 'undefined' ? CARD_FIGS : []);
    src.forEach(function (fg) {
      var c;
      if (fg.id === ex.fig || cardsFindFig(cs, fg.id)) return;
      c = cardFromFig(fg, 'G', 0);
      if (L && cuCTroop(c) !== troop) return;
      if (bnSkcFit(c, id)) return;
      fills.push({ e: null, c: c, score: cuRecScore(c, id) });
    });
    fills.sort(cuCRecSort);
    list = list.concat(fills);
  }
  list = list.slice(0, n);
  CUC.rec.map[ck] = list;
  return list;
}

// ---------- 點擊 ----------
// 處理 cp* 動作;未知動作回 false(交給 cuClick 其他分支)。處理完一律同步浮層。
function cuCardClick(a, b, cs) {
  var id = b.getAttribute('data-id') || '', eid = b.getAttribute('data-eid') || '', k = b.getAttribute('data-k') || '', slot = +(b.getAttribute('data-slot') || -1), f, r;
  if (!a || a.indexOf('cp') !== 0 || !cs) return false;
  if (a === 'cpop' || a === 'cpgo') cuPopGo({ k: k, id: id, eid: eid, slot: slot, confirm: false, err: '' }, a === 'cpgo');
  else if (a === 'cpclose') { CUC.pop = null; CUC.stack = []; }
  else if (a === 'cpback') CUC.pop = CUC.stack.pop() || null;
  else if (a === 'cpeq') {
    f = cardsFind(cs, eid);
    r = (f && f.list === 'roster') ? bnSkcEquip(cs, f.e, slot, id) : { ok: false, reason: 'none' };
    if (r.ok) { CUC.pop = null; CUC.stack = []; cu.msg = '已裝備『' + cuCSkName(id) + '』'; cuSave(); }
    else cuPopErr(r.reason === 'fit' ? (r.msg || '條件不符') : (CUC_REASON[r.reason] || '無法裝備'));
  }
  else if (a === 'cpuneq') { bnSkcUnequip(eid, slot); cu.msg = '已卸下'; cuSave(); }
  else if (a === 'cpinh') { if (CUC.pop) { CUC.pop.confirm = true; CUC.pop.err = ''; } }
  else if (a === 'cpinhno') { if (CUC.pop) CUC.pop.confirm = false; }
  else if (a === 'cpinhyes') {
    f = cardsFind(cs, eid);
    r = f ? bnSkcInherit(cs, f.e) : { ok: false, reason: 'none', unlocked: [], shards: 0, wander: false };
    if (r.ok) {
      cu.detail = null; CUC.pop = null; CUC.stack = [];
      cardsSyncTalents();
      cu.msg = '已傳承『' + f.e.name + '』:解鎖 ' + r.unlocked.length + ' 個戰法,碎片 +' + r.shards + (r.wander ? ';' + f.e.name + ' 轉為流浪' : '');
      cuSave();
    } else cuPopErr(CUC_INH_REASON[r.reason] || '無法傳承');
  }
  else if (a === 'cprec') {
    if (!cardsFind(cs, id)) return true;
    cu.detail = id; CUC.pop = null; CUC.stack = []; cu.msg = '';
  }
  else return false;
  cuPopSync();
  return true;
}
