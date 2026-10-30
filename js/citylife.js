// citylife.js — 居民人流 C0(PLAN_CITYLIFE.md §4.4~4.6、§7.2、§8 C0)
// 道路圖 BFS、入出城、走進門格、閒聊、點擊小卡。只在 estate / visit 更新與繪製;
// 不讀寫 world 的數據欄位、不寫主存檔(只可存 LIFE_KEY 的 {on})。

const LIFE_KEY = 'lorddomain.life.v1';
const LIFE_CAP = 12;

const LIFE = {
  inited: false, on: true, active: false, placing: false,
  npcs: [], nid: 0, cap: LIFE_CAP,
  road: null, buck: null, seeded: false, reseed: false,
  lastT: null, clock: 0, sigT: 0, spawnT: 0.5, chatT: 0, tod: 'noon',
  perf: { ms: 0 }, card: null, cardFor: null
};

function lifeInit() {
  LIFE.inited = true;
  try {
    const s = localStorage.getItem(LIFE_KEY);
    if (s) { const v = JSON.parse(s); LIFE.on = !(v && v.on === false); }
  } catch (e) {
    LIFE.on = true;
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) LIFE.reseed = true;
    });
  }
}

function lifeActive() {
  const mode = (typeof game !== 'undefined') ? game.mode : 'estate';
  if (!LIFE.on) return false;
  if (mode !== 'estate' && mode !== 'visit') return false;
  if (typeof hide !== 'undefined' && hide.on) return false;
  if (typeof pano !== 'undefined' && pano.open) return false;
  return true;
}

function lifeTod() {
  if (typeof artTodKey === 'function') return artTodKey();
  const h = new Date().getHours();
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'noon';
  if (h >= 17 && h < 19) return 'dusk';
  return 'night';
}

function lifeSeason() {
  return (typeof currentSeason === 'string') ? currentSeason : 'spring';
}

function lifeHAt(x, y) {
  const cx = Math.min(MAP_W - 1, Math.max(0, Math.floor(x)));
  const cy = Math.min(MAP_H - 1, Math.max(0, Math.floor(y)));
  return world.height[idx(cx, cy)];
}

