// js/furnaceui.js — 卡片熔爐的建築入口(2026-11-10 整併):獨立的全螢幕熔爐面板已移除,熔爐功能統一在卡片面板『熔爐』分頁(cardsui_furnace.js)。
// 本檔只保留點擊熔爐建築(ui.js tapObjectAt → furnaceUiTap)與舊呼叫端的導向:開啟 / 關閉 / 切換都走卡片面板的 F 分頁。不發聲。ES2017;不用 ?. ??。
// 全域名稱:furnaceUiOpen furnaceUiClose furnaceUiToggle furnaceUiTap furnaceUiRender
function furnaceUiOpen() { if (typeof cardsUiOpen === 'function') cardsUiOpen('F'); }
function furnaceUiClose(fromMgr) { if (typeof cardsUiClose === 'function') cardsUiClose(fromMgr); }
function furnaceUiToggle() {
  if (typeof cu !== 'undefined' && cu.open && cu.tab === 'F') furnaceUiClose();
  else furnaceUiOpen();
}
// 點擊掛點:ui.js tapObjectAt 呼叫;是卡片熔爐建築就開熔爐分頁並回傳 true
function furnaceUiTap(o) {
  if (!o || o.type !== 'furnace_card') return false;
  furnaceUiToggle();
  return true;
}
function furnaceUiRender() { if (typeof cu !== 'undefined' && cu.open && typeof cardsUiRender === 'function') cardsUiRender(); }
