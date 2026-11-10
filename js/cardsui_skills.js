// js/cardsui_skills.js — 卡包『傳承』分頁 S(card_ui_redesign §5 傳承分頁 / K6):玩家的戰法庫存。
// 版面(由上而下):說明一句 → 已解鎖 n / 總數 → 技能明細(點列後開啟,inline)→ 搜尋 + 分類篩選 → 已解鎖戰法依 S/A/B/C 分組(持有者 / 未裝備 / 專屬)→ 名冊中可傳承的卡(點 → 跳到該人物詳情)→ 研兵(討伐,全名冊同兵種共享)。
// 掛在 cardsui.js:cardsUiRender → cuSkillsHtml(cs)。點擊與輸入由本檔自掛 document 監聽(與 bn_book.js 同法:capture 階段處理後 stopPropagation),cuClick 不需改,cardsui.js 不動。
// 研兵:bn_book.js 目前只有名冊人物版 bnBookHtml(cs, e)(尚未改名 bnDrillHtml),本檔以 bnBookLoad / bnBookBtn / bnBookOpen 自組全兵種列;按鈕沿用 bn_book.js 既有的 data-bbk 監聽(bnBookOnClick)。
// 技能明細:cuPopSkill(id) 若存在且回傳字串則採用(K5);否則 bnSkillInfo(id);兵種卡(BN_LEGION)bnSkillInfo 無資料,改用 BN_LEGION 自組。
// 全域名稱:CU_SK CU_SK_CAT CU_SK_TIER CU_SK_CSS cuSkCss cuSkNorm cuSkTx cuSkAll cuSkOwned cuSkName cuSkShort cuSkLabel cuSkCatImg cuSkHolders cuSkMatch cuSkRowHtml cuSkListHtml cuSkDetailHtml cuSkInheritRows cuSkInheritHtml cuSkDrillHtml cuSkillsHtml cuSkillsClick cuSkOnClick cuSkOnInput
// 不發聲、不寫存檔。ES2017;不用 ?. ??。

var CU_SK = { q: '', cat: '', sel: '' };   // 搜尋字 / 分類篩選(空 = 全部)/ 明細所選戰法 id
// 分類篩選:[BN_SKILL_CAT 的分類名, 圖示 id(assets/skillcat/cat_<id>.webp;無圖則只顯示文字)]
var CU_SK_CAT = [['物理攻擊', 'phys'], ['謀略攻擊', 'strat'], ['弓系', 'bow'], ['普攻強化', 'pursuit'], ['增益', 'buff'], ['控場', 'control'], ['治療', 'heal'], ['防護', 'def'], ['減益', 'debuff'], ['兵種卡', '']];
// 階級:S / A 專屬(同時只能一人裝),B / C 可多人(card_ui_redesign R5 / R6)
var CU_SK_TIER = [['S', '朱金', '專屬'], ['A', '紫', '專屬'], ['B', '青藍', '可多人'], ['C', '灰褐', '可多人']];
var CU_SK_CSS = '#cardsPanel .cusk-desc{font-size:12px;opacity:.9;margin:2px 0 4px}#cardsPanel .cusk-stat{font-weight:bold;margin:2px 0 6px}' +
  '#cardsPanel .cusk-q{width:100%;box-sizing:border-box;min-height:44px;font-size:16px;padding:6px 10px;border:1px solid rgba(255,255,255,.3);border-radius:6px;background:rgba(255,255,255,.08);color:#eee}' +
  '#cardsPanel .cusk-cats{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}' +
  '#cardsPanel button.cusk-cat{display:inline-flex;align-items:center;gap:4px;min-height:40px;padding:0 8px;border:none;border-radius:6px;background:rgba(255,255,255,.12);color:#eee;font-size:12px}' +
  '#cardsPanel button.cusk-cat.on{background:#f0b45a;color:#222}#cardsPanel .cusk-cat img{width:18px;height:18px}' +
  '#cardsPanel .cusk-tier{font-weight:bold;font-size:13px;margin:8px 0 2px}' +
  '#cardsPanel .cusk-tS{color:#ff8a6a}#cardsPanel .cusk-tA{color:#c9a2ea}#cardsPanel .cusk-tB{color:#8fbcf5}#cardsPanel .cusk-tC{color:#b9ad96}' +
  '#cardsPanel button.cusk-row{display:flex;align-items:center;gap:8px;width:100%;min-height:48px;margin:3px 0;padding:4px 8px;border:none;border-left:4px solid rgba(255,255,255,.3);border-radius:6px;background:rgba(255,255,255,.07);color:#eee;text-align:left;font-size:14px}' +
  '#cardsPanel button.cusk-row.cusk-tS{border-left-color:#ff8a6a}#cardsPanel button.cusk-row.cusk-tA{border-left-color:#c9a2ea}#cardsPanel button.cusk-row.cusk-tB{border-left-color:#8fbcf5}#cardsPanel button.cusk-row.cusk-tC{border-left-color:#b9ad96}' +
  '#cardsPanel .cusk-row img{width:24px;height:24px;flex:none}#cardsPanel .cusk-bd{display:flex;flex-direction:column;min-width:0;flex:1}' +
  '#cardsPanel .cusk-nm{font-weight:bold;overflow-wrap:anywhere}#cardsPanel .cusk-ex{font-style:normal;font-size:10px;margin-left:4px;padding:0 4px;border-radius:3px;background:#b5462e;color:#fff}' +
  '#cardsPanel .cusk-sub{font-size:12px;opacity:.85;overflow-wrap:anywhere}#cardsPanel .cusk-hd{font-size:12px;color:#ffd98a;overflow-wrap:anywhere}#cardsPanel .cusk-hd.none{color:#aaa}' +
  '#cardsPanel .cusk-pop{margin:6px 0;padding:8px;border-radius:8px;background:var(--cu-paper);color:var(--cu-ink)}#cardsPanel .cusk-ph{display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
  '#cardsPanel .cusk-ph b{flex:1 1 auto;font-size:16px}#cardsPanel .cusk-tag{font-size:12px;padding:0 6px;border-radius:4px;background:rgba(0,0,0,.12)}';

