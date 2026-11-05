// js/fxpack.js — 魔幻三族「內容覆寫」查詢層(PLAN_FANTASY_B §1.2;資料見 fx_tech_data.js,由 tools/gen_fx_tech.js 產生)
// fxPack():魔幻世界回 'elf' / 'dwarf' / 'kingdom',歷史世界(漢與歷史風格)一律回 null。
// 所有查詢函式在 fxPack() 為 null 時回「無覆寫」(null / false / undefined / 原值),東漢世界完全不讀 FX_TECH_DATA,行為與資料零變動。
// 全域名稱:fxPack fxPackIs fxTechName fxTechDesc fxTechLabel fxEraName fxBranchName fxRouteName fxRouteTitle fxUnlockName fxTechUnlock
//          fxObjName fxHiddenObj fxObjTech fxLike fxAsList fxGoType fxInstallObjNames fxPackIds
// 對外守則:其他檔一律 typeof fxPack === 'function' 守衛後使用。ES2017;不用 ?. ??。

var FX_PACK_IDS = ['elf', 'dwarf', 'kingdom'];
var fxState = { names: false, rev: {}, as: {} };

function fxPackIds() { return FX_PACK_IDS.slice(); }
// 目前魔幻風格;歷史世界或 theme_skin.js 未載入回 null
function fxPack() {
  var t, p = null;
  if (typeof themeGet !== 'function' || typeof themeRealm !== 'function') return null;
  t = themeGet();
  if (themeRealm(t) === 'fantasy' && FX_PACK_IDS.indexOf(t) >= 0 && typeof FX_TECH_DATA !== 'undefined') p = t;
  if (p && !fxState.names) fxInstallObjNames();
  return p;
}
function fxPackIs(id) { return fxPack() === id; }
function fxSec(key, pack) {   // FX_TECH_DATA[key][pack];查無回 null
  var p = pack || fxPack(), s;
  if (!p || typeof FX_TECH_DATA === 'undefined') return null;
  s = FX_TECH_DATA[key];
  return (s && s[p]) || null;
}

// ───────── 科技 / 時代 / 分支 / 路線 ─────────
function fxTechName(id) { var s = fxSec('nodes'), r = s && s[id]; return r ? r[0] : null; }
function fxTechDesc(id) { var s = fxSec('nodes'), r = s && s[id]; return r ? r[1] : null; }
// 節點顯示名:魔幻世界取覆寫,否則原名(n 為 CITY_TECHS 節點物件)
function fxTechLabel(n) { var v; if (!n) return ''; v = fxTechName(n.id); return v !== null ? v : n.name; }
// 時代名:e = 1~5;e = 6 為終局名(含「(終局)」字樣)。無覆寫回 null
function fxEraName(e) { var s = fxSec('eras'), r = s && s[(e | 0) - 1]; return r || null; }
function fxBranchName(b) { var s = fxSec('branches'); return (s && s[b]) || null; }
function fxRouteName(id) { var s = fxSec('routes'), r = s && s[id]; return r ? r[0] : null; }
function fxRouteTitle(id) { var s = fxSec('routes'), r = s && s[id]; return r ? r[1] : null; }

