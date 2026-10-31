const SAVE_KEY = 'lorddomain.save.v1';
const ID_KEY = 'lorddomain.id.v1';

// 暫態（不存檔）。mode 名與棋盤名（world.board）不同
const game = {
  mode: 'estate',   // 'estate' | 'battleDesign' | 'attack' | 'replay' | 'visit' | 'fishing'；啟動時一律 'estate'
  phase: '',        // attack 時：'muster' | 'scout' | 'march' | 'result'
  scoutLeft: 0,     // 觀察期剩餘秒數
  backup: null,     // boardBackup() 存的自己的兩個棋盤；非 null 代表 world 目前載入的是別人的地圖
  target: null,     // 本次進攻目標 { kind, refId, snap, code }
  sel: -1           // 觀察期/戰鬥中點選的建築索引，-1 = 無
};
// 棋盤圖層（switchBoard / boardBackup 交換的鍵）；物件保留欄位（戰鬥陣用；facing 見 PLAN_TD_MASTER §15.2）
const BOARD_KEYS = ['terrain', 'height', 'flow', 'block', 'zone', 'objects', 'marks'];
const OBJ_KEEP = ['facing', 'dev', 'trig', 'mimic'];

const world = {
  terrain: new Uint8Array(MAP_W * MAP_H),
  height: new Uint8Array(MAP_W * MAP_H),
  flow: new Uint8Array(MAP_W * MAP_H),
  block: new Uint8Array(MAP_W * MAP_H),
  zone: new Uint8Array(MAP_W * MAP_H),
  marks: newMarks(),
  occ: new Int16Array(MAP_W * MAP_H),
  objects: [],
  objDiag: [],
  board: 'estate',
  stash: null,
  record: { atk: { win: 0, lose: 0, stars: 0, merit: 0 }, def: { win: 0, lose: 0 } },
  npcBest: {},
  raid: { last: 0, seq: 0 },
  res: Object.assign({}, START_RES),
  lastTs: Date.now(),
  deals: { day: '', bought: {} },
  tech: { done: [], cur: null }
};
let dealCache = null;

const idx = (x, y) => y * MAP_W + x;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

function footprint(type, rot) {
  const d = OBJECTS[type];
  return d.swap && rot % 2 === 1 ? [d.h, d.w] : [d.w, d.h];
}

function rebuildOcc() {
  world.occ.fill(0);
  world.objDiag = [];
  world.objects.forEach((o, n) => {
    const [w, h] = footprint(o.type, o.rot);
    for (let yy = o.y; yy < o.y + h; yy++)
      for (let xx = o.x; xx < o.x + w; xx++) world.occ[idx(xx, yy)] = n + 1;
    const key = (o.x + w - 1) + (o.y + h - 1);
    (world.objDiag[key] = world.objDiag[key] || []).push(o);
  });
}

// 朝向（0~3）；facing 缺省取 rot（PLAN_TD_MASTER §15.2）
function objFacing(o) { return o.facing != null ? (o.facing & 3) : ((o.rot | 0) & 3); }
function sideOf(type) { return OBJECTS[type].side || 'estate'; }
function hasType(type) { return Object.prototype.hasOwnProperty.call(OBJECTS, type); }

function newMarks() { return { deploy: [], rally: [], aiEntry: [] }; }

function newBoard() {
  const N = MAP_W * MAP_H;
  return {
    terrain: new Uint8Array(N), height: new Uint8Array(N), flow: new Uint8Array(N),
    block: new Uint8Array(N), zone: new Uint8Array(N),
    objects: [], marks: newMarks()
  };
}

function liveBoard() {
  const b = {};
  BOARD_KEYS.forEach(k => { b[k] = world[k]; });
  return b;
}

// 清空現役棋盤（不動 res、lastTs）
function clearBoard() {
  world.terrain.fill(0); world.height.fill(0); world.flow.fill(0);
  world.block.fill(0); world.zone.fill(0);
  world.objects = [];
  world.marks = newMarks();
  rebuildOcc();
}

// 交換現役與暫存棋盤（O(1) 交換參考）。備份中不可切換
function switchBoard(to) {
  if (to !== 'estate' && to !== 'camp') return;
  if (game.backup || world.board === to) return;
  if (world.stash === null) world.stash = newBoard();
  BOARD_KEYS.forEach(k => { const t = world[k]; world[k] = world.stash[k]; world.stash[k] = t; });
  world.board = to;
  rebuildOcc();
  pendClear();
}

// 自己的棋盤（考慮 game.backup 與 world.board）；camp 可能為 null
function ownBoard(which) {
  if (game.backup) return game.backup.board === which ? game.backup.active : game.backup.stash;
  return world.board === which ? liveBoard() : world.stash;
}
function estateBoard() { return ownBoard('estate'); }
function campBoard() { return ownBoard('camp'); }
function estateObjects() { const b = estateBoard(); return b ? b.objects : []; }
function campObjects() { const b = campBoard(); return b ? b.objects : []; }

