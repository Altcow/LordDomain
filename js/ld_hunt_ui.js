// js/ld_hunt_ui.js — 書院頁(設計_裝備與尋訪_定案.md 第四節、任務卡 6;前綴 hunt)。頁 id 'study'(由首頁木牌 ld_home.js fn:'study' 開啟)。ES2017;不用 ?. ??。
// 三個分頁:尋訪人才・寶物 / 尋訪馬 / 線索兌換。頂列:城主體力 ⚡、剩餘次數、引薦人(預設魅力最高)。按一下立刻出結果(studyRoll 已先寫存檔,重整不重抽);
// 演出用程式畫占位(羅盤轉動、柵門撞開、捲軸),之後換 GPT 圖。
// @DORMANT ldui:只由 ldui 的首頁木牌開啟。

var HUNT_TABS = [['talent', '人才·寶物'], ['horse', '尋訪馬'], ['clue', '線索']];
var HUNT_CAT = { shard: '碎片', clue: '線索', card: '人才', relic: '寶具', horse: '戰馬', none: '無功而返' };
function huntFmtMs(ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return m + ' 分 ' + (s % 60) + ' 秒'; }
function huntFacName(k) { return STUDY_FAC_NAME[k] || '?'; }
function huntHead(ctx) {
  var now = Date.now(), sta = studyStamina(now), st = studyTick(now), cs = eqCs(), ib = studyIntro(cs, st), h = '', open = studyOpen();
  h += '<div class="eq-kv hunt-sta"><span>' + eqArt('xf_2', 'eq-xf') + ' 城主體力</span><b>' + sta.n + ' / ' + sta.max + (sta.nextIn ? '(下 1 點 ' + huntFmtMs(sta.nextIn) + ')' : '') + '</b></div>';
  h += '<div class="eq-kv"><span>今日可訪(存 2 天)</span><b>' + (featureOn('seek_talent') ? '人才·寶物 ' + st.cnt.talent + ' / ' + STUDY_CFG.cnt.talent.max + ',' : '') + '馬 ' + st.cnt.horse + ' / ' + STUDY_CFG.cnt.horse.max + '</b></div>';   // @DORMANT seek_talent
  if (ib) {
    h += '<div class="eq-kv"><span>引薦人</span><b>' + eqEsc(ib.e.name) + '(魅力 ' + ib.mei + (ib.pts ? ',金 +' + (ib.pts * STUDY_CFG.intro.gold).toFixed(2).replace(/\.?0+$/, '') + '、紫 +' + (ib.pts * STUDY_CFG.intro.purple).toFixed(2).replace(/\.?0+$/, '') + ' 個百分點' : ',無加成') + ';陣營 ' + (ib.facKey ? huntFacName(ib.facKey) : '隨機') + ')</b> <button class="eq-b sub" data-a="intro">' + (ctx.pickIntro ? '收起' : '更換') + '</button></div>';
    if (ctx.pickIntro) {
      h += '<div class="eq-intro">' + studyIntroList(cs, 12).map(function (e) {
        return '<button class="eq-b sub' + (ib.e.id === e.id ? ' on' : '') + '" data-a="setintro" data-v="' + eqEsc(e.id) + '">' + eqEsc(e.name) + ' ' + studyMei(e) + '</button>';
      }).join('') + '<button class="eq-b sub" data-a="setintro" data-v="">自動</button></div>';
    }
  } else h += '<div class="eq-warn">名冊沒有人,沒有引薦人,無法尋訪。</div>';
  if (!open) h += '<div class="eq-warn">書院尚未開放(名聲 ' + STUDY_CFG.openFame + ')。</div>';
  return h;
}
function huntBtns(ctx, kind) {
  var st = studyTick(Date.now()), sta = st.sta.n, n = st.cnt[kind], ok0 = n > 0 && sta >= STUDY_CFG.sta.near, ok1 = n > 0 && sta >= STUDY_CFG.sta.far;
  return '<div class="eq-go"><button class="eq-b big' + (ok0 ? '' : ' off') + '" data-a="go" data-k="' + kind + '" data-f="0">' + eqArt('xf_5', 'eq-xf') + ' 近訪(⚡' + STUDY_CFG.sta.near + ')</button>' +
    '<button class="eq-b big gold' + (ok1 ? '' : ' off') + '" data-a="go" data-k="' + kind + '" data-f="1">' + eqArt('xf_6', 'eq-xf') + ' 遠訪(⚡' + STUDY_CFG.sta.far + ')</button></div>' +
    '<div class="eq-note">' + (kind === 'talent' ? '近訪:碎片 45%、線索 30%、人才 10%、寶具 15%;遠訪:碎片 35%、線索 30%、人才 10%、寶具 25%(未計魅力加成)。' : '近訪 60%、遠訪 80% 尋到一匹馬,尋不到得碎片 ' + STUDY_CFG.horseMiss + '。') + '</div>';
}
function huntResultHtml(x) {
  var r = x.result, h = '<b>' + (x.far ? '遠訪' : '近訪') + ':' + huntFacName(x.intro.fac) + ' · ' + eqEsc(x.intro.name) + ' 引薦</b>', it, c;
  if (r.cat === 'shard' || r.cat === 'none') h += '<div class="hunt-scroll">' + (r.cat === 'none' ? '無功而返…' : '') + '得到碎片 +' + r.n + '</div>';
  else if (r.cat === 'clue') h += '<div class="hunt-scroll">' + eqArt('xf_1', 'eq-xf') + ' ' + huntFacName(r.fac) + '陣營線索 +' + r.n + '</div>';
  else if (r.cat === 'card') {
    c = r.card;
    h += '<div class="hunt-scroll">人才:<b class="' + EQ_QCLS[Math.min(3, r.q + 1)] + '">' + eqEsc(c.c.name) + '</b>(' + (c.c.fig ? '名人' : '路人') + ',' + eqEsc((CARD_GRADE[c.c.gr] || {}).name || '') + '階)<br>' + (c.how === 'roster' ? '已加入名冊' : '名冊已滿,轉為碎片 +' + c.shards) + '</div>';
  } else if (r.cat === 'relic' || r.cat === 'horse') {
    it = r.item && r.item.item;
    if (r.cat === 'horse') h += '<div class="hunt-gate open">' + eqArt('hs_gate_open', 'eq-gate') + eqArt('eqh_' + (r.q + 1), 'eq-horse ' + EQ_QCLS[r.q]) + '</div>';
    if (it) h += '<div class="eq-row cur">' + ldEquipItemHtml(it) + '</div>';
    if (r.item && r.item.salvaged) h += '<span class="eq-warn">背包已滿(' + GEAR_CFG.inv + '),這件已自動分解:' + (r.item.gain.shards ? '碎片 +' + r.item.gain.shards : eqEsc(eqMatsText(r.item.gain.mats))) + '</span>';
    if (x.pityHit) h += '<span class="eq-note">保底觸發(' + (x.pityHit === 'gold' ? '金' : '紫') + ')</span>';
  } else if (r.cat === 'horse') h += '';
  return h;
}
function huntExchangeHtml(ctx) {
  var fac = ctx.fac || 'wei', st = studyTick(Date.now()), list = studyExchangeList(fac, Date.now()), h = '', have = st.clue[fac] | 0;
  h += '<div class="eq-chips">' + STUDY_FACS.map(function (k) { return '<button class="ld-tab' + (fac === k ? ' on' : '') + '" data-a="fac" data-v="' + k + '">' + huntFacName(k) + ' ' + (st.clue[k] | 0) + '</button>'; }).join('') + '</div>';
  h += '<div class="eq-kv"><span>' + eqArt('xf_1', 'eq-xf') + ' ' + huntFacName(fac) + '陣營線索</span><b>' + have + '</b></div>';
  h += '<div class="eq-note">' + STUDY_CFG.clueCost.purple + ' 個換指定紫名人、' + STUDY_CFG.clueCost.gold + ' 個換指定金名人;每位名人每季限換 1 次。名冊滿時不能換(線索不會被扣)。</div>';
  list.forEach(function (f) {
    var ok = !f.used && have >= f.cost;
    h += '<div class="eq-row"><span class="eq-ico ' + (f.gr === 4 ? 'q3' : 'q2') + '"><span class="ld-ph eq-ic">' + eqEsc(f.name.charAt(0)) + '</span></span><div class="eq-bd"><b class="eq-nm ' + (f.gr === 4 ? 'q3' : 'q2') + '">' + eqEsc(f.name) + '</b><span class="eq-at">' + (f.gr === 4 ? '金' : '紫') + '名人 · 線索 ' + f.cost + '</span></div>' +
      '<div class="eq-bt">' + (f.used ? '<span class="eq-need">本季已換</span>' : '<button class="eq-b' + (ok ? '' : ' off') + '" data-a="ex" data-v="' + eqEsc(f.id) + '">兌換</button>') + '</div></div>';
  });
  return h;
}
function huntHtml(ctx) {
  var h = '<div class="eq-page eq-2c eq-hunt"><div class="eq-l">';
  h += '<div class="eq-smithrow">' + eqArt('st_host', 'eq-smith') + '<div class="eq-bubble">' + eqEsc(ctx.say || '遠道而來,想訪哪一位?') + '</div></div></div><div class="eq-r">';
  h += huntHead(ctx);
  if (!featureOn('seek_talent') && ctx.tab !== 'horse') ctx.tab = 'horse';   // @DORMANT seek_talent
  if (ctx.tab === 'clue') h += huntExchangeHtml(ctx);
  else {
    h += huntBtns(ctx, ctx.tab);
    if (ctx.res) h += '<div class="eq-result ok">' + ctx.res + '</div>';
  }
  return h + '</div></div>';
}
function huntTabList() { return HUNT_TABS.filter(function (t) { return featureOn('seek_talent') || t[0] === 'horse'; }); }   // @DORMANT seek_talent:關閉時只剩尋訪馬
function huntTabsHtml(ctx) {
  return huntTabList().map(function (t) { return '<button class="ld-tab' + (ctx.tab === t[0] ? ' on' : '') + '" data-a="tab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('');
}
function huntRender(el, ctx) {
  ctx.hEl = el;
  el.innerHTML = huntHtml(ctx);
  if (ctx.tabsEl) { ctx.tabsEl.innerHTML = huntTabsHtml(ctx); ctx.tabsEl.onclick = function (ev) { huntClick(ctx, ev); }; }
  el.onclick = function (ev) { huntClick(ctx, ev); };
}
function huntReasonText(r) {
  return { closed: '書院還沒開放', cnt: '今日次數用完了(每天 0:00 補)', sta: '城主體力不夠', nocard: '名冊沒有人,沒有引薦人', bad: '無法尋訪', seekoff: '尋訪人才・寶物尚未開放' }[r] || '無法尋訪';
}
function huntClick(ctx, ev) {
  var n = eqFindAct(ev, ctx.hEl) || eqFindAct(ev, ctx.tabsEl), a, v, x, r, cs, st;
  if (!n) return false;
  a = n.getAttribute('data-a'); v = n.getAttribute('data-v');
  cs = eqCs();
  if (a === 'tab') { if (v !== 'horse' && !featureOn('seek_talent')) v = 'horse'; ctx.tab = v; ctx.res = null; ctx.pickIntro = false; huntRender(ctx.hEl, ctx); return true; }   // @DORMANT seek_talent
  if (a === 'intro') { ctx.pickIntro = !ctx.pickIntro; huntRender(ctx.hEl, ctx); return true; }
  if (a === 'setintro') { st = studyRead(Date.now()); st.intro = v || ''; studyWrite(st); ctx.pickIntro = false; huntRender(ctx.hEl, ctx); return true; }
  if (a === 'fac') { ctx.fac = v; huntRender(ctx.hEl, ctx); return true; }
  if (a === 'go') {
    x = studyRoll(n.getAttribute('data-k'), +n.getAttribute('data-f'), cs, Date.now());
    if (!x.ok) { eqToast(huntReasonText(x.reason)); huntRender(ctx.hEl, ctx); return true; }
    ctx.res = huntResultHtml(x);
    ctx.say = x.result.cat === 'horse' ? '好馬!' : (x.result.cat === 'none' ? '下次再來。' : '有收穫!');
    huntRender(ctx.hEl, ctx);
    return true;
  }
  if (a === 'ex') {
    r = studyExchange(ctx.fac || 'wei', v, cs, Date.now());
    if (!r.ok) eqToast(r.reason === 'full' ? '名冊已滿,請先熔鍊或遣散' : (r.reason === 'used' ? '這位名人本季已兌換過' : (r.reason === 'clue' ? '線索不足(需 ' + r.need + ')' : '無法兌換')));
    else eqToast('兌換成功:' + (r.card && r.card.c ? r.card.c.name : '') + ' 加入名冊');
    huntRender(ctx.hEl, ctx);
    return true;
  }
  return false;
}
var HUNT_TIMER = 0;
if (typeof ldNavRegister === 'function') {
  ldNavRegister({
    id: 'study', title: '書院', bg: 'sc_study',
    res: function () { var s = studyStamina(Date.now()); return [['⚡', s.n + '/' + s.max]]; },
    build: function (el, ctx) { if (!ctx.tab || (ctx.tab !== 'horse' && !featureOn('seek_talent'))) ctx.tab = featureOn('seek_talent') ? 'talent' : 'horse'; ctx.res = null; ctx.pickIntro = false; huntRender(el, ctx); },   // @DORMANT seek_talent
    onShow: function (el, ctx) {
      huntRender(el, ctx);
      if (!HUNT_TIMER && typeof setInterval === 'function') HUNT_TIMER = setInterval(function () { var e = ctx.hEl && ctx.hEl.querySelector ? ctx.hEl.querySelector('.hunt-sta b') : null, s; if (!e || !e.isConnected) return; s = studyStamina(Date.now()); e.textContent = s.n + ' / ' + s.max + (s.nextIn ? '(下 1 點 ' + huntFmtMs(s.nextIn) + ')' : ''); }, 5000) || 0;
    },
    onHide: function () { if (HUNT_TIMER && typeof clearInterval === 'function') { clearInterval(HUNT_TIMER); HUNT_TIMER = 0; } }
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { huntHtml: huntHtml };
