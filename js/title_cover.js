// js/title_cover.js — 封面 → 選伺服器 → 開始遊戲(B 包;旗標 shell 之後;流程借鏡 MageSandbox 封面,美術不複製)。
// 掛點:覆寫 saveslots.js 的 worldsStartup。main.js 的 bootWorlds 在 DOMContentLoaded 才以全域名查找,故本檔須在 main.js 之前載入(index.html)。
// worldsStartup 做完存檔遷移 / 切換中斷復原後才進封面;按『開始遊戲』才呼叫 boot(不重複初始化)。
// 旗標 shell 關閉或網址 ?nocover=1:直接 fn(),與 v61 相同。localStorage / IDB 一律 try/catch;讀寫失敗仍可進遊戲。
// 伺服器 S01~S03 = 存檔槽 1~3(平行世界編號);單機階段只是標籤 + 各自獨立存檔。非使用中伺服器的切換走 worldsEnter(既有流程,目前休眠於 multiworld 旗標,會回 dormant)。
// 全域名稱:TC_SERVERS TC_PREF_KEY titleCoverGate tcEnabled
// open:false = 尚未開放(顯示但灰掉、不可點、標『即將開放』);單機階段只開 S01。日後開放伺服世界時改成 open:true。
var TC_SERVERS = [
  { id: 'S01', name: '中原逐鹿', slot: 1, open: true },
  { id: 'S02', name: '江東烽火', slot: 2, open: false },
  { id: 'S03', name: '巴蜀天險', slot: 3, open: false }
];
var TC_PREF_KEY = 'lorddomain.ui.titleServer';   // 上次選的伺服器(偏好鍵,已登錄 saveslots.js SAVE_PREF_KEYS)
var TC_FLASH_MS = 400;
var TC_UNITS = { L: ['spear', 'cav', 'shield'], R: ['bow', 'strat', 'cav'] };   // 兩側各 3 個不同兵種
var TC_FLIP_R = true;   // 右側朝左:素材預設朝右時翻轉(目視確認後調整)
var tcSt = null;

