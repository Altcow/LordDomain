// citytraffic.js — 街景角色(走販 / 馬車 / 騎馬者 / 城衛兵 / 叫賣者 / 圍觀者 / 車夫),citylife.js 的擴充:
// 全部是純裝飾,不讀寫 world 數據欄位、不碰 td.js / path.js / 戰鬥模擬。借用 citylife 的道路圖、距離場、走路、淡入淡出、
// 視野外粗更新與繪製;每類角色另有獨立上限(LIFE_XCAP)× 密度倍率(LIFE_XMUL),全體另受 LIFE_ALL_MAX 約束。
// 靜止者(站崗、叫賣、圍觀、車夫)n.stat = true,不尋路;馬車 / 騎士 / 走販 / 巡邏隊走道路格(馬車 lane = 0,只走格中心,不會切角穿牆)。
// 資料結構(LIFE.road.x)只依賴格子索引與物件清單,地圖放大時(MAP_W / MAP_H 變大)不需修改。

if (typeof LIFE_XTYPES !== 'undefined' && typeof LIFE_TYPES !== 'undefined') {
  Object.keys(LIFE_XTYPES).forEach(function (k) { LIFE_TYPES[k] = LIFE_XTYPES[k]; });
}

const LIFE_XROLES = ['guard_post', 'guard_patrol', 'wagon', 'rider', 'hawker', 'peddler', 'onlooker']; // 生成優先序(縮減時反向)

// 低階手機(觸控 + 核心數 ≤ 4 或記憶體 ≤ 2GB):街景角色與總人數上限減半
function lifeLowEnd() {
  if (LIFE.lowEnd !== undefined) return LIFE.lowEnd;
  let low = false;
  try {
    if (typeof navigator !== 'undefined' && navigator) {
      const touch = (navigator.maxTouchPoints || 0) > 0;
      low = touch && ((navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory > 0 && navigator.deviceMemory <= 2));
    }
  } catch (e) {
    low = false;
  }
  LIFE.lowEnd = low;
  return low;
}

// 夜市攤位:吃食 / 酒水 / 茶水
function lifeNightStall(t) {
  return t.indexOf('food_') === 0 || t === 'stall_wine' || t === 'stall_tea' || t === 'hawker_carrier' || t === 'stall_rice' || t === 'stall_fruit' || t === 'stall_meat' || t === 'food_table' || t === 'shop_wine';
}

function lifeTrafficReset() {
  LIFE.dockRes.clear();
  LIFE.spotRes.clear();
  LIFE.xT = 0;
  LIFE.xSeed = 6;
  LIFE.xCd = {};
  if (typeof trafficReset === 'function') trafficReset();
}

// 站得住的格子:可走道路格,或沒有物件的草地 / 道路,且高度與參考相同
function lifeStandOk(cx, cy, hh) {
  if (cx < 0 || cy < 0 || cx >= boardW() || cy >= boardH()) return false;
  const i = idx(cx, cy);
  if (world.height[i] !== hh) return false;
  const R = LIFE.road;
  if (R && R.ok[i]) return true;
  if (world.occ[i]) return false;
  const t = world.terrain[i];
  return isGroundTerrain(t) || t === T_ROAD;
}

function lifeTrafficStatOk(n) {
  return lifeStandOk(Math.floor(n.bx), Math.floor(n.by), n.hh);
}

