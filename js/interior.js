// js/interior.js — 共用室內框架(PLAN_INTERIORS §5.2 / §6;I0):以資料表描述一個室內場景(多層等角房間、家具、座位、NPC),全螢幕 layer + 自己的 c2d 畫布。
// 做法(同釣魚 fishui 的全螢幕子畫面):game.mode = 'interior';main.js frame() 在此模式不畫城市(經濟 / 科技 tick 照跑);進出淡入淡出 ≤ 300ms;
// 離開時恢復城市鏡頭 view、選取 pend、關閉所有面板;返回鍵(popstate)/ Esc / 左上返回鈕離開。固定鏡頭,依視窗等比縮放(直版上下疊、橫版左右並排,所有樓層完整可見)。
// 繪製:背景(地板、牆、不動的家具)進場時烘進離屏畫布一次(≤ 8MB,DPR ≤ 2);每幀只畫「會動 / 有深度關係」的東西(桌椅、櫃台、客人、NPC、燈火、對話泡)。
// 美術:家具先用程式畫的簡單等角方塊(INTERIOR_KINDS);預留外部圖掛點:INTERIOR_EXT_BG[場景id] = true 且 assets/interior/<場景id>_bg.webp 載入成功時改用該圖當背景,缺圖回退程式繪製。
// 資料表格式(interiorDefine):{ id, name, tile:[TW,TH], wallH, floors:[{id,label,grid:[cols,rows]}], props:[{id,floor,kind,at:[c,r],size:[w,h],dyn:bool,...}],
//   seats:[{floor,at,face,prop?}], npcs:[{id,floor,at,act}], lights:[{floor,at,z}], pal(S), makeGuests(S), makeNpcs(S), onAct(S,spot), onEnter(S), onLeave(S), title(S), sub(S), closeSub() }
// 不發聲、不新增音檔。ES2017;不用 ?. ??。
// 全域名稱:INTERIOR_DEFS INTERIOR_KINDS INTERIOR_EXT_BG interiorDefine interiorLint interiorLayout interiorEnter interiorLeave interiorActive interiorHash interiorRng interiorState interiorHitTest interiorStats

var INTERIOR_DEFS = {};
var INTERIOR_EXT_BG = {};
var INTERIOR_FADE_MS = 240;
var INTERIOR_DPR_MAX = 2;
var INTERIOR_BG_BYTES_MAX = 8 * 1024 * 1024;
var INTERIOR_MAX_DYN = 16;        // 同屏動態小人上限
var INTERIOR_MIN_HIT = 44;        // 可點熱區最小邊長(CSS px)
var INTERIOR_BAR_H = 48;          // 薄列高度(返回鈕 ≥ 44px)
var INTERIOR_PERSON_SCALE = 0.9;  // chibi 精靈(60×78 世界像素)相對等角格的縮放

var itr = {
  open: false, def: null, S: null, layer: null, cv: null, ctx: null, bar: null, backBtn: null, titleEl: null, subEl: null, hint: null, bgCv: null, bgCtx: null,
  raf: 0, paused: false, gate: null, histOn: false, histSkip: false, timer: 0, rzTimers: [], snap: null, leaving: false, frames: 0, subKey: '', down: null,
  stats: { enterMs: 0, bakeMs: 0, lastDrawMs: 0, bgBytes: 0, dyn: 0 }
};

// ───────── 小工具 ─────────
function interiorHash() {
  var s = Array.prototype.join.call(arguments, '|'), h = 2166136261, i;
  for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return h >>> 0;
}
function interiorRng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function interiorActive() { return !!itr.open; }
function interiorState() { return itr; }
function interiorStats() { return itr.stats; }

// ───────── 資料表 ─────────
function interiorDefine(def) {
  if (!def || !def.id) return null;
  def.tile = def.tile || [48, 24];
  def.wallH = def.wallH || 56;
  INTERIOR_DEFS[def.id] = def;
  return def;
}
function interiorFloorOf(def, id) {
  var i;
  for (i = 0; i < def.floors.length; i++) if (def.floors[i].id === id) return def.floors[i];
  return null;
}
// 驗證:點位不出格、不重疊、動作 / 種類存在。回問題字串陣列(空 = 通過)
function interiorLint(def) {
  var bad = [], occ = {}, ids = {};
  function cells(f, at, size, tag) {
    var c, r, k, g = interiorFloorOf(def, f);
    if (!g) { bad.push(tag + ': 樓層 ' + f + ' 不存在'); return; }
    size = size || [1, 1];
    if (!at || at[0] < 0 || at[1] < 0 || at[0] + size[0] > g.grid[0] || at[1] + size[1] > g.grid[1]) { bad.push(tag + ': 超出 ' + f + ' 格線 ' + g.grid.join('x')); return; }
    for (c = at[0]; c < at[0] + size[0]; c++) for (r = at[1]; r < at[1] + size[1]; r++) {
      k = f + ':' + c + ',' + r;
      if (occ[k]) bad.push(tag + ': 與 ' + occ[k] + ' 重疊於 ' + k);
      else occ[k] = tag;
    }
  }
  if (!def.floors || !def.floors.length) bad.push('無樓層');
  (def.floors || []).forEach(function (f) { if (!f.grid || f.grid[0] > 10 || f.grid[1] > 8 || f.grid[0] < 1 || f.grid[1] < 1) bad.push('樓層 ' + f.id + ' 格線超出 10x8'); });
  (def.props || []).forEach(function (p) {
    if (ids[p.id]) bad.push('prop id 重複 ' + p.id);
    ids[p.id] = 1;
    if (!INTERIOR_KINDS[p.kind]) bad.push('prop ' + p.id + ': 未知種類 ' + p.kind);
    if (!p.free) cells(p.floor, p.at, p.size, 'prop ' + p.id);
  });
  (def.seats || []).forEach(function (s, i) {
    cells(s.floor, s.at, [1, 1], 'seat' + i);
    if ([0, 1, 2, 3].indexOf(s.face) < 0) bad.push('seat' + i + ': face 須為 0~3');
  });
  (def.npcs || []).forEach(function (n) { if (!n.free) cells(n.floor, n.at, [1, 1], 'npc ' + n.id); if (!n.act) bad.push('npc ' + n.id + ': 缺 act'); });
  (def.lights || []).forEach(function (l, i) { if (!interiorFloorOf(def, l.floor)) bad.push('light' + i + ': 樓層不存在'); });
  if ((def.lights || []).length > 6) bad.push('燈火超過 6 處');
  return bad;
}

