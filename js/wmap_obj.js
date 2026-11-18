// js/wmap_obj.js — 六邊形大地圖「物件層」原型:① 精靈取得(圖集 + 程式備用) ② 裝飾散布(烘焙進地面層) ③ 資源地物件(數量 / 高度隨等級) ④ 等級旗標(一眼辨識等級)。
// 純資料決定:全由 種子 + 格座標 雜湊決定(不存存檔、不讀時間、不用 Math.random)。ES2017,不用 ?. ??;UTF-8 + CRLF。
// 載入順序:wmap_art.js、wmap_res.js 之後、wmap_view.js 之前或之後皆可(view 以 typeof 檢查掛鉤,沒有本檔就完全不變)。命名:全域一律 wmapObj* / WMAP_OBJ*。
//
// ───────── 公開 API ─────────
//   WMAP_OBJ_CFG                       可調常數表(資源數量 / 縮放 / 夾限 / 裝飾密度 / 旗標);改這裡即可,不用動程式
//   WMAP_OBJ_RES                       資源種類 → 部件序列(可換表:使用者專屬圖到了,只改這張表 + 圖集索引)
//   wmapObjResCount(lv) → n            Lv 的物件數   n = 1 + floor((lv − 1) / countStep)(Lv1 = 1、Lv10 = 4)
//   wmapObjResScale(lv) → s            Lv 的縮放     s = scaleBase + scaleStep × lv(Lv1 0.92、Lv10 1.55)
//   wmapObjResParts(ty, lv) → [{name, gx, gy, sc, flip}]   資源格內的物件(地面等向座標偏移 gx / gy、已含夾限的縮放)
//   wmapObjFlagInfo(lv) → {tier, n, col, col2}   等級旗標:Lv1~3 麻布 1~3 面、Lv4~6 靛藍 1~3 面、Lv7~9 朱紅 1~3 面、Lv10 金旗 3 面 + 頂飾
//   wmapObjDecorOk(gi) → bool / wmapObjDecorOf(gi) → [{name, u, v, sc, flip, dep}]   裝飾:該格是否可放、放哪些(確定性)
//   wmapObjSpriteMeta(name) → {lw, lh, ax, ay, src:'atlas'|'proc'} | null    精靈邏輯尺寸(格寬 256 單位);圖集未載入 / 缺圖 → 程式備用(src:'proc')
//   wmapObjScaled(name) → {c, lw, lh, ax, ay, tk} | null   依目前格寬 × DPR 預縮的畫布(無 document 時回 null)
//   wmapObjDraw(g, G, name, fx, fy, scale, flip)            把精靈畫在世界座標腳點 (fx, fy)
//   wmapObjBakeDecor(g, G, x0, y0, x1, y1)                 烘焙掛鉤:地面層(含道路 / 資源地面)之後、物件層之前
//   wmapObjResItems(G, x0, y0, x1, y1) → items / wmapObjDrawItem(g, G, it)   物件層掛鉤(併入 wmapBakeObjects 的深度排序)
//   wmapObjReplacesScatter() → bool    true = 資源格改用本層物件,不畫舊的程式散布物件 ro_*(WMAP_OBJ_CFG.replaceScatter)
//   wmapObjKickLoad()                  載入圖集;完成後清分塊重烘;失敗保持程式備用
//   wmapObjStats() → {...}             量測:裝飾 / 資源物件 / 旗標的物件數與烘焙累計毫秒、貼圖記憶體

