// citygather.js — 城市聚集行為 P2 + P3 + P4(PLAN_CITYLIFE_GATHER.md §4):下棋、路邊休息;P3 告示(宣讀者 + 讀者)、叫賣(叫賣者 + 圍觀 / 成交);P4 看戲(百戲:擊鼓、跳丸、鼓掌;說書)。聚集成員就是 LIFE.npcs 裡的居民(算居民額度,不增加總人數)。
// 告示 / 看戲 / 叫賣與下棋同屬「有劇本的組」(gthIsGame):每 15 分鐘時段以種子排一場(起訖與內容確定),場次內主角留在站位上、觀眾半圓站位輪替。
// P5:名人 / 名冊人物站停時 8 格內有聚集會當觀眾(gthFamousTick,n.gSv 還原行程);亭卒 bailiff(ext,張貼階段來,gthBailSpawn);臨時告示板(路口空地,gthMakeTemp notice);叫好(看戲小卡按鈕,gatherCheer,每場 1 次、每日上限);夜市攤(lifeNightStall,只在夜間)與夜戲(圈地旁有燈)、夜間光暈(省電關閉)。
// 下棋:場景觸發物件 yi_zuo / stone_table / tbl_chess / tbl_stone;2 人對弈(坐姿)+ 圍觀 0~6 人半圓站位;白天傍晚;一局 90~240 秒,局間冷卻 30~90 秒;
//   排程 = 純函式 hash(世界, 道路簽章, 日, 15 分鐘時段, 棋桌),所以同一時段重開 / 朋友參觀看到同一場棋局(含已下了幾手);沒有棋桌物件時退用路邊空地的臨時麻布棋盤。
// 路邊休息:長凳 / 石凳 / 矮凳 / 胡床 / 樹蔭 / 槐蔭石台 / 井邊 / 涼棚茶座 / 港口貨堆;有人坐著聊天、打盹、乘涼;沒有座椅物件時退用路沿空地坐地。
// 只維護「畫面附近」的聚集(畫面外的組直接解散,成員改回一般居民行程);組池固定 8 組、成員 / 站位預先配置;等級上限見 GATHER_CAP。
// 掛點(citylife.js,皆 typeof 守護):lifeRebuild → gatherBuild;lifeReset → gatherReset;lifePrefill → gatherPrefill;lifeFrame → gatherTick;lifeDrawDiag → gatherDraw;
//   lifeDrawOne → gatherPose;lifeTap → gatherTap;lifeCardShow / lifeGreetNext → gatherCardHide / gatherLines / gatherActText;lifeRetire 第 1 輪略過聚集成員。
// 零數據影響:不讀寫 world 數據、不寫存檔、不給獎勵;不發聲。ES2017;不用 ?. ??。全域名稱:GATHER gatherBuild gatherReset gatherPrefill gatherTick gatherDraw gatherPose gatherTap gatherLines gatherActText gatherCardHide gatherStats gatherForce gatherNow gatherCheer gatherCheering

const GATHER_POOL = 8, GATHER_SLOTS = 24, GATHER_PROP_MAX = 48;
const GATHER_SLOT_MS = 900000;   // 15 分鐘時段
const GATHER_LOOKS = {
  player: ['scholar', 'elder', 'man', 'man2'],
  watch:  ['man', 'man2', 'woman', 'woman2', 'elder', 'scholar', 'kid', 'kid2'],
  sit:    ['man', 'man2', 'woman', 'woman2', 'elder'],
  porter: ['coolie_free'],
  speak:  ['scholar', 'elder', 'man'],        // 宣讀者 / 叫賣者
  perform: ['man', 'man2', 'woman2']          // 百戲表演者(擊鼓、跳丸)
};
const GATHER_TYPE_OF = { man: 'civ', man2: 'civ', woman: 'civ', woman2: 'civ', elder: 'elder', scholar: 'scholar', kid: 'kid', kid2: 'kid', coolie_free: 'coolie' };
const GATHER_WALKER_OK = {   // 可被招募的一般居民類型(沒有扛鋤 / 挑擔的手持物,坐下不突兀)
  player: { civ: 1, elder: 1, scholar: 1 }, watch: { civ: 1, elder: 1, scholar: 1, kid: 1 }, sit: { civ: 1, elder: 1, scholar: 1 }, stand: { civ: 1, elder: 1, scholar: 1, farmer: 1 },
  speak: { civ: 1, elder: 1, scholar: 1 }, perform: { civ: 1 }
};

const GATHER = {
  inited: false, spots: [], pool: [], clock: 0, tickT: 0, built: false, members: 0, groupsOn: 0, fakeNow: 0,
  tier: 'mid', cap: GATHER_CAP.mid, perMax: 16, watchMax: 4, pbuck: [], poseSpecs: {}, poseN: 0, base: 0, sig: -1,
  stats: { groups: 0, members: 0, props: 0, tickMs: 0, drawMs: 0, specsWithPose: 0 }, propN: 0, drawAcc: 0, tickAcc: 0,
  cardEl: null, cardCv: null, force: '', pending: '', prefilling: false, tmpGame: null, lastD: 1e9, propLast: 0, snap: false,
  cheerEl: null, cheerBox: null, cardG: null, cheerDay: -1, cheerN: 0, lampN: -1
};
if (typeof LIFE_TYPES !== 'undefined' && !LIFE_TYPES.bailiff) LIFE_TYPES.bailiff = { name: '亭卒', looks: ['man'], w: 0, spd: 0.8, to: {} };   // 衙役(ext,不占居民額度,見 gthBailSpawn)
let GTH_BAIL_SPEC = null;

function gatherNow() { return GATHER.fakeNow || Date.now(); }
function gthStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
function gthRnd(seed, k) { return lifeHash(seed, k) / 4294967296; }
function gthLerp(a, b, t) { return a + (b - a) * t; }

function gthNewGroup(id) {
  return { id: id, on: false, kind: '', sp: null, game: null, seed: 0, iv: 6, gt0: 0, clk0: 0, closing: false, forced: false, n: 0, wantW: 0, nextRec: 0, openAt: 0,
    cheered: false, cheerAt: -99, bailWant: false, bailDone: false,
    mem: new Array(GATHER_SLOTS).fill(null), until: new Float32Array(GATHER_SLOTS), mst: new Uint8Array(GATHER_SLOTS), mrole: new Uint8Array(GATHER_SLOTS), pd: -1, lastPiece: 0 };
}
(function () { for (let i = 0; i < GATHER_POOL; i++) GATHER.pool.push(gthNewGroup(i + 1)); })();

function gthInit() {
  GATHER.inited = true;
  try {
    const m = (typeof location !== 'undefined' && location && location.search) ? /(^|[?&])gather=([a-z]+)/.exec(location.search) : null;
    if (m) GATHER.pending = m[2];
  } catch (e) { GATHER.pending = ''; }
}

// ───────── 等級上限 ─────────
function gthTier() {
  if (typeof isPowerSave === 'function' && isPowerSave()) return 'save';
  if (typeof lifeLowEnd === 'function' && lifeLowEnd()) return 'low';
  if (LIFE.density === 'low') return 'few';
  if (LIFE.density === 'high' || LIFE.density === 'crowd') return 'high';
  return 'mid';
}
function gthCapUpdate() {
  GATHER.tier = gthTier();
  const c = GATHER_CAP[GATHER.tier];
  GATHER.cap = c;
  GATHER.perMax = LIFE.level >= 4 ? Math.max(4, Math.floor(c.per * 0.7)) : c.per;   // 降載 L4 起單組 ×0.7(核心 2 人保留)
  GATHER.watchMax = Math.min(c.watch, Math.max(0, GATHER.perMax - 2));
}
function gthMemberCap() {
  const base = (GATHER.prefilling || LIFE.live <= 0) ? LIFE.target : LIFE.live;
  return Math.min(GATHER.cap.members, Math.floor(Math.max(base, GATHER_MEMBER_BASE[GATHER.tier]) * GATHER_MEMBER_RATIO[GATHER.tier] + 0.5));
}
// 閘門:拍照 / 錄影 / 全景不畫提示圖示(人與棋局照畫)
function gthUiOk() {
  if (LIFE.placing) return false;
  if (typeof uiIsPhoto === 'function' && uiIsPhoto()) return false;
  if (typeof REC !== 'undefined' && REC && (REC.state === 'recording' || REC.state === 'countdown' || REC.state === 'plan')) return false;
  if (typeof pano !== 'undefined' && pano && pano.open) return false;
  return true;
}
function gthZoom() { return (typeof pano !== 'undefined' && pano && pano.open) ? Math.max(view.zoom, 0.5) : view.zoom; }
function gthVis(sp, m) {
  if (!(viewport.w > 0)) return true;
  const s = worldToScreen(sp.px, sp.py);
  return s[0] > -m && s[0] < viewport.w + m && s[1] > -m && s[1] < viewport.h + m;
}
function gthDist2(sp) {   // 到畫面中心的距離平方(開組排序用)
  if (!(viewport.w > 0)) return 0;
  const s = worldToScreen(sp.px, sp.py), dx = s[0] - viewport.w / 2, dy = s[1] - viewport.h / 2;
  return dx * dx + dy * dy;
}

// ───────── 聚集點建置(只在道路圖重建時跑) ─────────
function gthRoadNear(cx, cy, fw, fh, hb, ok) {
  const R = LIFE.road, x0 = Math.floor(cx - fw / 2), y0 = Math.floor(cy - fh / 2);
  let best = -1, bd = 1e9;
  for (let y = y0 - 2; y <= y0 + fh + 1; y++) {
    for (let x = x0 - 2; x <= x0 + fw + 1; x++) {
      if (x < 0 || y < 0 || x >= boardW() || y >= boardH()) continue;
      const i = idx(x, y);
      if (!ok[i] || world.height[i] !== hb || !R.nb) continue;
      const d = Math.abs(x + 0.5 - cx) + Math.abs(y + 0.5 - cy);
      if (d < bd) { bd = d; best = i; }
    }
  }
  return best;
}
function gthStandOk(x, y, hb) {
  return typeof lifeStandOk === 'function' ? lifeStandOk(Math.floor(x), Math.floor(y), hb) : false;
}
function gthObjAt(cx, cy) {
  if (cx < 0 || cy < 0 || cx >= boardW() || cy >= boardH()) return null;
  const n = world.occ[idx(cx, cy)];
  return n ? world.objects[n - 1] : null;
}
function gthSlot(x, y, fx, fy, o) {
  const s = { x: x, y: y, fx: fx, fy: fy, sit: false, onObj: false, gz: 0, dO: 0 };
  if (o) for (const k in o) s[k] = o[k];
  return s;
}
// 圍觀 / 站立站位:繞焦點的兩圈(r1、r2),略過座位方向;回傳依「兩側優先」排序的站位
function gthRing(cx, cy, r1, hb, seatAxes, maxN, excl) {
  const out = [];
  for (let ring = 0; ring < 2; ring++) {
    const r = r1 + ring * 0.5, n = ring === 0 ? 10 : 14;
    for (let i = 0; i < n; i++) {
      const a = (i + ring * 0.5) * Math.PI * 2 / n, dx = Math.cos(a), dy = Math.sin(a) * 0.9;
      const x = cx + dx * r, y = cy + dy * r;
      let bad = false, sc = 0;
      for (let k = 0; k < seatAxes.length; k++) { const dd = Math.abs(dx * seatAxes[k][0] + (dy / 0.9) * seatAxes[k][1]); if (dd > 0.82) bad = true; sc = Math.max(sc, dd); }
      if (bad || !gthStandOk(x, y, hb)) continue;
      if (excl) { const o = gthObjAt(Math.floor(x), Math.floor(y)); if (o && excl.indexOf(o) >= 0) continue; }
      out.push({ x: x, y: y, key: ring * 10 + sc });
    }
  }
  out.sort(function (a, b) { return a.key - b.key; });
  return out.slice(0, maxN);
}

