const SAVE_KEY = 'lorddomain.save.v1';
const SAVE_PRE_KEY = 'lorddomain.save.pre112.v1';        // 舊(56×56)存檔遷移到大地圖前的原樣備份(只留第一份,不覆蓋)
const SAVE_BAD_KEY = 'lorddomain.save.corrupt.v1';        // 讀不出來的存檔副本(不當新玩家直接覆蓋)
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
const OBJ_KEEP = ['facing', 'dev', 'trig', 'mimic', 'skin'];   // skin = 外觀皮膚 id(wallskin.js),純外觀

const world = {
  terrain: new Uint8Array(EST_W * EST_H),
  height: new Uint8Array(EST_W * EST_H),
  flow: new Uint8Array(EST_W * EST_H),
  block: new Uint8Array(EST_W * EST_H),
  zone: new Uint8Array(EST_W * EST_H),
  marks: newMarks(),
  occ: new Int16Array(EST_W * EST_H),
  get W() { return boardW(); },                  // 現役棋盤邊長(經營板 EST_W、戰陣板 MAP_W;由 terrain 長度推得,換板自動跟著)
  get H() { return boardW(); },
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
  tech: { done: [], cur: null },
  layoutSlots: newLayoutSlots(),                 // 版面存檔格(PLAN_LAYOUT §2):{ estate:[s1,s2,s3], camp:[…] },每格 { name, savedAt, board:boardToJSON 格式 } 或 null
  layoutActive: { estate: null, camp: null }     // 使用中版面所屬的格(0~2),null = 不屬於任何格
};
let dealCache = null;

// 板子永遠是正方形:邊長由現役 terrain 長度推得並快取(switchBoard / boardBackup / layoutInstall 換掉陣列即自動更新)
let _bdT = null, _bdW = 0;
function boardW() {
  const t = world.terrain;
  if (t !== _bdT) { _bdT = t; _bdW = Math.round(Math.sqrt(t.length)); }
  return _bdW;
}
function boardH() { return boardW(); }
const idx = (x, y) => y * boardW() + x;
const inBounds = (x, y) => { const w = boardW(); return x >= 0 && y >= 0 && x < w && y < w; };

function footprint(type, rot) {
  const d = OBJECTS[type];
  return d.swap && rot % 2 === 1 ? [d.h, d.w] : [d.w, d.h];
}

// 移動中的已蓋建築(ui.js draft):仍留在 world.objects(存檔保留原位),但不占 occ、不進 objDiag(不繪製)
let objHold = null;

