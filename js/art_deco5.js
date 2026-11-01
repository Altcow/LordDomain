// art_deco5.js — 裝飾五:桌椅與家具(經營布置用,side:'estate')。風格同 art_deco1 食案 / 席、art_deco4 庭園。
// 依賴 art.js、art_objects.js 先載入;OBJECTS 來自 data.js。本檔物件皆為新 key,不覆寫既有定義。
// 朝向:Model 以局部 (u,v) 繪製,v = 深度、正面在 v = D;rot 0 正面朝南(+y)、1 朝西、2 朝北、3 朝東。
// 非正方形且會轉向者 swap:true(footprint 奇數 rot 對調);對稱者 sym:true(畫面固定、rot 不影響)。

(function (A) {
  var C = A.C;
  var BAMBOO = '#8fb84a', BAMBOO_DK = '#4f8f2e', BAMBOO_LT = '#c4e08a';

  function snowOn(v) { return v && v.season === 'winter' ? C.snow : null; }
  // 木紋:頂面橫向細線(v 方向分段),z 為頂面高度
  function grain(col, z) {
    return function (ctx, mm) {
      for (var i = 1; i <= 3; i++) { var k = i * 0.22; A.line(ctx, mm.pt(0.06, k, z), mm.pt(0.94, k, z), col, 0.6); }
    };
  }
  // 細腿(方柱,0.07 見方)
  function leg(m, u, v, z, h, col) { m.box(u - 0.035, v - 0.035, z, 0.07, 0.07, h, col); }

  // 外八細腳:list = [[u, v, du, dv], ...],由座面下 (u,v) 斜向外落到 (u+du, v+dv, 0);按深度先後畫
  function splay(m, W, D, zTop, list, col, wd) {
    wd = wd || 2.6;
    m.custom(0, 0, W, D, 0, function (ctx, mm) {
      list.map(function (p) { var g = mm.g(p[0], p[1]); return { p: p, k: g[0] + g[1] }; })
        .sort(function (a, b) { return a.k - b.k; })
        .forEach(function (o) {
          var p = o.p, a = mm.pt(p[0], p[1], zTop), b = mm.pt(p[0] + p[2], p[1] + p[3], 0);
          A.line(ctx, a, b, C.ink, wd + 1.6); A.line(ctx, a, b, col, wd);
        });
    });
  }
  // 圓頂面上的一圈小點(半徑 r 對應螢幕橢圓 rx = 45.25r、ry = 22.63r)
  function rimDots(m, u, v, z, r, n, col, dot) {
    m.custom(u - r - 0.04, v - r - 0.04, 2 * r + 0.08, 2 * r + 0.08, z + 0.2, function (ctx, mm) {
      var c = mm.pt(u, v, z);
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2;
        A.circle(ctx, c[0] + Math.cos(a) * r * 45.25, c[1] + Math.sin(a) * r * 22.63, dot, col, 0.5);
      }
    });
  }
  var STONE_WARM = '#b9a07c', STONE_WARM_LT = '#e6d8bb', STONE_WARM_DK = '#8d7656';

  // 石桌 stone_table:高石柱 + 寬圓石面(高約為石凳 2 倍),面上刻棋盤、擺黑白棋子
  A.def('stone_table', {
    w: 1, d: 1, sym: true, hmax: 24, shadow: 'ellipse',
    build: function (m, v) {
      var top = snowOn(v) || C.stone[2];
      m.cyl(0.5, 0.5, 0, 0.3, 3, C.stone[0], { topCol: C.stone[1] });
      m.cyl(0.5, 0.5, 3, 0.17, 13, C.stone[1], { topCol: C.stone[1], hoops: [5, 11] });
      m.cyl(0.5, 0.5, 16, 0.46, 3.6, C.stone[2], { topCol: top });
      m.custom(0.25, 0.25, 0.5, 0.5, 19.6, function (ctx, mm) {
        if (snowOn(v)) return;
        var i, k;
        for (i = 0; i <= 4; i++) {
          k = 0.3 + i * 0.1;
          A.line(ctx, mm.pt(0.3, k, 19.6), mm.pt(0.7, k, 19.6), C.stone[0], 0.7);
          A.line(ctx, mm.pt(k, 0.3, 19.6), mm.pt(k, 0.7, 19.6), C.stone[0], 0.7);
        }
        var b = mm.pt(0.4, 0.4, 19.6), w = mm.pt(0.6, 0.5, 19.6), b2 = mm.pt(0.5, 0.6, 19.6);
        A.circle(ctx, b[0], b[1], 1.7, C.lacquer, 0.6); A.circle(ctx, b2[0], b2[1], 1.7, C.lacquer, 0.6);
        A.circle(ctx, w[0], w[1], 1.7, '#fffdf4', 0.7);
      });
    }
  });

  // 石凳 stone_stool:矮鼓形石墩(上下寬、腰收),暖砂岩色,頂緣一圈鼓釘;約桌的一半高、無桌面物
  A.def('stone_stool', {
    w: 1, d: 1, sym: true, hmax: 15, shadow: 'ellipse',
    build: function (m, v) {
      m.cyl(0.5, 0.5, 0, 0.34, 2.8, STONE_WARM_DK, { topCol: STONE_WARM });
      m.cyl(0.5, 0.5, 2.8, 0.27, 5.6, STONE_WARM, { topCol: STONE_WARM, hoops: [2.8] });
      m.cyl(0.5, 0.5, 8.4, 0.38, 3.2, STONE_WARM, { topCol: snowOn(v) || STONE_WARM_LT, hoops: [1.6] });
      if (!snowOn(v)) m.custom(0.1, 0.1, 0.8, 0.8, 11.8, function (ctx, mm) {
        var c = mm.pt(0.5, 0.5, 11.6);
        ctx.save(); ctx.beginPath(); ctx.ellipse(c[0], c[1], 0.27 * 45.25, 0.27 * 22.63, 0, 0, Math.PI * 2);
        ctx.strokeStyle = STONE_WARM_DK; ctx.lineWidth = 1.3; ctx.stroke(); ctx.restore();
      });
    }
  });

  // 長木凳 bench_wood:矮長凳(座高約 9),窄座面 + 後方一排豎條靠背,外八的腳;與高桌面的長案明顯不同(2×1,沿 u)
  A.def('bench_wood', {
    w: 2, d: 1, hmax: 28, shadow: 'rect',
    build: function (m, v) {
      var sn = v.season === 'winter', i;
      splay(m, 2, 1, 7, [[0.16, 0.38, -0.07, -0.05], [0.16, 0.84, -0.07, 0.05], [1.84, 0.38, 0.07, -0.05], [1.84, 0.84, 0.07, 0.05]], C.wood[0], 3);
      // 靠背:兩根後柱 + 上橫梁 + 下橫條 + 一排豎條
      m.box(0.1, 0.14, 0, 0.09, 0.09, 7, C.wood[0]);
      m.box(1.81, 0.14, 0, 0.09, 0.09, 7, C.wood[0]);
      m.box(0.1, 0.14, 9.2, 0.09, 0.09, 14, C.wood[0]);
      m.box(1.81, 0.14, 9.2, 0.09, 0.09, 14, C.wood[0]);
      m.box(0.06, 0.12, 21.2, 1.88, 0.13, 2.4, C.wood[1], { top: sn ? C.snow : C.wood[2] });
      m.box(0.16, 0.13, 10.4, 1.68, 0.09, 1.6, C.wood[1]);
      for (i = 0; i < 9; i++) m.box(0.25 + i * 0.19, 0.145, 12, 0.07, 0.06, 9.2, C.wood[2]);
      m.box(0.04, 0.3, 7, 1.92, 0.62, 2.2, C.wood[2], { top: sn ? C.snow : A.tone(C.wood[2], 1.06), topDeco: function (ctx, mm) {
        if (sn) return;
        for (var j = 1; j <= 2; j++) { var k = 0.3 + j * 0.205; A.line(ctx, mm.pt(0.1, k, 9.2), mm.pt(1.9, k, 9.2), C.wood[1], 0.6); }
      } });
    }
  });

  // 木桌 table_wood:高方桌(桌面高約 17),四腳 + 裙板,桌面小陶罐與茶杯(對稱)
  A.def('table_wood', {
    w: 1, d: 1, sym: true, hmax: 30, shadow: 'ellipse',
    build: function (m, v) {
      var sn = v.season === 'winter';
      [0.11, 0.82].forEach(function (u) { [0.11, 0.82].forEach(function (w) { leg(m, u, w, 0, 14.5, C.wood[0]); }); });
      m.box(0.1, 0.1, 11.5, 0.8, 0.8, 3, C.wood[1]);
      m.box(0.03, 0.03, 14.5, 0.94, 0.94, 2.6, C.wood[2], { top: sn ? C.snow : C.wood[2], topDeco: grain(C.wood[1], 17.1) });
      m.cyl(0.36, 0.42, 17.1, 0.1, 4.4, C.silk, { topCol: '#f0e4c8', hoops: [2.2] });
      m.cyl(0.68, 0.62, 17.1, 0.06, 2.2, C.bronze, { topCol: C.lacquer });
    }
  });

  // 長案 table_long:長桌(桌面高約 13,比長凳高),朱漆裙板,案上竹簡與硯臺(2×1,沿 u)
  A.def('table_long', {
    w: 2, d: 1, hmax: 26, shadow: 'rect',
    build: function (m, v) {
      var sn = v.season === 'winter';
      leg(m, 0.12, 0.12, 0, 11, C.wood[0]); leg(m, 1.82, 0.12, 0, 11, C.wood[0]);
      leg(m, 0.12, 0.8, 0, 11, C.wood[0]); leg(m, 1.82, 0.8, 0, 11, C.wood[0]);
      m.box(0.1, 0.78, 8, 1.8, 0.1, 3.4, C.hanRed);
      m.box(0.02, 0.02, 11, 1.96, 0.96, 2.6, C.wood[2], { top: sn ? C.snow : C.wood[2], topDeco: grain(C.wood[1], 13.6) });
      m.cyl(0.4, 0.5, 13.6, 0.09, 3, C.silk, { topCol: '#f0e4c8' });
      m.cyl(0.62, 0.5, 13.6, 0.09, 3, C.silk, { topCol: '#f0e4c8' });
      m.cyl(1.55, 0.5, 13.6, 0.15, 2, C.stone[1], { topCol: C.stone[2] });
    }
  });

  // 胡床 hu_chuang:X 形交叉腿的折疊小凳,座面是繃緊的藍布(兩側木框、白色束帶)
  function xFrame(m, v0) {
    m.custom(0.1, v0 - 0.04, 0.8, 0.08, 0, function (ctx, mm) {
      var a = mm.pt(0.14, v0, 0), b = mm.pt(0.86, v0, 10.4), c = mm.pt(0.86, v0, 0), d = mm.pt(0.14, v0, 10.4), k = mm.pt(0.5, v0, 5.2);
      A.line(ctx, a, b, C.ink, 4.6); A.line(ctx, a, b, C.wood[2], 3);
      A.line(ctx, c, d, C.ink, 4.6); A.line(ctx, c, d, C.wood[1], 3);
      A.circle(ctx, k[0], k[1], 1.7, C.gold, 0.8);
    });
  }
  A.def('hu_chuang', {
    w: 1, d: 1, hmax: 16, shadow: 'ellipse',
    build: function (m, v) {
      var sn = v.season === 'winter', cloth = '#3e6fb0';
      xFrame(m, 0.14); xFrame(m, 0.86);
      m.box(0.06, 0.06, 10.4, 0.1, 0.88, 1.6, C.wood[1]);
      m.box(0.84, 0.06, 10.4, 0.1, 0.88, 1.6, C.wood[1]);
      m.box(0.16, 0.08, 10.8, 0.68, 0.84, 1.1, cloth, { top: sn ? C.snow : '#5a8ad0', topDeco: function (ctx, mm) {
        if (sn) return;
        [0.34, 0.5, 0.66].forEach(function (k) { A.line(ctx, mm.pt(0.18, k, 11.9), mm.pt(0.82, k, 11.9), '#f4f0e0', 0.9); });
      } });
    }
  });

  // 竹椅 chair_bamboo:暖黃竹椅,矮座面 + 兩根高後柱撐起的靠背(上橫梁 + 豎條)+ 兩側扶手
  A.def('chair_bamboo', {
    w: 1, d: 1, hmax: 32, shadow: 'ellipse',
    build: function (m, v) {
      var sn = v.season === 'winter', BY = '#d9b04b', BDK = '#9c7425', BLT = '#f3dc8e', i;
      leg(m, 0.14, 0.82, 0, 9, BDK); leg(m, 0.82, 0.82, 0, 9, BDK);
      leg(m, 0.14, 0.16, 0, 9, BDK); leg(m, 0.82, 0.16, 0, 9, BDK);
      m.box(0.1, 0.12, 9, 0.8, 0.8, 1.8, BY, { top: sn ? C.snow : BLT, topDeco: function (ctx, mm) {
        if (sn) return;
        for (var j = 1; j <= 5; j++) A.line(ctx, mm.pt(0.14, 0.12 + j * 0.13, 10.8), mm.pt(0.86, 0.12 + j * 0.13, 10.8), BDK, 0.5);
      } });
      // 後柱(座面以上)、靠背橫梁與豎條
      m.box(0.11, 0.11, 10.8, 0.08, 0.08, 18, BDK); m.box(0.81, 0.11, 10.8, 0.08, 0.08, 18, BDK);
      m.box(0.09, 0.09, 26, 0.82, 0.12, 2.6, BY, { top: sn ? C.snow : BLT });
      m.box(0.15, 0.11, 17, 0.7, 0.07, 1.6, BY);
      for (i = 0; i < 3; i++) m.box(0.3 + i * 0.2, 0.12, 18.6, 0.05, 0.05, 7.4, BY);
      // 扶手:前短柱 + 側橫條
      m.box(0.12, 0.8, 10.8, 0.06, 0.06, 7.2, BDK); m.box(0.82, 0.8, 10.8, 0.06, 0.06, 7.2, BDK);
      m.box(0.1, 0.14, 18, 0.1, 0.72, 1.6, BY, { top: sn ? C.snow : BLT });
      m.box(0.8, 0.14, 18, 0.1, 0.72, 1.6, BY, { top: sn ? C.snow : BLT });
    }
  });

  // 茶席 tea_set:席墊 + 矮茶案 + 茶壺與兩只茶杯(蒸氣為動畫)
  A.def('tea_set', {
    w: 1, d: 1, hmax: 17, shadow: 'rect',
    build: function (m, v) {
      var sn = v.season === 'winter';
      m.box(0.02, 0.02, 0, 0.96, 0.96, 1, '#e8d27a', { topDeco: function (ctx, mm) {
        for (var i = 1; i < 6; i++) { var k = 0.02 + i * 0.16; A.line(ctx, mm.pt(k, 0.04, 1), mm.pt(k, 0.96, 1), C.wood[2], 0.5); A.line(ctx, mm.pt(0.04, k, 1), mm.pt(0.96, k, 1), C.wood[2], 0.5); }
      } });
      m.box(0.2, 0.2, 1, 0.6, 0.6, 5, C.wood[1], { top: sn ? C.snow : C.wood[2], topDeco: grain(C.wood[1], 6) });
      m.cyl(0.4, 0.34, 6, 0.1, 3.4, C.bronze, { topCol: C.lacquer });
      m.cyl(0.66, 0.66, 6, 0.065, 2.2, C.silk, { topCol: '#f0e4c8' });
      m.cyl(0.66, 0.4, 6, 0.065, 2.2, C.silk, { topCol: '#f0e4c8' });
    },
    anim: function (ctx, m, t) { var p = m.pt(0.4, 0.34, 10); A.smoke(ctx, p[0], p[1], t, 3.1); }
  });

  // 屏風 screen_fold:四扇折屏,前後錯落如鋸齒;扇面畫山水與日輪(2×1,沿 u)
  A.def('screen_fold', {
    w: 2, d: 1, hmax: 32, shadow: 'rect',
    build: function (m, v) {
      var sn = v.season === 'winter';
      var paint = function (ctx, f) {
        A.poly(ctx, [f.pt(0.08, 3), f.pt(0.3, 17), f.pt(0.5, 9), f.pt(0.75, 21), f.pt(0.92, 3)], '#6a8f5a', 0.5);
        A.poly(ctx, [f.pt(0.5, 3), f.pt(0.7, 12), f.pt(0.9, 3)], '#8fb0a0', 0.5);
        A.circle(ctx, f.pt(0.72, 25)[0], f.pt(0.72, 25)[1], 3.6, C.gold, 0.5);
      };
      m.box(0.04, 0.04, 0, 1.92, 0.92, 2.4, C.wood[1], { top: sn ? C.snow : C.wood[2] });
      [0, 1, 2, 3].forEach(function (i) {
        var u = 0.04 + i * 0.48, vv = (i % 2 === 0) ? 0.46 : 0.14;
        m.box(u, vv, 2.4, 0.46, 0.08, 27, C.silk, { top: C.lacquer, deco: { F: paint, B: paint } });
      });
    }
  });

  // 案几與坐墊 low_table_cushion:低矮翹頭案在後(約高 10)、前方一塊鮮紅厚方坐墊(四角金流蘇、中央金釦);案上一杯
  A.def('low_table_cushion', {
    w: 1, d: 1, hmax: 16, shadow: 'rect',
    build: function (m, v) {
      var sn = v.season === 'winter';
      leg(m, 0.16, 0.1, 0, 8, C.wood[0]); leg(m, 0.84, 0.1, 0, 8, C.wood[0]);
      leg(m, 0.16, 0.36, 0, 8, C.wood[0]); leg(m, 0.84, 0.36, 0, 8, C.wood[0]);
      m.box(0.08, 0.04, 8, 0.84, 0.42, 1.8, C.wood[1], { top: sn ? C.snow : C.wood[2] });
      m.box(0.06, 0.04, 9.8, 0.1, 0.42, 2.4, C.wood[0]); m.box(0.84, 0.04, 9.8, 0.1, 0.42, 2.4, C.wood[0]);
      m.cyl(0.5, 0.25, 9.8, 0.07, 2.4, C.silk, { topCol: '#f0e4c8' });
      m.box(0.14, 0.52, 0, 0.72, 0.44, 4, C.hanRed, { top: sn ? C.snow : A.tone(C.hanRed, 1.16), topDeco: function (ctx, mm) {
        var q = mm.pt(0.5, 0.74, 4);
        A.circle(ctx, q[0], q[1], 2.2, C.gold, 0.7);
        if (sn) return;
        [[0.17, 0.55], [0.83, 0.55], [0.17, 0.93], [0.83, 0.93]].forEach(function (p) { var t = mm.pt(p[0], p[1], 4); A.circle(ctx, t[0], t[1], 1.3, C.gold, 0.5); });
        A.line(ctx, mm.pt(0.22, 0.6, 4), mm.pt(0.78, 0.6, 4), C.gold, 0.5); A.line(ctx, mm.pt(0.22, 0.88, 4), mm.pt(0.78, 0.88, 4), C.gold, 0.5);
      }, deco: { F: function (ctx, f) { A.band(ctx, f, 1.4, 2.1, C.gold); } } });
    }
  });

  // 涼亭桌椅組 table_set:圓木桌居中,四面各一矮墩凳(2×2,對稱)
  A.def('table_set', {
    w: 2, d: 2, sym: true, hmax: 26, shadow: 'ellipse',
    build: function (m, v) {
      var sn = v.season === 'winter', topCol = sn ? C.snow : C.wood[2];
      [[0.3, 1], [1.7, 1], [1, 0.3], [1, 1.7]].forEach(function (p) {
        m.cyl(p[0], p[1], 0, 0.17, 6, C.wood[1], { topCol: sn ? C.snow : A.tone(C.wood[2], 1.1), hoops: [3] });
      });
      m.cyl(1, 1, 0, 0.13, 14, C.wood[1], { topCol: C.wood[1] });
      m.cyl(1, 1, 14, 0.46, 2.6, C.wood[2], { topCol: topCol });
      m.cyl(1.12, 0.9, 16.6, 0.08, 3.2, C.bronze, { topCol: C.lacquer });
    }
  });

  // 庭院矮凳組 stools_pair:三只大小不一的蕈形圓墩(粗柱 + 寬圓座面),高低錯落(非對稱,隨朝向轉)
  A.def('stools_pair', {
    w: 1, d: 1, hmax: 15, shadow: 'ellipse',
    build: function (m, v) {
      var sn = v.season === 'winter';
      [[0.28, 0.3, 0.26, 10, C.wood[2]], [0.74, 0.4, 0.22, 8, '#e8c070'], [0.46, 0.76, 0.19, 6.2, C.wood[2]]].forEach(function (s) {
        m.cyl(s[0], s[1], 0, s[2] * 0.52, s[3] - 3, C.wood[0], { topCol: C.wood[0] });
        m.cyl(s[0], s[1], s[3] - 3, s[2], 3, C.wood[1], { topCol: sn ? C.snow : s[4], hoops: [1.5] });
      });
    }
  });

  // OBJECTS:經營建築登記(分類未列入 BUILD_GROUPS 者歸「其他」)
  if (typeof OBJECTS !== 'undefined') Object.assign(OBJECTS, {
    stone_table:      { name: '石桌', icon: '🔘', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    stone_stool:      { name: '石凳', icon: '⚪', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 15 }, side: 'estate' },
    bench_wood:       { name: '長木凳', icon: '🪑', w: 2, h: 1, on: [T_GRASS, T_ROAD], swap: true, cost: { coin: 15 }, side: 'estate' },
    table_wood:       { name: '木桌', icon: '🟫', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 20 }, side: 'estate' },
    table_long:       { name: '長案', icon: '🍱', w: 2, h: 1, on: [T_GRASS, T_ROAD], swap: true, cost: { coin: 35 }, side: 'estate' },
    hu_chuang:        { name: '胡床', icon: '💺', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 25 }, side: 'estate' },
    chair_bamboo:     { name: '竹椅', icon: '🎋', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 18 }, side: 'estate' },
    tea_set:          { name: '茶席', icon: '🫖', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 40 }, side: 'estate' },
    screen_fold:      { name: '折屏', icon: '🖼️', w: 2, h: 1, on: [T_GRASS, T_ROAD], swap: true, cost: { coin: 60 }, side: 'estate' },
    low_table_cushion:{ name: '案几與坐墊', icon: '🧶', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 30 }, side: 'estate' },
    table_set:        { name: '涼亭桌椅組', icon: '⛱️', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: { coin: 60 }, side: 'estate' },
    stools_pair:      { name: '庭院矮凳組', icon: '🔹', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: { coin: 15 }, side: 'estate' }
  });
})(ART);

