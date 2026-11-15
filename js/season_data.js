// js/season_data.js — 賽季(4 週軟重置)資料表(設計_賽季_規格.md 第 6、8、10 節)。純資料,不碰 DOM / 存檔。數值全部 PLACEHOLDER,集中在 SEASON_CFG,最後統一調平衡。
// 全域:SEASON_THEME SEASON_ON SEASON_CFG。載入順序:ld_open_ev.js 之前(evSeasonStart 會呼叫 seasonStart)。ES2017,不用 ?. ??。

var SEASON_THEME = '黃巾之亂';

// 休眠旗標:false = 賽季核心不啟動(seasonTick 直接回 {off:true},evSeasonStart 沿用舊行為);要上線時改 true 並接好 ldoBoot 呼叫(S5)。測試可在 vm 內覆寫。
var SEASON_ON = false;

var SEASON_CFG = {
  DAY: 86400000, HOUR: 3600000, tz: 8 * 3600000,    // 週一 00:00 以東八區計
  days: 28,                                          // 一季天數(= EV_CFG.seasonDays = STUDY_CFG.seasonDays,測試檢查相等)
  catchDay: 9, catchMul: 1.25,                       // 新手追趕:第 9 天起主城經驗 ×1.25(PLACEHOLDER)
  cityDay: { county: 1, jun: 8, pass: 15 },          // 縣郡關口分週開放的季內日(S2 的 wdCityOpen 讀這裡)
  warnDay: 26,                                       // 第 26 天起顯示季末倒數橫幅
  pRef: 5000,                                        // 標準玩家季末勢力(PLACEHOLDER;首頁經營規格定案後填)
  clockSlack: 5 * 60000,                             // 時鐘倒退容忍(超過就凍結)
  throttleMs: 60000,                                 // seasonTick 節流
  // 9 個 NPC 勢力(黃巾之亂):side 'han' 漢軍 / 'yt' 黃巾渠帥(只有 yt 會被分配縣郡關口,見 8.1);k = 季末勢力係數
  npc: [
    { id: 'hf', name: '皇甫嵩', side: 'han', k: 1.6 },
    { id: 'zj', name: '張角', side: 'yt', k: 1.35 },
    { id: 'zz', name: '朱儁', side: 'han', k: 1.2 },
    { id: 'ls', name: '盧植', side: 'han', k: 1.1 },
    { id: 'zb', name: '張寶', side: 'yt', k: 1.0 },
    { id: 'dz', name: '董卓', side: 'han', k: 0.9 },
    { id: 'bc', name: '波才', side: 'yt', k: 0.8 },
    { id: 'zm', name: '張曼成', side: 'yt', k: 0.65 },
    { id: 'bj', name: '卜己', side: 'yt', k: 0.5 }
  ],
  cityHit: { county: 0.06, jun: 0.12, pass: 0.09 },  // 玩家攻下該類城時,原主 NPC 扣 pRef × 此值
  // 名次獎勵:max = 名次上限(含);只給保留類(抽數 / 碎片 / 材料)
  rankGive: [
    { max: 1, pulls: 20, shards: 60, mats: { m_soul: 1, m_whet: 3 } },
    { max: 3, pulls: 15, shards: 40, mats: { m_whet: 3 } },
    { max: 6, pulls: 10, shards: 25, mats: { m_whet: 2 } },
    { max: 10, pulls: 5, shards: 15, mats: { m_whet: 1 } }
  ],
  startRes: { grain: 0 }, // 新季起始資源(homeSeasonStartRes 不存在時用)
  histMax: 12, pendMax: 8, partKeep: 3,
  foeWeekMul: 1                                       // 城池守軍隨週變強倍率(本版留 1)
};
