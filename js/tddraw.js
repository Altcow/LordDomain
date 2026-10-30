// tddraw.js — 戰鬥陣與戰鬥畫面繪製(PLAN_TD_MASTER §6.1)

// 戰陣占位外觀（M0-06）：render.js drawObject 的 default 分支呼叫；回傳 false 時走洋紅方塊
// 朝向：objFacing(o) 對應 DIRS[0..3]；建築前緣外側畫黃色箭頭表示朝向

function tdFlag(ctx, px, py, base, poleH, fw, fh, color, dx, dy) {
  drawBox(ctx, px - 0.03, py - 0.03, 0.06, 0.06, base, poleH, shade(PAL.wood, 0.7));
  const top = base + poleH;
  const pts = [gpt(px, py, top), gpt(px + dx * fw, py + dy * fw, top - 2), gpt(px + dx * fw, py + dy * fw, top - 2 - fh), gpt(px, py, top - fh)];
  poly(ctx, pts, color);
  outline(ctx, pts, shade(color, 0.6), 1);
}

function tdArrow(ctx, x, y, w, h, dx, dy, bh) {
  const ex = x + w / 2 + dx * w / 2, ey = y + h / 2 + dy * h / 2;
  const px = -dy * 0.25, py = dx * 0.25;
  poly(ctx, [
    gpt(ex + dx * 0.5, ey + dy * 0.5, bh + 1),
    gpt(ex + px, ey + py, bh + 1),
    gpt(ex - px, ey - py, bh + 1)
  ], '#f3d36b');
}

