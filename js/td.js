// td.js — 戰鬥模擬引擎(PLAN_TD_MASTER §6.1;規格 PLAN_TD_CORE §3.7~§3.10、§4.1~§4.4;PLAN_TD_UNITS §2.4、§7.2)
// 只宣告函式與常數,載入時不執行模擬邏輯,不碰 DOM 或 world。
// 外部全域:MAP_W MAP_H OBJECTS UNITS TD_COMBAT counterMul heightMul unitBonus hitDamage makeRng footprint objFacing
//           deployCells getPass requestField processFieldQueue fieldDir markPassDirty
//           buildingTarget garrisonRelease garrisonTarget(units.js)
//           PATH_UNREACH PATH_INF NB_DX NB_DY(path.js);scoutVisible(M2-05 前可能不存在,以 typeof 守護)
// team:0 攻擊方(我方放兵)、team:1 守方(守軍)。建築不是單位,以 b.bld 管理。
// 模擬路徑禁用 Math.random / Date.now / performance.now / new Date / for-in 遍歷物件。

const SIM_VER = 1;
const SIM_HZ = 10;
const SIM_DT = 0.1;
const MAX_UNITS = 400;
const BATTLE_TICKS = 1800;

const TD_SEP_R = 0.35;          // 分離力半徑(格)
const TD_SEP_W = 0.6;           // 分離力權重
const TD_SPREAD = 0.25;         // 一隊人員的排列間距(格)
const TD_RETHINK = 10;          // 空檔期再試一次的間隔(tick,約 1 秒)
const TD_STUCK = 30;            // 卡住多久(tick)後換下一個偏好
const TD_FIELD_PER_TICK = 2;    // 每 tick 最多建的流場張數
const TD_BLD_DMG_SCALE = 4.5;   // 防禦建築射擊傷害縮放(平衡用,只乘在建築對單位的傷害上;1.0 時 camp_square 同種 15 隊幾乎全部 100%)
const TD_SLOPE_UP = 0.75;       // 單步上坡(終點格高於起點)速度倍率
const TD_SLOPE_DOWN = 1.15;     // 單步下坡(終點格低於起點)速度倍率
const TD_CHARGE_BONUS = 1.2;    // 騎兵本 tick 有下坡位移者,下一次攻擊傷害倍率(用後清除)

let battle = null;

// 引擎預設 fx 形狀(A §4.5);數值 M2 起由 tickSequence 套用
const FX = {
  drum: { id: 'drum', dur: 10, aps: 0.3, spd: 0.2 },
  ambush: { id: 'ambush', dur: 8, atk: 0.3, lowPri: true },
  flag: { id: 'flag', r: 6, dur: 12 }
};

// 四部開放時間(tick,0.1 秒/tick)與「前一部放完即提前開放」的前驅(M2-03;PLAN_TD_CORE §1.5)
const SEQ_OPEN = { van: 0, main: 200, rear: 400, ambush: 300 };
const SEQ_PREV = { main: 'van', rear: 'main' };
const SEQ_ZONE = { van: 'front', main: 'front', rear: 'front', ambush: 'flank' };
const SEQ_ORDER = ['van', 'main', 'rear', 'ambush'];

// ---- 戰鬥初始化 ----
// init: { kind, seed, map(boardJSON), army:[{u,n,part}] }。map 只讀不寫(複製成 typed arrays)
function battleInit(init) {
  const kind = init.kind || 'sandbox';
  const seed = init.seed >>> 0;
  const src = init.map || {};
  const N = MAP_W * MAP_H;
  const map = {
    terrain: tdLayer(src, 'terrain', N), height: tdLayer(src, 'height', N), flow: tdLayer(src, 'flow', N),
    block: tdLayer(src, 'block', N), zone: tdLayer(src, 'zone', N),
    objects: (src.objects || []).map(function (o) {
      const c = Object.assign({}, o);
      c.facing = objFacing(o);
      c.rot = c.facing;
      return c;
    }),
    marks: JSON.parse(JSON.stringify(src.marks || { deploy: [], rally: [], aiEntry: [] }))
  };
  const b = {
    ver: SIM_VER, kind: kind, seed: seed, rng: makeRng(seed), tick: 0, acc: 0, speed: 1, paused: false,
    limitTick: BATTLE_TICKS, refId: init.refId || null,
    map: map,
    army: (init.army || []).map(function (c) { return { u: c.u, n: c.n | 0, part: c.part || 'van', left: c.n | 0 }; }),
    orders: { drum: 0, flag: 0 },
    units: [], nextUid: 1, nextSquad: 1,
    bld: [], bldGrid: new Uint16Array(N),
    pass: {}, fields: new Map(), fieldQueue: [], fieldPending: new Set(), passDirty: false, fieldGen: 0,
    bldEpoch: 0, spat: new Map(),
    cmds: [], cmdLog: [], events: [], revealed: {}, flags: { open: {} },
    stats: { dealt: 0, lost: 0, deployed: 0, unitsIn: 0, dealtDef: 0, defLost: 0, garrisonOut: 0 },
    atkList: [], defList: [], nlpList: [],
    retreat: false, over: false, result: null
  };
  b.bld = tdBuildBlds(b, kind);
  b.marks = map.marks;
  b.seqOpen = function (part) { return tdSeqInfo(b, part); };
  return b;
}

function tdLayer(src, k, N) {
  return src[k] ? Uint8Array.from(src[k]) : new Uint8Array(N);
}

// b.bld[n] 對應 map.objects[n];所有有 cb 的物件都進來(障礙、橋、階梯也要佔格給尋路用)
function tdBuildBlds(b, kind) {
  const out = [];
  b.map.objects.forEach(function (o, n) {
    const d = OBJECTS[o.type];
    if (!d) {
      out.push({ n: n, type: o.type, x: o.x, y: o.y, w: 1, h: 1, cb: {}, hp: 0, maxHp: 0, def: 0, alive: false, hidden: true, cd: 0, fx: {}, dev: o.dev, killer: null, halfLogged: false });
      return;
    }
    const cb = d.cb || {};
    const fp = footprint(o.type, objFacing(o));
    const vis = typeof scoutVisible === 'function' ? scoutVisible(o.type) : cb.scout !== false;
    const bl = {
      n: n, type: o.type, x: o.x, y: o.y, w: fp[0], h: fp[1], cb: cb,
      hp: cb.hp > 0 ? cb.hp : 0, maxHp: cb.hp > 0 ? cb.hp : 0, def: cb.def || 0,
      alive: true, hidden: kind !== 'sandbox' && !vis, cd: 0, fx: {},
      hurt: false, gDone: false, btgt: null, dev: o.dev, killer: null, halfLogged: false
    };
    for (let yy = bl.y; yy < bl.y + bl.h; yy++)
      for (let xx = bl.x; xx < bl.x + bl.w; xx++)
        if (xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H) b.bldGrid[yy * MAP_W + xx] = n + 1;
    out.push(bl);
  });
  return out;
}

