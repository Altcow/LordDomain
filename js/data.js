const TW = 64, TH = 32, HL = 16;
const MAP_W = 56, MAP_H = 56, MAX_H = 2;
// 板子尺寸(PLAN_BIGMAP B3):MAP_W/MAP_H = 戰陣/戰鬥板標準邊長(永遠 56,戰鬥檔案不動);
// 經營板邊長 EST_W/EST_H 由 BIGMAP_SIZE 決定(112 = 全開;可改 84 或 56 回退,56 = 與舊版相同)。經營路徑一律讀 world.W / world.H。
const BIGMAP_SIZE = 112;
const EST_W = BIGMAP_SIZE, EST_H = BIGMAP_SIZE;

const T_GRASS = 0, T_LAKE = 1, T_RIVER = 2, T_ROAD = 3;
// 純視覺地形:沙地 / 裂地(乾旱龜裂)/ 雪地。玩法一律等同草地(可走、可蓋、高度規則相同)。
// 判斷「是否為陸地草地類」一律用下列輔助函式,不要自行比對 T_GRASS;未知的大值(>= T_SAND)也當草地類,讀檔不崩潰。
const T_SAND = 4, T_CRACK = 5, T_SNOW = 6;
function isGroundTerrain(t) { return t === T_GRASS || (t >= T_SAND && t !== T_OCEAN); }   // 海洋(T_OCEAN)不是陸地
function terrainBase(t) { return t === T_OCEAN ? T_LAKE : (t >= T_SAND ? T_GRASS : t); }               // 規則用地形(沙/裂/雪 → 草地;海洋 → 湖,水上物件規則同湖)
// 人工地面(石板 / 夯土 / 水泥 / 鋼鐵 / 木棧板 / 木紋地板):id 只附加在 T_SNOW 之後,舊編號不動;玩法同草地(isGroundTerrain),
// 另有:可走路面(isPavedTerrain)、道路暢通指標(isRoadLikeTerrain)、物件白名單例外(農田類一律不可、自然類不可蓋在鋼鐵 / 水泥 / 木紋 / 木棧板)。
// 木棧板可鋪在湖 / 河上:鋪在水格上時 world.flow = T_PLANK_WET(水面在其下,只影響繪圖),其餘人工地面 flow 恆 0。
const T_STONEPAVE = 7, T_RAMMED = 8, T_CONCRETE = 9, T_STEEL = 10, T_PLANKDECK = 11, T_WOODFLOOR = 12;
const T_ART_LAST = T_WOODFLOOR, T_PLANK_WET = 1;   // T_ART_LAST = 人工地面最後一個 id
// 自然地面 13~18(純視覺,玩法同草地、不算人工 / 路面):泥土 / 岩地 / 裂土 / 黑土 / 叢林地面 / 紅土;只附加在人工地面之後,舊編號不動。
// 岩地不可種田(農田類白名單例外,見 terrainOn);黑土地耕作加成尚未實作。冬季:岩地不積雪(維持灰岩色),其餘同草地冷色。舊 App 讀到未知 id 視為草地。
const T_DIRT = 13, T_ROCK = 14, T_CRACKSOIL = 15, T_BLACKSOIL = 16, T_JUNGLE = 17, T_REDSOIL = 18;
const T_LAST = T_REDSOIL;
// 活的地形 19~21(有動畫,見 js/terrain_live.js):海洋(水,不可走,水上物件規則同湖)/ 沼澤(可走較慢、可蓋、不可種田)/ 火山灰(可走、可蓋、不可種樹 / 農田)。
// 只附加在自然地面之後;T_LAST 仍是「自然地面」最後 id,存檔 id 上限改看 T_MAXID;舊 App 讀到未知 id 視為草地。
const T_OCEAN = 19, T_SWAMP = 20, T_ASHLAND = 21, T_MAXID = T_ASHLAND;
function isLiveTerrain(t) { return t >= T_OCEAN && t <= T_MAXID; }
function isWaterTerrain(t) { return t === T_LAKE || t === T_RIVER || t === T_OCEAN; }
function isNaturalGround(t) { return t >= T_DIRT && t <= T_LAST; }
function isArtificialTerrain(t) { return t >= T_STONEPAVE && t <= T_ART_LAST; }
function isPavedTerrain(t) { return t === T_ROAD || (t >= T_STONEPAVE && t <= T_ART_LAST); }          // 路人 / 車輛可走
function isRoadLikeTerrain(t) { return t === T_ROAD || t === T_STONEPAVE || t === T_RAMMED || t === T_CONCRETE; }   // cityfx 路指標 / goods 路網(鋼鐵、木棧板、木紋地板不算)
// 物件白名單例外:farm(農田類,只能在草 / 道路外的農耕土壤)不可蓋在任何人工地面;nature(自然類植物)不可種在鋼鐵 / 水泥 / 木紋地板 / 木棧板
const TERRAIN_FARM_RE = /^field_|^vegetable_|^herb_garden$|^orchard$|^mulberry_grove$|^tea_garden$|^saltfield$|^beehive$/;
const TERRAIN_NATURE_RE = /^tree(_|$)|^deco_bamboo$|^deco_bush$|^flower_bed$|^ground_bamboo$/;
const TERRAIN_NO_NATURE = [T_CONCRETE, T_STEEL, T_PLANKDECK, T_WOODFLOOR];
function objTerrainClass(d) {
  if (d._tcls !== undefined) return d._tcls;
  let c = '', k;
  for (k in OBJECTS) if (OBJECTS[k] === d) { c = TERRAIN_FARM_RE.test(k) ? 'farm' : (TERRAIN_NATURE_RE.test(k) ? 'nature' : ''); break; }
  Object.defineProperty(d, '_tcls', { value: c, enumerable: false, writable: true });
  return c;
}
function terrainOn(d, t) {
  if (t >= T_STONEPAVE && t <= T_LAST) {
    const c = objTerrainClass(d);
    if (c === 'farm' && (t <= T_ART_LAST || t === T_ROCK)) return false;   // 農田類不可蓋在人工地面與岩地
    if (c === 'nature' && TERRAIN_NO_NATURE.indexOf(t) >= 0) return false;
  }
  if (t > T_LAST && typeof liveTerrainOn === 'function' && liveTerrainOn(d, t) === false) return false;   // 活地形的額外限制(terrain_live.js)
  return d.on.indexOf(terrainBase(t)) >= 0;      // 物件定義 d.on 是否允許放在地形 t
}