function gthMakeChess(o, oi, info, fp, ok, claimed) {
  const hb = world.height[idx(o.x, o.y)], fw = fp[0], fh = fp[1], cx = o.x + fw / 2, cy = o.y + fh / 2;
  const road = gthRoadNear(cx, cy, fw, fh, hb, ok);
  if (road < 0) return null;
  const sp = { k: 'chess', type: o.type, key: gthStr(o.type + '@' + o.x + ',' + o.y), oi: oi, cx: cx, cy: cy, fw: fw, fh: fh, hb: hb, road: road,
    diag: (o.x + fw - 1) + (o.y + fh - 1), px: isoX(cx, cy), py: isoY(cx, cy, hb), bz: info.bz || 14, slots: [], w: info.w || 1, tmp: false, lamp: false, trait: 'chess', np: 2 };
  let axes;
  if (info.seatObj) {   // yi_zuo:兩個石墩在長軸兩端
    const ax = fw >= fh ? [1, 0] : [0, 1];
    sp.slots.push(gthSlot(cx - ax[0] * 0.62, cy - ax[1] * 0.62, ax[0], ax[1], { sit: true, onObj: true, gz: 6, dO: sp.diag }));
    sp.slots.push(gthSlot(cx + ax[0] * 0.62, cy + ax[1] * 0.62, -ax[0], -ax[1], { sit: true, onObj: true, gz: 6, dO: sp.diag }));
    axes = [ax];
  } else {   // 桌類:找相對的一對鄰格(石凳優先,其次可站的空格坐地)
    const pairs = [[[-1, 0], [1, 0]], [[0, -1], [0, 1]]];
    let best = null, bs = -1;
    for (let p = 0; p < 2; p++) {
      const pr = pairs[(p + (sp.key & 1)) % 2], sd = [];
      let score = 0, okp = true;
      for (let s = 0; s < 2; s++) {
        const nx = o.x + pr[s][0], ny = o.y + pr[s][1], ob = gthObjAt(nx, ny);
        if (ob) {
          const oinf = gatherObjInfo(ob.type), ofp = footprint(ob.type, ob.rot);
          if (oinf && oinf.k === 'rest' && oinf.seats === 1 && ofp[0] === 1 && ofp[1] === 1 && claimed[world.occ[idx(nx, ny)] - 1] === undefined) {
            sd.push({ x: nx + 0.5, y: ny + 0.5, ob: world.occ[idx(nx, ny)] - 1, gz: oinf.gz || 7 }); score += 2;
          } else okp = false;
        } else if (gthStandOk(nx, ny, hb)) {
          sd.push({ x: cx + pr[s][0] * 0.62, y: cy + pr[s][1] * 0.62, ob: -1, gz: 0 }); score += 1;
        } else okp = false;
      }
      if (okp && score > bs) { bs = score; best = { pr: pr, sd: sd }; }
    }
    if (!best) return null;
    for (let s = 0; s < 2; s++) {
      const d = best.sd[s], pr = best.pr[s];
      sp.slots.push(gthSlot(d.x, d.y, -pr[0], -pr[1], { sit: true, onObj: d.ob >= 0, gz: d.gz, dO: d.ob >= 0 ? (Math.floor(d.x) + Math.floor(d.y)) : 0 }));
      if (d.ob >= 0) claimed[d.ob] = true;
    }
    axes = [best.pr[1]];
  }
  const r1 = Math.max(fw, fh) / 2 + 0.55, ring = gthRing(cx, cy, r1, hb, axes, 12, null);
  for (let i = 0; i < ring.length; i++) sp.slots.push(gthSlot(ring[i].x, ring[i].y, cx - ring[i].x, cy - ring[i].y, null));
  return sp;
}

function gthMakeRest(o, oi, info, fp, ok) {
  const hb = world.height[idx(o.x, o.y)], fw = fp[0], fh = fp[1], cx = o.x + fw / 2, cy = o.y + fh / 2;
  const road = gthRoadNear(cx, cy, fw, fh, hb, ok);
  if (road < 0) return null;
  const trait = info.shade ? 'shade' : info.well ? 'well' : info.cargo ? 'cargo' : info.tea ? 'tea' : 'rest';
  const sp = { k: 'rest', type: o.type, key: gthStr(o.type + '@' + o.x + ',' + o.y), oi: oi, cx: cx, cy: cy, fw: fw, fh: fh, hb: hb, road: road,
    diag: (o.x + fw - 1) + (o.y + fh - 1), px: isoX(cx, cy), py: isoY(cx, cy, hb), bz: info.big ? 10 : 6, slots: [], w: info.w || 1, tmp: false, lamp: false, trait: trait, night: !!(info.well || info.tea), np: 0 };
  const sitters = info.seats | 0;
  if (sitters > 0) {
    const ax = fw >= fh ? [1, 0] : [0, 1];
    let pf = [-ax[1], ax[0]];
    if (pf[0] + pf[1] < 0) pf = [-pf[0], -pf[1]];   // 面向開口(朝鏡頭側)
    for (let i = 0; i < sitters; i++) {
      let x, y;
      if (info.big) {   // 2×2 大件:座位落在物件內側的四個角附近
        const q = [[0.62, 0.12], [0.12, 0.62], [-0.62, 0.1], [0.1, -0.62]][i % 4];
        x = cx + q[0]; y = cy + q[1];
      } else {
        const off = (i - (sitters - 1) / 2) * 0.7;
        x = cx + ax[0] * off; y = cy + ax[1] * off;
      }
      sp.slots.push(gthSlot(x, y, pf[0] + (info.big ? 0.3 : 0), pf[1] + (info.big ? 0.3 : 0), { sit: true, onObj: true, gz: info.gz || 6, dO: sp.diag }));
    }
  } else if (info.shade || info.well || info.tea) {   // 站著:樹蔭四周 / 井邊 / 茶座旁
    const r1 = Math.max(fw, fh) / 2 + (info.shade ? 0.5 : 0.6), ring = gthRing(cx, cy, r1, hb, [], info.well ? 3 : info.tea ? 2 : 3, null);
    const pick = [];
    for (let i = 0; i < ring.length && pick.length < (info.well ? 3 : info.tea ? 2 : 3); i++) {
      let far = true;
      for (let k = 0; k < pick.length; k++) if (Math.abs(pick[k].x - ring[i].x) + Math.abs(pick[k].y - ring[i].y) < 0.9) far = false;
      if (far) pick.push(ring[i]);
    }
    for (let i = 0; i < pick.length; i++) sp.slots.push(gthSlot(pick[i].x, pick[i].y, cx - pick[i].x, cy - pick[i].y, null));
  }
  return sp.slots.length ? sp : null;
}

// 是否為「有劇本的組」(下棋 / 告示 / 看戲 / 叫賣):每時段以種子排場次,主角(role 1)留在站位上,觀眾(role 2)輪替
function gthIsGame(k) { return k === 'chess' || k === 'notice' || k === 'show' || k === 'market'; }
function gthIsCrowd(k) { return k === 'notice' || k === 'show' || k === 'market'; }
// 正面半圓站位:(nx, ny) 為正面法線,角度離正面近者優先;兩排(r1、r1 + 0.5),每排 11 點,點距 ≈ 0.3 弧度
function gthArc(cx, cy, r1, hb, nx, ny, maxN) {
  const out = [], base = Math.atan2(ny, nx);
  for (let ring = 0; ring < 2; ring++) {
    const r = r1 + ring * 0.5;
    for (let j = -5; j <= 5; j++) {
      const k = j + ring * 0.5, a = base + k * 0.3;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.9;
      if (!gthStandOk(x, y, hb)) continue;
      out.push({ x: x, y: y, key: ring * 10 + Math.abs(k) });
    }
  }
  out.sort(function (a, b) { return a.key - b.key; });
  return out.slice(0, maxN);
}
// 告示 / 看戲 / 叫賣的聚集點:正面朝最近道路;主角站在正前方(表演者 / 宣讀者 / 叫賣者),觀眾在其外的半圓上
function gthMakeCrowd(o, oi, info, fp, ok) {
  const hb = world.height[idx(o.x, o.y)], fw = fp[0], fh = fp[1], cx = o.x + fw / 2, cy = o.y + fh / 2;
  const road = gthRoadNear(cx, cy, fw, fh, hb, ok);
  if (road < 0) return null;
  const W = boardW(), rx = (road % W) + 0.5 - cx, ry = Math.floor(road / W) + 0.5 - cy, rl = Math.sqrt(rx * rx + ry * ry) || 1;
  const nx = rx / rl, ny = ry / rl, tx = -ny, ty = nx;
  const sp = { k: info.k, type: o.type, key: gthStr(o.type + '@' + o.x + ',' + o.y), oi: oi, cx: cx, cy: cy, fw: fw, fh: fh, hb: hb, road: road,
    diag: (o.x + fw - 1) + (o.y + fh - 1), px: isoX(cx, cy), py: isoY(cx, cy, hb), bz: info.big ? 10 : 6, slots: [], w: info.w || 1, tmp: false, lamp: false,
    trait: info.story ? 'story' : info.k, night: false, np: 0, pk: '', nx: nx, ny: ny, nst: info.nstall ? 1 : 0 };
  const half = Math.max(fw, fh) / 2, big = !!info.big, dO = sp.diag, r0 = half + 0.45;
  // 站在地面的主角:前方那一格不能站(屋、水…)就退到道路格中心(宣讀者 / 叫賣者站在路邊)
  const rcx = (road % W) + 0.5, rcy = Math.floor(road / W) + 0.5;
  const ground = function (x, y) { return gthStandOk(x, y, hb) ? [x, y] : [rcx, rcy]; };
  if (info.story) {   // 說書人:坐在台上長案後,面向前方聽眾
    sp.slots.push(gthSlot(cx - nx * 0.3, cy - ny * 0.3, nx, ny, { sit: true, onObj: true, gz: 6, dO: dO }));
    sp.pk = 'sit'; sp.np = 1;
  } else if (info.pair) {   // 兩名表演者(擊鼓、跳丸):台上 / 圈內並排;沒有台時站在前方
    for (let s = -1; s <= 1; s += 2) {
      const p = big ? [cx + tx * 0.4 * s, cy + ty * 0.4 * s] : ground(cx + nx * r0 + tx * 0.4 * s, cy + ny * r0 + ty * 0.4 * s);
      sp.slots.push(gthSlot(p[0], p[1], nx, ny, { onObj: big, gz: big ? 8 : 0, dO: big ? dO : 0 }));
    }
    sp.pk = 'perform'; sp.np = 2;
  } else if (info.crier) {   // 叫賣者:叫賣台上的前緣,或攤位正前方
    if (big) sp.slots.push(gthSlot(cx + nx * 0.3, cy + ny * 0.3, nx, ny, { onObj: true, gz: 8, dO: dO }));
    else { const p = ground(cx + nx * r0, cy + ny * r0); sp.slots.push(gthSlot(p[0], p[1], nx, ny, null)); }
    sp.pk = 'speak'; sp.np = 1;
  } else if (info.nolead) {   // 夜市攤:攤主是街景叫賣者(citytraffic.js),聚集只排圍觀者
    sp.pk = ''; sp.np = 0;
  } else {   // 告示:宣讀者站在告示前方
    const p = ground(cx + nx * r0, cy + ny * r0);
    sp.slots.push(gthSlot(p[0], p[1], nx, ny, null));
    sp.pk = 'speak'; sp.np = 1;
  }
  const aMax = info.k === 'market' ? 6 : (info.k === 'notice' ? 8 : 10);
  const ring = gthArc(cx, cy, half + 1.0, hb, nx, ny, aMax);
  for (let i = 0; i < ring.length; i++) sp.slots.push(gthSlot(ring[i].x, ring[i].y, cx - ring[i].x, cy - ring[i].y, null));
  return sp;
}

