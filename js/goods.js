// js/goods.js — 生產鏈執行層(PLAN_CITY.md §23,CT6a):全城共用庫房 world.city.inv、工坊自動取料、道路連通、上限與溢出自動賣、
// 離線結算(≤ 48 步)、舊材料一次性遷移、最小「庫房」面板。資料與數字全在 goodsdata.js。
// 載入順序:goodsdata.js 之後(index.html、sw.js PRECACHE 同步)。外部全域(world、estateBoard、prog…)一律 typeof 守衛。
// 掛點:map.js tickResources → cityGoodsTick(dt);applyOfflineGains → cityGoodsOffline(sec);存讀檔 → goodsNormCity。
// 對外介面(升級條件之後接這裡):cityGoodsHave(id) / cityGoodsReq(req, opt) / cityGoodsSpend(req, opt) / cityGoodsAdd(id, n)。
// 內部格式:庫存為浮點(工坊可部分運轉),顯示與扣繳一律無條件捨去取整;木 / 石仍存在 world.res(頂列資源,無上限),用 debt 累積小數。
// ES2017;不用 ?. ??。

var goodsAcc = 0;            // 線上結算的 dt 累積
var goodsPlanCache = null;   // 工坊 / 道路連通判定快取
var goodsStatus = {};        // 'x,y' → 最近一次結算的工坊狀態(給面板;不存檔)
var goodsLast = null;        // 最近一次離線結算摘要
var goodsPanelOpen = false;

function goodsNum(v) { return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0; }
function goodsRound(v) { return Math.round(v * 10000) / 10000; }

// 正規化 world.city(讀檔 / 補預設);未知貨品丟棄,壞值歸零
function goodsNormCity(v) {
  var c = { inv: {}, sel: {}, autoSell: true, debt: {}, coinFrac: 0 }, k;
  if (v && typeof v === 'object') {
    if (v.inv && typeof v.inv === 'object') {
      for (k in v.inv) if (GOODS[k] && !GOODS[k].res) { var n = goodsNum(v.inv[k]); if (n > 0) c.inv[k] = goodsRound(n); }
    }
    if (v.sel && typeof v.sel === 'object') {
      for (k in v.sel) if (typeof v.sel[k] === 'string' && RECIPES[v.sel[k]]) c.sel[k] = v.sel[k];
    }
    c.autoSell = v.autoSell !== false;
    if (v.debt && typeof v.debt === 'object') {
      for (k in v.debt) if (GOODS[k] && GOODS[k].res) c.debt[k] = Math.min(0.9999, goodsNum(v.debt[k]));
    }
    c.coinFrac = Math.min(0.9999, goodsNum(v.coinFrac));
    if (typeof themeSkinHas === 'function' && themeSkinHas(v.theme) && v.theme !== 'han') c.theme = v.theme;   // 城市風格(theme_skin.js);預設漢不存
    if (v.adv && typeof advNormSave === 'function') c.adv = advNormSave(v.adv);   // 顧問已完成 / 已忽略 id(cityadvisor.js)
    if (v.cards && typeof cardsNormSave === 'function') { var cd = cardsNormSave(v.cards); if (cd) c.cards = cd; }   // 酒館 / 名冊(cards.js)
  }
  return c;
}

// 取得(必要時建立)world.city;world 不存在回 null
function goodsCity() {
  if (typeof world === 'undefined' || !world) return null;
  if (!world.city || typeof world.city !== 'object' || !world.city.inv) world.city = goodsNormCity(world.city);
  return world.city;
}

// ───────── 庫存存取 ─────────
function goodsCapOf(id) { return goodsCapBase(id) * goodsCapMul(id); }
function goodsCapMul(id) { return 1; }   // 掛點:庫房建築 / 科技加成(CT6d)
function goodsLaborMul(entry) { return 1; }   // 掛點:勞力比 / 派駐(§4.2、PLAN_CARDS)
function goodsTechMul(key) { return typeof techMul === 'function' ? techMul(key) : 1; }
function goodsProdMul(entry, tech) {
  var m = goodsLaborMul(entry);
  if (tech) m *= goodsTechMul('goods.' + tech);
  return m * goodsTechMul('goods.all');
}

