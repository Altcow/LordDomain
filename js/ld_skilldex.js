// js/ld_skilldex.js — 戰法大全(頁 'skilldex')與戰法詳情(頁 'skill')(設計_傳承選擇與推薦戰法.md 第④節 R5)。前綴 ldSkd / LDSKD / skd。
// 範圍:只列第一季可得的 72 個戰法(54 個名人傳承 + 18 本兵書;名單 = SKREC.skill 的 key),另有「其他戰法」摺疊段收已解鎖但不在 72 個內的。
// ctx(skilldex):{ q 搜尋字, fn 功能, tier 階級, st 狀態('own'|'inh'|'none'), fopen 篩選面板, forEid 只看「推薦給此人」的 6 個, other 其他戰法展開 };ctx(skill):{ id, confirm(待確認的「從別人卸下並裝」的名人 id) }。
// 資料:skill_rec.js(skrSource / skrSkillHeroes / skrCands / skrLegacyFig / skrWhyText)、bn_skcard.js(裝卸 / 持有人)、bn_text.js(bnSkillInfo)、bn_flavor.js(典故)。外部全域一律 typeof 守衛。
// 入口:卡包頁頂列「戰法大全」鈕(cardsui_skills.js)、武將頁戰法書籤「看更多候選 ›」(ld_hero.js)。跳轉:武將頁「看戰法詳情 ›」→ skill;skill → hero(裝給他 / 去拆);隊伍頁推薦戰法 → skill。
// 純函式(skdPoolIds / skdFn / skdListIds / skdEquipPlan)與 DOM 分開,供 tools/test_ld_skilldex.js 測試。ES2017;不用 ?. ??。
var LDSKD = {
  fns: ['物理輸出', '謀略輸出', '扛傷', '護隊', '治療', '增益', '擾敵'],
  tiers: ['S', 'A', 'B', 'C'],
  sts: [['', '全部'], ['own', '已解鎖'], ['inh', '可拆'], ['none', '還沒有']],
  pool: null, poolKey: ''
};

function skdEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function skdToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function skdCs() { try { return (typeof cardsGet === 'function') ? cardsGet() : null; } catch (e) { return null; } }
function skdSk(id) { return (typeof BN_SKILLS !== 'undefined' && BN_SKILLS && typeof id === 'string' && Object.prototype.hasOwnProperty.call(BN_SKILLS, id)) ? BN_SKILLS[id] : null; }
function skdName(id) { var d = skdSk(id); return d ? d.name : String(id || ''); }
function skdTier(id) { try { return (typeof bnSkcTier === 'function' && bnSkcTier(id)) || ''; } catch (e) { return ''; } }
function skdFigName(fig) { return (typeof skrFigName === 'function') ? skrFigName(fig) : String(fig || ''); }
function skdNorm(s) { return (typeof srNorm === 'function') ? srNorm(s) : String(s === undefined || s === null ? '' : s).replace(/\s+/g, '').toLowerCase(); }
function skdShort(id) { try { return (typeof bnSkillShort === 'function') ? bnSkillShort(id) : ''; } catch (e) { return ''; } }
function skdOwned(id) { try { return typeof bnSkcOwned === 'function' && bnSkcOwned(id); } catch (e) { return false; } }
function skdLegacyFig(id) { return (typeof skrLegacyFig === 'function') ? skrLegacyFig(id) : ''; }

