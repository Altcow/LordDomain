// js/cityadvisor.js — 顧問系統引擎(PLAN_NOLEVEL §4 §5 NL3b/NL3c 最小版):由當下狀態快照推得危急 / 警示 / 建議清單與長條資料。
// 純函式:advCompute(snap, mem, xun) 不碰 DOM、不寫存檔、同輸入同輸出。快照 advSnapshot() 讀既有引擎(cityfx / goods / tech / cityscore),全部 typeof 守衛。
// 存檔:只存 world.city.adv = { done:[id], ignore:[id], seenHelp:[stat] }(goods.js goodsNormCity 帶過 advNormSave);冷卻與揭露只在本次遊玩內。
// 資料在 cityadvisor_data.js,介面在 cityadvisorui.js。ES2017;不用 ?. ??。
// 全域名稱:advLevelOf advBarVal advRevealed advBars advCompute advSnapshot advTick advGet advAck advIgnore advDone advSeenHelp advMemNew advMemLoad advMemSave advNormSave
//   advGoPlan advGo advCardRect advCentralRect advRectsOverlap advSetClock advReset ADV_COND ADV_REVEAL

var ADV_CENTER = { x0: 0.25, x1: 0.75, y0: 0.2, y1: 0.8 };   // 與 panelmgr PANEL_CENTER 一致

function advClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function advHash(s) { var h = 5381, i; s = String(s); for (i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h; }
function advNum(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
function advItemDef(id) { var i; for (i = 0; i < BAR_ITEMS.length; i++) if (BAR_ITEMS[i].id === id) return BAR_ITEMS[i]; return null; }

// ───────── 長條:值 / 等級(0 正常 ● / 1 警示 ▲ / 2 危急 ■)─────────
function advBarVal(id, s) {
  var v = s && s.v ? s.v : {}, t;
  if (id === 'food' || id === 'water' || id === 'sani' || id === 'mood' || id === 'order') return (s && s.houses > 0) ? advNum(v[id]) : null;
  if (id === 'road') return advNum(s.road);
  if (id === 'plague') return advNum(s.plague);
  if (id === 'fame') return advNum(s.fame);
  if (id === 'edu') return advNum(s.edu);
  if (id === 'house') return advNum(s.occ);
  if (id === 'store') return s.store ? advNum(s.store.health) : null;
  if (id === 'tech') {
    t = s.tech && s.tech.state;
    return t === 'ok' ? 100 : (t === 'gap' || t === 'idle' || t === 'none' ? 50 : null);
  }
  return null;
}

function advLevelOf(id, val, s) {
  var d = advItemDef(id);
  if (!d || val === null || val === undefined) return 0;
  if (id === 'house') {
    if (val >= 98 && s && s.refugees) return 2;
    if (val >= 92 || val < 60) return 1;
    return 0;
  }
  if (id === 'tech') return val >= d.g ? 0 : 1;      // 研發最差只到警示
  return val >= d.g ? 0 : (val >= d.y ? 1 : 2);
}

// 逐步揭露條件(NL_REVEAL 簡化版)
var ADV_REVEAL = {
  start: function (s) { return true; },
  water: function (s) { return !!s.hasWell || (s.minutes || 0) >= 10; },
  workshop: function (s) { return (s.workshops || 0) >= 1; },
  tech: function (s) { return !!s.techOpened; },
  house: function (s) { return (s.houses || 0) >= 6 || (s.minutes || 0) >= 15; },
  order: function (s) { return (s.pop || 0) >= 40 || (s.minutes || 0) >= 30; },
  road: function (s) { return (s.buildings || 0) >= 30; },
  plague: function (s) { return !!s.saniEverWarn || (s.v && advNum(s.v.sani) !== null && advLevelOf('sani', s.v.sani) >= 1 && s.houses > 0); },
  era2: function (s) { return (s.era || 1) >= 2; }
};
function advRevealed(id, s, sticky) {
  var d = advItemDef(id);
  if (!d) return false;
  if (sticky && sticky[id]) return true;
  return !!ADV_REVEAL[d.reveal](s || {});
}

// 回傳已揭露且有值的長條:[{id,name,short,icon,val,level,mark,frac,gFrac,yFrac,unit,max}];sticky = {id:true} 讓已揭露者不再縮回
function advBars(s, sticky) {
  var out = [], i, d, val, lv, mk = ['●', '▲', '■'];
  for (i = 0; i < BAR_ITEMS.length; i++) {
    d = BAR_ITEMS[i];
    if (!advRevealed(d.id, s, sticky)) continue;
    val = advBarVal(d.id, s);
    if (val === null) continue;
    lv = advLevelOf(d.id, val, s);
    if (sticky) sticky[d.id] = true;
    out.push({
      id: d.id, name: d.name, short: d.short, icon: d.icon, val: val, level: lv, mark: mk[lv],
      word: lv === 0 ? '正常' : (lv === 1 ? '警示' : '危急'),
      frac: advClamp(val / d.max, 0, 1), gFrac: advClamp(d.g / d.max, 0, 1), yFrac: advClamp(d.y / d.max, 0, 1), unit: d.unit, max: d.max
    });
  }
  return out;
}

// ───────── 條件(回 false 或參數物件;L = 各 stat 等級、R = 各 stat 是否已揭露)─────────
function advArea(s) { return (s.worst && s.worst.name) ? s.worst.name : '城中'; }
var ADV_COND = {
  always: function () { return {}; },
  startWelcome: function (s) { return (s.houses || 0) < 2 && (s.buildings || 0) < 6 ? {} : false; },
  startField: function (s) { return s.houses >= 2 && (s.fields || 0) === 0 ? {} : false; },
  wellFirst: function (s) { return s.houses >= 3 && !s.hasWell ? {} : false; },

  foodCrit: function (s, L, R) { return R.food && L.food === 2 ? { pct: Math.round(s.v.food) } : false; },
  foodWarn: function (s, L, R) { return R.food && L.food === 1 ? { pct: Math.round(s.v.food) } : false; },
  foodFar: function (s, L, R) { return R.food && s.cover && advNum(s.cover.food) !== null && s.cover.food < 0.7 && L.food < 2 ? { area: advArea(s) } : false; },
  foodWinter: function (s, L, R) { return R.food && s.season === 'winter' && s.v.food < 115 && s.houses >= 4 && L.food < 2 ? {} : false; },
  foodMillet: function (s) { return (s.fields || 0) >= 3 && s.techHas && s.techHas.e_tuntian && !s.hasMillet ? {} : false; },
  foodTech: function (s, L, R) { return R.food && L.food >= 1 && s.techAvail && s.techAvail.e_tuntian ? {} : false; },
  foodSurplus: function (s, L, R) { return R.food && s.v.food > 150 && !s.hasMarket && s.houses >= 6 ? {} : false; },

  waterCrit: function (s, L, R) { return R.water && L.water === 2 ? { area: advArea(s), pct: Math.round(s.v.water) } : false; },
  waterWarn: function (s, L, R) { return R.water && L.water === 1 ? { pct: Math.round(s.v.water) } : false; },
  waterTech: function (s) { return s.techAvail && s.techAvail.wa_jiegao && s.hasRiver && s.houses >= 8 ? {} : false; },

  saniCrit: function (s, L, R) { return R.sani && L.sani === 2 ? { v: Math.round(s.v.sani) } : false; },
  saniWarn: function (s, L, R) { return R.sani && L.sani === 1 ? { v: Math.round(s.v.sani) } : false; },
  saniDensity: function (s, L, R) { return s.houses >= 8 && !s.hasPrivy && L.sani === 0 ? { n: s.houses } : false; },
  plagueCrit: function (s, L, R) { return R.plague && L.plague === 2 ? {} : false; },
  plagueWarn: function (s, L, R) { return R.plague && L.plague === 1 && !s.hasHospital && !s.hasHerb ? {} : false; },

  moodCrit: function (s, L, R) { return R.mood && L.mood === 2 ? { v: Math.round(s.v.mood) } : false; },
  moodWarn: function (s, L, R) { return R.mood && L.mood === 1 ? { v: Math.round(s.v.mood) } : false; },
  moodFun: function (s, L, R) { return R.mood && s.houses >= 10 && L.mood === 0 && !s.hasFun ? {} : false; },

  orderCrit: function (s, L, R) { return R.order && L.order === 2 ? { v: Math.round(s.v.order) } : false; },
  orderWarn: function (s, L, R) { return R.order && L.order === 1 ? { v: Math.round(s.v.order) } : false; },
  orderPop: function (s, L, R) { return (s.pop || 0) >= 60 && !s.hasWatch && L.order === 0 ? { n: Math.round(s.pop) } : false; },

  houseFull: function (s, L, R) { return R.house && L.house === 2 ? {} : false; },
  houseTight: function (s, L, R) { return R.house && L.house === 1 && s.occ >= 92 ? { pct: Math.round(s.occ) } : false; },
  houseEmpty: function (s, L, R) { return R.house && L.house === 1 && s.occ < 60 && s.houses >= 6 ? { pct: Math.round(s.occ) } : false; },

  storeBlocked: function (s, L, R) { return R.store && s.store && s.store.blocked > 0 ? { n: s.store.blocked, miss: s.store.missName || '原料' } : false; },
  storeNoRoad: function (s, L, R) { return s.store && s.store.noroad > 0 ? { n: s.store.noroad } : false; },
  storeLoom: function (s) { return s.store && s.store.needLoom ? {} : false; },
  storeFull: function (s, L, R) { return R.store && s.store && s.store.full > 0 ? { n: s.store.full } : false; },
  storeFirst: function (s) { return (s.workshops || 0) === 0 && s.houses >= 6 ? {} : false; },

  roadWarn: function (s, L, R) { return R.road && L.road >= 1 ? { pct: Math.round(s.road) } : false; },
  roadStone: function (s, L, R) { return R.road && s.houses >= 12 && !s.hasStoneRoad && L.road === 0 ? {} : false; },

  labNone: function (s) { return !s.lab && s.houses >= 6 ? {} : false; },
  techIdle: function (s) { return s.lab && s.tech && s.tech.state === 'idle' ? {} : false; },
  techAfford: function (s) { return s.lab && s.tech && s.tech.state === 'ok' && !s.tech.busy ? {} : false; },
  techGap: function (s) { return s.lab && s.tech && s.tech.state === 'gap' ? {} : false; },

  marketFirst: function (s) { return s.houses >= 8 && !s.hasMarket ? {} : false; },
  decoFew: function (s) { return s.houses >= 10 && (s.deco || 0) < 3 ? {} : false; },
  fameFirst: function (s, L, R) { return R.fame && !s.hasPaifang ? {} : false; },
  eduFirst: function (s, L, R) { return R.edu && !s.hasBook ? {} : false; }
};

function advFill(text, p, id, xun) {
  var t = text, k;
  if (Array.isArray(t)) t = t[advHash(id + ':' + Math.floor((xun || 0) / 6)) % t.length];
  for (k in p) t = t.split('{' + k + '}').join(String(p[k]));
  return t;
}

// ───────── 記憶(存檔只含 id)─────────
function advMemNew() { return { done: {}, ignore: {}, cd: {}, seenHelp: {}, dirty: false }; }
function advNormSave(v) {
  var o = { done: [], ignore: [], seenHelp: [] }, k, i, src;
  if (!v || typeof v !== 'object') return o;
  for (k in o) {
    src = v[k];
    if (!Array.isArray(src)) continue;
    for (i = 0; i < src.length && o[k].length < 200; i++) if (typeof src[i] === 'string' && src[i].length <= 40 && o[k].indexOf(src[i]) < 0) o[k].push(src[i]);
  }
  return o;
}
function advMemLoad(v) {
  var m = advMemNew(), n = advNormSave(v);
  n.done.forEach(function (id) { m.done[id] = true; });
  n.ignore.forEach(function (id) { m.ignore[id] = true; });
  n.seenHelp.forEach(function (id) { m.seenHelp[id] = true; });
  return m;
}
function advMemSave(m) {
  return { done: Object.keys(m.done).sort(), ignore: Object.keys(m.ignore).sort(), seenHelp: Object.keys(m.seenHelp).sort() };
}
function advAdviceDef(id) { var i; for (i = 0; i < ADVICE.length; i++) if (ADVICE[i].id === id) return ADVICE[i]; return null; }
// 「知道了」:黃藍 cd ×3 旬;紅不冷卻
function advAck(m, id, xun) {
  var a = advAdviceDef(id);
  if (!a || a.tier === 'R' || a.core) return;
  m.cd[id] = (xun || 0) + (a.cd || 3) * 3;
}
// 「別再提」:藍永久(存檔)、黃本次冷卻 24 旬、紅不提供
function advIgnore(m, id, xun) {
  var a = advAdviceDef(id);
  if (!a || a.tier === 'R' || a.core) return;
  if (a.tier === 'B') { m.ignore[id] = true; m.dirty = true; } else m.cd[id] = (xun || 0) + 24;
}
function advDone(m, id) { if (!m.done[id]) { m.done[id] = true; m.dirty = true; } }
function advSeenHelp(m, stat) { if (!m.seenHelp[stat]) { m.seenHelp[stat] = true; m.dirty = true; } }

// ───────── 核心:advCompute(純函式)─────────
// 回傳 { bars, L, R, items(合併後排序), main, expand(≤5), alerts(紅黃,每 stat 一條), counts{R,Y,B}, worstTier }
function advCompute(s, mem, xun, sticky) {
  var m = mem || advMemNew(), bars = advBars(s, sticky), L = {}, R = {}, i, a, p, items = [], byStat = {}, kept = [], rm = {}, c, j, x, y;
  for (i = 0; i < BAR_ITEMS.length; i++) {
    x = BAR_ITEMS[i].id;
    R[x] = advRevealed(x, s, sticky);
    y = advBarVal(x, s);
    L[x] = y === null ? 0 : advLevelOf(x, y, s);
  }
  for (i = 0; i < ADVICE.length; i++) {
    a = ADVICE[i];
    if (!a.core) {
      if (a.once && m.done[a.id]) continue;
      if (m.done[a.id] && a.tier === 'B' && a.once) continue;
      if (m.ignore[a.id]) continue;
      if (a.tier !== 'R' && m.cd[a.id] > (xun || 0)) continue;
    }
    p = ADV_COND[a.cond](s, L, R);
    if (!p) continue;
    items.push({ id: a.id, tier: a.tier, pri: a.pri, stat: a.stat, go: a.go, core: !!a.core, text: advFill(a.text, p, a.id, xun), params: p });
  }
  // 壓制矛盾:成對同時出現時移除 pri 較低者
  for (i = 0; i < ADV_CONFLICT.length; i++) {
    x = null; y = null;
    for (j = 0; j < items.length; j++) { if (items[j].id === ADV_CONFLICT[i][0]) x = items[j]; if (items[j].id === ADV_CONFLICT[i][1]) y = items[j]; }
    if (x && y) rm[(x.pri < y.pri || (x.pri === y.pri && x.id > y.id)) ? x.id : y.id] = true;
  }
  items = items.filter(function (it) { return !rm[it.id]; });
  items.sort(advCmp);
  // 同 stat 合併:只留最高者,其餘掛在 merged
  for (i = 0; i < items.length; i++) {
    c = byStat[items[i].stat];
    if (c) { c.merged.push(items[i].id); continue; }
    items[i].merged = [];
    byStat[items[i].stat] = items[i];
    kept.push(items[i]);
  }
  // 有紅 / 黃時,保底句不出現
  if (kept.length > 1) kept = kept.filter(function (it) { return !it.core; });
  return {
    bars: bars, L: L, R: R, items: kept, main: kept[0] || null,
    expand: kept.slice(0, ADV_MAX_EXPAND),
    alerts: kept.filter(function (it) { return it.tier !== 'B'; }),
    counts: { R: kept.filter(function (it) { return it.tier === 'R'; }).length, Y: kept.filter(function (it) { return it.tier === 'Y'; }).length, B: kept.filter(function (it) { return it.tier === 'B'; }).length },
    worstTier: kept.length ? kept[0].tier : 'B'
  };
}
function advCmp(a, b) {
  if (ADV_TIER[a.tier] !== ADV_TIER[b.tier]) return ADV_TIER[a.tier] - ADV_TIER[b.tier];
  if (a.pri !== b.pri) return b.pri - a.pri;
  return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
}

// ───────── 幾何(純函式,供 UI 與測試)─────────
function advCentralRect(vw, vh) { return { x: vw * ADV_CENTER.x0, y: vh * ADV_CENTER.y0, w: vw * (ADV_CENTER.x1 - ADV_CENTER.x0), h: vh * (ADV_CENTER.y1 - ADV_CENTER.y0) }; }
function advRectsOverlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
// 浮卡 / 氣泡 / 停靠面板的區域:直版 = 底部帶(y ≥ 80%)、橫版 = 右側欄(x ≥ 75%);不進正中央
function advCardRect(vw, vh, size) {
  var w = size && size.w || 300, h = size && size.h || 140, r;
  if (vw >= vh) {          // 橫版:右側欄
    w = Math.min(w, vw * 0.25 - 8); h = Math.min(h, vh * 0.6);
    r = { x: vw * ADV_CENTER.x1 + 4, y: Math.max(8, vh * 0.2), w: w, h: h };
  } else {                 // 直版:底帶
    w = Math.min(w, vw - 16); h = Math.min(h, vh * (1 - ADV_CENTER.y1) - 4);
    r = { x: Math.round((vw - w) / 2), y: Math.round(vh * ADV_CENTER.y1 + 2), w: w, h: h };
  }
  return r;
}
function advDockRect(vw, vh) {
  if (vw >= vh) return { x: vw * ADV_CENTER.x1, y: 0, w: vw * (1 - ADV_CENTER.x1), h: vh };
  return { x: 0, y: vh * ADV_CENTER.y1 - vh * 0.02, w: vw, h: vh * (1 - ADV_CENTER.y1) + vh * 0.02 };
}

// ───────── 快照(讀既有引擎;缺哪個就用保守預設)─────────
var advRt = { mem: null, bound: null, last: -1e15, cache: null, clock: function () { return Date.now(); }, playSec: 0, sticky: {}, idleSec: 0, lastTickAt: null, saniWarned: false };
function advSetClock(fn) { advRt.clock = fn || function () { return Date.now(); }; }
function advReset() { advRt.mem = null; advRt.bound = null; advRt.last = -1e15; advRt.cache = null; advRt.playSec = 0; advRt.sticky = {}; advRt.idleSec = 0; advRt.lastTickAt = null; advRt.saniWarned = false; }
function advXun() { return Math.floor(advRt.playSec / ADV_XUN_SEC); }

function advWorstFang(key) {
  var w, n, bx, by, v, best = null, nb, cx, cy, dx, dy;
  if (typeof cityFxFang !== 'function' || typeof boardW !== 'function') return null;
  w = boardW(); nb = Math.ceil(w / 12);
  for (by = 0; by < nb; by++) for (bx = 0; bx < nb; bx++) {
    v = cityFxFang(key, bx, by);
    if (v === null || v === undefined) continue;
    if (!best || v < best.v) best = { v: v, bx: bx, by: by };
  }
  if (!best) return null;
  cx = Math.min(w - 1, best.bx * 12 + 6); cy = Math.min(w - 1, best.by * 12 + 6);
  dx = cx < w / 3 ? '西' : (cx > w * 2 / 3 ? '東' : ''); dy = cy < w / 3 ? '北' : (cy > w * 2 / 3 ? '南' : '');
  return { x: cx, y: cy, name: (dy + dx) ? (dy + dx + '邊那一坊') : '城中那一坊' };
}

function advWorstKey(s) {
  var wk = 'food', wl = -1;
  ['food', 'water', 'sani', 'mood', 'order'].forEach(function (k) { var l = advLevelOf(k, s.v[k]); if (l > wl) { wl = l; wk = k; } });
  return wk;
}

function advSnapshot() {
  var s = { xun: advXun(), minutes: advRt.playSec / 60, v: {}, houses: 0, pop: 0, occ: null, refugees: false, fields: 0, buildings: 0, deco: 0, workshops: 0, era: 1 };
  var objs = [], i, o, t, keys = ['food', 'water', 'sani', 'order', 'mood'], hs = (typeof CITYFX_HOUSES !== 'undefined') ? CITYFX_HOUSES : { house: 1 };
  var wsList, cs, base, safety;
  if (typeof estateObjects === 'function') { try { objs = estateObjects() || []; } catch (e) { objs = []; } }
  else if (typeof world !== 'undefined' && world && world.objects) objs = world.objects;
  for (i = 0; i < objs.length; i++) {
    o = objs[i]; t = o.type; s.buildings++;
    if (typeof fxAsList === 'function' && !hs[t] && fxAsList(t).length) { if (fxAsList(t).indexOf('paifang') >= 0) s.hasPaifang = true; t = fxLike(t) || t; }   // 魔幻件視同漢式功能件(市集 / 水井 / 牌坊…)
    if (hs[t]) s.houses++;
    else if (t === 'field_sprout' || t === 'field_millet' || t === 'field_wheat' || t === 'vegetable_plot') { s.fields++; if (t === 'field_millet') s.hasMillet = true; }
    else if (t === 'well' || t === 'well_sweep' || t === 'waterwheel') s.hasWell = true;
    else if (t === 'privy') s.hasPrivy = true;
    else if (t === 'market') s.hasMarket = true;
    else if (t === 'hospital') s.hasHospital = true;
    else if (t === 'herb_garden' || t === 'shop_herb') s.hasHerb = true;
    else if (t === 'storyteller' || t === 'shop_tea' || t === 'she_altar' || t === 'shop_wine' || t === 'perform_ring') s.hasFun = true;
    else if (t === 'deco_watchtower' || t === 'drum_tower' || t === 'gate' || t === 'notice_board') s.hasWatch = true;
    else if (t === 'road_stone') s.hasStoneRoad = true;
    else if (t === 'paifang') s.hasPaifang = true;
    else if (t === 'shop_book' || t === 'research') s.hasBook = true;
    else if (t === 'lumber' || t === 'quarry') s.workshops++;
    if (typeof OBJECTS !== 'undefined' && OBJECTS[t] && OBJECTS[t].deco) s.deco++;
  }
  if (typeof cityFxCity === 'function') keys.forEach(function (k) { var v = cityFxCity(k); s.v[k] = advNum(v) === null ? 0 : v; });
  if (typeof cityscoreGet === 'function') { try { cs = cityscoreGet(false); if (cs && advNum(cs.pop) !== null) s.pop = cs.pop; } catch (e2) { /* 略過 */ } }
  if (!s.pop) s.pop = s.houses * ((typeof CITYFX_POP_PER_HOUSE !== 'undefined') ? CITYFX_POP_PER_HOUSE : 4);
  if (s.houses > 0) {
    base = s.houses * ((typeof CITYFX_POP_PER_HOUSE !== 'undefined') ? CITYFX_POP_PER_HOUSE : 4);
    s.occ = advClamp(s.pop / base * 100, 0, 150);
  }
  // 疫病安全度:100 − 風險;風險由衛生不足推高(有醫館 / 藥圃折減)
  if (advNum(s.v.sani) !== null && s.houses > 0) {
    safety = advClamp(s.v.sani + (s.hasHospital ? 15 : 0) + (s.hasHerb ? 8 : 0), 0, 100);
    s.plague = safety;
  }
  if (typeof goodsWorkshopList === 'function') {
    try {
      wsList = goodsWorkshopList(); s.store = { blocked: 0, full: 0, short: 0 };
      wsList.forEach(function (w) { if (w.kind === 'rec') s.workshops++; if (w.state === 'blocked') s.store.blocked++; else if (w.state === 'full') s.store.full++; else if (w.state === 'short') s.store.short++; });
      if (typeof goodsVisibleList === 'function') goodsVisibleList().forEach(function (g) { if (g.cap > 0 && g.have / g.cap >= 0.95) s.store.full++; });
      s.store.noroad = 0; s.store.missName = ''; s.store.needLoom = false;   // O4:未通路工坊數 / 缺的料 / 有麻田沒織坊
      if (typeof goodsProdRows === 'function') {
        goodsProdRows().forEach(function (w) { if (w.kind === 'rec' && !w.conn) s.store.noroad++; if (!s.store.missName && w.state === 'blocked' && w.missName) s.store.missName = w.missName; });
        s.store.needLoom = !!(typeof goodsBuiltTypes === 'function' && goodsBuiltTypes().field_hemp && !goodsBuiltTypes().loom_shop);
      }
      s.store.health = advClamp(100 - s.store.blocked * 35 - s.store.full * 25 - s.store.short * 10, 0, 100);
      if (!wsList.length && s.store.full === 0) s.store.health = 100;
    } catch (e3) { s.store = null; }
  }
  s.worst = advWorstFang(advWorstKey(s));
  advSnapTech(s);
  if (typeof currentSeason === 'string') s.season = currentSeason;
  if (typeof nlEra === 'function') { try { s.era = nlEra() || 1; } catch (e4) { /* 略過 */ } }
  s.saniEverWarn = advRt.saniWarned || (s.houses > 0 && advLevelOf('sani', s.v.sani) >= 1);
  if (s.saniEverWarn) advRt.saniWarned = true;
  return s;
}

function advSnapTech(s) {
  var ids, avail = [], afford = false, busy = false, tech = { state: 'none' }, mine = ['e_tuntian', 'wa_jiegao'], done = 0;
  s.techAvail = {}; s.techHas = {};
  if (typeof techState === 'function' && typeof techLabCount === 'function' && typeof CITY_TECHS !== 'undefined') {   // NL2:改讀新科技執行層(citytech.js)
    var ts = techState();
    s.lab = techLabCount() > 0;
    mine.forEach(function (id) { var n = techNode(id); if (n) { s.techHas[id] = techDone(id); if (!techDone(id) && techReqMet(n) && techEraOpen(n.era)) s.techAvail[id] = true; } });
    done = ts ? Object.keys(ts.done).length : 0;
    s.techOpened = s.lab || done > 0;
    if (!s.lab) { s.tech = tech; return; }
    busy = !!(ts.cur.length || ts.queue.length);
    CITY_TECHS.forEach(function (n) { if (ts.done[n.id] || techIsMega(n) || techIsStyle(n)) return; if (techReqMet(n) && techEraOpen(n.era)) { ids = ids || []; ids.push(n.id); if (techAffordable(n.id)) afford = true; } });
    if (busy) tech = { state: 'ok', busy: true };
    else if (afford) tech = { state: advRt.idleSec >= 4 * ADV_XUN_SEC ? 'idle' : 'ok' };
    else tech = { state: ids && ids.length ? 'gap' : 'none' };
    s.tech = tech;
    return;
  }
  if (typeof labBuilt !== 'function' || typeof TECHS === 'undefined') { s.tech = tech; return; }
  s.lab = !!labBuilt();
  if (typeof techHas === 'function') {
    mine.forEach(function (id) { if (TECHS[id]) { s.techHas[id] = !!techHas(id); if (!techHas(id) && typeof techAvailable === 'function' && techAvailable(id)) s.techAvail[id] = true; } });
    done = (typeof world !== 'undefined' && world && world.tech && world.tech.done) ? world.tech.done.length : 0;
  }
  s.techOpened = s.lab || done > 0;
  if (!s.lab) { s.tech = tech; return; }
  busy = !!(world.tech && world.tech.cur);
  ids = Object.keys(TECHS).filter(function (id) { return typeof techHas === 'function' && !techHas(id) && techAvailable(id); });
  ids.forEach(function (id) { if (typeof canResearch === 'function' && canResearch(id) === '') afford = true; });
  if (busy) tech = { state: 'ok', busy: true };
  else if (afford) tech = { state: advRt.idleSec >= 4 * ADV_XUN_SEC ? 'idle' : 'ok' };
  else tech = { state: ids.length ? 'gap' : 'none' };
  s.tech = tech;
}

// ───────── 節流與存檔綁定 ─────────
function advBind() {
  var c = (typeof world !== 'undefined' && world) ? world.city : null;
  if (!advRt.mem || advRt.bound !== c) {
    advRt.mem = advMemLoad(c && c.adv);
    advRt.bound = c;
  }
  return advRt.mem;
}
function advFlush() {
  var c = (typeof world !== 'undefined' && world) ? world.city : null;
  if (!advRt.mem || !advRt.mem.dirty) return;
  if (!c && typeof goodsCity === 'function') c = goodsCity();
  if (c) { c.adv = advMemSave(advRt.mem); advRt.mem.dirty = false; advRt.bound = c; }
}
// 外部每秒呼叫(dtSec = 遊玩秒數);1.5 秒節流重算,背景頁暫停
function advTick(dtSec) {
  var now = advRt.clock();
  if (typeof document !== 'undefined' && document && document.hidden) return advRt.cache;
  if (dtSec > 0) { advRt.playSec += dtSec; if (advRt.cache && advRt.cache.snap && advRt.cache.snap.tech && advRt.cache.snap.lab && advRt.cache.snap.tech.state !== 'gap' && advRt.cache.snap.tech.state !== 'none' && !advRt.cache.snap.tech.busy) advRt.idleSec += dtSec; else advRt.idleSec = 0; }
  if (advRt.cache && now - advRt.last < ADV_THROTTLE_MS) return advRt.cache;
  return advGet(true);
}
function advGet(force) {
  var now = advRt.clock(), snap, mem;
  if (!force && advRt.cache && now - advRt.last < ADV_THROTTLE_MS) return advRt.cache;
  mem = advBind();
  snap = advSnapshot();
  advRt.cache = advCompute(snap, mem, snap.xun, advRt.sticky);
  advRt.cache.snap = snap;
  advRt.last = now;
  advFlush();
  return advRt.cache;
}

// ───────── 一鍵前往 ─────────
// 回傳計畫物件(純資料,測試用):{ kind, cell:{x,y}|null, tool, panel, tech, stat }
function advGoPlan(go, s) {
  var p = { kind: go ? go.kind : '', cell: null, tool: null, panel: null, tech: null, stat: null }, w = null, bw = 0;
  if (!go) return p;
  if (typeof boardW === 'function') bw = boardW();
  if (go.kind === 'camera' || (go.kind === 'build' && go.near === 'worst')) {
    if (go.target === 'center' || !(s && s.worst)) { if (bw) p.cell = { x: Math.floor(bw / 2), y: Math.floor(bw / 2) }; }
    else p.cell = { x: s.worst.x, y: s.worst.y };
  }
  if (go.kind === 'build') p.tool = (typeof fxGoType === 'function') ? fxGoType(go.type) : go.type;   // 魔幻世界:被隱藏的漢式物件換成看得到的魔幻件
  if (go.kind === 'panel') p.panel = go.id;
  if (go.kind === 'tech') p.tech = go.id;
  if (go.kind === 'help') p.stat = go.stat;
  return p;
}
function advGo(item) {
  var snap = advRt.cache && advRt.cache.snap, p, t;
  if (!item) return false;
  p = advGoPlan(item.go, snap);
  if (p.cell && typeof centerOnCell === 'function') {
    centerOnCell(p.cell.x, p.cell.y);
    if (typeof clampView === 'function') clampView();
    if (typeof panelNoteIntentMove === 'function') panelNoteIntentMove();
  }
  if (p.tool && typeof OBJECTS !== 'undefined' && OBJECTS[p.tool] && typeof setTool === 'function') setTool(p.tool);
  if (p.panel) {
    if (p.panel === 'adv') { /* 由 UI 處理 */ }
    else if (typeof uiSideAct === 'function') uiSideAct(p.panel);
  }
  if (p.tech) {
    if (typeof techPanelOpen === 'function') techPanelOpen(p.tech);
    else if (typeof document !== 'undefined' && document.getElementById) { t = document.getElementById('btnTech'); if (t && t.click) t.click(); }
  }
  if (p.stat && typeof advUiHelp === 'function') advUiHelp(p.stat);
  return true;
}
