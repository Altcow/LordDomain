// js/wmap_army.js — M1 W4 軍隊模型與行軍層(設計_軍隊模型與旗幟_規格.md 1.3、2.1、2.7、3.2、4.1、4.2;設計_M1視覺原型_實作計畫.md 3.6、W4)。
// 做什麼:把行程陣列 {id, side, tag, path[], t0, goMs, backMs, state} 變成「這一刻每隊在世界座標的哪裡、朝哪個方向、第幾幀、什麼旗」,
//        並用單一 canvas 行軍層畫出來(旗手領隊 + 4 步卒方陣;畫質高 / 中 6 Hz 連續平移,低 / 省電 1 Hz 跳位 + 站立幀)。
// 位置不存檔:只由 t0 / goMs / backMs / path 與 now 內插(與規格 4.7 armyPose 同介面)。pose / build 不碰 DOM、不讀時間(now 由呼叫端傳),node 可測。
// 命名:全域一律 wmapArmy* / WMAP_ARMY*(舊外勤已佔 wm_*.js、WM_CFG、wmNorm…);ES2017,不用 ?. ??;UTF-8 + CRLF。
// 載入順序:wm_gen.js(可選,只為預設 size)→ wmap_proj.js(可選,有就用它的投影)→ wmap_army_art.js → wmap_army.js。尚未加入 index.html / sw.js(W7 整合時再加)。
//   wmapArmyAttach(o) → handle|null   掛到 W1 畫面層(WMAP.on 之後):在 WMAP.vp 內加一張行軍 canvas,跟著 WMAP.cam / WMAP.G 同步(包住 wmapFrame,拖曳 / 縮放同一幀重畫);handle = {layer, sync(), detach()};o = {trips, q, nowFn}
//
// ───────── 公開 API ─────────
//   WMAP_ARMY_CFG   參數:fightMs 3000(抵達交戰徽章時間)、tickMs{high 167, mid 167, low 1000}、flagMs 333、fanR、laneW、hitMin 40、maxLive 40 …
//   wmapArmyProj(c, r, s, size) → {x, y}   格座標 → 世界 px(格中心 = 整數):已接 W1 wmap_proj.js(有載入就用 wmapGeom + wmapUV2World(G, c + 0.5, r + 0.5));沒載入 = 暫時投影(斜角規格 1.1:x=(c−r)·s,y=(c+r)·s/2)
//   WMAP_ARMY       外掛點:WMAP_ARMY.proj = function (c, r, s, size) → {x, y} 可整個覆蓋投影;WMAP_ARMY.att = wmapArmyAttach 的掛載中控制器
//   wmapArmyDirOf(dc, dr, prevMir) → {dir:0|1, mir:0|1}                 格移動 → 視覺方向(規格 2.1 表;斜走 / 沒上一段時沿用 prevMir)
//   wmapArmyPose(trip, now, o) → pose                                   o = {size, q:'high'|'mid'|'low'};pose = {vis, phase:'go'|'fight'|'back'|'wait'|'done', c, r(格座標,浮點), dir, mir, alpha, rolled, moving, vx, vy(畫面方向 單位向量)}
//   wmapArmyBuild(trips, now, o) → items[]                              o = {size, s(格邊 px:44/64/104), q, view:{x,y,w,h}(世界 px,可空 = 不裁切), sel(選取 id), seed}
//        item = {id, side, tag, x, y(腳底世界 px), s, dir, mir, fr(0~3 走 / 4 站), wave(0|1), alpha, rolled, phase, ring:'own'|'raid'|null, sel, n(×N 數,0 = 無), box:[x0,y0,x1,y1], z}
//        已依「腳底 y 由上到下、己方最後」排好畫圖順序(同 z 時)。
//   wmapArmyDraw(g, items, o)                                           o = {camX, camY(世界原點的畫面位置), s, dpr, q};用 wmap_army_art.js 的快取圖畫;無 art(node)時略過
//   wmapArmyHit(items, px, py, o) → [id…]                               命中(畫面座標,由上而下),模型框最小 40×40;o = {camX, camY}
//   wmapArmyLayer(canvas, opts) → layer                                 行軍層控制器:layer.setTrips(a) setCam(x,y) setView(w,h,s) setQuality(q) setSel(id) start() stop() redraw(now?) hit(px,py) items
//   wmapArmyFrameOf(now, q, salt) → 0..4;wmapArmyTickMs(q) → ms;wmapArmySeat(n) → '#rrggbb'
// 假行程範例:{ id:'t1', side:'own', tag:1, path:[gi…轉折點], t0:毫秒, goMs:去程毫秒, backMs:回程毫秒, state:'go' }
//   state:'go'(預設:去程 → 抵達交戰 → 回程,全由 t0 推)| 'back'(只回程,t0 = 回程起點,path 已是要回走的線的「去程方向」)| 'wait'(待發,站在 path[0])| 'done'(不畫)

