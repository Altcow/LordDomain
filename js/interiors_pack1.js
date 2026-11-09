// js/interiors_pack1.js — 室內空間第一批(PLAN_INTERIORS §5.1):議事廳(城主府)/ 研究院 / 工坊(鐵 / 織 / 窯)/ 客棧 / 縣衙大堂,共 7 個場景定義,沿用 interior.js 的 game.mode = 'interior' 框架。
// 資料在 interiors_pack1_data.js。每個場景兩層(直版上下疊 / 橫版左右並排);背景進場烘一次(離屏),每幀只畫家具與人物,動態人物(名冊人物 + 路人 + 主人 + 熱點標記)≤ 15。
// 人物:名冊人物來自 npcinteract.js npcInteriorPeople(council / workshop / tavern);路人用 crowdparts.js crowdLook,同(種子, 場景, 10 分鐘桶, 時段)恆同;外觀不存檔。
// 互動:點主人 / 名冊人物 / 路人 / 熱點 → 台詞泡泡或開既有面板(城主府、科技樹、庫房 / 鏈條);面板在室內時提高 z-index,返回鍵 / Esc 先關面板再離開。不發聲。
// 進入掛點:ui.js tapObjectAt → interiorPackTap(o);非經營模式 / 缺模組 / 失敗時回 false,原行為(開城主府面板、科技面板、只高亮)照舊。ES2017;不用 ?. ??。
// 全域名稱:interiorPackTap interiorPackEnter interiorPackDef IP_DEFS ipPeople ipSeed ipPeriod

var IP_DEFS = {};
var IP_STYLE_ID = 'ipStyle';

function ipHour() { return new Date().getHours(); }
function ipPeriod(h) {
  var H = IP_CFG.hours;
  if (h >= H.dayFrom && h < H.duskFrom) return 'day';
  if (h >= H.duskFrom && h < H.nightFrom) return 'dusk';
  return 'night';
}
function ipSeed() {
  var cs = null;
  try { cs = (typeof cardsGet === 'function') ? cardsGet() : null; } catch (e) { cs = null; }
  return (cs && cs.seed) ? cs.seed : 1;
}
function ipNow() { return ((typeof performance !== 'undefined') ? performance.now() : Date.now()) / 1000; }
function ipToast(msg) { if (typeof showToast === 'function') { try { showToast(msg); } catch (e) { /* 略過 */ } } }
function ipPeople(cfg) {
  var P = cfg.people, out = [];
  if (!P || typeof npcInteriorPeople !== 'function') return out;
  try { out = npcInteriorPeople(P.kind, P.max, P.opts) || []; } catch (e) { out = []; }
  return out;
}

