// js/terrain_live.js — 活的地形:海洋 T_OCEAN=19 / 沼澤 T_SWAMP=20 / 火山灰 T_ASHLAND=21(id 常數與規則輔助見 data.js)。
// 規則:
//   海洋  = 水。不可走(MOVE_COST 不可達、citylife / mapio 視為水)、terrainBase → 湖(水上物件白名單同湖,另排除小水景 / 橋,見 LIVE_NO_OCEAN_RE)、不結冰、
//           海水不可飲用(飲水指標只看 cityfx 水源物件,與地形無關);景觀(cityscore waterTiles)算水面。
//   沼澤  = 陸地(isGroundTerrain)、可走但慢(path.js 代價 foot 25 / horse 35 / heavy 不可達,同 PLAN_BIOMES marsh)、可蓋、不可種田(farm 類)。冬季:水窪結冰皮、不冒泡、不積雪。
//           (PLAN_BIOMES 原案「限建 on 含 marsh 者」需逐物件宣告白名單,本版先採「可蓋、不可種田」,待 Q4 定案再收緊。)
//   火山灰 = 陸地、可走(foot 11 / horse 12 / heavy 15,同 PLAN_BIOMES ash)、可蓋、可種田(ash = soil)、不可種樹(nature 類)。冬季不積雪(地熱)。
// 繪製:底色 + 靜態細節 + 岸邊泡沫 + 深淺階「烘焙進地形分塊」(drawTile 在 tileBake 下畫,簽名含深淺階);動畫只疊在可見、無物件佔用的活地形格上,
//   元素總數有硬上限(LIVE_CAP_*),以 (x, y, time) 的確定性雜湊決定誰何時出現;縮放 < 0.5 / 省電 / 拍照 / 錄影 / 全景離屏 → 一律不畫動畫(靜態底仍在)。
// 海洋深淺 = 到最近陸地(非海 / 湖 / 河)的 4 鄰距離,依地形指紋只在地形變更時重算(liveSync),不逐幀計算。
'use strict';

var LIVE_CAP_GL = 100, LIVE_CAP_C2D = 80;           // 每幀動畫元素(線段)硬上限(實測 GL 約 3~4 us / 元素、c2d 約 2.5 us / 元素 + 每格 0.5 us;預算見 tools/bench_terrainlive.js)
var LIVE_MIN_ZOOM = 0.5;                            // 低於此縮放不畫動畫
var LIVE_C2D_DETAIL_ZOOM = 0.8;                     // c2d 逐幀重畫:低於此縮放只畫底色 / 岸沫 / 深淺混色,不畫水窪 / 草叢 / 灰點 / 暗紋(GL 分塊烘焙一次畫好,不受此限)
var LIVE_NO_OCEAN_RE = /^lotus$|^reeds$|^small_bridge$|^bridge$/;   // 海上不可放:荷花 / 蘆葦 / 池上小橋 / 一般橋(其餘水上物件如碼頭、船、浮橋照湖規則)
var LIVE = { on: false, any: false, n: 0, cap: 0, gl: false, sO: 1, sS: 1, sA: 1, dist: null, fp: 0, syncs: 0, bakes: 0, W: 0, col: null, ocW: '', ocS: '', oc: null, tm: {}, tmKey: '' };

// ---- 規則 ----
function liveObjKey(d) {
  if (d._okey !== undefined) return d._okey;
  var k, r = '';
  for (k in OBJECTS) if (OBJECTS[k] === d) { r = k; break; }
  Object.defineProperty(d, '_okey', { value: r, enumerable: false, writable: true });
  return r;
}
// 供 data.js terrainOn 呼叫:回 false = 此地形不可放該物件(其餘交給 d.on + terrainBase 判定)
function liveTerrainOn(d, t) {
  var c = objTerrainClass(d);
  if (t === T_OCEAN) return LIVE_NO_OCEAN_RE.test(liveObjKey(d)) ? false : undefined;
  if (t === T_SWAMP) return c === 'farm' ? false : undefined;
  if (t === T_ASHLAND) return c === 'nature' ? false : undefined;   // 火山灰 = PLAN_BIOMES ash(ground + soil):可耕可蓋,但依任務規則不長樹
  return undefined;
}

