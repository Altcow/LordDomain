// js/ld_equip_forge_ui.js — 鍛造坊頁(設計_裝備與尋訪_定案.md 第三節、任務卡 6;前綴 eqForge)。頁 id 'forge'(由首頁木牌 ld_home.js fn:'forge' 開啟)。ES2017;不用 ?. ??。
// 流程:選部位與型(武器 武型 / 文型、防具 重甲 / 法袍)→ 選品質 → 金可投 1 個精魄 → 看配方(夠不夠)→ 鍛造。演出用程式畫占位(鐵匠 + 鐵鎚晃動),之後換 GPT 圖。
// 按下去 forgeDo 已先把扣材料 / 計數器寫進存檔,畫面只是顯示結果,重整不會重抽。
// @DORMANT ldui:只由 ldui 的首頁木牌開啟。

var EQF_KINDS = [['wpn', 'wu', '武器·武型', 'eqi_blade'], ['wpn', 'wen', '武器·文型', 'eqi_fan'], ['arm', 'heavy', '防具·重甲', 'eqi_armor'], ['arm', 'robe', '防具·法袍', 'eqi_robe']];
function eqfFacts(ctx) {
  var k = EQF_KINDS[ctx.k | 0] || EQF_KINDS[0];
  return { kind: k[0], type: k[1], q: ctx.q | 0, soul: !!ctx.soul && (ctx.q | 0) === 3 };
}
function eqfHtml(ctx) {
  var f = eqfFacts(ctx), h = '', cost, can, k, have = (typeof matAll === 'function') ? matAll() : {}, coin = (typeof res4Get === 'function') ? res4Get('coin') : 0, fails, open = forgeOpen();
  if (!open) return '<div class="eq-page"><div class="eq-none">鍛造坊還沒開放:名聲達 ' + GEAR_CFG.forge.openFame + ',或拿到第一份鍛造材料(野怪、山寨、高塔會掉)。</div></div>';
  cost = forgeCost(f.kind, f.q, f.soul);
  can = forgeCan(f.kind, f.q, f.soul);
  fails = forgeFails(f.q);
  h += '<div class="eq-page eq-forge">';
  h += '<div class="eq-smithrow' + (ctx.hammer ? ' hit' : '') + '">' + eqArt('fg_smith', 'eq-smith') + '<div class="eq-bubble">' + (ctx.say || '要打什麼?') + '</div></div>';
  if (ctx.res) h += '<div class="eq-result ' + ctx.res.cls + '">' + ctx.res.html + '</div>';
  h += '<div class="eq-sec">部位與型</div><div class="eq-chips">' + EQF_KINDS.map(function (x, i) { return '<button class="ld-tab' + ((ctx.k | 0) === i ? ' on' : '') + '" data-a="kind" data-v="' + i + '">' + eqEsc(x[2]) + '</button>'; }).join('') + '</div>';
  h += '<div class="eq-sec">品質</div><div class="eq-chips">' + GEAR_CFG.qName.map(function (n, i) { return '<button class="ld-tab q' + i + ((ctx.q | 0) === i ? ' on' : '') + '" data-a="q" data-v="' + i + '">' + n + '</button>'; }).join('') + '</div>';
  if ((ctx.q | 0) === 3) h += '<label class="eq-soul"><input type="checkbox" data-a="soul"' + (ctx.soul ? ' checked' : '') + '> 投入 1 個精魄(特性機率:1 個 30% → 50%、2 個 5% → 15%)</label>';
  h += '<div class="eq-sec">配方</div><div class="eq-recipe">';
  for (k in cost.mats) if (Object.prototype.hasOwnProperty.call(cost.mats, k)) {
    h += '<div class="eq-cell mat' + ((have[k] | 0) < cost.mats[k] ? ' lack' : '') + '">' + eqArt(k, 'eq-ic') + '<b>' + (have[k] | 0) + '/' + cost.mats[k] + '</b><i>' + eqEsc(matName(k)) + '</i></div>';
  }
  h += '<div class="eq-cell mat' + (coin < cost.coin ? ' lack' : '') + '"><span class="ld-ph eq-ic coin">文</span><b>' + coin + '/' + cost.coin + '</b><i>文</i></div></div>';
  h += '<div class="eq-kv"><span>成功率</span><b>' + Math.round(forgeRate(f.q) * 100) + '%</b></div>';
  h += '<div class="eq-kv"><span>' + GEAR_CFG.qName[f.q] + '裝連敗</span><b>' + fails + ' / ' + GEAR_CFG.forge.pity + (fails >= GEAR_CFG.forge.pity ? '(下一次必成)' : '') + '</b></div>';
  if (f.q > 0) h += '<div class="eq-note">失敗:損失一半主材(向下取整)與半價的文,其他材料照扣;連敗 ' + GEAR_CFG.forge.pity + ' 次後第 ' + (GEAR_CFG.forge.pity + 1) + ' 次必成。</div>';
  h += '<button class="eq-b big' + (can.ok ? '' : ' off') + '" data-a="go">鍛造' + (can.ok ? '' : '(' + (can.reason === 'mat' ? '材料不足' : '文不足') + ')') + '</button>';
  h += '</div>';
  return h;
}
function eqfRender(el, ctx) {
  ctx.fEl = el;
  el.innerHTML = eqfHtml(ctx);
  el.onclick = function (ev) { eqfClick(ctx, ev); };
  el.onchange = function (ev) { var t = ev && ev.target; if (t && t.getAttribute && t.getAttribute('data-a') === 'soul') { ctx.soul = !!t.checked; ctx.res = null; eqfRender(el, ctx); } };
}
function eqfResultHtml(r, f) {
  var h, it;
  if (!r.success) return { cls: 'bad', html: '<b>失敗了…</b><span>損失:' + eqEsc(eqMatsText(r.lost.mats)) + '、文 ' + r.lost.coin + '。連敗 ' + r.fails + ' 次。</span>' };
  it = r.item && r.item.item;
  h = '<b>' + (r.pity ? '保底觸發,鍛造成功!' : '鍛造成功!') + '</b>';
  if (it) h += '<div class="eq-row cur">' + ldEquipItemHtml(it) + '</div>';
  if (r.item && r.item.salvaged) h += '<span class="eq-warn">背包已滿(' + GEAR_CFG.inv + '),這件已自動分解:' + eqEsc(eqMatsText(r.item.gain.mats)) + '</span>';
  return { cls: 'ok', html: h };
}
function eqfClick(ctx, ev) {
  var n = eqFindAct(ev, ctx.fEl), a, v, f, r;
  if (!n) return false;
  a = n.getAttribute('data-a'); v = n.getAttribute('data-v');
  if (a === 'kind') { ctx.k = +v; ctx.res = null; eqfRender(ctx.fEl, ctx); return true; }
  if (a === 'q') { ctx.q = +v; if (ctx.q !== 3) ctx.soul = false; ctx.res = null; eqfRender(ctx.fEl, ctx); return true; }
  if (a === 'go') {
    f = eqfFacts(ctx);
    r = forgeDo(f.kind, f.type, f.q, f.soul);
    if (!r.ok) { eqToast(r.reason === 'closed' ? '鍛造坊還沒開放' : (r.reason === 'coin' ? '文不夠' : '材料不夠,沒有扣任何東西')); return true; }
    ctx.res = eqfResultHtml(r, f);
    ctx.say = r.success ? '好東西!' : '唉,再來一次?';
    ctx.hammer = true;
    eqfRender(ctx.fEl, ctx);
    if (typeof setTimeout === 'function') setTimeout(function () { ctx.hammer = false; var e = ctx.fEl && ctx.fEl.querySelector ? ctx.fEl.querySelector('.eq-smithrow') : null; if (e && e.classList) e.classList.remove('hit'); }, 600);
    return true;
  }
  return false;
}
if (typeof ldNavRegister === 'function') {
  ldNavRegister({
    id: 'forge', title: '鍛造坊', bg: 'sc_forge',
    res: function () { return [['礪石', (typeof matCount === 'function') ? matCount('m_whet') : 0], ['文', (typeof res4Get === 'function') ? res4Get('coin') : 0]]; },
    build: function (el, ctx) { if (ctx.k === undefined) { ctx.k = 0; ctx.q = 0; ctx.soul = false; } ctx.res = null; eqfRender(el, ctx); },
    onShow: function (el, ctx) { eqfRender(el, ctx); }
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { eqfHtml: eqfHtml };
