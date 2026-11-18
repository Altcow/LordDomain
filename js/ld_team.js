// js/ld_team.js — 新介面骨架:整隊頁(設計_介面骨架實作計畫.md §3-6、任務卡 3)。前綴 ldTeam / LDTEAM。登錄頁 id 'team'。
// ctx = { n:隊伍序號(1~), mode:'edit'|'battle', stg:戰鬥設定(battle 時帶入 bnUiStartWith), title }。mode:'battle' 金鈕「開始戰鬥」,'edit' 金鈕「訓練場」(stg = 練兵)。
// 站位:前鋒 row 0、中衛 row 1、主將 row 2(主將);每次變更立即存回第 n 隊預設(bnTeamPresetSet)。卡片來源 = 武將名冊(bnUiRosterList)。
// 開戰:存檔 → bnUiStartWith(slots, stg)。bnui 的 stg.onEnd 在「開打當下」就會呼叫(引擎先算到底再播戲台),所以本頁自己輪詢:結算畫面按「離開」(bnui 進入副本地圖 / 入口 / 布陣畫面)
// 就立刻關掉戰鬥層(bnUiLeave),回到本頁並重畫。戰鬥層開著時 ld_nav 不搶 Esc / 返回鍵。
// 依賴:ld_nav.js ld_art.js bnui.js bnteam.js bn_units.js codex.js(cxRecommend);cards.js(cardsUseBlock)、fame.js、bn_text.js 可缺。ES2017;不用 ?. ??。
// 隊伍列:頂端列出所有已開放隊伍的名稱(點選切換布置)。拖曳換位(Pointer Events,不用 HTML5 DnD):卡片列的卡 → 站位 / 隊伍名稱(放進該隊);站位的人 → 另一格(同隊互換)/ 另一隊的格(跨隊互換或移過去)/ 隊伍名稱(移到該隊)/ 卡片列(下陣)。
// 滑鼠 / 觸控站位直接拖;觸控卡片列長按 150ms 起拖(避免與捲動衝突);拖到隊伍名稱停 450ms 會自動切過去。備案:點站位選中 →「移動」→ 點目標格(可先切隊)。存檔仍是 bnTeamPresetSet(格式不變)。
// 2026-11-15:布陣建議行 / 每格「打得到」小字 / 「布陣要訣」頁(js/ld_team_tips.js);統御 cost 一隊上限(js/bn_cost_data.js);同一武將(名人同名、不論幾張卡)全部隊伍只能出現在一隊,路人卡以卡 id 為準。
// 2026-11-15 R6:「推薦戰隊」後出現「推薦戰法」橫列(cxRecommend({withSkills:true}) 的 r.skills;skill_rec.js),按「套用戰法」才裝(skrApply 整隊);缺的戰法標「拆〇〇卡可得」,戰法名可點開戰法詳情(ld_skilldex.js)。
// 2026-11-15 代表隊伍:ctx.n = 0 = 代表隊伍(bnteam.js bnRepGet / bnRepSet,獨立存檔鍵,與 5 隊分開;可與其他隊重複用同一武將、不參與跨隊去重);隊伍名稱列最右邊「代表」小分頁,頁內一行小字「擂台與活動用」;不能與其他隊互換 / 拖曳。
// 2026-11-15 提示:放人 / 換位被擋(統御超限、同武將重複上場、同名、占用)一律經 ldTeamToast → showToast(msg, LDTEAM.toastMs) 自動消失(不用按鈕)。
// 全域:LDTEAM ldTeamPlan ldTeamSortList ldTeamRender ldTeamGo ldTeamWatchTick ldTeamRecommend ldTeamSwapPlan ldTeamCrossPlan ldTeamDropPlan ldTeamDoDrop ldTeamSwitch
var LDTEAM = { rowTxt: ['前鋒', '中衛', '主將'], posKey: ['pos_van', 'pos_mid', 'pos_camp'], posPh: ['矛', '盾', '旗'], grTxt: ['白', '青', '藍', '紫', '金'], pollMs: 120, toastMs: 2600, timer: 0, st: null, sorts: ['pw', 'gr'], sortTxt: { pw: '戰力', gr: '品階' }, holdMs: 150, eps: 6, springMs: 450, clickGuardMs: 350, hitFn: null, drag: null, noClickUntil: 0 };

function ldTeamEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
// 自動消失的提示(showToast 的第二參數 = 顯示毫秒;沒給時預設 2 秒)。魔幻世界用語替換同 bnUiToast
function ldTeamToast(m) {
  var t = m;
  if (typeof fxText === 'function') { try { t = fxText(m); } catch (e0) { t = m; } }
  if (typeof showToast === 'function') { try { showToast(t, LDTEAM.toastMs); } catch (e) { /* 略過 */ } }
  else if (typeof bnUiToast === 'function') bnUiToast(m);
}
function ldTeamEntry(id) { return (typeof bnUiEntry === 'function') ? bnUiEntry(id) : null; }
function ldTeamTroopOf(e, slot) { return (slot && slot.troop) || ((typeof bnDefaultTroop === 'function') ? bnDefaultTroop(e) : '槍'); }
function ldTeamFigOf(id) { var e = ldTeamEntry(id); return (e && e.fig) || ''; }
// 統御(cost):bnCostOf / BN_COST_CFG 缺時視為不限
function ldTeamCostOf(id) { return (typeof bnCostOf === 'function') ? bnCostOf(ldTeamEntry(id)) : 0; }
function ldTeamCap() { return (typeof BN_COST_CFG !== 'undefined' && BN_COST_CFG.cap > 0) ? BN_COST_CFG.cap : 0; }
function ldTeamCostSum(slots, f) { var t = 0; (slots || []).forEach(function (s) { t += (f || ldTeamCostOf)(s.id); }); return t; }
// 同一武將鍵:名人 = fig(同名多張算同一人);路人卡 = 卡 id
function ldTeamKeyOf(id) { var f = ldTeamFigOf(id); return f ? 'f:' + f : 'c:' + id; }
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
  var cur = (slots || []).map(function (s) { return { id: s.id, row: s.row, col: 0, troop: s.troop || '' }; }), row = -1, i, occ = null, why, fg, order = [2, 1, 0], k, oldT, newT;
  for (i = 0; i < cur.length; i++) if (cur[i].id === id) return { ok: false, slots: cur, row: -1, msg: '已在隊中' };
  why = typeof o.block === 'function' ? o.block(id) : '';
  if (why) return { ok: false, slots: cur, row: -1, msg: why + ',不能上陣' };
  if (selRow === 0 || selRow === 1 || selRow === 2) row = selRow;
  else for (k = 0; k < order.length; k++) { if (!cur.some(function (s) { return s.row === order[k]; })) { row = order[k]; break; } }
  if (row < 0) return { ok: false, slots: cur, row: -1, msg: '隊伍已滿,請先點選要換下的位置' };
  for (i = 0; i < cur.length; i++) if (cur[i].row === row) occ = cur[i];
  fg = typeof o.fig === 'function' ? o.fig(id) : '';
  if (fg && cur.some(function (s) { return s !== occ && o.fig(s.id) === fg; })) return { ok: false, slots: cur, row: row, msg: '同名名人不可同隊' };
  if (typeof o.other === 'function') { why = o.other(id); if (why) return { ok: false, slots: cur, row: row, msg: '「' + (typeof o.name === 'function' ? o.name(id) : id) + '」已經在' + why + ',同一武將只能在一隊' }; }
  if (typeof o.cost === 'function' && o.cap > 0) {   // 統御上限:超過且比原本更高才擋(舊存檔超限隊伍仍可調整成更低)
    oldT = 0; cur.forEach(function (s) { oldT += o.cost(s.id); });
    newT = oldT - (occ ? o.cost(occ.id) : 0) + o.cost(id);
    if (newT > o.cap && newT > oldT) return { ok: false, slots: cur, row: row, msg: '統御不足,無法' + (occ ? '替換' : '上陣') + ':統御超過上限 ' + o.cap + '(放入後會是 ' + newT + '),請換統御較低的人' };
  }
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
  var p = n === 0 ? ((typeof bnRepGet === 'function') ? bnRepGet() : null) : ((typeof bnTeamPresetGet === 'function') ? bnTeamPresetGet(n) : null), out = [];
  if (!p || p.empty) return out;
  p.slots.forEach(function (s) { if (ldTeamEntry(s.id) && (s.row === 0 || s.row === 1 || s.row === 2)) out.push({ id: s.id, row: s.row, col: 0, troop: s.troop || '' }); });
  return out;
}
function ldTeamState(ctx) {
  var st = ctx.__t, n = ctx.n === 0 ? 0 : (ctx.n | 0 || 1), mode = ctx.mode === 'battle' ? 'battle' : 'edit';
  if (!st || st.n !== n || st.mode !== mode || st.stg !== ctx.stg) {
    st = { n: n, mode: mode, stg: ctx.stg, slots: ldTeamSlotsFromPreset(n), sel: -1, sort: 'pw', troop: '', fac: '', total: 0, pw: {}, el: null, ctx: ctx, started: false };
    ctx.__t = st;
  }
  st.ctx = ctx; st.pw = {};
  LDTEAM.st = st;
  return st;
}
function ldTeamSave(st) {
  if (st.n === 0) { if (typeof bnRepSet === 'function') bnRepSet(st.slots); }
  else if (typeof bnTeamPresetSet === 'function') bnTeamPresetSet(st.n, st.slots);
}
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
// ───────── 補兵(2026-11-18):每位武將一條兵力拉條 + 可輸入的數字,按〔確認〕才扣預備兵;〔一鍵補兵〕補到滿(規則見 js/rsv_heal.js) ─────────
function ldTeamHealCtx(st) {
  var c = null, rows, reserve;
  if (st.n < 1 || st.mode !== 'edit' || typeof rsvHealRow !== 'function' || typeof rsvGet !== 'function') return null;
  try { c = typeof wmapGoUiCtx === 'function' ? wmapGoUiCtx() : ((typeof WDUI !== 'undefined' && WDUI.W && WDUI.cs) ? { W: WDUI.W, cs: WDUI.cs } : null); } catch (e) { c = null; }
  if (!c || !c.W || !c.cs) return null;
  rows = st.slots.slice().sort(function (a, b) { return b.row - a.row; }).map(function (s) { return rsvHealRow(c.W, c.cs, s.id); });
  try { if (typeof rsvSettle === 'function') rsvSettle(Date.now()); reserve = rsvGet().n; } catch (e2) { reserve = 0; }
  return { W: c.W, cs: c.cs, rows: rows, reserve: reserve };
}
function ldTeamHealRowOf(st, id) { var i, r = st.hc ? st.hc.rows : []; for (i = 0; i < r.length; i++) if (r[i].id === id) return r[i]; return null; }
function ldTeamHealHtml(st, id) {
  var row = ldTeamHealRowOf(st, id), v;
  if (!row) return '';
  v = st.heal && st.heal[id] !== undefined ? st.heal[id] : row.cur;
  return '<div class="ldt-heal' + (row.locked ? ' lk' : '') + '"><input type="number" class="ldt-hn" inputmode="numeric" data-heal-n="' + ldTeamEsc(id) + '" min="' + row.cur + '" max="' + row.full + '" value="' + v + '" aria-label="兵力"' + (row.locked ? ' disabled' : '') + '>' +
    '<input type="range" class="ldt-hr" data-heal-r="' + ldTeamEsc(id) + '" min="' + row.cur + '" max="' + row.full + '" step="10" value="' + v + '" aria-label="兵力拉條"' + (row.locked ? ' disabled' : '') + '></div>';
}
function ldTeamHealSync(st) {
  var el = st.el, left;
  if (!el || !el.querySelectorAll || !st.hc) return;
  (st.hc.rows || []).forEach(function (r) {
    var v = st.heal && st.heal[r.id] !== undefined ? st.heal[r.id] : r.cur, a = el.querySelector('[data-heal-n="' + r.id + '"]'), b = el.querySelector('[data-heal-r="' + r.id + '"]');
    if (a && String(a.value) !== String(v)) a.value = v;
    if (b && String(b.value) !== String(v)) b.value = v;
  });
  ldTeamFillRes(st);
}
function ldTeamHealInput(ev) {
  var st = LDTEAM.st, t = ev && ev.target, id, c;
  if (!st || !st.hc || !t || !t.getAttribute) return;
  id = t.getAttribute('data-heal-n') || t.getAttribute('data-heal-r');
  if (!id) return;
  if (ev.type === 'input' && t.getAttribute('data-heal-n')) return;   // 數字框打字中不動,離開 / 按 Enter(change)才夾
  st.heal = st.heal || {};
  c = rsvHealClamp(st.hc.rows, st.hc.reserve, st.heal, id, t.value);
  st.heal[id] = c.v;
  if (c.capped) ldTeamToast('預備兵不足,這位最多再補 ' + (c.v - ldTeamHealRowOf(st, id).cur));
  ldTeamHealSync(st);
}
function ldTeamHealDo(st, all) {
  var plan, r, now = Date.now(), adds;
  if (!st.hc) return false;
  if (all) { plan = rsvHealAllPlan(st.hc.rows, st.hc.reserve); adds = plan.adds; }
  else { adds = []; st.hc.rows.forEach(function (x) { var t = st.heal && st.heal[x.id] !== undefined ? st.heal[x.id] : x.cur; if (t > x.cur) adds.push({ id: x.id, add: t - x.cur }); }); }
  if (!adds.length) { ldTeamToast(all ? (st.hc.reserve <= 0 ? '預備兵是 0' : '已經滿兵') : '沒有要補的兵'); return false; }
  r = rsvHealApply(st.hc.W, st.hc.cs, adds, now);
  st.heal = {};
  ldTeamToast(r.n ? '補兵 ' + r.used + '(預備兵剩 ' + rsvGet().n + ')' : '補兵失敗');
  ldTeamRender(st.el, st);
  return r.n > 0;
}
function ldTeamSlotHtml(st, row, last) {
  var s = null, e = null, tr = '', i, h, sel = st.sel === row, blk = '';
  for (i = 0; i < st.slots.length; i++) if (st.slots[i].row === row) s = st.slots[i];
  if (s) e = ldTeamEntry(s.id);
  h = '<div class="ldt-slot r' + row + (sel ? ' sel' : '') + (st.flash && st.flash.n === st.n && st.flash.row === row ? ' land' : '') + (st.carry && st.carry.n === st.n && st.carry.row === row ? ' carry' : '') + (st.carry ? ' tgt' : '') + '" data-row="' + row + '" data-drop="slot">';
  if (row === 2) h += '<span class="ldt-flag">' + ldTeamArt('pos_flag', 'ldt-ico', '帥') + '</span>';
  if (e) {
    tr = ldTeamTroopOf(e, s); blk = ldTeamBlockOf(e.id);
    h += '<button class="ldt-cell g' + (e.gr | 0) + (blk ? ' busy' : '') + '" data-ldt="cell" data-r="' + row + '" aria-label="' + ldTeamEsc(LDTEAM.rowTxt[row] + ' ' + e.name) + '">' + ldTeamPortrait(e) +
      '<span class="ldt-gr">' + (LDTEAM.grTxt[e.gr | 0] || '') + '</span><span class="ldt-tr' + (ldTeamAptOf(e, tr) === 'C' ? ' bad' : '') + '">' + ldTeamEsc(tr) + ldTeamAptOf(e, tr) + '</span>' +
      (blk ? '<span class="ldt-busy">' + ldTeamEsc(blk) + '</span>' : '') +
      '<span class="ldt-nm">' + ldTeamEsc(e.name) + '</span><span class="ldt-pw">戰力 ' + ldTeamPower(st, e, tr, row) + '</span></button>';
    if (st.hc) h += ldTeamHealHtml(st, s.id);
    if (sel) h += '<div class="ldt-sact">' + (last ? '' : '<button data-ldt="detail" data-id="' + ldTeamEsc(e.id) + '">詳情</button>') + '<button data-ldt="move" data-r="' + row + '">' + (st.carry ? '取消' : '移動') + '</button><button data-ldt="drop" data-id="' + ldTeamEsc(e.id) + '">下陣</button></div>';
  } else {
    h += '<button class="ldt-cell em" data-ldt="cell" data-r="' + row + '" aria-label="' + ldTeamEsc(LDTEAM.rowTxt[row]) + ' 空位"><span class="ldt-add">＋</span><span class="ldt-emt">空位</span></button>';
  }
  if (e && typeof ldTipsReachText === 'function') h += '<div class="ldt-hit">打得到:' + ldTeamEsc(ldTipsReachText(tr, row)) + '</div>';
  h += '<div class="ldt-pos">' + ldTeamArt(LDTEAM.posKey[row], 'ldt-ico', LDTEAM.posPh[row]) + '<span>' + LDTEAM.rowTxt[row] + '</span></div></div>';
  return h;
}
function ldTeamCardHtml(st, x, um) {
  var e = x.e, on = st.slots.some(function (s) { return s.id === e.id; }), blk = ldTeamBlockOf(e.id), oth = (!on && um && um[ldTeamKeyOf(e.id)]) ? ldTeamName(um[ldTeamKeyOf(e.id)]) : '';
  if (oth) blk = blk || oth;   // 已在其他隊 = 灰掉並標隊名(拖曳 / 點選放入會被擋)
  return '<button class="ldt-card g' + (e.gr | 0) + (on ? ' on' : '') + (blk ? ' busy' : '') + '" data-ldt="card" data-id="' + ldTeamEsc(e.id) + '" aria-label="' + ldTeamEsc(e.name) + '">' + ldTeamPortrait(e) +
    '<span class="ldt-cn">' + ldTeamEsc(e.name) + '</span><span class="ldt-ct">' + ldTeamEsc(x.t) + ldTeamAptOf(e, x.t) + ' ' + x.pw + '</span>' +
    (on ? '<span class="ldt-tag">上陣</span>' : (blk ? '<span class="ldt-tag lk">' + ldTeamEsc(blk) + '</span>' : '')) + '</button>';
}
function ldTeamName(n) {
  var p;
  if (n === 0) return '代表隊伍';
  p = (typeof bnTeamPresetGet === 'function') ? bnTeamPresetGet(n) : null;
  return (p && p.name) || ('隊伍 ' + n);
}
// 隊伍名稱列:所有已開放的隊(<2 隊不畫)。每個鈕同時是拖曳的放置目標(data-drop="tab")
function ldTeamTabsHtml(st) {
  var cap = (typeof bnTeamN === 'function') ? bnTeamN() : 1, n, h = '', c;
  if (cap >= 2) for (n = 1; n <= cap; n++) {
    c = n === st.n ? st.slots.length : ldTeamSlotsFromPreset(n).length;
    h += '<button class="ldt-tab' + (n === st.n ? ' on' : '') + '" data-ldt="team" data-n="' + n + '" data-drop="tab" aria-label="' + ldTeamEsc(ldTeamName(n)) + ',' + c + ' 人"><span class="ldt-tn">' + ldTeamEsc(ldTeamName(n)) + '</span><span class="ldt-tc">' + c + '</span></button>';
  }
  if (typeof bnRepGet === 'function') {   // 最右邊:代表隊伍小分頁(不是拖曳放置目標,不與其他隊互換)
    c = st.n === 0 ? st.slots.length : ldTeamSlotsFromPreset(0).length;
    h += '<button class="ldt-tab rep' + (st.n === 0 ? ' on' : '') + '" data-ldt="team" data-n="0" aria-label="代表隊伍(擂台與活動用),' + c + ' 人"><span class="ldt-tn">代表</span><span class="ldt-tc">' + c + '</span></button>';
  }
  if (!h) return '';
  return '<div class="ldt-teams">' + h + '</div>';
}
// 即時建議:只算三格的兵種(用目前選的兵種)。回 {lv,color,code,text} 或 null(沒載入)
function ldTeamAdvice(st) {
  if (typeof ldTipsAdvice !== 'function') return null;
  return ldTipsAdvice(st.slots.map(function (s) { var e = ldTeamEntry(s.id); return { row: s.row, troop: e ? ldTeamTroopOf(e, s) : (s.troop || '') }; }));
}
function ldTeamTipsHtml() {
  var h = '<div class="ldt-tipsov" data-ldt="tipsclose"><div class="ldt-tipspg" data-ldt="tipsin"><button class="ldt-tipsx" data-ldt="tipsclose" aria-label="關閉">✕</button>';
  (typeof LDTIPS_PAGE !== 'undefined' ? LDTIPS_PAGE : []).forEach(function (b) {
    var t = ldTeamEsc(b.s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h += b.t === 'h' ? '<h4>' + t + '</h4>' : (b.t === 'li' ? '<p class="li">' + t + '</p>' : '<p>' + t + '</p>');
  });
  return h + '</div></div>';
}
function ldTeamHtml(st) {
  var list = ldTeamRoster(st), last = !!st.ctx.last, sx = ldTeamStats(st), h, i, carryE = st.carry ? ldTeamEntry(st.carry.id) : null, goTxt = st.mode === 'battle' ? '開始戰鬥' : '訓練場', um = ldTeamUsedMap(st, st.n), adv = ldTeamAdvice(st), cost = ldTeamCostSum(st.slots), cap = ldTeamCap();
  st.total = sx.total;
  st.hc = ldTeamHealCtx(st);
  if (st.hc && st.heal) { var hid = {}; st.hc.rows.forEach(function (x) { hid[x.id] = 1; }); Object.keys(st.heal).forEach(function (k) { if (!hid[k]) delete st.heal[k]; }); }
  h = '<div class="ldt ldt-' + st.mode + '">' + ldTeamTabsHtml(st) + '<div class="ldt-slots">' + [0, 1, 2].map(function (r) { return ldTeamSlotHtml(st, r, last); }).join('') + '</div>' +
    '<div class="ldt-tools"><button data-ldt="sort">' + LDTEAM.sortTxt[st.sort] + ' ▾</button><button data-ldt="troop">兵種 ' + (st.troop || '全') + '</button><button data-ldt="fac">陣營 ' + (st.fac === '' ? '全' : ldTeamEsc(ldTeamFacName(+st.fac))) + '</button>' + (typeof LDTIPS_PAGE !== 'undefined' ? '<button data-ldt="tips">布陣要訣</button>' : '') + '</div>' +
    '<div class="ldt-cards" data-drop="cards">' + (list.length ? list.map(function (x) { return ldTeamCardHtml(st, x, um); }).join('') : '<p class="ldt-none">沒有符合的武將</p>') + '</div>' +
    '<div class="ldt-acts"><button class="ldt-rec" data-ldt="rec">推薦戰隊</button>' + (st.hc ? '<button class="ldt-hb" data-ldt="heal-all">一鍵補兵</button><button class="ldt-hb ok" data-ldt="heal-ok">確認</button>' : '') + '<button class="ldt-go" data-ldt="go">' + goTxt + '</button></div>' +
    '<div class="ldt-ib">' + (st.n === 0 ? '<div class="ldt-rn">代表隊伍:擂台與活動用(可與其他隊重複用同一武將)</div>' : '') + (adv ? '<div class="ldt-tip ' + adv.color + '" data-code="' + adv.code + '">' + ldTeamEsc(adv.text) + '</div>' : '') + '<div class="ldt-info">' + (carryE ? '移動「' + ldTeamEsc(carryE.name) + '」:點目標位置(可先切到別隊)' : '戰力 <b>' + sx.total + '</b><i>·</i>羈絆 <b>' + sx.bonds + '</b><i>·</i>相剋 ' + (sx.prey ? '<em class="u">▲' + sx.up + '</em> <em class="d">▼' + sx.down + '</em>' : '<em>—</em>') + (cap ? '<i>·</i>統御 <b class="' + (cost > cap ? 'over' : '') + '">' + cost + '</b>/' + cap : '')) + '</div></div>' + (st.skr ? ldTeamSkrHtml(st) : '') + (st.tipsOpen ? ldTeamTipsHtml() : '') + '</div>';
  st.flash = null;
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
  if (LDTEAM.drag && LDTEAM.drag.on) ldTeamDragMark(el, st);
}
function ldTeamFillRes(st) {   // 右上資源(戰力)隨變動更新(不重畫整頁)
  var r = st.ctx && st.ctx.resEl, p;
  if (!r) return;
  r.innerHTML = '';
  if (typeof document === 'undefined') return;
  p = document.createElement('span'); p.className = 'ld-pill gold ldp-pill'; p.textContent = '戰力 ' + st.total;
  r.appendChild(p);
  if (st.hc) {   // 補兵:預備兵剩餘(扣掉目前拉條已選的量)
    p = document.createElement('span'); p.className = 'ld-pill gold ldp-pill'; p.textContent = '預備兵 ' + Math.max(0, st.hc.reserve - rsvHealUsed(st.hc.rows, st.heal || {}));
    r.appendChild(p);
  }
}

// ───────── 操作 ─────────
function ldTeamCommit(st) { st.sel = -1; st.skr = null; ldTeamSave(st); ldTeamRender(st.el, st); }
function ldTeamCycle(arr, cur) { var i = arr.indexOf(cur); return arr[(i + 1) % arr.length]; }
function ldTeamRecommend(st) {
  var r, bz, keep, missing = '', um;
  if (typeof cxRecommend !== 'function') { ldTeamToast('推薦功能尚未載入'); return false; }
  um = ldTeamUsedMap(st, st.n);
  r = cxRecommend({ skip: function (e) { return !!um[ldTeamKeyOf(e.id)]; }, cap: ldTeamCap() > 0 ? ldTeamCap() : undefined, withSkills: true });   // 已在其他隊的武將不推薦;統御不超過上限
  if (!r || !r.slots || !r.slots.length) { ldTeamToast((r && r.reasons && r.reasons[0]) || '武將還沒有可上陣的人'); return false; }
  bz = (typeof bnUiTeamBusy === 'function') ? bnUiTeamBusy(r.slots) : { keep: r.slots, busy: [] };
  keep = bz.keep;
  if (!keep.length) { ldTeamToast('推薦的武將都在使用中'); return false; }
  st.slots = keep.map(function (s) { return { id: s.id, row: s.row, col: 0, troop: s.troop || '' }; });
  if (bz.busy.length) missing = ';' + bz.busy.join('、') + ' 使用中,已略過';
  ldTeamCommit(st);
  if (r.skills && r.skills.ok) { st.skr = { eids: st.slots.map(function (s) { return s.id; }), plan0: r.skills }; if (!ldTeamSkrWorth(st)) st.skr = null; ldTeamRender(st.el, st); }   // 推薦戰法橫列:不自動裝,按「套用戰法」才裝
  ldTeamToast((r.reasons && r.reasons[0] ? r.reasons[0] : '已套用推薦隊伍') + missing + (st.skr ? ';下方有推薦戰法,按「套用戰法」才會裝' : ''));
  return true;
}
// ───────── 推薦戰法橫列(R6) ─────────
// 目前隊員的戰法分配(每次即時算,不看存下來的舊計畫):回 skrTeamPlan 結果或 null
function ldTeamSkrPlan(st) {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, es;
  if (!st || !st.skr || typeof skrTeamPlan !== 'function' || !cs) return null;
  es = st.skr.eids.map(ldTeamEntry).filter(function (e) { return !!e; });
  return es.length ? skrTeamPlan(cs, es) : null;
}
// 有東西可顯示(要裝的或缺的)才出橫列
function ldTeamSkrWorth(st) {
  var p = ldTeamSkrPlan(st);
  return !!(p && p.ok && p.per.some(function (x) { return x.changes.length || x.miss.length; }));
}
function ldTeamSkName(id) { return (typeof skrSkName === 'function') ? skrSkName(id) : String(id); }
function ldTeamSkrPill(cls, id, label) { return '<button class="ldt-skp ' + cls + '" data-ldt="skgo" data-id="' + ldTeamEsc(id) + '"><i></i><span>' + ldTeamEsc(label) + '</span></button>'; }
function ldTeamSkrHtml(st) {
  var p = ldTeamSkrPlan(st), h, can, miss = [], cols;
  if (!st.skr || !p || !p.ok || !p.per.length) return '';
  can = p.per.some(function (x) { return x.changes.length; });
  cols = p.per.map(function (x) {
    var mi = 0, pills = '', i, id, cls;
    for (i = 0; i < Math.max(x.n, 1); i++) {
      id = x.sel[i];
      if (id) {
        if (x.rec.indexOf(id) < 0) cls = 'keep';
        else if (x.cur.indexOf(id) >= 0) cls = 'on';
        else if (x.take.some(function (t) { return t.id === id; })) cls = 'take';
        else cls = 'ready';
        pills += ldTeamSkrPill(cls, id, ldTeamSkName(id));
      } else if (x.miss[mi]) { pills += ldTeamSkrPill('miss', x.miss[mi].id, '缺 ' + x.miss[mi].name); miss.push(x.miss[mi].name + ':' + ((x.miss[mi].src && x.miss[mi].src.text) || '目前無法取得')); mi++; }
      else pills += '<span class="ldt-skp none"><i></i><span>空槽</span></span>';
    }
    return '<div class="ldt-skr-p"><span class="ldt-skr-n">' + ldTeamEsc(x.name) + '</span>' + pills + '</div>';
  }).join('');
  h = '<div class="ldt-skr" data-ldt="skrbox"><div class="ldt-skr-h"><b>推薦戰法</b><i>' + ldTeamEsc(p.summary || '') + '</i></div><div class="ldt-skr-b"><div class="ldt-skr-cols">' + cols + '</div><div class="ldt-skr-btns">' +
    (can ? '<button class="ldt-skr-go" data-ldt="skapply">套用戰法</button>' : '') + '<button class="ldt-skr-no" data-ldt="skno">' + (can ? '先不用' : '收起') + '</button></div></div>';
  if (miss.length) h += '<div class="ldt-skr-m">缺 ' + miss.length + ' 個:' + ldTeamEsc(miss.join('、')) + '</div>';
  if (p.take && p.take.length) h += '<div class="ldt-skr-m">會從別人身上拿:' + ldTeamEsc(p.take.map(function (t) { return (t.fromName || '別人') + ' 的『' + ldTeamSkName(t.id) + '』'; }).join('、')) + '</div>';
  return h + '</div>';
}
// 套用戰法:skrApply 整隊(先檢查後寫,失敗不留半套)。回 true = 已套用
function ldTeamSkrApply(st) {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, p = ldTeamSkrPlan(st), r, msg, miss;
  if (!p || !p.ok || typeof skrApply !== 'function') { ldTeamToast('戰法推薦功能尚未載入'); return false; }
  r = skrApply(cs, p);
  if (!r.ok) { ldTeamToast('無法套用戰法:' + (r.reason === 'busy' ? '對方在隊伍或外勤中' : '請稍後再試')); return false; }
  if (typeof ldHeroSync === 'function') ldHeroSync(); else if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  msg = r.text || '戰法已套用';
  miss = p.miss.map(function (m) { return '缺『' + ldTeamSkName(m.id) + '』:' + ((m.src && m.src.text) || '目前無法取得'); });
  st.skr = null; ldTeamRender(st.el, st);
  ldTeamToast(msg + (miss.length ? ';' + miss.join(';') : ''));
  return true;
}

function ldTeamCheckStart(st) {
  var i, e, why;
  if (!st.slots.length) return '請先放入至少 1 人';
  for (i = 0; i < st.slots.length; i++) {
    e = ldTeamEntry(st.slots[i].id);
    if (!e) return '有武將已不在名冊,請重新整隊';
    why = ldTeamBlockOf(e.id);
    if (why) return e.name + '(' + why + '),請先下陣';
  }
  if (ldTeamCap() > 0 && ldTeamCostSum(st.slots) > ldTeamCap()) return '統御 ' + ldTeamCostSum(st.slots) + ' 超過上限 ' + ldTeamCap() + ',請換下統御較高的人';
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

// ───────── 換位 / 跨隊(純邏輯,可單測)─────────
function ldTeamCloneSlots(slots) { return (slots || []).map(function (s) { return { id: s.id, row: s.row, col: 0, troop: s.troop || '' }; }); }
function ldTeamAt(slots, row) { var i; for (i = 0; i < slots.length; i++) if (slots[i].row === row) return slots[i]; return null; }
function ldTeamNameOfId(id) { var e = ldTeamEntry(id); return e ? e.name : '?'; }
// 同隊:把 ra 格的人移到 rb 格(rb 有人 = 互換、沒人 = 移過去)。回 { ok, slots, msg, kind:'move'|'swap'|'same'|'' }
function ldTeamSwapPlan(slots, ra, rb) {
  var cur = ldTeamCloneSlots(slots), a = ldTeamAt(cur, ra), b = ldTeamAt(cur, rb);
  if (!a) return { ok: false, slots: cur, msg: '', kind: '' };
  if (ra === rb) return { ok: false, slots: cur, msg: '', kind: 'same' };
  a.row = rb;
  if (b) b.row = ra;
  return { ok: true, slots: cur, msg: '', kind: b ? 'swap' : 'move' };
}
// 跨隊:A 隊 ra 格的人 → B 隊 rb 格。B 格有人 = 兩人互換、沒人 = 移過去。o = { fig(id), name(id) }。
// 限制:不可已在目標隊、同名名人不可同隊(換出的人到 A 隊也要檢查)。回 { ok, a, b, msg, kind, x, y }
function ldTeamCrossPlan(sa, ra, sb, rb, o) {
  o = o || {};
  var A = ldTeamCloneSlots(sa), B = ldTeamCloneSlots(sb), x = ldTeamAt(A, ra), y = ldTeamAt(B, rb), fx, fy, sum, oa, ob, na, nb,
    nm = function (id) { return typeof o.name === 'function' ? o.name(id) : id; },
    bad = function (m) { return { ok: false, a: A, b: B, msg: m, kind: '', x: x ? x.id : '', y: y ? y.id : '' }; };
  if (!x) return bad('');
  if (B.some(function (s) { return s.id === x.id; })) return bad('「' + nm(x.id) + '」已在那一隊');
  fx = typeof o.fig === 'function' ? o.fig(x.id) : '';
  if (fx && B.some(function (s) { return s !== y && o.fig(s.id) === fx; })) return bad('那一隊已有同名名人,不可同隊');
  if (y) {
    if (A.some(function (s) { return s.id === y.id; })) return bad('「' + nm(y.id) + '」已在這一隊');
    fy = typeof o.fig === 'function' ? o.fig(y.id) : '';
    if (fy && A.some(function (s) { return s !== x && o.fig(s.id) === fy; })) return bad('這一隊已有「' + nm(y.id) + '」的同名名人,不可同隊');
  }
  if (typeof o.cost === 'function' && o.cap > 0) {   // 統御上限(兩邊都檢查;超過且變高才擋)
    sum = function (L) { var t = 0; L.forEach(function (s) { t += o.cost(s.id); }); return t; };
    oa = sum(A); ob = sum(B); na = oa - o.cost(x.id) + (y ? o.cost(y.id) : 0); nb = ob - (y ? o.cost(y.id) : 0) + o.cost(x.id);
    if (nb > o.cap && nb > ob) return bad('統御不足,無法替換:那一隊統御超過上限 ' + o.cap + '(會變 ' + nb + ')');
    if (na > o.cap && na > oa) return bad('統御不足,無法替換:這一隊統御超過上限 ' + o.cap + '(會變 ' + na + ')');
  }
  A.splice(A.indexOf(x), 1); if (y) B.splice(B.indexOf(y), 1);
  B.push({ id: x.id, row: rb, col: 0, troop: x.troop || '' });
  if (y) A.push({ id: y.id, row: ra, col: 0, troop: y.troop || '' });
  return { ok: true, a: A, b: B, msg: '', kind: y ? 'swap' : 'move', x: x.id, y: y ? y.id : '' };
}
// 拖到「隊伍名稱」時選格:同列有空位用同列,否則第一個空格(主將優先),都滿 = 同列互換
function ldTeamPickRow(slots, row) {
  var order = [row, 2, 1, 0], i;
  for (i = 0; i < order.length; i++) if (!ldTeamAt(slots, order[i])) return order[i];
  return row;
}
// 其他隊(不含第 n 隊)已用的武將:{鍵: 隊號}
function ldTeamUsedMap(st, n) {
  var cap = (typeof bnTeamN === 'function') ? bnTeamN() : 1, m, map = {};
  if (n === 0) return map;   // 代表隊伍:不受「同一武將只能在一隊」限制
  for (m = 1; m <= cap; m++) if (m !== n) ldTeamSlotsOf(st, m).forEach(function (s) { var k = ldTeamKeyOf(s.id); if (!map[k]) map[k] = m; });
  return map;
}
function ldTeamOtherLabel(st, id, n, map) { var m = (map || ldTeamUsedMap(st, n))[ldTeamKeyOf(id)]; return m ? ldTeamName(m) : ''; }
function ldTeamSlotsOf(st, n) { return n === st.n ? ldTeamCloneSlots(st.slots) : ldTeamSlotsFromPreset(n); }
// 一次放開的完整計畫(不寫檔)。src = {k:'slot', n, row} | {k:'card', id};dst = {k:'slot', n, row} | {k:'team', n} | {k:'cards'}。
// 回 { ok, msg, writes:[{n, slots}], land:{n,row}|null, note, kind }(ok:false 的 msg 可為空 = 無動作、不提示)
function ldTeamDropPlan(st, src, dst) {
  var o = { fig: ldTeamFigOf, block: ldTeamBlockOf, name: ldTeamNameOfId, cost: ldTeamCostOf, cap: ldTeamCap() }, no = function (m) { return { ok: false, msg: m || '', writes: [], land: null, note: '', kind: '' }; }, sa, sb, r, row, a, um;
  if (!src || !dst) return no('');
  if (src.k === 'card') {
    if (dst.k === 'cards') return no('');
    sb = ldTeamSlotsOf(st, dst.n); row = dst.k === 'slot' ? dst.row : -1;
    um = ldTeamUsedMap(st, dst.n);
    r = ldTeamPlan(sb, src.id, row, Object.assign({}, o, { other: function (id) { return ldTeamOtherLabel(st, id, dst.n, um); } }));
    if (!r.ok) return no(dst.k === 'team' && /已滿/.test(r.msg) ? '那一隊已滿,請直接拖到要換下的位置' : r.msg);
    return { ok: true, msg: '', writes: [{ n: dst.n, slots: r.slots }], land: { n: dst.n, row: r.row }, note: dst.n === st.n ? '' : '「' + ldTeamNameOfId(src.id) + '」已加入「' + ldTeamName(dst.n) + '」', kind: 'add' };
  }
  if ((src.n === 0 || dst.n === 0) && src.n !== dst.n && dst.k !== 'cards') return no('代表隊伍是獨立的一隊,不能與其他隊互換');
  sa = ldTeamSlotsOf(st, src.n); a = ldTeamAt(sa, src.row);
  if (!a) return no('');
  if (dst.k === 'cards') return { ok: true, msg: '', writes: [{ n: src.n, slots: sa.filter(function (s) { return s.row !== src.row; }) }], land: null, note: '', kind: 'drop' };
  if (dst.n === src.n) {
    if (dst.k === 'team') return no('');
    r = ldTeamSwapPlan(sa, src.row, dst.row);
    if (!r.ok) return no(r.msg);
    return { ok: true, msg: '', writes: [{ n: src.n, slots: r.slots }], land: { n: src.n, row: dst.row }, note: '', kind: r.kind };
  }
  sb = ldTeamSlotsOf(st, dst.n);
  row = dst.k === 'slot' ? dst.row : ldTeamPickRow(sb, src.row);
  r = ldTeamCrossPlan(sa, src.row, sb, row, o);
  if (!r.ok) return no(r.msg);
  return { ok: true, msg: '', writes: [{ n: src.n, slots: r.a }, { n: dst.n, slots: r.b }], land: { n: dst.n, row: row },
    note: r.kind === 'swap' ? '「' + ldTeamNameOfId(r.x) + '」與「' + ldTeamNameOfId(r.y) + '」已互換隊伍' : '「' + ldTeamNameOfId(r.x) + '」已移到「' + ldTeamName(dst.n) + '」', kind: 'cross-' + r.kind };
}
// 寫入計畫(每隊一次 bnTeamPresetSet;任一隊寫失敗 → 全部還原)。回 true/false
function ldTeamApplyPlan(st, plan) {
  var olds = [], i, w, ok = true, prev;
  if (plan.writes.length && plan.writes.every(function (x) { return x.n === 0; })) {   // 代表隊伍:獨立存檔
    prev = ldTeamCloneSlots(st.slots);
    st.slots = ldTeamCloneSlots(plan.writes[0].slots);
    ok = (typeof bnRepSet !== 'function') || bnRepSet(st.slots) !== false;
    if (!ok) st.slots = prev;
    return ok;
  }
  if (typeof bnTeamPresetSetMany === 'function') {   // 一次驗證「寫完後同一武將沒有出現在兩隊」再寫入(跨隊互換不會中途衝突)
    prev = ldTeamCloneSlots(st.slots);
    plan.writes.forEach(function (x) { if (x.n === st.n) st.slots = ldTeamCloneSlots(x.slots); });
    ok = bnTeamPresetSetMany(plan.writes) !== false;
    if (!ok) st.slots = prev;
    return ok;
  }
  for (i = 0; i < plan.writes.length && ok; i++) {
    w = plan.writes[i];
    olds.push({ n: w.n, slots: ldTeamSlotsOf(st, w.n) });
    if (w.n === st.n) st.slots = ldTeamCloneSlots(w.slots);
    ok = (typeof bnTeamPresetSet !== 'function') || bnTeamPresetSet(w.n, w.slots) !== false;
  }
  if (!ok) {
    olds.forEach(function (o) { if (o.n === st.n) st.slots = ldTeamCloneSlots(o.slots); if (typeof bnTeamPresetSet === 'function') bnTeamPresetSet(o.n, o.slots); });
    return false;
  }
  return true;
}
// 放開 / 點擊目標的共同出口:計畫 → 寫檔 → 提示 → 重畫。回計畫結果
function ldTeamDoDrop(st, src, dst) {
  var plan = ldTeamDropPlan(st, src, dst);
  if (!plan.ok) { if (plan.msg) ldTeamToast(plan.msg); return plan; }
  if (!ldTeamApplyPlan(st, plan)) { plan.ok = false; plan.msg = '存檔失敗,已還原'; ldTeamToast(plan.msg); return plan; }
  st.sel = -1; st.carry = null; st.skr = null; st.flash = plan.land;
  if (plan.note) ldTeamToast(plan.note);
  ldTeamRender(st.el, st);
  return plan;
}
// 切到第 n 隊(同一頁內換隊;保留排序 / 篩選 / 移動中的人)。回新狀態
function ldTeamSwitch(n) {
  if (LDTEAM.st) LDTEAM.st.heal = {};
  var st = LDTEAM.st, ctx, el, nst, cap;
  if (!st) return null;
  n = n | 0; cap = (typeof bnTeamN === 'function') ? bnTeamN() : 1;
  if (n === st.n || n < 0 || n > cap) return st;
  ctx = st.ctx; el = st.el; ctx.n = n; ctx.__t = null;
  nst = ldTeamState(ctx);
  nst.el = el; nst.sort = st.sort; nst.troop = st.troop; nst.fac = st.fac; nst.carry = st.carry; nst.started = st.started;
  if (ctx.titleEl && !ctx.title) ctx.titleEl.textContent = n === 0 ? '代表隊伍' : '隊伍 ' + n;
  ldTeamRender(el, nst);
  return nst;
}

// ───────── 拖曳控制(Pointer Events)─────────
// 來源:站位的人(touch-action:none,移動 6px 即起拖)或卡片列的卡(滑鼠移動 6px 起拖;觸控長按 150ms 起拖,未到時間就移動 = 捲動、放棄)
function ldTeamSrcOf(t) {
  var c = t && t.closest ? t.closest('.ldt-cell, .ldt-card') : null, st = LDTEAM.st, cl;
  if (!c || !st) return null;
  cl = c.classList;
  if (cl.contains('ldt-card')) return cl.contains('on') ? null : { k: 'card', id: c.getAttribute('data-id'), el: c };
  if (cl.contains('em')) return null;
  return { k: 'slot', n: st.n, row: +c.getAttribute('data-r'), el: c };
}
function ldTeamDstOf(el, st) {
  var c = el && el.closest ? el.closest('[data-drop]') : null, k;
  if (!c) return null;
  k = c.getAttribute('data-drop');
  if (k === 'slot') return { k: 'slot', n: st.n, row: +c.getAttribute('data-row'), el: c };
  if (k === 'tab') return { k: 'team', n: +c.getAttribute('data-n'), el: c };
  if (k === 'cards') return { k: 'cards', el: c };
  return null;
}
function ldTeamHitAt(x, y) {
  if (typeof LDTEAM.hitFn === 'function') return LDTEAM.hitFn(x, y);
  return (typeof document !== 'undefined' && document.elementFromPoint) ? document.elementFromPoint(x, y) : null;
}
function ldTeamHasDom() { return typeof document !== 'undefined' && !!document.body && !!document.body.appendChild && !!document.createElement; }
function ldTeamDragMark(el, st) {   // 重畫後把拖曳來源標回去(來源隊 = 目前顯示的隊才有)
  var d = LDTEAM.drag, q = null;
  if (!d || !d.on || !el || !el.querySelector) return;
  if (d.src.k === 'slot' && d.src.n === st.n) q = el.querySelector('.ldt-cell[data-r="' + d.src.row + '"]');
  else if (d.src.k === 'card') q = el.querySelector('.ldt-card[data-id="' + d.src.id + '"]');
  if (q) q.classList.add('ldt-dragsrc');
}
function ldTeamGhostMake(d) {
  var s = d.src.el, r, g;
  if (!s || !s.cloneNode || !s.getBoundingClientRect || !ldTeamHasDom()) return;
  r = s.getBoundingClientRect(); g = s.cloneNode(true);
  g.className = (g.className || '') + ' ldt-ghost'; g.removeAttribute('data-ldt'); g.removeAttribute('data-drop'); g.setAttribute('aria-hidden', 'true'); g.tabIndex = -1;
  g.classList.remove('ldt-dragsrc'); g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
  d.gx = d.x0 - r.left; d.gy = d.y0 - r.top; d.rect = r; d.ghost = g;
  g.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px) scale(1.06)';
  document.body.appendChild(g);
}
function ldTeamGhostMove(d) { if (d.ghost) d.ghost.style.transform = 'translate(' + (d.x - d.gx) + 'px,' + (d.y - d.gy) + 'px) scale(1.06)'; }
function ldTeamGhostEnd(d, rect, ok) {   // ok:飛到落點縮小淡出;否則彈回原位。之後移除
  var g = d.ghost;
  if (!g) return;
  d.ghost = null;
  if (typeof setTimeout !== 'function' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) { if (g.parentNode) g.parentNode.removeChild(g); return; }
  g.classList.add('fly');
  if (ok && rect) { g.style.transform = 'translate(' + rect.left + 'px,' + rect.top + 'px) scale(.9)'; g.style.opacity = '0'; }
  else if (d.rect) { g.style.transform = 'translate(' + d.rect.left + 'px,' + d.rect.top + 'px) scale(1)'; g.style.opacity = '.5'; }
  setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 220);
}
function ldTeamOverSet(d, dst, ok) {   // 放置格高亮(over = 可放、bad = 不可);換目標時清舊的
  var el = dst && dst.el;
  if (d.overEl && d.overEl !== el && d.overEl.classList) { d.overEl.classList.remove('over'); d.overEl.classList.remove('bad'); }
  d.overEl = el || null;
  if (el && el.classList) { el.classList.add(ok ? 'over' : 'bad'); el.classList.remove(ok ? 'bad' : 'over'); }
}
function ldTeamSpringClear(d) { if (d.spring) { if (typeof clearTimeout === 'function') clearTimeout(d.spring); d.spring = 0; } d.springN = 0; }
function ldTeamDragBegin(d) {
  d.on = true;
  if (d.holdT && typeof clearTimeout === 'function') { clearTimeout(d.holdT); d.holdT = 0; }
  if (d.src.el && d.src.el.classList) d.src.el.classList.add('ldt-dragsrc');
  ldTeamGhostMake(d);
  if (typeof document !== 'undefined' && document.body && document.body.classList) document.body.classList.add('ldt-dragging');
  if (d.touch && typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* 略過 */ } }
}
// 目前指標下的目標;更新高亮與「停在隊伍名稱上自動切隊」。回 dst
function ldTeamDragHover(d) {
  var st = LDTEAM.st, dst, ok = false, plan;
  if (!st) return null;
  dst = ldTeamDstOf(ldTeamHitAt(d.x, d.y), st);
  d.dst = dst;
  if (dst) {
    if (d.src.k === 'slot' && dst.k === 'slot' && dst.n === d.src.n && dst.row === d.src.row) ok = null;
    else if (d.src.k === 'slot' && dst.k === 'team' && dst.n === d.src.n) ok = null;
    else { plan = ldTeamDropPlan(st, d.src, dst); ok = plan.ok; }
  }
  ldTeamOverSet(d, ok === null ? null : dst, !!ok);
  if (dst && dst.k === 'team' && dst.n !== st.n) {
    if (d.springN !== dst.n) {
      ldTeamSpringClear(d); d.springN = dst.n;
      if (typeof setTimeout === 'function') d.spring = setTimeout(function () { d.spring = 0; ldTeamSpringFire(d); }, LDTEAM.springMs);
    }
  } else ldTeamSpringClear(d);
  return dst;
}
function ldTeamSpringFire(d) {   // 停在別隊的名稱上夠久 → 切過去(拖曳中的人留在手上,可直接放進那隊的格)
  var n = d.springN, nst;
  d.springN = 0;
  if (!LDTEAM.drag || LDTEAM.drag !== d || !n) return false;
  nst = ldTeamSwitch(n);
  d.overEl = null;
  if (nst && nst.n === n) { ldTeamDragHover(d); return true; }
  return false;
}
function ldTeamDragCleanup(d, ok, landRect) {
  var i, ls = d.ls;
  ldTeamSpringClear(d);
  if (d.holdT && typeof clearTimeout === 'function') clearTimeout(d.holdT);
  if (d.overEl && d.overEl.classList) { d.overEl.classList.remove('over'); d.overEl.classList.remove('bad'); }
  if (d.src && d.src.el && d.src.el.classList) d.src.el.classList.remove('ldt-dragsrc');
  if (typeof document !== 'undefined') {
    if (document.removeEventListener && ls) for (i = 0; i < ls.length; i++) document.removeEventListener(ls[i][0], ls[i][1], ls[i][2]);
    if (document.body && document.body.classList) document.body.classList.remove('ldt-dragging');
  }
  if (d.ghost) ldTeamGhostEnd(d, landRect, ok);
  if (LDTEAM.drag === d) LDTEAM.drag = null;
}
function ldTeamPDown(ev) {
  var st = LDTEAM.st, src, d, touch;
  if (!st || LDTEAM.drag) return false;
  if (ev.pointerType === 'mouse' && ev.button !== 0) return false;
  if (ev.isPrimary === false) return false;
  src = ldTeamSrcOf(ev.target);
  if (!src) return false;
  touch = ev.pointerType === 'touch';
  d = { src: src, pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, on: false, touch: touch, hold: !(touch && src.k === 'card'), holdT: 0, spring: 0, springN: 0, overEl: null, dst: null, ghost: null, ls: null };
  LDTEAM.drag = d;
  if (!d.hold && typeof setTimeout === 'function') d.holdT = setTimeout(function () { d.holdT = 0; if (LDTEAM.drag === d && !d.on) { d.hold = true; ldTeamDragBegin(d); ldTeamDragHover(d); } }, LDTEAM.holdMs);
  if (typeof document !== 'undefined' && document.addEventListener) {
    d.ls = [['pointermove', ldTeamPMove, false], ['pointerup', ldTeamPUp, false], ['pointercancel', ldTeamPCancel, false], ['touchmove', ldTeamTMove, { passive: false }]];
    d.ls.forEach(function (x) { document.addEventListener(x[0], x[1], x[2]); });
  }
  return true;
}
function ldTeamTMove(ev) { var d = LDTEAM.drag; if (d && d.on && ev.cancelable && ev.preventDefault) ev.preventDefault(); }   // 起拖後擋掉頁面捲動
function ldTeamPMove(ev) {
  var d = LDTEAM.drag, dx, dy;
  if (!d || (d.pid !== undefined && ev.pointerId !== undefined && ev.pointerId !== d.pid)) return false;
  d.x = ev.clientX; d.y = ev.clientY;
  if (!d.on) {
    dx = d.x - d.x0; dy = d.y - d.y0;
    if (dx * dx + dy * dy < LDTEAM.eps * LDTEAM.eps) return false;
    if (!d.hold) { ldTeamDragCleanup(d, false); return false; }   // 觸控卡片列:長按未到就移動 = 使用者在捲動
    ldTeamDragBegin(d);
  }
  ldTeamGhostMove(d);
  ldTeamDragHover(d);
  return true;
}
function ldTeamPUp(ev) {
  var d = LDTEAM.drag, st = LDTEAM.st, dst, plan, rect = null;
  if (!d || (d.pid !== undefined && ev.pointerId !== undefined && ev.pointerId !== d.pid)) return false;
  if (!d.on) { ldTeamDragCleanup(d, false); return false; }   // 沒拖動 = 一般點擊,交給 click
  if (ev.clientX !== undefined) { d.x = ev.clientX; d.y = ev.clientY; }
  LDTEAM.noClickUntil = Date.now() + LDTEAM.clickGuardMs;
  dst = ldTeamDragHover(d);
  if (d.overEl && d.overEl.getBoundingClientRect) rect = d.overEl.getBoundingClientRect();
  d.on = false;   // 重畫時不要再把新 DOM 標成拖曳來源
  plan = (st && dst) ? ldTeamDoDrop(st, d.src, dst) : { ok: false, msg: '' };
  ldTeamDragCleanup(d, !!plan.ok, rect);
  return true;
}
function ldTeamPCancel(ev) {
  var d = LDTEAM.drag;
  if (!d || (d.pid !== undefined && ev && ev.pointerId !== undefined && ev.pointerId !== d.pid)) return false;
  if (d.on) LDTEAM.noClickUntil = Date.now() + LDTEAM.clickGuardMs;
  ldTeamDragCleanup(d, false);
  return true;
}
function ldTeamDragAbort() { if (LDTEAM.drag) ldTeamDragCleanup(LDTEAM.drag, false); }   // 離頁 / 重建時清掉殘留

