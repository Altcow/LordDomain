// js/cardsui_codex.js — 卡包『大全』分頁 X(card_ui_redesign §6 / K7):子分頁『人物 / 戰法 / 隊伍』、全域搜尋框、收集進度,以及底部浮層(人物詳情、戰法詳情:說明、典故、拆解自誰、推薦使用人物)。
// 掛在 cardsui.js:cardsUiRender → cuCodexHtml(cs)(X 分頁)。點擊 / 輸入 / 下拉由本檔自掛 document 監聽(capture;只處理 data-kx、data-kxf、#cuxq),cuClick 不需改。
// 資料:codex.js(cxIndex、cxOwnMap、cxCard、cxSkillRows、cxBondsOf、cxTraitList、cxAvatar、cxTeams、cxTeamOwn、cxTeamFacs、cxTeamFacName、codexGoRoster、cxWorld、cxNorm、cxScore);
//   戰法詳情 cuPopSkill、人物傳記 cuPopBio、推薦 cuRecommend(cardsui_card.js);擁有 bnSkcOwned / bnSkcTier(bn_skcard.js);典故 BN_FLAVOR、兵種卡 BN_LEGION[id].flavor。全部 typeof 守衛。
// 全域名稱:CUX CUX_PAGE CUX_CAT CUX_TIERS CUX_CSS cuCodexCss cuCodexHtml cuCodexClick cuCodexOpenKey cuCodexSheetSync cuCodexOnClick cuCodexOnInput cuCodexOnChange cuCxFilterFigs cuCxFilterSkills cuCxSkillRows cuCxProgHtml cuCodexBodyHtml cuCodexFigPop cuCodexSkPop
// 不發聲、不寫存檔、不改 cardsui.js。ES2017;不用 ?. ??。