var WMAP_ARMY_CFG = {
  frame: 192, ax: 0.5, ay: 0.86,               // 原圖每幀 / 錨點(腳底中心)
  fightMs: 3000, tickMs: { high: 167, mid: 167, low: 1000 }, flagMs: 333,
  fanR: 0.22, fanMax: 5, laneW: 0.1,           // 同格停留扇形半徑(格)、同路錯開間距(× s)
  hitMin: 40, maxLive: 40, backAlpha: 0.6, view: 1.2
};
var WMAP_ARMY = { proj: null, att: null, hooked: false };

// 格座標 (c, r)(整數 = 格中心,浮點 = 之間)→ 世界 px。優先序:WMAP_ARMY.proj 外掛 > W1 的 wmap_proj.js(wmapGeom + wmapUV2World,格中心 = c + 0.5)> 暫時投影(斜角規格 1.1 公式,原點不偏移)
var WMAP_ARMY_GEO = {};
function wmapArmyProj(c, r, s, size) {
  if (WMAP_ARMY.proj) return WMAP_ARMY.proj(c, r, s, size);
  if (typeof wmapGeom === 'function' && typeof wmapUV2World === 'function') {
    var k = s + ':' + size, G = WMAP_ARMY_GEO[k] || (WMAP_ARMY_GEO[k] = wmapGeom(s, size));
    return wmapUV2World(G, c + 0.5, r + 0.5);
  }
  return { x: (c - r) * s, y: (c + r) * s * 0.5 };
}
function wmapArmyTickMs(q) { return q === 'low' ? WMAP_ARMY_CFG.tickMs.low : WMAP_ARMY_CFG.tickMs.mid; }
// 走路幀 0~3(低畫質 = 站立幀 4);salt 讓各隊步伐錯開
function wmapArmyFrameOf(now, q, salt) {
  if (q === 'low') return 4;
  return (Math.floor(now / WMAP_ARMY_CFG.tickMs.mid) + (salt | 0)) & 3;
}
function wmapArmySeat(n) { return (typeof wmapArmyArtSeatColor === 'function') ? wmapArmyArtSeatColor(n) : '#888888'; }

// ───────── 方向表(規格 2.1)─────────
// c+1 ↘ 前斜 / r+1 ↙ 前斜鏡像 / c−1 ↖ 後斜鏡像 / r−1 ↗ 後斜 / (+1,+1) ↓ 前斜沿用 / (−1,−1) ↑ 後斜沿用 / (+1,−1) → 前斜 / (−1,+1) ← 前斜鏡像
function wmapArmyDirOf(dc, dr, prevMir) {
  var ac = Math.abs(dc), ar = Math.abs(dr), sc, sr;
  sc = ac < ar * 0.5 ? 0 : (dc > 0 ? 1 : -1);        // 容許非標準向量:較小一軸 < 一半視為 0
  sr = ar < ac * 0.5 ? 0 : (dr > 0 ? 1 : -1);
  var pm = prevMir ? 1 : 0;
  if (sc === 1 && sr === 0) return { dir: 0, mir: 0 };
  if (sc === 0 && sr === 1) return { dir: 0, mir: 1 };
  if (sc === -1 && sr === 0) return { dir: 1, mir: 1 };
  if (sc === 0 && sr === -1) return { dir: 1, mir: 0 };
  if (sc === 1 && sr === 1) return { dir: 0, mir: pm };
  if (sc === -1 && sr === -1) return { dir: 1, mir: pm };
  if (sc === 1 && sr === -1) return { dir: 0, mir: 0 };
  if (sc === -1 && sr === 1) return { dir: 0, mir: 1 };
  return { dir: 0, mir: pm };
}