// 進攻 / 看錄影 / 參觀前收起自己的兩個棋盤；world 換成空的經營棋盤
function boardBackup() {
  if (game.backup) return;
  game.backup = { board: world.board, active: liveBoard(), stash: world.stash };
  const nb = newBoard();
  BOARD_KEYS.forEach(k => { world[k] = nb[k]; });
  world.board = 'estate';
  world.stash = null;
  pendClear();
  rebuildOcc();
}

function boardRestore() {
  const b = game.backup;
  if (!b) return;
  BOARD_KEYS.forEach(k => { world[k] = b.active[k]; });
  world.board = b.board;
  world.stash = b.stash;
  game.backup = null;
  rebuildOcc();
}

// 物件存檔格式：標準欄位 + facing；keep 時另帶 OBJ_KEEP 白名單欄位
function objSave(o, keep) {
  const r = { type: o.type, x: o.x, y: o.y, rot: o.rot };
  if (keep) OBJ_KEEP.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; });
  r.facing = objFacing(o);
  return r;
}

function boardToJSON(bd) {
  return {
    v: 1,
    terrain: Array.from(bd.terrain), height: Array.from(bd.height), flow: Array.from(bd.flow),
    block: Array.from(bd.block), zone: Array.from(bd.zone),
    objects: bd.objects.map(o => objSave(o, true)),
    marks: JSON.parse(JSON.stringify(bd.marks))
  };
}

function normMarks(v) {
  const m = v && typeof v === 'object' ? v : {};
  const arr = a => (Array.isArray(a) ? JSON.parse(JSON.stringify(a)) : []);
  return { deploy: arr(m.deploy), rally: arr(m.rally), aiEntry: arr(m.aiEntry) };
}

// 失敗回 null
function boardFromJSON(j) {
  try {
    if (!j || typeof j !== 'object' || j.v !== 1) return null;
    const N = MAP_W * MAP_H, b = newBoard();
    ['terrain', 'height', 'flow', 'block', 'zone'].forEach(k => {
      if (!Array.isArray(j[k]) || j[k].length !== N) throw new Error('layer ' + k);
      b[k] = Uint8Array.from(j[k]);
    });
    b.objects = (Array.isArray(j.objects) ? j.objects : [])
      .filter(o => o && typeof o.type === 'string' && hasType(o.type) && Number.isInteger(o.x) && Number.isInteger(o.y) &&
        o.x >= 0 && o.y >= 0 && o.x < MAP_W && o.y < MAP_H)
      .map(o => {
        const r = { type: o.type, x: o.x, y: o.y, rot: (o.rot | 0) & 3 };
        OBJ_KEEP.forEach(k => { if (k !== 'facing' && o[k] !== undefined) r[k] = o[k]; });
        r.facing = o.facing != null ? (o.facing & 3) : r.rot;
        return r;
      });
    b.marks = normMarks(j.marks);
    return b;
  } catch (e) {
    return null;
  }
}

// 戰陣起點：地形 / 高度 / 河流路面複製經營基地；只帶 side 為 both 的物件；block/zone/marks 清空
function copyEstateToCamp() {
  if (world.board !== 'camp') return false;
  const e = estateBoard();
  world.terrain.set(e.terrain); world.height.set(e.height); world.flow.set(e.flow);
  world.block.fill(0); world.zone.fill(0);
  world.objects = e.objects.filter(o => sideOf(o.type) === 'both').map(o => objSave(o, true));
  world.marks = newMarks();
  rebuildOcc();
  return true;
}

// 解鎖閘門（PLAN_TD_MASTER §3.6）：目前一律 true；日後只改這裡
function isUnlocked(kind, id) { return true; }

// 目前模式可否放置此建築（side、退役、解鎖）；attack/replay/visit/fishing 只看解鎖
function sideOk(type) {
  if (!hasType(type) || !isUnlocked('obj', type)) return false;
  const d = OBJECTS[type];
  if (game.mode === 'estate' || game.mode === 'battleDesign') {
    if (d.retired) return false;
    const s = sideOf(type);
    if (game.mode === 'estate' ? (s !== 'estate' && s !== 'both') : (s !== 'camp' && s !== 'both')) return false;
  }
  return true;
}

function countObjects(type) {
  return world.objects.filter(o => o.type === type).length;
}

function canPlace(type, x, y, rot) {
  if (!sideOk(type)) return false;
  const d = OBJECTS[type];
  if (d.max && countObjects(type) >= d.max) return false;
  const [w, h] = footprint(type, rot);
  if (x < 0 || y < 0 || x + w > MAP_W || y + h > MAP_H) return false;
  const h0 = world.height[idx(x, y)];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = idx(xx, yy);
      if (world.occ[i] || world.height[i] !== h0) return false;
      if (d.on.indexOf(world.terrain[i]) < 0) return false;
    }
  }
  return true;
}