// 精確持有量(浮點;res 貨品 = world.res 扣掉未結清的小數債)
function goodsRaw(id) {
  var g = GOODS[id], c = goodsCity();
  if (!g || !c) return 0;
  if (g.res) return Math.max(0, ((typeof world !== 'undefined' && world.res[g.res]) || 0) - (c.debt[id] || 0));
  return c.inv[id] || 0;
}
// 顯示 / 扣繳用整數(無條件捨去,容許浮點誤差)
function cityGoodsHave(id) { return Math.floor(goodsRaw(id) + 1e-6); }

// 取走 x 單位(呼叫前已確認足夠);res 貨品以債累積、滿 1 才扣 world.res
function goodsTake(id, x) {
  var g = GOODS[id], c = goodsCity();
  if (!g || !c || !(x > 0)) return;
  if (g.res) {
    var d = (c.debt[id] || 0) + x, w = Math.floor(d);
    if (w > 0) { world.res[g.res] = Math.max(0, (world.res[g.res] || 0) - w); d -= w; }
    c.debt[id] = goodsRound(d);
    return;
  }
  c.inv[id] = Math.max(0, goodsRound((c.inv[id] || 0) - x));
}

// 加入庫存(不受上限,獎勵 / 遷移 / 退款用);回傳實際加入量
function cityGoodsAdd(id, n) {
  var g = GOODS[id], c = goodsCity();
  n = goodsNum(n);
  if (!g || !c || n <= 0) return 0;
  if (g.res) { world.res[g.res] = (world.res[g.res] || 0) + Math.floor(n); return Math.floor(n); }
  c.inv[id] = goodsRound((c.inv[id] || 0) + n);
  return n;
}

// 把產出 x 放進庫存:超過上限的部分依 autoSell 賣給市集(轉金幣)或截斷。回傳 { stored, sold, coin }
function goodsStore(id, x, tally) {
  var g = GOODS[id], c = goodsCity(), room, put, over, coin = 0;
  if (!g || !c || !(x > 0)) return { stored: 0, sold: 0, coin: 0 };
  if (g.res) { goodsRes(id, x); if (tally) tally[id] = (tally[id] || 0) + x; return { stored: x, sold: 0, coin: 0 }; }
  room = Math.max(0, goodsCapOf(id) - (c.inv[id] || 0));
  put = Math.min(x, room);
  over = x - put;
  if (put > 0) { c.inv[id] = goodsRound((c.inv[id] || 0) + put); if (tally) tally[id] = (tally[id] || 0) + put; }
  if (over > 0 && c.autoSell) {
    coin = over * goodsPrice(id) * GOODS_SELL_MUL;
    c.coinFrac += coin;
    var w = Math.floor(c.coinFrac);
    if (w > 0 && typeof world !== 'undefined' && world.res) { world.res.coin = (world.res.coin || 0) + w; c.coinFrac -= w; }
    if (tally) tally.coin = (tally.coin || 0) + coin;
    return { stored: put, sold: over, coin: coin };
  }
  return { stored: put, sold: 0, coin: 0 };
}
function goodsRes(id, x) {   // res 貨品入庫:小數以負的 debt 暫存,滿 1 才加進 world.res(目前沒有配方產出木 / 石,預留)
  var c = goodsCity(), g = GOODS[id];
  c.debt[id] = (c.debt[id] || 0) - x;    // 負債 = 存款
  var w = Math.floor(-c.debt[id]);
  if (w > 0) { world.res[g.res] = (world.res[g.res] || 0) + w; c.debt[id] += w; }
}

