// js/buildpreview.js — 建造選單「建築預覽」:選單頂部有「預覽」勾選(偏好存 localStorage,預設關);勾選後,點選單內的建築只顯示預覽浮卡,
// 不選取工具、不扣錢、不放到地面。浮卡放螢幕左上角(橫版右上角),幾何由 panelmgr.js 的 panelPlaceCard 決定(不進中央操作區);
// 以 ART.objSprite 離屏烘焙(res 3)後裁去透明邊、放大到卡內最大(上限約 3 倍世界像素)繪製,可切 4 個朝向、四季、晨午昏夜。
// 全域名稱:bpv bpvEnabled bpvSetEnabled bpvIntercept bpvShow bpvClose bpvAddToggle bpvEffectText。外部全域一律 typeof 守衛。ES2017;不用 ?. ??
var BPV_KEY = 'lorddomain.ui.bpreview';
var BPV_SEASONS = [['spring', '春'], ['summer', '夏'], ['autumn', '秋'], ['winter', '冬']];
var BPV_TODS = [['dawn', '晨'], ['noon', '午'], ['dusk', '昏'], ['night', '夜']];
var BPV_FX_NAME = { wei: '衛生', yi: '防疫', shui: '供水', liang: '糧食', store: '存糧', an: '治安', xin: '民心', jiao: '教化', lu: '通行', wang: '名望',
  min: '民生', mei: '美觀', xu: '蓄養', wen: '文風', shang: '商貿', chan: '產能', tian: '農田', fire: '防火', flood: '防洪', locust: '防蝗', warn: '預警', xue: '學識' };
var BPV_SIMPLE_OFF = ['yi', 'an', 'xin', 'jiao', 'fire', 'flood', 'locust', 'warn'];   // 簡化城市模式(js/citysimple.js)關閉的效果軸
var BPV_SIZE_PORTRAIT ={ w: 252, h: 124 };
var BPV_SIZE_LANDSCAPE = { w: 200, h: 124 };
var BPV_RES = 3;          // 烘焙解析度(ART.objSprite 的 res,等於世界像素 3 倍)
var BPV_MAX_K = 2;        // 烘焙圖再放大上限(畫布 2× 取樣,所以最大約 3 CSS 像素/世界像素)
var bpv = { on: false, id: '', rot: 0, season: 'spring', tod: 'noon', el: null, cv: null, registered: false, loaded: false, last: null, info: null };

function bpvStoreGet() {
  try { return typeof uiStorageGet === 'function' ? uiStorageGet(BPV_KEY) : localStorage.getItem(BPV_KEY); } catch (e) { return null; }
}
function bpvStoreSet(v) {
  try { if (typeof uiStorageSet === 'function') uiStorageSet(BPV_KEY, v); else localStorage.setItem(BPV_KEY, v); } catch (e) { /* 偏好存不了不影響功能 */ }
}
function bpvEnabled() {
  if (!bpv.loaded) { bpv.loaded = true; bpv.on = bpvStoreGet() === '1'; }
  return bpv.on;
}
function bpvSetEnabled(on) {
  bpvEnabled();
  bpv.on = !!on;
  bpvStoreSet(bpv.on ? '1' : '0');
  if (!bpv.on) bpvClose();
}

// 一句效果(產出 / 居住 / 服務 / 效果標籤);純擺設 → 「純擺設,無實際效果」
function bpvEffectText(id) {
  var d = typeof OBJECTS !== 'undefined' ? OBJECTS[id] : null, parts = [], fx, k, ks = [], inf;
  if (!d) return '';
  if (d.prod && typeof prodText === 'function') parts.push('產出 ' + prodText(d.prod));
  if (d.tier !== undefined && d.tier !== null) parts.push('居住');
  if (d.unit) parts.push('兵營');
  fx = (typeof CITY_FX !== 'undefined' && CITY_FX[id]) || (typeof CITY_FX_PENDING !== 'undefined' && CITY_FX_PENDING[id]) || null;
  if (fx && fx.fx) {
    for (k in fx.fx) if (k !== 'mei' && !(typeof citySimpleOn === 'function' && citySimpleOn() && BPV_SIMPLE_OFF.indexOf(k) >= 0)) ks.push(BPV_FX_NAME[k] || k);   // 簡化模式:已砍的軸(防災 / 治安 / 民心 / 疫病 / 教化)不列
    if (ks.length) parts.push(ks.join('、'));
  }
  if (!parts.length && typeof cityInfo === 'function') {
    inf = cityInfo(id);
    if (inf && (inf.svc || inf.jobs || inf.shop || inf.cult)) parts.push('民生設施');
  }
  if (!parts.length && typeof objCatOf === 'function' && objCatOf(id) === 'eco') parts.push('功能建築');
  if (!parts.length) return '純擺設,無實際效果';
  return parts.join(';');
}

