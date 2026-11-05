// js/caravan_goods.js — 走鏢資料與機率表(PLAN_CARAVAN.md「使用者決議(2026-11-04):高階貨品 T1~T4 歸入走鏢」)。
// 本檔擁有「馬車品階 → T1~T4 貨物機率表」;所有數字皆 PLACEHOLDER(平衡最後統一做),其他程式只讀不寫。
// 載入順序:goodsdata.js、panelmgr.js 之後、caravan.js 之前(index.html、sw.js PRECACHE 同步)。純資料 + 純函式,不碰 DOM / 存檔。
// 規則(使用者決議):品階機率只由「馬車品階」決定;護衛與路線風險只影響「掉落件數」,不影響品階機率。
// 貨品來源:不另立貨品表,直接從 GOODS 依 tier 取(產業鏈代理持續補 T3/T4;該階尚無貨品時退用較低階最高者,與 citytech.js techGoodsIds 同策略)。
// ES2017;不用 ?. ??。

// ───────── 1. 馬車(白、青、藍、紫、金)─────────
// cost = 購買金幣(白車免費、開局即有);draws = 基本抽數(每抽 1 種貨);slots = 可派鏢師數;sec = 單趟基本秒數(真實時間);
// odds = [T1, T2, T3, T4] 權重(總和不必為 100,內部正規化)
const CARAVAN_CARTS = [
  { id: 'white',  name: '白', title: '白板車',   color: '#d8d8d8', cost: 0,      draws: 4,  slots: 1, sec: 300, odds: [75, 22, 3, 0] },
  { id: 'green',  name: '青', title: '青篷車',   color: '#6fcf8a', cost: 3000,   draws: 6,  slots: 1, sec: 420, odds: [50, 38, 11, 1] },
  { id: 'blue',   name: '藍', title: '藍幔良駒車', color: '#5aa8ff', cost: 12000,  draws: 8,  slots: 2, sec: 600, odds: [30, 40, 25, 5] },
  { id: 'purple', name: '紫', title: '紫蓋大車', color: '#b27ae8', cost: 40000,  draws: 10, slots: 2, sec: 780, odds: [15, 35, 35, 15] },
  { id: 'gold',   name: '金', title: '金根官車', color: '#e6b84a', cost: 120000, draws: 12, slots: 3, sec: 900, odds: [5, 25, 40, 30] }
];

// 每抽的件數範圍 [最少, 最多],依抽到的貨品階別(高階少、低階多)
const CARAVAN_QTY = { 1: [3, 5], 2: [2, 3], 3: [1, 2], 4: [1, 1] };

// ───────── 2. 路線 ─────────
// fee = 保鑣費(金幣,出發時付);secMul = 時間倍率;risk = 基本受阻機率;yieldMul = 件數倍率(只影響件數);power = 建議鏢師戰力合計
// 路線地圖(caravanui.js 程式繪製):hall = 開放所需鏢局等級;town = 目的地城鎮名(魔幻外觀不顯示);mx,my = 地圖節點座標;cx,cy = 路線彎曲控制點(皆為 CARAVAN_MAP 座標)
const CARAVAN_ROUTES = [
  { id: 'near', name: '近郊官道', fee: 100, secMul: 1,   risk: 0.10, yieldMul: 1,   power: 2,  hall: 1, town: '臨亭集', mx: 74,  my: 58,  cx: 112, cy: 98 },
  { id: 'hill', name: '山間小路', fee: 300, secMul: 1.5, risk: 0.25, yieldMul: 1.3, power: 6,  hall: 1, town: '山陽鎮', mx: 254, my: 46,  cx: 222, cy: 104 },
  { id: 'far',  name: '遠方商道', fee: 800, secMul: 2.2, risk: 0.40, yieldMul: 1.7, power: 12, hall: 2, town: '雒陽',   mx: 262, my: 160, cx: 170, cy: 176 }
];
// 地圖畫布(viewBox)與本城節點
const CARAVAN_MAP = { w: 320, h: 210, hx: 150, hy: 110 };

// 鏢局等級(PLAN_CARAVAN §2.1;遊戲尚無鏢局建築,以官階代用:cardsRankLv() ≥ rank 即達該級;PLACEHOLDER)
// trips = 同時出隊上限;shed = 車棚(持有馬車總數上限,買車時檢查)
const CARAVAN_HALL = [
  { lv: 1, rank: 0, trips: 1, shed: 4 },
  { lv: 2, rank: 3, trips: 2, shed: 6 },
  { lv: 3, rank: 5, trips: 3, shed: 8 }
];
const CARAVAN_WHITE_EXTRA = 500;    // 白車開局送 1 輛;再添購每輛的價錢(PLACEHOLDER)

