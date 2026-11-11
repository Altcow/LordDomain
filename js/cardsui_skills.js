// js/cardsui_skills.js — 卡包『傳承』分頁 S(2026-11-11 版面重做):玩家的戰法庫(card_ui_redesign §5 傳承分頁)。
// 版面:頂列(已傳承 n / 總數、[研兵] [名冊可傳承的卡 n])→ 搜尋 + 分類篩選 → 左右兩欄:左側清單(窄螢幕約 40%,『已傳承』在上、『未傳承』在下,各自捲動;寬 ≥ 600px 改為左右並排)、右側說明(約 60%,固定不隨清單捲)。
// 清單列只寫『階級字 + 空格 + 戰法名』。顏色(深淺主題皆可辨):已傳承 = 金(--cusk-own);可傳承(名冊有卡可拆、尚未擁有)= 灰(--cusk-av);目前無法傳承(無卡)= 深灰(--cusk-no)。
// 未傳承清單:可傳承排前面,無卡可傳承排後面。搜尋戰法名 / 武將名(武將命中時列出其可拆戰法)。
// 說明區:戰法名、階級、分類、效果 / 發動率、典故、拆解自誰(點了跳人物卡)、目前裝備者(點了跳人物卡)、狀態、使用 n/上限;可傳承者提供『傳承』捷徑(開該名人人物卡的傳承浮層)。
// 研兵與『名冊可傳承的卡』收進說明區(按鈕切換面板),不佔主版面。研兵沿用 bn_book.js 的 data-bbk 監聽(bnBookOnClick)。
// 掛在 cardsui.js:cardsUiRender → cuSkillsHtml(cs)。點擊與輸入由本檔自掛 document 監聽(capture 階段處理後 stopPropagation),cuClick 不需改。搜尋輸入只重畫清單與說明區,不重建搜尋框(避免行動裝置輸入中斷)。
// 全域名稱:CU_SK CU_SK_CAT CU_SK_TIER CU_SK_CSS cuSkCss cuSkNorm cuSkTx cuSkName cuSkShort cuSkLabel cuSkCatImg cuSkAll cuSkOwned cuSkHolders cuSkAvailMap cuSkState cuSkCandidates cuSkRowHtml cuSkListsHtml cuSkDetailHtml cuSkDrillHtml cuSkInhPanelHtml cuSkPartsHtml cuSkRefresh cuSkRedraw cuSkillsHtml cuSkillsClick cuSkOnClick cuSkOnInput
// 不發聲、不寫存檔。ES2017;不用 ?. ??。

