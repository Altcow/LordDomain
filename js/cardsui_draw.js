// js/cardsui_draw.js — 抽卡分頁 D(2026-11-11 v59):卡池只剩『小池』(T,最高紫)與『大池』(E,可出金)。頂部顯示兩池各自的『持有抽數 n / 200』、『卡池說明』鈕、卡池單選(選哪個就抽哪個)與三顆抽卡鈕(單抽 / 10 抽 / 全抽,只抽目前單選的池)。
// 指名池(G)與指名券已刪除;新手禮包改為道具(items.js,發放見 cards_starter.js cardsGiftCheck,內含大池 2000 抽,到道具頁籤使用),不再有領取鈕 / 彈窗。
// 其餘說明(機率、保底、新手期、補充節奏、贈抽)全收進『卡池說明』pop(cu.dpop = 'info')。pop 覆蓋在面板內,頁面不展開說明。
// 捲動:分頁重畫前記下 .cubd 的 scrollTop、重畫後還原(cuDrawKeepInstall 在面板 capture 點擊時記下、下一拍還原;cardsreveal.js 特效結束時也會還原)。
// 本檔組字:cuDrawTabHtml / cuDrawBtns / cuDrawPop(卡池說明 pop 分派)/ cuDrawInfoPop / cuPityLine / cuNbLine / cuBossHtml / cuDrawCss / cuDrawClick / cuDrawScrollY / cuDrawScrollSet / cuDrawKeepInstall。
// 按鈕動作:dpool 單選、dpop 開關 pop 由本檔 cuDrawClick;pull 由 cardsui.js cuDoPull。
// 全域名稱:CU_DRAW_POOLS CU_DRAW_TITLE CU_DRAW_LABEL CU_DRAW_DESC cuDrawCss cuDrawPool cuDrawGate cuDrawBtns cuDrawTabHtml cuDrawClick cuDrawInfoPop cuDrawPop cuPityLine cuNbLine cuBossHtml cuDrawScrollY cuDrawScrollSet cuDrawKeepInstall
// 不發聲、不推播。ES2017;不用 ?. ??。

var CU_DRAW_POOLS = ['T', 'E'];
var CU_DRAW_TITLE = { T: '小池 · 招賢酒肆', E: '大池 · 九品中正考課' };
var CU_DRAW_LABEL = { T: '小池', E: '大池' };
var CU_DRAW_DESC = { T: '每抽 1 次出 1 張,白青藍為主,最高出紫卡,不出金卡。', E: '每抽 1 次出 1 張,白至金,科目逐期輪替;金卡皆為名人。' };

