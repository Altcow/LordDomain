// js/wmap_settle.js — M1 W5 抵達結算 / 占領 / 領地產出 / 放棄 / 離線追趕(設計_M1視覺原型_實作計畫.md W5、3.7;設計_49格地圖_整合規格.md 3.1、3.1a、3.2)。純核心:不碰 DOM / localStorage、不讀時間(now 由呼叫端傳)、不用亂數;node 可測。
// 分工:抵達 → 戰鬥 → 戰報 → 重傷 / 回程全部仍是 wd_core 的 wdRun(wdAssault / wdTripTurn / wdTripHome;不改引擎)。勝利時 wd_core 會把資源格設成 owner 'me'(點 id 'w'+gi);
//   本檔在 wdRun 之後以「冪等對帳」wmapSettleSync 接手:新占領的格 → 判名額(滿了就放掉,戰報註明)→ 建產出記錄 W.g2.own[gi] → 給占領獎勵;之後每整分鐘依 gridResOf(ty, lv) 入帳(糧 res4Add、白材 matGrant)。
//   因為是對帳而不是吃事件流,不論 wdRun 是誰呼叫的(派兵 / 指令 / 開檔 / 背景時鐘),占領都不會漏;離線追趕 = 開啟後第一次 sync 一次補完(時刻照戰報 rp.t / 放棄結束時刻排序)。
// 資料(存在既有 world.v2 的 W.g2,不開新鍵;wd_core 的 wdNorm 呼叫 wmapSettleNorm 保留):
//   W.g2 = { v:1, own:{ '格號': {lv, ty(格名), t0(占領時刻), ac(上次入帳整分時刻), fr:{產出物:小數殘值}, q(放棄結束時刻,0 = 未放棄)} }, n:占領次數, oh:{格號:占領獎勵整點序號} }
//   擁有權的真相 = W.pts 裡 id 'w…'、cat 'res'、owner 'me';own 只是它的產出記錄(沒有 pt 的記錄在 sync 時丟掉)。縣城 / 關口 pt 不是個人領地:不占名額、不產出(只有引擎給的名聲 / 掉落)。
// 名額 = 已占(含放棄中)<  cap;cap = clamp(5, 200, 5 + floor(勢力 / 40)),勢力 = 150(主城 Lv1)+ Σ 武將星級 × 10 + Σ 領地 Lv × 2(數字 PLACEHOLDER,計畫 3.7;呼叫端可用 o.cap 覆寫)。
// 離線入帳上限:單格一次 sync 最多補 WMAPSET_CFG.offCapH(12)小時(規格 3.1a「累積上限 12 小時」;超過部分作廢)。
// ES2017,不用 ?. ??;UTF-8 + LF(與 wmap_go.js 同)。載入順序:wmap_go.js 之後(呼叫時才用 wd_core / wd_grid_data / res4 / mat)。全域名一律 wmapSettle* / WMAPSET_*。
//
// ───────── 公開 API ─────────
//   WMAPSET_CFG                                 {quitMs 300000(放棄倒數)、occH 3(占領獎勵 = 3 小時產量)、offCapH 12、capBase 5、capMax 200、capDiv 40、cityScore 150、starScore 10、lvScore 2}
//   wmapSettleNorm(raw, now) → g2               存檔正規化(wd_core 的 wdNorm 呼叫)
//   wmapSettleG2(W) → g2                        取得 / 建立 W.g2
//   wmapSettleCount(W) → n                      目前個人領地數(owner 'me' 的 'w…' 資源格;頂列「領地」用)
//   wmapSettlePower(W, cs) / wmapSettleCap(W, cs, o) → 勢力 / 名額上限
//   wmapSettleRate(ty, lv) → {key, outName, perHour, perMin}|null     領地每小時 / 每分產出(gridResOf)
//   wmapSettleSync(W, cs, now, o) → {occ[], rej[], quit[], credit{產出物:整數}, bonus{…}, minutes, changed, used, cap}
//        冪等;呼叫端在 wdRun 之後呼叫,再用 wmapSettleApply(credit) 入帳(兩步分開 = 核心不碰資源庫、測試可驗)。
//        occ[] {gi, ty, lv, t, bonus{產出物:n}}、rej[] {gi, ty, lv, t, used, cap}(打贏但名額滿)、quit[] {gi, ty, lv, t}(放棄倒數結束)
//   wmapSettleApply(credit) → 實際入帳 {產出物:n}  res4Add('grain')、matGrant(材料)
//   wmapSettleQuit(W, gi, now) → {ok, err, tEnd}  err: notown quitting;wmapSettleQuitCancel(W, gi) → {ok, err}  err: notown notquitting
//   wmapSettleStatus(W, gi, now) → {own, quit, qLeft, rate, rec}|{own:false}
//   wmapSettleBrief(W, rp, o) → {id, win, gi, kind, title, head, lines[], tone}   快報條 / 戰報頁共用的文字(o.size = 地圖邊長,預設 64)
//   wmapSettleMerge(a, b) → a                   把 b 的產出物數量加進 a(離線摘要用)
//   wmapSettleText(map) → '糧 +12 生鐵 +1'      產出物字串

