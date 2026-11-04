let currentSeason = 'spring';
function setSeason(name) {
  if (PALETTES[name]) {
    currentSeason = name;
    PAL = PALETTES[name];
  }
}

const view = { x: 0, y: 0, zoom: 1 };
const ZOOM_ABS_MIN = 0.35, ZOOM_MIN_CAP = 1.5, ZOOM_MAX = 2.5;
// 一般遊玩縮放範圍(降低最壞繪製成本與記憶體):手機 / 觸控 0.55~1.6;桌機大視窗(窗寬 >= 1000 且非觸控)0.45~2.0。
// 拍照 / 錄影運鏡 / 全景一律用寬範圍(zoomAbsMin()~ZOOM_MAX)。所有設定 view.zoom 的路徑都經 clampZoom() / zoomLimits()
const ZOOM_PLAY_MIN = 0.55, ZOOM_PLAY_MAX = 1.6, ZOOM_PLAY_MIN_WIDE = 0.45, ZOOM_PLAY_MAX_WIDE = 2.0, ZOOM_DESKTOP_W = 1000;
const ZOOM_ABS_MIN_BIG = 0.15;   // 經營大板(邊長 > MAP_W)的全景縮放下限(PLAN_BIGMAP §7.1);戰陣 / 戰鬥板維持 ZOOM_ABS_MIN
function zoomAbsMin() { return boardW() > MAP_W ? ZOOM_ABS_MIN_BIG : ZOOM_ABS_MIN; }
// 視圖範圍(格座標 [x0, y0, x1, y1],x1 / y1 不含):大板的經營模式在土地未全開時限制在「土地外框 + 6 格」,其餘為整張板子
const VIEW_LAND_MARGIN = 6;
function viewCells() {
  const W = boardW(), H = boardH();
  if (W > MAP_W && game.mode === 'estate' && world.board !== 'estate' && typeof prog !== 'undefined' && prog && typeof progLandSide === 'function' && prog.lv < PROG_LV_MAX) {
    const side = Math.min(W, progLandSide(prog.lv) + VIEW_LAND_MARGIN * 2), o = (W - side) >> 1;
    return [o, o, o + side, o + side];
  }
  return [0, 0, W, H];
}
// 縮放低於此值:不畫地格邊線(細線會閃爍)、建築改畫色塊
const TILE_EDGE_MIN_ZOOM = 0.35, OBJ_BLOB_ZOOM = 0.35;
let zoomMin = ZOOM_ABS_MIN, zoomMax = ZOOM_MAX;
let zoomLimKey = '';   // 目前生效的縮放範圍簽名(模式 / 視窗改變時重算 zoomMin、zoomMax)
// 拍照 / 錄影 / 全景(含離屏渲染中)為寬範圍模式
function zoomWideMode() {
  try {
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      const cl = document.body.classList;
      if (cl.contains('shooting') || cl.contains('photo-mode')) return true;
    }
    if (typeof REC === 'object' && REC && REC.state && REC.state !== 'idle') return true;
    if (typeof pano === 'object' && pano && (pano.open || pano.busy || pano.rend)) return true;
  } catch (e) { /* 載入順序未就緒:視為一般模式 */ }
  return false;
}
// 回傳目前模式的縮放上下限(未含「整圖塞進視窗」的 fit 下限;fit 見 updateZoomMin)
function zoomLimits() {
  if (zoomWideMode()) return { min: zoomAbsMin(), max: ZOOM_MAX, wide: true };
  const desk = viewport.w >= ZOOM_DESKTOP_W && !(typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  return desk ? { min: ZOOM_PLAY_MIN_WIDE, max: ZOOM_PLAY_MAX_WIDE, wide: false } : { min: ZOOM_PLAY_MIN, max: ZOOM_PLAY_MAX, wide: false };
}
// 所有「設定縮放」的統一夾限(含 fit 下限);模式若剛切換先同步 zoomMin / zoomMax
function clampZoom(z) {
  const L = zoomLimits(), key = L.min + '|' + L.max + '|' + viewport.w;
  if (key !== zoomLimKey) updateZoomMin(true);
  return Math.max(zoomMin, Math.min(zoomMax, z));
}
// 每幀:縮放超出目前範圍(離開拍照 / 錄影、或任何繞過夾限的路徑)時平順拉回
function zoomEase() {
  const z = view.zoom, t = Math.max(zoomMin, Math.min(zoomMax, z));
  if (t === z) return;
  view.zoom = Math.abs(t - z) < 0.004 ? t : z + (t - z) * 0.2;
  clampView();
}
let viewKey = null;   // 板子邊長 + 視圖範圍;改變(換板 / 升級擴地)時重算 zoomMin 與視圖夾限
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

// 縮放下限 = 視圖範圍(整張地圖或大板的土地外框)剛好塞進視窗(寬高取較嚴者),上限 ZOOM_MIN_CAP;所有地圖共用
function updateZoomMin(soft) {
  const b = viewCells(), n = (b[2] - b[0]) + (b[3] - b[1]);
  const fit = Math.min(viewport.w / (n * TW / 2), viewport.h / (n * TH / 2 + MAX_H * HL + 64));
  const L = zoomLimits();
  zoomMax = L.max;
  zoomMin = Math.min(L.max, Math.max(L.min, Math.min(ZOOM_MIN_CAP, fit)));
  zoomLimKey = L.min + '|' + L.max + '|' + viewport.w;
  if (!soft) view.zoom = Math.max(zoomMin, Math.min(zoomMax, view.zoom));   // soft = 模式切換:交給 zoomEase 平順拉回
  viewKey = boardW() + '|' + b.join(',');
}
// 每幀檢查:換板或土地擴張後視圖範圍變了才重算(第一次只記錄,不動視圖)
function syncBoardView() {
  const key = boardW() + '|' + viewCells().join(',');
  if (viewKey === null) { viewKey = key; return; }
  if (key !== viewKey) { updateZoomMin(); clampView(); }
  if (typeof pano === 'object' && pano.rend) return;   // 全景離屏渲染中:view.zoom 是暫代值,不得動
  const L = zoomLimits();
  if (L.min + '|' + L.max + '|' + viewport.w !== zoomLimKey) updateZoomMin(true);
  zoomEase();
}

// 手機(窗寬 <= 600 或觸控裝置)開機時的預設縮放:可視面積約 1.6 倍;不小於 zoomMin。僅開機套用一次,使用者手動縮放不受影響
const MOBILE_START_ZOOM = 0.55;
function isMobileLayout() {
  return viewport.w <= 600 || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
}
function applyStartZoom() {
  if (!isMobileLayout()) return;
  view.zoom = Math.max(zoomMin, Math.min(zoomMax, view.zoom * MOBILE_START_ZOOM));   // main.js 於 resizeCanvas 之後呼叫,zoomMin / zoomMax 已就緒
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
  view.zoom = clampZoom(view.zoom * factor);
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
  const b = viewCells();
  const xl = isoX(b[0], b[3]), xh = isoX(b[2], b[1]);
  const yl = isoY(b[0], b[1], MAX_H), yh = isoY(b[2], b[3], 0);
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
    const a = gpt(wCellClamp(cx - dx * 0.125, x), wCellClamp(cy - dy * 0.125, y), hp);
    const b = gpt(wCellClamp(cx + dx * 0.125, x), wCellClamp(cy + dy * 0.125, y), hp);
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
  const px = wCellClamp(x + ((hs >>> 3) % 10) / 10, x, 0.1), py = wCellClamp(y + ((hs >>> 7) % 10) / 10, y, 0.1);
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

// ===== 沙地 / 裂地 / 雪地(純視覺地形,玩法等同草地;見 data.js isGroundTerrain)=====
// 繪製只依 (x, y, 高度, 地形, 季節) 與 PAL,與 time 無關,可直接放進地形分塊快取(若換季或 ART 時段改變須整批作廢)。
// 色票:3 種底色、冬季 3 種底色、紋路色、點綴色、亮色。沙地四季近乎不變、冬季偏冷;雪地四季皆白,夏季不融化。
const GROUND2 = {
  4: { base: ['#ecd9a0', '#e6d195', '#f0dfab'], cold: ['#dcd7bf', '#d6d2bb', '#e2decb'], mark: '#d2ba7c', dot: '#c2a562', lite: '#f8ecc6' },
  5: { base: ['#c9a66b', '#c19e62', '#d0ad74'], cold: ['#b9ab91', '#b2a48a', '#c0b49b'], mark: '#6b4a27', dot: '#a68a3c', lite: '#e0c48e' },
  6: { base: ['#f2f8fd', '#e8f1f9', '#f8fbfe'], cold: ['#f0f6fc', '#e6eff8', '#f7fbfe'], mark: '#c3d6ea', dot: '#aebfd6', lite: '#ffffff' },
  // 人工地面 7~12(四季同色,cold = base):石板 / 夯土 / 水泥 / 鋼鐵 / 木棧板 / 木紋地板。地形色票不跟城市風格主題變色
  7: { base: ['#b9bbbd', '#b2b5b8', '#c0c2c4'], cold: ['#b9bbbd', '#b2b5b8', '#c0c2c4'], mark: '#7b7f85', dot: '#8f9399', lite: '#dcdee0' },
  8: { base: ['#cdad6f', '#c6a668', '#d3b578'], cold: ['#cdad6f', '#c6a668', '#d3b578'], mark: '#9c7d44', dot: '#8a7650', lite: '#e4cb92' },
  9: { base: ['#c8c9ca', '#c2c3c5', '#cecfd0'], cold: ['#c8c9ca', '#c2c3c5', '#cecfd0'], mark: '#8f9296', dot: '#7f8184', lite: '#e6e7e8' },
  10: { base: ['#4b5766', '#455060', '#515d6e'], cold: ['#4b5766', '#455060', '#515d6e'], mark: '#27303b', dot: '#8f5a38', lite: '#8796ac' },
  11: { base: ['#a67c4e', '#9d7447', '#ae8556'], cold: ['#a67c4e', '#9d7447', '#ae8556'], mark: '#5c4023', dot: '#4a3320', lite: '#cb9f6c' },
  12: { base: ['#c08a52', '#b78248', '#c8935c'], cold: ['#c08a52', '#b78248', '#c8935c'], mark: '#7a5230', dot: '#6b4526', lite: '#e0b284' },
  // 自然地面 13~18(貼圖缺失時的回退:底色 + 雜點;冬季 cold = 淡雪色調,岩地不積雪 cold = base)
  13: { base: ['#8a6a46', '#826140', '#927250'], cold: ['#b4a692', '#ac9e8a', '#bcae9a'], mark: '#5e4529', dot: '#6e5232', lite: '#a98a62' },
  14: { base: ['#8d9094', '#868a8e', '#94979b'], cold: ['#8d9094', '#868a8e', '#94979b'], mark: '#5f6368', dot: '#6f7378', lite: '#b4b7bb' },
  15: { base: ['#a78a62', '#9f825a', '#af9269'], cold: ['#bdb09b', '#b5a893', '#c4b8a3'], mark: '#5b4126', dot: '#7a5e38', lite: '#c6ac84' },
  16: { base: ['#3d352f', '#382f29', '#433a34'], cold: ['#72706e', '#6b6968', '#797674'], mark: '#231d19', dot: '#544a40', lite: '#5e544a' },
  17: { base: ['#4f7a3a', '#497335', '#568241'], cold: ['#7f9a74', '#78946d', '#87a17c'], mark: '#2f5226', dot: '#3b6430', lite: '#73a05a' },
  18: { base: ['#a4523a', '#9b4b35', '#ac5a42'], cold: ['#b88478', '#b07c70', '#c08c80'], mark: '#6b3022', dot: '#7a3a28', lite: '#c47658' }
};
const G2_DETAIL_ZOOM = 0.5;   // 縮放低於此值只畫底色與接縫,不畫紋路
// 龜裂紋:座標為格內 (u,v) 0~1 的折線;使用時依雜湊翻轉 / 對調,5 款 x 8 = 40 種
const G2_CRACKS = [
  [[0.1, 0.5, 0.3, 0.42, 0.5, 0.55, 0.72, 0.48, 0.9, 0.58], [0.5, 0.55, 0.46, 0.8, 0.52, 0.92]],
  [[0.2, 0.1, 0.35, 0.35, 0.3, 0.6, 0.5, 0.78, 0.6, 0.95], [0.35, 0.35, 0.65, 0.3, 0.88, 0.4], [0.3, 0.6, 0.1, 0.72]],
  [[0.08, 0.2, 0.4, 0.3, 0.55, 0.15], [0.4, 0.3, 0.5, 0.55, 0.85, 0.65], [0.5, 0.55, 0.35, 0.85, 0.2, 0.92], [0.85, 0.65, 0.92, 0.88]],
  [[0.5, 0.08, 0.42, 0.3, 0.58, 0.5, 0.45, 0.7, 0.5, 0.92], [0.58, 0.5, 0.82, 0.42], [0.42, 0.3, 0.15, 0.38], [0.45, 0.7, 0.2, 0.82]],
  [[0.12, 0.85, 0.3, 0.62, 0.55, 0.66, 0.7, 0.4, 0.9, 0.3], [0.55, 0.66, 0.62, 0.9], [0.7, 0.4, 0.62, 0.12]]
];
const g2MixMemo = {};

function g2Hash(x, y, t) {
  let h = (cellHash(x, y) ^ Math.imul(t, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

// 兩個 #rrggbb 依比例 k 混色(有快取,色票有限)
function g2Mix(a, b, k) {
  const key = a + b + k;
  let r = g2MixMemo[key];
  if (r) return r;
  r = '#';
  for (let i = 1; i <= 5; i += 2) {
    const v = Math.round(parseInt(a.substr(i, 2), 16) * (1 - k) + parseInt(b.substr(i, 2), 16) * k);
    r += (v < 16 ? '0' : '') + v.toString(16);
  }
  g2MixMemo[key] = r;
  return r;
}

function g2Tint(c) { return typeof artTile === 'function' ? artTile(c) : c; }

// 地形 t(4~6)的底色;hs 為 cellHash(x, y)(與草地同樣依格挑 3 色之一)
function groundTileCol(t, hs) {
  const g = GROUND2[t];
  return (currentSeason === 'winter' ? g.cold : g.base)[hs % 3];
}

// 該地形的代表色(接縫混色用,不分格)
function g2Flat(t) {
  if (t > T_LAST && typeof liveFlat === 'function') return liveFlat(t);
  if (t === T_GRASS || t > T_LAST || !GROUND2[t]) return PAL.grass[0];
  return (currentSeason === 'winter' ? GROUND2[t].cold : GROUND2[t].base)[0];
}

// 在格內畫折線 pts([u0,v0,u1,v1,...]),f 為 0~7 的翻轉 / 對調代碼
function g2Poly(ctx, P, pts, f) {
  for (let i = 0; i < pts.length; i += 2) {
    let u = pts[i], v = pts[i + 1], w;
    if (f & 4) { w = u; u = v; v = w; }
    if (f & 1) u = 1 - u;
    if (f & 2) v = 1 - v;
    const q = P(u, v);
    if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
  }
}

function g2Ellipse(ctx, q, rx, ry) {
  ctx.moveTo(q[0] + rx, q[1]);
  ctx.ellipse(q[0], q[1], rx, ry, 0, 0, 6.2832);
}

// 沙地 / 裂地 / 雪地的細部紋路(底色已填);純函式,與 time 無關
function drawGround2(ctx, x, y, h, t) {
  const hs = g2Hash(x, y, t), hp = h * HL, g = GROUND2[t];
  const P = (u, v) => gpt(x + u, y + v, hp);
  ctx.save();
  if (t === T_SAND) {
    // 風紋:沿等角 x 或 y 軸的 2 條淺弧線 + 細沙點
    const sw = (hs & 1) === 1, off = ((hs >>> 1) & 7) / 40;
    ctx.beginPath();
    for (let k = 0; k < 2; k++) {
      const v = 0.28 + 0.38 * k + off, bend = (k ? -1 : 1) * 0.07;
      const a = sw ? P(v, 0.14) : P(0.14, v), m = sw ? P(v + bend, 0.5) : P(0.5, v + bend), b = sw ? P(v, 0.86 - k * 0.12) : P(0.86 - k * 0.12, v);
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]);
    }
    ctx.strokeStyle = g2Tint(g.mark);
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.75;
    ctx.stroke();
    ctx.beginPath();
    const hi = sw ? P(0.3 + off, 0.22) : P(0.22, 0.3 + off), hj = sw ? P(0.3 + off, 0.5) : P(0.5, 0.3 + off);
    ctx.moveTo(hi[0], hi[1] - 1);
    ctx.lineTo(hj[0], hj[1] - 1);
    ctx.strokeStyle = g2Tint(g.lite);
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.fillStyle = g2Tint(g.dot);
    ctx.globalAlpha = 0.8;
    for (let k = 0; k < 4; k++) {
      const q = P(0.12 + ((hs >>> (4 + k * 5)) & 15) / 20, 0.12 + ((hs >>> (6 + k * 5)) & 15) / 20);
      ctx.fillRect(q[0], q[1], 1.3, 1);
    }
  } else if (t === T_CRACK) {
    const pat = G2_CRACKS[(hs >>> 3) % G2_CRACKS.length], f = (hs >>> 8) & 7;
    // 土色斑塊(局部乾裂深淺)
    if ((hs >>> 11) % 3 === 0) {
      ctx.beginPath();
      g2Ellipse(ctx, P(0.3 + ((hs >>> 13) & 7) / 14, 0.3 + ((hs >>> 16) & 7) / 14), 9, 4.5);
      ctx.fillStyle = g2Tint(g.mark);
      ctx.globalAlpha = 0.1;
      ctx.fill();
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k < pat.length; k++) g2Poly(ctx, P, pat[k], f);
    ctx.save();
    ctx.translate(0, 1);
    ctx.strokeStyle = g2Tint(g.lite);
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = g2Tint(g.mark);
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    // 小碎石或枯草
    const r = (hs >>> 18) % 10;
    if (r < 2) {
      const q = P(0.2 + ((hs >>> 20) & 7) / 12, 0.2 + ((hs >>> 23) & 7) / 12);
      ctx.beginPath();
      g2Ellipse(ctx, q, 2.4, 1.3);
      ctx.fillStyle = g2Tint('#a39a8a');
      ctx.globalAlpha = 0.9;
      ctx.fill();
    } else if (r < 4) {
      const q = P(0.25 + ((hs >>> 20) & 7) / 12, 0.3 + ((hs >>> 23) & 7) / 12);
      ctx.beginPath();
      ctx.moveTo(q[0] - 2, q[1]); ctx.lineTo(q[0] - 3, q[1] - 4);
      ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] - 5);
      ctx.moveTo(q[0] + 2, q[1]); ctx.lineTo(q[0] + 3, q[1] - 4);
      ctx.strokeStyle = g2Tint(g.dot);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.9;
      ctx.stroke();
    }
  } else {
    // 雪地:藍白陰影的積雪起伏 + 亮面 + 少量腳印
    const q = P(0.3 + ((hs >>> 3) & 7) / 16, 0.3 + ((hs >>> 6) & 7) / 16);
    ctx.beginPath();
    g2Ellipse(ctx, q, 11, 5);
    ctx.fillStyle = g2Tint(g.mark);
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.beginPath();
    g2Ellipse(ctx, [q[0] - 2, q[1] - 1.5], 8, 3.4);
    ctx.fillStyle = g2Tint(g.lite);
    ctx.globalAlpha = 0.85;
    ctx.fill();
    if ((hs >>> 9) % 3 === 0) {
      const q2 = P(0.15 + ((hs >>> 12) & 7) / 14, 0.55 + ((hs >>> 15) & 3) / 12);
      ctx.beginPath();
      g2Ellipse(ctx, q2, 6, 2.2);
      ctx.fillStyle = g2Tint(g.mark);
      ctx.globalAlpha = 0.3;
      ctx.fill();
    }
    if ((hs >>> 17) % 6 === 0) {
      const a = P(0.3, 0.25 + ((hs >>> 20) & 3) / 20);
      ctx.beginPath();
      g2Ellipse(ctx, a, 1.3, 0.8);
      g2Ellipse(ctx, [a[0] + 5, a[1] + 2.5], 1.3, 0.8);
      g2Ellipse(ctx, [a[0] + 10, a[1] + 5], 1.3, 0.8);
      g2Ellipse(ctx, [a[0] + 14, a[1] + 7.5], 1.3, 0.8);
      ctx.fillStyle = g2Tint(g.dot);
      ctx.globalAlpha = 0.55;
      ctx.fill();
    }
  }
  ctx.restore();
}

// ===== 人工地面:石板 / 夯土 / 水泥 / 鋼鐵 / 木棧板 / 木紋地板(T_STONEPAVE..T_WOODFLOOR,玩法等同草地;見 data.js)=====
// 與沙 / 裂 / 雪相同:只依 (x, y, 高度, 地形, 鄰格) 繪製,四季與時間皆無差異(冬季不積雪);時段乘色沿用 artTile / terrTint。
// 木棧板鋪在水格上(flow === T_PLANK_WET)時:底下先畫水面(低 3px),棧板面在 h 高度,右 / 前緣畫 4px 樑側面,水面動態不畫在這格(只有 T_LAKE / T_RIVER 才畫水波)。
function g2Quad(ctx, P, u0, v0, u1, v1, col, a) {
  const q0 = P(u0, v0), q1 = P(u1, v0), q2 = P(u1, v1), q3 = P(u0, v1);
  ctx.beginPath();
  ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.lineTo(q3[0], q3[1]);
  ctx.closePath();
  ctx.fillStyle = g2Tint(col);
  ctx.globalAlpha = a;
  ctx.fill();
}
function g2Seg(ctx, P, u0, v0, u1, v1) {
  const a = P(u0, v0), b = P(u1, v1);
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
}
function g2Stroke(ctx, col, lw, a) {
  ctx.strokeStyle = g2Tint(col);
  ctx.lineWidth = lw;
  ctx.globalAlpha = a;
  ctx.stroke();
}
function g2Dot(ctx, q, rx, ry, col, a) {
  ctx.beginPath();
  g2Ellipse(ctx, q, rx, ry);
  ctx.fillStyle = g2Tint(col);
  ctx.globalAlpha = a;
  ctx.fill();
}

// 木棧板板條走向:沿鄰接棧板較多的軸(步道方向)排列,板條接縫垂直於步道;0 = 接縫為定 u 線,1 = 定 v 線
function deckAxis(x, y) {
  const pd = (a, b) => (inBounds(a, b) && world.terrain[idx(a, b)] === T_PLANKDECK ? 1 : 0);
  return pd(x, y - 1) + pd(x, y + 1) > pd(x - 1, y) + pd(x + 1, y) ? 1 : 0;
}
function deckWet(x, y) { return world.terrain[idx(x, y)] === T_PLANKDECK && world.flow[idx(x, y)] === T_PLANK_WET; }

// 水上棧板的樑側面(右前兩面,深木色);p 為本格頂面四角
function drawDeckSkirt(ctx, p) {
  const g = GROUND2[T_PLANKDECK], th = 4;
  poly(ctx, [p[1], p[2], [p[2][0], p[2][1] + th], [p[1][0], p[1][1] + th]], g2Tint(shade(g.mark, 0.85)));
  poly(ctx, [p[3], p[2], [p[2][0], p[2][1] + th], [p[3][0], p[3][1] + th]], g2Tint(shade(g.mark, 1.1)));
}

function drawArtGround(ctx, x, y, h, t, edgesOnly) {
  const hs = g2Hash(x, y, t), hp = h * HL, g = GROUND2[t];
  const P = (u, v) => gpt(x + u, y + v, hp);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (t === T_STONEPAVE) {
    // 石板:上排 2 塊、下排 3 塊錯縫(跨格連續),每塊微幅明暗不同;偶爾缺角與細裂
    const tone = [(hs >>> 2) & 3, (hs >>> 4) & 3, (hs >>> 6) & 3, (hs >>> 8) & 3, (hs >>> 10) & 3];
    const segs = [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, 0.25, 1], [0.25, 0.5, 0.75, 1], [0.75, 0.5, 1, 1]];
    for (let k = 0; k < 5; k++) {
      if (tone[k] === 0) continue;
      g2Quad(ctx, P, segs[k][0], segs[k][1], segs[k][2], segs[k][3], tone[k] === 1 ? g.lite : g.mark, tone[k] === 1 ? 0.22 : 0.12);
    }
    ctx.beginPath();
    g2Seg(ctx, P, 0, 0.5, 1, 0.5); g2Seg(ctx, P, 0.5, 0, 0.5, 0.5); g2Seg(ctx, P, 0.25, 0.5, 0.25, 1); g2Seg(ctx, P, 0.75, 0.5, 0.75, 1);
    ctx.save(); ctx.translate(0, 1); g2Stroke(ctx, g.lite, 1, 0.4); ctx.restore();
    g2Stroke(ctx, g.mark, 1.1, 0.8);
    if ((hs >>> 12) % 6 === 0) {
      const c = (hs >>> 15) & 3, cu = c & 1 ? 1 : 0, cv = c & 2 ? 1 : 0, du = cu ? -0.16 : 0.16, dv = cv ? -0.16 : 0.16;
      const a = P(cu, cv), b = P(cu + du, cv), d = P(cu, cv + dv);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
      ctx.fillStyle = g2Tint('#7d8186'); ctx.globalAlpha = 0.8; ctx.fill();
    }
    if ((hs >>> 18) % 7 === 0) {
      ctx.beginPath();
      g2Poly(ctx, P, G2_CRACKS[(hs >>> 21) % G2_CRACKS.length][0], (hs >>> 24) & 7);
      g2Stroke(ctx, g.dot, 0.9, 0.55);
    }
  } else if (t === T_RAMMED) {
    // 夯土:3 道水平夯層淡紋、小碎石與土屑
    ctx.beginPath();
    for (let k = 1; k <= 3; k++) {
      const v = 0.25 * k + (((hs >>> (k * 3)) & 7) - 3) / 60, a = P(0.02, v), m = P(0.5, v + (k % 2 ? 0.04 : -0.04)), b = P(0.98, v);
      ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]);
    }
    g2Stroke(ctx, g.mark, 1, 0.3);
    ctx.beginPath();
    for (let k = 1; k <= 3; k++) { const v = 0.25 * k + (((hs >>> (k * 3)) & 7) - 3) / 60; g2Seg(ctx, P, 0.04, v + 0.03, 0.96, v + 0.03); }
    g2Stroke(ctx, g.lite, 1, 0.18);
    g2Dot(ctx, P(0.3 + ((hs >>> 12) & 7) / 20, 0.3 + ((hs >>> 15) & 7) / 20), 9, 4.2, g.mark, 0.07);
    const np = 2 + ((hs >>> 5) % 3);
    for (let k = 0; k < np; k++) {
      const q = P(0.12 + ((hs >>> (18 + k * 3)) & 7) / 10, 0.12 + ((hs >>> (21 + k * 2)) & 7) / 10);
      g2Dot(ctx, q, 1.5 + (k % 2) * 0.6, 0.9 + (k % 2) * 0.3, k % 2 ? g.lite : g.dot, 0.9);
    }
    ctx.fillStyle = g2Tint(g.mark);
    ctx.globalAlpha = 0.5;
    for (let k = 0; k < 5; k++) {
      const q = P(0.08 + ((hs >>> (k * 5)) & 15) / 17.5, 0.08 + ((hs >>> (k * 5 + 2)) & 15) / 17.5);
      ctx.fillRect(q[0], q[1], 1.2, 1);
    }
  } else if (t === T_CONCRETE) {
    // 水泥:每格一塊方板(上 / 左接縫畫在格緣,相鄰格拼成方格),細裂紋、污漬與氣孔
    ctx.beginPath();
    g2Seg(ctx, P, 0, 0, 1, 0); g2Seg(ctx, P, 0, 0, 0, 1);
    ctx.save(); ctx.translate(0, 1); g2Stroke(ctx, g.lite, 1, 0.55); ctx.restore();
    g2Stroke(ctx, g.mark, 1.2, 0.75);
    if ((hs >>> 3) % 4 === 0) g2Dot(ctx, P(0.3 + ((hs >>> 6) & 7) / 16, 0.3 + ((hs >>> 9) & 7) / 16), 10, 4.6, g.dot, 0.16);
    if ((hs >>> 12) % 5 === 0) {
      ctx.beginPath();
      g2Poly(ctx, P, G2_CRACKS[(hs >>> 15) % G2_CRACKS.length][0], (hs >>> 18) & 7);
      g2Stroke(ctx, g.dot, 0.9, 0.7);
    }
    ctx.fillStyle = g2Tint(g.dot);
    ctx.globalAlpha = 0.5;
    for (let k = 0; k < 4; k++) {
      const q = P(0.1 + ((hs >>> (k * 5)) & 15) / 19, 0.1 + ((hs >>> (k * 5 + 3)) & 15) / 19);
      ctx.fillRect(q[0], q[1], 1.1, 1);
    }
  } else if (t === T_STEEL) {
    // 鋼鐵:每格一塊鋼板,內縮接縫(暗)+ 上緣亮線,四角鉚釘,斜向拉絲高光,少量鏽斑
    g2Quad(ctx, P, 0.03, 0.03, 0.97, 0.97, g.lite, 0.07);
    const a = P(0.03, 0.03), b = P(0.97, 0.03), c = P(0.97, 0.97), d = P(0.03, 0.97);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
    g2Stroke(ctx, g.mark, 1.3, 0.95);
    ctx.beginPath();
    ctx.moveTo(d[0], d[1] + 1); ctx.lineTo(a[0], a[1] + 1); ctx.lineTo(b[0], b[1] + 1);
    g2Stroke(ctx, g.lite, 1, 0.5);
    ctx.beginPath();
    g2Seg(ctx, P, 0.25, 0.9, 0.9, 0.25); g2Seg(ctx, P, 0.1, 0.62, 0.62, 0.1);
    g2Stroke(ctx, g.lite, 1, 0.12);
    const rv = [[0.13, 0.13], [0.87, 0.13], [0.13, 0.87], [0.87, 0.87]];
    for (let k = 0; k < 4; k++) {
      const q = P(rv[k][0], rv[k][1]);
      g2Dot(ctx, [q[0], q[1] + 0.8], 1.5, 0.9, g.mark, 0.9);
      g2Dot(ctx, q, 1.4, 0.8, g.lite, 0.85);
    }
    if ((hs >>> 5) % 4 === 0) {
      const q = P(0.15 + ((hs >>> 8) & 7) / 12, 0.15 + ((hs >>> 11) & 7) / 12);
      g2Dot(ctx, q, 7, 3.2, g.dot, 0.32);
      g2Dot(ctx, [q[0] + 2, q[1] - 0.5], 3, 1.4, '#b87040', 0.4);
    } else if ((hs >>> 14) % 5 === 0) {
      g2Dot(ctx, P(0.08 + ((hs >>> 16) & 7) / 10, 0.08 + ((hs >>> 19) & 7) / 10), 2.4, 1.2, g.dot, 0.45);
    }
  } else if (t === T_PLANKDECK) {
    // 木棧板:4 條板,接縫沿格軸;水上時縫隙透出水色,沿水緣的邊畫木樁頭與樑頭
    const ax = deckAxis(x, y), wet = deckWet(x, y), n = 4;
    const Q = (u, v) => (ax === 0 ? P(u, v) : P(v, u));
    for (let k = 0; k < n && !edgesOnly; k++) {   // edgesOnly:頂面已貼圖,只畫水緣樑頭 / 木樁
      const tn = (hs >>> (k * 3)) & 7;
      if (tn < 2) g2Quad(ctx, Q, k / n, 0, (k + 1) / n, 1, g.lite, 0.26);
      else if (tn < 4) g2Quad(ctx, Q, k / n, 0, (k + 1) / n, 1, g.mark, 0.2);
    }
    ctx.beginPath();
    for (let k = 1; k < n && !edgesOnly; k++) g2Seg(ctx, Q, k / n, 0.01, k / n, 0.99);
    g2Stroke(ctx, wet ? shade(PAL.water, 0.5) : g.mark, wet ? 1.6 : 1.2, 0.9);
    ctx.fillStyle = g2Tint(g.dot);
    ctx.globalAlpha = 0.65;
    for (let k = 0; k < n && !edgesOnly; k++) {
      const c = (k + 0.5) / n, q1 = Q(c, 0.08), q2 = Q(c, 0.92);
      ctx.fillRect(q1[0] - 0.5, q1[1] - 0.5, 1.2, 1);
      ctx.fillRect(q2[0] - 0.5, q2[1] - 0.5, 1.2, 1);
    }
    if (wet) {
      // 水緣:朝向湖 / 河的邊畫樑頭(端面)與角落木樁頂;每項 [鄰格 dx, dy, 邊起點 u, v, 終點 u, v]
      const nb = [[0, -1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 1], [0, 1, 0, 1, 1, 1], [-1, 0, 0, 0, 0, 1]];
      for (let e = 0; e < 4; e++) {
        const nx = x + nb[e][0], ny = y + nb[e][1];
        if (!inBounds(nx, ny)) continue;
        const nt = world.terrain[idx(nx, ny)];
        if (nt !== T_LAKE && nt !== T_RIVER) continue;
        const e0 = [nb[e][2], nb[e][3]], e1 = [nb[e][4], nb[e][5]];
        const lerp = s => [e0[0] + (e1[0] - e0[0]) * s, e0[1] + (e1[1] - e0[1]) * s];
        const inwU = e === 1 ? -0.07 : (e === 3 ? 0.07 : 0), inwV = e === 2 ? -0.07 : (e === 0 ? 0.07 : 0);
        for (let k = 0; k < 2; k++) {
          const c = lerp(k ? 0.72 : 0.28), q = P(c[0] + inwU, c[1] + inwV);
          g2Dot(ctx, q, 1.8, 1, g.mark, 0.95);
          g2Dot(ctx, [q[0], q[1] - 0.4], 0.8, 0.45, g.lite, 0.7);
        }
        for (let k = 0; k < 2; k++) {
          const c = lerp(k ? 0.96 : 0.04), q = P(c[0] + inwU * 0.6, c[1] + inwV * 0.6);
          g2Dot(ctx, [q[0], q[1] + 0.6], 2.4, 1.4, '#3a2819', 0.95);
          g2Dot(ctx, q, 2.1, 1.1, '#6f5233', 1);
          g2Dot(ctx, [q[0] - 0.3, q[1] - 0.3], 1, 0.5, '#a88458', 0.8);
        }
      }
    }
  } else {
    // 木紋地板:5 條沿 x 軸的長板(跨格連續,板長約 3 格、各列錯開接頭),每塊板色階不同,細木紋
    const nS = 5;
    ctx.beginPath();
    for (let j = 1; j < nS; j++) g2Seg(ctx, P, 0, j / nS, 1, j / nS);
    g2Stroke(ctx, g.mark, 1, 0.55);
    for (let j = 0; j < nS; j++) {
      const r = y * nS + j, off = (g2Hash(r, 0, 31) >>> 5) % 300 / 100, b0 = Math.floor((x + off) / 3), b1 = Math.floor((x + 1 + off) / 3);
      const ju = b1 > b0 ? (b0 + 1) * 3 - off - x : 1;
      for (let s = 0; s < 2; s++) {
        const u0 = s ? ju : 0, u1 = s ? 1 : ju;
        if (u1 - u0 <= 0.001) continue;
        const bh = g2Hash(b0 + s, r, 33), tn = bh % 4, v0 = j / nS, v1 = (j + 1) / nS;
        if (tn === 1) g2Quad(ctx, P, u0, v0, u1, v1, g.lite, 0.28);
        else if (tn === 2) g2Quad(ctx, P, u0, v0, u1, v1, g.mark, 0.22);
        else if (tn === 3) g2Quad(ctx, P, u0, v0, u1, v1, g.lite, 0.1);
        if (((bh >>> 3) & 3) !== 0) {
          const gv = v0 + (v1 - v0) * (0.35 + ((bh >>> 6) & 3) / 8), gu0 = u0 + (u1 - u0) * 0.1, gu1 = u0 + (u1 - u0) * (0.5 + ((bh >>> 9) & 3) / 8);
          ctx.beginPath(); g2Seg(ctx, P, gu0, gv, gu1, gv);
          g2Stroke(ctx, g.dot, 0.8, 0.22);
        }
      }
      if (b1 > b0 && ju < 1) {
        ctx.beginPath(); g2Seg(ctx, P, ju, j / nS, ju, (j + 1) / nS);
        g2Stroke(ctx, g.mark, 1, 0.7);
      }
    }
  }
  ctx.restore();
}

