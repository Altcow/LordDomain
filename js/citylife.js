// citylife.js — 居民人流(PLAN_CITYLIFE.md C0 + 密度/效能/熱鬧行為擴充)
// 道路圖 BFS、入出城、走進門格、閒聊、點擊小卡、密度設定與自適應降載。只在 estate / visit 更新與繪製;
// 不讀寫 world 的數據欄位、不寫主存檔(只可存 LIFE_KEY 的 {on, density})。

const LIFE_KEY = 'lorddomain.life.v1';
const LIFE_SPR_BUDGET = 18 * 1024 * 1024; // 居民 sprite 快取預算(bytes),超過以 LRU 淘汰居民 sprite(PLAN_CITYLIFE_GATHER Q15:12 → 18 MB)
const LIFE_LRU = 64;          // 距離場快取張數
const LIFE_RES_MAX = 2;       // 居民 sprite 解析度上限(控制快取大小)
const LIFE_GRID = 0.8;        // 閒聊粗格桶邊長(格);配對半徑 0.8 格,3×3 桶即可涵蓋
const LIFE_OFF_GAP = 0.75;    // 畫面外居民的粗更新間隔(秒)
const LIFE_MAX_LIFE = 360;    // 單一居民壽命上限(秒),到時直接走向入口離場
const LIFE_DOT_MAX = 80;      // 縮放 < 0.35 時最多畫的色點數
const LIFE_IDLE_SPOTS = 12;   // 閒逛停點數(道路圖抽樣,避免每次隨機產生新距離場)
const LIFE_AWAY_MS = 5 * 60 * 1000; // 離開(背景 / 非經營模式 / 隱藏建築)超過此時間才清空重擺;未滿則原樣繼續
const LIFE_PREFILL = 0.85;    // 預布點比例:開機 / 久別重逢時第一幀就擺好目標人數的 85%
const LIFE_RETIRE_SEC = 25;   // 減人時畫面內的人走向最近門口 / 城門的最長秒數
const LIFE_RETIRE_CELLS = 14; // 最近出口超過此格數就原地淡出
const LIFE_RETIRE_SPREAD = 12; // 目標下降時,畫面內的人錯開 0~12 秒陸續離場
const LIFE_BAKE_MAX = 6;      // 每幀最多新烘焙幾個居民 sprite;超過的人先畫占位小人
const LIFE_FLOOR_TOD = { dawn: 0.8, noon: 1, dusk: 1, night: 0.6 };   // 人口下限的時段倍率

const LIFE = {
  inited: false, cfgOk: false, on: true, density: 'mid', active: false, placing: false,
  npcs: [], nid: 0, gid: 0, live: 0, target: 0, adj: 1, level: 0, healthy: 0, adaptT: 0, tgtT: 0,
  seedLeft: 0, seedFail: 0, road: null, buck: null, seeded: false, reseed: false,
  lastT: null, clock: 0, sigT: 0, spawnT: 0.5, chatT: 0, sprT: 0, statT: 0, tod: 'noon',
  bfsBudget: 1, dots: 0, pairCmp: 0, chatHead: null, chatNext: null, tradeAt: new Map(),
  portT: 0, portTarget: 0, xT: 0, xSeed: 6, xCd: {}, xTarget: null, dockRes: new Map(), spotRes: new Set(), lowEnd: undefined, drawAcc: 0, wallT: -1, fps: 0, perfLog: false, sprBytes: 0, specs: {}, variantIds: {},
  perf: { ms: 0 }, card: null, cardFor: null, psFlip: false, psAcc: 0,
  // P1 不空城:人口下限、降載階梯旗標、離開計時、夜間保底
  floor: 0, runMs: 0, paused: false, expFps: 0, bakes: 0, bubN: 0, nightT: 0, offGap: LIFE_OFF_GAP, bubMax: 99, chatGap: 0.5, resMax: LIFE_RES_MAX, frrMul: 1, freeze: false, dotSkip: null
};

// 省電模式(perf.js isPowerSave)時密度降一級,只在運算時換算,不改使用者存的 LIFE.density
const LIFE_PS_STEP = { off: 'off', low: 'low', mid: 'low', high: 'mid', crowd: 'high' };
function lifeEffDensity() {
  return (typeof isPowerSave === 'function' && isPowerSave()) ? (LIFE_PS_STEP[LIFE.density] || LIFE.density) : LIFE.density;
}

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
  // 回到前景不再整城清空:lifeFrame 用「上次執行距今」判斷(< LIFE_AWAY_MS 原樣繼續,否則清空並預布點)
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
  LIFE.healthy = 0; lifeSetLevel(0);
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
  const cx = Math.min(boardW() - 1, Math.max(0, Math.floor(x)));
  const cy = Math.min(boardH() - 1, Math.max(0, Math.floor(y)));
  return world.height[idx(cx, cy)];
}

