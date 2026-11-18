// js/wmap_obj.js — 六邊形大地圖「物件層」:① 精靈取得(兩張圖集 + 程式備用) ② 裝飾散布(烘焙進地面層) ③ 資源地物件(1 個立體大物件 + 等級縮放 / 附件) ④ 等級旗標 ⑤ 橋 / 土路貼圖。
// 純資料決定:全由 種子 + 格座標 雜湊決定(不存存檔、不讀時間、不用 Math.random)。ES2017,不用 ?. ??;UTF-8 + CRLF。
// 美術整合 2026-11-18:圖集 assets/wmap/obj/deco_atlas(樹 / 岩石 / 草叢 / 沙丘乾草叢)、res_atlas(資源地 10 款 rs_<種類>_<a|b> + 等級附件 rp_<種類>)由 tools/wmap_obj_prep.py 產生;
//   山 / 城池精靈圖在 wmap_art.js(wmapArtSprKick,由本檔 wmapObjKickLoad 一併啟動);橋 bridge.webp + 土路車轍 tex/road_rut_256.webp(misc_meta.json)在本檔。任何一張缺檔 / 載入失敗 → 該部分維持程式備用,不報錯。
// 載入順序:wmap_art.js、wmap_res.js 之後、wmap_view.js 之前或之後皆可(view 以 typeof 檢查掛鉤,沒有本檔就完全不變)。命名:全域一律 wmapObj* / WMAP_OBJ*。
//
// ───────── 公開 API ─────────
//   WMAP_OBJ_CFG                       可調常數表(資源等級視覺 / 裝飾密度 / 旗標);改這裡即可,不用動程式
//   WMAP_OBJ_RES / WMAP_OBJ_ATT        資源種類 → 主物件圖名 [a, b 款] / 等級附件圖名
//   wmapObjResTier(lv) → {s, n, i}     Lv 的視覺段:縮放 s(0.80 / 0.88 / 1.0)、附件數 n(0 / 1 / 2)、段序 i(Lv1~4 = 0、5~6 = 1、7~9 = 2、10 = 3)
//   wmapObjResCount(lv) → n            Lv 的物件數 = 1 個主物件 + 附件數(Lv1 = 1、Lv5 = 2、Lv7 = 3)
//   wmapObjResScale(lv) → s            主物件縮放 = base(0.92,露出貼圖地基)× 段縮放
//   wmapObjResParts(ty, lv, gi) → [{name, ox, oy, sc, flip, att}]   資源格內的物件:ox / oy = 相對格中心的螢幕偏移(美術單位,格寬 256)、sc = 縮放、att = 是否附件;a / b 款依格索引雜湊
//   wmapObjFlagInfo(lv) → {tier, n, col, col2}   等級旗標:Lv1~3 麻布 1~3 面、Lv4~6 靛藍 1~3 面、Lv7~9 朱紅 1~3 面、Lv10 金旗 3 面 + 頂飾
//   wmapObjDecorOk(gi) → bool / wmapObjDecorOf(gi) → [{name, u, v, sc, flip, dep}]   裝飾:該格是否可放、放哪些(確定性)
//   wmapObjSpriteMeta(name) → {lw, lh, ax, ay, res, src:'atlas'|'proc', ...} | null    精靈邏輯尺寸(格寬 256 單位);圖集未載入 / 缺圖 → 程式備用(src:'proc')
//   wmapObjScaled(name) → {c, sx, sy, sw, sh, lw, lh, ax, ay, tk} | null   依目前格寬 × DPR 取樣來源(圖集直取 / 縮小畫布;無 document 時回 null)
//   wmapObjDraw(g, G, name, fx, fy, scale, flip)            把精靈畫在世界座標腳點 (fx, fy)
//   wmapObjBakeDecor(g, G, x0, y0, x1, y1)                 烘焙掛鉤:地面層(含道路 / 資源地面)之後、物件層之前
//   wmapObjResItems(G, x0, y0, x1, y1) → items / wmapObjDrawItem(g, G, it)   物件層掛鉤(併入 wmapBakeObjects 的深度排序)
//   wmapObjBridgeDraw(g, G, br) → bool   橋:br = [c, r, 臂遮罩, …];橋圖就緒才畫並回 true(false → 呼叫端畫舊程式橋);wmapObjRoadFill(g, G, list) → bool   土路面:車轍貼圖沿三軸向鋪(false → 舊程式紋理)
//   wmapObjReplacesScatter() → bool    true = 資源格改用本層物件,不畫舊的程式散布物件 ro_*(WMAP_OBJ_CFG.replaceScatter)
//   wmapObjKickLoad()                  載入圖集 / 山城池精靈 / 橋 / 土路;完成後清分塊重烘;失敗保持程式備用
//   wmapObjStats() → {...}             量測:裝飾 / 資源物件 / 旗標的物件數與烘焙累計毫秒、貼圖記憶體;wmapObjMem() → 位元組(本檔圖集 + 預縮 + 程式精靈 + 橋 / 路)

