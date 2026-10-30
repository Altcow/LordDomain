let currentSeason = 'spring';
function setSeason(name) {
  if (PALETTES[name]) {
    currentSeason = name;
    PAL = PALETTES[name];
  }
}

const view = { x: 0, y: 0, zoom: 1 };
const ZOOM_ABS_MIN = 0.05, ZOOM_MIN_CAP = 1.5, ZOOM_MAX = 2.5;
// 整張地圖的螢幕外框(世界像素、未乘縮放):寬 = 對角投影寬;高 = 頂部留建築高度 + 底邊
const MAP_FIT_W = (MAP_W + MAP_H) * TW / 2;
const MAP_FIT_H = (MAP_W + MAP_H) * TH / 2 + MAX_H * HL + 64;
// 縮放低於此值:不畫地格邊線(細線會閃爍)、建築改畫色塊
const TILE_EDGE_MIN_ZOOM = 0.35, OBJ_BLOB_ZOOM = 0.35;
let zoomMin = ZOOM_ABS_MIN;
const viewport = { w: 0, h: 0, dpr: 1 };
const preview = { visible: false, x: 0, y: 0, tool: null, rot: 0, ok: true };

function resizeCanvas(canvas) {
  viewport.w = window.innerWidth;
  viewport.h = window.innerHeight;
  viewport.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(viewport.w * viewport.dpr);
  canvas.height = Math.round(viewport.h * viewport.dpr);
  updateZoomMin();
}

// 縮放下限 = 整張地圖剛好塞進視窗(寬高取較嚴者),上限 ZOOM_MIN_CAP;所有地圖共用
function updateZoomMin() {
  const fit = Math.min(viewport.w / MAP_FIT_W, viewport.h / MAP_FIT_H);
  zoomMin = Math.max(ZOOM_ABS_MIN, Math.min(ZOOM_MIN_CAP, fit));
  if (view.zoom < zoomMin) view.zoom = zoomMin;
}

function isoX(gx, gy) { return (gx - gy) * TW / 2; }
function isoY(gx, gy, h) { return (gx + gy) * TH / 2 - h * HL; }

function worldToScreen(wx, wy) {
  return [(wx - view.x) * view.zoom + viewport.w / 2, (wy - view.y) * view.zoom + viewport.h / 2];
}
function screenToWorld(sx, sy) {
  return [(sx - viewport.w / 2) / view.zoom + view.x, (sy - viewport.h / 2) / view.zoom + view.y];
}

function screenToCell(sx, sy) {
  const p = screenToWorld(sx, sy);
  const wx = p[0], wy = p[1];
  for (let h = MAX_H; h >= 0; h--) {
    const wyh = wy + h * HL;
    const gx = (wx / (TW / 2) + wyh / (TH / 2)) / 2;
    const gy = (wyh / (TH / 2) - wx / (TW / 2)) / 2;
    const x = Math.floor(gx), y = Math.floor(gy);
    if (inBounds(x, y) && world.height[idx(x, y)] === h) return { x: x, y: y };
  }
  return null;
}

function panBy(dsx, dsy) {
  view.x -= dsx / view.zoom;
  view.y -= dsy / view.zoom;
  clampView();
}

function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  view.zoom = Math.max(zoomMin, Math.min(ZOOM_MAX, view.zoom * factor));
  const after = screenToWorld(sx, sy);
  view.x += before[0] - after[0];
  view.y += before[1] - after[1];
  clampView();
}

function centerOnCell(x, y) {
  view.x = isoX(x + 0.5, y + 0.5);
  view.y = isoY(x + 0.5, y + 0.5, world.height[idx(x, y)]);
}

// 地圖比視窗小的方向置中;否則限制在地圖範圍內
function clampView() {
  const xl = isoX(0, MAP_H), xh = isoX(MAP_W, 0);
  const yl = isoY(0, 0, MAX_H), yh = isoY(MAP_W, MAP_H, 0);
  view.x = (xh - xl) * view.zoom <= viewport.w ? (xl + xh) / 2 : Math.min(xh, Math.max(xl, view.x));
  view.y = (yh - yl) * view.zoom <= viewport.h ? (yl + yh) / 2 : Math.min(yh, Math.max(yl, view.y));
}

// 繪製輔助
function shade(hex, f) {
  let out = '#';
  for (let k = 1; k <= 5; k += 2) {
    const v = Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(k, 2), 16) * f)));
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

