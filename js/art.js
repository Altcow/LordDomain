// art.js — 美術繪製函式庫(PLAN_ART_STYLE §2、§4.2-1)。載入時只宣告不執行,不碰 DOM / world;全域 ART 由本檔建立。

var ART = window.ART = (function () {
  'use strict';
  var A = {};
  A.TW = 64; A.TH = 32; A.HL = 16;
  A.C = {
    hanRed: '#d23a2c', cinnabar: '#f2603c', tile: '#5f86a8', tileDk: '#3e5c7a',
    earth: '#ecc37e', earthDk: '#c79650', silk: '#fcf2dc', bronze: '#3fa385',
    lacquer: '#2b1d1b', gold: '#ffc94a', ink: '#3b2314',
    grass: ['#5aa83a', '#86cc4c', '#bfe873'], water: ['#2b86c9', '#4ab7ec', '#a9e9ff'],
    wood: ['#6b3d1f', '#a8692f', '#dc9d58'], stone: ['#7b8794', '#aab5be', '#dfe6ea'],
    thatch: '#e3b95c', thatchDk: '#b98a38', skin: '#ffd9b0', blush: '#ff9e8c',
    hair: '#2f221e', snow: '#f7fbff', shadeTint: '#4a3a78', hiTint: '#fff4d6',
    lamp: '#ffd66b', lampHot: '#fff3b8', lantern: '#ff6a2c', fire: '#ff9a2e'
  };
  // 面明度:牆左(+y)/右(+x);屋坡依外法線:NW 最亮、SE 最暗
  A.LIGHT = { top: 1.04, L: 0.88, R: 0.7, NW: 1.1, NE: 0.9, SW: 0.98, SE: 0.76 };
  var SL = { '-x': 'NW', '-y': 'NE', '+y': 'SW', '+x': 'SE' };
  A.FRONT = [[0, 1], [-1, 0], [0, -1], [1, 0]];

  function h2r(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function r2h(c) {
    var s = '#';
    for (var i = 0; i < 3; i++) { var v = Math.max(0, Math.min(255, Math.round(c[i]))); s += (v < 16 ? '0' : '') + v.toString(16); }
    return s;
  }
  A.mix = function (a, b, t) {
    var x = h2r(a), y = h2r(b);
    return r2h([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  };
  // f<1 變暗並偏冷紫(卡通陰影),f>1 變亮並偏暖白(卡通高光)
  A.tone = function (hex, f) {
    if (f === 1) return hex;
    if (f < 1) {
      var c = h2r(hex);
      return A.mix(r2h([c[0] * f, c[1] * f, c[2] * f]), A.C.shadeTint, (1 - f) * 0.35);
    }
    return A.mix(hex, A.C.hiTint, Math.min(1, (f - 1) * 1.6));
  };
  // ---------------- 時段(晨/午/昏/夜):烘焙進快取的乘色 + 自發光層 + 加法光暈 ----------------
  // mul:乘色(null = 不變);glow:光暈強度;shadow:地面陰影倍率;sky:背景色;lit:窗/燈籠是否點亮
  A.TOD = {
    dawn: { mul: '#ffd9bf', glow: 0.25, shadow: 0.8, sky: '#f6c7a4', lit: false },
    noon: { mul: null, glow: 0, shadow: 1, sky: '#7fb8d8', lit: false },
    dusk: { mul: '#e9a58e', glow: 0.65, shadow: 0.7, sky: '#b9788c', lit: true },
    night: { mul: '#5563a6', glow: 1, shadow: 0.45, sky: '#141d3d', lit: true }
  };
  A.state = { lit: false, emi: false };
  A.mulHex = function (a, b) {
    if (!b) return a;
    var x = h2r(a), y = h2r(b);
    return r2h([x[0] * y[0] / 255, x[1] * y[1] / 255, x[2] * y[2] / 255]);
  };
  A.todOf = function (v) { return A.TOD[(v && v.tod) || 'noon'] || A.TOD.noon; };
  // 自發光繪製:在 emissive 分離繪製時改用 source-over,平時直接畫
  A.lit = function (ctx, fn) {
    var g = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'source-over'; fn(); ctx.globalCompositeOperation = g;
  };
  A.P = function (gx, gy, z) { return [(gx - gy) * 32, (gx + gy) * 16 - z]; };
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function qpt(a, c, b, t) { var u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; }
  A.rng = function (seed) {
    var s = (seed * 2654435761) >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 10000) / 10000; };
  };

  A.path = function (ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  A.edge = function (ctx, alpha, w) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = A.C.ink; ctx.lineWidth = w || 1;
    ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  };
  A.poly = function (ctx, pts, fill, edge) {
    A.path(ctx, pts);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (edge !== 0) A.edge(ctx, edge === undefined ? 0.55 : edge);
  };
  A.circle = function (ctx, x, y, r, fill, edge) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (edge) A.edge(ctx, edge);
  };
  A.ellipse = function (ctx, x, y, rx, ry, fill, edge) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (edge) A.edge(ctx, edge);
  };
  A.line = function (ctx, a, b, col, w) {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
  };

  // ---------------- Model:局部座標 (u,v,z) → 依 facing 映射到格座標 ----------------
  // 局部:u = 正面寬方向 0..W,v = 深度 0..D,正面在 v=D;W=OBJECTS.w、D=OBJECTS.h
  function Model(W, D, f) { this.W = W; this.D = D; this.f = f || 0; this.parts = []; this.n = 0; }
  Model.prototype.g = function (u, v) {
    var W = this.W, D = this.D;
    switch (this.f) {
      case 1: return [D - v, u];
      case 2: return [W - u, D - v];
      case 3: return [v, W - u];
      default: return [u, v];
    }
  };
  Model.prototype.pt = function (u, v, z) { var g = this.g(u, v); return A.P(g[0], g[1], z); };
  Model.prototype.rect = function (u, v, w, d) {
    var a = this.g(u, v), b = this.g(u + w, v + d);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) };
  };
  var NRM = { F: [0, 1], B: [0, -1], R: [1, 0], L: [-1, 0] };
  Model.prototype.wdir = function (face) {
    var n = NRM[face], a = n[0], b = n[1], r;
    switch (this.f) {
      case 1: r = [-b, a]; break;
      case 2: r = [-a, -b]; break;
      case 3: r = [b, -a]; break;
      default: r = [a, b];
    }
    return r[0] === 1 ? '+x' : (r[0] === -1 ? '-x' : (r[1] === 1 ? '+y' : '-y'));
  };
  Model.prototype.waxis = function (ax) { return (ax === 'u') === (this.f % 2 === 0) ? 'x' : 'y'; };
  Model.prototype.add = function (r, z, fn, bias) {
    this.parts.push({ r: r, k: r.x0 + r.x1 + r.y0 + r.y1, b: bias || 0, z: z, i: this.n++, fn: fn });
  };
  // a 必須先於 b 畫?(局部畫家演算法:同層 → 平面重疊比 z → 一軸重疊比前後 → 其他比中心深度)
  function before(a, b) {
    var e = 0.001, ra = a.r, rb = b.r;
    if (a.b !== b.b) return a.b < b.b;
    var ox = ra.x0 < rb.x1 - e && rb.x0 < ra.x1 - e, oy = ra.y0 < rb.y1 - e && rb.y0 < ra.y1 - e;
    if (ox && oy) return a.z !== b.z ? a.z < b.z : a.i < b.i;
    if (oy && ra.x1 <= rb.x0 + e) return true;
    if (oy && rb.x1 <= ra.x0 + e) return false;
    if (ox && ra.y1 <= rb.y0 + e) return true;
    if (ox && rb.y1 <= ra.y0 + e) return false;
    return a.k !== b.k ? a.k < b.k : a.i < b.i;
  }
  Model.prototype.render = function (ctx) {
    var rest = this.parts.slice().sort(function (a, b) { return (a.k - b.k) || (a.z - b.z) || (a.i - b.i); });
    while (rest.length) {
      var pick = 0;
      for (var i = 0; i < rest.length; i++) {
        var ok = true;
        for (var j = 0; j < rest.length; j++) if (j !== i && before(rest[j], rest[i])) { ok = false; break; }
        if (ok) { pick = i; break; }
      }
      rest.splice(pick, 1)[0].fn(ctx);
    }
  };
  Model.prototype.box = function (u, v, z, w, d, h, col, o) {
    o = o || {};
    var m = this, r = this.rect(u, v, w, d), deco = o.deco || {};
    this.add(r, z, function (ctx) {
      A.boxW(ctx, r, z, h, col, o.top);
      for (var key in deco) {
        var wd = m.wdir(key);
        if (wd === '+y' || wd === '+x') deco[key](ctx, A.face(r, z, h, wd));
      }
      if (o.topDeco) o.topDeco(ctx, m);
    }, o.bias);
    return r;
  };
  Model.prototype.hip = function (u, v, z, w, d, rise, col, o) { this._roof('hip', u, v, z, w, d, rise, col, o, w >= d ? 'u' : 'v'); };
  Model.prototype.gable = function (u, v, z, w, d, rise, col, o) { this._roof('gable', u, v, z, w, d, rise, col, o, 'u'); };
  Model.prototype._roof = function (kind, u, v, z, w, d, rise, col, o, defAx) {
    o = o || {};
    var lax = o.axis || defAx, ov = o.over === undefined ? 0.15 : o.over;
    var oe = o.overEnd === undefined ? ov : o.overEnd;
    var ou = lax === 'u' ? oe : ov, ovv = lax === 'u' ? ov : oe;
    if (kind === 'hip') { ou = ov; ovv = ov; }
    var r = this.rect(u - ou, v - ovv, w + 2 * ou, d + 2 * ovv), wr = this.rect(u, v, w, d), ax = this.waxis(lax);
    this.add(wr, z, function (ctx) { A.roofW(ctx, kind, r, wr, z, rise, col, ax, o); }, o.bias);
  };
  Model.prototype.cyl = function (u, v, z, rad, h, col, o) {
    o = o || {};
    var g = this.g(u, v), r = { x0: g[0] - rad, x1: g[0] + rad, y0: g[1] - rad, y1: g[1] + rad };
    this.add(r, z, function (ctx) { A.cylW(ctx, g[0], g[1], z, rad, h, col, o); }, o.bias);
  };
  Model.prototype.cone = function (u, v, z, rad, h, col, o) {
    o = o || {};
    var g = this.g(u, v), r = { x0: g[0] - rad, x1: g[0] + rad, y0: g[1] - rad, y1: g[1] + rad };
    this.add(r, z, function (ctx) { A.coneW(ctx, g[0], g[1], z, rad, h, col, o); }, o.bias);
  };
  Model.prototype.custom = function (u, v, w, d, z, fn, bias) {
    var m = this, r = this.rect(u, v, w, d);
    this.add(r, z, function (ctx) { fn(ctx, m); }, bias);
  };
  A.Model = Model;
  // 子模型:把另一個物件的 build 嵌入本模型局部 (u0,v0),相對朝向 sf;組合旋轉 = (父 f + sf) % 4
  function Sub(p, u0, v0, W, D, sf) { this.p = p; this.u0 = u0; this.v0 = v0; this.W = W; this.D = D; this.sf = sf || 0; this.f = (p.f + this.sf) % 4; }
  Sub.prototype = Object.create(Model.prototype);
  Sub.prototype.g = function (u, v) {
    var W = this.W, D = this.D, a;
    switch (this.sf) { case 1: a = [D - v, u]; break; case 2: a = [W - u, D - v]; break; case 3: a = [v, W - u]; break; default: a = [u, v]; }
    return this.p.g(this.u0 + a[0], this.v0 + a[1]);
  };
  Sub.prototype.add = function (r, z, fn, bias) { this.p.add(r, z, fn, bias); };
  Model.prototype.place = function (type, u0, v0, sf, v) {
    var s = A.OBJ[type];
    s.build(new Sub(this, u0, v0, s.w, s.d, s.sym ? 0 : (sf || 0)), v || {});
  };

  // ---------------- 世界座標基本形 ----------------
  A.boxW = function (ctx, r, z, h, col, top) {
    var P = A.P, x0 = r.x0, x1 = r.x1, y0 = r.y0, y1 = r.y1, t = z + h;
    if (h > 0) {
      A.poly(ctx, [P(x0, y1, z), P(x1, y1, z), P(x1, y1, t), P(x0, y1, t)], A.tone(col, A.LIGHT.L));
      A.poly(ctx, [P(x1, y1, z), P(x1, y0, z), P(x1, y0, t), P(x1, y1, t)], A.tone(col, A.LIGHT.R));
    }
    A.poly(ctx, [P(x0, y0, t), P(x1, y0, t), P(x1, y1, t), P(x0, y1, t)], top || A.tone(col, A.LIGHT.top));
  };
  // 可見牆面的描述:pt(s, dz),s=0 為畫面左端、1 為右端;dz 自牆底起算
  A.face = function (r, z, h, wd) {
    var f = { z: z, h: h, dir: wd, light: wd === '+y' ? A.LIGHT.L : A.LIGHT.R };
    if (wd === '+y') { f.len = r.x1 - r.x0; f.pt = function (s, dz) { return A.P(r.x0 + f.len * s, r.y1, z + dz); }; }
    else { f.len = r.y1 - r.y0; f.pt = function (s, dz) { return A.P(r.x1, r.y1 - f.len * s, z + dz); }; }
    return f;
  };
  A.quad = function (f, s0, s1, z0, z1) { return [f.pt(s0, z0), f.pt(s1, z0), f.pt(s1, z1), f.pt(s0, z1)]; };
  A.posts = function (ctx, f, list, wg, col) {
    var hw = wg / f.len / 2;
    for (var i = 0; i < list.length; i++) {
      var s = Math.max(hw, Math.min(1 - hw, list[i]));
      A.poly(ctx, A.quad(f, s - hw, s + hw, 0, f.h), A.tone(col, f.light), 0.45);
    }
  };
  A.band = function (ctx, f, z0, z1, col) { A.poly(ctx, A.quad(f, 0, 1, z0, z1), A.tone(col, f.light), 0.35); };
  A.door = function (ctx, f, sc, wg, hh, col) {
    var hw = wg / f.len / 2, fr = 0.05 / f.len;
    A.poly(ctx, A.quad(f, sc - hw - fr, sc + hw + fr, 0, hh + 2), A.tone(A.C.wood[0], f.light), 0.6);
    A.poly(ctx, A.quad(f, sc - hw, sc + hw, 0, hh), A.tone(col, f.light), 0.5);
    if (A.state.lit) {
      A.lit(ctx, function () { A.poly(ctx, A.quad(f, sc - hw * 0.22, sc + hw * 0.22, 0, hh), A.C.lamp, 0); });
    } else A.line(ctx, f.pt(sc, 0), f.pt(sc, hh), A.tone(A.C.wood[0], f.light), 1);
    var k1 = f.pt(sc - hw * 0.4, hh * 0.5), k2 = f.pt(sc + hw * 0.4, hh * 0.5);
    A.circle(ctx, k1[0], k1[1], 0.9, A.C.gold); A.circle(ctx, k2[0], k2[1], 0.9, A.C.gold);
  };
  A.lattice = function (ctx, f, sc, wg, z0, hh, col) {
    var hw = wg / f.len / 2, n = 4;
    A.poly(ctx, A.quad(f, sc - hw, sc + hw, z0, z0 + hh), A.tone(col || A.C.wood[1], f.light), 0.55);
    var iw = hw * 0.78;
    if (A.state.lit) A.lit(ctx, function () { A.poly(ctx, A.quad(f, sc - iw, sc + iw, z0 + 1, z0 + hh - 1), A.C.lamp, 0); });
    else A.poly(ctx, A.quad(f, sc - iw, sc + iw, z0 + 1, z0 + hh - 1), A.tone('#3a2a26', f.light), 0);
    for (var i = 1; i < n; i++) {
      var s = sc - iw + (2 * iw) * i / n;
      A.line(ctx, f.pt(s, z0 + 1), f.pt(s, z0 + hh - 1), A.tone(A.C.wood[2], f.light), 1);
    }
  };

  A.roofW = function (ctx, kind, r, wr, z, rise, col, ax, o) {
    var P = A.P, X0 = r.x0, X1 = r.x1, Y0 = r.y0, Y1 = r.y1, Xm = (X0 + X1) / 2, Ym = (Y0 + Y1) / 2, zr = z + rise;
    var curl = o.curl === undefined ? 3 : o.curl, sag = o.sag === undefined ? 1.5 : o.sag, ze = z + curl;
    var R0, R1, a, k;
    if (kind === 'hip') {
      k = o.hipK === undefined ? 0.9 : o.hipK;
      if (ax === 'x') { a = Math.min((Y1 - Y0) / 2 * k, (X1 - X0) / 2 - 0.05); R0 = [X0 + a, Ym]; R1 = [X1 - a, Ym]; }
      else { a = Math.min((X1 - X0) / 2 * k, (Y1 - Y0) / 2 - 0.05); R0 = [Xm, Y0 + a]; R1 = [Xm, Y1 - a]; }
    } else {
      if (ax === 'x') { R0 = [X0, Ym]; R1 = [X1, Ym]; } else { R0 = [Xm, Y0]; R1 = [Xm, Y1]; }
    }
    var c00 = [X0, Y0], c10 = [X1, Y0], c11 = [X1, Y1], c01 = [X0, Y1], S;
    if (ax === 'x') S = { '-y': [c00, c10, [R1, R0]], '+x': [c10, c11, [R1]], '+y': [c11, c01, [R0, R1]], '-x': [c01, c00, [R0]] };
    else S = { '-y': [c00, c10, [R0]], '+x': [c10, c11, [R1, R0]], '+y': [c11, c01, [R1]], '-x': [c01, c00, [R0, R1]] };
    if (kind === 'gable') { if (ax === 'x') { S['+x'] = null; S['-x'] = null; } else { S['-y'] = null; S['+y'] = null; } }
    var ridgeCol = o.ridgeCol || A.tone(col, 0.5);
    function geo(dir) {
      var s = S[dir], Ap = P(s[0][0], s[0][1], ze), Bp = P(s[1][0], s[1][1], ze);
      var M = P((s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2, z);
      var T = [];
      for (var i = 0; i < s[2].length; i++) T.push(P(s[2][i][0], s[2][i][1], zr));
      return { A: Ap, B: Bp, C: [M[0], M[1] + 2 * sag + curl], T: T, len: Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) };
    }
    function topAt(g, t) { return lerp(g.T[g.T.length - 1], g.T[0], t); }
    function shape(g) {
      ctx.beginPath(); ctx.moveTo(g.A[0], g.A[1]); ctx.quadraticCurveTo(g.C[0], g.C[1], g.B[0], g.B[1]);
      for (var i = 0; i < g.T.length; i++) ctx.lineTo(g.T[i][0], g.T[i][1]);
      ctx.closePath();
    }
    function slope(dir) {
      if (!S[dir]) return;
      var g = geo(dir), f = A.LIGHT[SL[dir]], j;
      shape(g); ctx.fillStyle = A.tone(col, f); ctx.fill();
      if (o.tiles !== false) {
        ctx.save(); shape(g); ctx.clip();
        ctx.strokeStyle = A.tone(col, f * 0.8); ctx.lineWidth = o.tileW || 1.1; ctx.beginPath();
        var n = Math.max(3, Math.round(g.len * (o.tileDensity || 5)));
        for (j = 1; j < n; j++) { var t = j / n, e = qpt(g.A, g.C, g.B, t), tp = topAt(g, t); ctx.moveTo(e[0], e[1]); ctx.lineTo(tp[0], tp[1]); }
        ctx.stroke(); ctx.restore();
      }
      if (o.snow) {
        var pts = [];
        for (j = 0; j <= 10; j++) {
          var t2 = j / 10, e2 = qpt(g.A, g.C, g.B, t2), tp2 = topAt(g, t2), q = 0.55 + 0.07 * Math.sin(j * 2.3);
          pts.push(lerp(tp2, e2, q));
        }
        for (j = 0; j < g.T.length; j++) pts.push(g.T[j]);
        A.poly(ctx, pts, A.mix(A.C.snow, '#b8c8e0', (1.1 - f) * 0.8), 0.25);
      }
      shape(g); A.edge(ctx, 0.6);
      ctx.beginPath(); ctx.moveTo(g.A[0], g.A[1]); ctx.quadraticCurveTo(g.C[0], g.C[1], g.B[0], g.B[1]);
      ctx.strokeStyle = A.tone(o.eaveCol || col, f * 0.55); ctx.lineWidth = o.eaveW || 2.4; ctx.lineCap = 'round'; ctx.stroke();
    }
    function ln(p, q, zp, zq, w, c) { A.line(ctx, P(p[0], p[1], zp), P(q[0], q[1], zq), c, w); }
    slope('-y'); slope('-x');
    if (kind === 'hip') ln(R0, c00, zr, ze, 1.8, ridgeCol);
    if (kind === 'gable' && o.end !== false) {
      var ec = o.endCol || A.C.silk, pts2;
      if (ax === 'x') pts2 = [P(wr.x1, wr.y0, z), P(wr.x1, wr.y1, z), P(wr.x1, Ym, zr - 3)];
      else pts2 = [P(wr.x0, wr.y1, z), P(wr.x1, wr.y1, z), P(Xm, wr.y1, zr - 3)];
      A.poly(ctx, pts2, A.tone(ec, ax === 'x' ? A.LIGHT.R : A.LIGHT.L), 0.5);
      // 山牆上的木樑(橫+人字)
      var b0 = lerp(pts2[0], pts2[2], 0.45), b1 = lerp(pts2[1], pts2[2], 0.45);
      A.line(ctx, b0, b1, A.tone(A.C.wood[1], 0.8), 1.4);
    }
    slope('+x'); slope('+y');
    if (kind === 'hip') {
      if (ax === 'x') { ln(R0, c01, zr, ze, 1.8, ridgeCol); ln(R1, c10, zr, ze, 1.8, ridgeCol); ln(R1, c11, zr, ze, 1.8, ridgeCol); }
      else { ln(R0, c10, zr, ze, 1.8, ridgeCol); ln(R1, c01, zr, ze, 1.8, ridgeCol); ln(R1, c11, zr, ze, 1.8, ridgeCol); }
    } else {
      var bc = A.tone(o.eaveCol || col, 0.45);
      if (ax === 'x') { ln(c10, R1, ze, zr, 2.4, bc); ln(c11, R1, ze, zr, 2.4, bc); }
      else { ln(c01, R1, ze, zr, 2.4, bc); ln(c11, R1, ze, zr, 2.4, bc); }
    }
    var rw = o.ridgeW || 3.4;
    ln(R0, R1, zr, zr, rw, ridgeCol);
    if (o.ridgeHi) ln(R0, R1, zr + 1, zr + 1, 1, o.ridgeHi);
    function hook(E, O) {
      var e = P(E[0], E[1], zr), q = P(O[0], O[1], zr), dx = e[0] - q[0], dy = e[1] - q[1], L = Math.hypot(dx, dy) || 1;
      dx /= L; dy /= L;
      var hs = o.hookSize || 4.5;
      ctx.beginPath(); ctx.moveTo(e[0], e[1]);
      ctx.quadraticCurveTo(e[0] + dx * hs * 0.9, e[1] + dy * hs * 0.9, e[0] + dx * hs, e[1] + dy * hs - hs);
      ctx.strokeStyle = ridgeCol; ctx.lineWidth = rw * 0.8; ctx.lineCap = 'round'; ctx.stroke();
    }
    if (o.hooks !== false && (R0[0] !== R1[0] || R0[1] !== R1[1])) { hook(R0, R1); hook(R1, R0); }
  };

  A.cylW = function (ctx, gx, gy, z, rad, h, col, o) {
    var B = A.P(gx, gy, z), T = A.P(gx, gy, z + h), rx = rad * 45.25, ry = rad * 22.63;
    var gr = ctx.createLinearGradient(B[0] - rx, 0, B[0] + rx, 0);
    gr.addColorStop(0, A.tone(col, 1.06)); gr.addColorStop(0.4, A.tone(col, 0.94)); gr.addColorStop(1, A.tone(col, 0.68));
    ctx.beginPath(); ctx.moveTo(T[0] - rx, T[1]); ctx.lineTo(B[0] - rx, B[1]);
    ctx.ellipse(B[0], B[1], rx, ry, 0, Math.PI, 0, true); ctx.lineTo(T[0] + rx, T[1]); ctx.closePath();
    ctx.fillStyle = gr; ctx.fill(); A.edge(ctx, 0.6);
    if (o.hoops) for (var i = 0; i < o.hoops.length; i++) {
      ctx.beginPath(); ctx.ellipse(B[0], B[1] - o.hoops[i], rx, ry, 0, 0, Math.PI, false);
      ctx.strokeStyle = A.C.ink; ctx.lineWidth = 2.2; ctx.stroke(); ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (!o.noTop) A.ellipse(ctx, T[0], T[1], rx, ry, o.topCol || A.tone(col, 1.1), 0.6);
  };
  A.coneW = function (ctx, gx, gy, z, rad, h, col, o) {
    var B = A.P(gx, gy, z), rx = rad * 45.25, ry = rad * 22.63, ap = [B[0], B[1] - h];
    var gr = ctx.createLinearGradient(B[0] - rx, 0, B[0] + rx, 0);
    gr.addColorStop(0, A.tone(col, 1.08)); gr.addColorStop(0.45, A.tone(col, 0.96)); gr.addColorStop(1, A.tone(col, 0.7));
    ctx.beginPath(); ctx.moveTo(B[0] - rx, B[1]); ctx.lineTo(ap[0], ap[1]); ctx.lineTo(B[0] + rx, B[1]);
    ctx.ellipse(B[0], B[1], rx, ry, 0, 0, Math.PI, false); ctx.closePath();
    ctx.fillStyle = gr; ctx.fill(); A.edge(ctx, 0.6);
  };

  // ---------------- 離屏快取 + 外描邊 ----------------
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  A.cache = {}; A.cacheCount = 0; A.cacheBytes = 0; A.cacheTick = 0;
  A.CACHE_LIMIT = 48 * 1024 * 1024; // sprite 快取上限(bytes),超過以 LRU 淘汰
  A.touch = function (key) { var c = A.cache[key]; if (c) c.last = ++A.cacheTick; return c; };
  A.clearCache = function () { A.cache = {}; A.cacheCount = 0; A.cacheBytes = 0; };
  A.evict = function (keep) {
    while (A.cacheBytes > A.CACHE_LIMIT && A.cacheCount > 1) {
      var old = null, oldK = null, k;
      for (k in A.cache) { if (k !== keep && (!old || A.cache[k].last < old.last)) { old = A.cache[k]; oldK = k; } }
      if (!old) break;
      delete A.cache[oldK]; A.cacheCount--; A.cacheBytes -= old.bytes;
    }
  };
  A.OUTLINE = 1.6; // 世界像素
  A.outlineInto = function (ctx, src, px, color) {
    var sil = mk(src.width, src.height), sx = sil.getContext('2d');
    sx.drawImage(src, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = color; sx.fillRect(0, 0, sil.width, sil.height);
    var n = px > 2.5 ? 16 : 8;
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; ctx.drawImage(sil, Math.cos(a) * px, Math.sin(a) * px); }
    ctx.drawImage(src, 0, 0);
  };
  // bounds:{l,t,w,h} 世界像素,相對錨點;draw:{under(ctx), body(ctx), light:bool}
  A.sprite = function (key, res, b, draw) {
    var c = A.touch(key);
    if (c) return c;
    var pad = 4, w = Math.ceil((b.w + pad * 2) * res), h = Math.ceil((b.h + pad * 2) * res);
    var tx = (pad - b.l) * res, ty = (pad - b.t) * res;
    var body = mk(w, h), bx = body.getContext('2d');
    bx.setTransform(res, 0, 0, res, tx, ty); draw.body(bx);
    if (draw.light) {
      bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'source-atop';
      var gr = bx.createLinearGradient(0, 0, w * 0.7, h);
      gr.addColorStop(0, 'rgba(255,248,220,0.28)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(60,40,120,0.30)');
      bx.fillStyle = gr; bx.fillRect(0, 0, w, h); bx.globalCompositeOperation = 'source-over';
    }
    var tod = draw.tod || A.TOD.noon;
    if (tod.mul) {
      // 乘色只作用在既有像素:先乘色,再用原圖 alpha 裁回
      var tmp = mk(w, h), tc = tmp.getContext('2d');
      tc.drawImage(body, 0, 0); tc.globalCompositeOperation = 'multiply'; tc.fillStyle = tod.mul; tc.fillRect(0, 0, w, h);
      tc.globalCompositeOperation = 'destination-in'; tc.drawImage(body, 0, 0); tc.globalCompositeOperation = 'source-over';
      body = tmp; bx = tc;
    }
    if (draw.emi && tod.lit) {
      // 自發光層:正常幾何一律「擦除」,只有 A.lit() 內的東西留下 → 自帶遮擋,疊回時不受乘色影響
      var em = mk(w, h), ec = em.getContext('2d');
      ec.setTransform(res, 0, 0, res, tx, ty); ec.globalCompositeOperation = 'destination-out';
      A.state.emi = true; draw.emi(ec); A.state.emi = false;
      bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'source-over'; bx.drawImage(em, 0, 0);
    }
    var out = mk(w, h), ox = out.getContext('2d');
    if (draw.under) { ox.setTransform(res, 0, 0, res, tx, ty); draw.under(ox); ox.setTransform(1, 0, 0, 1, 0, 0); }
    A.outlineInto(ox, body, A.OUTLINE * res, A.C.ink);
    c = { cv: out, l: b.l - pad, t: b.t - pad, res: res, bytes: out.width * out.height * 4, last: ++A.cacheTick };
    A.cache[key] = c; A.cacheCount++; A.cacheBytes += c.bytes;
    A.evict(key);
    return c;
  };
  A.blit = function (ctx, spr, x, y) { ctx.drawImage(spr.cv, x + spr.l, y + spr.t, spr.cv.width / spr.res, spr.cv.height / spr.res); };
  A.resBucket = function (r) { return Math.max(1, Math.min(4, Math.round(r * 2) / 2)); };

  // ---------------- 物件註冊 ----------------
  A.OBJ = {};
  A.def = function (type, spec) { A.OBJ[type] = spec; };
  A.foot = function (type, f) { var s = A.OBJ[type]; return (f % 2 === 1) ? [s.d, s.w] : [s.w, s.d]; };
  A.vkey = function (v) { v = v || {}; return [v.season || 'spring', v.tod || 'noon', v.level || 0, v.skin || '', v.kind || '', v.seed || 0, v.dmg || 0].join('/'); };
  A.footShadow = function (ctx, fw, fd, kind, k) {
    if (kind === 'none') return;
    var col = 'rgba(30,60,20,' + (0.25 * (k === undefined ? 1 : k)).toFixed(3) + ')';
    if (kind === 'ellipse') {
      var c = A.P(fw / 2, fd / 2, 0);
      A.ellipse(ctx, c[0] + 4, c[1] + 1, fw * 20, fw * 9, col);
      return;
    }
    var P = A.P;
    A.poly(ctx, [P(0.18, 0.02, 0), P(fw + 0.22, 0.02, 0), P(fw + 0.22, fd - 0.02, 0), P(0.18, fd - 0.02, 0)], col, 0);
  };
  A.objSprite = function (type, f, v, res) {
    var s = A.OBJ[type];
    v = v || {};
    if (s.sym) f = 0;
    var key = type + '|' + f + '|' + A.vkey(v) + '|' + res;
    if (A.cache[key]) return A.touch(key);
    var fp = A.foot(type, f), H = s.hmax || 80, tod = A.todOf(v);
    var b = { l: -fp[1] * 32 - 6, t: -H, w: (fp[0] + fp[1]) * 32 + 12, h: H + (fp[0] + fp[1]) * 16 + 4 };
    function build(c) { A.state.lit = tod.lit; var m = new Model(s.w, s.d, f); s.build(m, v); m.render(c); A.state.lit = false; }
    return A.sprite(key, res, b, {
      tod: tod, light: !!s.light,
      under: function (c) { A.footShadow(c, fp[0], fp[1], s.shadow, tod.shadow); },
      body: build, emi: build
    });
  };
  // ---------------- 光暈(加法混色,離屏預渲染的徑向漸層) ----------------
  A.glowCache = {};
  A.glow = function (ctx, x, y, r, col, a) {
    var key = col + '|' + r, g = A.glowCache[key];
    if (!g) {
      var c = h2r(col), n = Math.ceil(r * 2);
      g = mk(n * 2, n * 2); var gc = g.getContext('2d'), gr = gc.createRadialGradient(n, n, 0, n, n, n);
      var rgb = c[0] + ',' + c[1] + ',' + c[2];
      gr.addColorStop(0, 'rgba(' + rgb + ',0.9)'); gr.addColorStop(0.25, 'rgba(' + rgb + ',0.45)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      gc.fillStyle = gr; gc.fillRect(0, 0, n * 2, n * 2);
      A.glowCache[key] = g;
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.drawImage(g, x - r, y - r, r * 2, r * 2); ctx.restore();
  };
  // 物件光暈:spec.lights(v) 回傳 [[u,v,z,半徑,色]](局部座標)
  A.drawLights = function (ctx, type, gx, gy, bh, f, v, t) {
    var s = A.OBJ[type], tod = A.todOf(v);
    if (!s.lights || !tod.glow) return;
    var m = new Model(s.w, s.d, s.sym ? 0 : f), L = s.lights(v || {}), o = A.P(gx, gy, bh);
    for (var i = 0; i < L.length; i++) {
      var p = m.pt(L[i][0], L[i][1], L[i][2]), k = L[i][5] || 0.8;
      if (L[i][6]) { var wd = m.wdir(L[i][6]); if (wd !== '+x' && wd !== '+y') k *= 0.3; }
      A.glow(ctx, o[0] + p[0], o[1] + p[1], L[i][3], L[i][4], tod.glow * k * (0.9 + 0.1 * Math.sin(t * 7 + i * 1.9)));
    }
  };
  // 燈籠(掛在 (x,y) 下方);夜間自發光
  A.lantern = function (ctx, x, y, s) {
    s = s || 1;
    A.line(ctx, [x, y], [x, y + 2 * s], A.C.ink, 0.8);
    var cy = y + 5 * s;
    if (A.state.lit) A.lit(ctx, function () {
      A.ellipse(ctx, x, cy, 3 * s, 3.6 * s, A.C.lantern, 0.6); A.ellipse(ctx, x - 0.6 * s, cy - 0.4 * s, 1.5 * s, 2.2 * s, A.C.lampHot);
    });
    else { A.ellipse(ctx, x, cy, 3 * s, 3.6 * s, A.C.hanRed, 0.6); A.ellipse(ctx, x - 1 * s, cy - 1 * s, 1 * s, 1.5 * s, A.tone(A.C.hanRed, 1.4)); }
    A.poly(ctx, [[x - 2 * s, cy - 3.8 * s], [x + 2 * s, cy - 3.8 * s], [x + 2 * s, cy - 3 * s], [x - 2 * s, cy - 3 * s]], A.C.gold, 0.4);
    A.poly(ctx, [[x - 2 * s, cy + 3 * s], [x + 2 * s, cy + 3 * s], [x + 2 * s, cy + 3.8 * s], [x - 2 * s, cy + 3.8 * s]], A.C.gold, 0.4);
    A.line(ctx, [x, cy + 3.8 * s], [x, cy + 6.5 * s], A.C.hanRed, 1);
  };
  A.fire = function (ctx, x, y, t, s) {
    s = s || 1;
    var k = 1 + 0.15 * Math.sin(t * 13) + 0.08 * Math.sin(t * 29);
    ctx.beginPath(); ctx.moveTo(x - 3.5 * s, y); ctx.quadraticCurveTo(x - 4 * s, y - 6 * s * k, x, y - 11 * s * k);
    ctx.quadraticCurveTo(x + 4 * s, y - 6 * s * k, x + 3.5 * s, y); ctx.closePath(); ctx.fillStyle = A.C.fire; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 1.8 * s, y); ctx.quadraticCurveTo(x - 2 * s, y - 4 * s * k, x, y - 7 * s * k);
    ctx.quadraticCurveTo(x + 2 * s, y - 4 * s * k, x + 1.8 * s, y); ctx.closePath(); ctx.fillStyle = A.C.lampHot; ctx.fill();
  };
  // 在格 (gx,gy) 地面高 bh 畫物件;time 供動畫件
  A.drawObj = function (ctx, type, gx, gy, bh, f, v, res, time) {
    var s = A.OBJ[type];
    if (s.sym) f = 0;
    var spr = A.objSprite(type, f, v, res), p = A.P(gx, gy, bh);
    // animPre:位於物件背面、應被本體遮住的動畫件(先畫);anim:其餘動畫件(後畫)
    if (s.animPre && time !== undefined) { ctx.save(); ctx.translate(p[0], p[1]); s.animPre(ctx, new Model(s.w, s.d, f), time, v || {}); ctx.restore(); }
    A.blit(ctx, spr, p[0], p[1]);
    if (s.anim && time !== undefined) {
      ctx.save(); ctx.translate(p[0], p[1]); s.anim(ctx, new Model(s.w, s.d, f), time, v || {}); ctx.restore();
    }
  };

  // ---------------- 動畫件(不入快取) ----------------
  A.smoke = function (ctx, x, y, t, seed) {
    for (var i = 0; i < 4; i++) {
      var p = (t * 0.32 + i / 4 + seed * 0.37) % 1, r = 2 + p * 5;
      ctx.globalAlpha = (1 - p) * 0.6;
      A.circle(ctx, x + Math.sin((p * 5) + seed) * 2.5 + p * 7, y - p * 28, r, '#f6f2ea');
    }
    ctx.globalAlpha = 1;
  };
  A.flag = function (ctx, x, y, poleH, fw, fh, col, t, seed) {
    A.line(ctx, [x, y], [x, y - poleH], A.C.ink, 3.2);
    A.line(ctx, [x, y], [x, y - poleH], A.C.wood[0], 1.8);
    A.circle(ctx, x, y - poleH - 1.5, 2, A.C.gold, 0.7);
    var n = 6, top = [], bot = [], i;
    for (i = 0; i <= n; i++) {
      var u = i / n, wv = Math.sin(t * 5 - u * 4 + seed) * 2.2 * u;
      top.push([x + fw * u, y - poleH + 1 + wv]);
      bot.push([x + fw * u * 0.94, y - poleH + 1 + fh + wv + u * 2]);
    }
    var pts = top.concat(bot.reverse());
    A.poly(ctx, pts, col, 0.9);
    var mid = top[3], mb = bot[bot.length - 4];
    A.circle(ctx, mid[0], (mid[1] + mb[1]) / 2, fh * 0.26, A.C.gold, 0.5);
    A.poly(ctx, [top[0], top[1], bot[bot.length - 2], bot[bot.length - 1]], A.tone(col, 0.7), 0);
  };

  // ---------------- 樹 ----------------
  A.LEAF = {
    round: { spring: ['#4f9e38', '#7cc84c', '#c2ee7c'], summer: ['#2c7f3a', '#46a845', '#86d65e'], autumn: ['#c4572a', '#ee8a32', '#ffc84e'] },
    pine: { all: ['#1c6444', '#2d8a56', '#62bf74'] },
    sakura: { spring: ['#d97099', '#ffaecb', '#ffe2ec'], summer: ['#2c7f3a', '#46a845', '#86d65e'], autumn: ['#c4572a', '#ee8a32', '#ffc84e'] },
    maple: { spring: ['#4f9e38', '#7cc84c', '#c2ee7c'], summer: ['#2c7f3a', '#46a845', '#86d65e'], autumn: ['#a82a26', '#e2483a', '#ff8e5c'] },
    willow: { spring: ['#5e9e32', '#90cc50', '#cdef88'], summer: ['#3f8a33', '#64b048', '#a2d870'], autumn: ['#b09a34', '#dcc456', '#f6e690'] },
    mulberry: { spring: ['#3f9238', '#6abf4a', '#b4e878'], summer: ['#2a7a36', '#409e40', '#7ccc58'], autumn: ['#b88a2a', '#dcae3a', '#f6d86a'] }
  };
  function blobs(ctx, list, c) {
    var i, b;
    for (i = 0; i < list.length; i++) { b = list[i]; A.circle(ctx, b[0] + 1.6, b[1] + 2, b[2], c[0]); }
    for (i = 0; i < list.length; i++) { b = list[i]; A.circle(ctx, b[0] - 0.4, b[1] - 0.6, b[2] - 1.2, c[1]); }
    for (i = 0; i < list.length; i++) { b = list[i]; if (b[1] < -24 || i % 2 === 0) A.circle(ctx, b[0] - b[2] * 0.32, b[1] - b[2] * 0.38, b[2] * 0.42, c[2]); }
  }
  function trunk(ctx, h, lean) {
    A.poly(ctx, [[-3.6, 0], [-1.8 + lean, -h], [1.8 + lean, -h], [3.6, 0], [1, 1.2], [-1, 1.2]], A.C.wood[1], 0.6);
    A.poly(ctx, [[1, 0], [1 + lean, -h], [1.8 + lean, -h], [3.6, 0]], A.tone(A.C.wood[1], 0.75), 0);
  }
  function bare(ctx, rnd, snow) {
    trunk(ctx, 18, 0);
    var tips = [];
    for (var i = 0; i < 6; i++) {
      var a = -Math.PI / 2 + (i - 2.5) * 0.42 + (rnd() - 0.5) * 0.3, L = 13 + rnd() * 8;
      var s = [0, -14 - rnd() * 6], e = [s[0] + Math.cos(a) * L, s[1] + Math.sin(a) * L];
      A.line(ctx, s, e, A.C.wood[0], 2.2);
      var e2 = [e[0] + Math.cos(a - 0.6) * 5, e[1] + Math.sin(a - 0.6) * 5];
      A.line(ctx, e, e2, A.C.wood[0], 1.2);
      tips.push(e);
    }
    if (snow) for (var j = 0; j < tips.length; j++) A.ellipse(ctx, tips[j][0], tips[j][1] - 0.5, 2.6, 1.6, A.C.snow);
  }
  A.tree = function (ctx, kind, seed, season) {
    var rnd = A.rng(seed || 1), i, c;
    var winter = season === 'winter';
    if (kind === 'pine') {
      c = A.LEAF.pine.all;
      trunk(ctx, 12, 0);
      for (i = 0; i < 3; i++) {
        var y = -9 - i * 10, w = 15 - i * 3.6, ht = 17 - i * 2;
        var tier = [[-w, y], [0, y - ht], [w, y]];
        ctx.beginPath(); ctx.moveTo(-w + 1.6, y + 2); ctx.lineTo(1.6, y - ht + 2); ctx.lineTo(w + 1.6, y + 2); ctx.quadraticCurveTo(1.6, y + 6, -w + 1.6, y + 2); ctx.fillStyle = c[0]; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(0, y - ht); ctx.lineTo(w, y); ctx.quadraticCurveTo(0, y + 4, -w, y); ctx.fillStyle = c[1]; ctx.fill();
        A.poly(ctx, [[-w * 0.75, y - 0.5], [-0.5, y - ht + 2], [-w * 0.15, y + 1.5]], c[2], 0);
        if (winter) {
          ctx.beginPath(); ctx.moveTo(-w * 0.55, y - ht * 0.42); ctx.lineTo(0, y - ht); ctx.lineTo(w * 0.55, y - ht * 0.42);
          ctx.quadraticCurveTo(w * 0.25, y - ht * 0.3, 0, y - ht * 0.45); ctx.quadraticCurveTo(-w * 0.25, y - ht * 0.3, -w * 0.55, y - ht * 0.42);
          ctx.fillStyle = A.C.snow; ctx.fill();
        }
        void tier;
      }
      return;
    }
    if (winter) { bare(ctx, rnd, true); A.ellipse(ctx, 0, 1, 7, 2.5, A.C.snow); return; }
    var tab = A.LEAF[kind] || A.LEAF.round;
    c = tab[season] || tab.spring;
    if (kind === 'willow') {
      trunk(ctx, 22, -2);
      var list = [[-2, -30, 11], [-10, -26, 8], [7, -27, 8.5], [-3, -37, 8]];
      blobs(ctx, list, c);
      for (i = 0; i < 11; i++) {
        var x0 = -14 + i * 2.8 + (rnd() - 0.5) * 1.5, y0 = -27 + Math.abs(i - 5) * 0.9, L = 16 + rnd() * 9;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + 2.5, y0 + L * 0.5, x0 + 1, y0 + L);
        ctx.strokeStyle = i % 3 === 0 ? c[2] : c[1]; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.stroke();
      }
      return;
    }
    trunk(ctx, 18, 0);
    var base = [[0, -22, 9.5], [-9.5, -26, 8.5], [9.5, -26, 8.5], [0, -32, 11.5], [-5.5, -39, 8.5], [6, -38.5, 8.5]];
    var bl = [];
    for (i = 0; i < base.length; i++) bl.push([base[i][0] + (rnd() - 0.5) * 3, base[i][1] + (rnd() - 0.5) * 2.5, base[i][2] + (rnd() - 0.5) * 1.6]);
    blobs(ctx, bl, c);
    if (kind === 'sakura' && season === 'spring') {
      for (i = 0; i < 12; i++) A.circle(ctx, -14 + rnd() * 28, -44 + rnd() * 26, 1.1, i % 2 ? '#ffffff' : '#ff7fa8');
    }
    if (kind === 'mulberry' && season !== 'winter') {
      for (i = 0; i < 9; i++) A.circle(ctx, -12 + rnd() * 24, -40 + rnd() * 22, 1.3, '#5a1f4a');
    }
    if (kind === 'round' && season === 'spring') {
      for (i = 0; i < 5; i++) A.circle(ctx, -12 + rnd() * 24, -42 + rnd() * 22, 1.1, '#fff7c0');
    }
  };

  // ---------------- Q 版人物 ----------------
  A.UNIT = {};
  function leg(ctx, x, y, col) {
    A.poly(ctx, [[x - 2.1, y - 6], [x + 2.1, y - 6], [x + 2.1, y - 1], [x - 2.1, y - 1]], col, 0.5);
    A.ellipse(ctx, x - 0.3, y - 0.6, 2.8, 1.7, A.C.wood[0], 0.5);
  }
  function pole(ctx, x, yb, yt, s) {
    A.line(ctx, [x, yb], [x + 1.2, yt], A.C.ink, 3); A.line(ctx, [x, yb], [x + 1.2, yt], A.C.wood[1], 1.6);
    var tx = x + 1.2, ty = yt;
    if (s.weapon === 'ji') {
      A.poly(ctx, [[tx - 1.6, ty], [tx, ty - 7], [tx + 1.6, ty]], '#e6eef4', 0.7);
      A.poly(ctx, [[tx + 0.6, ty + 2], [tx + 5, ty], [tx + 5.5, ty + 3.5], [tx + 0.6, ty + 4]], '#e6eef4', 0.7);
    } else {
      A.poly(ctx, [[tx - 1.8, ty], [tx, ty - 6.5], [tx + 1.8, ty]], '#e6eef4', 0.7);
      A.poly(ctx, [[tx - 1.6, ty + 0.5], [tx + 1.6, ty + 0.5], [tx + 0.8, ty + 3.5], [tx - 0.8, ty + 3.5]], A.C.hanRed, 0.4);
    }
  }
  function headgear(ctx, s, hy, back) {
    var C = A.C, hc = s.headCol || C.wood[1];
    switch (s.head) {
      case 'scarf': case 'yellow':
        ctx.beginPath(); ctx.moveTo(-9.6, hy - 1); ctx.quadraticCurveTo(-9.5, hy - 11.5, 0, hy - 11.5); ctx.quadraticCurveTo(9.5, hy - 11.5, 9.6, hy - 1);
        ctx.quadraticCurveTo(0, hy - 4.5, -9.6, hy - 1); ctx.fillStyle = hc; ctx.fill(); A.edge(ctx, 0.6);
        A.ellipse(ctx, -3.5, hy - 8, 2.5, 1.4, A.tone(hc, 1.25));
        A.poly(ctx, [[7.5, hy - 5], [12.5, hy - 2], [11, hy + 3], [8, hy - 1]], A.tone(hc, 0.85), 0.6);
        break;
      case 'bun':
        A.circle(ctx, 0.5, hy - 10.5, 4, C.hair, 0.6);
        A.poly(ctx, [[-2.8, hy - 9], [3.8, hy - 9], [3.8, hy - 7.5], [-2.8, hy - 7.5]], hc, 0.5);
        A.line(ctx, [-4.5, hy - 11.5], [5.5, hy - 10], C.gold, 1.2);
        break;
      case 'helmet':
        ctx.beginPath(); ctx.arc(0, hy - 1, 10.2, Math.PI, 0); ctx.closePath(); ctx.fillStyle = hc; ctx.fill(); A.edge(ctx, 0.7);
        A.poly(ctx, [[-10.6, hy - 2.5], [10.6, hy - 2.5], [10.6, hy], [-10.6, hy]], A.tone(hc, 0.7), 0.6);
        A.ellipse(ctx, -4, hy - 7, 3, 1.6, A.tone(hc, 1.35));
        A.line(ctx, [0, hy - 11], [0, hy - 13], C.gold, 2);
        ctx.beginPath(); ctx.moveTo(0, hy - 13); ctx.quadraticCurveTo(-5, hy - 18, 1, hy - 20); ctx.quadraticCurveTo(4, hy - 16, 0, hy - 13);
        ctx.fillStyle = s.plume || C.hanRed; ctx.fill(); A.edge(ctx, 0.6);
        break;
      case 'hat':
        A.poly(ctx, [[-13.5, hy - 3], [0, hy - 13], [13.5, hy - 3], [0, hy - 1]], hc, 0.8);
        A.poly(ctx, [[-13.5, hy - 3], [0, hy - 13], [-2, hy - 1.6]], A.tone(hc, 1.15), 0);
        A.line(ctx, [-10, hy - 2.6], [10, hy - 2.6], A.tone(hc, 0.6), 1);
        break;
      case 'guan':
        A.poly(ctx, [[-4, hy - 13], [4, hy - 13], [4.5, hy - 8], [-4.5, hy - 8]], C.lacquer, 0.7);
        A.line(ctx, [-7, hy - 9.5], [7, hy - 9.5], C.gold, 1.2);
        break;
      case 'kid':
        A.circle(ctx, -6.5, hy - 8, 3.2, s.hair || C.hair, 0.6); A.circle(ctx, 6.5, hy - 8, 3.2, s.hair || C.hair, 0.6);
        A.line(ctx, [-8.5, hy - 6.5], [-4.5, hy - 9.5], hc, 1.4); A.line(ctx, [8.5, hy - 6.5], [4.5, hy - 9.5], hc, 1.4);
        break;
      case 'woman':
        A.ellipse(ctx, 5, hy - 9, 5, 3.6, s.hair || C.hair, 0.6);
        A.line(ctx, [0, hy - 11], [10, hy - 8], C.gold, 1.2); A.circle(ctx, 9.6, hy - 8.2, 1.4, hc);
        if (!back) A.circle(ctx, -7.5, hy - 5, 1.8, hc, 0.4);
        break;
      case 'fur':
        ctx.beginPath(); ctx.arc(0, hy - 1, 10.4, Math.PI, 0); ctx.closePath(); ctx.fillStyle = hc; ctx.fill(); A.edge(ctx, 0.6);
        A.poly(ctx, [[-11, hy - 3], [11, hy - 3], [11, hy + 0.5], [-11, hy + 0.5]], '#f6f0e4', 0.6);
        break;
    }
    void back;
  }
  function head(ctx, s, bob, back) {
    var C = A.C, hy = -25 + bob, hair = s.hair || C.hair;
    A.circle(ctx, 0, hy, 9.8, hair, 0.7);
    if (!back) {
      A.ellipse(ctx, -1, hy + 1.6, 8.3, 7.6, C.skin);
      ctx.beginPath(); ctx.moveTo(-9.6, hy + 0.5); ctx.quadraticCurveTo(-8, hy - 8.5, 0, hy - 8.5);
      ctx.quadraticCurveTo(7.5, hy - 8.5, 9.6, hy + 1); ctx.quadraticCurveTo(4, hy - 3.5, -1, hy - 2.2); ctx.quadraticCurveTo(-6, hy - 2.5, -9.6, hy + 0.5);
      ctx.fillStyle = hair; ctx.fill();
      A.ellipse(ctx, -4.6, hy + 2.2, 1.5, 2.1, '#2a1a14'); A.ellipse(ctx, 1.6, hy + 2.2, 1.5, 2.1, '#2a1a14');
      A.circle(ctx, -5.1, hy + 1.4, 0.6, '#ffffff'); A.circle(ctx, 1.1, hy + 1.4, 0.6, '#ffffff');
      if (s.fierce) { A.line(ctx, [-6.6, hy - 1], [-3, hy + 0.2], '#2a1a14', 1.3); A.line(ctx, [3.6, hy - 1], [0.2, hy + 0.2], '#2a1a14', 1.3); }
      ctx.globalAlpha = 0.55; A.ellipse(ctx, -6.6, hy + 5, 1.7, 1, C.blush); A.ellipse(ctx, 3.8, hy + 5, 1.7, 1, C.blush); ctx.globalAlpha = 1;
      if (s.beard) {
        ctx.beginPath(); ctx.moveTo(-6, hy + 5); ctx.quadraticCurveTo(-1, hy + 14, 4, hy + 5); ctx.quadraticCurveTo(-1, hy + 8, -6, hy + 5);
        ctx.fillStyle = hair; ctx.fill();
      } else A.line(ctx, [-2.2, hy + 6.2], [-0.4, hy + 6.4], '#a0503c', 1);
    } else {
      A.ellipse(ctx, -2.5, hy - 3, 3.5, 2, A.tone(hair, 1.6));
    }
    headgear(ctx, s, hy, back);
  }
  // 畫「朝左下(SW)正面」或「朝左上(NW)背面」;右向由呼叫端水平翻轉
  A.chibiRaw = function (ctx, s, back, fr) {
    var C = A.C, bob = fr === 1 ? -1 : 0, l0 = fr === 1 ? 1.6 : 0;
    var tun = s.tunic, trim = s.trim || C.hanRed;
    if (!back && (s.weapon === 'spear' || s.weapon === 'ji')) pole(ctx, 8.6, -4 + bob, -38 + bob, s);
    if (s.cape && !back) A.poly(ctx, [[-6, -18 + bob], [6, -18 + bob], [10, -3], [-10, -3]], A.tone(s.cape, 0.8), 0.6);
    if (s.flag) { A.line(ctx, [7.5, -2 + bob], [8.5, -52 + bob], A.C.ink, 3); A.line(ctx, [7.5, -2 + bob], [8.5, -52 + bob], C.wood[1], 1.6); A.poly(ctx, [[8.5, -51 + bob], [20, -50 + bob], [19, -36 + bob], [8.5, -38 + bob]], s.flag, 0.8); A.circle(ctx, 14, -44 + bob, 3.2, C.gold, 0.4); }
    if (!s.mount) { leg(ctx, -3.6, 0 - l0, s.pants || C.wood[0]); leg(ctx, 3.4, 0, s.pants || C.wood[0]); }
    if (s.robe && !s.mount) { ctx.beginPath(); ctx.moveTo(-9, -8 + bob); ctx.lineTo(9, -8 + bob); ctx.quadraticCurveTo(11, -3, 10, -1.5); ctx.quadraticCurveTo(0, 0, -10, -1.5); ctx.quadraticCurveTo(-11, -3, -9, -8 + bob); ctx.fillStyle = A.tone(s.tunic, 0.92); ctx.fill(); A.edge(ctx, 0.7); }
    ctx.beginPath(); ctx.moveTo(-6, -18 + bob); ctx.lineTo(6, -18 + bob);
    ctx.quadraticCurveTo(9, -10 + bob, 9.8, -4.5); ctx.quadraticCurveTo(0, -3, -9.8, -4.5); ctx.quadraticCurveTo(-9, -10 + bob, -6, -18 + bob);
    ctx.fillStyle = tun; ctx.fill(); A.edge(ctx, 0.7);
    if (s.armor) A.poly(ctx, [[-6, -17 + bob], [6, -17 + bob], [6.8, -9 + bob], [-6.8, -9 + bob]], s.armor, 0.6);
    if (s.armor) for (var k = 0; k < 3; k++) A.line(ctx, [-6.2, -15 + k * 2.4 + bob], [6.2, -15 + k * 2.4 + bob], A.tone(s.armor, 0.7), 0.8);
    if (!back) {
      A.line(ctx, [-5, -18 + bob], [2, -10 + bob], trim, 2.2);
      A.line(ctx, [5, -18 + bob], [0, -13 + bob], trim, 1.6);
    }
    A.poly(ctx, [[-8.6, -9.6 + bob], [8.6, -9.6 + bob], [8.9, -7.4 + bob], [-8.9, -7.4 + bob]], s.belt || A.tone(C.wood[0], 1), 0.5);
    if (s.collar) A.ellipse(ctx, 0, -17.2 + bob, 7.6, 2.6, '#f6f0e4', 0.6);
    if (!back) A.circle(ctx, -1, -8.5 + bob, 1.2, C.gold);
    if (s.cape && back) A.poly(ctx, [[-6.5, -18 + bob], [6.5, -18 + bob], [10.5, -3], [-10.5, -3]], s.cape, 0.7);
    A.ellipse(ctx, -8.6, -12.5 + bob, 3, 4.5, A.tone(tun, 0.92), 0.6);
    A.ellipse(ctx, 8.6, -12.5 + bob, 3, 4.5, A.tone(tun, 0.92), 0.6);
    A.circle(ctx, -9, -8.6 + bob, 2.2, C.skin, 0.6); A.circle(ctx, 9, -8.6 + bob, 2.2, C.skin, 0.6);
    if (back && s.shield) A.ellipse(ctx, 0, -11 + bob, 6.5, 6.5, s.shieldCol || C.hanRed, 0.7);
    head(ctx, s, bob, back);
    if (back && (s.weapon === 'spear' || s.weapon === 'ji')) pole(ctx, 8.6, -4 + bob, -38 + bob, s);
    if (!back && s.shield === 'rect') {
      var sc = s.shieldCol || C.hanRed;
      A.poly(ctx, [[-15, -18 + bob], [-6, -16 + bob], [-6, -2 + bob], [-15, -4 + bob]], sc, 0.8);
      A.poly(ctx, [[-14, -16.5 + bob], [-7, -15 + bob], [-7, -13.5 + bob], [-14, -15 + bob]], A.tone(sc, 1.3), 0);
      A.circle(ctx, -10.5, -10 + bob, 2, C.gold, 0.5);
    }
    if (s.prop) A.chibiProp(ctx, s.prop, back, bob, s);
    if (!back && s.shield === 'round') { A.circle(ctx, -10, -10 + bob, 6.5, s.shieldCol || C.wood[1], 0.8); A.circle(ctx, -10, -10 + bob, 2, C.gold, 0.5); }
    if (s.weapon === 'dao' && !back) {
      A.line(ctx, [9, -8 + bob], [15, -22 + bob], A.C.ink, 3.6); A.line(ctx, [9, -8 + bob], [15, -22 + bob], '#e6eef4', 2.2);
      A.line(ctx, [8.2, -8.8 + bob], [10.2, -7.6 + bob], C.gold, 2);
    }
    if (s.weapon === 'bow') {
      ctx.beginPath(); ctx.arc(back ? 9 : -11, -13 + bob, 10, -1.1, 1.1, false);
      ctx.strokeStyle = A.C.ink; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = C.wood[1]; ctx.lineWidth = 1.7; ctx.stroke();
      if (!back) A.line(ctx, [-6.4, -21.9 + bob], [-6.4, -4.1 + bob], '#f0e8d0', 0.8);
      else A.poly(ctx, [[-6, -19 + bob], [-2, -21 + bob], [1, -8 + bob], [-3, -7 + bob]], C.wood[0], 0.6);
    }
  };
  // 手持道具:pole 扁擔挑擔 | hoe 鋤 | scroll 書卷 | hammer 鐵鎚 | bowl 破碗 | basket 竹籃 | staff 拂塵/禪杖
  A.chibiProp = function (ctx, p, back, bob, s) {
    var C = A.C;
    switch (p) {
      case 'pole':
        A.line(ctx, [-17, -19 + bob], [17, -21 + bob], C.ink, 3); A.line(ctx, [-17, -19 + bob], [17, -21 + bob], C.wood[2], 1.6);
        [-16, 16].forEach(function (x) {
          A.line(ctx, [x - 3, -10 + bob], [x, -20 + bob], C.ink, 0.7); A.line(ctx, [x + 3, -10 + bob], [x, -20 + bob], C.ink, 0.7);
          A.poly(ctx, [[x - 5, -10 + bob], [x + 5, -10 + bob], [x + 4, -4 + bob], [x - 4, -4 + bob]], C.thatch, 0.7);
          A.ellipse(ctx, x, -10.5 + bob, 4.6, 1.6, x < 0 ? '#7ccc4c' : '#f2603c', 0.4);
        });
        break;
      case 'hoe':
        A.line(ctx, [10, -5 + bob], [-6, -32 + bob], C.ink, 3); A.line(ctx, [10, -5 + bob], [-6, -32 + bob], C.wood[1], 1.6);
        A.poly(ctx, [[-6, -32 + bob], [-11, -29 + bob], [-12, -33 + bob], [-7, -35 + bob]], '#c8d0d8', 0.7);
        break;
      case 'scroll':
        if (!back) { A.poly(ctx, [[-4, -12 + bob], [4, -12 + bob], [4, -7 + bob], [-4, -7 + bob]], '#e6cf8e', 0.7); for (var i = -3; i <= 3; i += 2) A.line(ctx, [i, -12 + bob], [i, -7 + bob], '#b8944a', 0.6); }
        break;
      case 'hammer':
        A.line(ctx, [9, -8 + bob], [13, -20 + bob], C.ink, 2.8); A.line(ctx, [9, -8 + bob], [13, -20 + bob], C.wood[1], 1.5);
        A.poly(ctx, [[10, -21 + bob], [16, -19 + bob], [16.5, -22 + bob], [10.5, -24 + bob]], '#5a5e66', 0.7);
        break;
      case 'bowl': if (!back) { A.ellipse(ctx, -9, -8 + bob, 3.6, 1.6, C.wood[1], 0.7); A.ellipse(ctx, -9, -8.6 + bob, 2.6, 0.8, '#3a2a22'); } break;
      case 'basket': A.ellipse(ctx, -10, -6 + bob, 4.4, 3.2, C.thatch, 0.7); A.ellipse(ctx, -10, -8 + bob, 3.6, 1.2, '#ff6f9a'); break;
      case 'staff': A.line(ctx, [9, -2 + bob], [10, -38 + bob], C.ink, 2.6); A.line(ctx, [9, -2 + bob], [10, -38 + bob], s.staffCol || C.gold, 1.4); A.circle(ctx, 10, -39 + bob, 2.2, s.staffCol || C.gold, 0.6); break;
    }
  };
  // facing:0 SW(正面) 1 NW(背面) 2 NE(背面,翻轉) 3 SE(正面,翻轉);frame 0/1
  A.chibiSprite = function (spec0, f, frame, res, todName, season) {
    var key = 'chibi|' + spec0.id + '|' + f + '|' + frame + '|' + (todName || 'noon') + '|' + (season || '') + '|' + res;
    if (A.cache[key]) return A.touch(key);
    var back = (f === 1 || f === 2), mir = (f === 2 || f === 3), tod = A.TOD[todName || 'noon'];
    // 季節衣著:冬 = 毛領 + 無帽者戴棉帽;夏 = 無帽平民戴草笠
    var spec = Object.assign({}, spec0);
    if (season === 'winter' && !spec.armor) { spec.collar = true; if (!spec.head) { spec.head = 'fur'; spec.headCol = '#9a6a3a'; } }
    if (season === 'summer' && spec.civil && !spec.head) { spec.head = 'hat'; spec.headCol = '#e3b95c'; }
    function body(c) {
      A.state.lit = tod.lit;
      c.save(); if (mir) c.scale(-1, 1);
      if (spec.scale) c.scale(spec.scale, spec.scale);
      if (spec.mount) { A.animalRaw(c, A.ANIMAL[spec.mount], back, frame); c.translate(1, -13); }
      A.chibiRaw(c, spec, back, frame);
      if (tod.lit && spec.night === 'lantern') { A.line(c, [-9, -8.6], [-11, -5], A.C.wood[0], 1.2); A.lantern(c, -11, -5, 0.8); }
      c.restore(); A.state.lit = false;
    }
    return A.sprite(key, res, { l: -30, t: -72, w: 60, h: 78 }, {
      tod: tod,
      under: function (c) { A.ellipse(c, 0, 0.5, 10, 4, 'rgba(30,60,20,' + (0.3 * tod.shadow).toFixed(3) + ')'); },
      body: body, emi: body, light: true
    });
  };
  // ---------------- 人物互動:泡泡 / 閒聊 / 進出門 ----------------
  // 泡泡類型:皆為向量圖示(不依賴 emoji 字型);n 只用於 talk 的點數 1..3
  A.BUBBLE = {
    talk: '閒聊 …', angry: '爭吵 💢', surprise: '驚訝 ❗', question: '疑問 ❓', happy: '愉快 ♪',
    beg: '乞討(破碗)', trade: '買賣(五銖錢)', love: '好感 ❤', sleep: '睏 z', idea: '想到(燈)'
  };
  A.bubbleSprite = function (kind, n, res) {
    var key = 'bub|' + kind + '|' + (n || 0) + '|' + res;
    if (A.cache[key]) return A.touch(key);
    return A.sprite(key, res, { l: -12, t: -22, w: 24, h: 24 }, {
      body: function (c) {
        var C = A.C, bg = kind === 'angry' ? '#fff0ec' : '#ffffff';
        c.beginPath(); c.moveTo(-8, -19); c.lineTo(8, -19); c.quadraticCurveTo(11, -19, 11, -16); c.lineTo(11, -8); c.quadraticCurveTo(11, -5, 8, -5);
        c.lineTo(2, -5); c.lineTo(-1, 0); c.lineTo(-2, -5); c.lineTo(-8, -5); c.quadraticCurveTo(-11, -5, -11, -8); c.lineTo(-11, -16); c.quadraticCurveTo(-11, -19, -8, -19); c.closePath();
        c.fillStyle = bg; c.fill(); A.edge(c, 0.9, 1);
        var y = -12;
        switch (kind) {
          case 'talk': for (var i = 0; i < (n || 3); i++) A.circle(c, -5 + i * 5, y, 1.5, C.ink); break;
          case 'angry':
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
              var a0 = Math.atan2(-q[1], -q[0]);
              c.beginPath(); c.arc(q[0] * 5, y + q[1] * 5, 3.4, a0 - 0.95, a0 + 0.95); c.strokeStyle = '#e8322a'; c.lineWidth = 2; c.lineCap = 'round'; c.stroke();
            }); break;
          case 'surprise': A.poly(c, [[-1.6, y - 5.5], [1.6, y - 5.5], [0.8, y + 1.5], [-0.8, y + 1.5]], '#e8322a', 0.4); A.circle(c, 0, y + 4, 1.4, '#e8322a'); break;
          case 'question':
            c.beginPath(); c.arc(0, y - 2.5, 3, Math.PI * 1.1, Math.PI * 0.45, false); c.strokeStyle = '#3e6fb0'; c.lineWidth = 2; c.stroke();
            A.circle(c, 0.6, y + 4, 1.3, '#3e6fb0'); break;
          case 'happy':
            A.ellipse(c, -2.5, y + 3, 2.2, 1.6, '#e86a9a'); A.line(c, [-0.5, y + 3], [-0.5, y - 5], '#e86a9a', 1.3);
            A.line(c, [-0.5, y - 5], [3.5, y - 3], '#e86a9a', 1.6); break;
          case 'beg': A.ellipse(c, 0, y + 1, 5.5, 2.4, C.wood[1], 0.7); A.ellipse(c, 0, y - 0.2, 4.2, 1.2, '#3a2a22'); break;
          case 'trade': A.circle(c, 0, y, 5, C.gold, 0.8); A.poly(c, [[-1.6, y - 1.6], [1.6, y - 1.6], [1.6, y + 1.6], [-1.6, y + 1.6]], bg, 0.6); break;
          case 'love':
            c.beginPath(); c.moveTo(0, y + 4.5); c.bezierCurveTo(-7, y - 1, -3, y - 6.5, 0, y - 2.5); c.bezierCurveTo(3, y - 6.5, 7, y - 1, 0, y + 4.5);
            c.fillStyle = '#e8322a'; c.fill(); break;
          case 'sleep': A.glyph(c, 'z', -2.5, y + 1.5, 7, '#3e6fb0'); A.glyph(c, 'z', 3.5, y - 2.5, 5, '#3e6fb0'); break;
          case 'idea': A.ellipse(c, 0, y - 1, 3.6, 4, '#ffd24a', 0.6); A.poly(c, [[-1.8, y + 3], [1.8, y + 3], [1.8, y + 5], [-1.8, y + 5]], C.stone[0], 0.4); break;
        }
      }
    });
  };
  // 依姿勢畫一個人物:p = {spec, x, y(腳底世界像素), f, fr, lean(px,上身往 +x 傾), nod(0/1), alpha, scale}
  A.chibiPose = function (ctx, p, res, tod, season) {
    var spr = A.chibiSprite(p.spec, p.f, p.fr || 0, res, tod, season);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.alpha !== undefined) ctx.globalAlpha *= p.alpha;
    var sc = p.scale || 1, sy = sc * (p.nod ? 0.96 : 1);
    // 傾斜 = 以腳底為原點的水平剪切:x' = x + k·y(y 向上為負,所以頭部位移 = −k·42)
    var k = -(p.lean || 0) / 42;
    ctx.transform(sc, 0, k * sc, sy, 0, 0);
    A.blit(ctx, spr, 0, 0);
    ctx.restore();
  };
  // 閒聊/爭吵/圍觀:a、b 為 chibiPose 參數;kind = A.BUBBLE 的 key;回合長 period 秒,兩人輪流說
  A.chat = function (ctx, a, b, t, kind, res, tod, season, o) {
    o = o || {};
    var period = o.period || (kind === 'angry' ? 0.6 : 1.2), lean = o.lean || (kind === 'angry' ? 3.5 : 2.2);
    var turn = Math.floor(t / period) % 2, ph = Math.floor(t / (period / 2)) % 2;
    var dirA = b.x >= a.x ? 1 : -1;
    a.lean = turn === 0 ? lean * dirA * (ph ? 1 : 0.5) : 0; a.nod = turn === 0 ? ph : 0;
    b.lean = turn === 1 ? -lean * dirA * (ph ? 1 : 0.5) : 0; b.nod = turn === 1 ? ph : 0;
    A.chibiPose(ctx, a, res, tod, season); A.chibiPose(ctx, b, res, tod, season);
    var sp = turn === 0 ? a : b, ot = turn === 0 ? b : a;
    var bx = sp.x * 0.7 + ot.x * 0.3, by = Math.min(sp.y, ot.y) - 44 * (sp.spec.scale || 1);
    var kinds = o.kinds || [kind, kind], k2 = kinds[turn], n = k2 === 'talk' ? (Math.floor(t * 3) % 3) + 1 : 0;
    var pop = Math.min(1, (t % period) / 0.15);
    ctx.save(); ctx.translate(bx, by); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    A.blit(ctx, A.bubbleSprite(k2, n, res), 0, 0); ctx.restore();
  };
  // 單人頭上泡泡(圍觀、乞討、叫賣)
  A.bubble = function (ctx, x, y, kind, t, res, scale) {
    var n = kind === 'talk' ? (Math.floor(t * 3) % 3) + 1 : 0;
    ctx.save(); ctx.translate(x, y - 44 * (scale || 1)); A.blit(ctx, A.bubbleSprite(kind, n, res), 0, 0); ctx.restore();
  };
  // 進出門:p 0→1 = 從門外走進門內(出門則 1→0);alpha 線性,縮放 2 段(1.0 / 0.9),沿正面法線往門內移 0.3 格
  A.doorStep = function (p) {
    p = Math.max(0, Math.min(1, p));
    return { alpha: 1 - p, scale: p < 0.5 ? 1 : 0.9, move: 0.3 * p };
  };
  // 單位手提燈籠光暈位置(相對腳底)
  A.unitLight = function (ctx, spec, x, y, f, v, t) {
    var tod = A.todOf(v);
    if (!tod.glow || spec.night !== 'lantern') return;
    var mir = (f === 2 || f === 3) ? -1 : 1;
    A.glow(ctx, x - 11 * mir, y - 1, 26, A.C.lantern, tod.glow * 0.7 * (0.9 + 0.1 * Math.sin(t * 9)));
  };

  // ---------------- 地面 ----------------
  A.GROUND = {
    spring: ['#8ed259', '#97d962', '#86cb52', '#5fa63a'], summer: ['#6fc04a', '#79c853', '#68b843', '#4a9632'],
    autumn: ['#cfc261', '#d7ca69', '#c6b857', '#a39342'], winter: ['#eaf2f7', '#f2f7fb', '#e1ebf3', '#b9cad8']
  };
  A.ground = function (ctx, gx, gy, season, road, tod) {
    var g0 = A.GROUND[season] || A.GROUND.spring, P = A.P, mul = tod && A.TOD[tod] ? A.TOD[tod].mul : null;
    var g = mul ? g0.map(function (c) { return A.mulHex(c, mul); }) : g0;
    var roadCol = A.mulHex(season === 'winter' ? '#dfe3e6' : '#e8cf92', mul), pebble = A.mulHex('#c9ad72', mul);
    var h = (((gx * 73856093) ^ (gy * 19349663)) >>> 0);
    var pts = [P(gx, gy, 0), P(gx + 1, gy, 0), P(gx + 1, gy + 1, 0), P(gx, gy + 1, 0)];
    A.poly(ctx, pts, road ? roadCol : g[h % 3], 0);
    ctx.save(); ctx.globalAlpha = 0.12; A.path(ctx, pts); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    if (road) {
      if ((h >>> 4) % 3 === 0) { var q = P(gx + 0.3 + ((h >>> 6) % 5) / 10, gy + 0.3 + ((h >>> 9) % 5) / 10, 0); A.ellipse(ctx, q[0], q[1], 2.2, 1.2, pebble); }
      return;
    }
    if ((h >>> 3) % 3 === 0) {
      var p = P(gx + 0.25 + ((h >>> 5) % 6) / 10, gy + 0.25 + ((h >>> 9) % 6) / 10, 0);
      A.line(ctx, [p[0] - 2, p[1]], [p[0] - 3, p[1] - 4], g[3], 1.2);
      A.line(ctx, [p[0], p[1]], [p[0], p[1] - 5], g[3], 1.2);
      A.line(ctx, [p[0] + 2, p[1]], [p[0] + 3, p[1] - 4], g[3], 1.2);
    }
    if (season === 'spring' && (h >>> 11) % 5 === 0) {
      var f = P(gx + 0.5 + ((h >>> 13) % 4) / 10 - 0.15, gy + 0.4 + ((h >>> 15) % 4) / 10, 0);
      A.circle(ctx, f[0], f[1], 1.4, A.mulHex((h >>> 17) % 2 ? '#ffffff' : '#ffe066', mul));
    }
  };
  // bw×bd 的草地小台座(前緣有土側面),road(gx,gy) 回傳 true 的格畫成路
  A.board = function (ctx, bw, bd, season, road, tod) {
    var P = A.P, x, y, mul = tod && A.TOD[tod] ? A.TOD[tod].mul : null;
    for (y = 0; y < bd; y++) for (x = 0; x < bw; x++) A.ground(ctx, x, y, season, road ? road(x, y) : false, tod);
    var side = A.mulHex(season === 'winter' ? '#b9a48a' : '#b98250', mul);
    for (x = 0; x < bw; x++) A.poly(ctx, [P(x, bd, 0), P(x + 1, bd, 0), P(x + 1, bd, -9), P(x, bd, -9)], A.tone(side, 0.92), 0.4);
    for (y = 0; y < bd; y++) A.poly(ctx, [P(bw, y + 1, 0), P(bw, y, 0), P(bw, y, -9), P(bw, y + 1, -9)], A.tone(side, 0.72), 0.4);
  };
  return A;
})();

