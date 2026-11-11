// js/nextstep.js — 「推薦下一步」引擎:把 開局引導鏈(NS_CHAIN)與 顧問(cityadvisor.js)的紅/黃/藍條目合成一串候選,一次只推一條。
// 優先序:紅色危急(顧問 R) → 開局引導鏈下一步(含自動插入的「先研發 X」「先蓋研究院」) → 黃色警示 → 藍色建議。
// 純函式:nsCompute(s, adv, mem, api) 不碰 DOM、不寫存檔。存檔:world.city.ns = { dismissed:[id], seen:[id] }(只存 id 字串;goods.js goodsNormCity 帶過 nsNormSave)。
// 全域偏好 localStorage 'lorddomain.nextstep' = on/off;關閉時 nsGet / nsTick 不計算(省效能)。資料在 nextstep_data.js,介面在 nextstepui.js。
// ES2017;不用 ?. ??。
// 全域名稱:nsEnabled nsSetEnabled nsSetClock nsReset nsNormSave nsMemNew nsMemLoad nsMemSave nsDismiss nsUndismissAll nsMarkSeen nsSnapshot nsTechApi
//   nsPrereq nsStepDone nsResolveChain nsCompute nsGet nsTick nsPick nsNext nsGo nsCardRect nsRectsOverlap

var nsRt = { mem: null, bound: null, last: -1e15, cache: null, rot: 0, topId: '', on: null, clock: function () { return Date.now(); } };
function nsSetClock(fn) { nsRt.clock = fn || function () { return Date.now(); }; }
function nsReset() { nsRt.mem = null; nsRt.bound = null; nsRt.last = -1e15; nsRt.cache = null; nsRt.rot = 0; nsRt.topId = ''; nsRt.on = null; }

// ───────── 全域開關 ─────────
function nsEnabled() {
  if (nsRt.on === null) {
    nsRt.on = true;
    try { if (localStorage.getItem(NS_PREF_KEY) === 'off') nsRt.on = false; } catch (e) { /* 略過 */ }
  }
  return nsRt.on;
}
function nsSetEnabled(v) {
  nsRt.on = !!v;
  try { localStorage.setItem(NS_PREF_KEY, nsRt.on ? 'on' : 'off'); } catch (e) { /* 略過 */ }
  nsRt.cache = null; nsRt.last = -1e15;
}

// 新手教學進行中不受「推薦下一步」總開關影響(教學不依賴該開關,否則關閉後教學不會推進)
function nsTutForced() { return typeof tutActive === 'function' && tutActive(); }

// ───────── 記憶(存檔只含 id)─────────
function nsMemNew() { return { dismissed: {}, seen: {}, dirty: false }; }
function nsNormSave(v) {
  var o = { dismissed: [], seen: [] }, k, i, src;
  if (!v || typeof v !== 'object') return o;
  for (k in o) {
    src = v[k];
    if (!Array.isArray(src)) continue;
    for (i = 0; i < src.length && o[k].length < 200; i++) if (typeof src[i] === 'string' && src[i].length <= 60 && o[k].indexOf(src[i]) < 0) o[k].push(src[i]);
  }
  return o;
}
function nsMemLoad(v) {
  var m = nsMemNew(), n = nsNormSave(v);
  n.dismissed.forEach(function (id) { m.dismissed[id] = true; });
  n.seen.forEach(function (id) { m.seen[id] = true; });
  return m;
}
function nsMemSave(m) { return { dismissed: Object.keys(m.dismissed).sort(), seen: Object.keys(m.seen).sort() }; }
function nsBind() {
  var c = (typeof world !== 'undefined' && world) ? world.city : null;
  if (!nsRt.mem || nsRt.bound !== c) { nsRt.mem = nsMemLoad(c && c.ns); nsRt.bound = c; }
  return nsRt.mem;
}
function nsFlush() {
  var c = (typeof world !== 'undefined' && world) ? world.city : null;
  if (!nsRt.mem || !nsRt.mem.dirty) return;
  if (!c && typeof goodsCity === 'function') c = goodsCity();
  if (c) { c.ns = nsMemSave(nsRt.mem); nsRt.mem.dirty = false; nsRt.bound = c; }
}
function nsDismiss(id) { var m = nsBind(); if (id && !m.dismissed[id]) { m.dismissed[id] = true; m.dirty = true; } nsFlush(); nsRt.last = -1e15; }
function nsUndismissAll() { var m = nsBind(); if (Object.keys(m.dismissed).length) { m.dismissed = {}; m.dirty = true; } nsFlush(); nsRt.last = -1e15; nsRt.rot = 0; }
function nsMarkSeen(id) { var m = nsBind(); if (id && !m.seen[id]) { m.seen[id] = true; m.dirty = true; nsFlush(); nsRt.last = -1e15; } }

