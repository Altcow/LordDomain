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
const TD_LOD_ZOOM = 0.35;          // view.zoom 低於此值改畫色點
const TD_SKIN = '#f0d0a0';

// 小縮放色點半徑(world 單位):直徑 2r × view.zoom = CSS px,至少 3px(dpr 由 transform 一併換算)
function tdLodR() { return Math.max(2.4, 1.5 / view.zoom); }

// 色點:攻方(team 0)圓點、守方方點;白色細邊(CSS 寬 ≥ 0.5px)
function tdLodDot(ctx, x, y, team, r) {
  ctx.beginPath();
  if (team === 0) ctx.arc(x, y, r, 0, Math.PI * 2);
  else ctx.rect(x - r, y - r, 2 * r, 2 * r);
  ctx.fillStyle = TD_TEAM_COL[team] || TD_TEAM_COL[1];
  ctx.fill();
  ctx.lineWidth = Math.max(0.9, 0.5 / view.zoom);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
}
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

// 單位是否攀爬中(td.js u.climbing:跨入攀爬邊後、走出一格高度前)
function tdClimbing(b, u) {
  return !!u.climbing;
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

// 體型倍率:放置單位依 pop 放大(pop 1 = 1.0、pop 5 ≈ 1.5、上限 1.6);守軍 / 無 st 者 1.0
function tdBodyScale(u) {
  if (!u.st || u.st.pop <= 1) return 1;
  const s = 1 + 0.125 * (u.st.pop - 1);
  return s > 1.6 ? 1.6 : s;
}

// 血條依該單位 HP(u.hp / u.maxHp);大體型者條較寬、較高
function tdHpBar(ctx, p, u) {
  const s = tdBodyScale(u), w = 12 * s, top = p[1] - 50 * s, f = Math.max(0, u.hp / u.maxHp);
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
    const bs = tdBodyScale(u);
    if (bs !== 1) { ctx.save(); ctx.translate(bx, by); ctx.scale(bs, bs); ctx.translate(-bx, -by); }
    ART.chibiPose(ctx, { spec: spec, x: bx, y: by, f: sx > 0 ? 3 : 0, fr: moving ? (Math.floor(time / (e.climb ? 260 : 200)) & 1) : 0 },
      ART.resBucket(view.zoom * viewport.dpr), artTodKey(), typeof currentSeason === 'string' ? currentSeason : undefined);
    if (bs !== 1) ctx.restore();
    return;
  }
  drawBox(ctx, e.x - 0.1, e.y - 0.1, 0.2, 0.2, e.hz, 16, col);
  ctx.beginPath();
  ctx.arc(bx, by - 20, 3, 0, Math.PI * 2);
  ctx.fillStyle = TD_SKIN;
  ctx.fill();
}