function lifeRoadSig() {
  let h = (0x811c9dc5 ^ world.objects.length ^ (boardW() << 20)) >>> 0;   // 含板子邊長:換板即重建
  const N = boardW() * boardH();
  for (let i = 0; i < N; i++) {
    const n = world.occ[i];
    const o = n ? world.objects[n - 1] : null;
    let t = world.terrain[i] | (world.height[i] << 3);
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
// 風格住宅視同對應住宅(HOUSE_LIKE,nl_style_objects.js);未載入時原樣
function lifeHouseKind(t) { return typeof houseKindOf === 'function' ? houseKindOf(t) : t; }
function lifeFindDoor(o, ok) {
  const fp = footprint(o.type, o.rot), w = fp[0], h = fp[1];
  const hb = world.height[idx(o.x, o.y)];
  const faces = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let order = [0, 1, 2, 3];
  let pref = -1;
  if (lifeHouseKind(o.type) === 'house') pref = ((o.rot & 3) + 1) & 3;
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

// 地面鋪面物件(OBJECTS[type].walk === true,如 plaza_stone / plaza_earth):路人可踩過,視為可走格
function lifeWalkObj(t) {
  return typeof OBJECTS !== 'undefined' && !!OBJECTS[t] && OBJECTS[t].walk === true;
}

// 可穿越的門類 3×1(中格可走,兩側為柱/牆不可走);通行軸由 rot 決定(0/2 南北、1/3 東西)
const LIFE_PASS_TYPES = { gate: 1, paifang: 1, toll_gate: 1, gate_courtyard: 1 };

// 多源距離場:來源 = 所有目的地門格 + 所有入口;exitAt[cell] = 最近來源編號(exitSrc[i] = {cell, door | ent})。
// 減人時畫面內的人沿它下坡走到最近的門口(走進門淡出)或入口(走出城淡出)。改路時才重算一次
function lifeExitBuild(R, N) {
  const D = new Int16Array(N).fill(-1), A = new Int16Array(N).fill(-1), src = [], q = R.q;
  let head = 0, tail = 0, i, s;
  for (i = 0; i < R.dests.length; i++) src.push({ cell: R.dests[i].cell, door: R.dests[i], ent: null });
  for (i = 0; i < R.ent.length; i++) src.push({ cell: R.ent[i].cell, door: null, ent: R.ent[i] });
  for (i = 0; i < src.length && i < 32000; i++) {
    s = src[i].cell;
    if (D[s] >= 0 || !R.ok[s]) continue;
    D[s] = 0; A[s] = i; q[tail++] = s;
  }
  while (head < tail) {
    const c = q[head++];
    for (let d = 0; d < 4; d++) {
      const j = R.nb[c * 4 + d];
      if (j >= 0 && D[j] < 0) { D[j] = D[c] + 1; A[j] = A[c]; q[tail++] = j; }
    }
  }
  R.exitD = D; R.exitAt = A; R.exitSrc = src;
}

// 道路圖:可走格 + 4 鄰接(同高;高差 1 且任一格有階梯/斜坡才相連)+ 入口 + 門格 + 閒逛停點 + 固定巡邏路線
function lifeRebuild() {
  const N = boardW() * boardH();
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
    if (isPavedTerrain(world.terrain[i]) && (!obj || tp === 'stairs' || tp === 'ramp')) ok[i] = 1;   // 道路 + 人工地面(石板 / 夯土 / 水泥 / 鋼鐵 / 木棧板 / 木紋地板)
    else if (obj && !isWaterTerrain(world.terrain[i]) && lifeWalkObj(tp)) ok[i] = 1; // 鋪面(walk:true,如廣場石板)可踩
  }
  for (i = 0; i < N; i++) {
    if (!ok[i]) continue;
    const x = i % boardW(), y = (i - x) / boardW();
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= boardW() || ny >= boardH()) continue;
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
    const x = i % boardW(), y = (i - x) / boardW();
    if (x === 0) ent.push({ cell: i, ox: -1, oy: 0 });
    else if (x === boardW() - 1) ent.push({ cell: i, ox: 1, oy: 0 });
    else if (y === 0) ent.push({ cell: i, ox: 0, oy: -1 });
    else if (y === boardH() - 1) ent.push({ cell: i, ox: 0, oy: 1 });
  }
  if (!ent.length) for (i = 0; i < N; i++) if (gt[i] && ok[i]) ent.push({ cell: i, ox: 0, oy: 0 });
  if (!ent.length) {
    let rx = boardW() / 2, ry = boardH() / 2;
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
      const da = Math.hypot(a % boardW() - rx, Math.floor(a / boardW()) - ry);
      const db = Math.hypot(b % boardW() - rx, Math.floor(b / boardW()) - ry);
      return db - da;
    });
    for (k = 0; k < ends.length && k < 3; k++) ent.push({ cell: ends[k], ox: 0, oy: 0 });
  }
  const dests = [], bcount = {}, pdoors = [], pcells = {};
  let fHouses = 0;
  for (k = 0; k < world.objects.length; k++) {
    o = world.objects[k];
    if (LIFE_PORT_TYPES[o.type]) {
      const pdr = lifeFindDoor(o, ok);
      if (pdr) { pdoors.push({ type: o.type, cell: pdr.cell, bx: pdr.bx, by: pdr.by }); pcells[pdr.cell] = 1; }
    }
    const dk = lifeHouseKind(o.type);
    if (dk === 'house') fHouses++;
    else if (typeof OBJECTS !== 'undefined' && OBJECTS[o.type] && (OBJECTS[o.type].crowd === 'poor' || OBJECTS[o.type].crowd === 'common' || OBJECTS[o.type].crowd === 'rich')) fHouses += 0.5;
    if (LIFE_DEST_TYPES.indexOf(dk) < 0) continue;
    const d = lifeFindDoor(o, ok);
    if (!d) continue;
    dests.push({ type: dk, cell: d.cell, bx: d.bx, by: d.by });
    bcount[dk] = (bcount[dk] || 0) + 1;
  }
  LIFE.road = { ok: ok, nb: nb, list: list, ent: ent, dests: dests, bcount: bcount, port: pdoors, portCells: pcells, dc: new Map(), q: new Int32Array(N), sig: lifeRoadSig(), spots: [], patrol: null, exitD: null, exitAt: null, exitSrc: null, fBase: 0 };
  const R = LIFE.road;
  // 人口下限基礎:6 + 1.2 × 屋 + 2 × 市集 + (有城主府 ? 2 : 0)(聚集點 P2 起再加)
  R.fBase = 6 + 1.2 * fHouses + 2 * (bcount.market || 0) + (bcount.palace ? 2 : 0);
  lifeExitBuild(R, N);
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
  if (!LIFE.buck) LIFE.buck = [];
  for (k = LIFE.buck.length; k < boardW() + boardH(); k++) LIFE.buck.push([]);   // 換板(56 ↔ 經營大板)時補足對角線桶
  if (typeof lifeTrafficBuild === 'function') lifeTrafficBuild(ok);
  if (typeof gatherBuild === 'function') gatherBuild(ok);   // 聚集點建置(citygather.js)
  // 站在被拆掉道路上(或下一步要踏上去)的人直接淡出
  LIFE.npcs.forEach(n => {
    if (n.st === 'fade' || n.st === 'enter' || n.st === 'exit') return;
    if (n.stat) { if (typeof lifeTrafficStatOk === 'function' && !lifeTrafficStatOk(n)) lifeFadeOut(n); return; }
    const fx = Math.floor(n.x), fy = Math.floor(n.y);
    const onGround = fx >= 0 && fy >= 0 && fx < boardW() && fy < boardH() && !ok[idx(fx, fy)];
    if (onGround || (n.cur >= 0 && !ok[n.cur]) || (n.nx >= 0 && !ok[n.nx])) lifeFadeOut(n);
    else if (n.port && (!pcells[n.pa] || !(pcells[n.pb] || ok[n.pb]))) lifeFadeOut(n);
  });
}

