// js/citytech.js — 科技執行層 + 研究院研發序列(PLAN_NOLEVEL NL1;資料見 techtree_data.js / nolevel_data.js)
// 狀態存於 world.city.tech(隨 world.city 一起存檔);所有「時間」皆為遊戲秒,techTick 每秒節流。
// 解鎖查詢:techUnlocked(unlockId) 與 nlUnlocked(objId)(物件 → NL_OBJ_TECH 節點);map.js isUnlocked 經營板走 nlUnlocked。

var TECH_QUEUE_MAX = 10;
var TECH_OFFLINE_MAX = 8 * 3600;
var TECH_XUE_PER_MIN = 1;                        // 占位:每座研究院每分鐘學識
var TECH_MIN = { C1: 2, C2: 8, C3: 18, C4: 30, C5: 45 };   // 占位:各成本階別研發分鐘
var TECH_LAB_CAP = [0, 1, 2, 3, 3, 3];           // 依時代的研究院上限(索引 = 時代)
var TECH_ERA_K_DEFAULT = [0, 0, 8, 12, 12, 10];  // 前一時代需研完項數(索引 = 要開的時代)
var TECH_ERA_BIG_DEFAULT = [null, null, null, [['mg_lishi']], [['mg_zhucheng'], ['mg_kaiqu']], [['mg_xuegong'], ['mg_zhucheng', 'mg_kaiqu']]];   // 里程碑:外層任一組、組內全需(無 NL_ERA_RULE 時的預設)
var TECH_BIG_ALIAS = { li_shi: 'mg_lishi', zhu_cheng: 'mg_zhucheng', kai_qu: 'mg_kaiqu', xue_gong: 'mg_xuegong' };   // 舊占位 id → 資料檔 id
var techAcc = 0;
var techEvents = [];

function techNode(id) {
  if (typeof CITY_TECHS === 'undefined') return null;
  if (!techNode._m || techNode._n !== CITY_TECHS.length) {
    techNode._m = {}; techNode._n = CITY_TECHS.length;
    CITY_TECHS.forEach(function (t) { techNode._m[t.id] = t; });
  }
  return techNode._m[id] || null;
}
function techLabelOf(n) { var s = (typeof fxTechLabel === 'function') ? fxTechLabel(n) : (n ? n.name : ''); return (n && n.id === 'md_cesuo' && s === '圊溷') ? '圊溷(茅廁)' : s; }   // 節點顯示名(魔幻世界讀覆寫,其餘原名)
function techIsStyle(n) { return !!n && n.id.indexOf('st_') === 0; }
function techIsMega(n) { return !!n && (n.kind === 'mega' || n.id.indexOf('mg_') === 0); }   // 里程碑(大工程)不走研發序列

function techNormState(v) {
  var s = { done: {}, queue: [], cur: [], xue: 0, xueFrac: 0, big: {}, migrated: 0, bigWaive: 0 }, k;
  if (v && typeof v === 'object') {
    if (v.done && typeof v.done === 'object') for (k in v.done) if (v.done[k]) s.done[k] = 1;
    if (Array.isArray(v.queue)) v.queue.forEach(function (id) { if (typeof id === 'string' && s.queue.indexOf(id) < 0 && s.queue.length < TECH_QUEUE_MAX) s.queue.push(id); });
    var cc = Array.isArray(v.cur) ? v.cur : (v.cur && typeof v.cur === 'object' ? [v.cur] : []);
    cc.forEach(function (c) {
      if (!c || typeof c.id !== 'string') return;
      var left = Number(c.left), tot = Number(c.total);
      s.cur.push({ id: c.id, t0: Number(c.t0) || 0, left: isFinite(left) && left > 0 ? left : 0, total: isFinite(tot) && tot > 0 ? tot : (isFinite(left) ? left : 1),
        paid: (c.paid && typeof c.paid === 'object') ? c.paid : { coin: 0, xue: 0, goods: {} } });
    });
    if (typeof v.xue === 'number' && isFinite(v.xue) && v.xue > 0) s.xue = v.xue;
    if (typeof v.xueFrac === 'number' && isFinite(v.xueFrac) && v.xueFrac > 0) s.xueFrac = Math.min(0.9999, v.xueFrac);
    if (v.big && typeof v.big === 'object') for (k in v.big) if (v.big[k]) s.big[k] = 1;
    s.migrated = v.migrated ? 1 : 0;
    s.bigWaive = Number(v.bigWaive) || 0;
  }
  return s;
}
// 讀檔掛點(map.js loadWorldSave):goods 的 goodsNormCity 會丟掉未知欄位,所以讀完後補回
function techLoadFrom(cityObj) {
  if (typeof world === 'undefined' || !world) return;
  if (!world.city || typeof world.city !== 'object') world.city = {};
  world.city.tech = techNormState(cityObj && cityObj.tech);
  techAcc = 0;
}
function techState() {
  if (typeof world === 'undefined' || !world) return null;
  if (typeof goodsCity === 'function') goodsCity();
  if (!world.city || typeof world.city !== 'object') world.city = {};
  if (!world.city.tech) world.city.tech = techNormState(null);
  return world.city.tech;
}

