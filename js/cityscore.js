// js/cityscore.js — 城建評分引擎(PLAN_CITY §2.3 §4.1):建築 → civ 向量 → 六軸 → 繁榮度 / 人口 / 覆蓋率;城建版升級條件(§2.1)。
// 資料在 cityscore_data.js,介面在 cityscoreui.js。載入順序:cityscore_data.js 之後、prog.js 之前。
// 外部全域(OBJECTS、BUILD_GROUPS、estateObjects、prog…)一律 typeof 守衛並延遲讀取,與載入順序無關。
// 效能:一次重算 = O(物件數 + 地圖格數)。服務覆蓋用「每種服務一張積分圖」,每戶民居 O(1) 查詢;不逐物件掃半徑。112×112、3000 物件 < 數毫秒。
// 結果每 1 秒節流快取(cityscoreGet);放置預覽(cityscorePreview)另跑一次試算,不動快取。
// 全域名稱:cityInfo cityscoreCompute cityscoreGet cityscoreInvalidate cityscorePreview cityscoreTop cityDsum cityCondEval cityReqList cityUpgradeCheck cityUpgradeCost
//         cityUpgradeGoods cityUpgradeGoodsCheck cityUpgradeGoodsSpend cityscoreXpGain cityStars cityAxisVisible cityComment CITY_XP_PER_PROS。
// ES2017;不用 ?. ??。

var CITY_XP_PER_PROS = 1;   // 繁榮度每創新高 +1 點,給 1 點政績(PLAN 為 2;PLACEHOLDER)
var CITY_INFO = null;
var CITY_TRACK = null;      // 需要記位置的建築 id(cluster 條件用)
var cityCs = { res: null, t: 0 };
var CITY_DSUM = [0];        // D(n) 累計表

function cityDsum(n) {
  var i, s;
  if (n <= 0) return 0;
  if (n < CITY_DSUM.length) return CITY_DSUM[n];
  s = CITY_DSUM[CITY_DSUM.length - 1];
  for (i = CITY_DSUM.length; i <= n && i <= 400; i++) { s += Math.pow(CITY_D_RATE, i - 1); CITY_DSUM[i] = s; }
  if (n <= 400) return CITY_DSUM[n];
  return CITY_DSUM[400];   // 400 件之後幾乎不再增加
}

// ───── 分類 → 每種建築的評分資料 ─────
function cityBuildInfo() {
  var byId = {}, grp = {};
  CITY_INFO = {};
  Object.keys(CITY_CLASS_IDS).forEach(function (cls) { CITY_CLASS_IDS[cls].split(/\s+/).forEach(function (id) { if (id) byId[id] = cls; }); });
  if (typeof BUILD_GROUPS !== 'undefined') BUILD_GROUPS.forEach(function (g) { g.items.forEach(function (id) { if (!grp[id]) grp[id] = g.id; }); });
  CITY_INFO._byId = byId;
  CITY_INFO._grp = grp;
  CITY_TRACK = {};
  Object.keys(CITY_LV_REQ).forEach(function (L) {
    var r = CITY_LV_REQ[L];
    if (r) r.conds.forEach(function (c) { if (c.k === 'cluster') c.ids.forEach(function (id) { CITY_TRACK[id] = true; }); });
  });
}

function cityClassOf(id, d) {
  var i, cls = null;
  if (!CITY_INFO) cityBuildInfo();
  if (d.tier !== undefined && d.tier !== null) return 'dwell';
  if (id === 'house') return 'dwell';
  if (CITY_INFO._byId[id]) return CITY_INFO._byId[id];
  for (i = 0; i < CITY_CLASS_RULES.length; i++) if (CITY_CLASS_RULES[i][0].test(id)) return CITY_CLASS_RULES[i][1];
  if (d.side === 'camp') return 'camp';
  cls = CITY_GROUP_CLASS[CITY_INFO._grp[id]];
  return cls || 'misc';
}

