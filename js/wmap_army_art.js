// js/wmap_army_art.js — M1 W4 軍隊模型的程式繪圖(設計_軍隊模型與旗幟_規格.md 1.2、1.3、2.1~2.3、3.2、3.4;設計_M1視覺原型_實作計畫.md 5.1)。
// 正式 GPT 圖到之前的替代:載入後第一次用到時畫進離屏 canvas 並快取,之後只 drawImage。圖到了只換本檔的三個登錄函式(wmapArmyArtSheet / wmapArmyArtFlag / wmapArmyArtBadge),wmap_army.js 不動。
// 風格:Q 版卡通、深褐 #4A2A14 粗描邊、平塗 + 一階陰影、光源左上;士兵兵種中性(皮甲、頭巾盔、長槍),旗手高杆大旗。
// ES2017,不用 ?. ??;UTF-8 + CRLF;無 DOM 時(node 測試)所有函式回 null,不報錯。全域名一律 wmapArmyArt* / WMAP_ARMY_ART_*。
// 公開:
//   WMAP_ARMY_ART_ARMY            常數 { F:192(每幀邊長), ax:0.5, ay:0.86(錨點), flagW:66, flagH:48 }
//   wmapArmyArtSheet() → { canvas, F, poleTop:[dir][fr]→{x,y} }   本體 sheet:5 欄(走 0~3、站 4)× 2 列(0 前斜 ↘、1 後斜 ↗),已含共同影子、4 步卒 + 旗手(含旗杆,旗布不含)
//   wmapArmyArtFlag(side, tag, mir, rolled, wave) → { canvas, hx, hy }   旗布(已著色、隊號 / 席位色帶 / 公會字);hx,hy = 旗布圖中旗杆掛點;side 'own'|'ally'|'foe'|'raid'
//   wmapArmyArtBadge(kind) → canvas   'fight' 交叉刀 | 'wait' 沙漏 | 'bag' 戰利袋
//   wmapArmyArtSeatColor(n) → '#rrggbb'   席位色(避開土黃 / 草綠,規格 3.3)
var WMAP_ARMY_ART_ARMY = { F: 192, ax: 0.5, ay: 0.86, flagW: 66, flagH: 48, poleLen: 128 };
var WMAP_ARMY_ART_COL = {
  line: '#4A2A14', own: '#D8432E', ownEdge: '#E8B923', ally: '#2F8FC7', foe: '#2B2B33', cream: '#F4EBD0', gold: '#E8B923'
};
var wmapArmyArtCache = { sheet: null, flags: {}, badges: {} };

function wmapArmyArtCanvas(w, h) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function wmapArmyArtSeatColor(n) {
  n = Math.abs(n | 0);
  var h = (110 + (n * 137) % 250) % 360, l = 50 + ((n * 7) % 3) * 6;
  return 'hsl(' + h + ',72%,' + l + '%)';
}

