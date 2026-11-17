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
//   wmapArmyProj(c, r, s, size) → {x, y}   格座標 → 世界 px(格中心 = 整數):已接 W1 wmap_proj.js(有載入就用 wmapGeom + wmapUV2World(G, c + 0.5, r + 0.5));沒載入 = 暫時投影(斜角,僅後備);s = 格寬 W
//   WMAP_ARMY       外掛點:WMAP_ARMY.proj = function (c, r, s, size) → {x, y} 可整個覆蓋投影;WMAP_ARMY.att = wmapArmyAttach 的掛載中控制器
//   wmapArmyDir6(dx, dy) → {dir:0..3, mir:0|1}                         畫面行進向量 → 6 向(0 下 1 上 2 右下 3 右上,mir = 左右鏡像;見「方向」);WMAP_ARMY_DIR_VSQ 垂直壓縮比
//   wmapArmyScreenVec(dc, dr) → {x, y}                                  格位移 → 畫面向量(六邊形投影線性部分,單位 = 格寬;換投影只改這個);wmapArmyDirOf(dc, dr) = 兩者串接(prevMir 已不用)
//   wmapArmyPose(trip, now, o) → pose                                   o = {size, q:'high'|'mid'|'low'};pose = {vis, phase:'go'|'fight'|'back'|'wait'|'done', c, r(格座標,浮點), dir, mir, alpha, rolled, moving, vx, vy(畫面方向 單位向量)}
//   wmapArmyBuild(trips, now, o) → items[]                              o = {size, s(格邊 px:44/64/104), q, view:{x,y,w,h}(世界 px,可空 = 不裁切), sel(選取 id), seed}
//        item = {id, side, tag, x, y(腳底世界 px), s, dir, mir, fr(0~3 走 / 4 站), wave(0|1), alpha, rolled, phase, ring:'own'|'raid'|null, sel, n(×N 數,0 = 無), box:[x0,y0,x1,y1], z}
//        已依「腳底 y 由上到下、己方最後」排好畫圖順序(同 z 時)。
//   wmapArmyDraw(g, items, o)                                           o = {camX, camY(世界原點的畫面位置), s, dpr, q};用 wmap_army_art.js 的快取圖畫;無 art(node)時略過
//   wmapArmyHit(items, px, py, o) → [id…]                               命中(畫面座標,由上而下),模型框最小 40×40;o = {camX, camY}
//   wmapArmyLayer(canvas, opts) → layer                                 行軍層控制器:layer.setTrips(a) setCam(x,y) setView(w,h,s) setQuality(q) setSel(id) start() stop() redraw(now?) hit(px,py) items
//   wmapArmyTroopOf(slots) → '槍'|'騎'|'盾'|'弓'|'械'|''   隊伍兵種判定(11/17):取主將(slot.row === 2;沒有主將列則第一格)的兵種;主將兵種缺 / 無效 → 隊內最多的兵種(同數取先出現);全缺 → ''(畫面退回舊旗手方陣)
//        trip 可直接帶 tp(兵種字),或帶 slots:[{id,row,col,troop}](wd 行程的成員);兩者皆無 → 退回舊旗手方陣。item.tp = 判定結果。
//   wmapArmyFrameOf(now, q, salt) → 0..4;wmapArmyTickMs(q) → ms;wmapArmySeat(n) → '#rrggbb'
//   圖片模型模式(11/17,wmap_army_art.js「圖片模型模式」):有 GPT 圖(WMAP_ARMY_IMG.on 且 atlas 已載入)就依 兵種 × 狀態(行進 / 返回 / 暫停 / 駐守)× 6 向選圖,沒圖退回上面程式畫的兵種模型。
//        狀態:trip.mode = 'march' | 'back' | 'pause' | 'garrison'(可省略,由 phase 推;駐守一定要呼叫端設);勢力色:trip.team = 'red' | 'yellow' | 'blue' | 'green' | 'black' | 'purple' | '#rrggbb';item.mode / item.team 帶出。
// 假行程範例:{ id:'t1', side:'own', tag:1, path:[gi…轉折點], t0:毫秒, goMs:去程毫秒, backMs:回程毫秒, state:'go' }
//   state:'go'(預設:去程 → 抵達交戰 → 回程,全由 t0 推)| 'back'(只回程,t0 = 回程起點,path 已是要回走的線的「去程方向」)| 'wait'(待發,站在 path[0])| 'done'(不畫)