// 預熱 canvas 的中文字型(首次 fillText 約 60ms,移到閒時,進場首幀才不吃這筆)
function interiorWarm() {
  var cv, c;
  try {
    cv = document.createElement('canvas'); cv.width = cv.height = 16;
    c = cv.getContext('2d');
    c.font = 'bold 11px sans-serif'; c.fillText('招賢酒肆一二樓甲乙酒包間', 0, 10);
    c.font = '9px sans-serif'; c.fillText('客官,招人嗎?大人裡邊請', 0, 10);
  } catch (e) { /* 略過 */ }
}
if (typeof document !== 'undefined' && typeof setTimeout === 'function' && document.createElement) setTimeout(interiorWarm, 3000);

// ───────── 版面:直版上下疊(最後一層在上)、橫版左右並排(第一層在左);回 {s, x0, y0, floors:{id:{ox,oy,bx,by,W,H,gw,gh}}, W, H, vertical}
function interiorLayout(def, vw, vh, topH) {
  var TW = def.tile[0], TH = def.tile[1], wallH = def.wallH, pad = 8, gap = 14, vertical = vh >= vw, boxes = [], tw = 0, th = 0, i, f, W, H, x, y, avW, avH, s, L = { floors: {} };
  for (i = 0; i < def.floors.length; i++) {
    f = def.floors[i];
    W = (f.grid[0] + f.grid[1]) * TW / 2 + 8;
    H = wallH + (f.grid[0] + f.grid[1]) * TH / 2 + 22;
    boxes.push({ f: f, W: W, H: H });
  }
  if (vertical) { boxes.forEach(function (b) { tw = Math.max(tw, b.W); th += b.H; }); th += gap * (boxes.length - 1); }
  else { boxes.forEach(function (b) { th = Math.max(th, b.H); tw += b.W; }); tw += gap * (boxes.length - 1); }
  avW = Math.max(40, vw - pad * 2); avH = Math.max(40, vh - topH - pad * 2);
  s = Math.min(avW / tw, avH / th, 2.4);
  L.s = s; L.W = tw; L.H = th; L.vertical = vertical;
  L.x0 = (vw - tw * s) / 2; L.y0 = topH + (vh - topH - th * s) / 2;
  x = 0; y = 0;
  (vertical ? boxes.slice().reverse() : boxes).forEach(function (b) {
    var bx = vertical ? (tw - b.W) / 2 : x, by = vertical ? y : (th - b.H) / 2;
    L.floors[b.f.id] = { id: b.f.id, bx: bx, by: by, W: b.W, H: b.H, gw: b.f.grid[0], gh: b.f.grid[1], ox: bx + 4 + b.f.grid[1] * TW / 2, oy: by + wallH, label: b.f.label || b.f.id };
    if (vertical) y += b.H + gap; else x += b.W + gap;
  });
  return L;
}
// 格座標 → 場景座標(z 為離地高度)
function interiorPt(def, fl, c, r, z) { return [fl.ox + (c - r) * def.tile[0] / 2, fl.oy + (c + r) * def.tile[1] / 2 - (z || 0)]; }
function interiorToScreen(S, p) { return [S.L.x0 + p[0] * S.L.s, S.L.y0 + p[1] * S.L.s]; }

// ───────── 簡單等角繪製元件 ─────────
function itrPoly(ctx, pts, fill, stroke) {
  var i;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
}
function itrShade(hex, f) {
  var o = '#', i, c;
  for (i = 1; i < 7; i += 2) { c = Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(i, 2), 16) * f))); o += (c < 16 ? '0' : '') + c.toString(16); }
  return o;
}
// 等角方塊:格範圍 (c,r,w,h)、高度 z0→z1;只畫朝向觀看者的三個面
function itrBox(ctx, S, fl, c, r, w, h, z0, z1, col, line) {
  var d = S.def, P = function (cc, rr, z) { return interiorPt(d, fl, cc, rr, z); }, ol = line || 'rgba(40,24,12,.55)';
  itrPoly(ctx, [P(c, r + h, z0), P(c + w, r + h, z0), P(c + w, r + h, z1), P(c, r + h, z1)], itrShade(col, 0.86), ol);
  itrPoly(ctx, [P(c + w, r, z0), P(c + w, r + h, z0), P(c + w, r + h, z1), P(c + w, r, z1)], itrShade(col, 0.68), ol);
  itrPoly(ctx, [P(c, r, z1), P(c + w, r, z1), P(c + w, r + h, z1), P(c, r + h, z1)], col, ol);
}
function itrEllipse(ctx, x, y, rx, ry, fill, stroke) {
  ctx.beginPath();
  if (ctx.ellipse) ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); else ctx.arc(x, y, rx, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
}
// 貼牆平面:沿 r=0 牆(axis 'x',位置 c)或 c=0 牆(axis 'y',位置 r);u0~u1 為沿牆格數,z0~z1 高度
function itrWallQuad(S, fl, axis, u0, u1, z0, z1) {
  var d = S.def;
  if (axis === 'x') return [interiorPt(d, fl, u0, 0, z0), interiorPt(d, fl, u1, 0, z0), interiorPt(d, fl, u1, 0, z1), interiorPt(d, fl, u0, 0, z1)];
  return [interiorPt(d, fl, 0, u0, z0), interiorPt(d, fl, 0, u1, z0), interiorPt(d, fl, 0, u1, z1), interiorPt(d, fl, 0, u0, z1)];
}
function itrLantern(ctx, x, y, pal) {
  ctx.strokeStyle = pal.beamDk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 7); ctx.stroke();
  itrEllipse(ctx, x, y - 3, 5, 6.5, pal.cloth, 'rgba(60,20,10,.6)');
  ctx.fillStyle = pal.accent; ctx.fillRect(x - 3, y - 10, 6, 2); ctx.fillRect(x - 2.5, y + 2.5, 5, 1.6);
}

