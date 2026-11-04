// js/caravan_vis.js — 走鏢地圖視覺:出車時馬車 + 1~2 位鏢師從驛站沿道路走到城門並淡出;結算(車隊歸來)時從城門走回驛站,驛站冒一次「+貨」小提示。
// 純視覺:只讀 caravanGet().trips(偵測出發 / 歸來),不改走鏢狀態、不影響結算與離線結算。路徑用 citylife 的道路圖距離場(LIFE.road、lifeField);
// 走不通 / 沒有入口時退為直線淡入淡出。同時最多 3 組;省電模式 / 縮放 < 0.5 / 拍照 / 錄影 / 全景時不畫(也不生成)。
// 掛點(citylife.js 各 1 行,typeof 守護):lifeFrame → caravanVisTick(dt)、lifeFrame 非作用分支 → caravanVisClear()、lifeDrawDiag 開頭 → caravanVisDraw(ctx, d)。
// 繪製併入 lifeDrawDiag 的對角線分桶(每個成員依 floor(x)+floor(y) 放進自己的桶,與居民同序畫);桶與成員物件皆重用,每幀不配置。
// 馬車與馬為程式繪製(依品階換色 / 裝飾);鏢師用 crowdLook('escort') 的外觀,身體色改為膚色、衣緣改為皮革色,表現赤膊 + 皮護腕。
// ES2017;不用可選串連與空值合併運算子。

var CVV_MAX = 3;                 // 同時顯示的車隊上限
var CVV_SPD = 1.6;               // 馬車速度(格 / 秒)
var CVV_FRESH_MS = 6000;         // 出發後多久內才算「剛出發」(讀檔 / 離線補算的舊車隊不演)
var CVV_RETURN_MS = 20000;       // 車隊抵達時間後多久內才演歸來
var CVV_WAIT_MAX = 5;            // 等不到道路距離場的上限(秒),超過放棄
var CVV_HINT_T = 2.4;            // 驛站小提示持續秒數
var CVV_ESC_OFF = [1.25, 2.1];   // 鏢師落在車後的距離(格)
var CVV_ESC_LAT = [0.2, -0.2];   // 鏢師側向偏移(格)

var CVV = {
  on: true, convoys: [], known: {}, syncT: 0, buck: [], used: [], n: 0, ms: 0, frames: 0, drawMs: 0,
  specs: {}, scratch: new Float64Array(16), g: new Float64Array(8), pos: [0, 0, 1, 0], spawned: 0, skipped: 0
};

// ───────── 小工具 ─────────
function cvvShade(hex, k) {   // '#rrggbb' → 亮度 × k 的 '#rrggbb'(只在生成車隊時呼叫)
  var n = parseInt(String(hex).slice(1), 16), r, g, b;
  if (!isFinite(n)) return '#888888';
  r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * k)));
  g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * k)));
  b = Math.max(0, Math.min(255, Math.round((n & 255) * k)));
  return '#' + (0x1000000 + r * 65536 + g * 256 + b).toString(16).slice(1);
}
function cvvClamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
function cvvGateOk() {
  if (!CVV.on) return false;
  if (typeof isPowerSave === 'function' && isPowerSave()) return false;
  if (typeof uiIsPhoto === 'function' && uiIsPhoto()) return false;
  if (typeof REC !== 'undefined' && REC && (REC.state === 'recording' || REC.state === 'countdown' || REC.state === 'plan')) return false;
  if (typeof pano !== 'undefined' && pano && pano.open) return false;
  return true;
}
function cvvZoomOk() { return typeof view === 'undefined' || !view || view.zoom >= 0.5; }

// ───────── 外觀 ─────────
function cvvEscSpec(key, seed) {
  var s = CVV.specs[key], L, base;
  if (s !== undefined) return s;
  s = null;
  if (typeof ART !== 'undefined' && ART && ART.UNIT && typeof crowdLook === 'function') {
    base = ART.UNIT.man;
    L = crowdLook('escort', seed % 1000003);
    if (L && base) {
      s = Object.assign({}, base, L, { id: 'cvesc_' + key, tunic: '#d9a77a', trim: '#6b4524', robe: false, armor: undefined, prop: null });
      if (typeof LIFE !== 'undefined' && LIFE && LIFE.variantIds) LIFE.variantIds[s.id] = true;
    }
  }
  CVV.specs[key] = s;
  return s;
}
function cvvMakeEscort(key, seed, ph) {
  return { kind: 1, x: 0, y: 0, px: 0, py: 0, fx: 1, fy: 0, st: 'walk', frr: 4, ph: ph, pp: { spec: null, x: 0, y: 0, f: 0, fr: 0, alpha: 1 }, spec: cvvEscSpec(key, seed), col: '#d9a77a', fid: false, alpha: 0, hold: 0, off: 0, lat: 0 };
}

