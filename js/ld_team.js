// js/ld_team.js — 新介面骨架:整隊頁(設計_介面骨架實作計畫.md §3-6、任務卡 3)。前綴 ldTeam / LDTEAM。登錄頁 id 'team'。
// ctx = { n:隊伍序號(1~), mode:'edit'|'battle', stg:戰鬥設定(battle 時帶入 bnUiStartWith), title }。mode:'battle' 金鈕「開始戰鬥」,'edit' 金鈕「練兵出戰」(stg = 練兵)。
// 站位:前鋒 row 0、中衛 row 1、主將 row 2(主將);每次變更立即存回第 n 隊預設(bnTeamPresetSet)。卡片來源 = 卡包名冊(bnUiRosterList)。
// 開戰:存檔 → bnUiStartWith(slots, stg)。bnui 的 stg.onEnd 在「開打當下」就會呼叫(引擎先算到底再播戲台),所以本頁自己輪詢:結算畫面按「離開」(bnui 進入副本地圖 / 入口 / 布陣畫面)
// 就立刻關掉戰鬥層(bnUiLeave),回到本頁並重畫。戰鬥層開著時 ld_nav 不搶 Esc / 返回鍵。
// 依賴:ld_nav.js ld_art.js bnui.js bnteam.js bn_units.js codex.js(cxRecommend);cards.js(cardsUseBlock)、fame.js、bn_text.js 可缺。ES2017;不用 ?. ??。
// 全域:LDTEAM ldTeamPlan ldTeamSortList ldTeamRender ldTeamGo ldTeamWatchTick ldTeamRecommend
var LDTEAM = { rowTxt: ['前鋒', '中衛', '主將'], posKey: ['pos_van', 'pos_mid', 'pos_camp'], posPh: ['矛', '盾', '旗'], grTxt: ['白', '青', '藍', '紫', '金'], pollMs: 120, timer: 0, st: null, sorts: ['pw', 'gr'], sortTxt: { pw: '戰力', gr: '品階' } };

function ldTeamEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function ldTeamToast(m) {
  if (typeof bnUiToast === 'function') bnUiToast(m);
  else if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } }
}
function ldTeamEntry(id) { return (typeof bnUiEntry === 'function') ? bnUiEntry(id) : null; }
function ldTeamTroopOf(e, slot) { return (slot && slot.troop) || ((typeof bnDefaultTroop === 'function') ? bnDefaultTroop(e) : '槍'); }
function ldTeamFigOf(id) { var e = ldTeamEntry(id); return (e && e.fig) || ''; }
// 卡片占用原因('' = 可上陣):外勤 / 委任 / 駐派中不可上陣(cardsUseBlock 鍵是 'team')
function ldTeamBlockOf(id) {
  var e = ldTeamEntry(id), b;
  if (!e || typeof cardsUseBlock !== 'function') return '';
  b = cardsUseBlock(e, 'team');
  return b.ok ? '' : String(b.reason || '使用中');
}
// 素材元素轉成 HTML 字串:has:false → 純 CSS 佔位(單一漢字徽章,不發請求);has:true → ldArt 元素
function ldTeamArt(key, cls, ph) {
  var el;
  if (typeof ldArtHas === 'function' && ldArtHas(key) && typeof ldArt === 'function') { el = ldArt(key, cls); if (el && el.outerHTML) return el.outerHTML; }
  return '<span class="ld-ph ' + (cls || '') + '" data-art="' + key + '">' + ldTeamEsc(ph || (typeof ldArtPh === 'function' ? ldArtPh(key) : '')) + '</span>';
}

