// js/ld_open_ui.js — 開場 / 解鎖 / 預約 / 活動 的介面(設計_開場解鎖_預約_活動_定案.md 2.2、2.3、3.2、4;卡 2、5、6、7、8 的畫面層)。前綴 ldo。
// 只在旗標 ldui(且 shell)開啟時生效(@DORMANT ldui):以「包裝全域函式」的方式掛上新首頁與地圖,不整檔改共用檔:
//   ldHomeRefresh / ldHomeBldDo(js/ld_home.js):灰木牌(鎖頭 + 條件文字)、開放慶祝(一次一個)、定時 evLoginTick、場景上方晶片列(新手七日 / 活動 / 主線);shellAct(js/shell.js):'ldopen:*' 動作。
//   堆疊頁(ld_nav.js):'event'(活動:新手七日 + 賽季簽到 + 團結關入口 + 寶地說明,原列保留在後)、'quest'(主線 14 條)、'nb'(新手七日)、'boss'(團結關)。
//   地圖(js/wd_ui.js)掛點 ldoWd*:未開放的分頁 / 點隱藏、預約時段列 + 確認表、點詳情的預約 / 撤回、「活動首領」卡與團結關頁(在地圖面板自己的堆疊裡,不另開新頁)。
// 頁面用 HTML 字串 + data-ldo / data-wd 委派點擊(動作名 ev_*),純函式 ldo*Html 可在 node 測。素材:ld_art.js 已登記且已有圖(ev_boss / ev_week / ev_open / ev_group_bg / evi_* / evc_* / evs_*)。ES2017;不用 ?. ??。

var LDO = { t: 0, sel: null, last: null, draws: {}, cele: 0, plq: {} };
var ldoOrigHomeRefresh, ldoOrigHomeBldDo, ldoOrigShellAct;   // 被包裝的原函式

function ldoOn() { return typeof unlockOn === 'function' && unlockOn(); }   // @DORMANT ldui
function ldoEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function ldoToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function ldoEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
function ldoP2(n) { return (n < 10 ? '0' : '') + n; }
function ldoHM(t) { var d = new Date(t + EV_CFG.tz); return ldoP2(d.getUTCHours()) + ':' + ldoP2(d.getUTCMinutes()); }
function ldoMD(t) { var d = new Date(t + EV_CFG.tz); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + ldoHM(t); }
function ldoDur(ms) {
  var m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
  if (d > 0) return d + ' 天 ' + h + ' 小時';
  if (h > 0) return h + ' 小時 ' + (m % 60) + ' 分';
  return m + ' 分';
}
// 圖示 HTML(同 ldArt 的 HTML 版):有圖畫圖(整圖 / 圖集格),沒圖畫 CSS 佔位漢字
function ldoArt(key, cls) {
  var a = (typeof LD_ART !== 'undefined') ? LD_ART[key] : null, url = (typeof ldArtUrl === 'function') ? ldArtUrl(key) : null, c, st;
  if (!a) return '<span class="ld-ph ' + (cls || '') + '"></span>';
  if (!url) return '<span class="ld-ph ' + (cls || '') + '" data-art="' + key + '">' + ldoEsc(a.ph) + '</span>';
  if (a.cell) {
    c = a.cell;
    st = 'background-image:url(' + url + ');background-size:' + (c[2] * 100) + '% ' + (c[3] * 100) + '%;background-position:' + (c[2] > 1 ? c[0] / (c[2] - 1) * 100 : 0) + '% ' + (c[3] > 1 ? c[1] / (c[3] - 1) * 100 : 0) + '%';
    return '<span class="ld-ph ' + (cls || '') + '" data-art="' + key + '"><i class="ld-ph-cell" style="' + st + '"></i></span>';
  }
  return '<span class="ld-ph ' + (cls || '') + '" data-art="' + key + '"><img alt="" src="' + url + '"></span>';
}
function ldoCs() { return (typeof cardsGet === 'function') ? cardsGet() : null; }
function ldoTeams() { try { return typeof wdTeams === 'function' ? wdTeams() : []; } catch (e) { return []; } }
function ldoTeamPower(t) { var cs = ldoCs(); try { return cs && typeof wdTeamPower === 'function' ? Math.round(wdTeamPower(cs, t.slots)) : 0; } catch (e) { return 0; } }