// ───────── 單兵 / 旗手 ─────────
// (x, y) = 腳底中心;f = 走 0~3 / 站 4;dir 0 前斜 1 後斜;bearer = 旗手;回傳旗杆頂座標(旗手才有)
function wmapArmyArtFigure(g, x, y, f, dir, bearer, lean) {
  var C = WMAP_ARMY_ART_COL, back = dir === 1, walking = f < 4;
  var bob = (f === 1 || f === 3) ? -3 : 0;
  var sw = f === 0 ? 1 : (f === 2 ? -1 : 0);         // 左腳向前(1)/ 右腳向前(-1)
  var fwd = back ? -1 : 1;                          // 往畫面下方 = 前斜的「前」
  var lFy = y + (walking ? sw * 5 * fwd : 0) - (f === 1 ? 3 : 0), rFy = y - (walking ? sw * 5 * fwd : 0) - (f === 3 ? 3 : 0);
  var lFx = x - 7 - (walking ? sw * 1 : 0), rFx = x + 7 + (walking ? sw * 1 : 0);
  var hipY = y - 20 + bob;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // 腿(先描邊再填色)
  var legs = [[x - 5, lFx, lFy], [x + 5, rFx, rFy]], i;
  for (i = 0; i < 2; i++) { g.strokeStyle = C.line; g.lineWidth = 10; g.beginPath(); g.moveTo(legs[i][0], hipY); g.lineTo(legs[i][1], legs[i][2] - 3); g.stroke(); }
  for (i = 0; i < 2; i++) { g.strokeStyle = '#8a5f38'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(legs[i][0], hipY); g.lineTo(legs[i][1], legs[i][2] - 3); g.stroke(); }
  for (i = 0; i < 2; i++) {   // 鞋
    g.fillStyle = '#3a2414'; g.strokeStyle = C.line; g.lineWidth = 3;
    g.beginPath(); g.ellipse(legs[i][1] + (back ? 0 : 1), legs[i][2] - 2, 7.5, 4.5, 0, 0, 6.2832); g.fill(); g.stroke();
  }
  // 旗杆 / 長槍(在身體後面那一側先畫杆身)
  var px = x + 15, tipY = 0;
  if (bearer) {
    var top = y - WMAP_ARMY_ART_ARMY.poleLen + bob;
    g.strokeStyle = C.line; g.lineWidth = 8; g.beginPath(); g.moveTo(px, y - 4 + bob); g.lineTo(px, top); g.stroke();
    g.strokeStyle = '#a56a30'; g.lineWidth = 4; g.beginPath(); g.moveTo(px - 0.6, y - 4 + bob); g.lineTo(px - 0.6, top); g.stroke();
    g.strokeStyle = '#c98a4a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px - 1.8, y - 8 + bob); g.lineTo(px - 1.8, top + 6); g.stroke();
    g.fillStyle = C.gold; g.strokeStyle = C.line; g.lineWidth = 3;   // 杆頂金矛頭
    g.beginPath(); g.moveTo(px, top - 15); g.lineTo(px + 5.5, top - 2); g.lineTo(px, top + 2); g.lineTo(px - 5.5, top - 2); g.closePath(); g.fill(); g.stroke();
    tipY = top;
  } else {
    var tx = x + 22 + (lean || 0) + sw * 1.5, ty = y - 70 + bob;
    g.strokeStyle = C.line; g.lineWidth = 7; g.beginPath(); g.moveTo(x + 11, y - 12 + bob); g.lineTo(tx, ty); g.stroke();
    g.strokeStyle = '#a56a30'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x + 11, y - 12 + bob); g.lineTo(tx, ty); g.stroke();
    g.fillStyle = '#dfe3ea'; g.strokeStyle = C.line; g.lineWidth = 2.6;   // 槍尖
    g.beginPath(); g.moveTo(tx + 1.5, ty - 13); g.lineTo(tx + 5.5, ty + 1); g.lineTo(tx - 3, ty + 1); g.closePath(); g.fill(); g.stroke();
  }
  // 軀幹
  var by = y - 33 + bob, gr = g.createLinearGradient(x - 14, by - 16, x + 14, by + 16);
  gr.addColorStop(0, back ? '#b78a50' : '#d0a063'); gr.addColorStop(1, back ? '#8e6638' : '#a77742');
  g.fillStyle = gr; g.strokeStyle = C.line; g.lineWidth = 4;
  g.beginPath(); g.moveTo(x - 12, by - 14); g.quadraticCurveTo(x, by - 19, x + 12, by - 14); g.lineTo(x + 14, by + 12); g.quadraticCurveTo(x, by + 17, x - 14, by + 12); g.closePath(); g.fill(); g.stroke();
  if (!back) {   // 皮甲:斜肩帶 + 護心片
    g.strokeStyle = '#6a4220'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x - 9, by - 13); g.lineTo(x + 9, by + 10); g.stroke();
    g.fillStyle = '#e4bd82'; g.strokeStyle = C.line; g.lineWidth = 2.2;
    g.beginPath(); g.arc(x + 1, by - 2, 4.2, 0, 6.2832); g.fill(); g.stroke();
  } else {
    g.strokeStyle = '#6a4220'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 9, by - 13); g.lineTo(x + 9, by + 10); g.stroke();
  }
  g.strokeStyle = C.line; g.lineWidth = 3.6; g.beginPath(); g.moveTo(x - 13, by + 8); g.quadraticCurveTo(x, by + 12, x + 13, by + 8); g.stroke();   // 腰帶
  // 手臂與手
  var hx2 = bearer ? px : x + 14, hy2 = bearer ? by - 4 : by - 3;
  g.strokeStyle = C.line; g.lineWidth = 9; g.beginPath(); g.moveTo(x + 10, by - 10); g.lineTo(hx2, hy2); g.moveTo(x - 10, by - 10); g.lineTo(bearer ? px - 1 : x - 15, bearer ? by - 9 : by + 6); g.stroke();
  g.strokeStyle = '#c99a5c'; g.lineWidth = 4.2; g.beginPath(); g.moveTo(x + 10, by - 10); g.lineTo(hx2, hy2); g.moveTo(x - 10, by - 10); g.lineTo(bearer ? px - 1 : x - 15, bearer ? by - 9 : by + 6); g.stroke();
  g.fillStyle = '#f2c79a'; g.strokeStyle = C.line; g.lineWidth = 2.4;
  g.beginPath(); g.arc(hx2, hy2, 4.4, 0, 6.2832); g.fill(); g.stroke();
  g.beginPath(); g.arc(bearer ? px - 1 : x - 15, bearer ? by - 9 : by + 6, 4.4, 0, 6.2832); g.fill(); g.stroke();
  // 頭
  var hy = y - 58 + bob;
  g.fillStyle = back ? '#3b2a22' : '#f4cc9c'; g.strokeStyle = C.line; g.lineWidth = 4;
  g.beginPath(); g.arc(x, hy, 14, 0, 6.2832); g.fill(); g.stroke();
  if (!back) {
    g.fillStyle = '#2a1a10';
    g.beginPath(); g.ellipse(x - 5, hy + 2, 2.1, 2.8, 0, 0, 6.2832); g.fill(); g.beginPath(); g.ellipse(x + 5, hy + 2, 2.1, 2.8, 0, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(232,110,90,.55)'; g.beginPath(); g.ellipse(x - 9, hy + 6, 3, 2, 0, 0, 6.2832); g.fill(); g.beginPath(); g.ellipse(x + 9, hy + 6, 3, 2, 0, 0, 6.2832); g.fill();
    g.strokeStyle = '#7a3a20'; g.lineWidth = 1.8; g.beginPath(); g.arc(x, hy + 6, 3, 0.2, 2.94); g.stroke();
  }
  // 頭巾盔
  var cap = g.createLinearGradient(x - 14, hy - 16, x + 14, hy);
  cap.addColorStop(0, '#a3a9b4'); cap.addColorStop(1, '#6f7683');
  g.fillStyle = cap; g.strokeStyle = C.line; g.lineWidth = 4;
  g.beginPath(); g.arc(x, hy - 1, 14.5, Math.PI * (back ? 0.92 : 1.02), Math.PI * (back ? 0.08 : -0.02) + 2 * Math.PI * 0, false);
  if (back) { g.closePath(); } else { g.lineTo(x + 14, hy - 1); g.closePath(); }
  g.fill(); g.stroke();
  g.fillStyle = '#4a4f5a'; g.strokeStyle = C.line; g.lineWidth = 2.6;   // 盔緣布帶
  g.beginPath(); g.moveTo(x - 14.4, hy - 3); g.quadraticCurveTo(x, hy + (back ? 4 : 0), x + 14.4, hy - 3); g.lineTo(x + 14.4, hy - 8); g.quadraticCurveTo(x, hy - 5 + (back ? 4 : 0), x - 14.4, hy - 8); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = C.gold; g.strokeStyle = C.line; g.lineWidth = 2; g.beginPath(); g.arc(x, hy - 16, 3.4, 0, 6.2832); g.fill(); g.stroke();   // 盔頂小珠
  if (back) {   // 後腦布帶尾
    g.strokeStyle = C.line; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 2, hy - 2); g.quadraticCurveTo(x - 6, hy + 10, x - 11, hy + 12); g.stroke();
    g.strokeStyle = '#8a8f9a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 2, hy - 2); g.quadraticCurveTo(x - 6, hy + 10, x - 11, hy + 12); g.stroke();
  }
  return bearer ? { x: px, y: tipY - 15 } : null;
}

