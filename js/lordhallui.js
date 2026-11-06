// js/lordhallui.js — 城主府面板(PLAN_NOLEVEL §16 / NL7 骨架):點城主府(palace)開雙分頁面板。
// 分頁一「概況」:官階稱號 / 人口 / 繁榮 / 政績 / 民情摘要 / 研發摘要 / 庫房警示 / 入口鈕;
// 分頁二「派工」:可派駐建築 × 人才槽位,單項指派 + 一鍵全部自動分派;資料取自 world.city.talents(占位,無人才系統時顯示空狀態)。
// 所有外部模組(cityFxGet / cityscoreGet / techSummary / goodsCity / cityAdvisor / panelmgr)皆 typeof 守衛,缺失就略過或灰化。
// 公開 API:lordhallOpen(tab) lordhallClose() lordhallToggle() lordhallRender() lordhallTap(obj) lordhallAssignPost(tid, postId)
//          lordhallRank(pop, pros) lordhallOverview() lordhallJobSites() lordhallAutoAssign() lordhallAssign(tid, siteId)
var LH_TYPE = 'palace';
// 官階表(占位,可替換):依人口 / 繁榮度,取最後一個達標者
var LH_RANKS = [
  { n: '里正', pop: 0, pros: 0 }, { n: '亭長', pop: 20, pros: 40 }, { n: '縣尉', pop: 60, pros: 120 },
  { n: '縣令', pop: 150, pros: 300 }, { n: '太守', pop: 400, pros: 800 }, { n: '刺史', pop: 900, pros: 1800 }
];
// 可派駐建築(占位,可替換):type → 職司與槽位數
var LH_SLOTS = {
  research: { name: '研究院', grp: '文', slots: 3 },
  market: { name: '市集', grp: '商', slots: 2 }
};
var LH_MOOD_KEYS = [['mood', '民心'], ['food', '糧食'], ['water', '水源'], ['sani', '衛生']];
var lh = { open: false, tab: 'ov', el: null, saved: null };

function lhEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function lordhallRank(pop, pros) {
  var r = LH_RANKS[0], i;
  for (i = 0; i < LH_RANKS.length; i++) if ((pop || 0) >= LH_RANKS[i].pop && (pros || 0) >= LH_RANKS[i].pros) r = LH_RANKS[i];
  return r.n;
}

// 概況數據(純資料,方便測試)
function lordhallOverview() {
  var o = { rank: '里正', pop: 0, pros: 0, score: null, mood: [], tech: null, warns: [], hasFx: false, hasScore: false, hasTech: false };
  var s = null, i, v, c;
  if (typeof cityscoreGet === 'function') { try { s = cityscoreGet(false); } catch (e) { s = null; } }
  if (s) { o.hasScore = true; o.pop = s.pop || 0; o.pros = s.pros || 0; o.score = s.pros || 0; }
  o.rank = lordhallRank(o.pop, o.pros);
  if (typeof cityFxGet === 'function') {
    o.hasFx = true;
    for (i = 0; i < LH_MOOD_KEYS.length; i++) {
      try { v = cityFxGet(LH_MOOD_KEYS[i][0]); } catch (e) { v = null; }
      if (typeof v === 'number' && isFinite(v)) o.mood.push({ k: LH_MOOD_KEYS[i][0], n: LH_MOOD_KEYS[i][1], v: Math.round(v) });
    }
  }
  if (typeof techSummary === 'function') { try { o.tech = techSummary(); o.hasTech = true; } catch (e) { o.tech = null; } }
  c = (typeof goodsCity === 'function') ? goodsCity() : null;
  if (c && c.inv && typeof goodsCapOf === 'function') {
    Object.keys(c.inv).forEach(function (id) {
      var cap = 0;
      try { cap = goodsCapOf(id); } catch (e) { cap = 0; }
      if (cap > 0 && c.inv[id] >= cap * 0.95) o.warns.push({ id: id, name: (typeof GOODS !== 'undefined' && GOODS[id] && (typeof goodsName === 'function' ? goodsName(id) : GOODS[id].name)) || id, kind: 'full' });
    });
  }
  if (c && c.debt) Object.keys(c.debt).forEach(function (id) { if (c.debt[id] > 0.5) o.warns.push({ id: id, name: (typeof GOODS !== 'undefined' && GOODS[id] && (typeof goodsName === 'function' ? goodsName(id) : GOODS[id].name)) || id, kind: 'debt' }); });
  return o;
}

