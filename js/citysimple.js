// js/citysimple.js — 簡化城市模式總旗標 CITY_SIMPLE(預設開):只保留「蓋建築 ↔ 科技」的關聯。
// 開啟時:民生長條(糧食 / 飲水 / 衛生 / 民心 / 疫病 / 治安)不顯示、不影響任何數值(路速不受衛生懲罰、人口與繁榮度不看服務覆蓋);
//   縣丞民生 / 災害建議關閉;科技樹換成 techtree_simple_data.js 的簡化版(約 34 節點,成本只有金 + 學識,另有「前置建築」);
//   教學與推薦下一步改成「蓋什麼 → 解鎖什麼」。關閉(CITY_SIMPLE = false 或測試先設 CITY_SIMPLE_FORCE = false)則各檔行為完全回到原版。
// 程式碼一律保留,各檔以 typeof citySimpleOn === 'function' && citySimpleOn() 守衛。
// 存檔相容:舊節點已研 → 併入的新節點視為已研;序列換成新節點;研發中的舊節點若被併入則全額退款並提示一次(techSimpleMigrate,world.city.tech.simple 記號)。
// 全域名稱:CITY_SIMPLE citySimpleOn techAliasOf techEraMax techNeedOf techNeedHave techNeedMiss techNeedType techNeedName techSimpleMigrate citySimpleRt
// ES2017;不用 ?. ??。必須在 techtree_data.js / nolevel_data.js / techtree_simple_data.js 之後、citytech.js 之前載入。

var CITY_SIMPLE = (typeof CITY_SIMPLE_FORCE !== 'undefined') ? !!CITY_SIMPLE_FORCE : true;
var citySimpleRt = { applied: false, cache: null, cacheKey: '', cacheAt: 0 };

function citySimpleOn() { return !!CITY_SIMPLE; }
function csTreeOn() { return !!CITY_SIMPLE && typeof TECH_SIMPLE !== 'undefined' && citySimpleRt.applied; }

// 科技樹換成簡化版(CITY_TECHS 為 const 陣列,原地替換內容;techNode 快取以長度判斷,會自動重建)
(function csApplyTree() {
  if (!CITY_SIMPLE || citySimpleRt.applied || typeof TECH_SIMPLE === 'undefined' || typeof CITY_TECHS === 'undefined') return;
  CITY_TECHS.length = 0;
  TECH_SIMPLE.nodes.forEach(function (n) { CITY_TECHS.push(JSON.parse(JSON.stringify(n))); });
  citySimpleRt.applied = true;
})();

// 舊節點 id → 新節點 id(未被併入或旗標關閉時原樣)
function techAliasOf(id) {
  if (!csTreeOn() || typeof id !== 'string') return id;
  return TECH_SIMPLE.alias[id] || id;
}
function techEraMax() { return csTreeOn() ? TECH_SIMPLE.eras : 5; }

// ───────── 前置建築 ─────────
// 節點的前置建築(漢式 id;魔幻世界用 needPack 差異表,顯示 / 建造時再經 fxGoType 換成本族建築)
function techNeedOf(id) {
  var n, p, d;
  if (!csTreeOn() || typeof techNode !== 'function') return [];
  n = techNode(id);
  if (!n) return [];
  p = (typeof fxPack === 'function') ? fxPack() : null;
  d = p && TECH_SIMPLE.needPack && TECH_SIMPLE.needPack[p] ? TECH_SIMPLE.needPack[p][n.id] : null;
  return (d || n.need || []).slice();
}
// 場上某建築(含魔幻同功能件)的數量;每秒或物件數變動才重算
function techNeedHave(b) {
  var objs = (typeof world !== 'undefined' && world && Array.isArray(world.objects)) ? world.objects : [], rt = citySimpleRt, now = Date.now(), key, c, i, o;
  key = objs.length + ':' + ((typeof fxPack === 'function' && fxPack()) || '');
  if (!rt.cache || rt.cacheKey !== key || rt.cacheObjs !== objs || now - rt.cacheAt > 1000) {
    c = {};
    for (i = 0; i < objs.length; i++) {
      o = objs[i];
      if (!o || !o.type) continue;
      c[o.type] = (c[o.type] || 0) + 1;
      if (typeof fxAsList === 'function') fxAsList(o.type).forEach(function (a) { if (a !== o.type) c[a] = (c[a] || 0) + 1; });
    }
    rt.cache = c; rt.cacheKey = key; rt.cacheObjs = objs; rt.cacheAt = now;
  }
  return rt.cache[b] || 0;
}
function techNeedMiss(id) { return techNeedOf(id).filter(function (b) { return techNeedHave(b) < 1; }); }
function techNeedType(b) { return (typeof fxGoType === 'function') ? fxGoType(b) : b; }
function techNeedName(b) {
  var t = techNeedType(b);
  if (typeof OBJECTS !== 'undefined' && OBJECTS[t] && OBJECTS[t].name) return OBJECTS[t].name;
  if (typeof NL_UNLOCK_NAMES !== 'undefined' && NL_UNLOCK_NAMES[t]) return NL_UNLOCK_NAMES[t];
  return t;
}

// ───────── 存檔遷移(只做一次,s.simple = 1)─────────
// 回傳 null(不需)或 { refund:[舊 id] };退款走 techRefund(全額)
function techSimpleMigrate(s) {
  var A, q = [], keep = [], out = { refund: [] }, names;
  if (!csTreeOn() || !s || s.simple >= 2) return null;   // 版本 1 = 34 節點版(漕運 / 東觀校書 / 渾天儀仍是獨立節點),版本 2 = 31 節點版:再跑一次把被併入者的進度併進去
  s.simple = 2;
  A = TECH_SIMPLE.alias;
  Object.keys(s.done).forEach(function (k) { if (A[k]) s.done[A[k]] = 1; });
  Object.keys(s.big || {}).forEach(function (k) { if (A[k]) s.done[A[k]] = 1; });
  (s.cur || []).forEach(function (c) {
    if (!A[c.id] && typeof techNode === 'function' && techNode(c.id) && !s.done[c.id]) { keep.push(c); return; }
    if (typeof techRefund === 'function' && typeof world !== 'undefined' && world && world.res) techRefund(c.paid);
    out.refund.push(c.id);
  });
  s.cur = keep;
  (s.queue || []).forEach(function (id) {
    var n = A[id] || id;
    if (s.done[n] || q.indexOf(n) >= 0 || keep.some(function (c) { return c.id === n; })) return;
    if (typeof techNode === 'function' && !techNode(n)) return;
    q.push(n);
  });
  s.queue = q;
  if (out.refund.length && typeof showToast === 'function') {
    names = out.refund.map(function (id) { var n = A[id] && typeof techNode === 'function' ? techNode(A[id]) : null; return n ? n.name : id; });
    showToast('科技樹已簡化:研發中的項目已併入〈' + names.join('、') + '〉,費用全額退還。');
  }
  return out;
}
