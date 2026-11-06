// js/npcvisit.js — 在野名人路過:名冊空也會有名人 NPC(CARD_FIGS 金 / 紫階)從城門進城,沿道路逛一圈後離開;點他看人物小卡(頭像 + 專屬台詞 + 「在野」提示),
// 每位來訪名人首次被點擊給小獎勵(CARD_VISIT.reward,每日有次數上限)。不可直接招募、不碰抽卡機率與卡包、不占居民額度(n.ext = true,與名冊 hero 同機制)。
// 確定性:名單 = 以(世界編號 + 遊戲日)為種子的加權抽樣(CARD_FIG_WEIGHT);預定抵達時間窗過了就不補演(離線 / 讀檔不補演);
// 當日已演出名額 / 名人 / 已領獎勵記在 localStorage 'lorddomain.visit.v1'(世界內進度鍵,SAVE_SLOT_KEYS;有值才寫)。
// 掛點(citylife.js):lifeFrame → npcVisitTick(dt);lifeDrawDiag → npcVisitHidden / npcVisitHalo / npcVisitStar;lifeTap → npcVisitHidden;lifeCardShow / lifeCardHide → npcVisitCardShow / npcVisitCardHide。
// 外觀沿用 npcinteract.js 的 npcHeroSpec(以名人偽名冊項目呼叫)。全部 typeof 守衛外部模組;不發聲。ES2017(不使用可選串接與空值合併運算子)。
// 全域名稱:NPCV npcVisitPlan npcVisitTick npcVisitSpawn npcVisitHidden npcVisitHalo npcVisitStar npcVisitCardShow npcVisitCardHide npcVisitClaim npcVisitStats

var NPCV_KEY = 'lorddomain.visit.v1';
var NPCV = { t: 0, drawOk: true, now: null, plan: null, planSig: '', rec: null, recRaw: undefined, talkN: {}, ve: {}, order: null, orderSig: '', spawned: 0, claimed: 0,
  card: { box: null, line: null, msg: '' } };

function nvNow() { return NPCV.now ? NPCV.now() : Date.now(); }
function nvHash() {
  var s = Array.prototype.join.call(arguments, '|'), h = 2166136261, i;
  for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}
function nvRng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function nvDay(now) { return (typeof npcDayOf === 'function') ? npcDayOf(now) : Math.floor(now / 86400000); }
function nvWorld() { try { return (typeof worldsActive === 'function') ? (worldsActive() | 0) : 1; } catch (e) { return 1; } }
function nvEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function nvToast(s) { if (s && typeof showToast === 'function') { try { showToast(s); } catch (e) { /* 略過 */ } } }

// ───────── 當日紀錄(有值才寫) ─────────
function nvStrList(a, max) {
  var out = [], i;
  if (!Array.isArray(a)) return out;
  for (i = 0; i < a.length && out.length < max; i++) if (typeof a[i] === 'string' && a[i].length <= 24 && out.indexOf(a[i]) < 0) out.push(a[i]);
  return out;
}
// 讀取並正規化當日紀錄(不是今天 = 空);以原字串快取,世界 / 回溯點切換改 localStorage 後自動重讀
function nvRecGet(day) {
  var raw = null, d = null, r;
  try { raw = localStorage.getItem(NPCV_KEY); } catch (e) { raw = null; }
  if (NPCV.rec && raw === NPCV.recRaw && NPCV.rec.d === day) return NPCV.rec;
  if (raw) { try { d = JSON.parse(raw); } catch (e2) { d = null; } }
  r = { d: day, s: [], f: [], c: [] };
  if (d && typeof d === 'object' && (d.d | 0) === day) {
    if (Array.isArray(d.s)) d.s.forEach(function (k) { k = k | 0; if (k >= 0 && k < 8 && r.s.indexOf(k) < 0) r.s.push(k); });
    r.f = nvStrList(d.f, 8); r.c = nvStrList(d.c, 8);
  }
  NPCV.rec = r; NPCV.recRaw = raw;
  return r;
}
function nvRecSave(r) {
  var raw;
  try { raw = JSON.stringify({ d: r.d, s: r.s, f: r.f, c: r.c }); localStorage.setItem(NPCV_KEY, raw); NPCV.recRaw = raw; NPCV.rec = r; return true; }
  catch (e) { return false; }
}

