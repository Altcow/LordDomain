// path.js — 尋路與流場(PLAN_TD_MASTER §6.1;規格 PLAN_TD_CORE §3.1~§3.6、§3.10)
// 只宣告函式與常數,載入時不執行模擬邏輯。
// 外部全域:MAP_W MAP_H OBJECTS DIRS T_GRASS T_LAKE T_RIVER T_ROAD(data.js、units.js)
// 選用掛點:stratCost(b, i, profile)(C 的危害;未定義時略過)

const WALL_BASE = 60;
const PATH_UNREACH = 0xFFFF;
const PATH_COST_MAX = 0xFFFE;
const PATH_INF = 0xFFFFFFFF;
const PATH_KEY_SHIFT = 4096;

// MOVE_COST[基礎 profile][地形值];地形值依 data.js:T_GRASS=0 T_LAKE=1 T_RIVER=2 T_ROAD=3
const MOVE_COST = {
  foot:  [10, PATH_UNREACH, 30, 8],
  horse: [10, PATH_UNREACH, 50, 7],
  heavy: [14, PATH_UNREACH, PATH_UNREACH, 8]
};
// 橋梁 / 階梯物件格的代價(§3.2「橋物件」欄)
const MOVE_BRIDGE = { foot: 8, horse: 8, heavy: 10 };
// 斜坡格代價:略低於階梯(寬坡較好走)
const MOVE_RAMP = { foot: 6, horse: 6, heavy: 7 };

// 8 方向:偶數為正交、奇數為斜向;邊的 bit k 對應 NB_OFF[k]
const NB_DX = [1, 1, 0, -1, -1, -1, 0, 1];
const NB_DY = [0, 1, 1, 1, 0, -1, -1, -1];
const NB_OFF = NB_DX.map(function (dx, k) { return NB_DY[k] * MAP_W + dx; });

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(v) {
    const a = this.a;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p] <= v) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = v;
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop(), n = a.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        if (r < n && a[r] < a[l]) l = r;
        if (a[l] >= last) break;
        a[i] = a[l];
        i = l;
      }
      a[i] = last;
    }
    return top;
  }
}

// profile 字串:'foot' | 'horse' | 'heavy' | 'foot:w'(牆代價 ×0.25)
function pathParseProfile(profile) {
  const s = String(profile), k = s.indexOf(':');
  return { base: k < 0 ? s : s.slice(0, k), wallMul: k >= 0 && s.slice(k + 1) === 'w' ? 0.25 : 1 };
}

// 格上存活且可見的建築;摧毀或隱藏視為地面
function pathBldAt(b, i) {
  const grid = b.bldGrid;
  if (!grid || !grid[i]) return null;
  const bl = b.bld[grid[i] - 1];
  if (!bl || !bl.alive || bl.hidden) return null;
  return bl;
}

function pathCellCost(b, i, row, pr, profile) {
  if (b.map.block[i] === 1) return PATH_UNREACH;
  let c = -1;
  const bl = pathBldAt(b, i);
  if (bl) {
    const cb = OBJECTS[bl.type].cb;
    if (cb.block === 'solid' || cb.block === 'obstacle') return PATH_UNREACH;
    if (cb.block === 'wall') {
      c = WALL_BASE + Math.floor(bl.hp / 10);
      if (pr.wallMul !== 1) c = Math.floor(c * pr.wallMul);
    } else if (bl.type === 'bridge' || bl.type === 'stairs') {
      c = MOVE_BRIDGE[pr.base];
    } else if (bl.type === 'ramp') {
      c = MOVE_RAMP[pr.base];
    }
  }
  if (c < 0) c = row[b.map.terrain[i]];
  if (c === PATH_UNREACH) return PATH_UNREACH;
  if (typeof stratCost === 'function') {
    const s = stratCost(b, i, profile);
    if (s === PATH_UNREACH) return PATH_UNREACH;
    c += s;
  }
  return c > PATH_COST_MAX ? PATH_COST_MAX : c;
}

// 格是否擋斜角:block===1、牆、實體、障礙
function pathIsBarrier(b, i) {
  if (b.map.block[i] === 1) return true;
  const bl = pathBldAt(b, i);
  if (!bl) return false;
  const kind = OBJECTS[bl.type].cb.block;
  return kind === 'wall' || kind === 'solid' || kind === 'obstacle';
}

