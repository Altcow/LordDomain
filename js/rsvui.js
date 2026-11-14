// js/rsvui.js — 校場(征兵 / 補兵分頁)與名聲階梯表的最小畫面:只產生 HTML 字串 + 處理 data-rsv 動作,不自己開外框(掛在地圖頁 wd_ui.js 的子頁裡,返回鍵沿用 wdBack)。
// 規則全在 rsv.js / fame.js;兵力比例的唯一來源是地圖模組的 trp,所以「補兵」分頁的名單與一鍵補兵由呼叫端(wd_ui.js)以 ctx 傳入。
// ctx = {list:[{id,name,r}] 在城沒滿兵的卡, toast(m), render(), healAll() → 補到的卡數, now}。動作:data-rsv = tab | recruit | cancel | healall | auto。
// 全域:RSVUI rsvUiHtml fameUiHtml rsvUiAct rsvUiInput rsvUiFmt。ES2017;不用 ?. ??。不發聲。

var RSVUI = { tab: 'rec', n: 0 };
var RSVUI_REASON = { slot: '兩格佇列都在征兵中', min: '至少要 100 兵', cap: '超過預備兵上限(含佇列中)', grain: '糧不夠' };

function rsvUiEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function rsvUiFmt(n) { return Math.floor(+n || 0).toLocaleString(); }
function rsvUiDur(ms) {
  var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, p = function (v) { return (v < 10 ? '0' : '') + v; };
  return h > 0 ? h + ':' + p(m) + ':' + p(x) : p(m) + ':' + p(x);
}
function rsvUiMins(n) { return Math.ceil(n / 100 * RSV_CFG.minPer100 * rsvSpeedMul()); }

