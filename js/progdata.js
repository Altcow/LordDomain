// js/progdata.js — 城市等級系統的唯一資料檔(PLAN_PROGRESSION.md §11)。草稿來源:tools/prog/progdata.draft.js。
// 載入順序:units.js 之後、prog.js 之前(index.html)。
// 規則:城市等級系統的「所有可調數字」只能寫在本檔;其他程式只能讀這裡的常數 / 函式,不得自寫數字。
// 標 PLACEHOLDER 的數值是佔位值,只求結構正確、遊戲可跑;全部功能完成後再統一做平衡(PLAN_PROGRESSION §12)。
// 不標 PLACEHOLDER 的是「結構」(開放順序、id、欄位),屬設計決定,不是平衡數字。
// ES2017;全域 const / function;不用 ?. ?? 物件展開。

const PROG_KEY = 'lorddomain.prog.v1';
const PROG_LV_MAX = 25;
const PROG_FREE_BUILD = true;   // 經營建築免費(PLAN_PROGRESSION §2.6 方案 A;使用者已定案 Q1)。false = 維持現行收費

// ───────── 1. 等級曲線(PLACEHOLDER:全部用簡單公式產生,日後換成逐級表只改這裡)─────────
function progLandSide(lv) { return 20 + Math.floor(1.5 * (lv - 1)); }           // 結構:Lv1 20×20 → Lv25 56×56 全開(端點固定,中間 PLACEHOLDER)
function progPopCap(lv) { return 40 + Math.round((lv - 1) * 160 / 24); }        // PLACEHOLDER:Lv1 40 → Lv25 200(端點 200 = TD_POP_CAP,固定)
function progCampCp(lv) { return 24 + Math.round((lv - 1) * 142 / 24); }        // PLACEHOLDER:Lv1 24 → Lv25 166
function progCampTier(lv) { return lv <= 5 ? 1 : lv <= 10 ? 2 : lv <= 17 ? 3 : lv <= 22 ? 4 : 5; } // 對應既有 CAMP_CAPS 的 5 欄(PLACEHOLDER 分段)
// 牆與柵欄分級數量(PLAN_DEFENSE「牆與柵欄分級數量」;單一處可調,全部 PLACEHOLDER;越後面越多,Lv1 牆至少 60 以容納 camp_lv01)
function progWallCap(lv) { return 72 + Math.round((lv - 1) * 228 / 24); }        // PLACEHOLDER:城牆格數 Lv1 72 → Lv25 300(Lv1 需容納 camp_lv01 的外牆 + 兩道內屏牆)
function progFenceCap(lv) { return lv < 2 ? 0 : 12 + Math.round((lv - 2) * 108 / 23); } // PLACEHOLDER:柵欄=鹿角 lujiao 格數;Lv2 起開放(PROG_UNLOCK_CAMP),Lv2 12 → Lv25 120;未開放回 0
function progGateCap(lv) { return 2 + Math.round((lv - 1) * 6 / 24); }           // PLACEHOLDER:城門道數 Lv1 2 → Lv25 8
function progTrapTotal(lv) { return lv < 6 ? 0 : Math.min(20, 4 + (lv - 6)); }  // PLACEHOLDER
function progProdCap(type, lv) {                                                // PLACEHOLDER:生產建築數量上限
  if (type === 'house') return 4 + 3 * (lv - 1);                                // Lv25 = 76(宛城 66 戶可完整套用)
  if (type === 'lumber' || type === 'quarry') return 1 + Math.floor((lv - 1) / 3);
  if (type === 'market') return lv < 3 ? 0 : 1 + Math.floor((lv - 3) / 3);
  return null;                                                                  // null = 不限(裝飾類)
}