// ───────── 新家具種類(掛進 interior.js 的 INTERIOR_KINDS)─────────
function ipBlockDraw(ctx, S, fl, p, pal, t) {
  var c = p.at[0], r = p.at[1], w = p.size[0], h = p.size[1], z = p.h || 10, col = pal[p.col] || pal.wood, d = S.def, deco = p.deco, pt, i, a, b, tt = (S && S.still) ? 0 : (t || 0);
  var inset = deco ? 0.06 : 0;
  itrBox(ctx, S, fl, c + inset, r + inset, w - inset * 2, h - inset * 2, 0, z, col);
  if (!deco) return;
  pt = interiorPt(d, fl, c + w / 2, r + h / 2, z);
  if (deco === 'paper') {
    itrBox(ctx, S, fl, c + w * 0.2, r + h * 0.22, w * 0.4, h * 0.5, z, z + 1, pal.paper);
    itrEllipse(ctx, pt[0] + 6, pt[1] + 1, 2.4, 1.2, pal.inkWash, 'rgba(40,24,12,.5)');
  } else if (deco === 'books') {
    for (i = 0; i < 3; i++) itrBox(ctx, S, fl, c + 0.15 + i * w * 0.27, r + h * 0.25, w * 0.22, h * 0.5, z, z + 2.5 + i, pal.books[(i * 2 + c) % pal.books.length]);
  } else if (deco === 'seal') {
    itrBox(ctx, S, fl, c + w * 0.18, r + h * 0.25, w * 0.36, h * 0.5, z, z + 1, pal.paper);
    itrBox(ctx, S, fl, c + w * 0.62, r + h * 0.35, 0.28, 0.28, z, z + 5, pal.accent);
  } else if (deco === 'fire') {
    itrEllipse(ctx, pt[0], pt[1] + 1, 11, 5.2, '#2a1d16', 'rgba(20,12,8,.8)');
    itrEllipse(ctx, pt[0], pt[1] + 1, 7.5, 3.4, pal.fire);
    a = 4.5 + 1.6 * Math.sin(tt * 9);
    itrEllipse(ctx, pt[0], pt[1] - 2, 4, a, pal.fire); itrEllipse(ctx, pt[0], pt[1] - 1, 2.2, a * 0.6, pal.fireLt);
    itrBox(ctx, S, fl, c + 0.1, r + 0.1, w - 0.2, 0.22, z, z + 14, pal.stone);
  } else if (deco === 'anvil') {
    itrBox(ctx, S, fl, c + 0.22, r + 0.22, 0.56, 0.56, z, z + 6, pal.metal);
    itrBox(ctx, S, fl, c + 0.1, r + 0.34, 0.8, 0.3, z + 6, z + 9, pal.metalLt);
  } else if (deco === 'loom') {
    itrBox(ctx, S, fl, c + 0.12, r + 0.12, 0.14, 0.14, z, z + 12, pal.woodDk);
    itrBox(ctx, S, fl, c + w - 0.26, r + 0.12, 0.14, 0.14, z, z + 12, pal.woodDk);
    for (i = 0; i < 5; i++) {
      a = interiorPt(d, fl, c + 0.2 + i * (w - 0.4) / 4, r + 0.15, z + 8); b = interiorPt(d, fl, c + 0.2 + i * (w - 0.4) / 4, r + h - 0.15, z + 3);
      ctx.strokeStyle = pal.silk[i % pal.silk.length]; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    itrBox(ctx, S, fl, c + 0.14, r + h - 0.3, w - 0.28, 0.2, z, z + 3, pal.woodLt);
  } else if (deco === 'wheel') {
    itrEllipse(ctx, pt[0], pt[1] - 1, 9, 4.4, pal.woodLt, 'rgba(40,24,12,.6)');
    itrEllipse(ctx, pt[0], pt[1] - 6, 4.2, 5.2, pal.clay, 'rgba(40,24,12,.6)');
    itrEllipse(ctx, pt[0], pt[1] - 10, 2.6, 1.2, pal.woodDk);
  } else if (deco === 'kiln') {
    itrEllipse(ctx, pt[0], pt[1] - 8, 17, 14, pal.clay, 'rgba(60,30,16,.7)');
    itrEllipse(ctx, pt[0], pt[1] - 3, 7, 5, '#241810');
    a = 3 + 1.2 * Math.sin(tt * 8);
    itrEllipse(ctx, pt[0], pt[1] - 2, 3.4, a, pal.fire);
  } else if (deco === 'crate') {
    itrBox(ctx, S, fl, c + 0.14, r + 0.16, w * 0.46, h * 0.68, z, z + 8, pal.woodLt);
    itrBox(ctx, S, fl, c + w * 0.58, r + 0.22, w * 0.3, h * 0.55, z, z + 5, pal.goods[1]);
  } else if (deco === 'ring') {
    itrBox(ctx, S, fl, c + 0.5, r + 0.5, w - 1, h - 1, z, z + 10, pal.wood);
    pt = interiorPt(d, fl, c + w / 2, r + h / 2, z + 10);
    for (i = 0; i < 3; i++) {
      ctx.save(); ctx.translate(pt[0], pt[1] - 14); ctx.rotate(i * 1.05 + tt * 0.35); ctx.scale(1, 0.34 + 0.1 * i);
      ctx.strokeStyle = i === 1 ? pal.accent : pal.metalLt; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, 15 - i * 1.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    itrEllipse(ctx, pt[0], pt[1] - 14, 3.4, 3.4, pal.accent, 'rgba(60,40,10,.7)');
  } else if (deco === 'drum') {
    itrEllipse(ctx, pt[0], pt[1] - 5, 10, 8, '#b8332a', 'rgba(60,20,10,.8)');
    itrEllipse(ctx, pt[0], pt[1] - 12, 9, 4, pal.paper, 'rgba(60,40,20,.7)');
  }
}
var INTERIOR_KIND_BLOCK = {
  depth: function (p) { return p.at[0] + p.size[0] + p.at[1] + p.size[1]; },
  draw: ipBlockDraw,
  bake: function (ctx, S, fl, p, pal) { ipBlockDraw(ctx, S, fl, p, pal, 0); }
};
function ipShelfBake(ctx, S, fl, p, pal) {
  var d = S.def, c = p.at[0], w = p.size[0], row, i, n, u, pt, k = p.items || 'books', zs = [4, 15, 26], z, hh;
  itrPoly(ctx, itrWallQuad(S, fl, 'x', c, c + w, 3, 37), pal.woodDk, 'rgba(40,24,12,.7)');
  for (row = 0; row < 3; row++) {
    z = zs[row];
    itrPoly(ctx, itrWallQuad(S, fl, 'x', c, c + w, z, z + 1.6), pal.woodLt);
    n = Math.max(2, Math.floor(w * 3));
    for (i = 0; i < n; i++) {
      u = c + 0.2 + i * (w - 0.4) / n;
      pt = interiorPt(d, fl, u, 0.06, z + 1.6);
      if (k === 'books') { hh = 7 + ((i + row) % 3) * 1.6; ctx.fillStyle = pal.books[(i + row * 2) % pal.books.length]; ctx.fillRect(pt[0] - 1.6, pt[1] - hh, 3.2, hh); }
      else if (k === 'scrolls') { ctx.fillStyle = pal.paper; ctx.fillRect(pt[0] - 1.8, pt[1] - 7, 3.6, 7); ctx.fillStyle = pal.cloth; ctx.fillRect(pt[0] - 1.8, pt[1] - 7, 3.6, 1.6); }
      else if (k === 'tools') { ctx.fillStyle = (i + row) % 2 ? pal.metal : pal.metalLt; ctx.fillRect(pt[0] - 0.8, pt[1] - 8 - (i % 3), 1.6, 8 + (i % 3)); ctx.fillRect(pt[0] - 2.4, pt[1] - 8 - (i % 3), 4.8, 1.8); }
      else if (k === 'bolts') { ctx.fillStyle = pal.silk[(i + row) % pal.silk.length]; ctx.fillRect(pt[0] - 2.8, pt[1] - 6.5, 5.6, 6.5); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(pt[0] - 2.8, pt[1] - 6.5, 5.6, 1.2); }
      else if (k === 'pots') { itrEllipse(ctx, pt[0], pt[1] - 4, 3.2, 4.2, pal.pots[(i + row) % pal.pots.length], 'rgba(40,24,12,.6)'); }
      else { ctx.fillStyle = pal.goods[(i + row) % pal.goods.length]; ctx.fillRect(pt[0] - 3, pt[1] - 5.5, 6, 5.5); ctx.strokeStyle = 'rgba(40,24,12,.5)'; ctx.lineWidth = 0.6; ctx.strokeRect(pt[0] - 3, pt[1] - 5.5, 6, 5.5); }
    }
  }
}
if (typeof INTERIOR_KINDS !== 'undefined') {
  INTERIOR_KINDS.block = INTERIOR_KIND_BLOCK;
  INTERIOR_KINDS.shelf = { bake: ipShelfBake };
}

// ───────── 場景邏輯 ─────────
function ipPal(S) {
  var theme = (typeof themeGet === 'function') ? themeGet() : 'han', base = (typeof TAVERN_PALS !== 'undefined') ? (TAVERN_PALS[theme] || TAVERN_PALS.han) : {}, p = Object.assign({}, base, IP_EXTRA, S.cfg.pal || {});
  p.tint = S.period === 'night' ? 'rgba(24,26,70,.24)' : (S.period === 'dusk' ? 'rgba(130,70,24,.12)' : null);
  return p;
}
function ipKeeperSpec(cfg) {
  var K = cfg.keeper, L = K.look, base = (typeof crowdLook === 'function') ? crowdLook(L.job, L.key, 'han') : null;
  if (!base) return null;
  return Object.assign({}, base, { id: 'ip_' + cfg.id + '_keeper', head: L.head || base.head, headCol: L.headCol || base.headCol, tunic: L.tunic || base.tunic, trim: L.trim || base.trim, pants: '#5a4a3a', prop: undefined, beard: false, scale: 1.02 });
}
function ipSlotPt(S, s, dz) { return interiorPt(S.def, S.L.floors[s.floor], s.at[0] + 0.5, s.at[1] + 0.5, (s.z || 0) + (dz || 0)); }
function ipFoot(S, it) { return ipSlotPt(S, it.slot, it.slot.sit ? 6 : 0); }
function ipSlotDepth(s) { return s.sit ? s.at[0] + 1 + s.at[1] + 1 - 0.7 + 0.01 : s.at[0] + s.at[1] + 1.01; }

function ipOnEnter(S) {
  var cfg = S.def.cfg, now = new Date(), seed = ipSeed(), rng, people, vs = [], ps = [], gs = [], items = [], i, j, t, n, V = cfg.visitors, region = (typeof world !== 'undefined' && world && world.ethRegion) || 'zhongyuan', cap, jobs, eth, job;
  S.cfg = cfg; S.period = ipPeriod(now.getHours()); S.bucket = Math.floor(now.getTime() / IP_CFG.bucketMs); S.seed = seed; S.tapN = 0; S.bub = null; S.bowAt = -9;
  S.still = (typeof isPowerSave === 'function') && isPowerSave();
  cfg.slots.forEach(function (s) { if (s.role === 'g') gs.push(s); else if (s.role === 'p') ps.push(s); else vs.push(s); });
  people = ipPeople(cfg);
  S.people = people;
  // 名冊人物入座:太守上高台,其餘依序入 'p' 站位
  people.forEach(function (pp) {
    var slot = null, k;
    if (pp.post === 'gov' && gs.length) slot = gs.shift();
    else if (ps.length) slot = ps.shift();
    if (!slot) return;
    items.push({ slot: slot, person: pp, name: pp.name, post: pp.post, spec: pp.spec || ((typeof crowdLook === 'function') ? crowdLook(pp.job || 'official', interiorHash(pp.id, 'ip'), 'han') : null), ph: (interiorHash(pp.id, 'ph') % 100) / 20, rate: slot.sit ? 0.5 : 1.6 });
    k = 0;
  });
  // 路人:確定性挑站位與外觀
  rng = interiorRng(interiorHash('ipV', cfg.id, seed, S.bucket, S.period));
  n = V.n[0] + Math.floor(rng() * (V.n[1] - V.n[0] + 1));
  if (S.period === 'night') n = Math.max(V.n[0], n - 1);
  cap = Math.max(0, IP_CFG.maxDyn - items.length - 1 - cfg.hotspots.length);
  n = Math.min(n, vs.length, cap);
  for (i = vs.length - 1; i > 0; i--) { j = Math.floor(rng() * (i + 1)); t = vs[i]; vs[i] = vs[j]; vs[j] = t; }
  for (i = 0; i < n; i++) {
    job = vs[i].job || V.jobs[Math.floor(rng() * V.jobs.length)];
    eth = (typeof ethnicPick === 'function') ? ethnicPick(region, rng()) : 'han';
    items.push({ slot: vs[i], visitor: true, spec: (typeof crowdLook === 'function') ? crowdLook(job, Math.floor(rng() * 1e6), eth) : null, ph: Math.round(rng() * 500) / 100, rate: 0.5 + rng() * 0.5 });
  }
  S.items = items;
  S.keeperSpec = ipKeeperSpec(cfg);
}

function ipDrawName(ctx, name, x, y) {
  ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  var w = Math.ceil(ctx.measureText(name).width) + 6;
  ctx.fillStyle = 'rgba(30,20,12,.62)'; ctx.fillRect(x - w / 2, y - 5, w, 10);
  ctx.fillStyle = '#f4ead2'; ctx.fillText(name, x, y + 0.5);
}
function ipMakeNpcs(S) {
  var d = S.def, cfg = S.cfg, list = [], K = cfg.keeper;
  S.items.forEach(function (it) {
    var s = it.slot;
    list.push({
      floor: s.floor, depth: ipSlotDepth(s), hitW: 24, hitH: 50, it: it,
      spot: it.visitor ? { kind: 'visitor', it: it } : { kind: 'person', it: it },
      footPt: function (SS) { return ipFoot(SS, it); },
      draw: function (ctx, fl, t) {
        var tt = S.still ? 0 : t + it.ph, frame = S.still ? 0 : Math.floor(tt * it.rate) % 2, p = interiorPt(d, fl, s.at[0] + 0.5, s.at[1] + 0.5, (s.z || 0) + (s.sit ? 6 : 0)), dy = s.sit ? 3 : 0;
        if (!S.still && !s.sit) dy += Math.sin(tt * 1.1) * 0.5;
        interiorDrawPerson(ctx, S, it.spec, s.face, frame, p[0], p[1], { dy: dy, sy: s.kneel ? 0.8 : 1 });
        if (it.name) ipDrawName(ctx, it.name, p[0], p[1] + 10);
      }
    });
  });
  list.push({
    floor: K.floor, depth: K.at[0] + K.at[1] + 1.02, hitW: 24, hitH: 50, spot: { kind: 'keeper' },
    footPt: function (SS) { return interiorPt(d, SS.L.floors[K.floor], K.at[0] + 0.5, K.at[1] + 0.5, 0); },
    draw: function (ctx, fl, t) {
      var p = interiorPt(d, fl, K.at[0] + 0.5, K.at[1] + 0.5, 0), bow = (t - S.bowAt) < 0.7 && (t - S.bowAt) >= 0, frame = S.still ? 0 : Math.floor(t * 1.2) % 2;
      interiorDrawPerson(ctx, S, S.keeperSpec, 0, frame, p[0], p[1], { dy: bow ? 2 : 0, sy: bow ? 0.94 : 1 });
      ipDrawName(ctx, K.name, p[0], p[1] + 10);
    }
  });
  cfg.hotspots.forEach(function (h) {
    list.push({
      floor: h.floor, depth: h.at[0] + h.at[1] + 2.5, hitW: 30, hitH: 36, spot: { kind: 'hot', h: h },
      footPt: function (SS) { return interiorPt(d, SS.L.floors[h.floor], h.at[0] + 0.5, h.at[1] + 0.5, 0); },
      draw: function (ctx, fl, t) {
        var p = interiorPt(d, fl, h.at[0] + 0.5, h.at[1] + 0.5, 0), a = S.still ? 0.8 : 0.55 + 0.3 * Math.sin(t * 3 + h.at[0]);
        ctx.globalAlpha = a; itrEllipse(ctx, p[0], p[1] - 40, 4.2, 4.2, '#ffd36a', 'rgba(90,50,10,.8)'); ctx.globalAlpha = 1;
      }
    });
  });
  return list;
}
function ipBubble(ctx, px, py, line) {
  var w, x, y = py - 66, h = 15;
  ctx.font = '9px sans-serif';
  w = Math.ceil(ctx.measureText(line).width) + 12;
  x = px - w / 2 + 8;
  ctx.fillStyle = 'rgba(255,250,236,.96)'; ctx.strokeStyle = 'rgba(70,46,24,.85)'; ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x + 5, y); ctx.lineTo(x + w - 5, y); ctx.quadraticCurveTo(x + w, y, x + w, y + 5); ctx.lineTo(x + w, y + h - 5); ctx.quadraticCurveTo(x + w, y + h, x + w - 5, y + h);
  ctx.lineTo(px + 6, y + h); ctx.lineTo(px + 2, y + h + 6); ctx.lineTo(px - 2, y + h); ctx.lineTo(x + 5, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - 5); ctx.lineTo(x, y + 5); ctx.quadraticCurveTo(x, y, x + 5, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2a1c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(line, x + w / 2, y + h / 2 + 0.5);
}
function ipDrawTop(ctx, S, t) {
  var b = S.bub, cfg = S.cfg, K = cfg.keeper, cyc = t % IP_CFG.bubbleCycle, p, line;
  if (b && t >= b.t0 && t - b.t0 < IP_CFG.tapBubbleSec) {
    p = b.ent.footPt(S);
    ipBubble(ctx, p[0], p[1], b.text);
    return;
  }
  if (cyc > IP_CFG.bubbleOn || !S.npcEnts.length) return;
  line = K.lines[(Math.floor(t / IP_CFG.bubbleCycle) + S.seed + S.bucket) % K.lines.length];
  p = interiorPt(S.def, S.L.floors[K.floor], K.at[0] + 0.5, K.at[1] + 0.5, 0);
  ipBubble(ctx, p[0], p[1], line);
}
function ipSay(S, ent, text) {
  if (!ent) return;
  if (text.length <= 22) S.bub = { ent: ent, text: text, t0: ipNow() };
  else { S.bub = null; ipToast(text); }
}
function ipEntOf(S, spot) {
  var i;
  for (i = 0; i < S.npcEnts.length; i++) if (S.npcEnts[i].spot === spot) return S.npcEnts[i];
  return null;
}
function ipPick(S, arr, salt) { return arr[interiorHash('ipPick', S.cfg.id, S.seed, S.bucket, salt || '', S.tapN) % arr.length]; }

// 開既有面板;回 true = 已開
function ipOpenPanel(act) {
  try {
    if (act.id === 'lordhall' && typeof lordhallOpen === 'function') { lordhallOpen(act.arg); return true; }
    if (act.id === 'tech' && typeof techPanelOpen === 'function') return techPanelOpen() !== false;
    if (act.id === 'goods' && typeof goodsPanelToggle === 'function') { goodsPanelToggle(true); return true; }
    if (act.id === 'chain' && typeof goodsOpenChain === 'function') { goodsOpenChain(); return true; }
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[interiors] panel failed', e);
  }
  return false;
}
function ipTechBrief() {
  var s = null, lines = [], cur;
  try {
    s = (typeof techState === 'function') ? techState() : null;
    if (s && s.cur && s.cur.length) {
      s.cur.slice(0, 2).forEach(function (c) { var n = (typeof techNode === 'function') ? techNode(c.id) : null; lines.push('研發中:' + (n ? ((typeof techLabelOf === 'function') ? techLabelOf(n) : n.name) : c.id) + (typeof techFmtTime === 'function' ? ' 剩 ' + techFmtTime(c.left) : '')); });
      return lines.join(';');
    }
    if (typeof techSummary === 'function') return techSummary();
  } catch (e) { cur = 0; }
  return '渾天儀緩緩轉動,尚無研發。';
}
function ipRunAct(S, act, ent) {
  var cfg = S.cfg, txt;
  if (act.t === 'panel') {
    if (!ipOpenPanel(act)) ipToast('這項功能尚未開放');
  } else if (act.t === 'info') {
    ipToast(act.fn === 'tech' ? ipTechBrief() : '');
  } else if (act.t === 'story' || act.t === 'case') {
    S.tapN++;
    txt = ipPick(S, act.t === 'story' ? cfg.stories : cfg.cases, act.t);
    ipSay(S, ent, txt);
  } else if (act.t === 'talk') {
    ipSay(S, ent, act.line);
  }
}
function ipOnAct(S, spot) {
  var cfg = S.cfg, ent, it, lines, line;
  if (!spot) return;
  ent = ipEntOf(S, spot);
  S.tapN++;
  if (spot.kind === 'keeper') {
    S.bowAt = ipNow();
    if (cfg.keeper.act.t === 'story' || cfg.keeper.act.t === 'case') { ipRunAct(S, cfg.keeper.act, ent); return; }
    ipSay(S, ent, ipPick(S, cfg.keeper.lines, 'k'));
    ipRunAct(S, cfg.keeper.act, ent);
  } else if (spot.kind === 'hot') {
    ipRunAct(S, spot.h.act, ent);
  } else if (spot.kind === 'person') {
    it = spot.it; lines = IP_LINES_PERSON[it.post] || IP_LINES_PERSON._;
    line = ipPick(S, lines, it.name);
    ipSay(S, ent, line);
  } else if (spot.kind === 'visitor') {
    ipSay(S, ent, ipPick(S, cfg.lines, 'v'));
  }
}
function ipTitle(S) { return S.cfg.title; }
function ipSub(S) {
  var k = S.cfg.subKind, o, s, now = ipNow();
  if (S.subAt && now - S.subAt < 2) return S.subTxt;
  S.subAt = now;
  try {
    if (k === 'council' && typeof lordhallOverview === 'function') { o = lordhallOverview(); S.subTxt = '官階 ' + o.rank + ' · 人口 ' + (typeof fmtPop === 'function' ? fmtPop(o.pop) : o.pop); }
    else if (k === 'research') {
      s = (typeof techState === 'function') ? techState() : null;
      S.subTxt = (s && s.cur && s.cur.length) ? '研發中 ' + s.cur.length + ' 項 · 學識 ' + Math.floor(s.xue || 0) : (s ? '學識 ' + Math.floor(s.xue || 0) : '');
    }
    else if (k === 'work') S.subTxt = '派駐 ' + S.people.length + ' 人';
    else if (k === 'inn') S.subTxt = '旅人 ' + S.items.filter(function (i) { return i.visitor || i.person; }).length + ' 位';
    else if (k === 'court') S.subTxt = '賊曹 ' + S.people.length + ' 人在堂';
    else S.subTxt = '';
  } catch (e) { S.subTxt = ''; }
  return S.subTxt;
}
// 室內開著的既有面板:返回 / Esc 先關面板;離開時一併關閉
function ipCloseSub() {
  var c = false;
  try {
    if (typeof lh !== 'undefined' && lh && lh.open && typeof lordhallClose === 'function') { lordhallClose(); c = true; }
    if (typeof techPanelIsOpen === 'function' && techPanelIsOpen() && typeof techPanelClose === 'function') { techPanelClose(); c = true; }
    if (typeof goodsPanelOpen !== 'undefined' && goodsPanelOpen && typeof goodsPanelToggle === 'function') { goodsPanelToggle(false); c = true; }
  } catch (e) { /* 略過 */ }
  return c;
}
function ipCss() {
  var st;
  if (typeof document === 'undefined' || !document.head || !document.createElement || document.getElementById(IP_STYLE_ID)) return;
  st = document.createElement('style');
  st.id = IP_STYLE_ID;
  st.textContent = 'html body.in-interior :is(#lordhall,#techTreePanel,#goodsPanel):not([hidden]){z-index:75 !important}html body.in-interior #lordhall{top:calc(54px + env(safe-area-inset-top)) !important;max-height:calc(100vh - 66px) !important}';
  document.head.appendChild(st);
}

function interiorPackDef(id) {
  var cfg = IP_SCENES[id], seats = [], def;
  if (IP_DEFS[id]) return IP_DEFS[id];
  if (!cfg || typeof interiorDefine !== 'function' || typeof TAVERN_PALS === 'undefined') return null;
  cfg.slots.forEach(function (s) { if (s.sit) seats.push({ floor: s.floor, at: s.at, face: s.face }); });
  def = interiorDefine({
    id: id, name: cfg.name, bld: cfg.bld, cfg: cfg, floors: cfg.floors, props: cfg.props, seats: seats, npcs: [{ id: 'keeper', floor: cfg.keeper.floor, at: cfg.keeper.at, act: 'keeper' }], lights: cfg.lights,
    pal: ipPal, makeGuests: function () { return []; }, makeNpcs: ipMakeNpcs, drawTop: ipDrawTop, onEnter: ipOnEnter, onAct: ipOnAct, closeSub: ipCloseSub, title: ipTitle, sub: ipSub
  });
  IP_DEFS[id] = def;
  return def;
}
function interiorPackEnter(id) {
  if (typeof interiorEnter !== 'function' || !interiorPackDef(id)) return false;
  ipCss();
  try { return !!interiorEnter(id); } catch (e) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[interiors] enter failed', e);
    if (typeof interiorActive === 'function' && interiorActive()) { try { interiorLeave(true); } catch (e2) { /* 略過 */ } }
    return false;
  }
}
// ui.js tapObjectAt 掛點:是第一批建築且可進入就進室內並回 true;否則回 false(原行為不變)
function interiorPackTap(o) {
  var m = (o && o.type) ? IP_BLD[o.type] : null;
  if (!m) return false;
  return interiorPackEnter(m.id);
}
if (typeof interiorDefine === 'function' && typeof document !== 'undefined') {
  Object.keys(IP_SCENES).forEach(function (id) { try { interiorPackDef(id); } catch (e) { /* 略過 */ } });
}
