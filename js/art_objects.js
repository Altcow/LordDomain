// art_objects.js — 美術物件定義(PLAN_ART_STYLE §4.1);依賴 art.js 先載入

(function (A) {
  var C = A.C;
  // ---- 民房 house 2x2:四向;level 1 茅草 / 2 青瓦 / 3 朱柱廡殿 ----
  A.def('house', {
    w: 2, d: 2, hmax: 74,
    build: function (m, v) {
      var lv = v.level || 2, wall = v.skin === 'earth' ? C.earth : C.silk, snow = v.season === 'winter';
      var wh = lv === 3 ? 21 : 18, post = lv === 3 ? C.hanRed : C.wood[1];
      m.box(0.16, 0.2, 0, 1.68, 1.64, 4, C.stone[1], { top: C.stone[2] });
      m.box(0.3, 0.34, 4, 1.4, 1.3, wh, wall, {
        deco: {
          F: function (ctx, f) { A.band(ctx, f, 0, 3, C.earthDk); A.posts(ctx, f, [0, 0.5, 1], 0.09, post); A.door(ctx, f, 0.74, 0.32, 13, lv === 3 ? C.hanRed : C.wood[1]); A.lattice(ctx, f, 0.26, 0.3, 7, 7); },
          L: function (ctx, f) { A.band(ctx, f, 0, 3, C.earthDk); A.posts(ctx, f, [0, 1], 0.09, post); A.lattice(ctx, f, 0.5, 0.34, 8, 6); },
          R: function (ctx, f) { A.band(ctx, f, 0, 3, C.earthDk); A.posts(ctx, f, [0, 1], 0.09, post); A.lattice(ctx, f, 0.5, 0.34, 8, 6); },
          B: function (ctx, f) { A.band(ctx, f, 0, 3, C.earthDk); A.posts(ctx, f, [0, 0.5, 1], 0.09, post); A.lattice(ctx, f, 0.3, 0.24, 9, 5); }
        }
      });
      var z = 4 + wh;
      if (lv === 1) m.gable(0.3, 0.34, z, 1.4, 1.3, 17, C.thatch, { over: 0.2, curl: 0, sag: 0.4, tileDensity: 9, tileW: 1, ridgeCol: C.thatchDk, eaveCol: C.thatchDk, hooks: false, snow: snow, endCol: wall });
      else if (lv === 2) m.gable(0.3, 0.34, z, 1.4, 1.3, 16, C.tile, { over: 0.2, curl: 2.5, sag: 1, ridgeCol: C.tileDk, snow: snow, endCol: wall, hookSize: 3 });
      else m.hip(0.3, 0.34, z, 1.4, 1.3, 18, C.tile, { over: 0.22, curl: 4, sag: 1.5, ridgeCol: C.lacquer, ridgeHi: C.gold, snow: snow, axis: 'u', hipK: 0.55 });
      if (lv >= 2) m.custom(0.34, 1.66, 0.12, 0.1, z - 1, function (ctx, mm) { var p = mm.pt(0.4, 1.7, z - 1); A.lantern(ctx, p[0], p[1], 1); });
      if (lv >= 2) m.box(1.38, 0.86, z + 6, 0.16, 0.16, 15, C.stone[1], { bias: 50, top: C.lacquer });
      if (lv >= 2) m.cyl(1.86, 1.74, 0, 0.09, 8, C.earthDk, { topCol: C.water[0] });
      else { m.box(1.78, 0.5, 0, 0.18, 0.7, 6, C.wood[1]); }
    },
    // 夜間發光點 [u, v, z, 半徑, 色, 強度, 所在面]
    lights: function (v) {
      var lv = v.level || 2, z = 4 + (lv === 3 ? 21 : 18);
      if (lv === 1) return [[0.66, 1.66, 12, 18, C.lamp, 0.55, 'F']];
      return [[0.4, 1.72, z - 6, 22, C.lantern, 0.9, 'F'], [1.34, 1.66, 9, 22, C.lamp, 0.75, 'F'], [0.66, 1.66, 12, 16, C.lamp, 0.5, 'F']];
    },
    anim: function (ctx, m, t, v) {
      var lv = v.level || 2;
      if (lv < 2) return;
      var p = m.pt(1.46, 0.94, 4 + (lv === 3 ? 21 : 18) + 21);
      A.smoke(ctx, p[0], p[1], t, 1.3);
    }
  });
  // ---- 城主府 palace 4x4:台基+重檐廡殿+雙旗 ----
  A.def('palace', {
    w: 4, d: 4, hmax: 132,
    build: function (m, v) {
      var snow = v.season === 'winter';
      m.box(0.12, 0.1, 0, 3.76, 3.42, 10, C.stone[1], { top: C.stone[2], deco: { F: function (ctx, f) { A.band(ctx, f, 7, 10, C.stone[0]); }, L: function (ctx, f) { A.band(ctx, f, 7, 10, C.stone[0]); }, R: function (ctx, f) { A.band(ctx, f, 7, 10, C.stone[0]); }, B: function (ctx, f) { A.band(ctx, f, 7, 10, C.stone[0]); } } });
      m.box(1.35, 3.52, 0, 1.3, 0.24, 7, C.stone[2]);
      m.box(1.35, 3.76, 0, 1.3, 0.2, 3.5, C.stone[2]);
      m.box(0.22, 3.12, 10, 0.24, 0.24, 4, C.stone[0]);
      m.box(3.54, 3.12, 10, 0.24, 0.24, 4, C.stone[0]);
      var colF = function (ctx, f) {
        A.posts(ctx, f, [0, 0.2, 0.4, 0.6, 0.8, 1], 0.12, C.hanRed);
        A.door(ctx, f, 0.5, 0.42, 17, C.hanRed);
        A.lattice(ctx, f, 0.3, 0.3, 8, 9, C.hanRed); A.lattice(ctx, f, 0.7, 0.3, 8, 9, C.hanRed);
        A.lattice(ctx, f, 0.1, 0.28, 8, 9, C.hanRed); A.lattice(ctx, f, 0.9, 0.28, 8, 9, C.hanRed);
      };
      var colS = function (ctx, f) { A.posts(ctx, f, [0, 0.33, 0.67, 1], 0.12, C.hanRed); A.lattice(ctx, f, 0.17, 0.3, 8, 9, C.hanRed); A.lattice(ctx, f, 0.5, 0.3, 8, 9, C.hanRed); A.lattice(ctx, f, 0.83, 0.3, 8, 9, C.hanRed); };
      m.box(0.6, 0.55, 10, 2.8, 2.4, 24, C.silk, { deco: { F: colF, B: colS, L: colS, R: colS } });
      m.hip(0.6, 0.55, 34, 2.8, 2.4, 13, C.tile, { over: 0.34, curl: 5, sag: 2, ridgeCol: C.tileDk, snow: snow, hipK: 0.8 });
      m.box(1.1, 0.95, 40, 1.8, 1.6, 15, C.hanRed, {
        deco: {
          F: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.1, C.lacquer); A.poly(ctx, A.quad(f, 0.3, 0.7, 6, 13), C.lacquer, 0.6); A.poly(ctx, A.quad(f, 0.34, 0.66, 7, 12), A.tone(C.gold, f.light), 0); },
          L: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.1, C.lacquer); A.lattice(ctx, f, 0.5, 0.4, 5, 8, C.gold); },
          R: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.1, C.lacquer); A.lattice(ctx, f, 0.5, 0.4, 5, 8, C.gold); },
          B: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.1, C.lacquer); }
        }
      });
      m.hip(1.1, 0.95, 55, 1.8, 1.6, 22, C.tile, { over: 0.36, curl: 6, sag: 2, ridgeCol: C.lacquer, ridgeHi: C.gold, ridgeW: 4, snow: snow, hipK: 0.55 });
      [1.16, 2.84].forEach(function (u) {
        m.custom(u - 0.06, 3.0, 0.12, 0.1, 31, function (ctx, mm) { var p = mm.pt(u, 3.05, 32); A.lantern(ctx, p[0], p[1], 1.2); });
      });
      [1.08, 2.92].forEach(function (u) {
        m.cyl(u, 3.78, 0, 0.05, 9, C.bronze, { noTop: true });
        m.cyl(u, 3.78, 9, 0.13, 3, C.bronze, { topCol: A.state.lit ? C.fire : C.lacquer });
      });
    },
    lights: function () {
      return [[1.16, 3.05, 26, 24, C.lantern, 0.9, 'F'], [2.84, 3.05, 26, 24, C.lantern, 0.9, 'F'], [2.0, 2.96, 12, 34, C.lamp, 0.8, 'F'],
        [1.08, 3.78, 18, 44, C.fire, 1], [2.92, 3.78, 18, 44, C.fire, 1], [2.0, 1.75, 62, 30, C.lamp, 0.45]];
    },
    animPre: function (ctx, m, t, v) { if (!A.visible(m, 'F')) A.OBJ.palace.flags(ctx, m, t); },
    flags: function (ctx, m, t) {
      var a = m.pt(0.34, 3.24, 14), b = m.pt(3.66, 3.24, 14);
      A.flag(ctx, a[0], a[1], 46, 18, 12, C.hanRed, t, 0);
      A.flag(ctx, b[0], b[1], 46, 18, 12, C.hanRed, t, 1.7);
    },
    anim: function (ctx, m, t, v) {
      if (!A.visible(m, 'F')) return;
      A.OBJ.palace.flags(ctx, m, t);
      if (A.todOf(v).lit) {
        var f1 = m.pt(1.08, 3.78, 12), f2 = m.pt(2.92, 3.78, 12);
        A.fire(ctx, f1[0], f1[1], t, 0.9); A.fire(ctx, f2[0], f2[1], t + 0.4, 0.9);
      }
    }
  });
  // ---- 樹 tree 1x1:對稱,kind/seed/season ----
  A.def('tree', {
    w: 1, d: 1, sym: true, hmax: 62, shadow: 'ellipse',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 0.5, 0);
        ctx.save(); ctx.translate(c[0], c[1]); A.tree(ctx, v.kind || 'round', v.seed || 1, v.season || 'spring'); ctx.restore();
      });
    }
  });
  // ---- 水井 well 1x1:對稱;轆轤+小懸山頂 ----
  A.def('well', {
    w: 1, d: 1, sym: true, hmax: 58,
    build: function (m, v) {
      var snow = v.season === 'winter', thatch = v.skin === 'thatch';
      m.box(0.2, 0.2, 0, 0.6, 0.6, 9, C.stone[1], {
        top: C.stone[2],
        deco: { F: function (ctx, f) { A.band(ctx, f, 5, 6.2, C.stone[0]); }, R: function (ctx, f) { A.band(ctx, f, 5, 6.2, C.stone[0]); } },
        topDeco: function (ctx, mm) {
          A.poly(ctx, [mm.pt(0.31, 0.31, 9), mm.pt(0.69, 0.31, 9), mm.pt(0.69, 0.69, 9), mm.pt(0.31, 0.69, 9)], snow ? '#9cc4dc' : C.water[0], 0.6);
          var c = mm.pt(0.5, 0.5, 9); A.ellipse(ctx, c[0] - 2, c[1] - 1, 4, 1.6, snow ? '#dff0fa' : C.water[2]);
        }
      });
      m.box(0.24, 0.46, 9, 0.07, 0.08, 23, C.wood[1]);
      m.box(0.69, 0.46, 9, 0.07, 0.08, 23, C.wood[1]);
      m.custom(0.24, 0.45, 0.52, 0.1, 30, function (ctx, mm) {
        var a = mm.pt(0.27, 0.5, 26), b = mm.pt(0.73, 0.5, 26), r = mm.pt(0.5, 0.5, 26), bk = mm.pt(0.5, 0.5, 13);
        A.line(ctx, r, bk, '#6b5a40', 1);
        A.poly(ctx, [[bk[0] - 2.6, bk[1] - 4], [bk[0] + 2.6, bk[1] - 4], [bk[0] + 2, bk[1]], [bk[0] - 2, bk[1]]], C.wood[1], 0.7);
        A.line(ctx, a, b, C.ink, 5); A.line(ctx, a, b, C.wood[2], 3.2);
        var e = mm.pt(0.8, 0.5, 26); A.line(ctx, b, e, C.ink, 2.4); A.line(ctx, e, [e[0], e[1] + 4], C.ink, 2.4);
      });
      m.gable(0.24, 0.42, 32, 0.52, 0.16, 9, thatch ? C.thatch : C.tile, { over: 0.13, overEnd: 0.1, curl: thatch ? 0 : 1.5, sag: 0.5, tileDensity: 9, end: false, snow: snow, ridgeCol: thatch ? C.thatchDk : C.tileDk, hooks: !thatch, bias: 1 });
      m.cyl(0.88, 0.86, 0, 0.07, 6, C.wood[1], { topCol: C.water[1] });
    }
  });
  // =====================================================================
  // P1 模板(元件組合 + 參數變體)
  // =====================================================================
  A.def('winejar', {
    w: 1, d: 1, sym: true, hmax: 50, shadow: 'ellipse',
    build: function (m, v) {
      var n = v.level || 1;
      m.custom(0.1, 0.1, 0.8, 0.8, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 0.55, 0);
        if (n === 1) A.jar(ctx, c[0], c[1] + 2, 1);
        else if (n === 2) A.jar(ctx, c[0], c[1] + 3, 1.45);
        else if (n === 3) { A.jar(ctx, c[0] - 8, c[1] + 2, 1); A.jar(ctx, c[0] + 8, c[1] + 2, 1); A.jar(ctx, c[0], c[1] - 14, 0.95); }
        else { A.jar(ctx, c[0] + 10, c[1] - 2, 0.7, false); A.jar(ctx, c[0] - 9, c[1] + 1, 1.2); A.jar(ctx, c[0] + 4, c[1] + 6, 0.85); }
      });
    }
  });
  // 木桶/水桶:skin = empty | water | grain | wine;level 1 大木桶 2 提水桶
  A.def('barrel', {
    w: 1, d: 1, sym: true, hmax: 40, shadow: 'ellipse',
    build: function (m, v) {
      var big = (v.level || 1) === 1, r = big ? 0.2 : 0.12, h = big ? 17 : 9, cnt = v.skin || 'water';
      var top = cnt === 'water' ? C.water[1] : (cnt === 'grain' ? '#f2d27a' : (cnt === 'wine' ? '#7a2a2a' : '#4a2e1c'));
      m.cyl(0.5, 0.52, 0, r, h, C.wood[1], { topCol: top, hoops: big ? [3, h - 3] : [2, h - 2] });
      if (cnt === 'grain') m.custom(0.4, 0.4, 0.2, 0.2, h + 1, function (ctx, mm) { var p = mm.pt(0.5, 0.52, h); A.ellipse(ctx, p[0], p[1] - 1.5, r * 30, r * 14, '#f6dc8a', 0.4); });
      if (!big) m.custom(0.3, 0.3, 0.4, 0.4, h + 2, function (ctx, mm) {
        var a = mm.pt(0.5 - r, 0.52, h), b = mm.pt(0.5 + r, 0.52, h);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, a[1] - 12, b[0], b[1]);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2; ctx.stroke(); ctx.strokeStyle = C.wood[2]; ctx.lineWidth = 1; ctx.stroke();
      });
    }
  });
  // 麻袋/糧袋堆:level = 袋數 1..4;skin 'rice' 蓋紅「米」印
  A.def('sacks', {
    w: 1, d: 1, sym: true, hmax: 40, shadow: 'ellipse',
    build: function (m, v) {
      var n = v.level || 3, stamp = v.skin === 'rice' ? '米' : '';
      m.custom(0.1, 0.1, 0.8, 0.8, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 0.55, 0), pos = [[-8, 2], [8, 2], [0, 6], [0, -9]];
        for (var i = 0; i < n; i++) {
          var x = c[0] + pos[i][0], y = c[1] + pos[i][1];
          ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x - 9, y - 9, x - 3, y - 12); ctx.lineTo(x + 3, y - 12);
          ctx.quadraticCurveTo(x + 9, y - 9, x + 7, y); ctx.quadraticCurveTo(x, y + 2, x - 7, y); ctx.closePath();
          ctx.fillStyle = '#e2c99a'; ctx.fill(); A.edge(ctx, 0.75);
          A.poly(ctx, [[x - 2.5, y - 12], [x + 2.5, y - 12], [x + 1.5, y - 15], [x - 1.5, y - 15]], '#cdb07a', 0.6);
          A.line(ctx, [x - 3, y - 12], [x + 3, y - 12], C.wood[0], 1);
          if (stamp) { A.circle(ctx, x, y - 5.5, 3.2, '#e83a2a'); A.glyph(ctx, stamp, x, y - 5.4, 4.4, '#fff4e0'); }
        }
      });
    }
  });
  // 木箱:level = 箱數
  A.def('crates', {
    w: 1, d: 1, sym: true, hmax: 40,
    build: function (m, v) {
      var plank = function (ctx, f) { A.line(ctx, f.pt(0, f.h / 2), f.pt(1, f.h / 2), A.tone(C.wood[0], f.light), 1); A.line(ctx, f.pt(0, 0), f.pt(1, f.h), A.tone(C.wood[0], f.light), 1); };
      var d = { F: plank, B: plank, L: plank, R: plank };
      m.box(0.12, 0.42, 0, 0.42, 0.42, 12, C.wood[2], { deco: d });
      m.box(0.5, 0.18, 0, 0.36, 0.36, 10, C.wood[1], { deco: d });
      if ((v.level || 3) >= 3) m.box(0.18, 0.46, 12, 0.32, 0.32, 9, C.wood[1], { deco: d });
    }
  });
  // 柴堆:F/B 面畫圓木截面
  A.def('woodpile', {
    w: 1, d: 1, hmax: 36,
    build: function (m) {
      var ends = function (ctx, f) {
        var rows = [[0.18, 0.4, 0.62, 0.84], [0.29, 0.51, 0.73], [0.4, 0.62]];
        for (var r = 0; r < rows.length; r++) for (var i = 0; i < rows[r].length; i++) {
          var p = f.pt(rows[r][i], 3.2 + r * 5.6);
          A.circle(ctx, p[0], p[1], 3.1, A.tone('#e8b878', f.light), 0.7); A.circle(ctx, p[0], p[1], 1.1, A.tone('#b77a40', f.light));
        }
      };
      m.box(0.1, 0.3, 0, 0.8, 0.4, 16, C.wood[1], { top: C.wood[2], deco: { F: ends, B: ends } });
    }
  });
  // 草垛
  A.def('haystack', {
    w: 1, d: 1, sym: true, hmax: 44, shadow: 'ellipse',
    build: function (m, v) {
      m.cyl(0.5, 0.5, 0, 0.36, 8, C.thatch, { noTop: true, hoops: [] });
      m.cone(0.5, 0.5, 8, 0.38, 22, C.thatch);
      m.custom(0.2, 0.2, 0.6, 0.6, 31, function (ctx, mm) {
        var p = mm.pt(0.5, 0.5, 30); A.line(ctx, [p[0] - 5, p[1] + 4], [p[0] + 5, p[1] + 3], C.thatchDk, 1.4);
        A.line(ctx, [p[0], p[1]], [p[0] + 1, p[1] - 4], C.thatchDk, 1.4);
        if (v.season === 'winter') A.ellipse(ctx, p[0], p[1] + 4, 9, 5, C.snow);
      });
    }
  });
  // 石磨
  A.def('millstone', {
    w: 1, d: 1, sym: true, hmax: 36, shadow: 'ellipse',
    build: function (m) {
      m.cyl(0.5, 0.5, 0, 0.36, 5, C.stone[1], { topCol: C.stone[2] });
      m.cyl(0.5, 0.5, 5, 0.25, 8, C.stone[1], { topCol: C.stone[2] });
      m.custom(0.2, 0.2, 0.6, 0.6, 14, function (ctx, mm) {
        var a = mm.pt(0.62, 0.5, 11), b = mm.pt(0.92, 0.5, 18); A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, a, b, C.wood[1], 2);
        var h = mm.pt(0.5, 0.5, 13); A.circle(ctx, h[0], h[1], 2, '#3a3230');
        var g = mm.pt(0.3, 0.72, 5); A.ellipse(ctx, g[0], g[1], 4, 1.6, '#f6eed8');
      });
    }
  });
  // 兵器架(兵蘭)
  A.def('weaponrack', {
    w: 1, d: 1, hmax: 50,
    build: function (m) {
      m.box(0.12, 0.42, 0, 0.08, 0.1, 24, C.wood[0]); m.box(0.8, 0.42, 0, 0.08, 0.1, 24, C.wood[0]);
      m.custom(0.1, 0.45, 0.8, 0.12, 25, function (ctx, mm) {
        [9, 21].forEach(function (z) { var a = mm.pt(0.12, 0.47, z), b = mm.pt(0.88, 0.47, z); A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, a, b, C.lacquer, 2); });
        [0.26, 0.4, 0.54, 0.68].forEach(function (u, i) {
          var a = mm.pt(u, 0.52, 1), b = mm.pt(u + 0.02, 0.44, 40);
          A.line(ctx, a, b, C.ink, 2.6); A.line(ctx, a, b, i % 2 ? C.wood[1] : C.hanRed, 1.4);
          A.poly(ctx, [[b[0] - 1.6, b[1]], [b[0], b[1] - 6], [b[0] + 1.6, b[1]]], '#e6eef4', 0.7);
          if (i % 2 === 0) A.poly(ctx, [[b[0] + 0.5, b[1] + 2], [b[0] + 4.5, b[1] + 0.5], [b[0] + 4.5, b[1] + 3.5]], '#e6eef4', 0.6);
          A.circle(ctx, b[0], b[1] + 2, 1.2, C.hanRed);
        });
      }, 1);
    }
  });
  // 箭靶(射侯)
  A.def('target', {
    w: 1, d: 1, hmax: 44,
    build: function (m) {
      m.box(0.3, 0.45, 0, 0.06, 0.08, 18, C.wood[1]); m.box(0.64, 0.45, 0, 0.06, 0.08, 18, C.wood[1]);
      m.custom(0.15, 0.5, 0.7, 0.05, 1, function (ctx, mm) {
        var front = A.visible(mm, 'F');
        A.disc(ctx, mm, 0.5, 0.52, 22, 12, 'u', front ? '#f6efe0' : '#d9b46a');
        if (front) { A.disc(ctx, mm, 0.5, 0.52, 22, 8.5, 'u', C.hanRed, 0.3); A.disc(ctx, mm, 0.5, 0.52, 22, 5, 'u', '#f6efe0', 0.3); A.disc(ctx, mm, 0.5, 0.52, 22, 2.2, 'u', C.gold, 0.3); }
      });
    }
  });
  // 建鼓:木座 + 朱漆鼓 + 羽葆
  A.def('drum', {
    w: 1, d: 1, hmax: 64,
    build: function (m) {
      m.box(0.3, 0.3, 0, 0.4, 0.4, 5, C.lacquer);
      m.custom(0.2, 0.45, 0.6, 0.1, 6, function (ctx, mm) {
        var a = mm.pt(0.5, 0.5, 5), b = mm.pt(0.5, 0.5, 50); A.line(ctx, a, b, C.ink, 3.6); A.line(ctx, a, b, C.hanRed, 2.2);
        A.disc(ctx, mm, 0.5, 0.42, 24, 12, 'u', A.tone(C.hanRed, 0.7));
        A.disc(ctx, mm, 0.5, 0.58, 24, 12, 'u', '#f2dfb2');
        var c = mm.pt(0.5, 0.58, 24); A.circle(ctx, c[0], c[1], 3, C.hanRed); A.circle(ctx, c[0], c[1], 1.2, C.gold);
        var t = mm.pt(0.5, 0.5, 52);
        [[-7, 2, '#3fa385'], [7, 2, C.gold], [-4, -4, C.hanRed], [4, -4, '#3f6fb0'], [0, -6, C.gold]].forEach(function (q) {
          A.ellipse(ctx, t[0] + q[0], t[1] + q[1], 4, 2.4, q[2], 0.6);
        });
      });
    }
  });
  // 籬笆:沿局部 u 方向
  A.def('fence', {
    w: 1, d: 1, hmax: 30,
    build: function (m, v) {
      [0.08, 0.5, 0.92].forEach(function (u) { m.box(u - 0.04, 0.46, 0, 0.08, 0.08, 14, C.wood[1], { top: C.wood[2] }); });
      m.custom(0, 0.47, 1, 0.06, 1, function (ctx, mm) {
        [5, 11].forEach(function (z) { var a = mm.pt(0, 0.5, z), b = mm.pt(1, 0.5, z); A.line(ctx, a, b, C.ink, 3.2); A.line(ctx, a, b, C.wood[2], 1.8); });
        if (v.season === 'winter') { var a2 = mm.pt(0, 0.5, 12.5), b2 = mm.pt(1, 0.5, 12.5); A.line(ctx, a2, b2, C.snow, 2); }
      });
    }
  });
  // 燈籠串(兩柱 + 垂繩 + 4 燈)
  A.def('lanternline', {
    w: 2, d: 1, hmax: 50,
    build: function (m) {
      m.box(0.1, 0.46, 0, 0.08, 0.08, 30, C.hanRed); m.box(1.82, 0.46, 0, 0.08, 0.08, 30, C.hanRed);
      m.custom(0.1, 0.48, 1.8, 0.04, 2, function (ctx, mm) {
        var a = mm.pt(0.14, 0.5, 29), b = mm.pt(1.86, 0.5, 29), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 9];
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
        for (var i = 1; i <= 4; i++) {
          var t = i / 5, u = 1 - t, x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
          A.lantern(ctx, x, y, 0.9);
        }
      });
    },
    lights: function () { return [[0.48, 0.5, 20, 20, C.lantern, 0.8], [0.82, 0.5, 18, 20, C.lantern, 0.8], [1.18, 0.5, 18, 20, C.lantern, 0.8], [1.52, 0.5, 20, 20, C.lantern, 0.8]]; }
  });
  // 石燈(燈臺)
  A.def('stonelamp', {
    w: 1, d: 1, sym: true, hmax: 44,
    build: function (m, v) {
      m.box(0.32, 0.32, 0, 0.36, 0.36, 4, C.stone[1]);
      m.box(0.44, 0.44, 4, 0.12, 0.12, 12, C.stone[1]);
      m.box(0.36, 0.36, 16, 0.28, 0.28, 8, C.stone[1], {
        deco: {
          F: function (ctx, f) { var q = A.quad(f, 0.3, 0.7, 2, 6.5); if (A.state.lit) A.lit(ctx, function () { A.poly(ctx, q, C.lamp, 0); }); else A.poly(ctx, q, '#3a2a26', 0); },
          R: function (ctx, f) { var q = A.quad(f, 0.3, 0.7, 2, 6.5); if (A.state.lit) A.lit(ctx, function () { A.poly(ctx, q, C.lamp, 0); }); else A.poly(ctx, q, '#3a2a26', 0); }
        }
      });
      m.hip(0.36, 0.36, 24, 0.28, 0.28, 7, C.stone[1], { over: 0.08, curl: 1.5, sag: 0.5, tiles: false, hooks: false, snow: v.season === 'winter' });
    },
    lights: function () { return [[0.5, 0.5, 20, 26, C.lamp, 0.9]]; }
  });
  // 田地:level 0 翻土 1 苗 2 青 3 熟;未指定時依季節
  A.def('field', {
    w: 2, d: 2, sym: true, hmax: 30, shadow: 'none',
    build: function (m, v) {
      var stage = v.level !== undefined && v.level !== 0 ? v.level - 1 : ({ spring: 1, summer: 2, autumn: 3, winter: 0 })[v.season || 'spring'];
      var snow = v.season === 'winter';
      m.box(0.06, 0.06, 0, 1.88, 1.88, 3, '#b07a44', { top: snow ? '#eef3f7' : '#9a6a3c' });
      m.custom(0.06, 0.06, 1.88, 1.88, 3.1, function (ctx, mm) {
        for (var r = 0; r < 7; r++) {
          var vv = 0.2 + r * 0.26, a = mm.pt(0.14, vv, 3), b = mm.pt(1.86, vv, 3);
          A.line(ctx, a, b, snow ? '#d6e0e8' : '#7d5230', 2.2);
          if (stage === 0) continue;
          for (var i = 0; i < 8; i++) {
            var p = mm.pt(0.2 + i * 0.22, vv, 3);
            if (stage === 1) A.ellipse(ctx, p[0], p[1] - 1.5, 1.6, 1.2, '#7ccc4c');
            else if (stage === 2) { A.line(ctx, p, [p[0] - 2, p[1] - 6], '#4aa83a', 1.6); A.line(ctx, p, [p[0] + 2, p[1] - 6], '#6cc04a', 1.6); A.line(ctx, p, [p[0], p[1] - 7], '#5ab43e', 1.6); }
            else { A.line(ctx, p, [p[0] - 1.5, p[1] - 8], '#c9a238', 1.4); A.line(ctx, p, [p[0] + 1.5, p[1] - 8], '#c9a238', 1.4); A.ellipse(ctx, p[0] - 1.5, p[1] - 9, 1.3, 2.4, '#ffd24a'); A.ellipse(ctx, p[0] + 1.5, p[1] - 9, 1.3, 2.4, '#f2c23a'); }
          }
        }
      });
    }
  });
  // 營帳(兩坡落地,正面有門)
  A.def('tent', {
    w: 2, d: 2, hmax: 60,
    build: function (m, v) {
      var cloth = v.skin === 'enemy' ? '#e8d27a' : '#f4ead2';
      m.gable(0.2, 0.15, 0, 1.6, 1.7, 34, cloth, { axis: 'v', over: 0, overEnd: 0, curl: 0, sag: 0, tiles: false, hooks: false, ridgeCol: C.hanRed, ridgeW: 3, eaveCol: '#c9b88e', endCol: A.tone(cloth, 0.95), snow: v.season === 'winter' });
      m.custom(0.6, 1.85, 0.8, 0.05, 1, function (ctx, mm) {
        if (!A.visible(mm, 'F')) return;
        var p = [mm.pt(0.72, 1.85, 0), mm.pt(1.28, 1.85, 0), mm.pt(1.0, 1.85, 22)];
        if (A.state.lit) A.lit(ctx, function () { A.poly(ctx, p, C.lamp, 0.7); }); else A.poly(ctx, p, '#3a2a26', 0.7);
        A.poly(ctx, [mm.pt(0.72, 1.85, 0), mm.pt(0.86, 1.85, 0), mm.pt(1.0, 1.85, 22)], A.tone(C.hanRed, 0.9), 0.6);
      }, 1);
    },
    lights: function () { return [[1.0, 1.85, 8, 26, C.lamp, 0.7, 'F']]; },
    anim: function (ctx, m, t) { var p = m.pt(1.0, 1.85, 34); A.flag(ctx, p[0], p[1], 14, 10, 6, C.hanRed, t, 0.5); }
  });
  // 攤位:skin = veg | fruit | cloth | pottery | rice | book | rouge | meat;color = 棚布色
  var STALL = {
    veg: ['#3fa385', '菜'], fruit: ['#f2603c', '果'], cloth: ['#7a5cc8', '布'], pottery: ['#c79650', '陶'],
    rice: ['#e3b95c', '米'], book: ['#3e5c7a', '書'], rouge: ['#e86a9a', '粉'], meat: ['#d23a2c', '肉']
  };
  A.def('stall', {
    w: 2, d: 1, hmax: 56,
    build: function (m, v) {
      var st = STALL[v.skin || 'veg'] || STALL.veg, awn = st[0];
      m.box(0.12, 0.12, 0, 0.07, 0.07, 30, C.wood[1]); m.box(1.81, 0.12, 0, 0.07, 0.07, 30, C.wood[1]);
      m.box(0.1, 0.45, 0, 1.8, 0.42, 10, C.wood[1], { top: C.wood[2], deco: { F: function (ctx, f) { A.poly(ctx, A.quad(f, 0.02, 0.98, 2, 9), A.tone(awn, f.light), 0.5); A.band(ctx, f, 7.5, 9, C.gold); } } });
      m.custom(0.1, 0.5, 1.8, 0.35, 10.5, function (ctx, mm) {
        for (var i = 0; i < 6; i++) { var p = mm.pt(0.28 + i * 0.29, 0.66, 10); A.goods(ctx, v.skin || 'veg', p[0], p[1], i); }
      });
      m.custom(0.05, 0.08, 1.9, 0.5, 30, function (ctx, mm) {
        var n = 8;
        for (var i = 0; i < n; i++) {
          var u0 = 0.05 + 1.9 * i / n, u1 = 0.05 + 1.9 * (i + 1) / n;
          A.poly(ctx, [mm.pt(u0, 0.08, 31), mm.pt(u1, 0.08, 31), mm.pt(u1, 0.58, 24), mm.pt(u0, 0.58, 24)], i % 2 ? '#fbf1dc' : awn, 0.4);
          var c = mm.pt((u0 + u1) / 2, 0.58, 24);
          A.ellipse(ctx, c[0], c[1] + 0.8, 4.4, 2.6, i % 2 ? '#fbf1dc' : awn, 0.4);
        }
        var s = mm.pt(1.0, 0.58, 22); A.poly(ctx, [[s[0] - 5, s[1]], [s[0] + 5, s[1]], [s[0] + 5, s[1] + 8], [s[0] - 5, s[1] + 8]], C.lacquer, 0.6);
        A.glyph(ctx, st[1], s[0], s[1] + 4.2, 6.5, C.gold);
      }, 2);
    },
    lights: function () { return [[1.0, 0.6, 18, 24, C.lamp, 0.6]]; }
  });
  // 商鋪:以民房為底 + 匾額 + 幌子 + 門口陳列;skin = wine|book|cloth|rice|rouge|gamble|smith|herb|brothel
  var SHOP = {
    wine: ['酒', '#3e6fb0', '#fbf6e8', 'pottery'], book: ['書', '#f4ead2', '#2b1d1b', 'book'], cloth: ['布', '#7a5cc8', '#fbf6e8', 'cloth'],
    rice: ['米', '#e3b95c', '#2b1d1b', 'rice'], rouge: ['粉', '#ff8fb0', '#7a1f3a', 'rouge'], gamble: ['賭', '#2b1d1b', '#ffc94a', null],
    smith: ['鐵', '#6f7e8c', '#fbf6e8', null], herb: ['藥', '#3fa385', '#fbf6e8', null], brothel: ['樓', '#e83a5a', '#ffe8a0', null]
  };
  A.def('shop', {
    w: 2, d: 2, hmax: 82,
    build: function (m, v) {
      var sp = SHOP[v.skin || 'wine'] || SHOP.wine, lv = v.skin === 'brothel' || v.skin === 'gamble' ? 3 : 2;
      A.OBJ.house.build(m, { level: lv, season: v.season, skin: v.skin === 'smith' ? 'earth' : '' });
      var z = 4 + (lv === 3 ? 21 : 18);
      m.custom(0.6, 1.66, 0.6, 0.06, z - 2, function (ctx, mm) {
        if (!A.visible(mm, 'F')) return;
        var a = mm.pt(0.62, 1.65, z - 2), b = mm.pt(1.12, 1.65, z - 2);
        A.poly(ctx, [[a[0], a[1]], [b[0], b[1]], [b[0], b[1] - 6], [a[0], a[1] - 6]], C.lacquer, 0.7);
        A.glyph(ctx, sp[0], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 3, 5.5, C.gold);
      }, 1);
      m.custom(1.82, 1.82, 0.1, 0.1, 0, function (ctx, mm) { var p = mm.pt(1.86, 1.86, 0); A.signFlag(ctx, p[0], p[1], 40, sp[0], sp[1], sp[2]); }, 3);
      if (sp[3]) m.custom(0.2, 1.84, 0.6, 0.14, 0, function (ctx, mm) { for (var i = 0; i < 3; i++) { var p = mm.pt(0.3 + i * 0.22, 1.9, 0); A.goods(ctx, sp[3], p[0], p[1], i); } }, 2);
      if (v.skin === 'smith') {
        m.box(0.12, 1.7, 0, 0.3, 0.22, 7, C.stone[0]);
        m.custom(0.12, 1.7, 0.3, 0.22, 8, function (ctx, mm) { var p = mm.pt(0.27, 1.81, 7); A.poly(ctx, [[p[0] - 5, p[1]], [p[0] + 5, p[1]], [p[0] + 3, p[1] - 3], [p[0] - 3, p[1] - 3]], '#4a4e56', 0.7); }, 1);
      }
      if (v.skin === 'brothel' || v.skin === 'gamble') m.custom(1.2, 1.7, 0.3, 0.1, z - 1, function (ctx, mm) { var p = mm.pt(1.5, 1.72, z - 1); A.lantern(ctx, p[0], p[1], 1); }, 1);
    },
    lights: function (v) {
      var L = A.OBJ.house.lights({ level: 2 });
      if (v.skin === 'smith') L = L.concat([[0.27, 1.81, 8, 30, C.fire, 1]]);
      if (v.skin === 'brothel' || v.skin === 'gamble') L = L.concat([[1.5, 1.72, 18, 26, '#ff5a8a', 0.9, 'F']]);
      return L;
    }
  });
  // 車:skin = hay | goods | empty | fancy(華麗馬車,有篷);局部 W1 × D2,正面 = 車轅方向
  A.def('cart', {
    w: 1, d: 2, hmax: 60,
    build: function (m, v) {
      var k = v.skin || 'hay';
      var wheel = function (u) {
        m.custom(u - 0.02, 0.6, 0.04, 0.6, 1, function (ctx, mm) {
          A.disc(ctx, mm, u, 0.9, 11, 11, 'v', k === 'fancy' ? C.hanRed : C.wood[1]);
          A.disc(ctx, mm, u, 0.9, 11, 7.5, 'v', A.tone(k === 'fancy' ? C.hanRed : C.wood[1], 0.8), 0.4);
          for (var i = 0; i < 4; i++) { var a = i * Math.PI / 4; A.line(ctx, mm.pt(u, 0.9 + Math.cos(a) * 10 / 34, 11 + Math.sin(a) * 10), mm.pt(u, 0.9 - Math.cos(a) * 10 / 34, 11 - Math.sin(a) * 10), C.wood[0], 1.2); }
          var h = mm.pt(u, 0.9, 11); A.circle(ctx, h[0], h[1], 2, C.gold, 0.6);
        });
      };
      wheel(0.04); wheel(0.96);
      m.box(0.14, 0.3, 9, 0.72, 1.3, 5, k === 'fancy' ? C.hanRed : C.wood[1], { top: C.wood[2] });
      m.custom(0.2, 1.6, 0.6, 0.38, 10, function (ctx, mm) {
        [0.3, 0.7].forEach(function (u) { var a = mm.pt(u, 1.6, 12), b = mm.pt(u, 1.98, 9); A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, a, b, C.wood[1], 2); });
        var y0 = mm.pt(0.25, 1.95, 10), y1 = mm.pt(0.75, 1.95, 10); A.line(ctx, y0, y1, C.ink, 3); A.line(ctx, y0, y1, C.wood[2], 1.6);
      });
      if (k === 'hay') {
        m.hip(0.12, 0.28, 14, 0.76, 1.34, 14, C.thatch, { over: 0.04, curl: 0, sag: -1, tileDensity: 9, ridgeCol: C.thatchDk, eaveCol: C.thatchDk, hooks: false, hipK: 1, snow: v.season === 'winter' });
      } else if (k === 'goods') {
        m.custom(0.14, 0.3, 0.72, 1.3, 14, function (ctx, mm) {
          var p = mm.pt(0.5, 0.65, 14), q = mm.pt(0.5, 1.2, 14);
          A.jar(ctx, p[0], p[1] + 2, 0.7); A.poly(ctx, [[q[0] - 7, q[1]], [q[0] + 7, q[1]], [q[0] + 6, q[1] - 9], [q[0] - 6, q[1] - 9]], '#e2c99a', 0.7);
          A.circle(ctx, q[0], q[1] - 4.5, 2.6, '#e83a2a'); A.glyph(ctx, '米', q[0], q[1] - 4.4, 3.8, '#fff4e0');
        });
      } else if (k === 'fancy') {
        m.box(0.18, 0.4, 14, 0.64, 0.9, 16, C.silk, { deco: { F: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.08, C.hanRed); A.lattice(ctx, f, 0.5, 0.36, 4, 9, C.hanRed); }, L: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.08, C.hanRed); A.lattice(ctx, f, 0.5, 0.4, 4, 9, C.hanRed); }, R: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.08, C.hanRed); A.lattice(ctx, f, 0.5, 0.4, 4, 9, C.hanRed); }, B: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.08, C.hanRed); } } });
        m.hip(0.18, 0.4, 30, 0.64, 0.9, 10, C.tile, { over: 0.12, curl: 3, sag: 1, ridgeCol: C.lacquer, ridgeHi: C.gold, snow: v.season === 'winter' });
      }
    }
  });
  // 牛車/馬車 = 車 + 動物(W1 × D3)
  A.def('oxcart', {
    w: 1, d: 3, hmax: 64,
    build: function (m, v) {
      // 車在局部 v 0..2(與 cart 相同座標),動物在 v 2..3
      A.OBJ.cart.build(m, { skin: v.skin === 'fancy' ? 'fancy' : (v.skin || 'goods'), season: v.season });
      var an = A.ANIMAL[v.skin === 'fancy' ? 'whitehorse' : 'ox'];
      m.custom(0.1, 2.05, 0.8, 0.9, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 2.5, 0), f = mm.f;
        ctx.save(); ctx.translate(c[0], c[1] + 2); if (f === 2 || f === 3) ctx.scale(-1, 1);
        A.animalRaw(ctx, an, f === 1 || f === 2, 0); ctx.restore();
      });
    }
  });
  // ---- 自然小物 ----
  A.def('rocks', {
    w: 1, d: 1, sym: true, hmax: 30, shadow: 'ellipse',
    build: function (m, v) {
      var n = v.level || 2, sn = v.season === 'winter';
      m.custom(0.1, 0.1, 0.8, 0.8, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 0.55, 0), pos = [[-4, 0, 1.15], [9, 2, 0.7], [-11, 4, 0.55]];
        for (var i = 0; i < n; i++) {
          A.rock(ctx, c[0] + pos[i][0], c[1] + pos[i][1], pos[i][2], i + 3, C.stone[1]);
          if (sn) A.ellipse(ctx, c[0] + pos[i][0] - 1, c[1] + pos[i][1] - 8 * pos[i][2], 6 * pos[i][2], 2.4 * pos[i][2], C.snow);
        }
      });
    }
  });
  A.def('bush', {
    w: 1, d: 1, sym: true, hmax: 30, shadow: 'ellipse',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 0.5, 0), sn = v.season === 'winter', rnd = A.rng(v.seed || 5);
        var col = sn ? ['#7a6a5a', '#9a8a78', '#c8bcae'] : (A.LEAF.round[v.season || 'spring'] || A.LEAF.round.spring);
        var bl = [[c[0] - 6, c[1] - 6, 6.5], [c[0] + 6, c[1] - 6, 6.5], [c[0], c[1] - 11, 7]];
        bl.forEach(function (b) { A.circle(ctx, b[0] + 1.2, b[1] + 1.5, b[2], col[0]); });
        bl.forEach(function (b) { A.circle(ctx, b[0] - 0.3, b[1] - 0.4, b[2] - 1, col[1]); });
        bl.forEach(function (b) { A.circle(ctx, b[0] - b[2] * 0.3, b[1] - b[2] * 0.35, b[2] * 0.4, col[2]); });
        if (v.skin === 'flower' && !sn) for (var i = 0; i < 7; i++) A.circle(ctx, c[0] - 10 + rnd() * 20, c[1] - 15 + rnd() * 11, 1.6, ['#ff6f9a', '#ffd24a', '#ffffff', '#b07ce8'][i % 4], 0.3);
        if (sn) A.ellipse(ctx, c[0], c[1] - 15, 8, 3, C.snow);
      });
    }
  });
  A.def('bamboo', {
    w: 1, d: 1, sym: true, hmax: 64, shadow: 'ellipse',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 0.5, 0), rnd = A.rng(v.seed || 9), sn = v.season === 'winter';
        var xs = [-9, -4, 1, 5, 9, -1];
        xs.forEach(function (x, i) {
          var h = 34 + rnd() * 18, b = [c[0] + x, c[1] + (i % 2) * 2], t = [c[0] + x + (rnd() - 0.5) * 4, c[1] - h];
          A.line(ctx, b, t, C.ink, 3.4); A.line(ctx, b, t, i % 2 ? '#6cbf4a' : '#4fa63c', 2);
          for (var k = 1; k < 4; k++) { var p = [b[0] + (t[0] - b[0]) * k / 4, b[1] + (t[1] - b[1]) * k / 4]; A.line(ctx, [p[0] - 1.5, p[1]], [p[0] + 1.5, p[1]], '#2f7a2f', 1); }
          for (var j = 0; j < 3; j++) {
            var q = [t[0] + (rnd() - 0.5) * 6, t[1] + j * 7 + rnd() * 3], a = (rnd() - 0.5) * 1.6;
            ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(a); A.ellipse(ctx, 4, 0, 5, 1.6, j % 2 ? '#86d65e' : '#4fa63c', 0.5); ctx.restore();
            if (sn && j === 0) A.ellipse(ctx, q[0] + 2, q[1] - 1.5, 3.5, 1.4, C.snow);
          }
        });
      });
    }
  });
  A.def('pond', {
    w: 2, d: 2, sym: true, hmax: 20, shadow: 'none',
    build: function (m, v) {
      var ice = v.season === 'winter';
      m.custom(0, 0, 2, 2, 0, function (ctx, mm) {
        var rim = [], wat = [], i;
        for (i = 0; i < 16; i++) {
          var a = i / 16 * Math.PI * 2, k = 0.82 + 0.08 * Math.sin(i * 2.7);
          rim.push(mm.pt(1 + Math.cos(a) * 0.86 * k, 1 + Math.sin(a) * 0.86 * k, 0));
          wat.push(mm.pt(1 + Math.cos(a) * 0.72 * k, 1 + Math.sin(a) * 0.72 * k, -2));
        }
        A.poly(ctx, rim, C.stone[1], 0.7);
        A.poly(ctx, wat, ice ? '#bfe0f0' : C.water[1], 0.6);
        var c = mm.pt(1, 1, -2);
        if (ice) { A.line(ctx, [c[0] - 14, c[1] - 2], [c[0] + 6, c[1] + 4], '#ffffff', 1.5); A.line(ctx, [c[0] - 2, c[1] - 6], [c[0] + 14, c[1] - 1], '#ffffff', 1.5); }
        else {
          A.ellipse(ctx, c[0] - 10, c[1] - 3, 9, 3, C.water[2]);
          [[12, 2], [-6, 7], [4, -6]].forEach(function (p) { A.ellipse(ctx, c[0] + p[0], c[1] + p[1], 5, 2.6, '#4fa63c', 0.5); });
          if (v.season === 'summer') A.circle(ctx, c[0] + 12, c[1], 2.2, '#ff8fb0', 0.4);
        }
      });
    }
  });
  // ---- 光源小物 ----
  A.def('brazier', {
    w: 1, d: 1, sym: true, hmax: 40,
    build: function (m) {
      m.custom(0.3, 0.3, 0.4, 0.4, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 0.5, 0);
        [[-6, 2], [6, 2], [0, 5]].forEach(function (l) { A.line(ctx, [c[0] + l[0], c[1] + l[1]], [c[0] + l[0] * 0.4, c[1] - 12], C.ink, 2.8); A.line(ctx, [c[0] + l[0], c[1] + l[1]], [c[0] + l[0] * 0.4, c[1] - 12], C.bronze, 1.5); });
      });
      m.cyl(0.5, 0.5, 12, 0.16, 5, C.bronze, { topCol: C.lacquer });
    },
    lights: function () { return [[0.5, 0.5, 22, 44, C.fire, 1]]; },
    anim: function (ctx, m, t) { var p = m.pt(0.5, 0.5, 17); A.fire(ctx, p[0], p[1], t, 0.9); }
  });
  A.def('campfire', {
    w: 1, d: 1, sym: true, hmax: 30, shadow: 'none',
    build: function (m) {
      m.custom(0.15, 0.15, 0.7, 0.7, 0, function (ctx, mm) {
        for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2, p = mm.pt(0.5 + Math.cos(a) * 0.28, 0.5 + Math.sin(a) * 0.28, 0); A.ellipse(ctx, p[0], p[1] - 1.5, 3.4, 2.4, C.stone[1], 0.7); }
        var c = mm.pt(0.5, 0.5, 0);
        A.line(ctx, [c[0] - 7, c[1] + 1], [c[0] + 7, c[1] - 3], C.ink, 3.6); A.line(ctx, [c[0] - 7, c[1] + 1], [c[0] + 7, c[1] - 3], C.wood[1], 2.4);
        A.line(ctx, [c[0] - 7, c[1] - 3], [c[0] + 7, c[1] + 1], C.ink, 3.6); A.line(ctx, [c[0] - 7, c[1] - 3], [c[0] + 7, c[1] + 1], C.wood[2], 2.4);
      });
    },
    lights: function () { return [[0.5, 0.5, 6, 46, C.fire, 1]]; },
    anim: function (ctx, m, t) { var p = m.pt(0.5, 0.5, 2); A.fire(ctx, p[0], p[1], t, 1.1); }
  });
  // ---- 糧倉(陶倉圓囷)/灶 ----
  A.def('granary', {
    w: 1, d: 1, sym: true, hmax: 54,
    build: function (m, v) {
      m.cyl(0.5, 0.5, 0, 0.3, 4, C.stone[1], { topCol: C.stone[2] });
      m.cyl(0.5, 0.5, 4, 0.26, 20, C.earth, { noTop: true, hoops: [6, 14] });
      m.cone(0.5, 0.5, 23, 0.36, 16, C.tile);
      m.custom(0.3, 0.3, 0.4, 0.4, 25, function (ctx, mm) {
        var c = mm.pt(0.5, 0.5, 23), ap = [c[0], c[1] - 16];
        for (var i = -3; i <= 3; i++) A.line(ctx, [c[0] + i * 4.6, c[1] + 7.5 - Math.abs(i) * 0.9], ap, A.tone(C.tile, 0.7), 0.9);
        A.circle(ctx, ap[0], ap[1], 2, C.tileDk);
        if (v.season === 'winter') A.poly(ctx, [[ap[0] - 8, ap[1] + 8], ap, [ap[0] + 8, ap[1] + 8], [ap[0], ap[1] + 10]], C.snow, 0.3);
        var d = mm.pt(0.5, 0.5, 12); A.poly(ctx, [[d[0] - 6, d[1] + 2], [d[0] - 1, d[1] + 4], [d[0] - 1, d[1] - 3], [d[0] - 6, d[1] - 5]], C.wood[0], 0.6);
      }, 1);
    }
  });
  A.def('stove', {
    w: 1, d: 1, hmax: 50,
    build: function (m) {
      m.box(0.12, 0.25, 0, 0.76, 0.55, 12, C.earth, {
        top: A.tone(C.earth, 0.95),
        deco: { F: function (ctx, f) { var q = A.quad(f, 0.38, 0.62, 1, 7); if (A.state.lit) A.lit(ctx, function () { A.poly(ctx, q, C.fire, 0.5); }); else A.poly(ctx, q, '#3a2a26', 0.5); } }
      });
      m.cyl(0.38, 0.52, 12, 0.14, 4, C.lacquer, { topCol: '#5a4a44' });
      m.cyl(0.68, 0.52, 12, 0.1, 6, '#8a8f99', { topCol: '#c8ccd2' });
      m.cyl(0.72, 0.3, 12, 0.05, 16, C.earthDk, { topCol: C.lacquer });
    },
    lights: function () { return [[0.5, 0.8, 5, 28, C.fire, 0.9, 'F']]; },
    anim: function (ctx, m, t) { var p = m.pt(0.72, 0.3, 28); A.smoke(ctx, p[0], p[1], t, 2.1); }
  });
  // ---- 軍事小物 ----
  A.def('jumaa', {
    w: 1, d: 1, hmax: 34,
    build: function (m) {
      m.custom(0, 0.3, 1, 0.4, 0, function (ctx, mm) {
        var a = mm.pt(0.05, 0.5, 9), b = mm.pt(0.95, 0.5, 9); A.line(ctx, a, b, C.ink, 4); A.line(ctx, a, b, C.wood[1], 2.6);
        [0.2, 0.5, 0.8].forEach(function (u) {
          [[0.25, 0.75], [0.75, 0.25]].forEach(function (vv) {
            var p = mm.pt(u, vv[0], 0), q = mm.pt(u, vv[1], 20); A.line(ctx, p, q, C.ink, 3.4); A.line(ctx, p, q, C.wood[2], 2);
            A.poly(ctx, [[q[0] - 1.5, q[1] + 1], [q[0], q[1] - 3], [q[0] + 1.5, q[1] + 1]], '#e6eef4', 0.5);
          });
        });
      });
    }
  });
  A.def('flagpole', {
    w: 1, d: 1, sym: true, hmax: 30,
    build: function (m) { m.box(0.36, 0.36, 0, 0.28, 0.28, 6, C.stone[1]); },
    anim: function (ctx, m, t, v) { var p = m.pt(0.5, 0.5, 6); A.flag(ctx, p[0], p[1], 70, 26, 18, v.skin === 'enemy' ? '#ffd23a' : C.hanRed, t, 0.3); }
  });
  A.def('palisade', {
    w: 1, d: 1, hmax: 40,
    build: function (m, v) {
      [0.1, 0.3, 0.5, 0.7, 0.9].forEach(function (u) {
        m.box(u - 0.07, 0.43, 0, 0.14, 0.14, 22, C.wood[1], { top: C.wood[2] });
        m.custom(u - 0.07, 0.43, 0.14, 0.14, 22, function (ctx, mm) { var a = mm.pt(u - 0.07, 0.57, 22), b = mm.pt(u + 0.07, 0.57, 22), c = mm.pt(u, 0.5, 30); A.poly(ctx, [a, b, c], C.wood[2], 0.7); });
      });
      m.custom(0, 0.42, 1, 0.1, 1, function (ctx, mm) { var a = mm.pt(0, 0.6, 14), b = mm.pt(1, 0.6, 14); A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, a, b, C.wood[0], 2); });
    }
  });
  // 城牆段(夯土/石)+ 女牆
  A.def('wallseg', {
    w: 1, d: 1, hmax: 50,
    build: function (m, v) {
      var stone = v.skin !== 'earth', col = stone ? C.stone[1] : C.earth, snow = v.season === 'winter';
      var lines = function (ctx, f) { for (var z = 6; z < 28; z += 6) A.line(ctx, f.pt(0, z), f.pt(1, z), A.tone(col, f.light * 0.82), 1); };
      // 依相鄰城牆決定延伸方向:v.skin 含 'x' 表示 x 軸向有鄰牆,含 'y' 表示 y 軸向有鄰牆
      var sk = v.skin || '', cx = sk.indexOf('x') >= 0, cy = sk.indexOf('y') >= 0;
      if (!cx && !cy) cx = true;
      if (cx) {
        m.box(0, 0.2, 0, 1, 0.6, 28, col, { top: snow ? C.snow : A.tone(col, 1.08), deco: { F: lines, B: lines, L: lines, R: lines } });
        [0.05, 0.4, 0.75].forEach(function (u) { m.box(u, 0.62, 28, 0.2, 0.16, 7, col, { top: snow ? C.snow : undefined }); });
      }
      if (cy) {
        m.box(0.2, 0, 0, 0.6, 1, 28, col, { top: snow ? C.snow : A.tone(col, 1.08), deco: { F: lines, B: lines, L: lines, R: lines } });
        [0.05, 0.4, 0.75].forEach(function (u) { m.box(0.62, u, 28, 0.16, 0.2, 7, col, { top: snow ? C.snow : undefined }); });
      }
    }
  });
  // 闕:台基 + 闕身 + 雙層檐;成對(3x1,中間通道)
  A.def('que', {
    w: 3, d: 1, hmax: 112,
    build: function (m, v) {
      var snow = v.season === 'winter';
      [0, 2].forEach(function (u0) {
        m.box(u0 + 0.05, 0.1, 0, 0.9, 0.8, 8, C.stone[1], { top: C.stone[2] });
        var deco = function (ctx, f) { A.band(ctx, f, 10, 13, C.hanRed); A.band(ctx, f, 28, 31, C.hanRed); A.posts(ctx, f, [0, 1], 0.1, C.hanRed); };
        m.box(u0 + 0.18, 0.22, 8, 0.64, 0.56, 34, C.silk, { deco: { F: deco, B: deco, L: deco, R: deco } });
        m.hip(u0 + 0.18, 0.22, 42, 0.64, 0.56, 9, C.tile, { over: 0.16, curl: 3, sag: 1, snow: snow, ridgeCol: C.tileDk });
        m.box(u0 + 0.3, 0.32, 49, 0.4, 0.36, 10, C.hanRed);
        m.hip(u0 + 0.3, 0.32, 59, 0.4, 0.36, 12, C.tile, { over: 0.16, curl: 4, sag: 1, snow: snow, ridgeCol: C.lacquer, ridgeHi: C.gold });
      });
    },
    lights: function () { return [[0.5, 0.95, 40, 22, C.lantern, 0.7, 'F'], [2.5, 0.95, 40, 22, C.lantern, 0.7, 'F']]; }
  });
  // 望樓:木構三層 + 頂小廡殿 + 頂層火盆
  A.def('watchtower', {
    w: 2, d: 2, hmax: 150,
    build: function (m, v) {
      var snow = v.season === 'winter';
      [[0.35, 0.35], [1.53, 0.35], [0.35, 1.53], [1.53, 1.53]].forEach(function (p) { m.box(p[0], p[1], 0, 0.12, 0.12, 84, C.wood[1]); });
      m.custom(0.35, 0.35, 1.3, 1.3, 1, function (ctx, mm) {
        [[0.41, 1.59, 1.59, 1.59], [1.59, 0.41, 1.59, 1.59]].forEach(function (s) {
          A.line(ctx, mm.pt(s[0], s[1], 4), mm.pt(s[2], s[3], 40), C.wood[0], 1.6);
          A.line(ctx, mm.pt(s[0], s[1], 40), mm.pt(s[2], s[3], 4), C.wood[0], 1.6);
        });
      }, 1);
      m.box(0.25, 0.25, 40, 1.5, 1.5, 3, C.wood[2]);
      m.box(0.2, 0.2, 84, 1.6, 1.6, 4, C.wood[2], { deco: { F: function (ctx, f) { A.band(ctx, f, 0, 4, C.hanRed); }, R: function (ctx, f) { A.band(ctx, f, 0, 4, C.hanRed); } } });
      m.custom(0.2, 0.2, 1.6, 1.6, 88, function (ctx, mm) {
        [[0.2, 1.8, 1.8, 1.8], [1.8, 0.2, 1.8, 1.8]].forEach(function (s) {
          A.line(ctx, mm.pt(s[0], s[1], 96), mm.pt(s[2], s[3], 96), C.ink, 3); A.line(ctx, mm.pt(s[0], s[1], 96), mm.pt(s[2], s[3], 96), C.hanRed, 1.8);
        });
      }, 1);
      [[0.3, 0.3], [1.62, 0.3], [0.3, 1.62], [1.62, 1.62]].forEach(function (p) { m.box(p[0], p[1], 88, 0.08, 0.08, 18, C.hanRed, { bias: 1 }); });
      m.hip(0.3, 0.3, 106, 1.4, 1.4, 22, C.tile, { over: 0.2, curl: 5, sag: 1.5, snow: snow, ridgeCol: C.lacquer, bias: 2 });
    },
    lights: function () { return [[1, 1, 96, 40, C.fire, 0.9]]; }
  });
  // 望樓頂層火盆:烘焙在模型內(位於屋頂之下,不能用後畫的動畫件,否則會蓋到屋頂上)
  (function () {
    var b = A.OBJ.watchtower.build;
    A.OBJ.watchtower.build = function (m, v) {
      b(m, v);
      m.custom(0.85, 0.85, 0.3, 0.3, 89, function (ctx, mm) {
        var p = mm.pt(1, 1, 89); A.poly(ctx, [[p[0] - 5, p[1]], [p[0] + 5, p[1]], [p[0] + 3.5, p[1] + 3], [p[0] - 3.5, p[1] + 3]], C.bronze, 0.6);
        if (A.state.lit) A.lit(ctx, function () { A.fire(ctx, p[0], p[1], 0, 0.8); });
      }, 1.5);
    };
  })();
  // 城門(門樓)3x1
  A.def('gatehouse', {
    w: 3, d: 1, hmax: 112,
    build: function (m, v) {
      var snow = v.season === 'winter';
      var arch = function (ctx, f) {
        var q = A.quad(f, 0.36, 0.64, 0, 18);
        A.poly(ctx, q, '#2a1c18', 0.6);
        ctx.beginPath(); var a = f.pt(0.36, 18), b = f.pt(0.64, 18), c = f.pt(0.5, 26); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1] - 2, b[0], b[1]); ctx.closePath(); ctx.fillStyle = '#2a1c18'; ctx.fill();
        A.poly(ctx, A.quad(f, 0.38, 0.5, 0, 16), A.tone(C.hanRed, f.light), 0.6); A.poly(ctx, A.quad(f, 0.5, 0.62, 0, 16), A.tone(C.hanRed, f.light * 0.92), 0.6);
        for (var i = 0; i < 3; i++) for (var j = 0; j < 2; j++) { var p = f.pt(0.41 + j * 0.15, 4 + i * 5); A.circle(ctx, p[0], p[1], 0.8, C.gold); }
        for (var z = 6; z < 34; z += 7) { A.line(ctx, f.pt(0, z), f.pt(0.34, z), A.tone(C.stone[1], f.light * 0.82), 1); A.line(ctx, f.pt(0.66, z), f.pt(1, z), A.tone(C.stone[1], f.light * 0.82), 1); }
      };
      m.box(0, 0.05, 0, 3, 0.9, 34, C.stone[1], { top: C.stone[2], deco: { F: arch, B: arch } });
      var colF = function (ctx, f) { A.posts(ctx, f, [0, 0.25, 0.5, 0.75, 1], 0.1, C.hanRed); A.lattice(ctx, f, 0.375, 0.3, 4, 9, C.hanRed); A.lattice(ctx, f, 0.625, 0.3, 4, 9, C.hanRed); };
      m.box(0.45, 0.2, 34, 2.1, 0.6, 16, C.silk, { deco: { F: colF, B: colF, L: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.1, C.hanRed); }, R: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.1, C.hanRed); } } });
      m.hip(0.45, 0.2, 50, 2.1, 0.6, 18, C.tile, { over: 0.26, curl: 5, sag: 2, snow: snow, ridgeCol: C.lacquer, ridgeHi: C.gold });
    },
    lights: function () { return [[0.9, 0.95, 44, 24, C.lantern, 0.8, 'F'], [2.1, 0.95, 44, 24, C.lantern, 0.8, 'F'], [1.5, 0.95, 10, 30, C.lamp, 0.5, 'F']]; }
  });
  // 營寨門:兩座木哨台 + 橫樑匾「營」
  A.def('campgate', {
    w: 3, d: 1, hmax: 110,
    build: function (m, v) {
      [0.1, 2.3].forEach(function (u0) {
        [[0, 0.15], [0.48, 0.15], [0, 0.73], [0.48, 0.73]].forEach(function (p) { m.box(u0 + p[0], p[1], 0, 0.1, 0.1, 52, C.wood[1]); });
        m.box(u0 - 0.04, 0.1, 44, 0.66, 0.8, 4, C.wood[2], { deco: { F: function (ctx, f) { A.band(ctx, f, 0, 4, C.wood[0]); } } });
        m.gable(u0, 0.15, 60, 0.58, 0.7, 12, C.thatch, { over: 0.12, curl: 0, sag: 0, tileDensity: 9, ridgeCol: C.thatchDk, eaveCol: C.thatchDk, hooks: false, snow: v.season === 'winter', end: false, bias: 1 });
        m.box(u0, 0.15, 48, 0.58, 0.04, 12, C.wood[1], { bias: 1 });
      });
      m.custom(0.6, 0.4, 1.8, 0.2, 54, function (ctx, mm) {
        var a = mm.pt(0.6, 0.5, 54), b = mm.pt(2.4, 0.5, 54); A.line(ctx, a, b, C.ink, 5); A.line(ctx, a, b, C.wood[1], 3.4);
        var c = mm.pt(1.5, 0.5, 50); A.poly(ctx, [[c[0] - 8, c[1] - 6], [c[0] + 8, c[1] - 6], [c[0] + 8, c[1] + 4], [c[0] - 8, c[1] + 4]], C.lacquer, 0.7);
        A.glyph(ctx, '營', c[0], c[1] - 0.8, 7, C.gold);
      }, 3);
    },
    lights: function () { return [[0.4, 0.5, 62, 36, C.fire, 0.8], [2.6, 0.5, 62, 36, C.fire, 0.8]]; },
    anim: function (ctx, m, t, v) {
      var a = m.pt(0.15, 0.2, 64), b = m.pt(2.95, 0.2, 64);
      A.flag(ctx, a[0], a[1], 26, 14, 9, v.skin === 'enemy' ? '#ffd23a' : C.hanRed, t, 0); A.flag(ctx, b[0], b[1], 26, 14, 9, v.skin === 'enemy' ? '#ffd23a' : C.hanRed, t, 1);
    }
  });
  A.def('bridge', {
    w: 1, d: 1, hmax: 30, shadow: 'none',
    build: function (m, v) {
      m.box(0.1, 0, 2, 0.8, 1, 3, C.wood[1], { top: C.wood[2], topDeco: function (ctx, mm) { for (var i = 1; i < 6; i++) A.line(ctx, mm.pt(0.1, i / 6, 5), mm.pt(0.9, i / 6, 5), C.wood[0], 0.8); } });
      [0.1, 0.84].forEach(function (u) { m.box(u, 0, 5, 0.06, 1, 2, C.hanRed, { bias: 1 }); [0.02, 0.5, 0.92].forEach(function (vv) { m.box(u, vv, 5, 0.06, 0.06, 9, C.hanRed, { bias: 1, top: v.season === 'winter' ? C.snow : undefined }); }); });
      m.custom(0, 0, 1, 1, 13, function (ctx, mm) { [0.13, 0.87].forEach(function (u) { A.line(ctx, mm.pt(u, 0, 13), mm.pt(u, 1, 13), C.ink, 3); A.line(ctx, mm.pt(u, 0, 13), mm.pt(u, 1, 13), C.hanRed, 1.8); }); }, 2);
    }
  });
  // 斜坡:局部 u=0 為上坡側(高 A.HL 一階)、u=0.75 處斜面止於低平台(高 3px)、u=1 為平台端;v 0..2 為寬 2 格
  A.def('ramp', {
    w: 1, d: 2, hmax: 26, shadow: 'none',
    build: function (m, v) {
      var top = A.HL, zl = 3, ul = 0.75;
      var zs = function (u) { return u <= ul ? top + (zl - top) * u / ul : zl; };
      var P = function (u, w, z) { return m.pt(u, w, z); };
      // 世界法線朝 +x / +y 的面才看得到;回傳該面明度,看不到回傳 0
      var side = function (k) { var wd = m.wdir(k); return wd === '+y' ? A.LIGHT.L : (wd === '+x' ? A.LIGHT.R : 0); };
      var rail = function (ctx, w) {
        var a = P(0, w, top + 6), b = P(ul, w, zl + 6), c = P(1, w, zl + 6);
        A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, b, c, C.ink, 3.4);
        A.line(ctx, a, b, C.wood[2], 1.8); A.line(ctx, b, c, C.wood[2], 1.8);
        [0, 0.375, 0.75, 1].forEach(function (u) {
          var p0 = P(u, w, zs(u)), p1 = P(u, w, zs(u) + 6);
          A.line(ctx, p0, p1, C.ink, 2.6); A.line(ctx, p0, p1, C.wood[1], 1.2);
        });
      };
      m.custom(0, 0, 1, 2, 0, function (ctx) {
        var lt;
        // 可見的側面與端面先畫(互不重疊)
        lt = side('F'); if (lt) A.poly(ctx, [P(0, 2, 0), P(0, 2, top), P(ul, 2, zl), P(1, 2, zl), P(1, 2, 0)], A.tone(C.wood[1], lt), 0.8);
        lt = side('B'); if (lt) A.poly(ctx, [P(0, 0, 0), P(0, 0, top), P(ul, 0, zl), P(1, 0, zl), P(1, 0, 0)], A.tone(C.wood[1], lt), 0.8);
        lt = side('L'); if (lt) A.poly(ctx, [P(0, 0, 0), P(0, 0, top), P(0, 2, top), P(0, 2, 0)], A.tone(C.wood[0], lt), 0.8);
        lt = side('R'); if (lt) A.poly(ctx, [P(1, 0, 0), P(1, 0, zl), P(1, 2, zl), P(1, 2, 0)], A.tone(C.wood[0], lt), 0.8);
        // 斜面與低平台頂
        A.poly(ctx, [P(0, 0, top), P(0, 2, top), P(ul, 2, zl), P(ul, 0, zl)], A.tone(C.wood[2], A.LIGHT.top), 0.8);
        A.poly(ctx, [P(ul, 0, zl), P(ul, 2, zl), P(1, 2, zl), P(1, 0, zl)], A.tone(C.wood[2], A.LIGHT.top), 0.8);
        // 橫向防滑木條
        [0.15, 0.3, 0.45, 0.6].forEach(function (s) {
          var a = s - 0.03, b = s + 0.03;
          A.poly(ctx, [P(a, 0, zs(a)), P(a, 2, zs(a)), P(b, 2, zs(b)), P(b, 0, zs(b))], C.wood[0], 0);
        });
        // 兩側木欄(後側先、前側後)
        rail(ctx, 0);
        rail(ctx, 2);
      });
    }
  });
  // ---- 現有 OBJECTS 的組合版(主建築 + 周邊小物件) ----
  function shed(m, u, v, w, d, h, roofCol, snow) {
    [[u, v], [u + w - 0.08, v], [u, v + d - 0.08], [u + w - 0.08, v + d - 0.08]].forEach(function (p) { m.box(p[0], p[1], 0, 0.08, 0.08, h, C.wood[1]); });
    m.gable(u, v, h, w, d, 12, roofCol, { over: 0.12, curl: roofCol === C.thatch ? 0 : 2, sag: 0.5, tileDensity: 8, ridgeCol: roofCol === C.thatch ? C.thatchDk : C.tileDk, eaveCol: roofCol === C.thatch ? C.thatchDk : undefined, hooks: roofCol !== C.thatch, snow: snow, end: false });
  }
  A.def('lumberyard', {
    w: 2, d: 2, hmax: 70,
    build: function (m, v) {
      shed(m, 0.15, 0.15, 1.1, 1.0, 20, C.thatch, v.season === 'winter');
      m.place('woodpile', 1.0, 1.0, 0, v); m.place('woodpile', 0.15, 1.0, 1, v);
      m.custom(1.25, 0.2, 0.6, 0.6, 0, function (ctx, mm) {
        var a = mm.pt(1.35, 0.5, 9), b = mm.pt(1.85, 0.5, 9); A.line(ctx, a, b, C.ink, 6); A.line(ctx, a, b, C.wood[2], 4.4);
        var s0 = mm.pt(1.6, 0.35, 16), s1 = mm.pt(1.6, 0.65, 4); A.line(ctx, s0, s1, '#5a5e66', 1.4);
      });
    },
    lights: function () { return [[0.7, 0.65, 16, 26, C.lamp, 0.6]]; }
  });
  A.def('quarry', {
    w: 2, d: 2, hmax: 70,
    build: function (m, v) {
      m.place('rocks', 0.1, 0.1, 0, { level: 3, season: v.season });
      m.place('rocks', 0.9, 0.2, 0, { level: 2, season: v.season });
      m.box(0.3, 1.2, 0, 0.35, 0.35, 8, C.stone[2]); m.box(0.7, 1.3, 0, 0.3, 0.3, 6, C.stone[1]); m.box(0.4, 1.25, 8, 0.25, 0.25, 6, C.stone[1]);
      m.box(1.5, 1.4, 0, 0.1, 0.1, 40, C.wood[1]);
      m.custom(1.0, 0.9, 0.9, 0.9, 41, function (ctx, mm) { var a = mm.pt(1.55, 1.45, 38), b = mm.pt(0.9, 1.0, 46); A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, a, b, C.wood[1], 2); A.line(ctx, b, mm.pt(0.9, 1.0, 22), C.ink, 0.8); var k = mm.pt(0.9, 1.0, 20); A.poly(ctx, [[k[0] - 4, k[1]], [k[0] + 4, k[1]], [k[0] + 4, k[1] - 5], [k[0] - 4, k[1] - 5]], C.stone[1], 0.6); }, 2);
    },
    lights: function () { return [[1.55, 1.45, 30, 30, C.fire, 0.7]]; }
  });
  A.def('stable', {
    w: 3, d: 2, hmax: 70,
    build: function (m, v) {
      shed(m, 0.1, 0.1, 2.8, 0.9, 22, C.tile, v.season === 'winter');
      m.box(0.1, 0.1, 0, 2.8, 0.08, 14, C.wood[1]);
      m.place('horse', 0.4, 0.95, 0, {}); m.place('whitehorse', 1.5, 0.95, 0, {});
      m.box(2.3, 1.2, 0, 0.6, 0.25, 6, C.wood[1], { top: C.thatch });
      m.place('haystack', 2.1, 0.0, 0, v);
    },
    lights: function () { return [[0.8, 0.9, 20, 24, C.lantern, 0.7], [2.2, 0.9, 20, 24, C.lantern, 0.7]]; }
  });
  A.def('barracks', {
    w: 3, d: 3, hmax: 90,
    build: function (m, v) {
      m.place('house', 0, 0, 0, { level: 2, season: v.season, skin: 'earth' });
      m.place('weaponrack', 2.0, 0.3, 0, v); m.place('weaponrack', 2.0, 1.2, 0, v);
      m.place('jumaa', 0.3, 2.0, 0, v); m.place('jumaa', 1.3, 2.0, 0, v);
      m.place('flagpole', 2.0, 2.0, 0, v);
    },
    lights: function (v) { return A.OBJ.house.lights({ level: 2 }); },
    anim: function (ctx, m, t, v) { var p = m.pt(2.5, 2.5, 6); A.flag(ctx, p[0], p[1], 70, 26, 18, C.hanRed, t, 0.3); }
  });
  A.def('archeryrange', {
    w: 3, d: 3, hmax: 80,
    build: function (m, v) {
      m.place('house', 0, 0, 0, { level: 1, season: v.season });
      m.place('target', 2.0, 0.2, 0, v); m.place('target', 2.0, 1.2, 0, v);
      m.place('weaponrack', 0.3, 2.0, 0, v); m.place('campfire', 1.6, 2.0, 0, v);
    },
    lights: function () { return [[2.1, 2.5, 6, 46, C.fire, 1]]; }
  });
  A.def('academy', {
    w: 3, d: 3, hmax: 130,
    build: function (m, v) {
      var snow = v.season === 'winter';
      m.box(0.15, 0.15, 0, 2.7, 2.6, 6, C.stone[1], { top: C.stone[2] });
      var F = function (ctx, f) { A.posts(ctx, f, [0, 0.25, 0.5, 0.75, 1], 0.1, C.wood[0]); A.door(ctx, f, 0.5, 0.32, 14, C.wood[1]); A.lattice(ctx, f, 0.25, 0.3, 6, 8); A.lattice(ctx, f, 0.75, 0.3, 6, 8); };
      var S = function (ctx, f) { A.posts(ctx, f, [0, 0.5, 1], 0.1, C.wood[0]); A.lattice(ctx, f, 0.25, 0.3, 6, 8); A.lattice(ctx, f, 0.75, 0.3, 6, 8); };
      m.box(0.4, 0.4, 6, 2.0, 2.0, 22, C.silk, { deco: { F: F, B: S, L: S, R: S } });
      m.hip(0.4, 0.4, 28, 2.0, 2.0, 12, '#2f6b5e', { over: 0.28, curl: 4, sag: 1.5, snow: snow, ridgeCol: '#1f4a40' });
      m.box(0.75, 0.75, 34, 1.3, 1.3, 14, C.silk, { deco: { F: S, B: S, L: S, R: S } });
      m.hip(0.75, 0.75, 48, 1.3, 1.3, 18, '#2f6b5e', { over: 0.28, curl: 5, sag: 1.5, snow: snow, ridgeCol: C.lacquer, ridgeHi: C.gold });
      m.custom(2.4, 2.4, 0.5, 0.5, 6, function (ctx, mm) {
        var c = mm.pt(2.6, 2.6, 18); ctx.lineWidth = 1.8; ctx.strokeStyle = C.bronze;
        [[8, 8, 0], [8, 3, 0], [8, 3, 1], [3, 8, 0]].forEach(function (r) { ctx.beginPath(); ctx.ellipse(c[0], c[1], r[0], r[1], r[2], 0, Math.PI * 2); ctx.stroke(); });
        A.line(ctx, mm.pt(2.6, 2.6, 6), mm.pt(2.6, 2.6, 10), C.bronze, 2);
      }, 1);
    },
    lights: function () { return [[1.4, 2.42, 14, 30, C.lamp, 0.8, 'F'], [1.4, 1.4, 44, 34, C.lamp, 0.5]]; }
  });
  A.def('siegeyard', {
    w: 3, d: 3, hmax: 110,
    build: function (m, v) {
      shed(m, 0.1, 0.1, 1.3, 1.2, 20, C.thatch, v.season === 'winter');
      m.place('woodpile', 0.2, 1.6, 0, v); m.place('crates', 0.9, 1.7, 0, v);
      m.box(1.7, 1.0, 0, 1.1, 1.4, 5, C.wood[1]);
      m.box(1.9, 1.6, 5, 0.1, 0.1, 30, C.wood[1]); m.box(2.55, 1.6, 5, 0.1, 0.1, 30, C.wood[1]);
      m.custom(1.7, 0.6, 1.2, 2, 36, function (ctx, mm) {
        var ax = mm.pt(2.25, 1.65, 34), a = mm.pt(2.25, 0.7, 64), b = mm.pt(2.25, 2.3, 22);
        A.line(ctx, mm.pt(1.95, 1.65, 34), mm.pt(2.6, 1.65, 34), C.ink, 3); A.line(ctx, a, b, C.ink, 4.4); A.line(ctx, a, b, C.wood[2], 2.8);
        A.line(ctx, a, mm.pt(2.25, 0.7, 50), C.ink, 0.8); var w = mm.pt(2.25, 2.3, 16); A.poly(ctx, [[w[0] - 5, w[1]], [w[0] + 5, w[1]], [w[0] + 5, w[1] - 8], [w[0] - 5, w[1] - 8]], C.stone[1], 0.7); void ax;
      }, 2);
    },
    lights: function () { return [[0.75, 0.7, 16, 28, C.lamp, 0.6]]; }
  });
})(ART);