var WMAP_OBJ_CFG = {
  on: true,                 // 總開關(false = 全部不畫,畫面與沒有本檔相同)
  replaceScatter: true,     // 資源格用本層物件取代舊散布物件
  res: {                    // 資源地物件:1 個主物件(a / b 款)+ 等級附件;等級視覺全由程式(不畫每級一張)
    base: 0.92,             // 主物件縮到 0.92 格,邊緣露出貼圖地基
    tiers: [                // Lv 段:s = 縮放、n = 附件數
      { lo: 1, hi: 4, s: 0.80, n: 0 },
      { lo: 5, hi: 6, s: 0.88, n: 1 },
      { lo: 7, hi: 9, s: 1.00, n: 2 },
      { lo: 10, hi: 10, s: 1.00, n: 2 }
    ],
    att: [                  // 附件:腳點相對格中心的偏移(美術單位)、縮放、是否水平鏡像
      { ox: 58, oy: 30, sc: 0.65, flip: false },
      { ox: -58, oy: 30, sc: 0.55, flip: true }
    ]
  },
  decor: {                  // 裝飾:每格期望件數 n + 候選 [名稱, 權重];沒列的地面不放
    on: true, scale: 0.62, scaleJit: 0.22, rIn: 0.3, rOut: 0.42, maxPerCell: 3,
    ground: {
      grass: { n: 0.5, kinds: [['tuft', 4], ['flower', 2], ['rock_a', 1], ['shrub', 1], ['bush', 1], ['broad', 1]] },
      wood: { n: 1.7, kinds: [['pine', 4], ['broad', 3], ['bush', 2], ['shrub', 2], ['grove', 1], ['tuft', 1]] },
      dirt: { n: 0.25, kinds: [['rubble', 2], ['tuft', 2], ['twigs', 1]] },
      rock: { n: 0.2, kinds: [['rock_a', 3], ['rock_b', 2], ['rubble', 3]] },
      sand: { n: 0.3, kinds: [['dune_a', 3], ['dune_b', 2], ['dune_c', 1], ['dune_d', 1], ['dry', 2], ['dry_b', 1], ['twigs', 1], ['twigs_b', 1], ['stones', 2], ['stones_b', 1]] }
    }
  },
  flag: {                   // 等級旗標(螢幕尺寸隨格寬等比,格寬 56 時桿高約 18 px);插在主物件左側尖角附近
    on: true, gx: -0.36, gy: 0.04, pole: 0.32, pw: 0.15, ph: 0.085, ink: '#3a2a14',
    tiers: [
      { lo: 1, hi: 3, col: '#efe6cf', col2: '#cdbd94' },   // 麻布
      { lo: 4, hi: 6, col: '#2f56b8', col2: '#1f3a82' },   // 靛藍
      { lo: 7, hi: 9, col: '#d23a22', col2: '#962614' },   // 朱紅
      { lo: 10, hi: 10, col: '#f2b822', col2: '#b07d10' }  // 金(Lv10:3 面 + 頂飾)
    ]
  },
  road: { tile: 0.5 },      // 土路車轍貼圖一張涵蓋的地面單位(1 = 鄰格距離;貼圖兩對車轍相距 0.42 張寬,路面半寬 0.2 → 0.5 讓車轍落在路面中線兩側 ±0.1)
  hillTall: [1, 2, 6, 8, 9, 10, 11, 12]   // 這些地形種類(WG.k)是「高物件」:本格後方(N / NE / NW)有它時不放裝飾(避免樹冠被高物件蓋住的深度錯誤)
};
// 資源種類 → 主物件圖名([a 款, b 款];依格索引雜湊)與等級附件圖名。圖集缺 → 程式備用(WMAP_OBJ_PROC 的 rs_* / rp_*)
var WMAP_OBJ_RES = {
  farm: ['rs_farm_a', 'rs_farm_b'], mine: ['rs_mine_a', 'rs_mine_b'], hunt: ['rs_hunt_a', 'rs_hunt_b'],
  lumber: ['rs_lumber_a', 'rs_lumber_b'], quarry: ['rs_quarry_a', 'rs_quarry_b']
};
var WMAP_OBJ_ATT = { farm: 'rp_farm', mine: 'rp_mine', hunt: 'rp_hunt', lumber: 'rp_lumber', quarry: 'rp_quarry' };
// 程式備用 / 程式精靈的邏輯尺寸(圖集有同名時以圖集為準);as = 借用別名的畫法;res = 程式精靈解析度(每單位像素,預設 RES);rs = 資源地組合畫法
var WMAP_OBJ_PROC = {
  pine: { lw: 100, lh: 130 }, broad: { lw: 110, lh: 120 }, bush: { lw: 90, lh: 66 }, grove: { lw: 130, lh: 132 }, hill: { lw: 230, lh: 160 },
  hay: { lw: 64, lh: 76 }, rockpile: { lw: 96, lh: 66 }, cart: { lw: 80, lh: 60 }, tent: { lw: 84, lh: 86 }, pebble: { lw: 34, lh: 20 }, dry: { lw: 36, lh: 28 },
  rock_a: { lw: 104, lh: 72, as: 'rockpile' }, rock_b: { lw: 84, lh: 90, as: 'rockpile' }, rubble: { lw: 100, lh: 50, as: 'pebble' },
  tuft: { lw: 70, lh: 48, as: 'bush' }, shrub: { lw: 70, lh: 52, as: 'bush' }, flower: { lw: 56, lh: 40, as: 'bush' }, reeds: { lw: 50, lh: 80, as: 'dry' }, dry_b: { lw: 36, lh: 28, as: 'dry' },
  rs_farm_a: { lw: 257, lh: 170, res: 0.75, rs: 'farm' }, rs_farm_b: { lw: 257, lh: 170, res: 0.75, rs: 'farm' },
  rs_mine_a: { lw: 257, lh: 170, res: 0.75, rs: 'mine' }, rs_mine_b: { lw: 257, lh: 170, res: 0.75, rs: 'mine' },
  rs_hunt_a: { lw: 257, lh: 170, res: 0.75, rs: 'hunt' }, rs_hunt_b: { lw: 257, lh: 170, res: 0.75, rs: 'hunt' },
  rs_lumber_a: { lw: 257, lh: 170, res: 0.75, rs: 'lumber' }, rs_lumber_b: { lw: 257, lh: 170, res: 0.75, rs: 'lumber' },
  rs_quarry_a: { lw: 257, lh: 170, res: 0.75, rs: 'quarry' }, rs_quarry_b: { lw: 257, lh: 170, res: 0.75, rs: 'quarry' },
  rp_farm: { lw: 100, lh: 100, res: 0.75, as: 'hay' }, rp_mine: { lw: 100, lh: 100, res: 0.75, as: 'cart' }, rp_hunt: { lw: 100, lh: 100, res: 0.75, as: 'bush' },
  rp_lumber: { lw: 100, lh: 100, res: 0.75, as: 'dry' }, rp_quarry: { lw: 100, lh: 100, res: 0.75, as: 'pebble' }
};
var WMAP_OBJ_ATLAS = ['deco_atlas', 'res_atlas'];   // 本檔載入的圖集(assets/wmap/obj/<名>.json + .webp)
var WMAP_OBJ = { RES: 1.5, st: 0, ver: 0, atl: {}, idx: {}, nFail: 0, base: 'assets/wmap/obj/', texBase: 'assets/wmap/tex/', misc: { bridge: null, road: null, st: 0 },
  sc: { key: '', m: {} }, proc: {}, dc: { wg: null, res: null, m: {} }, rc: { res: null, m: {} }, timer: 0,
  st_decor: 0, st_res: 0, st_flag: 0, n_decor: 0, n_res: 0, n_flag: 0, ms_decor: 0, ms_res: 0, ms_flag: 0, block: null };