var WMAPSET_CFG = { quitMs: 300000, occH: 3, offCapH: 12, capBase: 5, capMax: 200, capDiv: 40, cityScore: 150, starScore: 10, lvScore: 2, ohKeep: 400 };
var WMAPSET_MIN = 60000, WMAPSET_HOUR = 3600000;

function wmapSettleIsPtId(id) { return typeof id === 'string' && /^w\d+$/.test(id); }
function wmapSettleInt(x, lo, hi, d) { x = typeof x === 'number' && isFinite(x) ? Math.floor(x) : d; return Math.max(lo, Math.min(hi, x)); }

// ───────── 存檔 ─────────
function wmapSettleNorm(raw, now) {
  var g = { v: 1, own: {}, n: 0, oh: {} }, k, r, fr, fk, v;
  if (!raw || typeof raw !== 'object') return g;
  g.n = wmapSettleInt(raw.n, 0, 1e9, 0);
  if (raw.gv > 0) g.gv = wmapSettleInt(raw.gv, 1, 1e6, 1);   // 世界版本(wm_gen gv);沒記 = 舊世界 gv 2,由 wmapGoMigrate 判斷
  if (raw.own && typeof raw.own === 'object') {
    for (k in raw.own) {
      if (!/^\d{1,8}$/.test(k)) continue;
      r = raw.own[k];
      if (!r || typeof r !== 'object' || typeof r.ty !== 'string') continue;
      fr = {};
      if (r.fr && typeof r.fr === 'object') for (fk in r.fr) { v = r.fr[fk]; if (typeof v === 'number' && isFinite(v) && v > 0 && v < 1e6) fr[fk] = v; }
      g.own[k] = { lv: wmapSettleInt(r.lv, 1, 10, 1), ty: r.ty, t0: wmapSettleInt(r.t0, 0, 1e15, now), ac: wmapSettleInt(r.ac, 0, now, now), fr: fr, q: wmapSettleInt(r.q, 0, 1e15, 0) };
    }
  }
  if (raw.yg && typeof wmapMobNorm === 'function') g.yg = wmapMobNorm(raw.yg);   // 野怪已擊殺紀錄(js/wmap_mob.js)
  if (raw.oh && typeof raw.oh === 'object') {
    Object.keys(raw.oh).slice(-WMAPSET_CFG.ohKeep).forEach(function (kk) { if (/^\d{1,8}$/.test(kk)) g.oh[kk] = wmapSettleInt(raw.oh[kk], 0, 1e9, 0); });
  }
  return g;
}
function wmapSettleG2(W) {
  if (!W.g2 || typeof W.g2 !== 'object' || !W.g2.own) W.g2 = { v: 1, own: {}, n: 0, oh: {} };
  if (!W.g2.oh) W.g2.oh = {};
  return W.g2;
}

