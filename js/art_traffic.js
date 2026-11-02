// art_traffic.js — 街景角色外觀:馬車 / 牛車 / 載客馬車、信使騎士、叫賣者(托盤 / 推車)。依賴 art.js、art_units.js、art_port.js 之後載入。
// 作法同苦力:登記 ART.UNIT 的 spec(馬車用 spec.draw,畫法重用 ART.animalRaw 與 cart 物件的圖案),
// 手持道具 tray / pushcart 以包裝 ART.chibiProp 擴充;全部走 ART.chibiSprite 的 2 向 + 水平翻轉快取(key = chibi|<id>|…)。
// 新增外觀 id:wagon_goods / wagon_hay / wagon_fancy / courier / courier_w / hawker_tray / hawker_cart(共 7 個,另有 civil 替代服色 +2)。

(function (A) {
  if (!A || !A.UNIT || !A.ANIMAL || !A.animalRaw) return;
  var C = A.C;

  // ---- 車輪:輪圈 + 輪輻(fr 切換輪輻角度 = 轉動感) ----
  function wheel(ctx, x, y, r, fr, col) {
    A.circle(ctx, x, y, r, col || C.wood[1], 0.8);
    A.circle(ctx, x, y, r * 0.58, A.tone(col || C.wood[1], 0.8), 0.4);
    var a0 = fr ? 0.45 : 0;
    for (var i = 0; i < 3; i++) {
      var a = a0 + i * Math.PI / 3;
      A.line(ctx, [x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9], [x - Math.cos(a) * r * 0.9, y - Math.sin(a) * r * 0.9], C.wood[0], 1);
    }
    A.circle(ctx, x, y, 1.6, C.gold, 0.4);
  }

  // ---- 車夫:坐在車前,正面有臉,背面只見後腦 ----
  function driver(ctx, x, y, s, back, bob) {
    A.poly(ctx, [[x - 4.4, y], [x + 4.4, y], [x + 3.6, y - 12 + bob], [x - 3.6, y - 12 + bob]], s.tunic, 0.7);
    A.line(ctx, [x - 2, y - 12 + bob], [x + 1, y - 6 + bob], s.trim || C.hanRed, 1.6);
    A.circle(ctx, x, y - 16 + bob, 4.8, C.hair || '#3a2a22', 0.6);
    if (!back) {
      A.ellipse(ctx, x - 0.8, y - 15.4 + bob, 3.6, 3.4, C.skin, 0.5);
      A.circle(ctx, x - 2.2, y - 15.8 + bob, 0.55, '#1a120e'); A.circle(ctx, x + 0.4, y - 15.8 + bob, 0.55, '#1a120e');
    }
    A.poly(ctx, [[x - 6.4, y - 18.4 + bob], [x + 6.4, y - 18.4 + bob], [x + 4.4, y - 21.4 + bob], [x - 4.4, y - 21.4 + bob]], s.headCol || C.thatch, 0.5);
  }

  // ---- 馬車 / 牛車:動物在左(車頭),車斗在右;腳底 y = 0,車身總寬約 60px,落在 chibiSprite 的 60×78 邊界內 ----
  function drawWagon(kind) {
    return function (ctx, s, back, fr) {
      var bob = fr === 1 ? -0.8 : 0, an = A.ANIMAL[kind === 'hay' ? 'ox' : (kind === 'fancy' ? 'whitehorse' : 'horse')];
      var woodCol = kind === 'fancy' ? C.hanRed : C.wood[1];
      // 車斗與車輪(先畫,動物壓在車轅前)
      A.poly(ctx, [[3, -13 + bob], [31, -13 + bob], [30, -7 + bob], [4, -7 + bob]], woodCol, 0.8);
      A.poly(ctx, [[3, -13 + bob], [31, -13 + bob], [30, -11.4 + bob], [4, -11.4 + bob]], C.wood[2], 0.5);
      A.line(ctx, [4, -9.4 + bob], [30, -9.4 + bob], A.tone(woodCol, 0.7), 0.8);
      if (kind === 'hay') {
        A.ellipse(ctx, 19, -19 + bob, 14, 7.5, C.thatch, 0.7);
        A.ellipse(ctx, 19, -22 + bob, 10, 4.4, A.tone(C.thatch, 1.12), 0);
        A.line(ctx, [8, -18 + bob], [30, -17 + bob], C.thatchDk, 0.9);
        A.line(ctx, [12, -24 + bob], [10, -27 + bob], C.thatchDk, 1); A.line(ctx, [24, -24 + bob], [27, -27 + bob], C.thatchDk, 1);
      } else if (kind === 'goods') {
        A.ellipse(ctx, 13, -17 + bob, 6.4, 5, '#e2c99a', 0.7); A.circle(ctx, 13, -17.5 + bob, 2.2, '#e83a2a'); A.glyph(ctx, '米', 13, -17.4 + bob, 3.4, '#fff4e0');
        A.ellipse(ctx, 24, -17.5 + bob, 4.6, 5.6, '#9a6a3a', 0.7); A.ellipse(ctx, 24, -22.4 + bob, 3, 1, '#3a2a22');
        A.poly(ctx, [[17, -13 + bob], [29, -13 + bob], [28, -22 + bob], [18, -22 + bob]], '#c8a460', 0.7);
        A.line(ctx, [17, -17.5 + bob], [29, -17.5 + bob], C.wood[0], 0.9);
      } else {
        // 載客:有篷車廂(絹簾 + 紅漆柱 + 青瓦頂)
        A.poly(ctx, [[7, -13 + bob], [29, -13 + bob], [29, -31 + bob], [7, -31 + bob]], C.silk, 0.7);
        A.poly(ctx, [[10, -16 + bob], [26, -16 + bob], [26, -27 + bob], [10, -27 + bob]], A.tone(C.silk, 0.86), 0.5);
        A.line(ctx, [18, -16 + bob], [18, -27 + bob], C.hanRed, 1.2);
        A.line(ctx, [7, -13 + bob], [7, -31 + bob], C.hanRed, 2); A.line(ctx, [29, -13 + bob], [29, -31 + bob], C.hanRed, 2);
        A.poly(ctx, [[4, -31 + bob], [32, -31 + bob], [28, -38 + bob], [8, -38 + bob]], C.tile, 0.8);
        A.line(ctx, [8, -38 + bob], [28, -38 + bob], C.gold, 1.4);
      }
      wheel(ctx, 11, -6, 6, fr);
      wheel(ctx, 25, -6, 6, fr);
      // 車轅 + 動物
      A.line(ctx, [-3, -9], [6, -8 + bob], C.ink, 2.6); A.line(ctx, [-3, -9], [6, -8 + bob], C.wood[2], 1.3);
      ctx.save(); ctx.translate(-12, bob); ctx.scale(0.8, 0.8);
      A.animalRaw(ctx, an, back, fr); ctx.restore();
      // 車夫(坐在車斗前緣)
      driver(ctx, kind === 'fancy' ? 4 : 8, -12 + bob, s, back, 0);
    };
  }

  var UNIT = {
    wagon_goods: { name: '馬車(運貨)', tunic: '#6a8a5a', trim: '#3e5c2e', head: 'hat', headCol: '#e3b95c', draw: drawWagon('goods') },
    wagon_hay: { name: '牛車(運草)', tunic: '#a8825a', trim: '#6a4a2a', head: 'hat', headCol: '#e3b95c', draw: drawWagon('hay') },
    wagon_fancy: { name: '馬車(載客)', tunic: '#3e5c7a', trim: '#ffc94a', head: 'scarf', headCol: '#2b1d1b', draw: drawWagon('fancy') },
    // 騎馬者:mount 沿用 chibiSprite 的騎乘畫法(scale 0.9 讓騎兵高度約 44px)
    courier: { name: '信使(快馬)', tunic: '#4f8f6a', trim: '#ffc94a', head: 'scarf', headCol: '#d23a2c', mount: 'horse', scale: 0.9, flag: '#2f6fb0' },
    courier_w: { name: '騎士(白馬)', tunic: '#7a5cc8', trim: '#ffc94a', head: 'guan', headCol: '#2b1d1b', mount: 'whitehorse', scale: 0.9, weapon: 'dao' },
    hawker_tray: { name: '叫賣者(托盤)', tunic: '#d9b277', trim: '#a8692f', pants: '#6b4a2e', head: 'scarf', headCol: '#f4ead2', prop: 'tray', civil: true },
    hawker_cart: { name: '叫賣者(推車)', tunic: '#c98a5a', trim: '#7a3a1a', pants: '#5a4a3a', head: 'hat', headCol: '#e3b95c', prop: 'pushcart', civil: true }
  };
  Object.keys(UNIT).forEach(function (k) { UNIT[k].id = k; A.UNIT[k] = UNIT[k]; });

  // ---- 手持道具:tray 胸前托盤(胡餅)| pushcart 身側的小推車(有布篷) ----
  var baseProp = A.chibiProp;
  A.chibiProp = function (ctx, p, back, bob, s) {
    if (p === 'tray') {
      A.line(ctx, [-5, -18 + bob], [-9.5, -11 + bob], C.ink, 2.2); A.line(ctx, [-5, -18 + bob], [-9.5, -11 + bob], C.wood[0], 1);
      A.line(ctx, [5, -18 + bob], [9.5, -11 + bob], C.ink, 2.2); A.line(ctx, [5, -18 + bob], [9.5, -11 + bob], C.wood[0], 1);
      if (!back) {
        A.poly(ctx, [[-12, -11 + bob], [12, -11 + bob], [10, -7 + bob], [-10, -7 + bob]], C.wood[1], 0.8);
        [-6.5, 0, 6.5].forEach(function (x, i) { A.ellipse(ctx, x, -13 + bob, 3.8, 2.2, i === 1 ? '#f2d58a' : '#e3b95c', 0.5); });
        A.poly(ctx, [[-9, -13.6 + bob], [-3, -14.6 + bob], [-4, -12.6 + bob]], '#fbf1dc', 0.3);
      } else {
        A.poly(ctx, [[-11, -11 + bob], [11, -11 + bob], [10, -8.4 + bob], [-10, -8.4 + bob]], C.wood[0], 0.6);
      }
    } else if (p === 'pushcart') {
      A.line(ctx, [-9, -10], [-3, -11], C.ink, 2.4); A.line(ctx, [-9, -10], [-3, -11], C.wood[1], 1.2);
      A.poly(ctx, [[-27, -14], [-9, -14], [-10, -8], [-26, -8]], C.wood[2], 0.8);
      A.line(ctx, [-25, -14], [-25, -30], C.wood[0], 1.4); A.line(ctx, [-11, -14], [-11, -30], C.wood[0], 1.4);
      A.poly(ctx, [[-29, -30], [-7, -30], [-9, -25], [-27, -25]], C.hanRed, 0.8);
      for (var i = 0; i < 3; i++) A.poly(ctx, [[-29 + i * 7.4, -30], [-25.6 + i * 7.4, -30], [-27.6 + i * 7.4, -25], [-29.8 + i * 7.4, -25]], '#fbf1dc', 0);
      [-23, -18, -13].forEach(function (x, j) { A.ellipse(ctx, x, -16.2, 2.6, 2, j === 1 ? '#f2603c' : '#e3b95c', 0.5); });
      wheel(ctx, -18, -4.6, 4.6, 0);
    } else if (baseProp) baseProp(ctx, p, back, bob, s);
  };
})(ART);