function canAfford(cost) {
  for (const k in cost) if ((world.res[k] || 0) < cost[k]) return false;
  return true;
}

function spend(cost) {
  for (const k in cost) world.res[k] -= cost[k];
}

function gain(cost, rate) {
  for (const k in cost) world.res[k] += Math.floor(cost[k] * rate);
}

function place(type, x, y, rot) {
  world.objects.push({ type: type, x: x, y: y, rot: rot, facing: rot });
  rebuildOcc();
}

function removeObjectAt(x, y, refund) {
  const n = world.occ[idx(x, y)];
  if (!n) return false;
  const o = world.objects[n - 1];
  if (refund) gain(objCost(o.type), REFUND_RATE);
  world.objects.splice(n - 1, 1);
  rebuildOcc();
  return true;
}

function paintTerrain(x, y, t, flowDir) {
  removeObjectAt(x, y, false);
  const i = idx(x, y);
  world.terrain[i] = t;
  world.flow[i] = t === T_RIVER ? flowDir : 0;
}

function changeHeight(x, y, delta) {
  const i = idx(x, y);
  if (world.occ[i]) return false;
  const nh = Math.max(0, Math.min(MAX_H, world.height[i] + delta));
  if (nh === world.height[i]) return false;
  world.height[i] = nh;
  return true;
}

function productionPerSec() {
  const total = {};
  estateObjects().forEach(o => {
    const p = OBJECTS[o.type].prod;
    if (!p) return;
    const m = techMul('prod.' + o.type) * techMul('prod.all');
    for (const k in p) total[k] = (total[k] || 0) + p[k] * m;
  });
  return total;
}

const resFrac = {};
function tickResources(dt) {
  const p = productionPerSec();
  for (const k in p) {
    resFrac[k] = (resFrac[k] || 0) + p[k] * dt;
    const whole = Math.floor(resFrac[k]);
    if (whole > 0) {
      world.res[k] += whole;
      resFrac[k] -= whole;
    }
  }
  world.lastTs = Date.now();
}

function shopTrade(kind, mode) {
  const s = SHOP[kind];
  if (mode === 'buy') {
    const cost = { coin: shopPrice(kind, 'buy') };
    if (!canAfford(cost)) return false;
    spend(cost);
    world.res[kind] += SHOP_LOT;
    return true;
  }
  if ((world.res[kind] || 0) < SHOP_LOT) return false;
  world.res[kind] -= SHOP_LOT;
  world.res.coin += shopPrice(kind, 'sell');
  return true;
}

function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function todayKey(nowMs) {
  const d = new Date(nowMs === undefined ? Date.now() : nowMs);
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function dealBasePrice(give) {
  let sum = 0;
  for (const k in give) sum += give[k] * SHOP[k].buy;
  return sum;
}

function generateDeals(dayKey) {
  const rng = makeRng(hashStr(dayKey + '|' + DEAL_SEED));
  const tenth = rng() < DEAL_LEGEND_CHANCE ? 'legendary' : 'rare';
  const out = [];
  Object.keys(DEAL_RARITY).forEach(r => {
    const info = DEAL_RARITY[r];
    const n = info.slots + (r === tenth ? 1 : 0);
    const pool = DEAL_POOL.filter(d => d.rarity === r);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    for (let k = 0; k < n; k++) {
      const d = pool[k];
      const pct = info.pct[0] + Math.floor(rng() * (info.pct[1] - info.pct[0] + 1));
      const base = dealBasePrice(d.give);
      out.push({
        slot: out.length, id: d.id, rarity: r, name: d.name, icon: d.icon,
        give: Object.assign({}, d.give), pct: pct, limit: info.limit + techAdd('deal.limit'),
        base: base, price: Math.max(1, Math.ceil(base * pct / 10 * techMul('deal.price')))
      });
    }
  });
  return out;
}

function dealDay() {
  const t = todayKey();
  return world.deals.day > t ? world.deals.day : t;
}

function ensureDeals() {
  const day = dealDay();
  if (world.deals.day !== day) { world.deals.day = day; world.deals.bought = {}; }
  if (!dealCache || dealCache.day !== day) dealCache = { day: day, list: generateDeals(day) };
  return dealCache.list;
}

function dealLeft(deal) {
  return Math.max(0, deal.limit - (world.deals.bought[deal.id] || 0));
}

function buyDeal(slot, day) {
  const list = ensureDeals();
  if (day !== world.deals.day) return 'expired';
  const d = list[slot];
  if (!d) return 'bad';
  if (dealLeft(d) <= 0) return 'soldout';
  if (!canAfford({ coin: d.price })) return 'coin';
  spend({ coin: d.price });
  for (const k in d.give) world.res[k] += d.give[k];
  world.deals.bought[d.id] = (world.deals.bought[d.id] || 0) + 1;
  return 'ok';
}

function msToNextDeals(nowMs) {
  const now = nowMs === undefined ? Date.now() : nowMs;
  if (world.deals.day > todayKey(now)) return -1;
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime() - now;
}

function normDeals(v) {
  if (!v || typeof v !== 'object' || typeof v.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.day)) {
    return { day: '', bought: {} };
  }
  const bought = {};
  const src = v.bought && typeof v.bought === 'object' ? v.bought : {};
  for (const k in src) {
    const n = src[k];
    if (typeof n === 'number' && isFinite(n)) bought[k] = Math.max(0, Math.floor(n));
  }
  return { day: v.day, bought: bought };
}

