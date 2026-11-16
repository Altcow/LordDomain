// js/ld_equip_ui.js — 裝備介面(設計_裝備與尋訪_定案.md 任務卡 6;前綴 eq / ldEquip)。只在旗標 ldui 開啟時有作用(頁面登錄在 ld_nav 堆疊;武將詳情的 4 格由 ld_hero.js 呼叫本檔掛鉤)。
// 頁面:'equipPick' 換裝(從武將詳情開)、'equipEnh' 裝備詳情 / 強化 / 餵養 / 分解、'bag' 背包(只剩裝備;S0 已移除庫房與材料頁籤)。頁面層數 ≤ 5:首頁 → 卡包 → 武將詳情 → 換裝 → 強化(第 5 層不放往下的按鈕)。
// 素材走 ld_art.js(has:false = CSS 佔位 + 單一漢字);品質框 / 顏色用程式加,不必每品質各畫。ES2017;不用 ?. ??。
// 全域:ldEquipSlotInner ldEquipInfoHtml ldEquipHeroAct ldEquipItemHtml eqEsc eqArt。
// @DORMANT ldui:本檔所有入口都在 ldui 路徑(ld_hero.js / shell.js 的 ld 分支)才會被呼叫。

var EQ_QCLS = ['q0', 'q1', 'q2', 'q3'];
var EQ_LOCK_MSG = '出征中,回城後才能換裝';
function eqEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function eqToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function eqEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
// 素材佔位(HTML 字串版,同 ld_hero.js ldHeroArt)
function eqArt(key, cls) {
  var a = (typeof LD_ART !== 'undefined') ? LD_ART[key] : null, el;
  if (a && typeof ldArtHas === 'function' && ldArtHas(key) && typeof ldArt === 'function') {
    try { el = ldArt(key, cls); if (el && el.outerHTML) return el.outerHTML; } catch (e) { /* 退回佔位 */ }
  }
  return '<span class="ld-ph ' + (cls || '') + '" data-art="' + eqEsc(key) + '">' + eqEsc(a ? a.ph : '') + '</span>';
}
function eqCs() { return typeof cardsGet === 'function' ? cardsGet() : null; }
function eqCardName(id) {
  var cs = eqCs(), f = cs && id ? cardsFind(cs, id) : null;
  return f ? f.e.name : '';
}
function eqSlotKeyOf(k) { return GEAR_CFG.slotIdx[k] || 'wpn'; }
// 單件裝備的圖示(品質框 + 強化等級角標)
function eqIconHtml(it, big) {
  return '<span class="eq-ico ' + EQ_QCLS[it.q] + (big ? ' big' : '') + '">' + eqArt(gearIconKey(it), 'eq-ic') + (it.lv ? '<em>+' + it.lv + '</em>' : '') + '</span>';
}
function eqAttrLines(it) {
  return it.attrs.map(function (a, i) { return '<span class="eq-at' + (i === 0 ? ' main' : '') + '">' + eqEsc(gearAttrText(a[0], gearAttrVal(it, a[0]))) + '</span>'; }).join('');
}
function eqTraitLines(it) {
  return it.traits.map(function (id) { var t = gearTraitDef(id); return t ? '<span class="eq-tr">' + eqArt(t.ico || '', 'eq-tri') + '<b>' + eqEsc(t.n) + '</b>' + eqEsc(t.d) + '</span>' : ''; }).join('');
}
// 一件裝備的內容區(圖示 + 名稱 + 屬性 + 特性);opt.owner = 顯示穿戴者
function ldEquipItemHtml(it, opt) {
  opt = opt || {};
  return eqIconHtml(it) + '<div class="eq-bd"><b class="eq-nm ' + EQ_QCLS[it.q] + '">' + eqEsc(gearTitle(it)) + (it.lv ? ' +' + it.lv : '') + '</b>' + eqAttrLines(it) + eqTraitLines(it) +
    (opt.owner && it.owner ? '<span class="eq-own">穿在 ' + eqEsc(eqCardName(it.owner) || '?') + ' 身上</span>' : '') + '</div>';
}