// 站位(腳底相對錨點;依 y 由小到大畫):[x, y, 相位, 旗手?]
var WMAP_ARMY_ART_SLOTS = [
  [[-48, -14, 0, 0, -8], [-16, -30, 2, 0, 2], [-34, 8, 1, 0, -4], [2, -6, 3, 0, 6], [30, 14, 1, 1, 0]],     // 前斜:旗手在前排右側
  [[-44, 6, 0, 0, -8], [-14, 10, 2, 0, 4], [-30, -10, 1, 0, -2], [0, -12, 3, 0, 8], [24, -30, 1, 1, 0]]     // 後斜:旗手領在前(畫面上方)
];

function wmapArmyArtSheet() {
  if (wmapArmyArtCache.sheet) return wmapArmyArtCache.sheet;
  var F = WMAP_ARMY_ART_ARMY.F, cv = wmapArmyArtCanvas(F * 5, F * 2);
  if (!cv) return null;
  var g = cv.getContext('2d'), poleTop = [[], []], d, f, k, ax = F * WMAP_ARMY_ART_ARMY.ax, ay = F * WMAP_ARMY_ART_ARMY.ay;
  for (d = 0; d < 2; d++) for (f = 0; f < 5; f++) {
    var ox = f * F, oy = d * F;
    g.save(); g.beginPath(); g.rect(ox, oy, F, F); g.clip();
    g.fillStyle = 'rgba(58,36,20,.26)'; g.beginPath(); g.ellipse(ox + ax + 5, oy + ay + 2, F * 0.31, F * 0.095, 0, 0, 6.2832); g.fill();   // 共同影子(不隨步伐動)
    var slots = WMAP_ARMY_ART_SLOTS[d].slice().sort(function (a, b) { return a[1] - b[1]; });
    for (k = 0; k < slots.length; k++) {
      var s = slots[k], fr = f === 4 ? 4 : (f + s[2]) % 4;
      var tp = wmapArmyArtFigure(g, ox + ax + s[0], oy + ay + s[1], fr, d, !!s[3], s[4]);
      if (tp) poleTop[d][f] = { x: tp.x - ox, y: tp.y - oy };
    }
    g.restore();
  }
  wmapArmyArtCache.sheet = { canvas: cv, F: F, poleTop: poleTop };
  return wmapArmyArtCache.sheet;
}