// 沒有該種聚集點時的退路:道路旁的空草地格(每種最多 2 個,依雜湊排序確定性挑選)
function gthMakeTemp(kind, R, taken) {
  const out = [], cands = [];
  for (let i = 0; i < R.list.length; i++) {
    const c = R.list[i], x = c % boardW(), y = Math.floor(c / boardW()), hb = world.height[c];
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= boardW() || ny >= boardH()) continue;
      const j = idx(nx, ny);
      if (R.ok[j] || world.occ[j] || !gthStandOk(nx, ny, hb)) continue;
      cands.push({ c: c, nx: nx, ny: ny, hb: hb, h: lifeHash(GATHER.base, c * 4 + d), dx: -DIRS[d][0], dy: -DIRS[d][1] });
      break;
    }
  }
  cands.sort(function (a, b) { return a.h - b.h; });
  for (let i = 0; i < cands.length && out.length < (kind === 'show' || kind === 'notice' ? 1 : 2); i++) {
    const q = cands[i], cx = q.nx + 0.5, cy = q.ny + 0.5, hb = q.hb;
    let near = false;
    for (let k = 0; k < out.length; k++) if (Math.abs(out[k].cx - cx) + Math.abs(out[k].cy - cy) < 4) near = true;
    for (let k = 0; k < taken.length; k++) if (Math.abs(taken[k].cx - cx) + Math.abs(taken[k].cy - cy) < 3) near = true;
    if (near) continue;
    const sp = { k: kind, type: 'tmp_' + kind, key: gthStr('tmp' + kind + q.c), oi: -1, cx: cx, cy: cy, fw: 1, fh: 1, hb: hb, road: q.c, diag: q.nx + q.ny,
      px: isoX(cx, cy), py: isoY(cx, cy, hb), bz: 0, slots: [], w: 1, tmp: true, lamp: false, trait: kind === 'chess' ? 'chess' : (kind === 'show' ? 'show' : (kind === 'notice' ? 'notice' : 'rest')), night: false,
      np: kind === 'show' ? 2 : (kind === 'chess' ? 2 : (kind === 'notice' ? 1 : 0)), pk: kind === 'show' ? 'perform' : (kind === 'notice' ? 'speak' : '') };
    if (kind === 'chess') {
      sp.slots.push(gthSlot(cx - 0.42, cy, 1, 0, { sit: true, gz: 0 }));
      sp.slots.push(gthSlot(cx + 0.42, cy, -1, 0, { sit: true, gz: 0 }));
      const ring = gthRing(cx, cy, 0.95, hb, [[1, 0]], 8, null);
      for (let r = 0; r < ring.length; r++) sp.slots.push(gthSlot(ring[r].x, ring[r].y, cx - ring[r].x, cy - ring[r].y, null));
    } else if (kind === 'notice') {   // 臨時告示板(衙役帶來,路口旁空草地):宣讀者在板前(路口側),讀者半圓
      const dx = q.dx, dy = q.dy;
      sp.nx = dx; sp.ny = dy;
      sp.slots.push(gthSlot(cx + dx * 0.8, cy + dy * 0.8, dx, dy, null));
      const ring = gthArc(cx, cy, 1.35, hb, dx, dy, 6);
      for (let r = 0; r < ring.length; r++) sp.slots.push(gthSlot(ring[r].x, ring[r].y, cx - ring[r].x, cy - ring[r].y, null));
    } else if (kind === 'show') {   // 臨時圍場(路口旁空草地):兩名表演者站在中央,觀眾半圓朝向路口
      const dx = q.dx, dy = q.dy, tx = -dy, ty = dx;
      sp.nx = dx; sp.ny = dy;
      sp.slots.push(gthSlot(cx + tx * 0.4, cy + ty * 0.4, dx, dy, null));
      sp.slots.push(gthSlot(cx - tx * 0.4, cy - ty * 0.4, dx, dy, null));
      const ring = gthArc(cx, cy, 1.0, hb, dx, dy, 8);
      for (let r = 0; r < ring.length; r++) sp.slots.push(gthSlot(ring[r].x, ring[r].y, cx - ring[r].x, cy - ring[r].y, null));
    } else {
      sp.slots.push(gthSlot(cx - 0.22, cy + 0.05, 0.4, 1, { sit: true, gz: 0 }));
      sp.slots.push(gthSlot(cx + 0.22, cy + 0.05, -0.4, 1, { sit: true, gz: 0 }));
    }
    out.push(sp);
  }
  return out;
}

function gatherBuild(ok) {
  if (!GATHER.inited) gthInit();
  gatherReleaseAll();
  const R = LIFE.road;
  GATHER.spots.length = 0;
  GATHER.built = false;
  if (!R || !ok) return;
  GATHER.sig = R.sig;
  let w = 1;
  try { w = (typeof worldsActive === 'function') ? (worldsActive() | 0) : 1; } catch (e) { w = 1; }
  GATHER.base = lifeHash(lifeHash(0x6a7bc1d3, w), R.sig);
  const D = boardW() + boardH();
  for (let k = GATHER.pbuck.length; k < D; k++) GATHER.pbuck.push([]);
  for (let k = 0; k < GATHER.pbuck.length; k++) GATHER.pbuck[k].length = 0;
  const objs = world.objects, claimed = {}, lamps = [], chess = [], rest = [], crowd = { notice: [], show: [], market: [], nmarket: [] };
  let i, o, info, fp, sp;
  for (i = 0; i < objs.length; i++) {
    o = objs[i];
    if (o.type === 'lamp_stand' || o.type === 'stone_lamp' || o.type === 'lantern') lamps.push(o);
    info = gatherObjInfo(o.type);
    if (!info || info.k !== 'chess') continue;
    fp = footprint(o.type, o.rot);
    sp = gthMakeChess(o, i, info, fp, ok, claimed);
    if (sp) chess.push(sp);
  }
  for (i = 0; i < objs.length; i++) {
    o = objs[i];
    info = gatherObjInfo(o.type);
    if (!info || info.k !== 'rest' || claimed[i]) continue;
    if (info.cargo && !R.port.length) continue;
    fp = footprint(o.type, o.rot);
    sp = gthMakeRest(o, i, info, fp, ok);
    if (sp) rest.push(sp);
  }
  for (i = 0; i < objs.length; i++) {   // 告示 / 看戲 / 叫賣(P3、P4)
    o = objs[i];
    info = gatherObjInfo(o.type);
    if (!info || !gthIsCrowd(info.k)) continue;
    fp = footprint(o.type, o.rot);
    sp = gthMakeCrowd(o, i, info, fp, ok);
    if (sp) (sp.nst ? crowd.nmarket : crowd[info.k]).push(sp);
  }
  if (!chess.length) { const t = gthMakeTemp('chess', R, []); for (i = 0; i < t.length; i++) chess.push(t[i]); }
  if (!rest.length) { const t = gthMakeTemp('rest', R, chess); for (i = 0; i < t.length; i++) rest.push(t[i]); }
  if (!crowd.show.length) { const t = gthMakeTemp('show', R, []); for (i = 0; i < t.length; i++) crowd.show.push(t[i]); }   // 沒有圈地 / 說書台:路口臨時圍場(PLAN Q5)
  if (!crowd.notice.length) { const t = gthMakeTemp('notice', R, chess); for (i = 0; i < t.length; i++) crowd.notice.push(t[i]); }   // 沒有告示牌 / 縣衙:路口臨時告示板
  for (i = 0; i < chess.length; i++) {   // 燈:下棋 / 夜戲(看戲點)附近有燈才開夜間場次
    for (let k = 0; k < lamps.length; k++) if (Math.abs(lamps[k].x - chess[i].cx) + Math.abs(lamps[k].y - chess[i].cy) <= GATHER_NIGHT.lampR) chess[i].lamp = true;
  }
  for (i = 0; i < crowd.show.length; i++) {
    for (let k = 0; k < lamps.length; k++) if (Math.abs(lamps[k].x - crowd.show[i].cx) + Math.abs(lamps[k].y - crowd.show[i].cy) <= GATHER_NIGHT.lampR) crowd.show[i].lamp = true;
  }
  for (i = 0; i < crowd.nmarket.length; i++) crowd.nmarket[i].lamp = true;   // 夜市攤自帶燈籠
  // 相鄰去重(同種中心距 < 2.5 格者留一個),再依「非樹優先、雜湊」抽樣到上限
  const keep = function (list, max) {
    list.sort(function (a, b) { const ta = a.trait === 'shade' && a.fw === 1 ? 1 : 0, tb = b.trait === 'shade' && b.fw === 1 ? 1 : 0; return ta !== tb ? ta - tb : (lifeHash(GATHER.base, a.key) - lifeHash(GATHER.base, b.key)); });
    const out = [];
    for (let a = 0; a < list.length && out.length < max; a++) {
      let dup = false;
      for (let b = 0; b < out.length; b++) if (Math.abs(out[b].cx - list[a].cx) + Math.abs(out[b].cy - list[a].cy) < 2.5) dup = true;
      if (!dup) out.push(list[a]);
    }
    return out;
  };
  const cs = keep(chess, GATHER_SPOT_MAX), rs = keep(rest, GATHER_SPOT_MAX * 2);
  for (i = 0; i < cs.length; i++) GATHER.spots.push(cs[i]);
  for (i = 0; i < rs.length; i++) GATHER.spots.push(rs[i]);
  const kinds = ['notice', 'show', 'market'];
  for (let k = 0; k < kinds.length; k++) {
    const L = keep(crowd[kinds[k]], GATHER_SPOT_MAX);
    for (i = 0; i < L.length; i++) GATHER.spots.push(L[i]);
  }
  const NM = keep(crowd.nmarket, GATHER_NIGHT.stallMax);   // 夜市攤前圍觀(只在夜間開場,gthTodMul)
  for (i = 0; i < NM.length; i++) GATHER.spots.push(NM[i]);
  GATHER.built = true;
  // R.fBase(人口下限基礎)加入聚集點數 ×1(PLAN §3.2);只增不減,下限仍受時段與密度夾制
  R.fBase += Math.min(GATHER.spots.length, 12);
}