// 自然地面 13~18 的程式繪製(底色已填;貼圖缺失 / 關閉時的回退,只畫簡單雜點與少量明暗斑):泥土 / 岩地 / 裂土 / 黑土 / 叢林 / 紅土
function drawNaturalGround(ctx, x, y, h, t) {
  const hs = g2Hash(x, y, t), hp = h * HL, g = GROUND2[t];
  const P = (u, v) => gpt(x + u, y + v, hp);
  ctx.save();
  g2Dot(ctx, P(0.2 + (hs & 7) / 14, 0.2 + ((hs >>> 3) & 7) / 14), 9, 4.2, g.lite, 0.2);
  g2Dot(ctx, P(0.2 + ((hs >>> 6) & 7) / 14, 0.2 + ((hs >>> 9) & 7) / 14), 7, 3.2, g.mark, 0.14);
  ctx.fillStyle = g2Tint(g.dot);
  ctx.globalAlpha = 0.5;
  for (let k = 0; k < 6; k++) {
    const q = P(0.08 + ((hs >>> (k * 4)) & 15) / 18, 0.08 + ((hs >>> (k * 4 + 2)) & 15) / 18);
    if (t === T_JUNGLE) { ctx.beginPath(); g2Ellipse(ctx, q, 2.2, 1.1); ctx.fill(); } else ctx.fillRect(q[0], q[1], 1.4, 1.1);
  }
  if (t === T_CRACKSOIL || t === T_ROCK) {
    ctx.beginPath();
    g2Poly(ctx, P, G2_CRACKS[(hs >>> 12) % G2_CRACKS.length][0], (hs >>> 16) & 7);
    g2Stroke(ctx, g.mark, 0.9, t === T_ROCK ? 0.45 : 0.7);
  }
  ctx.restore();
}