function cuDrawDesc(v) { return CU_DRAW_DESC[v] || ''; }
function cuDrawCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuDrawStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuDrawStyle';
  st.textContent = '#cardsPanel .cuov{margin:6px 0;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.07)}' +
    '#cardsPanel .cuchips{display:flex;flex-wrap:wrap;gap:0}#cardsPanel button.cub.on{background:#f0b45a;color:#222}' +
    '#cardsPanel .cudrs{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}#cardsPanel .cudr{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border-radius:6px;background:#36332d;color:#eee;font-size:15px}' +
    '#cardsPanel .cudr input{width:18px;height:18px;margin:0}#cardsPanel .cudr.on{background:#f0b45a;color:#222}' +
    '#cardsPanel .cudbig{display:flex;gap:6px;margin:8px 0 4px}#cardsPanel .cudbig button.cub{flex:1 1 0;margin:0;min-height:48px;font-size:15px}' +
    '#cardsPanel .cudbig button.cub[disabled]{opacity:.35}#cardsPanel .cudwal{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline}#cardsPanel .cudwal span.on{color:#f0b45a}';
  document.head.appendChild(st);
}
// 卡池未開放的說明(科技門檻文字)
function cuDrawGate(v) { return cuGateTxt(v); }
// 目前單選的卡池(預設小池)
function cuDrawPool() {
  var v = (typeof cu !== 'undefined' && cu.dpool) || '', c;
  if (!v && typeof cardsGet === 'function' && typeof cardsPulls === 'function') { try { c = cardsGet(); if (c && cardsPulls(c, 'E') > cardsPulls(c, 'T')) v = 'E'; } catch (e) { /* ignore */ } }
  v = v || 'T';
  return CU_DRAW_POOLS.indexOf(v) >= 0 ? v : 'T';
}
// 三顆抽卡鈕(只作用於目前單選的池):單抽 1 次 / 10 抽 / 全抽(data-n = 1 / 10 / all,走 cuDoPull)。次數以該池持有抽數計
function cuDrawBtns(cs, v) {
  var k = CARD_DRAW.maxOne, can, n = cardsPulls(cs, v), full = !cardsBagCanOpen(cs, 1), h;
  can = cardsVenueOpen(v) && !full && !cu.revealing && !cs.cur[v];
  h = '<button class="cub" data-a="pull" data-v="' + v + '" data-n="1"' + (can && n >= 1 ? '' : ' disabled') + '>單抽</button>' +
    '<button class="cub" data-a="pull" data-v="' + v + '" data-n="' + k + '"' + (can && n >= k && cardsBagCanOpen(cs, k) ? '' : ' disabled') + '>10 抽</button>' +
    '<button class="cub" data-a="pull" data-v="' + v + '" data-n="all"' + (can && n >= 1 ? '' : ' disabled') + '>全抽(' + n + ')</button>';
  return '<div class="cudbig">' + h + '</div>';
}
// 抽卡分頁 D 的整頁內容(cardsui.js cardsUiRender 呼叫):兩池持有抽數、說明鈕、卡池單選、目前池的補充倒數、三顆抽卡鈕、狀態提示與最近一次結果
function cuDrawTabHtml(cs) {
  var v = cuDrawPool(), open = cardsVenueOpen(v), full = !cardsBagCanOpen(cs, 1), n = cardsPulls(cs, v), nx, h = '';
  cuDrawCss();
  cuDrawKeepInstall();
  h += '<div class="cuov"><div class="cudwal">' + CU_DRAW_POOLS.map(function (p) {
    var npx = cardsNextIn(cs, p, cuNow()), tp = cardsDrawTier(p);
    return '<span class="' + (p === v ? 'on' : '') + '">' + cuEsc(CU_DRAW_LABEL[p]) + ' <b data-pn="' + p + '">' + cardsPulls(cs, p) + '</b> / ' + CARD_DRAW.cap + (npx === null ? ' · 已滿 · 有空位自動補' : ' · <span data-cd="' + p + '">' + cardsUiFmtCd(npx) + '</span> 後 +' + tp.n) + '</span>';
  }).join('') + '</div>' +
    '<div class="cur"><span class="cusub">' + cuEsc(CU_DRAW_TITLE[v]) + '</span><button class="cub" data-a="dpop" data-k="info" style="margin:0">卡池說明</button></div></div>';
  h += '<div class="cudrs" role="radiogroup" aria-label="卡池">' + CU_DRAW_POOLS.map(function (p) {
    var on = p === v;
    return '<label class="cudr' + (on ? ' on' : '') + '"><input type="radio" name="cudpool" value="' + p + '" data-a="dpool" data-v="' + p + '"' + (on ? ' checked' : '') + '>' + cuEsc(CU_DRAW_LABEL[p]) + '</label>';
  }).join('') + '</div>';
  nx = cardsNextIn(cs, v, cuNow());
  h += '<div class="cusub">' + cuEsc(CU_DRAW_LABEL[v]) + ' 持有 ' + n + ' 抽;' + (nx === null ? '已滿 · 有空位自動補 10 抽' : '每 ' + cardsDrawTier(v).h + ' 小時 +' + cardsDrawTier(v).n + ' 抽') + '</div>';
  if (!open) h += '<div class="cusub">' + cuEsc(cuDrawGate(v)) + '</div>';
  h += cuDrawBtns(cs, v);
  if (full) h += '<div class="cuwarn">卡包已滿,暫停抽卡(不扣次數)。<button class="cub" data-a="tab" data-t="R" style="margin:0">去卡包熔鍊</button></div>';
  if (!n) h += '<div class="cusub">' + cuEsc(CU_DRAW_LABEL[v]) + '沒有可抽次數了;等下次補充' + (v === 'E' ? ',或通關頭目關卡領贈抽' : '') + '。</div>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  h += cuLastHtml();
  return h;
}
// 按鈕動作:卡池單選、卡池說明 pop 開關(其餘動作由 cuClick 其他分派處理)
function cuDrawClick(a, b) {
  var v;
  if (a === 'dpool') { v = b.getAttribute('data-v'); cu.dpool = CU_DRAW_POOLS.indexOf(v) >= 0 ? v : 'T'; cu.dpop = null; return true; }
  if (a === 'dpop') { cu.dpop = b.getAttribute('data-k') || null; return true; }
  return false;
}

