// art_deco1.js — 裝飾一:商鋪(T_SHOP)、市集攤位(T_STALL)、酒罈與水桶、家具與室內小物(PLAN_ART_STYLE §3.4)
// 依賴 art.js、art_objects.js(借用 house 模板與 jar / glyph 等零件);OBJECTS 於 data.js 定義

(function (A) {
  var C = A.C, SNOW = '#f7fbff';
  var TOY = ['#e83a2a', '#ffc94a', '#4ab7ec', '#9a5cc8'];
  var SHELF = ['#3e5c7a', '#b8443a', '#c79650', '#3fa385', '#e3b95c'];

  // ---- 共用零件 ----
  // 貨品:沿用 A.goods 的 veg/fruit/cloth/pottery/rice/book/rouge/meat,另補 wine/herb/tea/toy/coin
  function goodsX(ctx, kind, x, y, i) {
    if (kind === 'wine') A.jar(ctx, x, y, 0.38, false);
    else if (kind === 'herb') { A.line(ctx, [x, y], [x, y - 7], '#5a8a3a', 1.2); A.ellipse(ctx, x - 2, y - 5, 2, 1.2, '#7ccc4c', 0.5); A.ellipse(ctx, x + 2, y - 4, 2, 1.2, '#9ad870', 0.5); }
    else if (kind === 'tea') { A.ellipse(ctx, x, y - 1.5, 3.4, 1.8, '#f6eed8', 0.5); A.ellipse(ctx, x, y - 2.8, 2.6, 1, '#7a4a2a'); }
    else if (kind === 'toy') A.poly(ctx, [[x - 4, y - 1], [x, y - 7], [x + 4, y - 1]], TOY[i % 4], 0.5);
    else if (kind === 'coin') { A.circle(ctx, x - 1.5, y - 2, 2.4, C.gold, 0.5); A.circle(ctx, x + 1.5, y - 3.5, 2.4, C.gold, 0.5); }
    else A.goods(ctx, kind, x, y, i);
  }

  // 生火爐灶(小方爐 + 鍋);u,v 為局部座標
  function stoveX(m, u, v) {
    m.box(u, v, 0, 0.3, 0.3, 7, C.stone[1], { top: C.stone[0] });
    m.cyl(u + 0.15, v + 0.15, 7, 0.09, 4, C.bronze, { topCol: C.water[2] });
  }
  function stoveAnim(u, v, z) {
    return function (ctx, m, t) { var p = m.pt(u, v, z); A.smoke(ctx, p[0], p[1], t, 0.7); };
  }

  // ---- 商鋪 T_SHOP:民房底 + 匾額(F 面)+ 幌子 + 門口貨品 ----
  // o: lv, sign, board, signInk, flag, flagInk, goods, earth, extra(m,v,z)
  function shopT(m, v, o) {
    var lv = o.lv || 2, z = 4 + (lv === 3 ? 21 : 18);
    A.OBJ.house.build(m, { level: lv, season: v.season, skin: o.earth ? 'earth' : '' });
    m.custom(0.6, 1.66, 0.6, 0.06, z - 2, function (ctx, mm) {
      if (!A.visible(mm, 'F')) return;
      var a = mm.pt(0.62, 1.65, z - 2), b = mm.pt(1.12, 1.65, z - 2);
      A.poly(ctx, [[a[0], a[1]], [b[0], b[1]], [b[0], b[1] - 6], [a[0], a[1] - 6]], o.board || C.lacquer, 0.7);
      A.glyph(ctx, o.sign, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 3, 5.5, o.signInk || C.gold);
    }, 1);
    m.custom(1.82, 1.82, 0.1, 0.1, 0, function (ctx, mm) { var p = mm.pt(1.86, 1.86, 0); A.signFlag(ctx, p[0], p[1], 40, o.sign, o.flag, o.flagInk); }, 3);
    if (o.goods) m.custom(0.2, 1.84, 0.6, 0.14, 0, function (ctx, mm) { for (var i = 0; i < 3; i++) { var p = mm.pt(0.3 + i * 0.22, 1.9, 0); goodsX(ctx, o.goods, p[0], p[1], i); } }, 2);
    if (o.extra) o.extra(m, v, z);
  }
  function defShop(key, o) {
    A.def(key, {
      w: 2, d: 2, hmax: o.hmax || 82,
      build: function (m, v) { shopT(m, v, o); },
      lights: function () { return A.OBJ.house.lights({ level: o.lv || 2 }).concat(o.lights || []); },
      anim: o.anim
    });
  }
  function lanternX(m, v, z) {
    m.custom(1.2, 1.7, 0.3, 0.1, z - 1, function (ctx, mm) { var p = mm.pt(1.5, 1.72, z - 1); A.lantern(ctx, p[0], p[1], 1); }, 1);
  }
  function gambleX(m, v, z) {
    lanternX(m, v, z);
    // 門側骰子招牌
    m.custom(0.2, 1.66, 0.14, 0.06, z - 12, function (ctx, mm) {
      if (!A.visible(mm, 'F')) return;
      var q = [mm.pt(0.2, 1.67, z - 12), mm.pt(0.34, 1.67, z - 12), mm.pt(0.34, 1.67, z - 1), mm.pt(0.2, 1.67, z - 1)];
      A.poly(ctx, q, '#fbf6e8', 0.7);
      var p = mm.pt(0.27, 1.67, z - 6.5); A.circle(ctx, p[0], p[1], 1.4, '#d23a2c');
    }, 1);
  }
  function herbX(m) { stoveX(m, 1.4, 1.8); }
  function forgeX(m) {
    m.box(0.12, 1.7, 0, 0.3, 0.22, 7, C.stone[0]);
    m.custom(0.12, 1.7, 0.3, 0.22, 8, function (ctx, mm) { var p = mm.pt(0.27, 1.81, 7); A.poly(ctx, [[p[0] - 5, p[1]], [p[0] + 5, p[1]], [p[0] + 3, p[1] - 3], [p[0] - 3, p[1] - 3]], '#4a4e56', 0.7); }, 1);
    m.box(0.8, 1.66, 0, 0.36, 0.22, 5, '#4a4e56', { top: '#6f7e8c' });
  }
  function bankX(m, v, z) {
    m.custom(0.6, 1.66, 0.6, 0.06, z - 10, function (ctx, mm) {
      if (!A.visible(mm, 'F')) return;
      var a = mm.pt(0.7, 1.67, z - 9), b = mm.pt(0.85, 1.67, z - 12), c = mm.pt(1.0, 1.67, z - 9);
      A.line(ctx, a, b, C.ink, 0.8); A.line(ctx, b, c, C.ink, 0.8);
      A.circle(ctx, a[0], a[1], 1.8, C.gold, 0.5); A.circle(ctx, b[0], b[1], 1.8, C.gold, 0.5); A.circle(ctx, c[0], c[1], 1.8, C.gold, 0.5);
    }, 1);
  }
  function teaX(m) { stoveX(m, 1.4, 1.8); }

  defShop('shop_wine', { sign: '酒', board: C.lacquer, signInk: C.gold, flag: '#3e6fb0', flagInk: '#fbf6e8', goods: 'wine' });
  defShop('shop_book', { sign: '書', board: C.lacquer, signInk: C.gold, flag: '#f4ead2', flagInk: '#2b1d1b', goods: 'book' });
  defShop('shop_cloth', { sign: '布', board: C.lacquer, signInk: C.gold, flag: '#7a5cc8', flagInk: '#fbf6e8', goods: 'cloth' });
  defShop('shop_rice', { sign: '米', board: C.lacquer, signInk: C.gold, flag: '#e3b95c', flagInk: '#2b1d1b', goods: 'rice' });
  defShop('shop_rouge', { sign: '粉', board: C.lacquer, signInk: '#ff8fb0', flag: '#ff8fb0', flagInk: '#7a1f3a', goods: 'rouge' });
  defShop('shop_gamble', {
    sign: '賭', lv: 3, hmax: 86, board: C.lacquer, signInk: C.gold, flag: '#2b1d1b', flagInk: '#ffc94a', goods: null, extra: gambleX,
    lights: [[1.5, 1.72, 18, 26, C.lantern, 0.9, 'F']]
  });
  defShop('shop_brothel', {
    sign: '樓', lv: 3, hmax: 86, board: '#e83a5a', signInk: '#ffe8a0', flag: '#e83a5a', flagInk: '#ffe8a0', goods: 'rouge', extra: lanternX,
    lights: [[1.5, 1.72, 18, 26, '#ff5a8a', 0.9, 'F']]
  });
  defShop('shop_herb', {
    sign: '藥', board: C.lacquer, signInk: C.gold, flag: '#3fa385', flagInk: '#fbf6e8', goods: 'herb', extra: herbX,
    anim: stoveAnim(1.55, 1.95, 9)
  });
  defShop('shop_smith', {
    sign: '鐵', earth: true, board: C.lacquer, signInk: C.gold, flag: '#6f7e8c', flagInk: '#fbf6e8', goods: null, extra: forgeX,
    lights: [[0.27, 1.81, 8, 30, C.fire, 1]],
    anim: function (ctx, m, t) { var p = m.pt(0.27, 1.81, 9); A.fire(ctx, p[0], p[1], t, 0.9); }
  });
  defShop('shop_tea', {
    sign: '茶', board: C.lacquer, signInk: C.gold, flag: '#3fa385', flagInk: '#fbf6e8', goods: 'tea', extra: teaX,
    anim: stoveAnim(1.55, 1.95, 9)
  });
  defShop('shop_pawn', { sign: '當', board: C.hanRed, signInk: C.gold, flag: '#c79650', flagInk: '#2b1d1b', goods: null });
  defShop('bank', { sign: '錢', board: C.lacquer, signInk: C.gold, flag: '#ffc94a', flagInk: '#2b1d1b', goods: 'coin', extra: bankX });

  // 客棧 inn 3x2:兩層懸山瓦頂 + 馬樁 + 門側燈籠
  A.def('inn', {
    w: 3, d: 2, hmax: 90,
    build: function (m, v) {
      var snow = v.season === 'winter';
      var F = function (ctx, f) { A.band(ctx, f, 0, 3, C.earthDk); A.posts(ctx, f, [0, 0.33, 0.66, 1], 0.09, C.wood[1]); A.door(ctx, f, 0.5, 0.36, 13, C.wood[1]); A.lattice(ctx, f, 0.17, 0.3, 7, 7); A.lattice(ctx, f, 0.83, 0.3, 7, 7); };
      var S = function (ctx, f) { A.band(ctx, f, 0, 3, C.earthDk); A.posts(ctx, f, [0, 0.5, 1], 0.09, C.wood[1]); A.lattice(ctx, f, 0.5, 0.3, 7, 7); };
      m.box(0.2, 0.3, 0, 2.6, 1.4, 4, C.stone[1], { top: C.stone[2] });
      m.box(0.2, 0.3, 4, 2.6, 1.4, 18, C.earth, { deco: { F: F, B: S, L: S, R: S } });
      m.gable(0.2, 0.3, 22, 2.6, 1.4, 14, C.tile, { over: 0.2, curl: 2.5, sag: 1, ridgeCol: C.tileDk, snow: snow, endCol: C.earth, hookSize: 3 });
      m.custom(1.2, 1.66, 0.8, 0.06, 20, function (ctx, mm) {
        if (!A.visible(mm, 'F')) return;
        var a = mm.pt(1.2, 1.65, 20), b = mm.pt(1.9, 1.65, 20);
        A.poly(ctx, [[a[0], a[1]], [b[0], b[1]], [b[0], b[1] - 6], [a[0], a[1] - 6]], C.lacquer, 0.7);
        A.glyph(ctx, '客', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 3, 5.5, C.gold);
      }, 1);
      m.cyl(0.5, 2.0, 0, 0.06, 9, C.wood[1]); m.cyl(2.3, 2.0, 0, 0.06, 9, C.wood[1]);
      m.custom(2.85, 1.85, 0.1, 0.1, 0, function (ctx, mm) { var p = mm.pt(2.9, 1.9, 0); A.signFlag(ctx, p[0], p[1], 46, '客', '#3e6fb0', '#fbf6e8'); }, 3);
    },
    lights: function () {
      return [[0.64, 1.66, 12, 16, C.lamp, 0.6, 'F'], [2.36, 1.66, 12, 16, C.lamp, 0.6, 'F'], [1.5, 1.72, 16, 22, C.lantern, 0.9, 'F'],
        [0.3, 1.72, 18, 20, C.lantern, 0.9, 'F'], [2.7, 1.72, 18, 20, C.lantern, 0.9, 'F']];
    }
  });

  // 廁所 privy 1x1:極小茅頂小屋,單門
  A.def('privy', {
    w: 1, d: 1, hmax: 36,
    build: function (m, v) {
      var snow = v.season === 'winter', post = function (ctx, f) { A.posts(ctx, f, [0, 1], 0.08, C.wood[0]); };
      m.box(0.16, 0.18, 0, 0.68, 0.66, 12, C.wood[1], { top: C.wood[2], deco: { F: function (ctx, f) { post(ctx, f); A.door(ctx, f, 0.5, 0.3, 9, C.wood[2]); }, L: post, R: post, B: post } });
      m.gable(0.12, 0.14, 12, 0.76, 0.72, 10, C.thatch, { over: 0.1, curl: 0, sag: 0.4, tileDensity: 8, ridgeCol: C.thatchDk, eaveCol: C.thatchDk, hooks: false, snow: snow, endCol: C.wood[1] });
    }
  });

  // ---- 市集攤位 T_STALL(2x1):攤架 + 條紋棚布 + 招牌字 + 貨品 ----
  function stallT(m, v, o) {
    var snow = v.season === 'winter', awn = o.awn;
    m.box(0.12, 0.12, 0, 0.07, 0.07, 30, C.wood[1]);
    m.box(1.81, 0.12, 0, 0.07, 0.07, 30, C.wood[1]);
    m.box(0.1, 0.45, 0, 1.8, 0.42, 10, C.wood[1], { top: C.wood[2], deco: { F: function (ctx, f) { A.poly(ctx, A.quad(f, 0.02, 0.98, 2, 9), A.tone(awn, f.light), 0.5); A.band(ctx, f, 7.5, 9, C.gold); } } });
    m.custom(0.1, 0.5, 1.8, 0.35, 10.5, function (ctx, mm) {
      for (var i = 0; i < 6; i++) { var p = mm.pt(0.28 + i * 0.29, 0.66, 10); goodsX(ctx, o.goods, p[0], p[1], i); }
    });
    m.custom(0.05, 0.08, 1.9, 0.5, 30, function (ctx, mm) {
      var n = 8, i, u0, u1, c;
      for (i = 0; i < n; i++) {
        u0 = 0.05 + 1.9 * i / n; u1 = 0.05 + 1.9 * (i + 1) / n;
        A.poly(ctx, [mm.pt(u0, 0.08, 31), mm.pt(u1, 0.08, 31), mm.pt(u1, 0.58, 24), mm.pt(u0, 0.58, 24)], i % 2 ? '#fbf1dc' : awn, 0.4);
        c = mm.pt((u0 + u1) / 2, 0.58, 24);
        A.ellipse(ctx, c[0], c[1] + 0.8, 4.4, 2.6, i % 2 ? '#fbf1dc' : awn, 0.4);
      }
      if (snow) A.poly(ctx, [mm.pt(0.05, 0.08, 31), mm.pt(1.95, 0.08, 31), mm.pt(1.95, 0.08, 33.5), mm.pt(0.05, 0.08, 33.5)], SNOW, 0.5);
      var s = mm.pt(1.0, 0.58, 22);
      A.poly(ctx, [[s[0] - 5, s[1]], [s[0] + 5, s[1]], [s[0] + 5, s[1] + 8], [s[0] - 5, s[1] + 8]], C.lacquer, 0.6);
      A.glyph(ctx, o.sign, s[0], s[1] + 4.2, 6.5, C.gold);
    }, 2);
    if (o.extra) o.extra(m, v);
  }
  function defStall(key, o) {
    A.def(key, {
      w: 2, d: 1, hmax: 56,
      build: function (m, v) { stallT(m, v, o); },
      lights: function () { return o.lights || [[1.0, 0.6, 18, 24, C.lamp, 0.6]]; },
      anim: o.anim
    });
  }
  function teaStallX(m) { stoveX(m, 0.2, 0.6); }
  function teaStallAnim(ctx, m, t) {
    var p = m.pt(0.35, 0.72, 17); A.fire(ctx, p[0], p[1], t, 0.7);
    var q = m.pt(0.35, 0.72, 20); A.smoke(ctx, q[0], q[1], t, 1.7);
  }
  function windX(m) { m.box(1.5, 0.6, 10, 0.1, 0.1, 2, C.wood[1]); }
  function windAnim(ctx, m, t) {
    var b = m.pt(1.55, 0.6, 12), top = m.pt(1.55, 0.6, 24);
    A.line(ctx, b, top, C.wood[1], 1.4);
    for (var k = 0; k < 4; k++) {
      var a = t * 3 + k * Math.PI / 2;
      A.line(ctx, top, [top[0] + Math.cos(a) * 5, top[1] + Math.sin(a) * 5], TOY[k], 2);
    }
  }

  defStall('stall_veg', { awn: '#3fa385', sign: '菜', goods: 'veg' });
  defStall('stall_fruit', { awn: '#f2603c', sign: '果', goods: 'fruit' });
  defStall('stall_cloth', { awn: '#7a5cc8', sign: '布', goods: 'cloth' });
  defStall('stall_pottery', { awn: '#c79650', sign: '陶', goods: 'pottery' });
  defStall('stall_rice', { awn: '#e3b95c', sign: '米', goods: 'rice' });
  defStall('stall_book', { awn: '#3e5c7a', sign: '書', goods: 'book' });
  defStall('stall_rouge', { awn: '#e86a9a', sign: '粉', goods: 'rouge' });
  defStall('stall_meat', { awn: '#d23a2c', sign: '肉', goods: 'meat' });
  defStall('stall_wine', { awn: '#3e6fb0', sign: '酒', goods: 'wine' });
  defStall('stall_tea', {
    awn: '#3fa385', sign: '茶', goods: 'tea', extra: teaStallX, anim: teaStallAnim,
    lights: [[0.35, 0.72, 12, 20, C.fire, 0.8], [1.0, 0.6, 18, 24, C.lamp, 0.6]]
  });
  defStall('stall_toy', { awn: '#ffc94a', sign: '玩', goods: 'toy', extra: windX, anim: windAnim });

  // ---- 酒罈與水桶 ----
  // 酒罈(sym):winejar 已在 art_objects.js 定義,此處不重複
  A.def('winejar_big', {
    w: 1, d: 1, sym: true, hmax: 34, shadow: 'ellipse',
    build: function (m) {
      m.custom(0.1, 0.1, 0.8, 0.8, 0, function (ctx, mm) { var c = mm.pt(0.5, 0.55, 0); A.jar(ctx, c[0], c[1] + 3, 1.45); });
    }
  });
  A.def('winejar_stack', {
    w: 1, d: 1, sym: true, hmax: 40, shadow: 'ellipse',
    build: function (m) {
      m.custom(0.1, 0.1, 0.8, 0.8, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 0.55, 0);
        A.jar(ctx, c[0] - 9, c[1] + 3, 1.1); A.jar(ctx, c[0] + 9, c[1] + 3, 1.1); A.jar(ctx, c[0], c[1] - 8, 1);
      });
    }
  });
  A.def('winejar_mix', {
    w: 1, d: 1, sym: true, hmax: 32, shadow: 'ellipse',
    build: function (m) {
      m.custom(0.1, 0.1, 0.8, 0.8, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 0.55, 0);
        A.jar(ctx, c[0] + 10, c[1] - 2, 0.7, false); A.jar(ctx, c[0] - 9, c[1] + 1, 1.2); A.jar(ctx, c[0] + 4, c[1] + 6, 0.85);
      });
    }
  });

  // 竹籃 basket(sym)
  A.def('basket', {
    w: 1, d: 1, sym: true, hmax: 20, shadow: 'ellipse',
    build: function (m) {
      m.cyl(0.5, 0.5, 0, 0.2, 8, C.thatch, { topCol: C.thatchDk, hoops: [2.5, 5.5] });
      m.custom(0.3, 0.3, 0.4, 0.4, 8, function (ctx, mm) {
        var a = mm.pt(0.3, 0.5, 8), b = mm.pt(0.7, 0.5, 8);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, a[1] - 14, b[0], b[1]);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2; ctx.stroke(); ctx.strokeStyle = C.thatch; ctx.lineWidth = 1; ctx.stroke();
      });
    }
  });

  // ---- 家具與室內小物 ----
  // 案 food_table(食案,擺菜;熱氣為動畫)
  A.def('food_table', {
    w: 1, d: 1, hmax: 14,
    build: function (m) {
      m.box(0.1, 0.1, 0, 0.08, 0.08, 6, C.wood[1]); m.box(0.82, 0.1, 0, 0.08, 0.08, 6, C.wood[1]);
      m.box(0.1, 0.82, 0, 0.08, 0.08, 6, C.wood[1]); m.box(0.82, 0.82, 0, 0.08, 0.08, 6, C.wood[1]);
      m.box(0.05, 0.05, 6, 0.9, 0.9, 2.5, C.wood[2], { top: C.wood[2] });
      m.cyl(0.3, 0.32, 8.5, 0.1, 2, C.silk, { topCol: '#f0e4c8' });
      m.cyl(0.66, 0.64, 8.5, 0.1, 2, C.silk, { topCol: '#e83a2a' });
    },
    anim: function (ctx, m, t) { var p = m.pt(0.5, 0.5, 12); A.smoke(ctx, p[0], p[1], t, 4.2); }
  });
  // 榻 couch:矮台 + 席 + 靠枕
  A.def('couch', {
    w: 1, d: 1, hmax: 12,
    build: function (m) {
      m.box(0.04, 0.04, 0, 0.92, 0.92, 4, C.wood[1], { top: C.wood[2] });
      m.box(0.1, 0.1, 4, 0.8, 0.8, 1.5, C.earth, { topDeco: function (ctx, mm) {
        for (var i = 1; i < 8; i++) { var k = 0.1 + i * 0.1; A.line(ctx, mm.pt(k, 0.12, 5.5), mm.pt(k, 0.88, 5.5), C.earthDk, 0.6); }
      } });
      m.box(0.2, 0.6, 5.5, 0.25, 0.25, 2, C.hanRed, { top: A.tone(C.hanRed, 1.1) });
    }
  });
  // 席 mat:平面席紋 + 枕
  A.def('mat', {
    w: 1, d: 1, hmax: 4,
    build: function (m) {
      m.box(0.02, 0.02, 0, 0.96, 0.96, 1.5, '#e8d27a', { topDeco: function (ctx, mm) {
        for (var i = 1; i < 10; i++) { var k = 0.02 + i * 0.096; A.line(ctx, mm.pt(k, 0.04, 1.5), mm.pt(k, 0.98, 1.5), C.wood[2], 0.6); A.line(ctx, mm.pt(0.04, k, 1.5), mm.pt(0.98, k, 1.5), C.wood[2], 0.6); }
      } });
      m.box(0.1, 0.1, 1.5, 0.25, 0.4, 1.5, C.silk);
    }
  });
  // 屏風 screen:三扇漆面 + 金雲紋 + 足
  A.def('screen', {
    w: 1, d: 1, hmax: 30,
    build: function (m) {
      var cloud = function (ctx, f) {
        A.band(ctx, f, 20, 22, C.gold);
        var p = f.pt(0.5, 14), q = f.pt(0.3, 8);
        A.circle(ctx, p[0], p[1], 3, C.gold, 0.5); A.circle(ctx, q[0], q[1], 2, C.gold, 0.5);
      };
      m.box(0.02, 0.4, 0, 0.96, 0.14, 2, C.wood[1]);
      [0.02, 0.35, 0.68].forEach(function (u) {
        m.box(u, 0.44, 2, 0.3, 0.1, 27, C.lacquer, { deco: { F: cloud, B: cloud } });
      });
    }
  });
  // 箱櫃 chest:漆箱 + 金飾 + 銅扣
  A.def('chest', {
    w: 1, d: 1, hmax: 16,
    build: function (m) {
      var band = function (ctx, f) { A.band(ctx, f, 4, 6, C.gold); var p = f.pt(0.5, 5); A.circle(ctx, p[0], p[1], 1.4, C.gold, 0.5); };
      m.box(0.1, 0.1, 0, 0.8, 0.8, 11, C.lacquer, { deco: { F: band, L: band, R: band, B: band } });
      m.box(0.06, 0.06, 11, 0.88, 0.88, 3, C.hanRed, { top: A.tone(C.hanRed, 1.1), deco: { F: band, L: band, R: band, B: band } });
    }
  });
  // 燈臺 lamp_stand(豆形燈,sym)
  A.def('lamp_stand', {
    w: 1, d: 1, sym: true, hmax: 26, shadow: 'ellipse',
    build: function (m) {
      m.cyl(0.5, 0.5, 0, 0.2, 2, C.wood[1]);
      m.cyl(0.5, 0.5, 2, 0.04, 16, C.wood[2]);
      m.cyl(0.5, 0.5, 18, 0.13, 3, C.earthDk, { topCol: C.gold });
    },
    lights: function () { return [[0.5, 0.5, 22, 20, C.lamp, 0.9]]; },
    anim: function (ctx, m, t) { var p = m.pt(0.5, 0.5, 22); A.fire(ctx, p[0], p[1], t, 0.6); }
  });
  // 博山爐 censer(山形蓋 + 柄 + 盤,青銅;裊煙為動畫,sym)
  A.def('censer', {
    w: 1, d: 1, sym: true, hmax: 28, shadow: 'ellipse',
    build: function (m) {
      m.cyl(0.5, 0.5, 0, 0.16, 4, C.bronze, { topCol: '#2f6b5e' });
      m.cone(0.5, 0.5, 4, 0.16, 12, C.bronze);
      m.custom(0.4, 0.4, 0.2, 0.2, 16, function (ctx, mm) { var p = mm.pt(0.5, 0.5, 17); A.circle(ctx, p[0], p[1], 2, C.bronze, 0.5); }, 1);
    },
    lights: function () { return [[0.5, 0.5, 6, 14, C.fire, 0.35]]; },
    anim: function (ctx, m, t) { var p = m.pt(0.5, 0.5, 20); A.smoke(ctx, p[0], p[1], t, 0.9); }
  });
  // 書架 bookshelf:木架 + 三層書簡
  A.def('bookshelf', {
    w: 1, d: 1, hmax: 44,
    build: function (m) {
      var shelf = function (ctx, f) {
        for (var k = 0; k < 4; k++) {
          var z = 2 + k * 11;
          A.band(ctx, f, z, z + 1.5, C.wood[2]);
          for (var j = 0; j < 6; j++) {
            var s0 = 0.08 + j * 0.14;
            A.poly(ctx, A.quad(f, s0, s0 + 0.1, z + 1.5, z + 9), SHELF[(j + k) % SHELF.length], 0.5);
          }
        }
      };
      m.box(0.06, 0.1, 0, 0.88, 0.16, 44, C.wood[1], { top: C.wood[2], deco: { F: shelf, L: shelf, R: shelf, B: shelf } });
    }
  });

  // 掃帚 broom:斜靠的竹柄 + 帚頭
  A.def('broom', {
    w: 1, d: 1, hmax: 22,
    build: function (m) {
      m.custom(0.3, 0.3, 0.5, 0.5, 0, function (ctx, mm) {
        var b = mm.pt(0.5, 0.5, 2), t = mm.pt(0.66, 0.4, 22);
        A.line(ctx, b, t, C.ink, 3.2); A.line(ctx, b, t, C.wood[2], 1.6);
        A.poly(ctx, [[b[0] - 6, b[1] - 2], [b[0] + 6, b[1] - 2], [b[0] + 4, b[1] + 4], [b[0] - 4, b[1] + 4]], '#e3b95c', 0.6);
      });
    }
  });

  // ---- 註冊到建築選單(OBJECTS 於 data.js 定義;side 'estate' 與其他建築一致) ----
  Object.assign(OBJECTS, {
    shop_wine:    { name: '酒館', icon: '🍶', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 120 }, side: 'estate' },
    shop_book:    { name: '書店', icon: '📚', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 120 }, side: 'estate' },
    shop_cloth:   { name: '布莊', icon: '🧵', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 120 }, side: 'estate' },
    shop_rice:    { name: '米舖', icon: '🌾', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 110 }, side: 'estate' },
    shop_rouge:   { name: '胭脂店', icon: '💄', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 110 }, side: 'estate' },
    shop_gamble:  { name: '博戲坊', icon: '🎲', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 180 }, side: 'estate' },
    shop_brothel: { name: '倡樓', icon: '🏮', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 180 }, side: 'estate' },
    shop_herb:    { name: '藥肆', icon: '🌿', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 110 }, side: 'estate' },
    shop_smith:   { name: '鍛鐵鋪', icon: '⚒️', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 130 }, side: 'estate' },
    shop_tea:     { name: '茶館', icon: '🍵', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 110 }, side: 'estate' },
    shop_pawn:    { name: '當鋪', icon: '🏦', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 130 }, side: 'estate' },
    bank:         { name: '錢莊', icon: '💰', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 150 }, side: 'estate' },
    inn:          { name: '客棧', icon: '🏨', w: 3, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 200 }, side: 'estate' },
    privy:        { name: '廁所', icon: '🚻', w: 1, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stall_veg:    { name: '菜攤', icon: '🥬', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stall_fruit:  { name: '果攤', icon: '🍎', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stall_cloth:  { name: '布攤', icon: '🧶', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stall_pottery: { name: '陶器攤', icon: '🏺', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stall_rice:   { name: '米糧攤', icon: '🌾', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stall_book:   { name: '書簡攤', icon: '📜', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stall_rouge:  { name: '胭脂攤', icon: '💄', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stall_meat:   { name: '肉攤', icon: '🥩', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stall_wine:   { name: '酒攤', icon: '🍶', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stall_tea:    { name: '茶水攤', icon: '🍵', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 40 }, side: 'estate' },
    stall_toy:    { name: '雜貨攤', icon: '🪁', w: 2, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 40 }, side: 'estate' },
    winejar:      { name: '酒罈', icon: '🏺', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    winejar_big:  { name: '大酒罈', icon: '🏺', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 40 }, side: 'estate' },
    winejar_stack: { name: '酒罈堆', icon: '🏺', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 50 }, side: 'estate' },
    winejar_mix:  { name: '酒罈大小組', icon: '🏺', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 45 }, side: 'estate' },
    basket:       { name: '竹籃', icon: '🧺', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    food_table:   { name: '食案', icon: '🍲', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 40 }, side: 'estate' },
    couch:        { name: '榻', icon: '🛋️', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 60 }, side: 'estate' },
    mat:          { name: '席與枕', icon: '🛏️', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    screen:       { name: '屏風', icon: '🎎', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 80 }, side: 'estate' },
    chest:        { name: '箱櫃', icon: '🧰', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 50 }, side: 'estate' },
    lamp_stand:   { name: '燈臺', icon: '🕯️', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 40 }, side: 'estate' },
    censer:       { name: '博山爐', icon: '🪔', w: 1, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 80 }, side: 'estate' },
    bookshelf:    { name: '書架', icon: '📚', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 90 }, side: 'estate' },
    broom:        { name: '掃帚', icon: '🧹', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' }
  });
})(ART);
