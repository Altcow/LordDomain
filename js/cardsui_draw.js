// js/cardsui_draw.js — 抽卡分頁 D 三池合併(card_ui_redesign §5 / K3):頂部次數錢包(可抽 n / 上限、下次補充、新手禮包入口、名冊列、頭目贈抽提示),下方三池上下排列,各池以『標題 + 分隔線』切開:一句說明、機率簡表、單抽 / 連抽 / 全部可抽鈕。
// 三池:酒館 T(招賢酒肆,每抽 1 次出 1 張)、縣試 E(九品中正考課)、指名 G(天子親策,消耗指名券;選陣營 / 職業分類預設收合)。最近一次開批結果列在分頁最下方(不分池)。
// 按鈕動作:pull 由 cardsui.js cuClick 直接呼叫 cuDoPull(連抽 / 全部可抽走 cuPullRun,每批播完整特效,按『全部跳過』才 quick);指名 nmode / nkey / ndraw 由 cardsui_named.js cuNamedClick;禮包由 cardsui_starter.js cuStarterClick;收合 dtog 由本檔 cuDrawClick。
// 本檔收納 UI 組字:cuDrawTabHtml / cuDrawPoolHtml / cuDrawNamedHtml / cuDrawBtns / cuDrawGate / cuDrawCss,並搬入原 cardsui_starter.js 的 cuStarterBanner / cuStarterPop / cuPityLine / cuNbLine,與原 cardsui_named.js 的 cuBossHtml。
// 全域名稱:CU_DRAW_POOLS CU_DRAW_TITLE CU_DRAW_DESC cuDrawTabHtml cuDrawPoolHtml cuDrawNamedHtml cuDrawBtns cuDrawGate cuDrawClick cuDrawCss cuStarterBanner cuStarterPop cuPityLine cuNbLine cuBossHtml
// 不發聲、不推播。ES2017;不用 ?. ??。

var CU_DRAW_POOLS = ['T', 'E', 'G'];
var CU_DRAW_TITLE = { T: '酒館 · 招賢酒肆', E: '縣試 · 九品中正考課', G: '指名 · 天子親策' };
var CU_DRAW_DESC = { T: '每抽 1 次出 1 張,白青藍為主。', E: '每抽 1 次出 1 張,白至紫,科目逐期輪替。' };

function cuDrawCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuDrawStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuDrawStyle';
  st.textContent = '#cardsPanel .cuov{margin:6px 0;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.07)}' +
    '#cardsPanel .cuchips{display:flex;flex-wrap:wrap;gap:0}#cardsPanel button.cub.on{background:#f0b45a;color:#222}' +
    '#cardsPanel .cudp{margin:0 0 14px}#cardsPanel .cudph{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}#cardsPanel .cudph b{font-size:16px}' +
    '#cardsPanel .cudpl{height:1px;margin:4px 0 6px;background:rgba(255,255,255,.28)}' +
    '#cardsPanel .cudpb{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}#cardsPanel .cudpb button.cub{margin:0;flex:1 1 auto}';
  document.head.appendChild(st);
}
// 卡池未開放的說明(指名池的科技門檻文字改寫為「指名卡池」)
function cuDrawGate(v) {
  var V = CARD_VENUES[v];
  return v === 'G' ? cuGateTxt('G').replace(V.name, '指名卡池') : cuGateTxt(v);
}
// 酒館 / 縣試 的單抽、連抽、全部可抽鈕。data-v 卡池、data-n 次數(1 / 連抽張數 / all)
function cuDrawBtns(cs, v) {
  var n = cardsPulls(cs), k = CARD_DRAW.maxOne, ok = cardsVenueOpen(v) && cardsBagCanOpen(cs, 1) && !cu.revealing && !cs.cur[v], h;
  h = '<button class="cub" data-a="pull" data-v="' + v + '" data-n="1"' + (ok && n >= 1 ? '' : ' disabled') + '>單抽(1 次)</button>';
  h += '<button class="cub" data-a="pull" data-v="' + v + '" data-n="' + k + '"' + (ok && n >= k && cardsBagCanOpen(cs, k) ? '' : ' disabled') + '>連抽 ' + k + ' 次</button>';
  h += '<button class="cub" data-a="pull" data-v="' + v + '" data-n="all"' + (ok && n >= 1 ? '' : ' disabled') + '>全部可抽(' + n + ' 次)</button>';
  return '<div class="cudpb">' + h + '</div>';
}
// 指名池內容:持有券、保底、招募一次鈕、收合的陣營 / 職業分類選擇(cu.dopen.G 為展開狀態;選擇狀態沿用 cu.nmode / cu.nkey)
function cuDrawNamedHtml(cs) {
  var tk = cs.nameTokens | 0, b = cs.cur.G, full = !cardsBagCanOpen(cs, 1), can, fac = cu.nmode === 'fac', dop = !!(cu.dopen && cu.dopen.G), list, h = '';
  if (!cardsNamedOpen(cs)) return '<button class="cub" data-a="ndraw" disabled>指名 1 次(消耗 1 券)</button>';
  can = !b && tk >= 1 && !full;
  if (fac && cardsFacList().indexOf(cu.nkey) < 0) cu.nkey = cardsFacList()[0];   // 魔幻世界陣營為 5~13(本族在前)
  h += '<div class="cur"><span>持有指名券 <b>🎫 ' + tk + '</b></span><span class="cusub">已指名 ' + (cs.namedCount | 0) + ' 次</span></div>';
  h += cuPityLine(cs, 'G');
  h += '<div class="cudpb"><button class="cub" data-a="ndraw"' + (can ? '' : ' disabled') + '>指名 1 次(消耗 1 券)</button>' +
    '<button class="cub' + (dop ? ' on' : '') + '" data-a="dtog" data-v="G">' + (dop ? '收起選擇 ▴' : '選陣營 / 職業 ▾') + '</button></div>';
  h += '<div class="cusub">指定:' + cuEsc(fac ? '陣營 ' + (CARD_FAC[cu.nkey] || '') : '職業分類 ' + cu.nkey) + '</div>';
  if (dop) {
    list = fac ? cardsFacList().map(function (i) { return [i, CARD_FAC[i]]; }) : CARD_ROWS.map(function (n) { return [n, n]; });
    h += '<div class="cuchips"><button class="cub' + (fac ? ' on' : '') + '" data-a="nmode" data-m="fac">陣營</button><button class="cub' + (fac ? '' : ' on') + '" data-a="nmode" data-m="row">職業分類</button></div>';
    h += '<div class="cuchips">' + list.map(function (e) { return '<button class="cub' + (cu.nkey === e[0] ? ' on' : '') + '" data-a="nkey" data-k="' + e[0] + '">' + cuEsc(e[1]) + '</button>'; }).join('') + '</div>';
    h += '<div class="cusub">' + (fac ? '指定陣營:該陣營的人物,金 / 紫檔可能出現該陣營名人(重複者化為信物)。' : '指定職業分類:主職業取自該分類;不出名人。') + '</div>';
  }
  if (!b && full) h += '<div class="cuwarn">名冊已滿,先遣散或熔鍊幾張(不會扣券)。</div>';
  return h;
}
// 一個池的區塊:標題 + 分隔線 + 說明 + 機率 / 本期 / 保底 + 按鈕
function cuDrawPoolHtml(cs, v) {
  var V = CARD_VENUES[v], G = v === 'G', open = G ? cardsNamedOpen(cs) : cardsVenueOpen(v), th, h;
  h = '<section class="cudp" id="cuPool' + (G ? 'N' : v) + '" data-pool="' + v + '"><div class="cudph"><b>' + cuEsc(CU_DRAW_TITLE[v]) + '</b></div><div class="cudpl"></div>';
  h += '<div class="cusub" style="opacity:1">' + cuEsc(G ? '每次消耗 1 張指名券,一次出 ' + V.batch + ' 張直接入冊,可指定陣營或職業分類。' : CU_DRAW_DESC[v]) + '</div>';
  if (!open) h += '<div class="cusub">' + cuEsc(cuDrawGate(v)) + '</div>';
  else {
    h += '<div class="cusub">機率:' + cuEsc(cuGrPct(V.gr)) + '</div>';
    if (!G) {
      th = cardsVenueTheme(v, cs.pl ? (cs.pl.tot | 0) : 0);
      h += '<div class="cusub">本期 ' + cuEsc(th.text) + '</div>' + cuPityLine(cs, v);
    }
  }
  h += G ? cuDrawNamedHtml(cs) : cuDrawBtns(cs, v);
  return h + '</section>';
}
// 抽卡分頁 D 的整頁內容(cardsui.js cuDrawTabHtml 由 cardsUiRender 呼叫)
function cuDrawTabHtml(cs) {
  var h = '', n = cardsPulls(cs), full = !cardsBagCanOpen(cs, 1);
  cuDrawCss();
  h += cuStarterBanner(cs);
  h += cuPullsHtml(cs);   // 次數錢包:可抽 n / 上限、下次 +X 抽倒數(三池共用)
  h += '<div class="cur"><span>碎片 <b>' + (cs.shards | 0) + '</b></span><span>指名券 <b>🎫 ' + (cs.nameTokens | 0) + '</b></span></div>';
  h += cuNbLine(cs) + cuRosterLine(cs);
  h += cuBossHtml(cs, true);   // 頭目贈抽任務提示(一行)
  if (full) h += '<div class="cuwarn">名冊已滿,三池暫停抽卡(不扣次數)。<button class="cub" data-a="tab" data-t="R" style="margin:0">去名冊熔鍊</button></div>';
  CU_DRAW_POOLS.forEach(function (v) { h += cuDrawPoolHtml(cs, v); });
  if (!n) h += '<div class="cusub">沒有可抽次數了;等下次補充,或通關頭目關卡領贈抽。</div>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  h += '<div class="cusub">抽到的人直接加入名冊;名冊滿了就停下抽卡(不扣次數),遣散或熔鍊騰出空位後才能再抽。</div>';
  return h + cuLastHtml();
}
// 按鈕動作:收合 / 展開指名池的選擇區(其餘動作由 cuNamedClick / cuStarterClick 等處理)
function cuDrawClick(a, b) {
  var v;
  if (a !== 'dtog') return false;
  v = b.getAttribute('data-v') || 'G';
  cu.dopen = cu.dopen || {};
  cu.dopen[v] = !cu.dopen[v];
  return true;
}

