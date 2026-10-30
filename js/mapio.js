// mapio.js — 棋盤序列化與驗證(PLAN_TD_MASTER §6.1)
// 只宣告函式與常數,不執行碰 DOM 或 world 的程式。
// 執行期才使用的外部全域:MAP_W MAP_H T_LAKE T_RIVER OBJECTS footprint CAMP_CAPS CAMP_LV

const MIO_LAYERS = ['terrain', 'height', 'flow', 'block', 'zone'];
const MIO_EXTRA_KEYS = ['dev', 'trig', 'mimic'];
const MIO_K = { none: 0, wall: 1, obstacle: 2, solid: 3 };
const MIO_RING = 8;
const MIO_DX = [1, -1, 0, 0];
const MIO_DY = [0, 0, 1, -1];
const MIO_CAP_PARTS = {
  hq: ['hq'], tower: ['tower'], nutai: ['nutai'], shitai: ['shitai'],
  support: ['tent', 'wagon', 'granary'], muster: ['muster'], banner: ['banner'],
  wall: ['wall'], gate: ['gate'], fakecamp: ['fakecamp']
};

function rleEncode(arr) {
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

function rleDecode(str, n) {
  const out = new Uint8Array(n);
  let pos = 0;
  if (str) {
    str.split(',').forEach(seg => {
      const m = /^(\d+)(?:\*(\d+))?$/.exec(seg);
      if (!m) throw new Error('RLE 格式錯誤: ' + seg);
      const v = +m[1], k = m[2] ? +m[2] : 1;
      if (v > 255 || pos + k > n) throw new Error('RLE 超出長度: ' + str);
      out.fill(v, pos, pos + k);
      pos += k;
    });
  }
  if (pos !== n) throw new Error('RLE 長度不符: 得到 ' + pos + ',需要 ' + n);
  return out;
}

function mioObjFacing(o) {
  return o.facing != null ? (o.facing & 3) : ((o.rot | 0) & 3);
}

function mioFp(o) {
  return footprint(o.type, mioObjFacing(o));
}

function mioCb(type) {
  const d = OBJECTS[type];
  return (d && d.cb) || {};
}

function mioKind(type) {
  const cb = mioCb(type);
  if (cb.block === 'none') return 'none';
  if (cb.block === 'wall') return 'wall';
  if (cb.block === 'obstacle') return 'obstacle';
  return 'solid';
}

function mioLayer(bd, k) {
  return bd[k] ? bd[k] : new Uint8Array(MAP_W * MAP_H);
}

function mioEachCell(o, fn) {
  const fp = mioFp(o);
  for (let yy = o.y; yy < o.y + fp[1]; yy++)
    for (let xx = o.x; xx < o.x + fp[0]; xx++)
      if (xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H) fn(yy * MAP_W + xx);
}

function mapPack(j) {
  const p = { v: 1 };
  if (j.id !== undefined) p.id = j.id;
  if (j.name !== undefined) p.name = j.name;
  p.w = j.w || MAP_W;
  p.h = j.h || MAP_H;
  MIO_LAYERS.forEach(k => { p[k] = rleEncode(mioLayer(j, k)); });
  const groups = {}, order = [];
  (j.objects || []).forEach(o => {
    if (!groups[o.type]) { groups[o.type] = []; order.push(o.type); }
    groups[o.type].push(o);
  });
  const flat = {}, extra = [];
  let seq = 0;
  order.forEach(t => {
    const a = [];
    groups[t].forEach(o => {
      a.push(o.x, o.y, mioObjFacing(o));
      const ex = {};
      let any = false;
      MIO_EXTRA_KEYS.forEach(k => {
        if (o[k] !== undefined) { ex[k] = JSON.parse(JSON.stringify(o[k])); any = true; }
      });
      if (any) extra.push([seq, ex]);
      seq++;
    });
    flat[t] = a;
  });
  p.objects = flat;
  if (extra.length) p.extra = extra;
  if (j.marks !== undefined) p.marks = JSON.parse(JSON.stringify(j.marks));
  if (j.meta !== undefined) p.meta = JSON.parse(JSON.stringify(j.meta));
  return p;
}

function mapUnpack(p) {
  const w = p.w || MAP_W, h = p.h || MAP_H, N = w * h;
  const j = { v: p.v || 1, w: w, h: h };
  if (p.id !== undefined) j.id = p.id;
  if (p.name !== undefined) j.name = p.name;
  MIO_LAYERS.forEach(k => { j[k] = p[k] === undefined ? new Uint8Array(N) : rleDecode(p[k], N); });
  const objs = [];
  const flat = p.objects || {};
  Object.keys(flat).forEach(t => {
    const a = flat[t];
    if (a.length % 3 !== 0) throw new Error('objects 欄位數錯誤: ' + t);
    for (let k = 0; k < a.length; k += 3) {
      const f = a[k + 2] & 3;
      objs.push({ type: t, x: a[k], y: a[k + 1], rot: f, facing: f });
    }
  });
  (p.extra || []).forEach(e => {
    const o = objs[e[0]];
    if (!o) throw new Error('extra 序號超出範圍: ' + e[0]);
    MIO_EXTRA_KEYS.forEach(k => {
      if (e[1][k] !== undefined) o[k] = JSON.parse(JSON.stringify(e[1][k]));
    });
  });
  j.objects = objs;
  if (p.marks !== undefined) j.marks = JSON.parse(JSON.stringify(p.marks));
  if (p.meta !== undefined) j.meta = JSON.parse(JSON.stringify(p.meta));
  return j;
}

function mioSig(bd) {
  const objs = (bd.objects || []).map(o => o.type + ',' + o.x + ',' + o.y + ',' + mioObjFacing(o)).join(';');
  return [
    rleEncode(mioLayer(bd, 'terrain')), rleEncode(mioLayer(bd, 'height')),
    rleEncode(mioLayer(bd, 'block')), objs, JSON.stringify(bd.marks || null)
  ].join('|');
}

function mioAnalyze(bd) {
  const N = MAP_W * MAP_H;
  const terrain = mioLayer(bd, 'terrain');
  const height = mioLayer(bd, 'height');
  const block = mioLayer(bd, 'block');
  const occ = new Uint8Array(N), bridge = new Uint8Array(N), stairs = new Uint8Array(N);
  (bd.objects || []).forEach(o => {
    const code = MIO_K[mioKind(o.type)];
    mioEachCell(o, i => {
      if (code > occ[i]) occ[i] = code;
      if (o.type === 'bridge') bridge[i] = 1;
      if (o.type === 'stairs' || o.type === 'ramp') stairs[i] = 1;
    });
  });
  const pass = new Uint8Array(N), ground = new Uint8Array(N), bld = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (occ[i] === MIO_K.wall || occ[i] === MIO_K.solid) bld[i] = 1;
    if (block[i] === 1) continue;
    if (occ[i] === MIO_K.obstacle || occ[i] === MIO_K.solid) continue;
    if ((terrain[i] === T_LAKE || terrain[i] === T_RIVER) && !bridge[i]) continue;
    pass[i] = 1;
    if (occ[i] === 0) ground[i] = 1;
  }
  return { occ: occ, pass: pass, ground: ground, bld: bld, height: height, stairs: stairs };
}

