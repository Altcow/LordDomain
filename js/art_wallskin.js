// art_wallskin.js — 城牆外觀皮膚的 ART 定義(木柵 / 石牆 / 土牆;註冊表見 wallskin.js WALL_SKINS)
// 依賴 art.js 先載入。純外觀:wall 沿用 art.js artWallConn 的相鄰判定(v.skin 含 'x' / 'y'),高度與連接和現行 wallseg 一致。
// 新增皮膚:在此 A.def 新的 key,再到 wallskin.js 的 WALL_SKINS 登記即可。

(function (A) {
  var C = A.C;
  var EARTH = '#cbb38a', EARTH_DK = '#8f7650', EARTH_LT = '#e4d4ae';

  function snowOf(v) { return v && v.season === 'winter' ? C.snow : undefined; }
  // 軸向換算:ax 'x' = 沿 u 延伸,'y' = 沿 v 延伸;a 為沿牆座標、c 為橫向座標
  function ab(m, ax, a0, c0, z, al, cl, h, col, o) {
    return ax === 'x' ? m.box(a0, c0, z, al, cl, h, col, o) : m.box(c0, a0, z, cl, al, h, col, o);
  }
  function ap(mm, ax, a, c, z) { return ax === 'x' ? mm.pt(a, c, z) : mm.pt(c, a, z); }
  function conn(v, forceX) {
    var sk = v.skin || '', cx = sk.indexOf('x') >= 0, cy = sk.indexOf('y') >= 0;
    if (forceX) return [true, false];
    if (!cx && !cy) cx = true;
    return [cx, cy];
  }
  function all(fn) { return { F: fn, B: fn, L: fn, R: fn }; }

  // ---- 材質紋理(面 deco) ----
  function brickDeco(col) {
    return function (ctx, f) {
      var row = 0;
      for (var z = 5; z < f.h - 1; z += 5, row++) {
        A.line(ctx, f.pt(0, z), f.pt(1, z), A.tone(col, f.light * 0.8), 1);
        for (var s = (row % 2 ? 0.12 : 0.37); s < 1; s += 0.25) A.line(ctx, f.pt(s, z), f.pt(s, Math.min(f.h, z + 5)), A.tone(col, f.light * 0.84), 1);
      }
    };
  }
  function earthDeco(seed) {
    return function (ctx, f) {
      var rnd = A.rng(seed || 7), z, i;
      for (z = 4; z < f.h - 1; z += 5) A.line(ctx, f.pt(0, z), f.pt(1, z), A.tone(EARTH_DK, f.light * 0.9), 1.2);
      for (z = 6; z < f.h - 1; z += 5) A.line(ctx, f.pt(0, z + 1), f.pt(1, z + 1), A.tone(EARTH_LT, f.light * 0.95), 0.6);
      for (i = 0; i < 5; i++) {
        var s = 0.08 + rnd() * 0.84, zz = 3 + rnd() * Math.max(1, f.h - 7);
        A.line(ctx, f.pt(s, zz), f.pt(Math.min(1, s + 0.08), zz + 1.5), A.tone(EARTH_DK, f.light * 0.7), 1);
      }
    };
  }
  function logDeco(col) {
    return function (ctx, f) {
      for (var s = 0.12; s < 1; s += 0.2) A.line(ctx, f.pt(s, 1), f.pt(s, f.h - 1), A.tone(col, f.light * 0.72), 1);
    };
  }

  // ---- 城牆 / 院牆 arm ----
  // mat: wood / stone / earth;o: { H 牆身高, cap 'tile' | 'thatch' | null, merlon 是否女牆, c0/cl 橫向位置與厚度 }
  function armWood(m, v, ax, o, snow) {
    var hs = [1, 1.14, 1, 1.22, 1, 1.14, 1], i;
    for (i = 0; i < 7; i++) {
      (function (i) {
        var a0 = 0.005 + i * 0.142, h = Math.round(o.H * hs[i]);
        ab(m, ax, a0, 0.4, 0, 0.13, 0.2, h, i % 2 ? C.wood[1] : A.tone(C.wood[1], 0.9), { top: snow || C.wood[2] });
        var rx = ax === 'x' ? [a0, 0.4, 0.13, 0.2] : [0.4, a0, 0.2, 0.13];
        m.custom(rx[0], rx[1], rx[2], rx[3], h, function (ctx, mm) {
          var p = ap(mm, ax, a0, 0.6, h), q = ap(mm, ax, a0 + 0.13, 0.6, h), t = ap(mm, ax, a0 + 0.065, 0.6, h + 7);
          A.poly(ctx, [p, q, t], snow || C.wood[2], 0.7);
        });
      })(i);
    }
    [o.H * 0.28, o.H * 0.7].forEach(function (z) { ab(m, ax, 0, 0.6, z, 1, 0.05, 4, C.wood[0], { top: C.wood[1] }); });
  }
  function armBody(m, v, ax, o, snow, mat) {
    var col = mat === 'stone' ? C.stone[1] : EARTH;
    var deco = mat === 'stone' ? brickDeco(C.stone[1]) : earthDeco(v.seed);
    ab(m, ax, 0, o.c0, 0, 1, o.cl, o.H, col, { top: snow || (mat === 'stone' ? C.stone[2] : EARTH_LT), deco: all(deco) });
    if (o.merlon) {
      [0.05, 0.4, 0.75].forEach(function (a) { ab(m, ax, a, o.c0 + o.cl - 0.16, o.H, 0.2, 0.16, 7, col, { top: snow || undefined }); });
    }
    if (o.cap) {
      var g = o.cap === 'tile'
        ? { over: 0.1, curl: 1.5, sag: 0.5, ridgeCol: C.tileDk, hooks: false, end: false, snow: !!snow }
        : { over: 0.08, curl: 0, sag: 0, tileDensity: 9, ridgeCol: C.thatchDk, eaveCol: C.thatchDk, hooks: false, end: false, snow: !!snow };
      g.axis = ax === 'x' ? 'u' : 'v';
      if (ax === 'x') m.gable(0, o.c0 - 0.02, o.H, 1, o.cl + 0.04, o.rise || 6, o.cap === 'tile' ? C.tile : C.thatch, g);
      else m.gable(o.c0 - 0.02, 0, o.H, o.cl + 0.04, 1, o.rise || 6, o.cap === 'tile' ? C.tile : C.thatch, g);
    }
  }
  function wallDef(mat, cfg) {
    return {
      w: 1, d: 1, hmax: cfg.hmax, sym: !cfg.forceX, shadow: 'rect',
      build: function (m, v) {
        var snow = snowOf(v), c = conn(v, cfg.forceX), arms = [];
        if (c[0]) arms.push('x');
        if (c[1]) arms.push('y');
        arms.forEach(function (ax) {
          if (mat === 'wood') armWood(m, v, ax, cfg, snow);
          else armBody(m, v, ax, cfg, snow, mat);
        });
        if (mat === 'wood' && c[0] && c[1]) {
          m.box(0.37, 0.37, 0, 0.26, 0.26, Math.round(cfg.H * 1.3), C.wood[0], { top: snow || C.wood[2], bias: 1 });
        }
      }
    };
  }
  var WALLCFG = {
    wood:  { H: 28, hmax: 50, c0: 0.4, cl: 0.2 },
    earth: { H: 26, hmax: 50, c0: 0.17, cl: 0.66, cap: 'thatch', rise: 7 },
    stone: { H: 26, hmax: 50, c0: 0.2, cl: 0.6, merlon: true }
  };
  // 院牆版:沿 u 軸的單段(可旋轉),較矮
  var COURTCFG = {
    wood:  { H: 20, hmax: 36, c0: 0.4, cl: 0.2, forceX: true },
    earth: { H: 18, hmax: 38, c0: 0.2, cl: 0.6, cap: 'thatch', rise: 6, forceX: true },
    stone: { H: 18, hmax: 38, c0: 0.2, cl: 0.6, cap: 'tile', rise: 6, forceX: true }
  };
  ['wood', 'earth'].forEach(function (mat) { A.def('wskin_' + mat + '_wall', wallDef(mat, WALLCFG[mat])); });
  ['wood', 'stone', 'earth'].forEach(function (mat) { A.def('wskin_' + mat + '_wallc', wallDef(mat, COURTCFG[mat])); });

  // ---- 城門 ----
  // W = 3(城門)或 2(院門);pylon = 兩側門墩
  function gateDef(mat, W, big) {
    var bh = big ? 30 : 22, ph = big ? 46 : 34, pw = big ? 0.95 : 0.42;
    return {
      w: W, d: 1, hmax: ph + (big ? 30 : 24), shadow: 'rect',
      build: function (m, v) {
        var snow = snowOf(v);
        var body = mat === 'stone' ? C.stone[1] : (mat === 'earth' ? EARTH : C.wood[1]);
        var topc = snow || (mat === 'stone' ? C.stone[2] : (mat === 'earth' ? EARTH_LT : C.wood[2]));
        var tex = mat === 'stone' ? brickDeco(C.stone[1]) : (mat === 'earth' ? earthDeco(v.seed) : logDeco(C.wood[1]));
        var s0 = pw / W + 0.03, s1 = 1 - s0, oh = bh - 4;
        var passage = function (ctx, f) {
          tex(ctx, f);
          A.poly(ctx, A.quad(f, s0, s1, 0, oh), '#2a1c18', 0.6);
          var lw = (s1 - s0) * 0.22;
          A.poly(ctx, A.quad(f, s0, s0 + lw, 0, oh - 1), A.tone(C.wood[1], f.light), 0.6);
          A.poly(ctx, A.quad(f, s1 - lw, s1, 0, oh - 1), A.tone(C.wood[1], f.light * 0.92), 0.6);
          for (var z = 5; z < oh - 2; z += 6) {
            A.line(ctx, f.pt(s0, z), f.pt(s0 + lw, z), A.tone(C.wood[0], f.light), 0.8);
            A.line(ctx, f.pt(s1 - lw, z), f.pt(s1, z), A.tone(C.wood[0], f.light), 0.8);
          }
          A.line(ctx, f.pt(s0 - 0.01, oh), f.pt(s1 + 0.01, oh), C.ink, 3);
          A.line(ctx, f.pt(s0 - 0.01, oh), f.pt(s1 + 0.01, oh), C.wood[0], 1.8);
        };
        m.box(0, 0.12, 0, W, 0.76, bh, body, { top: topc, deco: { F: passage, B: passage, L: tex, R: tex } });
        [0, W - pw].forEach(function (u0) {
          m.box(u0, 0.04, 0, pw, 0.92, ph, body, { top: topc, deco: all(tex) });
          var rf = mat === 'stone' ? { col: C.tile, o: { over: 0.1, curl: 3, sag: 1, ridgeCol: C.tileDk, snow: !!snow } }
            : (mat === 'wood' ? { col: '#7a4a28', o: { over: 0.1, curl: 0, sag: 0, tileDensity: 7, ridgeCol: C.wood[0], eaveCol: C.wood[0], hooks: false, snow: !!snow } }
              : { col: C.thatch, o: { over: 0.1, curl: 0, sag: 0, tileDensity: 9, ridgeCol: C.thatchDk, eaveCol: C.thatchDk, hooks: false, snow: !!snow } });
          if (big && mat === 'wood') {
            m.gable(u0 - 0.02, 0.0, ph, pw + 0.04, 1, 14, rf.col, Object.assign({ end: false }, rf.o));
          } else {
            m.hip(u0 - 0.02, 0.0, ph, pw + 0.04, 1, big ? 18 : 12, rf.col, rf.o);
          }
        });
        if (mat === 'wood') {
          m.custom(0, 0.12, W, 0.76, bh, function (ctx, mm) {
            for (var i = 0; i < 9; i++) {
              var u = (i + 0.5) * W / 9;
              if (u < pw || u > W - pw) continue;
              var p = mm.pt(u - 0.12, 0.9, bh), q = mm.pt(u + 0.12, 0.9, bh), t = mm.pt(u, 0.9, bh + 7);
              A.poly(ctx, [p, q, t], snow || C.wood[2], 0.7);
            }
          }, 2);
        }
      }
    };
  }
  ['wood', 'earth'].forEach(function (mat) { A.def('wskin_' + mat + '_gate', gateDef(mat, 3, true)); });
  ['wood', 'stone', 'earth'].forEach(function (mat) { A.def('wskin_' + mat + '_gatec', gateDef(mat, 2, false)); });
})(ART);
