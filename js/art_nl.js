// art_nl.js — 無等級版新建築美術(PLAN_NOLEVEL 附錄 A「建」類 + PLAN_TECHTREE「新美術」類),共 30 件,皆為新 key,不覆寫既有定義。
// 依賴 art.js、art_objects.js 先載入;物件資料(尺寸、成本、分類)在 js/nl_objects.js,解鎖歸屬在 js/nolevel_data.js。
// 朝向規則同 art_deco5:Model 以局部 (u,v) 繪製,v = 深度、正面在 v = D;非正方形者在 nl_objects.js 設 swap:true。
// 帶動畫者(anim(ctx, m, t, v) 連續時間 t):浴堂 / 造紙坊 / 瓷窯(煙)、翻車、水排冶鐵坊、渾天儀臺、井渠、市樓(旗)、亭舍(旗)。
// seed 規則:v.seed 經 A.rng 只影響瓦色明暗、旗色與小物擺位,同 seed 同畫面。

(function (A) {
  var C = A.C;
  var TILE = '#6f7f88', TILE_DK = '#4d5c64', TILE_GREEN = '#5f7f6a', RED = '#d23a2c', WATER = '#4a90b8', WATER_LT = '#8cc4e0';
  var PLASTER = '#eadfc4', EARTH = '#b69a6e', SNOW = '#f7fbff';

  function sn(v) { return v && v.season === 'winter'; }
  function rnd(v) { return A.rng((v && v.seed) || 1); }
  function tile(v, col) { var r = rnd(v)(); return A.tone(col || TILE, 0.94 + r * 0.12); }
  // 正面匾額(寫在 v = D 的前牆面上,u 置中)
  function plaque(m, W, D, z, ch, ink, bg) {
    m.custom(W / 2 - 0.3, D - 0.1, 0.6, 0.06, z, function (ctx, mm) {
      if (!A.visible(mm, 'F')) return;
      var a = mm.pt(W / 2 - 0.26, D - 0.08, z), b = mm.pt(W / 2 + 0.26, D - 0.08, z);
      A.poly(ctx, [[a[0], a[1]], [b[0], b[1]], [b[0], b[1] - 7], [a[0], a[1] - 7]], bg || C.lacquer, 0.7);
      A.glyph(ctx, ch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 3.5, 6, ink || C.gold);
    }, 6);
  }
  // 通用殿堂:石基 + 粉牆(格窗、門)+ 廡殿 / 懸山頂,可疊第二層。o: W D bh wh rise wall tile floors sign door lat extra roof
  function hall(m, v, o) {
    var W = o.W, D = o.D, bh = o.bh === undefined ? 3 : o.bh, wh = o.wh || 22, wall = o.wall || PLASTER, rise = o.rise || 11;
    var tl = tile(v, o.tile), z = bh, nl = o.lat || Math.max(2, Math.round(W) + 1), door = o.door === undefined ? 0.5 : o.door;
    m.box(0.02, 0.02, 0, W - 0.04, D - 0.04, bh, C.stone[1], { top: C.stone[2] });
    m.box(0.12, 0.12, z, W - 0.24, D - 0.24, wh, wall, { deco: {
      F: function (ctx, f) {
        A.band(ctx, f, 0, 2, C.wood[0]); A.posts(ctx, f, [0, 1], 2.4, C.wood[0]);
        var i, sc;
        for (i = 0; i < nl; i++) {
          sc = (i + 0.5) / nl;
          if (door !== false && Math.abs(sc - door) < 0.5 / nl + 0.04) continue;
          A.lattice(ctx, f, sc, Math.min(7, f.len / (nl + 1.4)), 6, Math.min(10, wh - 9), C.wood[1]);
        }
        if (door !== false) A.door(ctx, f, door, 7, Math.min(14, wh - 6), C.lacquer);
      },
      R: function (ctx, f) { A.band(ctx, f, 0, 2, C.wood[0]); A.posts(ctx, f, [0, 1], 2.4, C.wood[0]); A.lattice(ctx, f, 0.5, 7, 6, Math.min(10, wh - 9), C.wood[1]); }
    } });
    z += wh;
    if (o.floors === 2) {
      var iu = 0.3, iv = 0.3, wh2 = o.wh2 || 16;
      m.hip(0.0, 0.0, z, W, D, 4, tl, { over: 0.18, curl: 1.5, sag: 0.8, axis: W >= D ? 'u' : 'v', hipK: 0.5, ridgeCol: TILE_DK, snow: sn(v), hookSize: 2 });
      z += 3;
      m.box(iu, iv, z, W - 2 * iu, D - 2 * iv, wh2, wall, { deco: {
        F: function (ctx, f) { A.band(ctx, f, 0, 2, C.wood[0]); A.posts(ctx, f, [0, 1], 2.2, C.wood[0]); A.lattice(ctx, f, 0.3, 6, 4, 8, C.wood[1]); A.lattice(ctx, f, 0.7, 6, 4, 8, C.wood[1]); },
        R: function (ctx, f) { A.band(ctx, f, 0, 2, C.wood[0]); A.posts(ctx, f, [0, 1], 2.2, C.wood[0]); }
      } });
      m.hip(iu, iv, z + wh2, W - 2 * iu, D - 2 * iv, rise, tl, { over: 0.2, curl: 2.5, sag: 1.2, axis: W >= D ? 'u' : 'v', hipK: 0.5, ridgeCol: TILE_DK, ridgeHi: C.gold, snow: sn(v), hookSize: 3 });
      z += wh2 + rise;
    } else {
      m.hip(0.0, 0.0, z, W, D, rise, tl, { over: 0.2, curl: o.roof === 'flat' ? 0 : 2, sag: 1, axis: W >= D ? 'u' : 'v', hipK: 0.5, ridgeCol: TILE_DK, ridgeHi: o.hi, snow: sn(v), hookSize: 3 });
      z += rise;
    }
    if (o.sign) plaque(m, W, D, bh + wh * 0.82, o.sign, o.ink, o.bg);
    if (o.extra) o.extra(m, v, z);
    return z;
  }
  function litF(W, D, z) { return function () { return [[W / 2, D - 0.1, z, 22, C.lamp, 0.55, 'F']]; }; }
  // 立旗(用於市樓、亭舍):旗桿在局部 (u, v),高 h
  function flagAt(m, u, v, h, col, ch, ink) {
    m.custom(u - 0.05, v - 0.05, 0.1, 0.1, 0, function (ctx, mm) { var p = mm.pt(u, v, 0); A.signFlag(ctx, p[0], p[1], h, ch, col, ink || C.gold); }, 3);
  }
  function chimney(m, u, v, z, h) {
    m.box(u, v, z, 0.16, 0.16, h, C.stone[1], { top: C.stone[0] });
  }
  function smokeAnim(u, v, z, seed) { return function (ctx, m, t) { var p = m.pt(u, v, z); A.smoke(ctx, p[0], p[1], t, seed || 1); }; }
  function def(key, W, D, hmax, build, o) {
    o = o || {};
    A.def(key, { w: W, d: D, hmax: hmax, shadow: o.shadow || 'rect', sym: o.sym, build: build, lights: o.lights, anim: o.anim });
  }

  // ---------- 教化 / 官署 ----------
  def('jingshe', 3, 2, 62, function (m, v) { hall(m, v, { W: 3, D: 2, wh: 24, rise: 12, sign: '精', door: 0.5 }); }, { lights: litF(3, 2, 14) });
  def('xue_she', 3, 2, 64, function (m, v) {
    hall(m, v, { W: 3, D: 2, wh: 24, rise: 12, sign: '學', wall: '#e4d6b4', tile: TILE_GREEN, extra: function (mm, vv, z) {
      mm.box(0.5, 1.5, 3, 0.1, 0.1, 40, C.wood[0]); mm.box(2.4, 1.5, 3, 0.1, 0.1, 40, C.wood[0]);
    } });
  }, { lights: litF(3, 2, 14) });
  def('xue_gong', 3, 3, 104, function (m, v) {
    m.box(0.0, 0.0, 0, 3, 3, 5, C.stone[1], { top: C.stone[2] });
    m.box(0.2, 0.2, 5, 2.6, 2.6, 2, C.stone[2], { top: C.stone[2] });
    hall(m, v, { W: 2.6, D: 2.6, bh: 0, wh: 22, rise: 10, floors: 2, wh2: 16, sign: '宮', tile: TILE, hi: C.gold });
  }, { lights: litF(3, 3, 14) });
  def('xian_ya', 3, 3, 84, function (m, v) {
    m.box(0.0, 0.0, 0, 3, 3, 4, C.stone[1], { top: C.stone[2] });
    // 兩廂 + 正堂:正堂居後
    m.box(0.15, 0.15, 4, 2.7, 1.3, 24, PLASTER, { deco: {
      F: function (ctx, f) { A.band(ctx, f, 0, 2, C.wood[0]); A.posts(ctx, f, [0, 0.33, 0.67, 1], 2.4, C.lacquer); A.door(ctx, f, 0.5, 9, 15, C.lacquer); A.lattice(ctx, f, 0.17, 6, 6, 9, C.wood[1]); A.lattice(ctx, f, 0.83, 6, 6, 9, C.wood[1]); },
      R: function (ctx, f) { A.band(ctx, f, 0, 2, C.wood[0]); A.posts(ctx, f, [0, 1], 2.4, C.lacquer); }
    } });
    m.hip(0.15, 0.15, 28, 2.7, 1.3, 13, tile(v), { over: 0.22, curl: 3, sag: 1.2, axis: 'u', hipK: 0.5, ridgeCol: TILE_DK, ridgeHi: C.gold, snow: sn(v), hookSize: 3 });
    m.box(0.15, 1.7, 4, 0.9, 1.1, 12, PLASTER);
    m.hip(0.15, 1.7, 16, 0.9, 1.1, 6, tile(v, TILE_DK), { over: 0.12, curl: 1, sag: 0.5, axis: 'v', snow: sn(v), hookSize: 2 });
    m.box(2.0, 1.7, 4, 0.9, 1.1, 12, PLASTER);
    m.hip(2.0, 1.7, 16, 0.9, 1.1, 6, tile(v, TILE_DK), { over: 0.12, curl: 1, sag: 0.5, axis: 'v', snow: sn(v), hookSize: 2 });
    // 鳴冤鼓與旗
    m.cyl(1.5, 2.35, 4, 0.14, 7, C.lacquer, { topCol: '#e8d8b0', hoops: [2, 5] });
    plaque(m, 3, 1.45, 24, '衙', C.gold);
  }, { lights: litF(3, 3, 14) });
  def('shi_lou', 2, 2, 110, function (m, v) {
    hall(m, v, { W: 1.7, D: 1.7, bh: 3, wh: 24, rise: 10, floors: 2, wh2: 18, sign: '市', door: false, lat: 3, tile: TILE, hi: C.gold, wall: '#e8d0a0',
      extra: function (mm, vv, z) { mm.cone(0.85, 0.85, z, 0.08, 6, C.gold); } });
    flagAt(m, 1.85, 1.85, 56, RED, '市', C.gold);
    m.custom(0.1, 1.7, 1.5, 0.1, 18, function (ctx, mm) { var p = mm.pt(0.3, 1.74, 28); A.lantern(ctx, p[0], p[1], 1.1); var q = mm.pt(1.4, 1.74, 28); A.lantern(ctx, q[0], q[1], 1.1); }, 4);
  }, { lights: function () { return [[0.3, 1.74, 24, 22, C.lantern, 0.9, 'F'], [1.4, 1.74, 24, 22, C.lantern, 0.9, 'F']]; },
    anim: function (ctx, m, t, v) { var p = m.pt(1.85, 1.85, 0), r = rnd(v)(); A.line(ctx, [p[0] + 1.5, p[1] - 54], [p[0] + 10 + Math.sin(t * 3 + r * 6) * 1.8, p[1] - 51], 'rgba(255,240,200,0.5)', 1); } });
  def('ting_she', 2, 2, 66, function (m, v) {
    hall(m, v, { W: 1.7, D: 1.7, wh: 22, rise: 9, sign: '亭', lat: 2, tile: TILE_DK, wall: '#d9c9a0' });
    flagAt(m, 1.85, 0.2, 52, '#3e6fb0', '亭', '#fff6d6');
    m.cyl(0.2, 1.85, 3, 0.1, 6, C.bronze, { topCol: C.stone[2] });
  }, { lights: litF(2, 2, 14), anim: function (ctx, m, t) { var p = m.pt(1.85, 0.2, 0); A.line(ctx, [p[0] + 1.5, p[1] - 50], [p[0] + 9 + Math.sin(t * 4) * 1.6, p[1] - 47], 'rgba(255,255,255,0.35)', 1); } });
  def('li_men', 2, 1, 62, function (m, v) {
    var tl = tile(v);
    m.box(0.0, 0.25, 0, 0.3, 0.5, 40, C.wood[1], { top: C.wood[2] });
    m.box(1.7, 0.25, 0, 0.3, 0.5, 40, C.wood[1], { top: C.wood[2] });
    m.box(0.0, 0.2, 40, 2.0, 0.6, 5, C.wood[0], { top: C.wood[1] });
    m.hip(0.0, 0.2, 45, 2.0, 0.6, 9, tl, { over: 0.15, curl: 2, sag: 0.8, axis: 'u', hipK: 0.4, ridgeCol: TILE_DK, snow: sn(v), hookSize: 2 });
    m.box(0.3, 0.4, 0, 0.14, 0.14, 38, C.lacquer); m.box(1.56, 0.4, 0, 0.14, 0.14, 38, C.lacquer);
    plaque(m, 2, 0.8, 41, '里', C.gold);
  }, { lights: function () { return [[1, 0.8, 34, 20, C.lantern, 0.6, 'F']]; } });
  def('gong_men', 3, 2, 108, function (m, v) {
    var tl = tile(v, TILE_DK);
    m.box(0.0, 0.0, 0, 3, 2, 6, C.stone[1], { top: C.stone[2] });
    m.box(0.0, 0.3, 6, 1.0, 1.4, 44, '#b83a2c', { top: C.stone[2] });
    m.box(2.0, 0.3, 6, 1.0, 1.4, 44, '#b83a2c', { top: C.stone[2] });
    m.hip(0.0, 0.3, 50, 1.0, 1.4, 12, tl, { over: 0.15, curl: 2.5, sag: 1, axis: 'v', hipK: 0.5, ridgeCol: TILE_DK, ridgeHi: C.gold, snow: sn(v), hookSize: 3 });
    m.hip(2.0, 0.3, 50, 1.0, 1.4, 12, tl, { over: 0.15, curl: 2.5, sag: 1, axis: 'v', hipK: 0.5, ridgeCol: TILE_DK, ridgeHi: C.gold, snow: sn(v), hookSize: 3 });
    m.box(1.0, 0.45, 6, 1.0, 1.1, 34, '#a8362a', { deco: {
      F: function (ctx, f) { A.band(ctx, f, 0, 3, C.wood[0]); A.door(ctx, f, 0.5, 16, 26, C.lacquer); }, R: function (ctx, f) { A.band(ctx, f, 0, 3, C.wood[0]); }
    } });
    m.hip(0.85, 0.3, 40, 1.3, 1.4, 11, tl, { over: 0.2, curl: 3, sag: 1.2, axis: 'u', hipK: 0.5, ridgeCol: TILE_DK, ridgeHi: C.gold, snow: sn(v), hookSize: 3 });
    plaque(m, 3, 1.7, 36, '闕', C.gold);
  }, { lights: function () { return [[1.5, 1.6, 20, 24, C.lantern, 0.8, 'F']]; } });

  // ---------- 民生 ----------
  def('yu_tang', 2, 2, 70, function (m, v) {
    hall(m, v, { W: 2, D: 2, wh: 20, rise: 10, sign: '浴', door: 0.3, lat: 2, wall: '#d8c8a2', extra: function (mm, vv, z) { chimney(mm, 1.5, 0.3, z - 14, 24); } });
    m.cyl(1.55, 1.5, 3, 0.2, 5, WATER, { topCol: WATER_LT });
  }, { lights: litF(2, 2, 12), anim: smokeAnim(1.58, 0.38, 62, 2) });
  def('tai_yi_shu', 3, 2, 66, function (m, v) {
    hall(m, v, { W: 3, D: 2, wh: 24, rise: 12, sign: '醫', tile: TILE_GREEN, wall: '#efe6cf', ink: '#fff', bg: '#2f7a4a', extra: function (mm, vv, z) {
      mm.cyl(0.35, 1.8, 3, 0.2, 8, '#7a5a34', { topCol: '#3f6a34' }); mm.cyl(2.6, 1.8, 3, 0.2, 8, '#7a5a34', { topCol: '#3f6a34' });
    } });
    m.custom(1.3, 1.9, 0.4, 0.08, 18, function (ctx, mm) {
      if (!A.visible(mm, 'F')) return; var p = mm.pt(1.5, 1.95, 22);
      A.poly(ctx, [[p[0] - 2, p[1] - 7], [p[0] + 2, p[1] - 7], [p[0] + 2, p[1] - 2], [p[0] + 7, p[1] - 2], [p[0] + 7, p[1] + 2], [p[0] + 2, p[1] + 2], [p[0] + 2, p[1] + 7], [p[0] - 2, p[1] + 7], [p[0] - 2, p[1] + 2], [p[0] - 7, p[1] + 2], [p[0] - 7, p[1] - 2], [p[0] - 2, p[1] - 2]], '#d23a2c', 0.4);
    }, 8);
  }, { lights: litF(3, 2, 14) });
  def('wanghuo_lou', 1, 1, 96, function (m, v) {
    m.box(0.12, 0.12, 0, 0.76, 0.76, 6, C.stone[1], { top: C.stone[2] });
    [[0.2, 0.2], [0.72, 0.2], [0.2, 0.72], [0.72, 0.72]].forEach(function (p) { m.box(p[0], p[1], 6, 0.08, 0.08, 44, C.wood[0]); });
    m.box(0.14, 0.14, 24, 0.72, 0.72, 2, C.wood[1]);
    m.box(0.1, 0.1, 50, 0.8, 0.8, 3, C.wood[1], { top: C.wood[2] });
    m.hip(0.06, 0.06, 53, 0.88, 0.88, 12, tile(v), { over: 0.1, curl: 2, sag: 0.6, hipK: 0.5, ridgeCol: TILE_DK, snow: sn(v), hookSize: 2 });
    m.cyl(0.5, 0.5, 53, 0.08, 9, C.bronze, { topCol: C.gold });
    m.cyl(0.3, 0.78, 6, 0.1, 8, C.lacquer, { topCol: '#4a90b8', hoops: [3] });
  }, { shadow: 'ellipse', lights: function () { return [[0.5, 0.5, 50, 20, C.lamp, 0.6, 'F']]; } });
  def('cao_cang', 3, 2, 70, function (m, v) {
    var tl = tile(v, TILE_DK);
    m.box(0.02, 0.02, 0, 2.96, 1.96, 8, C.stone[1], { top: C.stone[2] });
    m.box(0.15, 0.15, 8, 2.7, 1.7, 22, '#c9b48a', { deco: {
      F: function (ctx, f) { A.band(ctx, f, 0, 3, C.wood[0]); A.posts(ctx, f, [0, 0.33, 0.67, 1], 2.6, C.wood[0]); A.door(ctx, f, 0.5, 12, 16, C.wood[1]); A.lattice(ctx, f, 0.17, 5, 20, 6, C.wood[1]); A.lattice(ctx, f, 0.83, 5, 20, 6, C.wood[1]); },
      R: function (ctx, f) { A.band(ctx, f, 0, 3, C.wood[0]); A.posts(ctx, f, [0, 1], 2.6, C.wood[0]); }
    } });
    m.hip(0.0, 0.0, 30, 3, 2, 14, tl, { over: 0.2, curl: 2, sag: 1.2, axis: 'u', hipK: 0.5, ridgeCol: TILE_DK, snow: sn(v), hookSize: 3 });
    plaque(m, 3, 1.9, 28, '漕', C.gold);
    m.cyl(2.7, 1.8, 8, 0.1, 2.6, '#e3c98a', { topCol: '#f3e2b4' }); m.cyl(2.55, 1.65, 8, 0.1, 2.6, '#e3c98a', { topCol: '#f3e2b4' });
  }, { lights: litF(3, 2, 18) });
  def('changping_cang', 2, 2, 72, function (m, v) {
    var tl = tile(v, TILE_DK);
    m.box(0.02, 0.02, 0, 1.96, 1.96, 7, C.stone[1], { top: C.stone[2] });
    m.box(0.14, 0.14, 7, 1.72, 1.72, 22, '#d0bc90', { deco: {
      F: function (ctx, f) { A.band(ctx, f, 0, 3, C.wood[0]); A.door(ctx, f, 0.5, 12, 16, C.wood[1]); A.lattice(ctx, f, 0.16, 5, 20, 5, C.wood[1]); A.lattice(ctx, f, 0.84, 5, 20, 5, C.wood[1]); },
      R: function (ctx, f) { A.band(ctx, f, 0, 3, C.wood[0]); A.lattice(ctx, f, 0.5, 5, 20, 5, C.wood[1]); }
    } });
    m.gable(0.0, 0.0, 29, 2, 2, 13, tl, { over: 0.18, curl: 1, sag: 0.8, axis: 'u', ridgeCol: TILE_DK, snow: sn(v), hookSize: 2 });
    plaque(m, 2, 1.9, 20, '平', C.gold, '#8a2a20');
  }, { lights: litF(2, 2, 14) });
  def('wen_shi', 2, 2, 46, function (m, v) {
    m.box(0.04, 0.04, 0, 1.92, 1.92, 9, EARTH, { top: sn(v) ? SNOW : '#5a3e26' });
    m.gable(0.0, 0.0, 9, 2, 2, 20, '#efe3bd', { over: 0.04, curl: 0, sag: 0, axis: 'u', ridgeCol: C.wood[1], snow: sn(v), tiles: false, hooks: false });
    m.custom(0.1, 1.9, 1.8, 0.1, 8, function (ctx, mm) {
      if (!A.visible(mm, 'F')) return;
      for (var i = 0; i < 4; i++) { var a = mm.pt(0.25 + i * 0.5, 1.96, 8), b = mm.pt(0.45 + i * 0.5, 1.96, 8); A.poly(ctx, [a, b, [b[0], b[1] - 5], [a[0], a[1] - 5]], '#4f9a3c', 0.3); }
    }, 5);
  }, { lights: function () { return [[1, 1.9, 8, 18, '#cfe8a0', 0.4, 'F']]; } });
  def('jing_qu', 2, 2, 40, function (m, v) {
    m.box(0.0, 0.5, 0, 2, 0.6, 2, C.stone[1], { top: C.stone[2] });
    m.box(0.1, 0.6, 2, 1.8, 0.4, 0.8, WATER, { top: WATER_LT });
    m.cyl(1.5, 1.45, 0, 0.42, 9, C.stone[1], { topCol: C.stone[2], hoops: [4.5] });
    m.cyl(1.5, 1.45, 9, 0.3, 0.6, WATER, { topCol: WATER_LT });
    m.box(0.3, 1.2, 0, 0.1, 0.1, 22, C.wood[0]); m.box(1.7, 1.2, 0, 0.1, 0.1, 22, C.wood[0]); m.box(0.28, 1.2, 22, 1.5, 0.1, 2, C.wood[1]);
    m.box(0.2, 1.5, 0, 0.8, 0.3, 4, C.stone[2], { top: C.stone[2] });
  }, { lights: function () { return []; }, anim: function (ctx, m, t) {
    for (var i = 0; i < 4; i++) { var p = (t * 0.5 + i / 4) % 1, a = m.pt(0.1 + p * 1.7, 0.8, 3); A.circle(ctx, a[0], a[1], 1.2, WATER_LT, 0); }
    var c = m.pt(1.5, 1.45, 9.8); ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(c[0], c[1], 7 + Math.sin(t * 3) * 2, 3.5 + Math.sin(t * 3), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  } });
  def('shui_xie', 2, 2, 70, function (m, v) {
    m.cyl(1, 1, 0, 0.98, 2, WATER, { topCol: WATER_LT });
    m.box(0.3, 0.3, 2, 1.4, 1.4, 4, C.wood[1], { top: C.wood[2] });
    [[0.4, 0.4], [1.5, 0.4], [0.4, 1.5], [1.5, 1.5]].forEach(function (p) { m.box(p[0], p[1], 6, 0.09, 0.09, 26, C.lacquer); });
    m.box(0.36, 0.36, 12, 1.28, 1.28, 1.6, C.wood[0], { top: C.wood[2] });
    m.hip(0.2, 0.2, 32, 1.6, 1.6, 14, tile(v, TILE_GREEN), { over: 0.15, curl: 3, sag: 1.2, hipK: 0.5, ridgeCol: TILE_DK, ridgeHi: C.gold, snow: sn(v), hookSize: 3 });
    m.cyl(1, 1, 46, 0.06, 6, C.gold);
  }, { shadow: 'ellipse', lights: function () { return [[1, 1.7, 22, 20, C.lantern, 0.6, 'F']]; } });
  def('lou_che_fang', 2, 2, 56, function (m, v) {
    m.box(0.04, 0.04, 0, 1.92, 1.92, 4, C.stone[1], { top: C.stone[2] });
    [[0.12, 0.12], [1.76, 0.12], [0.12, 1.76], [1.76, 1.76]].forEach(function (p) { m.box(p[0], p[1], 4, 0.1, 0.1, 26, C.wood[0]); });
    m.box(0.2, 0.15, 4, 1.6, 0.5, 10, C.wood[1], { top: C.wood[2] });
    m.hip(0.0, 0.0, 30, 2, 2, 10, tile(v, '#8a6a46'), { over: 0.18, curl: 1, sag: 0.8, hipK: 0.5, ridgeCol: C.wood[0], snow: sn(v), hookSize: 2, tiles: false });
    // 耬車:車架 + 三根耬腳 + 種斗
    m.custom(0.4, 0.9, 1.2, 0.8, 4, function (ctx, mm) {
      var a = mm.pt(0.5, 1.4, 12), b = mm.pt(1.5, 1.4, 12);
      A.line(ctx, a, b, C.ink, 3.4); A.line(ctx, a, b, C.wood[2], 1.8);
      [0.6, 1.0, 1.4].forEach(function (u) { var t = mm.pt(u, 1.4, 12), d = mm.pt(u, 1.55, 3); A.line(ctx, t, d, C.wood[0], 1.6); A.poly(ctx, [[t[0] - 2.5, t[1] - 5], [t[0] + 2.5, t[1] - 5], [t[0] + 1.5, t[1]], [t[0] - 1.5, t[1]]], C.bronze, 0.4); });
      var w1 = mm.pt(0.45, 1.4, 6), w2 = mm.pt(1.55, 1.4, 6); A.circle(ctx, w1[0], w1[1], 5, C.wood[1], 0.7); A.circle(ctx, w2[0], w2[1], 5, C.wood[1], 0.7);
    }, 3);
  }, { lights: function () { return []; } });

  // ---------- 工坊 ----------
  function workshop(key, o) {
    def(key, 2, 2, o.hmax || 70, function (m, v) {
      hall(m, v, { W: 2, D: 2, wh: 20, rise: 10, sign: o.sign, wall: o.wall, tile: o.tile, ink: o.ink, bg: o.bg, door: 0.3, lat: 2, extra: o.extra });
      if (o.flag) flagAt(m, 1.85, 1.85, 44, o.flag, o.sign, o.ink || C.gold);
      if (o.goods) o.goods(m, v);
    }, { lights: litF(2, 2, 12), anim: o.anim });
  }
  workshop('zao_zhi', { sign: '紙', wall: '#e8dcc0', flag: '#f2ead0', ink: '#6b4a2a', goods: function (m) {
    m.box(1.2, 1.3, 0, 0.7, 0.5, 5, '#6a8a8a', { top: '#a9c9c4' }); m.box(1.3, 1.4, 5, 0.5, 0.3, 1, '#f5efdc');
  }, extra: function (m, v, z) { chimney(m, 1.55, 0.3, z - 12, 22); }, anim: smokeAnim(1.63, 0.38, 60, 3) });
  workshop('qi_qi_fang', { sign: '漆', wall: '#e0cfa8', flag: '#7a1f18', bg: '#7a1f18', goods: function (m) {
    m.cyl(1.4, 1.5, 0, 0.13, 6, '#7a1f18', { topCol: '#c93a2a', hoops: [2] }); m.cyl(1.65, 1.6, 0, 0.1, 4, C.lacquer, { topCol: '#c93a2a' });
  } });
  workshop('jin_fang', { sign: '錦', wall: '#e8d8b0', flag: '#8a4b7c', bg: '#8a4b7c', goods: function (m) {
    m.box(1.2, 1.35, 0, 0.6, 0.4, 7, C.wood[1]); m.box(1.2, 1.3, 7, 0.6, 0.1, 1, '#e8b24a'); m.box(1.2, 1.45, 7, 0.6, 0.1, 1, '#3e6fb0');
  } });
  workshop('yu_qi_fang', { sign: '玉', wall: '#e8e4d0', tile: TILE_GREEN, flag: '#4a9a7a', bg: '#2f6a58', goods: function (m) {
    m.cyl(1.4, 1.5, 0, 0.14, 5, C.stone[1], { topCol: '#9ed2b2' }); m.cyl(1.7, 1.6, 0, 0.09, 3, C.stone[1], { topCol: '#c6e6d0' });
  } });
  workshop('yin_lou', { sign: '銀', wall: '#ece3cd', flag: '#aab4bc', bg: '#555e66', ink: '#f2f6f8', goods: function (m) {
    m.box(1.3, 1.35, 0, 0.5, 0.35, 6, C.wood[0]); m.cyl(1.55, 1.52, 6, 0.1, 2, '#c8d0d6', { topCol: '#eef2f4' });
  } });
  workshop('ci_yao', { sign: '瓷', wall: '#d9c6a0', flag: '#cfe2e6', bg: '#4a7a8a', ink: '#ffffff', hmax: 84, extra: function (m, v, z) {
    m.cyl(1.5, 0.45, 0, 0.3, 40, '#a8704a', { topCol: '#6a3e26', hoops: [14, 28] });
  }, anim: function (ctx, m, t) {
    var p = m.pt(1.5, 0.45, 40); A.smoke(ctx, p[0], p[1], t, 4); A.fire(ctx, m.pt(1.5, 0.8, 4)[0], m.pt(1.5, 0.8, 4)[1], t, 0.5);
  } });
  def('jiang_zuo', 3, 2, 76, function (m, v) {
    hall(m, v, { W: 3, D: 2, wh: 24, rise: 12, sign: '匠', wall: '#d8c498', tile: TILE_DK, door: 0.5, lat: 4 });
    m.box(0.15, 1.55, 3, 0.5, 0.3, 3, C.wood[2]); m.box(0.2, 1.55, 6, 0.4, 0.25, 3, C.wood[1]); m.box(2.3, 1.58, 3, 0.5, 0.24, 8, C.wood[1]);
    m.custom(2.3, 1.1, 0.6, 0.5, 3, function (ctx, mm) { var a = mm.pt(2.35, 1.2, 11), b = mm.pt(2.7, 1.2, 14); A.line(ctx, a, b, C.ink, 2.6); A.line(ctx, a, b, C.bronze, 1.2); }, 3);
  }, { lights: litF(3, 2, 14) });
  def('shui_pai', 3, 2, 80, function (m, v) {
    hall(m, v, { W: 2.2, D: 2, wh: 22, rise: 10, sign: '冶', wall: '#bda88a', tile: TILE_DK, door: 0.35, lat: 2, extra: function (mm, vv, z) { chimney(mm, 1.5, 0.4, z - 14, 26); } });
    m.box(2.35, 0.2, 0, 0.5, 1.6, 4, C.stone[1], { top: WATER });
    m.box(2.4, 0.25, 4, 0.1, 0.1, 30, C.wood[0]); m.box(2.4, 1.65, 4, 0.1, 0.1, 30, C.wood[0]);
    m.custom(2.35, 0.3, 0.5, 1.4, 4, function (ctx, mm) { A.disc(ctx, mm, 2.45, 1.0, 20, 18, 'v', C.wood[1]); A.disc(ctx, mm, 2.45, 1.0, 20, 14, 'v', A.tone(C.wood[1], 0.82), 0.4); }, 2);
  }, { lights: function () { return [[1.1, 1.9, 12, 24, '#ffb060', 0.8, 'F']]; }, anim: function (ctx, m, t) {
    var c = m.pt(2.45, 1.0, 20);
    for (var k = 0; k < 6; k++) { var a = t * 1.6 + k * Math.PI / 3; A.line(ctx, c, m.pt(2.45, 1.0 + Math.cos(a) * 17 / 34, 20 + Math.sin(a) * 17), C.wood[2], 2); }
    var s = m.pt(1.5, 0.48, 50); A.smoke(ctx, s[0], s[1], t, 5);
    var f = m.pt(1.2, 1.7, 8); A.fire(ctx, f[0], f[1], t, 0.45);
  } });
  def('fan_che', 1, 2, 30, function (m, v) {
    m.box(0.3, 0.08, 0, 0.4, 1.84, 3, C.wood[1], { top: WATER });
    m.box(0.26, 0.08, 3, 0.08, 1.84, 4, C.wood[0]); m.box(0.66, 0.08, 3, 0.08, 1.84, 4, C.wood[0]);
    m.box(0.2, 0.0, 0, 0.12, 0.12, 14, C.wood[0]); m.box(0.68, 0.0, 0, 0.12, 0.12, 14, C.wood[0]);
    m.box(0.2, 1.88, 0, 0.12, 0.12, 20, C.wood[0]); m.box(0.68, 1.88, 0, 0.12, 0.12, 20, C.wood[0]);
    m.box(0.18, 1.86, 20, 0.64, 0.16, 2, C.wood[1]);
  }, { shadow: 'rect', lights: function () { return []; }, anim: function (ctx, m, t) {
    var i, p, a, b;
    for (i = 0; i < 6; i++) { p = (t * 0.45 + i / 6) % 1; a = m.pt(0.5, 0.2 + p * 1.6, 6.5 + p * 12); A.poly(ctx, [[a[0] - 3, a[1]], [a[0] + 3, a[1]], [a[0] + 3, a[1] - 3], [a[0] - 3, a[1] - 3]], C.wood[2], 0.4); }
    b = m.pt(0.5, 1.94, 20); A.circle(ctx, b[0], b[1] - 2, 2.2 + Math.sin(t * 4) * 0.4, WATER_LT, 0);
  } });

  // ---------- 禮制 / 觀測 / 防禦 ----------
  def('hun_tian', 2, 2, 74, function (m, v) {
    m.box(0.1, 0.1, 0, 1.8, 1.8, 6, C.stone[1], { top: C.stone[2] });
    m.box(0.3, 0.3, 6, 1.4, 1.4, 4, C.stone[2], { top: C.stone[2] });
    m.cyl(1, 1, 10, 0.12, 20, C.bronze, { topCol: C.gold });
    m.custom(0.2, 0.2, 1.6, 1.6, 20, function (ctx, mm) {
      var c = mm.pt(1, 1, 30); ctx.save(); ctx.strokeStyle = C.bronze; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(c[0], c[1], 20, 20, 0, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = C.gold; ctx.stroke(); ctx.restore();
    }, 2);
  }, { shadow: 'ellipse', lights: function () { return []; }, anim: function (ctx, m, t) {
    var c = m.pt(1, 1, 30); ctx.save(); ctx.strokeStyle = C.gold; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(c[0], c[1], 7 + 13 * Math.abs(Math.cos(t * 0.9)), 20, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = C.bronze; ctx.beginPath(); ctx.ellipse(c[0], c[1], 20, 4 + 16 * Math.abs(Math.sin(t * 0.7)), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    A.circle(ctx, c[0], c[1], 2.2, C.gold, 0.4);
  } });
  def('di_dong', 1, 1, 60, function (m, v) {
    m.box(0.1, 0.1, 0, 0.8, 0.8, 4, C.stone[1], { top: C.stone[2] });
    m.cyl(0.5, 0.5, 4, 0.34, 3, C.stone[2], { topCol: C.stone[2] });
    m.cyl(0.5, 0.5, 7, 0.3, 14, C.bronze, { topCol: C.bronze, hoops: [5, 10] });
    m.cyl(0.5, 0.5, 21, 0.38, 5, C.bronze, { topCol: A.tone(C.bronze, 1.15), hoops: [2] });
    m.cone(0.5, 0.5, 26, 0.3, 12, A.tone(C.bronze, 0.92));
    m.custom(0.05, 0.05, 0.9, 0.9, 20, function (ctx, mm) {
      for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, p = mm.pt(0.5 + Math.cos(a) * 0.36, 0.5 + Math.sin(a) * 0.36, 22), q = mm.pt(0.5 + Math.cos(a) * 0.43, 0.5 + Math.sin(a) * 0.43, 20); A.line(ctx, p, q, C.gold, 1.8); A.circle(ctx, q[0], q[1], 1.3, C.lacquer, 0.3); }
    }, 3);
  }, { shadow: 'ellipse', lights: function () { return []; } });
  def('shi_gong_qiao', 2, 1, 38, function (m, v) {
    var hs = [4, 8, 11, 8, 4], i;
    for (i = 0; i < 5; i++) m.box(i * 0.4, 0.12, 0, 0.4, 0.76, hs[i], i % 2 ? C.stone[1] : C.stone[2], { top: sn(v) ? SNOW : C.stone[2] });
    for (i = 0; i < 5; i++) m.box(i * 0.4 + 0.1, 0.08, hs[i], 0.16, 0.08, 6, C.stone[0], { top: C.stone[1] });
    for (i = 0; i < 5; i++) m.box(i * 0.4 + 0.1, 0.84, hs[i], 0.16, 0.08, 6, C.stone[0], { top: C.stone[1] });
  }, { lights: function () { return []; } });
  def('ma_mian', 2, 2, 62, function (m, v) {
    var i;
    m.box(0.0, 0.8, 0, 2, 0.5, 34, C.stone[1], { top: C.stone[2] });
    m.box(0.45, 0.1, 0, 1.1, 0.8, 38, C.stone[1], { top: C.stone[2], deco: {
      F: function (ctx, f) { A.band(ctx, f, 0, 2, C.stone[0]); A.lattice(ctx, f, 0.5, 4, 22, 8, C.stone[0]); }, R: function (ctx, f) { A.band(ctx, f, 0, 2, C.stone[0]); }
    } });
    for (i = 0; i < 3; i++) m.box(0.5 + i * 0.4, 0.1, 38, 0.2, 0.15, 5, C.stone[2], { top: sn(v) ? SNOW : C.stone[2] });
    for (i = 0; i < 5; i++) m.box(0.02 + i * 0.4, 0.8, 34, 0.2, 0.15, 4, C.stone[2], { top: sn(v) ? SNOW : C.stone[2] });
  }, { lights: function () { return []; } });
})(ART);
