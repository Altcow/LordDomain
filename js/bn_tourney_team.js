// js/bn_tourney_team.js — 擂台節目表 + 擂台隊伍頁(2026-11-18,設計_擂台節目表UI_需求.md)。
//   節目表:bnTtShowList(now, st, rep) → 卡框清單(每個擂台時段一張:活動名稱 / 報名時間 / 開戰時間 / 報名隊伍 3 位武將名稱;已開戰的灰階 + 名次),bn_tourney_ui.js 的 bnTourRender 用它畫。
//   擂台隊伍頁 'tourteam'(ldNav 頁、只有左上返回、無右上 ×):擂台隊伍 = 代表隊伍(bnRepGet / bnRepSet,獨立於出征隊伍);候選 = 第 1~5 隊上陣武將(複製,最多 15 位),
//     只能從候選中選 3 位上場、不限 cost、不能改戰法(戰法與等級照武將本身 = 同出征隊伍)、可切換兵種(兵種適性不是 C 的);按〔儲存〕才生效,未儲存離開有簡短確認(ldNav def.guard)。
//   同步問題:採「儲存當下快照」——存檔時把來源隊號與當時的兵種記在擂台存檔的 tt 欄位;之後該武將離開 1~5 隊(gone)或在出征隊伍改了兵種(changed)就在擂台隊伍頁標「與出征隊伍不同步」,
//     不會自動跟著改(要改請重新選 / 儲存);不同步不影響已報名的該屆與既有流程。
// 純函式(bnTt* 開頭,無 DOM,node 可測):bnTtCands bnTtSync bnTtToggle bnTtSlots bnTtTroops bnTtShowList。UI:bnTtOpen / bnTtRender。ES2017,不用 ?. ??;UTF-8 + CRLF。
// 載入順序:bn_tourney_ui.js 之後。依賴(存在才用):bnTeamPresetGet bnRepGet bnRepSet bnUiEntry bnAptOf bnRowOf bnDefaultTroop BN_APT_ORDER BNT bnTourLoad bnTourSave。

var BNTT = { sel: [], troop: {}, dirty: false, el: null, tt: null, src: null, guard: false };
var BNTT_MAX = 3, BNTT_TEAMS = 5;