// 重建道路圖後呼叫:停靠點、站崗點、外圍巡走點、叫賣點、巡邏關鍵點、道路網大小(馬車 / 騎士只在路網夠大時生成)
function lifeTrafficBuild(ok) {
  const R = LIFE.road, N = boardW() * boardH();
  const X = { dock: [], nStall: 0, stallC: [], mil: 0, post: [], gwalk: [], keys: [], palaceOk: false, cx: boardW() / 2, cy: boardH() / 2, span: 0, comp: 0 };
  R.x = X;
  const milObjs = [], walls = [], stallObjs = [], crowdObjs = [];
  let palace = null, k, i, o, fp;
  for (k = 0; k < world.objects.length; k++) {
    o = world.objects[k];
    const t = o.type;
    if (t === 'palace') palace = o;
    if (LIFE_DOCK_TYPES[t]) {
      const d = lifeFindDoor(o, ok);
      if (d) X.dock.push({ type: t, cell: d.cell, bx: d.bx, by: d.by, cap: LIFE_DOCK_TYPES[t] });
    }
    const od = (typeof OBJECTS !== 'undefined') ? OBJECTS[t] : null; // art_town.js 的純資料標籤:crowd / crowdW
    if (od && od.crowd === 'hawker') stallObjs.push(o);
    else if (od && od.crowd === 'market' && !od.walk) crowdObjs.push(o);
    else if (t === 'market' || t.indexOf('stall_') === 0 || t.indexOf('shop_') === 0) stallObjs.push(o);
    const m = LIFE_MIL[t];
    if (m) {
      X.mil += m.w;
      if (m.k === 'wall') walls.push(o); else milObjs.push(o);
    }
  }
  X.nStall = stallObjs.length;
  X.nightN = 0;   // 夜市攤位數:吃食 / 酒水 / 茶水攤
  for (k = 0; k < stallObjs.length; k++) if (lifeNightStall(stallObjs[k].type)) X.nightN++;
  X.crowdW = 0;
  X.crowdC = [];
  // 城中心:城主府中心,否則軍事建築平均位置,否則地圖中心
  const ctr = function (obj) { const f = footprint(obj.type, obj.rot); return [obj.x + f[0] / 2, obj.y + f[1] / 2]; };
  if (palace) { const c = ctr(palace); X.cx = c[0]; X.cy = c[1]; }
  else if (milObjs.length + walls.length) {
    let sx = 0, sy = 0, cn = 0;
    milObjs.concat(walls).forEach(function (m) { const c = ctr(m); sx += c[0]; sy += c[1]; cn++; });
    X.cx = sx / cn; X.cy = sy / cn;
  }
  // 站崗候選:軍事建築外圍一圈(牆只取抽樣的幾段);總數上限 140
  const seen = new Set();
  const ring = function (obj, kind, fn) {
    const f = footprint(obj.type, obj.rot), w = f[0], h = f[1], hb = world.height[idx(obj.x, obj.y)];
    for (let y = obj.y - 1; y <= obj.y + h; y++) {
      for (let x = obj.x - 1; x <= obj.x + w; x++) {
        if (x >= obj.x && x < obj.x + w && y >= obj.y && y < obj.y + h) continue;
        if (!lifeStandOk(x, y, hb)) continue;
        const c = idx(x, y);
        if (seen.has(c)) continue;
        seen.add(c);
        fn({ cell: c, x: x + 0.5, y: y + 0.5, h: hb, kind: kind, ox: obj.x + w / 2, oy: obj.y + h / 2 });
      }
    }
  };
  const sample = function (list, max) {
    if (list.length <= max) return list;
    const step = list.length / max, out = [];
    for (let s = 0; s < max; s++) out.push(list[Math.floor(s * step)]);
    return out;
  };
  const kindOf = function (obj) { return LIFE_MIL[obj.type].k; };
  sample(milObjs, 60).forEach(function (m) { if (X.post.length < 140) ring(m, kindOf(m), function (c) { X.post.push(c); }); });
  sample(walls, 48).forEach(function (m) { if (X.post.length < 140) ring(m, 'wall', function (c) { X.post.push(c); }); });
  // 城主府門兩側:不論有無軍事建築都有 0~2 名守衛
  let pd = null;
  for (k = 0; k < R.dests.length; k++) if (R.dests[k].type === 'palace') { pd = R.dests[k]; break; }
  if (pd) {
    const px = pd.cell % boardW(), py = Math.floor(pd.cell / boardW()), hb = world.height[pd.cell];
    let added = 0;
    for (let dy = -1; dy <= 1 && added < 4; dy++) {
      for (let dx = -1; dx <= 1 && added < 4; dx++) {
        if (!dx && !dy) continue;
        const x = px + dx, y = py + dy;
        if (!lifeStandOk(x, y, hb)) continue;
        const c = idx(x, y);
        if (seen.has(c)) continue;
        seen.add(c);
        X.post.push({ cell: c, x: x + 0.5, y: y + 0.5, h: hb, kind: 'palace', ox: X.cx, oy: X.cy });
        added++;
      }
    }
    X.palaceOk = added > 0;
  }
  // 外圍來回走動的巡走點:軍事建築 2 格內的道路格,等距抽樣最多 8 格(避免距離場過多)
  const wset = new Set(), wlist = [];
  sample(milObjs.concat(sample(walls, 20)), 30).forEach(function (m) {
    const f = footprint(m.type, m.rot);
    for (let y = m.y - 2; y <= m.y + f[1] + 1; y++) {
      for (let x = m.x - 2; x <= m.x + f[0] + 1; x++) {
        if (x < 0 || y < 0 || x >= boardW() || y >= boardH()) continue;
        const c = idx(x, y);
        if (ok[c] && !wset.has(c)) { wset.add(c); wlist.push(c); }
      }
    }
  });
  X.gwalk = sample(wlist, 8);
  // 叫賣候選:市集 / 攤位 / 商鋪外圍一圈
  const sc = [];
  const wOf = function (m) { const od = (typeof OBJECTS !== 'undefined') ? OBJECTS[m.type] : null; return (od && od.crowdW > 0) ? od.crowdW : 1; };
  sample(stallObjs, 40).forEach(function (m) { const w = wOf(m), nt = lifeNightStall(m.type); ring(m, 'stall', function (c) { c.w = w; c.night = nt; sc.push(c); }); });
  X.stallC = sample(sc, 80);
  // 人潮停留點:crowd:'market' 的設施(藝人圈地 / 說書台 / 叫賣台…)外圍,權重 = crowdW;圍觀者優先站這裡
  const cc = [];
  sample(crowdObjs, 30).forEach(function (m) { const w = wOf(m); X.crowdW += w; ring(m, 'crowd', function (c) { c.w = w; cc.push(c); }); });
  X.crowdC = sample(cc, 80);
  // 巡邏小隊關鍵點:城主府門、市集門、城門中格、入口
  const keys = new Set();
  if (pd) keys.add(pd.cell);
  let mk = 0;
  R.dests.forEach(function (d) { if (d.type === 'market' && mk < 2) { keys.add(d.cell); mk++; } });
  let gk = 0;
  for (k = 0; k < milObjs.length && gk < 3; k++) {
    o = milObjs[k];
    if (kindOf(o) !== 'gate') continue;
    fp = footprint(o.type, o.rot);
    const mi = idx(o.x + (fp[0] >> 1), o.y + (fp[1] >> 1));
    if (ok[mi]) { keys.add(mi); gk++; }
  }
  for (k = 0; k < R.ent.length && k < 3; k++) keys.add(R.ent[Math.floor(k * R.ent.length / 3)].cell);
  X.keys = Array.from(keys);
  // 路網大小:兩次 BFS 掃出直徑與連通格數(馬車 / 騎士需要 ≥ 24 格且跨度 ≥ 10)
  const s0 = R.ent.length ? R.ent[0].cell : (R.list.length ? R.list[0] : -1);
  if (s0 >= 0) {
    const D = lifeDist(s0);
    let far = s0, fd = 0;
    for (i = 0; i < N; i++) if (D[i] > fd) { fd = D[i]; far = i; }
    const D2 = lifeDist(far);
    let gd = 0, comp = 0;
    for (i = 0; i < N; i++) if (D2[i] >= 0) { comp++; if (D2[i] > gd) gd = D2[i]; }
    X.span = gd; X.comp = comp;
  }
  if (typeof trafficBuildZones === 'function') trafficBuildZones(ok);   // 車馬地點:伐木 / 市集 / 庫房驛站碼頭門格(traffic_sprites.js)
}