// ───────── 升級 / 工程消耗介面(CT2 接軌)─────────
// req = { 貨品id: 數量 };opt.legacy = true 時,T3 缺口可用良材料、T4 缺口可用珍材料 1:1 代繳(§23.1.3)
// 回傳 { ok, short:{id:缺口數}, useLegacy:{tier:數量} };只檢查不扣
function cityGoodsReq(req, opt) {
  var out = { ok: true, short: {}, useLegacy: { u: 0, r: 0 } }, id, need, have, gap, leg;
  opt = opt || {};
  for (id in req) {
    if (!GOODS[id]) { out.ok = false; out.short[id] = req[id]; continue; }
    need = Math.max(0, Math.floor(req[id]));
    have = cityGoodsHave(id);
    gap = need - have;
    if (gap > 0 && opt.legacy && (GOODS[id].tier === 3 || GOODS[id].tier === 4)) {
      var tk = GOODS[id].tier === 3 ? 'u' : 'r';
      leg = Math.max(0, goodsLegacyCount(tk) - out.useLegacy[tk]);
      var use = Math.min(gap, leg);
      out.useLegacy[tk] += use;
      gap -= use;
    }
    if (gap > 0) { out.ok = false; out.short[id] = gap; }
  }
  return out;
}
// 良('u')/ 珍('r')材料總數(留在 prog.mats)
function goodsLegacyCount(tier) {
  var p = typeof progGet === 'function' ? progGet() : null, n = 0;
  if (!p || typeof PROG_MATS === 'undefined') return 0;
  Object.keys(PROG_MATS).forEach(function (m) { if (PROG_MATS[m].tier === tier) n += (p.mats[m] || 0); });
  return n;
}
// 原子扣除:不足回 false 且不動庫存
function cityGoodsSpend(req, opt) {
  var chk = cityGoodsReq(req, opt), id, need, take, p;
  if (!chk.ok) return false;
  for (id in req) {
    need = Math.max(0, Math.floor(req[id]));
    take = Math.min(need, cityGoodsHave(id));
    if (take > 0) goodsTake(id, take);
  }
  ['u', 'r'].forEach(function (tk) {
    var left = chk.useLegacy[tk];
    if (left <= 0) return;
    p = progGet();
    Object.keys(PROG_MATS).forEach(function (m) {
      if (left <= 0 || PROG_MATS[m].tier !== tk) return;
      var t = Math.min(left, p.mats[m] || 0);
      p.mats[m] -= t; left -= t;
    });
    if (typeof progSave === 'function') progSave();
  });
  return true;
}

// ───────── 舊材料遷移(§23.1.3):9 種普材料複製進庫房,旗標 prog.city.matMigrated;只做一次 ─────────
function goodsMigrateMats(force) {
  var p = typeof progGet === 'function' ? progGet() : null, c = goodsCity();
  if (!p || !c || !p.city || p.city.matMigrated) return false;
  if (!force && !(typeof isCityOnly === 'function' && isCityOnly())) return false;
  GOODS_LEGACY_MATS.forEach(function (id) {
    var n = Math.floor(goodsNum(p.mats && p.mats[id]));
    if (n > 0) c.inv[id] = goodsRound((c.inv[id] || 0) + n);   // 超過上限照樣保留,不截斷
  });
  p.city.matMigrated = 1;
  if (typeof progSave === 'function') progSave();
  return true;
}

// ───────── 工坊 / 道路連通計畫(快取)─────────
function goodsInvalidate() { goodsPlanCache = null; }

