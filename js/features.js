// js/features.js — 功能開關表(休眠機制,見 tools/dormant_features.md)。
// 載入順序:index.html 第一個 script(data.js 之前);sw.js PRECACHE 同步。純資料 + 純函式,不碰 DOM / 存檔。
// 規則:預設值 true 時行為與未加守衛前完全相同;改 false 即休眠該功能(程式與存檔保留,不刪)。
// 守衛寫法:if (!featureOn('名稱')) return;   // @DORMANT 名稱
// 測試可在載入後覆寫,例:FEATURES.caravan_buy = true。
var FEATURES = {
  cityedit: false,     // 城內建造 / 放置 / 拆除 / 草稿 / 版面存檔 / 清空(B 包休眠)
  citysim: false,      // 城內產出、衛生 / 居民 / 交通 / 採集 tick(B 包休眠)
  interiors: false,    // 建築室內(B 包休眠,程式與存檔保留)
  pet: false,          // 仙獸苑入口(B 包休眠,程式與存檔保留)
  multiworld: false,   // 多世界:頂列「世 NN」、我的世界、新遊戲精靈(B 包休眠)
  caravan_buy: false,  // 走鏢買車 / 車棚添購(開局每種馬車 1 輛)
  tutorial: false,     // 舊新手教學(tutorial.js T0~T11 + 教學卡)整個休眠;新教學待整個開發完成再做(v60)
  fishing: false,      // 釣魚入口(頂列 🎣、側欄、fishEnter)休眠(v60)
  caravan: false,      // 走鏢入口(側欄 🛻、走鏢面板)休眠(v60)
  stages: false,       // 副本(章節 36 關的 bnmap 章節地圖)入口與頭目首殺獎勵休眠;bn_stages 敵將 / 結算仍供外勤與擂台使用(v60)
  worldmap: true,      // 外勤(wm_core.js 外勤清單、戰鬥入口『外勤』鈕)預設開(v60;原為大地圖登錄用,大地圖改用 bigmap)
  bigmap: false        // 大地圖(尚未接入;只登錄,無守衛)
};
var FEATURES_WARNED = {};
// 未知名稱回 false 並只警告一次(避免拼錯名稱時靜默失效)
function featureOn(name) {
  if (Object.prototype.hasOwnProperty.call(FEATURES, name)) return !!FEATURES[name];
  if (!FEATURES_WARNED[name]) {
    FEATURES_WARNED[name] = true;
    if (typeof console !== 'undefined' && console.warn) console.warn('featureOn: 未知功能名稱 ' + name);
  }
  return false;
}
