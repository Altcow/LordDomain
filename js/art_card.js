// art_card.js — 卡牌與酒館 第一階段的三座招募建築:酒館 tavern(3×2)、考場 kao_chang(3×3,縣試)、殿試台 dian_shi_tai(3×2)。
// 風格同 art_nl.js(局部座標 (u,v)、正面在 v = D);物件登記沿用 nl_objects.js 的做法(併入 NL_NEW_OBJECTS 與 OBJECTS / BUILD_GROUPS),
// 解鎖歸屬走 NL_NEW_OBJECTS[id].tech(酒館 ed_xiangyin、考場 ed_xuexiao、殿試台 e_dongguan;與 NL_FEATURE_GATE 的 tavern / exam / dianshi 同節點)。
// 載入順序:art.js、art_objects.js、ui.js、nl_objects.js 之後。點擊接線:cardsui.js 的 cardsUiTap(o)(ui.js tapObjectAt 呼叫)。不發聲。ES2017;不用 ?. ??。
(function (A) {
  if (!A || typeof A.def !== 'function') return;
  var C = A.C;
  var TILE = '#6f7f88', TILE_DK = '#4d5c64', RED = '#d23a2c', PLASTER = '#eadfc4';

  var CARD_BUILDINGS = {
    tavern:       { name: '招賢館',   icon: '🍶', w: 3, h: 2, group: 'shop', tech: 'ed_xiangyin', cost: { coin: 180 } },
    kao_chang:    { name: '考場',   icon: '📜', w: 3, h: 3, group: 'rite', tech: 'ed_xuexiao',  cost: { coin: 260 } },
    dian_shi_tai: { name: '殿試台', icon: '🏯', w: 3, h: 2, group: 'rite', tech: 'e_dongguan',  cost: { coin: 420 } }
  };

  function sn(v) { return v && v.season === 'winter'; }
  function tile(v, col) { var r = A.rng((v && v.seed) || 1)(); return A.tone(col || TILE, 0.94 + r * 0.12); }
  function plaque(m, W, D, z, ch, ink, bg) {
    m.custom(W / 2 - 0.3, D - 0.1, 0.6, 0.06, z, function (ctx, mm) {
      if (!A.visible(mm, 'F')) return;
      var a = mm.pt(W / 2 - 0.26, D - 0.08, z), b = mm.pt(W / 2 + 0.26, D - 0.08, z);
      A.poly(ctx, [[a[0], a[1]], [b[0], b[1]], [b[0], b[1] - 7], [a[0], a[1] - 7]], bg || C.lacquer, 0.7);
      A.glyph(ctx, ch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 3.5, 6, ink || C.gold);
    }, 6);
  }
  function flagAt(m, u, v, h, col, ch, ink) {
    m.custom(u - 0.05, v - 0.05, 0.1, 0.1, 0, function (ctx, mm) { var p = mm.pt(u, v, 0); A.signFlag(ctx, p[0], p[1], h, ch, col, ink || C.gold); }, 3);
  }
  // 簡化殿堂:石基 + 粉牆(格窗、門)+ 廡殿頂。o: W D wh rise sign wall tile flag
  function hall(m, v, o) {
    var W = o.W, D = o.D, wh = o.wh || 22, rise = o.rise || 11, bh = 3, nl = Math.max(2, Math.round(W) + 1), tl = tile(v, o.tile);
    m.box(0.02, 0.02, 0, W - 0.04, D - 0.04, bh, C.stone[1], { top: C.stone[2] });
    m.box(0.12, 0.12, bh, W - 0.24, D - 0.24, wh, o.wall || PLASTER, { deco: {
      F: function (ctx, f) {
        A.band(ctx, f, 0, 2, C.wood[0]); A.posts(ctx, f, [0, 1], 2.4, C.wood[0]);
        var i, sc;
        for (i = 0; i < nl; i++) {
          sc = (i + 0.5) / nl;
          if (Math.abs(sc - 0.5) < 0.5 / nl + 0.04) continue;
          A.lattice(ctx, f, sc, Math.min(7, f.len / (nl + 1.4)), 6, Math.min(10, wh - 9), C.wood[1]);
        }
        A.door(ctx, f, 0.5, 7, Math.min(14, wh - 6), C.lacquer);
      },
      R: function (ctx, f) { A.band(ctx, f, 0, 2, C.wood[0]); A.posts(ctx, f, [0, 1], 2.4, C.wood[0]); A.lattice(ctx, f, 0.5, 7, 6, Math.min(10, wh - 9), C.wood[1]); }
    } });
    m.hip(0.0, 0.0, bh + wh, W, D, rise, tl, { over: 0.2, curl: 2, sag: 1, axis: W >= D ? 'u' : 'v', hipK: 0.5, ridgeCol: TILE_DK, snow: sn(v), hookSize: 3 });
    if (o.sign) plaque(m, W, D, bh + wh * 0.82, o.sign, o.ink, o.bg);
    if (o.flag) flagAt(m, W - 0.25, D - 0.2, 40, o.flag.col, o.flag.ch);
  }
  function litF(W, D, z) { return function () { return [[W / 2, D - 0.1, z, 22, C.lamp, 0.55, 'F']]; }; }

  A.def('tavern', { w: 3, d: 2, hmax: 62, shadow: 'rect', build: function (m, v) { hall(m, v, { W: 3, D: 2, wh: 22, rise: 11, sign: '酒', wall: '#e8d8b8', flag: { col: RED, ch: '酒' } }); }, lights: litF(3, 2, 14) });
  A.def('kao_chang', { w: 3, d: 3, hmax: 60, shadow: 'rect', build: function (m, v) { hall(m, v, { W: 3, D: 3, wh: 20, rise: 11, sign: '試', wall: '#e4d6b4', tile: '#5f7f6a' }); }, lights: litF(3, 3, 14) });
  A.def('dian_shi_tai', { w: 3, d: 2, hmax: 66, shadow: 'rect', build: function (m, v) { hall(m, v, { W: 3, D: 2, wh: 24, rise: 13, sign: '殿', wall: '#efe4c8', bg: C.lacquer, ink: C.gold }); }, lights: litF(3, 2, 14) });

  if (typeof NL_NEW_OBJECTS !== 'undefined' && typeof OBJECTS !== 'undefined') {
    Object.keys(CARD_BUILDINGS).forEach(function (id) {
      var s = CARD_BUILDINGS[id];
      if (!NL_NEW_OBJECTS[id]) NL_NEW_OBJECTS[id] = s;
      if (!OBJECTS[id]) {
        var o = { name: s.name, icon: s.icon, w: s.w, h: s.h, cost: s.cost, side: 'estate', nl: true, on: [T_GRASS, T_ROAD] };
        if (s.w !== s.h) o.swap = true;
        OBJECTS[id] = o;
      }
      if (typeof BUILD_GROUPS !== 'undefined') {
        var g = BUILD_GROUPS.find(function (x) { return x.id === s.group; });
        if (g && g.items.indexOf(id) < 0) g.items.push(id);
      }
    });
  }
})(typeof ART !== 'undefined' ? ART : null);