// 派工:建築清單與人才
function lordhallTalents() {
  var c = (typeof world !== 'undefined' && world) ? world.city : null;
  if (typeof cardsSyncTalents === 'function' && cardsSyncTalents()) c = world.city;   // 名冊(cards.js)優先;名冊空時沿用占位 talents
  return (c && Array.isArray(c.talents)) ? c.talents : [];
}
function lordhallJobSites() {
  var out = [], objs = [];
  if (typeof estateObjects === 'function') { try { objs = estateObjects() || []; } catch (e) { objs = []; } }
  else if (typeof world !== 'undefined' && world && world.objects) objs = world.objects;
  var ts = lordhallTalents();
  var npcOn = (typeof NPC_TYPE_POST !== 'undefined') && (typeof npcSiteInfo === 'function');   // 職司表(npcdata.js)存在時,可派駐建築改讀職司表;否則沿用占位 LH_SLOTS
  objs.forEach(function (o, i) {
    var d = npcOn ? npcSiteInfo(o.type) : LH_SLOTS[o.type], nm, id;
    if (!d) return;
    id = o.type + '@' + o.x + ',' + o.y;
    nm = npcOn ? ((typeof OBJECTS !== 'undefined' && OBJECTS[o.type] && OBJECTS[o.type].name) || o.type) : d.name;
    out.push({ id: id, type: o.type, name: nm, grp: npcOn ? d.name : d.grp, post: npcOn ? d.post : null, slots: npcOn ? d.per : d.slots, x: o.x, y: o.y,
      who: ts.filter(function (t) { return t.at === id; }) });
  });
  return out;
}
function lordhallAssign(tid, siteId) {
  var ts = lordhallTalents(), t = null, site = null, i;
  for (i = 0; i < ts.length; i++) if (ts[i].id === tid) t = ts[i];
  if (!t) return false;
  if (siteId === null || siteId === undefined || siteId === '') { t.at = null; delete t.since; lhStaffDirty(); return true; }
  lordhallJobSites().forEach(function (s) { if (s.id === siteId) site = s; });
  if (!site) return false;
  if (t.study) return false;   // 進修中(academy.js)不能派駐
  if (site.who.length >= site.slots && site.who.indexOf(t) < 0) return false;
  if (site.post && typeof npcCanAssign === 'function' && t.at !== siteId && !npcCanAssign(t, siteId)) return false;   // 職司席位已滿
  t.at = siteId;
  if (typeof npcDayOf === 'function') t.since = npcDayOf(Date.now());   // 派駐年資起算日
  lhStaffDirty();
  return true;
}
function lhStaffDirty() { if (typeof npcStaffDirty === 'function') npcStaffDirty(); }
// 指派到某職司:挑該職司第一個有空位的建築;回 true/false
function lordhallAssignPost(tid, postId) {
  var site = null;
  lordhallJobSites().forEach(function (s) { if (!site && s.post === postId && s.who.length < s.slots) site = s; });
  return site ? lordhallAssign(tid, site.id) : false;
}
// 全部自動分派:閒置人才優先給職司對口(t.job === site.grp)的建築,其次任何有空位者;有職司表時改以個人人事值最高的職司為先
function lordhallAutoAssign() {
  var ts = lordhallTalents(), n = 0;
  var idle = ts.filter(function (t) { return !t.at && !t.study; });
  if (!idle.length) return 0;
  idle.sort(function (a, b) { return (b.star ? 1 : 0) - (a.star ? 1 : 0); });
  idle.forEach(function (t) {
    var sites = lordhallJobSites().filter(function (s) { return s.who.length < s.slots && (!s.post || typeof npcCanAssign !== 'function' || npcCanAssign(t, s.id)); });
    var pick;
    if (sites.length && typeof npcFitScore === 'function' && sites[0].post) {
      sites.sort(function (a, b) { return npcFitScore(t, b.post) - npcFitScore(t, a.post); });
      pick = sites[0];
    } else pick = sites.filter(function (s) { return s.grp === t.job; })[0] || sites[0];
    if (pick) { t.at = pick.id; if (typeof npcDayOf === 'function') t.since = npcDayOf(Date.now()); n++; }
  });
  if (n) lhStaffDirty();
  return n;
}

