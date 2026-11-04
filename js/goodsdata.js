// js/goodsdata.js — 生產鏈資料(PLAN_CITY.md §23,CT6a 最小可行版:T0~T2 + 5 條配方)。
// 載入順序:progdata.js、cityonly.js 之後、goods.js 之前(index.html、sw.js PRECACHE 同步)。
// 規則:生產鏈的所有可調數字只寫在本檔(全部 PLACEHOLDER,平衡最後統一做);其他程式只讀這裡。
// 擴充到 67 種:往 GOODS / RECIPES / GOODS_SOURCES 追加即可,tools/goods_lint.js 會驗證 id 唯一、配方引用、階層、無環。
// ES2017;不用 ?. ??。
//
// 新增的經營建築(只登錄 OBJECTS 與暫用外觀,見 art_deco2.js;解鎖等級見 progdata.js PROG_UNLOCK_ESTATE):
//   field_hemp 麻田(Lv1,外觀 = 田的別名)、loom_shop 織坊(Lv2,外觀 = 布攤的別名)、brewery 釀酒坊(Lv18 / ed_yuedan 月旦評,外觀 = 酒館的別名)。
// 沿用的現有建築(解鎖等級依 PLAN §23.2 提前):sawbench 木工棚 Lv1、smith_awning 打鐵舖 Lv3、shop_cloth 成衣鋪 Lv3、
//   mine_entrance 礦坑口 + ore_iron 鐵礦堆 Lv3;field_sprout / vegetable_plot / field_millet / field_wheat 沿用原等級。

// ───────── 1. 全域常數(PLACEHOLDER)─────────
const GOODS_HOUR_SEC = 120;                       // 「件 / 時」的 1 遊戲小時 = 幾個真實秒
const GOODS_TIER_PRICE = [2, 6, 18, 54, 160];     // 基價 P(t) = round(2 × 3^t)(§23.1.1)
const GOODS_CAP_BASE = [300, 150, 80, 40, 20];    // 每種貨品的階別基礎上限(§23.3.2)
const GOODS_SELL_MUL = 0.6;                       // 溢出自動賣給市集的倍率(× 基價)
const GOODS_ROAD_MUL = 0.5;                       // 工坊(T1 以上)未通路的產能倍率
const GOODS_NEAR_R = 6;                           // 礦脈 / 就近取料的搜尋半徑(格)
const GOODS_STEP_SEC = 1;                         // 線上結算間隔(秒)
const GOODS_PLAN_SEC = 5;                         // 工坊 / 道路連通判定的快取秒數
const GOODS_OFFLINE_STEPS = 48;                   // 離線最多分幾步(§23.3.6)
const GOODS_OFFLINE_MIN_STEP = 600;               // 離線每步至少幾秒
const GOODS_FARM_TOOL = { id: 'g_nongju', use: 0.05, bonus: 1.2 };   // 田每小時耗 0.05 農具;有貨 → 糧 ×1.2(§23.1.2)
// 道路連通判定:這些物件所在的格視同道路(橋、城門、階梯…)
const GOODS_ROADLIKE = ['bridge', 'gate', 'stairs', 'ramp', 'road_stone', 'toll_gate', 'gate_courtyard'];