function lifeXRoadOk() {
  const X = LIFE.road && LIFE.road.x;
  return !!X && X.comp >= 24 && X.span >= 10;
}

// 各類目標人數 = min(上限, 原始需求) × 密度倍率 × 自適應 ×(低階機 0.5)× 時段 / 季節;至少 1(有條件時)
function lifeXTargets(cnt) {
  const R = LIFE.road, X = R && R.x, d = lifeEffDensity(), mul = LIFE_XMUL[d] || 0;
  const tg = { peddler: 0, wagon: 0, rider: 0, guard_post: 0, guard_patrol: 0, hawker: 0, onlooker: 0 };
  if (!LIFE.on || mul <= 0 || !X) return tg;
  const eff = mul * (typeof lifeStreetMul === 'function' ? lifeStreetMul() : Math.max(0.35, LIFE.adj)) * (lifeLowEnd() ? 0.5 : 1);
  const night = LIFE.tod === 'night';
  const tm = (LIFE_TOD_MUL[LIFE.tod] || 1) * (lifeSeason() === 'winter' ? LIFE_WINTER_MUL : 1);
  const f = function (role, raw, m) {
    raw = Math.min(LIFE_XCAP[role], raw);
    if (raw <= 0 || m <= 0) return 0;
    return Math.min(LIFE_XCAP[role], Math.max(1, Math.round(raw * eff * m)));
  };
  const roadOk = lifeXRoadOk();
  if (roadOk) {
    tg.peddler = night ? 0 : f('peddler', 1 + Math.ceil(X.nStall / 2) + Math.floor(R.list.length / 60), tm);
    tg.wagon = f('wagon', 1 + Math.min(2, X.dock.length) + Math.floor(R.list.length / 80), night ? 0.4 : 1);
    tg.rider = f('rider', 1 + Math.floor(R.list.length / 60), night ? 0.3 : 1);
  }
  tg.guard_post = f('guard_post', Math.round(X.mil) + (X.palaceOk ? 2 : 0), 1);
  if (roadOk && X.mil >= 1 && X.keys.length >= 2) tg.guard_patrol = f('guard_patrol', 1 + Math.floor(X.mil / 6), 1);
  // 夜市(夜間保底):只有吃食 / 酒水攤開張,叫賣者 ×0.4(至少 1)、圍觀 ×0.5(至少 1)
  if (X.stallC.length && !night) tg.hawker = f('hawker', Math.ceil(X.nStall * 0.8), tm);
  else if (night && X.nightN > 0) tg.hawker = f('hawker', Math.min(X.nightN, Math.ceil(X.nStall * 0.8)), 0.4);
  if (!night) tg.onlooker = f('onlooker', 2 * (cnt.hawker || 0) + (X.crowdC.length ? Math.ceil(X.crowdW / 2) : 0), tm);
  else if (tg.hawker > 0) tg.onlooker = f('onlooker', 2 * (cnt.hawker || 0), 0.5);
  if (typeof trafficTargetsClamp === 'function') trafficTargetsClamp(tg);   // 車馬(wagon + rider)合計上限:高 6 / 一般 4 / 低階省電 2,夜間減半
  return tg;
}

