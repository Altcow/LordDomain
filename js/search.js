// js/search.js — 右側邊欄「搜尋」面板:建築 / 物件(含未解鎖)與科技節點;未解鎖者列出解鎖科技、前置鏈、成本與可否研發(缺什麼)。
// 入口:ui.js UI_SIDE_ITEMS key 'search'(special: 'search' → srToggle())。面板以 panelmgr 登錄為 big 面板(Esc / 返回先關它)。
// 索引 srIndex 首次開啟時建立並快取;世界 / 風格切換(fxPack / themeGet)後自動失效重建。狀態與缺項每次查詢即時計算。
// 不受功能閘與城建專注模式隱藏;城建專注隱藏的軍事建築仍列出,但「前往建造」停用並說明原因。
// 隱藏物件(fxHiddenObj)、退役物件、他城風格件不入索引;魔幻世界名稱走 OBJECTS[x].name(getter)與 techLabelOf / fxTechDesc。
// 全域名稱:srToggle srOpen srClose srSearch srIndex srGoBuild srTechGo srObjStatus srWhy
// 外部全域一律 typeof 守衛。ES2017;不用 ?. ??。

var SR_MAX = 50;
var SR_DEBOUNCE_MS = 150;
var SR_CHIPS = ['廁所', '市場', '城門', '研究院', '鐵'];
var SR_TOP_NAME = { eco: '經濟建築', deco: '擺設品', mil: '軍事建築' };
var SR_ST_TXT = { unlocked: '已解鎖', done: '已研完', cur: '研發中', queued: '排隊中', ready: '可研發', locked: '未解鎖', mega: '里程碑' };
// 常用簡體 → 繁體(搜尋時兩邊都轉;遊戲名稱為繁體)
var SR_S2T = {
  '厕': '廁', '仓': '倉', '粮': '糧', '医': '醫', '园': '園', '学': '學', '书': '書', '楼': '樓', '经': '經', '时': '時', '见': '見', '门': '門',
  '马': '馬', '桥': '橋', '阶': '階', '筑': '築', '铁': '鐵', '药': '藥', '议': '議', '区': '區', '广': '廣', '历': '歷', '汉': '漢', '业': '業',
  '农': '農', '钱': '錢', '纸': '紙', '乐': '樂', '会': '會', '东': '東', '车': '車', '长': '長', '产': '產', '边': '邊', '处': '處', '对': '對',
  '发': '發', '观': '觀', '关': '關', '规': '規', '归': '歸', '盐': '鹽', '战': '戰', '宁': '寧', '满': '滿', '库': '庫', '场': '場', '灶': '竈',
  '墙': '牆', '岁': '歲', '赏': '賞', '龙': '龍', '图': '圖', '网': '網', '题': '題', '说': '說', '语': '語', '记': '記', '过': '過', '还': '還'
};
// 常見別稱 → 物件 id(只列確實存在於 OBJECTS 的 id;tools/test_search.js 會核對)
var SR_ALIAS = {
  privy: ['茅廁', '茅房', '厠所', '溷'],
  market: ['市場', '集市', '市肆'],
  house: ['住宅', '房子', '民居', '住家'],
  palace: ['府邸', '官邸', '縣府'],
  research: ['研究院', '研究所', '書院'],
  granary_round: ['糧倉', '穀倉', '倉庫'],
  gate: ['大門', '城門樓'],
  wall: ['城垣', '城牆'],
  hospital: ['醫院', '診所', '藥房'],
  lumber: ['木場', '伐木'],
  quarry: ['採石', '石場'],
  bridge: ['橋'],
  stairs: ['樓梯', '台階', '臺階'],
  shop_wine: ['酒肆', '酒家', '酒樓'],
  inn: ['客棧', '旅店', '旅舍'],
  field_millet: ['田地', '農田'],
  well: ['水井', '井']
};