// ───────── 純函式 ─────────
// presets = [{n, slots:[{id, row, troop}]}](第 1~5 隊,空隊可省略)→ 候選 [{id, n, troop, row}](依隊號 → 主將先;同 id 只留編號小的隊;最多 15)
function bnTtCands(presets) {
  var out = [], seen = {}, list = (presets || []).slice().sort(function (a, b) { return a.n - b.n; });
  list.forEach(function (p) {
    if (!p || p.n < 1 || p.n > BNTT_TEAMS) return;
    (p.slots || []).slice().sort(function (a, b) { return (b.row | 0) - (a.row | 0); }).forEach(function (s) {
      if (!s || typeof s.id !== 'string' || seen[s.id] || out.length >= BNTT_TEAMS * BNTT_MAX) return;
      seen[s.id] = 1; out.push({ id: s.id, n: p.n, troop: s.troop || '', row: s.row | 0 });
    });
  });
  return out;
}
// tt = 存檔的快照 {slots:[{id, n, troop}]} | null;cands = bnTtCands 結果;slots = 目前擂台隊伍 [{id, troop}]
// 回每位擂台武將的同步狀態:{id, state:'ok'|'gone'|'changed'|'new', n, troop}。new = 沒有快照紀錄(舊存檔 / 還沒儲存過)
function bnTtSync(tt, cands, slots) {
  var cm = {}, tm = {};
  (cands || []).forEach(function (c) { cm[c.id] = c; });
  ((tt && tt.slots) || []).forEach(function (x) { tm[x.id] = x; });
  return (slots || []).map(function (s) {
    var c = cm[s.id], t = tm[s.id];
    if (!c) return { id: s.id, state: 'gone', n: t ? t.n : 0, troop: t ? t.troop : '' };
    if (!t) return { id: s.id, state: 'new', n: c.n, troop: c.troop };
    return { id: s.id, state: (t.n === c.n && t.troop === c.troop) ? 'ok' : 'changed', n: c.n, troop: c.troop };
  });
}
// 點選候選:已選 → 取消;未選且不足 3 位 → 加入;已滿 3 位 → 不變。回 {sel, full}
function bnTtToggle(sel, id) {
  var i = (sel || []).indexOf(id), out = (sel || []).slice();
  if (i >= 0) { out.splice(i, 1); return { sel: out, full: false }; }
  if (out.length >= BNTT_MAX) return { sel: out, full: true };
  out.push(id);
  return { sel: out, full: false };
}
// 已選 id(選取順序 = 主將、副將 1、副將 2)+ 各自兵種 → 擂台隊伍 slots(row 2 / 1 / 0,col 0)
function bnTtSlots(sel, troops) {
  var rows = [2, 1, 0];
  return (sel || []).slice(0, BNTT_MAX).map(function (id, i) { return { id: id, row: rows[i], col: 0, troop: (troops && troops[id]) || '' }; });
}
// 這位武將可切換的兵種:適性不是 C 的(順序照 BN_APT_ORDER),目前兵種一定在清單內
function bnTtTroops(e, cur) {
  var out = [], apt = null, order = (typeof BN_APT_ORDER !== 'undefined') ? BN_APT_ORDER : ['槍', '弓', '騎', '盾', '械'];
  try { apt = (typeof bnAptOf === 'function' && e) ? bnAptOf(e).apt : null; } catch (er) { apt = null; }
  order.forEach(function (t) { if (!apt || apt[t] !== 'C' || t === cur) out.push(t); });
  if (cur && out.indexOf(cur) < 0) out.push(cur);
  return out.length ? out : order.slice();
}
// 節目表:st = 擂台存檔(bnTourNorm);rep = 目前擂台隊伍武將名稱陣列;now;回卡框 [{kind:'past'|'open'|'wait', id, name, open, start, left, toOpen, reg, rk, names}]
// 規則:上一屆(已開戰,灰階)+ 目前 / 下一屆 + 之後兩屆(未開放);每屆資訊:報名時間 = open ~ start、開戰時間 = start。
function bnTtShowList(st, rep, now) {
  var sc = bnTourSched(now), out = [], cur = sc.cur || sc.next, S = BN_TOURNEY.sched, k, sl, i, day, order = [], names = (rep || []).slice(0, BNTT_MAX);
  if (sc.prev) out.push({ kind: 'past', id: sc.prev.id, name: '戰隊擂台', open: sc.prev.open, start: sc.prev.start, left: 0, toOpen: 0, reg: !!(st && st.last && st.last.id === sc.prev.id), rk: (st && st.last && st.last.id === sc.prev.id) ? st.last.rk : 0, names: [] });
  if (cur) out.push({ kind: sc.cur ? 'open' : 'wait', id: cur.id, name: '戰隊擂台', open: cur.open, start: cur.start, left: cur.start - now, toOpen: sc.cur ? 0 : cur.open - now, reg: !!(st && st.reg && st.reg.id === cur.id), rk: 0, names: names });
  for (i = 0; i < S.slots.length; i++) order.push(i);
  order.sort(function (a, b) { return S.slots[a] - S.slots[b]; });
  day = sc.day;
  for (k = 0; k < 3 && out.length < 4; k++) {   // 之後的時段(跳過已列的 cur)
    order.forEach(function (si) {
      var s = bnTourSlot(day + k, si);
      if (s.start <= now || out.length >= 4 || out.some(function (o) { return o.id === s.id; })) return;
      out.push({ kind: 'wait', id: s.id, name: '戰隊擂台', open: s.open, start: s.start, left: s.start - now, toOpen: s.open - now, reg: !!(st && st.reg && st.reg.id === s.id), rk: 0, names: names });
    });
  }
  void sl;
  return out;
}