// ───────── 排程(純函式:同種子同結果) ─────────
function gthTodMul(kind, sp) {
  const tod = LIFE.tod, season = (typeof lifeSeason === 'function') ? lifeSeason() : 'spring';
  if (sp.nst) return tod === 'night' ? GATHER_NIGHT.lampMul * (GATHER_SEASON.market[season] || 1) * (sp.w || 1) : 0;   // 夜市攤:只在夜間
  let m = (GATHER_TOD[kind][tod] || 0) * (GATHER_SEASON[kind][season] || 1);
  if (kind === 'chess' && tod === 'night' && sp.lamp) m = 0.2;
  if (kind === 'show' && tod === 'night') m = sp.lamp ? GATHER_NIGHT.showMul * (GATHER_SEASON.show[season] || 1) : 0;   // 夜戲:圈地 / 說書台旁有燈才演
  if (kind === 'rest') {
    if (tod === 'night' && !sp.night) m = 0;
    if (sp.trait === 'shade' && season === 'summer') m *= 1.5;
    if ((sp.trait === 'well' || sp.trait === 'tea') && season === 'winter') m = (GATHER_TOD.rest[tod] || 0);
  }
  return m * (sp.w || 1);
}
// 此刻有沒有一場(棋局 / 告示 / 看戲 / 叫賣);有 → 填 out 並回傳 out(start 毫秒、dur 秒、seed、idx、iv 每拍秒數)。時長與間隔依 GATHER_KINDS[sp.k];同時段同種子同結果
function gthGameAt(sp, now, out, kind) {
  kind = kind || sp.k;
  const cfg = GATHER_KINDS[kind], slot = Math.floor(now / GATHER_SLOT_MS), tin = (now - slot * GATHER_SLOT_MS) / 1000;
  if (!cfg || !cfg.dur) return null;   // 休息點沒有場次
  const mul = gthTodMul(kind, sp);
  if (mul <= 0) return null;
  const key = lifeHash(lifeHash(GATHER.base, sp.key), slot);
  if (gthRnd(key, 1) >= Math.min(1, mul * 0.7)) return null;
  let t = gthRnd(key, 2) * 300;
  for (let i = 0; i < 12; i++) {
    const dur = cfg.dur[0] + gthRnd(key, 10 + i) * (cfg.dur[1] - cfg.dur[0]);
    if (t + dur > 900 || tin < t) return null;
    if (tin < t + dur) {
      out.start = slot * GATHER_SLOT_MS + t * 1000; out.dur = dur; out.seed = lifeHash(key, i + 1); out.idx = i; out.iv = 4 + gthRnd(out.seed, 3) * 4;
      return out;
    }
    t += dur + cfg.cool[0] + gthRnd(key, 40 + i) * (cfg.cool[1] - cfg.cool[0]);
  }
  return null;
}
function gthChessGame(sp, now, out) { return gthGameAt(sp, now, out, 'chess'); }   // 舊名保留(測試與既有呼叫,永遠以下棋的時長與機率計)

// ───────── 組與成員 ─────────
function gthPropAdd(g) {
  const d = Math.max(0, Math.min(GATHER.pbuck.length - 1, g.sp.diag));
  g.pd = d; GATHER.pbuck[d].push(g);
}
function gthPropDel(g) {
  if (g.pd < 0) return;
  const L = GATHER.pbuck[g.pd], k = L ? L.indexOf(g) : -1;
  if (k >= 0) L.splice(k, 1);
  g.pd = -1;
}
function gthPoseOk(spec) {
  if (!spec) return false;
  if (GATHER.poseSpecs[spec.id]) return true;
  if (GATHER.poseN >= GATHER.cap.pose) return false;
  GATHER.poseSpecs[spec.id] = true; GATHER.poseN++;
  return true;
}
function gthOpen(sp, game, forced) {
  let g = null;
  for (let i = 0; i < GATHER_POOL; i++) if (!GATHER.pool[i].on) { g = GATHER.pool[i]; break; }
  if (!g) return null;
  g.on = true; g.kind = sp.k; g.sp = sp; g.closing = false; g.forced = !!forced; g.n = 0; g.openAt = GATHER.clock; g.nextRec = 0;
  g.mem.fill(null); g.mst.fill(0); g.mrole.fill(0); g.until.fill(0);
  g.game = null; g.cheered = false; g.cheerAt = -99; g.bailDone = false; g.bailWant = false;
  if (gthIsGame(sp.k)) {
    g.game = { start: game.start, dur: game.dur, seed: game.seed, idx: game.idx, iv: game.iv };
    g.seed = game.seed; g.iv = game.iv;
    g.wantW = Math.min(GATHER.watchMax, Math.floor(gthRnd(game.seed, 5) * (GATHER.watchMax + 1)), sp.slots.length - sp.np);
    g.bailWant = sp.k === 'notice' && gthRnd(game.seed, 77) < (LIFE.tod === 'dawn' ? GATHER_BAIL.pDawn : GATHER_BAIL.pDay);   // 本場要不要亭卒來張貼(清晨多)
  } else { g.seed = lifeHash(GATHER.base, sp.key); g.wantW = 0; }
  GATHER.groupsOn++;
  gthPropAdd(g);
  return g;
}
function gthDeact(g) {
  for (let i = 0; i < GATHER_SLOTS; i++) if (g.mem[i]) gthRelease(g, i);
  gthPropDel(g);
  g.on = false; g.sp = null; g.game = null; g.n = 0; g.closing = false;
  GATHER.groupsOn--;
}
function gthRelease(g, i) {
  const n = g.mem[i];
  if (!n) return;
  g.mem[i] = null; g.mst[i] = 0; g.mrole[i] = 0; g.n--; GATHER.members--;
  n.gat = 0; n.gp = false; n.gbub = ''; n.dOver = 0; n.gz = 0; n.gmode = '';
  if (n.pp) { n.pp.lean = 0; n.pp.nod = 0; }
  const sv = n.gSv; n.gSv = null;
  if (sv && !n.dead && n.st === 'act' && n.act === 'gather') {   // 名人 / 名冊人物:回到原來的停點,把剩下的停留接著做(行程不變)
    n.act = sv.act; n.dur = sv.rem; n.t = 0; n.lazy = sv.lazy; n.fid = false;
    return;
  }
  if (n.dead || n.st === 'fade') return;
  if (GATHER.snap && n.cur >= 0) {   // 改路重建時:站位多半不在道路格上(lifeRebuild 會把站在非道路格的人淡出)→ 先回到所屬道路格中心
    n.x = (n.cur % boardW()) + 0.5; n.y = Math.floor(n.cur / boardW()) + 0.5; n.px = isoX(n.x, n.y); n.py = isoY(n.x, n.y, lifeHAt(n.x, n.y));
  }
  if (n.st === 'act' && n.act === 'gather') n.dur = n.t;   // 這一站立刻結束 → lifeNextStop 依 lazy 重新排行程(走開)
  else if (n.plan && n.plan[0] && n.plan[0].act === 'gather') n.plan[0].dur = 0;
  n.fid = false;
}
function gatherReleaseAll() {
  GATHER.snap = true;
  try { for (let i = 0; i < GATHER_POOL; i++) { const g = GATHER.pool[i]; if (g.on) gthDeact(g); } } finally { GATHER.snap = false; }
  GATHER.members = 0; GATHER.groupsOn = 0;
}
function gatherReset() {   // lifeReset:居民陣列已清空,只重置組狀態
  for (let i = 0; i < GATHER_POOL; i++) {
    const g = GATHER.pool[i];
    gthPropDel(g);
    g.on = false; g.sp = null; g.game = null; g.n = 0; g.closing = false; g.mem.fill(null); g.mst.fill(0); g.mrole.fill(0);
  }
  GATHER.members = 0; GATHER.groupsOn = 0;
}

function gthAttach(g, i, n, role, state, T) {
  g.mem[i] = n; g.mst[i] = state; g.mrole[i] = role; g.n++; GATHER.members++;
  n.gat = g.id; n.gs = i; n.gr = role; n.gp = false; n.gbub = ''; n.dOver = 0; n.gz = 0; n.gmode = ''; n.gT0 = GATHER.clock;
  n.lazy = T || LIFE_TYPES[n.type] || LIFE_TYPES.civ;
}
function gthSeatIn(g, i, n) {   // 到位(走到道路格後 / 直接生成):設站位、面向、保持時間
  const sl = g.sp.slots[i], role = g.mrole[i];
  if (g.sp.nst && LIFE.tod === 'night' && n.spec && typeof lifeLantern === 'function') n.spec = lifeLantern(n.spec);   // 夜市圍觀者提燈
  n.gp = true; n.gx = sl.x; n.gy = sl.y; n.gz = sl.gz || 0; n.dOver = sl.onObj ? sl.dO : 0; n.fx = sl.fx; n.fy = sl.fy;
  n.fid = !sl.sit;
  n.st = 'act'; n.act = 'gather'; n.dur = 9e5; n.t = 0;
  g.mst[i] = 2;
  if (gthIsGame(g.kind)) {   // 主角留到場次結束;觀眾看一陣子就換人
    g.until[i] = role === 1 ? 1e9 : GATHER.clock + 20 + Math.random() * 40;
  } else {
    const nap = (n.look === 'elder' || n.type === 'coolie') && Math.random() < 0.45 && sl.sit;
    n.gmode = nap ? 'nap' : (g.sp.trait === 'rest' || g.sp.trait === 'cargo') ? 'sit' : g.sp.trait;
    g.until[i] = GATHER.clock + (nap ? 40 + Math.random() * 80 : 20 + Math.random() * 70);
  }
}

// 招募候選:附近正在走路的一般居民(walkIn:畫面內走過去;否則只挑畫面外的,瞬移 + 淡入)
function gthPickWalker(sp, roleKey, radius, walkIn) {
  const L = LIFE.npcs, okT = GATHER_WALKER_OK[roleKey];
  let best = null, bd = 1e9;
  for (let k = 0; k < L.length; k++) {
    const n = L[k];
    if (n.st !== 'walk' || n.gat > 0 || n.ext || n.port || n.vis || n.role || n.keep || n.hold > 0 || n.det || n.pair || n.dead || n.life < 1 || lifeRetiring(n)) continue;
    if (!okT[n.type]) continue;
    if (walkIn ? false : n.onS) continue;
    const d = Math.abs(n.x - sp.cx) + Math.abs(n.y - sp.cy);
    if (d > radius || d >= bd) continue;
    if (n.cur < 0 || ((roleKey === 'player' || roleKey === 'speak') && n.look.indexOf('kid') === 0)) continue;
    if (!n.spec || !gthPoseOk(n.spec)) continue;
    bd = d; best = n;
  }
  return best;
}

// 在 g 的第 i 個站位招募一人;instant = 預布點(直接放在站位、不淡入)。回傳是否成功
function gthRecruit(g, i, role, instant) {
  const sp = g.sp, sl = sp.slots[i];
  const roleKey = role === 1 ? (g.kind === 'chess' ? 'player' : sp.pk) : (sl.sit ? 'sit' : (g.kind === 'rest' ? 'stand' : 'watch'));
  const porter = sp.trait === 'cargo';
  if (GATHER.members >= gthMemberCap() || g.n >= GATHER.perMax) return false;
  let n = null;
  if (!porter) {
    if (!instant) {
      n = gthPickWalker(sp, roleKey, 7, true);
      if (n) {
        const D = lifeField(sp.road);
        if (!D) return false;   // 距離場本幀預算用完,下次再試
        if (D[n.cur] < 0) n = null;
      }
      if (n) {   // 走過去
        gthAttach(g, i, n, role, 1);
        n.plan = [{ cell: sp.road, act: 'gather', dur: 9e5 }]; n.pi = 0; n.goal = sp.road; n.loop = false;
        return true;
      }
    }
    n = gthPickWalker(sp, roleKey, 18, false);
  }
  if (n) {   // 畫面外的居民:瞬移到站位(站位在畫面內時 0.5 秒淡入)
    gthAttach(g, i, n, role, 2);
    n.plan = [{ cell: sp.road, act: 'gather', dur: 9e5 }]; n.pi = 0; n.goal = sp.road; n.loop = false;
    n.cur = sp.road; n.nx = -1; n.x = sl.x; n.y = sl.y; n.px = isoX(n.x, n.y); n.py = isoY(n.x, n.y, lifeHAt(n.x, n.y));
    if (!instant && gthVis(sp, 40)) { n.life = 0; n.alpha = 0; }
    gthSeatIn(g, i, n);
    return true;
  }
  // 沒有現成的人:生成一名新居民(算居民額度,須有空額)
  if (!instant && LIFE.live >= LIFE.target + 2) return false;
  const pool = GATHER_LOOKS[porter ? 'porter' : (role === 1 ? (g.kind === 'chess' ? 'player' : sp.pk) : (sl.sit ? 'sit' : 'watch'))];
  let look = '', spec = null;
  for (let t = 0; t < 5 && !spec; t++) {
    look = pool[Math.floor(Math.random() * pool.length)];
    const s = lifeSpecFor(look);
    if (s && gthPoseOk(s)) spec = s;
  }
  if (!spec) return false;
  const key = GATHER_TYPE_OF[look] || 'civ', T = LIFE_TYPES[key];
  if (!T) return false;
  const plan = [{ cell: sp.road, act: 'gather', dur: 9e5 }];
  if (!lifeEmit(T, key, 1, sp.road, plan, null, true, { lane: 0.12 })) return false;
  n = LIFE.npcs[LIFE.npcs.length - 1];
  n.look = look; n.spec = spec; n.type = key;
  gthAttach(g, i, n, role, 2, T);
  n.x = sl.x; n.y = sl.y; n.px = isoX(n.x, n.y); n.py = isoY(n.x, n.y, lifeHAt(n.x, n.y));
  if (instant) { n.life = 1; n.alpha = 1; } else { n.life = 0; n.alpha = 0; }
  gthSeatIn(g, i, n);
  return true;
}

