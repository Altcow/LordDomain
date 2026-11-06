// js/cityfx.js — 民生數值與效果標籤引擎(PLAN_CITY §14、CT10 最小版):衛生 / 飲水 / 糧食 / 治安 / 民心 五個 key。
// 唯讀:只讀 world.objects / world.terrain,不寫任何存檔欄位;全部結果都是可重算的快取(節流 1 秒、簽章不變就不重算)。
// 不做 §16 後果引擎,只預留 cityFxLevel(key) 讀取接口與 cityConseqPenalty 守衛鉤子。
// 與 cityscore.js 的銜接:cityFxCiv() 回傳 {min,mei,xu,wen,shang,chan} 補充向量,由對方以 typeof 守衛自行取用,本檔不依賴它。
// 與 citylife.js 的銜接:cityRoadSpd(x,y) 路速乘數(只讀陣列;citylife 在 step 乘一次)。
// 全域名稱:cityFxGet cityFxCity cityFxFang cityFxLevel cityFxCiv cityFxContrib cityRoadSpd cityFxTick cityFxMarkDirty cityFxInvalidate
//          cityFxSetDecree cityFxGetDecree cityFxStats cityFxSetClock cityFxPanelFill cityFxPanelRender;其餘內部一律 cfx / cfxXxx。

var CFX_SK = ['wei', 'yi', 'an', 'xin', 'jiao', 'lu', 'wang'];       // 需「逐戶半徑取樣」的標籤
var CFX_AXES = ['min', 'mei', 'xu', 'wen', 'shang', 'chan'];
var CFX_D = (function () { var a = [0], s = 0, i; for (i = 1; i < 128; i++) { s += Math.pow(0.88, i - 1); a.push(s); } return a; })();   // D(n) 同種遞減(§2.3)

var cfx = {
  ready: false, sig: '', checkAt: -1e15, clock: function () { return Date.now(); },
  w: 0, nbx: 0, board: null,
  dec: {}, decVer: 0, hint: null, roadCd: 0,
  tid: {}, tidN: 0, tab: [], cnt: new Int32Array(64), touched: [],
  rel: {},
  houses: [], hv: null, hbk: null, src: null, fang: null, waterSrc: [], tianSrc: [], luSrc: [], selfList: [],
  allT: {}, allV: null, decV: null,
  blk: null, city: null, road: null, civ: null,
  stats: { full: 0, partial: 0, sampled: 0, lastMs: 0, calcs: 0 },
  ui: { sec: null, rows: null, open: {}, list: null }
};

function cfxEntry(type) { return CITY_FX[type] || CITY_FX_PENDING[type] || null; }

function cfxTid(type) {
  var t = cfx.tid[type], e, v, i;
  if (t !== undefined) return t;
  t = cfx.tid[type] = cfx.tidN++;
  e = cfxEntry(type);
  v = new Float32Array(CFX_SK.length);
  if (e) for (i = 0; i < CFX_SK.length; i++) v[i] = e.fx[CFX_SK[i]] || 0;
  cfx.tab[t] = { type: type, e: e, vec: v };
  if (cfx.cnt.length <= t) { var nc = new Int32Array(cfx.cnt.length * 2); nc.set(cfx.cnt); cfx.cnt = nc; }
  return t;
}

// 物件分類:0 無關、1 有標籤、2 民居(同時可有標籤,以 2 為主)
function cfxRel(type) {
  var r = cfx.rel[type];
  if (r === undefined) r = cfx.rel[type] = CITYFX_HOUSES[type] ? 2 : (cfxEntry(type) ? 1 : 0);
  return r;
}

function cfxFoot(o) {
  if (typeof footprint === 'function' && typeof OBJECTS !== 'undefined' && OBJECTS[o.type]) return footprint(o.type, o.rot || 0);
  return [1, 1];
}

function cfxObjs() { return (typeof world !== 'undefined' && world && world.objects) ? world.objects : []; }
function cfxW() { return typeof boardW === 'function' ? boardW() : 0; }