var WMAP_ARMY_CFG = {
  frame: 192, ax: 0.5, ay: 0.86,               // 原圖每幀 / 錨點(腳底中心)
  fightMs: 3000, tickMs: { high: 167, mid: 167, low: 1000 }, flagMs: 333,
  fanR: 0.22, fanMax: 5, laneW: 0.1,           // 同格停留扇形半徑(格)、同路錯開間距(× s)(舊旗手方陣用)
  fanModelX: 1.1, fanModelY: 0.4, laneModel: 0.45,   // 兵種整隊模型(14+ 單位陣列,佔地約 1 s 寬)用:扇形半徑 x / y(× s)、同路錯開(× s)
  hitMin: 40, maxLive: 40, backAlpha: 0.6, view: 1.2
};
var WMAP_ARMY = { proj: null, att: null, hooked: false };

// 格座標 (c, r)(整數 = 格中心,浮點 = 之間)→ 世界 px。優先序:WMAP_ARMY.proj 外掛 > wmap_proj.js(六邊形:wmapGeom(W = s)+ wmapUV2World,格中心 = c + 0.5)> 暫時投影(沒載入 wmap_proj.js 才用,斜角公式,原點不偏移)
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
var WMAP_ARMY_TROOPS = ['槍', '騎', '盾', '弓', '械'];   // 四兵種 + 器械(投石車);未知 → 視為無效(退回舊旗手方陣)
function wmapArmyTroopNorm(t) {
  if (typeof t !== 'string') return '';
  if (t === '步') return '槍';
  return WMAP_ARMY_TROOPS.indexOf(t) >= 0 ? t : '';
}
function wmapArmyTroopOf(slots) {
  if (!slots || !slots.length) return '';
  var i, s, t, cnt = {}, best = '', bn = 0, main = null;
  for (i = 0; i < slots.length; i++) {
    s = slots[i]; if (!s) continue;
    t = wmapArmyTroopNorm(s.troop);
    if (s.row === 2 && !main && t) main = t;
    if (t) { cnt[t] = (cnt[t] || 0) + 1; if (cnt[t] > bn) { bn = cnt[t]; best = t; } }
  }
  return main || best;
}
function wmapArmySeat(n) { return (typeof wmapArmyArtSeatColor === 'function') ? wmapArmyArtSeatColor(n) : '#888888'; }

// ───────── 方向(六邊形格,11/17):畫面行進方向分 6 扇區 ─────────
// 與底層格子系統無關:只看「畫面上的行進向量 (dx, dy)」(y 向下)。平頂六邊形壓扁(垂直壓縮比 WMAP_ARMY_DIR_VSQ)後,6 個鄰格方向 = 下 / 上 / 右下 / 右上 / 左下 / 左上;
// 判定時先把 dy 除以壓縮比還原成正六邊形的方向,再切 6 個 60° 扇區,各以鄰格方向(下 90°、右下 30°、右上 −30°、上 −90°、左上 −150°、左下 150°)為中心,所以壓縮比變了也不必改扇區。
// 輸出 dir = sheet 的列:0 下(正面)1 上(背面)2 右下(前斜)3 右上(後斜);mir = 1 → 水平鏡像(左下 = 2 鏡像、左上 = 3 鏡像)。正右 / 正左(格子不會出現)落在邊界,歸右下 / 左上。
var WMAP_ARMY_DIR_VSQ = 0.65;   // = WMHEX_SQUASH(規格 1.3:H = W × 9/16 = 正六邊形平邊距 0.866 W × 0.65)
var WMAP_ARMY_DIR_TAB = [{ dir: 2, mir: 0 }, { dir: 0, mir: 0 }, { dir: 2, mir: 1 }, { dir: 3, mir: 1 }, { dir: 1, mir: 0 }, { dir: 3, mir: 0 }];   // 螢幕角(y 向下,度)每 60° 一格:[0,60) 右下、[60,120) 下、[120,180) 左下、[180,240) 左上、[240,300) 上、[300,360) 右上
function wmapArmyDir6(dx, dy) {
  if (!(Math.abs(dx) > 1e-12 || Math.abs(dy) > 1e-12)) return { dir: 0, mir: 0 };
  var a = Math.atan2(dy / WMAP_ARMY_DIR_VSQ, dx) * 57.29577951308232;
  if (a < 0) a += 360;
  var e = WMAP_ARMY_DIR_TAB[Math.min(5, Math.floor(a / 60))];
  return { dir: e.dir, mir: e.mir };
}
// 格位移 (dc, dr) → 畫面向量(單位 = 格寬 W)。六邊形投影(wmap_proj.js)的線性部分:x = 0.75 (dc − dr)、y = 0.5 × (H / W) × (dc + dr),H / W = 9/16;
// 6 個鄰格位移(wm_hex.js 的 WMHEX_DC / DR)剛好是 N (0, −0.5625)、NE (0.75, −0.28125)、SE (0.75, 0.28125)、S (0, 0.5625)、SW (−0.75, 0.28125)、NW (−0.75, −0.28125)。換投影只改這個函式。
function wmapArmyScreenVec(dc, dr) {
  var hr = (typeof WMHEX_HRATIO === 'number') ? WMHEX_HRATIO : 0.5625;
  return { x: 0.75 * (dc - dr), y: 0.5 * hr * (dc + dr) };
}
// 格移動 → 視覺方向(對外介面不變;prevMir 保留但不再使用:六向不需「斜走沿用上一段」)
function wmapArmyDirOf(dc, dr, prevMir) {
  var v = wmapArmyScreenVec(dc, dr);
  return wmapArmyDir6(v.x, v.y);
}