// ---- 指令 ----
// cmd: { op:'deploy', u, part, x, y }。issueCmd 蓋上目前 tick,於下一次 simTick 第 1 步套用
function issueCmd(b, cmd) {
  const c = Object.assign({}, cmd, { tick: b.tick });
  b.cmds.push(c);
  return c;
}

// 該部是否為「前一部已放完」(須至少有 1 張卡且剩餘隊數為 0)
function tdPartDone(b, part) {
  let cards = 0, left = 0;
  for (let k = 0; k < b.army.length; k++) {
    if (b.army[k].part !== part) continue;
    cards++;
    left += b.army[k].left;
  }
  return cards > 0 && left === 0;
}

// 部開放狀態(§1.5):sandbox 恆開;否則 tick ≥ 開放時間,或前一部放完(提前開放)。伏兵只看時間
function tdSeqInfo(b, part) {
  if (b.kind === 'sandbox') return { open: true, at: 0, early: false };
  if (SEQ_OPEN[part] === undefined) return { open: false, at: null, early: false };
  const at = SEQ_OPEN[part];
  if (b.tick >= at) return { open: true, at: at, early: false };
  const pre = SEQ_PREV[part];
  if (pre !== undefined && tdPartDone(b, pre)) return { open: true, at: at, early: true };
  return { open: false, at: at, early: false };
}

function tdSeqOpen(b, part) { return tdSeqInfo(b, part).open; }

// 可部署格:部開放(§1.5)且格在該部區域內(先鋒/中軍/後軍 front;伏兵 flank)
function canDeploy(b, part, x, y) {
  if (!(x >= 0 && y >= 0 && x < MAP_W && y < MAP_H)) return false;
  if (!tdSeqOpen(b, part)) return false;
  const cells = deployCells(b.map, SEQ_ZONE[part] || 'front');
  return cells[y * MAP_W + x] === 1;
}

// 套用到期指令(依 b.cmds 順序);套用過的指令(含失敗者)依序記入 b.cmdLog,供錄影重跑
function tdApplyCmds(b) {
  const rest = [];
  for (let k = 0; k < b.cmds.length; k++) {
    const c = b.cmds[k];
    if (c.tick > b.tick) { rest.push(c); continue; }
    b.cmdLog.push(c);
    tdRunCmd(b, c);
  }
  b.cmds = rest;
}

function tdRunCmd(b, c) {
  if (c.op === 'deploy') tdDeploy(b, c);
  else if (c.op === 'drum') tdDrum(b);
  else if (c.op === 'flag') tdFlag(b, c);
  else if (c.op === 'retreat') tdRetreat(b);
  else logEvent(b, 'cmdFail', { op: c.op, why: 'op' });
}

function tdDeploy(b, c) {
  if (b.over) { logEvent(b, 'deployFail', { why: 'over' }); return; }
  const card = b.army.find(function (k) { return k.u === c.u && k.part === c.part && k.left > 0; });
  if (!card) { logEvent(b, 'deployFail', { why: 'noCard', u: c.u }); return; }
  const def = UNITS[c.u];
  if (!def) { logEvent(b, 'deployFail', { why: 'noUnit', u: c.u }); return; }
  if (!tdSeqOpen(b, c.part)) { logEvent(b, 'deployFail', { why: 'locked', part: c.part }); return; }
  if (!canDeploy(b, c.part, c.x, c.y)) { logEvent(b, 'deployFail', { why: 'cell', x: c.x, y: c.y, part: c.part }); return; }
  if (b.units.length + def.squad > MAX_UNITS) { logEvent(b, 'deployFail', { why: 'cap' }); return; }
  card.left--;
  tdSpawnSquad(b, c.u, c.part, c.x, c.y);
  b.stats.deployed++;
  b.stats.unitsIn += def.squad;
  logEvent(b, 'deploy', { u: c.u, x: c.x, y: c.y, part: c.part });
}

// 擂鼓:已上場全軍 fx drum;限 1 次
function tdDrum(b) {
  if (b.over) return;
  if (b.orders.drum >= 1) { logEvent(b, 'orderFail', { op: 'drum', why: 'used' }); return; }
  b.orders.drum++;
  let n = 0;
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    if (u.team !== 0 || !(u.hp > 0)) continue;
    fxAdd(b, u, 'drum', FX.drum.dur, null, 'order');
    n++;
  }
  logEvent(b, 'drumOrder', { n: n });
}

// 令旗:指定可見且存活的建築(c.n 為 b.bld 索引),半徑 FX.flag.r 內的我軍 FX.flag.dur 秒以其為目標;限 1 次
function tdFlag(b, c) {
  if (b.over) return;
  if (b.orders.flag >= 1) { logEvent(b, 'orderFail', { op: 'flag', why: 'used' }); return; }
  if (!Number.isInteger(c.n) || !b.bld[c.n] || !tdLive(b.bld[c.n])) { logEvent(b, 'orderFail', { op: 'flag', why: 'target' }); return; }
  const bl = b.bld[c.n];
  b.orders.flag++;
  let n = 0;
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    if (u.team !== 0 || !(u.hp > 0)) continue;
    if (tdDist(bl, u.x, u.y) > FX.flag.r) continue;
    fxAdd(b, u, 'flag', FX.flag.dur, { n: bl.n }, 'order');
    n++;
  }
  logEvent(b, 'flagOrder', { n: bl.n, bld: bl.type, count: n });
}

// 鳴金:本 tick 結束時結算(tdCheckEnd)
function tdRetreat(b) {
  if (b.over) return;
  b.retreat = true;
  logEvent(b, 'retreat', {});
}