// 存檔一律經 estateBoard() / campBoard() 取資料，任何模式下都安全
function saveWorld() {
  try {
    const eb = estateBoard(), cb = campBoard();
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      terrain: Array.from(eb.terrain),
      height: Array.from(eb.height),
      flow: Array.from(eb.flow),
      objects: eb.objects.map(o => objSave(o, false)),
      camp: cb ? boardToJSON(cb) : null,
      res: world.res,
      lastTs: world.lastTs,
      season: currentSeason,
      deals: world.deals,
      tech: world.tech,
      record: world.record,
      npcBest: world.npcBest,
      raid: world.raid
    }));
  } catch (e) { /* 儲存空間不可用時略過 */ }
}

function loadWorld() {
  const ok = loadWorldSave();
  if (!ok && !hasSavedWorld()) seedFreshCamp();
  idGet();
  return ok;
}

function hasSavedWorld() {
  try { return localStorage.getItem(SAVE_KEY) !== null; } catch (e) { return false; }
}

function loadWorldSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    const len = s.terrain ? s.terrain.length : 0;
    const side = Math.round(Math.sqrt(len));
    if (!len || side * side !== len || side > MAP_W || side > MAP_H) return false;
    if (!s.height || s.height.length !== len || !s.flow || s.flow.length !== len) return false;
    const ox = (MAP_W - side) >> 1, oy = (MAP_H - side) >> 1;
    world.terrain.fill(0); world.height.fill(0); world.flow.fill(0);
    world.block.fill(0); world.zone.fill(0);
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        const j = y * side + x, i = idx(x + ox, y + oy);
        world.terrain[i] = s.terrain[j]; world.height[i] = s.height[j]; world.flow[i] = s.flow[j];
      }
    world.objects = (s.objects || []).filter(o => o && OBJECTS[o.type])
      .map(o => ({ type: o.type, x: o.x + ox, y: o.y + oy, rot: o.rot || 0, facing: objFacing({ facing: o.facing, rot: o.rot || 0 }) }));
    world.marks = newMarks();
    world.board = 'estate';
    world.stash = s.camp ? boardFromJSON(s.camp) : null;
    world.res = Object.assign({}, START_RES, s.res);
    world.deals = normDeals(s.deals); dealCache = null;
    world.tech = normTech(s.tech); techRebuild();
    world.record = normRecord(s.record);
    world.npcBest = normNpcBest(s.npcBest);
    world.raid = normRaid(s.raid);
    world.lastTs = s.lastTs || Date.now();
    if (s.season && PALETTES[s.season]) setSeason(s.season);
    rebuildOcc();
    return true;
  } catch (e) {
    return false;
  }
}

// 離線期間依建築累積資源, 最多 offlineCapSec()
function applyOfflineGains() {
  const sec = Math.min(offlineCapSec(), Math.max(0, (Date.now() - world.lastTs) / 1000));
  if (sec < 5) return 0;
  const p = productionPerSec();
  let any = false;
  for (const k in p) {
    const n = Math.floor(p[k] * sec * offlineRate());
    if (n > 0) { world.res[k] += n; any = true; }
  }
  techOfflineDone = applyOfflineResearch(sec);
  world.lastTs = Date.now();
  return any ? sec : 0;
}

function clearWorld() {
  world.terrain.fill(0);
  world.height.fill(0);
  world.flow.fill(0);
  world.block.fill(0);
  world.zone.fill(0);
  world.marks = newMarks();
  world.objects = [];
  rebuildOcc();
}

function fillRect(x0, y0, x1, y1, fn) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) fn(x, y);
}