// 總覽頂端入口:可領 → 領取鈕;已領、還有批次沒開 → 開下一批鈕
function cuStarterBanner(cs) {
  var st = (typeof cardsStarterState === 'function') ? cardsStarterState(cs) : 'na', S = CARD_STARTER, left;
  if (st === 'ready') return '<div class="cuov" style="border:2px solid var(--gr4)"><div class="cur"><b>🎁 新手禮包</b><span class="cusub">' + S.pulls + ' 抽 · 保底 1 張金卡</span></div>' +
    '<button class="cub" data-a="stclaim">領取 ' + S.pulls + ' 抽</button><button class="cub" data-a="stshow">看內容</button></div>';
  if (st === 'open') {   // 舊存檔留下的禮包批次
    left = cs.starter.left | 0;
    return '<div class="cuov" style="border:2px solid var(--gr4)"><div class="cur"><b>🎁 新手禮包</b><span class="cusub">還有 ' + left + ' 批沒開</span></div>' +
      '<button class="cub" data-a="stopen"' + (cs.cur.G ? ' disabled' : '') + '>開第 ' + (S.batches - left + 1) + ' 批</button></div>';
  }
  return '';
}

// 說明卡(覆蓋在面板上;可領且本次沒按「稍後再說」才出現)
function cuStarterPop(cs) {
  var S = CARD_STARTER, st = (typeof cardsStarterState === 'function') ? cardsStarterState(cs) : 'na';
  if (st !== 'ready' || (cu.stLater && !cu.stShow) || cu.revealing) return '';
  return '<div class="cuinfo"><h4>🎁 新手禮包</h4>' +
    '<div class="cuil"><b>抽卡次數 ' + S.pulls + ' 抽</b> 到〈' + CARD_VENUES.T.name + '〉卡池想怎麼抽都行(單抽 / 連抽 ' + CARD_DRAW.maxOne + '),抽到的人直接加入名冊(名冊滿了要先遣散或熔鍊騰出空位)。</div>' +
    '<div class="cuil"><b>保底</b> 前 ' + S.pulls + ' 抽至少 ' + S.goldGuarantee + ' 張金卡(名人),另外至少 ' + S.purpleGuarantee + ' 張紫卡。</div>' +
    '<div class="cuil"><b>指名券 ' + S.namedTokens + ' 張</b> 到「指名」分頁選陣營,指定抽這個陣營的人(還沒研發指名也能用)。</div>' +
    '<div class="cuil"><b>新手期</b> 領取後的前 ' + S.nbCards + ' 張' + CARD_VENUES.T.name + '、' + CARD_VENUES.E.name + '卡,紫卡和金卡比較容易出:每 ' + S.nbPurple + ' 抽內必有紫卡以上,每 ' + S.nbGold + ' 抽內必有金卡。</div>' +
    '<div class="cuil"><b>之後</b> 次數會隨時間累積(上限 ' + CARD_DRAW.cap + '),每章頭目首次通關再送 ' + CARD_BOSS.pulls + ' 抽。</div>' +
    '<div class="cusub">只能領一次。</div>' +
    '<button class="cub" data-a="stclaim">領取</button><button class="cub" data-a="stlater">稍後再說</button></div>';
}