// ───────── 查詢 ─────────
function techDone(id) { var s = techState(); return !!(s && s.done[id]); }
function techReqMet(n) {
  if (n.req.every(techDone)) return true;
  return !!(n.reqOr && n.reqOr.length && n.reqOr.some(techDone));   // reqOr = 與 req 互為「或」
}
function techCostOf(id) {
  var n = techNode(id), c = n && n.cost;
  if (!c) return null;
  if (typeof tutFreeTech === 'function' && tutFreeTech(id)) return { coin: 0, xue: 0, goods: null };   // 新手教學:茅廁首研免費(只一次)
  var g = c.goods ? { tier: c.goods.tier, n: (c.goods.n || 0) + (c.goods.rare || 0) } : null;
  return { coin: c.coin || 0, xue: c.xue || 0, goods: g };
}
function techDurationOf(id) {
  var n = techNode(id); if (!n) return 0;
  if (typeof tutFreeTech === 'function' && tutFreeTech(id)) return TUT_MD_SECONDS;   // 新手教學:茅廁研發 30 秒(只一次)
  var base = (TECH_MIN['C' + n.era] || 2) * 60;
  return Math.max(1, Math.round(techIsStyle(n) ? base / 2 : base));
}
function techSpeedMul(branch) { return (typeof npcTechSpeedMul === 'function') ? npcTechSpeedMul() : 1; }      // 掛點:研究院入住人才 buff(上限 2)——學官職司人事值(npcinteract.js)
function techLabCount() {
  if (typeof world === 'undefined' || !world) return 0;
  var o = world.objects;
  if (!Array.isArray(o)) return 0;
  var n = 0; for (var i = 0; i < o.length; i++) if (o[i] && o[i].type === 'research') n++;
  return n;
}
function techLabCap() { return TECH_LAB_CAP[techEra()] || 1; }   // 研究院數量上限(OBJECTS.research.max 由 capOf 讀此值)
function techSlots() { return Math.min(techLabCount(), techLabCap()); }

// ───────── 時代 ─────────
function techEraDoneCount(e) {
  var c = 0;
  if (typeof CITY_TECHS === 'undefined') return 0;
  CITY_TECHS.forEach(function (n) { if (n.era === e && !techIsStyle(n) && !techIsMega(n) && techDone(n.id)) c++; });
  return c;
}
// 時代開放規則:讀 nolevel_data.js 的 NL_ERA_RULE[e].cond = { prevEra, count, milestone?, anyOf? };缺資料用預設。
// anyOf 每項抽出其中的 mg_* id,同一項內的 id 需全部達成(例:'mg_zhucheng|mg_kaiqu(未選的那項)' = 兩者皆成);外層任一項成立即可
function techEraNeed(e) {
  var rule = (typeof NL_ERA_RULE !== 'undefined' && NL_ERA_RULE) ? NL_ERA_RULE[e] : null, cond = rule && rule.cond, groups = null;
  if (!cond) return { k: TECH_ERA_K_DEFAULT[e], groups: TECH_ERA_BIG_DEFAULT[e] || null };
  if (cond.anyOf && cond.anyOf.length) {
    groups = cond.anyOf.map(function (a) { return String(a).match(/mg_[a-z0-9]+/g) || []; }).filter(function (g) { return g.length; });
  } else if (cond.milestone) groups = [[cond.milestone]];
  if (e === 5) groups = TECH_ERA_BIG_DEFAULT[5];   // 資料檔 era5 的 anyOf 為近似(列三項);語意 = 興學宮,或築城 + 開渠兩者皆成
  return { k: cond.count != null ? cond.count : TECH_ERA_K_DEFAULT[e], groups: groups && groups.length ? groups : null };
}
function techBigHas(id) { var s = techState(); id = TECH_BIG_ALIAS[id] || id; return !!(s && (s.big[id] || s.done[id])); }
function techEraOpen(e) {
  if (e <= 1) return true;
  var s = techState(), need = techEraNeed(e);
  if (!techEraOpen(e - 1)) return false;
  if (techEraDoneCount(e - 1) < need.k) return false;
  if (s.bigWaive >= e) return true;
  if (need.groups && !need.groups.some(function (g) { return g.every(techBigHas); })) return false;
  return true;
}
function techEra() { var e = 1; while (e < 5 && techEraOpen(e + 1)) e++; return e; }
function techBigDone(id) { var s = techState(); if (!s || !id) return; id = TECH_BIG_ALIAS[id] || id; var was = !!(s.big[id] || s.done[id]); s.big[id] = 1; if (techNode(id)) s.done[id] = 1; if (!was && typeof cardsOnTechDone === 'function') cardsOnTechDone(id, true); }   // 大工程(里程碑)完成掛點:同時記為已研,供解鎖查詢

