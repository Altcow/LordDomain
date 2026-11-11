// js/caravan.js — 走鏢執行層:狀態存讀、鏢師招募、買車、出車、到時結算並把貨物入庫(cityGoodsAdd)。資料與機率表見 caravan_goods.js,UI 見 caravanui.js。
// 存檔:localStorage 'lorddomain.caravan.v1'(世界內進度鍵,SAVE_SLOT_KEYS;切換世界 / 回溯點時整組取代)。
//   為了不受「切換世界後記憶體快取過期」影響,每次存取都以原始字串比對快取(raw 相同才沿用解析結果)。
// 結算:以時間戳(Date.now)計。出車時預抽亂數種子,到時用種子開獎 → 線上與離線(關閉遊戲再回來)結果一致;離線期間車隊照常走,不打折也不暫停。
//   庫房尚未載入(goodsCity() 為 null)時不結算,等下一次 tick。
// 對外:caravanGet caravanSave caravanTick caravanBuyCart caravanHire caravanDismiss caravanStart caravanQuote caravanPoolToday caravanUsedToday caravanLeft
//   caravanHall caravanCartCount caravanCartBusy caravanCartFree caravanShedUsed caravanRouteOpen
// 馬車:carts = { 品階id: 輛數 },開局每種 1 輛(caravanStartCarts);舊檔缺的品階補 1 輛、已有的輛數保留。買車 caravanBuyCart 休眠中(CARAVAN_BUY_ON = false,@DORMANT caravan_buy);每趟 trips[i].no = 該品階第幾輛(1 起),占用以「品階 + 序號」判定。
//   持有總數受鏢局車棚上限(買車時檢查;舊檔超額不刪,只是不能再買);同時出隊數受鏢局等級限制。
// ES2017;不用 ?. ??。

const CARAVAN_KEY = 'lorddomain.caravan.v1';
var caravanCache = null, caravanRaw = null;

function caravanStartCarts() { var o = {}; CARAVAN_CARTS.forEach(function (c) { o[c.id] = 1; }); return o; }   // 開局:每種馬車 1 輛
function caravanBlank() {
  return { v: 1, carts: caravanStartCarts(), roster: [], trips: [], day: '', used: 0, log: [], stats: { trips: 0, great: 0, fail: 0 } };
}
function caravanInt(v, lo, hi, d) {
  v = Number(v);
  if (!isFinite(v)) return d;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}
