const SAVE_KEY = 'lorddomain.save.v1';

const world = {
  terrain: new Uint8Array(MAP_W * MAP_H),
  height: new Uint8Array(MAP_W * MAP_H),
  flow: new Uint8Array(MAP_W * MAP_H),
  occ: new Int16Array(MAP_W * MAP_H),
  objects: [],
  objDiag: [],
  res: Object.assign({}, START_RES),
  lastTs: Date.now(),
  deals: { day: '', bought: {} }
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

function countObjects(type) {
  return world.objects.filter(o => o.type === type).length;
}

function canPlace(type, x, y, rot) {
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
  world.objects.push({ type: type, x: x, y: y, rot: rot });
  rebuildOcc();
}

function removeObjectAt(x, y, refund) {
  const n = world.occ[idx(x, y)];
  if (!n) return false;
  const o = world.objects[n - 1];
  if (refund) gain(OBJECTS[o.type].cost, REFUND_RATE);
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
  world.objects.forEach(o => {
    const p = OBJECTS[o.type].prod;
    if (p) for (const k in p) total[k] = (total[k] || 0) + p[k];
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
    const cost = { coin: s.buy * SHOP_LOT };
    if (!canAfford(cost)) return false;
    spend(cost);
    world.res[kind] += SHOP_LOT;
    return true;
  }
  if ((world.res[kind] || 0) < SHOP_LOT) return false;
  world.res[kind] -= SHOP_LOT;
  world.res.coin += s.sell * SHOP_LOT;
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
        give: Object.assign({}, d.give), pct: pct, limit: info.limit,
        base: base, price: Math.max(1, Math.ceil(base * pct / 10))
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

function saveWorld() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      terrain: Array.from(world.terrain),
      height: Array.from(world.height),
      flow: Array.from(world.flow),
      objects: world.objects,
      res: world.res,
      lastTs: world.lastTs,
      season: currentSeason,
      deals: world.deals
    }));
  } catch (e) { /* 儲存空間不可用時略過 */ }
}

function loadWorld() {
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
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        const j = y * side + x, i = idx(x + ox, y + oy);
        world.terrain[i] = s.terrain[j]; world.height[i] = s.height[j]; world.flow[i] = s.flow[j];
      }
    world.objects = (s.objects || []).filter(o => OBJECTS[o.type])
      .map(o => ({ type: o.type, x: o.x + ox, y: o.y + oy, rot: o.rot || 0 }));
    world.res = Object.assign({}, START_RES, s.res);
    world.deals = normDeals(s.deals); dealCache = null;
    world.lastTs = s.lastTs || Date.now();
    if (s.season && PALETTES[s.season]) setSeason(s.season);
    rebuildOcc();
    return true;
  } catch (e) {
    return false;
  }
}

// 離線期間依建築累積資源, 最多 OFFLINE_CAP_SEC
function applyOfflineGains() {
  const sec = Math.min(OFFLINE_CAP_SEC, Math.max(0, (Date.now() - world.lastTs) / 1000));
  if (sec < 5) return 0;
  const p = productionPerSec();
  let any = false;
  for (const k in p) {
    const n = Math.floor(p[k] * sec * OFFLINE_RATE);
    if (n > 0) { world.res[k] += n; any = true; }
  }
  world.lastTs = Date.now();
  return any ? sec : 0;
}

function clearWorld() {
  world.terrain.fill(0);
  world.height.fill(0);
  world.flow.fill(0);
  world.objects = [];
  world.res = Object.assign({}, START_RES);
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
  // 高台後牆與左牆
  fillRect(8, 4, 16, 4, (x, y) => put('wall', x, y));
  fillRect(20, 4, 22, 4, (x, y) => put('wall', x, y));
  fillRect(8, 5, 8, 16, (x, y) => put('wall', x, y));

  // 以固定亂數撒樹與湖岸石頭
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < 70; n++) put('tree', Math.floor(rnd() * 40), Math.floor(rnd() * 40));
  for (let x = 12; x <= 36; x++) if (x !== 18 && x !== 19 && x !== 26 && rnd() < 0.7) put('stone', x, 19);
  world.res = Object.assign({}, START_RES);
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
  const ox = (MAP_W - t.w) >> 1, oy = (MAP_H - t.h) >> 1;
  const keep = Object.assign({}, world.res);
  let failed = 0;
  if (t.legacy === 'demo') {
    loadDemo(ox, oy);
  } else {
    clearWorld();
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
    const fails = [];
    (t.objects || []).forEach(e => {
      const rot = e.rot || 0;
      tplCells(e).forEach(p => {
        const x = ox + p[0], y = oy + p[1];
        if (!OBJECTS[e.type] || !canPlace(e.type, x, y, rot)) { fails.push(e.type + '@' + p[0] + ',' + p[1]); return; }
        world.objects.push({ type: e.type, x: x, y: y, rot: rot });
        const fp = footprint(e.type, rot), n = world.objects.length;
        for (let yy = y; yy < y + fp[1]; yy++) for (let xx = x; xx < x + fp[0]; xx++) world.occ[idx(xx, yy)] = n;
      });
    });
    rebuildOcc();
    if (fails.length) console.warn('[template] ' + id + ': ' + fails.length + ' failed', fails.slice(0, 20).join(' '));
    failed = fails.length;
  }
  if (TEMPLATE_KEEP_RES) world.res = keep;
  world.lastTs = Date.now();
  return { placed: world.objects.length, failed: failed, ox: ox, oy: oy };
}