function lifeRoadSig() {
  let h = (0x811c9dc5 ^ world.objects.length) >>> 0;
  const N = MAP_W * MAP_H;
  for (let i = 0; i < N; i++) {
    const n = world.occ[i];
    const o = n ? world.objects[n - 1] : null;
    let t = world.terrain[i] | (world.height[i] << 2);
    if (o) t = t * 131 + o.type.length * 7 + o.type.charCodeAt(0) * 3 + (o.rot | 0) + 1;
    h ^= (t + i * 0x9e37) | 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 建築的門格:優先面(house rot2=+x、rot3=+y;hospital/research=+y)有道路才用,否則其他面;
// 同高度道路格中取離建築中心最近者。找不到 = 沒有門路,不是目的地。
function lifeFindDoor(o, ok) {
  const fp = footprint(o.type, o.rot), w = fp[0], h = fp[1];
  const hb = world.height[idx(o.x, o.y)];
  const faces = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let order = [0, 1, 2, 3];
  let pref = -1;
  if (o.type === 'house') pref = (o.rot & 3) === 2 ? 0 : ((o.rot & 3) === 3 ? 1 : -1);
  else if (o.type === 'hospital' || o.type === 'research') pref = 1;
  if (pref >= 0) order = [pref].concat(order.filter(k => k !== pref));
  const bx = o.x + w / 2, by = o.y + h / 2;
  for (let q = 0; q < order.length; q++) {
    const f = faces[order[q]];
    const cand = [];
    if (f[0] === 1) for (let k = 0; k < h; k++) cand.push([o.x + w, o.y + k]);
    else if (f[1] === 1) for (let k = 0; k < w; k++) cand.push([o.x + k, o.y + h]);
    else if (f[0] === -1) for (let k = 0; k < h; k++) cand.push([o.x - 1, o.y + k]);
    else for (let k = 0; k < w; k++) cand.push([o.x + k, o.y - 1]);
    let best = -1, bd = 1e9;
    for (let c = 0; c < cand.length; c++) {
      const cx = cand[c][0], cy = cand[c][1];
      if (!inBounds(cx, cy)) continue;
      const i = idx(cx, cy);
      if (!ok[i] || world.height[i] !== hb) continue;
      const dd = Math.abs(cx + 0.5 - bx) + Math.abs(cy + 0.5 - by);
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best >= 0) return { cell: best, bx: bx, by: by };
  }
  return null;
}

// 道路圖:可走格 + 4 鄰接(同高;高差 1 且任一格有階梯/斜坡才相連)+ 入口 + 門格
function lifeRebuild() {
  const N = MAP_W * MAP_H;
  const ok = new Uint8Array(N), nb = new Int16Array(N * 4), stairs = new Uint8Array(N), gm = new Uint8Array(N);
  nb.fill(-1);
  let k, i, o, fp;
  for (k = 0; k < world.objects.length; k++) {
    o = world.objects[k];
    if (o.type === 'gate') { fp = footprint(o.type, o.rot); gm[idx(o.x + (fp[0] >> 1), o.y + (fp[1] >> 1))] = 1; }
  }
  for (i = 0; i < N; i++) {
    const n = world.occ[i];
    const obj = n ? world.objects[n - 1] : null;
    const tp = obj ? obj.type : '';
    if (tp === 'stairs' || tp === 'ramp') stairs[i] = 1;
    if (gm[i] || tp === 'bridge') { ok[i] = 1; continue; }
    if (world.terrain[i] === T_ROAD && (!obj || tp === 'stairs' || tp === 'ramp')) ok[i] = 1;
  }
  for (i = 0; i < N; i++) {
    if (!ok[i]) continue;
    const x = i % MAP_W, y = (i - x) / MAP_W;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const j = idx(nx, ny);
      if (!ok[j]) continue;
      const diff = Math.abs(world.height[i] - world.height[j]);
      if (diff === 0 || (diff === 1 && (stairs[i] || stairs[j]))) nb[i * 4 + d] = j;
    }
  }
  // 入口:邊界道路格 → 城門中格 → 道路盡頭(離城主府最遠的 3 個)
  const list = [], ent = [];
  for (i = 0; i < N; i++) {
    if (!ok[i]) continue;
    list.push(i);
    const x = i % MAP_W, y = (i - x) / MAP_W;
    if (x === 0) ent.push({ cell: i, ox: -1, oy: 0 });
    else if (x === MAP_W - 1) ent.push({ cell: i, ox: 1, oy: 0 });
    else if (y === 0) ent.push({ cell: i, ox: 0, oy: -1 });
    else if (y === MAP_H - 1) ent.push({ cell: i, ox: 0, oy: 1 });
  }
  if (!ent.length) for (i = 0; i < N; i++) if (gm[i] && ok[i]) ent.push({ cell: i, ox: 0, oy: 0 });
  if (!ent.length) {
    let rx = MAP_W / 2, ry = MAP_H / 2;
    for (k = 0; k < world.objects.length; k++) {
      if (world.objects[k].type === 'palace') { rx = world.objects[k].x + 2; ry = world.objects[k].y + 2; break; }
    }
    const ends = [];
    for (i = 0; i < N; i++) {
      if (!ok[i]) continue;
      let deg = 0;
      for (let d = 0; d < 4; d++) if (nb[i * 4 + d] >= 0) deg++;
      if (deg === 1) ends.push(i);
    }
    ends.sort((a, b) => {
      const da = Math.hypot(a % MAP_W - rx, Math.floor(a / MAP_W) - ry);
      const db = Math.hypot(b % MAP_W - rx, Math.floor(b / MAP_W) - ry);
      return db - da;
    });
    for (k = 0; k < ends.length && k < 3; k++) ent.push({ cell: ends[k], ox: 0, oy: 0 });
  }
  const dests = [], bcount = {};
  for (k = 0; k < world.objects.length; k++) {
    o = world.objects[k];
    if (LIFE_DEST_TYPES.indexOf(o.type) < 0) continue;
    const d = lifeFindDoor(o, ok);
    if (!d) continue;
    dests.push({ type: o.type, cell: d.cell, bx: d.bx, by: d.by });
    bcount[o.type] = (bcount[o.type] || 0) + 1;
  }
  LIFE.road = { ok: ok, nb: nb, list: list, ent: ent, dests: dests, bcount: bcount, dc: new Map(), q: new Int32Array(N), sig: lifeRoadSig() };
  if (!LIFE.buck) {
    LIFE.buck = [];
    for (k = 0; k < MAP_W + MAP_H; k++) LIFE.buck.push([]);
  }
  // 站在被拆掉道路上(或下一步要踏上去)的人直接淡出
  LIFE.npcs.forEach(n => {
    if (n.st === 'fade' || n.st === 'enter' || n.st === 'exit') return;
    const fx = Math.floor(n.x), fy = Math.floor(n.y);
    const onGround = fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && !ok[idx(fx, fy)];
    if (onGround || (n.cur >= 0 && !ok[n.cur]) || (n.nx >= 0 && !ok[n.nx])) lifeFadeOut(n);
  });
}

// 目標導向 BFS 距離場(LRU 24,地圖變動時整個丟棄)
function lifeDist(g) {
  const R = LIFE.road;
  let D = R.dc.get(g);
  if (D) return D;
  if (R.dc.size >= 24) R.dc.delete(R.dc.keys().next().value);
  D = new Int16Array(MAP_W * MAP_H).fill(-1);
  if (R.ok[g]) {
    let head = 0, tail = 0;
    R.q[tail++] = g; D[g] = 0;
    while (head < tail) {
      const c = R.q[head++];
      for (let d = 0; d < 4; d++) {
        const j = R.nb[c * 4 + d];
        if (j >= 0 && D[j] < 0) { D[j] = D[c] + 1; R.q[tail++] = j; }
      }
    }
  }
  R.dc.set(g, D);
  return D;
}

function lifePickNext(n) {
  const D = lifeDist(n.goal);
  const d0 = D[n.cur];
  if (d0 <= 0) return -1;
  const R = LIFE.road, cands = [];
  for (let k = 0; k < 4; k++) {
    const j = R.nb[n.cur * 4 + k];
    if (j >= 0 && D[j] === d0 - 1) cands.push(j);
  }
  if (!cands.length) return -1;
  return cands[Math.floor(Math.random() * cands.length)];
}

function lifePickCell(from) {
  const R = LIFE.road;
  if (!R.list.length) return -1;
  for (let t = 0; t < 5; t++) {
    const c = R.list[Math.floor(Math.random() * R.list.length)];
    if (c !== from && lifeDist(c)[from] >= 0) return c;
  }
  return -1;
}

function lifePickDoor(weights, from) {
  const R = LIFE.road, cands = [];
  let tot = 0;
  R.dests.forEach(d => {
    const w = weights[d.type] || 0;
    if (w > 0) { cands.push({ d: d, w: w }); tot += w; }
  });
  if (!cands.length) return null;
  for (let t = 0; t < 6; t++) {
    let r = Math.random() * tot, pick = cands[cands.length - 1].d;
    for (let c = 0; c < cands.length; c++) {
      r -= cands[c].w;
      if (r < 0) { pick = cands[c].d; break; }
    }
    if (lifeDist(pick.cell)[from] >= 0) return pick;
  }
  return null;
}

function lifePickEnt(from, avoid) {
  const R = LIFE.road;
  if (!R.ent.length) return null;
  for (let t = 0; t < 8; t++) {
    const e = R.ent[Math.floor(Math.random() * R.ent.length)];
    if (e === avoid && R.ent.length > 1) continue;
    if (lifeDist(e.cell)[from] >= 0) return e;
  }
  return null;
}

// 行程:(市集停點) → (閒逛停點) → 進門 或 出城
function lifePlan(T, startCell, avoid) {
  const plan = [];
  let prev = startCell;
  if (T.stop === 'market') {
    const md = lifePickDoor({ market: 1 }, prev);
    if (!md) return null;
    plan.push({ cell: md.cell, act: 'trade', dur: 8 + Math.random() * 12 });
    prev = md.cell;
  } else if (Math.random() < 0.35) {
    const lc = lifePickCell(prev);
    if (lc >= 0) { plan.push({ cell: lc, act: 'idle', dur: 3 + Math.random() * 5 }); prev = lc; }
  }
  let fin = null;
  if (Object.keys(T.to).length && Math.random() < 0.6) fin = lifePickDoor(T.to, prev);
  if (fin) {
    plan.push({ cell: fin.cell, end: 'enter', door: fin });
  } else {
    const ex = lifePickEnt(prev, avoid);
    if (!ex) return null;
    plan.push({ cell: ex.cell, end: 'exit', ent: ex });
  }
  return plan;
}

function lifePickType() {
  const R = LIFE.road, night = LIFE.tod === 'night', winter = lifeSeason() === 'winter';
  const keys = [], ws = [];
  let tot = 0;
  Object.keys(LIFE_TYPES).forEach(k => {
    const T = LIFE_TYPES[k];
    if (T.needs && !T.needs.some(b => R.bcount[b] > 0)) return;
    if (k === 'kid' && night) return;
    let w = T.w;
    if (k === 'beggar' && winter) w *= 2;
    keys.push(k); ws.push(w); tot += w;
  });
  if (!keys.length) return null;
  let r = Math.random() * tot;
  for (let i = 0; i < keys.length; i++) {
    r -= ws[i];
    if (r < 0) return keys[i];
  }
  return keys[keys.length - 1];
}

function lifeSpecFor(look) {
  if (typeof ART !== 'undefined' && ART.UNIT && ART.UNIT[look]) return ART.UNIT[look];
  return null;
}

// mid = true:隨機擺在路上的中途(開啟時補生成);否則從入口進場
function lifeSpawn(mid) {
  const R = LIFE.road;
  if (!R || !R.list.length) return false;
  const key = lifePickType();
  if (!key) return false;
  const T = LIFE_TYPES[key];
  let start, ent = null;
  if (mid) {
    start = R.list[Math.floor(Math.random() * R.list.length)];
  } else {
    if (!R.ent.length) return false;
    ent = R.ent[Math.floor(Math.random() * R.ent.length)];
    start = ent.cell;
  }
  const plan = lifePlan(T, start, ent);
  if (!plan) return false;
  const look = T.looks[Math.floor(Math.random() * T.looks.length)];
  const n = {
    id: ++LIFE.nid, type: key, name: LIFE_NAMES[Math.floor(Math.random() * LIFE_NAMES.length)],
    look: look, spec: lifeSpecFor(look), col: LIFE_PH_COL[key] || '#888888',
    st: 'walk', t: 0, dur: 0, act: '', life: 0, alpha: 0, acc: 0, cd: 0, dead: false, onS: false,
    x: 0, y: 0, px: 0, py: 0, cur: start, nx: -1, tx: 0, ty: 0, goal: plan[0].cell, plan: plan, pi: 0,
    lane: 0.12 + Math.random() * 0.13, spd: T.spd * (0.85 + Math.random() * 0.3), ph: Math.random() * 2,
    fx: 0, fy: 0, ex: 0, ey: 0, ddx: 0, ddy: 0, ox: 0, oy: 0, pair: null, gi: -1,
    pp: { spec: null, x: 0, y: 0, f: 0, fr: 0, alpha: 1 }
  };
  const cx = (start % MAP_W) + 0.5, cy = Math.floor(start / MAP_W) + 0.5;
  if (mid) {
    n.x = cx; n.y = cy; n.life = 1;
  } else if (ent.ox || ent.oy) {
    n.x = cx + ent.ox * 0.9; n.y = cy + ent.oy * 0.9;
    n.cur = -1; n.nx = start; n.tx = cx; n.ty = cy;
  } else {
    n.x = cx; n.y = cy;
  }
  n.px = isoX(n.x, n.y); n.py = isoY(n.x, n.y, lifeHAt(n.x, n.y));
  LIFE.npcs.push(n);
  return true;
}

function lifeSeed() {
  const want = Math.floor(LIFE.cap * 0.6);
  for (let i = 0; i < want; i++) lifeSpawn(true);
  LIFE.seeded = true;
}

function lifeReset() {
  LIFE.npcs.length = 0;
  LIFE.seeded = false;
  LIFE.spawnT = 0.5;
  LIFE.chatT = 0;
  lifeCardHide();
}

function lifeArrive(n) {
  const s = n.plan[n.pi];
  n.t = 0;
  n.ex = n.x; n.ey = n.y;
  if (s.end === 'enter') {
    n.st = 'enter';
    const dx = s.door.bx - n.x, dy = s.door.by - n.y, d = Math.hypot(dx, dy) || 1;
    n.ddx = dx / d; n.ddy = dy / d;
  } else if (s.end === 'exit') {
    n.ox = s.ent.ox; n.oy = s.ent.oy;
    n.st = (n.ox || n.oy) ? 'exit' : 'fade';
  } else {
    n.st = 'act'; n.act = s.act; n.dur = s.dur;
  }
}

function lifeFadeOut(n) {
  if (n.pair) {
    const p = n.pair;
    if (p.pair === n) { p.pair = null; if (p.st === 'chat') { p.st = 'walk'; p.cd = 20; } }
    n.pair = null;
  }
  n.st = 'fade'; n.t = 0;
}

function lifeChatEnd(n) {
  const p = n.pair;
  n.st = 'walk'; n.pair = null; n.cd = 20 + Math.random() * 10;
  if (p && p.pair === n) { p.st = 'walk'; p.pair = null; p.cd = n.cd; }
}

// 沿道路走:每段目標 = 下一格中心 + 靠右偏移(lane);一幀內可跨多格
function lifeWalk(n, dt) {
  const R = LIFE.road;
  let guard = 0;
  while (dt > 0 && n.st === 'walk' && guard++ < 8) {
    if (n.nx < 0) {
      if (n.cur === n.goal) { lifeArrive(n); return; }
      const j = lifePickNext(n);
      if (j < 0) { lifeFadeOut(n); return; }
      n.nx = j;
      const jx = (j % MAP_W) + 0.5, jy = Math.floor(j / MAP_W) + 0.5;
      if (n.cur >= 0) {
        const cx = (n.cur % MAP_W) + 0.5, cy = Math.floor(n.cur / MAP_W) + 0.5;
        const ux = jx - cx, uy = jy - cy;
        n.tx = jx - uy * n.lane; n.ty = jy + ux * n.lane;
      } else {
        n.tx = jx; n.ty = jy;
      }
    }
    const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.sqrt(dx * dx + dy * dy);
    const step = n.spd * dt;
    if (d <= step || d < 1e-6) {
      n.x = n.tx; n.y = n.ty;
      if (n.spd > 0) dt -= d / n.spd;
      n.cur = n.nx; n.nx = -1;
      if (!R.ok[n.cur]) { lifeFadeOut(n); return; }
    } else {
      n.x += dx / d * step; n.y += dy / d * step;
      n.fx = dx / d; n.fy = dy / d;
      dt = 0;
    }
  }
}

function lifeAdvance(n, dt) {
  n.life += dt;
  if (n.cd > 0) n.cd -= dt;
  if (n.st !== 'enter' && n.st !== 'exit' && n.st !== 'fade') n.alpha = Math.min(1, n.life / 0.5);
  switch (n.st) {
    case 'walk':
      lifeWalk(n, dt);
      break;
    case 'chat':
      n.t += dt;
      if (n.t >= n.dur) lifeChatEnd(n);
      break;
    case 'act':
      n.t += dt;
      if (n.t >= n.dur) { n.pi++; n.goal = n.plan[n.pi].cell; n.st = 'walk'; }
      break;
    case 'enter': {
      n.t += dt;
      const p = Math.min(1, n.t / 0.5);
      n.x = n.ex + n.ddx * 0.45 * p; n.y = n.ey + n.ddy * 0.45 * p;
      n.alpha = 1 - p;
      if (p >= 1) n.dead = true;
      break;
    }
    case 'exit': {
      n.t += dt;
      const p = Math.min(1, n.t / 0.6);
      n.x = n.ex + n.ox * 0.9 * p; n.y = n.ey + n.oy * 0.9 * p;
      n.alpha = 1 - p;
      if (p >= 1) n.dead = true;
      break;
    }
    case 'fade':
      n.t += dt;
      n.alpha = Math.max(0, 1 - n.t / 0.5);
      if (n.t >= 0.5) n.dead = true;
      break;
  }
}

// 相遇閒聊:兩個走路中的人距離很近時,各自停下 3~5 秒面對面
function lifeChatCheck() {
  const L = LIFE.npcs;
  for (let i = 0; i < L.length; i++) {
    const a = L[i];
    if (a.st !== 'walk' || a.cd > 0 || a.life < 1 || a.dead) continue;
    for (let j = i + 1; j < L.length; j++) {
      const b = L[j];
      if (b.st !== 'walk' || b.cd > 0 || b.life < 1 || b.dead) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy > 0.64 || Math.random() < 0.5) continue;
      const dur = 3 + Math.random() * 2;
      a.st = 'chat'; b.st = 'chat'; a.pair = b; b.pair = a;
      a.t = 0; b.t = 0; a.dur = dur; b.dur = dur;
      return;
    }
  }
}