// 方向索引: 0=(-1,0) 1=(0,-1) 2=(+1,0) 3=(0,+1)
const DIRS = [[-1, 0], [0, -1], [1, 0], [0, 1]];
const DIR_ARROWS = ['↖', '↗', '↘', '↙'];

const RESOURCES = {
  coin: { name: '金幣', icon: '🪙' },
  wood: { name: '木材', icon: '🪵' },
  stone: { name: '石材', icon: '🧱' }
};
const START_RES = { coin: 300, wood: 100, stone: 60 };
const OFFLINE_CAP_SEC = 8 * 3600;
const OFFLINE_RATE = 0.5;
const REFUND_RATE = 0.5;
// 商店: 每單位金幣價, 一次買賣 SHOP_LOT 個
const SHOP = { wood: { buy: 4, sell: 1 }, stone: { buy: 6, sell: 2 } };
const SHOP_LOT = 10;

// 每日特賣: pct 為「折」(1~9); limit 為每件每日可購數量; give 只能含 SHOP 裡的資源(不可含 coin)
const DEAL_SEED = 'LD-DEALS-1';
const DEAL_LEGEND_CHANCE = 0.25;
// 顯示與產生順序: 傳說 → 稀有 → 少見 → 常見
const DEAL_RARITY = {
  legendary: { name: '傳說', color: '#e6b84a', pct: [1, 3], limit: 1, slots: 0 },
  rare:      { name: '稀有', color: '#b07ce8', pct: [3, 5], limit: 2, slots: 1 },
  uncommon:  { name: '少見', color: '#5ab4d8', pct: [5, 7], limit: 3, slots: 3 },
  common:    { name: '常見', color: '#9ea3ab', pct: [7, 9], limit: 5, slots: 5 }
};
const DEAL_POOL = [
  { id: 'c_wood',   rarity: 'common',    name: '木材小包',       icon: '🪵', give: { wood: 50 } },
  { id: 'c_stone',  rarity: 'common',    name: '石材小包',       icon: '🧱', give: { stone: 30 } },
  { id: 'c_mix',    rarity: 'common',    name: '雜貨小包',       icon: '📦', give: { wood: 30, stone: 20 } },
  { id: 'c_house',  rarity: 'common',    name: '民房建材包',     icon: '🏠', give: { wood: 25, stone: 10 } },
  { id: 'c_gate',   rarity: 'common',    name: '城門建材包',     icon: '🚪', give: { wood: 20, stone: 20 } },
  { id: 'c_bridge', rarity: 'common',    name: '橋梁建材包×5',   icon: '🌉', give: { wood: 40 } },
  { id: 'u_wood',   rarity: 'uncommon',  name: '木材中包',       icon: '🪵', give: { wood: 150 } },
  { id: 'u_stone',  rarity: 'uncommon',  name: '石材中包',       icon: '🧱', give: { stone: 100 } },
  { id: 'u_market', rarity: 'uncommon',  name: '市集建材包',     icon: '🏪', give: { wood: 50, stone: 40 } },
  { id: 'u_quarry', rarity: 'uncommon',  name: '採石場建材包×4', icon: '⛏️', give: { wood: 100 } },
  { id: 'r_wood',   rarity: 'rare',      name: '木材大包',       icon: '🪵', give: { wood: 400 } },
  { id: 'r_stone',  rarity: 'rare',      name: '石材大包',       icon: '🧱', give: { stone: 300 } },
  { id: 'r_market', rarity: 'rare',      name: '市集建材包×3',   icon: '🏪', give: { wood: 150, stone: 120 } },
  { id: 'l_palace', rarity: 'legendary', name: '城主府建材包',   icon: '🏯', give: { wood: 300, stone: 200 } },
  { id: 'l_chest',  rarity: 'legendary', name: '豐收寶箱',       icon: '🎁', give: { wood: 500, stone: 400 } }
];

