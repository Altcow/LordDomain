// js/cardsui_draw.js — 抽卡分頁 D 總覽(2026-11-10 改版):頂部只放『持有抽數 n / 200』、『卡池說明』鈕、卡池單選(酒館 T / 縣試 E / 指名 G;選哪個就抽哪個)與三顆抽卡鈕(單抽 / 10 抽 / 全抽,只抽目前單選的那個池)。
// 其餘說明(機率、保底、本期、新手禮包、頭目贈抽、補充節奏)全收進『卡池說明』pop(cu.dpop = 'info');指名池的陣營 / 職業選擇收進『選擇』pop(cu.dpop = 'pick')。pop 覆蓋在面板內,頁面不展開說明。
// 捲動:分頁重畫前記下 .cubd 的 scrollTop、重畫後還原(cuDrawKeepInstall 在面板 capture 點擊時記下、下一拍還原;cardsreveal.js 特效結束時也會還原)。
// 按鈕動作:dpool 單選、dpop 開關 pop 由本檔 cuDrawClick;pull(酒館 / 縣試)由 cardsui.js cuDoPull;指名 ndraw / nrun / nmode / nkey 由 cardsui_named.js;禮包 stclaim / stshow / stlater / stopen 由 cardsui_starter.js。
// 本檔組字:cuDrawTabHtml / cuDrawBtns / cuDrawGate / cuStarterPop(卡池 pop 分派)/ cuDrawInfoPop / cuDrawPickPop / cuStarterPop / cuStarterInfoHtml / cuPityLine / cuNbLine / cuBossHtml / cuDrawCss / cuDrawClick / cuDrawScrollY / cuDrawScrollSet / cuDrawKeepInstall。
// 全域名稱:CU_DRAW_POOLS CU_DRAW_TITLE CU_DRAW_LABEL CU_DRAW_DESC cuDrawCss cuDrawPool cuDrawGate cuDrawBtns cuDrawTabHtml cuDrawClick cuDrawInfoPop cuDrawPickPop cuStarterPop cuStarterInfoHtml cuPityLine cuNbLine cuBossHtml cuDrawScrollY cuDrawScrollSet cuDrawKeepInstall
// 不發聲、不推播。ES2017;不用 ?. ??。

var CU_DRAW_POOLS = ['T', 'E', 'G'];
var CU_DRAW_TITLE = { T: '酒館 · 招賢酒肆', E: '縣試 · 九品中正考課', G: '指名 · 天子親策' };
var CU_DRAW_LABEL = { T: '酒館', E: '縣試', G: '指名' };
var CU_DRAW_DESC = { T: '每抽 1 次出 1 張,白青藍為主。', E: '每抽 1 次出 1 張,白至紫,科目逐期輪替。' };

