// js/cardsui_furnace.js — 卡片面板『熔爐』分頁 F(2026-11-10:取代獨立的熔爐面板 furnaceui.js,後者只剩建築入口並導向本分頁)。
// 版面(由上而下):熔爐圖案(內嵌 SVG)+ 碎片 / 已選可得碎片 + 『熔爐設定』鈕 → 熔鍊確認(若有)→ 全選清單 / 取消勾選 / 『熔鍊』主按鈕 → 可熔路人清單(依品階分組、勾選)。(2026-11-11:碎片兌換指名券已移除)
// 『條件』全部收進『熔爐設定』浮層(cu.fset,點了才開,不在頁面展開):自動熔爐門檻(cardsBagSetAuto)、一鍵熔品階門檻(cu.fx.le)、清單篩選(cu.fx.gr / fac / troop)。說明按鈕由 cardsui.js cuHelpBtn 提供。
// 熔鍊規則沿用 cardsui_roster.js(cuRosterAsk / cuRosterDo)與 cards.js(cardsFurnaceSum / cardsBagPick / cardsBagDissolve / cardsBagSetAuto),本檔不改數值。名人不入、派駐與鎖定者不入(引擎固定規則)。
// 掛在 cardsui.js:cardsUiRender 的 F 分支 → cuFurnaceTabHtml(cs);浮層 cuFurnaceSetPop(cs);cuClick → cuFurnaceClick(a, b, cs)。ES2017;不用 ?. ??。
// 全域名稱:CU_RO_AUTO CU_FX_LE cuFxState cuFurnaceCss cuFurnaceSvg cuFurnaceList cuFurnaceRow cuFurnaceTabHtml cuFurnaceSetPop cuFurnaceClick
var CU_RO_AUTO = [[-1, '關'], [0, '白'], [1, '青以下'], [2, '藍以下']];   // 自動熔爐門檻(卡包外新抽到的路人)
var CU_FX_LE = [[-1, '關']].concat(CU_RO_LE);   // 一鍵熔品階門檻(-1 = 關,熔鍊鈕只熔勾選的卡)