// ───────── 查詢 ─────────
function wmapSettlePtOwned(p) { return wmapSettleIsPtId(p.id) && p.cat === 'res' && p.owner === 'me'; }
function wmapSettleCount(W) {
  var n = 0, i;
  for (i = 0; i < W.pts.length; i++) if (wmapSettlePtOwned(W.pts[i])) n++;
  return n;
}
function wmapSettlePower(W, cs) {
  var C = WMAPSET_CFG, p = C.cityScore, i, k, g = W.g2 && W.g2.own ? W.g2.own : {};
  if (cs && cs.roster) for (i = 0; i < cs.roster.length; i++) p += (typeof wdStarOf === 'function' ? wdStarOf(cs.roster[i]) : ((cs.roster[i].starLv) | 0)) * C.starScore;
  for (k in g) p += g[k].lv * C.lvScore;
  return p;
}
function wmapSettleCap(W, cs, o) {
  var C = WMAPSET_CFG;
  if (o && typeof o.cap === 'number' && isFinite(o.cap)) return Math.max(0, Math.floor(o.cap));
  return Math.max(C.capBase, Math.min(C.capMax, C.capBase + Math.floor(wmapSettlePower(W, cs) / C.capDiv)));
}
function wmapSettleRate(ty, lv) {
  var r = typeof gridResOf === 'function' ? gridResOf(ty, lv) : null;
  if (!r) return null;
  return { key: r.key, out: r.out, outName: r.outName, perHour: r.perHour, perMin: r.perHour / 60 };
}
function wmapSettleOutName(out) {
  if (out === 'coin') return '文';
  var L = typeof GRID_RES !== 'undefined' ? GRID_RES.list : [], i;
  for (i = 0; i < L.length; i++) if (L[i].out === out) return L[i].outName;
  return out;
}
function wmapSettleMerge(a, b) {
  var k;
  for (k in b || {}) a[k] = (a[k] || 0) + b[k];
  return a;
}
function wmapSettleText(map) {
  var out = [], k;
  for (k in map || {}) if (map[k] > 0) out.push(wmapSettleOutName(k) + ' +' + map[k]);
  return out.join(' ');
}
function wmapSettleHasAny(map) { var k; for (k in map || {}) if (map[k] > 0) return true; return false; }

// ───────── 產出 ─────────
// 把記錄累積到 upTo(整分);回該段入帳整數 {產出物:n}。超過 offCapH 的部分作廢(ac 照樣推到最新整分)
function wmapSettleAccrue(rec, upTo, credit) {
  var dt = upTo - rec.ac, mins, use, r, v, n, got = {};
  if (!(dt >= WMAPSET_MIN)) return got;
  mins = Math.floor(dt / WMAPSET_MIN);
  use = Math.min(mins, WMAPSET_CFG.offCapH * 60);
  r = wmapSettleRate(rec.ty, rec.lv);
  rec.ac += mins * WMAPSET_MIN;
  if (!r) return got;
  v = (rec.fr[r.out] || 0) + r.perMin * use;
  n = Math.floor(v + 1e-9);
  v = Math.round((v - n) * 1e6) / 1e6;
  if (v > 0) rec.fr[r.out] = v; else delete rec.fr[r.out];
  if (n > 0) { got[r.out] = n; credit[r.out] = (credit[r.out] || 0) + n; }
  return got;
}
function wmapSettleBonus(ty, lv) {   // 占領獎勵:3 小時產量;材料至少 1(規格 3.1a)
  var r = wmapSettleRate(ty, lv), v, o = {};
  if (!r) return o;
  v = r.perHour * WMAPSET_CFG.occH;
  o[r.out] = r.out === 'grain' ? Math.round(v) : Math.max(1, Math.round(v));
  return o;
}