// ───────── 路徑 ─────────
function cvvFindHub() {
  var objs = (typeof world !== 'undefined' && world && world.objects) || [], R = LIFE.road, i, o, d;
  for (i = 0; i < objs.length; i++) {
    o = objs[i];
    if (o && o.type === 'post_station') { d = lifeFindDoor(o, R.ok); if (d) return d; }
  }
  return null;
}
function cvvSetPath(cv, xs, ys, fb) {
  var n = xs.length, i, dx, dy;
  cv.n = n; cv.xs = xs; cv.ys = ys; cv.cum = new Float32Array(n);
  for (i = 1; i < n; i++) { dx = xs[i] - xs[i - 1]; dy = ys[i] - ys[i - 1]; cv.cum[i] = cv.cum[i - 1] + Math.sqrt(dx * dx + dy * dy); }
  cv.total = cv.cum[n - 1];
  cv.fb = !!fb;
  if (fb) { cv.fa = 2; cv.fo = 2; } else if (cv.dir === 'out') { cv.fa = 0.9; cv.fo = 2.5; } else { cv.fa = 2.5; cv.fo = 0.9; }
}
function cvvReverse(a) { return a.slice().reverse(); }
// 嘗試建路徑:1 = 完成,0 = 還在等距離場
function cvvBuildPath(cv) {
  var R = LIFE.road, W, door, D, best = -1, bd = 1e9, i, e, d, c, g, j, k, cells = [], xs = [], ys = [], dx, dy, bestE = null, ex, ey, len;
  if (!R) return 0;
  W = boardW();
  door = cvvFindHub();
  if (!door) return -1;
  cv.doorX = door.cell % W + 0.5; cv.doorY = Math.floor(door.cell / W) + 0.5;
  D = lifeField(door.cell);
  if (!D) return 0;
  for (i = 0; i < R.ent.length; i++) {
    e = R.ent[i]; d = D[e.cell];
    if (d >= 0 && d < bd) { bd = d; best = i; }
  }
  if (best >= 0) {
    bestE = R.ent[best];
    c = bestE.cell; g = D[c] + 2;
    while (g-- > 0) {
      cells.push(c);
      if (D[c] <= 0) break;
      j = -1;
      for (k = 0; k < 4; k++) { d = R.nb[c * 4 + k]; if (d >= 0 && D[d] === D[c] - 1) { j = d; break; } }
      if (j < 0) break;
      c = j;
    }
    if (cells.length >= 1 && cells[cells.length - 1] === door.cell) {
      cells.reverse();   // 驛站門 → 入口
      for (i = 0; i < cells.length; i++) { xs.push(cells[i] % W + 0.5); ys.push(Math.floor(cells[i] / W) + 0.5); }
      if (bestE.ox || bestE.oy) { xs.push(xs[xs.length - 1] + bestE.ox * 1.5); ys.push(ys[ys.length - 1] + bestE.oy * 1.5); }
      else if (xs.length >= 2) { dx = xs[xs.length - 1] - xs[xs.length - 2]; dy = ys[ys.length - 1] - ys[ys.length - 2]; xs.push(xs[xs.length - 1] + dx * 1.5); ys.push(ys[ys.length - 1] + dy * 1.5); }
      if (xs.length >= 2) {
        if (cv.dir === 'in') { xs = cvvReverse(xs); ys = cvvReverse(ys); }
        cvvSetPath(cv, xs, ys, false);
        return 1;
      }
    }
  }
  // 無路徑:從驛站門朝最近的入口(或最近的板邊)直線走 6 格,淡入淡出
  ex = cv.doorX; ey = cv.doorY;
  bd = 1e9;
  for (i = 0; i < R.ent.length; i++) {
    c = R.ent[i].cell;
    dx = c % W + 0.5 - cv.doorX; dy = Math.floor(c / W) + 0.5 - cv.doorY;
    d = dx * dx + dy * dy;
    if (d < bd && d > 0.01) { bd = d; ex = dx; ey = dy; }
  }
  if (bd >= 1e9) { ex = cv.doorX < W / 2 ? -1 : 1; ey = 0; }
  len = Math.sqrt(ex * ex + ey * ey) || 1;
  ex = ex / len * 6; ey = ey / len * 6;
  xs = [cv.doorX, cv.doorX + ex]; ys = [cv.doorY, cv.doorY + ey];
  if (cv.dir === 'in') { xs = cvvReverse(xs); ys = cvvReverse(ys); }
  cvvSetPath(cv, xs, ys, true);
  return 1;
}
// 沿路徑 s(格,可超出兩端,線性外推)的位置與單位方向 → CVV.pos = [x, y, ux, uy]
function cvvPosAt(cv, s) {
  var n = cv.n, cum = cv.cum, lo = 0, hi = n - 2, i, mid, sl, ux, uy, t, p = CVV.pos;
  if (n < 2) { p[0] = cv.xs[0]; p[1] = cv.ys[0]; p[2] = 1; p[3] = 0; return p; }
  if (s <= 0) i = 0;
  else if (s >= cv.total) i = n - 2;
  else {
    while (lo < hi) { mid = (lo + hi + 1) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid - 1; }
    i = lo;
  }
  sl = cum[i + 1] - cum[i] || 1;
  ux = (cv.xs[i + 1] - cv.xs[i]) / sl; uy = (cv.ys[i + 1] - cv.ys[i]) / sl;
  t = s - cum[i];
  p[0] = cv.xs[i] + ux * t; p[1] = cv.ys[i] + uy * t; p[2] = ux; p[3] = uy;
  return p;
}
function cvvAlphaAt(cv, s) {
  var a = cvvClamp01((s + 0.15) / cv.fa), b = cvvClamp01((cv.total - s + 0.15) / cv.fo);
  return a < b ? a : b;
}