// 與不同陸地類地形(草 / 沙 / 裂 / 雪)或水岸的接縫:格內側一條混色窄帶 + 幾點鄰格色的點綴。
// p 為本格頂面四角,e 為 drawTile 的邊定義 [起點索引, 終點索引, 鄰格 x, 鄰格 y];t 為本格地形,nt 為鄰格地形(兩者至少一個 >= T_SAND)
function g2EdgeBlend(ctx, p, e, t, nt, x, y) {
  if (nt === t || isArtificialTerrain(t) || isArtificialTerrain(nt)) return;   // 人工地面與鄰格是硬邊(drawTile 畫細邊線),不混色
  const wetN = isWaterTerrain(nt);
  if (nt === T_ROAD || (wetN && t < T_SAND)) return;
  const a = p[e[0]], b = p[e[1]];
  const cx = (p[0][0] + p[2][0]) / 2, cy = (p[0][1] + p[2][1]) / 2;
  const own = g2Flat(t);
  const k = wetN ? 0.16 : 0.24;
  const col = g2Tint(wetN ? g2Mix(own, '#6a8ea0', 0.4) : g2Mix(own, g2Flat(nt), 0.5));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(b[0] + (cx - b[0]) * k, b[1] + (cy - b[1]) * k);
  ctx.lineTo(a[0] + (cx - a[0]) * k, a[1] + (cy - a[1]) * k);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.globalAlpha = wetN ? 0.6 : 0.7;
  ctx.fill();
  if (!wetN && view.zoom >= G2_DETAIL_ZOOM) {
    const hs = g2Hash(x, y, 16 + nt * 4 + e[0]);
    ctx.fillStyle = g2Tint(g2Flat(nt));
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let j = 0; j < 3; j++) {
      const s = 0.12 + (((hs >>> (j * 6)) & 15) / 15) * 0.76, d = 0.2 + (((hs >>> (j * 6 + 3)) & 7) / 7) * 0.34;
      const px = a[0] + (b[0] - a[0]) * s, py = a[1] + (b[1] - a[1]) * s;
      ctx.moveTo(px + (cx - px) * d + 1.8, py + (cy - py) * d);
      ctx.ellipse(px + (cx - px) * d, py + (cy - py) * d, 1.8, 1.1, 0, 0, 6.2832);
    }
    ctx.fill();
  }
  ctx.restore();
}