// ───────── 3. 結算 ─────────
const CARAVAN_POWER_K = 0.02;       // 每 1 點鏢師戰力降低的受阻機率
const CARAVAN_FAIL_SHARE = 0.4;     // 受阻機率中,有多少比例是「全毀」(其餘為「受阻」)
const CARAVAN_GREAT_P = 0.10;       // 沒受阻時的「大成功」機率
const CARAVAN_PFAIL_MIN = 0.03;
const CARAVAN_PFAIL_MAX = 0.85;
// 結果對件數的倍率(只影響件數,不影響品階機率)
const CARAVAN_OUTCOMES = {
  great:   { name: '大成功', mul: 1.5 },
  ok:      { name: '平安歸來', mul: 1 },
  blocked: { name: '路上受阻', mul: 0.6 },
  fail:    { name: '遭劫損失慘重', mul: 0.2 }
};

// ───────── 4. 次數與規模 ─────────
const CARAVAN_DAILY_MAX = 3;        // 每個本機日最多出車次數
const CARAVAN_LOG_MAX = 10;         // 保留的戰果紀錄筆數
const CARAVAN_ROSTER_MAX = 12;      // 名冊上限
const CARAVAN_POOL_SIZE = 4;        // 每日招募候選人數
const CARAVAN_WAGE_K = 20;          // 鏢師每趟出勤費 = 戰力 × 此值
const CARAVAN_HIRE_K = 150;         // 僱用費 = round(此值 × 戰力^1.5)

// ───────── 5. 鏢師(30 位頭像,固定人物;戰力由編號決定,存檔只記編號)─────────
const CARAVAN_ESCORT_COUNT = 30;
const CARAVAN_SURNAMES = ['趙', '錢', '孫', '李', '周', '吳', '鄭', '王', '馮', '陳', '衛', '蔣', '沈', '韓', '楊', '朱', '秦', '許', '何', '呂', '施', '張', '孔', '曹', '嚴', '華', '金', '魏', '陶', '姜'];
const CARAVAN_GIVEN = ['鐵山', '長風', '破虎', '飛雲', '震嶽', '承志', '無忌', '懷遠', '定邦', '奔雷', '嘯天', '雲海', '千里', '懷瑾', '守信', '鎮北', '橫刀', '孤雁', '踏雪', '追電', '逐日', '安平', '烈火', '寒松', '嘉樹', '遠山', '朔風', '歸舟', '行健', '雄關'];