// 每幀:成員到位、緩步入座、到時離開(只迭代使用中的組 × 站位)
function gthUpdateMembers(dt) {
  for (let gi = 0; gi < GATHER_POOL; gi++) {
    const g = GATHER.pool[gi];
    if (!g.on) continue;
    for (let i = 0; i < GATHER_SLOTS; i++) {
      const n = g.mem[i];
      if (!n) continue;
      if (n.dead || n.st === 'fade' || n.gat !== g.id || lifeRetiring(n)) {
        if (n.gat === g.id) { n.gat = 0; n.gp = false; n.gbub = ''; n.dOver = 0; n.gz = 0; if (n.pp) { n.pp.lean = 0; n.pp.nod = 0; } }
        if (n.gSv) { gthRelease(g, i); continue; }   // 名人還要還原行程(gthRelease 內處理計數)
        g.mem[i] = null; g.mst[i] = 0; g.mrole[i] = 0; g.n--; GATHER.members--;
        continue;
      }
      if (g.mst[i] === 1) {
        if (n.st === 'act' && n.act === 'gather') gthSeatIn(g, i, n);
        else if (GATHER.clock - n.gT0 > 50 || n.st !== 'walk') gthRelease(g, i);
        continue;
      }
      if (n.gp) {   // 緩步入座 / 站定(1.6 格/秒)
        const dx = n.gx - n.x, dy = n.gy - n.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.001) { const s = Math.min(d, 1.6 * dt); n.x += dx / d * s; n.y += dy / d * s; }
        if (n.st !== 'act') gthRelease(g, i);
        else if (GATHER.clock >= g.until[i]) gthRelease(g, i);
      }
    }
  }
}

// ───────── 名人加入 / 亭卒 / 叫好 / 夜間光暈(PLAN_CITYLIFE_GATHER §4.4.3、§4.4.5、§4.9) ─────────
// 在野名人 / 名冊人物停在行程的「站著停點」時,8 格內有進行中的聚集 → 機率改當觀眾(下棋 / 告示 / 看戲 / 叫賣皆可);
//   n.gSv 記下原動作與剩餘停留,散場時 gthRelease 還原為 stand,行程(plan / pi)不動,所以「不影響職務與行程」
function gthFamousTick() {
  const L = LIFE.npcs;
  for (let k = 0; k < L.length; k++) {
    const n = L[k];
    if ((n.role !== 'visitor' && n.role !== 'hero') || n.dead || n.st !== 'act' || n.act !== 'stand' || n.gat > 0 || n.gSv || n.alpha < 0.9 || lifeRetiring(n)) continue;
    if (Math.random() >= (n.role === 'visitor' ? GATHER_FAM.pVisitor : GATHER_FAM.pHero)) continue;
    let best = null, bd = GATHER_FAM.radius + 1, slot = -1;
    for (let gi = 0; gi < GATHER_POOL; gi++) {
      const g = GATHER.pool[gi];
      if (!g.on || g.closing || !gthIsGame(g.kind) || g.n === 0 || g.n >= GATHER.perMax) continue;
      const d = Math.abs(g.sp.cx - n.x) + Math.abs(g.sp.cy - n.y);
      if (d > GATHER_FAM.radius || d >= bd) continue;
      let s = -1;
      for (let i = g.sp.np; i < g.sp.slots.length && s < 0; i++) if (!g.mem[i]) s = i;
      if (s < 0) continue;
      bd = d; best = g; slot = s;
    }
    if (!best) continue;
    const lazy = n.lazy, rem = Math.max(0.5, n.dur - n.t);
    gthAttach(best, slot, n, 2, 2, null);
    n.lazy = lazy;
    n.gSv = { act: 'stand', rem: rem, lazy: lazy };
    gthSeatIn(best, slot, n);
    best.until[slot] = GATHER.clock + GATHER_FAM.stay[0] + Math.random() * (GATHER_FAM.stay[1] - GATHER_FAM.stay[0]);
  }
}
// 亭卒(衙役):告示組開場時(張貼階段 gt < GATHER_BAIL.phase 秒)才來,從入口走到告示板前站 GATHER_BAIL.stay 秒後離開;全城同時最多 1 名
function gthBailTick() {
  let have = false;
  const L = LIFE.npcs;
  for (let k = 0; k < L.length && !have; k++) if (L[k].role === 'bailiff' && !L[k].dead && L[k].st !== 'fade') have = true;
  for (let gi = 0; gi < GATHER_POOL; gi++) {
    const g = GATHER.pool[gi];
    if (!g.on || g.closing || g.kind !== 'notice' || !g.bailWant || g.bailDone) continue;
    if (g.gt0 + (GATHER.clock - g.clk0) >= GATHER_BAIL.phase) { g.bailDone = true; continue; }
    if (have || !gthBailSpawn(g)) continue;
    g.bailDone = true; have = true;
  }
}
function gthBailSpawn(g) {
  const R = LIFE.road, T = (typeof LIFE_TYPES !== 'undefined') ? LIFE_TYPES.bailiff : null, W = boardW(), sp = g.sp;
  if (!R || !R.ent || !T || typeof lifeEmit !== 'function' || typeof lifeField !== 'function') return false;
  const sx = sp.road % W, sy = Math.floor(sp.road / W);
  let ex = null, bd = 1e9;
  for (let k = 0; k < R.ent.length; k++) {
    const e = R.ent[k], d = Math.abs((e.cell % W) - sx) + Math.abs(Math.floor(e.cell / W) - sy);
    if (d >= bd) continue;
    const D = lifeField(e.cell);   // 由入口出發的距離場(同 npcVisitSpawn);預算用完 → 回 false,下次再試
    if (!D) return false;
    if (D[sp.road] < 0) continue;
    bd = d; ex = e;
  }
  const mid = !ex;   // 入口都走不到張貼處(孤立道路):原地出現、站完即淡出(stat)
  const plan = mid ? [{ cell: sp.road, act: 'stand', dur: GATHER_BAIL.stay }] : [{ cell: sp.road, act: 'stand', dur: GATHER_BAIL.stay }, { cell: ex.cell, end: 'exit', ent: ex }];
  const before = LIFE.npcs.length;
  if (!lifeEmit(T, 'bailiff', 1, mid ? sp.road : ex.cell, plan, mid ? null : ex, mid, { lane: 0.12 })) return false;
  if (LIFE.npcs.length === before) return false;
  const n = LIFE.npcs[LIFE.npcs.length - 1];
  LIFE.live--;   // lifeEmit 已計入一般居民;亭卒不占居民額度
  n.ext = true; n.role = 'bailiff'; n.name = T.name; n.stat = mid;
  const s = gthBailSpec();
  if (s) n.spec = s;
  return true;
}
function gthBailSpec() {   // 赤幘衙役外觀(crowdLook 'guard' 的頭飾),快取一份;缺 ART / crowdparts 回 null(退回 lifeNew 的外觀)
  if (GTH_BAIL_SPEC) return GTH_BAIL_SPEC;
  if (typeof ART === 'undefined' || !ART || !ART.UNIT || !ART.UNIT.man || typeof crowdLook !== 'function') return null;
  const L = crowdLook(GATHER_BAIL.job, 4242);
  if (!L) return null;
  const id = 'bailiff_' + L.id;
  GTH_BAIL_SPEC = Object.assign({}, ART.UNIT.man, L, { id: id });
  if (typeof LIFE !== 'undefined' && LIFE && LIFE.variantIds) LIFE.variantIds[id] = true;
  return GTH_BAIL_SPEC;
}
// 叫好:看戲小卡的按鈕。每場 1 次、每日 GATHER_CHEER.dayMax 次;只影響動作(觀眾鼓掌、表演者鞠躬),不給獎勵、不寫數據
function gatherCheering(g) { return !!g && g.cheerAt > -99 && GATHER.clock - g.cheerAt < GATHER_CHEER.sec; }
function gatherCheer() {
  const g = GATHER.cardG;
  if (!g || !g.on || g.kind !== 'show' || g.cheered || g.closing) return '';
  const day = Math.floor(gatherNow() / 86400000);
  if (GATHER.cheerDay !== day) { GATHER.cheerDay = day; GATHER.cheerN = 0; }
  if (GATHER.cheerN >= GATHER_CHEER.dayMax) return '今日叫好的次數已用完';
  GATHER.cheerN++;
  g.cheered = true; g.cheerAt = GATHER.clock;
  if (GATHER.cheerEl) GATHER.cheerEl.style.display = 'none';
  const L = GATHER_LINES.show.cheer;
  return '表演者拱手致謝:「' + L[(g.seed >>> 0) % L.length] + '」';
}
function gthCheerBtn(c, show) {
  if (!c || typeof document === 'undefined' || !document.createElement) return;
  if (!GATHER.cheerEl || GATHER.cheerBox !== c.box) {
    const b = document.createElement('span');
    b.textContent = '叫好';
    b.style.cssText = 'cursor:pointer;color:#e6b84a;font-size:13px;margin-left:14px;';
    b.addEventListener('click', function () {
      const m = gatherCheer();
      if (m && LIFE.card) LIFE.card.greet.textContent = m;
    });
    c.box.appendChild(b);
    GATHER.cheerEl = b; GATHER.cheerBox = c.box;
  }
  GATHER.cheerEl.style.display = show ? 'inline' : 'none';
}
// 夜間光暈(燈籠 / 夜市 / 夜戲):每組一團暖色半透明圓(1 個圖元);省電與白天不畫
function gthDrawGlow(ctx, g) {
  const sp = g.sp;
  rqAlpha(ctx, GATHER_NIGHT.glowA);
  rqDisc(ctx, sp.px, sp.py - (sp.bz || 8) - 8, 20, 11, '#ffcf6a');
  rqAlpha(ctx, 1);
  GATHER.propN += 1;
}
// 臨時告示板(路口空地,衙役帶來):兩柱 + 板 + 兩張紙 + 朱印(6 個圖元)
function gthDrawBoard(ctx, g) {
  const x = g.sp.px, y = g.sp.py;
  rqRect(ctx, x - 8, y - 12, 1.6, 12, '#6a4a2a');
  rqRect(ctx, x + 6.4, y - 12, 1.6, 12, '#6a4a2a');
  rqPoly4(ctx, x - 8, y - 14, x + 8, y - 14, x + 8, y - 6, x - 8, y - 6, '#8a6a3a');
  rqPoly4(ctx, x - 6, y - 12.5, x - 1.5, y - 12.5, x - 1.5, y - 7.5, x - 6, y - 7.5, '#f0e3bf');
  rqPoly4(ctx, x + 0.5, y - 12.5, x + 5, y - 12.5, x + 5, y - 7.5, x + 0.5, y - 7.5, '#f0e3bf');
  rqDisc(ctx, x + 4, y - 14, 1.3, 1.3, '#b03a2a');
  GATHER.propN += 6;
}