// 一隊 = UNITS[u].squad 個個體單位,以放置格為中心、固定偏移排列
function tdSpawnSquad(b, u, part, cx, cy) {
  const def = UNITS[u];
  const sq = b.nextSquad++;
  for (let k = 0; k < def.squad; k++) {
    const x = cx + 0.5 + ((k % 4) - 1.5) * TD_SPREAD;
    const y = cy + 0.5 + (Math.floor(k / 4) - 0.5) * TD_SPREAD;
    const nu = {
      id: b.nextUid++, u: u, team: 0, squad: sq, part: part, cls: def.cls,
      x: x, y: y, px: x, py: y, hp: def.hp, maxHp: def.hp, cdT: 0,
      goal: null, goalCat: null, profile: def.profile, prefIdx: 0,
      think: true, nextThink: 0, tgt: null, nxt: -1, stuck: 0, cstuck: 0, uBan: -1, utgt: null,
      home: null, fx: {}, hasFx: false, charge: false,
      fRef: null, fGen: -1, fCell: -1, fGoal: null, fEpoch: -1, fRes: null
    };
    // 伏兵奇襲:放下後 FX.ambush.dur 秒內攻擊加成、不被建築優先鎖定
    if (part === 'ambush') fxAdd(b, nu, 'ambush', FX.ambush.dur, null, 'seq');
    b.units.push(nu);
  }
}

// 效果修正(fx drum 加速/加攻速;fx ambush 加攻;fx flag 不在此)
function tdSpd(u, def) { return fxHas(u, 'drum') ? def.spd * (1 + FX.drum.spd) : def.spd; }
function tdAtkSpd(u) { return fxHas(u, 'drum') ? 1 + FX.drum.aps : 1; }
function tdFxAtk(u) { return fxHas(u, 'ambush') ? 1 + FX.ambush.atk : 1; }

// 伏兵奇襲攻擊的首次命中記一次戰報事件
function tdNoteAttack(b, u) {
  if (u.part === 'ambush' && !b.flags.ambush && fxHas(u, 'ambush')) {
    b.flags.ambush = true;
    logEvent(b, 'ambush', { unit: u.u });
  }
}

// 守軍(team 1)由建築釋放;home = { x, y, leash, alert, trig }:待命點、待命半徑、警戒半徑、啟動條件
function tdSpawnDefender(b, r, sq) {
  const def = UNITS[r.u];
  b.units.push({
    id: b.nextUid++, u: r.u, team: 1, squad: sq, part: 'garrison', cls: def.cls,
    x: r.x, y: r.y, px: r.x, py: r.y, hp: def.hp, maxHp: def.hp, cdT: 0,
    goal: null, goalCat: null, profile: def.profile, prefIdx: 0,
    think: false, nextThink: 0, tgt: null, nxt: -1, stuck: 0, cstuck: 0, uBan: -1, utgt: null,
    active: false, hurt: false,
    home: { x: r.hx, y: r.hy, leash: r.leash, alert: r.alert, trig: r.trig }, fx: {}, hasFx: false, charge: false,
    fRef: null, fGen: -1, fCell: -1, fGoal: null, fEpoch: -1, fRes: null
  });
}

// ---- 單位 AI(PLAN_TD_CORE §3.7、PLAN_TD_UNITS §2.4;M1 無守軍,'unit' 偏好略過)----
function tdCatOk(c, cat) {
  if (!c) return false;
  if (cat === 'any') return c !== 'wall' && c !== 'trap';
  return c === cat;
}

function tdHasCat(b, cat) {
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    if (bl.alive && bl.hp > 0 && !bl.hidden && tdCatOk(bl.cb.cat, cat)) return true;
  }
  return false;
}

// 依 targetPrefs 從 prefIdx 起取第一個仍有存活建築的類別;wall 偏好用 foot:w 變體
function tdThink(b, u) {
  const def = UNITS[u.u], prefs = def.targetPrefs || ['any'];
  for (let k = u.prefIdx; k < prefs.length; k++) {
    const p = prefs[k];
    if (p === 'unit' || !tdHasCat(b, p)) continue;
    u.prefIdx = k;
    u.goalCat = p;
    u.goal = 'cat:' + p;
    u.profile = p === 'wall' ? def.profile + ':w' : def.profile;
    u.nxt = -1;
    u.think = false;
    u.stuck = 0;
    u.fRef = null;
    return;
  }
  u.goal = null;
  u.goalCat = null;
  u.think = false;
  u.nextThink = b.tick + TD_RETHINK;
}

function tdDist(bl, ux, uy) {
  const dx = Math.max(bl.x - ux, 0, ux - (bl.x + bl.w));
  const dy = Math.max(bl.y - uy, 0, uy - (bl.y + bl.h));
  return Math.sqrt(dx * dx + dy * dy);
}

function tdCell(x, y) {
  let cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0) cx = 0;
  if (cy < 0) cy = 0;
  if (cx >= MAP_W) cx = MAP_W - 1;
  if (cy >= MAP_H) cy = MAP_H - 1;
  return cy * MAP_W + cx;
}

function tdBldAt(b, i) {
  const n = b.bldGrid[i];
  return n ? b.bld[n - 1] : null;
}

function tdLive(bl) {
  return bl !== null && bl.alive && bl.hp > 0 && !bl.hidden;
}

// 攻擊目標:(1) 下一格的存活牆(阻擋者)→ (2) 射程內符合目標類別的最近建築(同距取 n 小者)
// (2) 的結果依格快取(同格、同目標類別、同建築世代);快取非空時仍重驗存活與射程
// 高度射程:遠程兵種站在比目標高的格上,射程 +1(units.js unitBonus.range);hd = 攻方高度 − 目標高度
function tdRangeExt(def, hd) {
  return hd > 0 ? unitBonus(def, 'plain', hd).range : 0;
}