// ═════════ 一、首頁:木牌鎖 / 慶祝 / 登入 ═════════
// 木牌下方的鎖定短字(完整條件點了才用 Toast 顯示):「名聲 800」「打一場戰鬥」「得鍛造材料」
function ldoLockShort(uid) {
  var full = unlockLockText(uid), c = unlockCfg(uid);
  if (!full) return '';
  if (c && c.ev && c.txt) return ({ drill: '打一場戰鬥', forge: '得鍛造材料' })[uid] || full.replace(/\s*開放$/, '');
  return full.replace(/\s*開放$/, '');
}
function ldoPlaqueSync() {
  var map = (typeof UNLOCK_PLAQUE !== 'undefined') ? UNLOCK_PLAQUE : {}, n = 0, sig = '';
  if (typeof LDH === 'undefined' || !LDH.plq) return 0;
  Object.keys(map).forEach(function (pid) {
    var el = LDH.plq[pid], uid = map[pid], lk, sub, ic;
    if (!el) return;
    lk = !unlockIs(uid);
    sub = LDO.plq[pid] && LDO.plq[pid].sub;
    if (lk) {
      el.classList.add('lock'); n++;
      if (!LDO.plq[pid]) { LDO.plq[pid] = { sub: ldoEl('span', 'ldh-sub ldo-lktx'), ic: ldoEl('span', 'ldo-lkic') }; el.appendChild(LDO.plq[pid].sub); el.appendChild(LDO.plq[pid].ic); LDO.plq[pid].ic.innerHTML = ldoArt('evi_lock', 'ldo-lkimg'); sub = LDO.plq[pid].sub; }
      sub.textContent = ldoLockShort(uid); sub.hidden = false; LDO.plq[pid].ic.hidden = false; sig += pid + ':' + sub.textContent.length + ';';
    } else if (LDO.plq[pid]) {
      el.classList.remove('lock');
      LDO.plq[pid].sub.hidden = true; LDO.plq[pid].ic.hidden = true;
    }
  });
  if (sig !== LDO.lkSig) { LDO.lkSig = sig; if (typeof ldHomeLayout === 'function') ldHomeLayout(); }   // 鎖定小字有增減:木牌分區要重排
  return n;
}
function ldoCelebrate() {
  var id = unlockTakeCelebrate(), c, pid, el, b;
  if (!id) return null;
  c = unlockCfg(id);
  ldoToast('新開放:' + (c ? c.label : id) + '!');
  if (typeof UNLOCK_PLAQUE !== 'undefined' && typeof LDH !== 'undefined') {
    Object.keys(UNLOCK_PLAQUE).forEach(function (p) { if (UNLOCK_PLAQUE[p] === id) pid = p; });
    el = pid && LDH.plq ? LDH.plq[pid] : null;
    if (el) { el.classList.add('ldo-cele'); if (typeof setTimeout === 'function') setTimeout(function () { el.classList.remove('ldo-cele'); }, 3000); }
    if (LDH.root && LDH.root.appendChild) {
      b = ldoEl('div', 'ldo-banner');
      b.innerHTML = ldoArt('ev_open', 'ldo-bimg') + '<b>新開放!</b><span>' + ldoEsc(c ? c.label : id) + '</span>';
      LDH.root.appendChild(b);
      if (typeof setTimeout === 'function') setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 3200);
    }
  }
  return id;
}
function ldoBoot(now) {
  var r;
  if (!ldoOn()) return null;
  now = now || Date.now();
  if (LDO.t && now - LDO.t < 60000) return null;
  LDO.t = now;
  r = evLoginTick(now);
  unlockSync(now);
  if (r && r.newDay) ldoToast('新的一天:新手七日 / 簽到可以領了');
  if (r && r.bossAuto && r.bossAuto.length) ldoToast('團結關自動出戰 ' + r.bossAuto.length + ' 次');
  return r;
}
function ldoHomeRefresh() {
  var r;
  if (typeof ldoOrigHomeRefresh === 'function') r = ldoOrigHomeRefresh();
  if (!ldoOn()) return r;
  try { ldoBoot(); ldoPlaqueSync(); ldoChipBar(); if (!LDO.celeBusy) ldoCelebrate(); } catch (e) { if (typeof console !== 'undefined' && console.error) console.error('ldoHomeRefresh', e); }
  return r;
}
function ldoHomeBldDo(b) {
  var u = (typeof UNLOCK_PLAQUE !== 'undefined' && b) ? UNLOCK_PLAQUE[b.id] : null;
  if (ldoOn() && u && !unlockIs(u)) { ldoToast(b.n + ':' + unlockLockText(u)); return false; }
  return ldoOrigHomeBldDo(b);
}