// ---- 市集 market 2×2:市樓旗亭(下層開敞攤面、上層平座欄杆、青灰瓦頂)+ 前側兩座布棚攤 + 木箱與秤 ----
// 市招為大字紅旗(旗上金字「市」與錢幣符號),簷下紅燈籠兩盞;布棚與貨品只用布匹、陶罐、糧袋。
(function (A) {
  var C = A.C, SNOW = '#f7fbff', CLOTH_RED = '#d23a2c', TILE = '#6f7f88', TILE_DK = '#4d5c64';

  // 櫃檯貨品(零件皆為 cyl;z 為櫃檯面高)
  function bolt(m, u, v, z, col) { m.cyl(u, v, z, 0.07, 2.4, col, { topCol: A.tone(col, 1.15), hoops: [1.2] }); }
  function jar(m, u, v, z) { m.cyl(u, v, z, 0.08, 3.4, '#8a5230', { topCol: '#5a3420', hoops: [1.2, 2.6] }); }
  function sack(m, u, v, z) { m.cyl(u, v, z, 0.1, 2.6, '#e3c98a', { topCol: '#f3e2b4', hoops: [1.6] }); }

  // 布棚攤:四柱攤架、矮櫃、貨品、布棚(短簷)與波浪布緣;u0,v0 為攤位左後角,寬 0.7、深 0.8
  function stall(m, v, o) {
    var u0 = o.u0, v0 = o.v0, sn = v.season === 'winter', awn = o.awn, z = 7;
    [[0.03, 0.03], [0.61, 0.03], [0.03, 0.71], [0.61, 0.71]].forEach(function (p) { m.box(u0 + p[0], v0 + p[1], 0, 0.06, 0.06, 22, C.wood[0]); });
    m.box(u0 + 0.04, v0 + 0.36, 0, 0.62, 0.36, z, C.wood[1], { top: sn ? SNOW : C.wood[2] });
    o.goods(m, u0, v0, z);
    m.hip(u0 - 0.04, v0 - 0.04, 22, 0.78, 0.88, 6, awn, { over: 0.06, curl: 1, sag: 0.4, axis: 'u', hipK: 0.3, tiles: false, hooks: false, ridgeCol: A.tone(awn, 0.7), snow: sn });
    m.custom(u0 - 0.04, v0 + 0.9, 0.78, 0.02, 17, function (ctx, mm) {
      if (!A.visible(mm, 'F')) return;
      var n = 6, w = 0.78 / n, i, a, b;
      for (i = 0; i < n; i++) {
        a = u0 - 0.04 + i * w; b = a + w;
        A.poly(ctx, [mm.pt(a, v0 + 0.9, 23), mm.pt(b, v0 + 0.9, 23), mm.pt(b, v0 + 0.9, 19.5), mm.pt((a + b) / 2, v0 + 0.9, 17), mm.pt(a, v0 + 0.9, 19.5)],
          i % 2 ? '#fbf1dc' : awn, 0.45);
      }
      var p = mm.pt(u0 + 0.39, v0 + 0.9, 20.5);
      A.poly(ctx, [[p[0] - 4.5, p[1] - 3.2], [p[0] + 4.5, p[1] - 3.2], [p[0] + 4.5, p[1] + 3.2], [p[0] - 4.5, p[1] + 3.2]], C.lacquer, 0.5);
      A.glyph(ctx, o.sign, p[0], p[1], 5.5, C.gold);
    }, 3);
  }

  A.def('market', {
    w: 2, d: 2, hmax: 60,
    build: function (m, v) {
      var sn = v.season === 'winter';
      // 台基
      m.box(0.2, 0.04, 0, 1.6, 1.0, 3, C.stone[1], { top: sn ? SNOW : C.stone[2] });
      // 下層:後牆(內側深色、貨架)、左右實牆(右牆開格窗),前面敞開
      m.box(0.3, 0.06, 3, 1.4, 0.16, 14, C.wood[0], { deco: { F: function (ctx, f) {
        A.poly(ctx, A.quad(f, 0, 1, 0, 14), '#5a3a2c', 0.3);
        A.band(ctx, f, 6, 7.5, C.wood[2]); A.band(ctx, f, 11, 12.5, C.wood[2]);
        if (A.state.lit) A.lit(ctx, function () { A.poly(ctx, A.quad(f, 0.3, 0.7, 2, 11), C.lamp, 0); });
      } } });
      m.box(0.3, 0.06, 3, 0.12, 0.96, 14, C.silk, { deco: { F: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.12, C.wood[0]); } } });
      m.box(1.58, 0.06, 3, 0.12, 0.96, 14, C.silk, { deco: {
        F: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.12, C.wood[0]); },
        R: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.12, C.wood[0]); A.lattice(ctx, f, 0.5, 0.3, 4, 7, C.wood[1]); }
      } });
      // 櫃檯與貨品(布匹、陶罐、糧袋)
      m.box(0.46, 0.5, 3, 1.08, 0.34, 6, C.wood[1], { top: sn ? SNOW : C.wood[2], deco: { F: function (ctx, f) { A.band(ctx, f, 0, 1.6, C.wood[0]); } } });
      jar(m, 0.6, 0.66, 9); jar(m, 0.8, 0.66, 9);
      bolt(m, 1.0, 0.66, 9, '#e8d27a'); bolt(m, 1.16, 0.66, 9, CLOTH_RED);
      sack(m, 1.36, 0.66, 9);
      // 上層:silk 牆、格窗、木構平座與欄杆(前側)
      m.box(0.3, 0.2, 17, 1.4, 1.4, 13, C.silk, { deco: {
        F: function (ctx, f) {
          A.band(ctx, f, 0, 2, C.wood[0]); A.posts(ctx, f, [0, 1], 0.1, C.wood[0]);
          A.lattice(ctx, f, 0.143, 0.22, 4, 7, C.wood[1]); A.lattice(ctx, f, 0.857, 0.22, 4, 7, C.wood[1]);
        },
        R: function (ctx, f) { A.band(ctx, f, 0, 2, C.wood[0]); A.posts(ctx, f, [0, 1], 0.1, C.wood[0]); A.lattice(ctx, f, 0.5, 0.3, 4, 7, C.wood[1]); }
      } });
      m.box(0.2, 1.6, 17, 1.6, 0.36, 1.6, C.wood[2], { top: sn ? SNOW : C.wood[2] });
      [0.22, 0.5, 1.5, 1.78].forEach(function (u) { m.box(u - 0.02, 1.92, 18.6, 0.04, 0.04, 4.4, C.wood[0]); });
      m.box(0.2, 1.92, 22.8, 1.6, 0.05, 0.6, C.wood[0]);
      // 屋頂:青灰瓦廡殿,簷角鴟吻(金)
      m.hip(0.2, 0.0, 30, 1.6, 1.82, 15, TILE, { over: 0.22, curl: 3, sag: 1.5, axis: 'u', hipK: 0.5, ridgeCol: TILE_DK, ridgeHi: C.gold, snow: sn, hookSize: 3 });
      [0.04, 1.96].forEach(function (u) { m.cone(u, 1.95, 32, 0.08, 6, C.gold); });
      // 簷下紅燈籠兩盞(平座下方)
      [0.42, 1.58].forEach(function (u) {
        m.custom(u - 0.06, 1.92, 0.12, 0.08, 14, function (ctx, mm) { var p = mm.pt(u, 1.96, 16); A.lantern(ctx, p[0], p[1], 1.1); }, 4);
      });
      // 大字市招旗:紅底金邊,上書「市」,下綴錢幣符號;掛於正面中央
      m.custom(0.67, 1.97, 0.66, 0.02, 12, function (ctx, mm) {
        if (!A.visible(mm, 'F')) return;
        A.poly(ctx, [mm.pt(0.67, 1.98, 12), mm.pt(1.33, 1.98, 12), mm.pt(1.33, 1.98, 29), mm.pt(1.0, 1.98, 26.5), mm.pt(0.67, 1.98, 29)], CLOTH_RED, 0.8);
        A.path(ctx, [mm.pt(0.71, 1.98, 13), mm.pt(1.29, 1.98, 13), mm.pt(1.29, 1.98, 25), mm.pt(0.71, 1.98, 25)]);
        ctx.strokeStyle = C.gold; ctx.lineWidth = 0.8; ctx.stroke();
        var c = mm.pt(1.0, 1.98, 20.5);
        A.glyph(ctx, '市', c[0], c[1], 13, C.gold);
        var k = mm.pt(1.0, 1.98, 15.2);
        A.circle(ctx, k[0], k[1], 2.6, C.gold, 0.5); A.circle(ctx, k[0], k[1], 1, CLOTH_RED, 0);
        A.poly(ctx, [mm.pt(0.64, 1.98, 29), mm.pt(1.36, 1.98, 29), mm.pt(1.36, 1.98, 30.6), mm.pt(0.64, 1.98, 30.6)], C.lacquer, 0.6);
      }, 6);
      // 木箱與秤(地面)
      m.box(0.02, 0.1, 0, 0.18, 0.2, 5, C.wood[1], { top: sn ? SNOW : C.wood[2] });
      m.box(0.02, 0.4, 0, 0.18, 0.2, 4, C.wood[1], { top: sn ? SNOW : C.wood[2] });
      m.box(1.82, 0.08, 0, 0.16, 0.2, 5, C.wood[1], { top: sn ? SNOW : C.wood[2] });
      m.box(1.82, 0.36, 0, 0.16, 0.2, 4, C.wood[1], { top: sn ? SNOW : C.wood[2] });
      m.box(0.8, 1.3, 0, 0.36, 0.2, 5, C.wood[1], { top: sn ? SNOW : C.wood[2] });
      m.box(0.97, 1.36, 5, 0.06, 0.06, 11, C.wood[0]);
      m.box(0.82, 1.36, 15, 0.34, 0.05, 0.8, C.wood[1]);
      m.cyl(0.84, 1.38, 9, 0.07, 0.5, C.bronze, { topCol: C.silk });
      m.cyl(1.12, 1.38, 9, 0.07, 0.5, C.bronze, { topCol: C.silk });
      // 左右兩座布棚攤:左布匹與糧袋(藍布棚),右陶罐與糧袋(紫布棚)
      stall(m, v, { u0: 0.0, v0: 1.1, awn: '#3e6fb0', sign: '布', goods: function (mm, u0, v0, z) {
        bolt(mm, u0 + 0.14, v0 + 0.5, z, '#e8d27a'); bolt(mm, u0 + 0.28, v0 + 0.5, z, CLOTH_RED);
        bolt(mm, u0 + 0.4, v0 + 0.5, z, '#4ab7ec'); sack(mm, u0 + 0.54, v0 + 0.58, z);
      } });
      stall(m, v, { u0: 1.3, v0: 1.1, awn: '#8a4b7c', sign: '陶', goods: function (mm, u0, v0, z) {
        jar(mm, u0 + 0.14, v0 + 0.5, z); jar(mm, u0 + 0.3, v0 + 0.5, z); sack(mm, u0 + 0.52, v0 + 0.58, z);
      } });
    },
    // 夜間發光點 [u, v, z, 半徑, 色, 強度, 所在面]
    lights: function () {
      return [[0.42, 1.96, 16, 24, C.lantern, 0.9, 'F'], [1.58, 1.96, 16, 24, C.lantern, 0.9, 'F'],
        [0.5, 1.98, 23, 20, C.lamp, 0.6, 'F'], [1.5, 1.98, 23, 20, C.lamp, 0.6, 'F'],
        [1.0, 0.25, 12, 26, C.lamp, 0.8, 'F'],
        [0.35, 1.94, 13, 16, C.lamp, 0.6, 'F'], [1.65, 1.94, 13, 16, C.lamp, 0.6, 'F']];
    }
  });
})(ART);
