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
// 基本 / 進階模式與自動調度(使用者回饋 2026-11-09:基本玩家只想知道缺什麼、去哪拿;鏈條圖移到「進階」)。偏好鍵,不進世界存檔
var GOODS_PREF_MODE = 'lorddomain.goods.mode', GOODS_PREF_AUTO = 'lorddomain.goods.auto';   // 'adv' = 進階模式;'0' = 自動調度關
var goodsAutoCache = null;    // 自動調度偏好快取(goodsStep 每秒讀,不每次碰 localStorage)
var goodsAllow = {};          // 自動調度關時,「補料」發給各工坊的配額('x,y' → 還能產出幾件;不存檔)
var goodsRefillLast = null;   // 最近一次「補料」結果(給面板)

function goodsNum(v) { return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0; }
function goodsRound(v) { return Math.round(v * 10000) / 10000; }

// 正規化 world.city(讀檔 / 補預設);未知貨品丟棄,壞值歸零
var goodsRemovedRefund = null;   // 最近一次讀檔把已移除貨品折成的金幣 { coin, items:{ id: 數量 } }(不存檔)
function goodsNormCity(v) {
  var c = { inv: {}, sel: {}, autoSell: true, debt: {}, coinFrac: 0 }, k, refund = 0, refItems = {};
  if (v && typeof v === 'object') {
    if (v.inv && typeof v.inv === 'object') {
      for (k in v.inv) {
        var n = goodsNum(v.inv[k]);
        if (!GOODS[k] && typeof GOODS_REMOVED !== 'undefined' && GOODS_REMOVED[k]) {   // 已移除貨品:按原基價折算金幣(下方入帳)
          if (n > 0) { refund += n * GOODS_REMOVED[k].price; refItems[k] = n; }
          continue;
        }
        if (GOODS[k] && !GOODS[k].res && n > 0) c.inv[k] = goodsRound((c.inv[k] || 0) + n);
      }
    }
    if (v.sel && typeof v.sel === 'object') {
      for (k in v.sel) if (typeof v.sel[k] === 'string' && RECIPES[v.sel[k]]) c.sel[k] = v.sel[k];
    }
    c.autoSell = v.autoSell !== false;
    if (v.debt && typeof v.debt === 'object') {
      for (k in v.debt) if (GOODS[k] && GOODS[k].res) c.debt[k] = Math.min(0.9999, goodsNum(v.debt[k]));
    }
    c.coinFrac = Math.min(0.9999, goodsNum(v.coinFrac));
    if (refund > 0 && typeof world !== 'undefined' && world && world.res) {   // 讀檔時 world.res 已還原(map.js loadWorldSave),金幣直接入帳;小數併入 coinFrac
      var tot = refund + c.coinFrac, whole = Math.floor(tot + 1e-6);
      world.res.coin = (world.res.coin || 0) + whole;
      c.coinFrac = Math.min(0.9999, Math.max(0, tot - whole));
      goodsRemovedRefund = { coin: whole, items: refItems };
      if (typeof console !== 'undefined') console.info('[goods] 已移除貨品折算金幣', whole, refItems);
    }
    if (typeof themeSkinHas === 'function' && themeSkinHas(v.theme) && v.theme !== 'han') c.theme = v.theme;   // 城市風格(theme_skin.js);預設漢不存
    if (v.adv && typeof advNormSave === 'function') c.adv = advNormSave(v.adv);   // 顧問已完成 / 已忽略 id(cityadvisor.js)
    if (v.ns && typeof nsNormSave === 'function') c.ns = nsNormSave(v.ns);   // 推薦下一步:已關閉 / 已看過 id(nextstep.js)
    if (v.cards && typeof cardsNormSave === 'function') { var cd = cardsNormSave(v.cards); if (cd) c.cards = cd; }   // 酒館 / 名冊(cards.js)
    if (v.tavern && typeof tavernNormSave === 'function') { var tv = tavernNormSave(v.tavern); if (tv) c.tavern = tv; }
    if (v.tut && typeof tutNormSave === 'function') { var tu = tutNormSave(v.tut); if (tu) c.tut = tu; }   // 新手教學進度(tutorial.js);沒有 = 已畢業   // 酒館室內資料 {lv, rooms, seed}(tavern_scene.js;I1 起才有包間內容)
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
function goodsLaborMul(entry) { return (entry && typeof npcStaffMul === 'function') ? npcStaffMul(entry.type) : 1; }   // 掛點:勞力比 / 派駐——派駐人事乘區 npcStaffMul(npcinteract.js,PLAN_INTERIORS P1;勞力比尚未接)
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
  for (i = 0; i < N; i++) if (isRoadLikeTerrain(b.terrain[i])) road[i] = 1;
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
      entries.push({ kind: 'src', sid: sid, type: o.type, x: o.x, y: o.y, rot: o.rot | 0, key: key, ok: ok, conn: true, tier: -1 });
    });
    var rids = goodsRecipesFor(o.type);
    if (rids.length) {
      var rid = c.sel[key] && rids.indexOf(c.sel[key]) >= 0 ? c.sel[key] : rids[0];
      var out0 = Object.keys(RECIPES[rid].out)[0];
      entries.push({ kind: 'rec', rid: rid, rids: rids, type: o.type, x: o.x, y: o.y, rot: o.rot | 0, key: key, ok: true, conn: connected(o), tier: goodsTier(out0) });
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
    var st, n, id, f, miss, rec, pm, hold, al = 0;
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
    hold = !goodsAutoOn();   // 自動調度關:只用「補料」發的配額
    if (hold) {
      al = goodsAllow[e.key] || 0;
      if (!(al > 1e-9)) { status[e.key] = { kind: 'rec', rid: e.rid, state: 'hold', miss: null, eff: 0, conn: e.conn }; return; }
      if (n > al) n = al;
    }
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
      if (hold) goodsAllow[e.key] = goodsRound(Math.max(0, al - n * f));
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
// 白話狀態只用四種:運轉中、缺料(缺哪個)、倉庫滿了、沒接路;部分運轉併入缺料。hold = 自動調度關且沒配額(玩家自己關的才會出現)
var GOODS_STATE_TEXT = { run: '運轉中', short: '缺料', blocked: '缺料', full: '倉庫滿了', noore: '缺料:缺礦脈', hold: '等補料' };
// 回傳 [{ key, name, icon, x, y, recipe, state, text, conn, rids }];沒跑過結算的建築顯示「等待結算」
function goodsWorkshopList() {
  var plan = goodsPlan(), out = [];
  plan.entries.forEach(function (e) {
    var st = goodsStatus[e.key], d = OBJECTS[e.type] || {}, text, nm;
    if (st && st.kind !== e.kind) st = null;
    if (e.kind === 'src') {
      nm = goodsName(Object.keys(GOODS_SOURCES[e.sid].out)[0]);
      text = !e.ok ? '缺料:缺礦脈 → ' + GOODS_SOURCES[e.sid].near.r + ' 格內放「鐵礦堆」' : (st ? GOODS_STATE_TEXT[st.state] : '等待結算');
    } else {
      nm = goodsRecipeName(e.rid);
      text = st ? GOODS_STATE_TEXT[st.state] : '等待結算';
      if (st && (st.state === 'blocked' || st.state === 'short') && st.miss) text = '缺料:' + goodsName(st.miss);
      if (!e.conn) text = (st && st.state === 'run') ? '沒接路(產量減半)' : text + ' · 沒接路';
    }
    out.push({ key: e.key, kind: e.kind, name: (d.name || e.type), icon: d.icon || '', x: e.x, y: e.y, recipe: nm, state: st ? st.state : 'wait', text: text, conn: e.conn, rids: e.rids || null, rid: e.rid || null });
  });
  return out;
}
// ───────── 生產視圖資料(PLAN_INTERIORS §3 O3 / O9 / O10;chainvis.js 與顧問使用;純讀取,不改結算)─────────
// 每個生產建築一列:cause = 主要原因('ok' 正常 / 'wait' 尚未結算 / 'miss' 缺料 / 'road' 未通路 / 'full' 庫滿 / 'ore' 缺礦脈)、
// level = 0 正常 1 警示 2 停工;perHour = 目前實際產出(件 / 遊戲小時),直接取結算的 eff(已含派駐人事 npcStaffMul 與道路 ×0.5,這裡不再另乘)
var GOODS_CAUSE_ICON = { miss: '⛔', road: '🛤️', full: '📦', ore: '⛰️', hold: '⏸️' };
function goodsProdRows() {
  var plan = goodsPlan(), out = [];
  plan.entries.forEach(function (e) {
    var st = goodsStatus[e.key], d = OBJECTS[e.type] || {}, f = footprint(e.type, e.rot | 0), s = null, r = null, oid, nom, causes = [], miss = null, capped = false, row;
    if (st && st.kind !== e.kind) st = null;
    if (e.kind === 'src') { s = GOODS_SOURCES[e.sid]; oid = Object.keys(s.out)[0]; nom = s.out[oid]; }
    else { r = RECIPES[e.rid]; oid = Object.keys(r.out)[0]; nom = r.out[oid] * r.rate; }
    if (st) {
      if (st.state === 'hold') causes.push('hold');
      if (e.kind === 'src' && st.state === 'noore') causes.push('ore');
      if (e.kind === 'rec' && st.state === 'blocked' && st.miss) { causes.push('miss'); miss = st.miss; }
      if (st.state === 'full') causes.push('full');
      if (e.kind === 'rec' && !e.conn) causes.push('road');
      if (st.state !== 'full' && !GOODS[oid].res && goodsRaw(oid) >= goodsCapOf(oid) - 1e-6) { causes.push('full'); capped = true; }
      if (e.kind === 'rec' && st.state === 'short' && st.miss) { causes.push('miss'); miss = miss || st.miss; }
    } else if (e.kind === 'src' && !e.ok) causes.push('ore');
    else if (e.kind === 'rec' && !e.conn) causes.push('road');
    row = {
      key: e.key, kind: e.kind, type: e.type, name: d.name || e.type, icon: d.icon || '', x: e.x, y: e.y, w: f[0], h: f[1],
      out: oid, outName: goodsName(oid), outIcon: goodsIcon(oid), recipe: e.kind === 'rec' ? goodsRecipeName(e.rid) : goodsName(oid),
      state: st ? st.state : 'wait', miss: miss, missName: miss ? goodsName(miss) : '', conn: e.conn, causes: causes, cause: causes[0] || (st ? 'ok' : 'wait'),
      perHour: st && st.state !== 'blocked' && st.state !== 'full' && st.state !== 'noore' ? Math.round(nom * st.eff * 100) / 100 : 0,
      nominal: nom, capped: capped, rid: e.rid || null, rids: e.rids || null
    };
    row.level = (row.state === 'blocked' || row.state === 'full' || row.state === 'noore') ? 2 : (causes.length ? 1 : 0);
    row.reason = goodsProdReason(row);
    out.push(row);
  });
  return out;
}
// 原因文字(點瓶頸圖示 / 生產視圖列表共用)
function goodsProdReason(row) {
  var c = row.cause;
  if (c === 'miss') return '缺料:' + row.missName + ' → ' + goodsGapInfo(row.miss).where;   // 三段式「缺 X → 去哪裡」;按鈕由呼叫端給
  if (c === 'road') return '沒接路 → 補一段路接到城主府(現在產量 ×' + GOODS_ROAD_MUL + ')';
  if (c === 'full') {
    var cc = goodsCity();
    return '倉庫滿了:「' + row.outName + '」' + cityGoodsHave(row.out) + ' / ' + goodsCapOf(row.out) + (cc && cc.autoSell ? ' → 多出的自動賣掉(×' + GOODS_SELL_MUL + ')' : ' → 用掉它,或打開自動賣');
  }
  if (c === 'ore') { var sid = goodsSourceIds().filter(function (k) { return GOODS_SOURCES[k].bld === row.type; })[0], nr = sid && GOODS_SOURCES[sid].near; return '缺料:缺礦脈 → ' + (nr ? nr.r + ' 格內要有「鐵礦堆」' : '附近要有礦脈'); }
  if (c === 'hold') return '等補料:自動調度已關 → 按庫房「補料」';
  if (c === 'wait') return '等待結算';
  return '運轉中';
}
// 摘要:{ total, ok, miss, road, full, ore, wait, blocked, noroad(未通路工坊數), missIds }
function goodsProdSummary(rows) {
  rows = rows || goodsProdRows();
  var s = { total: rows.length, ok: 0, miss: 0, road: 0, full: 0, ore: 0, wait: 0, hold: 0, blocked: 0, noroad: 0, missIds: [] };
  rows.forEach(function (r) {
    if (r.cause === 'ok') s.ok++; else s[r.cause]++;
    if (r.state === 'blocked') s.blocked++;
    if (r.kind === 'rec' && !r.conn) s.noroad++;
    if (r.miss && s.missIds.indexOf(r.miss) < 0) s.missIds.push(r.miss);
  });
  return s;
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

// ───────── 基本模式:材料清單 / 第一層缺口 / 補料(資料;面板見 goodsNeedHtml)─────────
var GOODS_CONS_NAME = { food: '糧食', cloth: '穿衣' };
var GOODS_PLAIN_TEXT = { run: '運轉中', miss: '缺料', full: '倉庫滿了', road: '沒接路', hold: '等補料' };
var GOODS_PLAIN_RANK = { miss: 4, full: 3, road: 2, hold: 1, run: 0 };
function goodsPrefGet(k) { try { return typeof localStorage !== 'undefined' && localStorage ? localStorage.getItem(k) : null; } catch (e) { return null; } }
function goodsPrefSet(k, v) { try { if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(k, v); } catch (e) { if (typeof console !== 'undefined') console.warn('[goods] 偏好寫入失敗', k); } }
function goodsAutoOn() { if (goodsAutoCache === null) goodsAutoCache = goodsPrefGet(GOODS_PREF_AUTO) !== '0'; return goodsAutoCache; }
function goodsSetAuto(on) { goodsAutoCache = !!on; goodsAllow = {}; goodsPrefSet(GOODS_PREF_AUTO, on ? '1' : '0'); return goodsAutoCache; }
function goodsIsAdv() { return goodsPrefGet(GOODS_PREF_MODE) === 'adv'; }
function goodsSetAdv(on) { goodsPrefSet(GOODS_PREF_MODE, on ? 'adv' : 'basic'); return !!on; }
function goodsBldUnlocked(t) { try { return typeof isUnlocked === 'function' ? !!isUnlocked('estate', t) : true; } catch (e) { return true; } }
// 建築為什麼還不能蓋:{ tech, techName } 或 { lv }
function goodsBldLock(t) {
  var tid = typeof nlObjTech === 'function' ? nlObjTech(t) : undefined, tn = null;
  if (tid && tid !== 'start' && !(typeof techDone === 'function' && techDone(tid))) {
    try { tn = typeof techNode === 'function' ? techNode(tid) : null; } catch (e) { tn = null; }
    return { tech: tid, techName: tn && tn.name ? tn.name : '' };
  }
  return { lv: typeof progUnlockLv === 'function' ? progUnlockLv('estate', t) : null };
}
// 走鏢帶得回來嗎(走鏢只隨機帶回 T1~T4 貨品,不能指定)
function goodsBuyable(id) {
  var g = GOODS[id];
  if (!g || g.res || g.legacy || !(g.tier >= 1) || typeof caravanPool !== 'function' || typeof caravanPanelToggle !== 'function') return false;
  if (caravanPool(g.tier).indexOf(id) < 0) return false;
  try { return typeof isUnlocked === 'function' ? !!isUnlocked('feature', 'caravan') : true; } catch (e) { return false; }
}
// 某建築 type 在場上的狀況(只看結算狀態,不呼叫 goodsProdRows,避免遞迴):'ok' | 'road' | 'miss' | 'ore' | 'hold';missId = 它自己缺的料
function goodsBldHealth(t) {
  var plan = goodsPlan(), best = null, rank = { ok: 0, hold: 1, road: 2, miss: 3, ore: 4 };
  plan.entries.forEach(function (e) {
    if (e.type !== t) return;
    var st = goodsStatus[e.key], h = { s: 'ok', key: e.key, missId: null };
    if (st && st.kind !== e.kind) st = null;
    if (e.kind === 'src' && (!e.ok || (st && st.state === 'noore'))) h.s = 'ore';
    else if (st && st.state === 'hold') h.s = 'hold';
    else if (e.kind === 'rec' && st && (st.state === 'blocked' || st.state === 'short') && st.miss) { h.s = 'miss'; h.missId = st.miss; }
    else if (e.kind === 'rec' && !e.conn) h.s = 'road';
    if (!best || rank[h.s] < rank[best.s]) best = h;   // 只要有一座正常就算正常
  });
  return best;
}
// 第一層缺口:缺 X → 去哪裡。回傳 { id, name, where, act:'build'|'tech'|'go'|'buy'|'refill'|'', arg, label, buy }
function goodsGapInfo(id, built) {
  var g = GOODS[id] || {}, mk = goodsMakers(id), out = { id: id, name: goodsName(id), where: '', act: '', arg: '', label: '', buy: goodsBuyable(id) }, m = null, i, h, lk;
  built = built || goodsBuiltTypes();
  for (i = 0; i < mk.length && !m; i++) if (built[mk[i].bld]) m = mk[i];
  if (m) {
    h = m.kind === 'res' ? null : goodsBldHealth(m.bld);
    if (h && h.s === 'road') { out.where = '「' + m.bldName + '」沒接路'; out.act = 'go'; out.arg = h.key; out.label = '前往接路'; }
    else if (h && h.s === 'miss') { out.where = '「' + m.bldName + '」自己也缺料(缺 ' + goodsName(h.missId) + ')'; out.act = 'go'; out.arg = h.key; out.label = '前往'; }
    else if (h && h.s === 'ore') { out.where = '「' + m.bldName + '」旁邊沒有鐵礦堆'; out.act = 'go'; out.arg = h.key; out.label = '前往'; }
    else if (h && h.s === 'hold') { out.where = '「' + m.bldName + '」等補料'; out.act = 'refill'; out.label = '補料'; }
    else { out.where = '「' + m.bldName + '」在產,等它產出或多蓋一座'; out.act = 'build'; out.arg = m.bld; out.label = '再蓋一座'; }
  } else if (mk.length) {
    for (i = 0; i < mk.length && !m; i++) if (goodsBldUnlocked(mk[i].bld)) m = mk[i];
    if (m) { out.where = '蓋「' + m.bldName + '」(還沒蓋)'; out.act = 'build'; out.arg = m.bld; out.label = '前往蓋'; }
    else {
      m = mk[0]; lk = goodsBldLock(m.bld);
      if (lk.tech) { out.where = '「' + m.bldName + '」要先研發' + (lk.techName ? '「' + lk.techName + '」' : '科技'); out.act = 'tech'; out.arg = lk.tech; out.label = '前往科技'; }
      else out.where = '「' + m.bldName + '」' + (lk.lv ? '城市 Lv' + lk.lv + ' 開放' : '尚未開放');
    }
  } else out.where = g.legacy ? '舊材料,目前只能從獎勵取得' : '本城還做不出來';
  if (!out.act && out.buy) { out.act = 'buy'; out.label = '走鏢'; out.where += out.where ? ';走鏢有機會帶回' : '走鏢有機會帶回'; }
  return out;
}
// 白話狀態(四種 + 自動調度關時的「等補料」)
function goodsPlainState(r) {
  if (r.causes.indexOf('miss') >= 0 || r.causes.indexOf('ore') >= 0) return 'miss';
  if (r.cause === 'hold') return 'hold';
  if (r.causes.indexOf('full') >= 0) return 'full';
  if (r.causes.indexOf('road') >= 0) return 'road';
  if (r.cause === 'wait' && r.kind === 'rec' && r.rid) {   // 還沒結算過:用庫存預判
    var rin = RECIPES[r.rid].in, id;
    for (id in rin) if (cityGoodsHave(id) < rin[id]) return 'miss';
  }
  return 'run';
}
// 基本模式清單:同建築 + 同配方合併成一張卡;問題在前
function goodsNeedList() {
  var rows = goodsProdRows(), built = goodsBuiltTypes(), map = {}, list = [], memo = {};
  function gap(id) { return memo[id] || (memo[id] = goodsGapInfo(id, built)); }
  rows.forEach(function (r) {
    var gk = r.type + '|' + (r.rid || r.out), g = map[gk], ps = goodsPlainState(r);
    if (!g) {
      g = map[gk] = { type: r.type, name: r.name, icon: r.icon, kind: r.kind, rid: r.rid, rids: r.rids, out: r.out, outName: r.outName, outIcon: r.outIcon, n: 0, keys: [], key: r.key, perHour: 0, state: 'run', missSet: {}, roadKey: '', ore: false, mats: [], gaps: [] };
      list.push(g);
    }
    g.n++; g.keys.push(r.key); g.perHour += r.perHour;
    if (GOODS_PLAIN_RANK[ps] > GOODS_PLAIN_RANK[g.state]) { g.state = ps; g.key = r.key; }
    if (r.miss) g.missSet[r.miss] = true;
    if (r.kind === 'rec' && !r.conn && !g.roadKey) g.roadKey = r.key;
    if (r.cause === 'ore' || r.causes.indexOf('ore') >= 0) g.ore = true;
  });
  list.forEach(function (g) {
    var rin = g.kind === 'rec' && g.rid ? RECIPES[g.rid].in : {}, id;
    g.perHour = Math.round(g.perHour * 100) / 100;
    for (id in rin) {
      var have = cityGoodsHave(id), lack = g.state === 'miss' && (have < rin[id] || !!g.missSet[id]);   // 上游邊產邊用而仍在運轉的不算缺
      g.mats.push({ id: id, name: goodsName(id), icon: goodsIcon(id), n: rin[id], have: have, lack: lack });
      if (lack) g.gaps.push(gap(id));
    }
    if (g.ore) {
      var ore = goodsBldUnlocked('ore_iron') && typeof OBJECTS !== 'undefined' && OBJECTS.ore_iron;
      g.gaps.push({ id: '', name: '礦脈', where: GOODS_NEAR_R + ' 格內放「鐵礦堆」', act: ore ? 'build' : 'go', arg: ore ? 'ore_iron' : g.key, label: ore ? '前往蓋' : '前往', buy: false });
    }
    g.missNames = g.gaps.map(function (x) { return x.name; });
    g.stateText = GOODS_PLAIN_TEXT[g.state] + (g.state === 'miss' && g.missNames.length ? '(缺 ' + g.missNames.join('、') + ')' : '');
    delete g.missSet;
  });
  list.sort(function (a, b) { return GOODS_PLAIN_RANK[b.state] - GOODS_PLAIN_RANK[a.state]; });   // Array.sort 穩定(ES2019 起;舊 Safari 亦穩定),同級維持結算順序
  return list;
}
// 「補料」:把庫房現有材料依優先順序(上游先、同結算順序)分給缺料的工坊,每座最多 1 遊戲小時份。
// 自動調度開:工坊本來就每秒自己領料,這裡只重新分配試算並立刻更新狀態;自動調度關:真的發配額(goodsAllow)。回傳並記住結果
function goodsRefill() {
  var plan = goodsPlan(), auto = goodsAutoOn(), v = {}, filled = 0, still = [], missAll = {}, prev = goodsStatus;
  plan.entries.forEach(function (e) {
    if (e.kind !== 'rec') return;
    var rec = RECIPES[e.rid], pm = goodsProdMul(e, rec.tech) * (e.conn ? 1 : GOODS_ROAD_MUL), f = 1, id, need, miss = [], st = prev[e.key];
    var cand = !auto || !st || st.kind !== 'rec' || st.state === 'blocked' || st.state === 'short' || st.state === 'hold';
    for (id in rec.in) {
      need = rec.in[id] * rec.rate * pm;
      if (!(id in v)) v[id] = goodsRaw(id);
      if (need > 0 && v[id] < need - 1e-9) { miss.push(id); f = Math.min(f, Math.max(0, v[id] / need)); }
    }
    if (f < 1e-6) f = 0;
    for (id in rec.in) v[id] = Math.max(0, v[id] - rec.in[id] * rec.rate * pm * f);
    if (!auto) goodsAllow[e.key] = f > 0 ? goodsRound(rec.rate * pm * f) : 0;
    if (!cand) return;
    if (!miss.length) { filled++; goodsStatus[e.key] = { kind: 'rec', rid: e.rid, state: 'run', miss: null, eff: pm, conn: e.conn }; return; }
    still.push({ key: e.key, type: e.type, name: goodsBldName(e.type), miss: miss, part: f > 0 });
    miss.forEach(function (m) { missAll[m] = true; });
    goodsStatus[e.key] = { kind: 'rec', rid: e.rid, state: f > 0 ? 'short' : 'blocked', miss: miss[0], eff: pm * f, conn: e.conn };
  });
  goodsRefillLast = { filled: filled, still: still, missing: Object.keys(missAll), auto: auto };
  return goodsRefillLast;
}
// 補料結果白話:「已補 N 項,仍缺 M 項:織坊 ×2(缺 麻)」
function goodsRefillText(r) {
  if (!r) return '';
  if (!r.filled && !r.still.length) return '目前沒有缺料的工坊。';
  var grp = {}, order = [];
  r.still.forEach(function (s) {
    var k = s.name + '|' + s.miss.join(',');
    if (!grp[k]) { grp[k] = { name: s.name, miss: s.miss, n: 0 }; order.push(k); }
    grp[k].n++;
  });
  return '已補 ' + r.filled + ' 項,仍缺 ' + r.still.length + ' 項' + (order.length ? ':' + order.map(function (k) { var x = grp[k]; return x.name + (x.n > 1 ? ' ×' + x.n : '') + '(缺 ' + x.miss.map(goodsName).join('、') + ')'; }).join('、') : '') + '。';
}

// 要顯示的貨品:持有 > 0,或非遷移專用 / 未實作的貨品;木石在頂列,不列
function goodsVisibleList() {
  var c = goodsCity(), out = [];
  if (!c) return out;
  goodsIds().forEach(function (id) {
    var g = GOODS[id];
    if (g.res) return;
    var have = cityGoodsHave(id);
    if (have > 0 || (!g.legacy && !g.later)) out.push({ id: id, name: goodsName(id), icon: goodsIcon(id), tier: g.tier, have: have, cap: goodsCapOf(id) });
  });
  out.sort(function (a, b) { return (a.tier - b.tier) || (a.id < b.id ? -1 : 1); });
  return out;
}

// ───────── 鏈條(PLAN_INTERIORS §3 O2 最小版:文字樹,上游往下縮排、下游列表;標出尚未蓋的生產建築)─────────
// 目前城市已蓋的生產建築 type 集合(含伐木場 / 採石場)
function goodsBuiltTypes() {
  var b = typeof estateBoard === 'function' ? estateBoard() : null, out = {};
  if (b && b.objects) b.objects.forEach(function (o) { out[o.type] = true; });
  return out;
}
function goodsBldName(t) { return (typeof OBJECTS !== 'undefined' && OBJECTS[t] && OBJECTS[t].name) || t; }
// 某貨品的所有產法:[{ kind:'src'|'rec'|'res', bld, bldName, rid?, inputs:{id:量}, rate? }];純資料
function goodsMakers(id) {
  var out = [];
  goodsSourceIds().forEach(function (sid) {
    var s = GOODS_SOURCES[sid];
    if (s.out[id]) out.push({ kind: 'src', bld: s.bld, bldName: goodsBldName(s.bld), inputs: {}, rate: s.out[id] });
  });
  Object.keys(GOODS_RES_SOURCES).forEach(function (b) { if (GOODS_RES_SOURCES[b] === id) out.push({ kind: 'res', bld: b, bldName: goodsBldName(b), inputs: {} }); });
  var fxRes = goodsPackNow() && typeof FX_RES_SOURCES !== 'undefined' ? FX_RES_SOURCES[goodsPackNow()] : null;   // 魔幻本族的木 / 石生產建築(只供鏈條頁顯示)
  if (fxRes) Object.keys(fxRes).forEach(function (b) { if (fxRes[b] === id) out.push({ kind: 'res', bld: b, bldName: goodsBldName(b), inputs: {} }); });
  goodsRecipeIds().forEach(function (rid) {
    var r = RECIPES[rid];
    if (r.out[id]) goodsRecipeBld(rid).forEach(function (b) { out.push({ kind: 'rec', rid: rid, bld: b, bldName: goodsBldName(b), inputs: r.in, rate: r.rate, outN: r.out[id] }); });
  });
  return out;
}
// 下游:用到此貨品的配方,以及其他用途標籤(科技成本 / 農具 / 居民消費)
function goodsUsers(id) {
  var out = { recipes: [], tags: [] }, g = GOODS[id];
  goodsRecipeIds().forEach(function (rid) {
    var r = RECIPES[rid];
    if (r.in[id]) out.recipes.push({ rid: rid, name: goodsRecipeName(rid), out: Object.keys(r.out)[0], n: r.in[id], bld: goodsRecipeBld(rid).map(goodsBldName).join('/') });
  });
  if (g && !g.res && g.tier >= 1 && !g.legacy && !g.pack) out.tags.push('科技研發成本(T' + g.tier + ' 任選)');
  if (g && GOODS_FARM_TOOL.id === id) out.tags.push('田糧產 ×' + GOODS_FARM_TOOL.bonus);
  if (g && g.cons) out.tags.push('居民消費:' + (GOODS_CONS_NAME[g.cons] || '日用'));   // 不外露英文鍵(food / cloth)
  return out;
}
// 上游樹:{ id, name, icon, tier, makers:[{ bldName, built, kind, rate, kids:[{ n, node }] }] };depth 限制展開層數
function goodsChainUp(id, depth, built) {
  var g = GOODS[id] || {}, node = { id: id, name: goodsName(id), icon: goodsIcon(id), tier: g.tier || 0, makers: [] };
  built = built || goodsBuiltTypes();
  if (depth <= 0) return node;
  goodsMakers(id).forEach(function (m) {
    var kids = [];
    Object.keys(m.inputs).forEach(function (iid) { kids.push({ n: m.inputs[iid], node: goodsChainUp(iid, depth - 1, built) }); });
    node.makers.push({ bld: m.bld, bldName: m.bldName, built: !!built[m.bld], kind: m.kind, rate: m.rate, kids: kids });
  });
  return node;
}
var goodsTab = 'need', goodsChainSel = 'g_yifu', goodsChainFocus = null;   // goodsTab:need 材料(基本模式預設)/ inv 庫存 / chain 鏈條 / prod 生產(後兩者屬進階)   // goodsChainFocus:鏈條圖上標出缺口的貨品 id(瓶頸圖示 / 生產分頁帶入)
function goodsChainNodeHtml(node, n, lv) {
  var h = '<div class="gch" style="margin-left:' + (lv ? 10 : 0) + 'px"><span' + (node.id === goodsChainFocus ? ' class="gfocus"' : '') + '>' + (n ? n + '× ' : '') + node.icon + ' ' + goodsEsc(node.name) + ' <i class="gtag">T' + node.tier + '</i>' + (node.id === goodsChainFocus ? ' ◀ 缺口' : '') + '</span>';
  node.makers.forEach(function (m) {
    h += '<small class="' + (m.built ? '' : 'bad') + '">' + (m.kind === 'rec' ? '由' : '產自') + '「' + goodsEsc(m.bldName) + '」' + (m.built ? '' : '(尚未建造)') + '</small>';
    m.kids.forEach(function (k) { h += goodsChainNodeHtml(k.node, k.n, lv + 1); });
  });
  return h + '</div>';
}
// 生產分頁(O10):每個生產建築的狀態 / 產出每小時 / 缺什麼;問題在前
function goodsProdHtml() {
  var rows = goodsProdRows(), sm = goodsProdSummary(rows), on = typeof chainVisIsOn === 'function' && chainVisIsOn();
  var h = '<div class="gsub">共 ' + sm.total + ' 處:運轉中 ' + sm.ok + ',缺料 ' + (sm.miss + sm.ore) + ',沒接路 ' + sm.road + ',倉庫滿了 ' + sm.full + (sm.hold ? ',等補料 ' + sm.hold : '') + '。</div>';
  if (typeof chainVisToggle === 'function') h += '<div class="gsub">城市畫面生產視圖(顯示全部生產建築狀態與貨物流向):<button class="gmini' + (on ? ' on' : '') + '" data-gp="view">' + (on ? '開' : '關') + '</button></div>';
  if (!rows.length) return h + '<div class="gsub">還沒有生產建築:蓋麻田、木工棚、織坊、礦坑、打鐵舖、成衣鋪。</div>';
  rows = rows.slice().sort(function (a, b) { return (b.level - a.level) || (b.causes.length - a.causes.length) || (a.y - b.y) || (a.x - b.x); });
  var okShown = 0, okHidden = 0;
  rows.forEach(function (r) {
    if (r.level === 0 && !r.causes.length) { if (okShown >= 10) { okHidden++; return; } okShown++; }
    var ic = GOODS_CAUSE_ICON[r.cause] || (r.cause === 'ok' ? '✅' : '⏳');
    h += '<div class="gws' + (r.level >= 1 ? ' bad' : '') + '"><span>' + ic + ' ' + r.icon + ' ' + goodsEsc(r.name) + ' → ' + r.outIcon + goodsEsc(r.outName) + '</span>' +
      '<span class="gn">' + (r.perHour > 0 ? r.perHour + ' /時' : '—') + '</span><small style="flex:0 0 100%">' + goodsEsc(r.reason) + '</small>' +
      '<button class="gmini" data-gp="go" data-k="' + r.key + '">前往</button>' +
      (r.cause === 'miss' || r.cause === 'full' ? '<button class="gmini" data-gp="gap" data-id="' + r.out + '" data-m="' + (r.miss || '') + '">鏈條</button>' : '') + '</div>';
  });
  if (okHidden) h += '<div class="gsub">另有 ' + okHidden + ' 處運轉正常(未列出)。</div>';
  return h;
}
// 工藝流程線(進階 / 鏈條畫面;歷史世界才有):〔材料 ×n〕→ 工序(灰色小標籤,只是文字)→ 成品;下一行為簡化說明
function goodsCraftLine(rid) {
  var cr = typeof goodsRecipeCraft === 'function' ? goodsRecipeCraft(rid) : null, r = RECIPES[rid];
  if (!cr || !r) return '';
  var mats = Object.keys(r.in).map(function (i) { return '<span class="gmat">' + goodsIcon(i) + goodsEsc(goodsName(i)) + ' ×' + r.in[i] + '</span>'; }).join(' ');
  var steps = cr.steps.map(function (s) { return '<i class="gstep">🔧' + goodsEsc(s) + '</i>'; }).join(' → ');
  var outId = Object.keys(r.out)[0];
  return '<div class="gcraft">' + mats + ' → ' + steps + ' → <span class="gmat">' + goodsIcon(outId) + goodsEsc(goodsName(outId)) + '</span>' +
    (cr.note ? '<small>簡化:' + goodsEsc(cr.note) + '</small>' : '') + '</div>';
}
function goodsCraftHtml(id) {
  var h = '';
  goodsRecipeIds().forEach(function (rid) { if (RECIPES[rid].out[id]) h += goodsCraftLine(rid); });
  return h ? '<div class="gtier">工藝(真實工序;灰色只是說明,不是材料)</div>' + h : '';
}
function goodsChainHtml() {
  var h = '<div class="gsub">選一個貨品,看它的上游原料與下游用途;紅字 = 該生產建築還沒蓋。</div><div class="gchips">';
  goodsIds().filter(function (id) { var g = GOODS[id]; return !g.res && !g.legacy && !g.later && g.tier >= 1; }).sort(function (a, b) { return (GOODS[a].tier - GOODS[b].tier) || (a < b ? -1 : 1); }).forEach(function (id) {
    h += '<button class="gmini' + (id === goodsChainSel ? ' on' : '') + '" data-gp="chain" data-id="' + id + '">' + goodsIcon(id) + goodsEsc(goodsName(id)) + '</button>';
  });
  h += '</div><div class="gtier">上游(怎麼做)</div>' + goodsChainNodeHtml(goodsChainUp(goodsChainSel, 6), 0, 0) + goodsCraftHtml(goodsChainSel);
  var u = goodsUsers(goodsChainSel);
  h += '<div class="gtier">下游(拿來做什麼)</div>';
  if (!u.recipes.length && !u.tags.length) h += '<div class="gsub">目前只能賣給市集(基價 ' + goodsPrice(goodsChainSel) + ')</div>';
  u.recipes.forEach(function (r) { h += '<div class="gsub">' + r.n + '件 → ' + goodsEsc(goodsName(r.out)) + '(' + goodsEsc(r.bld) + ')</div>'; });
  u.tags.forEach(function (t) { h += '<div class="gsub">' + goodsEsc(t) + '</div>'; });
  return h;
}

// 基本模式「材料」分頁:每種生產建築一張卡——產出、需要材料(庫存 / 缺)、缺 X → 去哪裡 〔前往〕;不顯示鏈條文字
function goodsGapBtn(gp) {
  if (gp.act === 'build') return '<button class="gmini" data-gp="gbuild" data-v="' + goodsEsc(gp.arg) + '">' + gp.label + '</button>';
  if (gp.act === 'tech') return '<button class="gmini" data-gp="gtech" data-v="' + goodsEsc(gp.arg) + '">' + gp.label + '</button>';
  if (gp.act === 'go') return '<button class="gmini" data-gp="go" data-x="1" data-k="' + goodsEsc(gp.arg) + '">' + gp.label + '</button>';
  if (gp.act === 'buy') return '<button class="gmini" data-gp="gbuy">' + gp.label + '</button>';
  if (gp.act === 'refill') return '<button class="gmini" data-gp="refill">' + gp.label + '</button>';
  return '';
}
function goodsGapLine(gp) {
  return '<div class="ggap">缺 ' + goodsEsc(gp.name) + ' → ' + goodsEsc(gp.where) + ' ' + goodsGapBtn(gp) + (gp.buy && gp.act !== 'buy' ? ' <button class="gmini" data-gp="gbuy">走鏢</button>' : '') + '</div>';
}
function goodsNeedHtml() {
  var c = goodsCity(), auto = goodsAutoOn(), list = goodsNeedList(), h = '', cnt = { run: 0, miss: 0, full: 0, road: 0, hold: 0 };
  h += '<div class="gsub">把材料放進庫房(採集、走鏢帶回…),工坊會自己領料開工。</div>' +
    '<div class="gsub"><button class="gmini' + (auto ? ' on' : '') + '" data-gp="auto">自動調度:' + (auto ? '開' : '關') + '</button> <button class="gmini" data-gp="refill">補料</button></div>';
  if (!auto) h += '<div class="gsub">自動調度已關:工坊只在按「補料」時領 1 小時份的材料。</div>';
  if (goodsRefillLast) {
    h += '<div class="gnd grf"><div>' + goodsEsc(goodsRefillText(goodsRefillLast)) + '</div>';
    goodsRefillLast.missing.forEach(function (id) { h += goodsGapLine(goodsGapInfo(id)); });
    h += '</div>';
  }
  if (!list.length) return h + '<div class="gsub">還沒有生產建築:蓋麻田、木工棚、織坊、礦坑、打鐵舖、成衣鋪。</div>';
  list.forEach(function (g) { cnt[g.state] += g.n; });
  h += '<div class="gsub">運轉中 ' + cnt.run + '、缺料 ' + cnt.miss + '、倉庫滿了 ' + cnt.full + '、沒接路 ' + cnt.road + (cnt.hold ? '、等補料 ' + cnt.hold : '') + '</div>';
  list.forEach(function (g) {
    h += '<div class="gnd' + (g.state !== 'run' ? ' bad' : '') + '"><div class="gnh"><span>' + g.icon + ' ' + goodsEsc(g.name) + (g.n > 1 ? ' ×' + g.n : '') + '</span><b class="gst gst-' + g.state + '">' + goodsEsc(g.stateText) + '</b>' +
      (g.roadKey === g.key ? '' : '<button class="gmini" data-gp="go" data-x="1" data-k="' + g.key + '">前往</button>') + '</div>' +
      '<div>產出:' + g.outIcon + goodsEsc(g.outName) + (g.perHour > 0 ? ' ' + g.perHour + ' /時' : '') + '</div>';
    if (g.kind === 'rec') h += '<div>需要材料:' + g.mats.map(function (m) { return m.lack ? '<b class="glack">' + m.icon + goodsEsc(m.name) + ' ×' + m.n + '(缺)</b>' : m.icon + goodsEsc(m.name) + ' ×' + m.n + '(庫存 ' + m.have + ')'; }).join('、') + '</div>';
    else h += '<div class="gsub">不需材料</div>';
    g.gaps.forEach(function (gp) { h += goodsGapLine(gp); });
    if (g.roadKey) h += '<div class="ggap">沒接路 → 補一段路接到城主府(現在產量減半) <button class="gmini" data-gp="go" data-x="1" data-k="' + g.roadKey + '">前往接路</button></div>';
    if (g.state === 'full') h += '<div class="ggap">倉庫滿了 → ' + (c && c.autoSell ? '多出的自動賣成金幣' : '用掉它,或打開溢出自動賣 <button class="gmini" data-gp="sell">打開</button>') + '</div>';
    if (g.state === 'hold') h += '<div class="ggap">等補料 → 按上方「補料」 <button class="gmini" data-gp="refill">補料</button></div>';
    if (g.rids && g.rids.length > 1) h += '<button class="gmini" data-gp="cyc" data-k="' + g.key + '">換配方</button>';
    h += '</div>';
  });
  return h;
}
// 「前往蓋 / 前往科技 / 走鏢」:關庫房、開對應介面
function goodsToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { if (typeof console !== 'undefined') console.warn('[goods] toast 失敗', e); } } }
function goodsGoBuild(t) {
  if (!t || typeof OBJECTS === 'undefined' || !OBJECTS[t]) return false;
  goodsPanelToggle(false);
  if (!(typeof srGoBuild === 'function' && srGoBuild(t)) && typeof setTool === 'function') setTool(t);
  goodsToast('已選「' + goodsBldName(t) + '」,點地面放置');
  return true;
}
function goodsGoTech(id) {
  goodsPanelToggle(false);
  if (typeof techPanelOpen === 'function' && techPanelOpen(id)) return true;
  if (typeof toggleTechPanel === 'function') { toggleTechPanel(true); return true; }
  return false;
}
function goodsGoBuy() {
  if (typeof caravanPanelToggle !== 'function') return false;
  goodsPanelToggle(false);
  caravanPanelToggle(true);
  goodsToast('走鏢會隨機帶回加工品以上的貨,回來自動入庫');
  return true;
}