// ═════════ 二、左上晶片與 ldopen:* 動作 ═════════
function ldoChips(now) {
  var out = [], nb, q, claim = 0, a, boss;
  if (!ldoOn()) return out;
  nb = evNbList();
  if (nb.some(function (x) { return !x.got; })) {
    nb.forEach(function (x) { if (x.can) claim++; });
    out.push({ id: 'nb7', label: '新手七日', asset: '', glyph: '七', act: 'ldopen:nb', dot: claim > 0 || evRead().nb.pick === 1, sub: claim > 0 ? '可領 ' + claim : '第 ' + Math.min(7, evRead().nb.days) + ' 天' });
  }
  if (unlockIs('event')) {
    a = evActive(now);
    boss = a.some(function (x) { return x.id === 'boss'; });
    if (a.some(function (x) { return x.id === 'boss' || x.id === 'treasure'; })) out.push({ id: 'evt', label: '活動', asset: '', glyph: '活', act: 'ldopen:event', dot: boss && ldoBossReady(now), sub: boss ? '團結關' : '寶地採集' });
  }
  q = evMainCur();
  if (q) out.push({ id: 'main', label: '主線', asset: '', glyph: '任', act: 'ldopen:main', dot: false, sub: q.t });
  return out;
}
function ldoBossReady(now) {
  var b = evBossGet(), s;
  if (!b || b.fin || now >= b.t1) return false;
  s = evBossSlotNow(b, now);
  return !!s && !b.used['S' + s.i];
}
// 新首頁沒有舊的晶片列(shell.js 只在舊首頁建 .sh-evt):在場景上方自己放一排晶片(新手七日 / 活動 / 主線);內容有變才重畫
function ldoChipBar() {
  var sc = (typeof LDH !== 'undefined' && LDH) ? LDH.scene : null, list, key, h = '';
  if (!sc || !sc.appendChild) return false;
  if (typeof wmapUiOn === 'function' && wmapUiOn()) { if (LDO.bar) LDO.bar.hidden = true; return false; }   // 2026-11-18:地圖主畫面不放晶片,新手七日 / 主線 / 活動改收進左上〔任務〕鈕的任務中心頁(js/wmap_home.js)
  if (!LDO.bar) { LDO.bar = ldoEl('div', 'ldo-chips'); LDO.bar.addEventListener('click', function (ev) { var t = ev && ev.target, b = t && t.closest ? t.closest('[data-act]') : null; if (b && typeof shellAct === 'function') shellAct(b.getAttribute('data-act')); }); sc.appendChild(LDO.bar); }
  list = ldoChips(Date.now());
  key = JSON.stringify(list);
  if (key === LDO.barKey) return true;
  LDO.barKey = key;
  list.forEach(function (c) { h += '<button type="button" class="ldo-chip" data-act="' + ldoEsc(c.act) + '">' + ldoArt(c.id === 'nb7' ? 'evi_book' : (c.id === 'evt' ? 'evi_flag' : 'evi_ribbon'), 'ldo-chic') + '<span class="ldo-chtx"><b>' + ldoEsc(c.label) + '</b><small>' + ldoEsc(c.sub) + '</small></span>' + (c.dot ? '<i class="ldh-dot"></i>' : '') + '</button>'; });
  LDO.bar.innerHTML = h;
  LDO.bar.hidden = !list.length;
  if (LDO.barN !== list.length) { LDO.barN = list.length; if (typeof ldHomeLayout === 'function') ldHomeLayout(); }   // 晶片數變了:木牌避開的分區寬度跟著變
  return true;
}
function ldoShellAct(act) {
  if (typeof act === 'string' && act.indexOf('ldopen:') === 0) {
    if (!ldoOn() || typeof ldNavPush !== 'function') return false;
    var w = act.slice(7);
    if (w === 'nb') return ldNavPush('nb');
    if (w === 'event') return ldNavPush('event');
    if (w === 'boss') return ldNavPush('boss');
    if (w === 'quest') return ldNavPush('quest');
    if (w === 'main') return ldoMainGo(evMainCur());
    return false;
  }
  return ldoOrigShellAct(act);
}
// 主線「點了直接跳過去」
function ldoMainGo(q) {
  var go = { 1: 'gift', 2: 'cards:D', 5: 'wm', 6: 'wm', 7: 'wm', 8: 'wm', 9: 'wm', 10: 'wm', 12: 'wm', 13: 'wm', 14: 'wm', 4: 'wm' };
  if (!q) { ldoToast('主線都完成了'); return false; }
  if (q.id === 3) return typeof ldNavPush === 'function' ? ldNavPush('team', { n: 1, mode: 'edit' }) : false;
  if (q.id === 11) { if (typeof shellAct === 'function') return shellAct('cards:F'); return false; }
  if (go[q.id] && typeof shellAct === 'function') return shellAct(go[q.id]);
  return false;
}

