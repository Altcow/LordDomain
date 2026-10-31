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
  'createLinearGradient', 'createRadialGradient', 'drawImage', 'clip', 'transform'];
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
function _pdCol(g, c) { return g.sil ? _PD_SIL : c; }
// 剪影模式的眼睛白點(不經 _pdCol,直接填白)
function _pdSilDot(g, x, y, r) { var c = g.ctx; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill(); }
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
  if (g.mirror) { c.save(); c.translate(x, y); c.scale(-1, 1); c.fillText(txt, 0, 0); c.restore(); return; }
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
    _pdSilDot(g, hx - sp, ey, 1.6); _pdSilDot(g, hx + sp, ey, 1.6);
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

// ================= 仙獸 v2:每隻獨立造型 =================
// 一律面向右(頭在右、尾在左),錨點 = 腳底中心,s = 1 約 64×64。只用路徑填色 + 深棕描邊;
// 剪影模式由同一套路徑自動產生(_pdCol 全部換成剪影色,裝飾性物件以 g.sil 略過)。
var _PD_IRIS = { wood: '#2fae4a', fire: '#ff7a1a', earth: '#d9900f', metal: '#d4a52a', water: '#2b86e0', all: '#ff4f7a' };
var _PD_CHEEK = 'rgba(242,96,60,0.35)';
// 平滑路徑:開放 = 依中點做二次曲線(通過各段中點);封閉 = 以各點為控制點的圓滑外框
function _pdCurvePath(c, pts, closed) {
  var n = pts.length, i, p, q;
  if (closed) {
    c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (i = 0; i < n; i++) {
      p = pts[i]; q = pts[(i + 1) % n];
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    c.closePath();
    return;
  }
  c.moveTo(pts[0][0], pts[0][1]);
  if (n === 2) { c.lineTo(pts[1][0], pts[1][1]); return; }
  for (i = 1; i < n - 2; i++) {
    p = pts[i]; q = pts[i + 1];
    c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  c.quadraticCurveTo(pts[n - 2][0], pts[n - 2][1], pts[n - 1][0], pts[n - 1][1]);
}
function _pdShapePath(c, sh) {
  if (sh.p) _pdCurvePath(c, sh.p, true);
  else c.ellipse(sh[0], sh[1], Math.max(0.01, sh[2]), Math.max(0.01, sh[3]), sh[4] || 0, 0, Math.PI * 2);
}
function _pdBlob(g, pts, fill, edge) {
  var c = g.ctx;
  c.beginPath(); _pdCurvePath(c, pts, true);
  if (fill) { c.fillStyle = _pdCol(g, fill); c.fill(); }
  if (edge) _pdStroke(g, edge === true ? 1.6 : edge);
}
// 多個形狀合併成一塊(先全部描粗邊、再全部填色 → 只留外輪廓)
function _pdUnion(g, shapes, fill, edge) {
  var c = g.ctx, i, w = edge === undefined ? 1.6 : edge;
  if (w) for (i = 0; i < shapes.length; i++) { c.beginPath(); _pdShapePath(c, shapes[i]); _pdStroke(g, w * 2); }
  for (i = 0; i < shapes.length; i++) { c.beginPath(); _pdShapePath(c, shapes[i]); c.fillStyle = _pdCol(g, fill); c.fill(); }
}
// 粗管(脖子、腿、尾、蛇身):先描深棕粗線再疊本色
function _pdTube(g, pts, w, col, edge) {
  var c = g.ctx, e = edge === undefined ? 1.6 : edge;
  c.beginPath(); _pdCurvePath(c, pts, false);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (e) { c.strokeStyle = g.sil ? _PD_SIL : g.ink; c.lineWidth = w + e * 2; c.stroke(); }
  c.strokeStyle = _pdCol(g, col); c.lineWidth = w; c.stroke();
}
// 腿:從 (x0,y0) 到地面 x1,可加蹄
function _pdLeg(g, x0, y0, x1, w, col, hoof) {
  _pdTube(g, [[x0, y0], [x1, -w * 0.5 - 0.6]], w, col);
  if (hoof) _pdEll(g, x1, -w * 0.32, w * 0.55 + 0.4, w * 0.34, 0, hoof, 1.2);
}
function _pdFlameR(g, x, y, h, col, rot) {
  var c = g.ctx;
  c.save(); c.translate(x, y); c.rotate(rot || 0);
  _pdFlame(g, 0, 0, h, col);
  c.restore();
}
// 雙層火焰(外橘內黃)
function _pdFire(g, x, y, h, rot) {
  _pdFlameR(g, x, y, h, '#ff9a2e', rot);
  if (!g.sil) _pdFlameR(g, x, y + h * 0.12, h * 0.55, '#ffd23a', rot);
}
// 羽毛 / 尾巴葉形:由 p0(根)到 p1(尖),最寬 w 在 70% 處
function _pdFeather(g, p0, p1, w, col, edge) {
  var dx = p1[0] - p0[0], dy = p1[1] - p0[1], ln = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / ln, ny = dx / ln;
  function at(t, k) { return [p0[0] + dx * t + nx * k, p0[1] + dy * t + ny * k]; }
  var pts = [at(0, w * 0.18), at(0.35, w * 0.42), at(0.72, w * 0.55), at(1.04, 0), at(0.72, -w * 0.55), at(0.35, -w * 0.42), at(0, -w * 0.18)];
  _pdBlob(g, pts, col, edge === undefined ? 1.3 : edge);
  return pts;
}
function _pdSpark(g, x, y, r, col) {
  var k = r * 0.28;
  _pdPoly(g, [[x, y - r], [x + k, y - k], [x + r, y], [x + k, y + k], [x, y + r], [x - k, y + k], [x - r, y], [x - k, y - k]], col, 0);
  _pdDot(g, x, y, r * 0.22, '#ffffff');
}
// 統一表情語言。o = { x, y(雙眼中心), sp(半眼距), er(眼半徑), far(右眼縮放,側臉用), mx, my, mouth: smile|w|open|none, mk(嘴大小), ring(眼白圈), brow }
// g.fdx:轉頭時臉部特徵的水平位移(由頭部部件設定)
function _pdFaceV(g, o) {
  var fd = g.fdx || 0, x = o.x + fd, y = o.y, sp = o.sp, er = o.er, i, ex, r, c = g.ctx;
  if (g.sil) { _pdSilDot(g, x - sp, y, 1.5); _pdSilDot(g, x + sp, y, 1.5); return; }
  if (o.cheek !== false) {
    var cx = o.cx || sp * 1.35, cy = y + er * 1.75;
    _pdEll(g, x - cx, cy, er * 0.95, er * 0.55, 0, _PD_CHEEK, 0);
    _pdEll(g, x + cx * (o.far || 1), cy, er * 0.85 * (o.far || 1), er * 0.5, 0, _PD_CHEEK, 0);
  }
  for (i = -1; i <= 1; i += 2) {
    ex = x + i * sp; r = er * (i > 0 ? (o.far || 1) : 1);
    if (o.ring && (g.face === 'normal' || g.face === 'sad') && !g.blink) _pdEll(g, ex, y, r * 1.45, r * 1.6, 0, '#ffffff', 0);
    if (o.brow && g.face !== 'happy') _pdLine(g, [[ex - r * 0.8, y - r * 1.85 + i * r * 0.18], [ex + r * 0.8, y - r * 1.85 - i * r * 0.18]], _PD_EYE, 1.3);
    if (g.face === 'happy') {
      _pdArc(g, ex, y + r * 0.55, r * 1.05, Math.PI * 1.15, Math.PI * 1.85, _PD_EYE, 1.5);
    } else if (g.face === 'closed') {
      _pdArc(g, ex, y - r * 0.5, r * 1.05, Math.PI * 0.15, Math.PI * 0.85, _PD_EYE, 1.5);
    } else if (g.blink || g.face === 'smug') {
      _pdLine(g, [[ex - r * 1.1, y], [ex + r * 1.1, y]], _PD_EYE, 1.6);
    } else {
      _pdEll(g, ex, y, r, r * 1.2, 0, _PD_EYE, 0);
      if (g.iris) {
        _pdEll(g, ex, y + r * 0.3, r * 0.72, r * 0.72, 0, g.iris, 0);
        _pdEll(g, ex, y + r * 0.22, r * 0.36, r * 0.42, 0, _PD_EYE, 0);
      }
      _pdDot(g, ex - r * 0.3, y - r * 0.45, r * 0.42, '#ffffff');
      _pdDot(g, ex + r * 0.38, y + r * 0.45, r * 0.18, '#ffffff');
      if (g.face === 'sad') _pdLine(g, [[ex - r * 1.1, y - r * 1.5 - i * r * 0.3], [ex + r * 1.1, y - r * 1.5 + i * r * 0.3]], _PD_EYE, 1.2);
    }
  }
  var m = o.mouth || 'smile', mx = o.mx + fd, my = o.my, k = o.mk || er * 0.7;
  if (m === 'none' || o.mx === undefined) return;
  if (g.face === 'smug') {
    _pdEll(g, mx + k * 0.5, my + k * 0.65, k * 0.55, k * 0.65, 0, '#ff8a9a', 0.8);
    _pdLine(g, [[mx - k, my], [mx + k, my + k * 0.15]], _PD_INK, 1.2);
  } else if (g.face === 'sad') {
    _pdArc(g, mx, my + k * 0.9, k * 0.8, Math.PI * 1.2, Math.PI * 1.8, _PD_INK, 1.2);
  } else if (g.face === 'happy' || m === 'open') {
    c.beginPath(); c.arc(mx, my - k * 0.2, k, 0, Math.PI); c.closePath();
    c.fillStyle = '#b8323a'; c.fill(); _pdStroke(g, 1.0);
    _pdEll(g, mx, my + k * 0.42, k * 0.55, k * 0.28, 0, '#ff8a9a', 0);
  } else if (m === 'w') {
    _pdArc(g, mx - k * 0.5, my, k * 0.5, Math.PI * 0.1, Math.PI * 0.9, _PD_INK, 1.2);
    _pdArc(g, mx + k * 0.5, my, k * 0.5, Math.PI * 0.1, Math.PI * 0.9, _PD_INK, 1.2);
  } else {
    _pdArc(g, mx, my - k * 0.6, k, Math.PI * 0.2, Math.PI * 0.8, _PD_INK, 1.2);
  }
}
// 三層明暗的身體 / 頭(暗面描邊底 → 中間調往左上縮 → 左上高光),光源固定左上
function _pdBodyE(g, x, y, rx, ry, rot, col, edge) {
  _pdEll(g, x, y, rx, ry, rot, g.sil ? col : _pdTone(col, 0.84), edge === undefined ? 1.6 : edge);
  if (g.sil) return;
  _pdEll(g, x - rx * 0.08, y - ry * 0.13, rx * 0.9, ry * 0.84, rot, col, 0);
  _pdHi(g, x - rx * 0.42, y - ry * 0.5, rx * 0.3, ry * 0.2);
}

// ================= 關節骨架 + 關鍵幀動作 =================
// 每隻同一套關節命名(對應 pose 欄位):
//   root(x 重心平移、y 離地、rot 繞腳底傾斜、sx/sy 擠壓伸展) → hip(=骨盆,lean 繞髖樞軸前傾 / 後仰)→ torso
//   neck/head(head 點頭旋轉、hdx/hdy 頸部前伸、hs 透視縮放、yaw 轉頭)、earL / earR(或角)、tail(旋轉 + curl 多節彎曲)、
//   armN / armF(近 / 遠側前肢、手或翅)、legN / legF(後腿,腳底釘地)、flip(轉身 0→1,寬度以 cos 過渡)。
// 每隻的 rig:hip = 髖高(腿頂離地距離)、lean = 前傾幅度係數(高瘦或貼地的身體基底縮小)、arm = paw(前腳兼手,釘地)| hand(懸空手)| wing(翅膀當手)| none(無前肢 → 頭槌替代)。
var _PD_RIG = {
  xingxing: { hip: 14, arm: 'hand' }, lushu: { hip: 22, arm: 'paw' }, jiuwei: { hip: 15, arm: 'paw' }, huoshu: { hip: 5, arm: 'hand' },
  bifang: { hip: 19, arm: 'wing' }, huoqilin: { hip: 22, arm: 'paw' }, dangkang: { hip: 12, arm: 'paw' }, pixiu: { hip: 18, arm: 'paw' },
  huanglong: { hip: 6, arm: 'hand', lean: 0.45 }, jiao: { hip: 16, arm: 'paw' }, tiangou: { hip: 15, arm: 'paw' }, baize: { hip: 18, arm: 'paw' },
  xuangui: { hip: 6, arm: 'paw', lean: 0.6 }, kui: { hip: 16, arm: 'none', lean: 0.8 }, xuanwu: { hip: 6, arm: 'paw', lean: 0.6 }, fenghuang: { hip: 17, arm: 'wing' }
};
// 動作:dur 秒;keys = [時間, 姿勢(省略欄位 = 靜止值), 抵達此鍵的緩動];第一鍵與最後一鍵皆為靜止姿勢 → 可循環、可回 idle。
// 緩動:io = easeInOut、out = easeOut(甩出)、in = easeIn(落下)、back = 過衝回彈。idle 權重 = 疊加的待機層比例。
var _PD_ACT = {
  idle: { dur: 2.6, idle: 1, keys: [[0, {}], [2.6, {}]] },
  greet: { dur: 1.5, idle: 0.3, keys: [
    [0, {}],
    [0.25, { sx: 1.04, sy: 0.93, lean: -0.07, head: -0.1, armN: 0.15, earL: 0.15, earR: -0.15 }, 'io'],            // 預備:微蹲後仰
    [0.55, { x: 2, sx: 0.98, sy: 1.04, lean: 0.24, head: 0.16, hdx: 2, armN: 1.9, tail: 0.4, earL: -0.25, earR: 0.25, face: 'happy' }, 'back'], // 彎腰前傾、前肢甩出
    [0.78, { x: 2, lean: 0.2, head: 0.1, hdx: 1.5, armN: 1.3, tail: 0.2, face: 'happy' }, 'io'],                 // 揮下
    [0.98, { x: 1.6, lean: 0.21, head: 0.14, hdx: 1.5, armN: 2.0, tail: 0.45, face: 'happy' }, 'io'],            // 揮上
    [1.22, { x: -0.6, lean: -0.05, head: -0.06, armN: -0.12, tail: -0.1 }, 'back'],                             // 收回過衝
    [1.5, {}, 'io']] },
  punch: { dur: 1.3, idle: 0.2, keys: [
    [0, {}],
    [0.36, { x: -2.2, rot: -0.05, sx: 1.04, sy: 0.95, lean: -0.2, head: -0.12, armN: -0.6, armF: -0.3, tail: -0.35, earL: 0.2, earR: -0.2 }, 'io'], // 蓄力後仰
    [0.5, { x: 4, rot: 0.06, sx: 1.07, sy: 0.95, lean: 0.32, head: 0.06, hdx: 4, armN: 1.65, armF: 0.4, tail: 0.55, earL: -0.35, earR: 0.35 }, 'out'], // 扭轉前傾打出
    [0.64, { x: 3.4, rot: 0.05, lean: 0.27, head: 0.04, hdx: 3.4, armN: 1.5, armF: 0.3, tail: 0.45 }, 'io'],
    [0.98, { x: -1, rot: -0.02, lean: -0.06, head: -0.05, armN: -0.15, tail: -0.15 }, 'back'],                 // 回位過衝
    [1.3, {}, 'io']] },
  nod: { dur: 1.0, idle: 0.5, keys: [
    [0, {}],
    [0.2, { head: -0.13, hdy: -0.6 }, 'io'],
    [0.4, { head: 0.36, lean: 0.05, hdx: 1, earL: 0.15, earR: -0.15, face: 'happy' }, 'out'],
    [0.56, { head: 0.04, face: 'happy' }, 'io'],
    [0.72, { head: 0.3, lean: 0.04, hdx: 0.8, face: 'happy' }, 'out'],
    [1.0, {}, 'back']] },
  bow: { dur: 1.8, idle: 0.2, keys: [
    [0, {}],
    [0.25, { lean: -0.06, sy: 1.02, head: -0.05 }, 'io'],
    [0.8, { x: 1.5, sy: 0.97, lean: 0.46, head: 0.35, hdx: 1.5, armN: 0.2, armF: 0.1, tail: 0.3, earL: 0.3, earR: -0.3, face: 'closed' }, 'io'],
    [1.2, { x: 1.5, sy: 0.97, lean: 0.46, head: 0.35, hdx: 1.5, armN: 0.2, armF: 0.1, tail: 0.3, earL: 0.3, earR: -0.3, face: 'closed' }, 'io'],
    [1.5, { lean: -0.06, head: -0.06, tail: -0.05 }, 'back'],
    [1.8, {}, 'io']] },
  'happy-hop': { dur: 1.2, idle: 0.2, keys: [
    [0, {}],
    [0.22, { sx: 1.13, sy: 0.82, lean: 0.06, head: 0.1, earL: 0.2, earR: -0.2, tail: -0.2 }, 'io'],            // 下蹲蓄力
    [0.45, { y: 14, sx: 0.91, sy: 1.13, lean: -0.08, head: -0.12, armN: 0.8, armF: 0.6, tail: 0.55, earL: -0.4, earR: 0.4, face: 'happy' }, 'out'], // 離地伸展
    [0.62, { y: 16, sx: 0.98, sy: 1.04, lean: -0.04, head: -0.06, armN: 0.6, armF: 0.4, tail: 0.4, face: 'happy' }, 'out'],
    [0.82, { sx: 1.16, sy: 0.8, lean: 0.07, head: 0.12, earL: 0.35, earR: -0.35, tail: -0.3, face: 'happy' }, 'in'], // 落地擠壓
    [0.98, { sx: 0.97, sy: 1.05, head: -0.04, face: 'happy' }, 'back'],
    [1.2, {}, 'io']] },
  cheer: { dur: 1.6, idle: 0.2, keys: [
    [0, {}],
    [0.2, { sx: 1.06, sy: 0.9, lean: 0.04 }, 'io'],
    [0.4, { y: 6, sx: 0.95, sy: 1.08, lean: -0.12, head: -0.2, armN: 2.2, armF: 2.0, tail: 0.6, earL: -0.3, earR: 0.3, face: 'happy' }, 'out'],
    [0.6, { sx: 1.05, sy: 0.92, lean: -0.04, armN: 1.6, armF: 1.4, tail: 0.2, face: 'happy' }, 'in'],
    [0.8, { y: 6, sx: 0.95, sy: 1.08, lean: -0.12, head: -0.2, armN: 2.2, armF: 2.0, tail: 0.6, earL: -0.3, earR: 0.3, face: 'happy' }, 'out'],
    [1.0, { sx: 1.05, sy: 0.92, armN: 1.2, armF: 1.0, face: 'happy' }, 'in'],
    [1.3, { sx: 0.98, sy: 1.02, face: 'happy' }, 'back'],
    [1.6, {}, 'io']] },
  sad: { dur: 2.4, idle: 0.3, keys: [
    [0, {}],
    [0.6, { sx: 1.03, sy: 0.94, lean: 0.12, head: 0.35, hdy: 3, earL: 0.5, earR: -0.5, tail: -0.55, face: 'sad' }, 'io'], // 垂頭縮肩
    [1.8, { sx: 1.03, sy: 0.93, rot: -0.02, lean: 0.14, head: 0.38, hdy: 3.2, earL: 0.55, earR: -0.55, tail: -0.6, face: 'sad' }, 'io'],
    [2.4, {}, 'io']] },
  sleep: { dur: 4.0, idle: 0.6, keys: [
    [0, {}],
    [0.8, { sx: 1.08, sy: 0.82, lean: 0.08, head: 0.4, hdy: 4, earL: 0.5, earR: -0.5, tail: -0.3, face: 'closed' }, 'io'],
    [3.2, { sx: 1.08, sy: 0.82, lean: 0.08, head: 0.42, hdy: 4, earL: 0.5, earR: -0.5, tail: -0.3, face: 'closed' }, 'io'],
    [4.0, {}, 'back']] },
  'tap-react': { dur: 0.8, idle: 0.2, keys: [
    [0, {}],
    [0.08, { x: -4, rot: -0.14, sx: 1.08, sy: 0.9, head: -0.2, earL: -0.5, earR: 0.5, tail: 0.3, face: 'smug' }, 'out'], // 被戳偏移
    [0.3, { x: 1.5, rot: 0.07, sx: 0.97, sy: 1.05, head: 0.08, tail: -0.2, face: 'happy' }, 'back'],                     // 彈回過衝
    [0.5, { x: -0.5, rot: -0.03, head: -0.03, face: 'happy' }, 'io'],
    [0.8, {}, 'io']] },
  turn: { dur: 2.0, idle: 0.4, keys: [
    [0, {}],
    [0.4, { flip: 0.5, y: 5, sx: 0.95, sy: 1.05, head: -0.1 }, 'in'],                                     // 轉身瞬間小跳,掩蓋寬度翻面
    [0.8, { flip: 1 }, 'out'],
    [1.2, { flip: 1 }, 'io'],
    [1.6, { flip: 0.5, y: 5, sx: 0.95, sy: 1.05, head: -0.1 }, 'in'],
    [2.0, {}, 'out']] }
};
var _PD_ACT_LIST = ['idle', 'greet', 'punch', 'nod', 'bow', 'happy-hop', 'cheer', 'sad', 'sleep', 'tap-react', 'turn'];
var _PD_POSE0 = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, lean: 0, head: 0, hdx: 0, hdy: 0, hs: 1, yaw: 0, tail: 0, curl: 0, earL: 0, earR: 0, armN: 0, armF: 0, wing: 0, flip: 0 };
var _PD_CH = ['x', 'y', 'rot', 'sx', 'sy', 'lean', 'head', 'hdx', 'hdy', 'hs', 'yaw', 'tail', 'curl', 'earL', 'earR', 'armN', 'armF', 'wing', 'flip'];
function _pdStrHash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003; return h; }
function _pdEase(kind, u) {
  u = _pdClamp(u, 0, 1);
  if (kind === 'out') return 1 - (1 - u) * (1 - u) * (1 - u);
  if (kind === 'in') return u * u * u;
  if (kind === 'back') { var v = u - 1; return 1 + 2.70158 * v * v * v + 1.70158 * v * v; }
  return u * u * (3 - 2 * u);
}
// 關鍵幀取樣:回傳 { p: 各關節值, face }
function _pdKeyAt(act, t) {
  var ks = act.keys, i = 0, out = {}, k, a, b, e, face;
  while (i < ks.length - 2 && t >= ks[i + 1][0]) i++;
  a = ks[i]; b = ks[i + 1] || a;
  e = b === a ? 0 : _pdEase(b[2], (t - a[0]) / Math.max(0.001, b[0] - a[0]));
  for (k = 0; k < _PD_CH.length; k++) {
    var ch = _PD_CH[k], va = a[1][ch] !== undefined ? a[1][ch] : _PD_POSE0[ch], vb = b[1][ch] !== undefined ? b[1][ch] : _PD_POSE0[ch];
    out[ch] = va + (vb - va) * e;
  }
  face = (e < 0.5 ? a[1].face : b[1].face) || null;
  return { p: out, face: face };
}
// 待機層:呼吸 squash&stretch、重心左右轉移、扭動(頭延遲 0.13 秒、尾再延遲)、耳尾次級運動、轉頭、眨眼。相位以 id 雜湊錯開。
function _pdIdle(id, t, sleepy) {
  var ph = _pdH(_pdStrHash(id)) * Math.PI * 2, w = Math.PI * 2 / 2.6, s0 = Math.sin(w * t + ph), amp = 0.085;
  var b = Math.sin((sleepy ? 0.6 : 1) * Math.PI * t + ph), br = sleepy ? 0.045 : 0.03;
  var yaw = Math.sin(w * 0.43 * t + ph * 1.3);
  return {
    root: s0 * amp,
    shift: Math.sin(w * 0.5 * t + ph) * 1.2,
    head: (Math.sin(w * (t - 0.13) + ph) - s0) * amp * 1.6 + Math.sin(w * 0.5 * t + ph * 1.7) * 0.03,
    tail: Math.sin(w * (t - 0.3) + ph) * amp * 2.2 + Math.sin(w * 2.1 * t + ph) * 0.07,
    curl: Math.sin(w * (t - 0.45) + ph) * 0.18,
    ear: Math.sin(w * 1.7 * t + ph + 1.3) * 0.09,
    wing: Math.sin(w * 1.4 * t + ph) * 0.1,
    yaw: yaw,
    bx: 1 - b * br * 0.5,
    by: 1 + b * br,
    blink: ((t + ph * 0.7) % 3.7) < 0.13
  };
}
// 組合:動作關鍵幀 + 待機層 → 部件用的 A
function _pdPoseOf(id, name, t, loop) {
  var rig = _PD_RIG[id] || { hip: 16, arm: 'paw' }, act = _PD_ACT[name] || _PD_ACT.idle, tt = t, P, K, I, wI, d;
  if (loop || act === _PD_ACT.idle) tt = ((t % act.dur) + act.dur) % act.dur;
  K = _pdKeyAt(act, _pdClamp(tt, 0, act.dur));
  P = K.p;
  I = _pdIdle(id, t, name === 'sleep');
  wI = act.idle;
  P.rot += I.root * wI; P.x += I.shift * wI; P.head += I.head * wI; P.tail += I.tail; P.curl += I.curl;
  P.earL += I.ear; P.earR -= I.ear * 0.8; P.wing += I.wing * wI; P.yaw += I.yaw * wI;
  P.sx *= I.bx; P.sy *= I.by;
  if (rig.lean) P.lean *= rig.lean;
  if (rig.arm === 'none') { P.hdx += P.armN * 2.2; P.earL -= P.armN * 0.25; P.earR += P.armN * 0.25; P.armN = 0; P.armF = 0; }
  if (rig.arm === 'wing') P.wing += P.armN * 0.7;
  P.hs *= 1 + Math.max(0, P.lean) * 0.18;                                           // 前傾時頭部透視放大(近大遠小)
  d = Math.cos(Math.PI * _pdClamp(P.flip, 0, 1));
  return {
    x: P.x, y: P.y, root: P.rot, sx: P.sx, sy: P.sy, lean: P.lean, hip: Math.max(3, rig.hip),
    head: P.head, hdx: P.hdx, hdy: P.hdy, hs: P.hs, hsx: 1 - 0.07 * Math.abs(P.yaw), fdx: P.yaw * 1.2,
    tail: P.tail, curl: P.curl, ear: P.earL, ear2: P.earR, armN: P.armN, armF: P.armF, wing: P.wing,
    par: P.rot * 18 + P.x * 0.3, dir: Math.abs(d) < 0.4 ? (d < 0 ? -0.4 : 0.4) : d,
    face: K.face, blink: I.blink, zz: K.face === 'closed' && name === 'sleep'
  };
}
// 部件變換。種類:legF / legN(後腿,腳底釘地)、armF / armN(前腳兼手:釘地 + 繞肩擺)、handF / handN(懸空手)、
//   head、tail、ear(earL)、ear2(earR)、wing、far(背景側視差)。(px,py) = 樞軸。
function _pdPart(g, kind, px, py, fn) {
  var A = g.A, c = g.ctx, r = 0, sx = 1, sy = 1, dx = 0, dy = 0, fd = g.fdx, pin = kind.charAt(0) === 'l' || kind.charAt(1) === 'r', far;
  if (!A) { fn(); return; }
  c.save();
  if (pin) {
    // 抵消前傾(繞髖)、全身傾斜與重心平移,再斜切讓腿頂跟著身體走、腳底留在原地;遠近側反向視差
    far = kind.charAt(kind.length - 1) === 'F';
    c.translate(0, -A.hip); c.rotate(-A.lean); c.translate(0, A.hip);
    c.rotate(-A.root);
    c.translate(-A.x / A.sx, 0);
    c.transform(1, 0, -(Math.sin(A.root) + A.x / (A.hip * A.sx)), 1, 0, 0);
    c.translate(far ? A.par : -A.par * 0.6, 0);
    if (kind.charAt(0) === 'a') { c.translate(px, py); c.rotate(-(far ? A.armF : A.armN)); c.translate(-px, -py); }
    fn();
    c.restore();
    return;
  }
  if (kind === 'head') { r = A.head; dx = A.hdx; dy = A.hdy; sx = A.hs * A.hsx; sy = A.hs; g.fdx = (fd || 0) + A.fdx; }
  else if (kind === 'tail') r = A.tail;
  else if (kind === 'ear') r = A.ear;
  else if (kind === 'ear2') r = A.ear2;
  else if (kind === 'wing') r = A.wing;
  else if (kind === 'handN') r = -A.armN;
  else if (kind === 'handF') r = -A.armF;
  else if (kind === 'far') dx = A.par;
  c.translate(px + dx, py + dy);
  if (r) c.rotate(r);
  if (sx !== 1 || sy !== 1) c.scale(sx, sy);
  c.translate(-px, -py);
  fn();
  c.restore();
  g.fdx = fd;
}
// 多節尾巴:沿點列逐節累加彎曲角(curl),靜止時原樣
function _pdTP(g, pts) {
  if (!g.A || !g.A.curl) return pts;
  var out = [pts[0]], acc = 0, n = pts.length, i, vx, vy, ca, sa;
  for (i = 1; i < n; i++) {
    acc += g.A.curl / (n - 1);
    vx = pts[i][0] - pts[i - 1][0]; vy = pts[i][1] - pts[i - 1][1];
    ca = Math.cos(acc); sa = Math.sin(acc);
    out.push([out[i - 1][0] + vx * ca - vy * sa, out[i - 1][1] + vx * sa + vy * ca]);
  }
  return out;
}

