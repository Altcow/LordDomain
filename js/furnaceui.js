// js/furnaceui.js — 卡片熔爐面板(點熔爐建築 furnace_card 開啟;全螢幕大面板,panelmgr id 'furnace')。美術在 assets/furnace/(PLAN_CARDS 熔爐美術):
//   背景 furnace_bg_p(直式)/ furnace_bg_l(橫式,依視窗寬高比切換,cover 填滿,上層半透明暗色)、中央介面熔爐六態 furnace_0..5(0 待機 1 預熱 2 燃燒 3 熔鍊中 4 完成 5 冷卻)、
//   shard_s/m/l(獲得碎片小 / 中 / 大圖示)、card_melt(熔卡疊圖)、nameticket(指名券)、shard_crate(碎片箱)。任何一張缺圖 → 該處回退為文字 / emoji,不報錯。
// 規則與數值完全沿用 cards.js(cardsFurnaceSum / cardsBagDissolve / cardsExchange)與 cardsui_bag.js 的確認規則,本檔只負責呈現與動畫;卡包頁的熔爐區塊保留並加『前往卡片熔爐』。
// 動畫:待機顯示 0;選卡預覽顯示 1(預熱)/ 2(燃燒,張數 >= FURNACE_UI.bigN 或碎片 >= FURNACE_UI.bigShards);按『熔鍊』依序播 2→3→4→5(各 FURNACE_UI.stepMs,約 1.5 秒),
//   省電模式(isPowerSave)只播 3→5;frame 4 時顯示獲得碎片(shard_s/m/l 依數量 + 飛入數字);結束回待機。不發聲、不推播。ES2017;不用 ?. ??。
// 全域名稱:FURNACE_UI FURNACE_SEQ FURNACE_SEQ_SAVE furnaceUiOpen furnaceUiClose furnaceUiToggle furnaceUiTap furnaceUiRender furnaceUiHtml furnaceFrame furnaceGainIcon furnaceBgUrl furnaceLand fu
var FURNACE_UI = { dir: 'assets/furnace/', stepMs: 375, stepMsSave: 600, bigN: 5, bigShards: 20, gainM: 20, gainL: 60, bg: { p: 'furnace_bg_p.webp', l: 'furnace_bg_l.webp' } };
var FURNACE_SEQ = [2, 3, 4, 5];       // 按『熔鍊』播放的幀序
var FURNACE_SEQ_SAVE = [3, 5];        // 省電模式:只顯示 3→5
var FURNACE_LE = [[0, '白'], [1, '青'], [2, '藍'], [3, '紫']];
var fu = { open: false, el: null, ble: -1, pend: null, msg: '', run: null, result: null, tm: 0, imgs: {}, bound: false };