// ───────── 排程與開關組(2 Hz;省電 1 Hz) ─────────
function gthKindMul(sp) { return gthTodMul(sp.k, sp); }
// 燈的增減不改道路簽章(不會觸發 gatherBuild):2 Hz 比對燈數,變了就重算下棋 / 夜戲點的 lamp 旗標(O(物件數),不配置)
function gthLampSync() {
  const objs = world.objects, lamps = [];
  for (let i = 0; i < objs.length; i++) { const t = objs[i].type; if (t === 'lamp_stand' || t === 'stone_lamp' || t === 'lantern') lamps.push(objs[i]); }
  if (lamps.length === GATHER.lampN) return;
  GATHER.lampN = lamps.length;
  for (let s = 0; s < GATHER.spots.length; s++) {
    const sp = GATHER.spots[s];
    if (sp.nst || (sp.k !== 'chess' && sp.k !== 'show')) continue;
    let lit = false;
    for (let k = 0; k < lamps.length && !lit; k++) if (Math.abs(lamps[k].x - sp.cx) + Math.abs(lamps[k].y - sp.cy) <= GATHER_NIGHT.lampR) lit = true;
    sp.lamp = lit;
  }
}
function gthManage(prefill) {
  gthCapUpdate();
  gthLampSync();
  const now = gatherNow(), tmp = GATHER.tmpGame || (GATHER.tmpGame = { start: 0, dur: 0, seed: 0, idx: 0, iv: 6 });
  let gi, g, i;
  // 1) 既有組:局終 / 離開畫面 → 解散;維持成員
  for (gi = 0; gi < GATHER_POOL; gi++) {
    g = GATHER.pool[gi];
    if (!g.on) continue;
    const sp = g.sp;
    if (!g.closing) {
      let end = false;
      if (gthIsGame(g.kind)) {
        const gm = g.forced ? ((now - g.game.start) / 1000 < g.game.dur ? g.game : null) : gthGameAt(sp, now, tmp);
        if (!gm || gm.seed !== g.game.seed) end = true;
        else { g.gt0 = (now - g.game.start) / 1000; g.clk0 = GATHER.clock; }
        if (!end && g.kind !== 'chess' && g.n === 0 && GATHER.clock - g.openAt > 60) end = true;   // 告示 / 看戲 / 叫賣開了一分鐘還沒人來:收掉,免得占著組數
      } else if (!g.forced && gthKindMul(sp) <= 0) end = true;
      if (!gthVis(sp, 260) && !prefill) { gthCloseStart(g, true); continue; }
      if (end) { gthCloseStart(g, false); continue; }
      gthMaintain(g, false);
    } else {
      if (g.n === 0 || GATHER.clock - g.openAt > 600) gthDeact(g);
    }
  }
  gthFamousTick();   // 名人 / 名冊人物在停點附近加入觀眾(§4.9)
  gthBailTick();     // 告示張貼階段:亭卒來貼告示(§4.4.3)
  // 2) 開新組:正在進行的棋局優先,其次畫面附近的休息點(依到畫面中心距離)
  if (LIFE.placing && !prefill) return;
  const cand = [];
  for (i = 0; i < GATHER.spots.length; i++) {
    const sp = GATHER.spots[i];
    if (gthHasGroup(sp) || (!prefill && !gthVis(sp, 40))) continue;
    if (gthIsGame(sp.k)) { const gm = gthGameAt(sp, now, tmp); if (gm) cand.push({ sp: sp, d: gthDist2(sp) - (sp.k === 'chess' ? 1e9 : 5e8), game: { start: gm.start, dur: gm.dur, seed: gm.seed, idx: gm.idx, iv: gm.iv } }); }
    else if (gthKindMul(sp) > 0) cand.push({ sp: sp, d: gthDist2(sp) + (sp.trait === 'shade' && sp.fw === 1 ? 160000 : 0), game: null });   // 普通樹排在座椅 / 井 / 茶座之後
  }
  cand.sort(function (a, b) { return a.d - b.d; });
  for (i = 0; i < cand.length; i++) {
    if (GATHER.groupsOn >= GATHER.cap.groups) {   // 滿了:棋局可擠掉最遠的休息組
      if (cand[i].sp.k !== 'chess') break;
      let far = null, fd = -1;
      for (gi = 0; gi < GATHER_POOL; gi++) { g = GATHER.pool[gi]; if (g.on && g.kind === 'rest' && !g.forced) { const dd = gthDist2(g.sp); if (dd > fd) { fd = dd; far = g; } } }
      if (!far) break;
      gthCloseStart(far, true);
    }
    if (GATHER.members >= gthMemberCap()) break;
    g = gthOpen(cand[i].sp, cand[i].game, false);
    if (!g) break;
    if (gthIsGame(g.kind)) { g.gt0 = (now - g.game.start) / 1000; g.clk0 = GATHER.clock; }
    gthMaintain(g, prefill);
  }
  // 3) 強制開組(?gather= / gatherForce)
  if (GATHER.force) { const f = GATHER.force; GATHER.force = ''; gthForceOpen(f); }
}
function gthHasGroup(sp) {
  for (let i = 0; i < GATHER_POOL; i++) if (GATHER.pool[i].on && GATHER.pool[i].sp === sp) return true;
  return false;
}
function gthCloseStart(g, cull) {
  g.closing = true; g.openAt = GATHER.clock;
  for (let i = 0; i < GATHER_SLOTS; i++) {
    if (!g.mem[i]) continue;
    if (cull || g.mst[i] === 1) gthRelease(g, i);
    else g.until[i] = GATHER.clock + Math.random() * 6;   // 錯開 0~6 秒走開
  }
  if (cull || g.n === 0) gthDeact(g);
}
// 維持成員:棋局 = 兩名棋手 + 目標圍觀數;休息 = 空位依機率補人
function gthMaintain(g, instant) {
  const sp = g.sp, ns = sp.slots.length;
  let i;
  if (gthIsGame(g.kind)) {   // 下棋 / 告示 / 看戲 / 叫賣:前 np 個站位是主角(role 1),其餘是觀眾(role 2)
    const np = sp.np;
    for (i = 0; i < np && i < ns; i++) if (!g.mem[i]) { if (!gthRecruit(g, i, 1, instant)) break; if (!instant) break; }
    let w = 0;
    for (i = np; i < ns; i++) if (g.mem[i]) w++;
    const tail = g.game ? g.game.dur - ((gatherNow() - g.game.start) / 1000) : 0;
    if (tail < 6) return;   // 終局前不再補人
    if (instant) {
      for (i = np; i < ns && w < g.wantW; i++) if (!g.mem[i] && gthRecruit(g, i, 2, true)) w++;
    } else if (w < g.wantW && GATHER.clock >= g.nextRec) {
      g.nextRec = GATHER.clock + 2 + Math.random() * 4;
      for (i = np; i < ns; i++) if (!g.mem[i] && gthRecruit(g, i, 2, false)) break;
    } else if (w > g.wantW) {   // 降載後多出的圍觀者離開
      for (i = ns - 1; i >= np; i--) if (g.mem[i] && g.mst[i] === 2) { gthRelease(g, i); break; }
    }
  } else {
    const mul = gthKindMul(sp);
    for (i = 0; i < ns; i++) {
      if (g.mem[i]) continue;
      const p = instant ? Math.min(0.85, 0.6 * mul + 0.1) : Math.min(0.5, 0.05 * mul);
      if (Math.random() < p) { if (gthRecruit(g, i, 3, instant) && !instant) break; }
    }
  }
}
function gthForceOpen(kind, type) {
  const now = gatherNow();
  let best = null, bd = 1e18;
  for (let i = 0; i < GATHER.spots.length; i++) {
    const sp = GATHER.spots[i];
    if (sp.k !== kind || (type && sp.type !== type) || gthHasGroup(sp)) continue;
    const d = gthDist2(sp);
    if (d < bd) { bd = d; best = sp; }
  }
  if (!best) return null;
  if (GATHER.groupsOn >= GATHER.cap.groups) {   // 擠掉一組
    for (let gi = 0; gi < GATHER_POOL; gi++) if (GATHER.pool[gi].on) { gthCloseStart(GATHER.pool[gi], true); break; }
  }
  const game = gthIsGame(kind) ? { start: now, dur: kind === 'chess' ? 240 : 120, seed: lifeHash(GATHER.base, 777), idx: 0, iv: 5 } : null;
  const g = gthOpen(best, game, true);
  if (g) { if (gthIsGame(g.kind)) { g.gt0 = 0; g.clk0 = GATHER.clock; } gthMaintain(g, false); }
  return g;
}
// 開發 / 測試:在最近的聚集點立即開一組(chess / rest,可再指定物件 type);回傳組
function gatherForce(kind, type) { if (!GATHER.inited) gthInit(); return gthForceOpen(kind, type); }

function gatherPrefill() {
  if (!GATHER.inited) gthInit();
  if (!GATHER.built || !LIFE.active || !LIFE.road) return 0;
  const before = GATHER.members;
  GATHER.prefilling = true;
  try { gthManage(true); } finally { GATHER.prefilling = false; }
  GATHER.tickT = 0.5;   // 預布點之後的第一次一般排程延後 0.5 秒(一般排程用非種子亂數,不污染預布點的確定性)
  for (let gi = 0; gi < GATHER_POOL; gi++) {   // 預布點的人第一幀就在位置上
    const g = GATHER.pool[gi];
    if (!g.on) continue;
    for (let i = 0; i < GATHER_SLOTS; i++) { const n = g.mem[i]; if (n && n.gp) { n.x = n.gx; n.y = n.gy; n.px = isoX(n.x, n.y); n.py = isoY(n.x, n.y, lifeHAt(n.x, n.y)); } }
  }
  return GATHER.members - before;
}

// lifeFrame 掛點:每幀更新成員(≤ 48 人),每 0.5 秒排程
function gatherTick(dt) {
  if (!featureOn('citysim')) return;   // @DORMANT citysim
  if (!GATHER.inited) gthInit();
  if (!GATHER.built) return;
  const t0 = lifeNow();
  GATHER.clock += dt;
  if (GATHER.pending && GATHER.spots.length) { GATHER.force = GATHER.pending === 'list' ? '' : GATHER.pending; if (GATHER.pending === 'list' && typeof console !== 'undefined') console.log('[gather]', JSON.stringify(gatherStats())); GATHER.pending = ''; }
  if (GATHER.groupsOn) gthUpdateMembers(dt);
  GATHER.tickT -= dt;
  if (GATHER.tickT <= 0) {
    GATHER.tickT = (typeof isPowerSave === 'function' && isPowerSave()) ? 1 : 0.5;
    gthManage(false);
  }
  GATHER.tickAcc += lifeNow() - t0;
}