function tdFindTarget(b, u, def) {
  const base = def.range + 0.5;
  const ux = u.x, uy = u.y;
  const hu = b.map.height[tdCell(ux, uy)];
  if (u.nxt >= 0) {
    const bl = tdBldAt(b, u.nxt);
    if (tdLive(bl) && bl.cb.block === 'wall' && tdDist(bl, ux, uy) <= base + tdRangeExt(def, hu - b.map.height[bl.y * MAP_W + bl.x])) return bl;
  }
  const cell = tdCell(ux, uy);
  if (u.fCell === cell && u.fGoal === u.goalCat && u.fEpoch === b.bldEpoch) {
    const c = u.fRes;
    if (c === null) return null;
    if (tdLive(c) && tdDist(c, ux, uy) <= base + tdRangeExt(def, hu - b.map.height[c.y * MAP_W + c.x])) return c;
  }
  const R = Math.ceil(base + TD_COMBAT.hRange) + 1;
  const cx = Math.floor(ux), cy = Math.floor(uy);
  let best = null, bd = Infinity;
  for (let yy = Math.max(0, cy - R); yy <= Math.min(MAP_H - 1, cy + R); yy++) {
    for (let xx = Math.max(0, cx - R); xx <= Math.min(MAP_W - 1, cx + R); xx++) {
      const n = b.bldGrid[yy * MAP_W + xx];
      if (!n) continue;
      const bl = b.bld[n - 1];
      if (!tdLive(bl) || !tdCatOk(bl.cb.cat, u.goalCat)) continue;
      const d = tdDist(bl, ux, uy);
      if (d > base + TD_COMBAT.hRange) continue;
      if (d > base + tdRangeExt(def, hu - b.map.height[bl.y * MAP_W + bl.x])) continue;
      if (def.minRange && d < def.minRange) continue;
      if (best === null || d < bd || (d === bd && bl.n < best.n)) { best = bl; bd = d; }
    }
  }
  u.fCell = cell;
  u.fGoal = u.goalCat;
  u.fEpoch = b.bldEpoch;
  u.fRes = best;
  return best;
}

// 8 方向索引(dx,dy 必須為 -1..1 且非 0,0)
function tdDirK(dx, dy) {
  for (let k = 0; k < 8; k++) if (NB_DX[k] === dx && NB_DY[k] === dy) return k;
  return -1;
}

// 實體可進入格 j:通行表不可通行,或存活的牆 / 城門
function tdPhysBlocked(b, P, j) {
  if (P.cost[j] === PATH_UNREACH) return true;
  const bl = tdBldAt(b, j);
  return tdLive(bl) && bl.cb.block === 'wall' && !(P.def === true && bl.type === 'gate');
}

// 守軍專用通行表(team 1):存活的牆(非城門)不可通行、城門代價 10 且可通行(B:守軍可通行城門,攻方視為牆)
// 由 foot 通行表衍生,快取於 b.pass[DEF_PROFILE];b.pass 被清空時一併重建
const DEF_PROFILE = 'foot:def';
function tdDefPass(b) {
  if (b.pass[DEF_PROFILE]) return b.pass[DEF_PROFILE];
  const base = getPass(b, 'foot');
  const N = MAP_W * MAP_H;
  const cost = new Uint16Array(base.cost), edge = new Uint8Array(base.edge);
  for (let i = 0; i < N; i++) {
    const bl = tdBldAt(b, i);
    if (!tdLive(bl)) continue;
    if (bl.type === 'gate') cost[i] = 10;
    else if (bl.cb.block === 'wall') cost[i] = PATH_UNREACH;
  }
  for (let i = 0; i < N; i++) {
    if (!edge[i]) continue;
    for (let k = 0; k < 8; k++) {
      if (!(edge[i] & (1 << k))) continue;
      const j = i + NB_OFF[k];
      if (cost[j] === PATH_UNREACH) edge[i] &= ~(1 << k);
    }
  }
  b.pass[DEF_PROFILE] = { cost: cost, edge: edge, def: true };
  return b.pass[DEF_PROFILE];
}

function tdStepOk(b, P, i, ni) {
  const ix = i % MAP_W, iy = (i - ix) / MAP_W;
  const jx = ni % MAP_W, jy = (ni - jx) / MAP_W;
  const k = tdDirK(jx - ix, jy - iy);
  if (k < 0) return false;
  if (!(P.edge[i] & (1 << k))) return false;
  return !tdPhysBlocked(b, P, ni);
}

function tdClamp(v, max) {
  return Math.min(max - 0.001, Math.max(0.001, v));
}

// pt 為 null 或 { x, y, stop }:無流場時直線走向點(距離 ≤ stop 即停),用於守軍 / 單位追擊
function tdMove(b, u, def, P, field, pt) {
  const ux = u.x, uy = u.y, i = tdCell(ux, uy);
  let vx = 0, vy = 0, moving = false;
  if (field === null && pt !== null) {
    const ddx = pt.x - ux, ddy = pt.y - uy, len = Math.sqrt(ddx * ddx + ddy * ddy);
    if (len > pt.stop) { vx = ddx / len; vy = ddy / len; moving = true; }
  }
  if (field !== null) {
    const d0 = field.dist[i];
    if (d0 === PATH_INF) {
      u.prefIdx++;
      u.think = true;
    } else if (d0 === 0) {
      u.nxt = -1;
    } else {
      const j = fieldDir(field.dist, i, P);
      u.nxt = j;
      if (j >= 0 && u.tgt === null) {
        const tx = (j % MAP_W) + 0.5, ty = Math.floor(j / MAP_W) + 0.5;
        const ddx = tx - ux, ddy = ty - uy, len = Math.sqrt(ddx * ddx + ddy * ddy);
        if (len > 0) { vx = ddx / len; vy = ddy / len; moving = true; }
      }
    }
  }
  // 分離力(同隊、半徑 TD_SEP_R;空間雜湊格邊長 = TD_SEP_R,查 3×3 即涵蓋半徑內所有單位)
  let sx = 0, sy = 0;
  const bx = Math.floor(ux / TD_SEP_R), by = Math.floor(uy / TD_SEP_R);
  for (let yy = by - 1; yy <= by + 1; yy++) {
    for (let xx = bx - 1; xx <= bx + 1; xx++) {
      const list = b.spat.get(tdSepKey(xx, yy));
      if (!list) continue;
      for (let k = 0; k < list.length; k++) {
        const o = list[k];
        if (o === u || o.team !== u.team) continue;
        let ddx = ux - o.x, ddy = uy - o.y;
        let d2 = ddx * ddx + ddy * ddy;
        if (d2 >= TD_SEP_R * TD_SEP_R) continue;
        if (d2 < 1e-12) { ddx = u.id > o.id ? 1 : -1; ddy = 0; d2 = 1; }
        const d = Math.sqrt(d2), push = (TD_SEP_R - d) / TD_SEP_R;
        sx += ddx / d * push;
        sy += ddy / d * push;
      }
    }
  }
  let dx = vx + TD_SEP_W * sx, dy = vy + TD_SEP_W * sy;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag > 1) { dx /= mag; dy /= mag; }
  let nx = ux, ny = uy;
  if (dx !== 0 || dy !== 0) {
    const step = tdSpd(u, def) * SIM_DT, hi = b.map.height[i];
    let f = 1;
    nx = tdClamp(ux + dx * step, MAP_W); ny = tdClamp(uy + dy * step, MAP_H);
    const ni0 = tdCell(nx, ny);
    if (ni0 !== i) {
      const dh = b.map.height[ni0] - hi;
      f = dh > 0 ? TD_SLOPE_UP : (dh < 0 ? TD_SLOPE_DOWN : 1);
    }
    if (f !== 1) { nx = tdClamp(ux + dx * step * f, MAP_W); ny = tdClamp(uy + dy * step * f, MAP_H); }
    const ni = tdCell(nx, ny);
    if (ni !== i && !tdStepOk(b, P, i, ni)) { nx = ux; ny = uy; }
    else if (ni !== i && b.map.height[ni] < hi && def.cls === 'cavalry') u.charge = true;
  }
  u.px = ux; u.py = uy;
  u.x = nx; u.y = ny;
  if (moving && field !== null && u.tgt === null && Math.abs(nx - ux) + Math.abs(ny - uy) < 0.0005) {
    u.stuck++;
    if (u.stuck >= TD_STUCK) { u.stuck = 0; u.prefIdx++; u.think = true; }
  } else if (field !== null) {
    u.stuck = 0;
  }
  if (moving && field === null) {
    // 直線追擊卡牆:一段時間後暫停追擊該類目標(uBan),改回原本的流場 / 回位
    if (Math.abs(nx - ux) + Math.abs(ny - uy) < 0.0005) {
      u.cstuck++;
      if (u.cstuck >= TD_STUCK) { u.cstuck = 0; u.uBan = b.tick + TD_RETHINK * 3; }
    } else {
      u.cstuck = 0;
    }
  }
}