// ───────── 武將詳情掛鉤(ld_hero.js)─────────
function ldEquipSlotInner(entryId, k, q) {
  var it;
  if (typeof gearOf !== 'function' || typeof GEAR_CFG === 'undefined') return null;
  it = gearOf(entryId)[eqSlotKeyOf(k)];
  if (!it) return eqArt(q[0], 'ldh-eqi') + '<i>' + eqEsc(q[1]) + '</i>';
  return eqIconHtml(it) + '<i>' + eqEsc(q[1]) + '</i>';
}
function ldEquipInfoHtml(entryId, k) {
  var slot = eqSlotKeyOf(k), it = gearOf(entryId)[slot], cs = eqCs(), f = cs ? cardsFind(cs, entryId) : null, nm = GEAR_CFG.slotName[slot], star = f ? cardsStarLv(f.e) : 0, h = '', free;
  free = gearList({ slot: slot, free: true }).length;
  if (!it) {
    h = '<b>' + nm + '</b><span>尚未裝備。紫裝需 1 星、金裝需 2 星。背包有 ' + free + ' 件' + nm + '可換。</span>';
    h += '<button class="ldh-mini" data-act="eqpick" data-v="' + k + '">選擇' + nm + '</button>';
    return h;
  }
  h = '<b>' + eqEsc(gearTitle(it)) + (it.lv ? ' +' + it.lv : '') + '</b>' + eqAttrLines(it) + eqTraitLines(it);
  h += '<span class="eq-act"><button class="ldh-mini" data-act="eqpick" data-v="' + k + '">更換</button> <button class="ldh-mini" data-act="eqdet" data-v="' + eqEsc(it.id) + '">強化 / 詳情</button> <button class="ldh-mini warn" data-act="equnq" data-v="' + eqEsc(it.id) + '">脫下</button></span>';
  return h;
}
// 回 true = 已處理(ld_hero.js ldHeroAct 的 eqpick / eqdet / equnq)
function ldEquipHeroAct(ctx, act, v) {
  var cs = eqCs(), f = cs ? cardsFind(cs, ctx.id) : null, slot, r;
  if (!f) return false;
  if (act === 'eqpick') {
    if (f.list !== 'roster') { eqToast('非卡包人員不能裝備(先收入卡包)'); return true; }
    if (typeof gearLockOf === 'function' && gearLockOf(f.e)) { eqToast(EQ_LOCK_MSG); return true; }
    if (ctx.last || typeof ldNavPush !== 'function') { eqToast('請從卡包進入更換'); return true; }
    slot = eqSlotKeyOf(+v);
    ldNavPush('equipPick', { eid: ctx.id, slot: slot });
    return true;
  }
  if (act === 'eqdet') {
    if (ctx.last || typeof ldNavPush !== 'function') { eqToast('請從卡包進入'); return true; }
    ldNavPush('equipEnh', { gid: v });
    return true;
  }
  if (act === 'equnq') {
    r = gearUnequip(v);
    if (!r.ok) { eqToast(r.reason === 'lock' ? EQ_LOCK_MSG : '無法脫下'); return true; }
    eqToast('已脫下');
    if (typeof ldHeroRender === 'function' && ctx.heroEl) ldHeroRender(ctx.heroEl, ctx);
    return true;
  }
  return false;
}