function loadDemo(ox, oy) {
  ox = ox || 0; oy = oy || 0;
  clearWorld();
  const R = (x0, y0, x1, y1, fn) => fillRect(x0 + ox, y0 + oy, x1 + ox, y1 + oy, fn);
  // 城主府高台
  R(8, 4, 22, 16, (x, y) => { world.height[idx(x, y)] = 2; });
  R(8, 17, 22, 17, (x, y) => { world.height[idx(x, y)] = 1; });
  // 河流 A 由北往南流入湖, 河流 B 由東往西在 (26,10) 合流
  R(26, 0, 26, 19, (x, y) => paintTerrain(x, y, T_RIVER, 3));
  R(27, 10, 39, 10, (x, y) => paintTerrain(x, y, T_RIVER, 0));
  // 下游大湖
  R(12, 20, 36, 35, (x, y) => paintTerrain(x, y, T_LAKE, 0));
  // 道路: 高台主道、府前橫路、湖岸步道
  R(18, 5, 18, 17, (x, y) => paintTerrain(x, y, T_ROAD, 0));
  R(11, 12, 18, 12, (x, y) => paintTerrain(x, y, T_ROAD, 0));
  R(10, 18, 30, 18, (x, y) => { if (world.terrain[idx(x, y)] === T_GRASS) paintTerrain(x, y, T_ROAD, 0); });

  const put = (type, x, y, rot) => { if (canPlace(type, x + ox, y + oy, rot || 0)) place(type, x + ox, y + oy, rot || 0); };
  put('palace', 11, 8, 0);
  put('gate', 17, 4, 0);
  put('stairs', 18, 17, 1);
  put('stairs', 18, 18, 1);
  put('bridge', 26, 18, 0);
  put('house', 20, 8); put('house', 20, 13); put('house', 10, 14); put('house', 14, 14);
  put('lumber', 9, 6); put('quarry', 20, 10); put('market', 16, 14);
  // 三種營放在樹與城牆之前;不佔第 18 欄道路與城門中線通道(17,5 / 18,5 仍空)
  put('cavalry', 11, 5, 0); put('shield', 15, 8, 0); put('archer', 19, 5, 0);
  // 高台後牆、左牆、右牆與前牆(南門在 17,16 與階梯同線)
  fillRect(8, 4, 16, 4, (x, y) => put('wall', x, y));
  fillRect(20, 4, 22, 4, (x, y) => put('wall', x, y));
  fillRect(8, 5, 8, 16, (x, y) => put('wall', x, y));
  fillRect(22, 5, 22, 16, (x, y) => put('wall', x, y));
  fillRect(9, 16, 16, 16, (x, y) => put('wall', x, y));
  fillRect(20, 16, 21, 16, (x, y) => put('wall', x, y));
  put('gate', 17, 16, 0);

  // 以固定亂數撒樹與湖岸石頭
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < 70; n++) put('tree', Math.floor(rnd() * 40), Math.floor(rnd() * 40));
  for (let x = 12; x <= 36; x++) if (x !== 18 && x !== 19 && x !== 26 && rnd() < 0.7) put('stone', x, 19);
}

function tplCells(e) {
  let pts = [];
  if (e.at) pts = [e.at];
  else if (e.pts) pts = e.pts.slice();
  else if (e.rect || e.ring) {
    const r = e.rect || e.ring, x = r[0], y = r[1], w = r[2], h = r[3];
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++)
        if (e.rect || xx === x || xx === x + w - 1 || yy === y || yy === y + h - 1) pts.push([xx, yy]);
  } else if (e.line) {
    const [x0, y0, x1, y1, s] = e.line;
    if (y0 === y1) for (let xx = x0; xx <= x1; xx += s) pts.push([xx, y0]);
    else for (let yy = y0; yy <= y1; yy += s) pts.push([x0, yy]);
  } else if (e.grid) {
    const [x0, y0, nx, ny, dx, dy] = e.grid;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push([x0 + i * dx, y0 + j * dy]);
  }
  if (e.parity !== undefined) pts = pts.filter(p => (p[0] + p[1]) % 2 === e.parity);
  if (e.skip) pts = pts.filter(p => !e.skip.some(r => p[0] >= r[0] && p[0] < r[0] + r[2] && p[1] >= r[1] && p[1] < r[1] + r[3]));
  return pts;
}