function mioNearBld(bld, x, y) {
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= MAP_W || yy >= MAP_H) continue;
      if (bld[yy * MAP_W + xx]) return true;
    }
  return false;
}

function deployCells(bd, kind) {
  if (kind !== 'front' && kind !== 'flank') throw new Error('deployCells kind 錯誤: ' + kind);
  const sig = mioSig(bd);
  if (!bd.__dc || bd.__dc.sig !== sig) bd.__dc = { sig: sig, cells: {} };
  if (bd.__dc.cells[kind]) return bd.__dc.cells[kind];
  const A = mioAnalyze(bd);
  const out = new Uint8Array(MAP_W * MAP_H);
  const rects = (bd.marks && bd.marks.deploy) || [];
  if (rects.length) {
    rects.forEach(r => {
      if (kind === 'front' && r.kind !== 'front') return;
      if (kind === 'flank' && r.kind !== 'front' && r.kind !== 'flank') return;
      const x0 = Math.max(0, r.r[0]), y0 = Math.max(0, r.r[1]);
      const x1 = Math.min(MAP_W, r.r[0] + r.r[2]), y1 = Math.min(MAP_H, r.r[1] + r.r[3]);
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++)
          if (A.ground[y * MAP_W + x]) out[y * MAP_W + x] = 1;
    });
  } else {
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        if (!A.ground[i]) continue;
        if (x >= MIO_RING && y >= MIO_RING && x < MAP_W - MIO_RING && y < MAP_H - MIO_RING) continue;
        if (mioNearBld(A.bld, x, y)) continue;
        out[i] = 1;
      }
  }
  bd.__dc.cells[kind] = out;
  return out;
}