// ───────── 範圍:第一季可得的戰法 ─────────
// 依階級(S → A → B)、再依名人傳承在前、通用在後排序;結果快取到 SKREC 換掉為止
function skdPoolIds() {
  var R = (typeof SKREC !== 'undefined' && SKREC && SKREC.skill) ? SKREC : null, key, ids, ord = { S: 0, A: 1, B: 2, C: 3 };
  if (!R) return [];
  key = Object.keys(R.skill).length + '|' + (R.gen || '');
  if (LDSKD.pool && LDSKD.poolKey === key) return LDSKD.pool.slice();
  ids = Object.keys(R.skill).filter(function (id) { return !!skdSk(id) && !!skdTier(id); });
  ids = ids.map(function (id, i) { return { id: id, i: i, t: ord[skdTier(id)] === undefined ? 9 : ord[skdTier(id)], g: skdLegacyFig(id) ? 0 : 1 }; })
    .sort(function (a, b) { return (a.t - b.t) || (a.g - b.g) || (a.i - b.i); }).map(function (x) { return x.id; });
  LDSKD.pool = ids; LDSKD.poolKey = key;
  return ids.slice();
}
function skdPoolSet() { var m = {}; skdPoolIds().forEach(function (id) { m[id] = 1; }); return m; }
// 其他戰法:已解鎖、有階級、但不在第一季 72 個之內
function skdOtherIds() {
  var set = skdPoolSet(), own = {}, out = [];
  try { own = bnSkcLoad().own || {}; } catch (e) { own = {}; }
  Object.keys(own).forEach(function (id) { if (!set[id] && skdTier(id)) out.push(id); });
  return out.sort(function (a, b) { return skdName(a) < skdName(b) ? -1 : 1; });
}
// 已解鎖數 / 總數(只算第一季 72 個)
function skdCount() {
  var ids = skdPoolIds(), n = 0;
  ids.forEach(function (id) { if (skdOwned(id)) n++; });
  return { own: n, total: ids.length };
}

// ───────── 功能分類(同 tools/gen_skill_rec.js 的 fnOf;覆寫表目前是空的) ─────────
function skdFn(id) {
  var s = skdSk(id), k, t;
  if (!s) return '';
  k = s.kind; t = s.target || '';
  if (/^atk_/.test(k) || k === 'execute_chain') return (s.dmg === 'strat' || k === 'atk_cross') ? '謀略輸出' : '物理輸出';
  if (k === 'delay_burst') return '謀略輸出';
  if (k === 'taunt' || (k === 'guard' && t === 'ally_lowest') || (k === 'shield_single' && t === 'self')) return '扛傷';
  if (k === 'shield_all' || k === 'shield_single' || k === 'guard' || k === 'buff_def' || k === 'summon') return '護隊';
  if (k === 'heal_all' || k === 'heal_single' || k === 'cleanse') return '治療';
  if (k === 'buff_atk' || k === 'buff_spd' || k === 'reorder' || k === 'self_sacrifice') return '增益';
  return '擾敵';
}
function skdKindText(id) { var d = skdSk(id); return (d && typeof BN_TEXT_CATS !== 'undefined' && BN_TEXT_CATS[d.cat]) || '戰法'; }

// ───────── 取得狀態、持有人 ─────────
function skdSrc(cs, id) {
  if (typeof skrSource === 'function') return skrSource(cs, id);
  return { k: skdOwned(id) ? 'own' : 'none', text: skdOwned(id) ? '已解鎖' : '目前無法取得' };
}
// 狀態鍵:own 已解鎖 / inh 可拆(手上有那位的卡)/ none 還沒有
function skdStKey(src) { var k = src && src.k; return k === 'own' ? 'own' : (k === 'inh' || k === 'inhWait' || k === 'inhRoster') ? 'inh' : 'none'; }
function skdHolders(cs, id) {
  var eq = {}, out = [], k, i, f;
  try { eq = bnSkcLoad().eq || {}; } catch (e) { eq = {}; }
  for (k in eq) for (i = 0; i < 2; i++) if (eq[k][i] === id) { f = (cs && typeof cardsFind === 'function') ? cardsFind(cs, k) : null; if (f) out.push({ eid: k, slot: i, name: f.e.name, e: f.e, list: f.list }); }
  return out;
}
function skdEqNames(e) {
  var eq = [];
  try { eq = (bnSkcLoad().eq[e.id] || []).filter(function (x) { return !!x; }); } catch (er) { eq = []; }
  return eq.map(skdName);
}