// ───────── 2. 升級需求(PLACEHOLDER)─────────
// 回傳 L → L+1 所需:{ res:{coin,wood,stone}, xp, mats:{ id:n }, boss:'npcId'|null, ftue:'stepId'|null }
function progUpgradeCost(lv) {
  const k = lv * lv;                                                            // PLACEHOLDER 粗略階梯
  const mats = {};
  const band = PROG_MAT_BAND[lv] || [];
  if (band[0]) mats[band[0]] = 2 + lv;                                          // 普材料 PLACEHOLDER
  if (band[1]) mats[band[1]] = 1 + Math.floor(lv / 2);
  if (lv >= 4 && band[2]) mats[band[2]] = 1 + Math.floor(lv / 8);               // 良材料
  if (PROG_RARE_REQ[lv]) mats[PROG_RARE_REQ[lv]] = 1;                           // 珍材料(里程碑)
  return {
    res: { coin: 500 * k, wood: 150 * k, stone: 100 * k },
    xp: 60 * k,
    mats: mats,
    boss: PROG_BOSS_REQ[lv] || null,
    ftue: PROG_FTUE_REQ[lv] || null
  };
}
// 升 L+1 之前必須在首領營拿到 ≥1★ 的 NPC id(結構)
const PROG_BOSS_REQ = { 5: 'huangjin', 8: 'shankou', 12: 'shuizhai', 14: 'jun', 17: 'shanyue', 20: 'hulao', 22: 'chanyu', 24: 'luoyang' };
// 新手教學條件(結構;只在 Lv1~4)
const PROG_FTUE_REQ = { 1: 'houses2', 2: 'npcWin1', 3: 'campSet', 4: 'ghostWin1' };   // 順序即教學步驟;第 4 關 = 打贏 1 場隨機戰鬥(玩家陣地,kind:'ghost');npcWin2 僅供舊存檔相容
// 教學偵測門檻(結構):場上民房總數需達此值(新手小村初始 2 座,再蓋 1 座)
const PROG_TUT_HOUSES = 3;
// 教學提示文字(集中於此,日後改流程只改這裡)。hint 為「怎麼做」
const PROG_TUT_HINTS = {
  houses2: { hint: '選建築 → 點地面 → ✓', go: '下方建築列' },
  npcWin1: { hint: '左下 ⚔ 出征 → 野營副本', go: '左下 ⚔ 出征' },
  campSet: { hint: '左下切到『戰鬥布置』,放或拆一個物件', go: '左下 戰鬥布置' },
  npcWin2: { hint: '左下 ⚔ 出征 → 野營副本', go: '左下 ⚔ 出征' },
  ghostWin1: { hint: '左下 ⚔ 出征 → 隨機戰鬥', go: '左下 ⚔ 出征' }
};

// ───────── 3. 戰鬥回報(PLACEHOLDER 公式;結構 = 輸入欄位與分流規則)─────────
// 分流規則(結構,非數值):他城(PvP / ghost / 朋友)→ 資源 + 經驗;野營(NPC)→ 材料 + 經驗 + 少量資源;珍材料只出自野營 / 首領營。
const PROG_REWARD = {
  xpBase: function (T) { return 30 + 10 * T; },                                 // PLACEHOLDER
  lootBase: function (T) { return { coin: 300 * T, wood: 90 * T, stone: 60 * T }; }, // PLACEHOLDER(他城)
  npcResRate: 0.3,                                                              // PLACEHOLDER(野營資源 = 他城的幾成)
  lvDiff: function (T, myL) { return Math.max(0.25, Math.min(1.5, 1 + 0.12 * (T - myL))); }, // PLACEHOLDER
  gradeXp: { grand: 1.5, minor: 1.2, narrow: 1.0, pyrrhic: 0.9, defeat: 0.5, rout: 0.3 },    // PLACEHOLDER(沿用六級評價 id)
  starLoot: function (stars) { return 1 + 0.2 * stars; },                       // PLACEHOLDER
  dropCommon: function (T, stars) { return (1 + stars) * (1 + Math.floor(T / 8)); },          // PLACEHOLDER
  dropUncommonP: function (stars, diff) { return 0.12 * stars * [0.5, 1, 1.5][diff]; },       // PLACEHOLDER;diff 0 易 1 中 2 難
  dropRareP: 0.2,                                                               // PLACEHOLDER:3★ 難營
  bossFirst: { 1: { xpMul: 2 }, 2: { xpMul: 2 }, 3: { xpMul: 3, rare: 1 } },    // PLACEHOLDER:首領營各星首次
  friendRepeat: [1, 0.6, 0.3, 0.1],                                             // PLACEHOLDER:同一戰帖碼(snapHash)第 n 次的回報倍率
  practiceMul: 0.5,                                                             // PLACEHOLDER:打自己的陣地(練習)資源與經驗倍率
  matConvert: 3                                                                 // PLACEHOLDER:同品階 3 換 1
};