function cuSkCss() {
  if (typeof document === 'undefined' || !document || !document.head || document.getElementById('cuSkStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuSkStyle';
  st.textContent = CU_SK_CSS;
  document.head.appendChild(st);
}
function cuSkNorm(s) { return (typeof srNorm === 'function') ? srNorm(s) : String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase(); }
// 魔幻世界顯示用語(fx_text.js fxText);歷史世界原樣回傳
function cuSkTx(s) { return (typeof fxText === 'function') ? fxText(s) : s; }
function cuSkTierName(t) { for (var i = 0; i < CU_SK_TIER.length; i++) if (CU_SK_TIER[i][0] === t) return CU_SK_TIER[i][1]; return ''; }

// 全部可解鎖戰法(戰法表 + 兵種卡,且有階級者;大招 / 被動不計):統計『總數』與排序依據
function cuSkAll() {
  var ids = {}, out = [];
  if (typeof BN_SKILLS !== 'undefined') Object.keys(BN_SKILLS).forEach(function (id) { ids[id] = 1; });
  if (typeof BN_LEGION !== 'undefined' && BN_LEGION.cards) Object.keys(BN_LEGION.cards).forEach(function (id) { ids[id] = 1; });
  Object.keys(ids).forEach(function (id) { if (bnSkcTier(id)) out.push(id); });
  return out;
}
// 已解鎖(bnskc.own)且有階級者
function cuSkOwned() {
  var d = bnSkcLoad();
  return cuSkAll().filter(function (id) { return d.own.hasOwnProperty(id); });
}
function cuSkName(id) {
  var d = (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]) || null, L = (typeof BN_LEGION !== 'undefined' && BN_LEGION.cards && BN_LEGION.cards[id]) || null;
  return d ? d.name : (L ? L.name : id);
}
function cuSkShort(id) {
  var L = (typeof BN_LEGION !== 'undefined' && BN_LEGION.cards && BN_LEGION.cards[id]) || null;
  if (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id] && typeof bnSkillShort === 'function') return bnSkillShort(id);
  return L ? '兵種卡 · ' + L.troop + '兵' : '';
}
function cuSkLabel(id) { return (typeof BN_SKILL_CAT !== 'undefined' && BN_SKILL_CAT[id]) || ''; }
function cuSkCatImg(label) {
  var i, c = null;
  for (i = 0; i < CU_SK_CAT.length; i++) if (CU_SK_CAT[i][0] === label) c = CU_SK_CAT[i];
  return (c && c[1]) ? '<img src="assets/skillcat/cat_' + c[1] + '.webp" alt="">' : '';
}
// 持有者:名冊內裝有此戰法的人(eq 的 entry id 必須仍在名冊中)
function cuSkHolders(cs, id) {
  var eq = bnSkcLoad().eq, out = [], k, r;
  for (k in eq) if (eq[k].indexOf(id) >= 0) { r = bnSkcEntry(cs, k); if (r) out.push(r.name); }
  return out;
}
// 搜尋 / 分類篩選(名、一行效果、分類、持有者)
function cuSkMatch(cs, id) {
  var q = CU_SK.q ? cuSkNorm(CU_SK.q) : '', lab = cuSkLabel(id);
  if (CU_SK.cat && lab !== CU_SK.cat) return false;
  if (!q) return true;
  return cuSkNorm(cuSkName(id) + ' ' + cuSkShort(id) + ' ' + lab + ' ' + cuSkHolders(cs, id).join(' ')).indexOf(q) >= 0;
}
function cuSkRowHtml(cs, id) {
  var t = bnSkcTier(id), ex = bnSkcExclusive(id), hs = cuSkHolders(cs, id);
  return '<button class="cusk-row cusk-t' + t + '" data-sk="pop" data-id="' + cuEsc(id) + '">' + cuSkCatImg(cuSkLabel(id)) +
    '<span class="cusk-bd"><span class="cusk-nm">' + cuEsc(cuSkTx(cuSkName(id))) + (ex ? '<i class="cusk-ex">專屬</i>' : '') + '</span>' +
    '<span class="cusk-sub">' + cuEsc(cuSkTx(cuSkShort(id))) + '</span>' +
    '<span class="cusk-hd' + (hs.length ? '' : ' none') + '">' + (hs.length ? '裝於 ' + hs.map(function (n) { return cuEsc(n); }).join('、') : '未裝備') + '</span></span></button>';
}
// 已解鎖戰法依 S / A / B / C 分組;無符合時顯示提示
function cuSkListHtml(cs) {
  var own = cuSkOwned(), h = '', shown = 0;
  if (!cs) return '';
  if (!own.length) return '<div class="cusub">尚未解鎖任何戰法。到名冊點人物卡的「傳承」,拆卡後即永久解鎖其戰法。</div>';
  CU_SK_TIER.forEach(function (T) {
    var rows = own.filter(function (id) { return bnSkcTier(id) === T[0] && cuSkMatch(cs, id); });
    if (!rows.length) return;
    h += '<div class="cusk-tier cusk-t' + T[0] + '">' + T[0] + ' · ' + T[1] + '(' + T[2] + ') ' + rows.length + '</div>';
    rows.forEach(function (id) { h += cuSkRowHtml(cs, id); });
    shown += rows.length;
  });
  if (!shown) h += '<div class="cusub">沒有符合的戰法</div>';
  return h;
}
// 技能明細(inline 浮層):cuPopSkill(K5)若存在則採用;否則 bnSkillInfo;兵種卡自組
function cuSkDetailHtml(cs, id) {
  var t = bnSkcTier(id), hs = cuSkHolders(cs, id), L = (typeof BN_LEGION !== 'undefined' && BN_LEGION.cards && BN_LEGION.cards[id]) || null, o = null, h, src, lines = [];
  if (typeof cuPopSkill === 'function') {
    h = cuPopSkill(id);
    if (typeof h === 'string' && h) return '<div class="cusk-pop">' + h + '<button class="cub" data-sk="close">關閉</button></div>';
  }
  if (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id] && typeof bnSkillInfo === 'function') o = bnSkillInfo(id);
  if (o) o.lines.forEach(function (l) { lines.push([l[0], cuSkTx(l[1])]); });
  else if (L) {
    src = (typeof CARD_FIG_BY_ID !== 'undefined' && L.srcFig && CARD_FIG_BY_ID[L.srcFig]) ? CARD_FIG_BY_ID[L.srcFig].name : '';
    lines.push(['兵種', L.troop + '兵' + (src ? ';出身:' + src : '')]);
    if (L.pros && L.pros.length) lines.push(['效果', L.pros.map(function (p) { return p.t; }).join(';')]);
    if (L.cons && L.cons.length) lines.push(['代價', L.cons.map(function (p) { return p.t; }).join(';')]);
  }
  lines.push(['目前裝於', hs.length ? hs.join('、') : '未裝備']);
  if (t === 'S' || t === 'A') lines.push(['裝備', '專屬:同時只能裝在一人身上,要換人須先到該人物卡卸下']);
  h = '<div class="cusk-pop"><div class="cusk-ph"><b>' + cuEsc(cuSkTx(cuSkName(id))) + '</b><span class="cusk-tag cusk-t' + t + '">' + t + ' · ' + cuSkTierName(t) + '</span><button class="cub" data-sk="close">×</button></div>';
  lines.forEach(function (l) { h += '<div class="cuil"><b>' + cuEsc(l[0]) + '</b> ' + cuEsc(l[1]) + '</div>'; });
  return h + '</div>';
}
// 名冊中可傳承的卡:紫以上、未鎖定、且有尚未解鎖的戰法(bnSkcInheritCheck.ok);依品階、才高到低
function cuSkInheritRows(cs) {
  var out = [];
  if (!cs || !cs.roster || typeof bnSkcInheritCheck !== 'function') return out;
  cs.roster.forEach(function (e) {
    var c = bnSkcInheritCheck(cs, e);
    if (c.ok) out.push({ e: e, n: c.fresh.length });
  });
  out.sort(function (a, b) { return (b.e.gr | 0) - (a.e.gr | 0) || (b.e.tai | 0) - (a.e.tai | 0) || (a.e.no | 0) - (b.e.no | 0); });
  return out;
}
function cuSkInheritHtml(cs) {
  var rows = cuSkInheritRows(cs), h = '<div class="cusec">名冊中可傳承的卡</div>';
  if (!rows.length) return h + '<div class="cusub">目前沒有可傳承的卡(需紫以上、未鎖定,且仍有戰法未解鎖)。</div>';
  rows.forEach(function (x) {
    var G = CARD_GRADE[x.e.gr] || { ch: '' };
    h += '<button class="cusk-row cusk-jump" data-sk="jump" data-id="' + cuEsc(x.e.id) + '"><span class="cusk-bd"><span class="cusk-nm">' + cuEsc(x.e.name) + '</span>' +
      '<span class="cusk-sub">' + cuEsc(G.ch) + (x.e.fig ? ' · 名人' : ' · 路人') + ' · 可解鎖 ' + x.n + ' 個(點此看人物卡)</span></span></button>';
  });
  return h;
}
// 研兵(全兵種;全名冊同兵種共享)。按鈕 data-bbk = drill,由 bn_book.js 既有監聽處理
function cuSkDrillHtml() {
  var h = '<div class="cusec">研兵(討伐)</div>', d, pct;
  if (typeof bnBookOpen !== 'function' || typeof bnBookLoad !== 'function' || typeof BNBOOK === 'undefined') return h;
  if (!bnBookOpen()) return h + '<div class="cusub">開放討伐(官階亭長、名冊 3 人)後,可研兵強化兵種。</div>';
  d = bnBookLoad();
  pct = Math.round(BNBOOK.drillPer * 100);
  h += '<div class="cusub">全名冊同兵種共享;討伐中兵力 / 攻擊 / 謀略 / 治療每級 +' + pct + '%(敵人不吃)。</div>';
  BN_DATA.troopList.forEach(function (t) {
    var lv = d.drill[t] | 0, cost;
    h += '<div class="cur"><span><b>' + cuEsc(t) + '兵</b> ' + lv + '/' + BNBOOK.drillMax + (lv ? ' · +' + Math.round(lv * pct) + '%' : '') + '</span>';
    if (lv < BNBOOK.drillMax) { cost = BNBOOK.drillCost(lv); h += bnBookBtn('升 ' + (lv + 1) + ' 級(碎片 ' + cost.shards + '、金幣 ' + cost.coin + ')', 'drill', ['', t]); }
    else h += '<span class="cusub">已滿級</span>';
    h += '</div>';
  });
  if (typeof bnbk !== 'undefined' && bnbk.msg) h += '<div class="cuwarn">' + cuEsc(bnbk.msg) + '</div>';
  return h;
}