// ───────── 最小 UI:庫房面板(側欄「庫房」按鈕 → 隱藏的 #btnGoods)─────────
function goodsEsc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
function goodsPanelHtml() {
  var c = goodsCity(), h = '', tierName = ['原料', '加工品', '成品', '工藝品', '奢侈品'], last = -1, adv = goodsIsAdv();
  if (!c) return '';
  var tb = function (v, nm) { return '<button class="gmini' + (goodsTab === v ? ' on' : '') + '" data-gp="tab" data-v="' + v + '">' + nm + '</button>'; };
  h += '<button class="close" data-gp="close" title="關閉">✕</button><b>📦 庫房</b> ' + tb('need', '材料') + tb('inv', '庫存') +
    (adv || goodsTab === 'chain' || goodsTab === 'prod' ? tb('chain', '鏈條') + tb('prod', '生產') : '') +
    '<button class="gmini" data-gp="mode">' + (adv ? '收起進階' : '進階 ▸') + '</button>';
  if (goodsTab === 'chain') return h + goodsChainHtml();
  if (goodsTab === 'prod') return h + goodsProdHtml();
  if (goodsTab === 'need') return h + goodsNeedHtml();
  h += '<div class="gsub">每種貨品各有上限;<button data-gp="sell" class="gmini">溢出自動賣:' + (c.autoSell ? '開' : '關') + '</button></div>';
  goodsVisibleList().forEach(function (g) {
    if (g.tier !== last) { last = g.tier; h += '<div class="gtier">T' + g.tier + ' ' + tierName[g.tier] + '</div>'; }
    var pct = Math.max(0, Math.min(100, Math.round(g.have / g.cap * 100)));
    h += '<div class="grow"><span>' + g.icon + ' ' + goodsEsc(g.name) + '</span><span class="gn">' + g.have + ' / ' + g.cap + '</span><i class="gbar"><u style="width:' + pct + '%"></u></i></div>';
  });
  if (!adv) return h + '<div class="gsub">工坊缺什麼、去哪拿 → 看「材料」分頁。</div>' + (goodsLast && goodsOfflineText() ? '<div class="gtier">離開期間</div><div class="gsub">' + goodsEsc(goodsOfflineText()) + '</div>' : '');
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
// 開庫房的鏈條分頁:sel = 要看的貨品,focus = 標出缺口的貨品(皆可省略)
function goodsOpenChain(sel, focus) {
  if (sel && GOODS[sel]) goodsChainSel = sel;
  goodsChainFocus = focus && GOODS[focus] ? focus : null;
  goodsTab = 'chain';
  goodsPanelToggle(true);
  goodsPanelRender();
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
  else if (a === 'tab') { var tv = t.getAttribute('data-v'); goodsTab = ['need', 'inv', 'chain', 'prod'].indexOf(tv) >= 0 ? tv : 'need'; if (goodsTab !== 'chain') goodsChainFocus = null; goodsPanelRender(); }
  else if (a === 'mode') { var on = goodsSetAdv(!goodsIsAdv()); if (!on && (goodsTab === 'chain' || goodsTab === 'prod')) goodsTab = 'need'; if (on && goodsTab === 'need') goodsTab = 'chain'; goodsPanelRender(); }
  else if (a === 'auto') { goodsSetAuto(!goodsAutoOn()); goodsRefillLast = null; goodsPanelRender(); }
  else if (a === 'refill') { goodsRefill(); goodsPanelRender(); }
  else if (a === 'gbuild') goodsGoBuild(t.getAttribute('data-v'));
  else if (a === 'gtech') goodsGoTech(t.getAttribute('data-v'));
  else if (a === 'gbuy') goodsGoBuy();
  else if (a === 'view') { if (typeof chainVisToggle === 'function') chainVisToggle(); goodsPanelRender(); }
  else if (a === 'go') {
    var kk = (t.getAttribute('data-k') || '').split(',');
    if (typeof centerOnCell === 'function' && kk.length === 2) { centerOnCell(+kk[0], +kk[1]); if (typeof clampView === 'function') clampView(); }
    if (t.getAttribute('data-x') === '1') goodsPanelToggle(false);   // 基本模式的「前往」:關掉庫房讓玩家看到地圖
  }
  else if (a === 'gap') { goodsOpenChain(t.getAttribute('data-id'), t.getAttribute('data-m')); }
  else if (a === 'chain') { goodsChainSel = t.getAttribute('data-id') || goodsChainSel; goodsPanelRender(); }
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
      '#goodsPanel .gmini{min-height:28px;padding:2px 8px;font-size:12px}#goodsPanel .gmini.on{background:#f0b45a;color:#222}' +
      '#goodsPanel .gchips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}#goodsPanel .gch{margin-top:3px;border-left:1px solid rgba(255,255,255,.2);padding-left:6px}#goodsPanel .gch small{display:block;opacity:.8}#goodsPanel .gch small.bad{color:#ff8a7a;opacity:1}#goodsPanel .gtag{opacity:.6;font-size:11px}#goodsPanel .gfocus{color:#ff8a7a;font-weight:bold}' +
      '#goodsPanel .gnd{margin-top:6px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.06);line-height:1.5}#goodsPanel .gnd.bad{background:rgba(255,120,100,.10)}#goodsPanel .gnd.grf{background:rgba(240,180,90,.14)}' +
      '#goodsPanel .gnh{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px}#goodsPanel .gnh span{flex:1;min-width:0;font-weight:bold}#goodsPanel .gnh .gmini{margin-top:0}#goodsPanel .gst{font-size:12px;padding:0 6px;border-radius:6px;background:#3f9d5a;color:#fff;font-weight:normal}' +
      '#goodsPanel .gst-miss{background:#d9503f}#goodsPanel .gst-full{background:#4f8fd6}#goodsPanel .gst-road{background:#d98b2f}#goodsPanel .gst-hold{background:#7a7f88}' +
      '#goodsPanel .glack{color:#ff8a7a}#goodsPanel .ggap{margin-top:3px;color:#ffb0a4}#goodsPanel .gnd .gmini{margin-top:3px}' +
      '.gcraft{margin-top:4px;line-height:1.9;font-size:12px}.gcraft small{display:block;opacity:.75;line-height:1.4}.gcraft .gmat{font-weight:bold;white-space:nowrap}' +   // 庫房鏈條頁與生產視圖彈窗(chainvis.js)共用
      '.gcraft .gstep{font-style:normal;padding:0 5px;border-radius:6px;background:rgba(255,255,255,.08);color:#b8bcc4;white-space:nowrap}';
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
