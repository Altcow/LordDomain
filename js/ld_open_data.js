// js/ld_open_data.js — 開場解鎖・預約・活動 資料表(設計_開場解鎖_預約_活動_定案.md 第二~五節)。純資料,不碰 DOM / 存檔。數值全部 PLACEHOLDER,集中在這裡,最後統一調。
// 全域:UNLOCK_CFG EV_CFG EV_MAIN。載入順序:fame.js / mat.js / res4.js / wd_data.js 之後、ld_open_unlock.js 之前。ES2017,不用 ?. ??。
// @DORMANT ldui:本模組的行為只在旗標 ldui 開啟時生效(各函式內部判斷);關閉時 unlockIs 一律 true,其餘函式不動作。

// 功能開放表(2.1 木牌 + 2.2 功能)。fame = 名聲門檻(null = 無);ev = 事件名(null = 無);start = 1 開局就開;txt = 灰木牌文字(有事件條件時事件優先,所以另寫)
var UNLOCK_CFG = [
  { id: 'draw', label: '招賢館', fame: null, ev: null, start: 1 },
  { id: 'team', label: '軍營', fame: null, ev: null, start: 1 },
  { id: 'gate', label: '城門', fame: null, ev: null, start: 1 },
  { id: 'drill', label: '校場', fame: 50, ev: 'firstBattle', start: 0, txt: '打完第一場戰鬥開放' },
  { id: 'forge', label: '鍛造坊', fame: 500, ev: 'firstMat', start: 0, txt: '拿到第一份鍛造材料開放' },
  { id: 'study', label: '書院', fame: 1200, ev: null, start: 0 },
  { id: 'arena', label: '擂台報名', fame: 1800, ev: null, start: 0 },   // 只擋『報名』(公告 / 自動報名 / 報名鈕,bn_tourney_ui.js bnTourLocked);擂台入口與木牌不鎖,可進去觀看
  { id: 'mapFull', label: '地圖資源', fame: null, ev: 'harvest', start: 0, txt: '打下新手寨並收成開放' },
  { id: 'auto', label: '自動派遣', fame: 100, ev: 'res3', start: 0, txt: '手動打下 3 個資源點開放' },
  { id: 'camp', label: '山寨', fame: 100, ev: null, start: 0 },
  { id: 'beast', label: '野怪與集結', fame: 500, ev: null, start: 0 },
  { id: 'rsv', label: '預約', fame: 1200, ev: 'firstRally', start: 0, txt: '集結打完一次開放' },
  { id: 'event', label: '限時活動', fame: 1200, ev: null, start: 0 },
  { id: 'county', label: '縣', fame: 2500, ev: null, start: 0 },
  { id: 'junpass', label: '郡與關口', fame: 3200, ev: null, start: 0 }
];
// 首頁木牌 id(ld_home.js LD_BLD)→ 解鎖 id。城主府固定「即將開放」,不在此表
var UNLOCK_PLAQUE = { tavern: 'draw', camp: 'team', gate: 'gate', yard: 'drill', forge: 'forge', acad: 'study' };   // 擂台木牌不鎖(入口可進,只有報名要名聲 1800;unlockIs('arena') 仍供報名判斷)

// 賽季末商店(設計_賽季末商店_規格.md 2.10、6.3;SS1 只加資料):false = 七日 / 團結關維持現行獎勵;SS12 / SS4 接線後與 SSHOP_ON 一起開。
var EV_SHOP_ON = false;