var sr = { el: null, input: null, list: null, world: null, open: false, q: '', sel: '', timer: 0, idx: null, key: '' };

function srNorm(s) {
  return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase().replace(/[一-鿿]/g, function (ch) { return SR_S2T[ch] || ch; });
}
function srEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

// ───────── 名稱 / 分類(當前世界) ─────────
function srTechName(n) { return (typeof techLabelOf === 'function') ? techLabelOf(n) : n.name; }
function srTechDesc(n) {
  var f = (typeof fxTechDesc === 'function') ? fxTechDesc(n.id) : null;
  return f !== null ? String(f) : String(n.desc || '');
}
function srUnlockNames(n) { return (typeof techUiUnlockNames === 'function') ? techUiUnlockNames(n) : []; }
function srGroupOf(id) {   // 建造選單群組(BUILD_GROUPS);不在任何群組者回 null
  var g = null;
  if (typeof BUILD_GROUPS !== 'undefined') BUILD_GROUPS.forEach(function (x) { if (!g && x.items.indexOf(id) >= 0) g = x; });
  return g;
}
function srTopOf(id) { return (typeof topOfItem === 'function') ? topOfItem(id) : 'eco'; }
function srCostObj(d) {
  var c = (d && d.cost) || {}, p = [], k;
  for (k in c) if (c[k] > 0) p.push(((typeof RESOURCES !== 'undefined' && RESOURCES[k]) ? RESOURCES[k].name : k) + ' ' + c[k]);
  return p.length ? p.join(' ') : '免費';
}
function srCostTech(id) {
  var n = techNode(id), c = techCostOf(id), p = [];
  if (!n || !c) return '';
  if (techIsMega(n)) return '大工程(依里程碑條件)';
  if (c.coin) p.push('金 ' + c.coin);
  if (c.xue) p.push('學識 ' + c.xue);
  if (c.goods && c.goods.n > 0) p.push('第' + (c.goods.tier + 1) + '階貨品×' + c.goods.n);
  return p.length ? p.join('　') : '免費';
}
function srWorldTxt() {
  var t = (typeof themeGet === 'function') ? themeGet() : 'han', sk = (typeof THEME_SKINS !== 'undefined' && THEME_SKINS[t]) ? THEME_SKINS[t] : null, p = (typeof fxPack === 'function') ? fxPack() : null;
  return '目前風格:' + (sk ? sk.name : t) + (p ? '(魔幻世界名稱)' : '');
}

// ───────── 索引(首次開啟建立;風格 / 世界切換後失效) ─────────
function srKey() {
  var p = (typeof fxPack === 'function') ? fxPack() : null, t = (typeof themeGet === 'function') ? themeGet() : '';
  return (p || 'han') + '|' + t + '|' + (typeof CITY_TECHS !== 'undefined' ? CITY_TECHS.length : 0) + '|' + (typeof OBJECTS !== 'undefined' ? Object.keys(OBJECTS).length : 0);
}
function srIndex() {
  var key = srKey(), obj = [], tech = [];
  if (sr.idx && sr.key === key) return sr.idx;
  if (typeof OBJECTS !== 'undefined') Object.keys(OBJECTS).forEach(function (id) {
    var d = OBJECTS[id], g, top, nm;
    if (!d || d.retired) return;
    if (typeof fxHiddenObj === 'function' && fxHiddenObj(id)) return;
    if (typeof sideOf === 'function' && sideOf(id) !== 'estate' && sideOf(id) !== 'both') return;
    if (typeof objPackOk === 'function' && !objPackOk(id)) return;
    g = srGroupOf(id); top = srTopOf(id); nm = String(d.name || id);
    obj.push({ kind: 'o', id: id, icon: d.icon || '', name: nm, nn: srNorm(nm), idn: srNorm(id), alias: (SR_ALIAS[id] || []).map(srNorm),
      grp: g ? g.name : '其他', top: top, kn: srNorm((SR_TOP_NAME[top] || '') + (g ? g.name : '其他')) });
  });
  if (typeof CITY_TECHS !== 'undefined') CITY_TECHS.forEach(function (n) {
    var nm = srTechName(n);
    tech.push({ kind: 't', id: n.id, icon: '📜', name: nm, nn: srNorm(nm), dn: srNorm(srTechDesc(n)), un: srUnlockNames(n).map(srNorm), era: n.era, branch: n.branch });
  });
  sr.idx = { obj: obj, tech: tech };
  sr.key = key;
  return sr.idx;
}

