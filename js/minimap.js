// js/minimap.js — 小地圖:畫面角落一張小小的全地圖(地形色 + 建築色點 + 目前視野框);點一下跳到該位置、拖曳視野框移動鏡頭。
// 離屏 canvas 只在「地圖變動」時重畫,最多每 3 秒一次(MM_MIN_INTERVAL);視野框是 DOM 方框,每幀只改 left/top/width/height。
// 開關在設定 → 畫面操作(偏好鍵 lorddomain.ui.minimap,'0' = 關,預設開);拍照 / 錄影 / 全景 / 室內 / 橫版大面板 / 戰鬥畫面一律自動隱藏。
// 位置:優先右下(底部列上方),被別的 HUD 擋到就改左下 / 右上 / 左上(每 0.4 秒檢查一次;只在顯示時)。不發聲、不寫存檔、不動遊戲邏輯。
// 全域名稱:MM MM_KEY mmGetOn mmSetOn mmGeom mmWorldToMini mmMiniToWorld mmBuild mmSync mmStats mmWanted mmInit。ES2017;不用 ?. ??。

var MM_KEY = 'lorddomain.ui.minimap';
var MM_CSS_W = 120;               // 小地圖寬(CSS px);精簡模式由 CSS 縮成 96,mmLayout 讀實際寬
var MM_MIN_INTERVAL = 3000;       // 離屏重繪的最短間隔(ms)
var MM_SIG_INTERVAL = 500;        // 檢查「地圖是否變動」的間隔(ms)
var MM_PLACE_INTERVAL = 400;      // 檢查位置是否被擋的間隔(ms)
var MM_HIDE_CLASSES = ['photo-mode', 'shooting', 'in-interior', 'panel-big-landscape', 'panel-fs', 'atk-mode', 'replay-mode', 'sandbox'];
var MM_OBSTACLES = ['topbar', 'toolbar', 'catbar', 'varbar', 'pendBar', 'draftBar', 'editBar', 'slotPop', 'sideBar', 'modeBtn', 'btnAttack', 'progFtue', 'progWelcome', 'nsCard', 'advSprite', 'advCard', 'advTip', 'advDock', 'draftFloat', 'csChip', 'fsTip'];

var MM = {
  on: null, el: null, cv: null, ctx: null, box: null, off: null, offCtx: null, img: null,
  cssW: MM_CSS_W, cssH: MM_CSS_W / 2, pw: 0, ph: 0, dpr: 2,
  ext: null, sig: '', built: 0, dirty: true, lastSig: 0, lastPlace: 0, lastWanted: 0, shown: false,
  boxKey: '', posKey: '', drag: null, raf: 0, tick: 0,
  builds: 0, buildMs: 0, buildMsMax: 0, buildMsSum: 0
};

function mmGetOn() {
  if (MM.on === null) {
    MM.on = true;
    try { if (typeof localStorage !== 'undefined' && localStorage.getItem(MM_KEY) === '0') MM.on = false; } catch (e) { /* 讀不到用預設(開) */ }
  }
  return MM.on;
}
function mmSetOn(v) {
  MM.on = !!v;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(MM_KEY, MM.on ? '1' : '0'); } catch (e) { /* 存不了只影響下次記憶 */ }
  mmSync(true);
}

// 地圖範圍(格座標 [x0, y0, x1, y1],x1 / y1 不含):與鏡頭夾限同一個範圍(大板的經營模式在土地未全開時只含土地外框 + 6 格)
function mmExt() {
  if (typeof viewCells === 'function') return viewCells();
  return [0, 0, boardW(), boardH()];
}
// 幾何:世界座標 → 小地圖(CSS px)。等角投影的菱形,寬高比 TW:TH(2:1)
function mmGeom(b) {
  const n = (b[2] - b[0]) + (b[3] - b[1]);
  return { b: b, n: n, wx0: (b[0] - b[3]) * TW / 2, wy0: (b[0] + b[1]) * TH / 2, ww: n * TW / 2, wh: n * TH / 2 };
}
function mmWorldToMini(g, wx, wy, cw, ch) { return [(wx - g.wx0) / g.ww * cw, (wy - g.wy0) / g.wh * ch]; }
function mmMiniToWorld(g, mx, my, cw, ch) { return [g.wx0 + mx / cw * g.ww, g.wy0 + my / ch * g.wh]; }

