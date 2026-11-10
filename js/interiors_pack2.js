// js/interiors_pack2.js — 室內空間第二批(PLAN_INTERIORS §5.1):學宮 / 倉廩 / 醫署藥肆 / 市集大堂 / 驛站 / 觀星臺,共 6 個場景,沿用 interiors_pack1.js 的場景引擎(interiorPackDef / ipOnEnter / ipOnAct 等)。
// 資料在 interiors_pack2_data.js。本檔只做三件事:新家具種類 blk2(糧袋堆 / 彩棚攤 / 診榻 / 藥材 / 藥爐 / 鏢車 / 馬槽 / 信函格 / 天球 / 日晷 / 星圖)、包裝第一批的函式以支援新動作(名冊、走鏢、庫存摘要、時辰)與新人物來源(進修生)、進入掛點。
// 包裝方式:先保存第一批原函式,再以同名函式取代(只對 cfg.p2 的場景或新動作生效,其餘一律交回原函式);第一批場景定義已捕捉原函式,不受影響。
// 進入掛點:ui.js tapObjectAt → interiorPack2Tap(o)(在 interiorPackTap 之後);缺 pack1 / interior.js / 非經營模式 / 失敗時回 false,原行為不變。不存檔、不發聲。ES2017;不用 ?. ??。
// 全域名稱:interiorPack2Tap ip2Stock ip2Hour ip2BlockDraw IP2_DECOS

var IP2_DECOS = { sacks: 1, scale: 1, stall: 1, bed: 1, herb: 1, cauldron: 1, cart: 1, trough: 1, mail: 1, globe: 1, sundial: 1, chart: 1 };
var IP2_BRANCH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// ───────── 庫存 / 時辰 ─────────
// 庫存摘要:種類數、平均滿載率、堆量等級 lv(0 近空 ~ 3 滿);缺 goods 模組回全 0
function ip2Stock() {
  var c = null, tot = 0, cap = 0, kinds = 0, k, v, ratio = 0, lv;
  try { c = (typeof goodsCity === 'function') ? goodsCity() : null; } catch (e) { c = null; }
  if (c && c.inv) {
    for (k in c.inv) {
      v = c.inv[k];
      if (typeof v === 'number' && v > 0) {
        kinds++; tot += v;
        try { v = (typeof goodsCapOf === 'function') ? goodsCapOf(k) : 0; if (isFinite(v) && v > 0) cap += v; } catch (e2) { /* 略過 */ }
      }
    }
  }
  ratio = cap > 0 ? Math.min(1, tot / cap) : Math.min(1, tot / 500);
  lv = ratio < 0.04 ? 0 : (ratio < 0.3 ? 1 : (ratio < 0.65 ? 2 : 3));
  return { kinds: kinds, ratio: ratio, lv: lv };
}
function ip2Hour(h) { return IP2_BRANCH[Math.floor(((h + 1) % 24) / 2)]; }