// 簽章:只算相關物件(有標籤或民居)的數量與位置雜湊 + 道路格數 + 政令版本;約每秒一次,O(N)
function cfxSig() {
  var objs = cfxObjs(), w = cfxW(), h = 0, n = 0, i, o, r, roads = 0, ter = (typeof world !== 'undefined') ? world.terrain : null;
  for (i = 0; i < objs.length; i++) {
    o = objs[i]; r = cfxRel(o.type);
    if (!r) continue;
    n++;
    h = (Math.imul(h, 31) + cfxTid(o.type) * 977 + o.x * 131 + o.y * 7 + (o.rot || 0)) | 0;
  }
  if (ter) for (i = 0; i < ter.length; i++) if (cfxRoadT(ter[i])) roads++;
  return w + ':' + n + ':' + h + ':' + roads + ':' + cfx.decVer + ':' + (ter ? ter.length : 0);
}

function cfxClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

// 對 (cx,cy) 取樣半徑標籤(含所在坊 fang 標籤),結果寫入 out(長度 = CFX_SK)
function cfxSample(cx, cy, bx, by, out, track) {
  var nbx = cfx.nbx, cnt = cfx.cnt, T = cfx.touched, yy, xx, L, i, s, dx, dy, t, n, d, vec, k, F, v;
  out.fill(0); T.length = 0;
  for (yy = by - 1; yy <= by + 1; yy++) {
    if (yy < 0 || yy >= nbx) continue;
    for (xx = bx - 1; xx <= bx + 1; xx++) {
      if (xx < 0 || xx >= nbx) continue;
      L = cfx.src[yy * nbx + xx];
      if (!L) continue;
      for (i = 0; i < L.length; i++) {
        s = L[i]; dx = s.x - cx; dy = s.y - cy;
        if (dx * dx + dy * dy <= s.r2) { if (cnt[s.t]++ === 0) T.push(s.t); }
      }
    }
  }
  F = cfx.fang[by * nbx + bx];
  if (F) for (i = 0; i < F.length; i++) { t = F[i]; if (cnt[t]++ === 0) T.push(t); }
  for (i = 0; i < T.length; i++) {
    t = T[i]; n = cnt[t]; cnt[t] = 0;
    d = CFX_D[n > 127 ? 127 : n]; vec = cfx.tab[t].vec;
    for (k = 0; k < out.length; k++) if (vec[k]) { v = vec[k] * d; out[k] += v; if (track) track(k, t, v); }
  }
}

function cfxBlockOf(x, y) {
  var B = CITYFX_BLOCK, bx = Math.floor(x / B), by = Math.floor(y / B), m = cfx.nbx - 1;
  return { bx: cfxClamp(bx, 0, m), by: cfxClamp(by, 0, m) };
}