// ---------- 生成 ----------
function lifeXEmit(role, count, start, plan, entry, mid, o) {
  const before = LIFE.npcs.length, T = LIFE_TYPES[role];
  if (!lifeEmit(T, role, count, start, plan, entry, mid, o)) return null;
  const out = LIFE.npcs.slice(before);
  LIFE.live -= out.length; // lifeEmit 已計入一般居民;街景角色不占居民額度
  out.forEach(function (n) {
    n.ext = true; n.role = role; n.tv = null;   // tv:街景車馬的外部圖車型(traffic_sprites.js),無則沿用程式繪製
    if (typeof crowdSpecFor === 'function' && n.spec) { const eth = (typeof fantasyRace === 'function' && fantasyRace()) || (typeof ethnicPick === 'function' && role === 'onlooker') ? ethnicPick((typeof world !== 'undefined' && world.ethRegion) || 'zhongyuan') : undefined; const cs = crowdSpecFor(role, n.spec, undefined, eth); if (cs) { n.spec = cs; LIFE.variantIds[cs.id] = true; } } // 路人零件化外觀(模組缺失時沿用舊外觀)
    n.bub = T.bub || ''; n.bubP = T.bubP || 6; n.frr = T.frr || 4;
    if (LIFE.tod === 'night' && n.spec && (role === 'hawker' || role === 'onlooker') && typeof lifeLantern === 'function') { n.spec = lifeLantern(n.spec); }   // 夜市攤主與客人提燈
  });
  return out;
}

// 靜止的街景角色:放在 (x, y)(世界座標),面向 (fx, fy),停留 dur 秒後淡出
function lifeXStatic(role, c, x, y, fx, fy, dur) {
  const out = lifeXEmit(role, 1, c.cell, [{ cell: c.cell, act: 'stand', dur: dur }], null, false, { lane: 0 });
  if (!out) return null;
  const n = out[0], d = Math.hypot(fx, fy) || 1;
  n.stat = true; n.x = x; n.y = y; n.bx = x; n.by = y; n.hh = c.h;
  n.fx = fx / d; n.fy = fy / d;
  return n;
}

function lifeXStart(mid) {
  const R = LIFE.road;
  if (!mid && R.ent.length) {
    const e = R.ent[Math.floor(Math.random() * R.ent.length)];
    return { start: e.cell, ent: e, mid: false };
  }
  return { start: R.list[Math.floor(Math.random() * R.list.length)], ent: null, mid: true };
}

function lifeXPickExit(from, avoid) {
  for (let t = 0; t < 4; t++) {
    const e = lifePickEnt(from, avoid);
    if (e && e.cell !== from) return e;
  }
  return null;
}