// ───────── 名單(確定性) ─────────
function nvWeight(f) {
  var w = (typeof CARD_FIG_WEIGHT !== 'undefined') ? CARD_FIG_WEIGHT[f.id] : undefined;
  w = (typeof w === 'number' && w > 0) ? w : (f.gr === 4 ? 10 : 6);
  return (typeof fxFigRaceMul === 'function') ? w * fxFigRaceMul(f) : w;   // 魔幻世界:他族英雄(遊歷英雄)×0.3
}
// 當日名人順序:加權無放回(指數競賽 key = −ln(u) / w 由小到大),種子 = 世界 + 日
function nvOrder(day) {
  var sig = nvWorld() + ':' + day, rng, arr = [];
  if (NPCV.order && NPCV.orderSig === sig) return NPCV.order;
  if (typeof CARD_FIGS === 'undefined') return [];
  rng = nvRng(nvHash('visit', nvWorld(), day, 'order'));
  ((typeof fxFigSrc === 'function' && fxFigSrc()) || CARD_FIGS).forEach(function (f) {   // 魔幻世界 = 42 位傳說英雄(js/fx_cards.js),歷史世界 = CARD_FIGS
    if (f.gr < 3) return;
    arr.push({ id: f.id, k: -Math.log(Math.max(1e-9, rng())) / nvWeight(f) });
  });
  arr.sort(function (a, b) { return a.k - b.k || (a.id < b.id ? -1 : 1); });
  NPCV.order = arr.map(function (x) { return x.id; }); NPCV.orderSig = sig;
  return NPCV.order;
}
// 當日行程表:{day, slots:[{k, min(預定抵達的分鐘), end}]}(只與世界編號 + 日有關,不含「誰」,誰在抵達時才依名冊決定)
function npcVisitPlan(day) {
  var sig = nvWorld() + ':' + day, rng, W = CARD_VISIT.countW, tot = 0, r, cnt = 0, i, seg, slots = [], span;
  if (NPCV.plan && NPCV.planSig === sig) return NPCV.plan;
  rng = nvRng(nvHash('visit', nvWorld(), day, 'count'));
  for (i = 0; i < W.length; i++) tot += W[i];
  r = rng() * tot;
  for (i = 0; i < W.length; i++) { r -= W[i]; if (r < 0) { cnt = i; break; } cnt = i; }
  if (cnt > 0) {
    span = CARD_VISIT.endMin - CARD_VISIT.startMin; seg = span / cnt;
    for (i = 0; i < cnt; i++) {
      r = CARD_VISIT.startMin + seg * i + rng() * Math.max(0, seg - CARD_VISIT.windowMin);
      slots.push({ k: i, min: Math.floor(r), end: Math.floor(r) + CARD_VISIT.windowMin });
    }
  }
  NPCV.plan = { day: day, slots: slots }; NPCV.planSig = sig;
  return NPCV.plan;
}
function nvOwned(cs, id) { return !!(cs && typeof cardsFindFig === 'function' && cardsFindFig(cs, id)); }
// 第 k 個名額的名人:順序中「不在名冊 / 卡包,或今天已來過」者的第 k 個(來過的仍佔位,名額序號因此穩定);沒有 → null
function nvFigFor(day, k, rec) {
  var ord = nvOrder(day), cs = (typeof npcCs === 'function') ? npcCs() : null, i, n = 0;
  for (i = 0; i < ord.length; i++) {
    if (rec.f.indexOf(ord[i]) < 0 && nvOwned(cs, ord[i])) continue;
    if (n === k) return ord[i];
    n++;
  }
  return null;
}

// ───────── 外觀 / 偽名冊項目 ─────────
function nvEntry(figId) {
  var e = NPCV.ve[figId], f, jb;
  if (e) return e;
  f = (typeof CARD_FIG_BY_ID !== 'undefined') ? CARD_FIG_BY_ID[figId] : null;
  if (!f) return null;
  jb = (typeof cardFigJobs === 'function') ? cardFigJobs(f) : { ja: {}, main: '' };
  e = { id: 'visit_' + figId, fig: figId, name: f.name, zi: f.zi, gr: f.gr, fac: f.fac, home: f.home, sex: (typeof portraitGenderOf === 'function' && portraitGenderOf(figId)) || 'm', ja: jb.ja, main: jb.main, tr: [], fav: 0 };
  NPCV.ve[figId] = e;
  return e;
}
function nvCap() {
  var c = CARD_VISIT.cap;
  if ((typeof isPowerSave === 'function' && isPowerSave()) || (typeof npcLowEnd === 'function' && npcLowEnd())) c = Math.min(c, CARD_VISIT.capLow);
  return c;
}
function nvGateOk() {   // 畫面層級的「不畫」條件(行走照常)
  if (typeof uiIsPhoto === 'function' && uiIsPhoto()) return false;
  if (typeof REC !== 'undefined' && REC && (REC.state === 'recording' || REC.state === 'countdown' || REC.state === 'plan')) return false;
  return true;
}
function npcVisitHidden() { return LIFE.small || !NPCV.drawOk; }
function nvCount() {
  var L = LIFE.npcs, i, c = 0;
  for (i = 0; i < L.length; i++) if (L[i].vis && !L[i].dead && L[i].st !== 'fade') c++;
  return c;
}