// ───────── 2. 貨品(§23.1.2)─────────
// tier 0~4;res = 以 world.res 的該鍵存放(頂列資源,無上限、不進 inv);cap = 覆寫階別上限;price = 覆寫基價;w = 重量(日後商隊 / 運載用);
// legacy = 只為遷移舊材料而存在(尚無來源 / 用途);later = 已定義但來源建築尚未實作(CT6d)。cons 預留給 CT6c 居民消費類。
const GOODS = {
  // T0 原料
  wood:        { name: '木材',   icon: '🪵', tier: 0, res: 'wood', w: 2 },
  stone:       { name: '石材',   icon: '🧱', tier: 0, res: 'stone', w: 3 },
  g_liang:     { name: '糧',     icon: '🌾', tier: 0, cap: 200, cons: 'food', w: 1 },
  g_ma:        { name: '麻',     icon: '🌿', tier: 0, w: 1 },
  g_tiekuang:  { name: '鐵礦',   icon: '⛏️', tier: 0, w: 3 },
  g_taotu:     { name: '陶土',   icon: '🟤', tier: 0, later: true, w: 3 },
  g_zhu:       { name: '竹',     icon: '🎋', tier: 0, later: true, w: 2 },
  // T1 加工品
  g_muban:     { name: '木板',   icon: '🪵', tier: 1, w: 2 },
  mat_mabu:    { name: '麻布',   icon: '🧵', tier: 1, w: 1 },
  mat_tieding: { name: '鐵錠',   icon: '⬛', tier: 1, w: 3 },
  // T2 成品
  g_nongju:    { name: '農具',   icon: '🔧', tier: 2, w: 2 },
  g_yifu:      { name: '衣物',   icon: '👘', tier: 2, cons: 'cloth', w: 1 },
  // T3 工藝品(PLAN_INTERIORS §3 O1;科技 T3 成本與 T4 配方原料;上限 / 基價走階別表)
  g_qiqi:      { name: '漆器',   icon: '🏺', tier: 3, w: 2 },
  g_jin:       { name: '錦',     icon: '🎎', tier: 3, w: 1 },
  g_ciqi:      { name: '瓷器',   icon: '🍶', tier: 3, w: 3 },
  g_zhi:       { name: '紙',     icon: '📃', tier: 3, w: 1 },
  // T4 奢侈品(科技 T4 成本)
  g_yuqi:      { name: '玉器',   icon: '💎', tier: 4, w: 2 },
  g_yinqi:     { name: '銀器',   icon: '🥈', tier: 4, w: 2 },
  g_mingjiu:   { name: '名酒',   icon: '🍷', tier: 4, w: 2 },
  // 舊普材料(PLAN §23.1.3):id 與舊 PROG_MATS 相同,只供遷移與日後配方使用
  mat_zhujian: { name: '竹簡',   icon: '📜', tier: 1, legacy: true, w: 1 },
  mat_niupi:   { name: '牛皮',   icon: '🟫', tier: 1, legacy: true, w: 2 },
  mat_niujin:  { name: '牛筋',   icon: '〰️', tier: 1, legacy: true, w: 1 },
  mat_tongyou: { name: '桐油',   icon: '🛢️', tier: 1, legacy: true, w: 2 },
  mat_qingtong:{ name: '青銅',   icon: '🟨', tier: 1, legacy: true, w: 3 },
  mat_shengqi: { name: '生漆',   icon: '🟥', tier: 0, legacy: true, w: 1 },
  mat_jianyu:  { name: '雁翎',   icon: '🪶', tier: 0, legacy: true, w: 1 }
};
// 9 種舊普材料 → 貨品 id(同 id,§23.1.3)。遷移時複製 prog.mats[id] 進庫房
const GOODS_LEGACY_MATS = ['mat_mabu', 'mat_zhujian', 'mat_niupi', 'mat_tieding', 'mat_tongyou', 'mat_shengqi', 'mat_jianyu', 'mat_qingtong', 'mat_niujin'];

// ───────── 3. 原料點(§23.2.2;無輸入)─────────
// bld = 建築 type;out = 每遊戲小時產出;lv = 開放等級(對照 progdata.js,lint 驗證);farm = 吃農具加成;near = 需要 r 格內有某物件(礦脈)才出產
// 木 / 石由伐木場 / 採石場的 OBJECTS.prod 負責(沿用現行每秒刻度),不在此表,見 GOODS_RES_SOURCES
const GOODS_SOURCES = {
  e_field_sprout:   { bld: 'field_sprout',   out: { g_liang: 3 }, lv: 1, farm: true },
  e_vegetable_plot: { bld: 'vegetable_plot', out: { g_liang: 2 }, lv: 1 },
  e_field_hemp:     { bld: 'field_hemp',     out: { g_ma: 4 },     lv: 1 },
  e_field_millet:   { bld: 'field_millet',   out: { g_liang: 4 }, lv: 2, farm: true },
  e_mine_iron:      { bld: 'mine_entrance',  out: { g_tiekuang: 3 }, lv: 3, near: { type: 'ore_iron', r: 6 } },
  e_field_wheat:    { bld: 'field_wheat',    out: { g_liang: 5 }, lv: 11, farm: true }
};
const GOODS_RES_SOURCES = { lumber: 'wood', quarry: 'stone' };