// ───────── 卡池說明 pop ─────────
// cuDrawPop(cardsui.js cardsUiRender 在沒有 cu.info 時呼叫):cu.dpop 開著才出 pop
function cuDrawPop(cs) {
  if (cu.revealing) return '';
  if (cu.dpop === 'info') return cuDrawInfoPop(cs);
  return '';
}
// 卡池說明 pop:目前單選的池(機率 / 本期 / 保底 / 新手期)+ 兩池持有抽數與補充倒數 + 補償 / 頭目任務
function cuDrawInfoPop(cs) {
  var v = cuDrawPool(), V = CARD_VENUES[v], T = cardsDrawTier(), D = CARD_DRAW, G = CARD_GIFT, th, nx, h;
  h = '<div class="cuinfo"><h4>卡池說明 · ' + cuEsc(CU_DRAW_TITLE[v]) + '</h4>';
  h += '<div class="cuil"><b>說明</b> ' + cuEsc(cuDrawDesc(v)) + '</div>';
  if (v === 'E') h += '<div class="cuil"><b>備註</b> 文鬥小遊戲尚未實作,評等暫以 1 星計。</div>';
  if (!cardsVenueOpen(v)) h += '<div class="cuwarn">' + cuEsc(cuDrawGate(v)) + '</div>';
  else {
    h += '<div class="cuil"><b>機率</b> ' + cuEsc(cuGrPct(V.gr)) + '</div>';
    th = cardsVenueTheme(v, cs.pl && cs.pl[v] ? (cs.pl[v].tot | 0) : 0);
    h += '<div class="cuil"><b>本期</b> ' + cuEsc(th.text) + '</div>';
    h += '<div class="cuil"><b>保底</b></div>' + cuPityLine(cs, v);
    h += cuNbLine(cs);
  }
  h += '<div class="cusec">持有抽數</div>';
  h += '<div class="cuil">小池 <b>' + cardsPulls(cs, 'T') + ' / ' + D.cap + '</b>、大池 <b>' + cardsPulls(cs, 'E') + ' / ' + D.cap + '</b>。大池每 ' + D.gap.E + ' 小時 +' + D.size[0].n + ' 抽、小池每 ' + D.gap.T + ' 小時 +' + D.size[0].n + ' 抽(離線也會累積),各自存到 ' + D.cap + ' 為止;存滿後先抽才會繼續累積。</div>';
  nx = cardsNextIn(cs, v, cuNow());
  if (nx !== null) h += '<div class="cusub">' + cuEsc(CU_DRAW_LABEL[v]) + '下次 +' + T.n + ' 抽:<span data-cd="' + v + '">' + cardsUiFmtCd(nx) + '</span> 後</div>';
  h += '<div class="cusec">贈抽與補償</div>';
  h += '<div class="cuil"><b>新手禮包</b> 新手禮包(道具)內含 ' + G.pulls + ' 抽,到卡包的道具頁籤使用(入大池,可超過上限 ' + D.cap + ')。' + (typeof itemCount === 'function' && itemCount('gift_newbie') > 0 ? '目前尚未使用。' : '') + '</div>';
  h += '<div class="cuil"><b>頭目贈抽</b> 每章頭目首次通關 +' + CARD_BOSS.pulls + ' 抽(大池)。</div>';
  h += cuBossHtml(cs, true);
  h += '<div class="cusec">卡包</div><div class="cuil">卡包滿了就停止抽卡(次數保留、不扣),遣散或熔鍊騰出空位後才能再抽。</div>';
  h += '<button class="cub" data-a="info" data-k="draw" data-key="" style="margin:0">補充節奏與升級</button> ';
  h += '<button class="cub" data-a="dpop" data-k="" style="margin:0">關閉</button></div>';
  return h;
}

// 連續保底提示:pity 為連續沒出上等的張數;最多再 N 張必出
function cuPityLine(cs, v) {
  var V = CARD_VENUES[v], P = cuPityN(v), up = V.upper.gr, n = P + 1 - Math.min(cs.pity[v] | 0, P), u = '抽';
  return '<div class="cusub">' + (n <= 1 ? '下一' + u + '必出' : '距離保底還有 ' + n + ' ' + u + '(最晚第 ' + n + ' ' + u + '必出') + cuGrName(up) + '卡以上' + (n <= 1 ? '' : ')') +
    ' <button class="cub" data-a="info" data-k="pity" data-key="" style="min-height:32px;margin:0;padding:0 8px">保底說明</button></div>';
}

// 新手期提示(開局 / 重啟後前 nbCards 張小池 / 大池的卡)
function cuNbLine(cs) {
  var S = CARD_STARTER, left = (typeof cardsNbLeft === 'function') ? cardsNbLeft(cs) : 0, nb = cs.starter && cs.starter.nb;
  if (!left || !nb) return '';
  return '<div class="cuov"><div class="cur"><b>新手期</b><span class="cusub">還剩 ' + left + ' 張</span></div><div class="cusub">小池、大池比較容易出紫卡:最多再 ' + Math.max(1, S.nbPurple - (nb.p | 0)) + ' 抽必出紫卡以上;大池最多再 ' + Math.max(1, S.nbGold - (nb.g | 0)) + ' 抽必出金卡。</div></div>';
}

// 頭目首通贈抽任務:compact = 一行(只列下一個未領的);否則六章全列(領過打勾)
function cuBossHtml(cs, compact) {
  var l = cuBossList(), P = CARD_BOSS.pulls, nx = cuBossNext(cs), h;
  if (!l.length) return '';
  if (compact) return nx ? '<div class="cusub">任務:首次通關第 ' + nx.ch + ' 章頭目〈' + cuEsc(nx.name) + '〉→ 大池 +' + P + ' 抽</div>' : '<div class="cusub">各章頭目首通贈抽已全數領取</div>';
  h = '<div class="cuov"><div class="cur"><b>任務 · 頭目贈抽</b><span class="cusub">每章頭目首次通關 +' + P + ' 抽(大池)</span></div>';
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