var WMAP_OBJ_CFG = {
  on: true,                 // 總開關(false = 全部不畫,畫面與沒有本檔相同)
  replaceScatter: true,     // 資源格用本層物件取代舊散布物件
  countStep: 3,             // n = 1 + floor((lv − 1) / countStep)
  scaleBase: 0.85, scaleStep: 0.07,   // s = base + step × lv
  sizeMul: 1.35,            // 資源物件整體大小倍率(疊在等級縮放上)
  maxWidthCells: 1.3,       // 單一物件寬度上限(格寬倍數);夾限用,避免 Lv10 蓋到鄰格太多
  slots: [                  // n = 1~4 的站位(地面等向座標 gx、gy,鄰格距離 = 1;依 gy 由後到前)
    [[0, 0.02]],
    [[-0.2, -0.05], [0.2, 0.12]],
    [[0, -0.2], [-0.27, 0.12], [0.27, 0.12]],
    [[-0.2, -0.18], [0.2, -0.12], [-0.22, 0.17], [0.2, 0.2]]
  ],
  decor: {                  // 裝飾:每格期望件數 n + 候選 [名稱, 權重];沒列的地面不放
    on: true, scale: 0.62, scaleJit: 0.22, rIn: 0.3, rOut: 0.42, maxPerCell: 3,
    ground: {
      grass: { n: 0.5, kinds: [['bush', 3], ['broad', 2], ['pine', 1]] },
      wood: { n: 1.7, kinds: [['pine', 4], ['broad', 3], ['bush', 2], ['grove', 1]] },
      dirt: { n: 0.25, kinds: [['bush', 1], ['pebble', 2]] },
      rock: { n: 0.2, kinds: [['pebble', 3], ['bush', 1]] },
      sand: { n: 0.2, kinds: [['pebble', 1], ['dry', 2]] }
    }
  },
  flag: {                   // 等級旗標(螢幕尺寸隨格寬等比,格寬 56 時桿高約 29 px)
    on: true, gx: -0.28, gy: 0.28, pole: 0.5, pw: 0.23, ph: 0.13, ink: '#3a2a14',
    tiers: [
      { lo: 1, hi: 3, col: '#efe6cf', col2: '#cdbd94' },   // 麻布
      { lo: 4, hi: 6, col: '#2f56b8', col2: '#1f3a82' },   // 靛藍
      { lo: 7, hi: 9, col: '#d23a22', col2: '#962614' },   // 朱紅
      { lo: 10, hi: 10, col: '#f2b822', col2: '#b07d10' }  // 金(Lv10:3 面 + 頂飾)
    ]
  },
  hillTall: [1, 2, 6, 8, 9, 10, 11, 12]   // 這些地形種類(WG.k)是「高物件」:本格後方(N / NE / NW)有它時不放裝飾(避免樹冠被高物件蓋住的深度錯誤)
};
// 資源種類 → 部件序列(第 i 個物件取 parts[i % parts.length];sc = 部件縮放倍數;h = 純文件用)。專屬圖到了 → 圖集加名稱、這張表改名稱即可
var WMAP_OBJ_RES = {
  farm: [{ name: 'hay', sc: 1 }, { name: 'hay', sc: 1 }, { name: 'hay', sc: 1 }, { name: 'hay', sc: 1 }],
  lumber: [{ name: 'broad', sc: 1 }, { name: 'pine', sc: 1 }, { name: 'grove', sc: 1 }, { name: 'pine', sc: 1 }],
  quarry: [{ name: 'rockpile', sc: 1 }, { name: 'rockpile', sc: 1 }, { name: 'rockpile', sc: 1 }, { name: 'rockpile', sc: 1 }],
  mine: [{ name: 'hill', sc: 0.7 }, { name: 'cart', sc: 1 }, { name: 'cart', sc: 1 }, { name: 'cart', sc: 1 }],
  hunt: [{ name: 'tent', sc: 1 }, { name: 'bush', sc: 1 }, { name: 'tent', sc: 1 }, { name: 'bush', sc: 1 }]
};
// 程式備用 / 程式精靈的邏輯尺寸(圖集有同名時以圖集為準);ay = 腳點(從圖頂算)
var WMAP_OBJ_PROC = {
  pine: { lw: 100, lh: 130 }, broad: { lw: 110, lh: 120 }, bush: { lw: 90, lh: 66 }, grove: { lw: 130, lh: 132 }, hill: { lw: 230, lh: 160 },
  hay: { lw: 64, lh: 76 }, rockpile: { lw: 96, lh: 66 }, cart: { lw: 80, lh: 60 }, tent: { lw: 84, lh: 86 }, pebble: { lw: 34, lh: 20 }, dry: { lw: 36, lh: 28 }
};
var WMAP_OBJ = { RES: 1.5, st: 0, meta: null, img: null, base: 'assets/wmap/obj/', proc: {}, sc: { key: '', m: {} }, dc: { wg: null, res: null, m: {} }, rc: { res: null, m: {} }, timer: 0,
  st_decor: 0, st_res: 0, st_flag: 0, n_decor: 0, n_res: 0, n_flag: 0, ms_decor: 0, ms_res: 0, ms_flag: 0, block: null };