// 回傳某建築的評分資料(null = 不是 OBJECTS 的 key)
function cityInfo(id) {
  var d, c, r, tier;
  if (typeof OBJECTS === 'undefined') return null;
  if (!CITY_INFO) cityBuildInfo();
  r = CITY_INFO[id];
  if (r) return r;
  d = OBJECTS[id];
  if (!d) return null;
  c = CITY_CLASS[cityClassOf(id, d)];
  r = { id: id, cls: cityClassOf(id, d), name: d.name || id, v: c.v, svc: c.svc || '', jobs: c.jobs || 0, shop: c.shop || 0, cult: c.cult || 0,
    road: c.roadCell || 0, water: c.waterCell || 0, w: d.w, h: d.h, swap: !!d.swap, tier: -1, res: 0, track: !!CITY_TRACK[id] };
  if (r.cls === 'dwell') {
    tier = (d.tier !== undefined && d.tier !== null) ? d.tier : 1;
    r.tier = Math.max(0, Math.min(4, tier));
    r.res = CITY_RES_OVR[id] || CITY_TIER_RES[r.tier];
  }
  CITY_INFO[id] = r;
  return r;
}

// ───── 計算 ─────
function citySvcIndexes() { return ['water', 'food', 'goods', 'safe', 'fun', 'cul']; }