// ───────── 純邏輯(可單測)─────────
// 放人規則。slots = [{id,row,col,troop}];selRow = 目前選中的格(-1 = 無);o = { fig(id), block(id) }。
// 回 { ok, slots(新陣列), row, msg }:已在隊中 / 占用中 / 同名 / 已滿(未選格)皆回 ok:false + msg。目標格有人 = 換掉他;沒選格 = 第一個空格,主將優先。
function ldTeamPlan(slots, id, selRow, o) {
  o = o || {};
  var cur = (slots || []).map(function (s) { return { id: s.id, row: s.row, col: 0, troop: s.troop || '' }; }), row = -1, i, occ = null, why, fg, order = [2, 1, 0], k;
  for (i = 0; i < cur.length; i++) if (cur[i].id === id) return { ok: false, slots: cur, row: -1, msg: '已在隊中' };
  why = typeof o.block === 'function' ? o.block(id) : '';
  if (why) return { ok: false, slots: cur, row: -1, msg: why + ',不能上陣' };
  if (selRow === 0 || selRow === 1 || selRow === 2) row = selRow;
  else for (k = 0; k < order.length; k++) { if (!cur.some(function (s) { return s.row === order[k]; })) { row = order[k]; break; } }
  if (row < 0) return { ok: false, slots: cur, row: -1, msg: '隊伍已滿,請先點選要換下的位置' };
  for (i = 0; i < cur.length; i++) if (cur[i].row === row) occ = cur[i];
  fg = typeof o.fig === 'function' ? o.fig(id) : '';
  if (fg && cur.some(function (s) { return s !== occ && o.fig(s.id) === fg; })) return { ok: false, slots: cur, row: row, msg: '同名名人不可同隊' };
  if (occ) cur.splice(cur.indexOf(occ), 1);
  cur.push({ id: id, row: row, col: 0, troop: '' });
  return { ok: true, slots: cur, row: row, msg: '' };
}
// 排序:'pw' = 戰力高→低;'gr' = 品階高→低、同品階戰力高→低。list = [{e, pw, ...}];回新陣列
function ldTeamSortList(list, sort) {
  return list.slice().sort(function (a, b) {
    if (sort === 'gr' && (b.e.gr | 0) !== (a.e.gr | 0)) return (b.e.gr | 0) - (a.e.gr | 0);
    return b.pw - a.pw;
  });
}

// ───────── 狀態 ─────────
function ldTeamSlotsFromPreset(n) {
  var p = (typeof bnTeamPresetGet === 'function') ? bnTeamPresetGet(n) : null, out = [];
  if (!p || p.empty) return out;
  p.slots.forEach(function (s) { if (ldTeamEntry(s.id) && (s.row === 0 || s.row === 1 || s.row === 2)) out.push({ id: s.id, row: s.row, col: 0, troop: s.troop || '' }); });
  return out;
}
function ldTeamState(ctx) {
  var st = ctx.__t, n = ctx.n | 0 || 1, mode = ctx.mode === 'battle' ? 'battle' : 'edit';
  if (!st || st.n !== n || st.mode !== mode || st.stg !== ctx.stg) {
    st = { n: n, mode: mode, stg: ctx.stg, slots: ldTeamSlotsFromPreset(n), sel: -1, sort: 'pw', troop: '', fac: '', total: 0, pw: {}, el: null, ctx: ctx, started: false };
    ctx.__t = st;
  }
  st.ctx = ctx; st.pw = {};
  LDTEAM.st = st;
  return st;
}
function ldTeamSave(st) { if (typeof bnTeamPresetSet === 'function') bnTeamPresetSet(st.n, st.slots); }
function ldTeamPower(st, e, tr, row) {
  var k = e.id + '|' + tr + '|' + (row === undefined ? '' : row), sp;
  if (st.pw[k] === undefined) {
    try { sp = bnUnitSpec(e, { troop: tr, row: row !== undefined ? row : bnRowOf(e, tr), col: 0 }); st.pw[k] = bnPower(sp); } catch (er) { st.pw[k] = 0; }
  }
  return st.pw[k];
}
function ldTeamFacName(f) {
  if (typeof cxFacName === 'function') { try { return cxFacName(f); } catch (e) { /* 略過 */ } }
  return (typeof CARD_FAC !== 'undefined' && CARD_FAC[f]) || ('陣營' + f);
}
function ldTeamFacList() {
  var seen = {}, out = [];
  (typeof bnUiRosterList === 'function' ? bnUiRosterList() : []).forEach(function (e) { if (e.fac !== undefined && !seen[e.fac]) { seen[e.fac] = 1; out.push(String(e.fac)); } });
  return out.sort(function (a, b) { return a - b; });
}
function ldTeamRoster(st) {
  var list = (typeof bnUiRosterList === 'function' ? bnUiRosterList() : []).map(function (e) { var t = ldTeamTroopOf(e, null); return { e: e, t: t, pw: ldTeamPower(st, e, t) }; });
  list = list.filter(function (x) { return (!st.troop || x.t === st.troop) && (st.fac === '' || String(x.e.fac) === st.fac); });
  return ldTeamSortList(list, st.sort);
}
// 隊伍統計:戰力合計、羈絆成立數、兵種相剋(對本場敵方:▲ = 我方克制人次、▼ = 被克制人次;無敵方資料 = null)
function ldTeamStats(st) {
  var specs = [], tot = 0, bonds = 0, up = 0, down = 0, foeT = null, team, foes;
  st.slots.forEach(function (s) {
    var e = ldTeamEntry(s.id), tr;
    if (!e) return;
    tr = ldTeamTroopOf(e, s);
    try { specs.push(bnUnitSpec(e, { troop: tr, row: s.row, col: 0 })); } catch (er) { /* 略過 */ }
  });
  specs.forEach(function (sp) { tot += bnPower(sp); });
  if (specs.length) { try { team = bnBuildTeam(specs); bonds = (team.bonds || []).length + (team.formation || []).length; } catch (er) { bonds = 0; } }
  if (specs.length && typeof bnPreyCounts === 'function') {
    try {
      foes = (st.stg && typeof st.stg.foes === 'function') ? st.stg.foes(specs) : (typeof bnUiFoes === 'function' ? bnUiFoes(specs) : null);
      foeT = foes && foes.specs ? foes.specs.map(function (x) { return x.troop; }) : null;
      if (foeT) specs.forEach(function (sp) { var c = bnPreyCounts(sp.troop, foeT); up += c.up; down += c.down; });
    } catch (er) { foeT = null; }
  }
  return { total: tot, bonds: bonds, up: up, down: down, prey: !!foeT, n: specs.length };
}