// ───────── 生成 / 偵測 ─────────
function cvvSpawn(dir, info) {
  var cv, cart = (typeof caravanCart === 'function') ? caravanCart(info.cart) : null, col, ne, i, k;
  if (CVV.convoys.length >= CVV_MAX) { CVV.skipped++; return false; }
  if (!LIFE.road) return false;
  col = cart ? cart.color : '#d8d8d8';
  k = 0;
  if (typeof CARAVAN_CARTS !== 'undefined') for (i = 0; i < CARAVAN_CARTS.length; i++) if (CARAVAN_CARTS[i].id === info.cart) k = i;
  cv = {
    dir: dir, grade: k, color: col, cTop: cvvShade(col, 1.05), cNx: cvvShade(col, 0.82), cNy: cvvShade(col, 0.64), cDark: cvvShade(col, 0.45),
    state: 'wait', wait: 0, s: 0, spd: CVV_SPD * (0.9 + k * 0.05), hintT: -1, hintDone: false,
    n: 0, xs: null, ys: null, cum: null, total: 0, fb: false, fa: 1, fo: 1, doorX: 0, doorY: 0, maxOff: 0,
    cart: { kind: 0, x: 0, y: 0, px: 0, py: 0, ux: 1, uy: 0, alpha: 0, ph: k * 1.7, cv: null },
    escs: [], hint: { kind: 2, x: 0, y: 0, px: 0, py: 0, alpha: 0, t: 0 }
  };
  ne = Math.max(1, Math.min(2, (info.esc && info.esc.length) || 0));
  for (i = 0; i < ne; i++) {
    var eid = (info.esc && info.esc[i]) || (100 + k * 2 + i);
    cv.escs.push(cvvMakeEscort('e' + eid, eid * 2654435761 >>> 0, i * 0.9 + 0.3));
    cv.escs[i].off = CVV_ESC_OFF[i]; cv.escs[i].lat = CVV_ESC_LAT[i];
    if (CVV_ESC_OFF[i] > cv.maxOff) cv.maxOff = CVV_ESC_OFF[i];
  }
  cv.cart.cv = cv;
  CVV.convoys.push(cv);
  CVV.spawned++;
  return true;
}
function cvvSync(now) {
  var s = caravanGet(), seen = {}, key, i, t, info, gate = cvvGateOk();
  for (i = 0; i < s.trips.length; i++) {
    t = s.trips[i];
    key = t.cart + '|' + t.t0;
    seen[key] = 1;
    if (!CVV.known[key]) {
      CVV.known[key] = { cart: t.cart, esc: t.esc.slice(), t0: t.t0, t1: t.t1 };
      if (gate && now - t.t0 >= 0 && now - t.t0 < CVV_FRESH_MS) cvvSpawn('out', CVV.known[key]);
    }
  }
  for (key in CVV.known) {
    if (seen[key]) continue;
    info = CVV.known[key];
    delete CVV.known[key];
    if (gate && now - info.t1 < CVV_RETURN_MS) cvvSpawn('in', info);
  }
}