function furnaceLand() { return typeof window !== 'undefined' && window && window.innerWidth > window.innerHeight; }
function furnaceUrl(name) { return FURNACE_UI.dir + name; }
function furnaceBgUrl() { return furnaceUrl(furnaceLand() ? FURNACE_UI.bg.l : FURNACE_UI.bg.p); }
function furnaceSave() { return typeof isPowerSave === 'function' && !!isPowerSave(); }
// 圖載入狀態 'ok' / 'loading' / 'fail';第一次呼叫才建立 Image(沒有 Image 的環境一律當 loading,畫面走 <img>,失敗由 error 事件回報)
function furnaceImgState(url) {
  var rec = fu.imgs[url], img;
  if (rec) return rec.state;
  rec = fu.imgs[url] = { state: 'loading' };
  try {
    img = new Image();
    img.onload = function () { rec.state = (img.naturalWidth || img.width) > 0 ? 'ok' : 'fail'; if (rec.state === 'fail') furnaceRefresh(); };
    img.onerror = function () { rec.state = 'fail'; furnaceRefresh(); };
    img.src = url;
  } catch (e) { rec.state = 'fail'; }
  return rec.state;
}
function furnaceRefresh() { if (fu.open) furnaceUiRender(); }
// 圖示:有圖用 <img>,缺圖回退文字 / emoji
function furnaceIcon(name, cls, fb, alt) {
  var url = furnaceUrl(name);
  if (furnaceImgState(url) === 'fail') return '<span class="fufb ' + cls + '" role="img" aria-label="' + alt + '">' + fb + '</span>';
  return '<img class="' + cls + '" src="' + url + '" alt="' + alt + '" draggable="false">';
}
function furnaceGainIcon(n) { return n >= FURNACE_UI.gainL ? 'shard_l.webp' : (n >= FURNACE_UI.gainM ? 'shard_m.webp' : 'shard_s.webp'); }
// 目前該顯示第幾幀:熔鍊中依序列;否則 0 待機,有選卡則 1 預熱 / 2 燃燒
function furnaceFrame(sum) {
  if (fu.run) return fu.run.seq[fu.run.i];
  if (!sum || !sum.n) return 0;
  return (sum.n >= FURNACE_UI.bigN || sum.raw >= FURNACE_UI.bigShards) ? 2 : 1;
}
function furnacePick(cs) {
  var sel = (typeof cuRosterSelIds === 'function' && typeof cu !== 'undefined') ? cuRosterSelIds(cs) : [];
  if (sel.length) return { ids: sel, src: 'sel' };
  return { ids: cardsBagPick(cs, fu.ble), src: 'le' };
}
function furnaceSum(cs, ids) { var o = cardsFurnaceSum(cs, ids, false); return { n: o.n, raw: o.shards, top: o.top }; }

function furnaceCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('furnaceStyle')) return;
  var st = document.createElement('style');
  st.id = 'furnaceStyle';
  st.textContent = '#furnacePanel{position:fixed;left:0;top:0;right:0;bottom:0;z-index:45;background-color:#2a2420;background-size:cover;background-position:center;background-repeat:no-repeat;color:#f3ead8;font-size:14px;overflow:hidden}#furnacePanel[hidden]{display:none}' +
    '#furnacePanel .fuwrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;background:rgba(14,10,8,.55);padding:env(safe-area-inset-top) 10px env(safe-area-inset-bottom)}' +
    '#furnacePanel .fuhd{flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:48px}#furnacePanel .fuhd b{flex:1 1 auto;font-size:17px}' +
    '#furnacePanel button{min-height:44px;min-width:44px;margin:3px 3px 0 0;padding:4px 12px;border:none;border-radius:6px;background:#3a5a8a;color:#fff;font-size:14px}#furnacePanel button.warn{background:#8a3a3a}#furnacePanel button.on{background:#f0b45a;color:#222}#furnacePanel button[disabled]{opacity:.35}' +
    '#furnacePanel .fubody{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:6px;overflow-y:auto;overscroll-behavior:contain}#furnacePanel.fuland .fubody{flex-direction:row}' +
    '#furnacePanel .fustage{position:relative;flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px}#furnacePanel.fuland .fustage{flex:1 1 40%;min-width:0}' +
    '#furnacePanel .fumain{height:min(40vh,300px);width:auto;max-width:100%;object-fit:contain}#furnacePanel.fuland .fumain{height:min(62vh,300px)}#furnacePanel span.fumain{display:flex;align-items:center;justify-content:center;font-size:96px;height:min(30vh,200px)}' +
    '#furnacePanel .fumelt{position:absolute;left:50%;top:48%;width:64px;height:64px;margin:-32px 0 0 -32px;font-size:48px;line-height:64px;text-align:center;animation:fumelt .75s ease-in infinite}@keyframes fumelt{0%{transform:translateY(-70px) scale(1);opacity:1}100%{transform:translateY(10px) scale(.4);opacity:.2}}' +
    '#furnacePanel.fusave .fumelt{animation:none}' +
    '#furnacePanel .fures{position:absolute;left:50%;top:26%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;font-size:22px;font-weight:bold;color:#ffe08a;text-shadow:0 1px 3px #000;animation:fufly 1.4s ease-out both}@keyframes fufly{0%{transform:translate(-50%,40px);opacity:0}25%{opacity:1}100%{transform:translate(-50%,-6px);opacity:1}}#furnacePanel.fusave .fures{animation:none}' +
    '#furnacePanel .fugain{width:48px;height:48px;object-fit:contain}#furnacePanel .fustate{font-size:12px;opacity:.85}' +
    '#furnacePanel .fuctl{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;padding-bottom:8px}#furnacePanel .fusec{margin:8px 0 2px;font-size:12px;opacity:.75}#furnacePanel .fures2,#furnacePanel .furow{display:flex;align-items:center;flex-wrap:wrap;gap:4px}' +
    '#furnacePanel .fuico{width:32px;height:32px;object-fit:contain;vertical-align:middle}#furnacePanel span.fuico{display:inline-flex;align-items:center;justify-content:center;font-size:24px}#furnacePanel .fuwarn{color:#f0a060}#furnacePanel .fumsg{margin-top:4px}';
  document.head.appendChild(st);
}
function furnaceUiHtml(cs) {
  var P = furnacePick(cs), sum = furnaceSum(cs, P.ids), land = furnaceLand(), frame = furnaceFrame(sum), X = CARD_FURNACE.exchange, left = cardsExchangeLeft(cs, Date.now()), h = '', shards = fu.run ? fu.run.shown : cs.shards, running = !!fu.run;
  var stateTxt = running ? ['', '', '燃燒中…', '熔鍊中…', '熔鍊完成', '冷卻'][frame] || '' : (frame === 0 ? '待機:選擇要熔鍊的卡' : (frame === 1 ? '預熱' : '燃燒預備'));
  h += '<div class="fuwrap"><div class="fuhd"><b>🔥 卡片熔爐</b><button data-a="fcards">前往卡包</button><button data-a="fclose" aria-label="關閉">✕</button></div><div class="fubody">';
  h += '<div class="fustage">' + furnaceIcon('furnace_' + frame + '.webp', 'fumain', '🔥', '熔爐');
  if (running && (frame === 2 || frame === 3)) h += '<span class="fumelt">' + furnaceIcon('card_melt.webp', 'fuico', '🃏', '熔卡') + '</span>';
  if (fu.result && fu.result.show) h += '<div class="fures">' + furnaceIcon(furnaceGainIcon(fu.result.gain), 'fugain', '💠', '碎片') + '<span>+' + fu.result.gain + '</span></div>';
  h += '<div class="fustate">' + stateTxt + '</div></div><div class="fuctl">';
  h += '<div class="furow">' + furnaceIcon('shard_crate.webp', 'fuico', '📦', '碎片箱') + '<span>碎片 <b>' + shards + '</b></span>&nbsp;' + furnaceIcon('nameticket.webp', 'fuico', '🎫', '指名券') + '<span>指名券 <b>' + (cs.nameTokens | 0) + '</b></span></div>';
  h += '<div class="fusec">放入要熔的卡(' + (P.src === 'sel' ? '使用卡包內勾選的卡;名人不入' : '點品階一鍵挑選,再點取消;名人不入,需到卡包詳情手動熔') + ')</div>';
  if (P.src === 'sel') h += '<div class="furow"><button data-a="fselclr"' + (running ? ' disabled' : '') + '>清除勾選,改用品階</button></div>';
  else h += '<div class="furow">' + FURNACE_LE.map(function (e) { return '<button' + (fu.ble === e[0] ? ' class="on"' : '') + ' data-a="fle" data-v="' + e[0] + '">品階 ≤ ' + e[1] + '</button>'; }).join('') + '</div>';
  h += '<div class="furow"><span>預覽:<b>' + sum.n + '</b> 張,可得 <b>' + sum.raw + '</b> 碎</span></div>';
  if (fu.pend) h += '<div class="fuwarn">' + fu.pend.text + '</div><div class="furow"><button data-a="fno">否</button><button class="warn" data-a="fyes">是,熔鍊</button></div>';
  else h += '<div class="furow"><button class="warn" data-a="fmelt"' + (sum.n && !running ? '' : ' disabled') + '>熔鍊(' + sum.n + ' 張)</button></div>';
  if (fu.msg) h += '<div class="fumsg">' + fu.msg + '</div>';
  h += '<div class="fusec">碎片兌換(' + X.shards + ' 碎 = 1 張指名券;本週還可換 ' + left + '/' + X.weekMax + ' 張)</div>';
  h += '<div class="furow">' + furnaceIcon('nameticket.webp', 'fuico', '🎫', '指名券') + '<button data-a="fex"' + (left > 0 && cs.shards >= X.shards && !running ? '' : ' disabled') + '>兌換指名券 ×1(' + X.shards + ' 碎)</button></div>';
  h += '<div class="fusec">碎片也用於名冊詳情的強化(升星)與請回流浪名人;自動熔爐、篩選與單張熔鍊在卡包頁。</div>';
  return h + '</div></div></div>';
}
function furnaceUiRender() {
  var el = fu.el, cs, url;
  if (!el) return;
  cs = (typeof cuCs === 'function') ? cuCs() : cardsGet();
  if (!cs) { el.innerHTML = '<div class="fuwrap"><div class="fuhd"><b>🔥 卡片熔爐</b><button data-a="fclose">✕</button></div><div>卡牌系統尚未開放</div></div>'; return; }
  url = furnaceBgUrl();
  el.className = (furnaceLand() ? 'fuland' : 'fuport') + (furnaceSave() ? ' fusave' : '');
  el.style.backgroundImage = furnaceImgState(url) === 'fail' ? 'none' : 'url(' + url + ')';
  el.innerHTML = furnaceUiHtml(cs);
}
function furnaceStop() { if (fu.tm && typeof clearTimeout === 'function') clearTimeout(fu.tm); fu.tm = 0; fu.run = null; }
function furnaceEnsure() {
  var el;
  if (fu.el) return fu.el;
  if (typeof document === 'undefined' || !document.body) return null;
  furnaceCss();
  el = document.createElement('div');
  el.id = 'furnacePanel';
  el.hidden = true;
  el.addEventListener('click', furnaceClick);
  document.body.appendChild(el);
  fu.el = el;
  if (typeof panelRegister === 'function') panelRegister('furnace', { kind: 'big', el: el, close: function () { furnaceUiClose(true); } });
  if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function' && !fu.bound) { fu.bound = true; window.addEventListener('resize', furnaceRefresh); }
  return el;
}
function furnaceUiOpen() {
  var el = furnaceEnsure();
  if (!el) return;
  furnaceStop();
  fu.open = true; fu.pend = null; fu.msg = ''; fu.result = null;
  if (typeof panelOpen === 'function') { try { panelOpen('furnace'); } catch (e) { /* 略過 */ } }
  furnaceImgState(furnaceBgUrl());
  furnaceUiRender();
  el.hidden = false;
}
function furnaceUiClose(fromMgr) {
  if (!fu.open && !(fu.el && !fu.el.hidden)) return;
  furnaceStop();
  fu.open = false; fu.pend = null; fu.result = null;
  if (fu.el) fu.el.hidden = true;
  if (!fromMgr && typeof panelClose === 'function') { try { panelClose('furnace'); } catch (e) { /* 略過 */ } }
}
function furnaceUiToggle() { if (fu.open) furnaceUiClose(); else furnaceUiOpen(); }
// 點擊掛點:ui.js tapObjectAt 呼叫;是卡片熔爐建築就開面板並回傳 true
function furnaceUiTap(o) {
  if (!o || o.type !== 'furnace_card') return false;
  furnaceUiToggle();
  return true;
}

