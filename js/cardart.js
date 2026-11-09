// js/cardart.js — 卡片美術(assets/card/):五品階邊框 frame_0..4(白青藍紫金)+ 人物背景 bg_*(視窗內)+ 陣營徽章 fac_* / 戰鬥類型 job_* / 星 star / 鎖 lock + 新卡背 card_back。
// 共用給 cardsui.js(名冊 / 卡包卡面與列表縮圖)與 cardsreveal.js(抽卡開獎)。卡面 HTML 只用絕對定位的百分比座標(1em = 卡寬 1 %),圖由瀏覽器快取共用,不逐張畫 canvas。
// 載入策略:首次使用(開招賢面板 / 抽卡)時 cardArtPreload() 一次載入全部美術並以 Image 物件快取;某張卡需要的邊框 + 背景都載入成功才畫美術卡,
// 否則(載入中 / 缺檔)呼叫端退回原文字卡,並用 cardArtWant(c, fn) 登記「載完重畫」(同一 fn 只登記一次,全部載完才通知一次)。
// 魔幻世界暫用同一套邊框;陣營不在 0..4(魏蜀吳黃巾中立)時背景與徽章用通用款。不發聲。ES2017;不用 ?. ??。
// 全域名稱:CA_DIR CA_FRAME CA_BG_KEYS CA_FAC_KEYS CA_TROOP_ICON CA_BG_FIG_ONLY cardArtLoad cardArtPreload cardArtOk cardArtWant cardArtBg cardArtTroop cardArtHtml cardArtCss cardArtState
var CA_DIR = 'assets/card/';
// 每品階邊框的版面(佔卡片寬高比例 [x0, y0, x1, y1]):win 人物視窗(給GPT/卡片邊框/視窗位置量測.json)、nm 名牌卷軸平直段、pn 下方資訊面板(避開四角紋飾)
var CA_FRAME = [
  { win: [0.1036, 0.1626, 0.8936, 0.5952], nm: [0.21, 0.604, 0.79, 0.678], pn: [0.10, 0.695, 0.90, 0.94] },
  { win: [0.1222, 0.1661, 0.8778, 0.5952], nm: [0.21, 0.604, 0.79, 0.678], pn: [0.12, 0.695, 0.88, 0.94] },
  { win: [0.1133, 0.1644, 0.8867, 0.5952], nm: [0.21, 0.602, 0.79, 0.676], pn: [0.125, 0.695, 0.875, 0.94] },
  { win: [0.1099, 0.1626, 0.8873, 0.5986], nm: [0.21, 0.606, 0.79, 0.680], pn: [0.10, 0.698, 0.90, 0.945] },
  { win: [0.1366, 0.1635, 0.8634, 0.5826], nm: [0.23, 0.590, 0.77, 0.661], pn: [0.14, 0.680, 0.86, 0.915] }
];
var CA_BG_KEYS = ['wei', 'shu', 'wu', 'yellow', 'neutral'];    // CARD_FAC 索引 → bg_<key>.webp
var CA_FAC_KEYS = ['wei', 'shu', 'wu', 'yellow', 'neutral'];   // CARD_FAC 索引 → fac_<key>.webp
var CA_TROOP_ICON = { '盾': 'shield', '槍': 'inf', '騎': 'cav', '弓': 'arc', '謀': 'str' };   // 兵種 → job_<key>.webp(其餘 gen)
var CA_BG_FIG_ONLY = true;   // true:名人用陣營背景、路人用 bg_generic;false:路人也用陣營背景
var caImgs = {};             // src → { st: 0 載入中 / 1 成功 / -1 失敗, im: Image }
var caCbs = [];