function rebuildOcc() {
  if (world.occ.length !== world.terrain.length) world.occ = new Int16Array(world.terrain.length);
  else world.occ.fill(0);
  world.objDiag = [];
  world.objects.forEach((o, n) => {
    if (o === objHold) return;
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

function newBoard(side) {
  const N = (side || MAP_W) * (side || MAP_W);
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
  if (world.stash === null) world.stash = newBoard(to === 'estate' ? EST_W : MAP_W);
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
  const nb = newBoard(MAP_W);   // 備份中的棋盤(進攻 / 回放 / 參觀 / 草稿)先給戰陣標準尺寸;經營草稿由 boardReset('estate') 換成經營尺寸
  BOARD_KEYS.forEach(k => { world[k] = nb[k]; });
  world.board = 'estate';
  world.stash = null;
  pendClear();
  rebuildOcc();
}

// 現役(空白)棋盤換成 type 的標準尺寸(經營 EST_W、戰陣 MAP_W);草稿環境用,內容全清
function boardReset(type) {
  const nb = newBoard(type === 'estate' ? EST_W : MAP_W);
  BOARD_KEYS.forEach(k => { world[k] = nb[k]; });
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
  if (typeof o.skin === 'string' && o.skin) r.skin = o.skin; else delete r.skin;
  r.facing = objFacing(o);
  return r;
}

// ───── 圖層 RLE 與物件扁平化(經營大板存檔用;沿用 mapio 'v*n' 文字格式,map.js 先載入故自帶一份)─────
function layerRle(arr) {
  const parts = [];
  let i = 0;
  while (i < arr.length) {
    const v = arr[i];
    let n = 1;
    while (i + n < arr.length && arr[i + n] === v) n++;
    parts.push(n === 1 ? String(v) : v + '*' + n);
    i += n;
  }
  return parts.join(',');
}
// 圖層讀入:數字陣列(舊格式)或 RLE 字串 → Uint8Array(n);格式或長度不符丟例外
function layerIn(v, n) {
  if (Array.isArray(v)) {
    if (v.length !== n) throw new Error('layer length');
    return Uint8Array.from(v);
  }
  if (typeof v !== 'string') throw new Error('layer type');
  const out = new Uint8Array(n);
  let pos = 0;
  if (v) {
    const segs = v.split(',');
    for (let k = 0; k < segs.length; k++) {
      const m = /^(\d+)(?:\*(\d+))?$/.exec(segs[k]);
      if (!m) throw new Error('RLE format');
      const val = +m[1], cnt = m[2] ? +m[2] : 1;
      if (val > 255 || pos + cnt > n) throw new Error('RLE range');
      if (val) out.fill(val, pos, pos + cnt);
      pos += cnt;
    }
  }
  if (pos !== n) throw new Error('RLE length');
  return out;
}
// 物件扁平化:ot = 型別表,op = [型別索引, x, y, rot*4+facing, ...](保留順序),ox = [[序號, {其餘欄位}]...]
function objPack(list) {
  const ot = [], tix = {}, op = [], ox = [];
  list.forEach((o, n) => {
    if (tix[o.type] === undefined) { tix[o.type] = ot.length; ot.push(o.type); }
    op.push(tix[o.type], o.x, o.y, ((o.rot | 0) & 3) * 4 + ((o.facing != null ? o.facing : o.rot | 0) & 3));
    let ex = null;
    for (const k in o) if (k !== 'type' && k !== 'x' && k !== 'y' && k !== 'rot' && k !== 'facing') { ex = ex || {}; ex[k] = o[k]; }
    if (ex) ox.push([n, ex]);
  });
  const r = { ot: ot, op: op };
  if (ox.length) r.ox = JSON.parse(JSON.stringify(ox));
  return r;
}
function objUnpack(j) {
  if (!Array.isArray(j.ot) || !Array.isArray(j.op) || j.op.length % 4 !== 0) throw new Error('objects pack');
  const out = [];
  for (let k = 0; k < j.op.length; k += 4) {
    const t = j.ot[j.op[k]], f = j.op[k + 3];
    if (typeof t !== 'string') throw new Error('objects type');
    out.push({ type: t, x: j.op[k + 1], y: j.op[k + 2], rot: (f >> 2) & 3, facing: f & 3 });
  }
  (Array.isArray(j.ox) ? j.ox : []).forEach(e => {
    if (!Array.isArray(e) || !out[e[0]] || !e[1] || typeof e[1] !== 'object') return;
    for (const k in e[1]) if (k !== 'type' && k !== 'x' && k !== 'y' && k !== 'rot' && k !== 'facing') out[e[0]][k] = e[1][k];
  });
  return out;
}

// 棋盤 → JSON。戰陣標準尺寸(MAP_W)維持舊格式(數字陣列 + objects);其他尺寸(經營大板)帶 w/h,圖層 RLE、物件扁平(on = 件數)
function boardToJSON(bd) {
  const side = Math.round(Math.sqrt(bd.terrain.length));
  if (side === MAP_W) {
    return {
      v: 1,
      terrain: Array.from(bd.terrain), height: Array.from(bd.height), flow: Array.from(bd.flow),
      block: Array.from(bd.block), zone: Array.from(bd.zone),
      objects: bd.objects.map(o => objSave(o, true)),
      marks: JSON.parse(JSON.stringify(bd.marks))
    };
  }
  const j = {
    v: 1, w: side, h: side,
    terrain: layerRle(bd.terrain), height: layerRle(bd.height), flow: layerRle(bd.flow),
    block: layerRle(bd.block), zone: layerRle(bd.zone),
    on: bd.objects.length
  };
  Object.assign(j, objPack(bd.objects.map(o => objSave(o, true))));
  j.marks = JSON.parse(JSON.stringify(bd.marks));
  return j;
}

function normMarks(v) {
  const m = v && typeof v === 'object' ? v : {};
  const arr = a => (Array.isArray(a) ? JSON.parse(JSON.stringify(a)) : []);
  return { deploy: arr(m.deploy), rally: arr(m.rally), aiEntry: arr(m.aiEntry) };
}

// 失敗回 null。kind:'estate' = 經營板(邊長 <= EST_W 的方形 JSON 一律置中放進 EST_W 板,舊 56 版面 / 草稿 / 存檔用);
// 'camp' 或省略 = 戰陣板(必須 MAP_W,與舊行為相同),但帶 w = EST_W 的大板 JSON(boardToJSON 產出)省略 kind 時視為經營板
function boardFromJSON(j, kind) {
  try {
    if (!j || typeof j !== 'object' || j.v !== 1) return null;
    const first = j.terrain;
    const n0 = Array.isArray(first) ? first.length : (typeof first === 'string' && Number.isInteger(j.w) ? j.w * j.w : -1);
    const side = Math.round(Math.sqrt(n0));
    if (n0 <= 0 || side * side !== n0) return null;
    if (j.w !== undefined && j.w !== side) return null;
    let W;
    if (kind === 'estate') { if (side > EST_W) return null; W = EST_W; }
    else if (kind === undefined || kind === 'camp') {
      if (side === MAP_W) W = MAP_W;
      else if (kind === undefined && j.w === side && side === EST_W) W = EST_W;
      else return null;
    } else return null;
    const b = newBoard(W), N = W * W, off = (W - side) >> 1;
    ['terrain', 'height', 'flow', 'block', 'zone'].forEach(k => {
      const a = layerIn(j[k], side * side);
      if (side === W) { b[k] = a; return; }
      for (let y = 0; y < side; y++) b[k].set(a.subarray(y * side, y * side + side), (y + off) * W + off);
    });
    for (let i = 0; i < N; i++) if (b.terrain[i] > T_SNOW) b.terrain[i] = T_GRASS;   // 未知的大值當草地,不崩潰
    const src = j.op !== undefined ? objUnpack(j) : (Array.isArray(j.objects) ? j.objects : []);
    b.objects = src
      .filter(o => o && typeof o.type === 'string' && hasType(o.type) && Number.isInteger(o.x) && Number.isInteger(o.y) &&
        o.x >= 0 && o.y >= 0 && o.x < side && o.y < side)
      .map(o => {
        const r = { type: o.type, x: o.x + off, y: o.y + off, rot: (o.rot | 0) & 3 };
        OBJ_KEEP.forEach(k => { if (k !== 'facing' && o[k] !== undefined) r[k] = o[k]; });
        r.facing = o.facing != null ? (o.facing & 3) : r.rot;
        if (typeof r.skin !== 'string' || !r.skin) delete r.skin;
        return r;
      });
    b.marks = normMarks(j.marks);
    if (off) {
      b.marks.deploy.forEach(d => { if (d && d.r) { d.r[0] += off; d.r[1] += off; } });
      b.marks.rally.forEach(p => { if (p && typeof p.x === 'number') { p.x += off; p.y += off; } });
      b.marks.aiEntry.forEach(a => { if (a && a.r) { a.r[0] += off; a.r[1] += off; } });
    }
    return b;
  } catch (e) {
    return null;
  }
}

// 戰陣起點：地形 / 高度 / 河流路面複製經營基地；只帶 side 為 both 的物件；block/zone/marks 清空
function copyEstateToCamp() {
  if (world.board !== 'camp') return false;
  const e = estateBoard();
  const eS = Math.round(Math.sqrt(e.terrain.length)), S = boardW();
  if (eS === S) {
    world.terrain.set(e.terrain); world.height.set(e.height); world.flow.set(e.flow);
    world.block.fill(0); world.zone.fill(0);
    world.objects = e.objects.filter(o => sideOf(o.type) === 'both').map(o => objSave(o, true));
  } else {
    // 經營板比戰陣板大:取以城主府(沒有則板子中心)為中心、S×S 的視窗(貼邊夾住);只帶完整落在視窗內的 both 物件
    const pal = e.objects.find(o => o.type === 'palace');
    const pfp = pal ? footprint('palace', pal.rot) : null;
    const cx = pal ? pal.x + (pfp[0] >> 1) : eS >> 1, cy = pal ? pal.y + (pfp[1] >> 1) : eS >> 1;
    const x0 = Math.max(0, Math.min(eS - S, cx - (S >> 1))), y0 = Math.max(0, Math.min(eS - S, cy - (S >> 1)));
    ['terrain', 'height', 'flow'].forEach(k => {
      for (let y = 0; y < S; y++) world[k].set(e[k].subarray((y + y0) * eS + x0, (y + y0) * eS + x0 + S), y * S);
    });
    world.block.fill(0); world.zone.fill(0);
    world.objects = e.objects.filter(o => {
      if (sideOf(o.type) !== 'both') return false;
      const fp = footprint(o.type, o.rot);
      return o.x >= x0 && o.y >= y0 && o.x + fp[0] <= x0 + S && o.y + fp[1] <= y0 + S;
    }).map(o => { const r = objSave(o, true); r.x -= x0; r.y -= y0; return r; });
  }
  world.marks = newMarks();
  rebuildOcc();
  return true;
}

// 解鎖閘門（PLAN_TD_MASTER §3.6；PLAN_PROGRESSION §2.5）：開放等級由 progUnlockLv 查表；表中沒有的 id 或 prog 未載入一律開放
function isUnlocked(kind, id) {
  if (kind === 'feature' && typeof cityOnlyHides === 'function' && cityOnlyHides(id)) return false;   // 城建專注模式(js/cityonly.js):釣魚 / 仙獸 / 戰鬥相關功能一律視為未開放
  if (kind === 'estate' && typeof nlUnlocked === 'function') {   // NL1:經營板物件改看起手集合 ∪ 已研完科技(citytech.js);戰陣板與其他類別沿用等級表
    const nl = nlUnlocked(id);
    if (nl !== null) return nl;
  }
  if (kind === 'feature' && typeof nlFeatureOpen === 'function') {   // NL2:功能依科技 / 建築而非 prog.lv(focusHidden 與未登記者沿用等級表)
    const nf = nlFeatureOpen(id);
    if (nf !== null) return nf;
  }
  if (typeof progUnlockLv !== 'function' || typeof prog === 'undefined' || !prog) return true;
  const lv = progUnlockLv(kind, id);
  return lv === null || prog.lv >= lv;
}

// 城市等級規則（PLAN_PROGRESSION §2.1、§2.6、§8.2）：土地遮罩、解鎖、生產上限只在玩家建造模式生效
// landBypass > 0 時暫停（範本套用用，見 tplRun）；TPL_ENFORCE_LAND 為 false 時範本套用不受規則限制（僅供測試關閉）
let landBypass = 0;
var TPL_ENFORCE_LAND = true;
function progRulesOn() {
  return landBypass === 0 && typeof prog !== 'undefined' && !!prog && (game.mode === 'estate' || game.mode === 'battleDesign');
}
// 土地遮罩：以地圖中心為準的正方形，邊長 progLandSide(lv)；未載入或 Lv25 = 全開。(x,y,w,h) 是否整個在土地內
function inLandRect(x, y, w, h) {
  if (typeof prog === 'undefined' || !prog || typeof progLandSide !== 'function' || prog.lv >= PROG_LV_MAX) return true;
  if (world.board === 'estate') return true;   // NL0:經營板全圖開放,不再依等級限制土地
  const W = boardW();
  const side = Math.min(W, world.board === 'camp' && typeof progCoreSide === 'function' ? progCoreSide(prog.lv) : progLandSide(prog.lv)), x0 = (W - side) >> 1, y0 = x0;   // 戰陣板仍用舊公式(56);經營板用大地圖曲線
  return x >= x0 && y >= y0 && x + w <= x0 + side && y + h <= y0 + side;
}
function inLand(x, y) { return inLandRect(x, y, 1, 1); }
// 建造規則下，(x,y,w,h) 是否在土地內（非建造模式恆為真）
function landFits(x, y, w, h) { return !progRulesOn() || inLandRect(x, y, w, h); }

// 目前模式可否放置此建築（side、退役、等級解鎖）；attack/replay/visit/fishing 不檢查等級與土地
function sideOk(type) {
  if (!hasType(type)) return false;
  const d = OBJECTS[type];
  if (game.mode === 'estate' || game.mode === 'battleDesign') {
    if (d.retired) return false;
    const s = sideOf(type);
    if (game.mode === 'estate' ? (s !== 'estate' && s !== 'both') : (s !== 'camp' && s !== 'both')) return false;
    if (progRulesOn() && !isUnlocked(game.mode === 'estate' ? 'estate' : 'camp', type)) return false;
  }
  return true;
}

function countObjects(type) {
  return world.objects.filter(o => o.type === type).length;
}

// 數量上限：OBJECTS.max 與等級生產上限取小（PLAN_PROGRESSION §2.1）；null = 不限
function capOf(type) {
  const d = OBJECTS[type];
  let m = d.max || null;
  if (type === 'research' && typeof techLabCap === 'function' && typeof CITY_TECHS !== 'undefined') m = techLabCap();   // NL1:研究院上限依時代
  if (progRulesOn() && typeof progProdCap === 'function') {
    const pc = progProdCap(type, prog.lv);
    if (pc !== null && (m === null || pc < m)) m = pc;
  }
  return m;
}

function canPlace(type, x, y, rot) {
  if (!sideOk(type)) return false;
  const d = OBJECTS[type];
  const cap = capOf(type);
  if (cap !== null && countObjects(type) >= cap) return false;
  const [w, h] = footprint(type, rot);
  if (x < 0 || y < 0 || x + w > boardW() || y + h > boardH()) return false;
  if (!landFits(x, y, w, h)) return false;
  const h0 = world.height[idx(x, y)];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = idx(xx, yy);
      if (world.occ[i] || world.height[i] !== h0) return false;
      if (!terrainOn(d, world.terrain[i])) return false;
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
  if (!landFits(x, y, 1, 1)) return false;
  removeObjectAt(x, y, false);
  const i = idx(x, y);
  world.terrain[i] = t;
  world.flow[i] = t === T_RIVER ? flowDir : 0;
  return true;
}

function changeHeight(x, y, delta) {
  const i = idx(x, y);
  if (!landFits(x, y, 1, 1) || world.occ[i]) return false;
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
  if (typeof cityGoodsTick === 'function') cityGoodsTick(dt);   // 生產鏈(goods.js):庫房與工坊結算
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

// 主存檔內容(物件)。經營板為標準 MAP_W 時維持 v1 舊格式(數字陣列 + objects,舊版 App 讀得懂);
// 經營大板用 v2:size = 邊長、圖層 RLE 字串(objects 維持物件陣列,與舊格式同形)
function saveWorldObj() {
  const eb = estateBoard(), cb = campBoard();
  const side = Math.round(Math.sqrt(eb.terrain.length));
  const o = {};
  if (side === MAP_W) {
    o.terrain = Array.from(eb.terrain); o.height = Array.from(eb.height); o.flow = Array.from(eb.flow);
  } else {
    o.v = 2; o.size = side;
    o.terrain = layerRle(eb.terrain); o.height = layerRle(eb.height); o.flow = layerRle(eb.flow);
  }
  o.objects = eb.objects.map(ob => objSave(ob, false));
  o.camp = cb ? boardToJSON(cb) : null;
  o.res = world.res; o.lastTs = world.lastTs; o.season = currentSeason; o.deals = world.deals; o.tech = world.tech;
  o.record = world.record; o.npcBest = world.npcBest; o.raid = world.raid;
  if (world.city) o.city = world.city;   // 庫房(goods.js)
  if (typeof worldsStamp === 'function') worldsStamp(o);   // 世界編號 / 名稱(saveslots.js):存檔自己知道屬於哪個世界
  o.layoutSlots = world.layoutSlots; o.layoutActive = world.layoutActive;
  return o;
}

// 存檔保護(PLAN_SAVES SV0):寫入失敗(多半是 localStorage 配額)時不動舊的好存檔(setItem 失敗不會改原值)、保留記憶體狀態並 toast 一次;
// 讀檔失敗而且連損毀副本都存不下時 saveBlocked = true,本次不再寫入,以免用新玩家狀態覆蓋原檔
let saveBlocked = false, saveFailShown = false;
let saveSuspend = false;   // 讀檔 / 重新開始(saveslots.js)寫回 localStorage 後到 reload 前:所有存檔寫入一律略過,避免記憶體舊狀態覆蓋;頁面重載後自然消失
function saveNotice(msg) { if (typeof showToast === 'function') { try { showToast(msg); } catch (e) { /* 略過 */ } } }
function saveWorld() {
  if (saveSuspend) return;
  if (!saveBlocked) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveWorldObj()));
      saveFailShown = false;
    } catch (e) {
      if (!saveFailShown) { saveFailShown = true; saveNotice('存檔空間不足,進度尚未寫入(舊存檔保留)'); }
    }
  }
  draftPersist();
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

// 讀不出來的存檔:把原字串另存損毀副本並提示;副本也存不下就封鎖寫入(saveBlocked),保住原檔
function saveKeepBad(raw, why) {
  try {
    localStorage.setItem(SAVE_BAD_KEY, raw);
    saveNotice('存檔讀取失敗(' + why + '),已保留損毀副本');
  } catch (e) {
    saveBlocked = true;
    saveNotice('存檔讀取失敗且空間不足無法備份,為保護原檔本次不會寫入存檔');
  }
}

// 舊(較小)存檔遷移到大板前,把原字串備份一份(只留第一份;空間不足只提示)
function savePreBackup(raw) {
  try {
    if (localStorage.getItem(SAVE_PRE_KEY) === null) localStorage.setItem(SAVE_PRE_KEY, raw);
  } catch (e) {
    saveNotice('存檔空間不足,略過舊存檔備份');
  }
}

// NL1 舊存檔遷移:存檔沒有 city.tech(NL 前的存檔)且有 prog.lv 時,依等級發科技;先原樣備份一次(只留第一份)。已放置的物件一律保留
const SAVE_PRENL_KEY = 'lorddomain.save.prenl.v1';
function nlMigrateSave(s) {
  if (typeof techMigrateFromLevel !== 'function' || (s.city && s.city.tech)) return;
  if (typeof prog === 'undefined' || !prog || !(prog.lv >= 1)) return;
  try {
    if (localStorage.getItem(SAVE_PRENL_KEY) === null) localStorage.setItem(SAVE_PRENL_KEY, JSON.stringify(s));
  } catch (e) { saveNotice('存檔空間不足,略過舊存檔備份'); }
  techMigrateFromLevel(prog.lv);
}

function loadWorldSave() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  if (!raw) return false;
  try {
    let s;
    try { s = JSON.parse(raw); } catch (e) { saveKeepBad(raw, 'JSON 損毀'); return false; }
    if (!s || typeof s !== 'object') { saveKeepBad(raw, '格式不符'); return false; }
    const W = EST_W, N = W * W;
    let side, tIn, hIn, fIn, objs;
    if (typeof s.terrain === 'string') {   // v2
      side = s.size;
      if (!Number.isInteger(side) || side < 1 || side > W) { saveKeepBad(raw, '尺寸 ' + side + ' 不支援'); return false; }
      tIn = layerIn(s.terrain, side * side); hIn = layerIn(s.height, side * side); fIn = layerIn(s.flow, side * side);
      objs = s.objects || [];
    } else {
      const len = s.terrain ? s.terrain.length : 0;
      side = Math.round(Math.sqrt(len));
      if (!len || side * side !== len || side > W) { saveKeepBad(raw, '地圖尺寸不符'); return false; }
      if (!s.height || s.height.length !== len || !s.flow || s.flow.length !== len) { saveKeepBad(raw, '圖層長度不符'); return false; }
      tIn = s.terrain; hIn = s.height; fIn = s.flow;
      objs = s.objects || [];
    }
    if (side < W) savePreBackup(raw);
    const ox = (W - side) >> 1, oy = ox;
    if (world.terrain.length !== N) {
      const nb = newBoard(W);
      ['terrain', 'height', 'flow', 'block', 'zone'].forEach(k => { world[k] = nb[k]; });
    }
    world.terrain.fill(0); world.height.fill(0); world.flow.fill(0);
    world.block.fill(0); world.zone.fill(0);
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        const j = y * side + x, i = idx(x + ox, y + oy);
        world.terrain[i] = tIn[j] > T_SNOW ? T_GRASS : tIn[j]; world.height[i] = hIn[j]; world.flow[i] = fIn[j];
      }
    world.objects = objs.filter(o => o && OBJECTS[o.type])
      .map(o => {
        const r = { type: o.type, x: o.x + ox, y: o.y + oy, rot: o.rot || 0, facing: objFacing({ facing: o.facing, rot: o.rot || 0 }) };
        if (typeof o.skin === 'string' && o.skin) r.skin = o.skin;
        return r;
      });
    world.marks = newMarks();
    world.board = 'estate';
    world.stash = s.camp ? boardFromJSON(s.camp, 'camp') : null;
    world.res = Object.assign({}, START_RES, s.res);
    world.deals = normDeals(s.deals); dealCache = null;
    world.tech = normTech(s.tech); techRebuild();
    world.record = normRecord(s.record);
    world.npcBest = normNpcBest(s.npcBest);
    world.raid = normRaid(s.raid);
    if (typeof goodsNormCity === 'function') { world.city = goodsNormCity(s.city); goodsInvalidate(); }
    if (typeof techLoadFrom === 'function') techLoadFrom(s.city);   // 研發狀態 world.city.tech(citytech.js)
    nlMigrateSave(s);
    world.layoutSlots = normLayoutSlots(s.layoutSlots);
    world.layoutActive = normLayoutActive(s.layoutActive, world.layoutSlots);
    world.lastTs = s.lastTs || Date.now();
    if (s.season && PALETTES[s.season]) setSeason(s.season);
    saveBlocked = false;
    rebuildOcc();
    return true;
  } catch (e) {
    saveKeepBad(raw, '讀取錯誤');
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
  if (typeof cityGoodsOffline === 'function') cityGoodsOffline(sec);   // 生產鏈離線結算(≤ 48 步)
  if (typeof techOffline === 'function') techOffline(sec);   // 研發序列離線推進(上限 8 小時)
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

// 範本 ground 欄位的地形名稱 → 地形值(純視覺地形,見 data.js)
const TPL_GROUND = { sand: T_SAND, crack: T_CRACK, snow: T_SNOW };

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

// 範本套用：TPL_ENFORCE_LAND 為 false 時暫停城市等級規則（維持舊行為）；true 時照規則略過不放的物件
// 物件因城市等級未放置（土地外、未開放、超出等級上限）時為 true，供套用結果計數
function tplLvBlocked(type, x, y, rot) {
  if (!OBJECTS[type] || !progRulesOn()) return false;
  const fp = footprint(type, rot), cap = capOf(type);
  return !sideOk(type) || !landFits(x, y, fp[0], fp[1]) || (cap !== null && countObjects(type) >= cap);
}

function tplRun(fn) {
  const b = TPL_ENFORCE_LAND ? 0 : 1;
  landBypass += b;
  try { fn(); } finally { landBypass -= b; }
}

// 回傳 { placed, failed, ox, oy }；找不到範本或範本大於地圖回傳 null（世界不變）
function applyTemplate(id) {
  const t = TEMPLATES.find(v => v.id === id);
  if (!t || t.w > boardW() || t.h > boardH()) return null;
  const kind = t.kind || 'estate';
  // 範本只能套用到同種現役棋盤；備份中（world 是別人的地圖）不套用
  if ((game.backup && !game.backup.draft) || kind !== world.board) return null;
  if (t.legacy === 'demo' && world.board !== 'estate') return null;
  const estate = world.board === 'estate';
  const ox = (boardW() - t.w) >> 1, oy = (boardH() - t.h) >> 1;
  const keep = Object.assign({}, world.res);
  let failed = 0, lvSkip = 0;
  tplRun(() => {
    if (t.legacy === 'demo') {
      // demo 由程式產生、不經 put 計數：先以規則暫停算出應放件數，差額即城市等級略過件數
      let want = 0;
      if (TPL_ENFORCE_LAND) {
        landBypass++;
        try { loadDemo(ox, oy); want = world.objects.length; } finally { landBypass--; }
      }
      loadDemo(ox, oy);
      if (TPL_ENFORCE_LAND) lvSkip = Math.max(0, want - world.objects.length);
      failed = lvSkip;
    } else {
      if (estate) clearWorld(); else clearBoard();
      (t.heights || []).forEach(a => fillRect(ox + a[1], oy + a[2], ox + a[1] + a[3] - 1, oy + a[2] + a[4] - 1,
        (x, y) => { world.height[idx(x, y)] = Math.min(MAX_H, a[0]); }));
      (t.ground || []).forEach(op => {   // 沙地 / 裂地 / 雪地(先鋪,後面的水與路會覆蓋)
        const r = op.rect, gt = TPL_GROUND[op.t];
        if (gt !== undefined) fillRect(ox + r[0], oy + r[1], ox + r[0] + r[2] - 1, oy + r[1] + r[3] - 1, (x, y) => paintTerrain(x, y, gt, 0));
      });
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
          if (!OBJECTS[e.type] || !canPlace(e.type, x, y, rot)) {
            if (TPL_ENFORCE_LAND && tplLvBlocked(e.type, x, y, rot)) lvSkip++;
            fails.push(e.type + '@' + p[0] + ',' + p[1]);
            return;
          }
          const no = { type: e.type, x: x, y: y, rot: rot, facing: rot };
          if (typeof e.skin === 'string' && e.skin) no.skin = e.skin;
          world.objects.push(no);
          const fp = footprint(e.type, rot), n = world.objects.length;
          for (let yy = y; yy < y + fp[1]; yy++) for (let xx = x; xx < x + fp[0]; xx++) world.occ[idx(xx, yy)] = n;
        });
      });
      rebuildOcc();
      if (fails.length) console.warn('[template] ' + id + ': ' + fails.length + ' failed', fails.slice(0, 20).join(' '));
      failed = fails.length;
    }
  });
  if (estate) world.res = keep;
  if (estate) world.lastTs = Date.now();
  // 城市等級略過件數以 toast 說明(延後一拍顯示,蓋過呼叫端緊接著的「已套用」提示)
  if (lvSkip > 0 && typeof showToast === 'function') {
    const msg = lvSkip + ' 件需要研發或已達數量上限,未放置';
    if (typeof setTimeout === 'function') setTimeout(() => showToast(msg), 0); else showToast(msg);
  }
  return { placed: world.objects.length, failed: failed, skipLv: lvSkip, ox: ox, oy: oy };
}