// ───────── 換裝頁 ─────────
function eqReasonText(r) {
  if (r.reason === 'star') return '星數不足:需 ' + r.need + ' 星(去熔爐升星)';
  if (r.reason === 'lock' || r.reason === 'lockfrom') return EQ_LOCK_MSG;
  if (r.reason === 'nocard') return '此人不在卡包';
  return '無法穿上';
}
function eqSortItems(a, b) { return (b.q - a.q) || (b.lv - a.lv) || (a.id < b.id ? -1 : 1); }
function eqPickHtml(ctx) {
  var slot = ctx.slot, cur = gearOf(ctx.eid)[slot], list = gearList({ slot: slot }).filter(function (it) { return it.owner !== ctx.eid; }).sort(eqSortItems), cs = eqCs(), f = cs ? cardsFind(cs, ctx.eid) : null, star = f ? cardsStarLv(f.e) : 0, h = '';
  h += '<div class="eq-l"><div class="eq-head">' + eqEsc(eqCardName(ctx.eid)) + ' · ' + GEAR_CFG.slotName[slot] + '<i>' + star + ' 星</i></div>';
  h += '<div class="eq-sec">目前</div>';
  h += cur ? '<div class="eq-row cur">' + ldEquipItemHtml(cur) + '<div class="eq-bt"><button class="eq-b" data-a="det" data-v="' + eqEsc(cur.id) + '">強化 / 詳情</button><button class="eq-b warn" data-a="off" data-v="' + eqEsc(cur.id) + '">脫下</button></div></div>' : '<div class="eq-none">沒有裝備</div>';
  h += '</div><div class="eq-r"><div class="eq-sec">可換(' + list.length + ')</div>';
  if (!list.length) h += '<div class="eq-none">背包沒有其他' + GEAR_CFG.slotName[slot] + '。' + (slot === 'wpn' || slot === 'arm' ? '到鍛造坊鍛造。' : slot === 'horse' ? '到書院尋訪馬。' : '到書院尋訪人才時有機會尋到。') + '</div>';
  list.forEach(function (it) {
    var need = GEAR_CFG.needStar[it.q], lack = star < need;
    h += '<div class="eq-row' + (lack ? ' lack' : '') + '">' + ldEquipItemHtml(it, { owner: true }) + '<div class="eq-bt">' +
      (lack ? '<span class="eq-need">需 ' + need + ' 星</span>' : '<button class="eq-b" data-a="on" data-v="' + eqEsc(it.id) + '">穿上</button>') +
      '<button class="eq-b sub" data-a="det" data-v="' + eqEsc(it.id) + '">詳情</button></div></div>';
  });
  return h + '</div>';
}
function eqPickRender(el, ctx) {
  ctx.pickEl = el;
  el.innerHTML = '<div class="eq-page eq-2c">' + eqPickHtml(ctx) + '</div>';
  el.onclick = function (ev) { eqPickClick(ctx, ev); };
}
function eqFindAct(ev, root) {
  var n = ev ? ev.target : null;
  while (n && n !== root && n.getAttribute && !n.getAttribute('data-a')) n = n.parentNode;
  return (n && n !== root && n.getAttribute && n.getAttribute('data-a')) ? n : null;
}
function eqPickClick(ctx, ev) {
  var n = eqFindAct(ev, ctx.pickEl), a, v, r;
  if (!n) return false;
  a = n.getAttribute('data-a'); v = n.getAttribute('data-v');
  if (a === 'on') {
    r = gearEquip(v, ctx.eid);
    if (!r.ok) { eqToast(eqReasonText(r)); return true; }
    eqToast('已穿上');
    if (typeof ldNavBack === 'function') ldNavBack();
    return true;
  }
  if (a === 'off') {
    r = gearUnequip(v);
    if (!r.ok) { eqToast(r.reason === 'lock' ? EQ_LOCK_MSG : '無法脫下'); return true; }
    eqPickRender(ctx.pickEl, ctx);
    return true;
  }
  if (a === 'det') {
    if (ctx.last || typeof ldNavPush !== 'function') { eqToast('層數已達上限'); return true; }
    ldNavPush('equipEnh', { gid: v });
    return true;
  }
  return false;
}