// 斜坡格的坡度:沿朝向 DIRS[facing] 的鄰格較高 → +1、較低 → −1、同高或界外 → 0
function pathRampGrade(b, i, bl) {
  const dir = DIRS[((bl.facing != null ? bl.facing : bl.rot) | 0) & 3];
  const x = i % MAP_W, y = (i - x) / MAP_W;
  const nx = x + dir[0], ny = y + dir[1];
  if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) return 0;
  const d = b.map.height[ny * MAP_W + nx] - b.map.height[i];
  return d > 0 ? 1 : (d < 0 ? -1 : 0);
}

// 通行表(每 profile 一份):cost[i] 為踏入格 i 的代價;edge[i] 的 bit k 表示 i 可走到 i+NB_OFF[k]
// 斜向邊另需:i、j 與兩個正交鄰格都不擋斜角(不切牆角);牆格只能被正交進入
// slope[i](Int8Array,僅 ramp 格非 0):+1 = 此格朝 DIRS[facing] 往上、−1 = 往下、0 = 平或非斜坡
// 行進方向由 b.map.height 判定(低格踏入斜坡為上坡、由高格踏入為下坡)
function buildPass(b, profile) {
  const pr = pathParseProfile(profile);
  const row = MOVE_COST[pr.base];
  const N = MAP_W * MAP_H;
  const cost = new Uint16Array(N), edge = new Uint8Array(N), link = new Uint8Array(N), barrier = new Uint8Array(N);
  const slope = new Int8Array(N);
  const hgt = b.map.height;
  for (let i = 0; i < N; i++) {
    cost[i] = pathCellCost(b, i, row, pr, profile);
    const bl = pathBldAt(b, i);
    if (bl && (bl.type === 'stairs' || bl.type === 'ramp')) link[i] = 1;
    if (bl && bl.type === 'ramp') slope[i] = pathRampGrade(b, i, bl);
    barrier[i] = pathIsBarrier(b, i) ? 1 : 0;
  }
  for (let i = 0; i < N; i++) {
    if (cost[i] === PATH_UNREACH) continue;
    const x = i % MAP_W, y = (i - x) / MAP_W;
    for (let k = 0; k < 8; k++) {
      const nx = x + NB_DX[k], ny = y + NB_DY[k];
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const j = ny * MAP_W + nx;
      if (cost[j] === PATH_UNREACH) continue;
      if (hgt[i] !== hgt[j] && !link[i] && !link[j]) continue;
      if ((k & 1) && (barrier[i] || barrier[j] || barrier[y * MAP_W + nx] || barrier[ny * MAP_W + x])) continue;
      edge[i] |= 1 << k;
    }
  }
  return { cost: cost, edge: edge, slope: slope };
}

function getPass(b, profile) {
  if (!b.pass) b.pass = {};
  if (!b.pass[profile]) b.pass[profile] = buildPass(b, profile);
  return b.pass[profile];
}

function pathEachFootprint(bl, fn) {
  for (let yy = bl.y; yy < bl.y + bl.h; yy++)
    for (let xx = bl.x; xx < bl.x + bl.w; xx++)
      if (xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H) fn(yy * MAP_W + xx);
}

// 目標類別是否命中建築(可攻擊且存活、非隱藏)
function pathBldIsGoal(bl, cat) {
  if (!bl.alive || bl.hidden) return false;
  const cb = OBJECTS[bl.type].cb;
  if (!cb.cat || !(cb.hp > 0)) return false;
  if (cat === 'any') return cb.cat !== 'wall' && cb.cat !== 'trap';
  return cb.cat === cat;
}