// ───────── 純函式:等級表 ─────────
function wmapObjResTier(lv) {
  var T = WMAP_OBJ_CFG.res.tiers, i, t;
  for (i = 0; i < T.length; i++) { t = T[i]; if (lv >= t.lo && lv <= t.hi) return { s: t.s, n: t.n, i: i }; }
  t = lv < T[0].lo ? T[0] : T[T.length - 1];
  return { s: t.s, n: t.n, i: lv < T[0].lo ? 0 : T.length - 1 };
}
function wmapObjResCount(lv) { return 1 + wmapObjResTier(lv).n; }
function wmapObjResScale(lv) { return WMAP_OBJ_CFG.res.base * wmapObjResTier(lv).s; }
function wmapObjFlagInfo(lv) {
  var T = WMAP_OBJ_CFG.flag.tiers, i, t;
  for (i = 0; i < T.length; i++) { t = T[i]; if (lv >= t.lo && lv <= t.hi) return { tier: i, n: t.hi === t.lo ? 3 : lv - t.lo + 1, col: t.col, col2: t.col2 }; }
  return { tier: 0, n: 1, col: T[0].col, col2: T[0].col2 };
}
function wmapObjH01(gi, salt) { return wmGenHash01(WMAP.seed, gi, salt); }
function wmapObjGroundToUV(gx, gy) { return { du: gx / 1.7320508 + gy, dv: gy - gx / 1.7320508 }; }
function wmapObjResParts(ty, lv, gi) {   // gi 只用來決定 a / b 款(確定性);省略 = a 款
  var tbl = WMAP_OBJ_RES[ty] || WMAP_OBJ_RES.lumber, tier = wmapObjResTier(lv), cfg = WMAP_OBJ_CFG.res, out = [], v = gi !== undefined && gi >= 0 && wmapObjH01(gi, 610) < 0.5 ? 1 : 0, i, a;
  out.push({ name: tbl[v % tbl.length], ox: 0, oy: 0, sc: cfg.base * tier.s, flip: false, att: false });
  for (i = 0; i < tier.n && i < cfg.att.length; i++) { a = cfg.att[i]; out.push({ name: WMAP_OBJ_ATT[ty] || WMAP_OBJ_ATT.farm, ox: a.ox, oy: a.oy, sc: a.sc, flip: !!a.flip, att: true }); }
  return out;
}