// 校場頁:ctx.list = [{id, name, r}]
function rsvUiHtml(ctx) {
  var st = rsvGet(), cap = rsvCap(), now = ctx.now, max = rsvOrderMax(), h = '', queued = 0, i, x, grain = (typeof res4Get === 'function') ? res4Get('grain') : 0;
  st.q.forEach(function (o) { queued += o.n; });
  h += '<div class="wd-card"><div class="wd-row"><b class="wd-big">預備兵 ' + rsvUiFmt(st.n) + ' / ' + rsvUiFmt(cap) + '</b><span class="wd-sp"></span><span class="wd-sm">糧 ' + rsvUiFmt(grain) + '</span></div>';
  h += '<div class="wd-sm">每張武將滿兵 ' + RSV_CFG.cardFull + '(一隊 ' + (RSV_CFG.cardFull * 3).toLocaleString() + ')。打完回城,傷兵自動用預備兵補滿。鄉勇自願投軍 +' + RSV_CFG.freePerHour + '/時(離線最多算 ' + RSV_CFG.freeMaxHours + ' 小時)。</div>';
  if (st.lack.n > 0) h += '<div class="wd-red">隊伍補不滿(缺 ' + rsvUiFmt(st.lack.n) + ' 兵),請征兵</div>';
  h += '<div class="wd-row"><button class="wd-b' + (st.auto ? ' g' : '') + '" data-rsv="auto">自動補兵:' + (st.auto ? '開' : '關') + '</button></div></div>';
  h += '<div class="wd-row"><button class="wd-tab' + (RSVUI.tab === 'rec' ? ' on' : '') + '" data-rsv="tab" data-v="rec">征兵</button><button class="wd-tab' + (RSVUI.tab === 'heal' ? ' on' : '') + '" data-rsv="tab" data-v="heal">補兵 ' + ((ctx.list || []).length || '') + '</button></div>';
  if (RSVUI.tab === 'heal') {
    h += '<div class="wd-card">';
    if (!(ctx.list || []).length) h += '<div class="wd-sm">所有在城的武將都是滿兵。</div>';
    (ctx.list || []).forEach(function (c) {
      h += '<div class="wd-row"><b>' + rsvUiEsc(c.name) + '</b><span class="wd-sp"></span><span class="wd-hp" style="width:80px;display:inline-block"><div style="width:' + Math.round(c.r * 100) + '%"></div></span> ' + Math.round(c.r * 100) + '%</div>';
    });
    h += '<div class="wd-row"><button class="wd-b pri" data-rsv="healall"' + ((ctx.list || []).length && st.n > 0 ? '' : ' disabled') + '>一鍵補兵</button><span class="wd-sm">用預備兵補;自動補兵開著時,通常是空的。</span></div></div>';
    return h;
  }
  // 征兵分頁
  if (RSVUI.n < RSV_CFG.orderMin || RSVUI.n > max) RSVUI.n = max;
  h += '<div class="wd-card"><div class="wd-row"><b>征兵</b><span class="wd-sm">下單就扣糧(1 兵 ' + RSV_CFG.grainPer + ' 糧);每 100 兵 ' + RSV_CFG.minPer100 + ' 分鐘;兩格同時進行,取消退還未完成比例的糧。</span></div>';
  if (max < RSV_CFG.orderMin) h += '<div class="wd-sm">' + (st.q.length >= RSV_CFG.slots ? '兩格佇列都在征兵中。' : (cap - st.n - queued < RSV_CFG.orderMin ? '預備兵(含佇列中)已接近上限。' : '糧不夠。')) + '</div>';
  else h += '<div class="wd-row"><input type="range" data-rsv-in="n" min="' + RSV_CFG.orderMin + '" max="' + max + '" step="100" value="' + Math.min(max, Math.max(RSV_CFG.orderMin, RSVUI.n)) + '" style="flex:1;min-width:140px"><b data-rsv-n="1">' + rsvUiFmt(RSVUI.n) + '</b> 兵</div>' +
    '<div class="wd-sm">花 <b data-rsv-cost="1">' + rsvUiFmt(RSVUI.n * RSV_CFG.grainPer) + '</b> 糧,約 <b data-rsv-time="1">' + rsvUiMins(RSVUI.n) + '</b> 分鐘</div>' +
    '<div class="wd-row"><button class="wd-b pri" data-rsv="recruit">征兵</button></div>';
  h += '</div><div class="wd-card">';
  for (i = 0; i < RSV_CFG.slots; i++) {
    x = st.q[i];
    h += '<div class="wd-row"><b>第 ' + (i + 1) + ' 格</b>';
    if (x) h += '<span>+' + rsvUiFmt(x.n) + ' 兵・<b data-cd="' + x.t1 + '">' + rsvUiDur(x.t1 - now) + '</b></span><span class="wd-sp"></span><button class="wd-b" data-rsv="cancel" data-i="' + i + '">取消</button>';
    else h += '<span class="wd-sm">空閒</span>';
    h += '</div>';
  }
  return h + '</div>';
}
// 名聲頁:階梯表(已達成打勾)
function fameUiHtml() {
  var n = fameGet(), nx = fameNext(), h = '<div class="wd-card"><div class="wd-row"><b class="wd-big">名聲 ' + rsvUiFmt(n) + '</b><span class="wd-sp"></span><span class="wd-sm">隊伍上限 ' + fameTeamCap() + '・駐守上限 ' + fameGuardCap() + '</span></div>';
  h += nx ? '<div>再 <b>' + rsvUiFmt(nx.need) + '</b> → ' + rsvUiEsc(nx.label) + '</div>' : '<div>已全部開放。</div>';
  h += '<div class="wd-sm">名聲只增不減,打贏山寨、野怪、資源點、攻下城池關口才會增加(擂台不算);只用來開放第 3~5 隊與駐守上限。</div></div><div class="wd-card">';
  fameSteps().forEach(function (s) {
    h += '<div class="wd-row"><b class="' + (s.done ? 'okc' : '') + '">' + (s.done ? '✓' : '　') + ' ' + rsvUiFmt(s.at) + '</b><span class="wd-sp">' + rsvUiEsc(s.label) + '</span></div>';
  });
  return h + '</div>';
}
// 滑桿拖動:只更新數字,不整頁重畫(重畫會斷掉拖曳)
function rsvUiInput(el, root) {
  var n, q;
  if (!el || !el.getAttribute || el.getAttribute('data-rsv-in') !== 'n') return false;
  n = Math.floor(+el.value || 0);
  RSVUI.n = n;
  if (root && root.querySelector) {
    q = root.querySelector('[data-rsv-n]'); if (q) q.textContent = rsvUiFmt(n);
    q = root.querySelector('[data-rsv-cost]'); if (q) q.textContent = rsvUiFmt(n * RSV_CFG.grainPer);
    q = root.querySelector('[data-rsv-time]'); if (q) q.textContent = String(rsvUiMins(n));
  }
  return true;
}
// 動作分派;回 true = 已處理
function rsvUiAct(a, b, ctx) {
  var r, now = ctx.now;
  if (a === 'tab') { RSVUI.tab = b.getAttribute('data-v') === 'heal' ? 'heal' : 'rec'; ctx.render(); return true; }
  if (a === 'auto') { rsvSetAuto(!rsvGet().auto); ctx.render(); return true; }
  if (a === 'recruit') {
    r = rsvRecruit(RSVUI.n, now);
    ctx.toast(r.ok ? '征兵 ' + rsvUiFmt(RSVUI.n) + ' 兵,約 ' + rsvUiMins(RSVUI.n) + ' 分鐘' : (RSVUI_REASON[r.reason] || '無法征兵'));
    if (r.ok) RSVUI.n = 0;
    ctx.render();
    return true;
  }
  if (a === 'cancel') {
    r = rsvCancel(+b.getAttribute('data-i'), now);
    ctx.toast(r.ok ? '已取消,退還 ' + rsvUiFmt(r.refund) + ' 糧' : '這一單已經完成了');
    ctx.render();
    return true;
  }
  if (a === 'healall') {
    r = ctx.healAll();
    ctx.toast(r > 0 ? '已補兵 ' + r + ' 張' : '預備兵不夠,或沒有需要補的');
    ctx.render();
    return true;
  }
  return false;
}
