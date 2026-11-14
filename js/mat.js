// js/mat.js — 鍛造材料(補兵・名聲・鍛造材料 設計 第 3 節;純邏輯,無 DOM)。第一季 11 種(鐵 4、皮 4、木炭、礪石、精魄),id 前綴 m_,和 GOODS 的 g_ / mat_ 分開、不走城市庫房。數值全部 PLACEHOLDER。
// 存檔:localStorage 'lorddomain.mat.v1' = {v:1, n:{材料 id:數量 0..99999}, seen:{id:1 已查看}}(SAVE_SLOT_KEYS);未知 id 讀入時保留不刪(仿 items.js)。壞檔 → 空庫存,不丟例外。
// 掉落函式只用傳入的 rng(() => [0,1)),不呼叫 Math.random(地圖要可重現、戰報可重播)。
// 全域:MATS MAT_DROP MAT_RECIPE MAT_MAX matDef matCount matAll matForgeDrop matBonusDrop matCampDrop matTowerDrop matSplit matGrant matHas matSpend matName matIcon matQ matHasNew matMarkSeen matNorm。ES2017;不用 ?. ??。

var MAT_KEY = 'lorddomain.mat.v1';
var MAT_MAX = 99999;
// q:0 白 / 1 藍 / 2 紫 / 3 金;use:weapon 武器 / armor 防具 / any 共用
var MATS = {
  m_iron1: { id: 'm_iron1', name: '生鐵', q: 0, icon: '🔩', use: 'weapon', desc: '武器主材(白);藍武器副材' },
  m_iron2: { id: 'm_iron2', name: '精鐵', q: 1, icon: '⚙️', use: 'weapon', desc: '武器主材(藍);紫武器副材' },
  m_iron3: { id: 'm_iron3', name: '百鍊鋼', q: 2, icon: '🔗', use: 'weapon', desc: '武器主材(紫);金武器副材' },
  m_iron4: { id: 'm_iron4', name: '玄鐵', q: 3, icon: '⬛', use: 'weapon', desc: '武器主材(金)' },
  m_hide1: { id: 'm_hide1', name: '獸皮', q: 0, icon: '🟫', use: 'armor', desc: '防具主材(白);藍防具副材' },
  m_hide2: { id: 'm_hide2', name: '犀皮', q: 1, icon: '🧶', use: 'armor', desc: '防具主材(藍);紫防具副材' },
  m_hide3: { id: 'm_hide3', name: '虎皮', q: 2, icon: '🐯', use: 'armor', desc: '防具主材(紫);金防具副材' },
  m_hide4: { id: 'm_hide4', name: '玄龜甲', q: 3, icon: '🐢', use: 'armor', desc: '防具主材(金)' },
  m_coal: { id: 'm_coal', name: '木炭', q: 0, icon: '⚫', use: 'any', desc: '每次鍛造都要(燃料),量依品質' },
  m_whet: { id: 'm_whet', name: '礪石', q: 1, icon: '🪨', use: 'any', desc: '強化用(武器、防具共用)' },
  m_soul: { id: 'm_soul', name: '精魄', q: 3, icon: '✨', use: 'any', desc: '選用:金裝鍛造時投入 1 個,特性機率提高' }
};
var MAT_ORDER = Object.keys(MATS);

// 野怪掉落表 MAT_DROP.beast[等級 1~6]:{id, a, b} = 均勻整數 a~b;{id, p} = 機率 p% 得 1 個
var MAT_DROP = {
  beast: [null,
    [{ id: 'm_iron1', a: 4, b: 6 }, { id: 'm_hide1', a: 4, b: 6 }, { id: 'm_coal', a: 4, b: 6 }, { id: 'm_whet', p: 30 }],
    [{ id: 'm_iron1', a: 6, b: 8 }, { id: 'm_hide1', a: 6, b: 8 }, { id: 'm_coal', a: 6, b: 8 }, { id: 'm_iron2', a: 1, b: 2 }, { id: 'm_hide2', a: 1, b: 2 }, { id: 'm_whet', a: 1, b: 1 }],
    [{ id: 'm_iron1', a: 4, b: 4 }, { id: 'm_hide1', a: 4, b: 4 }, { id: 'm_coal', a: 8, b: 8 }, { id: 'm_iron2', a: 3, b: 4 }, { id: 'm_hide2', a: 3, b: 4 }, { id: 'm_whet', a: 2, b: 2 }],
    [{ id: 'm_coal', a: 10, b: 10 }, { id: 'm_iron2', a: 5, b: 5 }, { id: 'm_hide2', a: 5, b: 5 }, { id: 'm_whet', a: 3, b: 3 }, { id: 'm_iron3', a: 1, b: 2 }, { id: 'm_hide3', a: 1, b: 2 }],
    [{ id: 'm_coal', a: 12, b: 12 }, { id: 'm_iron2', a: 4, b: 4 }, { id: 'm_hide2', a: 4, b: 4 }, { id: 'm_whet', a: 4, b: 4 }, { id: 'm_iron3', a: 3, b: 3 }, { id: 'm_hide3', a: 3, b: 3 }, { id: 'm_iron4', p: 10 }, { id: 'm_hide4', p: 10 }, { id: 'm_soul', p: 5 }],
    [{ id: 'm_coal', a: 15, b: 15 }, { id: 'm_whet', a: 5, b: 5 }, { id: 'm_iron3', a: 5, b: 5 }, { id: 'm_hide3', a: 5, b: 5 }, { id: 'm_iron4', p: 50 }, { id: 'm_hide4', p: 50 }, { id: 'm_soul', p: 20 }]
  ]
};
// 鍛造配方(PLACEHOLDER,給鍛造規格參考):每品質 {weapon:{材料:數}, armor:{…}, common:{…}, coin: 文}
var MAT_RECIPE = [
  { q: 0, weapon: { m_iron1: 5 }, armor: { m_hide1: 5 }, common: { m_coal: 3 }, coin: 50 },
  { q: 1, weapon: { m_iron2: 5, m_iron1: 5 }, armor: { m_hide2: 5, m_hide1: 5 }, common: { m_coal: 5 }, coin: 150 },
  { q: 2, weapon: { m_iron3: 5, m_iron2: 5 }, armor: { m_hide3: 5, m_hide2: 5 }, common: { m_coal: 8 }, coin: 500 },
  { q: 3, weapon: { m_iron4: 5, m_iron3: 5 }, armor: { m_hide4: 5, m_hide3: 5 }, common: { m_coal: 12 }, coin: 1500, soulMax: 1 }
];
// 強化礪石需求 +1~+10;損毀退還 30%(礪石與主材都按 30% 向下取整)
var MAT_WHET = [0, 1, 2, 3, 5, 8, 12, 16, 20, 25, 30];
var MAT_REFUND = 0.3;