// ───────── 精靈 ─────────
function wmapObjSpriteMeta(name) {
  var a = WMAP_OBJ.idx[name], s = a && a.meta && a.meta.sprites ? a.meta.sprites[name] : null, p;
  if (s) return { lw: s.lw, lh: s.lh, ax: s.ax, ay: s.ay, res: a.meta.res || WMAP_OBJ.RES, src: 'atlas', r: s, img: a.img };
  p = WMAP_OBJ_PROC[name];
  if (!p) return null;
  return { lw: p.lw, lh: p.lh, ax: p.lw / 2, ay: p.lh * 0.97, res: p.res || WMAP_OBJ.RES, src: 'proc' };
}
function wmapObjCv(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function wmapObjInk() { return '#3a2a14'; }
function wmapObjProcDraw(name, g, w, h) {   // 在 w × h(= 邏輯尺寸 × 解析度)畫布上畫程式精靈;腳點 = 底邊中心上方 3%
  var ink = wmapObjInk(), lw = Math.max(1.4, w * 0.028), cx = w / 2, by = h * 0.97, i, yy, d = WMAP_OBJ_PROC[name];
  if (d && d.as) { wmapObjProcDraw(d.as, g, w, h); return; }
  g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = ink;
  function blob(x, y, rx, ry, f1, f2) { g.fillStyle = f1; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = f2; g.beginPath(); g.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.5, ry * 0.45, 0, 0, 7); g.fill(); }
  function rock(x, y, rw, rh, f1, f2) { g.fillStyle = f1; g.beginPath(); g.moveTo(x - rw / 2, y); g.lineTo(x - rw * 0.42, y - rh * 0.62); g.lineTo(x - rw * 0.1, y - rh); g.lineTo(x + rw * 0.3, y - rh * 0.88); g.lineTo(x + rw / 2, y - rh * 0.3); g.lineTo(x + rw * 0.4, y); g.closePath(); g.fill(); g.stroke(); g.fillStyle = f2; g.beginPath(); g.moveTo(x + rw * 0.02, y - rh * 0.95); g.lineTo(x + rw * 0.3, y - rh * 0.88); g.lineTo(x + rw / 2, y - rh * 0.3); g.lineTo(x + rw * 0.4, y); g.lineTo(x + rw * 0.08, y - rh * 0.2); g.closePath(); g.fill(); }
  function sub(nm, x, y, sw, sh) { var q = WMAP_OBJ_PROC[nm]; g.save(); g.translate(x - sw / 2, y - sh * 0.97); wmapObjProcDraw(nm, g, sw, sh); g.restore(); return q; }
  if (d && d.rs) {   // 資源地缺圖:土台 + 該種類的 2~3 個小物(寬 w = 257 單位 × res)
    g.fillStyle = { farm: '#a3c05a', mine: '#9a8672', hunt: '#c9b27a', lumber: '#79a64a', quarry: '#a7a090' }[d.rs] || '#a3c05a';
    g.beginPath(); g.ellipse(cx, h * 0.72, w * 0.48, h * 0.26, 0, 0, 7); g.fill(); g.stroke();
    if (d.rs === 'farm') { sub('hay', cx - w * 0.2, h * 0.7, w * 0.26, h * 0.5); sub('hay', cx + w * 0.02, h * 0.78, w * 0.26, h * 0.5); sub('hay', cx + w * 0.24, h * 0.68, w * 0.26, h * 0.5); }
    else if (d.rs === 'mine') { sub('hill', cx - w * 0.05, h * 0.74, w * 0.7, h * 0.7); sub('cart', cx + w * 0.2, h * 0.84, w * 0.3, h * 0.36); }
    else if (d.rs === 'hunt') { sub('tent', cx - w * 0.08, h * 0.76, w * 0.36, h * 0.62); sub('bush', cx + w * 0.26, h * 0.8, w * 0.26, h * 0.3); }
    else if (d.rs === 'lumber') { sub('pine', cx - w * 0.22, h * 0.72, w * 0.26, h * 0.7); sub('broad', cx + w * 0.02, h * 0.78, w * 0.3, h * 0.6); sub('pine', cx + w * 0.26, h * 0.7, w * 0.24, h * 0.62); }
    else { sub('rockpile', cx - w * 0.14, h * 0.76, w * 0.38, h * 0.5); sub('rockpile', cx + w * 0.2, h * 0.8, w * 0.32, h * 0.42); }
    return;
  }
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
function wmapObjProcSprite(name) {   // → {c} | null(含 res:程式精靈解析度)
  var p = WMAP_OBJ.proc[name], d = WMAP_OBJ_PROC[name], c, r;
  if (p !== undefined) return p;
  if (!d || typeof document === 'undefined') return null;
  r = d.res || WMAP_OBJ.RES;
  try { c = wmapObjCv(d.lw * r, d.lh * r); wmapObjProcDraw(name, c.getContext('2d'), c.width, c.height); } catch (e) { c = null; }
  p = c ? { c: c } : null; WMAP_OBJ.proc[name] = p;
  return p;
}
function wmapObjShrink(src, tw, th) {   // 縮到 tw × th(尺寸差距大時逐次減半,避免鋸齒)
  var c = src, w = src.width, h = src.height, n, g;
  while (w > tw * 2 && h > th * 2) { w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2)); n = wmapObjCv(w, h); g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, w, h); c = n; }
  n = wmapObjCv(tw, th); g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n.width, n.height);
  return n;
}
function wmapObjScaled(name) {   // 取樣來源:目標 px / 邏輯單位 tk = min(格寬 / 256 × DPR × 1.6(留給 scale ≤ 1.6 的物件), 該精靈解析度);tk ≥ 解析度 0.7 倍 → 直接取圖集矩形(不複製),否則預縮成小畫布
  var G = WMAP.G, key, ent, meta, tk, src, sp, sw, sh, tmp, g, r, direct;
  if (!G || typeof document === 'undefined') return null;
  key = G.W + '|' + WMAP.dpr + '|' + WMAP_OBJ.ver;
  if (WMAP_OBJ.sc.key !== key) WMAP_OBJ.sc = { key: key, m: {} };
  ent = WMAP_OBJ.sc.m[name];
  if (ent !== undefined) return ent;
  meta = wmapObjSpriteMeta(name); ent = null;
  if (meta) {
    tk = Math.min(G.W / 256 * WMAP.dpr * 1.6, meta.res);
    direct = tk >= meta.res * 0.7 - 1e-6;
    if (meta.src === 'atlas') {
      r = meta.r;
      if (direct) ent = { c: meta.img, sx: r.x, sy: r.y, sw: r.w, sh: r.h, lw: meta.lw, lh: meta.lh, ax: meta.ax, ay: meta.ay, tk: meta.res };
      else {
        tmp = wmapObjCv(r.w, r.h); g = tmp.getContext('2d'); g.drawImage(meta.img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); src = tmp;
      }
    } else { sp = wmapObjProcSprite(name); src = sp ? sp.c : null; if (src && direct) ent = { c: src, sx: 0, sy: 0, sw: src.width, sh: src.height, lw: meta.lw, lh: meta.lh, ax: meta.ax, ay: meta.ay, tk: meta.res }; }
    if (!ent && src) {
      sw = Math.max(1, Math.round(meta.lw * tk)); sh = Math.max(1, Math.round(meta.lh * tk));
      tmp = wmapObjShrink(src, sw, sh);
      ent = { c: tmp, sx: 0, sy: 0, sw: tmp.width, sh: tmp.height, lw: meta.lw, lh: meta.lh, ax: meta.ax, ay: meta.ay, tk: tk, own: true };
    }
  }
  WMAP_OBJ.sc.m[name] = ent;
  return ent;
}
function wmapObjDraw(g, G, name, fx, fy, scale, flip) {
  var e = wmapObjScaled(name), k, dw, dh;
  if (!e) return false;
  k = G.W / 256 * scale; dw = e.lw * k; dh = e.lh * k;
  g.imageSmoothingQuality = 'high';
  if (flip) { g.save(); g.translate(fx, fy); g.scale(-1, 1); g.drawImage(e.c, e.sx, e.sy, e.sw, e.sh, -e.ax * k, -e.ay * k, dw, dh); g.restore(); }
  else g.drawImage(e.c, e.sx, e.sy, e.sw, e.sh, fx - e.ax * k, fy - e.ay * k, dw, dh);
  return true;
}
function wmapObjImgBytes(im) { return im ? (im.naturalWidth || im.width || 0) * (im.naturalHeight || im.height || 0) * 4 : 0; }
function wmapObjMem() {   // 貼圖記憶體(位元組):圖集解碼 + 預縮畫布(只算自己複製的)+ 程式精靈 + 橋 / 路圖
  var n = 0, k, e, p, a;
  for (k in WMAP_OBJ.atl) { a = WMAP_OBJ.atl[k]; if (a && a.img) n += wmapObjImgBytes(a.img); }
  for (k in WMAP_OBJ.sc.m) { e = WMAP_OBJ.sc.m[k]; if (e && e.own && e.c) n += e.c.width * e.c.height * 4; }
  for (k in WMAP_OBJ.proc) { p = WMAP_OBJ.proc[k]; if (p && p.c) n += p.c.width * p.c.height * 4; }
  if (WMAP_OBJ.misc.bridge) n += wmapObjImgBytes(WMAP_OBJ.misc.bridge.img);
  if (WMAP_OBJ.misc.road) n += wmapObjImgBytes(WMAP_OBJ.misc.road.img);
  return n;
}