// 命中:hitDamage(B §7.2);建築無 cls(counter 為 1)、isBld = true
function tdAttack(b, u, def) {
  const tgt = u.tgt;
  const hd = b.map.height[tdCell(u.x, u.y)] - b.map.height[tgt.y * MAP_W + tgt.x];
  const att = { cls: def.cls, atk: def.atk, vs: def.vs || null };
  let dmg = hitDamage(att, { cls: null, def: tgt.def }, unitBonus(def, 'plain', hd), null, true);
  if (u.charge) { dmg *= TD_CHARGE_BONUS; u.charge = false; }
  dmg *= tdFxAtk(u);
  tgt.hp = Math.max(0, tgt.hp - dmg);
  tgt.hurt = true;
  if (tgt.hp <= 0 && tgt.killer === null) tgt.killer = u.u;
  b.stats.dealt += dmg;
  tdNoteAttack(b, u);
  u.cdT = Math.round(def.cd * SIM_HZ / tdAtkSpd(u));
}

// 單位打單位(接觸 / 守軍):team 0 的傷害計入 dealt,team 1 計入 dealtDef;被打的守軍 hurt = true
function tdAttackUnit(b, u, def, t) {
  const tdef = UNITS[t.u];
  const hd = b.map.height[tdCell(u.x, u.y)] - b.map.height[tdCell(t.x, t.y)];
  const att = { cls: def.cls, atk: def.atk, vs: def.vs || null };
  let dmg = hitDamage(att, { cls: tdef.cls, def: tdef.def }, unitBonus(def, 'plain', hd), unitBonus(tdef, 'plain', 0), false);
  if (u.charge) { dmg *= TD_CHARGE_BONUS; u.charge = false; }
  dmg *= tdFxAtk(u);
  t.hp = Math.max(0, t.hp - dmg);
  t.hurt = true;
  if (u.team === 0) { b.stats.dealt += dmg; tdNoteAttack(b, u); } else b.stats.dealtDef += dmg;
  u.cdT = Math.round(def.cd * SIM_HZ / tdAtkSpd(u));
}

function tdTickFx(b, u) {
  if (!u.hasFx) return;
  const ks = Object.keys(u.fx);
  let left = 0;
  for (let k = 0; k < ks.length; k++) {
    if (u.fx[ks[k]].until <= b.tick) delete u.fx[ks[k]];
    else left++;
  }
  u.hasFx = left > 0;
}

// 流場參照依 fieldGen 更新(流場清空時才重取)
function tdFieldOf(b, u) {
  if (u.fRef === null || u.fGen !== b.fieldGen) {
    u.fRef = requestField(b, u.profile, u.goal);
    u.fGen = b.fieldGen;
  }
  return u.fRef;
}

// 攻擊方單位選守軍:(1) 近戰貼身的守軍覆寫(接觸);(2) 偏好含 unit 者取警戒內最近守軍(黏住)
// 守軍以 team 1 辨識;被選中的守軍會在 tdAttackUnit 內被標記 hurt
function tdFindUnitTgt(b, u, def) {
  const dl = b.defList;
  if (dl.length === 0 || def.ignoreTroops) return null;
  const reach = def.range + 0.5;
  let best = null, bd = Infinity, k, e, d;
  if (def.range <= TD_COMBAT.meleeReach) {
    for (k = 0; k < dl.length; k++) {
      e = dl[k];
      if (!(e.hp > 0)) continue;
      d = tdUDist(u, e);
      if (d <= reach && (best === null || d < bd || (d === bd && e.id < best.id))) { best = e; bd = d; }
    }
    if (best !== null) return best;
  }
  if (def.targetPrefs && def.targetPrefs.indexOf('unit') >= 0 && b.tick >= u.uBan) {
    const cur = u.utgt;
    if (cur !== null && cur.hp > 0 && tdUDist(u, cur) <= TD_COMBAT.sight) return cur;
    for (k = 0; k < dl.length; k++) {
      e = dl[k];
      if (!(e.hp > 0)) continue;
      d = tdUDist(u, e);
      if (d > TD_COMBAT.sight) continue;
      if (best === null || d < bd || (d === bd && e.id < best.id)) { best = e; bd = d; }
    }
    return best;
  }
  return null;
}