var CU_SK = { q: '', cat: '', sel: '', panel: '', av: {} };   // 搜尋字 / 分類篩選(空 = 全部)/ 說明所選戰法 id / 說明區面板('' | 'drill' | 'inh')/ 可拆戰法對映(每次重畫更新)
// 分類篩選:[BN_SKILL_CAT 的分類名, 圖示 id(assets/skillcat/cat_<id>.webp;無圖則只顯示文字)]
var CU_SK_CAT = [['物理攻擊', 'phys'], ['謀略攻擊', 'strat'], ['弓系', 'bow'], ['普攻強化', 'pursuit'], ['增益', 'buff'], ['控場', 'control'], ['治療', 'heal'], ['防護', 'def'], ['減益', 'debuff'], ['兵種卡', '']];
// 階級:S 朱金、A 紫、B 青藍、C 灰褐(card_ui_redesign R5)
var CU_SK_TIER = [['S', '朱金'], ['A', '紫'], ['B', '青藍'], ['C', '灰褐']];
var CU_SK_CSS = ':root{--cusk-own:#8a6a00;--cusk-av:#6b6b6b;--cusk-no:#3a3a3a}' +
  '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--cusk-own:#e2c066;--cusk-av:#a8a8a8;--cusk-no:#7a7a7a}}' +
  ':root[data-theme="dark"]{--cusk-own:#e2c066;--cusk-av:#a8a8a8;--cusk-no:#7a7a7a}' +
  '#cardsPanel .cusk-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:4px 0 6px}#cardsPanel .cusk-stat{font-weight:bold;flex:1 1 auto;font-size:13px}' +
  '#cardsPanel .cusk-q{width:100%;box-sizing:border-box;min-height:44px;font-size:16px;padding:6px 10px;border:1px solid rgba(255,255,255,.3);border-radius:6px;background:rgba(255,255,255,.08);color:#eee}' +
  '#cardsPanel .cusk-cats{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:4px;margin:6px 0}' +
  '#cardsPanel button.cusk-cat{display:inline-flex;flex:none;align-items:center;gap:4px;min-height:40px;padding:0 8px;border:none;border-radius:6px;background:rgba(255,255,255,.12);color:#eee;font-size:12px}' +
  '#cardsPanel button.cusk-cat.on{background:#f0b45a;color:#222}#cardsPanel .cusk-cat img{width:18px;height:18px}' +
  '#cardsPanel .cusk-wrap{display:flex;gap:8px;align-items:flex-start}' +
  '#cardsPanel .cusk-lists{flex:0 0 40%;min-width:0;display:flex;flex-direction:column;gap:6px}' +
  '#cardsPanel .cusk-col{min-width:0}#cardsPanel .cusk-lh{font-size:12px;font-weight:bold;margin:2px 2px}' +
  '#cardsPanel .cusk-list{max-height:28vh;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:3px;border-radius:6px;background:var(--cu-paper);color:var(--cu-ink)}' +
  '#cardsPanel button.cusk-row{display:block;width:100%;min-height:40px;margin:1px 0;padding:4px 6px;border:none;border-radius:4px;background:transparent;text-align:left;font-size:14px;overflow-wrap:anywhere}' +
  '#cardsPanel button.cusk-row.on{background:rgba(127,127,127,.25)}' +
  '#cardsPanel .cusk-own{color:var(--cusk-own);font-weight:bold}#cardsPanel .cusk-av{color:var(--cusk-av)}#cardsPanel .cusk-no{color:var(--cusk-no)}' +
  '#cardsPanel .cusk-det{flex:1 1 60%;min-width:0;position:sticky;top:0;align-self:flex-start;max-height:70vh;overflow-y:auto;padding:8px;border-radius:8px;background:var(--cu-paper);color:var(--cu-ink)}' +
  '#cardsPanel .cusk-ph{display:flex;align-items:center;gap:6px;flex-wrap:wrap}#cardsPanel .cusk-ph b{flex:1 1 auto;font-size:16px}' +
  '#cardsPanel .cusk-tag{font-size:12px;padding:0 6px;border-radius:4px;background:rgba(127,127,127,.2)}' +
  '#cardsPanel .cusk-det .cuil{margin:4px 0;overflow-wrap:anywhere}#cardsPanel .cusk-empty{font-size:13px;opacity:.85;padding:8px 2px}' +
  '@media (min-width:600px){#cardsPanel .cusk-lists{flex:0 0 58%;flex-direction:row}#cardsPanel .cusk-list{max-height:62vh}#cardsPanel .cusk-det{flex:1 1 42%}}';

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
function cuSkTierOrd(t) { for (var i = 0; i < CU_SK_TIER.length; i++) if (CU_SK_TIER[i][0] === t) return i; return 9; }