// 讀檔防呆:壞 JSON / 錯版本 → 空白;欄位逐一夾住。不回寫
function caravanNorm(d) {
  var s = caravanBlank(), seen = {};
  if (!d || typeof d !== 'object' || d.v !== 1) return s;
  var capMax = CARAVAN_HALL[CARAVAN_HALL.length - 1].shed;
  CARAVAN_CARTS.forEach(function (c) {   // 舊檔值為 1(或 true)→ 1 輛;數量夾在 1~最大車棚:每種至少 1 輛(缺的品階補發),已有的輛數保留
    s.carts[c.id] = d.carts && typeof d.carts === 'object' ? caravanInt(d.carts[c.id] === true ? 1 : d.carts[c.id], 1, capMax, 1) : 1;
  });
  if (Array.isArray(d.roster)) d.roster.forEach(function (id) {
    if (caravanEscortValid(id) && !seen[id] && s.roster.length < CARAVAN_ROSTER_MAX) { seen[id] = 1; s.roster.push(id); }
  });
  var busyC = {}, busyE = {};
  if (Array.isArray(d.trips)) d.trips.forEach(function (t) {
    if (!t || !caravanCart(t.cart) || !s.carts[t.cart] || !caravanRoute(t.route)) return;
    var t0 = Number(t.t0), t1 = Number(t.t1), used = busyC[t.cart] || (busyC[t.cart] = {}), no = caravanInt(t.no, 1, s.carts[t.cart], 0), k;
    if (!isFinite(t0) || !isFinite(t1) || t1 < t0) return;
    if (!no || used[no]) {   // 舊檔沒有序號 / 序號重複 → 補第一個空的;全占用則丟棄(同一輛車不會同時跑兩趟)
      no = 0;
      for (k = 1; k <= s.carts[t.cart]; k++) if (!used[k]) { no = k; break; }
      if (!no) return;
    }
    var esc = [];
    (Array.isArray(t.esc) ? t.esc : []).forEach(function (id) {
      if (s.roster.indexOf(id) >= 0 && !busyE[id] && esc.length < caravanCart(t.cart).slots) { esc.push(id); busyE[id] = 1; }
    });
    used[no] = 1;
    s.trips.push({ cart: t.cart, no: no, route: t.route, esc: esc, t0: t0, t1: t1, seed: caravanInt(t.seed, 0, 4294967295, 1), fee: caravanInt(t.fee, 0, 1e9, 0) });
  });
  s.day = typeof d.day === 'string' ? d.day.slice(0, 10) : '';
  s.used = caravanInt(d.used, 0, 1e6, 0);
  if (Array.isArray(d.log)) d.log.slice(-CARAVAN_LOG_MAX).forEach(function (e) {
    if (!e || !caravanCart(e.cart) || !caravanRoute(e.route) || !CARAVAN_OUTCOMES[e.outcome]) return;
    var items = {};
    if (e.items && typeof e.items === 'object') Object.keys(e.items).forEach(function (k) { var n = caravanInt(e.items[k], 0, 1e6, 0); if (n > 0) items[k] = n; });
    s.log.push({ ts: Number(e.ts) || 0, cart: e.cart, route: e.route, outcome: e.outcome, items: items, tiers: Array.isArray(e.tiers) && e.tiers.length === 4 ? e.tiers.map(function (x) { return caravanInt(x, 0, 1e6, 0); }) : [0, 0, 0, 0] });
  });
  if (d.stats && typeof d.stats === 'object') {
    s.stats.trips = caravanInt(d.stats.trips, 0, 1e9, 0);
    s.stats.great = caravanInt(d.stats.great, 0, 1e9, 0);
    s.stats.fail = caravanInt(d.stats.fail, 0, 1e9, 0);
  }
  return s;
}
function caravanGet() {
  var raw = null, d = null;
  try { raw = localStorage.getItem(CARAVAN_KEY); } catch (e) { raw = null; }
  if (caravanCache && raw === caravanRaw) return caravanCache;
  if (raw) { try { d = JSON.parse(raw); } catch (e2) { d = null; } }
  caravanCache = caravanNorm(d);
  caravanRaw = raw;
  return caravanCache;
}
// 寫檔失敗回傳 false 並 console.warn,不拋例外
function caravanSave() {
  var s = caravanCache;
  if (!s) return true;
  try {
    var raw = JSON.stringify(s);
    localStorage.setItem(CARAVAN_KEY, raw);
    caravanRaw = raw;
    return true;
  } catch (e) {
    console.warn('走鏢存檔失敗', e);
    return false;
  }
}

// ───────── 日期與次數 ─────────
function caravanDayKey(now) {
  var d = new Date(now === undefined ? Date.now() : now);
  return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
}
function caravanDayNum(now) {   // 本機日編號(招募候選的種子)
  var d = new Date(now === undefined ? Date.now() : now);
  return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
}
function caravanRollDay(s, now) {
  var k = caravanDayKey(now);
  if (s.day !== k) { s.day = k; s.used = 0; }
}
function caravanUsedToday(now) { var s = caravanGet(); return s.day === caravanDayKey(now) ? s.used : 0; }
function caravanLeft(now) { return Math.max(0, CARAVAN_DAILY_MAX - caravanUsedToday(now)); }

