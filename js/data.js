const TW = 64, TH = 32, HL = 16;
const MAP_W = 56, MAP_H = 56, MAX_H = 2;

const T_GRASS = 0, T_LAKE = 1, T_RIVER = 2, T_ROAD = 3;

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
