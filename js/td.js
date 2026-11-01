// td.js — 戰鬥模擬引擎(PLAN_TD_MASTER §6.1;規格 PLAN_TD_CORE §3.7~§3.10、§4.1~§4.4;PLAN_TD_UNITS §2.4、§7.2)
// 只宣告函式與常數,載入時不執行模擬邏輯,不碰 DOM 或 world。
// 外部全域:MAP_W MAP_H OBJECTS UNITS TD_COMBAT counterMul heightMul unitBonus hitDamage makeRng footprint objFacing
//           deployCells getPass requestField processFieldQueue fieldDir markPassDirty
//           buildingTarget garrisonRelease garrisonTarget(units.js)
//           PATH_UNREACH PATH_INF NB_DX NB_DY(path.js);scoutVisible(M2-05 前可能不存在,以 typeof 守護)
// team:0 攻擊方(我方放兵)、team:1 守方(守軍)。建築不是單位,以 b.bld 管理。
// 模擬路徑禁用 Math.random / Date.now / performance.now / new Date / for-in 遍歷物件。

const SIM_VER = 3;   // 3:牆線代價(城門最便宜,path.js PATH_WALL_COST)+ 仰攻 / 俯射乘數(units.js hitHeightMul、牆 +1 層)+ 樹石不阻擋 + 崖腳死點修正;2:單兵放置制(每次放 1 個單位、UNIT_PLACE_STAT 屬性);1 為舊整隊制,舊錄影無法以新規則重跑
const SIM_HZ = 10;
const SIM_DT = 0.1;
const MAX_UNITS = 400;
const BATTLE_TICKS = 1800;
const TD_POP_CAP = 200;         // 出兵人口上限(攻方整場共用;battleInit 參數 popCap 可覆蓋)。人口 = UNITS[u].pop(每次放 1 個單位,squad 恆為 1)

const TD_SEP_R = 0.35;          // 分離力半徑(格)
const TD_SEP_W = 0.6;           // 分離力權重
const TD_SPREAD = 0.25;         // 一隊人員的排列間距(格)
const TD_RETHINK = 10;          // 空檔期再試一次的間隔(tick,約 1 秒)
const TD_STUCK = 30;            // 卡住多久(tick)後換下一個偏好
const TD_FIELD_PER_TICK = 2;    // 每 tick 最多建的流場張數
const TD_BLD_DMG_SCALE = 0.5;   // 防禦建築射擊傷害縮放(平衡用,只乘在建築對單位的傷害上;PLAN_DEFENSE §B.5 / §E 轉折點 0.5)
const TD_SLOPE_UP = 0.75;       // 單步上坡(終點格高於起點)速度倍率
const TD_SLOPE_DOWN = 1.15;     // 單步下坡(終點格低於起點)速度倍率
const TD_CHARGE_BONUS = 1.2;    // 騎兵本 tick 有下坡位移者,下一次攻擊傷害倍率(用後清除)
const TD_SHOT_MAX = 256;       // b.shots 環形緩衝容量(僅供繪圖端讀取,不進 checksum、不影響模擬)
const TD_IDLE_MAX = 20;         // 攻方存活且場上仍有可攻擊目標時,連續閒置超過此 tick 數即計入 b.stats.idle(驗收用)
const TD_CLIMB_SPD = 0.35;      // 攀爬中(登上攀爬邊後、走出一格高度前)速度倍率(PLAN_DEFENSE §A.5)
const TD_CLIMBERS = { shield: true, archer: true };   // 可攀爬的步兵 cls;騎兵 / 器械不可(§A.5)
// 建築射擊投射物種類(b.shots.k,供繪圖 / 音效);未列者為 arrow
const BLD_SHOT_K = { huojian: 'fire', xunyan: 'smoke', pili: 'stone', shitai: 'stone', nutai: 'bolt', chuangtai: 'bolt', ponu: 'bolt', ztower: 'bolt', qiangzhen: 'melee' };

let battle = null;

// 引擎預設 fx 形狀(A §4.5);數值 M2 起由 tickSequence 套用
const FX = {
  drum: { id: 'drum', dur: 10, aps: 0.3, spd: 0.2 },
  ambush: { id: 'ambush', dur: 8, atk: 0.3, lowPri: true },
  flag: { id: 'flag', r: 6, dur: 12 }
};

// 部開放時間(tick)。人口上限制下已取消時序:全部為 0(任何時間皆可放);舊錄影的 main / rear / ambush 指令一律視為可放
const SEQ_OPEN = { van: 0, main: 0, rear: 0, ambush: 0 };
const SEQ_ZONE = { van: 'front', main: 'front', rear: 'front', ambush: 'flank' };
const SEQ_ORDER = ['van', 'main', 'rear', 'ambush'];

// ---- 戰鬥初始化 ----
// init: { kind, seed, map(boardJSON), popCap?, army(舊格式,忽略) }。map 只讀不寫(複製成 typed arrays)
// 出兵改為人口上限制:攻方可放兵種為所有 fac 為 han / both 的單位,不再預選卡片(b.army = null)
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
    army: null, popCap: init.popCap != null ? init.popCap | 0 : TD_POP_CAP, popUsed: 0, minPop: tdMinDeployPop(),
    orders: { drum: 0, flag: 0 },
    units: [], nextUid: 1, nextSquad: 1,
    bld: [], bldGrid: new Uint16Array(N),
    pass: {}, fields: new Map(), fieldQueue: [], fieldPending: new Set(), passDirty: false, fieldGen: 0,
    bldEpoch: 0,
    cmds: [], cmdLog: [], events: [], shots: [], shotSeq: 0, revealed: {}, flags: { open: {} },
    stats: { dealt: 0, lost: 0, deployed: 0, unitsIn: 0, dealtDef: 0, defLost: 0, garrisonOut: 0, idle: 0 },
    atkList: [], defList: [], nlpList: [],
    retreat: false, over: false, result: null,
    gar: src.gar || null, alarm: { until: 0, aps: 0 }
  };
  b.bld = tdBuildBlds(b, kind);
  tdInitRules(b);
  tdInitSpatial(b);
  b.linkNear = tdBuildLinkNear(b);
  b.marks = map.marks;
  b.seqOpen = function (part) { return tdSeqInfo(b, part); };
  b.popLeft = function () { return b.popCap - b.popUsed; };
  return b;
}