// 家具種類:bake(ctx,S,fl,p,pal) 烘進背景;draw(ctx,S,fl,p,pal,t) 每幀畫(有 dyn:true 的 prop);depth(p) 排序鍵
var INTERIOR_KINDS = {
  table: {
    depth: function (p) { return p.at[0] + p.size[0] + p.at[1] + p.size[1]; },
    draw: function (ctx, S, fl, p, pal) {
      var c = p.at[0], r = p.at[1], w = p.size[0], h = p.size[1], pt;
      itrBox(ctx, S, fl, c + 0.3, r + 0.3, w - 0.6, h - 0.6, 0, 9, pal.woodDk);
      itrBox(ctx, S, fl, c + 0.04, r + 0.04, w - 0.08, h - 0.08, 9, 12, pal.wood);
      pt = interiorPt(S.def, fl, c + w / 2, r + h / 2, 12);
      itrEllipse(ctx, pt[0] - 5, pt[1] - 1, 3, 1.5, pal.cupC, 'rgba(60,40,20,.6)');
      itrEllipse(ctx, pt[0] + 5, pt[1] + 1, 3, 1.5, pal.cupC, 'rgba(60,40,20,.6)');
    }
  },
  counter: {
    depth: function (p) { return p.at[0] + p.size[0] + p.at[1] + p.size[1]; },
    draw: function (ctx, S, fl, p, pal) {
      var c = p.at[0], r = p.at[1], w = p.size[0], h = p.size[1], a, b;
      itrBox(ctx, S, fl, c, r, w, h, 0, 17, pal.woodDk);
      itrBox(ctx, S, fl, c - 0.04, r - 0.04, w + 0.08, h + 0.08, 17, 19, pal.wood);
      a = interiorPt(S.def, fl, c + 0.4, r + h + 0.001, 4); b = interiorPt(S.def, fl, c + w - 0.4, r + h + 0.001, 4);
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      a = interiorPt(S.def, fl, c + 0.6, r + h / 2, 19);
      itrBox(ctx, S, fl, c + 0.35, r + 0.25, 0.55, 0.5, 19, 22, pal.beam);   // 算盤 / 帳本
      itrEllipse(ctx, interiorPt(S.def, fl, c + w - 0.7, r + h / 2, 22)[0], interiorPt(S.def, fl, c + w - 0.7, r + h / 2, 22)[1], 3.2, 1.6, pal.cupC, 'rgba(60,40,20,.6)');
    }
  },
  screen: {   // 屏風
    depth: function (p) { return p.at[0] + p.size[0] + p.at[1] + p.size[1]; },
    draw: function (ctx, S, fl, p, pal) {
      var c = p.at[0], r = p.at[1], w = p.size[0], h = p.size[1], d = S.def, q = [interiorPt(d, fl, c, r + h, 0), interiorPt(d, fl, c + w, r + h, 0), interiorPt(d, fl, c + w, r + h, 36), interiorPt(d, fl, c, r + h, 36)];
      itrPoly(ctx, q, pal.paper, 'rgba(40,24,12,.7)');
      itrPoly(ctx, [interiorPt(d, fl, c, r + h, 30), interiorPt(d, fl, c + w, r + h, 30), interiorPt(d, fl, c + w, r + h, 36), interiorPt(d, fl, c, r + h, 36)], pal.woodDk);
      ctx.strokeStyle = pal.inkWash; ctx.lineWidth = 1.6; ctx.beginPath();
      var a = interiorPt(d, fl, c + 0.1, r + h, 6), b = interiorPt(d, fl, c + w * 0.35, r + h, 20), e = interiorPt(d, fl, c + w * 0.6, r + h, 10), f = interiorPt(d, fl, c + w - 0.1, r + h, 22);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
      itrPoly(ctx, [interiorPt(d, fl, c, r + h, 0), interiorPt(d, fl, c + w, r + h, 0), interiorPt(d, fl, c + w, r + h, 2), interiorPt(d, fl, c, r + h, 2)], pal.woodDk);
    }
  },
  jars: {   // 後牆酒罈架(烘進背景)
    bake: function (ctx, S, fl, p, pal) {
      var d = S.def, c = p.at[0], w = p.size[0], q = itrWallQuad(S, fl, 'x', c, c + w, 4, 36), i, j, pt;
      itrPoly(ctx, q, pal.woodDk, 'rgba(40,24,12,.7)');
      for (j = 0; j < 2; j++) {
        pt = itrWallQuad(S, fl, 'x', c, c + w, 12 + j * 16, 14 + j * 16);
        itrPoly(ctx, pt, pal.wood);
        for (i = 0; i < Math.round(w * 2); i++) {
          pt = interiorPt(d, fl, c + 0.25 + i * 0.5, 0.05, 14 + j * 16);
          itrEllipse(ctx, pt[0], pt[1] - 5, 4.6, 5.6, i % 2 ? pal.jarB : pal.jarA, 'rgba(40,24,12,.7)');
          ctx.fillStyle = pal.cloth; ctx.fillRect(pt[0] - 2, pt[1] - 12, 4, 2.2);
        }
      }
    }
  },
  kitchen: {   // 廚房門 + 簾
    bake: function (ctx, S, fl, p, pal) {
      var c = p.at[0], w = p.size[0];
      itrPoly(ctx, itrWallQuad(S, fl, 'x', c + 0.1, c + w - 0.1, 0, 36), pal.beamDk, 'rgba(40,24,12,.7)');
      itrPoly(ctx, itrWallQuad(S, fl, 'x', c + 0.2, c + w - 0.2, 0, 30), '#2a1d16');
      itrPoly(ctx, itrWallQuad(S, fl, 'x', c + 0.2, c + w - 0.2, 8, 30), pal.cloth, 'rgba(40,24,12,.5)');
    }
  },
  stairs: {   // 樓梯(貼左牆,朝後上升)
    bake: function (ctx, S, fl, p, pal) {
      var c = p.at[0], r = p.at[1], h = p.size[1], n = 5, i, st = h / n;
      for (i = n - 1; i >= 0; i--) itrBox(ctx, S, fl, c, r + i * st, p.size[0], st, 0, 5 + (n - i) * 5, i % 2 ? pal.wood : pal.woodLt);
    }
  },
  rug: {
    bake: function (ctx, S, fl, p, pal) {
      var c = p.at[0], r = p.at[1], w = p.size[0], h = p.size[1], d = S.def;
      itrPoly(ctx, [interiorPt(d, fl, c, r, 0), interiorPt(d, fl, c + w, r, 0), interiorPt(d, fl, c + w, r + h, 0), interiorPt(d, fl, c, r + h, 0)], pal.cloth, 'rgba(40,24,12,.4)');
      itrPoly(ctx, [interiorPt(d, fl, c + 0.15, r + 0.15, 0), interiorPt(d, fl, c + w - 0.15, r + 0.15, 0), interiorPt(d, fl, c + w - 0.15, r + h - 0.15, 0), interiorPt(d, fl, c + 0.15, r + h - 0.15, 0)], pal.clothDk);
    }
  },
  plant: {
    bake: function (ctx, S, fl, p, pal) {
      var c = p.at[0], r = p.at[1], pt;
      itrBox(ctx, S, fl, c + 0.25, r + 0.25, 0.5, 0.5, 0, 7, pal.jarA);
      pt = interiorPt(S.def, fl, c + 0.5, r + 0.5, 7);
      itrEllipse(ctx, pt[0], pt[1] - 6, 7, 7, '#4f9a45', 'rgba(20,50,20,.6)');
      itrEllipse(ctx, pt[0] - 4, pt[1] - 10, 5, 5.5, '#6cb85a'); itrEllipse(ctx, pt[0] + 4, pt[1] - 9, 4.5, 5, '#5aa84c');
    }
  },
  door: {   // 二樓包間門(占位,不可互動)
    bake: function (ctx, S, fl, p, pal) {
      var c = p.at[0], w = p.size[0], pt;
      itrPoly(ctx, itrWallQuad(S, fl, 'x', c, c + w, 0, 40), pal.beamDk, 'rgba(40,24,12,.7)');
      itrPoly(ctx, itrWallQuad(S, fl, 'x', c + 0.12, c + w - 0.12, 0, 36), pal.door, 'rgba(40,24,12,.6)');
      itrPoly(ctx, itrWallQuad(S, fl, 'x', c + 0.12, c + w - 0.12, 26, 36), pal.cloth);
      pt = interiorPt(S.def, fl, c + w / 2, 0, 41);
      ctx.fillStyle = pal.paper; ctx.fillRect(pt[0] - 7, pt[1] - 6, 14, 7);
      ctx.fillStyle = pal.inkWash; ctx.font = '6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.label || '包間', pt[0], pt[1] - 2.4);
    }
  },
  sign: {   // 牆上匾額
    bake: function (ctx, S, fl, p, pal) {
      var c = p.at[0], w = p.size[0], q = itrWallQuad(S, fl, p.axis || 'x', c, c + w, 22, 40), pt;
      itrPoly(ctx, q, pal.sign, 'rgba(40,24,12,.8)');
      pt = [(q[0][0] + q[1][0]) / 2, (q[0][1] + q[2][1]) / 2 + (p.axis === 'y' ? 0 : 0)];
      ctx.save(); ctx.fillStyle = pal.signInk; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.translate(pt[0], pt[1] + 3); ctx.transform(1, p.axis === 'y' ? -0.5 : 0.5, 0, 1, 0, 0); ctx.fillText(p.label || '', 0, 0); ctx.restore();
    }
  },
  banner: {   // 酒旗(掛牆角)
    bake: function (ctx, S, fl, p, pal) {
      var pt = interiorPt(S.def, fl, p.at[0], p.at[1], 44);
      ctx.fillStyle = pal.beamDk; ctx.fillRect(pt[0] - 1, pt[1] - 4, 2, 44);
      itrPoly(ctx, [[pt[0] + 1, pt[1] - 2], [pt[0] + 13, pt[1] - 2], [pt[0] + 13, pt[1] + 30], [pt[0] + 7, pt[1] + 25], [pt[0] + 1, pt[1] + 30]], pal.cloth, 'rgba(60,20,10,.7)');
      ctx.fillStyle = pal.paper; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.label || '酒', pt[0] + 7, pt[1] + 9);
    }
  },
  railing: {   // 二樓前緣欄杆(沿 c = gw 與 r = gh 兩邊)
    bake: function (ctx, S, fl, p, pal) {
      var d = S.def, gw = fl.gw, gh = fl.gh, i, a, b;
      function seg(c0, r0, c1, r1) {
        a = interiorPt(d, fl, c0, r0, 14); b = interiorPt(d, fl, c1, r1, 14);
        ctx.strokeStyle = pal.wood; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        a = interiorPt(d, fl, c0, r0, 5); b = interiorPt(d, fl, c1, r1, 5);
        ctx.strokeStyle = pal.woodDk; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      seg(0, gh, gw, gh); seg(gw, 0, gw, gh);
      for (i = 0; i <= gw; i += 1) { a = interiorPt(d, fl, i, gh, 0); b = interiorPt(d, fl, i, gh, 14); ctx.strokeStyle = pal.woodDk; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      for (i = 0; i <= gh; i += 1) { a = interiorPt(d, fl, gw, i, 0); b = interiorPt(d, fl, gw, i, 14); ctx.strokeStyle = pal.woodDk; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    }
  },
  window: {
    bake: function (ctx, S, fl, p, pal) {
      var c = p.at[0], w = p.size[0], axis = p.axis || 'x', q = itrWallQuad(S, fl, axis, c, c + w, 14, 38), i, a, b;
      itrPoly(ctx, q, pal.sky, pal.beamDk);
      for (i = 1; i < 3; i++) {
        a = itrWallQuad(S, fl, axis, c + w * i / 3, c + w * i / 3, 14, 38); ctx.strokeStyle = pal.beamDk; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0][0], a[0][1]); ctx.lineTo(a[2][0], a[2][1]); ctx.stroke();
      }
      b = itrWallQuad(S, fl, axis, c, c + w, 26, 26); ctx.beginPath(); ctx.moveTo(b[0][0], b[0][1]); ctx.lineTo(b[1][0], b[1][1]); ctx.stroke();
    }
  }
};

