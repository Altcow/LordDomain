// js/cityscore_data.js — 城建評分(PLAN_CITY §2.1 §2.3 §3.2 §4.1)的資料檔:軸、分類表、服務半徑、門檻公式、Lv1~25 營造要求。
// 載入順序:cityonly.js 之後、prog.js 之前(index.html、sw.js PRECACHE 同步)。引擎在 cityscore.js,介面在 cityscoreui.js。
// 所有數字皆 PLACEHOLDER(PLAN_CITY 標明:數值平衡最後做);結構(軸、分類、條件種類)屬設計決定。
// ES2017;不用 ?. ??。
// 全域名稱:CITY_AXES CITY_AXIS_BY_ID CITY_D_RATE CITY_TIER_SCORE CITY_TIER_RES CITY_RES_OVR CITY_TIER_NEEDS CITY_SVC CITY_CLASS CITY_CLASS_IDS CITY_CLASS_RULES CITY_GROUP_CLASS
//         CITY_RES_MUL CITY_PROS_SCALE CITY_POP_SCALE cityProsperityReq cityPopReq CITY_AXIS_WEIGHT CITY_LV_REQ CITY_TRADE_IDS CITY_PHRASE。

// 六軸:reveal = 該軸從城市幾級起顯示(逐步揭露;未揭露的軸照算,只是不畫);sh = 浮字簡稱
var CITY_AXES = [
  { id: 'liv', name: '民生', sh: '民', reveal: 2 },
  { id: 'beau', name: '美觀', sh: '美', reveal: 2 },
  { id: 'ord', name: '秩序', sh: '序', reveal: 4 },
  { id: 'cul', name: '文化', sh: '文', reveal: 7 },
  { id: 'com', name: '商貿', sh: '商', reveal: 3 },
  { id: 'ind', name: '產業', sh: '產', reveal: 2 }
];
var CITY_AXIS_BY_ID = {};
CITY_AXES.forEach(function (a, i) { a.i = i; CITY_AXIS_BY_ID[a.id] = a; });
var CITY_AXIS_WEIGHT = { liv: 0.25, beau: 0.15, ord: 0.14, cul: 0.12, com: 0.17, ind: 0.17 };   // 星級目標占比(PLACEHOLDER;總和 1)

var CITY_IND_PER_POP = 0.6;                // 每口人可支撐的產業分(勞力上限;PLAN §4.2 勞力比 0.6)
var CITY_D_RATE = 0.88;                          // 同種遞減:D(n) = Σ 0.88^(i-1)
var CITY_TIER_SCORE = [1, 3, 6, 12, 25];         // 民居品級 0~4 的民生分(PLAN §2.3)
var CITY_TIER_RES = [4, 6, 9, 16, 30];           // 民居品級 0~4 的住戶口數(PLACEHOLDER;民房 house 視為品級 1)
var CITY_RES_OVR = { shack_lean: 2, cave_dwelling: 3, manor_estate: 42, mansion_clan: 32 };   // 個別物件的口數覆寫
// 民居品級 → 該品級「期望」的服務需求(半徑內有沒有);滿足比例影響民生分與入住率
var CITY_TIER_NEEDS = [['water'], ['water', 'food'], ['water', 'food', 'goods'], ['water', 'food', 'goods', 'safe'], ['water', 'food', 'goods', 'safe', 'fun', 'cul']];
// 服務半徑(格,切比雪夫):水 / 食 / 貨 / 安 / 樂 / 文
var CITY_SVC = {
  water: { name: '水', r: 6 }, food: { name: '食', r: 8 }, goods: { name: '貨', r: 8 },
  safe: { name: '安', r: 10 }, fun: { name: '樂', r: 8 }, cul: { name: '文', r: 10 }
};

var CITY_RES_MUL = 0.6;       // 升級資源 = progUpgradeCost.res × 0.6(PLAN §2.1 CITY_RES_MUL)
var CITY_PROS_SCALE = 0.27;   // 繁榮度門檻總倍率(PLACEHOLDER):PLAN 原公式 Lv24 = 5,530,但同種遞減使「全種類各 8 件」也只有約 2,800,故縮為 0.27(bot 校準,Lv24 約 1,500)
var CITY_POP_SCALE = 1;       // 人口門檻總倍率(PLACEHOLDER,由 bot 校準)
// 升級門檻(lv = 目前等級,升到 lv+1 所需)。公式見 PLAN §2.1:繁榮度 25×lv^1.7(Lv1 例外 20),人口 8×lv^1.45
function cityProsperityReq(lv) { return lv <= 1 ? 20 : Math.round(25 * Math.pow(lv, 1.7) * CITY_PROS_SCALE); }
function cityPopReq(lv) { return Math.round(8 * Math.pow(Math.max(1, lv), 1.45) * CITY_POP_SCALE); }