// ───────── 4. 材料(結構:id / 名稱 / 品階 / 來源陣營;數量見上)─────────
// tier:c 普、u 良、r 珍
const PROG_MATS = {
  mat_mabu:    { name: '麻布',       tier: 'c', icon: '🧵', from: ['bandit', 'yellow'] },
  mat_zhujian: { name: '竹簡',       tier: 'c', icon: '📜', from: ['yellow', 'haoqiang'] },
  mat_niupi:   { name: '牛皮',       tier: 'c', icon: '🟫', from: ['xiongnu', 'xianbei', 'wuhuan', 'qiang'] },
  mat_tieding: { name: '鐵錠',       tier: 'c', icon: '⬛', from: ['haoqiang', 'bandit'] },
  mat_tongyou: { name: '桐油',       tier: 'c', icon: '🛢️', from: ['pirate', 'shanyue'] },
  mat_shengqi: { name: '生漆',       tier: 'c', icon: '🟥', from: ['shanyue'] },
  mat_jianyu:  { name: '雁翎箭羽',   tier: 'c', icon: '🪶', from: ['xiongnu', 'xianbei'] },
  mat_qingtong:{ name: '青銅',       tier: 'c', icon: '🟨', from: ['haoqiang', 'qiang'] },
  mat_niujin:  { name: '牛筋',       tier: 'c', icon: '〰️', from: ['wuhuan', 'qiang'] },
  mat_lvling:  { name: '綠林令箭',   tier: 'u', icon: '🏹', from: ['bandit'] },
  mat_fulu:    { name: '太平符籙',   tier: 'u', icon: '🧧', from: ['yellow'] },
  mat_tiemao:  { name: '水寨鐵錨',   tier: 'u', icon: '⚓', from: ['pirate'] },
  mat_tengjia: { name: '山越藤甲',   tier: 'u', icon: '🛡️', from: ['shanyue'] },
  mat_yinshou: { name: '塢主印綬',   tier: 'u', icon: '🎗️', from: ['haoqiang'] },
  mat_qiangdi: { name: '羌笛',       tier: 'u', icon: '🎶', from: ['qiang'] },
  mat_mingdi:  { name: '烏桓鳴鏑',   tier: 'u', icon: '🎯', from: ['wuhuan'] },
  mat_buyao:   { name: '鮮卑金步搖', tier: 'u', icon: '✨', from: ['xianbei'] },
  mat_jiaogong:{ name: '匈奴角弓',   tier: 'u', icon: '🏹', from: ['xiongnu'] },
  mat_hufu:    { name: '虎符',       tier: 'r', icon: '🐯', from: ['boss'] },
  mat_taiping: { name: '太平要術殘卷', tier: 'r', icon: '📕', from: ['yellow'] },
  mat_tonggu:  { name: '雲雷銅鼓',   tier: 'r', icon: '🥁', from: ['shanyue'] },
  mat_yeming:  { name: '夜明珠',     tier: 'r', icon: '🔮', from: ['pirate'] },
  mat_hanxue:  { name: '汗血馬鬃',   tier: 'r', icon: '🐎', from: ['xiongnu', 'xianbei'] },
  mat_shanhai: { name: '山海經殘頁', tier: 'r', icon: '🗺️', from: ['any3hard'] }
};
// 各級升級指定的材料:[普1, 普2, 良](結構:跟著該等級帶的野營陣營走)
const PROG_MAT_BAND = {
  1: ['mat_mabu'], 2: ['mat_mabu', 'mat_tieding'], 3: ['mat_mabu', 'mat_zhujian'],
  4: ['mat_zhujian', 'mat_tieding', 'mat_lvling'], 5: ['mat_mabu', 'mat_zhujian', 'mat_fulu'],
  6: ['mat_tongyou', 'mat_zhujian', 'mat_fulu'], 7: ['mat_tongyou', 'mat_tieding', 'mat_lvling'],
  8: ['mat_tongyou', 'mat_shengqi', 'mat_tiemao'], 9: ['mat_shengqi', 'mat_zhujian', 'mat_tengjia'],
  10: ['mat_tieding', 'mat_qingtong', 'mat_yinshou'], 11: ['mat_tongyou', 'mat_qingtong', 'mat_tiemao'],
  12: ['mat_niupi', 'mat_qingtong', 'mat_qiangdi'], 13: ['mat_shengqi', 'mat_niujin', 'mat_tengjia'],
  14: ['mat_niupi', 'mat_niujin', 'mat_mingdi'], 15: ['mat_qingtong', 'mat_tieding', 'mat_yinshou'],
  16: ['mat_niupi', 'mat_jianyu', 'mat_buyao'], 17: ['mat_niujin', 'mat_qingtong', 'mat_qiangdi'],
  18: ['mat_jianyu', 'mat_niupi', 'mat_jiaogong'], 19: ['mat_niujin', 'mat_niupi', 'mat_mingdi'],
  20: ['mat_jianyu', 'mat_qingtong', 'mat_buyao'], 21: ['mat_niupi', 'mat_jianyu', 'mat_jiaogong'],
  22: ['mat_niujin', 'mat_jianyu', 'mat_mingdi'], 23: ['mat_jianyu', 'mat_niupi', 'mat_buyao'],
  24: ['mat_niupi', 'mat_niujin', 'mat_jiaogong']
};
// 里程碑升級需要的珍材料(結構)
const PROG_RARE_REQ = { 9: 'mat_hufu', 14: 'mat_taiping', 17: 'mat_yeming', 19: 'mat_tonggu', 23: 'mat_hanxue', 24: 'mat_hufu' };