// ───────── 6. 純函式 ─────────
// 小型 PRNG(mulberry32):同 seed 同序列,出車時預抽種子 → 線上 / 離線結算結果一致
function caravanRng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 魔幻世界外觀改名(FX_CARAVAN,fx_goods_data.js;fxPack() 為 null 時回原名;只換顯示名,數值不變)
function caravanFx() {
  var p = (typeof goodsPackNow === 'function') ? goodsPackNow() : null;
  return p && typeof FX_CARAVAN !== 'undefined' && FX_CARAVAN[p] ? FX_CARAVAN[p] : null;
}
function caravanOfficeName() { var f = caravanFx(); return f && f.office ? f.office : '走鏢'; }
function caravanEscortTitle() { var f = caravanFx(); return f && f.escortTitle ? f.escortTitle : '鏢師'; }
function caravanCartTitle(c) { var f = caravanFx(); return (f && f.carts && f.carts[c.id]) || c.title; }
function caravanRouteName(r) { var f = caravanFx(); return (f && f.routes && f.routes[r.id]) || r.name; }
function caravanRouteTown(r) { return caravanFx() ? '' : (r.town || ''); }
function caravanCart(id) {
  for (var i = 0; i < CARAVAN_CARTS.length; i++) if (CARAVAN_CARTS[i].id === id) return CARAVAN_CARTS[i];
  return null;
}
function caravanRoute(id) {
  for (var i = 0; i < CARAVAN_ROUTES.length; i++) if (CARAVAN_ROUTES[i].id === id) return CARAVAN_ROUTES[i];
  return null;
}
// 路線地圖:本城 → 目的地的二次貝茲曲線上,參數 f(0~1)的座標 [x, y]
function caravanMapPos(routeId, f) {
  var r = caravanRoute(routeId), M = CARAVAN_MAP, u;
  if (!r) return [M.hx, M.hy];
  f = f < 0 ? 0 : (f > 1 ? 1 : f);
  u = 1 - f;
  return [u * u * M.hx + 2 * u * f * r.cx + f * f * r.mx, u * u * M.hy + 2 * u * f * r.cy + f * f * r.my];
}
// 一趟在地圖上的「去程」進度:前半段 0~1(本城 → 目的地);已抵達目的地(過半)回 -1 = 不畫
function caravanMapGo(trip, now) {
  var dur = trip.t1 - trip.t0, f;
  if (!(dur > 0)) return -1;
  f = (now - trip.t0) / dur;
  if (f >= 0.5) return -1;
  return f <= 0 ? 0 : f * 2;
}
// 某馬車的 T1~T4 機率(正規化,和 = 1;回傳長度 4 的陣列)
function caravanOdds(cartId) {
  var c = caravanCart(cartId), sum = 0, i, out = [];
  if (!c) return [0, 0, 0, 0];
  for (i = 0; i < 4; i++) sum += Math.max(0, c.odds[i] || 0);
  for (i = 0; i < 4; i++) out.push(sum > 0 ? Math.max(0, c.odds[i] || 0) / sum : 0);
  return out;
}
// 某階的可抽貨品 id(依 id 排序,供確定性抽選)。該階沒有貨品時退用較低階最高者;全無則 []
function caravanPool(tier) {
  var t = tier, ids;
  if (typeof GOODS === 'undefined') return [];
  while (t >= 1) {
    ids = (typeof goodsIds === 'function' ? goodsIds() : Object.keys(GOODS)).filter(function (g) { return GOODS[g].tier === t && !GOODS[g].res && !GOODS[g].legacy; }).sort();
    if (ids.length) return ids;
    t--;
  }
  return [];
}
// 受阻機率:路線風險 − 鏢師戰力 × K,夾在 [MIN, MAX]
function caravanPFail(routeId, power) {
  var r = caravanRoute(routeId);
  if (!r) return CARAVAN_PFAIL_MAX;
  return Math.max(CARAVAN_PFAIL_MIN, Math.min(CARAVAN_PFAIL_MAX, r.risk - CARAVAN_POWER_K * Math.max(0, power || 0)));
}
// 單趟開獎:回傳 { outcome, draws, items:{貨品id:數量}, tiers:[T1..T4 抽中次數] };seed 決定一切
function caravanRoll(cartId, routeId, power, seed) {
  var cart = caravanCart(cartId), route = caravanRoute(routeId), rng = caravanRng(seed), out = { outcome: 'ok', draws: 0, items: {}, tiers: [0, 0, 0, 0] };
  if (!cart || !route) return out;
  var pf = caravanPFail(routeId, power), r = rng();
  if (r < pf * CARAVAN_FAIL_SHARE) out.outcome = 'fail';
  else if (r < pf) out.outcome = 'blocked';
  else if (rng() < CARAVAN_GREAT_P) out.outcome = 'great';
  out.draws = Math.max(1, Math.round(cart.draws * route.yieldMul * CARAVAN_OUTCOMES[out.outcome].mul));
  var odds = caravanOdds(cartId), i, k, x, tier, pool, q, id;
  for (i = 0; i < out.draws; i++) {
    x = rng(); tier = 4;
    for (k = 0; k < 4; k++) { if (x < odds[k]) { tier = k + 1; break; } x -= odds[k]; }
    if (odds[tier - 1] <= 0) tier = 1;
    pool = caravanPool(tier);
    if (!pool.length) continue;
    id = pool[Math.floor(rng() * pool.length) % pool.length];
    q = CARAVAN_QTY[tier] || [1, 1];
    q = q[0] + Math.floor(rng() * (q[1] - q[0] + 1));
    out.items[id] = (out.items[id] || 0) + q;
    out.tiers[tier - 1]++;
  }
  return out;
}

// 鏢師:編號 1..30
function caravanEscortName(id) {
  return CARAVAN_SURNAMES[(id * 7) % CARAVAN_SURNAMES.length] + CARAVAN_GIVEN[(id * 11 + 3) % CARAVAN_GIVEN.length];
}
function caravanEscortPower(id) {   // 1~10,偏低(強者稀少)
  var r = caravanRng(id * 7919 + 17)();
  return 1 + Math.min(9, Math.floor(Math.pow(r, 1.6) * 10));
}
function caravanEscortGrade(power) { return power >= 9 ? '絕' : power >= 7 ? '精' : power >= 4 ? '良' : '普'; }
function caravanEscortHire(id) { return Math.round(CARAVAN_HIRE_K * Math.pow(caravanEscortPower(id), 1.5)); }
function caravanEscortWage(id) { return caravanEscortPower(id) * CARAVAN_WAGE_K; }
function caravanEscortImg(id) { return 'assets/portraits/biaoshi/biaoshi_' + (id < 10 ? '0' : '') + id + '.webp'; }
function caravanEscortValid(id) { return typeof id === 'number' && id >= 1 && id <= CARAVAN_ESCORT_COUNT && Math.floor(id) === id; }