// ───────── 動作與姿勢(每人每幀 O(1),不配置) ─────────
function gthGroupOf(n) { return n.gat > 0 ? GATHER.pool[n.gat - 1] : null; }
// 告示 / 看戲 / 叫賣的動作(每人每幀 O(1)):主角依種類比手勢(宣讀者指告示、擊鼓 fr:4、跳丸 fr:3、叫賣招手 fr:4),觀眾點頭、側傾、冒泡泡;
// 看戲每 40 秒一段,段尾 2.5 秒全場鼓掌(觀眾 fr:3 與 fr:0 以 4 Hz 交替),主角鞠躬;場次結束前 fin 秒起全體鞠躬 / 泡泡
function gthPoseEvt(n, pp, g, i) {
  const clk = GATHER.clock, gt = g.gt0 + (clk - g.clk0), sp = g.sp, lead = n.gr === 1, fin = gt - (g.game.dur - GATHER_KINDS[g.kind].finale);
  const r = gthRnd(g.seed, (Math.floor(gt) & 1023) * 16 + i);
  if (g.kind === 'notice') {
    const ph = gt % 6;
    if (lead) {
      if (gt < 8 || ph < 1.4) pp.fr = 4;   // 張貼:往板上一按;之後每 6 秒指一次
      if (gt >= 8 && ph >= 1.4) { n.gbub = 'talk'; pp.lean = (Math.floor(gt * 2) % 2) ? 1.2 : -1.2; }
    } else {
      if (r < 0.35 && ph >= 1.5) pp.nod = Math.floor(gt * 1.5) % 2;
      if (r > 0.9 && ph < 0.8) n.gbub = 'question';
      else if (fin > 0 && r < 0.3) n.gbub = 'happy';
    }
    return;
  }
  if (g.kind === 'show') {
    const ph = gt % 40, applause = ph >= 37.5 || gatherCheering(g);   // 段尾鼓掌,或觀眾叫好(GATHER_CHEER.sec 秒)
    if (lead) {
      if (sp.trait === 'story') { pp.fr = 2; if (Math.floor(gt / 5) % 2 === 0) { n.gbub = 'talk'; pp.lean = 1.2; } }
      else if (i === 0) pp.fr = (Math.floor(gt / 0.6) % 2 && !applause) ? 4 : 0;   // 擊鼓:單臂前伸交替
      else { pp.fr = ((gt % 4) < 2 && !applause) ? 3 : 0; if ((gt % 4) < 0.3) n.gbub = 'happy'; }   // 跳丸:雙臂上舉
      if (applause || fin > 0) pp.nod = Math.floor(gt * 2) % 2;   // 謝幕鞠躬
    } else {
      if (applause || fin > 0) { pp.fr = (Math.floor(clk * 4) % 2) ? 3 : 0; if (r < 0.3) n.gbub = 'happy'; }
      else if (ph >= 10 && ph < 10.8 && r < 0.15) { pp.nod = 1; n.gbub = 'happy'; }
    }
    return;
  }
  // 叫賣
  if (lead) { const ph = gt % 6; pp.fr = ph < 1.4 ? 4 : 0; if (ph < 2.5) n.gbub = 'talk'; return; }
  const k9 = Math.floor(gt / 9), ph9 = gt - k9 * 9, np = sp.np, ns = sp.slots.length;
  const dealer = np + ((k9 * 3 + ((g.seed >>> 0) % 7)) % Math.max(1, ns - np));   // 每 9 秒輪到一位觀眾成交
  if (i === dealer) { if (ph9 >= 1 && ph9 < 4) { n.gbub = 'trade'; pp.lean = (i & 1) ? 1.2 : -1.2; } else if (ph9 >= 4.5 && ph9 < 5) pp.nod = 1; }
  else if (r < 0.2 && (gt % 6) > 3 && (gt % 6) < 4.2) n.gbub = 'question';
  if (fin > 0 && r < 0.3 && i !== dealer) n.gbub = 'happy';
}
function gatherPose(n, pp) {
  n.gbub = '';
  const g = gthGroupOf(n);
  if (!g || !g.on || g.mem[n.gs] !== n || !n.gp) return;
  pp.y = n.py - n.gz;
  pp.lean = 0; pp.nod = 0;
  const clk = GATHER.clock, i = n.gs;
  if (g.kind === 'chess') {
    const gt = g.gt0 + (clk - g.clk0), iv = g.iv, k = Math.floor(gt / iv), ph = gt - k * iv, fin = gt - (g.game.dur - GATHER_KINDS.chess.finale);
    const winner = gthRnd(g.game.seed, 99) < 0.5 ? 0 : 1;
    if (n.gr === 1) {
      pp.fr = 2;
      const opp = g.mem[1 - i], dir = opp && opp.x < n.x ? -1 : 1;
      if (fin > 0) {
        if (i === winner) { pp.nod = Math.floor(fin * 2) % 2; if (fin > 1 && fin < 6) n.gbub = 'happy'; }
        else { pp.lean = (Math.floor(fin * 3) % 2 ? 2.4 : -2.4); }
      } else if ((k & 1) === i) {   // 輪到我:前傾 + 點頭落子
        if (ph < 0.8) { pp.lean = 3 * dir; pp.nod = ph < 0.4 ? 1 : 0; }
        else if (ph > 1.2 && ph < 2.6 && gthRnd(g.seed, k * 7 + i) < 0.3) n.gbub = 'idea';
      } else if (ph > iv * 0.5 && ph < iv * 0.5 + 0.4) pp.nod = 1;
    } else {
      const r = gthRnd(g.seed, k * 13 + i);
      if (fin > 0) { if (fin > 0.5 && fin < 5 && r < 0.35) n.gbub = 'happy'; }
      else if (ph < 1.6) {
        if (r < 0.3) n.gbub = r < 0.15 ? 'surprise' : 'question';
        if (r > 0.9 && ph < 0.8) pp.fr = 4;   // 指點「下這裡!」
      }
    }
    return;
  }
  if (g.kind !== 'rest') { gthPoseEvt(n, pp, g, i); return; }
  // 路邊休息
  const t = clk + n.ph * 3;
  if (n.gmode === 'nap') { pp.fr = 2; pp.nod = Math.floor(t / 1.4) % 2; pp.lean = 2.4; n.gbub = ((t % 6) < 2.4) ? 'sleep' : ''; return; }
  if (n.gmode === 'sit') {
    pp.fr = 2;
    const turn = Math.floor(t / 2.6) % Math.max(1, g.n);
    if (g.n >= 2 && (i % g.n) === turn) { pp.lean = 1.6 * (Math.floor(t * 2) % 2 ? 1 : 0.5); n.gbub = 'talk'; }
    else if (Math.floor(t / 5) % 3 === 0) pp.nod = Math.floor(t * 1.5) % 2;
    return;
  }
  if (n.gmode === 'tea' || n.gmode === 'well' || n.gmode === 'shade') {
    const turn = Math.floor(t / 2.8) % Math.max(1, g.n);
    if (g.n >= 2 && (i % g.n) === turn) { pp.lean = 1.4; n.gbub = 'talk'; }
    if (n.gmode === 'tea' && (t % 8) < 0.7) pp.fr = 4;   // 舉碗喝茶
  }
}

// ───────── 繪製(小道具 + 提示圖示 + 拉遠人影團) ─────────
function gthHintPos(g) {
  const sp = g.sp;
  return [sp.px, sp.py - (sp.bz || 10) - (sp.trait === 'shade' || sp.fw > 1 ? 52 : 34)];
}
function gatherDraw(ctx, d) {
  if (d <= GATHER.lastD) { GATHER.propLast = GATHER.propN; GATHER.propN = 0; }   // 對角線由小到大畫:d 回頭 = 新的一幀(圖元上限以「每幀」計)
  GATHER.lastD = d;
  if (!GATHER.groupsOn || !LIFE.active) return;
  const L = GATHER.pbuck[d];
  if (!L || !L.length) return;
  const t0 = lifeNow(), z = gthZoom();
  for (let k = 0; k < L.length; k++) {
    const g = L[k], sp = g.sp;
    if (!g.on || !sp) continue;
    if (z < 0.35) {   // 拉遠:每組一團人影(扁橢圓 + 頭點),不佔個人色點額度
      if (g.n > 0 && GATHER.propN < GATHER_PROP_MAX) {
        const m = Math.min(g.n, 6);
        rqDisc(ctx, sp.px, sp.py - 3, 6 + m * 0.8, 3.2, 'rgba(40,30,20,0.35)');
        let c = 0;
        for (let i = 0; i < GATHER_SLOTS && c < 3; i++) { const n = g.mem[i]; if (n && n.gp) { rqDisc(ctx, sp.px - 4 + c * 4, sp.py - 5 - (c === 1 ? 1.6 : 0), 2.3, 2.3, n.col); c++; } }
        GATHER.propN += 4;
      }
      continue;
    }
    if (z < 0.5) continue;
    if (g.kind === 'chess' && g.game && !g.closing) gthDrawChess(ctx, g, z);
    else if (g.kind === 'rest' && sp.type === 'liang_peng' && z >= 0.8 && g.n > 0 && GATHER.propN < GATHER_PROP_MAX) {   // 茶具
      rqDisc(ctx, sp.px - 6, sp.py - 12, 1.7, 1, '#f4ead2'); rqDisc(ctx, sp.px + 5, sp.py - 11, 1.7, 1, '#f4ead2'); GATHER.propN += 2;
    }
    if (g.kind === 'show' && g.n > 0 && z >= 0.5 && GATHER.propN < GATHER_PROP_MAX) gthDrawShow(ctx, g, z);
    if (g.kind === 'notice' && sp.tmp && GATHER.propN < GATHER_PROP_MAX - 6) gthDrawBoard(ctx, g);
    if (sp.lamp && g.n > 0 && LIFE.tod === 'night' && GATHER.propN < GATHER_PROP_MAX && !(typeof isPowerSave === 'function' && isPowerSave())) gthDrawGlow(ctx, g);   // 夜間光暈(省電關閉)
    if (z >= 0.6 && g.n > 0 && gthUiOk() && GATHER.propN < GATHER_PROP_MAX) gthDrawHint(ctx, g);
  }
  GATHER.drawAcc += lifeNow() - t0;
}
function gthDrawChess(ctx, g, z) {
  const sp = g.sp, gt = g.gt0 + (GATHER.clock - g.clk0), moves = Math.floor(gt / g.iv), cnt = Math.min(10, moves);
  if (sp.tmp && GATHER.propN < GATHER_PROP_MAX - 8) {   // 臨時麻布棋盤:菱形 + 4×4 格線
    const hb = sp.hb, a = [sp.cx - 0.26, sp.cy - 0.26], b = [sp.cx + 0.26, sp.cy - 0.26], c = [sp.cx + 0.26, sp.cy + 0.26], e = [sp.cx - 0.26, sp.cy + 0.26];
    rqPoly4(ctx, isoX(a[0], a[1]), isoY(a[0], a[1], hb), isoX(b[0], b[1]), isoY(b[0], b[1], hb), isoX(c[0], c[1]), isoY(c[0], c[1], hb), isoX(e[0], e[1]), isoY(e[0], e[1], hb), '#d8c08a');
    for (let q = 1; q < 4; q++) {
      const u = -0.26 + q * 0.13;
      rqLine(ctx, isoX(sp.cx + u, sp.cy - 0.26), isoY(sp.cx + u, sp.cy - 0.26, hb), isoX(sp.cx + u, sp.cy + 0.26), isoY(sp.cx + u, sp.cy + 0.26, hb), 0.6, '#7a5a30', 0.7);
      rqLine(ctx, isoX(sp.cx - 0.26, sp.cy + u), isoY(sp.cx - 0.26, sp.cy + u, hb), isoX(sp.cx + 0.26, sp.cy + u), isoY(sp.cx + 0.26, sp.cy + u, hb), 0.6, '#7a5a30', 0.7);
    }
    GATHER.propN += 7;
  }
  if (z < 0.8) return;
  for (let k = 0; k < cnt && GATHER.propN < GATHER_PROP_MAX; k++) {   // 棋子:最多 10 顆(超過換位置不增數)
    const h = lifeHash(g.game.seed, k + (moves > 10 ? moves : 0) * 0);
    const wx = sp.cx + ((h % 9) - 4) * 0.045, wy = sp.cy + (((h >>> 8) % 9) - 4) * 0.045;
    rqDisc(ctx, isoX(wx, wy), isoY(wx, wy, sp.hb) - sp.bz, 1.5, 0.95, (k & 1) ? '#f4f0e4' : '#2a2622');
    GATHER.propN++;
  }
}
// 看戲道具(程式繪製,圖元數計入 GATHER_PROP_MAX):臨時圍場的紅毯與小鼓;段尾鼓掌時前方閃 4 道掌聲記號;跳丸的 3 顆彩球繞第 2 位表演者頭頂
function gthDrawShow(ctx, g, z) {
  const sp = g.sp, gt = g.gt0 + (GATHER.clock - g.clk0), ph = gt % 40;
  if (sp.tmp && z >= 0.5 && GATHER.propN < GATHER_PROP_MAX - 4) {
    rqDisc(ctx, sp.px, sp.py - 1, 13, 6.5, '#a8402e'); rqDisc(ctx, sp.px, sp.py - 1, 10, 4.5, '#c0583c');
    rqDisc(ctx, sp.px - 4, sp.py - 7, 2.6, 2.6, '#7a4a2a'); GATHER.propN += 3;
  }
  if (z < 0.6) return;
  if (ph >= 37.5 && Math.floor(GATHER.clock * 5) % 2 === 0 && GATHER.propN < GATHER_PROP_MAX - 4) {
    for (let k = 0; k < 4; k++) {
      const a = -1.2 + k * 0.8, c = Math.cos(a), s = Math.sin(a) * 0.6;
      rqLine(ctx, sp.px + c * 9, sp.py - 22 + s * 9, sp.px + c * 13, sp.py - 22 + s * 13, 1.3, '#f4ead2', 0.9);
    }
    GATHER.propN += 4;
  }
  const m = g.mem[1];
  if (sp.np === 2 && m && m.gp && GATHER.propN < GATHER_PROP_MAX - 3) {
    for (let k = 0; k < 3; k++) { const a = gt * 5 + k * 2.094; rqDisc(ctx, m.px + Math.cos(a) * 6, m.py - 34 + Math.sin(a) * 3, 2, 2, '#e6b84a'); }
    GATHER.propN += 3;
  }
}
function gthDrawHint(ctx, g) {
  const p = gthHintPos(g), x = p[0], y = p[1];
  rqDisc(ctx, x, y, 8, 8, 'rgba(40,30,22,0.88)');
  if (g.kind === 'chess') {
    rqPoly4(ctx, x, y - 5, x + 6, y, x, y + 5, x - 6, y, '#d8b878');
    rqDisc(ctx, x - 1.8, y - 0.6, 1.6, 1.2, '#2a2622'); rqDisc(ctx, x + 1.8, y + 0.6, 1.6, 1.2, '#f4f0e4');
  } else if (g.kind === 'notice') {   // 小卷(寫有字的簡牘)
    rqRect(ctx, x - 4.6, y - 3.4, 9.2, 6.8, '#f0e3bf'); rqRect(ctx, x - 4.6, y - 3.4, 9.2, 1.2, '#8a5a2a'); rqRect(ctx, x - 4.6, y + 2.2, 9.2, 1.2, '#8a5a2a');
  } else if (g.kind === 'show') {   // 小鼓
    rqDisc(ctx, x, y + 0.6, 4.6, 2.8, '#c0392b'); rqDisc(ctx, x, y - 0.4, 4.6, 1.2, '#f4ead2');
  } else if (g.kind === 'market') {   // 錢幣
    rqDisc(ctx, x, y, 4.6, 4.6, '#e6b84a'); rqDisc(ctx, x, y, 1.5, 1.5, '#3a2a22');
  } else {
    rqDisc(ctx, x, y + 0.8, 4.4, 2.6, '#e6cf8e'); rqRect(ctx, x - 3.6, y - 2.8, 7.2, 3.4, '#e6cf8e'); rqDisc(ctx, x, y - 2.6, 3.6, 1.2, '#7a4a2a');
  }
  GATHER.propN += 4;
}