function tdUDist(p, q) {
  const dx = p.x - q.x, dy = p.y - q.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function tdInReach(b, u, t, def) {
  const hd = b.map.height[tdCell(u.x, u.y)] - b.map.height[tdCell(t.x, t.y)];
  return tdUDist(u, t) <= def.range + 0.5 + tdRangeExt(def, hd);
}

// 令旗效果中的建築(仍存活);無則 null
function tdFlagBld(b, u) {
  if (!fxHas(u, 'flag')) return null;
  const bl = b.bld[u.fx.flag.s.n];
  return tdLive(bl) ? bl : null;
}

// 射程內以建築為目標的判定(同 tdInReach 的建築版)
function tdReachBld(b, u, def, bl) {
  const d = tdDist(bl, u.x, u.y);
  if (def.minRange && d < def.minRange) return false;
  const hd = b.map.height[tdCell(u.x, u.y)] - b.map.height[bl.y * MAP_W + bl.x];
  return d <= def.range + 0.5 + tdRangeExt(def, hd);
}

// 令旗中、射程外:改走流場朝建築周圍最近的可通行格(找不到則沿用原流場)
function tdFlagField(b, u, P, bl) {
  const c = tdFlagCell(b, P, bl);
  if (c < 0) return null;
  const f = requestField(b, u.profile, 'cell:' + (c % MAP_W) + ',' + Math.floor(c / MAP_W));
  if (f === null || f.dist[tdCell(u.x, u.y)] === PATH_INF) return null;
  return f;
}

// 建築外圈第一個可通行且無建築的格(固定掃描順序)
function tdFlagCell(b, P, bl) {
  for (let yy = bl.y - 1; yy <= bl.y + bl.h; yy++) {
    for (let xx = bl.x - 1; xx <= bl.x + bl.w; xx++) {
      if (xx < 0 || yy < 0 || xx >= MAP_W || yy >= MAP_H) continue;
      if (xx >= bl.x && xx < bl.x + bl.w && yy >= bl.y && yy < bl.y + bl.h) continue;
      const i = yy * MAP_W + xx;
      if (P.cost[i] === PATH_UNREACH || tdBldAt(b, i)) continue;
      return i;
    }
  }
  return -1;
}

function tdTickUnit(b, u) {
  const def = UNITS[u.u];
  tdTickFx(b, u);
  if (u.cdT > 0) u.cdT--;
  if (u.think || (u.goal === null && b.tick >= u.nextThink)) tdThink(b, u);
  const P = getPass(b, u.profile);
  const ut = tdFindUnitTgt(b, u, def);
  u.utgt = ut;
  const free = ut === null && u.goal !== null;
  let field = free ? tdFieldOf(b, u) : null;
  u.tgt = free ? tdFindTarget(b, u, def) : null;
  const fl = ut === null ? tdFlagBld(b, u) : null;
  if (fl !== null) {
    if (tdReachBld(b, u, def, fl)) u.tgt = fl;
    else {
      const ff = tdFlagField(b, u, P, fl);
      if (ff !== null) field = ff;
    }
  }
  const pt = ut !== null ? { x: ut.x, y: ut.y, stop: (def.range + 0.5) * 0.9 } : null;
  tdMove(b, u, def, P, field, pt);
  if (ut !== null) {
    if (u.cdT <= 0 && tdInReach(b, u, ut, def)) tdAttackUnit(b, u, def, ut);
  } else if (u.tgt !== null && u.cdT <= 0) {
    tdAttack(b, u, def);
  }
}

// 守軍(team 1)行為:未啟動 → 在 home 待命(不離開);啟動後 → 警戒內最近敵人、否則全圖最近,
// 一路追擊(流場;流場未就緒或不可達時直線),不回位;戰場無敵人時停在原地。啟動狀態不可逆。
function tdTickDefender(b, u) {
  const def = UNITS[u.u];
  const home = u.home;
  tdTickFx(b, u);
  if (u.cdT > 0) u.cdT--;
  const P = tdDefPass(b);
  if (!u.active && garrisonWake(u, b.atkList, home)) u.active = true;
  if (!u.active) {
    u.utgt = null;
    tdMove(b, u, def, P, null, { x: home.x, y: home.y, stop: 0.6 });
    return;
  }
  const t = garrisonTarget(u, b.atkList, home);
  u.utgt = t;
  if (t === null) {
    tdMove(b, u, def, P, null, { x: home.x, y: home.y, stop: 0.6 });
    return;
  }
  if (tdInReach(b, u, t, def)) {
    if (u.cdT <= 0) tdAttackUnit(b, u, def, t);
    return;
  }
  const ti = tdCell(t.x, t.y);
  let field = requestField(b, DEF_PROFILE, 'cell:' + (ti % MAP_W) + ',' + Math.floor(ti / MAP_W));
  if (field !== null && field.dist[tdCell(u.x, u.y)] === PATH_INF) field = null;
  tdMove(b, u, def, P, field, { x: t.x, y: t.y, stop: (def.range + 0.5) * 0.9 });
}

// ---- simTick 各步 ----
function tdRebuildPassIfDirty(b) {
  if (!b.passDirty) return;
  b.pass = {};
  b.fields = new Map();
  b.fieldQueue = [];
  b.fieldPending = new Set();
  b.passDirty = false;
  b.fieldGen++;
}

function tdSepKey(sx, sy) {
  return sy * 4096 + sx;
}

function tdRebuildSpatial(b) {
  b.spat = new Map();
  b.atkList = [];
  b.defList = [];
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    if (u.hp <= 0) continue;
    if (u.team === 1) b.defList.push(u); else b.atkList.push(u);
    const key = tdSepKey(Math.floor(u.x / TD_SEP_R), Math.floor(u.y / TD_SEP_R));
    const list = b.spat.get(key);
    if (list) list.push(u); else b.spat.set(key, [u]);
  }
}

function tdTickUnits(b) {
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    if (u.hp > 0) { if (u.team === 1) tdTickDefender(b, u); else tdTickUnit(b, u); }
  }
}

