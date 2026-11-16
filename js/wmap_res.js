// js/wmap_res.js — M1 斜角大地圖:資源領地「等級畫像」演算法(設計_領地資源等級畫像.md 第 3、4.1 節)。
// 純函式:不碰 DOM / 存檔、不讀時間、不用 Math.random(全由世界座標雜湊決定 → 確定性、重載不變、跨分塊一致)。ES2017,不用 ?. ??;UTF-8 + CRLF。
// 載入順序:wm_gen.js(wmGenHash01)、wmap_proj.js、wmap_art.js 之後、wmap_view.js 之前。命名:全域一律 wmapRes* / WMAP_RES_*。
//
// 座標 (u, v) = 格座標(wmap_proj.js:格 (c, r) 佔 [c, c+1) × [r, r+1),中心 (c+0.5, r+0.5))。
// F = {N, rty: Int8Array(−1 非資源,0~4 = WMAP_RES_ORDER 索引), rlv: Uint8Array(1~10), rok: Uint8Array(1 = 可放散布物件)};格索引 gi = r × N + c。
//
// ───────── 公開 API ─────────
//   WMAP_RES_ORDER / WMAP_RES_DENS / WMAP_RES_SPAWN / WMAP_RES_SIZE / WMAP_RES_KINDS / WMAP_RES_CFG   資料表
//   wmapResDens(F, u, v, out) → out[0..4]    世界點 (u, v) 各種類的連續密度(3×3 正規化高斯內插;非資源格 × spill;rok = 0 → 0)
//   wmapResField(F, t, u, v) → D             單一種類 t 的密度
//   wmapResPrep(F) → F                        預處理(F.nr:3×3 內有資源才算密度;F.pc:每格散布物件快取);F 內容改變後重新呼叫
//   wmapResPoints(F, seed, u0, v0, u1, v1, zi) → [{t, key, u, v, d, sz(0~4), kind(0/1), dep, tie, id}]   矩形內散布物件(zi = 0 時不出 S1)
//   wmapResPatches(F, seed, u0, v0, u1, v1) → [{t, u, v, r, k:[8 個半徑倍率]}]                         地面斑塊(farm 不出斑塊,走田塊)
//   wmapResParcels(F, seed, u0, v0, u1, v1) → [{u, v, gold, eL, eT, eR, eB}]                          農田田塊(邊長 0.5 格,世界錨定)與要畫的田埂邊
//   wmapResKey(t, sz, kind) → 'ro_…'         散布物件圖鍵(wmap_art.js 畫)

var WMAP_RES_ORDER = ['farm', 'lumber', 'quarry', 'mine', 'hunt'];
var WMAP_RES_DENS = [0.12, 0.22, 0.31, 0.40, 0.52, 0.61, 0.70, 0.79, 0.89, 1.0];   // Lv1~10 目標密度
// 密度 → 生成機率與大小階 S1~S5:錨點之間線性內插(所以 Lv 每升一級,機率與大小分布都連續變大 → 單調)。[D, spawn, [S1..S5 機率]] PLACEHOLDER,tools/res_field_check.js 調
var WMAP_RES_SPAWN = [
  [0.08, 0.12, [1, 0, 0, 0, 0]],
  [0.165, 0.25, [0.75, 0.25, 0, 0, 0]],
  [0.35, 0.45, [0.35, 0.45, 0.2, 0, 0]],
  [0.55, 0.65, [0.1, 0.3, 0.4, 0.2, 0]],
  [0.75, 0.80, [0, 0.1, 0.35, 0.4, 0.15]],
  [0.92, 0.92, [0, 0, 0.15, 0.4, 0.45]],
  [1.0, 0.95, [0, 0, 0.1, 0.38, 0.52]]
];
var WMAP_RES_SIZE = [28, 44, 68, 98, 128];   // S1~S5 遊戲內寬度(格寬 256 為單位;S5 = 格寬一半)
// 每種類 × 每階 2 款(wmap_art.js 的 wmapArtMakeRO 依名稱畫)
var WMAP_RES_KINDS = [
  [['sprout', 'sprout2'], ['sprout', 'wheat'], ['wheat', 'millet'], ['wheat', 'millet'], ['millet', 'reeds']],      // farm:青苗 → 麥 → 高粱 / 蒲草
  [['shrub', 'shrub'], ['shrub', 'pine'], ['pine', 'broad'], ['pine', 'broad'], ['pine', 'broad']],                // lumber:矮灌 → 大樹
  [['rocka', 'rockb'], ['rocka', 'rockb'], ['rocka', 'rockb'], ['rocka', 'rockb'], ['rocka', 'rockb']],            // quarry:碎石 → 巨岩
  [['rubble', 'ore'], ['ore', 'rubble'], ['vein', 'ore'], ['vein', 'crystal'], ['crystal', 'vein']],              // mine:礦石 → 礦脈 → 礦晶
  [['tuft', 'track'], ['tuft', 'bush'], ['bush', 'rabbit'], ['deer', 'boar'], ['deer', 'boar']]                  // hunt:草叢 / 獸跡 → 野獸
];
var WMAP_RES_CFG = {
  sigma: 0.35, spill: 0.6, jitter: 1.0, noise: 0.08, reserve: 0,
  h: [0.5, 0.25, 1 / 3, 1 / 3, 1 / 3],            // 與 WMAP_RES_ORDER 同序:散布格點間距(格)
  patchH: 1 / 3, patchJ: 0.6, patchLo: 0.04, patchHi: 0.9,
  parcelLo: 0.04, parcelHi: 0.7, goldLo: 0.3, goldHi: 0.95,
  maxObjPerChunk: 260
};