// 建立 label 圖:道路格(T_ROAD 或橋 / 城門等物件所在格)連通成分編號
function goodsRoadLabels(b, W) {
  var N = W * W, road = new Uint8Array(N), lab = new Int32Array(N), n = 0, i, x, y;
  for (i = 0; i < N; i++) if (b.terrain[i] === T_ROAD) road[i] = 1;
  (b.objects || []).forEach(function (o) {
    if (GOODS_ROADLIKE.indexOf(o.type) < 0 || !OBJECTS[o.type]) return;
    var f = footprint(o.type, o.rot | 0);
    for (y = o.y; y < o.y + f[1]; y++) for (x = o.x; x < o.x + f[0]; x++) if (x >= 0 && y >= 0 && x < W && y < W) road[y * W + x] = 1;
  });
  var stack = [];
  for (i = 0; i < N; i++) {
    if (!road[i] || lab[i]) continue;
    n++;
    lab[i] = n; stack.push(i);
    while (stack.length) {
      var c = stack.pop(), cx = c % W, cy = (c - cx) / W, nb = [cx > 0 ? c - 1 : -1, cx < W - 1 ? c + 1 : -1, cy > 0 ? c - W : -1, cy < W - 1 ? c + W : -1];
      for (var k = 0; k < 4; k++) { var j = nb[k]; if (j >= 0 && road[j] && !lab[j]) { lab[j] = n; stack.push(j); } }
    }
  }
  return lab;
}
// 物件外框(含自身格)周圍一圈的道路 label 集合
function goodsRingLabels(o, f, lab, W) {
  var out = {}, x, y;
  for (y = o.y - 1; y <= o.y + f[1]; y++) for (x = o.x - 1; x <= o.x + f[0]; x++) {
    if (x < 0 || y < 0 || x >= W || y >= W) continue;
    var l = lab[y * W + x];
    if (l) out[l] = true;
  }
  return out;
}

function goodsPlan(force) {
  var b = typeof estateBoard === 'function' ? estateBoard() : null, c = goodsCity();
  if (!b || !c || !b.terrain) return { entries: [], age: 0, objs: null, n: 0 };
  if (!force && goodsPlanCache && goodsPlanCache.objs === b.objects && goodsPlanCache.n === b.objects.length && goodsPlanCache.age < GOODS_PLAN_SEC) return goodsPlanCache;
  var W = Math.round(Math.sqrt(b.terrain.length)), lab = goodsRoadLabels(b, W), palace = null, entries = [];
  b.objects.forEach(function (o) {
    if (o.type !== 'palace' || !OBJECTS.palace) return;
    var ring = goodsRingLabels(o, footprint('palace', o.rot | 0), lab, W);
    palace = palace || {};
    for (var l in ring) palace[l] = true;
  });
  function connected(o) {
    var f = footprint(o.type, o.rot | 0), ring = goodsRingLabels(o, f, lab, W), l;
    for (l in ring) if (!palace || palace[l]) return true;
    return false;
  }
  var ores = {};
  b.objects.forEach(function (o) {
    goodsNearTypes().forEach(function (t) { if (o.type === t) (ores[t] = ores[t] || []).push(o); });
  });
  b.objects.forEach(function (o) {
    if (!OBJECTS[o.type]) return;
    var f = footprint(o.type, o.rot | 0), key = o.x + ',' + o.y, i;
    goodsSourcesFor(o.type).forEach(function (sid) {
      var s = GOODS_SOURCES[sid], ok = true;
      if (s.near) {
        var cx = o.x + f[0] / 2, cy = o.y + f[1] / 2;
        ok = (ores[s.near.type] || []).some(function (q) {
          var qf = footprint(q.type, q.rot | 0);
          return Math.abs(q.x + qf[0] / 2 - cx) <= s.near.r && Math.abs(q.y + qf[1] / 2 - cy) <= s.near.r;
        });
      }
      entries.push({ kind: 'src', sid: sid, type: o.type, x: o.x, y: o.y, key: key, ok: ok, conn: true, tier: -1 });
    });
    var rids = goodsRecipesFor(o.type);
    if (rids.length) {
      var rid = c.sel[key] && rids.indexOf(c.sel[key]) >= 0 ? c.sel[key] : rids[0];
      var out0 = Object.keys(RECIPES[rid].out)[0];
      entries.push({ kind: 'rec', rid: rid, rids: rids, type: o.type, x: o.x, y: o.y, key: key, ok: true, conn: connected(o), tier: goodsTier(out0) });
    }
  });
  // 結算順序:原料點 → 工坊(階別由低到高)→ 位置(確定性)
  entries.sort(function (a, z) { return (a.tier - z.tier) || (a.y - z.y) || (a.x - z.x) || (a.kind < z.kind ? -1 : a.kind > z.kind ? 1 : 0); });
  goodsPlanCache = { entries: entries, age: 0, objs: b.objects, n: b.objects.length };
  return goodsPlanCache;
}
var goodsNearTypesCache = null;
function goodsNearTypes() {
  if (!goodsNearTypesCache) {
    var seen = {};
    Object.keys(GOODS_SOURCES).forEach(function (s) { if (GOODS_SOURCES[s].near) seen[GOODS_SOURCES[s].near.type] = true; });
    goodsNearTypesCache = Object.keys(seen);
  }
  return goodsNearTypesCache;
}