// 熔爐分頁的條件狀態(cu.fx):le 一鍵熔品階(-1 關)、gr / fac / troop 清單篩選(與卡包篩選分開)
function cuFxState() {
  if (!cu.fx) cu.fx = { le: -1, gr: -1, fac: -1, troop: '' };
  return cu.fx;
}
function cuFurnaceCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuFurnaceStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuFurnaceStyle';
  st.textContent = '#cardsPanel .cufhd{display:flex;align-items:center;gap:8px;margin-bottom:4px}#cardsPanel .cufhd .cufinfo{flex:1 1 auto;min-width:0}' +
    '#cardsPanel .cufsvg{width:60px;height:60px;flex:none}#cardsPanel .cufsvg .cuf-st{fill:#6f665c}#cardsPanel .cufsvg .cuf-band{fill:#4a443d}#cardsPanel .cufsvg .cuf-mouth{fill:#2a1a10}#cardsPanel .cufsvg .cuf-fire{fill:#ff8a2a;opacity:.5}' +
    '#cardsPanel .cufsvg.hot .cuf-fire{opacity:1;animation:cufflick .6s ease-in-out infinite alternate}#cardsPanel .cufsvg.hot .cuf-mouth{fill:#ff7a1a}@keyframes cufflick{from{opacity:.55}to{opacity:1}}' +
    '#cardsPanel .cufrow{min-height:44px;padding:2px 0;cursor:pointer}#cardsPanel .cufrow.on{background:rgba(240,180,90,.14)}' +
    '#cardsPanel .cufact{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:6px 0}';
  document.head.appendChild(st);
}
// 熔爐圖案:內嵌 SVG(磚砌爐身、爐口、火焰);hot = 已勾選待熔時火焰加亮
function cuFurnaceSvg(hot) {
  return '<svg class="cufsvg' + (hot ? ' hot' : '') + '" viewBox="0 0 64 64" aria-hidden="true">' +
    '<rect class="cuf-st" x="20" y="2" width="10" height="16" rx="2"/>' +
    '<path class="cuf-st" d="M10 18h44l4 42H6z"/>' +
    '<rect class="cuf-band" x="8" y="18" width="48" height="4"/>' +
    '<rect class="cuf-mouth" x="18" y="34" width="28" height="18" rx="3"/>' +
    '<path class="cuf-fire" d="M23 52C23 45 27 42 27 37C30 40 31 43 31 45C33 43 34 41 34 39C37 43 38 47 38 52Z"/>' +
    '</svg>';
}
// 可熔清單:卡包內路人、未鎖定、未派駐(名人永不入),套用熔爐分頁的篩選
function cuFurnaceList(cs) {
  var fx = cuFxState();
  return cardsRosterList(cs, { gr: fx.gr, fac: fx.fac, troop: fx.troop, kind: 'gen', sort: 'gr' }).filter(function (c) { return cardsRosterMeltable(c); });
}
function cuFurnaceRow(e, sel) {
  return '<div class="cur cufrow' + (sel ? ' on' : '') + '" data-a="fsel" data-id="' + e.id + '" style="border-left:5px solid var(--gr' + e.gr + ');padding-left:6px">' +
    '<span><span class="curck">' + (sel ? '☑' : '☐') + '</span><b>' + cuRoGrLabel(e) + '</b> ' + cuEsc(e.name) + (e.starLv ? ' ★' + e.starLv : '') +
    '<span class="cusub"> ' + cuTroopTag(e) + '</span></span>' +
    '</div>';
}
function cuFurnaceTabHtml(cs) {
  var fx = cuFxState(), sel = cuRosterSelIds(cs), list = cuFurnaceList(cs), sum = cardsFurnaceSum(cs, sel, false), one = fx.le >= 0 ? cardsBagPick(cs, fx.le).length : 0, n = sel.length || one, h = '', g, rows;
  cuRosterCss();
  cuFurnaceCss();
  h += '<div class="cufhd">' + cuFurnaceSvg(sel.length > 0) +
    '<div class="cufinfo"><div>碎片 <b>' + (cs.shards | 0) + '</b></div><div class="cusub">已勾選 ' + sel.length + ' 張,可得 ' + sum.shards + ' 碎</div></div>' +
    '<button class="cub" data-a="fset" style="margin:0">熔爐設定</button></div>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  if (cu.bpend && !cu.bpend.single) h += '<div class="cuwarn">' + cuEsc(cu.bpend.text) + '</div><button class="cub" data-a="rcfno">否</button><button class="cub warn" data-a="rcfyes">是,熔鍊</button>';
  h += '<div class="cufact"><button class="cub" data-a="fall"' + (list.length ? '' : ' disabled') + '>全選清單</button><button class="cub" data-a="fclr"' + (sel.length ? '' : ' disabled') + '>取消勾選</button>' +
    '<button class="cub warn" data-a="fmelt"' + (n ? '' : ' disabled') + '>' + (sel.length ? '熔鍊已勾選(' + sel.length + ' 張)' : (fx.le >= 0 ? '熔鍊 品階 ≤ ' + CARD_GRADE[fx.le].name + '(' + one + ' 張)' : '熔鍊(請先勾選)')) + '</button></div>';
  h += '<div class="cusub">' + (sel.length ? '熔鍊會熔掉已勾選的卡;清空勾選後,熔鍊改熔『熔爐設定』的一鍵熔範圍。' : '未勾選時,熔鍊熔掉『熔爐設定』一鍵熔品階以下的路人;要熔哪張請直接勾選。') + '</div>';
  if (!list.length) h += '<div class="cusub">清單沒有可熔的路人。名人、派駐中與鎖定者不在此列;篩選可在熔爐設定調整。</div>';
  for (g = 0; g <= 4; g++) {
    rows = list.filter(function (c) { return c.gr === g; });
    if (!rows.length) continue;
    h += '<div class="cusec">' + CARD_GRADE[g].name + '(' + rows.length + ' 張)</div>';
    rows.forEach(function (c) { h += cuFurnaceRow(c, !!cu.bsel[c.id]); });
  }
  return h;
}
// 熔爐設定浮層(cu.fset):自動熔爐 / 一鍵熔 / 清單篩選;關閉鈕 fsetx
function cuFurnaceSetPop(cs) {
  var fx = cuFxState();
  return '<div class="cuinfo"><h4>熔爐設定</h4>' +
    '<div class="cusec">自動熔爐(卡包外新抽到的路人,品階 ≤ 此值直接熔成碎片;名人不入)</div>' + cuRoChips(CU_RO_AUTO, cardsBagAutoLv(cs), 'fauto') +
    '<div class="cusec">一鍵熔(未勾選卡時,熔鍊熔掉品階 ≤ 此值的路人)</div>' + cuRoChips(CU_FX_LE, fx.le, 'fle') +
    '<div class="cusec">清單篩選 · 品質</div>' + cuRoChips(CU_RO_GR, fx.gr, 'fgr') +
    '<div class="cusec">清單篩選 · 陣營</div>' + cuRoChips([[-1, '全']].concat(CARD_FAC.map(function (x, i) { return [i, x]; })), fx.fac, 'ffac') +
    '<div class="cusec">清單篩選 · 兵種</div>' + cuRoChips(CU_RO_TROOP, fx.troop, 'ftroop') +
    '<div class="cusub">固定規則:名人不入(需到人物詳情手動熔,二次確認);派駐中與鎖定者不入。</div>' +
    '<button class="cub" data-a="fsetx">關閉</button></div>';
}
// 點擊動作(cuClick 呼叫;不認得的動作回 false)。熔鍊確認 rcfno / rcfyes 由 cardsui_roster.js 處理
function cuFurnaceClick(a, b, cs) {
  var v = b.getAttribute('data-v'), id = b.getAttribute('data-id'), fx = cuFxState(), ids, f;
  if (a === 'fsel') {
    f = cardsRosterFind(cs, id);
    if (!f || f.c.fig || !cardsRosterMeltable(f.c)) { cu.msg = (f && f.c.fig) ? CU_BAG_MSG.fig : CU_BAG_MSG.locked; return true; }
    if (cu.bsel[id]) delete cu.bsel[id]; else cu.bsel[id] = 1;
    cu.bpend = null;
    return true;
  }
  if (a === 'fall') { cuFurnaceList(cs).forEach(function (c) { cu.bsel[c.id] = 1; }); cu.bpend = null; return true; }
  if (a === 'fclr') { cu.bsel = {}; cu.bpend = null; return true; }
  if (a === 'fmelt') {
    ids = cuRosterSelIds(cs);
    if (!ids.length && fx.le >= 0) ids = cardsBagPick(cs, fx.le);
    if (!ids.length) { cu.msg = '沒有可熔鍊的卡'; return true; }
    cuRosterAsk(cs, ids, false);
    return true;
  }
  if (a === 'fauto') { cardsBagSetAuto(cs, +v); cuSave(); return true; }
  if (a === 'fle') { fx.le = Math.max(-1, Math.min(3, +v | 0)); return true; }
  if (a === 'fgr') { fx.gr = +v; return true; }
  if (a === 'ffac') { fx.fac = +v; return true; }
  if (a === 'ftroop') { fx.troop = v || ''; return true; }
  return false;
}
