// js/cityfx_data.js — 民生數值與效果標籤資料表(PLAN_CITY §14.2~§14.4、§15.3、CT10 最小版)。純資料,數字皆 PLACEHOLDER。
// 標籤格式照 §14.3:wei 衛 yi 疫(%) shui 水(戶) liang 糧 store 存糧 an 安 xin 心 jiao 教 lu 路(%) wang 望
//   min mei xu wen shang chan 六軸 | tian →田糧%(r 內農田) | fire flood locust 天災% | warn 預警 xue 學識。百分比一律小數(−0.10 = −10%)。
// scope:'r' 半徑(預設,r 為格數)、'fang' 只作用所在坊、'all' 全城、'self' 自身(農田產糧、路面)。
// 對外數值 key(CITYFX_KEYS):sani 衛生、water 飲水、food 糧食、order 治安、mood 民心。
// 全域名稱:CITYFX_* CITY_FX CITY_FX_PENDING DECREE_FX

var CITYFX_BLOCK = 12;            // 坊 = 12×12 窗格(與 PLAN_BIGMAP 分塊同格)
var CITYFX_POP_PER_HOUSE = 4;     // 每戶人口(PLACEHOLDER)
var CITYFX_FOOD_PER_POP = 0.25;   // 糧耗 / 人(§14.2 v2.2)
var CITYFX_THROTTLE_MS = 1000;    // 重算節流

var CITYFX_KEYS = ['sani', 'water', 'food', 'order', 'mood'];
var CITYFX_NAME = { sani: '衛生', water: '飲水', food: '糧食', order: '治安', mood: '民心' };
var CITYFX_ICON = { sani: '🧹', water: '💧', food: '🌾', order: '🛡', mood: '😊' };
// 逐步揭露(§14.5):最低城市等級;面板整體 Lv3 起顯示(任務指定)
var CITYFX_REVEAL = { food: 2, water: 2, mood: 3, order: 4, sani: 5 };
var CITYFX_PANEL_LV = 3;
// 狀態門檻(PLACEHOLDER;§16 後果引擎日後讀取 cityFxLevel):[正常 ≥, 警示 ≥, 失衡 ≥],更低 = 危機
var CITYFX_LEVEL_AT = { sani: [60, 45, 30], water: [80, 60, 40], food: [100, 85, 70], order: [50, 40, 30], mood: [50, 40, 30] };
var CITYFX_LEVEL_NAME = ['正常', '警示', '失衡', '危機'];
// 各 key 基礎值(PLACEHOLDER)
var CITYFX_BASE = { sani: 63, order: 50, mood: 50 };
var CITYFX_DENSITY_SANI = 8;      // 衛生密度項 = 8 × 坊人口 / 100
var CITYFX_DENSITY_ORDER = 80;    // 治安密度項 = 坊人口 / 80
var CITYFX_EDU_ORDER = 0.2;       // 治安 + 教化 × 0.2;教化 = 20 + Σ教
var CITYFX_NEED_W = 5;            // 民心 += 5 × (水 / 糧 / 衛 / 安 四項滿足度 0~1 之和),最多 +20(§14.2「已滿足需求層 × 5」的簡化)
var CITYFX_DECREE_MOOD_CAP = 20;  // 政令民心加成上限(§15.4)
var CITYFX_ROAD_MIN = 0.7, CITYFX_ROAD_MAX = 1.6;
var CITYFX_ROAD_SANI_PEN = 0.9;   // 衛生失衡(level ≥ 2)時路速 ×0.9
var CITYFX_TIAN_CAP = 0.5;        // →田 糧加成上限 +50%

// 民居(基礎需求來源):id → 戶數權重
var CITYFX_HOUSES = { house: 1, house_tile: 1, house_gentry: 1, hut_mud: 1, hut_plank: 1, bamboo_house: 1 };