// ───────── 對帳 ─────────
function wmapSettleRpOf(W, ptId) {
  var i, r;
  for (i = 0; i < W.rp.length; i++) { r = W.rp[i]; if (r.pt === ptId && r.win) return r; }
  return null;
}
function wmapSettleDropPt(W, pt) { W.pts = W.pts.filter(function (p) { return p !== pt; }); }
function wmapSettleGiOf(id) { return +id.slice(1); }
function wmapSettleSync(W, cs, now, o) {
  o = o || {};
  var g = wmapSettleG2(W), out = { occ: [], rej: [], quit: [], credit: {}, bonus: {}, minutes: 0, changed: false, used: 0, cap: 0 }, items = [], i, p, k, rp, it, rec, pt, used, cap, hr, bonus, tmp, tripPts = {};
  for (i = 0; i < W.pts.length; i++) {   // 新占領(owner me、還沒有記錄)
    p = W.pts[i];
    if (!wmapSettlePtOwned(p) || g.own[wmapSettleGiOf(p.id)]) continue;
    rp = wmapSettleRpOf(W, p.id);
    items.push({ kind: 'o', t: Math.min(now, rp ? rp.t : now), gi: wmapSettleGiOf(p.id), pt: p, rp: rp });
  }
  for (k in g.own) if (g.own[k].q > 0 && g.own[k].q <= now) items.push({ kind: 'q', t: g.own[k].q, gi: +k });
  items.sort(function (a, b) { return a.t - b.t || (a.kind === b.kind ? a.gi - b.gi : (a.kind === 'q' ? -1 : 1)); });
  for (i = 0; i < items.length; i++) {
    it = items[i];
    if (it.kind === 'q') {   // 放棄倒數結束:結清到結束時刻,釋放名額與格子(無主格不存檔 → 連 pt 一起丟)
      rec = g.own[it.gi];
      if (!rec) continue;
      wmapSettleAccrue(rec, it.t, out.credit);
      delete g.own[it.gi];
      pt = null;
      for (k = 0; k < W.pts.length; k++) if (W.pts[k].id === 'w' + it.gi) pt = W.pts[k];
      if (pt) { pt.owner = null; wmapSettleDropPt(W, pt); }
      out.quit.push({ gi: it.gi, ty: rec.ty, lv: rec.lv, t: it.t });
      out.changed = true;
      continue;
    }
    pt = it.pt;
    used = Object.keys(g.own).length;
    cap = wmapSettleCap(W, cs, o);
    out.used = used; out.cap = cap;
    if (used >= cap) {   // 名額滿:打贏了但不占領(戰鬥獎勵照給);格子放掉
      pt.owner = null; wmapSettleDropPt(W, pt);
      if (it.rp) it.rp.noocc = { used: used, cap: cap };
      out.rej.push({ gi: it.gi, ty: pt.ty, lv: pt.lv, t: it.t, used: used, cap: cap });
      out.changed = true;
      continue;
    }
    g.own[it.gi] = { lv: pt.lv, ty: pt.ty, t0: it.t, ac: it.t, fr: {}, q: 0 };
    g.n++;
    hr = Math.floor(it.t / WMAPSET_HOUR);
    bonus = {};
    if (g.oh[it.gi] !== hr) { bonus = wmapSettleBonus(pt.ty, pt.lv); g.oh[it.gi] = hr; }
    if (wmapSettleHasAny(bonus)) { wmapSettleMerge(out.credit, bonus); wmapSettleMerge(out.bonus, bonus); if (it.rp) it.rp.occ = bonus; }
    out.occ.push({ gi: it.gi, ty: pt.ty, lv: pt.lv, t: it.t, bonus: bonus });
    out.changed = true;
    out.used = used + 1;
  }
  for (i = 0; i < W.trips.length; i++) tripPts[W.trips[i].pt] = 1;
  tmp = [];
  for (i = 0; i < W.pts.length; i++) {   // 沒人要去、無主的地圖資源格(例如戰敗後留下的):不存檔
    p = W.pts[i];
    if (wmapSettleIsPtId(p.id) && p.cat === 'res' && !p.owner && !p.guard && !tripPts[p.id] && !(p.hk > now)) { out.changed = true; continue; }   // 領地多隊失敗後守軍傷勢保留中(p.hk > now)的格不清,可以派第二波;到期才清(再派時守軍回滿)
    tmp.push(p);
  }
  W.pts = tmp;
  for (k in g.own) {   // 沒有對應 pt 的記錄丟掉
    pt = false;
    for (i = 0; i < W.pts.length; i++) if (W.pts[i].id === 'w' + k && W.pts[i].owner === 'me') { pt = true; break; }
    if (!pt) { delete g.own[k]; out.changed = true; }
  }
  for (k in g.own) { rec = g.own[k]; if (rec.ac + WMAPSET_MIN <= now) { wmapSettleAccrue(rec, now, out.credit); out.changed = true; out.minutes++; } }
  if (typeof wmapMobSync === 'function') wmapMobSync(W, cs, now, out);   // 野怪掉落入帳(文 / 糧)與清舊點(js/wmap_mob.js)
  if (!out.used) out.used = Object.keys(g.own).length;
  if (!out.cap) out.cap = wmapSettleCap(W, cs, o);
  return out;
}
function wmapSettleApply(credit) {
  var got = {}, k, g, one;
  for (k in credit || {}) {
    if (!(credit[k] > 0)) continue;
    one = {}; one[k] = credit[k];
    if (k === 'grain' || k === 'coin') { if (typeof res4Add === 'function') { g = res4Add(one); if (g[k] > 0) got[k] = g[k]; } }
    else if (typeof matGrant === 'function') { g = matGrant(one); if (g[k] > 0) got[k] = g[k]; }
  }
  return got;
}