// ---- 距離場(海的深淺階)----
// 指紋:海格與湖 / 河格的位置;改變才重算。回傳是否重算過
function liveSync() {
  var T = world.terrain, n = T.length, h = (2166136261 ^ n) >>> 0, oc = 0, lv = 0, i, t;
  for (i = 0; i < n; i++) {
    t = T[i];
    if (t === 19) { oc++; h = Math.imul(h ^ (i * 4 + 1), 16777619); }
    else if (t > 19) lv++;
    else if (t === 1 || t === 2) h = Math.imul(h ^ (i * 4 + 2), 16777619);
  }
  LIVE.any = oc + lv > 0;
  h = (h >>> 0) + oc;
  if (oc === 0) { LIVE.dist = null; LIVE.fp = h; return false; }
  if (LIVE.dist && LIVE.dist.length === n && LIVE.fp === h) return false;
  var W = Math.round(Math.sqrt(n)), d = new Uint8Array(n), q = new Int32Array(n), qh = 0, qt = 0, x, y, j;
  d.fill(255);
  for (i = 0; i < n; i++) { t = T[i]; if (t !== 19 && t !== 1 && t !== 2) { d[i] = 0; q[qt++] = i; } }
  while (qh < qt) {
    i = q[qh++];
    var dv = d[i];
    if (dv >= 6) continue;
    x = i % W; y = (i - x) / W;
    if (x > 0) { j = i - 1; if (T[j] === 19 && d[j] === 255) { d[j] = dv + 1; q[qt++] = j; } }
    if (x < W - 1) { j = i + 1; if (T[j] === 19 && d[j] === 255) { d[j] = dv + 1; q[qt++] = j; } }
    if (y > 0) { j = i - W; if (T[j] === 19 && d[j] === 255) { d[j] = dv + 1; q[qt++] = j; } }
    if (y < W - 1) { j = i + W; if (T[j] === 19 && d[j] === 255) { d[j] = dv + 1; q[qt++] = j; } }
  }
  LIVE.dist = d; LIVE.fp = h; LIVE.W = W; LIVE.syncs++;
  return true;
}
// 深淺階 0 淺 … 3 深(距離 1 / 2 / 3~4 / 5+;未連到陸地者最深)
function liveOceanCls(i) {
  var d = LIVE.dist;
  if (!d) { liveSync(); d = LIVE.dist; if (!d) return 3; }
  var v = d[i];
  return v <= 1 ? 0 : (v === 2 ? 1 : (v <= 4 ? 2 : 3));
}

// ---- 每幀:同步距離場、動畫開關、抽樣步距 ----
function liveAnimAllowed() {
  if (view.zoom < LIVE_MIN_ZOOM) return false;
  if (typeof isPowerSave === 'function' && isPowerSave()) return false;
  if (typeof uiIsPhoto === 'function' && uiIsPhoto()) return false;
  if (typeof REC !== 'undefined' && REC && REC.state && REC.state !== 'idle' && REC.state !== 'review') return false;
  if (typeof pano === 'object' && pano && (pano.rend || pano.open)) return false;
  if (typeof document !== 'undefined' && document.body && document.body.classList && document.body.classList.contains('shooting')) return false;
  return true;
}
function liveFrame(time, ctx) {
  var tk = (typeof artIsOn === 'function' && artIsOn() && typeof artTodKey === 'function' ? artTodKey() : '-') + currentSeason;
  if (tk !== LIVE.tmKey) { LIVE.tm = {}; LIVE.tmKey = tk; }
  liveSync();
  LIVE.n = 0;
  LIVE.on = false;
  if (!LIVE.any || !liveAnimAllowed()) return;
  LIVE.on = true;
  LIVE.gl = !!(ctx && typeof rqActive === 'function' && rqActive(ctx));
  LIVE.cap = LIVE.gl ? LIVE_CAP_GL : LIVE_CAP_C2D;
  var z = view.zoom, cells = viewport.w * viewport.h / (z * z * 1024), cap = LIVE.cap;
  LIVE.sO = Math.max(1, Math.ceil(cells * 0.9 / cap));    // 每格期望元素數(海 ~0.8、灰 ~0.2、沼 ~0.1;可見格含邊界外擴)
  LIVE.sS = Math.max(1, Math.ceil(cells * 0.1 / cap));
  LIVE.sA = Math.max(1, Math.ceil(cells * 0.2 / cap));
  var f = typeof g2Tint === 'function' ? g2Tint : function (c) { return c; };
  LIVE.col = { wave: f('#effcff'), spark: f('#ffffff'), bub: f('#dbe8ae'), smoke: f('#c9c4be'), ember: '#ff9a40', glow: '#ff6a20' };
}