function wmapResSmooth(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }
function wmapResH(seed, i, j, salt) { return wmGenHash01(seed, Math.imul(i, 73856093) ^ Math.imul(j, 19349663), salt); }
function wmapResKey(t, sz, kind) { return 'ro_' + WMAP_RES_ORDER[t] + '_' + WMAP_RES_KINDS[t][sz][kind] + '_' + (sz + 1); }

// 預處理:F.nr[gi] = 1 表示該格 3×3 內有資源格(沒有就不必算密度 → 大片空地零成本)。F 的 rty / rlv / rok 改變後要重新呼叫
function wmapResPrep(F) {
  var N = F.N, nr = new Uint8Array(N * N), c, r, gi, dc, dr, cc, rr;
  for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
    if (F.rty[r * N + c] < 0) continue;
    for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) { cc = c + dc; rr = r + dr; if (cc >= 0 && rr >= 0 && cc < N && rr < N) nr[rr * N + cc] = 1; }
  }
  F.nr = nr; F.pc = {}; F.pseed = -1;
  return F;
}
// 世界點 (u, v) 各種類的連續密度。σ = 0.35 格:格中央 ≈ 自己的密度,格邊 ±0.35 內平滑過渡 → 沒有格線
function wmapResDens(F, u, v, out) {
  var N = F.N, c0 = Math.floor(u), r0 = Math.floor(v), s2 = 1 / (2 * WMAP_RES_CFG.sigma * WMAP_RES_CFG.sigma), sum = 0, c, r, dx, dy, w, gi, t, k, own = -1;
  out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 0;
  if (c0 >= 0 && r0 >= 0 && c0 < N && r0 < N) own = r0 * N + c0;
  if (own < 0) return out;
  if (!F.nr) wmapResPrep(F);
  if (!F.nr[own]) return out;
  for (r = r0 - 1; r <= r0 + 1; r++) for (c = c0 - 1; c <= c0 + 1; c++) {
    dx = u - (c + 0.5); dy = v - (r + 0.5);
    w = Math.exp(-(dx * dx + dy * dy) * s2); sum += w;
    if (c < 0 || r < 0 || c >= N || r >= N) continue;
    gi = r * N + c; t = F.rty[gi];
    if (t >= 0) out[t] += w * WMAP_RES_DENS[F.rlv[gi] - 1];
  }
  if (own < 0 || !F.rok[own]) { out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 0; return out; }
  k = 1 / sum;
  if (F.rty[own] < 0) k *= WMAP_RES_CFG.spill;
  for (t = 0; t < 5; t++) out[t] *= k;
  return out;
}
function wmapResField(F, t, u, v) { return wmapResDens(F, u, v, [0, 0, 0, 0, 0])[t]; }
// 這點歸哪個種類:密度 + 小雜訊,取最大者(交界處不同種類自然穿插);回 {t, d}(t = −1 = 無)
function wmapResDom(F, seed, u, v, nid, nj, tmp) {
  var t, best = -1, bv = 0.02, x;
  wmapResDens(F, u, v, tmp);
  for (t = 0; t < 5; t++) {
    if (tmp[t] <= 0) continue;
    x = tmp[t] + WMAP_RES_CFG.noise * (wmapResH(seed, nid, nj, 40 + t) - 0.5);
    if (x > bv) { bv = x; best = t; }
  }
  return best;
}
function wmapResSpawnAt(d, pr) {   // d → 生成機率;pr[0..4] 填大小階機率
  var T = WMAP_RES_SPAWN, i, a, b, f, k;
  if (d < T[0][0]) { for (k = 0; k < 5; k++) pr[k] = k === 0 ? 1 : 0; return 0; }
  if (d >= T[T.length - 1][0]) { for (k = 0; k < 5; k++) pr[k] = T[T.length - 1][2][k]; return T[T.length - 1][1]; }
  for (i = 1; i < T.length; i++) if (d < T[i][0]) break;
  a = T[i - 1]; b = T[i]; f = (d - a[0]) / (b[0] - a[0]);
  for (k = 0; k < 5; k++) pr[k] = a[2][k] + (b[2][k] - a[2][k]) * f;
  return a[1] + (b[1] - a[1]) * f;
}