function drawCampObject(ctx, o, x, y, w, h, bh, time) {
  const f = DIRS[objFacing(o)] || DIRS[0];
  const dx = f[0], dy = f[1];
  const alongX = dx !== 0;
  const cx = x + w / 2, cy = y + h / 2;
  switch (o.type) {
    case 'hq': {
      drawBox(ctx, x + 0.05, y + 0.05, w - 0.1, h - 0.1, bh, 2, PAL.road);
      drawBox(ctx, x + 0.6, y + 0.6, w - 1.2, h - 1.2, bh + 2, 14, MIL_COL.white);
      drawPyramid(ctx, x + 0.4, y + 0.4, w - 0.8, h - 0.8, bh + 16, 22, MIL_COL.red);
      tdFlag(ctx, x + 0.2, y + 0.2, bh + 2, 50, 0.8, 16, MIL_COL.black, dx, dy);
      tdArrow(ctx, x, y, w, h, dx, dy, bh);
      break;
    }
    case 'tower': {
      drawBox(ctx, x + 0.25, y + 0.25, w - 0.5, h - 0.5, bh, 6, PAL.stone);
      drawBox(ctx, x + 0.45, y + 0.45, w - 0.9, h - 0.9, bh + 6, 28, PAL.wood);
      drawBox(ctx, x + 0.15, y + 0.15, w - 0.3, h - 0.3, bh + 34, 4, PAL.wood);
      drawPyramid(ctx, x + 0.15, y + 0.15, w - 0.3, h - 0.3, bh + 38, 12, PAL.houseRoof);
      tdFlag(ctx, x + 0.3, y + 0.3, bh + 38, 40, 0.5, 10, MIL_COL.black, dx, dy);
      tdArrow(ctx, x, y, w, h, dx, dy, bh);
      break;
    }
    case 'nutai': {
      drawBox(ctx, x + 0.1, y + 0.1, w - 0.2, h - 0.2, bh, 8, PAL.stone);
      if (alongX) {
        drawBox(ctx, x + 0.2, cy - 0.06, w - 0.4, 0.12, bh + 8, 5, PAL.wood);
        drawBox(ctx, cx - 0.06, y + 0.1, 0.12, h - 0.2, bh + 8, 8, shade(PAL.wood, 0.7));
      } else {
        drawBox(ctx, cx - 0.06, y + 0.2, 0.12, h - 0.4, bh + 8, 5, PAL.wood);
        drawBox(ctx, x + 0.1, cy - 0.06, w - 0.2, 0.12, bh + 8, 8, shade(PAL.wood, 0.7));
      }
      tdArrow(ctx, x, y, w, h, dx, dy, bh);
      break;
    }
    case 'shitai': {
      drawBox(ctx, x + 0.1, y + 0.1, w - 0.2, h - 0.2, bh, 10, PAL.stone);
      const tx = cx + dx * 0.8, ty = cy + dy * 0.8;
      edgeLine(ctx, gpt(cx, cy, bh + 10), gpt(tx, ty, bh + 50), shade(PAL.wood, 0.55), 3, 1);
      drawBox(ctx, tx - 0.1, ty - 0.1, 0.2, 0.2, bh + 46, 8, shade(PAL.stone, 0.8));
      tdArrow(ctx, x, y, w, h, dx, dy, bh);
      break;
    }
    case 'tent':
    case 'fakecamp': {
      drawPyramid(ctx, x + 0.15, y + 0.15, w - 0.3, h - 0.3, bh, 22, MIL_COL.hay);
      tdArrow(ctx, x, y, w, h, dx, dy, bh);
      break;
    }
    case 'wagon': {
      drawBox(ctx, x + 0.15, y + 0.2, w - 0.3, h - 0.4, bh + 6, 8, PAL.wood);
      const wheels = alongX ? [[x + w - 0.1, cy - 0.3], [x + w - 0.1, cy + 0.3]] : [[cx - 0.3, y + h - 0.1], [cx + 0.3, y + h - 0.1]];
      wheels.forEach(p => {
        const c = gpt(p[0], p[1], bh + 4);
        ctx.beginPath();
        ctx.arc(c[0], c[1], 4, 0, Math.PI * 2);
        ctx.fillStyle = shade(PAL.wood, 0.6);
        ctx.fill();
      });
      tdArrow(ctx, x, y, w, h, dx, dy, bh);
      break;
    }
    case 'granary': {
      drawBox(ctx, x + 0.2, y + 0.2, w - 0.4, h - 0.4, bh, 6, '#a88a5c');
      const c = gpt(cx, cy, bh + 6);
      ctx.beginPath();
      ctx.arc(c[0], c[1], 22, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#c9a96e';
      ctx.fill();
      tdArrow(ctx, x, y, w, h, dx, dy, bh);
      break;
    }
    case 'muster': {
      drawBox(ctx, x + 0.05, y + 0.05, w - 0.1, h - 0.1, bh, 2, PAL.road);
      drawBox(ctx, x + 0.1, y + 0.1, w - 0.2, 0.1, bh + 2, 16, PAL.wood);
      drawBox(ctx, x + 0.1, y + h - 0.2, w - 0.2, 0.1, bh + 2, 16, PAL.wood);
      drawBox(ctx, x + 0.1, y + 0.1, 0.1, h - 0.2, bh + 2, 16, shade(PAL.wood, 0.9));
      drawBox(ctx, x + w - 0.2, y + 0.1, 0.1, h - 0.2, bh + 2, 16, shade(PAL.wood, 0.9));
      tdFlag(ctx, x + 0.2, y + 0.2, bh + 2, 36, 0.5, 10, MIL_COL.red, dx, dy);
      tdArrow(ctx, x, y, w, h, dx, dy, bh);
      break;
    }
    case 'banner': {
      drawBox(ctx, x + 0.2, y + 0.2, w - 0.4, h - 0.4, bh, 4, PAL.stone);
      tdFlag(ctx, cx, cy, bh + 4, 56, 0.6, 18, MIL_COL.red, dx, dy);
      tdArrow(ctx, x, y, w, h, dx, dy, bh);
      break;
    }
    default:
      return false;
  }
  return true;
}

// 疊圖（M0-06）：只在 battleDesign 模式畫；deployCells 每幀算一次（以 time 為快取鍵）
const TD_ZONE_COL = { 1: 'rgba(240,220,110,.30)', 2: 'rgba(30,110,50,.22)', 3: 'rgba(120,78,40,.34)', 4: 'rgba(120,140,110,.36)', 5: 'rgba(150,205,240,.36)' };
let tdOvTime = NaN, tdOvFront = null, tdOvFlank = null;

function tdOverlayDeploy(time) {
  if (tdOvTime === time) return;
  tdOvTime = time;
  tdOvFront = typeof deployCells === 'function' ? deployCells(world, 'front') : null;
  tdOvFlank = typeof deployCells === 'function' ? deployCells(world, 'flank') : null;
}

function drawOverlayDiag(ctx, d, time) {
  if (game.mode !== 'battleDesign') return;
  tdOverlayDeploy(time);
  const marks = world.marks || {};
  const rally = marks.rally || [], aiEntry = marks.aiEntry || [];
  for (let x = Math.max(0, d - MAP_H + 1); x <= Math.min(d, MAP_W - 1); x++) {
    const y = d - x;
    if (!inBounds(x, y) || !cellVisible(x, y)) continue;
    const i = idx(x, y), h = world.height[i], hp = h * HL;
    const p = topPts(x, y, h, 0);
    const z = world.zone[i], b = world.block[i];
    ctx.save();
    if (TD_ZONE_COL[z]) poly(ctx, p, TD_ZONE_COL[z]);
    if (z === 2) {
      for (let k = 0; k < 3; k++) {
        const c = gpt(x + 0.25 + 0.25 * k, y + 0.3 + 0.2 * k, hp);
        ctx.beginPath();
        ctx.arc(c[0], c[1], 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20,80,35,.9)';
        ctx.fill();
      }
    }
    if (b === 1) {
      poly(ctx, p, 'rgba(220,50,40,.30)');
      edgeLine(ctx, p[0], p[2], '#e0342a', 1.5, 0.9);
      edgeLine(ctx, p[1], p[3], '#e0342a', 1.5, 0.9);
    } else if (b === 2) {
      const c = gpt(x + 0.5, y + 0.5, hp);
      ctx.beginPath();
      ctx.arc(c[0], c[1], 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(170,170,170,.9)';
      ctx.fill();
    }
    if (tdOvFront && tdOvFront[i]) outline(ctx, p, '#ffe58a', 2);
    if (tdOvFlank && tdOvFlank[i]) outline(ctx, p, '#b98ae6', 2);
    rally.forEach(r => {
      if (r.x === x && r.y === y) tdFlag(ctx, x + 0.5, y + 0.5, hp, 26, 0.4, 10, '#ffd65a', 1, 0);
    });
    aiEntry.forEach(a => {
      const r = a.r;
      if (x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3]) outline(ctx, p, '#ff8a1f', 2.5);
    });
    ctx.restore();
  }
}

// ---- 單位與效能(M1-04;PLAN_TD_CORE §4.7、§3.9)----
// 掛點由 render.js draw() 呼叫;battle === null(一般模式)時 drawBattleDiag 不碰 ctx。
// 注意:td.js tdSpawnSquad 目前以 team:1 生成我軍;規格為我方 team 0,見回報。
const TD_TEAM_COL = { 0: '#b8322c', 1: '#3e6fb0' };
const TD_LOD_ZOOM = 0.8;           // view.zoom 低於此值改畫色點
const TD_SKIN = '#f0d0a0';
let tdBkt = null;                  // 對角線分桶:tdBkt[x+y] = [{u, x, y}]
const tdSpecCache = {};            // 隊伍色變體 spec(id 含隊伍 → 離屏快取不互撞)
let tdFpsT0 = -1, tdFpsN = 0, tdFpsVal = 0;

function tdUrlHas(key) {
  try {
    return typeof location !== 'undefined' && new RegExp('[?&]' + key + '(=|&|$)').test(location.search);
  } catch (e) {
    return false;
  }
}

// 內插係數 = acc / SIM_DT;td.js 目前沒有 battle.acc,缺欄位時為 0(只畫上一 tick 位置)
function tdAlpha() {
  if (typeof battle === 'undefined' || battle === null) return 0;
  const a = typeof battle.acc === 'number' ? battle.acc / SIM_DT : 0;
  return a < 0 ? 0 : (a > 1 ? 1 : a);
}

function tdRebuildBuckets(b, alpha) {
  const nd = MAP_W + MAP_H - 1;
  if (tdBkt === null) {
    tdBkt = [];
    for (let k = 0; k < nd; k++) tdBkt.push([]);
  }
  for (let k = 0; k < nd; k++) tdBkt[k].length = 0;
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    if (!(u.hp > 0)) continue;
    const rx = u.px + (u.x - u.px) * alpha, ry = u.py + (u.y - u.py) * alpha;
    let cx = Math.floor(rx), cy = Math.floor(ry);
    if (cx < 0) cx = 0;
    if (cy < 0) cy = 0;
    if (cx >= MAP_W) cx = MAP_W - 1;
    if (cy >= MAP_H) cy = MAP_H - 1;
    tdBkt[cx + cy].push({ u: u, x: rx, y: ry, hz: 0 });
  }
}