// 建築效果表(id 須為 OBJECTS 現有 id;缺的放 CITY_FX_PENDING)。n = 顯示名
var CITY_FX = {
  // 水與衛生
  privy:          { n: '茅廁',   fx: { wei: 3, yi: -0.10 }, r: 5 },
  well:           { n: '水井',   fx: { shui: 8, wei: 1, min: 1 }, r: 6 },
  well_old:       { n: '井台舊石', fx: { shui: 5, mei: 0.5 }, r: 5 },
  well_sweep:     { n: '桔槔',   fx: { shui: 12, tian: 0.05 }, r: 6 },
  water_vat:      { n: '水缸',   fx: { shui: 2, fire: -0.3 }, r: 4 },
  barrel_water:   { n: '水桶',   fx: { fire: -0.1 }, r: 3 },
  herb_garden:    { n: '藥圃',   fx: { yi: -0.05, chan: 1 }, r: 6 },
  hospital:       { n: '醫館',   fx: { yi: -0.25, xin: 2 }, r: 12 },
  shop_herb:      { n: '藥舖',   fx: { yi: -0.10, xin: 1, shang: 3 }, r: 8 },
  barber_stand:   { n: '剃頭挑子', fx: { wei: 1, xin: 1 }, r: 4 },
  broom:          { n: '掃帚',   fx: { wei: 0.5 }, r: 3 },
  // 糧食與農牧
  field_millet:   { n: '粟田',   fx: { liang: 4, chan: 2 }, scope: 'self' },
  field_wheat:    { n: '麥田',   fx: { liang: 5, chan: 2 }, scope: 'self' },
  field_sprout:   { n: '田(苗)', fx: { liang: 3, chan: 1 }, scope: 'self' },
  vegetable_plot: { n: '菜圃',   fx: { liang: 2, xin: 0.5 }, scope: 'self' },
  orchard:        { n: '果園',   fx: { liang: 2, mei: 1 }, scope: 'self' },
  shed_livestock: { n: '牲口棚', fx: { liang: 1, chan: 2 }, scope: 'self' },
  fishery:        { n: '魚場',   fx: { liang: 3, shang: 1 }, scope: 'self' },
  granary_round:  { n: '陶倉',   fx: { store: 20 }, scope: 'all' },
  grain_sacks:    { n: '糧袋堆', fx: { store: 5 }, scope: 'all' },
  shop_rice:      { n: '米舖',   fx: { xin: 1, shang: 4 }, r: 10 },
  millstone:      { n: '石磨',   fx: { tian: 0.05 }, r: 6 },
  winnower:       { n: '風扇車', fx: { tian: 0.05 }, r: 6 },
  waterwheel:     { n: '水車',   fx: { shui: 10, tian: 0.10 }, r: 6 },
  // 治安與官府
  notice_board:   { n: '告示牌', fx: { an: 3, jiao: 1 }, r: 8 },
  gate:           { n: '城門',   fx: { an: 5 }, r: 10 },
  deco_watchtower:{ n: '望樓',   fx: { an: 4, fire: -0.2 }, r: 10 },
  drum_tower:     { n: '鼓樓',   fx: { an: 3, xin: 1, warn: 1 }, r: 12 },
  archer:         { n: '弓兵營', fx: { an: 5 }, r: 10 },
  shield:         { n: '盾兵營', fx: { an: 5 }, r: 10 },
  cavalry:        { n: '騎兵營', fx: { an: 5 }, r: 10 },
  beacon:         { n: '烽燧',   fx: { warn: 1, xu: 3 }, scope: 'all' },
  palace:         { n: '城主府', fx: { an: 5, xin: 2, xue: 2 }, r: 12 },
  lantern_line:   { n: '燈籠列', fx: { an: 0.5 }, r: 4 },
  // 商貿與交通
  market:         { n: '市集',   fx: { shang: 6, xin: 1 }, r: 8 },
  inn:            { n: '客棧',   fx: { shang: 5, xin: 1 }, r: 8 },
  post_station:   { n: '驛站',   fx: { shang: 5, warn: 1, lu: 0.05 }, r: 8 },
  road_stone:     { n: '石板路', fx: { lu: 0.15 }, scope: 'self' },
  bridge:         { n: '橋梁',   fx: { lu: 0.10 }, scope: 'self' },
  small_bridge:   { n: '小橋',   fx: { lu: 0.10 }, scope: 'self' },
  // 文教
  shop_book:      { n: '書肆',   fx: { wen: 5, jiao: 2 }, r: 10 },
  stall_book:     { n: '書簡攤', fx: { wen: 2, jiao: 1 }, r: 6 },
  stele:          { n: '石碑',   fx: { wen: 3, jiao: 1, wang: 0.2 }, r: 8 },
  research:       { n: '研究院', fx: { jiao: 2, xue: 6 }, r: 10 },
  bookshelf:      { n: '書架',   fx: { wen: 0.5, jiao: 0.5 }, r: 3 },
  // 宗教與娛樂
  she_altar:      { n: '里社',   fx: { xin: 2, locust: -0.3 }, r: 8 },
  incense_burner: { n: '香爐',   fx: { xin: 1 }, r: 4 },
  censer:         { n: '博山爐', fx: { xin: 1 }, r: 4 },
  storyteller:    { n: '說書台', fx: { xin: 2, wen: 2 }, r: 8 },
  perform_ring:   { n: '藝人圈地', fx: { xin: 2 }, r: 8 },
  shop_wine:      { n: '酒肆',   fx: { xin: 2 }, r: 8 },
  shop_tea:       { n: '茶館',   fx: { xin: 2, wen: 1 }, r: 8 },
  paifang:        { n: '牌坊',   fx: { wang: 0.5, mei: 4, xu: 3 }, r: 10 }
};

// 暫缺(OBJECTS 尚無此 id):物件日後以此 id 登錄即自動生效(引擎同時查 CITY_FX 與本表)。alias 欄為暫代建議
var CITY_FX_PENDING = {
  drain:          { n: '排水溝(地表,未實作)', fx: { wei: 2, yi: -0.05, flood: -0.2 }, r: 2, alias: '新地表疊加,待做' },
  temple_futu:    { n: '浮屠祠', fx: { xin: 3, jiao: 1 }, r: 10, alias: 'OBJECTS 無 id,待美術' },
  temple_dao:     { n: '道觀',   fx: { xin: 2, yi: -0.05 }, r: 8, alias: 'OBJECTS 無 id,待美術' },
  sweep_office:   { n: '清道所', fx: { wei: 2, lu: 0.05 }, r: 6, alias: '以 broom+handcart 組合暫代,待做' },
  bathhouse:      { n: '公共浴堂', fx: { wei: 5, xin: 2, yi: -0.10, shang: 1 }, r: 8, alias: '待新美術' },
  lvmen:          { n: '里門',   fx: { an: 4, xu: 3 }, scope: 'fang', alias: '可用 gate_courtyard 暫代,待做' }
};

// 政令(CT12 最小四條;狀態由政令系統呼叫 cityFxSetDecree(id, power 0~1) 設定,本檔只放效果)
var DECREE_FX = {
  sweep: { n: '清掃街道', kind: 'standing',  fx: { min: 1, wang: 1, wei: 1, xin: 1, lu: 0.10 }, scope: 'all' },
  alms:  { n: '施粥',     kind: 'temporary', fx: { xin: 8, wang: 2 }, scope: 'all' },
  calm:  { n: '安撫',     kind: 'temporary', fx: { xin: 3 }, scope: 'all' },
  farm:  { n: '勸農',     kind: 'standing',  fx: { liangPct: 0.10, chan: 2 }, scope: 'all' }
};
