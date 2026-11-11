// js/cityonly.js — 城建專注模式:暫時隱藏釣魚、仙獸、戰鬥相關入口,專心蓋城(可一鍵還原)。
// 載入順序:progdata.js 之後、prog.js 之前(index.html、sw.js PRECACHE 同步)。
// 只影響「入口顯示」與「進度條件」,不改存檔資料格式、不刪任何戰鬥 / 釣魚 / 仙獸程式與資料。
// 還原方式:設定 → 畫面 →『城建專注模式』關閉;或把下面 CITY_ONLY 改成 false(新玩家預設值);或 localStorage 'lorddomain.cityonly' = '0'。
// 隱藏機制:isUnlocked('feature', id) 對 CITY_HIDE_FEATURES 回傳 false(重用既有功能閘門),另在左下角 / 出征 / 戰鬥布置等入口加判斷。
// 全域名稱:CITY_ONLY CITY_ONLY_KEY CITY_HIDE_FEATURES CITY_HIDE_TOP isCityOnly setCityOnly cityOnlyHides cityOnlyTopHidden cityOnlySync。
// ES2017;不用 ?. ??。

var CITY_ONLY_KEY = 'lorddomain.cityonly';
var CITY_ONLY = true;   // 預設值:開(使用者要求現在就隱藏)。localStorage 有設定時以設定為準
// 城建專注模式下 isUnlocked('feature', id) 一律回 false 的功能 id(對照 progdata.js PROG_UNLOCK_FEATURE)
var CITY_HIDE_FEATURES = ['fishing', 'pet', 'battleDesign', 'npc', 'sandbox', 'tplCamp', 'report', 'ghost', 'modDraw', 'friend', 'spar', 'random', 'replayFeed', 'campSlots'];
var CITY_HIDE_TOP = ['mil'];   // 隱藏的建築頂層分類(軍事建築:只服務出征容量)

var cityOnlyVal = null;   // 快取;null = 尚未讀取

function cityOnlyRead() {
  var raw = null;
  try { raw = localStorage.getItem(CITY_ONLY_KEY); } catch (e) { raw = null; }
  if (raw === '0') return false;
  if (raw === '1') return true;
  return !!CITY_ONLY;
}

function isCityOnly() {
  if (cityOnlyVal === null) cityOnlyVal = cityOnlyRead();
  return cityOnlyVal;
}

// 設定開關:寫入 localStorage、更新 body class、收回戰鬥畫面;不動任何存檔資料
function setCityOnly(v) {
  cityOnlyVal = !!v;
  try { localStorage.setItem(CITY_ONLY_KEY, cityOnlyVal ? '1' : '0'); } catch (e) { /* 寫入失敗:本次 session 靠記憶體 */ }
  // 重設功能閘門的前次狀態,避免切換模式時誤跳「城市 N 級開放」提示
  if (typeof featOpenPrev === 'object' && featOpenPrev) Object.keys(featOpenPrev).forEach(function (k) { delete featOpenPrev[k]; });
  cityOnlySync();
  return cityOnlyVal;
}

// 此功能 id 在城建專注模式下是否隱藏
function cityOnlyHides(id) {
  if (id === 'fishing') return !featureOn('fishing');   // @DORMANT fishing:釣魚入口由旗標控制(v60 預設關;程式與存檔保留)
  if (id === 'pet') return true;   // 仙獸苑:使用者決定永久隱藏入口(程式與存檔保留),不受城建專注開關影響
  return isCityOnly() && CITY_HIDE_FEATURES.indexOf(id) >= 0;
}

// 此建築頂層(ui.js TOP_LIST id)是否隱藏
function cityOnlyTopHidden(id) {
  return isCityOnly() && CITY_HIDE_TOP.indexOf(id) >= 0;
}

// 套用到畫面:body class(CSS 保險隱藏)+ 若還停在戰鬥布置畫面就切回經營。可重複呼叫
function cityOnlySync() {
  var on = isCityOnly();
  if (typeof document !== 'undefined' && document.body && document.body.classList) document.body.classList.toggle('city-only', on);
  if (on && typeof game !== 'undefined' && game && game.mode === 'battleDesign' && typeof setBoardMode === 'function') {
    try { setBoardMode('estate'); } catch (e) { console.warn('[cityonly] 切回經營失敗', e); }
  }
  if (on && typeof cornerFightClose === 'function') cornerFightClose();
}

if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cityOnlySync);
  else cityOnlySync();
}
