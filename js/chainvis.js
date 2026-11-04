// js/chainvis.js — 產業鏈可視化(PLAN_INTERIORS §3 O3 瓶頸圖示 / O9 運輸可視化 / O10 生產視圖)。
// 純視覺:資料全部讀 goods.js 的 goodsProdRows()(狀態輸出,不改結算,也不再乘任何產能係數);不模擬搬運、不存檔。
//  O3:生產建築缺料 ⛔ / 未通路 🛤️ / 庫滿 📦 / 缺礦 ⛰️ 時,頭上畫小圖示;輕點圖示顯示原因並可開庫房鏈條圖(標出缺口)。
//  O9:運轉中的生產建築 → 城主府,沿道路有小點移動(金點 = 產品入庫、藍點 = 原料取出);道路由「城主府周圍道路 BFS」一次算出,每 5 秒刷新。
//  O10:「生產視圖」開關(庫房面板「生產」分頁):加亮全部生產建築的狀態與每小時產出、全畫面略壓暗、流向點加倍。
// 效能:只畫可見範圍;圖示 ≤ CV_ICON_CAP(生產視圖 ≤ CV_VIEW_CAP);流向點 ≤ CV_DOT_CAP;縮放 < 0.5、省電、拍照、錄影(乾淨)、全景、非經營模式一律不畫。
// 掛點:render.js draw() 於 talentPatrolDraw 之後呼叫 chainVisDraw(ov, time);ui.js tapObjectAt 開頭呼叫 chainVisTap(sx, sy)。
// 全域名稱:chainVisDraw chainVisTap chainVisToggle chainVisIsOn chainVisStats chainVisRows chainVisBuildRoad chainVisPathFor chainVisAllowed chainVisReset CV_*
// ES2017;不用 ?. ??。

var CV_ICON_CAP = 16, CV_VIEW_CAP = 40, CV_DOT_CAP = 12, CV_DOT_CAP_VIEW = 24, CV_ZOOM_MIN = 0.5, CV_ROW_SEC = 1, CV_ROAD_SEC = 5, CV_SPEED = 1.6;
var CV_COLORS = { miss: '#d9503f', road: '#d98b2f', full: '#4f8fd6', ore: '#8a6bb8', ok: '#3f9d5a', wait: '#7a7f88' };

var CV = { on: false, rows: [], rowsAt: -1e9, hits: [], road: null, roadAt: -1e9, roadObjs: null, roadN: -1, paths: {}, sprites: {}, pop: null, stats: { ms: 0, avgMs: 0, frames: 0, icons: 0, dots: 0, built: 0 } };

function chainVisReset() { CV.on = false; CV.rows = []; CV.rowsAt = -1e9; CV.hits = []; CV.road = null; CV.roadAt = -1e9; CV.paths = {}; chainVisPopHide(); }
function chainVisIsOn() { return CV.on; }
function chainVisToggle(v) { CV.on = v === undefined ? !CV.on : !!v; return CV.on; }
function chainVisStats() { return CV.stats; }
function chainVisNow() { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }

// 能不能畫(省電 / 拍照 / 錄影乾淨 / 全景 / 縮放太小 / 非經營模式 / 非城主領地都不畫)
function chainVisAllowed() {
  if (typeof game !== 'undefined' && game && game.mode !== 'estate') return false;
  if (typeof isCityOnly === 'function' && !isCityOnly()) return false;
  if (typeof isPowerSave === 'function' && isPowerSave()) return false;
  if (typeof uiIsPhoto === 'function' && uiIsPhoto()) return false;
  if (typeof recCleanActive === 'function' && recCleanActive()) return false;
  if (typeof pano !== 'undefined' && pano && pano.open) return false;
  if (typeof view !== 'undefined' && view && view.zoom < CV_ZOOM_MIN) return false;
  return true;
}

// 資料列快取(每 CV_ROW_SEC 秒重算一次;goodsStatus 本來就每秒才更新)
function chainVisRows(nowMs) {
  if (nowMs - CV.rowsAt >= CV_ROW_SEC * 1000 || nowMs < CV.rowsAt) {
    CV.rowsAt = nowMs;
    try { CV.rows = typeof goodsProdRows === 'function' ? goodsProdRows() : []; } catch (e) { CV.rows = []; }
  }
  return CV.rows;
}