// 範本是否放得進它那種板子(經營 EST_W、戰陣 MAP_W)
function tplFitsBoard(t) {
  const S = (t.kind || 'estate') === 'camp' ? MAP_W : EST_W;
  return t.w <= S && t.h <= S;
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

// ───── 版面存檔格與草稿(PLAN_LAYOUT §1~§2)─────
// 草稿進行中時,自己的兩個棋盤收在 game.backup(.draft 非 null),world 載入的是草稿棋盤;
// estateBoard()/campBoard()/saveWorld 因此一律取到「使用中」的棋盤,草稿不會被寫進主存檔。
const LAYOUT_SLOTS = 3;
const DRAFT_KEY = 'lorddomain.draft.v1';
let draftLastStr = '';
let draftLastMs = 0;

function newLayoutSlots() {
  return { estate: [null, null, null], camp: [null, null, null] };
}

// 版面 / 草稿 JSON 是否可用:戰陣 = MAP_W 方形數字陣列;經營 = MAP_W(舊版,讀入時置中)或 EST_W(大板 RLE)
function layoutBoardOk(j, kind) {
  if (!j || typeof j !== 'object' || j.v !== 1) return false;
  const L = ['terrain', 'height', 'flow', 'block', 'zone'];
  let side;
  if (Array.isArray(j.terrain)) {
    const n = j.terrain.length;
    side = Math.round(Math.sqrt(n));
    if (side * side !== n || !L.every(k => Array.isArray(j[k]) && j[k].length === n)) return false;
  } else {
    side = j.w;
    if (!Number.isInteger(side) || side < 1 || !L.every(k => typeof j[k] === 'string')) return false;
  }
  return kind === 'estate' ? (side === MAP_W || side === EST_W) : side === MAP_W;
}

function normLayoutSlots(v) {
  const out = newLayoutSlots();
  if (!v || typeof v !== 'object') return out;
  ['estate', 'camp'].forEach(t => {
    const a = Array.isArray(v[t]) ? v[t] : [];
    for (let n = 0; n < LAYOUT_SLOTS; n++) {
      const s = a[n];
      if (!s || typeof s !== 'object' || !layoutBoardOk(s.board, t)) continue;
      out[t][n] = {
        name: typeof s.name === 'string' && s.name ? s.name.slice(0, 20) : layoutDefaultName(t, n),
        savedAt: typeof s.savedAt === 'number' && isFinite(s.savedAt) ? s.savedAt : 0,
        board: s.board
      };
    }
  });
  return out;
}

function normLayoutActive(v, slots) {
  const out = { estate: null, camp: null };
  ['estate', 'camp'].forEach(t => {
    const n = v && typeof v === 'object' ? v[t] : null;
    if (Number.isInteger(n) && n >= 0 && n < LAYOUT_SLOTS && slots && slots[t][n]) out[t] = n;
  });
  return out;
}

function layoutDefaultName(type, n) { return (type === 'camp' ? '戰鬥 ' : '經營 ') + (n + 1); }
function layoutTypeName(type) { return type === 'camp' ? '戰鬥' : '經營'; }
function layoutSlot(type, n) {
  const a = world.layoutSlots[type];
  return a && n >= 0 && n < LAYOUT_SLOTS && a[n] ? a[n] : null;
}
function layoutObjCount(bj) { return bj && typeof bj.on === 'number' ? bj.on : (bj && Array.isArray(bj.objects) ? bj.objects.length : 0); }
// 棋盤是否有內容(任一物件或地形 / 高度 / 河流 / 標記)
function boardHasContent(bd) {
  if (!bd) return false;
  if (bd.objects && bd.objects.length) return true;
  return ['terrain', 'height', 'flow', 'block', 'zone'].some(k => {
    const a = bd[k];
    for (let i = 0; a && i < a.length; i++) if (a[i]) return true;
    return false;
  });
}
function layoutCopyBoard(bd) { return bd ? boardFromJSON(boardToJSON(bd)) : null; }
function layoutActiveBoard(type) { return type === 'camp' ? campBoard() : estateBoard(); }

// 戰鬥陣設為使用中前的驗證(validateCamp + 陣地容量 CP);合格回 '',否則回原因
function layoutCampCheck(bd) {
  let r = null;
  try { r = validateCamp(bd); } catch (e) { return '驗證時發生錯誤'; }
  if (r && r.errors.length) return '戰陣驗證失敗 ' + r.errors.length + ' 項:' + r.errors[0];
  if (typeof prog !== 'undefined' && prog && typeof progUnlockLv === 'function') {
    let sum = 0;
    (bd.objects || []).forEach(o => { const d = OBJECTS[o.type]; sum += (d && d.cb && d.cb.cp) || 0; });
    const max = campCpNow();
    if (sum > max) return '陣地容量 ' + sum + ' 超過上限 ' + max;
  }
  return '';
}

// 把使用中版面存回它所屬的格(layoutActive 指向的格);回傳是否有寫入
function layoutWriteBack(type) {
  const n = world.layoutActive[type];
  if (n === null || n === undefined) return false;
  const bd = layoutActiveBoard(type);
  if (!bd) return false;
  const old = layoutSlot(type, n);
  world.layoutSlots[type][n] = { name: old ? old.name : layoutDefaultName(type, n), savedAt: Date.now(), board: boardToJSON(bd) };
  return true;
}

// 以 bd(完整棋盤物件,呼叫端已複製)取代使用中的 type 棋盤;草稿期間寫入 game.backup 收著的那份。備份(進攻等)中回 false
function layoutInstall(type, bd) {
  const bk = game.backup;
  if (bk && !bk.draft) return false;
  if (bk) {
    if (bk.board === type) BOARD_KEYS.forEach(k => { bk.active[k] = bd[k]; });
    else bk.stash = bd;
    return true;
  }
  if (world.board === type) {
    BOARD_KEYS.forEach(k => { world[k] = bd[k]; });
    rebuildOcc();
    pendClear();
  } else {
    world.stash = bd;
  }
  return true;
}

// 切換使用中版面到第 n 格:戰鬥格先驗證(不合格不切);通過後先把目前使用中版面寫回原格,再換上該格內容並存檔
function layoutActivate(type, n) {
  if (type !== 'estate' && type !== 'camp') return { ok: false, reason: '類型錯誤' };
  const s = layoutSlot(type, n);
  if (!s) return { ok: false, reason: '該格是空的' };
  const bd = boardFromJSON(s.board, type);
  if (!bd) return { ok: false, reason: '該格資料損壞' };
  if (type === 'camp') {
    const why = layoutCampCheck(bd);
    if (why) return { ok: false, reason: why };
  }
  if (world.layoutActive[type] !== n) layoutWriteBack(type);
  if (!layoutInstall(type, bd)) return { ok: false, reason: '目前無法切換' };
  world.layoutActive[type] = n;
  saveWorld();
  return { ok: true, reason: '' };
}

// 把 bd 存進第 n 格(boardJson 為 boardToJSON 格式)
function layoutSlotWrite(type, n, boardJson) {
  const old = layoutSlot(type, n);
  world.layoutSlots[type][n] = { name: old ? old.name : layoutDefaultName(type, n), savedAt: Date.now(), board: boardJson };
}

// 草稿暫存(單一份,localStorage):{ type, board, from, savedAt };失敗或格式不符回 null
function draftRead() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || (d.type !== 'estate' && d.type !== 'camp') || !layoutBoardOk(d.board, d.type)) return null;
    return { type: d.type, board: d.board, from: typeof d.from === 'string' ? d.from : 'blank', savedAt: +d.savedAt || 0 };
  } catch (e) { return null; }
}
function draftStoreClear() {
  draftLastStr = '';
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* 略過 */ }
}
function draftWrite(type, boardJson, from) {
  if (saveSuspend) return;
  try {
    const str = JSON.stringify({ type: type, board: boardJson, from: from, savedAt: Date.now() });
    localStorage.setItem(DRAFT_KEY, str);
    draftLastStr = JSON.stringify(boardJson);
  } catch (e) { /* 儲存空間不可用時略過 */ }
}
// 草稿進行中且「有未存變更」才寫入暫存(內容沒變就不重寫);沒有變更則清掉暫存。force 略過節流
function draftPersist(force) {
  const bk = game.backup;
  if (!bk || !bk.draft) return false;
  const now = Date.now();
  if (!force && now - draftLastMs < 900) return false;
  draftLastMs = now;
  if (typeof editWorthKeeping === 'function' && !editWorthKeeping()) {
    if (draftLastStr) draftStoreClear();
    return false;
  }
  const j = boardToJSON(liveBoard());
  if (JSON.stringify(j) === draftLastStr) return false;
  draftWrite(bk.draft.type, j, bk.draft.from);
  return true;
}