// ---------- UI ----------
function lhCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('lhStyle')) return;
  var st = document.createElement('style');
  st.id = 'lhStyle';
  st.textContent = '#lordhall{position:fixed;top:calc(44px + env(safe-area-inset-top));left:6px;width:min(360px,calc(100vw - var(--side-w,48px) - 18px));max-height:62vh;display:flex;flex-direction:column;z-index:6;border-radius:10px;background:rgba(20,26,36,.94);box-shadow:0 4px 16px rgba(0,0,0,.4);font-size:13px;color:#eee}' +
    '#lordhall[hidden]{display:none}#lordhall .lhhd{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.12)}' +
    '#lordhall .lhhd b{flex:1}#lordhall .lhtab{border:none;border-radius:6px;padding:6px 10px;min-height:36px;background:rgba(255,255,255,.1);color:#eee}' +
    '#lordhall .lhtab.on{background:#f0b45a;color:#222}#lordhall .lhx{border:none;background:none;color:#eee;font-size:20px;min-width:40px;min-height:36px}' +
    '#lordhall .lhbd{overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:8px}#lordhall .lhr{display:flex;justify-content:space-between;padding:3px 0}' +
    '#lordhall button.lhb{min-height:36px;margin:3px 3px 0 0;padding:4px 10px;border:none;border-radius:6px;background:#3a5a8a;color:#fff}#lordhall button.lhb[disabled]{opacity:.35}' +
    '#lordhall .lhwarn{color:#f0a060}#lordhall .lhsec{margin-top:8px;font-weight:bold;opacity:.8}';
  document.head.appendChild(st);
}
function lhEnsure() {
  if (lh.el) return lh.el;
  if (typeof document === 'undefined') return null;
  lhCss();
  var el = document.createElement('div');
  el.id = 'lordhall';
  el.hidden = true;
  el.addEventListener('click', lhClick);
  (document.body || document.documentElement).appendChild(el);
  lh.el = el;
  return el;
}
function lhBar(v) { return '<span style="display:inline-block;width:80px;height:6px;border-radius:3px;background:rgba(255,255,255,.18);vertical-align:middle"><i style="display:block;height:100%;width:' + Math.max(0, Math.min(100, v)) + '%;background:#f0b45a"></i></span>'; }