// ───────── 鏢師 ─────────
function caravanBusyEscorts() {
  var m = {};
  caravanGet().trips.forEach(function (t) { t.esc.forEach(function (id) { m[id] = 1; }); });
  return m;
}
// 今日招募候選(固定種子洗牌取前 N,已在名冊者不顯示)
function caravanPoolToday(now) {
  var s = caravanGet(), rng = caravanRng(caravanDayNum(now) * 31 + 7), ids = [], i, j, t;
  for (i = 1; i <= CARAVAN_ESCORT_COUNT; i++) ids.push(i);
  for (i = ids.length - 1; i > 0; i--) { j = Math.floor(rng() * (i + 1)); t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
  return ids.slice(0, CARAVAN_POOL_SIZE).filter(function (id) { return s.roster.indexOf(id) < 0; });
}
function caravanHire(id, now) {
  var s = caravanGet(), cost;
  if (!caravanEscortValid(id)) return { ok: false, reason: '沒有這位鏢師' };
  if (s.roster.indexOf(id) >= 0) return { ok: false, reason: '已經是自己人' };
  if (caravanPoolToday(now).indexOf(id) < 0) return { ok: false, reason: '今天沒有這位候選' };
  if (s.roster.length >= CARAVAN_ROSTER_MAX) return { ok: false, reason: '名冊已滿(' + CARAVAN_ROSTER_MAX + ')' };
  cost = caravanEscortHire(id);
  if (typeof world === 'undefined' || !world || !world.res || (world.res.coin || 0) < cost) return { ok: false, reason: '金幣不足(需 ' + cost + ')' };
  world.res.coin -= cost;
  s.roster.push(id);
  caravanSave();
  return { ok: true, cost: cost };
}
function caravanDismiss(id) {
  var s = caravanGet(), i = s.roster.indexOf(id);
  if (i < 0) return { ok: false, reason: '不在名冊' };
  if (caravanBusyEscorts()[id]) return { ok: false, reason: '出勤中' };
  s.roster.splice(i, 1);
  caravanSave();
  return { ok: true };
}

// ───────── 鏢局等級 / 車棚 ─────────
// 遊戲尚無鏢局建築:以官階(cards.js cardsRankLv,缺資料時 0)對 CARAVAN_HALL.rank 換算;回傳該級資料列
function caravanHall() {
  var rk = 0, h = CARAVAN_HALL[0], i;
  if (typeof cardsRankLv === 'function') { try { rk = cardsRankLv() | 0; } catch (e) { rk = 0; } }
  for (i = 0; i < CARAVAN_HALL.length; i++) if (rk >= CARAVAN_HALL[i].rank) h = CARAVAN_HALL[i];
  return h;
}
function caravanRouteOpen(routeId) { var r = caravanRoute(routeId); return !!r && caravanHall().lv >= (r.hall || 1); }
function caravanCartCount(cartId) { return caravanGet().carts[cartId] | 0; }
function caravanShedUsed() {
  var s = caravanGet(), n = 0;
  CARAVAN_CARTS.forEach(function (c) { n += s.carts[c.id] | 0; });
  return n;
}
function caravanCartBusy(cartId) {
  var n = 0;
  caravanGet().trips.forEach(function (t) { if (t.cart === cartId) n++; });
  return n;
}
function caravanCartFree(cartId) { return Math.max(0, caravanCartCount(cartId) - caravanCartBusy(cartId)); }
function caravanCartPrice(cartId) { var c = caravanCart(cartId); return !c ? 0 : (c.cost > 0 ? c.cost : CARAVAN_WHITE_EXTRA); }

// ───────── 買車(同品階可多輛,受車棚上限)─────────
function caravanBuyCart(cartId) {   // @DORMANT caravan_buy
  var s = caravanGet(), c = caravanCart(cartId), cost, cap = caravanHall().shed;
  if (!CARAVAN_BUY_ON) return { ok: false, reason: '買車暫停中' };   // @DORMANT caravan_buy
  if (!c) return { ok: false, reason: '沒有這種車' };
  if (caravanShedUsed() >= cap) return { ok: false, reason: '車棚已滿(' + cap + ' 輛)' };
  cost = caravanCartPrice(cartId);
  if (typeof world === 'undefined' || !world || !world.res || (world.res.coin || 0) < cost) return { ok: false, reason: '金幣不足(需 ' + cost + ')' };
  world.res.coin -= cost;
  s.carts[cartId] = (s.carts[cartId] | 0) + 1;
  caravanSave();
  return { ok: true, cost: cost, n: s.carts[cartId] };
}

// ───────── 出車 ─────────
// 找路上的車隊:只給品階 → 該品階第一趟;給序號 → 該輛
function caravanTrip(cartId, no) {
  var ts = caravanGet().trips;
  for (var i = 0; i < ts.length; i++) if (ts[i].cart === cartId && (no === undefined || (ts[i].no || 1) === no)) return ts[i];
  return null;
}
function caravanFreeNo(cartId) {   // 該品階第一輛閒置車的序號;沒有回 0
  var n = caravanCartCount(cartId), k;
  for (k = 1; k <= n; k++) if (!caravanTrip(cartId, k)) return k;
  return 0;
}
function caravanPower(escIds) {
  var p = 0;
  (escIds || []).forEach(function (id) { p += caravanEscortPower(id); });
  return p;
}
// 報價(不改狀態):{ fee, sec, power, pFail, odds }
function caravanQuote(cartId, routeId, escIds) {
  var c = caravanCart(cartId), r = caravanRoute(routeId), wage = 0, power = caravanPower(escIds);
  if (!c || !r) return null;
  (escIds || []).forEach(function (id) { wage += caravanEscortWage(id); });
  return { fee: r.fee + wage, route: r.fee, wage: wage, sec: Math.round(c.sec * r.secMul), power: power, pFail: caravanPFail(routeId, power), odds: caravanOdds(cartId) };
}
// 出車前置(只管「出新車」,已在路上的車隊不受影響):已蓋驛站(遊戲尚無鏢局,以最接近的驛站代用)+ 驛站旁的道路連到城門。
// 回傳 { ok, reason };缺建築 / 缺道路時 reason 為明確文字。取不到棋盤(讀檔未就緒)時不擋,避免誤鎖。
var CARAVAN_HUB_TYPE = 'post_station', CARAVAN_GATE_TYPES = ['gate', 'toll_gate'];
function caravanPrereq() {
  var b, W, lab, hubs = [], gateLab = {}, i, ok = false;
  if (typeof estateBoard !== 'function' || typeof goodsRoadLabels !== 'function' || typeof footprint !== 'function') return { ok: true };
  b = estateBoard();
  if (!b || !b.terrain || !b.objects) return { ok: true };
  b.objects.forEach(function (o) { if (o && o.type === CARAVAN_HUB_TYPE) hubs.push(o); });
  if (!hubs.length) return { ok: false, reason: '缺建築:需先蓋一座驛站(鏢局的代用建築)' };
  W = Math.round(Math.sqrt(b.terrain.length));
  lab = goodsRoadLabels(b, W);
  b.objects.forEach(function (o) {
    var f, x, y;
    if (!o || CARAVAN_GATE_TYPES.indexOf(o.type) < 0 || typeof OBJECTS === 'undefined' || !OBJECTS[o.type]) return;
    f = footprint(o.type, o.rot | 0);
    for (y = o.y; y < o.y + f[1]; y++) for (x = o.x; x < o.x + f[0]; x++) if (x >= 0 && y >= 0 && x < W && y < W && lab[y * W + x]) gateLab[lab[y * W + x]] = true;
  });
  if (!Object.keys(gateLab).length) return { ok: false, reason: '缺道路:城內還沒有城門,驛站的道路無處可通' };
  hubs.forEach(function (o) {
    var ring = goodsRingLabels(o, footprint(o.type, o.rot | 0), lab, W), l;
    for (l in ring) if (gateLab[l]) ok = true;
  });
  return ok ? { ok: true } : { ok: false, reason: '缺道路:驛站旁的道路還沒連到城門' };
}
function caravanStart(cartId, routeId, escIds, now) {
  var s = caravanGet(), c = caravanCart(cartId), r = caravanRoute(routeId), esc = [], busy, q, i, t, pre, no, hall;
  now = now === undefined ? Date.now() : now;
  if (!c || !r) return { ok: false, reason: '選擇不完整' };
  pre = caravanPrereq();
  if (!pre.ok) return { ok: false, reason: pre.reason };
  hall = caravanHall();
  if (!caravanRouteOpen(routeId)) return { ok: false, reason: '這條路線要鏢局 Lv' + r.hall + ' 才開放' };
  if (!s.carts[cartId]) return { ok: false, reason: '還沒有這輛車' };
  no = caravanFreeNo(cartId);
  if (!no) return { ok: false, reason: '這種車都在路上,要另一輛車' };
  if (s.trips.length >= hall.trips) return { ok: false, reason: '同時出隊已達上限(鏢局 Lv' + hall.lv + ':' + hall.trips + ' 隊)' };
  if (typeof goodsCity !== 'function' || !goodsCity()) return { ok: false, reason: '庫房尚未就緒' };
  caravanRollDay(s, now);
  if (s.used >= CARAVAN_DAILY_MAX) return { ok: false, reason: '今天的車次用完了(' + CARAVAN_DAILY_MAX + ')' };
  busy = caravanBusyEscorts();
  for (i = 0; i < (escIds || []).length; i++) {
    t = escIds[i];
    if (s.roster.indexOf(t) < 0 || busy[t] || esc.indexOf(t) >= 0) return { ok: false, reason: '鏢師不可用' };
    esc.push(t);
  }
  if (esc.length > c.slots) return { ok: false, reason: '這輛車最多派 ' + c.slots + ' 位鏢師' };
  q = caravanQuote(cartId, routeId, esc);
  if (typeof world === 'undefined' || !world || !world.res || (world.res.coin || 0) < q.fee) return { ok: false, reason: '金幣不足(需 ' + q.fee + ')' };
  world.res.coin -= q.fee;
  s.used++;
  s.stats.trips++;
  s.trips.push({ cart: cartId, no: no, route: routeId, esc: esc, t0: now, t1: now + q.sec * 1000, seed: Math.floor(Math.random() * 4294967295) + 1, fee: q.fee });
  caravanSave();
  return { ok: true, fee: q.fee, sec: q.sec, no: no };
}

// ───────── 結算 ─────────
// 到時的車隊開獎並入庫;回傳本次結算結果陣列([{ cart, route, outcome, items, ... }])
function caravanTick(now) {
  var s = caravanGet(), out = [], keep = [], changed = false, ready;
  now = now === undefined ? Date.now() : now;
  if (!s.trips.length) return out;
  if (typeof goodsCity !== 'function' || !goodsCity()) return out;
  s.trips.forEach(function (t) {
    var dur = t.t1 - t.t0;
    if (t.t1 - now > dur + 60000) { t.t1 = now + dur; changed = true; }   // 系統時間被往回調:最多再等一趟的時間
  });
  ready = s.trips.filter(function (t) { return t.t1 <= now; }).sort(function (a, b) { return a.t1 - b.t1; });
  if (!ready.length) { if (changed) caravanSave(); return out; }
  s.trips.forEach(function (t) { if (t.t1 > now) keep.push(t); });
  ready.forEach(function (t) {
    var r = caravanRoll(t.cart, t.route, caravanPower(t.esc), t.seed), id, e;
    for (id in r.items) cityGoodsAdd(id, r.items[id]);
    if (r.outcome === 'great') s.stats.great++;
    if (r.outcome === 'fail') s.stats.fail++;
    e = { ts: now, cart: t.cart, route: t.route, outcome: r.outcome, items: r.items, tiers: r.tiers };
    s.log.push(e);
    out.push(e);
  });
  s.trips = keep;
  if (s.log.length > CARAVAN_LOG_MAX) s.log = s.log.slice(-CARAVAN_LOG_MAX);
  caravanSave();
  if (typeof showToast === 'function') {
    try { showToast('走鏢歸來:' + out.length + ' 輛車,貨物已入庫'); } catch (err) { /* 略過 */ }
  }
  return out;
}

if (typeof setInterval === 'function' && typeof document !== 'undefined') {
  setInterval(function () { try { caravanTick(); } catch (e) { console.warn('走鏢結算失敗', e); } }, 1000);
}