// ───────── 裝備詳情 / 強化 / 餵養 / 分解 ─────────
function eqMatName(id) { return (typeof matName === 'function') ? matName(id) : id; }
function eqMatsText(o) {
  var k, out = [];
  for (k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k] > 0) out.push(eqMatName(k) + '×' + o[k]);
  return out.join('、');
}
function eqEnhHtml(it, ctx) {
  var info = gearEnhanceInfo(it), have = (typeof matCount === 'function') ? matCount('m_whet') : 0, h = '', pct;
  h += '<div class="eq-sec">強化(礪石)</div>';
  if (info.max) return h + '<div class="eq-none">已強化到 +10</div>';
  h += '<div class="eq-kv"><span>下一級</span><b>+' + info.to + '</b></div>';
  h += '<div class="eq-kv"><span>礪石</span><b class="' + (have >= info.whet ? '' : 'bad') + '">' + have + ' / ' + info.whet + '</b></div>';
  h += '<div class="eq-kv"><span>成功率</span><b>' + Math.round(info.rate * 100) + '%</b></div>';
  if (info.brk > 0) h += '<div class="eq-kv"><span>失敗損毀</span><b class="bad">' + Math.round(info.brk * 100) + '%</b></div><div class="eq-warn">失敗可能損毀(裝備消失,穿在身上的也一樣),退回主材與礪石的 30%。</div>';
  else h += '<div class="eq-note">+3 以前失敗只扣礪石,不會損毀。</div>';
  h += '<button class="eq-b big' + (have >= info.whet ? '' : ' off') + '" data-a="enh">' + (info.brk > 0 && ctx.enhConfirm ? '確定強化(可能損毀)' : '強化到 +' + info.to) + '</button>';
  return h;
}
function eqFeedHtml(it, ctx) {
  var foods = gearList({ slot: it.slot, free: true }).filter(function (x) { return x.id !== it.id; }).sort(function (a, b) { return a.q - b.q || a.lv - b.lv; }), h = '', pts = 0, sel = ctx.sel || {}, left = gearFeedLeft(it);
  h += '<div class="eq-sec">餵養(同部位裝備,必成功、不損毀)</div>';
  if (it.lv >= GEAR_CFG.lvMax) return h + '<div class="eq-none">已強化到 +10</div>';
  h += '<div class="eq-kv"><span>強化點數</span><b>' + it.fp + '(到 +' + (it.lv + 1) + ' 還差 ' + left + ')</b></div>';
  if (!foods.length) return h + '<div class="eq-none">沒有可餵的' + GEAR_CFG.slotName[it.slot] + '(未穿的同部位裝備)</div>';
  h += '<div class="eq-bt"><button class="eq-b sub" data-a="selq" data-v="0">全選白</button><button class="eq-b sub" data-a="selq" data-v="1">全選白藍</button><button class="eq-b sub" data-a="selq" data-v="-1">清除</button></div>';
  foods.forEach(function (x) {
    var on = !!sel[x.id];
    if (on) pts += GEAR_CFG.feedPts[x.q];
    h += '<div class="eq-row food' + (on ? ' on' : '') + '" data-a="sel" data-v="' + eqEsc(x.id) + '">' + ldEquipItemHtml(x) + '<div class="eq-bt"><b class="eq-pt">+' + GEAR_CFG.feedPts[x.q] + ' 點</b><span class="eq-chk">' + (on ? '✔' : '') + '</span></div></div>';
  });
  h += '<button class="eq-b big' + (pts ? '' : ' off') + '" data-a="feed">餵養所選(+' + pts + ' 點)</button>';
  return h;
}
function eqEnhPageHtml(ctx) {
  var st = gearRead(), it = gearFind(st, ctx.gid), h = '', sv, owner, rs = '';
  if (ctx.res) rs = '<div class="eq-result ' + (ctx.res.cls || '') + '">' + ctx.res.html + '</div>';
  if (!it) return '<div class="eq-l">' + rs + '<div class="eq-none">' + (ctx.res ? '' : '找不到這件裝備') + '</div>' + '<button class="eq-b big" data-a="back">返回</button></div>';
  owner = it.owner ? eqCardName(it.owner) : '';
  h += '<div class="eq-l"><div class="eq-row cur">' + ldEquipItemHtml(it, { owner: true }) + '</div>';
  h += '<div class="eq-kv"><span>品質 / 部位</span><b>' + GEAR_CFG.qName[it.q] + ' · ' + GEAR_CFG.slotName[it.slot] + '</b></div>';
  h += '<div class="eq-kv"><span>強化</span><b>+' + it.lv + ' / ' + GEAR_CFG.lvMax + '(屬性 ×' + (1 + GEAR_CFG.lvGrow * it.lv).toFixed(2) + ',特性不變大)</b></div>';
  h += '<div class="eq-sec">處理</div><div class="eq-bt">';
  if (it.owner) h += '<button class="eq-b warn" data-a="off">脫下</button><span class="eq-note">穿在身上的不能分解</span>';
  else {
    sv = gearSalvageValue(it);
    h += '<button class="eq-b warn" data-a="salv">' + (ctx.salvConfirm ? '確定分解' : '分解') + '(' + (sv.shards ? '碎片 ' + sv.shards : eqMatsText(sv.mats)) + ')</button>';
  }
  h += '</div></div><div class="eq-r">' + rs + ((it.slot === 'wpn' || it.slot === 'arm') ? eqEnhHtml(it, ctx) : eqFeedHtml(it, ctx)) + '</div>';
  return h;
}
function eqEnhRender(el, ctx) {
  ctx.enhEl = el;
  el.innerHTML = '<div class="eq-page eq-2c">' + eqEnhPageHtml(ctx) + '</div>';
  el.onclick = function (ev) { eqEnhClick(ctx, ev); };
}
function eqEnhResultHtml(r) {
  var h;
  if (r.broke) return { cls: 'bad', html: '<div class="eq-brk">' + eqArt('xf_3', 'eq-stk') + eqArt('fg_smith_cry', 'eq-smith') + '</div><b>裝備損毀了…</b><span>退回:' + eqEsc(eqMatsText(r.refund) || '無') + '</span>' };
  if (r.success) return { cls: 'ok', html: '<b>強化成功!+' + r.lv + '</b><span>消耗礪石 ' + r.whet + '</span>' };
  return { cls: 'bad', html: '<b>強化失敗</b><span>等級不變,礪石 ' + r.whet + ' 已消耗(成功率 ' + Math.round(r.rate * 100) + '%)</span>' };
}
function eqEnhClick(ctx, ev) {
  var n = eqFindAct(ev, ctx.enhEl), a, v, it, info, r, ids, st, k;
  if (!n) return false;
  a = n.getAttribute('data-a'); v = n.getAttribute('data-v');
  it = gearFind(gearRead(), ctx.gid);
  if (a === 'back') { if (typeof ldNavBack === 'function') ldNavBack(); return true; }
  if (!it) return false;
  if (a === 'enh') {
    info = gearEnhanceInfo(it);
    if (info.brk > 0 && !ctx.enhConfirm) { ctx.enhConfirm = true; ctx.res = null; eqEnhRender(ctx.enhEl, ctx); return true; }
    r = gearEnhance(ctx.gid);   // 先扣材料 / 計數器並寫入存檔,再顯示結果
    ctx.enhConfirm = false;
    if (!r.ok) { eqToast(r.reason === 'mat' ? '礪石不足(需 ' + r.need + ')' : '無法強化'); ctx.res = null; }
    else ctx.res = eqEnhResultHtml(r);
    eqEnhRender(ctx.enhEl, ctx);
    return true;
  }
  if (a === 'sel') { ctx.sel = ctx.sel || {}; if (ctx.sel[v]) delete ctx.sel[v]; else ctx.sel[v] = 1; eqEnhRender(ctx.enhEl, ctx); return true; }
  if (a === 'selq') {
    ctx.sel = {};
    if (+v >= 0) gearList({ slot: it.slot, free: true }).forEach(function (x) { if (x.id !== it.id && x.q <= +v) ctx.sel[x.id] = 1; });
    eqEnhRender(ctx.enhEl, ctx);
    return true;
  }
  if (a === 'feed') {
    ids = Object.keys(ctx.sel || {});
    r = gearFeed(ctx.gid, ids);
    ctx.sel = {};
    if (!r.ok) { eqToast(r.reason === 'max' ? '已強化到 +10' : '沒有選擇餵料'); ctx.res = null; }
    else ctx.res = { cls: 'ok', html: '<b>餵養成功:+' + r.pts + ' 點</b><span>目前 +' + r.lv + (r.lv >= GEAR_CFG.lvMax ? '(滿級)' : ',到下一級還差 ' + r.left + ' 點') + '</span>' };
    eqEnhRender(ctx.enhEl, ctx);
    return true;
  }
  if (a === 'off') {
    r = gearUnequip(ctx.gid);
    if (!r.ok) eqToast(r.reason === 'lock' ? EQ_LOCK_MSG : '無法脫下');
    eqEnhRender(ctx.enhEl, ctx);
    return true;
  }
  if (a === 'salv') {
    if (!ctx.salvConfirm) { ctx.salvConfirm = true; eqEnhRender(ctx.enhEl, ctx); return true; }
    r = gearSalvage([ctx.gid]);
    ctx.salvConfirm = false;
    if (!r.ok) { eqToast('穿在身上的不能分解'); eqEnhRender(ctx.enhEl, ctx); return true; }
    eqToast('已分解' + (r.shards ? ':碎片 +' + r.shards : ':' + eqMatsText(r.mats)));
    if (typeof ldNavBack === 'function') ldNavBack();
    return true;
  }
  return false;
}