var EV_CFG = {
  DAY: 86400000, HOUR: 3600000, tz: 8 * 3600000,
  seasonDays: 28,
  // 新手七日(2.4):每個登入日的抽數;第 7 天另送 1 張自選紫名人。舊存檔(legacy)抽數格改碎片 legacyShards
  // v63:新手禮包開啟即給 2000 抽(CARD_GIFT.pullsNew),七日與主線前 5 條不再給抽數,改等值獎勵(1 抽 = 2 碎片等值)。nbPulls 保留為 0 陣列(UI / 相容)
  nbPulls: [0, 0, 0, 0, 0, 0, 0], nbPickDay: 7, legacyShards: 30,
  // 七日各天等值獎勵(取代原抽數 300/300/300/300/250/250 = 1700 抽 → 3400 碎片等值):第 2~5 天各 600、第 6~7 天各 500
  nbGive: [null, { shards: 406, mats: { m_iron3: 4, m_hide3: 4, m_whet: 8, m_iron4: 1, m_hide4: 1, m_soul: 2 } }, { shards: 406, mats: { m_iron3: 4, m_hide3: 4, m_whet: 8, m_iron4: 1, m_hide4: 1, m_soul: 2 } }, { shards: 406, mats: { m_iron3: 4, m_hide3: 4, m_whet: 8, m_iron4: 1, m_hide4: 1, m_soul: 2 } }, { shards: 406, mats: { m_iron3: 4, m_hide3: 4, m_whet: 8, m_iron4: 1, m_hide4: 1, m_soul: 2 } }, { shards: 331, mats: { m_iron3: 4, m_hide3: 4, m_whet: 8, m_iron4: 1, m_hide4: 1, m_soul: 1 } }, { shards: 331, mats: { m_iron3: 4, m_hide3: 4, m_whet: 8, m_iron4: 1, m_hide4: 1, m_soul: 1 } }],
  // 等值換算表(碎片等值):白名人分解期望約 5 碎/抽,保守取 2;材料價 礪石 5、百鍊鋼/虎皮 8、玄鐵/玄龜甲 20、精魄 25
  valueRate: { pull: 2, shard: 1, m_whet: 5, m_iron3: 8, m_hide3: 8, m_iron4: 20, m_hide4: 20, m_soul: 25 },
  nbExtra: { 1: { grain: 1000 }, 2: { grain: 1000 }, 3: { grain: 1000 }, 4: { grain: 1000 }, 5: { grain: 1000 }, 6: { grain: 1000 }, 7: { grain: 1000 } },   // 占位:七日每天另送一點糧
  // 賽季簽到(4.2):每天 3 抽 + 糧 1000 + 碎片 5;第 7/14/21/28 天大獎再 +4 抽、礪石 3
  signPulls: 3, signGrain: 1000, signShards: 5, signBig: [7, 14, 21, 28], signBigPulls: 4, signBigMat: { m_whet: 3 },
  // 活動日曆(4.1;季內日,從 1 起算;boss 以 12:00 起、20:00 結束)
  treasure: [[3, 5], [15, 17]],                                  // 寶地採集:季內日 [起, 迄](含頭尾整天)
  boss: [{ d0: 8, d1: 12, mul: 1 }, { d0: 18, d1: 22, mul: 1.3 }],   // 團結關:第 d0 天 12:00 ~ 第 d1 天 20:00(共 10 個時段)
  // 團結關(4.3)
  bossName: '關門山大王', bossLv: 6, bossTeams: 3, bossHpMul: 12,   // 占位:野怪 lv6 單位 HP × 12(待 10 場模擬後以 bossDmgRef 改算,見設計 4.3)
  bossDmgRef: 2580,   // 已量測(tools/bn_boss_dmg_sim.js,詳開場活動實作報告.md):一隊 3 人 10 回合平均傷害約 2579;首領總血 = bossDmgRef × 32 × 活動倍率(0 = 退回 bossHpMul 占位)
  bossStage: [0.25, 0.5, 0.75],
  bossStageGive: [
    { pulls: 5, mats: { m_whet: 3 }, shards: 20 },
    { pulls: 5, mats: { m_iron3: 2, m_hide3: 2 }, shards: 30 },
    { pulls: 10, mats: { m_iron4: 1, m_hide4: 1 } }
  ],
  bossKill: { pulls: 10, mats: { m_iron4: 2, m_hide4: 2, m_soul: 1 }, shards: 50 },
  bossLast: ['m_iron4', 'm_hide4', 'm_soul'], bossPartRate: 0.5, bossRpMax: 10,
  // 寶地(4.4)
  treasureCount: 2, treasureFoeMul: 1.2, treasureYieldMul: 2, treasureShardEvery: 6 * 3600000, treasureShard: 3,
  // 新手寨(2.5)
  tutMins: 0.5, tutFoeMul: 0.3, tutGrain: 100,
  // 預約(3.3)
  rsvMax: 3, rsvSpan: 36 * 3600000,
  pendMax: 30,
  // ---- 賽季末商店新值(EV_SHOP_ON 開啟後才取代現行 nbGive / 團結關獎勵)----
  nbGoldDay: 7,   // 七日第 7 天領隨機金將(第 1 季卡池 gr 4,優先沒擁有的;終身 1 次;存檔 nb.gold 0 未到 / 1 待領 / 2 已領)
  nbGiveShop: [null, { shards: 406, mats: { m_iron2: 5, m_hide2: 5, m_whet: 10 } }, { shards: 406, mats: { m_iron2: 5, m_hide2: 5, m_whet: 10 } }, { shards: 406, mats: { m_iron2: 5, m_hide2: 5, m_whet: 10 } }, { shards: 406, mats: { m_iron2: 5, m_hide2: 5, m_whet: 10 } }, { shards: 331, mats: { m_iron2: 5, m_hide2: 5, m_whet: 10 } }, { shards: 331, mats: { m_iron2: 5, m_hide2: 5, m_whet: 10 }, gold: 1 }],   // 第 2~7 天(索引 1~6):不再有紫金材料(碎片數照舊);第 7 天另 gold:1 = 隨機金將
  bossFrag: 1, bossFragFight: 2,       // 團結關第 2 場擊殺:給 1 片專武殘片(本期上架 12 件中隨機,沒持有的優先)
  bossSkill: 1, bossSkillFight: 2      // 團結關第 2 場擊殺:從本期新上架通用戰法隨機給 1 個;已全擁有 → 通用戰法任選券
};