// ───────── 結算 ─────────
// dt = 真實秒;mul = 倍率(線上 1、離線 offlineRate());產出與消耗同乘。回傳本步入庫量表 tally
function goodsStep(dt, mul, noAge) {
  var c = goodsCity(), plan, dtH, tally = {}, status = {}, tool = GOODS_FARM_TOOL, farms = 0, haveTool;
  if (!c || !(dt > 0)) return tally;
  plan = goodsPlan();
  if (!noAge) plan.age += dt;
  dtH = dt / GOODS_HOUR_SEC * mul;
  haveTool = goodsRaw(tool.id) > 1e-6;
  plan.entries.forEach(function (e) {
    var st, n, id, f, miss, rec, pm;
    if (e.kind === 'src') {
      var s = GOODS_SOURCES[e.sid];
      if (!e.ok) { status[e.key] = { kind: 'src', sid: e.sid, state: 'noore', eff: 0 }; return; }
      pm = goodsProdMul(e, null) * (s.farm && haveTool ? tool.bonus : 1);
      var full = false;
      for (id in s.out) {
        var amt = s.out[id] * pm * dtH, r = goodsStore(id, amt, tally);
        if (!c.autoSell && r.stored < amt - 1e-9) full = true;
      }
      if (s.farm) farms++;
      status[e.key] = { kind: 'src', sid: e.sid, state: full ? 'full' : 'run', eff: pm };
      return;
    }
    rec = RECIPES[e.rid];
    pm = goodsProdMul(e, rec.tech) * (e.conn ? 1 : GOODS_ROAD_MUL);
    n = rec.rate * pm * dtH;
    f = 1; miss = null;
    for (id in rec.in) {
      var need = rec.in[id] * n;
      if (need > 0) { var ratio = goodsRaw(id) / need; if (ratio < f) { f = ratio; miss = id; } }
    }
    if (!c.autoSell) {
      for (id in rec.out) {
        var want = rec.out[id] * n * f;
        if (want > 0) { var room = Math.max(0, goodsCapOf(id) - goodsRaw(id)), rr = room / want; if (rr < 1) { f *= rr; miss = '#full'; } }
      }
    }
    if (!(f > 1e-6)) f = 0;
    if (f > 0) {
      for (id in rec.in) goodsTake(id, rec.in[id] * n * f);
      for (id in rec.out) goodsStore(id, rec.out[id] * n * f, tally);
    }
    st = f >= 0.999 ? 'run' : (f > 0 ? 'short' : (miss === '#full' ? 'full' : 'blocked'));
    status[e.key] = { kind: 'rec', rid: e.rid, state: st, miss: miss === '#full' ? null : miss, eff: pm * f, conn: e.conn };
  });
  if (farms > 0 && haveTool) goodsTake(tool.id, Math.min(goodsRaw(tool.id), farms * tool.use * dtH));
  goodsStatus = status;
  return tally;
}

// 線上:tickResources(dt) 每幀呼叫;累積到 GOODS_STEP_SEC 才結算一次
function cityGoodsTick(dt) {
  if (!(dt > 0)) return;
  goodsAcc += dt;
  if (goodsAcc < GOODS_STEP_SEC) return;
  var d = goodsAcc;
  goodsAcc = 0;
  if (!goodsCity()) return;
  goodsMigrateMats(false);
  goodsStep(d, 1);
  if (goodsPanelOpen) goodsPanelRender();
}