function cellHash(x, y) {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

// 世界像素座標：格點 (gx,gy)，hp 為高度像素
function gpt(gx, gy, hp) {
  return [isoX(gx, gy), isoY(gx, gy, 0) - hp];
}

function facePt(onX, fixed, v, hp) {
  return onX ? gpt(fixed, v, hp) : gpt(v, fixed, hp);
}

// 格子頂面四角（0 上、1 右、2 下、3 左），dy 為水面下移量
function topPts(x, y, h, dy) {
  return [
    [isoX(x, y), isoY(x, y, h) + dy],
    [isoX(x + 1, y), isoY(x + 1, y, h) + dy],
    [isoX(x + 1, y + 1), isoY(x + 1, y + 1, h) + dy],
    [isoX(x, y + 1), isoY(x, y + 1, h) + dy]
  ];
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function poly(ctx, pts, color) {
  polyPath(ctx, pts);
  ctx.fillStyle = color;
  ctx.fill();
}

function outline(ctx, pts, color, lw) {
  polyPath(ctx, pts);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function edgeLine(ctx, a, b, color, lw, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.restore();
}

function cellPath(ctx, x, y, dy) {
  polyPath(ctx, topPts(x, y, world.height[idx(x, y)], dy));
}

// 方塊：底面 (gx,gy)-(gx+w,gy+d)，自 baseH 升高 boxH 像素
function drawBox(ctx, gx, gy, w, d, baseH, boxH, color) {
  const top = baseH + boxH;
  poly(ctx, [gpt(gx, gy + d, top), gpt(gx + w, gy + d, top), gpt(gx + w, gy + d, baseH), gpt(gx, gy + d, baseH)], shade(color, 0.88));
  poly(ctx, [gpt(gx + w, gy, top), gpt(gx + w, gy + d, top), gpt(gx + w, gy + d, baseH), gpt(gx + w, gy, baseH)], shade(color, 0.75));
  poly(ctx, [gpt(gx, gy, top), gpt(gx + w, gy, top), gpt(gx + w, gy + d, top), gpt(gx, gy + d, top)], color);
}

// 四角錐屋頂：頂點在底面中心上方 peakH
function drawPyramid(ctx, gx, gy, w, d, baseH, peakH, color) {
  const apex = gpt(gx + w / 2, gy + d / 2, baseH + peakH);
  poly(ctx, [gpt(gx + w, gy, baseH), gpt(gx + w, gy + d, baseH), apex], shade(color, 0.8));
  poly(ctx, [gpt(gx + w, gy + d, baseH), gpt(gx, gy + d, baseH), apex], color);
}

function drawDoor(ctx, onX, fixed, mid, bh) {
  const a = mid - 0.15, b = mid + 0.15;
  poly(ctx, [facePt(onX, fixed, a, bh), facePt(onX, fixed, b, bh), facePt(onX, fixed, b, bh + 10), facePt(onX, fixed, a, bh + 10)], 'rgba(40,30,25,0.85)');
}

function drawArch(ctx, onX, fixed, mid, bh) {
  const a = mid - 0.25, b = mid + 0.25;
  const c1 = facePt(onX, fixed, a, bh + 16), c2 = facePt(onX, fixed, b, bh + 16);
  const top = facePt(onX, fixed, mid, bh + 16);
  const pa = facePt(onX, fixed, a, bh + 8), pb = facePt(onX, fixed, b, bh + 8);
  ctx.beginPath();
  ctx.moveTo(facePt(onX, fixed, a, bh)[0], facePt(onX, fixed, a, bh)[1]);
  ctx.lineTo(pa[0], pa[1]);
  ctx.quadraticCurveTo(c1[0], c1[1], top[0], top[1]);
  ctx.quadraticCurveTo(c2[0], c2[1], pb[0], pb[1]);
  ctx.lineTo(facePt(onX, fixed, b, bh)[0], facePt(onX, fixed, b, bh)[1]);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
}

function drawLog(ctx, gx, gy, len, dep, baseH, r) {
  drawBox(ctx, gx, gy, len, dep, baseH, 2 * r, PAL.wood);
  const c = gpt(gx + len, gy + dep / 2, baseH + r);
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fillStyle = shade(PAL.wood, 1.2);
  ctx.fill();
}

// 軍事建築固定色（不隨季節）；皆 6 位 hex，可用 shade()
const MIL_COL = { red: '#b8322c', black: '#2e2b2b', herb: '#3f8a66', hay: '#d8b04a', white: '#f4efe4', horse: '#6e4a30' };

// 科研院固定色（不隨季節）；皆 6 位 hex，可用 shade()
const TECH_COL = { wood: '#5b3a29', roof: '#2f6b5e', bamboo: '#cdb46a', lacquer: '#7a2e26', bronze: '#b08d57' };

// 旗：竿立於格點 (px,py)，旗面沿 +x 方向展開 fw 格、高 fh 像素
function drawFlag(ctx, px, py, base, poleH, fw, fh, color) {
  drawBox(ctx, px - 0.03, py - 0.03, 0.06, 0.06, base, poleH, shade(PAL.wood, 0.7));
  const top = base + poleH;
  const pts = [gpt(px, py, top), gpt(px + fw, py, top - 2), gpt(px + fw, py, top - 2 - fh), gpt(px, py, top - fh)];
  poly(ctx, pts, color);
  outline(ctx, pts, shade(color, 0.6), 1);
}

// 箭靶：木柱＋三圈靶面
function drawTarget(ctx, tx, ty, base) {
  drawBox(ctx, tx - 0.04, ty - 0.04, 0.08, 0.08, base, 12, PAL.wood);
  const c = gpt(tx, ty, base + 16);
  [[6, MIL_COL.white], [4, MIL_COL.red], [2, MIL_COL.white]].forEach(r => {
    ctx.beginPath();
    ctx.arc(c[0], c[1], r[0], 0, Math.PI * 2);
    ctx.fillStyle = r[1];
    ctx.fill();
  });
}

// 地形繪製
function drawCliffFace(ctx, ax, ay, bx, by, h, hn, color) {
  poly(ctx, [
    [isoX(ax, ay), isoY(ax, ay, h)],
    [isoX(bx, by), isoY(bx, by, h)],
    [isoX(bx, by), isoY(bx, by, hn)],
    [isoX(ax, ay), isoY(ax, ay, hn)]
  ], color);
  if (view.zoom < TILE_EDGE_MIN_ZOOM) return;
  for (let L = hn + 1; L <= h - 1; L++) {
    ctx.beginPath();
    ctx.moveTo(isoX(ax, ay), isoY(ax, ay, L));
    ctx.lineTo(isoX(bx, by), isoY(bx, by, L));
    ctx.strokeStyle = shade(PAL.cliff, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawCliffs(ctx, x, y, h) {
  const hx = inBounds(x + 1, y) ? world.height[idx(x + 1, y)] : -1;
  if (hx < h) drawCliffFace(ctx, x + 1, y, x + 1, y + 1, h, hx, shade(PAL.cliff, 0.75));
  const hy = inBounds(x, y + 1) ? world.height[idx(x, y + 1)] : -1;
  if (hy < h) drawCliffFace(ctx, x, y + 1, x + 1, y + 1, h, hy, shade(PAL.cliff, 0.9));
}

function drawRiver(ctx, x, y, h, time) {
  const f = DIRS[world.flow[idx(x, y)]];
  const dx = f[0], dy = f[1];
  const hp = h * HL - 3;
  ctx.save();
  polyPath(ctx, topPts(x, y, h, 3));
  ctx.clip();
  ctx.strokeStyle = PAL.waterHi;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  for (let k = 0; k < 3; k++) {
    let p = time * 0.6 - (x * dx + y * dy) * 0.25 + k / 3;
    p -= Math.floor(p);
    const s = p - 0.5, q = (k - 1) * 0.25;
    const cx = x + 0.5 + dx * s - dy * q;
    const cy = y + 0.5 + dy * s + dx * q;
    const a = gpt(cx - dx * 0.125, cy - dy * 0.125, hp);
    const b = gpt(cx + dx * 0.125, cy + dy * 0.125, hp);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLake(ctx, x, y, h, time) {
  const hs = cellHash(x, y);
  if (hs % 3 === 0) return;
  let b = Math.pow(Math.max(0, Math.sin(time * 2 + hs)), 4);
  if (currentSeason === 'winter') b *= 0.5;
  if (b < 0.02) return;
  const px = x + ((hs >>> 3) % 10) / 10, py = y + ((hs >>> 7) % 10) / 10;
  const hp = h * HL - 3, s = 0.08;
  const a1 = gpt(px - s, py, hp), a2 = gpt(px + s, py, hp);
  const b1 = gpt(px, py - s, hp), b2 = gpt(px, py + s, hp);
  ctx.save();
  ctx.globalAlpha = b;
  ctx.strokeStyle = PAL.waterHi;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(a1[0], a1[1]);
  ctx.lineTo(a2[0], a2[1]);
  ctx.moveTo(b1[0], b1[1]);
  ctx.lineTo(b2[0], b2[1]);
  ctx.stroke();
  ctx.restore();
}

function drawTile(ctx, x, y, time) {
  const i = idx(x, y);
  const h = world.height[i];
  const t = world.terrain[i];
  const wet = t === T_LAKE || t === T_RIVER;
  drawCliffs(ctx, x, y, h);

  const p = topPts(x, y, h, wet ? 3 : 0);
  polyPath(ctx, p);
  let tileCol = t === T_ROAD ? PAL.road : (wet ? PAL.water : PAL.grass[cellHash(x, y) % 3]);
  if (typeof artTile === 'function') tileCol = artTile(tileCol);
  ctx.fillStyle = tileCol;
  ctx.fill();

  // 邊線: 0 上→1 右 面向 (x,y-1); 1→2 面向 (x+1,y); 2→3 面向 (x,y+1); 3→0 面向 (x-1,y)
  const edges = [[0, 1, x, y - 1], [1, 2, x + 1, y], [2, 3, x, y + 1], [3, 0, x - 1, y]];
  edges.forEach(e => {
    if (!inBounds(e[2], e[3])) return;
    const nt = world.terrain[idx(e[2], e[3])];
    if (t === T_ROAD && nt !== T_ROAD) edgeLine(ctx, p[e[0]], p[e[1]], PAL.roadEdge, 1, 1);
    else if (wet && nt !== T_LAKE && nt !== T_RIVER) edgeLine(ctx, p[e[0]], p[e[1]], PAL.foam, 2, 0.6);
  });

  if (view.zoom >= TILE_EDGE_MIN_ZOOM) {
    polyPath(ctx, p);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (t === T_RIVER) drawRiver(ctx, x, y, h, time);
  else if (t === T_LAKE) drawLake(ctx, x, y, h, time);
}

// 物件繪製
function drawObject(ctx, o, alpha) {
  if (typeof artDrawObject === 'function' && artDrawObject(ctx, o, alpha)) return;
  if (alpha === undefined) alpha = 1;
  const x = o.x, y = o.y;
  const bh = world.height[idx(x, y)] * HL;
  const fp = OBJECTS[o.type] ? footprint(o.type, o.rot) : [1, 1];
  const w = fp[0], h = fp[1];
  const hs = cellHash(x, y);
  const cx = x + 0.5, cy = y + 0.5;
  ctx.save();
  ctx.globalAlpha = alpha;
  switch (o.type) {
    case 'tree': {
      const s = 1 + (((hs >>> 4) % 21) - 10) / 100;
      drawBox(ctx, cx - 0.06 * s, cy - 0.06 * s, 0.12 * s, 0.12 * s, bh, 10, PAL.trunk);
      drawPyramid(ctx, cx - 0.35 * s, cy - 0.35 * s, 0.7 * s, 0.7 * s, bh + 8, 18, PAL.canopyDark);
      drawPyramid(ctx, cx - 0.225 * s, cy - 0.225 * s, 0.45 * s, 0.45 * s, bh + 18, 12, PAL.canopyLight);
      break;
    }
    case 'stone': {
      const s = 0.5 + ((hs >>> 4) % 3) * 0.1;
      const sh = 6 + ((hs >>> 8) % 4);
      drawBox(ctx, cx - s / 2, cy - s / 2, s, s, bh, sh, shade(PAL.stone, 1.15));
      break;
    }
    case 'house': {
      const gx = x + 0.1, gy = y + 0.1, s = 1.8;
      drawBox(ctx, gx, gy, s, s, bh, 20, PAL.houseWall);
      if (o.rot === 2) drawDoor(ctx, true, gx + s, gy + s / 2, bh);
      else if (o.rot === 3) drawDoor(ctx, false, gy + s, gx + s / 2, bh);
      drawPyramid(ctx, gx, gy, s, s, bh + 20, 16, PAL.houseRoof);
      break;
    }
    case 'lumber': {
      drawBox(ctx, x + 0.1, y + 0.1, 1.2, 1.2, bh, 14, PAL.wood);
      drawPyramid(ctx, x + 0.1, y + 0.1, 1.2, 1.2, bh + 14, 8, shade(PAL.wood, 0.7));
      for (let k = 0; k < 3; k++) drawLog(ctx, x + 1.3, y + 0.1 + k * 0.3, 0.5, 0.25, bh, 4);
      break;
    }
    case 'quarry': {
      drawBox(ctx, x + 0.15, y + 0.15, 0.8, 0.8, bh, 10, PAL.stone);
      drawBox(ctx, x + 1.0, y + 0.2, 0.6, 0.6, bh, 7, shade(PAL.stone, 1.1));
      drawBox(ctx, x + 0.4, y + 1.0, 0.7, 0.7, bh, 8, PAL.stone);
      drawBox(ctx, x + 1.2, y + 1.2, 0.6, 0.6, bh, 10, PAL.wood);
      break;
    }
    case 'market': {
      const mx = x + 0.1, my = y + 0.1, s = 1.8, p = 0.08;
      drawBox(ctx, mx, my, p, p, bh, 22, PAL.wood);
      drawBox(ctx, mx + s - p, my, p, p, bh, 22, PAL.wood);
      drawBox(ctx, mx, my + s - p, p, p, bh, 22, PAL.wood);
      drawBox(ctx, mx + s - p, my + s - p, p, p, bh, 22, PAL.wood);
      drawBox(ctx, mx, my, s, s, bh, 8, PAL.wood);
      for (let i = 0; i < 4; i++) drawBox(ctx, mx + i * 0.45, my, 0.45, s, bh + 20, 2, i % 2 === 0 ? PAL.gold : PAL.houseWall);
      break;
    }
    case 'palace': {
      drawBox(ctx, x + 0.05, y + 0.05, 3.9, 3.9, bh, 8, PAL.stone);
      drawBox(ctx, x + 0.4, y + 0.4, 3.2, 3.2, bh + 8, 28, PAL.palaceWall);
      drawPyramid(ctx, x + 0.2, y + 0.2, 3.6, 3.6, bh + 36, 14, PAL.palaceRoof);
      outline(ctx, [gpt(x + 0.2, y + 0.2, bh + 36), gpt(x + 3.8, y + 0.2, bh + 36), gpt(x + 3.8, y + 3.8, bh + 36), gpt(x + 0.2, y + 3.8, bh + 36)], PAL.gold, 1.5);
      drawBox(ctx, x + 1.0, y + 1.0, 2.0, 2.0, bh + 36, 12, PAL.palaceWall);
      drawPyramid(ctx, x + 0.8, y + 0.8, 2.4, 2.4, bh + 48, 14, PAL.palaceRoof);
      outline(ctx, [gpt(x + 0.8, y + 0.8, bh + 48), gpt(x + 3.2, y + 0.8, bh + 48), gpt(x + 3.2, y + 3.2, bh + 48), gpt(x + 0.8, y + 3.2, bh + 48)], PAL.gold, 1.5);
      break;
    }
    case 'gate': {
      const horiz = w > 1;
      for (let s = 0; s < 3; s++) {
        const tx = x + (horiz ? s : 0), ty = y + (horiz ? 0 : s);
        if (s === 1) {
          if (horiz) {
            drawBox(ctx, tx, y + 0.1, 1, 0.8, bh, 24, PAL.stone);
            drawArch(ctx, false, y + 0.9, tx + 0.5, bh);
          } else {
            drawBox(ctx, x + 0.1, ty, 0.8, 1, bh, 24, PAL.stone);
            drawArch(ctx, true, x + 0.9, ty + 0.5, bh);
          }
        } else {
          drawBox(ctx, tx + 0.1, ty + 0.1, 0.8, 0.8, bh, 34, PAL.stone);
          drawPyramid(ctx, tx + 0.1, ty + 0.1, 0.8, 0.8, bh + 34, 10, PAL.palaceRoof);
        }
      }
      break;
    }
    case 'wall': {
      drawBox(ctx, x + 0.15, y + 0.15, 0.7, 0.7, bh, 20, PAL.stone);
      for (let k = 0; k < 3; k++) drawBox(ctx, x + 0.15 + k * 0.25, y + 0.15, 0.2, 0.2, bh + 20, 5, PAL.stone);
      break;
    }
    case 'stairs': {
      const hHere = world.height[idx(x, y)];
      const dir = DIRS[o.rot];
      const dx = dir[0], dy = dir[1];
      const nx = x + dx, ny = y + dy;
      const rise = (inBounds(nx, ny) && world.height[idx(nx, ny)] > hHere) ? (world.height[idx(nx, ny)] - hHere) * HL : HL;
      const order = (dx < 0 || dy < 0) ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
      order.forEach(k => {
        const t0 = -0.5 + k / 5, t1 = -0.5 + (k + 1) / 5;
        let gx, gy, gw, gd;
        if (dx !== 0) {
          gx = cx + Math.min(dx * t0, dx * t1); gw = 0.2;
          gy = cy - 0.4; gd = 0.8;
        } else {
          gy = cy + Math.min(dy * t0, dy * t1); gd = 0.2;
          gx = cx - 0.4; gw = 0.8;
        }
        drawBox(ctx, gx, gy, gw, gd, bh, rise * (k + 1) / 5, shade(PAL.stone, 1.1));
      });
      break;
    }
    case 'ramp': {
      const hHere = world.height[idx(x, y)];
      const dir = DIRS[o.rot];
      const dx = dir[0], dy = dir[1];
      const nx = x + dx, ny = y + dy;
      const rise = (inBounds(nx, ny) && world.height[idx(nx, ny)] > hHere) ? (world.height[idx(nx, ny)] - hHere) * HL : HL;
      const order = (dx < 0 || dy < 0) ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
      order.forEach(k => {
        const t0 = k / 8, t1 = (k + 1) / 8;
        let gx, gy, gw, gd;
        if (dx !== 0) {
          const p0 = dx > 0 ? x + t0 : x + 1 - t0, p1 = dx > 0 ? x + t1 : x + 1 - t1;
          gx = Math.min(p0, p1); gw = Math.abs(p1 - p0);
          gy = y; gd = 2;
        } else {
          const p0 = dy > 0 ? y + t0 : y + 1 - t0, p1 = dy > 0 ? y + t1 : y + 1 - t1;
          gy = Math.min(p0, p1); gd = Math.abs(p1 - p0);
          gx = x; gw = 2;
        }
        drawBox(ctx, gx, gy, gw, gd, bh, rise * (k + 1) / 8, shade(PAL.road, 1.05));
      });
      break;
    }
    case 'bridge': {
      const even = o.rot % 2 === 0;
      drawBox(ctx, x, y, 1, 1, bh + 1, 3, PAL.wood);
      [0.25, 0.5, 0.75].forEach(t => {
        const a = even ? gpt(x + t, y, bh + 4) : gpt(x, y + t, bh + 4);
        const b = even ? gpt(x + t, y + 1, bh + 4) : gpt(x + 1, y + t, bh + 4);
        edgeLine(ctx, a, b, shade(PAL.wood, 0.7), 1, 1);
      });
      if (even) {
        drawBox(ctx, x, y + 0.06, 1, 0.08, bh + 3, 8, PAL.wood);
        drawBox(ctx, x, y + 0.86, 1, 0.08, bh + 3, 8, PAL.wood);
      } else {
        drawBox(ctx, x + 0.06, y, 0.08, 1, bh + 3, 8, PAL.wood);
        drawBox(ctx, x + 0.86, y, 0.08, 1, bh + 3, 8, PAL.wood);
      }
      break;
    }
    case 'archer': {
      drawBox(ctx, x + 0.05, y + 0.05, 2.9, 2.9, bh, 2, PAL.road);
      drawBox(ctx, x + 0.15, y + 0.15, 1.1, 2.7, bh + 2, 16, PAL.wood);
      drawPyramid(ctx, x + 0.1, y + 0.1, 1.2, 2.8, bh + 18, 10, PAL.houseRoof);
      drawFlag(ctx, x + 1.45, y + 0.35, bh + 2, 40, 0.45, 10, MIL_COL.black);
      drawTarget(ctx, x + 2.5, y + 0.7, bh + 2);
      drawTarget(ctx, x + 2.5, y + 1.7, bh + 2);
      for (let k = 0; k < 3; k++) drawBox(ctx, x + 1.5 + k * 0.18, y + 2.55, 0.05, 0.05, bh + 2, 12, shade(PAL.wood, 0.6));
      break;
    }
    case 'shield': {
      drawBox(ctx, x + 0.05, y + 0.05, 2.9, 2.9, bh, 2, PAL.road);
      drawBox(ctx, x + 0.2, y + 0.2, 2.0, 1.4, bh + 2, 18, PAL.houseWall);
      drawPyramid(ctx, x + 0.1, y + 0.1, 2.2, 1.6, bh + 20, 12, PAL.palaceRoof);
      drawFlag(ctx, x + 2.6, y + 0.4, bh + 2, 56, 0.8, 18, MIL_COL.red);
      for (let k = 0; k < 4; k++) {
        drawBox(ctx, x + 0.25 + k * 0.62, y + 2.55, 0.45, 0.1, bh + 2, 14, MIL_COL.red);
        drawBox(ctx, x + 0.42 + k * 0.62, y + 2.65, 0.1, 0.04, bh + 8, 3, PAL.gold);
      }
      break;
    }
    case 'cavalry': {
      const L = w > h; // 長邊沿 x；否則沿 y（a = 長邊座標、b = 短邊座標）
      const B = (a, b, la, lb, base, ht, col) => L ? drawBox(ctx, x + a, y + b, la, lb, base, ht, col) : drawBox(ctx, x + b, y + a, lb, la, base, ht, col);
      B(0.05, 0.05, 3.9, 2.9, bh, 2, PAL.road);
      B(0.1, 0.1, 3.8, 1.0, bh + 2, 14, PAL.wood);
      for (let k = 0; k < 4; k++) {
        if (L) drawDoor(ctx, false, y + 1.1, x + 0.55 + k * 0.95, bh + 2);
        else drawDoor(ctx, true, x + 1.1, y + 0.55 + k * 0.95, bh + 2);
      }
      if (L) drawPyramid(ctx, x + 0.05, y + 0.05, 3.9, 1.15, bh + 16, 10, shade(PAL.wood, 0.7));
      else drawPyramid(ctx, x + 0.05, y + 0.05, 1.15, 3.9, bh + 16, 10, shade(PAL.wood, 0.7));
      B(3.2, 1.45, 0.5, 0.4, bh + 2, 7, MIL_COL.hay);
      [1.0, 2.1].forEach(a => {
        B(a + 0.05, 1.95, 0.06, 0.06, bh + 2, 6, shade(MIL_COL.horse, 0.7));
        B(a + 0.45, 1.95, 0.06, 0.06, bh + 2, 6, shade(MIL_COL.horse, 0.7));
        B(a, 1.92, 0.56, 0.14, bh + 8, 6, MIL_COL.horse);
        B(a + 0.5, 1.92, 0.14, 0.14, bh + 12, 7, MIL_COL.horse);
      });
      B(0.1, 2.85, 3.8, 0.05, bh + 7, 2, PAL.wood);
      B(0.1, 2.85, 3.8, 0.05, bh + 12, 2, PAL.wood);
      [0.1, 1.05, 2.0, 2.95, 3.84].forEach(a => B(a, 2.83, 0.06, 0.06, bh + 2, 13, shade(PAL.wood, 0.75)));
      break;
    }
    case 'siege': {
      drawBox(ctx, x + 0.05, y + 0.05, 2.9, 2.9, bh, 2, PAL.road);
      drawBox(ctx, x + 0.15, y + 0.15, 0.1, 0.1, bh + 2, 20, PAL.wood);
      drawBox(ctx, x + 1.35, y + 0.15, 0.1, 0.1, bh + 2, 20, PAL.wood);
      for (let k = 0; k < 3; k++) drawLog(ctx, x + 0.35, y + 0.5 + k * 0.7, 0.9, 0.3, bh + 2, 4);
      drawBox(ctx, x + 0.15, y + 2.75, 0.1, 0.1, bh + 2, 20, PAL.wood);
      drawBox(ctx, x + 1.35, y + 2.75, 0.1, 0.1, bh + 2, 20, PAL.wood);
      drawPyramid(ctx, x + 0.1, y + 0.1, 1.4, 2.8, bh + 22, 10, PAL.houseRoof);
      drawBox(ctx, x + 1.9, y + 0.9, 0.9, 1.2, bh + 2, 4, shade(PAL.wood, 0.85));
      drawBox(ctx, x + 2.3, y + 0.95, 0.08, 0.08, bh + 6, 26, PAL.wood);
      drawBox(ctx, x + 2.3, y + 0.95, 0.08, 1.1, bh + 32, 3, shade(PAL.wood, 0.7));
      const armA = gpt(x + 1.8, y + 1.5, bh + 14), armB = gpt(x + 2.95, y + 1.5, bh + 50);
      edgeLine(ctx, armA, armB, shade(PAL.wood, 0.55), 3, ctx.globalAlpha);
      edgeLine(ctx, armB, gpt(x + 2.95, y + 1.5, bh + 38), '#333333', 1, ctx.globalAlpha);
      drawBox(ctx, x + 2.3, y + 1.97, 0.08, 0.08, bh + 6, 26, PAL.wood);
      drawBox(ctx, x + 2.35, y + 2.4, 0.35, 0.35, bh + 2, 5, PAL.stone);
      break;
    }
    case 'hospital': {
      drawBox(ctx, x + 0.08, y + 0.08, 1.84, 1.84, bh, 3, PAL.stone);
      drawBox(ctx, x + 0.2, y + 0.2, 1.6, 1.2, bh + 3, 18, MIL_COL.white);
      drawDoor(ctx, false, y + 1.4, x + 0.8, bh + 3);
      drawPyramid(ctx, x + 0.1, y + 0.1, 1.8, 1.4, bh + 21, 12, PAL.palaceRoof);
      drawBox(ctx, x + 0.25, y + 1.55, 0.35, 0.3, bh + 3, 4, MIL_COL.herb);
      drawBox(ctx, x + 0.7, y + 1.55, 0.35, 0.3, bh + 3, 4, shade(MIL_COL.herb, 1.25));
      [[bh + 10, 3.5], [bh + 15, 2.5]].forEach(g => {
        const c = gpt(x + 1.3, y + 1.42, g[0]);
        ctx.beginPath();
        ctx.arc(c[0], c[1], g[1], 0, Math.PI * 2);
        ctx.fillStyle = PAL.gold;
        ctx.fill();
      });
      drawFlag(ctx, x + 1.7, y + 1.7, bh + 3, 36, 0.22, 22, MIL_COL.herb);
      break;
    }
    case 'research': {
      drawBox(ctx, x + 0.05, y + 0.05, 2.9, 2.9, bh, 4, PAL.stone);
      drawBox(ctx, x + 2.0, y + 0.3, 0.75, 0.3, bh + 4, 10, TECH_COL.lacquer);
      for (let k = 0; k < 3; k++) drawBox(ctx, x + 2.04 + k * 0.24, y + 0.33, 0.2, 0.24, bh + 14, 4, TECH_COL.bamboo);
      drawBox(ctx, x + 0.25, y + 0.25, 1.5, 1.7, bh + 4, 20, TECH_COL.wood);
      drawDoor(ctx, false, y + 1.95, x + 1.0, bh + 4);
      drawPyramid(ctx, x + 0.1, y + 0.1, 1.8, 2.0, bh + 24, 7, TECH_COL.roof);
      drawBox(ctx, x + 0.45, y + 0.5, 1.1, 1.2, bh + 27, 14, TECH_COL.wood);
      drawPyramid(ctx, x + 0.3, y + 0.35, 1.4, 1.5, bh + 41, 14, TECH_COL.roof);
      outline(ctx, [gpt(x + 0.3, y + 0.35, bh + 41), gpt(x + 1.7, y + 0.35, bh + 41), gpt(x + 1.7, y + 1.85, bh + 41), gpt(x + 0.3, y + 1.85, bh + 41)], PAL.gold, 1.2);
      drawBox(ctx, x + 2.1, y + 1.7, 0.6, 0.6, bh + 4, 8, PAL.stone);
      drawBox(ctx, x + 2.37, y + 1.97, 0.06, 0.06, bh + 12, 6, TECH_COL.bronze);
      const ring = gpt(x + 2.4, y + 2.0, bh + 26);
      ctx.lineWidth = 2;
      ctx.strokeStyle = TECH_COL.bronze;
      [[9, 9, 0], [9, 3.5, 0], [9, 3.5, Math.PI / 3], [3.5, 9, 0]].forEach(r => {
        ctx.beginPath();
        ctx.ellipse(ring[0], ring[1], r[0], r[1], r[2], 0, Math.PI * 2);
        ctx.stroke();
      });
      break;
    }
    default:
      if (typeof drawCampObject === 'function' && drawCampObject(ctx, o, x, y, w, h, bh, drawNow)) break;
      drawBox(ctx, x, y, w, h, bh, 10, '#ff00ff');
  }
  ctx.restore();
}

// 小縮放的建築色塊：佔格頂面一塊純色（軍事紅、樹綠、其餘石灰），縮到最小仍可辨識
function drawObjBlob(ctx, o) {
  const fp = OBJECTS[o.type] ? footprint(o.type, o.rot) : [1, 1];
  const top = world.height[idx(o.x, o.y)] * HL + 14;
  const col = o.type === 'tree' ? PAL.canopyDark : (OBJECTS[o.type] && OBJECTS[o.type].mil ? MIL_COL.red : '#c9b48a');
  poly(ctx, [gpt(o.x, o.y, top), gpt(o.x + fp[0], o.y, top), gpt(o.x + fp[0], o.y + fp[1], top), gpt(o.x, o.y + fp[1], top)], col);
}

// 待購物件：金色底＋半透明本體＋金色虛線外框；選取中改白色實線
function drawPendingObj(ctx, o) {
  const fp = footprint(o.type, o.rot);
  const bh = world.height[idx(o.x, o.y)] * HL;
  const sel = pend.sel >= 0 && pend.list[pend.sel] === o;
  const pts = [gpt(o.x, o.y, bh), gpt(o.x + fp[0], o.y, bh), gpt(o.x + fp[0], o.y + fp[1], bh), gpt(o.x, o.y + fp[1], bh)];
  poly(ctx, pts, sel ? 'rgba(255,255,255,.30)' : 'rgba(255,214,90,.22)');
  drawObject(ctx, o, sel && pend.moving ? 0.3 : 0.6);
  ctx.save();
  ctx.setLineDash(sel ? [] : [5, 4]);
  outline(ctx, pts, sel ? '#ffffff' : '#ffd65a', sel ? 2.5 : 1.5);
  ctx.restore();
}

// 隱藏建築時的佔格輪廓（PLAN 12.17）：已建 = 白、待購 = 金、不合法 = 紅；只畫物件外緣的邊
function drawGhostCell(ctx, x, y) {
  const i = idx(x, y);
  const n = world.occ[i], pn = pend.occ[i];
  if (!n && !pn) return;
  const bad = n && hide.badCell[i];
  const p = topPts(x, y, world.height[i], 0);
  poly(ctx, p, bad ? 'rgba(230,70,70,.40)' : (n ? 'rgba(255,255,255,.14)' : 'rgba(255,214,90,.18)'));
  const col = bad ? '#ff5a4a' : (n ? 'rgba(255,255,255,.8)' : '#ffd65a');
  const edges = [[0, 1, x, y - 1], [1, 2, x + 1, y], [2, 3, x, y + 1], [3, 0, x - 1, y]];
  edges.forEach(e => {
    const j = inBounds(e[2], e[3]) ? idx(e[2], e[3]) : -1;
    const same = j >= 0 && (n ? world.occ[j] === n : pend.occ[j] === pn);
    if (!same) edgeLine(ctx, p[e[0]], p[e[1]], col, bad ? 2 : 1.5, 1);
  });
}

// 懸停預覽
function fillCells(ctx, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++)
      if (inBounds(xx, yy)) {
        cellPath(ctx, xx, yy, 0);
        ctx.fillStyle = color;
        ctx.fill();
      }
}

function strokeCell(ctx, x, y, color, lw) {
  cellPath(ctx, x, y, 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function drawPreview(ctx) {
  const t = preview.tool;
  const x = preview.x, y = preview.y;
  if (!t || !inBounds(x, y)) return;
  const okColor = preview.ok ? 'rgba(80,220,120,.45)' : 'rgba(230,70,70,.45)';
  if (OBJECTS[t]) {
    const fp = footprint(t, preview.rot);
    fillCells(ctx, x, y, fp[0], fp[1], okColor);
    drawObject(ctx, { type: t, x: x, y: y, rot: preview.rot }, 0.55);
  } else if (t === 'erase') {
    if (hide.on) {
      strokeCell(ctx, x, y, preview.ok ? 'rgba(80,220,120,1)' : 'rgba(230,70,70,1)', 2);
      return;
    }
    const pn = pend.occ[idx(x, y)];
    if (pn) {
      const po = pend.list[pn - 1];
      const pf = footprint(po.type, po.rot);
      fillCells(ctx, po.x, po.y, pf[0], pf[1], 'rgba(230,70,70,.45)');
      return;
    }
    const n = world.occ[idx(x, y)];
    if (n) {
      const o = world.objects[n - 1];
      const fp = footprint(o.type, o.rot);
      fillCells(ctx, o.x, o.y, fp[0], fp[1], 'rgba(230,70,70,.45)');
    } else {
      strokeCell(ctx, x, y, 'rgba(230,70,70,1)', 2);
    }
  } else {
    const hn = hide.on && (t === 'raise' || t === 'lower') ? world.occ[idx(x, y)] : 0;
    if (hn) {
      const ho = world.objects[hn - 1];
      const hf = footprint(ho.type, ho.rot);
      fillCells(ctx, ho.x, ho.y, hf[0], hf[1], okColor);
      return;
    }
    strokeCell(ctx, x, y, preview.ok ? 'rgba(80,220,120,1)' : 'rgba(230,70,70,1)', 2);
    if (t === 'river') {
      const d = DIRS[preview.rot];
      const dx = d[0], dy = d[1];
      const h = world.height[idx(x, y)];
      const cx = x + 0.5, cy = y + 0.5;
      const tip = gpt(cx + dx * 0.25, cy + dy * 0.25, h * HL);
      const l = gpt(cx + dx * 0.25 - dx * 0.12 - dy * 0.12, cy + dy * 0.25 - dy * 0.12 + dx * 0.12, h * HL);
      const r = gpt(cx + dx * 0.25 - dx * 0.12 + dy * 0.12, cy + dy * 0.25 - dy * 0.12 - dx * 0.12, h * HL);
      const tail = gpt(cx - dx * 0.25, cy - dy * 0.25, h * HL);
      ctx.beginPath();
      ctx.moveTo(tail[0], tail[1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.moveTo(l[0], l[1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(r[0], r[1]);
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

// 視窗裁剪
function rectVisible(x0, y0, x1, y1) {
  const a = worldToScreen(x0, y0), b = worldToScreen(x1, y1);
  return b[0] >= 0 && a[0] <= viewport.w && b[1] >= 0 && a[1] <= viewport.h;
}

function cellVisible(x, y) {
  const h = world.height[idx(x, y)];
  const cx = isoX(x + 0.5, y + 0.5), cy = isoY(x + 0.5, y + 0.5, h);
  return rectVisible(cx - TW / 2, cy - (MAX_H * HL + 80), cx + TW / 2, cy + TH + MAX_H * HL);
}

function objVisible(o) {
  const fp = footprint(o.type, o.rot);
  const w = fp[0], h = fp[1];
  return rectVisible(isoX(o.x, o.y + h), isoY(o.x, o.y, 0) - 100, isoX(o.x + w, o.y), isoY(o.x + w, o.y + h, 0) + TH);
}

var drawNow = 0;
function draw(ctx, time) {
  drawNow = time;
  const cv = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let bgCol = PAL.bg;
  if (typeof artSky === 'function') bgCol = artSky(bgCol);
  ctx.fillStyle = bgCol;
  ctx.fillRect(0, 0, cv.width, cv.height);

  const z = view.zoom, r = viewport.dpr;
  ctx.setTransform(r * z, 0, 0, r * z, r * (viewport.w / 2 - view.x * z), r * (viewport.h / 2 - view.y * z));

  const hid = hide.on && !pano.open; // 隱藏建築（PLAN 12.17）；全景一律畫實際建築
  if (typeof tdZonePrep === 'function') tdZonePrep(time);
  if (typeof lifeFrame === 'function') lifeFrame(time);

  for (let d = 0; d <= MAP_W + MAP_H - 2; d++) {
    for (let x = Math.max(0, d - MAP_H + 1); x <= Math.min(d, MAP_W - 1); x++) {
      const y = d - x;
      if (cellVisible(x, y)) {
        drawTile(ctx, x, y, time);
        if (hid) drawGhostCell(ctx, x, y);
        if (typeof tdZoneCell === 'function') tdZoneCell(ctx, x, y);
      }
    }
    if (typeof drawOverlayDiag === 'function') drawOverlayDiag(ctx, d, time);
    const list = hid ? null : world.objDiag[d];
    if (list) {
      list.slice().sort((a, b) => a.x - b.x).forEach(o => {
        if (!objVisible(o) || (typeof tdObjSkip === 'function' && tdObjSkip(o))) return;
        if (view.zoom < OBJ_BLOB_ZOOM) drawObjBlob(ctx, o);
        else drawObject(ctx, o, 1);
      });
    }
    const pl = pano.open || hid ? null : pend.diag[d];
    if (pl) {
      pl.slice().sort((a, b) => a.x - b.x).forEach(o => {
        if (objVisible(o)) drawPendingObj(ctx, o);
      });
    }
    if (typeof drawBattleDiag === 'function') drawBattleDiag(ctx, d, time);
    if (typeof lifeDrawDiag === 'function') lifeDrawDiag(ctx, d, time);
  }

  if (typeof drawWorldOverlay === 'function') drawWorldOverlay(ctx, time);
  if (typeof tdDrawDrop === 'function') tdDrawDrop(ctx, time);
  if (typeof artLights === 'function') artLights(ctx, time);
  if (typeof lifeDrawTop === 'function') lifeDrawTop(ctx, time);
  if (preview.visible) drawPreview(ctx);
  ctx.setTransform(r, 0, 0, r, 0, 0);
  if (typeof drawScreenHud === 'function') drawScreenHud(ctx, time);
}
