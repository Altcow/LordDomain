// js/ld_names.js — 玩家看到的名稱統一表(設計_遊戲外殼與流程_規格.md 1.5;S0 新檔,尚無人引用,之後各頁改讀這裡)。全域:LD_NAMES、ldName(key)。ES2017。
var LD_NAMES = {
  recruit: '招募', recruitBld: '招賢館',   // 抽卡(不再叫「抽」、「武將抽卡」)
  heroes: '武將',   // 我的卡(不再叫「武將」、「卡片」)
  codex: '圖鑑',   // 卡冊 / 圖鑑
  team: '部隊',   // 第 1~5 隊(不再叫「隊伍預設」、「編隊」)
  money: '文',   // 錢 / 金幣(ST-16)
  power: '戰力',   // 只在部隊面板 / 部隊頁,頂列不顯示「戰」
  birth: '起兵之地', birthField: '賜福',   // 出生州:頁名 / 登入畫面與主公頁欄位名(不再叫「出身」)
  back: '返回', leave: '離開', skip: '跳過'   // 一般頁「返回」;戰鬥 / 劇情 / 演出用「離開」/「跳過」(不再用 ×、回城)
};
function ldName(key) { return Object.prototype.hasOwnProperty.call(LD_NAMES, key) ? LD_NAMES[key] : key; }
if (typeof module !== 'undefined' && module.exports) module.exports = { LD_NAMES: LD_NAMES, ldName: ldName };