// ───────── 更新 ─────────
function caravanVisClear() {
  var i, u = CVV.used;
  if (CVV.convoys.length) CVV.convoys.length = 0;
  for (i = 0; i < u.length; i++) CVV.buck[u[i]].length = 0;
  u.length = 0;
  CVV.n = 0;
}
function cvvPut(m, D) {
  var d = Math.floor(m.x) + Math.floor(m.y), b = CVV.buck;
  if (d < 0) d = 0; else if (d >= D) d = D - 1;
  while (b.length <= d) b.push([]);
  if (b[d].length === 0) CVV.used.push(d);
  b[d].push(m);
  CVV.n++;
}
function caravanVisTick(dt) {
  var t0, now, i, k, cv, r, p, ux, uy, m, e, sE, D, W, show, ux2, uy2, vx, vy;
  if (typeof caravanGet !== 'function' || typeof LIFE === 'undefined' || !LIFE.road) return;
  t0 = (typeof lifeNow === 'function') ? lifeNow() : Date.now();
  now = Date.now();
  CVV.syncT -= dt;
  if (CVV.syncT <= 0) { CVV.syncT = 0.5; try { cvvSync(now); } catch (err) { CVV.on = false; if (typeof console !== 'undefined') console.warn('[caravan_vis] 偵測失敗,已停用視覺', err); } }
  if (!cvvGateOk()) { caravanVisClear(); return; }
  show = cvvZoomOk();
  // 清上一幀的桶
  for (i = 0; i < CVV.used.length; i++) CVV.buck[CVV.used[i]].length = 0;
  CVV.used.length = 0;
  CVV.n = 0;
  W = boardW(); D = W + boardH();
  for (k = CVV.convoys.length - 1; k >= 0; k--) {
    cv = CVV.convoys[k];
    if (cv.state === 'wait') {
      cv.wait += dt;
      r = cvvBuildPath(cv);
      if (r === 1) { cv.state = 'run'; cv.s = 0; }
      else if (r < 0 || cv.wait > CVV_WAIT_MAX) { CVV.convoys.splice(k, 1); continue; }
      else continue;
    }
    if (cv.state === 'run') {
      cv.s += cv.spd * dt;
      if (cv.dir === 'in' && !cv.hintDone && cv.s >= cv.total) { cv.hintDone = true; cv.hintT = 0; }
      if (cv.s >= cv.total + cv.maxOff + 0.3 && (cv.dir !== 'in' || cv.hintT >= CVV_HINT_T)) { CVV.convoys.splice(k, 1); continue; }
    }
    if (cv.hintT >= 0 && cv.hintT < CVV_HINT_T) cv.hintT += dt;
    if (!show) continue;
    // 馬車
    p = cvvPosAt(cv, cv.s);
    m = cv.cart; m.x = p[0]; m.y = p[1];
    ux = p[2]; uy = p[3];
    if (Math.abs(ux) >= Math.abs(uy)) { m.ux = ux >= 0 ? 1 : -1; m.uy = 0; } else { m.ux = 0; m.uy = uy >= 0 ? 1 : -1; }
    m.alpha = cvvAlphaAt(cv, cv.s);
    m.px = isoX(m.x, m.y); m.py = isoY(m.x, m.y, lifeHAt(m.x, m.y));
    if (m.alpha > 0.02 && lifeOnScreen(m)) cvvPut(m, D);
    // 鏢師
    for (i = 0; i < cv.escs.length; i++) {
      e = cv.escs[i];
      sE = cv.s - e.off;
      p = cvvPosAt(cv, sE);
      ux2 = p[2]; uy2 = p[3]; vx = -uy2; vy = ux2;
      e.x = p[0] + vx * e.lat; e.y = p[1] + vy * e.lat;
      e.fx = ux2; e.fy = uy2;
      e.alpha = sE < -0.2 ? 0 : cvvAlphaAt(cv, sE);
      e.px = isoX(e.x, e.y); e.py = isoY(e.x, e.y, lifeHAt(e.x, e.y));
      if (e.alpha > 0.02 && lifeOnScreen(e)) cvvPut(e, D);
    }
    // 驛站小提示
    if (cv.hintT >= 0 && cv.hintT < CVV_HINT_T) {
      m = cv.hint; m.x = cv.doorX; m.y = cv.doorY; m.t = cv.hintT / CVV_HINT_T;
      m.alpha = cvvClamp01(Math.min(m.t * 6, (1 - m.t) * 2.5));
      m.px = isoX(m.x, m.y); m.py = isoY(m.x, m.y, lifeHAt(m.x, m.y));
      if (lifeOnScreen(m)) cvvPut(m, D);
    }
  }
  CVV.ms = CVV.ms * 0.9 + ((typeof lifeNow === 'function' ? lifeNow() : Date.now()) - t0) * 0.1;
}