// 分類表:v = [民生, 美觀, 秩序, 文化, 商貿, 產業];svc = 提供的服務;jobs = 職缺;shop = 算店鋪種類;cult = 算文類種類;w = 分類名(給評語用)
var CITY_CLASS = {
  dwell:    { v: [0, 0, 0, 0, 0, 0], name: '民居' },
  tree:     { v: [0, 2, 0, 0, 0, 0], name: '樹木' },
  flower:   { v: [0, 2, 0, 0, 0, 0], name: '花木' },
  rock:     { v: [0, 3, 0, 0, 0, 0], name: '石景' },
  rockery:  { v: [0, 8, 0, 0, 0, 0], name: '假山' },
  water:    { v: [0, 3, 0, 0, 0, 0], name: '水景', waterCell: 1 },
  pond:     { v: [0, 4, 0, 0, 0, 0], name: '池塘', waterCell: 1 },
  well:     { v: [1, 0, 0, 0, 0, 0], name: '水井', svc: 'water' },
  vat:      { v: [0.5, 0, 0, 0, 0, 0], name: '水缸', svc: 'water' },
  sanit:    { v: [1.5, 0, 0, 0, 0, 0], name: '衛生' },
  farm:     { v: [0, 1, 0, 0, 0, 2], name: '田圃', svc: 'food', jobs: 2 },
  animal:   { v: [0, 0.5, 0, 0, 0, 1], name: '牲畜', jobs: 1 },
  granary:  { v: [0, 0, 0, 0, 1, 1], name: '糧倉', svc: 'food', jobs: 2 },
  stall:    { v: [0, 0, 0, 0, 4, 0], name: '攤位', svc: 'goods', jobs: 2, shop: 1 },
  shop:     { v: [0, 0, 0, 0, 6, 0], name: '店鋪', svc: 'goods', jobs: 4, shop: 1 },
  ground:   { v: [0, 0.5, 0, 0, 2.5, 0], name: '地攤', svc: 'goods', jobs: 1, shop: 1 },
  tavern:   { v: [0, 1, 0, 2, 3, 0], name: '酒肆茶館', svc: 'fun', jobs: 4, shop: 1, cult: 1 },
  vice:     { v: [0, 0, 0, 0, 4, 0], name: '博戲', svc: 'fun', jobs: 4, shop: 1 },
  culture:  { v: [0, 1, 0, 5, 0, 0], name: '書香禮制', svc: 'cul', jobs: 1, cult: 1 },
  scholar:  { v: [0, 1, 0, 8, 0, 0], name: '科研', svc: 'cul', jobs: 4, cult: 1 },
  monument: { v: [0, 4, 2, 3, 0, 0], name: '牌坊', cult: 1 },
  guard:    { v: [0, 0, 5, 0, 0, 0], name: '守望', svc: 'safe', jobs: 3 },
  wall:     { v: [0, 0, 0.3, 0, 0, 0], name: '牆籬' },
  road:     { v: [0, 0, 0.5, 0, 0, 0], name: '道路', roadCell: 1 },
  plaza:    { v: [0, 1, 0, 0, 1, 0], name: '廣場', roadCell: 1 },
  industry: { v: [0, 0, 0, 0, 0, 5], name: '工坊礦場', jobs: 6 },
  indpart:  { v: [0, 0, 0, 0, 0, 1], name: '產業配件', jobs: 1 },
  port:     { v: [0, 0, 0, 0, 5, 1], name: '商旅碼頭', svc: 'goods', jobs: 4, shop: 1 },
  portpart: { v: [0, 0.3, 0, 0, 1, 0.5], name: '港埠配件' },
  furn:     { v: [0, 0.5, 0, 0, 0.5, 0], name: '桌椅' },
  daily:    { v: [0.3, 0.3, 0, 0, 0.3, 0], name: '生活雜物' },
  ruin:     { v: [0, 0.5, 0, 0.5, 0, 0], name: '舊物' },
  deco:     { v: [0, 1.5, 0, 0, 0, 0], name: '擺設' },
  mil:      { v: [0, 0, 1.5, 0, 0, 0], name: '軍事', svc: 'safe' },
  grand:    { v: [5, 4, 3, 3, 0, 0], name: '城主府', svc: 'safe', r: 12 },
  camp:     { v: [0, 0, 0, 0, 0, 0], name: '戰陣' },
  misc:     { v: [0, 0.3, 0, 0, 0.3, 0], name: '其他' }
};
// 逐件指定(優先於規則);值 = 空白分隔的 OBJECTS id
var CITY_CLASS_IDS = {
  well: 'well well_old well_sweep', vat: 'water_vat barrel_water', sanit: 'privy',
  rockery: 'rockery', rock: 'stone deco_rocks potted_plant', flower: 'deco_bamboo deco_bush flower_bed',
  water: 'lotus reeds small_bridge bridge', pond: 'deco_pond',
  animal: 'ox horse donkey sheep pig chicken duck goose dog cat sheepfold stable shed_livestock livestock_pen ranch_fence trough fodder haystack deco_stable',
  granary: 'grain_sacks granary_round grain_drying',
  indpart: 'ore_iron ore_copper ore_stone minecart sawbench lograft millstone winnower waterwheel plow hoe salt_pile smith_awning fishery fish_rack',
  industry: 'lumber quarry smithy mine_entrance shop_smith deco_lumberyard',
  port: 'dock warehouse_port ferry post_station inn shipyard fish_market toll_gate',
  culture: 'stele she_altar censer incense_burner bookshelf stall_book shop_book',
  scholar: 'research', monument: 'paifang',
  guard: 'gate deco_watchtower beacon notice_board',
  wall: 'wall wall_courtyard gate_courtyard fence_wood fence_bamboo',
  road: 'road_stone stairs ramp',
  tavern: 'shop_wine shop_tea storyteller perform_ring',
  vice: 'shop_gamble shop_brothel',
  deco: 'lantern_post lantern_line stone_lamp stone_lion spirit_wall deco_brazier lamp_stand banner_wine banner_cloth banner_herb tea_set',
  grand: 'palace', shop: 'market bank shop_pawn shop_herb shop_rouge shop_cloth shop_rice',
  stall: 'stall_wine stall_tea hawker_carrier handcart',
  ground: 'barber_stand fortune_stall vendor_platform hitching_post',
  ruin: 'hut_ruin wall_ruin fence_broken gate_wicker junk_pile tree_dead yard_poor rack_net rack_cloth',
  daily: 'basket barrel_empty food_table couch mat screen chest broom woodpile'
};
// 規則(依序,第一個符合者勝出;在逐件指定之後、群組預設之前)
var CITY_CLASS_RULES = [
  [/^stall_/, 'stall'], [/^food_/, 'stall'], [/^ground_/, 'ground'], [/^shop_/, 'shop'],
  [/^plaza_/, 'plaza'], [/^banner_|^flag_/, 'deco'],
  [/^tree_dead$/, 'ruin'], [/^tree/, 'tree'],
  [/^field_|^vegetable_|^herb_garden$|^orchard$|^mulberry_grove$|^tea_garden$|^beehive$|^saltfield$/, 'farm'],
  [/^ore_|^minecart$|^sawbench$|^lograft$/, 'indpart'],
  [/^cargo_|^ship_|^boat_|^pier_|^wharf_|^mooring_|^crane_|^port_/, 'portpart'],
  [/^winejar/, 'daily'], [/^cart_|^oxcart$|^deco_oxcart$|^wheelbarrow$|^carriage$/, 'daily'],
  [/^tbl_|^table_|^chair_|^stool|^cushion_|^bench_|^hu_chuang$|^low_table_/, 'furn']
];
// 群組預設(BUILD_GROUPS 的群組 id → 分類)
var CITY_GROUP_CLASS = { live: 'daily', table: 'furn', shop: 'shop', town: 'ruin', bazaar: 'ground', farm: 'farm', ind: 'indpart', port: 'portpart', mil: 'mil', garden: 'deco', rite: 'culture', road: 'wall' };