// ═════════ 三、頁面 HTML ═════════
function ldoNbHtml(A) {
  var l = evNbList(), o = evRead(), h = '<div class="ldo-card ldo-nb"><div class="ldo-nbl"><div class="ldo-ban">' + ldoArt('ev_week', 'ldo-banimg') + '</div><div class="ldo-sm">第 ' + Math.min(7, o.nb.days) + ' 個登入日。每個登入日領一格,沒來的天之後照順序補領,不會斷。' + (o.legacy ? '(舊帳號:抽數格改發碎片)' : '') + '</div></div><div class="ldo-nbr"><div class="ldo-g7">';
  l.forEach(function (x) {
    h += '<div class="ldo-cell' + (x.got ? ' got' : '') + (x.can ? ' can' : '') + (x.pick ? ' big' : '') + '">' + ldoArt(x.got ? 'evs_3' : (x.pick ? 'evs_2' : 'evs_1'), 'ldo-cbg') + '<b>第 ' + x.day + ' 天</b><span>' + (x.legacy ? '碎片 ' + EV_CFG.legacyShards : (x.pulls ? '抽 ' + x.pulls : (x.give ? '碎片 ' + x.give.shards + ' + 材料' : '糧食'))) + (x.pick ? ' + 紫將' : '') + '</span>' +
      (x.can ? '<button class="ldo-b" ' + A + '="ev_nbclaim" data-d="' + x.day + '">領取</button>' : (x.got ? '<i>已領</i>' : '<i>未到</i>')) + '</div>';
  });
  h += '</div>';
  if (o.nb.pick === 1) h += ldoPickHtml(A);
  return h + '</div></div>';
}
function ldoPickHtml(A) {
  var pool = (typeof cardsFigPool === 'function') ? cardsFigPool(3) : [], h = '<div class="ldo-pick-h"><b>第 7 天大獎:自選 1 張紫名人</b><div class="ldo-pickg">';
  pool.slice(0, 40).forEach(function (f) { h += '<button class="ldo-b s" ' + A + '="ev_nbpick" data-f="' + ldoEsc(f.id) + '">' + ldoEsc(f.name) + '</button>'; });
  return h + '</div></div>';
}
function ldoSignHtml(A, now) {
  var l = evSignList(now), d = evDayOfSeason(now), h = '<div class="ldo-card"><div class="ldo-ttl">賽季簽到 <small>第 ' + d + ' / ' + EV_CFG.seasonDays + ' 天・不可補簽</small></div><div class="ldo-gs">';
  l.forEach(function (x) {
    var cls = 'ldo-sc' + (x.got ? ' got' : '') + (x.today && !x.got ? ' today' : '') + (x.past && !x.got ? ' miss' : '') + (x.big ? ' big' : '');
    h += '<div class="' + cls + '">' + ldoArt(x.big ? 'evs_2' : 'evs_1', 'ldo-scbg') + '<b>' + x.day + '</b>' + (x.got ? ldoArt('evs_3', 'ldo-scmk') : (x.past ? ldoArt('evs_4', 'ldo-scmk') : '')) + (x.today && !x.got ? '<button class="ldo-b" ' + A + '="ev_signclaim" data-d="' + x.day + '">領</button>' : '') + '</div>';
  });
  return h + '</div><div class="ldo-sm">每天:抽數 ' + EV_CFG.signPulls + '、糧 ' + EV_CFG.signGrain + '、碎片 ' + EV_CFG.signShards + ';第 ' + EV_CFG.signBig.join(' / ') + ' 天大獎再加抽數 ' + EV_CFG.signBigPulls + '、礪石 3。</div></div>';
}
function ldoEventHtml(A, now, skipNb) {
  var h = '<div class="ldo-ev"><div class="ldo-evg">', a = evActive(now), boss = evBossGet(), tr = a.filter(function (x) { return x.id === 'treasure'; })[0], nx;
  if (!skipNb && evNbList().some(function (x) { return !x.got; })) h += '<button class="ldo-row" ' + A + '="ev_gonb">' + ldoArt('evi_book', 'ldo-ri') + '<span><b>新手七日</b><small>登入第 ' + Math.min(7, evRead().nb.days) + ' 天;領完 7 格後消失</small></span></button>';
  if (unlockIs('event')) {
    if (boss && !boss.fin && now < boss.t1) h += '<button class="ldo-row" ' + A + '="ev_goboss">' + ldoArt('evc_6', 'ldo-ri') + '<span><b>團結關:' + ldoEsc(EV_CFG.bossName) + '</b><small>剩 ' + ldoDur(boss.t1 - now) + '・打掉 ' + Math.round(boss.dmg * 100) + '%' + (ldoBossReady(now) ? '・本時段可出戰' : '') + '</small></span></button>';
    else { nx = evNextStart(now, 'boss'); h += '<div class="ldo-row off">' + ldoArt('evc_6', 'ldo-ri') + '<span><b>團結關</b><small>' + (boss && boss.fin ? '本次已結束・' : '') + (nx ? '下次 ' + ldoMD(nx.t0) + '(' + ldoDur(nx.t0 - now) + '後)' : '') + '</small></span></div>'; }
    h += '<div class="ldo-row off">' + ldoArt('evi_medal', 'ldo-ri') + '<span><b>寶地採集</b><small>' + (tr ? '進行中,剩 ' + ldoDur(tr.t1 - now) + ':每次刷新有 ' + EV_CFG.treasureCount + ' 個金邊資源點,駐守產量 ×' + EV_CFG.treasureYieldMul + '、每 6 小時另得碎片 ' + EV_CFG.treasureShard : (function () { var n2 = evNextStart(now, 'treasure'); return n2 ? '下次 ' + ldoMD(n2.t0) + '(' + ldoDur(n2.t0 - now) + '後)' : ''; })()) + '</small></span></div>';
    h += '</div>' + ldoSignHtml(A, now);
  } else h += '<div class="ldo-row off">' + ldoArt('evi_lock', 'ldo-ri') + '<span><b>限時活動</b><small>' + ldoEsc(unlockLockText('event')) + '</small></span></div>' + '</div>';
  return h + '</div>';
}
function ldoQuestHtml(A) {
  var l = evMainList(), h = '<div class="ldo-card"><div class="ldo-ttl">主線 <small>一次一條,點「前往」直接跳過去</small></div>';
  l.forEach(function (q) {
    if (q.skip) return;
    h += '<div class="ldo-q' + (q.done ? ' done' : '') + (q.cur ? ' cur' : '') + '"><span class="n">' + (q.done ? '✓' : q.id) + '</span><span class="t"><b>' + ldoEsc(q.t) + '</b><small>' + ldoEsc(q.text) + (q.n > 1 && !q.done ? '(' + q.have + '/' + q.n + ')' : '') + '</small></span>' + (q.cur ? '<button class="ldo-b" ' + A + '="ev_qgo">前往</button>' : '') + '</div>';
  });
  return h + '</div>';
}
function ldoSelInit() {
  var teams = ldoTeams(), ord = evRead().auto.order, sel = [];
  if (LDO.sel) { sel = LDO.sel.filter(function (n) { return teams.some(function (t) { return t.n === n; }); }); if (sel.length) return sel; }
  ord.forEach(function (n) { if (teams.some(function (t) { return t.n === n; }) && sel.indexOf(n) < 0) sel.push(n); });
  if (!sel.length) teams.forEach(function (t) { sel.push(t.n); });
  LDO.sel = sel;
  return sel;
}
function ldoStageText(i) { var g = EV_CFG.bossStageGive[i]; return evGiveText(g); }
function ldoBossHtml(A, now) {
  var b = evBossEnsure(now), h = '', ratio, F, sl, used, ok, teams, o = evRead(now), sel, nx, last = LDO.last;
  if (!b || b.fin || now >= b.t1) {
    nx = evNextStart(now, 'boss');
    h += '<div class="ldo-card"><div class="ldo-ttl">團結關</div><div class="ldo-sm">' + (b && b.fin ? (b.got.kill ? '首領已被打倒,獎勵已發。' : '首領撤退了,已發參與獎。') : '目前沒有團結關。') + (nx ? '下次開打:' + ldoMD(nx.t0) + '(' + ldoDur(nx.t0 - now) + '後)' : '') + '</div></div>';
    return h;
  }
  F = evBossFoes(b);
  ratio = evBossRatio(b);
  sl = evBossSlotNow(b, now);
  used = !!(sl && b.used['S' + sl.i]);
  h += '<div class="ldo-card ldo-boss"><div class="ldo-bimgw">' + ldoArt('ev_boss', 'ldo-bossimg') + '</div><div class="ldo-binfo"><div class="ldo-ttl">' + ldoEsc(EV_CFG.bossName) + ' <small>第 ' + b.run + ' 次</small></div>' +
    '<div class="ldo-hp"><i style="width:' + Math.round(ratio * 100) + '%"></i></div><div class="ldo-sm">剩餘血量 ' + Math.round(ratio * 100) + '%・結束還有 ' + ldoDur(b.t1 - now) + '</div>';
  b.hp.forEach(function (row, j) { h += '<div class="ldo-ft">守軍 ' + (j + 1) + '隊 ' + row.map(function (x) { return '<span class="' + (x > 0 ? 'on' : 'dead') + '" style="--p:' + Math.round(x * 100) + '%"></span>'; }).join('') + '</div>'; });
  h += '<div class="ldo-sm">活動關卡:我方一律滿兵、不損兵、不重傷、不占用卡;怪的血量只減不回。</div></div></div>';
  h += '<div class="ldo-card"><div class="ldo-ttl">本時段 <small>' + (sl ? (sl.ab === 'A' ? '12:00~20:00' : '20:00~隔天 12:00') + (used ? '・已出戰' : '・可出戰 1 次') : '') + '</small></div>';
  teams = ldoTeams(); sel = ldoSelInit();
  if (!teams.length) h += '<div class="ldo-sm">還沒有預設隊伍:到軍營排好隊伍才能出戰。</div>';
  teams.forEach(function (t) {
    var k = sel.indexOf(t.n);
    h += '<button class="ldo-pick' + (k >= 0 ? ' sel' : '') + '" ' + A + '="ev_bsel" data-n="' + t.n + '"><span class="n">' + (k >= 0 ? k + 1 : '') + '</span><b>' + ldoEsc(t.name) + '</b><span class="sp"></span><span>戰力 ' + ldoTeamPower(t) + '</span></button>';
  });
  ok = !used && sel.length > 0;
  h += '<div class="ldo-rowb"><button class="ldo-b" ' + A + '="ev_bgo"' + (ok ? '' : ' disabled') + '>出戰(' + sel.length + ' 隊)</button><button class="ldo-b s' + (o.auto.on ? ' on' : '') + '" ' + A + '="ev_bauto">自動出戰:' + (o.auto.on ? '開' : '關') + '</button></div><div class="ldo-sm">自動出戰:每個時段開始(或你上線時)用當下的隊伍自動打 1 次。</div></div>';
  if (last) h += '<div class="ldo-card"><div class="ldo-ttl">剛才的戰果 <small>打掉 ' + Math.round(last.dmg * 100) + '%</small></div>' + last.rows.map(function (r) { return '<div class="ldo-sm">' + ldoEsc(r.name) + ' 打守軍第 ' + (r.foe + 1) + ' 隊:' + Math.round(r.dmg * 1000) / 10 + '%' + (r.win ? '(擊倒)' : '') + '</div>'; }).join('') + last.got.map(function (g) { return '<div class="ldo-gt">' + ldoEsc(g) + '</div>'; }).join('') + '</div>';
  h += '<div class="ldo-card"><div class="ldo-ttl">獎勵</div>';
  EV_CFG.bossStage.forEach(function (th, i) { h += '<div class="ldo-q' + (b.got['s' + Math.round(th * 100)] ? ' done' : '') + '"><span class="n">' + Math.round(th * 100) + '%</span><span class="t"><b>' + ldoEsc(ldoStageText(i)) + '</b></span></div>'; });
  h += '<div class="ldo-q' + (b.got.kill ? ' done' : '') + '"><span class="n">擊殺</span><span class="t"><b>' + ldoEsc(evGiveText(EV_CFG.bossKill)) + '</b><small>最後一刀另得 玄鐵 / 玄龜甲 / 精魄 三選一</small></span></div>';
  h += '<div class="ldo-sm">沒打死:首領撤退,已拿的不收回,另發參與獎(擊殺獎 × 打掉比例 × 0.5)。</div></div>';
  return h;
}