function lifeOnScreen(n) {
  if (!(viewport.w > 0)) return true;
  const m = 80, s = worldToScreen(n.px, n.py);
  return s[0] > -m && s[0] < viewport.w + m && s[1] > -m && s[1] < viewport.h + m;
}

function lifeFrame(time) {
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  if (!LIFE.inited) lifeInit();
  const dt = LIFE.lastT === null ? 0 : Math.min(0.1, Math.max(0, time - LIFE.lastT));
  LIFE.lastT = time;
  LIFE.placing = typeof ui !== 'undefined' && ui.tool !== null && ui.tool !== undefined;
  if (!lifeActive()) {
    LIFE.active = false;
    if (LIFE.npcs.length) lifeReset();
    return;
  }
  LIFE.active = true;
  if (LIFE.reseed) { LIFE.reseed = false; lifeReset(); }
  if (!LIFE.road) lifeRebuild();
  LIFE.sigT -= dt;
  if (LIFE.sigT <= 0) {
    LIFE.sigT = 2;
    if (!LIFE.placing && lifeRoadSig() !== LIFE.road.sig) lifeRebuild();
  }
  LIFE.clock += dt;
  LIFE.tod = lifeTod();
  if (!LIFE.seeded) lifeSeed();
  LIFE.spawnT -= dt;
  if (LIFE.spawnT <= 0) {
    LIFE.spawnT = 2 + Math.random() * 4;
    if (LIFE.npcs.length < LIFE.cap && !lifeSpawn(false)) LIFE.spawnT = 1;
  }
  LIFE.chatT -= dt;
  if (LIFE.chatT <= 0) { LIFE.chatT = 0.5; lifeChatCheck(); }

  // 畫面外的人每 0.5 秒才推進一次(不畫、不插曲效果,只維持位置)
  const L = LIFE.npcs;
  for (let i = 0; i < L.length; i++) {
    const n = L[i];
    const on = lifeOnScreen(n);
    n.onS = on;
    if (on) lifeAdvance(n, dt);
    else { n.acc += dt; if (n.acc >= 0.5) { lifeAdvance(n, n.acc); n.acc = 0; } }
    n.px = isoX(n.x, n.y); n.py = isoY(n.x, n.y, lifeHAt(n.x, n.y));
  }
  let w = 0;
  for (let i = 0; i < L.length; i++) {
    const n = L[i];
    if (n.dead) {
      if (n.pair) { const p = n.pair; if (p.pair === n) { p.pair = null; if (p.st === 'chat') p.st = 'walk'; } n.pair = null; }
      if (LIFE.cardFor === n) lifeCardHide();
    } else L[w++] = n;
  }
  L.length = w;

  const buck = LIFE.buck, D = MAP_W + MAP_H;
  for (let k = 0; k < D; k++) buck[k].length = 0;
  for (let i = 0; i < L.length; i++) {
    const n = L[i];
    if (n.st === 'chat' && n.pair) {
      if (n.id > n.pair.id || !(n.onS || n.pair.onS)) continue;
    } else if (!n.onS) continue;
    let d = Math.floor(n.x) + Math.floor(n.y);
    if (d < 0) d = 0; else if (d >= D) d = D - 1;
    buck[d].push(n);
  }
  const after = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  LIFE.perf.ms = LIFE.perf.ms * 0.9 + (after - now) * 0.1;
}