// ───────── 5. NPC 陣營與等級帶(結構;等級帶邊界 PLACEHOLDER)─────────
// gar:守軍兵種對照(先用既有 UNITS,新陣營兵種日後再加);pref:選塔偏好(模塊生成器用);theme:地形主題
const PROG_FACTIONS = {
  bandit:   { name: '盜匪',     lv: [1, 8],   theme: 'hill',   gar: ['szdao', 'szgong'],          pref: ['tower', 'qtower', 'lujiao'] },
  yellow:   { name: '黃巾',     lv: [2, 12],  theme: 'plain',  gar: ['hjzong', 'hjlishi'],        pref: ['lianu', 'huojian', 'tent'] },
  pirate:   { name: '水寇',     lv: [5, 15],  theme: 'water',  gar: ['shuizei', 'szgong'],        pref: ['nutai', 'wanglou', 'qtower'] },
  shanyue:  { name: '山越',     lv: [7, 17],  theme: 'forest', gar: ['szdao', 'hunter'],          pref: ['xunyan', 'jianzhuang', 'qtower'] },
  haoqiang: { name: '豪強塢堡', lv: [9, 20],  theme: 'walled', gar: ['daodun', 'changji', 'gongbing'], pref: ['dilou', 'zhalou', 'ztower'] },
  qiang:    { name: '羌',       lv: [11, 21], theme: 'hill',   gar: ['szdao', 'hushe'],           pref: ['shitai', 'wanglou', 'tower'] },
  wuhuan:   { name: '烏桓',     lv: [13, 23], theme: 'plain',  gar: ['huqi', 'hushe'],            pref: ['qiangzhen', 'nutai', 'ponu'] },
  xianbei:  { name: '鮮卑',     lv: [15, 25], theme: 'plain',  gar: ['huqi', 'hushe'],            pref: ['chuangtai', 'qiangzhen', 'fengsui'] },
  xiongnu:  { name: '匈奴遊騎', lv: [17, 25], theme: 'plain',  gar: ['huqi', 'hushe'],            pref: ['nutai', 'qiangzhen', 'gutai'] }
};
// 首領營(固定、手工設計;前 5 座已存在於 npc.js)
const PROG_BOSSES = [
  { id: 'huangjin', lv: 5,  fac: 'yellow',   exists: true },
  { id: 'shankou',  lv: 8,  fac: 'bandit',   exists: true },
  { id: 'shuizhai', lv: 12, fac: 'pirate',   exists: false },
  { id: 'jun',      lv: 14, fac: 'haoqiang', exists: true },
  { id: 'shanyue',  lv: 17, fac: 'shanyue',  exists: false },
  { id: 'hulao',    lv: 20, fac: 'haoqiang', exists: true },
  { id: 'chanyu',   lv: 22, fac: 'xiongnu',  exists: false },
  { id: 'luoyang',  lv: 24, fac: 'haoqiang', exists: true }
];
const PROG_NPC_SLOTS = 3;   // 野營榜同時顯示幾座(結構)
const PROG_GHOST_SLOTS = 3; // 他城榜同時顯示幾座(結構)

