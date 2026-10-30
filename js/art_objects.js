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

  // =====================================================================
  // 戰陣建築 camp_*(10 種,對應 js/units.js CAMP_OBJECTS,占格相同)
  // v.dmg:0 完好 / 1 受損(血量 <50%:牆面裂痕、冒煙)/ 2 重創(血量 <20%:局部倒塌、火苗)
  // =====================================================================
  var CK_DARK = '#2a1c18';
  // 螢幕上旗面飄向:+x 在右、-x 在左、+y 在左、-y 在右(與 A.P 的 sx = (gx-gy)*32 相符)
  var CK_DIR = { '+x': 1, '-x': -1, '+y': -1, '-y': 1 };
  function ckDir(m) { return CK_DIR[m.wdir('F')] || 1; }
  // 裂痕:自 (s, z) 向下的折線
  function ckCrack(ctx, f, s, z, len) {
    var p = f.pt(s, z), i, q;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    for (i = 1; i <= 4; i++) { q = f.pt(s + (i % 2 ? 0.025 : -0.02), z - len * i / 4); ctx.lineTo(q[0], q[1]); }
    ctx.strokeStyle = CK_DARK; ctx.lineWidth = 1.3; ctx.lineJoin = 'round'; ctx.stroke();
  }
  // 受損牆面:dmg 1 兩道裂痕;dmg 2 再加一個破洞
  function ckDamageFace(ctx, f, dmg, s, z) {
    if (!dmg) return;
    ckCrack(ctx, f, s, z, 10);
    ckCrack(ctx, f, s + 0.14, z - 2, 7);
    if (dmg >= 2) A.poly(ctx, A.quad(f, s - 0.07, s + 0.02, z - 9, z - 3), CK_DARK, 0.3);
  }
  // 水平層線(木板 / 夯土層)
  function ckLayers(ctx, f, z0, z1, step, col) {
    for (var z = z0; z < z1; z += step) A.line(ctx, f.pt(0, z), f.pt(1, z), A.tone(col, f.light * 0.82), 1);
  }
  // 箭窗 / 木窗:白天深色;昏夜點亮(自發光)
  function ckWin(ctx, f, s, z, hh, wg) {
    A.poly(ctx, A.quad(f, s - wg / 2, s + wg / 2, z, z + hh), CK_DARK, 0.45);
    if (A.state.lit) A.lit(ctx, function () { A.poly(ctx, A.quad(f, s - wg * 0.32, s + wg * 0.32, z + 1, z + hh - 1), C.lamp, 0); });
  }
  // 女牆:台基頂緣的齒牆(沿可見面)
  function ckMerlon(ctx, f) {
    for (var s = 0; s < 1; s += 0.2) A.poly(ctx, A.quad(f, s, s + 0.1, f.h, f.h + 5), A.tone(C.earth, f.light), 0.45);
  }
  // 戰旗:旗面波動;(x, y) 為旗桿頂;dir 飄向;lean 1 = 旗面下垂;glyph 可為 null
  function ckFlag(ctx, x, y, fw, fh, col, t, seed, dir, glyph, lean) {
    var n = 6, top = [], bot = [], i, u, wv, dy;
    for (i = 0; i <= n; i++) {
      u = i / n; wv = Math.sin(t * 5 - u * 4 + seed) * 2.4 * u; dy = (lean || 0) * u * fh * 0.5;
      top.push([x + dir * fw * u, y + 1 + wv + dy]);
      bot.push([x + dir * fw * u * 0.94, y + 1 + fh + wv + u * 2 + dy]);
    }
    A.poly(ctx, top.concat(bot.slice().reverse()), col, 0.9);
    A.poly(ctx, [top[0], top[1], bot[1], bot[0]], A.tone(col, 0.7), 0);
    A.line(ctx, top[0], top[n], C.gold, 1.2);
    if (glyph) A.glyph(ctx, glyph, (top[3][0] + bot[3][0]) / 2, (top[3][1] + bot[3][1]) / 2, Math.max(6, fh * 0.45), C.gold);
  }
  // Q 版小人偶剪影(靜態):p 為腳底世界座標;spear 持矛
  function ckFigure(ctx, p, cloth, spear) {
    var x = p[0], y = p[1];
    if (spear) {
      A.line(ctx, [x + 7, y + 1], [x + 7, y - 38], C.ink, 2.6); A.line(ctx, [x + 7, y + 1], [x + 7, y - 38], C.wood[2], 1.2);
      A.poly(ctx, [[x + 5, y - 36], [x + 9, y - 36], [x + 7, y - 43]], '#dfe6ea', 0.6);
    }
    A.line(ctx, [x - 2, y - 1], [x - 2.6, y + 2], C.lacquer, 1.8);
    A.line(ctx, [x + 2, y - 1], [x + 2.6, y + 2], C.lacquer, 1.8);
    A.poly(ctx, [[x - 4.5, y - 11], [x + 4.5, y - 11], [x + 5, y - 1], [x - 5, y - 1]], cloth, 0.7);
    A.circle(ctx, x, y - 17, 5, C.skin, 0.6);
    ctx.beginPath(); ctx.arc(x, y - 17, 5.2, Math.PI, 0); ctx.closePath(); ctx.fillStyle = C.hair; ctx.fill();
    A.circle(ctx, x + 1.6, y - 16.5, 0.7, C.ink, 0);
  }
  function ckFig(m, u, v, z, cloth, spear, bias) {
    m.custom(u - 0.12, v - 0.12, 0.24, 0.24, z, function (ctx, mm) { ckFigure(ctx, mm.pt(u, v, z), cloth, spear); }, bias || 0);
  }
  // 火盆:三足 + 銅盆;z 為地面(台面)高度
  function ckBrazier(m, u, v, z) {
    m.custom(u - 0.2, v - 0.2, 0.4, 0.4, z, function (ctx, mm) {
      var c = mm.pt(u, v, z);
      [[-6, 2], [6, 2], [0, 5]].forEach(function (l) {
        A.line(ctx, [c[0] + l[0], c[1] + l[1]], [c[0] + l[0] * 0.4, c[1] - 12], C.ink, 2.8);
        A.line(ctx, [c[0] + l[0], c[1] + l[1]], [c[0] + l[0] * 0.4, c[1] - 12], C.bronze, 1.5);
      });
    });
    m.cyl(u, v, z + 12, 0.16, 5, C.bronze, { topCol: C.lacquer, bias: 1 });
  }
  // 木輪(輪軸沿 u,輪面在 v-z 平面)
  function ckWheel(m, u, v, z, r) {
    m.custom(u - 0.03, v - 0.3, 0.06, 0.6, 1, function (ctx, mm) {
      A.disc(ctx, mm, u, v, z, r, 'v', C.wood[1]);
      A.disc(ctx, mm, u, v, z, r * 0.7, 'v', A.tone(C.wood[1], 0.82), 0.4);
      for (var i = 0; i < 4; i++) {
        var a = i * Math.PI / 4;
        A.line(ctx, mm.pt(u, v + Math.cos(a) * r / 34, z + Math.sin(a) * r), mm.pt(u, v - Math.cos(a) * r / 34, z - Math.sin(a) * r), C.wood[0], 1.2);
      }
      var h = mm.pt(u, v, z); A.circle(ctx, h[0], h[1], 2, C.gold, 0.6);
    }, 1);
  }
  // 麻袋(畫在世界座標 x,y 的底部)
  function ckSack(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x - 7 * s, y); ctx.quadraticCurveTo(x - 9 * s, y - 9 * s, x - 3 * s, y - 12 * s); ctx.lineTo(x + 3 * s, y - 12 * s);
    ctx.quadraticCurveTo(x + 9 * s, y - 9 * s, x + 7 * s, y); ctx.quadraticCurveTo(x, y + 2 * s, x - 7 * s, y); ctx.closePath();
    ctx.fillStyle = '#e2c99a'; ctx.fill(); A.edge(ctx, 0.75);
    A.line(ctx, [x - 3 * s, y - 12 * s], [x + 3 * s, y - 12 * s], C.wood[0], 1);
  }

  // ---- 帥帳 camp_hq 4x4:台基 + 朱紅頂大帳 + 金頂 + 帳前台階 + 兩名衛兵 + 鼓架 + 兩面大旗 ----
  A.def('camp_hq', {
    w: 4, d: 4, hmax: 124,
    build: function (m, v) {
      var dmg = v.dmg || 0, snow = v.season === 'winter';
      var plinth = function (ctx, f) { ckLayers(ctx, f, 2, 4, 2, C.earthDk); ckDamageFace(ctx, f, dmg, 0.6, 3.5); };
      m.box(0.08, 0.08, 0, 3.84, 3.84, 4, C.earth, { top: C.earth, deco: { F: plinth, B: plinth, L: plinth, R: plinth } });
      m.box(1.3, 3.3, 4, 1.4, 0.7, 2, C.stone[2], { top: C.stone[2] });
      m.box(1.3, 3.6, 6, 1.4, 0.4, 2, C.stone[2], { top: C.stone[2] });
      var wallF = function (ctx, f) {
        A.band(ctx, f, 0, 3, C.hanRed);
        A.posts(ctx, f, [0, 0.25, 0.75, 1], 0.1, C.hanRed);
        A.door(ctx, f, 0.5, 0.56, 15, C.hanRed);
        ckDamageFace(ctx, f, dmg, 0.15, 17);
      };
      var wallS = function (ctx, f) {
        A.band(ctx, f, 0, 3, C.hanRed);
        A.posts(ctx, f, [0, 0.5, 1], 0.1, C.hanRed);
        A.lattice(ctx, f, 0.5, 0.5, 9, 6, C.hanRed);
        ckDamageFace(ctx, f, dmg, 0.6, 16);
      };
      m.box(0.45, 0.4, 4, 3.1, 3.2, 20, C.silk, { deco: { F: wallF, B: wallS, L: wallS, R: wallS } });
      m.hip(0.45, 0.4, 24, 3.1, 3.2, 22, C.hanRed, { over: 0.34, curl: 6, sag: 2, hipK: 0.7, ridgeCol: C.lacquer, ridgeHi: C.gold, ridgeW: 4, hooks: true, hookSize: 4, snow: snow });
      m.cone(2.0, 2.0, 46, 0.12, 10, C.gold);
      ckFig(m, 0.9, 3.55, 4, C.hanRed, true, 0);
      ckFig(m, 3.1, 3.55, 4, C.hanRed, true, 0);
      m.box(0.12, 3.1, 4, 0.06, 0.06, 20, C.wood[1]);
      m.box(0.68, 3.1, 4, 0.06, 0.06, 20, C.wood[1]);
      m.custom(0.1, 3.08, 0.66, 0.1, 24, function (ctx, mm) { var a = mm.pt(0.12, 3.13, 24), b = mm.pt(0.74, 3.13, 24); A.line(ctx, a, b, C.ink, 3); A.line(ctx, a, b, C.wood[2], 1.8); }, 1);
      m.cyl(0.42, 3.13, 9, 0.24, 14, C.hanRed, { topCol: '#f2dfb2', hoops: [3, 11], bias: 1 });
      m.cyl(0.14, 3.86, 4, 0.045, 60, C.lacquer, { topCol: C.gold, bias: 1 });
      m.cyl(3.86, 3.86, 4, 0.045, 60, C.lacquer, { topCol: C.gold, bias: 1 });
      m.custom(0.9, 3.7, 0.2, 0.2, 14, function (ctx, mm) { var p = mm.pt(1.0, 3.8, 14); A.lantern(ctx, p[0], p[1], 1.1); }, 2);
      m.custom(2.9, 3.7, 0.2, 0.2, 14, function (ctx, mm) { var p = mm.pt(3.0, 3.8, 14); A.lantern(ctx, p[0], p[1], 1.1); }, 2);
      if (dmg >= 2) {
        m.box(3.2, 0.1, 4, 0.45, 0.4, 5, C.tile, { top: C.tileDk });
        m.box(2.85, 0.15, 4, 0.3, 0.3, 3, C.tile, { top: C.tileDk });
      }
    },
    lights: function (v) {
      var L = [[1.0, 3.75, 16, 22, C.lantern, 0.9, 'F'], [3.0, 3.75, 16, 22, C.lantern, 0.9, 'F'], [2.0, 3.6, 22, 30, C.lamp, 0.8, 'F']];
      if ((v.dmg || 0) >= 2) L.push([3.1, 0.3, 30, 30, C.fire, 0.9]);
      return L;
    },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0, dir = ckDir(m);
      var a = m.pt(0.14, 3.86, 64), b = m.pt(3.86, 3.86, 64);
      ckFlag(ctx, a[0], a[1], 24, 19, C.hanRed, t, 0, dir, '帥', 0);
      ckFlag(ctx, b[0], b[1], 24, 19, C.hanRed, t, 1.6, dir, '漢', 0);
      if (dmg >= 1) { var s = m.pt(3.1, 0.9, 50); A.smoke(ctx, s[0], s[1], t, 2.2); }
      if (dmg >= 2) { var q = m.pt(3.1, 0.9, 30); A.fire(ctx, q[0], q[1], t, 1.2); }
    }
  });

  // ---- 箭樓 camp_tower 2x2:夯土台基(女牆)+ 三層木樓 + 青瓦檐 + 頂層火盆 ----
  A.def('camp_tower', {
    w: 2, d: 2, hmax: 112,
    build: function (m, v) {
      var dmg = v.dmg || 0, snow = v.season === 'winter';
      var base = function (ctx, f) { ckLayers(ctx, f, 3, 8, 3, C.earthDk); ckDamageFace(ctx, f, dmg, 0.3, 6); ckMerlon(ctx, f); };
      m.box(0.06, 0.06, 0, 1.88, 1.88, 8, C.earth, { top: C.earth, deco: { F: base, B: base, L: base, R: base } });
      var t1F = function (ctx, f) {
        ckLayers(ctx, f, 6, 24, 6, C.wood[0]); A.posts(ctx, f, [0, 0.5, 1], 0.08, C.wood[0]);
        A.door(ctx, f, 0.5, 0.34, 14, C.wood[0]); ckWin(ctx, f, 0.85, 15, 7, 0.14); ckDamageFace(ctx, f, dmg, 0.15, 22);
      };
      var t1S = function (ctx, f) { ckLayers(ctx, f, 6, 24, 6, C.wood[0]); A.posts(ctx, f, [0, 1], 0.08, C.wood[0]); ckWin(ctx, f, 0.5, 15, 7, 0.16); };
      m.box(0.22, 0.22, 8, 1.56, 1.56, 24, C.wood[1], { top: C.wood[2], deco: { F: t1F, B: t1S, L: t1S, R: t1S } });
      m.hip(0.14, 0.14, 32, 1.72, 1.72, 9, C.tile, { over: 0.2, curl: 4, sag: 1.5, hipK: 0.8, ridgeCol: C.tileDk, hookSize: 3, snow: snow });
      var t2 = function (ctx, f) { ckLayers(ctx, f, 5, 20, 5, C.wood[0]); A.posts(ctx, f, [0, 1], 0.08, C.wood[0]); ckWin(ctx, f, 0.5, 8, 7, 0.22); ckDamageFace(ctx, f, dmg, 0.3, 16); };
      m.box(0.4, 0.4, 41, 1.2, 1.2, 17, C.wood[1], { top: C.wood[2], deco: { F: t2, B: t2, L: t2, R: t2 } });
      if (dmg < 2) m.hip(0.32, 0.32, 58, 1.36, 1.36, 8, C.tile, { over: 0.2, curl: 3, sag: 1, hipK: 0.8, ridgeCol: C.tileDk, hookSize: 2.5, snow: snow });
      else m.box(1.6, 0.2, 8, 0.2, 0.3, 4, C.tile, { top: C.tileDk });
      // 頂層望台:木板 + 四柱 + 欄杆 + 火盆(不加頂,火焰外露)
      m.box(0.5, 0.5, 66, 1.0, 1.0, 2, C.wood[0], { top: C.wood[2] });
      [[0.5, 0.5], [1.44, 0.5], [0.5, 1.44], [1.44, 1.44]].forEach(function (p) { m.box(p[0], p[1], 68, 0.06, 0.06, 13, C.wood[0]); });
      m.custom(0.5, 0.5, 1.0, 1.0, 74, function (ctx, mm) {
        [[0.5, 0.5, 1.5, 0.5], [1.5, 0.5, 1.5, 1.5], [1.5, 1.5, 0.5, 1.5], [0.5, 1.5, 0.5, 0.5]].forEach(function (s) {
          var a = mm.pt(s[0], s[1], 74), b = mm.pt(s[2], s[3], 74); A.line(ctx, a, b, C.ink, 2.6); A.line(ctx, a, b, C.wood[2], 1.4);
        });
      });
      ckBrazier(m, 1.0, 1.0, 68);
    },
    lights: function (v) {
      var L = [[1.55, 1.78, 25, 18, C.lamp, 0.6, 'F'], [1.0, 1.78, 12, 16, C.lamp, 0.5, 'F'], [1.0, 1.6, 50, 18, C.lamp, 0.5, 'F'], [1.0, 1.0, 85, 44, C.fire, 1]];
      return L;
    },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      var b = m.pt(1.0, 1.0, 86);
      A.fire(ctx, b[0], b[1], t, 1.0);
      if (dmg >= 1) { var s = m.pt(1.0, 1.0, 41); A.smoke(ctx, s[0], s[1], t, 1.4); }
      if (dmg >= 2) { var q = m.pt(1.0, 1.0, 60); A.fire(ctx, q[0], q[1], t + 0.5, 1.0); }
    }
  });

  // ---- 弩台 camp_nutai 2x2:夯土台基 + 大型床弩(弩臂、弦、箭)+ 兩名操作員 ----
  A.def('camp_nutai', {
    w: 2, d: 2, hmax: 84,
    build: function (m, v) {
      var dmg = v.dmg || 0;
      var earth = function (ctx, f) { ckLayers(ctx, f, 3, 12, 3, C.earthDk); ckDamageFace(ctx, f, dmg, 0.5, 9); };
      m.box(0.05, 0.05, 0, 1.9, 1.9, 12, C.earth, { deco: { F: earth, B: earth, L: earth, R: earth } });
      m.box(0.9, 0.15, 12, 0.2, 1.7, 5, C.wood[1], { top: C.wood[2] });
      var post = function (ctx, f) { ckDamageFace(ctx, f, dmg, 0.3, 20); };
      m.box(0.45, 0.8, 12, 0.14, 0.3, 26, C.wood[0], { deco: { F: post, B: post, L: post, R: post } });
      m.box(1.41, 0.8, 12, 0.14, 0.3, 26, C.wood[0], { deco: { F: post, B: post, L: post, R: post } });
      m.custom(0.0, 0.8, 2.0, 0.3, 36, function (ctx, mm) {
        var L0 = mm.pt(0.52, 0.95, 36), L1 = mm.pt(-0.02, 0.95, 42), cL = mm.pt(0.22, 0.95, 30);
        var R0 = mm.pt(1.48, 0.95, 36), R1 = mm.pt(2.02, 0.95, 42), cR = mm.pt(1.78, 0.95, 30), N = mm.pt(1.0, 0.55, 35);
        var arm = function (a, c, b) {
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
          ctx.lineCap = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = 4.2; ctx.stroke();
          ctx.strokeStyle = C.wood[2]; ctx.lineWidth = 2.4; ctx.stroke();
        };
        arm(L1, cL, L0);
        if (dmg >= 2) A.line(ctx, R0, mm.pt(1.62, 0.95, 40), C.ink, 3);
        else arm(R1, cR, R0);
        A.line(ctx, L1, N, '#e8dcc0', 0.9);
        if (dmg < 2) A.line(ctx, N, R1, '#e8dcc0', 0.9);
        var A1 = mm.pt(1.0, 2.0, 35);
        A.line(ctx, N, A1, C.ink, 2.4); A.line(ctx, N, A1, C.wood[2], 1.2);
        A.poly(ctx, [[A1[0] - 2.5, A1[1] + 1.5], [A1[0] + 2.5, A1[1] + 1.5], [A1[0], A1[1] - 4]], '#dfe6ea', 0.6);
      }, 1);
      ckFig(m, 0.36, 0.45, 12, '#8a6a3a', false, 0);
      ckFig(m, 1.64, 0.45, 12, C.hanRed, false, 0);
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [[0.4, 0.4, 16, 30, C.fire, 1]] : []; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg >= 1) { var s = m.pt(0.5, 0.8, 40); A.smoke(ctx, s[0], s[1], t, 0.6); }
      if (dmg >= 2) { var f = m.pt(0.4, 0.4, 14); A.fire(ctx, f[0], f[1], t, 1.0); }
    }
  });

  // ---- 投石台 camp_shitai 2x2:石砌台基 + A 形支架 + 配重式投石臂 + 石堆 ----
  A.def('camp_shitai', {
    w: 2, d: 2, hmax: 100,
    build: function (m, v) {
      var dmg = v.dmg || 0;
      var stone = function (ctx, f) {
        ckLayers(ctx, f, 3, 10, 3.5, C.stone[0]);
        for (var s = 0.25; s < 1; s += 0.5) A.line(ctx, f.pt(s, 0), f.pt(s, 10), A.tone(C.stone[0], f.light * 0.9), 1);
        ckDamageFace(ctx, f, dmg, 0.4, 9);
      };
      m.box(0.05, 0.05, 0, 1.9, 1.9, 10, C.stone[1], { top: C.stone[2], deco: { F: stone, B: stone, L: stone, R: stone } });
      m.custom(0.4, 0.8, 1.2, 0.4, 10, function (ctx, mm) {
        var pv = mm.pt(1.0, 1.0, 60);
        [0.42, 1.58].forEach(function (u) { var a = mm.pt(u, 1.0, 12); A.line(ctx, a, pv, C.ink, 5); A.line(ctx, a, pv, C.wood[1], 2.8); });
        var c1 = mm.pt(0.44, 1.0, 36), c2 = mm.pt(1.56, 1.0, 36); A.line(ctx, c1, c2, C.ink, 3.4); A.line(ctx, c1, c2, C.wood[0], 1.8);
        A.circle(ctx, pv[0], pv[1], 3, C.gold, 0.6);
      }, 1);
      m.box(0.84, 0.0, 28, 0.32, 0.3, 16, C.stone[0], { top: C.stone[2] });
      m.custom(0.8, 0.1, 0.4, 1.9, 40, function (ctx, mm) {
        var b = mm.pt(1.0, 0.25, 44), pv = mm.pt(1.0, 1.0, 60), t = mm.pt(1.0, 1.75, 76);
        if (dmg < 2) {
          A.line(ctx, b, t, C.ink, 6.4); A.line(ctx, b, t, C.wood[2], 4);
          var S = mm.pt(1.0, 1.9, 50);
          A.line(ctx, t, S, '#8a7a5a', 0.9);
          A.circle(ctx, S[0], S[1], 3.4, C.stone[2], 0.7);
        } else {
          A.line(ctx, b, pv, C.ink, 6.4); A.line(ctx, b, pv, C.wood[2], 4);
          A.line(ctx, pv, mm.pt(1.0, 1.9, 22), C.wood[1], 3);
        }
      }, 2);
      m.custom(0.2, 1.3, 1.0, 0.8, 10, function (ctx, mm) {
        [[0.3, 1.5, 1.0], [0.55, 1.75, 0.8], [0.25, 1.85, 0.7]].forEach(function (s, i) { var p = mm.pt(s[0], s[1], 10); A.rock(ctx, p[0], p[1], s[2], i + 5, C.stone[1]); });
      }, 1);
    },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg >= 1) { var s = m.pt(1.0, 1.0, 62); A.smoke(ctx, s[0], s[1], t, 1.1); }
    }
  });

  // ---- 營帳系:camp_tent(帥營小帳)與 camp_fake(疑營)共用 ----
  // o:u0 偏移 / w 寬 / rise 帳高 / cloth 布色 / doorU 帳門 / lean 旗倒向 / flag 旗色 / braziers 火盆位置
  function ckTent(m, v, o) {
    var dmg = v.dmg || 0, snow = v.season === 'winter', apexU = o.u0 + o.w / 2;
    var ro = { axis: 'v', over: 0.04, overEnd: 0.04, curl: 0, sag: 0.3, tiles: false, hooks: false, ridgeCol: C.hanRed, ridgeW: 3, eaveCol: '#c9b88e', endCol: A.tone(o.cloth, 0.94), snow: snow };
    var du = o.doorU;
    if (dmg < 2) m.gable(o.u0, 0.15, 0, o.w, 1.7, o.rise, o.cloth, ro);
    else {
      m.gable(o.u0, 0.15, 0, o.w * 0.5, 1.7, o.rise * 0.7, A.tone(o.cloth, 0.86), ro);
      du = o.u0 + o.w * 0.25;
      m.custom(apexU + 0.1, 0.5, 0.8, 1.0, 1, function (ctx, mm) {
        var a = mm.pt(apexU + 0.2, 0.6, 2), b = mm.pt(apexU + 0.9, 1.4, 2);
        A.line(ctx, a, b, C.wood[0], 2.4);
        var c = mm.pt(apexU + 0.55, 1.0, 1);
        A.poly(ctx, [[c[0] - 8, c[1]], [c[0] + 6, c[1] - 3], [c[0] + 10, c[1] + 4], [c[0] - 4, c[1] + 6]], A.tone(o.cloth, 0.8), 0.5);
      }, 1);
    }
    m.custom(du - 0.2, 1.84, 0.4, 0.06, 1, function (ctx, mm) {
      if (!A.visible(mm, 'F')) return;
      var p = [mm.pt(du - 0.14, 1.9, 0), mm.pt(du + 0.14, 1.9, 0), mm.pt(du, 1.9, o.rise * 0.5)];
      if (A.state.lit) A.lit(ctx, function () { A.poly(ctx, p, C.lamp, 0.7); }); else A.poly(ctx, p, CK_DARK, 0.7);
      if (dmg >= 1) A.line(ctx, mm.pt(du + 0.2, 1.9, o.rise * 0.8), mm.pt(du + 0.12, 1.9, o.rise * 0.4), CK_DARK, 1.2);
    }, 1);
    o.braziers.forEach(function (b) { ckBrazier(m, b[0], b[1], 0); });
    if (dmg < 2) m.cyl(apexU, 1.0, o.rise - 2, 0.035, 16, C.wood[1], { topCol: C.gold, bias: 2 });
  }
  function ckTentLights(v, o) {
    var L = o.braziers.map(function (b) { return [b[0], b[1], 20, 40, C.fire, 0.9]; });
    L.push([o.doorU, 1.9, 8, 18, C.lamp, 0.5, 'F']);
    return L;
  }
  function ckTentAnim(ctx, m, t, v, o) {
    var dmg = v.dmg || 0;
    if (dmg < 2) { var p = m.pt(o.u0 + o.w / 2, 1.0, o.rise + 14); ckFlag(ctx, p[0], p[1], 14, 9, o.flag, t, 0.5, ckDir(m), null, o.lean); }
    o.braziers.forEach(function (b, i) { var q = m.pt(b[0], b[1], 17); A.fire(ctx, q[0], q[1], t + i * 0.7, 0.9); });
    if (dmg >= 1) { var s = m.pt(o.u0 + o.w / 2, 1.0, o.rise); A.smoke(ctx, s[0], s[1] - 4, t, 1.7); }
  }
  var CK_TENT = { u0: 0.15, w: 1.7, rise: 40, cloth: '#f4ead2', doorU: 1.0, lean: 0, flag: C.hanRed, braziers: [[0.25, 1.95], [1.75, 1.95]] };
  var CK_FAKE = { u0: 0.22, w: 1.56, rise: 30, cloth: '#efe4c4', doorU: 0.88, lean: 1, flag: '#d9b24a', braziers: [[1.75, 1.95]] };
  A.def('camp_tent', {
    w: 2, d: 2, hmax: 66,
    build: function (m, v) { ckTent(m, v, CK_TENT); },
    lights: function (v) { return ckTentLights(v, CK_TENT); },
    anim: function (ctx, m, t, v) { ckTentAnim(ctx, m, t, v, CK_TENT); }
  });
  A.def('camp_fake', {
    w: 2, d: 2, hmax: 62,
    build: function (m, v) { ckTent(m, v, CK_FAKE); },
    lights: function (v) { return ckTentLights(v, CK_FAKE); },
    anim: function (ctx, m, t, v) { ckTentAnim(ctx, m, t, v, CK_FAKE); }
  });

  // ---- 輜重車 camp_wagon 2x2:木輪糧車,車斗載麻袋與木箱,前端車轅 ----
  A.def('camp_wagon', {
    w: 2, d: 2, hmax: 60,
    build: function (m, v) {
      var dmg = v.dmg || 0;
      var planks = function (ctx, f) { ckLayers(ctx, f, 2, 8, 2.5, C.wood[0]); ckDamageFace(ctx, f, dmg, 0.3, 6); };
      m.box(0.15, 0.25, 8, 1.7, 1.5, 6, C.wood[1], { top: C.wood[2], deco: { F: planks, B: planks, L: planks, R: planks } });
      m.box(0.1, 0.25, 14, 0.07, 1.5, 7, C.wood[0]);
      m.box(1.83, 0.25, 14, 0.07, 1.5, 7, C.wood[0]);
      m.box(0.3, 0.3, 14, 0.6, 0.55, 9, C.wood[2], { top: C.wood[2], deco: { F: planks, B: planks, L: planks, R: planks } });
      m.box(1.05, 1.0, 14, 0.55, 0.5, 8, C.wood[1], { top: C.wood[2], deco: { F: planks, B: planks, L: planks, R: planks } });
      ckWheel(m, 0.04, 1.0, 11, 12);
      if (dmg < 2) ckWheel(m, 1.96, 1.0, 11, 12);
      m.custom(0.85, 1.75, 0.3, 0.3, 8, function (ctx, mm) { var a = mm.pt(0.9, 1.7, 8), b = mm.pt(0.9, 2.0, 2); A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, a, b, C.wood[0], 2); });
      m.custom(0.2, 0.2, 1.6, 1.6, 14, function (ctx, mm) {
        [[0.6, 1.35, 14], [1.45, 0.6, 14], [0.6, 0.6, 23]].forEach(function (s) { var p = mm.pt(s[0], s[1], s[2]); ckSack(ctx, p[0], p[1], 1.0); });
      }, 2);
      if (dmg >= 2) m.custom(1.0, 1.7, 1.0, 0.6, 1, function (ctx, mm) {
        var p = mm.pt(1.4, 1.9, 0); A.ellipse(ctx, p[0], p[1] - 2, 11, 4.5, '#f2d27a', 0.6);
        var q = mm.pt(1.2, 1.7, 0); ckSack(ctx, q[0], q[1], 0.8);
      }, 1);
    },
    anim: function (ctx, m, t, v) {
      if ((v.dmg || 0) >= 2) { var p = m.pt(1.2, 0.9, 26); A.fire(ctx, p[0], p[1], t, 1.0); }
    }
  });

  // ---- 糧囤 camp_granary 2x2:夯土圓囷 + 圓頂 + 旁側陶倉 + 梯子 ----
  A.def('camp_granary', {
    w: 2, d: 2, hmax: 70,
    build: function (m, v) {
      var dmg = v.dmg || 0, snow = v.season === 'winter';
      m.box(0.05, 0.05, 0, 1.9, 1.9, 3, C.stone[1], { top: C.stone[2] });
      m.cyl(0.8, 0.8, 3, 0.6, 30, C.earth, { noTop: true, hoops: [9, 19] });
      m.custom(0.2, 0.2, 1.2, 1.2, 3, function (ctx, mm) {
        if (!dmg || !A.visible(mm, 'F')) return;
        ctx.beginPath();
        for (var i = 0; i <= 4; i++) { var p = mm.pt(0.8 + (i % 2 ? 0.08 : -0.06), 1.37, 6 + i * 5); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
        ctx.strokeStyle = CK_DARK; ctx.lineWidth = 1.3; ctx.stroke();
      }, 1);
      m.cone(0.8, 0.8, 33, 0.66, 16, C.earthDk);
      if (dmg >= 2) m.custom(0.4, 0.4, 0.8, 0.8, 44, function (ctx, mm) { var p = mm.pt(0.8, 0.8, 44); A.ellipse(ctx, p[0], p[1], 9, 4, CK_DARK); }, 1);
      m.cyl(1.55, 1.42, 3, 0.2, 12, C.earthDk, { topCol: C.stone[1] });
      m.cone(1.55, 1.42, 15, 0.24, 6, C.tile);
      m.cyl(1.5, 0.4, 3, 0.16, 10, C.earthDk, { topCol: C.stone[1] });
      m.cone(1.5, 0.4, 13, 0.2, 5, C.tile);
      m.custom(1.2, 0.5, 0.7, 0.4, 3, function (ctx, mm) {
        var a1 = mm.pt(1.85, 0.6, 3), b1 = mm.pt(1.45, 0.6, 26), a2 = mm.pt(1.85, 0.8, 3), b2 = mm.pt(1.45, 0.8, 26);
        A.line(ctx, a1, b1, C.ink, 3); A.line(ctx, a1, b1, C.wood[1], 1.6);
        A.line(ctx, a2, b2, C.ink, 3); A.line(ctx, a2, b2, C.wood[1], 1.6);
        for (var i = 1; i < 7; i++) {
          var k = i / 7;
          A.line(ctx, [a1[0] + (b1[0] - a1[0]) * k, a1[1] + (b1[1] - a1[1]) * k], [a2[0] + (b2[0] - a2[0]) * k, a2[1] + (b2[1] - a2[1]) * k], C.wood[2], 1.2);
        }
      }, 1);
      if (dmg >= 2) m.custom(0.9, 1.7, 1.0, 0.5, 3, function (ctx, mm) {
        var p = mm.pt(1.2, 1.8, 3); A.ellipse(ctx, p[0], p[1] - 2, 11, 4.5, '#f2d27a', 0.6); A.ellipse(ctx, p[0] + 2, p[1] - 3, 7, 3, '#fbe9a8', 0.4);
      }, 1);
    },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg >= 1) { var s = m.pt(0.8, 0.8, 46); A.smoke(ctx, s[0], s[1], t, 0.9); }
      if (dmg >= 2) { var q = m.pt(1.2, 1.5, 6); A.fire(ctx, q[0], q[1], t, 0.9); }
    }
  });

  // ---- 屯兵營 camp_muster 2x2:木柵方營 + 營帳 + 兵器架 + 營門 + 瞭望台 ----
  A.def('camp_muster', {
    w: 2, d: 2, hmax: 60,
    build: function (m, v) {
      var dmg = v.dmg || 0, snow = v.season === 'winter', cloth = dmg >= 2 ? '#6a5a52' : C.silk;
      // 木柵:沿一邊立樁;g0/g1 為缺口(t 比例),缺口處不畫柵
      var fence = function (u0, v0, u1, v1, n, g0, g1) {
        var i, t, u, vv, segs;
        for (i = 0; i <= n; i++) {
          t = i / n;
          if (g0 !== undefined && t > g0 && t < g1) continue;
          u = u0 + (u1 - u0) * t; vv = v0 + (v1 - v0) * t;
          m.box(u - 0.04, vv - 0.04, 0, 0.08, 0.08, 26, C.wood[1], { top: C.wood[2] });
        }
        segs = g0 === undefined ? [[0, 1]] : [[0, g0], [g1, 1]];
        segs.forEach(function (sg) {
          var a0 = [u0 + (u1 - u0) * sg[0], v0 + (v1 - v0) * sg[0]], a1 = [u0 + (u1 - u0) * sg[1], v0 + (v1 - v0) * sg[1]];
          m.custom(Math.min(a0[0], a1[0]) - 0.02, Math.min(a0[1], a1[1]) - 0.02, Math.abs(a1[0] - a0[0]) + 0.04, Math.abs(a1[1] - a0[1]) + 0.04, 14, function (ctx, mm) {
            [14, 22].forEach(function (z) { var p = mm.pt(a0[0], a0[1], z), q = mm.pt(a1[0], a1[1], z); A.line(ctx, p, q, C.ink, 3); A.line(ctx, p, q, C.wood[2], 1.8); });
          }, 0);
        });
      };
      var gate = dmg >= 2 ? [0.375, 1.0] : [0.375, 0.625];
      fence(0, 0, 2, 0, 6);
      fence(0, 0, 0, 2, 6);
      fence(2, 0, 2, 2, 6);
      fence(0, 2, 2, 2, 6, gate[0], gate[1]);
      m.gable(0.2, 0.25, 0, 1.0, 1.0, 26, cloth, { axis: 'v', over: 0.04, overEnd: 0.04, curl: 0, sag: 0.3, tiles: false, hooks: false, ridgeCol: C.hanRed, ridgeW: 2.5, eaveCol: '#c9b88e', endCol: A.tone(cloth, 0.94), snow: snow });
      m.place('weaponrack', 1.3, 0.2, 0, v);
      [[1.56, 0.1], [1.9, 0.1], [1.56, 0.45], [1.9, 0.45]].forEach(function (p) { m.box(p[0], p[1], 0, 0.06, 0.06, 34, C.wood[0]); });
      m.box(1.5, 0.05, 34, 0.46, 0.46, 3, C.wood[2], { top: C.wood[2] });
      m.hip(1.45, 0.0, 37, 0.56, 0.56, 8, C.thatch, { over: 0.1, curl: 1, sag: 0.3, tileDensity: 8, ridgeCol: C.thatchDk, hooks: false, hipK: 1, snow: snow });
      m.box(0.7, 1.92, 0, 0.08, 0.08, 40, C.wood[0]);
      m.box(1.22, 1.92, 0, 0.08, 0.08, 40, C.wood[0]);
      m.box(0.66, 1.9, 36, 0.66, 0.1, 5, C.wood[1], { top: C.wood[2], deco: { F: function (ctx, f) { ckDamageFace(ctx, f, dmg, 0.3, 4); } } });
      m.custom(0.66, 1.96, 0.1, 0.1, 28, function (ctx, mm) { var p = mm.pt(0.72, 2.02, 28); A.lantern(ctx, p[0], p[1], 1); }, 2);
      m.custom(1.22, 1.96, 0.1, 0.1, 28, function (ctx, mm) { var p = mm.pt(1.28, 2.02, 28); A.lantern(ctx, p[0], p[1], 1); }, 2);
      ckFig(m, 1.0, 1.7, 0, C.hanRed, true, 0);
    },
    lights: function (v) {
      var L = [[0.74, 2.0, 30, 20, C.lantern, 0.8, 'F'], [1.26, 2.0, 30, 20, C.lantern, 0.8, 'F']];
      if ((v.dmg || 0) >= 2) L.push([1.0, 1.9, 8, 32, C.fire, 1, 'F']);
      return L;
    },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0, dir = ckDir(m);
      var a = m.pt(0.74, 1.96, 40), b = m.pt(1.26, 1.96, 40);
      ckFlag(ctx, a[0], a[1], 16, 11, C.hanRed, t, 0.2, dir, null, dmg >= 2 ? 1 : 0);
      ckFlag(ctx, b[0], b[1], 16, 11, C.hanRed, t, 1.3, dir, null, dmg >= 2 ? 1 : 0);
      if (dmg >= 1) { var s = m.pt(1.0, 1.0, 30); A.smoke(ctx, s[0], s[1], t, 2.6); }
      if (dmg >= 2) { var q = m.pt(1.0, 1.9, 6); A.fire(ctx, q[0], q[1], t, 1.0); }
    }
  });

  // ---- 將旗 camp_banner 1x1:石座 + 高旗桿 + 大型戰旗(旗面飄動、大字「將」)----
  A.def('camp_banner', {
    w: 1, d: 1, hmax: 100,
    build: function (m, v) {
      var dmg = v.dmg || 0, poleH = dmg >= 2 ? 58 : 88;
      var face = function (ctx, f) { ckDamageFace(ctx, f, dmg, 0.25, 4); };
      m.box(0.26, 0.26, 0, 0.48, 0.48, 7, C.stone[1], { top: C.stone[2], deco: { F: face, B: face, L: face, R: face } });
      m.cyl(0.5, 0.5, 7, 0.05, poleH, C.lacquer, { topCol: C.gold, hoops: [poleH * 0.35, poleH * 0.7], bias: 1 });
      m.cone(0.5, 0.5, 7 + poleH, 0.07, 6, C.gold);
    },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0, top = dmg >= 2 ? 58 : 88;
      var p = m.pt(0.5, 0.5, 7 + top);
      ckFlag(ctx, p[0], p[1], 30, 36, C.hanRed, t, 0.3, ckDir(m), '將', dmg >= 2 ? 1 : 0);
    }
  });
  // =====================================================================
  // 城防設備 16 種(PLAN_DEFENSE §B.6;key 與 CAMP_OBJECTS 相同;lujiao 與 art_deco3 裝飾撞名,改為 camp_lujiao)
  // v.dmg:0 完好 / 1 受損(裂痕、冒煙)/ 2 重創(局部倒塌、火苗);朝向四向;夜間光 lights;動畫 anim
  // =====================================================================
  var CZ_BLUE = '#3f6fb0', CZ_YELLOW = '#e8b23a', CZ_STEEL = '#dfe6ea';
  // 旗竿:底座 (u,v) 於 z 起,高 h(旗面由 anim 的 czFlag 畫在竿頂)
  function czPole(m, u, v, z, h) { m.cyl(u, v, z, 0.04, h, C.lacquer, { topCol: C.gold, bias: 1 }); }
  function czFlag(ctx, m, u, v, z, fw, fh, col, t, seed, dmg, glyph) {
    var p = m.pt(u, v, z);
    ckFlag(ctx, p[0], p[1], fw, fh, col, t, seed, ckDir(m), glyph || null, dmg >= 2 ? 1 : 0);
  }
  // 木樁 / 長槍:自 p=[u,v,z] 到 q=[u,v,z](絕對高度)
  function czSpear(m, p, q, col) {
    var u0 = Math.min(p[0], q[0]), v0 = Math.min(p[1], q[1]);
    m.custom(u0 - 0.03, v0 - 0.03, Math.abs(p[0] - q[0]) + 0.06, Math.abs(p[1] - q[1]) + 0.06, Math.min(p[2], q[2]), function (ctx, mm) {
      var a = mm.pt(p[0], p[1], p[2]), b = mm.pt(q[0], q[1], q[2]);
      A.line(ctx, a, b, C.ink, 2.6); A.line(ctx, a, b, col || C.wood[1], 1.4);
      A.circle(ctx, b[0], b[1], 1.2, CZ_STEEL, 0.5);
    }, 0);
  }
  // 石砌方塊(面上為橫縫,受損顯示裂痕;此處 deco 的 z 皆為相對箱底)
  function czStone(m, u, v, z, w, d, h, dmg, top) {
    var f = function (ctx, fc) { ckLayers(ctx, fc, 4, h, 4, C.stone[0]); ckDamageFace(ctx, fc, dmg, 0.35, h * 0.45); };
    m.box(u, v, z, w, d, h, C.stone[1], { top: top || C.stone[2], deco: { F: f, B: f, L: f, R: f } });
  }
  // 木板牆(含箭窗;相對箱底)
  function czWood(dmg, winZ) {
    return function (ctx, f) { ckLayers(ctx, f, 3, f.h, 5, C.wood[0]); ckWin(ctx, f, 0.5, winZ, 7, 0.16); ckDamageFace(ctx, f, dmg, 0.2, f.h * 0.6); };
  }

  // ---- 輕箭樓 qtower 1×1:細高兩層木樓 + 小青瓦頂 + 藍旗 ----
  A.def('qtower', {
    w: 1, d: 1, hmax: 76,
    build: function (m, v) {
      var dmg = v.dmg || 0, snow = v.season === 'winter', wall = czWood(dmg, 14);
      czStone(m, 0.18, 0.18, 0, 0.64, 0.64, 6, dmg);
      m.box(0.26, 0.26, 6, 0.48, 0.48, 30, C.wood[1], { top: C.wood[2], deco: { F: wall, B: wall, L: wall, R: wall } });
      if (dmg < 2) {
        m.box(0.32, 0.32, 36, 0.36, 0.36, 14, C.wood[2], { deco: { F: wall, B: wall, L: wall, R: wall } });
        m.hip(0.2, 0.2, 50, 0.6, 0.6, 9, C.tile, { over: 0.14, curl: 2.5, sag: 0.8, snow: snow, ridgeCol: C.tileDk, hipK: 0.8 });
        czPole(m, 0.5, 0.5, 59, 10);
      } else {
        m.hip(0.26, 0.26, 36, 0.48, 0.48, 4, C.tile, { over: 0.1, curl: 0, sag: 0.5, ridgeCol: C.tileDk });
      }
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [] : [[0.5, 0.95, 20, 16, C.lamp, 0.6, 'F']]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg < 2) czFlag(ctx, m, 0.5, 0.5, 69, 16, 9, CZ_BLUE, t, 0.4, dmg);
      if (dmg >= 1) { var s = m.pt(0.5, 0.5, 40); A.smoke(ctx, s[0], s[1], t, 1.1); }
    }
  });

  // ---- 重箭樓 ztower 2×2:厚石基 + 木樓身 + 寬檐廡殿(重樓);黑漆旗 ----
  A.def('ztower', {
    w: 2, d: 2, hmax: 92,
    build: function (m, v) {
      var dmg = v.dmg || 0, snow = v.season === 'winter', wall = czWood(dmg, 9);
      czStone(m, 0.05, 0.05, 0, 1.9, 1.9, 24, dmg);
      m.box(0.2, 0.2, 24, 1.6, 1.6, 26, C.wood[1], { top: C.wood[2], deco: { F: wall, B: wall, L: wall, R: wall } });
      if (dmg < 2) {
        m.hip(0.12, 0.12, 50, 1.76, 1.76, 16, C.tile, { over: 0.22, curl: 3, sag: 1.2, snow: snow, ridgeCol: C.lacquer, ridgeHi: C.gold, hipK: 0.7 });
        czPole(m, 1.0, 1.0, 66, 18);
      } else {
        m.hip(0.12, 0.12, 50, 1.76, 1.76, 5, C.tile, { over: 0.1, curl: 0, sag: 0.5, ridgeCol: C.tileDk });
      }
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [] : [[0.5, 1.9, 14, 16, C.lamp, 0.5, 'F'], [1.9, 0.5, 14, 16, C.lamp, 0.5, 'R']]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg < 2) czFlag(ctx, m, 1.0, 1.0, 84, 22, 14, C.lacquer, t, 0.5, dmg, '重');
      if (dmg >= 1) { var s = m.pt(0.3, 0.3, 50); A.smoke(ctx, s[0], s[1], t, 2.1); }
      if (dmg >= 2) { var q = m.pt(1.0, 2.0, 24); A.fire(ctx, q[0], q[1], t, 1.0); }
    }
  });

  // ---- 連弩樓 lianu 2×2:四柱木架 + 平台 + 三具連弩(弩臂朝前)+ 黃旗 ----
  A.def('lianu', {
    w: 2, d: 2, hmax: 100,
    build: function (m, v) {
      var dmg = v.dmg || 0, snow = v.season === 'winter';
      var post = function (ctx, f) { ckDamageFace(ctx, f, dmg, 0.3, 30); };
      czStone(m, 0.0, 0.0, 0, 2.0, 2.0, 6, dmg);
      [[0.1, 0.1], [1.7, 0.1], [0.1, 1.7], [1.7, 1.7]].forEach(function (p, i) {
        if (dmg >= 2 && i === 3) return;
        m.box(p[0], p[1], 6, 0.2, 0.2, 58, C.wood[1], { top: C.wood[2], deco: { F: post, B: post, L: post, R: post } });
      });
      m.box(0.0, 0.0, 60, 2.0, 2.0, 4, C.wood[1], { top: C.wood[2] });
      var stocks = dmg >= 2 ? [0.35, 1.0] : [0.35, 1.0, 1.65];
      stocks.forEach(function (u) { m.box(u - 0.04, 0.3, 64, 0.08, 1.6, 4, C.wood[0], { top: C.wood[2] }); });
      m.custom(0.0, 0.2, 2.0, 1.8, 66, function (ctx, mm) {
        stocks.forEach(function (u) {
          var a = mm.pt(u - 0.32, 1.95, 72), b = mm.pt(u, 1.9, 68), c = mm.pt(u + 0.32, 1.95, 72);
          A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, a, b, C.wood[2], 1.8);
          A.line(ctx, b, c, C.ink, 3.4); A.line(ctx, b, c, C.wood[2], 1.8);
          var p = mm.pt(u, 1.6, 67); A.line(ctx, p, mm.pt(u, 1.95, 67), '#e8dcc0', 0.9);
        });
      }, 1);
      if (dmg < 2) czPole(m, 1.0, 0.25, 64, 22);
      m.box(0.3, 0.3, 64, 1.4, 0.1, 1, C.lacquer, { bias: 1 });
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [] : [[0.35, 1.95, 66, 14, C.lantern, 0.6, 'F'], [1.65, 1.95, 66, 14, C.lantern, 0.6, 'F']]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg < 2) czFlag(ctx, m, 1.0, 0.25, 86, 20, 12, CZ_YELLOW, t, 0.9, dmg);
      if (dmg >= 1) { var s = m.pt(1.0, 0.9, 62); A.smoke(ctx, s[0], s[1], t, 0.4); }
      if (dmg >= 2) { var q = m.pt(0.3, 1.9, 30); A.fire(ctx, q[0], q[1], t, 1.0); }
    }
  });

  // ---- 火箭樓 huojian 2×2:石基 + 高木塔 + 頂層火盆(火矢);朱砂旗;火焰動畫 ----
  A.def('huojian', {
    w: 2, d: 2, hmax: 100,
    build: function (m, v) {
      var dmg = v.dmg || 0, wall = czWood(dmg, 22);
      czStone(m, 0.05, 0.05, 0, 1.9, 1.9, 10, dmg);
      m.box(0.3, 0.3, 10, 1.4, 1.4, 50, C.wood[1], { top: C.wood[2], deco: { F: wall, B: wall, L: wall, R: wall } });
      m.box(0.1, 0.1, 60, 1.8, 1.8, 5, C.wood[2], { top: C.wood[1] });
      if (dmg < 2) ckBrazier(m, 1.0, 1.0, 65);
      czPole(m, 0.25, 0.25, 65, 26);
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [] : [[1.0, 1.0, 80, 30, C.fire, 0.9]]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg < 2) { var p = m.pt(1.0, 1.0, 78); A.fire(ctx, p[0], p[1], t, 1.3); }
      czFlag(ctx, m, 0.25, 0.25, 91, 16, 10, C.cinnabar, t, 0.2, dmg);
      if (dmg >= 1) { var s = m.pt(1.0, 1.0, 70); A.smoke(ctx, s[0], s[1], t, 1.7); }
    }
  });

  // ---- 熏煙台 xunyan 2×2:圓窯(艾煙)+ 煙囪 + 艾草堆;常時冒煙 ----
  A.def('xunyan', {
    w: 2, d: 2, hmax: 74,
    build: function (m, v) {
      var dmg = v.dmg || 0;
      m.cyl(1.0, 1.0, 0, 0.85, 30, C.earthDk, { topCol: A.tone(C.earthDk, 1.1), hoops: [8, 20], bias: 1 });
      if (dmg < 2) m.cone(1.0, 1.0, 30, 0.7, 10, C.stone[1]);
      m.cyl(1.6, 0.4, 0, 0.1, 54, C.stone[1], { topCol: C.stone[2] });
      m.box(0.1, 0.1, 0, 0.5, 0.4, 10, '#6f8f3e', { top: '#8fb05a' });
      m.box(0.2, 1.5, 0, 0.4, 0.4, 8, '#7a9a4a', { top: '#9bbb62' });
      if (dmg >= 1) m.custom(0.6, 0.6, 0.8, 0.8, 16, function (ctx, mm) {
        A.line(ctx, mm.pt(1.2, 1.9, 20), mm.pt(1.26, 1.9, 8), CK_DARK, 1.3);
        A.line(ctx, mm.pt(0.8, 1.9, 24), mm.pt(0.84, 1.9, 14), CK_DARK, 1.3);
      }, 2);
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [] : [[1.0, 1.9, 8, 18, C.fire, 0.7, 'F']]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      var s = m.pt(1.6, 0.4, 58); A.smoke(ctx, s[0], s[1], t, 0.7);
      if (dmg >= 1) { var k = m.pt(1.0, 1.9, 18); A.smoke(ctx, k[0], k[1], t, 2.4); }
      if (dmg >= 2) { var f = m.pt(1.0, 2.1, 4); A.fire(ctx, f[0], f[1], t, 1.1); }
    }
  });

  // ---- 床弩台 chuangtai 2×2:高架木台(四柱+梯)+ 迴轉座上的大床弩;不靠土台,與 camp_nutai 區隔 ----
  A.def('chuangtai', {
    w: 2, d: 2, hmax: 84,
    build: function (m, v) {
      var dmg = v.dmg || 0;
      var post = function (ctx, f) { ckDamageFace(ctx, f, dmg, 0.3, 12); };
      [[0.15, 0.15], [1.6, 0.15], [0.15, 1.6], [1.6, 1.6]].forEach(function (p, i) {
        if (dmg >= 2 && i === 2) return;
        m.box(p[0], p[1], 0, 0.25, 0.25, 26, C.wood[1], { top: C.wood[2], deco: { F: post, B: post, L: post, R: post } });
      });
      var deck = function (ctx, f) { ckLayers(ctx, f, 2, 5, 2, C.wood[0]); };
      m.box(0.05, 0.05, 25, 1.9, 1.9, 5, C.wood[1], { top: C.wood[2], deco: { F: deck, B: deck, L: deck, R: deck } });
      m.cyl(1.0, 1.0, 30, 0.3, 6, C.wood[0], { topCol: C.wood[2], bias: 1 });
      m.custom(0.0, 0.2, 2.0, 1.8, 36, function (ctx, mm) {
        var st0 = mm.pt(1.0, 0.1, 36), st1 = mm.pt(1.0, 1.95, 36);
        A.line(ctx, st0, st1, C.ink, 4.4); A.line(ctx, st0, st1, C.wood[1], 2.4);
        var l0 = mm.pt(0.0, 1.2, 42), l1 = mm.pt(1.0, 1.4, 37), l2 = mm.pt(2.0, 1.2, 42);
        A.line(ctx, l0, l1, C.ink, 4); A.line(ctx, l0, l1, C.wood[2], 2);
        if (dmg < 2) { A.line(ctx, l1, l2, C.ink, 4); A.line(ctx, l1, l2, C.wood[2], 2); }
        A.line(ctx, mm.pt(1.0, 0.9, 36), mm.pt(1.0, 1.95, 36), CZ_STEEL, 1.1);
      }, 2);
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [] : [[0.2, 0.2, 26, 14, C.lamp, 0.5, 'F']]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg >= 1) { var s = m.pt(1.0, 1.0, 40); A.smoke(ctx, s[0], s[1], t, 1.9); }
      if (dmg >= 2) { var q = m.pt(0.2, 1.7, 6); A.fire(ctx, q[0], q[1], t, 0.9); }
    }
  });

  // ---- 霹靂車 pili 3×3:石台 + A 字木架 + 配重投石臂(長臂、吊籃)+ 玄旗 ----
  A.def('pili', {
    w: 3, d: 3, hmax: 110,
    build: function (m, v) {
      var dmg = v.dmg || 0;
      czStone(m, 0.1, 0.1, 0, 2.8, 2.8, 8, dmg);
      m.box(1.1, 0.3, 12, 0.8, 0.6, 14, C.stone[0], { top: C.stone[2] });
      m.custom(0.6, 1.3, 1.8, 0.4, 8, function (ctx, mm) {
        var a = mm.pt(0.7, 1.5, 8), b = mm.pt(1.5, 1.5, 62), c = mm.pt(2.3, 1.5, 8);
        A.line(ctx, a, b, C.ink, 5.2); A.line(ctx, a, b, C.wood[1], 3);
        A.line(ctx, c, b, C.ink, 5.2); A.line(ctx, c, b, C.wood[1], 3);
        var d = mm.pt(0.95, 1.5, 30), e = mm.pt(2.05, 1.5, 30); A.line(ctx, d, e, C.ink, 3); A.line(ctx, d, e, C.wood[2], 1.6);
      }, 1);
      m.cyl(1.5, 1.5, 58, 0.12, 6, C.ink, { topCol: C.stone[2], bias: 2 });
      m.custom(1.2, 0.2, 0.6, 2.6, 14, function (ctx, mm) {
        var a = mm.pt(1.5, 0.6, 20), b = mm.pt(1.5, 1.5, 61), c = mm.pt(1.5, dmg >= 2 ? 2.0 : 2.6, dmg >= 2 ? 50 : 78);
        A.line(ctx, a, b, C.ink, 6); A.line(ctx, a, b, C.wood[2], 3.6);
        A.line(ctx, b, c, C.ink, 6); A.line(ctx, b, c, C.wood[2], 3.6);
        if (dmg < 2) { var s = mm.pt(1.5, 2.6, 78); A.line(ctx, c, s, '#8a7a5a', 0.9); A.circle(ctx, s[0], s[1], 3.2, C.stone[2], 0.7); }
      }, 2);
      if (dmg < 2) czPole(m, 2.7, 2.7, 8, 22);
    },
    lights: function () { return []; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg < 2) czFlag(ctx, m, 2.7, 2.7, 30, 16, 10, C.lacquer, t, 0.7, dmg);
      if (dmg >= 1) { var s = m.pt(1.0, 1.0, 14); A.smoke(ctx, s[0], s[1], t, 2.8); }
    }
  });

  // ---- 擂鼓台 gutai 2×2:木台 + 欄杆 + 大鼓(鼓面脈動)+ 四柱小頂 ----
  A.def('gutai', {
    w: 2, d: 2, hmax: 82,
    build: function (m, v) {
      var dmg = v.dmg || 0, snow = v.season === 'winter';
      var rail = function (ctx, f) { ckDamageFace(ctx, f, dmg, 0.2, 14); };
      m.box(0.05, 0.05, 0, 1.9, 1.9, 10, C.wood[1], { top: C.wood[2], deco: { F: rail, B: rail, L: rail, R: rail } });
      m.custom(0.05, 0.05, 1.9, 1.9, 24, function (ctx, mm) {
        [[0.05, 0.05, 1.95, 0.05], [0.05, 1.95, 1.95, 1.95], [0.05, 0.05, 0.05, 1.95], [1.95, 0.05, 1.95, 1.95]].forEach(function (s) {
          var a = mm.pt(s[0], s[1], 20), b = mm.pt(s[2], s[3], 20); A.line(ctx, a, b, C.ink, 3); A.line(ctx, a, b, C.lacquer, 1.6);
        });
      }, 1);
      m.cyl(1.0, 1.0, 10, 0.6, 26, C.hanRed, { topCol: '#f2dfb2', hoops: [6, 22], bias: 2 });
      [[0.1, 0.1], [1.75, 0.1], [0.1, 1.75], [1.75, 1.75]].forEach(function (p) { m.box(p[0], p[1], 10, 0.15, 0.15, 26, C.wood[0]); });
      if (dmg < 2) m.hip(0.0, 0.0, 36, 2.0, 2.0, 12, C.tile, { over: 0.2, curl: 3, sag: 1, snow: snow, ridgeCol: C.tileDk, hipK: 0.8 });
      else m.box(0.0, 0.0, 36, 2.0, 2.0, 3, C.tileDk, { top: C.tile });
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [] : [[0.3, 1.95, 30, 14, C.lantern, 0.6, 'F'], [1.7, 1.95, 30, 14, C.lantern, 0.6, 'F']]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0, p = m.pt(1.0, 1.0, 36), k = 1 + 0.08 * Math.sin(t * 9);
      ctx.save(); ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(p[0], p[1], 15 * k, 7.5 * k, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#f2dfb2'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
      if (dmg >= 1) { var s = m.pt(0.2, 0.2, 40); A.smoke(ctx, s[0], s[1], t, 0.9); }
    }
  });

  // ---- 烽燧台 fengsui 1×1:石座 + 細高木柱 + 頂端鐵籃;夜間點火(動畫)----
  A.def('fengsui', {
    w: 1, d: 1, hmax: 104,
    build: function (m, v) {
      var dmg = v.dmg || 0, grain = function (ctx, f) { ckLayers(ctx, f, 4, 70, 8, C.wood[1]); };
      czStone(m, 0.25, 0.25, 0, 0.5, 0.5, 8, dmg);
      m.box(0.42, 0.42, 8, 0.16, 0.16, 72, C.wood[0], { top: C.wood[2], deco: { F: grain, B: grain, L: grain, R: grain } });
      m.cyl(0.5, 0.5, 80, 0.22, 10, C.stone[0], { topCol: C.lacquer, hoops: [4], bias: 1 });
      m.cone(0.5, 0.5, 90, 0.26, 4, C.stone[1], { bias: 1 });
    },
    lights: function () { return [[0.5, 0.5, 92, 40, C.fire, 1.0]]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0, p = m.pt(0.5, 0.5, 92);
      if (A.todOf(v).lit) { A.fire(ctx, p[0], p[1], t, 1.6); A.fire(ctx, p[0] + 3, p[1] + 1, t + 0.7, 1.0); }
      else if (dmg >= 1) A.smoke(ctx, p[0], p[1], t, 1.3);
      if (dmg >= 2) { var q = m.pt(0.5, 0.5, 9); A.fire(ctx, q[0], q[1], t, 0.8); }
    }
  });

  // ---- 望樓 wanglou 1×1:四腳高架木構 + 小木屋 + 小廡殿頂;與 watchtower(2×2)區隔 ----
  A.def('wanglou', {
    w: 1, d: 1, hmax: 132,
    build: function (m, v) {
      var dmg = v.dmg || 0, snow = v.season === 'winter', wall = czWood(dmg, 8);
      [[0.05, 0.05], [0.85, 0.05], [0.05, 0.85], [0.85, 0.85]].forEach(function (p) { m.box(p[0], p[1], 0, 0.1, 0.1, 96, C.wood[1], { top: C.wood[2] }); });
      m.custom(0.0, 0.0, 1.0, 1.0, 2, function (ctx, mm) {
        [[0.05, 0.9, 0.9, 0.05], [0.05, 0.05, 0.9, 0.9]].forEach(function (s) {
          var a = mm.pt(s[0], s[1], 4), b = mm.pt(s[2], s[3], 90);
          A.line(ctx, a, b, C.ink, 2.6); A.line(ctx, a, b, C.wood[0], 1.4);
        });
      }, 0);
      m.box(0.0, 0.0, 96, 1.0, 1.0, 4, C.wood[1], { top: C.wood[2] });
      m.box(0.12, 0.12, 100, 0.76, 0.76, 16, C.wood[2], { top: C.wood[1], deco: { F: wall, B: wall, L: wall, R: wall } });
      if (dmg < 2) m.hip(0.06, 0.06, 116, 0.88, 0.88, 10, C.tile, { over: 0.12, curl: 2, sag: 0.8, snow: snow, ridgeCol: C.lacquer, hipK: 0.8 });
      else m.hip(0.06, 0.06, 116, 0.88, 0.88, 3, C.tile, { over: 0.06, curl: 0, sag: 0.3, ridgeCol: C.tileDk });
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [] : [[0.5, 0.9, 106, 16, C.lamp, 0.7, 'F'], [0.9, 0.5, 106, 16, C.lamp, 0.6, 'R']]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg >= 1) { var s = m.pt(0.5, 0.5, 120); A.smoke(ctx, s[0], s[1], t, 1.5); }
    }
  });

  // ---- 拒馬槍陣 qiangzhen 2×2:木架橫樑 + 向外斜伸的長槍;矮而寬,阻騎 ----
  A.def('qiangzhen', {
    w: 2, d: 2, hmax: 44,
    build: function (m, v) {
      var dmg = v.dmg || 0, beamZ = dmg >= 2 ? 6 : 14;
      [0.3, 1.7].forEach(function (u) {
        m.custom(u - 0.1, 0.5, 0.2, 1.0, 0, function (ctx, mm) {
          var a = mm.pt(u, 0.6, 0), b = mm.pt(u, 1.4, beamZ + 2), c = mm.pt(u, 1.4, 0), d = mm.pt(u, 0.6, beamZ + 2);
          A.line(ctx, a, b, C.ink, 3); A.line(ctx, a, b, C.wood[0], 1.6);
          A.line(ctx, c, d, C.ink, 3); A.line(ctx, c, d, C.wood[0], 1.6);
        }, 0);
      });
      m.box(0.05, 0.85, beamZ, 1.9, 0.14, 4, C.wood[1], { top: C.wood[2] });
      [0.1, 0.55, 1.0, 1.45, 1.9].forEach(function (u, i) {
        if (dmg >= 1 && i === 2) return;
        czSpear(m, [u, 0.9, beamZ + 1], [u, 2.25, beamZ + 8 + (i % 2) * 4], i % 2 ? C.wood[0] : C.wood[1]);
      });
    },
    lights: function () { return []; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg >= 2) { var s = m.pt(1.0, 1.0, 10); A.smoke(ctx, s[0], s[1], t, 0.5); }
    }
  });

  // ---- 破甲弩 ponu 2×2:石座 + 大型重弩(雙弓臂)+ 絞盤;弩矢粗而沉 ----
  A.def('ponu', {
    w: 2, d: 2, hmax: 72,
    build: function (m, v) {
      var dmg = v.dmg || 0;
      czStone(m, 0.25, 0.25, 0, 1.5, 1.5, 22, dmg);
      m.box(0.85, 0.2, 22, 0.3, 1.6, 6, C.wood[0], { top: C.wood[2] });
      m.box(0.55, 0.5, 28, 0.8, 0.7, 10, C.wood[1], { top: C.wood[2] });
      m.custom(-0.1, 0.2, 2.2, 1.6, 28, function (ctx, mm) {
        var a = mm.pt(-0.1, 1.5, 46), b = mm.pt(0.5, 1.4, 41), c = mm.pt(1.0, 1.3, 38), d = mm.pt(1.5, 1.4, 41), e = mm.pt(2.1, 1.5, 46);
        var seg = function (p, q) { A.line(ctx, p, q, C.ink, 5); A.line(ctx, p, q, C.wood[2], 2.8); };
        if (dmg < 2) seg(a, b);
        seg(b, c); seg(c, d); seg(d, e);
        A.line(ctx, mm.pt(-0.1, 1.5, 46), mm.pt(2.1, 1.5, 46), '#e8dcc0', 0.8);
      }, 1);
      m.custom(0.8, 0.2, 0.4, 1.8, 28, function (ctx, mm) {
        var a = mm.pt(1.0, 0.2, 31), b = mm.pt(1.0, 1.9, 31);
        A.line(ctx, a, b, C.ink, 4); A.line(ctx, a, b, CZ_STEEL, 2.4);
        A.poly(ctx, [mm.pt(1.0, 1.9, 33), mm.pt(1.0, 2.05, 31), mm.pt(1.0, 1.9, 29)], CZ_STEEL, 0.5);
      }, 2);
    },
    lights: function () { return []; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg >= 1) { var s = m.pt(1.0, 1.0, 40); A.smoke(ctx, s[0], s[1], t, 1.6); }
    }
  });

  // ---- 敵樓 dilou 2×2:厚石城角堡,頂為平台與女牆(無屋頂)+ 玄旗 ----
  A.def('dilou', {
    w: 2, d: 2, hmax: 112,
    build: function (m, v) {
      var dmg = v.dmg || 0;
      var fw = function (ctx, f) { ckLayers(ctx, f, 8, 88, 8, C.stone[0]); ckWin(ctx, f, 0.3, 40, 10, 0.12); ckWin(ctx, f, 0.7, 40, 10, 0.12); ckDamageFace(ctx, f, dmg, 0.5, 60); };
      m.box(0.05, 0.05, 0, 1.9, 1.9, 88, C.stone[1], { top: C.stone[2], deco: { F: fw, B: fw, L: fw, R: fw } });
      var mer = [0.05, 0.5, 0.95, 1.4, 1.75];
      mer.forEach(function (p) {
        m.box(p, 0.0, 88, 0.2, 0.2, 8, C.stone[1], { top: C.stone[2] });
        m.box(p, 1.8, 88, 0.2, 0.2, 8, C.stone[1], { top: C.stone[2] });
        if (dmg < 2) m.box(1.8, p, 88, 0.2, 0.2, 8, C.stone[1], { top: C.stone[2] });
        m.box(0.0, p, 88, 0.2, 0.2, 8, C.stone[1], { top: C.stone[2] });
      });
      if (dmg < 2) czPole(m, 1.0, 1.0, 96, 14);
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [] : [[0.7, 1.92, 40, 14, C.lamp, 0.6, 'F'], [1.92, 0.7, 40, 14, C.lamp, 0.5, 'R']]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg < 2) czFlag(ctx, m, 1.0, 1.0, 110, 22, 12, C.lacquer, t, 0.3, dmg);
      if (dmg >= 1) { var s = m.pt(1.9, 1.9, 96); A.smoke(ctx, s[0], s[1], t, 2.2); }
    }
  });

  // ---- 閘樓 zhalou 3×1:營門箭閘,下方為石砌門洞(鐵閘下垂)、上為木樓與寬檐;可旋轉 ----
  A.def('zhalou', {
    w: 3, d: 1, hmax: 96,
    build: function (m, v) {
      var dmg = v.dmg || 0, snow = v.season === 'winter';
      var base = function (ctx, f) {
        ckLayers(ctx, f, 4, 28, 5, C.stone[0]);
        A.poly(ctx, A.quad(f, 0.35, 0.65, 0, 18), CK_DARK, 0.5);
        var s;
        for (s = 0.37; s < 0.64; s += 0.065) {
          if (dmg >= 2 && s > 0.5) continue;
          A.line(ctx, f.pt(s, 0), f.pt(s, 17), CZ_STEEL, 1.2);
        }
        [6, 12].forEach(function (z) { A.line(ctx, f.pt(0.35, z), f.pt(0.65, z), CZ_STEEL, 1.2); });
        ckDamageFace(ctx, f, dmg, 0.08, 20);
      };
      m.box(0.0, 0.1, 0, 3.0, 0.8, 28, C.stone[1], { top: C.stone[2], deco: { F: base, B: base, L: base, R: base } });
      var up = function (ctx, f) { ckLayers(ctx, f, 4, 22, 5, C.wood[0]); ckWin(ctx, f, 0.22, 8, 6, 0.16); ckWin(ctx, f, 0.78, 8, 6, 0.16); ckDamageFace(ctx, f, dmg, 0.5, 14); };
      m.box(0.2, 0.1, 28, 2.6, 0.8, 22, C.wood[1], { top: C.wood[2], deco: { F: up, B: up, L: up, R: up } });
      if (dmg < 2) m.hip(0.1, 0.05, 50, 2.8, 0.9, 14, C.tile, { over: 0.2, curl: 3, sag: 1.2, snow: snow, ridgeCol: C.lacquer, ridgeHi: C.gold, hipK: 0.7 });
      else m.hip(0.1, 0.05, 50, 2.8, 0.9, 4, C.tile, { over: 0.1, curl: 0, sag: 0.4, ridgeCol: C.tileDk });
      if (dmg < 2) czPole(m, 1.5, 0.5, 64, 14);
    },
    lights: function (v) { return (v.dmg || 0) >= 2 ? [] : [[1.5, 0.95, 16, 22, C.lamp, 0.6, 'F']]; },
    anim: function (ctx, m, t, v) {
      var dmg = v.dmg || 0;
      if (dmg < 2) czFlag(ctx, m, 1.5, 0.5, 78, 16, 9, C.lacquer, t, 1.1, dmg);
      if (dmg >= 1) { var s = m.pt(0.6, 0.5, 52); A.smoke(ctx, s[0], s[1], t, 0.2); }
      if (dmg >= 2) { var q = m.pt(2.4, 0.5, 4); A.fire(ctx, q[0], q[1], t, 1.0); }
    }
  });

  // ---- 鹿角 camp_lujiao 1×1(key lujiao;與 art_deco3 裝飾撞名故加 camp_ 前綴):放射狀削尖木枝 ----
  A.def('camp_lujiao', {
    w: 1, d: 1, hmax: 24,
    build: function (m, v) {
      var dmg = v.dmg || 0, i, a, tipZ = dmg >= 2 ? 6 : 14;
      for (i = 0; i < 8; i++) {
        if (dmg >= 1 && i % 3 === 0) continue;
        a = i / 8 * Math.PI * 2 + 0.2;
        czSpear(m, [0.5, 0.5, 1], [0.5 + Math.cos(a) * 0.42, 0.5 + Math.sin(a) * 0.42, tipZ + (i % 2) * 4], i % 2 ? C.wood[2] : C.wood[1]);
      }
      m.cyl(0.5, 0.5, 0, 0.12, 4, C.wood[0], { topCol: C.wood[2], bias: 2 });
    }
  });

  // ---- 尖樁陣 jianzhuang 2×2:地面斜插的尖木樁(減速,低矮);受損樁倒伏 ----
  A.def('jianzhuang', {
    w: 2, d: 2, hmax: 18,
    build: function (m, v) {
      var dmg = v.dmg || 0, n = 0;
      [0.3, 1.0, 1.7].forEach(function (u, iu) {
        [0.3, 1.0, 1.7].forEach(function (w, iv) {
          n++;
          if (dmg >= 1 && n % 4 === 0) return;
          var z = dmg >= 2 ? 5 : 12, lean = dmg >= 2 ? 0.4 : 0.25;
          czSpear(m, [u, w, 0], [u + (iu % 2 ? -0.08 : 0.08), w + lean, z], iv % 2 ? C.wood[1] : C.wood[0]);
        });
      });
    }
  });

})(ART);
