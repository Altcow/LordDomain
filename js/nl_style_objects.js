// nl_style_objects.js — 風格件(PLAN_ETHNIC §4:S5 塞北土坯 4 件 + S3 水鄉 5 件,共 9 件)。美術用外部圖 assets/buildings/<id>_L.webp(js/ext_sprites.js 登錄);
// 缺圖 / 關閉外部圖時用「既有民居外形換色」的程式佔位(art 定義在本檔尾端,沿用 art_theme.js 的色票置換手法)。
// pack 欄位 = 城市風格主題 id(theme_skin.js:'bei' = S5 北方、'nanman' = S3 南方):只有 world.city.theme 等於 pack 時才出現在建造選單且可建;
//   其他風格(含預設漢)不顯示、不可建;已放置者不受影響(繪製與存檔都不看 pack)。解鎖:風格相符 = 起手開放(nlUnlocked 回 true)。
// 功能參數比照既有物件、成本 +10%,全部 PLACEHOLDER:小型住宅比照 民房 house;3×3 院落比照 鄉紳宅 house_gentry;4×4 大宅比照 世家宅邸 mansion_clan;白牆比照 院牆 wall_courtyard。
// 全域名稱:STYLE_OBJECTS objPackOk objPackThemes。外部全域一律 typeof 守衛。ES2017;不用 ?. ??

var STYLE_OBJECTS = {
  s5_yurt:       { name: '穹廬',     icon: '⛺', w: 2, h: 2, pack: 'bei',    group: 'town', like: 'house',         tpl: 'house',        tint: 'cloth1', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s5_adobe:      { name: '土坯屋',   icon: '🏚️', w: 2, h: 2, pack: 'bei',    group: 'town', like: 'house',         tpl: 'house',        tint: 'wall',   cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s5_adobe_yard: { name: '土坯院',   icon: '🏡', w: 3, h: 3, pack: 'bei',    group: 'town', like: 'house_gentry',  tpl: 'house_gentry', tint: 'wall',   cost: { coin: 418 }, tier: 3 },
  s5_wubao:      { name: '塢堡大宅', icon: '🏰', w: 4, h: 4, pack: 'bei',    group: 'town', like: 'mansion_clan',  tpl: 'mansion_clan', tint: 'wall',   cost: { coin: 1650 }, tier: 4 },
  s3_stilt:      { name: '水上棚屋', icon: '🛖', w: 2, h: 2, pack: 'nanman', group: 'town', like: 'house',         tpl: 'house',        tint: 'roof',   cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s3_tile:       { name: '水鄉瓦屋', icon: '🏘️', w: 2, h: 2, pack: 'nanman', group: 'town', like: 'house',         tpl: 'house',        tint: 'cloth1', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s3_riverside:  { name: '臨水宅院', icon: '🏡', w: 3, h: 3, pack: 'nanman', group: 'town', like: 'house_gentry',  tpl: 'house_gentry', tint: 'cloth1', cost: { coin: 418 }, tier: 3 },
  s3_shuixie:    { name: '水榭大宅', icon: '🏞️', w: 4, h: 4, pack: 'nanman', group: 'town', like: 'mansion_clan',  tpl: 'mansion_clan', tint: 'cloth1', cost: { coin: 1650 }, tier: 4 },
  s3_wall:       { name: '白牆',     icon: '🧱', w: 1, h: 1, pack: 'nanman', group: 'road', like: 'wall_courtyard', tpl: 'wall_courtyard', tint: 'cloth1', cost: { coin: 11 }, drag: true }
};

// 物件是否符合目前城市風格:無 pack 的一律 true;有 pack 者須 themeGet() === pack。theme_skin.js 未載入時視為漢風格(不符)。
function objPackOk(type) {
  var d = (typeof OBJECTS !== 'undefined') ? OBJECTS[type] : null;
  if (!d || !d.pack) return true;
  return (typeof themeGet === 'function' ? themeGet() : 'han') === d.pack;
}
function objPackThemes() {
  var out = {}, k;
  for (k in STYLE_OBJECTS) out[STYLE_OBJECTS[k].pack] = true;
  return Object.keys(out);
}

(function () {
  if (typeof OBJECTS === 'undefined') return;
  Object.keys(STYLE_OBJECTS).forEach(function (id) {
    var s = STYLE_OBJECTS[id], o;
    if (OBJECTS[id]) return;
    o = { name: s.name, icon: s.icon, w: s.w, h: s.h, cost: s.cost, side: 'estate', nl: true, pack: s.pack, on: [T_GRASS] };
    if (s.drag) { o.drag = true; o.on = [T_GRASS, T_ROAD]; }
    if (s.prod) o.prod = s.prod;
    if (s.tier !== undefined) o.tier = s.tier;
    if (s.w !== s.h) o.swap = true;
    OBJECTS[id] = o;
  });
  if (typeof BUILD_GROUPS !== 'undefined') {
    Object.keys(STYLE_OBJECTS).forEach(function (id) {
      var g = BUILD_GROUPS.find(function (x) { return x.id === STYLE_OBJECTS[id].group; });
      if (g && g.items.indexOf(id) < 0) g.items.push(id);
    });
  }
  if (typeof OBJ_CAT_OVERRIDE !== 'undefined') OBJ_CAT_OVERRIDE.s3_wall = 'deco';   // 純外觀白牆 → 擺設品(住宅類由 tier 自動歸經濟建築)
})();

// 程式佔位美術:複製既有外形(同佔地)並以風格色票偏色;外部圖載入後由 ext_sprites.js 取代
(function (A) {
  if (!A || !A.OBJ || typeof THEME_SKINS === 'undefined') return;
  Object.keys(STYLE_OBJECTS).forEach(function (id) {
    var s = STYLE_OBJECTS[id], base = A.OBJ[s.tpl], spec = {}, p, pal;
    if (!base || typeof base.build !== 'function' || A.OBJ[id]) return;
    pal = THEME_SKINS[s.pack].pal;
    for (p in base) if (Object.prototype.hasOwnProperty.call(base, p)) spec[p] = base[p];
    spec.build = function (m, v) {
      base.build(m, v);
      m.custom(0, 0, base.w, base.d, 0, function (ctx) {
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 0.4;
        ctx.fillStyle = pal[s.tint] || pal.wall; ctx.fillRect(-400, -400, 800, 800); ctx.restore();
      }, 999);
    };
    A.def(id, spec);
  });
})(typeof ART !== 'undefined' ? ART : null);
if (typeof module !== 'undefined' && module.exports) module.exports = { STYLE_OBJECTS };