// 全量(或帶 hint 的局部)重算
function cfxCalc() {
  var t0 = Date.now(), objs = cfxObjs(), w = cfxW(), B = CITYFX_BLOCK, nbx = Math.max(1, Math.ceil(w / B)), nb = nbx * nbx;
  var i, j, k, o, r, e, f, cx, cy, b, tid, fx, h, sc, s;
  var oldHv = cfx.hv, oldBoard = cfx.board, ter = (typeof world !== 'undefined') ? world.terrain : null;
  var dirtyB = null, hint = cfx.hint, partial = false;
  if (hint && hint.size && oldHv && oldBoard === ter && cfx.w === w) {
    partial = true; dirtyB = {};
    hint.forEach(function (bi) {
      var bx = bi % nbx, by = Math.floor(bi / nbx), ax, ay;
      for (ay = by - 1; ay <= by + 1; ay++) for (ax = bx - 1; ax <= bx + 1; ax++) if (ax >= 0 && ay >= 0 && ax < nbx && ay < nbx) dirtyB[ay * nbx + ax] = 1;
    });
  }
  cfx.hint = null;
  cfx.w = w; cfx.nbx = nbx; cfx.board = ter;
  cfx.src = new Array(nb); cfx.fang = new Array(nb); cfx.hbk = new Array(nb);
  cfx.waterSrc = []; cfx.tianSrc = []; cfx.luSrc = []; cfx.selfList = [];
  cfx.houses = []; cfx.allT = {};
  var allStore = 0, allAxes = {}, dummy;
  // 1. 分類
  for (i = 0; i < objs.length; i++) {
    o = objs[i]; r = cfxRel(o.type);
    if (!r) continue;
    f = cfxFoot(o); cx = o.x + f[0] / 2; cy = o.y + f[1] / 2;
    b = cfxBlockOf(cx, cy); b = b.by * nbx + b.bx;
    if (r === 2) {
      h = { x: cx, y: cy, b: b, cell: o.y * w + o.x, bx: b % nbx, by: Math.floor(b / nbx), served: 0 };
      (cfx.hbk[b] = cfx.hbk[b] || []).push(cfx.houses.length);
      cfx.houses.push(h);
    }
    e = cfxEntry(o.type);
    if (!e) continue;
    tid = cfxTid(o.type); fx = e.fx; sc = e.scope || 'r';
    if (sc === 'all') {
      cfx.allT[tid] = (cfx.allT[tid] || 0) + 1;
      if (fx.store) allStore += fx.store;
    } else if (sc === 'fang') {
      (cfx.fang[b] = cfx.fang[b] || []).push(tid);
    } else if (sc === 'self') {
      cfx.selfList.push({ t: tid, x: o.x, y: o.y, w: f[0], h: f[1], cx: cx, cy: cy, fx: fx });
    } else {
      s = { t: tid, x: cx, y: cy, r2: (e.r || 5) * (e.r || 5), cap: fx.shui || 0, fx: fx };
      (cfx.src[b] = cfx.src[b] || []).push(s);
      if (fx.shui) cfx.waterSrc.push(s);
      if (fx.tian) cfx.tianSrc.push(s);
      if (fx.lu) cfx.luSrc.push(s);
    }
  }
  // 2. 政令向量(全域)
  var decV = {}, dk, dd, p;
  for (dk in DECREE_FX) {
    p = cfx.dec[dk]; if (!p) continue;
    dd = DECREE_FX[dk].fx;
    for (k in dd) decV[k] = (decV[k] || 0) + dd[k] * p;
  }
  cfx.decV = decV;
  // 全域(all scope 的物件,同種遞減)向量
  var allV = {}, ti, ent, n;
  for (ti in cfx.allT) {
    n = cfx.allT[ti]; ent = cfx.tab[ti].e;
    for (k in ent.fx) if (k !== 'store' && k !== 'liang') allV[k] = (allV[k] || 0) + ent.fx[k] * CFX_D[Math.min(n, 127)];
  }
  cfx.allV = allV;
  // 3. 逐戶取樣(局部時只重算髒坊)
  var H = cfx.houses.length, newHv = new Map(), vec, nSamp = 0;
  for (i = 0; i < H; i++) {
    h = cfx.houses[i];
    vec = null;
    if (partial && !dirtyB[h.b]) vec = oldHv.get(h.cell);
    if (!vec) { vec = new Float32Array(CFX_SK.length); cfxSample(h.x, h.y, h.bx, h.by, vec, null); nSamp++; }
    newHv.set(h.cell, vec); h.v = vec;
  }
  cfx.hv = newHv;
  cfx.stats.sampled = nSamp;
  // 4. 飲水:逐水源把容量配給範圍內尚未供水的戶(近者優先;同距以索引)
  var si, cand, hh, dx, dy, cap, sx, sy, bxx, byy, ax, ay, L, c2;
  for (si = 0; si < cfx.waterSrc.length; si++) {
    s = cfx.waterSrc[si]; cap = s.cap; cand = [];
    b = cfxBlockOf(s.x, s.y);
    for (ay = b.by - 1; ay <= b.by + 1; ay++) for (ax = b.bx - 1; ax <= b.bx + 1; ax++) {
      if (ax < 0 || ay < 0 || ax >= nbx || ay >= nbx) continue;
      L = cfx.hbk[ay * nbx + ax];
      if (!L) continue;
      for (j = 0; j < L.length; j++) {
        hh = cfx.houses[L[j]];
        if (hh.served) continue;
        dx = hh.x - s.x; dy = hh.y - s.y; c2 = dx * dx + dy * dy;
        if (c2 <= s.r2) cand.push([c2, L[j]]);
      }
    }
    cand.sort(function (a, c) { return a[0] - c[0] || a[1] - c[1]; });
    for (j = 0; j < cand.length && cap > 0; j++, cap--) cfx.houses[cand[j][1]].served = 1;
  }
  // 5. 彙總到坊
  var blk = { cnt: new Float32Array(nb), wei: new Float32Array(nb), an: new Float32Array(nb), xin: new Float32Array(nb), jiao: new Float32Array(nb),
              yi: new Float32Array(nb), served: new Float32Array(nb), sani: new Float32Array(nb), order: new Float32Array(nb) };
  for (i = 0; i < H; i++) { h = cfx.houses[i]; blk.cnt[h.b]++; if (h.served) blk.served[h.b]++; }
  var sSani = 0, sOrder = 0, sXin = 0, sYi = 0, sJiao = 0, sServed = 0, pop, hs, ho, allWei = allV.wei || 0, allAn = allV.an || 0, allXin = allV.xin || 0,
      allJiao = allV.jiao || 0, allYi = allV.yi || 0, decWei = decV.wei || 0, decAn = decV.an || 0, decJiao = decV.jiao || 0, decYi = decV.yi || 0;
  for (i = 0; i < H; i++) {
    h = cfx.houses[i]; vec = h.v; pop = blk.cnt[h.b] * CITYFX_POP_PER_HOUSE;
    hs = cfxClamp(CITYFX_BASE.sani + vec[0] + allWei + decWei - CITYFX_DENSITY_SANI * pop / 100, 0, 100);
    ho = cfxClamp(CITYFX_BASE.order + vec[2] + allAn + decAn + CITYFX_EDU_ORDER * (20 + vec[4] + allJiao + decJiao) - pop / CITYFX_DENSITY_ORDER, 0, 100);
    blk.sani[h.b] += hs; blk.order[h.b] += ho; blk.wei[h.b] += vec[0]; blk.an[h.b] += vec[2]; blk.xin[h.b] += vec[3]; blk.jiao[h.b] += vec[4]; blk.yi[h.b] += vec[1];
    sSani += hs; sOrder += ho; sXin += vec[3]; sYi += vec[1]; sJiao += vec[4]; if (h.served) sServed++;
  }
  cfx.blk = blk;
  // 6. 糧食:農田 × (1 + →田 加成) × (1 + 政令 / 全域 糧%);消耗 = 人口 × 0.25
  var prod = 0, fl, tcnt, tt, tb, d2, tn, ts, fe;
  for (i = 0; i < cfx.selfList.length; i++) {
    fl = cfx.selfList[i];
    if (!fl.fx.liang) continue;
    tb = 0;
    if (cfx.tianSrc.length) {
      tcnt = {};
      for (j = 0; j < cfx.tianSrc.length; j++) {
        ts = cfx.tianSrc[j]; dx = ts.x - fl.cx; dy = ts.y - fl.cy;
        if (dx * dx + dy * dy <= ts.r2) tcnt[ts.t] = (tcnt[ts.t] || 0) + 1;
      }
      for (tt in tcnt) tb += (cfx.tab[tt].e.fx.tian || 0) * CFX_D[Math.min(tcnt[tt], 127)];
    }
    prod += fl.fx.liang * (1 + Math.min(CITYFX_TIAN_CAP, tb));
  }
  prod *= 1 + (decV.liangPct || 0) + (allV.liangPct || 0);
  var popAll = H * CITYFX_POP_PER_HOUSE, cons = popAll * CITYFX_FOOD_PER_POP;
  var food = H ? cfxClamp(prod / cons * 100, 0, 200) : 100;
  // 7. 全城值
  var city = { houses: H, pop: popAll, foodProd: prod, foodCons: cons, store: allStore };
  city.sani = H ? sSani / H : CITYFX_BASE.sani + allWei + decWei;
  city.order = H ? sOrder / H : CITYFX_BASE.order + allAn + decAn;
  city.water = H ? sServed / H * 100 : 100;
  city.food = food;
  city.risk = Math.max(-0.8, (H ? sYi / H : 0) + allYi + decYi);
  city.edu = 20 + (H ? sJiao / H : 0) + allJiao + decJiao;
  var decMood = Math.min(CITYFX_DECREE_MOOD_CAP, decV.xin || 0);
  var needs = H ? (city.water / 100 + Math.min(1, food / 100) + cfxClamp((city.sani - 30) / 30, 0, 1) + cfxClamp((city.order - 30) / 30, 0, 1)) : 0;
  var pen = (typeof cityConseqPenalty === 'function') ? (+cityConseqPenalty() || 0) : 0;
  city.xinAvg = (H ? sXin / H : 0) + allXin;
  city.mood = cfxClamp(CITYFX_BASE.mood + CITYFX_NEED_W * needs + city.xinAvg + decMood - pen, 0, 100);
  cfx.city = city;
  // 8. 路速表
  cfxRoadCalc(w, ter);
  cfx.civ = null;
  cfx.ready = true;
  cfx.stats.calcs++; if (partial) cfx.stats.partial++; else cfx.stats.full++;
  cfx.stats.lastMs = Date.now() - t0;
}