(function (A) {
  var C = A.C;
  var FONT = '"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';
  A.glyph = function (ctx, ch, x, y, px, col) {
    ctx.save(); ctx.font = 'bold ' + px + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col; ctx.fillText(ch, x, y); ctx.restore();
  };
  // 立在局部 u 方向平面(F/B 面)或 v 方向平面上的圓盤:輪子、靶、鼓面
  A.disc = function (ctx, m, u, v, z, r, plane, fill, edge) {
    var pts = [], n = 18;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, c = Math.cos(a) * r / 34, s = Math.sin(a) * r;
      pts.push(plane === 'u' ? m.pt(u + c, v, z + s) : m.pt(u, v + c, z + s));
    }
    A.poly(ctx, pts, fill, edge === undefined ? 0.7 : edge);
    return pts;
  };
  A.visible = function (m, face) { var d = m.wdir(face); return d === '+x' || d === '+y'; };
  // 酒罈:黑陶圓肚 + 紅布封口 + 紅紙「酒」字
  A.jar = function (ctx, x, y, s, label) {
    var k = s;
    ctx.beginPath(); ctx.moveTo(x - 3 * k, y - 15 * k); ctx.quadraticCurveTo(x - 9.5 * k, y - 12 * k, x - 7 * k, y - 3 * k);
    ctx.quadraticCurveTo(x - 6 * k, y, x, y); ctx.quadraticCurveTo(x + 6 * k, y, x + 7 * k, y - 3 * k);
    ctx.quadraticCurveTo(x + 9.5 * k, y - 12 * k, x + 3 * k, y - 15 * k); ctx.closePath();
    var g = ctx.createLinearGradient(x - 8 * k, 0, x + 8 * k, 0);
    g.addColorStop(0, '#5a4a44'); g.addColorStop(0.4, '#332825'); g.addColorStop(1, '#1d1614');
    ctx.fillStyle = g; ctx.fill(); A.edge(ctx, 0.8);
    A.ellipse(ctx, x - 3.6 * k, y - 10 * k, 1.4 * k, 3 * k, 'rgba(255,255,255,0.35)');
    A.poly(ctx, [[x - 3.4 * k, y - 15 * k], [x + 3.4 * k, y - 15 * k], [x + 4.4 * k, y - 18.5 * k], [x - 4.4 * k, y - 18.5 * k]], A.C.hanRed, 0.7);
    A.ellipse(ctx, x, y - 18.8 * k, 4.6 * k, 1.8 * k, A.tone(A.C.hanRed, 1.15), 0.6);
    A.line(ctx, [x - 3.6 * k, y - 15.6 * k], [x + 3.6 * k, y - 15.6 * k], A.C.gold, 0.9 * k);
    if (label !== false) {
      A.poly(ctx, [[x, y - 12.5 * k], [x + 4 * k, y - 8.5 * k], [x, y - 4.5 * k], [x - 4 * k, y - 8.5 * k]], '#e83a2a', 0.5);
      A.glyph(ctx, label || '酒', x, y - 8.4 * k, 4.6 * k, '#1d1614');
    }
  };

  A.goods = function (ctx, kind, x, y, i) {
    var C2 = ['#ffd24a', '#e83a2a', '#7ccc4c', '#f2603c', '#9a5cc8', '#4ab7ec'];
    switch (kind) {
      case 'veg': A.circle(ctx, x, y - 2.5, 3, i % 2 ? '#7ccc4c' : '#a8e070', 0.6); if (i % 2) A.poly(ctx, [[x + 3, y - 2], [x + 8, y - 1], [x + 3, y]], '#f2903a', 0.5); break;
      case 'fruit': A.circle(ctx, x - 1.5, y - 2, 2, '#e83a2a', 0.5); A.circle(ctx, x + 1.5, y - 2, 2, '#ffb02e', 0.5); A.circle(ctx, x, y - 4.5, 2, '#e83a2a', 0.5); break;
      case 'cloth': A.poly(ctx, [[x - 4, y], [x + 4, y], [x + 4, y - 4], [x - 4, y - 4]], C2[i % 6], 0.6); A.line(ctx, [x - 4, y - 2], [x + 4, y - 2], 'rgba(255,255,255,0.6)', 0.8); break;
      case 'pottery': A.jar(ctx, x, y, 0.38, false); break;
      case 'rice': A.ellipse(ctx, x, y - 1.5, 4.5, 2.4, C.wood[1], 0.6); A.ellipse(ctx, x, y - 3, 3.6, 1.8, '#fbf6e8'); break;
      case 'book': for (var k = 0; k < 3; k++) A.line(ctx, [x - 3 + k * 2.4, y], [x - 3 + k * 2.4, y - 6], k % 2 ? '#e6cf8e' : '#d4b46a', 2); A.line(ctx, [x - 4, y - 3], [x + 3, y - 3], '#8a2a22', 0.8); break;
      case 'rouge': A.ellipse(ctx, x, y - 1.5, 3, 1.6, i % 2 ? '#ff6f9a' : '#e83a5a', 0.6); A.ellipse(ctx, x, y - 2.4, 2.2, 1, '#ffd0de'); break;
      case 'meat': A.ellipse(ctx, x, y - 2, 3.5, 2.2, '#e86a5a', 0.6); A.ellipse(ctx, x - 1, y - 2.6, 1.8, 1, '#ffe0d0'); break;
    }
  };
  A.signFlag = function (ctx, x, y, h, ch, cloth, ink) {
    A.line(ctx, [x, y], [x, y - h], C.ink, 3); A.line(ctx, [x, y], [x, y - h], C.wood[0], 1.6);
    A.line(ctx, [x, y - h + 1], [x + 9, y - h + 1], C.ink, 2);
    A.poly(ctx, [[x + 1.5, y - h + 2], [x + 9.5, y - h + 2], [x + 9.5, y - h + 18], [x + 5.5, y - h + 15.5], [x + 1.5, y - h + 18]], cloth, 0.8);
    A.glyph(ctx, ch, x + 5.5, y - h + 8.8, 7, ink);
  };

  A.animalRaw = function (ctx, a, back, fr) {
    var s = a.size || 1, C3 = A.C, sw = fr ? 1.4 : 0;
    ctx.save(); ctx.scale(s, s);
    if (a.bird) {
      A.line(ctx, [-1, -3], [-1 - sw, 0], '#f29a2a', 1.4); A.line(ctx, [3, -3], [3 + sw, 0], '#f29a2a', 1.4);
      if (a.tail) A.poly(ctx, [[6, -8], [12, -16], [11, -6]], a.tail, 0.7);
      else A.poly(ctx, [[6, -7], [11, -12], [9, -5]], A.tone(a.body, 0.9), 0.6);
      A.ellipse(ctx, 1.5, -7, 7, 5.2, a.body, 0.8);
      A.ellipse(ctx, 3, -7.5, 4, 2.6, A.tone(a.body, 0.88), 0.4);
      var hx = a.longNeck ? -6 : -4, hy = a.longNeck ? -17 : -11.5;
      if (a.longNeck) A.line(ctx, [-3, -9], [hx, hy], a.body, 4.4);
      A.circle(ctx, hx, hy, 3.6, a.body, 0.8);
      if (!back) {
        if (a.bill) A.ellipse(ctx, hx - 4.2, hy + 0.5, 2.8, 1.3, a.bill, 0.6);
        else A.poly(ctx, [[hx - 3, hy - 0.6], [hx - 6.4, hy + 0.6], [hx - 3, hy + 1.6]], '#f2a52a', 0.6);
        A.circle(ctx, hx - 1, hy - 0.8, 0.9, '#2a1a14');
      }
      if (a.comb) { A.circle(ctx, hx, hy - 3.6, 1.6, '#e83a2a'); A.circle(ctx, hx + 1.8, hy - 3, 1.3, '#e83a2a'); if (!back) A.ellipse(ctx, hx - 2.6, hy + 2.6, 1, 1.5, '#e83a2a'); }
    } else {
      var lg = A.tone(a.body, 0.7);
      var legs = [[-6, sw], [-2.5, -sw], [5, -sw], [8.5, sw]];
      legs.forEach(function (l) { A.poly(ctx, [[l[0] - 1.6, -7], [l[0] + 1.6, -7], [l[0] + 1.4 + l[1] * 0.3, -0.5], [l[0] - 1.4 + l[1] * 0.3, -0.5]], lg, 0.6); A.ellipse(ctx, l[0] + l[1] * 0.3, -0.5, 1.8, 1, '#3a2a22'); });
      var hx2 = back ? -9 : -12, hy2 = a.neck ? (back ? -22 : -21) : (back ? -15 : -13);
      if (back) drawHead();
      A.line(ctx, [10.5, -12], [13, -5], a.mane || A.tone(a.body, 0.6), 1.6);
      if (a.wool) { [[-4, -12], [1, -14], [6, -12], [9, -9], [-6, -8], [2, -8.5]].forEach(function (q) { A.circle(ctx, q[0], q[1], 4.6, a.body, 0.6); }); }
      else { A.ellipse(ctx, 2, -11, 10.5, 6.2, a.body, 0.8); A.ellipse(ctx, 2, -8, 7.5, 2.6, a.belly); }
      if (a.hump) A.ellipse(ctx, 2, -17, 4.5, 3.5, a.body, 0.7);
      if (a.neck) A.poly(ctx, [[-7, -15], [-3, -11], [hx2 + 3, hy2 + 3], [hx2 - 1, hy2 + 1]], a.body, 0.7);
      if (a.mane) A.poly(ctx, [[-4, -16], [hx2 + 2, hy2 - 2], [hx2 + 4, hy2], [-2, -14]], a.mane, 0.5);
      if (!back) drawHead();
    }
    ctx.restore();
    function drawHead() {
      var hc = a.head;
      if (a.horn) { A.line(ctx, [hx2 + 1, hy2 - 3], [hx2 + 4, hy2 - 7], C3.ink, 2.6); A.line(ctx, [hx2 + 1, hy2 - 3], [hx2 + 4, hy2 - 7], a.horn, 1.5); }
      if (a.longEar) A.ellipse(ctx, hx2 + 2, hy2 - 6, 1.5, 4.5, hc, 0.6);
      else if (a.upEar) A.poly(ctx, [[hx2, hy2 - 3], [hx2 + 2, hy2 - 8], [hx2 + 4, hy2 - 3]], hc, 0.6);
      else A.ellipse(ctx, hx2 + 3.5, hy2 - 3, 2.6, 1.3, hc, 0.6);
      A.ellipse(ctx, hx2, hy2, 5.2, 4.4, hc, 0.8);
      if (!back) {
        if (a.snout) { A.ellipse(ctx, hx2 - 4.4, hy2 + 1, 2.4, 2.2, A.tone(hc, 0.9), 0.6); A.circle(ctx, hx2 - 4.8, hy2 + 0.8, 0.5, '#7a3a3a'); }
        else A.ellipse(ctx, hx2 - 3.6, hy2 + 1.4, 3, 2.4, a.wool ? hc : A.tone(hc, 1.25), 0.6);
        A.circle(ctx, hx2 - 0.6, hy2 - 1, 1, '#1a120e'); A.circle(ctx, hx2 - 0.9, hy2 - 1.3, 0.35, '#ffffff');
        if (a.beard) A.poly(ctx, [[hx2 - 3, hy2 + 3], [hx2 - 1, hy2 + 3], [hx2 - 2, hy2 + 7]], '#f6f0e0', 0.4);
      }
    }
  };

  A.rock = function (ctx, x, y, s, seed, col) {
    var r = A.rng(seed), pts = [], top = [], n = 9, i;
    for (i = 0; i < n; i++) { var a = Math.PI + i / (n - 1) * Math.PI, k = 0.8 + r() * 0.35; pts.push([x + Math.cos(a) * 9 * s * k, y + Math.sin(a) * 9 * s * k * 0.95 - 2 * s]); }
    pts.push([x + 9 * s, y]); pts.push([x - 9 * s, y]);
    A.poly(ctx, pts, A.tone(col, 0.82), 0.8);
    for (i = 0; i < 5; i++) top.push(pts[i + 1]);
    top.push([x + 1 * s, y - 3 * s]); top.push([x - 6 * s, y - 2 * s]);
    A.poly(ctx, top.slice(0, 4).concat([[x - 1 * s, y - 6 * s], [x - 7 * s, y - 4 * s]]), A.tone(col, 1.1), 0);
  };
})(ART);