// ───────── 快照與科技介面 ─────────
function nsSnapshot() {
  var s = { cnt: {}, houses: 0, lab: false, techDoneN: 0, busy: false }, objs = [], i, o, hs = (typeof CITYFX_HOUSES !== 'undefined') ? CITYFX_HOUSES : { house: 1 }, ts;
  if (typeof estateObjects === 'function') { try { objs = estateObjects() || []; } catch (e) { objs = []; } }
  else if (typeof world !== 'undefined' && world && world.objects) objs = world.objects;
  for (i = 0; i < objs.length; i++) {
    o = objs[i]; if (!o || !o.type) continue;
    s.cnt[o.type] = (s.cnt[o.type] || 0) + 1;
    if (typeof fxAsList === 'function') fxAsList(o.type).forEach(function (a) { s.cnt[a] = (s.cnt[a] || 0) + 1; });   // 魔幻件視同漢式功能件
    if (hs[o.type]) s.houses++;
  }
  s.lab = (s.cnt.research || 0) > 0;
  if (typeof techState === 'function') {
    try { ts = techState(); } catch (e2) { ts = null; }
    if (ts) { s.techDoneN = Object.keys(ts.done || {}).length; s.busy = !!((ts.cur && ts.cur.length) || (ts.queue && ts.queue.length)); }
  }
  return s;
}
// 科技介面(typeof 守衛);資料檔未載入回 null → 視為所有建築已開放,不插前置步驟
function nsTechApi() {
  if (typeof techNode !== 'function' || typeof techDone !== 'function' || typeof techReqMet !== 'function' || typeof techEraOpen !== 'function' || typeof CITY_TECHS === 'undefined') return null;
  return {
    node: techNode, done: techDone, reqMet: techReqMet, eraOpen: techEraOpen,
    queued: function (id) {
      var ts = (typeof techState === 'function') ? techState() : null;
      if (!ts) return false;
      return (ts.cur || []).some(function (c) { return c.id === id; }) || (ts.queue || []).indexOf(id) >= 0;
    }
  };
}
function nsObjTechId(objId) {
  var src;
  if (typeof nlObjTech === 'function') src = nlObjTech(objId);
  else if (typeof NL_OBJ_TECH !== 'undefined') src = NL_OBJ_TECH[objId];
  return (typeof src === 'string' && src !== 'start') ? src : '';
}