// 全部可解鎖戰法(戰法表 + 兵種卡,且有階級者;大招 / 被動不計)
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
function cuSkLabel(id) {
  var L = (typeof BN_LEGION !== 'undefined' && BN_LEGION.cards && BN_LEGION.cards[id]) || null;
  return (typeof BN_SKILL_CAT !== 'undefined' && BN_SKILL_CAT[id]) || (L ? '兵種卡' : '');
}
function cuSkCatImg(label) {
  var i, c = null;
  for (i = 0; i < CU_SK_CAT.length; i++) if (CU_SK_CAT[i][0] === label) c = CU_SK_CAT[i];
  return (c && c[1]) ? '<img src="assets/skillcat/cat_' + c[1] + '.webp" alt="">' : '';
}
// 持有者(名冊內裝有此戰法的人):回名冊 entry 陣列
function cuSkHolders(cs, id) {
  return bnSkcHolders(id, cs).map(function (k) { return bnSkcEntry(cs, k); }).filter(function (r) { return !!r; });
}
// 可拆對映:戰法 id → {e: 可拆的名冊人, n: 該人可解鎖數}(名冊內 bnSkcInheritCheck.ok 者;同一戰法取先出現的高品階者)
function cuSkAvailMap(cs) {
  var map = {}, rs = cs && Array.isArray(cs.roster) ? cs.roster.slice() : [];
  if (typeof bnSkcInheritCheck !== 'function') return map;
  rs.sort(function (a, b) { return (b.gr | 0) - (a.gr | 0) || (b.tai | 0) - (a.tai | 0); });
  rs.forEach(function (e) {
    var c = bnSkcInheritCheck(cs, e);
    if (!c.ok) return;
    c.fresh.forEach(function (id) { if (!map[id]) map[id] = { e: e, n: c.fresh.length }; });
  });
  return map;
}
// 狀態:own = 已傳承;av = 可傳承(有卡可拆);no = 目前無法傳承(無卡)
function cuSkState(cs, id) {
  var a;
  if (bnSkcOwned(id)) return { k: 'own' };
  a = CU_SK.av && CU_SK.av[id];
  if (a) return { k: 'av', e: a.e, n: a.n };
  return { k: 'no' };
}
// 武將命中時其可拆戰法(名 / 字含搜尋字的名人)
function cuSkFigIds(q) {
  var src = (typeof fxFigSrc === 'function' && fxFigSrc()) || (typeof CARD_FIGS !== 'undefined' ? CARD_FIGS : []), out = [];
  src.forEach(function (f) {
    if (cuSkNorm(f.name).indexOf(q) < 0) return;
    if (typeof bnSkcInheritList === 'function') bnSkcInheritList({ fig: f.id }).forEach(function (x) { out.push(x.id); });
  });
  return out;
}
// 候選戰法:搜尋(戰法名 / 一行效果 / 分類 / 持有者 / 命中武將的可拆戰法)+ 分類篩選。回 id 陣列(不排序)
function cuSkCandidates(cs) {
  var q = CU_SK.q ? cuSkNorm(CU_SK.q) : '', pool = cuSkAll(), extra = {}, out = [];
  if (q) cuSkFigIds(q).forEach(function (id) { extra[id] = 1; });
  pool.forEach(function (id) {
    var hit = true;
    if (q) hit = !!extra[id] || cuSkNorm(cuSkName(id) + ' ' + cuSkShort(id) + ' ' + cuSkLabel(id) + ' ' + cuSkHolders(cs, id).map(function (r) { return r.name; }).join(' ')).indexOf(q) >= 0;
    if (q && !hit) return;
    if (CU_SK.cat && cuSkLabel(id) !== CU_SK.cat) return;
    out.push(id);
  });
  // 命中武將但戰法不在 pool 內(無階級)不列
  return out;
}
function cuSkRowHtml(cs, id) {
  var st = cuSkState(cs, id), t = bnSkcTier(id) || '';
  return '<button class="cusk-row cusk-' + st.k + (CU_SK.sel === id ? ' on' : '') + '" data-sk="pick" data-id="' + cuEsc(id) + '">' +
    cuEsc(t + ' ' + cuSkTx(cuSkName(id))) + '</button>';
}
// 左側清單:已傳承(上)/ 未傳承(下;可傳承排前、無卡排後)
function cuSkListsHtml(cs, ids) {
  var own = [], un = [], av = [], no = [], sorter;
  ids.forEach(function (id) { if (bnSkcOwned(id)) own.push(id); else if (cuSkState(cs, id).k === 'av') av.push(id); else no.push(id); });
  sorter = function (a, b) { return (cuSkTierOrd(bnSkcTier(a)) - cuSkTierOrd(bnSkcTier(b))) || (cuSkTx(cuSkName(a)) < cuSkTx(cuSkName(b)) ? -1 : 1); };
  own.sort(sorter); av.sort(sorter); no.sort(sorter); un = av.concat(no);
  return '<div class="cusk-col"><div class="cusk-lh">已傳承 ' + own.length + '</div><div class="cusk-list" data-list="own">' +
      (own.length ? own.map(function (id) { return cuSkRowHtml(cs, id); }).join('') : '<div class="cusk-empty">尚未傳承任何戰法</div>') + '</div></div>' +
    '<div class="cusk-col"><div class="cusk-lh">未傳承 ' + un.length + '</div><div class="cusk-list" data-list="un">' +
      (un.length ? un.map(function (id) { return cuSkRowHtml(cs, id); }).join('') : '<div class="cusk-empty">沒有符合的戰法</div>') + '</div></div>';
}
// 說明區:戰法說明(點了列之後)
function cuSkDetailHtml(cs, id) {
  var st, t, hs, L = (typeof BN_LEGION !== 'undefined' && BN_LEGION.cards && BN_LEGION.cards[id]) || null, d = (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]) || null, o = null, lines = [], h, src, srcTxt, mx, stTxt;
  if (!id) return '<div class="cusk-empty">點左側戰法名稱,在此看完整說明。</div>';
  st = cuSkState(cs, id); t = bnSkcTier(id) || '';
  if (d && typeof bnSkillInfo === 'function') o = bnSkillInfo(id);
  if (o) o.lines.forEach(function (l) { lines.push([l[0], cuSkTx(l[1])]); });
  else if (L) {
    src = (typeof CARD_FIG_BY_ID !== 'undefined' && L.srcFig && CARD_FIG_BY_ID[L.srcFig]) ? CARD_FIG_BY_ID[L.srcFig].name : '';
    lines.push(['兵種', L.troop + '兵' + (src ? ';出身:' + src : '')]);
    if (L.pros && L.pros.length) lines.push(['效果', L.pros.map(function (p) { return p.t; }).join(';')]);
    if (L.cons && L.cons.length) lines.push(['代價', L.cons.map(function (p) { return p.t; }).join(';')]);
  }
  h = '<div class="cusk-ph"><b>' + cuEsc(cuSkTx(cuSkName(id))) + '</b><span class="cusk-tag">' + cuEsc(t + ' · ' + cuSkTierName(t)) + '</span>' +
    (cuSkLabel(id) ? '<span class="cusk-tag">' + cuEsc(cuSkLabel(id)) + '</span>' : '') + '</div>';
  lines.forEach(function (l) { h += '<div class="cuil"><b>' + cuEsc(l[0]) + '</b> ' + cuEsc(l[1]) + '</div>'; });
  // 拆解自誰(名人來源;點了跳人物卡)
  if (d && d.fig) {
    src = cuSkFigName(d.fig);
    srcTxt = '<b>拆解自</b> ' + cuEsc(src) + (cuSkFigEntry(cs, d.fig) ? ' <button class="cub" data-sk="person" data-eid="' + cuEsc(cuSkFigEntry(cs, d.fig).id) + '">看人物卡</button>' : '');
    h += '<div class="cuil">' + srcTxt + '</div>';
  } else if (L && L.srcFig) {
    h += '<div class="cuil"><b>拆解自</b> ' + cuEsc(cuSkFigName(L.srcFig)) + '</div>';
  } else if (d) h += '<div class="cuil"><b>來源</b> 通用戰法</div>';
  // 目前裝備者(點了跳人物卡)
  hs = cuSkHolders(cs, id);
  h += '<div class="cuil"><b>目前裝備</b> ' + (hs.length ? hs.map(function (r) { return '<button class="cub" data-sk="person" data-eid="' + cuEsc(r.id) + '">' + cuEsc(r.name) + '</button>'; }).join(' ') : '未裝備') + '</div>';
  // 狀態與使用數
  stTxt = st.k === 'own' ? '已傳承(金字)' : st.k === 'av' ? '可傳承:卡包中的 ' + cuEsc(st.e.name) + ' 可拆,拆後解鎖' : '目前無法傳承(卡包中無可拆的卡)';
  h += '<div class="cuil"><b>狀態</b> ' + stTxt + '</div>';
  if (!L) { mx = bnSkcMaxUse(id); h += '<div class="cuil"><b>使用</b> ' + bnSkcUseCount(id, cs) + '/' + mx + '(同時裝備人數上限)</div>'; }
  if (st.k === 'av') h += '<div class="cprow"><button class="cub" data-sk="inh" data-eid="' + cuEsc(st.e.id) + '">傳承(開 ' + cuEsc(st.e.name) + ' 的人物卡)</button></div>';
  return '<div>' + h + '</div>';
}
function cuSkFigName(fig) { var f = (typeof CARD_FIG_BY_ID !== 'undefined' && fig) ? CARD_FIG_BY_ID[fig] : null; return f ? f.name : fig; }
// 名冊內是否有此名人的人(取第一位)
function cuSkFigEntry(cs, fig) {
  var rs = cs && Array.isArray(cs.roster) ? cs.roster : [], i;
  for (i = 0; i < rs.length; i++) if (rs[i].fig === fig) return rs[i];
  return null;
}
// 研兵(全兵種;全名冊同兵種共享)。按鈕 data-bbk = drill,由 bn_book.js 既有監聽處理
function cuSkDrillHtml() {
  var h = '', d, pct;
  if (typeof bnBookOpen !== 'function' || typeof bnBookLoad !== 'function' || typeof BNBOOK === 'undefined') return h;
  if (!bnBookOpen()) return h + '<div class="cusk-empty">卡包至少 5 人後開放討伐,可研兵強化兵種。</div>';
  d = bnBookLoad();
  pct = Math.round(BNBOOK.drillPer * 100);
  h += '<div class="cusk-empty">卡包內同兵種共享;討伐中兵力 / 攻擊 / 謀略 / 治療每級 +' + pct + '%(敵人不吃)。</div>';
  BN_DATA.troopList.forEach(function (t) {
    var lv = d.drill[t] | 0, cost;
    h += '<div class="cur"><span><b>' + cuEsc(t) + '兵</b> ' + lv + '/' + BNBOOK.drillMax + (lv ? ' · +' + Math.round(lv * pct) + '%' : '') + '</span>';
    if (lv < BNBOOK.drillMax) { cost = BNBOOK.drillCost(lv); h += bnBookBtn('升 ' + (lv + 1) + ' 級(碎片 ' + cost.shards + '、金幣 ' + cost.coin + ')', 'drill', ['', t]); }
    else h += '<span class="cusk-empty">已滿級</span>';
    h += '</div>';
  });
  if (typeof bnbk !== 'undefined' && bnbk.msg) h += '<div class="cuwarn">' + cuEsc(bnbk.msg) + '</div>';
  return h;
}
// 說明區的『名冊可傳承的卡』面板:紫以上、未鎖定、仍有戰法未解鎖(bnSkcInheritCheck.ok);依品階、才高到低
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
function cuSkInhPanelHtml(cs) {
  var rows = cuSkInheritRows(cs), h = '';
  if (!rows.length) return '<div class="cusk-empty">目前沒有可傳承的卡(需紫以上、未鎖定,且仍有戰法未解鎖)。</div>';
  rows.forEach(function (x) {
    var G = CARD_GRADE[x.e.gr] || { ch: '' };
    h += '<div class="cprow"><button class="cub" data-sk="person" data-eid="' + cuEsc(x.e.id) + '">' + cuEsc(x.e.name) + '</button>' +
      '<span class="cusk-empty">' + cuEsc(G.ch) + (x.e.fig ? ' · 名人' : ' · 路人') + ' · 可解鎖 ' + x.n + ' 個</span></div>';
  });
  return h;
}
// 說明區內容(依面板切換)
function cuSkDetailPanelHtml(cs, id) {
  var close = '<div class="cprow"><button class="cub" data-sk="panel" data-v="">‹ 返回戰法說明</button></div>';
  if (CU_SK.panel === 'drill') return close + '<div class="cusec">研兵(討伐)</div>' + cuSkDrillHtml();
  if (CU_SK.panel === 'inh') return close + '<div class="cusec">卡包中可傳承的卡</div>' + cuSkInhPanelHtml(cs);
  return cuSkDetailHtml(cs, id);
}
// 左右兩欄的內容(lists / detail),搜尋與點選只重畫這兩塊
function cuSkPartsHtml(cs) {
  var ids = cuSkCandidates(cs);
  return { lists: cuSkListsHtml(cs, ids), detail: cuSkDetailPanelHtml(cs, CU_SK.sel) };
}