// ───────── 繪製 ─────────
function ldTeamPortrait(e) {
  var h = '';
  if (typeof fxSilHtml === 'function') { try { h = fxSilHtml(e) || ''; } catch (er) { h = ''; } }
  if (!h && typeof cuPortraitImg === 'function') { try { h = cuPortraitImg(e, true) || ''; } catch (er) { h = ''; } }
  return '<span class="ldt-pt">' + (h || '<b>' + ldTeamEsc(Array.from(String(e.name))[0] || '?') + '</b>') + '</span>';
}
function ldTeamAptOf(e, tr) { try { return bnAptOf(e).apt[tr] || 'C'; } catch (er) { return 'C'; } }
function ldTeamSlotHtml(st, row, last) {
  var s = null, e = null, tr = '', i, h, sel = st.sel === row, blk = '';
  for (i = 0; i < st.slots.length; i++) if (st.slots[i].row === row) s = st.slots[i];
  if (s) e = ldTeamEntry(s.id);
  h = '<div class="ldt-slot r' + row + (sel ? ' sel' : '') + '" data-row="' + row + '">';
  if (row === 2) h += '<span class="ldt-flag">' + ldTeamArt('pos_flag', 'ldt-ico', '帥') + '</span>';
  if (e) {
    tr = ldTeamTroopOf(e, s); blk = ldTeamBlockOf(e.id);
    h += '<button class="ldt-cell g' + (e.gr | 0) + (blk ? ' busy' : '') + '" data-ldt="cell" data-r="' + row + '" aria-label="' + ldTeamEsc(LDTEAM.rowTxt[row] + ' ' + e.name) + '">' + ldTeamPortrait(e) +
      '<span class="ldt-gr">' + (LDTEAM.grTxt[e.gr | 0] || '') + '</span><span class="ldt-tr' + (ldTeamAptOf(e, tr) === 'C' ? ' bad' : '') + '">' + ldTeamEsc(tr) + ldTeamAptOf(e, tr) + '</span>' +
      (blk ? '<span class="ldt-busy">' + ldTeamEsc(blk) + '</span>' : '') +
      '<span class="ldt-nm">' + ldTeamEsc(e.name) + '</span><span class="ldt-pw">戰力 ' + ldTeamPower(st, e, tr, row) + '</span></button>';
    if (sel) h += '<div class="ldt-sact">' + (last ? '' : '<button data-ldt="detail" data-id="' + ldTeamEsc(e.id) + '">詳情</button>') + '<button data-ldt="drop" data-id="' + ldTeamEsc(e.id) + '">下陣</button></div>';
  } else {
    h += '<button class="ldt-cell em" data-ldt="cell" data-r="' + row + '" aria-label="' + ldTeamEsc(LDTEAM.rowTxt[row]) + ' 空位"><span class="ldt-add">＋</span><span class="ldt-emt">空位</span></button>';
  }
  h += '<div class="ldt-pos">' + ldTeamArt(LDTEAM.posKey[row], 'ldt-ico', LDTEAM.posPh[row]) + '<span>' + LDTEAM.rowTxt[row] + '</span></div></div>';
  return h;
}
function ldTeamCardHtml(st, x) {
  var e = x.e, on = st.slots.some(function (s) { return s.id === e.id; }), blk = ldTeamBlockOf(e.id);
  return '<button class="ldt-card g' + (e.gr | 0) + (on ? ' on' : '') + (blk ? ' busy' : '') + '" data-ldt="card" data-id="' + ldTeamEsc(e.id) + '" aria-label="' + ldTeamEsc(e.name) + '">' + ldTeamPortrait(e) +
    '<span class="ldt-cn">' + ldTeamEsc(e.name) + '</span><span class="ldt-ct">' + ldTeamEsc(x.t) + ldTeamAptOf(e, x.t) + ' ' + x.pw + '</span>' +
    (on ? '<span class="ldt-tag">上陣</span>' : (blk ? '<span class="ldt-tag lk">' + ldTeamEsc(blk) + '</span>' : '')) + '</button>';
}
function ldTeamHtml(st) {
  var list = ldTeamRoster(st), last = !!st.ctx.last, sx = ldTeamStats(st), h, i, goTxt = st.mode === 'battle' ? '開始戰鬥' : '練兵出戰';
  st.total = sx.total;
  h = '<div class="ldt ldt-' + st.mode + '"><div class="ldt-slots">' + [0, 1, 2].map(function (r) { return ldTeamSlotHtml(st, r, last); }).join('') + '</div>' +
    '<div class="ldt-tools"><button data-ldt="sort">' + LDTEAM.sortTxt[st.sort] + ' ▾</button><button data-ldt="troop">兵種 ' + (st.troop || '全') + '</button><button data-ldt="fac">陣營 ' + (st.fac === '' ? '全' : ldTeamEsc(ldTeamFacName(+st.fac))) + '</button></div>' +
    '<div class="ldt-cards">' + (list.length ? list.map(function (x) { return ldTeamCardHtml(st, x); }).join('') : '<p class="ldt-none">沒有符合的武將</p>') + '</div>' +
    '<div class="ldt-acts"><button class="ldt-rec" data-ldt="rec">推薦戰隊</button><button class="ldt-go" data-ldt="go">' + goTxt + '</button></div>' +
    '<div class="ldt-info">戰力 <b>' + sx.total + '</b><i>·</i>羈絆 <b>' + sx.bonds + '</b><i>·</i>相剋 ' + (sx.prey ? '<em class="u">▲' + sx.up + '</em> <em class="d">▼' + sx.down + '</em>' : '<em>—</em>') + '</div></div>';
  return h;
}
// 重畫本頁內容(保留卡片列捲動位置)
function ldTeamRender(el, st) {
  var cards, sl = 0, st0 = 0;
  if (!el) return;
  cards = el.querySelector ? el.querySelector('.ldt-cards') : null;
  if (cards) { sl = cards.scrollLeft || 0; st0 = cards.scrollTop || 0; }
  el.innerHTML = ldTeamHtml(st);
  cards = el.querySelector ? el.querySelector('.ldt-cards') : null;
  if (cards) { cards.scrollLeft = sl; cards.scrollTop = st0; }
  ldTeamFillRes(st);
}
function ldTeamFillRes(st) {   // 右上資源(戰力)隨變動更新(不重畫整頁)
  var r = st.ctx && st.ctx.resEl, p;
  if (!r) return;
  r.innerHTML = '';
  if (typeof document === 'undefined') return;
  p = document.createElement('span'); p.className = 'ld-pill gold ldp-pill'; p.textContent = '戰力 ' + st.total;
  r.appendChild(p);
}