// ───────── 搜尋(評分:名稱完全 > 前綴 > 包含 > 部分字;別稱 / id / 分類 / 說明 / 解鎖名次之) ─────────
function srTextScore(q, nn) {
  var i, ch, uniq = 0, hit = 0, seen = {};
  if (!nn) return 0;
  if (nn === q) return 100;
  if (nn.indexOf(q) === 0) return 90;
  if (nn.indexOf(q) > 0) return 70;
  if (q.length < 2) return 0;
  for (i = 0; i < q.length; i++) {
    ch = q.charAt(i);
    if (seen[ch]) continue;
    seen[ch] = 1; uniq++;
    if (nn.indexOf(ch) >= 0) hit++;
  }
  if (hit === uniq) return 40;
  return (q.length >= 3 && hit * 2 >= uniq) ? 20 : 0;
}
function srScoreObj(q, it) {
  var s = srTextScore(q, it.nn), i;
  if (it.idn.indexOf(q) >= 0) s = Math.max(s, 50);
  for (i = 0; i < it.alias.length; i++) {
    if (it.alias[i] === q) s = Math.max(s, 95);
    else if (it.alias[i].indexOf(q) >= 0) s = Math.max(s, 60);
  }
  if (s < 30 && q.length >= 2 && it.kn.indexOf(q) >= 0) s = 30;   // 單字不以分類名比對(否則「市」會整批命中商鋪類)
  return s;
}
function srScoreTech(q, it) {
  var s = srTextScore(q, it.nn);
  if (s < 20 && it.dn.indexOf(q) >= 0) s = 20;
  if (s < 30 && it.un.some(function (u) { return u.indexOf(q) >= 0; })) s = 30;
  return s;
}
function srSearch(raw) {
  var q = srNorm(raw), idx = srIndex(), objs = [], techs = [], nO, nT;
  if (!q) return { q: q, objs: [], techs: [], nO: 0, nT: 0 };
  idx.obj.forEach(function (it, i) { var s = srScoreObj(q, it); if (s > 0) objs.push({ it: it, s: s, i: i }); });
  idx.tech.forEach(function (it, i) { var s = srScoreTech(q, it); if (s > 0) techs.push({ it: it, s: s, i: i }); });
  function byScore(a, b) { return (b.s - a.s) || (a.i - b.i); }
  objs.sort(byScore); techs.sort(byScore);
  nO = objs.length; nT = techs.length;
  objs = objs.slice(0, SR_MAX);
  techs = techs.slice(0, SR_MAX - objs.length);
  return { q: q, objs: objs, techs: techs, nO: nO, nT: nT };
}