function campCapCheck(bd) {
  const have = {};
  (bd.objects || []).forEach(o => {
    const fp = mioFp(o);
    Object.keys(MIO_CAP_PARTS).forEach(key => {
      if (MIO_CAP_PARTS[key].indexOf(o.type) < 0) return;
      have[key] = (have[key] || 0) + (o.type === 'wall' ? fp[0] * fp[1] : 1);
    });
  });
  const out = [];
  Object.keys(CAMP_CAPS).forEach(key => {
    const max = CAMP_CAPS[key][CAMP_LV - 1];
    const n = have[key] || 0;
    if (n > max) out.push({ key: key, have: n, max: max });
  });
  return out;
}

function mioBfs(A, start, target, noWall) {
  const N = MAP_W * MAP_H;
  const dist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  let head = 0, tail = 0;
  for (let i = 0; i < N; i++) {
    if (!start[i] || !A.pass[i]) continue;
    if (noWall && A.occ[i] === MIO_K.wall) continue;
    dist[i] = 0;
    q[tail++] = i;
  }
  while (head < tail) {
    const c = q[head++];
    if (target[c]) return dist[c];
    const x = c % MAP_W, y = (c - x) / MAP_W;
    for (let d = 0; d < 4; d++) {
      const nx = x + MIO_DX[d], ny = y + MIO_DY[d];
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const n = ny * MAP_W + nx;
      if (dist[n] >= 0 || !A.pass[n]) continue;
      if (noWall && A.occ[n] === MIO_K.wall) continue;
      if (A.height[n] !== A.height[c] && !A.stairs[n] && !A.stairs[c]) continue;
      dist[n] = dist[c] + 1;
      q[tail++] = n;
    }
  }
  return -1;
}

function validateCamp(bd, opt) {
  const errors = [], warnings = [];
  const N = MAP_W * MAP_H;
  const A = mioAnalyze(bd);
  const objs = bd.objects || [];
  const cores = objs.filter(o => mioCb(o.type).cat === 'core');
  if (cores.length !== 1) errors.push('核心數量為 ' + cores.length + ',需剛好 1 個');

  const start = new Uint8Array(N), target = new Uint8Array(N), coreCell = new Uint8Array(N);
  cores.forEach(o => mioEachCell(o, i => { coreCell[i] = 1; }));
  for (let i = 0; i < N; i++) {
    if (!coreCell[i]) continue;
    const x = i % MAP_W, y = (i - x) / MAP_W;
    for (let d = 0; d < 4; d++) {
      const nx = x + MIO_DX[d], ny = y + MIO_DY[d];
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      if (!coreCell[ny * MAP_W + nx]) target[ny * MAP_W + nx] = 1;
    }
  }

  const front = deployCells(bd, 'front'), flank = deployCells(bd, 'flank');
  let nDeploy = 0;
  for (let i = 0; i < N; i++)
    if (front[i] || flank[i]) { start[i] = 1; nDeploy++; }
  if (nDeploy < 20) errors.push('可部署格 ' + nDeploy + ' 格,需 ≥ 20');

  if (cores.length > 0 && nDeploy > 0 && mioBfs(A, start, target, false) < 0)
    errors.push('部署區無法抵達核心(可通行路徑被懸崖、湖河或障礙封死)');

  const nAtk = objs.filter(o => mioKind(o.type) === 'solid' && mioCb(o.type).hp > 0).length;
  if (nAtk < 3) errors.push('可攻擊建築 ' + nAtk + ' 座,需 ≥ 3');

  if (!(opt && opt.noCaps)) campCapCheck(bd).forEach(c => {
    errors.push('超出數量上限: ' + c.key + ' ' + c.have + ' > ' + c.max);
  });

  if (cores.length > 0 && nDeploy > 0) {
    const d = mioBfs(A, start, target, true);
    if (d >= 0 && d < 10) warnings.push('部署區到核心不經牆的最短路僅 ' + d + ' 格(< 10)');
  }
  const zone = mioLayer(bd, 'zone');
  let zoneBad = 0;
  for (let i = 0; i < N; i++) if (zone[i] > 5) zoneBad++;
  if (zoneBad) warnings.push('zone 值 > 5 的格數: ' + zoneBad);

  return { errors: errors, warnings: warnings };
}

// ---- M2-05 快照與錄影(MASTER §3.5、§3.7、§14.4;CORE §2.4、§4.6、§4.8) ----
// 載入時只宣告;只有 replayStore* 在呼叫時才碰 localStorage(全部 try/catch,不可用時退化為記憶體)。
const SCOUT_HIDDEN_CATS = ['trap'];
const REPLAY_KEY = 'lorddomain.replays.v1';
const REPLAY_MINE_MAX = 30;
const REPLAY_OTHERS_MAX = 20;
let replayMem = null;

