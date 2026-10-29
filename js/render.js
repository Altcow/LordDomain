let currentSeason = 'spring';
function setSeason(name) {
  if (PALETTES[name]) {
    currentSeason = name;
    PAL = PALETTES[name];
  }
}

const view = { x: 0, y: 0, zoom: 1 };
const ZOOM_FLOOR = 0.5, ZOOM_MIN_CAP = 1.5, ZOOM_MAX = 2.5;
const MAX_VIEW_CELLS = 1200;
let zoomMin = ZOOM_FLOOR;
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

// 依視窗面積限制最多可見約 MAX_VIEW_CELLS 格（每格世界面積 TW*TH/2）
function updateZoomMin() {
  const z = Math.sqrt(viewport.w * viewport.h / (MAX_VIEW_CELLS * TW * TH / 2));
  zoomMin = Math.min(ZOOM_MIN_CAP, Math.max(ZOOM_FLOOR, z));
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

function clampView() {
  view.x = Math.min(isoX(MAP_W, 0), Math.max(isoX(0, MAP_H), view.x));
  view.y = Math.min(isoY(MAP_W, MAP_H, 0), Math.max(isoY(0, 0, MAX_H), view.y));
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

// 地形繪製
function drawCliffFace(ctx, ax, ay, bx, by, h, hn, color) {
  poly(ctx, [
    [isoX(ax, ay), isoY(ax, ay, h)],
    [isoX(bx, by), isoY(bx, by, h)],
    [isoX(bx, by), isoY(bx, by, hn)],
    [isoX(ax, ay), isoY(ax, ay, hn)]
  ], color);
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
  ctx.fillStyle = t === T_ROAD ? PAL.road : (wet ? PAL.water : PAL.grass[cellHash(x, y) % 3]);
  ctx.fill();

  // 邊線: 0 上→1 右 面向 (x,y-1); 1→2 面向 (x+1,y); 2→3 面向 (x,y+1); 3→0 面向 (x-1,y)
  const edges = [[0, 1, x, y - 1], [1, 2, x + 1, y], [2, 3, x, y + 1], [3, 0, x - 1, y]];
  edges.forEach(e => {
    if (!inBounds(e[2], e[3])) return;
    const nt = world.terrain[idx(e[2], e[3])];
    if (t === T_ROAD && nt !== T_ROAD) edgeLine(ctx, p[e[0]], p[e[1]], PAL.roadEdge, 1, 1);
    else if (wet && nt !== T_LAKE && nt !== T_RIVER) edgeLine(ctx, p[e[0]], p[e[1]], PAL.foam, 2, 0.6);
  });

  polyPath(ctx, p);
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (t === T_RIVER) drawRiver(ctx, x, y, h, time);
  else if (t === T_LAKE) drawLake(ctx, x, y, h, time);
}

// 物件繪製
function drawObject(ctx, o, alpha) {
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
    default:
      drawBox(ctx, x, y, w, h, bh, 10, '#ff00ff');
  }
  ctx.restore();
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
    const n = world.occ[idx(x, y)];
    if (n) {
      const o = world.objects[n - 1];
      const fp = footprint(o.type, o.rot);
      fillCells(ctx, o.x, o.y, fp[0], fp[1], 'rgba(230,70,70,.45)');
    } else {
      strokeCell(ctx, x, y, 'rgba(230,70,70,1)', 2);
    }
  } else {
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

function draw(ctx, time) {
  const cv = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, cv.width, cv.height);

  const z = view.zoom, r = viewport.dpr;
  ctx.setTransform(r * z, 0, 0, r * z, r * (viewport.w / 2 - view.x * z), r * (viewport.h / 2 - view.y * z));

  for (let d = 0; d <= MAP_W + MAP_H - 2; d++) {
    for (let x = Math.max(0, d - MAP_H + 1); x <= Math.min(d, MAP_W - 1); x++) {
      const y = d - x;
      if (cellVisible(x, y)) drawTile(ctx, x, y, time);
    }
    const list = world.objDiag[d];
    if (list) {
      list.slice().sort((a, b) => a.x - b.x).forEach(o => {
        if (objVisible(o)) drawObject(ctx, o, 1);
      });
    }
  }

  if (preview.visible) drawPreview(ctx);
}