// ═════════ 四、動作(兩種環境共用:ctx = 'ld' 堆疊頁 / 'wd' 地圖面板)═════════
function ldoRun(a, el, ctx, redraw) {
  var d, r, cs, sel, i, b;
  if (a === 'ev_nbclaim') {
    r = evNbClaim(+el.getAttribute('data-d'));
    ldoToast(r.ok ? '領取:' + r.text + (r.pick ? '(請選 1 張紫名人)' : '') : '無法領取');
  } else if (a === 'ev_nbpick') {
    r = evNbPick(el.getAttribute('data-f'));
    ldoToast(r.ok ? '獲得 ' + r.name : (r.reason === 'full' ? '名冊已滿,先分解' : '無法選取'));
  } else if (a === 'ev_signclaim') {
    r = evSignClaim(+el.getAttribute('data-d'), Date.now());
    ldoToast(r.ok ? '簽到:' + r.text : '無法簽到');
  } else if (a === 'ev_bsel') {
    sel = ldoSelInit(); i = sel.indexOf(+el.getAttribute('data-n'));
    if (i >= 0) sel.splice(i, 1); else sel.push(+el.getAttribute('data-n'));
    LDO.sel = sel;
  } else if (a === 'ev_bgo') {
    cs = ldoCs();
    r = evBossFight(cs, ldoSelInit(), Date.now(), {});
    if (r.ok) { LDO.last = r; ldoToast('團結關:打掉 ' + Math.round(r.dmg * 100) + '%' + (r.killed ? ',擊殺!' : '')); }
    else ldoToast({ used: '這個時段已經出戰過了', noboss: '目前沒有團結關', noteam: '請先選隊伍', noslot: '現在不在時段內', nocards: '尚無卡片資料' }[r.reason] || '無法出戰');
  } else if (a === 'ev_bauto') {
    d = evRead(); evBossSetAuto(!d.auto.on, ldoSelInit());
    ldoToast(!d.auto.on ? '自動出戰:開(依目前選的隊伍順序)' : '自動出戰:關');
  } else if (a === 'ev_qgo') { ldoMainGo(evMainCur()); return; }
  else if (a === 'ev_gonb') { if (typeof ldNavPush === 'function') ldNavPush('nb'); return; }
  else if (a === 'ev_goboss') {
    if (ctx === 'wd' && typeof wdUiPush === 'function') { wdUiPush({ v: 'evboss' }); return; }
    if (typeof ldNavPush === 'function') ldNavPush('boss');
    return;
  }
  if (typeof redraw === 'function') redraw();
}
function ldoBind(box, ctx, redraw) {
  box.addEventListener('click', function (ev) {
    var t = ev && ev.target, b = t && t.closest ? t.closest('[data-ldo]') : null;
    if (!b || b.disabled) return;
    ldoRun(b.getAttribute('data-ldo'), b, ctx, redraw);
  });
}
// 堆疊頁掛載:htmlFn(A, now) → HTML;點擊委派
function ldoMount(el, key, htmlFn) {
  var box = ldoEl('div', 'ldo ldo-page'), draw;
  draw = function () { box.innerHTML = htmlFn('data-ldo', Date.now()); };
  ldoBind(box, 'ld', draw);
  el.appendChild(box);
  LDO.draws[key] = draw;
  draw();
}
function ldoOnShow(key) { return function () { if (LDO.draws[key]) LDO.draws[key](); }; }