// ───────── 載入 ─────────
function wmapObjRedrawSoon() {   // 圖到了:去抖後清分塊重烘
  var o = WMAP_OBJ;
  if (typeof WMAP === 'undefined' || !WMAP.on || o.timer) return;
  o.timer = setTimeout(function () { o.timer = 0; if (!WMAP.on) return; wmapClearChunks(); WMAP.sc = {}; WMAP.bsig = ''; wmapSchedule(); }, 120);
}
function wmapObjIndexAtlas(name, meta, img) {   // 一張圖集載入完:登錄它的所有精靈名稱
  var o = WMAP_OBJ, k;
  o.atl[name] = { meta: meta, img: img };
  for (k in meta.sprites) { o.idx[k] = o.atl[name]; delete o.proc[k]; }   // 這些名稱改用圖:釋放先前建過的程式備用精靈(省記憶體)
  o.ver++; o.st = 2; o.sc = { key: '', m: {} };
}
function wmapObjLoadAtlas(name) {
  var o = WMAP_OBJ;
  function fail() { o.nFail++; if (o.nFail >= WMAP_OBJ_ATLAS.length && o.st !== 2) o.st = -1; }
  fetch(o.base + name + '.json').then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (m) {
    var img = new Image();
    img.onload = function () { wmapObjIndexAtlas(name, m, img); wmapObjRedrawSoon(); };
    img.onerror = fail;
    img.src = o.base + m.atlas;
  }).catch(fail);   // 缺圖 / 離線:保持程式備用,不報錯
}
function wmapObjLoadMisc() {   // 橋 / 土路車轍
  var o = WMAP_OBJ;
  function one(key, f, base, meta) {
    var img = new Image();
    img.onload = function () { o.misc[key] = { img: img, meta: meta }; wmapObjRedrawSoon(); };
    img.onerror = function () { /* 缺檔:舊程式橋 / 土路 */ };
    img.src = base + f;
  }
  fetch(o.base + 'misc_meta.json').then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (m) {
    if (m.bridge && m.bridge.f) one('bridge', m.bridge.f, o.base, m.bridge);
    if (m.road && m.road.f) one('road', m.road.f, o.texBase, m.road);
  }).catch(function () { o.misc.st = -1; });
}
function wmapObjKickLoad() {
  var o = WMAP_OBJ, i, need;
  if (typeof wmapArtSprKick === 'function') {   // 山 / 城池精靈:只載這張地圖用到的鍵(WMAP.objs 的拼塊 / 城池鍵)所在的圖檔
    try {
      need = {};
      if (typeof WMAP !== 'undefined' && WMAP.objs) for (i = 0; i < WMAP.objs.length; i++) need[WMAP.objs[i].key] = 1; else need = null;
      wmapArtSprKick(need);
    } catch (e) { /* 山 / 城池維持程式備用 */ }
  }
  if (o.st !== 0 || typeof fetch !== 'function' || typeof Image === 'undefined') return;
  o.st = 1;
  try {
    for (i = 0; i < WMAP_OBJ_ATLAS.length; i++) wmapObjLoadAtlas(WMAP_OBJ_ATLAS[i]);
    if (o.misc.st === 0) { o.misc.st = 1; wmapObjLoadMisc(); }
  } catch (e) { o.st = -1; }
}
function wmapObjReplacesScatter() { return !!(WMAP_OBJ_CFG.on && WMAP_OBJ_CFG.replaceScatter); }