function lifeXSpawnWagon(mid) {
  const R = LIFE.road, X = R.x, s = lifeXStart(mid);
  const D = lifeField(s.start);
  if (!D) return 0;
  let dock = null, parked = 0;
  LIFE.dockRes.forEach(function (v) { parked += v; });
  const parkMax = Math.max(1, Math.floor(((LIFE.xTarget && LIFE.xTarget.wagon) || 1) / 2));
  if (X.dock.length && parked < parkMax && Math.random() < 0.75) {
    const c = X.dock.filter(function (d) { return d.cell !== s.start && D[d.cell] >= 0 && (LIFE.dockRes.get(d.cell) || 0) < d.cap; });
    if (c.length) dock = c[Math.floor(Math.random() * c.length)];
  }
  const tz = (typeof trafficWagonPick === 'function') ? trafficWagonPick(dock, s, D) : null;   // 車型與沿途停靠格(伐木 / 市集 / 庫房附近)
  const ex = lifeXPickExit(dock ? dock.cell : (tz && tz.cell >= 0 ? tz.cell : s.start), s.ent);
  if (!ex) return 0;
  const plan = [];
  if (dock) plan.push({ cell: dock.cell, act: 'park', dur: LIFE_PARK.min + Math.random() * (LIFE_PARK.max - LIFE_PARK.min) });
  else if (tz && tz.cell >= 0) plan.push({ cell: tz.cell, act: 'stand', dur: 3 + Math.random() * 4 });
  plan.push({ cell: ex.cell, end: 'exit', ent: ex });
  if (dock) LIFE.dockRes.set(dock.cell, (LIFE.dockRes.get(dock.cell) || 0) + 1);
  const out = lifeXEmit('wagon', 1, s.start, plan, s.ent, s.mid, { lane: 0 });
  if (!out) {
    if (dock) { const v = (LIFE.dockRes.get(dock.cell) || 1) - 1; if (v > 0) LIFE.dockRes.set(dock.cell, v); else LIFE.dockRes.delete(dock.cell); }
    return 0;
  }
  if (dock) out[0].dock = dock.cell;
  if (tz) out[0].tv = trafficMake(tz.kind);
  return 1;
}

// 車停穩後,偶有車夫 / 苦力站在車旁(停靠期間才在,車一走就淡出)
function lifeTrafficParked(n) {
  if (n.role !== 'wagon' || Math.random() > LIFE_PARK.handChance) return;
  const mul = LIFE_XMUL[lifeEffDensity()] || 0;
  let hands = 0;
  for (let i = 0; i < LIFE.npcs.length; i++) if (LIFE.npcs[i].role === 'hand' && !LIFE.npcs[i].dead) hands++;
  if (hands >= Math.max(1, Math.round(LIFE_XCAP.hand * mul))) return;
  const hh = lifeHAt(n.x, n.y);
  const h = lifeXStatic('hand', { cell: n.cur, h: hh }, n.x + 0.42, n.y - 0.3, n.fx * 0.3 - 1, n.fy * 0.3 + 0.6, Math.max(5, n.dur - 1));
  if (!h) return;
  h.host = n; n.hand = h; h.fid = true;
}

function lifeXSpawnRider(mid) {
  const R = LIFE.road, s = lifeXStart(mid);
  const D = lifeField(s.start);
  if (!D) return 0;
  const ex = lifeXPickExit(s.start, s.ent);
  if (!ex) return 0;
  const plan = [];
  let pd = null;
  for (let k = 0; k < R.dests.length; k++) if (R.dests[k].type === 'palace') { pd = R.dests[k]; break; }
  if (pd && pd.cell !== s.start && D[pd.cell] >= 0 && Math.random() < 0.3) plan.push({ cell: pd.cell, act: 'stand', dur: 1.5 + Math.random() * 2 });
  plan.push({ cell: ex.cell, end: 'exit', ent: ex });
  const out = lifeXEmit('rider', 1, s.start, plan, s.ent, s.mid, { lane: 0.08 });
  if (!out) return 0;
  if (typeof trafficMake === 'function') out[0].tv = trafficMake('horse');
  return 1;
}

