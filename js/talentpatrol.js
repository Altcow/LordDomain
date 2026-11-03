// talentpatrol.js — 人才巡視與建築綠光(PLAN_NOLEVEL「建築動畫與人才巡視綠光」)。
// 人才(world.city.talents 占位:[{id, name, bids:[建築 id…], home?:{x,y}}];建築 id = world.objects 索引+1)定時沿道路走到名下建築,
// 到達時該建築綠色柔光脈衝約 2 秒(預烘焙光暈精靈 + globalAlpha),並給暫時營運加成旗標。只提供查詢 talentPatrolBoost(bid),不改產量公式。
// 確定性:所有隨機來自 tpHash(seed, 人才 id, 序號);時間來自 tick 累積的 dt,不讀 Date.now。存檔只存 {s,t,n,b}(行走中的人不存,載入後重排)。
// 全域名稱:talentPatrolTick talentPatrolDraw talentPatrolBoost talentPatrolSave talentPatrolLoad talentPatrolReset talentPatrolStats
//          純邏輯 tpHash tpPlan tpFindPath tpCap tpCull tpStep;其餘內部一律 TP / tpXxx。
const TP_CFG = { cap: 6, period: 24, walkSpeed: 1.8, pulseSec: 2, boostSec: 90, maxNodes: 3000, maxWalkSec: 40 };
const TP = { seed: 1, t: 0, next: {}, walkers: [], pulses: [], boosts: {}, stats: { spawned: 0, arrived: 0, nopath: 0, drawn: 0 }, sprite: null };