// on: 可放置的地形; swap: 旋轉奇數次時長寬對調; cost: 建造成本; prod: 每秒產出; max: 同類建築數量上限; mil: 軍事類(工具列分組); unit: 所屬兵種營(出征容量見 units.js CAMP_POP)
const OBJECTS = {
  tree:   { name: '樹木', icon: '🌳', w: 1, h: 1, on: [T_GRASS], drag: true, cost: { coin: 10 } },
  stone:  { name: '石頭', icon: '🪨', w: 1, h: 1, on: [T_GRASS], drag: true, cost: { coin: 8 } },
  house:  { name: '民房', icon: '🏠', w: 2, h: 2, on: [T_GRASS], cost: { wood: 25, stone: 10 }, prod: { coin: 0.12 } },
  lumber: { name: '伐木場', icon: '🪓', w: 2, h: 2, on: [T_GRASS], cost: { coin: 60, stone: 15 }, prod: { wood: 0.15 } },
  quarry: { name: '採石場', icon: '⛏️', w: 2, h: 2, on: [T_GRASS], cost: { coin: 60, wood: 25 }, prod: { stone: 0.08 } },
  market: { name: '市集', icon: '🏪', w: 2, h: 2, on: [T_GRASS], cost: { coin: 80, wood: 50, stone: 40 }, prod: { coin: 0.3 } },
  palace: { name: '城主府', icon: '🏯', w: 4, h: 4, max: 1, on: [T_GRASS], cost: { coin: 400, wood: 300, stone: 200 }, prod: { coin: 0.6, wood: 0.15, stone: 0.15 } },
  gate:   { name: '城門', icon: '🚪', w: 3, h: 1, on: [T_GRASS, T_ROAD], swap: true, cost: { coin: 30, wood: 20, stone: 20 } },
  wall:   { name: '城牆', icon: '🧱', w: 1, h: 1, on: [T_GRASS, T_ROAD], drag: true, cost: { stone: 3 } },
  stairs: { name: '階梯', icon: '🪜', w: 1, h: 1, on: [T_GRASS, T_ROAD], cost: { stone: 5 } },
  // 斜坡:寬 2 格、沿坡 1 格(footprint 以 swap 處理:rot 偶數為 1×2,奇數為 2×1);上坡方向 DIRS[rot] 與 stairs 相同
  ramp: { name: '斜坡', icon: '📐', w: 1, h: 2, swap: true, on: [T_GRASS, T_ROAD], cost: { coin: 8, stone: 4 }, side: 'both', cb: { block: 'none', hp: null, cat: null } },
  bridge: { name: '橋梁', icon: '🌉', w: 1, h: 1, on: [T_LAKE, T_RIVER], cost: { wood: 8 } },
  research: { name: '科研院', icon: '📜', w: 3, h: 3, max: 1, on: [T_GRASS], cost: { coin: 300, wood: 200, stone: 150 } },
  // 軍事建築（PLAN 12.10）：mil = 工具列分組；unit = 所屬兵種（出征容量）；本身無產出
  archer:   { name: '弓箭營', icon: '🏹', w: 3, h: 3, max: 2, mil: true, on: [T_GRASS], cost: { coin: 160, wood: 120, stone: 30 }, unit: 'archer' },
  shield:   { name: '盾兵營', icon: '🛡️', w: 3, h: 3, max: 2, mil: true, on: [T_GRASS], cost: { coin: 150, wood: 80, stone: 60 }, unit: 'shield' },
  cavalry:  { name: '騎兵營', icon: '🐎', w: 4, h: 3, max: 2, mil: true, on: [T_GRASS], swap: true, cost: { coin: 300, wood: 150, stone: 50 }, unit: 'cavalry' },
  siege:    { name: '器械營', icon: '⚙️', w: 3, h: 3, max: 1, mil: true, on: [T_GRASS], cost: { coin: 250, wood: 250, stone: 120 }, unit: 'siege' },
  hospital: { name: '醫館',   icon: '🌿', w: 2, h: 2, mil: true, on: [T_GRASS], cost: { coin: 120, wood: 40, stone: 30 }, retired: true }
};