// ───────── 繪製 ─────────
// 把 (gx, gy) 格座標 + 離地 z 像素 投影成螢幕世界座標;結果寫進 out[i], out[i+1](不配置)
function cvvPrj(out, i, gx, gy, h0, z) { out[i] = isoX(gx, gy); out[i + 1] = isoY(gx, gy, h0) - z; }
// 畫一個軸對齊(沿車向 u)的盒子:中心 (cx,cy)、半長 hl、半寬 hw、底 z0 頂 z1;只畫朝前的兩面 + 頂面
function cvvBox(ctx, cx, cy, ux, uy, hl, hw, z0, z1, h0, cTop, cNx, cNy) {
  var S = CVV.scratch, gx = CVV.g, vx = -uy, vy = ux, k, a, b, nx, ny, col;
  // 地面四角依序 A(-u,-v) B(+u,-v) C(+u,+v) D(-u,+v);gx[0..3] 為 x,gx[4..7] 為 y(重用緩衝,不配置)
  gx[0] = cx - ux * hl - vx * hw; gx[4] = cy - uy * hl - vy * hw;
  gx[1] = cx + ux * hl - vx * hw; gx[5] = cy + uy * hl - vy * hw;
  gx[2] = cx + ux * hl + vx * hw; gx[6] = cy + uy * hl + vy * hw;
  gx[3] = cx - ux * hl + vx * hw; gx[7] = cy - uy * hl + vy * hw;
  for (k = 0; k < 4; k++) {
    a = k; b = (k + 1) & 3;
    nx = (gx[a] + gx[b]) / 2 - cx; ny = (gx[a + 4] + gx[b + 4]) / 2 - cy;
    if (nx + ny <= 0.001) continue;
    col = nx > ny ? cNx : cNy;
    cvvPrj(S, 0, gx[a], gx[a + 4], h0, z0); cvvPrj(S, 2, gx[b], gx[b + 4], h0, z0);
    cvvPrj(S, 4, gx[b], gx[b + 4], h0, z1); cvvPrj(S, 6, gx[a], gx[a + 4], h0, z1);
    rqPoly4(ctx, S[0], S[1], S[2], S[3], S[4], S[5], S[6], S[7], col);
  }
  cvvPrj(S, 0, gx[0], gx[4], h0, z1); cvvPrj(S, 2, gx[1], gx[5], h0, z1);
  cvvPrj(S, 4, gx[2], gx[6], h0, z1); cvvPrj(S, 6, gx[3], gx[7], h0, z1);
  rqPoly4(ctx, S[0], S[1], S[2], S[3], S[4], S[5], S[6], S[7], cTop);
}
function cvvDrawCart(ctx, cv, m, alpha) {
  var ux = m.ux, uy = m.uy, vx = -uy, vy = ux, h0 = lifeHAt(m.x, m.y), k = cv.grade, S = CVV.scratch, Q = 1.55, sv, i, wx, wy, hx, hy, px, py, legA, horse, hdk, sux, suy, hs;
  rqAlpha(ctx, alpha * 0.28); rqDisc(ctx, m.px, m.py, 27, 11, '#000');
  rqAlpha(ctx, alpha);
  // 車輪(朝前那條長邊的兩個)
  sv = (vx + vy) >= 0 ? 1 : -1;
  for (i = -1; i <= 1; i += 2) {
    wx = m.x + ux * 0.24 * i + vx * 0.25 * sv; wy = m.y + uy * 0.24 * i + vy * 0.25 * sv;
    rqDisc(ctx, isoX(wx, wy), isoY(wx, wy, h0) - 4 * Q, 3.8 * Q, 3.8 * Q, '#2e2016');
    rqDisc(ctx, isoX(wx, wy), isoY(wx, wy, h0) - 4 * Q, 1.8 * Q, 1.8 * Q, '#c9a06a');
  }
  cvvBox(ctx, m.x, m.y, ux, uy, 0.42, 0.25, 4 * Q, 9 * Q, h0, '#b58a52', '#7a5a33', '#5e4426');
  if (k === 0) {   // 白:板車堆貨箱
    cvvBox(ctx, m.x - ux * 0.13, m.y - uy * 0.13, ux, uy, 0.2, 0.16, 9 * Q, 15 * Q, h0, '#c9a46a', '#a07e48', '#7e6236');
    cvvBox(ctx, m.x + ux * 0.18, m.y + uy * 0.18, ux, uy, 0.12, 0.12, 9 * Q, 13 * Q, h0, '#d8b97c', '#b08c52', '#8a6a3c');
  } else {         // 青~金:有篷
    cvvBox(ctx, m.x, m.y, ux, uy, 0.38, 0.21, 9 * Q, (18 + (k >= 3 ? 1 : 0)) * Q, h0, cv.cTop, cv.cNx, cv.cNy);
    if (k >= 2) cvvBox(ctx, m.x, m.y, ux, uy, 0.4, 0.23, 17.5 * Q, 19.5 * Q, h0, cvvShade(cv.color, 1.3), cv.cDark, cv.cDark);   // 藍起:篷頂邊飾條
    if (k >= 4) {  // 金:車尾旗桿 + 紅旗 + 金頂飾
      cvvPrj(S, 0, m.x - ux * 0.38, m.y - uy * 0.38, h0, 19 * Q);
      cvvPrj(S, 2, m.x - ux * 0.38, m.y - uy * 0.38, h0, 34 * Q);
      rqLine(ctx, S[0], S[1], S[2], S[3], 1.6, '#5a3a1a', alpha);
      rqPoly4(ctx, S[2], S[3], S[2] + 12, S[3] + 3, S[2] + 12, S[3] + 10, S[2], S[3] + 11, '#c0392b');
      rqDisc(ctx, S[2], S[3] - 1, 2.4, 2.4, '#ffd24a');
    } else if (k >= 3) {   // 紫:車頂小旗
      cvvPrj(S, 0, m.x, m.y, h0, 20 * Q);
      cvvPrj(S, 2, m.x, m.y, h0, 28 * Q);
      rqLine(ctx, S[0], S[1], S[2], S[3], 1.3, '#5a3a1a', alpha);
      rqPoly4(ctx, S[2], S[3], S[2] + 8, S[3] + 2, S[2] + 8, S[3] + 7, S[2], S[3] + 8, cv.cTop);
    }
  }
  // 馬(前方 0.9 格):身體 + 頭頸 + 兩條腿(隨步伐擺動);白車用較小的驢
  hx = m.x + ux * 0.9; hy = m.y + uy * 0.9;
  px = isoX(hx, hy); py = isoY(hx, hy, h0);
  legA = (Math.floor(LIFE.clock * 6 + m.ph) & 1) ? 2.5 : -2.5;
  horse = k === 4 ? '#f1ede2' : (k === 0 ? '#9a9690' : (k === 3 ? '#4a3626' : '#7a4a2a'));
  hdk = cvvShade(horse, 0.7);
  sux = (ux - uy) * 32; suy = (ux + uy) * 16;   // u 的螢幕方向(每格)
  hs = (k === 0 ? 0.85 : 1.1);
  rqRect(ctx, px - 8 * hs + legA * 0.5, py - 10 * hs, 3.2, 10 * hs, hdk);
  rqRect(ctx, px - 3 * hs - legA * 0.5, py - 10 * hs, 3.2, 10 * hs, hdk);
  rqRect(ctx, px + 3 * hs + legA * 0.5, py - 10 * hs, 3.2, 10 * hs, hdk);
  rqRect(ctx, px + 7 * hs - legA * 0.5, py - 10 * hs, 3.2, 10 * hs, hdk);
  rqDisc(ctx, px, py - 15 * hs, 13 * hs, 7 * hs, horse);
  rqDisc(ctx, px + sux * 0.2, py - 23 * hs + suy * 0.2, 4.2 * hs, 5 * hs, horse);
  rqDisc(ctx, px + sux * 0.32, py - 27 * hs + suy * 0.32, 4 * hs, 3.4 * hs, horse);
  rqDisc(ctx, px + sux * 0.32 - 2, py - 32 * hs + suy * 0.32, 1.4, 2.4, hdk);
  rqDisc(ctx, px - sux * 0.28, py - 17 * hs - suy * 0.28, 2.2 * hs, 3 * hs, hdk);   // 馬尾
}
function cvvDrawHint(ctx, m) {
  var rise = m.t * 16, x = m.px, y = m.py - 34 - rise;
  rqAlpha(ctx, m.alpha);
  rqRect(ctx, x - 7, y - 6, 14, 12, '#3a2610');
  rqRect(ctx, x - 6, y - 5, 12, 10, '#d09a4a');
  rqRect(ctx, x - 6, y - 1, 12, 1.6, '#8a5c22');
  rqRect(ctx, x - 1, y - 5, 2, 10, '#8a5c22');
  rqRect(ctx, x + 6, y - 12, 7, 2, '#ffffff'); rqRect(ctx, x + 8.5, y - 14.5, 2, 7, '#ffffff');   // 「+」
  rqAlpha(ctx, 1);
}
function caravanVisDraw(ctx, d) {
  var list, t0, i, m, z, dpr, useArt, res, tod, season;
  if (CVV.n === 0) return;
  list = CVV.buck[d];
  if (!list || !list.length) return;
  if (!LIFE.active) return;
  t0 = (typeof lifeNow === 'function') ? lifeNow() : Date.now();
  z = (typeof view !== 'undefined' && view) ? view.zoom : 1;
  dpr = (typeof viewport !== 'undefined' && viewport && viewport.dpr) || 1;
  useArt = z >= 0.5 && typeof ART !== 'undefined' && !!ART.chibiPose && !!ART.resBucket;
  res = useArt ? Math.min(LIFE_RES_MAX, ART.resBucket(z * dpr)) : 1;
  tod = LIFE.tod; season = lifeSeason();
  var mult = LIFE.placing ? 0.5 : 1;
  LIFE.small = z < 0.5;
  for (i = 0; i < list.length; i++) {
    m = list[i];
    if (m.kind === 0) {
      cvvDrawCart(ctx, m.cv, m, m.alpha * mult);
    } else if (m.kind === 1) {
      lifeDrawOne(ctx, m, res, tod, season, useArt && !!m.spec, m.alpha * mult);
    } else cvvDrawHint(ctx, m);
  }
  var dt = ((typeof lifeNow === 'function') ? lifeNow() : Date.now()) - t0;
  CVV.drawMs += dt;
  if (typeof LIFE.drawAcc === 'number') LIFE.drawAcc += dt;
}
// 開發用:每幀繪製累積耗時(ms),讀取後歸零
function caravanVisStats() { var o = { convoys: CVV.convoys.length, items: CVV.n, tickMs: Math.round(CVV.ms * 1000) / 1000, drawMs: CVV.drawMs, spawned: CVV.spawned, skipped: CVV.skipped }; CVV.drawMs = 0; return o; }
