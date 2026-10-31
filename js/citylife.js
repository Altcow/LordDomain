// citylife.js — 居民人流(PLAN_CITYLIFE.md C0 + 密度/效能/熱鬧行為擴充)
// 道路圖 BFS、入出城、走進門格、閒聊、點擊小卡、密度設定與自適應降載。只在 estate / visit 更新與繪製;
// 不讀寫 world 的數據欄位、不寫主存檔(只可存 LIFE_KEY 的 {on, density})。

const LIFE_KEY = 'lorddomain.life.v1';
const LIFE_SPR_BUDGET = 12 * 1024 * 1024; // 居民 sprite 快取預算(bytes),超過以 LRU 淘汰居民 sprite
const LIFE_LRU = 64;          // 距離場快取張數
const LIFE_RES_MAX = 2;       // 居民 sprite 解析度上限(控制快取大小)
const LIFE_GRID = 0.8;        // 閒聊粗格桶邊長(格);配對半徑 0.8 格,3×3 桶即可涵蓋
const LIFE_OFF_GAP = 0.75;    // 畫面外居民的粗更新間隔(秒)
const LIFE_MAX_LIFE = 360;    // 單一居民壽命上限(秒),到時直接走向入口離場
const LIFE_DOT_MAX = 80;      // 縮放 < 0.35 時最多畫的色點數
const LIFE_IDLE_SPOTS = 12;   // 閒逛停點數(道路圖抽樣,避免每次隨機產生新距離場)

const LIFE = {
  inited: false, cfgOk: false, on: true, density: 'mid', active: false, placing: false,
  npcs: [], nid: 0, gid: 0, live: 0, target: 0, adj: 1, level: 0, healthy: 0, adaptT: 0, tgtT: 0,
  seedLeft: 0, seedFail: 0, road: null, buck: null, seeded: false, reseed: false,
  lastT: null, clock: 0, sigT: 0, spawnT: 0.5, chatT: 0, sprT: 0, statT: 0, tod: 'noon',
  bfsBudget: 1, dots: 0, pairCmp: 0, chatHead: null, chatNext: null, tradeAt: new Map(),
  drawAcc: 0, wallT: -1, fps: 0, perfLog: false, sprBytes: 0, specs: {}, variantIds: {},
  perf: { ms: 0 }, card: null, cardFor: null
};

function lifeNow() {
  return (typeof performance !== 'undefined') ? performance.now() : Date.now();
}

// 設定讀寫(只存 {on, density};失敗不影響遊戲)
function lifeLoadCfg() {
  if (LIFE.cfgOk) return;
  LIFE.cfgOk = true;
  try {
    const s = localStorage.getItem(LIFE_KEY);
    if (s) {
      const v = JSON.parse(s);
      LIFE.on = !(v && v.on === false);
      if (v && typeof v.density === 'string' && Object.prototype.hasOwnProperty.call(LIFE_DENSITY, v.density)) LIFE.density = v.density;
    }
  } catch (e) {
    LIFE.on = true;
  }
}

function lifeSaveCfg() {
  try {
    localStorage.setItem(LIFE_KEY, JSON.stringify({ on: LIFE.on, density: LIFE.density }));
  } catch (e) {
    console.warn('[life] settings write failed', e);
  }
}

function lifeInit() {
  LIFE.inited = true;
  lifeLoadCfg();
  LIFE.perfLog = typeof location !== 'undefined' && !!location && /(^|[?&])perf(&|=|$)/.test(location.search || '');
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) LIFE.reseed = true;
    });
  }
}

function lifeGetDensity() {
  lifeLoadCfg();
  return LIFE.density;
}

// 設定面板『居民密度』:立即生效(目標人數重算;增加時補生成,減少時淡出多出的人)
function lifeSetDensity(k) {
  lifeLoadCfg();
  if (!Object.prototype.hasOwnProperty.call(LIFE_DENSITY, k)) return;
  LIFE.density = k;
  LIFE.adj = 1; LIFE.level = 0; LIFE.healthy = 0;
  lifeSaveCfg();
  LIFE.tgtT = 0;
  if (k === 'off') lifeReset();
  else if (LIFE.road) lifeRetarget();
}