// ───────── 旗布 ─────────
// side → 旗形:own 燕尾、ally 方、foe / raid 三角牙旗
function wmapArmyArtFlagPath(g, shape, w, h, wv) {
  g.beginPath();
  g.moveTo(0, 0);
  if (shape === 'swallow') {
    g.quadraticCurveTo(w * 0.5, -5 + wv, w, wv); g.lineTo(w - 17, h * 0.5 + wv); g.lineTo(w, h + wv);
    g.quadraticCurveTo(w * 0.5, h - 5 - wv * 0.6, 0, h);
  } else if (shape === 'square') {
    g.quadraticCurveTo(w * 0.5, -5 + wv, w, wv); g.lineTo(w, h + wv);
    g.quadraticCurveTo(w * 0.5, h - 5 - wv * 0.6, 0, h);
  } else {   // 三角牙旗:右指三角,下緣鋸齒
    g.quadraticCurveTo(w * 0.5, -3 + wv, w, h * 0.5 + wv);
    var n = 4, i, t, bx, by;
    for (i = 1; i <= n * 2; i++) {   // 由尖端沿下緣回到 (0, h),奇偶交替內縮成牙
      t = i / (n * 2); bx = w * (1 - t); by = h * 0.5 + wv * (1 - t) + (h * 0.5 - wv * (1 - t)) * t;
      if (i < n * 2 && (i & 1)) { bx -= 3; by -= 7; } else if (i < n * 2) { bx += 2; by += 2; }
      g.lineTo(bx, by);
    }
  }
  g.closePath();
}
function wmapArmyArtFlag(side, tag, mir, rolled, wave) {
  var key = side + '|' + tag + '|' + (mir ? 1 : 0) + '|' + (rolled ? 1 : 0) + '|' + (wave ? 1 : 0), hit = wmapArmyArtCache.flags[key];
  if (hit !== undefined) return hit;
  var C = WMAP_ARMY_ART_COL, A = WMAP_ARMY_ART_ARMY, w = A.flagW, h = A.flagH, pad = 8, cw = w + pad * 2 + 6, ch = h + pad * 2 + 10;
  var cv = wmapArmyArtCanvas(cw, ch);
  if (!cv) { wmapArmyArtCache.flags[key] = null; return null; }
  var g = cv.getContext('2d'), isOwn = side === 'own', isAlly = side === 'ally';
  var shape = isOwn ? 'swallow' : (isAlly ? 'square' : 'tri');
  var fill = isOwn ? C.own : (isAlly ? C.ally : C.foe), edge = isOwn ? C.ownEdge : C.cream;
  var hs = rolled ? 0.5 : 1, wv = rolled ? 0 : (wave ? 5 : -2), hx = mir ? cw - pad : pad, hy = pad + 4;
  g.save(); g.translate(hx, hy); if (mir) g.scale(-1, 1); g.scale(rolled ? 0.82 : 1, hs);
  wmapArmyArtFlagPath(g, shape, w, h, wv);
  g.fillStyle = fill; g.fill();
  g.save(); g.clip();
  var sh = g.createLinearGradient(0, 0, 0, h);   // 一階陰影:下緣變暗、上緣略亮
  sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = sh; g.fillRect(-4, -12, w + 8, h + 24);
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(w * 0.34, 2); g.quadraticCurveTo(w * 0.40, h * 0.5 + wv * 0.4, w * 0.32, h); g.stroke();   // 摺痕
  if (!isOwn && !isAlly) {   // 敵旗:席位色橫帶(下緣)
    g.fillStyle = (typeof tag === 'number') ? wmapArmyArtSeatColor(tag) : (tag || '#c9a227');
    g.fillRect(-4, h * 0.56, w + 8, h * 0.2); g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(-4, h * 0.56, w + 8, h * 0.2);
  }
  g.strokeStyle = edge; g.lineWidth = 9; wmapArmyArtFlagPath(g, shape, w, h, wv); g.stroke();   // 內緣色邊(clip 後只剩內側一半)
  g.restore();
  wmapArmyArtFlagPath(g, shape, w, h, wv); g.strokeStyle = C.line; g.lineWidth = 4; g.lineJoin = 'round'; g.stroke();
  g.restore();
  // 旗面文字(不鏡像;捲旗不畫)
  if (!rolled) {
    var cx = mir ? hx - w * 0.5 : hx + w * 0.5, cy = hy + h * 0.5 + (wave ? 1 : -1);
    if (isOwn && tag) {
      g.fillStyle = C.gold; g.strokeStyle = C.line; g.lineWidth = 3; g.beginPath(); g.arc(cx - (mir ? -3 : 3), cy, 13, 0, 6.2832); g.fill(); g.stroke();
      g.fillStyle = C.line; g.font = 'bold 19px "Noto Serif TC","Microsoft JhengHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(tag), cx - (mir ? -3 : 3), cy + 1);
    } else if (isAlly && tag && typeof tag === 'string') {
      g.fillStyle = C.cream; g.strokeStyle = C.line; g.lineWidth = 3; g.font = 'bold 22px "Noto Serif TC","Microsoft JhengHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.strokeText(tag.charAt(0), cx, cy + 1); g.fillText(tag.charAt(0), cx, cy + 1);
    }
  }
  var o = { canvas: cv, hx: hx, hy: hy };
  wmapArmyArtCache.flags[key] = o;
  return o;
}

