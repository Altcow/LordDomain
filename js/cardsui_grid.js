// js/cardsui_grid.js — 卡包頁『卡片網格』(2026-11-12):名冊改成小卡網格(取代文字清單);極細篩選列(🔍 / 兵種▾ / 品階▾ / 排序▾ / 選)、點開為疊在上層的小清單(不推開版面)、選後縮成標籤、計數 N/300 同列。
// 效能實測(無頭 Chrome 157、375×812、121→105 堆、CDP;2026-11-12):
//   網格→詳情(開卡)100 次:平均 3.7 ms、p95 約 6 ms、最大 < 15 ms,皆 < 30 ms;詳情→網格(關閉)100 次:平均 0.1 ms;詳情『下一位 / 上一位』100 次:平均 2.0 ms。
//   long task(> 50 ms)0 次;DOM 節點 1499 → 1499(200 次切換不增加);JS heap 約 +0.4 MB(< 2 MB)。
//   目前實作:網格 DOM 常駐(開詳情不重建網格,僅 partial 同步);詳情面板 body 每次 innerHTML 重寫(未做『只換欄位』);相鄰頭像預載 3 張;單一委派 click(#cardsPanel 一個)+ 面板 bd 一個 click。
//   版面:橫向且寬 ≥ CUG_SPLIT_MIN(560)= 詳情並排於右半(P1 第 3 層);其餘(直立或窄橫向)= 詳情滿版(body.cu-detail-full)。切換由 cuGridSyncMode 於開 / 關詳情與 resize / orientationchange 更新。
// 堆疊(2026-11-12 追加):同一種卡疊成一疊(疊牌偏移 3px、右上角 ×N 徽章,≥2 張才顯示;陣中成員顯示『陣』小點)。堆疊鍵:名人 = 同名人 id;路人 = 同兵種 + 同品階 + 同星階。頂層 = 星階最高者(名人)/ 序號最小者(路人)。
//   篩選 / 搜尋對堆疊內任一張命中即顯示該堆疊;排序以頂層為準;N/300 仍計實際張數。點堆疊 → 人物卡詳情(頂層),詳情上方『本疊 N 張』可切換成員;拆傳承 / 熔爐預設對象為 cardsLegacyPick(副卡優先)。
// 多選(『選』鈕或長按):點堆疊 = 整疊可熔成員切換(名人不入熔鍊)。
// 掛點:cardsui_roster.js 的 cuRosterPageHtml(畫頁)/ cuRosterInput(搜尋框)/ cuRosterClick(動作,先呼叫 cuGridClick)。
// 本檔覆寫全域 cardsUiRender:CUG.partial 為真時只重畫網格與篩選列(不重建整頁圖片),否則走原 cardsUiRender 後再同步詳情面板。
// 欄數由 CSS auto-fill 依寬度決定(css/cardsui_grid.css,最小卡寬 84px);cuGridCols 為同一規則的純函式(測試用)。
// 全域名稱:CUG CUG_MIN CUG_GAP CUG_TROOP_ORD CUG_SHEET cuGridCols cuGridHash cuGridKey cuGridGroups cuGridItemOf cuGridCmp cuGridList cuGridCardHtml cuGridBarInner cuGridGridHtml cuGridRepaint cuGridPaintBar cuGridPaintGrid cuGridSheetOpen cuGridSyncSheet cuGridClick cuGridBind
// 純函式(欄數、堆疊、排序、篩選)不碰 DOM,供 tools/test_cardsui_grid.js 測試。ES2017;不用 ?. ??。