var CUX = { tab: 'fig', q: '', fac: '-1', troop: '', gr: '-1', own: '', cat: '', tier: '', sown: '', tfac: '-1', page: 0, pop: null, stack: [], el: null, key: false, obs: false };   // 子分頁 / 搜尋字 / 篩選 / 頁碼 / 浮層 {kind:'fig'|'sk', id} / 浮層返回堆疊
var CUX_PAGE = 40;   // 人物與戰法每頁筆數
var CUX_CAT = [['物理攻擊', 'phys'], ['謀略攻擊', 'strat'], ['弓系', 'bow'], ['普攻強化', 'pursuit'], ['增益', 'buff'], ['控場', 'control'], ['治療', 'heal'], ['防護', 'def'], ['減益', 'debuff']];   // [BN_SKILL_CAT 分類名, 插畫代號(assets/skillcat/cat_<代號>.webp)]
var CUX_TIERS = ['S', 'A', 'B', 'C'];
var CUX_TIER_NAME = { S: '朱金', A: '紫', B: '青藍', C: '灰褐' };
var CUX_TIER_COL = { S: '#b8432a', A: '#76489a', B: '#365fa3', C: '#7a6a58' };
var CUX_TROOP_IMG = { '槍': 'spear', '騎': 'cav', '盾': 'shield', '弓': 'bow', '謀': 'cover' };   // 兵種卡插畫 assets/legion/legion_<代號>.webp
var CUX_ROLE = { ult: '名人固有大招', passive: '名人固有被動', bond: '專屬聯動', slot: '選擇槽', learned: '選擇槽', legacy: '傳承', fixed: '固定' };
var CUX_ROW = ['前排', '中排', '後排'];
var CUX_SEL = ['fac', 'troop', 'gr', 'own', 'sown'];
var CUX_RC = { key: '', rows: null };   // 戰法列快取(世界 / 紀錄 / 持有者變動時重算)
var CUX_CSS = ':root{--cux-gold:#8a6a00;--cux-grey:#6b6b6b}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--cux-gold:#e3c15a;--cux-grey:#8c8c8c}}:root[data-theme="dark"]{--cux-gold:#e3c15a;--cux-grey:#8c8c8c}' +
  '#cardsPanel .cux{font-size:13px}#cardsPanel .cux-prog{margin:4px 0 6px}#cardsPanel .cux-pl{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13px}#cardsPanel .cux-pl b{color:var(--cux-gold)}' +
  '#cardsPanel .cux-bar{height:6px;border-radius:3px;background:rgba(128,128,128,.25);overflow:hidden;margin:3px 0}#cardsPanel .cux-bar i{display:block;height:100%;background:var(--cux-gold)}#cardsPanel .cux-bar.s i{background:#b8432a}' +
  '#cardsPanel .cux-note{font-size:12px;opacity:.75}' +
  '#cardsPanel .cux-q{width:100%;box-sizing:border-box;min-height:44px;font-size:16px;padding:6px 10px;border:1px solid rgba(128,128,128,.45);border-radius:8px;background:transparent;color:inherit}' +
  '#cardsPanel .cux-sub{display:flex;gap:6px;margin:6px 0}#cardsPanel button.cux-sb{flex:1 1 0;min-height:44px;border:1px solid rgba(128,128,128,.45);border-radius:8px;background:none;color:inherit;font-size:15px}#cardsPanel button.cux-sb.on{background:#3a5a8a;border-color:#3a5a8a;color:#fff}' +
  '#cardsPanel .cux-fs{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}#cardsPanel .cux-fs select{min-height:40px;font-size:14px;max-width:100%}#cardsPanel .cux-cats{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}' +
  '#cardsPanel button.cux-chip{display:inline-flex;align-items:center;gap:4px;min-height:40px;padding:0 8px;border:1px solid rgba(128,128,128,.45);border-radius:18px;background:none;color:inherit;font-size:12px}#cardsPanel button.cux-chip.on{background:#f0b45a;border-color:#f0b45a;color:#222}#cardsPanel button.cux-chip img{width:18px;height:18px}' +
  '#cardsPanel .cux-sum{font-size:12px;opacity:.85;margin:4px 0}#cardsPanel .cux-list{display:flex;flex-direction:column;gap:4px}' +
  '#cardsPanel button.cux-row{display:flex;align-items:center;gap:8px;width:100%;min-height:56px;box-sizing:border-box;padding:4px 8px;border:none;border-left:4px solid var(--cux-gold);border-radius:8px;background:rgba(128,128,128,.1);color:inherit;text-align:left;font-size:14px}#cardsPanel button.cux-row.off{border-left-color:var(--cux-grey)}' +
  '#cardsPanel .cux-bd{display:flex;flex-direction:column;min-width:0;flex:1}#cardsPanel .cux-bd small{font-size:12px;opacity:.85;overflow-wrap:anywhere}' +
  '#cardsPanel .cux-nm{color:var(--cux-gold);overflow-wrap:anywhere}#cardsPanel button.cux-row.off .cux-nm{color:var(--cux-grey)}' +
  '#cardsPanel .cux-tg{flex:none;font-size:12px;line-height:16px;padding:0 5px;border-radius:4px;border:1px solid currentColor}#cardsPanel .cux-tg.on{color:var(--cux-gold)}#cardsPanel .cux-tg.off{color:var(--cux-grey)}' +
  '#cardsPanel .cux-pg{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0}#cardsPanel .cux-pg button{min-height:44px;min-width:44px;padding:0 10px;border:1px solid rgba(128,128,128,.45);border-radius:8px;background:none;color:inherit;font-size:14px}#cardsPanel .cux-pg button[disabled]{opacity:.35}' +
  '#cardsPanel .cux-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}#cardsPanel .cux-hd{grid-column:1/-1;font-weight:bold;font-size:13px;margin-top:6px}' +
  '#cardsPanel button.cux-card{display:flex;flex-direction:column;gap:2px;min-height:44px;padding:0 0 6px;box-sizing:border-box;border:1px solid rgba(128,128,128,.4);border-top:4px solid #7a6a58;border-radius:8px;background:rgba(128,128,128,.08);color:inherit;text-align:left;overflow:hidden}' +
  '#cardsPanel button.cux-card.tS{border-top-color:#b8432a}#cardsPanel button.cux-card.tA{border-top-color:#76489a}#cardsPanel button.cux-card.tB{border-top-color:#365fa3}' +
  '#cardsPanel .cux-plate{display:block;height:56px;background:rgba(128,128,128,.12)}#cardsPanel .cux-plate img{width:100%;height:100%;object-fit:cover}#cardsPanel button.cux-card.off .cux-plate img{filter:grayscale(.7) opacity(.55)}' +
  '#cardsPanel .cux-cn{display:flex;align-items:center;gap:4px;padding:0 6px;font-weight:bold;font-size:14px;overflow-wrap:anywhere;color:var(--cux-gold)}#cardsPanel button.cux-card.off .cux-cn{color:var(--cux-grey)}' +
  '#cardsPanel .cux-tr{flex:none;font-style:normal;font-size:12px;line-height:16px;min-width:18px;text-align:center;border-radius:3px;background:#555;color:#fff;padding:0 3px}' +
  '#cardsPanel button.cux-card.tS .cux-tr{background:#b8432a}#cardsPanel button.cux-card.tA .cux-tr{background:#76489a}#cardsPanel button.cux-card.tB .cux-tr{background:#365fa3}' +
  '#cardsPanel .cux-cs{padding:0 6px;font-size:12px;opacity:.85;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}#cardsPanel button.cux-card .cux-tg{margin:0 6px;align-self:flex-start}' +
  '#cardsPanel .cux-team{padding:8px;margin:6px 0;border-radius:8px;background:rgba(128,128,128,.1)}#cardsPanel .cux-th{display:flex;justify-content:space-between;align-items:center;gap:6px}' +
  '#cardsPanel .cux-mem{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:6px 0}#cardsPanel button.cux-m{display:flex;flex-direction:column;align-items:flex-start;min-height:44px;padding:4px 6px;border:1px solid rgba(128,128,128,.4);border-radius:6px;background:none;color:inherit;text-align:left;font-size:13px}' +
  '#cardsPanel button.cux-m b{color:var(--cux-gold)}#cardsPanel button.cux-m.off b{color:var(--cux-grey)}#cardsPanel button.cux-m em{font-style:normal;font-size:12px}#cardsPanel .cux-why{font-size:13px;line-height:1.6}' +
  '#cuxPop{position:fixed;left:0;top:0;right:0;bottom:0;z-index:31;font-size:14px;color:#222}#cuxPop[hidden]{display:none}' +
  '#cuxPop .cux-mask{position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.45)}' +
  '#cuxPop .cux-sheet{position:absolute;left:0;right:0;bottom:0;max-height:80vh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;box-sizing:border-box;padding:0 14px calc(14px + env(safe-area-inset-bottom));border-radius:14px 14px 0 0;background:#f7f1e3;color:#222;box-shadow:0 -4px 18px rgba(0,0,0,.4)}' +
  '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #cuxPop .cux-sheet{background:#2a2620;color:#eee}}:root[data-theme="dark"] #cuxPop .cux-sheet{background:#2a2620;color:#eee}' +
  '#cuxPop .cux-shd{display:flex;align-items:center;gap:6px;position:sticky;top:0;z-index:1;margin:0 -14px;padding:0 6px 0 14px;min-height:52px;background:inherit;border-bottom:1px solid rgba(128,128,128,.35)}#cuxPop .cux-shd b{flex:1 1 auto;min-width:0;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '#cuxPop .cux-x,#cuxPop .cux-bk{flex:none;min-width:44px;min-height:44px;border:none;background:none;color:inherit;font-size:20px}' +
  '#cuxPop .cux-dh{display:flex;gap:10px;align-items:flex-start;margin:8px 0}#cuxPop .cux-dm{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}#cuxPop .cux-dm small{font-size:12px;opacity:.9}#cuxPop .cux-big{font-size:18px}' +
  '#cuxPop .cux-bigplate{flex:none;width:96px;height:64px;border-radius:6px;overflow:hidden;background:rgba(128,128,128,.14)}#cuxPop .cux-bigplate img{width:100%;height:100%;object-fit:cover}' +
  '#cuxPop .cux-go{align-self:flex-start;min-height:44px;padding:0 12px;border:none;border-radius:6px;background:#3a5a8a;color:#fff;font-size:14px}' +
  '#cuxPop .cux-stat{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:6px 0}#cuxPop .cux-stat span{display:flex;flex-direction:column;align-items:center;border-radius:6px;background:rgba(128,128,128,.14);padding:4px 0}#cuxPop .cux-stat i{font-style:normal;font-size:12px}#cuxPop .cux-stat b{font-size:16px}' +
  '#cuxPop .cux-sec{font-weight:bold;margin:10px 0 4px;padding-top:6px;border-top:1px dashed rgba(128,128,128,.4)}' +
  '#cuxPop button.cux-srow{display:flex;align-items:center;gap:6px;width:100%;min-height:44px;box-sizing:border-box;margin:3px 0;padding:4px 6px;border:none;border-left:4px solid #7a6a58;border-radius:6px;background:rgba(128,128,128,.1);color:inherit;text-align:left;font-size:13px}#cuxPop button.cux-srow.off{opacity:.7}' +
  '#cuxPop .cux-sn{flex:1 1 auto;min-width:0;color:var(--cux-gold)}#cuxPop button.cux-srow.off .cux-sn{color:var(--cux-grey)}#cuxPop .cux-srow small{font-size:12px;opacity:.8}' +
  '#cuxPop .cux-l{margin:4px 0;line-height:1.6;font-size:13px}#cuxPop .cux-dim{opacity:.7}#cuxPop .cux-flav{font-size:13px;line-height:1.7;font-style:italic}' +
  '#cuxPop .cux-recs{display:flex;flex-wrap:wrap;gap:6px}#cuxPop button.cux-rec{min-height:44px;padding:0 10px;border:1px solid #3a5a8a;border-radius:18px;background:none;color:inherit;font-size:13px}#cuxPop button.cux-rec.off{border-style:dashed;opacity:.75}#cuxPop button.cux-rec em{font-style:normal;font-size:12px;margin-left:4px}' +
  '#cuxPop .cux-tierc{display:inline-block;min-width:22px;text-align:center;border-radius:4px;color:#fff;font-weight:bold;padding:0 4px;font-size:12px;line-height:20px}#cuxPop .cux-cat{font-size:12px;padding:0 6px;border:1px solid currentColor;border-radius:4px}' +
  '#cardsPanel .cux-av,#cuxPop .cux-av{position:relative;flex:0 0 auto;width:44px;height:44px;border-radius:6px;overflow:hidden;border:2px solid var(--cux-gold);background:rgba(128,128,128,.18)}' +
  '#cardsPanel .cux-av.g4,#cuxPop .cux-av.g4{border-color:#c39a2e}#cardsPanel .cux-av.g3,#cuxPop .cux-av.g3{border-color:#76489a}#cardsPanel .cux-av.un,#cuxPop .cux-av.un{border-style:dashed;border-color:var(--cux-grey)}' +
  '#cardsPanel .cux-av svg,#cuxPop .cux-av svg{position:absolute;left:0;top:0;width:100%;height:100%;fill:#8a8070;opacity:.6}' +
  '#cardsPanel .cux-av img,#cuxPop .cux-av img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}#cardsPanel .cux-av.un img,#cuxPop .cux-av.un img{filter:grayscale(1) brightness(.75)}' +
  '#cuxPop .cux-dh .cux-av{width:72px;height:72px}#cuxPop .cux-tierc{align-self:flex-start}' +
  '#cuxPop .cux-link{min-height:44px;padding:0 4px;border:none;background:none;color:#3a5a8a;text-decoration:underline;font:inherit}' +
  '#cuxPop .cpl{margin:6px 0;line-height:1.6;font-size:13px}#cuxPop .cpl b{color:var(--cux-gold);margin-right:4px}#cuxPop .cptier{display:inline-block;min-width:22px;text-align:center;border-radius:4px;color:#fff;font-weight:bold;padding:0 4px;font-size:12px;line-height:20px}' +
  '#cuxPop .cptag{display:inline-block;margin:0 4px 6px 0;padding:0 6px;border:1px solid currentColor;border-radius:4px;font-size:12px}#cuxPop .cprow{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;min-height:44px;margin:4px 0}#cuxPop .cpwarn{color:#b04a2a;font-size:13px;margin:6px 0}' +
  '#cuxPop .cpfb{float:left;width:120px;margin:4px 12px 6px 0;border-radius:6px}#cuxPop .cpt p{margin:0 0 8px;line-height:1.6}#cuxPop .cpt{overflow:hidden}';