// ───────── 純函式:等級表 ─────────
function wmapObjResCount(lv) { var n = 1 + Math.floor((lv - 1) / WMAP_OBJ_CFG.countStep); return n < 1 ? 1 : (n > 4 ? 4 : n); }
function wmapObjResScale(lv) { return WMAP_OBJ_CFG.scaleBase + WMAP_OBJ_CFG.scaleStep * lv; }
function wmapObjFlagInfo(lv) {
  var T = WMAP_OBJ_CFG.flag.tiers, i, t;
  for (i = 0; i < T.length; i++) { t = T[i]; if (lv >= t.lo && lv <= t.hi) return { tier: i, n: t.hi === t.lo ? 3 : lv - t.lo + 1, col: t.col, col2: t.col2 }; }
  return { tier: 0, n: 1, col: T[0].col, col2: T[0].col2 };
}
function wmapObjH01(gi, salt) { return wmGenHash01(WMAP.seed, gi, salt); }
function wmapObjGroundToUV(gx, gy) { return { du: gx / 1.7320508 + gy, dv: gy - gx / 1.7320508 }; }
function wmapObjResParts(ty, lv, gi) {   // gi 只用來決定翻轉(確定性);省略 = 0
  var tbl = WMAP_OBJ_RES[ty] || WMAP_OBJ_RES.lumber, n = wmapObjResCount(lv), slots = WMAP_OBJ_CFG.slots[n - 1], s = wmapObjResScale(lv), out = [], i, pt, meta, sc, cap;
  for (i = 0; i < n; i++) {
    pt = tbl[i % tbl.length]; sc = s * pt.sc * WMAP_OBJ_CFG.sizeMul; meta = wmapObjSpriteMeta(pt.name);
    if (meta) { cap = WMAP_OBJ_CFG.maxWidthCells * 256 / meta.lw; if (sc > cap) sc = cap; }   // 格寬上限夾限
    out.push({ name: pt.name, gx: slots[i][0], gy: slots[i][1], sc: sc, flip: gi !== undefined && gi >= 0 ? wmapObjH01(gi, 610 + i) < 0.5 : false });
  }
  return out;
}