// ───────── 新家具種類 blk2 ─────────
function ip2Star(ctx, x, y, a, col) { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); ctx.globalAlpha = 1; }
function ip2BlockDraw(ctx, S, fl, p, pal, t) {
  var d = S.def, c = p.at[0], r = p.at[1], w = p.size[0], h = p.size[1], z = p.h || 10, col = pal[p.col] || pal.wood, deco = p.deco, tt = S.still ? 0 : (t || 0), pt, i, k, n, a, b, x, y, lv, cnt, off, ang, d0, now;
  if (!IP2_DECOS[deco]) { ipBlockDraw(ctx, S, fl, p, pal, t); return; }
  if (deco === 'sacks') {
    itrBox(ctx, S, fl, c + 0.05, r + 0.05, w - 0.1, h - 0.1, 0, z, pal.woodLt);
    lv = S.stockLv | 0; cnt = lv === 0 ? 1 : Math.max(2, Math.round(w * 2));
    for (k = 0; k < Math.max(1, lv + 1); k++) {
      for (i = 0; i < cnt; i++) {
        pt = interiorPt(d, fl, cnt === 1 ? c + w / 2 : c + 0.28 + i * (w - 0.56) / (cnt - 1), r + h / 2 + (k % 2 ? 0.08 : -0.08), z + k * 5 + 3);
        itrEllipse(ctx, pt[0], pt[1], 9, 5.6, pal.goods[(i + k) % pal.goods.length], 'rgba(40,24,12,.6)');
        itrEllipse(ctx, pt[0] + 0.5, pt[1] - 4.4, 2.8, 1.6, itrShade(pal.goods[(i + k) % pal.goods.length], 0.8), 'rgba(40,24,12,.5)');
      }
    }
  } else if (deco === 'scale') {
    itrBox(ctx, S, fl, c + 0.25, r + 0.25, 0.5, 0.5, 0, 3, col);
    itrBox(ctx, S, fl, c + 0.45, r + 0.45, 0.1, 0.1, 3, 20, pal.woodLt);
    pt = interiorPt(d, fl, c + 0.5, r + 0.5, 20);
    a = Math.sin(tt * 1.3) * 1.4;
    ctx.strokeStyle = pal.metal; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(pt[0] - 10, pt[1] + a); ctx.lineTo(pt[0] + 10, pt[1] - a); ctx.stroke();
    ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(pt[0] - 10, pt[1] + a); ctx.lineTo(pt[0] - 10, pt[1] + a + 8); ctx.moveTo(pt[0] + 10, pt[1] - a); ctx.lineTo(pt[0] + 10, pt[1] - a + 8); ctx.stroke();
    itrEllipse(ctx, pt[0] - 10, pt[1] + a + 9, 5, 2, pal.metalLt, 'rgba(40,24,12,.6)'); itrEllipse(ctx, pt[0] + 10, pt[1] - a + 9, 5, 2, pal.metalLt, 'rgba(40,24,12,.6)');
    itrEllipse(ctx, pt[0] - 10, pt[1] + a + 7, 2.6, 1.8, pal.goods[0]);
  } else if (deco === 'stall') {
    itrBox(ctx, S, fl, c + 0.05, r + 0.25, w - 0.1, h - 0.4, 0, z, col);
    n = Math.max(2, Math.round(w * 2));
    for (i = 0; i < n; i++) {
      pt = interiorPt(d, fl, c + 0.3 + i * (w - 0.6) / (n - 1), r + h / 2 + 0.05, z);
      itrEllipse(ctx, pt[0], pt[1] - 2, 4.6, 3.2, pal.silk[(i + (p.awn | 0)) % pal.silk.length], 'rgba(40,24,12,.55)');
    }
    itrBox(ctx, S, fl, c + 0.02, r + h - 0.12, 0.08, 0.08, 0, 24, pal.woodDk); itrBox(ctx, S, fl, c + w - 0.1, r + h - 0.12, 0.08, 0.08, 0, 24, pal.woodDk);
    itrBox(ctx, S, fl, c - 0.04, r + 0.12, w + 0.08, h - 0.04, 24, 27, pal.awn ? pal.awn[(p.awn | 0) % pal.awn.length] : pal.cloth);
  } else if (deco === 'bed') {
    itrBox(ctx, S, fl, c + 0.05, r + 0.1, w - 0.1, h - 0.2, 0, 4, col);
    itrBox(ctx, S, fl, c + 0.1, r + 0.16, w - 0.2, h - 0.32, 4, 7, pal.paper);
    itrBox(ctx, S, fl, c + 0.14, r + 0.22, 0.4, h - 0.44, 7, 9, pal.cupC || pal.paper);
    itrBox(ctx, S, fl, c + w * 0.45, r + 0.16, w * 0.5 - 0.1, h - 0.32, 7, 9.5, pal.cloth || '#6a8a6a');
  } else if (deco === 'herb') {
    itrBox(ctx, S, fl, c + 0.05, r + 0.1, w - 0.1, h - 0.2, 0, z, col);
    n = Math.max(2, Math.round(w * 2)); d0 = ['#5f8f4a', '#8a6a3a', '#a8b04a', '#7a5a3a'];
    for (i = 0; i < n - 1; i++) {
      pt = interiorPt(d, fl, c + 0.3 + i * (w - 0.6) / (n - 1), r + h / 2, z);
      itrEllipse(ctx, pt[0], pt[1] - 2, 4.2, 2.6, d0[i % d0.length], 'rgba(40,24,12,.5)');
    }
    pt = interiorPt(d, fl, c + w - 0.3, r + h / 2, z);
    itrEllipse(ctx, pt[0], pt[1] - 2, 3.6, 2.2, '#9a9690', 'rgba(40,24,12,.6)'); itrEllipse(ctx, pt[0], pt[1] - 2.6, 2, 1.1, '#3a3632');
  } else if (deco === 'cauldron') {
    itrBox(ctx, S, fl, c + 0.05, r + 0.05, w - 0.1, h - 0.1, 0, z, col);
    pt = interiorPt(d, fl, c + w / 2, r + h / 2, z);
    itrEllipse(ctx, pt[0], pt[1] - 3, 9.5, 5.2, '#2f2a28', 'rgba(20,12,8,.8)'); itrEllipse(ctx, pt[0], pt[1] - 5, 7.4, 3.4, '#6a4a2a');
    for (i = 0; i < 3; i++) {
      off = (tt * 12 + i * 9) % 28;
      ctx.globalAlpha = 0.55 * (1 - off / 28); itrEllipse(ctx, pt[0] + Math.sin(tt * 1.4 + i * 2) * 3 + (i - 1) * 3, pt[1] - 9 - off, 2.4 + off * 0.07, 1.8 + off * 0.05, '#f0eee6'); ctx.globalAlpha = 1;
    }
  } else if (deco === 'cart') {
    itrBox(ctx, S, fl, c + 0.1, r + 0.2, w - 0.2, h - 0.4, 6, 10, col);
    for (i = 0; i < 2; i++) {
      pt = interiorPt(d, fl, c + 0.25 + i * (w - 0.5), r + h - 0.12, 7);
      itrEllipse(ctx, pt[0], pt[1], 3.4, 7.4, pal.woodDk, 'rgba(30,18,8,.8)'); itrEllipse(ctx, pt[0], pt[1], 1.2, 2.4, pal.metalLt);
    }
    itrBox(ctx, S, fl, c + 0.3, r + 0.35, 0.8, 0.7, 10, 19, pal.wood); itrBox(ctx, S, fl, c + w - 1, r + 0.5, 0.65, 0.65, 10, 16, pal.woodLt);
    pt = interiorPt(d, fl, c + w * 0.55, r + h * 0.5, 19); itrEllipse(ctx, pt[0], pt[1], 5, 3, pal.cloth || '#b8332a', 'rgba(40,24,12,.55)');
    a = interiorPt(d, fl, c + 0.1, r + h * 0.5, 8); b = interiorPt(d, fl, c - 0.6, r + h * 0.5 + 0.2, 4);
    ctx.strokeStyle = pal.woodDk; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  } else if (deco === 'trough') {
    itrBox(ctx, S, fl, c + 0.05, r + 0.2, w - 0.1, h - 0.4, 0, z, col);
    itrBox(ctx, S, fl, c + 0.15, r + 0.3, w - 0.5, h - 0.6, z, z + 0.4, '#5a8aa8');
    pt = interiorPt(d, fl, c + w - 0.28, r + h / 2, z); itrEllipse(ctx, pt[0], pt[1] - 2, 4.4, 2.6, '#c9a448', 'rgba(60,40,10,.6)');
  } else if (deco === 'mail') {
    itrBox(ctx, S, fl, c + 0.05, r + 0.05, w - 0.1, h - 0.1, 0, z, col);
    for (k = 0; k < 4; k++) for (i = 0; i < 3; i++) {
      x = c + 0.14 + i * (w - 0.28) / 3; y = 4 + k * 5.4; n = (w - 0.28) / 3 - 0.05;
      itrPoly(ctx, [interiorPt(d, fl, x, r + h - 0.05, y), interiorPt(d, fl, x + n, r + h - 0.05, y), interiorPt(d, fl, x + n, r + h - 0.05, y + 4), interiorPt(d, fl, x, r + h - 0.05, y + 4)], '#2a1c12');
      if ((i + k) % 2) itrPoly(ctx, [interiorPt(d, fl, x + n * 0.1, r + h - 0.05, y + 1), interiorPt(d, fl, x + n * 0.8, r + h - 0.05, y + 1), interiorPt(d, fl, x + n * 0.8, r + h - 0.05, y + 3.4), interiorPt(d, fl, x + n * 0.1, r + h - 0.05, y + 3.4)], pal.paper);
    }
  } else if (deco === 'globe') {
    itrBox(ctx, S, fl, c + 0.22, r + 0.22, 0.56, 0.56, 0, z, col);
    itrBox(ctx, S, fl, c + 0.42, r + 0.42, 0.16, 0.16, z, z + 8, pal.woodLt);
    pt = interiorPt(d, fl, c + 0.5, r + 0.5, z + 18);
    itrEllipse(ctx, pt[0], pt[1], 11, 11, pal.cloth, 'rgba(10,10,40,.8)');
    for (i = 0; i < 7; i++) ip2Star(ctx, pt[0] + ((i * 5 + 3) % 15) - 7, pt[1] + ((i * 7 + 1) % 13) - 6, 0.6 + 0.4 * Math.sin(tt * 2 + i), pal.accent || '#e3c45c');
    ctx.strokeStyle = pal.accent || '#e3c45c'; ctx.lineWidth = 1; ctx.beginPath(); if (ctx.ellipse) ctx.ellipse(pt[0], pt[1], 11, 3.6, -0.3, 0, Math.PI * 2); else ctx.arc(pt[0], pt[1], 11, 0, Math.PI * 2); ctx.stroke();
  } else if (deco === 'sundial') {
    itrBox(ctx, S, fl, c + 0.12, r + 0.12, 0.76, 0.76, 0, z, col);
    pt = interiorPt(d, fl, c + 0.5, r + 0.5, z);
    itrEllipse(ctx, pt[0], pt[1], 12, 6, '#d4cdb8', 'rgba(40,30,20,.7)');
    for (i = 0; i < 12; i++) { a = i * Math.PI / 6; ctx.strokeStyle = 'rgba(60,44,28,.7)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(pt[0] + Math.cos(a) * 8.5, pt[1] + Math.sin(a) * 4.2); ctx.lineTo(pt[0] + Math.cos(a) * 11, pt[1] + Math.sin(a) * 5.5); ctx.stroke(); }
    now = new Date(); ang = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2 + Math.PI;
    ctx.strokeStyle = 'rgba(40,30,20,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(pt[0], pt[1]); ctx.lineTo(pt[0] + Math.cos(ang) * 9, pt[1] + Math.sin(ang) * 4.5); ctx.stroke();
    itrPoly(ctx, [[pt[0] - 2, pt[1]], [pt[0] + 2, pt[1]], [pt[0], pt[1] - 9]], pal.metalLt, 'rgba(40,30,20,.7)');
  } else if (deco === 'chart') {
    itrBox(ctx, S, fl, c + 0.05, r + 0.1, w - 0.1, h - 0.2, 0, z, col);
    itrBox(ctx, S, fl, c + w * 0.08, r + 0.18, w * 0.84, h - 0.36, z, z + 1, '#1f2a5a');
    for (i = 0; i < 6; i++) {
      pt = interiorPt(d, fl, c + w * (0.15 + ((i * 37) % 70) / 100), r + 0.28 + ((i * 53) % 40) / 100 * (h - 0.5), z + 1);
      ip2Star(ctx, pt[0], pt[1], 0.9, pal.accent || '#e3c45c');
    }
  }
}
var INTERIOR_KIND_BLK2 = {
  depth: function (p) { return p.at[0] + p.size[0] + p.at[1] + p.size[1]; },
  draw: ip2BlockDraw,
  bake: function (ctx, S, fl, p, pal) { ip2BlockDraw(ctx, S, fl, p, pal, 0); }
};
if (typeof INTERIOR_KINDS !== 'undefined') INTERIOR_KINDS.blk2 = INTERIOR_KIND_BLK2;

// ───────── 包裝第一批函式(只對 cfg.p2 / 新動作生效,其餘交回原函式)─────────
var ip2Ready = (typeof ipOnEnter === 'function' && typeof ipPeople === 'function' && typeof ipOpenPanel === 'function' && typeof ipRunAct === 'function' &&
  typeof ipSub === 'function' && typeof ipCloseSub === 'function' && typeof ipCss === 'function' && typeof interiorPackDef === 'function' && typeof IP_SCENES !== 'undefined' && typeof IP2_SCENES !== 'undefined');

if (ip2Ready) {
  (function () {
    var oOnEnter = ipOnEnter, oPeople = ipPeople, oOpen = ipOpenPanel, oRun = ipRunAct, oSub = ipSub, oClose = ipCloseSub, oCss = ipCss;

    ipOnEnter = function (S) {
      oOnEnter(S);
      if (S.cfg && S.cfg.p2) S.stockLv = ip2Stock().lv;
    };
    ipOpenPanel = function (act) {
      try {
        if (act.id === 'roster') {
          if (typeof cardsUiOpen !== 'function') return false;
          cardsUiOpen('R');
          return true;
        }
        if (act.id === 'caravan') {
          if (typeof caravanPanelToggle !== 'function') return false;
          if (typeof isUnlocked === 'function' && !isUnlocked('feature', 'caravan')) return false;
          caravanPanelToggle(true);
          return true;
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[interiors2] panel failed', e);
        return false;
      }
      return oOpen(act);
    };
    ipRunAct = function (S, act, ent) {
      var st, txt;
      if (act && act.t === 'info2') {
        if (act.fn === 'stock') {
          st = ip2Stock();
          txt = st.kinds ? '庫中存有 ' + st.kinds + ' 種貨品,平均約 ' + Math.round(st.ratio * 100) + '% 滿載。' : '庫房空空如也,等著進貨。';
        } else if (act.fn === 'hour') {
          txt = '日晷影指「' + ip2Hour(new Date().getHours()) + '時」。';
        } else txt = '';
        ipToast(txt);
        return;
      }
      oRun(S, act, ent);
    };
    ipSub = function (S) {
      var k = S.cfg.subKind, now = ipNow(), st, n, left;
      if (!S.cfg.p2) return oSub(S);
      if (S.subAt && now - S.subAt < 2) return S.subTxt;
      S.subAt = now; S.subTxt = '';
      try {
        if (k === 'academy') S.subTxt = '學官 ' + S.people.length + ' 人';
        else if (k === 'granary') {
          st = ip2Stock(); S.subTxt = '庫存 ' + st.kinds + ' 種 · 約 ' + Math.round(st.ratio * 100) + '%';
        } else if (k === 'clinic') S.subTxt = '醫署 ' + S.people.length + ' 人在診';
        else if (k === 'bazaar') { n = S.items.filter(function (i) { return i.visitor; }).length; S.subTxt = '市令 ' + S.people.length + ' 人 · 逛市 ' + n + ' 位'; }
        else if (k === 'station') {
          left = (typeof caravanLeft === 'function') ? caravanLeft(Date.now()) : null;
          S.subTxt = left === null ? '驛卒 ' + S.people.length + ' 人' : '今日尚可出鏢 ' + left + ' 趟';
        } else if (k === 'obs') S.subTxt = '學官 ' + S.people.length + ' 人 · ' + ip2Hour(new Date().getHours()) + '時';
      } catch (e) { S.subTxt = ''; }
      return S.subTxt;
    };
    ipCloseSub = function () {
      var c = oClose();
      try {
        if (typeof caravanPanelOpen !== 'undefined' && caravanPanelOpen && typeof caravanPanelToggle === 'function') { caravanPanelToggle(false); c = true; }
      } catch (e) { /* 略過 */ }
      return c;
    };
    ipCss = function () {
      var st;
      oCss();
      if (typeof document === 'undefined' || !document.head || !document.createElement || document.getElementById('ip2Style')) return;
      st = document.createElement('style');
      st.id = 'ip2Style';
      st.textContent = 'html body.in-interior #caravanPanel:not([hidden]){z-index:75 !important}';
      document.head.appendChild(st);
    };

    IP2_IDS.forEach(function (id) { IP_SCENES[id] = IP2_SCENES[id]; });
    if (typeof interiorDefine === 'function' && typeof document !== 'undefined') {
      IP2_IDS.forEach(function (id) { try { interiorPackDef(id); } catch (e) { /* 略過 */ } });
    }
  })();
}

// ui.js tapObjectAt 掛點:是第二批建築且可進入就進室內並回 true;否則回 false(原行為不變)
function interiorPack2Tap(o) {
  var m;
  if (!ip2Ready || typeof interiorPackEnter !== 'function') return false;
  m = (o && o.type) ? IP2_BLD[o.type] : null;
  if (!m) return false;
  return interiorPackEnter(m.id);
}