// 道路暢通指標算入的地形:道路 + 石板 / 夯土 / 水泥(data.js isRoadLikeTerrain;鋼鐵、木棧板、木紋地板不算);data.js 未載入時只認道路
function cfxRoadT(t) { return typeof isRoadLikeTerrain === 'function' ? isRoadLikeTerrain(t) : t === 3; }

function cfxRoadCalc(w, ter) {
  var N = w * w, arr = new Float32Array(N), i, j, c, s, cell, m, sp, tcnt, tt, add, x, y, selfLu = {}, fl, ax, ay, cnt = {}, dx, dy;
  var allLu = (cfx.allV.lu || 0) + (cfx.decV.lu || 0);
  var pen = cfxLevelOf('sani', cfx.city.sani) >= 2 ? CITYFX_ROAD_SANI_PEN : 1;
  arr.fill(1);
  for (i = 0; i < cfx.selfList.length; i++) {
    fl = cfx.selfList[i];
    if (!fl.fx.lu) continue;
    for (ay = fl.y; ay < fl.y + fl.h; ay++) for (ax = fl.x; ax < fl.x + fl.w; ax++) if (ax >= 0 && ay >= 0 && ax < w && ay < w) selfLu[ay * w + ax] = Math.max(selfLu[ay * w + ax] || 0, fl.fx.lu);
  }
  for (cell = 0; cell < N; cell++) {
    if (!(ter && cfxRoadT(ter[cell])) && selfLu[cell] === undefined) continue;
    x = (cell % w) + 0.5; y = Math.floor(cell / w) + 0.5;
    add = (selfLu[cell] || 0) + allLu;
    if (cfx.luSrc.length) {
      tcnt = {};
      for (j = 0; j < cfx.luSrc.length; j++) {
        s = cfx.luSrc[j]; dx = s.x - x; dy = s.y - y;
        if (dx * dx + dy * dy <= s.r2) tcnt[s.t] = (tcnt[s.t] || 0) + 1;
      }
      for (tt in tcnt) add += (cfx.tab[tt].e.fx.lu || 0) * CFX_D[Math.min(tcnt[tt], 127)];
    }
    arr[cell] = cfxClamp((1 + add) * pen, CITYFX_ROAD_MIN, CITYFX_ROAD_MAX);
  }
  cfx.road = arr;
}