function drawTile(ctx, x, y, time) {
  const i = idx(x, y);
  const h = world.height[i];
  const t = world.terrain[i];
  const wet = t === T_LAKE || t === T_RIVER || t === T_OCEAN;
  drawCliffs(ctx, x, y, h);

  const plWet = t === T_PLANKDECK && world.flow[i] === T_PLANK_WET;   // 水上棧板:水面在其下
  const art = t >= T_STONEPAVE && t <= T_ART_LAST;
  if (plWet) {
    polyPath(ctx, topPts(x, y, h, 3));
    ctx.fillStyle = typeof artTile === 'function' ? artTile(PAL.water) : PAL.water;
    ctx.fill();
  }
  const p = topPts(x, y, h, wet ? 3 : 0);
  polyPath(ctx, p);
  const hs0 = cellHash(x, y);
  let tileCol = t === T_ROAD ? PAL.road : (wet ? PAL.water : (t >= T_SAND && t <= T_LAST ? groundTileCol(t, hs0) : PAL.grass[hs0 % 3]));
  if (t >= T_OCEAN && typeof liveTileCol === 'function') tileCol = liveTileCol(t, i, hs0);   // 活地形底色(terrain_live.js)
  if (typeof artTile === 'function') tileCol = artTile(tileCol);
  ctx.fillStyle = tileCol;
  ctx.fill();
  // 地形貼圖(js/terrain_tex.js;人工 / 自然地面,載入完成才有;失敗 / 關閉 → tex = false 走程式繪製)
  const tex = t >= T_STONEPAVE && typeof terrainTexDraw === 'function' &&
    terrainTexDraw(ctx, p, x, y, t, currentSeason === 'winter', ART_NEUTRAL ? '' : terrTintHex());

  // 邊線: 0 上→1 右 面向 (x,y-1); 1→2 面向 (x+1,y); 2→3 面向 (x,y+1); 3→0 面向 (x-1,y)
  const edges = [[0, 1, x, y - 1], [1, 2, x + 1, y], [2, 3, x, y + 1], [3, 0, x - 1, y]];
  edges.forEach(e => {
    if (!inBounds(e[2], e[3])) return;
    const nt = world.terrain[idx(e[2], e[3])];
    if (t === T_OCEAN) liveOceanEdge(ctx, p, e, x, y, nt);   // 海:深淺混色 + 岸邊白浪(terrain_live.js,烘進分塊)
    else if (t === T_ROAD && nt !== T_ROAD) edgeLine(ctx, p[e[0]], p[e[1]], PAL.roadEdge, 1, 1);
    else if (wet && !isWaterTerrain(nt)) edgeLine(ctx, p[e[0]], p[e[1]], PAL.foam, 2, 0.6);
    else if (art && nt !== t) edgeLine(ctx, p[e[0]], p[e[1]], g2Tint(shade(GROUND2[t].mark, 1.05)), 1, 0.7);
    else if (t >= T_SAND || nt >= T_SAND) g2EdgeBlend(ctx, p, e, t, nt, x, y);
  });
  if (plWet) drawDeckSkirt(ctx, p);

  if (view.zoom >= TILE_EDGE_MIN_ZOOM) {
    polyPath(ctx, p);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 省電模式:水面改為靜態(略過河流流線的 clip + 描邊與湖面閃光,這兩者是水格最貴的部分)
  const still = tileBake || (wet && typeof isPowerSave === 'function' && isPowerSave());
  if (t === T_RIVER) { if (!still) drawRiver(ctx, x, y, h, time); }
  else if (t === T_LAKE) { if (!still) drawLake(ctx, x, y, h, time); }
  else if (t >= T_SAND && t <= T_SNOW && view.zoom >= G2_DETAIL_ZOOM) drawGround2(ctx, x, y, h, t);
  else if (art && view.zoom >= G2_DETAIL_ZOOM && !tex) drawArtGround(ctx, x, y, h, t);
  else if (art && tex && plWet) drawArtGround(ctx, x, y, h, t, true);   // 水上棧板:頂面已貼圖,仍畫水緣樑頭 / 木樁
  else if (t >= T_DIRT && t <= T_LAST && !tex && view.zoom >= G2_DETAIL_ZOOM) drawNaturalGround(ctx, x, y, h, t);
  if (t >= T_OCEAN) liveDrawTile(ctx, x, y, h, t, time);   // 活地形的靜態細節(烘焙)+ c2d 動畫(terrain_live.js)
}

// 時段乘色的 #rrggbb(貼圖 c2d 路徑用 multiply 套色;ART 關閉 / 正午回 '')
function terrTintHex() {
  if (typeof artIsOn !== 'function' || !artIsOn() || typeof ART === 'undefined' || !ART.TOD || typeof artTodKey !== 'function') return '';
  const t = ART.TOD[artTodKey()];
  return t && t.mul ? t.mul : '';
}

// 物件繪製
function drawObject(ctx, o, alpha) {
  if (typeof artDrawObject === 'function' && artDrawObject(ctx, o, alpha)) return;
  ctx = rqOv(ctx);   // GL 幀:舊式向量物件畫在疊加層(底層 2D 已被 GL 地形蓋住);c2d 時不變
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
  const a = gpt(o.x, o.y, top), b = gpt(o.x + fp[0], o.y, top), c = gpt(o.x + fp[0], o.y + fp[1], top), d = gpt(o.x, o.y + fp[1], top);
  rqPoly4(ctx, a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1], col);
}

