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
  world: true,         // 地圖(wd_core.js / wd_ui.js:資源採集 / 野怪集結 / 攻城;shell 的「地圖」入口);關閉時入口退回舊外勤 wmOpen(2026-11-13)
  bigmap: false,       // 大地圖(尚未接入;只登錄,無守衛)
  ldui: true,          // 新介面骨架(js/ld_nav.js 頁面堆疊 + 新首頁 / 武將詳情 / 整隊 / 舊頁接入堆疊;設計_介面骨架實作計畫.md);第 6 階段整合完成後預設開(2026-11-14);網址 ?ldui=0 還原舊首頁、?ldui=1 開,或 localStorage lorddomain.feature.ldui 覆寫
  goods_panel: false,  // 舊庫房面板(goods.js #goodsPanel:貨品 / 材料 / 鏈條 / 生產;已移出背包與頂列,2026-11-15 休眠;goods 資料與存檔保留)
  tower: false,        // 試煉塔(首頁木牌、ld_tower 頁、首通名聲、賽季塔層同步;併入 49 格大地圖戰鬥,暫時關閉;程式與存檔 lorddomain.tower.v1 保留;主線 12 已改成地圖戰鬥計數,不再依賴本旗標)
  grid49: false,       // 大地圖 19×19(設計_49格地圖_整合規格.md;js/wd_grid_data.js 資料表已載入、尚無任何程式引用;K / B 包完成接入前保持關閉)
  shell: true          // 新主畫面外殼 App Shell(js/shell.js、css/shell.css;B 包 S0/S1)預設開(2026-11-12 純卡牌版);網址 ?shell=1 / ?shell=0 或 localStorage lorddomain.feature.shell 覆寫
};
var FEATURES_WARNED = {};
// 外殼 shell 開啟 = 城市執行期全停(城市繪製、城市 tick、城市頂列與計時器);卡牌 / 道具 / 外勤 / 擂台 / 戰役不受影響。
function cityRuntimeOff() { return featureOn('shell'); }
// 瀏覽器載入時讀取覆寫:?shell=1|0 優先,其次 localStorage('1' / '0')。測試環境無 window 時不動作。讀寫失敗一律忽略。
function featureLoadOverrides() {
  var v = null, s = '', m, ls;
  try { if (typeof window !== 'undefined' && window && window.location) s = String(window.location.search || ''); } catch (e) { s = ''; }
  m = /[?&]shell=([01])/.exec(s);
  if (m) v = m[1] === '1';
  else {
    try { ls = (typeof localStorage !== 'undefined' && localStorage && localStorage.getItem) ? localStorage.getItem('lorddomain.feature.shell') : null; } catch (e2) { ls = null; }
    if (ls === '1' || ls === '0') v = ls === '1';
  }
  if (v !== null) FEATURES.shell = v;
  featureLoadOverride2('ldui', s);
}
// 其他旗標覆寫(同 shell 的做法):?名稱=1|0 優先,其次 localStorage('lorddomain.feature.名稱' = '1' / '0')
function featureLoadOverride2(name, search) {
  var v = null, m = new RegExp('[?&]' + name + '=([01])').exec(search), ls;
  if (m) v = m[1] === '1';
  else {
    try { ls = (typeof localStorage !== 'undefined' && localStorage && localStorage.getItem) ? localStorage.getItem('lorddomain.feature.' + name) : null; } catch (e) { ls = null; }
    if (ls === '1' || ls === '0') v = ls === '1';
  }
  if (v !== null) FEATURES[name] = v;
}
if (typeof window !== 'undefined') featureLoadOverrides();
// 未知名稱回 false 並只警告一次(避免拼錯名稱時靜默失效)
function featureOn(name) {
  if (Object.prototype.hasOwnProperty.call(FEATURES, name)) return !!FEATURES[name];
  if (!FEATURES_WARNED[name]) {
    FEATURES_WARNED[name] = true;
    if (typeof console !== 'undefined' && console.warn) console.warn('featureOn: 未知功能名稱 ' + name);
  }
  return false;
}