// ───────── 顏色 ─────────
function mmRgb(c) {
  let m;
  if (typeof c !== 'string') return [110, 150, 100];
  if (c.charAt(0) === '#') {
    if (c.length === 4) return [parseInt(c.charAt(1) + c.charAt(1), 16), parseInt(c.charAt(2) + c.charAt(2), 16), parseInt(c.charAt(3) + c.charAt(3), 16)];
    if (c.length >= 7) return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)];
  }
  m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c);
  if (m) return [+m[1], +m[2], +m[3]];
  return [110, 150, 100];
}
function mmTerrainColors() {
  const tc = [], top = typeof T_MAXID === 'number' ? T_MAXID : 21;
  let t, c;
  for (t = 0; t <= top; t++) {
    c = null;
    try {
      if (t === T_GRASS) c = PAL.grass[0];
      else if (t === T_ROAD) c = PAL.road;
      else if (t === T_LAKE || t === T_RIVER) c = PAL.water;
      else if (typeof g2Flat === 'function') c = g2Flat(t);
    } catch (e) { c = null; }
    c = c || (PAL && PAL.grass && PAL.grass[0]);
    if (typeof artTile === 'function') { try { c = artTile(c); } catch (e) { /* 主題調色失敗:用原色 */ } }   // 與主畫面同一套美術主題色調
    tc[t] = mmRgb(c);
  }
  return tc;
}
function mmObjColor(type) {
  if (type === 'tree') return [38, 104, 52];
  if (type === 'stone') return [122, 124, 132];
  if (/wall|fence|tower|gate/.test(type)) return [150, 118, 88];
  if (type === 'palace') return [246, 206, 84];
  return [226, 160, 78];
}

// ───────── 離屏重繪 ─────────
function mmLayout() {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1) || 1;
  let w = MM_CSS_W;
  if (MM.el && MM.el.offsetWidth > 20) w = MM.el.offsetWidth - 2;   // 扣掉邊框
  MM.dpr = Math.max(1, dpr);
  MM.cssW = w;
  MM.cssH = Math.round(w * TH / TW);
  MM.pw = Math.round(MM.cssW * MM.dpr);
  MM.ph = Math.round(MM.cssH * MM.dpr);
}
function mmEnsureCanvases() {
  if (typeof document === 'undefined' || !document.createElement) return false;
  if (!MM.off) { MM.off = document.createElement('canvas'); MM.offCtx = MM.off.getContext ? MM.off.getContext('2d') : null; }
  if (!MM.offCtx) return false;
  if (MM.off.width !== MM.pw || MM.off.height !== MM.ph) { MM.off.width = MM.pw; MM.off.height = MM.ph; MM.img = null; }
  if (MM.cv && (MM.cv.width !== MM.pw || MM.cv.height !== MM.ph)) { MM.cv.width = MM.pw; MM.cv.height = MM.ph; }
  if (MM.cv) { MM.cv.style.width = MM.cssW + 'px'; MM.cv.style.height = MM.cssH + 'px'; }
  return true;
}