// 待購物件：金色底＋半透明本體＋金色虛線外框；選取中改白色實線
function drawPendingObj(ctx, o) {
  const fp = footprint(o.type, o.rot);
  const bh = world.height[idx(o.x, o.y)] * HL;
  const sel = pend.sel >= 0 && pend.list[pend.sel] === o;
  const pts = [gpt(o.x, o.y, bh), gpt(o.x + fp[0], o.y, bh), gpt(o.x + fp[0], o.y + fp[1], bh), gpt(o.x, o.y + fp[1], bh)];
  rqPoly4(ctx, pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1], sel ? 'rgba(255,255,255,.30)' : 'rgba(255,214,90,.22)');
  drawObject(ctx, o, sel && pend.moving ? 0.3 : 0.6);
  const oc = rqOv(ctx);   // GL 幀:外框畫在疊加層(c2d 時 oc === ctx)
  oc.save();
  oc.setLineDash(sel ? [] : [5, 4]);
  outline(oc, pts, sel ? '#ffffff' : '#ffd65a', sel ? 2.5 : 1.5);
  oc.restore();
}

// 隱藏建築時的佔格輪廓（PLAN 12.17）：已建 = 白、待購 = 金、不合法 = 紅；只畫物件外緣的邊
function drawGhostCell(ctx, x, y) {
  const i = idx(x, y);
  const n = world.occ[i], pn = pend.occ[i];
  if (!n && !pn) return;
  const bad = n && hide.badCell[i];
  const p = topPts(x, y, world.height[i], 0);
  rqPoly4(ctx, p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1], bad ? 'rgba(230,70,70,.40)' : (n ? 'rgba(255,255,255,.14)' : 'rgba(255,214,90,.18)'));
  const col = bad ? '#ff5a4a' : (n ? 'rgba(255,255,255,.8)' : '#ffd65a');
  const edges = [[0, 1, x, y - 1], [1, 2, x + 1, y], [2, 3, x, y + 1], [3, 0, x - 1, y]];
  edges.forEach(e => {
    const j = inBounds(e[2], e[3]) ? idx(e[2], e[3]) : -1;
    const same = j >= 0 && (n ? world.occ[j] === n : pend.occ[j] === pn);
    if (!same) rqLine(ctx, p[e[0]][0], p[e[0]][1], p[e[1]][0], p[e[1]][1], bad ? 2 : 1.5, col, 1);
  });
}