// ───────── 橋 / 土路貼圖(wmap_view.js 的 wmapBakeRoads 掛鉤) ─────────
var WMAP_OBJ_AXIS_DEG = [90, 150, 30];   // 臂軸 a = d % 3(0 N–S、1 NE–SW、2 SE–NW)在地面等向座標的方向角(度;SE = 30°、SW = 150°)
function wmapObjBridgeDraw(g, G, br) {   // 橋圖 = 正俯視、橋身水平;在地面等向座標旋轉成臂軸向,再把垂直方向壓成 0.65(同地面貼圖 pattern 矩陣),畫在橋格中心
  var b = WMAP_OBJ.misc.bridge, i, c, r, m, a, p, n = 0, Sx, Sy, u, hit;
  if (!WMAP_OBJ_CFG.on || !b || !b.img || !b.meta || !(b.meta.lw > 0) || typeof wmapCellCenter !== 'function') return false;
  Sx = 0.8660254 * G.W; Sy = G.H; u = 1 / (0.8660254 * 256);   // 美術單位 → 地面單位(1 = 鄰格距離 = 221.7 美術單位)
  g.imageSmoothingQuality = 'high';
  for (i = 0; i < br.length; i += 3) {
    c = br[i]; r = br[i + 1]; m = br[i + 2]; p = wmapCellCenter(G, c, r); hit = 0;
    for (a = 0; a < 3; a++) {
      if (!(m & ((1 << a) | (1 << (a + 3))))) continue;
      hit = 1; g.save(); g.translate(p.x, p.y); g.scale(Sx, Sy); g.rotate(WMAP_OBJ_AXIS_DEG[a] * Math.PI / 180); g.scale(u, u);
      g.drawImage(b.img, -b.meta.lw / 2, -b.meta.lh / 2, b.meta.lw, b.meta.lh); g.restore(); n++;
    }
    if (!hit) { g.save(); g.translate(p.x, p.y); g.scale(Sx, Sy); g.rotate(WMAP_OBJ_AXIS_DEG[2] * Math.PI / 180); g.scale(u, u); g.drawImage(b.img, -b.meta.lw / 2, -b.meta.lh / 2, b.meta.lw, b.meta.lh); g.restore(); n++; }
  }
  return n > 0;
}
function wmapObjRoadFill(g, G, list) {   // 土路面:車轍貼圖(縱向)旋轉成三軸向,每格每軸各填一次(臂 + 中心橢圓),貼圖錨在格中心 → 車轍沿路中線
  var rd = WMAP_OBJ.misc.road, pat, i, c, r, m, a, mm, p, Sx, Sy, s, cx;
  if (!WMAP_OBJ_CFG.on || !rd || !rd.img || typeof DOMMatrix === 'undefined' || typeof wmapRoadShape !== 'function' || typeof WMAP_RD === 'undefined' || !g.createPattern) return false;
  pat = g.createPattern(rd.img, 'repeat');
  if (!pat || !pat.setTransform) return false;
  Sx = 0.8660254 * G.W; Sy = G.H; s = WMAP_OBJ_CFG.road.tile / (rd.meta.w || 256); cx = (rd.meta.rutCx !== undefined ? rd.meta.rutCx : 0.5) * (rd.meta.w || 256);
  for (i = 0; i < list.length; i += 3) {
    c = list[i]; r = list[i + 1]; m = list[i + 2]; p = wmapCellCenter(G, c, r);
    for (a = 0; a < 3; a++) {
      mm = m & ((1 << a) | (1 << (a + 3)));
      if (!mm) continue;
      pat.setTransform(new DOMMatrix().translate(p.x, p.y).scale(Sx, Sy).rotate(WMAP_OBJ_AXIS_DEG[a] - 90).scale(s).translate(-cx, -(rd.meta.h || 256) / 2));
      g.fillStyle = pat; g.beginPath(); wmapRoadShape(g, c, r, mm, WMAP_RD.fill); g.fill();
    }
  }
  return true;
}

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
function wmapObjResOf(gi) {   // 該資源格的 {parts, flag}(快取;WMAP.res 重建或圖集狀態改變時失效)
  var rc = WMAP_OBJ.rc, info;
  if (rc.res !== WMAP.res) { rc.res = WMAP.res; rc.m = {}; rc.sig = WMAP_OBJ.ver; }
  if (rc.sig !== WMAP_OBJ.ver) { rc.m = {}; rc.sig = WMAP_OBJ.ver; }
  if (rc.m[gi] !== undefined) return rc.m[gi];
  info = WMAP.res[gi];
  rc.m[gi] = info ? { parts: wmapObjResParts(info.ty, info.lv, gi), flag: wmapObjFlagInfo(info.lv), lv: info.lv, ty: info.ty } : null;
  return rc.m[gi];
}
function wmapObjResItems(G, x0, y0, x1, y1) {
  var items = [], cfg = WMAP_OBJ_CFG, N, i, gi, c, r, e, p, j, u, v, q, ctr, mx, my, t0, nf = 0, no = 0, f, uv, k = G.W / 256;
  if (!cfg.on || !WMAP.resList || !WMAP.resList.length) return items;
  t0 = performance.now(); N = WMAP.N; mx = G.W * 1.2; my = G.W * 1.8;
  for (i = 0; i < WMAP.resList.length; i++) {
    gi = WMAP.resList[i]; c = gi % N; r = (gi - c) / N; ctr = wmapCellCenter(G, c, r);
    if (ctr.x < x0 - mx || ctr.x > x1 + mx || ctr.y < y0 - G.H || ctr.y > y1 + my) continue;
    e = wmapObjResOf(gi); if (!e) continue;
    for (j = 0; j < e.parts.length; j++) {
      p = e.parts[j];
      items.push({ dep: c + r + (p.att ? 0.1 + j * 0.01 : 0), tie: c - r, id: gi * 8 + j, ty: 2, k: 0, name: p.name, fx: ctr.x + p.ox * k, fy: ctr.y + p.oy * k, sc: p.sc, flip: p.flip }); no++;
    }
    if (cfg.flag.on) {
      f = cfg.flag; uv = wmapObjGroundToUV(f.gx, f.gy); u = c + 0.5 + uv.du; v = r + 0.5 + uv.dv; q = wmapUV2World(G, u, v);
      items.push({ dep: u + v - 1 + 0.05, tie: c - r, id: gi * 8 + 7, ty: 2, k: 1, fx: q.x, fy: q.y, fl: e.flag }); nf++;
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