function cardArtState(src) { var o = caImgs[src]; return o ? o.st : null; }
function caNotify() {
  var k, l;
  for (k in caImgs) if (caImgs[k].st === 0) return;   // 還有載入中的:等全部完成才通知一次,避免逐張重畫
  l = caCbs; caCbs = [];
  l.forEach(function (f) { try { f(); } catch (e) { if (typeof console !== 'undefined') console.error(e); } });
}
// 載入並快取一張圖;回目前狀態(0 / 1 / -1)。沒有 Image(測試 / 非瀏覽器)當作失敗 → 呼叫端退回文字卡
function cardArtLoad(src) {
  var o = caImgs[src];
  if (o) return o.st;
  if (typeof Image === 'undefined') { caImgs[src] = { st: -1, im: null }; return -1; }
  o = caImgs[src] = { st: 0, im: null };
  try {
    o.im = new Image();
    o.im.onload = function () { o.st = 1; caNotify(); };
    o.im.onerror = function () { o.st = -1; caNotify(); };
    try { o.im.decoding = 'async'; } catch (e) { /* 舊瀏覽器沒有 decoding */ }
    o.im.src = src;
  } catch (e) { o.st = -1; }
  return o.st;
}
function caFrameSrc(gr) { return CA_DIR + 'frame_' + Math.max(0, Math.min(4, gr | 0)) + '.webp'; }
function cardArtBg(c) {
  var k = (!CA_BG_FIG_ONLY || (c && c.fig)) ? CA_BG_KEYS[c ? c.fac : -1] : null;
  return CA_DIR + 'bg_' + (k || 'generic') + '.webp';
}
function caFacSrc(c) { var k = CA_FAC_KEYS[c ? c.fac : -1]; return k ? CA_DIR + 'fac_' + k + '.webp' : ''; }
// 戰鬥類型(預設兵種):bn_units.js 的 bnDefaultTroop;缺模組或算不出 → 通用
function cardArtTroop(c) {
  var t = null;
  try { if (typeof bnDefaultTroop === 'function' && c && c.st) t = bnDefaultTroop(c); } catch (e) { t = null; }
  return CA_TROOP_ICON[t] || 'gen';
}
function cardArtPreload() {
  var i, l = [];
  for (i = 0; i < 5; i++) l.push(caFrameSrc(i), CA_DIR + 'gem_' + i + '.webp');
  CA_BG_KEYS.concat(['generic']).forEach(function (k) { l.push(CA_DIR + 'bg_' + k + '.webp'); });
  CA_FAC_KEYS.forEach(function (k) { l.push(CA_DIR + 'fac_' + k + '.webp'); });
  ['shield', 'inf', 'cav', 'arc', 'str', 'gen'].forEach(function (k) { l.push(CA_DIR + 'job_' + k + '.webp'); });
  l.push(CA_DIR + 'star.webp', CA_DIR + 'lock.webp', CA_DIR + 'card_back.webp');
  l.forEach(cardArtLoad);
  cardArtCss();
}
// 這張卡的邊框與背景都已載入成功 → 可畫美術卡(只查狀態,順便觸發載入)
function cardArtOk(c) {
  if (!c) return false;
  return cardArtLoad(caFrameSrc(c.gr)) === 1 && cardArtLoad(cardArtBg(c)) === 1;
}
// 載入中才登記 fn(全部載完呼叫一次);已成功或已失敗不登記。回 true = 已登記
function cardArtWant(c, fn) {
  if (!c || typeof fn !== 'function') return false;
  var a = cardArtLoad(caFrameSrc(c.gr)), b = cardArtLoad(cardArtBg(c));
  if (a !== 0 && b !== 0) return false;
  if (caCbs.indexOf(fn) < 0) caCbs.push(fn);
  return true;
}
function caPct(v) { return Math.round(v * 10000) / 100 + '%'; }
function caBox(b) { return 'left:' + caPct(b[0]) + ';top:' + caPct(b[1]) + ';width:' + caPct(b[2] - b[0]) + ';height:' + caPct(b[3] - b[1]); }
function caEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
// 美術卡 HTML(呼叫端先確認 cardArtOk)。o:portrait(視窗內的剪影 + 頭像 HTML)、name / panel(已跳脫的 HTML)、cls、thumb(列表縮圖:只畫背景 + 頭像 + 邊框)、
// icons(預設 true:陣營徽章、戰鬥類型)、star(星數 0~5)、lock(鎖定)
function cardArtHtml(c, o) {
  o = o || {};
  var gr = Math.max(0, Math.min(4, c.gr | 0)), F = CA_FRAME[gr], w = F.win, ww = w[2] - w[0], wh = w[3] - w[1], pad = 0.006, h, n, i, fac;
  // 視窗略外擴(被邊框蓋住)避免接縫;背景以整張卡為座標鋪滿,視窗只露出對應那一塊
  var win = [w[0] - pad, w[1] - pad, w[2] + pad, w[3] + pad];
  ww = win[2] - win[0]; wh = win[3] - win[1];
  var bg = 'left:' + caPct(-win[0] / ww) + ';top:' + caPct(-win[1] / wh) + ';width:' + caPct(1 / ww) + ';height:' + caPct(1 / wh) + ';background-image:url(' + cardArtBg(c) + ')';
  h = '<div class="caf cag' + gr + (o.thumb ? ' cath' : '') + (o.cls ? ' ' + o.cls : '') + '" aria-hidden="' + (o.thumb ? 'true' : 'false') + '">';
  h += '<div class="cawin" style="' + caBox(win) + '"><div class="cabg" style="' + bg + '"></div>' + (o.portrait || '') + '</div>';
  h += '<img class="cafr" alt="" draggable="false" src="' + caFrameSrc(gr) + '">';
  if (o.thumb) return h + '</div>';
  h += '<div class="canm" style="' + caBox(F.nm) + '">' + (o.name || '') + '</div>';
  h += '<div class="capn" style="' + caBox(F.pn) + '">' + (o.panel || '') + '</div>';
  if (o.icons !== false) {
    fac = caFacSrc(c);
    if (fac) h += '<img class="caic cafac" alt="" draggable="false" src="' + fac + '" style="left:' + caPct(w[0] + 0.01) + ';top:' + caPct(w[1] + 0.008) + '" onerror="this.remove()">';
    h += '<img class="caic catp" alt="" draggable="false" src="' + CA_DIR + 'job_' + cardArtTroop(c) + '.webp" style="left:' + caPct(w[2] - 0.01 - 0.17) + ';top:' + caPct(w[1] + 0.008) + '" onerror="this.remove()">';
  }
  if (o.lock) h += '<img class="caic calk" alt="" draggable="false" src="' + CA_DIR + 'lock.webp" style="left:' + caPct(w[0] + 0.02) + ';top:' + caPct(w[3] - 0.09) + '" onerror="this.remove()">';
  n = Math.max(0, Math.min(5, o.star | 0));
  if (n) {
    h += '<span class="castars" style="top:' + caPct(w[3] - 0.075) + '">';
    for (i = 0; i < n; i++) h += '<img class="cast" alt="" draggable="false" src="' + CA_DIR + 'star.webp" onerror="this.remove()">';
    h += '</span>';
  }
  return h + '</div>';
}
// 樣式:#cardsPanel 版本用雙 ID 權重,蓋過橫版大面板的通用字級規則(style.css panel-big-landscape,權重 1,2,2)
function cardArtCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('caStyle')) return;
  var R = [
    ['.caf.caf', 'position:relative;flex:none;width:var(--caw,240px);height:calc(var(--caw,240px) * 1.628);font-size:calc(var(--caw,240px) * .01);line-height:1.2;color:#f3ead6;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none'],
    ['.caf .cawin', 'position:absolute;overflow:hidden;background:#3a352c;font-size:1em'],
    ['.caf .cabg', 'position:absolute;background-size:100% 100%;background-repeat:no-repeat'],
    ['.caf .cawin img', 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:50% 12%'],
    ['.caf .cawin svg', 'position:absolute;left:0;top:0;width:100%;height:100%'],
    ['.caf .cafr', 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none'],
    ['.caf .canm', 'position:absolute;display:flex;align-items:center;justify-content:center;gap:1.2em;white-space:nowrap;overflow:hidden;color:#3b2612;font-weight:bold;font-size:7em;letter-spacing:.06em;text-shadow:0 1px 0 rgba(255,244,214,.7)'],
    ['.caf .canm .canmt', 'font-size:1em'],
    ['.caf .canm .canml', 'font-size:.78em'],
    ['.caf .canm .canmz', 'font-size:.58em;font-weight:normal;letter-spacing:0;opacity:.85'],
    ['.caf .capn', 'position:absolute;display:flex;flex-direction:column;justify-content:center;align-items:stretch;gap:1.2em;font-size:1em;text-align:center;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,.85)'],
    ['.caf .capl', 'font-size:4.6em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'],
    ['.caf .capst', 'display:flex;justify-content:space-between;font-size:1em'],
    ['.caf .capc', 'display:flex;flex-direction:column;align-items:center;flex:1 1 0;min-width:0;font-size:1em'],
    ['.caf .capk', 'font-size:3.8em;opacity:.8'],
    ['.caf .capv', 'font-size:5.6em;font-weight:bold;color:#ffe3a0'],
    ['.caf .cachip', 'display:inline-flex;align-items:center;justify-content:center;min-height:28px;margin-left:.4em;padding:0 .6em;border:1px solid rgba(255,227,160,.6);border-radius:6px;cursor:pointer;font-size:1em;color:#ffe3a0;vertical-align:middle'],
    ['.caf.camini .cachip', 'min-height:0'],
    ['.caf .caic', 'position:absolute;width:17%;height:auto;aspect-ratio:1;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))'],
    ['.caf .calk', 'width:13%'],
    ['.caf .castars', 'position:absolute;left:0;right:0;display:flex;justify-content:center;pointer-events:none;font-size:1em'],
    ['.caf .cast', 'width:9%;height:auto;aspect-ratio:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.7))'],
    ['.caf.cath', '--caw:38px'],
    ['.cucard.caon', 'padding-top:8px'],
    ['.cucard.caon > .caf', 'margin:0 auto 6px;--caw:min(260px, calc(100vw - 110px))'],
    ['.cucard.caon > .caf.camini', '--caw:150px'],
    ['.cathw', 'display:inline-flex;flex:none;margin:2px 6px 2px 0;vertical-align:middle'],
    ['.cathw .caf.cath', '--caw:38px']
  ];
  var css = R.map(function (r) {
    var s = r[0].split(',').map(function (x) { x = x.trim(); return '#cardsPanel#cardsPanel ' + x + ',' + x; }).join(',');   // 雙 ID:權重需高於 style.css 橫版字級規則 (1,2,2)
    return s + '{' + r[1] + '}';
  }).join('');
  // 橫版大面板(body.panel-big-landscape):卡高不超過內容區高;卡面字級 ≥ 14px(專案橫版規範);詳情改「左卡面、右說明」;
  // 名冊分頁原本的多欄(column-width)在高度受限時會把超出的內容排到看不到的右側欄,有美術卡時改為單欄上下捲動(:has 不支援的瀏覽器維持原樣)
  var L = 'body.panel-big-landscape #cardsPanel#cardsPanel ';
  css += L + '.cucard.caon{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:12px;align-items:start}' + L + '.cucard.caon > .caf.caf{grid-column:1;grid-row:1 / span 12;margin:0;--caw:min(240px, calc((100vh - 84px) * .614))}' +
    L + '.cucard.caon > :not(.caf){grid-column:2}' +
    L + '.caf .canm{font-size:7em}' + L + '.caf .canm .canmz{font-size:.95em}' + L + '.caf .capn{gap:.4em;line-height:1.1}' + L + '.caf .capl{font-size:max(14px, 6.6em)}' +
    L + '.caf .capk{font-size:max(14px, 6.6em)}' + L + '.caf .capv{font-size:max(16px, 7.5em)}' + L + '.caf .canm .canml{font-size:max(14px, .8em)}';
  css += '@supports selector(:has(a)){' + L + '.cubd:has(.caf){column-width:auto;columns:auto}}';
  var st = document.createElement('style');
  st.id = 'caStyle';
  st.textContent = css;
  document.head.appendChild(st);
}