function scoutVisible(type) {
  const d = OBJECTS[type];
  const cb = d && d.cb;
  if (!cb) return true;
  if (cb.scout !== undefined) return cb.scout;
  return SCOUT_HIDDEN_CATS.indexOf(cb.cat) < 0;
}

function mioSimVer() { return typeof SIM_VER !== 'undefined' ? SIM_VER : 1; }
function mioHz() { return typeof SIM_HZ !== 'undefined' ? SIM_HZ : 10; }
function mioDeep(v) { return JSON.parse(JSON.stringify(v)); }

// 隱藏物件排序鍵:數字 dev 取其值;物件 dev 取 id;其餘為 0(同鍵依原順序)
function snapDevKey(o) {
  if (typeof o.dev === 'number') return o.dev;
  if (o.dev && typeof o.dev.id === 'number') return o.dev.id;
  return 0;
}

function snapHashOf(scout, hidden) {
  const h = hashStr(JSON.stringify({ scout: scout, hidden: hidden }));
  return ('00000000' + h.toString(16)).slice(-8);
}

// bj:boardJSON;defId:{pid,name};ts 省略時取現在時間(只在呼叫時取值)
function snapSplit(bj, defId, ts) {
  const vis = [], hid = [];
  (bj.objects || []).forEach((o, idx) => { (scoutVisible(o.type) ? vis : hid).push({ o: o, idx: idx }); });
  hid.sort((p, q) => (snapDevKey(p.o) - snapDevKey(q.o)) || (p.idx - q.idx));
  const scout = mioDeep(Object.assign({}, bj, { objects: vis.map(e => e.o) }));
  const hidden = { objects: mioDeep(hid.map(e => e.o)) };
  return {
    sv: 2, simVer: mioSimVer(), def: defId ? { pid: defId.pid, name: defId.name } : null,
    ts: ts != null ? ts : Date.now(), snapHash: snapHashOf(scout, hidden), intel: { mode: 'hidden' },
    scout: scout, hidden: hidden
  };
}

function snapScoutView(snap) {
  return mioDeep(snap.scout);
}

// 物件順序:scout.objects 在前、hidden.objects(已依 dev 排序)在後
function snapFull(snap) {
  const j = mioDeep(snap.scout);
  const hid = (snap.hidden && snap.hidden.objects) || [];
  j.objects = (j.objects || []).concat(mioDeep(hid));
  return j;
}

// rev:b.revealed,可為物件(dev → true)、Map 或陣列;缺省視為空
function replayRevealed(rev, dev) {
  if (!rev) return false;
  if (typeof Map !== 'undefined' && rev instanceof Map) return rev.has(dev);
  if (Array.isArray(rev)) return rev.indexOf(dev) >= 0;
  return !!rev[dev];
}

function snapTrim(snap, rev) {
  const t = mioDeep(snap);
  const hid = ((snap.hidden && snap.hidden.objects) || []).filter(o => replayRevealed(rev, o.dev));
  t.hidden = { objects: mioDeep(hid) };
  return t;
}

// 與 battleChecksum 同式,但略過仍隱藏(hidden===true)的 bld:未揭露的裝置不在修剪後快照中,不得影響驗證
function mioChecksum(b) {
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
    if (bl.hidden === true) continue;
    h = tdHash(h, Math.round(bl.hp * 100));
    h = tdHash(h, bl.alive ? 1 : 0);
  }
  return h >>> 0;
}

function mioStarsOf(b) {
  const pct = b.result && b.result.pct != null ? b.result.pct : 0;
  let core = false;
  b.bld.forEach(bl => { if (bl.cb && bl.cb.cat === 'core' && !bl.alive) core = true; });
  return (core ? 1 : 0) + (pct >= 0.5 ? 1 : 0) + (pct >= 1 ? 1 : 0);
}

function mioDeployPop(b) {
  let n = 0;
  (b.events || []).forEach(ev => {
    if (ev.type !== 'deploy' || !ev.data) return;
    const d = UNITS[ev.data.u];
    n += d && d.squad ? d.squad : 1;
  });
  return n;
}