// ───────── 點擊:聚集提示 → 小卡 ─────────
function gatherTap(sx, sy) {
  if (!GATHER.groupsOn || LIFE.placing || !gthUiOk() || gthZoom() < 0.6) return false;
  let best = null, bd = 22 * 22;
  for (let gi = 0; gi < GATHER_POOL; gi++) {
    const g = GATHER.pool[gi];
    if (!g.on || g.n <= 0) continue;
    const p = gthHintPos(g), s = worldToScreen(p[0], p[1]), dx = sx - s[0], dy = sy - s[1], dd = dx * dx + dy * dy;
    if (dd < bd) { bd = dd; best = g; }
  }
  if (!best) return false;
  gthCardShow(best);
  return true;
}
function gthCardKey(g) { return g.kind === 'chess' ? 'chess' : (GATHER_CARD[g.sp.trait] ? g.sp.trait : 'rest'); }
// 百戲目前一段的節目名(每 40 秒換一段);告示一行:生效中的城主令優先(唯讀 cityfx),否則依場次種子挑固定文告
function gthProg(g) {
  if (g.kind !== 'show') return '';
  const gt = g.gt0 + (GATHER.clock - g.clk0);
  return GATHER_SHOW_PROG[Math.floor(gt / 40) % GATHER_SHOW_PROG.length];
}
function gthNoticeText(g) {
  if (typeof DECREE_FX !== 'undefined' && typeof cityFxGetDecree === 'function') {
    for (const dk in DECREE_FX) if (cityFxGetDecree(dk) > 0) return '城主令:' + DECREE_FX[dk].n;
  }
  return GATHER_NOTICE[(g.seed >>> 0) % GATHER_NOTICE.length];
}
function gthCardShow(g) {
  const c = LIFE.card || (typeof lifeCardMake === 'function' ? lifeCardMake() : null);
  if (!c) return;
  const info = GATHER_CARD[gthCardKey(g)];
  let w = 0;
  for (let i = 2; i < GATHER_SLOTS; i++) if (g.kind === 'chess' && g.mem[i]) w++;
  LIFE.cardFor = null;
  if (typeof npcVisitCardHide === 'function') npcVisitCardHide();
  if (typeof npcHeroCardHide === 'function') npcHeroCardHide();
  c.nameEl.textContent = info.title;
  c.typeEl.textContent = g.kind === 'chess' ? '圍棋' : '街景';
  const gt = g.kind === 'chess' ? g.gt0 + (GATHER.clock - g.clk0) : 0;
  let txt = info.desc.replace('{w}', String(w)).replace('{n}', String(g.n)).replace('{p}', gthProg(g));
  if (g.kind === 'notice') txt += ' 告示:' + gthNoticeText(g);
  c.greet.textContent = txt + (g.kind === 'chess' ? '(第 ' + Math.floor(gt / g.iv) + ' 手)' : '');
  c.box.style.display = 'block';
  GATHER.cardG = g;
  gthCheerBtn(c, g.kind === 'show' && !g.cheered);
  if (g.kind === 'chess' && typeof document !== 'undefined' && document.createElement) {
    if (!GATHER.cardCv) {
      GATHER.cardCv = document.createElement('canvas');
      GATHER.cardCv.width = 108; GATHER.cardCv.height = 108;
      GATHER.cardCv.style.cssText = 'display:block;margin:6px auto 2px;border-radius:4px;';
      c.box.appendChild(GATHER.cardCv);
    }
    GATHER.cardCv.style.display = 'block';
    gthDrawCardBoard(GATHER.cardCv, g, Math.floor(gt / g.iv));
  } else if (GATHER.cardCv) GATHER.cardCv.style.display = 'none';
}
function gthDrawCardBoard(cv, g, moves) {   // 9×9 小棋盤:依種子與手數確定性排子,只在開卡時畫一次
  if (!cv.getContext) return;
  const x = cv.getContext('2d');
  if (!x) return;
  x.fillStyle = '#d9b872'; x.fillRect(0, 0, 108, 108);
  x.strokeStyle = '#6a4a22'; x.lineWidth = 1;
  for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(10 + i * 11, 10); x.lineTo(10 + i * 11, 98); x.moveTo(10, 10 + i * 11); x.lineTo(98, 10 + i * 11); x.stroke(); }
  const cnt = Math.min(moves, 60);
  for (let k = 0; k < cnt; k++) {
    const h = lifeHash(g.game.seed, k);
    x.fillStyle = (k & 1) ? '#f4f0e4' : '#2a2622';
    x.beginPath(); x.arc(10 + (h % 9) * 11, 10 + ((h >>> 8) % 9) * 11, 4.6, 0, Math.PI * 2); x.fill();
  }
}
function gatherCardHide() {
  if (GATHER.cardCv) GATHER.cardCv.style.display = 'none';
  if (GATHER.cheerEl) GATHER.cheerEl.style.display = 'none';
}

// 小卡:聚集成員的台詞與「正在…」
function gatherLines(n) {
  const g = gthGroupOf(n);
  if (!g || !g.on) return null;
  if (g.kind === 'chess') return n.gr === 1 ? GATHER_LINES.chess.player : GATHER_LINES.chess.watch;
  if (g.kind === 'notice') return n.gr === 1 ? GATHER_LINES.notice.speak : GATHER_LINES.notice.read;
  if (g.kind === 'show') {
    if (gatherCheering(g)) return n.gr === 1 ? GATHER_LINES.show.cheer : GATHER_LINES.show.cheerWatch;
    return g.sp.trait === 'story' ? GATHER_LINES.show.story : (n.gr === 1 ? GATHER_LINES.show.perf : GATHER_LINES.show.audience);
  }
  if (g.kind === 'market') {
    if (g.sp.nst) return GATHER_LINES.market.night;
    return n.gr === 1 ? GATHER_LINES.market.crier : (n.gbub === 'trade' ? GATHER_LINES.market.trade : GATHER_LINES.market.watch);
  }
  const R = GATHER_LINES.rest;
  if (n.gmode === 'nap') return R.nap;
  if (g.sp.trait === 'cargo') return R.porter;
  return R[g.sp.trait] || R.sit;
}
function gatherActText(n) {
  const g = gthGroupOf(n);
  if (!g || !g.on) return '';
  if (g.kind === 'chess') {
    if (n.gr === 1) { const o = g.mem[1 - n.gs]; return '和' + (o ? o.name : '人') + '下棋(第 ' + Math.floor((g.gt0 + (GATHER.clock - g.clk0)) / g.iv) + ' 手)'; }
    return '圍觀下棋';
  }
  if (g.kind === 'notice') return n.gr === 1 ? '在告示前宣讀' : '圍看告示';
  if (g.kind === 'show') return g.sp.trait === 'story' ? '在說書台前說書' : (n.gr === 1 ? '表演百戲' : '圍看百戲');
  if (g.kind === 'market') return g.sp.nst ? '在夜市攤前看貨' : (n.gr === 1 ? '在攤前吆喝叫賣' : '在攤前挑貨');
  if (n.gmode === 'nap') return '打盹';
  const tr = g.sp.trait;
  return tr === 'shade' ? '在樹蔭下乘涼' : tr === 'well' ? '在井邊閒聊' : tr === 'tea' ? '喝茶歇腳' : tr === 'cargo' ? '坐在貨堆上歇腳' : '坐著歇腳聊天';
}

// 開發用:?perf 的 console 輸出併入
function gatherStats() {
  const s = GATHER.stats;
  s.groups = GATHER.groupsOn; s.members = GATHER.members; s.props = Math.max(GATHER.propLast, GATHER.propN); s.tickMs = Math.round(GATHER.tickAcc * 1000) / 1000; s.drawMs = Math.round(GATHER.drawAcc * 1000) / 1000;
  s.specsWithPose = GATHER.poseN; s.tier = GATHER.tier; s.spots = GATHER.spots.length;
  return s;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { GATHER };