function cuCodexCss() {
  var st;
  if (typeof document === 'undefined' || !document || !document.head || !document.createElement || document.getElementById('cuCodexStyle')) return;
  st = document.createElement('style');
  st.id = 'cuCodexStyle';
  st.textContent = CUX_CSS;
  document.head.appendChild(st);
}

// ---------- 小工具 ----------
function cuCxIdx() { return (typeof cxIndex === 'function') ? cxIndex() : { figs: [], skills: [], byId: {}, skById: {} }; }
function cuCxOm() { return (typeof cxOwnMap === 'function') ? cxOwnMap() : {}; }
function cuCxN(s) { return (typeof cxNorm === 'function') ? cxNorm(s) : String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase(); }
function cuCxScore(q, nn) { return (typeof cxScore === 'function') ? cxScore(q, nn) : (!nn ? 0 : nn === q ? 100 : nn.indexOf(q) === 0 ? 90 : nn.indexOf(q) > 0 ? 70 : 0); }
function cuCxTxt(s) { return (typeof fxText === 'function') ? fxText(s) : s; }
function cuCxFigName(id) { var it = cuCxIdx().byId[id], f = (typeof CARD_FIG_BY_ID !== 'undefined') ? CARD_FIG_BY_ID[id] : null; return it ? it.name : (f ? f.name : id); }
function cuCxFacName(f) { return (typeof CARD_FAC !== 'undefined' && CARD_FAC[f]) || ''; }
function cuCxGrName(g) { return (typeof CARD_GRADE !== 'undefined' && CARD_GRADE[g]) ? CARD_GRADE[g].name : ''; }
// 戰法階級:傳承階級(bnSkcTier;大招 / 被動為 null)退回 BN_SKILL_TIER
function cuCxTier(id) {
  var t = (typeof bnSkcTier === 'function') ? bnSkcTier(id) : null;
  if (!t && typeof BN_SKILL_TIER !== 'undefined') t = BN_SKILL_TIER[id] || '';
  return t || '';
}
function cuCxTierOrd(t) { var i = CUX_TIERS.indexOf(t); return i < 0 ? 4 : i; }
function cuCxLabOrd(lab) { var i; for (i = 0; i < CUX_CAT.length; i++) if (CUX_CAT[i][0] === lab) return i; return lab === '兵種卡' ? 9 : 10; }
function cuCxCatUrl(lab, legion, troop) {
  var i, c = null;
  if (legion) return 'legion/legion_' + (CUX_TROOP_IMG[troop] || 'cover') + '.webp';
  for (i = 0; i < CUX_CAT.length; i++) if (CUX_CAT[i][0] === lab) c = CUX_CAT[i];
  return c && c[1] ? 'skillcat/cat_' + c[1] + '.webp' : '';
}
function cuCxTierChip(t) { return t ? '<span class="cux-tierc" style="background:' + CUX_TIER_COL[t] + '">' + t + '</span>' : ''; }
// 人物頭像(與 codex.js cxAvatar 同形;樣式在本檔 CUX_CSS,不依賴 #codexPanel 的樣式)
function cuCxAv(id, ow, gr, lazy) {
  var src = (typeof fxFigImg === 'function' && fxFigImg(id)) || 'assets/portraits/' + id + '.webp';
  return '<span class="cux-av g' + (gr | 0) + (ow ? '' : ' un') + '"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14" r="7.5"/><path d="M5 40c0-9 6-14.5 15-14.5S35 31 35 40z"/></svg>' +
    '<img alt="" src="' + cuEsc(src) + '"' + (lazy ? ' loading="lazy" decoding="async"' : '') + ' onerror="this.remove()"></span>';
}
function cuCxLink(kind, id) {   // 可點的人名 / 戰法名(data-kx="open");查無則純文字
  var name = kind === 'fig' ? cuCxFigName(id) : ((typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]) ? BN_SKILLS[id].name : id);
  if (!cuCodexExists(kind, id)) return cuEsc(name);
  return '<button type="button" class="cux-link" data-kx="open" data-kt="' + kind + '" data-id="' + cuEsc(id) + '">' + cuEsc(name) + '</button>';
}