// 連續保底提示:pity 為連續沒出上等的張數(指名池 = 次數);最多再 N 張必出
function cuPityLine(cs, v) {
  var V = CARD_VENUES[v], P = cuPityN(v), up = v === 'G' ? 3 : V.upper.gr, n = P + 1 - Math.min(cs.pity[v] | 0, P), u = v === 'G' ? '次' : '抽';
  return '<div class="cusub">' + (n <= 1 ? '下一' + u + '必出' : '距離保底還有 ' + n + ' ' + u + '(最晚第 ' + n + ' ' + u + '必出') + cuGrName(up) + '卡以上' + (n <= 1 ? '' : ')') +
    ' <button class="cub" data-a="info" data-k="pity" data-key="" style="min-height:32px;margin:0;padding:0 8px">保底說明</button></div>';
}

// 新手期提示(領禮包後前 nbCards 張酒館 / 縣試池的卡)
function cuNbLine(cs) {
  var S = CARD_STARTER, left = (typeof cardsNbLeft === 'function') ? cardsNbLeft(cs) : 0, nb = cs.starter && cs.starter.nb;
  if (!left || !nb) return '';
  return '<div class="cuov"><div class="cur"><b>新手期</b><span class="cusub">還剩 ' + left + ' 張</span></div><div class="cusub">' + CARD_VENUES.T.name + '、' + CARD_VENUES.E.name + '比較容易出紫卡和金卡:最多再 ' + Math.max(1, S.nbPurple - (nb.p | 0)) + ' 抽必出紫卡以上,最多再 ' + Math.max(1, S.nbGold - (nb.g | 0)) + ' 抽必出金卡。</div></div>';
}

function cuBossHtml(cs, compact) {
  var l = cuBossList(), P = CARD_BOSS.pulls, nx = cuBossNext(cs), h;
  if (!l.length) return '';
  if (compact) return nx ? '<div class="cusub">任務:首次通關第 ' + nx.ch + ' 章頭目〈' + cuEsc(nx.name) + '〉→ +' + P + ' 抽</div>' : '<div class="cusub">各章頭目首通贈抽已全數領取</div>';
  h = '<div class="cuov"><div class="cur"><b>任務 · 頭目贈抽</b><span class="cusub">每章頭目首次通關 +' + P + ' 抽</span></div>';
  l.forEach(function (st) {
    var got = !!(cs.boss && cs.boss[st.id]);
    h += '<div class="cur"><span>' + (got ? '✅ ' : '⬜ ') + '第 ' + st.ch + ' 章頭目〈' + cuEsc(st.name) + '〉</span><span class="cusub">' + (got ? '已領 +' + P + ' 抽' : '+' + P + ' 抽') + '</span></div>';
  });
  return h + '</div>';
}