// 是否抽中該格做動畫(便宜:雜湊 + 取模,先於佔用 / 可見判定)
function liveCellPick(x, y, t) {
  var h = g2Hash(x, y, 901);
  if (t === T_OCEAN) { var s = LIVE.sO; return s === 1 || (h >>> 5) % s === 0; }
  if (t === T_SWAMP) { return (h & 15) === 0 && LIVE.sS > 0 && (LIVE.sS === 1 || (h >>> 9) % LIVE.sS === 0) && livePuddle(x, y) !== null && currentSeason !== 'winter'; }
  var a = (h % 24 === 0) || (h % 40 === 7);
  return a && (LIVE.sA === 1 || (h >>> 9) % LIVE.sA === 0);
}

// ---- 色票 ----
var LIVE_SWAMP = { base: ['#6c6d3e', '#656638', '#74744a'], cold: ['#7d7d68', '#767660', '#85856f'] };
var LIVE_ASH = { base: ['#4d4a48', '#464341', '#53504d'], cold: ['#5b5856', '#545150', '#615e5c'] };
function liveOceanPal() {
  var W = PAL.water;
  if (LIVE.ocW === W && LIVE.oc) return LIVE.oc;
  LIVE.oc = [g2Mix(W, '#a8ecdf', 0.55), g2Mix(W, '#7fd6e0', 0.3), W, g2Mix(shade(W, 0.72), '#143a7a', 0.35)];
  LIVE.ocW = W;
  return LIVE.oc;
}
// 時段乘色的記憶(artTile 每次約 0.4 us;同一幀色票有限)。烘焙(ART_NEUTRAL)時不套色;TOD / ART 開關變了在 liveFrame 清空
function liveTint(c) {
  if (ART_NEUTRAL) return c;
  var r = LIVE.tm[c];
  if (r === undefined) r = LIVE.tm[c] = g2Tint(c);
  return r;
}
// 底色(drawTile 於 artTile 之前呼叫)
function liveTileCol(t, i, hs) {
  if (t === T_OCEAN) return liveOceanPal()[liveOceanCls(i)];
  var g = t === T_SWAMP ? LIVE_SWAMP : LIVE_ASH;
  return (currentSeason === 'winter' ? g.cold : g.base)[hs % 3];
}
function liveFlat(t) {   // g2EdgeBlend 用的代表色
  if (t === T_OCEAN) return liveOceanPal()[2];
  var g = t === T_SWAMP ? LIVE_SWAMP : (t === T_ASHLAND ? LIVE_ASH : null);
  return g ? (currentSeason === 'winter' ? g.cold : g.base)[0] : PAL.grass[0];
}