// ═════════ 五、地圖(wd_ui.js)掛點 ═════════
function ldoWdOn() { return ldoOn() && typeof WDUI !== 'undefined'; }
// 沒開 mapFull 前:只看得到新手寨,強制停在「中立」
function ldoWdForce() {
  if (!ldoWdOn() || unlockIs('mapFull')) return;
  WDUI.cat = 'mid'; WDUI.sub = '全部';
}
function ldoWdTabOk(name) {
  if (!ldoWdOn()) return true;
  if (name === 'res') return unlockIs('mapFull');
  return true;
}
function ldoWdSubOk(name) {
  if (!ldoWdOn()) return true;
  if (!unlockIs('mapFull')) return false;
  if (name === '野怪') return unlockIs('beast');
  if (name === '山寨') return unlockIs('camp');
  if (name === '縣郡') return unlockIs('county');
  if (name === '關口') return unlockIs('junpass');
  return true;
}
function ldoWdAutoOk() { return !ldoWdOn() || unlockIs('auto'); }
function ldoWdVisible(W, list, cat, sub) {
  if (!ldoWdOn()) return list;
  if (!unlockIs('mapFull')) return list.filter(function (p) { return p.tut; });
  return list.filter(function (p) {
    if (p.tut) return true;
    if (p.cat === 'camp') return unlockIs('camp');
    if (p.cat === 'beast') return unlockIs('beast');
    if (p.cat === 'county') return unlockIs('county');
    if (p.cat === 'jun' || p.cat === 'pass') return unlockIs('junpass');
    return true;
  });
}
function ldoWdBossCard(now) {
  var b;
  if (!ldoWdOn() || !unlockIs('event') || !unlockIs('beast')) return '';
  b = evBossEnsure(now);
  if (!b || b.fin || now >= b.t1) return '';
  return '<button class="wd-pt beast act ldo-bosscard" data-wd="ev_goboss"><h4><span>' + ldoEsc(EV_CFG.bossName) + '</span><i>活動</i></h4><div class="wd-sm">團結關・剩餘血量 ' + Math.round(evBossRatio(b) * 100) + '%・剩 ' + ldoDur(b.t1 - now) + '</div><div class="wd-st">' + (ldoBossReady(now) ? '本時段可出戰' : '本時段已出戰') + '</div></button>';
}
// 集結頁的預約時段列 + 確認表(top.tFight = 選的開打時刻,0 = 立即)
function ldoWdRsvRow(top, W, now) {
  var pt = wdPt(W, top.id), times, h = '', sel = top.sel || [], n, cur = top.tFight || 0, teams;
  if (!ldoWdOn() || !unlockIs('rsv') || !top.multi || !pt || typeof wdRsvTimes !== 'function' || !WD_RSV_CATS[pt.cat]) return '';
  times = wdRsvTimes(now, pt);
  n = (W.rsv || []).length;
  h += '<div class="ldo-card"><div class="ldo-ttl">開打時間 <small>預約 ' + n + '/' + EV_CFG.rsvMax + '・出發後才鎖人</small></div><div class="ldo-rowb"><button class="ldo-b s' + (!cur ? ' on' : '') + '" data-wd="ev_rtime" data-t="0">立即</button>';
  times.forEach(function (x) { h += '<button class="ldo-b s' + (cur === x.t ? ' on' : '') + '" data-wd="ev_rtime" data-t="' + x.t + '">' + ldoEsc(x.label) + '</button>'; });
  h += '</div>';
  if (cur) {
    teams = wdTeams();
    h += '<div class="ldo-sm">確認:</div>';
    sel.forEach(function (tn) {
      var t = null, i; for (i = 0; i < teams.length; i++) if (teams[i].n === tn) t = teams[i];
      h += '<div class="ldo-sm">' + ldoEsc(t ? t.name : '第 ' + tn + ' 隊') + ':出發 ' + ldoHM(cur - pt.mins * WD_CFG.MIN) + ' → 開打 ' + ldoHM(cur) + ' → 回城 ' + ldoHM(cur + wdRsvBackMs(pt)) + '</div>';
    });
    if (!sel.length) h += '<div class="wd-red">請先勾選隊伍</div>';
  }
  return h + '</div>';
}
function ldoWdPtRsv(W, pt, now) {
  var h = '', list, rl;
  if (!ldoWdOn() || !pt) return '';
  list = (W.rsv || []).filter(function (r) { return r.pt === pt.id; });
  list.forEach(function (r) { h += '<div class="ldo-card">' + ldoArt('evi_clock', 'ldo-ri') + ' 預約 ' + ldoMD(r.tFight) + '(' + r.order.length + ' 隊,' + ldoMD(r.tGo) + ' 出發)<button class="ldo-b s" data-wd="ev_rcancel" data-id="' + ldoEsc(r.id) + '">取消預約</button></div>'; });
  (W.rallies || []).filter(function (x) { return x.pt === pt.id && now < x.tArrive; }).forEach(function (x) { h += '<div class="ldo-card">集結行進中,' + ldoDur(x.tArrive - now) + '後開打<button class="ldo-b s" data-wd="ev_recall" data-id="' + ldoEsc(x.id) + '">撤回</button><div class="ldo-sm">撤回:整批回城,回程 = 已走時間 × 1/4,本次作廢。</div></div>'; });
  return h;
}
// 地圖面板的預約結果紀錄(最近 10 筆)
function ldoWdRsvLog(W) {
  if (!ldoWdOn() || !W.rsvLog || !W.rsvLog.length) return '';
  return '<div class="ldo-card"><div class="ldo-ttl">預約紀錄</div>' + W.rsvLog.slice(0, 5).map(function (x) { return '<div class="ldo-sm">' + ldoMD(x.t) + ' ' + ldoEsc(x.msg) + '</div>'; }).join('') + '</div>';
}
function ldoWdAct(a, b) {
  var top, W, cs, r, now = Date.now(), id, pt, teams;
  if (!ldoWdOn()) return false;
  top = wdUiTop(); W = WDUI.W; cs = WDUI.cs;
  id = b.getAttribute('data-id');
  if (a === 'ev_rtime') { if (top) top.tFight = +b.getAttribute('data-t') || 0; wdUiRender(); return true; }
  if (a === 'ev_rcancel') { wdRsvCancel(W, id); wdUiToast('預約已取消'); wdUiSave(); wdUiRender(); return true; }
  if (a === 'ev_recall') { r = wdRecall(W, cs, id, now); wdUiToast(r.ok ? '已撤回,整批回城' : '來不及撤回'); wdUiSave(); wdUiRender(); return true; }
  ldoRun(a, b, 'wd', wdUiRender);
  return true;
}
// 集結頁按「出發」且選了預約時段:改建預約(回 true = 已處理)
function ldoWdRsvSend(top) {
  var now = Date.now(), teams, r, pt;
  if (!ldoWdOn() || !top || !top.multi || !top.tFight) return false;
  teams = top.sel.map(function (n) { return wdUiTeamByN(n); }).filter(Boolean);
  pt = wdPt(WDUI.W, top.id);
  r = wdRsvAdd(WDUI.W, WDUI.cs, teams, top.id, top.tFight, now);
  if (!r.ok) { wdUiToast((WD_RSV_REASON[r.reason] || '無法預約') + (r.team ? '(第 ' + r.team + ' 隊)' : '')); return true; }
  wdUiToast('已預約 ' + ldoMD(top.tFight) + ' 集結 → ' + (pt ? pt.ty : '') + '(' + teams.length + ' 隊)');
  WDUI.stack = [];
  wdUiSave();
  wdUiRender();
  return true;
}
function ldoWdBossHtml(now) { return ldoBossHtml('data-wd', now); }