// ───────── 操作 ─────────
function ldTeamCommit(st) { st.sel = -1; ldTeamSave(st); ldTeamRender(st.el, st); }
function ldTeamCycle(arr, cur) { var i = arr.indexOf(cur); return arr[(i + 1) % arr.length]; }
function ldTeamRecommend(st) {
  var r, bz, keep, missing = '';
  if (typeof cxRecommend !== 'function') { ldTeamToast('推薦功能尚未載入'); return false; }
  r = cxRecommend();
  if (!r || !r.slots || !r.slots.length) { ldTeamToast((r && r.reasons && r.reasons[0]) || '卡包還沒有可上陣的人'); return false; }
  bz = (typeof bnUiTeamBusy === 'function') ? bnUiTeamBusy(r.slots) : { keep: r.slots, busy: [] };
  keep = bz.keep;
  if (!keep.length) { ldTeamToast('推薦的武將都在使用中'); return false; }
  st.slots = keep.map(function (s) { return { id: s.id, row: s.row, col: 0, troop: s.troop || '' }; });
  if (bz.busy.length) missing = ';' + bz.busy.join('、') + ' 使用中,已略過';
  ldTeamCommit(st);
  ldTeamToast((r.reasons && r.reasons[0] ? r.reasons[0] : '已套用推薦隊伍') + missing);
  return true;
}
function ldTeamCheckStart(st) {
  var i, e, why;
  if (!st.slots.length) return '請先放入至少 1 人';
  for (i = 0; i < st.slots.length; i++) {
    e = ldTeamEntry(st.slots[i].id);
    if (!e) return '有武將已不在卡包,請重新整隊';
    why = ldTeamBlockOf(e.id);
    if (why) return e.name + '(' + why + '),請先下陣';
  }
  return '';
}
// 開戰:存檔 → bnUiStartWith(slots, stg);回 true = 已開打
function ldTeamGo(st) {
  var msg = ldTeamCheckStart(st), base, stg, orig, ok;
  if (msg) { ldTeamToast(msg); return false; }
  ldTeamSave(st);
  base = (st.mode === 'battle' && st.stg) ? st.stg : { kind: 'practice' };
  orig = base.onEnd;
  stg = Object.assign({}, base, { onEnd: function (win, S) {
    st.started = true;
    if (typeof orig === 'function') orig(win, S);   // 呼叫端的結算(例:百層塔記錄);bnui 已包 try/catch
  } });
  if (typeof bnUiStartWith !== 'function') { ldTeamToast('戰鬥功能尚未載入'); return false; }
  ok = bnUiStartWith(st.slots.map(function (s) { var e = ldTeamEntry(s.id); return { id: s.id, row: s.row, col: 0, troop: ldTeamTroopOf(e, s) }; }), stg);
  if (!ok) { if (!(typeof bnUiActive === 'function' && bnUiActive())) ldTeamToast('現在無法出戰'); return false; }
  ldTeamWatchStart(st);
  return true;
}
// ───────── 等戰鬥層關閉 / 結算離開 → 回本頁重畫 ─────────
function ldTeamWatchStart(st) {
  ldTeamWatchStop();
  st.started = true;
  if (typeof setInterval === 'function') LDTEAM.timer = setInterval(ldTeamWatchTick, LDTEAM.pollMs);
}
function ldTeamWatchStop() { if (LDTEAM.timer && typeof clearInterval === 'function') clearInterval(LDTEAM.timer); LDTEAM.timer = 0; }
function ldTeamAfterBattle(st) {
  st.started = false;
  // 第 6 階段:有指定關卡(mode:'battle',例:百層塔)的戰鬥結束 → 退回呼叫它的頁面(塔頁 onShow 重畫並捲到新層);練兵(edit)留在整隊頁
  if (st.ctx && st.ctx.mode === 'battle' && typeof ldNavTop === 'function' && ldNavTop() === 'team' && ldNavDepth() > 1 && typeof ldNavBack === 'function') { ldNavBack(); return; }
  if (st.el && st.el.parentNode !== undefined && st.ctx && typeof ldNavRefresh === 'function') ldNavRefresh('team');
}
// 輪詢一次:結算畫面(res)按「離開」時 bnui 會切到 map / entry / form → 立刻關戰鬥層;使用者自己關掉戰鬥層(返回鍵)→ 直接重畫。回 true = 已收尾
function ldTeamWatchTick() {
  var st = LDTEAM.st, ph, skip;
  if (!st || !st.started) { ldTeamWatchStop(); return false; }
  if (typeof bnUiActive !== 'function' || !bnUiActive()) { ldTeamWatchStop(); ldTeamAfterBattle(st); return true; }
  ph = (typeof bnu !== 'undefined' && bnu) ? bnu.phase : '';
  if (ph === 'fight' || ph === 'res') return false;
  if (bnu.layer && bnu.layer.style) bnu.layer.style.visibility = 'hidden';
  skip = !!bnu.histOn;
  if (skip && typeof ldNavSkipPop === 'function') ldNavSkipPop(300);   // bnUiLeave 會 history.back():讓 ld_nav 的 popstate 略過這一次(帶逾時,不會殘留吞掉之後的返回鍵)
  if (typeof bnUiLeave === 'function') bnUiLeave(true);
  ldTeamWatchStop();
  ldTeamAfterBattle(st);
  return true;
}