function bpvFoot(id, rot) {
  var f, d;
  if (typeof footprint === 'function') {
    try { f = footprint(id, rot); return f[0] + '×' + f[1]; } catch (e) { /* 退回 w×h */ }
  }
  d = OBJECTS[id];
  return d.w + '×' + d.h;
}

function bpvEnsureEl() {
  var el;
  if (bpv.el) return bpv.el;
  if (typeof document === 'undefined') return null;
  el = document.createElement('div');
  el.id = 'bpvCard';
  el.className = 'bpvcard';
  el.hidden = true;
  el.innerHTML = '<div class="bpv-main"><canvas class="bpv-cv" width="208" height="176"></canvas><div class="bpv-txt"></div></div>' +
    '<div class="bpv-ctl"></div><button class="bpv-x" data-bpv-x title="關閉預覽">✕</button>';
  el.addEventListener('click', bpvOnClick);
  document.body.appendChild(el);
  bpv.el = el;
  bpv.cv = el.querySelector('canvas');
  if (!bpv.registered && typeof panelRegister === 'function') {
    panelRegister('bpv', { kind: 'card', el: el, place: true, closeOnMapDrag: false, onClose: function () { bpv.id = ''; if (bpv.el) bpv.el.hidden = true; } });
    bpv.registered = true;
  }
  return el;
}

function bpvOnClick(e) {
  var b = e.target && e.target.closest ? e.target.closest('button') : null, v;
  if (!b) return;
  if (b.getAttribute('data-bpv-x') !== null) { bpvClose(); return; }
  if (b.getAttribute('data-bpv-rot') !== null) bpv.rot = (bpv.rot + 1) % 4;
  else if ((v = b.getAttribute('data-bpv-season'))) bpv.season = v;
  else if ((v = b.getAttribute('data-bpv-tod'))) bpv.tod = v;
  else return;
  bpvRender();
}

function bpvEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function bpvRender() {
  var el = bpv.el, d, txt, ctl, html;
  if (!el || !bpv.id || typeof OBJECTS === 'undefined' || !OBJECTS[bpv.id]) return;
  d = OBJECTS[bpv.id];
  txt = el.querySelector('.bpv-txt');
  bpv.info = { name: d.name, foot: bpvFoot(bpv.id, bpv.rot), effect: bpvEffectText(bpv.id), cost: typeof feeText === 'function' && typeof objCost === 'function' ? feeText(objCost(bpv.id)) : '' };
  if (typeof bmcCostText === 'function' && bmcCostText(bpv.id)) bpv.info.cost = bmcCostText(bpv.id);   // 建築材料成本(bmc.js):需要的木 / 石 / 貨品
  html = '<b>' + bpvEsc(bpv.info.name) + '</b><span>佔地 ' + bpv.info.foot + '</span><span>' + bpvEsc(bpv.info.effect) + '</span><span>' + (typeof bmcCostHtml === 'function' && bmcCostHtml(bpv.id) ? '材料 ' + bmcCostHtml(bpv.id) + '(庫存/需要)' : '成本 ' + bpvEsc(bpv.info.cost)) + '</span>';
  if (txt) txt.innerHTML = html;
  ctl = el.querySelector('.bpv-ctl');
  if (ctl) {
    html = '<button data-bpv-rot title="切換朝向">↻' + bpv.rot + '</button>';
    BPV_SEASONS.forEach(function (s) { html += '<button data-bpv-season="' + s[0] + '"' + (bpv.season === s[0] ? ' class="on"' : '') + '>' + s[1] + '</button>'; });
    BPV_TODS.forEach(function (s) { html += '<button data-bpv-tod="' + s[0] + '"' + (bpv.tod === s[0] ? ' class="on"' : '') + '>' + s[1] + '</button>'; });
    ctl.innerHTML = html;
  }
  bpvDraw();
}