// 回傳 { placed, failed, ox, oy }；找不到範本或範本大於地圖回傳 null（世界不變）
function applyTemplate(id) {
  const t = TEMPLATES.find(v => v.id === id);
  if (!t || t.w > MAP_W || t.h > MAP_H) return null;
  const kind = t.kind || 'estate';
  // 範本只能套用到同種現役棋盤；備份中（world 是別人的地圖）不套用
  if (game.backup || kind !== world.board) return null;
  if (t.legacy === 'demo' && world.board !== 'estate') return null;
  const estate = world.board === 'estate';
  const ox = (MAP_W - t.w) >> 1, oy = (MAP_H - t.h) >> 1;
  const keep = Object.assign({}, world.res);
  let failed = 0;
  if (t.legacy === 'demo') {
    loadDemo(ox, oy);
  } else {
    if (estate) clearWorld(); else clearBoard();
    (t.heights || []).forEach(a => fillRect(ox + a[1], oy + a[2], ox + a[1] + a[3] - 1, oy + a[2] + a[4] - 1,
      (x, y) => { world.height[idx(x, y)] = Math.min(MAX_H, a[0]); }));
    (t.water || []).forEach(op => {
      const r = op.rect, hl = op.hole, tt = op.t === 'river' ? T_RIVER : T_LAKE;
      fillRect(ox + r[0], oy + r[1], ox + r[0] + r[2] - 1, oy + r[1] + r[3] - 1, (x, y) => {
        const lx = x - ox, ly = y - oy;
        if (hl && lx >= hl[0] && lx < hl[0] + hl[2] && ly >= hl[1] && ly < hl[1] + hl[3]) return;
        paintTerrain(x, y, tt, op.flow || 0);
      });
    });
    (t.roads || []).forEach(r => fillRect(ox + r[0], oy + r[1], ox + r[0] + r[2] - 1, oy + r[1] + r[3] - 1,
      (x, y) => paintTerrain(x, y, T_ROAD, 0)));
    (t.block || []).forEach(a => fillRect(ox + a[1], oy + a[2], ox + a[1] + a[3] - 1, oy + a[2] + a[4] - 1,
      (x, y) => { world.block[idx(x, y)] = a[0]; }));
    (t.zone || []).forEach(a => fillRect(ox + a[1], oy + a[2], ox + a[1] + a[3] - 1, oy + a[2] + a[4] - 1,
      (x, y) => { world.zone[idx(x, y)] = a[0]; }));
    const mk = t.marks || {};
    (mk.deploy || []).forEach(d => world.marks.deploy.push(Object.assign({}, d, { r: [ox + d.r[0], oy + d.r[1], d.r[2], d.r[3]] })));
    (mk.rally || []).forEach(p => world.marks.rally.push(Object.assign({}, p, { x: ox + p.x, y: oy + p.y })));
    (mk.aiEntry || []).forEach(a => world.marks.aiEntry.push(Object.assign({}, a, { r: [ox + a.r[0], oy + a.r[1], a.r[2], a.r[3]] })));
    const fails = [];
    (t.objects || []).forEach(e => {
      const rot = e.rot || 0;
      tplCells(e).forEach(p => {
        const x = ox + p[0], y = oy + p[1];
        if (!OBJECTS[e.type] || !canPlace(e.type, x, y, rot)) { fails.push(e.type + '@' + p[0] + ',' + p[1]); return; }
        world.objects.push({ type: e.type, x: x, y: y, rot: rot, facing: rot });
        const fp = footprint(e.type, rot), n = world.objects.length;
        for (let yy = y; yy < y + fp[1]; yy++) for (let xx = x; xx < x + fp[0]; xx++) world.occ[idx(xx, yy)] = n;
      });
    });
    rebuildOcc();
    if (fails.length) console.warn('[template] ' + id + ': ' + fails.length + ' failed', fails.slice(0, 20).join(' '));
    failed = fails.length;
  }
  if (estate) world.res = keep;
  if (estate) world.lastTs = Date.now();
  return { placed: world.objects.length, failed: failed, ox: ox, oy: oy };
}

// 預設範本（templates.js 的 isDefault）；kind 為 'estate' 或 'camp'，沒有則回 null
function defaultTemplate(kind) {
  return TEMPLATES.find(v => v.isDefault && (v.kind || 'estate') === kind) || null;
}

// 全新玩家：在 camp 棋盤套用預設戰鬥範本後切回經營（res、lastTs 不動）；失敗時 stash 為 null
function seedFreshCamp() {
  const t = defaultTemplate('camp');
  if (!t || game.backup || world.board !== 'estate') return false;
  switchBoard('camp');
  const prev = game.mode;
  game.mode = 'battleDesign';
  const r = applyTemplate(t.id);
  game.mode = prev;
  switchBoard('estate');
  if (!r) world.stash = null;
  return !!r;
}

// 恢復預設：kind 須與目前棋盤及模式相符（經營 ↔ estate，戰鬥布置 ↔ camp），否則回 null
function applyDefaultTemplate(kind) {
  if (kind !== 'estate' && kind !== 'camp') return null;
  if (game.mode !== (kind === 'camp' ? 'battleDesign' : 'estate')) return null;
  if (world.board !== kind) return null;
  const t = defaultTemplate(kind);
  return t ? applyTemplate(t.id) : null;
}

// 布置模式（PLAN 12）：待購清單，不存檔、不扣款；按 ✓ 才一次購買
const PEND_MAX = 200;
// list: [{type,x,y,rot}]；occ: 待購佔格（索引+1）；diag: 依遠角對角線分組（同 world.objDiag）
// sel: 選取中的待購索引（-1 無）；moving: 選取物件是否在「等待點選新位置」
const pend = { list: [], occ: new Int16Array(MAP_W * MAP_H), diag: [], sel: -1, moving: false };

function pendRebuild() {
  pend.occ.fill(0);
  pend.diag = [];
  pend.list.forEach((o, n) => {
    const [w, h] = footprint(o.type, o.rot);
    for (let yy = o.y; yy < o.y + h; yy++)
      for (let xx = o.x; xx < o.x + w; xx++) pend.occ[idx(xx, yy)] = n + 1;
    const key = (o.x + w - 1) + (o.y + h - 1);
    (pend.diag[key] = pend.diag[key] || []).push(o);
  });
}

// 待購中 type 的件數，skip 為不計入的索引（-1 表示全計）
function pendCount(type, skip) {
  let n = 0;
  pend.list.forEach((o, i) => { if (o.type === type && i !== skip) n++; });
  return n;
}