function lifeXSpawnPeddler(mid) {
  const s = lifeXStart(mid);
  const D = lifeField(s.start);
  if (!D) return 0;
  const plan = [], stops = 1 + Math.floor(Math.random() * 3);
  let prev = s.start;
  for (let i = 0; i < stops; i++) {
    const c = lifePickCell(prev);
    if (c < 0) break;
    plan.push({ cell: c, act: 'hawk', dur: 8 + Math.random() * 10 });
    prev = c;
  }
  const ex = lifeXPickExit(prev, s.ent);
  if (!ex) return 0;
  plan.push({ cell: ex.cell, end: 'exit', ent: ex });
  return lifeXEmit('peddler', 1, s.start, plan, s.ent, s.mid, {}) ? 1 : 0;
}

function lifeXSpawnHawker() {
  const X = LIFE.road.x;
  const night = LIFE.tod === 'night';
  const free = X.stallC.filter(function (c) { return !LIFE.spotRes.has(c.cell) && (!night || c.night); });
  if (!free.length) return 0;
  let tot = 0;
  free.forEach(function (q) { tot += q.w || 1; });
  let r = Math.random() * tot, c = free[free.length - 1];
  for (let i = 0; i < free.length; i++) { r -= free[i].w || 1; if (r < 0) { c = free[i]; break; } }
  const n = lifeXStatic('hawker', c, c.x + (Math.random() - 0.5) * 0.2, c.y + (Math.random() - 0.5) * 0.2, c.x - c.ox, c.y - c.oy, 90 + Math.random() * 150);
  if (!n) return 0;
  n.pc = c.cell; LIFE.spotRes.add(c.cell); n.fid = true;
  return 1;
}

function lifeXSpawnOnlooker() {
  const L = LIFE.npcs, per = new Map(), hosts = [];
  for (let i = 0; i < L.length; i++) {
    const n = L[i];
    if (n.dead) continue;
    if (n.role === 'hawker' && n.st === 'act') hosts.push(n);
    else if (n.role === 'onlooker' && n.host) per.set(n.host, (per.get(n.host) || 0) + 1);
  }
  const X = LIFE.road.x;
  if (X.crowdC.length && (!hosts.length || Math.random() < 0.7)) {
    // 站在人潮設施旁(依 crowdW 加權),面向設施
    const free = X.crowdC.filter(function (c) { return !LIFE.spotRes.has(c.cell); });
    if (free.length) {
      let tot = 0;
      free.forEach(function (q) { tot += q.w || 1; });
      let r = Math.random() * tot, c = free[free.length - 1];
      for (let i = 0; i < free.length; i++) { r -= free[i].w || 1; if (r < 0) { c = free[i]; break; } }
      const n = lifeXStatic('onlooker', c, c.x + (Math.random() - 0.5) * 0.3, c.y + (Math.random() - 0.5) * 0.3, c.ox - c.x, c.oy - c.y, 15 + Math.random() * 45);
      if (n) { n.pc = c.cell; LIFE.spotRes.add(c.cell); n.fid = Math.random() < 0.5; return 1; }
    }
  }
  const cand = hosts.filter(function (h) { return (per.get(h) || 0) < 3; });
  if (!cand.length) return 0;
  const h = cand[Math.floor(Math.random() * cand.length)];
  for (let t = 0; t < 8; t++) {
    const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 0.5;
    const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r, cx = Math.floor(x), cy = Math.floor(y);
    if (!lifeStandOk(cx, cy, h.hh)) continue;
    const n = lifeXStatic('onlooker', { cell: idx(cx, cy), h: h.hh }, x, y, h.x - x, h.y - y, 12 + Math.random() * 40);
    if (!n) return 0;
    n.host = h; n.fid = Math.random() < 0.5;
    return 1;
  }
  return 0;
}

// 外圍來回走動的衛兵:兩個巡走點之間往返(loop + keep,不因壽命離場)
function lifeXSpawnWalker() {
  const X = LIFE.road.x, g = X.gwalk;
  if (g.length < 2) return 0;
  const a = g[Math.floor(Math.random() * g.length)];
  const D = lifeField(a);
  if (!D) return 0;
  const cand = g.filter(function (c) { return c !== a && D[c] >= 3 && D[c] <= 24; });
  if (!cand.length) return 0;
  const b = cand[Math.floor(Math.random() * cand.length)];
  const plan = [{ cell: b, act: 'stand', dur: 2 + Math.random() * 4 }, { cell: a, act: 'stand', dur: 2 + Math.random() * 4 }];
  const out = lifeXEmit('guard_post', 1, a, plan, null, false, { loop: true, lane: 0.1 });
  if (!out) return 0;
  out[0].keep = true;
  return 1;
}