// ---------------- 美術開關與時段(ART-03;render.js 掛點呼叫)----------------
// 載入時只宣告;localStorage 延遲到第一次讀取,全部 try/catch。
var ART_KEY = 'lorddomain.art.v1';
var ART_TOD_KEYS = ['dawn', 'noon', 'dusk', 'night'];
var ART_TYPE_MAP = {
  house: 'house', palace: 'palace', tree: 'tree', bridge: 'bridge',
  lumber: 'lumberyard', quarry: 'quarry', market: 'stall', gate: 'gatehouse', wall: 'wallseg',
  research: 'academy', archer: 'archeryrange', shield: 'barracks', cavalry: 'stable', siege: 'siegeyard',
  hospital: 'shop', stone: 'rocks', ramp: 'ramp',
  hq: 'camp_hq', tower: 'camp_tower', nutai: 'camp_nutai', shitai: 'camp_shitai', tent: 'camp_tent',
  wagon: 'camp_wagon', granary: 'camp_granary', muster: 'camp_muster', banner: 'camp_banner', fakecamp: 'camp_fake',
  lujiao: 'camp_lujiao'
};
var ART_TREE_KINDS = ['round', 'pine', 'sakura', 'maple', 'willow'];
var artSt = null;
var artTodMemo = { at: 0, key: 'noon' };
var artTileMemo = {};