// 傳承分頁主體(cardsui.js cardsUiRender 呼叫)
function cuSkillsHtml(cs) {
  var all, own, h, cats = [''].concat(CU_SK_CAT.map(function (c) { return c[0]; }));
  if (!cs) return '<div class="cusub">尚無城邦資料</div>';
  cuSkCss();
  all = cuSkAll();
  own = cuSkOwned();
  h = '<div class="cusk-desc">拆卡傳承技能後永久擁有;S/A 同時只能裝一人,B/C 可多人。</div>';
  h += '<div class="cusk-stat">已解鎖 ' + own.length + ' / ' + all.length + '</div>';
  if (CU_SK.sel) { if (bnSkcOwned(CU_SK.sel)) h += cuSkDetailHtml(cs, CU_SK.sel); else CU_SK.sel = ''; }
  h += '<input id="cuskq" class="cusk-q" type="search" placeholder="搜尋戰法、持有者" autocomplete="off" value="' + cuEsc(CU_SK.q) + '">';
  h += '<div class="cusk-cats">' + cats.map(function (c) {
    return '<button class="cusk-cat' + (CU_SK.cat === c ? ' on' : '') + '" data-sk="cat" data-v="' + cuEsc(c) + '">' + cuSkCatImg(c) + cuEsc(c || '全部') + '</button>';
  }).join('') + '</div>';
  h += '<div id="cuskl">' + cuSkListHtml(cs) + '</div>';
  h += cuSkInheritHtml(cs);
  h += cuSkDrillHtml();
  return h;
}