function lifeXSpawnPost(walkers, target) {
  if (walkers < Math.round(target / 3) && lifeXSpawnWalker()) return 1;
  const X = LIFE.road.x, free = [];
  let tot = 0;
  for (let i = 0; i < X.post.length; i++) {
    const c = X.post[i];
    if (LIFE.spotRes.has(c.cell)) continue;
    free.push(c); tot += LIFE_POST_W[c.kind] || 1;
  }
  if (!free.length) return 0;
  let r = Math.random() * tot, pick = free[free.length - 1];
  for (let i = 0; i < free.length; i++) {
    r -= LIFE_POST_W[free[i].kind] || 1;
    if (r < 0) { pick = free[i]; break; }
  }
  let fx = pick.x - X.cx, fy = pick.y - X.cy;
  if (Math.abs(fx) + Math.abs(fy) < 0.01) { fx = 1; fy = 1; }
  const n = lifeXStatic('guard_post', pick, pick.x + (Math.random() - 0.5) * 0.16, pick.y + (Math.random() - 0.5) * 0.16, fx, fy, 1e9);
  if (!n) return 0;
  n.pc = pick.cell; LIFE.spotRes.add(pick.cell);
  return 1;
}

// 城內巡邏小隊:2~4 人縱隊同行,沿關鍵點之間的主要道路來回(det 相同 → 走同一條最短路)
function lifeXSpawnSquad(budget) {
  const X = LIFE.road.x, keys = X.keys;
  if (keys.length < 2) return 0;
  const a = keys[Math.floor(Math.random() * keys.length)];
  const D = lifeField(a);
  if (!D) return 0;
  const cand = keys.filter(function (c) { return c !== a && D[c] >= 6; });
  if (!cand.length) return 0;
  const b = cand[Math.floor(Math.random() * cand.length)];
  const size = Math.min(LIFE_XSQUAD[0] + Math.floor(Math.random() * (LIFE_XSQUAD[1] - LIFE_XSQUAD[0] + 1)), budget);
  if (size < LIFE_XSQUAD[0]) return 0;
  const plan = [{ cell: b, act: 'stand', dur: 2 + Math.random() * 3 }, { cell: a, act: 'stand', dur: 2 + Math.random() * 3 }];
  const det = ++LIFE.gid;
  const out = lifeXEmit('guard_patrol', size, a, plan, null, false, { det: det, loop: true, stagger: 0.7, lane: 0.1 });
  if (!out) return 0;
  out.forEach(function (n) { n.keep = true; n.squad = det; });
  return out.length;
}

// 停靠結束 / 淡出 / 離場時釋放停點與站位,車夫隨車走
function lifeTrafficLeave(n, final) {
  if (n.dock >= 0) {
    const v = (LIFE.dockRes.get(n.dock) || 1) - 1;
    if (v > 0) LIFE.dockRes.set(n.dock, v); else LIFE.dockRes.delete(n.dock);
    n.dock = -1;
  }
  if (n.hand) {
    const h = n.hand;
    n.hand = null;
    if (!h.dead && h.st !== 'fade') lifeFadeOut(h);
  }
  if (final && n.pc >= 0) { LIFE.spotRes.delete(n.pc); n.pc = -1; }
}

function lifeXFadeSquad(id) {
  let c = 0;
  for (let i = 0; i < LIFE.npcs.length; i++) {
    const n = LIFE.npcs[i];
    if (n.role === 'guard_patrol' && n.squad === id && !n.dead && n.st !== 'fade') { lifeFadeOut(n); c++; }
  }
  return c;
}

// 縮減某類人數(k 個單位;小隊整隊算 1 個),畫面外優先。回傳淡出的人數
function lifeXShed(role, k) {
  const L = LIFE.npcs;
  let removed = 0;
  for (let pass = 0; pass < 2 && k > 0; pass++) {
    for (let i = 0; i < L.length && k > 0; i++) {
      const n = L[i];
      if (n.role !== role || n.dead || n.st === 'fade' || n.st === 'enter' || n.st === 'exit' || (typeof lifeRetiring === 'function' && lifeRetiring(n))) continue;
      if (pass === 0 && n.onS) continue;
      if (role === 'guard_patrol') removed += lifeXFadeSquad(n.squad);
      else if (pass === 1 && n.onS && !n.stat && n.st === 'walk' && (role === 'wagon' || role === 'rider' || role === 'peddler') && lifeRetireStart(n)) removed++;   // 畫面內的車馬 / 走販走向最近出口再消失
      else { lifeFadeOut(n); removed++; }
      k--;
    }
  }
  return removed;
}

