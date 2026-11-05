// art_gather.js — 城市聚集 6 件擺設/公共物件(PLAN_CITYLIFE_GATHER §6.2):樂舞台 2×2、涼棚茶座 2×2、槐蔭石台 2×2、扁書告示壁 2×1、布傘蓋 1×1、弈棋石案座 2×1。
// 美術用外部圖 assets/buildings/<id>_L.webp(ext_sprites 登錄);缺圖 / 關閉外部圖時用本檔程式繪製備援。登記沿用 art_furnace.js 做法(併入 NL_NEW_OBJECTS 與 OBJECTS / BUILD_GROUPS / OBJ_CAT_OVERRIDE)。
// 解鎖:NL_NEW_OBJECTS[id].tech = 既有科技節點(節點 unlock 清單同步加入,見 js/techtree_data.js);成本 PLACEHOLDER。
// 聚集行為(下棋 / 路邊休息)見 js/citygather.js + js/gatherdata.js:yi_zuo = 下棋點、liang_peng / huai_shade = 休息點;wu_tai / bian_shu / san_gai 目前為靜態擺設(P3 公告 / P4 看戲接口預留)。
// 載入順序:art.js、art_objects.js、objcat.js、ui.js、nl_objects.js 之後。不發聲。ES2017;不用 ?. ??。
(function (A) {
  if (!A || typeof A.def !== 'function') return;
  var C = A.C;
  var CLOTH = '#c9a04a', CLOTH_DK = '#8a6a2a', RED = '#a8402e';

  var GATHER_OBJECTS = {
    wu_tai:     { name: '樂舞台',     icon: '🎭', w: 2, h: 2, group: 'town',   tech: 'rl_jiaoji',   cost: { coin: 80 }, cat: 'deco' },
    liang_peng: { name: '涼棚茶座',   icon: '🍵', w: 2, h: 2, group: 'table',  tech: 'ag_chazhong', cost: { coin: 60 }, cat: 'deco' },
    huai_shade: { name: '槐蔭石台',   icon: '🌳', w: 2, h: 2, group: 'garden', tech: 'bd_yuanpu',   cost: { coin: 50 }, cat: 'deco' },
    bian_shu:   { name: '扁書告示壁', icon: '📜', w: 2, h: 1, group: 'town',   tech: 'wr_lishu',    cost: { coin: 40 }, cat: 'deco' },
    san_gai:    { name: '布傘蓋',     icon: '⛱️', w: 1, h: 1, group: 'bazaar', tech: 'e_shiling',   cost: { coin: 20 }, cat: 'deco' },
    yi_zuo:     { name: '弈棋石案座', icon: '♟️', w: 2, h: 1, group: 'table',  tech: 'ed_xiangyin', cost: { coin: 45 }, cat: 'deco' }
  };

  A.def('wu_tai', { w: 2, d: 2, hmax: 60, shadow: 'rect', build: function (m, v) {
    m.box(0.05, 0.05, 0, 1.9, 1.9, 6, C.stone[1], { top: C.wood[2] });
    m.box(0.12, 0.12, 6, 1.76, 1.76, 2, C.wood[1], { top: C.wood[2] });
    m.box(0.12, 0.12, 8, 0.1, 0.1, 30, C.wood[0]); m.box(1.78, 0.12, 8, 0.1, 0.1, 30, C.wood[0]);
    m.box(0.12, 0.12, 36, 1.76, 0.1, 10, RED);
    m.box(0.12, 0.12, 36, 0.1, 1.76, 10, A.tone(RED, 0.85));
    m.cyl(1.4, 1.2, 8, 0.2, 9, RED, { topCol: C.wood[2] });
  } });
  A.def('liang_peng', { w: 2, d: 2, hmax: 52, shadow: 'rect', build: function (m, v) {
    m.box(0.1, 0.1, 0, 0.09, 0.09, 30, C.wood[0]); m.box(1.8, 0.1, 0, 0.09, 0.09, 30, C.wood[0]);
    m.box(0.1, 1.8, 0, 0.09, 0.09, 30, C.wood[0]); m.box(1.8, 1.8, 0, 0.09, 0.09, 30, C.wood[0]);
    m.box(0.3, 0.45, 0, 1.4, 0.2, 8, C.wood[1], { top: C.wood[2] }); m.box(0.3, 1.35, 0, 1.4, 0.2, 8, C.wood[1], { top: C.wood[2] });
    m.box(0.6, 0.85, 0, 0.8, 0.3, 9, C.wood[2], { top: A.tone(C.wood[2], 1.1) });
    m.box(0.0, 0.0, 30, 2.0, 2.0, 5, C.thatch, { top: A.tone(C.thatch, 1.1) });
  } });
  A.def('huai_shade', { w: 2, d: 2, hmax: 80, shadow: 'ellipse', build: function (m, v) {
    m.cyl(1.0, 1.0, 0, 0.22, 34, '#6a5238', { topCol: '#7a6044' });
    m.cyl(1.0, 1.0, 26, 0.95, 20, '#4e8a3a', { topCol: '#6aa84e' });
    m.cyl(0.8, 1.0, 40, 0.7, 14, '#5a9a44', { topCol: '#7ab85a' });
    m.box(1.15, 1.25, 0, 0.7, 0.5, 6, C.stone[1], { top: C.stone[2] });
  } });
  A.def('bian_shu', { w: 2, d: 1, hmax: 48, shadow: 'rect', build: function (m, v) {
    m.box(0.05, 0.25, 0, 1.9, 0.5, 26, '#b59a72', { top: '#c8b088' });
    m.box(0.0, 0.2, 26, 2.0, 0.6, 5, C.tile, { top: A.tone(C.tile, 1.1) });
    for (var i = 0; i < 4; i++) m.box(0.2 + i * 0.45, 0.76, 6, 0.36, 0.04, 16, '#e6cf8e');
  } });
  A.def('san_gai', { w: 1, d: 1, hmax: 56, shadow: 'ellipse', build: function (m, v) {
    m.cyl(0.5, 0.5, 0, 0.05, 36, C.wood[1]);
    m.cone(0.5, 0.5, 34, 0.48, 14, CLOTH, { });
    m.box(0.3, 0.3, 0, 0.4, 0.4, 7, C.wood[2], { top: A.tone(C.wood[2], 1.1) });
    void CLOTH_DK;
  } });
  A.def('yi_zuo', { w: 2, d: 1, hmax: 30, shadow: 'rect', build: function (m, v) {
    m.box(0.35, 0.2, 0, 1.3, 0.6, 14, C.stone[1], { top: C.stone[2] });
    m.cyl(0.18, 0.5, 0, 0.17, 8, C.stone[1], { topCol: C.stone[2] }); m.cyl(1.82, 0.5, 0, 0.17, 8, C.stone[1], { topCol: C.stone[2] });
    m.custom(0.45, 0.3, 1.1, 0.4, 14, function (ctx, mm) {
      for (var i = 0; i <= 4; i++) {
        A.line(ctx, mm.pt(0.6, 0.35 + i * 0.075, 14), mm.pt(1.4, 0.35 + i * 0.075, 14), C.stone[0], 0.7);
        A.line(ctx, mm.pt(0.6 + i * 0.2, 0.35, 14), mm.pt(0.6 + i * 0.2, 0.65, 14), C.stone[0], 0.7);
      }
    });
  } });

  if (typeof NL_NEW_OBJECTS !== 'undefined' && typeof OBJECTS !== 'undefined') {
    Object.keys(GATHER_OBJECTS).forEach(function (id) {
      var s = GATHER_OBJECTS[id];
      if (!NL_NEW_OBJECTS[id]) NL_NEW_OBJECTS[id] = s;
      if (!OBJECTS[id]) {
        var o = { name: s.name, icon: s.icon, w: s.w, h: s.h, cost: s.cost, side: 'estate', nl: true, on: [T_GRASS, T_ROAD] };
        if (s.w !== s.h) o.swap = true;
        OBJECTS[id] = o;
      }
      if (typeof OBJ_CAT_OVERRIDE !== 'undefined') OBJ_CAT_OVERRIDE[id] = s.cat;
      if (typeof BUILD_GROUPS !== 'undefined') {
        var g = BUILD_GROUPS.find(function (x) { return x.id === s.group; });
        if (g && g.items.indexOf(id) < 0) g.items.push(id);
      }
    });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { GATHER_OBJECTS: GATHER_OBJECTS };
})(typeof ART !== 'undefined' ? ART : null);
