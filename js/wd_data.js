// js/wd_data.js — 地圖 / 採集 / 攻城 / 野怪集結 資料表(設計線③;設計見 世界玩法設計/地圖與出征_設計.md、實作規格.md)。
// 純資料,不碰 DOM / 存檔。所有數字 PLACEHOLDER,集中放這裡,最後統一調。載入順序:wm_ui.js 之後、wd_core.js 之前(index.html、sw.js PRECACHE 同步)。
// 時間單位毫秒;點的去程 = mins 分鐘,回程 = 去程 × 1/4(retDiv)。

var WD_CFG = {
  MIN: 60000, HOUR: 3600000, DAY: 86400000,
  dayShiftMs: 8 * 3600000,                    // 日界以東八區計(同 WM_CFG.dayShiftMs)
  refreshHours: [12, 20],                     // 資源點每天 12:00、20:00 刷新(東八區)
  // 資源點:恆為 resCount 個,等級 1~resLvMax
  resCount: 10, resLvMax: 6,
  // 野怪:每 beastEvery 刷 1 隻,同時最多 beastMax 隻(只算一般野怪 act:false;活動野怪另計)
  beastEvery: 5 * 60000, beastMax: 6, beastLvMax: 8, beastTeams: [1, 2],
  beastHpMul: [1, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7],   // 守軍單位 HP 倍率(index = 等級)
  beastLootDice: [0, 3, 3, 4, 4, 5, 5, 6, 6, 7],        // 沒有 matForgeDrop 時的占位骰數(WM_DROP_MATS)
  // 山寨:同時 campCount 個,討平後 campRespawn 在原格補新;1~3 隊;單隊出征
  campCount: 4, campLvMax: 6, campTeams: [1, 3], campRespawn: 2 * 3600000, campGold: 120, campDice: 2,
  // 縣、郡、關口:存檔 seed 固定產生,常駐;lv = [最小, 最大]
  countyN: 6, junN: 2, passN: 3,
  fixedLv: { county: [5, 6], jun: [8, 9], pass: [7, 8] },
  fixedTeams: { county: 3, jun: 5, pass: 4 },
  foeRegenMs: 24 * 3600000,                   // 城池傷勢 24 小時內線性回滿
  // 行軍
  minsMin: 2, minsMax: 10, retDiv: 4,         // 去程 2~10 分鐘;回程 = 去程 ÷ 4
  // 集結
  rallyMax: 10,
  // 駐守
  guardMax: 3, guardMs: 24 * 3600000,
  // 損兵與重傷
  lossWin: [0.1, 0.3], lossLose: [0.4, 0.6], trpMin: 0.05, hurtMs: 15 * 60000, regenPerHour: 0.25,   // 補兵占位:在城每小時回 25%(wdTroopRegen;rsv.js 存在時改由校場預備兵補)
  minGoR: 0.2,                                // 隊伍裡有人兵力低於 20% 不能出征 / 集結(請到校場補兵)
  // 產出:每小時 = yield[ty] × lv × (1 + starBonus × 星階) × (契合 ? fitMul : 1)
  yield: { '林場': 1.1, '礦坑': 0.7, '獵場': 0.7, '農田': 110, '採石場': 0.4 },   // 方案 A(資源盤點):農田產糧;其餘產鍛造白材,量 = 糧 × GRID_RES 比例(生鐵 / 獸皮 0.044、木炭 0.066、礪石 0.022 對糧 6.6),占位,之後由大地圖 B 包取代
  starBonus: 0.1, fitMul: 1.2,
  fit: { '盾': '林場', '槍': '礦坑', '弓': '獵場', '騎': '農田', '謀': '採石場' },   // 兵種契合(占位)
  // 自動派遣:我方戰力 ≥ 守軍戰力 × autoMul 才派
  autoMul: 1.2,
  // 戰報
  rpMax: 50, rcMax: 20,
  // 守軍強度:點等級 lv → [章節, 逐關 order(BN_STG.v / rk 的索引 0~35)]
  lvMap: [null, [1, 0], [1, 3], [2, 7], [2, 10], [3, 13], [4, 19], [5, 26], [5, 30], [6, 34]],
  foeMul: { res: 1, camp: 1.05, beast: 1, county: 1.1, jun: 1.2, pass: 1.15 },   // 守軍基準 v 的倍率
  strong: { county: true, jun: true, pass: true },                              // 縣郡關口:隊長用頭目技能組(強、技能多)
  // 打贏加名聲:數量查 fameFor(kind, lv)(fame.js FAME_CFG.src,數值只放一處);fame.js 不存在就不加
};

// 資源點種類 → 收成種類(harv 的 key)
var WD_RES_TYPES = ['林場', '礦坑', '獵場', '農田', '採石場'];
// 方案 A:木、石、鐵已刪除。農田 → 糧(res4Add,world.res.grain);礦坑 → 生鐵、獵場 → 獸皮、林場 → 木炭、採石場 → 礪石(matGrant,材料 id 見 mat.js)
var WD_RES_KEY = { '林場': '木炭', '礦坑': '生鐵', '獵場': '獸皮', '農田': '糧', '採石場': '礪石' };
var WD_HARV_KEYS = ['糧', '生鐵', '獸皮', '木炭', '礪石'];
var WD_HARV_RES4 = { '糧': 'grain' };   // 只有糧走 res4Add(world.res);GOODS.g_liang 有 cap 200 會被裁,所以不走庫房
var WD_HARV_MAT = { '生鐵': 'm_iron1', '獸皮': 'm_hide1', '木炭': 'm_coal', '礪石': 'm_whet' };   // 其餘走 matGrant(lorddomain.mat.v1)
var WD_ICON = { '林場': '🪵', '礦坑': '⛏️', '獵場': '🦌', '農田': '🌾', '採石場': '🧱', beast: '🐗', camp: '🏕️', county: '🏘️', jun: '🏯', pass: '🚪' };

// 名稱池(山寨 / 野怪 / 縣郡關口)
var WD_NAMES = {
  beast: ['吊睛白額虎', '黑風巨熊', '赤鬃野豬王', '獨眼青狼王', '九尾山貓', '鐵背蒼猿', '雲紋豹', '巨角野牛'],
  camp: ['黑山寨', '白波營', '臥牛寨', '飛虎寨', '青牛寨', '鐵嶺寨', '落雁寨', '野狐坡'],
  county: ['陳留縣', '濮陽縣', '許縣', '長社縣', '宛縣', '鄴縣'],
  jun: ['潁川郡', '南陽郡'],
  pass: ['虎牢關', '函谷關', '潼關']
};
var WD_CAT_TXT = { res: '資源', beast: '野怪', camp: '山寨', county: '縣', jun: '郡', pass: '關口' };