// 布置模式（PLAN 12）：待購清單，不存檔、不扣款；按 ✓ 才一次購買
const PEND_MAX = 200;
// list: [{type,x,y,rot}]；occ: 待購佔格（索引+1）；diag: 依遠角對角線分組（同 world.objDiag）
// sel: 選取中的待購索引（-1 無）；moving: 選取物件是否在「等待點選新位置」
const PEND_CELLS = Math.max(MAP_W * MAP_H, EST_W * EST_H);   // 待購 / 隱藏標紅陣列取兩種板子中較大者(idx 依現役板邊長,小板只用前段)
const pend = { list: [], occ: new Int16Array(PEND_CELLS), diag: [], sel: -1, moving: false };

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
  const cap = capOf(type);
  if (cap !== null && countObjects(type) + pendCount(type, skip) >= cap) return false;
  const [w, h] = footprint(type, rot);
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const n = pend.occ[idx(xx, yy)];
      if (n && n - 1 !== skip) return false;
    }
  return true;
}

function pendAdd(type, x, y, rot, skin) {
  const p = { type: type, x: x, y: y, rot: rot };
  if (typeof skin === 'string' && skin) p.skin = skin;
  pend.list.push(p);
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
  pend.list.forEach(o => {
    const no = { type: o.type, x: o.x, y: o.y, rot: o.rot, facing: o.rot };
    if (o.skin) no.skin = o.skin;
    world.objects.push(no);
  });
  rebuildOcc();
  pendClear();
  return { ok: true, n: n, cost: total };
}