// 整張圖重畫到離屏 canvas(每格一個 2×1 色點,先地形再建築)。回傳耗時 ms(含 putImageData)
function mmBuild() {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  mmLayout();
  if (!mmEnsureCanvases()) return 0;
  const b = mmExt(), g = mmGeom(b), W = MM.pw, H = MM.ph, bw = boardW();
  if (!MM.img) MM.img = MM.offCtx.createImageData(W, H);
  const d = MM.img.data;
  d.fill(0);
  const tc = mmTerrainColors(), terr = world.terrain, yOff = b[3] - b[1], n = g.n;
  const kx = W / n, ky = H / n;
  function plot(x, y, c) {
    const cx = ((x + 0.5 - b[0]) - (y + 0.5 - b[1]) + yOff) * kx, cy = ((x + 0.5 - b[0]) + (y + 0.5 - b[1])) * ky;
    const ix = Math.round(cx) - 1, iy = Math.floor(cy);
    if (iy < 0 || iy >= H) return;
    for (let k = 0; k < 2; k++) {
      const px = ix + k;
      if (px < 0 || px >= W) continue;
      const o = (iy * W + px) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
  }
  let x, y;
  for (y = b[1]; y < b[3]; y++) for (x = b[0]; x < b[2]; x++) plot(x, y, tc[terr[y * bw + x]] || tc[0]);
  const objs = world.objects, colCache = {};
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i], fp = footprint(o.type, o.rot), c = colCache[o.type] || (colCache[o.type] = mmObjColor(o.type));
    for (let yy = o.y; yy < o.y + fp[1]; yy++) for (let xx = o.x; xx < o.x + fp[0]; xx++) if (xx >= b[0] && xx < b[2] && yy >= b[1] && yy < b[3]) plot(xx, yy, c);
  }
  MM.offCtx.putImageData(MM.img, 0, 0);
  MM.ext = b.join(',');
  const ms = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
  MM.builds++; MM.buildMs = ms; MM.buildMsSum += ms; if (ms > MM.buildMsMax) MM.buildMsMax = ms;
  MM.built = Date.now();
  MM.dirty = false;
  if (MM.ctx && MM.cv) { MM.ctx.clearRect(0, 0, MM.cv.width, MM.cv.height); MM.ctx.drawImage(MM.off, 0, 0); }
  return ms;
}
function mmStats() { return { builds: MM.builds, lastMs: MM.buildMs, maxMs: MM.buildMsMax, avgMs: MM.builds ? MM.buildMsSum / MM.builds : 0, cssW: MM.cssW, cssH: MM.cssH, pw: MM.pw, ph: MM.ph }; }

// 「地圖是否變動」的簽名:範圍 + 季節 + 地形雜湊 + 建築雜湊(整張約 1.3 萬格 + 數百件,每 0.5 秒算一次的成本可忽略)
function mmSig() {
  const t = world.terrain, objs = world.objects;
  let h = t.length | 0;
  for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t[i]) | 0;
  for (let j = 0; j < objs.length; j++) {
    const o = objs[j];
    h = (Math.imul(h, 31) + o.x * 131 + o.y * 7 + (o.rot | 0) * 3 + o.type.length * 17 + o.type.charCodeAt(0)) | 0;
  }
  return mmExt().join(',') + '|' + (typeof currentSeason !== 'undefined' ? currentSeason : '') + '|' + objs.length + '|' + h;
}

// ───────── 顯示條件 / 位置 / 視野框 ─────────
function mmWanted() {
  if (!mmGetOn()) return false;
  if (typeof game !== 'undefined' && game && game.mode !== 'estate' && game.mode !== 'battleDesign' && game.mode !== 'visit') return false;
  if (typeof document !== 'undefined' && document.body && document.body.classList) {
    const cl = document.body.classList;
    for (let i = 0; i < MM_HIDE_CLASSES.length; i++) if (cl.contains(MM_HIDE_CLASSES[i])) return false;
  }
  try {
    if (typeof pano === 'object' && pano && (pano.open || pano.busy || pano.rend)) return false;
    if (typeof REC === 'object' && REC && REC.state && REC.state !== 'idle') return false;
  } catch (e) { /* 載入順序未就緒:視為不影響 */ }
  return true;
}

function mmRectOf(id) {
  const el = document.getElementById(id);
  if (!el || el.hidden || !el.offsetWidth || !el.offsetHeight) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { l: r.left, t: r.top, r: r.right, b: r.bottom };
}
function mmHit(a, b) { return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t; }