function cfxLevelOf(key, v) {
  var T = CITYFX_LEVEL_AT[key];
  if (!T) return 0;
  return v >= T[0] ? 0 : (v >= T[1] ? 1 : (v >= T[2] ? 2 : 3));
}

// 檢查簽章,必要時重算(節流 CITYFX_THROTTLE_MS)
function cfxEnsure(force) {
  var now = cfx.clock(), sg;
  if (!force && cfx.ready && now - cfx.checkAt < CITYFX_THROTTLE_MS) return;
  cfx.checkAt = now;
  sg = cfxSig();
  if (cfx.ready && sg === cfx.sig) return;
  cfx.sig = sg;
  cfxCalc();
}

function cityFxTick() { cfxEnsure(false); }
function cityFxInvalidate() { cfx.roadCd = 0; cfx.checkAt = -1e15; cfx.ready = false; cfx.hint = null; }
function cityFxSetClock(fn) { cfx.clock = fn || function () { return Date.now(); }; }
function cityFxStats() { return { full: cfx.stats.full, partial: cfx.stats.partial, sampled: cfx.stats.sampled, lastMs: cfx.stats.lastMs, calcs: cfx.stats.calcs, houses: cfx.houses.length }; }

// 放置 / 拆除後的增量提示(選用):標記該位置所在坊,下次重算只重取樣鄰近坊的民居;未提示的變動仍由簽章偵測並全量重算
function cityFxMarkDirty(x, y) {
  var b;
  if (!cfx.w) return;
  b = cfxBlockOf(x, y);
  if (!cfx.hint) cfx.hint = new Set();
  cfx.hint.add(b.by * cfx.nbx + b.bx);
  cfx.roadCd = 0; cfx.checkAt = -1e15;
}