// ───────── 資源 ─────────
function techGoodsIds(tier) {
  if (typeof GOODS === 'undefined') return [];
  // 該階貨品尚未定義時(目前貨品只到 T2,科技卻有 T3/T4 需求),退用現有最高階貨品,避免中後期科技永遠付不起
  var t = tier;
  while (t >= 0) {
    var ids = Object.keys(GOODS).filter(function (g) { return GOODS[g].tier === t && !GOODS[g].res && !GOODS[g].pack; }).sort();   // 魔幻特色貨品(pack)不可抵付科技成本(PLAN_FANTASY_B Q7)
    if (ids.length) return ids;
    t--;
  }
  return [];
}
function techHave(id) { return typeof cityGoodsHave === 'function' ? cityGoodsHave(id) : 0; }
function techGoodsPlan(g) {   // 回傳 {id:數量} 或 null(不足)。從庫存多者先取,同量依 id
  if (!g || !(g.n > 0)) return {};
  var ids = techGoodsIds(g.tier).filter(function (i) { return techHave(i) > 0; });
  ids.sort(function (a, b) { return techHave(b) - techHave(a) || (a < b ? -1 : 1); });
  var need = g.n, plan = {};
  for (var i = 0; i < ids.length && need > 0; i++) { var t = Math.min(need, techHave(ids[i])); plan[ids[i]] = t; need -= t; }
  return need > 0 ? null : plan;
}
function techAffordable(id) {
  var c = techCostOf(id), s = techState();
  if (!c || !s) return false;
  var coin = (typeof world !== 'undefined' && world.res && world.res.coin) || 0;
  if (coin < c.coin || Math.floor(s.xue + 1e-6) < c.xue) return false;
  return !c.goods || techGoodsPlan(c.goods) !== null;
}
function techCanStart(id) {
  var n = techNode(id), s = techState();
  if (!n || !s || s.done[id] || techIsMega(n)) return false;
  if (!techReqMet(n) || !techEraOpen(n.era)) return false;
  if (s.cur.some(function (c) { return c.id === id; })) return false;
  if (s.cur.length >= techSlots()) return false;
  return techAffordable(id);
}
function techPay(id) {   // 呼叫前已確認 techAffordable
  var c = techCostOf(id), s = techState(), paid = { coin: c.coin, xue: c.xue, goods: {} };
  if (typeof tutUseFree === 'function') tutUseFree(id);
  world.res.coin -= c.coin; s.xue = Math.max(0, s.xue - c.xue);
  if (c.goods) {
    var plan = techGoodsPlan(c.goods);
    for (var g in plan) { if (typeof goodsTake === 'function') goodsTake(g, plan[g]); paid.goods[g] = plan[g]; }
  }
  return paid;
}
function techRefund(paid) {
  var s = techState(); if (!paid) return;
  world.res.coin = (world.res.coin || 0) + (paid.coin || 0); s.xue += paid.xue || 0;
  for (var g in paid.goods) if (typeof cityGoodsAdd === 'function') cityGoodsAdd(g, paid.goods[g]);
}