// ───────── 路徑前處理(快取在 trip._wp)─────────
// 一段路的長度(格步數):六邊形每步 1(= wm_march 的 STEP 1000 千分格),不再用歐氏 √2 斜步;沒載入 wm_hex.js 才退回歐氏長度。
function wmapArmyStepLen(dc, dr) {
  if (typeof wmHexDist === 'function') return wmHexDist(0, 0, dc, dr);
  return Math.sqrt(dc * dc + dr * dr);
}
function wmapArmyLine(cs, rs) {
  var n = cs.length, cum = [0], dirs = [], i, len = 0, last = { dir: 0, mir: 0 }, dc, dr, d, L;
  for (i = 0; i + 1 < n; i++) {
    dc = cs[i + 1] - cs[i]; dr = rs[i + 1] - rs[i];
    L = wmapArmyStepLen(dc, dr); len += L; cum.push(len);
    if (L < 1e-9) { dirs.push(last); continue; }
    d = wmapArmyDirOf(dc, dr, 0);
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
    var d6 = (Math.abs(p.dc) + Math.abs(p.dr) > 1e-9) ? wmapArmyDirOf(p.dc, p.dr, 0) : (t.lg ? { dir: 0, mir: 0 } : { dir: p.dir, mir: p.mir });   // 一律由畫面向量重算(含 wm_march 的 lg 行程,它自帶的舊 dir / mir 不採用)
    var side = t.side || 'own', stand = !p.moving || q === 'low', tp = '';
    if (typeof t.tp === 'string') tp = t.tp;
    else if (t.slots) { if (t._tpSrc !== t.slots) { t._tpSrc = t.slots; t._tp = wmapArmyTroopOf(t.slots); } tp = t._tp; }
    it = {
      id: t.id, side: side, tag: t.tag, tp: tp, x: pt.x, y: pt.y, s: s, dir: d6.dir, mir: d6.mir,
      fr: stand ? 4 : wmapArmyFrameOf(now, q, salt), wave: wave, alpha: p.alpha, rolled: p.rolled, phase: p.phase, moving: p.moving,
      ring: side === 'own' ? 'own' : (side === 'raid' ? 'raid' : null), sel: o.sel !== undefined && o.sel === t.id, n: 0,
      z: side === 'own' ? 1 : 0, dc: p.dc, dr: p.dr, loot: !!t.loot, box: null, cx: p.c, cy: p.r, mode: t.mode || '', team: t.team || ''
    };
    items.push(it);
  }
  wmapArmySpread(items, s);
  var m = items.length, bw = Math.max(D, C.hitMin), bh = bw;
  for (i = 0; i < m; i++) {   // 命中框:模型框 s×s、錨點 (0.5, 0.86),最小 40×40
    it = items[i]; var cx = it.x, cy = it.y - D * (C.ay - 0.5), fb = (it.tp && typeof wmapArmyArtFormBounds === 'function') ? wmapArmyArtFormBounds(it.tp, it.dir) : null;
    var ib = (it.tp && typeof wmapArmyImgBox === 'function') ? wmapArmyImgBox(it.tp, D) : null;
    if (ib) {   // 圖片模型:外框 = atlas 一格(錨點 = 底座中心 = 腳底 x, y),最小 hitMin
      var iw = Math.max(ib[2] - ib[0], C.hitMin), ih = Math.max(ib[3] - ib[1], C.hitMin), icx = it.x + (ib[0] + ib[2]) / 2, icy = it.y + (ib[1] + ib[3]) / 2;
      it.box = [icx - iw / 2, icy - ih / 2, icx + iw / 2, icy + ih / 2];
    } else if (fb) {   // 兵種整隊模型:外框 = 陣列範圍(面朝右;朝左時 x 鏡像),最小 hitMin
      var sc = D * fb.Z / fb.F, bx0 = it.mir ? -fb.x1 : fb.x0, bx1 = it.mir ? -fb.x0 : fb.x1, mx = (it.x + (bx0 + bx1) * sc / 2), my = it.y + (fb.y0 + fb.y1) * sc / 2, hw = Math.max((bx1 - bx0) * sc, C.hitMin) / 2, hh = Math.max((fb.y1 - fb.y0) * sc, C.hitMin) / 2;
      it.box = [mx - hw, my - hh, mx + hw, my + hh];
    } else it.box = [cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2];
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
    var mdl = false; for (j = 0; j < arr.length; j++) if (arr[j].tp && typeof wmapArmyArtFormBounds === 'function' && wmapArmyArtFormBounds(arr[j].tp)) mdl = true;
    if (arr[0].moving) {
      for (j = 0; j < arr.length; j++) {   // 法向:畫面方向 = wmapArmyScreenVec(dc, dr) 的垂直
        it = arr[j];
        var sv = wmapArmyScreenVec(it.dc, it.dr), sx = sv.x, sy = sv.y, L = Math.sqrt(sx * sx + sy * sy) || 1, off = (j - (arr.length - 1) / 2) * (mdl ? C.laneModel : C.laneW) * s;
        it.x += (-sy / L) * off; it.y += (sx / L) * off;
      }
    } else {
      var keep = Math.min(arr.length, C.fanMax), cap = arr.length > C.fanMax ? C.fanMax - 1 : arr.length;
      for (j = 0; j < arr.length; j++) {
        it = arr[j];
        if (j >= cap) { it.fr = -1; continue; }   // 標記隱藏(下面移除)
        var ang = (j * 2 * Math.PI / keep) - Math.PI / 2;
        if (mdl) { it.x += Math.cos(ang) * C.fanModelX * s; it.y += Math.sin(ang) * C.fanModelY * s; }
        else { it.x += Math.cos(ang) * C.fanR * s * 2; it.y += Math.sin(ang) * C.fanR * s; }
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
  if (!g) return 0;
  var sheet = null, cx = o.camX || 0, cy = o.camY || 0, q = o.q || 'mid', ART = (typeof wmapArmyArtTroop === 'function');
  var C = WMAP_ARMY_CFG, i, it, D, x, y, k, bd, drawn = 0, tp, scale, px, py, im, pulse = (q === 'high') ? (0.5 + 0.5 * Math.sin((o.now || 0) / 500 * Math.PI)) : 1, ts, F, col, by, DZ, rc, bdy, bobT = (typeof WMAP_ARMY_ART_BOB !== 'undefined') ? WMAP_ARMY_ART_BOB : {};
  for (i = 0; i < items.length; i++) {
    it = items[i]; D = it.s; x = it.x + cx; y = it.y + cy;
    im = (it.tp && typeof wmapArmyImgFor === 'function') ? wmapArmyImgFor(it.tp, it.team, D, o.dpr || 1) : null;   // 圖片模型(已載入才有;否則 null → 退回程式畫)
    ts = (!im && ART && it.tp) ? wmapArmyArtTroop(it.tp) : null;
    if (!ts && !im) { if (!sheet && typeof wmapArmyArtSheet === 'function') sheet = wmapArmyArtSheet(); if (!sheet) continue; }   // 沒有兵種模型 → 退回舊方陣(缺資料 / 無此兵種)
    // 腳環(沒有旗幟,陣營靠腳環辨識):己方金環 / 來襲紅環 / 盟藍環 / 敵深色環 / 選取白環;整隊模型的環隨陣列佔地放大
    rc = it.sel ? '#ffffff' : (it.ring === 'raid' ? 'rgba(235,40,40,' + (0.55 + 0.45 * pulse) + ')' : (it.ring === 'own' ? '#E8B923' : (it.side === 'ally' ? '#2F8FC7' : '#e0dccf')));
    {
      var rx = im ? D * WMAP_ARMY_IMG.baseK * 0.52 : (ts ? D * 0.6 : D * 0.4), ry = im ? rx * 0.52 : (ts ? D * 0.27 : D * 0.125);
      g.save(); g.globalAlpha = it.alpha; g.lineWidth = Math.max(2.5, D * 0.05);
      g.strokeStyle = '#4A2A14'; g.beginPath(); g.ellipse(x, y + (im ? 0 : D * 0.02), rx, ry, 0, 0, 6.2832); g.stroke();
      g.lineWidth = Math.max(1.5, D * 0.028); g.strokeStyle = rc;
      g.beginPath(); g.ellipse(x, y + (im ? 0 : D * 0.02), rx, ry, 0, 0, 6.2832); g.stroke();
      g.restore();
    }
    by = 0;
    g.save(); g.globalAlpha = it.alpha;
    if (im) {   // 圖片模型:列 = 狀態 / 方向,欄見 wmapArmyImgCellOf;行進 / 返回奇數拍整體微上浮代替走路動畫;錨點 = 底座中心
      var ic = wmapArmyImgCellOf(wmapArmyImgStateOf(it), it.dir, it.mir);
      if ((it.fr === 1 || it.fr === 3) && it.moving) by = -D * 0.02;
      g.translate(x, y + by);
      if (ic.flip) g.scale(-1, 1);
      g.imageSmoothingQuality = 'high';
      g.drawImage(im.img, ic.col * im.cw, ic.row * im.ch, im.cw, im.ch, -im.ax * im.sc, -im.ay * im.sc, im.cw * im.sc, im.ch * im.sc);
    } else if (ts) {   // 兵種整隊模型:依 dir(0 下 1 上 2 右下 3 右上)取列,左下 / 左上 = 鏡像;站 0 / 步 A 1 / 步 B 2;四拍 = A、站、B、站,站拍整體上浮;站立 / 低畫質 fr = 4 → 靜態站立幀
      F = ts.F; DZ = D * ts.Z;
      col = it.fr === 0 ? 1 : (it.fr === 2 ? 2 : 0);
      if (it.fr === 1 || it.fr === 3) by = -D * (bobT[it.tp] || 0.025);
      g.translate(x, y + by);
      if (it.mir) g.scale(-1, 1);
      g.drawImage(ts.canvas, col * F, it.dir * F, F, F, -DZ * C.ax, -DZ * ts.ay, DZ, DZ);
    } else {
      F = sheet.F;
      g.translate(x, y);
      if (it.mir) g.scale(-1, 1);
      g.drawImage(sheet.canvas, it.fr * F, (it.dir === 1 || it.dir === 3 ? 1 : 0) * F, F, F, -D * C.ax, -D * C.ay, D, D);
    }
    g.restore();
    // 徽章:交戰 / 待發 / 戰利袋(模型上方)
    bdy = im ? (-im.ay * im.sc - D * 0.3) : ts ? (wmapArmyArtFormBounds(it.tp, it.dir).y0 * D * ts.Z / ts.Fd - D * 0.34) : (-D * 0.86 - D * 0.1);
    bd = it.phase === 'fight' ? 'fight' : (it.phase === 'wait' ? 'wait' : ((it.phase === 'back' && it.loot) ? 'bag' : null));
    if (bd) { var bc = wmapArmyArtBadge(bd); if (bc) g.drawImage(bc, x - D * 0.17, y + bdy, D * 0.34, D * 0.34); }
    if (it.n > 0) {   // ×N
      g.save(); g.font = 'bold ' + Math.max(10, Math.round(D * 0.2)) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 3; g.strokeStyle = '#4A2A14'; g.fillStyle = '#F4EBD0'; g.strokeText('×' + it.n, x + D * ((ts || im) ? 0.55 : 0.3), y - D * 0.1); g.fillText('×' + it.n, x + D * ((ts || im) ? 0.55 : 0.3), y - D * 0.1); g.restore();
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
    var dpr = L.q === 'low' ? 1 : Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1.5);
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
      wmapArmyDraw(L.g, L.items, { camX: L.camX, camY: L.camY, q: L.q, now: tn, dpr: L.dpr });
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