function lhHtmlOverview() {
  var o = lordhallOverview(), h = '';
  h += '<div class="lhr"><span>官階</span><b>' + lhEsc(o.rank) + '</b></div>';
  h += '<div class="lhr"><span>人口</span><b>' + (o.hasScore ? o.pop : '—') + '</b></div>';
  h += '<div class="lhr"><span>繁榮度</span><b>' + (o.hasScore ? o.pros : '—') + '</b></div>';
  h += '<div class="lhr"><span>政績</span><b>' + (o.score === null ? '—' : o.score) + '</b></div>';
  h += '<div class="lhsec">民情</div>';
  if (o.mood.length) o.mood.forEach(function (m) { h += '<div class="lhr"><span>' + m.n + '</span><span>' + lhBar(m.v) + ' ' + m.v + '</span></div>'; });
  else h += '<div class="lhr"><span>民情資料尚未就緒</span></div>';
  h += '<div class="lhsec">研發</div>';
  if (o.hasTech && o.tech) h += '<div class="lhr"><span>' + lhEsc(typeof o.tech === 'string' ? o.tech : (o.tech.text || o.tech.name || JSON.stringify(o.tech))) + '</span></div>';
  else h += '<div class="lhr"><span>—</span></div>';
  h += '<div class="lhsec">庫房</div>';
  if (o.warns.length) o.warns.forEach(function (w) { h += '<div class="lhr lhwarn"><span>' + lhEsc(w.name) + (w.kind === 'full' ? ' 庫存將滿' : ' 缺料') + '</span></div>'; });
  else h += '<div class="lhr"><span>庫房無警示</span></div>';
  var hasMood = (typeof cityAdvisorOpen === 'function') || (typeof cityOverviewOpen === 'function') || (typeof panelOpen === 'function' && typeof cityAdvisorRender === 'function');
  var hasTech = (typeof techPanelOpen === 'function') || (typeof toggleTechPanel === 'function');
  h += '<div><button class="lhb" data-lh="mood"' + (lhMoodFn() ? '' : ' disabled') + '>開啟民情總覽</button>' +
    '<button class="lhb" data-lh="tech"' + (hasTech ? '' : ' disabled') + '>開啟科技樹</button></div>';
  return h;
}
function lhMoodFn() {
  var names = ['cityOverviewOpen', 'cityAdvisorOpen', 'cityAdvisorToggle'], i;
  for (i = 0; i < names.length; i++) { try { var f = (typeof window !== 'undefined' ? window : globalThis)[names[i]]; if (typeof f === 'function') return f; } catch (e) { } }
  return null;
}
// 職司表版派工頁(PLAN_INTERIORS P2):每個職司一段——席位、人事加成 / 上限條、在任者(個人 %)、閒置人選(依個人值排序,前 4 位)
function lhHtmlPosts(ts, sites) {
  var idle = ts.filter(function (t) { return !t.at; }), h = '', seen = {};
  h += '<div class="lhr"><span>人才 ' + ts.length + '(閒置 ' + idle.length + ')</span><button class="lhb" data-lh="auto"' + (idle.length && sites.length ? '' : ' disabled') + '>全部自動分派</button></div>';
  if (!sites.length) return h + '<div class="lhr"><span>城中尚無可派駐的建築</span></div>';
  sites.forEach(function (s) { if (s.post) seen[s.post] = s.type; });
  Object.keys(seen).forEach(function (pid) {
    var info = npcStaffInfo(seen[pid]), free = sites.filter(function (s) { return s.post === pid && s.who.length < s.slots; }).length, cands;
    h += '<div class="lhsec">' + lhEsc(info.name) + ' ' + info.used + '/' + info.seats + ' 席 · 人事 +' + Math.round(info.pct) + ' %(上限 ' + info.cap + ' %)' + (info.live ? '' : '・效果接入中') + (npcPostById(pid) ? '<div class="lhsub">對口建築:' + lhEsc(npcPostById(pid).types.slice(0, 6).map(function (t) { return (typeof OBJECTS !== 'undefined' && OBJECTS[t] && OBJECTS[t].name) || t; }).join('、')) + '</div>' : '') + '</div>';
    h += '<div class="lhr"><span>' + lhBar(info.pct / info.cap * 100) + '</span><span style="opacity:.7">' + lhEsc(info.eff) + '</span></div>';
    info.people.forEach(function (p) {
      h += '<div class="lhr"><span>' + lhEsc(p.name) + ' <small style="opacity:.7">' + lhEsc(lhPartText(p)) + '</small></span><span><b>+' + Math.round(p.pct) + '%</b> <button class="lhb" data-lh="un" data-t="' + lhEsc(p.id) + '">卸任</button></span></div>';
    });
    if (info.waste) h += '<div class="lhr lhwarn"><span>另有 ' + info.waste + ' 人超出席位,暫不計入</span></div>';
    if (free > 0 && info.used < info.seats) {
      cands = idle.map(function (t) { return { t: t, v: npcFitScore(t, pid) }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 4);
      cands.forEach(function (c) {
        h += '<div class="lhr"><span>' + lhEsc(c.t.name || c.t.id) + ' <small style="opacity:.7">預估 +' + Math.round(c.v) + '%</small></span><button class="lhb" data-lh="asp" data-t="' + lhEsc(c.t.id) + '" data-p="' + pid + '">派駐</button></div>';
      });
    }
  });
  return h;
}
function lhPartText(p) {
  var a = (p.parts || []).map(function (x) { var j = (typeof CARD_JOB_BY_ID !== 'undefined') ? CARD_JOB_BY_ID[x.job] : null; return (j ? j.t[x.t - 1] : x.job) + (x.half ? '(輔)' : ''); });
  return a.length ? a.join('、') : '屬性加成';
}
function lhHtmlJobs() {
  var ts = lordhallTalents(), sites = lordhallJobSites(), h = '';
  if (!ts.length) return '<div class="lhr"><span>尚無人才,招募後可派工</span></div>';
  if (typeof npcStaffInfo === 'function' && typeof NPC_TYPE_POST !== 'undefined') return lhHtmlPosts(ts, sites);
  var idle = ts.filter(function (t) { return !t.at && !t.study; });
  h += '<div class="lhr"><span>人才 ' + ts.length + '(閒置 ' + idle.length + ')</span><button class="lhb" data-lh="auto"' + (idle.length && sites.length ? '' : ' disabled') + '>全部自動分派</button></div>';
  if (!sites.length) return h + '<div class="lhr"><span>城中尚無可派駐的建築</span></div>';
  sites.forEach(function (s) {
    h += '<div class="lhsec">' + lhEsc(s.name) + '(' + s.grp + ')' + s.who.length + '/' + s.slots + ' @' + s.x + ',' + s.y + '</div>';
    s.who.forEach(function (t) { h += '<div class="lhr"><span>' + lhEsc(t.name || t.id) + '</span><button class="lhb" data-lh="un" data-t="' + lhEsc(t.id) + '">卸任</button></div>'; });
    if (s.who.length < s.slots) idle.forEach(function (t) {
      h += '<div class="lhr"><span>' + lhEsc(t.name || t.id) + (t.job ? '・' + lhEsc(t.job) : '') + '</span><button class="lhb" data-lh="as" data-t="' + lhEsc(t.id) + '" data-s="' + lhEsc(s.id) + '">派駐</button></div>';
    });
  });
  return h;
}
function lordhallRender() {
  var el = lhEnsure();
  if (!el) return;
  var hasTalent = lordhallTalents().length > 0;
  el.innerHTML = '<div class="lhhd"><b>🏯 城主府</b>' +
    '<button class="lhtab' + (lh.tab === 'ov' ? ' on' : '') + '" data-lh="tab" data-tab="ov">概況</button>' +
    '<button class="lhtab' + (lh.tab === 'job' ? ' on' : '') + '" data-lh="tab" data-tab="job">派工</button>' +
    '<button class="lhx" data-lh="x" aria-label="關閉">✕</button></div>' +
    '<div class="lhbd">' + (lh.tab === 'job' ? lhHtmlJobs() : lhHtmlOverview()) + '</div>';
}
function lhClick(e) {
  var b = e.target && e.target.closest ? e.target.closest('button') : null;
  if (!b) return;
  var a = b.getAttribute('data-lh');
  if (a === 'x') lordhallClose();
  else if (a === 'tab') { lh.tab = b.getAttribute('data-tab') === 'job' ? 'job' : 'ov'; lordhallRender(); }
  else if (a === 'auto') { lordhallAutoAssign(); lordhallRender(); }
  else if (a === 'asp') { lordhallAssignPost(b.getAttribute('data-t'), b.getAttribute('data-p')); lordhallRender(); }
  else if (a === 'as') { lordhallAssign(b.getAttribute('data-t'), b.getAttribute('data-s')); lordhallRender(); }
  else if (a === 'un') { lordhallAssign(b.getAttribute('data-t'), null); lordhallRender(); }
  else if (a === 'tech') { if (typeof techPanelOpen === 'function') { lordhallClose(); techPanelOpen(); } else if (typeof toggleTechPanel === 'function') { lordhallClose(); toggleTechPanel(true); } }
  else if (a === 'mood') { var f = lhMoodFn(); if (f) { lordhallClose(); f(); } }
}
function lordhallOpen(tab) {
  var el = lhEnsure();
  if (!el) return;
  lh.tab = tab === 'job' ? 'job' : 'ov';
  lh.open = true;
  if (typeof panelOpen === 'function') { try { panelOpen('lordhall', el); } catch (e) { } }
  lordhallRender();
  el.hidden = false;
  if (typeof panelLsSet === 'function') panelLsSet('lordhall', true);
}
function lordhallClose() {
  if (!lh.open && !(lh.el && !lh.el.hidden)) return;
  lh.open = false;
  if (lh.el) lh.el.hidden = true;
  if (typeof panelLsSet === 'function') panelLsSet('lordhall', false);
  if (typeof panelClose === 'function') { try { panelClose('lordhall'); } catch (e) { } }
}
function lordhallToggle() { if (lh.open) lordhallClose(); else lordhallOpen(); }
// 點擊掛點:ui.js tapObjectAt 呼叫;是城主府就開面板並回傳 true
function lordhallTap(o) {
  if (!o || o.type !== LH_TYPE) return false;
  lordhallToggle();
  return true;
}