// ═════════ 六、掛上去 ═════════
function ldoInstall() {
  if (typeof ldHomeRefresh === 'function' && typeof ldoOrigHomeRefresh === 'undefined') { ldoOrigHomeRefresh = ldHomeRefresh; ldHomeRefresh = ldoHomeRefresh; }
  if (typeof ldHomeBldDo === 'function' && typeof ldoOrigHomeBldDo === 'undefined') { ldoOrigHomeBldDo = ldHomeBldDo; ldHomeBldDo = ldoHomeBldDo; }
  if (typeof shellAct === 'function' && typeof ldoOrigShellAct === 'undefined') { ldoOrigShellAct = shellAct; shellAct = ldoShellAct; }
  if (typeof ldNavRegister === 'function') {
    ldNavRegister({ id: 'event', title: '活動', build: function (el, ctx) {
      ldoMount(el, 'event', function (A, now) { return ldoOn() ? ldoEventHtml(A, now) : ''; });
      if (typeof ldHomeEventBuild === 'function') ldHomeEventBuild(el, ctx);   // 活動頁基本列(擂台、免費抽、切磋)留在後面;S0 起 event / quest 只在本檔登錄
    }, onShow: ldoOnShow('event') });
    ldNavRegister({ id: 'quest', title: '主線任務', build: function (el) { ldoMount(el, 'quest', function (A) { return ldoOn() ? ldoQuestHtml(A) : '<div class="ldp-empty">任務系統準備中</div>'; }); }, onShow: ldoOnShow('quest') });
    ldNavRegister({ id: 'nb', title: '新手七日', build: function (el) { ldoMount(el, 'nb', function (A) { return ldoNbHtml(A); }); }, onShow: ldoOnShow('nb') });
    ldNavRegister({ id: 'boss', title: '團結關', bg: 'ev_group_bg', build: function (el) { ldoMount(el, 'boss', function (A, now) { return ldoBossHtml(A, now); }); }, onShow: ldoOnShow('boss') });
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', function () { if (!document.hidden) LDO.t = 0; });
}
ldoInstall();