function addCost(a, b) {
  const r = Object.assign({}, a);
  for (const k in b) r[k] = (r[k] || 0) + b[k];
  return r;
}

function pendTotal() {
  let t = {};
  pend.list.forEach(o => { t = addCost(t, objCost(o.type)); });
  return t;
}

// canPlace（已建物件、地形、高度、邊界、已建數量上限）＋ 待購數量上限 ＋ 不與其他待購重疊
function canPlacePending(type, x, y, rot, skip) {
  if (!canPlace(type, x, y, rot)) return false;
  const d = OBJECTS[type];
  if (d.max && countObjects(type) + pendCount(type, skip) >= d.max) return false;
  const [w, h] = footprint(type, rot);
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const n = pend.occ[idx(xx, yy)];
      if (n && n - 1 !== skip) return false;
    }
  return true;
}

function pendAdd(type, x, y, rot) {
  pend.list.push({ type: type, x: x, y: y, rot: rot });
  pendRebuild();
}

function pendRemove(n) {
  pend.list.splice(n, 1);
  pend.sel = -1;
  pend.moving = false;
  pendRebuild();
}

function pendClear() {
  pend.list = [];
  pend.sel = -1;
  pend.moving = false;
  pendRebuild();
}

// 一次購買全部待購。成功 { ok:true, n, cost }；資源不足 { ok:false, why:'res' }；
// 某件已無法放置 { ok:false, why:'place', i }（兩種失敗都不扣款、不改 world、待購保留）
function pendCommit() {
  const total = pendTotal();
  if (!canAfford(total)) return { ok: false, why: 'res' };
  for (let i = 0; i < pend.list.length; i++) {
    const o = pend.list[i];
    if (!canPlace(o.type, o.x, o.y, o.rot)) return { ok: false, why: 'place', i: i };
  }
  spend(total);
  const n = pend.list.length;
  pend.list.forEach(o => world.objects.push({ type: o.type, x: o.x, y: o.y, rot: o.rot, facing: o.rot }));
  rebuildOcc();
  pendClear();
  return { ok: true, n: n, cost: total };
}

// 隱藏建築（PLAN 12.17）：不存檔。bad = 位置不合法的已建物件索引；badCell = 其佔格（渲染標紅用）
const hide = { on: false, bad: [], badCell: new Uint8Array(MAP_W * MAP_H) };

// 已建物件 n（0 起）在目前地形上是否合法：canPlace 的規則但排除自己、不計數量上限
function objValidAt(n) {
  const o = world.objects[n], d = OBJECTS[o.type];
  const [w, h] = footprint(o.type, o.rot);
  if (o.x < 0 || o.y < 0 || o.x + w > MAP_W || o.y + h > MAP_H) return false;
  const h0 = world.height[idx(o.x, o.y)];
  for (let yy = o.y; yy < o.y + h; yy++) {
    for (let xx = o.x; xx < o.x + w; xx++) {
      const i = idx(xx, yy);
      if (world.occ[i] !== n + 1 || world.height[i] !== h0) return false;
      if (d.on.indexOf(world.terrain[i]) < 0) return false;
    }
  }
  return true;
}

// 已建物件 n 改為 (x,y)/rot 後是否可放：canPlace 規則，排除自己的舊佔格；不計數量上限、不看 sideOk；避開待購佔格
function objFitAt(n, x, y, rot) {
  const o = world.objects[n];
  if (!o) return false;
  const d = OBJECTS[o.type];
  const [w, h] = footprint(o.type, rot);
  if (x < 0 || y < 0 || x + w > MAP_W || y + h > MAP_H) return false;
  const h0 = world.height[idx(x, y)];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = idx(xx, yy);
      if ((world.occ[i] && world.occ[i] !== n + 1) || pend.occ[i]) return false;
      if (world.height[i] !== h0) return false;
      if (d.on.indexOf(world.terrain[i]) < 0) return false;
    }
  }
  return true;
}

// 重新驗證全部已建物件，回傳不合法件數（O(物件格數)，郡城範本 < 1ms）
function hideAudit() {
  hide.bad = [];
  hide.badCell.fill(0);
  world.objects.forEach((o, n) => {
    if (objValidAt(n)) return;
    hide.bad.push(n);
    const [w, h] = footprint(o.type, o.rot);
    for (let yy = o.y; yy < o.y + h; yy++)
      for (let xx = o.x; xx < o.x + w; xx++) if (inBounds(xx, yy)) hide.badCell[idx(xx, yy)] = 1;
  });
  return hide.bad.length;
}

// 把 (x,y) 改成地形 t 後，該格的已建物件是否仍合法（無物件 → true）
function terrainOkUnder(x, y, t) {
  const n = world.occ[idx(x, y)];
  return !n || OBJECTS[world.objects[n - 1].type].on.indexOf(t) >= 0;
}

