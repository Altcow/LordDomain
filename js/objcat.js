// js/objcat.js — 建造選單頂層分類:經濟建築(eco)/ 擺設品(deco)。軍事建築(mil)仍由 ui.js BUILD_GROUPS 的 mil 群組決定,不在此處。
// 自動判定:有產出(prod)/ 居住(tier)/ 數量上限(max)/ 兵種(unit)/ 有實際效果的 CITY_FX 或 CITY_FX_PENDING /
//   cityInfo 評分資料有服務(svc)、工作(jobs)、商業(shop)、文化(cult)、路面或水面格 → eco;其餘(純美觀:cityfx 只有 mei)→ deco。
// OBJ_CAT_OVERRIDE(物件 id → 'eco' | 'deco')覆寫自動判定,供使用者審核 tools/objcat_report.md 後調整。
// 全域名稱:OBJ_CAT_OVERRIDE objCatAuto objCatOf objCatWhy。外部全域一律 typeof 守衛。ES2017;不用 ?. ??
var OBJ_CAT_OVERRIDE = {
  // 擺設品:雖有文化評分,但使用者歸為純裝飾
  stele: 'deco', dog: 'deco', cat: 'deco', lotus: 'deco', reeds: 'deco', deco_pond: 'deco', ranch_fence: 'deco', trough: 'deco', fodder: 'deco', haystack: 'deco',
  // 經濟建築:結構性功能(防禦、通行)
  wall: 'eco', wall_courtyard: 'eco', gate_courtyard: 'eco', li_men: 'eco', gong_men: 'eco', ma_mian: 'eco', shi_gong_qiao: 'eco',
  // 經濟建築:名稱即公共設施,目前尚未登錄 CITY_FX / 評分資料,先人工歸類
  xian_ya: 'eco', yu_tang: 'eco', tai_yi_shu: 'eco', wanghuo_lou: 'eco', cao_cang: 'eco', ting_she: 'eco'
};

function objCatAuto(id) {
  var d = typeof OBJECTS !== 'undefined' ? OBJECTS[id] : null, fx, k, real, inf;
  if (!d) return { cat: 'deco', why: '非 OBJECTS 物件' };
  if (d.prod) return { cat: 'eco', why: '有產出 prod' };
  if (d.tier !== undefined && d.tier !== null) return { cat: 'eco', why: '居住(tier ' + d.tier + ')' };
  if (d.unit) return { cat: 'eco', why: '兵種 unit=' + d.unit };
  if (d.max) return { cat: 'eco', why: '有數量上限 max=' + d.max + '(功能建築)' };
  fx = (typeof CITY_FX !== 'undefined' && CITY_FX[id]) || (typeof CITY_FX_PENDING !== 'undefined' && CITY_FX_PENDING[id]) || null;
  if (fx && fx.fx) {
    real = [];
    for (k in fx.fx) if (k !== 'mei') real.push(k);
    if (real.length) return { cat: 'eco', why: 'CITY_FX 效果 ' + real.join('/') };
  }
  inf = typeof cityInfo === 'function' ? cityInfo(id) : null;
  if (inf) {
    if (inf.svc) return { cat: 'eco', why: 'cityInfo 服務 ' + inf.svc + '(' + inf.cls + ')' };
    if (inf.jobs) return { cat: 'eco', why: 'cityInfo 工作 ' + inf.jobs + '(' + inf.cls + ')' };
    if (inf.shop) return { cat: 'eco', why: 'cityInfo 商業(' + inf.cls + ')' };
    if (inf.cult) return { cat: 'eco', why: 'cityInfo 文化(' + inf.cls + ')' };
    if (inf.road || inf.water) return { cat: 'eco', why: 'cityInfo 路面/水面格(' + inf.cls + ')' };
    return { cat: 'deco', why: '無產出與效果(' + inf.cls + ')' + (fx ? ',CITY_FX 僅美觀' : '') };
  }
  return { cat: 'deco', why: '無產出與效果' };
}
function objCatOf(id) {
  if (OBJ_CAT_OVERRIDE[id] === 'eco' || OBJ_CAT_OVERRIDE[id] === 'deco') return OBJ_CAT_OVERRIDE[id];
  return objCatAuto(id).cat;
}
function objCatWhy(id) {
  var o = OBJ_CAT_OVERRIDE[id];
  if (o === 'eco' || o === 'deco') return '覆寫 OBJ_CAT_OVERRIDE(自動:' + objCatAuto(id).cat + ' / ' + objCatAuto(id).why + ')';
  return objCatAuto(id).why;
}
