// petdraw.js — 仙獸苑 Canvas 繪製(PLAN_PET §6、§8.1、§9)。只畫圖:不碰 DOM、不改狀態、不用 Math.random。
// 座標慣例:
//   pdPet / pdMat / pdBait / pdBall / pdLantern / pdCharm / pdAvatar:(x, y) 為錨點、s 為縮放(pdPet 錨點 = 腳底中心)。
//   pdAltar / pdCauldron:(0, 0) 為底部中心,由呼叫端 translate。
//   pdFxSuccess / pdFxAbyss:(0, 0) 為畫面中心(390×844 的 195,422),由呼叫端 translate。
//   pdStairs:390×844 邏輯座標,由呼叫端縮放。
//   pdBigText:(0, 0) 為文字中心;k 為文字出現後經過的秒數。
// 所有公開函式先經 _pdSafe(ctx):缺少的常見 2D 方法補成 no-op,最小 stub 也不會拋例外。
// 資料(PETS / PET_MATS / PET_BAITS / PET_FLOORS / PET_BANDS / PET_EL / PET_Q)在呼叫時才讀取,載入順序只需 petdata.js 在前。

var _PD_INK = '#3b2314';
var _PD_SIL = '#2a2a3a';
var _PD_EYE = '#1a120e';
var _PD_CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
var _PD_SKY = {
  A: ['#bfe3f5', '#eaf7ff'], B: ['#cfe8f7', '#f6fcff'], C: ['#e1d4f7', '#f7f2ff'], D: ['#ffe08a', '#ffd36b'], T: ['#ffd98a', '#fff3c4']
};
var _PD_METHODS = ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo',
  'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'rect', 'translate', 'rotate', 'scale', 'setTransform', 'fillText', 'strokeText',
  'createLinearGradient', 'createRadialGradient', 'drawImage', 'clip'];
var _pdGC = {};