// 目標格:命中建築佔格的 8 鄰、可通行且不屬於目標建築本身;rally / cell 直接取該格
function goalCells(b, goal, profile) {
  const N = MAP_W * MAP_H;
  const g = String(goal), out = [];
  if (g.indexOf('rally:') === 0) {
    const id = g.slice(6);
    const list = (b.marks && b.marks.rally) || [];
    for (let k = 0; k < list.length; k++) {
      if (list[k].id === id) { out.push(list[k].y * MAP_W + list[k].x); break; }
    }
    return out;
  }
  if (g.indexOf('cell:') === 0) {
    const xy = g.slice(5).split(',');
    const c = +xy[1] * MAP_W + +xy[0];
    if (!profile || getPass(b, profile).cost[c] !== PATH_UNREACH) out.push(c);
    return out;
  }
  const blds = [];
  if (g.indexOf('cat:') === 0) {
    const cat = g.slice(4);
    b.bld.forEach(function (bl, n) { if (pathBldIsGoal(bl, cat)) blds.push(n); });
  } else if (g.indexOf('bld:') === 0 || g.indexOf('flag:') === 0) {
    const n = parseInt(g.slice(g.indexOf(':') + 1), 10);
    if (b.bld[n]) blds.push(n);
  }
  const P = profile ? getPass(b, profile) : null;
  const inGoal = new Uint8Array(N), seen = new Uint8Array(N);
  blds.forEach(function (n) { pathEachFootprint(b.bld[n], function (c) { inGoal[c] = 1; }); });
  blds.forEach(function (n) {
    pathEachFootprint(b.bld[n], function (c) {
      const x = c % MAP_W, y = (c - x) / MAP_W;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
          const d = ny * MAP_W + nx;
          if (inGoal[d] || seen[d]) continue;
          if (P ? P.cost[d] === PATH_UNREACH : b.map.block[d] === 1) continue;
          seen[d] = 1;
          out.push(d);
        }
    });
  });
  return out;
}

// 多源 Dijkstra:dist[i] = 從 i 走到目標的代價(含 i 自身代價,不含目標格)
function buildField(b, profile, goal) {
  const P = getPass(b, profile);
  const N = MAP_W * MAP_H;
  const dist = new Uint32Array(N).fill(PATH_INF);
  const heap = new MinHeap();
  const goals = goalCells(b, goal, profile);
  for (let k = 0; k < goals.length; k++) {
    const g = goals[k];
    if (dist[g] !== 0) { dist[g] = 0; heap.push(g); }
  }
  while (heap.size > 0) {
    const cur = heap.pop();
    const i = cur % PATH_KEY_SHIFT, d = (cur - i) / PATH_KEY_SHIFT;
    if (d > dist[i]) continue;
    const e = P.edge[i];
    if (!e) continue;
    for (let k = 0; k < 8; k++) {
      if (!(e & (1 << k))) continue;
      const j = i + NB_OFF[k], c = P.cost[j];
      if (c === PATH_UNREACH) continue;
      const nd = d + ((k & 1) ? Math.floor(c * 14 / 10) : c);
      if (nd < dist[j]) { dist[j] = nd; heap.push(nd * PATH_KEY_SHIFT + j); }
    }
  }
  return dist;
}

// 8 鄰中 dist 最小且嚴格小於 dist[i] 者;平手依 NB_OFF 順序取第一個;無則回 -1
function fieldDir(dist, i, P) {
  const cur = dist[i];
  if (cur === 0 || cur === PATH_INF) return -1;
  const e = P.edge[i];
  let best = -1, bd = cur;
  for (let k = 0; k < 8; k++) {
    if (!(e & (1 << k))) continue;
    const j = i + NB_OFF[k];
    if (P.cost[j] === PATH_UNREACH) continue;
    if (dist[j] < bd) { bd = dist[j]; best = j; }
  }
  return best;
}

// 取快取流場;沒有則排入 b.fieldQueue 並回 null(由 processFieldQueue 每 tick 分批建)
function requestField(b, profile, goal) {
  const key = profile + '|' + goal;
  if (!b.fields) b.fields = new Map();
  if (!b.fieldQueue) { b.fieldQueue = []; b.fieldPending = new Set(); }
  const hit = b.fields.get(key);
  if (hit) return hit;
  if (!b.fieldPending.has(key)) {
    b.fieldPending.add(key);
    b.fieldQueue.push({ key: key, profile: profile, goal: goal });
  }
  return null;
}

// 每次最多建 max 張;回傳實際建置數
function processFieldQueue(b, max) {
  if (!b.fieldQueue) return 0;
  let n = 0;
  while (n < max && b.fieldQueue.length > 0) {
    const q = b.fieldQueue.shift();
    b.fieldPending.delete(q.key);
    const dist = buildField(b, q.profile, q.goal);
    b.fields.set(q.key, { key: q.key, profile: q.profile, goal: q.goal, dist: dist });
    n++;
  }
  return n;
}

// 語意:只設 b.passDirty 旗標,不會立即重建或清快取。
// td.js 在 tick 第 5 步看到旗標時,必須清空 b.pass 與 b.fields(並清除旗標),之後 getPass / requestField 才會用新地形重建。
// 在 td.js 完成清空之前,getPass 仍會回傳舊 pass。
function markPassDirty(b) {
  b.passDirty = true;
}