// ---------- 戰法列(索引 cxIndex 的戰法 + 兵種卡;帶階級、擁有、插畫用欄位) ----------
// 可拆範圍 counted = 名人可傳承戰法 / 通用戰法 / 兵種卡;大招、被動、專屬聯動 = 隨名人(擁有該名人即算)
function cuCxSkillRows() {
  var idx = cuCxIdx(), om = cuCxOm(), key, out = [], seen = {};
  if (typeof bnSkcLoad === 'function') bnSkcLoad();
  key = ((typeof cxWorld === 'function') ? cxWorld() : '') + '|' + ((typeof bnskc !== 'undefined' && bnskc) ? bnskc.raw : '') + '|' + Object.keys(om).join(',') + '|' + idx.skills.length;
  if (CUX_RC.key === key && CUX_RC.rows) return CUX_RC.rows;
  function owned(id) { return (typeof bnSkcOwned === 'function') ? !!bnSkcOwned(id) : false; }
  idx.skills.forEach(function (it) {
    var d = it.d, counted = d.cat !== 'ult' && d.cat !== 'passive' && it.src !== 'bond';
    seen[it.id] = 1;
    out.push({ id: it.id, name: String(it.name), nn: it.nn, d: d, cat: it.cat, src: it.src, owners: it.owners, troops: it.troops, legion: false, troop: '',
      lab: (typeof BN_SKILL_CAT !== 'undefined' && BN_SKILL_CAT[it.id]) || '', counted: counted,
      owned: counted ? owned(it.id) : it.owners.some(function (f) { return !!om[f]; }), tier: cuCxTier(it.id),
      short: (typeof bnSkillShort === 'function') ? bnSkillShort(it.id) : '', flav: (typeof BN_FLAVOR !== 'undefined' && BN_FLAVOR[it.id]) || '' });
  });
  if (typeof BN_LEGION !== 'undefined' && BN_LEGION.cards) Object.keys(BN_LEGION.cards).forEach(function (id) {
    var c = BN_LEGION.cards[id];
    if (seen[id] || (c.srcFig && !idx.byId[c.srcFig])) return;   // 他世界的兵種卡不列
    out.push({ id: id, name: String(c.name), nn: cuCxN(c.name), d: null, cat: 'legion', src: 'legion', owners: c.srcFig ? [c.srcFig] : [], troops: c.troop ? [c.troop] : [], legion: true, troop: c.troop || '',
      lab: '兵種卡', counted: true, owned: owned(id), tier: cuCxTier(id), short: (c.pros && c.pros[0] && c.pros[0].t) || '', flav: c.flavor || '' });
  });
  CUX_RC = { key: key, rows: out };
  return out;
}
// o: {q, cat(引擎分類 ult / passive / active …), src(fig / teach / generic / ult / bond / legion), lab(九分類或兵種卡), tier(S/A/B/C), own('y' 已得 / 'n' 未得)}
function cuCxFilterSkills(o) {
  var q, out = [];
  o = o || {};
  q = cuCxN(o.q);
  cuCxSkillRows().forEach(function (r, i) {
    var s = 1;
    if (o.cat && r.cat !== o.cat) return;
    if (o.src && r.src !== o.src) return;
    if (o.lab && r.lab !== o.lab) return;
    if (o.tier && r.tier !== o.tier) return;
    if (o.own === 'y' && !r.owned) return;
    if (o.own === 'n' && r.owned) return;
    if (q) {
      s = cuCxScore(q, r.nn);
      if (s < 40) {
        if (cuCxN(r.owners.map(cuCxFigName).join(' ') + ' ' + r.short + ' ' + r.flav + ' ' + r.lab).indexOf(q) < 0) return;
        s = 35;
      }
    }
    out.push({ r: r, s: s, i: i });
  });
  out.sort(function (a, b) {
    if (q) return (b.s - a.s) || (a.i - b.i);
    return (cuCxTierOrd(a.r.tier) - cuCxTierOrd(b.r.tier)) || (cuCxLabOrd(a.r.lab) - cuCxLabOrd(b.r.lab)) || (a.i - b.i);
  });
  return out.map(function (x) { return x.r; });
}

// ---------- 人物列表篩選 ----------
// o: {q, fac(-1 全部), troop(''), gr(-1), own('y'|'n'|''), om} → 名人項目(依品階、原順序;有關鍵字時依分數)
function cuCxFilterFigs(o) {
  var idx = cuCxIdx(), om, q, out = [];
  o = o || {};
  om = o.om || cuCxOm();
  q = cuCxN(o.q);
  idx.figs.forEach(function (it, i) {
    var s = 1;
    if (o.fac !== '' && o.fac != null && +o.fac >= 0 && it.fac !== +o.fac) return;
    if (o.troop && it.troop !== o.troop) return;
    if (o.gr !== '' && o.gr != null && +o.gr >= 0 && it.gr !== +o.gr) return;
    if (o.own === 'y' && !om[it.id]) return;
    if (o.own === 'n' && om[it.id]) return;
    if (q) { s = Math.max(cuCxScore(q, it.nn), it.idn.indexOf(q) >= 0 ? 50 : 0); if (s < 40) return; }
    out.push({ it: it, s: s, i: i });
  });
  out.sort(function (a, b) { return (b.s - a.s) || (q ? 0 : (b.it.gr - a.it.gr)) || (a.i - b.i); });
  return out.map(function (x) { return x.it; });
}
// 隊伍篩選:陣營(CUX.tfac)與關鍵字(隊名、定位、推薦理由、成員名)
function cuCxTeams() {
  var q = cuCxN(CUX.q), w = (typeof cxWorld === 'function') ? cxWorld() : 'han', list = (typeof cxTeams === 'function') ? cxTeams() : [];
  return list.filter(function (t) {
    if (CUX.tfac !== '-1' && String(w === 'han' ? t.fac : t.world) !== CUX.tfac) return false;
    if (!q) return true;
    return cuCxN(t.name + ' ' + (t.role || '') + ' ' + (t.whyOvr || '') + ' ' + (t.intro || '') + ' ' + (t.why || '') + ' ' + t.slots.map(function (s) { return cuCxFigName(s.fig); }).join(' ')).indexOf(q) >= 0;
  });
}

// ---------- 收集進度 ----------
function cuCxProgHtml() {
  var idx = cuCxIdx(), om = cuCxOm(), cnt = cuCxSkillRows().filter(function (r) { return r.counted; }), nF = idx.figs.length, oF = idx.figs.filter(function (it) { return !!om[it.id]; }).length, oS = cnt.filter(function (r) { return r.owned; }).length;
  return '<div class="cux-prog"><div class="cux-pl"><span>人物 <b>' + oF + ' / ' + nF + '</b></span><span>戰法 <b>' + oS + ' / ' + cnt.length + '</b></span></div>' +
    '<div class="cux-bar"><i style="width:' + (nF ? Math.round(oF * 100 / nF) : 0) + '%"></i></div>' +
    '<div class="cux-bar s"><i style="width:' + (cnt.length ? Math.round(oS * 100 / cnt.length) : 0) + '%"></i></div>' +
    '<div class="cux-note">戰法進度計可拆範圍(名人可傳承戰法、通用戰法、兵種卡);大招與被動隨名人,擁有該名人即算。</div></div>';
}