function ldTeamOnClick(ev) {
  var st = LDTEAM.st, t = ev && ev.target, b = t && t.closest ? t.closest('[data-ldt]') : null, a, id, r, i, p, ids;
  if (!st || !b) return;
  a = b.getAttribute('data-ldt'); id = b.getAttribute('data-id'); r = +b.getAttribute('data-r');
  if (a === 'cell') { st.sel = (st.sel === r) ? -1 : r; ldTeamRender(st.el, st); }
  else if (a === 'card') {
    p = ldTeamPlan(st.slots, id, st.sel, { fig: ldTeamFigOf, block: ldTeamBlockOf });
    if (!p.ok) { ldTeamToast(p.msg); return; }
    st.slots = p.slots; ldTeamCommit(st);
  } else if (a === 'drop') {
    st.slots = st.slots.filter(function (s) { return s.id !== id; });
    ldTeamCommit(st);
  } else if (a === 'detail') {
    ids = st.slots.slice().sort(function (x, y) { return y.row - x.row; }).map(function (s) { return s.id; });
    if (typeof ldNavPush === 'function') ldNavPush('hero', { id: id, list: ids });
  } else if (a === 'sort') { st.sort = ldTeamCycle(LDTEAM.sorts, st.sort); ldTeamRender(st.el, st); }
  else if (a === 'troop') { st.troop = ldTeamCycle([''].concat((typeof BN_DATA !== 'undefined' && BN_DATA.troopList) || []), st.troop); ldTeamRender(st.el, st); }
  else if (a === 'fac') { st.fac = ldTeamCycle([''].concat(ldTeamFacList()), st.fac); ldTeamRender(st.el, st); }
  else if (a === 'rec') ldTeamRecommend(st);
  else if (a === 'go') ldTeamGo(st);
}