// ───────── 前置 / 完成判定 ─────────
// 回傳 null(不需前置)| {blocked:true} 時代未開,略過 | {queued:true} 已在研發 / 排隊,略過 | {lab:true} 要先蓋研究院 | {tech,name} 先研發這項
function nsPrereq(techId, api, s) {
  var n, cur, next, nn, guard = 0, i;
  if (!api || !techId) return null;
  n = api.node(techId);
  if (!n) return { blocked: true };
  if (api.done(techId)) return null;
  if (api.queued(techId)) return { queued: true };
  if (!api.eraOpen(n.era)) return { blocked: true };
  cur = n;
  while (guard++ < 30 && !api.reqMet(cur)) {
    next = null;
    for (i = 0; i < cur.req.length; i++) if (!api.done(cur.req[i])) { next = cur.req[i]; break; }
    if (!next) break;
    nn = api.node(next);
    if (!nn) return { blocked: true };
    if (api.queued(next)) return { queued: true };
    cur = nn;
  }
  if (!api.eraOpen(cur.era)) return { blocked: true };
  if (!s.lab) return { lab: true };
  if (api.queued(cur.id)) return { queued: true };
  return { tech: cur.id, name: (typeof techLabelOf === 'function' ? techLabelOf(cur) : cur.name) };
}
// 真實建築上限(依目前等級的 progProdCap;研究院走 techLabCap;null = 不限)
function nsLvNow() { return (typeof prog !== 'undefined' && prog && typeof prog.lv === 'number') ? prog.lv : 1; }
function nsCapOf(type) {
  var c = (typeof progCapNow === 'function') ? progCapNow(type) : (typeof progProdCap === 'function') ? progProdCap(type, nsLvNow()) : null;   // 與 map.js capOf 同源(無等級依官階)
  if (type === 'research' && typeof techLabCap === 'function') c = techLabCap();
  return (c === undefined) ? null : c;
}
// 上限為 0 或要等城市升級時,說明要做到什麼才有名額(找第一個有名額的等級;找不到回通用文字)
function nsCapHint(type) {
  var L, c;
  if (typeof progCapHint === 'function') return progCapHint(type) || '目前還不能蓋';
  if (typeof progProdCap !== 'function') return '目前還不能蓋';
  for (L = nsLvNow() + 1; L <= 25; L++) { c = progProdCap(type, L); if (c === null || c > 0) return '城市升到 ' + L + ' 級才有名額'; }
  return '目前還不能蓋';
}
// 步驟的實際目標:done.n 壓成上限(cap);cap 為 0 時 n = 0(呼叫端另行略過並推提示)
function nsStepTarget(step) {
  var d = step.done, type, cap;
  if (!d || (d.k !== 'cnt' && d.k !== 'houses')) return { n: 0, cap: null, type: '' };
  type = d.k === 'houses' ? 'house' : d.t[0];
  cap = d.k === 'cnt' && d.t.length > 1 ? null : nsCapOf(type);
  if (cap === null || cap === undefined) return { n: d.n, cap: null, type: type };
  return { n: Math.min(d.n, cap), cap: cap, type: type };
}
function nsStepDone(step, s, mem) {
  var d = step.done, i, n, tg;
  if (!d) return false;
  tg = nsStepTarget(step);
  if (d.k === 'cnt') { n = 0; for (i = 0; i < d.t.length; i++) n += s.cnt[d.t[i]] || 0; return n >= tg.n; }
  if (d.k === 'houses') return s.houses >= tg.n;
  if (d.k === 'techAny') return s.techDoneN > 0 || s.busy;
  if (d.k === 'seen') return !!(mem && mem.seen[d.id]);
  return false;
}
function nsSynLab() {
  return { id: 'pre_lab', src: 'chain', tier: 'C', icon: '📜', text: '不妨先蓋座研究院。', why: '要研發新學問,總得先有個研究院。', go: { kind: 'build', type: 'research' } };
}
// 引導鏈目前該推的一步(含前置);全完成 / 全被略過回 null
function nsResolveChain(s, mem, api) {
  var i, st, u, pre, techId, c, tg, capSkip = null, hid, tid;
  for (i = 0; i < NS_CHAIN.length; i++) {
    st = NS_CHAIN[i];
    if (mem.dismissed[st.id]) continue;
    if (NS_TUT_OVERLAP.indexOf(st.id) >= 0 && typeof tutGraduated === 'function' && tutGraduated()) continue;   // 教學已做過的步驟(畢業後略過)
    tg = nsStepTarget(st);
    if (tg.cap === 0) { if (!capSkip) capSkip = { st: st, type: tg.type }; continue; }   // 上限 0(例:Lv1 市集)→ 略過,不推玩家做不到的事
    if (nsStepDone(st, s, mem)) continue;
    if (st.obj && api) {
      techId = nsObjTechId(st.obj);
      if (techId) {
        pre = nsPrereq(techId, api, s);
        if (pre) {
          if (pre.blocked || pre.queued) continue;
          if (pre.lab) { if (mem.dismissed.pre_lab) continue; return nsSynLab(); }
          if (mem.dismissed['pre_' + pre.tech]) continue;
          return { id: 'pre_' + pre.tech, src: 'chain', tier: 'C', icon: '📜', text: '不妨先研發「' + pre.name + '」。', why: '要蓋「' + nsObjName(st) + '」,得先學會這門學問。', go: { kind: 'tech', id: pre.tech } };
        }
      }
    }
    if (st.needLab && !s.lab) { if (mem.dismissed.pre_lab) continue; return nsSynLab(); }
    c = { id: st.id, src: 'chain', tier: 'C', icon: st.icon, text: st.text.replace('{n}', String(tg.n)), why: st.why, go: st.go };
    return c;
  }
  if (capSkip) {   // 整條鏈暫時做不到:推『等級提升後才有名額』提示卡(可 ✕ 關閉)
    hid = 'cap_' + capSkip.type;
    if (mem.dismissed[hid]) return null;
    tid = nsObjTechId(capSkip.st.obj);
    return { id: hid, src: 'chain', tier: 'C', icon: '🔒', text: '〈' + nsObjName(capSkip.st) + '〉要' + nsCapHint(capSkip.type) + '。', why: '名額有上限,先把現有的用好,等發展了再來。', go: tid ? { kind: 'tech', id: tid } : { kind: 'bars' } };
  }
  return null;
}
function nsObjName(st) {
  var id = (typeof fxGoType === 'function') ? fxGoType(st.obj) : st.obj;
  if (typeof OBJECTS !== 'undefined' && OBJECTS[id] && OBJECTS[id].name) return OBJECTS[id].name;
  if (typeof NL_UNLOCK_NAMES !== 'undefined' && NL_UNLOCK_NAMES[id]) return NL_UNLOCK_NAMES[id];
  return id;
}