// objs:物件陣列;board:{terrain}(可省略)。回傳統計物件
function cityscoreCompute(objs, board, lvOverride) {
  var W = 0, terr = null, N = 0, i, j, k, o, inf, w, h, cx, cy, x0, y0, x1, y1, cnt = {}, houses = [], svcs = citySvcIndexes(), grids = {}, ints = {}, pos = {},
    roadG, roadI, waterObjCells = 0, waterTiles = 0, tIdx, S, a, t, id, n, dv, val, landSide, lv, ax = [0, 0, 0, 0, 0, 0], contrib = [[], [], [], [], [], []],
    pop = 0, tiers = [0, 0, 0, 0, 0], covN = {}, nh, roadNear = 0, ncov, needs, sat, hv, occ, jobs = 0, labor = 1, kindsCls = {}, kindsAll = 0, cultKinds = 0, shopKinds = 0,
    ids, trade = false, noCount = (typeof PROG_CITY_XP !== 'undefined' && PROG_CITY_XP.noCount) ? PROG_CITY_XP.noCount : [], houseSum = {}, TR = (typeof T_ROAD !== 'undefined') ? T_ROAD : 3, TL = (typeof T_LAKE !== 'undefined') ? T_LAKE : 1, TV = (typeof T_RIVER !== 'undefined') ? T_RIVER : 2;
  objs = objs || [];
  if (board && board.terrain) terr = board.terrain;
  else if (typeof world !== 'undefined' && world && world.terrain) terr = world.terrain;
  W = terr ? Math.round(Math.sqrt(terr.length)) : 0;
  if (!W) { W = (typeof EST_W !== 'undefined') ? EST_W : 112; terr = null; }
  N = W * W;
  roadG = new Uint8Array(N);
  svcs.forEach(function (s) { covN[s] = 0; });
  if (terr) {
    for (i = 0; i < N; i++) {
      t = terr[i];
      if (t === TR) roadG[i] = 1;
      else if (t === TL || t === TV) waterTiles++;
    }
  }
  for (i = 0; i < objs.length; i++) {
    o = objs[i];
    inf = o && cityInfo(o.type);
    if (!inf) continue;
    cnt[o.type] = (cnt[o.type] || 0) + 1;
    if (inf.swap && (o.rot | 0) % 2 === 1) { w = inf.h; h = inf.w; } else { w = inf.w; h = inf.h; }
    cx = o.x + (w >> 1);
    cy = o.y + (h >> 1);
    if (cx < 0 || cy < 0 || cx >= W || cy >= W) continue;
    if (inf.cls === 'dwell') { houses.push(cx, cy, inf.tier, inf.res, o.type); continue; }
    if (inf.svc) {
      if (!grids[inf.svc]) grids[inf.svc] = new Int16Array(N);
      grids[inf.svc][cy * W + cx]++;
    }
    if (inf.track) { (pos[o.type] = pos[o.type] || []).push(cx, cy); }
    if (inf.road || inf.water) {
      x1 = Math.min(W, o.x + w); y1 = Math.min(W, o.y + h);
      for (j = Math.max(0, o.y); j < y1; j++) for (k = Math.max(0, o.x); k < x1; k++) {
        if (inf.road) roadG[j * W + k] = 1;
        if (inf.water) waterObjCells++;
      }
    }
  }
  // 積分圖(服務 + 道路)
  function integral(g) {
    var W1 = W + 1, I = new Int32Array(W1 * W1), x, y, row;
    for (y = 0; y < W; y++) {
      row = 0;
      for (x = 0; x < W; x++) { row += g[y * W + x]; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row; }
    }
    return I;
  }
  function query(I, x, y, r) {
    var W1 = W + 1, xa = Math.max(0, x - r), ya = Math.max(0, y - r), xb = Math.min(W, x + r + 1), yb = Math.min(W, y + r + 1);
    return I[yb * W1 + xb] - I[ya * W1 + xb] - I[yb * W1 + xa] + I[ya * W1 + xa];
  }
  Object.keys(grids).forEach(function (s) { ints[s] = integral(grids[s]); });
  roadI = integral(roadG);
  // 民居:覆蓋、品級分、人口
  nh = houses.length / 5;
  for (i = 0; i < houses.length; i += 5) {
    tiers[houses[i + 2]]++;
    needs = CITY_TIER_NEEDS[houses[i + 2]];
    sat = 0;
    svcs.forEach(function (s) {
      var c = ints[s] ? query(ints[s], houses[i], houses[i + 1], CITY_SVC[s].r) > 0 : false;
      if (c) covN[s]++;
      if (c && needs.indexOf(s) >= 0) sat++;
    });
    sat = sat / needs.length;
    hv = CITY_TIER_SCORE[houses[i + 2]] * (0.5 + 0.5 * sat);
    occ = 0.6 + 0.4 * sat;
    pop += houses[i + 3] * occ;
    ax[0] += hv;
    houseSum[houses[i + 4]] = (houseSum[houses[i + 4]] || 0) + hv;
    if (query(roadI, houses[i], houses[i + 1], 2) > 0) roadNear++;
  }
  pop = Math.round(pop);
  Object.keys(houseSum).forEach(function (id2) { contrib[0].push({ id: id2, name: cityInfo(id2).name, n: cnt[id2], v: houseSum[id2] }); });
  // 其他建築:civ × D(n)
  ids = Object.keys(cnt);
  for (i = 0; i < ids.length; i++) {
    id = ids[i];
    inf = cityInfo(id);
    n = cnt[id];
    if (inf.cls === 'dwell') continue;
    jobs += inf.jobs * n;
    if (noCount.indexOf(id) < 0) kindsAll++;
    kindsCls[inf.cls] = (kindsCls[inf.cls] || 0) + 1;
    if (inf.shop) shopKinds++;
    if (inf.cult) cultKinds++;
    if (CITY_TRADE_IDS.indexOf(id) >= 0) trade = true;
    dv = cityDsum(n);
    for (a = 0; a < 6; a++) {
      if (inf.v[a] > 0) { val = inf.v[a] * dv; ax[a] += val; contrib[a].push({ id: id, name: inf.name, n: n, v: val }); }
    }
  }
  ids.forEach(function (id2) { var f = cityInfo(id2); if (f.cls === 'dwell' && noCount.indexOf(id2) < 0) kindsAll++; if (f.cls === 'dwell') kindsCls.dwell = (kindsCls.dwell || 0) + 1; });
  // 勞力上限:產業軸 ≤ 人口 × CITY_IND_PER_POP(勞力不足 = 產業打折,不會停擺;用 min 使「多蓋一棟」永遠不會讓分數下降)
  if (ax[5] > pop * CITY_IND_PER_POP) {
    labor = ax[5] > 0 ? pop * CITY_IND_PER_POP / ax[5] : 1;
    ax[5] *= labor;
    contrib[5].forEach(function (c) { c.v *= labor; });
  }
  // 軸專屬項
  lv = lvOverride || ((typeof prog !== 'undefined' && prog) ? prog.lv : 1);
  landSide = W;   // NL0:經營板全圖開放
  val = Math.min(waterTiles * 0.3, landSide * landSide * 0.02);
  if (val > 0) { ax[1] += val; contrib[1].push({ id: '_water', name: '水面', n: waterTiles, v: val }); }
  if (nh > 0) {
    val = roadNear;
    if (val > 0) { ax[2] += val; contrib[2].push({ id: '_road', name: '道路連通', n: roadNear, v: val }); }
    val = covN.safe;
    if (val > 0) { ax[2] += val; contrib[2].push({ id: '_safe', name: '守望覆蓋', n: covN.safe, v: val }); }
  }
  if (cultKinds > 0) { val = cultKinds * 3; ax[3] += val; contrib[3].push({ id: '_cult', name: '文類多樣', n: cultKinds, v: val }); }
  if (shopKinds > 0) { val = shopKinds * 2; ax[4] += val; contrib[4].push({ id: '_shop', name: '店鋪多樣', n: shopKinds, v: val }); }
  if (trade) { ax[4] += 10; contrib[4].push({ id: '_trade', name: '對外商路', n: 1, v: 10 }); }
  S = { axes: {}, pros: 0, pop: pop, houses: nh, tiers: tiers, cover: {}, cnt: cnt, kindsCls: kindsCls, kindsAll: kindsAll, cultKinds: cultKinds, shopKinds: shopKinds,
    waterTiles: waterTiles, waterCells: waterTiles + waterObjCells, roadFrac: nh > 0 ? roadNear / nh : 0, walls: (cnt.wall || 0) + (cnt.wall_courtyard || 0),
    trade: trade, pos: pos, labor: labor, jobs: jobs, contrib: {}, n: objs.length, lv: lv, t: 0 };
  for (a = 0; a < 6; a++) {
    S.axes[CITY_AXES[a].id] = ax[a];
    S.contrib[CITY_AXES[a].id] = contrib[a];
    S.pros += ax[a];
  }
  S.pros = Math.round(S.pros);
  svcs.forEach(function (s) { S.cover[s] = nh > 0 ? covN[s] / nh : 0; });
  return S;
}