function lifeFaceF(fx, fy) {
  const away = fx + fy < 0, right = fx - fy > 0;
  return away ? (right ? 2 : 1) : (right ? 3 : 0);
}

function lifeDrawOne(ctx, n, res, tod, season, useArt, alpha) {
  if (useArt && n.spec) {
    const pp = n.pp;
    pp.spec = n.spec; pp.x = n.px; pp.y = n.py; pp.f = lifeFaceF(n.fx, n.fy);
    pp.fr = n.st === 'walk' ? Math.floor(LIFE.clock * 4 + n.ph) % 2 : 0;
    pp.alpha = alpha;
    ART.chibiPose(ctx, pp, res, tod, season);
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = n.col;
  ctx.beginPath(); ctx.ellipse(n.px, n.py - 9, 3.8, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0d2b0';
  ctx.beginPath(); ctx.arc(n.px, n.py - 18, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// 依對角線分桶繪製;成對閒聊時由較小 id 的一方負責畫整組
function lifeDrawDiag(ctx, d, time) {
  if (!LIFE.active || !LIFE.buck) return;
  if (typeof pano !== 'undefined' && pano.open) return;
  const list = LIFE.buck[d];
  if (!list || !list.length) return;
  const z = view.zoom, dpr = viewport.dpr || 1;
  const dots = z < 0.35;
  const useArt = typeof ART !== 'undefined' && !!ART.chibiPose && !!ART.resBucket;
  const res = useArt ? ART.resBucket(z * dpr) : 1;
  const tod = LIFE.tod, season = lifeSeason();
  const mult = LIFE.placing ? 0.5 : 1;
  for (let k = 0; k < list.length; k++) {
    const n = list[k];
    const alpha = n.alpha * mult;
    if (alpha <= 0) continue;
    if (dots) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = n.col;
      ctx.beginPath(); ctx.arc(n.px, n.py - 5, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    if (n.st === 'chat' && n.pair) {
      const p = n.pair;
      if (useArt && n.spec && p.spec) {
        const pa = n.pp, pb = p.pp;
        pa.spec = n.spec; pa.x = n.px; pa.y = n.py; pa.f = lifeFaceF(p.x - n.x, p.y - n.y); pa.fr = 0; pa.alpha = alpha;
        pb.spec = p.spec; pb.x = p.px; pb.y = p.py; pb.f = lifeFaceF(n.x - p.x, n.y - p.y); pb.fr = 0; pb.alpha = p.alpha * mult;
        ART.chat(ctx, pa, pb, n.t, 'talk', res, tod, season);
      } else {
        lifeDrawOne(ctx, n, res, tod, season, false, alpha);
        lifeDrawOne(ctx, p, res, tod, season, false, p.alpha * mult);
      }
      continue;
    }
    lifeDrawOne(ctx, n, res, tod, season, useArt, alpha);
    if (n.st === 'act' && n.act === 'trade' && useArt && n.spec && ART.bubble) {
      ART.bubble(ctx, n.px, n.py, 'trade', LIFE.clock, res, n.spec ? (n.spec.scale || 1) : 1);
    }
  }
}

// C0 無疊層繪製(泡泡已在對角線內畫完);保留掛點
function lifeDrawTop(ctx, time) {
  void ctx; void time;
}

// 點人物:回傳 true 表示已處理(開小卡);點到建築或空地回傳 false
function lifeTap(sx, sy) {
  if (!LIFE.active || LIFE.placing || !LIFE.npcs.length) return false;
  let best = null, bd = 18 * 18;
  for (let i = 0; i < LIFE.npcs.length; i++) {
    const n = LIFE.npcs[i];
    if (n.dead || n.alpha < 0.5 || n.st === 'enter' || n.st === 'exit' || n.st === 'fade') continue;
    const h = worldToScreen(n.px, n.py - 20);
    const dx = sx - h[0], dy = sy - h[1], dd = dx * dx + dy * dy;
    if (dd < bd) { bd = dd; best = n; }
  }
  if (!best) return false;
  lifeCardShow(best);
  return true;
}

function lifeGreetNext(n) {
  let k = Math.floor(Math.random() * LIFE_GREET.length);
  if (LIFE_GREET.length > 1) while (k === n.gi) k = Math.floor(Math.random() * LIFE_GREET.length);
  n.gi = k;
  return LIFE_GREET[k];
}

function lifeCardMake() {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const box = document.createElement('div');
  box.id = 'lifeCard';
  box.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);width:min(300px,calc(100vw - 32px));' +
    'box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #e6b84a;background:rgba(40,30,22,0.94);' +
    'color:#f4ead2;font:14px/1.5 sans-serif;z-index:60;display:none';
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:baseline;gap:8px;';
  const nameEl = document.createElement('b');
  const typeEl = document.createElement('span');
  typeEl.style.cssText = 'color:#c9b98f;font-size:12px;flex:1;';
  const close = document.createElement('span');
  close.textContent = '✕';
  close.style.cssText = 'cursor:pointer;padding:0 4px;';
  close.addEventListener('click', function () { lifeCardHide(); });
  head.appendChild(nameEl); head.appendChild(typeEl); head.appendChild(close);
  const greet = document.createElement('div');
  greet.style.cssText = 'margin:8px 0;min-height:1.5em;';
  const btn = document.createElement('span');
  btn.textContent = '換一句 ↻';
  btn.style.cssText = 'cursor:pointer;color:#e6b84a;font-size:13px;';
  btn.addEventListener('click', function () {
    const n = LIFE.cardFor;
    if (n) greet.textContent = '「' + lifeGreetNext(n) + '」';
  });
  box.appendChild(head); box.appendChild(greet); box.appendChild(btn);
  document.body.appendChild(box);
  LIFE.card = { box: box, nameEl: nameEl, typeEl: typeEl, greet: greet };
  return LIFE.card;
}

function lifeCardShow(n) {
  const c = LIFE.card || lifeCardMake();
  if (!c) return;
  LIFE.cardFor = n;
  c.nameEl.textContent = n.name;
  c.typeEl.textContent = LIFE_TYPES[n.type].name;
  c.greet.textContent = '「' + lifeGreetNext(n) + '」';
  c.box.style.display = 'block';
}

function lifeCardHide() {
  LIFE.cardFor = null;
  if (LIFE.card) LIFE.card.box.style.display = 'none';
}