function cityFxSetDecree(id, power) {
  var p = power === undefined ? 1 : +power;
  if (!DECREE_FX[id]) return;
  p = cfxClamp(isNaN(p) ? 0 : p, 0, 1);
  if ((cfx.dec[id] || 0) === p) return;
  cfx.dec[id] = p; cfx.decVer++; cfx.roadCd = 0; cfx.checkAt = -1e15;
}
function cityFxGetDecree(id) { return cfx.dec[id] || 0; }

// 被某類設施覆蓋的房屋戶數(CITY_FX[type].r 半徑,中心距 ≤ r 才算;同一戶只算一次)。教學 T6 / 修復提示用
function cityFxHouseCover(type) {
  var fx = (typeof CITY_FX !== 'undefined') ? CITY_FX[type] : null, objs, hs, i, j, f, h, seen = {}, n = 0;
  if (!fx || typeof world === 'undefined' || !world || !world.objects) return 0;
  objs = world.objects;
  hs = (typeof CITYFX_HOUSES !== 'undefined') ? CITYFX_HOUSES : { house: 1 };
  for (i = 0; i < objs.length; i++) {
    f = objs[i];
    if (!f || f.type !== type) continue;
    for (j = 0; j < objs.length; j++) {
      h = objs[j];
      if (!h || !hs[h.type] || seen[j]) continue;
      if (Math.sqrt((h.x - f.x) * (h.x - f.x) + (h.y - f.y) * (h.y - f.y)) <= fx.r) { seen[j] = true; n++; }
    }
  }
  return n;
}

function cityFxCity(key) {
  var c;
  cfxEnsure(false);
  c = cfx.city;
  return c && c[key] !== undefined ? c[key] : 0;
}

// 坊值(bx,by 為坊座標);無民居的坊回傳 null
function cityFxFang(key, bx, by) {
  var b, n, blk, c;
  cfxEnsure(false);
  blk = cfx.blk; c = cfx.city;
  if (!blk || bx < 0 || by < 0 || bx >= cfx.nbx || by >= cfx.nbx) return null;
  b = by * cfx.nbx + bx; n = blk.cnt[b];
  if (!n) return null;
  if (key === 'sani') return blk.sani[b] / n;
  if (key === 'order') return blk.order[b] / n;
  if (key === 'water') return blk.served[b] / n * 100;
  if (key === 'food') return c.food;
  if (key === 'mood') return cfxClamp(c.mood + (blk.xin[b] / n - (c.houses ? (c.xinAvg - (cfx.allV.xin || 0)) : 0)), 0, 100);
  if (key === 'risk') return Math.max(-0.8, blk.yi[b] / n + (cfx.allV.yi || 0) + (cfx.decV.yi || 0));
  if (key === 'edu') return 20 + blk.jiao[b] / n + (cfx.allV.jiao || 0) + (cfx.decV.jiao || 0);
  return null;
}

// 任一格的值:所在坊有民居用坊值,否則以該格直接取樣(無民居時 water 為「是否在水源半徑內」)
function cityFxGet(key, x, y) {
  var bb, v, vec, c, pop, i, s, dx, dy;
  if (x === undefined || y === undefined) return cityFxCity(key);
  cfxEnsure(false);
  if (!cfx.city) return 0;
  bb = cfxBlockOf(x, y);
  v = cityFxFang(key, bb.bx, bb.by);
  if (v !== null) return v;
  c = cfx.city;
  if (key === 'food') return c.food;
  if (key === 'mood') return c.mood;
  if (key === 'water') {
    for (i = 0; i < cfx.waterSrc.length; i++) { s = cfx.waterSrc[i]; dx = s.x - x; dy = s.y - y; if (dx * dx + dy * dy <= s.r2) return 100; }
    return 0;
  }
  vec = new Float32Array(CFX_SK.length);
  cfxSample(x, y, bb.bx, bb.by, vec, null);
  if (key === 'sani') return cfxClamp(CITYFX_BASE.sani + vec[0] + (cfx.allV.wei || 0) + (cfx.decV.wei || 0), 0, 100);
  if (key === 'order') return cfxClamp(CITYFX_BASE.order + vec[2] + (cfx.allV.an || 0) + (cfx.decV.an || 0) + CITYFX_EDU_ORDER * (20 + vec[4] + (cfx.allV.jiao || 0)), 0, 100);
  if (key === 'risk') return Math.max(-0.8, vec[1] + (cfx.allV.yi || 0) + (cfx.decV.yi || 0));
  if (key === 'edu') return 20 + vec[4] + (cfx.allV.jiao || 0) + (cfx.decV.jiao || 0);
  return 0;
}

