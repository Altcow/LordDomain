// js/ext_sprites.js — 「外部精靈圖」試裝:登錄表 EXT_SPRITES 內的物件 id,改用 assets/buildings/<id>_L.webp 這類外部圖當精靈;
// 缺圖 / 載入失敗 / 開關關閉 / 烘焙例外 → extSpriteGet 回傳 null,art.js 的 ART.objSprite 自動走原本的程式繪製。
// 圖延遲載入(第一次需要才 new Image,不進 PWA 預快取;sw.js 對非預快取檔本來就走 fetch,不必改)。載入完成前也回 null(程式繪製),完成後下一幀自動換成外部圖。
// 視角近似:圖是「左前視角」(正面朝左下,看到左牆與正面)。rot 0 / rot 2 用 L;rot 1 / rot 3 用 R,沒有 R 就用 L 水平鏡像。
//   ※ 背向視角(rot 2、rot 3)暫時用同一張圖近似(看到的仍是正面),待有背面圖再登錄 R / 另增欄位。
// 對齊:圖中建築地基「最下方的角」(anchor,圖寬高比例)對齊該物件佔地 fw×fd 的地基最下角 ((fw-fd)*32, (fw+fd)*16);
//   縮放 = (fw+fd)*32 / (圖寬 * base) × scale(base = 圖中地基寬佔整張圖寬的估算比例);dx、dy 為世界像素微調。
// 快取:沿用 ART.cache(key 以 'ext|' 開頭,含 side / 佔地 / tod / res),受 48MB 上限與 res 分級管理。時段乘色沿用 ART.TOD[tod].mul;季節不上色。
// 全域名稱:EXT_SPRITES extSpriteGet extSpriteLayout extSpritesOn extSpritesSetOn extSpriteState。外部全域一律 typeof 守衛。ES2017;不用 ?. ??
var EXT_SPRITES_KEY = 'lorddomain.extsprites';
// anchor = 地基最下角在圖中的位置(圖寬高比例,初值為目測估算);base = 圖中地基寬 / 圖寬(估算);scale / dx / dy 使用者實機回報後微調
var EXT_SPRITES = {
  wanghuo_lou: { L: 'assets/buildings/wanghuo_lou_L.webp', anchor: { x: 0.45, y: 0.93 }, base: 0.62, scale: 1, dx: 0, dy: 0 },
  house_tile:  { L: 'assets/buildings/house_tile_L.webp',  anchor: { x: 0.62, y: 0.84 }, base: 0.86, scale: 1, dx: 0, dy: 0 },
  ting_she:    { L: 'assets/buildings/ting_she_L.webp',    anchor: { x: 0.45, y: 0.93 }, base: 0.80, scale: 1, dx: 0, dy: 0 },
  post_station: { L: 'assets/buildings/post_station_L.webp', anchor: { x: 0.55, y: 0.92 }, base: 0.90, scale: 1, dx: 0, dy: 0 },
  xian_ya:     { L: 'assets/buildings/xian_ya_L.webp',     anchor: { x: 0.52, y: 0.93 }, base: 0.86, scale: 1, dx: 0, dy: 0 },
  xue_gong:    { L: 'assets/buildings/xue_gong_L.webp',    anchor: { x: 0.60, y: 0.90 }, base: 0.86, scale: 1, dx: 0, dy: 0 }
};
var extSpriteSt = { on: null, imgs: {} };   // imgs[url] = { img, state: 'loading' | 'ok' | 'fail' }

function extSpritesOn() {
  if (extSpriteSt.on === null) {
    extSpriteSt.on = true;
    try { if (typeof localStorage !== 'undefined' && localStorage.getItem(EXT_SPRITES_KEY) === '0') extSpriteSt.on = false; } catch (e) { /* 讀不到用預設(開) */ }
  }
  return extSpriteSt.on;
}
function extSpritesSetOn(v) {
  extSpriteSt.on = !!v;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(EXT_SPRITES_KEY, extSpriteSt.on ? '1' : '0'); } catch (e) { /* 存不了只影響下次記憶 */ }
}

// 圖載入狀態:回傳 'ok' / 'loading' / 'fail';第一次呼叫才建立 Image
function extSpriteState(url) {
  var rec = extSpriteSt.imgs[url], img;
  if (rec) return rec.state;
  rec = extSpriteSt.imgs[url] = { img: null, state: 'loading' };
  try {
    img = new Image();
    img.onload = function () { rec.state = (img.naturalWidth || img.width) > 0 ? 'ok' : 'fail'; };   // 引擎為每幀重畫,下一幀自然換成外部圖
    img.onerror = function () { rec.state = 'fail'; };
    rec.img = img;
    img.src = url;
  } catch (e) { rec.state = 'fail'; }
  return rec.state;
}