// ───────── 狀態與缺項(即時計算) ─────────
function srObjNode(id) {   // 解鎖此建築的科技節點 id;起手 / 無對應 → ''
  var v = (typeof nlObjTech === 'function') ? nlObjTech(id) : undefined;
  return (v && v !== 'start' && techNode(v)) ? v : '';
}
function srObjStatus(id) {
  var nid, k;
  if (typeof isUnlocked === 'function' && isUnlocked('estate', id)) return 'unlocked';
  nid = srObjNode(id);
  if (nid) {
    k = techUiState(nid).k;
    if (k === 'cur' || k === 'queued' || k === 'ready') return k;
  }
  return 'locked';
}
function srTechKey(id) {
  var k = techUiState(id).k;
  if (k === 'req' || k === 'era') return 'locked';
  return k;
}
// 為何現在不能研發(或已在做什麼);可立即研發回「可立即研發」
function srWhy(nid) {
  var n = techNode(nid), st, s = techState(), c = techCostOf(nid), coin = (typeof world !== 'undefined' && world && world.res && world.res.coin) || 0, out = [], slots;
  if (!n || !s) return '';
  st = techUiState(nid);
  if (st.k === 'done') return '已研完';
  if (st.k === 'cur') return '研發中';
  if (st.k === 'queued') return '已在研發序列中';
  if (st.k === 'mega') return '里程碑不走研發序列';
  if (st.k === 'req') return '前置未滿:' + st.miss.join('、');
  if (st.k === 'era') return '第' + n.era + '時代尚未開放';
  slots = techSlots();
  if (!slots) out.push('尚無研究院,序列不會推進');
  else if (s.cur.length >= slots) out.push('研發槽已滿,可先排入序列');
  if (c && coin < c.coin) out.push('金不足(缺 ' + Math.ceil(c.coin - coin) + ')');
  if (c && Math.floor(s.xue + 1e-6) < c.xue) out.push('學識不足(缺 ' + Math.ceil(c.xue - s.xue) + ')');
  if (c && c.goods && techGoodsPlan(c.goods) === null) out.push('第' + (c.goods.tier + 1) + '階貨品不足');
  return out.length ? out.join(';') : '可立即研發';
}
function srChain(nid) {   // 已完成與未完成的前置(不含自身)、依時代與 id 排序
  return techUiAncestors(nid).filter(function (x) { return !!techNode(x); });
}
function srMissSum(list) {   // 缺項合計:金 / 學識 / 貨品(分階)/ 研發分鐘(里程碑不計時)
  var coin = 0, xue = 0, g = {}, min = 0, p = [];
  list.forEach(function (x) {
    var c = techCostOf(x), n = techNode(x);
    if (c) { coin += c.coin; xue += c.xue; if (c.goods && c.goods.n > 0) g[c.goods.tier] = (g[c.goods.tier] || 0) + c.goods.n; }
    if (n && !techIsMega(n)) min += Math.max(1, Math.round(techDurationOf(x) / 60));
  });
  if (coin) p.push('金 ' + coin);
  if (xue) p.push('學識 ' + xue);
  Object.keys(g).forEach(function (t) { p.push('第' + (+t + 1) + '階貨品×' + g[t]); });
  if (min) p.push('約 ' + min + ' 分研發');
  return p.length ? p.join('　') : '無';
}
function srTechBlock(nid) {
  var n = techNode(nid), ex, list, done, s = techState(), coin = (typeof world !== 'undefined' && world && world.res && world.res.coin) || 0, h = '';
  if (!n || !s) return '';
  h += '<div class="sr-l">研發狀態:<b>' + srEsc(SR_ST_TXT[srTechKey(nid)]) + '</b>　' + srEsc(srWhy(nid)) + '</div>';
  if (techDone(nid) || techIsMega(n)) return h;
  ex = techExpand(nid);
  if (!ex.ok) return h;
  list = ex.list;
  done = srChain(nid).filter(function (x) { return techDone(x); }).length;
  h += '<div class="sr-l">前置:已完成 ' + done + ' 項;' + (list.length > 1 ? '還缺 ' + (list.length - 1) + ' 項' : '已全數完成') + '</div>';
  if (list.length) h += '<div class="sr-chain">研發順序:' + list.map(function (x) { return srEsc(srTechName(techNode(x))); }).join(' → ') + '</div>';
  h += '<div class="sr-l">還需:' + srEsc(srMissSum(list)) + '</div>';
  h += '<div class="sr-l">目前:金 ' + Math.floor(coin) + '　學識 ' + Math.floor(s.xue) + '</div>';
  return h;
}