// ───────── 序列 ─────────
// 展開未完成前置(後序、去重、環檢測)。回傳 { ok, list:[…含 id 本身], reason }
function techExpand(id) {
  var out = [], seen = {}, vis = {}, err = null;
  function dfs(x) {
    if (err || seen[x] || techDone(x)) return;
    var n = techNode(x);
    if (!n) { err = 'unknown'; return; }
    if (vis[x]) { err = 'cycle'; return; }
    vis[x] = 1;
    if (!techReqMet(n)) n.req.forEach(dfs);
    vis[x] = 0; seen[x] = 1;
    if (!err) out.push(x);
  }
  dfs(id);
  if (err) return { ok: false, list: [], reason: err };
  return { ok: true, list: out };
}
function techQueueFill(id, partial) {
  var s = techState(), ex;
  if (!s) return { ok: false, added: [], reason: 'nostate' };
  if (!techNode(id)) return { ok: false, added: [], reason: 'unknown' };
  if (s.done[id]) return { ok: false, added: [], reason: 'done' };
  if (techIsMega(techNode(id))) return { ok: false, added: [], reason: 'mega' };
  ex = techExpand(id);
  if (!ex.ok) return { ok: false, added: [], reason: ex.reason };
  var inCur = {}; s.cur.forEach(function (c) { inCur[c.id] = 1; });
  var add = ex.list.filter(function (x) { return s.queue.indexOf(x) < 0 && !inCur[x]; });
  for (var i = 0; i < add.length; i++) if (!techEraOpen(techNode(add[i]).era)) return { ok: false, added: [], reason: 'era' };
  var room = TECH_QUEUE_MAX - s.queue.length;
  if (add.length > room && !partial) return { ok: false, added: [], reason: 'full', need: add.length, room: room };
  var take = add.slice(0, Math.max(0, room));
  take.forEach(function (x) { s.queue.push(x); });
  var all = take.length === add.length;
  return { ok: all, added: take, reason: all ? '' : 'full', need: add.length, room: room };
}
function techQueueAdd(id) { return techQueueFill(id, false); }      // 全有或全無
function techQueueAddTo(id) { return techQueueFill(id, true); }     // 研發到這裡:放得下的前置先排入
function techDependents(id) {   // 序列中依賴 id 的後續項(遞移)
  var s = techState(), res = [], set = {}, again = true;
  set[id] = 1;
  while (again) {
    again = false;
    s.queue.forEach(function (q) {
      if (set[q]) return;
      var n = techNode(q);
      if (n && (n.req.some(function (r) { return set[r]; }) || (n.reqOr || []).some(function (r) { return set[r]; }))) { set[q] = 1; res.push(q); again = true; }
    });
  }
  return res;
}
function techQueueRemove(id, opt) {
  var s = techState(), ids = [id];
  if (!s || s.queue.indexOf(id) < 0) return { ok: false, removed: [] };
  if (opt && opt.cascade) ids = ids.concat(techDependents(id));
  s.queue = s.queue.filter(function (q) { return ids.indexOf(q) < 0; });
  return { ok: true, removed: ids };
}
function techQueueMove(id, to) {
  var s = techState(), i = s ? s.queue.indexOf(id) : -1;
  if (i < 0) return false;
  to = Math.max(0, Math.min(s.queue.length - 1, to | 0));
  s.queue.splice(i, 1); s.queue.splice(to, 0, id);
  return true;
}
function techCancel(id) {   // 取消進行中項目:全額退還
  var s = techState(); if (!s) return false;
  for (var i = 0; i < s.cur.length; i++) if (s.cur[i].id === id) {
    techRefund(s.cur[i].paid); s.cur.splice(i, 1); return true;
  }
  return false;
}