// ───────── 背景烘焙 ─────────
function itrShell(ctx, S, fl, pal) {
  var d = S.def, gw = fl.gw, gh = fl.gh, wallH = d.wallH, c, r, P = function (cc, rr, z) { return interiorPt(d, fl, cc, rr, z); };
  // 後牆(兩面)與樑
  itrPoly(ctx, [P(0, 0, 0), P(gw, 0, 0), P(gw, 0, wallH), P(0, 0, wallH)], pal.wall, 'rgba(40,24,12,.6)');
  itrPoly(ctx, [P(0, 0, 0), P(0, gh, 0), P(0, gh, wallH), P(0, 0, wallH)], itrShade(pal.wall, 0.86), 'rgba(40,24,12,.6)');
  itrPoly(ctx, [P(0, 0, wallH - 7), P(gw, 0, wallH - 7), P(gw, 0, wallH), P(0, 0, wallH)], pal.beam);
  itrPoly(ctx, [P(0, 0, wallH - 7), P(0, gh, wallH - 7), P(0, gh, wallH), P(0, 0, wallH)], pal.beamDk);
  itrPoly(ctx, [P(0, 0, 0), P(gw, 0, 0), P(gw, 0, 5), P(0, 0, 5)], pal.beamDk);
  itrPoly(ctx, [P(0, 0, 0), P(0, gh, 0), P(0, gh, 5), P(0, 0, 5)], itrShade(pal.beamDk, 0.9));
  for (c = 0; c <= gw; c += 2) itrPoly(ctx, [P(c - 0.08, 0, 0), P(c + 0.08, 0, 0), P(c + 0.08, 0, wallH), P(c - 0.08, 0, wallH)], pal.beam);
  for (r = 0; r <= gh; r += 2) itrPoly(ctx, [P(0, r - 0.08, 0), P(0, r + 0.08, 0), P(0, r + 0.08, wallH), P(0, r - 0.08, wallH)], pal.beamDk);
  // 地板(棋盤兩色)與前緣厚度
  for (c = 0; c < gw; c++) for (r = 0; r < gh; r++) itrPoly(ctx, [P(c, r, 0), P(c + 1, r, 0), P(c + 1, r + 1, 0), P(c, r + 1, 0)], (c + r) % 2 ? pal.floorA : pal.floorB);
  itrPoly(ctx, [P(0, gh, 0), P(gw, gh, 0), P(gw, gh, -6), P(0, gh, -6)], pal.floorEdge, 'rgba(40,24,12,.6)');
  itrPoly(ctx, [P(gw, 0, 0), P(gw, gh, 0), P(gw, gh, -6), P(gw, 0, -6)], itrShade(pal.floorEdge, 0.8), 'rgba(40,24,12,.6)');
  // 樓層標籤
  ctx.fillStyle = 'rgba(30,20,12,.55)';
  ctx.fillRect(fl.bx + 2, fl.by + fl.H - 17, 38, 15);
  ctx.fillStyle = '#f4ead2'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(fl.label, fl.bx + 21, fl.by + fl.H - 9.5);
}
function itrApplyScene(ctx, S, dpr) { ctx.setTransform(dpr * S.L.s, 0, 0, dpr * S.L.s, dpr * S.L.x0, dpr * S.L.y0); }
function itrBake(S) {
  var t0 = (typeof performance !== 'undefined') ? performance.now() : 0, ctx = itr.bgCtx, dpr = S.dpr, d = S.def, pal = S.pal;
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, itr.bgCv.width, itr.bgCv.height);
  if (INTERIOR_EXT_BG[d.id] && S.extImg) {   // 外部背景圖掛點:有圖就用圖鋪滿舞台,不畫程式地板 / 牆
    ctx.drawImage(S.extImg, 0, 0, itr.bgCv.width, itr.bgCv.height);
  } else {
    itrApplyScene(ctx, S, dpr);
    d.floors.forEach(function (f) { itrShell(ctx, S, S.L.floors[f.id], pal); });
    (d.props || []).forEach(function (p) {
      var k = INTERIOR_KINDS[p.kind], fl = S.L.floors[p.floor];
      if (k && k.bake && !p.dyn) k.bake(ctx, S, fl, p, pal);
    });
    (d.lights || []).forEach(function (l) {
      var fl = S.L.floors[l.floor], pt = interiorPt(d, fl, l.at[0], l.at[1], l.z || 44);
      itrLantern(ctx, pt[0], pt[1], pal);
    });
    if (pal.tint) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = pal.tint; ctx.fillRect(0, 0, itr.bgCv.width, itr.bgCv.height); }
  }
  itr.stats.bakeMs = (typeof performance !== 'undefined') ? performance.now() - t0 : 0;
}