// ---------------- 基礎工具 ----------------
function _pdNoGrad() { return { addColorStop: function () {} }; }
function _pdSafe(ctx) {
  if (!ctx) return null;
  if (ctx._pdOk) return ctx;
  for (var i = 0; i < _PD_METHODS.length; i++) {
    var n = _PD_METHODS[i];
    if (typeof ctx[n] !== 'function') ctx[n] = (n.indexOf('create') === 0) ? _pdNoGrad : function () {};
  }
  ctx._pdOk = true;
  return ctx;
}
// 固定雜湊:同一 n 永遠得到同一個 [0,1) 數(取代亂數)
function _pdH(n) { var v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
function _pdClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function _pdHex(v, fb) { return (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : fb; }
function _pdRGB(hex) { var h = _pdHex(hex, '#808080'); return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
function _pdMix(a, b, t) {
  var x = _pdRGB(a), y = _pdRGB(b), out = '#';
  for (var i = 0; i < 3; i++) {
    var v = Math.round(x[i] + (y[i] - x[i]) * t);
    v = v < 0 ? 0 : (v > 255 ? 255 : v);
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}
// f<1 壓暗偏冷紫(卡通陰影),f>1 提亮偏暖白(高光),與 art.js ART.tone 同方向
function _pdTone(hex, f) { return f < 1 ? _pdMix(hex, '#2a1e3a', (1 - f) * 0.5) : _pdMix(hex, '#fff4d6', _pdClamp((f - 1) * 1.6, 0, 1)); }
function _pdFind(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function _pdPetOf(id) { return _pdFind(PETS, id); }
function _pdCached(key, ctx, make) { if (!_pdGC[key]) _pdGC[key] = make(ctx); return _pdGC[key]; }
function _pdHas(list, k) { return !!list && list.indexOf(k) >= 0; }

// ---------------- 圖元(g = { ctx, sil, ink };sil = 剪影模式,所有顏色換成剪影色) ----------------
function _pdCol(g, c) { if (!g.sil) return c; return c === '#ffffff' ? c : _PD_SIL; }
function _pdStroke(g, w, col) {
  var c = g.ctx;
  c.strokeStyle = g.sil ? _PD_SIL : (col || g.ink);
  c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round';
  c.stroke();
}
function _pdEll(g, x, y, rx, ry, rot, fill, edge) {
  var c = g.ctx;
  c.beginPath();
  c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2);
  if (fill) { c.fillStyle = _pdCol(g, fill); c.fill(); }
  if (edge) _pdStroke(g, edge === true ? 1.6 : edge);
}
function _pdPoly(g, pts, fill, edge, edgeCol) {
  var c = g.ctx;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = _pdCol(g, fill); c.fill(); }
  if (edge) _pdStroke(g, edge === true ? 1.6 : edge, edgeCol);
}
function _pdLine(g, pts, col, w) {
  var c = g.ctx;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.strokeStyle = g.sil ? _PD_SIL : col;
  c.lineWidth = w || 1.4; c.lineCap = 'round'; c.lineJoin = 'round';
  c.stroke();
}
function _pdArc(g, x, y, r, a0, a1, col, w) {
  var c = g.ctx;
  c.beginPath(); c.arc(x, y, Math.max(0.01, r), a0, a1);
  c.strokeStyle = g.sil ? _PD_SIL : col;
  c.lineWidth = w || 1.4; c.lineCap = 'round';
  c.stroke();
}
function _pdDot(g, x, y, r, col) { _pdEll(g, x, y, r, r, 0, col, 0); }
function _pdTxt(g, txt, x, y, font, col, align) {
  var c = g.ctx;
  c.font = font; c.fillStyle = col; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  c.fillText(txt, x, y);
}
function _pdShadow(g, rx) { _pdEll(g, 0, 0, rx, rx * 0.26, 0, 'rgba(60,40,20,0.22)', 0); }
function _pdFlame(g, x, y, h, col) {
  _pdPoly(g, [[x, y - h], [x + h * 0.45, y - h * 0.2], [x + h * 0.4, y + h * 0.25], [x, y + h * 0.35], [x - h * 0.4, y + h * 0.25], [x - h * 0.45, y - h * 0.2]], col, 0.9);
}
function _pdHi(g, x, y, rx, ry) { _pdEll(g, x, y, rx, ry, -0.4, 'rgba(255,255,255,0.35)', 0); }
function _pdStar(g, x, y, r, col) {
  var pts = [];
  for (var j = 0; j < 8; j++) {
    var rr = (j % 2 === 0) ? r : r * 0.35, a = j * Math.PI / 4 - Math.PI / 2;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  _pdPoly(g, pts, col, 0.8, '#fff7cc');
}
function _pdBubble(g, x, y, txt) {
  _pdPoly(g, [[x - 6, y + 6], [x - 10, y + 12], [x - 1, y + 7]], '#ffffff', 1.0);
  _pdEll(g, x, y, 13, 8, 0, '#ffffff', 1.0);
  if (!g.sil) _pdTxt(g, txt, x, y, 'bold 8px "Microsoft JhengHei", sans-serif', _PD_INK);
}

// ---------------- 仙獸 ----------------
// 臉:hx,hy 為頭中心,r 為頭半徑;face = normal | happy | smug;blink 為眨眼
function _pdFace(g, hx, hy, r, face, blink) {
  var er = r * 0.2, sp = r * 0.42, ey = hy - r * 0.05, mx = hx, my = hy + r * 0.42;
  if (g.sil) {
    _pdDot(g, hx - sp, ey, 1.6, '#ffffff'); _pdDot(g, hx + sp, ey, 1.6, '#ffffff');
    return;
  }
  _pdEll(g, hx - sp * 1.5, hy + r * 0.3, er, er * 0.55, 0, 'rgba(242,96,60,0.35)', 0);
  _pdEll(g, hx + sp * 1.5, hy + r * 0.3, er, er * 0.55, 0, 'rgba(242,96,60,0.35)', 0);
  for (var i = -1; i <= 1; i += 2) {
    var ex = hx + i * sp;
    if (face === 'happy') {
      _pdArc(g, ex, ey + er * 0.4, er * 1.1, Math.PI * 1.15, Math.PI * 1.85, _PD_EYE, 1.6);
    } else if (blink || face === 'smug') {
      _pdLine(g, [[ex - er * 1.2, ey], [ex + er * 1.2, ey]], _PD_EYE, 1.8);
    } else {
      _pdEll(g, ex, ey, er, er * 1.2, 0, _PD_EYE, 0);
      _pdDot(g, ex - er * 0.35, ey - er * 0.45, er * 0.38, '#ffffff');
    }
  }
  if (face === 'smug') {
    _pdEll(g, mx + r * 0.12, my + r * 0.12, r * 0.1, r * 0.12, 0, '#ff8a9a', 0.8);
    _pdLine(g, [[mx - r * 0.12, my], [mx + r * 0.12, my + r * 0.02]], _PD_INK, 1.2);
  } else {
    _pdArc(g, mx, my - r * 0.1, r * 0.14, Math.PI * 0.15, Math.PI * 0.85, _PD_INK, 1.2);
  }
}
// 角(horn):gold-single / tusk-white / short / deer-antler / cow-curved / small
function _pdHorn(g, L, H) {
  var t = L.horn, c2 = _pdHex(L.c[2], '#ffffff');
  if (!t) return;
  var k = [1, -1];
  if (t === 'gold-single') {
    _pdPoly(g, [[H.x - 2, H.y - H.r * 0.7], [H.x + 4, H.y - H.r * 1.75], [H.x + 2, H.y - H.r * 0.6]], '#ffc94a', 1.0);
  } else if (t === 'tusk-white') {
    k.forEach(function (s) {
      _pdPoly(g, [[H.x + s * 4, H.y + H.r * 0.7], [H.x + s * 6, H.y + H.r * 1.25], [H.x + s * 2, H.y + H.r * 0.9]], '#ffffff', 1.0);
    });
  } else if (t === 'short') {
    _pdPoly(g, [[H.x - 2, H.y - H.r * 0.8], [H.x, H.y - H.r * 1.45], [H.x + 2, H.y - H.r * 0.8]], '#8a5a1d', 1.0);
  } else if (t === 'deer-antler') {
    k.forEach(function (s) {
      var pts = [[H.x + s * H.r * 0.5, H.y - H.r * 0.7], [H.x + s * H.r * 1.0, H.y - H.r * 1.9]];
      _pdLine(g, pts, _PD_INK, 3.4);
      _pdLine(g, pts, c2, 1.8);
      _pdLine(g, [[H.x + s * H.r * 0.75, H.y - H.r * 1.3], [H.x + s * H.r * 1.45, H.y - H.r * 1.45]], _PD_INK, 2.6);
      _pdLine(g, [[H.x + s * H.r * 0.75, H.y - H.r * 1.3], [H.x + s * H.r * 1.45, H.y - H.r * 1.45]], c2, 1.2);
    });
  } else if (t === 'cow-curved') {
    k.forEach(function (s) {
      var pts = [[H.x + s * H.r * 0.7, H.y - H.r * 0.6], [H.x + s * H.r * 1.3, H.y - H.r * 1.2], [H.x + s * H.r * 1.0, H.y - H.r * 1.5]];
      _pdLine(g, pts, _PD_INK, 3.6);
      _pdLine(g, pts, '#f4ead2', 2);
    });
  } else if (t === 'small') {
    k.forEach(function (s) {
      _pdPoly(g, [[H.x + s * 4, H.y - H.r * 0.8], [H.x + s * 6, H.y - H.r * 1.5], [H.x + s * 2, H.y - H.r * 0.95]], '#fff7e0', 1.0);
    });
  }
}
// 額外造型(look.extra);只畫簡單的裝飾,座標相對於頭 H 與身體
function _pdExtras(g, L, H) {
  if (g.sil) return;
  var ex = L.extra || [];
  var c2 = _pdHex(L.c[2], '#ffffff'), i, a, px, py;
  if (_pdHas(ex, 'sing-notes')) {
    _pdTxt(g, '♪', H.x + H.r + 4, H.y - H.r * 0.9, 'bold 11px sans-serif', c2, 'left');
    _pdTxt(g, '♫', H.x + H.r + 12, H.y - H.r * 1.7, 'bold 9px sans-serif', c2, 'left');
  }
  if (_pdHas(ex, 'speech-bubble')) _pdBubble(g, H.x + H.r + 14, H.y - H.r * 1.6, '當康!');
  if (_pdHas(ex, 'voice-ka')) _pdBubble(g, H.x + H.r + 10, H.y - H.r * 1.6, '卡!');
  if (_pdHas(ex, 'hold-bamboo')) {
    _pdLine(g, [[12, -22], [24, -2]], '#6aa84f', 3.4);
    _pdLine(g, [[17, -14], [21, -12]], '#3f7a2e', 1.2);
    _pdPoly(g, [[12, -14], [16, -26], [18, -14]], '#c8e6a0', 0.9);
  }
  if (_pdHas(ex, 'back-millet')) {
    for (i = 0; i < 3; i++) {
      px = -6 + i * 6;
      _pdLine(g, [[px, -34], [px - 2, -46]], '#e3b23c', 1.6);
      _pdEll(g, px - 2, -47, 2, 3.2, 0, '#f5cf5a', 0.8);
    }
  }
  if (_pdHas(ex, 'coin-5zhu')) {
    _pdEll(g, 20, -12, 5.5, 5.5, 0, '#e6b84a', 1.0);
    _pdDot(g, 20, -12, 1.4, _PD_INK);
  }
  if (_pdHas(ex, 'small-wings')) {
    _pdPoly(g, [[-6, -32], [-18, -42], [-16, -26]], c2, 1.0);
    _pdPoly(g, [[-2, -30], [-12, -40], [-10, -24]], _pdTone(c2, 0.9), 1.0);
  }
  if (_pdHas(ex, 'flame-mane')) {
    for (i = 0; i < 7; i++) {
      a = Math.PI * (1.1 + i * 0.13);
      _pdFlame(g, H.x + Math.cos(a) * (H.r + 3), H.y + Math.sin(a) * (H.r + 3), 7, '#ff9a2e');
    }
  }
  if (_pdHas(ex, 'goatee')) _pdPoly(g, [[H.x - 2, H.y + H.r * 0.8], [H.x + 2, H.y + H.r * 0.8], [H.x, H.y + H.r * 1.5]], '#fbfbfb', 1.0);
  if (_pdHas(ex, 'bamboo-scroll')) {
    _pdPoly(g, [[9, -22], [21, -22], [21, -6], [9, -6]], '#f4ead2', 1.0);
    _pdLine(g, [[11, -18], [19, -18]], '#a8692f', 0.8);
    _pdLine(g, [[11, -14], [19, -14]], '#a8692f', 0.8);
  }
  if (_pdHas(ex, 'thunder-cloud')) {
    py = H.y - H.r * 1.7;
    _pdEll(g, H.x - 7, py + 2, 6, 5, 0, '#dfe9f5', 1.0);
    _pdEll(g, H.x, py - 2, 8, 6, 0, '#dfe9f5', 1.0);
    _pdEll(g, H.x + 8, py + 2, 6, 5, 0, '#dfe9f5', 1.0);
  }
  if (_pdHas(ex, 'lightning-symbol')) _pdLine(g, [[10, -40], [6, -32], [11, -30], [7, -22]], '#ffd23a', 2.2);
  if (_pdHas(ex, 'forehead-flower')) _pdEll(g, H.x, H.y - H.r * 0.55, 2.4, 2.4, 0, '#4caf50', 0.8);
  if (_pdHas(ex, 'guardian')) _pdArc(g, H.x, H.y, H.r + 6, Math.PI * 1.1, Math.PI * 1.9, '#ffd23a', 1.2);
  if (_pdHas(ex, 'beard')) {
    _pdLine(g, [[H.x + H.r * 0.4, H.y + H.r * 0.6], [H.x + H.r * 0.2, H.y + H.r * 1.5], [H.x + H.r * 0.6, H.y + H.r * 1.9]], c2, 1.4);
  }
  if (_pdHas(ex, 'earth-pearl')) {
    _pdEll(g, 14, -20, 6, 6, 0, '#c97a2a', 1.0);
    _pdDot(g, 12, -22, 1.6, '#fff3c0');
  }
}
// 尾巴(quad 用):tail = round / fluffy / fan9 / flame / thin / red / fireball / curl / wag / ringed / short
function _pdTail(g, L, c0, c2) {
  var t = L.tail, i, a, cx, cy;
  if (!t) return;
  if (t === 'round') { _pdEll(g, -20, -20, 5, 5, 0, c0, 1.4); }
  else if (t === 'fluffy') {
    _pdEll(g, -19, -26, 6, 6, 0, c0, 1.4); _pdEll(g, -22, -20, 6, 6, 0, c0, 1.4); _pdEll(g, -19, -14, 5, 5, 0, c0, 1.4);
  } else if (t === 'fan9') {
    for (i = 0; i < 9; i++) {
      a = Math.PI * (1.05 + i * 0.05);
      cx = -14 + Math.cos(a) * 12; cy = -22 + Math.sin(a) * 12;
      _pdEll(g, cx, cy, 12, 3.6, a, c0, 1.2);
    }
    if (_pdHas(L.extra, 'tail-tip-green')) {
      for (i = 0; i < 9; i++) {
        a = Math.PI * (1.05 + i * 0.05);
        _pdDot(g, -14 + Math.cos(a) * 22, -22 + Math.sin(a) * 22, 2.6, c2);
      }
    }
  } else if (t === 'flame') {
    _pdLine(g, [[-16, -22], [-24, -26], [-28, -34], [-22, -40]], _PD_INK, 5);
    _pdLine(g, [[-16, -22], [-24, -26], [-28, -34], [-22, -40]], c0, 3);
    _pdFlame(g, -22, -44, 9, c2);
  } else if (t === 'thin') {
    _pdLine(g, [[-16, -22], [-26, -18], [-32, -26]], c0, 2.4);
  } else if (t === 'red') {
    _pdLine(g, [[-16, -22], [-24, -16], [-30, -22]], c2, 4.2);
  } else if (t === 'fireball') {
    _pdLine(g, [[-16, -22], [-26, -26], [-32, -32]], c0, 2.2);
    _pdEll(g, -33, -33, 4.5, 4.5, 0, c2, 1.0);
  } else if (t === 'curl') {
    _pdArc(g, -22, -24, 6, 0.3, 4.5, _PD_INK, 4.2);
    _pdArc(g, -22, -24, 6, 0.3, 4.5, c0, 2.4);
  } else if (t === 'wag') {
    _pdLine(g, [[-16, -24], [-26, -30], [-30, -40]], _PD_INK, 4.4);
    _pdLine(g, [[-16, -24], [-26, -30], [-30, -40]], c0, 2.4);
  } else if (t === 'ringed') {
    _pdLine(g, [[-16, -22], [-28, -18], [-34, -26]], c0, 4);
    _pdLine(g, [[-22, -17], [-22, -22]], c2, 1.6);
    _pdLine(g, [[-28, -17], [-28, -21]], c2, 1.6);
    _pdLine(g, [[-32, -22], [-33, -26]], c2, 1.6);
  } else if (t === 'short') {
    _pdPoly(g, [[-14, -24], [-22, -22], [-14, -18]], c0, 1.0);
  }
}
// 通用身體模板的花紋(quad)
function _pdPatQuad(g, L, c0, c1, c2) {
  if (g.sil) return;
  var p = L.pat;
  if (p === 'tiger-stripes') {
    _pdLine(g, [[-7, -30], [-8.5, -22], [-7, -15]], '#6f4a1e', 2.2);
    _pdLine(g, [[0, -31], [-1.5, -22], [0, -14]], '#6f4a1e', 2.2);
    _pdLine(g, [[7, -30], [5.5, -22], [7, -15]], '#6f4a1e', 2.2);
  } else if (p === 'flame-back') {
    _pdFlame(g, -9, -33, 6, '#ffd23a');
    _pdFlame(g, 0, -36, 7, '#ffd23a');
    _pdFlame(g, 9, -32, 6, '#ffd23a');
  } else if (p === 'gold-scales') {
    for (var i = 0; i < 6; i++) _pdDot(g, -10 + (i % 3) * 10, -28 + Math.floor(i / 3) * 8, 1.6, '#ffe07a');
  } else if (p === 'leopard') {
    for (var j = 0; j < 7; j++) _pdDot(g, -12 + _pdH(j) * 24, -30 + _pdH(j + 7) * 16, 2.2, _PD_INK);
  } else if (p === 'cloud-blue') {
    _pdLine(g, [[-14, -26], [-10, -30], [-4, -29], [-2, -24]], c2, 1.6);
    _pdLine(g, [[4, -18], [8, -22], [13, -21], [14, -16]], c2, 1.6);
  }
}
// 四足(quad):尾在身後,腿分前後兩色,身體為豆形,頭為圓形
function _pdTplQuad(g, L, H) {
  var c0 = L.c[0], c1 = L.c[1], c2 = _pdHex(L.c[2], '#ffffff');
  var back = _pdTone(c0, 0.82), ex = L.extra || [];
  var hcol = L.pat === 'white-head' ? c2 : (_pdHas(ex, 'white-head') ? '#fffaf0' : c0);
  _pdTail(g, L, c0, c2);
  [-11, 11].forEach(function (x) { _pdEll(g, x, -5, 3.6, 6, 0, back, 1.4); });
  [-4, 5].forEach(function (x) { _pdEll(g, x, -5, 3.8, 6, 0, c0, 1.4); });
  if (_pdHas(ex, 'gold-hooves') && !g.sil) {
    [-11, 11, -4, 5].forEach(function (x) { _pdEll(g, x, -0.5, 4, 2.2, 0, '#ffc94a', 1.0); });
  }
  _pdEll(g, 0, -22, 19, 13, 0, c0, 1.6);
  if (!g.sil) {
    _pdHi(g, -9, -31, 5, 2.6);
    _pdEll(g, 2, -17, 11, 7, 0, c1, 1.0);
  }
  _pdPatQuad(g, L, c0, c1, c2);
  if (L.pat === 'mane') {
    for (var i = 0; i < 9; i++) {
      var a = i * Math.PI * 2 / 9;
      _pdEll(g, H.x + Math.cos(a) * (H.r + 3), H.y + Math.sin(a) * (H.r + 3), 4.2, 4.2, 0, c2, 1.0);
    }
  }
  if (L.ear === 'round-big') {
    _pdEll(g, H.x - H.r * 0.8, H.y - H.r * 0.85, 8, 8, 0, hcol, 1.2);
    _pdEll(g, H.x + H.r * 0.8, H.y - H.r * 0.85, 8, 8, 0, hcol, 1.2);
  } else {
    _pdEll(g, H.x - H.r * 0.7, H.y - H.r * 0.85, 5, 5, 0, hcol, 1.2);
    _pdEll(g, H.x + H.r * 0.7, H.y - H.r * 0.85, 5, 5, 0, hcol, 1.2);
  }
  _pdEll(g, H.x, H.y, H.r, H.r * 0.92, 0, hcol, 1.6);
  _pdEll(g, H.x, H.y + H.r * 0.45, H.r * 0.5, H.r * 0.36, 0, c1, 1.0);
  _pdHorn(g, L, H);
  _pdFace(g, H.x, H.y, H.r, g.face, g.blink);
  _pdExtras(g, L, H);
}
// 猴(ape):大耳、長尾、小身體
function _pdTplApe(g, L, H) {
  var c0 = L.c[0], c1 = L.c[1], c2 = _pdHex(L.c[2], '#ffffff');
  _pdLine(g, [[-8, -12], [-24, -14], [-28, -30], [-22, -40]], _PD_INK, 5.2);
  _pdLine(g, [[-8, -12], [-24, -14], [-28, -30], [-22, -40]], c0, 3.2);
  [-6, 6].forEach(function (x) { _pdEll(g, x, -3, 4, 3, 0, c0, 1.4); });
  _pdEll(g, 0, -18, 11, 12, 0, c0, 1.6);
  if (!g.sil) { _pdHi(g, -5, -24, 3.5, 2); _pdEll(g, 1, -16, 7, 8, 0, c1, 1.0); }
  if (L.ear === 'big-white') {
    [-1, 1].forEach(function (s) {
      _pdEll(g, H.x + s * H.r * 0.95, H.y - H.r * 0.35, 8, 8, 0, c2, 1.2);
      _pdEll(g, H.x + s * H.r * 0.95, H.y - H.r * 0.35, 4.2, 4.2, 0, '#ffb0a8', 0);
    });
  }
  _pdEll(g, H.x, H.y, H.r, H.r, 0, c0, 1.6);
  _pdEll(g, H.x, H.y + H.r * 0.5, H.r * 0.55, H.r * 0.42, 0, c1, 1.0);
  _pdFace(g, H.x, H.y, H.r, g.face, g.blink);
  _pdExtras(g, L, H);
}
// 鳥(bird):圓胖身、單腳或雙腳、冠羽與尾羽
function _pdTplBird(g, L, H) {
  var c0 = L.c[0], c1 = L.c[1], c2 = _pdHex(L.c[2], '#d23a2c'), ex = L.extra || [];
  var legCol = '#f2a33a', i, legs = L.legs === 1 ? [2] : [-4, 4];
  if (L.tail === 'five-color') {
    var fc = ['#4caf50', '#f2603c', '#e3b23c', '#c9ced6', '#3e7fd6'];
    for (i = 0; i < 5; i++) {
      var a = Math.PI * (1.12 + i * 0.09);
      _pdLine(g, [[-12, -26], [-12 + Math.cos(a) * 26, -26 + Math.sin(a) * 26]], _PD_INK, 4.2);
      _pdLine(g, [[-12, -26], [-12 + Math.cos(a) * 26, -26 + Math.sin(a) * 26]], fc[i], 2.4);
    }
  } else {
    for (i = 0; i < 3; i++) {
      var b = Math.PI * (1.1 + i * 0.12);
      _pdEll(g, -18 + Math.cos(b) * 10, -28 + Math.sin(b) * 10, 9, 4, b, c0, 1.2);
    }
    _pdEll(g, -28, -36, 4, 3, -0.6, c2, 0.8);
  }
  legs.forEach(function (x) {
    _pdLine(g, [[x, -8], [x, 0]], legCol, 2.4);
    _pdLine(g, [[x - 3, 0], [x + 3, 0]], legCol, 2.4);
  });
  if (_pdHas(ex, 'fire-at-feet') && !g.sil) {
    _pdFlame(g, -18, -2, 9, '#ff9a2e');
    _pdFlame(g, -12, -1, 6, '#ffcf3a');
  }
  _pdEll(g, 0, -26, 17, 18, 0, c0, 1.6);
  _pdEll(g, 3, -20, 11, 12, 0, c1, 1.0);
  _pdEll(g, -4, -28, 9, 6, -0.3, _pdTone(c0, 0.85), 1.0);
  if (L.pat === 'red-lines' && !g.sil) {
    _pdLine(g, [[-8, -34], [2, -31]], c2, 1.6);
    _pdLine(g, [[-10, -27], [0, -24]], c2, 1.6);
    _pdLine(g, [[-8, -20], [2, -18]], c2, 1.6);
  }
  if (L.pat === 'crest3') {
    _pdFlame(g, H.x - 5, H.y - H.r * 1.1, 8, c2);
    _pdFlame(g, H.x, H.y - H.r * 1.25, 9, c2);
    _pdFlame(g, H.x + 5, H.y - H.r * 1.1, 8, c2);
  }
  _pdEll(g, H.x, H.y, H.r, H.r * 0.95, 0, c0, 1.6);
  var beak = c1 === '#ffffff' ? '#f7f2e6' : '#ffb13b';
  _pdPoly(g, [[H.x + H.r * 0.8, H.y - 1], [H.x + H.r * 1.6, H.y + 2], [H.x + H.r * 0.8, H.y + 4]], beak, 1.0);
  _pdFace(g, H.x, H.y, H.r, g.face, g.blink);
  _pdExtras(g, L, H);
}
// 龍(dragon):大頭、三節 S 形身體、小爪、鬚與角
function _pdTplDragon(g, L, H) {
  var c0 = L.c[0], c1 = L.c[1], c2 = _pdHex(L.c[2], '#c97a2a');
  [-7, 0].forEach(function (x) { _pdEll(g, x, 0, 4.5, 2.5, 0, '#ffc94a', 1.0); });
  _pdEll(g, -4, -12, 10, 9, 0, c0, 1.6);
  _pdEll(g, 4, -26, 10, 10, 0, c0, 1.6);
  _pdEll(g, -3, -38, 10, 10, 0, c0, 1.6);
  if (!g.sil) {
    _pdHi(g, -7, -40, 4, 2.2);
    for (var i = 0; i < 3; i++) {
      var y = -10 - i * 13;
      _pdLine(g, [[2 + (i % 2) * 2, y + 1], [9 + (i % 2) * 2, y - 1]], c1, 1.4);
    }
  }
  _pdEll(g, H.x, H.y, H.r, H.r * 0.95, 0, c0, 1.6);
  _pdEll(g, H.x + 6, H.y + 4, H.r * 0.5, H.r * 0.36, 0, c1, 1.0);
  _pdHorn(g, L, H);
  _pdFace(g, H.x, H.y, H.r, g.face, g.blink);
  _pdExtras(g, L, H);
}
// 龜(turtle):圓殼 + 鳥頭 / 狗頭 + 蛇尾或短尾
function _pdTplTurtle(g, L, H) {
  var c0 = L.c[0], c1 = L.c[1], c2 = _pdHex(L.c[2], '#d23a2c'), ex = L.extra || [];
  if (L.tail === 'snake') {
    _pdLine(g, [[-16, -14], [-26, -8], [-34, -14], [-40, -24]], _PD_INK, 5.2);
    _pdLine(g, [[-16, -14], [-26, -8], [-34, -14], [-40, -24]], c2, 3);
  } else if (L.tail === 'short') {
    _pdPoly(g, [[-14, -14], [-20, -12], [-14, -8]], c0, 1.0);
  }
  _pdEll(g, -12, -3, 5.5, 3.2, 0.3, _pdTone(c0, 0.8), 1.4);
  _pdEll(g, 12, -3, 5.5, 3.2, -0.3, c0, 1.4);
  _pdEll(g, 0, -18, 21, 15, 0, c0, 1.6);
  if (!g.sil) {
    _pdHi(g, -9, -26, 6, 3);
    if (L.pat === 'hex-shell') {
      var hex = [];
      for (var i = 0; i < 6; i++) hex.push([Math.cos(i * Math.PI / 3) * 8, -18 + Math.sin(i * Math.PI / 3) * 8]);
      _pdPoly(g, hex, _pdTone(c0, 1.2), 1.0);
      for (var j = 0; j < 6; j++) _pdLine(g, [hex[j], [hex[j][0] * 1.7, -18 + (hex[j][1] + 18) * 1.7]], _pdTone(c0, 0.8), 1.0);
    }
  }
  if (_pdHas(ex, 'green-snake-on-shell')) {
    _pdLine(g, [[-12, -22], [-6, -30], [2, -34], [8, -36]], _PD_INK, 4.6);
    _pdLine(g, [[-12, -22], [-6, -30], [2, -34], [8, -36]], c2, 2.6);
    _pdEll(g, 9, -37, 4, 3.4, 0, c2, 1.0);
    _pdDot(g, 10, -38, 0.9, '#ffffff');
  }
  _pdEll(g, H.x, H.y, H.r, H.r, 0, c1, 1.4);
  if (_pdHas(ex, 'orange-beak')) {
    _pdPoly(g, [[H.x + H.r * 0.7, H.y - 2], [H.x + H.r * 1.6, H.y + 1], [H.x + H.r * 0.7, H.y + 3]], '#ff9a20', 1.0);
  }
  _pdFace(g, H.x, H.y, H.r, g.face, g.blink);
  _pdExtras(g, L, H);
}
// 模板分派表:tpl → { draw, head }
var _PD_TPL = {
  quad: { draw: _pdTplQuad, head: { x: 0, y: -44, r: 15 } },
  ape: { draw: _pdTplApe, head: { x: 0, y: -42, r: 14 } },
  bird: { draw: _pdTplBird, head: { x: 2, y: -47, r: 11 } },
  dragon: { draw: _pdTplDragon, head: { x: -3, y: -52, r: 12 } },
  turtle: { draw: _pdTplTurtle, head: { x: 24, y: -24, r: 9 } }
};

// 仙獸主函式。opt = { silhouette, blink, hop(數值或 true = 10px), face: 'normal'|'happy'|'smug', breath(y 向縮放倍率) }
function pdPet(ctx, id, x, y, s, opt) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  opt = opt || {};
  var pet = _pdPetOf(id);
  var look = pet ? pet.look : { tpl: 'quad', c: ['#9aa0a8', '#c8ccd2', '#ffffff'], tail: 'round', ear: null, pat: null, glow: false, extra: [] };
  var sil = !!opt.silhouette || !pet;
  var g = { ctx: ctx, sil: sil, ink: sil ? _PD_SIL : _PD_INK, face: opt.face || 'normal', blink: !!opt.blink };
  var tpl = _PD_TPL[look.tpl] || _PD_TPL.quad;
  var H = { x: tpl.head.x, y: tpl.head.y, r: tpl.head.r };
  var el = pet ? pet.el : null;
  var lift = opt.hop ? (opt.hop === true ? 10 : opt.hop) : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (!sil) _pdShadow(g, 19);
  ctx.translate(0, -lift);
  if (opt.breath) ctx.scale(1, opt.breath);
  if (look.glow && !sil) {
    var rainbow = look.glow === 'rainbow' || el === 'all' || !PET_EL[el];
    var base = rainbow ? null : PET_EL[el].color;
    var rc = ['#f2603c', '#e3b23c', '#4caf50', '#c9ced6', '#3e7fd6'];
    for (var i = 2; i >= 0; i--) {
      ctx.save();
      ctx.globalAlpha = 0.22 - i * 0.06;
      _pdEll(g, 0, -32, 36 + i * 9, 36 + i * 9 * 1.05, 0, rainbow ? rc[i + 2] : base, 0);
      ctx.restore();
    }
  }
  tpl.draw(g, look, H);
  ctx.restore();
}

// ---------------- 材料 ----------------
// 15 種材料:菱形寶石框(品質色) + 造型(依 id)
function pdMat(ctx, matId, x, y, s) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  var m = _pdFind(PET_MATS, matId);
  var q = m ? PET_Q[m.q] : PET_Q.b;
  var g = { ctx: ctx, sil: false, ink: _PD_INK };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  _pdPoly(g, [[0, -18], [18, 0], [0, 18], [-18, 0]], q.bg, 0);
  _pdPoly(g, [[0, -18], [18, 0], [0, 18], [-18, 0]], null, 2.4, q.frame);
  switch (matId) {
    case 'wood_b':
      _pdPoly(g, [[0, -10], [6, 8], [-6, 8]], '#8fd16b', 1.0);
      _pdEll(g, -4, -2, 3, 1.6, -0.6, '#5fb24a', 0.8);
      _pdEll(g, 4, 1, 3, 1.6, 0.6, '#5fb24a', 0.8);
      break;
    case 'wood_c':
      _pdPoly(g, [[-1.5, 2], [1.5, 2], [1.5, 8], [-1.5, 8]], '#f4e2c4', 0.8);
      _pdEll(g, 0, -2, 9, 5, 0, '#b5523a', 1.0);
      _pdEll(g, 0, -2, 5, 2.5, 0, null, 0.7);
      break;
    case 'wood_p':
      _pdEll(g, 0, 4, 6, 6, 0, '#5fd08a', 1.0);
      _pdEll(g, 0, -4, 4.5, 4.5, 0, '#5fd08a', 1.0);
      _pdLine(g, [[0, -9], [4, -13]], '#3f7a2e', 1.4);
      break;
    case 'fire_b':
      _pdDot(g, -4, -2, 4, '#e8402c'); _pdDot(g, 4, -2, 4, '#e8402c'); _pdDot(g, 0, 4, 4, '#e8402c');
      break;
    case 'fire_c':
      _pdPoly(g, [[-7, -3], [-3, -8], [4, -8], [8, -3], [5, 6], [-4, 7]], '#ff5a4a', 1.0);
      _pdLine(g, [[-3, -8], [0, 0], [8, -3]], '#ffb3a8', 1.0);
      break;
    case 'fire_p':
      _pdEll(g, 0, 2, 7, 7, 0, '#ffb020', 1.0);
      _pdFlame(g, 0, -5, 8, '#ff4a1a');
      break;
    case 'earth_b':
      _pdLine(g, [[0, -9], [0, 8]], '#a8692f', 1.0);
      [[-3, -6], [3, -6], [-3, -1], [3, -1], [0, 3]].forEach(function (p) { _pdEll(g, p[0], p[1], 2.4, 3.2, 0, '#f5cf5a', 0.8); });
      break;
    case 'earth_c':
      _pdDot(g, -4, 0, 4, '#c79650'); _pdDot(g, 2, -2, 4.5, '#c79650'); _pdDot(g, 6, 4, 3.5, '#c79650');
      _pdDot(g, 2, -2, 1, '#8a5a2b');
      break;
    case 'earth_p':
      _pdEll(g, 0, 2, 9, 6, 0, '#e7b84a', 1.0);
      _pdFlame(g, 0, -3, 6, '#ffe07a');
      _pdDot(g, -6, -4, 1, '#fff3b8'); _pdDot(g, 6, -6, 1, '#fff3b8');
      break;
    case 'metal_b':
      [[-5, -3], [0, -6], [5, -3], [-3, 3], [3, 3]].forEach(function (p) { _pdDot(g, p[0], p[1], 1.8, '#f7f9fc'); });
      break;
    case 'metal_c':
      _pdPoly(g, [[0, -9], [6, -5], [6, 4], [0, 8], [-6, 4], [-6, -5]], '#eef4fb', 1.0);
      _pdLine(g, [[0, -9], [0, 8]], '#aab5be', 0.8);
      break;
    case 'metal_p':
      _pdPoly(g, [[-9, 2], [9, 2], [6, 8], [-6, 8]], '#fbfbf4', 1.0);
      _pdEll(g, 0, 2, 9, 4, 0, '#f4f1e6', 0.8);
      _pdEll(g, 0, 0, 7, 2.6, 0, '#fff8e0', 0);
      break;
    case 'water_b':
      _pdPoly(g, [[0, -9], [5, -1], [9, -6], [7, 2], [0, 8], [-7, 2], [-9, -6], [-5, -1]], '#6b4a7a', 1.0);
      break;
    case 'water_c':
      _pdLine(g, [[-6, 8], [-3, 2], [-6, -3], [-3, -8]], '#2ea8b0', 2);
      _pdLine(g, [[0, 8], [3, 2], [0, -3], [3, -8]], '#2ea8b0', 2);
      _pdDot(g, 6, -4, 1.4, '#d8f7ff');
      break;
    case 'water_p':
      _pdEll(g, 0, 0, 8, 8, 0, '#2a5fb0', 1.0);
      _pdArc(g, 0, 0, 4, 0.5, 4.2, '#9ee0ff', 1.2);
      _pdDot(g, -3, -3, 1.6, '#ffffff');
      break;
    default:
      _pdDot(g, 0, 0, 3, q.frame);
  }
  ctx.restore();
}

// ---------------- 捕獸餌 ----------------
// 小陶罐(高 ≈ 1.2 × 寬),罐蓋為本系色;神級多一圈金帶,隱級為五色帶與五色蓋
function pdBait(ctx, baitId, x, y, s) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  var b = _pdFind(PET_BAITS, baitId) || { el: 'wood', tier: 'ling' };
  var g = { ctx: ctx, sil: false, ink: _PD_INK };
  var lidCol = PET_EL[b.el] ? PET_EL[b.el].color : '#c4a46a';
  var rainbow = b.tier === 'yin';
  var rc = ['#4caf50', '#f2603c', '#e3b23c', '#c9ced6', '#3e7fd6'];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  _pdShadow(g, 17);
  _pdEll(g, 0, 6, 19, 22, 0, '#c98b5a', 1.6);
  _pdHi(g, -9, -4, 4, 8);
  _pdPoly(g, [[-9, -16], [9, -16], [11, -21], [-11, -21]], '#b07048', 1.0);
  if (b.tier === 'shen') {
    _pdArc(g, 0, 6, 19, 0.35, Math.PI - 0.35, '#ffc94a', 3);
    _pdArc(g, 0, 6, 19, 0.35, Math.PI - 0.35, '#ffe07a', 1.2);
  }
  if (rainbow) {
    for (var i = 0; i < 5; i++) _pdArc(g, 0, 6, 19, 0.3 + i * 0.1, 0.3 + i * 0.1 + 0.6, rc[i], 2.4);
  }
  _pdPoly(g, [[-9, -2], [9, -2], [9, 12], [-9, 12]], '#fbf3dc', 0.9);
  _pdLine(g, [[-6, 2], [6, 2]], _PD_INK, 0.9);
  _pdLine(g, [[-6, 6], [6, 6]], _PD_INK, 0.9);
  if (rainbow) {
    for (i = 0; i < 5; i++) _pdEll(g, -12 + i * 6, -23, 3.2, 2.2, 0, rc[i], 0.6);
  } else {
    _pdEll(g, 0, -23, 13, 5, 0, lidCol, 1.2);
    _pdEll(g, 0, -26, 4, 2.4, 0, lidCol, 0.8);
  }
  ctx.restore();
}

// ---------------- 靈球 ----------------
// opt = { open(0~1,上半球翻開 110°), rot(弧度,自轉), crack(0~1,裂紋), ash(0~1,化為灰燼) }
function pdBall(ctx, x, y, s, opt) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  opt = opt || {};
  var R = 22, rot = opt.rot || 0;
  var open = _pdClamp(opt.open || 0, 0, 1), crack = _pdClamp(opt.crack || 0, 0, 1), ash = _pdClamp(opt.ash || 0, 0, 1);
  var g = { ctx: ctx, sil: false, ink: _PD_INK };
  var body = _pdMix('#6d8f7a', '#3a3a3e', ash);
  var i;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (ash > 0) ctx.globalAlpha = 1 - ash * 0.4;
  if (open > 0) {
    var ang = open * 110 * Math.PI / 180;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI); ctx.closePath();
    ctx.fillStyle = body; ctx.fill(); _pdStroke(g, 1.6);
    ctx.save();
    ctx.globalAlpha *= open;
    _pdEll(g, 0, -2, 14, 8, 0, '#fffbe0', 0);
    ctx.restore();
    ctx.save();
    ctx.translate(-R, 0); ctx.rotate(-ang); ctx.translate(R, 0);
    ctx.beginPath(); ctx.arc(0, 0, R, Math.PI, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = _pdTone(body, 1.1); ctx.fill(); _pdStroke(g, 1.6);
    ctx.restore();
  } else {
    _pdEll(g, 0, 0, R, R, 0, body, 1.6);
    if (ash < 0.5) {
      _pdEll(g, -6, -11, 9, 5, -0.5, 'rgba(255,255,255,0.3)', 0);
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.98, R * 0.2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#e8b84a'; ctx.lineWidth = 3; ctx.stroke();
      for (i = 0; i < 4; i++) {
        var th = rot + i * Math.PI / 2;
        _pdLine(g, [[Math.cos(th) * R * 0.7 - 2, Math.sin(th) * R * 0.1], [Math.cos(th) * R * 0.7 + 2, Math.sin(th) * R * 0.1 - 3]], '#f0d27a', 1.2);
      }
      var bx = R * 0.42 * Math.sin(rot);
      _pdEll(g, bx, -4, 5, 5, 0, '#fbfdf7', 1.0);
    }
    if (crack > 0) {
      ctx.globalAlpha = (ctx.globalAlpha || 1) * crack;
      var cracks = [[[-14, -8], [-6, -2], [-9, 4], [-2, 10]], [[2, -16], [5, -8], [1, -3], [7, 2]], [[8, 4], [12, 10], [17, 8]]];
      cracks.forEach(function (pts) {
        _pdLine(g, pts, _PD_INK, 2.8);
        _pdLine(g, pts, '#ffffff', 1.4);
      });
      ctx.globalAlpha = 1;
    }
  }
  if (ash > 0) {
    for (i = 0; i < 10; i++) {
      var a = i * Math.PI / 5 + _pdH(i) * 0.5;
      var px = Math.cos(a) * R * (0.9 + ash * 0.3);
      var py = Math.sin(a) * R * 0.5 + ash * 40 * (0.5 + _pdH(i + 3));
      _pdPoly(g, [[px, py - 3], [px + 2.5, py + 2], [px - 2.5, py + 2]], '#3c3a38', 0.6);
    }
  }
  ctx.restore();
}