var CUG = { partial: false, lpT: 0, lpId: null, lpFired: false, lpSwallow: false, sx: 0, sy: 0, keep: null };
var CUG_MIN = 84;                                   // 卡最小寬(px);欄數 = floor((寬 + 間距) / (最小寬 + 間距)),夾在 3~10 欄
var CUG_GAP = 6;
var CUG_SHEET = 'cardsDetail';                      // 人物卡詳情底部面板 id(pf_cardsDetail)
var CUG_TROOP_ORD = ['槍', '騎', '盾', '弓', '謀'];
var CUG_TROOP_KEY = { '槍': 'spear', '騎': 'cav', '盾': 'shield', '弓': 'bow', '謀': 'strat' };   // 路人 Q 版:assets/ui/pp_<key>_1..6.webp
var CUG_GR_OPT = [[-1, '全部'], [4, '金'], [3, '紫'], [2, '藍以下']];   // 2 = 藍以下(品階 ≤ 2)
var CUG_SORT_OPT = [['def', '預設'], ['gr', '品階'], ['star', '星階'], ['troop', '兵種'], ['new', '最新']];
var CUG_ONLY_OPT = [['fig', '只看名人'], ['spare', '只看副卡']];
var CUG_SPLIT_MIN = 560;                             // 橫向且寬 ≥ 560px:網格與詳情並排(詳情佔右半);其餘(直立或窄橫向)詳情滿版切換
var CUG_PRE_MAX = 3;                                 // 相鄰頭像預載快取上限(張)
var CUG_PRE = [];