// 隱藏建築（PLAN 12.17）：不存檔。bad = 位置不合法的已建物件索引；badCell = 其佔格（渲染標紅用）
const hide = { on: false, bad: [], badCell: new Uint8Array(PEND_CELLS) };

// 已建物件 n（0 起）在目前地形上是否合法：canPlace 的規則但排除自己、不計數量上限
function objValidAt(n) {
  const o = world.objects[n], d = OBJECTS[o.type];
  const [w, h] = footprint(o.type, o.rot);
  if (o.x < 0 || o.y < 0 || o.x + w > boardW() || o.y + h > boardH()) return false;
  const h0 = world.height[idx(o.x, o.y)];
  for (let yy = o.y; yy < o.y + h; yy++) {
    for (let xx = o.x; xx < o.x + w; xx++) {
      const i = idx(xx, yy);
      if (world.occ[i] !== n + 1 || world.height[i] !== h0) return false;
      if (!terrainOn(d, world.terrain[i])) return false;
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
  if (x < 0 || y < 0 || x + w > boardW() || y + h > boardH()) return false;
  if (!landFits(x, y, w, h)) return false;
  const h0 = world.height[idx(x, y)];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = idx(xx, yy);
      if ((world.occ[i] && world.occ[i] !== n + 1) || pend.occ[i]) return false;
      if (world.height[i] !== h0) return false;
      if (!terrainOn(d, world.terrain[i])) return false;
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
  return !n || terrainOn(OBJECTS[world.objects[n - 1].type], t);
}

// 只改地形、不刪物件（paintTerrain 會無退款刪物件，隱藏模式改用此函式；呼叫前先檢查 terrainOkUnder）
function paintTerrainKeep(x, y, t, flowDir) {
  if (!landFits(x, y, 1, 1)) return false;
  const i = idx(x, y);
  world.terrain[i] = t;
  world.flow[i] = t === T_RIVER ? flowDir : 0;
  return true;
}

// 整塊升降已建物件 n（0 起）的全部佔格；成功回 ''，失敗回原因字串且不改世界
function changeHeightBlock(n, delta) {
  const o = world.objects[n];
  const [w, h] = footprint(o.type, o.rot);
  if (!landFits(o.x, o.y, w, h)) return '超出城市土地範圍';
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