function mmPlace(force) {
  if (!MM.el) return;
  const vw = window.innerWidth, vh = window.innerHeight, gap = 6;
  const W = MM.el.offsetWidth || (MM.cssW + 2), H = MM.el.offsetHeight || (MM.cssH + 2);
  const obs = {};
  let key = vw + 'x' + vh + '|' + W + 'x' + H;
  MM_OBSTACLES.forEach(function (id) {
    const r = mmRectOf(id);
    if (r) { obs[id] = r; key += '|' + id + ':' + Math.round(r.l) + ',' + Math.round(r.t) + ',' + Math.round(r.r) + ',' + Math.round(r.b); }
  });
  if (!force && key === MM.posKey) return;
  MM.posKey = key;
  const topB = obs.topbar ? obs.topbar.b : 40;
  let stackT = vh;
  ['toolbar', 'catbar', 'varbar'].forEach(function (id) { if (obs[id]) stackT = Math.min(stackT, obs[id].t); });
  if (stackT >= vh) stackT = vh - 60;
  const sideL = obs.sideBar ? obs.sideBar.l : vw;
  const botY = stackT - gap - H, rightX = vw - gap - W;
  const cands = [[rightX, botY], [gap, botY], [Math.min(rightX, sideL - gap - W), topB + gap], [gap, topB + gap]];
  let best = cands[0], bestScore = Infinity;
  cands.forEach(function (c, i) {
    const box = { l: c[0], t: c[1], r: c[0] + W, b: c[1] + H };
    let s = i;
    Object.keys(obs).forEach(function (id) { if (mmHit(box, obs[id])) s += 100; });
    if (box.l < 0 || box.t < 0 || box.r > vw || box.b > vh) s += 1000;
    if (s < bestScore) { bestScore = s; best = c; }
  });
  MM.el.style.right = 'auto';
  MM.el.style.bottom = 'auto';   // 固定寬高:不讓 top + bottom 把高度撐開
  MM.el.style.left = Math.round(best[0]) + 'px';
  MM.el.style.top = Math.round(best[1]) + 'px';
}

function mmUpdateBox() {
  if (!MM.box || !MM.ext) return;
  const g = mmGeom(MM.ext.split(',').map(Number)), z = view.zoom || 1;
  const hw = viewport.w / 2 / z, hh = viewport.h / 2 / z;
  const a = mmWorldToMini(g, view.x - hw, view.y - hh, MM.cssW, MM.cssH), c = mmWorldToMini(g, view.x + hw, view.y + hh, MM.cssW, MM.cssH);
  let l = Math.max(0, a[0]), t = Math.max(0, a[1]), r = Math.min(MM.cssW, c[0]), btm = Math.min(MM.cssH, c[1]);
  if (r - l < 4) { const m = (l + r) / 2; l = Math.max(0, m - 2); r = Math.min(MM.cssW, l + 4); }
  if (btm - t < 4) { const m2 = (t + btm) / 2; t = Math.max(0, m2 - 2); btm = Math.min(MM.cssH, t + 4); }
  const key = Math.round(l * 2) + ',' + Math.round(t * 2) + ',' + Math.round((r - l) * 2) + ',' + Math.round((btm - t) * 2);
  if (key === MM.boxKey) return;
  MM.boxKey = key;
  MM.box.style.left = l.toFixed(1) + 'px';
  MM.box.style.top = t.toFixed(1) + 'px';
  MM.box.style.width = (r - l).toFixed(1) + 'px';
  MM.box.style.height = (btm - t).toFixed(1) + 'px';
}

// 顯示 / 隱藏、必要時重畫 + 換位 + 更新視野框。force:設定剛切換,立刻處理
function mmSync(force) {
  if (!MM.el) return;
  const want = mmWanted(), now = Date.now();
  if (want !== MM.shown || force) {
    MM.shown = want;
    MM.el.hidden = !want;
    if (want) { MM.dirty = true; MM.built = 0; MM.posKey = ''; }
  }
  if (!MM.shown) return;
  if (now - MM.lastSig >= MM_SIG_INTERVAL || force) {
    MM.lastSig = now;
    const s = mmSig();
    if (s !== MM.sig) { MM.sig = s; MM.dirty = true; }
  }
  if (MM.dirty && now - MM.built >= MM_MIN_INTERVAL) mmBuild();   // 最多每 3 秒重畫一次(剛顯示時 built = 0,立刻畫)
  if (now - MM.lastPlace >= MM_PLACE_INTERVAL || force) { MM.lastPlace = now; mmPlace(!!force); }
  mmUpdateBox();
}