// ───────── 清單篩選(純函式) ─────────
// ctx:{ q, fn, tier, st, forEid };回 id 陣列(forEid 時依推薦順序,否則依 skdPoolIds 順序)
function skdListIds(cs, ctx) {
  var c = ctx || {}, q = c.q ? skdNorm(c.q) : '', ids, e, rec;
  if (c.forEid) {
    e = (cs && typeof cardsFind === 'function') ? cardsFind(cs, c.forEid) : null;
    rec = (e && typeof skrCands === 'function') ? skrCands(e.e).map(function (x) { return x[0]; }) : [];
    ids = rec.filter(function (id, i, a) { return a.indexOf(id) === i && !!skdTier(id); });
  } else ids = skdPoolIds();
  return ids.filter(function (id) {
    var src, hay;
    if (c.fn && skdFn(id) !== c.fn) return false;
    if (c.tier && skdTier(id) !== c.tier) return false;
    if (c.st) { src = skdSrc(cs, id); if (skdStKey(src) !== c.st) return false; }
    if (q) {
      hay = skdName(id) + ' ' + skdShort(id) + ' ' + skdFn(id) + ' ' + skdFigName(skdLegacyFig(id)) + ' ' +
        ((typeof SKREC !== 'undefined' && SKREC && SKREC.skill && SKREC.skill[id]) ? SKREC.skill[id].map(function (x) { return skdFigName(x[0]); }).join(' ') : '') + ' ' +
        skdHolders(cs, id).map(function (h) { return h.name; }).join(' ');
      if (skdNorm(hay).indexOf(q) < 0) return false;
    }
    return true;
  });
}
function skdFilterCount(ctx) { var n = 0; if (ctx.fn) n++; if (ctx.tier) n++; if (ctx.st) n++; return n; }

// ───────── 小零件 ─────────
function skdTag(id) { var t = skdTier(id); return '<i class="skd-tg t' + skdEsc(t) + '">' + skdEsc(t) + '</i>'; }
function skdAvatar(fig, name) {
  if (typeof ldHeroAvatar === 'function') return ldHeroAvatar(fig, name);
  return '<span class="ldh-av"><u>' + skdEsc(String(name || '').charAt(0)) + '</u></span>';
}
function skdSync() {
  if (typeof ldHeroSync === 'function') { ldHeroSync(); return; }
  if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
}
function skdGo(id, ctx) {   // 開頁(已在堆疊 = 退回那層;層數滿了 ldNavPush 自己提示)
  if (typeof ldNavPush !== 'function') { skdToast('即將開放'); return false; }
  return ldNavPush(id, ctx || {});
}