// 單一格 (c, r) 內的全部散布物件(結果快取在 F.pc:格點間距 1/2、1/4、1/3 都整除 1,所以每個抖動格點必落在單一格內 → 以格為單位生成與快取,跨分塊 / 重烘不重算)
function wmapResCellPoints(F, seed, c, r) {
  var gi = r * F.N + c, lst, tmp = [0, 0, 0, 0, 0], pr = [0, 0, 0, 0, 0], cfg = WMAP_RES_CFG, N = F.N, J = cfg.jitter, lt, h, n, i, j, i0, j0, u, v, a, b, t, d, sp, x, sz, k, cum, dx, dy, major, kind, salt;
  if (F.pseed !== seed || !F.pc) { F.pc = {}; F.pseed = seed; }
  lst = F.pc[gi];
  if (lst) return lst;
  lst = []; F.pc[gi] = lst;
  if (!F.nr) wmapResPrep(F);
  if (!F.nr[gi]) return lst;
  for (lt = 0; lt < 5; lt++) {
    h = cfg.h[lt]; salt = 100 + lt * 8; n = Math.round(1 / h); i0 = Math.round(c / h); j0 = Math.round(r / h);
    for (j = j0; j < j0 + n; j++) for (i = i0; i < i0 + n; i++) {
      a = wmapResH(seed, i, j, salt); b = wmapResH(seed, i, j, salt + 1);
      u = (i + 0.5 + J * (a - 0.5)) * h; v = (j + 0.5 + J * (b - 0.5)) * h;
      if (u < c || u >= c + 1 || v < r || v >= r + 1) continue;
      t = wmapResDom(F, seed, u, v, i + lt * 4099, j, tmp);
      if (t !== lt) continue;
      d = tmp[t];
      if (F.rty[gi] >= 0 && F.rlv[gi] >= 5) { dx = u - (c + 0.5); dy = v - (r + 0.5); if (dx * dx + dy * dy < cfg.reserve * cfg.reserve) continue; }   // 里程碑保留區
      sp = wmapResSpawnAt(d, pr);
      if (wmapResH(seed, i, j, salt + 2) >= sp) continue;
      x = wmapResH(seed, i, j, salt + 3); cum = 0; sz = 4;
      for (k = 0; k < 5; k++) { cum += pr[k]; if (x < cum) { sz = k; break; } }
      if (pr[sz] <= 0) { for (k = 4; k >= 0; k--) if (pr[k] > 0) { sz = k; break; } }
      major = (i & 1) === 0 && (j & 1) === 0;
      if (sz >= 3 && !major && (t === 0 || t === 3 || t === 4)) sz = 2;   // 大件限額:坑口 / 大帳 / 大農具只出現在 major 點
      kind = wmapResH(seed, i, j, salt + 4) < 0.5 ? 0 : 1;
      lst.push({ t: t, key: wmapResKey(t, sz, kind), u: u, v: v, d: d, sz: sz, kind: kind, dep: u + v - 1, tie: u - v, id: wmGenHash(seed, Math.imul(i, 73856093) ^ Math.imul(j, 19349663), 900 + lt) });
    }
  }
  return lst;
}
function wmapResPoints(F, seed, u0, v0, u1, v1, zi) {
  var out = [], N = F.N, c, r, c0 = Math.max(0, Math.floor(u0)), c1 = Math.min(N - 1, Math.floor(u1)), r0 = Math.max(0, Math.floor(v0)), r1 = Math.min(N - 1, Math.floor(v1)), lst, i, p;
  if (!F.nr) wmapResPrep(F);
  for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) {
    if (!F.nr[r * N + c]) continue;
    lst = wmapResCellPoints(F, seed, c, r);
    for (i = 0; i < lst.length; i++) {
      p = lst[i];
      if (p.u < u0 || p.u > u1 || p.v < v0 || p.v > v1) continue;
      if (zi === 0 && p.sz === 0) continue;
      out.push(p);
    }
  }
  return out;
}

