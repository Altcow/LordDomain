// art_furnace.js — 卡片熔爐建築 furnace_card(3×3,限 1 座)與 5 件周邊小擺設(風箱 / 鐵砧 / 碎片堆 / 淬火槽 2×1 / 燃料堆)。
// 外部圖(assets/buildings/<id>_L.webp,ext_sprites)缺圖時用本檔程式繪製備援;物件登記沿用 art_card.js 做法(併入 NL_NEW_OBJECTS 與 OBJECTS / BUILD_GROUPS)。
// 解鎖:NL_NEW_OBJECTS[id].tech = e_tieguan(鐵官,第 2 時代冶鐵節點;熔爐與周邊同節點,熔爐功能本身在卡包頁恆可用,建築只是另一個入口,不會死鎖)。
// 載入順序:art.js、art_objects.js、objcat.js、ui.js、nl_objects.js 之後。點擊接線:furnaceui.js 的 furnaceUiTap(o)(ui.js tapObjectAt 呼叫)。不發聲。ES2017;不用 ?. ??。
(function (A) {
  if (!A || typeof A.def !== 'function') return;
  var C = A.C;
  var TILE_DK = '#4d5c64', BRICK = '#8a5a44', BRICK_DK = '#5e3a2c', IRON = '#3c3f46', EMBER = '#ff8a3a';

  var FURNACE_OBJECTS = {
    furnace_card:    { name: '卡片熔爐',   icon: '🔥', w: 3, h: 3, group: 'ind', tech: 'e_tieguan', cost: { coin: 300 }, max: 1, cat: 'eco' },
    furnace_bellows: { name: '熔爐風箱',   icon: '💨', w: 1, h: 1, group: 'ind', tech: 'e_tieguan', cost: { coin: 20 }, cat: 'deco' },
    furnace_anvil:   { name: '熔爐鐵砧',   icon: '⚒️', w: 1, h: 1, group: 'ind', tech: 'e_tieguan', cost: { coin: 20 }, cat: 'deco' },
    furnace_shards:  { name: '碎片堆',     icon: '💠', w: 1, h: 1, group: 'ind', tech: 'e_tieguan', cost: { coin: 15 }, cat: 'deco' },
    furnace_quench:  { name: '淬火槽',     icon: '🪣', w: 2, h: 1, group: 'ind', tech: 'e_tieguan', cost: { coin: 30 }, cat: 'deco' },
    furnace_fuel:    { name: '燃料堆',     icon: '🪵', w: 1, h: 1, group: 'ind', tech: 'e_tieguan', cost: { coin: 15 }, cat: 'deco' }
  };

  A.def('furnace_card', { w: 3, d: 3, hmax: 70, shadow: 'rect', build: function (m, v) {
    m.box(0.05, 0.05, 0, 2.9, 2.9, 3, C.stone[1], { top: C.stone[2] });
    m.box(0.5, 0.5, 3, 2.0, 2.0, 22, BRICK, { top: BRICK_DK });
    m.box(0.35, 0.35, 3, 2.3, 0.15, 5, C.stone[2]); m.box(0.35, 2.5, 3, 2.3, 0.15, 5, C.stone[2]);
    m.box(1.0, 2.49, 8, 1.0, 0.04, 10, '#1b1512');
    m.cyl(1.5, 1.5, 25, 0.5, 26, BRICK_DK, { topCol: IRON, hoops: [6, 14] });
    m.box(0.15, 1.2, 3, 0.35, 0.6, 7, IRON);
  }, lights: function () { return [[1.5, 2.55, 14, 22, EMBER, 0.8, 'F']]; }, anim: function (ctx, m, t) {
    var p = m.pt(1.5, 1.5, 54), f = m.pt(1.5, 2.45, 12);
    A.smoke(ctx, p[0], p[1], t, 5); A.fire(ctx, f[0], f[1], t, 0.6);
  } });
  A.def('furnace_bellows', { w: 1, d: 1, hmax: 30, shadow: 'rect', build: function (m, v) {
    m.box(0.2, 0.15, 0, 0.6, 0.7, 4, C.wood[1]);
    m.box(0.25, 0.2, 4, 0.5, 0.6, 10, C.wood[0], { top: C.wood[2] });
    m.box(0.4, 0.8, 6, 0.2, 0.2, 3, IRON);
  } });
  A.def('furnace_anvil', { w: 1, d: 1, hmax: 28, shadow: 'rect', build: function (m, v) {
    m.cyl(0.5, 0.5, 0, 0.22, 8, C.wood[1], { topCol: C.wood[2] });
    m.box(0.2, 0.3, 8, 0.6, 0.4, 5, IRON, { top: '#6a6e78' });
    m.box(0.12, 0.38, 11, 0.2, 0.24, 3, IRON);
  } });
  A.def('furnace_shards', { w: 1, d: 1, hmax: 24, shadow: 'rect', build: function (m, v) {
    m.box(0.15, 0.15, 0, 0.7, 0.7, 5, C.wood[1], { top: '#5a8fb4' });
    m.box(0.3, 0.3, 5, 0.18, 0.18, 7, '#8cc4e0'); m.box(0.55, 0.45, 5, 0.16, 0.16, 5, '#a8d6ee'); m.box(0.42, 0.6, 5, 0.14, 0.14, 4, '#6aaed2');
  } });
  A.def('furnace_quench', { w: 2, d: 1, hmax: 24, shadow: 'rect', build: function (m, v) {
    m.box(0.1, 0.1, 0, 1.8, 0.8, 9, C.wood[1], { top: '#4a90b8' });
    m.box(0.2, 0.2, 7, 1.6, 0.6, 3, '#4a90b8');
    m.box(1.5, 0.35, 9, 0.12, 0.12, 4, IRON);
  } });
  A.def('furnace_fuel', { w: 1, d: 1, hmax: 22, shadow: 'rect', build: function (m, v) {
    m.box(0.12, 0.2, 0, 0.76, 0.2, 5, C.wood[0]); m.box(0.12, 0.45, 0, 0.76, 0.2, 5, C.wood[1]); m.box(0.18, 0.32, 5, 0.64, 0.2, 5, C.wood[2]);
    m.box(0.1, 0.7, 0, 0.8, 0.18, 4, '#2c2622');
  } });

  if (typeof NL_NEW_OBJECTS !== 'undefined' && typeof OBJECTS !== 'undefined') {
    Object.keys(FURNACE_OBJECTS).forEach(function (id) {
      var s = FURNACE_OBJECTS[id];
      if (!NL_NEW_OBJECTS[id]) NL_NEW_OBJECTS[id] = s;
      if (!OBJECTS[id]) {
        var o = { name: s.name, icon: s.icon, w: s.w, h: s.h, cost: s.cost, side: 'estate', nl: true, on: [T_GRASS, T_ROAD] };
        if (s.w !== s.h) o.swap = true;
        if (s.max) o.max = s.max;
        OBJECTS[id] = o;
      }
      if (typeof OBJ_CAT_OVERRIDE !== 'undefined') OBJ_CAT_OVERRIDE[id] = s.cat;
      if (typeof BUILD_GROUPS !== 'undefined') {
        var g = BUILD_GROUPS.find(function (x) { return x.id === s.group; });
        if (g && g.items.indexOf(id) < 0) g.items.push(id);
      }
    });
  }
})(typeof ART !== 'undefined' ? ART : null);