// ---- 木:狌狌(猿,正面站立、白大耳、心形臉、捲尾、抱竹筍)----
function _pdBXingxing(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = '#fffaf0';
  _pdPart(g, 'tail', 7, -12, function () { _pdTube(g, _pdTP(g, [[7, -12], [20, -10], [27, -22], [22, -33], [15, -30], [18, -24]]), 3.4, c0); });
  _pdPart(g, 'legN', 0, 0, function () {
    _pdEll(g, -6, -2.6, 5, 3, 0, c1, 1.4);
    _pdEll(g, 6, -2.6, 5, 3, 0, c1, 1.4);
  });
  _pdBodyE(g, 0, -15, 10, 11, 0, c0);
  if (!g.sil) _pdEll(g, 0, -13, 6.5, 7.5, 0, c1, 0);
  _pdBlob(g, [[-5.5, -7], [5.5, -7], [3, -19], [0, -29], [-3, -19]], '#8fd16b', 1.3);
  if (!g.sil) {
    _pdLine(g, [[-4, -11], [0, -14], [4, -11]], '#4f9a3a', 1.1);
    _pdLine(g, [[-3, -17], [0, -20], [3, -17]], '#4f9a3a', 1.1);
  }
  _pdPart(g, 'handF', -9, -22, function () {
    _pdTube(g, [[-9, -22], [-8, -15], [-3.5, -13]], 4.2, c0);
    _pdEll(g, -3.5, -13, 2.6, 2.4, 0, c1, 1.0);
  });
  _pdPart(g, 'handN', 9, -22, function () {
    _pdTube(g, [[9, -22], [8, -15], [3.5, -13]], 4.2, c0);
    _pdEll(g, 3.5, -13, 2.6, 2.4, 0, c1, 1.0);
  });
  _pdPart(g, 'head', 0, -26, function () {
    [-1, 1].forEach(function (s) {
      _pdPart(g, s < 0 ? 'ear' : 'ear2', s * 11, -38, function () {
        _pdEll(g, s * 16, -38, 8, 8.5, 0, c2, 1.6);
        if (!g.sil) _pdEll(g, s * 16, -38, 4.4, 5, 0, '#ffb8ae', 0);
      });
    });
    _pdPoly(g, [[-5, -48], [-3, -57], [0, -51], [3, -58], [5, -48]], c0, 1.4);
    _pdBodyE(g, 0, -38, 14.5, 13.5, 0, c0);
    if (!g.sil) _pdUnion(g, [[-5 + (g.fdx || 0), -39, 6.5, 6.5], [5 + (g.fdx || 0), -39, 6.5, 6.5], [(g.fdx || 0), -32.5, 8.5, 6]], c1, 0.6);
    _pdFaceV(g, { x: 0, y: -39, sp: 5, er: 2.6, mx: 0, my: -31.5, mouth: 'smile', cx: 7.8 });
  });
}
// ---- 木:鹿蜀(小馬駒,白頭、虎紋、紅鬃紅尾,張嘴唱歌)----
function _pdBLushu(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = L.c[2], far = _pdTone(c0, 0.8), hoof = '#6b3f22', head = '#fffaf0';
  _pdPart(g, 'tail', -17, -28, function () {
    _pdBlob(g, [[-17, -29], [-30, -35], [-37, -22], [-33, -7], [-28, -15], [-24, -24]], c2, 1.6);
    if (!g.sil) _pdLine(g, [[-23, -28], [-30, -26], [-32, -15]], _pdTone(c2, 1.3), 1.4);
  });
  _pdPart(g, 'legF', 0, 0, function () { _pdLeg(g, -11, -22, -12, 4.4, far, _pdTone(hoof, 0.8)); });
  _pdPart(g, 'armF', 5, -22, function () { _pdLeg(g, 5, -22, 6, 4.4, far, _pdTone(hoof, 0.8)); });
  _pdPart(g, 'legN', 0, 0, function () { _pdLeg(g, -16, -22, -17, 4.6, c0, hoof); });
  _pdPart(g, 'armN', 10, -22, function () { _pdLeg(g, 10, -22, 11, 4.6, c0, hoof); });
  _pdPart(g, 'head', 5, -28, function () {
    [[2.5, -33, 3.6], [4, -39, 3.9], [7, -45, 3.9], [10, -50, 3.4]].forEach(function (p) { _pdEll(g, p[0], p[1], p[2], p[2], 0, c2, 1.4); });
    _pdTube(g, [[4, -26], [10, -37], [13, -43]], 8.5, c0);
  });
  _pdBodyE(g, -3, -25, 16, 10, 0, c0);
  if (!g.sil) {
    _pdEll(g, -2, -19.2, 11, 3.6, 0, c1, 0);
    [-13, -7, -1].forEach(function (x) { _pdLine(g, [[x + 1, -34], [x - 1, -28], [x + 1, -22.5]], '#7a4a1e', 2); });
  }
  _pdPart(g, 'head', 5, -28, function () {
    if (!g.sil) _pdLine(g, [[7, -31], [10, -33]], '#7a4a1e', 1.8);
    _pdPart(g, 'ear2', 10, -54, function () { _pdPoly(g, [[8.5, -52], [8, -64], [14, -55]], _pdTone(head, 0.82), 1.4); });
    _pdPart(g, 'ear', 18, -54, function () {
      _pdPoly(g, [[15, -55], [19, -65], [21.5, -53]], head, 1.4);
      if (!g.sil) _pdEll(g, 18.6, -57, 1.4, 3, 0.3, '#ffb8ae', 0);
    });
    _pdPoly(g, [[9, -53], [10.5, -60], [13, -55], [15.5, -60.5], [16.5, -54]], c2, 1.3);
    _pdUnion(g, [[15, -46, 11, 10.5], [23.5, -39.5, 8.2, 6.4, 0.35]], head);
    if (!g.sil) {
      _pdEll(g, 17, -40, 7, 3, 0.2, '#f1e8da', 0);
      _pdHi(g, 10, -51, 3.4, 1.9);
      _pdDot(g, 29, -40.5, 1, _PD_INK);
    }
    _pdFaceV(g, { x: 17, y: -47, sp: 4, er: 2.5, far: 0.82, mx: 25.5, my: -35.5, mouth: 'open', mk: 2, cx: 5 });
    if (!g.sil) {
      _pdTxt(g, '♪', 32, -53, 'bold 10px sans-serif', c2);
      _pdTxt(g, '♫', 27, -63, 'bold 8px sans-serif', '#4caf50');
    }
  });
}
// ---- 木:九尾狐(坐姿奶油白狐,九尾扇形展開、尾尖青綠、額心花鈿)----
function _pdBJiuwei(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = L.c[2], c = g.ctx, i, a, len, pts;
  for (i = 0; i < 9; i++) {
    a = Math.PI * (0.8 + i * 0.082) + (g.A ? g.A.tail * (0.45 + i * 0.09) : 0);
    len = 29 + (i % 2) * 3;
    pts = [[0, -2], [len * 0.35, -5], [len * 0.62, -6.4], [len * 0.88, -4.2], [len + 1.5, 1.5], [len * 0.88, 5.4], [len * 0.62, 6.6], [len * 0.35, 4.8], [0, 2]];
    c.save(); c.translate(-5, -20); c.rotate(a);
    _pdBlob(g, pts, i % 2 ? c0 : _pdTone(c0, 0.9), 0);
    if (!g.sil) _pdBlob(g, [[len * 0.72, -5.8], [len * 0.9, -4], [len + 2, 1.5], [len * 0.9, 5.2], [len * 0.72, 6.4], [len * 0.66, 0.4]], c2, 0);
    _pdBlob(g, pts, null, 1.3);
    c.restore();
  }
  _pdBodyE(g, -3, -9, 9, 8, 0, c0);
  _pdBlob(g, [[-6, -3], [-8, -16], [-2, -29], [7, -29], [11, -16], [9, -3]], c0, 1.6);
  if (!g.sil) {
    _pdHi(g, -4, -22, 2.4, 3.6);
    _pdUnion(g, [[4, -24, 4.5, 3.6], [2.6, -20.5, 3, 2.6], [5.6, -20, 3, 2.6]], c1, 0.5);
  }
  _pdPart(g, 'armF', 2, -15, function () { _pdLeg(g, 2, -15, 2, 4.2, _pdTone(c0, 0.92), null); _pdEll(g, 2, -1.8, 3, 2, 0, c1, 1.1); });
  _pdPart(g, 'armN', 7.5, -15, function () { _pdLeg(g, 7.5, -15, 8, 4.2, c0, null); _pdEll(g, 8, -1.8, 3, 2, 0, c1, 1.1); });
  _pdPart(g, 'head', 3, -29, function () {
    _pdPart(g, 'ear', -5, -47, function () {
      _pdPoly(g, [[-9, -44], [-10, -61], [1, -50]], c0, 1.6);
      if (!g.sil) _pdPoly(g, [[-7.5, -46], [-8.5, -57], [-1.5, -50]], '#ffc0a8', 0);
    });
    _pdPart(g, 'ear2', 11, -48, function () {
      _pdPoly(g, [[6, -50], [15, -61], [16, -43]], c0, 1.6);
      if (!g.sil) _pdPoly(g, [[8, -50], [14, -57.5], [14.5, -46]], '#ffc0a8', 0);
    });
    _pdBlob(g, [[-12, -43], [-8, -51], [4, -53], [14, -48], [18, -36], [11, -35], [4, -28], [-4, -35], [-12, -35]], c0, 1.6);
    if (!g.sil) {
      var fd = g.fdx || 0;
      _pdEll(g, 7 + fd, -36, 7, 3.6, 0.2, '#f4e2cc', 0);
      _pdHi(g, -4, -47, 3.6, 2);
      _pdEll(g, 3.5 + fd, -34.5, 5, 3.6, 0, c1, 0);
      _pdEll(g, 3.5 + fd, -36.8, 1.7, 1.2, 0, _PD_INK, 0);
      for (i = 0; i < 3; i++) {
        a = -Math.PI / 2 + (i - 1) * 0.9;
        _pdEll(g, 3 + fd + Math.cos(a) * 1.8, -47.5 + Math.sin(a) * 1.8, 1.3, 2, a + Math.PI / 2, c2, 0);
      }
    }
    _pdFaceV(g, { x: 3, y: -41.5, sp: 5.3, er: 2.5, mx: 3.5, my: -33.5, mouth: 'w', mk: 1.5, cx: 8 });
  });
}
// ---- 火:火鼠(飯糰形紅鼠,大圓耳、背上火苗、細尾火球)----
function _pdBHuoshu(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = L.c[2], pink = '#ffb0a0';
  _pdPart(g, 'tail', -15, -8, function () {
    var tp = _pdTP(g, [[-15, -8], [-27, -5], [-33, -15], [-29, -25]]), e = tp[3];
    _pdTube(g, tp, 2.2, _pdTone(c0, 0.85));
    _pdFire(g, e[0], e[1] - 5, 10, 0.2);
  });
  _pdFlameR(g, -16, -21, 7.5, c2, -0.75);
  _pdFlameR(g, -10, -26, 9, c2, -0.45);
  _pdFlameR(g, -3, -28.5, 8, c2, -0.2);
  _pdPart(g, 'far', 0, 0, function () {
    _pdPart(g, 'ear2', 12, -26, function () { _pdEll(g, 13, -31, 7, 7, 0, _pdTone(c0, 0.82), 1.6); });
  });
  _pdPart(g, 'legN', 0, 0, function () {
    _pdEll(g, -8, -1.8, 4.5, 2.4, 0, pink, 1.2);
    _pdEll(g, 10, -1.8, 4.5, 2.4, 0, pink, 1.2);
  });
  _pdBlob(g, [[-19, -8], [-16, -24], [-2, -29], [12, -24], [22, -13], [26, -6], [14, -1], [-14, -1]], g.sil ? c0 : _pdTone(c0, 0.84), 1.6);
  if (!g.sil) {
    _pdBlob(g, [[-18, -9], [-15, -25], [-2, -29], [11, -24], [20, -14], [22, -8], [12, -4], [-13, -4]], c0, 0);
    _pdHi(g, -9, -21, 5, 2.4);
    _pdEll(g, 8, -6.5, 11, 4.6, 0, c1, 0);
  }
  _pdPart(g, 'ear', 5, -25, function () {
    _pdEll(g, 5, -31, 7.6, 7.6, 0, c0, 1.6);
    if (!g.sil) _pdEll(g, 5, -31, 4.3, 4.3, 0, pink, 0);
  });
  _pdPart(g, 'handN', 12, -7, function () { _pdEll(g, 15, -4, 2.6, 2, 0.4, pink, 1.0); });
  _pdPart(g, 'head', 14, -12, function () {
    _pdEll(g, 25, -7.5, 2.2, 1.9, 0, '#ff8a9a', 1.0);
    if (!g.sil) {
      _pdLine(g, [[21, -9.5], [29.5, -12.5]], _PD_INK, 0.8);
      _pdLine(g, [[21, -7.5], [30, -7]], _PD_INK, 0.8);
    }
    _pdFaceV(g, { x: 14.5, y: -15, sp: 3.6, er: 2.4, far: 0.85, mx: 20.5, my: -5.5, mouth: 'w', mk: 1.3, cx: 4.4 });
  });
}
// ---- 火:畢方(青鶴,單腳、紅紋、白長喙、丹頂,腳邊有火)----
function _pdBBifang(g, L) {
  var c0 = L.c[0], c2 = L.c[2], leg = '#e2583a', dk = _pdTone(c0, 0.7);
  _pdPart(g, 'tail', -12, -27, function () {
    [[[-12, -24], [-27, -10]], [[-12, -27], [-32, -20]], [[-12, -30], [-32, -32]]].forEach(function (p) {
      var dx = p[1][0] - p[0][0], dy = p[1][1] - p[0][1];
      _pdFeather(g, p[0], p[1], 7, dk);
      if (!g.sil) _pdFeather(g, [p[0][0] + dx * 0.72, p[0][1] + dy * 0.72], p[1], 4.6, c2, 0);
    });
  });
  _pdPart(g, 'legN', 0, 0, function () {
    if (!g.sil) { _pdFire(g, -10, -2.5, 10, -0.15); _pdFire(g, -16, -1.5, 6, -0.3); }
    _pdTube(g, [[0, -19], [2.5, -10], [0, -2]], 2.4, leg, 1.2);
    _pdTube(g, [[-4.5, -0.6], [0, -1.8], [5, -0.6]], 1.8, leg, 1.0);
  });
  _pdBodyE(g, -3, -27, 15, 10.5, -0.2, c0);
  if (!g.sil) _pdEll(g, 6.5, -26, 5.5, 6.5, 0, '#ffffff', 0);
  _pdPart(g, 'wing', -6, -30, function () {
    _pdBlob(g, [[-17, -27], [-6, -35], [5, -31], [-1, -23], [-13, -20]], _pdTone(c0, 0.86), 1.2);
    if (!g.sil) {
      [[-12, -27], [-6, -29], [-1, -27.5], [-8, -24]].forEach(function (p) {
        _pdLine(g, [[p[0] - 2, p[1] - 2], [p[0], p[1]], [p[0] - 2, p[1] + 2]], c2, 1.6);
      });
    }
  });
  _pdPart(g, 'head', 5, -31, function () {
    _pdTube(g, [[5, -31], [3, -40], [8, -46]], 6, c0);
    _pdEll(g, 7, -61, 4.2, 3.2, -0.2, c2, 1.2);
    _pdBodyE(g, 10, -51, 10, 9.5, 0, c0);
    _pdPoly(g, [[18, -54], [30, -50.5], [18, -47]], '#f7f2e6', 1.2);
    if (!g.sil) _pdLine(g, [[2, -47], [6, -45]], c2, 1.5);
    _pdFaceV(g, { x: 11, y: -51.5, sp: 3.6, er: 2.4, far: 0.8, mouth: 'none', cx: 4.2 });
  });
}
// ---- 火:火麒麟(紅鱗麒麟,金獨角、火焰鬃與尾、金蹄、抬前腳)----
function _pdBHuoqilin(g, L) {
  var c0 = L.c[0], c1 = L.c[1], gold = '#ffc94a', far = _pdTone(c0, 0.8), i;
  _pdPart(g, 'tail', -17, -28, function () {
    var tp = _pdTP(g, [[-17, -28], [-25, -32], [-28, -40]]), e = tp[2];
    _pdTube(g, tp, 4, c0);
    _pdFire(g, e[0] - 1, e[1] - 4, 12, -0.3);
  });
  _pdPart(g, 'legF', 0, 0, function () { _pdLeg(g, -10, -22, -11, 4.4, far, _pdTone(gold, 0.85)); });
  _pdPart(g, 'armF', 5, -22, function () { _pdLeg(g, 5, -22, 6, 4.4, far, _pdTone(gold, 0.85)); });
  _pdPart(g, 'legN', 0, 0, function () { _pdLeg(g, -15, -22, -16, 4.6, c0, gold); });
  _pdPart(g, 'armN', 10, -22, function () {
    _pdTube(g, [[10, -22], [16, -15], [13.5, -9.5]], 4.6, c0);
    _pdEll(g, 13.2, -8, 3, 2, 0.3, gold, 1.2);
  });
  _pdPart(g, 'head', 5, -28, function () {
    [[1, -33, 9, -1.0], [3, -40, 10, -0.85], [6, -47, 10, -0.65], [10, -53, 8, -0.4]].forEach(function (f) { _pdFire(g, f[0], f[1], f[2], f[3]); });
  });
  _pdBodyE(g, -3, -26, 16, 10, 0, c0);
  _pdPart(g, 'head', 5, -28, function () { _pdTube(g, [[5, -28], [11, -40], [13, -45]], 9, c0); });
  if (!g.sil) {
    _pdEll(g, -3, -19.8, 12, 3.8, 0, c1, 0);
    for (i = 0; i < 7; i++) _pdArc(g, -13 + (i % 4) * 6 + (i >= 4 ? 3 : 0), -29 + (i >= 4 ? 5 : 0), 2.5, 0, Math.PI, '#ffd36b', 1.3);
  }
  _pdPart(g, 'head', 5, -28, function () {
    _pdPart(g, 'ear', 8, -47, function () { _pdPoly(g, [[8, -49], [1, -53], [9, -45]], far, 1.4); });
    _pdBlob(g, [[11, -52], [9, -59], [6, -66], [12, -60], [16, -53]], gold, 1.4);
    _pdUnion(g, [[15, -46, 9.5, 8.5], [23, -42, 7.5, 5.5, 0.25]], c0);
    if (!g.sil) {
      _pdEll(g, 17, -41, 7, 2.6, 0.25, _pdTone(c0, 0.86), 0);
      _pdHi(g, 11, -50, 3.2, 1.8);
      _pdDot(g, 28, -42.5, 0.9, _PD_INK);
      _pdLine(g, [[13, -51.5], [18, -52.5]], gold, 1.6);
    }
    _pdTube(g, [[26, -39], [30.5, -36], [28.5, -32]], 1.5, gold, 0.8);
    _pdFaceV(g, { x: 17.5, y: -46.5, sp: 3.4, er: 2.3, far: 0.82, mx: 24.5, my: -38.5, mouth: 'smile', mk: 1.5, cx: 4.4 });
  });
}
// ---- 土:當康(粉紅小豬,白獠牙、背黃粱、捲尾,喊「當康!」)----
function _pdBDangkang(g, L) {
  var c0 = L.c[0], c1 = L.c[1], far = _pdTone(c0, 0.82), trot = '#c8746a', i;
  _pdPart(g, 'tail', -19, -22, function () { _pdTube(g, _pdTP(g, [[-19, -22], [-25, -24], [-26, -29], [-22, -30], [-22, -26]]), 2, c0, 1.2); });
  if (!g.sil) {
    for (i = 0; i < 3; i++) {
      var bx = -11 + i * 6;
      _pdTube(g, [[bx, -27], [bx - 2, -40], [bx + 3, -45]], 1.4, '#a8892a', 0.7);
      _pdUnion(g, [[bx + 3.5, -44.5, 1.8, 2.4], [bx + 5, -42, 1.8, 2.4], [bx + 6, -39.2, 1.7, 2.2]], '#f5cf5a', 0.7);
    }
  }
  _pdPart(g, 'legF', 0, 0, function () { _pdLeg(g, -8, -12, -8, 6, far, _pdTone(trot, 0.85)); });
  _pdPart(g, 'armF', 9, -12, function () { _pdLeg(g, 9, -12, 9, 6, far, _pdTone(trot, 0.85)); });
  _pdPart(g, 'legN', 0, 0, function () { _pdLeg(g, -14, -12, -14, 6.2, c0, trot); });
  _pdPart(g, 'armN', 4, -12, function () { _pdLeg(g, 4, -12, 4, 6.2, c0, trot); });
  _pdPart(g, 'head', 8, -20, function () {
    _pdPart(g, 'ear2', 16, -34, function () { _pdPoly(g, [[12, -33], [18, -43], [21, -31]], far, 1.4); });
  });
  _pdBodyE(g, -3, -20, 18, 12.5, 0, c0);
  if (!g.sil) _pdEll(g, -3, -12, 12, 3.6, 0, c1, 0);
  _pdPart(g, 'head', 8, -20, function () {
    _pdBodyE(g, 14, -24, 11.5, 10.5, 0, c0);
    _pdPart(g, 'ear', 8, -33, function () { _pdPoly(g, [[6, -30], [3, -41], [13, -34]], _pdTone(c0, 0.92), 1.4); });
    _pdEll(g, 25, -21.5, 4.2, 5.2, 0, '#f59a8a', 1.4);
    if (!g.sil) { _pdEll(g, 24.6, -23.4, 0.8, 1.2, 0, '#9a4a44', 0); _pdEll(g, 24.6, -19.4, 0.8, 1.2, 0, '#9a4a44', 0); }
    _pdPoly(g, [[20.5, -15], [22.5, -22.5], [24, -15.5]], '#ffffff', 1.1);
    _pdFaceV(g, { x: 15.5, y: -27, sp: 3.6, er: 2.4, far: 0.85, mx: 18, my: -17, mouth: 'smile', mk: 1.6, cx: 4.4 });
  });
  if (!g.sil) _pdBubble(g, 22, -47, '當康!');
}
// ---- 土:貔貅(金獅,捲毛鬃圈、短角、背上小翅、大嘴叼五銖錢)----
function _pdBPixiu(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = L.c[2], far = _pdTone(c0, 0.8), wing = '#fff6dc', i, a, sh = [];
  _pdPart(g, 'tail', -18, -24, function () {
    var tp = _pdTP(g, [[-18, -24], [-26, -29], [-26, -38]]);
    _pdTube(g, tp, 3, c0);
    _pdEll(g, tp[2][0], tp[2][1] - 2, 4, 4.5, 0, c2, 1.4);
  });
  _pdPart(g, 'far', 0, 0, function () {
    _pdPart(g, 'wing', -4, -32, function () { _pdUnion(g, [[-6, -42, 11, 3.6, -1.0], [-2, -43, 10, 3.4, -1.3]], _pdTone(wing, 0.88), 1.2); });
  });
  _pdPart(g, 'legF', 0, 0, function () { _pdLeg(g, -9, -18, -9, 6, far, null); });
  _pdPart(g, 'armF', 5, -18, function () { _pdLeg(g, 5, -18, 5, 6, far, null); });
  _pdPart(g, 'legN', 0, 0, function () { _pdLeg(g, -14, -18, -14, 6.2, c0, null); _pdEll(g, -14, -2.2, 4, 2.6, 0, c1, 1.2); });
  _pdPart(g, 'armN', 10, -18, function () { _pdLeg(g, 10, -18, 10, 6.2, c0, null); _pdEll(g, 10, -2.2, 4, 2.6, 0, c1, 1.2); });
  _pdBodyE(g, -3, -22, 16, 11, 0, c0);
  if (!g.sil) _pdEll(g, -3, -15.5, 12, 3.6, 0, c1, 0);
  _pdPart(g, 'wing', -6, -30, function () {
    _pdFeather(g, [-6, -30], [-24, -40], 7, _pdTone(wing, 0.95), 1.3);
    _pdFeather(g, [-6, -30], [-19, -47], 7.5, wing, 1.3);
    _pdFeather(g, [-5, -30], [-10, -50], 7, wing, 1.3);
    _pdEll(g, -5, -30, 4, 3.4, 0, wing, 1.2);
  });
  _pdPart(g, 'head', 8, -28, function () {
    for (i = 0; i < 12; i++) { a = i * Math.PI / 6; sh.push([10 + Math.cos(a) * 13, -38 + Math.sin(a) * 12.5, 5, 5]); }
    _pdUnion(g, sh, c2);
    if (!g.sil) for (i = 0; i < 12; i += 2) { a = i * Math.PI / 6 + 0.3; _pdArc(g, 10 + Math.cos(a) * 14, -38 + Math.sin(a) * 13.5, 2.2, a - 1.2, a + 1.2, _pdTone(c2, 1.4), 1.0); }
    _pdPart(g, 'ear', 2, -45, function () { _pdEll(g, 2, -47, 3.6, 3.6, 0, c0, 1.3); });
    _pdPart(g, 'ear2', 18, -45, function () { _pdEll(g, 18, -47, 3.6, 3.6, 0, c0, 1.3); });
    _pdBodyE(g, 10, -38, 12, 11, 0, c0);
    _pdPoly(g, [[7.5, -47], [10, -60], [12.5, -47]], '#fff0c8', 1.4);
    if (!g.sil) { _pdEll(g, 10 + (g.fdx || 0), -32.5, 7.5, 4.6, 0, c1, 0); _pdEll(g, 10 + (g.fdx || 0), -35, 1.8, 1.3, 0, _PD_INK, 0); }
    _pdFaceV(g, { x: 10, y: -40, sp: 4.6, er: 2.6, mx: 10, my: -32, mouth: 'open', mk: 3.2, cx: 6.5 });
    _pdEll(g, 10 + (g.fdx || 0), -27.5, 4.6, 4.6, 0, '#f0c040', 1.4);
    if (!g.sil) { var fx = 10 + (g.fdx || 0); _pdPoly(g, [[fx - 1.4, -28.9], [fx + 1.4, -28.9], [fx + 1.4, -26.1], [fx - 1.4, -26.1]], '#8a5a1d', 0.6); }
  });
}
// ---- 土:黃龍(長身蜿蜒,醒目鹿角、長鬚、腹部橫紋、抱土色寶珠)----
function _pdBHuanglong(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = L.c[2], ant = '#b8562a', i;
  var body = [[-16, -3], [0, -5], [9, -14], [7, -25], [-3, -31], [-5, -39], [1, -44]];
  [[-14, -7, -1.4], [-4, -9, -1.2], [11, -20, 0.6], [-5, -29, -1.0], [-9, -37, -1.3]].forEach(function (f) { _pdFlameR(g, f[0], f[1], 6, c2, f[2]); });
  _pdPart(g, 'tail', -14, -3, function () {
    _pdFlameR(g, -24, -6, 6, c2, -1.9);
    _pdFlameR(g, -36, -15, 8, c2, -1.2);
    _pdTube(g, _pdTP(g, [[-14, -3], [-29, -5], [-35, -14]]), 6, c0);
  });
  _pdTube(g, body, 11, g.sil ? c0 : _pdTone(c0, 0.86));
  if (!g.sil) {
    _pdTube(g, [[-15, -4.2], [-0.6, -6.2], [7.6, -14.4], [5.8, -25], [-3.6, -31.6], [-5.8, -39.4], [0.4, -44.6]], 7, c0, 0);
    _pdTube(g, [[-27, -6], [-14, -2.5], [0, -4], [8.5, -13], [6.5, -24], [-2.5, -30], [-4.5, -37]], 3.6, c1, 0);
    for (i = 0; i < body.length - 1; i++) {
      var mx = (body[i][0] + body[i + 1][0]) / 2, my = (body[i][1] + body[i + 1][1]) / 2;
      var dx = body[i + 1][0] - body[i][0], dy = body[i + 1][1] - body[i][1], ln = Math.sqrt(dx * dx + dy * dy) || 1;
      _pdLine(g, [[mx - dy / ln * 1.7, my + dx / ln * 1.7], [mx + dy / ln * 1.7, my - dx / ln * 1.7]], c2, 1.1);
    }
    _pdHi(g, -2, -35, 2.4, 1.4);
  }
  _pdPart(g, 'legN', 0, 0, function () { _pdTube(g, [[6, -9], [12, -6]], 3.2, c0, 1.2); });
  _pdPart(g, 'handN', 8, -22, function () {
    _pdTube(g, [[8, -22], [14, -24]], 3.2, c0, 1.2);
    _pdEll(g, 18, -24, 5.2, 5.2, 0, '#e08a2a', 1.4);
    if (!g.sil) { _pdDot(g, 16.5, -25.8, 1.5, '#fff3c0'); _pdArc(g, 18, -24, 7.5, Math.PI * 1.2, Math.PI * 1.75, '#ffd36b', 1.2); }
    _pdEll(g, 14, -24.5, 1.6, 1.6, 0, c0, 1.0);
  });
  _pdPart(g, 'head', 1, -44, function () {
    _pdFlameR(g, -5, -49, 7, c2, -1.3);
    _pdFlameR(g, -6, -43, 6, c2, -1.7);
    _pdPart(g, 'ear', 0, -52, function () {
      _pdTube(g, [[-1, -52], [-4, -59], [-9, -64]], 2.8, ant);
      _pdTube(g, [[-3.5, -58], [1, -63]], 2.3, ant);
    });
    _pdPart(g, 'ear2', 4, -53, function () {
      _pdTube(g, [[4, -53], [6, -60], [3.5, -66]], 2.8, ant);
      _pdTube(g, [[5.5, -59], [11, -62]], 2.3, ant);
    });
    _pdUnion(g, [[2, -47, 9, 8], [11, -44, 8, 5.5, 0.15]], c0);
    if (!g.sil) {
      _pdEll(g, 7, -42, 8, 2.6, 0.15, _pdTone(c0, 0.88), 0);
      _pdHi(g, -1, -51, 2.8, 1.5);
      _pdDot(g, 17, -45.5, 0.9, _PD_INK);
    }
    _pdTube(g, [[17, -43], [24, -46], [28, -41]], 1.2, c2, 0.6);
    _pdTube(g, [[15, -40], [20, -37], [21, -32]], 1.2, c2, 0.6);
    _pdFaceV(g, { x: 6, y: -48, sp: 3, er: 2.3, far: 0.85, mx: 13, my: -40.5, mouth: 'smile', mk: 1.5, cx: 3.8 });
  });
}
// ---- 金:狡(豹紋小狗,牛角、垂耳、搖尾、鈴鐺項圈)----
function _pdBJiao(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = L.c[2], far = _pdTone(c0, 0.8), horn = '#f4ead2';
  _pdPart(g, 'tail', -15, -22, function () {
    if (!g.sil) { _pdArc(g, -20, -32, 9, Math.PI * 1.05, Math.PI * 1.35, c2, 1.1); _pdArc(g, -20, -32, 12, Math.PI * 1.08, Math.PI * 1.3, c2, 1.0); }
    _pdTube(g, _pdTP(g, [[-15, -22], [-21, -30], [-19, -38]]), 4.4, c0);
  });
  _pdPart(g, 'legF', 0, 0, function () { _pdLeg(g, -8, -16, -8, 5, far, null); });
  _pdPart(g, 'armF', 4, -16, function () { _pdLeg(g, 4, -16, 4, 5, far, null); });
  _pdPart(g, 'legN', 0, 0, function () { _pdLeg(g, -13, -16, -13, 5.2, c0, null); });
  _pdPart(g, 'armN', 9, -16, function () { _pdLeg(g, 9, -16, 9, 5.2, c0, null); });
  _pdBodyE(g, -3, -20, 14, 9, 0, c0);
  if (!g.sil) {
    _pdEll(g, -2, -14.5, 10, 3.2, 0, c1, 0);
    [[-11, -22], [-4, -25.5], [3, -21], [-6, -17.5], [-14, -17]].forEach(function (p) {
      _pdEll(g, p[0], p[1], 2.3, 2, 0, null, 1.1);
      _pdDot(g, p[0], p[1], 0.9, c2);
    });
  }
  _pdPart(g, 'head', 6, -27, function () {
    _pdBlob(g, [[7, -42], [0, -45], [-4, -50], [-4, -55], [-1.5, -50.5], [3, -48.5], [8, -47.5]], horn, 1.4);
    _pdBlob(g, [[14, -47.5], [20, -48.5], [24.5, -51], [26, -56], [26.5, -50], [22, -45], [15, -43.5]], horn, 1.4);
    if (!g.sil) { _pdLine(g, [[-3.6, -53.5], [-2.4, -50.5]], c2, 1.4); _pdLine(g, [[25.6, -54.5], [25.2, -51.5]], c2, 1.4); }
    _pdBodyE(g, 11, -36, 12.5, 11.5, 0, c0);
    _pdEll(g, 20 + (g.fdx || 0) * 0.5, -31, 6.5, 4.8, 0, c1, 1.2);
    if (!g.sil) {
      _pdEll(g, 25.5 + (g.fdx || 0) * 0.5, -32.8, 2, 1.5, 0, _PD_INK, 0);
      _pdEll(g, 8, -43.5, 2.2, 1.9, 0, null, 1.1);
    }
    _pdPart(g, 'ear', 3, -42, function () { _pdBlob(g, [[3, -43], [-1.5, -37], [0, -28], [5.5, -33]], c2, 1.4); });
    _pdFaceV(g, { x: 13, y: -38, sp: 4, er: 2.5, far: 0.85, mx: 20.5, my: -26.8, mouth: 'open', mk: 1.8, cx: 5 });
  });
  _pdTube(g, [[3, -26], [10, -24.5]], 2.6, '#d23a2c', 1.0);
  _pdEll(g, 8.5, -22.6, 2.4, 2.4, 0, '#c9ced6', 1.0);
}
// ---- 金:天狗(橘棕狸,白頭、眼斑、環紋大蓬尾、紅項圈金鈴,有精神)----
function _pdBTiangou(g, L) {
  var c0 = L.c[0], c1 = L.c[1], head = '#fffaf0', dark = '#6b4426', i;
  var tail = [[-10, -12, 7.6], [-17, -16, 7.6], [-22, -23, 7.3], [-25, -31, 7], [-24, -39, 6.6], [-20, -46, 6], [-14, -50, 5.2]];
  _pdPart(g, 'tail', -8, -10, function () {
    for (i = tail.length - 1; i >= 0; i--) _pdEll(g, tail[i][0], tail[i][1], tail[i][2], tail[i][2], 0, i % 2 ? dark : c0, 1.4);
  });
  _pdBodyE(g, -4, -9, 9, 8, 0, c0);
  _pdBlob(g, [[-7, -3], [-9, -16], [-3, -28], [7, -28], [10, -15], [8, -3]], c0, 1.6);
  if (!g.sil) _pdEll(g, 3, -15, 4.6, 7.5, 0, c1, 0);
  _pdPart(g, 'armF', 2, -15, function () { _pdLeg(g, 2, -15, 2, 4.2, _pdTone(c0, 0.92), null); _pdEll(g, 2, -1.8, 3, 2, 0, dark, 1.1); });
  _pdPart(g, 'armN', 7.5, -15, function () { _pdLeg(g, 7.5, -15, 8, 4.2, c0, null); _pdEll(g, 8, -1.8, 3, 2, 0, dark, 1.1); });
  _pdTube(g, [[-3, -27.5], [4, -25.5], [10, -27.5]], 3, '#d23a2c', 1.1);
  _pdEll(g, 4, -23.5, 2.8, 2.8, 0, '#ffc94a', 1.1);
  if (!g.sil) _pdLine(g, [[2.5, -22.6], [5.5, -22.6]], _PD_INK, 0.8);
  _pdPart(g, 'head', 4, -29, function () {
    _pdPart(g, 'ear', -3, -48, function () {
      _pdPoly(g, [[-6, -45], [-6, -56], [2, -50]], c0, 1.5);
      if (!g.sil) _pdPoly(g, [[-6, -55.5], [-6, -51], [-3, -52.5]], dark, 0);
    });
    _pdPart(g, 'ear2', 12, -48, function () {
      _pdPoly(g, [[9, -50], [15, -57], [16, -45]], c0, 1.5);
      if (!g.sil) _pdPoly(g, [[15, -56.5], [13, -52.5], [15.5, -51]], dark, 0);
    });
    _pdBodyE(g, 5, -40, 12.5, 11, 0, head);
    var fd = g.fdx || 0;
    if (!g.sil) {
      _pdEll(g, 0.6 + fd, -40.5, 4.6, 4.2, -0.3, dark, 0);
      _pdEll(g, 9.6 + fd, -40.5, 4.2, 4, 0.3, dark, 0);
    }
    _pdEll(g, 13 + fd, -35.5, 5, 3.4, 0, head, 1.2);
    if (!g.sil) _pdEll(g, 17.6 + fd, -36.6, 1.6, 1.2, 0, _PD_INK, 0);
    _pdFaceV(g, { x: 5, y: -41, sp: 4.4, er: 2.3, far: 0.92, mx: 13, my: -32.6, mouth: 'smile', mk: 1.4, ring: true, brow: true, cx: 6 });
  });
}
// ---- 金:白澤(雲朵白獸,金色小角、山羊鬍、額上第三眼、藍雲紋、背竹簡)----
function _pdBBaize(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = L.c[2], horn = '#f0cf6a', far = _pdTone(c0, 0.86), hoof = '#9ec2e2';
  _pdPart(g, 'tail', -18, -27, function () { _pdUnion(g, [[-19, -29, 4.5, 4.5], [-24, -34, 4.5, 4.5], [-22, -41, 4, 4]], c0); });
  _pdPart(g, 'legF', 0, 0, function () { _pdLeg(g, -9, -18, -9, 5, far, _pdTone(hoof, 0.85)); });
  _pdPart(g, 'armF', 6, -18, function () { _pdLeg(g, 6, -18, 6, 5, far, _pdTone(hoof, 0.85)); });
  _pdPart(g, 'legN', 0, 0, function () { _pdLeg(g, -14, -18, -14, 5.2, c0, hoof); });
  _pdPart(g, 'armN', 10, -18, function () { _pdLeg(g, 10, -18, 10, 5.2, c0, hoof); });
  _pdUnion(g, [[-12, -25, 9, 8], [-2, -28, 10, 9], [7, -25, 8, 8], [-3, -20, 13, 7]], c0);
  if (!g.sil) {
    _pdEll(g, -3, -16, 11, 3, 0, '#dfe6f0', 0);
    _pdHi(g, -9, -30, 4, 2);
    _pdArc(g, -10, -24, 3, 0, Math.PI * 1.6, c2, 1.4);
    _pdArc(g, -10, -24, 1.2, Math.PI, Math.PI * 2.6, c2, 1.2);
    _pdLine(g, [[-7, -21], [0, -21], [3, -24]], c2, 1.4);
    _pdArc(g, 4, -24, 2.4, Math.PI, Math.PI * 2.5, c2, 1.3);
    _pdPoly(g, [[-13, -36], [1, -40], [2.5, -35], [-11.5, -31]], '#f4ead2', 1.1);
    _pdLine(g, [[-8.5, -37.5], [-7, -32.5]], '#a8692f', 0.8);
    _pdLine(g, [[-4, -38.8], [-2.6, -33.8]], '#a8692f', 0.8);
    _pdLine(g, [[-6, -38.4], [-4.6, -33.2]], '#d23a2c', 1.4);
  }
  _pdPart(g, 'head', 6, -30, function () {
    _pdUnion(g, [[2, -46, 5, 5], [0.5, -38, 5, 5], [3, -31, 4.5, 4.5], [6, -51, 4.5, 4.5]], far);
    _pdTube(g, [[8, -48], [5, -55], [0, -57]], 3, horn);
    _pdTube(g, [[13, -49], [11, -57], [6, -61]], 3, horn);
    _pdPart(g, 'ear', 6, -41, function () { _pdEll(g, 4, -42, 5.5, 2.6, 0.5, far, 1.3); });
    _pdBodyE(g, 12, -40, 11, 10, 0, c0);
    var fd = g.fdx || 0;
    _pdEll(g, 19 + fd * 0.5, -36, 5.5, 4, 0, c1, 1.1);
    _pdPoly(g, [[13 + fd * 0.5, -31.5], [19 + fd * 0.5, -31.5], [16 + fd * 0.5, -23]], '#ffffff', 1.2);
    if (!g.sil) {
      _pdEll(g, 23.5 + fd * 0.5, -37, 1.5, 1.1, 0, _PD_INK, 0);
      _pdEll(g, 14 + fd, -46.8, 1.5, 2.6, 0, '#ffffff', 0.9);
      _pdEll(g, 14 + fd, -46.6, 0.9, 1.6, 0, c2, 0);
    }
    _pdFaceV(g, { x: 14, y: -40.5, sp: 3.8, er: 2.4, far: 0.85, mx: 19.5, my: -33.2, mouth: 'smile', mk: 1.4, cx: 4.6 });
  });
}
// ---- 水:旋龜(綠殼小龜,鳥頭橘喙紅冠、紅色蛇尾,叫「卡!」)----
function _pdBXuangui(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = L.c[2], hx = [], i, a;
  _pdPart(g, 'tail', -16, -9, function () {
    var tp = _pdTP(g, [[-16, -9], [-27, -6], [-34, -14], [-30, -24]]), e = tp[3], hx2 = e[0] - 30, hy2 = e[1] + 24;
    _pdTube(g, tp, 4, c2);
    if (!g.sil) { _pdLine(g, [[-25, -8.5], [-24, -4.5]], '#8a1e18', 1.2); }
    _pdEll(g, -28.5 + hx2, -27 + hy2, 4.6, 3.6, -0.6, c2, 1.4);
    if (!g.sil) { _pdDot(g, -27.5 + hx2, -28.5 + hy2, 1.1, _PD_EYE); _pdLine(g, [[-25.5 + hx2, -30.5 + hy2], [-23 + hx2, -33 + hy2], [-21.5 + hx2, -33 + hy2]], '#ff5a7a', 0.9); }
  });
  _pdPart(g, 'legF', 0, 0, function () { _pdEll(g, -13, -3.4, 4.6, 3.4, 0, _pdTone(c1, 0.85), 1.3); });
  _pdPart(g, 'armF', 10, -6, function () { _pdEll(g, 10, -3.4, 4.6, 3.4, 0, _pdTone(c1, 0.85), 1.3); });
  _pdPart(g, 'head', 12, -12, function () { _pdTube(g, [[12, -12], [19, -19], [22, -24]], 6, c1); });
  _pdBlob(g, [[-21, -7], [-18, -23], [-4, -32], [12, -26], [18, -7]], g.sil ? c0 : _pdTone(c0, 0.84), 1.6);
  if (!g.sil) {
    _pdBlob(g, [[-20, -9], [-17, -24], [-5, -32], [10, -27], [15, -10]], c0, 0);
    _pdHi(g, -10, -24, 5, 2.4);
    for (i = 0; i < 6; i++) { a = i * Math.PI / 3; hx.push([-2 + Math.cos(a) * 6.5, -17 + Math.sin(a) * 5.5]); }
    _pdPoly(g, hx, _pdTone(c0, 1.25), 1.0);
    [[-8.5, -17, -15, -16], [4.5, -17, 11, -16], [-5, -22, -9, -26.5], [1, -22, 4, -27], [-5, -12, -8, -8], [1, -12, 4, -8]].forEach(function (s) {
      _pdLine(g, [[s[0], s[1]], [s[2], s[3]]], _pdTone(c0, 0.7), 1.1);
    });
  }
  _pdEll(g, -1.5, -7.5, 20, 3.4, 0, _pdTone(c0, 0.78), 1.4);
  _pdPart(g, 'legN', 0, 0, function () { _pdEll(g, -8, -3.6, 4.6, 3.4, 0, c1, 1.3); });
  _pdPart(g, 'armN', 13, -6, function () { _pdEll(g, 15, -3.6, 4.6, 3.4, 0, c1, 1.3); });
  _pdPart(g, 'head', 12, -12, function () {
    _pdPart(g, 'ear', 24, -32, function () {
      _pdPoly(g, [[21, -32], [22, -38], [25, -33]], c2, 1.1);
      _pdPoly(g, [[24, -33], [27, -38.5], [28, -32.5]], c2, 1.1);
    });
    _pdBodyE(g, 26, -27, 7.5, 7, 0, c1);
    _pdPoly(g, [[31, -29.5], [37.5, -26.5], [32, -23.5]], '#ff9a20', 1.2);
    _pdFaceV(g, { x: 26.5, y: -28.5, sp: 2.8, er: 2.1, far: 0.8, mouth: 'none', cx: 3.6 });
  });
  if (!g.sil) _pdBubble(g, 10, -42, '卡!');
}
// ---- 水:夔(藍灰小牛,無角、獨腳彈跳、雷紋、頭上雷雲閃電)----
function _pdBKui(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = L.c[2], dark = _pdTone(c0, 0.72);
  if (!g.sil) {
    _pdPart(g, 'far', 0, 0, function () {
      _pdPoly(g, [[-22, -53], [-27, -45], [-23.5, -45], [-29, -35], [-19, -48], [-22.5, -48], [-18, -53]], c2, 1.1);
      _pdUnion(g, [[-27, -57, 5.5, 4.2], [-20, -60, 7, 5.5], [-13, -57, 5.5, 4.2], [-20, -55, 8, 3.5]], '#e4ecf6', 1.0);
    });
  }
  _pdPart(g, 'tail', -13, -22, function () {
    var tp = _pdTP(g, [[-13, -22], [-16, -24], [-19, -25]]);
    _pdTube(g, tp, 2, c0, 1.2);
    _pdEll(g, tp[2][0] - 1.5, tp[2][1] - 0.5, 2.6, 3, 0.4, dark, 1.2);
  });
  _pdPart(g, 'legN', 0, 0, function () {
    if (!g.sil) { _pdLine(g, [[-8, -4], [-12, -6]], dark, 1.2); _pdLine(g, [[10, -4], [14, -6]], dark, 1.2); }
    _pdTube(g, [[0, -16], [1, -6]], 10, c0);
    _pdEll(g, 1, -2.8, 6.4, 3, 0, '#3e4f60', 1.4);
  });
  _pdBodyE(g, 0, -24, 15, 12, 0, c0);
  if (!g.sil) {
    _pdEll(g, 0, -19.5, 9.5, 7, 0, c1, 0);
    _pdLine(g, [[-4, -17], [4, -17], [4, -22], [-2.5, -22], [-2.5, -19], [1.5, -19]], c2, 1.5);
  }
  _pdPart(g, 'head', 0, -31, function () {
    _pdPart(g, 'ear', -9, -42, function () {
      _pdEll(g, -15, -43, 6.5, 3, -0.25, c0, 1.4);
      if (!g.sil) _pdEll(g, -15.5, -43, 3.8, 1.5, -0.25, '#ffb8ae', 0);
    });
    _pdPart(g, 'ear2', 9, -42, function () {
      _pdEll(g, 15, -43, 6.5, 3, 0.25, c0, 1.4);
      if (!g.sil) _pdEll(g, 15.5, -43, 3.8, 1.5, 0.25, '#ffb8ae', 0);
    });
    _pdPoly(g, [[-4, -49], [-1, -55], [1, -50], [4, -54], [5, -49]], dark, 1.2);
    _pdBodyE(g, 0, -40, 13, 11.5, 0, c0);
    var fd = g.fdx || 0;
    _pdEll(g, fd, -33.5, 9, 5.6, 0, c1, 1.2);
    if (!g.sil) {
      _pdEll(g, -3.2 + fd, -34.5, 1, 1.4, 0, '#4a5a6a', 0);
      _pdEll(g, 3.2 + fd, -34.5, 1, 1.4, 0, '#4a5a6a', 0);
    }
    _pdFaceV(g, { x: 0, y: -42.5, sp: 5.6, er: 2.5, mx: 0, my: -30.4, mouth: 'smile', mk: 1.6, cx: 8.6 });
  });
}
// ---- 水:玄武(深藍龜,綠蛇盤殼兩圈、蛇頭從殼頂探出與龜頭對看)----
function _pdBXuanwu(g, L) {
  var c0 = L.c[0], c1 = L.c[1], c2 = L.c[2], skin = '#7fa6c4', hx = [], i, a, line = '#5a82a8';
  _pdPart(g, 'legF', 0, 0, function () { _pdEll(g, -14, -3.8, 5, 4.2, 0, _pdTone(skin, 0.82), 1.4); });
  _pdPart(g, 'armF', 9, -6, function () { _pdEll(g, 9, -3.8, 5, 4.2, 0, _pdTone(skin, 0.82), 1.4); });
  _pdPart(g, 'tail', -20, -7, function () { _pdPoly(g, [[-20, -9], [-27, -7], [-20, -4.5]], skin, 1.2); });
  _pdTube(g, [[-21, -13], [-25.5, -19], [-21, -25]], 4.6, _pdTone(c2, 0.78));
  _pdPart(g, 'head', 13, -12, function () { _pdTube(g, [[13, -12], [20, -17], [24, -21]], 6.5, skin); });
  _pdBlob(g, [[-23, -7], [-21, -26], [-6, -37], [11, -31], [18, -7]], g.sil ? c0 : _pdTone(c0, 0.84), 1.6);
  if (!g.sil) {
    _pdBlob(g, [[-22, -9], [-20, -27], [-7, -37], [9, -32], [15, -10]], c0, 0);
    _pdHi(g, -12, -27, 5, 2.4);
    for (i = 0; i < 6; i++) { a = i * Math.PI / 3; hx.push([-3 + Math.cos(a) * 6.5, -22 + Math.sin(a) * 5.5]); }
    _pdPoly(g, hx, _pdTone(c0, 1.3), 1.0);
    [[-9.5, -22, -18, -21], [3.5, -22, 12, -21], [-6, -27, -9, -32], [0, -27, 3, -32]].forEach(function (s) {
      _pdLine(g, [[s[0], s[1]], [s[2], s[3]]], line, 1.2);
    });
  }
  _pdEll(g, -2.5, -7.5, 21, 3.6, 0, c1, 1.4);
  _pdTube(g, [[-22.5, -12], [-12, -20], [2, -23], [13, -19], [18, -13]], 4, c2);
  _pdTube(g, [[-20.5, -25], [-12, -33], [0, -36.5], [9, -39], [13, -45], [13.5, -50]], 4, c2);
  if (!g.sil) {
    _pdTube(g, [[-15, -17], [-5, -22], [6, -22], [13, -18.5]], 1.2, '#c8f0a8', 0);
    _pdTube(g, [[-14, -31], [-4, -35.5], [6, -37.5], [11, -42], [12.6, -47]], 1.2, '#c8f0a8', 0);
  }
  _pdPart(g, 'legN', 0, 0, function () { _pdEll(g, -15, -3.4, 5, 4, 0, skin, 1.4); });
  _pdPart(g, 'armN', 11, -6, function () { _pdEll(g, 13, -3.4, 5, 4, 0, skin, 1.4); });
  _pdPart(g, 'tail', 13.5, -48, function () {
    _pdEll(g, 16.5, -52, 5.6, 4.4, 0.45, c2, 1.4);
    if (!g.sil) {
      _pdDot(g, 18.4, -53.6, 1.4, _PD_EYE); _pdDot(g, 18, -54.1, 0.5, '#ffffff');
      _pdLine(g, [[20.5, -49], [22, -46], [21, -44.5]], '#ff5a7a', 0.9);
      _pdLine(g, [[22, -46], [23.5, -45]], '#ff5a7a', 0.9);
    }
  });
  _pdPart(g, 'head', 13, -12, function () {
    _pdBodyE(g, 26, -25, 8.8, 8, 0, skin);
    _pdFaceV(g, { x: 26.8, y: -27.2, sp: 3.4, er: 2.5, far: 0.85, mx: 29.5, my: -20.6, mouth: 'smile', mk: 1.3, cx: 4.2 });
  });
}
// ---- 隱:鳳凰(紅金鳳,三根冠羽、五色長尾羽末端有眼紋、雙腳)----
function _pdBFenghuang(g, L) {
  var c0 = L.c[0], c1 = L.c[1], fc = ['#4caf50', '#f2603c', '#e3b23c', '#c9ced6', '#3e7fd6'], legC = '#f2a33a';
  var tails = [[-35, -4], [-38, -18], [-36, -33], [-29, -46], [-18, -56]];
  _pdPart(g, 'tail', -8, -26, function () {
    tails.forEach(function (e, i) {
      var b = [-8, -22 - i * 2], dx = e[0] - b[0], dy = e[1] - b[1], rot = Math.atan2(dy, dx);
      _pdFeather(g, b, e, 9, fc[i], 1.3);
      if (!g.sil) {
        _pdLine(g, [b, [b[0] + dx * 0.7, b[1] + dy * 0.7]], _pdTone(fc[i], 0.75), 0.9);
        _pdEll(g, b[0] + dx * 0.8, b[1] + dy * 0.8, 3.4, 2.7, rot, '#ffe07a', 0.8);
        _pdDot(g, b[0] + dx * 0.8, b[1] + dy * 0.8, 1.3, '#2a3a7a');
      }
    });
  });
  _pdPart(g, 'legN', 0, 0, function () {
    _pdTube(g, [[-3, -17], [-4, -1.5]], 2.2, legC, 1.2);
    _pdTube(g, [[3, -17], [4, -1.5]], 2.2, legC, 1.2);
    _pdTube(g, [[-7.5, -0.6], [-4, -1.6], [-0.5, -0.6]], 1.6, legC, 1.0);
    _pdTube(g, [[0.5, -0.6], [4, -1.6], [7.5, -0.6]], 1.6, legC, 1.0);
  });
  _pdPart(g, 'far', 0, 0, function () {
    _pdPart(g, 'wing', 0, -33, function () { _pdBlob(g, [[-4, -32], [-12, -49], [-1, -43], [4, -34]], _pdTone(c0, 0.8), 1.2); });
  });
  _pdBodyE(g, -1, -26, 13, 11, -0.15, c0);
  if (!g.sil) _pdEll(g, 6, -25, 6, 7.5, 0, c1, 0);
  _pdPart(g, 'wing', -2, -27, function () {
    _pdBlob(g, [[-12, -26], [-17, -38], [-11, -36], [-10, -44], [-4, -37], [-1, -42], [2, -31], [-2, -21]], '#ff7a3a', 1.3);
    if (!g.sil) _pdLine(g, [[-12, -32], [-6, -33], [-1, -31]], c1, 1.3);
  });
  _pdPart(g, 'head', 4, -31, function () {
    _pdTube(g, [[4, -31], [5, -42], [10, -48]], 6, c0);
    _pdPart(g, 'ear', 10, -57, function () {
      [[[8, -57], [4, -63], [-0.5, -64]], [[10, -58], [9.5, -65], [6.5, -68]], [[12, -57], [14.5, -63], [13.5, -67]]].forEach(function (p) {
        _pdTube(g, p, 1.6, c1, 0.9);
        _pdEll(g, p[2][0], p[2][1], 2.2, 2.2, 0, '#ff9a2e', 1.0);
      });
    });
    _pdBodyE(g, 11, -51, 7.5, 7, 0, c0);
    _pdPoly(g, [[17, -53], [23.5, -50.5], [17, -48]], c1, 1.2);
    _pdFaceV(g, { x: 12, y: -52, sp: 2.8, er: 2.1, far: 0.8, mouth: 'none', cx: 3.4 });
  });
}
var _PD_BODY = {
  xingxing: _pdBXingxing, lushu: _pdBLushu, jiuwei: _pdBJiuwei, huoshu: _pdBHuoshu, bifang: _pdBBifang, huoqilin: _pdBHuoqilin,
  dangkang: _pdBDangkang, pixiu: _pdBPixiu, huanglong: _pdBHuanglong, jiao: _pdBJiao, tiangou: _pdBTiangou, baize: _pdBBaize,
  xuangui: _pdBXuangui, kui: _pdBKui, xuanwu: _pdBXuanwu, fenghuang: _pdBFenghuang
};
// 稀有度裝飾(畫在身體後方,不隨扭動):神 = 腳下祥雲;隱 = 再加放射光芒
function _pdRareBack(g, tier, col) {
  var c = g.ctx, i, a, light = _pdMix(col, '#ffffff', 0.45);
  if (tier >= 3) {
    var rc = ['#f2603c', '#e3b23c', '#4caf50', '#3e7fd6', '#c08ae8', '#ff8ab0'];
    c.save(); c.globalAlpha = 0.28;
    for (i = 0; i < 12; i++) {
      a = i * Math.PI / 6 + 0.13 + (g.t || 0) * 0.2;
      _pdPoly(g, [[0, -32], [Math.cos(a - 0.1) * 48, -32 + Math.sin(a - 0.1) * 48], [Math.cos(a + 0.1) * 48, -32 + Math.sin(a + 0.1) * 48]], rc[i % 6], 0);
    }
    c.restore();
  }
  [-23, 21].forEach(function (x) {
    _pdUnion(g, [[x - 5, -2.6, 4.6, 3], [x + 0.5, -4.2, 5.4, 4.2], [x + 6, -2.6, 4.4, 2.9]], '#ffffff', 1.0);
    _pdLine(g, [[x - 3, -2.2], [x + 4, -2.2]], light, 1.1);
  });
}
// 稀有度裝飾(畫在身體前方):瑞以上有閃光(動畫時忽大忽小)
function _pdRareFront(g, tier) {
  var sp = [[-31, -50, 3.4], [31, -22, 2.6], [-35, -12, 2.4], [29, -62, 3]];
  for (var i = 0; i < Math.min(sp.length, tier + 1) && tier >= 1; i++) {
    var k = g.A ? 0.65 + 0.35 * Math.abs(Math.sin((g.t || 0) * 2.2 + i * 1.7)) : 1;
    _pdSpark(g, sp[i][0], sp[i][1], sp[i][2] * k, '#ffd84a');
  }
}

