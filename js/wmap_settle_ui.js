// js/wmap_settle_ui.js — M1 W5 抵達快報條(V7)/ 戰報頁 / 放棄領地 / 領地每分入帳接線(設計_M1視覺原型_實作計畫.md W5;核心在 js/wmap_settle.js,純函式)。
// 做什麼:wmap_go_ui.js 每秒 tick 與事件入帳時呼叫本檔 → wmapSettleUiSync(wdRun 之後對帳:占領 / 名額 / 占領獎勵 / 放棄結束 / 每整分產出)→ 入帳(糧 res4Add、白材 matGrant)→ 有變動才存檔 → 頂列數字重算(shellRefresh)。
//       抵達結算(戰鬥 / 戰報 / 傷亡 / 回程)全是既有 wdRun;本檔只負責「結果呈現」:地圖上方快報條(勝 / 敗 + 掉落 / 產出,幾秒後自動收,點開戰報頁;預設只看結果,想看戰鬥在戰報頁點〔重播〕)、領地卡的〔放棄〕/〔取消放棄〕、離線摘要。
// 地圖上不加任何文字徽章(使用者要求);紅框 = WMAP.own(wmap_go_ui 的 wmapGoUiSyncOwn,只換 overlay 節點,不重烘分塊)。
// ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:wmap_go_ui.js 之後。全域名一律 wmapSettleUi* / WMAPSET。
//
// ───────── 公開 API ─────────
//   wmapSettleUiInit(root)            建快報條節點(wmapGoUiInit 呼叫);重複呼叫無害
//   wmapSettleUiSync() → r|null       對帳 + 入帳 + 存檔 + 頂列重算;r = wmapSettleSync 結果 + applied;時鐘倒退 / 沒有存檔狀態回 null
//   wmapSettleUiTick()                每秒:Sync + 放棄結束提示 + 放棄倒數卡文字更新
//   wmapSettleUiReports(evs, quiet)   把地圖格的 report 事件變成快報條(quiet = 開檔 / 離線追趕,不跳條)
//   wmapSettleUiFlash(brief)          顯示一則快報(佇列,最多 5 則;每則 5 秒,點開戰報頁)
//   wmapSettleUiCardInfo(gi, W, now) → {sub, btns}     已占領格的資訊卡內容(每小時產出 / 放棄倒數 + 〔放棄〕/〔取消放棄〕)
//   wmapSettleUiCapWarn(W, cs) → ''|'・占領名額已滿 …'   出發前提醒
//   wmapSettleUiQuit(gi, cancel)      放棄 / 取消放棄
//   wmapSettleUiBootText() → ''|'・占領 …'              開檔第一次對帳的離線摘要
//   ldNav 頁 'wmgrp'(戰報):ctx.id = 戰報 id → 詳情(逐隊結果 / 掉落 / 占領獎勵 / 〔重播〕);沒有 id → 近期戰報清單

var WMAPSET = { inited: false, flash: null, queue: [], cur: null, ftid: 0, first: true, boot: null, cardOwn: -1 };
var WMAPSET_FLASH_MS = 5000, WMAPSET_QMAX = 5;

function wmapSettleUiEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
function wmapSettleUiSize() { return (typeof WMAP !== 'undefined' && WMAP.WG) ? WMAP.WG.size : 64; }