function tdClampI(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

// 單位位置的地面高度(像素):格中心之間雙線性內插,走過階梯 / 斜坡時不瞬間跳高
function tdGroundHz(b, x, y) {
  const cx = x - 0.5, cy = y - 0.5;
  const x0 = Math.floor(cx), y0 = Math.floor(cy);
  const fx = cx - x0, fy = cy - y0;
  const xa = tdClampI(x0, 0, MAP_W - 1), xb = tdClampI(x0 + 1, 0, MAP_W - 1);
  const ya = tdClampI(y0, 0, MAP_H - 1), yb = tdClampI(y0 + 1, 0, MAP_H - 1);
  const H = b.map.height;
  const h00 = H[ya * MAP_W + xa], h10 = H[ya * MAP_W + xb];
  const h01 = H[yb * MAP_W + xa], h11 = H[yb * MAP_W + xb];
  const top = h00 + (h10 - h00) * fx, bot = h01 + (h11 - h01) * fx;
  return (top + (bot - top) * fy) * HL;
}

// 單位本 tick 是否爬升(地面高度增加)
function tdClimbing(b, u) {
  return tdGroundHz(b, u.x, u.y) - tdGroundHz(b, u.px, u.py) > 0;
}

// 影子畫在地面(單位所在位置的地面高度處),只在高度 > 0 時畫
function tdShadow(ctx, e) {
  if (!(e.hz > 0)) return;
  const c = gpt(e.x, e.y, e.hz);
  ctx.beginPath();
  ctx.ellipse(c[0], c[1], 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fill();
}

// 已摧毀建築的瓦礫(畫在該格)
function tdRubble(ctx, x, y, hz) {
  poly(ctx, [gpt(x + 0.15, y + 0.15, hz), gpt(x + 0.85, y + 0.15, hz), gpt(x + 0.85, y + 0.85, hz), gpt(x + 0.15, y + 0.85, hz)], 'rgba(90,84,78,.55)');
  for (let k = 0; k < 3; k++) {
    const c = gpt(x + 0.3 + 0.2 * k, y + 0.35 + 0.15 * (k % 2), hz + 3);
    ctx.beginPath();
    ctx.arc(c[0], c[1], 2.5, 0, Math.PI * 2);
    ctx.fillStyle = k === 1 ? '#a09488' : '#8a8076';
    ctx.fill();
  }
}

// 有 ART 人物(依 UNITS.look 或單位 id)則回傳隊伍色變體 spec,否則 null
function tdUnitSpec(u) {
  if (typeof ART === 'undefined' || !ART.UNIT) return null;
  const def = UNITS[u.u] || {};
  const base = ART.UNIT[def.look] || ART.UNIT[u.u] || null;
  if (!base) return null;
  const col = TD_TEAM_COL[u.team] || TD_TEAM_COL[1];
  const key = base.id + '|' + u.team;
  let s = tdSpecCache[key];
  if (!s) {
    s = Object.assign({}, base, { id: 'td_' + key, tunic: col });
    tdSpecCache[key] = s;
  }
  return s;
}

function tdHpBar(ctx, p, u) {
  const w = 12, top = p[1] - 50, f = Math.max(0, u.hp / u.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(p[0] - w / 2 - 0.5, top - 0.5, w + 1, 3);
  ctx.fillStyle = f > 0.5 ? '#6ccf5a' : (f > 0.25 ? '#e8c03a' : '#e0402a');
  ctx.fillRect(p[0] - w / 2, top, w * f, 2);
}

function tdDrawBody(ctx, u, e, p, time, col) {
  const spec = tdUnitSpec(u);
  // 爬升時身體上移 2px(前傾感)並放慢步伐;不增加 chibiPose 的 f / fr 取值數量
  const bx = p[0], by = p[1] - (e.climb ? 2 : 0);
  if (spec !== null && typeof ART.chibiPose === 'function') {
    const moving = u.x !== u.px || u.y !== u.py;
    const sx = (u.x - u.px) - (u.y - u.py);
    ART.chibiPose(ctx, { spec: spec, x: bx, y: by, f: sx > 0 ? 3 : 0, fr: moving ? (Math.floor(time / (e.climb ? 260 : 200)) & 1) : 0 },
      ART.resBucket(view.zoom * viewport.dpr), artTodKey(), typeof currentSeason === 'string' ? currentSeason : undefined);
    return;
  }
  drawBox(ctx, e.x - 0.1, e.y - 0.1, 0.2, 0.2, e.hz, 16, col);
  ctx.beginPath();
  ctx.arc(bx, by - 20, 3, 0, Math.PI * 2);
  ctx.fillStyle = TD_SKIN;
  ctx.fill();
}

function drawBattleDiag(ctx, d, time) {
  if (typeof battle === 'undefined' || battle === null) return;
  const b = battle;
  if (d === 0) {
    tdRebuildBuckets(b, tdAlpha());
    tdDepArr = tdDeployOn() ? deployCells(b.map, 'front') : null;
    tdFxFrame(b, time);
  }
  if (tdBkt === null) return;
  for (let x = Math.max(0, d - MAP_H + 1); x <= Math.min(d, MAP_W - 1); x++) {
    const y = d - x;
    if (!cellVisible(x, y)) continue;
    const i = y * MAP_W + x;
    const bl = tdBldAt(b, i);
    if (bl !== null && !bl.alive) tdRubble(ctx, x, y, b.map.height[i] * HL);
    if (tdDepArr !== null && tdDepArr[i] === 1) poly(ctx, topPts(x, y, b.map.height[i], 0), TD_DEPLOY_FILL);
  }
  const list = tdBkt[d];
  if (list.length === 0) { tdFxDrawDiag(ctx, b, d, time); return; }
  list.sort(function (p, q) { return p.x - q.x; });
  const lod = view.zoom < TD_LOD_ZOOM;
  for (let k = 0; k < list.length; k++) {
    const e = list[k];
    const u = e.u;
    e.hz = tdGroundHz(b, e.x, e.y);
    e.climb = tdClimbing(b, u);
    const p = gpt(e.x, e.y, e.hz);
    const col = TD_TEAM_COL[u.team] || TD_TEAM_COL[1];
    tdShadow(ctx, e);
    if (lod) {
      ctx.beginPath();
      ctx.arc(p[0], p[1] - 8, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    } else {
      tdDrawBody(ctx, u, e, p, time, col);
    }
    const us = tdUnitSeen.get(u);
    if (us !== undefined && time - us.flash < TD_FLASH_MS) tdFlashBody(ctx, p, lod);
    if (u.fx && u.fx.ambush && u.fx.ambush.until > b.tick) tdAmbushEdge(ctx, p);
    if (u.hp < u.maxHp) tdHpBar(ctx, p, u);
  }
  tdFxDrawDiag(ctx, b, d, time);
}

// 隱藏或已摧毀的戰陣物件不畫(依 battle 的 bld;以原點格 + 型別 + 座標比對)
function tdBldOf(o) {
  if (typeof battle === 'undefined' || battle === null || !o) return null;
  if (!(o.x >= 0 && o.y >= 0 && o.x < MAP_W && o.y < MAP_H)) return null;
  const bl = tdBldAt(battle, o.y * MAP_W + o.x);
  if (bl === null || bl.type !== o.type || bl.x !== o.x || bl.y !== o.y) return null;
  return bl;
}

function tdObjSkip(o) {
  const bl = tdBldOf(o);
  if (bl === null) return false;
  return !bl.alive || bl.hidden === true;
}

function tdFpsTick(time) {
  if (typeof time !== 'number') return;
  tdFpsN++;
  if (tdFpsT0 < 0) { tdFpsT0 = time; return; }
  const dt = time - tdFpsT0;
  if (dt >= 500) {
    tdFpsVal = tdFpsN * 1000 / dt;
    tdFpsN = 0;
    tdFpsT0 = time;
  }
}

// ?perf:左下角 FPS 與 sim ms(sim ms 讀 tdPerf.simMs,不存在則只顯示 FPS)
function drawScreenHud(ctx, time) {
  if (!tdUrlHas('perf')) return;
  tdFpsTick(time);
  const lines = ['FPS ' + tdFpsVal.toFixed(0)];
  if (typeof tdPerf !== 'undefined' && tdPerf && typeof tdPerf.simMs === 'number') lines.push('sim ' + tdPerf.simMs.toFixed(2) + ' ms');
  if (typeof battle !== 'undefined' && battle !== null) lines.push('fx ' + tdFxCount);
  const y0 = viewport.h - 18 * lines.length - 6;
  ctx.save();
  ctx.font = '12px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(4, y0, 120, 18 * lines.length + 4);
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < lines.length; k++) ctx.fillText(lines[k], 10, y0 + 2 + 18 * k);
  ctx.restore();
}

// ?flow:畫 battle.fields 中第一張已建好的流場方向(除錯用)
function drawWorldOverlay(ctx, time) {
  if (typeof battle !== 'undefined' && battle !== null) tdOverlayRings(ctx, battle);
  if (!tdUrlHas('flow')) return;
  if (typeof battle === 'undefined' || battle === null || !battle.fields) return;
  let f = null;
  for (const v of battle.fields.values()) {
    if (v && v.dist) { f = v; break; }
  }
  if (f === null) return;
  const P = getPass(battle, f.profile);
  const dist = f.dist;
  ctx.save();
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!cellVisible(x, y)) continue;
      const i = y * MAP_W + x;
      if (dist[i] === 0 || dist[i] === PATH_INF) continue;
      const j = fieldDir(dist, i, P);
      if (j < 0) continue;
      const a = gpt(x + 0.5, y + 0.5, battle.map.height[i] * HL + 2);
      const c = gpt((j % MAP_W) + 0.5, Math.floor(j / MAP_W) + 0.5, battle.map.height[j] * HL + 2);
      edgeLine(ctx, a, c, 'rgba(255,240,120,.8)', 1, 1);
      ctx.beginPath();
      ctx.arc(c[0], c[1], 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,240,120,.9)';
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---- 戰鬥演出(M2-07;PLAN_TD_MASTER M2-07、PLAN_TD_CORE §4.7)----
// 純視覺:只讀 battle,不寫入模擬狀態。td.js 沒有投射物事件,射擊以 bl.cd 由低跳高(重置)推算;
// 目標優先取 bl.btgt(建築實際鎖定者),失效時退回射程內最近的攻方。每幀只在 d === 0 掃描一次。
const TD_FX_LIFE = 300;             // 投射物 / 落點圈存活毫秒(0.3 秒)
const TD_FX_DUST_LIFE = 600;        // 塵煙存活毫秒
const TD_FX_SHARD_LIFE = 500;       // 碎片存活毫秒
const TD_FX_PROJ_MAX = 60;          // 同時投射物(含落點圈)上限
const TD_FX_PART_MAX = 120;         // 同時塵煙 / 碎片上限
const TD_FLASH_MS = 120;            // 受擊閃白時間(約 1~2 幀)
const TD_DEPLOY_FILL = 'rgba(255,230,120,.24)';
const TD_AMBUSH_EDGE = 'rgba(255,215,120,.9)';
const TD_RANGE_COL = 'rgba(255,255,255,.7)';
const TD_FLAG_COL = 'rgba(255,214,90,.9)';
const TD_DUST_OFF = [[0, 0], [0.4, 0.2], [-0.3, 0.4], [0.2, -0.4], [-0.4, -0.2]];
const TD_SHARD_OFF = [[0.2, 0.1, 8], [-0.3, 0.2, 12], [0.1, -0.3, 6], [-0.2, -0.2, 10]];
let tdFx = [];                      // 視覺項目;pr = true 為投射物 / 落點圈,其餘為塵煙 / 碎片
let tdFxBkt = null;                 // 依對角線分桶(同 tdBkt),每幀由 tdFxFrame 重建
let tdFxCount = 0;                  // ?perf 顯示用:目前視覺項目數
let tdDepArr = null;                // 本幀可部署格(deployCells 結果,或 null)
const tdBldSeen = new WeakMap();    // bl -> { cd, alive }
const tdUnitSeen = new WeakMap();   // u -> { hp, flash }

// 觀察期或沙盤已選卡時高亮可部署格
function tdDeployOn() {
  if (game.phase === 'scout') return true;
  return typeof sand !== 'undefined' && sand !== null && !!sand.card;
}

// 上限內才加入;投射物 / 落點圈共用 TD_FX_PROJ_MAX,塵煙 / 碎片用 TD_FX_PART_MAX
function tdFxPush(it) {
  let np = 0, nq = 0;
  for (let k = 0; k < tdFx.length; k++) {
    if (tdFx[k].pr) np++; else nq++;
  }
  if (it.pr ? np >= TD_FX_PROJ_MAX : nq >= TD_FX_PART_MAX) return false;
  tdFx.push(it);
  return true;
}

// 建築射程內最近的存活攻方(btgt 失效時的退路)
function tdFxNearest(b, bl, range) {
  let best = null, bd = Infinity;
  for (let k = 0; k < b.atkList.length; k++) {
    const u = b.atkList[k];
    if (!(u.hp > 0)) continue;
    const d = tdDist(bl, u.x, u.y);
    if (d > range + 0.5) continue;
    if (d < bd || (d === bd && best !== null && u.id < best.id)) { best = u; bd = d; }
  }
  return best;
}

// 射擊:single 為箭線、aoe(投石台)為石彈弧線並加落點圈、pierce(弩台)為弩矢
function tdFxShot(b, bl, time) {
  const cb = bl.cb;
  let t = bl.btgt;
  if (!(t && t.hp > 0)) t = tdFxNearest(b, bl, cb.range);
  if (!t) return;
  const kind = cb.mode === 'aoe' ? 'stone' : (cb.mode === 'pierce' ? 'bolt' : 'arrow');
  const cx = bl.x + bl.w / 2, cy = bl.y + bl.h / 2;
  const hz = b.map.height[bl.y * MAP_W + bl.x] * HL;
  const it = {
    pr: true, k: kind, t0: time, life: TD_FX_LIFE, sx: cx, sy: cy, sz: hz + 36,
    eu: t, ex: t.x, ey: t.y, ez: 0, arc: kind === 'stone' ? 36 : (kind === 'arrow' ? 10 : 0), p: 0
  };
  if (!tdFxPush(it)) return;
  if (kind === 'stone' && cb.aoe > 0) {
    tdFxPush({ pr: true, k: 'ring', t0: time, life: TD_FX_LIFE, x: t.x, y: t.y, z: tdGroundHz(b, t.x, t.y) + 1, r: cb.aoe, p: 0 });
  }
}

// 建築摧毀:塵煙與碎片(隱藏建築不畫)
function tdFxDestroy(b, bl, time) {
  if (bl.hidden) return;
  const cx = bl.x + bl.w / 2, cy = bl.y + bl.h / 2;
  const hz = b.map.height[bl.y * MAP_W + bl.x] * HL;
  for (let k = 0; k < TD_DUST_OFF.length; k++) {
    const o = TD_DUST_OFF[k];
    tdFxPush({ pr: false, k: 'dust', t0: time, life: TD_FX_DUST_LIFE, x: cx + o[0] * bl.w, y: cy + o[1] * bl.h, z: hz + 6, p: 0 });
  }
  for (let k = 0; k < TD_SHARD_OFF.length; k++) {
    const o = TD_SHARD_OFF[k];
    tdFxPush({ pr: false, k: 'shard', t0: time, life: TD_FX_SHARD_LIFE, x: cx + o[0] * bl.w, y: cy + o[1] * bl.h, z: hz + o[2], p: 0 });
  }
}

// 每幀掃描:建築 cd 重置 → 射擊;存活轉死亡 → 摧毀;單位 hp 下降 → 閃白
function tdFxScan(b, time) {
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    const s = tdBldSeen.get(bl);
    if (s === undefined) { tdBldSeen.set(bl, { cd: bl.cd, alive: bl.alive }); continue; }
    if (!bl.hidden) {
      if (s.alive && !bl.alive) tdFxDestroy(b, bl, time);
      else if (bl.alive && bl.cb.atk > 0 && bl.cd > s.cd) tdFxShot(b, bl, time);
    }
    s.cd = bl.cd;
    s.alive = bl.alive;
  }
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    const s = tdUnitSeen.get(u);
    if (s === undefined) { tdUnitSeen.set(u, { hp: u.hp, flash: -1e9, cd: u.cdT }); continue; }
    if (u.hp < s.hp) s.flash = time;
    if (u.cdT > s.cd && u.hp > 0) tdFxUnitShot(b, u, time);
    s.hp = u.hp;
    s.cd = u.cdT;
  }
}

// 遠程單位(射程 ≥ 2,如弓兵)出手:cdT 重置即為一次射擊,畫箭線朝目標飛去
// 目標取 utgt(單位)或 tgt(建築),皆為攻擊當 tick 的鎖定目標(近似)
function tdFxUnitShot(b, u, time) {
  const def = UNITS[u.u];
  if (!def || !(def.range >= 2)) return;
  const t = u.utgt && u.utgt.hp > 0 ? u.utgt : (u.tgt && u.tgt.hp > 0 ? u.tgt : null);
  if (t === null) return;
  const isUnit = 'team' in t;
  const tx = isUnit ? t.x : t.x + t.w / 2, ty = isUnit ? t.y : t.y + t.h / 2;
  tdFxPush({
    pr: true, k: 'arrow', t0: time, life: TD_FX_LIFE, sx: u.x, sy: u.y, sz: tdGroundHz(b, u.x, u.y) + 14,
    eu: isUnit ? t : null, ex: tx, ey: ty, ez: 0, arc: 6, p: 0
  });
}

// 更新一個視覺項目的地面位置 it.gx / gy / gz 與進度 it.p(投射物的目標若仍存活則跟隨其位置)
function tdFxAt(it, b, time) {
  const p = Math.min(1, Math.max(0, (time - it.t0) / it.life));
  it.p = p;
  if (!it.pr) {
    it.gx = it.x; it.gy = it.y;
    it.gz = it.z + (it.k === 'dust' ? 20 * p : 30 * Math.sin(Math.PI * p));
    return;
  }
  if (it.k === 'ring') {
    it.gx = it.x; it.gy = it.y; it.gz = it.z;
    return;
  }
  const u = it.eu;
  if (u && u.hp > 0) { it.ex = u.x; it.ey = u.y; }
  it.ez = tdGroundHz(b, it.ex, it.ey) + 10;
  it.gx = it.sx + (it.ex - it.sx) * p;
  it.gy = it.sy + (it.ey - it.sy) * p;
  it.gz = it.sz + (it.ez - it.sz) * p + Math.sin(Math.PI * p) * it.arc;
}

// 投射物在螢幕上的位置(依進度 p)
function tdFxScreen(it, p) {
  const gx = it.sx + (it.ex - it.sx) * p, gy = it.sy + (it.ey - it.sy) * p;
  return gpt(gx, gy, it.sz + (it.ez - it.sz) * p + Math.sin(Math.PI * p) * it.arc);
}

// 每幀開頭:清除過期項目、掃描事件、依對角線分桶
function tdFxFrame(b, time) {
  let w = 0;
  for (let k = 0; k < tdFx.length; k++) {
    const it = tdFx[k];
    if (time - it.t0 < it.life) tdFx[w++] = it;
  }
  tdFx.length = w;
  tdFxScan(b, time);
  if (tdFxBkt === null) {
    tdFxBkt = [];
    for (let k = 0; k < MAP_W + MAP_H - 1; k++) tdFxBkt.push([]);
  }
  for (let k = 0; k < tdFxBkt.length; k++) tdFxBkt[k].length = 0;
  for (let k = 0; k < tdFx.length; k++) {
    const it = tdFx[k];
    tdFxAt(it, b, time);
    tdFxBkt[tdClampI(Math.floor(it.gx) + Math.floor(it.gy), 0, tdFxBkt.length - 1)].push(it);
  }
  tdFxCount = tdFx.length;
}

function tdFxDrawOne(ctx, it) {
  const p = it.p;
  ctx.globalAlpha = 1;
  if (it.k === 'ring') {
    const r = it.r * (0.5 + 0.5 * p);
    ctx.globalAlpha = 1 - p;
    ctx.beginPath();
    for (let a = 0; a <= 24; a++) {
      const q = gpt(it.gx + r * Math.cos(a * Math.PI / 12), it.gy + r * Math.sin(a * Math.PI / 12), it.gz + 1);
      if (a === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
    ctx.strokeStyle = 'rgba(255,140,60,1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }
  if (it.k === 'dust') {
    const c = gpt(it.gx, it.gy, it.gz);
    ctx.globalAlpha = 0.55 * (1 - p);
    ctx.beginPath();
    ctx.arc(c[0], c[1], 3 + 6 * p, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(130,122,112)';
    ctx.fill();
    return;
  }
  if (it.k === 'shard') {
    const c = gpt(it.gx, it.gy, it.gz);
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = '#8a8076';
    ctx.fillRect(c[0] - 1.5, c[1] - 1.5, 3, 3);
    return;
  }
  const h = tdFxScreen(it, p);
  if (it.k === 'stone') {
    ctx.beginPath();
    ctx.arc(h[0], h[1], 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#6f675e';
    ctx.fill();
    return;
  }
  const t = tdFxScreen(it, Math.max(0, p - 0.15));
  edgeLine(ctx, t, h, it.k === 'bolt' ? '#d8c39a' : '#f3d36b', it.k === 'bolt' ? 2 : 1.2, 1);
}

// 本對角線的視覺項目 + 令旗插旗圖示
function tdFxDrawDiag(ctx, b, d, time) {
  if (tdFxBkt === null) return;
  const list = tdFxBkt[d];
  if (list.length > 0) {
    ctx.save();
    for (let k = 0; k < list.length; k++) tdFxDrawOne(ctx, list[k]);
    ctx.restore();
  }
  const f = b.flag;
  if (f && typeof f.x === 'number' && typeof f.y === 'number' && Math.floor(f.x) + Math.floor(f.y) === d) {
    tdFlag(ctx, f.x, f.y, tdGroundHz(b, f.x, f.y), 26, 0.4, 10, TD_FLAG_COL, 1, 0);
  }
}

// 受擊閃白(一兩幀):白色小橢圓蓋在人物身上
function tdFlashBody(ctx, p, lod) {
  ctx.beginPath();
  if (lod) ctx.arc(p[0], p[1] - 8, 3, 0, Math.PI * 2);
  else ctx.ellipse(p[0], p[1] - 14, 7, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.fill();
}

// 伏兵奇襲期間的淡金邊
function tdAmbushEdge(ctx, p) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(p[0], p[1] - 12, 9, 0, Math.PI * 2);
  ctx.strokeStyle = TD_AMBUSH_EDGE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

// 地面圓(射程圈、令旗半徑):以格座標畫在地面上
function tdRing(ctx, b, cx, cy, r, stroke, fill) {
  const hz = tdGroundHz(b, cx, cy) + 2;
  ctx.save();
  ctx.beginPath();
  for (let a = 0; a <= 48; a++) {
    const q = gpt(cx + r * Math.cos(a * Math.PI / 24), cy + r * Math.sin(a * Math.PI / 24), hz);
    if (a === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// 疊圖:令旗半徑(battle.flag 若存在)與選中建築的射程圈(game.sel 為 battle.bld 索引)
function tdOverlayRings(ctx, b) {
  const f = b.flag;
  if (f && typeof f.x === 'number' && typeof f.y === 'number') {
    tdRing(ctx, b, f.x, f.y, typeof f.r === 'number' ? f.r : FX.flag.r, TD_FLAG_COL, 'rgba(255,214,90,.12)');
  }
  const n = game.sel;
  if (typeof n !== 'number' || !(n >= 0) || n >= b.bld.length) return;
  const bl = b.bld[n];
  if (!tdLive(bl) || !(bl.cb.atk > 0) || !(bl.cb.range > 0)) return;
  tdRing(ctx, b, bl.x + bl.w / 2, bl.y + bl.h / 2, bl.cb.range + 0.5, TD_RANGE_COL, 'rgba(255,255,255,.08)');
}