function cuDrawDesc(v) {
  return v === 'G' ? '每次消耗 1 張指名券,一次出 ' + CARD_VENUES.G.batch + ' 張直接入冊,可指定陣營或職業分類。' : CU_DRAW_DESC[v];
}
function cuDrawCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuDrawStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuDrawStyle';
  st.textContent = '#cardsPanel .cuov{margin:6px 0;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.07)}' +
    '#cardsPanel .cuchips{display:flex;flex-wrap:wrap;gap:0}#cardsPanel button.cub.on{background:#f0b45a;color:#222}' +
    '#cardsPanel .cudrs{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}#cardsPanel .cudr{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border-radius:6px;background:#36332d;color:#eee;font-size:15px}' +
    '#cardsPanel .cudr input{width:18px;height:18px;margin:0}#cardsPanel .cudr.on{background:#f0b45a;color:#222}' +
    '#cardsPanel .cudbig{display:flex;gap:6px;margin:8px 0 4px}#cardsPanel .cudbig button.cub{flex:1 1 0;margin:0;min-height:48px;font-size:15px}' +
    '#cardsPanel .cudbig button.cub[disabled]{opacity:.35}';
  document.head.appendChild(st);
}
// 卡池未開放的說明(指名池的科技門檻文字改寫為「指名卡池」)
function cuDrawGate(v) {
  var V = CARD_VENUES[v];
  return v === 'G' ? cuGateTxt('G').replace(V.name, '指名卡池') : cuGateTxt(v);
}
// 目前單選的卡池(預設酒館)
function cuDrawPool() {
  var v = (typeof cu !== 'undefined' && cu.dpool) || 'T';
  return CU_DRAW_POOLS.indexOf(v) >= 0 ? v : 'T';
}
// 指名選擇的防呆:陣營模式 nkey 必須在魔幻世界可選陣營內(5~13 本族在前),職業分類模式必須是 CARD_ROWS 之一
function cuDrawNamedFix() {
  if (cu.nmode === 'row') { if (CARD_ROWS.indexOf(cu.nkey) < 0) cu.nkey = CARD_ROWS[0]; }
  else if (cardsFacList().indexOf(cu.nkey) < 0) cu.nkey = cardsFacList()[0];
}
// 三顆抽卡鈕(只作用於目前單選的池)。酒館 / 縣試:單抽 1 次 / 10 抽 / 全抽(data-n = 1 / 10 / all,走 cuDoPull)
// 指名:單抽 = 1 券(ndraw)/ 10 抽 = 10 券、全抽 = 全部指名券(nrun,逐批連開)
function cuDrawBtns(cs, v) {
  var k = CARD_DRAW.maxOne, can, n, tk, b, full = !cardsBagCanOpen(cs, 1), h;
  if (v === 'G') {
    tk = cs.nameTokens | 0; b = !!cs.cur.G;
    can = cardsNamedOpen(cs) && !b && !full && !cu.revealing;
    h = '<button class="cub" data-a="ndraw"' + (can && tk >= 1 ? '' : ' disabled') + '>單抽(1 券)</button>' +
      '<button class="cub" data-a="nrun" data-n="' + k + '"' + (can && tk >= k ? '' : ' disabled') + '>10 抽(' + k + ' 券)</button>' +
      '<button class="cub" data-a="nrun" data-n="all"' + (can && tk >= 1 ? '' : ' disabled') + '>全抽(' + tk + ' 券)</button>';
  } else {
    n = cardsPulls(cs);
    can = cardsVenueOpen(v) && !full && !cu.revealing && !cs.cur[v];
    h = '<button class="cub" data-a="pull" data-v="' + v + '" data-n="1"' + (can && n >= 1 ? '' : ' disabled') + '>單抽</button>' +
      '<button class="cub" data-a="pull" data-v="' + v + '" data-n="' + k + '"' + (can && n >= k && cardsBagCanOpen(cs, k) ? '' : ' disabled') + '>10 抽</button>' +
      '<button class="cub" data-a="pull" data-v="' + v + '" data-n="all"' + (can && n >= 1 ? '' : ' disabled') + '>全抽(' + n + ')</button>';
  }
  return '<div class="cudbig">' + h + '</div>';
}
// 抽卡分頁 D 的整頁內容(cardsui.js cardsUiRender 呼叫):持有抽數、說明鈕、卡池單選、三顆抽卡鈕、狀態提示與最近一次結果
function cuDrawTabHtml(cs) {
  var v = cuDrawPool(), n = cardsPulls(cs), full = !cardsBagCanOpen(cs, 1), open = v === 'G' ? cardsNamedOpen(cs) : cardsVenueOpen(v), h = '';
  cuDrawCss();
  cuDrawKeepInstall();
  if (v === 'G') cuDrawNamedFix();
  h += '<div class="cuov"><div class="cur"><span>持有抽數 <b>' + n + ' / ' + CARD_DRAW.cap + '</b></span>' +
    '<button class="cub" data-a="dpop" data-k="info" style="margin:0">卡池說明</button></div>';
  if (v === 'G') h += '<div class="cur"><span class="cusub">指定:' + cuEsc(cu.nmode === 'row' ? '職業分類 ' + cu.nkey : '陣營 ' + (CARD_FAC[cu.nkey] || '')) + '</span>' +
    '<button class="cub" data-a="dpop" data-k="pick" style="margin:0">選擇</button></div>';
  h += '</div>';
  h += '<div class="cudrs" role="radiogroup" aria-label="卡池">' + CU_DRAW_POOLS.map(function (p) {
    var on = p === v;
    return '<label class="cudr' + (on ? ' on' : '') + '"><input type="radio" name="cudpool" value="' + p + '" data-a="dpool" data-v="' + p + '"' + (on ? ' checked' : '') + '>' + cuEsc(CU_DRAW_LABEL[p]) + '</label>';
  }).join('') + '</div>';
  if (!open) h += '<div class="cusub">' + cuEsc(cuDrawGate(v)) + '</div>';
  h += cuDrawBtns(cs, v);
  if (full) h += '<div class="cuwarn">名冊已滿,暫停抽卡(不扣次數)。<button class="cub" data-a="tab" data-t="R" style="margin:0">去名冊熔鍊</button></div>';
  if (v === 'G' && open && !(cs.nameTokens | 0)) h += '<div class="cusub">指名券用完了;可用碎片兌換,或完成里程碑取得。</div>';
  if (v !== 'G' && !n) h += '<div class="cusub">沒有可抽次數了;等下次補充,或通關頭目關卡領贈抽。</div>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  h += cuLastHtml();
  return h;
}
// 按鈕動作:卡池單選、卡池說明 / 指名選擇 pop 開關(其餘動作由 cuNamedClick / cuStarterClick 等處理)
function cuDrawClick(a, b) {
  var v;
  if (a === 'dpool') { v = b.getAttribute('data-v'); cu.dpool = CU_DRAW_POOLS.indexOf(v) >= 0 ? v : 'T'; cu.dpop = null; return true; }
  if (a === 'dpop') { cu.dpop = b.getAttribute('data-k') || null; return true; }
  return false;
}