// 目前經營棋盤的評分(每 1 秒節流快取;force = 立即重算)
function cityscoreGet(force) {
  var now = Date.now(), objs = [], board = null;
  if (!force && cityCs.res && now - cityCs.t < 1000) return cityCs.res;
  if (typeof estateObjects === 'function') { try { objs = estateObjects() || []; board = (typeof estateBoard === 'function') ? estateBoard() : null; } catch (e) { objs = []; } }
  cityCs.res = cityscoreCompute(objs, board);
  cityCs.t = now;
  return cityCs.res;
}
function cityscoreInvalidate() { cityCs.res = null; cityCs.t = 0; }

// 放置預覽:在目前盤面加上 (type,x,y,rot)(移動時 orig 是被拿起的原物件,不重複計),回傳各軸 / 繁榮度 / 人口差
function cityscorePreview(type, x, y, rot, orig) {
  var base = cityscoreGet(false), objs = [], board = null, list, r, d = {}, out;
  if (!cityInfo(type)) return null;
  if (typeof estateObjects === 'function') { objs = estateObjects() || []; board = (typeof estateBoard === 'function') ? estateBoard() : null; }
  list = orig ? objs.filter(function (o) { return o !== orig; }) : objs.slice();
  list.push({ type: type, x: x, y: y, rot: rot | 0 });
  r = cityscoreCompute(list, board);
  CITY_AXES.forEach(function (a) { d[a.id] = r.axes[a.id] - base.axes[a.id]; });
  out = { d: d, pros: r.pros - base.pros, pop: r.pop - base.pop };
  return out;
}

// 某軸貢獻前 n 名
function cityscoreTop(S, axis, n) {
  return (S.contrib[axis] || []).slice().sort(function (p, q) { return q.v - p.v; }).slice(0, n || 5);
}

// 星級(0~5):目標 = 下一級繁榮度門檻 × 軸權重
function cityStars(S, axis, lv) {
  var target = cityProsperityReq(Math.min(PROG_LV_MAX - 1, lv + 1)) * (CITY_AXIS_WEIGHT[axis] || 0.1);
  return Math.max(0, Math.min(5, Math.floor(5 * (S.axes[axis] || 0) / Math.max(1, target))));
}
function cityAxisVisible(axis, lv) { return lv >= CITY_AXIS_BY_ID[axis].reveal; }