// ───────── 放棄 ─────────
function wmapSettleQuit(W, gi, now) {
  var rec = wmapSettleG2(W).own[gi];
  if (!rec) return { ok: false, err: 'notown' };
  if (rec.q > 0) return { ok: false, err: 'quitting', tEnd: rec.q };
  rec.q = now + WMAPSET_CFG.quitMs;
  return { ok: true, err: '', tEnd: rec.q };
}
function wmapSettleQuitCancel(W, gi) {
  var rec = wmapSettleG2(W).own[gi];
  if (!rec) return { ok: false, err: 'notown' };
  if (!(rec.q > 0)) return { ok: false, err: 'notquitting' };
  rec.q = 0;
  return { ok: true, err: '' };
}
function wmapSettleStatus(W, gi, now) {
  var rec = wmapSettleG2(W).own[gi];
  if (!rec) return { own: false };
  return { own: true, quit: rec.q > 0, qLeft: rec.q > 0 ? Math.max(0, rec.q - now) : 0, rate: wmapSettleRate(rec.ty, rec.lv), rec: rec };
}

// ───────── 快報 / 戰報文字 ─────────
function wmapSettleCoord(gi, size) { var c = gi % size; return '(' + c + ',' + ((gi - c) / size) + ')'; }
function wmapSettleLootTxt(loot) {
  if (!loot) return '';
  if (typeof wdUiLootTxt === 'function') { try { return wdUiLootTxt(loot); } catch (e) { return ''; } }
  return '';
}
function wmapSettleBrief(W, rp, o) {
  o = o || {};
  if (rp.cat === 'yg' && typeof wmapMobBrief === 'function') return wmapMobBrief(rp, o.size || 64);
  var size = o.size || 64, gi = wmapSettleIsPtId(rp.pt) ? wmapSettleGiOf(rp.pt) : -1, kind = rp.cat === 'res' ? 'res' : (rp.cat === 'pass' ? 'pass' : (rp.cat === 'county' ? 'county' : (rp.cat === 'jun' ? 'jun' : 'other'))), name, head, lines = [], tone, lt, occ;
  name = (gi >= 0 ? wmapSettleCoord(gi, size) + ' ' : '') + (kind === 'res' ? 'Lv' + rp.lv + ' ' + rp.ptName : rp.ptName + (kind === 'pass' ? '(關口)' : (kind === 'county' ? '(縣城)' : (kind === 'jun' ? '(郡城)' : ''))));
  if (rp.win) {
    if (kind === 'res') {
      if (rp.noocc) { head = '勝・占領已滿 ' + rp.noocc.used + '/' + rp.noocc.cap + ',未占領'; tone = 'mid'; }
      else { head = '勝・已占領'; tone = 'win'; }
    } else { head = '勝・攻下'; tone = 'win'; }
  } else { head = '敗' + (rp.wipe ? '・全滅,重傷 15 分' : (rp.retreat ? '・已撤退' : '・撤回')); tone = 'lose'; }
  if (!rp.win && kind === 'res' && rp.nf > 1) lines.push('守軍 ' + (rp.down | 0) + '/' + rp.nf + ' 隊擊潰' + (rp.hold > rp.t ? ',傷勢保留 ' + Math.max(1, Math.round((rp.hold - rp.t) / 60000)) + ' 分' : ''));   // 領地多隊:失敗時顯示擊潰隊數與傷勢保留時間
  occ = rp.occ && wmapSettleHasAny(rp.occ) ? wmapSettleText(rp.occ) : '';
  if (occ) lines.push('占領獎勵 ' + occ);
  lt = wmapSettleLootTxt(rp.loot);
  if (lt) lines.push('掉落 ' + lt);
  if (rp.win && rp.fame > 0) lines.push('名聲 +' + rp.fame);
  if (rp.noocc) lines.push('戰鬥獎勵照給;先放棄別格,再派隊來接收');
  return { id: rp.id, win: !!rp.win, gi: gi, kind: kind, title: name, head: head, lines: lines, tone: tone, t: rp.t };
}