// §16 預留:0 正常 / 1 警示 / 2 失衡 / 3 危機(門檻 PLACEHOLDER);本次不產生任何後果
function cityFxLevel(key, x, y) { return cfxLevelOf(key, cityFxGet(key, x, y)); }

// 六軸補充向量(供 cityscore 以 typeof 守衛讀取;同種遞減,含全域政令)。注意:cityscore 若已有自動 civ 分類,取用方自行避免重複計入
function cityFxCiv() {
  var objs, cnt = {}, i, o, e, t, out = { min: 0, mei: 0, xu: 0, wen: 0, shang: 0, chan: 0 }, k, n, dk, dd;
  cfxEnsure(false);
  if (cfx.civ) return cfx.civ;
  objs = cfxObjs();
  for (i = 0; i < objs.length; i++) { o = objs[i]; if (cfxRel(o.type) && cfxEntry(o.type)) cnt[o.type] = (cnt[o.type] || 0) + 1; }
  for (t in cnt) {
    e = cfxEntry(t); n = Math.min(cnt[t], 127);
    for (i = 0; i < CFX_AXES.length; i++) { k = CFX_AXES[i]; if (e.fx[k]) out[k] += e.fx[k] * CFX_D[n]; }
  }
  for (dk in DECREE_FX) {
    if (!cfx.dec[dk]) continue;
    dd = DECREE_FX[dk].fx;
    for (i = 0; i < CFX_AXES.length; i++) { k = CFX_AXES[i]; if (dd[k]) out[k] += dd[k] * cfx.dec[dk]; }
  }
  cfx.civ = out;
  return out;
}

// 路速乘數(只讀):非道路格 = 1。每 600 次呼叫順手檢查一次節流(不寫任何遊戲資料)
function cityRoadSpd(x, y) {
  var w = cfx.w, xi, yi, v;
  if (--cfx.roadCd <= 0) { cfx.roadCd = 600; cfxEnsure(false); w = cfx.w; }
  if (!cfx.road) return 1;
  xi = x | 0; yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= w || yi >= w) return 1;
  v = cfx.road[yi * w + xi];
  return v || 1;
}

// 貢獻清單(面板展開用,按需計算):回傳 [{type, name, n, v}],v = 該 key 的全城平均貢獻
function cityFxContrib(key) {
  var out = {}, H, i, h, vec, ki, name = {}, res = [], t, ent, n, acc = {}, per;
  cfxEnsure(false);
  H = cfx.houses.length;
  function add(type, v) { acc[type] = (acc[type] || 0) + v; }
  var map = { sani: 0, order: 2, mood: 3 };
  if (key === 'sani' || key === 'order' || key === 'mood') {
    ki = map[key];
    for (i = 0; i < H; i++) {
      h = cfx.houses[i]; vec = new Float32Array(CFX_SK.length);
      cfxSample(h.x, h.y, h.bx, h.by, vec, function (k, tid, v) { if (k === ki) add(cfx.tab[tid].type, v); });
    }
    for (t in acc) res.push({ type: t, v: acc[t] / Math.max(1, H) });
    for (t in cfx.allT) { ent = cfx.tab[t].e; n = ent.fx[CFX_SK[ki]]; if (n) res.push({ type: cfx.tab[t].type, v: n * CFX_D[Math.min(cfx.allT[t], 127)] }); }
  } else if (key === 'water') {
    var wc = {};
    cfx.waterSrc.forEach(function (s) { wc[cfx.tab[s.t].type] = (wc[cfx.tab[s.t].type] || 0) + s.cap; });
    for (t in wc) res.push({ type: t, v: wc[t] });
  } else if (key === 'food') {
    var fc = {};
    cfx.selfList.forEach(function (f) { if (f.fx.liang) fc[cfx.tab[f.t].type] = (fc[cfx.tab[f.t].type] || 0) + f.fx.liang; });
    for (t in fc) res.push({ type: t, v: fc[t] });
  }
  res.forEach(function (r) {
    var e = cfxEntry(r.type);
    r.name = (typeof OBJECTS !== 'undefined' && OBJECTS[r.type] && OBJECTS[r.type].name) || (e && e.n) || r.type;
    n = 0; cfxObjs().forEach(function (o) { if (o.type === r.type) n++; });
    r.n = n;
  });
  res.sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); });
  return res.filter(function (r) { return r.v; });
}