// 單一物件草稿虛影(ui.js draft):半透明本體＋綠/紅格底＋虛線外框;不進 occ / 待購,不計價
function drawDraft(ctx) {
  const d = draft;
  if (!d || (!OBJECTS[d.type] && !d.combo) || !inBounds(d.x, d.y)) return;
  if (d.combo) {
    // 組合模組:整組虛影(各件半透明 + 綠 / 紅格底,外框依整組可放與否)
    if (typeof drawComboGhost === 'function') drawComboGhost(ctx, d.combo, d.x, d.y, d.rot, d.cres);
    return;
  }
  if (d.bounce) {
    // 彈回動畫:虛影從放開處(bounce.fx/fy)滑回 d.x/d.y(easeOut),不畫格底
    const b = d.bounce, p = Math.min(1, (performance.now() - b.t0) / b.dur), k = 1 - (1 - p) * (1 - p);
    const ox = (1 - k) * (b.fx - d.x), oy = (1 - k) * (b.fy - d.y);
    ctx.save();
    ctx.translate(isoX(ox, oy), isoY(ox, oy, 0));
    drawObject(ctx, { type: d.type, x: d.x, y: d.y, rot: d.rot, skin: d.skin }, 0.55);
    ctx.restore();
    return;
  }
  const fp = footprint(d.type, d.rot);
  const fill = d.ok ? 'rgba(80,220,120,.30)' : 'rgba(230,70,70,.35)';
  for (let yy = d.y; yy < d.y + fp[1]; yy++)
    for (let xx = d.x; xx < d.x + fp[0]; xx++)
      if (inBounds(xx, yy)) poly(ctx, topPts(xx, yy, world.height[idx(xx, yy)], 0), fill);
  drawObject(ctx, { type: d.type, x: d.x, y: d.y, rot: d.rot, skin: d.skin }, 0.55);
  const bh = world.height[idx(d.x, d.y)] * HL;
  const pts = [gpt(d.x, d.y, bh), gpt(d.x + fp[0], d.y, bh), gpt(d.x + fp[0], d.y + fp[1], bh), gpt(d.x, d.y + fp[1], bh)];
  ctx.save();
  ctx.setLineDash([6, 4]);
  outline(ctx, pts, d.ok ? '#5fe08a' : '#ff5a4a', 2);
  ctx.restore();
}

// 輕點高亮(0.6 秒)/ 落地光圈(0.35 秒):ui.js fxHi
function drawFx(ctx) {
  const f = typeof fxHi !== 'undefined' ? fxHi : null;
  if (!f) return;
  const p = (performance.now() - f.t0) / f.dur;
  if (p >= 1 || !inBounds(f.x, f.y)) {
    fxHi = null;
    return;
  }
  const g = f.kind === 'land' ? (1 - p) * 0.35 : 0;
  const bh = world.height[idx(f.x, f.y)] * HL;
  const pts = [gpt(f.x - g, f.y - g, bh), gpt(f.x + f.w + g, f.y - g, bh), gpt(f.x + f.w + g, f.y + f.h + g, bh), gpt(f.x - g, f.y + f.h + g, bh)];
  ctx.save();
  ctx.globalAlpha = 1 - p;
  outline(ctx, pts, f.kind === 'land' ? '#ffe9a8' : '#ffffff', f.kind === 'land' ? 3 : 2);
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
    drawObject(ctx, { type: t, x: x, y: y, rot: preview.rot, skin: typeof uiSkinPref === 'function' ? uiSkinPref(t) : '' }, 0.55);
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

// 土地遮罩（PLAN_PROGRESSION §2、PR1-04）：經營 / 沙盤模式下遮罩外畫暗色荒地、遮罩邊界畫虛線。
// inLand 不存在時整段關閉，輸出與未加此功能時相同。遮罩旗標以 (inLand 函式, 城市等級) 為簽名快取。
const WASTE_COL = ['#3a3228', '#352d24', '#40372b'];
const LAND_BORDER_COL = 'rgba(214,176,92,0.85)';
const LAND_DIM_ALPHA = 0.72;
var landMask = null;   // { fn, lv, out: Uint8Array（1 = 遮罩外）, edges: [[x, y, k]...]（遮罩內、鄰格在外）}

function landDrawInvalidate() { landMask = null; }

function landMaskOn() {
  return (game.mode === 'estate' || game.mode === 'battleDesign') && world.board !== 'estate' && typeof inLand === 'function';
}

function landMaskGet() {
  const lv = typeof progLv === 'function' ? progLv() : 0;
  const m = landMask;
  if (m && m.fn === inLand && m.lv === lv && m.w === boardW() && m.board === world.board) return m;
  const BW = boardW(), BH = boardH();
  const out = new Uint8Array(BW * BH), edges = [];
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++)
      if (!inLand(x, y)) out[idx(x, y)] = 1;
  const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      if (out[idx(x, y)]) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + nb[k][0], ny = y + nb[k][1];
        if (inBounds(nx, ny) && out[idx(nx, ny)]) edges.push([x, y, k]);
      }
    }
  landMask = { fn: inLand, lv: lv, w: BW, board: world.board, out: out, edges: edges };
  return landMask;
}

// 荒地地格：沿用高度與懸崖面，頂面改為暗色
function drawWasteTile(ctx, x, y) {
  const h = world.height[idx(x, y)];
  drawCliffs(ctx, x, y, h);
  poly(ctx, topPts(x, y, h, 0), WASTE_COL[cellHash(x, y) % 3]);
}

// 遮罩邊界：一次 stroke 畫完；線寬與虛線以螢幕像素換算，縮小時仍約 2px 寬
function drawLandBorder(ctx, lm) {
  if (!lm.edges.length) return;
  const z = view.zoom;
  ctx.save();
  ctx.beginPath();
  lm.edges.forEach(e => {
    if (!cellVisible(e[0], e[1])) return;
    const p = topPts(e[0], e[1], world.height[idx(e[0], e[1])], 0);
    const a = p[e[2]], b = p[(e[2] + 1) % 4];
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  });
  ctx.setLineDash([5 / z, 4 / z]);
  ctx.strokeStyle = LAND_BORDER_COL;
  ctx.lineWidth = Math.max(1.5, 2 / z);
  ctx.stroke();
  ctx.restore();
}

// 物件最大佔格 (w + h - 2):物件掛在遠角對角線 key 上,畫面可見時 key 最多比螢幕底再大這麼多
let maxFpSum = -1;
function objMaxFpSum() {
  if (maxFpSum < 0) {
    maxFpSum = 0;
    for (const k in OBJECTS) { const o = OBJECTS[k]; maxFpSum = Math.max(maxFpSum, (o.w || 1) + (o.h || 1) - 2); }
  }
  return maxFpSum;
}
// 目前視圖的可見對角線 / u = x - y 範圍(世界座標 → 格座標的保守外擴):
// dT0..dT1 = 地形格需走訪的 d;dT0..dO1 = 物件 / 待購清單需處理的 d;uMin..uMax = x - y 範圍(每條對角線再依 d 換成 x 範圍)
function visSpan(BW, BH) {
  const z = view.zoom;
  const wl = view.x - viewport.w / (2 * z), wr = view.x + viewport.w / (2 * z);
  const wt = view.y - viewport.h / (2 * z), wb = view.y + viewport.h / (2 * z);
  const dT0 = Math.floor((wt - 64) / (TH / 2)) - 3, dT1 = Math.ceil((wb + 144) / (TH / 2)) + 2;
  return {
    dT0: dT0, dT1: dT1, dO1: dT1 + objMaxFpSum() + 2,
    uMin: Math.floor((wl - TW / 2) / (TW / 2)) - 2, uMax: Math.ceil((wr + TW / 2) / (TW / 2)) + 2
  };
}

// ===== 地形分塊(WebGL 後端,PLAN_RENDER R2 / BIGMAP B2)=====
// 把 N×N 格(16 / 8 / 4,依解析度)的地形預畫成離屏畫布 → GL 紋理,每幀只貼可見塊;塊內逐像素記錄對角線 d(深度圖),
// 讓 GL 內的物件 / 居民與地形以畫家順序(d)遮擋。烘焙時 view.zoom 暫代為該層級的代表值(drawTile 內的邊線 / 紋路門檻),時段乘色改在合成時套用。
// 失效條件由簽名自動判定:塊 + 外圍一圈的 (高度, 地形)、土地遮罩、季節、層級;換季 / 擴地 / 地形編輯 / 縮放層級改變 → 該塊重烘(每幀有時間預算,未烘好的塊先用舊版)。
let tileBake = false;
let terrBakeRes = 1;   // 烘焙中的層級解析度(terrain_tex.js 依此選小圖級數)
const TERR_LV = [{ res: 0.25, N: 16 }, { res: 0.5, N: 16 }, { res: 1, N: 16 }, { res: 2, N: 8 }, { res: 4, N: 4 }];
const TERR_SEASON_ID = { spring: 1, summer: 2, autumn: 3, winter: 4 };
const terrDCol = [];
for (let k = 0; k < 80; k++) terrDCol.push('rgb(' + k + ',0,0)');