// ───────── 路徑前處理(快取在 trip._wp)─────────
function wmapArmyLine(cs, rs) {
  var n = cs.length, cum = [0], dirs = [], i, len = 0, pm = 0, last = { dir: 0, mir: 0 }, dc, dr, d, L;
  for (i = 0; i + 1 < n; i++) {
    dc = cs[i + 1] - cs[i]; dr = rs[i + 1] - rs[i];
    L = Math.sqrt(dc * dc + dr * dr); len += L; cum.push(len);
    if (L < 1e-9) { dirs.push(last); continue; }
    d = wmapArmyDirOf(dc, dr, pm); pm = d.mir; last = d;
    d = { dir: d.dir, mir: d.mir, dc: dc / L, dr: dr / L }; last = d; dirs.push(d);
  }
  return { c: cs, r: rs, cum: cum, len: len, dirs: dirs, last: dirs.length ? dirs[dirs.length - 1] : { dir: 0, mir: 0, dc: 1, dr: 0 } };
}
function wmapArmyPrep(trip, size) {
  var P = trip._wp, p = trip.path, n, i, gi, cs = [], rs = [];
  if (P && P.src === p && P.size === size && P.n === (p ? p.length : 0)) return P;
  if (!p || !p.length) { trip._wp = null; return null; }
  n = p.length;
  for (i = 0; i < n; i++) { gi = p[i]; cs.push(gi % size); rs.push((gi - gi % size) / size); }
  var rc = cs.slice().reverse(), rr = rs.slice().reverse();
  P = { src: p, size: size, n: n, f: wmapArmyLine(cs, rs), b: wmapArmyLine(rc, rr) };
  trip._wp = P;
  return P;
}
// 沿線 frac(0~1)→ {c, r, dir, mir, dc, dr}
function wmapArmyAlong(L, frac) {
  var n = L.c.length, d, i, a, f;
  if (n === 1 || L.len <= 0) return { c: L.c[0], r: L.r[0], dir: L.last.dir, mir: L.last.mir, dc: L.last.dc || 1, dr: L.last.dr || 0 };
  if (frac <= 0) frac = 0; else if (frac >= 1) frac = 1;
  d = frac * L.len;
  i = 0; while (i + 2 < n && L.cum[i + 1] <= d) i++;   // 轉折點很少(≤ 10),線性掃
  a = L.cum[i + 1] - L.cum[i]; f = a > 0 ? (d - L.cum[i]) / a : 0;
  var sd = L.dirs[i];
  return { c: L.c[i] + (L.c[i + 1] - L.c[i]) * f, r: L.r[i] + (L.r[i + 1] - L.r[i]) * f, dir: sd.dir, mir: sd.mir, dc: sd.dc || 0, dr: sd.dr || 0 };
}