function matHas0(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function matDef(id) { return (typeof id === 'string' && matHas0(MATS, id)) ? MATS[id] : null; }
function matName(id) { var d = matDef(id); return d ? d.name : String(id); }
function matIcon(id) { var d = matDef(id); return d ? d.icon : '❔'; }
function matQ(id) { var d = matDef(id); return d ? d.q : 0; }

// ───────── 存檔 ─────────
function matNorm(v) {
  var o = { v: 1, n: {}, seen: {} }, k, x;
  if (!v || typeof v !== 'object') return o;
  if (v.n && typeof v.n === 'object') {
    for (k in v.n) {
      if (!matHas0(v.n, k) || k.length > 40) continue;
      x = Math.floor(Number(v.n[k]));
      if (isFinite(x) && x > 0) o.n[k] = Math.min(MAT_MAX, x);
    }
  }
  if (v.seen && typeof v.seen === 'object') {
    for (k in v.seen) if (matHas0(v.seen, k) && v.seen[k] && o.n[k]) o.seen[k] = 1;
  }
  return o;
}
function matRead() {
  var s = null;
  try { s = localStorage.getItem(MAT_KEY); } catch (e) { return matNorm(null); }
  if (!s) return matNorm(null);
  try { return matNorm(JSON.parse(s)); } catch (e2) { return matNorm(null); }
}
function matWrite(st) {
  try { localStorage.setItem(MAT_KEY, JSON.stringify(matNorm(st))); return true; } catch (e) { return false; }
}
function matCount(id) { return matRead().n[id] | 0; }
function matAll() { return matRead().n; }
// 背包紅點:有已知材料持有且未查看
function matHasNew() {
  var st = matRead();
  return Object.keys(st.n).some(function (k) { return matDef(k) && !st.seen[k]; });
}
function matMarkSeen() {
  var st = matRead();
  Object.keys(st.n).forEach(function (k) { st.seen[k] = 1; });
  matWrite(st);
}
function matHas(cost) {
  var st = matRead(), k;
  if (!cost || typeof cost !== 'object') return true;
  for (k in cost) if (matHas0(cost, k) && (st.n[k] | 0) < Math.floor(Number(cost[k]) || 0)) return false;
  return true;
}
// 不夠就整筆不扣,回 false
function matSpend(cost) {
  var st = matRead(), k, n;
  if (!matHas(cost)) return false;
  for (k in (cost || {})) {
    if (!matHas0(cost, k)) continue;
    n = Math.floor(Number(cost[k]) || 0);
    if (n <= 0) continue;
    st.n[k] = (st.n[k] | 0) - n;
    if (st.n[k] <= 0) { delete st.n[k]; delete st.seen[k]; }
  }
  matWrite(st);
  return true;
}
// 入庫:回實際加入量 {id: n}(未知 id / 非正數略過;單種上限 99,999);新加入的 id 清除 seen(紅點)
function matGrant(mats) {
  var st = matRead(), out = {}, k, n, cur, add;
  if (!mats || typeof mats !== 'object') return out;
  for (k in mats) {
    if (!matHas0(mats, k) || !matDef(k)) continue;
    n = Math.floor(Number(mats[k]) || 0);
    if (n <= 0) continue;
    cur = st.n[k] | 0;
    add = Math.min(n, MAT_MAX - cur);
    if (add <= 0) continue;
    st.n[k] = cur + add;
    delete st.seen[k];
    out[k] = add;
  }
  if (Object.keys(out).length) { matWrite(st); if (typeof ldOpenNote === 'function') ldOpenNote('mat', { t: Date.now() }); }   // 開場解鎖:第一次拿到鍛造材料
  return out;
}

// ───────── 掉落(只用傳入的 rng)─────────
function matLv(lv) { lv = Math.floor(Number(lv)); return isFinite(lv) ? Math.max(1, Math.min(6, lv)) : 1; }
function matRollTable(rng, rows) {
  var out = {};
  rows.forEach(function (r) {
    var n;
    if (r.p !== undefined) { if (rng() * 100 < r.p) out[r.id] = (out[r.id] || 0) + 1; }
    else { n = r.a + Math.floor(rng() * (r.b - r.a + 1)); if (n > 0) out[r.id] = (out[r.id] || 0) + n; }
  });
  return out;
}
// 野怪擊殺整包 → {matId: 數量};lv 夾 1..6
function matForgeDrop(rng, lv) { return matRollTable(rng, MAT_DROP.beast[matLv(lv)]); }
// 最後一刀額外 1 個:從該等級表「最高品質那一欄」隨機挑 1 種給 1 個(機率項目也必給)
function matBonusDrop(rng, lv) {
  var rows = MAT_DROP.beast[matLv(lv)], top = 0, pool = [], out = {};
  rows.forEach(function (r) { top = Math.max(top, matQ(r.id)); });
  rows.forEach(function (r) { if (matQ(r.id) === top) pool.push(r.id); });
  out[pool[Math.floor(rng() * pool.length)]] = 1;
  return out;
}
// 山寨:只給白、藍。lv1~2 = 野怪同級表 ×0.4(向下取整、至少 1 個生鐵或獸皮);lv3~6 = 野怪 lv2 表 ×(0.5 + 0.1 × lv)
function matCampDrop(rng, lv) {
  var L = matLv(lv), base = matRollTable(rng, MAT_DROP.beast[L <= 2 ? L : 2].filter(function (r) { return matQ(r.id) <= 1; })), mul = L <= 2 ? 0.4 : 0.5 + 0.1 * L, out = {};
  Object.keys(base).forEach(function (k) { var n = Math.floor(base[k] * mul + 1e-9); if (n > 0) out[k] = n; });
  if (!out.m_iron1 && !out.m_hide1) out[rng() < 0.5 ? 'm_iron1' : 'm_hide1'] = 1;
  return out;
}
// 高塔首通:1~30 層 白材 1 種 ×3;31~60 藍材 1 種 ×2 + 礪石 1;61~99 藍材 ×3 或紫材 ×1(各 50%);每 10 層守將:該段品質 ×3 倍 + 礪石 2;第 100 層:玄鐵 2 + 玄龜甲 2 + 精魄 1
function matTowerDrop(rng, floor) {
  var f = Math.floor(Number(floor)), out = {}, k, pick;
  f = isFinite(f) ? Math.max(1, Math.min(100, f)) : 1;
  function two(a, b) { return rng() < 0.5 ? a : b; }
  if (f >= 100) return { m_iron4: 2, m_hide4: 2, m_soul: 1 };
  if (f <= 30) out[two('m_iron1', 'm_hide1')] = 3;
  else if (f <= 60) { out[two('m_iron2', 'm_hide2')] = 2; out.m_whet = 1; }
  else if (rng() < 0.5) out[two('m_iron2', 'm_hide2')] = 3;
  else out[two('m_iron3', 'm_hide3')] = 1;
  if (f % 10 === 0) {   // 守將層
    for (k in out) if (k !== 'm_whet') out[k] *= 3;
    out.m_whet = 2;
  }
  return out;
}
// 按傷害比例分包:每種材料用最大餘數法分整數,總和 = 原包;權重 0 的隊拿 0(全部權重都 0 時平分)
function matSplitInt(total, w) {
  var sum = 0, out = [], rem = [], used = 0, i, left, pos = [];
  w.forEach(function (x) { sum += x; });
  if (sum <= 0) { w = w.map(function () { return 1; }); sum = w.length; }
  w.forEach(function (x, k) { var v = total * x / sum, f = Math.floor(v + 1e-9); out.push(f); rem.push({ k: k, r: x > 0 ? v - f : -1 }); used += f; if (x > 0) pos.push(k); });
  rem.sort(function (a, b) { return b.r - a.r || a.k - b.k; });
  left = total - used;
  for (i = 0; i < left; i++) out[rem[i % rem.length].k]++;
  return out;
}
function matSplit(mats, weights) {
  var w = (weights || []).map(function (x) { x = Number(x); return isFinite(x) && x > 0 ? x : 0; }), per = w.map(function () { return {}; });
  Object.keys(mats || {}).forEach(function (id) {
    var n = Math.floor(Number(mats[id]) || 0);
    if (n <= 0 || !w.length) return;
    matSplitInt(n, w).forEach(function (x, i) { if (x > 0) per[i][id] = x; });
  });
  return per;
}