function ldTeamOnClick(ev) {
  var st = LDTEAM.st, t = ev && ev.target, b = t && t.closest ? t.closest('[data-ldt]') : null, a, id, r, i, p, ids, c, um;
  if (!st || !b) return;
  if (LDTEAM.noClickUntil > Date.now()) { LDTEAM.noClickUntil = 0; return; }   // 剛拖完放開:吃掉隨後的 click
  a = b.getAttribute('data-ldt'); id = b.getAttribute('data-id'); r = +b.getAttribute('data-r');
  if (st.carry && a !== 'cell' && a !== 'team' && a !== 'move') st.carry = null;
  if (a === 'cell' && st.carry) {   // 點選式備案:移動中 → 點目標格完成(點原格 = 取消)
    c = st.carry;
    if (c.n === st.n && c.row === r) { st.carry = null; ldTeamRender(st.el, st); return; }
    ldTeamDoDrop(st, { k: 'slot', n: c.n, row: c.row }, { k: 'slot', n: st.n, row: r });
  } else if (a === 'cell') { st.sel = (st.sel === r) ? -1 : r; ldTeamRender(st.el, st); }
  else if (a === 'team') { if (+b.getAttribute('data-n') !== st.n) ldTeamSwitch(+b.getAttribute('data-n')); }
  else if (a === 'move') {
    if (st.carry) { st.carry = null; ldTeamRender(st.el, st); return; }
    c = null; for (i = 0; i < st.slots.length; i++) if (st.slots[i].row === r) c = st.slots[i];
    if (!c) return;
    st.carry = { n: st.n, row: r, id: c.id }; ldTeamRender(st.el, st);
    ldTeamToast('點目標位置(可先點上方隊伍名稱切隊);再按一次「取消」放棄');
  }
  else if (a === 'card') {
    um = ldTeamUsedMap(st, st.n);
    p = ldTeamPlan(st.slots, id, st.sel, { fig: ldTeamFigOf, block: ldTeamBlockOf, name: ldTeamNameOfId, cost: ldTeamCostOf, cap: ldTeamCap(), other: function (x) { return ldTeamOtherLabel(st, x, st.n, um); } });
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
  else if (a === 'tips') { st.tipsOpen = true; ldTeamRender(st.el, st); }
  else if (a === 'tipsclose') { st.tipsOpen = false; ldTeamRender(st.el, st); }
  else if (a === 'rec') ldTeamRecommend(st);
  else if (a === 'skapply') ldTeamSkrApply(st);
  else if (a === 'skno') { st.skr = null; ldTeamRender(st.el, st); }
  else if (a === 'skgo') { if (typeof ldNavPush === 'function') ldNavPush('skill', { id: id }); }
  else if (a === 'heal-all') ldTeamHealDo(st, true);
  else if (a === 'heal-ok') ldTeamHealDo(st, false);
  else if (a === 'go') ldTeamGo(st);
}

ldNavRegister({
  id: 'team', title: '隊伍',
  bg: function () { return (typeof window !== 'undefined' && window.innerWidth > window.innerHeight) ? 'bg_team_land' : 'bg_team_port'; },
  build: function (el, ctx) {
    var st, n = ctx.n === 0 ? 0 : (ctx.n | 0 || 1), cap = (typeof bnTeamN === 'function') ? bnTeamN() : 3, lock, c;
    if (ctx.titleEl) ctx.titleEl.textContent = ctx.title || (n === 0 ? '代表隊伍' : '隊伍 ' + n);
    if (n > cap || n < 0) {
      lock = (typeof fameTeamLockText === 'function') ? fameTeamLockText(n) : '';
      el.innerHTML = '<p class="ldp-empty">這一隊尚未開放' + (lock ? '(' + ldTeamEsc(lock) + ')' : '') + '</p>';
      LDTEAM.st = null;
      return;
    }
    st = ldTeamState(ctx);
    st.el = el;
    if (!el.__ldtBound) {
      el.__ldtBound = 1; el.addEventListener('click', ldTeamOnClick);
      el.addEventListener('input', ldTeamHealInput); el.addEventListener('change', ldTeamHealInput);
      el.addEventListener('pointerdown', ldTeamPDown);
      el.addEventListener('contextmenu', function (ev) { if (ev.target && ev.target.closest && ev.target.closest('.ldt-cell, .ldt-card') && ev.preventDefault) ev.preventDefault(); });   // 觸控長按不要跳選單
      el.addEventListener('dragstart', function (ev) { if (ev.preventDefault) ev.preventDefault(); });   // 擋掉瀏覽器內建的圖片拖放(改用 Pointer Events)
    }
    ldTeamRender(el, st);
    if (typeof bnTeamDedupNote === 'function') { c = bnTeamDedupNote(); if (c) ldTeamToast(c); }   // 讀存檔時整理過重複武將:提示一次
  },
  onShow: function (el, ctx) { if (ctx.__t) { LDTEAM.st = ctx.__t; ctx.__t.el = el; } },
  onHide: function (el, ctx) { ldTeamDragAbort(); ldTeamWatchStop(); if (LDTEAM.st && LDTEAM.st === ctx.__t) LDTEAM.st = null; }
});