// ───────── 建造 / 科技樹 動作 ─────────
function srBuildBlock(id) {   // 不能直接前往建造的原因;可以則回 ''
  var d = OBJECTS[id], m, n = 0;
  if (typeof game === 'undefined' || !game || game.mode !== 'estate') return '請先回到經營版面再建造';
  if (typeof cityOnlyTopHidden === 'function' && cityOnlyTopHidden(srTopOf(id))) return '城建專注模式已隱藏軍事建築(設定可關閉)';
  m = (typeof capOf === 'function') ? capOf(id) : (d && d.max);
  if (m && typeof world !== 'undefined' && world && Array.isArray(world.objects)) {
    world.objects.forEach(function (o) { if (o && o.type === id) n++; });
    if (n >= m) return '已達數量上限 ' + m + ' 座';
  }
  return '';
}
function srGoBuild(id) {
  var leader, top, g, M;
  if (typeof OBJECTS === 'undefined' || !OBJECTS[id] || typeof ESTATE_MENU === 'undefined' || srBuildBlock(id)) return false;
  leader = (typeof varLeader === 'function') ? varLeader(id) : id;
  top = srTopOf(leader);
  g = srGroupOf(leader);
  M = ESTATE_MENU;
  M.setTop(top);
  M.setCat(g ? g.id : 'misc');
  if (leader !== id && ui.variant) ui.variant[leader] = id;
  if (typeof uiMenuSave === 'function') uiMenuSave();
  srClose();
  if (typeof uiIsCompact === 'function' && uiIsCompact()) uiCatOpen = true;
  setTool(typeof varResolve === 'function' ? varResolve(leader) : leader);
  if (typeof buildToolbar === 'function') buildToolbar();
  if (typeof updateResBar === 'function') updateResBar();
  return true;
}
function srTechGo(id) {
  if (!techNode(id) || typeof techPanelOpen !== 'function') return false;
  srClose();
  return techPanelOpen(id);
}