function wmapResPatches(F, seed, u0, v0, u1, v1) {
  var out = [], tmp = [0, 0, 0, 0, 0], cfg = WMAP_RES_CFG, h = cfg.patchH, J = cfg.patchJ, N = F.N, i, j, u, v, t, d, k, kk, i0 = Math.floor(u0 / h) - 1, i1 = Math.ceil(u1 / h) + 1, j0 = Math.floor(v0 / h) - 1, j1 = Math.ceil(v1 / h) + 1;
  for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
    u = (i + 0.5 + J * (wmapResH(seed, i, j, 300) - 0.5)) * h; v = (j + 0.5 + J * (wmapResH(seed, i, j, 301) - 0.5)) * h;
    if (u < u0 - 0.45 || u > u1 + 0.45 || v < v0 - 0.45 || v > v1 + 0.45) continue;
    if (u < 0 || v < 0 || u >= N || v >= N) continue;
    if (!F.nr) wmapResPrep(F);
    if (!F.nr[Math.floor(v) * N + Math.floor(u)]) continue;
    t = wmapResDom(F, seed, u, v, i + 77777, j, tmp);
    if (t <= 0) continue;   // −1 無、0 = farm(走田塊)
    d = tmp[t];
    if (wmapResH(seed, i, j, 302) >= wmapResSmooth(cfg.patchLo, cfg.patchHi, d)) continue;
    kk = [];
    for (k = 0; k < 8; k++) kk.push(0.8 + 0.4 * wmapResH(seed, i, j, 310 + k));
    out.push({ t: t, u: u, v: v, r: 0.13 + 0.30 * d, k: kk });
  }
  return out;
}

function wmapResParcelOn(F, seed, pi, pj, tmp) {   // 田塊 (pi, pj)(半格單位)是否種下:0 沒有、1 青苗、2 金穗
  var u = (pi + 0.5) / 2, v = (pj + 0.5) / 2, cfg = WMAP_RES_CFG, d;
  if (u < 0 || v < 0 || u >= F.N || v >= F.N) return 0;
  if (wmapResDom(F, seed, u, v, pi + 55555, pj, tmp) !== 0) return 0;
  d = tmp[0];
  if (F.rty[Math.floor(v) * F.N + Math.floor(u)] !== 0 && wmapResH(seed, pi, pj, 320) >= wmapResSmooth(cfg.parcelLo, cfg.parcelHi, d)) return 0;   // 農田格內一律種下(整格鋪滿),只有滲到格外的才看密度
  return wmapResH(seed, pi, pj, 321) < wmapResSmooth(cfg.goldLo, cfg.goldHi, d) ? 2 : 1;
}
function wmapResParcels(F, seed, u0, v0, u1, v1) {
  var out = [], tmp = [0, 0, 0, 0, 0], pi, pj, on, i0 = Math.floor(u0 * 2) - 1, i1 = Math.ceil(u1 * 2) + 1, j0 = Math.floor(v0 * 2) - 1, j1 = Math.ceil(v1 * 2) + 1;
  for (pj = j0; pj <= j1; pj++) for (pi = i0; pi <= i1; pi++) {
    on = wmapResParcelOn(F, seed, pi, pj, tmp);
    if (!on) continue;
    // 右 / 下邊一律畫;左 / 上邊只在鄰塊沒種時補畫 → 相鄰田塊共用的田埂只畫一次,連成一張網
    out.push({ u: pi / 2, v: pj / 2, gold: on === 2, eR: true, eB: true, eL: !wmapResParcelOn(F, seed, pi - 1, pj, tmp), eT: !wmapResParcelOn(F, seed, pi, pj - 1, tmp) });
  }
  return out;
}
