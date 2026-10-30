// art_deco2.js — 裝飾二:農牧、動物、農具、運輸(PLAN_ART_STYLE §3.4)。依賴 art.js、art_objects.js、art_units.js 先載入。
// 既有 ART.OBJ 的同名定義(ox、horse、millstone、oxcart、stable、woodpile、haystack、well…)不覆寫,只在 OBJECTS 登錄。

(function (A) {
  var C = A.C, OBJ = A.OBJ;

  function spec(w, d, hmax, build, o) {
    o = o || {};
    return { w: w, d: d, hmax: hmax, build: build, sym: o.sym, shadow: o.shadow, lights: o.lights, anim: o.anim };
  }
  // 包裝既有 ART.OBJ 的建造函式:只換參數,不改原定義
  function alias(key, base, w, d, hmax, mapV) {
    var b = OBJ[base];
    A.def(key, spec(w, d, hmax, function (m, v) { b.build(m, mapV(v || {})); }, {
      sym: b.sym, shadow: b.shadow,
      lights: b.lights ? function (v) { return b.lights(mapV(v || {})); } : undefined
    }));
  }
  function gnd(v) { return (A.GROUND[v.season] || A.GROUND.spring)[1]; }
  function snowOn(v) { return v.season === 'winter'; }

  // 車輪:plane 'v' 為側面輪(展開於 v-z 平面),'u' 為正面輪(展開於 u-z 平面)
  function wheel(ctx, m, u, v, z, r, plane, col) {
    A.disc(ctx, m, u, v, z, r, plane, col);
    A.disc(ctx, m, u, v, z, r * 0.72, plane, A.tone(col, 0.8), 0.4);
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 4, c = Math.cos(a) * r / 34, s = Math.sin(a) * r;
      var p = plane === 'u' ? m.pt(u + c, v, z + s) : m.pt(u, v + c, z + s);
      var q = plane === 'u' ? m.pt(u - c, v, z - s) : m.pt(u, v - c, z - s);
      A.line(ctx, p, q, C.wood[0], 1.2);
    }
    var h = m.pt(u, v, z); A.circle(ctx, h[0], h[1], 1.8, C.gold, 0.6);
  }
  function addWheel(m, u, v, z, r, plane, col) {
    var k = r / 34;
    var rect = plane === 'u' ? [u - k, v - 0.03, 2 * k, 0.06] : [u - 0.03, v - k, 0.06, 2 * k];
    m.custom(rect[0], rect[1], rect[2], rect[3], z - r, function (ctx, mm) { wheel(ctx, mm, u, v, z, r, plane, col); });
  }

  // 作物畹:土床 + 排列的株點;season 決定顏色,winter 改畫雪點
  function beds(m, u0, v0, u1, v1, season, leaf, flower) {
    m.custom(u0, v0, u1 - u0, v1 - v0, 0, function (ctx, mm) {
      var soil = season === 'winter' ? '#c9b89a' : '#9a6a3c';
      A.poly(ctx, [mm.pt(u0, v0, 2), mm.pt(u1, v0, 2), mm.pt(u1, v1, 2), mm.pt(u0, v1, 2)], soil, 0.5);
      for (var v = v0 + 0.2; v < v1 - 0.1; v += 0.25) A.line(ctx, mm.pt(u0 + 0.05, v, 3), mm.pt(u1 - 0.05, v, 3), '#7d5230', 1.2);
      for (var x = u0 + 0.2; x < u1 - 0.1; x += 0.3) for (var y = v0 + 0.2; y < v1 - 0.1; y += 0.25) {
        var p = mm.pt(x, y, 4);
        if (season === 'winter') A.ellipse(ctx, p[0], p[1], 2.4, 1.4, C.snow);
        else {
          A.circle(ctx, p[0], p[1] - 1.5, 2.6, season === 'autumn' ? '#c9a238' : leaf, 0.5);
          if (flower && season !== 'winter') A.circle(ctx, p[0] + 1.4, p[1] - 3.2, 1, flower);
        }
      }
    });
  }

  // ---------- 既有定義的別名(只登錄,換參數) ----------
  alias('cart_hay', 'cart', 1, 2, 50, function (v) { return { skin: 'hay', season: v.season }; });
  alias('cart_goods', 'cart', 1, 2, 50, function (v) { return { skin: 'goods', season: v.season }; });
  alias('cart_empty', 'cart', 1, 2, 30, function (v) { return { skin: 'empty', season: v.season }; });
  alias('grain_sacks', 'sacks', 1, 1, 40, function (v) { return { level: v.level || 3, skin: 'rice', season: v.season }; });
  alias('granary_round', 'granary', 1, 1, 54, function (v) { return { season: v.season }; });
  alias('barrel_water', 'barrel', 1, 1, 26, function (v) { return { level: 2, skin: 'water', season: v.season }; });
  alias('barrel_empty', 'barrel', 1, 1, 26, function (v) { return { level: 2, skin: 'empty', season: v.season }; });
  alias('field_millet', 'field', 2, 2, 30, function (v) { return { season: v.season }; });
  alias('field_sprout', 'field', 2, 2, 30, function (v) { return { level: 2, season: v.season }; });
  alias('field_wheat', 'field', 2, 2, 30, function (v) { return { level: 4, season: v.season }; });
  alias('ranch_fence', 'fence', 1, 1, 30, function (v) { return { season: v.season }; });

  // ---------- 運輸 ----------
  A.def('handcart', spec(1, 1, 24, function (m, v) {
    m.box(0.12, 0.3, 7, 0.76, 0.5, 5, C.wood[1], { top: C.wood[2] });
    m.custom(0.1, 0.0, 0.8, 0.3, 8, function (ctx, mm) {
      [0.2, 0.8].forEach(function (u) { A.line(ctx, mm.pt(u, 0.8, 10), mm.pt(u, 0.02, 9), C.ink, 3.2); A.line(ctx, mm.pt(u, 0.8, 10), mm.pt(u, 0.02, 9), C.wood[2], 1.6); });
    });
    addWheel(m, 0.5, 0.92, 8, 8, 'u', C.wood[1]);
  }));
  A.def('wheelbarrow', spec(1, 1, 20, function (m, v) {
    m.box(0.22, 0.25, 6, 0.56, 0.5, 5, C.wood[1], { top: C.wood[2] });
    m.custom(0.28, 0.0, 0.44, 0.3, 7, function (ctx, mm) {
      [0.3, 0.7].forEach(function (u) { A.line(ctx, mm.pt(u, 0.25, 8), mm.pt(u, 0.02, 11), C.ink, 3); A.line(ctx, mm.pt(u, 0.25, 8), mm.pt(u, 0.02, 11), C.wood[2], 1.5); });
    });
    addWheel(m, 0.5, 0.82, 6, 6, 'u', C.wood[0]);
  }));
  A.def('waterwheel', spec(1, 2, 50, function (m, v) {
    var wz = 26, wv = 1.0, wr = 22;
    m.box(0.3, 0.1, 0, 0.4, 1.8, 4, C.stone[1], { top: C.stone[2] });
    m.box(0.42, 0.12, 0, 0.16, 0.16, wz + 4, C.wood[1]);
    m.box(0.42, 1.72, 0, 0.16, 0.16, wz + 4, C.wood[1]);
    m.box(0.44, 0.7, wz - 2, 0.12, 0.6, 4, C.wood[0]);
    m.custom(0.47, wv - wr / 34, 0.06, 2 * wr / 34, wz - wr, function (ctx, mm) {
      A.disc(ctx, mm, 0.5, wv, wz, wr, 'v', C.wood[1]);
      A.disc(ctx, mm, 0.5, wv, wz, wr * 0.8, 'v', A.tone(C.wood[1], 0.85), 0.5);
    }, 1);
  }, {
    anim: function (ctx, m, t) {
      var c = m.pt(0.5, 1.0, 26);
      for (var k = 0; k < 6; k++) {
        var a = t * 1.4 + k * Math.PI / 3;
        A.line(ctx, c, m.pt(0.5, 1.0 + Math.cos(a) * 22 / 34, 26 + Math.sin(a) * 22), C.wood[2], 2.2);
      }
    }
  }));
  A.def('well_sweep', spec(2, 1, 56, function (m, v) {
    m.box(0.16, 0.42, 0, 0.16, 0.16, 4, C.stone[1]);
    m.box(0.2, 0.42, 0, 0.1, 0.16, 48, C.wood[1]);
    m.box(0.2, 0.42, 44, 0.1, 0.16, 6, C.wood[2]);
    m.box(0.06, 0.42, 36, 0.14, 0.16, 8, C.stone[1]);
    m.custom(0.2, 0.42, 1.7, 0.16, 46, function (ctx, mm) {
      var a = mm.pt(0.25, 0.5, 46), b = mm.pt(1.8, 0.5, 50);
      A.line(ctx, a, b, C.ink, 4.4); A.line(ctx, a, b, C.wood[2], 2.4);
      A.line(ctx, mm.pt(1.8, 0.5, 50), mm.pt(1.8, 0.5, 16), C.ink, 1);
    });
    m.cyl(1.8, 0.5, 6, 0.14, 10, C.wood[1], { topCol: C.water[1], hoops: [2, 7] });
  }, { }));
  A.def('salt_pile', spec(1, 1, 20, function (m, v) {
    m.cone(0.5, 0.5, 0, 0.36, 18, '#f4f6f2');
    m.custom(0.3, 0.3, 0.4, 0.4, 16, function (ctx, mm) {
      [[0.42, 0.44], [0.58, 0.5], [0.5, 0.36]].forEach(function (p) { var q = mm.pt(p[0], p[1], 16); A.ellipse(ctx, q[0], q[1], 1.6, 1, '#ffffff'); });
    });
  }, { sym: true, shadow: 'ellipse' }));
  A.def('saltfield', spec(2, 2, 6, function (m, v) {
    m.custom(0, 0, 2, 2, 0, function (ctx, mm) {
      for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
        var u0 = 0.1 + i * 0.66, v0 = 0.1 + j * 0.66;
        A.poly(ctx, [mm.pt(u0, v0, 1), mm.pt(u0 + 0.6, v0, 1), mm.pt(u0 + 0.6, v0 + 0.6, 1), mm.pt(u0, v0 + 0.6, 1)], '#bfe3ee', 0.6);
        var c = mm.pt(u0 + 0.3, v0 + 0.3, 2); A.circle(ctx, c[0], c[1], 1.8, '#ffffff', 0.3);
      }
    });
  }));
  A.def('fishery', spec(2, 2, 46, function (m, v) {
    var snow = snowOn(v);
    m.custom(0, 0, 2, 2, -4, function (ctx, mm) {
      A.poly(ctx, [mm.pt(0, 0, 0), mm.pt(2, 0, 0), mm.pt(2, 2, 0), mm.pt(0, 2, 0)], snow ? '#cfe6f2' : C.water[0], 0.4);
    }, -10);
    [[0.1, 0.1], [1.7, 0.1], [0.1, 1.7], [1.7, 1.7]].forEach(function (p) { m.box(p[0], p[1], 0, 0.14, 0.14, 6, C.wood[0]); });
    m.box(0.1, 0.1, 6, 1.8, 1.8, 3, C.wood[1], { top: C.wood[2] });
    m.box(0.3, 0.3, 9, 1.4, 1.4, 12, C.wood[1], { top: C.wood[2] });
    m.hip(0.2, 0.2, 21, 1.6, 1.6, 12, C.tile, { over: 0.2, curl: 2, sag: 1, ridgeCol: C.tileDk, snow: snow, hooks: false });
  }, {
    lights: function () { return [[0.8, 1.72, 14, 18, C.lamp, 0.6, 'F']]; }
  }));
  A.def('fish_rack', spec(1, 1, 30, function (m, v) {
    m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
      [0.15, 0.85].forEach(function (u) { A.line(ctx, mm.pt(u, 0.5, 0), mm.pt(u, 0.5, 28), C.ink, 3.4); A.line(ctx, mm.pt(u, 0.5, 0), mm.pt(u, 0.5, 28), C.wood[1], 1.8); });
      A.line(ctx, mm.pt(0.15, 0.5, 27), mm.pt(0.85, 0.5, 27), C.ink, 3.2); A.line(ctx, mm.pt(0.15, 0.5, 27), mm.pt(0.85, 0.5, 27), C.wood[2], 1.6);
      [0.3, 0.5, 0.7].forEach(function (u) { var p = mm.pt(u, 0.5, 20); A.ellipse(ctx, p[0], p[1], 3.2, 6, '#d9a878', 0.6); });
    });
  }));
  A.def('winnower', spec(1, 1, 26, function (m, v) {
    m.box(0.12, 0.2, 2, 0.76, 0.6, 14, C.wood[1], { top: C.wood[2] });
    m.custom(0.2, 0.2, 0.6, 0.6, 16, function (ctx, mm) {
      A.poly(ctx, [mm.pt(0.2, 0.2, 16), mm.pt(0.8, 0.2, 16), mm.pt(0.7, 0.8, 24), mm.pt(0.3, 0.8, 24)], C.wood[2], 0.6);
    });
    addWheel(m, 0.92, 0.5, 9, 6, 'v', C.wood[0]);
  }));

  // ---------- 農具 ----------
  A.def('plow', spec(1, 1, 16, function (m, v) {
    m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
      var a = mm.pt(0.5, 0.05, 3), b = mm.pt(0.5, 0.82, 6), c = mm.pt(0.5, 0.02, 14);
      A.line(ctx, a, b, C.ink, 5); A.line(ctx, a, b, C.wood[1], 2.6);
      A.line(ctx, a, c, C.ink, 4); A.line(ctx, a, c, C.wood[2], 2);
      A.poly(ctx, [mm.pt(0.36, 0.78, 3), mm.pt(0.64, 0.78, 3), mm.pt(0.6, 1.0, 1), mm.pt(0.4, 1.0, 1)], '#9aa4ac', 0.8);
    });
  }));
  A.def('hoe', spec(1, 1, 20, function (m, v) {
    m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
      var a = mm.pt(0.5, 0.4, 2), b = mm.pt(0.5, 0.7, 18);
      A.line(ctx, a, b, C.ink, 3.6); A.line(ctx, a, b, C.wood[2], 1.8);
      A.poly(ctx, [mm.pt(0.36, 0.38, 1), mm.pt(0.64, 0.38, 1), mm.pt(0.6, 0.44, 4), mm.pt(0.4, 0.44, 4)], '#aab5be', 0.9);
    });
  }));
  A.def('trough', spec(1, 1, 12, function (m, v) {
    m.box(0.08, 0.2, 0, 0.84, 0.6, 7, C.wood[1], {
      top: C.wood[2],
      topDeco: function (ctx, mm) {
        A.poly(ctx, [mm.pt(0.16, 0.3, 7), mm.pt(0.84, 0.3, 7), mm.pt(0.84, 0.7, 7), mm.pt(0.16, 0.7, 7)], '#4a2e1c', 0.5);
        A.poly(ctx, [mm.pt(0.2, 0.35, 7.5), mm.pt(0.8, 0.35, 7.5), mm.pt(0.8, 0.65, 7.5), mm.pt(0.2, 0.65, 7.5)], C.thatch, 0.4);
      }
    });
  }));
  A.def('fodder', spec(1, 1, 44, function (m, v) {
    var o = {
      top: C.thatchDk,
      deco: { F: function (ctx, f) { A.band(ctx, f, 6, 7.5, C.thatchDk); A.band(ctx, f, 14, 15.5, C.thatchDk); }, R: function (ctx, f) { A.band(ctx, f, 6, 7.5, C.thatchDk); } }
    };
    if (snowOn(v)) o.topDeco = function (ctx, mm) { A.poly(ctx, [mm.pt(0.1, 0.1, 22), mm.pt(0.9, 0.1, 22), mm.pt(0.9, 0.9, 22), mm.pt(0.1, 0.9, 22)], C.snow, 0.3); };
    m.box(0.1, 0.1, 0, 0.8, 0.8, 22, C.thatch, o);
  }));
  // ---------- 牧場、動物、林園 ----------
  A.def('sheepfold', spec(2, 2, 30, function (m, v) {
    var snow = snowOn(v);
    m.custom(0, 0, 2, 2, 0, function (ctx, mm) {
      A.poly(ctx, [mm.pt(0.05, 0.05, 0), mm.pt(1.95, 0.05, 0), mm.pt(1.95, 1.95, 0), mm.pt(0.05, 1.95, 0)], snow ? C.snow : '#9bd16a', 0.4);
    }, -10);
    m.custom(0, 0, 2, 2, 0, function (ctx, mm) {
      [[0.1, 0.1, 1.9, 0.1], [0.1, 0.1, 0.1, 1.9]].forEach(function (s) {
        [7, 13].forEach(function (z) { A.line(ctx, mm.pt(s[0], s[1], z), mm.pt(s[2], s[3], z), C.ink, 3); A.line(ctx, mm.pt(s[0], s[1], z), mm.pt(s[2], s[3], z), C.wood[2], 1.6); });
      });
    }, -5);
    [[0.08, 0.08], [1.84, 0.08], [0.08, 1.84], [1.84, 1.84]].forEach(function (p) { m.box(p[0], p[1], 0, 0.1, 0.1, 15, C.wood[1]); });
    m.place('trough', 0.7, 0.05, 0, {});
    m.place('sheep', 0.5, 0.9, 0, {});
    m.place('sheep', 1.1, 1.2, 0, {});
    m.place('sheep', 0.6, 1.4, 0, {});
    m.custom(0, 0, 2, 2, 0, function (ctx, mm) {
      [[1.9, 0.1, 1.9, 1.9], [1.9, 1.9, 0.1, 1.9]].forEach(function (s) {
        [7, 13].forEach(function (z) { A.line(ctx, mm.pt(s[0], s[1], z), mm.pt(s[2], s[3], z), C.ink, 3); A.line(ctx, mm.pt(s[0], s[1], z), mm.pt(s[2], s[3], z), C.wood[2], 1.6); });
      });
    }, 5);
  }));
  function grove(kind, n) {
    return function (m, v) {
      m.custom(0, 0, 2, 2, 0, function (ctx, mm) {
        A.poly(ctx, [mm.pt(0, 0, 0), mm.pt(2, 0, 0), mm.pt(2, 2, 0), mm.pt(0, 2, 0)], gnd(v), 0.3);
      }, -10);
      var pos = [[0.45, 0.45], [1.45, 0.45], [0.45, 1.45], [1.45, 1.45]];
      for (var i = 0; i < n; i++) m.place('tree', pos[i][0], pos[i][1], 0, { kind: kind, seed: i + 3, season: v.season });
    };
  }
  A.def('mulberry_grove', spec(2, 2, 50, grove('mulberry', 4)));
  A.def('orchard', spec(2, 2, 46, grove('sakura', 4)));
  A.def('vegetable_plot', spec(2, 1, 12, function (m, v) {
    beds(m, 0.1, 0.12, 1.9, 0.44, v.season, '#8ed259', null);
    beds(m, 0.1, 0.56, 1.9, 0.88, v.season, '#5aa83a', '#f2e27a');
  }));
  A.def('herb_garden', spec(2, 1, 12, function (m, v) {
    beds(m, 0.1, 0.12, 1.9, 0.44, v.season, '#6cb86a', '#c58ae0');
    beds(m, 0.1, 0.56, 1.9, 0.88, v.season, '#4f9e62', '#f2d24a');
  }));
  A.def('tea_garden', spec(2, 2, 20, function (m, v) {
    [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]].forEach(function (p) {
      m.cone(p[0], p[1], 0, 0.42, 12, v.season === 'winter' ? C.snow : '#3f9a4a');
    });
  }));
  A.def('beehive', spec(1, 1, 20, function (m, v) {
    m.cyl(0.32, 0.5, 0, 0.17, 15, C.thatch, { topCol: C.thatchDk, hoops: [4, 10] });
    m.cyl(0.7, 0.5, 0, 0.17, 15, C.thatch, { topCol: C.thatchDk, hoops: [4, 10] });
    m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
      [0.32, 0.7].forEach(function (u) { var p = mm.pt(u, 0.68, 5); A.ellipse(ctx, p[0], p[1], 3, 2, '#3a2414'); });
    });
  }, {
    anim: function (ctx, m, t) {
      var p = m.pt(0.5, 0.5, 14);
      for (var i = 0; i < 3; i++) { var a = t * 3 + i * 2.1; A.circle(ctx, p[0] + Math.cos(a) * 18, p[1] - 6 + Math.sin(a * 1.3) * 6, 1.4, '#ffd24a', 0.4); }
    }
  }));

  // ---------- 水上與採收 ----------
  // 輸出:OBJECTS 登錄(只新增 key;既有 OBJECTS 17 項不動)
  var NEW = {
    millstone:      { name: '石磨', icon: '🪨', w: 1, h: 1, cost: { coin: 90 } },
    handcart:       { name: '推車', icon: '🛒', w: 1, h: 1, cost: { coin: 20 } },
    cart_hay:       { name: '草推車(載乾草)', icon: '🌾', w: 1, h: 2, swap: true, cost: { coin: 60 } },
    cart_goods:     { name: '貨車', icon: '🚚', w: 1, h: 2, swap: true, cost: { coin: 80 } },
    cart_empty:     { name: '板車', icon: '🛞', w: 1, h: 2, swap: true, cost: { coin: 35 } },
    oxcart:         { name: '牛車', icon: '🐂', w: 1, h: 3, swap: true, cost: { coin: 150 } },
    wheelbarrow:    { name: '獨輪車', icon: '🛞', w: 1, h: 1, cost: { coin: 25 } },
    plow:           { name: '耕犁', icon: '🌱', w: 1, h: 1, cost: { coin: 40 } },
    hoe:            { name: '鋤頭', icon: '⛏️', w: 1, h: 1, cost: { coin: 20 } },
    ox:             { name: '牛', icon: '🐂', w: 1, h: 1, cost: { coin: 80 } },
    horse:          { name: '馬', icon: '🐴', w: 1, h: 1, cost: { coin: 120 } },
    duck:           { name: '鴨', icon: '🦆', w: 1, h: 1, cost: { coin: 25 } },
    chicken:        { name: '雞', icon: '🐔', w: 1, h: 1, cost: { coin: 20 } },
    sheep:          { name: '羊', icon: '🐑', w: 1, h: 1, cost: { coin: 40 } },
    pig:            { name: '豬', icon: '🐖', w: 1, h: 1, cost: { coin: 40 } },
    dog:            { name: '狗', icon: '🐕', w: 1, h: 1, cost: { coin: 30 } },
    donkey:         { name: '驢', icon: '🫏', w: 1, h: 1, cost: { coin: 60 } },
    goose:          { name: '鵝', icon: '🦢', w: 1, h: 1, cost: { coin: 30 } },
    cat:            { name: '貓', icon: '🐈', w: 1, h: 1, cost: { coin: 20 } },
    stable:         { name: '馬房', icon: '🐎', w: 3, h: 2, swap: true, cost: { coin: 200, wood: 60 } },
    sheepfold:      { name: '羊圈(牧場)', icon: '🐑', w: 2, h: 2, cost: { coin: 90 } },
    ranch_fence:    { name: '牧場圍欄', icon: '🪵', w: 1, h: 1, cost: { coin: 20 } },
    trough:         { name: '飼槽', icon: '🥣', w: 1, h: 1, cost: { coin: 25 } },
    fodder:         { name: '草料堆', icon: '🌾', w: 1, h: 1, cost: { coin: 35 } },
    field_millet:   { name: '粟田', icon: '🌾', w: 2, h: 2, cost: { coin: 60 } },
    field_sprout:   { name: '田(苗)', icon: '🌱', w: 2, h: 2, cost: { coin: 40 } },
    field_wheat:    { name: '麥田(熟)', icon: '🌾', w: 2, h: 2, cost: { coin: 60 } },
    mulberry_grove: { name: '桑園', icon: '🌳', w: 2, h: 2, cost: { coin: 120 } },
    orchard:        { name: '果園', icon: '🍎', w: 2, h: 2, cost: { coin: 120 } },
    vegetable_plot: { name: '菜圃', icon: '🥬', w: 2, h: 1, swap: true, cost: { coin: 30 } },
    herb_garden:    { name: '藥圃', icon: '🌿', w: 2, h: 1, swap: true, cost: { coin: 40 } },
    tea_garden:     { name: '茶園', icon: '🍵', w: 2, h: 2, cost: { coin: 150 } },
    beehive:        { name: '蜂房', icon: '🐝', w: 1, h: 1, cost: { coin: 60 } },
    woodpile:       { name: '柴堆', icon: '🪵', w: 1, h: 1, cost: { coin: 20 } },
    haystack:       { name: '稻草堆', icon: '🌾', w: 1, h: 1, cost: { coin: 20 } },
    grain_sacks:    { name: '糧袋堆', icon: '🌾', w: 1, h: 1, cost: { coin: 30 } },
    granary_round:  { name: '陶倉(圓囷)', icon: '🏺', w: 1, h: 1, cost: { coin: 80 } },
    barrel_water:   { name: '水桶(滿)', icon: '🪣', w: 1, h: 1, cost: { coin: 20 } },
    barrel_empty:   { name: '水桶(空)', icon: '🪣', w: 1, h: 1, cost: { coin: 20 } },
    well:           { name: '水井', icon: '🕳️', w: 1, h: 1, cost: { coin: 60 } },
    well_sweep:     { name: '桔槔', icon: '🪣', w: 2, h: 1, swap: true, cost: { coin: 90 } },
    waterwheel:     { name: '水車', icon: '⚙️', w: 1, h: 2, swap: true, cost: { coin: 200 } },
    salt_pile:      { name: '鹽堆', icon: '🧂', w: 1, h: 1, cost: { coin: 25 } },
    saltfield:      { name: '鹽田', icon: '🧂', w: 2, h: 2, cost: { coin: 90 } },
    fish_rack:      { name: '曬魚架', icon: '🐟', w: 1, h: 1, cost: { coin: 30 } },
    fishery:        { name: '魚場(漁棚)', icon: '🎣', w: 2, h: 2, cost: { coin: 180 } },
    winnower:       { name: '風扇車', icon: '🌀', w: 1, h: 1, cost: { coin: 40 } }
  };
  if (typeof OBJECTS !== 'undefined') {
    Object.keys(NEW).forEach(function (k) {
      if (OBJECTS[k]) return;
      var d = NEW[k];
      OBJECTS[k] = { name: d.name, icon: d.icon, w: d.w, h: d.h, on: [T_GRASS, T_ROAD], cost: d.cost, side: 'estate' };
      if (d.swap) OBJECTS[k].swap = true;
    });
  }
  A.DECO2_KEYS = Object.keys(NEW);
})(ART);
