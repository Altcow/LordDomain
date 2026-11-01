// art_deco4.js — 裝飾四:庭園、禮儀祭祀、自然景物、公共建築(PLAN_ART_STYLE §3.4)
// 依賴 art.js、art_objects.js 先載入;OBJECTS 來自 data.js。key 與 §3.4 物件 id 一致,
// 撞名者(art_objects.js 已定義)加 deco_ 前綴,沿用既有定義。

(function (A) {
  var C = A.C;

  // 沿用 art_objects.js 既有定義,以新 key 登記(build / lights / anim 皆延遲查表)
  function reuse(key, src, over) {
    var s = A.OBJ[src];
    if (!s) return;
    var spec = { w: s.w, d: s.d, sym: s.sym, hmax: s.hmax, shadow: s.shadow,
      build: function (m, v) { A.OBJ[src].build(m, v); } };
    if (s.lights) spec.lights = function (v) { return A.OBJ[src].lights(v); };
    if (s.anim) spec.anim = function (ctx, m, t, v) { A.OBJ[src].anim(ctx, m, t, v); };
    A.def(key, Object.assign(spec, over || {}));
  }

  // 水波:同心橢圓向外擴散後淡出
  function ripple(ctx, x, y, t, rx, ry, col) {
    for (var i = 0; i < 2; i++) {
      var p = (t * 0.45 + i * 0.5) % 1;
      ctx.save(); ctx.globalAlpha = (1 - p) * 0.7;
      ctx.beginPath(); ctx.ellipse(x, y, rx * (0.3 + p), ry * (0.3 + p), 0, 0, Math.PI * 2);
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
    }
  }

  // 落瓣 / 落葉:從樹冠飄落(只在指定季節畫)
  function fallen(ctx, m, t, v, season, cols) {
    if (v.season !== season) return;
    var c = m.pt(0.5, 0.5, 26);
    for (var i = 0; i < 4; i++) {
      var p = (t * 0.2 + i * 0.25) % 1;
      var x = c[0] + (i - 1.5) * 12 + Math.sin(p * 7 + i) * 4, y = c[1] - 26 + p * 36;
      ctx.save(); ctx.globalAlpha = 0.9 * (1 - p); ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath(); ctx.ellipse(x, y, 2.3, 1.3, p * 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  // 樹(對稱,四季由 A.tree 內部處理)
  function treeDef(key, kind, h, anim) {
    var spec = { w: 1, d: 1, sym: true, hmax: h, shadow: 'ellipse',
      build: function (m, v) {
        m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
          var c = mm.pt(0.5, 0.5, 0);
          ctx.save(); ctx.translate(c[0], c[1]); A.tree(ctx, kind, v.seed || 1, v.season || 'spring'); ctx.restore();
        });
      } };
    if (anim) spec.anim = anim;
    A.def(key, spec);
  }

  // 地面中心點 (0.5,0.5)
  function gc(mm) { return mm.pt(0.5, 0.5, 0); }

  // ---------------- 樹(P1 五種 + P2 桃、柏)----------------
  treeDef('tree_pine', 'pine', 54);
  treeDef('tree_willow', 'willow', 52);
  treeDef('tree_sakura', 'sakura', 50, function (ctx, m, t, v) { fallen(ctx, m, t, v, 'spring', ['#ffaecb', '#ffe2ec']); });
  treeDef('tree_maple', 'maple', 50, function (ctx, m, t, v) { fallen(ctx, m, t, v, 'autumn', ['#e2483a', '#ff8e5c', '#ffc84e']); });
  treeDef('tree_mulberry', 'mulberry', 48);
  // P2:桃以櫻色樹冠代替粉花;柏以松的形制代替窄高樹形(待美術確認)
  treeDef('tree_peach', 'sakura', 48);
  treeDef('tree_cypress', 'pine', 60);

  // ---------------- 沿用既有定義 ----------------
  reuse('deco_bamboo', 'bamboo', { hmax: 56 });
  reuse('deco_bush', 'bush');
  reuse('deco_rocks', 'rocks');
  reuse('stone_lamp', 'stonelamp');
  reuse('fence_wood', 'fence');
  reuse('lantern_line', 'lanternline');
  reuse('deco_brazier', 'brazier');
  reuse('deco_pond', 'pond', {
    anim: function (ctx, m, t) { var c = m.pt(1, 1, -2); ripple(ctx, c[0], c[1], t, 20, 10, '#dff6ff'); }
  });

  // ---------------- 花叢、盆栽、假山 ----------------
  A.def('flower_bed', {
    w: 1, d: 1, sym: true, hmax: 14, shadow: 'ellipse',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var c = gc(mm), sn = v.season === 'winter', rnd = A.rng(v.seed || 3);
        var leaf = sn ? ['#7a6a5a', '#9a8a78', '#c8bcae'] : (A.LEAF.round[v.season || 'spring'] || A.LEAF.round.spring);
        [[-5, -3, 4.5], [4, -3, 4.5], [0, -6, 4.5]].forEach(function (b) { A.circle(ctx, c[0] + b[0] + 1, c[1] + b[1] + 1.2, b[2], leaf[0]); });
        [[-5, -3, 4.5], [4, -3, 4.5], [0, -6, 4.5]].forEach(function (b) { A.circle(ctx, c[0] + b[0], c[1] + b[1], b[2] - 1, leaf[1]); });
        if (sn) { A.ellipse(ctx, c[0], c[1] - 9, 7, 2.4, C.snow); return; }
        if (v.season === 'autumn') return;
        var cols = ['#ff6f9a', '#ffd24a', '#ffffff', '#b07ce8', '#ff8a3d'];
        for (var i = 0; i < 9; i++) A.circle(ctx, c[0] - 9 + rnd() * 18, c[1] - 12 + rnd() * 9, 1.7, cols[i % cols.length], 0.35);
      });
    }
  });
  A.def('potted_plant', {
    w: 1, d: 1, sym: true, hmax: 22, shadow: 'ellipse',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var c = gc(mm), sn = v.season === 'winter', leaf = sn ? ['#7a6a5a', '#9a8a78', '#c8bcae'] : (A.LEAF.round[v.season || 'spring'] || A.LEAF.round.spring);
        A.poly(ctx, [[c[0] - 4, c[1] - 9], [c[0] + 4, c[1] - 9], [c[0] + 3.2, c[1] - 1], [c[0] - 3.2, c[1] - 1]], C.earthDk, 0.6);
        A.poly(ctx, [[c[0] - 5.5, c[1] - 9], [c[0] + 5.5, c[1] - 9], [c[0] + 4.8, c[1] - 12], [c[0] - 4.8, c[1] - 12]], C.earth, 0.6);
        A.ellipse(ctx, c[0], c[1] - 12, 4.8, 1.4, '#5a3a22');
        [[-4, -17, 4.2], [4, -17, 4.2], [0, -21, 4.8]].forEach(function (b) { A.circle(ctx, c[0] + b[0] + 1, c[1] + b[1] + 1.2, b[2], leaf[0]); });
        [[-4, -17, 4.2], [4, -17, 4.2], [0, -21, 4.8]].forEach(function (b) { A.circle(ctx, c[0] + b[0], c[1] + b[1], b[2] - 1, leaf[1]); });
        if (v.season === 'spring') { A.circle(ctx, c[0] - 3, c[1] - 19, 1.5, '#ff6f9a', 0.3); A.circle(ctx, c[0] + 3, c[1] - 22, 1.5, '#ffd24a', 0.3); }
        if (sn) A.ellipse(ctx, c[0], c[1] - 25, 5, 1.8, C.snow);
      });
    }
  });
  A.def('rockery', {
    w: 1, d: 1, sym: true, hmax: 44, shadow: 'ellipse',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var c = gc(mm), sn = v.season === 'winter';
        [[-6, 2, 1.1, 11], [6, 1, 1.0, 12], [0, -6, 1.05, 13], [-2, -20, 0.8, 14]].forEach(function (r) {
          A.rock(ctx, c[0] + r[0], c[1] + r[1], r[2], r[3], C.stone[1]);
          if (sn) A.ellipse(ctx, c[0] + r[0], c[1] + r[1] - 9 * r[2], 5 * r[2], 2 * r[2], C.snow);
        });
      });
    }
  });

  // ---------------- 水岸:荷花、蘆葦、池上小橋 ----------------
  A.def('lotus', {
    w: 1, d: 1, sym: true, hmax: 10, shadow: 'none',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var c = gc(mm), sn = v.season === 'winter', sum = v.season === 'summer';
        var pad = sn ? '#8a7a5a' : (v.season === 'autumn' ? '#b9a752' : '#4fa63c');
        A.ellipse(ctx, c[0] - 3, c[1] + 1, 6, 2.8, pad, 0.4);
        A.ellipse(ctx, c[0] + 5, c[1] - 2, 4.5, 2.2, sn ? '#8a7a5a' : '#6cbf4a', 0.4);
        if (sum) { A.ellipse(ctx, c[0] + 1, c[1] - 4, 2, 3.2, '#ff8fb0', 0.4); A.ellipse(ctx, c[0] + 1, c[1] - 4.5, 1, 1.8, '#ffd0de'); }
      });
    },
    anim: function (ctx, m, t) { var c = m.pt(0.5, 0.5, 0); ripple(ctx, c[0], c[1], t, 12, 6, '#dff6ff'); }
  });
  A.def('reeds', {
    w: 1, d: 1, sym: true, hmax: 28, shadow: 'ellipse',
    build: function (m, v) {
      var R = reedList(v.seed), sn = v.season === 'winter', col = sn ? '#c8b48a' : (v.season === 'autumn' ? '#d8c27a' : '#8fb84a');
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        R.forEach(function (r) {
          var b = mm.pt(r.u, r.v, 0), tip = [b[0] + r.lean, b[1] - r.h];
          A.line(ctx, b, tip, C.ink, 2.4); A.line(ctx, b, tip, col, 1.2);
        });
      });
    },
    // 穗頭隨風擺動(每幀疊畫)
    anim: function (ctx, m, t, v) {
      var R = reedList(v.seed), sn = v.season === 'winter';
      R.forEach(function (r, i) {
        var b = m.pt(r.u, r.v, 0), sway = Math.sin(t * 1.7 + i * 1.3) * 2.2;
        A.ellipse(ctx, b[0] + r.lean + sway, b[1] - r.h + 3, 1.6, 4, sn ? '#e6dcc4' : '#9a6a3a', 0.4);
      });
    }
  });
  function reedList(seed) {
    var rnd = A.rng(seed || 7), out = [], i;
    for (i = 0; i < 7; i++) out.push({ u: 0.2 + rnd() * 0.6, v: 0.2 + rnd() * 0.6, h: 18 + rnd() * 8, lean: (rnd() - 0.5) * 4 });
    return out;
  }
  // 池上小橋:1×2,長軸沿 v;拱形橋面 + 橋墩側面
  A.def('small_bridge', {
    w: 1, d: 2, hmax: 26, shadow: 'none',
    build: function (m, v) {
      var N = 8, i, top = [], topR = [];
      function zt(s) { return 2 + 9 * Math.sin(Math.PI * s / 2); }
      for (i = 0; i <= N; i++) { var s = 2 * i / N; top.push(m.pt(0.1, s, zt(s))); topR.push(m.pt(0.9, s, zt(s))); }
      m.custom(0, 0, 1, 2, 0, function (ctx, mm) {
        // 橋身側面(弧下方的開口由地面到弧線)
        for (i = 0; i < N; i++) {
          var a = m.pt(0.9, 2 * i / N, 0), b = m.pt(0.9, 2 * (i + 1) / N, 0);
          A.poly(ctx, [topR[i], topR[i + 1], b, a], C.stone[1], 0.5);
        }
        // 橋面
        var face = top.concat(topR.slice().reverse());
        A.poly(ctx, face, C.wood[1], 0.7);
        for (i = 0; i < N; i++) { A.line(ctx, top[i], top[i + 1], C.wood[2], 1); }
        // 欄杆
        for (i = 0; i <= N; i += 2) { var p = top[i], q = mm.pt(0.1, 2 * i / N, zt(2 * i / N) + 4); A.line(ctx, p, q, C.ink, 1.6); }
        var r1 = mm.pt(0.1, 0, zt(0) + 4), r2 = mm.pt(0.1, 2, zt(2) + 4);
        A.line(ctx, r1, r2, C.wood[2], 1.8);
      });
    }
  });

  // ---------------- 石板路、竹籬、院牆、院門 ----------------
  A.def('road_stone', {
    w: 1, d: 1, sym: true, hmax: 2, shadow: 'none',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var rnd = A.rng(v.seed || 2), i, j;
        for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
          var x0 = i * 0.5 + 0.03, y0 = j * 0.5 + 0.03, x1 = x0 + 0.44, y1 = y0 + 0.44;
          var q = [mm.pt(x0, y0, 0), mm.pt(x1, y0, 0), mm.pt(x1, y1, 0), mm.pt(x0, y1, 0)];
          A.poly(ctx, q, rnd() > 0.5 ? C.stone[2] : A.tone(C.stone[1], 1.05), 0.35);
        }
      });
    }
  });
  A.def('fence_bamboo', {
    w: 1, d: 1, hmax: 26, shadow: 'rect',
    build: function (m, v) {
      m.custom(0, 0.44, 1, 0.12, 0, function (ctx, mm) {
        var sn = v.season === 'winter', i;
        for (i = 0; i <= 6; i++) {
          var u = 0.04 + i * 0.16, a = mm.pt(u, 0.5, 0), b = mm.pt(u, 0.5, 24);
          A.line(ctx, a, b, C.ink, 3.2); A.line(ctx, a, b, i % 2 ? '#6cbf4a' : '#4fa63c', 1.8);
          if (sn) A.ellipse(ctx, b[0], b[1] - 1, 2.4, 1.2, C.snow);
        }
        [6, 18].forEach(function (z) {
          var p = mm.pt(0, 0.5, z), q = mm.pt(1, 0.5, z);
          A.line(ctx, p, q, C.ink, 3.4); A.line(ctx, p, q, '#8fcf5a', 2);
          if (sn) A.line(ctx, mm.pt(0, 0.5, z + 1.6), mm.pt(1, 0.5, z + 1.6), C.snow, 1.6);
        });
      });
    }
  });
  A.def('wall_courtyard', {
    w: 1, d: 1, hmax: 30, shadow: 'rect',
    build: function (m, v) {
      var sn = v.season === 'winter';
      var band = function (ctx, f) { A.band(ctx, f, 0, 2.5, C.stone[1]); };
      m.box(0.02, 0.36, 0, 0.96, 0.28, 20, C.silk, {
        deco: {
          F: function (ctx, f) { band(ctx, f); A.lattice(ctx, f, 0.5, 0.3, 7, 6, C.wood[1]); },
          B: band, L: band, R: band
        }
      });
      m.box(0, 0.34, 20, 1, 0.32, 3, C.tile, { top: sn ? C.snow : C.tileDk });
    }
  });
  A.def('gate_courtyard', {
    w: 2, d: 1, hmax: 44, shadow: 'rect',
    build: function (m, v) {
      var sn = v.season === 'winter';
      m.box(0.08, 0.4, 0, 0.14, 0.2, 34, C.wood[1], { top: C.wood[2] });
      m.box(1.78, 0.4, 0, 0.14, 0.2, 34, C.wood[1], { top: C.wood[2] });
      m.box(0.02, 0.38, 32, 1.96, 0.24, 4, C.wood[0], { top: C.wood[1] });
      m.gable(0, 0.3, 36, 2, 0.4, 8, C.tile, { over: 0.12, curl: 2, sag: 0.6, tileDensity: 6, ridgeCol: C.tileDk, end: false, hooks: false, snow: sn });
      m.custom(0.5, 1.02, 1, 0.04, 26, function (ctx, mm) {
        [0.6, 1.4].forEach(function (u) { var p = mm.pt(u, 1.05, 27); A.lantern(ctx, p[0], p[1], 0.9); });
      });
    },
    lights: function () { return [[0.6, 1.05, 22, 18, C.lantern, 0.8, 'F'], [1.4, 1.05, 22, 18, C.lantern, 0.8, 'F']]; }
  });

  // ---------------- 牌坊、里社、香爐、石碑 ----------------
  A.def('paifang', {
    w: 3, d: 1, hmax: 80, shadow: 'rect',
    build: function (m, v) {
      var sn = v.season === 'winter';
      [0.13, 2.63].forEach(function (u) {
        m.box(u, 0.12, 0, 0.24, 0.24, 60, C.hanRed, { top: C.lacquer });
        m.box(u, 0.64, 0, 0.24, 0.24, 60, C.hanRed, { top: C.lacquer });
      });
      m.box(0, 0.0, 56, 3, 1, 6, C.hanRed, { top: C.lacquer });
      m.hip(0, 0, 62, 3, 1, 12, C.lacquer, { over: 0.22, curl: 4, sag: 1, ridgeCol: C.lacquer, ridgeHi: C.gold, hipK: 0.5, axis: 'u', snow: sn });
      m.custom(1.0, 0.98, 1.0, 0.06, 40, function (ctx, mm) {
        var c = mm.pt(1.5, 1.0, 46);
        A.poly(ctx, [[c[0] - 12, c[1] - 7], [c[0] + 12, c[1] - 7], [c[0] + 12, c[1] + 7], [c[0] - 12, c[1] + 7]], C.lacquer, 0.6);
        A.glyph(ctx, '坊', c[0], c[1], 9, C.gold);
      });
      m.custom(0.2, 1.0, 2.6, 0.06, 40, function (ctx, mm) {
        [0.25, 2.75].forEach(function (u) { var p = mm.pt(u, 1.05, 42); A.lantern(ctx, p[0], p[1], 1); });
      });
    },
    lights: function () { return [[0.25, 1.05, 40, 22, C.lantern, 0.8, 'F'], [2.75, 1.05, 40, 22, C.lantern, 0.8, 'F']]; }
  });
  A.def('she_altar', {
    w: 2, d: 2, sym: true, hmax: 62, shadow: 'rect',
    build: function (m, v) {
      m.box(0.2, 0.2, 0, 1.6, 1.6, 4, C.stone[1], { top: C.stone[2] });
      m.box(0.35, 0.35, 4, 1.3, 1.3, 12, C.earth, {
        top: C.earthDk,
        deco: { F: function (ctx, f) { A.band(ctx, f, 0, 2, C.earthDk); }, L: function (ctx, f) { A.band(ctx, f, 0, 2, C.earthDk); }, R: function (ctx, f) { A.band(ctx, f, 0, 2, C.earthDk); } }
      });
      m.custom(0.35, 0.35, 1.3, 1.3, 16, function (ctx, mm) {
        var c = mm.pt(1, 1, 16);
        ctx.save(); ctx.translate(c[0], c[1]); A.tree(ctx, 'round', v.seed || 3, v.season || 'spring'); ctx.restore();
      }, 50);
      m.cyl(0.5, 1.92, 0, 0.12, 6, C.bronze, { topCol: C.lacquer });
      m.custom(0.5, 1.92, 0.1, 0.1, 6, function (ctx, mm) {
        var p = mm.pt(0.5, 1.92, 6);
        if (A.state.lit) A.lit(ctx, function () { A.ellipse(ctx, p[0], p[1] - 1, 3, 2, C.lamp, 0.7); });
      });
    },
    lights: function () { return [[0.5, 1.92, 22, 22, C.lamp, 0.8, 'F']]; },
    anim: function (ctx, m, t) {
      var p = m.pt(1.9, 0.2, 0);
      A.flag(ctx, p[0], p[1], 44, 14, 10, C.hanRed, t, 0.5);
    }
  });
  A.def('incense_burner', {
    w: 1, d: 1, sym: true, hmax: 30, shadow: 'ellipse',
    build: function (m) {
      m.custom(0.3, 0.3, 0.4, 0.4, 0, function (ctx, mm) {
        var c = gc(mm);
        [[-5, 3], [5, 3], [0, 6]].forEach(function (l) {
          var a = [c[0] + l[0], c[1] + l[1]], b = [c[0] + l[0] * 0.6, c[1] - 5];
          A.line(ctx, a, b, C.ink, 3); A.line(ctx, a, b, C.bronze, 1.6);
        });
      });
      m.cyl(0.5, 0.5, 5, 0.26, 9, C.bronze, { topCol: C.lacquer });
      m.custom(0.4, 0.4, 0.2, 0.2, 14, function (ctx, mm) {
        var e = mm.pt(0.5, 0.5, 14);
        if (A.state.lit) A.lit(ctx, function () { A.ellipse(ctx, e[0], e[1], 4.5, 2, C.fire, 0.5); });
      });
    },
    lights: function () { return [[0.5, 0.5, 16, 20, C.fire, 0.6]]; },
    anim: function (ctx, m, t) { var p = m.pt(0.5, 0.5, 17); A.smoke(ctx, p[0], p[1], t, 0.7); }
  });
  A.def('stele', {
    w: 1, d: 1, hmax: 40, shadow: 'rect',
    build: function (m, v) {
      var sn = v.season === 'winter';
      m.box(0.2, 0.3, 0, 0.6, 0.4, 4, C.stone[1], { top: C.stone[2] });
      m.box(0.3, 0.36, 4, 0.4, 0.28, 28, C.stone[2], {
        deco: {
          F: function (ctx, f) {
            [[0.32, 20, '熹'], [0.32, 12, '平'], [0.68, 20, '石'], [0.68, 12, '經']].forEach(function (g) {
              var p = f.pt(g[0], g[1]); A.glyph(ctx, g[2], p[0], p[1], 7, C.ink);
            });
          }
        }
      });
      m.hip(0.3, 0.36, 32, 0.4, 0.28, 6, C.stone[1], { over: 0.05, curl: 0, sag: 0, tiles: false, hooks: false, snow: sn, hipK: 0.6 });
    }
  });

  // OBJECTS:建築選單登記。w/h 與 A.OBJ 的 w/d 一致;非方形且會轉向者 swap:true
  // 美術頁(tools/art_js_test.html)未載入 data.js 時略過登記,不影響繪製
  if (typeof OBJECTS !== 'undefined') Object.assign(OBJECTS, {
    tree_pine:     { name: '松', icon: '🌲', w: 1, h: 1, on: [T_GRASS], drag: true, cost: { coin: 12 }, side: 'estate' },
    tree_willow:   { name: '柳', icon: '🌳', w: 1, h: 1, on: [T_GRASS], drag: true, cost: { coin: 14 }, side: 'estate' },
    tree_sakura:   { name: '櫻', icon: '🌸', w: 1, h: 1, on: [T_GRASS], drag: true, cost: { coin: 18 }, side: 'estate' },
    tree_maple:    { name: '楓', icon: '🍁', w: 1, h: 1, on: [T_GRASS], drag: true, cost: { coin: 16 }, side: 'estate' },
    tree_mulberry: { name: '桑', icon: '🌿', w: 1, h: 1, on: [T_GRASS], drag: true, cost: { coin: 12 }, side: 'estate' },
    deco_bamboo:   { name: '竹叢', icon: '🎋', w: 1, h: 1, drag: true, on: [T_GRASS], cost: { coin: 15 }, side: 'estate' },
    deco_bush:     { name: '灌木叢', icon: '🌿', w: 1, h: 1, drag: true, on: [T_GRASS], cost: { coin: 8 }, side: 'estate' },
    flower_bed:    { name: '花叢', icon: '🌷', w: 1, h: 1, drag: true, on: [T_GRASS], cost: { coin: 8 }, side: 'estate' },
    deco_rocks:    { name: '石頭群', icon: '🪨', w: 1, h: 1, drag: true, on: [T_GRASS], cost: { coin: 8 }, side: 'estate' },
    stone_lamp:    { name: '石燈', icon: '🏮', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 40 }, side: 'estate' },
    fence_wood:    { name: '木籬笆', icon: '🪵', w: 1, h: 1, on: [T_GRASS, T_ROAD], drag: true, cost: { coin: 4 }, side: 'estate' },
    lantern_line:  { name: '燈籠串', icon: '🏮', w: 2, h: 1, on: [T_GRASS, T_ROAD], swap: true, cost: { coin: 50 }, side: 'estate' },
    deco_brazier:  { name: '火盆', icon: '🔥', w: 1, h: 1, drag: true, on: [T_GRASS], cost: { coin: 30 }, side: 'estate' },
    deco_pond:     { name: '池塘', icon: '💧', w: 2, h: 2, on: [T_GRASS], cost: { coin: 60 }, side: 'estate' },
    tree_peach:    { name: '桃', icon: '🍑', w: 1, h: 1, on: [T_GRASS], drag: true, cost: { coin: 14 }, side: 'estate' },
    tree_cypress:  { name: '柏', icon: '🌲', w: 1, h: 1, on: [T_GRASS], drag: true, cost: { coin: 14 }, side: 'estate' },
    potted_plant:  { name: '盆栽', icon: '🪴', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 20 }, side: 'estate' },
    rockery:       { name: '假山', icon: '⛰️', w: 1, h: 1, drag: true, on: [T_GRASS], cost: { coin: 60 }, side: 'estate' },
    lotus:         { name: '荷花', icon: '🪷', w: 1, h: 1, drag: true, on: [T_LAKE], cost: { coin: 25 }, side: 'estate' },
    reeds:         { name: '蘆葦', icon: '🌾', w: 1, h: 1, drag: true, on: [T_GRASS, T_LAKE], cost: { coin: 12 }, side: 'estate' },
    small_bridge:  { name: '池上小橋', icon: '🌉', w: 1, h: 2, swap: true, on: [T_GRASS, T_ROAD, T_LAKE], cost: { coin: 80 }, side: 'estate' },
    road_stone:    { name: '石板路', icon: '🔲', w: 1, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 4 }, side: 'estate' },
    fence_bamboo:  { name: '竹籬', icon: '🎍', w: 1, h: 1, on: [T_GRASS, T_ROAD], drag: true, cost: { coin: 6 }, side: 'estate' },
    wall_courtyard:{ name: '院牆', icon: '🧱', w: 1, h: 1, on: [T_GRASS, T_ROAD], drag: true, cost: { coin: 10 }, side: 'estate' },
    gate_courtyard:{ name: '院門', icon: '🚪', w: 2, h: 1, on: [T_GRASS, T_ROAD], swap: true, cost: { coin: 45 }, side: 'estate' },
    paifang:       { name: '牌坊', icon: '⛩️', w: 3, h: 1, on: [T_GRASS, T_ROAD], swap: true, cost: { coin: 120 }, side: 'estate' },
    she_altar:     { name: '里社', icon: '🛕', w: 2, h: 2, on: [T_GRASS], cost: { coin: 90 }, side: 'estate' },
    incense_burner:{ name: '香爐', icon: '🏺', w: 1, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 25 }, side: 'estate' },
    stele:         { name: '石碑', icon: '🪦', w: 1, h: 1, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' }
  });
})(ART);
