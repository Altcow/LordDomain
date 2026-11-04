// js/terrain_tex.js — 地形貼圖(assets/terrain/*.webp,256×128 透明菱形頂面,每種地形 a / b 兩款)。
// 套用對象:人工地面 7~12(石板 / 夯土 / 水泥 / 鋼鐵 / 木棧板 / 木紋地板)與自然地面 13~18(泥土 / 岩地 / 裂土 / 黑土 / 叢林 / 紅土)。
// 草地 / 湖 / 河 / 道路 / 沙 / 裂 / 雪是「活的」地形,維持程式繪製,不在登錄表內。
// 做法:登錄表 TERRAIN_TEX = { 地形 id: [檔名a, 檔名b] };延遲載入(第一次需要才建 Image),載入完成 → 世代 terrainTexGen() 遞增,
// render.js 的地形分塊簽名含此世代(只影響含貼圖地形的塊),下一幀自動重烘;缺圖 / 載入失敗 / 開關關閉 → 呼叫端回程式繪製,不報錯。
// 每格變體由「格座標 + 地形」雜湊決定(與視角無關,同座標永遠同一張);木棧板 / 木紋地板依板條軸向選(a = 板條沿 y 軸 = 左下到右上,b = 沿 x 軸 = 左上到右下)。
// 記憶體:每張只保留一份解碼 Image;縮小時以逐級對半的小圖(16~128 px 寬)降低鋸齒,依需要才建,總量 < 原圖 1/3。
// 偏好 lorddomain.terraintex('0' = 關;偏好鍵,不進世界存檔)。不發聲。ES2017;不用 ?. ??。
// 全域名稱:TERRAIN_TEX_DIR TERRAIN_TEX terrainTexOn terrainTexSetOn terrainTexGen terrainTexHas terrainTexAxis terrainTexPick terrainTexReady
//   terrainTexDraw terrainTexSetLoader terrainTexReset

var TERRAIN_TEX_KEY = 'lorddomain.terraintex';
var TERRAIN_TEX_DIR = 'assets/terrain/';
var TERRAIN_TEX = {};
TERRAIN_TEX[T_STONEPAVE] = ['stonepave_a.webp', 'stonepave_b.webp'];
TERRAIN_TEX[T_RAMMED] = ['rammed_a.webp', 'rammed_b.webp'];
TERRAIN_TEX[T_CONCRETE] = ['concrete_a.webp', 'concrete_b.webp'];
TERRAIN_TEX[T_STEEL] = ['steel_a.webp', 'steel_b.webp'];
TERRAIN_TEX[T_PLANKDECK] = ['plankdeck_a.webp', 'plankdeck_b.webp'];
TERRAIN_TEX[T_WOODFLOOR] = ['woodfloor_a.webp', 'woodfloor_b.webp'];
TERRAIN_TEX[T_DIRT] = ['dirt_a.webp', 'dirt_b.webp'];
TERRAIN_TEX[T_ROCK] = ['rock_a.webp', 'rock_b.webp'];
TERRAIN_TEX[T_CRACKSOIL] = ['crackedsoil_a.webp', 'crackedsoil_b.webp'];
TERRAIN_TEX[T_BLACKSOIL] = ['blacksoil_a.webp', 'blacksoil_b.webp'];
TERRAIN_TEX[T_JUNGLE] = ['jungle_a.webp', 'jungle_b.webp'];
TERRAIN_TEX[T_REDSOIL] = ['redsoil_a.webp', 'redsoil_b.webp'];
var TERRAIN_TEX_ZOOM = 1.06;   // 貼圖放大倍率(裁掉外緣邊暈)
var TERRAIN_TEX_PLANKS = {};   // 依板條軸向選變體的地形
TERRAIN_TEX_PLANKS[T_PLANKDECK] = 1;
TERRAIN_TEX_PLANKS[T_WOODFLOOR] = 1;

var terrainTexSt = { on: null, gen: 1, ent: {}, loader: null };

function terrainTexOn() {
  if (terrainTexSt.on === null) {
    terrainTexSt.on = true;
    try { if (typeof localStorage !== 'undefined' && localStorage.getItem(TERRAIN_TEX_KEY) === '0') terrainTexSt.on = false; } catch (e) { /* 讀不到用預設(開) */ }
  }
  return terrainTexSt.on;
}
function terrainTexSetOn(v) {
  terrainTexSt.on = !!v;
  terrainTexSt.gen++;   // 開關改變 → 含貼圖地形的分塊重烘
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(TERRAIN_TEX_KEY, terrainTexSt.on ? '1' : '0'); } catch (e) { /* 存不了只影響下次記憶 */ }
}
// 世代:開關改變 / 任一貼圖載入完成就 +1(分塊簽名用)
function terrainTexGen() { return terrainTexSt.gen; }
function terrainTexHas(t) { return !!TERRAIN_TEX[t]; }
// 測試 / 特殊環境:自訂載入器 fn(url, onload, onerror) → 回傳含 width / height 的物件(或 null = 無法載入);傳 null 還原預設(new Image)
function terrainTexSetLoader(fn) { terrainTexSt.loader = typeof fn === 'function' ? fn : null; }
function terrainTexReset() { terrainTexSt.ent = {}; terrainTexSt.gen++; }