function tpHash(seed, a, b) {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(a | 0, 0x85ebca6b) ^ Math.imul(b | 0, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// 同時巡視上限:省電模式減半(至少 1)
function tpCap(powerSave) { return powerSave ? Math.max(1, TP_CFG.cap >> 1) : TP_CFG.cap; }

// 排程:這位人才的第 k 次巡視 → { bid, wait }(wait 為與上次的間隔秒數,0.5~1.5 倍週期)
function tpPlan(seed, talent, k) {
  const bids = talent && talent.bids;
  if (!bids || !bids.length) return null;
  const bid = bids[Math.floor(tpHash(seed, talent.id, k * 2) * bids.length) % bids.length];
  return { bid: bid, wait: TP_CFG.period * (0.5 + tpHash(seed, talent.id, k * 2 + 1)) };
}

// 沿道路 BFS(四向,固定方向順序 → 確定性):從 from 走到緊鄰建築 footprint(b = {x,y,w,h})的可走格;回傳格子陣列或 null
function tpFindPath(passable, from, b, maxNodes) {
  const inX = x => x >= b.x && x < b.x + b.w, inY = y => y >= b.y && y < b.y + b.h;
  const adj = (x, y) => (inX(x) && (y === b.y - 1 || y === b.y + b.h)) || (inY(y) && (x === b.x - 1 || x === b.x + b.w));
  if (!passable(from.x, from.y)) return null;
  const key = (x, y) => y * 65536 + x, prev = new Map(), q = [from];
  prev.set(key(from.x, from.y), -1);
  const D = [[1, 0], [0, 1], [-1, 0], [0, -1]], lim = maxNodes || TP_CFG.maxNodes;
  for (let qi = 0; qi < q.length && qi < lim; qi++) {
    const c = q[qi];
    if (adj(c.x, c.y)) {
      const out = [];
      for (let k = key(c.x, c.y); k !== -1; ) { out.push({ x: k % 65536, y: Math.floor(k / 65536) }); k = prev.get(k); }
      return out.reverse();
    }
    for (let d = 0; d < 4; d++) {
      const nx = c.x + D[d][0], ny = c.y + D[d][1], nk = key(nx, ny);
      if (nx < 0 || ny < 0 || prev.has(nk) || !passable(nx, ny)) continue;
      prev.set(nk, key(c.x, c.y));
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}

// 視錐剔除:螢幕座標 (sx,sy) 加邊距後是否完全在視窗 (w,h) 之外
function tpCull(sx, sy, w, h, margin) {
  const m = margin === undefined ? 60 : margin;
  return sx < -m || sy < -m || sx > w + m || sy > h + m;
}

// env: { powerSave, talents, passable(x,y), building(bid)->{x,y,w,h}|null, home(talent)->{x,y}|null }
function tpStep(dt, env) {
  const cap = tpCap(!!env.powerSave), tl = env.talents || [];
  TP.t += dt;
  for (let i = 0; i < tl.length; i++) {
    const tk = tl[i];
    if (!tk || !tk.bids || !tk.bids.length) continue;
    const st = TP.next[tk.id] || (TP.next[tk.id] = { k: 0, at: 0 });
    if (!st.at) { const p0 = tpPlan(TP.seed, tk, 0); st.at = p0 ? p0.wait * 0.3 : 1e15; }
    if (TP.t < st.at || TP.walkers.length >= cap) continue;
    if (TP.walkers.some(w => w.tid === tk.id)) continue;
    const p = tpPlan(TP.seed, tk, st.k), b = p && env.building(p.bid), from = env.home(tk);
    st.k++;
    const nx = tpPlan(TP.seed, tk, st.k);
    st.at = TP.t + (nx ? nx.wait : 1e15);
    if (!b || !from) continue;
    const path = tpFindPath(env.passable, from, b);
    if (!path) { TP.stats.nopath++; continue; }
    TP.walkers.push({ tid: tk.id, bid: p.bid, path: path, s: 0, born: TP.t });
    TP.stats.spawned++;
  }
  for (let i = TP.walkers.length - 1; i >= 0; i--) {
    const w = TP.walkers[i];
    w.s += dt * TP_CFG.walkSpeed;
    if (w.s >= w.path.length - 1 || TP.t - w.born > TP_CFG.maxWalkSec) {
      TP.pulses.push({ bid: w.bid, t0: TP.t });
      TP.boosts[w.bid] = TP.t + TP_CFG.boostSec;
      TP.walkers.splice(i, 1);
      TP.stats.arrived++;
    }
  }
  for (let i = TP.pulses.length - 1; i >= 0; i--) if (TP.t - TP.pulses[i].t0 > TP_CFG.pulseSec) TP.pulses.splice(i, 1);
  for (const k in TP.boosts) if (TP.boosts[k] <= TP.t) delete TP.boosts[k];
}

function talentPatrolBoost(bid) { return !!(TP.boosts[bid] && TP.boosts[bid] > TP.t); }
function talentPatrolReset(seed) {
  TP.seed = (seed | 0) || 1; TP.t = 0; TP.next = {}; TP.walkers = []; TP.pulses = []; TP.boosts = {};
  TP.stats = { spawned: 0, arrived: 0, nopath: 0, drawn: 0 };
}
function talentPatrolStats() {
  return { walkers: TP.walkers.length, pulses: TP.pulses.length, boosts: Object.keys(TP.boosts).length, spawned: TP.stats.spawned, arrived: TP.stats.arrived, nopath: TP.stats.nopath, drawn: TP.stats.drawn, t: TP.t };
}

// 存讀檔:只存時間、各人才下一次排程、剩餘加成秒數(行走中與脈衝不存)
function talentPatrolSave() {
  const n = {}, b = {};
  for (const id in TP.next) n[id] = [TP.next[id].k, Math.round(TP.next[id].at * 10) / 10];
  for (const id in TP.boosts) if (TP.boosts[id] > TP.t) b[id] = Math.round((TP.boosts[id] - TP.t) * 10) / 10;
  return { s: TP.seed, t: Math.round(TP.t * 10) / 10, n: n, b: b };
}
function talentPatrolLoad(d) {
  talentPatrolReset(d && d.s);
  if (!d || typeof d !== 'object') return;
  if (typeof d.t === 'number' && d.t >= 0) TP.t = d.t;
  for (const id in (d.n || {})) { const v = d.n[id]; if (Array.isArray(v) && isFinite(v[0]) && isFinite(v[1])) TP.next[id] = { k: v[0] | 0, at: +v[1] }; }
  for (const id in (d.b || {})) if (isFinite(d.b[id]) && d.b[id] > 0) TP.boosts[id] = TP.t + +d.b[id];
}

// ---- 遊戲接線 ----
function tpEnv() {
  const city = typeof world !== 'undefined' && world && world.city;
  if (!city || !city.talents || !city.talents.length) return null;
  const pass = (x, y) => x >= 0 && y >= 0 && x < boardW() && y < boardH() && world.terrain[idx(x, y)] === T_ROAD && !world.occ[idx(x, y)];
  const bld = bid => {
    const o = world.objects[bid - 1];
    if (!o) return null;
    const fp = footprint(o.type, o.rot);
    return { x: o.x, y: o.y, w: fp[0], h: fp[1] };
  };
  return {
    powerSave: typeof isPowerSave === 'function' && isPowerSave(),
    talents: city.talents,
    passable: pass,
    building: bld,
    // 出發點:人才自訂 home,否則取名下第一棟建築周圍(半徑 3 內)第一個道路格
    home: tk => {
      if (tk.home) return tk.home;
      const b = bld(tk.bids[0]);
      if (!b) return null;
      for (let r = 1; r <= 3; r++)
        for (let y = b.y - r; y < b.y + b.h + r; y++)
          for (let x = b.x - r; x < b.x + b.w + r; x++) if (pass(x, y)) return { x: x, y: y };
      return null;
    }
  };
}

function talentPatrolTick(dt) {
  if (typeof REC !== 'undefined' && REC && REC.state === 'recording' && REC.opts && REC.opts.clean) return;
  const env = tpEnv();
  if (env) tpStep(Math.min(dt, 0.25), env);
}

function tpGlow() {
  if (TP.sprite || typeof document === 'undefined') return TP.sprite;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  if (!g) return null;
  const gr = g.createRadialGradient(48, 48, 2, 48, 48, 46);
  gr.addColorStop(0, 'rgba(150,255,150,0.85)');
  gr.addColorStop(0.5, 'rgba(90,220,110,0.35)');
  gr.addColorStop(1, 'rgba(60,200,90,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 96, 96);
  TP.sprite = c;
  return c;
}

// 每幀入口(render 疊加鉤子):time 為毫秒時鐘,由相鄰兩幀差換算 dt 後 tick,再繪製
function talentPatrolDraw(ctx, time) {
  if (typeof time === 'number') {
    const dt = TP.last ? (time - TP.last) / 1000 : 0;
    TP.last = time;
    if (dt > 0) talentPatrolTick(dt);
  }
  if (!TP.pulses.length && !TP.walkers.length) return;
  if (typeof recCleanActive === 'function' && recCleanActive()) return;
  const sp = TP.sprite || tpGlow(), W = viewport.w, H = viewport.h;
  const cap = tpCap(typeof isPowerSave === 'function' && isPowerSave());
  let n = 0;
  ctx.save();
  for (let i = 0; i < TP.pulses.length && n < cap; i++) {
    const p = TP.pulses[i], o = world.objects[p.bid - 1];
    if (!o || !sp) continue;
    const fp = footprint(o.type, o.rot), cx = o.x + fp[0] / 2, cy = o.y + fp[1] / 2;
    const s = worldToScreen(isoX(cx, cy), isoY(cx, cy, 1));
    if (tpCull(s[0], s[1], W, H, 80)) continue;
    const u = Math.min(1, (TP.t - p.t0) / TP_CFG.pulseSec), r = (40 + 30 * Math.sin(u * Math.PI)) * view.zoom;
    ctx.globalAlpha = 0.75 * Math.sin(u * Math.PI);
    ctx.drawImage(sp, s[0] - r, s[1] - r * 0.6, r * 2, r * 1.2);
    n++;
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#7dff8a';
  for (let i = 0; i < TP.walkers.length; i++) {
    const w = TP.walkers[i], a = Math.min(w.path.length - 1, Math.floor(w.s)), b = Math.min(w.path.length - 1, a + 1), f = w.s - a;
    const gx = w.path[a].x + 0.5 + (w.path[b].x - w.path[a].x) * f, gy = w.path[a].y + 0.5 + (w.path[b].y - w.path[a].y) * f;
    const s = worldToScreen(isoX(gx, gy), isoY(gx, gy, 0));
    if (tpCull(s[0], s[1], W, H, 20)) continue;
    ctx.beginPath();
    ctx.arc(s[0], s[1] - 4 * view.zoom, Math.max(2, 3 * view.zoom), 0, 6.283);
    ctx.fill();
    n++;
  }
  ctx.restore();
  TP.stats.drawn = n;
}
