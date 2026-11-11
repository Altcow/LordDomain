// js/wm_data.js — 外勤清單 v0 資料表(R1a,見 side-session notes improvement_analysis §3、worldmap_design §5/§8)。
// 純資料,不碰 DOM / 存檔。所有數字 PLACEHOLDER,平衡最後統一調。載入順序:bn_*.js 之後、wm_core.js 之前(index.html、sw.js PRECACHE 同步)。
// 距離單位「里」:1 里 ≈ 415 m(顯示時括號附公里,例「15 里 ≈ 6 公里」)。時間單位毫秒(ms)為存檔與事件;秒數只用於公式說明。
// 材料占位:採集掉落暫用現有貨物(goodsdata.js 的 GOODS id),材料資料(equipment_design 36 材料)尚未實作,之後換 id 即可。
// 碎片 fragFig:本批只預留欄位,實際碎片發放由 R5 接。

var WM_CFG = {
  // 時間常數(ms)
  MIN: 60000, HOUR: 3600000, DAY: 86400000,
  // 行軍:去程秒 = 里 × goSecPerLi × 兵種係數(隊中最慢) × 低體力係數;回程秒 = 去程秒 ÷ retDiv
  goSecPerLi: 40, goMin: 60, goMax: 2400, retDiv: 4, lowStaThr: 30, lowStaGoMul: 1.2,
  staPerLi: 5,                       // 行軍體力:出發時一次扣 floor(里 ÷ 5)
  // 採集
  gatherPerMin: 6, lowStaGatherMul: 0.85, gatherMaxMin: 60, gatherStaMin: 5,   // 每卡 6 重 / 分;採集每 5 分 −1 體力(完成時扣 ceil)
  // 負重(重 = 採集量單位)
  load: { '騎': 120, '槍': 100, '盾': 100, '弓': 80, '謀': 60 }, loadPerStar: 0.05, loadHpFloor: 0.3,
  // 兵種行軍係數(取隊中最大值 = 最慢)
  troopSpd: { '騎': 0.7, '槍': 1.0, '弓': 1.0, '謀': 1.05, '盾': 1.15 },
  // 材料重量(1 件佔的重)與散銀(1 重 = 10 文)
  rarW: { '白': 10, '青': 20, '藍': 40 }, silverGoldPerW: 10,
  // 兵力 / 體力(hpR 單位 ‰:1000 = 滿;體力 0~100)
  hpMax: 1000, hpDead: 50, hpPerHour: 250, staMax: 100, staPerHour: 20,
  minHpDispatch: 300, minStaDispatch: 10, staPerFight: 10, staLoseExtra: 10, lowStaAtkMul: 0.85, lowStaThr2: 30,
  // 急補(花文):每 1% 缺額 × 品階價(文);品階 index 0~4 = 白 青 藍 紫 金
  rushGoldPerPct: [1000, 2000, 3000, 5000, 8000],
  // 清單 8 格:前 gatherSlots 格採集、其餘為 NPC 據點
  gatherSlots: 5, slotCount: 8,
  lifeMin: 8 * 3600000, lifeRand: 8 * 3600000,          // 出現後 8~16 小時未被派遣即消失
  relistDelay: 20 * 60000,                              // 過期後原格 20 分換新
  respawnMin: 20 * 60000, respawnRand: 25 * 60000,      // 被採空 / 討平後空 20~45 分
  // 保底與防洗版
  typeWindow: 12 * 3600000,                             // 每 12 小時採集 7 類各至少出現一次(最久未出現者優先)
  blueWindow: 24 * 3600000, blueMin: 2, blueMax: 4,      // 每 24 小時藍點 2~4
  sameTypeMax: 2,                                       // 同類同時最多 2 格
  rollBlue: 10, rollGreen: 40,                          // 隨機 0~99:< 10 藍、< 40 青、其餘白
  fragDailyCap: 300, dayShiftMs: 8 * 3600000,           // 碎片每日上限;日界以東八區計
  // 命令佇列
  queueMax: 5, armyCap: 3
};

// 採集類型(7 類 + 散銀);mat = 占位貨物 id(goodsdata.js GOODS)
var WM_GATHER = [
  { k: '林場', mat: 'wood' },
  { k: '礦坑', mat: 'g_tiekuang' },
  { k: '獵場', mat: 'mat_shengqi' },
  { k: '桑園', mat: 'g_si' },
  { k: '藥圃', mat: 'g_zhu' },
  { k: '玉坑', mat: 'stone' },
  { k: '古祠', mat: 'g_ma' }
];
var WM_SILVER = { k: '散銀', mat: '' };
// 採集點儲量基數(重)
var WM_STOCK = { '白': 200, '青': 300, '藍': 400 }, WM_STOCK_RAND = 200;
// 距離分布(里)
var WM_DIST = { '白': [5, 20], '青': [15, 35], '藍': [30, 50], 'npc': [10, 45] };

// NPC 據點:kind 對應掉落表;w = 出現權重(%)
var WM_NPC = [
  { k: '山賊營', drop: 'camp', w: 40 },
  { k: '山寨', drop: 'fort', w: 20 },
  { k: '黃巾煽動點', drop: 'incite', w: 20 },
  { k: '名人據點', drop: 'fig', w: 20 }
];
// 掉落表(骰數 = 材料抽數;gold = 文 × 章;frag = 碎片量)
var WM_DROP = {
  camp: { dice: 2, gold: 80, frag: 1 },
  fort: { dice: 3, gold: 150, frag: 2 },
  incite: { dice: 2, gold: 100, frag: 1 },
  fig: { dice: 4, gold: 250, frag: 3 }
};
// NPC 掉落材料占位池
var WM_DROP_MATS = ['g_tiekuang', 'wood', 'stone', 'g_si', 'mat_shengqi'];