function ttHash(x, y, t) {
  let h = (Math.imul(x + 101, 0x2545f491) ^ Math.imul(y + 211, 0x9e3779b1) ^ Math.imul(t + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

// 板條軸向:0 = a(板條沿 y,左下到右上),1 = b(板條沿 x,左上到右下)。木棧板沿用 render.js deckAxis;
// 木紋地板:只有「寬 1 格的走道」(同軸鄰格比另一軸多 2 以上)才跟著轉,大片地板一律 b(與程式繪製的沿 x 長板一致),避免房間邊緣一格一格換向
function terrainTexAxis(x, y, t) {
  if (t === T_PLANKDECK) return typeof deckAxis === 'function' ? deckAxis(x, y) : 0;
  if (t !== T_WOODFLOOR) return 0;
  const wf = function (a, b) { return typeof inBounds === 'function' && inBounds(a, b) && world.terrain[idx(a, b)] === T_WOODFLOOR ? 1 : 0; };
  const ny = wf(x, y - 1) + wf(x, y + 1), nx = wf(x - 1, y) + wf(x + 1, y);
  return ny - nx >= 2 ? 0 : 1;
}

// 該格要用的貼圖檔名(不看載入狀態);無登錄回 ''
function terrainTexPick(x, y, t) {
  const list = TERRAIN_TEX[t];
  if (!list) return '';
  if (TERRAIN_TEX_PLANKS[t]) return list[Math.min(list.length - 1, terrainTexAxis(x, y, t))];
  return list[(ttHash(x, y, t) >>> 9) % list.length];
}

// 載入:state 0 未開始 / 1 載入中 / 2 完成 / 3 失敗(不重試)
function ttEntry(file) {
  let e = terrainTexSt.ent[file];
  if (e) return e;
  e = terrainTexSt.ent[file] = { file: file, img: null, state: 0, lv: [] };
  try {
    const url = TERRAIN_TEX_DIR + file;
    const ok = function () { if (e.state === 1) { e.state = 2; terrainTexSt.gen++; } };
    const bad = function () { e.state = 3; };
    let img = null;
    if (terrainTexSt.loader) img = terrainTexSt.loader(url, ok, bad);
    else if (typeof Image === 'function') {
      img = new Image();
      img.onload = ok;
      img.onerror = bad;
      img.src = url;
    }
    if (!img) { e.state = 3; return e; }
    e.img = img;
    e.state = 1;
    if (!terrainTexSt.loader && img.complete && img.naturalWidth > 0) { e.state = 2; terrainTexSt.gen++; }
  } catch (err) { e.state = 3; }
  return e;
}
// 第一次需要某地形時,兩款一起載(避免相鄰格一款先到一款後到,造成一次次重烘)
function ttLoadAll(t) {
  const list = TERRAIN_TEX[t];
  for (let i = 0; i < list.length; i++) ttEntry(list[i]);
}

// 縮放比例(裝置像素 / 世界單位):烘焙時用該層級解析度,否則 zoom × dpr
function ttScale() {
  if (typeof tileBake !== 'undefined' && tileBake && typeof terrBakeRes === 'number') return terrBakeRes;
  const z = typeof view !== 'undefined' ? view.zoom : 1, r = typeof viewport !== 'undefined' && viewport.dpr ? viewport.dpr : 1;
  return z * r;
}
function ttSource(e, scale) {
  const w0 = e.img.naturalWidth || e.img.width || 256;
  let want = 64 * scale, l = 0;
  while (l < 4 && (w0 >> (l + 1)) >= want) l++;
  if (l === 0 || typeof document === 'undefined' || !document.createElement) return e.img;
  for (let k = Math.max(1, e.lv.length); k <= l; k++) {
    const prev = k === 1 ? e.img : e.lv[k - 1], cv = document.createElement('canvas');
    cv.width = Math.max(1, w0 >> k); cv.height = Math.max(1, (e.img.naturalHeight || e.img.height || 128) >> k);
    const c = cv.getContext('2d');
    if (!c) return e.img;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(prev, 0, 0, cv.width, cv.height);
    e.lv[k] = cv;
  }
  return e.lv[l];
}

// 該格貼圖是否已可畫(開關開、有登錄、檔案已載入);會觸發延遲載入
function terrainTexReady(x, y, t) {
  if (!TERRAIN_TEX[t] || !terrainTexOn()) return false;
  if (!terrainTexSt.ent[TERRAIN_TEX[t][0]]) ttLoadAll(t);
  const e = terrainTexSt.ent[terrainTexPick(x, y, t)];
  return !!e && e.state === 2;
}

// 在本格頂面(p = topPts 四角:上 / 右 / 下 / 左)貼圖,菱形剪裁;成功回 true,否則 false(呼叫端回程式繪製)。
// 冬季:自然地面(岩地除外)罩一層淡雪色;c2d 路徑(非烘焙)時以 multiply 套時段乘色,烘焙時乘色留給 GL 合成。
function terrainTexDraw(ctx, p, x, y, t, winter, tintHex) {
  if (!terrainTexReady(x, y, t)) return false;
  const e = terrainTexSt.ent[terrainTexPick(x, y, t)];
  const src = ttSource(e, ttScale());
  const l = p[3][0], r = p[1][0], tp = p[0][1], bt = p[2][1];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]);
  ctx.closePath();
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 1;
  // 以中心略放大 6%:貼圖外緣有 ~2% 寬的洋紅色邊暈(去背殘留),被菱形剪裁掉
  const sw = (r - l) * TERRAIN_TEX_ZOOM, sh = (bt - tp) * TERRAIN_TEX_ZOOM;
  ctx.drawImage(src, (l + r) / 2 - sw / 2, (tp + bt) / 2 - sh / 2, sw, sh);
  if (winter && t >= T_DIRT && t !== T_ROCK) {
    ctx.fillStyle = 'rgba(238,244,250,0.34)';
    ctx.fillRect(l, tp, r - l, bt - tp);
  }
  if (tintHex) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tintHex;
    ctx.fillRect(l, tp, r - l, bt - tp);
  }
  ctx.restore();
  return true;
}