// ───────── 精靈 ─────────
function wmapObjSpriteMeta(name) {
  var m = WMAP_OBJ.meta, s = m && m.sprites ? m.sprites[name] : null, p;
  if (s && WMAP_OBJ.st === 2) return { lw: s.lw, lh: s.lh, ax: s.ax, ay: s.ay, src: 'atlas', r: s };
  p = WMAP_OBJ_PROC[name];
  if (!p) return null;
  return { lw: p.lw, lh: p.lh, ax: p.lw / 2, ay: p.lh * 0.97, src: 'proc' };
}
function wmapObjCv(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function wmapObjInk() { return '#3a2a14'; }
function wmapObjProcDraw(name, g, w, h) {   // 在 w × h(= 邏輯尺寸 × RES)畫布上畫程式精靈;腳點 = 底邊中心上方 3%
  var ink = wmapObjInk(), lw = Math.max(1.4, w * 0.028), cx = w / 2, by = h * 0.97, i, yy;
  g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = ink;
  function blob(x, y, rx, ry, f1, f2) { g.fillStyle = f1; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = f2; g.beginPath(); g.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.5, ry * 0.45, 0, 0, 7); g.fill(); }
  function rock(x, y, rw, rh, f1, f2) { g.fillStyle = f1; g.beginPath(); g.moveTo(x - rw / 2, y); g.lineTo(x - rw * 0.42, y - rh * 0.62); g.lineTo(x - rw * 0.1, y - rh); g.lineTo(x + rw * 0.3, y - rh * 0.88); g.lineTo(x + rw / 2, y - rh * 0.3); g.lineTo(x + rw * 0.4, y); g.closePath(); g.fill(); g.stroke(); g.fillStyle = f2; g.beginPath(); g.moveTo(x + rw * 0.02, y - rh * 0.95); g.lineTo(x + rw * 0.3, y - rh * 0.88); g.lineTo(x + rw / 2, y - rh * 0.3); g.lineTo(x + rw * 0.4, y); g.lineTo(x + rw * 0.08, y - rh * 0.2); g.closePath(); g.fill(); }
  if (name === 'pine') {
    g.fillStyle = '#8a5a2a'; g.fillRect(cx - w * 0.06, by - h * 0.16, w * 0.12, h * 0.16); g.strokeRect(cx - w * 0.06, by - h * 0.16, w * 0.12, h * 0.16);
    for (i = 0; i < 3; i++) { g.fillStyle = i & 1 ? '#2f8a3a' : '#3fa447'; yy = by - h * (0.16 + 0.2 * (2 - i)); g.beginPath(); g.moveTo(cx, yy - h * 0.3); g.lineTo(cx + w * (0.3 + i * 0.12), yy + h * 0.1); g.lineTo(cx - w * (0.3 + i * 0.12), yy + h * 0.1); g.closePath(); g.fill(); g.stroke(); }
  } else if (name === 'broad') {
    g.fillStyle = '#8a5a2a'; g.fillRect(cx - w * 0.07, by - h * 0.3, w * 0.14, h * 0.3); g.strokeRect(cx - w * 0.07, by - h * 0.3, w * 0.14, h * 0.3);
    blob(cx, by - h * 0.6, w * 0.42, h * 0.38, '#69b83a', '#9ad24a');
  } else if (name === 'bush') {
    blob(cx, by - h * 0.4, w * 0.45, h * 0.4, '#69b83a', '#9ad24a');
  } else if (name === 'grove') {
    wmapObjProcDraw('pine', g, w, h); g.save(); g.translate(w * 0.2, h * 0.0); wmapObjProcDraw('broad', g, w * 0.7, h * 0.8); g.restore();
  } else if (name === 'hill') {
    g.fillStyle = '#bfae88'; g.beginPath(); g.moveTo(cx - w * 0.5, by); g.lineTo(cx - w * 0.15, by - h * 0.7); g.lineTo(cx, by - h * 0.96); g.lineTo(cx + w * 0.22, by - h * 0.72); g.lineTo(cx + w * 0.5, by); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8fb84a'; g.beginPath(); g.moveTo(cx - w * 0.5, by); g.lineTo(cx - w * 0.3, by - h * 0.22); g.lineTo(cx + w * 0.3, by - h * 0.25); g.lineTo(cx + w * 0.5, by); g.closePath(); g.fill(); g.stroke();
  } else if (name === 'hay') {
    g.fillStyle = '#d9b44a'; g.beginPath(); g.moveTo(cx - w * 0.38, by); g.quadraticCurveTo(cx - w * 0.42, by - h * 0.5, cx, by - h * 0.95); g.quadraticCurveTo(cx + w * 0.42, by - h * 0.5, cx + w * 0.38, by); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#8a6a1c'; g.lineWidth = lw * 0.8; for (i = 1; i < 4; i++) { g.beginPath(); g.moveTo(cx - w * (0.4 - i * 0.07), by - h * i * 0.2); g.lineTo(cx + w * (0.4 - i * 0.07), by - h * i * 0.2); g.stroke(); }
  } else if (name === 'rockpile') {
    rock(cx - w * 0.2, by, w * 0.5, h * 0.7, '#c9c2ae', '#a49d8a'); rock(cx + w * 0.22, by, w * 0.45, h * 0.55, '#d4cdb9', '#aaa390'); rock(cx, by - h * 0.05, w * 0.36, h * 1.0, '#ddd6c2', '#b3ac98');
  } else if (name === 'cart') {
    g.fillStyle = '#8a5a2a'; g.beginPath(); g.moveTo(cx - w * 0.4, by - h * 0.5); g.lineTo(cx + w * 0.4, by - h * 0.5); g.lineTo(cx + w * 0.3, by - h * 0.15); g.lineTo(cx - w * 0.3, by - h * 0.15); g.closePath(); g.fill(); g.stroke();
    for (i = 0; i < 4; i++) { g.fillStyle = i & 1 ? '#6b5a4a' : '#4a3b30'; g.beginPath(); g.arc(cx - w * 0.27 + i * w * 0.18, by - h * 0.58, w * 0.1, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = '#f2b830'; for (i = 0; i < 3; i++) { g.beginPath(); g.arc(cx - w * 0.18 + i * w * 0.18, by - h * 0.62, w * 0.03, 0, 7); g.fill(); }
    for (i = 0; i < 2; i++) { g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(cx - w * 0.22 + i * w * 0.44, by - h * 0.1, h * 0.14, 0, 7); g.fill(); g.stroke(); }
  } else if (name === 'tent') {
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.moveTo(cx - w * 0.45, by); g.lineTo(cx, by - h * 0.95); g.lineTo(cx + w * 0.45, by); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#c23c26'; g.beginPath(); g.moveTo(cx - w * 0.14, by - h * 0.7); g.lineTo(cx, by - h * 0.95); g.lineTo(cx + w * 0.14, by - h * 0.7); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#4a3a2a'; g.beginPath(); g.moveTo(cx - w * 0.11, by); g.lineTo(cx, by - h * 0.42); g.lineTo(cx + w * 0.11, by); g.closePath(); g.fill();
  } else if (name === 'pebble') {
    rock(cx - w * 0.22, by, w * 0.36, h * 0.6, '#cfc9b8', '#a8a290'); rock(cx + w * 0.2, by, w * 0.3, h * 0.45, '#d8d2c0', '#aca694');
  } else if (name === 'dry') {
    g.strokeStyle = '#a58a3a'; g.lineWidth = lw * 1.2; for (i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * w * 0.07, by); g.quadraticCurveTo(cx + i * w * 0.12, by - h * 0.4, cx + i * w * 0.2, by - h * (0.8 - Math.abs(i) * 0.1)); g.stroke(); }
  }
}
function wmapObjProcSprite(name) {   // → {c, r(來源矩形)} | null
  var p = WMAP_OBJ.proc[name], d = WMAP_OBJ_PROC[name], c;
  if (p !== undefined) return p;
  if (!d || typeof document === 'undefined') return null;
  try { c = wmapObjCv(d.lw * WMAP_OBJ.RES, d.lh * WMAP_OBJ.RES); wmapObjProcDraw(name, c.getContext('2d'), c.width, c.height); } catch (e) { c = null; }
  p = c ? { c: c } : null; WMAP_OBJ.proc[name] = p;
  return p;
}
function wmapObjShrink(src, tw, th) {   // 縮到 tw × th(尺寸差距大時逐次減半,避免鋸齒)
  var c = src, w = src.width, h = src.height, n, g;
  while (w > tw * 2 && h > th * 2) { w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2)); n = wmapObjCv(w, h); g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, w, h); c = n; }
  n = wmapObjCv(tw, th); g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n.width, n.height);
  return n;
}
function wmapObjScaled(name) {   // 預縮:目標 px / 邏輯單位 = min(格寬 / 256 × DPR × 1.6(留給 scale ≤ 1.6 的物件), RES);畫的時候只縮小不放大
  var G = WMAP.G, key, ent, meta, tk, src, sp, sw, sh, tmp, g, r;
  if (!G || typeof document === 'undefined') return null;
  key = G.W + '|' + WMAP.dpr + '|' + WMAP_OBJ.st;
  if (WMAP_OBJ.sc.key !== key) WMAP_OBJ.sc = { key: key, m: {} };
  ent = WMAP_OBJ.sc.m[name];
  if (ent !== undefined) return ent;
  meta = wmapObjSpriteMeta(name); ent = null;
  if (meta) {
    tk = Math.min(G.W / 256 * WMAP.dpr * 1.6, WMAP_OBJ.RES);
    if (meta.src === 'atlas') {
      r = meta.r; tmp = wmapObjCv(r.w, r.h); g = tmp.getContext('2d'); g.drawImage(WMAP_OBJ.img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); src = tmp;
    } else { sp = wmapObjProcSprite(name); src = sp ? sp.c : null; }
    if (src) {
      sw = Math.max(1, Math.round(meta.lw * tk)); sh = Math.max(1, Math.round(meta.lh * tk));
      ent = { c: tk >= WMAP_OBJ.RES - 1e-6 ? src : wmapObjShrink(src, sw, sh), lw: meta.lw, lh: meta.lh, ax: meta.ax, ay: meta.ay, tk: tk };
    }
  }
  WMAP_OBJ.sc.m[name] = ent;
  return ent;
}
function wmapObjDraw(g, G, name, fx, fy, scale, flip) {
  var e = wmapObjScaled(name), k, dw, dh;
  if (!e) return false;
  k = G.W / 256 * scale; dw = e.lw * k; dh = e.lh * k;
  if (flip) { g.save(); g.translate(fx, fy); g.scale(-1, 1); g.drawImage(e.c, -e.ax * k, -e.ay * k, dw, dh); g.restore(); }
  else g.drawImage(e.c, fx - e.ax * k, fy - e.ay * k, dw, dh);
  return true;
}
function wmapObjMem() {   // 貼圖記憶體(位元組):圖集解碼 + 預縮畫布 + 程式精靈
  var n = 0, k, e, p;
  if (WMAP_OBJ.img) n += (WMAP_OBJ.img.naturalWidth || WMAP_OBJ.img.width || 0) * (WMAP_OBJ.img.naturalHeight || WMAP_OBJ.img.height || 0) * 4;
  for (k in WMAP_OBJ.sc.m) { e = WMAP_OBJ.sc.m[k]; if (e && e.c) n += e.c.width * e.c.height * 4; }
  for (k in WMAP_OBJ.proc) { p = WMAP_OBJ.proc[k]; if (p && p.c) n += p.c.width * p.c.height * 4; }
  return n;
}