// ───────── 推進 ─────────
function techFillSlots(now) {
  var s = techState(), i = 0, id, t;
  while (i < s.queue.length && s.cur.length < techSlots()) {
    id = s.queue[i];
    if (s.done[id]) { s.queue.splice(i, 1); continue; }
    if (techCanStart(id)) {
      s.queue.splice(i, 1);
      t = techDurationOf(id);
      s.cur.push({ id: id, t0: now, left: t, total: t, paid: techPay(id) });
      i = 0;   // 序列變動,從頭再找第一個可開始者
    } else i++;
  }
}
function techFinish(c, now) {
  var s = techState();
  s.done[c.id] = 1;
  techEvents.push({ type: 'done', id: c.id, t: now });
  if (typeof techOnDone === 'function') techOnDone(c.id);
  if (typeof cardsOnTechDone === 'function') cardsOnTechDone(c.id, false);   // 酒館:完成科技得酒令(cards.js)
  if (typeof cityUnlockApply === 'function') cityUnlockApply(c.id);
}
function techMulOf(c) { return techSpeedMul((techNode(c.id) || {}).branch) || 1; }
function techAddXue(labs, sec) {
  var s = techState(), r;
  s.xueFrac += labs * TECH_XUE_PER_MIN / 60 * sec;
  r = Math.floor(s.xueFrac);
  if (r > 0) { s.xue += r; s.xueFrac -= r; }
}
// 整秒推進 sec(事件式,確定性):每步推進到最近的完成點;無進行中時最多每 60 秒重試一次開工
function techAdvance(sec) {
  var s = techState(), labs = techLabCount(), left = Math.floor(sec), n = 0, step, run;
  if (!s || labs <= 0 || !(left > 0)) return 0;
  while (left > 0) {
    techFillSlots(n);
    run = s.cur.slice(0, techSlots());
    if (!run.length && !s.queue.length) { techAddXue(labs, left); n += left; break; }
    step = run.length ? left : Math.min(left, 60);
    run.forEach(function (c) { step = Math.min(step, Math.max(1, Math.ceil(c.left / techMulOf(c)))); });
    techAddXue(labs, step);
    run.forEach(function (c) { c.left -= step * techMulOf(c); });
    n += step; left -= step;
    for (var i = s.cur.length - 1; i >= 0; i--) if (s.cur[i].left <= 1e-9) techFinish(s.cur.splice(i, 1)[0], n);
  }
  return n;
}
function techTick(dt) {
  techAcc += dt;
  if (techAcc < 1) return;
  var w = Math.floor(techAcc);
  techAcc -= w;
  techAdvance(w);
}
function techOffline(sec) {
  sec = Math.max(0, Math.min(Math.floor(sec) || 0, TECH_OFFLINE_MAX));
  return techAdvance(sec);
}
function techPopEvents() { var e = techEvents; techEvents = []; return e; }