// ───────── 背包(裝備 / 材料)─────────
var EQ_BAG_FILTERS = [['', '全部'], ['wpn', '武器'], ['arm', '防具'], ['horse', '馬'], ['relic', '寶具']];
function eqBagHtml(ctx) {
  var h = '', list, n, ids;
  list = gearList(ctx.slot ? { slot: ctx.slot } : {}).sort(eqSortItems);
  n = gearList({ free: true }).length;
  h += '<div class="eq-filter">' + EQ_BAG_FILTERS.map(function (f) { return '<button class="ld-tab' + ((ctx.slot || '') === f[0] ? ' on' : '') + '" data-a="flt" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
  h += '<div class="eq-kv"><span>未穿庫存</span><b class="' + (n >= GEAR_CFG.inv ? 'bad' : '') + '">' + n + ' / ' + GEAR_CFG.inv + '</b></div>';
  if (!list.length) return h + '<div class="eq-none">還沒有裝備。到鍛造坊鍛造武器 / 防具,到書院尋訪馬與寶具。</div>';
  h += '<div class="eq-grid">';
  list.forEach(function (it) { h += '<div class="eq-cell ' + EQ_QCLS[it.q] + '" data-a="item" data-v="' + eqEsc(it.id) + '">' + eqIconHtml(it) + '<i>' + eqEsc(GEAR_CFG.slotName[it.slot]) + '</i>' + (it.owner ? '<u>穿</u>' : '') + '</div>'; });
  h += '</div>';
  ids = gearBulkIds();
  h += '<button class="eq-b big' + (ids.length ? '' : ' off') + '" data-a="bulk">' + (ctx.bulkConfirm ? '確定分解 ' + ids.length + ' 件' : '一鍵分解白藍(未強化、未穿 ' + ids.length + ' 件)') + '</button>';
  return h;
}
function eqBagRender(el, ctx) {
  ctx.bagEl = el;
  el.innerHTML = '<div class="eq-page">' + eqBagHtml(ctx) + '</div>';
  el.onclick = function (ev) { eqBagClick(ctx, ev); };
}
function eqBagClick(ctx, ev) {
  var n = eqFindAct(ev, ctx.bagEl), a, v, r;
  if (!n) return false;
  a = n.getAttribute('data-a'); v = n.getAttribute('data-v');
  if (a === 'flt') { ctx.slot = v; ctx.bulkConfirm = false; eqBagRender(ctx.bagEl, ctx); return true; }
  if (a === 'item') {
    if (ctx.last || typeof ldNavPush !== 'function') { eqToast('層數已達上限'); return true; }
    ldNavPush('equipEnh', { gid: v });
    return true;
  }
  if (a === 'bulk') {
    if (!ctx.bulkConfirm) { ctx.bulkConfirm = true; eqBagRender(ctx.bagEl, ctx); return true; }
    ctx.bulkConfirm = false;
    r = gearSalvage(gearBulkIds());
    eqToast(r.ok ? '已分解 ' + r.n + ' 件' + (r.shards ? ',碎片 +' + r.shards : '') + (Object.keys(r.mats).length ? ',' + eqMatsText(r.mats) : '') : '沒有可分解的');
    eqBagRender(ctx.bagEl, ctx);
    return true;
  }
  return false;
}

if (typeof ldNavRegister === 'function') {
  ldNavRegister({
    id: 'equipPick', title: '換裝', noClose: true,
    build: function (el, ctx) { eqPickRender(el, ctx); },
    onShow: function (el, ctx) { eqPickRender(el, ctx); }
  });
  ldNavRegister({
    id: 'equipEnh', title: '裝備', noClose: true,
    res: function () { return [['礪石', (typeof matCount === 'function') ? matCount('m_whet') : 0]]; },
    build: function (el, ctx) { ctx.sel = {}; ctx.res = null; ctx.enhConfirm = false; ctx.salvConfirm = false; eqEnhRender(el, ctx); }
  });
  ldNavRegister({
    id: 'bag', title: '背包',
    res: function () { return [['未穿', gearList({ free: true }).length + '/' + GEAR_CFG.inv]]; },
    build: function (el, ctx) { ctx.bulkConfirm = false; eqBagRender(el, ctx); },
    onShow: function (el, ctx) { eqBagRender(el, ctx); }
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { ldEquipItemHtml: ldEquipItemHtml };