// ---------------- 台階(雲階畫面,邏輯座標 390×844) ----------------
// 第 k 塊台階(k = 0 最低)的台面中心;化身站在台面上
function pdStepXY(k) { return [70 + k * 62, 560 - k * 110 - 8]; }
function _pdBandOf(layer) {
  if (layer >= 20) return { color: '#ffd36b', key: 'T' };
  for (var i = 0; i < PET_BANDS.length; i++) {
    var b = PET_BANDS[i];
    if (layer >= b.from && layer <= b.to) return { color: b.color, key: b.name };
  }
  return { color: '#9fb7a8', key: 'A' };
}
function _pdSkyGrad(ctx, key) {
  return _pdCached('sky_' + key, ctx, function (c) {
    var gr = c.createLinearGradient(0, 56, 0, 620);
    gr.addColorStop(0, _PD_SKY[key][0]);
    gr.addColorStop(1, _PD_SKY[key][1]);
    return gr;
  });
}
function _pdPreview(g, x, y, layer) {
  var f = PET_FLOORS[layer];
  if (!f) return;
  var xs = [x - 54, x - 6, x + 42];
  var cols = [PET_Q.b.frame, PET_Q.c.frame, PET_Q.p.frame];
  var labels = [f.b[0] + '~' + f.b[1], f.c[0] + '~' + f.c[1], f.p > 0 ? Math.round(f.p * 100) + '%' : '—'];
  for (var i = 0; i < 3; i++) {
    _pdPoly(g, [[xs[i], y - 5], [xs[i] + 4, y], [xs[i], y + 5], [xs[i] - 4, y]], cols[i], 0.8);
    _pdTxt(g, labels[i], xs[i] + 7, y, 'bold 10px "Microsoft JhengHei", sans-serif', _PD_INK, 'left');
  }
}
function _pdStepBlock(g, x, y, layer, isCur, t) {
  var bd = _pdBandOf(layer);
  var top = bd.color, side = _pdTone(top, 0.8);
  var c = g.ctx;
  if (isCur) _pdEll(g, x, y, 96, 56, 0, 'rgba(255,223,120,' + (0.26 + 0.1 * Math.sin(t * 3)).toFixed(3) + ')', 0);
  _pdPoly(g, [[x - 75, y - 17], [x + 75, y - 17], [x + 75, y + 1], [x - 75, y + 1]], top, 1.6);
  _pdPoly(g, [[x - 75, y + 1], [x + 75, y + 1], [x + 75, y + 17], [x - 75, y + 17]], side, 1.6);
  _pdLine(g, [[x - 70, y - 11], [x + 70, y - 11]], 'rgba(255,255,255,0.5)', 1.2);
  if (bd.key === 'C') {
    _pdEll(g, x + 84, y - 2, 9, 6, 0, 'rgba(255,255,255,0.8)', 0);
    _pdEll(g, x + 92, y + 2, 6, 4, 0, 'rgba(255,255,255,0.8)', 0);
  }
  if (bd.key === 'D' && _pdH(Math.floor(t * 2)) > 0.85) {
    _pdLine(g, [[x + 62, y - 70], [x + 56, y - 58], [x + 64, y - 50], [x + 58, y - 36]], '#fff7b0', 2);
  }
  _pdPoly(g, [[x - 68, y - 15], [x - 38, y - 15], [x - 38, y + 5], [x - 68, y + 5]], '#c4121a', 1.0);
  _pdTxt(g, _PD_CN[layer] || String(layer), x - 53, y - 5, 'bold 12px "Noto Serif TC", "PMingLiU", serif', '#ffc94a');
  _pdPreview(g, x, y - 40, layer);
  c.globalAlpha = 1;
}
function _pdGate(g, x, y, t) {
  _pdEll(g, x, y - 40, 70, 46, 0, 'rgba(255,230,140,' + (0.22 + 0.08 * Math.sin(t * 2.5)).toFixed(3) + ')', 0);
  _pdPoly(g, [[x - 44, y - 14], [x - 36, y - 14], [x - 36, y - 72], [x - 44, y - 72]], '#d23a2c', 1.2);
  _pdPoly(g, [[x + 36, y - 14], [x + 44, y - 14], [x + 44, y - 72], [x + 36, y - 72]], '#d23a2c', 1.2);
  _pdPoly(g, [[x - 62, y - 72], [x + 62, y - 72], [x + 54, y - 84], [x - 54, y - 84]], '#2b1d1b', 1.2);
  _pdPoly(g, [[x - 30, y - 66], [x + 30, y - 66], [x + 30, y - 50], [x - 30, y - 50]], '#ffc94a', 1.0);
  _pdTxt(g, '天門', x, y - 58, 'bold 12px "Noto Serif TC", "PMingLiU", serif', _PD_INK);
}
// 台階繪製:view = { floor(目前層), lo(視窗起點,省略時依 floor 夾住) };t 為秒數(閃電 / 光暈用)
function pdStairs(ctx, view, t) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  view = view || {};
  t = t || 0;
  var floor = Math.floor(view.floor || 0);
  var lo = (view.lo !== undefined && view.lo !== null) ? view.lo : _pdClamp(floor - 2, 0, 16);
  var g = { ctx: ctx, sil: false, ink: _PD_INK };
  ctx.save();
  ctx.fillStyle = _pdSkyGrad(ctx, _pdBandOf(floor).key);
  ctx.fillRect(0, 56, 390, 564);
  for (var k = 4; k >= 0; k--) {
    var layer = lo + k;
    var p = pdStepXY(k);
    if (layer === 20) {
      _pdStepBlock(g, p[0], p[1], layer, layer === floor, t);
      _pdGate(g, p[0], p[1] + 8, t);
    } else {
      _pdStepBlock(g, p[0], p[1], layer, layer === floor, t);
    }
  }
  ctx.restore();
}