const PALETTES = {
  spring: {
    bg: '#1d2a33', grass: ['#8fcf7a', '#86c673', '#98d684'], road: '#d9c9a0', roadEdge: '#b9a678',
    water: '#5ab4d8', waterHi: '#e6f6ff', foam: '#ffffff', cliff: '#8a8f99',
    canopyDark: '#e58fb0', canopyLight: '#ffc4d8', trunk: '#7a5738', stone: '#9ea3ab',
    houseWall: '#f2e6cf', houseRoof: '#5d6f8c', palaceWall: '#b83a34', palaceRoof: '#3b3f52', gold: '#e6b84a', wood: '#a47a4c'
  },
  summer: {
    bg: '#1a2d38', grass: ['#6cc35a', '#62b950', '#73cd62'], road: '#dccaa0', roadEdge: '#b9a678',
    water: '#3fa6d6', waterHi: '#dff4ff', foam: '#ffffff', cliff: '#858a93',
    canopyDark: '#2f8f3f', canopyLight: '#5bbd55', trunk: '#6e4d30', stone: '#9ea3ab',
    houseWall: '#f2e6cf', houseRoof: '#5d6f8c', palaceWall: '#b83a34', palaceRoof: '#3b3f52', gold: '#e6b84a', wood: '#a47a4c'
  },
  autumn: {
    bg: '#2a2326', grass: ['#c4b25a', '#b9a752', '#cdbb64'], road: '#d6bf92', roadEdge: '#b09a6c',
    water: '#5a9fbf', waterHi: '#f2f0e0', foam: '#fff6e0', cliff: '#8a827c',
    canopyDark: '#d9692a', canopyLight: '#f0a43a', trunk: '#6e4d30', stone: '#a59f98',
    houseWall: '#efdfc4', houseRoof: '#7a5448', palaceWall: '#a8352f', palaceRoof: '#3b3340', gold: '#e6b84a', wood: '#a47a4c'
  },
  winter: {
    bg: '#232c38', grass: ['#e9f1f7', '#dfeaf2', '#f2f7fb'], road: '#cfd6dc', roadEdge: '#a9b3bc',
    water: '#7fb6d1', waterHi: '#ffffff', foam: '#ffffff', cliff: '#8e98a4',
    canopyDark: '#3f7a5a', canopyLight: '#ffffff', trunk: '#5b4631', stone: '#b4bcc4',
    houseWall: '#f2e6cf', houseRoof: '#e8eef4', palaceWall: '#b83a34', palaceRoof: '#cfd8e2', gold: '#e6b84a', wood: '#a47a4c'
  }
};