// ───────── 對帳 / 入帳 ─────────
function wmapSettleUiSync() {
  var c = typeof wmapGoUiCtx === 'function' ? wmapGoUiCtx() : null, now, r, got, i, q;
  if (!c || typeof wmapSettleSync !== 'function') return null;
  now = ldNow();
  if (wmapGoClock(c.W, now).frozen) return null;
  r = wmapSettleSync(c.W, c.cs, now);
  got = wmapSettleApply(r.credit);
  r.applied = got;
  if (WMAPSET.first) { WMAPSET.first = false; WMAPSET.boot = r; }
  else for (i = 0; i < r.quit.length; i++) { q = r.quit[i]; wmapGoUiToast('放棄完成:' + wmapSettleCoord(q.gi, wmapSettleUiSize()) + ' Lv' + q.lv + ' ' + q.ty); }
  if (r.changed || wmapSettleHasAny(got)) wmapGoUiSave();
  if (wmapSettleHasAny(got) && typeof shellRefresh === 'function') { try { shellRefresh(); } catch (e) { /* 顯示用 */ } }   // 頂列(糧 / 領地)跟著跳
  return r;
}
function wmapSettleUiTick() {
  var c = typeof wmapGoUiCtx === 'function' ? wmapGoUiCtx() : null, gi, st, info, s;
  wmapSettleUiSync();
  if (!c || !WMAPSET.inited) return;
  gi = typeof WMAPGO !== 'undefined' ? WMAPGO.cardGi : -1;
  if (gi >= 0 && WMAPGO.card && !WMAPGO.card.hidden && WMAPSET.cardOwn === gi) {   // 放棄倒數:只換文字;釋放後卡片收起
    st = wmapSettleStatus(c.W, gi, ldNow());
    if (!st.own) { WMAPSET.cardOwn = -1; if (typeof wmapSelect === 'function') wmapSelect(-1); wmapGoUiCardHide(); return; }
    info = wmapSettleUiCardInfo(gi, c.W, ldNow());
    s = WMAPGO.card.querySelector('.wgc-s');
    if (s && info && s.textContent !== info.sub) s.textContent = info.sub;
  }
}
function wmapSettleUiBootText() {
  var b = WMAPSET.boot, p = [];
  if (!b) return '';
  if (b.occ.length) p.push('占領 ' + b.occ.length + ' 塊');
  if (b.rej.length) p.push('名額已滿未占領 ' + b.rej.length + ' 塊');
  if (b.quit.length) p.push('放棄完成 ' + b.quit.length + ' 塊');
  if (b.applied && wmapSettleHasAny(b.applied)) p.push('領地入帳 ' + wmapSettleText(b.applied));
  return p.length ? '・' + p.join('・') : '';
}

// ───────── 領地卡(放棄)─────────
function wmapSettleUiRateTxt(rate) {
  if (!rate) return '';
  return rate.perHour >= 1 ? '每小時 ' + rate.outName + ' +' + (Math.round(rate.perHour * 10) / 10) : '每天 ' + rate.outName + ' +' + (Math.round(rate.perHour * 24 * 10) / 10);
}
function wmapSettleUiCardInfo(gi, W, now) {
  var st = wmapSettleStatus(W, gi, now), cap, used, sub, btns;
  if (!st.own) return { sub: '已占領', btns: '' };
  used = Object.keys(W.g2.own).length;
  cap = wmapSettleCap(W, typeof WDUI !== 'undefined' ? WDUI.cs : null);
  WMAPSET.cardOwn = gi;
  if (st.quit) {
    sub = '放棄中・剩 ' + wmapGoUiDur(st.qLeft) + '(期間仍占名額、照常產出)';
    btns = '<button type="button" class="wgc-b pri" data-wgo="unquit">取消放棄</button>';
  } else {
    sub = '我的領地・' + wmapSettleUiRateTxt(st.rate) + '・名額 ' + used + '/' + cap;
    btns = '<button type="button" class="wgc-b warn" data-wgo="quit">放棄</button>';
  }
  return { sub: sub, btns: btns };
}
function wmapSettleUiCapWarn(W, cs) {
  var used = Object.keys(wmapSettleG2(W).own).length, cap = wmapSettleCap(W, cs);
  return used >= cap ? '・占領名額已滿 ' + used + '/' + cap + ',打贏也不會占領' : '';
}
function wmapSettleUiQuit(gi, cancel) {
  var c = wmapGoUiCtx(), r, now = ldNow();
  if (!c) return false;
  wmapSettleUiSync();
  r = cancel ? wmapSettleQuitCancel(c.W, gi) : wmapSettleQuit(c.W, gi, now);
  if (!r.ok) { wmapGoUiToast(r.err === 'notown' ? '這塊已不是你的領地' : (r.err === 'quitting' ? '已在放棄倒數中' : '沒有在放棄')); return false; }
  wmapGoUiSave();
  wmapGoUiToast(cancel ? '取消放棄' : '開始放棄:5 分鐘後釋放(期間仍占名額、照常產出)');
  if (typeof wmapSelect === 'function' && typeof WMAP !== 'undefined' && WMAP.sel === gi && typeof wmapGoTarget === 'function') {
    var tg = wmapGoTarget(WMAP.WG, gi, wmapGoUiInfo(gi));
    if (tg.ok) wmapGoUiCardShow(tg);
  }
  return true;
}

