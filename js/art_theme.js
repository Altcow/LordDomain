// art_theme.js — 各國建築風格皮膚的 ART 變體(主題表見 theme_skin.js THEME_SKINS;PLAN_ETHNIC §4)
// 依賴 art.js、art_objects.js、art_town.js、art_deco*.js 先載入,並在 theme_skin.js 之後。不改既有 art 檔。
// 作法:不重畫整棟 —— 包裝原定義的 build:先照原樣畫,再在最上層(bias 999)以 source-atop 把「已畫出的像素」
//   往主題色票偏色(色票置換),外加一條飾帶(trim + 紋樣點)與少量細節;旗幟另換旗色。
// 變體 key = 'th_<主題>_<類型>';外觀變化數 ≤ 2,登記到 ART_SEED_VARIANTS(sprite 快取鍵 = key | seed 1~2 | 季節 | 時段)。
// 純外觀:不改 w / d / hmax / 數值。缺 theme_skin 或原定義不存在的類型自動略過。

(function (A) {
  if (typeof THEME_SKINS === 'undefined' || !A || !A.OBJ) return;
  var C = A.C;
  var KEYS = A.THEME = [];

  // 類型分組:帳篷類吃布色、民房吃牆色、瓦頂 / 竹樓吃屋頂色
  var CLOTH = { tent: 1, shack_lean: 1, flagpole: 1 };
  var ROOFY = { house_tile: 1, bamboo_house: 1 };

  function baseKey(type) {
    var k = (typeof artType === 'function') ? artType(type) : type;
    return k && A.OBJ[k] ? k : (A.OBJ[type] ? type : null);
  }
  function tintOf(type, pal, look) {
    if (CLOTH[type]) return [look ? pal.cloth2 : pal.cloth1, 0.42];
    if (ROOFY[type]) return [pal.roof, 0.34];
    return [look ? pal.trim : pal.wall, look ? 0.26 : 0.36];
  }
  function patDots(ctx, m, pat, a, b, z, pal) {
    var n = pat === 'arrow3' ? 3 : (pat === 'stripe5' ? 5 : 4), i, t, p;
    for (i = 0; i < n; i++) {
      t = (i + 0.5) / n; p = m.pt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z);
      var col = pat === 'stripe5' ? [pal.flag1, pal.flag2, pal.accent, pal.cloth2, pal.trim][i % 5] : pal.accent;
      if (pat === 'grape_diamond' || pat === 'felt_diamond') A.poly(ctx, [[p[0], p[1] - 2.4], [p[0] + 2, p[1]], [p[0], p[1] + 2.4], [p[0] - 2, p[1]]], col, 0.5);
      else A.circle(ctx, p[0], p[1], 1.3, col, 0.4);
    }
  }
  function wrap(themeId, type) {
    var bk = baseKey(type), base = bk && A.OBJ[bk];
    if (!base || typeof base.build !== 'function') return;
    var key = 'th_' + themeId + '_' + type, th = THEME_SKINS[themeId], pal = th.pal;
    var spec = {}, p;
    for (p in base) if (Object.prototype.hasOwnProperty.call(base, p)) spec[p] = base[p];
    spec.build = function (m, v) {
      var look = (v && v.seed === 2) ? 1 : 0;
      base.build(m, v);
      var W = base.w, D = base.d, z = Math.max(8, (base.hmax || 40) * 0.3);
      var tn = tintOf(type, pal, look);
      // 飾帶與紋樣(只在正面可見時畫)
      m.custom(0, 0, W, D, 0, function (ctx, mm) {
        if (type !== 'flagpole' && A.visible(mm, 'F')) {
          var a = [0.15, D], b = [W - 0.15, D], pa = mm.pt(a[0], a[1], z), pb = mm.pt(b[0], b[1], z);
          A.line(ctx, pa, pb, C.ink, 3.6); A.line(ctx, pa, pb, pal.trim, 2.2);
          patDots(ctx, mm, pal.pattern, a, b, z, pal);
          if (look) { var top = mm.pt(W / 2, D / 2, (base.hmax || 40) - 2); A.circle(ctx, top[0], top[1], 2, pal.accent, 0.5); }
        }
        // 色票置換:只作用在已畫出的像素
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = tn[1];
        ctx.fillStyle = tn[0]; ctx.fillRect(-400, -400, 800, 800); ctx.restore();
      }, 999);
    };
    if (type === 'flagpole') {
      spec.anim = function (ctx, m, t, v) {
        var q = m.pt(0.5, 0.5, 6), enemy = v && v.skin === 'enemy';
        A.flag(ctx, q[0], q[1], 70, 26, 18, enemy ? '#ffd23a' : pal.flag1, t, 0.3);
        if (!enemy) A.flag(ctx, q[0], q[1], 50, 18, 6, pal.flag2, t, 0.9);
      };
    }
    A.def(key, spec); KEYS.push(key);
    if (typeof ART_SEED_VARIANTS !== 'undefined') ART_SEED_VARIANTS[key] = th.looks > 1 ? 2 : 1;
  }

  Object.keys(THEME_SKINS).forEach(function (id) {
    THEME_SKINS[id].types.forEach(function (type) { wrap(id, type); });
  });
})(ART);