// ───────── UI:節目表卡框(給 bnTourRender)─────────
function bnTtEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bnTtRepNames() {
  var rp = null, out = [];
  try { rp = (typeof bnRepGet === 'function') ? bnRepGet() : null; } catch (e) { rp = null; }
  if (!rp || rp.empty) return out;
  rp.slots.slice().sort(function (a, b) { return (b.row | 0) - (a.row | 0); }).forEach(function (s) { var e = typeof bnUiEntry === 'function' ? bnUiEntry(s.id) : null; out.push(e ? String(e.name) : (s.nm || '?')); });
  return out;
}
function bnTtCardsHtml(st, now) {
  var list = bnTtShowList(st, bnTtRepNames(), now), lock = (typeof bnTourLocked === 'function') && bnTourLocked(), fmt = (typeof bnTourClock === 'function') ? bnTourClock : String, dur = (typeof bnTourFmt === 'function') ? bnTourFmt : String, h = '';
  list.forEach(function (c) {
    var tag = c.kind === 'past' ? '已開戰' : (c.kind === 'open' ? (c.reg ? '已報名' : '報名中') : (c.reg ? '已報名' : '未開放')), cd = c.kind === 'open' ? '距開戰 ' + dur(c.left) : (c.kind === 'wait' ? '距報名 ' + dur(c.toOpen) : (c.rk ? '我方第 ' + c.rk + ' 名' : ''));
    h += '<div class="bt-evt s-' + c.kind + (c.reg ? ' reg' : '') + '" data-slot="' + c.id + '"><div class="bt-et"><b>' + bnTtEsc(c.name) + '</b><span class="bt-tag">' + tag + '</span></div>' +
      '<div class="bt-er"><span>報名</span><b>' + fmt(c.open) + ' ~ ' + fmt(c.start) + '</b></div>' +
      '<div class="bt-er"><span>開戰</span><b>' + fmt(c.start) + '</b><em' + (c.kind !== 'past' && c.id === (list.filter(function (x) { return x.kind !== 'past'; })[0] || {}).id ? ' id="btCd"' : '') + '>' + cd + '</em></div>';
    if (c.kind !== 'past') {
      h += '<div class="bt-er"><span>報名隊伍</span><b class="bt-nm">' + (c.names.length ? c.names.map(bnTtEsc).join(' · ') : '尚未設定') + '</b></div><div class="bt-ea"><button data-tt="gorep">報名隊伍</button>' +
        (c.kind === 'open' && !c.reg && c.names.length ? '<button class="' + (lock ? 'dim' : 'pri') + '" data-tt="join">' + (lock ? (typeof bnTourLockText === 'function' ? bnTourLockText() : '尚未開放') : '報名') + '</button>' : '') + '</div>';
    }
    h += '</div>';
  });
  return h;
}