// ───────── 快報條 ─────────
function wmapSettleUiInit(root) {
  if (WMAPSET.inited || typeof document === 'undefined' || !root) return false;
  WMAPSET.flash = wmapSettleUiEl('div', 'wmapgo-flash');
  WMAPSET.flash.hidden = true;
  WMAPSET.flash.setAttribute('role', 'status');
  root.appendChild(WMAPSET.flash);
  WMAPSET.flash.addEventListener('click', function (ev) {
    var t = ev.target, cur = WMAPSET.cur;
    if (t && t.getAttribute && t.getAttribute('data-wgf') === 'x') { wmapSettleUiFlashNext(); return; }
    if (cur && typeof ldNavPush === 'function') { var id = cur.id; wmapSettleUiFlashNext(true); ldNavPush('wmgrp', { id: id }); }
  });
  ['pointerdown', 'pointerup'].forEach(function (ev) { WMAPSET.flash.addEventListener(ev, function (x) { x.stopPropagation(); }); });
  WMAPSET.inited = true;
  return true;
}
function wmapSettleUiFlashShow() {
  var f = WMAPSET.flash, b = WMAPSET.cur, i, x, more;
  if (!f || !b) return;
  f.innerHTML = '';
  f.className = 'wmapgo-flash ' + b.tone;
  f.appendChild(wmapSettleUiEl('div', 'wgf-t', b.head + '・' + b.title));
  for (i = 0; i < b.lines.length && i < 3; i++) f.appendChild(wmapSettleUiEl('div', 'wgf-s', b.lines[i]));
  more = WMAPSET.queue.length;
  f.appendChild(wmapSettleUiEl('div', 'wgf-h', '點開看戰報' + (more ? '(還有 ' + more + ' 則)' : '')));
  x = wmapSettleUiEl('button', 'wgf-x', '×'); x.setAttribute('type', 'button'); x.setAttribute('data-wgf', 'x'); x.setAttribute('aria-label', '關閉');
  f.appendChild(x);
  f.hidden = false;
  if (WMAPSET.ftid) clearTimeout(WMAPSET.ftid);
  WMAPSET.ftid = setTimeout(function () { wmapSettleUiFlashNext(); }, WMAPSET_FLASH_MS);
}
function wmapSettleUiFlashNext(drop) {
  if (WMAPSET.ftid) { clearTimeout(WMAPSET.ftid); WMAPSET.ftid = 0; }
  if (drop) WMAPSET.queue = [];
  WMAPSET.cur = WMAPSET.queue.shift() || null;
  if (WMAPSET.cur) wmapSettleUiFlashShow();
  else if (WMAPSET.flash) WMAPSET.flash.hidden = true;
}
function wmapSettleUiFlash(brief) {
  if (!WMAPSET.flash || !brief) return;
  if (WMAPSET.cur) { WMAPSET.queue.push(brief); if (WMAPSET.queue.length > WMAPSET_QMAX) WMAPSET.queue.shift(); wmapSettleUiFlashShow(); return; }
  WMAPSET.cur = brief;
  wmapSettleUiFlashShow();
}
function wmapSettleUiReports(evs, quiet) {
  var c = wmapGoUiCtx(), i, rp, j, b;
  if (quiet || !c) return;
  for (i = 0; i < evs.length; i++) {
    rp = null;
    for (j = 0; j < c.W.rp.length; j++) if (c.W.rp[j].id === evs[i].rp) { rp = c.W.rp[j]; break; }
    if (!rp) continue;
    b = wmapSettleBrief(c.W, rp, { size: wmapSettleUiSize() });
    if (evs[i].unlocked && evs[i].unlocked.length) b.lines.push('名聲開放:' + evs[i].unlocked.join('、'));
    wmapSettleUiFlash(b);
  }
}