// ───────── 生成 ─────────
if (typeof LIFE_TYPES !== 'undefined' && !LIFE_TYPES.visitor) LIFE_TYPES.visitor = { name: '在野名人', looks: ['man', 'woman'], w: 0, spd: 0.75, to: {} };
function npcVisitSpawn(figId, day) {
  var R = (typeof LIFE !== 'undefined' && LIFE) ? LIFE.road : null, e = nvEntry(figId), T = (typeof LIFE_TYPES !== 'undefined') ? LIFE_TYPES.visitor : null, h, ent = null, ex = null, plan = [], ns, i, c, tries, used = {}, f, sp, n, before, D, k, reach = [], exits = [];
  if (!R || !e || !T || typeof lifeEmit !== 'function' || typeof lifeField !== 'function' || !R.ent.length || !R.spots.length) return false;
  h = nvHash('visit', nvWorld(), day, figId, 'walk');
  // 入口:從雜湊起點依序試,要求同一張道路連通的停點 ≥ 2(距離場每幀預算用完回 null → 本次不放,下一秒再試)
  for (k = 0; k < R.ent.length && !ent; k++) {
    c = R.ent[(h + k) % R.ent.length];
    D = lifeField(c.cell);
    if (!D) return false;
    reach = R.spots.filter(function (x) { return D[x] >= 0; });
    if (reach.length >= 2) ent = c;
  }
  if (!ent) return false;
  exits = R.ent.filter(function (x) { return x !== ent && D[x.cell] >= 0; });
  ex = exits.length ? exits[(h >>> 5) % exits.length] : ent;
  ns = CARD_VISIT.stops[0] + ((h >>> 9) % (CARD_VISIT.stops[1] - CARD_VISIT.stops[0] + 1));
  for (i = 0; i < ns; i++) {
    for (tries = 0; tries < 6; tries++) {
      c = reach[nvHash(h, i, tries) % reach.length];
      if (!used[c]) break;
    }
    used[c] = 1;
    plan.push({ cell: c, act: 'stand', dur: CARD_VISIT.standSec[0] + (nvHash(h, i, 'd') % (CARD_VISIT.standSec[1] - CARD_VISIT.standSec[0] + 1)) });
  }
  plan.push({ cell: ex.cell, end: 'exit', ent: ex });
  before = LIFE.npcs.length;
  if (!lifeEmit(T, 'visitor', 1, ent.cell, plan, ent, false, { lane: 0.12 })) return false;
  if (LIFE.npcs.length === before) return false;
  n = LIFE.npcs[LIFE.npcs.length - 1];
  LIFE.live--;   // lifeEmit 已計入一般居民;在野名人不占居民額度
  f = CARD_FIG_BY_ID[figId];
  n.ext = true; n.role = 'visitor'; n.vis = figId; n.vday = day; n.name = f.name;
  n.col = (CARD_VISIT.aura[f.gr] || '#e6b84a');
  sp = (typeof npcHeroSpec === 'function') ? npcHeroSpec(e) : null;
  if (sp) n.spec = sp;
  NPCV.spawned++;
  return true;
}