// 教學畢業後、市令研成前:顧問的「蓋市集 / 研發市令」建議與教學 T9 / T10 重複,先不推(市令研成後恢復)
function nsTutHoldLock(it) {
  if (!it.lock || it.lock.tech !== 'e_shiling') return false;
  if (typeof tutGraduated !== 'function' || !tutGraduated()) return false;
  return !(typeof tutDoneTech === 'function' && tutDoneTech('e_shiling'));
}

// ───────── 簡化城市模式(citysimple.js):只推「蓋什麼 → 解鎖什麼」─────────
// 順序:沒研究院 → 先蓋研究院;想研的科技缺前置建築(且已可蓋)→ 先蓋它;研究院有空槽 → 可研的科技(研成可蓋什麼);
//   基本民生(糧 / 水 / 衛)偏低的一句話提示(顧問黃色);已解鎖但還沒蓋的建築。每類最多 2 張,總數最多 6 張
var NS_SIMPLE_MAX = 6;
function nsBldName(t) { return (typeof OBJECTS !== 'undefined' && OBJECTS[t] && OBJECTS[t].name) || t; }
function nsTechLabel(n) { return (typeof techLabelOf === 'function') ? techLabelOf(n) : n.name; }
function nsBldsOf(n) {   // 節點研成可蓋的實體建築(魔幻世界換本族;去重)
  var out = [];
  (n.unlock || []).forEach(function (u) {
    var t = (typeof fxGoType === 'function') ? fxGoType(u) : u;
    if (typeof OBJECTS !== 'undefined' && OBJECTS[t] && !OBJECTS[t].retired && out.indexOf(t) < 0 && !(typeof fxHiddenObj === 'function' && fxHiddenObj(t))) out.push(t);
  });
  return out;
}
function nsCanBuild(t) {
  var m, n = 0;
  if (typeof isUnlocked === 'function' && !isUnlocked('estate', t)) return false;
  m = (typeof capOf === 'function') ? capOf(t) : null;
  if (m === 0) return false;
  if (m && typeof world !== 'undefined' && world && Array.isArray(world.objects)) { world.objects.forEach(function (o) { if (o && o.type === t) n++; }); if (n >= m) return false; }
  return true;
}
function nsSimpleCands(s, adv, mem) {
  var out = [], seen = {}, ts = (typeof techState === 'function') ? techState() : null, busy = 0, slots = 0, ready = [], blocked = [], built = [], k;
  function push(c) { if (mem.dismissed[c.id] || seen[c.id] || out.length >= NS_SIMPLE_MAX) return; seen[c.id] = 1; out.push(c); }
  if (!s.lab) push({ id: 's_lab', src: 'chain', tier: 'C', icon: '📜', text: '先蓋一座研究院,才能研發科技。', why: '新建築都要先研發對應的科技。', go: { kind: 'build', type: 'research' } });
  if (ts && typeof CITY_TECHS !== 'undefined') {
    busy = (ts.cur || []).length; slots = (typeof techSlots === 'function') ? techSlots() : 0;
    CITY_TECHS.forEach(function (n) {
      var miss;
      if (techDone(n.id) || techIsMega(n) || !techReqMet(n) || !techEraOpen(n.era)) return;
      if ((ts.cur || []).some(function (c) { return c.id === n.id; })) return;
      miss = (typeof techNeedMiss === 'function') ? techNeedMiss(n.id) : [];
      if (miss.length) blocked.push({ n: n, miss: miss }); else if ((ts.queue || []).indexOf(n.id) < 0) ready.push(n);
    });
  }
  blocked.slice(0, 4).forEach(function (b) {
    var t = (typeof techNeedType === 'function') ? techNeedType(b.miss[0]) : b.miss[0];
    if (!nsCanBuild(t) || out.filter(function (c) { return c.id.indexOf('s_need_') === 0; }).length >= 2) return;
    push({ id: 's_need_' + t, src: 'chain', tier: 'C', icon: '🏗', text: '先蓋〈' + nsBldName(t) + '〉,就能研發〈' + nsTechLabel(b.n) + '〉。', why: '「' + nsTechLabel(b.n) + '」的前置建築是' + nsBldName(t) + '。', go: { kind: 'build', type: t } });
  });
  if (s.lab && busy < Math.max(1, slots)) {
    ready.sort(function (a, b) { return a.era - b.era || ((a.cost && a.cost.xue) || 0) - ((b.cost && b.cost.xue) || 0) || (a.id < b.id ? -1 : 1); });
    ready.slice(0, 2).forEach(function (n) {
      var bl = nsBldsOf(n).slice(0, 3).map(nsBldName);
      push({ id: 's_tech_' + n.id, src: 'chain', tier: 'C', icon: '📜', text: '可以研發〈' + nsTechLabel(n) + '〉。', why: bl.length ? '研成可蓋:' + bl.join('、') + '。' : '研成開放新功能。', go: { kind: 'tech', id: n.id } });
    });
  }
  ((adv && adv.items) || []).forEach(function (it) {   // 顧問在簡化模式只剩糧 / 水 / 衛的一句話提示與庫房、研發等
    if (it.core || it.tier === 'B' || mem.dismissed['adv:' + it.id]) return;
    push({ id: 'adv:' + it.id, src: 'advice', tier: it.tier, icon: (typeof STAT_HELP !== 'undefined' && STAT_HELP[it.stat]) ? STAT_HELP[it.stat].icon : '🧭', text: it.text, why: '', go: it.go, item: it });
  });
  if (ts) for (k in ts.done) {
    var n = techNode(k);
    if (!n || n.id !== k) continue;
    nsBldsOf(n).forEach(function (t) { if (built.length < 2 && !(s.cnt[t] > 0) && nsCanBuild(t) && typeof OBJECTS !== 'undefined' && OBJECTS[t].w * OBJECTS[t].h >= 4) built.push({ t: t, n: n }); });
  }
  built.forEach(function (b) { push({ id: 's_bld_' + b.t, src: 'chain', tier: 'C', icon: '🏠', text: '〈' + nsBldName(b.t) + '〉已解鎖,還沒蓋。', why: '研成〈' + nsTechLabel(b.n) + '〉解鎖的建築。', go: { kind: 'build', type: b.t } }); });
  return out;
}