// 點擊動作(cuSkOnClick 呼叫);回 true = 已處理(呼叫端重畫)
function cuSkillsClick(a, b, cs) {
  var id = b.getAttribute('data-id'), v = b.getAttribute('data-v');
  if (a === 'pop') { CU_SK.sel = CU_SK.sel === id ? '' : id; return true; }
  if (a === 'close') { CU_SK.sel = ''; return true; }
  if (a === 'cat') { CU_SK.cat = v || ''; return true; }
  if (a === 'jump') {
    if (!cs || !cardsFind(cs, id)) return false;
    cuSetTab('R');
    cu.detail = id; cu.confirm = null; cu.msg = '';
    return true;
  }
  return false;
}
// document 捕獲階段監聽(同 bn_book.js):只處理 data-sk,處理後 stopPropagation,cuClick 不再處理
function cuSkOnClick(ev) {
  var b = ev && ev.target, a, cs;
  while (b && b.getAttribute && !b.getAttribute('data-sk')) b = b.parentNode;
  if (!b || !b.getAttribute || !cu.open || cu.revealing) return;
  a = b.getAttribute('data-sk');
  if (ev.stopPropagation) ev.stopPropagation();
  cs = cardsGet();
  if (cuSkillsClick(a, b, cs) && typeof cardsUiRender === 'function') cardsUiRender();
}
// 搜尋框輸入:只重畫列表區,避免行動裝置輸入中斷焦點
function cuSkOnInput(ev) {
  var t = ev && ev.target, box, cs;
  if (!t || t.id !== 'cuskq' || !cu.open || !cu.el || !cu.el.querySelector) return;
  CU_SK.q = t.value;
  box = cu.el.querySelector('#cuskl');
  cs = cardsGet();
  if (box && cs) box.innerHTML = cuSkListHtml(cs);
  else if (typeof cardsUiRender === 'function') cardsUiRender();
}
if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
  document.addEventListener('click', cuSkOnClick, true);
  document.addEventListener('input', cuSkOnInput, false);
}
