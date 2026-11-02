// art_town.js — 村鎮:民居(破舊老屋 → 豪門大院)、貧民區裝飾、市集廣場與地攤(經營布置用,side:'estate')。
// 依賴 art.js、art_objects.js、art_units.js 先載入;OBJECTS 來自 data.js。全為新 key,不覆寫既有定義。
// 純裝飾 / 經營用途,不進戰鬥模擬(cb.block = 'none')。物件資料上的標籤欄位供路人系統(citylife)日後讀取:
//   crowd = 'poor' | 'common' | 'rich'(住戶貧富)/ 'market'(市集人潮)/ 'hawker'(叫賣者);crowdW = 權重;tier = 房屋階級 0 破舊 ~ 4 豪門;walk:true = 路人可穿越的鋪面。
// 朝向:Model 以局部 (u,v) 繪製,v = 深度、正面在 v = D;非正方形者 swap:true。

(function (A) {
  var C = A.C;
  var KEYS = A.TOWN = [];
  var ITEMS = {};
  var MUD = '#d6b27a', MUD_DK = '#b48c56', MUD_OLD = '#c4a06a', DIRT = '#cfae7a', PLK = '#a07a4c', PLK_DK = '#6e5030', PLK_OLD = '#8a6c48';
  var STRAW = '#c9a850', STRAW_OLD = '#a38a42', STRAW_DK = '#7a6430', MOSS = '#7f9d52', WHITE = '#f4ecd8', INKB = '#2e2018';
  var BAMBOO = '#8fb84a', BAMBOO_DK = '#4f8f2e', JADE_TILE = '#3f6f66', JADE_TILE_DK = '#2a4c46', GREY_TILE = '#6f7f88', GREY_TILE_DK = '#4d5c64';

  function def(key, spec) { A.def(key, spec); KEYS.push(key); }
  function snowOn(v) { return v && v.season === 'winter' ? C.snow : null; }
  function line3(ctx, mm, a, b, col, w) {
    var p = mm.pt(a[0], a[1], a[2]), q = mm.pt(b[0], b[1], b[2]);
    A.line(ctx, p, q, C.ink, w + 1.4); A.line(ctx, p, q, col, w);
  }
  function hole(ctx, f, s0, s1, z0, z1) {
    if (A.state.lit) A.lit(ctx, function () { A.poly(ctx, A.quad(f, s0, s1, z0, z1), C.lamp, 0.4); });
    else A.poly(ctx, A.quad(f, s0, s1, z0, z1), A.tone(INKB, f.light), 0.5);
  }
  // 牆皮剝落:不規則淺色 / 深色補丁;crack:裂縫
  function peel(ctx, f, seed, col, n, wmax) {
    var r = A.rng(seed), i;
    for (i = 0; i < n; i++) {
      var s = 0.04 + r() * 0.78, w = 0.05 + r() * wmax, z = 2 + r() * Math.max(1, f.h - 7), h = 2 + r() * 4;
      A.poly(ctx, [f.pt(s, z), f.pt(s + w * 0.6, z + h * 0.8), f.pt(s + w, z + h * 0.3), f.pt(s + w * 0.8, z - 0.5)], A.tone(col, f.light), 0);
    }
  }
  function crack(ctx, f, seed, n) {
    var r = A.rng(seed), i;
    for (i = 0; i < n; i++) {
      var s = 0.1 + r() * 0.7, z = f.h * (0.45 + r() * 0.45), a = f.pt(s, z), b = f.pt(s + 0.04, z - 3), c = f.pt(s + 0.01, z - 6), d = f.pt(s + 0.07, z - 9);
      A.line(ctx, a, b, INKB, 0.8); A.line(ctx, b, c, INKB, 0.8); A.line(ctx, c, d, INKB, 0.8);
    }
  }
  // 屋頂補丁:list = [[u 比例, 自屋脊起 t(0~1), 寬比例, 高 dt, 色]];畫在可見那一側屋坡
  function roofPatches(m, u, v, z, w, d, rise, list) {
    m.custom(u, v, w, d, z + 0.1, function (ctx, mm) {
      var s = A.visible(mm, 'F') ? 1 : -1, vm = v + d / 2, hd = d / 2;
      list.forEach(function (p) {
        var u0 = u + p[0] * w, u1 = u0 + p[2] * w, t0 = p[1], t1 = Math.min(0.94, t0 + p[3]);
        var z0 = z + rise * (1 - t0), z1 = z + rise * (1 - t1);
        A.poly(ctx, [mm.pt(u0, vm + s * t0 * hd, z0), mm.pt(u1, vm + s * t0 * hd, z0), mm.pt(u1 - 0.02, vm + s * t1 * hd, z1), mm.pt(u0 + 0.02, vm + s * t1 * hd, z1)], p[4], 0.35);
      });
    });
  }
  function animal(m, kind, u, v, sc) {
    m.custom(u - 0.15, v - 0.15, 0.3, 0.3, 0, function (ctx, mm) {
      var c = mm.pt(u, v, 0), f = mm.f;
      ctx.save(); ctx.translate(c[0], c[1] + 2); if (f === 2 || f === 3) ctx.scale(-1, 1);
      if (sc) ctx.scale(sc, sc);
      A.animalRaw(ctx, A.ANIMAL[kind], f === 1 || f === 2, 0); ctx.restore();
    }, 1);
  }
  function woodpile(m, u, v) {
    m.box(u, v, 0, 0.3, 0.1, 3, PLK_DK, { top: PLK }); m.box(u + 0.02, v + 0.01, 3, 0.26, 0.1, 3, PLK_OLD, { top: PLK });
  }
  function jarAt(m, u, v, h) { m.cyl(u, v, 0, 0.1, h || 8, '#8a5230', { topCol: '#5a3420', hoops: [(h || 8) * 0.4] }); }
  function sackAt(m, u, v, h) { m.cyl(u, v, 0, 0.12, h || 6, '#d8c08a', { topCol: '#ecdcae', hoops: [(h || 6) * 0.75] }); }

  // ---------------- 平民住宅:破舊老屋 / 夯土矮屋 / 木板民居 / 半塌老屋(2x2)----------------
  function wallDeco(ctx, f, o, seed, front) {
    var i, list = [];
    A.band(ctx, f, 0, 3, A.mix(o.wall, '#5a4228', 0.4));
    if (o.plank) {
      for (i = 0; i < 12; i++) list.push(0.04 + i * 0.084);
      A.posts(ctx, f, list, 0.03, PLK_DK);
      for (i = 0; i < 3; i++) { var r0 = A.rng(seed + i)(); A.line(ctx, f.pt(0.05 + r0 * 0.5, 4 + i * 4), f.pt(0.3 + r0 * 0.5, 5 + i * 4), A.tone(PLK_DK, f.light), 0.8); }
    } else {
      if (o.layers) for (i = 1; i < 5; i++) A.line(ctx, f.pt(0, 3 + i * 3.1), f.pt(1, 3 + i * 3.1), A.tone(o.wall, f.light * 0.8), 0.7);
      peel(ctx, f, seed, o.peel, o.peelN, 0.16);
    }
    if (o.cracks) crack(ctx, f, seed + 5, o.cracks);
    if (o.moss) A.poly(ctx, A.quad(f, 0, 1, 0, 4), A.tone(MOSS, f.light), 0);
    if (front) {
      A.door(ctx, f, o.doorAt, 0.3, 10, o.doorCol || PLK_OLD);
      hole(ctx, f, 0.64, 0.82, 6, 11);
      if (o.corn) for (i = 0; i < 4; i++) { var p = f.pt(0.1 + i * 0.07, f.h - 1.5 - (i % 2) * 2); A.ellipse(ctx, p[0], p[1] + 3, 1.5, 3, i % 2 ? '#e8b030' : '#d84a2a', 0.4); }
    } else hole(ctx, f, 0.42, 0.58, 6, 10);
  }
  function hut(m, v, o) {
    var sn = snowOn(v), seed = (v.seed || 1) + o.seed, wh = o.wh, z = 2 + wh, ru = o.collapsed ? 0.75 : 1.4;
    m.box(0.22, 0.28, 0, 1.56, 1.44, 2, DIRT, { top: DIRT });
    var mk = function (k, fr) { return function (ctx, f) { wallDeco(ctx, f, o, seed + k, fr); }; };
    var uw = o.crooked ? 0.04 : 0;
    if (o.crooked) {
      m.box(0.3, 0.34, 2, 1.4, 1.28, wh * 0.55, o.wall, { deco: { F: mk(0, true), L: mk(1), R: mk(2), B: mk(3) } });
      m.box(0.3 + uw, 0.34, 2 + wh * 0.55, 1.4, 1.28, wh * 0.45, o.wall, { deco: { F: mk(4, false), L: mk(5), R: mk(6), B: mk(7) } });
    } else {
      m.box(0.3, 0.34, 2, ru, 1.28, wh, o.wall, { deco: { F: mk(0, true), L: mk(1), R: mk(2), B: mk(3) } });
    }
    var roof = o.shingle
      ? { col: '#7a6448', dk: '#4e3e2a' }
      : { col: STRAW_OLD, dk: STRAW_DK };
    m.gable(0.3 + uw * 1.6, 0.34, z, ru, 1.28, o.rise, roof.col, { over: 0.26, overEnd: 0.12, curl: 0, sag: o.sag, tileDensity: o.shingle ? 6 : 8, tileW: 1, ridgeCol: roof.dk, eaveCol: roof.dk, hooks: false, snow: sn, endCol: o.wall });
    if (o.patches) roofPatches(m, 0.3 + uw * 1.6, 0.34, z, ru, 1.28, o.rise, o.patches);
    if (o.collapsed) {
      m.box(1.05, 0.34, 2, 0.65, 1.28, 6, o.wall, { deco: { F: mk(8, false), R: mk(9), B: mk(10) } });
      m.custom(1.0, 0.3, 0.75, 1.4, 8.5, function (ctx, mm) {
        line3(ctx, mm, [1.05, 0.98, z + o.rise - 1], [1.62, 0.98, 13], PLK_DK, 2.2);
        [0.55, 0.75, 1.0].forEach(function (k) {
          line3(ctx, mm, [1.4 + (k - 0.55) * 0.2, 0.98, 14 - k * 3], [1.3 + k * 0.28, 0.4, 8.5], PLK_DK, 1.4);
          line3(ctx, mm, [1.4 + (k - 0.55) * 0.2, 0.98, 14 - k * 3], [1.3 + k * 0.28, 1.58, 8.5], PLK_DK, 1.4);
        });
        var c = mm.pt(1.3, 1.78, 0); A.rock(ctx, c[0], c[1], 0.55, seed, MUD_DK);
        c = mm.pt(1.6, 1.7, 0); A.rock(ctx, c[0], c[1], 0.4, seed + 3, MUD_OLD);
      }, 1);
    }
    if (o.prop) m.custom(1.5, 0.9, 0.5, 0.5, 0, function (ctx, mm) { line3(ctx, mm, [1.78, 1.5, 0], [1.66, 1.46, 12], PLK_DK, 2.4); }, 1);
    if (o.chimney) m.cyl(1.35, 0.62, z - 4, 0.09, o.rise + 6, MUD_DK, { topCol: INKB });
    if (o.wood) woodpile(m, 0.3, 1.78);
    if (o.jar) jarAt(m, 1.72, 1.72, 8);
    if (o.sack) sackAt(m, 1.62, 1.78, 6);
  }
  function defHut(key, o) {
    o.rise = o.rise || 14; o.sag = o.sag === undefined ? 1.2 : o.sag; o.doorAt = o.doorAt || 0.34; o.peel = o.peel || '#e8cf9c'; o.peelN = o.peelN === undefined ? 4 : o.peelN;
    def(key, {
      w: 2, d: 2, hmax: 62,
      build: function (m, v) { hut(m, v, o); },
      lights: function () { return [[0.74, 1.66, 10, 14, C.lamp, 0.5, 'F']]; },
      anim: o.chimney ? function (ctx, m, t, v) { var p = m.pt(1.35, 0.62, 2 + o.wh + o.rise + 6); A.smoke(ctx, p[0], p[1], t, o.seed * 0.1); } : undefined
    });
  }
  defHut('hut_ruin', { seed: 11, wall: MUD_OLD, wh: 14, rise: 15, sag: 2, crooked: true, cracks: 3, peelN: 6, peel: '#a8845a', patches: [[0.1, 0.1, 0.3, 0.4, '#e0c470'], [0.55, 0.3, 0.28, 0.35, '#6e5a30'], [0.3, 0.6, 0.22, 0.28, '#d8bd68']], prop: true, wood: true, jar: true, moss: true, doorCol: PLK_DK });
  defHut('hut_mud', { seed: 23, wall: MUD, wh: 12, rise: 13, layers: true, peel: '#c19458', peelN: 3, corn: true, patches: [[0.65, 0.2, 0.24, 0.3, '#d8bd68']], chimney: true, sack: true, wood: true });
  defHut('hut_plank', { seed: 37, wall: PLK, wh: 15, rise: 12, plank: true, shingle: true, doorAt: 0.3, doorCol: PLK_DK, cracks: 1, peelN: 0, jar: true, wood: true });
  defHut('hut_collapsed', { seed: 41, wall: MUD_OLD, wh: 14, rise: 14, collapsed: true, cracks: 4, peelN: 6, peel: '#a8845a', sag: 2.4, patches: [[0.1, 0.15, 0.4, 0.35, '#6e5a30']], moss: true, doorCol: PLK_DK });

  // 窩棚 shack_lean 1x1:單坡草棚靠一面土牆,地上破罐與麻袋
  def('shack_lean', {
    w: 1, d: 1, hmax: 34, shadow: 'ellipse',
    build: function (m, v) {
      var sn = snowOn(v), seed = v.seed || 1;
      m.box(0.08, 0.06, 0, 0.84, 0.14, 20, MUD_OLD, { deco: { F: function (ctx, f) { peel(ctx, f, seed, '#a8845a', 3, 0.2); A.band(ctx, f, 0, 3, MUD_DK); }, R: function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); } } });
      m.box(0.08, 0.2, 0, 0.08, 0.7, 15, PLK_DK); m.box(0.84, 0.2, 0, 0.08, 0.7, 12, PLK_DK);
      m.custom(0, 0, 1, 1, 12, function (ctx, mm) {
        var q = [mm.pt(0.0, 0.0, 23), mm.pt(1.0, 0.0, 23), mm.pt(1.0, 0.98, 11), mm.pt(0.0, 0.98, 11)];
        A.poly(ctx, q, sn || STRAW_OLD, 0.7);
        for (var i = 1; i < 8; i++) { var k = i / 8; A.line(ctx, mm.pt(k, 0.0, 23), mm.pt(k, 0.98, 11), sn ? '#c8d4e0' : STRAW_DK, 0.7); }
        A.poly(ctx, [mm.pt(0.15, 0.2, 21.5), mm.pt(0.45, 0.2, 21.5), mm.pt(0.42, 0.55, 17), mm.pt(0.13, 0.55, 17)], '#6e5a30', 0.3);
        A.line(ctx, mm.pt(0.0, 0.98, 11), mm.pt(1.0, 0.98, 11), STRAW_DK, 2);
      }, 2);
      sackAt(m, 0.25, 0.55, 5); jarAt(m, 0.7, 0.5, 6);
    },
    lights: function () { return [[0.5, 0.7, 8, 12, C.fire, 0.4, 'F']]; }
  });

  // 窯洞 cave_dwelling 2x1:黃土崖面三孔拱窯 + 窯頂草皮與煙囪 + 門前矮牆
  function arch(ctx, f, sc, wg, hh, col) {
    var hw = wg / f.len / 2, n = 8, pts = [f.pt(sc - hw, 0)], i;
    for (i = 0; i <= n; i++) { var a = Math.PI * i / n; pts.push(f.pt(sc - hw * Math.cos(a), hh * 0.55 + hh * 0.45 * Math.sin(a))); }
    pts.push(f.pt(sc + hw, 0));
    A.poly(ctx, pts, A.state.lit ? C.lampHot : A.tone(col, f.light), 0.7);
    A.line(ctx, f.pt(sc - hw - 0.012, 0), f.pt(sc - hw - 0.012, hh * 0.55), A.tone(MUD_DK, f.light), 1.2);
  }
  def('cave_dwelling', {
    w: 2, d: 1, hmax: 56, shadow: 'rect',
    build: function (m, v) {
      var sn = snowOn(v), seed = v.seed || 1;
      m.box(0.04, 0.1, 0, 1.92, 0.7, 24, MUD, { top: sn || '#9ab36a', deco: { F: function (ctx, f) {
        A.band(ctx, f, 0, 3, MUD_DK);
        for (var i = 1; i < 4; i++) A.line(ctx, f.pt(0, 6 + i * 4.5), f.pt(1, 6 + i * 4.5), A.tone(MUD_DK, f.light), 0.7);
        arch(ctx, f, 0.2, 0.34, 15, INKB); arch(ctx, f, 0.5, 0.34, 15, '#5a4228'); arch(ctx, f, 0.8, 0.34, 15, INKB);
        peel(ctx, f, seed, '#e8cf9c', 4, 0.12);
        A.poly(ctx, A.quad(f, 0.44, 0.56, 8, 12), A.tone(PLK_OLD, f.light), 0.4);
      }, R: function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); } } });
      m.cyl(1.6, 0.45, 24, 0.08, 9, MUD_DK, { topCol: INKB });
      m.box(0.1, 0.84, 0, 0.5, 0.1, 6, MUD_OLD, { top: MUD }); m.box(1.4, 0.84, 0, 0.5, 0.1, 5, MUD_OLD, { top: MUD });
      jarAt(m, 0.88, 0.9, 7);
    },
    anim: function (ctx, m, t) { var p = m.pt(1.6, 0.45, 34); A.smoke(ctx, p[0], p[1], t, 2.1); },
    lights: function () { return [[0.5, 0.92, 7, 16, C.lamp, 0.6, 'F']]; }
  });

  // 竹樓 bamboo_house 2x2:高腳竹柱 + 竹編牆 + 竹葉大屋頂 + 前梯
  def('bamboo_house', {
    w: 2, d: 2, hmax: 70, shadow: 'ellipse',
    build: function (m, v) {
      var sn = snowOn(v), i;
      [[0.3, 0.4], [1.0, 0.4], [1.7, 0.4], [0.3, 1.0], [1.7, 1.0], [0.3, 1.6], [1.0, 1.6], [1.7, 1.6]].forEach(function (p) { m.cyl(p[0], p[1], 0, 0.06, 11, BAMBOO, { topCol: BAMBOO_DK, hoops: [4, 8] }); });
      m.box(0.2, 0.3, 11, 1.6, 1.4, 2, PLK, { top: PLK_OLD });
      var bam = function (ctx, f) {
        var l = []; for (i = 0; i < 14; i++) l.push(0.035 + i * 0.07);
        A.posts(ctx, f, l, 0.03, BAMBOO_DK); A.band(ctx, f, 6, 7.2, BAMBOO_DK);
      };
      m.box(0.3, 0.4, 13, 1.4, 1.2, 12, '#c8d88a', { deco: { F: function (ctx, f) { bam(ctx, f); A.door(ctx, f, 0.5, 0.3, 9, BAMBOO_DK); A.lattice(ctx, f, 0.2, 0.2, 5, 5, BAMBOO); A.lattice(ctx, f, 0.8, 0.2, 5, 5, BAMBOO); }, L: bam, R: bam, B: bam } });
      m.hip(0.2, 0.3, 25, 1.6, 1.4, 18, '#9db25e', { over: 0.28, curl: 3, sag: 1.4, hipK: 0.5, tileDensity: 8, ridgeCol: '#6c8a3a', eaveCol: '#6c8a3a', hooks: false, snow: sn });
      m.custom(0.7, 1.62, 0.6, 0.38, 0, function (ctx, mm) {
        line3(ctx, mm, [0.78, 1.7, 0], [0.78, 1.7, 13], BAMBOO_DK, 1.8); line3(ctx, mm, [1.22, 1.7, 0], [1.22, 1.7, 13], BAMBOO_DK, 1.8);
        for (var k = 0; k < 5; k++) line3(ctx, mm, [0.78, 1.7, 1.5 + k * 2.4], [1.22, 1.7, 1.5 + k * 2.4], BAMBOO, 1.4);
      }, 1);
      jarAt(m, 1.7, 1.78, 7);
    },
    lights: function () { return [[1.0, 1.6, 20, 18, C.lamp, 0.6, 'F']]; }
  });

  // 瓦頂人家 house_tile 2x2:白灰牆 + 木構架 + 灰瓦懸山 + 小院矮牆
  def('house_tile', {
    w: 2, d: 2, hmax: 70,
    build: function (m, v) {
      var sn = snowOn(v), seed = v.seed || 1;
      m.box(0.2, 0.24, 0, 1.6, 1.52, 3, C.stone[1], { top: C.stone[2] });
      var S = function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); A.posts(ctx, f, [0, 1], 0.08, PLK_DK); hole(ctx, f, 0.4, 0.6, 7, 11); };
      m.box(0.3, 0.32, 3, 1.4, 1.2, 17, WHITE, { deco: {
        F: function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); A.posts(ctx, f, [0, 0.5, 1], 0.08, PLK_DK); A.door(ctx, f, 0.27, 0.3, 12, PLK_OLD); A.lattice(ctx, f, 0.74, 0.34, 7, 7, PLK); peel(ctx, f, seed, '#e0d4b8', 2, 0.1); },
        L: S, R: S, B: S
      } });
      m.gable(0.3, 0.32, 20, 1.4, 1.2, 15, GREY_TILE, { over: 0.2, curl: 2.5, sag: 1, ridgeCol: GREY_TILE_DK, snow: sn, endCol: WHITE, hookSize: 3 });
      m.cyl(1.5, 0.7, 24, 0.09, 12, MUD_DK, { topCol: INKB });
      m.box(0.2, 1.78, 0, 0.5, 0.1, 5, WHITE, { top: GREY_TILE_DK }); m.box(1.3, 1.78, 0, 0.5, 0.1, 5, WHITE, { top: GREY_TILE_DK });
      m.custom(0.4, 1.4, 1.2, 0.5, 0, function (ctx, mm) { var p = mm.pt(0.45, 1.74, 14); A.lantern(ctx, p[0], p[1], 0.8); }, 2);
      woodpile(m, 1.5, 1.8);
    },
    anim: function (ctx, m, t) { var p = m.pt(1.5, 0.7, 38); A.smoke(ctx, p[0], p[1], t, 1.1); },
    lights: function () { return [[0.74, 1.54, 13, 18, C.lamp, 0.6, 'F'], [0.45, 1.74, 9, 16, C.lantern, 0.6, 'F']]; }
  });

  // ---------------- 富裕住宅 ----------------
  function capWall(m, u, v, w, d, h, col, top) {
    m.box(u, v, 0, w, d, h, col, { top: top || GREY_TILE_DK, deco: { F: function (ctx, f) { A.band(ctx, f, 0, 2.5, MUD_DK); A.band(ctx, f, h - 3, h, GREY_TILE); }, R: function (ctx, f) { A.band(ctx, f, h - 3, h, GREY_TILE); } } });
  }
  function treeAt(m, u, v, sc, kind) {
    m.custom(u - 0.4, v - 0.4, 0.8, 0.8, 0, function (ctx, mm) {
      var c = mm.pt(u, v, 0); ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(sc, sc); A.tree(ctx, kind || 'round', 5, 'summer'); ctx.restore();
    }, 1);
  }
  // 鄉紳宅 house_gentry 3x3:前院牆 + 小門樓 + 兩廂房 + 後堂,院中一樹
  def('house_gentry', {
    w: 3, d: 3, hmax: 92,
    build: function (m, v) {
      var sn = snowOn(v);
      m.box(0.1, 0.9, 0, 2.8, 1.65, 1.2, C.stone[1], { top: C.stone[2] });
      var F = function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); A.posts(ctx, f, [0, 0.2, 0.4, 0.6, 0.8, 1], 0.07, C.hanRed); A.door(ctx, f, 0.5, 0.36, 13, C.hanRed); A.lattice(ctx, f, 0.2, 0.24, 8, 8, C.wood[1]); A.lattice(ctx, f, 0.8, 0.24, 8, 8, C.wood[1]); };
      var S = function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); A.posts(ctx, f, [0, 0.33, 0.67, 1], 0.07, C.hanRed); };
      m.box(0.35, 0.12, 1.2, 2.3, 0.95, 20, WHITE, { deco: { F: F, L: S, R: S, B: S } });
      m.gable(0.35, 0.12, 21.2, 2.3, 0.95, 15, C.tile, { over: 0.22, curl: 3, sag: 1.2, ridgeCol: C.tileDk, ridgeHi: C.gold, snow: sn, endCol: WHITE, hookSize: 3 });
      [0.15, 2.25].forEach(function (u, i) {
        var W = function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); A.posts(ctx, f, [0, 1], 0.07, PLK_DK); A.lattice(ctx, f, 0.5, 0.3, 6, 7, C.wood[1]); };
        m.box(u, 1.25, 1.2, 0.6, 1.1, 14, WHITE, { deco: { F: function (ctx, f) { W(ctx, f); A.door(ctx, f, 0.5, 0.3, 10, PLK_OLD); }, L: W, R: W, B: W } });
        m.gable(u, 1.25, 15.2, 0.6, 1.1, 10, C.tile, { axis: 'v', over: 0.16, overEnd: 0.12, curl: 2, sag: 0.8, ridgeCol: C.tileDk, snow: sn, endCol: WHITE, hookSize: 3 });
      });
      capWall(m, 0.1, 2.65, 1.0, 0.16, 12, WHITE); capWall(m, 1.9, 2.65, 1.0, 0.16, 12, WHITE);
      m.box(1.1, 2.5, 0, 0.8, 0.46, 17, C.hanRed, { top: C.lacquer, deco: { F: function (ctx, f) { A.band(ctx, f, 0, 2.5, C.lacquer); A.door(ctx, f, 0.5, 0.42, 13, C.lacquer); A.poly(ctx, A.quad(f, 0.4, 0.6, 14, 16), C.gold, 0.4); } } });
      m.gable(1.1, 2.5, 17, 0.8, 0.46, 9, C.tile, { over: 0.14, curl: 2.5, sag: 0.8, ridgeCol: C.lacquer, ridgeHi: C.gold, snow: sn, end: false, hooks: false });
      treeAt(m, 1.5, 1.7, 0.5, 'round');
      m.custom(1.0, 2.9, 1.0, 0.1, 18, function (ctx, mm) { [1.2, 1.8].forEach(function (u) { var p = mm.pt(u, 2.98, 15); A.lantern(ctx, p[0], p[1], 0.9); }); }, 2);
    },
    lights: function () { return [[1.2, 2.98, 12, 20, C.lantern, 0.85, 'F'], [1.8, 2.98, 12, 20, C.lantern, 0.85, 'F'], [1.5, 1.07, 14, 24, C.lamp, 0.6, 'F']]; }
  });

  // 豪門大院 mansion_great 4x5:高牆環繞 + 朱門門樓 + 石獅 + 影壁 + 前院廂房 + 中堂 + 後堂(多進院落)
  function lion(m, u, v) {
    m.box(u - 0.14, v - 0.1, 0, 0.28, 0.2, 4, C.stone[1], { top: C.stone[2] });
    m.cyl(u, v, 4, 0.1, 7, C.stone[2], { topCol: C.stone[2] });
    m.cyl(u, v + 0.03, 10, 0.08, 4, C.stone[2], { topCol: '#ffffff' });
  }
  def('mansion_great', {
    w: 4, d: 5, hmax: 150,
    build: function (m, v) {
      var sn = snowOn(v);
      m.box(0.2, 0.2, 0, 3.6, 4.5, 1, C.stone[1], { top: C.stone[2] });
      capWall(m, 0.05, 0.08, 3.9, 0.16, 22, WHITE);
      capWall(m, 0.05, 0.2, 0.16, 4.5, 22, WHITE); capWall(m, 3.79, 0.2, 0.16, 4.5, 22, WHITE);
      capWall(m, 0.05, 4.7, 1.4, 0.18, 22, WHITE); capWall(m, 2.55, 4.7, 1.4, 0.18, 22, WHITE);
      var DR = function (ctx, f) {
        A.band(ctx, f, 0, 3, C.lacquer); A.posts(ctx, f, [0, 1], 0.12, C.lacquer); A.door(ctx, f, 0.5, 0.5, 18, C.hanRed);
        var i, j; for (i = 0; i < 3; i++) for (j = 0; j < 4; j++) { var p = f.pt(0.4 + i * 0.1, 4 + j * 4.2); A.circle(ctx, p[0], p[1], 0.8, C.gold); }
        A.poly(ctx, A.quad(f, 0.34, 0.66, 22, 25), C.lacquer, 0.5);
      };
      m.box(1.4, 4.45, 0, 1.2, 0.6, 26, C.hanRed, { top: C.lacquer, deco: { F: DR, R: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.12, C.lacquer); A.band(ctx, f, 0, 3, C.lacquer); } } });
      m.hip(1.3, 4.38, 26, 1.4, 0.74, 14, C.tile, { over: 0.24, curl: 5, sag: 1.4, axis: 'u', hipK: 0.4, ridgeCol: C.lacquer, ridgeHi: C.gold, ridgeW: 4, snow: sn });
      lion(m, 1.2, 4.95); lion(m, 2.8, 4.95);
      m.box(1.6, 3.7, 1, 0.8, 0.16, 17, WHITE, { top: GREY_TILE_DK, deco: { F: function (ctx, f) { A.band(ctx, f, 0, 3, C.stone[1]); A.poly(ctx, A.quad(f, 0.2, 0.8, 4, 14), C.hanRed, 0.5); A.circle(ctx, f.pt(0.5, 9)[0], f.pt(0.5, 9)[1], 3, C.gold, 0.4); A.glyph(ctx, '福', f.pt(0.5, 9)[0], f.pt(0.5, 9)[1], 4.5, C.hanRed); } } });
      m.box(1.55, 3.66, 18, 0.9, 0.24, 3, GREY_TILE, { top: GREY_TILE_DK });
      // 前院廂房
      [0.25, 3.3].forEach(function (u) {
        var W = function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); A.posts(ctx, f, [0, 1], 0.07, PLK_DK); A.lattice(ctx, f, 0.5, 0.3, 6, 7, C.wood[1]); };
        m.box(u, 2.9, 1, 0.45, 1.5, 13, WHITE, { deco: { F: W, L: W, R: W, B: W } });
        m.gable(u, 2.9, 14, 0.45, 1.5, 9, C.tile, { axis: 'v', over: 0.15, overEnd: 0.1, curl: 2, sag: 0.8, ridgeCol: C.tileDk, snow: sn, endCol: WHITE, hookSize: 3 });
      });
      // 中堂
      var H = function (ctx, f) { A.band(ctx, f, 0, 3, C.stone[0]); A.posts(ctx, f, [0, 0.2, 0.4, 0.6, 0.8, 1], 0.1, C.hanRed); A.door(ctx, f, 0.5, 0.4, 14, C.hanRed); A.lattice(ctx, f, 0.25, 0.26, 7, 8, C.hanRed); A.lattice(ctx, f, 0.75, 0.26, 7, 8, C.hanRed); };
      var HS = function (ctx, f) { A.posts(ctx, f, [0, 0.5, 1], 0.1, C.hanRed); A.lattice(ctx, f, 0.25, 0.3, 7, 8, C.hanRed); A.lattice(ctx, f, 0.75, 0.3, 7, 8, C.hanRed); };
      m.box(0.75, 1.95, 1, 2.5, 0.85, 20, WHITE, { deco: { F: H, L: HS, R: HS, B: HS } });
      m.gable(0.75, 1.95, 21, 2.5, 0.85, 14, C.tile, { over: 0.24, curl: 3.5, sag: 1.2, ridgeCol: C.lacquer, ridgeHi: C.gold, snow: sn, endCol: WHITE, hookSize: 3.5 });
      // 後堂
      m.box(0.5, 0.35, 1, 3.0, 1.1, 24, WHITE, { deco: { F: H, L: HS, R: HS, B: HS } });
      m.hip(0.5, 0.35, 25, 3.0, 1.1, 18, C.tile, { over: 0.3, curl: 5, sag: 1.6, hipK: 0.55, ridgeCol: C.lacquer, ridgeHi: C.gold, ridgeW: 4, snow: sn });
      treeAt(m, 0.5, 1.7, 0.4, 'round'); treeAt(m, 3.5, 1.7, 0.4, 'round');
      m.custom(1.3, 4.9, 1.4, 0.1, 22, function (ctx, mm) { [1.5, 2.5].forEach(function (u) { var p = mm.pt(u, 5.0, 24); A.lantern(ctx, p[0], p[1], 1.2); }); }, 3);
    },
    lights: function () { return [[1.5, 5.0, 14, 26, C.lantern, 0.95, 'F'], [2.5, 5.0, 14, 26, C.lantern, 0.95, 'F'], [2.0, 2.8, 14, 28, C.lamp, 0.6, 'F'], [2.0, 1.45, 14, 30, C.lamp, 0.6, 'F']]; }
  });

  // 世家宅邸 mansion_clan 4x4:白牆朱柱、青綠琉璃瓦、前院三開間朱門 + 石獅 + 雙旗 + 兩層大堂(裙簷 + 重檐)
  def('mansion_clan', {
    w: 4, d: 4, hmax: 140,
    build: function (m, v) {
      var sn = snowOn(v);
      m.box(0.1, 0.1, 0, 3.8, 3.5, 6, C.stone[1], { top: C.stone[2], deco: { F: function (ctx, f) { A.band(ctx, f, 3, 6, C.stone[0]); } } });
      m.box(1.5, 3.5, 0, 1.0, 0.4, 3, C.stone[2]);
      var F = function (ctx, f) { A.posts(ctx, f, [0, 0.17, 0.34, 0.5, 0.66, 0.83, 1], 0.1, C.hanRed); A.door(ctx, f, 0.5, 0.4, 16, C.hanRed); A.lattice(ctx, f, 0.25, 0.22, 8, 10, C.hanRed); A.lattice(ctx, f, 0.75, 0.22, 8, 10, C.hanRed); A.lattice(ctx, f, 0.08, 0.1, 8, 10, C.hanRed); A.lattice(ctx, f, 0.92, 0.1, 8, 10, C.hanRed); };
      var S = function (ctx, f) { A.posts(ctx, f, [0, 0.33, 0.67, 1], 0.1, C.hanRed); A.lattice(ctx, f, 0.17, 0.3, 8, 10, C.hanRed); A.lattice(ctx, f, 0.5, 0.3, 8, 10, C.hanRed); A.lattice(ctx, f, 0.83, 0.3, 8, 10, C.hanRed); };
      m.box(0.35, 0.55, 6, 3.3, 2.5, 22, WHITE, { deco: { F: F, B: S, L: S, R: S } });
      m.hip(0.2, 0.4, 28, 3.6, 2.8, 8, JADE_TILE, { over: 0.2, curl: 4, sag: 1.4, hipK: 0.95, ridgeCol: JADE_TILE_DK, snow: sn });
      var U = function (ctx, f) { A.posts(ctx, f, [0, 0.25, 0.5, 0.75, 1], 0.09, C.hanRed); A.lattice(ctx, f, 0.125, 0.18, 4, 9, C.hanRed); A.lattice(ctx, f, 0.375, 0.18, 4, 9, C.hanRed); A.lattice(ctx, f, 0.625, 0.18, 4, 9, C.hanRed); A.lattice(ctx, f, 0.875, 0.18, 4, 9, C.hanRed); };
      m.box(0.9, 0.9, 36, 2.2, 1.7, 16, WHITE, { deco: { F: U, B: U, L: U, R: U } });
      m.hip(0.9, 0.9, 52, 2.2, 1.7, 22, JADE_TILE, { over: 0.32, curl: 5.5, sag: 2, hipK: 0.6, ridgeCol: C.lacquer, ridgeHi: C.gold, ridgeW: 4, snow: sn });
      [0.7, 3.3].forEach(function (u) { lion(m, u, 3.78); });
      [0.18, 3.72].forEach(function (u) { m.cyl(u, 3.62, 6, 0.05, 40, C.wood[0], { topCol: C.gold }); });
      m.custom(0.9, 3.6, 2.2, 0.2, 14, function (ctx, mm) { [1.3, 2.0, 2.7].forEach(function (u) { var p = mm.pt(u, 3.55, 26); A.lantern(ctx, p[0], p[1], 1.1); }); }, 3);
    },
    lights: function () { return [[1.3, 3.55, 20, 26, C.lantern, 0.9, 'F'], [2.7, 3.55, 20, 26, C.lantern, 0.9, 'F'], [2.0, 3.05, 14, 32, C.lamp, 0.7, 'F'], [2.0, 2.55, 42, 26, C.lamp, 0.55, 'F']]; },
    anim: function (ctx, m, t) {
      var a = m.pt(0.18, 3.62, 44), b = m.pt(3.72, 3.62, 44);
      A.flag(ctx, a[0], a[1], 0, 16, 11, JADE_TILE, t, 0.2); A.flag(ctx, b[0], b[1], 0, 16, 11, JADE_TILE, t, 1.4);
    }
  });

  // 莊園 manor_estate 5x5:夯土高牆 + 四角望樓 + 門樓 + 正堂 + 廂房 + 兩座糧倉 + 草垛與曬場
  def('manor_estate', {
    w: 5, d: 5, hmax: 120,
    build: function (m, v) {
      var sn = snowOn(v), seed = v.seed || 1, i;
      m.box(0.15, 0.15, 0, 4.7, 4.7, 1, '#d8c490', { top: '#d8c490' });
      var WALL = function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); for (i = 1; i < 4; i++) A.line(ctx, f.pt(0, 3 + i * 3.2), f.pt(1, 3 + i * 3.2), A.tone(MUD, f.light * 0.8), 0.7); A.band(ctx, f, f.h - 2.5, f.h, GREY_TILE); };
      m.box(0.2, 0.2, 0, 4.6, 0.2, 17, MUD, { top: GREY_TILE_DK, deco: { F: WALL, R: WALL } });
      m.box(0.2, 0.4, 0, 0.2, 4.2, 17, MUD, { top: GREY_TILE_DK, deco: { F: WALL, R: WALL } });
      m.box(4.6, 0.4, 0, 0.2, 4.2, 17, MUD, { top: GREY_TILE_DK, deco: { F: WALL, R: WALL } });
      m.box(0.2, 4.6, 0, 1.8, 0.2, 17, MUD, { top: GREY_TILE_DK, deco: { F: WALL, R: WALL } });
      m.box(3.0, 4.6, 0, 1.8, 0.2, 17, MUD, { top: GREY_TILE_DK, deco: { F: WALL, R: WALL } });
      // 角樓
      [[0.1, 0.1], [4.5, 0.1], [0.1, 4.5], [4.5, 4.5]].forEach(function (p) {
        m.box(p[0], p[1], 0, 0.5, 0.5, 30, MUD, { top: GREY_TILE_DK, deco: { F: function (ctx, f) { WALL(ctx, f); A.lattice(ctx, f, 0.5, 0.3, 19, 7, PLK_DK); }, R: WALL } });
        m.hip(p[0] - 0.05, p[1] - 0.05, 30, 0.6, 0.6, 9, GREY_TILE, { over: 0.12, curl: 2, sag: 0.6, hipK: 0.9, ridgeCol: GREY_TILE_DK, snow: sn });
      });
      // 門樓
      m.box(2.0, 4.5, 0, 1.0, 0.4, 24, C.hanRed, { top: C.lacquer, deco: { F: function (ctx, f) { A.band(ctx, f, 0, 3, C.lacquer); A.posts(ctx, f, [0, 1], 0.12, C.lacquer); A.door(ctx, f, 0.5, 0.46, 16, C.wood[1]); } } });
      m.hip(1.9, 4.42, 24, 1.2, 0.56, 12, GREY_TILE, { over: 0.2, curl: 4, sag: 1.2, axis: 'u', hipK: 0.4, ridgeCol: C.lacquer, ridgeHi: C.gold, snow: sn });
      // 正堂
      var H = function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); A.posts(ctx, f, [0, 0.2, 0.4, 0.6, 0.8, 1], 0.09, C.wood[0]); A.door(ctx, f, 0.5, 0.36, 12, C.hanRed); A.lattice(ctx, f, 0.25, 0.24, 7, 7, C.wood[1]); A.lattice(ctx, f, 0.75, 0.24, 7, 7, C.wood[1]); };
      var HS = function (ctx, f) { A.band(ctx, f, 0, 3, MUD_DK); A.posts(ctx, f, [0, 0.5, 1], 0.09, C.wood[0]); A.lattice(ctx, f, 0.5, 0.3, 7, 7, C.wood[1]); };
      m.box(1.1, 0.7, 1, 2.8, 1.1, 19, WHITE, { deco: { F: H, L: HS, R: HS, B: HS } });
      m.gable(1.1, 0.7, 20, 2.8, 1.1, 14, C.tile, { over: 0.24, curl: 3, sag: 1.2, ridgeCol: C.tileDk, ridgeHi: C.gold, snow: sn, endCol: WHITE, hookSize: 3 });
      // 廂房
      [0.6, 4.0].forEach(function (u) {
        m.box(u, 1.2, 1, 0.5, 1.8, 12, WHITE, { deco: { F: HS, L: HS, R: HS, B: HS } });
        m.gable(u, 1.2, 13, 0.5, 1.8, 9, C.tile, { axis: 'v', over: 0.14, overEnd: 0.1, curl: 2, sag: 0.8, ridgeCol: C.tileDk, snow: sn, endCol: WHITE, hookSize: 3 });
      });
      // 糧倉(圓倉)與草垛
      [[1.5, 3.2], [2.4, 3.5]].forEach(function (p) {
        m.cyl(p[0], p[1], 1, 0.34, 15, '#d8b878', { topCol: STRAW_OLD, hoops: [5, 10] });
        m.cone(p[0], p[1], 16, 0.42, 11, STRAW_OLD, {});
      });
      m.cone(3.7, 3.4, 1, 0.4, 14, STRAW, {}); m.cone(4.0, 3.9, 1, 0.3, 10, STRAW, {});
      treeAt(m, 3.3, 2.2, 0.55, 'round');
      m.custom(1.0, 3.9, 1.5, 0.5, 1, function (ctx, mm) {
        var r = A.rng(seed);
        for (var k = 0; k < 7; k++) { var c = mm.pt(0.8 + k * 0.25, 4.0 + r() * 0.3, 1); A.ellipse(ctx, c[0], c[1], 3.2, 1.6, k % 2 ? '#e8cf80' : '#d8b860', 0.3); }
      }, 1);
      m.custom(1.9, 4.9, 1.2, 0.1, 18, function (ctx, mm) { [2.1, 2.9].forEach(function (u) { var p = mm.pt(u, 4.96, 18); A.lantern(ctx, p[0], p[1], 1); }); }, 3);
    },
    lights: function () { return [[2.1, 4.96, 12, 22, C.lantern, 0.85, 'F'], [2.9, 4.96, 12, 22, C.lantern, 0.85, 'F'], [2.5, 1.8, 12, 26, C.lamp, 0.6, 'F']]; }
  });

  // ---------------- 貧民區裝飾 ----------------
  // 院落 yard_poor 2x2:矮土牆圍成的小院(前側留缺口)+ 柴堆 + 雞籠 + 石臼
  def('yard_poor', {
    w: 2, d: 2, hmax: 24, shadow: 'rect',
    build: function (m, v) {
      var sn = snowOn(v), seed = v.seed || 1;
      m.box(0.05, 0.05, 0, 1.9, 1.9, 1, DIRT, { top: DIRT });
      var lowWall = function (ctx, f) { A.band(ctx, f, 0, 2, MUD_DK); peel(ctx, f, seed, '#a8845a', 2, 0.18); };
      m.box(0.08, 0.08, 1, 1.84, 0.14, 9, MUD_OLD, { top: MUD, deco: { F: lowWall, R: lowWall } });
      m.box(0.08, 0.22, 1, 0.14, 1.7, 8, MUD_OLD, { top: MUD, deco: { F: lowWall, R: lowWall } });
      m.box(1.78, 0.22, 1, 0.14, 1.2, 10, MUD_OLD, { top: MUD, deco: { F: lowWall, R: lowWall } });
      m.box(0.08, 1.78, 1, 0.55, 0.14, 7, MUD_OLD, { top: MUD, deco: { F: lowWall, R: lowWall } });
      m.box(1.4, 1.78, 1, 0.52, 0.14, 6, MUD_OLD, { top: MUD, deco: { F: lowWall, R: lowWall } });
      woodpile(m, 0.35, 0.4); woodpile(m, 0.4, 0.55);
      m.box(1.2, 0.4, 1, 0.45, 0.35, 5, PLK, { top: PLK_OLD, deco: { F: function (ctx, f) { A.posts(ctx, f, [0.2, 0.5, 0.8], 0.06, PLK_DK); } } });
      m.gable(1.17, 0.37, 6, 0.51, 0.41, 5, STRAW_OLD, { over: 0.06, curl: 0, sag: 0.3, ridgeCol: STRAW_DK, eaveCol: STRAW_DK, hooks: false, snow: sn, end: false });
      m.cyl(1.0, 1.2, 1, 0.14, 5, C.stone[1], { topCol: C.stone[0] });
      sackAt(m, 0.5, 1.2, 5); jarAt(m, 1.5, 1.3, 7);
    }
  });

  // 圍牆殘段 wall_ruin(斷牆)1x1:高低不齊的夯土殘牆 + 散落土塊
  def('wall_ruin', {
    w: 1, d: 1, hmax: 26, shadow: 'rect',
    build: function (m, v) {
      var r = A.rng(v.seed || 1), i, u = 0, hs = [16, 11, 6, 13, 3];
      for (i = 0; i < 4; i++) {
        var w = 0.2 + r() * 0.12, h = hs[(i + ((v.seed || 0) % 5)) % 5];
        m.box(u, 0.38, 0, w, 0.26, h, MUD_OLD, { top: h < 8 ? MUD : MUD_DK, deco: { F: function (ctx, f) { A.band(ctx, f, 0, 2.5, MUD_DK); crack(ctx, f, (v.seed || 1) + 3, 1); }, R: function (ctx, f) { A.band(ctx, f, 0, 2.5, MUD_DK); } } });
        u += w + 0.05;
      }
      m.custom(0, 0.6, 1, 0.4, 0, function (ctx, mm) {
        var c = mm.pt(0.3, 0.85, 0); A.rock(ctx, c[0], c[1], 0.4, 3, MUD_DK); c = mm.pt(0.75, 0.9, 0); A.rock(ctx, c[0], c[1], 0.3, 7, MUD_OLD);
      }, 1);
    }
  });

  // 柴扉 gate_wicker 1x1:兩根歪木柱 + 編條柴門(半掩)+ 兩側枯枝籬
  def('gate_wicker', {
    w: 1, d: 1, hmax: 34, shadow: 'rect',
    build: function (m, v) {
      m.box(0.06, 0.44, 0, 0.09, 0.1, 28, PLK_DK, { top: PLK }); m.box(0.85, 0.44, 0, 0.09, 0.1, 25, PLK_DK, { top: PLK });
      m.custom(0, 0.35, 1, 0.3, 0, function (ctx, mm) {
        var i;
        A.poly(ctx, [mm.pt(0.15, 0.5, 2), mm.pt(0.62, 0.5, 2), mm.pt(0.62, 0.5, 22), mm.pt(0.15, 0.5, 24)], '#8a6c3a', 0.7);
        for (i = 0; i < 6; i++) { var k = 0.15 + i * 0.08; A.line(ctx, mm.pt(k, 0.5, 2), mm.pt(k, 0.5, 24 - i * 0.4), PLK_DK, 0.8); }
        for (i = 0; i < 4; i++) A.line(ctx, mm.pt(0.15, 0.5, 5 + i * 5), mm.pt(0.62, 0.5, 5 + i * 5), '#c8a868', 0.9);
        line3(ctx, mm, [0.0, 0.5, 11], [0.06, 0.5, 11], PLK_DK, 1.4);
        for (i = 0; i < 3; i++) line3(ctx, mm, [0.7 + i * 0.1, 0.5, 2], [0.72 + i * 0.1, 0.5, 14 + i * 3], '#7a5a3a', 1);
      }, 1);
    }
  });

  // 破籬笆 fence_broken 1x1:歪斜木樁,缺了幾根,橫木斷裂
  def('fence_broken', {
    w: 1, d: 1, hmax: 28, shadow: 'none',
    build: function (m, v) {
      m.custom(0, 0.4, 1, 0.2, 0, function (ctx, mm) {
        var r = A.rng(v.seed || 1), i, sn = v.season === 'winter';
        for (i = 0; i < 7; i++) {
          if (r() < 0.22) continue;
          var u = 0.06 + i * 0.14, h = 12 + r() * 14, lean = (r() - 0.5) * 0.1, a = mm.pt(u, 0.5, 0), b = mm.pt(u + lean, 0.5, h);
          A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, a, b, i % 2 ? PLK_OLD : PLK, 2);
          if (sn) A.ellipse(ctx, b[0], b[1] - 1, 2.2, 1.1, C.snow);
        }
        A.line(ctx, mm.pt(0.0, 0.5, 9), mm.pt(0.45, 0.5, 11), C.ink, 3.2); A.line(ctx, mm.pt(0.0, 0.5, 9), mm.pt(0.45, 0.5, 11), PLK_OLD, 1.8);
        A.line(ctx, mm.pt(0.62, 0.5, 8), mm.pt(0.9, 0.5, 3), C.ink, 3.2); A.line(ctx, mm.pt(0.62, 0.5, 8), mm.pt(0.9, 0.5, 3), PLK_OLD, 1.8);
      });
    }
  });

  // 井台舊石 well_old 1x1:殘缺石井欄 + 苔蘚 + 一截木架與麻繩 + 地上舊木桶
  def('well_old', {
    w: 1, d: 1, sym: true, hmax: 38, shadow: 'ellipse',
    build: function (m, v) {
      var sn = snowOn(v);
      m.cyl(0.46, 0.46, 0, 0.3, 8, C.stone[0], { topCol: sn || '#2a3a44', hoops: [4] });
      m.custom(0.1, 0.1, 0.8, 0.8, 8, function (ctx, mm) {
        var c = mm.pt(0.46, 0.46, 8);
        A.ellipse(ctx, c[0] - 6, c[1] + 5, 4, 1.6, MOSS, 0); A.ellipse(ctx, c[0] + 8, c[1] + 4, 3, 1.3, MOSS, 0);
        A.poly(ctx, [[c[0] + 5, c[1] - 12], [c[0] + 15, c[1] - 6], [c[0] + 12, c[1] + 2], [c[0] + 3, c[1] - 5]], '#d0c8b0', 0);
      }, 1);
      m.box(0.16, 0.42, 8, 0.07, 0.08, 20, PLK_DK); m.box(0.78, 0.42, 8, 0.07, 0.08, 20, PLK_DK);
      m.custom(0.1, 0.3, 0.8, 0.3, 28, function (ctx, mm) {
        line3(ctx, mm, [0.12, 0.46, 28], [0.86, 0.46, 28], PLK, 2.2);
        line3(ctx, mm, [0.5, 0.46, 27], [0.5, 0.46, 18], '#c8a868', 1);
        var p = mm.pt(0.5, 0.46, 17); A.poly(ctx, [[p[0] - 3, p[1]], [p[0] + 3, p[1]], [p[0] + 2.4, p[1] + 5], [p[0] - 2.4, p[1] + 5]], PLK, 0.7);
      }, 2);
      m.cyl(0.85, 0.85, 0, 0.1, 6, PLK_OLD, { topCol: PLK_DK, hoops: [3] });
    }
  });

  // 曬網架 rack_net / 曬衣架 rack_cloth 2x1:兩根立柱 + 橫桿 + 垂掛網 / 衣物
  function dryRack(key, kind) {
    def(key, {
      w: 2, d: 1, hmax: 44, shadow: 'rect',
      build: function (m, v) {
        var r = A.rng(v.seed || 1);
        m.box(0.1, 0.45, 0, 0.09, 0.09, 36, PLK_DK, { top: PLK }); m.box(1.8, 0.45, 0, 0.09, 0.09, 36, PLK_DK, { top: PLK });
        m.custom(0, 0.35, 2, 0.3, 0, function (ctx, mm) {
          var i, cols = ['#c8b898', '#7a9ab0', '#b8584a', '#8aa070', '#d8c88a', '#a89080'];
          line3(ctx, mm, [0.05, 0.5, 35], [1.95, 0.5, 35], kind === 'net' ? PLK : BAMBOO, 2.4);
          if (kind === 'net') {
            var top = mm.pt(0.2, 0.5, 34), top2 = mm.pt(1.8, 0.5, 34), bot = mm.pt(0.35, 0.5, 8), bot2 = mm.pt(1.65, 0.5, 6);
            A.poly(ctx, [top, top2, bot2, bot], 'rgba(120,150,170,0.55)', 0.5);
            for (i = 1; i < 10; i++) { var k = i / 10; A.line(ctx, [top[0] + (top2[0] - top[0]) * k, top[1] + (top2[1] - top[1]) * k], [bot[0] + (bot2[0] - bot[0]) * k, bot[1] + (bot2[1] - bot[1]) * k], '#5a7a8c', 0.6); }
            for (i = 1; i < 6; i++) { var z = 34 - i * 4.8; A.line(ctx, mm.pt(0.2 + i * 0.03, 0.5, z), mm.pt(1.8 - i * 0.03, 0.5, z), '#5a7a8c', 0.6); }
            for (i = 0; i < 5; i++) { var fp = mm.pt(0.4 + i * 0.3, 0.5, 8 - i % 2); A.ellipse(ctx, fp[0], fp[1], 2, 2.6, '#e8d8a0', 0.5); }
          } else {
            for (i = 0; i < 4; i++) {
              var u = 0.2 + i * 0.45 + r() * 0.1, h = 12 + r() * 10, w = 0.18 + r() * 0.1;
              A.poly(ctx, [mm.pt(u, 0.5, 34), mm.pt(u + w, 0.5, 34), mm.pt(u + w + 0.02, 0.5, 34 - h), mm.pt(u - 0.02, 0.5, 34 - h)], cols[(i + (v.seed || 0)) % 6], 0.6);
              A.line(ctx, mm.pt(u + w * 0.5, 0.5, 34), mm.pt(u + w * 0.5, 0.5, 34 - h), 'rgba(0,0,0,0.12)', 0.8);
            }
          }
        }, 2);
      }
    });
  }
  dryRack('rack_net', 'net'); dryRack('rack_cloth', 'cloth');

  // 牲口棚 shed_livestock 2x1:四柱草頂敞棚 + 後牆 + 食槽草料 + 牲口
  def('shed_livestock', {
    w: 2, d: 1, hmax: 50, shadow: 'rect',
    build: function (m, v) {
      var sn = snowOn(v), seed = v.seed || 1;
      m.box(0.05, 0.05, 0, 1.9, 0.14, 20, PLK, { top: PLK_OLD, deco: { F: function (ctx, f) { A.posts(ctx, f, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], 0.04, PLK_DK); } } });
      [[0.08, 0.2], [1.84, 0.2], [0.08, 0.86], [1.84, 0.86]].forEach(function (p) { m.box(p[0], p[1], 0, 0.08, 0.08, 22, PLK_DK, { top: PLK }); });
      m.box(0.5, 0.78, 0, 1.0, 0.14, 6, PLK, { top: STRAW, deco: { F: function (ctx, f) { A.band(ctx, f, 0, 1.6, PLK_DK); } } });
      animal(m, seed % 2 ? 'ox' : 'donkey', 0.55, 0.5, 0.85); animal(m, seed % 3 ? 'sheep' : 'goat', 1.25, 0.5, 0.9);
      m.gable(0.0, 0.0, 22, 2, 1, 11, STRAW_OLD, { over: 0.18, overEnd: 0.1, curl: 0, sag: 1.2, tileDensity: 8, ridgeCol: STRAW_DK, eaveCol: STRAW_DK, hooks: false, snow: sn, endCol: PLK });
      roofPatches(m, 0.0, 0.0, 22, 2, 1, 11, [[0.55, 0.25, 0.25, 0.4, '#6e5a30'], [0.15, 0.5, 0.2, 0.3, '#d8bd68']]);
      m.cone(1.75, 0.55, 0, 0.2, 10, STRAW, {});
    }
  });

  // 雜物堆 junk_pile 1x1:破木桶、斷木板、碎陶罐、破筐、爛席卷
  def('junk_pile', {
    w: 1, d: 1, hmax: 24, shadow: 'ellipse',
    build: function (m, v) {
      var r = A.rng(v.seed || 1);
      m.cyl(0.3, 0.35, 0, 0.17, 10, PLK_OLD, { topCol: INKB, hoops: [3, 7] });
      m.box(0.52, 0.2, 0, 0.4, 0.1, 3, PLK_DK, { top: PLK }); m.box(0.5, 0.24, 3, 0.36, 0.1, 3, PLK_OLD, { top: PLK });
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var c = mm.pt(0.62, 0.68, 0); A.ellipse(ctx, c[0], c[1], 6, 2.8, '#c8a868', 0.6); A.ellipse(ctx, c[0], c[1] - 2, 5, 2, '#a89050', 0.4);
        c = mm.pt(0.25, 0.8, 0); A.poly(ctx, [[c[0] - 5, c[1]], [c[0] - 1, c[1] - 6], [c[0] + 2, c[1] - 2], [c[0] + 5, c[1]]], '#8a5230', 0.7);
        c = mm.pt(0.85, 0.5, 0); A.rock(ctx, c[0], c[1], 0.35, 3, MUD_DK);
        var p = mm.pt(0.5, 0.2 + r() * 0.1, 8); A.line(ctx, p, [p[0] + 6, p[1] - 5], C.ink, 2.2); A.line(ctx, p, [p[0] + 6, p[1] - 5], PLK, 1.2);
      }, 1);
      sackAt(m, 0.75, 0.82, 5);
    }
  });

  // 枯樹 tree_dead 1x1:光禿扭曲的樹幹與枝椏 + 烏鴉(冬季枝上有雪)
  def('tree_dead', {
    w: 1, d: 1, sym: true, hmax: 64, shadow: 'ellipse',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var c = mm.pt(0.5, 0.5, 0), sn = v.season === 'winter', r = A.rng(v.seed || 1), x = c[0], y = c[1];
        function limb(x0, y0, x1, y1, w) { A.line(ctx, [x0, y0], [x1, y1], C.ink, w + 1.6); A.line(ctx, [x0, y0], [x1, y1], '#6a5440', w); if (sn) A.line(ctx, [x0, y0 - w * 0.5], [x1, y1 - w * 0.5], C.snow, 1); }
        limb(x, y + 1, x - 2, y - 18, 5.4); limb(x - 2, y - 18, x + 3, y - 34, 4); limb(x + 3, y - 34, x + 2, y - 46, 2.6);
        limb(x - 2, y - 18, x - 15, y - 29, 3); limb(x - 15, y - 29, x - 21, y - 38, 1.8); limb(x - 12, y - 27, x - 8, y - 40, 1.6);
        limb(x + 2, y - 28, x + 14, y - 38, 2.4); limb(x + 14, y - 38, x + 20, y - 34, 1.4); limb(x + 3, y - 34, x - 4, y - 47, 1.8);
        if (r() > 0.4) { A.ellipse(ctx, x + 12, y - 41, 3.4, 2.2, '#2a2430', 0.4); A.poly(ctx, [[x + 15, y - 41], [x + 18, y - 40], [x + 15, y - 39.5]], '#2a2430', 0); }
      });
    }
  });

  // ======================== 市集廣場與地攤 ========================
  var PAVE = '#c9c2b0';

  // 石板廣場鋪面 plaza_stone 1x1(可拖曳鋪設):3x3 大石板,色澤與縫隙隨格變化
  def('plaza_stone', {
    w: 1, d: 1, sym: true, hmax: 3, shadow: 'none',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var r = A.rng(v.seed || 2), i, j, sn = v.season === 'winter';
        A.poly(ctx, [mm.pt(0, 0, 0), mm.pt(1, 0, 0), mm.pt(1, 1, 0), mm.pt(0, 1, 0)], '#a8a090', 0);
        for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
          var x0 = i / 3 + 0.015, y0 = j / 3 + 0.015, x1 = (i + 1) / 3 - 0.015, y1 = (j + 1) / 3 - 0.015, k = 0.94 + r() * 0.14;
          A.poly(ctx, [mm.pt(x0, y0, 0.3), mm.pt(x1, y0, 0.3), mm.pt(x1, y1, 0.3), mm.pt(x0, y1, 0.3)], sn ? A.tone('#e8eef4', k) : A.tone(PAVE, k), 0.3);
          if (r() > 0.78 && !sn) { var c = mm.pt((x0 + x1) / 2, (y0 + y1) / 2, 0.3); A.ellipse(ctx, c[0], c[1], 2.2, 1, MOSS, 0); }
        }
      });
    }
  });

  // 夯土廣場 plaza_earth 1x1(可拖曳):踩實的黃土地面 + 車轍 + 碎石與稻草
  def('plaza_earth', {
    w: 1, d: 1, sym: true, hmax: 2, shadow: 'none',
    build: function (m, v) {
      m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
        var r = A.rng(v.seed || 3), i, sn = v.season === 'winter';
        A.poly(ctx, [mm.pt(0, 0, 0), mm.pt(1, 0, 0), mm.pt(1, 1, 0), mm.pt(0, 1, 0)], sn ? '#dcd6c8' : '#dcc08c', 0);
        var k = r() > 0.5;
        A.line(ctx, k ? mm.pt(0.0, 0.3, 0.2) : mm.pt(0.3, 0.0, 0.2), k ? mm.pt(1.0, 0.34, 0.2) : mm.pt(0.34, 1.0, 0.2), sn ? '#bdb6a6' : '#b8975e', 1.1);
        A.line(ctx, k ? mm.pt(0.0, 0.5, 0.2) : mm.pt(0.5, 0.0, 0.2), k ? mm.pt(1.0, 0.54, 0.2) : mm.pt(0.54, 1.0, 0.2), sn ? '#bdb6a6' : '#b8975e', 1.1);
        for (i = 0; i < 9; i++) {
          var c = mm.pt(0.08 + r() * 0.84, 0.08 + r() * 0.84, 0.2);
          if (i < 4) A.ellipse(ctx, c[0], c[1], 1.4 + r() * 1.2, 0.7, sn ? '#c8c2b4' : '#b8975e', 0);
          else if (i < 7) A.line(ctx, c, [c[0] + 4, c[1] - 1], sn ? '#e8e2d2' : '#e3c860', 0.8);
          else A.ellipse(ctx, c[0], c[1], 1.6, 0.9, '#8a8478', 0);
        }
      });
    }
  });

  // 廣場旗杆石碑 plaza_center 2x2:圓形石台二階 + 中央高旗杆(紅旗飄動)+ 角落「市」字石碑
  def('plaza_center', {
    w: 2, d: 2, sym: true, hmax: 92, shadow: 'ellipse',
    build: function (m, v) {
      var sn = snowOn(v);
      m.cyl(1.0, 1.0, 0, 0.92, 3, C.stone[0], { topCol: sn || C.stone[1] });
      m.cyl(1.0, 1.0, 3, 0.7, 2.5, C.stone[1], { topCol: sn || C.stone[2], hoops: [1.2] });
      m.cyl(1.0, 1.0, 5.5, 0.16, 5, C.stone[0], { topCol: C.stone[1] });
      m.cyl(1.0, 1.0, 10.5, 0.07, 58, C.wood[1], { topCol: C.gold, hoops: [10, 30, 50] });
      m.box(1.4, 1.3, 5.5, 0.26, 0.14, 24, C.stone[1], { top: sn || C.stone[2], deco: { F: function (ctx, f) { var p = f.pt(0.5, 14); A.glyph(ctx, '市', p[0], p[1], 6, C.hanRed); A.band(ctx, f, 0, 2, C.stone[0]); } } });
      m.box(1.36, 1.26, 29.5, 0.34, 0.22, 3, C.stone[0], { top: C.stone[1] });
    },
    anim: function (ctx, m, t) { var p = m.pt(1.0, 1.0, 69); A.flag(ctx, p[0], p[1] + 26, 0, 22, 13, C.hanRed, t, 0.6); }
  });

  // 叫賣台 vendor_platform 2x1:木台 + 後側貨架(分層擺貨)+ 吆喝木牌 + 櫃面
  def('vendor_platform', {
    w: 2, d: 1, hmax: 52, shadow: 'rect',
    build: function (m, v) {
      var sn = snowOn(v), seed = v.seed || 1;
      m.box(0.05, 0.12, 0, 1.9, 0.82, 5, PLK, { top: sn || PLK_OLD, deco: { F: function (ctx, f) { A.band(ctx, f, 0, 1.6, PLK_DK); } } });
      m.box(0.15, 0.16, 5, 1.7, 0.12, 24, PLK_OLD, { top: PLK, deco: { F: function (ctx, f) {
        A.band(ctx, f, 8, 9.2, PLK_DK); A.band(ctx, f, 15, 16.2, PLK_DK); A.band(ctx, f, 22, 23.2, PLK_DK);
        var r = A.rng(seed), i, cols = ['#d8584a', '#e8c04a', '#6aa0c8', '#8cbf5a', '#c89050', '#f4ead2'];
        for (i = 0; i < 12; i++) { var row = i % 3, s = 0.08 + Math.floor(i / 3) * 0.23 + r() * 0.04, p = f.pt(s, 9.2 + row * 7); A.poly(ctx, [[p[0] - 3.2, p[1]], [p[0] + 3.2, p[1]], [p[0] + 3, p[1] - 5], [p[0] - 3, p[1] - 5]], cols[(i + seed) % 6], 0.4); }
      } } });
      m.box(0.3, 0.62, 5, 1.4, 0.3, 6, PLK, { top: PLK_OLD, deco: { F: function (ctx, f) { A.band(ctx, f, 0, 1.4, PLK_DK); } } });
      jarAt(m, 0.5, 0.72, 4); sackAt(m, 1.3, 0.76, 4);
      m.custom(0.6, 0.1, 0.8, 0.1, 26, function (ctx, mm) {
        if (!A.visible(mm, 'F')) return;
        var a = mm.pt(0.6, 0.13, 31), b = mm.pt(1.4, 0.13, 31);
        A.poly(ctx, [a, b, [b[0], b[1] + 7], [a[0], a[1] + 7]], C.lacquer, 0.7);
        A.glyph(ctx, '貨', (a[0] + b[0]) / 2, a[1] + 3.6, 6, C.gold);
      }, 3);
    },
    lights: function () { return [[1.0, 0.8, 16, 22, C.lamp, 0.45, 'F']]; }
  });

  // 旗幡招牌 banner_wine / banner_cloth / banner_herb 1x1:石座 + 高杆 + 橫桿 + 垂掛長布旗(燕尾)
  function banner(key, o) {
    def(key, {
      w: 1, d: 1, hmax: 70, shadow: 'ellipse',
      build: function (m, v) {
        m.box(0.36, 0.36, 0, 0.28, 0.28, 4, C.stone[1], { top: C.stone[2] });
        m.cyl(0.5, 0.5, 4, 0.045, 52, PLK, { topCol: C.gold, hoops: [10, 30] });
        m.custom(0.1, 0.2, 0.85, 0.6, 30, function (ctx, mm) {
          line3(ctx, mm, [0.5, 0.5, 52], [0.9, 0.5, 52], PLK_DK, 1.6);
          var a = mm.pt(0.54, 0.5, 51), b = mm.pt(0.9, 0.5, 51), c = mm.pt(0.9, 0.5, 12), d = mm.pt(0.54, 0.5, 12);
          var mid = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2 - 7];
          A.poly(ctx, [a, b, c, mid, d], o.cloth, 0.8);
          A.line(ctx, a, b, A.tone(o.cloth, 0.7), 1.6);
          var g = [(a[0] + b[0]) / 2, (a[1] + c[1]) / 2 - 2];
          A.glyph(ctx, o.ch, g[0], g[1] - 5, 8.5, o.ink); A.glyph(ctx, o.ch2, g[0], g[1] + 7, 8.5, o.ink);
          A.line(ctx, [d[0] + 1, d[1] - 1], [d[0] + 1, d[1] - 14], A.tone(o.cloth, 0.78), 0.8);
        }, 3);
      }
    });
  }
  banner('banner_wine', { cloth: '#e9d98a', ink: '#b8322a', ch: '酒', ch2: '旗' });
  banner('banner_cloth', { cloth: '#3e6fb0', ink: '#fbf6e8', ch: '布', ch2: '莊' });
  banner('banner_herb', { cloth: '#f4efdc', ink: '#2f7a4a', ch: '藥', ch2: '鋪' });

  // ---- 地攤:布單鋪在地上,貨品直接擺在布上,無棚;攤主小凳與立牌 ----
  function groundStall(key, o) {
    def(key, {
      w: 1, d: 1, hmax: 44, shadow: 'none',
      build: function (m, v) {
        var seed = v.seed || 1;
        m.custom(0.02, 0.02, 0.96, 0.96, 0, function (ctx, mm) {
          var q = [mm.pt(0.06, 0.1, 0.4), mm.pt(0.94, 0.08, 0.4), mm.pt(0.95, 0.92, 0.4), mm.pt(0.05, 0.94, 0.4)];
          A.poly(ctx, q, o.mat, 0.6);
          A.line(ctx, q[0], q[1], A.tone(o.mat, 0.7), 1.4); A.line(ctx, q[3], q[2], A.tone(o.mat, 0.78), 1.4);
          o.goods(ctx, mm, A.rng(seed + o.salt));
        });
        m.cyl(0.5, 0.06, 0, 0.1, 6, PLK_OLD, { topCol: PLK });
        m.custom(0.86, 0.04, 0.1, 0.1, 0, function (ctx, mm) { var p = mm.pt(0.9, 0.1, 0); A.signFlag(ctx, p[0], p[1], 36, o.sign, o.cloth, o.ink); }, 3);
      },
      lights: function () { return [[0.5, 0.5, 8, 14, C.lamp, 0.35]]; }
    });
  }
  function gp(mm, i, n, row) { return mm.pt(0.2 + (i % n) * (0.6 / (n - 1)), 0.3 + row * 0.3, 0.5); }
  function basket(ctx, p, col, w) { A.ellipse(ctx, p[0], p[1] - 1.5, w || 5.2, 2.6, col || '#b8904a', 0.6); A.ellipse(ctx, p[0], p[1] - 3, (w || 5.2) * 0.8, 1.8, A.tone(col || '#b8904a', 0.75), 0.3); }
  groundStall('ground_veg', { mat: '#b89a68', cloth: '#6aa84a', ink: '#fbf6e8', sign: '菜', salt: 1, goods: function (ctx, mm, r) {
    var i; for (i = 0; i < 6; i++) { var p = gp(mm, i, 3, Math.floor(i / 3)); if (i % 3 === 0) basket(ctx, p, '#b8904a'); A.goods(ctx, 'veg', p[0] + (i % 2 ? 3 : -2), p[1] - 2, i); }
    A.goods(ctx, 'fruit', mm.pt(0.8, 0.8, 0.5)[0], mm.pt(0.8, 0.8, 0.5)[1], 1);
  } });
  groundStall('ground_sandal', { mat: '#c8b898', cloth: '#c89050', ink: '#3b2314', sign: '履', salt: 2, goods: function (ctx, mm, r) {
    for (var i = 0; i < 8; i++) { var p = gp(mm, i, 4, Math.floor(i / 4)); A.ellipse(ctx, p[0] - 2, p[1], 2.1, 4, i % 2 ? '#c8a860' : '#b89448', 0.5); A.ellipse(ctx, p[0] + 2.5, p[1] - 0.5, 2.1, 4, i % 2 ? '#c8a860' : '#b89448', 0.5); A.line(ctx, [p[0] - 2, p[1] - 2], [p[0] + 2.5, p[1] - 2.5], '#7a5a30', 0.8); }
    var q = mm.pt(0.78, 0.78, 0.5); A.ellipse(ctx, q[0], q[1] - 3, 5, 3.2, '#d8c088', 0.5); A.line(ctx, [q[0] - 4, q[1] - 3], [q[0] + 4, q[1] - 3], '#7a5a30', 0.7);
  } });
  groundStall('ground_goods', { mat: '#a89070', cloth: '#d8b86a', ink: '#3b2314', sign: '雜', salt: 3, goods: function (ctx, mm, r) {
    var kinds = ['rice', 'pottery', 'cloth', 'rouge', 'book', 'pottery'];
    for (var i = 0; i < 6; i++) { var p = gp(mm, i, 3, Math.floor(i / 3)); A.goods(ctx, kinds[i], p[0], p[1], i); }
    var c = mm.pt(0.84, 0.82, 0.5); A.circle(ctx, c[0], c[1] - 2, 2.6, C.gold, 0.5);
  } });
  groundStall('ground_bamboo', { mat: '#d8c88a', cloth: BAMBOO, ink: '#25401a', sign: '竹', salt: 4, goods: function (ctx, mm, r) {
    var i, p;
    for (i = 0; i < 4; i++) { p = gp(mm, i, 2, Math.floor(i / 2) * 1.3); basket(ctx, p, '#c8b060', 6); A.line(ctx, [p[0] - 5, p[1] - 3], [p[0] + 5, p[1] - 3], '#8a7430', 0.7); }
    p = mm.pt(0.52, 0.5, 0.5); A.ellipse(ctx, p[0], p[1] - 2, 8, 3.8, '#e0d090', 0.6); A.ellipse(ctx, p[0], p[1] - 2, 5, 2.2, '#c8b060', 0.3);
    for (i = 0; i < 3; i++) A.line(ctx, mm.pt(0.76 + i * 0.05, 0.3, 0.5), mm.pt(0.78 + i * 0.05, 0.85, 0.5), '#8fb84a', 2);
  } });
  groundStall('ground_pottery', { mat: '#a89880', cloth: '#c79650', ink: '#3b2314', sign: '陶', salt: 5, goods: function (ctx, mm, r) {
    for (var i = 0; i < 5; i++) { var p = gp(mm, i, 3, Math.floor(i / 3)); A.goods(ctx, 'pottery', p[0], p[1] + 2, i); if (i % 2) A.goods(ctx, 'pottery', p[0] + 4, p[1] + 4, i); }
    var q = mm.pt(0.8, 0.82, 0.5); A.ellipse(ctx, q[0], q[1] - 2, 5, 2.4, '#d8c4a0', 0.5); A.ellipse(ctx, q[0], q[1] - 3.6, 4.4, 2, '#c8b490', 0.5);
  } });
  groundStall('ground_cloth', { mat: '#c8bca4', cloth: '#7a5cc8', ink: '#fbf6e8', sign: '布', salt: 6, goods: function (ctx, mm, r) {
    for (var i = 0; i < 6; i++) { var p = gp(mm, i, 3, Math.floor(i / 3)); A.goods(ctx, 'cloth', p[0], p[1], i); A.goods(ctx, 'cloth', p[0], p[1] - 4, i + 2); }
    var q = mm.pt(0.8, 0.84, 0.5); A.line(ctx, [q[0] - 5, q[1] - 2], [q[0] + 5, q[1] - 4], '#fbf1dc', 3);
  } });
  groundStall('ground_iron', { mat: '#5e5a56', cloth: '#6a6e78', ink: '#fbf6e8', sign: '鐵', salt: 7, goods: function (ctx, mm, r) {
    var i, p;
    for (i = 0; i < 2; i++) { p = gp(mm, i * 2, 3, 0); A.ellipse(ctx, p[0], p[1] - 3, 6, 3, '#3a3a42', 0.7); A.ellipse(ctx, p[0], p[1] - 4.6, 4.6, 2, '#1f1f26', 0.4); }
    for (i = 0; i < 3; i++) { p = gp(mm, i, 3, 1); A.line(ctx, [p[0] - 4, p[1] + 2], [p[0] + 4, p[1] - 4], PLK, 1.6); A.poly(ctx, [[p[0] + 2, p[1] - 5], [p[0] + 7, p[1] - 4], [p[0] + 5, p[1] - 1]], '#9aa0aa', 0.6); }
    p = mm.pt(0.78, 0.82, 0.5); for (i = 0; i < 5; i++) A.circle(ctx, p[0] - 3 + i * 1.6, p[1] - 1 - (i % 2), 1, '#c8ccd2');
  } });
  groundStall('ground_old', { mat: '#9a8a74', cloth: '#a89080', ink: '#2b1d1b', sign: '舊', salt: 8, goods: function (ctx, mm, r) {
    var p = gp(mm, 0, 3, 0); A.circle(ctx, p[0], p[1] - 3, 3.6, C.gold, 0.7); A.circle(ctx, p[0], p[1] - 3, 1.6, '#e8c860', 0);
    p = gp(mm, 1, 3, 0); A.goods(ctx, 'book', p[0], p[1], 1);
    p = gp(mm, 2, 3, 0); A.ellipse(ctx, p[0], p[1] - 2, 4, 2, '#e8e0d0', 0.6); A.ellipse(ctx, p[0], p[1] - 3.4, 3, 1.4, '#c8c0b0', 0.4);
    p = gp(mm, 0, 3, 1); A.goods(ctx, 'pottery', p[0], p[1] + 2, 1);
    p = gp(mm, 1, 3, 1); A.ellipse(ctx, p[0], p[1] - 1.5, 6, 2, '#a04a3a', 0.6); A.line(ctx, [p[0] - 6, p[1] - 3], [p[0] + 6, p[1] - 3], '#e8d8a8', 1.4);
    p = gp(mm, 2, 3, 1); A.poly(ctx, [[p[0] - 3, p[1]], [p[0] + 3, p[1]], [p[0] + 2, p[1] - 6], [p[0] - 2, p[1] - 6]], '#6a8a9a', 0.6);
    p = mm.pt(0.8, 0.84, 0.5); A.ellipse(ctx, p[0], p[1] - 2, 4.6, 2.2, '#5a4a3a', 0.5);
  } });

  // 貨郎擔 hawker_carrier 1x1(靜態):木架上擱著扁擔,兩頭各吊一只貨箱,頂上插撥浪鼓與小旗
  def('hawker_carrier', {
    w: 1, d: 1, hmax: 44, shadow: 'ellipse',
    build: function (m, v) {
      m.custom(0, 0.1, 1, 0.8, 0, function (ctx, mm) {
        line3(ctx, mm, [0.5, 0.5, 15], [0.35, 0.3, 0], PLK_DK, 1.8); line3(ctx, mm, [0.5, 0.5, 15], [0.65, 0.3, 0], PLK_DK, 1.8); line3(ctx, mm, [0.5, 0.5, 15], [0.5, 0.78, 0], PLK_DK, 1.8);
        line3(ctx, mm, [0.04, 0.5, 18], [0.96, 0.5, 18], BAMBOO_DK, 2.2);
        line3(ctx, mm, [0.18, 0.5, 18], [0.18, 0.5, 12], '#c8a868', 0.8); line3(ctx, mm, [0.82, 0.5, 18], [0.82, 0.5, 12], '#c8a868', 0.8);
      }, 1);
      m.box(0.06, 0.4, 2, 0.26, 0.2, 10, PLK, { top: PLK_OLD, deco: { F: function (ctx, f) { A.band(ctx, f, 5, 6, PLK_DK); A.poly(ctx, A.quad(f, 0.3, 0.7, 2, 4), '#e8c04a', 0.3); } } });
      m.box(0.68, 0.4, 2, 0.26, 0.2, 10, PLK, { top: PLK_OLD, deco: { F: function (ctx, f) { A.band(ctx, f, 5, 6, PLK_DK); A.poly(ctx, A.quad(f, 0.3, 0.7, 2, 4), '#d8584a', 0.3); } } });
      m.custom(0.3, 0.4, 0.4, 0.2, 18.5, function (ctx, mm) {
        var d = mm.pt(0.5, 0.5, 26); A.circle(ctx, d[0], d[1], 3.4, '#d8584a', 0.7); A.circle(ctx, d[0], d[1], 1.4, '#f4e0a0', 0);
        A.line(ctx, mm.pt(0.5, 0.5, 18), d, C.ink, 1.4);
        var p = mm.pt(0.85, 0.5, 18); A.line(ctx, p, [p[0], p[1] - 14], C.ink, 1.2);
        A.poly(ctx, [[p[0], p[1] - 14], [p[0] + 8, p[1] - 11], [p[0], p[1] - 8]], C.hanRed, 0.5);
      }, 2);
    }
  });

  // 藝人圈地 perform_ring 3x3:木樁圍繩的表演場 + 紅毯 + 鑼架 + 大鼓 + 長凳
  def('perform_ring', {
    w: 3, d: 3, hmax: 40, shadow: 'none',
    build: function (m, v) {
      var N = 12, i, pegs = [], ca = 1.5, cb = 1.5, R = 1.32;
      for (i = 0; i < N; i++) { var a = i / N * Math.PI * 2; pegs.push([ca + Math.cos(a) * R, cb + Math.sin(a) * R]); }
      m.custom(0, 0, 3, 3, 0, function (ctx, mm) {
        var pts = [], k;
        for (k = 0; k < 24; k++) { var b = k / 24 * Math.PI * 2; pts.push(mm.pt(ca + Math.cos(b) * (R - 0.08), cb + Math.sin(b) * (R - 0.08), 0.2)); }
        A.poly(ctx, pts, v.season === 'winter' ? '#e0d8d0' : '#d9bf88', 0);
        var pts2 = [];
        for (k = 0; k < 20; k++) { var b2 = k / 20 * Math.PI * 2; pts2.push(mm.pt(ca + Math.cos(b2) * 0.62, cb + Math.sin(b2) * 0.46, 0.4)); }
        A.poly(ctx, pts2, '#b8322a', 0.6);
        A.line(ctx, mm.pt(ca - 0.5, cb, 0.4), mm.pt(ca + 0.5, cb, 0.4), '#e8c04a', 1.2);
      }, 0);
      pegs.forEach(function (p) { m.cyl(p[0], p[1], 0, 0.05, 11, PLK, { topCol: PLK_OLD }); });
      m.custom(0, 0, 3, 3, 9, function (ctx, mm) {
        for (var k = 0; k < N; k++) { var a = pegs[k], b = pegs[(k + 1) % N]; A.line(ctx, mm.pt(a[0], a[1], 9), mm.pt(b[0], b[1], 8.4), C.ink, 1.8); A.line(ctx, mm.pt(a[0], a[1], 9), mm.pt(b[0], b[1], 8.4), '#c8a868', 0.9); }
      }, 0);
      m.box(0.2, 1.3, 0, 0.14, 0.06, 20, PLK_DK); m.box(0.55, 1.3, 0, 0.14, 0.06, 20, PLK_DK);
      m.custom(0.15, 1.2, 0.6, 0.3, 20, function (ctx, mm) {
        line3(ctx, mm, [0.2, 1.33, 20], [0.7, 1.33, 20], PLK, 1.6);
        var c = mm.pt(0.45, 1.33, 14); A.circle(ctx, c[0], c[1], 5.6, '#d8a840', 0.9); A.circle(ctx, c[0], c[1], 2.2, '#f0cc70', 0.4);
      }, 2);
      m.cyl(2.5, 1.5, 0, 0.2, 10, '#a05a30', { topCol: '#f0d8a0', hoops: [3, 7] });
      m.box(1.1, 2.85, 0, 0.8, 0.12, 5, PLK, { top: PLK_OLD }); m.box(0.9, 2.82, 5, 0.04, 0.04, 0, PLK_DK);
    }
  });

  // 說書台 storyteller 2x1:木台 + 紅布屏風寫「書」+ 長案(醒木、茶壺)+ 小凳,台前旗牌
  def('storyteller', {
    w: 2, d: 1, hmax: 56, shadow: 'rect',
    build: function (m, v) {
      var sn = snowOn(v);
      m.box(0.06, 0.1, 0, 1.88, 0.85, 4, PLK, { top: sn || PLK_OLD, deco: { F: function (ctx, f) { A.band(ctx, f, 0, 1.6, PLK_DK); } } });
      m.box(0.2, 0.14, 4, 1.6, 0.08, 30, C.hanRed, { top: C.lacquer, deco: { F: function (ctx, f) { A.posts(ctx, f, [0, 1], 0.08, C.lacquer); A.band(ctx, f, 26, 30, C.lacquer); var p = f.pt(0.5, 14); A.glyph(ctx, '書', p[0], p[1], 11, C.gold); } } });
      m.box(0.7, 0.42, 4, 0.6, 0.34, 11, C.lacquer, { top: '#4a2a22', deco: { F: function (ctx, f) { A.band(ctx, f, 0, 1.5, C.wood[0]); A.poly(ctx, A.quad(f, 0.1, 0.9, 5, 10), C.hanRed, 0.4); } } });
      m.box(0.92, 0.52, 15, 0.14, 0.08, 2, PLK_DK, { top: PLK }); m.cyl(1.12, 0.6, 15, 0.06, 4, '#e8e0d0', { topCol: '#ffffff' });
      m.cyl(0.4, 0.8, 4, 0.1, 6, PLK_OLD, { topCol: PLK });
      [0.4, 0.9, 1.4, 1.75].forEach(function (u) { if (u > 0.5) m.cyl(u, 1.18, 0, 0.1, 5, PLK_OLD, { topCol: PLK }); });
    },
    lights: function () { return [[1.0, 0.8, 16, 22, C.lamp, 0.45, 'F']]; }
  });

  // 告示牌 notice_board 2x1:兩柱木牌 + 層疊榜單 + 朱印 + 小簷
  def('notice_board', {
    w: 2, d: 1, hmax: 50, shadow: 'rect',
    build: function (m, v) {
      var sn = snowOn(v), seed = v.seed || 1;
      m.box(0.16, 0.42, 0, 0.12, 0.12, 36, PLK_DK, { top: PLK }); m.box(1.72, 0.42, 0, 0.12, 0.12, 36, PLK_DK, { top: PLK });
      m.box(0.1, 0.46, 12, 1.8, 0.08, 22, PLK_OLD, { top: PLK, deco: { F: function (ctx, f) {
        var r = A.rng(seed), i;
        for (i = 0; i < 5; i++) {
          var s = 0.06 + i * 0.185 + r() * 0.02, z0 = 3 + r() * 3, h = 10 + r() * 6;
          A.poly(ctx, A.quad(f, s, s + 0.15, z0, z0 + h), A.tone('#f4ead2', f.light), 0.5);
          for (var k = 0; k < 4; k++) A.line(ctx, f.pt(s + 0.02, z0 + h - 3 - k * 2.6), f.pt(s + 0.13, z0 + h - 3 - k * 2.6), A.tone('#6a5a4a', f.light), 0.6);
          if (i % 2 === 0) { var q = f.pt(s + 0.075, z0 + 2.5); A.circle(ctx, q[0], q[1], 1.6, C.hanRed); }
        }
        var t = f.pt(0.5, 21); A.glyph(ctx, '告示', t[0], t[1], 5, C.gold);
      } } });
      m.gable(0.0, 0.38, 34, 2, 0.28, 7, GREY_TILE, { over: 0.1, overEnd: 0.1, curl: 1.5, sag: 0.5, ridgeCol: GREY_TILE_DK, snow: sn, end: false, hooks: false });
    }
  });

  // 拴馬樁與馬槽 hitching_post 2x1:兩根雕頂木樁 + 長槽(草料)+ 馬一匹
  def('hitching_post', {
    w: 2, d: 1, hmax: 46, shadow: 'rect',
    build: function (m, v) {
      m.box(0.35, 0.58, 0, 1.3, 0.3, 7, PLK, { top: '#a89048', deco: { F: function (ctx, f) { A.band(ctx, f, 0, 1.6, PLK_DK); A.posts(ctx, f, [0.05, 0.95], 0.07, PLK_DK); } } });
      m.custom(0.4, 0.62, 1.2, 0.22, 7.5, function (ctx, mm) {
        for (var i = 0; i < 6; i++) { var p = mm.pt(0.55 + i * 0.2, 0.75, 7.5); A.line(ctx, p, [p[0] + 3, p[1] - 2.5], '#d8b860', 1); }
      }, 1);
      [0.18, 1.82].forEach(function (u) {
        m.cyl(u, 0.3, 0, 0.07, 24, PLK_DK, { topCol: PLK, hoops: [14] });
        m.cyl(u, 0.3, 24, 0.09, 3, C.gold, { topCol: '#ffe28a' });
      });
      m.custom(0.1, 0.1, 1.8, 0.4, 20, function (ctx, mm) { line3(ctx, mm, [0.18, 0.3, 19], [1.82, 0.3, 17], '#c8a868', 1.1); }, 2);
      animal(m, 'horse', 1.0, 0.36, 0.8);
    }
  });

  // 水缸 water_vat 1x1:大陶缸 + 木蓋與瓢 + 旁邊一只小缸
  def('water_vat', {
    w: 1, d: 1, hmax: 28, shadow: 'ellipse',
    build: function (m, v) {
      var sn = snowOn(v);
      m.cyl(0.4, 0.44, 0, 0.3, 16, '#8a7664', { topCol: sn || '#2c4a5a', hoops: [4, 11] });
      m.cyl(0.4, 0.44, 15.5, 0.33, 2, '#7a6654', { topCol: sn || '#2c4a5a' });
      m.custom(0.1, 0.1, 0.8, 0.8, 17, function (ctx, mm) {
        var p = mm.pt(0.34, 0.4, 17.5); A.ellipse(ctx, p[0], p[1], 7, 3, 'rgba(255,255,255,0.35)', 0);
        var q = mm.pt(0.62, 0.52, 17.6); A.ellipse(ctx, q[0], q[1], 3.2, 1.6, PLK, 0.6); A.line(ctx, q, [q[0] + 9, q[1] - 4], PLK_DK, 1.4);
      }, 1);
      m.cyl(0.8, 0.8, 0, 0.14, 9, '#8a7664', { topCol: '#4a3a30', hoops: [3] });
    }
  });

  // 牲畜交易圍欄 livestock_pen 3x2:木欄圍場(前側留門)+ 牛 / 羊 / 豬 + 草料與食槽
  def('livestock_pen', {
    w: 3, d: 2, hmax: 40, shadow: 'none',
    build: function (m, v) {
      var seed = v.seed || 1, sn = v.season === 'winter';
      m.custom(0, 0, 3, 2, 0, function (ctx, mm) {
        A.poly(ctx, [mm.pt(0.08, 0.08, 0.2), mm.pt(2.92, 0.08, 0.2), mm.pt(2.92, 1.92, 0.2), mm.pt(0.08, 1.92, 0.2)], sn ? '#e4e0d8' : '#d6bd86', 0);
        for (var i = 0; i < 6; i++) { var c = mm.pt(0.3 + i * 0.45, 0.4 + (i % 3) * 0.55, 0.3); A.line(ctx, c, [c[0] + 4, c[1] - 1], '#e0c860', 0.9); }
      }, 0);
      var P = [], i;
      for (i = 0; i <= 6; i++) P.push([0.08 + i * 0.473, 0.08]);
      for (i = 1; i <= 3; i++) { P.push([0.08, 0.08 + i * 0.61]); P.push([2.92, 0.08 + i * 0.61]); }
      m.custom(0.0, 0.0, 3, 0.2, 0, function (ctx, mm) {
        for (var k = 0; k < P.length; k++) if (P[k][1] === 0.08) { A.line(ctx, mm.pt(P[k][0], 0.08, 0), mm.pt(P[k][0], 0.08, 15), C.ink, 3); A.line(ctx, mm.pt(P[k][0], 0.08, 0), mm.pt(P[k][0], 0.08, 15), PLK, 1.7); }
        [5, 11].forEach(function (z) { A.line(ctx, mm.pt(0.08, 0.08, z), mm.pt(2.92, 0.08, z), C.ink, 2.6); A.line(ctx, mm.pt(0.08, 0.08, z), mm.pt(2.92, 0.08, z), PLK_OLD, 1.4); });
      }, 0);
      m.custom(0.0, 0.0, 0.2, 2, 0, function (ctx, mm) {
        [0.08, 0.69, 1.3, 1.92].forEach(function (y) { A.line(ctx, mm.pt(0.08, y, 0), mm.pt(0.08, y, 15), C.ink, 3); A.line(ctx, mm.pt(0.08, y, 0), mm.pt(0.08, y, 15), PLK, 1.7); });
        [5, 11].forEach(function (z) { A.line(ctx, mm.pt(0.08, 0.08, z), mm.pt(0.08, 1.92, z), C.ink, 2.6); A.line(ctx, mm.pt(0.08, 0.08, z), mm.pt(0.08, 1.92, z), PLK_OLD, 1.4); });
      }, 0);
      m.custom(2.8, 0.0, 0.2, 2, 0, function (ctx, mm) {
        [0.08, 0.69, 1.3, 1.92].forEach(function (y) { A.line(ctx, mm.pt(2.92, y, 0), mm.pt(2.92, y, 15), C.ink, 3); A.line(ctx, mm.pt(2.92, y, 0), mm.pt(2.92, y, 15), PLK, 1.7); });
        [5, 11].forEach(function (z) { A.line(ctx, mm.pt(2.92, 0.08, z), mm.pt(2.92, 1.92, z), C.ink, 2.6); A.line(ctx, mm.pt(2.92, 0.08, z), mm.pt(2.92, 1.92, z), PLK_OLD, 1.4); });
      }, 0);
      animal(m, 'ox', 0.7, 0.8, 0.8); animal(m, seed % 2 ? 'sheep' : 'goat', 1.5, 0.7, 0.85); animal(m, 'sheep', 1.9, 1.0, 0.8); animal(m, 'pig', 2.4, 0.8, 0.85);
      m.box(1.0, 1.25, 0, 0.8, 0.2, 5, PLK, { top: '#a89048', deco: { F: function (ctx, f) { A.band(ctx, f, 0, 1.4, PLK_DK); } } });
      m.custom(0.0, 1.8, 3, 0.2, 0, function (ctx, mm) {
        [0.08, 0.4, 2.2, 2.92].forEach(function (x) { A.line(ctx, mm.pt(x, 1.92, 0), mm.pt(x, 1.92, 15), C.ink, 3); A.line(ctx, mm.pt(x, 1.92, 0), mm.pt(x, 1.92, 15), PLK, 1.7); });
        [5, 11].forEach(function (z) { A.line(ctx, mm.pt(0.08, 1.92, z), mm.pt(0.4, 1.92, z), PLK_OLD, 1.4); A.line(ctx, mm.pt(2.2, 1.92, z), mm.pt(2.92, 1.92, z), PLK_OLD, 1.4); });
        A.line(ctx, mm.pt(2.2, 1.92, 5), mm.pt(1.75, 1.7, 5), PLK_OLD, 1.4); A.line(ctx, mm.pt(2.2, 1.92, 11), mm.pt(1.75, 1.7, 11), PLK_OLD, 1.4);
      }, 0);
    }
  });

  // 打鐵鋪棚 smith_awning 2x2:四柱草頂敞棚 + 石爐(炭火)+ 鐵砧樹墩 + 水槽 + 農具架
  def('smith_awning', {
    w: 2, d: 2, hmax: 62, shadow: 'rect',
    build: function (m, v) {
      var sn = snowOn(v);
      m.box(0.1, 0.1, 0, 1.8, 1.8, 1, '#6a6458', { top: '#6a6458' });
      [[0.14, 0.18], [1.78, 0.18], [0.14, 1.72], [1.78, 1.72]].forEach(function (p) { m.box(p[0], p[1], 1, 0.1, 0.1, 30, PLK_DK, { top: PLK }); });
      m.box(0.3, 0.2, 1, 1.0, 0.5, 14, C.stone[0], { top: '#3a3430', deco: { F: function (ctx, f) { A.band(ctx, f, 0, 2, C.stone[1]); A.poly(ctx, A.quad(f, 0.3, 0.7, 2, 8), A.state.lit ? '#ffb040' : '#1d1614', 0.5); } } });
      m.cyl(1.0, 0.45, 15, 0.1, 16, C.stone[0], { topCol: INKB });
      m.cyl(1.2, 1.15, 1, 0.17, 8, PLK, { topCol: PLK_OLD });
      m.box(1.07, 1.07, 9, 0.28, 0.16, 4, '#3a3a44', { top: '#6a6a74' });
      m.box(0.2, 1.5, 1, 0.5, 0.22, 6, PLK, { top: '#2c4a5a' });
      m.box(1.5, 0.2, 1, 0.1, 0.5, 22, PLK, { top: PLK_OLD, deco: { R: function (ctx, f) { for (var i = 0; i < 4; i++) A.line(ctx, f.pt(0.15 + i * 0.22, 6), f.pt(0.15 + i * 0.22 + 0.06, 18), '#aab0ba', 1.6); } } });
      m.cone(1.65, 1.55, 1, 0.18, 7, '#2a2630', {});
      m.hip(0.0, 0.0, 31, 2, 2, 11, STRAW_OLD, { over: 0.2, curl: 0, sag: 1.4, hipK: 0.7, tileDensity: 8, ridgeCol: STRAW_DK, eaveCol: STRAW_DK, hooks: false, snow: sn });
    },
    lights: function () { return [[0.8, 0.7, 7, 22, C.fire, 0.8, 'F']]; },
    anim: function (ctx, m, t) {
      var f = m.pt(0.8, 0.72, 4);
      A.fire(ctx, f[0], f[1], t, 0.8);
      var s = m.pt(1.0, 0.45, 50); A.smoke(ctx, s[0], s[1], t, 0.8);
    }
  });

  // 剃頭挑子 barber_stand 1x1:一頭是小木櫃(抽屜、朱紅漆),一頭是燒水小爐與銅壺,中間小凳
  def('barber_stand', {
    w: 1, d: 1, hmax: 44, shadow: 'ellipse',
    build: function (m, v) {
      m.box(0.1, 0.18, 0, 0.3, 0.3, 18, PLK, { top: PLK_OLD, deco: { F: function (ctx, f) { A.band(ctx, f, 6, 7, PLK_DK); A.poly(ctx, A.quad(f, 0.15, 0.85, 8, 15), C.hanRed, 0.4); A.line(ctx, f.pt(0.5, 8), f.pt(0.5, 15), PLK_DK, 0.8); A.band(ctx, f, 0, 2, PLK_DK); } } });
      m.cyl(0.78, 0.34, 0, 0.14, 11, '#6a5a52', { topCol: INKB, hoops: [5] });
      m.cyl(0.78, 0.34, 11, 0.11, 6, '#b88a4a', { topCol: '#d8aa66', hoops: [3] });
      m.cyl(0.46, 0.76, 0, 0.12, 7, PLK_OLD, { topCol: PLK });
      m.custom(0.05, 0.1, 0.9, 0.7, 19, function (ctx, mm) {
        line3(ctx, mm, [0.2, 0.33, 18], [0.78, 0.34, 17], BAMBOO_DK, 1.8);
        line3(ctx, mm, [0.2, 0.33, 18], [0.2, 0.33, 40], PLK_DK, 1.6);
        var p = mm.pt(0.2, 0.33, 40);
        A.poly(ctx, [[p[0], p[1]], [p[0] + 9, p[1] + 2], [p[0], p[1] + 8]], C.hanRed, 0.6);
        var q = mm.pt(0.36, 0.7, 7.4); A.ellipse(ctx, q[0], q[1], 3, 1.4, '#f4f0e0', 0.4);
      }, 2);
    },
    anim: function (ctx, m, t) { var p = m.pt(0.78, 0.34, 20); A.smoke(ctx, p[0], p[1], t, 0.3); }
  });

  // 命相攤 fortune_stall 1x1:朱紅長案(垂布寫「命」)+ 簽筒 + 龜甲 + 客座 + 紅傘「卜」字立牌
  def('fortune_stall', {
    w: 1, d: 1, hmax: 56, shadow: 'ellipse',
    build: function (m, v) {
      m.box(0.16, 0.22, 0, 0.62, 0.34, 11, C.hanRed, { top: '#4a2a22', deco: { F: function (ctx, f) { A.poly(ctx, A.quad(f, 0.05, 0.95, 0, 11), '#f4ead2', 0.5); var p = f.pt(0.5, 5.5); A.glyph(ctx, '命', p[0], p[1], 8, C.hanRed); A.band(ctx, f, 9.5, 11, C.hanRed); } } });
      m.cyl(0.32, 0.38, 11, 0.07, 5, BAMBOO_DK, { topCol: BAMBOO });
      m.cyl(0.6, 0.36, 11, 0.11, 1.4, '#6a8a5a', { topCol: '#8aaa6a' });
      m.cyl(0.5, 0.78, 0, 0.11, 6, PLK_OLD, { topCol: PLK });
      m.cyl(0.84, 0.28, 0, 0.04, 40, PLK_DK, { topCol: C.gold });
      m.custom(0.4, 0.0, 0.7, 0.6, 38, function (ctx, mm) {
        var c = mm.pt(0.84, 0.28, 44), rx = 17;
        A.poly(ctx, [[c[0] - rx, c[1] + 5], [c[0], c[1] - 6], [c[0] + rx, c[1] + 5], [c[0] + rx * 0.5, c[1] + 7], [c[0], c[1] + 5], [c[0] - rx * 0.5, c[1] + 7]], C.hanRed, 0.8);
        A.line(ctx, [c[0], c[1] - 6], [c[0], c[1] + 5], A.tone(C.hanRed, 0.65), 0.8);
        A.glyph(ctx, '卜', c[0], c[1] + 14, 7.5, C.lacquer);
      }, 3);
    }
  });

  // 小吃擔:餛飩擔 / 胡餅攤 / 湯餅擔 —— 爐火 + 大鍋 / 泥爐 + 碗碟 + 小桌凳 + 招牌
  function foodStall(key, o) {
    def(key, {
      w: 1, d: 1, hmax: 56, shadow: 'ellipse',
      build: function (m, v) {
        var sn = snowOn(v);
        if (o.oven) {
          m.cyl(0.32, 0.3, 0, 0.24, 11, '#b8683a', { topCol: '#8a4a28', hoops: [4] });
          m.cone(0.32, 0.3, 11, 0.22, 9, '#a85a30', {});
          m.custom(0.1, 0.1, 0.5, 0.5, 4, function (ctx, mm) { if (!A.visible(mm, 'F')) return; var p = mm.pt(0.32, 0.56, 5); A.poly(ctx, [[p[0] - 4, p[1] + 4], [p[0] - 4, p[1] - 3], [p[0], p[1] - 6], [p[0] + 4, p[1] - 3], [p[0] + 4, p[1] + 4]], A.state.lit ? '#ffb040' : '#1d1614', 0.5); }, 2);
        } else {
          m.cyl(0.3, 0.3, 0, 0.17, 9, '#a0603a', { topCol: '#3a2a22', hoops: [3] });
          m.cyl(0.3, 0.3, 9, 0.2, 5, '#3a3a42', { topCol: o.broth, hoops: [2] });
        }
        m.box(0.58, 0.14, 0, 0.36, 0.3, 8, PLK, { top: PLK_OLD, deco: { F: function (ctx, f) { A.band(ctx, f, 0, 1.4, PLK_DK); } } });
        m.custom(0.55, 0.1, 0.4, 0.4, 8, function (ctx, mm) {
          var i, p;
          for (i = 0; i < 3; i++) {
            p = mm.pt(0.64 + i * 0.12, 0.3, 8.4);
            if (o.oven) { A.ellipse(ctx, p[0], p[1] - 1, 4, 1.8, '#e8c474', 0.5); A.circle(ctx, p[0] - 1, p[1] - 1.2, 0.5, '#fff0c8'); A.circle(ctx, p[0] + 1.2, p[1] - 0.8, 0.5, '#fff0c8'); }
            else { A.ellipse(ctx, p[0], p[1] - 1.2, 2.8, 1.5, '#6aa0c8', 0.5); A.ellipse(ctx, p[0], p[1] - 2, 2, 0.9, '#f4efe0'); }
          }
        }, 2);
        m.cyl(0.3, 0.8, 0, 0.1, 5, PLK_OLD, { topCol: PLK }); m.cyl(0.74, 0.76, 0, 0.1, 5, PLK_OLD, { topCol: PLK });
        m.custom(0.78, 0.5, 0.2, 0.3, 0, function (ctx, mm) { var p = mm.pt(0.9, 0.55, 0); A.signFlag(ctx, p[0], p[1], 40, o.sign, o.cloth, o.ink); }, 3);
        if (o.noodle) m.custom(0.0, 0.0, 1, 0.3, 14, function (ctx, mm) {
          line3(ctx, mm, [0.05, 0.12, 24], [0.5, 0.12, 24], BAMBOO_DK, 1.4);
          for (var i = 0; i < 5; i++) A.line(ctx, mm.pt(0.1 + i * 0.08, 0.12, 24), mm.pt(0.1 + i * 0.08, 0.12, 14), '#f4ead0', 0.9);
        }, 2);
      },
      lights: function () { return [[0.3, 0.45, 8, 16, C.fire, 0.5, 'F']]; },
      anim: function (ctx, m, t) {
        var p = m.pt(0.3, o.oven ? 0.56 : 0.3, o.oven ? 5 : 15);
        if (o.oven) A.fire(ctx, p[0], p[1] + 2, t, 0.45);
        A.smoke(ctx, p[0], p[1] - (o.oven ? 8 : 0), t, o.salt);
      }
    });
  }
  foodStall('food_wonton', { broth: '#e8e0c8', cloth: '#f4efdc', ink: '#c0392b', sign: '餛', salt: 1.2 });
  foodStall('food_hubing', { oven: true, cloth: '#e8b84a', ink: '#7a2a1a', sign: '餅', salt: 2.2 });
  foodStall('food_noodle', { broth: '#d8b868', cloth: '#d8584a', ink: '#fbf6e8', sign: '湯', salt: 3.2, noodle: true });

  // ---------------- 建築選單條目(OBJECTS)與標籤 ----------------
  // crowd:'poor'|'common'|'rich'(住戶階級)/ 'market'(市集人潮)/ 'hawker'(叫賣者);crowdW:該物件對路人生成的權重;tier:房屋階級 0~4;walk:true = 地面鋪面(路人可踩過)
  function item(name, icon, w, h, coin, crowd, crowdW, o) {
    o = o || {};
    var r = {
      name: name, icon: icon, w: w, h: h,
      on: o.on || [T_GRASS, T_ROAD],
      cost: { coin: coin }, side: 'estate',
      cb: { block: 'none', hp: null, cat: null },
      crowd: crowd, crowdW: crowdW
    };
    if (o.drag) r.drag = true;
    if (o.tier !== undefined) r.tier = o.tier;
    if (o.walk) r.walk = true;
    if (w !== h) r.swap = true;
    return r;
  }
  var DRAG = { drag: true };
  var DEF_ITEMS = {
    // 民居(破舊 → 豪門)
    hut_ruin: item('破舊老屋', '🛖', 2, 2, 40, 'poor', 2, { tier: 0, on: [T_GRASS] }),
    hut_mud: item('夯土矮屋', '🏚️', 2, 2, 50, 'poor', 2, { tier: 0, on: [T_GRASS] }),
    hut_plank: item('木板民居', '🏠', 2, 2, 70, 'poor', 2, { tier: 1, on: [T_GRASS] }),
    hut_collapsed: item('半塌老屋', '🧱', 2, 2, 30, 'poor', 3, { tier: 0, on: [T_GRASS] }),
    shack_lean: item('窩棚', '⛺', 1, 1, 15, 'poor', 3, { tier: 0, drag: true }),
    cave_dwelling: item('窯洞', '🕳️', 2, 1, 60, 'poor', 2, { tier: 0 }),
    bamboo_house: item('竹樓', '🎍', 2, 2, 90, 'common', 2, { tier: 1, on: [T_GRASS] }),
    house_tile: item('瓦頂人家', '🏘️', 2, 2, 120, 'common', 3, { tier: 2, on: [T_GRASS] }),
    house_gentry: item('鄉紳宅', '🏡', 3, 3, 380, 'rich', 3, { tier: 3, on: [T_GRASS] }),
    mansion_great: item('豪門大院', '🏯', 4, 5, 1200, 'rich', 5, { tier: 4, on: [T_GRASS] }),
    mansion_clan: item('世家宅邸', '🏛️', 4, 4, 1500, 'rich', 5, { tier: 4, on: [T_GRASS] }),
    manor_estate: item('莊園', '🌾', 5, 5, 2400, 'rich', 6, { tier: 4, on: [T_GRASS] }),
    // 貧民區裝飾
    yard_poor: item('院落', '🪵', 2, 2, 35, 'poor', 1, { on: [T_GRASS] }),
    wall_ruin: item('圍牆殘段', '🧱', 1, 1, 6, 'poor', 1, DRAG),
    gate_wicker: item('柴扉', '🚪', 1, 1, 8, 'poor', 1, DRAG),
    fence_broken: item('破籬笆', '🪵', 1, 1, 4, 'poor', 1, DRAG),
    well_old: item('井台舊石', '⚱️', 1, 1, 30, 'poor', 2, DRAG),
    rack_net: item('曬網架', '🕸️', 2, 1, 25, 'poor', 1),
    rack_cloth: item('曬衣架', '👕', 2, 1, 22, 'poor', 1),
    shed_livestock: item('牲口棚', '🐂', 2, 1, 45, 'poor', 2),
    junk_pile: item('雜物堆', '🗑️', 1, 1, 6, 'poor', 1, DRAG),
    tree_dead: item('枯樹', '🌲', 1, 1, 8, 'poor', 1, DRAG),
    // 市集廣場
    plaza_stone: item('石板廣場', '⬜', 1, 1, 8, 'market', 1, { drag: true, walk: true }),
    plaza_earth: item('夯土廣場', '🟫', 1, 1, 4, 'market', 1, { drag: true, walk: true }),
    plaza_center: item('廣場旗杆石碑', '🚩', 2, 2, 150, 'market', 4),
    vendor_platform: item('叫賣台', '📣', 2, 1, 70, 'market', 4),
    banner_wine: item('酒旗', '🍶', 1, 1, 20, 'market', 2, DRAG),
    banner_cloth: item('布旗', '🏳️', 1, 1, 20, 'market', 2, DRAG),
    banner_herb: item('藥旗', '🌿', 1, 1, 20, 'market', 2, DRAG),
    // 地攤(擺地上、無棚)
    ground_veg: item('蔬果地攤', '🥬', 1, 1, 12, 'hawker', 3, DRAG),
    ground_sandal: item('草鞋地攤', '👡', 1, 1, 10, 'hawker', 3, DRAG),
    ground_goods: item('雜貨地攤', '🧺', 1, 1, 14, 'hawker', 3, DRAG),
    ground_bamboo: item('竹編地攤', '🎋', 1, 1, 14, 'hawker', 3, DRAG),
    ground_pottery: item('陶器地攤', '🏺', 1, 1, 16, 'hawker', 3, DRAG),
    ground_cloth: item('布匹地攤', '🧵', 1, 1, 16, 'hawker', 3, DRAG),
    ground_iron: item('鐵器地攤', '🔧', 1, 1, 18, 'hawker', 3, DRAG),
    ground_old: item('舊貨地攤', '📿', 1, 1, 14, 'hawker', 3, DRAG),
    hawker_carrier: item('貨郎擔', '🪘', 1, 1, 18, 'hawker', 4, DRAG),
    // 市集設施
    perform_ring: item('藝人圈地', '🎪', 3, 3, 120, 'market', 5),
    storyteller: item('說書台', '🎙️', 2, 1, 80, 'market', 4),
    notice_board: item('告示牌', '📜', 2, 1, 40, 'market', 3),
    hitching_post: item('拴馬樁與馬槽', '🐴', 2, 1, 45, 'market', 2),
    water_vat: item('水缸', '🪣', 1, 1, 12, 'market', 1, DRAG),
    livestock_pen: item('牲畜交易圍欄', '🐑', 3, 2, 110, 'market', 4),
    smith_awning: item('打鐵鋪棚', '⚒️', 2, 2, 130, 'hawker', 4),
    barber_stand: item('剃頭挑子', '💈', 1, 1, 20, 'hawker', 3, DRAG),
    fortune_stall: item('命相攤', '🔮', 1, 1, 22, 'hawker', 3, DRAG),
    food_wonton: item('餛飩擔', '🥟', 1, 1, 22, 'hawker', 4, DRAG),
    food_hubing: item('胡餅攤', '🫓', 1, 1, 22, 'hawker', 4, DRAG),
    food_noodle: item('湯餅擔', '🍜', 1, 1, 22, 'hawker', 4, DRAG)
  };
  Object.keys(DEF_ITEMS).forEach(function (k) { ITEMS[k] = DEF_ITEMS[k]; });
  if (typeof OBJECTS !== 'undefined' && typeof T_GRASS !== 'undefined') {
    Object.keys(ITEMS).forEach(function (k) { if (!OBJECTS[k]) OBJECTS[k] = ITEMS[k]; });
  }
  A.TOWN_ITEMS = ITEMS;
})(ART);