// ───────── 卡包任務 / 提醒(2026-11-09 卡片為主體):有可抽次數、下一個頭目首通贈抽。排在建築建議之後 ─────────
function nsCardCands(mem) {
  var out = [], cs, n, i, st;
  if (typeof cardsGet !== 'function' || typeof cardsPulls !== 'function') return out;
  cs = cardsGet();
  if (!cs) return out;
  n = cardsPulls(cs, 'T') + cardsPulls(cs, 'E');
  if (n >= 10 && !mem.dismissed.card_pulls) out.push({ id: 'card_pulls', src: 'chain', tier: 'C', icon: '🃏', text: '卡片有 ' + n + ' 抽可用(小池 + 大池),不妨抽一輪。', why: '抽到的人直接進卡包;各池次數存滿 ' + CARD_DRAW.cap + ' 就不再累積。', go: { kind: 'cards', tab: 'T' } });
  if (typeof BN_STAGES !== 'undefined' && typeof CARD_BOSS !== 'undefined') {
    for (i = 0; i < BN_STAGES.length; i++) {
      st = BN_STAGES[i];
      if (!st.boss || (cs.boss && cs.boss[st.id])) continue;
      if (!mem.dismissed['card_boss_' + st.id]) out.push({ id: 'card_boss_' + st.id, src: 'chain', tier: 'C', icon: '⚔', text: '任務:首次通關第 ' + st.ch + ' 章頭目〈' + st.name + '〉,送 ' + CARD_BOSS.pulls + ' 抽。', why: '每章頭目首通一次,領過不重複。', go: { kind: 'bn' } });
      break;
    }
  }
  return out;
}

