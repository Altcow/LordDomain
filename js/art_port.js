// art_port.js — 港口裝飾:船隻、棧橋、貨物堆、貨棧、吊桿、魚市、船塢,以及苦力外觀(經營布置用,side:'estate')。
// 依賴 art.js、art_objects.js、art_units.js 先載入;OBJECTS 來自 data.js。全為新 key,不覆寫既有定義。
// 水上物件 on = [T_LAKE, T_RIVER](與 dock / boat_small 相同規則);陸上物件 on = [T_GRASS, T_ROAD]。
// 純裝飾 / 經營用途,不進戰鬥模擬。非正方形物件一律 swap:true(奇數 rot 佔格對調,與 ART 朝向一致)。

(function (A) {
  var C = A.C;
  var KEYS = A.PORT = [];
  var ITEMS = {};
  var HULL = '#7a4a28', HULL_IN = '#3e2814', MAT = C.thatch, SAIL = '#e6d6a8', SAIL_LN = '#b89a5a';
  var SACK = '#d8c08a', SACK_LT = '#ecdcae', SALT = '#e9ebe6', JAR = '#8a5230', JAR_DK = '#5a3420';

  function def(key, spec) { A.def(key, spec); KEYS.push(key); }
  function snowOn(v) { return v && v.season === 'winter' ? C.snow : null; }
  function line3(ctx, mm, a, b, col, w) {
    var p = mm.pt(a[0], a[1], a[2]), q = mm.pt(b[0], b[1], b[2]);
    A.line(ctx, p, q, C.ink, w + 1.4); A.line(ctx, p, q, col, w);
  }
  function post(m, u, v, z, h, s) { m.box(u, v, z, s || 0.1, s || 0.1, h, C.wood[1], { top: C.wood[2] }); }
  // 麻袋(直立圓柱 + 腰繩)
  function sack(m, u, v, z, r, h, col) {
    h = h || 7;
    m.cyl(u, v, z, r || 0.17, h, col || SACK, { topCol: SACK_LT, hoops: [h * 0.78] });
  }
  // 木箱(上蓋 + 側面橫帶與角柱)
  function crate(m, u, v, z, w, d, h, top) {
    var bd = function (ctx, f) { A.band(ctx, f, h * 0.42, h * 0.42 + 1.4, C.wood[0]); A.posts(ctx, f, [0.1, 0.9], 0.1, C.wood[0]); };
    m.box(u, v, z, w, d, h, C.wood[1], { top: top || C.wood[2], deco: { F: bd, R: bd } });
  }
  function jar(m, u, v, z, r, h) { m.cyl(u, v, z, r || 0.17, h || 10, JAR, { topCol: JAR_DK, hoops: [(h || 10) * 0.3, (h || 10) * 0.75] }); }
  // 船行水波(動畫:兩圈向外擴散的白環,以物件佔格中心為準)
  function ripple(ctx, m, t) {
    var c = m.pt(m.W / 2, m.D / 2, 0);
    for (var i = 0; i < 2; i++) {
      var ph = (t * 0.25 + i * 0.5) % 1, rx = (m.W + m.D) * 16 * (0.72 + 0.36 * ph);
      ctx.save(); ctx.globalAlpha = (1 - ph) * 0.4; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.ellipse(c[0], c[1], rx, rx / 2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }
  function stripe(z0, z1, col) { return function (ctx, f) { A.band(ctx, f, z0, z1, col || C.wood[2]); }; }
  // 船帆:立在 v 平面上的帆布 + 橫肋 + 帆桁
  function sail(m, vv, u0, u1, zTop, zBot) {
    m.custom(u0 - 0.05, vv - 0.05, u1 - u0 + 0.1, 0.1, zBot, function (ctx, mm) {
      A.poly(ctx, [mm.pt(u0, vv, zTop), mm.pt(u1, vv, zTop), mm.pt(u1 - 0.1, vv, zBot), mm.pt(u0 + 0.1, vv, zBot)], SAIL, 0.7);
      for (var i = 1; i < 4; i++) {
        var z = zBot + (zTop - zBot) * i / 4;
        A.line(ctx, mm.pt(u0 + 0.05, vv, z), mm.pt(u1 - 0.05, vv, z), SAIL_LN, 0.9);
      }
      line3(ctx, mm, [u0 - 0.05, vv, zTop], [u1 + 0.05, vv, zTop], C.wood[1], 1.8);
    }, 2);
  }

  // ---------------- 水上:船與棧橋 ----------------

  // 運貨小舢板 1x2:小船身 + 船頭翹 + 麻袋與木箱 + 船槳
  def('boat_sampan', {
    w: 1, d: 2, hmax: 34, shadow: 'none',
    build: function (m, v) {
      m.box(0.12, 0.05, 1, 0.76, 1.9, 5, HULL, { top: HULL_IN });
      m.box(0.3, 0.0, 4, 0.4, 0.14, 4, HULL, { top: C.wood[2] });
      sack(m, 0.36, 0.55, 3.5); sack(m, 0.64, 0.55, 3.5); sack(m, 0.5, 0.8, 3.5, 0.16, 9);
      crate(m, 0.3, 1.1, 3, 0.4, 0.36, 8);
      sack(m, 0.5, 1.6, 3.5, 0.15, 6);
      m.custom(0.9, 0.3, 0.1, 1.2, 6, function (ctx, mm) { line3(ctx, mm, [0.9, 0.5, 9], [1.18, 1.5, 2], C.wood[2], 1.8); }, 1);
    },
    anim: function (ctx, m, t) { ripple(ctx, m, t); }
  });

  // 貨船 2x3:寬船身 + 貨艙(麻袋、木箱) + 艙蓬 + 桅與帆 + 船尾小艙
  def('ship_cargo', {
    w: 2, d: 3, hmax: 92, shadow: 'none',
    build: function (m, v) {
      var sn = snowOn(v);
      m.box(0.12, 0.1, 1, 1.76, 2.8, 7, HULL, { top: HULL_IN, deco: { F: stripe(4, 5.6), R: stripe(4, 5.6) } });
      m.box(0.5, 0.0, 5, 1.0, 0.2, 6, HULL, { top: C.wood[2] });
      crate(m, 0.3, 0.85, 4, 0.5, 0.5, 9); crate(m, 1.0, 0.85, 4, 0.5, 0.5, 9);
      sack(m, 0.4, 1.55, 4, 0.17, 8); sack(m, 0.75, 1.55, 4, 0.17, 8); sack(m, 1.1, 1.55, 4, 0.17, 8); sack(m, 1.45, 1.55, 4, 0.17, 8);
      sack(m, 0.58, 1.55, 12, 0.15, 6); sack(m, 1.28, 1.55, 12, 0.15, 6);
      m.box(0.5, 2.2, 5, 1.0, 0.6, 8, C.wood[1], { top: C.wood[2], deco: { F: function (ctx, f) { A.lattice(ctx, f, 0.5, 0.4, 2, 5, C.wood[0]); } } });
      m.hip(0.45, 2.15, 13, 1.1, 0.7, 6, MAT, { over: 0.1, curl: 2, sag: 0.5, tileDensity: 6, ridgeCol: C.thatchDk, eaveCol: C.thatchDk, hooks: false, snow: sn });
      m.custom(1.0, 0.55, 0.1, 0.1, 7, function (ctx, mm) { line3(ctx, mm, [1.0, 0.6, 7], [1.0, 0.6, 70], C.wood[1], 2.4); }, 2);
      sail(m, 0.6, 0.3, 1.7, 66, 36);
    },
    lights: function () { return [[1.0, 2.5, 14, 22, C.lamp, 0.7, 'F']]; },
    anim: function (ctx, m, t) { ripple(ctx, m, t); }
  });

  // 漕運糧船 2x3:平底寬船 + 兩段竹篷 + 滿艙糧袋 + 紅旗(動畫)
  def('ship_grain', {
    w: 2, d: 3, hmax: 84, shadow: 'none',
    build: function (m, v) {
      var sn = snowOn(v);
      m.box(0.1, 0.05, 1, 1.8, 2.9, 7, C.wood[0], { top: HULL_IN, deco: { F: stripe(3.5, 5, C.hanRed), R: stripe(3.5, 5, C.hanRed) } });
      m.box(0.4, 0.0, 5, 1.2, 0.18, 5, C.wood[0], { top: C.wood[2] });
      m.hip(0.3, 0.35, 8, 1.4, 1.0, 10, MAT, { over: 0.1, curl: 2, sag: 0.5, tileDensity: 6, ridgeCol: C.thatchDk, eaveCol: C.thatchDk, hooks: false, snow: sn });
      var i, j;
      for (i = 0; i < 4; i++) for (j = 0; j < 2; j++) sack(m, 0.4 + i * 0.4, 1.7 + j * 0.45, 4, 0.18, 8);
      for (i = 0; i < 3; i++) sack(m, 0.6 + i * 0.4, 1.9, 12, 0.15, 6);
      sack(m, 1.0, 1.9, 18, 0.13, 5);
      m.custom(1.0, 2.55, 0.1, 0.1, 7, function (ctx, mm) { line3(ctx, mm, [1.0, 2.6, 7], [1.0, 2.6, 52], C.wood[1], 2.2); }, 2);
    },
    anim: function (ctx, m, t) {
      var p = m.pt(1.0, 2.6, 52); A.flag(ctx, p[0], p[1], 3, 24, 14, C.hanRed, t, 0.4);
      ripple(ctx, m, t);
    }
  });

  // 樓船商船 3x4:高舷船身 + 雙層船樓(瓦頂)+ 前桅帆 + 旗(動畫)+ 艙燈
  def('ship_tower', {
    w: 3, d: 4, hmax: 124, shadow: 'none',
    build: function (m, v) {
      var sn = snowOn(v);
      m.box(0.2, 0.1, 1, 2.6, 3.8, 9, C.wood[0], { top: C.wood[1], deco: { F: stripe(4, 6, C.hanRed), R: stripe(4, 6, C.hanRed), L: stripe(4, 6, C.hanRed) } });
      m.box(0.9, 0.0, 6, 1.2, 0.22, 7, C.wood[0], { top: C.wood[2] });
      sack(m, 0.55, 0.9, 10, 0.17, 7); sack(m, 0.85, 0.9, 10, 0.17, 7); crate(m, 1.9, 0.8, 10, 0.5, 0.5, 8); crate(m, 2.2, 0.8, 10, 0.4, 0.5, 8);
      m.box(0.6, 1.5, 10, 1.8, 2.1, 14, C.wood[1], { top: C.wood[2], deco: { F: function (ctx, f) {
        A.lattice(ctx, f, 0.2, 0.18, 5, 7, C.wood[0]); A.lattice(ctx, f, 0.5, 0.18, 5, 7, C.wood[0]); A.lattice(ctx, f, 0.8, 0.18, 5, 7, C.wood[0]);
      }, R: function (ctx, f) { A.lattice(ctx, f, 0.3, 0.2, 5, 7, C.wood[0]); A.lattice(ctx, f, 0.7, 0.2, 5, 7, C.wood[0]); } } });
      m.hip(0.5, 1.4, 24, 2.0, 2.3, 10, C.tile, { over: 0.2, curl: 3, sag: 1, ridgeCol: C.lacquer, ridgeHi: C.gold, snow: sn, hookSize: 3 });
      m.box(1.0, 2.1, 34, 1.0, 1.0, 11, C.wood[1], { top: C.wood[2], deco: { F: function (ctx, f) { A.lattice(ctx, f, 0.5, 0.4, 3, 6, C.wood[0]); } } });
      m.hip(0.9, 2.0, 45, 1.2, 1.2, 8, C.tile, { over: 0.15, curl: 3, sag: 1, ridgeCol: C.lacquer, ridgeHi: C.gold, snow: sn, hookSize: 3 });
      m.custom(1.45, 0.55, 0.1, 0.1, 10, function (ctx, mm) { line3(ctx, mm, [1.5, 0.6, 10], [1.5, 0.6, 96], C.wood[1], 2.6); }, 2);
      sail(m, 0.6, 0.5, 2.5, 90, 46);
    },
    lights: function () { return [[1.5, 3.55, 24, 30, C.lamp, 0.8, 'F'], [1.5, 3.1, 40, 24, C.lantern, 0.8, 'F']]; },
    anim: function (ctx, m, t) {
      var p = m.pt(1.5, 3.1, 53); A.flag(ctx, p[0], p[1], 5, 28, 16, C.hanRed, t, 0.9);
      ripple(ctx, m, t);
    }
  });

  // 棧橋段 1x1(水上,可拖曳延伸):木樁 + 橫鋪木板
  def('pier_plank', {
    w: 1, d: 1, sym: true, hmax: 18, shadow: 'none',
    build: function (m) {
      [[0.06, 0.06], [0.84, 0.06], [0.06, 0.84], [0.84, 0.84]].forEach(function (p) { m.cyl(p[0] + 0.05, p[1] + 0.05, 0, 0.05, 13, C.wood[0], { topCol: C.wood[1] }); });
      m.box(0.0, 0.0, 7, 1, 1, 3, C.wood[1], { top: C.wood[2] });
      m.custom(0, 0, 1, 1, 10, function (ctx, mm) {
        for (var i = 1; i < 5; i++) { var k = i * 0.2; A.line(ctx, mm.pt(0.04, k, 10), mm.pt(0.96, k, 10), C.wood[0], 0.8); }
      }, 1);
    }
  });

  // 卸貨平台 2x2(水上):木樁高台 + 木板面 + 木箱與麻袋 + 繫纜樁
  def('wharf_platform', {
    w: 2, d: 2, hmax: 46, shadow: 'none',
    build: function (m, v) {
      [[0.1, 0.1], [1.0, 0.1], [1.85, 0.1], [0.1, 1.0], [1.85, 1.0], [0.1, 1.85], [1.0, 1.85], [1.85, 1.85]].forEach(function (p) { m.cyl(p[0] + 0.02, p[1] + 0.02, 0, 0.06, 13, C.wood[0], { topCol: C.wood[1] }); });
      m.box(0.0, 0.0, 8, 2, 2, 4, C.wood[1], { top: C.wood[2] });
      m.custom(0, 0, 2, 2, 12, function (ctx, mm) {
        for (var i = 1; i < 10; i++) { var k = i * 0.2; A.line(ctx, mm.pt(0.04, k, 12), mm.pt(1.96, k, 12), C.wood[0], 0.8); }
      }, 1);
      crate(m, 0.25, 0.3, 12, 0.5, 0.5, 9); crate(m, 0.85, 0.3, 12, 0.45, 0.5, 8); crate(m, 0.5, 0.35, 21, 0.4, 0.4, 7);
      sack(m, 0.4, 1.3, 12, 0.17, 7); sack(m, 0.75, 1.3, 12, 0.17, 7); sack(m, 0.58, 1.3, 19, 0.15, 6);
      m.cyl(1.7, 1.6, 12, 0.1, 10, C.wood[0], { topCol: C.wood[2], hoops: [6] });
      m.cyl(1.7, 0.4, 12, 0.1, 10, C.wood[0], { topCol: C.wood[2], hoops: [6] });
    }
  });

  // 繫纜樁 1x1(水陸皆可,可拖曳):粗木樁 + 纜繩纏繞 + 地面盤繩
  def('mooring_post', {
    w: 1, d: 1, sym: true, hmax: 30, shadow: 'ellipse',
    build: function (m) {
      m.cyl(0.5, 0.5, 0, 0.11, 14, C.wood[0], { topCol: C.wood[1], hoops: [7, 10] });
      m.cyl(0.5, 0.5, 14, 0.15, 3, C.wood[1], { topCol: C.wood[2] });
      m.custom(0.1, 0.1, 0.8, 0.8, 1, function (ctx, mm) {
        var c = mm.pt(0.72, 0.72, 1);
        A.ellipse(ctx, c[0], c[1], 7, 3.5, '#c8a868', 0.6); A.ellipse(ctx, c[0], c[1], 3.8, 1.8, '#9a7a42', 0.4);
        line3(ctx, mm, [0.5, 0.5, 12], [0.9, 0.35, 2], '#c8a868', 1.6);
      }, 1);
    }
  });

  // ---------------- 陸上:貨物堆 ----------------

  // 麻袋堆 1x1:三層金字塔
  def('cargo_sacks', {
    w: 1, d: 1, sym: true, hmax: 34, shadow: 'ellipse',
    build: function (m) {
      sack(m, 0.3, 0.3, 0, 0.21, 7); sack(m, 0.7, 0.3, 0, 0.21, 7); sack(m, 0.3, 0.7, 0, 0.21, 7); sack(m, 0.7, 0.7, 0, 0.21, 7);
      sack(m, 0.5, 0.38, 7, 0.19, 7); sack(m, 0.5, 0.64, 7, 0.19, 7);
      sack(m, 0.5, 0.5, 14, 0.17, 7);
    }
  });

  // 木箱堆 1x1:兩層木箱
  def('cargo_crates', {
    w: 1, d: 1, sym: true, hmax: 34, shadow: 'ellipse',
    build: function (m) {
      crate(m, 0.06, 0.08, 0, 0.44, 0.44, 10); crate(m, 0.52, 0.08, 0, 0.42, 0.44, 10); crate(m, 0.1, 0.56, 0, 0.5, 0.38, 9);
      crate(m, 0.2, 0.2, 10, 0.46, 0.44, 9);
    }
  });

  // 陶甕堆 1x1:黑陶甕兩層
  def('cargo_jars', {
    w: 1, d: 1, sym: true, hmax: 36, shadow: 'ellipse',
    build: function (m) {
      jar(m, 0.28, 0.28, 0, 0.17, 11); jar(m, 0.72, 0.28, 0, 0.17, 11); jar(m, 0.28, 0.72, 0, 0.17, 11); jar(m, 0.72, 0.72, 0, 0.17, 11);
      jar(m, 0.5, 0.5, 11, 0.16, 10);
    }
  });

  // 鹽包堆 1x1:白色扁包磚式交錯堆疊
  def('cargo_salt', {
    w: 1, d: 1, sym: true, hmax: 30, shadow: 'ellipse',
    build: function (m) {
      m.box(0.06, 0.1, 0, 0.42, 0.8, 5, SALT, { top: '#ffffff' }); m.box(0.52, 0.1, 0, 0.42, 0.8, 5, SALT, { top: '#ffffff' });
      m.box(0.08, 0.06, 5, 0.84, 0.42, 5, SALT, { top: '#ffffff' }); m.box(0.08, 0.52, 5, 0.84, 0.42, 5, SALT, { top: '#ffffff' });
      m.box(0.22, 0.2, 10, 0.56, 0.6, 5, SALT, { top: '#ffffff' });
    }
  });

  // 絲綢捆 1x1:三色綢捆疊放,繫金繩
  def('cargo_silk', {
    w: 1, d: 1, sym: true, hmax: 28, shadow: 'ellipse',
    build: function (m) {
      var cord = function (ctx, f) { A.band(ctx, f, 2.4, 3.4, '#ffe28a'); };
      m.box(0.08, 0.12, 0, 0.84, 0.76, 7, '#c4423a', { top: '#d8625a', deco: { F: cord, R: cord } });
      m.box(0.16, 0.2, 7, 0.68, 0.6, 6, '#3e6fb0', { top: '#5a8fd0', deco: { F: cord, R: cord } });
      m.box(0.24, 0.28, 13, 0.52, 0.44, 5, '#e8c04a', { top: '#f8da7a', deco: { F: cord, R: cord } });
    }
  });

  // ---------------- 陸上:設施 ----------------

  // 碼頭倉(貨棧) 3x2:石台基 + 土牆大門 + 瓦頂 + 前院木箱麻袋
  def('warehouse_port', {
    w: 3, d: 2, hmax: 78,
    build: function (m, v) {
      var sn = snowOn(v);
      m.box(0.05, 0.0, 0, 2.9, 1.4, 3, C.stone[1], { top: C.stone[2] });
      m.box(0.1, 0.05, 3, 2.8, 1.3, 18, C.earth, {
        top: '#f2d6a2',
        deco: {
          F: function (ctx, f) {
            A.band(ctx, f, 0, 2.5, C.earthDk);
            A.door(ctx, f, 0.5, 0.8, 14, C.hanRed);
            A.lattice(ctx, f, 0.14, 0.3, 9, 5, C.wood[1]); A.lattice(ctx, f, 0.86, 0.3, 9, 5, C.wood[1]);
            A.poly(ctx, A.quad(f, 0.44, 0.56, 15.5, 18), C.lacquer, 0.6);
            var p = f.pt(0.5, 16.8); A.glyph(ctx, '倉', p[0], p[1], 5, C.gold);
          },
          R: function (ctx, f) { A.band(ctx, f, 0, 2.5, C.earthDk); }
        }
      });
      m.gable(0.0, 0.0, 21, 3.0, 1.45, 13, C.tile, { axis: 'u', over: 0.2, overEnd: 0.1, curl: 3, sag: 1, tileDensity: 7, ridgeCol: C.tileDk, hookSize: 3, snow: sn });
      crate(m, 0.2, 1.55, 0, 0.4, 0.34, 8); crate(m, 0.62, 1.55, 0, 0.36, 0.34, 7); crate(m, 0.3, 1.58, 8, 0.3, 0.28, 6);
      sack(m, 1.9, 1.7, 0, 0.17, 7); sack(m, 2.25, 1.7, 0, 0.17, 7); sack(m, 2.08, 1.7, 7, 0.15, 6);
      jar(m, 2.7, 1.7, 0, 0.14, 9);
    },
    lights: function () { return [[0.3, 1.38, 17, 22, C.lantern, 0.8, 'F'], [2.7, 1.38, 17, 22, C.lantern, 0.8, 'F']]; }
  });

  // 轆轤吊桿 1x1:木底座 + 高桅 + 斜吊桿 + 轆轤輪;動畫:吊著的貨包輕輕搖擺
  def('crane_pole', {
    w: 1, d: 1, sym: true, hmax: 92, shadow: 'ellipse',
    build: function (m) {
      m.box(0.2, 0.2, 0, 0.6, 0.6, 6, C.stone[1], { top: C.stone[2] });
      m.cyl(0.4, 0.4, 6, 0.08, 56, C.wood[1], { topCol: C.wood[2], hoops: [14, 34] });
      m.custom(0.1, 0.1, 0.9, 0.9, 56, function (ctx, mm) {
        line3(ctx, mm, [0.4, 0.4, 56], [0.92, 0.7, 62], C.wood[2], 2.4);
        line3(ctx, mm, [0.4, 0.4, 40], [0.78, 0.62, 58], C.wood[0], 1.4);
        A.disc(ctx, mm, 0.62, 0.4, 24, 7, 'v', C.wood[1]);
        var h = mm.pt(0.62, 0.4, 24); A.circle(ctx, h[0], h[1], 1.6, C.gold, 0.6);
      }, 2);
    },
    anim: function (ctx, m, t) {
      var p = m.pt(0.92, 0.7, 61), sw = Math.sin(t * 1.3) * 2.2, y = p[1] + 20 + Math.sin(t * 0.7) * 1.5;
      A.line(ctx, p, [p[0] + sw, y], C.ink, 1.6);
      A.poly(ctx, [[p[0] + sw - 5, y], [p[0] + sw + 5, y], [p[0] + sw + 5, y + 9], [p[0] + sw - 5, y + 9]], C.wood[1], 0.7);
      A.line(ctx, [p[0] + sw - 5, y + 4], [p[0] + sw + 5, y + 4], C.wood[0], 1);
    }
  });

  // 碼頭燈 1x1(可拖曳):石座 + 木桿 + 橫臂燈籠 + 紅信號旗
  def('port_lamp', {
    w: 1, d: 1, sym: true, hmax: 64, shadow: 'ellipse',
    build: function (m) {
      m.box(0.38, 0.38, 0, 0.24, 0.24, 4, C.stone[1], { top: C.stone[2] });
      m.box(0.45, 0.45, 4, 0.1, 0.1, 38, C.wood[1], { top: C.wood[2] });
      m.custom(0.1, 0.1, 0.8, 0.8, 42, function (ctx, mm) {
        line3(ctx, mm, [0.5, 0.5, 40], [0.8, 0.5, 40], C.wood[0], 1.6);
        var p = mm.pt(0.8, 0.5, 40); A.lantern(ctx, p[0], p[1], 1.3);
        A.poly(ctx, [mm.pt(0.5, 0.5, 46), mm.pt(0.2, 0.5, 43.5), mm.pt(0.5, 0.5, 41)], C.hanRed, 0.7);
      }, 2);
    },
    lights: function () { return [[0.8, 0.5, 34, 44, C.lantern, 0.9]]; }
  });

  // 魚市攤 2x1:四柱布棚 + 鮮魚案 + 掛魚 + 水桶
  def('fish_market', {
    w: 2, d: 1, hmax: 50,
    build: function (m, v) {
      var sn = snowOn(v), awn = '#2f7f9a';
      [[0.08, 0.1], [1.84, 0.1], [0.08, 0.82], [1.84, 0.82]].forEach(function (p) { post(m, p[0], p[1], 0, 26, 0.08); });
      m.box(0.15, 0.5, 0, 1.7, 0.36, 8, C.wood[1], { top: '#b8d4e0', deco: { F: function (ctx, f) { A.band(ctx, f, 0, 1.8, C.wood[0]); } } });
      m.custom(0.15, 0.5, 1.7, 0.36, 8, function (ctx, mm) {
        [[0.4, 0.62, '#9fb7c4'], [0.75, 0.7, '#e8a070'], [1.1, 0.64, '#9fb7c4'], [1.45, 0.72, '#c8d4dc']].forEach(function (f) {
          var p = mm.pt(f[0], f[1], 8.5);
          A.ellipse(ctx, p[0], p[1], 5, 1.9, f[2], 0.6);
          A.poly(ctx, [[p[0] + 4, p[1]], [p[0] + 8, p[1] - 2], [p[0] + 8, p[1] + 2]], f[2], 0.5);
        });
      }, 1);
      m.custom(0.1, 0.12, 1.8, 0.1, 24, function (ctx, mm) {
        line3(ctx, mm, [0.1, 0.15, 22], [1.9, 0.15, 22], C.wood[2], 1.4);
        [0.5, 0.9, 1.3, 1.65].forEach(function (u) {
          var p = mm.pt(u, 0.15, 22); A.line(ctx, p, [p[0], p[1] + 5], C.ink, 0.8);
          A.ellipse(ctx, p[0], p[1] + 9, 2.2, 5.2, '#9fb7c4', 0.6);
        });
      }, 1);
      m.cyl(0.4, 0.2, 0, 0.12, 7, C.wood[1], { topCol: '#7ab4cc', hoops: [3] });
      m.hip(0.0, 0.0, 26, 2.0, 1.0, 9, awn, { over: 0.15, curl: 1, sag: 0.4, axis: 'u', hipK: 0.3, tiles: false, hooks: false, ridgeCol: A.tone(awn, 0.7), snow: sn });
    },
    lights: function () { return [[1.0, 0.9, 22, 24, C.lamp, 0.6, 'F']]; }
  });

  // 船塢(造船架) 3x3:夯土場 + 龍骨與肋材的半成船 + 木鷹架 + 木料堆 + 小工棚
  def('shipyard', {
    w: 3, d: 3, hmax: 72,
    build: function (m, v) {
      var sn = snowOn(v);
      m.box(0, 0, 0, 3, 3, 0, '#e6c08a', { top: '#e6c08a', bias: -1 });
      m.box(0.9, 0.3, 0, 0.18, 2.4, 4, C.wood[0], { top: C.wood[1] }); m.box(1.7, 0.3, 0, 0.18, 2.4, 4, C.wood[0], { top: C.wood[1] });
      m.box(1.25, 0.25, 4, 0.5, 2.5, 3, C.wood[2], { top: C.wood[2] });
      m.custom(0.6, 0.25, 1.8, 2.5, 7, function (ctx, mm) {
        for (var k = 0; k < 6; k++) {
          var v0 = 0.5 + k * 0.42, h = 18 - Math.abs(k - 2.5) * 2.4;
          line3(ctx, mm, [1.5, v0, 7], [0.82, v0, 7 + h], C.wood[1], 1.8);
          line3(ctx, mm, [1.5, v0, 7], [2.18, v0, 7 + h], C.wood[1], 1.8);
        }
        line3(ctx, mm, [0.82, 0.5, 21], [0.82, 2.6, 21], C.wood[2], 1.6);
        line3(ctx, mm, [2.18, 0.5, 21], [2.18, 2.6, 21], C.wood[2], 1.6);
      }, 1);
      m.box(0.55, 0.5, 5, 0.1, 1.6, 12, C.wood[1], { top: C.wood[2] });
      [[0.2, 0.3], [0.2, 2.6], [2.7, 0.3], [2.7, 2.6]].forEach(function (p) { post(m, p[0], p[1], 0, 34, 0.12); });
      m.custom(0.1, 0.2, 2.8, 2.6, 30, function (ctx, mm) {
        line3(ctx, mm, [0.25, 0.35, 28], [0.25, 2.65, 28], C.wood[2], 1.6);
        line3(ctx, mm, [2.75, 0.35, 28], [2.75, 2.65, 28], C.wood[2], 1.6);
        line3(ctx, mm, [0.25, 2.65, 28], [2.75, 2.65, 28], C.wood[2], 1.6);
      }, 1);
      m.box(2.2, 0.55, 0, 0.6, 0.9, 5, C.wood[2], { top: C.wood[2] });
      m.box(2.25, 0.6, 5, 0.5, 0.8, 4, C.wood[1], { top: C.wood[2] });
      m.box(2.0, 1.9, 0, 0.8, 0.8, 12, C.wood[1], { top: C.wood[2] });
      m.gable(1.95, 1.85, 12, 0.9, 0.9, 7, MAT, { axis: 'u', over: 0.08, curl: 1, sag: 0.4, tileDensity: 6, ridgeCol: C.thatchDk, eaveCol: C.thatchDk, hooks: false, snow: sn });
    }
  });

  // ---------------- 苦力外觀(ART.UNIT)與肩扛 / 抬 / 推貨道具 ----------------
  var UNIT = {
    coolie_sack: { name: '苦力(扛麻袋)', tunic: '#b89868', trim: '#7a5a3a', pants: '#6b5a46', head: 'scarf', headCol: '#f4ead2', prop: 'sack', civil: true },
    coolie_crate: { name: '苦力(抬木箱)', tunic: '#9aa08a', trim: '#5a6048', pants: '#5a4a3a', head: 'scarf', headCol: '#e8dcc0', prop: 'crate', civil: true },
    coolie_barrow: { name: '苦力(推獨輪車)', tunic: '#a8825a', trim: '#6a4a2a', pants: '#5a4a3a', head: 'scarf', headCol: '#f4ead2', prop: 'barrow', loaded: true, civil: true },
    coolie_barrow0: { name: '苦力(推空車)', tunic: '#a8825a', trim: '#6a4a2a', pants: '#5a4a3a', head: 'scarf', headCol: '#f4ead2', prop: 'barrow', loaded: false, civil: true },
    coolie_free: { name: '苦力(空手)', tunic: '#b09c78', trim: '#7a6a4a', pants: '#6b5a46', head: 'scarf', headCol: '#f4ead2', prop: 'rope', civil: true }
  };
  if (A.UNIT) Object.keys(UNIT).forEach(function (k) { UNIT[k].id = k; A.UNIT[k] = UNIT[k]; });

  var baseProp = A.chibiProp;
  A.chibiProp = function (ctx, p, back, bob, s) {
    if (p === 'sack') {
      // 肩上橫扛一只大麻袋,一手扶著
      A.ellipse(ctx, -12.5, -23 + bob, 7.4, 5.6, SACK, 0.7);
      A.ellipse(ctx, -14.5, -25 + bob, 3.2, 1.8, SACK_LT, 0);
      A.line(ctx, [-18.5, -22 + bob], [-17, -18 + bob], A.tone(SACK, 0.6), 1.2);
      A.line(ctx, [-8, -19.5 + bob], [-9, -12 + bob], C.ink, 1);
    } else if (p === 'crate') {
      // 雙手抱著木箱在胸前
      A.poly(ctx, [[-9, -17 + bob], [9, -17 + bob], [9, -3 + bob], [-9, -3 + bob]], C.wood[1], 0.8);
      A.poly(ctx, [[-9, -17 + bob], [9, -17 + bob], [7, -19.5 + bob], [-7, -19.5 + bob]], C.wood[2], 0.7);
      A.line(ctx, [-9, -10 + bob], [9, -10 + bob], C.wood[0], 1.3);
      A.line(ctx, [-9, -17 + bob], [9, -3 + bob], C.wood[0], 0.9);
      A.circle(ctx, -9.4, -9 + bob, 2.2, C.skin, 0.6); A.circle(ctx, 9.4, -9 + bob, 2.2, C.skin, 0.6);
    } else if (p === 'barrow') {
      // 獨輪車:車斗 + 輪 + 兩根把手
      A.line(ctx, [-9, -9 + bob], [8, -3], C.ink, 2.6); A.line(ctx, [-9, -9 + bob], [8, -3], C.wood[1], 1.3);
      A.line(ctx, [9, -9 + bob], [16, -4], C.ink, 2.6); A.line(ctx, [9, -9 + bob], [16, -4], C.wood[1], 1.3);
      A.poly(ctx, [[3, -12], [20, -12], [17, -5], [6, -5]], C.wood[2], 0.8);
      if (s && s.loaded) {
        A.ellipse(ctx, 8, -14, 4, 3, SACK, 0.7); A.ellipse(ctx, 14.5, -14, 3.6, 2.8, SACK_LT, 0.7);
        A.poly(ctx, [[4, -15], [10, -19], [16, -16], [11, -12]], '#8a5230', 0.6);
      }
      A.circle(ctx, 12, -3, 4.4, C.wood[0], 0.8); A.circle(ctx, 12, -3, 1.4, C.gold, 0.4);
    } else if (p === 'rope') {
      // 空手:肩上斜掛一圈麻繩
      A.line(ctx, [-6, -18 + bob], [5, -6 + bob], C.ink, 2.8); A.line(ctx, [-6, -18 + bob], [5, -6 + bob], '#c8a868', 1.5);
      A.ellipse(ctx, 5, -6 + bob, 3, 2, '#c8a868', 0.6);
    } else if (baseProp) baseProp(ctx, p, back, bob, s);
  };

  // ---------------- 建築選單條目(OBJECTS) ----------------
  function item(name, icon, w, h, coin, o) {
    o = o || {};
    var r = {
      name: name, icon: icon, w: w, h: h,
      on: o.on || [T_GRASS, T_ROAD],
      cost: { coin: coin }, side: 'estate',
      cb: { block: 'none', hp: null, cat: null }
    };
    if (o.drag) r.drag = true;
    if (w !== h) r.swap = true;
    return r;
  }
  var WATER = function () { return [T_LAKE, T_RIVER]; };
  var DEF_ITEMS = {
    boat_sampan: item('運貨舢板', '🛶', 1, 2, 90, { on: WATER() }),
    ship_cargo: item('貨船', '⛵', 2, 3, 260, { on: WATER() }),
    ship_grain: item('漕運糧船', '🚢', 2, 3, 300, { on: WATER() }),
    ship_tower: item('樓船商船', '🛳️', 3, 4, 520, { on: WATER() }),
    pier_plank: item('長棧橋', '🪵', 1, 1, 25, { on: WATER(), drag: true }),
    wharf_platform: item('卸貨平台', '⚓', 2, 2, 150, { on: WATER() }),
    mooring_post: item('繫纜樁', '🪢', 1, 1, 20, { on: [T_GRASS, T_ROAD, T_LAKE, T_RIVER], drag: true }),
    cargo_sacks: item('麻袋堆', '🛍️', 1, 1, 30, { drag: true }),
    cargo_crates: item('木箱堆', '📦', 1, 1, 30, { drag: true }),
    cargo_jars: item('陶甕堆', '🏺', 1, 1, 35, { drag: true }),
    cargo_salt: item('鹽包堆', '🧂', 1, 1, 35, { drag: true }),
    cargo_silk: item('絲綢捆', '🧵', 1, 1, 60, { drag: true }),
    warehouse_port: item('碼頭倉(貨棧)', '🏚️', 3, 2, 280),
    crane_pole: item('轆轤吊桿', '🏗️', 1, 1, 160),
    port_lamp: item('碼頭燈', '🏮', 1, 1, 40, { drag: true }),
    fish_market: item('魚市攤', '🐟', 2, 1, 120),
    shipyard: item('船塢(造船架)', '🔨', 3, 3, 400)
  };
  Object.keys(DEF_ITEMS).forEach(function (k) { ITEMS[k] = DEF_ITEMS[k]; });
  if (typeof OBJECTS !== 'undefined' && typeof T_GRASS !== 'undefined') {
    Object.keys(ITEMS).forEach(function (k) { if (!OBJECTS[k]) OBJECTS[k] = ITEMS[k]; });
  }
  A.PORT_ITEMS = ITEMS;
})(ART);