// 一句評語:服務缺口優先,其次最低的已揭露軸(相對目標)
function cityComment(S, lv) {
  var worst = null, wr = 9, i, a, r, house = S.houses;
  if (house > 0 && S.cover.water < 0.99) return '有 ' + Math.ceil(house * (1 - S.cover.water)) + ' 戶民居喝不到水:在它們 6 格內蓋口水井。';
  if (house > 0 && lv >= 2 && S.cover.food < 0.7) return '糧食有點遠:民居旁種些田、備些糧。';
  for (i = 0; i < CITY_AXES.length; i++) {
    a = CITY_AXES[i];
    if (!cityAxisVisible(a.id, lv)) continue;
    r = (S.axes[a.id] || 0) / Math.max(1, cityProsperityReq(Math.min(PROG_LV_MAX - 1, lv + 1)) * CITY_AXIS_WEIGHT[a.id]);
    if (r < wr) { wr = r; worst = a.id; }
  }
  if (worst && wr < 1) return CITY_PHRASE[worst];
  return CITY_PHRASE.none;
}

// ───── 營造要求 / 升級條件 ─────
// 回傳 { ok, have, need }(have / need 供顯示)
function cityCondEval(c, S, lv) {
  var ids, n = 0, i, m, have, need, req = cityProsperityReq(lv), best = 0, an, pos, p, q, ok, hit;
  switch (c.k) {
    case 'dwell': have = S.houses; need = c.n; break;
    case 'tier': have = 0; for (i = c.t; i < 5; i++) have += S.tiers[i]; need = c.n; break;
    case 'types': have = 0; c.ids.forEach(function (id) { have += S.cnt[id] || 0; }); need = c.n; break;
    case 'kinds': have = 0; c.cls.forEach(function (cl) { have += S.kindsCls[cl] || 0; }); need = c.n; break;
    case 'kindsAll': have = S.kindsAll; need = c.n; break;
    case 'cover': have = S.houses > 0 ? Math.floor(S.cover[c.svc] * 100 + 1e-6) : 0; need = Math.round(c.frac * 100); break;
    case 'roadnear': have = S.houses > 0 ? Math.floor(S.roadFrac * 100 + 1e-6) : 0; need = Math.round(c.frac * 100); break;
    case 'water': have = S.waterCells; need = c.n; break;
    case 'trade': have = S.trade ? 1 : 0; need = 1; break;
    case 'walls': have = S.walls; need = c.n; break;
    case 'axis': have = Math.round(S.axes[c.a]); need = Math.round(c.f * req); break;
    case 'axesAll': have = Infinity; CITY_AXES.forEach(function (a) { have = Math.min(have, S.axes[a.id]); }); have = Math.round(have); need = Math.round(c.f * req); break;
    case 'cluster':
      need = c.ids.length;
      pos = S.pos[c.ids[0]] || [];
      for (i = 0; i < pos.length; i += 2) {
        hit = 1;
        for (m = 1; m < c.ids.length; m++) {
          p = S.pos[c.ids[m]] || [];
          ok = false;
          for (q = 0; q < p.length; q += 2) if (Math.abs(p[q] - pos[i]) <= c.d && Math.abs(p[q + 1] - pos[i + 1]) <= c.d) { ok = true; break; }
          if (ok) hit++;
        }
        if (hit > best) best = hit;
      }
      have = best;
      break;
    default: have = 0; need = 1;
  }
  return { ok: have >= need, have: have, need: need };
}

// 某級(升到 lv+1)的營造要求評估;滿級回 null
function cityReqList(lv, S) {
  var r = CITY_LV_REQ[lv], out, all = true;
  if (!r) return null;
  S = S || cityscoreGet(false);
  out = { id: r.id, title: r.title, big: !!r.big, conds: [], ok: true };
  r.conds.forEach(function (c) {
    var e = cityCondEval(c, S, lv);
    out.conds.push({ cond: c, ok: e.ok, have: e.have, need: e.need, text: c.text, go: c.go || [] });
    if (!e.ok) all = false;
  });
  out.ok = all;
  return out;
}