// ───────── 實體(每幀畫的東西,依深度排好)─────────
function itrBuildEnts(S) {
  var d = S.def, list = [];
  (d.props || []).forEach(function (p) {
    var k = INTERIOR_KINDS[p.kind];
    if (!p.dyn || !k || !k.draw) return;
    list.push({ floor: p.floor, depth: k.depth ? k.depth(p) : p.at[0] + p.at[1], draw: function (ctx, fl, t) { k.draw(ctx, S, fl, p, S.pal, t); } });
  });
  (d.seats || []).forEach(function (s) {   // 椅凳:每個座位一個
    list.push({ floor: s.floor, depth: s.at[0] + 1 + s.at[1] + 1 - 0.7, stool: true, draw: function (ctx, fl) { itrBox(ctx, S, fl, s.at[0] + 0.2, s.at[1] + 0.2, 0.6, 0.6, 0, 7, S.pal.woodLt); } });
  });
  S.guestEnts = [];
  if (d.makeGuests) {
    d.makeGuests(S).slice(0, INTERIOR_MAX_DYN - 2).forEach(function (g) { list.push(g); S.guestEnts.push(g); });
  }
  S.npcEnts = [];
  if (d.makeNpcs) d.makeNpcs(S).forEach(function (n) { list.push(n); S.npcEnts.push(n); });
  list.sort(function (a, b) { return a.floor === b.floor ? a.depth - b.depth : (a.floor < b.floor ? -1 : 1); });
  S.ents = list;
  itr.stats.dyn = S.guestEnts.length + S.npcEnts.length;
}
// 人物精靈:ART.chibiSprite(職業外觀 spec)快取;缺 ART 時畫簡單圓點
function interiorDrawPerson(ctx, S, spec, f, frame, x, y, extra) {
  var A = (typeof ART !== 'undefined') ? ART : null, spr, sc = INTERIOR_PERSON_SCALE, res;
  extra = extra || {};
  if (A && A.chibiSprite && spec) {
    res = A.resBucket ? A.resBucket(S.L.s * S.dpr * sc) : 1;
    try { spr = A.chibiSprite(spec, f, frame, res, 'noon', ''); } catch (e) { spr = null; }
  }
  ctx.save();
  ctx.translate(x, y + (extra.dy || 0));
  ctx.scale(sc, sc * (extra.sy || 1));
  if (spr) {
    ctx.drawImage(spr.cv, spr.l, spr.t, spr.cv.width / spr.res, spr.cv.height / spr.res);
    if (extra.after) extra.after(ctx);
  } else {
    itrEllipse(ctx, 0, -20, 8, 14, (spec && spec.tunic) || '#9a6a3a', 'rgba(40,24,12,.7)');
    itrEllipse(ctx, 0, -38, 6, 6, '#e8c9a0', 'rgba(40,24,12,.7)');
  }
  ctx.restore();
}