function artStLoad() {
  if (artSt) return artSt;
  artSt = { on: true, tod: 'auto' };
  try {
    var j = JSON.parse(localStorage.getItem(ART_KEY) || 'null');
    if (j && typeof j.on === 'boolean') artSt.on = j.on;
    if (j && typeof j.tod === 'string') artSt.tod = j.tod;
  } catch (e) { /* 讀取失敗用預設值 */ }
  return artSt;
}
function artStSave() {
  var st = artStLoad();
  try { localStorage.setItem(ART_KEY, JSON.stringify({ on: st.on, tod: st.tod })); } catch (e) { /* 無法寫入只影響下次記憶 */ }
}
function artNoArtParam() {
  try { return /[?&]noart(&|=|$)/.test(location.search); } catch (e) { return false; }
}
function artIsOn() { return artNoArtParam() ? false : artStLoad().on; }
function artSetOn(v) { artStLoad().on = !!v; artStSave(); }

function artTodKey() {
  var st = artStLoad();
  if (ART_TOD_KEYS.indexOf(st.tod) >= 0) return st.tod;
  var now = Date.now();
  if (now - artTodMemo.at >= 1000) {
    var d = new Date(now);
    artTodMemo.at = now;
    artTodMemo.key = ART_TOD_KEYS[Math.floor((d.getHours() * 60 + d.getMinutes()) / 15) % 4];
  }
  return artTodMemo.key;
}
function artSetTod(v) {
  var st = artStLoad();
  st.tod = (v === 'auto' || ART_TOD_KEYS.indexOf(v) >= 0) ? v : 'auto';
  artTodMemo.at = 0;
  artStSave();
  if (typeof ART !== 'undefined' && ART.clearCache) ART.clearCache();
}
(function () {
  var g = typeof window !== 'undefined' ? window : this;
  Object.defineProperty(g, 'ART_ON', { get: artIsOn, set: artSetOn, configurable: true });
  Object.defineProperty(g, 'ART_TOD', { get: artTodKey, set: artSetTod, configurable: true });
})();