// 主線 14 條(2.5)。k = 計數器名(ev.cnt);n = 需要次數;poll = 輪詢條件名(不靠事件);need = 需要存在的全域函式名(不存在 = 視為不存在,自動跳過);give = 獎勵
var EV_MAIN = [
  { id: 1, t: '使用新手禮包', k: 'gift', n: 1, give: { shards: 50, mats: { m_whet: 6 } } },
  { id: 2, t: '招賢館十連一次', k: 'ten', n: 1, give: { shards: 50, mats: { m_whet: 6 } } },
  { id: 3, t: '軍營排好隊伍 1', poll: 'team1', give: { shards: 48, mats: { m_iron3: 2, m_hide3: 2 } } },
  { id: 4, t: '打下新手寨', k: 'tut', n: 1, give: { shards: 38, mats: { m_iron3: 2, m_hide3: 2, m_whet: 2 } } },
  { id: 5, t: '收成一次', k: 'harv', n: 1, give: { shards: 40, mats: { m_iron4: 1, m_hide4: 1 } } },
  { id: 6, t: '打下 1 個資源點並駐守', k: 'garrison', n: 1, give: { grain: 2000 } },
  { id: 7, t: '打下 3 個資源點', k: 'resWin', n: 3, give: { shards: 20 } },
  { id: 8, t: '用一次自動派遣', k: 'auto', n: 1, give: { grain: 2000 } },
  { id: 9, t: '打下 1 個山寨', k: 'campWin', n: 1, give: { shards: 20 } },
  { id: 10, t: '集結打死 1 隻野怪', k: 'beastKill', n: 1, give: { mats: { m_whet: 2 } } },
  { id: 11, t: '鍛造 1 件武器', k: 'forge', n: 1, need: 'ldOpenForgeDone', give: { mats: { m_iron1: 10 } } },
  { id: 12, t: '在地圖打贏 5 場山寨 / 野怪 / 縣城戰', k: 'mapWin', n: 5, give: { shards: 30 } },   // 2026-11-15:原「高塔打到第 5 層」(高塔休眠)改成地圖戰鬥計數;山寨 / 野怪(含自動派遣)/ 縣各算一場,資源點不算
  { id: 13, t: '預約一次集結', k: 'rsvAdd', n: 1, give: { grain: 3000 } },
  { id: 14, t: '攻下 1 座縣', k: 'countyWin', n: 1, give: { shards: 50 } }
];