// ---- 靜態:海的深淺混色 + 岸邊泡沫(drawTile 的邊迴圈呼叫;p = 頂面四角,e = [起點, 終點, 鄰格 x, 鄰格 y])----
function liveStrip(ctx, p, e, k, col, a) {
  var A = p[e[0]], B = p[e[1]], cx = (p[0][0] + p[2][0]) / 2, cy = (p[0][1] + p[2][1]) / 2;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
  ctx.lineTo(B[0] + (cx - B[0]) * k, B[1] + (cy - B[1]) * k);
  ctx.lineTo(A[0] + (cx - A[0]) * k, A[1] + (cy - A[1]) * k);
  ctx.closePath();
  ctx.fillStyle = liveTint(col);
  ctx.globalAlpha = a;
  ctx.fill();
}
function liveOceanEdge(ctx, p, e, x, y, nt) {
  var i, c0, c1;
  if (nt === T_OCEAN) {
    i = idx(x, y);
    c0 = liveOceanCls(i); c1 = liveOceanCls(idx(e[2], e[3]));
    if (c0 === c1) return;   // 同階(絕大多數邊):不做任何 canvas 呼叫
    var pal = liveOceanPal();   // 深淺交界:兩層漸淡窄帶,避免硬格線
    liveStrip(ctx, p, e, 0.5, g2Mix(pal[c0], pal[c1], 0.5), 0.35);
    liveStrip(ctx, p, e, 0.25, pal[c1], 0.4);
    ctx.globalAlpha = 1;
    return;
  }
  if (nt === T_LAKE || nt === T_RIVER) {
    liveStrip(ctx, p, e, 0.35, g2Mix(liveOceanPal()[liveOceanCls(idx(x, y))], PAL.water, 0.5), 0.5);
    ctx.globalAlpha = 1;
    return;
  }
  // 岸:不規則白浪帶(5 個採樣點的內縮量由格雜湊決定)+ 較淡的外擴第二層
  var A = p[e[0]], B = p[e[1]], cx = (p[0][0] + p[2][0]) / 2, cy = (p[0][1] + p[2][1]) / 2, hs = g2Hash(x, y, 40 + e[0]), k = [], s, m;
  for (s = 0; s < 5; s++) k.push(0.13 + ((hs >>> (s * 4)) & 7) / 7 * 0.12);
  ctx.fillStyle = liveTint(PAL.foam);
  for (m = 0; m < 2; m++) {
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
    for (s = 4; s >= 0; s--) {
      var u = s / 4, px = A[0] + (B[0] - A[0]) * u, py = A[1] + (B[1] - A[1]) * u, kk = k[s] + m * 0.14;
      ctx.lineTo(px + (cx - px) * kk, py + (cy - py) * kk);
    }
    ctx.closePath();
    ctx.globalAlpha = m ? 0.22 : 0.6;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function liveWaterAt(x, y) { return !inBounds(x, y) || isWaterTerrain(world.terrain[idx(x, y)]); }
// 海格四角的凹角泡沫(兩個正交鄰格是水、斜對角是陸地時,補一小塊白沫,避免岸線在凹角斷開);只有離岸 1 格的海格才可能有
function liveOceanCorners(ctx, x, y, h) {
  var p = topPts(x, y, h, 3), cx = (p[0][0] + p[2][0]) / 2, cy = (p[0][1] + p[2][1]) / 2;
  // [頂點, 前一頂點, 下一頂點, 正交鄰格 a, 鄰格 b, 斜對角]
  var cs = [[0, 3, 1, x, y - 1, x - 1, y, x - 1, y - 1], [1, 0, 2, x, y - 1, x + 1, y, x + 1, y - 1],
    [2, 1, 3, x + 1, y, x, y + 1, x + 1, y + 1], [3, 2, 0, x, y + 1, x - 1, y, x - 1, y + 1]], n, c, V, P0, P1, any = false;
  for (n = 0; n < 4; n++) {
    c = cs[n];
    if (!liveWaterAt(c[3], c[4]) || !liveWaterAt(c[5], c[6]) || liveWaterAt(c[7], c[8])) continue;
    V = p[c[0]]; P0 = p[c[1]]; P1 = p[c[2]];
    if (!any) { ctx.fillStyle = liveTint(PAL.foam); ctx.globalAlpha = 0.55; any = true; }
    ctx.beginPath();
    ctx.moveTo(V[0], V[1]);
    ctx.lineTo(V[0] + (P0[0] - V[0]) * 0.34, V[1] + (P0[1] - V[1]) * 0.34);
    ctx.lineTo(V[0] + (cx - V[0]) * 0.24, V[1] + (cy - V[1]) * 0.24);
    ctx.lineTo(V[0] + (P1[0] - V[0]) * 0.34, V[1] + (P1[1] - V[1]) * 0.34);
    ctx.closePath();
    ctx.fill();
  }
  if (any) ctx.globalAlpha = 1;
}

// ---- 靜態細節(底色之後;與 time 無關)----
function livePuddle(x, y) {   // 沼澤水窪位置(格內 u, v)與半徑;無水窪回 null。靜態繪製與冒泡共用
  var hs = g2Hash(x, y, 51);
  if (((hs >>> 10) & 3) === 0) return null;
  return { u: 0.28 + ((hs >>> 4) & 7) / 16, v: 0.28 + ((hs >>> 7) & 7) / 16, r: 5 + ((hs >>> 13) & 3) * 1.1, two: ((hs >>> 16) & 3) === 0 };
}
function liveDrawStatic(ctx, x, y, h, t) {
  var hs = g2Hash(x, y, t), hp = h * HL, winter = currentSeason === 'winter', q, n, a, b, u0, v0;
  if (t === T_OCEAN) {   // 暗紋:深處 1~2 條淺弧(單一路徑 + 一次描邊)
    var cls = liveOceanCls(idx(x, y));
    if (cls < 1 || ((hs >>> 3) & 3) === 0) return;
    ctx.beginPath();
    for (n = 0; n < (cls === 1 ? 1 : 2); n++) {
      u0 = 0.15 + ((hs >>> (6 + n * 6)) & 7) / 12; v0 = 0.2 + ((hs >>> (9 + n * 6)) & 7) / 12;
      a = gpt(x + u0, y + v0, hp - 3); b = gpt(x + u0 + 0.26, y + v0 + 0.02, hp - 3); q = gpt(x + u0 + 0.13, y + v0 - 0.05, hp - 3);
      ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(q[0], q[1], b[0], b[1]);
    }
    ctx.strokeStyle = liveTint(PAL.waterHi); ctx.lineWidth = 1; ctx.globalAlpha = cls === 3 ? 0.12 : 0.2; ctx.stroke(); ctx.globalAlpha = 1;
    return;
  }
  if (t === T_SWAMP) {
    var pd = livePuddle(x, y), c, r2, pd2 = null;
    if (pd) {   // 水窪:泥濘邊一次填、水面一次填(最多 2 窪)
      c = gpt(x + pd.u, y + pd.v, hp);
      if (pd.two) pd2 = [gpt(x + 1 - pd.u * 0.8 - 0.1, y + 1 - pd.v * 0.8 - 0.1, hp), pd.r * 0.6];
      ctx.beginPath(); g2Ellipse(ctx, [c[0], c[1] + 0.8], pd.r + 1.6, (pd.r + 1.6) / 2);
      if (pd2) g2Ellipse(ctx, [pd2[0][0], pd2[0][1] + 0.8], pd2[1] + 1.6, (pd2[1] + 1.6) / 2);
      ctx.fillStyle = liveTint('#4a4a26'); ctx.globalAlpha = 0.5; ctx.fill();
      ctx.beginPath(); g2Ellipse(ctx, c, pd.r, pd.r / 2);
      if (pd2) g2Ellipse(ctx, pd2[0], pd2[1], pd2[1] / 2);
      ctx.fillStyle = liveTint(winter ? '#cfe2e8' : '#4f7d76'); ctx.globalAlpha = 0.88; ctx.fill();
    }
    ctx.beginPath();   // 枯草叢:3 叢,每叢 3 根短線
    for (n = 0; n < 3; n++) {
      u0 = 0.12 + ((hs >>> (n * 5 + 1)) & 15) / 20; v0 = 0.12 + ((hs >>> (n * 5 + 20)) & 15) / 20;
      if (pd && Math.abs(u0 - pd.u) < 0.22 && Math.abs(v0 - pd.v) < 0.22) continue;
      a = gpt(x + u0, y + v0, hp);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] - 1.6, a[1] - 4.5);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + 0.4, a[1] - 5.5);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + 1.8, a[1] - 4);
    }
    ctx.strokeStyle = liveTint(winter ? '#a7a58c' : '#a39a4e'); ctx.lineWidth = 1; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
    return;
  }
  ctx.beginPath();   // 火山灰:暗斑 + 淡白灰點
  for (n = 0; n < 2; n++) {
    q = gpt(x + 0.2 + ((hs >>> (n * 6)) & 7) / 11, y + 0.2 + ((hs >>> (n * 6 + 3)) & 7) / 11, hp);
    g2Ellipse(ctx, q, 6 + n * 2, 3 + n);
  }
  ctx.fillStyle = liveTint('#2c2a29'); ctx.globalAlpha = 0.35; ctx.fill();
  ctx.beginPath();
  for (n = 0; n < 5; n++) {
    q = gpt(x + 0.08 + ((hs >>> (n * 4 + 9)) & 15) / 17.5, y + 0.08 + ((hs >>> (n * 4 + 13)) & 15) / 17.5, hp);
    g2Ellipse(ctx, q, 1.5, 0.8);
  }
  ctx.fillStyle = liveTint('#a7a39c'); ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1;
}