function artType(type) {
  if (Object.prototype.hasOwnProperty.call(ART_TYPE_MAP, type)) return ART_TYPE_MAP[type];
  // 未列於對照表的新物件(art_deco*.js 等):ART 若有同名定義就直接使用
  return (typeof ART !== 'undefined' && ART.OBJ && Object.prototype.hasOwnProperty.call(ART.OBJ, type)) ? type : null;
}
function artFacing(o) { return (o.facing != null ? o.facing : o.rot) || 0; }
// 城牆相鄰判定:x 軸向 / y 軸向是否有城牆或城門,回傳 'x'、'y'、'xy' 或 ''(含門的佔格)
function artWallConn(o) {
  var hit = function (x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
    var n = world.occ[idx(x, y)];
    if (!n) return false;
    var p = world.objects[n - 1];
    return !!p && (p.type === 'wall' || p.type === 'gate');
  };
  var s = '';
  if (hit(o.x - 1, o.y) || hit(o.x + 1, o.y)) s += 'x';
  if (hit(o.x, o.y - 1) || hit(o.x, o.y + 1)) s += 'y';
  return s;
}

function artVariant(o) {
  var seed = typeof cellHash === 'function' ? cellHash(o.x, o.y) : ((o.x * 73856093) ^ (o.y * 19349663)) >>> 0;
  var season = (typeof currentSeason !== 'undefined' && currentSeason) ? currentSeason : 'spring';
  var v = { season: season, tod: artTodKey(), seed: seed, level: o.level || 0, skin: '' };
  if (o.type === 'hospital') v.skin = 'herb';
  if (o.type === 'wall') v.skin = artWallConn(o);
  if (o.type === 'tree') v.kind = ART_TREE_KINDS[seed % ART_TREE_KINDS.length];
  v.dmg = o.dmg || 0;
  return v;
}