// ───────── O9 道路 BFS:從城主府周圍的道路格向外一次算完,dist / parent(指向城主府方向)─────────
// 道路格 = 地形為路(isRoadLikeTerrain)或 GOODS_ROADLIKE 物件(橋、城門…)所在格,與 goods.js 的通路判定一致
function chainVisBuildRoad(b) {
  if (!b || !b.terrain || !b.objects || typeof isRoadLikeTerrain !== 'function') return null;
  var W = Math.round(Math.sqrt(b.terrain.length)), N = W * W, road = new Uint8Array(N), i, x, y, palace = null, dist = new Int32Array(N), par = new Int32Array(N), q = [], qi = 0;
  for (i = 0; i < N; i++) if (isRoadLikeTerrain(b.terrain[i])) road[i] = 1;
  b.objects.forEach(function (o) {
    if (!OBJECTS[o.type]) return;
    var f;
    if (o.type === 'palace' && !palace) palace = o;
    if (typeof GOODS_ROADLIKE === 'undefined' || GOODS_ROADLIKE.indexOf(o.type) < 0) return;
    f = footprint(o.type, o.rot | 0);
    for (y = o.y; y < o.y + f[1]; y++) for (x = o.x; x < o.x + f[0]; x++) if (x >= 0 && y >= 0 && x < W && y < W) road[y * W + x] = 1;
  });
  if (!palace) return { W: W, road: road, dist: null, par: null, palace: null };
  for (i = 0; i < N; i++) { dist[i] = -1; par[i] = -1; }
  var pf = footprint('palace', palace.rot | 0);
  for (y = palace.y - 1; y <= palace.y + pf[1]; y++) for (x = palace.x - 1; x <= palace.x + pf[0]; x++) {
    if (x < 0 || y < 0 || x >= W || y >= W) continue;
    i = y * W + x;
    if (road[i] && dist[i] < 0) { dist[i] = 0; q.push(i); }
  }
  while (qi < q.length) {
    var c = q[qi++], cx = c % W, cy = (c - cx) / W, nb = [cx > 0 ? c - 1 : -1, cx < W - 1 ? c + 1 : -1, cy > 0 ? c - W : -1, cy < W - 1 ? c + W : -1], k, j;
    for (k = 0; k < 4; k++) { j = nb[k]; if (j >= 0 && road[j] && dist[j] < 0) { dist[j] = dist[c] + 1; par[j] = c; q.push(j); } }
  }
  return { W: W, road: road, dist: dist, par: par, palace: palace };
}
// 某生產建築(row)到城主府的道路格序列 [idx…](由建築端到城主府端);不通回 null
function chainVisPathFor(road, row) {
  if (!road || !road.dist) return null;
  var W = road.W, best = -1, bd = 1e9, x, y, i, out = [], c;
  for (y = row.y - 1; y <= row.y + row.h; y++) for (x = row.x - 1; x <= row.x + row.w; x++) {
    if (x < 0 || y < 0 || x >= W || y >= W) continue;
    i = y * W + x;
    if (road.dist[i] >= 0 && road.dist[i] < bd) { bd = road.dist[i]; best = i; }
  }
  if (best < 0) return null;
  for (c = best; c >= 0 && out.length < 400; c = road.par[c]) out.push(c);
  return out;
}
function chainVisRoadGet(nowMs) {
  var b = typeof estateBoard === 'function' ? estateBoard() : null;
  if (!b || !b.objects) return null;
  if (!CV.road || nowMs - CV.roadAt >= CV_ROAD_SEC * 1000 || nowMs < CV.roadAt || CV.roadObjs !== b.objects || CV.roadN !== b.objects.length) {
    CV.road = chainVisBuildRoad(b); CV.roadAt = nowMs; CV.roadObjs = b.objects; CV.roadN = b.objects.length; CV.paths = {};
    CV.stats.built++;
  }
  return CV.road;
}

// ───────── 圖示 sprite(離屏畫布,每種原因一張,畫一次)─────────
function chainVisSprite(kind) {
  var s = CV.sprites[kind], dpr, sz, cv, cx, ic;
  if (s !== undefined) return s;
  CV.sprites[kind] = null;
  if (typeof document === 'undefined' || !document.createElement) return null;
  try {
    dpr = Math.min(2, (typeof viewport !== 'undefined' && viewport.dpr) || 1);
    sz = Math.round(32 * dpr);
    cv = document.createElement('canvas'); cv.width = sz; cv.height = sz;
    cx = cv.getContext('2d');
    if (!cx) return null;
    cx.fillStyle = 'rgba(20,24,32,.88)'; cx.beginPath(); cx.arc(sz / 2, sz / 2, sz / 2 - 1, 0, 6.2832); cx.fill();
    cx.lineWidth = Math.max(2, sz / 10); cx.strokeStyle = CV_COLORS[kind] || '#888'; cx.stroke();
    ic = typeof GOODS_CAUSE_ICON !== 'undefined' && GOODS_CAUSE_ICON[kind] ? GOODS_CAUSE_ICON[kind] : (kind === 'ok' ? '✔' : '…');
    cx.font = Math.round(sz * 0.55) + 'px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    if (kind === 'ok') cx.fillStyle = CV_COLORS.ok;
    cx.fillText(ic, sz / 2, sz / 2 + sz * 0.04);
    CV.sprites[kind] = cv;
    return cv;
  } catch (e) { return null; }
}