// 文字戰報:REPORT_TEXT(npc.js)若存在,依事件型別取句,最多 12 行
function mioReportLines(b) {
  const out = [];
  if (typeof REPORT_TEXT === 'undefined' || !REPORT_TEXT) return out;
  (b.events || []).forEach(ev => {
    if (out.length >= 12) return;
    const t = REPORT_TEXT[ev.type];
    if (typeof t !== 'string') return;
    const d = ev.data || {};
    out.push(t.replace(/\{(unit|bld|n)\}/g, (m, k) => (d[k] != null ? String(d[k]) : '')));
  });
  return out;
}

// 精采度(MASTER §14.4);第一階段只用錄影內資料。timeout 不算壓哨(剩餘 0 秒無意義)
function replayScore(replay) {
  const r = replay.result || {};
  const stars = r.stars | 0;
  let s = stars * 100 + (r.pct | 0) + 15 * (r.traps | 0);
  if (stars >= 1 && r.reason !== 'time' && r.remain != null && r.remain <= 10) s += 30;
  if (stars >= 2 && r.pop != null && r.pop <= 40) s += 40;
  return s;
}

// b:已結束的戰鬥(battleInit 產生並跑完);snap:原戰帖快照;meta:{ atk, ts, grade, cmds }
// cmds 來源:meta.cmds > b.cmdLog > b.cmds(td.js 套用後會清空 b.cmds,故需 cmdLog)
function replayMake(b, snap, meta) {
  meta = meta || {};
  const rev = b.revealed || {};
  const trimmed = snapTrim(snap, rev);
  const cmds = mioDeep(meta.cmds || b.cmdLog || b.cmds || []);
  const army = b.army.map(k => [k.u, k.part, k.n]);
  const r = b.result || {};
  const tick = r.tick != null ? r.tick : b.tick;
  const hz = mioHz();
  const stars = mioStarsOf(b);
  const pct = Math.round((r.pct != null ? r.pct : 0) * 100);
  const result = {
    stars: stars, pct: pct, grade: meta.grade || null, reason: r.reason || null,
    dur: Math.round(tick / hz * 10) / 10,
    remain: Math.max(0, Math.round((b.limitTick - tick) / hz * 10) / 10),
    pop: mioDeployPop(b), traps: trimmed.hidden.objects.length
  };
  const base = {
    v: mioSimVer(), kind: b.kind, refId: b.refId || null, atk: meta.atk || null, def: snap.def || null,
    snapHash: snap.snapHash, result: result, merits: stars, checksum: mioChecksum(b),
    ts: meta.ts != null ? meta.ts : Date.now()
  };
  const lines = ['結果 ' + stars + ' 星,摧毀 ' + pct + '%'].concat(mioReportLines(b));

  let ok = false;
  try {
    const init = {
      kind: b.kind, seed: b.seed, refId: b.refId || null, map: snapFull(trimmed),
      army: army.map(a => ({ u: a[0], part: a[1], n: a[2] }))
    };
    const re = runHeadless(init, cmds, b.limitTick);
    ok = mioChecksum(re) === base.checksum;
  } catch (e) {
    ok = false;
  }

  if (ok) {
    const replay = Object.assign(base, { snap: trimmed, seed: b.seed, army: army, cmds: cmds, text: lines });
    replay.score = replayScore(replay);
    return { replay: replay, ok: true };
  }
  console.warn('[replay] 修剪後重跑 checksum 不符,只保存文字戰報');
  const text = Object.assign(base, { text: lines });
  text.score = replayScore(text);
  return { replay: text, ok: false };
}

// ---- 錄影本機庫(MASTER §3.7) ----
function replayNewStore() {
  return { v: 1, mine: [], others: [], best: { day: null, week: null, month: null } };
}

function replayNormalize(v) {
  const s = replayNewStore();
  if (!v || typeof v !== 'object' || v.v !== 1) return s;
  if (Array.isArray(v.mine)) s.mine = v.mine;
  if (Array.isArray(v.others)) s.others = v.others;
  if (v.best && typeof v.best === 'object') {
    ['day', 'week', 'month'].forEach(k => { if (v.best[k] && typeof v.best[k] === 'object') s.best[k] = v.best[k]; });
  }
  return s;
}

function replayStoreLoad() {
  if (replayMem) return replayMem;
  let v = null;
  try { v = JSON.parse(localStorage.getItem(REPLAY_KEY) || 'null'); } catch (e) { v = null; }
  replayMem = replayNormalize(v);
  return replayMem;
}