// 回傳 true 表示已由 ART 畫好;false 則呼叫端走舊繪製
function artDrawObject(ctx, o, alpha) {
  if (!artIsOn()) return false;
  var t = artType(o.type);
  if (!t || typeof ART === 'undefined' || !ART.OBJ[t]) return false;
  var bh = world.height[idx(o.x, o.y)] * HL;
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ART.drawObj(ctx, t, o.x, o.y, bh, artFacing(o), artVariant(o), ART.resBucket(view.zoom * viewport.dpr), typeof drawNow === 'number' ? drawNow : undefined);
  ctx.restore();
  return true;
}

function artTile(color) {
  if (!artIsOn() || typeof ART === 'undefined' || !ART.TOD) return color;
  var k = artTodKey();
  var mul = ART.TOD[k] ? ART.TOD[k].mul : null;
  if (!mul) return color;
  var key = k + '|' + color;
  if (!artTileMemo[key]) artTileMemo[key] = ART.mulHex(color, mul);
  return artTileMemo[key];
}

function artSky(bg) {
  if (!artIsOn() || typeof ART === 'undefined' || !ART.TOD) return bg;
  var t = ART.TOD[artTodKey()];
  return t ? t.sky : bg;
}

// 夜間光暈 pass:只在昏 / 夜、非戰鬥回放模式、可見物件上疊加
function artLights(ctx, time) {
  if (!artIsOn()) return;
  var k = artTodKey();
  if (k !== 'dusk' && k !== 'night') return;
  if (game.mode === 'attack' || game.mode === 'replay') return;
  if (typeof ART === 'undefined' || !ART.drawLights || !ART.OBJ) return;
  if (hide.on && !pano.open) return;
  var list = world.objects;
  for (var i = 0; i < list.length; i++) {
    var o = list[i], t = artType(o.type);
    if (!t || !ART.OBJ[t] || !objVisible(o)) continue;
    ART.drawLights(ctx, t, o.x, o.y, world.height[idx(o.x, o.y)] * HL, artFacing(o), artVariant(o), time);
  }
}