// ───────── 位姿(規格 4.7 armyPose)─────────
function wmapArmyPose(trip, now, o) {
  if (trip.lg && typeof wmMarchPose === 'function') return wmMarchPose(trip, now, o);   // 帶航段 lg 的行程(wmap_go.js):位置由 wm_march.js 的純函式決定(停止 / 閒置 / 撤退)
  o = o || {};
  var size = o.size || ((typeof WMG_CFG !== 'undefined') ? WMG_CFG.size : 64), q = o.q || 'mid';
  var P = wmapArmyPrep(trip, size), st = trip.state || 'go';
  var out = { vis: false, phase: 'done', c: 0, r: 0, dir: 0, mir: 0, alpha: 1, rolled: false, moving: false, dc: 1, dr: 0 };
  if (!P || st === 'done') return out;
  var t = q === 'low' ? Math.floor(now / 1000) * 1000 : now;   // 低畫質每秒跳位
  var el = t - (trip.t0 || 0), go = trip.goMs || 0, back = trip.backMs || 0, fight = trip.fightMs !== undefined ? trip.fightMs : WMAP_ARMY_CFG.fightMs;
  var A, line = P.f, frac = 0;
  out.vis = true;
  if (st === 'wait' || (st === 'go' && el < 0)) {
    out.phase = 'wait'; A = wmapArmyAlong(P.f, 0);
  } else if (st === 'back') {
    if (el >= back) { out.vis = false; return out; }
    out.phase = 'back'; out.rolled = true; out.alpha = WMAP_ARMY_CFG.backAlpha; out.moving = back > 0;
    A = wmapArmyAlong(P.b, back > 0 ? el / back : 1);
  } else if (el < go) {
    out.phase = 'go'; out.moving = true; A = wmapArmyAlong(P.f, go > 0 ? el / go : 1);
  } else if (el < go + fight) {
    out.phase = 'fight'; A = wmapArmyAlong(P.f, 1);
  } else if (back > 0 && el < go + fight + back) {
    out.phase = 'back'; out.rolled = true; out.alpha = WMAP_ARMY_CFG.backAlpha; out.moving = true;
    A = wmapArmyAlong(P.b, (el - go - fight) / back);
  } else { out.vis = false; return out; }
  out.c = A.c; out.r = A.r; out.dir = A.dir; out.mir = A.mir; out.dc = A.dc; out.dr = A.dr;
  return out;
}