function replayPad(n) { return (n < 10 ? '0' : '') + n; }
function replayDayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + replayPad(d.getMonth() + 1) + '-' + replayPad(d.getDate());
}
function replayMonthKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + replayPad(d.getMonth() + 1);
}
// ISO 週:取該週的週四決定年份與週次
function replayWeekKey(ts) {
  const d = new Date(ts);
  const mon = (d.getDay() + 6) % 7;
  const thu = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mon + 3);
  const y = thu.getFullYear();
  const doy = Math.round((thu - new Date(y, 0, 1)) / 86400000) + 1;
  return y + '-W' + replayPad(Math.floor((doy - 1) / 7) + 1);
}

function replayFind(st, id) {
  let hit = null;
  st.mine.concat(st.others).forEach(r => { if (!hit && r.id === id) hit = r; });
  return hit;
}

function replayDropDangling(st) {
  ['day', 'week', 'month'].forEach(k => {
    const p = st.best[k];
    if (p && !replayFind(st, p.id)) st.best[k] = null;
  });
}

function replayOldestIdx(list) {
  let idx = -1;
  for (let i = 0; i < list.length; i++) {
    if (idx < 0 || (list[i].ts || 0) < (list[idx].ts || 0)) idx = i;
  }
  return idx;
}

function replayCap(list, max) {
  while (list.length > max) list.splice(replayOldestIdx(list), 1);
}

// 期間 key 較新者換新;同期間依 score 較高者取代,同分取較新
function replayUpdateBest(st, rep) {
  const keys = { day: replayDayKey(rep.ts), week: replayWeekKey(rep.ts), month: replayMonthKey(rep.ts) };
  ['day', 'week', 'month'].forEach(k => {
    const cur = st.best[k];
    if (!cur || cur.key < keys[k]) { st.best[k] = { key: keys[k], id: rep.id }; return; }
    if (cur.key > keys[k] || cur.id === rep.id) return;
    const c = replayFind(st, cur.id);
    if (!c || rep.score > c.score || (rep.score === c.score && rep.ts > c.ts)) st.best[k] = { key: keys[k], id: rep.id };
  });
}

function replayRawSet(raw) {
  try { localStorage.setItem(REPLAY_KEY, raw); return true; } catch (e) { return false; }
}

// 寫入失敗:刪 others 最舊一筆後再試一次;仍失敗回 ok:false(記憶體內仍保留)
function replayStoreSave() {
  const st = replayStoreLoad();
  if (typeof localStorage === 'undefined') return { ok: false, mem: true, reason: 'nostorage' };
  let raw = null;
  try { raw = JSON.stringify(st); } catch (e) { return { ok: false, mem: true, reason: 'json' }; }
  if (replayRawSet(raw)) return { ok: true, mem: false, dropped: 0 };
  if (st.others.length) {
    st.others.splice(replayOldestIdx(st.others), 1);
    replayDropDangling(st);
    try { raw = JSON.stringify(st); } catch (e) { return { ok: false, mem: true, reason: 'json' }; }
    if (replayRawSet(raw)) return { ok: true, mem: false, dropped: 1 };
  }
  return { ok: false, mem: true, reason: 'quota' };
}

// side:'atk' | 'def' → mine;'other' → others。回 { id, kept, textOnly, save }
function replayStoreAdd(replay, side) {
  const st = replayStoreLoad();
  if (side !== 'atk' && side !== 'def' && side !== 'other') return { id: null, kept: false, textOnly: false, save: null };
  const rep = Object.assign({}, replay, { side: side });
  rep.ts = rep.ts != null ? rep.ts : Date.now();
  rep.id = rep.id || (rep.snapHash + ':' + rep.ts);
  if (rep.seen === undefined) rep.seen = side !== 'def';
  if (typeof rep.score !== 'number') rep.score = replayScore(rep);

  st.mine = st.mine.filter(r => r.id !== rep.id);
  st.others = st.others.filter(r => r.id !== rep.id);
  const list = side === 'other' ? st.others : st.mine;
  list.push(rep);
  replayCap(list, side === 'other' ? REPLAY_OTHERS_MAX : REPLAY_MINE_MAX);
  replayDropDangling(st);
  if (replayFind(st, rep.id)) replayUpdateBest(st, rep);

  let save = replayStoreSave();
  let textOnly = false;
  if (!save.ok && save.reason === 'quota') {
    delete rep.snap; delete rep.cmds; delete rep.army; delete rep.seed;
    rep.textOnly = true;
    textOnly = true;
    save = replayStoreSave();
  }
  return { id: rep.id, kept: replayFind(st, rep.id) !== null, textOnly: textOnly, save: save };
}