// ───────── 戰法大全(清單) ─────────
function skdRowHtml(cs, id) {
  var src = skdSrc(cs, id), st = skdStKey(src), hs = skdHolders(cs, id), fig = skdLegacyFig(id), stTxt = st === 'own' ? '已解鎖' : st === 'inh' ? '可拆' : '未得';
  return '<button class="skd-row ' + st + '" data-act="open" data-v="' + skdEsc(id) + '">' +
    '<span class="skd-r1">' + skdTag(id) + '<b>' + skdEsc(skdName(id)) + '</b><em class="skd-fn">' + skdEsc(skdFn(id)) + '</em><u class="skd-st ' + st + '">' + stTxt + '</u></span>' +
    '<span class="skd-r2">' + skdEsc(skdShort(id)) + '</span>' +
    '<span class="skd-r3">' + (fig ? '傳承:' + skdEsc(skdFigName(fig)) + ' · ' : '通用 · ') + (st === 'own' ? '' : skdEsc(src.text || '') + ' · ') + (hs.length ? '裝在 ' + hs.map(function (h) { return skdEsc(h.name); }).join('、') : '沒人裝') + '</span></button>';
}
function skdChip(act, v, label, on) { return '<button class="skd-chip' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + skdEsc(v) + '">' + skdEsc(label) + '</button>'; }
function skdFilterHtml(ctx) {
  var h = '<div class="skd-fp">';
  h += '<div class="skd-fg"><i>功能</i>' + skdChip('fn', '', '全部', !ctx.fn) + LDSKD.fns.map(function (f) { return skdChip('fn', f, f, ctx.fn === f); }).join('') + '</div>';
  h += '<div class="skd-fg"><i>階級</i>' + skdChip('tier', '', '全部', !ctx.tier) + LDSKD.tiers.map(function (t) { return skdChip('tier', t, t, ctx.tier === t); }).join('') + '</div>';
  h += '<div class="skd-fg"><i>狀態</i>' + LDSKD.sts.map(function (s) { return skdChip('st', s[0], s[1], (ctx.st || '') === s[0]); }).join('') + '</div>';
  return h + '</div>';
}
// 清單主體(搜尋輸入時只重畫這一塊,不動搜尋框)
function skdListBoxHtml(cs, ctx) {
  var ids = skdListIds(cs, ctx), cnt = skdCount(), h = '', other, e;
  if (ctx.forEid) {
    e = (typeof cardsFind === 'function' && cs) ? cardsFind(cs, ctx.forEid) : null;
    h += '<div class="skd-for">只看「推薦給 ' + skdEsc(e ? e.e.name : '此人') + '」的戰法(依推薦順序)<button class="skd-mini" data-act="unfor">看全部</button></div>';
  }
  h += '<div class="skd-count">' + (ctx.forEid ? '推薦 ' : '顯示 ') + ids.length + ' 個 · 已解鎖 ' + cnt.own + ' / 第一季可得 ' + cnt.total + '</div>';
  if (!ids.length) h += '<div class="skd-none">沒有符合的戰法。<button class="skd-mini" data-act="clr">清除篩選</button></div>';
  h += ids.map(function (id) { return skdRowHtml(cs, id); }).join('');
  other = skdOtherIds();
  if (!ctx.forEid) {
    h += '<div class="skd-oth">';
    if (other.length) h += '<button class="skd-ob" data-act="other">其他戰法(' + other.length + ')' + (ctx.other ? ' ▴' : ' ▾') + '</button>' + (ctx.other ? '<div class="skd-olist">' + other.map(function (id) { return skdRowHtml(cs, id); }).join('') + '</div>' : '');
    else h += '<div class="skd-onone">其他戰法:沒有(已解鎖但不在第一季 ' + cnt.total + ' 個之內的戰法會收在這裡)</div>';
    h += '</div>';
  }
  return h;
}
function skdDexHtml(cs, ctx) {
  var n = skdFilterCount(ctx);
  return '<div class="skd skd-dex"><div class="skd-bar"><input class="skd-q" type="search" data-skd="q" placeholder="搜尋戰法、效果或武將名" autocomplete="off" value="' + skdEsc(ctx.q || '') + '">' +
    '<button class="skd-fb' + (n || ctx.fopen ? ' on' : '') + '" data-act="ftog">篩選' + (n ? ' ' + n : '') + (ctx.fopen ? ' ▴' : ' ▾') + '</button></div>' +
    '<div class="skd-scroll">' + (ctx.fopen ? skdFilterHtml(ctx) : '') + '<div class="skd-listbox">' + skdListBoxHtml(cs, ctx) + '</div></div></div>';
}
function skdDexRender(el, ctx) {
  var cs = skdCs(), sc = null, y = 0, s2;
  ctx.dexEl = el;
  if (!cs) { el.innerHTML = '<p class="ldp-empty">尚無卡包資料</p>'; return false; }
  if (typeof el.querySelector === 'function') { sc = el.querySelector('.skd-scroll'); y = sc ? sc.scrollTop : 0; }
  el.innerHTML = skdDexHtml(cs, ctx);
  el.onclick = function (ev) { skdOnClick(ctx, ev); };
  el.oninput = function (ev) { skdOnInput(ctx, ev); };
  if (y && typeof el.querySelector === 'function') { s2 = el.querySelector('.skd-scroll'); if (s2) s2.scrollTop = y; }
  skdFillRes(ctx);
  return true;
}
function skdDexRefreshList(ctx) {
  var el = ctx.dexEl, box = (el && typeof el.querySelector === 'function') ? el.querySelector('.skd-listbox') : null, cs = skdCs();
  if (!box || !cs) return false;
  box.innerHTML = skdListBoxHtml(cs, ctx);
  return true;
}
function skdFillRes(ctx) {
  var r = ctx.resEl, c = skdCount(), p;
  if (!r || typeof document === 'undefined') return;
  r.innerHTML = '';
  p = document.createElement('span'); p.className = 'ld-pill gold ldp-pill'; p.textContent = '已解鎖 ' + c.own + '/' + c.total;
  r.appendChild(p);
}
function skdOnInput(ctx, ev) {
  var t = ev && ev.target;
  if (!t || !t.getAttribute || t.getAttribute('data-skd') !== 'q') return false;
  ctx.q = t.value;
  return skdDexRefreshList(ctx);
}
function skdFindAct(root, ev) {
  var n = ev ? ev.target : null;
  while (n && n !== root && n.getAttribute && !n.getAttribute('data-act')) n = n.parentNode;
  return (n && n.getAttribute && n.getAttribute('data-act')) ? n : null;
}
function skdOnClick(ctx, ev) {
  var b = skdFindAct(ctx.dexEl, ev);
  if (!b) return false;
  if (b.hasAttribute && b.hasAttribute('disabled')) return false;
  return skdDexAct(ctx, b.getAttribute('data-act'), b.getAttribute('data-v'));
}
// 清單頁動作;回 true = 已處理
function skdDexAct(ctx, act, v) {
  if (act === 'open') { skdGo('skill', { id: v }); return true; }
  if (act === 'ftog') ctx.fopen = !ctx.fopen;
  else if (act === 'fn') ctx.fn = v || '';
  else if (act === 'tier') ctx.tier = v || '';
  else if (act === 'st') ctx.st = v || '';
  else if (act === 'clr') { ctx.fn = ''; ctx.tier = ''; ctx.st = ''; ctx.q = ''; }
  else if (act === 'unfor') ctx.forEid = '';
  else if (act === 'other') ctx.other = !ctx.other;
  else return false;
  if (ctx.dexEl) skdDexRender(ctx.dexEl, ctx);
  return true;
}