// 目標導向 BFS 距離場(LRU 64,地圖變動時整個丟棄;命中時移到最新)
function lifeDist(g) {
  const R = LIFE.road;
  let D = R.dc.get(g);
  if (D) { R.dc.delete(g); R.dc.set(g, D); return D; }
  if (R.dc.size >= LIFE_LRU) R.dc.delete(R.dc.keys().next().value);
  D = new Int16Array(boardW() * boardH()).fill(-1);
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
  if (n.ret > 0) {   // 走向最近出口:沿多源距離場下坡(不用逐目標距離場,沒有每幀預算問題)
    const E = LIFE.road.exitD, e0 = E[n.cur];
    if (e0 <= 0) return -1;
    const cs = [];
    for (let k = 0; k < 4; k++) {
      const j = LIFE.road.nb[n.cur * 4 + k];
      if (j >= 0 && E[j] === e0 - 1) cs.push(j);
    }
    return cs.length ? cs[Math.floor(Math.random() * cs.length)] : -1;
  }
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
  const plan = [], R = LIFE.road;
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
  if (!fin && !R.ent.length) fin = lifePickDoor(R.bcount, prev) || lifePickDoor(T.to, prev);   // 沒有入口 / 城門的小城:一律回屋(否則補不到人,人數越走越少)
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
    if (night && T.night !== 'only' && k !== 'soldier') w *= 0.25;   // 夜間保底:晚歸者不再幾乎歸零(提燈,見 lifeNew)
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
function lifeSpecFor(look, alt) {
  if (typeof ART === 'undefined' || !ART.UNIT || !ART.UNIT[look]) return null;
  const base = ART.UNIT[look];
  LIFE.variantIds[look] = true;
  if (!base.civil || !(alt === undefined ? Math.random() >= 0.5 : alt)) return base;
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

// 提燈外觀:同一外觀加 night:'lantern'(art.js 夜間才畫燈籠與光暈),變體 id 加 _ln
function lifeLantern(spec) {
  if (!spec || spec.night === 'lantern') return spec;
  const vid = spec.id + '_ln';
  let s = LIFE.specs[vid];
  if (!s) { s = Object.assign({}, spec, { id: vid, night: 'lantern' }); LIFE.specs[vid] = s; }
  LIFE.variantIds[vid] = true;
  return s;
}

function lifeNew(key, T, start, plan) {
  const look = T.looks[Math.floor(Math.random() * T.looks.length)];
  let spec = (typeof fantasyResidentSpec === 'function' && fantasyResidentSpec(key, look)) || lifeSpecFor(look);   // 魔幻世界居民外觀(非魔幻回 null)
  if (LIFE.tod === 'night' && spec && T.night !== 'only' && key !== 'soldier' && T.w > 0 && Math.random() < 0.6) spec = lifeLantern(spec);   // 夜間 60% 晚歸者提燈
  return {
    id: ++LIFE.nid, type: key, name: LIFE_NAMES[Math.floor(Math.random() * LIFE_NAMES.length)],
    look: look, spec: spec, col: LIFE_PH_COL[key] || (typeof LIFE_XPH_COL !== 'undefined' && LIFE_XPH_COL[key]) || '#888888',
    st: 'walk', t: 0, dur: 0, act: '', life: 0, alpha: 0, acc: 0, cd: 0, dead: false, onS: false,
    port: false, pa: -1, pb: -1, specL: null, specE: null,
    ext: false, role: '', stat: false, keep: false, dock: -1, pc: -1, host: null, hand: null, squad: 0, bub: '', bubP: 6, frr: 4, fid: false, bx: 0, by: 0, hh: 0,
    x: 0, y: 0, px: 0, py: 0, cur: start, nx: -1, tx: 0, ty: 0, goal: plan[0].cell, plan: plan, pi: 0,
    lane: 0.12, spd: T.spd, ph: Math.random() * 2, wait: 0, det: 0, loop: false, hold: 0,
    fx: 0, fy: 0, ex: 0, ey: 0, ddx: 0, ddy: 0, ox: 0, oy: 0, pair: null, gi: -1, ret: 0, retAt: 0, retPend: false, retCut: false, lazy: null, lazyTry: 0, drink: -1, retN: 0,
    pp: { spec: null, x: 0, y: 0, f: 0, fr: 0, alpha: 1 }
  };
}

// 放置一組居民(count 人共用路線與步速;結伴/縱隊/巡邏靠 det 走同一條路)
// entry:入口 {cell,ox,oy}、門 {cell,bx,by} 或 null(mid = true 時擺在路上)
function lifeEmit(T, key, count, start, plan, entry, mid, o) {
  const lane = 0.12 + Math.random() * 0.13;
  const sf = (0.85 + Math.random() * 0.3) * (o.spdMul || 1);
  const sx = (start % boardW()) + 0.5, sy = Math.floor(start / boardW()) + 0.5;
  let made = 0;
  for (let i = 0; i < count; i++) {
    const n = lifeNew(key, T, start, plan);
    n.det = o.det || 0; n.lane = o.lane === undefined ? lane : o.lane; n.spd = T.spd * sf; n.loop = !!o.loop; n.hold = (o.stagger || 0) * i;
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
  } else if (R.dests.length && (Math.random() < 0.2 || !R.ent.length)) {
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

// 人口下限(PLAN_CITYLIFE_GATHER §3.2):依住宅 / 市集 / 城主府算基礎,乘時段倍率,夾在「下限最小 ~ 密度基礎 × 0.5」;
// 密度『少』最多 12;省電 / 低階機 ×0.75(仍 ≥ 下限最小);密度關 = 0。降載只能先砍細節,不得砍到下限以下
function lifeFloor() {
  const R = LIFE.road, user = LIFE_DENSITY[LIFE.density] || 0;
  if (!LIFE.on || !user || !R) return 0;
  const night = LIFE.tod === 'night';
  const mn = night ? 6 : 8;
  let f = Math.round(R.fBase * (LIFE_FLOOR_TOD[LIFE.tod] || 1));
  const mx = LIFE.density === 'low' ? 12 : Math.round(user * 0.5);
  f = Math.max(mn, Math.min(f, mx));
  if ((typeof isPowerSave === 'function' && isPowerSave()) || (typeof lifeLowEnd === 'function' && lifeLowEnd())) f = Math.max(mn, Math.round(f * 0.75));
  return Math.min(f, Math.floor(R.list.length / 1.5), 12 + 10 * R.dests.length);   // 路太少站不下就是站不下
}

// 目標人數 = max(下限, 密度基礎 × 時段 × 季節 × 降載係數),再受道路格數(÷1.5)與目的地數量上限約束,不超過使用者設定的密度基礎
function lifeTarget() {
  const base = LIFE_DENSITY[lifeEffDensity()] || 0, user = LIFE_DENSITY[LIFE.density] || 0;
  const R = LIFE.road;
  if (!LIFE.on || !user || !R) return 0;
  const seasonMul = lifeSeason() === 'winter' ? LIFE_WINTER_MUL : 1;
  const cap = Math.min(Math.floor(R.list.length / 1.5), 12 + 10 * R.dests.length);
  const raw = Math.min(base * (LIFE_TOD_MUL[LIFE.tod] || 1) * seasonMul, cap);
  const fl = lifeFloor();
  LIFE.floor = fl;
  if (raw <= 0 && fl <= 0) return 0;
  return Math.min(user, cap, Math.max(fl, Math.round(raw * LIFE.adj)));
}

// 重算目標;增加時補生成;減少時讓多出的人走開(畫面外優先直接淡出,畫面內錯開走到最近門口 / 城門)
function lifeRetarget() {
  const t = lifeTarget();
  const want = Math.floor(t * 0.6) - LIFE.live;
  if (t > LIFE.target && want > LIFE.seedLeft) LIFE.seedLeft = want;
  LIFE.target = t;
  const over = LIFE.live - t;
  if (over > 0) lifeRetire(over);
}

function lifeRetiring(n) { return n.ret > 0 || n.retAt > 0 || n.retPend; }

// 減人:第 1 輪先挑畫面外的(看不到,直接淡出),第 2 輪才挑畫面內的(排 0~12 秒後走向最近出口)。
// hero / 在野名人 / 街景角色(ext)、苦力、縱隊後段不被挑中
function lifeRetire(k) {
  const L = LIFE.npcs;
  for (let pass = 0; pass < 2 && k > 0; pass++) {
    for (let i = 0; i < L.length && k > 0; i++) {
      const n = L[i];
      if (n.dead || (n.st !== 'walk' && n.st !== 'act' && n.st !== 'chat')) continue;
      if (n.hold > 0 || n.port || n.ext || lifeRetiring(n)) continue;
      if (n.gat > 0 && pass === 0) continue;   // 聚集成員最後才挑(citygather.js)
      if (pass === 0) {
        if (n.onS) continue;
        lifeFadeOut(n);
      } else {
        n.retAt = LIFE.clock + 0.2 + Math.random() * LIFE_RETIRE_SPREAD;
      }
      k--;
    }
  }
}

// 把 n 的行程換成「走向 cur 所在位置的最近出口」;走不到回傳 false(呼叫端原地淡出)。最多走 LIFE_RETIRE_CELLS 格 / LIFE_RETIRE_SEC 秒,還沒到就在當下位置淡出
function lifeRetSet(n) {
  const R = LIFE.road;
  if (!R || !R.exitD || n.cur < 0) return false;
  if (R.exitD[n.cur] < 0) return false;   // 孤島:走不到任何出口
  const a = R.exitAt[n.cur];
  if (a < 0 || !R.exitSrc[a]) return false;
  const sc = R.exitSrc[a];
  n.plan = [sc.door ? { cell: sc.cell, end: 'enter', door: sc.door } : { cell: sc.cell, end: 'exit', ent: sc.ent }];
  n.pi = 0; n.goal = sc.cell; n.loop = false;
  return true;
}

function lifeRetireStart(n) {
  if (n.ext && typeof lifeTrafficLeave === 'function') lifeTrafficLeave(n);
  if (!lifeRetSet(n)) return false;
  n.ret = LIFE_RETIRE_SEC; n.retN = LIFE_RETIRE_CELLS; n.retAt = 0; n.retPend = false;
  n.st = 'walk'; n.wait = 0;
  return true;
}

// 港口苦力目標數:有門格的港口設施數 × per(進位),受 max 與密度(low 12→2、mid 60→12)約束,再乘時段與季節倍率;沒有就 0
function lifePortTarget() {
  const R = LIFE.road, base = LIFE_DENSITY[lifeEffDensity()] || 0;
  if (!LIFE.on || !base || !R || !R.port.length) return 0;
  const cap = Math.min(LIFE_PORT.max, Math.max(2, Math.round(base / 5)));
  const raw = Math.min(cap, Math.ceil(R.port.length * LIFE_PORT.per));
  const mul = (LIFE_TOD_MUL[LIFE.tod] || 1) * (lifeSeason() === 'winter' ? LIFE_WINTER_MUL : 1);
  return Math.min(cap, Math.max(1, Math.round(raw * mul)));
}

// 在一座港口設施的門格生成一名苦力:門格 A(扛貨)↔ 另一座設施門格或閒逛停點 B(卸貨),來回搬運不離場
function lifePortSpawn() {
  const R = LIFE.road, P = R.port;
  const a = P[Math.floor(Math.random() * P.length)];
  const D = lifeField(a.cell);
  if (!D) return false;
  let b = -1;
  for (let t = 0; t < 6 && b < 0; t++) {
    const c = P[Math.floor(Math.random() * P.length)];
    if (c.cell !== a.cell && D[c.cell] >= 0) b = c.cell;
  }
  if (b < 0) b = lifePickCell(a.cell);
  if (b < 0) return false;
  const T = LIFE_TYPES.coolie;
  const plan = [
    { cell: b, act: 'carry', dur: 1.5 + Math.random() * 2, load: false },
    { cell: a.cell, act: 'carry', dur: 1.5 + Math.random() * 2, load: true }
  ];
  if (!lifeEmit(T, 'coolie', 1, a.cell, plan, a, false, { det: 0, loop: true })) return false;
  const n = LIFE.npcs[LIFE.npcs.length - 1];
  n.port = true; n.pa = a.cell; n.pb = b;
  n.specL = n.spec;
  const el = LIFE_PORT.empty[n.look];
  n.specE = el ? lifeSpecFor(el, !!n.spec && n.spec.id === n.look + '_a') : n.spec;
  return true;
}

// 每 0.5 秒:苦力不足就補(一次最多 3 名),過多則淡出多出的(畫面外優先)
function lifePortTick(dt) {
  LIFE.portT -= dt;
  if (LIFE.portT > 0) return;
  LIFE.portT = 0.5;
  const tgt = LIFE.road ? lifePortTarget() : 0;
  LIFE.portTarget = tgt;
  const L = LIFE.npcs;
  let cnt = 0, i;
  for (i = 0; i < L.length; i++) if (L[i].port && !L[i].dead && L[i].st !== 'fade') cnt++;
  if (cnt > tgt) {
    for (let pass = 0; pass < 2 && cnt > tgt; pass++) {
      for (i = 0; i < L.length && cnt > tgt; i++) {
        const n = L[i];
        if (!n.port || n.dead || n.st === 'fade' || (pass === 0 && n.onS)) continue;
        lifeFadeOut(n);
        cnt--;
      }
    }
  } else {
    for (let k = 0; k < 3 && cnt < tgt; k++) {
      if (!lifePortSpawn()) break;
      cnt++;
    }
  }
}

// 夜間保底(PLAN_CITYLIFE_GATHER §3.5,最小可行版):每 2 秒檢查。
//  更夫 `watch`:提燈沿兩個停點來回慢走(1~2 名,有城主府或軍事建築 2 名);天亮後陸續回家。
//  酒館小聚:酒館 / 酒肆 / 客棧門口 2~4 人站著喝兩杯(頭上 happy 泡泡),夜間全額、黃昏 1 人;站夠時間再回家。
//  夜市(吃食 / 酒水攤開張)在 citytraffic.js 的叫賣者 / 圍觀者目標;晚歸者提燈在 lifeNew。皆算居民額度(下限內)
const LIFE_TAVERN_TYPES = { tavern: 1, shop_wine: 1, inn: 1 };
function lifeNightTick(dt) {
  LIFE.nightT -= dt;
  if (LIFE.nightT > 0) return;
  LIFE.nightT = 2;
  const R = LIFE.road;
  if (!R || LIFE.target <= 0 || !LIFE_TYPES.watch) return;
  const night = LIFE.tod === 'night', dusk = LIFE.tod === 'dusk', L = LIFE.npcs;
  let watch = 0, i;
  const at = {};
  for (i = 0; i < L.length; i++) {
    const n = L[i];
    if (n.dead || n.st === 'fade') continue;
    if (n.type === 'watch') {
      watch++;
      if (!night && !lifeRetiring(n)) n.retAt = LIFE.clock + 0.5 + Math.random() * 10;   // 天亮了,更夫回家
    } else if (n.drink >= 0 && n.st === 'act') at[n.drink] = (at[n.drink] || 0) + 1;
  }
  const room = LIFE.target - LIFE.live;
  if (room <= 0 || !(night || dusk)) return;
  const user = LIFE_DENSITY[LIFE.density] || 0;
  if (night && R.spots.length >= 2) {
    const want = Math.min(user <= 12 ? 1 : 2, ((R.bcount.palace || (R.x && R.x.mil >= 1)) ? 2 : 1), Math.max(1, Math.ceil(LIFE.target / 12)));
    if (watch < want) {
      const a = R.spots[Math.floor(Math.random() * R.spots.length)], D = lifeField(a);
      let b = -1;
      if (D) for (let t = 0; t < 6 && b < 0; t++) { const c = R.spots[Math.floor(Math.random() * R.spots.length)]; if (c !== a && D[c] >= 3) b = c; }
      if (b >= 0) {
        const plan = [{ cell: b, act: 'stand', dur: 3 + Math.random() * 3 }, { cell: a, act: 'stand', dur: 3 + Math.random() * 3 }];
        if (lifeEmit(LIFE_TYPES.watch, 'watch', 1, a, plan, null, true, { loop: true, lane: 0.1 })) {
          const n = L[L.length - 1];
          n.keep = true; n.life = 0; n.alpha = 0; n.bub = 'talk'; n.bubP = 11;
          if (n.spec) n.spec = lifeLantern(n.spec);
          return;
        }
      }
    }
  }
  // 酒館小聚
  let cap = Math.max(2, Math.round(LIFE.target * 0.25));
  const tavs = [];
  for (i = 0; i < R.dests.length; i++) if (LIFE_TAVERN_TYPES[R.dests[i].type]) tavs.push(R.dests[i]);
  if (!tavs.length) return;
  let total = 0;
  for (const k in at) total += at[k];
  if (total >= cap) return;
  const d = tavs[Math.floor(Math.random() * tavs.length)];
  const wantHere = dusk ? 1 : 2 + (d.cell % 3);
  if ((at[d.cell] || 0) >= wantHere) return;
  const keys = ['civ', 'farmer', 'smith', 'scholar', 'drunk'].filter(function (k) { return LIFE_TYPES[k] && !(LIFE_TYPES[k].needs && !LIFE_TYPES[k].needs.some(function (b) { return R.bcount[b] > 0; })); });
  if (!keys.length) return;
  const key = keys[Math.floor(Math.random() * keys.length)], T = LIFE_TYPES[key];
  const plan = [{ cell: d.cell, act: 'stand', dur: 35 + Math.random() * 50 }];
  if (!lifeEmit(T, key, 1, d.cell, plan, null, true, { lane: 0.12 })) return;
  const n = L[L.length - 1];
  n.lazy = T; n.drink = d.cell; n.st = 'act'; n.act = 'stand'; n.dur = plan[0].dur; n.t = 0; n.fid = true;
  n.bub = 'happy'; n.bubP = 7 + Math.random() * 3; n.life = 0; n.alpha = 0;
  n.x += (Math.random() - 0.5) * 0.5; n.y += (Math.random() - 0.5) * 0.5;
  if (n.spec && night) n.spec = lifeLantern(n.spec);
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
    LIFE.spawnT = deficit > 0 ? (LIFE.live < LIFE.floor ? 0.1 : deficit > 8 ? 0.2 : 0.5) + Math.random() * 0.35 : 1 + Math.random() * 2;
    if (deficit > 0) {
      let ok = lifeSpawn(false);
      for (let t = 0; !ok && t < 2 && LIFE.live < LIFE.floor; t++) ok = lifeSpawn(false);   // 低於人口下限時多試幾次
      if (!ok) LIFE.spawnT = 0.3;
    }
  }
}

function lifeReset() {
  LIFE.npcs.length = 0;
  LIFE.live = 0;
  LIFE.seeded = false;
  LIFE.seedLeft = 0;
  LIFE.spawnT = 0.5;
  LIFE.portT = 0;
  LIFE.chatT = 0;
  LIFE.nightT = 0;
  LIFE.runMs = 0;
  LIFE.healthy = 0; LIFE.adaptT = 0; LIFE.fps = 0;
  lifeSetLevel(0);   // 重擺時降載等級歸零(舊版不歸零,回來時目標可能仍是下限)
  if (typeof lifeTrafficReset === 'function') lifeTrafficReset();
  if (typeof gatherReset === 'function') gatherReset();
  lifeCardHide();
}

// ---------- 預布點(PLAN_CITYLIFE_GATHER §3.4) ----------
function lifeHash(a, b) {
  let h = (a ^ Math.imul(b | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// 種子 = hash(世界編號, 道路簽章, 日, 15 分鐘時段序號):同一時段重開 = 同一批人站在同樣的位置
function lifeSeed() {
  const now = Date.now();
  let w = 1;
  try { w = (typeof worldsActive === 'function') ? (worldsActive() | 0) : 1; } catch (e) { w = 1; }
  let h = lifeHash(0x1f3d5b79, w);
  h = lifeHash(h, LIFE.road ? LIFE.road.sig : 0);
  h = lifeHash(h, Math.floor(now / 86400000));
  return lifeHash(h, Math.floor(now / 900000));
}

function lifeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 第一幀就有人:擺 max(下限, 目標 × 85%) 人。全部不需要距離場(行程延到第一次要走時才排,見 lifeNextStop 的 lazy);
// 一部分站在攤位前 / 閒逛停點上(停留中),其餘在道路上(走路中)。其餘 15% 照常從入口 / 門口走進來。
// 暫時把 Math.random 換成種子亂數 → 同種子同布點(確定性)。回傳擺出人數
function lifePrefill() {
  const R = LIFE.road;
  if (!R || !R.list.length || LIFE.target <= 0) return 0;
  const want = Math.min(LIFE.target, Math.max(LIFE.floor, Math.round(LIFE.target * LIFE_PREFILL)));
  const rng = lifeRng(lifeSeed());
  const rnd0 = Math.random;
  let vis = null, placed = 0, tries = 0;
  Math.random = rng;
  try {
    if (typeof gatherPrefill === 'function') placed += gatherPrefill();   // 進行中的聚集(下棋 / 休息)先擺好,算居民額度
    if (viewport.w > 0) {   // 40% 的路上人偏向目前畫面內的道路格(第一幀看得到;同視角仍是確定性的)
      vis = [];
      for (let i = 0; i < R.list.length; i++) {
        const c = R.list[i], px = isoX((c % boardW()) + 0.5, Math.floor(c / boardW()) + 0.5), py = isoY((c % boardW()) + 0.5, Math.floor(c / boardW()) + 0.5, world.height[c]);
        const sp = worldToScreen(px, py);
        if (sp[0] > 0 && sp[0] < viewport.w && sp[1] > 0 && sp[1] < viewport.h) vis.push(c);
      }
      if (!vis.length) vis = null;
    }
    const mk = [];
    for (let i = 0; i < R.dests.length; i++) if (R.dests[i].type === 'market') mk.push(R.dests[i].cell);
    const perCell = {};
    while (placed < want && tries++ < want * 8) {
      const key = lifePickType();
      if (!key) break;
      const T = LIFE_TYPES[key];
      if (key === 'caravan' || key === 'coolie') continue;
      let cell, act = '', dur = 0;
      const r = Math.random();
      if (mk.length && T.stop === 'market' || (mk.length && r < 0.14)) {
        cell = mk[Math.floor(Math.random() * mk.length)];
        if ((perCell[cell] || 0) >= 3) continue;
        perCell[cell] = (perCell[cell] || 0) + 1;
        act = 'trade'; dur = 2 + Math.random() * 12;
      } else if (R.spots.length && r < 0.3) {
        cell = R.spots[Math.floor(Math.random() * R.spots.length)];
        act = 'idle'; dur = 1 + Math.random() * 6;
      } else if (vis && Math.random() < 0.4) {
        cell = vis[Math.floor(Math.random() * vis.length)];
      } else {
        cell = R.list[Math.floor(Math.random() * R.list.length)];
      }
      if (!R.ok[cell]) continue;
      const plan = [{ cell: cell, act: act || 'stand', dur: dur || 0.1 }];
      if (!lifeEmit(T, key, 1, cell, plan, null, true, { lane: 0.12 + Math.random() * 0.13 })) continue;
      const n = LIFE.npcs[LIFE.npcs.length - 1];
      n.lazy = T;
      const jx = (Math.random() - 0.5) * 0.4, jy = (Math.random() - 0.5) * 0.4;
      n.x += jx; n.y += jy;
      n.px = isoX(n.x, n.y); n.py = isoY(n.x, n.y, lifeHAt(n.x, n.y));
      if (act) { n.st = 'act'; n.act = act; n.dur = dur; n.t = 0; n.fid = Math.random() < 0.5; }
      else { n.st = 'act'; n.act = 'stand'; n.dur = Math.random() * 1.5; n.t = 0; }   // 路上的人 0~1.5 秒內陸續起步(行程此時才排)
      n.alpha = 1;
      placed++;
    }
    for (let k = 0; k < 6; k++) { LIFE.nightT = 0; lifeNightTick(2); }   // 夜間保底(更夫、酒館小聚)也預先擺
    for (let k = 0; k < LIFE.npcs.length; k++) { const m = LIFE.npcs[k]; if (m.life < 1) { m.life = 1; m.alpha = 1; } }
    if (typeof lifeTrafficTick === 'function') {   // 街景角色(衛兵、攤販、走販…)也預先擺一輪
      LIFE.bfsBudget = 4;
      for (let k = 0; k < 3; k++) { LIFE.xT = 0; lifeTrafficTick(0.5); }
    }
  } finally {
    Math.random = rnd0;
  }
  LIFE.seedLeft = 0;
  return placed;
}

function lifeArrive(n) {
  const s = n.plan[n.pi];
  if (n.port && s.load !== undefined) n.spec = s.load ? n.specL : n.specE;
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
    if (act === 'park' && typeof lifeTrafficParked === 'function') lifeTrafficParked(n);
  }
}

// 進行到行程的下一站;巡邏循環、超過壽命則改走向入口離場。回傳 false 表示無路可走
function lifeNextStop(n) {
  if (n.ext && typeof lifeTrafficLeave === 'function') lifeTrafficLeave(n);
  if (n.lazy) {   // 預布點的人:這時才排行程(距離場有每幀預算,排不到就再等一下,最多重試 8 次)
    const p = lifePlan(n.lazy, n.cur, null);
    if (p) {
      n.lazy = null; n.plan = p; n.pi = 0; n.goal = p[0].cell; n.st = 'walk';
      return true;
    }
    if (++n.lazyTry < 8) { n.t = 0; n.dur = 0.3; return true; }
    n.lazy = null;
  }
  if (n.pi + 1 < n.plan.length) {
    n.pi++;
  } else if (n.loop && (n.port || n.keep || n.life < LIFE_MAX_LIFE)) {
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
  if (n.ext && typeof lifeTrafficLeave === 'function') lifeTrafficLeave(n, true);
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
      if (n.ret > 0 && n.cur !== n.goal && R.exitD[n.cur] === 0) lifeRetSet(n);   // 走到另一個更近的出口:改以它為終點
      if (n.cur === n.goal) { lifeArrive(n); return; }
      const j = lifePickNext(n);
      if (j === -2) { n.wait += dt; if (n.wait > 3) lifeStuck(n); return; }
      if (j < 0) { lifeStuck(n); return; }
      n.wait = 0;
      n.nx = j;
      const jx = (j % boardW()) + 0.5, jy = Math.floor(j / boardW()) + 0.5;
      if (n.cur >= 0) {
        const cx = (n.cur % boardW()) + 0.5, cy = Math.floor(n.cur / boardW()) + 0.5;
        const ux = jx - cx, uy = jy - cy;
        n.tx = jx - uy * n.lane; n.ty = jy + ux * n.lane;
      } else {
        n.tx = jx; n.ty = jy;
      }
    }
    const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.sqrt(dx * dx + dy * dy);
    const step = n.spd * dt * (typeof cityRoadSpd === 'function' ? cityRoadSpd(n.x, n.y) : 1);   // CT10:道路暢通路速(只讀,不寫資料)
    if (d <= step || d < 1e-6) {
      n.x = n.tx; n.y = n.ty;
      if (n.spd > 0) dt -= d / n.spd;
      n.cur = n.nx; n.nx = -1;
      if (!R.ok[n.cur]) { lifeFadeOut(n); return; }
      if (n.ret > 0 && n.cur !== n.goal && R.exitD[n.cur] !== 0 && --n.retN <= 0) { lifeFadeOut(n); return; }   // 走了 14 格還沒到出口:就地淡出
    } else {
      n.x += dx / d * step; n.y += dy / d * step;
      n.fx = dx / d; n.fy = dy / d;
      dt = 0;
    }
  }
}

// 走不到 / 距離場等太久:畫面外照舊淡出;畫面內先原地站 2 秒,再走向最近出口(走不到才淡出)
function lifeStuck(n) {
  if (n.onS && !n.ret && !n.retPend && !n.ext && !n.port && n.cur >= 0) {
    n.st = 'act'; n.act = 'stand'; n.t = 0; n.dur = 2; n.wait = 0; n.retPend = true;
    return;
  }
  lifeFadeOut(n);
}

function lifeAdvance(n, dt) {
  // 縱隊的後段先隱藏等待
  if (n.hold > 0) { n.hold -= dt; n.alpha = 0; return; }
  n.life += dt;
  if (n.cd > 0) n.cd -= dt;
  if (n.retAt > 0 && LIFE.clock >= n.retAt) { n.retAt = 0; n.retPend = true; }
  if (n.retPend) {
    if (n.st === 'walk') { n.retPend = false; if (!lifeRetireStart(n)) lifeFadeOut(n); }
    else if ((n.st === 'act' || n.st === 'chat') && !n.retCut) { n.retCut = true; if (n.dur > n.t + 3) n.dur = n.t + 3; }   // 先把手上的事做完(最多 3 秒)
  }
  if (n.ret > 0 && n.st === 'walk') { n.ret -= dt; if (n.ret <= 0) { n.ret = 0; lifeFadeOut(n); return; } }
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
      if (n.t >= n.dur) {
        if (n.stat) lifeFadeOut(n);
        else if (!lifeNextStop(n)) lifeFadeOut(n);
      }
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
  return a.st === 'walk' && a.cd <= 0 && a.life >= 1 && !a.dead && a.onS && !a.pair && !(a.hold > 0) && !a.ext && !lifeRetiring(a);
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
  const GW = Math.ceil((boardW() + 4) / LIFE_GRID), GH = Math.ceil((boardH() + 4) / LIFE_GRID);
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
    if (A.onDrop) A.onDrop(c);
  }
  LIFE.sprBytes = bytes;
}

// 降載階梯(PLAN_CITYLIFE_GATHER §3.2):慢時一次升一級、快時一次降一級(每級 2 秒)。先砍細節、最後才減人,且人數不低於下限
//  L1 畫面外更新間隔 0.75 → 1.5 秒  L2 泡泡同時 ≤ 3、閒聊配對 0.5 → 1 秒  L3 sprite 解析度上限 2 → 1.5
//  L4 走路幀頻減半  L5 街景角色 ×0.6(citytraffic 讀 lifeStreetMul)  L6~12 在下限以上每級 ×0.8 減人
//  L13 目標已降到下限仍慢 → 畫面外居民完全不更新(不減人)
const LIFE_LEVEL_MAX = 13;
function lifeSetLevel(lv) {
  if (lv < 0) lv = 0; else if (lv > LIFE_LEVEL_MAX) lv = LIFE_LEVEL_MAX;
  LIFE.level = lv;
  LIFE.adj = lv >= 6 ? Math.pow(0.8, Math.min(lv, 12) - 5) : 1;
  LIFE.offGap = lv >= 1 ? LIFE_OFF_GAP * 2 : LIFE_OFF_GAP;
  LIFE.bubMax = lv >= 2 ? 3 : 99;
  LIFE.chatGap = lv >= 2 ? 1 : 0.5;
  LIFE.resMax = lv >= 3 ? 1.5 : LIFE_RES_MAX;
  LIFE.frrMul = lv >= 4 ? 0.5 : 1;
  LIFE.freeze = lv >= LIFE_LEVEL_MAX;
}

// 街景角色的降載係數(citytraffic.js 讀):L5 起 ×0.6,之後再乘居民降載,最低 0.35
function lifeStreetMul() {
  return LIFE.level >= 5 ? Math.max(0.35, 0.6 * LIFE.adj) : 1;
}

// 「應有幀率」:繪製被幀率閘限制(閒置 / 省電 30、操作中 30 或 60,錄影可到 60);省電時 lifeFrame 又隔幀才完整執行,量測間隔是兩個繪製幀
function lifeExpFps(nowMs) {
  let e = (typeof perfEffFps === 'function') ? perfEffFps(nowMs) : 60;
  if (typeof isPowerSave === 'function' && isPowerSave() && LIFE.active) e *= 0.5;
  return e;
}

// 自適應降載:每幀耗時(更新 + 上一幀繪製)指數平均;壁鐘 FPS 只計連續幀,並和「應有幀率」比(< 70% 才算慢),不再用固定 40
function lifeAdapt(dt, t0) {
  const now = lifeNow();
  const total = (now - t0) + LIFE.drawAcc;
  LIFE.drawAcc = 0;
  LIFE.perf.ms = LIFE.perf.ms * 0.9 + total * 0.1;
  const exp = lifeExpFps(t0);
  if (LIFE.expFps !== exp) { LIFE.expFps = exp; LIFE.fps = 0; }   // 應有幀率變了(閒置 ↔ 操作中)→ 重新量
  else if (LIFE.wallT >= 0) {
    const w = t0 - LIFE.wallT;
    if (w > 0 && w < 100 * (exp < 25 ? 2 : 1)) { const f = 1000 / w; LIFE.fps = LIFE.fps > 0 ? LIFE.fps * 0.9 + f * 0.1 : f; }
  }
  LIFE.wallT = t0;
  LIFE.adaptT += dt;
  if (LIFE.adaptT >= 2) {
    LIFE.adaptT = 0;
    const slow = LIFE.perf.ms > 3.5 || (LIFE.fps > 0 && LIFE.fps < 0.7 * exp);
    if (slow) {
      LIFE.healthy = 0;
      // 已降到下限還慢:跳過其餘減人級,直接進入 L13(畫面外凍結)
      if (LIFE.level >= 6 && LIFE.target <= LIFE.floor) lifeSetLevel(LIFE_LEVEL_MAX);
      else lifeSetLevel(Math.min(LIFE.level + 1, LIFE_LEVEL_MAX - 1));
    } else if (LIFE.perf.ms < 2.5 && LIFE.level > 0) {
      LIFE.healthy++;
      if (LIFE.healthy >= 1) { LIFE.healthy = 0; lifeSetLevel(LIFE.level - 1); }
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
    n: LIFE.npcs.length, target: LIFE.target, floor: LIFE.floor, live: LIFE.live, ms: Math.round(LIFE.perf.ms * 100) / 100,
    fps: Math.round(LIFE.fps), expFps: LIFE.expFps, level: LIFE.level, ext: LIFE.npcs.filter(n => n.ext).length,
    gather: typeof gatherStats === 'function' ? gatherStats() : null
  };
}

function lifeFrame(time) {
  const t0 = lifeNow();
  if (!LIFE.inited) lifeInit();
  let dt = LIFE.lastT === null ? 0 : Math.min(0.1, Math.max(0, time - LIFE.lastT));
  LIFE.lastT = time;
  LIFE.placing = typeof ui !== 'undefined' && ui.tool !== null && ui.tool !== undefined;
  LIFE.dots = 0;
  LIFE.bakes = 0;
  LIFE.bubN = 0;
  LIFE.bfsBudget = 1;
  // 省電模式:居民邏輯與走路動畫每 2 幀更新一次(中間幀沿用上次位置與分桶,只重畫),dt 累積補上
  if (typeof isPowerSave === 'function' && isPowerSave() && LIFE.active) {
    LIFE.psFlip = !LIFE.psFlip;
    if (LIFE.psFlip) { LIFE.psAcc += dt; return; }
    dt = Math.min(0.2, dt + LIFE.psAcc);
    LIFE.psAcc = 0;
  } else LIFE.psAcc = 0;
  if (!lifeActive()) {
    if (LIFE.active) LIFE.paused = true;   // 切模式 / 隱藏建築:暫停(人物陣列留著,不更新不畫);< 5 分鐘回來原樣繼續
    LIFE.active = false;
    LIFE.drawAcc = 0;
    LIFE.wallT = -1;
    if (typeof caravanVisClear === 'function') caravanVisClear();
    if (LIFE.npcs.length && (!LIFE.on || !LIFE_DENSITY[LIFE.density])) lifeReset();   // 使用者把居民關掉才清空
    return;
  }
  LIFE.active = true;
  // 離開多久:背景 / 非經營模式 / 隱藏建築期間 lifeFrame 不會跑,用上次執行的壁鐘時間判斷。< 5 分鐘原樣繼續,否則清空並預布點
  const wall = Date.now();
  const away = LIFE.runMs > 0 ? wall - LIFE.runMs : 0;
  LIFE.runMs = wall;
  if (LIFE.reseed) { LIFE.reseed = false; lifeReset(); LIFE.runMs = wall; }
  else if (LIFE.npcs.length && (away >= LIFE_AWAY_MS || away < 0)) { lifeReset(); LIFE.runMs = wall; }
  else if (LIFE.paused && LIFE.npcs.length && LIFE.road && lifeRoadSig() !== LIFE.road.sig) { lifeReset(); LIFE.runMs = wall; }   // 暫停期間換了城(參觀 ↔ 領地)
  LIFE.paused = false;
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
    if (lifeRoadSig() !== LIFE.road.sig) { lifeRebuild(); lifeRetarget(); }   // 換存檔 / 換城後第一次擺人:先確認道路圖是新的
    LIFE.seedLeft = 0;
    lifePrefill();
  }
  lifeSpawnTick(dt);
  lifeNightTick(dt);
  lifePortTick(dt);
  if (typeof gatherTick === 'function') gatherTick(dt);   // 聚集行為(citygather.js)
  if (typeof lifeTrafficTick === 'function') lifeTrafficTick(dt);
  if (typeof npcHeroTick === 'function') npcHeroTick(dt);   // 名冊人物 hero(npcinteract.js)
  if (typeof npcVisitTick === 'function') npcVisitTick(dt);   // 在野名人路過(npcvisit.js)
  if (typeof caravanVisTick === 'function') caravanVisTick(dt);   // 走鏢車隊視覺(caravan_vis.js)
  LIFE.chatT -= dt;
  if (LIFE.chatT <= 0) { LIFE.chatT = LIFE.chatGap; lifeChatCheck(); }

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
    } else if (LIFE.freeze && (n.st === 'walk' || n.st === 'act' || n.st === 'chat') && !n.ext) {
      n.acc = 0;   // L13:畫面外居民完全不更新(不減人)
    } else {
      n.acc += dt;
      if (n.acc >= LIFE.offGap && offBudget > 0) {
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
      if (n.ext && typeof lifeTrafficLeave === 'function') lifeTrafficLeave(n, true);
      if (n.pair) { const p = n.pair; if (p.pair === n) { p.pair = null; if (p.st === 'chat') p.st = 'walk'; } n.pair = null; }
      if (LIFE.cardFor === n) lifeCardHide();
      continue;
    }
    L[w++] = n;
    if (!n.port && !n.ext && (n.st === 'walk' || n.st === 'act' || n.st === 'chat') && !lifeRetiring(n)) live++;
    if (n.st === 'act' && n.act === 'trade') tradeAt.set(n.goal, (tradeAt.get(n.goal) || 0) + 1);
  }
  L.length = w;
  LIFE.live = live;

  // 依對角線分桶(重用陣列,不配置記憶體);成對閒聊時由較小 id 的一方負責畫整組
  const buck = LIFE.buck, D = boardW() + boardH();
  for (let k = 0; k < D; k++) buck[k].length = 0;
  for (let i = 0; i < L.length; i++) {
    const n = L[i];
    if (n.hold > 0) continue;
    if (n.st === 'chat' && n.pair) {
      if (n.id > n.pair.id || !(n.onS || n.pair.onS)) continue;
    } else if (!n.onS) continue;
    let d = Math.floor(n.x) + Math.floor(n.y);
    if (n.dOver > d) d = n.dOver;   // 坐在物件上的聚集成員:畫在物件之後
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

function lifeSprCached(spec, f, fr, res, tod, season) {
  return !!(ART.cache && ART.cache['chibi|' + spec.id + '|' + f + '|' + fr + '|' + (tod || 'noon') + '|' + (season || '') + '|' + res]);
}

function lifeBubOk() {
  if (LIFE.bubN >= LIFE.bubMax) return false;
  LIFE.bubN++;
  return true;
}

// 畫一個居民。ART 只有兩張原畫(正 0 / 背 1),右向以水平翻轉取代(2、3 由 0、1 翻轉而來),快取數量減半
function lifeDrawOne(ctx, n, res, tod, season, useArt, alpha) {
  if (n.tv && typeof trafficSpriteDraw === 'function' && trafficSpriteDraw(ctx, n, res, tod, alpha)) return;   // 街景車馬外部圖(traffic_sprites.js);缺圖回 false → 沿用下方程式繪製
  if (useArt && n.spec) {
    const pp = n.pp, f = lifeFaceF(n.fx, n.fy), flip = f === 2 || f === 3;
    pp.spec = n.spec; pp.x = n.px; pp.y = n.py; pp.f = (f === 1 || f === 2) ? 1 : 0;
    pp.fr = n.st === 'walk' ? Math.floor(LIFE.clock * n.frr * LIFE.frrMul + n.ph) % 2 : (n.fid ? Math.floor(LIFE.clock * 0.8 + n.ph * 2) % 2 : 0);
    pp.alpha = alpha;
    if (n.gat > 0 && typeof gatherPose === 'function') gatherPose(n, pp);   // 聚集成員:坐 / 前伸 / 點頭 / 前傾(citygather.js)
    // 每幀最多新烘焙 LIFE_BAKE_MAX 個外觀:超過且尚未快取的人這一幀先畫占位小人(開場預布點不卡頓)
    if (LIFE.bakes >= LIFE_BAKE_MAX && !lifeSprCached(n.spec, pp.f, pp.fr, res, tod, season)) {
      useArt = false;
    } else {
      const c0 = ART.cacheCount;
      if (flip) { rqSave(ctx); rqTranslate(ctx, n.px, 0); rqScale(ctx, -1, 1); rqTranslate(ctx, -n.px, 0); }
      ART.chibiPose(ctx, pp, res, tod, season);
      if (flip) rqRestore(ctx);
      if (ART.cacheCount !== c0) LIFE.bakes++;
      return;
    }
  }
  // 占位小人;縮放 < 0.5 時(LIFE.small)縮成約 8px 高的小人
  const k = LIFE.small ? 0.6 : 1;
  rqAlpha(ctx, alpha);
  rqDisc(ctx, n.px, n.py - 9 * k, 3.8 * k, 6.5 * k, n.col);
  rqDisc(ctx, n.px, n.py - 18 * k, 3.4 * k, 3.4 * k, '#f0d2b0');
  rqAlpha(ctx, 1);
}

// 依對角線分桶繪製(每個對角線一次呼叫,總成本 O(n));縮放分三級:正常 / <0.5 簡化 / <0.35 色點
function lifeDrawDiag(ctx, d, time) {
  if (typeof caravanVisDraw === 'function') caravanVisDraw(ctx, d);   // 走鏢車隊(caravan_vis.js),依同一組對角線桶
  if (typeof gatherDraw === 'function') gatherDraw(ctx, d);   // 聚集小道具 / 提示 / 拉遠人影團(citygather.js)
  if (!LIFE.active || !LIFE.buck) return;
  const list = LIFE.buck[d];
  if (!list || !list.length) return;
  const t0 = lifeNow();
  const z = (typeof pano !== 'undefined' && pano.open) ? Math.max(view.zoom, 0.5) : view.zoom, dpr = viewport.dpr || 1; // 全景截圖也要有人,以正常細緻度繪製
  const dots = z < 0.35;
  LIFE.small = z < 0.5;
  const useArt = !dots && z >= 0.5 && typeof ART !== 'undefined' && !!ART.chibiPose && !!ART.resBucket;
  const res = useArt ? Math.min(LIFE.resMax, ART.resBucket(z * dpr)) : 1;
  const tod = LIFE.tod, season = lifeSeason();
  const mult = LIFE.placing ? 0.5 : 1;
  let skip = null;
  if (dots && list.length >= 3) {
    if (!LIFE.dotSkip || LIFE.dotSkip.length < list.length) LIFE.dotSkip = new Uint8Array(Math.max(64, list.length * 2));
    skip = LIFE.dotSkip; skip.fill(0, 0, list.length);
  }
  for (let k = 0; k < list.length; k++) {
    const n = list[k];
    const alpha = n.alpha * mult;
    if (alpha <= 0) continue;
    if (n.vis && npcVisitHidden()) continue;   // 在野名人:縮放 < 0.5 / 拍照 / 錄影不畫(照常走)
    if (n.tv && typeof trafficHidden === 'function' && trafficHidden()) continue;   // 街景車馬:縮放 < 0.5 / 拍照 / 錄影不畫(照常走)
    if (dots && n.gat > 0) continue;   // 聚集成員拉遠時由 gatherDraw 畫成一團人影,不佔色點額度
    if (dots) {
      if (LIFE.dots >= LIFE_DOT_MAX) break;
      if (skip && skip[k]) continue;
      // 同一格 ≥ 3 人 → 畫成一團人影(扁橢圓 + 3 個頭點),只算 1 個色點額度
      const fx = Math.floor(n.x), fy = Math.floor(n.y);
      let same = 0;
      if (skip) for (let j = k + 1; j < list.length; j++) if (Math.floor(list[j].x) === fx && Math.floor(list[j].y) === fy) same++;
      LIFE.dots++;
      rqAlpha(ctx, alpha);
      if (same >= 2) {
        let cnt = 1;
        rqDisc(ctx, n.px, n.py - 3, 6.5, 3, 'rgba(40,30,20,0.35)');
        rqDisc(ctx, n.px - 3.2, n.py - 5, 2.3, 2.3, n.col);
        for (let j = k + 1; j < list.length; j++) {
          const m = list[j];
          if (Math.floor(m.x) !== fx || Math.floor(m.y) !== fy) continue;
          skip[j] = 1;
          if (cnt < 3) { rqDisc(ctx, n.px - 3.2 + cnt * 3.2, n.py - 5 - (cnt === 1 ? 1.6 : 0), 2.3, 2.3, m.col); cnt++; }
        }
      } else {
        rqDisc(ctx, n.px, n.py - 5, 2.2, 2.2, n.col);
      }
      rqAlpha(ctx, 1);
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
    if (n.vis) npcVisitHalo(ctx, n, alpha);   // 在野名人光環(npcvisit.js)
    lifeDrawOne(ctx, n, res, tod, season, useArt, alpha);
    if (n.vis) npcVisitStar(ctx, n, alpha);
    if (useArt && n.spec && ART.bubble) {
      if (n.st === 'act' && n.act === 'trade') {
        if (lifeBubOk()) ART.bubble(ctx, n.px, n.py, 'trade', LIFE.clock, res, n.spec.scale || 1);
      } else if (n.type === 'vendor' && n.st === 'walk' && ((LIFE.clock + n.ph * 3) % 7) < 1.6) {
        // 挑擔商販沿路叫賣
        if (lifeBubOk()) ART.bubble(ctx, n.px, n.py, 'talk', LIFE.clock, res, n.spec.scale || 1);
      } else if (n.gat > 0) {
        if (n.gbub && lifeBubOk()) ART.bubble(ctx, n.px, n.py - (n.gz || 0), n.gbub, LIFE.clock, res, n.spec.scale || 1);   // 聚集成員的動態泡泡
      } else if (n.bub && (n.st === 'walk' || n.st === 'act') && ((n.act === 'hawk' && n.st === 'act') || ((LIFE.clock + n.ph * 3) % n.bubP) < 1.6)) {
        // 街景角色(走販 / 叫賣者 / 圍觀者)的頭上泡泡
        if (lifeBubOk()) ART.bubble(ctx, n.px, n.py, n.bub, LIFE.clock, res, n.spec.scale || 1);
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
    if (n.vis && npcVisitHidden()) continue;
    const h = worldToScreen(n.px, n.py - 20);
    const dx = sx - h[0], dy = sy - h[1], dd = dx * dx + dy * dy;
    if (dd < bd) { bd = dd; best = n; }
  }
  if (!best) return typeof gatherTap === 'function' && gatherTap(sx, sy);   // 沒點到人:再看聚集提示圖示(citygather.js)
  lifeCardShow(best);
  return true;
}

function lifeGreetNext(n) {
  const G = (n.gat > 0 && typeof gatherLines === 'function' && gatherLines(n)) || (typeof LIFE_LINES !== 'undefined' && LIFE_LINES[n.type]) || LIFE_GREET;
  let k = Math.floor(Math.random() * G.length);
  if (G.length > 1) while (k === n.gi) k = Math.floor(Math.random() * G.length);
  n.gi = k;
  return G[k];
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
  if (typeof gatherCardHide === 'function') gatherCardHide();
  if (n.role === 'visitor' && typeof npcVisitCardShow === 'function' && npcVisitCardShow(n)) return;   // 在野名人:專屬小卡(npcvisit.js)
  if (typeof npcVisitCardHide === 'function') npcVisitCardHide();
  if (n.role === 'hero' && typeof npcHeroCardShow === 'function' && npcHeroCardShow(n)) return;   // 名冊人物:專屬小卡(npcui.js)
  if (typeof npcHeroCardHide === 'function') npcHeroCardHide();
  const c = LIFE.card || lifeCardMake();
  if (!c) return;
  LIFE.cardFor = n;
  c.nameEl.textContent = n.name;
  c.typeEl.textContent = ((typeof LIFE_LOOK_TITLE !== 'undefined' && LIFE_LOOK_TITLE[n.look]) || LIFE_TYPES[n.type].name) + (n.gat > 0 && typeof gatherActText === 'function' ? ' · ' + gatherActText(n) : '');
  c.greet.textContent = '「' + lifeGreetNext(n) + '」';
  c.box.style.display = 'block';
}

function lifeCardHide() {
  LIFE.cardFor = null;
  if (typeof npcHeroCardHide === 'function') npcHeroCardHide();
  if (typeof npcVisitCardHide === 'function') npcVisitCardHide();
  if (LIFE.card) LIFE.card.box.style.display = 'none';
}