// ───────── 核心:候選清單(純函式)─────────
// adv = advCompute 的結果(或 null);回傳 { cands:[{id,src,tier,icon,text,why,go,item}], top }
function nsCompute(s, adv, mem, api) {
  var reds = [], rest = [], chain, cands = [], items = (adv && adv.items) || [], i, tc;
  tc = (typeof tutCompute === 'function') ? tutCompute(s, mem) : null;   // 新手教學期間:只回傳教學卡(一次一步、不輪播、不能 ✕)
  if (tc) return { cands: [tc], top: tc };
  if (typeof citySimpleOn === 'function' && citySimpleOn() && typeof csTreeOn === 'function' && csTreeOn()) { cands = nsSimpleCands(s, adv, mem).concat(nsCardCands(mem)); return { cands: cands, top: cands[0] || null }; }
  items.forEach(function (it) {
    var h, c;
    if (it.core || mem.dismissed['adv:' + it.id] || nsTutHoldLock(it)) return;
    h = (typeof STAT_HELP !== 'undefined' && STAT_HELP[it.stat]) || null;
    c = { id: 'adv:' + it.id, src: 'advice', tier: it.tier, icon: h ? h.icon : '🧭', text: it.text, why: h ? h.briefNovice : '', go: it.go, item: it };
    if (it.tier === 'R') reds.push(c); else rest.push(c);
  });
  chain = nsResolveChain(s, mem, api);
  cands = reds.slice();
  if (chain && chain.go && chain.go.kind === 'build' && chain.go.type === 'house') {   // 衛生亮燈時先補衛生,再推「多蓋民房」(衛生死結修正)
    for (i = 0; i < rest.length; i++) if (rest[i].item && rest[i].item.stat === 'sani') { cands.push(rest.splice(i, 1)[0]); break; }
  }
  if (chain) cands.push(chain);
  rest.forEach(function (c) { cands.push(c); });
  nsCardCands(mem).forEach(function (c) { cands.push(c); });
  return { cands: cands, top: cands[0] || null };
}