// ───────── 建圖(每次更新)─────────
function wmapArmyHash(str) {
  var h = 0, i, s = String(str);
  for (i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h & 0xffff;
}
function wmapArmyBuild(trips, now, o) {
  o = o || {};
  var C = WMAP_ARMY_CFG, s = o.s || 64, q = o.q || 'mid', size = o.size || ((typeof WMG_CFG !== 'undefined') ? WMG_CFG.size : 64);
  var view = o.view, mg = s * C.view, items = [], i, n = trips ? trips.length : 0, t, p, pt, it, wave;
  var qt = q === 'low' ? Math.floor(now / 1000) * 1000 : now;
  wave = (q === 'low') ? 0 : (Math.floor(now / C.flagMs) & 1);
  var D = s;
  for (i = 0; i < n; i++) {
    t = trips[i]; if (!t) continue;
    p = wmapArmyPose(t, now, { size: size, q: q });
    if (!p.vis) continue;
    pt = wmapArmyProj(p.c, p.r, s, size);
    if (view && (pt.x < view.x - mg || pt.x > view.x + view.w + mg || pt.y < view.y - mg * 0.5 || pt.y > view.y + view.h + mg * 1.8)) continue;
    var salt = t._salt !== undefined ? t._salt : (t._salt = wmapArmyHash(t.id));
    var side = t.side || 'own', stand = !p.moving || q === 'low';
    it = {
      id: t.id, side: side, tag: t.tag, x: pt.x, y: pt.y, s: s, dir: p.dir, mir: p.mir,
      fr: stand ? 4 : wmapArmyFrameOf(now, q, salt), wave: wave, alpha: p.alpha, rolled: p.rolled, phase: p.phase, moving: p.moving,
      ring: side === 'own' ? 'own' : (side === 'raid' ? 'raid' : null), sel: o.sel !== undefined && o.sel === t.id, n: 0,
      z: side === 'own' ? 1 : 0, dc: p.dc, dr: p.dr, loot: !!t.loot, box: null, cx: p.c, cy: p.r
    };
    items.push(it);
  }
  wmapArmySpread(items, s);
  var m = items.length, bw = Math.max(D, C.hitMin), bh = bw;
  for (i = 0; i < m; i++) {   // 命中框:模型框 s×s、錨點 (0.5, 0.86),最小 40×40
    it = items[i]; var cx = it.x, cy = it.y - D * (C.ay - 0.5);
    it.box = [cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2];
  }
  // 上限:超過 maxLive 時,依己方 > 來襲 > 同盟 > 敵方、離視窗中心近者優先;其餘只畫站立幀(不砍,規格 4.2)
  if (m > C.maxLive) {
    var rank = { own: 0, raid: 1, ally: 2, foe: 3 }, mx = view ? view.x + view.w / 2 : 0, my = view ? view.y + view.h / 2 : 0, ord = items.slice();
    ord.sort(function (a, b) { var ra = rank[a.side] || 3, rb = rank[b.side] || 3; if (ra !== rb) return ra - rb; return (Math.abs(a.x - mx) + Math.abs(a.y - my)) - (Math.abs(b.x - mx) + Math.abs(b.y - my)); });
    for (i = C.maxLive; i < ord.length; i++) ord[i].fr = 4;
  }
  items.sort(function (a, b) { return a.z !== b.z ? a.z - b.z : (a.y - b.y); });   // 己方最後畫(最上層);其餘腳底 y 小的先畫
  return items;
}
// 同格多隊:停留中 → 扇形 5 槽(> 5 隊畫前 4 + ×N);行進中同格 → 沿畫面法向錯開(laneW × s)
function wmapArmySpread(items, s) {
  var m = items.length, i, g = {}, key, k, arr, j, it, C = WMAP_ARMY_CFG;
  if (m < 2) return;
  for (i = 0; i < m; i++) {
    it = items[i]; key = (Math.round(it.cy) * 4096 + Math.round(it.cx)) + (it.moving ? 'm' : 's');
    (g[key] || (g[key] = [])).push(it);
  }
  for (k in g) {
    arr = g[k]; if (arr.length < 2) continue;
    if (arr[0].moving) {
      for (j = 0; j < arr.length; j++) {   // 法向:畫面方向 (sx, sy) = ((dc−dr)·s, (dc+dr)·s/2) 的垂直
        it = arr[j];
        var sx = (it.dc - it.dr), sy = (it.dc + it.dr) * 0.5, L = Math.sqrt(sx * sx + sy * sy) || 1, off = (j - (arr.length - 1) / 2) * C.laneW * s;
        it.x += (-sy / L) * off; it.y += (sx / L) * off;
      }
    } else {
      var keep = Math.min(arr.length, C.fanMax), cap = arr.length > C.fanMax ? C.fanMax - 1 : arr.length;
      for (j = 0; j < arr.length; j++) {
        it = arr[j];
        if (j >= cap) { it.fr = -1; continue; }   // 標記隱藏(下面移除)
        var ang = (j * 2 * Math.PI / keep) - Math.PI / 2;
        it.x += Math.cos(ang) * C.fanR * s * 2; it.y += Math.sin(ang) * C.fanR * s;
      }
      if (arr.length > C.fanMax) arr[cap - 1].n = arr.length - cap + 1;
    }
  }
  for (i = m - 1; i >= 0; i--) if (items[i].fr === -1) items.splice(i, 1);
}

// ───────── 命中 ─────────
function wmapArmyHit(items, px, py, o) {
  o = o || {};
  var cx = o.camX || 0, cy = o.camY || 0, out = [], i, b, it, x = px - cx, y = py - cy;
  for (i = items.length - 1; i >= 0; i--) {   // 最後畫的在最上層,先回報
    it = items[i]; b = it.box;
    if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) out.push(it.id);
  }
  return out;
}