// ───────── 物件:名稱 / 隱藏 / 科技閘 / 別名 ─────────
function fxObjName(type) { var s = fxSec('rename'); return (s && s[type]) || null; }
function fxHiddenObj(type) { var s = fxSec('hide'); return !!(s && s.indexOf(type) >= 0); }
// 風格件的解鎖來源:'start' / 節點 id;非本族風格件或歷史世界回 undefined
function fxObjTech(type) { var s = fxSec('objTech'); return (s && Object.prototype.hasOwnProperty.call(s, type)) ? s[type] : undefined; }
// 計數別名 funcLike:魔幻件 → 視同的漢式功能件(功能閘 / 學院院級 / 營造條件 / 走鏢 / 顧問計數用);無則 null
function fxLike(type) { var s = fxSec('funcLike'); return (s && s[type]) || null; }
// 計數清單:此魔幻件在條件計數時視同的所有漢式物件 id(funcLike 目標 + condAlias 指向本件者);無則空陣列
function fxAsList(type) {
  var p = fxPack(), c, fl, ca, k, out = [];
  if (!p) return out;
  c = fxState.as[p];
  if (!c) {
    c = fxState.as[p] = {};
    fl = fxSec('funcLike', p) || {}; ca = fxSec('condAlias', p) || {};
    for (k in fl) if (Object.prototype.hasOwnProperty.call(fl, k)) (c[k] = c[k] || []).push(fl[k]);
    for (k in ca) if (Object.prototype.hasOwnProperty.call(ca, k)) { c[ca[k]] = c[ca[k]] || []; if (c[ca[k]].indexOf(k) < 0) c[ca[k]].push(k); }
  }
  return c[type] || out;
}
// 條件別名:條件(營造目標 / 顧問建議 / 下一步)指向的建築若在本族被隱藏,換成看得到的魔幻件;其餘原樣回傳
function fxGoType(type) {
  var p = fxPack(), ca, fl, k, r;
  if (!p || !fxHiddenObj(type)) return type;
  ca = fxSec('condAlias', p);
  if (ca && ca[type]) return ca[type];
  r = fxState.rev[p];
  if (!r) {
    r = fxState.rev[p] = {};
    fl = fxSec('funcLike', p) || {};
    for (k in fl) if (Object.prototype.hasOwnProperty.call(fl, k) && !r[fl[k]]) r[fl[k]] = k;
  }
  return r[type] || type;
}

// ───────── 解鎖內容顯示 ─────────
// 非物件解鎖(配方 / 政令 / 功能 / 職司 / 道具 / 稱號 / 魔幻特色)的顯示名;無覆寫回 null
function fxUnlockName(u) { var s = fxSec('unlockNames'); return (s && s[u]) || null; }
// 節點在魔幻世界的解鎖 id 清單(顯示用;資料取自 techtree_map 的 unlockObjs + unlockOther):只留「可見物件」或「有顯示名的非物件解鎖」,
// 漢式占位 id(縣衙、太醫署…無對應物件)與被隱藏物件剔除;歷史世界回 null
function fxTechUnlock(id, base) {
  var s = fxSec('nodes'), r = s && s[id], list, out = [], hide;
  if (!fxPack()) return null;
  hide = fxSec('hide') || [];
  list = (r && r[2]) || [];
  list.forEach(function (u) {
    var isObj = (typeof OBJECTS !== 'undefined') && OBJECTS[u] && !OBJECTS[u].retired;
    if (out.indexOf(u) >= 0 || hide.indexOf(u) >= 0) return;
    if (isObj || fxUnlockName(u) || (/^(rcp|edict|feat|duty|item|title)_/.test(u) && typeof NL_UNLOCK_NAMES !== 'undefined' && NL_UNLOCK_NAMES[u])) out.push(u);
  });
  return out;
}

// ───────── 物件名稱覆寫:在 OBJECTS[type].name 掛 getter(魔幻世界取本族名,其餘原名),各處 OBJECTS[x].name 一律生效 ─────────
// 只掛一次;getter 在 fxPack() 為 null 時回原名,所以歷史世界輸出與改動前逐位相同。
function fxInstallObjNames() {
  var ids = {}, base = {}, p;
  if (typeof OBJECTS === 'undefined' || typeof FX_TECH_DATA === 'undefined' || !OBJECTS.s8_treehouse) return false;   // 風格件尚未登錄(載入中)時不安裝,等下次 fxPack() 再試
  FX_PACK_IDS.forEach(function (pk) { var r = (FX_TECH_DATA.rename || {})[pk]; if (r) Object.keys(r).forEach(function (k) { ids[k] = 1; }); });
  Object.keys(ids).forEach(function (type) {
    var d = OBJECTS[type], desc;
    if (!d) return;
    desc = Object.getOwnPropertyDescriptor(d, 'name');
    if (desc && desc.get) return;
    base[type] = d.name;
    try {
      Object.defineProperty(d, 'name', {
        enumerable: true, configurable: true,
        get: function () { var v = (fxState.names && typeof fxPack === 'function') ? fxObjName(type) : null; return v !== null ? v : base[type]; },
        set: function (v) { base[type] = v; }
      });
    } catch (e) { /* 凍結物件略過 */ }
  });
  fxState.names = true;
  return true;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { fxPack, fxTechName, fxTechDesc, fxEraName, fxHiddenObj, fxObjTech, fxLike, fxGoType };