// 只改地形、不刪物件（paintTerrain 會無退款刪物件，隱藏模式改用此函式；呼叫前先檢查 terrainOkUnder）
function paintTerrainKeep(x, y, t, flowDir) {
  const i = idx(x, y);
  world.terrain[i] = t;
  world.flow[i] = t === T_RIVER ? flowDir : 0;
}

// 整塊升降已建物件 n（0 起）的全部佔格；成功回 ''，失敗回原因字串且不改世界
function changeHeightBlock(n, delta) {
  const o = world.objects[n];
  const [w, h] = footprint(o.type, o.rot);
  const h0 = world.height[idx(o.x, o.y)];
  for (let yy = o.y; yy < o.y + h; yy++)
    for (let xx = o.x; xx < o.x + w; xx++)
      if (world.height[idx(xx, yy)] !== h0) return OBJECTS[o.type].name + '底下高度不一致';
  const nh = h0 + delta;
  if (nh < 0 || nh > MAX_H) return delta > 0 ? '已達最高高度' : '已達最低高度';
  for (let yy = o.y; yy < o.y + h; yy++)
    for (let xx = o.x; xx < o.x + w; xx++) world.height[idx(xx, yy)] = nh;
  return '';
}

// 存檔欄位正規化（缺或壞掉一律補預設）
function normNum(v) { return typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : 0; }
function normRecord(v) {
  const r = v && typeof v === 'object' ? v : {};
  const a = r.atk && typeof r.atk === 'object' ? r.atk : {};
  const d = r.def && typeof r.def === 'object' ? r.def : {};
  return {
    atk: { win: normNum(a.win), lose: normNum(a.lose), stars: normNum(a.stars), merit: normNum(a.merit) },
    def: { win: normNum(d.win), lose: normNum(d.lose) }
  };
}
function normNpcBest(v) {
  const out = {};
  if (v && typeof v === 'object') for (const k in v) out[k] = normNum(v[k]);
  return out;
}
function normRaid(v) {
  const r = v && typeof v === 'object' ? v : {};
  return { last: normNum(r.last), seq: normNum(r.seq) };
}
// 只留物件，最多 10 筆（保留最後 10 筆）
function normLog(v) { return Array.isArray(v) ? v.filter(x => x && typeof x === 'object').slice(-10) : []; }

// ── 本機身分（PLAN_TD_MASTER §3.8）：獨立 key，「清空領地」不影響 ──
let idMem = null;

function idRandPid() {
  const b = new Uint8Array(8);
  try { crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < 8; i++) b[i] = Math.floor(Math.random() * 256); }
  let s = '';
  for (let i = 0; i < 8; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
  return 'p_' + s;
}
function idValidPid(pid) { return typeof pid === 'string' && /^p_[0-9a-f]{16}$/.test(pid); }
function idNorm(name) { return typeof name === 'string' ? Array.from(name.trim()).slice(0, 12).join('') : ''; }
function idRead() {
  try {
    const v = JSON.parse(localStorage.getItem(ID_KEY) || 'null');
    if (v && v.v === 1 && idValidPid(v.pid)) return { v: 1, pid: v.pid, name: idNorm(v.name), ts: typeof v.ts === 'number' ? v.ts : 0 };
  } catch (e) { /* 讀不到或壞掉時重新產生 */ }
  return null;
}
function idWrite(v) {
  try { localStorage.setItem(ID_KEY, JSON.stringify(v)); } catch (e) { /* 儲存空間不可用時略過 */ }
}
// 首次呼叫時產生 pid 並寫回；回傳 { pid, name }
function idGet() {
  if (!idMem) {
    idMem = idRead() || { v: 1, pid: idRandPid(), name: '', ts: Date.now() };
    idWrite(idMem);
  }
  return { pid: idMem.pid, name: idMem.name };
}
function idSetName(name) {
  idGet();
  idMem.name = idNorm(name);
  idWrite(idMem);
  return idMem.name;
}
function idB64enc(s) {
  return btoa(encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (m, p) => String.fromCharCode(parseInt(p, 16))));
}
function idB64dec(b) {
  return decodeURIComponent(Array.prototype.map.call(atob(b), c => '%' + ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
}
function idExport() {
  const id = idGet();
  return 'LDID1:' + idB64enc(JSON.stringify({ pid: id.pid, name: id.name, ts: idMem.ts }));
}
// 回 '' 成功，否則錯誤字串；成功即取代本機身分（UI 需先二次確認）
function idImport(code) {
  const s = String(code || '').trim();
  if (s.indexOf('LDID1:') !== 0) return '身分碼格式錯誤';
  let o = null;
  try { o = JSON.parse(idB64dec(s.slice(6))); } catch (e) { o = null; }
  if (!o || !idValidPid(o.pid)) return '身分碼格式錯誤';
  idMem = { v: 1, pid: o.pid, name: idNorm(o.name), ts: Date.now() };
  idWrite(idMem);
  return '';
}
