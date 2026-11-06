// js/cardsreveal.js — 抽卡特效(一批卡開獎演出)。樣式在 css/cardsreveal.css。
// 入口:cardsRevealPlay(cards, onDone) — cards 為本批卡陣列(gr 0白/1青/2藍/3紫/4金);動畫結束(按「收下」)或玩家按「略過」時呼叫 onDone(只一次)。
// 排程:階段1 白青藍快速翻開(≤0.6s)→ 階段2 紫階逐張(中央放大旋轉+紫光,再飛向格子)→ 階段3 金階逐張(滿版金光+粒子)→ 終局:紫金 ≥4 張時最後 4 張同時開。
// 無紫金:只做快速翻牌。點一下 = 跳到下一小步並進入加速;略過 = 直接顯示最終排列並呼叫 onDone;結尾停在最終排列頁等「收下」。
// 全域名稱:cardsRevealPlay cardsRevealPlan cardsRevealActive cardsRevealLog。依賴(皆 typeof 守衛):cardart.js 美術卡(整批邊框 / 背景 / 卡背都已載入才用,root 加 .art;否則原畫法)、cardsui.js 頭像函式、carddata.js 職業、audio.js auPlay、perf.js isPowerSave。ES2017;只用 transform/opacity 動畫。
var RV_FIN_MAX = 4;                      // 終局合開最多張數
var RV_MS = { flip: 600, p: 1200, g: 1800, fin: 2000, ps: 0.5, fast: 0.4 };
var rvS = null;                          // 目前演出狀態(同時只有一場)
var rvLastLog = [];

function rvEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
function rvPower() {
  try {
    if (typeof isPowerSave === 'function' && isPowerSave()) return true;
    if (typeof uiPowerSave !== 'undefined' && uiPowerSave) return true;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { /* 偵測失敗當一般模式 */ }
  return false;
}
function rvSnd(name) { try { if (typeof auPlay === 'function') auPlay(name); } catch (e) { /* 音效失敗靜默 */ } }

// 純函式:排程。回 { normal:[idx], indiv:[idx], fin:[idx], stages:[{k,idx,gr,ms}] }。紫先於金(同階依原順序);紫金 ≥4 張時最後 4 張留給終局合開。
function cardsRevealPlan(cards, power) {
  var k = power ? RV_MS.ps : 1, normal = [], sp = [], i, g, fin, indiv, st = [];
  for (i = 0; i < cards.length; i++) { g = cards[i] && cards[i].gr | 0; if (g >= 3) sp.push(i); else normal.push(i); }
  sp.sort(function (a, b) { return (cards[a].gr | 0) - (cards[b].gr | 0) || a - b; });
  fin = sp.length >= RV_FIN_MAX ? sp.slice(sp.length - RV_FIN_MAX) : [];
  indiv = sp.slice(0, sp.length - fin.length);
  if (normal.length) st.push({ k: 'flip', idx: normal, gr: -1, ms: Math.round(RV_MS.flip * k) });
  indiv.forEach(function (ix) { st.push({ k: 'spot', idx: [ix], gr: cards[ix].gr | 0, ms: Math.round(((cards[ix].gr | 0) >= 4 ? RV_MS.g : RV_MS.p) * k) }); });
  if (fin.length) st.push({ k: 'fin', idx: fin, gr: 4, ms: Math.round(RV_MS.fin * k) });
  return { normal: normal, indiv: indiv, fin: fin, stages: st };
}

function rvAvatar(c) {
  var src = '', alt = '', pj, v;
  if (c.fig) src = (typeof fxFigImg === 'function' && fxFigImg(c.fig)) || 'assets/portraits/' + rvEsc(c.fig) + '.webp';
  else if (typeof cardsUiPortraitJob === 'function' && typeof cardsUiAvatarVar === 'function' && (pj = cardsUiPortraitJob(c))) {
    v = cardsUiAvatarVar(c, pj);
    src = 'assets/portraits/generic/' + pj + '_' + v + '.webp';
    if (c.gr <= 3) alt = 'assets/portraits/generic/' + pj + '_' + c.gr + '_' + v + '.webp';
  }
  return '<svg class="rv-sil" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14" r="7.5"/><path d="M5 40c0-9 6-14.5 15-14.5S35 31 35 40z"/></svg>' +
    (src ? '<img alt="" src="' + src + '"' + (alt ? ' data-alt="' + alt + '"' : '') + ' onerror="var a=this.getAttribute(\'data-alt\');if(a){this.removeAttribute(\'data-alt\');this.src=a}else this.remove()">' : '');
}
function rvGradeCh(gr) { return typeof CARD_GRADE !== 'undefined' && CARD_GRADE[gr] ? CARD_GRADE[gr].ch : ['白', '青', '藍', '紫', '金'][gr] || ''; }
function rvJobName(c) { return typeof CARD_JOB_BY_ID !== 'undefined' && CARD_JOB_BY_ID[c.main] ? CARD_JOB_BY_ID[c.main].name : ''; }
// 美術卡正面(js/cardart.js):名牌卷軸 = 姓名,資訊面板 = 品階 · 職業(名人另標)
function rvArtFront(c) {
  var gr = c.gr | 0;
  return '<div class="rv-fr">' + cardArtHtml(c, { portrait: rvAvatar(c), name: '<span class="canmt' + (String(c.name || '').length > 4 ? ' canml' : '') + '">' + rvEsc(c.name) + '</span>',
    panel: '<div class="capl">' + rvEsc(rvGradeCh(gr)) + '階' + (c.fig ? ' · 名人' : '') + '</div><div class="capl">' + rvEsc(rvJobName(c)) + '</div>', cls: 'carv' }) + '</div>';
}
// 這批卡是否全部可用美術卡(邊框與背景都已載入);缺 cardart.js / 載入中 / 缺檔 → 整批用原畫法
function rvArtOk(list) { return typeof cardArtOk === 'function' && typeof cardArtHtml === 'function' && list.every(function (c) { return cardArtOk(c); }) && (typeof cardArtState !== 'function' || cardArtState('assets/card/card_back.webp') === 1); }
function rvMkCard(c, up) {
  var el = document.createElement('div'), gr = c.gr | 0, i, corner = '';
  for (i = 0; i < gr; i++) corner += '◆';
  el.className = 'rv-card g' + gr + (up ? ' up' : '');
  if (rvS && rvS.art) { el.innerHTML = '<div class="rv-in"><div class="rv-bk"></div>' + rvArtFront(c) + '</div>'; return el; }
  el.innerHTML = '<div class="rv-in"><div class="rv-bk"><span>令</span></div><div class="rv-fr"><b class="rv-g">' + rvGradeCh(gr) + '</b>' + (c.fig ? '<i class="rv-fg">名人</i>' : '') +
    '<div class="rv-av">' + rvAvatar(c) + '</div><div class="rv-nm">' + rvEsc(c.name) + '</div><div class="rv-jb">' + rvEsc(rvJobName(c)) + '</div><div class="rv-cn">' + corner + '</div></div></div>';
  return el;
}
function rvDiv(cls, parent) { var d = document.createElement('div'); d.className = cls; if (parent) parent.appendChild(d); return d; }
function rvRestart(el, cls) { el.classList.remove(cls); void el.offsetHeight; el.classList.add(cls); }
function rvVar(el, k, v) { if (el.style && typeof el.style.setProperty === 'function') el.style.setProperty(k, String(v)); }

function rvLog(s) { rvS.log.push(s); rvLastLog = rvS.log; }
function rvSetScale() {
  var k = rvS.power ? RV_MS.ps : 1;
  if (rvS.fast) k = Math.min(k, RV_MS.fast);
  rvS.k = k; rvVar(rvS.root, '--rvk', k);
}
function rvParticles(fx) {
  var h = '', i, a, d;
  for (i = 0; i < 16; i++) { a = (i / 16) * 6.2832 + (i % 3) * 0.2; d = 90 + (i * 37) % 80; h += '<i style="--dx:' + Math.round(Math.cos(a) * d) + 'px;--dy:' + Math.round(Math.sin(a) * d) + 'px;--dl:' + ((i * 53) % 300) + 'ms"></i>'; }
  fx.innerHTML = h;
}

// ---- 各步驟(皆為「狀態轉換」,可被點擊跳步而不壞) ----
function rvDoFlip(idx) {
  var s = rvS, n = 0;
  rvLog('flip:' + idx.join(','));
  idx.forEach(function (ix) {
    var el = s.cards[ix];
    rvVar(el, '--rvd', Math.min(n * 60, 360) + 'ms');
    el.classList.add('up'); n++;
  });
  if (n) rvSnd('ui_tap');
}
function rvShow(idx, kind) {
  var s = rvS, gr = 3, i, wrap, fin = s.fin;
  idx.forEach(function (ix) { if ((s.list[ix].gr | 0) > gr) gr = s.list[ix].gr | 0; });
  rvLog((kind === 'fin' ? 'fin:' : 'spot:') + idx.join(','));
  s.root.classList.add('dim', 'fxon');
  s.root.classList.remove('fx3', 'fx4'); s.root.classList.add(gr >= 4 ? 'fx4' : 'fx3');
  rvRestart(s.ring, 'go');
  if (gr >= 4 && !s.power) { rvRestart(s.flash, 'go'); rvParticles(s.parts); rvRestart(s.parts, 'go'); } else if (gr >= 4) rvRestart(s.flash, 'go');
  fin.innerHTML = ''; fin.className = 'rv-fin ' + (kind === 'fin' ? 'n4' : 'n1') + (s.power ? ' ps' : '');
  s.stg = [];
  idx.forEach(function (ix) {
    wrap = rvDiv('rv-stg g' + (s.list[ix].gr | 0), fin);
    var card = rvMkCard(s.list[ix], true);
    card.classList.add('spin'); wrap.appendChild(card);
    s.stg.push({ ix: ix, wrap: wrap, card: card });
  });
  s.cap.className = 'rv-cap show ' + (gr >= 4 ? 'c4' : 'c3');
  if (kind === 'fin') s.cap.innerHTML = '<b>終局合開</b>';
  else {
    var c = s.list[idx[0]];
    s.cap.innerHTML = '<b>' + rvEsc(c.name) + '</b><span>' + (c.fig ? '名人 · ' : '') + rvEsc(rvJobName(c)) + '</span>';
  }
  if (gr >= 4) { rvSnd('coin'); if (kind === 'fin') rvSnd('build_done'); } else rvSnd('ui_tap');
}
function rvFly() {
  var s = rvS, tr;
  rvLog('fly');
  s.cap.classList.remove('show');
  s.stg.forEach(function (o) {
    var slot = s.cards[o.ix].getBoundingClientRect(), from;
    o.card.classList.remove('spin'); o.card.classList.add('settled');
    from = o.wrap.getBoundingClientRect();
    if (from.width > 0 && slot.width > 0) {
      tr = 'translate(' + Math.round((slot.left + slot.width / 2) - (from.left + from.width / 2)) + 'px,' + Math.round((slot.top + slot.height / 2) - (from.top + from.height / 2)) + 'px) scale(' + (slot.width / from.width).toFixed(3) + ')';
      o.wrap.style.transform = tr;
    }
    o.wrap.classList.add('fly');
  });
}
function rvLand() {
  var s = rvS;
  rvLog('land');
  (s.stg || []).forEach(function (o) {
    var el = s.cards[o.ix];
    el.classList.add('up', 'nt', 'pop');
  });
  if (s.stg && s.stg.length) rvSnd((s.list[s.stg[0].ix].gr | 0) >= 4 ? 'coin' : 'build_done');
  s.stg = [];
  s.fin.innerHTML = '';
}
function rvFinal() {
  var s = rvS;
  rvLog('final');
  s.fin.innerHTML = ''; s.stg = [];
  s.cap.classList.remove('show');
  s.cards.forEach(function (el) { el.classList.add('up', 'nt'); });
  s.root.classList.remove('dim', 'fxon');
  s.root.classList.add('final');
  s.btn.hidden = false; s.hint.hidden = true; s.skip.hidden = true;
  s.final = true;
}

function rvBuildSteps(plan) {
  var st = [];
  plan.stages.forEach(function (g) {
    if (g.k === 'flip') { st.push({ d: g.ms, fn: function () { rvDoFlip(g.idx); } }); return; }
    st.push({ d: g.ms * 0.58, fn: function () { rvShow(g.idx, g.k); } });
    st.push({ d: g.ms * 0.32, fn: rvFly });
    st.push({ d: g.ms * 0.10, fn: rvLand });
  });
  st.push({ d: 0, fn: rvFinal });
  return st;
}
function rvNext() {
  var s = rvS, step;
  if (!s || s.closed || s.final) return;
  s.timer = null;
  step = s.steps[s.pos++];
  if (!step) return;
  step.fn();
  if (!s.final) s.timer = setTimeout(rvNext, Math.max(0, Math.round(step.d * s.k)));
}
function rvTap() {
  var s = rvS;
  if (!s || s.closed || s.final) return;
  if (!s.fast) { s.fast = true; rvSetScale(); }
  if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  rvNext();
}
function rvFire() { rvFireOf(rvS); }
function rvFireOf(s) {
  var cbs;
  if (!s || s.fired) return;
  s.fired = true; cbs = s.cbs.slice();
  cbs.forEach(function (f) { try { f(); } catch (e) { if (typeof console !== 'undefined') console.error(e); } });
}
function rvSkip() {
  var s = rvS;
  if (!s || s.closed) return;
  if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  if (!s.final) rvFinal();
  rvFire();
}
function rvClose() {
  var s = rvS;
  if (!s || s.closed) return;
  s.closed = true;
  if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  if (s.root.parentNode) s.root.parentNode.removeChild(s.root);
  if (document.body && document.body.classList) document.body.classList.remove('cards-reveal');
  rvS = null;   // 先清狀態再通知:onDone 內可能立刻再開下一場(連開 / 全部開啟),不可被事後的清除蓋掉
  rvFireOf(s);
}

function cardsRevealActive() { return !!rvS; }
function cardsRevealLog() { return rvLastLog.slice(); }
function cardsRevealPlay(cards, onDone) {
  var s, root, main, grid, top, bot, plan, power, list, st;
  if (rvS && !rvS.closed && rvS.fired) rvClose();   // 上一場已略過(onDone 已通知)、停在最終排列頁:直接收掉再開新的,否則新批的 onDone 會掛在已結束的場次上永不呼叫
  if (rvS && !rvS.closed) { if (typeof onDone === 'function') rvS.cbs.push(onDone); return false; }   // 重複呼叫不疊加:只共用這一場,結束時一併通知
  list = Array.isArray(cards) ? cards.filter(function (c) { return c && typeof c === 'object'; }) : [];
  if (!list.length || typeof document === 'undefined' || !document.body) { if (typeof onDone === 'function') { try { onDone(); } catch (e) { /* 呼叫端錯誤不影響 */ } } return false; }
  power = rvPower();
  plan = cardsRevealPlan(list, power);
  if (typeof cardArtPreload === 'function') cardArtPreload();   // 首次使用時載入並快取卡片美術(已載過不重複)
  var art = rvArtOk(list);
  root = document.createElement('div'); root.className = 'rv' + (power ? ' ps' : '') + (art ? ' art' : '');
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '抽卡結果');
  main = rvDiv('rv-main', root); grid = rvDiv('rv-grid', main);
  s = rvS = { root: root, list: list, art: art, cards: [], cbs: typeof onDone === 'function' ? [onDone] : [], power: power, fast: false, k: 1, timer: null, pos: 0, steps: null, stg: [], final: false, fired: false, closed: false, log: [] };
  rvLastLog = s.log;
  list.forEach(function (c) {
    var el = rvMkCard(c, false), g = c.gr | 0;
    if (g >= 3) el.classList.add('hint' + g);
    grid.appendChild(el); s.cards.push(el);
  });
  s.dim = rvDiv('rv-dim', root);
  var fx = rvDiv('rv-fx', root);
  rvDiv('rv-rays', fx); s.ring = rvDiv('rv-ring', fx); s.flash = rvDiv('rv-flash', fx); s.parts = rvDiv('rv-parts', fx);
  s.fin = rvDiv('rv-fin', root); s.cap = rvDiv('rv-cap', root);
  top = rvDiv('rv-top', root); bot = rvDiv('rv-bot', root);
  s.skip = document.createElement('button'); s.skip.className = 'rv-skip'; s.skip.textContent = '略過 ▸▸'; top.appendChild(s.skip);
  s.hint = rvDiv('rv-hint', bot); s.hint.textContent = '點一下加速';
  s.btn = document.createElement('button'); s.btn.className = 'rv-ok'; s.btn.textContent = '收下'; s.btn.hidden = true; bot.appendChild(s.btn);
  s.skip.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); rvSkip(); });
  s.btn.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); rvClose(); });
  root.addEventListener('click', function () { rvTap(); });
  document.body.appendChild(root);
  if (document.body.classList) document.body.classList.add('cards-reveal');
  rvSetScale();
  s.steps = rvBuildSteps(plan);
  s.timer = setTimeout(rvNext, 120);     // 先讓整排背面卡出現一下再翻
  return true;
}