// ───────── 互動:點擊跳轉 / 拖曳視野框 ─────────
function mmPointerWorld(e) {
  const r = MM.cv.getBoundingClientRect();
  const mx = Math.max(0, Math.min(MM.cssW, e.clientX - r.left)), my = Math.max(0, Math.min(MM.cssH, e.clientY - r.top));
  return mmMiniToWorld(mmGeom(MM.ext.split(',').map(Number)), mx, my, MM.cssW, MM.cssH);
}
function mmMoveTo(wx, wy) {
  view.x = wx; view.y = wy;
  if (typeof clampView === 'function') clampView();
  mmUpdateBox();
}
function mmOnDown(e) {
  if (!MM.ext || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();
  const w = mmPointerWorld(e);
  // 按在視野框內:保持相對位置(不跳);按在框外:鏡頭中心跳到該點
  const inBox = MM.boxKey && (function () {
    const r = MM.cv.getBoundingClientRect(), bx = MM.box.getBoundingClientRect();
    return e.clientX >= bx.left && e.clientX <= bx.right && e.clientY >= bx.top && e.clientY <= bx.bottom && r.width > 0;
  })();
  MM.drag = { id: e.pointerId, dx: inBox ? view.x - w[0] : 0, dy: inBox ? view.y - w[1] : 0 };
  try { MM.el.setPointerCapture(e.pointerId); } catch (err) { /* 不支援就靠 pointermove 留在元素內 */ }
  mmMoveTo(w[0] + MM.drag.dx, w[1] + MM.drag.dy);
  MM.el.classList.add('mm-drag');
}
function mmOnMove(e) {
  if (!MM.drag || e.pointerId !== MM.drag.id) return;
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();
  const w = mmPointerWorld(e);
  mmMoveTo(w[0] + MM.drag.dx, w[1] + MM.drag.dy);
}
function mmOnUp(e) {
  if (!MM.drag || e.pointerId !== MM.drag.id) return;
  e.stopPropagation();
  MM.drag = null;
  try { MM.el.releasePointerCapture(e.pointerId); } catch (err) { /* 已釋放 */ }
  MM.el.classList.remove('mm-drag');
}

function mmLoop() {
  MM.raf = requestAnimationFrame(mmLoop);
  MM.tick++;
  if (!MM.shown) { if (MM.tick === 2 || MM.tick % 20 === 0) mmSync(false); return; }   // 開機第 2 幀才第一次判斷(等 main.js 載完存檔)
  if (MM.tick % 6 === 0) mmSync(false); else mmUpdateBox();
}

function mmInit() {
  if (MM.el || typeof document === 'undefined' || !document.body || !document.createElement) return;
  const el = document.createElement('div');
  el.id = 'miniMap';
  el.hidden = true;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', '小地圖:點一下跳到該位置,拖曳方框移動畫面');
  const cv = document.createElement('canvas');
  cv.width = Math.round(MM_CSS_W * 2); cv.height = Math.round(MM_CSS_W);
  const box = document.createElement('div');
  box.className = 'mm-view';
  el.appendChild(cv); el.appendChild(box);
  document.body.appendChild(el);
  MM.el = el; MM.cv = cv; MM.box = box; MM.ctx = cv.getContext ? cv.getContext('2d') : null;
  el.addEventListener('pointerdown', mmOnDown);
  el.addEventListener('pointermove', mmOnMove);
  el.addEventListener('pointerup', mmOnUp);
  el.addEventListener('pointercancel', mmOnUp);
  el.addEventListener('click', function (e) { e.stopPropagation(); });
  if (typeof requestAnimationFrame === 'function') MM.raf = requestAnimationFrame(mmLoop);
}

if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mmInit);
  else mmInit();
}