// 離線:最多 48 步、每步 ≥ 10 分鐘,產出與消耗同乘 offlineRate();回傳摘要 { sec, steps, gain, coin }
function cityGoodsOffline(sec) {
  var c = goodsCity();
  if (!c || !(sec > 0)) return null;
  goodsMigrateMats(false);
  var N = Math.min(GOODS_OFFLINE_STEPS, Math.max(1, Math.ceil(sec / GOODS_OFFLINE_MIN_STEP))), dt = sec / N;
  var mul = typeof offlineRate === 'function' ? offlineRate() : 0.5, gain = {}, i, id;
  goodsPlan(true);
  for (i = 0; i < N; i++) {
    var t = goodsStep(dt, mul, true);
    for (id in t) gain[id] = (gain[id] || 0) + t[id];
  }
  var coin = gain.coin || 0;
  delete gain.coin;
  goodsLast = { sec: sec, steps: N, gain: gain, coin: coin, blocked: goodsBlockedList() };
  goodsAcc = 0;
  return goodsLast;
}
function goodsBlockedList() {
  var miss = {};
  Object.keys(goodsStatus).forEach(function (k) { var s = goodsStatus[k]; if (s.state === 'blocked' && s.miss) miss[s.miss] = true; });
  return Object.keys(miss);
}

// 離線摘要文字(「回來小卡」用):庫房 +麻布 6、…;缺料:○○
function goodsOfflineText() {
  if (!goodsLast) return '';
  var parts = [];
  Object.keys(goodsLast.gain).forEach(function (id) {
    var n = Math.floor(goodsLast.gain[id]);
    if (n > 0) parts.push('+' + goodsName(id) + ' ' + n);
  });
  var s = parts.length ? '庫房 ' + parts.join('、') : '';
  if (goodsLast.blocked.length) s += (s ? ';' : '') + '缺料:' + goodsLast.blocked.map(goodsName).join('、');
  return s;
}

// ───────── 面板資料(也供測試)─────────
var GOODS_STATE_TEXT = { run: '運轉中', short: '原料不足,部分運轉', blocked: '停工', full: '庫存已滿,停工', noore: '缺礦脈' };
// 回傳 [{ key, name, icon, x, y, recipe, state, text, conn, rids }];沒跑過結算的建築顯示「等待結算」
function goodsWorkshopList() {
  var plan = goodsPlan(), out = [];
  plan.entries.forEach(function (e) {
    var st = goodsStatus[e.key], d = OBJECTS[e.type] || {}, text, nm;
    if (st && st.kind !== e.kind) st = null;
    if (e.kind === 'src') {
      nm = goodsName(Object.keys(GOODS_SOURCES[e.sid].out)[0]);
      text = !e.ok ? '缺礦脈:' + GOODS_SOURCES[e.sid].near.r + ' 格內放「鐵礦堆」' : (st ? GOODS_STATE_TEXT[st.state] : '等待結算');
    } else {
      nm = RECIPES[e.rid].name;
      text = st ? GOODS_STATE_TEXT[st.state] : '等待結算';
      if (st && st.state === 'blocked' && st.miss) text = '缺料:' + goodsName(st.miss);
      else if (st && st.state === 'short' && st.miss) text = '缺料:' + goodsName(st.miss) + '(部分運轉)';
      if (!e.conn) text += ' · 未通路 ×' + GOODS_ROAD_MUL;
    }
    out.push({ key: e.key, kind: e.kind, name: (d.name || e.type), icon: d.icon || '', x: e.x, y: e.y, recipe: nm, state: st ? st.state : 'wait', text: text, conn: e.conn, rids: e.rids || null, rid: e.rid || null });
  });
  return out;
}
// 切換多配方工坊的配方(打鐵舖:鐵錠 ↔ 農具)
function goodsCycleRecipe(key) {
  var c = goodsCity(), plan = goodsPlan(), e = null;
  plan.entries.forEach(function (x) { if (x.kind === 'rec' && x.key === key) e = x; });
  if (!c || !e || e.rids.length < 2) return false;
  c.sel[key] = e.rids[(e.rids.indexOf(e.rid) + 1) % e.rids.length];
  goodsInvalidate();
  delete goodsStatus[key];
  return true;
}
function goodsToggleSell() { var c = goodsCity(); if (!c) return false; c.autoSell = !c.autoSell; return c.autoSell; }