// 可放兵種:fac 為 han(我軍)或 both(雙方)者;敵軍 / NPC 專用單位不可放
function tdDeployable(def) {
  return !!def && (def.fac === 'han' || def.fac === 'both');
}
// 所有可放兵種中最小的單位人口(判定「用完」用)
function tdMinDeployPop() {
  let m = Infinity;
  Object.keys(UNITS).forEach(function (k) {
    const d = UNITS[k];
    if (tdDeployable(d) && d.pop * d.squad < m) m = d.pop * d.squad;
  });
  return m === Infinity ? 0 : m;
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
    // 觀察期可見性:cb.scout 明確為 true/false 時從其值;否則除陷阱(cat 'trap')外皆可見(PLAN_TD_UNITS §3.4)。
    // 不直接用 scoutVisible:其對 cb.scout 為 null 的物件(樹、民房、橋、階梯、帥帳)回傳 null,會誤把整座城藏起來
    const vis = cb.scout === true || cb.scout === false ? cb.scout : cb.cat !== 'trap';
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

// 部開放狀態:時序已取消(SEQ_OPEN 皆為 0),四部任何時間皆開放;未知部別仍不開放
function tdSeqInfo(b, part) {
  if (SEQ_OPEN[part] === undefined) return { open: false, at: null, early: false };
  return { open: true, at: SEQ_OPEN[part], early: false };
}

function tdSeqOpen(b, part) { return tdSeqInfo(b, part).open; }

// 可部署格(地形區域):只看格是否在前部區域內(時序與人口另由 tdDeployWhy 判定)。回傳 boolean,供繪圖 / 測試
function canDeploy(b, part, x, y) {
  if (!(x >= 0 && y >= 0 && x < MAP_W && y < MAP_H)) return false;
  const cells = deployCells(b.map, SEQ_ZONE[part] || 'front');
  return cells[y * MAP_W + x] === 1;
}

// 放 1 個單位 u 於 (x, y) 的判定:回傳 true 或原因字串(noUnit | cell | popcap | cap | over)。不改狀態
function tdDeployWhy(b, u, x, y) {
  if (b.over) return 'over';
  const def = UNITS[u];
  if (!tdDeployable(def)) return 'noUnit';
  if (!canDeploy(b, 'van', x, y)) return 'cell';
  if (b.popUsed + def.pop * def.squad > b.popCap) return 'popcap';
  if (b.units.length + def.squad > MAX_UNITS) return 'cap';
  return true;
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

// 放 1 個單位(c.u);c.part 保留於指令但不影響判定,放入單位一律為 'van'(舊錄影相容)
function tdDeploy(b, c) {
  const why = tdDeployWhy(b, c.u, c.x, c.y);
  if (why !== true) { logEvent(b, 'deployFail', { why: why, u: c.u, x: c.x, y: c.y }); return; }
  const def = UNITS[c.u];
  const pop = def.pop * def.squad;
  b.popUsed += pop;
  tdSpawnSquad(b, c.u, 'van', c.x, c.y);
  b.stats.deployed++;
  b.stats.unitsIn += pop;
  logEvent(b, 'deploy', { u: c.u, x: c.x, y: c.y, part: 'van' });
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

// 單兵放置制:每次放 1 個單位(屬性取 UNIT_PLACE_STAT,u.st),位於放置格中心。名稱沿用 tdSpawnSquad 供舊測試呼叫
function tdSpawnSquad(b, u, part, cx, cy) {
  const def = UNITS[u];
  const st = def.place || null;
  const sq = b.nextSquad++;
  const hp0 = st ? st.hp : def.hp;
  for (let k = 0; k < 1; k++) {
    const x = cx + 0.5;
    const y = cy + 0.5;
    const nu = {
      id: b.nextUid++, u: u, team: 0, squad: sq, part: part, cls: def.cls, st: st,
      x: x, y: y, px: x, py: y, hp: hp0, maxHp: hp0, cdT: 0,
      goal: null, goalCat: null, profile: def.profile, prefIdx: 0, wReal: null,
      think: true, nextThink: 0, tgt: null, nxt: -1, stuck: 0, cstuck: 0, uBan: -1, utgt: null,
      home: null, fx: {}, hasFx: false, charge: false,
      fRef: null, fGen: -1, fCell: -1, fGoal: null, fEpoch: -1, fRes: null,
      wC: -1, wE: -1, wG: -1, wK: null, wRes: null, idleT: 0, bk: -1, bkI: -1,
      rev: null, climbing: false, clCell: -1, clX: 0, clY: 0
    };
    // 伏兵奇襲:放下後 FX.ambush.dur 秒內攻擊加成、不被建築優先鎖定
    if (part === 'ambush') fxAdd(b, nu, 'ambush', FX.ambush.dur, null, 'seq');
    b.units.push(nu);
  }
}

// 個體攻擊 / 防禦:放置單位取 u.st(UNIT_PLACE_STAT),其餘(守軍、測試手建單位)取 UNITS 基準
function tdAtkOf(u, def) { return u.st ? u.st.atk : def.atk; }
function tdDefOf(u, def) { return u.st ? u.st.def : def.def; }
// 單位人口(戰損統計用)
function tdPopOf(u) { return u.st ? u.st.pop : 1; }

// 效果修正(fx drum 加速/加攻速;fx ambush 加攻;fx flag 不在此)
function tdSpd(u, def) {
  const s = fxHas(u, 'drum') ? def.spd * (1 + FX.drum.spd) : def.spd;
  return fxHas(u, 'slow') ? s * u.fx.slow.s : s;
}
// 地形緩速:站在尖樁陣(jianzhuang)佔格內,依基礎 profile 取 cb.slow[base];其餘建築的 slow 欄位(熏煙台 {mul,dur})無此鍵 → 1
function tdZoneMul(b, u, i) {
  const bl = tdBldAt(b, i);
  if (bl === null || bl.hidden || !bl.alive || !bl.cb.slow) return 1;
  const m = bl.cb.slow[String(u.profile).split(':')[0]];
  return m > 0 ? m : 1;
}
// 印記(alarm 進入者):受傷倍率 1 + s
function tdMarkMul(t) { return fxHas(t, 'mark') ? 1 + t.fx.mark.s : 1; }
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
    active: r.trig === 'hit', hurt: false,   // hit 型守軍由建築受擊釋放,釋放時即啟動全圖追擊(否則會永遠待命)
    home: { x: r.hx, y: r.hy, leash: r.leash, alert: r.alert, trig: r.trig }, fx: {}, hasFx: false, charge: false,
    fRef: null, fGen: -1, fCell: -1, fGoal: null, fEpoch: -1, fRes: null, bk: -1, bkI: -1
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

// 同 tick 同建築世代內的 tdHasCat 結果快取(空檔計數與選目標會頻繁呼叫)
function tdHasCatC(b, cat) {
  let c = b.hcc;
  if (c === undefined || c.tick !== b.tick || c.epoch !== b.bldEpoch) {
    c = b.hcc = { tick: b.tick, epoch: b.bldEpoch, m: {} };
  }
  if (c.m[cat] === undefined) c.m[cat] = tdHasCat(b, cat);
  return c.m[cat];
}

// wall 偏好(牆是障礙不是目標):其後第一個有存活目標的非牆類別,無則 'any';皆無回 null
function tdWallReal(b, prefs, k) {
  for (let j = k + 1; j < prefs.length; j++) {
    const p = prefs[j];
    if (p === 'wall' || p === 'unit') continue;
    if (tdHasCatC(b, p)) return p;
  }
  return tdHasCatC(b, 'any') ? 'any' : null;
}

// 設定目標:cat 為偏好類別;real 非 null 表示 wall 模式(朝 real 走、只打路徑上擋路的牆)
function tdSetGoal(u, def, k, cat, real) {
  u.prefIdx = k;
  u.goalCat = cat;
  u.wReal = real;
  u.goal = 'cat:' + (real === null ? cat : real);
  // 近戰(range ≤ meleeReach)加 ':m':目標站位須與目標同高或有階梯 / 斜坡,避免停在懸崖底(path.js goalCells)
  u.profile = def.profile + (cat === 'wall' ? ':w' : '') + (def.range <= TD_COMBAT.meleeReach ? ':m' : '');
  u.nxt = -1;
  u.think = false;
  u.stuck = 0;
  u.fRef = null;
}

// 依 targetPrefs 從 prefIdx 起取第一個仍有存活目標的偏好;偏好耗盡退回 'any';只剩牆則打最近的牆;全無則待命
function tdThink(b, u) {
  const def = UNITS[u.u], prefs = def.targetPrefs || ['any'];
  for (let k = u.prefIdx; k < prefs.length; k++) {
    const p = prefs[k];
    if (p === 'unit') continue;
    if (p === 'wall') {
      const real = tdWallReal(b, prefs, k);
      if (real !== null) { tdSetGoal(u, def, k, 'wall', real); return; }
      continue;
    }
    if (!tdHasCatC(b, p)) continue;
    tdSetGoal(u, def, k, p, null);
    return;
  }
  if (tdHasCatC(b, 'any')) { tdSetGoal(u, def, prefs.length, 'any', null); return; }
  if (tdHasCatC(b, 'wall')) { tdSetGoal(u, def, prefs.length, 'wall', null); return; }
  u.goal = null;
  u.goalCat = null;
  u.wReal = null;
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

// 同格、同半徑、同類別的候選建築(靜態幾何:不含存活 / 隱藏判定,逐次再檢),依格快取於 b.candC
function tdCandidatesC(b, cell, R, cat) {
  if (!b.candC) b.candC = new Map();
  let byR = b.candC.get(cat);
  if (!byR) { byR = []; b.candC.set(cat, byR); }
  let arr = byR[R];
  if (!arr) { arr = byR[R] = new Array(MAP_W * MAP_H); }
  let L = arr[cell];
  if (L === undefined) {
    const cx = cell % MAP_W, cy = (cell - cx) / MAP_W;
    L = arr[cell] = tdCandidates(b, cx, cy, R, cat);
  }
  return L;
}

function tdCandidates(b, cx, cy, R, cat) {
  const out = [];
  for (let yy = Math.max(0, cy - R); yy <= Math.min(MAP_H - 1, cy + R); yy++) {
    for (let xx = Math.max(0, cx - R); xx <= Math.min(MAP_W - 1, cx + R); xx++) {
      const n = b.bldGrid[yy * MAP_W + xx];
      if (!n) continue;
      const bl = b.bld[n - 1];
      if (tdCatOk(bl.cb.cat, cat) && out.indexOf(bl) < 0) out.push(bl);
    }
  }
  return out;
}

// 高度連通(PLAN_TD_UNITS §2.5-2.6):近戰不跨高差,除非同高,或高差 1 層且攻方所在格(或目標格)的 8 鄰有階梯或斜坡。
// 遠程可打不同高度:低打高最多高 TD_UP_MAX 層(射程不加成),高打低照舊(unitBonus.range)。
const TD_UP_MAX = 2;
function tdBuildLinkNear(b) {
  const N = MAP_W * MAP_H, link = new Uint8Array(N), near = new Uint8Array(N);
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    if (bl.type !== 'stairs' && bl.type !== 'ramp') continue;
    for (let yy = bl.y; yy < bl.y + bl.h; yy++)
      for (let xx = bl.x; xx < bl.x + bl.w; xx++)
        if (xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H) link[yy * MAP_W + xx] = 1;
  }
  for (let i = 0; i < N; i++) {
    if (!link[i]) continue;
    const x = i % MAP_W, y = (i - x) / MAP_W;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(MAP_H - 1, y + 1); yy++)
      for (let xx = Math.max(0, x - 1); xx <= Math.min(MAP_W - 1, x + 1); xx++) near[yy * MAP_W + xx] = 1;
  }
  return near;
}
// 攻方能否命中建築 bl(以底座高度判定)
function tdHitOkBld(b, u, def, bl) {
  const a = tdCell(u.x, u.y);
  const hd = b.map.height[a] - b.map.height[bl.y * MAP_W + bl.x];
  if (def.range > TD_COMBAT.meleeReach) return hd >= -TD_UP_MAX;
  return hd === 0 || (Math.abs(hd) === 1 && b.linkNear[a] === 1);
}
// 攻方能否命中單位 t(近戰:同高或攻方 / 目標所在格附近有階梯斜坡;遠程:向上不超過 TD_UP_MAX 層)
function tdHitOkUnit(b, u, def, t) {
  const a = tdCell(u.x, u.y), c = tdCell(t.x, t.y);
  const hd = b.map.height[a] - b.map.height[c];
  if (def.range > TD_COMBAT.meleeReach) return hd >= -TD_UP_MAX;
  return hd === 0 || (Math.abs(hd) === 1 && (b.linkNear[a] === 1 || b.linkNear[c] === 1));
}

function tdFindTarget(b, u, def, cat) {
  const base = def.range + 0.5;
  const ux = u.x, uy = u.y;
  const hu = b.map.height[tdCell(ux, uy)];
  if (u.nxt >= 0) {
    const bl = tdBldAt(b, u.nxt);
    if (tdLive(bl) && bl.cb.block === 'wall' && tdDist(bl, ux, uy) <= base + tdRangeExt(def, hu - b.map.height[bl.y * MAP_W + bl.x]) && tdHitOkBld(b, u, def, bl)) return bl;
  }
  const cell = tdCell(ux, uy);
  const R = Math.ceil(base + TD_COMBAT.hRange) + 1;
  const L = tdCandidatesC(b, cell, R, cat);
  let best = null, bd = Infinity;
  for (let k = 0; k < L.length; k++) {
    const bl = L[k];
    if (!tdLive(bl)) continue;
    const d = tdDist(bl, ux, uy);
    if (d > base + TD_COMBAT.hRange) continue;
    if (d > base + tdRangeExt(def, hu - b.map.height[bl.y * MAP_W + bl.x])) continue;
    if (def.minRange && d < def.minRange) continue;
    if (!tdHitOkBld(b, u, def, bl)) continue;
    if (best === null || d < bd || (d === bd && bl.n < best.n)) { best = bl; bd = d; }
  }
  return best;
}

// 8 方向索引(dx,dy 必須為 -1..1 且非 0,0)
let TD_DIRK = null;
function tdDirK(dx, dy) {
  if (dx < -1 || dx > 1 || dy < -1 || dy > 1) return -1;
  if (TD_DIRK === null) {
    TD_DIRK = new Int8Array(9).fill(-1);
    for (let k = 0; k < 8; k++) TD_DIRK[(NB_DY[k] + 1) * 3 + NB_DX[k] + 1] = k;
  }
  return TD_DIRK[(dy + 1) * 3 + dx + 1];
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

// 攀爬邊:i → ni 為正交邊且 P.climb 有標記(path.js buildPass;horse / heavy 無 climb 表)
function tdIsClimbStep(P, i, ni) {
  if (!P.climb) return false;
  const ix = i % MAP_W, iy = (i - ix) / MAP_W;
  const jx = ni % MAP_W, jy = (ni - jx) / MAP_W;
  const k = tdDirK(jx - ix, jy - iy);
  return k >= 0 && (P.climb[i] & (1 << k)) !== 0;
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
  const sepL = b.sepL, sepN = b.sepN, sepS = b.sepS, sepStamp = b.sepStamp;
  for (let yy = by - 1; yy <= by + 1; yy++) {
    if (yy < 0 || yy >= b.sepH) continue;
    for (let xx = bx - 1; xx <= bx + 1; xx++) {
      if (xx < 0 || xx >= b.sepW) continue;
      const key = yy * b.sepW + xx;
      if (sepS[key] !== sepStamp) continue;
      const list = sepL[key], cnt = sepN[key];
      for (let k = 0; k < cnt; k++) {
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
  let nx = ux, ny = uy, enter = -1;
  if (dx !== 0 || dy !== 0) {
    const step = tdSpd(u, def) * tdZoneMul(b, u, i) * SIM_DT, hi = b.map.height[i];
    let f = 1;
    if (u.climbing && i === u.clCell) f = TD_CLIMB_SPD;
    nx = tdClamp(ux + dx * step, MAP_W); ny = tdClamp(uy + dy * step, MAP_H);
    const ni0 = tdCell(nx, ny);
    if (ni0 !== i && f === 1) {
      const dh = b.map.height[ni0] - hi;
      f = dh > 0 ? TD_SLOPE_UP : (dh < 0 ? TD_SLOPE_DOWN : 1);
    }
    if (f !== 1) { nx = tdClamp(ux + dx * step * f, MAP_W); ny = tdClamp(uy + dy * step * f, MAP_H); }
    const ni = tdCell(nx, ny);
    if (ni !== i && !tdStepOk(b, P, i, ni)) { nx = ux; ny = uy; }
    else if (ni !== i && tdIsClimbStep(P, i, ni)) {
      if (TD_CLIMBERS[def.cls] === true) enter = ni;
      else { nx = ux; ny = uy; }
    }
    else if (ni !== i && b.map.height[ni] < hi && def.cls === 'cavalry') u.charge = true;
  }
  // 攀爬狀態:跨入攀爬邊即開始;不動、離開該格、或走出一格高度即落地
  if (enter >= 0) { u.climbing = true; u.clCell = enter; u.clX = nx; u.clY = ny; }
  else if (u.climbing) {
    const cdx = nx - u.clX, cdy = ny - u.clY;
    if ((nx === ux && ny === uy) || tdCell(nx, ny) !== u.clCell || Math.sqrt(cdx * cdx + cdy * cdy) >= 1) u.climbing = false;
  }
  u.px = ux; u.py = uy;
  u.x = nx; u.y = ny;
  if (u.bk >= 0) tdBkMove(b, u);
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

// 攻擊事件(只供繪圖):k 為 arrow|bolt|stone|melee|fire;seq 即 b.shotSeq 的序號;su 為發射者(單位 id 或建築 type,供音效區分)。不讀、不寫模擬狀態
function tdShot(b, k, team, ax, ay, tx, ty, aoe, su) {
  const rec = { seq: b.shotSeq, tick: b.tick, k: k, team: team, ax: ax, ay: ay, tx: tx, ty: ty, hit: true, su: su || null };
  if (aoe) rec.aoe = aoe;
  if (b.shots.length < TD_SHOT_MAX) b.shots.push(rec); else b.shots[b.shotSeq % TD_SHOT_MAX] = rec;
  b.shotSeq++;
}

const TD_SHOT_SIEGE = { toushi: 'stone', chuangnu: 'bolt' };
function tdShotKind(u, def) {
  if (def.cls === 'siege') return TD_SHOT_SIEGE[u.u] || 'bolt';
  if (def.range > TD_COMBAT.meleeReach) return 'arrow';
  return 'melee';
}

// 命中:hitDamage(B §7.2);建築無 cls(counter 為 1)、isBld = true
// 高度乘數 hitHeightMul 獨立於 hitDamage 的夾限之外:有效目標高度 = 底座格高度 + 牆高(wallRise:城牆 / 閘樓 +1,城門 / 鹿角 0)
function tdAttack(b, u, def) {
  const tgt = u.tgt;
  const ha = b.map.height[tdCell(u.x, u.y)], ht = b.map.height[tgt.y * MAP_W + tgt.x] + wallRise(tgt.type);
  const att = { cls: def.cls, atk: tdAtkOf(u, def), vs: def.vs || null };
  let dmg = hitDamage(att, { cls: null, def: tgt.def }, unitBonus(def, 'plain', 0), null, true) * hitHeightMul(ha, ht);
  if (u.charge) { dmg *= TD_CHARGE_BONUS; u.charge = false; }
  dmg *= tdFxAtk(u);
  tgt.hp = Math.max(0, tgt.hp - dmg);
  tgt.hurt = true;
  if (tgt.hp <= 0 && tgt.killer === null) tgt.killer = u.u;
  b.stats.dealt += dmg;
  tdNoteAttack(b, u);
  tdShot(b, tdShotKind(u, def), u.team, u.x, u.y, tgt.x + tgt.w / 2, tgt.y + tgt.h / 2, null, u.u);
  u.cdT = Math.round(def.cd * SIM_HZ / tdAtkSpd(u));
}

// 單位打單位(接觸 / 守軍):team 0 的傷害計入 dealt,team 1 計入 dealtDef;被打的守軍 hurt = true
function tdAttackUnit(b, u, def, t) {
  const tdef = UNITS[t.u];
  const ha = b.map.height[tdCell(u.x, u.y)], ht = b.map.height[tdCell(t.x, t.y)];
  const att = { cls: def.cls, atk: tdAtkOf(u, def), vs: def.vs || null };
  let dmg = hitDamage(att, { cls: tdef.cls, def: tdDefOf(t, tdef) }, unitBonus(def, 'plain', 0), unitBonus(tdef, 'plain', 0), false) * hitHeightMul(ha, ht);
  if (u.charge) { dmg *= TD_CHARGE_BONUS; u.charge = false; }
  dmg *= tdFxAtk(u) * tdMarkMul(t);
  t.hp = Math.max(0, t.hp - dmg);
  t.hurt = true;
  // 回射(T6,PLAN_DEFENSE §A.4):遠程攻方被守軍命中,且守軍在攻方自身射程內 → 以該守軍為目標直到死亡(ignoreTroops 除外)
  if (u.team === 1 && t.team === 0 && t.hp > 0 && (!t.rev || !(t.rev.hp > 0)) && !tdef.ignoreTroops && tdef.range > TD_COMBAT.meleeReach && tdInReach(b, t, u, tdef)) t.rev = u;
  if (u.team === 0) { b.stats.dealt += dmg; tdNoteAttack(b, u); } else b.stats.dealtDef += dmg;
  tdShot(b, tdShotKind(u, def), u.team, u.x, u.y, t.x, t.y, null, u.u);
  u.cdT = Math.round(def.cd * SIM_HZ / tdAtkSpd(u));
}

function tdTickFx(b, u) {
  if (!u.hasFx) return;
  // 燃燒(火箭樓 / 熏煙台):每 tick 扣 rate / SIM_HZ;計入建築對攻方的傷害統計
  if (u.hp > 0 && fxHas(u, 'burn') && u.fx.burn.until > b.tick) {
    const bd = Math.min(u.hp, u.fx.burn.s.rate / SIM_HZ);
    u.hp -= bd;
    b.stats.dealtDef += bd;
  }
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
// 守軍以 team 1 辨識;被選中的守軍會在 tdAttackUnit 內被標記 hurt。守軍查詢走守方粗格 b.gD(只看 defList 快照成員)
function tdFindUnitTgt(b, u, def) {
  if (def.ignoreTroops) return null;
  if (u.rev) { if (u.rev.hp > 0) return u.rev; u.rev = null; }
  if (b.defList.length === 0) return null;
  const reach = def.range + 0.5;
  let best = null, bd = Infinity, k, e, d;
  const g = b.gD;
  if (def.range <= TD_COMBAT.meleeReach) {
    const x0 = Math.max(0, Math.floor((u.x - reach) / TD_BK)), x1 = Math.min(g.W - 1, Math.floor((u.x + reach) / TD_BK));
    const y0 = Math.max(0, Math.floor((u.y - reach) / TD_BK)), y1 = Math.min(g.H - 1, Math.floor((u.y + reach) / TD_BK));
    for (let gy = y0; gy <= y1; gy++)
      for (let gx = x0; gx <= x1; gx++) {
        const L = g.c[gy * g.W + gx];
        for (k = 0; k < L.length; k++) {
          e = L[k];
          if (!(e.hp > 0)) continue;
          d = tdUDist(u, e);
          if (d <= reach && tdHitOkUnit(b, u, def, e) && (best === null || d < bd || (d === bd && e.id < best.id))) { best = e; bd = d; }
        }
      }
    if (best !== null) return best;
  }
  if (def.targetPrefs && def.targetPrefs.indexOf('unit') >= 0 && b.tick >= u.uBan) {
    const cur = u.utgt;
    if (cur !== null && cur.hp > 0 && tdUDist(u, cur) <= TD_COMBAT.sight) return cur;
    const sg = TD_COMBAT.sight;
    const x0 = Math.max(0, Math.floor((u.x - sg) / TD_BK)), x1 = Math.min(g.W - 1, Math.floor((u.x + sg) / TD_BK));
    const y0 = Math.max(0, Math.floor((u.y - sg) / TD_BK)), y1 = Math.min(g.H - 1, Math.floor((u.y + sg) / TD_BK));
    for (let gy = y0; gy <= y1; gy++)
      for (let gx = x0; gx <= x1; gx++) {
        const L = g.c[gy * g.W + gx];
        for (k = 0; k < L.length; k++) {
          e = L[k];
          if (!(e.hp > 0)) continue;
          d = tdUDist(u, e);
          if (d > sg) continue;
          if (best === null || d < bd || (d === bd && e.id < best.id)) { best = e; bd = d; }
        }
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
  const a = tdCell(u.x, u.y), c = tdCell(t.x, t.y);
  const hd = b.map.height[a] - b.map.height[c];
  if (def.range > TD_COMBAT.meleeReach) { if (hd < -TD_UP_MAX) return false; }
  else if (!(hd === 0 || (Math.abs(hd) === 1 && (b.linkNear[a] === 1 || b.linkNear[c] === 1)))) return false;
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
  if (!tdHitOkBld(b, u, def, bl)) return false;
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

// 牆偏好的攻擊目標:沿 field(朝 wReal 的 foot:w 流場)從所在格走到目標,路徑上第一座存活的牆(擋路的牆);
// 路徑不經牆回 null。結果快取於單位(所在格 / 目標 / 牆世代 bldEpoch / 流場世代 fieldGen 任一變動即重算;牆毀即 bldEpoch 變動)
function tdPathWall(b, u, P, field) {
  const cell = tdCell(u.x, u.y);
  if (u.wC === cell && u.wE === b.bldEpoch && u.wG === b.fieldGen && u.wK === u.goal) return u.wRes;
  let res = null, i = cell;
  const N = MAP_W * MAP_H;
  for (let s = 0; s < N; s++) {
    const j = fieldDir(field.dist, i, P);
    if (j < 0) break;
    const bl = tdBldAt(b, j);
    if (tdLive(bl) && bl.cb.block === 'wall') { res = bl; break; }
    i = j;
  }
  u.wC = cell;
  u.wE = b.bldEpoch;
  u.wG = b.fieldGen;
  u.wK = u.goal;
  u.wRes = res;
  return res;
}

// 空檔計數(§2.4-6 / 驗收):存活攻方無目標、且場上仍有可攻擊建築時,本 tick 計 b.stats.idle 一次
// 連續閒置超過 TD_IDLE_MAX tick 者,每超出的 tick 計一次(短暫的換目標 / 流場重建不計)
function tdIdleCheck(b, u, field) {
  if (u.tgt !== null || u.utgt !== null) { u.idleT = 0; return; }
  const cell = tdCell(u.x, u.y);
  const stalled = u.goal === null || (field !== null && (field.dist[cell] === PATH_INF || field.dist[cell] === 0));
  if (!stalled || (!tdHasCatC(b, 'any') && !tdHasCatC(b, 'wall'))) { u.idleT = 0; return; }
  u.idleT++;
  if (u.idleT > TD_IDLE_MAX) b.stats.idle++;
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
  u.tgt = null;
  if (free) {
    if (u.wReal === null) u.tgt = tdFindTarget(b, u, def, u.goalCat);
    else if (field !== null) {
      const wt = tdPathWall(b, u, P, field);
      if (wt === null) u.tgt = tdFindTarget(b, u, def, u.wReal);
      else if (tdReachBld(b, u, def, wt)) u.tgt = wt;
    }
  }
  const fl = ut === null ? tdFlagBld(b, u) : null;
  if (fl !== null) {
    if (tdReachBld(b, u, def, fl)) u.tgt = fl;
    else {
      const ff = tdFlagField(b, u, P, fl);
      if (ff !== null) field = ff;
    }
  }
  tdIdleCheck(b, u, field);
  const pt = ut !== null ? { x: ut.x, y: ut.y, stop: (def.range + 0.5) * 0.9 } : null;
  tdMove(b, u, def, P, field, pt);
  if (u.climbing) return;
  if (ut !== null) {
    if (u.cdT <= 0 && tdInReach(b, u, ut, def)) tdAttackUnit(b, u, def, ut);
  } else if (u.tgt !== null && u.cdT <= 0 && tdHitOkBld(b, u, def, u.tgt)) {
    tdAttack(b, u, def);
  }
}

// 守軍(team 1)行為:未啟動 → 在 home 待命(不離開);啟動後 → 警戒內最近敵人、否則全圖最近,
// 一路追擊(流場;流場未就緒或不可達時直線),不回位;戰場無敵人時停在原地。啟動狀態不可逆。
// 守軍啟動判定(同 units.js garrisonWake 的判定式):受攻擊即啟動;trig 'range' 時攻方存活單位進入 home.alert 內即啟動。
// 只掃攻方粗格 b.gA 內 home.alert 範圍的桶,不配置陣列
function tdWake(b, u, home) {
  if (u.hurt) return true;
  if (home.trig === 'hit') return false;
  const r = home.alert, g = b.gA;
  const x0 = Math.max(0, Math.floor((home.x - r) / TD_BK)), x1 = Math.min(g.W - 1, Math.floor((home.x + r) / TD_BK));
  const y0 = Math.max(0, Math.floor((home.y - r) / TD_BK)), y1 = Math.min(g.H - 1, Math.floor((home.y + r) / TD_BK));
  for (let gy = y0; gy <= y1; gy++)
    for (let gx = x0; gx <= x1; gx++) {
      const L = g.c[gy * g.W + gx];
      for (let k = 0; k < L.length; k++) {
        const e = L[k];
        if (!(e.hp > 0)) continue;
        const dx = e.x - home.x, dy = e.y - home.y;
        if (Math.sqrt(dx * dx + dy * dy) <= r) return true;
      }
    }
  return false;
}

function tdTickDefender(b, u) {
  const def = UNITS[u.u];
  const home = u.home;
  tdTickFx(b, u);
  if (u.cdT > 0) u.cdT--;
  const P = tdDefPass(b);
  if (!u.active && tdWake(b, u, home)) u.active = true;
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
    if (u.cdT <= 0 && !u.climbing) tdAttackUnit(b, u, def, t);
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

// 空間索引:分離力格(sepL / sepN / sepS,邊長 TD_SEP_R,以世代戳記免於每 tick 清空)與粗格 gA(攻方)/ gD(守方,邊長 TD_BK)。
// tdRebuildSpatial 於每 tick 開頭依快照重建;之後 tdMove 改變位置時即時更新粗格(u.bk 為所在桶,-1 表未入桶,例如本 tick 才補入的守軍)。
// 粗格查詢只依距離判定,結果與桶內順序無關;sep 格內順序與舊 Map 版相同(依 b.units 順序)。
const TD_BK = 4;
function tdNewBkt() {
  const W = Math.ceil(MAP_W / TD_BK), H = Math.ceil(MAP_H / TD_BK);
  const c = new Array(W * H);
  for (let k = 0; k < c.length; k++) c[k] = [];
  return { W: W, H: H, c: c };
}
function tdInitSpatial(b) {
  b.sepW = Math.floor(MAP_W / TD_SEP_R) + 4;
  b.sepH = Math.floor(MAP_H / TD_SEP_R) + 4;
  const SZ = b.sepW * b.sepH;
  b.sepL = new Array(SZ);
  b.sepN = new Int32Array(SZ);
  b.sepS = new Int32Array(SZ);
  b.sepStamp = 0;
  b.gA = tdNewBkt();
  b.gD = tdNewBkt();
}
function tdBkCell(g, x, y) {
  let gx = Math.floor(x / TD_BK), gy = Math.floor(y / TD_BK);
  if (gx < 0) gx = 0; else if (gx >= g.W) gx = g.W - 1;
  if (gy < 0) gy = 0; else if (gy >= g.H) gy = g.H - 1;
  return gy * g.W + gx;
}
function tdBkMove(b, u) {
  const g = u.team === 1 ? b.gD : b.gA;
  const nc = tdBkCell(g, u.x, u.y);
  if (nc === u.bk) return;
  const old = g.c[u.bk], last = old.pop();
  if (last !== u) { old[u.bkI] = last; last.bkI = u.bkI; }
  const L = g.c[nc];
  u.bk = nc;
  u.bkI = L.length;
  L.push(u);
}

function tdRebuildSpatial(b) {
  if (!b.sepL) tdInitSpatial(b);
  b.sepStamp++;
  b.atkList = [];
  b.defList = [];
  const gA = b.gA, gD = b.gD;
  for (let k = 0; k < gA.c.length; k++) gA.c[k].length = 0;
  for (let k = 0; k < gD.c.length; k++) gD.c[k].length = 0;
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    u.bk = -1;
    if (u.hp <= 0) continue;
    const g = u.team === 1 ? gD : gA;
    if (u.team === 1) b.defList.push(u); else b.atkList.push(u);
    const sx = Math.floor(u.x / TD_SEP_R), sy = Math.floor(u.y / TD_SEP_R);
    const key = sy * b.sepW + sx;
    if (b.sepS[key] !== b.sepStamp) { b.sepS[key] = b.sepStamp; b.sepN[key] = 0; }
    if (b.sepL[key] === undefined) b.sepL[key] = [];
    b.sepL[key][b.sepN[key]++] = u;
    const nc = tdBkCell(g, u.x, u.y);
    u.bk = nc;
    u.bkI = g.c[nc].length;
    g.c[nc].push(u);
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
    else b.stats.lost += tdPopOf(u);
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
  else if (!tdAnyAttacker(b) && b.popLeft() < b.minPop) reason = 'wiped';
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
  const lossRatio = b.popUsed > 0 ? b.stats.lost / b.popUsed : 0;
  let grade;
  if (stars === 3) grade = 'grand';
  else if (stars === 2) grade = 'minor';
  else if (stars === 1) grade = lossRatio >= 0.7 ? 'pyrrhic' : 'narrow';
  else grade = (reason === 'wiped' || pct < 0.25) ? 'rout' : 'defeat';
  return { reason: reason, tick: b.tick + 1, pct: pct, stars: stars, merits: merits, grade: grade,
    lost: b.stats.lost, dealt: b.stats.dealt, defLost: b.stats.defLost, dealtDef: b.stats.dealtDef,
    garrisonOut: b.stats.garrisonOut, coreDown: coreDown, deployedUnits: b.stats.unitsIn, lossRatio: lossRatio,
    popUsed: b.popUsed, popCap: b.popCap };
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
  const g = b.gA;
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    if (bl.gDone || !tdGarOf(b, bl)) continue;
    const trig = bl.cb.trigger || 7;
    let go = bl.hurt;
    if (!go && bl.cb.trig !== 'hit') {
      const x0 = Math.min(g.W - 1, Math.max(0, Math.floor((bl.x - trig) / TD_BK)));
      const x1 = Math.min(g.W - 1, Math.max(0, Math.floor((bl.x + bl.w + trig) / TD_BK)));
      const y0 = Math.min(g.H - 1, Math.max(0, Math.floor((bl.y - trig) / TD_BK)));
      const y1 = Math.min(g.H - 1, Math.max(0, Math.floor((bl.y + bl.h + trig) / TD_BK)));
      for (let gy = y0; !go && gy <= y1; gy++) {
        for (let gx = x0; !go && gx <= x1; gx++) {
          const L = g.c[gy * g.W + gx];
          for (let k = 0; k < L.length; k++) {
            const u = L[k];
            const dx = Math.max(bl.x - u.x, 0, u.x - (bl.x + bl.w)), dy = Math.max(bl.y - u.y, 0, u.y - (bl.y + bl.h));
            if (Math.sqrt(dx * dx + dy * dy) <= trig) { go = true; break; }
          }
        }
      }
    }
    if (!go) continue;
    bl.gDone = true;
    const rel = tdGarRelease(b, bl);
    const sq = b.nextSquad++;
    rel.forEach(function (r) { tdSpawnDefender(b, r, sq); });
    b.stats.garrisonOut += rel.length;
    logEvent(b, 'garrison', { n: n, count: rel.length });
  }
}

// 建築射擊(§2.6):有攻擊力的存活建築;cd 倒數到 0 且射程內有攻方即開火(固定建築只打自己射程內的敵人)
// 建築射程上限(range + 0.5 + 高度 1)內的單位;buildingTarget 仍做精確判定,此處只濾掉必不可達者
// 建築射程上限(range + 1.6)內的存活攻方單位(noAmb 時排除伏兵奇襲);buildingTarget 仍做精確判定
function tdNearBld(b, bl, g, noAmb) {
  const lim = bl.cb.range + 1.6;
  const x0 = Math.min(g.W - 1, Math.max(0, Math.floor((bl.x - lim) / TD_BK)));
  const x1 = Math.min(g.W - 1, Math.max(0, Math.floor((bl.x + bl.w + lim) / TD_BK)));
  const y0 = Math.min(g.H - 1, Math.max(0, Math.floor((bl.y - lim) / TD_BK)));
  const y1 = Math.min(g.H - 1, Math.max(0, Math.floor((bl.y + bl.h + lim) / TD_BK)));
  const out = [];
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const L = g.c[gy * g.W + gx];
      for (let k = 0; k < L.length; k++) {
        const u = L[k];
        if (!(u.hp > 0)) continue;
        if (noAmb && fxHas(u, 'ambush') && !tdRevealedU(b, u)) continue;
        if (tdDist(bl, u.x, u.y) <= lim) out.push(u);
      }
    }
  }
  return out;
}

// 規則索引(battleInit 呼叫一次):烽燧台 fengs、望樓 wangs、擂鼓台 gutais;各建築 auraBy = 開戰時覆蓋它的擂鼓台
function tdInitRules(b) {
  b.fengs = []; b.wangs = []; b.gutais = [];
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n], cb = bl.cb;
    bl.auraBy = [];
    if (cb.alarm) b.fengs.push(bl);
    if (cb.reveal) b.wangs.push(bl);
    if (cb.aura) b.gutais.push(bl);
  }
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    if (!(bl.cb.atk > 0)) continue;
    const cx = bl.x + bl.w / 2, cy = bl.y + bl.h / 2;
    for (let k = 0; k < b.gutais.length; k++) {
      const g = b.gutais[k];
      if (tdDist(g, cx, cy) <= g.cb.aura.r) bl.auraBy.push(g);
    }
  }
}
// 望樓 reveal 範圍內的伏兵視為非奇襲(lowPri 失效)
function tdRevealedU(b, u) {
  for (let k = 0; k < b.wangs.length; k++) {
    const w = b.wangs[k];
    if (w.alive && tdDist(w, u.x, u.y) <= w.cb.reveal) return true;
  }
  return false;
}
// 射速倍率:擂鼓台光環(覆蓋中且擂鼓台存活,取最大 aps,不疊加)× 烽燧警報(防禦建築,dur 內)
function tdBldRateMul(b, bl) {
  let a = 0;
  for (let k = 0; k < bl.auraBy.length; k++) {
    const g = bl.auraBy[k];
    if (g.alive && g.cb.aura.aps > a) a = g.cb.aura.aps;
  }
  let m = 1 + a;
  if (b.tick < b.alarm.until && bl.cb.cat === 'defense') m *= 1 + b.alarm.aps;
  return m;
}
// 烽燧台:首次有攻方進入半徑 → 全陣警報 dur 秒(一局一次);進入者得 mark(受傷 +mark)
function tdTickAlarm(b) {
  if (b.flags.alarm || b.fengs.length === 0) return;
  for (let n = 0; n < b.fengs.length; n++) {
    const f = b.fengs[n], al = f.cb.alarm;
    if (!tdLive(f)) continue;
    for (let k = 0; k < b.atkList.length; k++) {
      const e = b.atkList[k];
      if (!(e.hp > 0) || tdDist(f, e.x, e.y) > al.r) continue;
      b.flags.alarm = true;
      b.alarm = { until: b.tick + Math.round(al.dur * SIM_HZ), aps: al.aps };
      fxAdd(b, e, 'mark', al.dur, al.mark, 'alarm');
      logEvent(b, 'alarm', { n: f.n, unit: e.u });
      return;
    }
  }
}
// NPC 守軍覆寫(battleInit 的 src.gar):有該建築類型鍵即以覆寫取代 cb.garrison({} = 無守軍)
function tdGarOf(b, bl) {
  if (b.gar && Object.prototype.hasOwnProperty.call(b.gar, bl.type)) return b.gar[bl.type];
  return bl.cb.garrison || null;
}
function tdGarRelease(b, bl) {
  if (b.gar && Object.prototype.hasOwnProperty.call(b.gar, bl.type)) {
    // garrisonRelease 只讀 bld.cb.garrison:以覆寫的副本呼叫,不改 units.js 的釋放邏輯
    return garrisonRelease({ x: bl.x, y: bl.y, w: bl.w, h: bl.h, cb: Object.assign({}, bl.cb, { garrison: b.gar[bl.type] }) }, b);
  }
  return garrisonRelease(bl, b);
}

function tdTickBlds(b) {
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n], cb = bl.cb;
    if (!tdLive(bl) || !(cb.atk > 0)) continue;
    if (bl.cd > 0) bl.cd--;
    if (bl.cd > 0) continue;
    // 伏兵奇襲(fx ambush)不被建築優先鎖定:先在非奇襲單位中選,無則才打奇襲單位(望樓 reveal 範圍內除外)
    if (bl.btgt && fxHas(bl.btgt, 'ambush') && !tdRevealedU(b, bl.btgt)) bl.btgt = null;
    let main = buildingTarget(bl, tdNearBld(b, bl, b.gA, true), b);
    if (main === null) main = buildingTarget(bl, tdNearBld(b, bl, b.gA, false), b);
    bl.btgt = main;
    if (main === null) continue;
    tdFireBld(b, bl, main);
    bl.cd = Math.round(cb.cd * SIM_HZ / tdBldRateMul(b, bl));
  }
}

// 建築對單位的命中:mode single 單體;pierce 主目標 + 距主目標 1.5 格內最近 2 名(×1、0.7、0.5);
// aoe 落點為主目標位置,範圍 aoe 內最多 aoeMax 名(主目標 ×1,其餘 ×splash×(1-0.5d/aoe))。只打 team 0
// 建築射程判定(同 units.js buildingTarget 的 inRange,供連弩樓多目標)
function tdBldReach(b, bl, e) {
  const cb = bl.cb, d = tdDist(bl, e.x, e.y);
  if (cb.minRange && d < cb.minRange) return false;
  const hB = b.map.height[tdCell(bl.x, bl.y)], hE = b.map.height[tdCell(e.x, e.y)];
  return d <= cb.range + 0.5 + (hB > hE ? 1 : 0);
}
// 燃燒:命中即 fx burn(同源刷新不疊加,單槽),每秒 dps × 縮放 × vs[cls]
function tdApplyBurn(b, t, bl, tdef) {
  const bu = bl.cb.burn;
  const vs = bu.vs && tdef.cls && bu.vs[tdef.cls] ? bu.vs[tdef.cls] : 1;
  fxAdd(b, t, 'burn', bu.dur, { rate: bu.dps * TD_BLD_DMG_SCALE * vs }, 'burn');
}
// 建築對單位的命中:single 單體;multi 射程內最近 multi 名(各 ×1);pierce 主目標 + 距主目標 1.5 格內最近(×pierce[k]);
// aoe 落點為主目標位置,範圍 aoe 內最多 aoeMax 名(主目標 ×1,其餘 ×splash×(1-0.5d/aoe))。只打 team 0。
// ap:目標 def × (1 − ap);burn / slow 於命中者加 fx;投射物 k 依 BLD_SHOT_K
function tdFireBld(b, bl, main) {
  const cb = bl.cb, atk = b.atkList;
  let hits = [{ t: main, mul: 1 }];
  if (cb.mode === 'multi') {
    const cand = [];
    for (let k = 0; k < atk.length; k++) {
      const e = atk[k];
      if (!(e.hp > 0) || !tdBldReach(b, bl, e)) continue;
      cand.push({ e: e, d: tdDist(bl, e.x, e.y) });
    }
    cand.sort(function (p, q) { return p.d - q.d || p.e.id - q.e.id; });
    hits = [];
    for (let k = 0; k < cand.length && hits.length < cb.multi; k++) hits.push({ t: cand[k].e, mul: 1 });
  } else if (cb.mode === 'pierce' || cb.mode === 'aoe') {
    const cand = [];
    for (let k = 0; k < atk.length; k++) {
      const e = atk[k];
      if (e === main || !(e.hp > 0)) continue;
      const d = tdUDist(e, main);
      if (cb.mode === 'pierce' ? d <= 1.5 : d <= cb.aoe) cand.push({ e: e, d: d });
    }
    cand.sort(function (p, q) { return p.d - q.d || p.e.id - q.e.id; });
    const cap = cb.mode === 'pierce' ? cb.pierce.length : (cb.aoeMax || 1);
    for (let k = 0; k < cand.length && hits.length < cap; k++) {
      const mul = cb.mode === 'pierce' ? cb.pierce[hits.length] : cb.splash * (1 - 0.5 * cand[k].d / cb.aoe);
      hits.push({ t: cand[k].e, mul: mul });
    }
  }
  const hb = b.map.height[tdCell(bl.x, bl.y)];
  const kind = BLD_SHOT_K[bl.type] || 'arrow';
  for (let k = 0; k < hits.length; k++) {
    const t = hits[k].t, tdef = UNITS[t.u];
    const ht = b.map.height[tdCell(t.x, t.y)];
    const att = { cls: null, atk: cb.atk, vs: cb.vs || null };
    const attB = { atk: 1, dmgIn: 1, range: 0, spd: 1 };
    const tdEff = { cls: tdef.cls, def: tdDefOf(t, tdef) * (1 - (cb.ap || 0)) };
    const dmg = hitDamage(att, tdEff, attB, unitBonus(tdef, 'plain', 0), false) * hitHeightMul(hb, ht) * TD_BLD_DMG_SCALE * hits[k].mul * tdMarkMul(t);
    t.hp = Math.max(0, t.hp - dmg);
    t.hurt = true;
    b.stats.dealtDef += dmg;
    if (cb.burn) tdApplyBurn(b, t, bl, tdef);
    if (cb.slow && cb.slow.dur) fxAdd(b, t, 'slow', cb.slow.dur, cb.slow.mul, 'slow');
    const bx = bl.x + bl.w / 2, by = bl.y + bl.h / 2;
    if (cb.mode === 'aoe') { if (k === 0) tdShot(b, kind, 1, bx, by, t.x, t.y, cb.aoe, bl.type); }
    else tdShot(b, kind, 1, bx, by, t.x, t.y, null, bl.type);
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
  tdTickReveal(b);
  tdTickHazards(b);
  tdRebuildPassIfDirty(b);
  processFieldQueue(b, TD_FIELD_PER_TICK);
  tdRebuildSpatial(b);
  tdTickGarrison(b);
  tdTickAlarm(b);
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