// 每 0.5 秒:統計 → 目標 → 補生成(一次最多 2 個,剛進場前 6 個一次補齊)/ 縮減
function lifeTrafficTick(dt) {
  if (!featureOn('citysim')) return;   // @DORMANT citysim
  LIFE.xT -= dt;
  const R = LIFE.road;
  if (LIFE.xT > 0 || !R || !R.x) return;
  LIFE.xT = 0.5;
  for (const kk in LIFE.xCd) if (LIFE.xCd[kk] > 0) LIFE.xCd[kk] -= 0.5;
  const L = LIFE.npcs, cnt = {}, squads = new Set();
  let ext = 0, port = 0, walkers = 0;
  for (let i = 0; i < L.length; i++) {
    const n = L[i];
    if (n.dead) continue;
    if (n.port && n.st !== 'fade') port++;
    if (!n.ext) continue;
    if (n.host && n.st !== 'fade' && (n.host.dead || n.host.st !== 'act')) { lifeFadeOut(n); continue; }
    if (n.st === 'fade' || (typeof lifeRetiring === 'function' && lifeRetiring(n))) continue;
    ext++;
    cnt[n.role] = (cnt[n.role] || 0) + 1;
    if (n.role === 'guard_patrol') squads.add(n.squad);
    else if (n.role === 'guard_post' && !n.stat) walkers++;
  }
  const tg = lifeXTargets(cnt);
  LIFE.xTarget = tg;
  const allMax = Math.floor((LIFE_ALL_MAX[lifeEffDensity()] || 0) * (lifeLowEnd() ? 0.5 : 1));
  let budget = allMax - (LIFE.live + port + ext);
  if (budget < 0) {
    // 全體超過上限:依優先序反向縮減街景角色
    let over = -budget;
    for (let r = LIFE_XROLES.length - 1; r >= 0 && over > 0; r--) {
      if (cnt[LIFE_XROLES[r]]) over -= lifeXShed(LIFE_XROLES[r], 1);
    }
    return;
  }
  let spawns = 0;
  const maxSp = LIFE.xSeed > 0 ? 6 : 2;
  for (let r = 0; r < LIFE_XROLES.length; r++) {
    const role = LIFE_XROLES[r];
    const cur = role === 'guard_patrol' ? squads.size : (cnt[role] || 0);
    if (cur > tg[role]) { lifeXShed(role, cur - tg[role]); continue; }
    if (cur >= tg[role] || spawns >= maxSp || budget <= 0) continue;
    if (LIFE.xSeed <= 0 && (LIFE.xCd[role] || 0) > 0) continue;
    const mid = LIFE.xSeed > 0;
    let made = 0;
    switch (role) {
      case 'guard_post': made = lifeXSpawnPost(walkers, tg.guard_post); break;
      case 'guard_patrol': made = lifeXSpawnSquad(budget); break;
      case 'wagon': made = typeof trafficSeeded === 'function' ? trafficSeeded('wagon', function () { return lifeXSpawnWagon(trafficMid('wagon')); }) : lifeXSpawnWagon(mid); break;   // 車馬生成決策用種子亂數(世界 + 日 + 時段)
      case 'rider': made = typeof trafficSeeded === 'function' ? trafficSeeded('rider', function () { return lifeXSpawnRider(trafficMid('rider')); }) : lifeXSpawnRider(mid); break;
      case 'peddler': made = lifeXSpawnPeddler(mid); break;
      case 'hawker': made = lifeXSpawnHawker(); break;
      case 'onlooker': made = lifeXSpawnOnlooker(); break;
    }
    if (made > 0) {
      spawns++; budget -= made;
      LIFE.xCd[role] = LIFE_XCD[role] || 0;
      if (LIFE.xSeed > 0) LIFE.xSeed--;
      if (role === 'guard_post') { const q = L[L.length - 1]; if (q && q.role === 'guard_post' && !q.stat) walkers++; }
    }
  }
}

// 開發 / 測試用:各類現存人數(小隊以隊數計)
function lifeTrafficStats() {
  const o = { total: 0 }, sq = new Set();
  LIFE.npcs.forEach(function (n) {
    if (!n.ext || n.dead || n.st === 'fade') return;
    o.total++;
    if (n.role === 'guard_patrol') sq.add(n.squad);
    else o[n.role] = (o[n.role] || 0) + 1;
  });
  o.guard_patrol = sq.size;
  return o;
}