// ───────── 繪製一幀 ─────────
function itrDraw(now) {
  var S = itr.S, ctx = itr.ctx, dpr, t0 = (typeof performance !== 'undefined') ? performance.now() : 0, t = now / 1000, i, e, fl, ps = (typeof isPowerSave === 'function') && isPowerSave();
  if (!S || !ctx) return;
  dpr = S.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(itr.bgCv, 0, 0);
  itrApplyScene(ctx, S, dpr);
  for (i = 0; i < S.ents.length; i++) {
    e = S.ents[i];
    fl = S.L.floors[e.floor];
    e.draw(ctx, fl, t);
  }
  // 燈火閃動(省電模式不閃)
  (S.def.lights || []).forEach(function (l, k) {
    var f2 = S.L.floors[l.floor], pt = interiorPt(S.def, f2, l.at[0], l.at[1], l.z || 44), a = ps ? 0.34 : 0.3 + 0.12 * Math.sin(t * 5.3 + k * 1.7) + 0.05 * Math.sin(t * 11.1 + k);
    if (!S.glow) return;
    ctx.globalAlpha = a;
    ctx.drawImage(S.glow, pt[0] - 26, pt[1] - 29, 52, 52);
    ctx.globalAlpha = 1;
  });
  if (S.def.drawTop) S.def.drawTop(ctx, S, t);
  itr.stats.lastDrawMs = (typeof performance !== 'undefined') ? performance.now() - t0 : 0;
}
function itrMakeGlow() {
  var cv, g, x;
  if (typeof document === 'undefined') return null;
  cv = document.createElement('canvas'); cv.width = 52; cv.height = 52;
  g = cv.getContext('2d');
  if (!g) return null;
  if (g.createRadialGradient) {
    x = g.createRadialGradient(26, 26, 1, 26, 26, 25);
    x.addColorStop(0, 'rgba(255,214,120,.9)'); x.addColorStop(0.5, 'rgba(255,170,70,.35)'); x.addColorStop(1, 'rgba(255,150,50,0)');
    g.fillStyle = x; g.fillRect(0, 0, 52, 52);
  }
  return cv;
}