// ───────── 6. 等級開放表(結構:不是平衡數字)─────────
// 經營建築:BUILD_GROUPS 的實際 id(research 不在分組內);共 171 件全覆蓋(tools/prog/prog_check.js 驗證)
const PROG_UNLOCK_ESTATE = {
  1: ['house', 'palace', 'lumber', 'quarry', 'tree', 'stone', 'well', 'field_sprout', 'vegetable_plot', 'fence_wood', 'woodpile', 'haystack', 'chicken', 'dog', 'deco_bush', 'flower_bed', 'stone_table', 'stone_stool', 'bench_wood'],
  2: ['field_millet', 'plow', 'hoe', 'ox', 'pig', 'duck', 'barrel_water', 'basket', 'grain_sacks', 'tree_willow', 'deco_rocks', 'table_wood'],
  3: ['market', 'wall', 'gate', 'stall_veg', 'stall_fruit', 'handcart', 'wheelbarrow', 'cat', 'tree_pine', 'road_stone', 'table_long'],
  4: ['stairs', 'ramp', 'shield', 'training_dummy', 'deco_target', 'deco_weaponrack', 'flag_army', 'sheep', 'trough', 'fodder', 'hu_chuang'],
  5: ['shop_rice', 'shop_wine', 'stall_rice', 'stall_meat', 'stall_wine', 'winejar', 'winejar_big', 'food_table', 'mat', 'broom', 'privy', 'table_set'],
  6: ['bridge', 'fish_rack', 'fishery', 'dock', 'boat_small', 'lotus', 'reeds', 'deco_pond', 'small_bridge', 'barrel_empty', 'goose', 'chair_bamboo'],
  7: ['research', 'archer', 'bookshelf', 'shop_book', 'stall_book', 'stele', 'lamp_stand', 'deco_bamboo', 'fence_bamboo', 'screen_fold'],
  8: ['post_station', 'inn', 'cart_hay', 'cart_goods', 'cart_empty', 'donkey', 'horse', 'stable', 'tree_maple', 'stools_pair'],
  9: ['shop_cloth', 'stall_cloth', 'stall_pottery', 'stall_tea', 'shop_tea', 'tea_garden', 'bank', 'shop_pawn', 'tea_set'],
  10: ['cavalry', 'parade_ground', 'drill_ground', 'wall_courtyard', 'gate_courtyard', 'deco_campfire', 'deco_jumaa', 'deco_lujiao', 'low_table_cushion'],
  11: ['field_wheat', 'mulberry_grove', 'orchard', 'herb_garden', 'beehive', 'millstone', 'winnower', 'granary_round', 'sheepfold', 'ranch_fence'],
  12: ['deco_lumberyard', 'sawbench', 'lograft', 'mine_entrance', 'minecart', 'ore_stone', 'ore_iron', 'ore_copper', 'smithy', 'shop_smith'],
  13: ['she_altar', 'incense_burner', 'censer', 'stone_lamp', 'tree_cypress', 'potted_plant'],
  14: ['shop_herb', 'shop_rouge', 'stall_rouge', 'stall_toy', 'couch', 'screen', 'chest', 'winejar_stack', 'winejar_mix'],
  15: ['siege', 'army_camp', 'tent_group', 'flag_great', 'drum_tower', 'well_sweep'],
  16: ['tree_mulberry', 'deco_brazier', 'paifang'],
  17: ['saltfield', 'salt_pile', 'waterwheel', 'oxcart', 'deco_oxcart'],
  18: ['toll_gate', 'beacon', 'deco_watchtower', 'ferry', 'deco_stable'],
  19: ['tent_general', 'war_chariot', 'cloud_ladder', 'ram'],
  20: ['trebuchet', 'jinglan', 'warship'],
  21: ['shop_gamble', 'carriage'],
  22: ['rockery', 'tree_sakura', 'tree_peach'],
  23: ['lantern_line'],
  24: ['shop_brothel'],
  25: []
};
// 地形工具(經營與戰陣共用)
const PROG_UNLOCK_TERRAIN = { 1: ['road', 'grass', 'erase'], 4: ['raise', 'lower'], 6: ['lake', 'river'] };
// 戰陣物件(CAMP_OBJECTS 26 件 + 共用的 wall/gate/stairs/ramp/bridge;tree/stone 跟經營同 Lv1)
const PROG_UNLOCK_CAMP = {
  1: ['hq', 'tower', 'qtower', 'wall', 'gate', 'tent', 'wagon'],
  2: ['lujiao', 'banner', 'granary'],
  3: ['nutai', 'fakecamp'],
  4: ['muster', 'jianzhuang', 'stairs', 'ramp'],
  5: ['shitai', 'wanglou'],
  6: ['lianu', 'bridge'],
  7: ['qiangzhen'],
  8: ['ztower'],
  9: ['huojian'],
  10: ['ponu'],
  11: ['xunyan', 'fengsui'],
  12: ['dilou', 'gutai'],
  13: ['chuangtai'],
  14: ['zhalou'],
  16: ['pili']
};
// 陷阱(M3 的 STRATAGEMS key;M3 未實作前此表不生效)
const PROG_UNLOCK_TRAP = { 6: ['pit'], 8: ['caltrop'], 10: ['fake'], 12: ['rolllog'], 15: ['oilpit'] };
// 我軍兵種(tdDeployable 的 11 種全覆蓋)
const PROG_UNLOCK_UNIT = { 1: ['militia', 'daodun', 'gongbing'], 2: ['hunter'], 3: ['qingqi'], 6: ['chuangnu'], 7: ['chihou'], 8: ['changji'], 10: ['tuqi'], 12: ['chongche'], 14: ['toushi'] };
// 功能(isUnlocked('feature', id) 的 id)
const PROG_UNLOCK_FEATURE = {
  1: ['estate', 'battleDesign', 'npc', 'sandbox', 'tplEstate', 'tplCamp', 'report', 'upgrade'],
  2: ['ghost'],
  3: ['modDraw', 'visit'],
  6: ['friend', 'spar', 'random'],
  7: ['research'],
  8: ['photo'],
  9: ['shop', 'deals', 'auction'],
  10: ['recorder'],
  12: ['replayFeed'],
  15: ['campSlots'],
  17: ['fishing'],
  23: ['pet']
};
// 戰鬥陣模塊抽選(結構)
const PROG_MOD = { perLv: 3, window: 2, show: 3, rerollFree: true, favMax: 10, mySlots: 3 }; // rerollFree / favMax / mySlots 待使用者決定(§13)
// 75 筆模塊記錄 { id:'m01a', lv:1, arch:'A1', seed, p:{}, tweak:{add:[],remove:[]} };PR3-03 填入
const PROG_MODS = [];

// ───────── 7. 鍵名、亂數、測試用常數(結構;非平衡數字)─────────
const PROG_SAVE_KEY = 'lorddomain.save.v1';            // 主存檔(map.js SAVE_KEY 同值;此處只讀寫舊檔遷移用)
const PROG_LEGACY_KEY = 'lorddomain.save.legacy.v1';   // 舊主存檔的原樣備份(PLAN §8.2,可日後匯回)
const PROG_LEGACY_AT_KEY = 'lorddomain.save.legacy.at.v1'; // 上列備份的時間(ISO 字串)
const PROG_STAR_MAX = 3;          // 戰鬥最高星數
const PROG_FRIEND_HIST = 50;      // friendHits 最多保留筆數(超過刪最舊)
const PROG_RNG = { mul: 31, mix: 2246822507, shift: 15, span: 4294967296 }; // 確定性亂數(prog.js progRand 用)
const PROG_DEBUG_GRANT = 99999;   // 測試工具「補滿」的數量(遊戲本身沒有資源上限)
const PROG_DIFF_MAX = 2;          // 野營難度最高值(0 易 / 1 中 / 2 難)
