// js/cardsui.js — 卡牌與酒館 第一階段介面(PLAN_CARDS §2.3 名帖、§3A.6 卡面、§4.13.8 職業條、§7A 名額與請辭):招募頁(酒館 / 縣試 / 指名)+ 卡包頁(cardsui_bag.js)+ 名冊頁(列表 + 詳情)。
// 抽到就是抽到:開批的 7 張直接進卡包(cs.bag),酒令只在『任用』(卡包 → 名冊)時花;手動開批時以 typeof 守衛呼叫 cardsRevealPlay(cards, onDone)(js/cardsreveal.js),onDone 後才入包並刷新介面。
// 文字卡 v1:品階用「色(--gr0~--gr4)+ 品字 + 角飾數」三重表示;陣營字用墨色;頭像 = 中性人物剪影(依品階上色)+ 職業名;名人用 assets/portraits/<id>.webp,路人用 assets/portraits/generic/<職業id>_<變體a-c>.webp(不分品階;舊命名 <職業id>_<品階0-3>_<a-d>.webp 次選;缺圖回退剪影)。詞條 / 技能 / 職業 / 圖例可點,彈出說明浮層(面板內自管:panelmgr 規定 card 不能與大面板並開)。
// 入口:點酒館 / 考場 / 殿試台建築(ui.js tapObjectAt → cardsUiTap);或 cardsUiOpen(tab)。面板走 panelmgr('cards');引擎在 cards.js,資料在 carddata.js。
// 不發聲、不推播、不紅點。ES2017;不用 ?. ??。
// 全域名稱:cardsUiOpen cardsUiClose cardsUiToggle cardsUiTap cardsUiRender cardsUiHtmlCard cardsUiCtx cardsUiFmtCd cardsUiInfo cardsUiInfoHtml cardsUiAvatarVar cuRevealThen cuDoOpen cuFinishBatch cuLastHtml
var CU_TAB_NAME = { O: '總覽', T: '酒館', E: '縣試', N: '指名', B: '卡包', R: '名冊' };   // 殿試池已改為指定池 'N'(cardsui_named.js);舊呼叫 cardsUiOpen('G') 轉到 'N'
var CU_TYPE_TAB = { tavern: 'T', kao_chang: 'E', dian_shi_tai: 'N' };   // 酒館建築另由 tavern_scene.js 優先進入室內;考場 / 殿試台只開本介面
var CU_CLS = { war: '戰', cmd: '統', plan: '謀', econ: '經', life: '生', trait: '性', odd: '怪' };
var CU_ROMAN = ['', 'I', 'II', 'III', 'IV'];
var CU_LIVE_CITY = '城建類:資料已備,派駐於對口建築時計入;產出數值結算尚在接入(巡視綠光已有)';
var CU_LIVE_WAR = '討伐戰鬥中生效';
var cuMiss = {};
var cu = { open: false, tab: 'O', detail: null, confirm: null, el: null, timer: 0, msg: '', info: null, chain: false, nmode: 'fac', nkey: 0, revealing: false, last: null,
  bf: -1, br: '', bs: 'gr', bn: 1, bsel: {}, bid: null, ble: 0, bpend: null, omsg: '' };   // bf.. = 卡包分頁狀態(品階 / 職業分類篩選、排序、頁數、勾選、詳情、一鍵熔鍊門檻、待確認)
var CU_OPEN_MSG = { none: '尚無新批次', busy: '上一批還在開啟中', bagfull: '卡包與溢出區空位合計不足,先熔鍊或任用', closed: '尚未開放', bad: '請先選擇陣營或職業分類', ticket: '指名券不足' };

function cuEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function cardsUiFmtCd(ms) {
  var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  s = s % 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
function cardsUiCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('cuStyle')) return;
  var st = document.createElement('style');
  st.id = 'cuStyle';
  st.textContent = ':root{--gr0:#e9e4d6;--gr1:#3e8a74;--gr2:#365fa3;--gr3:#76489a;--gr4:#c39a2e;--cu-paper:#f4efe2;--cu-ink:#2a2620}' +
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--gr0:#5b574d;--gr1:#5fb39a;--gr2:#6a8fd0;--gr3:#a37bc6;--gr4:#e2c066;--cu-paper:#2c2922;--cu-ink:#ece6d6}}' +
    ':root[data-theme="dark"]{--gr0:#5b574d;--gr1:#5fb39a;--gr2:#6a8fd0;--gr3:#a37bc6;--gr4:#e2c066;--cu-paper:#2c2922;--cu-ink:#ece6d6}' +
    '#cardsPanel{position:fixed;top:calc(44px + env(safe-area-inset-top));left:6px;width:min(380px,calc(100vw - var(--side-w,48px) - 18px));max-height:min(78vh,calc(100vh - 56px - env(safe-area-inset-top)));display:flex;flex-direction:column;z-index:6;border-radius:10px;background:rgba(32,30,26,.97);color:#eee;box-shadow:0 4px 18px rgba(0,0,0,.5);font-size:14px}' +
    '#cardsPanel[hidden]{display:none}#cardsPanel .cuhd{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.12)}' +
    '#cardsPanel .cuhd{flex-wrap:wrap}#cardsPanel .cuhd b{flex:1 1 auto;min-width:0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#cardsPanel .cutabs{display:flex;gap:4px;flex:1 1 220px}#cardsPanel .cutab{flex:1;border:none;border-radius:6px;padding:6px 4px;min-height:44px;min-width:44px;background:rgba(255,255,255,.1);color:#eee}' +
    '#cardsPanel .cutab.on{background:#f0b45a;color:#222}#cardsPanel .cux{border:none;background:none;color:#eee;font-size:20px;min-width:44px;min-height:44px}#cardsPanel .cuq{border:1px solid rgba(255,255,255,.4);border-radius:50%;background:none;color:#eee;font-size:15px;width:44px;height:44px}' +
    '#cardsPanel .cubd{overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:8px}#cardsPanel .cur{display:flex;justify-content:space-between;align-items:center;padding:3px 0;gap:6px}' +
    '#cardsPanel button.cub{min-height:44px;margin:3px 3px 0 0;padding:4px 12px;border:none;border-radius:6px;background:#3a5a8a;color:#fff}#cardsPanel button.cub[disabled]{opacity:.35}' +
    '#cardsPanel button.cub.warn{background:#8a3a3a}#cardsPanel .cusub{opacity:.7;font-size:12px}#cardsPanel .cusec{margin-top:8px;font-weight:bold;opacity:.85}' +
    '#cardsPanel .cucard{position:relative;margin:6px 0;padding:6px 8px 6px 10px;border-radius:8px;background:var(--cu-paper);color:var(--cu-ink);border:3px solid var(--g);outline:1px solid var(--cu-ink);outline-offset:-4px}' +
    '#cardsPanel .cucard.g0{--g:var(--gr0)}#cardsPanel .cucard.g1{--g:var(--gr1)}#cardsPanel .cucard.g2{--g:var(--gr2)}#cardsPanel .cucard.g3{--g:var(--gr3)}#cardsPanel .cucard.g4{--g:var(--gr4);border-style:double;border-width:5px}' +
    '#cardsPanel .cucard.taken{opacity:.45}#cardsPanel .cuhead{display:flex;align-items:center;gap:6px}#cardsPanel .cuavw{display:flex;flex-direction:column;align-items:center;width:48px;flex:none}#cardsPanel .cuav{position:relative;width:44px;height:44px;border-radius:6px;border:2px solid var(--g);background:rgba(128,128,128,.14);overflow:hidden}#cardsPanel .cusil{position:absolute;left:0;top:0;width:100%;height:100%;fill:var(--g);opacity:.55}#cardsPanel .cuavc{position:absolute;right:1px;bottom:0;font-size:8px;line-height:8px;color:var(--g);filter:brightness(.8)}#cardsPanel .cuavj{font-size:10px;line-height:12px;margin-top:1px;white-space:nowrap}' +
    '#cardsPanel .cuav img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}#cardsPanel .cuname{font-weight:bold;font-size:16px}#cardsPanel .cugr{display:inline-block;min-width:22px;text-align:center;border:2px solid var(--g);border-radius:4px;font-weight:bold;margin-right:4px;color:var(--cu-ink)}' +
    '#cardsPanel .cucor{position:absolute;right:6px;top:2px;letter-spacing:1px;color:var(--g);filter:brightness(.8)}#cardsPanel .custat{display:flex;flex-wrap:wrap;gap:4px 8px;margin:4px 0;font-size:13px}' +
    '#cardsPanel .cujob{display:inline-block;margin:2px 4px 0 0;padding:1px 6px;border:1px solid var(--cu-ink);border-radius:4px;font-size:12px}#cardsPanel .cujob.zong{border-color:var(--gr4);box-shadow:0 0 0 1px var(--gr4)}' +
    '#cardsPanel .cutr{font-size:12px;margin-top:3px}#cardsPanel .cuchip{display:inline-flex;align-items:center;min-height:36px;margin:2px 4px 2px 0;padding:0 8px;border:1px solid var(--cu-ink);border-radius:6px;font-size:12px;cursor:pointer}#cardsPanel .cuchip.sk{background:rgba(54,95,163,.14)}#cardsPanel .cuchip.neg{border-style:dashed}#cardsPanel .cutag{font-style:normal;font-size:10px;margin-right:3px;padding:0 3px;border-radius:3px;background:var(--cu-ink);color:var(--cu-paper)}#cardsPanel details{margin-top:4px;font-size:12px;opacity:.85}#cardsPanel .cuink{color:var(--cu-ink)}#cardsPanel .cuwarn{color:#f0a060}#cardsPanel .cuinfo{position:absolute;left:0;right:0;top:0;bottom:0;z-index:2;overflow-y:auto;overscroll-behavior:contain;padding:10px;border-radius:10px;background:rgba(32,30,26,.985);color:#eee}#cardsPanel .cuinfo h4{margin:0 0 6px;font-size:16px}#cardsPanel .cuinfo .cuil{margin:5px 0;font-size:13px;line-height:1.5}#cardsPanel .cuinfo .cuil b{color:#f0b45a}#cardsPanel .cuinfo .cuit{display:inline-block;margin:0 4px 4px 0;padding:0 6px;border:1px solid rgba(255,255,255,.4);border-radius:4px;font-size:11px}' + ((typeof BN_TEXT_CSS === 'string') ? BN_TEXT_CSS : '');
  document.head.appendChild(st);
}
function cuEnsure() {
  if (cu.el) return cu.el;
  if (typeof document === 'undefined' || !document.body) return null;
  cardsUiCss();
  var el = document.createElement('div');
  el.id = 'cardsPanel';
  el.hidden = true;
  el.addEventListener('click', cuClick);
  if (document.addEventListener) document.addEventListener('keydown', function (e) { if (e && e.key === 'Escape' && cu.open && cu.info) { cu.info = null; cardsUiRender(); } });   // Esc 關閉說明彈窗
  document.body.appendChild(el);
  cu.el = el;
  if (typeof panelRegister === 'function') panelRegister('cards', { kind: 'big', el: el, close: function () { cardsUiClose(true); } });
  return el;
}
function cuNow() { return Date.now(); }
function cuCs() {
  var cs = cardsGet(), r;
  if (cs) {
    cardsSync(cs, cuNow(), cardsVenueOpen);
    if (!cu.revealing && cardsBagFlush(cs, { now: cuNow() }) > 0) cuSave();   // 中斷 / 無特效時殘留的待入包批次:直接入包
    r = cardsOverSettle(cs, cuNow());   // 溢出區結算:到期熔碎片 / 有空位就納入
    if (r.expired || r.filled) cuSave();
  }
  return cs;
}
function cardsUiCtx() {
  var res = (typeof world !== 'undefined' && world && world.res) || {};
  if (typeof academyCtx === 'function') return academyCtx();   // 學院系統(academy.js):院級 / 資源
  return { coin: res.coin || 0, xue: res.xue || 0 };   // 無學院系統時 academy 缺值即「尚未開放」
}

