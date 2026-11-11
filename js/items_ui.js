// js/items_ui.js — 道具頁籤(卡包分頁 R 頂部『卡片 | 道具』的『道具』子頁;最小版,沿用現有卡包分頁,不做新外殼)。
// 格子 6 欄、最少 24 格(空格虛線);有紅點的格子(禮包持有中一律紅點,直到使用;其他未查看)、『道具』子頁鈕、卡包分頁標題右上紅點;點格子彈出置中小選單(道具名 / 說明 / 『使用』『詳情』『取消』),點『使用』才執行 itemUse,結果 toast。
// 側欄『卡片』鈕紅點與進遊戲一次性的新禮包提示 toast:itemsSyncDots()(ui.js syncSideBar 每次同步呼叫)。
// 狀態 IU:sub 'card' / 'item'、pick 選單中的道具 id、det 選單是否顯示詳情。cardsui_roster.js 的 cuRosterPageHtml / cuRosterClick 掛點;點擊動作 cuItemsClick(由 cuRosterClick 先呼叫)。
// 紅點一律用行內樣式(不依賴 CSS 注入時機)。ES2017;不用 ?. ??。
// 全域名稱:IU IU_COLS IU_MIN_CELLS itemsUiCss itemsDotHtml itemsSubBarHtml itemsCellHtml itemsTabHtml itemsPopHtml cuItemsClick itemsSyncDots iuMarkDot

var IU = { sub: 'card', pick: null, det: false };
var IU_COLS = 6;
var IU_MIN_CELLS = 24;
var IU_DOT_STYLE = 'display:inline-block;width:8px;height:8px;border-radius:50%;background:#e04b4b;margin-left:3px;vertical-align:middle';

function itemsUiCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('iuStyle')) return;
  var st = document.createElement('style');
  st.id = 'iuStyle';
  st.textContent = '#cardsPanel .cutab{position:relative}' +
    '#cardsPanel .iusub{display:flex;gap:4px;margin:0 0 6px}#cardsPanel .iusub button{flex:1 1 0;min-width:0}#cardsPanel .iusub button.on{background:#f0b45a;color:#222}' +
    '#cardsPanel .iugrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;margin-top:6px}' +
    '#cardsPanel .iucell{position:relative;min-width:0;min-height:58px;padding:2px 1px;border-radius:6px;border:2px solid var(--iuc,#777);background:rgba(128,128,128,.14);color:#eee;font-size:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;overflow:hidden;box-sizing:border-box}' +
    '#cardsPanel .iucell.empty{border-style:dashed;border-color:rgba(255,255,255,.3);background:none;opacity:.45;cursor:default}' +
    '#cardsPanel .iuk{display:block;width:28px;height:22px;border-radius:4px;background:var(--iuc,#777);color:#fff;font-weight:bold;line-height:22px;text-align:center;font-size:12px}' +
    '#cardsPanel .iun{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#cardsPanel .iuq{font-size:10px;font-weight:bold;line-height:1.1}' +
    '#cardsPanel .iuov{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:7;padding:16px;box-sizing:border-box}' +
    '#cardsPanel .iubox{width:min(280px,100%);box-sizing:border-box;padding:12px;border-radius:10px;background:#2a2722;color:#eee;box-shadow:0 4px 18px rgba(0,0,0,.6)}' +
    '#cardsPanel .iubox h4{margin:0 0 6px;font-size:16px}#cardsPanel .iubox .iubtns{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}#cardsPanel .iubox button.cub{flex:1 1 auto;min-width:72px}';
  document.head.appendChild(st);
}
// 紅點(行內樣式):有未查看道具才有
function itemsDotHtml() { return itemHasNew() ? '<i class="iudot" style="' + IU_DOT_STYLE + '"></i>' : ''; }
function itemsSubBarHtml() {
  itemsUiCss();
  return '<div class="iusub"><button class="cub' + (IU.sub === 'card' ? ' on' : '') + '" data-a="isub" data-v="card">卡片</button>' +
    '<button class="cub' + (IU.sub === 'item' ? ' on' : '') + '" data-a="isub" data-v="item">道具' + itemsDotHtml() + '</button></div>';
}
// 一格:已知道具(類別色塊 + 名字第一字 + 名稱 + 數量角標;紅點依 itemList 的 dot)
function itemsCellHtml(e) {
  if (!e) return '<div class="iucell empty" aria-hidden="true"></div>';
  return '<button class="iucell" style="--iuc:' + cuEsc(e.color) + '" data-a="iopen" data-id="' + cuEsc(e.id) + '" aria-label="' + cuEsc(e.name) + ' ×' + e.n + '">' +
    (e.dot ? '<i class="iudot" style="position:absolute;right:3px;top:3px;width:8px;height:8px;border-radius:50%;background:#e04b4b"></i>' : '') +
    '<span class="iuk">' + cuEsc(e.name.charAt(0)) + '</span><span class="iun">' + cuEsc(e.name) + '</span><span class="iuq">×' + e.n + '</span></button>';
}
// 道具頁籤主體:說明 + 格子(持有道具排在前,其餘補空格;最少 IU_MIN_CELLS 格)
function itemsTabHtml() {
  var list = itemList(), total, cells = '', i;
  itemsUiCss();
  total = Math.max(IU_MIN_CELLS, Math.ceil(list.length / IU_COLS) * IU_COLS);
  for (i = 0; i < total; i++) cells += itemsCellHtml(i < list.length ? list[i] : null);
  return '<div class="cusub">道具是要點開才生效的東西(新手禮包、任務令、活動券…)。文、抽數、碎片是貨幣,在頂列與抽卡頁,不在這裡。點一格看說明,按『使用』才生效。</div>' +
    '<div class="iugrid">' + cells + '</div>';
}
function itemsEffectText(d) {
  if (d.effect === 'pulls') return '大池 +' + CARD_GIFT.pulls + ' 抽(入大池,不受上限截斷)';
  return '占位提示(效果尚未接上)';
}
// 選單(置中浮層):說明 / 詳情切換;『使用』只在可使用且持有時可按
function itemsPopHtml() {
  var d = IU.pick ? itemDef(IU.pick) : null, n, body, cat = '', i, use;
  if (!d) return '';
  n = itemCount(d.id);
  for (i = 0; i < ITEM_CATS.length; i++) if (ITEM_CATS[i][0] === d.cat) cat = ITEM_CATS[i][1];
  if (IU.det) body = '<div class="cusub" style="opacity:1">類別:' + cuEsc(cat) + '</div><div class="cusub" style="opacity:1">堆疊上限:' + (d.max || ITEMS_STACK_DEF) + '</div><div class="cusub" style="opacity:1">持有:' + n + '</div><div class="cusub" style="opacity:1">使用效果:' + cuEsc(itemsEffectText(d)) + '</div>';
  else body = '<div>' + cuEsc(d.desc) + '</div><div class="cusub" style="opacity:1">持有 ' + n + '</div>';
  use = (d.usable && n > 0) ? '<button class="cub" data-a="iuse" data-id="' + cuEsc(d.id) + '">使用</button>' : '<button class="cub" disabled>使用</button>';
  return '<div class="iuov" data-a="iclose"><div class="iubox" data-a="inone"><h4 style="color:' + cuEsc(d.color) + '">' + cuEsc(d.name) + '</h4>' + body +
    '<div class="iubtns">' + use + '<button class="cub" data-a="idet" data-id="' + cuEsc(d.id) + '">' + (IU.det ? '說明' : '詳情') + '</button><button class="cub" data-a="iclose">取消</button></div></div></div>';
}
// 卡包頁的道具動作(cuRosterClick 先呼叫;不認得回 false)
function cuItemsClick(a, b, cs) {
  var id = b.getAttribute('data-id'), r;
  if (a === 'isub') { IU.sub = b.getAttribute('data-v') === 'item' ? 'item' : 'card'; IU.pick = null; IU.det = false; return true; }
  if (a === 'iopen') {
    if (!itemDef(id) || !(itemCount(id) > 0)) return true;
    IU.pick = id; IU.det = false;
    itemMarkSeen(id);
    return true;
  }
  if (a === 'idet') { IU.det = !IU.det; return true; }
  if (a === 'iclose') { IU.pick = null; IU.det = false; return true; }
  if (a === 'inone') return true;
  if (a === 'iuse') {
    r = itemUse(id);
    IU.pick = null; IU.det = false;
    if (typeof showToast === 'function') showToast(r.msg);
    return true;
  }
  return false;
}
// 側欄『卡片』鈕紅點 + 進遊戲一次性的新禮包提示(ui.js syncSideBar 每次同步呼叫)
function itemsSyncDots() {
  var side, btn;
  if (typeof document === 'undefined' || !document.getElementById) return;
  if (itemsNoticeTake() && typeof showToast === 'function') showToast('已收到新手禮包,到卡包的道具頁籤使用');
  side = document.getElementById('sideBar');
  btn = (side && side.querySelector) ? side.querySelector('.side-btn[data-px="cards"]') : null;
  if (btn) iuMarkDot(btn, itemHasNew());
}
// 在按鈕右上角加 / 去紅點(按鈕本身設為 relative)
function iuMarkDot(host, on) {
  var d = host.querySelector ? host.querySelector('.iudot') : null;
  if (on && !d) {
    d = document.createElement('i');
    d.className = 'iudot';
    d.style.cssText = 'position:absolute;right:3px;top:3px;width:9px;height:9px;border-radius:50%;background:#e04b4b';
    if (!host.style.position) host.style.position = 'relative';
    host.appendChild(d);
  } else if (!on && d && d.parentNode) {
    d.parentNode.removeChild(d);
  }
}