// ───────── UI:擂台隊伍頁 ─────────
function bnTtPresets() {
  var out = [], i, p;
  if (typeof bnTeamPresetGet !== 'function') return out;
  for (i = 1; i <= BNTT_TEAMS; i++) { p = bnTeamPresetGet(i); if (p && !p.empty && p.slots && p.slots.length) out.push({ n: i, slots: p.slots }); }
  return out;
}
function bnTtStoreTt() { var st = (typeof BNT !== 'undefined' && typeof bnTourLoad === 'function') ? (BNT.store || bnTourLoad()) : null; return st && st.tt ? st.tt : null; }
function bnTtLoadState() {
  var rp = null, tt = bnTtStoreTt();
  try { rp = (typeof bnRepGet === 'function') ? bnRepGet() : null; } catch (e) { rp = null; }
  BNTT.sel = []; BNTT.troop = {}; BNTT.dirty = false; BNTT.tt = tt;
  if (rp && !rp.empty) rp.slots.slice().sort(function (a, b) { return (b.row | 0) - (a.row | 0); }).forEach(function (s) { BNTT.sel.push(s.id); BNTT.troop[s.id] = s.troop || ''; });
  BNTT.cands = bnTtCands(bnTtPresets());
}
function bnTtTroopOf(id) {
  var e = typeof bnUiEntry === 'function' ? bnUiEntry(id) : null, c = null, i;
  if (BNTT.troop[id]) return BNTT.troop[id];
  for (i = 0; i < BNTT.cands.length; i++) if (BNTT.cands[i].id === id) c = BNTT.cands[i];
  return (c && c.troop) || (e && typeof bnDefaultTroop === 'function' ? bnDefaultTroop(e) : '');
}
function bnTtHtml() {
  var cands = BNTT.cands, slots = BNTT.sel.map(function (id) { return { id: id, troop: bnTtTroopOf(id) }; }), sync = bnTtSync(BNTT.tt, cands, slots), sm = {}, h, rn = ['主將', '副將', '副將'];
  sync.forEach(function (x) { sm[x.id] = x; });
  h = '<div class="btt"><div class="btt-sel">';
  [0, 1, 2].forEach(function (i) {
    var id = BNTT.sel[i], e = id && typeof bnUiEntry === 'function' ? bnUiEntry(id) : null, tr, sy;
    if (!e) { h += '<div class="btt-s em"><span>' + rn[i] + '</span><b>空</b></div>'; return; }
    tr = bnTtTroopOf(id); sy = sm[id];
    h += '<div class="btt-s"><span>' + rn[i] + '</span><b>' + bnTtEsc(e.name) + '</b><button data-tt2="troop" data-id="' + bnTtEsc(id) + '">' + bnTtEsc(tr) + '</button>' + (sy && (sy.state === 'gone' || sy.state === 'changed') ? '<i class="btt-ns">與出征隊伍不同步</i>' : '') + '<button class="x" data-tt2="drop" data-id="' + bnTtEsc(id) + '" aria-label="取消">×</button></div>';
  });
  h += '</div><div class="btt-cands">';
  if (!cands.length) h += '<div class="btt-none">第 1~5 隊沒有上陣武將</div>';
  cands.forEach(function (c) {
    var e = typeof bnUiEntry === 'function' ? bnUiEntry(c.id) : null, on = BNTT.sel.indexOf(c.id) >= 0;
    if (!e) return;
    h += '<button class="btt-c' + (on ? ' on' : '') + '" data-tt2="pick" data-id="' + bnTtEsc(c.id) + '"><b>' + bnTtEsc(e.name) + '</b><span>隊' + c.n + ' · ' + bnTtEsc(c.troop) + '</span></button>';
  });
  h += '</div><div class="btt-acts"><button class="btt-save' + (BNTT.dirty ? ' dirty' : '') + '" data-tt2="save">儲存</button></div><div class="btt-pop" hidden><div class="btt-pc"><b>有未儲存的變更</b><button data-tt2="saveleave">儲存並離開</button><button data-tt2="discard">放棄變更</button><button data-tt2="stay">繼續編輯</button></div></div></div>';
  return h;
}
function bnTtRender() { if (BNTT.el) BNTT.el.innerHTML = bnTtHtml(); }
function bnTtToast(m) { if (typeof ldNavToast === 'function') ldNavToast(m); else if (typeof bnTourToast === 'function') bnTourToast(m); }
function bnTtSave() {
  var slots, st, tt, cm = {};
  if (!BNTT.sel.length) { bnTtToast('至少選 1 位'); return false; }
  slots = bnTtSlots(BNTT.sel, (function () { var m = {}; BNTT.sel.forEach(function (id) { m[id] = bnTtTroopOf(id); }); return m; })());
  if (typeof bnRepSet !== 'function' || bnRepSet(slots) === false) { bnTtToast('儲存失敗'); return false; }
  BNTT.cands.forEach(function (c) { cm[c.id] = c; });
  tt = { ts: Date.now(), slots: slots.map(function (s) { var c = cm[s.id]; return { id: s.id, n: c ? c.n : 0, troop: c ? c.troop : '' }; }) };
  if (typeof BNT !== 'undefined' && typeof bnTourLoad === 'function' && typeof bnTourSave === 'function') { st = BNT.store || bnTourLoad(); st.tt = tt; bnTourSave(); }
  BNTT.tt = tt; BNTT.dirty = false;
  if (typeof bnTourIsOpen === 'function' && bnTourIsOpen() && typeof bnTourRender === 'function') bnTourRender();   // 節目表卡框即時更新
  bnTtToast('已儲存');
  return true;
}
function bnTtOnClick(ev) {
  var t = ev && ev.target, b = t && t.closest ? t.closest('[data-tt2]') : null, a, id, r, e, list, i;
  if (!b) return;
  a = b.getAttribute('data-tt2'); id = b.getAttribute('data-id');
  if (a === 'pick') {
    r = bnTtToggle(BNTT.sel, id);
    if (r.full) { bnTtToast('最多 3 位,先取消一位'); return; }
    BNTT.sel = r.sel; BNTT.dirty = true; bnTtRender();
  } else if (a === 'drop') { BNTT.sel = BNTT.sel.filter(function (x) { return x !== id; }); BNTT.dirty = true; bnTtRender(); }
  else if (a === 'troop') {
    e = typeof bnUiEntry === 'function' ? bnUiEntry(id) : null; list = bnTtTroops(e, bnTtTroopOf(id));
    i = list.indexOf(bnTtTroopOf(id)); BNTT.troop[id] = list[(i + 1) % list.length]; BNTT.dirty = true; bnTtRender();
  } else if (a === 'save') bnTtSave();
  else if (a === 'saveleave') { if (bnTtSave()) { BNTT.guard = false; if (typeof ldNavBack === 'function') ldNavBack(); } }
  else if (a === 'discard') { BNTT.dirty = false; if (typeof ldNavBack === 'function') ldNavBack(); }
  else if (a === 'stay') { var p = BNTT.el && BNTT.el.querySelector('.btt-pop'); if (p) p.hidden = true; }
}
// ldNav def.guard:有未儲存的變更時擋下返回,跳出簡短確認(回 true = 已擋下)
function bnTtGuard() {
  var p;
  if (!BNTT.dirty || !BNTT.el) return false;
  p = BNTT.el.querySelector('.btt-pop');
  if (!p) return false;
  p.hidden = false;
  return true;
}
function bnTtCss() {
  var s;
  if (typeof document === 'undefined' || document.getElementById('bnTtCss') || !document.createElement) return;
  s = document.createElement('style'); s.id = 'bnTtCss';
  s.textContent = '.btt{position:relative;padding:10px 12px 16px;box-sizing:border-box;color:#3b2410;font:700 14px/1.3 var(--ld-font,system-ui,sans-serif)}' +
    '.btt-sel{display:flex;gap:6px}.btt-s{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border:2px solid #2a170a;border-radius:10px;background:linear-gradient(#fff3cf,#f0d28a)}' +
    '.btt-s span{font-size:11px;opacity:.7}.btt-s b{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.btt-s.em{opacity:.5;justify-content:center;min-height:70px}' +
    '.btt-s button{min-height:36px;min-width:44px;padding:0 10px;border:2px solid #2a170a;border-radius:8px;background:#fff;color:#3b2410;font:900 14px/1 inherit}.btt-s button.x{position:absolute;right:2px;top:2px;min-height:28px;min-width:28px;padding:0;border-radius:14px}' +
    '.btt-ns{font-style:normal;font-size:11px;color:#a8321b}' +
    '.btt-cands{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;margin-top:10px}.btt-c{display:flex;flex-direction:column;align-items:center;gap:2px;min-height:48px;padding:4px;border:2px solid #2a170a;border-radius:10px;background:linear-gradient(#f4ead2,#d9c9a0);color:#3b2410;font:inherit}' +
    '.btt-c span{font-size:11px;opacity:.7}.btt-c.on{background:linear-gradient(#ffd86b,#e8a93a);box-shadow:inset 0 0 0 2px #fff3cf}.btt-none{grid-column:1/-1;text-align:center;opacity:.7;padding:14px}' +
    '.btt-acts{margin-top:12px;display:flex}.btt-save{flex:1;min-height:48px;border:3px solid #2a170a;border-radius:12px;background:linear-gradient(#cfc8b8,#b0a893);color:#3b2410;font:900 17px/1 inherit}.btt-save.dirty{background:linear-gradient(#9fe0a8,#4fae5d)}' +
    '.btt-pop{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;background:#0008}.btt-pop[hidden]{display:none}.btt-pc{display:flex;flex-direction:column;gap:6px;min-width:200px;padding:12px;border:3px solid #2a170a;border-radius:12px;background:#fff3cf}' +
    '.btt-pc button{min-height:44px;border:2px solid #2a170a;border-radius:8px;background:#f0d28a;color:#3b2410;font:900 15px/1 inherit}';
  (document.head || document.body).appendChild(s);
}
function bnTtOpen() { return typeof ldNavPush === 'function' ? ldNavPush('tourteam') : false; }

if (typeof ldNavRegister === 'function') {
  ldNavRegister({ id: 'tourteam', title: '擂台隊伍', noClose: true,
    build: function (el) {
      bnTtCss(); bnTtLoadState();
      BNTT.el = el; BNTT.guard = true;
      el.addEventListener('click', bnTtOnClick);
      bnTtRender();
    },
    guard: function () { return bnTtGuard(); },
    onHide: function () { BNTT.el = null; BNTT.dirty = false; BNTT.guard = false; }
  });
}