// ───────── 輸入 ─────────
// 熱區:NPC 的 hit(S) 回 [cx, cy] 螢幕座標(腳底),矩形取至少 44×44 CSS px
function interiorHitTest(S, x, y) {
  var i, n, p, hw, hh, best = null;
  if (!S) return null;
  for (i = 0; i < S.npcEnts.length; i++) {
    n = S.npcEnts[i];
    if (!n.spot) continue;
    p = interiorToScreen(S, n.footPt(S));
    hw = Math.max(INTERIOR_MIN_HIT / 2, (n.hitW || 18) * S.L.s / 2);
    hh = Math.max(INTERIOR_MIN_HIT, (n.hitH || 46) * S.L.s);
    if (x >= p[0] - hw && x <= p[0] + hw && y >= p[1] - hh && y <= p[1] + 12) { best = n.spot; }
  }
  return best;
}
function itrOnDown(e) { itr.down = { x: e.clientX, y: e.clientY, t: Date.now() }; }
function itrOnUp(e) {
  var d = itr.down, spot;
  itr.down = null;
  if (!d || !itr.S || itr.leaving) return;
  if (Math.abs(e.clientX - d.x) > 12 || Math.abs(e.clientY - d.y) > 12) return;
  spot = interiorHitTest(itr.S, e.clientX, e.clientY);
  if (spot && itr.def.onAct) itr.def.onAct(itr.S, spot);
}
function itrOnKey(e) {
  if (!itr.open || (e.key !== 'Escape' && e.key !== 'Esc')) return;
  if (itrCloseSub()) return;
  interiorLeave();
}
// 子面板(招募介面)開著時,返回 / Esc 先關子面板
function itrCloseSub() {
  if (itr.def && itr.def.closeSub) { try { if (itr.def.closeSub()) return true; } catch (e) { /* 略過 */ } }   // 場景自帶的子面板(城主府 / 科技樹 / 庫房)
  if (typeof cu !== 'undefined' && cu && cu.open && typeof cardsUiClose === 'function') { cardsUiClose(); return true; }
  return false;
}
function itrOnPop() {
  if (!itr.open) return;
  if (itr.histSkip) { itr.histSkip = false; return; }
  itr.histOn = false;
  if (itrCloseSub()) {
    try { history.pushState({ interior: 1 }, ''); itr.histOn = true; } catch (e) { /* 略過 */ }
    return;
  }
  interiorLeave(false, true);
}
function itrOnVis() {
  if (!itr.open) return;
  if (document.visibilityState === 'hidden') {
    itr.paused = true;
    if (itr.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(itr.raf);
    itr.raf = 0;
    if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  } else if (itr.paused) {
    itr.paused = false;
    itr.raf = requestAnimationFrame(itrFrame);
  }
}
function itrOnResize() {
  var ms = [60, 160, 450];
  itr.rzTimers.forEach(function (h) { clearTimeout(h); });
  itr.rzTimers = ms.map(function (m) { return setTimeout(itrResize, m); });
}
function itrBind(on) {
  var f = on ? 'addEventListener' : 'removeEventListener';
  document[f]('visibilitychange', itrOnVis);
  document[f]('keydown', itrOnKey);
  window[f]('popstate', itrOnPop);
  window[f]('resize', itrOnResize);
  window[f]('orientationchange', itrOnResize);
}

// ───────── 版面 / 畫布尺寸 ─────────
function itrViewport() {
  var w = (typeof window !== 'undefined' && window.innerWidth) || 390, h = (typeof window !== 'undefined' && window.innerHeight) || 780;
  return { w: Math.max(120, Math.floor(w)), h: Math.max(160, Math.floor(h)) };
}
function itrResize() {
  var S = itr.S, vp, dpr, bytes, bh;
  if (!itr.open || !S) return;
  vp = itrViewport();
  dpr = Math.min(INTERIOR_DPR_MAX, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  bytes = vp.w * vp.h * dpr * dpr * 4;
  if (bytes > INTERIOR_BG_BYTES_MAX) dpr = Math.sqrt(INTERIOR_BG_BYTES_MAX / (vp.w * vp.h * 4));
  S.vw = vp.w; S.vh = vp.h; S.dpr = dpr;
  bh = (itr.bar && itr.bar.offsetHeight) ? itr.bar.offsetHeight : INTERIOR_BAR_H;
  S.topH = Math.max(INTERIOR_BAR_H, bh);
  S.L = interiorLayout(S.def, vp.w, vp.h, S.topH);
  itr.cv.width = itr.bgCv.width = Math.round(vp.w * dpr);
  itr.cv.height = itr.bgCv.height = Math.round(vp.h * dpr);
  if (itr.cv.style) { itr.cv.style.width = vp.w + 'px'; itr.cv.style.height = vp.h + 'px'; }
  itr.stats.bgBytes = itr.bgCv.width * itr.bgCv.height * 4;
  S.pal = S.def.pal ? S.def.pal(S) : {};
  S.glow = S.glow || itrMakeGlow();
  itrBake(S);
  itrBuildEnts(S);
}

// ───────── 薄列 / layer ─────────
function itrCss() {
  var st;
  if (typeof document === 'undefined' || !document.head || document.getElementById('itrStyle')) return;
  st = document.createElement('style');
  st.id = 'itrStyle';
  st.textContent = '#itrLayer{position:fixed;left:0;top:0;right:0;bottom:0;z-index:70;background:#1c1510;opacity:0;transition:opacity ' + INTERIOR_FADE_MS + 'ms ease;touch-action:none;user-select:none;-webkit-user-select:none}' +
    '#itrLayer.on{opacity:1}#itrLayer canvas{position:absolute;left:0;top:0;display:block}' +
    '#itrBar{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:8px;padding:calc(2px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) 2px calc(8px + env(safe-area-inset-left));min-height:' + INTERIOR_BAR_H + 'px;background:rgba(28,20,14,.82);color:#f4ead2;font-size:15px;z-index:2}' +
    '#itrBar button{min-width:44px;min-height:44px;border:none;border-radius:8px;background:rgba(255,255,255,.14);color:#f4ead2;font-size:20px}#itrBar b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#itrBar span{font-size:13px;opacity:.85;white-space:nowrap}' +
    'html body.in-interior #cardsPanel:not([hidden]){z-index:75 !important}html body.in-interior #toast{z-index:80}';
  document.head.appendChild(st);
}
function itrBuildLayer() {
  var layer = document.createElement('div'), cv = document.createElement('canvas'), bar = document.createElement('div'), back = document.createElement('button'), title = document.createElement('b'), sub = document.createElement('span');
  itrCss();
  layer.id = 'itrLayer';
  bar.id = 'itrBar';
  back.textContent = '↩';
  back.setAttribute('aria-label', '返回城市');
  back.addEventListener('click', function (e) { e.stopPropagation(); interiorLeave(); });
  back.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  back.addEventListener('pointerup', function (e) { e.stopPropagation(); });
  bar.appendChild(back); bar.appendChild(title); bar.appendChild(sub);
  layer.appendChild(cv); layer.appendChild(bar);
  layer.addEventListener('pointerdown', itrOnDown);
  layer.addEventListener('pointerup', itrOnUp);
  layer.addEventListener('pointercancel', function () { itr.down = null; });
  document.body.appendChild(layer);
  itr.layer = layer; itr.cv = cv; itr.ctx = cv.getContext('2d'); itr.bar = bar; itr.backBtn = back; itr.titleEl = title; itr.subEl = sub;
  itr.bgCv = document.createElement('canvas'); itr.bgCtx = itr.bgCv.getContext('2d');
}
function itrSyncBar() {
  var S = itr.S, d = itr.def, tt, ss;
  if (!S || !d) return;
  tt = d.title ? d.title(S) : d.name; ss = d.sub ? d.sub(S) : '';
  if (itr.titleEl && itr.titleEl.textContent !== tt) itr.titleEl.textContent = tt;
  if (itr.subEl && itr.subEl.textContent !== ss) itr.subEl.textContent = ss;
}

// ───────── 主迴圈 ─────────
function itrFrame(now) {
  itr.raf = 0;
  if (!itr.open || itr.paused) return;
  if (typeof perfGateOk === 'function' && !perfGateOk(itr.gate || (itr.gate = perfGateNew()), now)) { itr.raf = requestAnimationFrame(itrFrame); return; }
  itrDraw(now);
  if ((++itr.frames & 15) === 0) itrSyncBar();
  itr.raf = requestAnimationFrame(itrFrame);
}

// ───────── 進出 ─────────
function interiorCanEnter() {
  if (itr.open || typeof game === 'undefined' || !game || game.mode !== 'estate') return false;
  if (typeof draft !== 'undefined' && draft) return false;
  if (typeof document === 'undefined' || !document.body) return false;
  return true;
}
function interiorSnapCity() {
  var s = {};
  try {
    if (typeof panelSnapshot === 'function') s = panelSnapshot() || {};
    else {
      if (typeof pend !== 'undefined' && pend) { s.sel = pend.sel; s.moving = pend.moving; }
      if (typeof view !== 'undefined' && view) s.cam = { x: view.x, y: view.y, zoom: view.zoom };
    }
  } catch (e) { s = {}; }
  return s;
}
function interiorRestoreCity(s) {
  var c;
  if (!s) return;
  try {
    if (typeof pend !== 'undefined' && pend && s.sel !== undefined) { pend.sel = s.sel; pend.moving = s.moving; }
    c = s.cam;
    if (c && typeof view !== 'undefined' && view) { view.x = c.x; view.y = c.y; view.zoom = c.zoom; }
  } catch (e) { /* 略過 */ }
}
function interiorEnter(id, opts) {
  if (!featureOn('interiors')) return false;   // @DORMANT interiors
  var def = INTERIOR_DEFS[id], t0 = (typeof performance !== 'undefined') ? performance.now() : 0, S;
  if (!def || itr.leaving || !interiorCanEnter()) return false;   // 淡出中(≤ 0.3 秒)不重入
  opts = opts || {};
  if (interiorLint(def).length) return false;
  itr.snap = interiorSnapCity();
  try { if (typeof pend !== 'undefined' && pend) { pend.sel = null; pend.moving = null; } } catch (e) { /* 略過 */ }
  if (typeof cardsUiClose === 'function') { try { cardsUiClose(); } catch (e) { /* 略過 */ } }
  if (typeof panelCloseAll === 'function') { try { panelCloseAll(); } catch (e) { /* 略過 */ } }
  S = { def: def, id: id, opts: opts, t0: 0, extImg: null };
  itr.def = def; itr.S = S; itr.leaving = false; itr.paused = false; itr.frames = 0; itr.down = null; itr.gate = null;
  itrBuildLayer();
  itr.open = true;
  game.mode = 'interior';
  if (document.body.classList) document.body.classList.add('in-interior');
  if (def.onEnter) def.onEnter(S);
  itrResize();
  itrSyncBar();
  itrBind(true);
  itr.histOn = false; itr.histSkip = false;
  try { history.pushState({ interior: 1 }, ''); itr.histOn = true; } catch (e) { /* 略過 */ }
  itrDraw((typeof performance !== 'undefined') ? performance.now() : 0);
  itr.stats.enterMs = (typeof performance !== 'undefined') ? performance.now() - t0 : 0;
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(function () { if (itr.layer && itr.layer.classList) itr.layer.classList.add('on'); });
    itr.raf = requestAnimationFrame(itrFrame);
  }
  if (INTERIOR_EXT_BG[id] && typeof Image !== 'undefined') {   // 外部背景圖(缺圖不報錯,維持程式繪製)
    var im = new Image();
    im.onload = function () { if (itr.S === S && itr.open) { S.extImg = im; itrBake(S); } };
    im.onerror = function () { /* 缺圖:沿用程式繪製 */ };
    im.src = 'assets/interior/' + id + '_bg.webp';
  }
  return true;
}
// 離開。immediate:不淡出(測試 / 強制);fromPop:已由返回鍵消耗歷史紀錄
function interiorLeave(immediate, fromPop) {
  var layer = itr.layer, def = itr.def, S = itr.S;
  if (!itr.open || itr.leaving) return false;
  itr.leaving = true;
  itr.open = false;
  if (itr.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(itr.raf);
  itr.raf = 0;
  itrBind(false);
  itr.rzTimers.forEach(function (h) { clearTimeout(h); });
  itr.rzTimers = [];
  if (itr.histOn && !fromPop) {
    itr.histOn = false; itr.histSkip = true;
    try { history.back(); } catch (e) { itr.histSkip = false; }
  }
  itr.histOn = false;
  if (def && def.closeSub) { try { def.closeSub(); } catch (e) { /* 略過 */ } }
  if (typeof cardsUiClose === 'function') { try { cardsUiClose(); } catch (e) { /* 略過 */ } }
  if (typeof panelCloseAll === 'function') { try { panelCloseAll(); } catch (e) { /* 略過 */ } }
  if (def && def.onLeave) { try { def.onLeave(S); } catch (e) { /* 略過 */ } }
  if (document.body.classList) document.body.classList.remove('in-interior');
  game.mode = 'estate';
  interiorRestoreCity(itr.snap);
  itr.snap = null;
  function done() {
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    itr.layer = null; itr.cv = null; itr.ctx = null; itr.bar = null; itr.backBtn = null; itr.titleEl = null; itr.subEl = null; itr.bgCv = null; itr.bgCtx = null;
    itr.S = null; itr.def = null; itr.leaving = false; itr.down = null;
    if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  }
  if (immediate || !layer || !layer.classList || typeof setTimeout !== 'function') done();
  else { layer.classList.remove('on'); setTimeout(done, INTERIOR_FADE_MS + 20); }
  return true;
}