// ───────── 繪製 ─────────
function wmapArmyDraw(g, items, o) {
  o = o || {};
  var sheet = (typeof wmapArmyArtSheet === 'function') ? wmapArmyArtSheet() : null, cx = o.camX || 0, cy = o.camY || 0, q = o.q || 'mid';
  if (!sheet || !g) return 0;
  var F = sheet.F, C = WMAP_ARMY_CFG, i, it, D, x, y, k, fl, bd, drawn = 0, tp, scale, px, py, pulse = (q === 'high') ? (0.5 + 0.5 * Math.sin((o.now || 0) / 500 * Math.PI)) : 1;
  for (i = 0; i < items.length; i++) {
    it = items[i]; D = it.s; x = it.x + cx; y = it.y + cy; scale = D / F;
    // 腳環:己方金環 / 來襲紅環 / 選取白環(規格 3.1、2.2)
    if (it.ring || it.sel) {
      g.save(); g.globalAlpha = it.alpha; g.lineWidth = Math.max(2.5, D * 0.05);
      g.strokeStyle = '#4A2A14'; g.beginPath(); g.ellipse(x, y + D * 0.02, D * 0.4, D * 0.125, 0, 0, 6.2832); g.stroke();
      g.lineWidth = Math.max(1.5, D * 0.028);
      g.strokeStyle = it.sel ? '#ffffff' : (it.ring === 'raid' ? 'rgba(235,40,40,' + (0.55 + 0.45 * pulse) + ')' : '#E8B923');
      g.beginPath(); g.ellipse(x, y + D * 0.02, D * 0.4, D * 0.125, 0, 0, 6.2832); g.stroke();
      g.restore();
    }
    g.save(); g.globalAlpha = it.alpha;
    g.translate(x, y);
    if (it.mir) g.scale(-1, 1);
    g.drawImage(sheet.canvas, it.fr * F, it.dir * F, F, F, -D * C.ax, -D * C.ay, D, D);
    g.restore();
    // 旗布:不跟著鏡像(數字不反字),掛點取旗杆頂座標
    tp = sheet.poleTop[it.dir][it.fr] || sheet.poleTop[it.dir][4];
    px = (tp.x - F * C.ax) * scale; py = (tp.y - F * C.ay) * scale;
    if (it.mir) px = -px;
    fl = wmapArmyArtFlag(it.side, it.tag, it.mir, it.rolled, it.wave);
    if (fl) {
      g.save(); g.globalAlpha = it.alpha;
      g.drawImage(fl.canvas, x + px - fl.hx * scale, y + py - fl.hy * scale + 14 * scale, fl.canvas.width * scale, fl.canvas.height * scale);
      g.restore();
    }
    // 徽章:交戰 / 待發 / 戰利袋(旗杆旁上方)
    bd = it.phase === 'fight' ? 'fight' : (it.phase === 'wait' ? 'wait' : ((it.phase === 'back' && it.loot) ? 'bag' : null));
    if (bd) { var bc = wmapArmyArtBadge(bd); if (bc) g.drawImage(bc, x - D * 0.17, y - D * 0.86 - D * 0.1, D * 0.34, D * 0.34); }
    if (it.n > 0) {   // ×N
      g.save(); g.font = 'bold ' + Math.max(10, Math.round(D * 0.2)) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 3; g.strokeStyle = '#4A2A14'; g.fillStyle = '#F4EBD0'; g.strokeText('×' + it.n, x + D * 0.3, y - D * 0.1); g.fillText('×' + it.n, x + D * 0.3, y - D * 0.1); g.restore();
    }
    drawn++;
  }
  return drawn;
}