// 貨品鉤子(PLAN_CITY §23.4;貨品系統 js/goods.js 由另一個代理做;其 cityGoodsReq(req, opt) / cityGoodsSpend(req, opt) 是庫房檢查 / 扣繳介面,故本檔的鉤子另取名):
//   cityUpgradeGoods(lv):該級的貨品需求 { 貨品id: 數量 },由全域 goodsUpgradeReq(lv) 提供;沒有該函式(貨品需求表尚未接入)回空物件。
//   cityUpgradeGoodsCheck(lv):缺料原因字串('' = 夠)。可由全域 goodsUpgradeCheck(lv) 自訂;否則用 goods.js 的 cityGoodsReq 檢查 cityUpgradeGoods(lv)。
//   cityUpgradeGoodsSpend(lv):升級成功時扣繳(goods.js 的 cityGoodsSpend);progDoUpgrade 呼叫。
// 整合方式:貨品代理只要定義 goodsUpgradeReq(lv) 回傳需求表,本檔就會把它列進升級抽屜 / 條件檢查 / 扣繳,不需再改本檔。
function cityUpgradeGoods(lv) { return (typeof goodsUpgradeReq === 'function') ? (goodsUpgradeReq(lv) || {}) : {}; }
function cityUpgradeGoodsCheck(lv) {
  var req = cityUpgradeGoods(lv), chk, ids, names;
  if (typeof goodsUpgradeCheck === 'function') return goodsUpgradeCheck(lv) || '';
  if (!Object.keys(req).length || typeof cityGoodsReq !== 'function') return '';
  chk = cityGoodsReq(req, { legacy: true });
  if (chk && chk.ok) return '';
  ids = chk ? Object.keys(chk.short || {}) : Object.keys(req);
  names = ids.map(function (id) { return ((typeof GOODS !== 'undefined' && GOODS[id] && GOODS[id].name) || id) + '(缺 ' + ((chk && chk.short && chk.short[id]) || req[id]) + ')'; });
  return '貨品不足:' + names.join('、');
}
function cityUpgradeGoodsSpend(lv) {
  var req = cityUpgradeGoods(lv);
  if (!Object.keys(req).length || typeof cityGoodsSpend !== 'function') return true;
  return cityGoodsSpend(req, { legacy: true });
}

// 城建版 cityUpgradeCost(lv):資源 ×0.6 + 政績 + 繁榮度 / 人口門檻 + 營造要求(結構;不含材料 / 首領營 / 教學)。k = lv²(progdata.js 傳入,省略則自算)
function cityUpgradeCost(lv, k) {
  var kk = (k === undefined) ? lv * lv : k;
  return {
    res: { coin: Math.round(500 * kk * CITY_RES_MUL), wood: Math.round(150 * kk * CITY_RES_MUL), stone: Math.round(100 * kk * CITY_RES_MUL) },
    xp: PROG_CITY_NEED(lv), mats: {}, boss: null, ftue: null,
    pros: cityProsperityReq(lv), pop: cityPopReq(lv), req: CITY_LV_REQ[lv] || null, goods: cityUpgradeGoods(lv)
  };
}

// 城建專注模式的升級條件檢查(繁榮度 → 人口 → 營造要求 → 貨品鉤子)。回傳 { ok, reason }
function cityUpgradeCheck(lv) {
  var S = cityscoreGet(true), rl, bad, g;
  if (S.pros < cityProsperityReq(lv)) return { ok: false, reason: '繁榮度不足(' + S.pros + ' / ' + cityProsperityReq(lv) + ')' };
  if (S.pop < cityPopReq(lv)) return { ok: false, reason: '人口不足(' + S.pop + ' / ' + cityPopReq(lv) + ')' };
  rl = cityReqList(lv, S);
  if (rl && !rl.ok) {
    bad = rl.conds.filter(function (c) { return !c.ok; })[0];
    return { ok: false, reason: '營造要求未達:' + bad.text + '(' + bad.have + ' / ' + bad.need + ')' };
  }
  g = cityUpgradeGoodsCheck(lv);
  if (g) return { ok: false, reason: g };
  return { ok: true, reason: '' };
}

// 繁榮度創新高 → 政績(p.city.high:歷史最高;-1 = 尚未記錄,第一次只記下不給,舊存檔不暴衝)。由 prog.js progCityCheck 呼叫
function cityscoreXpGain(p) {
  var S = cityscoreGet(false), g = 0;
  if (!p || !p.city) return 0;
  if (typeof p.city.high !== 'number' || p.city.high < 0) { p.city.high = S.pros; return 0; }
  if (S.pros > p.city.high) { g = Math.floor((S.pros - p.city.high) * CITY_XP_PER_PROS); p.city.high = S.pros; }
  return g;
}