// drawTile 的最後一步:靜態細節 + c2d 動畫(GL 幀的格子不會走到這裡;GL 動畫見 render.js terrGl → liveAnim)
function liveDrawTile(ctx, x, y, h, t, time) {
  var i = idx(x, y);
  if (t === T_OCEAN && liveOceanCls(i) === 0) liveOceanCorners(ctx, x, y, h);
  if (view.zoom >= (tileBake ? G2_DETAIL_ZOOM : LIVE_C2D_DETAIL_ZOOM)) liveDrawStatic(ctx, x, y, h, t);
  if (tileBake || !LIVE.on) return;
  if (world.occ[i] || pend.occ[i] || !liveCellPick(x, y, t)) return;
  liveAnim(ctx, x, y, t, time, h);
}

// ---- 動畫(確定性:只依格座標與 time)----
function liveSeg(ctx, gl, x0, y0, x1, y1, lw, col, a) {
  LIVE.n++;
  if (gl) { rqLine(ctx, x0, y0, x1, y1, lw, col, a); return; }
  ctx.globalAlpha = a;
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function liveAnim(ctx, x, y, t, time, h) {
  var gl = LIVE.gl && typeof rqActive === 'function' && rqActive(ctx), cap = gl ? LIVE_CAP_GL : LIVE_CAP_C2D;
  if (LIVE.n >= cap) return;
  var c2 = !gl;
  if (c2) ctx.save();
  if (t === T_OCEAN) liveAnimOcean(ctx, gl, x, y, time, h);
  else if (t === T_SWAMP) liveAnimSwamp(ctx, gl, x, y, time, h);
  else liveAnimAsh(ctx, gl, x, y, time, h);
  if (c2) ctx.restore();
}
function liveAnimOcean(ctx, gl, x, y, time, h) {
  var hs = g2Hash(x, y, 11), per = 3 + (hs & 7) * 0.25, ph = time / per + ((hs >>> 3) & 255) / 256, k = Math.floor(ph), u = ph - k, hp = h * HL - 3, C = LIVE.col;
  if (u < 0.45) {   // 波紋:沿 x 軸前進的短弧(垂直前進方向),每週期換一條車道
    var q = u / 0.45, hk = g2Hash(x + k * 7, y - k * 3, 12), lane = 0.22 + (hk & 7) / 7 * 0.56, cx = 0.2 + q * 0.6;
    var cl = liveOceanCls(idx(x, y)), al = Math.sin(q * 3.14159) * (cl === 3 ? 0.3 : 0.5);
    var a1 = gpt(wCellClamp(x + cx, x, 0.06), wCellClamp(y + lane - 0.14, y, 0.06), hp), a2 = gpt(wCellClamp(x + cx, x, 0.06), wCellClamp(y + lane + 0.14, y, 0.06), hp);
    if (al > 0.03) liveSeg(ctx, gl, a1[0], a1[1], a2[0], a2[1], 1.4, C.wave, al);
  }
  if (((hs >>> 11) % 6) === 0 && LIVE.n < (gl ? LIVE_CAP_GL : LIVE_CAP_C2D)) {   // 閃光:十字
    var b = Math.pow(Math.max(0, Math.sin(time * 2.2 + hs)), 6);
    if (b >= 0.05) {
      var px = wCellClamp(x + ((hs >>> 3) % 10) / 10, x, 0.1), py = wCellClamp(y + ((hs >>> 7) % 10) / 10, y, 0.1), s = 0.07;
      var s1 = gpt(px - s, py, hp), s2 = gpt(px + s, py, hp), s3 = gpt(px, py - s, hp), s4 = gpt(px, py + s, hp);
      liveSeg(ctx, gl, s1[0], s1[1], s2[0], s2[1], 1.4, C.spark, b);
      liveSeg(ctx, gl, s3[0], s3[1], s4[0], s4[1], 1.4, C.spark, b);
    }
  }
}
function liveAnimSwamp(ctx, gl, x, y, time, h) {   // 水窪冒泡:小點上浮,末段放大淡出
  var pd = livePuddle(x, y);
  if (!pd) return;
  var hs = g2Hash(x, y, 52), per = 4.5 + ((hs >>> 8) & 7) * 0.4, ph = time / per + (hs & 255) / 256, u = ph - Math.floor(ph);
  if (u >= 0.3) return;
  var q = u / 0.3, c = gpt(x + pd.u, y + pd.v, h * HL), by = c[1] - q * 5, big = q > 0.75;
  liveSeg(ctx, gl, c[0] - 0.9, by, c[0] + 0.9, by, big ? 3.4 : 2.4, LIVE.col.bub, big ? 0.35 : 0.8 * (1 - q * 0.5));
}
function liveAnimAsh(ctx, gl, x, y, time, h) {
  var hs = g2Hash(x, y, 61), h9 = g2Hash(x, y, 901), C = LIVE.col, bx = gpt(x + 0.5, y + 0.5, h * HL);
  if (h9 % 24 === 0) {   // 一縷細煙:3 段上升、漸粗漸淡,左右輕擺
    var per = 7 + (hs & 3), ph = time / per + ((hs >>> 4) & 255) / 256, u = ph - Math.floor(ph);
    var env = Math.min(1, u / 0.12, (1 - u) / 0.25);
    for (var i = 0; i < 3; i++) {
      var s0 = u * 0.7 + i * 0.09, s1 = s0 + 0.09;
      var xa = bx[0] + Math.sin(s0 * 7 + hs) * 2.2, xb = bx[0] + Math.sin(s1 * 7 + hs) * 2.2;
      liveSeg(ctx, gl, xa, bx[1] - s0 * 30, xb, bx[1] - s1 * 30, 1.2 + s0 * 2.6, C.smoke, env * (1 - s0) * 0.34);
    }
  }
  if (h9 % 40 === 7) {   // 火星:偶爾一點,閃爍上飄
    var pe = 2.4 + (hs & 3) * 0.4, pp = time / pe + ((hs >>> 6) & 255) / 256, uu = pp - Math.floor(pp);
    if (uu < 0.55) {
      var qq = uu / 0.55, fl = 0.5 + 0.5 * Math.sin(time * 31 + hs), al = (1 - qq) * (0.45 + 0.55 * fl);
      var ex = bx[0] + 4 * Math.sin(qq * 4 + hs), ey = bx[1] - 2 - qq * 9;
      liveSeg(ctx, gl, ex - 1.6, ey, ex + 1.6, ey, 3.6, C.glow, al * 0.3);
      liveSeg(ctx, gl, ex - 0.7, ey, ex + 0.7, ey, 1.8, C.ember, al);
    }
  }
}

// ---- 工具列 / 名稱 / 進度條註冊(ui.js 的 const 容器可變;載入順序在 ui.js、progui.js 之後)----
(function liveRegister() {
  if (typeof TERRAIN_TOOLS === 'undefined') return;
  TERRAIN_TOOLS.ocean = { name: '海洋', icon: '🐳', drag: true, tip: '深淺漸層的海,岸邊有白浪、水面有波光;不可走、不可蓋一般建築,船 / 碼頭 / 浮橋等水上物件可放;不結冰' };
  TERRAIN_TOOLS.swamp = { name: '沼澤', icon: '🐸', drag: true, tip: '泥濘水窪,會冒泡;可走(較慢)、可蓋輕量建築,不可種田;冬季水窪結冰' };
  TERRAIN_TOOLS.ashland = { name: '火山灰', icon: '🌋', drag: true, tip: '炭灰黑地,偶有細煙與火星;可走、可蓋、可耕,不可種樹;冬季不積雪' };
  TERRAIN_OF.ocean = T_OCEAN; TERRAIN_OF.swamp = T_SWAMP; TERRAIN_OF.ashland = T_ASHLAND;
  TERRAIN_NAME[T_OCEAN] = '海洋'; TERRAIN_NAME[T_SWAMP] = '沼澤'; TERRAIN_NAME[T_ASHLAND] = '火山灰';
  var at = TERRAIN_MENU.indexOf('river');
  TERRAIN_MENU.splice(at < 0 ? TERRAIN_MENU.length : at + 1, 0, 'ocean', 'swamp', 'ashland');
  if (typeof PUI_TERRAIN_NAME !== 'undefined') { PUI_TERRAIN_NAME.ocean = '海洋'; PUI_TERRAIN_NAME.swamp = '沼澤'; PUI_TERRAIN_NAME.ashland = '火山灰'; }
})();