// citylife lifeFrame 掛點:每秒一次(dt 秒)。管理在場名人的停留上限、更新「畫不畫」旗標、依行程表放人
function npcVisitTick(dt) {
  var V = NPCV, now, day, plan, rec, mn, i, s, fig, L, n, d;
  V.t -= dt || 0;
  if (V.t > 0) return;
  V.t = 1;
  if (typeof LIFE === 'undefined' || !LIFE || !LIFE.active || !LIFE.road) return;
  V.drawOk = nvGateOk();
  L = LIFE.npcs;
  for (i = 0; i < L.length; i++) {
    n = L[i];
    if (n.vis && !n.dead && n.st !== 'fade' && n.st !== 'exit' && n.st !== 'enter' && n.life > CARD_VISIT.maxLifeSec) lifeFadeOut(n);
  }
  if (!CARD_VISIT.on || LIFE.tod === 'night') return;
  now = nvNow(); day = nvDay(now);
  plan = npcVisitPlan(day);
  if (!plan.slots.length) return;
  d = new Date(now); mn = d.getHours() * 60 + d.getMinutes();
  rec = nvRecGet(day);
  for (i = 0; i < plan.slots.length; i++) {
    s = plan.slots[i];
    if (rec.s.indexOf(s.k) >= 0 || mn < s.min || mn >= s.end) continue;
    if (nvCount() >= nvCap()) return;
    fig = nvFigFor(day, s.k, rec);
    if (!fig || rec.f.indexOf(fig) >= 0) continue;
    if (npcVisitSpawn(fig, day)) {
      rec.s.push(s.k); rec.f.push(fig);
      nvRecSave(rec);
      return;
    }
  }
}
function npcVisitStats() {
  var o = { n: 0, ids: [], spawned: NPCV.spawned, claimed: NPCV.claimed };
  if (typeof LIFE === 'undefined' || !LIFE) return o;
  LIFE.npcs.forEach(function (n) { if (n.vis && !n.dead && n.st !== 'fade') { o.n++; o.ids.push(n.vis); } });
  return o;
}

// ───────── 繪製(光環 / 小星;只對 n.vis 的 ≤ 2 人呼叫) ─────────
function npcVisitHalo(ctx, n, alpha) {
  var col = n.col, p = 0.8 + 0.2 * Math.sin(LIFE.clock * 2 + n.ph);
  rqAlpha(ctx, alpha * 0.42 * p);
  rqDisc(ctx, n.px, n.py - 1, 13, 6.5, col);
  rqAlpha(ctx, alpha * 0.6 * p);
  rqDisc(ctx, n.px, n.py - 1, 8, 4, col);
  rqAlpha(ctx, 1);
}
function npcVisitStar(ctx, n, alpha) {
  var sc = (n.spec && n.spec.scale) || 1, y = n.py - 50 * sc - 1.5 * Math.sin(LIFE.clock * 3 + n.ph), x = n.px;
  rqAlpha(ctx, alpha * 0.95);
  rqDisc(ctx, x, y, 4.6, 1.2, n.col);
  rqDisc(ctx, x, y, 1.2, 4.6, n.col);
  rqDisc(ctx, x, y, 1.8, 1.8, '#fff8dc');
  rqAlpha(ctx, 1);
}