function tcEnabled() {
  try { if (typeof shellOn !== 'function' || !shellOn()) return false; } catch (e) { return false; }
  try { if (/[?&]nocover=1(&|$)/.test(String(window.location.search || ''))) return false; } catch (e2) { /* 略過 */ }
  return true;
}
function tcReduced() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}
function tcLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function tcLsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 略過 */ } }
function tcEl(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function tcBtn(text, cls, fn) {
  var b = tcEl('button', cls, text);
  b.setAttribute('type', 'button');
  if (fn) b.addEventListener('click', fn);
  return b;
}
function tcUrl(id) {
  try { return typeof uiAssetUrl === 'function' ? uiAssetUrl(id) : null; } catch (e) { return null; }
}
function tcServerById(id) {
  for (var i = 0; i < TC_SERVERS.length; i++) if (TC_SERVERS[i].id === id) return TC_SERVERS[i];
  return null;
}
function tcOpen(srv) { return !!srv && srv.open === true; }
function tcFirstOpen() {
  for (var i = 0; i < TC_SERVERS.length; i++) if (tcOpen(TC_SERVERS[i])) return TC_SERVERS[i].id;
  return TC_SERVERS[0].id;
}
function tcPrefSel() { var v = tcLsGet(TC_PREF_KEY), s = tcServerById(v); return tcOpen(s) ? v : tcFirstOpen(); }
function tcCurSrv() { return tcSt ? tcServerById(tcSt.sel) : null; }
function tcSay(msg) { if (tcSt && tcSt.msg) tcSt.msg.textContent = msg || ''; }
function tcConfirm(msg) {
  try { return typeof confirm === 'function' ? !!confirm(msg) : false; } catch (e) { return false; }
}
function tcTime(ts) {
  try { return typeof savesTimeText === 'function' ? savesTimeText(ts) : ''; } catch (e) { return ''; }
}

// 入口(由 worldsStartup 掛點呼叫):fn = boot。旗標關閉 / ?nocover=1 → 直接 fn()
function titleCoverGate(fn) {
  if (!tcEnabled()) { fn(); return; }
  if (tcSt) return;
  if (tcAutoGet()) { tcAutoSet(false); fn(); return; }   // 清空紀錄後重新載入:直接以全新存檔進遊戲,不再停在封面
  tcSt = { fn: fn, root: null, panel: null, started: false, sel: tcPrefSel(), info: null, activeSlot: 1, list: null, hint: null, big: null, clrBtn: null, armed: false, armTimer: 0, busy: false, msg: null, ver: null, keyFn: null };
  tcBuild();
}

function tcBuild() {
  var root = tcEl('div'), bg = tcEl('div', 'tc-bg'), shade = tcEl('div', 'tc-shade'), flash = tcEl('div', 'tc-flash');
  var title = tcEl('div', 'tc-title'), logoUrl = tcUrl('home_logo'), logo, press, ver, bgUrl, img, mist = tcEl('div', 'tc-mists'), canvas = null, sub = tcEl('div', 'tc-sub tc-sub-wait', '東漢末年 群雄逐鹿');
  root.id = 'titleCover';
  root.className = 'tc-root';
  var pt = window.innerHeight >= window.innerWidth;
  bgUrl = tcUrl(pt ? 'cover_bg_port' : 'cover_bg_land') || tcUrl(pt ? 'bg_stage_port' : 'bg_stage_land');   // 封面專用背景;找不到退回舞台背景,再退回 CSS 漸層
  if (bgUrl) {
    img = new Image();
    img.onload = function () { bg.style.backgroundImage = 'url("' + bgUrl + '")'; try { if (tcSt && tcSt.emb && tcSt.emb.setImage) tcSt.emb.setImage(img); } catch (e) { /* 略過 */ } };
    img.src = bgUrl;
  }
  if (logoUrl) {   // 標題圖:載入完成才顯示(之前不閃文字),載入失敗才退回 CSS 文字 lockup
    logo = tcEl('img', 'tc-logo-img tc-logo-wait');
    logo.alt = '東漢Q卡';
    logo.onload = function () { logo.className = 'tc-logo-img'; sub.className = 'tc-sub'; };
    logo.onerror = function () { try { if (logo.parentNode) logo.parentNode.removeChild(logo); title.appendChild(tcLockup()); sub.className = 'tc-sub'; } catch (e) { /* 略過 */ } };
    logo.src = logoUrl;
    title.appendChild(logo);
  } else { title.appendChild(tcLockup()); sub.className = 'tc-sub'; }
  title.appendChild(sub);
  mist.appendChild(tcEl('div', 'tc-mist m1'));
  mist.appendChild(tcEl('div', 'tc-mist m2'));
  mist.appendChild(tcEl('div', 'tc-mist m3'));
  press = tcEl('div', 'tc-press', '點擊任意處開始');
  ver = tcEl('div', 'tc-ver', '');
  root.appendChild(bg);
  root.appendChild(mist);
  root.appendChild(tcEl('div', 'tc-glow'));
  canvas = tcEmbersMake();
  if (canvas) root.appendChild(canvas);
  root.appendChild(shade);
  root.appendChild(title);
  // 首頁封面不再放人物(2026-11 改版):tcUnits('L') / tcUnits('R') 與 TC_UNITS 資料保留但不呼叫
  root.appendChild(press);
  root.appendChild(flash);
  root.appendChild(ver);
  root.appendChild(tcPanelBuild());
  root.addEventListener('click', tcOnTap);
  tcSt.root = root;
  tcEmbersStart(canvas);
  tcSt.ver = ver;
  tcSt.keyFn = function (ev) { if (!tcSt || tcSt.started) return; if (ev.key === 'Enter' || ev.key === ' ') tcStart(); };
  document.addEventListener('keydown', tcSt.keyFn);
  document.body.appendChild(root);
  try {
    if (typeof savesLoadAppVer === 'function') {
      savesLoadAppVer().then(function (n) { if (tcSt && tcSt.ver && n) tcSt.ver.textContent = 'v' + n; }, function () { /* 略過 */ });
    }
  } catch (e) { /* 略過 */ }
}

// 標題 lockup:「東漢」大而粗、字距緊;「Q」圓形印章略傾斜;「卡」較小。字體 / 描邊全在 CSS(text-shadow 外框,不用 text-stroke 吃字形)
function tcLockup() {
  var box = tcEl('div', 'tc-logo'), han = tcEl('span', 'tc-han', '東漢'), q = tcEl('span', 'tc-q', 'Q'), ka = tcEl('span', 'tc-ka', '卡');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', '東漢Q卡');
  han.setAttribute('data-t', '東漢');
  ka.setAttribute('data-t', '卡');
  box.appendChild(han);
  box.appendChild(q);
  box.appendChild(ka);
  return box;
}

// 火焰 + 火星(同一個 canvas、同一個 rAF 排程、約 30fps、頁面不可見暫停):
//  1) 背景圖縮成小圖偵測火焰熱點(一次性,結果快取);2) 熱點上以程式預繪的火舌 sprite + 光暈 sprite 用 'lighter' 疊加,搖曳 / 閃爍;3) 火星粒子。
//  畫質低 / 減少動態 / 無 canvas → 不建立(CSS 的整體火光閃爍只用 opacity,低畫質仍保留)。
var TC_EMBER_N = { mid: 12, high: 20 };      // 新背景自帶大量火星,數量壓低
var TC_EMBER_FPS = 30;
var TC_FIRE_MAX = { mid: 26, high: 38 };     // 熱點上限(24~40)
var TC_FIRE_SIZE = { land: [64, 36], port: [36, 64] };
function tcQuality() {
  try { return typeof qualityLevel === 'function' ? qualityLevel() : 'mid'; } catch (e) { return 'mid'; }
}
// 純函式:rgba = 小圖像素(Uint8ClampedArray / 陣列,w*h*4)。回傳熱點 [{x,y,wt}],x/y 為 0~1 圖片座標,wt 0~1(最亮 = 1)。
// 火焰像素 = R 高、B 低、亮度夠、偏橙紅;依亮度排序,貪婪取點並抑制鄰近格(半徑 r 格),權重含 3x3 鄰域亮度(面積)
function tcFireSpots(rgba, w, h, maxN) {
  var cells = [], i, x, y, p, R, G, B, lum, sc = [], n, best, r = Math.max(3, Math.round(Math.min(w, h) / 9)), out = [], taken = [], k, dx, dy, mx = 0, s, xx, yy;
  if (!rgba || !w || !h) return out;
  for (i = 0; i < w * h; i++) {
    p = i * 4; R = rgba[p]; G = rgba[p + 1]; B = rgba[p + 2];
    lum = 0.3 * R + 0.59 * G + 0.11 * B;
    sc[i] = (R > 170 && R > G * 1.12 && B < G * 0.8 && lum > 120) ? lum + (R - B) * 0.3 : 0;
    if (sc[i] > 0) cells.push(i);
  }
  cells.sort(function (a, b) { return sc[b] - sc[a]; });
  for (n = 0; n < cells.length && out.length < (maxN || 32); n++) {
    best = cells[n]; x = best % w; y = (best - x) / w;
    for (k = 0; k < taken.length; k++) { dx = taken[k][0] - x; dy = taken[k][1] - y; if (dx * dx + dy * dy < r * r) break; }
    if (k < taken.length) continue;
    taken.push([x, y]);
    s = 0;
    for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) { xx = x + dx; yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) s += sc[yy * w + xx]; }
    out.push({ x: (x + 0.5) / w, y: (y + 0.5) / h, wt: s });
    if (s > mx) mx = s;
  }
  for (i = 0; i < out.length; i++) out[i].wt = mx ? out[i].wt / mx : 0;
  return out;
}
// 純函式:background-size:cover + center,圖(iw×ih)鋪在 EW×EH 元素上的縮放與位移
function tcCoverMap(iw, ih, EW, EH) {
  var s = Math.max(EW / iw, EH / ih);
  return { s: s, ox: (EW - iw * s) / 2, oy: (EH - ih * s) / 2 };
}
// 預繪 sprite:火舌(淚滴 4 種寬瘦)+ 光暈。失敗回 null
function tcFireSprites() {
  var out = { flames: [], glow: null }, i, c, g, shapes = [[0.34, 1], [0.26, 1], [0.42, 0.85], [0.3, 0.95]], W = 32, H = 64, sw, sh, grad;
  try {
    for (i = 0; i < shapes.length; i++) {
      c = document.createElement('canvas'); c.width = W; c.height = H; g = c.getContext('2d');
      sw = W * shapes[i][0]; sh = H * shapes[i][1];
      grad = g.createLinearGradient(0, H, 0, H - sh);
      grad.addColorStop(0, 'rgba(255,245,170,0.95)'); grad.addColorStop(0.3, 'rgba(255,170,40,0.8)'); grad.addColorStop(0.7, 'rgba(230,70,15,0.4)'); grad.addColorStop(1, 'rgba(160,20,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(W / 2, H - sh);
      g.bezierCurveTo(W / 2 + sw * 0.15, H - sh * 0.55, W / 2 + sw, H - sh * 0.35, W / 2 + sw * 0.7, H - sh * 0.1);
      g.bezierCurveTo(W / 2 + sw * 0.4, H + 2, W / 2 - sw * 0.4, H + 2, W / 2 - sw * 0.7, H - sh * 0.1);
      g.bezierCurveTo(W / 2 - sw, H - sh * 0.35, W / 2 - sw * 0.15, H - sh * 0.55, W / 2, H - sh);
      g.fill();
      out.flames.push(c);
    }
    c = document.createElement('canvas'); c.width = 48; c.height = 48; g = c.getContext('2d');
    grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, 'rgba(255,190,80,0.55)'); grad.addColorStop(0.5, 'rgba(255,100,20,0.22)'); grad.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 48, 48);
    out.glow = c;
  } catch (e) { return null; }
  return out;
}
function tcEmbersMake() {
  var c, lv = tcQuality();
  if (lv === 'low' || tcReduced()) return null;
  try { c = tcEl('canvas', 'tc-embers'); if (!c.getContext || !c.getContext('2d')) return null; } catch (e) { return null; }
  c._n = TC_EMBER_N[lv] || TC_EMBER_N.mid;
  c._lv = lv;
  return c;
}
function tcEmbersStart(c) {
  var ctx, ps = [], i, w = 0, h = 0, last = 0, raf = 0, stop = false, acc = { n: 0, ms: 0 }, st, spr = null, img = null, spots = [], scr = [], mapDirty = true, t = 0;
  if (!c || !tcSt) return;
  try { ctx = c.getContext('2d'); } catch (e) { return; }
  function reset(p, first) {
    p.x = Math.random() * (w || 400);
    p.y = first ? Math.random() * (h || 300) : (h || 300) + 6 + Math.random() * 30;
    p.vy = 14 + Math.random() * 34;
    p.sw = 8 + Math.random() * 22;
    p.ph = Math.random() * 6.28;
    p.r = 1.2 + Math.random() * 1.8;
    p.hue = 18 + Math.random() * 28;
    p.fl = 3 + Math.random() * 5;
  }
  for (i = 0; i < c._n; i++) { ps.push({}); reset(ps[i], true); }
  // 圖片座標 → 畫布座標(畫布與 .tc-bg 同尺寸 / 同縮放動畫);標題區附近強度降低
  function remap() {
    var iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1, m = tcCoverMap(iw, ih, w, h), tr = null, k, sp, d, f, px, py, cx = w / 2, cy = h * 0.3, rx = w * 0.3, ry = h * 0.2, te;
    try { te = tcSt && tcSt.root && tcSt.root.querySelector ? tcSt.root.querySelector('.tc-title') : null; if (te) tr = te.getBoundingClientRect(); } catch (e) { tr = null; }
    if (tr && tr.width > 150) { cx = tr.left + tr.width / 2 + w * 0.02; cy = tr.top + tr.height / 2 + h * 0.02; rx = tr.width * 0.62; ry = tr.height * 0.75; }
    scr = [];
    for (k = 0; k < spots.length; k++) {
      sp = spots[k];
      px = sp.x * iw * m.s + m.ox; py = sp.y * ih * m.s + m.oy;
      d = Math.sqrt(Math.pow((px - cx) / rx, 2) + Math.pow((py - cy) / ry, 2));
      f = d >= 1 ? 1 : 0.25 + 0.75 * d * d;
      scr.push({ x: px, y: py, wt: sp.wt, f: f, ph: Math.random() * 100, n: 1 + (sp.wt > 0.55 ? 1 : 0) + (sp.wt > 0.85 ? 1 : 0) });
    }
    mapDirty = false;
  }
  function drawFire() {
    var k, j, s, a, fl, hh, ww, jit, fs = Math.min(w, h) * 0.075 + 8, gl;
    ctx.globalCompositeOperation = 'lighter';
    for (k = 0; k < scr.length; k++) {
      s = scr[k];
      fl = 0.5 + 0.5 * Math.sin(t * 6.1 + s.ph) * Math.sin(t * 2.3 + s.ph * 1.7);
      gl = (0.55 + 0.45 * Math.sin(t * 1.7 + s.ph)) * s.f;
      ctx.globalAlpha = Math.min(1, gl * (0.5 + 0.5 * s.wt));
      ctx.drawImage(spr.glow, s.x - fs * 1.1, s.y - fs * 1.1, fs * 2.2, fs * 2.2);
      for (j = 0; j < s.n; j++) {
        hh = fs * (1.0 + 0.35 * s.wt) * (0.7 + 0.3 * Math.sin(t * (4.2 + j * 1.3) + s.ph + j * 2.1) + 0.2 * Math.sin(t * 9.3 + s.ph * 3 + j));
        ww = hh * (0.38 + 0.08 * Math.sin(t * 5.1 + s.ph + j));
        jit = Math.sin(t * 3.4 + s.ph + j * 1.9) * fs * 0.12 + (j - 1) * fs * 0.16;
        a = s.f * (0.28 + 0.42 * fl) * (0.55 + 0.45 * s.wt);
        ctx.globalAlpha = a;
        ctx.drawImage(spr.flames[(k + j) % spr.flames.length], s.x + jit - ww / 2, s.y - hh * 0.92 + fs * 0.1, ww, hh);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  function frame(ts) {
    var t0, dt, k, p, x, a, W = Math.round((window.innerWidth || 400) * 1.04), H = Math.round((window.innerHeight || 300) * 1.04);
    raf = 0;
    if (stop || !tcSt || (typeof document !== 'undefined' && document.hidden)) return;
    raf = requestAnimationFrame(frame);
    if (ts - last < 1000 / TC_EMBER_FPS - 1) return;
    dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.04;
    last = ts; t += dt;
    t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    if (W !== w || H !== h) { w = W; h = H; c.width = w; c.height = h; mapDirty = true; }
    ctx.clearRect(0, 0, w, h);
    if (spots.length && spr) { if (mapDirty) remap(); drawFire(); }
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      p.y -= p.vy * dt;
      p.ph += dt;
      x = p.x + Math.sin(p.ph * 1.3) * p.sw;
      if (p.y < -8) { reset(p, false); continue; }
      a = (0.45 + 0.4 * Math.sin(p.ph * p.fl)) * Math.min(1, Math.max(0, p.y / (h * 0.25)));
      ctx.fillStyle = 'hsla(' + p.hue.toFixed(0) + ',100%,60%,' + (a * 0.18).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, p.y, p.r * 3, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'hsla(' + (p.hue + 12).toFixed(0) + ',100%,72%,' + (a * 0.7).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, 6.2832); ctx.fill();
    }
    if (t0) { acc.n++; acc.ms += performance.now() - t0; }
  }
  function kick() { if (!raf && !stop && !(typeof document !== 'undefined' && document.hidden)) { last = 0; raf = requestAnimationFrame(frame); } }
  function onVis() { if (typeof document !== 'undefined' && !document.hidden) kick(); }
  // 背景圖載入後:縮成小圖偵測熱點(一次,失敗就沒有火舌,只剩火星)
  function setImage(im) {
    var sz = TC_FIRE_SIZE[(window.innerHeight || 0) >= (window.innerWidth || 0) ? 'port' : 'land'], sc, g, d;
    try {
      sc = document.createElement('canvas'); sc.width = sz[0]; sc.height = sz[1];
      g = sc.getContext('2d'); g.drawImage(im, 0, 0, sz[0], sz[1]);
      d = g.getImageData(0, 0, sz[0], sz[1]);
      if (!d || !d.data) return;
      spots = tcFireSpots(d.data, sz[0], sz[1], TC_FIRE_MAX[c._lv] || TC_FIRE_MAX.mid);
      img = im; mapDirty = true;
      if (!spr) spr = tcFireSprites();
      st.spots = spots.length;
    } catch (e) { spots = []; }
  }
  st = { stats: acc, count: ps.length, spots: 0, setImage: setImage, stop: function () {
    stop = true;
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = 0;
    try { document.removeEventListener('visibilitychange', onVis); } catch (e) { /* 略過 */ }
  } };
  tcSt.emb = st;
  try { document.addEventListener('visibilitychange', onVis); } catch (e2) { /* 略過 */ }
  kick();
}

// (舊)兩側各 3 位 Q 版路人(pp_* 隨機變體);右側預設翻轉朝左。呼吸動畫交給 CSS
function tcUnits(side) {
  var box = tcEl('div', 'tc-units tc-units-' + side.toLowerCase()), fams = TC_UNITS[side], i, v, url, wrap, img;
  for (i = 0; i < fams.length; i++) {
    v = 1 + Math.floor(Math.random() * 6);
    url = tcUrl('pp_' + fams[i] + '_' + v) || tcUrl('pp_' + fams[i] + '_1');
    if (!url) continue;
    wrap = tcEl('div', 'tc-unit' + (side === 'R' && TC_FLIP_R ? ' tc-flip' : ''));
    wrap.style.animationDelay = (i * 0.45 + (side === 'R' ? 0.2 : 0)).toFixed(2) + 's';
    img = tcEl('img');
    img.alt = '';
    img.src = url;
    wrap.appendChild(img);
    box.appendChild(wrap);
  }
  return box;
}

function tcPanelBuild() {
  var panel = tcEl('div', 'tc-panel'), card = tcEl('div', 'tc-card'), row;
  panel.hidden = true;
  tcSt.list = tcEl('div', 'tc-srv-list');
  tcSt.hint = tcEl('div', 'tc-hint', '');
  tcSt.big = tcBtn('開始遊戲', 'tc-btn-big', tcStartGame);
  tcSt.clrBtn = tcBtn(TC_CLR_TEXT, 'tc-btn tc-btn-danger', tcClear);
  row = tcEl('div', 'tc-row');
  row.appendChild(tcSt.clrBtn);
  tcSt.msg = tcEl('div', 'tc-msg', '');
  card.appendChild(tcEl('div', 'tc-h', '選擇伺服器'));
  card.appendChild(tcSt.list);
  card.appendChild(tcSt.hint);
  card.appendChild(tcSt.big);
  card.appendChild(row);
  card.appendChild(tcSt.msg);
  panel.appendChild(card);
  tcSt.panel = panel;
  return panel;
}

function tcOnTap() { if (tcSt && !tcSt.started) tcStart(); }

// 點任意處 → 銀白淡閃(0.4 秒;減少動態時略過)→ 選伺服器畫面
function tcStart() {
  if (!tcSt || tcSt.started) return;
  tcSt.started = true;
  if (tcReduced()) { tcToServers(); return; }
  tcSt.root.classList.add('tc-flash-on');
  setTimeout(tcToServers, TC_FLASH_MS);
}

function tcToServers() {
  if (!tcSt) return;
  tcSt.root.classList.remove('tc-flash-on');
  tcSt.root.classList.add('tc-srv-on');
  tcSt.panel.hidden = false;
  tcRenderAll();
  tcRefresh();
}

// 讀各伺服器(槽)摘要:使用中槽從 localStorage 進度鍵;其餘從 saveslots 的 meta(savesListMeta)。讀不到 = null(尚未建立角色)
function tcLoadInfo() {
  var w = { names: {} }, active = 1, main = null, byId = {}, list = Promise.resolve(null);
  try { w = worldsGet(); active = w.active; } catch (e) { w = { names: {} }; }
  try { main = savesLsGet(SAVE_KEY_MAIN); } catch (e2) { main = null; }
  TC_SERVERS.forEach(function (s) { if (s.slot === active) byId[s.id] = tcLocalInfo(main); });
  try {
    if (typeof savesAvailable === 'function' && savesAvailable()) list = savesListMeta().then(function (x) { return x; }, function () { return null; });
  } catch (e3) { list = Promise.resolve(null); }
  return list.then(function (lst) {
    TC_SERVERS.forEach(function (s) {
      if (s.slot === active) return;
      var m = lst && lst[s.slot];
      byId[s.id] = m ? { lv: m.lv || 0, ts: m.ts || 0 } : null;
    });
    return { byId: byId, active: active };
  });
}
function tcLocalInfo(main) {
  var lv = 0, ts = 0, s;
  if (main === null || main === undefined) return null;
  try { s = JSON.parse(main); ts = +s.lastTs || 0; } catch (e) { /* 略過 */ }
  try { lv = savesSummarize(savesCapture(), -1).lv || 0; } catch (e2) { /* 略過 */ }
  return { lv: lv, ts: ts };
}

function tcRefresh() {
  return tcLoadInfo().then(function (info) {
    if (!tcSt) return;
    tcSt.info = info.byId;
    tcSt.activeSlot = info.active;
    tcRenderAll();
  }, function () {
    if (!tcSt) return;
    tcSt.info = {};
    tcRenderAll();
  });
}

function tcInfoText(srv) {
  var inf;
  if (!tcOpen(srv)) return '即將開放';
  if (!tcSt || !tcSt.info) return '讀取中…';
  inf = tcSt.info[srv.id];
  if (!inf) return '尚未建立角色';
  return inf.ts ? '最後遊玩 ' + tcTime(inf.ts) : '已建立角色';
}

function tcRenderAll() {
  var i, srv, btn, inf, cur;
  if (!tcSt || !tcSt.list) return;
  tcSt.list.innerHTML = '';
  for (i = 0; i < TC_SERVERS.length; i++) {
    srv = TC_SERVERS[i];
    btn = tcBtn('', 'tc-srv' + (srv.id === tcSt.sel ? ' tc-sel' : '') + (tcOpen(srv) ? '' : ' tc-srv-off'), tcPickFn(srv.id));
    btn.disabled = !tcOpen(srv);
    btn.appendChild(tcEl('span', 'tc-srv-id', srv.id));
    btn.appendChild(tcEl('span', 'tc-srv-name', srv.name));
    btn.appendChild(tcEl('span', 'tc-srv-info', tcInfoText(srv)));
    tcSt.list.appendChild(btn);
  }
  cur = tcCurSrv();
  inf = cur && tcSt.info ? tcSt.info[cur.id] : null;
  tcSt.clrBtn.hidden = !(cur && tcOpen(cur) && inf);
  if (tcSt.clrBtn.hidden) tcDisarm();
  tcSt.hint.textContent = !tcSt.info ? '' : (inf ? '有存檔:開始遊戲 = 繼續遊戲' : '無存檔:開始遊戲 = 新遊戲');
}

function tcPickFn(id) {
  return function () {
    if (!tcSt || !tcOpen(tcServerById(id))) return;   // 尚未開放的伺服器不可選、不寫偏好、不顯示訊息
    tcSt.sel = id;
    tcLsSet(TC_PREF_KEY, id);
    tcSay('');
    tcRenderAll();
  };
}

// 開始遊戲:目前使用中的伺服器 → 直接進遊戲;其他伺服器 → 既有 worldsEnter(切換後 reload;目前休眠)
function tcStartGame() {
  var srv = tcCurSrv(), fn;
  if (!tcSt || !srv || !tcOpen(srv)) return;
  if (srv.slot === tcSt.activeSlot) {
    fn = tcSt.fn;
    tcRemove();
    fn();
    return;
  }
  tcSay('切換伺服器中…');
  Promise.resolve().then(function () { return worldsEnter(srv.slot); }).then(function (r) {
    if (r && r.ok) return;
    tcSay(tcSwitchText(r));
  }, function () { tcSay('切換失敗'); });
}
function tcSwitchText(r) {
  var why = r && r.reason;
  if (why === 'dormant') return '切換伺服器暫未開放(多世界功能休眠中),目前仍為使用中的伺服器';
  if (why === 'corrupt') return '該伺服器存檔損毀,未切換';
  if (why === 'idb') return '儲存空間無法使用,未切換';
  return '切換未完成(' + (why || '未知') + ')';
}

// 清空紀錄(取代舊「新遊戲」與「刪除存檔」):面板內二次確認,不用瀏覽器 confirm。
// 第一次點擊 → 按鈕變紅『確定清空?再按一次』並倒數 TC_ARM_MS,逾時還原;第二次點擊才執行 worldsRemove(slot, 'restart')
// (沿用既有備份 / 失敗回報:成功 = 已備份到復原點並清空;任何失敗都如實顯示,不假裝成功)。
// 成功後以全新存檔正常開始遊戲:使用中伺服器的清空會 reload 頁面,故先留旗標,重載後 titleCoverGate 直接 boot;不會 reload 的環境直接 boot。
// 退路:存檔損毀時『開始遊戲』直接進使用中伺服器不讀快照,不受影響;清空失敗(例如無法建立復原點)會再問一次真正的 confirm,可選擇仍要清空。
var TC_CLR_TEXT = '清空紀錄';
var TC_ARM_MS = 4000;
var TC_AUTO_KEY = 'lorddomain.ui.titleAutoStart';
function tcAutoGet() {
  try { if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TC_AUTO_KEY) === '1') return true; } catch (e) { /* 略過 */ }
  return tcLsGet(TC_AUTO_KEY) === '1';
}
function tcAutoSet(on) {
  try { if (typeof sessionStorage !== 'undefined') { if (on) sessionStorage.setItem(TC_AUTO_KEY, '1'); else sessionStorage.removeItem(TC_AUTO_KEY); } } catch (e) { /* 略過 */ }
  try { if (on) localStorage.setItem(TC_AUTO_KEY, '1'); else localStorage.removeItem(TC_AUTO_KEY); } catch (e2) { /* 略過 */ }
}
function tcDisarm() {
  if (!tcSt || !tcSt.clrBtn) return;
  if (tcSt.armTimer) { clearTimeout(tcSt.armTimer); tcSt.armTimer = 0; }
  if (!tcSt.armed) return;
  tcSt.armed = false;
  tcSt.clrBtn.textContent = TC_CLR_TEXT;
  tcSt.clrBtn.className = 'tc-btn tc-btn-danger';
  tcSay('');
}
function tcClear() {
  var srv = tcCurSrv();
  if (!tcSt || !srv || !tcOpen(srv) || tcSt.busy) return;
  if (!tcSt.armed) {
    tcSt.armed = true;
    tcSt.clrBtn.textContent = '確定清空?再按一次';
    tcSt.clrBtn.className = 'tc-btn tc-btn-armed';
    tcSay('再按一次才會清空「' + srv.id + ' ' + srv.name + '」的紀錄(會先備份到復原點)');
    tcSt.armTimer = setTimeout(tcDisarm, TC_ARM_MS);
    return;
  }
  tcDisarm();
  tcDoClear(srv);
}
function tcClearText(r) {
  var why = r && r.reason;
  if (why === 'declined') return '已取消,紀錄未清空';
  if (why === 'nobackup') return '無法建立復原點,紀錄未清空';
  if (why === 'idb' || why === 'unavailable' || why === 'apply') return '儲存空間無法使用,紀錄未清空';
  if (why === 'legacy') return '舊存檔還在轉移中,請重新開啟 App 後再試';
  return '清空未完成(' + (why || '未知') + '),紀錄未清空';
}
function tcDoClear(srv) {
  var asks = 0, isActive = srv.slot === tcSt.activeSlot, ask = function (m) { asks++; return asks === 1 ? true : tcConfirm(m); };
  tcSt.busy = true;
  tcSay('清空中…');
  if (isActive) tcAutoSet(true);
  Promise.resolve().then(function () { return worldsRemove(srv.slot, 'restart', { confirm: ask }); }).then(function (r) {
    if (tcSt) tcSt.busy = false;
    if (!r || !r.ok) { tcAutoSet(false); tcSay(tcClearText(r)); return tcRefresh(); }
    if (isActive && tcWillReload()) { tcSay('紀錄已清空,重新載入中…'); return; }
    tcAutoSet(false);
    tcStartGame();
  }, function () { if (tcSt) tcSt.busy = false; tcAutoSet(false); tcSay('清空失敗,紀錄未清空'); });
}
function tcWillReload() {
  try { return typeof savesReloadFn === 'function' || (typeof location !== 'undefined' && !!location && typeof location.reload === 'function'); } catch (e) { return false; }
}

function tcRemove() {
  if (!tcSt) return;
  try { if (tcSt.root && tcSt.root.parentNode) tcSt.root.parentNode.removeChild(tcSt.root); } catch (e) { /* 略過 */ }
  try { document.removeEventListener('keydown', tcSt.keyFn); } catch (e2) { /* 略過 */ }
  try { if (tcSt.emb) tcSt.emb.stop(); } catch (e3) { /* 略過 */ }
  try { if (tcSt.armTimer) clearTimeout(tcSt.armTimer); } catch (e4) { /* 略過 */ }
  tcSt = null;
}

// 掛點:包住 saveslots.js 的 worldsStartup(存檔遷移 / 切換復原完成後才進封面)
(function tcHookStartup() {
  if (typeof worldsStartup !== 'function') return;
  var orig = worldsStartup;
  worldsStartup = function (fn) { orig(function () { titleCoverGate(fn); }); };
})();
