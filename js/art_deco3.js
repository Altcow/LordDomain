// art_deco3.js — 裝飾三:軍事營地、車馬、礦伐、水岸(PLAN_ART_STYLE §3.4)
// 依賴 art.js、art_objects.js、art_units.js 先載入;建築選單登錄需要 data.js 的 OBJECTS 與 T_ 常數(有才登錄)。
// 與既有 ART.OBJ / OBJECTS 撞名的項目加 deco_ 前綴(見 deco_ 別名區段)。

(function (A) {
  var C = A.C;
  var FLAGC = { han: C.hanRed, yellow: '#ffd23a', blue: '#3f6fb0', black: C.lacquer, white: '#f6efe0', green: '#3fa385' };
  var KEYS = A.DECO3 = [];
  var ITEMS = {};

  function def(key, spec) { A.def(key, spec); KEYS.push(key); }
  function alias(key, src) { if (A.OBJ[src]) { A.def(key, A.OBJ[src]); KEYS.push(key); } }
  function flagCol(v) { return FLAGC[(v && v.skin) || 'han'] || C.hanRed; }
  function post(m, u, v, z, h, s) { m.box(u, v, z, s || 0.1, s || 0.1, h, C.wood[1], { top: C.wood[2] }); }
  function pad(m, w, d, col) { m.box(0, 0, 0, w, d, 0, col || '#e6c08a', { top: A.tone(col || '#e6c08a', 1.05), bias: -1 }); }
  // 車輪:側面圓盤(plane 'v'),u 為車軸位置、r 為半徑(px)、z 為輪心高
  function wheel(m, u, v, r, z, col) {
    var c = col || C.wood[1];
    m.custom(u - 0.02, v - r / 34, 0.04, r * 2 / 34, z - r, function (ctx, mm) {
      A.disc(ctx, mm, u, v, z, r, 'v', c);
      A.disc(ctx, mm, u, v, z, r * 0.66, 'v', A.tone(c, 0.8), 0.4);
      var h = mm.pt(u, v, z); A.circle(ctx, h[0], h[1], 1.6, C.gold, 0.6);
    }, 1);
  }
  // 牽引組:兩匹(或多匹)動物位於局部 v 2..3,朝向與 oxcart 相同
  function team(m, list) {
    m.custom(0.05, 2.05, 0.9, 0.95, 0, function (ctx, mm) {
      list.forEach(function (p) {
        var c = mm.pt(p[0], 2.5, 0), f = mm.f;
        ctx.save(); ctx.translate(c[0], c[1] + 2); if (f === 2 || f === 3) ctx.scale(-1, 1);
        A.animalRaw(ctx, A.ANIMAL[p[1]], f === 1 || f === 2, 0); ctx.restore();
      });
    });
  }
  // 以局部座標 [u,v,z] 畫一根有描邊的線
  function line3(ctx, mm, a, b, col, w) {
    var p = mm.pt(a[0], a[1], a[2]), q = mm.pt(b[0], b[1], b[2]);
    A.line(ctx, p, q, C.ink, w + 1.4); A.line(ctx, p, q, col, w);
  }

  // ---------------- 營地與軍事 ----------------

  // 練兵場 4x4:夯土場 + 木樁 + 兵器架 + 木樁人 + 靶 + 台上火盆
  def('drill_ground', {
    w: 4, d: 4, hmax: 36,
    build: function (m, v) {
      pad(m, 4, 4, '#e6c08a');
      post(m, 0.4, 0.4, 0, 22, 0.14); post(m, 0.4, 2.2, 0, 22, 0.14); post(m, 2.2, 0.4, 0, 22, 0.14);
      m.place('deco_target', 2.4, 2.4, 0, v);
      m.place('deco_weaponrack', 1.2, 3.0, 0, v);
      m.place('training_dummy', 3.0, 0.8, 0, v);
      m.place('brazier', 3.4, 3.4, 0, v);
    },
    lights: function () { return [[3.5, 3.5, 22, 36, C.fire, 0.8]]; },
    anim: function (ctx, m, t) { var p = m.pt(3.5, 3.5, 24); A.fire(ctx, p[0], p[1], t, 0.9); }
  });

  // 校場 4x4:大型空場 + 點將台 + 兩面旗 + 火盆
  def('parade_ground', {
    w: 4, d: 4, hmax: 58,
    build: function (m, v) {
      pad(m, 4, 4, '#f0d29e');
      m.box(1.1, 1.1, 0, 1.8, 1.8, 10, C.stone[1], { top: C.stone[2] });
      m.box(1.7, 0.5, 0, 0.6, 0.6, 5, C.stone[1], { top: C.stone[2] });
      m.place('brazier', 3.3, 1.2, 0, v);
      m.place('brazier', 0.5, 3.3, 0, v);
    },
    lights: function () { return [[3.3, 1.2, 22, 36, C.fire, 0.8], [0.5, 3.3, 22, 36, C.fire, 0.8]]; },
    anim: function (ctx, m, t) {
      var p = m.pt(0.3, 0.3, 0), q = m.pt(3.7, 3.7, 0);
      A.flag(ctx, p[0], p[1], 46, 22, 16, C.hanRed, t, 0.1);
      A.flag(ctx, q[0], q[1], 46, 22, 16, FLAGC.yellow, t, 0.8);
    }
  });

  // 軍營 4x4:兩座營帳 + 兩座兵器架 + 篝火 + 兩處拒馬 + 牙旗
  def('army_camp', {
    w: 4, d: 4, hmax: 100,
    build: function (m, v) {
      pad(m, 4, 4, '#f0d29e');
      m.place('tent', 0, 0, 0, v);
      m.place('tent', 2, 0, 0, v);
      m.place('deco_weaponrack', 0.2, 2.0, 0, v);
      m.place('deco_weaponrack', 2.8, 2.0, 0, v);
      m.place('deco_campfire', 1.5, 2.0, 0, v);
      m.place('deco_jumaa', 0.5, 3.0, 0, v);
      m.place('deco_jumaa', 2.5, 3.0, 0, v);
      m.place('flag_army', 1.5, 3.0, 0, v);
    },
    lights: function () {
      return [[1.0, 1.85, 8, 26, C.lamp, 0.7], [3.0, 1.85, 8, 26, C.lamp, 0.7], [2.0, 2.5, 6, 44, C.fire, 1]];
    },
    anim: function (ctx, m, t) {
      var p = m.pt(2.0, 2.5, 2); A.fire(ctx, p[0], p[1], t, 1.1);
      var q = m.pt(2.0, 3.5, 8); A.flag(ctx, q[0], q[1], 84, 24, 40, C.hanRed, t, 0.4);
      [[1.0, 1.85], [3.0, 1.85]].forEach(function (s) { var r = m.pt(s[0], s[1], 34); A.flag(ctx, r[0], r[1], 14, 10, 6, C.hanRed, t, s[0]); });
    }
  });

  // 鹿角:放射狀削尖枝椏
  def('deco_lujiao', {
    w: 1, d: 1, sym: true, hmax: 22, shadow: 'ellipse',
    build: function (m) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        for (var i = 0; i < 7; i++) {
          var a = i / 7 * Math.PI * 2 + 0.3, cx = Math.cos(a), cy = Math.sin(a);
          var p = mm.pt(0.5 + cx * 0.08, 0.5 + cy * 0.08, 1), q = mm.pt(0.5 + cx * 0.36, 0.5 + cy * 0.36, 14 + (i % 3) * 3);
          A.line(ctx, p, q, C.ink, 3); A.line(ctx, p, q, C.wood[1], 1.8);
        }
      });
    }
  });

  // 鼓台 2x2:木台 + 欄杆 + 建鼓
  def('drum_tower', {
    w: 2, d: 2, hmax: 80,
    build: function (m) {
      m.box(0.1, 0.1, 0, 1.8, 1.8, 8, C.wood[1], { top: C.wood[2] });
      [[0.1, 0.1], [1.75, 0.1], [0.1, 1.75], [1.75, 1.75]].forEach(function (p) { post(m, p[0], p[1], 8, 22, 0.13); });
      m.custom(0.1, 0.1, 1.8, 1.8, 24, function (ctx, mm) {
        [[0.1, 0.1, 1.9, 0.1], [0.1, 1.9, 1.9, 1.9], [0.1, 0.1, 0.1, 1.9], [1.9, 0.1, 1.9, 1.9]].forEach(function (s) {
          var a = mm.pt(s[0], s[1], 20), b = mm.pt(s[2], s[3], 20); A.line(ctx, a, b, C.ink, 3); A.line(ctx, a, b, C.lacquer, 1.6);
        });
      }, 1);
      m.cyl(1.0, 1.0, 8, 0.36, 12, C.hanRed, { topCol: '#f2dfb2' });
      m.custom(0.9, 0.9, 0.2, 0.2, 20, function (ctx, mm) {
        var a = mm.pt(1.0, 1.0, 20), b = mm.pt(1.0, 1.0, 46); A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, a, b, C.gold, 1.8);
      }, 2);
    }
  });

  // 烽燧 2x2:夯土台 + 柴堆;運作時(state 'work')火與黑煙
  def('beacon', {
    w: 2, d: 2, sym: true, hmax: 96,
    build: function (m) {
      var band = function (ctx, f) { A.band(ctx, f, 10, 13, C.earthDk); A.band(ctx, f, 26, 29, C.earthDk); };
      var deco = { F: band, L: band, R: band, B: band };
      m.box(0.05, 0.05, 0, 1.9, 1.9, 42, C.earth, { top: '#f2d6a2', deco: deco });
      m.box(0.3, 0.3, 42, 1.4, 1.4, 30, C.earth, { top: '#f2d6a2', deco: deco });
      m.box(0.2, 0.2, 72, 1.6, 1.6, 4, C.wood[1], { top: C.wood[2] });
      m.box(0.5, 0.5, 76, 0.8, 0.8, 8, C.wood[2], { top: C.wood[1] });
    },
    lights: function (v) { return v.state === 'work' ? [[1.0, 1.0, 90, 40, C.fire, 0.9]] : []; },
    anim: function (ctx, m, t, v) {
      if (v.state !== 'work') return;
      var p = m.pt(1.0, 1.0, 84);
      A.fire(ctx, p[0], p[1], t, 1.0); A.smoke(ctx, p[0], p[1] - 4, t, 3.3);
    }
  });

  // 牙旗 1x1:漆黑竿 + 高竿旗;skin 選色(han/yellow/blue/black/white/green)
  def('flag_army', {
    w: 1, d: 1, sym: true, hmax: 96, shadow: 'ellipse',
    build: function (m) {
      m.box(0.4, 0.4, 0, 0.2, 0.2, 6, C.stone[1], { top: C.stone[2] });
      m.box(0.46, 0.46, 6, 0.08, 0.08, 88, C.lacquer, { top: C.gold });
    },
    anim: function (ctx, m, t, v) { var p = m.pt(0.5, 0.5, 6); A.flag(ctx, p[0], p[1], 84, 24, 40, flagCol(v), t, 0.4); }
  });

  // 大旗 1x1:各色大旗(skin 選色)
  def('flag_great', {
    w: 1, d: 1, sym: true, hmax: 60, shadow: 'ellipse',
    build: function (m) { m.box(0.42, 0.42, 0, 0.16, 0.16, 6, C.wood[1], { top: C.wood[2] }); },
    anim: function (ctx, m, t, v) { var p = m.pt(0.5, 0.5, 6); A.flag(ctx, p[0], p[1], 66, 36, 28, flagCol(v), t, 0.9); }
  });

  // 營帳群 4x4:三座營帳(沿用 tent)
  def('tent_group', {
    w: 4, d: 4, hmax: 70,
    build: function (m, v) {
      pad(m, 4, 4, '#f0d29e');
      m.place('tent', 0, 0, 0, v);
      m.place('tent', 2, 0, 0, v);
      m.place('tent', 1, 2, 0, v);
    },
    lights: function () { return [[1.0, 1.85, 8, 26, C.lamp, 0.7], [3.0, 1.85, 8, 26, C.lamp, 0.7], [2.0, 3.85, 8, 26, C.lamp, 0.7]]; },
    anim: function (ctx, m, t) {
      [[1, 1.85], [3, 1.85], [2, 3.85]].forEach(function (s) { var q = m.pt(s[0], s[1], 34); A.flag(ctx, q[0], q[1], 14, 10, 6, C.hanRed, t, s[0]); });
    }
  });

  // 帥帳 4x4:大型懸山布帳 + 前門燈 + 兩旗
  def('tent_general', {
    w: 4, d: 4, hmax: 100,
    build: function (m, v) {
      pad(m, 4, 4, '#f0d29e');
      var cloth = v.skin === 'enemy' ? '#e8d27a' : '#f4ead2';
      m.gable(0.3, 0.3, 0, 3.4, 3.4, 46, cloth, { axis: 'u', over: 0.2, overEnd: 0.2, curl: 3, sag: 1.5, tiles: false, hooks: false, ridgeCol: C.hanRed, ridgeW: 4, eaveCol: '#c9b88e', endCol: A.tone(cloth, 0.95), snow: v.season === 'winter' });
      m.custom(1.5, 3.3, 1, 0.05, 1, function (ctx, mm) {
        if (!A.visible(mm, 'F')) return;
        var p = [mm.pt(1.6, 3.7, 0), mm.pt(2.4, 3.7, 0), mm.pt(2.0, 3.7, 20)];
        if (A.state.lit) A.lit(ctx, function () { A.poly(ctx, p, C.lamp, 0.7); }); else A.poly(ctx, p, '#3a2a26', 0.7);
      }, 1);
    },
    lights: function () { return [[2.0, 3.8, 8, 30, C.lamp, 0.8, 'F']]; },
    anim: function (ctx, m, t) {
      var a = m.pt(0.3, 3.9, 0), b = m.pt(3.7, 3.9, 0);
      A.flag(ctx, a[0], a[1], 78, 28, 18, C.hanRed, t, 0.2);
      A.flag(ctx, b[0], b[1], 78, 28, 18, FLAGC.yellow, t, 0.6);
    }
  });

  // 兵器架:沿用 weaponrack(別名)
  // 木樁人 1x1:立柱 + 橫臂 + 草人
  def('training_dummy', {
    w: 1, d: 1, sym: true, hmax: 38, shadow: 'ellipse',
    build: function (m) {
      m.box(0.46, 0.46, 0, 0.08, 0.08, 32, C.wood[0], { top: C.wood[1] });
      m.box(0.2, 0.46, 22, 0.6, 0.08, 4, C.wood[1], { top: C.wood[2] });
      m.cyl(0.5, 0.5, 12, 0.13, 12, C.thatch, { topCol: C.thatchDk });
      m.cyl(0.5, 0.5, 24, 0.09, 6, C.thatch, { topCol: C.thatchDk });
    }
  });

  // 車馬與攻城器械擺設(靜態)
  // 戰車 1x3:漆車 + 朱欄 + 雙馬 + 車旗
  def('war_chariot', {
    w: 1, d: 3, hmax: 60,
    build: function (m) {
      wheel(m, 0.04, 1.0, 14, 14); wheel(m, 0.96, 1.0, 14, 14);
      m.box(0.12, 0.7, 14, 0.76, 1.1, 6, C.lacquer, { top: C.wood[1], bias: 1 });
      m.box(0.1, 1.7, 14, 0.8, 0.12, 12, C.hanRed, { top: C.hanRed, bias: 1 });
      team(m, [[0.3, 'horse'], [0.7, 'horse']]);
    },
    anim: function (ctx, m, t) { var p = m.pt(0.5, 0.4, 20); A.flag(ctx, p[0], p[1], 46, 22, 16, C.hanRed, t, 0.5); }
  });

  // 雲梯 1x3:車架 + 斜梯
  def('cloud_ladder', {
    w: 1, d: 3, hmax: 80,
    build: function (m) {
      wheel(m, 0.04, 0.6, 12, 12); wheel(m, 0.96, 0.6, 12, 12);
      m.box(0.14, 0.2, 12, 0.72, 1.2, 4, C.wood[1], { top: C.wood[2] });
      m.custom(0.2, 0.2, 0.6, 2.6, 16, function (ctx, mm) {
        line3(ctx, mm, [0.3, 0.6, 16], [0.3, 2.7, 74], C.wood[2], 2.4);
        line3(ctx, mm, [0.7, 0.6, 16], [0.7, 2.7, 74], C.wood[2], 2.4);
        for (var i = 1; i < 8; i++) {
          var t = i / 8;
          line3(ctx, mm, [0.3, 0.6 + 2.1 * t, 16 + 58 * t], [0.7, 0.6 + 2.1 * t, 16 + 58 * t], C.wood[1], 1.2);
        }
      }, 2);
    }
  });

  // 衝車 1x2:車身 + 棚頂 + 撞木
  def('ram', {
    w: 1, d: 2, hmax: 60,
    build: function (m) {
      wheel(m, 0.04, 0.5, 12, 12); wheel(m, 0.96, 0.5, 12, 12);
      m.box(0.12, 0.1, 12, 0.76, 1.8, 4, C.wood[1], { top: C.wood[2] });
      m.hip(0.08, 0.06, 16, 0.84, 1.88, 22, C.wood[2], { over: 0.08, curl: 0, sag: 0, hipK: 1, axis: 'v', tileDensity: 5, ridgeCol: C.wood[0], eaveCol: C.wood[0], hooks: false, bias: 1 });
      m.custom(0.4, 1.0, 0.2, 0.95, 8, function (ctx, mm) {
        var a = mm.pt(0.5, 1.0, 10), b = mm.pt(0.5, 1.9, 10);
        A.line(ctx, a, b, C.ink, 9); A.line(ctx, a, b, C.wood[1], 6);
        A.circle(ctx, b[0], b[1], 3.2, C.bronze);
      }, 1);
    }
  });

  // 投石車 2x2:木架 + 長臂 + 配重 + 兜網
  def('trebuchet', {
    w: 2, d: 2, hmax: 86,
    build: function (m) {
      m.box(0.15, 0.15, 0, 1.7, 1.7, 5, C.wood[1], { top: C.wood[2] });
      [[0.3, 0.3], [1.55, 0.3], [0.3, 1.55], [1.55, 1.55]].forEach(function (p) { post(m, p[0], p[1], 5, 34, 0.14); });
      m.custom(0.1, 0.1, 1.8, 1.8, 38, function (ctx, mm) {
        var pv = mm.pt(1.0, 1.0, 46), cw = mm.pt(1.6, 1.6, 9), tip = mm.pt(0.25, 0.25, 80);
        A.line(ctx, cw, tip, C.ink, 5); A.line(ctx, cw, tip, C.wood[1], 3);
        A.circle(ctx, pv[0], pv[1], 2.4, C.lacquer);
        var cwb = mm.pt(1.5, 1.5, 4); A.circle(ctx, cwb[0], cwb[1] - 3, 4, C.stone[1]);
        A.circle(ctx, tip[0], tip[1], 3, C.silk, 0.5);
      }, 1);
    }
  });

  // 井闌 2x2:高架木塔 + 平台 + 欄杆 + 小頂
  def('jinglan', {
    w: 2, d: 2, hmax: 96,
    build: function (m) {
      m.box(0.0, 0.0, 0, 2.0, 2.0, 4, C.wood[0], { top: C.wood[1] });
      [[0.1, 0.1], [1.6, 0.1], [0.1, 1.6], [1.6, 1.6]].forEach(function (p) { post(m, p[0], p[1], 4, 72, 0.14); });
      m.box(0.0, 0.0, 60, 2.0, 2.0, 4, C.wood[2], { top: C.wood[2] });
      m.custom(0.1, 0.1, 1.8, 1.8, 62, function (ctx, mm) {
        [[0.1, 0.1, 1.9, 0.1], [0.1, 1.9, 1.9, 1.9], [0.1, 0.1, 0.1, 1.9], [1.9, 0.1, 1.9, 1.9]].forEach(function (s) {
          line3(ctx, mm, [s[0], s[1], 68], [s[2], s[3], 68], C.wood[2], 2.2);
        });
      }, 1);
      m.hip(0.0, 0.0, 74, 2.0, 2.0, 14, C.wood[1], { over: 0.2, curl: 3, sag: 0.8, hipK: 0.8, ridgeCol: C.lacquer, ridgeHi: C.gold, bias: 2 });
    }
  });

  // ---------------- 車馬 ----------------

  // 華麗馬車 1x3:漆車(fancy 篷)+ 雙白馬
  def('carriage', {
    w: 1, d: 3, hmax: 70,
    build: function (m, v) {
      A.OBJ.cart.build(m, { skin: 'fancy', season: v.season });
      team(m, [[0.3, 'whitehorse'], [0.7, 'whitehorse']]);
    },
    lights: function () { return [[0.5, 0.25, 18, 22, C.lamp, 0.7]]; }
  });

  // 板車(空)1x2:沿用 cart 的空車床
  def('cart_empty', {
    w: 1, d: 2, hmax: 40,
    build: function (m, v) { A.OBJ.cart.build(m, { skin: 'empty', season: v.season }); }
  });

  // 獨輪車 1x1
  def('wheelbarrow', {
    w: 1, d: 1, hmax: 30,
    build: function (m) {
      m.box(0.2, 0.3, 8, 0.6, 0.5, 8, C.wood[1], { top: C.wood[2] });
      wheel(m, 0.5, 0.82, 7, 7);
      m.custom(0.1, 0.0, 0.8, 0.3, 0, function (ctx, mm) {
        [0.25, 0.75].forEach(function (u) { line3(ctx, mm, [u, 0.8, 12], [u, 0.15, 2], C.wood[1], 1.8); });
      }, 1);
    }
  });

  // 牛車 1x3:沿用 oxcart(別名)
  // 礦車 1x1:木箱 + 礦石 + 雙輪(skin: iron / copper / stone)
  function oreColor(skin) { return skin === 'copper' ? '#8ab8a0' : (skin === 'stone' ? C.stone[1] : '#6b6e76'); }
  def('minecart', {
    w: 1, d: 1, hmax: 34,
    build: function (m, v) {
      m.box(0.12, 0.2, 6, 0.76, 0.6, 8, '#5b5f68', { top: '#6b6e76' });
      m.cone(0.5, 0.5, 14, 0.3, 8, oreColor(v.skin));
      wheel(m, 0.1, 0.5, 6, 6); wheel(m, 0.9, 0.5, 6, 6);
    }
  });

  // ---------------- 礦場與伐木 ----------------

  // 礦坑口 2x2:山壁 + 木框坑口 + 軌道 + 礦車 + 兩處火把
  def('mine_entrance', {
    w: 2, d: 2, hmax: 60,
    build: function (m, v) {
      m.box(0.0, 0.0, 0, 2.0, 0.95, 26, C.stone[1], {
        top: C.stone[2],
        deco: {
          F: function (ctx, f) {
            A.poly(ctx, A.quad(f, 0.3, 0.7, 0, 14), '#2b1d1b', 0.5);
            A.posts(ctx, f, [0.3, 0.7], 0.12, C.wood[1]);
            A.band(ctx, f, 14, 17, C.wood[1]);
          }
        }
      });
      m.custom(0.55, 0.95, 0.9, 1.05, 0, function (ctx, mm) {
        [0.6, 1.4].forEach(function (u) { line3(ctx, mm, [u, 0.98, 0.5], [u, 2.0, 0.5], C.stone[2], 1.4); });
      });
      m.place('minecart', 0.5, 1.0, 0, { skin: v.skin === 'copper' ? 'copper' : (v.skin === 'stone' ? 'stone' : 'iron') });
    },
    lights: function () { return [[0.3, 1.0, 16, 30, C.fire, 0.7], [1.7, 1.0, 16, 30, C.fire, 0.7]]; },
    anim: function (ctx, m, t) {
      [0.3, 1.7].forEach(function (u) { var p = m.pt(u, 1.0, 16); A.fire(ctx, p[0], p[1], t, 0.8); });
    }
  });

  // 礦石堆 1x1(鐵 / 銅 / 石三皮膚;堆量 = v.stock 1~3)
  function orePile(kind) {
    return function (m, v) {
      var n = Math.max(1, Math.min(3, v.stock || 2)), r = 0.2 + 0.07 * n, h = 8 + 4 * n;
      if (kind === 'stone') {
        for (var i = 0; i < n + 1; i++) m.box(0.15 + 0.3 * (i % 2), 0.2 + 0.25 * Math.floor(i / 2), 0, 0.3, 0.3, 6 + i * 2, C.stone[1], { top: C.stone[2] });
        return;
      }
      var base = kind === 'copper' ? '#8ab8a0' : '#6b6e76', spot = kind === 'copper' ? '#e8b060' : '#c0623a';
      m.cone(0.5, 0.5, 0, r, h, base);
      m.custom(0.3, 0.3, 0.4, 0.4, h * 0.4, function (ctx, mm) {
        for (var i = 0; i < n + 1; i++) {
          var a = i * 2.1, p = mm.pt(0.5 + Math.cos(a) * 0.12, 0.5 + Math.sin(a) * 0.12, h * 0.45);
          A.ellipse(ctx, p[0], p[1], 2.4, 1.6, spot, 0.5);
        }
      }, 1);
    };
  }
  def('ore_iron', { w: 1, d: 1, sym: true, hmax: 30, shadow: 'ellipse', build: orePile('iron') });
  def('ore_copper', { w: 1, d: 1, sym: true, hmax: 30, shadow: 'ellipse', build: orePile('copper') });
  def('ore_stone', { w: 1, d: 1, sym: true, hmax: 30, shadow: 'ellipse', build: orePile('stone') });

  // 鋸台 1x1:木架 + 木料 + 往返鋸片(動畫)
  def('sawbench', {
    w: 1, d: 1, hmax: 40,
    build: function (m) {
      m.box(0.12, 0.2, 8, 0.76, 0.6, 6, C.wood[1], { top: C.wood[2] });
      post(m, 0.12, 0.2, 0, 8, 0.1); post(m, 0.8, 0.2, 0, 8, 0.1);
      post(m, 0.12, 0.7, 0, 8, 0.1); post(m, 0.8, 0.7, 0, 8, 0.1);
      m.box(0.1, 0.1, 14, 0.8, 0.8, 5, C.wood[2], { top: C.wood[1] });
    },
    anim: function (ctx, m, t) {
      A.disc(ctx, m, 0.5 + 0.2 * Math.sin(t * 4), 0.5, 18, 9, 'v', '#c8ced4', 0.6);
    }
  });

  // 流送木排 1x2(水上):圓木並排
  def('lograft', {
    w: 1, d: 2, hmax: 16, shadow: 'none',
    build: function (m) {
      [0.14, 0.38, 0.62, 0.86].forEach(function (u) { m.box(u - 0.09, 0.05, 0, 0.18, 1.9, 6, C.wood[1], { top: C.wood[2] }); });
    }
  });

  // ---------------- 驛站、關津、水岸 ----------------

  // 驛站 3x2:驛舍(沿用 house)+ 驛馬 + 里程堠
  def('post_station', {
    w: 3, d: 2, hmax: 84,
    build: function (m, v) {
      m.place('house', 0, 0, 0, { level: 2, season: v.season, skin: 'earth' });
      m.cyl(2.7, 0.5, 0, 0.14, 26, C.stone[1], { topCol: C.stone[2] });
      m.place('horse', 2.0, 1.0, 0, {});
    },
    lights: function () { return [[0.4, 1.72, 16, 22, C.lantern, 0.9, 'F'], [1.34, 1.66, 9, 22, C.lamp, 0.75, 'F']]; }
  });

  // 關津稅卡 3x1:土牆門洞 + 瓦頂 + 木欄杆 + 燈籠
  def('toll_gate', {
    w: 3, d: 1, hmax: 60,
    build: function (m, v) {
      var band = function (ctx, f) { A.band(ctx, f, 0, 3, C.earthDk); };
      m.box(0.0, 0.1, 0, 3.0, 0.8, 22, C.earth, {
        top: '#f2d6a2',
        deco: {
          F: function (ctx, f) { band(ctx, f); A.door(ctx, f, 0.5, 0.5, 14, C.hanRed); },
          B: band,
          L: function (ctx, f) { band(ctx, f); A.posts(ctx, f, [0, 1], 0.09, C.hanRed); },
          R: function (ctx, f) { band(ctx, f); A.posts(ctx, f, [0, 1], 0.09, C.hanRed); }
        }
      });
      m.gable(0.0, 0.1, 22, 3.0, 0.8, 14, C.tile, { axis: 'u', over: 0.3, overEnd: 0.1, curl: 3, sag: 1, tileDensity: 7, ridgeCol: C.tileDk, hookSize: 3, snow: v.season === 'winter' });
      m.box(0.05, 1.0, 0, 0.12, 0.12, 14, C.wood[1]);
      m.custom(0.1, 1.0, 1.5, 0.1, 12, function (ctx, mm) {
        line3(ctx, mm, [0.11, 1.05, 13], [1.7, 1.05, 13], C.hanRed, 1.8);
      }, 1);
    },
    lights: function () { return [[0.3, 0.2, 16, 22, C.lantern, 0.8, 'F'], [2.7, 0.2, 16, 22, C.lantern, 0.8, 'F']]; }
  });

  // 碼頭棧橋 1x1(水上)
  def('dock', {
    w: 1, d: 1, hmax: 18, shadow: 'none',
    build: function (m) {
      [[0.08, 0.08], [0.84, 0.08], [0.08, 0.84], [0.84, 0.84]].forEach(function (p) { m.cyl(p[0] + 0.04, p[1] + 0.04, 0, 0.05, 12, C.wood[0], { topCol: C.wood[1] }); });
      m.box(0.0, 0.0, 6, 1, 1, 3, C.wood[1], { top: C.wood[2] });
    }
  });

  // 渡船(篷船)1x2(水上):船身 + 竹篷 + 篷內燈
  def('boat_small', {
    w: 1, d: 2, hmax: 40, shadow: 'none',
    build: function (m) {
      m.box(0.1, 0.05, 2, 0.8, 1.9, 5, C.wood[1], { top: C.wood[2] });
      m.hip(0.14, 0.2, 7, 0.72, 1.6, 14, C.thatch, { over: 0.1, curl: 2, sag: 0.5, tileDensity: 6, ridgeCol: C.thatchDk, eaveCol: C.thatchDk, hooks: false, axis: 'v', hipK: 1, bias: 1 });
      m.custom(0.9, 0.2, 0.1, 1.6, 6, function (ctx, mm) { line3(ctx, mm, [0.92, 0.3, 8], [1.0, 0.1, 4], C.wood[2], 2.4); }, 1);
    },
    lights: function () { return [[0.5, 1.0, 14, 18, C.lamp, 0.55]]; }
  });

  // 戰船(樓船)2x3(水上):船身 + 樓 + 桅與帆(動畫)
  def('warship', {
    w: 2, d: 3, hmax: 100, shadow: 'none',
    build: function (m) {
      var stripe = function (ctx, f) { A.band(ctx, f, 4, 6, C.hanRed); };
      m.box(0.1, 0.1, 0, 1.8, 2.8, 8, C.wood[0], { top: C.wood[1], deco: { F: stripe, R: stripe, L: stripe, B: stripe } });
      m.box(0.5, 0.6, 8, 1.0, 1.4, 16, C.wood[1], { top: C.wood[2], deco: { F: function (ctx, f) { A.lattice(ctx, f, 0.5, 0.4, 4, 8, C.wood[0]); } } });
      m.hip(0.45, 0.55, 24, 1.1, 1.5, 9, C.tile, { over: 0.15, curl: 3, sag: 1, ridgeCol: C.lacquer, ridgeHi: C.gold, bias: 2 });
      m.custom(1.0, 1.2, 0.1, 0.1, 8, function (ctx, mm) { line3(ctx, mm, [1.0, 1.2, 8], [1.0, 1.2, 74], C.wood[1], 2.4); }, 2);
    },
    lights: function () { return [[1.0, 1.2, 28, 26, C.lamp, 0.8]]; },
    anim: function (ctx, m, t) { var p = m.pt(1.0, 1.2, 74); A.flag(ctx, p[0], p[1], 6, 26, 30, C.hanRed, t, 0.7); }
  });

  // 渡口 2x1:木棧 + 小亭 + 燈
  def('ferry', {
    w: 2, d: 1, hmax: 56,
    build: function (m, v) {
      m.box(0.0, 0.1, 0, 2.0, 0.8, 4, C.wood[1], { top: C.wood[2] });
      [[0.1, 0.2], [1.8, 0.2], [0.1, 0.7], [1.8, 0.7]].forEach(function (p) { post(m, p[0], p[1], 4, 26); });
      m.gable(0.0, 0.1, 26, 2.0, 0.8, 12, C.tile, { axis: 'u', over: 0.25, curl: 2, sag: 0.8, tileDensity: 7, ridgeCol: C.tileDk, hooks: true, snow: v.season === 'winter' });
    },
    lights: function () { return [[1.0, 0.5, 22, 24, C.lamp, 0.8]]; }
  });

  // 鐵匠營 3x2:棚 + 鍛爐 + 鐵砧 + 兵器架(動畫:爐火、煙)
  def('smithy', {
    w: 3, d: 2, hmax: 74,
    build: function (m, v) {
      [[0.1, 0.1], [2.85, 0.1], [0.1, 1.8], [2.85, 1.8]].forEach(function (p) { post(m, p[0], p[1], 0, 24, 0.1); });
      m.gable(0.0, 0.0, 24, 3.0, 2.0, 12, C.tile, { axis: 'u', over: 0.15, curl: 2, sag: 0.5, tileDensity: 8, ridgeCol: C.tileDk, hooks: true, snow: v.season === 'winter', end: false });
      m.box(0.35, 0.25, 0, 0.9, 0.7, 14, C.stone[1], { top: C.stone[2] });
      m.box(1.4, 0.6, 0, 0.6, 0.45, 6, C.lacquer, { top: '#4a4a52' });
      m.box(1.55, 0.7, 6, 0.4, 0.25, 5, C.lacquer, { top: '#4a4a52' });
      m.place('deco_weaponrack', 2.0, 1.0, 0, v);
    },
    lights: function () { return [[0.8, 0.5, 16, 40, C.fire, 0.9]]; },
    anim: function (ctx, m, t) {
      var p = m.pt(0.8, 0.5, 16); A.fire(ctx, p[0], p[1], t, 1.0);
      var s = m.pt(0.8, 0.5, 24); A.smoke(ctx, s[0], s[1], t, 2.1);
    }
  });

  // ---------------- 別名(與既有 ART.OBJ 撞名,沿用既有美術) ----------------
  alias('deco_weaponrack', 'weaponrack');
  alias('deco_target', 'target');
  alias('deco_jumaa', 'jumaa');
  alias('deco_campfire', 'campfire');
  alias('deco_watchtower', 'watchtower');
  alias('deco_oxcart', 'oxcart');
  alias('deco_lumberyard', 'lumberyard');
  alias('deco_stable', 'stable');

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
    return r;
  }
  var WATER = function () { return [T_LAKE, T_RIVER]; };
  var DEF_ITEMS = {
    drill_ground: item('練兵場', '🥋', 4, 4, 180),
    parade_ground: item('校場', '🏟️', 4, 4, 260),
    army_camp: item('軍營', '⛺', 4, 4, 300),
    deco_lujiao: item('鹿角', '🦌', 1, 1, 30, { drag: true }),
    drum_tower: item('鼓台', '🥁', 2, 2, 120),
    beacon: item('烽燧', '🪔', 2, 2, 150),
    flag_army: item('牙旗', '🚩', 1, 1, 60, { drag: true }),
    flag_great: item('大旗', '🎏', 1, 1, 40, { drag: true }),
    tent_group: item('營帳群', '🏕️', 4, 4, 200),
    tent_general: item('帥帳', '🎪', 4, 4, 260),
    training_dummy: item('木樁人', '🪵', 1, 1, 40, { drag: true }),
    war_chariot: item('戰車', '🏇', 1, 3, 220),
    cloud_ladder: item('雲梯', '🪜', 1, 3, 200),
    ram: item('衝車', '🪵', 1, 2, 220),
    trebuchet: item('投石車', '🪨', 2, 2, 300),
    jinglan: item('井闌', '🪣', 2, 2, 200),
    carriage: item('華麗馬車', '🛺', 1, 3, 240),
    cart_empty: item('板車', '🛒', 1, 2, 50),
    wheelbarrow: item('獨輪車', '🛞', 1, 1, 30, { drag: true }),
    mine_entrance: item('礦坑口', '🕳️', 2, 2, 180),
    minecart: item('礦車', '🚃', 1, 1, 40),
    ore_iron: item('鐵礦堆', '🔩', 1, 1, 40, { drag: true }),
    ore_copper: item('銅礦堆', '🔶', 1, 1, 40, { drag: true }),
    ore_stone: item('石料堆', '⬜', 1, 1, 30, { drag: true }),
    sawbench: item('鋸台', '🪚', 1, 1, 40),
    lograft: item('流送木排', '🌲', 1, 2, 60, { on: WATER() }),
    post_station: item('驛站', '🏘️', 3, 2, 220),
    toll_gate: item('關津稅卡', '💰', 3, 1, 180),
    dock: item('碼頭', '⚓', 1, 1, 40, { on: WATER() }),
    boat_small: item('渡船', '⛵', 1, 2, 90, { on: WATER() }),
    warship: item('戰船', '🚢', 2, 3, 350, { on: WATER() }),
    ferry: item('渡口', '🛶', 2, 1, 160),
    smithy: item('鐵匠營', '⚒️', 3, 2, 220),
    deco_weaponrack: item('兵器架', '🗡️', 1, 1, 30, { drag: true }),
    deco_target: item('箭靶', '🎯', 1, 1, 30, { drag: true }),
    deco_jumaa: item('拒馬', '🚧', 1, 1, 20, { drag: true }),
    deco_campfire: item('營火', '🔥', 1, 1, 20, { drag: true }),
    deco_watchtower: item('望樓(木製)', '🗼', 2, 2, 300),
    deco_oxcart: item('牛車', '🐂', 1, 3, 120),
    deco_lumberyard: item('伐木場(林場)', '🪓', 2, 2, 90),
    deco_stable: item('馬廄營', '🐴', 3, 2, 200)
  };
  Object.keys(DEF_ITEMS).forEach(function (k) { ITEMS[k] = DEF_ITEMS[k]; });
  if (typeof OBJECTS !== 'undefined' && typeof T_GRASS !== 'undefined') {
    Object.assign(OBJECTS, ITEMS);
  }
})(ART);