// ---------- 卡面(文字卡 v1) ----------
function cuJobChips(c) {
  var h = '';
  Object.keys(c.ja).forEach(function (id) {
    var j = CARD_JOB_BY_ID[id], t = c.ja[id], dots = '';
    var i;
    if (!j) return;
    for (i = 1; i <= 4; i++) dots += i <= t ? '●' : '○';
    h += '<span class="cujob cuchip' + (t === 4 ? ' zong' : '') + '" data-a="info" data-k="job" data-key="' + id + ':' + t + '">' + cuEsc(j.t[t - 1]) + ' ' + dots + '</span>';
  });
  return h;
}
function cuSkillChips(c) {
  var l = (typeof cardsSkillList === 'function') ? cardsSkillList(c) : [], h = '';
  l.forEach(function (k) { h += '<span class="cuchip sk" data-a="info" data-k="skill" data-key="' + k.id + '"><i class="cutag">技能</i>' + cuEsc(k.n) + '</span>'; });
  return h ? '<div class="cutr">' + h + '</div>' : '';
}
// 戰法區塊(bn_text.js bnSkillsBlockHtml;所有卡都顯示)
function cuBnSkills(c, mini) { return (typeof bnSkillsBlockHtml === 'function') ? bnSkillsBlockHtml(c, mini) : cuSkillChips(c); }
function cuTraitsHtml(c, full, mini) {
  var list = [], h = '';
  if (c.trn) c.trn.forEach(function (t, i) {
    var f = null, k;
    for (k = 0; k < CARD_TRAITS.length; k++) if (CARD_TRAITS[k].n === t[0]) { f = CARD_TRAITS[k]; break; }
    if (!t[1] && f) list.push({ n: f.n, d: cuTraitDesc(f), ex: 0, neg: f.neg, k: 'trait', key: f.id });
    else list.push({ n: t[0], d: (typeof bnXTraitText === 'function') ? bnXTraitText(t[2]) : t[2], ex: t[1], k: 'xtrait', key: (c.fig || '') + '|' + i });
  });
  c.tr.forEach(function (id) { var t = CARD_TRAIT_BY_ID[id]; if (t && !(c.trn && c.trn.some(function (x) { return x[0] === t.n; }))) list.push({ n: t.n, d: cuTraitDesc(t), ex: 0, neg: t.neg, k: 'trait', key: id }); });
  list = list.filter(function (t) { return t.d !== null || t.k === 'xtrait'; });   // 一般詞條 d === null = 只與舊戰鬥系統有關、新戰鬥沒有對應 → 隱藏
  function one(t) { return '<span class="cuchip' + (t.neg ? ' neg' : '') + '"' + (mini ? '' : ' data-a="info" data-k="' + t.k + '" data-key="' + cuEsc(t.key) + '"') + '>' + (t.ex ? '<i class="cutag">專屬</i>' : '') + cuEsc(t.n) + '</span>'; }
  if (!list.length) return '';
  if (!full) return '<div class="cutr">' + list.map(one).join('') + '</div>';
  list.forEach(function (t) { h += '<div class="cutr cutd">' + one(t) + (t.d ? '<span class="cutx">' + cuEsc(t.d) + '</span>' : '') + '</div>'; });
  return h;
}
// 詞條白話說明:bn_text.js 的 bnTraitText(null = 隱藏);缺 bn_text.js 時退回原說明
function cuTraitDesc(t) { return (typeof bnTraitText === 'function') ? bnTraitText(t.id) : (t.d || ''); }
// 頭像變體 a|b|c:先照舊雜湊算 v0;卡有 sex 時,若 v0 的頭像性別不符則往後(循環)找同性別者。
// 舊卡 sex 由 cards.js 依「舊雜湊頭像」補上,故 v0 必符、頭像不變。該職業 3 張都沒有該性別頭像時,cardsUiPortraitJob 已先換成相近職業(CUI_SEX_ALT)。
function cardsUiAvatarVar(c, pj) {
  var s = String(c.name) + '|' + c.main + '|', h = 7, i, k, v;
  for (i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  h %= 3;
  if (c.sex && !c.fig && typeof portraitGenderOf === 'function' && (pj || (pj = cardsUiPortraitJob(c)))) {
    for (k = 0; k < 3; k++) { v = 'abc'.charAt((h + k) % 3); if (portraitGenderOf('generic/' + pj + '_' + v) === c.sex) return v; }
  }
  return 'abc'.charAt(h);
}
// 某職業頭像沒有某性別時的替代職業(取同性質、有該性別頭像者)。目前只有女性缺:caishi jiaohua jiqiao lizhi niangzao yetie yingzao
var CUI_SEX_ALT = { caishi: 'nongshi', jiaohua: 'wenshu', jiqiao: 'zaozhi', lizhi: 'wenshu', niangzao: 'paochu', yetie: 'taoci', yingzao: 'fangzhi' };
function cuHasSex(pj, sex) {
  return ['a', 'b', 'c'].some(function (v) { return portraitGenderOf('generic/' + pj + '_' + v) === sex; });
}
// 卡片主職業(職業詞條最高階者)→ 頭像職業 id;沒有職業詞條回 null(回退剪影);卡有 sex 且該職業無同性別頭像時換成 CUI_SEX_ALT 的職業
function cardsUiPortraitJob(c) {
  var best = null, bt = 0, id, pj = null;
  if (c.main && CARD_JOB_PORTRAIT[c.main]) pj = CARD_JOB_PORTRAIT[c.main];
  else {
    for (id in (c.ja || {})) if (CARD_JOB_PORTRAIT[id] && c.ja[id] > bt) { bt = c.ja[id]; best = id; }
    pj = best ? CARD_JOB_PORTRAIT[best] : null;
  }
  if (pj && c.sex && !c.fig && typeof portraitGenderOf === 'function' && !cuHasSex(pj, c.sex) && CUI_SEX_ALT[pj]) pj = CUI_SEX_ALT[pj];
  return pj;
}
function cuImgFail(img) {
  var m = img.getAttribute('src'), a = img.getAttribute('data-alt');
  if (m) cuMiss[m] = 1;
  if (a && !cuMiss[a]) { img.removeAttribute('data-alt'); img.setAttribute('src', a); return; }
  img.remove();
}
function cuAvatarHtml(c) {
  var j = CARD_JOB_BY_ID[c.main], G = CARD_GRADE[c.gr], corner = '', i, src = '', alt = '', img = '', pj;
  for (i = 0; i < G.corner; i++) corner += '◆';
  if (c.fig) src = 'assets/portraits/' + cuEsc(c.fig) + '.webp';
  else if ((pj = cardsUiPortraitJob(c))) {
    src = 'assets/portraits/generic/' + pj + '_' + cardsUiAvatarVar(c, pj) + '.webp';
    if (c.gr <= 3) alt = 'assets/portraits/generic/' + pj + '_' + c.gr + '_' + cardsUiAvatarVar(c, pj) + '.webp';
    if (cuMiss[src] && alt) { src = alt; alt = ''; }
  }
  if (src && !cuMiss[src]) img = '<img alt="" src="' + src + '"' + (alt ? ' data-alt="' + alt + '"' : '') + ' onerror="cuImgFail(this)">';
  return '<div class="cuavw"><div class="cuav"><svg class="cusil" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14" r="7.5"/><path d="M5 40c0-9 6-14.5 15-14.5S35 31 35 40z"/></svg>' + img + '<span class="cuavc">' + corner + '</span></div><span class="cuavj">' + (j ? cuEsc(j.name) : '') + '</span></div>';
}
function cardsUiHtmlCard(c, opt) {
  var G = CARD_GRADE[c.gr], corner = '', i, st = (opt && opt.stats) || c.st;
  for (i = 0; i < G.corner; i++) corner += '◆';
  var h = '<div class="cucard g' + c.gr + (opt && opt.taken ? ' taken' : '') + '"><span class="cucor">' + corner + '</span>';
  h += '<div class="cuhead">' + cuAvatarHtml(c) + '<div><div><span class="cugr">' + G.ch + '</span><span class="cuname">' + cuEsc(c.name) + '</span>' +
    (c.zi ? '<span class="cusub">(' + cuEsc(c.zi) + ')</span>' : '') + '</div><div class="cusub cuink">' + CARD_FAC[c.fac] + ' · ' + CARD_LEARN[c.learn] + ' · <span class="cuchip" style="min-height:28px;margin:0" data-a="info" data-k="legend" data-key="tai">才 ' + c.tai + '</span>' + (c.fig ? ' · 名人' : '') + '</div></div></div>';
  h += '<div class="custat">' + CARD_STATS.map(function (n, k) { return '<span>' + n + ' ' + st[k] + '</span>'; }).join('') + '</div>';
  h += '<div>' + cuJobChips(c) + '</div>' + cuBnSkills(c, !!(opt && opt.mini)) + cuTraitsHtml(c, !!(opt && opt.full), !!(opt && opt.mini));
  return h + (opt && opt.extra ? opt.extra : '') + '</div>';
}

// ---------- 招募頁 ----------
function cuBagLine(cs) {
  var cap = cardsBagCap(), n = cs.bag.length, ov = cs.bagOver ? cs.bagOver.length : 0;
  return '<div class="cur"><span>卡包 <b>' + n + '/' + cap + '</b>' + (ov ? ' <span class="cusub">· 溢出 ' + ov + ' 張</span>' : '') + '</span><button class="cub" data-a="tab" data-t="B" style="margin:0">查看卡包</button></div>';
}
function cuVenueHtml(cs, v) {
  var V = CARD_VENUES[v], now = cuNow(), no = cardsPeriodNo(v, now), th = cardsVenueTheme(v, no), n = cs.acc[v].length, h = '', nx, full = !cardsBagCanOpen(cs);
  if (!cardsVenueOpen(v)) return '<div class="cur"><span>' + V.name + '尚未開放(需研發對應科技)</span></div>';
  nx = cardsNextIn(cs, v, now);
  h += '<div class="cur"><span>' + V.alias + ' · 每 ' + V.unit + '一批</span><span class="cusub">' + cuEsc(th.text) + '</span></div>';
  h += '<div class="cur"><span>待閱批次 <b>' + n + '/' + V.cap + '</b></span><span class="cusub">' + (nx === null ? '已滿 ' + n + '/' + V.cap : '下一批 <span data-cd="' + v + '">' + cardsUiFmtCd(nx) + '</span>') + '</span></div>';
  if (v === 'E') h += '<div class="cusub">文鬥小遊戲尚未實作,評等暫以 1 星計</div>';
  h += cuBagLine(cs);
  h += '<button class="cub" data-a="open" data-v="' + v + '"' + (n && !full ? '' : ' disabled') + '>' + (n ? '開啟下一批(' + V.batch + ' 張入卡包)' : '尚無新批次') + '</button>';
  if (n && full) h += '<div class="cuwarn">卡包與溢出區空位合計不足 ' + CARD_BAG.batchNeed + ' 張,新批暫存不開;請先熔鍊或任用卡包裡的人。</div>';
  else if (n && cardsBagRoom(cs) < CARD_BAG.batchNeed) h += '<div class="cusub">卡包空位不足 ' + CARD_BAG.batchNeed + ' 張:多出的卡會進溢出區(24 小時內沒空位納入就熔成碎片)。</div>';
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  return h + cuLastHtml(v);
}

// 抽卡特效掛點(js/cardsreveal.js 提供 cardsRevealPlay(cards, onDone));沒有該函式就直接 done。done 只會執行一次
// quick = true:不播特效直接 done(全部開啟的第 2 批起,避免連播多次漫長特效;結果進摘要)
function cuRevealThen(cards, done, quick) {
  var fin = false;
  function once() { if (fin) return; fin = true; cu.revealing = false; try { done(); } catch (e) { /* 略過 */ } }
  if (quick || typeof cardsRevealPlay !== 'function') { once(); return; }
  cu.revealing = true;
  try { cardsRevealPlay(cards, once); } catch (e) { once(); }
}
// 結果摘要累計:chain 時多批合併成一份。items 的 how:bag 入包 auto 自動熔爐 token 化為信物 shard 信物已滿轉碎片
function cuLastAdd(label, tab, res, fresh) {
  var L = cu.last;
  if (fresh || !L) L = cu.last = { label: label, tab: tab, batches: 0, items: [], added: 0, overN: 0, dissolved: 0, tokenN: 0, shardN: 0, shards: 0, tokens: 0, lost: 0 };
  L.batches++; L.added += res.added; L.overN += (res.over | 0); L.dissolved += res.dissolved; L.tokenN += res.tokenN; L.shardN += res.shardN; L.shards += res.shards; L.tokens += res.tokens; L.lost += res.lost;
  res.items.forEach(function (it) { if (it.how !== 'skip') L.items.push(it); });
  return L;
}
// 開批後入包的收尾(特效 onDone 之後):入包、記摘要、存檔、刷新。回 commit 結果(無待入包批次回 null)
function cuFinishBatch(v, label, fresh, tab) {
  var cs = cardsGet(), res;
  if (!cs) return null;
  res = cardsBagCommit(cs, v, { now: cuNow() });
  if (!res.ok) return null;
  cuLastAdd(label, tab || (v === 'G' ? 'N' : v), res, fresh);
  cuSave();
  return res;
}
// 手動開一批(酒館 / 縣試):開批 → 特效 → 入包
function cuDoOpen(cs, v) {
  var r = cardsBagStage(cs, v);
  if (!r.ok) { cu.msg = CU_OPEN_MSG[r.reason] || '無法開批'; if (typeof showToast === 'function') showToast(cu.msg); return; }
  cuSave();
  cuRevealThen(r.cards, function () {
    cuFinishBatch(v, CARD_VENUES[v].name, true);
    if (cu.open) cardsUiRender();
  });
}
function cuItemRow(it) {
  var c = it.c, G = CARD_GRADE[c.gr], j = CARD_JOB_BY_ID[c.main], corner = '', i, tag;
  for (i = 0; i < G.corner; i++) corner += '◆';
  tag = { bag: '入卡包', over: '溢出區(24 小時)', auto: '自動熔爐 +' + (it.shards | 0) + ' 碎', token: '已有此人 → 信物 +1', shard: '信物已滿 → ' + (it.shards | 0) + ' 碎' }[it.how] || '';
  return '<div class="cur" style="border-left:5px solid var(--gr' + c.gr + ');padding-left:6px"><span><b>' + G.ch + corner + '</b> ' + cuEsc(c.name) + (c.fig ? ' <span class="cusub">名人</span>' : '') +
    '<span class="cusub"> ' + (j ? j.t[(c.ja[c.main] || 1) - 1] : '') + '</span></span><span class="cusub">' + tag + '</span></div>';
}
// 最近一次開批結果(只顯示在開批的分頁;連開多批時只列紫以上與名人)
function cuLastHtml(tab) {
  var L = cu.last, h, show, n;
  if (!L || (tab && L.tab !== tab)) return '';
  n = L.items.length;
  h = '<div class="cusec">' + cuEsc(L.label) + ' · 開 ' + L.batches + ' 批 ' + n + ' 張</div>';
  h += '<div class="cusub">' + (L.overN ? '進包 ' + L.added + ' 張、溢出 ' + L.overN + ' 張' : '入卡包 ' + L.added) + (L.dissolved ? ' · 自動熔爐 ' + L.dissolved : '') + (L.tokenN ? ' · 化為信物 ' + L.tokenN : '') + (L.shardN ? ' · 信物滿轉碎片 ' + L.shardN : '') +
    (L.shards ? ' · 碎片 +' + L.shards : '') + '</div>';
  show = n <= 7 ? L.items : L.items.filter(function (it) { return it.c.gr >= 3 || it.c.fig; }).slice(0, 24);
  show.forEach(function (it) { h += cuItemRow(it); });
  if (show.length < n) h += '<div class="cusub">(其餘 ' + (n - show.length) + ' 張為青藍以下,已入卡包 / 溢出區或自動熔爐)</div>';
  return h;
}

// ---------- 名冊頁 ----------
function cuRosterHtml(cs) {
  var cap = cardsCap(), h = '', list = cs.roster.slice().sort(function (a, b) { return b.gr - a.gr || b.tai - a.tai || a.no - b.no; });
  if (cu.detail) { var f = cardsFind(cs, cu.detail); if (f) return cuDetailHtml(cs, f); cu.detail = null; }
  h += '<div class="cur"><span>名額 <b>' + cs.roster.length + '/' + cap + '</b></span><span class="cusub">待定席 ' + cs.wait.length + '/' + CARD_CFG.waitSeats + '</span></div>';
  if (cs.lastRel) h += '<button class="cub" data-a="undo">復原最近請辭</button>';
  if (!list.length) h += '<div class="cusub">名冊空空如也。到酒館、縣試、指名開批,再從卡包任用人才吧。</div>';
  list.forEach(function (e) { h += cuRowHtml(e, false); });
  if (cs.wait.length) { h += '<div class="cusec">待定席</div>'; cs.wait.forEach(function (e) { h += cuRowHtml(e, true); }); }
  if (cs.wander.length) { h += '<div class="cusec">故人(流浪)</div>'; cs.wander.forEach(function (e) { h += cuRowHtml(e, false, true); }); }
  return h;
}
function cuRowHtml(e, wait, wander) {
  var G = CARD_GRADE[e.gr], j = CARD_JOB_BY_ID[e.main], corner = '', i;
  for (i = 0; i < G.corner; i++) corner += '◆';
  return '<div class="cur" data-a="detail" data-id="' + e.id + '" style="border-left:5px solid var(--gr' + e.gr + ');padding-left:6px;min-height:44px;cursor:pointer"><span><b>' + G.ch + corner + '</b> ' + cuEsc(e.name) + ' ' + (e.star ? '🔒' : '') + (e.starLv ? '★' + e.starLv + ' ' : '') +
    '<span class="cusub"> ' + (j ? j.t[(e.ja[e.main] || 1) - 1] : '') + (e.at ? ' · 派駐' : '') + (e.study ? ' · 進修中' : '') + '</span></span><span class="cusub">才 ' + e.tai + (wait ? ' · 待定' : '') + (wander ? ' · 流浪' : '') + '</span></div>';
}
function cuDetailHtml(cs, f) {
  var e = f.e, h = '<button class="cub" data-a="back">‹ 返回名冊</button>', k, chk, sl = cardsJobSlots(e);
  h += cardsUiHtmlCard(e, { full: true, stats: cardsStats(e), extra: '<div class="cusub cuink">出身:' + (e.org.k === 'pin' ? '縣試 ' + CARD_PIN[e.org.v] : CARD_VENUES[e.pool].orgName) + ' · 招募序 ' + e.no + (e.tok ? ' · 信物 ' + e.tok : '') + ' · 職業槽 ' + sl.used + '/' + sl.cap + '</div>' });
  if (e.fig && typeof ethnicOfFig === 'function' && typeof ETHNIC_LOOK !== 'undefined') { var eo = ethnicOfFig(e.fig); if (eo && ETHNIC_LOOK[eo.eth]) h += '<div class="cusub cuink">族別:' + cuEsc(ETHNIC_LOOK[eo.eth].name) + '(服飾與髮式參考)</div>'; } // 缺資料不顯示
  h += '<div class="cusec">職業專精</div>';
  for (k in e.ja) {
    var j = CARD_JOB_BY_ID[k], t = e.ja[k];
    h += '<div class="cusub" style="opacity:1;cursor:pointer" data-a="info" data-k="job" data-key="' + k + ':' + t + '">' + cuEsc(j.name) + ':' + j.t.map(function (n, i) { return i < t ? '<b>' + n + '</b>' : n; }).join(' → ') + '<br>對口 ' + cuEsc(j.post) + ' · 加成 +' + CARD_JOB_TIERPCT[t] + ' %(' + cuEsc(j.eff) + ')' + (t === 4 ? ' · 宗師舞台:' + cuEsc(j.stage) : '') + '</div>';
  }
  chk = cardsUpgradeCheck(e, cardsUiCtx());
  if (typeof cuAcademyHtml === 'function' && f.list === 'roster') h += cuAcademyHtml(cs, e);   // 學院進修 / 升階(academyui.js)
  else h += '<div class="cusec">升階</div><div class="cusub" style="opacity:1">' + (chk.ok ? '條件已達' : cuEsc(chk.reasons.join(';'))) + '</div>';
  if (typeof cuStarHtml === 'function' && f.list !== 'wander') h += cuStarHtml(cs, e);   // 強化(升星,卡片熔爐碎片;cardsui_bag.js)
  if (typeof cuNpcDetailHtml === 'function') h += cuNpcDetailHtml(cs, e, f);   // 親近 / 所在 / 請託 / 升階(npcui.js)
  h += '<div class="cusec">管理</div>';
  if (f.list === 'wait') h += '<button class="cub" data-a="accept" data-id="' + e.id + '"' + (cs.roster.length >= cardsCap() ? ' disabled' : '') + '>收入名冊</button>';
  if (f.list === 'wander') h += '<button class="cub" data-a="recall" data-id="' + e.id + '">請回(🎴' + CARD_RECALL_COST + ' + 1 名額)</button>';
  if (f.list !== 'wander') h += '<button class="cub" data-a="star" data-id="' + e.id + '">' + (e.star ? '🔒 已鎖定(點此解除)' : '鎖定(防止誤請辭)') + '</button>';
  if (f.list !== 'wander' && cu.confirm !== e.id) h += '<button class="cub warn" data-a="rel" data-id="' + e.id + '">請辭</button>';
  if (cu.confirm === e.id) {
    var back = e.fig ? '名人將轉為流浪,可花酒令請回。' : '返還 ' + Math.round((e.cost || 0) * CARD_WINE.refundRate * CARD_WINE.shardPerToken) + ' 碎片。';
    if (e.starLv) back += '已投入升星的碎片不退還。';
    h += '<div class="cuwarn">確定請辭「' + cuEsc(e.name) + '」?' + back + (e.at ? ' 目前派駐中,將一併卸任。' : '') + '</div><button class="cub" data-a="relno">否</button><button class="cub warn" data-a="relyes" data-id="' + e.id + '">是,請辭</button>';
  }
  if (cu.msg) h += '<div class="cuwarn">' + cuEsc(cu.msg) + '</div>';
  return h;
}

// ---------- 說明浮層(內容全由資料表即時組出,不寫死數值) ----------
function cuFill(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] !== undefined ? o[k] : m; }); }
// 回傳 { title, tags:[字], lines:[[標題, 內文]] };查無回 null。kind:trait(一般詞條 id)/ xtrait(名人專屬 '名人id|序')/ job('職業id:階')/ skill(技能 id)/ legend
function cardsUiInfo(kind, key) {
  var o = { title: '', tags: [], lines: [] }, t, j, p, s, f, i, n, names;
  if (kind === 'bnskill') return (typeof bnSkillInfo === 'function') ? bnSkillInfo(key) : null;
  if (kind === 'trait') {
    t = CARD_TRAIT_BY_ID[key];
    if (!t) return null;
    o.title = t.n;
    o.tags.push((CU_CLS[t.cls] || '') + '類', t.city ? '城建' : '戰事');
    if (t.neg) o.tags.push('負面');
    o.lines.push(['效果', cuTraitDesc(t) || t.d]);
    o.lines.push(['來源', (typeof bnTraitHasBattle === 'function' && bnTraitHasBattle(t.id)) ? '人物天生特質,上陣時依討伐戰鬥規則計入' + (t.city ? ';另有城市面效果' : '') : (t.city ? '人物天生特質,於城市經營時生效' : '人物天生特質')]);
    j = null;
    if (t.conv) {
      p = t.conv.split(':'); j = CARD_JOB_BY_ID[p[0]]; n = +p[1];
      if (j && CARD_JOB_TIERPCT[n] !== undefined) o.lines.push(['已併入', j.name + ' ' + CU_ROMAN[n] + '(' + j.t[n - 1] + '),該階加成 +' + CARD_JOB_TIERPCT[n] + ' %(' + j.eff + ');新生成人物不再抽到']);
    }
    o.lines.push(['適用職司', j ? j.post : (t.city ? '依詞條所述職務(派駐時)' : '戰場指揮')]);
    o.lines.push(['目前生效', t.city ? CU_LIVE_CITY : CU_LIVE_WAR]);
    names = (t.ex || []).map(function (x) { return CARD_TRAIT_BY_ID[x] ? CARD_TRAIT_BY_ID[x].n : x; });
    o.lines.push(['疊加', '同一詞條不重複;百分比加成與職業專精加算' + (names.length ? ';與「' + names.join('、') + '」互斥' : '')]);
    return o;
  }
  if (kind === 'xtrait') {
    p = String(key).split('|'); f = CARD_FIG_BY_ID[p[0]]; n = +p[1];
    if (!f || !f.tr[n]) return null;
    t = f.tr[n];
    o.title = t[0];
    o.tags.push(t[1] ? '名人專屬' : '名人詞條', '城建');
    o.lines.push(['效果', ((typeof bnXTraitText === 'function') ? bnXTraitText(t[2]) : t[2]) || '(史實設定,數值待定)']);
    o.lines.push(['史實依據', f.bio || '—']);
    o.lines.push(['適用職司', '依詞條所述職務(派駐時)']);
    o.lines.push(['目前生效', CU_LIVE_CITY]);
    o.lines.push(['疊加', '專屬詞條只屬於該名人,不與一般詞條重複;百分比加成與職業專精加算']);
    return o;
  }
  if (kind === 'job') {
    p = String(key).split(':'); j = CARD_JOB_BY_ID[p[0]]; n = +p[1];
    if (!j || !(n >= 1 && n <= 4)) return null;
    o.title = j.name + ' ' + CU_ROMAN[n] + '(' + j.t[n - 1] + ')';
    o.tags.push('職業專精', j.row + '行', j.tag);
    o.lines.push(['加成', '+' + CARD_JOB_TIERPCT[n] + ' %(對象:' + j.eff + ')']);
    o.lines.push(['階級', '共四階:' + j.t.join(' → ') + ';目前第 ' + CU_ROMAN[n] + ' 階。各階累計加成:' + CARD_JOB_TIERPCT.slice(1).map(function (v, i) { return CU_ROMAN[i + 1] + ' +' + v + ' %'; }).join('、')]);
    o.lines.push(['適用職司', j.post]);
    if (n === 4) o.lines.push(['宗師舞台', j.stage]);
    o.lines.push(['目前生效', j.id === 'bingshi' ? '文字守城城防分(和平模式時隱藏)' : CU_LIVE_CITY]);
    o.lines.push(['疊加', '同一人物不同職業各自計算;同職業只取目前階級(已是累計值),不重複相加']);
    return o;
  }
  if (kind === 'skill') {
    s = CARD_SKILL_BY_ID[key];
    if (!s) return null;
    o.title = s.n;
    o.tags.push('戰場技能', s.type, s.row === '通' ? '通用' : s.row + '行');
    o.lines.push(['效果', cuFill(s.d, s)]);
    o.lines.push(['類型', s.type + (s.cd ? ',冷卻 ' + s.cd + ' 秒' : ',無冷卻')]);
    o.lines.push(['目前生效', CU_LIVE_WAR + ';說明數值為占位']);
    o.lines.push(['取得', '技能張數依品階(' + CARD_GRADE.map(function (g) { return g.name + ' ' + g.skn; }).join('、') + '),依職業行取用']);
    return o;
  }
  if (kind === 'legend') {
    o.title = '卡面圖例';
    o.lines.push(['品階', CARD_GRADE.map(function (g) { var c = ''; for (i = 0; i < g.corner; i++) c += '◆'; return g.ch + c; }).join(' < ') + '。邊框色、品字、角飾 ◆ 數三者同步;品階越高,職業上限越高(' + CARD_GRADE.map(function (g) { return g.ch + ' ' + CU_ROMAN[g.jobMax]; }).join('、') + ')']);
    o.lines.push(['才 N', '五維加總的資質概覽,決定縣試品第與名冊排序;不直接換算產出']);
    o.lines.push(['五維 ' + CARD_STATS.join(''), '用於討伐戰鬥的兵力、攻防與部分職務判定']);
    o.lines.push(['職業 ●○', '職業專精階級(最高四階),四點亮幾點即第幾階;點職業可看加成百分比(' + CARD_JOB_TIERPCT.slice(1).map(function (v) { return '+' + v + ' %'; }).join('、') + ')']);
    o.lines.push(['專屬', '名人專屬詞條,只有該名人才有']);
    o.lines.push(['戰法', '討伐戰鬥用的戰法(指揮 / 主動 / 追擊 / 被動 / 大招),點戰法列可展開白話說明;路人依品階有 1~3 個,名人固定']);
        o.lines.push(['🔒', '名冊鎖定,鎖定中無法請辭']);
    o.lines.push(['★', '強化星數(0~' + CARD_FURNACE.starMax + '),用卡片熔爐的碎片在名冊詳情升星;每星攻 / 防 / HP +' + Math.round(CARD_FURNACE.starBonus.atk * 100) + ' %,' + CARD_FURNACE.starBonus.skillStar + ' 星起技能強化、' + CARD_FURNACE.starBonus.markStar + ' 星專屬標記;與 🔒 無關']);
    o.lines.push(['點擊', '詞條、技能、職業、才字都可以點開看說明']);
    return o;
  }
  return null;
}
function cardsUiInfoHtml(kind, key) {
  var o = cardsUiInfo(kind, key), h;
  if (!o) return '';
  h = '<div class="cuinfo" data-a="infox"><h4>' + cuEsc(o.title) + '</h4><div>' + o.tags.map(function (t, i) { return '<span class="cuit' + (o.tagCls && o.tagCls[i] ? ' ' + o.tagCls[i] : '') + '">' + cuEsc(t) + '</span>'; }).join('') + '</div>' +
    o.lines.map(function (l) { return '<div class="cuil"><b>' + cuEsc(l[0]) + '</b> ' + cuEsc(l[1]) + '</div>'; }).join('') +
    '<button class="cub" data-a="infox">關閉</button></div>';
  return h;
}

