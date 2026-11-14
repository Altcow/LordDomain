// js/res4.js — 木鐵石糧的統一讀寫(補兵・名聲・鍛造材料 設計 0.3)。四資源放在主存檔 world.res(wood / iron / stone / grain),不改 RESOURCES 常數。
// 所有模組(校場征兵花糧、地圖一鍵收成)只經本檔讀寫;寫入後呼叫既有的 saveWorld()(map.js)。world 不存在(node 測試 / 尚未建世界)時 → 讀回 0、寫入失敗(false)。
// 之後有倉庫上限就在 res4Add 夾。全域:RES4_KEYS res4Get res4Has res4Spend res4Add res4All。ES2017;不用 ?. ??。

var RES4_KEYS = ['wood', 'iron', 'stone', 'grain'];

function res4World() { return (typeof world !== 'undefined' && world && world.res && typeof world.res === 'object') ? world.res : null; }
function res4Save() { if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } } }
function res4Num(x) { x = Number(x); return (isFinite(x) && x > 0) ? Math.floor(x) : 0; }
function res4KeyOk(k) { return RES4_KEYS.indexOf(k) >= 0 || k === 'coin'; }
// 數量(取整數;未知鍵 → 0)
function res4Get(k) {
  var r = res4World();
  if (!r || !res4KeyOk(k)) return 0;
  return Math.max(0, Math.floor(Number(r[k]) || 0));
}
function res4All() {
  var o = {};
  RES4_KEYS.forEach(function (k) { o[k] = res4Get(k); });
  return o;
}
// cost = {grain: 3000}:全部夠才回 true;未知鍵 → false
function res4Has(cost) {
  var k, ok = true;
  if (!cost || typeof cost !== 'object') return true;
  for (k in cost) {
    if (!Object.prototype.hasOwnProperty.call(cost, k)) continue;
    if (!res4KeyOk(k)) return false;
    if (res4Get(k) < res4Num(cost[k])) ok = false;
  }
  return ok;
}
// 不夠就整筆不扣,回 false
function res4Spend(cost) {
  var r = res4World(), k, any = false;
  if (!r) return false;
  if (!res4Has(cost)) return false;
  for (k in cost) {
    if (!Object.prototype.hasOwnProperty.call(cost, k)) continue;
    if (res4Num(cost[k]) > 0) { r[k] = (Number(r[k]) || 0) - res4Num(cost[k]); any = true; }
  }
  if (any) res4Save();
  return true;
}
// 加入;回實際加入量物件 {k: n}(未知鍵 / 非正數略過)
function res4Add(gain) {
  var r = res4World(), k, n, out = {}, any = false;
  if (!r || !gain || typeof gain !== 'object') return out;
  for (k in gain) {
    if (!Object.prototype.hasOwnProperty.call(gain, k) || !res4KeyOk(k)) continue;
    n = res4Num(gain[k]);
    if (n <= 0) continue;
    r[k] = (Number(r[k]) || 0) + n;
    out[k] = n; any = true;
  }
  if (any) res4Save();
  return out;
}