// 要顯示的貨品:持有 > 0,或非遷移專用 / 未實作的貨品;木石在頂列,不列
function goodsVisibleList() {
  var c = goodsCity(), out = [];
  if (!c) return out;
  Object.keys(GOODS).forEach(function (id) {
    var g = GOODS[id];
    if (g.res) return;
    var have = cityGoodsHave(id);
    if (have > 0 || (!g.legacy && !g.later)) out.push({ id: id, name: g.name, icon: g.icon, tier: g.tier, have: have, cap: goodsCapOf(id) });
  });
  out.sort(function (a, b) { return (a.tier - b.tier) || (a.id < b.id ? -1 : 1); });
  return out;
}

// ───────── 最小 UI:庫房面板(側欄「庫房」按鈕 → 隱藏的 #btnGoods)─────────
function goodsEsc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
function goodsPanelHtml() {
  var c = goodsCity(), h = '', tierName = ['原料', '加工品', '成品', '工藝品', '奢侈品'], last = -1;
  if (!c) return '';
  h += '<button class="close" data-gp="close" title="關閉">✕</button><b>📦 庫房</b>';
  h += '<div class="gsub">每種貨品各有上限;<button data-gp="sell" class="gmini">溢出自動賣:' + (c.autoSell ? '開' : '關') + '</button></div>';
  goodsVisibleList().forEach(function (g) {
    if (g.tier !== last) { last = g.tier; h += '<div class="gtier">T' + g.tier + ' ' + tierName[g.tier] + '</div>'; }
    var pct = Math.max(0, Math.min(100, Math.round(g.have / g.cap * 100)));
    h += '<div class="grow"><span>' + g.icon + ' ' + goodsEsc(g.name) + '</span><span class="gn">' + g.have + ' / ' + g.cap + '</span><i class="gbar"><u style="width:' + pct + '%"></u></i></div>';
  });
  var ws = goodsWorkshopList();
  h += '<div class="gtier">工坊與原料點</div>';
  if (!ws.length) h += '<div class="gsub">還沒有生產建築:蓋麻田、木工棚、織坊、礦坑、打鐵舖、成衣鋪。</div>';
  ws.forEach(function (w) {
    var bad = w.state === 'blocked' || w.state === 'full' || w.state === 'noore' || !w.conn;
    h += '<div class="gws' + (bad ? ' bad' : '') + '"><span>' + w.icon + ' ' + goodsEsc(w.name) + ' → ' + goodsEsc(w.recipe) + '</span><small>' + goodsEsc(w.text) + '</small>' +
      (w.rids && w.rids.length > 1 ? '<button class="gmini" data-gp="cyc" data-k="' + w.key + '">換配方</button>' : '') + '</div>';
  });
  if (goodsLast) { var t = goodsOfflineText(); if (t) h += '<div class="gtier">離開期間</div><div class="gsub">' + goodsEsc(t) + '</div>'; }
  return h;
}
function goodsPanelRender() {
  if (typeof document === 'undefined') return;
  var el = document.getElementById('goodsPanel');
  if (!el) return;
  el.hidden = !goodsPanelOpen;
  if (goodsPanelOpen) el.innerHTML = goodsPanelHtml();
}
function goodsPanelToggle(open) {
  goodsPanelOpen = open === undefined ? !goodsPanelOpen : !!open;
  if (goodsPanelOpen) {
    if (typeof toggleTechPanel === 'function') { try { toggleTechPanel(false); } catch (e) { /* 略過 */ } }
    if (typeof toggleShop === 'function') { try { toggleShop(false); } catch (e2) { /* 略過 */ } }
  }
  goodsPanelRender();
  if (goodsPanelOpen) { if (typeof panelOpen === 'function') panelOpen('goods'); } else if (typeof panelClose === 'function') panelClose('goods');
}
function goodsPanelClick(e) {
  var t = e.target && e.target.closest ? e.target.closest('[data-gp]') : null;
  if (!t) return;
  var a = t.getAttribute('data-gp');
  if (a === 'close') goodsPanelToggle(false);
  else if (a === 'sell') { goodsToggleSell(); goodsPanelRender(); }
  else if (a === 'cyc') { goodsCycleRecipe(t.getAttribute('data-k')); goodsPanelRender(); }
}
function goodsUiInit() {
  if (typeof document === 'undefined' || !document.getElementById || !document.createElement || !document.body) return;
  try {
    if (document.getElementById('goodsPanel')) return;
    var css = document.createElement('style');
    css.id = 'goodsCss';
    css.textContent = '#goodsPanel{position:fixed;top:calc(40px + env(safe-area-inset-top));right:calc(var(--side-w) + 6px);width:min(340px,calc(100vw - var(--side-w) - 16px));max-height:60vh;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;z-index:3;padding:10px;border-radius:10px;background:rgba(20,26,36,.92);box-shadow:0 4px 16px rgba(0,0,0,.4);font-size:13px}' +
      '#goodsPanel[hidden]{display:none}#goodsPanel .close{position:sticky;top:0;float:right;background:rgba(20,26,36,.9);border:none;padding:2px 6px}' +
      '#goodsPanel .gtier{margin-top:8px;padding-top:4px;border-top:1px solid rgba(255,255,255,.15);opacity:.7;font-size:12px}#goodsPanel .gsub{margin-top:4px;font-size:12px;opacity:.85}' +
      '#goodsPanel .grow{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;margin-top:4px}#goodsPanel .grow .gn{margin-left:auto;font-variant-numeric:tabular-nums}' +
      '#goodsPanel .gbar{display:block;flex:0 0 100%;height:4px;border-radius:2px;background:rgba(255,255,255,.15);overflow:hidden}#goodsPanel .gbar u{display:block;height:100%;background:#f0b45a;text-decoration:none}' +
      '#goodsPanel .gws{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;margin-top:5px}#goodsPanel .gws small{flex:1;min-width:0;opacity:.8}#goodsPanel .gws.bad small{color:#ff8a7a;opacity:1}' +
      '#goodsPanel .gmini{min-height:28px;padding:2px 8px;font-size:12px}';
    document.head.appendChild(css);
    var panel = document.createElement('div');
    panel.id = 'goodsPanel';
    panel.hidden = true;
    panel.addEventListener('click', goodsPanelClick);
    document.body.appendChild(panel);
    var btn = document.createElement('button');
    btn.id = 'btnGoods';
    btn.title = '庫房';
    btn.textContent = '庫房';
    btn.hidden = true;
    btn.style.display = 'none';   // 入口在右側邊欄(ui.js UI_SIDE_ITEMS 'goods' 代為 click);頂列不顯示
    btn.addEventListener('click', function () { goodsPanelToggle(); });
    var top = document.getElementById('topbar');
    if (top) top.appendChild(btn);
    var sync = function () { if (!document.hidden) btn.hidden = !(typeof isCityOnly === 'function' && isCityOnly()); };
    sync();
    setInterval(sync, 1000);
    setInterval(function () { if (goodsPanelOpen && !document.hidden) goodsPanelRender(); }, 1000);
  } catch (e) { if (typeof console !== 'undefined') console.warn('[goods] UI 初始化失敗', e); }
}
if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', goodsUiInit);
  else goodsUiInit();
}