// 取 sprite 內容的緊邊界(去掉透明邊與上方預留高度);讀不到像素就用整張
function bpvBounds(cv) {
  var w = cv.width, h = cv.height, c, im, x, y, a, x0 = w, y0 = h, x1 = -1, y1 = -1;
  try {
    c = cv.getContext('2d');
    im = c.getImageData(0, 0, w, h).data;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        a = im[(y * w + x) * 4 + 3];
        if (a > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    if (x1 >= x0 && y1 >= y0) return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  } catch (e) { /* 取不到像素 */ }
  return { x: 0, y: 0, w: w, h: h };
}

// 外部精靈圖延遲載入:預覽先以程式繪製顯示,圖載入完成後補畫一次(最多等約 6 秒;缺圖 / 失敗就維持程式繪製)
function bpvExtRetry(t) {
  var e, st;
  if (typeof EXT_SPRITES === 'undefined' || typeof extSpriteState !== 'function' || !(e = EXT_SPRITES[t])) return;
  if (typeof extSpritesOn === 'function' && !extSpritesOn()) return;
  st = extSpriteState(e.L);
  if (st !== 'loading' || (bpv.retry || 0) >= 24 || typeof setTimeout !== 'function') return;
  bpv.retry = (bpv.retry || 0) + 1;
  setTimeout(function () { if (bpv.id && bpv.el && !bpv.el.hidden) bpvDraw(); }, 250);
}

function bpvDraw() {
  var cv = bpv.cv, c, t, spr, bb, k, dw, dh, d = OBJECTS[bpv.id], v;
  bpv.last = { mode: 'none', scale: 0 };
  if (!cv || !cv.getContext) return;
  c = cv.getContext('2d');
  if (!c) return;
  c.clearRect(0, 0, cv.width, cv.height);
  t = typeof artType === 'function' ? artType(bpv.id) : null;
  try {
    if (t && typeof ART !== 'undefined' && ART.OBJ && ART.OBJ[t] && ART.objSprite) {
      v = { season: bpv.season, tod: bpv.tod, seed: 0, level: 0, skin: '', kind: '', dmg: 0 };
      spr = ART.objSprite(t, bpv.rot, v, BPV_RES);
      bb = bpvBounds(spr.cv);
      k = Math.min(BPV_MAX_K, (cv.width - 12) / bb.w, (cv.height - 12) / bb.h);
      dw = bb.w * k;
      dh = bb.h * k;
      c.imageSmoothingEnabled = true;
      c.drawImage(spr.cv, bb.x, bb.y, bb.w, bb.h, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
      bpv.last = { mode: 'art', scale: k * BPV_RES / 2 };   // CSS 像素 / 世界像素(畫布 2× 取樣)
      bpvExtRetry(t);
      return;
    }
  } catch (e) { /* 烘焙失敗:退回圖示 */ }
  c.font = '88px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(d.icon || '?', cv.width / 2, cv.height / 2);
  bpv.last = { mode: 'icon', scale: 0 };
}

function bpvViewport() {
  return typeof panelViewport === 'function' ? panelViewport() : { w: 375, h: 667 };
}
// 豎版放左上角、橫版放右上角(避開中央操作區)。錨點取「卡片中心貼齊角落」,panelPlaceCard 才會選頂部 / 右側區而不是被擠成窄條的左側區
function bpvSize() {
  var vp = bpvViewport();
  return vp.w > vp.h ? BPV_SIZE_LANDSCAPE : BPV_SIZE_PORTRAIT;
}
function bpvAnchor() {
  var vp = bpvViewport(), s = bpvSize();
  return vp.w > vp.h ? { x: vp.w - s.w / 2, y: 0, w: 0, h: 0 } : { x: s.w / 2, y: 0, w: 0, h: 0 };
}

function bpvShow(id) {
  var el = bpvEnsureEl(), opened = false;
  if (!el || typeof OBJECTS === 'undefined' || !OBJECTS[id]) return false;
  bpv.id = id; bpv.retry = 0;
  bpvRender();
  if (typeof panelOpen === 'function') opened = panelOpen('bpv', { kind: 'card', anchor: bpvAnchor(), size: bpvSize() });
  if (!opened) {
    // 面板管理器不讓開(例如大面板開著):直接固定在左上角
    el.style.position = 'fixed';
    el.style.left = '0px';
    el.style.top = '0px';
  }
  el.hidden = false;
  return true;
}

function bpvClose() {
  if (typeof panelClose === 'function' && typeof panelIsOpen === 'function' && panelIsOpen('bpv')) panelClose('bpv');
  if (bpv.el) bpv.el.hidden = true;
  bpv.id = '';
}

// 建造選單鈕點擊時呼叫:預覽開啟且是經營模式的一般物件 → 顯示預覽並回傳 true(呼叫端不選工具)
function bpvIntercept(id) {
  if (!bpvEnabled() || typeof game === 'undefined' || game.mode !== 'estate') return false;
  if (typeof OBJECTS === 'undefined' || !OBJECTS[id]) return false;
  bpv.rot = 0;
  return bpvShow(id);
}

// 選單頂部的「預覽」勾選鈕(只在經營模式的建築頂層)
function bpvAddToggle(bar) {
  var b, on;
  if (typeof game === 'undefined' || game.mode !== 'estate') return null;
  on = bpvEnabled();
  b = document.createElement('button');
  b.id = 'bpvToggle';
  b.className = 'bpvtoggle' + (on ? ' on' : '');
  b.setAttribute('data-bpv-toggle', on ? '1' : '0');
  b.innerHTML = '<span class="ic">' + (on ? '☑' : '☐') + '</span><span>預覽</span>';
  b.title = '勾選後,點選單內的建築只顯示放大預覽,不會選取也不扣錢';
  b.addEventListener('click', function () {
    bpvSetEnabled(!bpvEnabled());
    if (typeof buildToolbar === 'function') buildToolbar();
  });
  bar.appendChild(b);
  return b;
}