// ───────── 民情小面板(唯讀):併入城市等級抽屜(progui.js progUiRefresh 末端呼叫 cityFxPanelFill(pui.list)) ─────────
function cfxFmt(key, v) {
  if (key === 'water' || key === 'food') return Math.round(v) + '%';
  return String(Math.round(v));
}
var CFX_LV_MARK = ['●', '▲', '◆', '■'];

function cfxPanelLv() { return (typeof progLv === 'function') ? progLv() : 99; }

function cityFxPanelFill(list) {
  var ui = cfx.ui;
  if (!list || typeof document === 'undefined') return;
  if (!ui.sec || ui.list !== list) {
    ui.sec = document.createElement('div');
    ui.sec.id = 'cityFxSec';
    ui.list = list;
    list.appendChild(ui.sec);
  }
  if (typeof panelOpen === 'function') panelOpen('cityfx');
  cityFxPanelRender();
}

function cityFxPanelRender() {
  var ui = cfx.ui, sec = ui.sec, lv = cfxPanelLv(), i, key, row, d, v, lvl, items, j, line, ic;
  if (!sec) return;
  while (sec.firstChild) sec.removeChild(sec.firstChild);
  if (lv < CITYFX_PANEL_LV) { sec.hidden = true; return; }
  sec.hidden = false;
  d = document.createElement('div'); d.className = 'pg-sec'; d.textContent = '民情(點一條看貢獻)';
  sec.appendChild(d);
  cfxEnsure(false);
  for (i = 0; i < CITYFX_KEYS.length; i++) {
    key = CITYFX_KEYS[i];
    if (lv < CITYFX_REVEAL[key]) continue;
    v = cityFxCity(key); lvl = cfxLevelOf(key, v);
    row = document.createElement('div'); row.className = 'pg-row';
    ic = typeof uiIconNode === 'function' ? uiIconNode(key, 24, CITYFX_ICON[key]) : null;
    if (ic && ic.tagName !== 'SPAN' && ic.tagName !== 'span') { row.appendChild(ic); row.appendChild(document.createTextNode(' ' + CITYFX_NAME[key] + ' ' + cfxFmt(key, v) + '  ' + CFX_LV_MARK[lvl] + CITYFX_LEVEL_NAME[lvl])); }
    else row.textContent = CITYFX_ICON[key] + ' ' + CITYFX_NAME[key] + ' ' + cfxFmt(key, v) + '  ' + CFX_LV_MARK[lvl] + CITYFX_LEVEL_NAME[lvl];
    (function (k) { row.addEventListener('click', function () { cfx.ui.open[k] = !cfx.ui.open[k]; cityFxPanelRender(); }); })(key);
    sec.appendChild(row);
    if (ui.open[key]) {
      items = cityFxContrib(key).slice(0, 5);
      if (!items.length) items = [{ name: '(尚無貢獻,蓋些相關建築)', n: 0, v: 0 }];
      for (j = 0; j < items.length; j++) {
        line = document.createElement('div'); line.className = 'pg-row';
        line.textContent = '　' + items[j].name + (items[j].n ? ' ×' + items[j].n : '') + (items[j].v ? '  ' + (items[j].v > 0 ? '+' : '') + (Math.round(items[j].v * 10) / 10) : '');
        sec.appendChild(line);
      }
    }
  }
}