// 捲動位置保存 / 還原(清單各自、說明區)
function cuSkScrolls() {
  var r = {};
  if (!cu.el || !cu.el.querySelectorAll) return r;
  Array.prototype.forEach.call(cu.el.querySelectorAll('.cusk-list[data-list],.cusk-det'), function (x) { r[x.getAttribute('data-list') || 'det'] = x.scrollTop; });
  return r;
}
function cuSkRestore(r) {
  if (!cu.el || !cu.el.querySelectorAll) return;
  Array.prototype.forEach.call(cu.el.querySelectorAll('.cusk-list[data-list],.cusk-det'), function (x) {
    var k = x.getAttribute('data-list') || 'det';
    if (r[k] !== undefined) x.scrollTop = r[k];
  });
}
// 只重畫左右兩欄(不重建搜尋框,行動裝置不失焦)
function cuSkRefresh(cs) {
  var sc = cuSkScrolls(), w, d, p;
  cs = cs || cardsGet();
  w = cu.el && cu.el.querySelector ? cu.el.querySelector('#cuskw') : null;
  d = cu.el && cu.el.querySelector ? cu.el.querySelector('#cuskd') : null;
  if (!w || !d || !cs) { cuSkRedraw(); return; }
  CU_SK.av = cuSkAvailMap(cs);
  p = cuSkPartsHtml(cs);
  w.innerHTML = p.lists;
  d.innerHTML = p.detail;
  cuSkRestore(sc);
}
// 整頁重畫(分類 chip、面板切換後的頂列、導頁前)保留捲動
function cuSkRedraw() {
  var sc = cuSkScrolls();
  cuKeepScroll(function () { if (typeof cardsUiRender === 'function') cardsUiRender(); });
  cuSkRestore(sc);
}