// 尺寸對齊計算(純函式,可測):fw、fd = 目前朝向佔地格數;iw、ih = 圖像素;mirror = 水平鏡像
// 回傳 { scale, l, t, w, h }:圖左上角相對物件錨點(佔地頂角)的世界像素位置與縮放後大小
function extSpriteLayout(e, fw, fd, iw, ih, mirror) {
  var an = e.anchor || { x: 0.5, y: 0.95 }, base = e.base || 0.85;
  var s = (fw + fd) * 32 / (iw * base) * (e.scale || 1);
  var ax = (mirror ? 1 - an.x : an.x) * iw * s, ay = an.y * ih * s;
  var bx = (fw - fd) * 32, by = (fw + fd) * 16;
  return { scale: s, l: bx - ax + (mirror ? -(e.dx || 0) : (e.dx || 0)), t: by - ay + (e.dy || 0), w: iw * s, h: ih * s };
}

function extSpriteMk(w, h) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// 取外部精靈;不適用(關閉 / 未登錄 / 圖未好 / 失敗)回 null → 呼叫端走程式繪製
function extSpriteGet(type, f, v, res) {
  var e = EXT_SPRITES[type], A, s, side, url, st, rec, img, iw, ih, fp, ly, tod, key, c, pad = 4;
  if (!e || !extSpritesOn()) return null;
  if (typeof ART === 'undefined' || !ART.OBJ || !ART.OBJ[type] || typeof document === 'undefined') return null;
  A = ART; s = A.OBJ[type]; f = f || 0;
  side = (f === 1 || f === 3) ? 'R' : 'L';
  url = (side === 'R' && e.R) ? e.R : e.L;
  st = extSpriteState(url);
  if (st !== 'ok') return null;
  tod = A.todOf(v);
  fp = A.foot(type, f);
  key = 'ext|' + type + '|' + side + '|' + fp[0] + 'x' + fp[1] + '|' + ((v && v.tod) || 'noon') + '|' + res;
  c = A.touch(key);
  if (c) return c;
  try {
    rec = extSpriteSt.imgs[url]; img = rec.img;
    iw = img.naturalWidth || img.width; ih = img.naturalHeight || img.height;
    e.w = iw; e.h = ih;
    ly = extSpriteLayout(e, fp[0], fp[1], iw, ih, side === 'R' && !e.R);
    var L = Math.min(ly.l, -fp[1] * 32), T = Math.min(ly.t, 0), R = Math.max(ly.l + ly.w, fp[0] * 32), B = Math.max(ly.t + ly.h, (fp[0] + fp[1]) * 16);
    var w = Math.ceil((R - L + pad * 2) * res), h = Math.ceil((B - T + pad * 2) * res);
    var tx = (pad - L) * res, ty = (pad - T) * res;
    var body = extSpriteMk(w, h), bx = body.getContext('2d'), out, ox, tmp, tc;
    bx.setTransform(res, 0, 0, res, tx, ty);
    bx.imageSmoothingEnabled = true;
    if (side === 'R' && !e.R) { bx.translate(ly.l * 2 + ly.w, 0); bx.scale(-1, 1); }
    bx.drawImage(img, ly.l, ly.t, ly.w, ly.h);
    bx.setTransform(1, 0, 0, 1, 0, 0);
    if (tod && tod.mul) {
      tmp = extSpriteMk(w, h); tc = tmp.getContext('2d');
      tc.drawImage(body, 0, 0); tc.globalCompositeOperation = 'multiply'; tc.fillStyle = tod.mul; tc.fillRect(0, 0, w, h);
      tc.globalCompositeOperation = 'destination-in'; tc.drawImage(body, 0, 0); tc.globalCompositeOperation = 'source-over';
      body = tmp;
    }
    out = extSpriteMk(w, h); ox = out.getContext('2d');
    ox.setTransform(res, 0, 0, res, tx, ty);
    if (typeof A.footShadow === 'function') A.footShadow(ox, fp[0], fp[1], s.shadow, tod ? tod.shadow : undefined);
    ox.setTransform(1, 0, 0, 1, 0, 0);
    ox.drawImage(body, 0, 0);
    c = { cv: out, l: L - pad, t: T - pad, res: res, bytes: out.width * out.height * 4, last: ++A.cacheTick };
    A.cache[key] = c; A.cacheCount++; A.cacheBytes += c.bytes;
    A.evict(key);
    return c;
  } catch (err) { extSpriteState(url); extSpriteSt.imgs[url].state = 'fail'; return null; }
}