// 依 縮放 × dpr 選解析度(略偏低 0.75 倍,記憶體優先);flag 層級 = 邊線 / 紋路門檻區間,跨門檻時整批重烘。
// 可見塊總量估計超過 TERR_BUDGET(< glr.js 的 48 MB 硬上限)時自動降一級解析度(迴圈到放得下;回升需估計 <= 預算 80%,避免來回跳)
const TERR_BUDGET = 38 * 1024 * 1024;
let terrAdj = 0;
function terrBytesEst(li) {
  const L = TERR_LV[li], N = L.N, res = L.res, dres = Math.max(0.25, Math.min(1, res / 2));
  const rw = 64 * N + 6, rh = 32 * N + 66, per = (Math.ceil(rw * res) * Math.ceil(rh * res) + Math.ceil(rw * dres) * Math.ceil(rh * dres)) * 4;
  const z = view.zoom, hw = viewport.w / (2 * z), hh = viewport.h / (2 * z);
  const wl = view.x - hw, wr = view.x + hw, wt = view.y - hh, wb = view.y + hh, BW = boardW(), BH = boardH();
  let n = 0;
  for (let Y0 = 0; Y0 < BH; Y0 += N)
    for (let X0 = 0; X0 < BW; X0 += N) {
      const rx = (X0 - Y0 - N) * (TW / 2) - 3, ry = (X0 + Y0) * (TH / 2) - MAX_H * HL - 10;
      if (rx < wr && rx + rw > wl && ry < wb && ry + rh > wt) n++;
    }
  return n * per;
}
function terrLevel() {
  const e = view.zoom * viewport.dpr * 0.75;
  let want = TERR_LV.length - 1;
  for (let i = 0; i < TERR_LV.length; i++) if (TERR_LV[i].res >= e) { want = i; break; }
  let li = Math.max(0, want - terrAdj);
  while (li > 0 && terrBytesEst(li) > TERR_BUDGET) { li--; terrAdj = want - li; }
  if (terrAdj > 0 && li < want && terrBytesEst(li + 1) <= TERR_BUDGET * 0.8) { li++; terrAdj = want - li; }
  const z = view.zoom, fl = z >= G2_DETAIL_ZOOM ? 2 : (z >= TILE_EDGE_MIN_ZOOM ? 1 : 0), L = TERR_LV[li];
  return { id: li + '/' + fl, res: L.res, N: L.N, zrep: fl === 2 ? 1 : (fl === 1 ? 0.4 : 0.3), dres: Math.max(0.25, Math.min(1, L.res / 2)) };
}

function terrSig(X0, Y0, N, lvl, landOn, lm) {
  let h = Math.imul(2166136261 ^ (TERR_SEASON_ID[currentSeason] || 0), 16777619);
  for (let i = 0; i < lvl.id.length; i++) h = Math.imul(h ^ lvl.id.charCodeAt(i), 16777619);
  let tx = 0;
  for (let y = Y0 - 1; y <= Y0 + N; y++)
    for (let x = X0 - 1; x <= X0 + N; x++) {
      let v = 255;
      if (inBounds(x, y)) {
        const i = idx(x, y), tt = world.terrain[i];
        if (tt >= T_STONEPAVE) tx = 1;
        v = world.height[i] * 32 + tt;
        if (tt === T_OCEAN) v = v * 8 + liveOceanCls(i);   // 海的深淺階(距離場;陸地改動 → 該塊重烘)
        if (landOn) v = v * 2 + lm.out[i];
      }
      h = Math.imul(h ^ v, 16777619);
    }
  if (tx && typeof terrainTexGen === 'function') h = Math.imul(h ^ terrainTexGen(), 16777619);   // 含貼圖地形的塊:貼圖載入 / 開關改變時重烘
  return h >>> 0;
}

// 目前視圖要用的分塊清單(依畫家順序:塊對角線 ci + cj 由小到大);pre = 視窗外一圈,只在有餘裕時預烘
function terrPlan(lvl, landOn, lm) {
  const BW = boardW(), BH = boardH(), N = lvl.N, res = lvl.res, dres = lvl.dres, z = view.zoom;
  const hw = viewport.w / (2 * z), hh = viewport.h / (2 * z);
  const wl = view.x - hw, wr = view.x + hw, wt = view.y - hh, wb = view.y + hh;
  const mx = hw * 0.6, my = hh * 0.6;
  const nc = Math.ceil(BW / N), nr = Math.ceil(BH / N), items = [];
  for (let cj = 0; cj < nr; cj++)
    for (let ci = 0; ci < nc; ci++) {
      const X0 = ci * N, Y0 = cj * N;
      const rx = Math.floor((X0 - Y0 - N) * (TW / 2)) - 3, ry = Math.floor((X0 + Y0) * (TH / 2) - MAX_H * HL) - 10;
      const rr = (X0 + N - Y0) * (TW / 2) + 3, rb = (X0 + Y0 + 2 * N) * (TH / 2) + HL + 8;
      const cw = Math.ceil((rr - rx) * res), ch = Math.ceil((rb - ry) * res), rw = cw / res, rh = ch / res;
      let pre = false;
      if (rx >= wr || rx + rw <= wl || ry >= wb || ry + rh <= wt) {
        if (rx >= wr + mx || rx + rw <= wl - mx || ry >= wb + my || ry + rh <= wt - my) continue;
        pre = true;
      }
      items.push({
        k: N + ':' + ci + ',' + cj, sig: terrSig(X0, Y0, N, lvl, landOn, lm), d0: X0 + Y0, ord: ci + cj, ci: ci, X0: X0, Y0: Y0,
        rx: rx, ry: ry, rw: rw, rh: rh, cw: cw, ch: ch, dw: Math.max(1, Math.ceil(rw * dres)), dh: Math.max(1, Math.ceil(rh * dres)), pre: pre, rec: null, key: ''
      });
    }
  items.sort((a, b) => a.ord - b.ord || a.ci - b.ci);
  return { items: items };
}

// 深度圖:每格的頂面 + 懸崖面外形,填入「塊內對角線 + 1」(紅色通道);筆畫略外擴避免低解析度下邊緣漏洞
function terrDepthTile(dc, x, y, h, wet, dl) {
  const col = terrDCol[dl + 1];
  dc.fillStyle = col;
  dc.strokeStyle = col;
  dc.lineWidth = 2;
  polyPath(dc, topPts(x, y, h, wet ? 3 : 0));
  dc.fill();
  dc.stroke();
  const hx = inBounds(x + 1, y) ? world.height[idx(x + 1, y)] : -1;
  if (hx < h) {
    dc.beginPath();
    dc.moveTo(isoX(x + 1, y), isoY(x + 1, y, h)); dc.lineTo(isoX(x + 1, y + 1), isoY(x + 1, y + 1, h));
    dc.lineTo(isoX(x + 1, y + 1), isoY(x + 1, y + 1, hx)); dc.lineTo(isoX(x + 1, y), isoY(x + 1, y, hx));
    dc.closePath(); dc.fill(); dc.stroke();
  }
  const hy = inBounds(x, y + 1) ? world.height[idx(x, y + 1)] : -1;
  if (hy < h) {
    dc.beginPath();
    dc.moveTo(isoX(x, y + 1), isoY(x, y + 1, h)); dc.lineTo(isoX(x + 1, y + 1), isoY(x + 1, y + 1, h));
    dc.lineTo(isoX(x + 1, y + 1), isoY(x + 1, y + 1, hy)); dc.lineTo(isoX(x, y + 1), isoY(x, y + 1, hy));
    dc.closePath(); dc.fill(); dc.stroke();
  }
}

// 烘一塊(glr.js rqTerrain 呼叫):c = 色圖 ctx(世界座標 × 解析度),dc = 深度圖 ctx;回傳水格座標清單 [x, y, ...]
function terrBake(it, c, dc, lvl, landOn, lm) {
  const N = lvl.N, BW = boardW(), BH = boardH(), water = [], zs = view.zoom;
  tileBake = true;
  terrBakeRes = lvl.res;
  ART_NEUTRAL = true;
  view.zoom = lvl.zrep;
  try {
    for (let d = 0; d <= 2 * N - 2; d++)
      for (let xl = Math.max(0, d - N + 1); xl <= Math.min(d, N - 1); xl++) {
        const x = it.X0 + xl, y = it.Y0 + d - xl;
        if (x >= BW || y >= BH) continue;
        const i = idx(x, y), t = world.terrain[i], waste = landOn && lm.out[i] === 1;
        if (waste) drawWasteTile(c, x, y); else drawTile(c, x, y, 0);
        terrDepthTile(dc, x, y, world.height[i], !waste && isWaterTerrain(t), d);
        if (!waste && (t === T_RIVER || t === T_LAKE || t >= T_OCEAN)) water.push(x, y);   // 活地形格也進清單(動畫疊層用)
      }
  } finally {
    tileBake = false;
    ART_NEUTRAL = false;
    view.zoom = zs;
  }
  return water;
}

// 時段乘色(合成時套用;ART 關閉 / 正午為白)
function terrTint() {
  if (typeof artIsOn !== 'function' || !artIsOn() || typeof ART === 'undefined' || !ART.TOD) return [1, 1, 1];
  const t = ART.TOD[artTodKey()], m = t ? t.mul : null;
  if (!m) return [1, 1, 1];
  return [parseInt(m.substr(1, 2), 16) / 255, parseInt(m.substr(3, 2), 16) / 255, parseInt(m.substr(5, 2), 16) / 255];
}

// 水波座標夾在本格內(留 m 邊距):線段不得越過格界,否則會畫到鄰格(碼頭 / 岸邊陸地 / 較小 d 的水上建築)之上
function wCellClamp(v, c, m) {
  const e = m === undefined ? 0.04 : m;
  return Math.max(c + e, Math.min(c + 1 - e, v));
}