// ───────── 戰報頁 ─────────
function wmapSettleUiEsc(s) { return typeof wdUiEsc === 'function' ? wdUiEsc(s) : String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
function wmapSettleUiHM(ms) { var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
function wmapSettleUiRpOf(W, id) { var i; for (i = 0; i < W.rp.length; i++) if (W.rp[i].id === id) return W.rp[i]; return null; }
function wmapSettleUiRecOk(W, idx) { var rec = idx && typeof wdRecOf === 'function' ? wdRecOf(W, idx) : null; return !!rec && typeof BN_REC_VER !== 'undefined' && rec.v === BN_REC_VER; }
function wmapSettleUiRptTitle(rp, size) {
  var gi = wmapSettleIsPtId(rp.pt) ? +rp.pt.slice(1) : (rp.cat === 'yg' && typeof wmapMobParse === 'function' && wmapMobParse(rp.pt) ? wmapMobParse(rp.pt).gi : -1);
  return (gi >= 0 ? wmapSettleCoord(gi, size) + ' ' : '') + (rp.cat === 'res' || rp.cat === 'yg' ? 'Lv' + rp.lv + ' ' : '') + rp.ptName + (rp.kind === 'rally' ? '(集結)' : '');
}
function wmapSettleUiDetailHtml(W, rp) {
  var size = wmapSettleUiSize(), b = wmapSettleBrief(W, rp, { size: size }), h = '', i, r, txt, lt;
  h += '<div class="wgr-card ' + b.tone + '"><div class="wgr-t">' + wmapSettleUiEsc(wmapSettleUiRptTitle(rp, size)) + '</div><div class="wgr-h">' + wmapSettleUiEsc(b.head) + '</div><div class="wgr-s">' + wmapSettleUiHM(rp.t) + '</div></div>';
  for (i = 0; i < rp.rows.length; i++) {
    r = rp.rows[i];
    if (r.skipped) txt = '守軍已被前面的隊打光,未出手';
    else txt = '打守軍第 ' + (r.foe + 1) + ' 隊 ' + r.rounds + ' 回合,削血 ' + Math.round(r.dmg * 100) + '%,損兵 ' + Math.round(r.loss * 100) + '%' + (r.wiped ? '(全滅,重傷 15 分鐘)' : '') + (r.last ? ' ★最後一刀' : '');
    h += '<div class="wgr-row"><b>' + wmapSettleUiEsc(r.name || ('隊' + r.team)) + '</b><span class="wgr-sp">' + wmapSettleUiEsc(txt) + '</span>' +
      (!r.skipped ? (wmapSettleUiRecOk(W, r.recIdx) ? (typeof bnRptBuild === 'function' ? '<button type="button" class="wgr-b" data-wgr="det" data-i="' + r.recIdx + '" aria-expanded="false">武將明細</button>' : '') + '<button type="button" class="wgr-b" data-wgr="replay" data-i="' + r.recIdx + '">重播</button>' : '<span class="wgr-n">只剩文字結果</span>') : '') + '</div>' +
      (!r.skipped && wmapSettleUiRecOk(W, r.recIdx) ? '<div class="wgr-det" data-di="' + r.recIdx + '" hidden></div>' : '');
  }
  if (rp.occ && wmapSettleHasAny(rp.occ)) h += '<div class="wgr-card">占領獎勵 ' + wmapSettleUiEsc(wmapSettleText(rp.occ)) + '(3 小時產量,之後每分鐘自動入帳)</div>';
  if (rp.ml && typeof wmapSettleText === 'function') h += '<div class="wgr-card">掉落 ' + wmapSettleUiEsc(wmapSettleText(rp.ml)) + '</div>';
  lt = wmapSettleLootTxt(rp.loot);
  if (lt) h += '<div class="wgr-card">掉落 ' + wmapSettleUiEsc(lt) + '</div>';
  if (rp.win && rp.fame > 0) h += '<div class="wgr-card">名聲 +' + rp.fame + '</div>';
  if (rp.noocc) h += '<div class="wgr-card mid">占領名額已滿 ' + rp.noocc.used + '/' + rp.noocc.cap + ':戰鬥獎勵照給、這格沒有占領。先放棄別格,再派隊來接收。</div>';
  return h + '<div class="wgr-n">預設只看結果;想看戰鬥點〔重播〕(戰報只存雙方快照 + 亂數種子,重播時重算,最近 ' + (typeof WD_CFG !== 'undefined' ? WD_CFG.rcMax : 20) + ' 場)。</div>';
}
function wmapSettleUiListHtml(W) {
  var size = wmapSettleUiSize(), h = '', i, rp;
  if (!W.rp.length) return '<div class="wgr-card">還沒有戰報。</div>';
  for (i = 0; i < W.rp.length && i < 30; i++) {
    rp = W.rp[i];
    h += '<button type="button" class="wgr-li" data-wgr="open" data-id="' + wmapSettleUiEsc(rp.id) + '"><b>' + wmapSettleUiEsc(wmapSettleUiRptTitle(rp, size)) + '</b><span class="wgr-sp"></span><span class="wgr-s">' + wmapSettleUiHM(rp.t) + '</span> <b class="' + (rp.win ? 'okc' : 'ngc') + '">' + (rp.win ? '勝' : '敗') + '</b></button>';
  }
  return h;
}
// 武將明細(與戰鬥結算戰報共用 bnreport.js 的明細元件):點〔武將明細〕才重算該場並展開;再點收合;面板內點武將卡展開各戰法
function wmapSettleUiDetail(el, idx, btn) {
  var c = typeof wmapGoUiCtx === 'function' ? wmapGoUiCtx() : null, box = el.querySelector('.wgr-det[data-di="' + idx + '"]'), rec, open;
  if (!box || !c) return;
  open = box.hidden;
  if (open && !box.firstChild) {
    rec = typeof wdRecOf === 'function' ? wdRecOf(c.W, idx) : null;
    if (!rec || typeof bnRptBuild !== 'function') return;
    box.innerHTML = bnRptPanelHtml(bnRptBuild(rec, 'A'));
  }
  box.hidden = !open;
  if (btn && btn.setAttribute) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
// 重播:戰鬥舞台 → 戰報的〔離開〕後直接回地圖(把堆疊裡連續的戰報頁關掉),不停在戰報頁(W6)
function wmapSettleUiReplay(idx) {
  var c = typeof wmapGoUiCtx === 'function' ? wmapGoUiCtx() : null, rec = c && typeof wdRecOf === 'function' ? wdRecOf(c.W, idx | 0) : null;
  if (rec && typeof BN_REC_VER !== 'undefined' && rec.v === BN_REC_VER && typeof bnBattleShow === 'function') {
    bnBattleShow(rec, { mode: 'report', mySide: 'A', onLeave: function () { var n = 0; while (typeof ldNavTop === 'function' && ldNavTop() === 'wmgrp' && n++ < 6) ldNavBack(); } });
  } else if (typeof wdUiReplay === 'function') wdUiReplay(idx);
}
function wmapSettleUiPageRender(el, ctx) {
  var c = typeof wmapGoUiCtx === 'function' ? wmapGoUiCtx() : null, rp;
  if (el.classList) el.classList.add('wgr');
  el.innerHTML = '';
  if (!c) { el.appendChild(wmapSettleUiEl('div', 'wgr-card', '戰報尚未就緒')); return; }
  rp = ctx && ctx.id ? wmapSettleUiRpOf(c.W, ctx.id) : null;
  el.innerHTML = rp ? wmapSettleUiDetailHtml(c.W, rp) : (ctx && ctx.id ? '<div class="wgr-card">找不到這份戰報(太舊已被清掉)。</div>' : wmapSettleUiListHtml(c.W));
  if (!el.__wgrBound) {
    el.__wgrBound = true;
    el.addEventListener('click', function (ev) {
      var t = ev.target, a, tg = t && t.closest ? t.closest('[data-act="tg"]') : null;
      if (tg && el.contains(tg) && typeof bnRptDetailToggle === 'function') { bnRptDetailToggle(tg); return; }
      while (t && t !== el && !(t.getAttribute && t.getAttribute('data-wgr'))) t = t.parentNode;
      if (!t || t === el) return;
      a = t.getAttribute('data-wgr');
      if (a === 'open' && typeof ldNavPush === 'function') { ldNavPush('wmgrp', { id: t.getAttribute('data-id') }); return; }
      if (a === 'det') { wmapSettleUiDetail(el, +t.getAttribute('data-i'), t); return; }
      if (a === 'replay') wmapSettleUiReplay(+t.getAttribute('data-i'));
    });
  }
}
if (typeof ldNavRegister === 'function') {
  ldNavRegister({
    id: 'wmgrp', title: '戰報',
    build: function (el, ctx) { wmapSettleUiPageRender(el, ctx || {}); },
    onShow: function (el, ctx) { wmapSettleUiPageRender(el, ctx || {}); }
  });
}