// ───────── 戰法詳情 ─────────
// 裝給某位名冊武將的計畫(純邏輯):回 { k:'have'|'ok'|'swap'|'pick'|'no', slot?, holder?, msg? }
function skdEquipPlan(cs, e, sid) {
  var n, cur, i, c, full = null, empty = -1, hd, why = '';
  if (!cs || !e || !skdSk(sid)) return { k: 'no', msg: '找不到這位武將或戰法' };
  if (!skdOwned(sid)) return { k: 'no', msg: '『' + skdName(sid) + '』還沒有解鎖' };
  n = bnSkcSlots(e); cur = bnSkcLoad().eq[e.id] || [null, null];
  if (cur.indexOf(sid) >= 0) return { k: 'have' };
  if (!n) return { k: 'no', msg: e.name + ' 品階不足,沒有可裝的選擇槽' };
  for (i = 0; i < n; i++) {
    c = bnSkcCanEquip(cs, e, i, sid);
    if (c.ok) { if (!cur[i]) return { k: 'ok', slot: i }; continue; }
    if (c.reason === 'full') { full = c; if (empty < 0 && !cur[i]) empty = i; } else why = c.reason;
  }
  if (full) {
    hd = (full.holders || [])[0];
    if (hd && full.max === 1 && empty >= 0) {
      return { k: 'swap', slot: empty, holder: { eid: hd, name: (skdHolders(cs, sid).filter(function (h) { return h.eid === hd; })[0] || {}).name || '別人' } };
    }
    return { k: 'pick' };
  }
  for (i = 0; i < n; i++) if (bnSkcCanEquip(cs, e, i, sid).ok) return { k: 'pick' };
  return { k: 'no', msg: (typeof LDHERO_REASON !== 'undefined' && LDHERO_REASON[why]) || '無法裝備' };
}
// 執行裝備;confirmed = true 才會從別人身上卸下。回 { ok, done, need?(要確認), msg }
function skdEquip(cs, e, sid, confirmed) {
  var p = skdEquipPlan(cs, e, sid), r;
  if (p.k === 'no') return { ok: false, done: true, msg: p.msg };
  if (p.k === 'have') return { ok: true, done: true, msg: e.name + ' 已經裝著『' + skdName(sid) + '』' };
  if (p.k === 'pick') return { ok: true, done: false, pick: true, msg: e.name + ' 的選擇槽都滿了,請選要換掉哪一格' };
  if (p.k === 'swap') {
    if (!confirmed) return { ok: true, done: false, need: 'swap', holder: p.holder, msg: '' };
    bnSkcUnequip(p.holder.eid, (skdHolders(cs, sid).filter(function (h) { return h.eid === p.holder.eid; })[0] || { slot: 0 }).slot);
  }
  r = bnSkcEquip(cs, e, p.slot, sid);
  if (!r.ok) return { ok: false, done: true, msg: '無法裝備:' + ((typeof LDHERO_REASON !== 'undefined' && LDHERO_REASON[r.reason]) || r.reason) };
  return { ok: true, done: true, msg: '已讓 ' + e.name + ' 裝上『' + skdName(sid) + '』' + (p.k === 'swap' ? '(已從 ' + p.holder.name + ' 卸下)' : '') };
}
function skdFlavor(id) { return (typeof BN_FLAVOR !== 'undefined' && BN_FLAVOR && BN_FLAVOR[id]) || ''; }
function skdSecEffect(id) {
  var info = (typeof bnSkillInfo === 'function') ? bnSkillInfo(id) : null, lines = info ? info.lines.filter(function (l) { return String(l[0]).indexOf('典故') < 0; }) : [], d = skdSk(id), extra = [];
  if (d && d.cd) extra.push(['冷卻', d.cd + ' 回合']);
  return lines.concat(extra).map(function (l) { return '<p><em>' + skdEsc(l[0]) + '</em>' + skdEsc(l[1]) + '</p>'; }).join('') || '<p class="skd-mute">沒有效果說明。</p>';
}
function skdSecGet(cs, id) {
  var src = skdSrc(cs, id), fig = skdLegacyFig(id), h = '', e = src.e;
  h += '<p class="big">' + skdEsc(src.text || '') + '</p>';
  if (fig) h += '<p>這是 ' + skdEsc(skdFigName(fig)) + ' 的傳承戰法,每位武將只有 1 個;拆他的卡就永久解鎖,之後可以裝給任何人。</p>';
  else if (src.k === 'book') h += '<p>這是通用戰法,不屬於任何一位名人;可以多人同時裝。</p>';
  else h += '<p>這是通用戰法,不屬於任何一位名人。</p>';
  if (src.k === 'inh' || src.k === 'inhWait' || src.k === 'inhRoster') {
    if (e && e.id) h += '<div class="skd-acts"><button class="skd-btn" data-act="inhgo" data-v="' + skdEsc(e.id) + '">' + (src.k === 'inhRoster' ? '去看那位路人' : '去看' + skdEsc(skdFigName(fig)) + '的傳承') + ' ›</button></div>';
  } else if (src.k === 'draw') h += '<p class="skd-mute">你的卡包目前沒有這位武將。</p>';
  return h;
}
function skdSecBest(cs, id) {
  var K = (typeof BN_KIT_CFG !== 'undefined' && BN_KIT_CFG) || {}, fig = skdLegacyFig(id), mx = (typeof bnSkcMaxUse === 'function') ? bnSkcMaxUse(id) : 1, used = skdHolders(cs, id).length, h = '';
  if (fig) h += '<p>' + skdEsc(skdFigName(fig)) + ' 本人裝(本命):效果 100%、發動率 +' + Math.round((+K.homeRate || 0) * 100) + '%</p><p>其他人裝:效果 ' + Math.round((+K.otherDefaultMul || 0) * 100) + '%</p>';
  else h += '<p>通用戰法:誰裝效果都一樣,沒有本命加成。</p>';
  return h + '<p class="skd-mute">同時最多 ' + mx + ' 人裝,目前 ' + used + ' 人裝</p>';
}
function skdHeroBtn(cs, id, x, ctx) {
  var tag = x.home ? '本命' : (x.whyText || ''), st = x.state === 'roster' ? '在卡包' : x.state === 'owned' ? '不在卡包' : '未擁有', plan = null, eqTxt = '', btn = '', conf = false;
  if (x.state === 'roster' && x.e) {
    plan = skdEquipPlan(cs, x.e, id);
    eqTxt = skdEqNames(x.e).join('、');
    conf = !!(plan.k === 'swap' && ctx && ctx.confirm === x.fig);
    if (plan.k === 'have') btn = '<button class="skd-eq done" disabled>已裝 ✓</button>';
    else if (plan.k === 'ok') btn = '<button class="skd-eq" data-act="eq" data-fig="' + skdEsc(x.fig) + '">裝給他</button>';
    else if (plan.k === 'swap') btn = '<button class="skd-eq warn" data-act="eq" data-fig="' + skdEsc(x.fig) + '">' + (conf ? '確定從' + skdEsc(plan.holder.name) + '卸下?' : '從' + skdEsc(plan.holder.name) + '卸下並裝給他') + '</button>';
    else if (plan.k === 'pick') btn = '<button class="skd-eq" data-act="eq" data-fig="' + skdEsc(x.fig) + '">選槽裝備</button>';
    else btn = '<button class="skd-eq" disabled>' + skdEsc(!skdOwned(id) ? '尚未解鎖' : '無法裝備') + '</button>';
  } else btn = '<button class="skd-eq" disabled>' + (x.state === 'owned' ? '不在卡包' : '未擁有') + '</button>';
  return '<div class="skd-hr ' + x.state + (x.home ? ' home' : '') + '"><button class="skd-hb" data-act="herogo" data-fig="' + skdEsc(x.fig) + '">' + skdAvatar(x.fig, x.name) + '<span><b>' + skdEsc(x.name) + '</b><i>' + skdEsc(st) + (tag ? ' · ' + skdEsc(tag) : '') + '</i>' +
    (eqTxt ? '<em>現在裝:' + skdEsc(eqTxt) + '</em>' : '') + '</span></button>' + btn + '</div>';
}
function skdSecHeroes(cs, id, ctx) {
  var list = (typeof skrSkillHeroes === 'function') ? skrSkillHeroes(cs, id) : [];
  if (!list.length) return '<p class="skd-mute">這個戰法沒有推薦武將。</p>';
  return list.map(function (x) { return skdHeroBtn(cs, id, x, ctx); }).join('');
}
function skdSecHolders(cs, id) {
  var hs = skdHolders(cs, id);
  if (!hs.length) return '<p class="skd-mute">目前沒有人裝著這個戰法。</p>';
  return '<div class="skd-hl">' + hs.map(function (h) {
    return '<button class="skd-hb" data-act="hero" data-v="' + skdEsc(h.eid) + '">' + skdAvatar(h.e.fig || '', h.name) + '<span><b>' + skdEsc(h.name) + '</b><i>選擇槽 ' + (h.slot + 1) + '</i></span></button>';
  }).join('') + '</div>';
}
function skdDetailHtml(cs, ctx) {
  var id = ctx.id, d = skdSk(id), own, src, fl;
  if (!d || !skdTier(id)) return '<p class="ldp-empty">找不到這個戰法</p>';
  own = skdOwned(id); fl = skdFlavor(id);
  return '<div class="skd skd-det">' +
    '<div class="skd-hd">' + skdTag(id) + '<b>' + skdEsc(d.name) + '</b><em class="skd-fn">' + skdEsc(skdFn(id)) + '</em><em class="skd-kd">' + skdEsc(skdKindText(id)) + '</em><u class="skd-st ' + (own ? 'own' : 'none') + '">' + (own ? '已解鎖' : '未得') + '</u></div>' +
    '<section class="skd-sec"><h4>效果</h4>' + skdSecEffect(id) + '</section>' +
    '<section class="skd-sec"><h4>典故</h4><p>' + skdEsc(fl || (skdLegacyFig(id) ? '依人物經歷與個性設計(史料較少者為推想)。' : '通用戰法沒有特定人物的典故。')) + '</p></section>' +
    '<section class="skd-sec"><h4>怎麼取得</h4>' + skdSecGet(cs, id) + '</section>' +
    '<section class="skd-sec"><h4>誰裝最強</h4>' + skdSecBest(cs, id) + '</section>' +
    '<section class="skd-sec skd-wide"><h4>推薦武將</h4>' + skdSecHeroes(cs, id, ctx) + '</section>' +
    '<section class="skd-sec"><h4>目前裝在</h4>' + skdSecHolders(cs, id) + '</section>' +
    '</div>';
}
function skdDetailRender(el, ctx) {
  var cs = skdCs();
  ctx.detEl = el;
  if (!cs) { el.innerHTML = '<p class="ldp-empty">尚無卡包資料</p>'; return false; }
  el.innerHTML = skdDetailHtml(cs, ctx);
  el.onclick = function (ev) { var b = skdFindAct(ctx.detEl, ev); if (b && !(b.hasAttribute && b.hasAttribute('disabled'))) skdDetAct(ctx, b.getAttribute('data-act'), b.getAttribute('data-v'), b); };
  if (ctx.titleEl && skdSk(ctx.id)) ctx.titleEl.textContent = skdName(ctx.id);
  return true;
}
// 詳情頁動作;回 true = 已處理。b = 被點的元素(取 data-fig)
function skdDetAct(ctx, act, v, b) {
  var cs = skdCs(), fig = b && b.getAttribute ? b.getAttribute('data-fig') : '', h, e, r, f;
  if (!cs) return false;
  if (act === 'hero' || act === 'inhgo') {
    f = cardsFind(cs, v);
    if (!f) { skdToast('找不到這位武將'); return true; }
    skdGo('hero', { id: v, list: [v], tab: act === 'inhgo' ? 'inh' : 'attr' });
    return true;
  }
  if (act === 'herogo') {
    h = (typeof skrSkillHeroes === 'function' ? skrSkillHeroes(cs, ctx.id) : []).filter(function (x) { return x.fig === fig; })[0];
    if (!h || h.state === 'none') { skdToast('你還沒有 ' + skdFigName(fig) + (skdSk(ctx.id) ? ',抽到後就能裝這個戰法' : '')); return true; }
    if (h.state === 'owned') { skdToast(skdFigName(fig) + ' 不在卡包,先收入卡包'); return true; }
    skdGo('hero', { id: h.e.id, list: [h.e.id], tab: 'attr' });
    return true;
  }
  if (act === 'eq') {
    h = (typeof skrSkillHeroes === 'function' ? skrSkillHeroes(cs, ctx.id) : []).filter(function (x) { return x.fig === fig; })[0];
    e = h && h.state === 'roster' ? h.e : null;
    if (!e) { skdToast('這位武將不在卡包'); return true; }
    r = skdEquip(cs, e, ctx.id, ctx.confirm === fig);
    if (r.need === 'swap') { ctx.confirm = fig; skdDetailRender(ctx.detEl, ctx); return true; }
    ctx.confirm = '';
    if (r.pick) { skdToast(r.msg); skdGo('heroSkillPick', { eid: e.id, slot: 0 }); return true; }
    if (r.ok && r.done) skdSync();
    skdToast(r.msg);
    skdDetailRender(ctx.detEl, ctx);
    return true;
  }
  return false;
}