function chainVisCull(sx, sy, m) {
  var w = typeof viewport !== 'undefined' ? viewport.w : 1e5, h = typeof viewport !== 'undefined' ? viewport.h : 1e5;
  return sx < -m || sy < -m || sx > w + m || sy > h + m;
}
// 取前 cap 個「畫得到」的列(問題優先;view 時含正常列)
function chainVisPick(rows, view, cap, project) {
  var out = [], i, r, sc;
  for (i = 0; i < rows.length && out.length < cap; i++) {
    r = rows[i];
    if (!view && !r.causes.length) continue;
    sc = project(r);
    if (!sc || chainVisCull(sc[0], sc[1], 30)) continue;
    out.push({ row: r, sx: sc[0], sy: sc[1] });
  }
  return out;
}

function chainVisDraw(ctx, time) {
  var t0, rows, nowMs, picks, i, p, sz, spr, z, bob, road, nd = 0, cap, gold = [], blue = [];
  if (!ctx || !chainVisAllowed()) { CV.hits.length = 0; return; }
  t0 = chainVisNow();
  nowMs = typeof time === 'number' ? time : t0;
  rows = chainVisRows(t0);
  if (!rows.length) { CV.hits.length = 0; return; }
  z = view.zoom;
  var project = function (r) {
    var cx = r.x + r.w / 2, cy = r.y + r.h / 2, s = worldToScreen(isoX(cx, cy), isoY(cx, cy, 2.4 + Math.max(r.w, r.h) * 0.3));
    return s;
  };
  ctx.save();
  ctx.setTransform(viewport.dpr || 1, 0, 0, viewport.dpr || 1, 0, 0);   // 此時 ctx 還是世界座標變換;改用螢幕座標(CSS px)繪製
  if (CV.on) { ctx.fillStyle = 'rgba(10,14,22,.28)'; ctx.fillRect(0, 0, viewport.w, viewport.h); }
  // O9 流向點
  cap = CV.on ? CV_DOT_CAP_VIEW : CV_DOT_CAP;
  if (z >= 0.7) {
    road = chainVisRoadGet(t0);
    if (road && road.dist) {
      for (i = 0; i < rows.length && nd < cap; i++) {
        var r = rows[i], path, key = r.key, nDots, k, len, ph, a, bI, f, gx, gy, sc2, wh, sec = nowMs / 1000, h2;
        if (!(r.perHour > 0) || r.state === 'wait' || (r.kind === 'rec' && !r.conn)) continue;
        path = CV.paths[key];
        if (path === undefined) path = CV.paths[key] = chainVisPathFor(road, r);
        if (!path || path.length < 2) continue;
        len = path.length - 1;
        nDots = Math.min(2, Math.max(1, Math.ceil(len / 10)));
        for (k = 0; k < nDots && nd < cap; k++) {
          // 產品:建築 → 城主府(金);rec 另有原料:城主府 → 建築(藍)
          for (var dir = 0; dir < (r.kind === 'rec' ? 2 : 1) && nd < cap; dir++) {
            ph = (sec * CV_SPEED + k * (len / nDots) + (r.x * 7 + r.y * 13) % 5 + dir * len * 0.5) % len;
            if (dir === 1) ph = len - ph;
            a = Math.floor(ph); bI = Math.min(len, a + 1); f = ph - a;
            gx = (path[a] % road.W) + 0.5 + (((path[bI] % road.W) - (path[a] % road.W)) * f);
            gy = Math.floor(path[a] / road.W) + 0.5 + ((Math.floor(path[bI] / road.W) - Math.floor(path[a] / road.W)) * f);
            h2 = (typeof world !== 'undefined' && world.height && world.height.length === road.W * road.W) ? world.height[path[a]] : 0;
            sc2 = worldToScreen(isoX(gx, gy), isoY(gx, gy, h2 || 0));
            if (chainVisCull(sc2[0], sc2[1], 10)) continue;
            (dir === 0 ? gold : blue).push(sc2[0], sc2[1]);
            nd++;
          }
        }
      }
      wh = Math.max(2, Math.min(4.5, 3 * z));
      [[gold, '#ffd24a'], [blue, '#8ec8ff']].forEach(function (g) {
        if (!g[0].length) return;
        ctx.fillStyle = g[1]; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (var q = 0; q < g[0].length; q += 2) { ctx.moveTo(g[0][q] + wh, g[0][q + 1]); ctx.arc(g[0][q], g[0][q + 1], wh, 0, 6.2832); }
        ctx.fill(); ctx.stroke();
      });
    }
  }
  // O3 / O10 圖示
  picks = chainVisPick(rows, CV.on, CV.on ? CV_VIEW_CAP : CV_ICON_CAP, project);
  sz = Math.max(22, Math.min(36, 30 * Math.sqrt(z)));
  CV.hits.length = 0;
  bob = Math.sin(nowMs / 400) * 1.5;
  for (i = 0; i < picks.length; i++) {
    p = picks[i];
    var kind = p.row.cause;
    if (kind === 'wait') { if (!CV.on) continue; }
    spr = chainVisSprite(kind);
    if (spr) {
      ctx.globalAlpha = p.row.level >= 2 ? 1 : 0.9;
      ctx.drawImage(spr, p.sx - sz / 2, p.sy - sz / 2 + (p.row.causes.length ? bob : 0), sz, sz);
    }
    if (CV.on && z >= 0.8 && p.row.perHour > 0) {
      ctx.globalAlpha = 1;
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.fillStyle = '#fff';
      var tx = p.row.outIcon + p.row.perHour + '/時';
      ctx.strokeText(tx, p.sx, p.sy + sz / 2 + 9); ctx.fillText(tx, p.sx, p.sy + sz / 2 + 9);
    }
    CV.hits.push({ x: p.sx, y: p.sy, r: sz / 2 + 6, row: p.row });
  }
  ctx.restore();
  t0 = chainVisNow() - t0;
  CV.stats.ms = t0; CV.stats.frames++; CV.stats.icons = picks.length; CV.stats.dots = nd;
  CV.stats.avgMs += (t0 - CV.stats.avgMs) * 0.05;
}