// 傳承分頁主體(cardsui.js cardsUiRender 呼叫)
function cuSkillsHtml(cs) {
  var all, own, h, cats = [''].concat(CU_SK_CAT.map(function (c) { return c[0]; })), p;
  if (!cs) return '<div class="cusub">尚無城邦資料</div>';
  cuSkCss();
  all = cuSkAll();
  own = cuSkOwned();
  CU_SK.av = cuSkAvailMap(cs);
  p = cuSkPartsHtml(cs);
  h = '<div class="cusk-top"><span class="cusk-stat">已傳承 ' + own.length + ' / ' + all.length + '</span>' +
    '<button class="cub" data-sk="panel" data-v="drill">研兵</button>' +
    '<button class="cub" data-sk="panel" data-v="inh">卡包可傳承的卡 (' + cuSkInheritRows(cs).length + ')</button></div>';
  h += '<input id="cuskq" class="cusk-q" type="search" placeholder="搜尋戰法或武將名" autocomplete="off" value="' + cuEsc(CU_SK.q) + '">';
  h += '<div class="cusk-cats">' + cats.map(function (c) {
    return '<button class="cusk-cat' + (CU_SK.cat === c ? ' on' : '') + '" data-sk="cat" data-v="' + cuEsc(c) + '">' + cuSkCatImg(c) + cuEsc(c || '全部') + '</button>';
  }).join('') + '</div>';
  h += '<div class="cusk-wrap"><div id="cuskw" class="cusk-lists">' + p.lists + '</div><div id="cuskd" class="cusk-det">' + p.detail + '</div></div>';
  return h;
}