// ---------------- 化身 / 燈籠 / 符 ----------------
// Q 版城主:漢紅衣、黑髮髻、右手提燈籠;(x,y) 為腳底,呼吸 ±2px(週期 2 秒,t 為秒數)
function pdAvatar(ctx, x, y, s, t) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  t = t || 0;
  var bob = Math.sin(t * Math.PI) * 2;
  var g = { ctx: ctx, sil: false, ink: _PD_INK, face: 'normal', blink: false };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(0, -bob);
  _pdShadow(g, 14);
  _pdPoly(g, [[-9, -30], [9, -30], [13, -3], [-13, -3]], '#d23a2c', 1.6);
  _pdLine(g, [[-9, -24], [9, -22]], '#ffc94a', 2.2);
  _pdLine(g, [[8, -26], [16, -16]], _PD_INK, 5);
  _pdLine(g, [[8, -26], [16, -16]], '#d23a2c', 2.8);
  _pdDot(g, 16, -14, 2.4, '#ffd9b0');
  _pdEll(g, 0, -40, 9.5, 9.5, 0, '#ffd9b0', 1.4);
  _pdEll(g, 0, -46, 9.6, 5.5, 0, '#2f221e', 0);
  _pdDot(g, 0, -53, 4.2, '#2f221e');
  _pdLine(g, [[-2, -54], [4, -58]], '#ffc94a', 1.4);
  _pdFace(g, 0, -40, 9.5, 'normal', false);
  ctx.restore();
  pdLantern(ctx, x + 20 * s, y - 20 * s, 0.55 * s, { lit: true, t: t });
}
// 燈籠:(x,y) 為燈籠中心;opt = { lit(預設 true), t }
function pdLantern(ctx, x, y, s, opt) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  opt = opt || {};
  var lit = opt.lit !== false, t = opt.t || 0;
  var g = { ctx: ctx, sil: false, ink: _PD_INK };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (lit) {
    var f = 0.9 + 0.1 * Math.sin(t * 9);
    ctx.save();
    ctx.globalAlpha = 0.16 * f; _pdEll(g, 0, 0, 30, 30, 0, '#ffb34a', 0);
    ctx.globalAlpha = 0.24 * f; _pdEll(g, 0, 0, 20, 20, 0, '#ffcf6b', 0);
    ctx.restore();
  }
  _pdLine(g, [[0, -18], [0, -12]], _PD_INK, 1.2);
  _pdEll(g, 0, 0, 9, 12, 0, lit ? '#ff6a2c' : '#c4442c', 1.6);
  _pdEll(g, 0, 0, 4.5, 8, 0, lit ? '#fff3b8' : '#d23a2c', 0);
  _pdLine(g, [[-4.5, -9], [-5.5, 0], [-4.5, 9]], '#c4121a', 0.9);
  _pdLine(g, [[4.5, -9], [5.5, 0], [4.5, 9]], '#c4121a', 0.9);
  _pdPoly(g, [[-6, -13], [6, -13], [5, -11], [-5, -11]], '#ffc94a', 1.0);
  _pdPoly(g, [[-6, 11], [6, 11], [5, 13], [-5, 13]], '#ffc94a', 1.0);
  _pdLine(g, [[0, 13], [0, 18]], '#ffc94a', 1.6);
  _pdDot(g, 0, 19, 1.8, '#ffc94a');
  ctx.restore();
}
// 黃符(平安符):opt = { burn(0~1,燒成金色碎屑), empty(true = 灰框未持有), t }
function pdCharm(ctx, x, y, s, opt) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  opt = opt || {};
  var burn = _pdClamp(opt.burn || 0, 0, 1);
  var g = { ctx: ctx, sil: false, ink: _PD_INK };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (opt.empty) {
    _pdPoly(g, [[-8, -13], [8, -13], [8, 13], [-8, 13]], 'rgba(160,160,160,0.15)', 1.4, '#9ea3ab');
  } else if (burn < 1) {
    ctx.globalAlpha = 1 - burn;
    _pdPoly(g, [[-8, -13], [8, -13], [8, 13], [-8, 13]], '#ffe27a', 1.2);
    _pdLine(g, [[-5, -8], [5, -8]], '#d23a2c', 1.4);
    _pdLine(g, [[-5, -3], [2, -3], [-3, 2], [5, 2]], '#d23a2c', 1.4);
    _pdPoly(g, [[3, 6], [7, 6], [7, 10], [3, 10]], '#d23a2c', 0.8);
    ctx.globalAlpha = 1;
  }
  if (burn > 0) {
    for (var i = 0; i < 10; i++) {
      var a = _pdH(i) * Math.PI * 2;
      var d = 6 + burn * (20 + _pdH(i + 9) * 12);
      var px = Math.cos(a) * d, py = Math.sin(a) * d - burn * 6;
      ctx.globalAlpha = burn * (1 - burn * 0.5);
      _pdPoly(g, [[px, py - 3], [px + 2.5, py + 2], [px - 2.5, py + 2]], '#ffcf3a', 0.6);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------- 招靈台 / 丹爐(原點 = 底部中心) ----------------
var _PD_ALT_BG = {
  wood: ['#cfe8c0', '#9fd08a'], fire: ['#ffd0a8', '#ff8a6a'], earth: ['#f6e2a8', '#e8c070'],
  metal: ['#f6f8fb', '#dfe6ee'], water: ['#2a3e66', '#14203a']
};
function pdAltar(ctx, el, t) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  t = t || 0;
  var E = PET_EL[el] ? el : 'wood';
  var g = { ctx: ctx, sil: false, ink: _PD_INK };
  var bgc = _PD_ALT_BG[E];
  var skyG = _pdCached('alt_' + E, ctx, function (c) {
    var gr = c.createLinearGradient(0, -300, 0, 0);
    gr.addColorStop(0, bgc[0]); gr.addColorStop(1, bgc[1]);
    return gr;
  });
  ctx.save();
  ctx.fillStyle = skyG;
  ctx.fillRect(-180, -300, 360, 300);
  ctx.globalAlpha = 0.45;
  if (E === 'wood') {
    [-120, -60, 70, 130].forEach(function (x) {
      _pdPoly(g, [[x - 4, 0], [x - 4, -260], [x + 4, -260], [x + 4, 0]], '#5b9a4a', 0);
      _pdLine(g, [[x - 4, -90], [x + 4, -90]], '#3f7a2e', 1.4);
      _pdLine(g, [[x - 4, -170], [x + 4, -170]], '#3f7a2e', 1.4);
    });
  } else if (E === 'fire') {
    _pdEll(g, 0, -190, 60, 60, 0, '#ffb347', 0);
    _pdPoly(g, [[-180, 0], [-180, -70], [-60, -110], [60, -80], [180, -130], [180, 0]], '#c8402c', 0);
  } else if (E === 'earth') {
    _pdPoly(g, [[-180, 0], [-180, -90], [-90, -90], [-60, -120], [60, -120], [90, -90], [180, -90], [180, 0]], '#c08a3a', 0);
  } else if (E === 'metal') {
    _pdPoly(g, [[-180, 0], [-110, -150], [-40, 0]], '#aab5be', 0);
    _pdPoly(g, [[-60, 0], [10, -190], [90, 0]], '#c9d2db', 0);
    _pdPoly(g, [[30, 0], [120, -130], [180, 0]], '#aab5be', 0);
  } else {
    _pdEll(g, 100, -200, 22, 22, 0, '#f4f1d0', 0);
    _pdPoly(g, [[-180, 0], [-180, -60], [180, -60], [180, 0]], '#2b4a7a', 0);
    _pdLine(g, [[-120, -30], [-70, -30]], '#6a9ad8', 1.4);
    _pdLine(g, [[40, -20], [100, -20]], '#6a9ad8', 1.4);
  }
  ctx.globalAlpha = 1;
  _pdPoly(g, [[-100, -44], [100, -44], [110, 0], [-110, 0]], '#aab5be', 1.6);
  _pdPoly(g, [[-84, -80], [84, -80], [100, -44], [-100, -44]], '#b9c3cb', 1.6);
  _pdPoly(g, [[-66, -108], [66, -108], [84, -80], [-84, -80]], '#cfd8df', 1.6);
  _pdLine(g, [[-70, -24], [-30, -30], [0, -22], [40, -30], [70, -24]], 'rgba(59,35,20,0.35)', 1.2);
  _pdLine(g, [[-54, -94], [-20, -100], [20, -92], [54, -98]], 'rgba(59,35,20,0.35)', 1.2);
  [[-104, -50], [104, -50], [-88, -112], [88, -112]].forEach(function (p, i) {
    _pdEll(g, p[0], p[1], 4, 4, 0, '#3fa385', 0.8);
    _pdFlame(g, p[0], p[1] - 6, 4 + 1.5 * Math.sin(t * 7 + i), '#ffd66b');
  });
  ctx.restore();
}
// 博山爐:三足、圓腹、山形爐蓋,爐下有火;smokeEl 有值時冒該五行色的煙
function pdCauldron(ctx, t, smokeEl) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  t = t || 0;
  var g = { ctx: ctx, sil: false, ink: _PD_INK };
  var i;
  ctx.save();
  if (smokeEl && PET_EL[smokeEl]) {
    for (i = 0; i < 6; i++) {
      var ph = ((t * 0.6 + i / 6) % 1 + 1) % 1;
      var sx = Math.sin(t * 2 + i) * 8;
      ctx.globalAlpha = 0.5 * (1 - ph);
      _pdEll(g, sx, -130 - ph * 120, 6 + ph * 14, 6 + ph * 14, 0, PET_EL[smokeEl].color, 0);
    }
    ctx.globalAlpha = 1;
  }
  _pdLine(g, [[-28, -18], [-32, 0]], _PD_INK, 3.4);
  _pdLine(g, [[0, -14], [0, 0]], _PD_INK, 3.4);
  _pdLine(g, [[28, -18], [32, 0]], _PD_INK, 3.4);
  for (i = 0; i < 3; i++) {
    var fx = -14 + i * 14;
    _pdFlame(g, fx, -4, 10 + 2 * Math.sin(t * 11 + i), '#ff9a2e');
  }
  _pdFlame(g, 0, -4, 8 + 2 * Math.sin(t * 13), '#ffcf3a');
  _pdEll(g, 0, -44, 44, 34, 0, '#3fa385', 1.6);
  _pdHi(g, -18, -62, 10, 6);
  _pdEll(g, 0, -56, 44, 5, 0, null, 1.2);
  _pdArc(g, 0, -56, 44, 0.2, Math.PI - 0.2, '#ffc94a', 2.2);
  _pdPoly(g, [[-40, -74], [-22, -100], [-8, -92], [0, -124], [8, -92], [22, -100], [40, -74]], '#2f8f79', 1.4);
  _pdEll(g, 0, -126, 5, 5, 0, '#ffc94a', 1.0);
  ctx.restore();
}

