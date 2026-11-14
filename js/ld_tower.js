// js/ld_tower.js — 百層塔頁(設計_介面骨架實作計畫.md §3-5、任務卡 4)。前綴 ldTower。邏輯在 tower.js(tw*)。ES2017,不用 ?. ??。
// 頁 id 'tower':塔身捲動區(由上到下 = 高層到低層,只產生 twWindow 範圍的樓層)、匾額、說明區(點樓層換字,不另開頁)、大金鈕「挑戰第 N 層」。
// 挑戰 → ldNavPush('team', {n:1, mode:'battle', title, stg:{kind:'custom', label, foes, onEnd}});onEnd 內 twSettle;回到本頁(onShow)重畫並捲到目前層。
// 不放底列。素材走 ld_art(bg_tower 沒圖時用 .ldp-scene 預設背景);樓層節點是純 CSS(石牆漸層 + 單一漢字徽章)。
var LDTOWER = { sel: 0, launched: false, last: null, bound: false, cache: {} };
function ldTowerEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
function ldTowerToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function ldTowerRoot() { return typeof document !== 'undefined' && document.querySelector ? document.querySelector('[data-ldp="tower"] .ldtw') : null; }
function ldTowerStars(n) { var s = '', i; for (i = 0; i < 3; i++) s += i < n ? '★' : '☆'; return s; }
// 敵情(只算選中那一層,結果快取;資料缺漏回 null)
function ldTowerFoeInfo(n) {
  var k = 'f' + n, f;
  if (LDTOWER.cache[k] !== undefined) return LDTOWER.cache[k];
  try { f = twFoes(n); } catch (e) { f = null; }
  LDTOWER.cache[k] = f ? { list: f.list || [], power: f.power, boss: !!f.boss } : null;
  return LDTOWER.cache[k];
}
function ldTowerTroops(list) {
  var c = {}, o = [];
  (list || []).forEach(function (u) { if (u.troop) c[u.troop] = (c[u.troop] || 0) + 1; });
  Object.keys(c).forEach(function (t) { o.push(t + '兵 ×' + c[t]); });
  return o.join('、');
}
// 說明區內容(選中樓層 n;st = 存檔)
function ldTowerFillInfo(box, n, st) {
  var f = twFloor(n), cur = Math.min(TOWER_CFG.max, st.top + 1), info, nb, s, row;
  box.innerHTML = '';
  box.appendChild(ldTowerEl('div', 'ldtw-i-h', f.label));
  if (n > cur) {
    box.appendChild(ldTowerEl('div', 'ldtw-i-l', '尚未開放:請先通關第 ' + cur + ' 層'));
    return;
  }
  s = st.st[String(n)] | 0;
  row = ldTowerEl('div', 'ldtw-i-l', n <= st.top ? ('已通關 ' + ldTowerStars(s) + '  重打只更新星數,不再給名聲') : '目前層:首通可得名聲');
  box.appendChild(row);
  info = ldTowerFoeInfo(n);
  if (info) {
    box.appendChild(ldTowerEl('div', 'ldtw-i-l', '敵方:' + (ldTowerTroops(info.list) || '—') + '(建議戰力 ' + info.power + ')'));
    if (f.boss && info.list.length) box.appendChild(ldTowerEl('div', 'ldtw-i-l', '頭目:' + (info.list[0].title ? info.list[0].title + ' ' : '') + info.list[0].name));
  }
  if (n > st.top) { row = twRewardText(n); if (row) box.appendChild(ldTowerEl('div', 'ldtw-i-l gold', row)); }
  nb = twNextBoss(st.top);
  if (!f.boss && nb > n && st.top < TOWER_CFG.max) box.appendChild(ldTowerEl('div', 'ldtw-i-l dim', '頭目預告:第 ' + nb + ' 層'));
  if (LDTOWER.last && LDTOWER.last.n === n) {
    row = LDTOWER.last;
    box.appendChild(ldTowerEl('div', 'ldtw-i-l ' + (row.win ? 'gold' : 'dim'), '上一場:' + (row.win ? ('勝利 ' + ldTowerStars(row.stars) + (row.first ? '(首通' + (row.fame ? ',名聲 +' + row.fame : '') + ')' : '')) : '敗北,層數不變')));
  }
}
// 樓層節點(由高到低)
function ldTowerFloorBtn(n, st, sel) {
  var f = twFloor(n), cur = Math.min(TOWER_CFG.max, st.top + 1), b = ldTowerEl('button', 'ldtw-f'), badge, mid, sub, r;
  var cls = n <= st.top ? 'clear' : (n === cur ? 'cur' : 'lock');
  b.type = 'button';
  b.className = 'ldtw-f ' + cls + (f.boss ? ' boss' : '') + (n === sel ? ' sel' : '');
  b.setAttribute('data-floor', String(n));
  badge = ldTowerEl('span', 'ldtw-no', String(n));
  mid = ldTowerEl('span', 'ldtw-mid');
  mid.appendChild(ldTowerEl('span', 'ldtw-nm', f.boss ? '第 ' + n + ' 層 頭目' : '第 ' + n + ' 層'));
  sub = cls === 'clear' ? ldTowerStars(st.st[String(n)] | 0) : (cls === 'cur' ? '目前層' : '未開放');
  mid.appendChild(ldTowerEl('span', 'ldtw-sb', sub));
  r = ldTowerEl('span', 'ldtw-mk', cls === 'clear' ? '通' : (cls === 'cur' ? '戰' : (f.boss ? '頭' : '鎖')));
  b.appendChild(badge); b.appendChild(mid); b.appendChild(r);
  return b;
}
// 把目前選中層(或 cur)捲到塔身中央
function ldTowerCenter(root, n) {
  var sc = root && root.querySelector ? root.querySelector('.ldtw-scroll') : null, row;
  if (!sc) return;
  row = sc.querySelector('[data-floor="' + n + '"]');
  if (!row) return;
  sc.scrollTop = Math.max(0, row.offsetTop - (sc.clientHeight - row.offsetHeight) / 2);
}
function ldTowerGo(root) {
  var st = twRead(), cur = Math.min(TOWER_CFG.max, st.top + 1), n = LDTOWER.sel || cur, f, label, ok, fired = false;
  if (n > cur) n = cur;
  f = twFloor(n); label = '百層塔 ' + f.label;
  LDTOWER.launched = true;
  ok = ldNavPush('team', {
    n: 1, mode: 'battle', title: label,
    stg: {
      kind: 'custom', label: label,
      foes: function () { return twFoes(n); },
      onEnd: function (win, S) {
        var r;
        if (fired) return;
        fired = true;
        r = twSettle(n, win, S);
        LDTOWER.last = r;
        if (r.unlocked && r.unlocked.length) ldTowerToast('名聲提升:' + (r.unlocked[0].label || '新功能開放'));
        if (r.first) LDTOWER.sel = Math.min(TOWER_CFG.max, r.top + 1);
      }
    }
  });
  if (!ok) LDTOWER.launched = false;
}
// 選中某層:只換 class / 說明區 / 金鈕字,不重畫塔身(捲動位置不變)
function ldTowerSelect(root, k) {
  var st = twRead(), cur = Math.min(TOWER_CFG.max, st.top + 1), old = root.querySelector('.ldtw-f.sel'), nw = root.querySelector('[data-floor="' + k + '"]'), go = root.querySelector('.ldtw-go');
  if (!nw) return;
  LDTOWER.sel = k;
  if (old) old.classList.remove('sel');
  nw.classList.add('sel');
  ldTowerFillInfo(root.querySelector('.ldtw-info'), k, st);
  if (go) { go.textContent = (k <= st.top ? '重打第 ' : '挑戰第 ') + k + ' 層'; go.disabled = k > cur; }
}
function ldTowerRender(el, scroll) {
  var st = twRead(), w = twWindow(st.top), cur = w.cur, sel = LDTOWER.sel, root, plaque, info, sc, n, go, goN, again, main;
  if (!sel || sel > w.to) sel = LDTOWER.sel = cur;
  el.innerHTML = '';
  root = ldTowerEl('div', 'ldtw');
  info = ldTowerEl('div', 'ldtw-info ldp-panel');
  main = ldTowerEl('div', 'ldtw-main');
  plaque = ldTowerEl('div', 'ldtw-plaque', st.top > 0 ? ('目前最高層:第 ' + st.top + ' 層' + (w.done ? '(已登頂)' : '')) : '尚未登塔:從第 1 層開始');
  sc = ldTowerEl('div', 'ldtw-scroll');
  for (n = w.to; n >= 1; n--) sc.appendChild(ldTowerFloorBtn(n, st, sel));
  main.appendChild(plaque); main.appendChild(sc);
  goN = sel;
  again = goN <= st.top;
  go = ldTowerEl('button', 'ld-btn ldtw-go', (again ? '重打第 ' : '挑戰第 ') + goN + ' 層');
  go.type = 'button'; go.setAttribute('data-ld', 'tower-go');
  go.addEventListener('click', function () { ldTowerGo(root); });
  sc.addEventListener('click', function (ev) {
    var t = ev.target, b = null;
    while (t && t !== sc) { if (t.getAttribute && t.getAttribute('data-floor')) { b = t; break; } t = t.parentNode; }
    if (b) ldTowerSelect(root, parseInt(b.getAttribute('data-floor'), 10));
  });
  root.appendChild(info); root.appendChild(main); root.appendChild(go);
  el.appendChild(root);
  ldTowerFillInfo(info, sel, st);
  go.disabled = sel > cur;
  if (scroll) { ldTowerCenter(root, sel); if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { ldTowerCenter(root, sel); }); }
}
function ldTowerOnResize() {
  var root = ldTowerRoot();
  if (root) ldTowerCenter(root, LDTOWER.sel || Math.min(TOWER_CFG.max, twRead().top + 1));
}
ldNavRegister({
  id: 'tower', title: '百層塔', bg: 'bg_tower',
  res: function () { var st = twRead(), g = (typeof fameGet === 'function') ? fameGet() : 0; return [['名聲', g], ['最高', st.top + ' 層']]; },
  build: function (el, ctx) {
    LDTOWER.cache = {};
    if (!ctx.keepSel) LDTOWER.sel = 0;
    ldTowerRender(el, true);
    if (!LDTOWER.bound && typeof window !== 'undefined' && window.addEventListener) { LDTOWER.bound = true; window.addEventListener('resize', ldTowerOnResize); }
  },
  onShow: function (el, ctx) {
    var root = el && el.querySelector ? el.querySelector('.ldtw') : null;
    if (LDTOWER.launched) {   // 從整隊 / 戰鬥回來:重畫(層數可能變了)並捲到目前層
      LDTOWER.launched = false;
      LDTOWER.cache = {};
      ldTowerRender(el, true);
      if (ctx && ctx.resEl && typeof ldNavFillRes === 'function') { try { ldNavFillRes({ id: 'tower', ctx: ctx }); } catch (e) { /* 略過 */ } }
      return;
    }
    if (root) ldTowerCenter(root, LDTOWER.sel);
  }
});