// ───────── 列表與詳情 ─────────
function srObjDetail(id) {
  var d = OBJECTS[id], st = srObjStatus(id), top = srTopOf(id), g = srGroupOf(id), nid = srObjNode(id), why, h = '<div class="sr-det">';
  h += '<div class="sr-l">分類:' + srEsc(SR_TOP_NAME[top] || '') + '・' + srEsc(g ? g.name : '其他') + '　尺寸 ' + d.w + '×' + d.h + '</div>';
  h += '<div class="sr-l">建造成本:' + srEsc(srCostObj(d)) + '</div>';
  if (st === 'unlocked') {
    why = srBuildBlock(id);
    h += '<div class="sr-l sr-ok">已解鎖</div>';
    h += '<button type="button" data-sr="build" data-k="' + srEsc(id) + '"' + (why ? ' disabled' : '') + '>前往建造</button>';
    if (why) h += '<div class="sr-l sr-warn">' + srEsc(why) + '</div>';
    if (nid) h += '<button type="button" data-sr="tech" data-k="' + srEsc(nid) + '">前往科技樹</button>';
  } else if (!nid) {
    h += '<div class="sr-l">此建築沒有登記解鎖科技。</div>';
  } else {
    h += '<div class="sr-l">解鎖科技:<b>' + srEsc(srTechName(techNode(nid))) + '</b>(第' + techNode(nid).era + '時代)</div>';
    h += srTechBlock(nid);
    h += '<button type="button" data-sr="tech" data-k="' + srEsc(nid) + '">前往科技樹</button>';
  }
  return h + '</div>';
}
function srTechDetail(nid) {
  var n = techNode(nid), un = srUnlockNames(n), h = '<div class="sr-det">', bn = (typeof techUiBranchName === 'function') ? techUiBranchName(n.branch) : n.branch;
  h += '<div class="sr-l">分支:' + srEsc(bn) + '・第' + n.era + '時代' + (techIsMega(n) ? '・里程碑' : '') + '</div>';
  h += '<div class="sr-l">說明:' + srEsc(srTechDesc(n)) + '</div>';
  h += '<div class="sr-l">成本:' + srEsc(srCostTech(nid)) + '</div>';
  h += '<div class="sr-l">解鎖:' + srEsc(un.length ? un.join('、') : '無') + '</div>';
  h += srTechBlock(nid);
  h += '<button type="button" data-sr="tech" data-k="' + srEsc(nid) + '">前往科技樹</button>';
  return h + '</div>';
}
function srRowHtml(kind, it, st) {
  var k = kind + ':' + it.id, d, lock = '', sub, tag, cost, head;
  if (kind === 'o') {
    d = OBJECTS[it.id];
    lock = st === 'locked' ? techObjLockText(it.id) : '';
    sub = it.top && SR_TOP_NAME[it.top] ? SR_TOP_NAME[it.top] + '・' + it.grp : it.grp;
    cost = srCostObj(d);
    head = d.icon || it.icon;
  } else {
    sub = (typeof techUiBranchName === 'function' ? techUiBranchName(it.branch) : it.branch) + '・第' + it.era + '時代';
    cost = srCostTech(it.id);
    head = it.icon;
  }
  tag = kind === 'o' ? srObjStatus(it.id) : srTechKey(it.id);
  return '<div class="sr-row" data-sr="pick" data-k="' + srEsc(k) + '" role="button" tabindex="0">' +
    '<span class="sr-ic">' + srEsc(head) + '</span>' +
    '<span class="sr-mn"><b>' + srEsc(it.name) + '</b><small>' + srEsc(sub) + (lock ? '<br>' + srEsc(lock) : '') + '</small></span>' +
    '<span class="sr-st s-' + tag + '">' + srEsc(SR_ST_TXT[tag] || '') + '</span>' +
    '<small class="sr-cost">' + srEsc(cost) + '</small>' +
    '</div>' + (sr.sel === k ? (kind === 'o' ? srObjDetail(it.id) : srTechDetail(it.id)) : '');
}
function srEmptyHtml(raw) {
  var h = '<div class="sr-hint">';
  if (!srNorm(raw)) h += '輸入建築或科技名稱。可用別稱(如「廁所」「市場」),也可只打其中幾個字(如「井」「門城」)。';
  else h += '找不到「' + srEsc(raw) + '」。試試別稱、部分字,或常用簡體(如「厕所」會轉成繁體再找)。';
  h += '</div><div class="sr-chips">' + SR_CHIPS.map(function (c) { return '<button type="button" data-sr="chip" data-k="' + srEsc(c) + '">' + srEsc(c) + '</button>'; }).join('') + '</div>';
  return h;
}
function srRender() {
  var res, html, total;
  if (!sr.list) return;
  if (sr.world) sr.world.textContent = srWorldTxt();
  if (typeof world === 'undefined' || !world || typeof techState !== 'function' || !techState()) { sr.list.innerHTML = '<div class="sr-hint">尚未載入城市資料。</div>'; return; }
  res = srSearch(sr.q);
  total = res.nO + res.nT;
  if (!total) { sr.list.innerHTML = srEmptyHtml(sr.q); return; }
  html = '<div class="sr-sum">找到 ' + total + ' 筆' + (total > SR_MAX ? '(列前 ' + SR_MAX + ' 筆)' : '') + '</div>';
  if (res.objs.length) {
    html += '<div class="sr-sec">建築與物件(' + res.nO + ')</div>';
    res.objs.forEach(function (r) { html += srRowHtml('o', r.it, srObjStatus(r.it.id)); });
  }
  if (res.techs.length) {
    html += '<div class="sr-sec">科技(' + res.nT + ')</div>';
    res.techs.forEach(function (r) { html += srRowHtml('t', r.it, ''); });
  }
  sr.list.innerHTML = html;
}