var CITY_TRADE_IDS = ['post_station', 'dock', 'ferry', 'toll_gate', 'warehouse_port'];   // 對外商路(簡化:有其中一種)

// Lv1~25 營造要求(升到 lv+1 之前要滿足;Lv25 滿級 = null)。結構:{ id, title, big?, conds:[{ k, ..., text, go:[建議建築 id] }] }
// 條件種類(cityscore.js cityCondEval):
//   dwell{n} 民居戶數 / tier{t,n} 品級≥t 的戶數 / types{ids,n} 指定建築合計件數 / kinds{cls[],n} 這些分類中「不同種」建築數 / kindsAll{n} 全城不同種建築數
//   cover{svc,frac} 民居被該服務半徑覆蓋的比例 / roadnear{frac} 民居 2 格內有路 / water{n} 水域格數 / trade{} 對外商路 / walls{n} 牆格數
//   cluster{ids,d} 這些建築在 d 格內聚成一街坊 / axis{a,f} 該軸 ≥ f × 繁榮度門檻 / axesAll{f} 六軸皆 ≥ f × 繁榮度門檻
var CITY_LV_REQ = {
  1: { id: 'lr1', title: '安居', conds: [{ k: 'dwell', n: 3, text: '民居 3 棟', go: ['house'] }] },
  2: { id: 'lr2', title: '飲水', conds: [{ k: 'cover', svc: 'water', frac: 1, text: '每棟民居 6 格內有水井', go: ['well', 'well_old'] }] },
  3: { id: 'lr3', title: '市井', conds: [{ k: 'kinds', cls: ['stall'], n: 2, text: '2 種攤位', go: ['stall_veg', 'stall_fruit'] }] },
  4: { id: 'lr4', title: '通衢', conds: [{ k: 'roadnear', frac: 0.8, text: '8 成民居 2 格內有路', go: ['road_stone'] }] },
  5: { id: 'lr5', title: '立市', big: true, conds: [
    { k: 'types', ids: ['market'], n: 1, text: '市集 1 座', go: ['market'] },
    { k: 'kinds', cls: ['stall', 'shop', 'tavern'], n: 4, text: '店攤 4 種', go: ['stall_veg', 'stall_fruit', 'stall_rice', 'stall_meat', 'shop_rice'] },
    { k: 'dwell', n: 10, text: '民居 10 棟', go: ['house'] }] },
  6: { id: 'lr6', title: '臨水', conds: [{ k: 'water', n: 6, text: '水景 6 格', go: ['deco_pond', 'lotus', 'reeds'] }] },
  7: { id: 'lr7', title: '書香', conds: [{ k: 'cluster', ids: ['shop_book', 'stele'], d: 6, text: '書肆與石碑相距 6 格內', go: ['shop_book', 'stele'] }] },
  8: { id: 'lr8', title: '通商', conds: [{ k: 'trade', text: '對外商路(驛站或碼頭)', go: ['post_station', 'dock'] }] },
  9: { id: 'lr9', title: '鄉紳', conds: [{ k: 'tier', t: 3, n: 3, text: '3 棟品級 3 以上民居', go: ['house_gentry'] }] },
  10: { id: 'lr10', title: '築城', big: true, conds: [
    { k: 'walls', n: 40, text: '城牆 40 格', go: ['wall'] },
    { k: 'types', ids: ['gate', 'gate_courtyard'], n: 2, text: '城門 2 座', go: ['gate'] },
    { k: 'dwell', n: 20, text: '民居 20 棟', go: ['house', 'hut_plank'] },
    { k: 'cover', svc: 'safe', frac: 0.8, text: '8 成民居有守望', go: ['notice_board', 'gate'] }] },
  11: { id: 'lr11', title: '農桑', conds: [{ k: 'kinds', cls: ['farm'], n: 5, text: '5 種田圃', go: ['field_wheat', 'orchard', 'mulberry_grove', 'herb_garden', 'beehive', 'field_millet'] }] },
  12: { id: 'lr12', title: '百工', conds: [{ k: 'kinds', cls: ['industry'], n: 3, text: '3 種工坊礦場', go: ['smithy', 'mine_entrance', 'shop_smith'] }] },
  13: { id: 'lr13', title: '社稷', conds: [{ k: 'types', ids: ['she_altar'], n: 1, text: '里社 1 座', go: ['she_altar'] }, { k: 'types', ids: ['tree_cypress'], n: 1, text: '社樹(柏)1 棵', go: ['tree_cypress'] }] },
  14: { id: 'lr14', title: '豪門', conds: [{ k: 'tier', t: 4, n: 1, text: '1 棟品級 4 民居', go: ['mansion_great'] }] },
  15: { id: 'lr15', title: '開渠通漕', big: true, conds: [
    { k: 'water', n: 12, text: '水景 12 格', go: ['deco_pond', 'lotus', 'reeds'] },
    { k: 'types', ids: ['dock'], n: 1, text: '碼頭 1 座', go: ['dock'] },
    { k: 'types', ids: ['warehouse_port'], n: 1, text: '碼頭倉 1 座', go: ['warehouse_port'] },
    { k: 'types', ids: ['ship_cargo', 'ship_grain', 'boat_sampan', 'boat_small'], n: 1, text: '船 1 艘', go: ['ship_cargo', 'boat_sampan'] }] },
  16: { id: 'lr16', title: '禮制', conds: [{ k: 'types', ids: ['paifang'], n: 1, text: '牌坊 1 座', go: ['paifang'] }] },
  17: { id: 'lr17', title: '文風', conds: [{ k: 'kinds', cls: ['culture', 'scholar', 'tavern', 'monument'], n: 6, text: '6 種文娛建築', go: ['shop_book', 'stele', 'she_altar', 'censer', 'incense_burner', 'storyteller', 'shop_wine', 'shop_tea', 'research'] }] },
  18: { id: 'lr18', title: '世家', conds: [
    { k: 'tier', t: 3, n: 6, text: '6 棟品級 3 以上民居', go: ['house_gentry'] },
    { k: 'types', ids: ['mansion_clan'], n: 1, text: '世家宅邸 1 座', go: ['mansion_clan'] }] },
  19: { id: 'lr19', title: '百肆', conds: [{ k: 'kinds', cls: ['stall', 'shop', 'ground', 'tavern', 'vice'], n: 12, text: '12 種店鋪攤位', go: ['shop_cloth', 'shop_herb', 'shop_rouge', 'shop_pawn', 'stall_cloth', 'stall_pottery', 'stall_book', 'stall_toy', 'shop_tea', 'shop_wine', 'shop_rice', 'stall_meat'] }] },
  20: { id: 'lr20', title: '興學宮', big: true, conds: [
    { k: 'cluster', ids: ['shop_book', 'stele', 'she_altar', 'research'], d: 12, text: '書肆、石碑、里社、研究院在 12 格內', go: ['research', 'she_altar', 'stele', 'shop_book'] },
    { k: 'axis', a: 'cul', f: 0.1, text: '文化軸達標', go: ['stele', 'censer', 'incense_burner', 'bookshelf', 'stall_book'] }] },
  21: { id: 'lr21', title: '守望相助', conds: [
    { k: 'cover', svc: 'safe', frac: 0.9, text: '9 成民居有守望', go: ['notice_board', 'gate', 'toll_gate'] },
    { k: 'kinds', cls: ['culture', 'scholar', 'tavern', 'monument'], n: 8, text: '8 種文娛建築', go: ['shop_book', 'stele', 'she_altar', 'censer', 'incense_burner', 'storyteller', 'shop_wine', 'shop_tea', 'research', 'paifang', 'bookshelf', 'stall_book'] }] },
  22: { id: 'lr22', title: '園林', conds: [{ k: 'axis', a: 'beau', f: 0.2, text: '美觀軸達標', go: ['rockery', 'tree_sakura', 'tree_peach', 'deco_pond', 'lotus', 'potted_plant', 'stone_lamp'] }] },
  23: { id: 'lr23', title: '百物', conds: [{ k: 'kindsAll', n: 100, text: '全城 100 種不同建築', go: [] }] },
  24: { id: 'lr24', title: '營建帝都', big: true, conds: [
    { k: 'tier', t: 4, n: 3, text: '3 棟品級 4 民居', go: ['mansion_great', 'mansion_clan', 'manor_estate'] },
    { k: 'axesAll', f: 0.06, text: '六軸皆有一定水準', go: [] }] },
  25: null
};

// 評語庫:最低軸 → 一句話(動森式)。{x} 由引擎代入
var CITY_PHRASE = {
  liv: '民生還差一點:多蓋水井與好一點的民居。',
  beau: '美觀還差一點:種些樹、花,挖個池塘。',
  ord: '秩序還差一點:鋪條路、立座望樓或告示牌。',
  cul: '文化還差一點:缺些書香,試試書肆、石碑、里社。',
  com: '商貿還差一點:多開幾種攤位與店鋪。',
  ind: '產業還差一點:田地與工坊要有人做,先蓋民居再蓋工坊。',
  none: '各方面都不錯,繼續擴大城市吧。'
};