// ---------------- 特效 ----------------
// 成功金光放射:(0,0) 為中心,k 0~1
function pdFxSuccess(ctx, k) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  k = _pdClamp(k || 0, 0, 1);
  var g = { ctx: ctx, sil: false, ink: '#7a4a00' };
  var i, rot = k * Math.PI * 0.5;
  ctx.save();
  for (i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.35 * (1 - k) * (1 - i * 0.25);
    var rr = 40 + k * 160 + i * 30;
    _pdEll(g, 0, 0, rr, rr, 0, '#ffe27a', 0);
  }
  ctx.globalAlpha = 0.55 * (1 - k * 0.5);
  var len = 40 + k * 200;
  for (i = 0; i < 12; i++) {
    var ang = rot + i * Math.PI / 6;
    _pdPoly(g, [[0, 0], [Math.cos(ang - 0.12) * len, Math.sin(ang - 0.12) * len], [Math.cos(ang + 0.12) * len, Math.sin(ang + 0.12) * len]], '#ffe27a', 0);
  }
  ctx.globalAlpha = 1 - k * 0.6;
  var sd = 20 + (1 - (1 - k) * (1 - k)) * 150;
  for (i = 0; i < 24; i++) {
    var a2 = i * Math.PI / 12 + _pdH(i) * 0.2;
    var d = sd * (0.7 + _pdH(i + 30) * 0.5);
    _pdStar(g, Math.cos(a2) * d, Math.sin(a2) * d, 5 * (1 - k * 0.5) + 2, '#ffd23a');
  }
  ctx.restore();
}
// 深淵演出:(0,0) 為畫面中心,k 0~1 為整段進度(依 §6.3 時序換算):
//   0.00~0.20 白光直線落地(由 (0,-120) 到 (0,0),寬 6→2)與衝擊環 0.20~0.40
//   0.30~0.60 暗角漸入到 0.78;0.35~0.75 畫面下緣長出 5 條暗紅裂縫
// 去色、下沉 6px 與背景透明度由呼叫端處理。
function pdFxAbyss(ctx, k) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  k = _pdClamp(k || 0, 0, 1);
  var g = { ctx: ctx, sil: false, ink: _PD_INK };
  var i;
  ctx.save();
  var bk = _pdClamp(k / 0.2, 0, 1);
  if (bk > 0) {
    var len = 120 * bk;
    ctx.globalAlpha = 0.3 * bk; _pdLine(g, [[0, -len], [0, 0]], '#ffffff', 16);
    ctx.globalAlpha = 0.5 * bk; _pdLine(g, [[0, -len], [0, 0]], '#ffffff', 10);
    ctx.globalAlpha = 1; _pdLine(g, [[0, -len], [0, 0]], '#ffffff', 6 - 4 * bk);
  }
  var ik = _pdClamp((k - 0.2) / 0.2, 0, 1);
  if (ik > 0) {
    var rx = 10 + ik * 70, ry = rx * 0.35;
    ctx.globalAlpha = 1 - ik;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
  }
  var vk = _pdClamp((k - 0.3) / 0.3, 0, 1) * 0.78;
  if (vk > 0) {
    var grd = ctx.createRadialGradient(0, 0, 120, 0, 0, 480);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalAlpha = vk;
    ctx.fillStyle = grd;
    ctx.fillRect(-195, -422, 390, 844);
  }
  ctx.globalAlpha = 1;
  var ck = _pdClamp((k - 0.35) / 0.4, 0, 1);
  if (ck > 0) {
    for (i = 0; i < 5; i++) {
      var x0 = -150 + i * 75;
      _pdLine(g, [[x0, 422], [x0 + (_pdH(i) - 0.5) * 20, 422 - 45 * ck], [x0 + (_pdH(i + 5) - 0.5) * 30, 422 - 90 * ck]], '#5a0a0f', 3);
    }
  }
  ctx.restore();
}
// 大字:style = 'success'(金黃,0→1.2→1.0 彈出)| 'fail'(黑字紅邊,沉入後每 0.12 秒顫抖 ±1px)
// (0,0) 為文字中心;k 為文字出現後經過的秒數
function pdBigText(ctx, text, style, k) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  k = Math.max(0, k || 0);
  var font = 'bold 56px "Noto Serif TC", "PMingLiU", serif';
  var c = ctx;
  c.save();
  c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (style === 'fail') {
    var sink = -20 * (1 - _pdClamp(k / 0.5, 0, 1));
    var jx = 0, jy = 0;
    if (k > 0.5) {
      var idx = Math.floor((k - 0.5) / 0.12);
      jx = (_pdH(idx) - 0.5) * 2; jy = (_pdH(idx + 17) - 0.5) * 2;
    }
    var tx = jx, ty = sink + jy;
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(196,18,26,0.35)'; c.lineWidth = 10; c.strokeText(text, tx, ty);
    c.strokeStyle = '#c4121a'; c.lineWidth = 4; c.strokeText(text, tx, ty);
    c.fillStyle = '#0b0b0b'; c.fillText(text, tx, ty);
  } else {
    var p = _pdClamp(k / 0.3, 0, 1);
    var sc = p < 0.6 ? (p / 0.6) * 1.2 : 1.2 - ((p - 0.6) / 0.4) * 0.2;
    c.scale(sc, sc);
    c.lineJoin = 'round';
    c.strokeStyle = '#7a4a00'; c.lineWidth = 5; c.strokeText(text, 0, 0);
    var gr = c.createLinearGradient(0, -28, 0, 28);
    gr.addColorStop(0, '#fff3a8'); gr.addColorStop(0.5, '#ffcf3a'); gr.addColorStop(1, '#e6a817');
    c.fillStyle = gr; c.fillText(text, 0, 0);
    c.strokeStyle = '#fffbe6'; c.lineWidth = 1.5; c.strokeText(text, 0, 0);
  }
  c.restore();
}