// 熔鍊流程:先照卡包頁規則決定是否需要確認(多張或藍以上),確認後 furnaceDo 呼叫引擎,再播動畫
function furnaceAsk(cs) {
  var P = furnacePick(cs), s = furnaceSum(cs, P.ids), g;
  if (!s.n) { fu.msg = '沒有可熔鍊的卡'; return; }
  if (s.n > 1 || s.top >= 2) {
    g = CARD_GRADE[s.top] ? CARD_GRADE[s.top].name : '';
    fu.pend = { ids: P.ids, text: '確定熔鍊 ' + s.n + ' 張(最高 ' + g + '階)?可得 ' + s.raw + ' 碎片。熔鍊後無法復原。' };
    return;
  }
  furnaceDo(cs, P.ids);
}
function furnaceDo(cs, ids) {
  var before = cs.shards, r = cardsBagDissolve(cs, ids, { figOk: false, now: Date.now() }), seq;
  fu.pend = null;
  if (!r.ok) { fu.msg = (typeof CU_BAG_MSG !== 'undefined' && CU_BAG_MSG[r.reason]) || '無法熔鍊'; return; }
  if (typeof cu !== 'undefined' && cu.bsel) ids.forEach(function (id) { delete cu.bsel[id]; });
  if (typeof cuSave === 'function') cuSave();
  fu.msg = '熔鍊 ' + r.n + ' 張,得碎片 ' + r.shards + '(現有 ' + cs.shards + ')';
  fu.result = { gain: r.shards, show: false };
  seq = furnaceSave() ? FURNACE_SEQ_SAVE : FURNACE_SEQ;
  fu.run = { seq: seq, i: 0, shown: before };
  furnaceStep(cs);
}
function furnaceStep(cs) {
  var run = fu.run, f;
  if (!run) return;
  f = run.seq[run.i];
  if (f >= 4 || run.i === run.seq.length - 1) { run.shown = cs.shards; if (fu.result) fu.result.show = true; }
  furnaceUiRender();
  fu.tm = (typeof setTimeout === 'function') ? setTimeout(function () {
    fu.tm = 0;
    if (!fu.run) return;
    fu.run.i++;
    if (fu.run.i >= fu.run.seq.length) { fu.run = null; furnaceUiRender(); return; }
    furnaceStep(cs);
  }, furnaceSave() ? FURNACE_UI.stepMsSave : FURNACE_UI.stepMs) : 0;
}
function furnaceClick(ev) {
  var b = ev.target, a, cs, v, r, X;
  while (b && b !== fu.el && !(b.getAttribute && b.getAttribute('data-a'))) b = b.parentNode;
  if (!b || b === fu.el) return;
  a = b.getAttribute('data-a'); v = b.getAttribute('data-v');
  if (a === 'fclose') { furnaceUiClose(); return; }
  if (a === 'fcards') { furnaceUiClose(); if (typeof cardsUiOpen === 'function') cardsUiOpen('R'); return; }
  cs = (typeof cuCs === 'function') ? cuCs() : cardsGet();
  if (!cs || fu.run) return;
  fu.msg = ''; fu.result = null;
  if (a === 'fle') { v = Math.max(0, Math.min(3, +v | 0)); fu.ble = fu.ble === v ? -1 : v; fu.pend = null; }   // 再點同一品階 = 取消選取(回待機)
  else if (a === 'fselclr') { if (typeof cu !== 'undefined') cu.bsel = {}; fu.pend = null; }
  else if (a === 'fmelt') furnaceAsk(cs);
  else if (a === 'fno') fu.pend = null;
  else if (a === 'fyes') { if (fu.pend) furnaceDo(cs, fu.pend.ids); }
  else if (a === 'fex') {
    X = CARD_FURNACE.exchange;
    r = cardsExchange(cs, 1, Date.now());
    fu.msg = r.ok ? '兌換指名券 +1(花 ' + r.shards + ' 碎)' : (r.reason === 'week' ? '本週兌換已達上限' : '碎片不足(需 ' + (r.need || X.shards) + ')');
    if (r.ok && typeof cuSave === 'function') cuSave();
  }
  if (!fu.run) furnaceUiRender();
}