// ───────── 4. 配方(§23.2.3)─────────
// bld = 可執行的建築 type 陣列;in/out = 每「件」輸出所需的輸入與輸出量;rate = 每遊戲小時輸出件數(建築 Lv1、勞力 100%);jobs = 職缺(勞力比掛點);
// lv = 開放等級;tech = 科技加成鍵(techMul('goods.' + id) 掛點,目前無節點 = ×1);opt = 選配料(預留);by = 副產(預留)
const RECIPES = {
  r_muban:   { name: '木板', bld: ['sawbench'],     in: { wood: 20 },                out: { g_muban: 1 },    rate: 2, lv: 1, jobs: 4, tech: null, opt: null },
  r_mabu:    { name: '麻布', bld: ['loom_shop'],    in: { g_ma: 2 },                 out: { mat_mabu: 1 },   rate: 2, lv: 2, jobs: 4, tech: null, opt: null },
  r_tieding: { name: '鐵錠', bld: ['smith_awning'], in: { g_tiekuang: 2, wood: 10 }, out: { mat_tieding: 1 }, rate: 2, lv: 3, jobs: 4, tech: null, opt: null },
  r_yifu:    { name: '衣物', bld: ['shop_cloth'],   in: { mat_mabu: 2 },             out: { g_yifu: 1 },     rate: 1, lv: 3, jobs: 6, tech: null, opt: null },
  r_nongju:  { name: '農具', bld: ['smith_awning'], in: { mat_tieding: 1, g_muban: 1 }, out: { g_nongju: 1 }, rate: 1, lv: 3, jobs: 6, tech: null, opt: null },
  // T3 / T4(PLAN_INTERIORS §3 O1;全部 PLACEHOLDER)。建築沿用 nl_objects.js 的科技解鎖物件(lv 欄僅供參考,lint 對科技解鎖建築不比對等級)
  r_qiqi:    { name: '漆器', bld: ['qi_qi_fang'],  in: { g_muban: 2, mat_mabu: 1 },       out: { g_qiqi: 1 },    rate: 1,   lv: 1, jobs: 6, tech: null, opt: null },
  r_jin:     { name: '錦',   bld: ['jin_fang'],    in: { mat_mabu: 4 },                   out: { g_jin: 1 },     rate: 1,   lv: 1, jobs: 6, tech: null, opt: null },
  r_ciqi:    { name: '瓷器', bld: ['ci_yao'],      in: { stone: 20, wood: 20 },           out: { g_ciqi: 1 },    rate: 1,   lv: 1, jobs: 6, tech: null, opt: null },
  r_zhi:     { name: '紙',   bld: ['zao_zhi'],     in: { g_ma: 3, wood: 10 },             out: { g_zhi: 1 },     rate: 1.5, lv: 1, jobs: 4, tech: null, opt: null },
  r_yuqi:    { name: '玉器', bld: ['yu_qi_fang'],  in: { stone: 30, mat_tieding: 1 },     out: { g_yuqi: 1 },    rate: 0.5, lv: 1, jobs: 6, tech: null, opt: null },
  r_yinqi:   { name: '銀器', bld: ['yin_lou'],     in: { g_tiekuang: 4, wood: 10 },       out: { g_yinqi: 1 },   rate: 0.5, lv: 1, jobs: 6, tech: null, opt: null },
  r_mingjiu: { name: '名酒', bld: ['brewery'],     in: { g_liang: 10, g_qiqi: 1 },        out: { g_mingjiu: 1 }, rate: 0.5, lv: 18, jobs: 6, tech: null, opt: null }
};

// ───────── 5. 查詢輔助(純函式,無外部相依)─────────
function goodsTier(id) { return GOODS[id] ? GOODS[id].tier : 0; }
function goodsName(id) { return GOODS[id] ? GOODS[id].name : id; }
function goodsPrice(id) {
  var g = GOODS[id];
  if (!g) return 0;
  return typeof g.price === 'number' ? g.price : GOODS_TIER_PRICE[g.tier];
}
// 基礎上限(不含庫房加成;res 貨品無上限回 Infinity)
function goodsCapBase(id) {
  var g = GOODS[id];
  if (!g || g.res) return Infinity;
  return typeof g.cap === 'number' ? g.cap : GOODS_CAP_BASE[g.tier];
}
// 某建築 type 可以跑的配方 id 陣列(依 RECIPES 宣告順序)
function goodsRecipesFor(bld) {
  return Object.keys(RECIPES).filter(function (rid) { return RECIPES[rid].bld.indexOf(bld) >= 0; });
}
// 某建築 type 對應的原料點定義 id 陣列
function goodsSourcesFor(bld) {
  return Object.keys(GOODS_SOURCES).filter(function (sid) { return GOODS_SOURCES[sid].bld === bld; });
}
// 本模組涉及的所有生產建築 type(原料點 + 工坊 + 伐木 / 採石);prog_check / lint 用
function goodsBuildingTypes() {
  var out = {};
  Object.keys(GOODS_SOURCES).forEach(function (s) { out[GOODS_SOURCES[s].bld] = true; });
  Object.keys(RECIPES).forEach(function (r) { RECIPES[r].bld.forEach(function (b) { out[b] = true; }); });
  return Object.keys(out);
}