// 水面動態(GL):河流流線 / 湖面閃光畫成細長四邊形,深度 = 該格 d;縮放 < 0.5 或省電模式時靜態(不畫)。有物件佔用的格(橋等)略過
function terrWaterGl(ctx, x, y, t, time) {
  const h = world.height[idx(x, y)];
  if (t === T_RIVER) {
    const f = DIRS[world.flow[idx(x, y)]], dx = f[0], dy = f[1], hp = h * HL - 3;
    for (let k = 0; k < 3; k++) {
      let p = time * 0.6 - (x * dx + y * dy) * 0.25 + k / 3;
      p -= Math.floor(p);
      const s = p - 0.5, q = (k - 1) * 0.25;
      const cx = x + 0.5 + dx * s - dy * q, cy = y + 0.5 + dy * s + dx * q;
      const a = gpt(wCellClamp(cx - dx * 0.125, x), wCellClamp(cy - dy * 0.125, y), hp), b = gpt(wCellClamp(cx + dx * 0.125, x), wCellClamp(cy + dy * 0.125, y), hp);
      rqLine(ctx, a[0], a[1], b[0], b[1], 1.5, PAL.waterHi, 0.5);
    }
  } else {
    const hs = cellHash(x, y);
    if (hs % 3 === 0) return;
    let b = Math.pow(Math.max(0, Math.sin(time * 2 + hs)), 4);
    if (currentSeason === 'winter') b *= 0.5;
    if (b < 0.02) return;
    const px = wCellClamp(x + ((hs >>> 3) % 10) / 10, x, 0.1), py = wCellClamp(y + ((hs >>> 7) % 10) / 10, y, 0.1), hp = h * HL - 3, s = 0.08;
    const a1 = gpt(px - s, py, hp), a2 = gpt(px + s, py, hp), b1 = gpt(px, py - s, hp), b2 = gpt(px, py + s, hp);
    rqLine(ctx, a1[0], a1[1], a2[0], a2[1], 1.5, PAL.waterHi, b);
    rqLine(ctx, b1[0], b1[1], b2[0], b2[1], 1.5, PAL.waterHi, b);
  }
}

// GL 幀的地形:回傳 true = 分塊已畫(物件走深度遮擋);false = 還有塊沒烘好 → 呼叫端整幀改走 c2d
function terrGl(ctx, landOn, lm, time) {
  const lvl = terrLevel(), plan = terrPlan(lvl, landOn, lm);
  plan.lvl = lvl.id;
  plan.tint = terrTint();
  plan.bake = (it, c, dc) => terrBake(it, c, dc, lvl, landOn, lm);
  if (!rqTerrain(ctx, plan)) return false;
  if (view.zoom >= 0.5 && !(typeof isPowerSave === 'function' && isPowerSave())) {
    for (const rec of plan.out) {
      const w = rec.water;
      if (!w) continue;
      for (let k = 0; k < w.length; k += 2) {
        const x = w[k], y = w[k + 1], i = idx(x, y), t = world.terrain[i];
        if (t >= T_OCEAN) {   // 活地形動畫(terrain_live.js):先過便宜的開關 / 抽樣,再查佔用與可見
          if (!LIVE.on || !liveCellPick(x, y, t) || world.occ[i] || pend.occ[i] || !cellVisible(x, y)) continue;
          rqDepth(ctx, x + y);
          liveAnim(ctx, x, y, t, time, world.height[i]);
          continue;
        }
        if ((t !== T_RIVER && t !== T_LAKE) || world.occ[i] || pend.occ[i] || !cellVisible(x, y)) continue;
        rqDepth(ctx, x + y);
        terrWaterGl(ctx, x, y, t, time);
      }
    }
  }
  return true;
}

var drawNow = 0;
function draw(ctx, time) {
  drawNow = time;
  if (typeof liveFrame === 'function') liveFrame(time, ctx);   // 活地形:距離場 / 動畫開關 / 元素上限(terrain_live.js)
  const cv = ctx.canvas;
  rqBegin(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let bgCol = PAL.bg;
  if (typeof artSky === 'function') bgCol = artSky(bgCol);
  ctx.fillStyle = bgCol;
  ctx.fillRect(0, 0, cv.width, cv.height);

  const z = view.zoom, r = viewport.dpr;
  ctx.setTransform(r * z, 0, 0, r * z, r * (viewport.w / 2 - view.x * z), r * (viewport.h / 2 - view.y * z));
  rqView(ctx, r * z, r * (viewport.w / 2 - view.x * z), r * (viewport.h / 2 - view.y * z));

  const hid = hide.on && !pano.open; // 隱藏建築（PLAN 12.17）；全景一律畫實際建築
  const landOn = landMaskOn();
  const lm = landOn ? landMaskGet() : null;
  if (typeof tdZonePrep === 'function') tdZonePrep(time);
  if (typeof lifeFrame === 'function') lifeFrame(time);
  syncBoardView();

  const BW = boardW(), BH = boardH();
  // GL 幀:地形走分塊紋理(含逐像素深度),物件 / 居民以對角線 d 為深度;分塊尚未烘好 → 本幀整幀回 c2d(不混畫)
  let tg = false;
  if (rqActive(ctx)) {
    rqDepthSetup(ctx, BW + BH + 6);
    tg = terrGl(ctx, landOn, lm, time);
    if (!tg) rqAbort(ctx);
  }
  const ov = rqOv(ctx);   // 頂層 2D(GL 幀為疊加層畫布;c2d 時就是 ctx)
  const cells = !tg || hid || (typeof tdDepArr !== 'undefined' && (tdDepArr !== null || tdDepFlank !== null));   // GL 幀只有隱藏建築 / 部署區需要逐格走訪

  // 可見範圍(B1):由螢幕四角反投影出要走訪的對角線 d 與每條對角線的 x 範圍(保守外擴,最後仍用 cellVisible 判定,結果與全域走訪相同)
  const vs = visSpan(BW, BH);
  for (let d = 0; d <= BW + BH - 2; d++) {
    if (tg) rqDepth(ctx, d);
    const inT = cells && d >= vs.dT0 && d <= vs.dT1;
    const xa = inT ? Math.max(0, d - BH + 1, (d + vs.uMin + 1) >> 1) : 1, xb = inT ? Math.min(d, BW - 1, (d + vs.uMax) >> 1) : 0;
    for (let x = xa; x <= xb; x++) {
      const y = d - x;
      if (cellVisible(x, y)) {
        if (!tg) {
          if (landOn && lm.out[idx(x, y)]) drawWasteTile(ctx, x, y);
          else drawTile(ctx, x, y, time);
        }
        if (hid) drawGhostCell(ctx, x, y);
        if (typeof tdZoneCell === 'function') tdZoneCell(ov, x, y);
      }
    }
    if (typeof drawOverlayDiag === 'function') drawOverlayDiag(ov, d, time);
    const inO = d >= vs.dT0 && d <= vs.dO1;
    const list = hid || !inO ? null : world.objDiag[d];
    if (list) {
      list.slice().sort((a, b) => a.x - b.x).forEach(o => {
        if (!objVisible(o) || (typeof tdObjSkip === 'function' && tdObjSkip(o))) return;
        const dim = landOn && lm.out[idx(o.x, o.y)] === 1; // 遮罩外的既有物件照常畫，只略為壓暗
        if (view.zoom < OBJ_BLOB_ZOOM) {
          if (dim) { rqSave(ctx); rqAlpha(ctx, LAND_DIM_ALPHA); drawObjBlob(ctx, o); rqRestore(ctx); }
          else drawObjBlob(ctx, o);
        } else drawObject(ctx, o, dim ? LAND_DIM_ALPHA : 1);
      });
    }
    const pl = pano.open || hid || !inO ? null : pend.diag[d];
    if (pl) {
      pl.slice().sort((a, b) => a.x - b.x).forEach(o => {
        if (objVisible(o)) drawPendingObj(ctx, o);
      });
    }
    if (typeof drawBattleDiag === 'function') drawBattleDiag(ctx, d, time);
    if (typeof lifeDrawDiag === 'function') lifeDrawDiag(ctx, d, time);
  }
  rqFlush(ctx);   // GL 幀:物件 / 居民批次在此一次送出;以下皆畫在頂層 2D(c2d 時 ov === ctx)
  if (landOn) drawLandBorder(ov, lm);

  if (typeof drawWorldOverlay === 'function') drawWorldOverlay(ov, time);
  if (typeof tdDrawDrop === 'function') tdDrawDrop(ov, time);
  if (typeof artLights === 'function') artLights(ctx, time);   // GL 幀:光暈走 GL 加法混色批次(rqGlow);c2d 時 ctx === ov
  if (typeof lifeDrawTop === 'function') lifeDrawTop(ov, time);
  if (typeof talentPatrolDraw === 'function') talentPatrolDraw(ov, time);
  if (typeof chainVisDraw === 'function') chainVisDraw(ov, time);   // 產業鏈:瓶頸圖示 / 貨物流向(chainvis.js)
  if (preview.visible) drawPreview(ov);
  // 草稿只在經營模式顯示;離開經營模式(釣魚、仙獸、戰鬥布置等)即丟棄,移動中的建築回原位
  if (typeof draft !== 'undefined' && draft) {
    if (game.mode !== 'estate' && !(game.mode === 'battleDesign' && draft.orig)) {
      if (typeof draftDiscard === 'function') draftDiscard();
    } else if (!pano.open && !uiIsPhoto()) drawDraft(ov);
  }
  if (typeof fxHi !== 'undefined' && fxHi && !pano.open && !uiIsPhoto()) drawFx(ov);
  ctx.setTransform(r, 0, 0, r, 0, 0);
  if (ov !== ctx) ov.setTransform(r, 0, 0, r, 0, 0);
  if (typeof draftFloatSync === 'function') draftFloatSync();
  if (typeof drawScreenHud === 'function') drawScreenHud(ov, time);
  rqEnd(ctx);
}