// ───────── 面板 ─────────
function srEnsure() {
  var el, head, title, cls, inp, world, list;
  if (sr.el) return sr.el;
  if (typeof document === 'undefined' || !document.createElement || !document.body) return null;
  el = document.createElement('div'); el.id = 'searchPanel'; el.hidden = true;
  head = document.createElement('div'); head.className = 'sr-head';
  title = document.createElement('b'); title.textContent = '搜尋';
  cls = document.createElement('button'); cls.type = 'button'; cls.className = 'sr-x'; cls.setAttribute('data-sr', 'close'); cls.setAttribute('aria-label', '關閉搜尋'); cls.title = '關閉'; cls.textContent = '✕';
  head.appendChild(title); head.appendChild(cls);
  inp = document.createElement('input'); inp.type = 'search'; inp.id = 'srInput'; inp.placeholder = '建築或科技名稱,例如 茅廁、市集、鐵';
  inp.setAttribute('autocomplete', 'off'); inp.setAttribute('enterkeyhint', 'search'); inp.setAttribute('aria-label', '搜尋建築或科技');
  world = document.createElement('div'); world.className = 'sr-world';
  list = document.createElement('div'); list.id = 'srList';
  el.appendChild(head); el.appendChild(inp); el.appendChild(world); el.appendChild(list);
  el.addEventListener('click', srOnClick);
  el.addEventListener('keydown', srOnKey);
  inp.addEventListener('input', srOnInput);
  document.body.appendChild(el);
  sr.el = el; sr.input = inp; sr.list = list; sr.world = world;
  if (typeof panelRegister === 'function') panelRegister('search', { kind: 'big', el: el, close: srHide });
  return el;
}
function srHide() {
  sr.open = false;
  if (sr.timer && typeof clearTimeout === 'function') clearTimeout(sr.timer);
  sr.timer = 0;
  if (sr.el) sr.el.hidden = true;
}
function srOpen() {
  var el = srEnsure();
  if (!el) return false;
  if (typeof panelOpen === 'function') panelOpen('search');
  sr.open = true;
  el.hidden = false;
  if (sr.input) sr.input.value = sr.q;
  srRender();
  return true;
}
function srClose() {
  if (typeof panelIsOpen === 'function' && typeof panelClose === 'function' && panelIsOpen('search')) panelClose('search');
  else srHide();
}
function srToggle() { if (sr.open) srClose(); else srOpen(); }
function srSetQ(v) {
  if (sr.timer && typeof clearTimeout === 'function') clearTimeout(sr.timer);
  sr.timer = 0;
  sr.q = String(v == null ? '' : v);
  if (sr.input) sr.input.value = sr.q;
  srRender();
}
function srOnInput() {
  if (sr.timer && typeof clearTimeout === 'function') clearTimeout(sr.timer);
  sr.timer = setTimeout(function () { sr.timer = 0; sr.q = sr.input ? sr.input.value : ''; srRender(); }, SR_DEBOUNCE_MS);
}
function srOnClick(e) {
  var t = e.target && e.target.closest ? e.target.closest('[data-sr]') : null, a, k;
  if (!t || t.disabled) return;
  a = t.getAttribute('data-sr'); k = t.getAttribute('data-k') || '';
  if (a === 'close') srClose();
  else if (a === 'pick') { sr.sel = sr.sel === k ? '' : k; srRender(); }
  else if (a === 'chip') srSetQ(k);
  else if (a === 'build') srGoBuild(k);
  else if (a === 'tech') srTechGo(k);
}
function srOnKey(e) {
  var t = e.target;
  if (!t || (e.key !== 'Enter' && e.key !== ' ') || !t.getAttribute || t.getAttribute('data-sr') !== 'pick') return;
  if (e.preventDefault) e.preventDefault();
  srOnClick({ target: t });
}