// ───────── 解鎖查詢 / 遷移 ─────────
function techUnlocked(unlockId) {
  if (typeof CITY_TECHS === 'undefined') return false;
  for (var i = 0; i < CITY_TECHS.length; i++) {
    var n = CITY_TECHS[i];
    if (n.unlock && n.unlock.indexOf(unlockId) >= 0 && techDone(n.id)) return true;
  }
  return false;
}
// 經營板物件是否已開放:NL_START_OBJS(或 NL_OBJ_TECH 值為 'start')起手;其餘需對應節點已研完。
// 回傳 true/false;資料檔未載入或物件不在對照表 → null(呼叫端沿用舊判定)
// 物件對應節點:NL_OBJ_TECH 優先,其次 nl_objects.js 新物件的 tech 欄;無則 undefined
function nlObjTech(objId) {
  var fx = (typeof fxObjTech === 'function') ? fxObjTech(objId) : undefined, src;   // 魔幻世界:本族風格件走 FX 覆寫(js/fxpack.js);歷史世界恆 undefined
  if (fx !== undefined) return fx;
  src = (typeof NL_OBJ_TECH !== 'undefined') ? NL_OBJ_TECH[objId] : undefined;
  if (src === undefined && typeof NL_NEW_OBJECTS !== 'undefined' && NL_NEW_OBJECTS[objId]) src = NL_NEW_OBJECTS[objId].tech;
  return src;
}
// 功能是否已開放(NL_FEATURE_GATE):open 恆真;node 需節點已研;bld 需場上有指定建築;focusHidden(legacy)與未登記回 null(沿用舊判定)
function nlFeatureOpen(id) {
  if (typeof NL_FEATURE_GATE === 'undefined' || typeof CITY_TECHS === 'undefined') return null;
  var g = NL_FEATURE_GATE[id], i, n = 0, o;
  if (!g) return null;
  if (g.type === 'open') return true;
  if (g.type === 'node') return techDone(g.need);
  if (g.type === 'bld') {
    o = (typeof world !== 'undefined' && world && world.objects) || [];
    for (i = 0; i < o.length; i++) if (o[i] && (o[i].type === g.need || (typeof fxAsList === 'function' && fxAsList(o[i].type).indexOf(g.need) >= 0))) n++;   // 魔幻件以 funcLike 視同漢式功能件
    return n >= (g.min || 1);
  }
  return null;
}
function nlUnlocked(objId) {
  if (typeof fxPack === 'function' && fxPack()) {   // 魔幻世界:被取代的漢式物件隱藏;本族風格件走科技閘(住宅第一件仍起手)
    if (fxHiddenObj(objId)) return false;
    var ft = fxObjTech(objId);
    if (ft !== undefined && typeof objPackOk === 'function' && objPackOk(objId)) return ft === 'start' ? true : techDone(ft);
  }
  if (typeof objPackOk === 'function' && typeof OBJECTS !== 'undefined' && OBJECTS[objId] && OBJECTS[objId].pack) return objPackOk(objId);   // 風格件:風格相符即起手開放,不符不可建
  if (typeof NL_OBJ_TECH === 'undefined' || typeof CITY_TECHS === 'undefined') return null;
  if (typeof NL_START_OBJS !== 'undefined' && NL_START_OBJS.indexOf(objId) >= 0) return true;
  var src = nlObjTech(objId);
  if (src === undefined) return null;
  if (src === 'start') return true;
  return techDone(src);
}
// 載入舊存檔時呼叫一次:lv 1~25 → 前 ⌊(lv-1)/5⌋ 個時代全給,當前時代依 ((lv-1)%5)/5 比例給(含前置),學識 +20×lv
function techMigrateFromLevel(lv) {
  var s = techState();
  if (!s || s.migrated || typeof CITY_TECHS === 'undefined') return false;
  lv = Math.max(1, Math.min(25, Math.floor(lv) || 1));
  var full = Math.floor((lv - 1) / 5), part = ((lv - 1) % 5) / 5, give = [], e;
  function order(era) {
    var list = CITY_TECHS.filter(function (n) { return n.era === era && !techIsStyle(n) && !techIsMega(n); }), out = [], seen = {};
    list.sort(function (a, b) { return ((a.cost && a.cost.coin) || 0) - ((b.cost && b.cost.coin) || 0) || (a.id < b.id ? -1 : 1); });
    function put(n) { if (seen[n.id] || n.era !== era) return; seen[n.id] = 1; n.req.forEach(function (r) { var m = techNode(r); if (m) put(m); }); out.push(n.id); }
    list.forEach(put);
    return out;
  }
  for (e = 1; e <= full && e <= 5; e++) give = give.concat(order(e));
  if (full < 5 && part > 0) { var o = order(full + 1); give = give.concat(o.slice(0, Math.floor(o.length * part))); }
  function grant(id) {
    var n = techNode(id);
    if (!n || s.done[id]) return;
    s.done[id] = 1;
    n.req.forEach(grant);
  }
  give.forEach(grant);
  CITY_TECHS.forEach(function (n) { if (techIsMega(n) && n.id !== 'mg_didu' && n.era <= full) { s.done[n.id] = 1; s.big[n.id] = 1; } });   // 已走完的時代,其里程碑視為完成
  s.xue += 20 * lv;
  s.bigWaive = Math.min(5, full + 1);   // 目前所在時代視為已開放
  s.migrated = 1;
  return true;
}

// ───────── 純文字摘要(除錯 / 顧問用)─────────
function techFmtTime(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
function techSummary() {
  var s = techState(); if (!s) return '';
  var labs = techLabCount();
  var t = '時代' + techEra() + ' 已研' + Object.keys(s.done).length + ' 學識' + Math.floor(s.xue) + ' 研究院' + labs + '/槽' + techSlots() + ' 序列' + s.queue.length + '/' + TECH_QUEUE_MAX;
  if (labs <= 0 && (s.queue.length || s.cur.length)) t += ' (尚無研究院,序列不會推進)';
  return t;
}
function techListText() {
  var s = techState(); if (!s) return '';
  var lines = [techSummary()];
  s.cur.forEach(function (c) { var n = techNode(c.id); lines.push('研發中 ' + (n ? techLabelOf(n) : c.id) + ' ' + techFmtTime(c.left)); });
  s.queue.forEach(function (id, i) { var n = techNode(id); lines.push((i + 1) + '. ' + (n ? techLabelOf(n) : id) + (techCanStart(id) ? '' : ' (等待)')); });
  return lines.join('\n');
}