// 對話泡泡(寬度隨字數)
function _pdSay(g, x, y, txt) {
  var w = Math.max(12, String(txt).length * 4.6 + 5);
  _pdPoly(g, [[x - 6, y + 6], [x - 10, y + 13], [x - 1, y + 7]], '#ffffff', 1.0);
  _pdEll(g, x, y, w, 8.5, 0, '#ffffff', 1.0);
  _pdTxt(g, txt, x, y, 'bold 8px "Microsoft JhengHei", sans-serif', _PD_INK);
}
// 舊介面 opt.t + opt.state 對應到動作名
var _PD_STATE_ACT = { idle: 'idle', happy: 'cheer', hop: 'happy-hop', sad: 'sad', turn: 'turn' };

// 仙獸主函式。opt = { silhouette, blink, hop(數值或 true = 10px), face: 'normal'|'happy'|'smug'|'sad'|'closed', breath(y 向縮放倍率),
//   anim: { name: 'idle'|'greet'|'punch'|'nod'|'bow'|'happy-hop'|'cheer'|'sad'|'sleep'|'tap-react'|'turn', t(動作開始後秒數), loop },
//   t + state(簡寫:t 秒、state idle|happy|hop|sad|turn,皆循環), dir(1 面右 / -1 面左), say(對話泡泡文字) }
// 未給 anim / t 時為靜止姿勢(圖鑑縮圖用),與舊版相同的繪製結果。
function pdPet(ctx, id, x, y, s, opt) {
  ctx = _pdSafe(ctx);
  if (!ctx) return;
  opt = opt || {};
  var pet = _pdPetOf(id);
  var look = pet ? pet.look : { tpl: 'quad', c: ['#9aa0a8', '#c8ccd2', '#ffffff'], tail: 'round', ear: null, pat: null, glow: false, extra: [] };
  var sil = !!opt.silhouette || !pet;
  var body = pet ? _PD_BODY[pet.id] : null;
  var an = opt.anim, A = null, t = 0;
  if (body && an && typeof an.t === 'number' && isFinite(an.t)) {
    t = an.t; A = _pdPoseOf(id, an.name || 'idle', t, !!an.loop);
  } else if (body && typeof opt.t === 'number' && isFinite(opt.t)) {
    t = opt.t; A = _pdPoseOf(id, _PD_STATE_ACT[opt.state] || 'idle', t, true);
  }
  var face = opt.face || (A && A.face) || 'normal';
  var g = { ctx: ctx, sil: sil, ink: sil ? _PD_SIL : _PD_INK, face: face, blink: !!opt.blink || !!(A && A.blink && face === 'normal'), A: A, t: t, fdx: 0 };
  var tpl = _PD_TPL[look.tpl] || _PD_TPL.quad;
  var H = { x: tpl.head.x, y: tpl.head.y, r: tpl.head.r };
  var el = pet ? pet.el : null;
  var tier = pet ? ({ ling: 0, rui: 1, shen: 2, yin: 3 }[pet.rare] || 0) : 0;
  var lift = (opt.hop ? (opt.hop === true ? 10 : opt.hop) : 0) + (A ? A.y : 0);
  var dir = (opt.dir === -1 ? -1 : 1) * (A ? A.dir : 1);
  g.iris = tier >= 2 ? (_PD_IRIS[el] || '#ff7a1a') : null;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (!sil) {
    // 接地陰影:跟著重心偏移、隨擠壓變寬、跳起時縮小變淡
    var shR = (body ? 22 : 19) * Math.max(0.45, 1 - lift * 0.03) * (A ? A.sx * (1 + Math.abs(A.root) * 0.8) : 1);
    _pdEll(g, A ? (A.x + A.root * 14) * dir : 0, 0, shR, shR * 0.26, 0, 'rgba(60,40,20,' + (lift > 0 ? Math.max(0.1, 0.22 - lift * 0.006).toFixed(3) : '0.22') + ')', 0);
  }
  ctx.translate(0, -lift);
  if (opt.breath) ctx.scale(1, opt.breath);
  if (dir !== 1) ctx.scale(dir, 1);
  g.mirror = dir < 0;
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
  if (body) {
    if (!sil && tier >= 2) _pdRareBack(g, tier, PET_EL[el] ? PET_EL[el].color : '#ff8ab0');
    if (A) {
      // root:重心平移 → 擠壓伸展(以腳底為基準)→ 繞腳底傾斜 → hip:繞髖前傾
      ctx.save();
      ctx.translate(A.x, 0);
      ctx.scale(A.sx, A.sy);
      ctx.rotate(A.root);
      ctx.translate(0, -A.hip); ctx.rotate(A.lean); ctx.translate(0, A.hip);
    }
    body(g, look);
    if (A) ctx.restore();
    if (!sil) {
      _pdRareFront(g, tier);
      if (A && A.zz) {
        var zk = (t * 0.8) % 1;
        _pdTxt(g, 'z', 18 + zk * 6, -50 - zk * 10, 'bold 8px sans-serif', 'rgba(59,35,20,' + (1 - zk).toFixed(2) + ')');
        _pdTxt(g, 'Z', 26 + zk * 4, -60 - zk * 8, 'bold 11px sans-serif', 'rgba(59,35,20,' + (0.8 - zk * 0.6).toFixed(2) + ')');
      }
    }
  } else {
    tpl.draw(g, look, H);
  }
  if (opt.say && !sil) {
    if (dir !== 1) { ctx.scale(1 / dir, 1); g.mirror = false; }
    _pdSay(g, 14, -66, opt.say);
  }
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