// ---------- 列表片段 ----------
function cuCxFigRow(it, om) {
  var ow = !!om[it.id];
  return '<button type="button" class="cux-row' + (ow ? '' : ' off') + '" data-kx="open" data-kt="fig" data-id="' + cuEsc(it.id) + '">' +
    cuCxAv(it.id, ow, it.gr, true) +
    '<span class="cux-bd"><b class="cux-nm">' + cuEsc(it.name) + (it.zi ? '<small>(' + cuEsc(it.zi) + ')</small>' : '') + '</b>' +
    '<small>' + cuEsc(cuCxGrName(it.gr) + '・' + cuCxFacName(it.fac) + '・' + it.troop + '兵・' + CUX_ROW[it.row]) + '</small>' +
    '<small>' + cuEsc(it.sk.map(function (k) { return BN_SKILLS[k] ? BN_SKILLS[k].name : k; }).join('・')) + '</small></span>' +
    '<span class="cux-tg ' + (ow ? 'on' : 'off') + '">' + (ow ? '已得' : '未得') + '</span></button>';
}
function cuCxSkCard(r) {
  var img = cuCxCatUrl(r.lab, r.legion, r.troop);
  return '<button type="button" class="cux-card t' + (r.tier || 'N') + (r.owned ? '' : ' off') + '" data-kx="open" data-kt="sk" data-id="' + cuEsc(r.id) + '">' +
    '<span class="cux-plate">' + (img ? '<img src="assets/' + img + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</span>' +
    '<span class="cux-cn"><i class="cux-tr">' + (r.tier || '—') + '</i>' + cuEsc(r.name) + '</span>' +
    '<span class="cux-cs">' + cuEsc(r.short) + '</span>' +
    '<span class="cux-tg ' + (r.owned ? 'on' : 'off') + '">' + (r.owned ? '已得' : '未得') + '</span></button>';
}
function cuCxTeamHtml(t) {
  var o = (typeof cxTeamOwn === 'function') ? cxTeamOwn(t) : { own: 0, roster: 0, n: t.slots.length }, om = cuCxOm(), why = t.whyOvr || t.intro || t.why || '', h;
  h = '<div class="cux-team"><div class="cux-th"><b>' + cuEsc(t.name) + '</b><span class="cux-tg ' + (o.own >= o.n ? 'on' : 'off') + '">已得 ' + o.own + ' / ' + o.n + '</span></div>';
  if (t.role) h += '<div class="cux-l cux-dim">' + cuEsc(t.role) + '</div>';
  h += '<div class="cux-mem">' + t.slots.map(function (s) {
    var ow = !!om[s.fig];
    return '<button type="button" class="cux-m' + (ow ? '' : ' off') + '" data-kx="open" data-kt="fig" data-id="' + cuEsc(s.fig) + '"><small>' + CUX_ROW[s.row] + '・' + cuEsc(s.troop) + '</small><b>' + cuEsc(cuCxFigName(s.fig)) + '</b><em>' + (ow ? '已得' : '未得') + '</em></button>';
  }).join('') + '</div>';
  if (why) h += '<div class="cux-why"><b>為什麼推薦</b>' + cuEsc(why) + '</div>';
  if (t.bonds && t.bonds.length) h += '<div class="cux-l"><b>羈絆</b> ' + cuEsc(t.bonds.join('、')) + '</div>';
  return h + '</div>';
}
function cuCxPager(pages) {
  if (pages <= 1) return '';
  return '<div class="cux-pg"><button type="button" data-kx="page" data-v="-1"' + (CUX.page <= 0 ? ' disabled' : '') + '>‹ 上一頁</button><span>第 ' + (CUX.page + 1) + ' / ' + pages + ' 頁</span>' +
    '<button type="button" data-kx="page" data-v="1"' + (CUX.page >= pages - 1 ? ' disabled' : '') + '>下一頁 ›</button></div>';
}
function cuCodexHintHtml() {
  var q = CUX.q, nF, rows, nS, nL;
  if (!q) return '';
  nF = cuCxFilterFigs({ q: q }).length;
  rows = cuCxFilterSkills({ q: q });
  nL = rows.filter(function (r) { return r.legion; }).length;
  nS = rows.length - nL;
  return '<div class="cux-sum">搜尋「' + cuEsc(q) + '」:人物 ' + nF + ' 位、戰法 ' + nS + ' 個、兵種卡 ' + nL + ' 張(點上方分頁切換查看)。</div>';
}

// ---------- 篩選列 ----------
function cuCxSel(name, val, opts, lab) {
  return '<select data-kxf="' + name + '" aria-label="' + cuEsc(lab) + '">' + opts.map(function (o) { return '<option value="' + cuEsc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + cuEsc(o[1]) + '</option>'; }).join('') + '</select>';
}
function cuCxChip(kx, v, cur, label, img) {
  return '<button type="button" class="cux-chip' + (String(cur) === String(v) ? ' on' : '') + '" data-kx="' + kx + '" data-v="' + cuEsc(v) + '">' + (img ? '<img src="assets/' + img + '" alt="" loading="lazy" onerror="this.remove()">' : '') + cuEsc(label) + '</button>';
}
function cuCodexFiltHtml() {
  var idx = cuCxIdx(), facs = [], grs = [], troops = (typeof BN_DATA !== 'undefined' && BN_DATA.troopList) ? BN_DATA.troopList : ['槍', '騎', '盾', '弓', '謀'], h = '';
  if (CUX.tab === 'fig') {
    idx.figs.forEach(function (it) { if (facs.indexOf(it.fac) < 0) facs.push(it.fac); if (grs.indexOf(it.gr) < 0) grs.push(it.gr); });
    facs.sort(function (a, b) { return a - b; });
    grs.sort(function (a, b) { return b - a; });
    h = '<div class="cux-fs">' + cuCxSel('fac', CUX.fac, [['-1', '全部陣營']].concat(facs.map(function (f) { return [String(f), cuCxFacName(f)]; })), '陣營') +
      cuCxSel('troop', CUX.troop, [['', '全部兵種']].concat(troops.map(function (t) { return [t, t + '兵']; })), '兵種') +
      cuCxSel('gr', CUX.gr, [['-1', '全部品階']].concat(grs.map(function (g) { return [String(g), cuCxGrName(g)]; })), '品階') +
      cuCxSel('own', CUX.own, [['', '全部'], ['y', '已得'], ['n', '未得']], '擁有') + '</div>';
  } else if (CUX.tab === 'sk') {
    h = '<div class="cux-cats">' + cuCxChip('cat', '', CUX.cat, '全部分類') + CUX_CAT.map(function (c) { return cuCxChip('cat', c[0], CUX.cat, c[0], c[1] ? 'skillcat/cat_' + c[1] + '.webp' : ''); }).join('') +
      cuCxChip('cat', '兵種卡', CUX.cat, '兵種卡', 'legion/legion_cover.webp') + '</div>';
    h += '<div class="cux-cats">' + cuCxChip('tier', '', CUX.tier, '全部階級') + CUX_TIERS.map(function (t) { return cuCxChip('tier', t, CUX.tier, t + '・' + CUX_TIER_NAME[t]); }).join('') + '</div>';
    h += '<div class="cux-fs">' + cuCxSel('sown', CUX.sown, [['', '全部'], ['y', '已得'], ['n', '未得']], '擁有') + '</div>';
  } else {
    if (typeof cxTeamFacs === 'function') {
      h = '<div class="cux-cats">' + cuCxChip('tfac', '-1', CUX.tfac, '全部陣營') + cxTeamFacs().map(function (f) { return cuCxChip('tfac', String(f), CUX.tfac, (typeof cxTeamFacName === 'function') ? cxTeamFacName(f) : String(f)); }).join('') + '</div>';
    }
  }
  return h;
}

// ---------- 分頁本體(子分頁內容) ----------
function cuCodexBodyHtml() {
  var om = cuCxOm(), h = '', list, pages, sl, rows, teams, last = null, grid = '';
  if (CUX.tab === 'fig') {
    list = cuCxFilterFigs({ q: CUX.q, fac: CUX.fac, troop: CUX.troop, gr: CUX.gr, own: CUX.own, om: om });
    pages = Math.max(1, Math.ceil(list.length / CUX_PAGE));
    CUX.page = Math.min(Math.max(0, CUX.page), pages - 1);
    sl = list.slice(CUX.page * CUX_PAGE, (CUX.page + 1) * CUX_PAGE);
    h += cuCodexHintHtml();
    h += '<div class="cux-sum">共 ' + list.length + ' 位' + (list.length ? ',第 ' + (CUX.page + 1) + ' / ' + pages + ' 頁' : '') + '。未得的人物也能點開看戰法與傳記。</div>';
    if (!list.length) h += '<div class="cusub">沒有符合的人物,試試別的姓名或放寬篩選。</div>';
    h += '<div class="cux-list">' + sl.map(function (it) { return cuCxFigRow(it, om); }).join('') + '</div>' + cuCxPager(pages);
  } else if (CUX.tab === 'sk') {
    rows = cuCxFilterSkills({ q: CUX.q, cat: '', lab: CUX.cat, tier: CUX.tier, own: CUX.sown });
    pages = Math.max(1, Math.ceil(rows.length / CUX_PAGE));
    CUX.page = Math.min(Math.max(0, CUX.page), pages - 1);
    sl = rows.slice(CUX.page * CUX_PAGE, (CUX.page + 1) * CUX_PAGE);
    h += cuCodexHintHtml();
    h += '<div class="cux-sum">共 ' + rows.length + ' 項(含兵種卡)' + (rows.length ? ',第 ' + (CUX.page + 1) + ' / ' + pages + ' 頁' : '') + '。依 S / A / B / C 分組;S / A 名人專屬,同時只能裝一人。</div>';
    if (!rows.length) h += '<div class="cusub">沒有符合的戰法,試試別的關鍵字或篩選。</div>';
    sl.forEach(function (r) {
      var t = r.tier || '';
      if (t !== last) { grid += '<div class="cux-hd">' + (t ? t + ' · ' + CUX_TIER_NAME[t] + (t === 'S' || t === 'A' ? '(專屬)' : '(可多人)') : '未分級') + '</div>'; last = t; }
      grid += cuCxSkCard(r);
    });
    h += '<div class="cux-grid">' + grid + '</div>' + cuCxPager(pages);
  } else {
    teams = cuCxTeams();
    h += cuCodexHintHtml();
    h += '<div class="cux-sum">共 ' + teams.length + ' 組推薦隊伍。隊伍成員可點開看人物;名冊中已得的成員以金字標示。</div>';
    if (!teams.length) h += '<div class="cusub">沒有符合的隊伍。</div>';
    teams.forEach(function (t) { h += cuCxTeamHtml(t); });
  }
  return h;
}

// ---------- 底部浮層:人物詳情 / 戰法詳情 ----------
function cuCodexExists(kind, id) {
  if (kind === 'sk') return cuCxSkillRows().some(function (r) { return r.id === id; });
  return !!cuCxIdx().byId[id];
}
function cuCodexFigPop(cs, id) {
  var it = cuCxIdx().byId[id], om = cuCxOm(), ow = om[id], c = (typeof cxCard === 'function') ? cxCard(id) : null, lst = { roster: '名冊', wait: '待定席', wander: '流浪中', bag: '卡包' }, h = '', rows, traits, bonds, teams, bio, lines, st;
  if (!it) return null;
  h += '<div class="cux-dh">' + cuCxAv(id, !!ow, it.gr, false) + '<div class="cux-dm">' +
    '<b class="cux-big">' + cuEsc(it.name) + (it.zi ? '<small>(' + cuEsc(it.zi) + ')</small>' : '') + '</b>' +
    '<small>' + cuEsc(cuCxGrName(it.gr) + '階・' + cuCxFacName(it.fac) + (it.f.home ? '・' + it.f.home : '') + (it.f.birth ? '・' + it.f.birth : '')) + '</small>' +
    '<small>擅長:' + cuEsc(it.troop) + '兵・預設' + CUX_ROW[it.row] + '</small>' +
    '<span class="cux-tg ' + (ow ? 'on' : 'off') + '" style="align-self:flex-start">' + (ow ? '已得(' + (lst[ow.list] || '') + ')' : '未得') + '</span>' +
    (ow ? '<button type="button" class="cux-go" data-kx="roster" data-id="' + cuEsc(id) + '">到名冊查看</button>' : '') + '</div></div>';
  if (c && typeof cardsStats === 'function' && typeof CARD_STATS !== 'undefined') {
    st = cardsStats(c);
    h += '<div class="cux-stat">' + CARD_STATS.map(function (nm, k) { return '<span><i>' + nm + '</i><b>' + st[k] + '</b></span>'; }).join('') + '</div>';
  }
  rows = (typeof cxSkillRows === 'function') ? cxSkillRows(id) : [];
  h += '<div class="cux-sec">戰法(' + rows.length + ')</div>';
  cuCxSkillRows();
  rows.forEach(function (r) {
    var sk = cuCxSkillRows().filter(function (x) { return x.id === r.id; })[0], on = !!(sk && sk.owned);
    h += '<button type="button" class="cux-srow t' + (cuCxTier(r.id) || 'N') + (on ? '' : ' off') + '" data-kx="open" data-kt="sk" data-id="' + cuEsc(r.id) + '">' + cuCxTierChip(cuCxTier(r.id)) +
      '<span class="cux-sn">' + cuEsc(r.name) + '</span><small>' + cuEsc(CUX_ROLE[r.role] || '') + '</small><span class="cux-tg ' + (on ? 'on' : 'off') + '">' + (on ? '已得' : '未得') + '</span></button>';
  });
  traits = (typeof cxTraitList === 'function') ? cxTraitList(c, id) : [];
  if (traits.length) {
    h += '<div class="cux-sec">詞條</div>';
    traits.forEach(function (t) { h += '<div class="cux-l">' + (t.ex ? '<i class="cux-cat">專屬</i> ' : '') + '<b>' + cuEsc(t.n) + '</b>' + (t.d ? ' ' + cuEsc(t.d) : '') + '</div>'; });
  }
  bonds = (typeof cxBondsOf === 'function') ? cxBondsOf(id) : [];
  if (bonds.length) {
    h += '<div class="cux-sec">羈絆</div>';
    bonds.forEach(function (b) { h += '<div class="cux-l"><b>' + cuEsc(b.name) + '</b>:' + b.members.map(function (m) { return cuCxLink('fig', m); }).join('、') + (b.txt ? '<br><small>' + cuEsc(b.txt) + '</small>' : '') + '</div>'; });
  }
  teams = (typeof cxTeams === 'function') ? cxTeams().filter(function (t) { return t.slots.some(function (s) { return s.fig === id; }); }) : [];
  if (teams.length) h += '<div class="cux-sec">配隊建議</div><div class="cux-l">' + teams.map(function (t) { return cuEsc(t.name); }).join('、') + '</div>';
  h += '<div class="cux-sec">人物傳記</div>';
  if (c && typeof cuPopBio === 'function') { bio = cuPopBio(cs, { e: c }); h += bio.html; }
  else h += '<div class="cux-l">' + cuEsc(it.f.bio || '') + '</div>';
  lines = (typeof FAMOUS_LINES !== 'undefined' && FAMOUS_LINES[id]) || [];
  lines.slice(0, 2).forEach(function (s) { h += '<div class="cux-l">「' + cuEsc(s) + '」</div>'; });
  return { title: it.name, html: h };
}
function cuCxRecHtml(cs, id) {
  var recs = (typeof cuRecommend === 'function' && cs) ? cuRecommend(cs, id, null, 3) : [];
  if (!recs.length) return '<div class="cux-l cux-dim">目前沒有適合的人選。</div>';
  return '<div class="cux-recs">' + recs.map(function (x) {
    var c = x.c, ow = !!x.e, fig = c.fig || '';
    return '<button type="button" class="cux-rec' + (ow ? '' : ' off') + '" data-kx="' + (fig ? 'open' : 'rdet') + '" data-kt="fig" data-id="' + cuEsc(fig || (x.e ? x.e.id : '')) + '">' + cuEsc(c.name) + (ow ? '' : '<em>未擁有</em>') + '</button>';
  }).join('') + '</div>';
}
function cuCxSourceHtml(r) {
  var d = r.d, L, lk, gold;
  if (r.legion) {
    L = BN_LEGION.cards[r.id] || {};
    return '<div class="cux-l">兵種卡 · 出身 ' + (L.srcFig ? cuCxLink('fig', L.srcFig) : '—') + '(' + cuEsc(L.troop || '') + '兵),只能裝給同基礎兵種的人。</div>';
  }
  if (!d) return '<div class="cux-l">—</div>';
  lk = r.owners.map(function (f) { return cuCxLink('fig', f); }).join('、');
  if (d.cat === 'ult' || d.cat === 'passive') return '<div class="cux-l">名人固有(' + lk + '),擁有該名人即有,不可傳承。</div>';
  if (d.cat === 'bond' || r.src === 'bond') return '<div class="cux-l">專屬聯動,隨名人自帶,不占被動與選擇槽。</div>';
  if (d.fig) {
    gold = (typeof CARD_FIG_BY_ID !== 'undefined' && CARD_FIG_BY_ID[d.fig] && CARD_FIG_BY_ID[d.fig].gr === 4) ? '金' : '紫';
    return '<div class="cux-l">傳承自 ' + lk + '(' + gold + '名人)。' + (r.tier === 'S' || r.tier === 'A' ? 'S / A 專屬,同時只能裝在一人身上。' : '') + '</div>';
  }
  return '<div class="cux-l">通用戰法:路人或名人傳承皆可得,B / C 不限人數裝備。</div>';
}
function cuCodexSkPop(cs, id) {
  var r = cuCxSkillRows().filter(function (x) { return x.id === id; })[0], img, h = '', po;
  if (!r) return null;
  img = cuCxCatUrl(r.lab, r.legion, r.troop);
  h += '<div class="cux-dh">' + (img ? '<span class="cux-bigplate"><img src="assets/' + img + '" alt="" onerror="this.remove()"></span>' : '') +
    '<div class="cux-dm">' + cuCxTierChip(r.tier) + '<small>' + cuEsc(r.lab) + '</small><span class="cux-tg ' + (r.owned ? 'on' : 'off') + '" style="align-self:flex-start">' + (r.owned ? '已得' : '未得') + '</span>' +
    (r.short ? '<small>' + cuEsc(r.short) + '</small>' : '') + '</div></div>';
  if (typeof cuPopSkill === 'function' && cs) {
    po = cuPopSkill(cs, null, { k: 'skill', id: id, eid: '', slot: -1 });
    if (po && po.html) h += po.html;
  }
  if (r.flav) h += '<div class="cux-sec">典故</div><div class="cux-flav">' + cuEsc(r.flav) + '</div>';
  h += '<div class="cux-sec">拆解自誰</div>' + cuCxSourceHtml(r);
  h += '<div class="cux-sec">推薦使用人物</div>' + (r.counted ? cuCxRecHtml(cs, id) : '<div class="cux-l cux-dim">名人固有,不另外推薦。</div>');
  return { title: r.name, html: h };
}
// 浮層內容:{title, html} 或 null(無此項)
function cuCodexPopData(cs, p) {
  if (!p || !cs) return null;
  if (p.kind === 'sk') return cuCodexSkPop(cs, p.id);
  return cuCodexFigPop(cs, p.id);
}
function cuCodexEl() {
  var el, pn;
  if (CUX.el) return CUX.el;
  if (typeof document === 'undefined' || !document || !document.body || !document.createElement) return null;
  cuCodexCss();
  el = document.createElement('div');
  el.id = 'cuxPop';
  el.hidden = true;
  document.body.appendChild(el);
  CUX.el = el;
  if (!CUX.key && typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') { CUX.key = true; window.addEventListener('keydown', cuCodexKey, true); }
  pn = document.getElementById('cardsPanel');
  if (pn && !CUX.obs && typeof MutationObserver === 'function') {
    CUX.obs = true;
    new MutationObserver(function () { if (pn.hidden) cuCodexHide(); }).observe(pn, { attributes: true, attributeFilter: ['hidden'] });
  }
  return el;
}
function cuCodexHide() {
  CUX.pop = null; CUX.stack = [];
  if (CUX.el) { CUX.el.hidden = true; CUX.el.innerHTML = ''; }
}
// 依 CUX.pop 重畫浮層;面板未開或無此項 → 收掉
function cuCodexSheetSync() {
  var el = cuCodexEl(), cs = (typeof cardsGet === 'function') ? cardsGet() : null, r;
  if (!el) return;
  r = (CUX.pop && cu.open && cs) ? cuCodexPopData(cs, CUX.pop) : null;
  if (!r) { cuCodexHide(); return; }
  el.innerHTML = cuCxTxt('<div class="cux-mask" data-kx="close"></div><div class="cux-sheet" role="dialog" aria-label="' + cuEsc(r.title) + '"><div class="cux-shd">' +
    (CUX.stack.length ? '<button type="button" class="cux-bk" data-kx="back">‹ 返回</button>' : '') + '<b>' + cuEsc(r.title) + '</b><button type="button" class="cux-x" data-kx="close" aria-label="關閉">×</button></div>' + r.html + '</div>');
  el.hidden = false;
}
// Esc:先退一層浮層(capture 攔下,不讓面板管理器一起關掉卡包)
function cuCodexKey(ev) {
  if (!CUX.pop || !ev || (ev.key !== 'Escape' && ev.key !== 'Esc')) return;
  if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
  CUX.pop = CUX.stack.pop() || null;
  cuCodexSheetSync();
}

// ---------- 主體 / 點擊 ----------
function cuCodexHtml(cs) {
  var h;
  if (!cs) return '<div class="cusub">尚無城邦資料</div>';
  cuCodexCss();
  h = '<div class="cux">' + cuCxProgHtml() +
    '<input id="cuxq" class="cux-q" type="search" placeholder="搜尋人物、戰法、兵種卡(姓名、字、典故)" aria-label="搜尋大全" autocomplete="off" enterkeyhint="search" value="' + cuEsc(CUX.q) + '">' +
    '<div class="cux-sub">' + [['fig', '人物'], ['sk', '戰法'], ['team', '隊伍']].map(function (t) { return '<button type="button" class="cux-sb' + (CUX.tab === t[0] ? ' on' : '') + '" data-kx="sub" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
    '<div id="cuxf">' + cuCodexFiltHtml() + '</div><div id="cuxb">' + cuCodexBodyHtml() + '</div></div>';
  cuCodexSheetSync();
  return cuCxTxt(h);
}
// 點擊動作;回 true = 已處理(呼叫端重畫)。未知動作回 false
function cuCodexClick(a, b, cs) {
  var at = function (k) { return (b && b.getAttribute) ? (b.getAttribute(k) || '') : ''; }, v = at('data-v'), id = at('data-id'), kt = at('data-kt');
  if (!cs) return false;
  if (a === 'sub') { if (['fig', 'sk', 'team'].indexOf(v) < 0) return false; CUX.tab = v; CUX.page = 0; CUX.pop = null; CUX.stack = []; return true; }
  if (a === 'cat') { CUX.cat = v; CUX.page = 0; return true; }
  if (a === 'tier') { CUX.tier = v; CUX.page = 0; return true; }
  if (a === 'tfac') { CUX.tfac = v || '-1'; return true; }
  if (a === 'page') { CUX.page = Math.max(0, CUX.page + (+v || 0)); return true; }
  if (a === 'open') {
    if (['fig', 'sk'].indexOf(kt) < 0 || !cuCodexExists(kt, id)) return false;
    if (CUX.pop) CUX.stack.push(CUX.pop); else CUX.stack = [];
    CUX.pop = { kind: kt, id: id };
    return true;
  }
  if (a === 'rdet') {   // 路人無人物頁:開名冊詳情
    if (typeof cardsUiOpen !== 'function') return false;
    CUX.pop = null; CUX.stack = [];
    cardsUiOpen('R');
    cu.detail = id;
    return true;
  }
  if (a === 'back') { CUX.pop = CUX.stack.pop() || null; return true; }
  if (a === 'close') { CUX.pop = null; CUX.stack = []; return true; }
  if (a === 'roster') { CUX.pop = null; CUX.stack = []; if (typeof codexGoRoster === 'function') codexGoRoster(id); return true; }
  return false;
}
// 外部入口(search.js / codex.js):f:<人物 id> 或 s:<戰法 id> → 開卡包『大全』並展開詳情。查無則回 false
function cuCodexOpenKey(k) {
  var p = String(k || '').split(':'), id = p[1] || '', kind = p[0] === 's' ? 'sk' : (p[0] === 'f' ? 'fig' : '');
  if (!kind || typeof cardsUiOpen !== 'function' || !cuCodexExists(kind, id)) return false;
  cardsUiOpen('X');
  CUX.tab = kind === 'sk' ? 'sk' : 'fig';
  CUX.q = ''; CUX.page = 0;
  CUX.stack = [];
  CUX.pop = { kind: kind, id: id };
  if (typeof cardsUiRender === 'function') cardsUiRender();
  return true;
}
// document 捕獲階段監聽(同 cardsui_skills.js):處理 data-kx,處理後 stopPropagation
function cuCodexOnClick(ev) {
  var b = ev && ev.target, a, cs;
  while (b && b.getAttribute && !b.getAttribute('data-kx')) b = b.parentNode;
  if (!b || !b.getAttribute || typeof cu === 'undefined' || !cu.open || cu.revealing) return;
  a = b.getAttribute('data-kx');
  if (ev.stopPropagation) ev.stopPropagation();
  cs = cardsGet();
  if (cuCodexClick(a, b, cs) && typeof cardsUiRender === 'function') cardsUiRender();
}
// 搜尋框輸入:只重畫分頁內容,避免行動裝置輸入中斷焦點
function cuCodexOnInput(ev) {
  var t = ev && ev.target, box;
  if (!t || t.id !== 'cuxq' || typeof cu === 'undefined' || !cu.open || !cu.el || !cu.el.querySelector) return;
  CUX.q = String(t.value || '').slice(0, 20);
  CUX.page = 0;
  box = cu.el.querySelector('#cuxb');
  if (box) box.innerHTML = cuCodexBodyHtml();
  else if (typeof cardsUiRender === 'function') cardsUiRender();
}
// 下拉篩選:只重畫分頁內容
function cuCodexOnChange(ev) {
  var t = ev && ev.target, f = t && t.getAttribute ? t.getAttribute('data-kxf') : null, box;
  if (!f || CUX_SEL.indexOf(f) < 0 || typeof cu === 'undefined' || !cu.open || !cu.el || !cu.el.querySelector) return;
  CUX[f] = String(t.value);
  CUX.page = 0;
  box = cu.el.querySelector('#cuxb');
  if (box) box.innerHTML = cuCodexBodyHtml();
}
if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
  document.addEventListener('click', cuCodexOnClick, true);
  document.addEventListener('input', cuCodexOnInput, false);
  document.addEventListener('change', cuCodexOnChange, false);
}
