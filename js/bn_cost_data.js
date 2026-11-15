// js/bn_cost_data.js — 武將統御(cost)與一隊上限(設計_站位目標與布陣教學.md W7;試排依據 戰鬥設計_討論紀錄.md「武將 cost 與隊伍上限」11/13)。純資料 + 純函式,不讀 DOM。ES2017;不用 ?. ??。
// 名人 cost 照試排表(2~8);沒列的名人與路人卡依品階 byGr(白 2、青 2、藍 3、紫 4、金 6)。一隊 cost 總和不可超過 cap。
// 11/13 使用者調整:劉備 / 韓當 / 關羽 / 呂布 = 8,夏侯惇 = 7,曹仁 = 6。數值為試排,戰法改了要重量。
// 全域:BN_FIG_COST BN_COST_CFG bnCostOf bnTeamCost bnCostCap
var BN_COST_CFG = { cap: 20, byGr: [2, 2, 3, 4, 6] };
var BN_FIG_COST = {
  liubei: 8, handang: 8, lvbu: 8, guanyu: 8,
  xiahoudun: 7, sunce: 7, sunjian: 7, zhouyu: 7, mizhu: 7,
  hanhao: 6, xurong: 6, huaxiong: 6, dongzhuo: 6, zhangyan: 6, xiahouyuan: 6, huangfusong: 6, zhaoyun: 6, huanggai: 6, zhangbao: 6, caoren: 6,
  dengmao: 5, sunben: 5, liaohua: 5, sunjing: 5, zhoucang: 5, dianwei: 5, chengpu: 5, xunyu: 5, zhangjiao: 5, zhangfei: 5, caocao: 5, jianyong: 5,
  peiyuanshao: 4, chengyuanzhi: 4, zhangkai: 4, renjun: 4, boca: 4,
  caoxing: 3, zoujing: 3, caohong: 3, tianyu: 3, shihuan: 3, wujing: 3, mifang: 3, weizi: 3, zhangmancheng: 3, lvfan: 3, lidian: 3, guosi: 3, zhuzhi: 3, lijue: 3, sunqian: 3, zumao: 3,
  heyi: 2
};
function bnCostCap() { return BN_COST_CFG.cap; }
// 單張卡的 cost:e = 名冊卡({fig, gr});名人查表,沒表值或路人卡依品階
function bnCostOf(e) {
  var g;
  if (!e) return 0;
  if (e.fig && typeof BN_FIG_COST[e.fig] === 'number') return BN_FIG_COST[e.fig];
  g = e.gr | 0;
  if (g < 0) g = 0;
  if (g >= BN_COST_CFG.byGr.length) g = BN_COST_CFG.byGr.length - 1;
  return BN_COST_CFG.byGr[g];
}
// 一隊 cost 合計。slots = [{id}];lookup(id) 回名冊卡,預設用 bnUiEntry;找不到的人算 0
function bnTeamCost(slots, lookup) {
  var f = lookup || ((typeof bnUiEntry === 'function') ? bnUiEntry : function () { return null; }), t = 0;
  (slots || []).forEach(function (s) { t += bnCostOf(s && f(s.id)); });
  return t;
}