// ───────── 行軍層控制器(單一 canvas、6 Hz / 1 Hz 時鐘、沒隊伍在視窗內降頻檢查)─────────
function wmapArmyLayer(canvas, opts) {
  opts = opts || {};
  var L = {
    canvas: canvas, g: canvas ? canvas.getContext('2d') : null, trips: [], items: [], camX: 0, camY: 0, w: 0, h: 0, s: opts.s || 64, q: opts.q || 'mid', sel: null,
    size: opts.size || ((typeof WMG_CFG !== 'undefined') ? WMG_CFG.size : 64), dpr: 1, timer: 0, idle: false, running: false, nowFn: opts.nowFn || null, stats: { builds: 0, lastMs: 0 }
  };
  function now() { return L.nowFn ? L.nowFn() : ((typeof ldNow === 'function') ? ldNow() : Date.now()); }
  L.setTrips = function (a) { L.trips = a || []; };
  L.setCam = function (x, y) { L.camX = x; L.camY = y; };
  L.setSel = function (id) { L.sel = id; };
  L.setView = function (w, h, s) {
    L.w = w; L.h = h; if (s) L.s = s;
    var dpr = L.q === 'low' ? 1 : Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    L.dpr = dpr;
    if (canvas) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
  };
  L.setQuality = function (q) { L.q = q === 'low' || q === 'high' ? q : 'mid'; if (L.w) L.setView(L.w, L.h, L.s); if (L.running) { L.stop(); L.start(); } };
  L.redraw = function (tNow) {
    var t0 = (typeof performance !== 'undefined') ? performance.now() : 0, tn = tNow === undefined ? now() : tNow;
    var view = { x: -L.camX, y: -L.camY, w: L.w, h: L.h };
    L.items = wmapArmyBuild(L.trips, tn, { size: L.size, s: L.s, q: L.q, view: view, sel: L.sel });
    if (L.g) {
      L.g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0); L.g.clearRect(0, 0, L.w, L.h);
      wmapArmyDraw(L.g, L.items, { camX: L.camX, camY: L.camY, q: L.q, now: tn });
    }
    L.idle = L.items.length === 0;
    L.stats.builds++; L.stats.lastMs = (typeof performance !== 'undefined') ? performance.now() - t0 : 0;
    return L.items.length;
  };
  L.hit = function (px, py) { return wmapArmyHit(L.items, px, py, { camX: L.camX, camY: L.camY }); };
  L.start = function () {
    if (L.running) return; L.running = true;
    var step = function () {
      if (!L.running) return;
      if (L.alive && !L.alive()) { L.running = false; return; }   // 畫面層已卸載
      if (typeof document !== 'undefined' && document.hidden) { L.timer = setTimeout(step, 1000); return; }   // 頁面隱藏 → 不畫
      L.redraw();
      L.timer = setTimeout(step, L.idle ? 1000 : wmapArmyTickMs(L.q));                                          // 視窗內沒隊伍 → 降成 1 Hz 偵測、不出幀
    };
    step();
  };
  L.stop = function () { L.running = false; if (L.timer) { clearTimeout(L.timer); L.timer = 0; } };
  return L;
}

// ───────── 接 W1 畫面層(wmap_view.js):不改 W1 檔,只在它的 viewport 內加 canvas、包住 wmapFrame ─────────
function wmapArmyAttach(o) {
  o = o || {};
  if (typeof WMAP === 'undefined' || !WMAP.on || !WMAP.vp || typeof document === 'undefined' || WMAP_ARMY.att) return null;
  var cv = document.createElement('canvas'), H = { canvas: cv, layer: null }, last = '';
  cv.className = 'wmap-army'; cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:5';
  WMAP.vp.appendChild(cv);
  var L = wmapArmyLayer(cv, { s: WMAP.G.s, q: o.q || 'mid', size: WMAP.N, nowFn: o.nowFn });
  L.alive = function () { return WMAP.on && cv.parentNode; };
  H.layer = L;
  H.sync = function (redraw) {
    var p = wmapCamPx(WMAP.G, WMAP.cam, WMAP.vw, WMAP.vh), sig = WMAP.vw + 'x' + WMAP.vh + 's' + WMAP.G.s;
    L.size = WMAP.N;
    if (sig !== last) { last = sig; L.setView(WMAP.vw, WMAP.vh, WMAP.G.s); }
    L.setCam(-p.px, -p.py);
    if (redraw) L.redraw();
  };
  H.detach = function () { L.stop(); if (cv.parentNode) cv.parentNode.removeChild(cv); if (WMAP_ARMY.att === H) WMAP_ARMY.att = null; };
  if (o.trips) L.setTrips(o.trips);
  if (!WMAP_ARMY.hooked && typeof wmapFrame === 'function') {   // 拖曳 / 縮放時 W1 每幀會呼叫 wmapFrame,順便同步行軍層
    var f0 = wmapFrame;
    wmapFrame = function () { f0(); if (WMAP_ARMY.att) WMAP_ARMY.att.sync(true); };
    WMAP_ARMY.hooked = true;
  }
  WMAP_ARMY.att = H;
  H.sync(true); L.start();
  return H;
}