let PAL = PALETTES.spring;

// rq* 繪圖薄介面的 c2d 後備(PLAN_RENDER R0.5):js/glr.js 載入後以完整版覆寫;未載入(部分測試 / 工具頁)時行為 = 原本的 ctx 呼叫
if (typeof rqBegin === 'undefined') {
  var rqBegin = function () { return false; }, rqView = function () {}, rqFlush = function () {}, rqEnd = function () {};
  var rqOv = function (ctx) { return ctx; }, rqActive = function () { return false; };
  var rqSave = function (ctx) { ctx.save(); }, rqRestore = function (ctx) { ctx.restore(); };
  var rqAlpha = function (ctx, a) { ctx.globalAlpha = a; }, rqAlphaMul = function (ctx, a) { ctx.globalAlpha *= a; };
  var rqTransform = function (ctx, a, b, c, d, e, f) { ctx.transform(a, b, c, d, e, f); };
  var rqTranslate = function (ctx, x, y) { ctx.translate(x, y); }, rqScale = function (ctx, x, y) { ctx.scale(x, y); };
  var rqScope2D = function (ctx) { return ctx; }, rqScopeEnd = function () {};
  var rqSprite = function (ctx, spr, x, y, w, h, alpha) {
    if (alpha === undefined || alpha === 1) { ctx.drawImage(spr.cv, x, y, w, h); return; }
    var ga = ctx.globalAlpha; ctx.globalAlpha = ga * alpha; ctx.drawImage(spr.cv, x, y, w, h); ctx.globalAlpha = ga;
  };
  var rqPoly4 = function (ctx, x0, y0, x1, y1, x2, y2, x3, y3, color) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  var rqRect = function (ctx, x, y, w, h, color, alpha) {
    if (alpha === undefined || alpha === 1) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); return; }
    var ga = ctx.globalAlpha; ctx.globalAlpha = ga * alpha; ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.globalAlpha = ga;
  };
  var rqDisc = function (ctx, cx, cy, rx, ry, color) {
    ctx.fillStyle = color; ctx.beginPath();
    if (rx === ry) ctx.arc(cx, cy, rx, 0, Math.PI * 2); else ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  var rqLine = function (ctx, x0, y0, x1, y1, lw, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
  };
  var rqDepthSetup = function () {}, rqDepth = function () {}, rqAbort = function () {}, rqTerrain = function () { return false; }, rqGlow = function () { return false; };
}