// 建築死亡:標記 pass 重建;單位死亡後壓縮陣列
function tdResolveDeaths(b) {
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    if (bl.alive && bl.cb.hp > 0 && bl.hp <= 0) {
      bl.alive = false;
      bl.hp = 0;
      markPassDirty(b);
      b.bldEpoch++;
      logEvent(b, 'bldDestroyed', { n: n, type: bl.type, x: bl.x, y: bl.y });
      tdNoteBldDown(b, bl);
    } else if (bl.alive && bl.cb.cat === 'core' && !bl.halfLogged && bl.hp <= bl.maxHp * 0.5) {
      bl.halfLogged = true;
      logEvent(b, 'coreHurt', { n: n, bld: bl.type });
    }
  }
  let w = 0;
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    if (u.hp > 0) b.units[w++] = u;
    else if (u.team === 1) b.stats.defLost++;
    else b.stats.lost++;
  }
  b.units.length = w;
}

// 建築摧毀:先登(第一個由攻方摧毀者)、城門破、核心陷落(斬將)
function tdNoteBldDown(b, bl) {
  if (bl.killer !== null && !b.flags.breach) {
    b.flags.breach = true;
    logEvent(b, 'breach', { unit: bl.killer, bld: bl.type, n: bl.n });
  }
  if (bl.type === 'gate') logEvent(b, 'gateBreak', { bld: bl.type, n: bl.n });
  if (bl.cb.cat === 'core') logEvent(b, 'slayer', { bld: bl.type, n: bl.n });
}

// 結束條件(§1.8):計分建築全毀、鳴金、時間到、我軍用完且全滅
function tdCheckEnd(b) {
  let total = 0, destroyed = 0;
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n], w = bl.cb.scoreW || 0;
    total += w;
    if (!bl.alive) destroyed += w;
  }
  const pct = total > 0 ? destroyed / total : 1;
  let reason = null;
  if (total > 0 && destroyed === total) reason = 'allDestroyed';
  else if (b.retreat) reason = 'retreat';
  else if (b.tick + 1 >= b.limitTick) reason = 'time';
  else if (!tdAnyAttacker(b) && !b.army.some(function (c) { return c.left > 0; })) reason = 'wiped';
  if (reason !== null) {
    b.over = true;
    b.result = tdSettle(b, reason, pct);
    logEvent(b, 'end', { reason: reason, pct: pct });
  }
}

// 結算(§1.9 / §5.3):星 = 三功勞(斬將 破核心 / 陷陣 破壞 ≥50% / 蕩平 100%);六級評價依星數與結束原因
function tdSettle(b, reason, pct) {
  let coreDown = false;
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    if (bl.cb.cat === 'core' && !bl.alive) coreDown = true;
  }
  const merits = [];
  if (coreDown) merits.push('slayer');
  if (pct >= 0.5) merits.push('siege');
  if (pct >= 1) merits.push('sweep');
  const stars = merits.length;
  const lossRatio = b.stats.unitsIn > 0 ? b.stats.lost / b.stats.unitsIn : 0;
  let grade;
  if (stars === 3) grade = 'grand';
  else if (stars === 2) grade = 'minor';
  else if (stars === 1) grade = lossRatio >= 0.7 ? 'pyrrhic' : 'narrow';
  else grade = (reason === 'wiped' || pct < 0.25) ? 'rout' : 'defeat';
  return { reason: reason, tick: b.tick + 1, pct: pct, stars: stars, merits: merits, grade: grade,
    lost: b.stats.lost, dealt: b.stats.dealt, defLost: b.stats.defLost, dealtDef: b.stats.dealtDef,
    garrisonOut: b.stats.garrisonOut, coreDown: coreDown, deployedUnits: b.stats.unitsIn, lossRatio: lossRatio };
}

function tdAnyAttacker(b) {
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    if (u.team === 0 && u.hp > 0) return true;
  }
  return false;
}

// 駐軍釋放(§2.5):建築受傷,或攻方進入其 trigger 半徑 → 依 garrison 一次放出全部駐軍(每建築一次)。
// 放出的守軍為 idle,各自依 trig 啟動(見 tdTickDefender)
function tdTickGarrison(b) {
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    if (bl.gDone || !bl.cb.garrison) continue;
    const trig = bl.cb.trigger || 7;
    let go = bl.hurt;
    for (let k = 0; !go && bl.cb.trig !== 'hit' && k < b.units.length; k++) {
      const u = b.units[k];
      if (u.team === 0 && u.hp > 0 && tdDist(bl, u.x, u.y) <= trig) go = true;
    }
    if (!go) continue;
    bl.gDone = true;
    const rel = garrisonRelease(bl, b);
    const sq = b.nextSquad++;
    rel.forEach(function (r) { tdSpawnDefender(b, r, sq); });
    b.stats.garrisonOut += rel.length;
    logEvent(b, 'garrison', { n: n, count: rel.length });
  }
}

// 建築射擊(§2.6):有攻擊力的存活建築;cd 倒數到 0 且射程內有攻方即開火(固定建築只打自己射程內的敵人)
function tdTickBlds(b) {
  let nlp = null;
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n], cb = bl.cb;
    if (!tdLive(bl) || !(cb.atk > 0)) continue;
    if (bl.cd > 0) bl.cd--;
    if (bl.cd > 0) continue;
    // 伏兵奇襲(fx ambush)不被建築優先鎖定:先在非奇襲單位中選,無則才打奇襲單位
    if (bl.btgt && fxHas(bl.btgt, 'ambush')) bl.btgt = null;
    if (nlp === null) nlp = b.atkList.filter(function (e) { return !fxHas(e, 'ambush'); });
    let main = buildingTarget(bl, nlp, b);
    if (main === null) main = buildingTarget(bl, b.atkList, b);
    bl.btgt = main;
    if (main === null) continue;
    tdFireBld(b, bl, main);
    bl.cd = Math.round(cb.cd * SIM_HZ);
  }
}