// ───────── 載入 ─────────
function wmapObjKickLoad() {
  var o = WMAP_OBJ, img;
  if (o.st !== 0 || typeof fetch !== 'function' || typeof Image === 'undefined') return;
  o.st = 1;
  try {
    fetch(o.base + 'obj_atlas.json').then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (m) {
      img = new Image();
      img.onload = function () {
        o.meta = m; o.img = img; o.st = 2; o.sc = { key: '', m: {} };
        if (typeof WMAP !== 'undefined' && WMAP.on) {
          if (o.timer) return;
          o.timer = setTimeout(function () { o.timer = 0; if (!WMAP.on) return; wmapClearChunks(); WMAP.bsig = ''; wmapSchedule(); }, 120);
        }
      };
      img.onerror = function () { o.st = -1; };
      img.src = o.base + m.atlas;
    }).catch(function () { o.st = -1; });   // 缺圖 / 離線:保持程式備用,不報錯
  } catch (e) { o.st = -1; }
}
function wmapObjReplacesScatter() { return !!(WMAP_OBJ_CFG.on && WMAP_OBJ_CFG.replaceScatter); }

// ───────── 裝飾散布 ─────────
function wmapObjDecorOk(gi) {
  var WG = WMAP.WG, N = WG.size, d, nb, k, H = WMAP_OBJ_CFG.hillTall, dirs = [0, 1, 5];
  if (!WG || WG.k[gi] !== 0) return false;
  if (WG.zone && WG.zone[gi]) return false;                       // 城郊
  if (WMAP.res && WMAP.res[gi]) return false;                     // 資源格
  if (WMAP_OBJ.block && WMAP_OBJ.block(gi)) return false;         // 呼叫端禁區(例如規劃中的行軍路徑格)
  for (d = 0; d < dirs.length; d++) {                             // 後方鄰格是高物件(山 / 城池 / 資源物件)→ 不放(樹冠會被它蓋住)
    nb = wmHexNb(gi, dirs[d], N); if (nb < 0) continue;
    k = WG.k[nb];
    if (H.indexOf(k) >= 0) return false;
    if (WMAP.res && WMAP.res[nb]) return false;
  }
  return true;
}
function wmapObjDecorOf(gi) {
  var dc = WMAP_OBJ.dc, WG = WMAP.WG, N, cfg = WMAP_OBJ_CFG.decor, gt, cat, n, i, j, tot, x, nm, a, rad, gx, gy, uv, c, r, out, it;
  if (dc.wg !== WG || dc.res !== WMAP.res || dc.blk !== WMAP_OBJ.block) { dc.wg = WG; dc.res = WMAP.res; dc.blk = WMAP_OBJ.block; dc.m = {}; }
  if (dc.m[gi] !== undefined) return dc.m[gi];
  out = []; dc.m[gi] = out;
  N = WG.size;
  gt = WMAP.ground ? WMAP.ground[gi] : 'grass'; cat = cfg.ground[gt];
  if (!cat || !wmapObjDecorOk(gi)) return out;
  n = Math.floor(cat.n) + (wmapObjH01(gi, 501) < cat.n - Math.floor(cat.n) ? 1 : 0);
  if (n > cfg.maxPerCell) n = cfg.maxPerCell;
  c = gi % N; r = (gi - c) / N;
  for (i = 0; i < n; i++) {
    tot = 0; for (j = 0; j < cat.kinds.length; j++) tot += cat.kinds[j][1];
    x = wmapObjH01(gi, 510 + i) * tot; nm = cat.kinds[0][0];
    for (j = 0; j < cat.kinds.length; j++) { x -= cat.kinds[j][1]; if (x < 0) { nm = cat.kinds[j][0]; break; } }
    a = wmapObjH01(gi, 520 + i) * 6.2831853; rad = cfg.rIn + (cfg.rOut - cfg.rIn) * wmapObjH01(gi, 530 + i);
    gx = Math.cos(a) * rad; gy = Math.sin(a) * rad * 0.9;
    if (Math.abs(gy) > 0.4) gy = gy < 0 ? -0.4 : 0.4;
    uv = wmapObjGroundToUV(gx, gy);
    it = { name: nm, u: c + 0.5 + uv.du, v: r + 0.5 + uv.dv, sc: cfg.scale * (1 + cfg.scaleJit * (wmapObjH01(gi, 540 + i) - 0.5) * 2), flip: wmapObjH01(gi, 550 + i) < 0.5 };
    it.dep = it.u + it.v - 1;
    out.push(it);
  }
  out.sort(function (p, q) { return p.dep - q.dep; });
  return out;
}
function wmapObjBakeDecor(g, G, x0, y0, x1, y1) {
  var t0, cfg = WMAP_OBJ_CFG, WG = WMAP.WG, N, k, rg, c, r, gi, lst, i, it, q, list = [], m, e, hmax, n = 0;
  if (!cfg.on || !cfg.decor.on || !WG) return;
  t0 = performance.now(); N = WG.size; k = G.W / 256;
  hmax = 140 * k * (1 + cfg.decor.scaleJit);
  rg = wmapCellsInRect(G, x0, y0, x1, y1 + hmax, 0, 0);
  for (r = rg.r0; r <= rg.r1; r++) for (c = rg.c0; c <= rg.c1; c++) {
    gi = r * N + c; lst = wmapObjDecorOf(gi);
    for (i = 0; i < lst.length; i++) {
      it = lst[i]; q = wmapUV2World(G, it.u, it.v); e = wmapObjSpriteMeta(it.name); if (!e) continue;
      if (q.x - e.ax * k * it.sc > x1 || q.x + (e.lw - e.ax) * k * it.sc < x0 || q.y - e.ay * k * it.sc > y1 || q.y + (e.lh - e.ay) * k * it.sc < y0) continue;
      list.push({ it: it, x: q.x, y: q.y });
    }
  }
  list.sort(function (a, b) { return (a.it.dep - b.it.dep) || (a.it.u - b.it.u); });
  for (i = 0; i < list.length; i++) { m = list[i]; if (wmapObjDraw(g, G, m.it.name, m.x, m.y, m.it.sc, m.it.flip)) n++; }
  WMAP_OBJ.n_decor += n; WMAP_OBJ.ms_decor += performance.now() - t0; WMAP_OBJ.st_decor++;
}