ldNavRegister({
  id: 'skilldex', title: '戰法大全',
  res: function () { var c = skdCount(); return [['已解鎖', c.own + '/' + c.total]]; },
  build: function (el, ctx) {
    if (typeof ctx.q !== 'string') ctx.q = '';
    ctx.fn = ctx.fn || ''; ctx.tier = ctx.tier || ''; ctx.st = ctx.st || ''; ctx.forEid = ctx.forEid || '';
    ctx.fopen = !!ctx.fopen; ctx.other = !!ctx.other;
    if (el.classList) el.classList.add('skd-body');
    skdDexRender(el, ctx);
  },
  onShow: function (el, ctx) { if (ctx.dexEl) skdDexRender(ctx.dexEl, ctx); }   // 從詳情 / 武將頁退回:重畫(裝備可能已變)
});
ldNavRegister({
  id: 'skill', title: '戰法', noClose: true,
  build: function (el, ctx) { ctx.confirm = ''; skdDetailRender(el, ctx); },
  onShow: function (el, ctx) { if (ctx.detEl) { ctx.confirm = ''; skdDetailRender(ctx.detEl, ctx); } }
});
if (typeof module !== 'undefined' && module.exports) module.exports = { skdPoolIds: skdPoolIds, skdFn: skdFn };