// ───────── 節流計算 ─────────
function nsGet(force) {
  var now, mem, adv, s;
  if (!nsEnabled() && !nsTutForced()) return null;
  now = nsRt.clock();
  if (!force && nsRt.cache && now - nsRt.last < NS_THROTTLE_MS) return nsRt.cache;
  mem = nsBind();
  s = nsSnapshot();
  adv = (typeof advGet === 'function') ? advGet(false) : null;
  nsRt.cache = nsCompute(s, adv, mem, nsTechApi());
  nsRt.last = now;
  if (!nsRt.cache.cands.length || nsRt.cache.cands[0].id !== nsRt.topId) { nsRt.rot = 0; nsRt.topId = nsRt.cache.cands.length ? nsRt.cache.cands[0].id : ''; }
  return nsRt.cache;
}
// 外部每秒呼叫;順手偵測「開過某面板」
function nsTick() {
  var m;
  if (!nsEnabled() && !nsTutForced()) return null;
  if (typeof document !== 'undefined' && document && document.hidden) return nsRt.cache;
  m = nsBind();
  if (typeof panelIsOpen === 'function') {
    if (panelIsOpen('techtree')) nsMarkSeen('tech');
    if (panelIsOpen('goods')) nsMarkSeen('goods');
  }
  if (typeof advUi !== 'undefined' && advUi && advUi.dockOpen) nsMarkSeen('bars');
  return nsGet(false);
}
function nsPick(c) {
  if (!c || !c.cands.length) return null;
  return c.cands[nsRt.rot % c.cands.length];
}
function nsNext() { nsRt.rot++; }

// ───────── 前往 ─────────
function nsGo(cand) {
  if (!cand || !cand.go) return false;
  if (cand.go.kind === 'tut') { if (typeof tutAct === 'function') tutAct(cand.go.id); nsRt.last = -1e15; return true; }
  if (cand.go.kind === 'cards') { if (typeof cardsUiOpen === 'function') cardsUiOpen(cand.go.tab || 'O'); nsRt.last = -1e15; return true; }   // 卡包面板(側欄〈卡包〉同一個)
  if (cand.go.kind === 'bn') { if (typeof uiSideAct === 'function') uiSideAct('bn'); nsRt.last = -1e15; return true; }   // 側欄〈戰鬥〉(未開放時由其 toast 說明缺什麼)
  if (cand.src === 'tut' && cand.go.kind === 'build' && typeof tutGoBuild === 'function') { tutGoBuild(cand.go.type); nsRt.last = -1e15; return true; }   // 教學蓋建築:自動找位置 + 高亮
  if (cand.go.kind === 'bars') {
    if (typeof advUiOpenDock === 'function') advUiOpenDock('bars');
    nsMarkSeen('bars');
  } else {
    if (cand.go.kind === 'panel' && (cand.go.id === 'tech' || cand.go.id === 'goods')) nsMarkSeen(cand.go.id);
    if (typeof advGo === 'function') advGo(cand.item || { go: cand.go });
  }
  nsRt.last = -1e15;
  return true;
}

// ───────── 卡片幾何(純函式,供 UI 與測試)─────────
// 右上小卡:直版 = 頂列下方、右側欄左邊,高度止於 y=20% 之前,尺寸 ≤ 寬 60%、高 18%,絕不進正中央(x25~75% × y20~80%)。橫版 = 頂列下方、右側欄左邊,寬 240、高 124(允許伸入中央上緣,見 nsCardRect)。
var NS_LAND_W = 240, NS_LAND_H = 124;   // 橫版卡片寬 240(≥200)、高 124:容得下 44px 按鈕 + 三行 14px 文字
function nsCardRect(vw, vh, topY, sideW) {
  var side = (sideW > 0) ? sideW : 52, land = vw >= vh, maxW = vw * 0.6, maxH = vh * 0.18, x, y, w, h;
  y = Math.max(4, topY || 50);
  if (land) {
    // 橫版:貼在右側欄左邊、靠上(頂列下方),往內側伸入畫面;不蓋側欄、不進底部工具列與小地圖
    w = Math.min(maxW, NS_LAND_W); x = Math.max(4, vw - side - 6 - w);
    h = NS_LAND_H;
  } else {
    w = Math.min(maxW, vw - side - 6); x = vw - side - w;
    h = Math.min(maxH, vh * 0.2 - y - 2);
  }
  h = Math.max(30, h);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), land: land, showWhy: !land && h >= 84 };
}
function nsRectsOverlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