// ───────── 點擊:顯示原因(小卡)─────────
function chainVisTap(sx, sy) {
  var i, h, best = null, bd = 1e9, dx, dy, d;
  if (!CV.hits.length || !chainVisAllowed()) { chainVisPopHide(); return false; }
  for (i = 0; i < CV.hits.length; i++) {
    h = CV.hits[i]; dx = sx - h.x; dy = sy - h.y; d = dx * dx + dy * dy;
    if (d <= h.r * h.r && d < bd) { bd = d; best = h; }
  }
  if (!best) return false;
  chainVisPopShow(best.row);
  return true;
}
function chainVisPopShow(row) {
  var box = CV.pop, html;
  if (typeof document === 'undefined' || !document.createElement || !document.body) return null;
  if (!box) {
    box = CV.pop = document.createElement('div');
    box.id = 'chainVisPop';
    box.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);width:min(320px,calc(100vw - 32px));box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #e6b84a;background:rgba(40,30,22,0.95);color:#f4ead2;font:14px/1.5 sans-serif;z-index:61;display:none';
    box.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-cv]') : null, a = t && t.getAttribute('data-cv');
      if (!a) return;
      if (a === 'chain' && typeof goodsOpenChain === 'function') goodsOpenChain(t.getAttribute('data-id'), t.getAttribute('data-m'));
      chainVisPopHide();
    });
    document.body.appendChild(box);
  }
  html = '<div><b>' + (row.icon || '') + ' ' + goodsEsc(row.name) + ' → ' + (row.outIcon || '') + goodsEsc(row.outName) + '</b>' + (row.perHour > 0 ? ' <small>' + row.perHour + ' /時</small>' : '') + '</div>' +
    '<div style="margin:6px 0">' + (GOODS_CAUSE_ICON[row.cause] || '') + ' ' + goodsEsc(row.reason) + '</div>' +
    '<span data-cv="chain" data-id="' + row.out + '" data-m="' + (row.miss || '') + '" style="cursor:pointer;color:#e6b84a;margin-right:14px">開鏈條圖</span><span data-cv="close" style="cursor:pointer;opacity:.7">關閉</span>';
  box.innerHTML = html;
  box.style.display = 'block';
  if (CV.popTimer) clearTimeout(CV.popTimer);
  CV.popTimer = setTimeout(chainVisPopHide, 20000);
  return box;
}
function chainVisPopHide() { if (CV.pop) CV.pop.style.display = 'none'; }
