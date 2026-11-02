// art_set.js — 桌几與座椅:帶擺設 / 空桌、座椅,以及組合模組(combos.js)補的幾件小物(經營布置用,side:'estate')。
// 依賴 art.js 先載入;OBJECTS 來自 data.js。全為新 key,不覆寫既有定義。
// 遊戲不能把東西疊放在桌上:茶具、碗盤、書卷、酒具、棋盤都畫在桌面上,算物件本身的一部分。
// 朝向:Model 以局部 (u,v) 繪製,正面在 v = D;rot 0 正面朝南(+y)。非正方形且會轉向者 swap:true;對稱者 sym:true。

(function (A) {
  var C = A.C;
  var KEYS = A.SET = [];
  var ITEMS = {};
  var CREAM = '#f4efe0', SOUP = '#8a4a2a', JAR = '#8a5230', JAR_DK = '#5a3420', PEWTER = '#b9bcc4';
  var FOOD = ['#c0553a', '#6aa04a', '#e0b040', '#8a5a3a', '#d9d0b0'];
  var STONE_WARM = '#b9a07c', STONE_WARM_LT = '#e6d8bb', STONE_WARM_DK = '#8d7656';

  function def(key, spec) { A.def(key, spec); KEYS.push(key); }
  function snowOn(v) { return v && v.season === 'winter' ? C.snow : null; }
  function leg(m, u, v, z, h, col) { m.box(u - 0.035, v - 0.035, z, 0.07, 0.07, h, col); }
  function grain(W, D, z) {
    return function (ctx, mm) {
      for (var i = 1; i <= 3; i++) { var k = D * i * 0.22; A.line(ctx, mm.pt(0.06, k, z), mm.pt(W - 0.06, k, z), C.wood[1], 0.6); }
    };
  }

  // ---------------- 桌面基座(回傳桌面高度 z) ----------------
  function woodBase(m, v, W, D) {
    var sn = snowOn(v);
    [0.11, W - 0.11].forEach(function (u) { [0.11, D - 0.11].forEach(function (w) { leg(m, u, w, 0, 14.5, C.wood[0]); }); });
    m.box(0.1, 0.1, 11.5, W - 0.2, D - 0.2, 3, C.wood[1]);
    m.box(0.03, 0.03, 14.5, W - 0.06, D - 0.06, 2.6, C.wood[2], { top: sn || C.wood[2], topDeco: grain(W, D, 17.1) });
    return 17.1;
  }
  function stoneBase(m, v, W, D) {
    var sn = snowOn(v);
    if (W === 1 && D === 1) {
      m.cyl(0.5, 0.5, 0, 0.3, 3, C.stone[0], { topCol: C.stone[1] });
      m.cyl(0.5, 0.5, 3, 0.17, 13, C.stone[1], { topCol: C.stone[1], hoops: [5, 11] });
      m.cyl(0.5, 0.5, 16, 0.46, 3.6, C.stone[2], { topCol: sn || C.stone[2] });
      return 19.6;
    }
    m.box(0.12, 0.12, 0, 0.3, D - 0.24, 13, C.stone[1], { top: C.stone[2] });
    m.box(W - 0.42, 0.12, 0, 0.3, D - 0.24, 13, C.stone[1], { top: C.stone[2] });
    m.box(0.02, 0.04, 13, W - 0.04, D - 0.08, 3.4, C.stone[2], { top: sn || C.stone[2] });
    return 16.4;
  }
  function lowBase(m, v, W, D) {
    var sn = snowOn(v);
    [0.14, W - 0.14].forEach(function (u) { [0.14, D - 0.14].forEach(function (w) { leg(m, u, w, 0, 6, C.wood[0]); }); });
    m.box(0.06, 0.06, 6, W - 0.12, D - 0.12, 2, C.wood[2], { top: sn || C.wood[2], topDeco: grain(W, D, 8) });
    m.box(0.04, 0.06, 7.2, 0.08, D - 0.12, 2.6, C.wood[0]);
    m.box(W - 0.12, 0.06, 7.2, 0.08, D - 0.12, 2.6, C.wood[0]);
    return 8;
  }
  function roundBase(m, v) {
    var sn = snowOn(v);
    m.cyl(1, 1, 0, 0.34, 2.6, C.wood[0], { topCol: C.wood[1] });
    m.cyl(1, 1, 2.6, 0.15, 12.4, C.wood[1], { topCol: C.wood[1], hoops: [6] });
    m.cyl(1, 1, 15, 0.9, 2.6, C.wood[2], { topCol: sn || A.tone(C.wood[2], 1.06), hoops: [1.3] });
    return 17.6;
  }
  var BASE = { wood: woodBase, stone: stoneBase, low: lowBase, round: roundBase };

  // ---------------- 桌面擺設(z = 桌面高度) ----------------
  function cup(m, u, v, z, col) { m.cyl(u, v, z, 0.06, 2, col || C.silk, { topCol: '#f0e4c8' }); }
  function pot(m, u, v, z) { m.cyl(u, v, z, 0.1, 3.4, C.bronze, { topCol: C.lacquer, hoops: [1.6] }); }
  function tray(m, u, v, z, w, d) { m.box(u, v, z, w, d, 0.8, C.lacquer, { top: '#4a2f26' }); }
  function bowl(m, u, v, z) { m.cyl(u, v, z, 0.085, 2.2, CREAM, { topCol: SOUP, hoops: [0.8] }); }
  function dish(m, u, v, z, food) { m.cyl(u, v, z, 0.14, 0.9, CREAM, { topCol: food }); }
  function jar(m, u, v, z, r, h) { m.cyl(u, v, z, r || 0.1, h || 4.6, JAR, { topCol: JAR_DK, hoops: [(h || 4.6) * 0.3, (h || 4.6) * 0.72] }); }
  function sticks(m, u, v, z) {
    m.custom(u - 0.2, v - 0.1, 0.4, 0.2, z, function (ctx, mm) {
      A.line(ctx, mm.pt(u - 0.12, v, z + 1), mm.pt(u + 0.12, v - 0.03, z + 1), C.wood[0], 0.9);
      A.line(ctx, mm.pt(u - 0.12, v + 0.05, z + 1), mm.pt(u + 0.12, v + 0.02, z + 1), C.wood[0], 0.9);
    });
  }
  function teaAt(m, cx, cy, z) {
    tray(m, cx - 0.24, cy - 0.15, z, 0.48, 0.3);
    pot(m, cx - 0.1, cy, z + 0.8);
    cup(m, cx + 0.1, cy - 0.06, z + 0.8); cup(m, cx + 0.1, cy + 0.08, z + 0.8);
  }
  function mealAt(m, cx, cy, z) {
    dish(m, cx - 0.17, cy - 0.12, z, FOOD[0]); dish(m, cx + 0.17, cy - 0.14, z, FOOD[1]);
    bowl(m, cx - 0.2, cy + 0.2, z); bowl(m, cx + 0.2, cy + 0.2, z);
    sticks(m, cx, cy + 0.3, z);
  }
  function booksAt(m, cx, cy, z) {
    m.box(cx - 0.14, cy - 0.1, z, 0.28, 0.2, 1.2, '#7a9ac0', { top: CREAM });
    m.box(cx - 0.12, cy - 0.09, z + 1.2, 0.26, 0.18, 1.2, '#b8584a', { top: CREAM });
    m.box(cx - 0.13, cy - 0.1, z + 2.4, 0.25, 0.19, 1.1, '#6a9a62', { top: CREAM });
  }
  function inkAt(m, cx, cy, z) {
    m.box(cx - 0.1, cy - 0.07, z, 0.2, 0.14, 0.9, '#2b2b30', { top: '#4a4a52' });
    m.custom(cx - 0.2, cy - 0.2, 0.4, 0.4, z + 1, function (ctx, mm) {
      A.line(ctx, mm.pt(cx + 0.02, cy + 0.12, z + 1.2), mm.pt(cx + 0.26, cy + 0.2, z + 1.2), C.wood[0], 1.1);
    });
  }
  function scrollAt(m, cx, cy, z, w) {
    m.box(cx - w / 2, cy - 0.13, z, w, 0.26, 0.5, '#f0e4c0', { top: '#f6edd0', topDeco: function (ctx, mm) {
      for (var i = 1; i <= 3; i++) A.line(ctx, mm.pt(cx - w / 2 + 0.05, cy - 0.13 + i * 0.065, z + 0.5), mm.pt(cx + w / 2 - 0.05, cy - 0.13 + i * 0.065, z + 0.5), '#9a8a68', 0.5);
    } });
    m.box(cx - w / 2 - 0.04, cy - 0.15, z, 0.05, 0.3, 0.9, C.wood[1]);
    m.box(cx + w / 2 - 0.01, cy - 0.15, z, 0.05, 0.3, 0.9, C.wood[1]);
  }
  function wineAt(m, cx, cy, z) {
    jar(m, cx - 0.12, cy - 0.08, z, 0.12, 5);
    jar(m, cx + 0.14, cy - 0.12, z, 0.085, 3.6);
    cup(m, cx - 0.1, cy + 0.2, z, PEWTER); cup(m, cx + 0.06, cy + 0.22, z, PEWTER); cup(m, cx + 0.22, cy + 0.16, z, PEWTER);
  }
  function chessAt(m, cx, cy, z) {
    var s = 0.58;
    m.box(cx - s / 2, cy - s / 2, z, s, s, 0.7, '#e0b872', { top: '#e8c888', topDeco: function (ctx, mm) {
      var i, k, z2 = z + 0.7;
      for (i = 0; i <= 4; i++) {
        k = -s / 2 + 0.06 + i * ((s - 0.12) / 4);
        A.line(ctx, mm.pt(cx - s / 2 + 0.06, cy + k, z2), mm.pt(cx + s / 2 - 0.06, cy + k, z2), C.wood[0], 0.6);
        A.line(ctx, mm.pt(cx + k, cy - s / 2 + 0.06, z2), mm.pt(cx + k, cy + s / 2 - 0.06, z2), C.wood[0], 0.6);
      }
      [[-0.12, -0.12, 0], [0.0, 0.0, 1], [0.12, -0.06, 0], [-0.06, 0.12, 1], [0.12, 0.12, 0]].forEach(function (p) {
        var q = mm.pt(cx + p[0], cy + p[1], z2);
        A.circle(ctx, q[0], q[1], 1.6, p[2] ? '#fffdf4' : C.lacquer, 0.6);
      });
    } });
  }
  function feastRing(m, cx, cy, z, r, n, off) {
    for (var i = 0; i < n; i++) {
      var a = off + i / n * Math.PI * 2;
      dish(m, cx + Math.cos(a) * r, cy + Math.sin(a) * r, z, FOOD[i % FOOD.length]);
    }
  }

  // ---------------- 桌類定義 ----------------
  function table(key, o) {
    def(key, {
      w: o.w, d: o.d, sym: !!o.sym, hmax: o.hmax || 32, shadow: o.round ? 'ellipse' : 'rect',
      build: function (m, v) {
        var z = BASE[o.style](m, v, o.w, o.d);
        if (o.items) o.items(m, o.w, o.d, z);
      },
      anim: o.steam ? function (ctx, m, t) { var p = m.pt(o.steam[0], o.steam[1], o.steam[2]); A.smoke(ctx, p[0], p[1], t, 2.7); } : undefined
    });
  }

  // 空桌
  table('tbl_wood', { w: 1, d: 1, sym: true, style: 'wood', hmax: 22 });
  table('tbl_stone', { w: 1, d: 1, sym: true, style: 'stone', hmax: 24 });
  table('tbl_low', { w: 1, d: 1, sym: true, style: 'low', hmax: 14 });
  table('tbl_long', { w: 2, d: 1, style: 'wood', hmax: 22 });
  table('tbl_big', { w: 2, d: 2, sym: true, style: 'wood', hmax: 22 });
  table('tbl_round', { w: 2, d: 2, sym: true, style: 'round', round: true, hmax: 24 });
  // 茶具
  table('tbl_tea', { w: 1, d: 1, sym: true, style: 'wood', steam: [0.4, 0.5, 21],
    items: function (m, W, D, z) { teaAt(m, 0.5, 0.5, z); } });
  table('tbl_tea_long', { w: 2, d: 1, style: 'wood', steam: [0.9, 0.5, 21],
    items: function (m, W, D, z) { teaAt(m, 0.5, 0.5, z); teaAt(m, 1.5, 0.5, z); } });
  // 碗盤菜餚
  table('tbl_meal', { w: 1, d: 1, sym: true, style: 'wood', hmax: 26,
    items: function (m, W, D, z) { mealAt(m, 0.5, 0.45, z); } });
  table('tbl_meal_long', { w: 2, d: 1, style: 'wood', hmax: 26,
    items: function (m, W, D, z) { mealAt(m, 0.5, 0.45, z); mealAt(m, 1.5, 0.45, z); dish(m, 1.0, 0.45, z, FOOD[2]); } });
  table('tbl_feast', { w: 2, d: 2, sym: true, style: 'round', round: true, hmax: 28,
    items: function (m, W, D, z) {
      m.cyl(1, 1, z, 0.2, 2.2, C.bronze, { topCol: '#b8602e', hoops: [1] });
      feastRing(m, 1, 1, z, 0.5, 6, 0.3);
      for (var i = 0; i < 6; i++) { var a = 0.6 + i / 6 * Math.PI * 2; bowl(m, 1 + Math.cos(a) * 0.76, 1 + Math.sin(a) * 0.76, z); }
    } });
  table('tbl_banquet', { w: 2, d: 2, sym: true, style: 'wood', hmax: 28,
    items: function (m, W, D, z) {
      [[0.55, 0.5, 0], [1.0, 0.45, 1], [1.45, 0.5, 2], [0.5, 1.0, 3], [1.5, 1.0, 4], [0.55, 1.5, 1], [1.0, 1.55, 0], [1.45, 1.5, 2]].forEach(function (p) { dish(m, p[0], p[1], z, FOOD[p[2]]); });
      jar(m, 1.0, 1.0, z, 0.13, 5.4);
      sticks(m, 0.55, 1.75, z); sticks(m, 1.45, 1.75, z);
    } });
  table('tbl_low_meal', { w: 1, d: 1, sym: true, style: 'low', hmax: 18,
    items: function (m, W, D, z) { dish(m, 0.32, 0.4, z, FOOD[0]); dish(m, 0.66, 0.36, z, FOOD[3]); bowl(m, 0.36, 0.7, z); bowl(m, 0.68, 0.68, z); } });
  // 書卷文具
  table('tbl_book', { w: 1, d: 1, sym: true, style: 'wood', hmax: 24,
    items: function (m, W, D, z) { booksAt(m, 0.3, 0.4, z); inkAt(m, 0.7, 0.65, z); scrollAt(m, 0.6, 0.3, z, 0.34); } });
  table('tbl_study', { w: 2, d: 1, style: 'wood', hmax: 24,
    items: function (m, W, D, z) { booksAt(m, 0.35, 0.4, z); scrollAt(m, 1.0, 0.45, z, 0.7); inkAt(m, 1.6, 0.6, z); booksAt(m, 1.75, 0.3, z); } });
  // 酒具
  table('tbl_wine', { w: 1, d: 1, sym: true, style: 'wood', hmax: 26,
    items: function (m, W, D, z) { wineAt(m, 0.5, 0.5, z); } });
  table('tbl_wine_long', { w: 2, d: 1, style: 'wood', hmax: 26,
    items: function (m, W, D, z) { wineAt(m, 0.5, 0.5, z); wineAt(m, 1.5, 0.5, z); dish(m, 1.0, 0.5, z, FOOD[3]); } });
  // 棋盤
  table('tbl_chess', { w: 1, d: 1, sym: true, style: 'wood', hmax: 22,
    items: function (m, W, D, z) { chessAt(m, 0.5, 0.5, z); } });

  // ---------------- 座椅 ----------------
  def('stool_wood', {
    w: 1, d: 1, sym: true, hmax: 16, shadow: 'ellipse',
    build: function (m, v) {
      var sn = snowOn(v);
      [0.26, 0.74].forEach(function (u) { [0.26, 0.74].forEach(function (w) { leg(m, u, w, 0, 7, C.wood[0]); }); });
      m.box(0.2, 0.2, 5, 0.6, 0.6, 1.4, C.wood[1]);
      m.box(0.15, 0.15, 7, 0.7, 0.7, 2, C.wood[2], { top: sn || A.tone(C.wood[2], 1.06) });
    }
  });
  def('cushion_round', {
    w: 1, d: 1, sym: true, hmax: 9, shadow: 'ellipse',
    build: function (m, v) {
      var sn = snowOn(v);
      m.cyl(0.5, 0.5, 0, 0.33, 3.2, '#c9a14a', { topCol: sn || '#e6c670', hoops: [1.6] });
      if (!sn) m.custom(0.3, 0.3, 0.4, 0.4, 3.4, function (ctx, mm) {
        var c = mm.pt(0.5, 0.5, 3.4); A.circle(ctx, c[0], c[1], 1.6, '#8a5a2a', 0.5);
      });
    }
  });
  def('chair_wood', {
    w: 1, d: 1, hmax: 34, shadow: 'ellipse',
    build: function (m, v) {
      var sn = snowOn(v), i;
      leg(m, 0.16, 0.84, 0, 9, C.wood[0]); leg(m, 0.84, 0.84, 0, 9, C.wood[0]);
      leg(m, 0.16, 0.2, 0, 9, C.wood[0]); leg(m, 0.84, 0.2, 0, 9, C.wood[0]);
      m.box(0.1, 0.14, 9, 0.8, 0.76, 1.8, C.wood[2], { top: sn || A.tone(C.wood[2], 1.08) });
      m.box(0.11, 0.11, 10.8, 0.08, 0.08, 19, C.wood[0]); m.box(0.81, 0.11, 10.8, 0.08, 0.08, 19, C.wood[0]);
      m.box(0.09, 0.09, 28, 0.82, 0.12, 2.6, C.wood[1], { top: sn || C.wood[2] });
      m.box(0.15, 0.11, 16, 0.7, 0.07, 1.6, C.wood[1]);
      for (i = 0; i < 3; i++) m.box(0.3 + i * 0.2, 0.12, 17.6, 0.05, 0.05, 10, C.wood[1]);
    }
  });
  def('chair_taishi', {
    w: 1, d: 1, hmax: 38, shadow: 'ellipse',
    build: function (m, v) {
      var sn = snowOn(v), RED = '#7a2a22', RED_LT = '#a8483a';
      leg(m, 0.16, 0.84, 0, 9, RED); leg(m, 0.84, 0.84, 0, 9, RED); leg(m, 0.16, 0.2, 0, 9, RED); leg(m, 0.84, 0.2, 0, 9, RED);
      m.box(0.08, 0.12, 9, 0.84, 0.8, 2.2, RED_LT, { top: sn || '#c8604a', topDeco: function (ctx, mm) {
        if (sn) return;
        A.line(ctx, mm.pt(0.18, 0.25, 11.2), mm.pt(0.82, 0.25, 11.2), C.gold, 0.6);
        A.line(ctx, mm.pt(0.18, 0.85, 11.2), mm.pt(0.82, 0.85, 11.2), C.gold, 0.6);
      } });
      m.box(0.1, 0.1, 11.2, 0.8, 0.12, 20, RED, { top: sn || RED_LT, deco: { F: function (ctx, f) {
        A.poly(ctx, A.quad(f, 0.18, 0.82, 14, 28), '#4a1812', 0.5);
        var q = f.pt(0.5, 21); A.circle(ctx, q[0], q[1], 2.6, C.gold, 0.5);
      } } });
      m.box(0.06, 0.14, 15, 0.1, 0.72, 1.8, RED_LT, { top: sn || '#c8604a' });
      m.box(0.84, 0.14, 15, 0.1, 0.72, 1.8, RED_LT, { top: sn || '#c8604a' });
      m.box(0.08, 0.14, 11.2, 0.06, 0.06, 4, RED); m.box(0.86, 0.14, 11.2, 0.06, 0.06, 4, RED);
      m.box(0.08, 0.76, 11.2, 0.06, 0.06, 4, RED); m.box(0.86, 0.76, 11.2, 0.06, 0.06, 4, RED);
      m.cyl(0.11, 0.8, 16.8, 0.05, 1.4, C.gold, { topCol: C.gold }); m.cyl(0.89, 0.8, 16.8, 0.05, 1.4, C.gold, { topCol: C.gold });
    }
  });

  // ---------------- 組合補件 ----------------
  // 曬穀場 2x1:乾淨的曬席,席上攤開的穀粒與一把木耙
  def('grain_drying', {
    w: 2, d: 1, hmax: 12, shadow: 'rect',
    build: function (m, v) {
      m.box(0.04, 0.06, 0, 1.92, 0.88, 1, '#e8d27a', { topDeco: function (ctx, mm) {
        for (var i = 1; i < 12; i++) { var k = 0.04 + i * 0.16; A.line(ctx, mm.pt(k, 0.08, 1), mm.pt(k, 0.92, 1), C.wood[2], 0.5); }
      } });
      m.custom(0.1, 0.1, 1.8, 0.8, 1, function (ctx, mm) {
        var r = A.rng(7), i;
        for (i = 0; i < 28; i++) {
          var p = mm.pt(0.15 + r() * 1.7, 0.15 + r() * 0.7, 1.2);
          A.ellipse(ctx, p[0], p[1], 2.2, 1.1, i % 3 ? '#e6bd4a' : '#d8a630');
        }
      });
      m.cone(1.3, 0.4, 1, 0.26, 3, '#e6bd4a', { topCol: '#f0cc5a' });
      m.custom(0.3, 0.3, 0.6, 0.5, 1, function (ctx, mm) {
        A.line(ctx, mm.pt(0.35, 0.75, 1.6), mm.pt(0.82, 0.55, 5.5), C.wood[1], 1.4);
        A.line(ctx, mm.pt(0.3, 0.8, 1.2), mm.pt(0.5, 0.88, 1.2), C.wood[0], 1.6);
      });
    }
  });
  // 燈籠柱 1x1:木柱挑出橫臂,懸一盞紅燈籠
  def('lantern_post', {
    w: 1, d: 1, sym: true, hmax: 60, shadow: 'ellipse',
    build: function (m) {
      m.box(0.38, 0.38, 0, 0.24, 0.24, 4, C.stone[1], { top: C.stone[2] });
      m.box(0.45, 0.45, 4, 0.1, 0.1, 36, C.wood[1], { top: C.wood[2] });
      m.custom(0.1, 0.1, 0.8, 0.8, 40, function (ctx, mm) {
        var a = mm.pt(0.5, 0.5, 38), b = mm.pt(0.82, 0.5, 38);
        A.line(ctx, a, b, C.ink, 3); A.line(ctx, a, b, C.wood[0], 1.8);
        A.lantern(ctx, b[0], b[1], 1.3);
      }, 2);
    },
    lights: function () { return [[0.82, 0.5, 32, 42, C.lantern, 0.9]]; }
  });
  // 營帳 2x2:小型尖頂帳篷,帳門在正面,頂端一面小旗
  def('tent_small', {
    w: 2, d: 2, hmax: 58, shadow: 'rect',
    build: function (m, v) {
      var sn = snowOn(v), CL = '#d8c9a2', CL_DK = '#a8966a';
      m.box(0.12, 0.2, 0, 1.76, 1.6, 6, CL, { top: CL_DK });
      m.gable(0.12, 0.2, 6, 1.76, 1.6, 16, sn || CL, { over: 0.1, axis: 'u', ridgeCol: CL_DK });
      m.box(0.78, 1.78, 0, 0.44, 0.06, 12, '#4a3a2a', { top: '#4a3a2a' });
      m.custom(0, 0, 2, 2, 20, function (ctx, mm) {
        var p = mm.pt(1, 1, 22), q = mm.pt(1, 1, 38);
        A.line(ctx, p, q, C.wood[0], 1.5);
        A.poly(ctx, [q, [q[0] + 9, q[1] + 2.5], [q[0], q[1] + 5.5]], C.hanRed, 0.5);
      }, 2);
    }
  });
  // 石獅 1x1:方石座上的蹲獅(面朝正面),鬃毛與寶珠
  def('stone_lion', {
    w: 1, d: 1, hmax: 44, shadow: 'ellipse',
    build: function (m, v) {
      var sn = snowOn(v), S1 = C.stone[1], S2 = C.stone[2], S0 = C.stone[0];
      m.box(0.1, 0.1, 0, 0.8, 0.8, 4, S0, { top: sn || S1, deco: { F: function (ctx, f) { A.band(ctx, f, 1.2, 2.4, S2); } } });
      m.box(0.28, 0.14, 4, 0.44, 0.46, 9, S1, { top: sn || S2 });
      m.box(0.3, 0.48, 4, 0.4, 0.26, 10, S1, { top: sn || S2 });
      m.cyl(0.5, 0.62, 13, 0.24, 8, S2, { topCol: sn || S2, hoops: [2.5] });
      m.cyl(0.5, 0.62, 21, 0.17, 3, S1, { topCol: sn || S2 });
      m.custom(0.2, 0.4, 0.6, 0.5, 14, function (ctx, mm) {
        [[0.42, 0.82], [0.58, 0.82]].forEach(function (e) { var p = mm.pt(e[0], e[1], 17.5); A.circle(ctx, p[0], p[1], 1.1, C.ink, 0.2); });
        var a = mm.pt(0.44, 0.84, 14.5), b = mm.pt(0.56, 0.84, 14.5);
        A.line(ctx, a, b, S0, 1.2);
        var g = mm.pt(0.5, 0.78, 10); A.circle(ctx, g[0], g[1], 2.4, C.gold, 0.5);
      }, 2);
    }
  });
  // 影壁 2x1:磚牆身 + 紅底金紋中心 + 青瓦壓頂 + 石基,立在大門內側
  def('spirit_wall', {
    w: 2, d: 1, hmax: 56, shadow: 'rect',
    build: function (m, v) {
      var sn = snowOn(v);
      var panel = function (ctx, f) {
        A.poly(ctx, A.quad(f, 0.16, 0.84, 5, 17), '#b83a34', 0.5);
        A.poly(ctx, A.quad(f, 0.2, 0.8, 7, 15), '#8f2a26', 0.4);
        var q = f.pt(0.5, 11); A.circle(ctx, q[0], q[1], 3.4, C.gold, 0.5);
        A.circle(ctx, q[0], q[1], 1.5, '#b83a34', 0.4);
      };
      m.box(0.02, 0.32, 0, 1.96, 0.36, 3, C.stone[1], { top: C.stone[2] });
      m.box(0.08, 0.36, 3, 1.84, 0.28, 19, '#cfc7b5', { top: '#bdb5a3', deco: { F: panel, B: panel } });
      m.box(0.0, 0.34, 3, 0.14, 0.32, 20, C.stone[2], { top: C.stone[2] });
      m.box(1.86, 0.34, 3, 0.14, 0.32, 20, C.stone[2], { top: C.stone[2] });
      m.gable(0, 0.3, 23, 2, 0.4, 5, sn || '#6f7f88', { over: 0.08, axis: 'u', ridgeCol: '#4d5c64' });
    }
  });

  // ---------------- OBJECTS 登記 ----------------
  function item(name, icon, w, h, coin, o) {
    o = o || {};
    var r = {
      name: name, icon: icon, w: w, h: h, on: o.on || [T_GRASS, T_ROAD],
      cost: { coin: coin }, side: 'estate',
      cb: { block: 'none', hp: null, cat: null }
    };
    if (o.drag) r.drag = true;
    if (w !== h) r.swap = true;
    return r;
  }
  var DEF_ITEMS = {
    tbl_wood: item('空木桌', '🟫', 1, 1, 20, { drag: true }),
    tbl_stone: item('空石桌', '⬜', 1, 1, 25, { drag: true }),
    tbl_low: item('矮几', '🟤', 1, 1, 15, { drag: true }),
    tbl_long: item('空長案', '▭', 2, 1, 35),
    tbl_big: item('大方桌', '🔲', 2, 2, 70),
    tbl_round: item('大圓桌', '⭕', 2, 2, 80),
    tbl_tea: item('茶桌(擺茶具)', '🫖', 1, 1, 35, { drag: true }),
    tbl_tea_long: item('茶案(長)', '🍵', 2, 1, 60),
    tbl_meal: item('飯桌(擺碗盤)', '🍚', 1, 1, 35, { drag: true }),
    tbl_meal_long: item('食案長桌', '🍱', 2, 1, 60),
    tbl_feast: item('宴席圓桌', '🍲', 2, 2, 140),
    tbl_banquet: item('宴席方桌', '🍖', 2, 2, 150),
    tbl_low_meal: item('矮几餐桌', '🥢', 1, 1, 30, { drag: true }),
    tbl_book: item('書案(書卷文具)', '📚', 1, 1, 40, { drag: true }),
    tbl_study: item('大書案', '📜', 2, 1, 70),
    tbl_wine: item('酒桌(擺酒具)', '🍶', 1, 1, 40, { drag: true }),
    tbl_wine_long: item('酒席長桌', '🍻', 2, 1, 70),
    tbl_chess: item('棋桌(擺棋盤)', '♟️', 1, 1, 40, { drag: true }),
    stool_wood: item('木凳', '🪑', 1, 1, 12, { drag: true }),
    cushion_round: item('蒲團', '🟡', 1, 1, 10, { drag: true }),
    chair_wood: item('木椅', '💺', 1, 1, 20, { drag: true }),
    chair_taishi: item('太師椅', '👑', 1, 1, 60, { drag: true }),
    grain_drying: item('曬穀場', '🌾', 2, 1, 30),
    lantern_post: item('燈籠柱', '🏮', 1, 1, 30, { drag: true }),
    tent_small: item('營帳(小)', '⛺', 2, 2, 90),
    stone_lion: item('石獅', '🦁', 1, 1, 80, { drag: true }),
    spirit_wall: item('影壁', '🧱', 2, 1, 120)
  };
  Object.keys(DEF_ITEMS).forEach(function (k) { ITEMS[k] = DEF_ITEMS[k]; });
  if (typeof OBJECTS !== 'undefined' && typeof T_GRASS !== 'undefined') {
    Object.keys(ITEMS).forEach(function (k) { if (!OBJECTS[k]) OBJECTS[k] = ITEMS[k]; });
  }
  A.SET_ITEMS = ITEMS;
})(ART);