function drawBattleDiag(ctx, d, time) {
  if (typeof battle === 'undefined' || battle === null) { tdFxReset(); return; }
  const b = battle;
  if (d === 0) {
    tdDmgSync(b);
    tdRebuildBuckets(b, tdAlpha());
    tdFxFrame(b, time);
  }
  if (tdBkt === null) return;
  for (let x = Math.max(0, d - MAP_H + 1); x <= Math.min(d, MAP_W - 1); x++) {
    const y = d - x;
    if (!cellVisible(x, y)) continue;
    const i = y * MAP_W + x;
    const bl = tdBldAt(b, i);
    if (bl !== null && !bl.alive) tdRubble(ctx, x, y, b.map.height[i] * HL);
  }
  const list = tdBkt[d];
  if (list.length === 0) { tdBarsDiag(ctx, b, d); tdFxDrawDiag(ctx, b, d, time); return; }
  list.sort(function (p, q) { return p.x - q.x; });
  const lod = view.zoom < TD_LOD_ZOOM;
  const lr = lod ? tdLodR() : 0;
  for (let k = 0; k < list.length; k++) {
    const e = list[k];
    const u = e.u;
    e.hz = tdGroundHz(b, e.x, e.y);
    e.climb = tdClimbing(b, u);
    const p = gpt(e.x, e.y, e.hz);
    tdShadow(ctx, e);
    if (lod) {
      tdLodDot(ctx, p[0], p[1] - 8, u.team, u.st && u.st.pop > 1 ? lr * (1 + 0.5 * (tdBodyScale(u) - 1)) : lr);
    } else {
      tdDrawBody(ctx, u, e, p, time, TD_TEAM_COL[u.team] || TD_TEAM_COL[1]);
    }
    const us = tdUnitSeen.get(u);
    if (us !== undefined && time - us.flash < TD_FLASH_MS) tdFlashBody(ctx, p, lod);
    if (u.fx && u.fx.ambush && u.fx.ambush.until > b.tick) tdAmbushEdge(ctx, p);
    if (u.hp < u.maxHp && !lod) tdHpBar(ctx, p, u);
  }
  tdBarsDiag(ctx, b, d);
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
// 純視覺:只讀 battle,不寫入模擬狀態。射擊來自 td.js tdShot 寫入的 battle.shots(環形緩衝,seq 遞增):
// 每幀消費 seq > tdLastSeq 的新筆;壽命以模擬時間計(倍速下仍可見),且真實時間至少 TD_FX_MIN_REAL 毫秒。
const TD_FX_DUST_LIFE = 600;        // 塵煙存活毫秒
const TD_FX_SHARD_LIFE = 500;       // 碎片存活毫秒
const TD_FX_HPFADE_LIFE = 600;      // 建築摧毀後血條淡出毫秒(之後才留瓦礫)
const TD_FX_PROJ_MAX = 60;          // 同時射擊視覺(含落點圈)上限
const TD_FX_PART_MAX = 120;         // 同時塵煙 / 碎片 / 血條淡出上限
const TD_FX_MIN_REAL = 250;         // 每筆射擊至少顯示的真實毫秒
const TD_FX_FADE_REAL = 120;        // 抵達後淡出的真實毫秒
const TD_FX_ZOOM_MIN = 0.35;        // 縮放低於此值只畫 stone 與 fire
const TD_SHOT_DUR = { arrow: 0.2, bolt: 0.2, stone: 0.5, melee: 0.1, fire: 0.4, smoke: 0.6 };   // 各樣式飛行 / 作用的模擬秒數
const TD_SHOT_COL = { 0: '#b8322c', 1: '#3e6fb0' };   // 攻方紅系、守方與建築藍系(外框 / 尾跡帶隊色)
const TD_SHOT_WOOD = '#c9a46a';     // 箭桿木色
const TD_FLASH_MS = 120;            // 受擊閃白時間(約 1~2 幀)
const TD_AMBUSH_EDGE = 'rgba(255,215,120,.9)';
const TD_RANGE_COL = 'rgba(255,255,255,.7)';
const TD_FLAG_COL = 'rgba(255,214,90,.9)';
const TD_DUST_OFF = [[0, 0], [0.4, 0.2], [-0.3, 0.4], [0.2, -0.4], [-0.4, -0.2]];
const TD_SHARD_OFF = [[0.2, 0.1, 8], [-0.3, 0.2, 12], [0.1, -0.3, 6], [-0.2, -0.2, 10]];
let tdFx = [];                      // 視覺項目;sh = true 為射擊(依模擬時間),其餘為塵煙 / 碎片 / 血條淡出(依真實時間)
let tdFxBkt = null;                 // 依對角線分桶,每幀由 tdFxFrame 重建
let tdFxCount = 0;                  // ?perf 顯示用:目前視覺項目數
let tdFxBattle = null;              // 上一幀的 battle;換新時重設
let tdLastSeq = -1;                 // 已消費的最後 battle.shots seq
let tdNowS = 0;                     // 本幀模擬時間(秒)
let tdBarBkt = null;                // 存活且受傷建築的血條,依前緣對角線分桶
const tdBldSeen = new WeakMap();    // bl -> { alive, frac }
const tdUnitSeen = new WeakMap();   // u -> { hp, flash }

// 模擬時間(秒):tick × SIM_DT 加上插值餘量
function tdSimNow(b) {
  const a = typeof b.acc === 'number' ? b.acc : 0;
  return b.tick * SIM_DT + (a < 0 ? 0 : (a > SIM_DT ? SIM_DT : a));
}

// 清空演出與消費進度(battle 為 null、換新戰鬥時)
function tdFxReset() {
  tdFx.length = 0;
  tdFxCount = 0;
  tdLastSeq = -1;
  tdFxBattle = null;
}

// ---- 可部署區與落點預覽(不依賴 battle:觀察期 battle 為 null,地圖即 world 的敵陣偵察版)----
const TD_ZONE_FRONT = { fill: 'rgba(70,220,110,.30)', line: '#7dff9e' };
const TD_ZONE_FLANK = { fill: 'rgba(170,110,255,.30)', line: '#c9a2ff' };
const TD_DROP_OK = { fill: 'rgba(92,255,138,.28)', line: '#5cff8a' };
const TD_DROP_BAD = { fill: 'rgba(255,90,74,.30)', line: '#ff5a4a' };
let tdDepArr = null;                // 本幀正面可部署格(Uint8Array)或 null
let tdDepFlank = null;              // 本幀側翼可部署格(deployCells 的 flank 含正面格;繪製時正面優先)
let tdZT = 0;                       // 本幀時間(外框脈動用)
let tdDrop = null;                  // 按住地圖的落點 {x, y, x0, y0}(螢幕座標)或 null

// 本幀要畫的可部署區:
//  觀察期(atk.on 且 phase==='scout'):有先鋒卡即畫正面,地圖為 world
//  進軍期(atk.on 且 phase==='march'):仍有隊數且該部已開放的卡;先鋒/中軍/後軍畫正面,伏兵畫側翼
//  沙盤:已選卡且仍有隊數時畫正面
function tdZoneWant() {
  const out = { board: null, front: false, flank: false };
  const u = typeof uiPickedUnit === 'function' ? uiPickedUnit() : null;
  if (typeof battle === 'undefined' || battle === null) {
    if (typeof atk !== 'undefined' && atk.on && game.phase === 'scout') {
      out.board = world;
      out.front = !!u;
    }
    return out;
  }
  if (battle.over) return out;
  out.board = battle.map;
  out.front = !!u && tdUnitPopOk(battle, u);
  return out;
}

// 人口與單位數是否仍容得下一隊 u(與 tdDeployWhy 的 popcap / cap 判定相同,不含地形);供部署區高亮用
function tdUnitPopOk(b, u) {
  const d = UNITS[u];
  if (!d || !tdDeployable(d)) return false;
  return b.popUsed + d.pop * d.squad <= b.popCap && b.units.length + d.squad <= MAX_UNITS;
}

// render.js draw() 每幀開頭呼叫
function tdZonePrep(time) {
  tdZT = time;
  tdDepArr = null;
  tdDepFlank = null;
  const z = tdZoneWant();
  if (z.board === null) return;
  if (z.front) tdDepArr = deployCells(z.board, 'front');
  if (z.flank) tdDepFlank = deployCells(z.board, 'flank');
}

// 單格的可部署區外框與填色(render.js 畫完地形後呼叫,建築在其上)
function tdZoneCell(ctx, x, y) {
  if (tdDepArr === null && tdDepFlank === null) return;
  const i = y * MAP_W + x;
  const f = tdDepArr !== null && tdDepArr[i] === 1;
  const l = !f && tdDepFlank !== null && tdDepFlank[i] === 1;
  if (!f && !l) return;
  const sty = f ? TD_ZONE_FRONT : TD_ZONE_FLANK;
  const p = topPts(x, y, world.height[i], 0);
  poly(ctx, p, sty.fill);
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(tdZT / 220);
  outline(ctx, p, sty.line, Math.max(2, 1 / view.zoom));
  ctx.restore();
}

// 按住落點:ui.js 指標按下 / 移動 / 放開時呼叫;移動超過 8px 即為平移,取消預覽
function tdDropDown(sx, sy, n) { tdDrop = n === 1 ? { x: sx, y: sy, x0: sx, y0: sy } : null; }
function tdDropMove(sx, sy) {
  if (tdDrop === null) return;
  if (Math.hypot(sx - tdDrop.x0, sy - tdDrop.y0) > 8) { tdDrop = null; return; }
  tdDrop.x = sx;
  tdDrop.y = sy;
}
function tdDropUp() { tdDrop = null; }

// 落點資訊:格、是否合法、用哪個兵種;沒有可部署的卡時回 null
function tdDropInfo() {
  if (tdDrop === null || pano.open) return null;
  const c = screenToCell(tdDrop.x, tdDrop.y);
  if (c === null) return null;
  const i = c.y * MAP_W + c.x;
  const occ = world.occ[i] !== 0;
  const u = typeof uiPickedUnit === 'function' ? uiPickedUnit() : null;
  if (u === null) return null;
  if (typeof battle === 'undefined' || battle === null) {
    if (typeof atk === 'undefined' || !atk.on || game.phase !== 'scout') return null;
    return { x: c.x, y: c.y, ok: tdDepArr !== null && tdDepArr[i] === 1 && !occ, u: u };
  }
  if (battle.over) return null;
  return { x: c.x, y: c.y, ok: tdDeployWhy(battle, u, c.x, c.y) === true && !occ, u: u };
}

// 落點預覽:合法綠、不合法紅的格外框 + 兵種影子與色點(攻方,team 0)
function tdDrawDrop(ctx, time) {
  const d = tdDropInfo();
  if (d === null) return;
  const i = d.y * MAP_W + d.x;
  const sty = d.ok ? TD_DROP_OK : TD_DROP_BAD;
  const p = topPts(d.x, d.y, world.height[i], 0);
  poly(ctx, p, sty.fill);
  outline(ctx, p, sty.line, Math.max(2, 1.5 / view.zoom));
  const g = gpt(d.x + 0.5, d.y + 0.5, world.height[i] * HL);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(g[0], g[1], 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fill();
  ctx.globalAlpha = 0.85;
  tdLodDot(ctx, g[0], g[1] - 8, 0, tdLodR());
  ctx.restore();
}

// 上限內才加入(塵煙 / 碎片 / 血條淡出共用 TD_FX_PART_MAX)
function tdFxPush(it) {
  let n = 0;
  for (let k = 0; k < tdFx.length; k++) if (!tdFx[k].sh) n++;
  if (n >= TD_FX_PART_MAX) return false;
  tdFx.push(it);
  return true;
}

// 射擊視覺上限 TD_FX_PROJ_MAX:滿了丟最舊的一條射擊,保留新的
function tdFxPushShot(it) {
  let n = 0, old = -1;
  for (let k = 0; k < tdFx.length; k++) {
    if (tdFx[k].sh) { if (old < 0) old = k; n++; }
  }
  if (n >= TD_FX_PROJ_MAX) tdFx.splice(old, 1);
  tdFx.push(it);
}

// 由 battle.shots 的一筆建立射擊視覺(只讀)
function tdShotStart(b, r, time) {
  const k = TD_SHOT_DUR[r.k] !== undefined ? r.k : 'arrow';
  const dist = Math.hypot(r.tx - r.ax, r.ty - r.ay);
  const hA = tdGroundHz(b, r.ax, r.ay), hT = tdGroundHz(b, r.tx, r.ty);
  tdFxPushShot({
    sh: true, seq: r.seq, k: k, team: r.team === 0 ? 0 : 1,
    ax: r.ax, ay: r.ay, tx: r.tx, ty: r.ty, aoe: r.aoe > 0 ? r.aoe : 0,
    sz: hA + (k === 'stone' ? 30 : (k === 'melee' ? 8 : 14)), ez: hT + 6, hT: hT,
    arc: k === 'stone' ? Math.min(60, 14 + 5 * dist) : (k === 'fire' ? 10 : (k === 'arrow' ? 8 : 0)),
    dur: TD_SHOT_DUR[k], bornS: r.tick * SIM_DT, t0: time, tDone: -1, p: 0, a: 1, gx: r.tx, gy: r.ty, gz: hT
  });
}

// 射擊進度 p(模擬時間 / 樣式時長)、抵達後的淡出係數 a(真實時間)
function tdShotAt(it, time) {
  const age = tdNowS - it.bornS;
  const p = age <= 0 ? 0 : (age >= it.dur ? 1 : age / it.dur);
  it.p = p;
  if (it.tDone < 0 && age >= it.dur) it.tDone = time;
  it.a = it.tDone < 0 ? 1 : Math.min(1, Math.max(0, 1 - (time - it.tDone) / TD_FX_FADE_REAL));
  it.gx = it.ax + (it.tx - it.ax) * p;
  it.gy = it.ay + (it.ty - it.ay) * p;
}

// 射擊:抵達且淡出完、真實時間滿 TD_FX_MIN_REAL 才移除;其餘項目依真實壽命
function tdFxAlive(it, time) {
  if (it.sh) return !(it.tDone >= 0 && time - it.tDone >= TD_FX_FADE_REAL && time - it.t0 >= TD_FX_MIN_REAL);
  return time - it.t0 < it.life;
}

// 射擊在螢幕上的位置:沿 a→t 直線,高度為拋物線(stone 較高)
function tdShotPos(it, p) {
  return gpt(it.ax + (it.tx - it.ax) * p, it.ay + (it.ty - it.ay) * p, it.sz + (it.ez - it.sz) * p + Math.sin(Math.PI * p) * it.arc);
}

function tdShotDraw(ctx, it, time) {
  if (!(it.a > 0)) return;
  ctx.save();
  const col = TD_SHOT_COL[it.team];
  if (it.k === 'arrow') tdDrawArrow(ctx, it, col, it.a);
  else if (it.k === 'bolt') tdDrawBolt(ctx, it, col, it.a);
  else if (it.k === 'stone') tdDrawStone(ctx, it, col, it.a, time);
  else if (it.k === 'melee') tdDrawMelee(ctx, it, col, it.a);
  else if (it.k === 'fire') tdDrawFire(ctx, it, col, it.a);
  else tdDrawSmoke(ctx, it, col, it.a);
  ctx.restore();
}

// 箭矢:細長箭桿 + 箭頭 + 尾羽,尾跡帶隊色
function tdDrawArrow(ctx, it, col, al) {
  const p = it.p, t = tdShotPos(it, Math.max(0, p - 0.2)), h = tdShotPos(it, p);
  edgeLine(ctx, t, h, col, 3, 0.35 * al);
  edgeLine(ctx, t, h, TD_SHOT_WOOD, 1.2, al);
  const dx = h[0] - t[0], dy = h[1] - t[1], L = Math.hypot(dx, dy);
  if (L < 0.5) return;
  const ux = dx / L, uy = dy / L, px = -uy, py = ux;
  ctx.globalAlpha = al;
  ctx.beginPath();
  ctx.moveTo(h[0] + ux * 3, h[1] + uy * 3);
  ctx.lineTo(h[0] - ux + px * 2, h[1] - uy + py * 2);
  ctx.lineTo(h[0] - ux - px * 2, h[1] - uy - py * 2);
  ctx.closePath();
  ctx.fillStyle = '#d8dce0';
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  const bx = t[0] - ux * 2.5, by = t[1] - uy * 2.5;
  ctx.beginPath();
  ctx.moveTo(bx + px * 1.6, by + py * 1.6);
  ctx.lineTo(t[0], t[1]);
  ctx.lineTo(bx - px * 1.6, by - py * 1.6);
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// 弩矢:粗直線加殘影
function tdDrawBolt(ctx, it, col, al) {
  const p = it.p;
  const a = tdShotPos(it, Math.max(0, p - 0.25)), m = tdShotPos(it, Math.max(0, p - 0.1)), h = tdShotPos(it, p);
  edgeLine(ctx, a, m, col, 1.2, 0.25 * al);
  edgeLine(ctx, m, h, col, 3.4, 0.6 * al);
  edgeLine(ctx, m, h, '#d8c39a', 1.8, al);
}

// 石彈:拋物線 + 落點圈(aoe 半徑)+ 落地塵
function tdDrawStone(ctx, it, col, al, time) {
  const p = it.p;
  if (it.aoe > 0) {
    const r = it.aoe * (0.85 + 0.15 * p);
    ctx.beginPath();
    for (let q = 0; q <= 24; q++) {
      const c = gpt(it.tx + r * Math.cos(q * Math.PI / 12), it.ty + r * Math.sin(q * Math.PI / 12), it.hT + 1);
      if (q === 0) ctx.moveTo(c[0], c[1]); else ctx.lineTo(c[0], c[1]);
    }
    ctx.globalAlpha = al * 0.08;
    ctx.fillStyle = col;
    ctx.fill();
    ctx.globalAlpha = al * (0.3 + 0.5 * p);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  if (p < 1) {
    const c = tdShotPos(it, p);
    ctx.globalAlpha = al;
    ctx.beginPath();
    ctx.arc(c[0], c[1], 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#6f675e';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else if (it.tDone >= 0) {
    const q = Math.min(1, (time - it.tDone) / 200);
    ctx.fillStyle = 'rgb(130,122,112)';
    for (let k = 0; k < TD_DUST_OFF.length; k++) {
      const o = TD_DUST_OFF[k];
      const c = gpt(it.tx + o[0] * (0.5 + q), it.ty + o[1] * (0.5 + q), it.hT + 4 + 8 * q);
      ctx.globalAlpha = al * 0.5 * (1 - q);
      ctx.beginPath();
      ctx.arc(c[0], c[1], 2 + 4 * q, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 打擊:不飛行,短弧線加目標處閃光
function tdDrawMelee(ctx, it, col, al) {
  const p = it.p;
  const A = tdShotPos(it, 0), T = tdShotPos(it, 1);
  const mx = (A[0] + T[0]) / 2, my = (A[1] + T[1]) / 2 - 6;
  ctx.globalAlpha = al * (1 - 0.5 * p);
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.quadraticCurveTo(mx, my, T[0], T[1]);
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.globalAlpha = al * (1 - p);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, L = 3 + 5 * p;
    ctx.moveTo(T[0] + Math.cos(a) * 2, T[1] + Math.sin(a) * 2);
    ctx.lineTo(T[0] + Math.cos(a) * L, T[1] + Math.sin(a) * L);
  }
  ctx.strokeStyle = '#fff3c4';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(T[0], T[1], 2 + 2 * p, 0, Math.PI * 2);
  ctx.fillStyle = '#fff3c4';
  ctx.fill();
}

// 火球:火球本體加焰尾
function tdDrawFire(ctx, it, col, al) {
  const p = it.p;
  for (let q = 3; q >= 1; q--) {
    const c = tdShotPos(it, Math.max(0, p - 0.05 * q));
    ctx.globalAlpha = al * (0.5 - 0.12 * q);
    ctx.beginPath();
    ctx.arc(c[0], c[1], 2.6 - 0.5 * q, 0, Math.PI * 2);
    ctx.fillStyle = '#ff7a1a';
    ctx.fill();
  }
  const h = tdShotPos(it, p);
  ctx.globalAlpha = al;
  ctx.beginPath();
  ctx.arc(h[0], h[1], 2.6, 0, Math.PI * 2);
  ctx.fillStyle = '#ff9a2a';
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

// 煙:目標處灰煙團擴散(外框帶隊色)
function tdDrawSmoke(ctx, it, col, al) {
  const p = it.p;
  const c0 = gpt(it.tx, it.ty, it.hT + 4 + 6 * p);
  for (let q = 0; q < 3; q++) {
    const c = [c0[0] + (q - 1) * (3 + 3 * p), c0[1] - q * 2 * p];
    ctx.beginPath();
    ctx.arc(c[0], c[1], 2 + 5 * p + q * 0.8, 0, Math.PI * 2);
    ctx.globalAlpha = al * 0.45 * (1 - 0.6 * p);
    ctx.fillStyle = 'rgb(150,150,150)';
    ctx.fill();
    ctx.globalAlpha = al * 0.4;
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

// 建築血條:寬依占格(牆較窄且較低),綠 > 50%、黃 > 25%、其餘紅
function tdBarLift(bl) { return bl.cb && bl.cb.block === 'wall' ? 24 : 56; }
function tdBarDraw(ctx, x, y, w, h, frac, z, lift, wall, al) {
  const c = gpt(x + w / 2, y + h / 2, z + lift);
  const W = (wall ? 6 : 10) * w, H = wall ? 2 : 3;
  const f = frac < 0 ? 0 : (frac > 1 ? 1 : frac);
  ctx.save();
  ctx.globalAlpha = al;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(c[0] - W / 2 - 0.5, c[1] - 0.5, W + 1, H + 1);
  ctx.fillStyle = f > 0.5 ? '#6ccf5a' : (f > 0.25 ? '#e8c03a' : '#e0402a');
  ctx.fillRect(c[0] - W / 2, c[1], W * f, H);
  ctx.restore();
}

// 每幀依 battle.bld 收集存活、受傷、未隱藏的建築(依前緣格對角線分桶)
function tdBarBuild(b) {
  if (tdBarBkt === null) {
    tdBarBkt = [];
    for (let k = 0; k < MAP_W + MAP_H - 1; k++) tdBarBkt.push([]);
  }
  for (let k = 0; k < tdBarBkt.length; k++) tdBarBkt[k].length = 0;
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    if (!bl.alive || bl.hidden || !(bl.hp > 0) || !(bl.maxHp > 0) || !(bl.hp < bl.maxHp)) continue;
    tdBarBkt[tdClampI(bl.x + bl.w - 1 + bl.y + bl.h - 1, 0, tdBarBkt.length - 1)].push(bl);
  }
}

function tdBarsDiag(ctx, b, d) {
  if (tdBarBkt === null || view.zoom < TD_FX_ZOOM_MIN) return;
  const list = tdBarBkt[d];
  for (let k = 0; k < list.length; k++) {
    const bl = list[k];
    tdBarDraw(ctx, bl.x, bl.y, bl.w, bl.h, bl.hp / bl.maxHp, b.map.height[bl.y * MAP_W + bl.x] * HL, tdBarLift(bl), bl.cb.block === 'wall', 1);
  }
}

// 建築摧毀:塵煙、碎片與血條淡出(隱藏建築不畫)
function tdFxDestroy(b, bl, time, frac) {
  if (bl.hidden) return;
  const cx = bl.x + bl.w / 2, cy = bl.y + bl.h / 2;
  const hz = b.map.height[bl.y * MAP_W + bl.x] * HL;
  for (let k = 0; k < TD_DUST_OFF.length; k++) {
    const o = TD_DUST_OFF[k];
    tdFxPush({ k: 'dust', t0: time, life: TD_FX_DUST_LIFE, x: cx + o[0] * bl.w, y: cy + o[1] * bl.h, z: hz + 6, p: 0 });
  }
  for (let k = 0; k < TD_SHARD_OFF.length; k++) {
    const o = TD_SHARD_OFF[k];
    tdFxPush({ k: 'shard', t0: time, life: TD_FX_SHARD_LIFE, x: cx + o[0] * bl.w, y: cy + o[1] * bl.h, z: hz + o[2], p: 0 });
  }
  if (bl.maxHp > 0) {
    tdFxPush({ k: 'bar', t0: time, life: TD_FX_HPFADE_LIFE, x: bl.x, y: bl.y, w: bl.w, h: bl.h, z: hz, frac: frac, lift: tdBarLift(bl), wall: bl.cb.block === 'wall', p: 0 });
  }
}

// 消費 battle.shots 中 seq > tdLastSeq 的新筆(環形緩衝;一幀最多取最新 TD_FX_PROJ_MAX 筆)
function tdShotConsume(b, time) {
  const hi = b.shotSeq - 1;
  if (hi <= tdLastSeq) return;
  const shots = b.shots || [];
  let lo = Math.max(tdLastSeq + 1, b.shotSeq - TD_SHOT_MAX);
  if (hi - lo + 1 > TD_FX_PROJ_MAX) lo = hi - TD_FX_PROJ_MAX + 1;
  for (let s = lo; s <= hi; s++) {
    const r = shots[s % TD_SHOT_MAX];
    if (!r || r.seq !== s) continue;
    if (view.zoom < TD_FX_ZOOM_MIN && r.k !== 'stone' && r.k !== 'fire') continue;
    tdShotStart(b, r, time);
  }
  tdLastSeq = hi;
}

// 每幀掃描:存活轉死亡 → 摧毀演出;單位 hp 下降 → 閃白
function tdFxScan(b, time) {
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    const frac = bl.maxHp > 0 ? bl.hp / bl.maxHp : 0;
    const s = tdBldSeen.get(bl);
    if (s === undefined) { tdBldSeen.set(bl, { alive: bl.alive, frac: frac }); continue; }
    if (s.alive && !bl.alive) tdFxDestroy(b, bl, time, s.frac);
    s.alive = bl.alive;
    s.frac = frac;
  }
  for (let k = 0; k < b.units.length; k++) {
    const u = b.units[k];
    const s = tdUnitSeen.get(u);
    if (s === undefined) { tdUnitSeen.set(u, { hp: u.hp, flash: -1e9 }); continue; }
    if (u.hp < s.hp) s.flash = time;
    s.hp = u.hp;
  }
}

// 更新一個視覺項目的地面位置 it.gx / gy / gz 與進度 it.p
function tdFxAt(it, time) {
  if (it.sh) { tdShotAt(it, time); return; }
  const p = Math.min(1, Math.max(0, (time - it.t0) / it.life));
  it.p = p;
  if (it.k === 'bar') {
    it.gx = it.x + it.w - 1; it.gy = it.y + it.h - 1; it.gz = it.z;
    return;
  }
  it.gx = it.x; it.gy = it.y;
  it.gz = it.z + (it.k === 'dust' ? 20 * p : 30 * Math.sin(Math.PI * p));
}

// 每幀開頭:換新戰鬥則重設、清過期項目、消費新射擊、掃描事件、依對角線分桶
function tdFxFrame(b, time) {
  if (b !== tdFxBattle) { tdFxReset(); tdFxBattle = b; }
  tdNowS = tdSimNow(b);
  let w = 0;
  for (let k = 0; k < tdFx.length; k++) {
    if (tdFxAlive(tdFx[k], time)) tdFx[w++] = tdFx[k];
  }
  tdFx.length = w;
  if (!b.over) tdShotConsume(b, time);
  tdFxScan(b, time);
  if (b.over) tdFx.length = 0;
  tdBarBuild(b);
  if (tdFxBkt === null) {
    tdFxBkt = [];
    for (let k = 0; k < MAP_W + MAP_H - 1; k++) tdFxBkt.push([]);
  }
  for (let k = 0; k < tdFxBkt.length; k++) tdFxBkt[k].length = 0;
  for (let k = 0; k < tdFx.length; k++) {
    const it = tdFx[k];
    tdFxAt(it, time);
    tdFxBkt[tdClampI(Math.floor(it.gx) + Math.floor(it.gy), 0, tdFxBkt.length - 1)].push(it);
  }
  tdFxCount = tdFx.length;
}

// 戰陣建築受損外觀:依血量比例寫入 world.objects[].dmg(art.js artVariant 讀取)。
// 只在攻擊 / 錄影 / 沙盤(body.sandbox,同 battleui lootMode)寫入;索引不符時以 type,x,y 比對。
function tdDmgWanted() {
  if (game.mode === 'attack' || game.mode === 'replay') return true;
  return typeof document !== 'undefined' && !!document.body && document.body.classList.contains('sandbox');
}

function tdDmgOf(bl) {
  if (!(bl.maxHp > 0)) return 0;
  const r = bl.hp / bl.maxHp;
  return r < 0.2 ? 2 : (r < 0.5 ? 1 : 0);
}

function tdDmgSync(b) {
  if (!tdDmgWanted() || typeof world === 'undefined' || !world.objects) return;
  const objs = world.objects;
  let byKey = null;
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n];
    let o = objs[bl.n];
    if (!o || o.type !== bl.type || o.x !== bl.x || o.y !== bl.y) {
      if (byKey === null) {
        byKey = new Map();
        for (let k = 0; k < objs.length; k++) byKey.set(objs[k].type + '|' + objs[k].x + '|' + objs[k].y, objs[k]);
      }
      o = byKey.get(bl.type + '|' + bl.x + '|' + bl.y);
    }
    if (!o) continue;
    const v = tdDmgOf(bl);
    if ((o.dmg || 0) !== v) o.dmg = v;
  }
}

function tdFxDrawOne(ctx, it, time) {
  if (it.sh) { tdShotDraw(ctx, it, time); return; }
  if (it.k === 'bar') { tdBarDraw(ctx, it.x, it.y, it.w, it.h, it.frac, it.z, it.lift, it.wall, 1 - it.p); return; }
  const p = it.p;
  ctx.globalAlpha = 1;
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
  }
}

// 本對角線的視覺項目 + 令旗插旗圖示;縮放 < TD_FX_ZOOM_MIN 只畫 stone 與 fire
function tdFxDrawDiag(ctx, b, d, time) {
  if (tdFxBkt === null) return;
  const list = tdFxBkt[d];
  const low = view.zoom < TD_FX_ZOOM_MIN;
  if (list.length > 0) {
    ctx.save();
    for (let k = 0; k < list.length; k++) {
      const it = list[k];
      if (low && !(it.sh && (it.k === 'stone' || it.k === 'fire'))) continue;
      tdFxDrawOne(ctx, it, time);
    }
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
  if (lod) ctx.arc(p[0], p[1] - 8, tdLodR() + 0.5, 0, Math.PI * 2);
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