// ───────── 徽章 ─────────
function wmapArmyArtBadge(kind) {
  if (wmapArmyArtCache.badges[kind] !== undefined) return wmapArmyArtCache.badges[kind];
  var C = WMAP_ARMY_ART_COL, cv = wmapArmyArtCanvas(56, 56);
  if (!cv) { wmapArmyArtCache.badges[kind] = null; return null; }
  var g = cv.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'bag') {
    g.fillStyle = '#c9a063'; g.strokeStyle = C.line; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(20, 18); g.quadraticCurveTo(6, 28, 10, 44); g.quadraticCurveTo(28, 52, 46, 44); g.quadraticCurveTo(50, 28, 36, 18); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8a5f38'; g.beginPath(); g.moveTo(18, 14); g.lineTo(38, 14); g.lineTo(36, 20); g.lineTo(20, 20); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = C.gold; g.beginPath(); g.arc(28, 33, 5, 0, 6.2832); g.fill(); g.stroke();
  } else {
    g.fillStyle = '#f4ebd0'; g.strokeStyle = C.line; g.lineWidth = 4; g.beginPath(); g.arc(28, 28, 22, 0, 6.2832); g.fill(); g.stroke();
    if (kind === 'wait') {   // 沙漏
      g.fillStyle = '#d9b24a'; g.lineWidth = 3; g.beginPath(); g.moveTo(18, 14); g.lineTo(38, 14); g.lineTo(30, 28); g.lineTo(38, 42); g.lineTo(18, 42); g.lineTo(26, 28); g.closePath(); g.fill(); g.stroke();
    } else {   // 交叉刀
      var sd = [[-1, 1], [1, 1]], i;
      for (i = 0; i < 2; i++) {
        g.save(); g.translate(28, 28); g.rotate(i ? 0.8 : -0.8);
        g.strokeStyle = C.line; g.lineWidth = 8; g.beginPath(); g.moveTo(0, -17); g.lineTo(0, 11); g.stroke();
        g.strokeStyle = '#e8ecf2'; g.lineWidth = 3.6; g.beginPath(); g.moveTo(0, -16); g.lineTo(0, 9); g.stroke();
        g.strokeStyle = C.line; g.lineWidth = 6; g.beginPath(); g.moveTo(-6, 11); g.lineTo(6, 11); g.stroke();
        g.strokeStyle = '#c9892f'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-5, 11); g.lineTo(5, 11); g.stroke();
        g.strokeStyle = C.line; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 12); g.lineTo(0, 18); g.stroke();
        g.restore();
      }
    }
  }
  wmapArmyArtCache.badges[kind] = cv;
  return cv;
}