ldNavRegister({
  id: 'team', title: '隊伍',
  bg: function () { return (typeof window !== 'undefined' && window.innerWidth > window.innerHeight) ? 'bg_team_land' : 'bg_team_port'; },
  build: function (el, ctx) {
    var st, n = ctx.n | 0 || 1, cap = (typeof bnTeamN === 'function') ? bnTeamN() : 3, lock;
    if (ctx.titleEl) ctx.titleEl.textContent = ctx.title || ('隊伍 ' + n);
    if (n > cap || n < 1) {
      lock = (typeof fameTeamLockText === 'function') ? fameTeamLockText(n) : '';
      el.innerHTML = '<p class="ldp-empty">這一隊尚未開放' + (lock ? '(' + ldTeamEsc(lock) + ')' : '') + '</p>';
      LDTEAM.st = null;
      return;
    }
    st = ldTeamState(ctx);
    st.el = el;
    if (!el.__ldtBound) { el.__ldtBound = 1; el.addEventListener('click', ldTeamOnClick); }
    ldTeamRender(el, st);
  },
  onShow: function (el, ctx) { if (ctx.__t) { LDTEAM.st = ctx.__t; ctx.__t.el = el; } },
  onHide: function (el, ctx) { ldTeamWatchStop(); if (LDTEAM.st && LDTEAM.st === ctx.__t) LDTEAM.st = null; }
});