// 建築對單位的命中:mode single 單體;pierce 主目標 + 距主目標 1.5 格內最近 2 名(×1、0.7、0.5);
// aoe 落點為主目標位置,範圍 aoe 內最多 aoeMax 名(主目標 ×1,其餘 ×splash×(1-0.5d/aoe))。只打 team 0
function tdFireBld(b, bl, main) {
  const cb = bl.cb, atk = b.atkList;
  const hits = [{ t: main, mul: 1 }];
  if (cb.mode === 'pierce' || cb.mode === 'aoe') {
    const cand = [];
    for (let k = 0; k < atk.length; k++) {
      const e = atk[k];
      if (e === main || !(e.hp > 0)) continue;
      const d = tdUDist(e, main);
      if (cb.mode === 'pierce' ? d <= 1.5 : d <= cb.aoe) cand.push({ e: e, d: d });
    }
    cand.sort(function (p, q) { return p.d - q.d || p.e.id - q.e.id; });
    const cap = cb.mode === 'pierce' ? 3 : (cb.aoeMax || 1);
    for (let k = 0; k < cand.length && hits.length < cap; k++) {
      const mul = cb.mode === 'pierce' ? cb.pierce[hits.length] : cb.splash * (1 - 0.5 * cand[k].d / cb.aoe);
      hits.push({ t: cand[k].e, mul: mul });
    }
  }
  const hb = b.map.height[tdCell(bl.x, bl.y)];
  for (let k = 0; k < hits.length; k++) {
    const t = hits[k].t, tdef = UNITS[t.u];
    const ht = b.map.height[tdCell(t.x, t.y)];
    const att = { cls: null, atk: cb.atk, vs: cb.vs || null };
    const attB = { atk: heightMul(hb, ht), dmgIn: 1, range: 0, spd: 1 };
    const dmg = hitDamage(att, { cls: tdef.cls, def: tdef.def }, attB, unitBonus(tdef, 'plain', 0), false) * TD_BLD_DMG_SCALE * hits[k].mul;
    t.hp = Math.max(0, t.hp - dmg);
    t.hurt = true;
    b.stats.dealtDef += dmg;
  }
}

// 部開放事件(非 sandbox):第一次開放時記一筆 partOpen
function tdTickSequence(b) {
  if (b.kind === 'sandbox') return;
  for (let k = 0; k < SEQ_ORDER.length; k++) {
    const part = SEQ_ORDER[k];
    if (b.flags.open[part]) continue;
    if (!tdSeqOpen(b, part)) continue;
    b.flags.open[part] = true;
    logEvent(b, 'partOpen', { part: part });
  }
}

// 揭露(§4.5):隱藏建築(bld.hidden)變為可見,並記 b.revealed[dev] = tick。
// 只在觸發 / 接觸 / 被斥候發現時呼叫;同一建築只揭露一次
function tdReveal(b, bl, reason) {
  if (!bl || !bl.hidden) return false;
  bl.hidden = false;
  if (bl.dev !== undefined && bl.dev !== null) b.revealed[bl.dev] = b.tick;
  logEvent(b, 'trapSeen', { n: bl.n, dev: bl.dev === undefined ? null : bl.dev, why: reason });
  return true;
}

// 斥候發現:我軍斥候(UNITS.scout 為半徑)進入隱藏建築半徑內即揭露。只讀位置
function tdTickReveal(b) {
  if (b.kind === 'sandbox') return;
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    if (!bl.hidden || !bl.alive) continue;
    for (let k = 0; k < b.units.length; k++) {
      const u = b.units[k];
      if (u.team !== 0 || !(u.hp > 0)) continue;
      const sc = UNITS[u.u].scout || 0;
      if (sc > 0 && tdDist(bl, u.x, u.y) <= sc) { tdReveal(b, bl, 'scout'); break; }
    }
  }
}

function tdTickHazards(b) {}
function tdTickProjectiles(b) {}

// 固定步長的一次模擬(PLAN_TD_CORE §4.3;M1 只做 1、5、6、7、10、11、12)
function simTick(b) {
  if (!b || b.over) return;
  tdApplyCmds(b);
  tdTickSequence(b);
  tdTickGarrison(b);
  tdTickReveal(b);
  tdTickHazards(b);
  tdRebuildPassIfDirty(b);
  processFieldQueue(b, TD_FIELD_PER_TICK);
  tdRebuildSpatial(b);
  tdTickUnits(b);
  tdTickBlds(b);
  tdTickProjectiles(b);
  tdResolveDeaths(b);
  tdCheckEnd(b);
  b.tick++;
}

// 無新指令時跑到結束
function runToEnd(b) {
  while (!b.over && b.tick < b.limitTick) simTick(b);
  return b;
}

// init 同 battleInit;cmds 為 [{tick, op, ...}];跑到結束或 maxTick
function runHeadless(init, cmds, maxTick) {
  const b = battleInit(init);
  const list = (cmds || []).slice().sort(function (p, q) { return p.tick - q.tick; });
  const lim = maxTick == null ? BATTLE_TICKS : maxTick;
  let ptr = 0;
  while (!b.over && b.tick < lim) {
    while (ptr < list.length && list[ptr].tick <= b.tick) {
      issueCmd(b, list[ptr]);
      ptr++;
    }
    simTick(b);
  }
  return b;
}

// ---- 事件、效果、校驗 ----
// 事件 { tick, type, ...data };data 欄位保留供 mapio.js / battleui.js 讀取(與扁平欄位同值)
function logEvent(b, type, data) {
  if (b.events.length >= 5000) return;
  b.events.push(Object.assign({}, data || {}, { tick: b.tick, type: type, data: data || null }));
}

function fxAdd(b, ent, id, t, s, src) {
  if (!ent.fx) ent.fx = {};
  ent.fx[id] = { until: b.tick + Math.round(t * SIM_HZ), s: s, src: src };
  ent.hasFx = true;
}

function fxHas(ent, id) {
  return !!(ent.fx && ent.fx[id]);
}

function fxClear(ent, id) {
  if (ent.fx) delete ent.fx[id];
}

function tdHash(h, v) {
  v = v | 0;
  for (let s = 0; s < 4; s++) {
    h ^= (v >>> (s * 8)) & 255;
    h = Math.imul(h, 16777619);
  }
  return h;
}

// FNV-1a:tick、每個單位(id、x×100、y×100、hp×100)、每座建築(hp×100、alive)
function battleChecksum(b) {
  let h = 0x811c9dc5 | 0;
  h = tdHash(h, b.tick);
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    h = tdHash(h, u.id);
    h = tdHash(h, Math.round(u.x * 100));
    h = tdHash(h, Math.round(u.y * 100));
    h = tdHash(h, Math.round(u.hp * 100));
  }
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    h = tdHash(h, Math.round(bl.hp * 100));
    h = tdHash(h, bl.alive ? 1 : 0);
  }
  return h >>> 0;
}