// ---------- 面板 ----------
function cardsUiRender() {
  var el = cuEnsure(), cs, h, tabs = ['O', 'T', 'E', 'N', 'B', 'R'];
  if (!el) return;
  cs = cuCs();
  if (!cs) { el.innerHTML = '<div class="cubd">尚無城邦資料</div>'; return; }
  h = '<div class="cuhd"><b>🍶 招賢 · 🎴 ' + cs.tok + ' · 🎫 ' + (cs.nameTokens | 0) + '</b><button class="cuq" data-a="info" data-k="legend" data-key="all" aria-label="圖例說明">?</button><button class="cux" data-a="close" aria-label="關閉">×</button><div class="cutabs">' + tabs.map(function (t) { return '<button class="cutab' + (cu.tab === t ? ' on' : '') + '" data-a="tab" data-t="' + t + '">' + CU_TAB_NAME[t] + '</button>'; }).join('') + '</div></div><div class="cubd">';
  if (cu.tab === 'R') h += cuRosterHtml(cs);
  else if (cu.tab === 'O' && typeof cuOverviewHtml === 'function') h += cuOverviewHtml(cs);
  else if (cu.tab === 'N' && typeof cuNamedHtml === 'function') h += cuNamedHtml(cs);
  else if (cu.tab === 'B' && typeof cuBagHtml === 'function') h += cuBagHtml(cs);
  else h += cuVenueHtml(cs, cu.tab === 'T' || cu.tab === 'E' ? cu.tab : 'T');
  el.innerHTML = h + '</div>' + (cu.info ? cardsUiInfoHtml(cu.info.k, cu.info.key) : '');
  el.setAttribute('data-tab', cu.tab);
}
function cuTick() {
  var cs, nodes, i, v;
  if (!cu.open || !cu.el || !cu.el.querySelectorAll) return;
  cs = cardsGet();
  if (!cs) return;
  if (typeof cuOverTick === 'function' && cuOverTick(cs)) { cardsUiRender(); return; }   // 溢出區:倒數文字每秒更新,到期 / 納入時整頁重畫
  nodes = cu.el.querySelectorAll('[data-cd]');
  for (i = 0; i < nodes.length; i++) {
    v = nodes[i].getAttribute('data-cd');
    var nx = cardsNextIn(cs, v, cuNow());
    if (nx === null || nx < 1000) { cardsUiRender(); return; }
    nodes[i].textContent = cardsUiFmtCd(nx);
  }
}
function cuSave() { if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } } }
function cuClick(ev) {
  var b = ev.target, a, cs = cardsGet(), v, r, id;
  while (b && b !== cu.el && !(b.getAttribute && b.getAttribute('data-a'))) b = b.parentNode;
  if (!b || b === cu.el || !cs) return;
  a = b.getAttribute('data-a'); v = b.getAttribute('data-v'); id = b.getAttribute('data-id');
  cu.msg = '';
  if (a === 'close') { cardsUiClose(); return; }
  if (cu.revealing) return;   // 抽卡特效播放中:不處理面板操作(特效結束 / 略過後才入包)
  if (a === 'info') { cu.info = { k: b.getAttribute('data-k'), key: b.getAttribute('data-key') }; cardsUiRender(); return; }
  if (a === 'infox') { cu.info = null; cardsUiRender(); return; }
  cu.info = null;
  if (a === 'tab') { cu.tab = b.getAttribute('data-t'); cu.omsg = ''; cu.detail = null; cu.confirm = null; cu.chain = false; cu.bid = null; cu.bpend = null; }
  else if (a === 'open') { cuDoOpen(cs, v); }
  else if (typeof cuBagClick === 'function' && cuBagClick(a, b, cs)) { /* 卡包分頁動作(cardsui_bag.js) */ }
  else if (typeof cuNamedClick === 'function' && cuNamedClick(a, b, cs)) { /* 總覽 / 指名分頁動作(cardsui_named.js) */ }
  else if (typeof cuNpcClick === 'function' && cuNpcClick(a, b, cs)) { /* 名冊詳情:前往 / 請託 / 升階(npcui.js) */ }
  else if (a === 'detail') { cu.detail = id; cu.confirm = null; }
  else if (a === 'back') { cu.detail = null; cu.confirm = null; }
  else if (a === 'star') { var f = cardsFind(cs, id); if (f) f.e.star = f.e.star ? 0 : 1; cuSave(); }
  else if (a === 'rel') cu.confirm = id;
  else if (a === 'relno') cu.confirm = null;
  else if (a === 'relyes') {
    r = cardsRelease(cs, id, { unassign: true, now: cuNow() });
    cu.confirm = null;
    if (r.ok) { cu.detail = null; cardsSyncTalents(); } else cu.msg = r.reason === 'locked' ? '已鎖定,先解除鎖定' : '無法請辭';
    cuSave();
  }
  else if (a === 'undo') { cardsUndoRelease(cs); cardsSyncTalents(); cuSave(); }
  else if (a === 'accept') { cardsAccept(cs, id); cardsSyncTalents(); cuSave(); }
  else if (a === 'recall') { r = cardsRecall(cs, id); if (!r.ok) cu.msg = r.reason === 'tok' ? '酒令不足' : '名額已滿'; else cardsSyncTalents(); cuSave(); }
  cardsUiRender();
}
function cardsUiOpen(tab) {
  var el = cuEnsure(), cs;
  if (!el) return;
  cu.revealing = false;   // 重新打開面板:不可卡在舊的特效狀態(殘留的待入包批次由 cuCs 直接入包)
  cs = cuCs();
  if (!cs) return;
  if (tab === 'G') tab = 'N';
  if (tab && CU_TAB_NAME[tab]) cu.tab = tab;
  if (cardsClaimGift(cs, cuNow()) > 0) cuSave();
  cu.open = true; cu.omsg = ''; cu.detail = null; cu.confirm = null; cu.msg = ''; cu.info = null; cu.chain = false; cu.bid = null; cu.bpend = null;
  if (typeof panelOpen === 'function') { try { panelOpen('cards'); } catch (e) { /* 略過 */ } }
  cardsUiRender();
  el.hidden = false;
  if (!cu.timer && typeof setInterval === 'function') cu.timer = setInterval(cuTick, 1000);
}
function cardsUiClose(fromMgr) {
  if (!cu.open && !(cu.el && !cu.el.hidden)) return;
  cu.open = false; cu.info = null;
  if (cu.el) cu.el.hidden = true;
  if (cu.timer && typeof clearInterval === 'function') { clearInterval(cu.timer); cu.timer = 0; }
  if (!fromMgr && typeof panelClose === 'function') { try { panelClose('cards'); } catch (e) { /* 略過 */ } }
}
function cardsUiToggle(tab) { if (cu.open) cardsUiClose(); else cardsUiOpen(tab); }
// 點擊掛點:ui.js tapObjectAt 呼叫;是酒館 / 考場 / 殿試台就開面板並回傳 true
function cardsUiTap(o) {
  if (!o || !CU_TYPE_TAB[o.type]) return false;
  if (o.type === 'tavern' && typeof tavernSceneEnter === 'function' && tavernSceneEnter()) return true;   // 酒館:進室內畫面(不可用時退回本介面)
  cardsUiToggle(CU_TYPE_TAB[o.type]);
  return true;
}