// ───────── 人物小卡 ─────────
function nvCardMake() {
  var box;
  if (NPCV.card.box) return NPCV.card.box;
  if (typeof document === 'undefined' || !document.createElement || !document.body) return null;
  box = document.createElement('div');
  box.id = 'visitCard';
  box.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);width:min(320px,calc(100vw - 32px));box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #e6b84a;background:rgba(34,32,26,0.95);color:#f4ead2;font:14px/1.5 sans-serif;z-index:60;display:none';
  if (box.addEventListener) box.addEventListener('click', nvCardClick);
  document.body.appendChild(box);
  NPCV.card.box = box;
  return box;
}
function nvCardRender() {
  var box = NPCV.card.box, n = (typeof LIFE !== 'undefined') ? LIFE.cardFor : null, e = (n && n.vis) ? nvEntry(n.vis) : null, g, src, h, aura;
  if (!box || !e) return;
  g = CARD_GRADE[e.gr];
  aura = CARD_VISIT.aura[e.gr] || '#e6b84a';
  src = (typeof fxFigImg === 'function' && fxFigImg(e.fig)) || 'assets/portraits/' + e.fig + '.webp';
  h = '<div style="display:flex;gap:8px;align-items:center">' +
    '<div style="width:44px;height:44px;border-radius:6px;border:2px solid ' + aura + ';background:rgba(128,128,128,.2);overflow:hidden;flex:none"><img alt="" src="' + nvEsc(src) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.remove()"></div>' +
    '<div style="flex:1;min-width:0"><b>' + nvEsc(e.name) + '</b> <span style="color:#c9b98f;font-size:12px">' + g.ch + ' · ' + nvEsc(e.zi || '') + '</span>' +
    '<div style="font-size:12px;color:' + aura + '">' + ((typeof fxVisitText === 'function' && fxVisitText(e, nvEsc)) || '在野 · ' + nvEsc(e.name) + ' 路過本城') + '</div></div>' +
    '<span data-a="x" style="cursor:pointer;padding:0 4px">✕</span></div>';
  h += '<div style="margin:8px 0;min-height:1.5em">「' + nvEsc(NPCV.card.line ? NPCV.card.line.text : '') + '」</div>';
  h += '<div style="font-size:12px;color:#c9b98f;margin-bottom:4px">只是路過,不能直接延攬。</div>';
  if (NPCV.card.msg) h += '<div style="font-size:12px;color:#f0a060;margin-bottom:4px">' + nvEsc(NPCV.card.msg) + '</div>';
  h += '<span data-a="next" style="cursor:pointer;color:#e6b84a;font-size:13px">換一句 ↻</span>';
  box.innerHTML = h;
}
function nvNextLine(e) {
  var k = NPCV.talkN[e.fig] = (NPCV.talkN[e.fig] | 0) + 1;
  return (typeof npcTalkLine === 'function') ? npcTalkLine(e, k - 1) : { text: '路過此地,叨擾了。', priv: false };
}
// 首次點擊小獎勵:{ok, reason?, reward?}。reason: none / done(這位今天領過)/ cap(今日次數用完)
function npcVisitClaim(figId, day) {
  var rec = nvRecGet(day), f = (typeof CARD_FIG_BY_ID !== 'undefined') ? CARD_FIG_BY_ID[figId] : null, R, cs, parts = [];
  if (!f) return { ok: false, reason: 'none' };
  if (rec.c.indexOf(figId) >= 0) return { ok: false, reason: 'done' };
  if (rec.c.length >= CARD_VISIT.rewardDayMax) return { ok: false, reason: 'cap' };
  R = CARD_VISIT.reward[f.gr];
  if (!R) return { ok: false, reason: 'none' };
  cs = (typeof cardsGet === 'function') ? cardsGet() : null;
  if (!cs) return { ok: false, reason: 'none' };
  if (R.tok) { cardsAddTokens(cs, R.tok); parts.push('酒令 ×' + R.tok); }
  if (R.shards) { cs.shards = (cs.shards | 0) + R.shards; parts.push('碎片 ×' + R.shards); }
  rec.c.push(figId);
  if (!rec.f.length || rec.f.indexOf(figId) < 0) rec.f.push(figId);   // 測試 / 例外路徑:保證「領過」必在「來過」之內
  nvRecSave(rec);
  NPCV.claimed++;
  if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  return { ok: true, reward: R, text: parts.join('、') };
}
// 回 true = 已處理(顯示小卡,或此人目前畫不出來所以不開卡);lifeCardShow 掛點
function npcVisitCardShow(n) {
  var box, e = nvEntry(n.vis), r;
  if (!e) return false;
  if (npcVisitHidden()) return true;
  box = nvCardMake();
  if (!box) return false;
  if (typeof LIFE !== 'undefined' && LIFE.card && LIFE.card.box) LIFE.card.box.style.display = 'none';
  if (typeof npcHeroCardHide === 'function') npcHeroCardHide();
  LIFE.cardFor = n;
  NPCV.card.msg = '';
  r = npcVisitClaim(n.vis, n.vday !== undefined ? n.vday : nvDay(nvNow()));
  if (r.ok) { NPCV.card.msg = '路過的' + e.name + '贈你小禮:' + r.text; nvToast(NPCV.card.msg); }
  else if (r.reason === 'cap') NPCV.card.msg = '今日路過名人的小禮已發完';
  else if (r.reason === 'done') NPCV.card.msg = '小禮今天已收過了';
  NPCV.card.line = nvNextLine(e);
  box.style.display = 'block';
  nvCardRender();
  return true;
}
function npcVisitCardHide() {
  var b = NPCV.card.box;
  if (b && b.style.display !== 'none') b.style.display = 'none';
}
function nvCardClick(ev) {
  var b = ev.target, a, n = (typeof LIFE !== 'undefined') ? LIFE.cardFor : null, e = (n && n.vis) ? nvEntry(n.vis) : null;
  while (b && b !== NPCV.card.box && !(b.getAttribute && b.getAttribute('data-a'))) b = b.parentNode;
  if (!b || b === NPCV.card.box || !e) return;
  a = b.getAttribute('data-a');
  if (a === 'x') { if (typeof lifeCardHide === 'function') lifeCardHide(); return; }
  if (a === 'next') { NPCV.card.line = nvNextLine(e); NPCV.card.msg = ''; }
  nvCardRender();
}