// ───────── 資源地物件層 + 等級旗標(併入 wmapBakeObjects 的深度排序) ─────────
function wmapObjResOf(gi) {   // 該資源格的 {parts, flag}(快取;WMAP.res 重建時失效)
  var rc = WMAP_OBJ.rc, info;
  if (rc.res !== WMAP.res) { rc.res = WMAP.res; rc.m = {}; rc.sig = WMAP_OBJ.st; }
  if (rc.sig !== WMAP_OBJ.st) { rc.m = {}; rc.sig = WMAP_OBJ.st; }   // 圖集載入後尺寸夾限改變
  if (rc.m[gi] !== undefined) return rc.m[gi];
  info = WMAP.res[gi];
  rc.m[gi] = info ? { parts: wmapObjResParts(info.ty, info.lv, gi), flag: wmapObjFlagInfo(info.lv), lv: info.lv, ty: info.ty } : null;
  return rc.m[gi];
}
function wmapObjResItems(G, x0, y0, x1, y1) {
  var items = [], cfg = WMAP_OBJ_CFG, N, i, gi, c, r, e, p, j, uv, u, v, q, ctr, mx, my, t0, nf = 0, no = 0, f, fi;
  if (!cfg.on || !WMAP.resList || !WMAP.resList.length) return items;
  t0 = performance.now(); N = WMAP.N; mx = G.W * 1.2; my = G.W * 1.8;
  for (i = 0; i < WMAP.resList.length; i++) {
    gi = WMAP.resList[i]; c = gi % N; r = (gi - c) / N; ctr = wmapCellCenter(G, c, r);
    if (ctr.x < x0 - mx || ctr.x > x1 + mx || ctr.y < y0 - G.H || ctr.y > y1 + my) continue;
    e = wmapObjResOf(gi); if (!e) continue;
    for (j = 0; j < e.parts.length; j++) {
      p = e.parts[j]; uv = wmapObjGroundToUV(p.gx, p.gy); u = c + 0.5 + uv.du; v = r + 0.5 + uv.dv; q = wmapUV2World(G, u, v);
      items.push({ dep: u + v - 1, tie: u - v, id: gi * 8 + j, ty: 2, k: 0, name: p.name, fx: q.x, fy: q.y, sc: p.sc, flip: p.flip }); no++;
    }
    if (cfg.flag.on) {
      f = cfg.flag; uv = wmapObjGroundToUV(f.gx, f.gy); u = c + 0.5 + uv.du; v = r + 0.5 + uv.dv; q = wmapUV2World(G, u, v);
      items.push({ dep: u + v - 1 + 0.02, tie: u - v, id: gi * 8 + 7, ty: 2, k: 1, fx: q.x, fy: q.y, fl: e.flag }); nf++;
    }
  }
  WMAP_OBJ.n_res += no; WMAP_OBJ.n_flag += nf; WMAP_OBJ.ms_res += performance.now() - t0; WMAP_OBJ.st_res++;
  return items;
}
function wmapObjDrawFlag(g, G, it) {
  var f = WMAP_OBJ_CFG.flag, fl = it.fl, W = G.W, x = it.fx, y = it.fy, ph = W * f.pole, pw = W * f.pw, fh = W * f.ph, lw = Math.max(1, W * 0.022), i, yy;
  g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = f.ink;
  g.fillStyle = 'rgba(40,25,5,0.25)'; g.beginPath(); g.ellipse(x, y, W * 0.05, W * 0.02, 0, 0, 7); g.fill();
  g.fillStyle = '#7a5a36'; g.beginPath(); g.moveTo(x - lw * 0.9, y); g.lineTo(x - lw * 0.9, y - ph); g.lineTo(x + lw * 0.9, y - ph); g.lineTo(x + lw * 0.9, y); g.closePath(); g.fill(); g.stroke();
  for (i = 0; i < fl.n; i++) {
    yy = y - ph + lw + i * fh * 1.08;
    g.fillStyle = fl.col; g.beginPath(); g.moveTo(x + lw, yy); g.lineTo(x + lw + pw, yy + fh * 0.5); g.lineTo(x + lw, yy + fh); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = fl.col2; g.beginPath(); g.moveTo(x + lw, yy + fh * 0.5); g.lineTo(x + lw + pw, yy + fh * 0.5); g.lineTo(x + lw, yy + fh); g.closePath(); g.fill();
  }
  if (fl.tier === 3) { g.fillStyle = fl.col; g.beginPath(); g.arc(x, y - ph - lw, Math.max(1.6, W * 0.03), 0, 7); g.fill(); g.stroke(); }   // Lv10 金頂飾
}
function wmapObjDrawItem(g, G, it) {
  var t0 = performance.now();
  if (it.k === 1) wmapObjDrawFlag(g, G, it); else wmapObjDraw(g, G, it.name, it.fx, it.fy, it.sc, it.flip);
  WMAP_OBJ.ms_res += performance.now() - t0;
}
function wmapObjStats() {
  var o = WMAP_OBJ;
  return { atlasState: o.st, decorN: o.n_decor, resN: o.n_res, flagN: o.n_flag, decorMs: o.ms_decor, resMs: o.ms_res, decorCalls: o.st_decor, resCalls: o.st_res, memBytes: wmapObjMem() };
}
function wmapObjStatsReset() { var o = WMAP_OBJ; o.n_decor = o.n_res = o.n_flag = 0; o.ms_decor = o.ms_res = 0; o.st_decor = o.st_res = 0; }