// ───────── 卡池說明 pop / 指名選擇 pop ─────────
// cuStarterPop(cardsui.js cardsUiRender 在沒有 cu.info 時呼叫):cu.dpop 開著就出 pop;否則出新手禮包說明卡(可領且未稍後)
function cuStarterPop(cs) {
  var S = CARD_STARTER, st = (typeof cardsStarterState === 'function') ? cardsStarterState(cs) : 'na';
  if (cu.revealing) return '';
  if (cu.dpop === 'info' || cu.dpop === 'pick') return cu.dpop === 'pick' ? cuDrawPickPop(cs) : cuDrawInfoPop(cs);
  if (st !== 'ready' || (cu.stLater && !cu.stShow)) return '';
  return '<div class="cuinfo"><h4>🎁 新手禮包</h4>' +
    '<div class="cuil"><b>抽卡次數 ' + S.pulls + ' 抽</b> 到〈' + CARD_VENUES.T.name + '〉或〈' + CARD_VENUES.E.name + '〉卡池抽卡(單抽 / 10 抽 / 全抽),抽到的人直接加入名冊(名冊滿了要先遣散或熔鍊騰出空位)。次數可超過上限 ' + CARD_DRAW.cap + '。</div>' +
    '<div class="cuil"><b>保底</b> 前 ' + S.pulls + ' 抽至少 ' + S.goldGuarantee + ' 張金卡(名人),另外至少 ' + S.purpleGuarantee + ' 張紫卡。</div>' +
    '<div class="cuil"><b>指名券 ' + S.namedTokens + ' 張</b> 到「指名」卡池指定陣營或職業分類(還沒研發指名也能用)。</div>' +
    '<div class="cuil"><b>新手期</b> 領取後的前 ' + S.nbCards + ' 張' + CARD_VENUES.T.name + '、' + CARD_VENUES.E.name + '卡,紫卡和金卡比較容易出:每 ' + S.nbPurple + ' 抽內必有紫卡以上,每 ' + S.nbGold + ' 抽內必有金卡。</div>' +
    '<div class="cusub">只能領一次。之後可在「卡池說明」再看一次。</div>' +
    '<button class="cub" data-a="stclaim">領取</button><button class="cub" data-a="stlater">稍後再說</button></div>';
}
// 卡池說明 pop:目前單選的池(機率 / 本期 / 保底 / 新手期)+ 持有抽數與補充倒數 + 贈抽 / 禮包 / 頭目任務
function cuDrawInfoPop(cs) {
  var v = cuDrawPool(), V = CARD_VENUES[v], T = cardsDrawTier(), D = CARD_DRAW, S = CARD_STARTER, open = v === 'G' ? cardsNamedOpen(cs) : cardsVenueOpen(v), th, nx, h;
  h = '<div class="cuinfo"><h4>卡池說明 · ' + cuEsc(CU_DRAW_TITLE[v]) + '</h4>';
  h += '<div class="cuil"><b>說明</b> ' + cuEsc(cuDrawDesc(v)) + '</div>';
  if (v === 'E') h += '<div class="cuil"><b>備註</b> 文鬥小遊戲尚未實作,評等暫以 1 星計。</div>';
  if (!open) h += '<div class="cuwarn">' + cuEsc(cuDrawGate(v)) + '</div>';
  else {
    h += '<div class="cuil"><b>機率</b> ' + cuEsc(cuGrPct(V.gr)) + '</div>';
    if (v !== 'G') { th = cardsVenueTheme(v, cs.pl ? (cs.pl.tot | 0) : 0); h += '<div class="cuil"><b>本期</b> ' + cuEsc(th.text) + '</div>'; }
    h += '<div class="cuil"><b>保底</b></div>' + cuPityLine(cs, v);
    if (v !== 'G') h += cuNbLine(cs);
  }
  h += '<div class="cusec">持有抽數</div>';
  h += '<div class="cuil">持有 <b>' + cardsPulls(cs) + ' / ' + D.cap + '</b>。每 ' + T.h + ' 小時補充 ' + T.n + ' 抽(離線也會累積),存到 ' + D.cap + ' 為止;存滿後先抽才會繼續累積。</div>';
  nx = cardsNextIn(cs, v, cuNow());
  if (nx !== null) h += '<div class="cusub">下次 +' + T.n + ' 抽:<span data-cd="p">' + cardsUiFmtCd(nx) + '</span> 後</div>';
  h += '<div class="cusec">贈抽與禮包</div>';
  h += '<div class="cuil"><b>新手禮包</b> 一次給 ' + S.pulls + ' 抽(可超過上限 ' + D.cap + ')。每章頭目首次通關 +' + CARD_BOSS.pulls + ' 抽。</div>';
  h += cuStarterInfoHtml(cs);
  h += cuBossHtml(cs, true);
  h += '<div class="cusec">名冊</div><div class="cuil">名冊滿了就停止抽卡(次數保留、不扣),遣散或熔鍊騰出空位後才能再抽。</div>';
  h += '<button class="cub" data-a="info" data-k="draw" data-key="" style="margin:0">補充節奏與升級</button> ';
  h += '<button class="cub" data-a="dpop" data-k="" style="margin:0">關閉</button></div>';
  return h;
}
// 指名選擇 pop:陣營 / 職業分類 切換與選項(cardsui_named.js cuNamedClick 的 nmode / nkey)
function cuDrawPickPop(cs) {
  var fac = cu.nmode !== 'row', list, h;
  cuDrawNamedFix();
  list = fac ? cardsFacList().map(function (i) { return [i, CARD_FAC[i]]; }) : CARD_ROWS.map(function (n) { return [n, n]; });
  h = '<div class="cuinfo"><h4>指名 · 選擇</h4>';
  h += '<div class="cusub" style="opacity:1">選好陣營或職業分類後,按頁面的「單抽 / 10 抽 / 全抽」。</div>';
  h += '<div class="cuchips"><button class="cub' + (fac ? ' on' : '') + '" data-a="nmode" data-m="fac">陣營</button><button class="cub' + (fac ? '' : ' on') + '" data-a="nmode" data-m="row">職業分類</button></div>';
  h += '<div class="cuchips">' + list.map(function (e) { return '<button class="cub' + (cu.nkey === e[0] ? ' on' : '') + '" data-a="nkey" data-k="' + e[0] + '">' + cuEsc(e[1]) + '</button>'; }).join('') + '</div>';
  h += '<div class="cusub" style="opacity:1">' + (fac ? '指定陣營:該陣營的人物,金 / 紫檔可能出現該陣營名人(重複者化為信物)。' : '指定職業分類:主職業取自該分類;不出名人。') + '</div>';
  h += '<button class="cub" data-a="dpop" data-k="">完成</button></div>';
  return h;
}
// 卡池說明 pop 內的新手禮包列:可領 → 領取 / 看內容;舊存檔還有批次沒開 → 開批;其餘不顯示
function cuStarterInfoHtml(cs) {
  var st = (typeof cardsStarterState === 'function') ? cardsStarterState(cs) : 'na', S = CARD_STARTER, left;
  if (st === 'ready') return '<div class="cuov" style="border:2px solid var(--gr4)"><div class="cur"><b>🎁 新手禮包可領</b><span class="cusub">' + S.pulls + ' 抽 · 保底 1 張金卡</span></div>' +
    '<button class="cub" data-a="stclaim">領取 ' + S.pulls + ' 抽</button><button class="cub" data-a="stshow">看內容</button></div>';
  if (st === 'open') {   // 舊存檔留下的禮包批次
    left = cs.starter.left | 0;
    return '<div class="cuov" style="border:2px solid var(--gr4)"><div class="cur"><b>🎁 新手禮包</b><span class="cusub">還有 ' + left + ' 批沒開</span></div>' +
      '<button class="cub" data-a="stopen"' + (cs.cur.G ? ' disabled' : '') + '>開第 ' + (S.batches - left + 1) + ' 批</button></div>';
  }
  return '';
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

// 頭目首通贈抽任務:compact = 一行(只列下一個未領的);否則六章全列(領過打勾)
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

// ───────── 捲動位置保留(抽卡分頁自己的重畫路徑)─────────
function cuDrawBody() { return (cu.el && cu.el.querySelector) ? cu.el.querySelector('.cubd') : null; }
function cuDrawScrollY() { var bd = cuDrawBody(); return bd ? (bd.scrollTop | 0) : 0; }
function cuDrawScrollSet(y) { var bd = cuDrawBody(); if (bd) bd.scrollTop = y | 0; }
// 面板在抽卡分頁點任何東西:先記下捲動位置,cardsUiRender 重畫後(同一輪事件的下一拍)還原
function cuDrawKeepInstall() {
  if (!cu.el || cu.el.__cuDrawKeep || typeof cu.el.addEventListener !== 'function') return;
  cu.el.__cuDrawKeep = 1;
  cu.el.addEventListener('click', function () {
    var y;
    if (cu.tab !== 'D' || typeof setTimeout !== 'function') return;
    y = cuDrawScrollY();
    setTimeout(function () { if (cu.tab === 'D') cuDrawScrollSet(y); }, 0);
  }, true);
}