// 點擊動作(cuSkOnClick 呼叫);回 'part' = 只重畫左右兩欄、'full' = 整頁重畫、false = 未處理
function cuSkillsClick(a, b, cs) {
  var id = b.getAttribute('data-id'), v = b.getAttribute('data-v'), eid = b.getAttribute('data-eid');
  if (a === 'pick') { CU_SK.sel = CU_SK.sel === id ? '' : id; CU_SK.panel = ''; return 'part'; }
  if (a === 'panel') { CU_SK.panel = v || ''; return 'part'; }
  if (a === 'cat') { CU_SK.cat = v || ''; return 'full'; }
  if (a === 'person' || a === 'inh') {
    if (!cs || !cardsFind(cs, eid)) return false;
    cuSetTab('R');
    cu.detail = eid; cu.confirm = null; cu.msg = '';
    if (a === 'inh' && typeof cuPopGo === 'function') cuPopGo({ k: 'inherit', id: '', eid: eid, slot: -1, confirm: false, err: '' }, false);
    return 'full';
  }
  return false;
}
// document 捕獲階段監聽:只處理 data-sk,處理後 stopPropagation,cuClick 不再處理
function cuSkOnClick(ev) {
  var b = ev && ev.target, a, cs, r;
  while (b && b.getAttribute && !b.getAttribute('data-sk')) b = b.parentNode;
  if (!b || !b.getAttribute || !cu.open || cu.revealing) return;
  a = b.getAttribute('data-sk');
  if (ev.stopPropagation) ev.stopPropagation();
  cs = cardsGet();
  r = cuSkillsClick(a, b, cs);
  if (r === 'full') cuSkRedraw();
  else if (r === 'part') cuSkRefresh(cs);
}
// 搜尋框輸入:只重畫左右兩欄,避免行動裝置輸入中斷焦點
function cuSkOnInput(ev) {
  var t = ev && ev.target, cs;
  if (!t || t.id !== 'cuskq' || !cu.open || !cu.el || !cu.el.querySelector) return;
  CU_SK.q = t.value;
  cs = cardsGet();
  if (cs) cuSkRefresh(cs);
}
if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
  document.addEventListener('click', cuSkOnClick, true);
  document.addEventListener('input', cuSkOnInput, false);
}