function cuGridCols(w) {
  var n = Math.floor((w + CUG_GAP) / (CUG_MIN + CUG_GAP));
  return Math.max(3, Math.min(10, n));
}
// 版面模式:true = 並排(橫向且寬夠);false = 詳情滿版切換
function cuGridIsSplit() {
  if (typeof window === 'undefined' || !window) return true;
  return (window.innerWidth || 0) > (window.innerHeight || 0) && (window.innerWidth || 0) >= CUG_SPLIT_MIN;
}
// 依版面模式切換 body 旗標(cu-detail-full:詳情滿版蓋住網格;網格 DOM 保留不銷毀)
function cuGridSyncMode() {
  var open = cuGridSheetIsOpen(), full = open && !cuGridIsSplit();
  if (typeof document === 'undefined' || !document.body || !document.body.classList) return;
  if (full) document.body.classList.add('cu-detail-full'); else document.body.classList.remove('cu-detail-full');
}
// 相鄰頭像預載(最多 CUG_PRE_MAX 張;Image 物件由陣列持有,超過即丟棄最舊者)
function cuGridPreload(url) {
  var im;
  if (!url || typeof Image === 'undefined') return;
  im = new Image();
  im.src = url;
  CUG_PRE.push(im);
  while (CUG_PRE.length > CUG_PRE_MAX) CUG_PRE.shift();
}
function cuGridPortraitUrl(e) {
  if (e.fig) return (typeof fxFigImg === 'function' && fxFigImg(e.fig)) || 'assets/portraits/' + e.fig + '.webp';
  return null;
}
function cuGridHash(s) {
  var h = 7, i;
  s = String(s);
  for (i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}
function cuGridTroopIdx(e) {
  var i = CUG_TROOP_ORD.indexOf(cardsRosterTroop(e));
  return i < 0 ? 9 : i;
}
// 堆疊鍵:名人 = 名人 id;路人 = 兵種 | 品階 | 星階
function cuGridKey(e) {
  return e.fig ? 'f:' + e.fig : 'g:' + cardsRosterTroop(e) + '|' + e.gr + '|' + cardsStarLv(e);
}
// 堆疊群組:{key, top, members, n}。成員依星階高、序號小排序,第一張為頂層
function cuGridGroups(cs) {
  var map = {}, order = [], out = [];
  cs.roster.forEach(function (e) {
    var k = cuGridKey(e);
    if (!map[k]) { map[k] = []; order.push(k); }
    map[k].push(e);
  });
  order.forEach(function (k) {
    var mem = map[k].slice().sort(function (a, b) { return (cardsStarLv(b) - cardsStarLv(a)) || (a.no - b.no); });
    out.push({ key: k, top: mem[0], members: mem, n: mem.length });
  });
  return out;
}
// 找出某張卡所在的堆疊(多選 / 詳情用);找不到回 null
function cuGridItemOf(cs, id) {
  var f = cardsRosterFind(cs, id), k, groups, i;
  if (!f) return null;
  k = cuGridKey(f.c);
  groups = cuGridGroups(cs);
  for (i = 0; i < groups.length; i++) if (groups[i].key === k) return groups[i];
  return null;
}
// 排序:def 名人優先 > 品階高 > 星階高 > 兵種;gr 品階;star 星階;troop 兵種;new 最新(序號大者在前)
function cuGridCmp(mode) {
  return function (a, b) {
    if (mode === 'new') return b.no - a.no;
    if (mode === 'troop') return (cuGridTroopIdx(a) - cuGridTroopIdx(b)) || (b.gr - a.gr) || (a.no - b.no);
    if (mode === 'star') return (cardsStarLv(b) - cardsStarLv(a)) || (b.gr - a.gr) || (a.no - b.no);
    if (mode === 'gr') return (b.gr - a.gr) || ((b.fig ? 1 : 0) - (a.fig ? 1 : 0)) || (a.no - b.no);
    return ((b.fig ? 1 : 0) - (a.fig ? 1 : 0)) || (b.gr - a.gr) || (cardsStarLv(b) - cardsStarLv(a)) || (cuGridTroopIdx(a) - cuGridTroopIdx(b)) || (a.no - b.no);
  };
}
// 單張是否命中篩選(q 搜尋字、troop、gr、only;spare = 非頂層)
function cuGridMatch(e, R, q, isSpare) {
  if (q && cardsRosterHay(e).indexOf(q) < 0) return false;
  if (R.troop && cardsRosterTroop(e) !== R.troop) return false;
  if (R.gr === 2) { if (e.gr > 2) return false; }
  else if (R.gr >= 0 && e.gr !== R.gr) return false;
  if (R.only === 'fig' && !e.fig) return false;
  if (R.only === 'spare' && !isSpare) return false;
  return true;
}
// 堆疊清單:堆內任一張命中即列出;依頂層排序。R = cuRoState()
function cuGridList(cs, R) {
  var q = R.q ? cardsRosterQ(R.q) : '', cmp = cuGridCmp(R.sort || 'def'), out = [];
  cuGridGroups(cs).forEach(function (g) {
    var hit = g.members.some(function (e) { return cuGridMatch(e, R, q, e !== g.top); });
    if (hit) out.push(g);
  });
  out.sort(function (a, b) { return cmp(a.top, b.top); });
  return out;
}
// 同名疊卡「傳」字章:名人、同名 ≥ 2 張、傳承戰法未擁有、且堆內有一張現在能拆(未鎖、未派駐、品階夠)
function cuGridInhOk(g) {
  var e = g.top, list, i, m;
  try {
    if (!e.fig || g.n < 2 || typeof bnSkcInheritList !== 'function') return false;
    list = bnSkcInheritList(e);
    if (!list.length || !list.some(function (x) { return !x.owned; })) return false;
    for (i = 0; i < g.members.length; i++) { m = g.members[i]; if (!m.star && !m.at && (m.gr | 0) >= BN_SKC.minGr) return true; }
  } catch (er) { /* 略過 */ }
  return false;
}
// 單一堆疊:疊牌偏移(n ≥ 2 才畫後層)+ 右上 ×N 徽章 + 陣中小點;點擊 data-a=gopen 掛在外層
function cuGridCardHtml(g, selMap) {
  var e = g.top, troop = cardsRosterTroop(e), lv = cardsStarLv(e), dots = '', i, art = '', tri = '', n = g.n, atAny = false, picked = false, pp, back = '';
  g.members.forEach(function (m) { if (m.at) atAny = true; if (selMap && selMap[m.id]) picked = true; });
  for (i = 0; i < 5; i++) dots += '<i class="' + (i < lv ? 'lit' : 'dim') + '">★</i>';   // 5 顆星:亮 = 星階,暗 = 未達
  if (e.fig) art = cuPortraitImg(e, true);
  else if (CUG_TROOP_KEY[troop]) {
    pp = 'assets/ui/pp_' + CUG_TROOP_KEY[troop] + '_' + (cuGridHash(e.id) % 6 + 1) + '.webp';
    art = '<img alt="" src="' + pp + '" loading="lazy" decoding="async" onerror="this.remove()">';
  }
  if (typeof bnTroopIconHtml === 'function' && troop) tri = bnTroopIconHtml(troop);
  if (n >= 2) back = '<span class="cugc-back b1"></span>' + (n >= 3 ? '<span class="cugc-back b2"></span>' : '');
  return '<div class="cugw g' + (CARD_GRADE[e.gr] ? e.gr : 0) + (n >= 2 ? '' : ' cugw1') + '" data-a="gopen" data-id="' + cuEsc(e.id) + '" aria-label="' + cuEsc(e.name) + (n >= 2 ? ' 共' + n + '張' : '') + '">' + back +
    '<div class="cugc g' + (CARD_GRADE[e.gr] ? e.gr : 0) + (e.star ? ' lock' : '') + (picked ? ' sel' : '') + '">' +
    '<div class="cugc-art">' + CU_SIL + art + '</div>' +
    (tri ? '<span class="cugc-tl">' + tri + '</span>' : '') +
    (e.star ? '<span class="cugc-lk">🔒</span>' : '') +
    (picked ? '<span class="cugc-ck">✓</span>' : '') +
    '<div class="cugc-st">' + dots + '</div><div class="cugc-nm">' + cuEsc(e.name) + '</div>' + (n >= 2 && typeof cuGridInhOk === 'function' && cuGridInhOk(g) ? '<span class="cugc-inh" title="可傳承">傳</span>' : '') + '</div>' +
    (n >= 2 ? '<span class="cugc-badge">×' + n + '</span>' : '') +
    (atAny ? '<i class="cugc-ing" title="上陣中"></i>' : '') + '</div>';
}
function cuGridGrLabel(v) {
  var i;
  for (i = 0; i < CUG_GR_OPT.length; i++) if (CUG_GR_OPT[i][0] === v) return CUG_GR_OPT[i][1];
  return '';
}
function cuGridSortLabel(v) {
  var i;
  for (i = 0; i < CUG_SORT_OPT.length; i++) if (CUG_SORT_OPT[i][0] === v) return CUG_SORT_OPT[i][1];
  return '';
}
// 目前生效的篩選標籤(點標籤或 ✕ 清除)
function cuGridChipsHtml(R) {
  var c = [], h = '';
  if (R.q && !R.srch) c.push(['q', '搜:' + R.q]);
  if (R.troop) c.push(['troop', R.troop]);
  if (R.gr !== -1) c.push(['gr', cuGridGrLabel(R.gr)]);
  if (R.only) c.push(['only', R.only === 'fig' ? '只看名人' : '只看副卡']);
  if (R.sort && R.sort !== 'def') c.push(['sort', '排序:' + cuGridSortLabel(R.sort)]);
  c.forEach(function (x) { h += '<button class="cugchip" data-a="gchip" data-k="' + x[0] + '">' + cuEsc(x[1]) + ' ✕</button>'; });
  return h;
}
// 下拉小清單(疊在網格上層,選後關閉);mask 點空白處關閉
function cuGridPopHtml(R) {
  var k = R.open, items = '';
  function btn(key, val, label, on) { return '<button class="' + (on ? 'on' : '') + '" data-a="gpick" data-k="' + key + '" data-v="' + cuEsc(val) + '">' + cuEsc(label) + '</button>'; }
  if (k === 'troop') CU_RO_TROOP.forEach(function (x) { items += btn('troop', x[0], x[1], R.troop === x[0]); });
  else if (k === 'gr') {
    CUG_GR_OPT.forEach(function (x) { items += btn('gr', x[0], x[1], R.gr === x[0]); });
    items += '<hr class="cugsep">';
    CUG_ONLY_OPT.forEach(function (x) { items += btn('only', x[0], x[1], R.only === x[0]); });
  } else if (k === 'sort') CUG_SORT_OPT.forEach(function (x) { items += btn('sort', x[0], x[1], R.sort === x[0]); });
  else return '';
  return '<div class="cugmask" data-a="gclose"></div><div class="cugpop cugpop-' + k + '">' + items + '</div>';
}
// 篩選列內容(#cugbarw 的內容):極細一列 + 下拉 / 搜尋框 / 選取模式列
function cuGridBarInner(cs, R) {
  var n = cs.roster.length, cap = cardsCap(), h = '', sel, on = function (k) { return R.open === k ? 'on' : ''; }, shown = null;
  if (R.sel) {
    sel = cuRosterSelIds(cs);
    h = '<div class="cugbar"><button data-a="gsel">退出</button><span class="cugcnt cugsel">已選 ' + sel.length + '</span>' +
      '<button class="warn" data-a="gmelt"' + (sel.length ? '' : ' disabled') + '>熔鍊</button></div>';
  } else if (R.srch) {
    h = '<div class="cugbar"><button class="on" data-a="gsrch" aria-label="關閉搜尋">🔍</button>' + cuGridSearchInput(R, true) +
      '<span class="cugcnt">' + n + '/' + cap + '</span></div>';
  } else {
    shown = cuGridList(cs, R).length;
    h = '<div class="cugbar"><button data-a="gsrch" aria-label="搜尋">🔍</button>' + cuGridSearchInput(R, false) +
      '<button class="' + on('troop') + '" data-a="gdrop" data-v="troop">兵種▾</button>' +
      '<button class="' + on('gr') + '" data-a="gdrop" data-v="gr">品階▾</button>' +
      '<button class="' + on('sort') + '" data-a="gdrop" data-v="sort">排序▾</button>' +
      '<button data-a="gsel" aria-label="多選">選</button>' +
      '<div class="cugchips">' + cuGridChipsHtml(R) + '</div>' +
      '<span class="cugcnt">' + (shown !== cuGridGroups(cs).length ? '符合 ' + shown + ' 堆 · ' : '') + n + '/' + cap + '</span></div>';
  }
  if (R.open && !R.srch && !R.sel) h += cuGridPopHtml(R);
  return h;
}
// 搜尋框:預設隱藏(id curq 保留給 cuRosterInput);展開時可見
function cuGridSearchInput(R, show) {
  return '<input id="curq" class="cugq" type="search" placeholder="名字 / 職業 / 陣營 / 兵種" value="' + cuEsc(R.q) + '"' + (show ? '' : ' style="display:none"') + '>';
}
// 網格區:熔鍊確認(多選時)+ 堆疊小卡;空卡包 / 無符合條件各有一行提示
function cuGridGridHtml(cs, R) {
  var list, h = '', i, sel = cu.bsel || {};
  if (cu.bpend && !cu.bpend.single) h += '<div class="cuwarn">' + cuEsc(cu.bpend.text) + '</div><button class="cub" data-a="rcfno">否</button><button class="cub warn" data-a="rcfyes">是,熔鍊</button>';
  if (!cs.roster.length) return h + '<div class="cugempty">抽卡後卡片會出現在這裡。<br><button class="cub" data-a="tab" data-t="D">去抽卡</button></div>';
  list = cuGridList(cs, R);
  if (!list.length) return h + '<div class="cugempty">沒有符合條件的卡。<br><button class="cub" data-a="gclr">清除篩選</button></div>';
  h += '<div class="cugrid" id="cugrid">';
  for (i = 0; i < list.length; i++) h += cuGridCardHtml(list[i], sel);
  return h + '</div>';
}
// 重畫(保留 .cubd 捲動位置)
function cuGridPaintBar() {
  var el = (cu.el && cu.el.querySelector) ? cu.el.querySelector('#cugbarw') : null, cs = cardsGet();
  if (!el || !cs) return;
  el.innerHTML = cuGridBarInner(cs, cuRoState());
}
function cuGridPaintGrid() {
  var el = (cu.el && cu.el.querySelector) ? cu.el.querySelector('#cugridw') : null, cs = cardsGet();
  if (!el || !cs) return;
  cuKeepScroll(function () { el.innerHTML = cuGridGridHtml(cs, cuRoState()); });
}
function cuGridRepaint() { cuGridPaintBar(); cuGridPaintGrid(); }
// 詳情面板內容:本疊切換列(堆疊 ≥ 2 張)+ 人物卡(cuDetailHtml);拆傳承 / 熔爐預設對象標註為 cardsLegacyPick
function cuGridSheetHtml(cs, id) {
  var f = cardsFind(cs, id), g, list = '', legacy = null;
  if (!f) return '';
  g = cuGridItemOf(cs, id);
  if (g && g.n >= 2) {
    if (typeof cardsLegacyPick === 'function' && g.members[0].fig) { legacy = cardsLegacyPick(cs, g.members[0].fig); legacy = legacy && legacy.id ? legacy.id : null; }
    list = '<div class="cusec">本疊 ' + g.n + ' 張</div>' + g.members.map(function (m) {
      return '<button class="cub' + (m.id === id ? ' on' : '') + '" data-a="gmem" data-id="' + cuEsc(m.id) + '">' + (m === g.top ? '主' : '副') + ' ★' + cardsStarLv(m) +
        (m.at ? ' · 上陣' : '') + (m.star ? ' · 🔒' : '') + (m.id === legacy ? ' · 拆傳承/熔爐預設' : '') + '</button>';
    }).join('');
  }
  return '<div class="cubd">' + cuGridNavHtml(cs, id) + list + cuDetailHtml(cs, f) + '</div>';
}
// 上一位 / 下一位(依目前篩選與排序的堆疊順序);同時預載相鄰兩位的頭像
function cuGridNavHtml(cs, id) {
  var lst = cuGridList(cs, cuRoState()), idx = -1, i, prev, next;
  for (i = 0; i < lst.length; i++) if (lst[i].members.some(function (m) { return m.id === id; })) { idx = i; break; }
  if (idx < 0) return '';
  prev = lst[idx - 1] ? lst[idx - 1].top : null;
  next = lst[idx + 1] ? lst[idx + 1].top : null;
  if (prev) cuGridPreload(cuGridPortraitUrl(prev));
  if (next) cuGridPreload(cuGridPortraitUrl(next));
  return '<div class="cugnav"><button data-a="gnav" data-v="-1"' + (prev ? '' : ' disabled') + '>‹ 上一位</button>' +
    '<span class="cusub">' + (idx + 1) + ' / ' + lst.length + '</span>' +
    '<button data-a="gnav" data-v="1"' + (next ? '' : ' disabled') + '>下一位 ›</button></div>';
}
function cuGridSheetOpen(cs, id, anchor) {
  if (typeof pfOpen !== 'function') return false;
  return pfOpen({
    id: CUG_SHEET, layer: 3, title: '人物卡', scrollSel: '.cubd', anchor: anchor || null,
    onClose: function () {
      var sc;
      cu.detail = null; cu.confirm = null;
      cuGridSyncMode();   // 先解除滿版模式(body.cu-detail-full 會隱藏網格),再還原捲動;否則 display:none 時設 scrollTop 會被夾到 0
      sc = (cu.el && cu.el.querySelector) ? cu.el.querySelector('.cubd') : null;
      if (sc && CUG.keep !== null) { void sc.offsetHeight; sc.scrollTop = CUG.keep; }   // 關閉詳情:回到開啟前的網格捲動位置(錨定捲動不留痕)
      CUG.keep = null;
    },
    build: function (bd) {
      bd.innerHTML = cuGridSheetHtml(cs, id);
      if (!bd.__cug && bd.addEventListener) { bd.__cug = 1; bd.addEventListener('click', function (ev) { cuClick(ev); }); }   // 詳情內的按鈕走原 cuClick
    }
  });
}
function cuGridSheetIsOpen() { return typeof panelIsOpen === 'function' && panelIsOpen(CUG_SHEET); }
// 依 cu.detail 同步詳情面板:開 / 關 / 內容重畫(保留捲動)
function cuGridSyncSheet() {
  var cs = cardsGet(), open = cuGridSheetIsOpen(), bd, sc, y = 0;
  if (!cu.open || cu.tab !== 'R' || !cs || !cu.detail || !cardsFind(cs, cu.detail)) {
    if (open && typeof panelClose === 'function') panelClose(CUG_SHEET);
    cuGridSyncMode();
    return;
  }
  if (!open) { cuGridSheetOpen(cs, cu.detail, null); cuGridSyncMode(); return; }
  bd = pfBody(CUG_SHEET);
  if (!bd) return;
  sc = bd.querySelector ? bd.querySelector('.cubd') : null;
  y = sc ? sc.scrollTop : 0;
  bd.innerHTML = cuGridSheetHtml(cs, cu.detail);
  sc = bd.querySelector ? bd.querySelector('.cubd') : null;
  if (sc) sc.scrollTop = y;
  cuGridSyncMode();
}
// 點擊(cuRosterClick 先呼叫);不認得的動作回 false。網格 / 篩選列 / 詳情切換的動作設 CUG.partial,由覆寫的 cardsUiRender 略過整頁重畫
function cuGridClick(a, b, cs) {
  var R = cuRoState(), v = b.getAttribute('data-v'), k = b.getAttribute('data-k'), id = b.getAttribute('data-id'), ok, inp;
  if (['gsrch', 'gopen', 'gdrop', 'gclose', 'gpick', 'gchip', 'gclr', 'gsel', 'gmelt', 'gmem', 'gnav'].indexOf(a) < 0) return false;
  CUG.partial = true;
  if (a === 'gmem') { cu.detail = id; cu.confirm = null; return true; }
  if (a === 'gnav') {
    var lst = cuGridList(cs, R), at = -1, di = +v || 0, j;
    for (j = 0; j < lst.length; j++) if (lst[j].members.some(function (m) { return m.id === cu.detail; })) { at = j; break; }
    if (at >= 0 && lst[at + di]) { cu.detail = lst[at + di].top.id; cu.confirm = null; }
    return true;
  }
  if (a === 'gopen') {
    if (CUG.lpSwallow) { CUG.lpSwallow = false; return true; }   // 長按剛進入多選後的那次 click
    if (R.sel) { cuGridToggleStack(id); cuGridRepaint(); return true; }
    if (typeof featureOn === 'function' && featureOn('ldui') && typeof ldNavPush === 'function') {   // @DORMANT ldui:新骨架開武將詳情頁(js/ld_hero.js),不經底部面板;list = 目前網格順序(各堆頂層 id)
      if (typeof tutSeen === 'function') tutSeen('detail');
      if (ldNavPush('hero', { id: id, list: cuGridList(cs, R).map(function (g) { return g.top.id; }) })) return true;
    }
    cu.detail = id; cu.confirm = null;
    CUG.keep = (cu.el && cu.el.querySelector && cu.el.querySelector('.cubd')) ? cu.el.querySelector('.cubd').scrollTop : null;
    if (typeof tutSeen === 'function') tutSeen('detail');
    ok = cuGridSheetOpen(cs, id, b);
    if (!ok) cu.detail = null;
    return true;
  }
  if (a === 'gsrch') {
    R.srch = !R.srch; R.open = null;
    cuGridPaintBar();
    if (R.srch && cu.el && cu.el.querySelector) { inp = cu.el.querySelector('#curq'); if (inp && inp.focus) inp.focus(); }
    cuGridPaintGrid();
    return true;
  }
  if (a === 'gdrop') { R.open = R.open === v ? null : v; cuGridPaintBar(); return true; }
  if (a === 'gclose') { R.open = null; cuGridPaintBar(); return true; }
  if (a === 'gpick') {
    if (k === 'troop') R.troop = v || '';
    else if (k === 'gr') R.gr = +v;
    else if (k === 'only') R.only = R.only === v ? '' : v;
    else if (k === 'sort') R.sort = v || 'def';
    R.open = null;
    cuGridRepaint();
    return true;
  }
  if (a === 'gchip') {
    if (k === 'q') R.q = '';
    else if (k === 'troop') R.troop = '';
    else if (k === 'gr') R.gr = -1;
    else if (k === 'only') R.only = '';
    else if (k === 'sort') R.sort = 'def';
    cuGridRepaint();
    return true;
  }
  if (a === 'gclr') { R.q = ''; R.troop = ''; R.gr = -1; R.only = ''; R.sort = 'def'; R.open = null; R.srch = false; cuGridRepaint(); return true; }
  if (a === 'gsel') {
    R.sel = !R.sel; R.open = null; R.srch = false;
    if (!R.sel) { cu.bsel = {}; cu.bpend = null; }
    cuGridRepaint();
    return true;
  }
  if (a === 'gmelt') {
    if (!cuRosterSelIds(cs).length) cu.msg = '沒有可熔鍊的卡';
    else cuRosterAsk(cs, cuRosterSelIds(cs), false);
    cuGridRepaint();
    return true;
  }
  return true;
}
// 多選:整疊切換(堆內可熔成員全選 / 全取消;名人不入熔鍊)
function cuGridToggleStack(id, csArg) {
  var cs = csArg || cardsGet(), g = cuGridItemOf(cs, id), sel;
  if (!g) return;
  sel = g.members.filter(function (e) { return !e.fig && cardsRosterMeltable(e); });
  if (!sel.length) { cu.msg = g.top.fig ? CU_BAG_MSG.fig : CU_BAG_MSG.locked; return; }
  // 選張數:每點一次多選一張(0 → 1 → … → 全選 → 0);先選星階低者(副卡 / 低星),頂層最後
  sel.sort(function (a, b) { return (cardsStarLv(a) - cardsStarLv(b)) || (b.no - a.no); });
  var cur = sel.filter(function (e) { return !!cu.bsel[e.id]; }).length, nxt = (cur + 1) % (sel.length + 1);
  sel.forEach(function (e, i) { if (i < nxt) cu.bsel[e.id] = 1; else delete cu.bsel[e.id]; });
  cu.bpend = null;
}
// 搜尋框失焦 → 縮回 🔍(延後,讓同一次點擊先送出)
function cuGridBlur() {
  setTimeout(function () {
    var R = cuRoState(), a = (typeof document !== 'undefined') ? document.activeElement : null;
    if (!R.srch || (a && a.id === 'curq')) return;
    R.srch = false;
    cuGridPaintBar();
  }, 180);
}
// 長按(約 450ms,位移 > 10px 取消)→ 進入多選並選取該疊
function cuGridPointerDown(ev) {
  var t = ev.target, card = null, R = cuRoState();
  while (t && t !== cu.el) { if (t.getAttribute && t.getAttribute('data-a') === 'gopen') { card = t; break; } t = t.parentNode; }
  if (!card || R.sel || typeof setTimeout !== 'function') return;
  CUG.lpId = card.getAttribute('data-id');
  CUG.sx = ev.clientX || 0; CUG.sy = ev.clientY || 0;
  CUG.lpT = setTimeout(function () {
    CUG.lpT = 0;
    if (!cu.open) return;
    R.sel = true; R.open = null; R.srch = false;
    cuGridToggleStack(CUG.lpId);
    CUG.lpFired = true;
    cuGridRepaint();
  }, 450);
}
function cuGridPointerMove(ev) {
  if (CUG.lpT && (Math.abs((ev.clientX || 0) - CUG.sx) > 10 || Math.abs((ev.clientY || 0) - CUG.sy) > 10)) { clearTimeout(CUG.lpT); CUG.lpT = 0; }
}
function cuGridPointerUp() {
  if (CUG.lpT) { clearTimeout(CUG.lpT); CUG.lpT = 0; }
  if (CUG.lpFired) {
    CUG.lpFired = false;
    CUG.lpSwallow = true;
    setTimeout(function () { CUG.lpSwallow = false; }, 400);
  }
}
// 綁一次到面板根元素:搜尋框的失焦 / Enter、長按
function cuGridBind() {
  var el = cu.el;
  if (!el || !el.addEventListener || el.__cug) return;
  el.__cug = 1;
  el.addEventListener('focusout', function (ev) { if (ev.target && ev.target.id === 'curq') cuGridBlur(); });
  el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target && ev.target.id === 'curq' && ev.target.blur) ev.target.blur(); });
  el.addEventListener('pointerdown', cuGridPointerDown);
  el.addEventListener('pointermove', cuGridPointerMove);
  el.addEventListener('pointerup', cuGridPointerUp);
  el.addEventListener('pointercancel', cuGridPointerUp);
  if (!CUG.rs && typeof window !== 'undefined' && window.addEventListener) {
    CUG.rs = 1;
    window.addEventListener('resize', cuGridSyncMode);
    window.addEventListener('orientationchange', cuGridSyncMode);
  }
}
// 覆寫全域 cardsUiRender(cardsui.js 定義):CUG.partial 時只同步詳情面板;否則照常整頁重畫後同步詳情面板
var cuGridBaseRender = cardsUiRender;
cardsUiRender = function () {
  if (CUG.partial) {
    CUG.partial = false;
    if (cu.el && cu.el.querySelector && cu.el.querySelector('#cugridw')) { cuGridSyncSheet(); return; }
  }
  cuGridBaseRender();
  cuGridSyncSheet();
};