function lifeActive() {
  const mode = (typeof game !== 'undefined') ? game.mode : 'estate';
  if (!LIFE.on || !LIFE_DENSITY[LIFE.density]) return false;
  if (mode !== 'estate' && mode !== 'visit') return false;
  if (typeof hide !== 'undefined' && hide.on) return false;
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
    if (o) {
      let th = 0;
      for (let c = 0; c < o.type.length; c++) th = (th * 31 + o.type.charCodeAt(c)) | 0;
      t = t * 131 + th + (o.rot | 0) + 1;
    }
    h ^= (t + i * 0x9e37) | 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 建築的門格:優先面(house 正面 rot0 南=+y、rot1 西=−x、rot2 北=−y、rot3 東=+x;hospital/research=+y)有道路才用,否則其他面;
// 同高度道路格中取離建築中心最近者。找不到 = 沒有門路,不是目的地。
function lifeFindDoor(o, ok) {
  const fp = footprint(o.type, o.rot), w = fp[0], h = fp[1];
  const hb = world.height[idx(o.x, o.y)];
  const faces = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let order = [0, 1, 2, 3];
  let pref = -1;
  if (o.type === 'house') pref = ((o.rot & 3) + 1) & 3;
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

// 可穿越的門類 3×1(中格可走,兩側為柱/牆不可走);通行軸由 rot 決定(0/2 南北、1/3 東西)
const LIFE_PASS_TYPES = { gate: 1, paifang: 1, toll_gate: 1, gate_courtyard: 1 };

// 道路圖:可走格 + 4 鄰接(同高;高差 1 且任一格有階梯/斜坡才相連)+ 入口 + 門格 + 閒逛停點 + 固定巡邏路線
function lifeRebuild() {
  const N = MAP_W * MAP_H;
  const ok = new Uint8Array(N), nb = new Int16Array(N * 4), stairs = new Uint8Array(N), gm = new Uint8Array(N), gt = new Uint8Array(N);
  nb.fill(-1);
  let k, i, o, fp;
  for (k = 0; k < world.objects.length; k++) {
    o = world.objects[k];
    if (LIFE_PASS_TYPES[o.type]) {
      fp = footprint(o.type, o.rot);
      const mi = idx(o.x + (fp[0] >> 1), o.y + (fp[1] >> 1));
      gm[mi] = 1;
      if (o.type === 'gate') gt[mi] = 1;
    }
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
  if (!ent.length) for (i = 0; i < N; i++) if (gt[i] && ok[i]) ent.push({ cell: i, ox: 0, oy: 0 });
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
  LIFE.road = { ok: ok, nb: nb, list: list, ent: ent, dests: dests, bcount: bcount, dc: new Map(), q: new Int32Array(N), sig: lifeRoadSig(), spots: [], patrol: null };
  const R = LIFE.road;
  // 閒逛停點:道路格等距抽樣(確定性),讓距離場數量有上限
  const step = Math.max(1, Math.floor(list.length / LIFE_IDLE_SPOTS));
  for (k = 0; k < list.length && R.spots.length < LIFE_IDLE_SPOTS; k += step) R.spots.push(list[k]);
  // 固定巡邏路線:城主府門(或第一個目的地)↔ 離它最遠的入口
  let pd = null;
  for (k = 0; k < dests.length; k++) if (dests[k].type === 'palace') { pd = dests[k]; break; }
  if (!pd && dests.length) pd = dests[0];
  if (pd && ent.length) {
    const D = lifeDist(pd.cell);
    let best = null, bd = 0;
    for (k = 0; k < ent.length; k++) if (D[ent[k].cell] > bd) { bd = D[ent[k].cell]; best = ent[k]; }
    if (best) R.patrol = { da: pd, a: pd.cell, b: best.cell };
  }
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

// 目標導向 BFS 距離場(LRU 64,地圖變動時整個丟棄;命中時移到最新)
function lifeDist(g) {
  const R = LIFE.road;
  let D = R.dc.get(g);
  if (D) { R.dc.delete(g); R.dc.set(g, D); return D; }
  if (R.dc.size >= LIFE_LRU) R.dc.delete(R.dc.keys().next().value);
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

// 每幀預算:新距離場每幀最多 1 張;已快取者不受限。預算用完回傳 null,呼叫端改日再試
function lifeField(g) {
  const R = LIFE.road;
  if (R.dc.has(g)) return lifeDist(g);
  if (LIFE.bfsBudget <= 0) return null;
  LIFE.bfsBudget--;
  return lifeDist(g);
}

// 回傳 -2 = 距離場還沒算好(等待);-1 = 走不到;其餘為下一格
function lifePickNext(n) {
  const D = lifeField(n.goal);
  if (!D) return -2;
  const d0 = D[n.cur];
  if (d0 <= 0) return -1;
  const R = LIFE.road, cands = [];
  for (let k = 0; k < 4; k++) {
    const j = R.nb[n.cur * 4 + k];
    if (j >= 0 && D[j] === d0 - 1) cands.push(j);
  }
  if (!cands.length) return -1;
  // 結伴 / 縱隊 / 巡邏:同組成員在同一格做同樣選擇,走同一條路
  if (n.det) return cands[(n.cur * 31 + n.goal * 17 + n.det * 7) % cands.length];
  return cands[Math.floor(Math.random() * cands.length)];
}

function lifePickCell(from) {
  const R = LIFE.road;
  if (!R.spots.length) return -1;
  for (let t = 0; t < 4; t++) {
    const c = R.spots[Math.floor(Math.random() * R.spots.length)];
    if (c === from) continue;
    const D = lifeField(c);
    if (D && D[from] >= 0) return c;
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
    const D = lifeField(pick.cell);
    if (D && D[from] >= 0) return pick;
  }
  return null;
}

function lifePickEnt(from, avoid) {
  const R = LIFE.road;
  if (!R.ent.length) return null;
  for (let t = 0; t < 8; t++) {
    const e = R.ent[Math.floor(Math.random() * R.ent.length)];
    if (e === avoid && R.ent.length > 1) continue;
    const D = lifeField(e.cell);
    if (D && D[from] >= 0) return e;
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

// 時段與季節:夜間只剩巡夜與醉漢,孩童不出門;冬季乞丐加倍(與 PLAN §5 一致)
function lifePickType() {
  const R = LIFE.road, night = LIFE.tod === 'night', winter = lifeSeason() === 'winter';
  const keys = [], ws = [];
  let tot = 0;
  Object.keys(LIFE_TYPES).forEach(k => {
    const T = LIFE_TYPES[k];
    if (!(T.w > 0)) return;
    if (T.needs && !T.needs.some(b => R.bcount[b] > 0)) return;
    if (T.night === 'only' && !night) return;
    if (night && T.night === 'no') return;
    let w = T.w;
    if (night && T.night !== 'only' && k !== 'soldier') w *= 0.05;
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

// 外觀:ART.UNIT 的 NPC 基本外觀;civil 外觀有一半機率換成替代服色(id 加 _a),變體總數遠低於 40
function lifeSpecFor(look) {
  if (typeof ART === 'undefined' || !ART.UNIT || !ART.UNIT[look]) return null;
  const base = ART.UNIT[look];
  LIFE.variantIds[look] = true;
  if (!base.civil || Math.random() < 0.5) return base;
  const vid = look + '_a';
  let s = LIFE.specs[vid];
  if (!s) {
    let h = 0;
    for (let i = 0; i < look.length; i++) h += look.charCodeAt(i);
    const alt = LIFE_ALT_TINTS[h % LIFE_ALT_TINTS.length];
    s = Object.assign({}, base, { id: vid, tunic: alt.tunic, trim: alt.trim });
    LIFE.specs[vid] = s;
  }
  LIFE.variantIds[vid] = true;
  return s;
}

function lifeNew(key, T, start, plan) {
  const look = T.looks[Math.floor(Math.random() * T.looks.length)];
  return {
    id: ++LIFE.nid, type: key, name: LIFE_NAMES[Math.floor(Math.random() * LIFE_NAMES.length)],
    look: look, spec: lifeSpecFor(look), col: LIFE_PH_COL[key] || '#888888',
    st: 'walk', t: 0, dur: 0, act: '', life: 0, alpha: 0, acc: 0, cd: 0, dead: false, onS: false,
    x: 0, y: 0, px: 0, py: 0, cur: start, nx: -1, tx: 0, ty: 0, goal: plan[0].cell, plan: plan, pi: 0,
    lane: 0.12, spd: T.spd, ph: Math.random() * 2, wait: 0, det: 0, loop: false, hold: 0,
    fx: 0, fy: 0, ex: 0, ey: 0, ddx: 0, ddy: 0, ox: 0, oy: 0, pair: null, gi: -1,
    pp: { spec: null, x: 0, y: 0, f: 0, fr: 0, alpha: 1 }
  };
}

// 放置一組居民(count 人共用路線與步速;結伴/縱隊/巡邏靠 det 走同一條路)
// entry:入口 {cell,ox,oy}、門 {cell,bx,by} 或 null(mid = true 時擺在路上)
function lifeEmit(T, key, count, start, plan, entry, mid, o) {
  const lane = 0.12 + Math.random() * 0.13;
  const sf = (0.85 + Math.random() * 0.3) * (o.spdMul || 1);
  const sx = (start % MAP_W) + 0.5, sy = Math.floor(start / MAP_W) + 0.5;
  let made = 0;
  for (let i = 0; i < count; i++) {
    const n = lifeNew(key, T, start, plan);
    n.det = o.det || 0; n.lane = lane; n.spd = T.spd * sf; n.loop = !!o.loop; n.hold = (o.stagger || 0) * i;
    if (mid) {
      n.x = sx; n.y = sy; n.life = 1;
    } else if (entry && entry.bx !== undefined) {
      // 從建築門口出現(門格上淡入,不踩在建築格上)
      n.x = sx; n.y = sy;
    } else if (entry && (entry.ox || entry.oy)) {
      // 從地圖邊緣走進來
      n.x = sx + entry.ox * 0.9; n.y = sy + entry.oy * 0.9; n.cur = -1; n.nx = start; n.tx = sx; n.ty = sy;
    } else {
      n.x = sx; n.y = sy;
    }
    n.px = isoX(n.x, n.y); n.py = isoY(n.x, n.y, lifeHAt(n.x, n.y));
    LIFE.npcs.push(n);
    LIFE.live++;
    made++;
  }
  return made > 0;
}

// 一般生成:mid = 擺在路上的中途;否則從入口、或從民房/市集門走出來
function lifeSpawn(mid) {
  const R = LIFE.road;
  if (!R || !R.list.length) return false;
  const room = LIFE.target - LIFE.live;
  if (room <= 0) return false;
  if (!mid && room >= 6 && R.ent.length >= 2 && Math.random() < 0.04) return lifeSpawnCaravan(room);
  const key = lifePickType();
  if (!key) return false;
  const T = LIFE_TYPES[key];
  if (key === 'soldier') {
    if (!mid && R.patrol && Math.random() < 0.5) return lifeSpawnPatrol();
  }
  let count = 1;
  if (key !== 'soldier' && room >= 2 && Math.random() < 0.2) count = 2 + Math.floor(Math.random() * 3);
  if (key === 'kid' && room >= 2 && Math.random() < 0.5) count = 2 + Math.floor(Math.random() * 2);
  count = Math.min(count, room);
  let start, ent = null, door = null;
  if (mid) {
    start = R.list[Math.floor(Math.random() * R.list.length)];
  } else if (R.dests.length && Math.random() < 0.2) {
    door = R.dests[Math.floor(Math.random() * R.dests.length)];
    start = door.cell;
  } else {
    if (!R.ent.length) return false;
    ent = R.ent[Math.floor(Math.random() * R.ent.length)];
    start = ent.cell;
  }
  const plan = lifePlan(T, start, ent);
  if (!plan) return false;
  const det = count > 1 ? ++LIFE.gid : 0;
  return lifeEmit(T, key, count, start, plan, door || ent, mid, { det: det, spdMul: key === 'kid' && count > 1 ? 1.5 : 1 });
}

// 商隊:邊界入口 → 最遠的另一個入口,6~12 人一列,每 0.8 秒一人依序進場
function lifeSpawnCaravan(room) {
  const R = LIFE.road;
  const a = R.ent[Math.floor(Math.random() * R.ent.length)];
  const D = lifeField(a.cell);
  if (!D) return false;
  let best = null, bd = 0;
  for (let k = 0; k < R.ent.length; k++) {
    const e = R.ent[k];
    if (e.cell !== a.cell && D[e.cell] > bd) { bd = D[e.cell]; best = e; }
  }
  if (!best) return false;
  const count = Math.min(room, 6 + Math.floor(Math.random() * 7));
  const plan = [{ cell: best.cell, end: 'exit', ent: best }];
  return lifeEmit(LIFE_TYPES.caravan, 'caravan', count, a.cell, plan, a, false, { det: ++LIFE.gid, stagger: 0.8 });
}

// 巡邏兵:固定路線 城主府門 ↔ 最遠入口,來回走(loop),所有巡邏兵走同一條路
function lifeSpawnPatrol() {
  const P = LIFE.road.patrol;
  const plan = [{ cell: P.b, act: 'stand', dur: 3 }, { cell: P.a, act: 'stand', dur: 3 }];
  return lifeEmit(LIFE_TYPES.soldier, 'soldier', 1, P.a, plan, P.da, false, { det: 9001, loop: true });
}

// 目標人數 = 密度基礎 × 時段 × 季節,再受道路格數(÷3)與目的地數量上限約束;自適應降載只乘在上面,最低 12 人
function lifeTarget() {
  const base = LIFE_DENSITY[LIFE.density] || 0;
  const R = LIFE.road;
  if (!LIFE.on || !base || !R) return 0;
  const seasonMul = lifeSeason() === 'winter' ? LIFE_WINTER_MUL : 1;
  const raw = Math.min(base * (LIFE_TOD_MUL[LIFE.tod] || 1) * seasonMul, Math.floor(R.list.length / 1.5), 12 + 10 * R.dests.length);
  if (raw <= 0) return 0;
  const floor = Math.min(12, Math.round(raw));
  return Math.min(base, Math.max(floor, Math.round(raw * LIFE.adj)));
}

// 重算目標;增加時補生成;減少時淡出多出的人(畫面外優先)
function lifeRetarget() {
  const t = lifeTarget();
  const want = Math.floor(t * 0.6) - LIFE.live;
  if (t > LIFE.target && want > LIFE.seedLeft) LIFE.seedLeft = want;
  LIFE.target = t;
  const over = LIFE.live - t;
  if (over > 0) lifeShed(over);
}

function lifeShed(k) {
  const L = LIFE.npcs;
  for (let pass = 0; pass < 2 && k > 0; pass++) {
    for (let i = 0; i < L.length && k > 0; i++) {
      const n = L[i];
      if (n.st !== 'walk' && n.st !== 'act' && n.st !== 'chat') continue;
      if (n.hold > 0 || (pass === 0 && n.onS)) continue;
      lifeFadeOut(n);
      k--;
    }
  }
}

function lifeSpawnTick(dt) {
  if (LIFE.seedLeft > 0) {
    let tries = 0;
    while (LIFE.seedLeft > 0 && LIFE.live < LIFE.target && tries < 10) {
      tries++;
      if (lifeSpawn(true)) LIFE.seedLeft--;
      else if (LIFE.bfsBudget <= 0) break;
    }
    if (tries >= 10) LIFE.seedFail++;
    if (LIFE.seedFail > 300) { LIFE.seedLeft = 0; LIFE.seedFail = 0; }
  }
  LIFE.spawnT -= dt;
  if (LIFE.spawnT <= 0) {
    const deficit = LIFE.target - LIFE.live;
    LIFE.spawnT = deficit > 0 ? (deficit > 20 ? 0.2 : 0.5) + Math.random() * 0.35 : 1 + Math.random() * 2;
    if (deficit > 0 && !lifeSpawn(false)) LIFE.spawnT = 0.3;
  }
}

function lifeReset() {
  LIFE.npcs.length = 0;
  LIFE.live = 0;
  LIFE.seeded = false;
  LIFE.seedLeft = 0;
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
    let act = s.act;
    // 攤位前最多 3 人停留,其餘人站著排隊
    if (act === 'trade') {
      const k = LIFE.tradeAt.get(s.cell) || 0;
      if (k >= 3) act = 'queue';
      else LIFE.tradeAt.set(s.cell, k + 1);
    }
    n.st = 'act'; n.act = act;
    n.dur = act === 'queue' ? 4 + Math.random() * 3 : s.dur;
  }
}

// 進行到行程的下一站;巡邏循環、超過壽命則改走向入口離場。回傳 false 表示無路可走
function lifeNextStop(n) {
  if (n.pi + 1 < n.plan.length) {
    n.pi++;
  } else if (n.loop && n.life < LIFE_MAX_LIFE) {
    n.pi = 0;
  } else {
    const ex = lifePickEnt(n.cur, null);
    if (!ex) return false;
    n.plan = [{ cell: ex.cell, end: 'exit', ent: ex }];
    n.pi = 0; n.loop = false;
  }
  n.goal = n.plan[n.pi].cell;
  n.st = 'walk';
  return true;
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
      if (j === -2) { n.wait += dt; if (n.wait > 3) lifeFadeOut(n); return; }
      if (j < 0) { lifeFadeOut(n); return; }
      n.wait = 0;
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
  // 縱隊的後段先隱藏等待
  if (n.hold > 0) { n.hold -= dt; n.alpha = 0; return; }
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
      if (n.t >= n.dur && !lifeNextStop(n)) lifeFadeOut(n);
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

function lifeChatOk(a) {
  return a.st === 'walk' && a.cd <= 0 && a.life >= 1 && !a.dead && a.onS && !a.pair && !(a.hold > 0);
}

function lifeCellOf(x, y, GW, GH) {
  let gx = Math.floor((x + 2) / LIFE_GRID), gy = Math.floor((y + 2) / LIFE_GRID);
  if (gx < 0) gx = 0; else if (gx >= GW) gx = GW - 1;
  if (gy < 0) gy = 0; else if (gy >= GH) gy = GH - 1;
  return gy * GW + gx;
}

// 相遇閒聊:兩個走路中的人距離很近時,各自停下 3~5 秒面對面。
// 粗格桶(單鏈結串列)把比較限制在 3×3 鄰格,成本 O(n);每次最多配對 2 組
function lifeChatCheck() {
  const L = LIFE.npcs, n = L.length;
  if (n < 2) return;
  const GW = Math.ceil((MAP_W + 4) / LIFE_GRID), GH = Math.ceil((MAP_H + 4) / LIFE_GRID);
  if (!LIFE.chatHead || LIFE.chatHead.length !== GW * GH) LIFE.chatHead = new Int32Array(GW * GH);
  if (!LIFE.chatNext || LIFE.chatNext.length < n) LIFE.chatNext = new Int32Array(Math.max(256, n * 2));
  const head = LIFE.chatHead, nxt = LIFE.chatNext;
  head.fill(-1);
  for (let i = 0; i < n; i++) {
    nxt[i] = -1;
    const a = L[i];
    if (!lifeChatOk(a)) continue;
    const c = lifeCellOf(a.x, a.y, GW, GH);
    nxt[i] = head[c]; head[c] = i;
  }
  let made = 0;
  outer:
  for (let i = 0; i < n; i++) {
    const a = L[i];
    if (!lifeChatOk(a)) continue;
    const c0 = lifeCellOf(a.x, a.y, GW, GH), gx = c0 % GW, gy = (c0 - gx) / GW;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = gx + dx, cy = gy + dy;
        if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) continue;
        for (let j = head[cy * GW + cx]; j >= 0; j = nxt[j]) {
          if (j <= i) continue;
          LIFE.pairCmp++;
          const b = L[j];
          if (!lifeChatOk(b) || (a.det && a.det === b.det)) continue;
          const ddx = a.x - b.x, ddy = a.y - b.y;
          if (ddx * ddx + ddy * ddy > 0.64 || Math.random() < 0.5) continue;
          const dur = 3 + Math.random() * 2;
          a.st = 'chat'; b.st = 'chat'; a.pair = b; b.pair = a;
          a.t = 0; b.t = 0; a.dur = dur; b.dur = dur;
          made++;
          if (made >= 2) break outer;
          break;
        }
      }
    }
  }
}

function lifeOnScreen(n) {
  if (!(viewport.w > 0)) return true;
  const m = 80, s = worldToScreen(n.px, n.py);
  return s[0] > -m && s[0] < viewport.w + m && s[1] > -m && s[1] < viewport.h + m;
}

// 居民 sprite 快取預算:只管 NPC 外觀(chibi|<變體 id>|…),超過 12MB 時從最舊的開始淘汰
function lifeSprTrim() {
  const A = (typeof ART !== 'undefined') ? ART : null;
  if (!A || !A.cache) return;
  const keys = [];
  let bytes = 0;
  for (const k in A.cache) {
    if (k.indexOf('chibi|') !== 0) continue;
    if (!LIFE.variantIds[k.split('|')[1]]) continue;
    keys.push(k);
    bytes += A.cache[k].bytes;
  }
  while (bytes > LIFE_SPR_BUDGET && keys.length) {
    let oi = 0;
    for (let i = 1; i < keys.length; i++) if (A.cache[keys[i]].last < A.cache[keys[oi]].last) oi = i;
    const k = keys[oi];
    keys[oi] = keys[keys.length - 1]; keys.pop();
    const c = A.cache[k];
    bytes -= c.bytes; A.cacheBytes -= c.bytes; A.cacheCount--;
    delete A.cache[k];
  }
  LIFE.sprBytes = bytes;
}

// 自適應降載:每幀耗時(更新 + 上一幀繪製)指數平均;壁鐘 FPS 只計連續幀
// 慢 → 目標 ×0.8 (每 2 秒一級,最低 12 人);快 → 每 4 秒回升一級
function lifeAdapt(dt, t0) {
  const now = lifeNow();
  const total = (now - t0) + LIFE.drawAcc;
  LIFE.drawAcc = 0;
  LIFE.perf.ms = LIFE.perf.ms * 0.9 + total * 0.1;
  if (LIFE.wallT >= 0) {
    const w = t0 - LIFE.wallT;
    if (w > 0 && w < 100) { const f = 1000 / w; LIFE.fps = LIFE.fps > 0 ? LIFE.fps * 0.9 + f * 0.1 : f; }
  }
  LIFE.wallT = t0;
  LIFE.adaptT += dt;
  if (LIFE.adaptT >= 2) {
    LIFE.adaptT = 0;
    const slow = LIFE.perf.ms > 3.5 || (LIFE.fps > 0 && LIFE.fps < 40);
    if (slow) {
      LIFE.healthy = 0;
      if (LIFE.level < 12) { LIFE.level++; LIFE.adj = Math.pow(0.8, LIFE.level); }
    } else if (LIFE.perf.ms < 2.5 && LIFE.level > 0) {
      LIFE.healthy++;
      if (LIFE.healthy >= 2) { LIFE.healthy = 0; LIFE.level--; LIFE.adj = Math.pow(0.8, LIFE.level); }
    }
  }
  LIFE.statT -= dt;
  if (LIFE.statT <= 0) {
    LIFE.statT = 2;
    if (LIFE.perfLog) console.log('[life]', JSON.stringify(lifeStats()));
  }
}

// 開發用:?perf 時每 2 秒印到 console;也可直接呼叫
function lifeStats() {
  return {
    n: LIFE.npcs.length, target: LIFE.target, ms: Math.round(LIFE.perf.ms * 100) / 100,
    fps: Math.round(LIFE.fps), level: LIFE.level
  };
}

function lifeFrame(time) {
  const t0 = lifeNow();
  if (!LIFE.inited) lifeInit();
  const dt = LIFE.lastT === null ? 0 : Math.min(0.1, Math.max(0, time - LIFE.lastT));
  LIFE.lastT = time;
  LIFE.placing = typeof ui !== 'undefined' && ui.tool !== null && ui.tool !== undefined;
  LIFE.dots = 0;
  LIFE.bfsBudget = 1;
  if (!lifeActive()) {
    LIFE.active = false;
    LIFE.drawAcc = 0;
    LIFE.wallT = -1;
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
  LIFE.tgtT -= dt;
  if (LIFE.tgtT <= 0 || !LIFE.seeded) { LIFE.tgtT = 1; lifeRetarget(); }
  if (!LIFE.seeded) {
    LIFE.seeded = true;
    LIFE.seedLeft = Math.max(0, Math.floor(LIFE.target * 0.6) - LIFE.live);
  }
  lifeSpawnTick(dt);
  LIFE.chatT -= dt;
  if (LIFE.chatT <= 0) { LIFE.chatT = 0.5; lifeChatCheck(); }

  // 更新:畫面內逐幀;畫面外每 0.75 秒一次,且每幀最多 1/4 的畫面外居民
  const L = LIFE.npcs;
  let offN = 0;
  for (let i = 0; i < L.length; i++) {
    const n = L[i];
    n.onS = lifeOnScreen(n);
    if (!n.onS) offN++;
  }
  let offBudget = Math.max(1, Math.ceil(offN / 4));
  for (let i = 0; i < L.length; i++) {
    const n = L[i];
    if (n.onS) {
      n.acc = 0;
      lifeAdvance(n, dt);
    } else {
      n.acc += dt;
      if (n.acc >= LIFE_OFF_GAP && offBudget > 0) {
        offBudget--;
        const h = n.acc;
        n.acc = 0;
        lifeAdvance(n, h);
      }
    }
    n.px = isoX(n.x, n.y); n.py = isoY(n.x, n.y, lifeHAt(n.x, n.y));
  }

  // 清除離場者;重算存活數與閒逛人數(攤位排隊用)
  const tradeAt = LIFE.tradeAt;
  tradeAt.clear();
  let w = 0, live = 0;
  for (let i = 0; i < L.length; i++) {
    const n = L[i];
    if (n.dead) {
      if (n.pair) { const p = n.pair; if (p.pair === n) { p.pair = null; if (p.st === 'chat') p.st = 'walk'; } n.pair = null; }
      if (LIFE.cardFor === n) lifeCardHide();
      continue;
    }
    L[w++] = n;
    if (n.st === 'walk' || n.st === 'act' || n.st === 'chat') live++;
    if (n.st === 'act' && n.act === 'trade') tradeAt.set(n.goal, (tradeAt.get(n.goal) || 0) + 1);
  }
  L.length = w;
  LIFE.live = live;

  // 依對角線分桶(重用陣列,不配置記憶體);成對閒聊時由較小 id 的一方負責畫整組
  const buck = LIFE.buck, D = MAP_W + MAP_H;
  for (let k = 0; k < D; k++) buck[k].length = 0;
  for (let i = 0; i < L.length; i++) {
    const n = L[i];
    if (n.hold > 0) continue;
    if (n.st === 'chat' && n.pair) {
      if (n.id > n.pair.id || !(n.onS || n.pair.onS)) continue;
    } else if (!n.onS) continue;
    let d = Math.floor(n.x) + Math.floor(n.y);
    if (d < 0) d = 0; else if (d >= D) d = D - 1;
    buck[d].push(n);
  }

  LIFE.sprT -= dt;
  if (LIFE.sprT <= 0) { LIFE.sprT = 2; lifeSprTrim(); }
  lifeAdapt(dt, t0);
}

function lifeFaceF(fx, fy) {
  const away = fx + fy < 0, right = fx - fy > 0;
  return away ? (right ? 2 : 1) : (right ? 3 : 0);
}

// 畫一個居民。ART 只有兩張原畫(正 0 / 背 1),右向以水平翻轉取代(2、3 由 0、1 翻轉而來),快取數量減半
function lifeDrawOne(ctx, n, res, tod, season, useArt, alpha) {
  if (useArt && n.spec) {
    const pp = n.pp, f = lifeFaceF(n.fx, n.fy), flip = f === 2 || f === 3;
    pp.spec = n.spec; pp.x = n.px; pp.y = n.py; pp.f = (f === 1 || f === 2) ? 1 : 0;
    pp.fr = n.st === 'walk' ? Math.floor(LIFE.clock * 4 + n.ph) % 2 : 0;
    pp.alpha = alpha;
    if (flip) { ctx.save(); ctx.translate(n.px, 0); ctx.scale(-1, 1); ctx.translate(-n.px, 0); }
    ART.chibiPose(ctx, pp, res, tod, season);
    if (flip) ctx.restore();
    return;
  }
  // 占位小人;縮放 < 0.5 時(LIFE.small)縮成約 8px 高的小人
  const k = LIFE.small ? 0.6 : 1;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = n.col;
  ctx.beginPath(); ctx.ellipse(n.px, n.py - 9 * k, 3.8 * k, 6.5 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0d2b0';
  ctx.beginPath(); ctx.arc(n.px, n.py - 18 * k, 3.4 * k, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// 依對角線分桶繪製(每個對角線一次呼叫,總成本 O(n));縮放分三級:正常 / <0.5 簡化 / <0.35 色點
function lifeDrawDiag(ctx, d, time) {
  if (!LIFE.active || !LIFE.buck) return;
  const list = LIFE.buck[d];
  if (!list || !list.length) return;
  const t0 = lifeNow();
  const z = (typeof pano !== 'undefined' && pano.open) ? Math.max(view.zoom, 0.5) : view.zoom, dpr = viewport.dpr || 1; // 全景截圖也要有人,以正常細緻度繪製
  const dots = z < 0.35;
  LIFE.small = z < 0.5;
  const useArt = !dots && z >= 0.5 && typeof ART !== 'undefined' && !!ART.chibiPose && !!ART.resBucket;
  const res = useArt ? Math.min(LIFE_RES_MAX, ART.resBucket(z * dpr)) : 1;
  const tod = LIFE.tod, season = lifeSeason();
  const mult = LIFE.placing ? 0.5 : 1;
  for (let k = 0; k < list.length; k++) {
    const n = list[k];
    const alpha = n.alpha * mult;
    if (alpha <= 0) continue;
    if (dots) {
      if (LIFE.dots >= LIFE_DOT_MAX) continue;
      LIFE.dots++;
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
    if (useArt && n.spec && ART.bubble) {
      if (n.st === 'act' && n.act === 'trade') {
        ART.bubble(ctx, n.px, n.py, 'trade', LIFE.clock, res, n.spec.scale || 1);
      } else if (n.type === 'vendor' && n.st === 'walk' && ((LIFE.clock + n.ph * 3) % 7) < 1.6) {
        // 挑擔商販沿路叫賣
        ART.bubble(ctx, n.px, n.py, 'talk', LIFE.clock, res, n.spec.scale || 1);
      }
    }
  }
  LIFE.drawAcc += lifeNow() - t0;
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
