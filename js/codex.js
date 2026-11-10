// js/codex.js — 圖鑑面板:「武將」(當前世界全部名人 / 英雄,含未獲得)、「戰法」(全部戰法反查持有者)、「配隊」(基本原則 + 各陣營建議 + 依名冊推薦,可一鍵套用到布陣)。
// 入口:卡牌面板標題列「圖鑑」鈕(cardsui.js 一行 typeof 守衛呼叫 codexBtnHtml / codexOpen);全域搜尋(search.js)的武將 / 戰法結果經 codexSearch / codexSrHtml / codexOpenKey 跳轉。
// 抽卡開獎最終排列加「看戰法」鈕(cardsreveal.js rvFinal 一行呼叫 codexRevealHook)。面板以 panelmgr 登錄為 big('codex';Esc 先關說明浮層 / 回上一頁,再關面板)。
// 索引 cxIndex 首次開啟時建立並快取;世界切換(fxPack)後失效重建。歷史世界只列 CARD_FIGS,魔幻世界只列 FX_FIGS(fx_cards.js fxFigSrc)。
// 戰法文字一律取自 bn_text.js(bnCardSkillRows / bnSkillInfo / bnSkillShort / bntVsText / bnTraitText / bnXTraitText);配隊資料 js/codex_teams_data.js(tools/gen_codex_teams.js 產生)。
// 布陣套用只寫 bnui.js 既有的當前陣容(bnu.data.cur → bnUiSave),不改戰鬥版面。不發聲。外部全域一律 typeof 守衛。ES2017;不用 ?. ??。
// 全域名稱:CX cx codexOpen codexClose codexToggle codexIsOpen codexBtnHtml codexOpenKey codexSearch codexSrHtml codexGoRoster codexRevealHook codexRevealHtml
//   cxIndex cxFilterFigs cxFilterSkills cxFigDetailHtml cxSkillDetailHtml cxOwnMap cxTeams cxTeamOwn cxTeamPlan cxApplySlots cxRecommend cxRulesHtml

var CX = { pageFig: 20, pageSk: 30, srMax: 10, debounce: 150, catOrder: ['command', 'active', 'pursuit', 'passive', 'ult'] };
var CX_TABS = [['fig', '武將'], ['skill', '戰法'], ['team', '配隊']];
var CX_CAT = { command: '指揮', active: '主動', pursuit: '追擊', passive: '被動', ult: '大招' };
var CX_SRC = { fig: '名人專屬', teach: '名人戰法・可傳授', generic: '通用・兵書可學', ult: '兵種大招(路人)', bond: '專屬聯動' };
var CX_ROW = ['前排', '中排', '後排'];
var CX_RACE = { elf: '精靈', dwarf: '矮人', kingdom: '王國' };
var cx = { el: null, tool: null, list: null, ov: null, title: null, open: false, tab: 'fig', stack: [], ovId: '', q: '', fac: -1, troop: '', gr: -1, own: '', skq: '', cat: '', src: '', tfac: -1,
  page: 0, timer: 0, idx: null, key: '', cards: {}, rec: null, msg: '', scroll: {} };

function cxTI(t) { return (typeof bnTroopIconHtml === 'function') ? bnTroopIconHtml(t) : ''; }   // 兵種小圖示(assets/troopicon/)
function cxEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function cxNorm(s) { return (typeof srNorm === 'function') ? srNorm(s) : String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase(); }
function cxWorld() { var p = (typeof fxPack === 'function') ? fxPack() : null; return p || 'han'; }
function cxFacName(f) { return (typeof CARD_FAC !== 'undefined' && CARD_FAC[f]) ? CARD_FAC[f] : ''; }
function cxGrName(g) { return (typeof CARD_GRADE !== 'undefined' && CARD_GRADE[g]) ? CARD_GRADE[g].name : ''; }
function cxSrcFigs() { var s = (typeof fxFigSrc === 'function') ? fxFigSrc() : null; return s || (typeof CARD_FIGS !== 'undefined' ? CARD_FIGS : []); }
function cxToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }

// ───────── 索引(首次建立;世界切換失效) ─────────
function cxKey() {
  return cxWorld() + '|' + cxSrcFigs().length + '|' + (typeof BN_SKILLS !== 'undefined' ? Object.keys(BN_SKILLS).length : 0);
}
function cxSkSrc(d, ultBy, bondSet) {
  if (bondSet && bondSet[d.id]) return 'bond';   // 專屬聯動:隨名人自帶、不占被動 / 選擇槽,只在指定武將在場時生效
  if (d.fig) return d.learn ? 'teach' : 'fig';
  if (ultBy[d.id]) return 'ult';
  return 'generic';
}
function cxIndex() {
  var key = cxKey(), figs = [], byId = {}, own = {}, skills = [], skById = {}, vsBy = {}, ultBy = {}, bondSet = {};
  if (typeof BN_KIT_BY !== 'undefined' && BN_KIT_BY.figs) Object.keys(BN_KIT_BY.figs).forEach(function (fid) { (BN_KIT_BY.figs[fid].bondFix || []).forEach(function (sid) { bondSet[sid] = fid; }); });
  if (cx.idx && cx.key === key) return cx.idx;
  if (typeof BN_ULT_BY !== 'undefined') Object.keys(BN_ULT_BY).forEach(function (t) { var u = BN_ULT_BY[t]; (ultBy[u] = ultBy[u] || []).push(t); });
  cxSrcFigs().forEach(function (f) {
    var fs = (typeof BN_FIG_SKILLS !== 'undefined') ? BN_FIG_SKILLS[f.id] : null, sk, it;
    if (!fs) return;
    sk = [fs.passive].concat(Object.keys(bondSet).filter(function (k) { return bondSet[k] === f.id; })).concat(fs.skills || []).concat(fs.ult ? [fs.ult] : []).filter(function (k) { return k && typeof BN_SKILLS !== 'undefined' && BN_SKILLS[k]; });
    it = { id: f.id, f: f, name: String(f.name), zi: f.zi && f.zi !== '新' ? String(f.zi) : '', fac: f.fac, gr: f.gr, troop: fs.troop, row: fs.row === '前' ? 0 : fs.row === '中' ? 1 : 2, sk: sk, race: f.race || '' };
    it.nn = cxNorm(it.name + it.zi); it.idn = cxNorm(f.id);
    figs.push(it); byId[f.id] = it;
    sk.forEach(function (k) { (own[k] = own[k] || []).push(f.id); });
  });
  if (typeof BN_SKILLS !== 'undefined') Object.keys(BN_SKILLS).forEach(function (k) {
    var d = BN_SKILLS[k], it;
    if (d.fig && !own[k]) return;              // 他世界名人的戰法不列
    if (!d.fig && !d.generic && !ultBy[k]) return;
    it = { id: k, d: d, name: String(d.name), cat: d.cat, src: cxSkSrc(d, ultBy, bondSet), owners: own[k] || [], troops: ultBy[k] || [], nn: cxNorm(d.name) };
    skills.push(it); skById[k] = it;
    if (d.vs && d.vs.fig && own[k]) d.vs.fig.forEach(function (t) { (vsBy[t] = vsBy[t] || []).push({ sk: k, by: own[k][0] }); });
  });
  skills.sort(function (a, b) { return CX.catOrder.indexOf(a.cat) - CX.catOrder.indexOf(b.cat) || (a.src === b.src ? 0 : a.src === 'generic' ? -1 : b.src === 'generic' ? 1 : 0); });
  cx.idx = { world: cxWorld(), figs: figs, byId: byId, skills: skills, skById: skById, own: own, vsBy: vsBy };
  cx.key = key; cx.cards = {};
  return cx.idx;
}
function cxCard(id) {   // 名人的示意卡(未獲得也能算戰法 / 適性);快取到索引失效
  var f = (typeof CARD_FIG_BY_ID !== 'undefined') ? CARD_FIG_BY_ID[id] : null;
  if (!f) return null;
  if (!cx.cards[id] && typeof cardFromFig === 'function') { try { cx.cards[id] = cardFromFig(f, 'G', 0); } catch (e) { cx.cards[id] = null; } }
  return cx.cards[id] || null;
}
function cxSkillRows(id) {
  var c = cxCard(id), it = cxIndex().byId[id], rows = [];
  if (c && typeof bnCardSkillRows === 'function') { try { rows = bnCardSkillRows(c); } catch (e) { rows = []; } }
  if (!rows.length && it) rows = it.sk.map(function (k, i) { var d = BN_SKILLS[k]; return { id: k, cat: d.cat, name: d.name, role: d.cat === 'ult' ? 'ult' : (i === 0 && d.cat === 'passive' ? 'passive' : 'skill'), head: '', body: d.desc || '' }; });
  return rows;
}
// 擁有狀態:{ figId: { e, list:'roster'|'wait'|'wander'|'bag' } }(每次即時算)
function cxOwnMap() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, m = {};
  if (!cs) return m;
  ['roster', 'wait', 'wander', 'bag'].forEach(function (L) { (cs[L] || []).forEach(function (e) { if (e && e.fig && !m[e.fig]) m[e.fig] = { e: e, list: L }; }); });
  return m;
}

// ───────── 篩選 / 搜尋 ─────────
function cxScore(q, nn) {
  if (typeof srTextScore === 'function') return srTextScore(q, nn);
  if (!nn) return 0;
  return nn === q ? 100 : nn.indexOf(q) === 0 ? 90 : nn.indexOf(q) > 0 ? 70 : 0;
}
// o: {q, fac(-1 全部), troop(''), gr(-1), own(''|'y'|'n')} → 名人項目陣列(依品階、陣營、原順序;有關鍵字時依分數)
function cxFilterFigs(o) {
  var idx = cxIndex(), q = cxNorm(o && o.q), om = (o && o.own) ? cxOwnMap() : null, out = [];
  o = o || {};
  idx.figs.forEach(function (it, i) {
    var s = 1;
    if (o.fac >= 0 && o.fac !== undefined && o.fac !== null && it.fac !== +o.fac) return;
    if (o.troop && it.troop !== o.troop) return;
    if (o.gr >= 0 && o.gr !== undefined && o.gr !== null && it.gr !== +o.gr) return;
    if (om && (o.own === 'y') !== !!om[it.id]) return;
    if (q) { s = Math.max(cxScore(q, it.nn), it.idn.indexOf(q) >= 0 ? 50 : 0); if (s < 40) return; }
    out.push({ it: it, s: s, i: i });
  });
  out.sort(function (a, b) { return (b.s - a.s) || (q ? 0 : (b.it.gr - a.it.gr)) || (a.i - b.i); });
  return out.map(function (x) { return x.it; });
}
// o: {q, cat, src} → 戰法項目陣列(關鍵字比對戰法名;也比對持有者姓名)
function cxFilterSkills(o) {
  var idx = cxIndex(), q = cxNorm(o && o.q), out = [];
  o = o || {};
  idx.skills.forEach(function (it, i) {
    var s = 1;
    if (o.cat && it.cat !== o.cat) return;
    if (o.src && it.src !== o.src) return;
    if (q) {
      s = cxScore(q, it.nn);
      if (s < 40 && it.owners.some(function (f) { var x = idx.byId[f]; return x && x.nn.indexOf(q) >= 0; })) s = 35;
      if (s < 35) return;
    }
    out.push({ it: it, s: s, i: i });
  });
  out.sort(function (a, b) { return (b.s - a.s) || (a.i - b.i); });
  return out.map(function (x) { return x.it; });
}
// 給全域搜尋(search.js srSearch):q 已正規化。回 {figs:[{it,s}], skills:[{it,s}], nF, nS},各最多 CX.srMax 筆
function codexSearch(q, max) {
  var idx, figs = [], sks = [], m = Math.min(CX.srMax, max || CX.srMax);
  q = cxNorm(q);
  if (!q) return { figs: [], skills: [], nF: 0, nS: 0 };
  idx = cxIndex();
  idx.figs.forEach(function (it, i) { var s = Math.max(cxScore(q, it.nn), it.idn.indexOf(q) >= 0 ? 50 : 0); if (s >= 40) figs.push({ it: it, s: s, i: i }); });
  idx.skills.forEach(function (it, i) { var s = cxScore(q, it.nn); if (s >= 40) sks.push({ it: it, s: s, i: i }); });
  function by(a, b) { return (b.s - a.s) || (a.i - b.i); }
  figs.sort(by); sks.sort(by);
  return { figs: figs.slice(0, m), skills: sks.slice(0, m), nF: figs.length, nS: sks.length };
}
function codexSrHtml(res) {   // 搜尋面板的武將 / 戰法區塊(沿用 search.css 的 sr-row 樣式)
  var h = '', om;
  if (!res || (!(res.figs && res.figs.length) && !(res.skills && res.skills.length))) return '';
  om = cxOwnMap();
  if (res.figs && res.figs.length) {
    h += '<div class="sr-sec">武將(' + res.nF + ')</div>';
    res.figs.forEach(function (r) {
      var it = r.it, ow = !!om[it.id];
      h += '<div class="sr-row" data-sr="cx" data-k="f:' + cxEsc(it.id) + '" role="button" tabindex="0"><span class="sr-ic">👤</span><span class="sr-mn"><b>' + cxEsc(it.name) + '</b><small>' +
        cxEsc(cxGrName(it.gr) + '・' + cxFacName(it.fac) + '・' + it.troop + '兵') + '</small></span><span class="sr-st ' + (ow ? 's-unlocked' : 's-locked') + '">' + (ow ? '已擁有' : '未獲得') + '</span></div>';
    });
  }
  if (res.skills && res.skills.length) {
    h += '<div class="sr-sec">戰法(' + res.nS + ')</div>';
    res.skills.forEach(function (r) {
      var it = r.it;
      h += '<div class="sr-row" data-sr="cx" data-k="s:' + cxEsc(it.id) + '" role="button" tabindex="0"><span class="sr-ic">📜</span><span class="sr-mn"><b>' + cxEsc(it.name) + '</b><small>' +
        cxEsc((CX_CAT[it.cat] || '戰法') + '・' + cxOwnersTxt(it, 3)) + '</small></span></div>';
    });
  }
  return cxT(h);
}
function cxOwnersTxt(it, n) {
  var idx = cxIndex(), names;
  if (it.src === 'generic') return '通用戰法(路人可用兵書學)';
  if (it.src === 'ult') return it.troops.join('、') + '兵路人的大招';
  if (it.src === 'bond') return '專屬聯動(' + it.owners.map(function (f) { return idx.byId[f] ? idx.byId[f].name : f; }).join('、') + ')';
  names = it.owners.map(function (f) { return idx.byId[f] ? idx.byId[f].name : f; });
  return (names.length > n ? names.slice(0, n).join('、') + ' 等' : names.join('、')) + (it.src === 'teach' ? '(可傳授)' : '');
}
function codexOpenKey(k) {
  var p = String(k || '').split(':');
  if (p[0] === 'f') return codexOpen({ fig: p[1] });
  if (p[0] === 's') return codexOpen({ skill: p[1] });
  return codexOpen();
}

// ───────── 顯示片段 ─────────
function cxAvatar(id, owned, gr, lazy) {
  var src = (typeof fxFigImg === 'function' && fxFigImg(id)) || 'assets/portraits/' + id + '.webp';
  return '<span class="cx-av g' + (gr | 0) + (owned ? '' : ' un') + '"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14" r="7.5"/><path d="M5 40c0-9 6-14.5 15-14.5S35 31 35 40z"/></svg>' +
    '<img alt="" src="' + cxEsc(src) + '"' + (lazy ? ' loading="lazy" decoding="async"' : '') + ' onerror="this.remove()"></span>';
}
function cxShort(id) { return (typeof bnSkillShort === 'function') ? bnSkillShort(id) : ''; }
function cxHead(id) { return (typeof bnSkillHead === 'function') ? bnSkillHead(id) : ''; }
function cxBody(id) { return (typeof bnSkillBody === 'function') ? bnSkillBody(id) : ((BN_SKILLS[id] && BN_SKILLS[id].desc) || ''); }
function cxTagHtml(cat) { return '<i class="cx-tag t-' + cxEsc(cat) + '">' + (CX_CAT[cat] || '戰法') + '</i>'; }
function cxFigRowHtml(it, om) {
  var ow = om[it.id];
  return '<div class="cx-row" data-cx="fig" data-k="' + cxEsc(it.id) + '" role="button" tabindex="0">' + cxAvatar(it.id, !!ow, it.gr, true) +
    '<span class="cx-mn"><b>' + cxEsc(it.name) + (it.zi ? '<small>(' + cxEsc(it.zi) + ')</small>' : '') + '</b>' +
    '<small>' + cxEsc(cxGrName(it.gr) + '・' + cxFacName(it.fac) + '・') + cxTI(it.troop) + cxEsc(it.troop + '兵・' + CX_ROW[it.row]) + '</small>' +
    '<small class="cx-sks">' + it.sk.map(function (k) { return cxEsc(BN_SKILLS[k].name); }).join('・') + '</small></span>' +
    '<span class="cx-own' + (ow ? ' on' : '') + '">' + (ow ? '已擁有' : '未獲得') + '</span></div>';
}
function cxTraitList(c, fid) {   // 詞條(同 cardsui.js cuTraitsHtml 的取法):[{n, d, ex}]
  var list = [];
  if (!c) return list;
  (c.trn || []).forEach(function (t) {
    var f = null, k;
    if (typeof CARD_TRAITS !== 'undefined') for (k = 0; k < CARD_TRAITS.length; k++) if (CARD_TRAITS[k].n === t[0]) { f = CARD_TRAITS[k]; break; }
    if (!t[1] && f) list.push({ n: f.n, d: (typeof bnTraitText === 'function') ? bnTraitText(f.id) : f.d, ex: 0 });
    else list.push({ n: t[0], d: ((typeof bnXTraitText === 'function') ? bnXTraitText(t[2]) : t[2]) || '', ex: t[1] ? 1 : 0 });
  });
  return list.filter(function (t) { return t.d !== null; });
}
function cxBondsOf(id) {   // [{name, members:[id], txt}]
  var out = [], seen = {};
  function add(name, mem, txt) { if (seen[name]) return; seen[name] = 1; out.push({ name: name, members: mem, txt: txt || '' }); }
  var fs = (typeof BN_FIG_SKILLS !== 'undefined') ? BN_FIG_SKILLS[id] : null;
  if (fs && fs.bonds) fs.bonds.forEach(function (b) { add(b.name, [id].concat(b.members), (b.need === 'all' ? '夥伴全部在隊' : '任一夥伴在隊') + '時:' + (b.effect && typeof bnSkillShort === 'function' ? bnSkillShort(b.effect) : '效果提升')); });
  if (typeof BN_BONDS !== 'undefined') BN_BONDS.special.forEach(function (b) { if (b.members.indexOf(id) >= 0) add(b.name, b.members, '同隊 ' + b.need + ' 人觸發'); });
  if (typeof BN_COMBOS !== 'undefined' && BN_COMBOS.bonds) BN_COMBOS.bonds.forEach(function (b) { if (b.members.indexOf(id) >= 0) add(b.name, b.members, '同隊時:特定戰法連動'); });
  return out;
}
function cxFigLink(id) {
  var it = cxIndex().byId[id], f = (typeof CARD_FIG_BY_ID !== 'undefined') ? CARD_FIG_BY_ID[id] : null;
  if (it) return '<a class="cx-lk" role="button" data-cx="fig" data-k="' + cxEsc(id) + '">' + cxEsc(it.name) + '</a>';
  return cxEsc(f ? f.name : id);
}
function cxSkLink(id) { return '<a class="cx-lk" role="button" data-cx="sk" data-k="' + cxEsc(id) + '">' + cxEsc(BN_SKILLS[id] ? BN_SKILLS[id].name : id) + '</a>'; }
function cxFigDetailHtml(id) {
  var idx = cxIndex(), it = idx.byId[id], om = cxOwnMap(), ow, c, apt = null, h, rows, tr, bonds, vs = [], vsBy, lines;
  if (!it) return '<div class="cx-hint">找不到這位人物(可能不屬於目前的世界)。</div>';
  ow = om[id]; c = cxCard(id);
  if (c && typeof bnAptOf === 'function') { try { apt = bnAptOf(c).apt; } catch (e) { apt = null; } }
  h = '<div class="cx-det"><div class="cx-dh">' + cxAvatar(id, !!ow, it.gr, false) + '<div class="cx-mn"><b class="cx-big">' + cxEsc(it.name) + (it.zi ? '<small>(' + cxEsc(it.zi) + ')</small>' : '') + '</b>' +
    '<small>' + cxEsc(cxGrName(it.gr) + '階・' + cxFacName(it.fac) + (it.f.home ? '・' + it.f.home : '') + (it.f.birth ? '・' + it.f.birth : '')) + '</small>' +
    '<small>擅長:' + cxTI(it.troop) + cxEsc(it.troop) + '兵・預設' + CX_ROW[it.row] + '</small></div></div>';
  if (apt) h += '<div class="cx-l">兵種適性:' + (typeof BN_DATA !== 'undefined' ? BN_DATA.troopList : ['槍', '騎', '盾', '弓', '謀']).map(function (t) { return '<span class="cx-apt a' + cxEsc(apt[t]) + '">' + cxTI(t) + cxEsc(t) + ' ' + cxEsc(apt[t]) + '</span>'; }).join('') + '<small>(S 最好,C 最差)</small></div>';
  h += ow ? '<div class="cx-l cx-ok">已擁有(' + ({ roster: '在名冊', wait: '在待定席', wander: '流浪中', bag: '在卡包' }[ow.list] || '') + ')<button type="button" data-cx="roster" data-k="' + cxEsc(id) + '">到名冊查看</button></div>' : '<div class="cx-l cx-dim">尚未獲得:可在酒館、指名抽到。下面的戰法與詞條先看好,方便規劃。</div>';
  rows = cxSkillRows(id);
  h += '<div class="cx-sec">戰法(點名稱看完整說明)</div>';
  rows.forEach(function (r) {
    h += '<div class="cx-sk">' + cxTagHtml(r.cat) + cxSkLink(r.id) + '<small>' + cxEsc(r.head || cxHead(r.id)) + '</small><div class="cx-sb">' + cxEsc(r.body || cxBody(r.id)) + '</div></div>';
  });
  tr = cxTraitList(c, id);
  if (tr.length) {
    h += '<div class="cx-sec">詞條</div>';
    tr.forEach(function (t) { h += '<div class="cx-l">' + (t.ex ? '<i class="cx-tag t-ex">專屬</i>' : '') + '<b>' + cxEsc(t.n) + '</b>' + (t.d ? ' ' + cxEsc(t.d) : '') + '</div>'; });
  }
  bonds = cxBondsOf(id);
  if (bonds.length) {
    h += '<div class="cx-sec">羈絆</div>';
    bonds.forEach(function (b) { h += '<div class="cx-l"><b>' + cxEsc(b.name) + '</b>:' + b.members.map(cxFigLink).join('、') + (b.txt ? '<br><small>' + cxEsc(b.txt) + '</small>' : '') + '</div>'; });
  }
  it.sk.forEach(function (k) { var d = BN_SKILLS[k], t = (d.vs && typeof bntVsText === 'function') ? bntVsText(d) : ''; if (t) vs.push('<div class="cx-l">' + cxSkLink(k) + ':' + cxEsc(t) + '</div>'); });
  vsBy = (idx.vsBy[id] || []).map(function (x) { var d = BN_SKILLS[x.sk]; return '<div class="cx-l">' + cxFigLink(x.by) + ' 的' + cxSkLink(x.sk) + (d.vs.mode === 'defend' ? '(他被我攻擊時有防備)' : d.vs.mode === 'ally' ? '(同隊時互相影響)' : '(專門剋我)') + '</div>'; });
  if (vs.length || vsBy.length) {
    h += '<div class="cx-sec">宿敵與克制</div>' + vs.join('');
    if (vsBy.length) h += '<div class="cx-l cx-dim">被這些戰法點名:</div>' + vsBy.join('');
  }
  lines = (typeof FAMOUS_LINES !== 'undefined' && FAMOUS_LINES[id]) || null;
  if (it.f.bio || lines) {
    h += '<div class="cx-sec">故事</div>';
    if (it.f.bio) h += '<div class="cx-l">' + cxEsc(it.f.bio) + '</div>';
    if (lines) h += lines.map(function (s) { return '<div class="cx-l cx-q">「' + cxEsc(s) + '」</div>'; }).join('');
  }
  return h + '</div>';
}
function cxSkInfo(id) {   // 說明浮層與戰法詳情共用:bnSkillInfo 的 {title, tags, lines}
  var o = (typeof bnSkillInfo === 'function') ? bnSkillInfo(id) : null, d = BN_SKILLS[id];
  if (!o && d) o = { title: d.name, tags: [CX_CAT[d.cat] || '戰法'], lines: [['效果', d.desc || '']] };
  return o;
}
function cxSkillDetailHtml(id) {
  var idx = cxIndex(), it = idx.skById[id], o, h;
  if (!it) return '<div class="cx-hint">找不到這個戰法(可能不屬於目前的世界)。</div>';
  o = cxSkInfo(id);
  h = '<div class="cx-det"><div class="cx-l">' + cxTagHtml(it.cat) + '<b class="cx-big">' + cxEsc(it.name) + '</b></div><div class="cx-l"><span class="cx-src">' + cxEsc(CX_SRC[it.src]) + '</span></div>';
  o.lines.forEach(function (l) { h += '<div class="cx-l"><b class="cx-k">' + cxEsc(l[0]) + '</b> ' + cxEsc(l[1]) + '</div>'; });
  h += '<div class="cx-sec">誰會</div>';
  if (it.owners.length) h += '<div class="cx-l">' + it.owners.map(cxFigLink).join('、') + '</div>';
  if (it.src === 'teach') h += '<div class="cx-l cx-dim">名冊有這位名人時,可在名冊詳情「戰法學習」把這招傳授給路人。</div>';
  if (it.src === 'generic') h += '<div class="cx-l">路人武將可用兵書學會(名冊詳情 →「戰法學習」);兵書在討伐中掉落。</div>';
  if (it.src === 'ult') h += '<div class="cx-l">路人武將擔任「' + cxEsc(it.troops.join('、')) + '」兵時自動帶這招大招。</div>';
  if (it.src === 'bond') h += '<div class="cx-l cx-dim">名人隨身的專屬聯動,不占被動與選擇槽;只在指定武將在場或成為對象時才生效。</div>';
  return h + '</div>';
}
function cxSkillRowHtml(it) {
  var hd = cxHead(it.id), m = hd.match(/((.*))$/);
  hd = m ? m[1] : '';
  return '<div class="cx-row cx-skr" data-cx="skd" data-k="' + cxEsc(it.id) + '" role="button" tabindex="0">' + cxTagHtml(it.cat) +
    '<span class="cx-mn"><b>' + cxEsc(it.name) + '</b><small>' + cxEsc(cxShort(it.id)) + (hd ? '・' + cxEsc(hd) : '') + '</small><small class="cx-sks">' + cxEsc(cxOwnersTxt(it, 4)) + '</small></span></div>';
}

// ───────── 配隊:資料 / 擁有度 / 套用 ─────────
function cxTeams() {   // 目前世界的建議隊伍(js/codex_teams_data.js)
  var w = cxWorld(), byId = cxIndex().byId;
  if (typeof CODEX_TEAMS === 'undefined' || !CODEX_TEAMS || !Array.isArray(CODEX_TEAMS.teams)) return [];
  return CODEX_TEAMS.teams.filter(function (t) { return t.world === w && t.slots.every(function (s) { return !!byId[s.fig]; }); });
}
function cxRosterByFig() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, m = {};
  ((cs && cs.roster) || []).forEach(function (e) { if (e && e.fig && !m[e.fig]) m[e.fig] = e; });
  return m;
}
// 擁有度:{own(擁有含卡包 / 待定), roster(名冊可上陣), n, alt(主選缺但替代人選在名冊的格數)}
function cxTeamOwn(t) {
  var om = cxOwnMap(), rm = cxRosterByFig(), r = { own: 0, roster: 0, n: t.slots.length, alt: 0 };
  t.slots.forEach(function (s) {
    if (om[s.fig]) r.own++;
    if (rm[s.fig]) r.roster++;
    else if ((s.alt || []).some(function (a) { return !!rm[a]; })) r.alt++;
  });
  return r;
}
// 套用計畫:每格用主選或第一位在名冊的替代人選;缺人留空。回 {slots:[{id,row,col,troop}], used:[{slot,fig,alt}], missing:[姓名]}
function cxTeamPlan(t) {
  var rm = cxRosterByFig(), taken = {}, out = { slots: [], used: [], missing: [] };
  t.slots.forEach(function (s) {
    var cand = [s.fig].concat(s.alt || []), i, f, e = null, fs;
    for (i = 0; i < cand.length; i++) { f = cand[i]; if (rm[f] && !taken[f]) { e = rm[f]; break; } }
    if (!e) { out.missing.push((CARD_FIG_BY_ID[s.fig] || {}).name || s.fig); return; }
    taken[f] = 1;
    fs = (typeof BN_FIG_SKILLS !== 'undefined') ? BN_FIG_SKILLS[f] : null;
    out.slots.push({ id: e.id, row: s.row, col: s.col, troop: f === s.fig ? s.troop : ((fs && fs.troop) || s.troop) });
    out.used.push({ fig: f, alt: f !== s.fig });
  });
  return out;
}
// 寫入 bnui.js 的當前陣容(下次出戰 / 布陣時即為此陣容)。回 {ok, placed, reason}
function cxApplySlots(slots) {
  var d, ids, norm;
  if (typeof bnUiNormForm !== 'function' || typeof bnUiRosterIds !== 'function' || typeof bnu === 'undefined') return { ok: false, placed: 0, reason: 'nobn' };
  ids = bnUiRosterIds();
  norm = bnUiNormForm({ slots: slots }, ids);
  if (!norm.slots.length) return { ok: false, placed: 0, reason: 'empty' };
  d = bnu.data || (typeof bnUiLoad === 'function' ? bnUiLoad() : null);
  if (!d) return { ok: false, placed: 0, reason: 'nobn' };
  d.cur = norm;
  if (typeof bnUiSave === 'function') bnUiSave();
  if (bnu.open && bnu.phase === 'form') {
    bnu.slots = norm.slots.map(function (s) { return { id: s.id, row: s.row, col: s.col, troop: s.troop }; });
    bnu.slots.forEach(function (x) { if (x.troop) bnu.tp[x.id] = x.troop; });
    if (typeof bnUiRenderForm === 'function') bnUiRenderForm();
  }
  return { ok: true, placed: norm.slots.length, reason: '' };
}
function cxApplyTeam(t) {
  var p = cxTeamPlan(t), r;
  if (!p.slots.length) { cx.msg = '名冊裡沒有這組的任何人(含替代人選),無法套用。'; return { ok: false, placed: 0, missing: p.missing }; }
  r = cxApplySlots(p.slots);
  if (!r.ok) { cx.msg = r.reason === 'nobn' ? '布陣功能尚未載入。' : '無法套用。'; return { ok: false, placed: 0, missing: p.missing }; }
  cx.msg = '已套用「' + t.name + '」到布陣:' + r.placed + ' 人上陣' + (p.used.some(function (u) { return u.alt; }) ? '(部分用替代人選)' : '') + (p.missing.length ? ';缺 ' + p.missing.join('、') + ',該位置留空' : '') + '。下次出戰時生效。';
  cxToast(cx.msg);
  return { ok: true, placed: r.placed, missing: p.missing };
}
function cxSkillsOfEntry(e, troop) {
  if (typeof bnCardSkillRows !== 'function') return [];
  try { return bnCardSkillRows(e, { troop: troop }); } catch (er) { return []; }
}
function cxIsSupport(rows) {
  return rows.some(function (r) { var d = BN_SKILLS[r.id], ex = ((d.params || {}).extra || []).map(function (x) { return x.kind; }); return /^(heal_|revive|cleanse|shield_)/.test(d.kind) || ex.some(function (k) { return /^(heal_|shield_)/.test(k); }); });
}
// 依目前名冊挑 5 人:前排盾 / 槍 2 人、1 位治療或護盾輔助、後排弓 / 謀 2 人;同陣營(3 人以上有加成)與羈絆優先。回 {picks:[{e,troop,row,col,why}], fac, reasons, slots}
function cxRecommend() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, list, facSum = {}, best = -1, bestV = 0, picks = [], used = {}, reasons = [], specs, bondNames = [];
  list = ((cs && cs.roster) || []).map(function (e) {
    var tr = (typeof bnDefaultTroop === 'function') ? bnDefaultTroop(e) : '槍', sp = null, pw = 0, rows;
    try { sp = bnUnitSpec(e, { troop: tr }); pw = bnPower(sp); } catch (er) { sp = null; }
    rows = cxSkillsOfEntry(e, tr);
    return { e: e, troop: tr, sp: sp, pw: pw, sup: cxIsSupport(rows) };
  }).filter(function (x) { return x.sp; });
  if (!list.length) return { picks: [], fac: -1, reasons: ['名冊還沒有可上陣的人。'], slots: [] };
  list.forEach(function (x) { var f = x.e.fac; if (f === 4 || f === undefined) return; (facSum[f] = facSum[f] || []).push(x.pw); });
  Object.keys(facSum).forEach(function (f) { var a = facSum[f].sort(function (p, q) { return q - p; }); if (a.length >= 3) { var v = a.slice(0, 5).reduce(function (s, n) { return s + n; }, 0) * (1 + 0.02 * Math.min(5, a.length)); if (v > bestV) { bestV = v; best = +f; } } });
  function sc(x) {
    var s = x.pw * (best >= 0 && x.e.fac === best ? 1.15 : 1), k;
    for (k = 0; k < picks.length; k++) if (x.e.fig && picks[k].e.fig && cxBondPair(x.e.fig, picks[k].e.fig)) s *= 1.08;
    return s;
  }
  function take(pred, why) {
    var c = list.filter(function (x) { return !used[x.e.id] && pred(x); }).sort(function (a, b) { return sc(b) - sc(a); })[0];
    if (!c || picks.length >= 5) return false;
    used[c.e.id] = 1; picks.push({ e: c.e, troop: c.troop, sp: c.sp, why: why });
    return true;
  }
  take(function (x) { return x.troop === '盾' || x.troop === '槍'; }, '前排擋傷害(' + '盾 / 槍兵)');
  take(function (x) { return x.troop === '盾' || x.troop === '槍'; }, '前排擋傷害(盾 / 槍兵)');
  take(function (x) { return x.sup; }, '帶治療或護盾,讓隊伍撐得久');
  take(function (x) { return x.troop === '弓' || x.troop === '謀'; }, '後排輸出(弓 / 謀)');
  take(function (x) { return x.troop === '弓' || x.troop === '謀'; }, '後排輸出(弓 / 謀)');
  while (picks.length < 5 && take(function () { return true; }, '戰力高,補滿隊伍')) { /* 補滿 */ }
  specs = picks.map(function (p) { return p.sp; });
  if (typeof bnAutoLayout === 'function') bnAutoLayout(specs, null);
  picks.forEach(function (p) { p.row = p.sp.row; p.col = p.sp.col; delete p.sp; });
  if (best >= 0) {
    var n = picks.filter(function (p) { return p.e.fac === best; }).length;
    reasons.push(n >= 3 ? '同為' + cxFacName(best) + ' ' + n + ' 人:觸發陣營加成(' + cxFacBonusTxt(n) + ')。' : '名冊中' + cxFacName(best) + '人數最多,可再補同陣營的人觸發加成。');
  } else reasons.push('名冊中沒有 3 位以上同陣營(中立不算),以戰力與定位為主。');
  if (!picks.some(function (p) { return list.some(function (x) { return x.e.id === p.e.id && x.sup; }); })) reasons.push('名冊沒有會治療 / 護盾的人,建議抽一位補上(看「戰法」分頁搜尋「回復」)。');
  if (typeof BN_BONDS !== 'undefined') BN_BONDS.special.forEach(function (b) { var c = picks.filter(function (p) { return p.e.fig && b.members.indexOf(p.e.fig) >= 0; }).length; if (c >= b.need) bondNames.push(b.name); });
  if (bondNames.length) reasons.push('觸發羈絆:' + bondNames.join('、') + '。');
  return { picks: picks, fac: best, reasons: reasons, slots: picks.map(function (p) { return { id: p.e.id, row: p.row, col: p.col, troop: p.troop }; }) };
}
function cxBondPair(a, b) {
  var fa = (typeof BN_FIG_SKILLS !== 'undefined') ? BN_FIG_SKILLS[a] : null, hit = false;
  if (fa && fa.bonds) fa.bonds.forEach(function (x) { if (x.members.indexOf(b) >= 0) hit = true; });
  if (!hit && typeof BN_BONDS !== 'undefined') BN_BONDS.special.forEach(function (x) { if (x.members.indexOf(a) >= 0 && x.members.indexOf(b) >= 0) hit = true; });
  return hit;
}
function cxFacBonusTxt(n) {
  var b = (typeof BN_BONDS !== 'undefined' && BN_BONDS.fac) ? BN_BONDS.fac[Math.min(5, n)] : null, p = [];
  if (!b) return '';
  if (b.atk) p.push('全隊攻擊 +' + Math.round(b.atk * 100) + '%');
  if (b.hp) p.push('兵力 +' + Math.round(b.hp * 100) + '%');
  return p.join('、');
}

// ───────── 配隊:基本原則(數值取自 bn_data.js,不寫死) ─────────
var CX_RX_TRIG = { fire: '火系戰法', water: '水攻類戰法', arrow: '弓箭類戰法', thunder: '雷系戰法', ambush: '伏擊類戰法' };
var CX_RX_KIND = { atk_single: '單體重擊', atk_snipe: '狙擊', atk_exec: '斬殺', execute_chain: '連斬', atk_multi: '連續攻擊', lifesteal: '吸血攻擊', atk_pierce: '穿透攻擊', atk_front: '打前排', atk_cross: '十字攻擊', atk_back: '打後排', cleanse: '解除負面', morale_down: '降低發動率' };
var CX_RX_EVT = { on_ko: '擊倒敵人時', on_hit: '被攻擊時', confused_attack_ally: '被擾亂的敵人打到自己人時' };
var CX_RX_ST = { chill: '寒凍', soaked: '剛被水攻', metal: '盾兵', def_down: '防禦下降', spd_down: '速度下降', shield: '護盾', chain: '連環', mark: '標記', burn: '燃燒', poison: '中毒', bleed: '流血', bind: '定身', stun: '暈眩', fear: '威懾', silence: '沉默', taunt: '嘲諷', counter: '反擊', confuse: '擾亂' };
function cxPct(x) { return Math.round(x * 100) + '%'; }
function cxRxTxt(x) {
  var t = x.trigger || {}, q = x.requires || {}, who = [], st;
  if (t.tag) who.push(CX_RX_TRIG[t.tag] || '特定戰法');
  if (t.kind) who.push(t.kind.map(function (k) { return CX_RX_KIND[k] || '攻擊'; }).join('、'));
  if (t.cat === 'pursuit') who.push('追擊戰法');
  st = (q.status || []).map(function (s) { return CX_RX_ST[s] || ((typeof bntStName === 'function') ? bntStName(s) : s); }).join(q.match === 'all' ? '+' : '或');
  if (t.event) return (CX_RX_EVT[t.event] || '特定時機') + (st ? ',若' + (q.on === 'self' ? '自己' : '對方') + '帶「' + st + '」' : '') + ' → ' + x.name;
  return '用' + (who.join('或') || '特定戰法') + '打中帶「' + st + '」的' + (q.on === 'self' ? '自己' : '敵人') + ' → ' + x.name;
}
function cxRulesHtml() {
  var D = (typeof BN_DATA !== 'undefined') ? BN_DATA : null, B = (typeof BN_BONDS !== 'undefined') ? BN_BONDS : null, h = '', prey = [], preyRows = '', fac = [], tag = [];
  var sp;
  if (!D || !B) return '<div class="cx-hint">戰鬥資料尚未載入。</div>';
  if (typeof bnPreyText === 'function') prey = [bnPreyText() + '(' + bnPreyRule() + ')'];
  if (typeof bnPreyRows === 'function') preyRows = bnPreyRows().map(function (r) { return '<b class="cx-k">' + cxEsc(r.t) + '兵</b>克 ' + (cxEsc(r.beats.join('、')) || '—') + ',被 ' + (cxEsc(r.beaten.join('、')) || '—') + ' 克'; }).join('<br>');
  Object.keys(B.fac).forEach(function (n) { fac.push(n + ' 人:' + cxFacBonusTxt(+n)); });
  Object.keys(B.tag).forEach(function (t) { tag.push(t); });
  h += '<details class="cx-rules" open><summary>基本原則(先看這裡)</summary>';
  h += '<div class="cx-l"><b class="cx-k">站位</b>前排(盾、槍)最先被打,要放兵力高、防禦好的人;中排適合騎兵,速度快能先出手;後排(弓、謀)打得遠但不耐打,放輸出與治療。弓兵站後排時受到近戰普攻傷害 −' + cxPct(1 - D.archerBackTaken) + '。</div>';
  h += '<div class="cx-l"><b class="cx-k">兵種相剋</b>' + prey.join(';') + '。' + (preyRows ? '<br>' + preyRows + '<br>' : '') + '騎兵每場第一次普攻 ×' + D.cavCharge + ';謀士主動戰法發動率 +' + cxPct(D.mageRateBonus) + '。</div>';
  h += '<div class="cx-l"><b class="cx-k">治療與禁療</b>單次治療最多回復兵力上限的 ' + cxPct(D.healCap.single) + ';敵人的「禁療」會讓治療變少。第 ' + D.fatigue.start + ' 回合起雙方疲兵:每回合受到傷害 +' + cxPct(D.fatigue.dmg) + '、受到治療 −' + cxPct(D.fatigue.heal) + ',所以隊伍至少帶 1 位治療或護盾。</div>';
  h += '<div class="cx-l"><b class="cx-k">陣營加成</b>同一陣營上陣 ' + fac.join(';') + '(取人數最多的陣營;中立不計,加成上限 攻擊 ' + cxPct((B.cap || D.bondCap).atk) + '、兵力 ' + cxPct((B.cap || D.bondCap).hp) + ')。</div>';
  h += '<div class="cx-l"><b class="cx-k">職業羈絆</b>主職業同標籤 2 人生效:' + tag.join('、') + '(例如 2 位醫者 → 治療 +' + cxPct((B.tag['醫者'] || {}).heal || 0) + ')。</div>';
  h += '<div class="cx-l"><b class="cx-k">陣型</b>前排 3 人以上「鋒矢」前排攻擊 +' + cxPct(D.formation.fengshi) + ';前排 2 + 中排 1「圓陣」全隊防禦 +' + cxPct(D.formation.yuanzhen) + ';後排 2 人以上「雁行」後排攻擊 +' + cxPct(D.formation.yanxing) + '。</div>';
  sp = B.special.filter(function (b) { return b.members.every(function (m) { return !!cxIndex().byId[m]; }); });   // 只列目前世界的人
  if (sp.length) h += '<div class="cx-l"><b class="cx-k">名人組合</b>' + sp.map(function (b) { return b.name + '(' + b.members.map(function (m) { return (CARD_FIG_BY_ID[m] || {}).name || m; }).join('、') + ',' + b.need + ' 人)'; }).join(';') + '。另外很多名人有自己的羈絆,在「武將」頁的「羈絆」欄可看到夥伴。</div>';
  if (typeof BN_COMBOS !== 'undefined' && BN_COMBOS.reactions) h += '<details class="cx-rx"><summary>組合技(' + BN_COMBOS.reactions.length + ' 種,先上狀態再打會觸發)</summary>' + BN_COMBOS.reactions.map(function (x) { return '<div class="cx-l">' + cxEsc(cxRxTxt(x)) + '</div>'; }).join('') + '</details>';
  return h + '</details>';
}
function cxTeamHtml(t) {
  var o = cxTeamOwn(t), h;
  h = '<div class="cx-team"><div class="cx-th"><b>' + cxEsc(t.name) + '</b><span class="cx-own' + (o.roster >= o.n ? ' on' : '') + '">我已擁有 ' + o.own + '/' + o.n + '</span></div>';
  h += '<div class="cx-l cx-dim">' + cxEsc(t.role) + '</div><div class="cx-slots">';
  t.slots.forEach(function (s) {
    h += '<div class="cx-slot"><small>' + CX_ROW[s.row] + '・' + cxEsc(s.troop) + '</small>' + cxFigLink(s.fig) + (s.alt && s.alt.length ? '<small>替代:' + s.alt.map(cxFigLink).join('、') + '</small>' : '') + '</div>';
  });
  h += '</div><div class="cx-l">' + cxEsc(t.why) + '</div>';
  if (t.bonds && t.bonds.length) h += '<div class="cx-l"><b class="cx-k">羈絆</b>' + cxEsc(t.bonds.join('、')) + '</div>';
  h += '<div class="cx-l">' + (o.roster < o.n ? '<small>名冊可上陣 ' + o.roster + ' 人' + (o.alt ? '、另 ' + o.alt + ' 格可用替代人選' : '') + (o.own > o.roster ? ';有人在卡包或待定席,名冊有空位時才能上陣' : '') + '</small>' : '') +
    '<button type="button" data-cx="apply" data-k="' + cxEsc(t.id) + '"' + (o.roster + o.alt ? '' : ' disabled') + '>一鍵套用到布陣</button></div>';
  return h + '</div>';
}
function cxRecHtml() {
  var r = cx.rec, h;
  if (!r) return '';
  h = '<div class="cx-team cx-rec"><div class="cx-th"><b>依我的名冊推薦</b></div>';
  if (!r.picks.length) return h + '<div class="cx-l">' + cxEsc(r.reasons.join('')) + '</div></div>';
  h += '<div class="cx-slots">' + r.picks.map(function (p) { return '<div class="cx-slot"><small>' + CX_ROW[p.row] + '・' + cxEsc(p.troop) + '</small><b>' + cxEsc(p.e.name) + '</b><small>' + cxEsc(p.why) + '</small></div>'; }).join('') + '</div>';
  h += r.reasons.map(function (s) { return '<div class="cx-l">' + cxEsc(s) + '</div>'; }).join('');
  return h + '<div class="cx-l"><button type="button" data-cx="applyrec">一鍵套用到布陣</button></div></div>';
}

// ───────── 面板 ─────────
function codexBtnHtml() { return '<button class="cuq cxcb" data-a="codex" aria-label="武將與戰法圖鑑" title="圖鑑">圖鑑</button>'; }
function cxWorldTxt() {
  var w = cxWorld(), n = cxIndex().figs.length;
  return w === 'han' ? '歷史世界・三國名人 ' + n + ' 位' : '魔幻世界(' + (CX_RACE[w] || w) + ')・傳說英雄 ' + n + ' 位';
}
function cxEnsure() {
  var el, head, tabs;
  if (cx.el) return cx.el;
  if (typeof document === 'undefined' || !document.createElement || !document.body) return null;
  el = document.createElement('div'); el.id = 'codexPanel'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '圖鑑');
  head = document.createElement('div'); head.className = 'cx-head';
  head.innerHTML = '<b>圖鑑</b><small class="cx-world"></small><button type="button" class="cx-x" data-cx="close" aria-label="關閉圖鑑">✕</button>';
  tabs = document.createElement('div'); tabs.className = 'cx-tabs';
  cx.tool = document.createElement('div'); cx.tool.className = 'cx-tool';
  cx.list = document.createElement('div'); cx.list.className = 'cx-list';
  cx.ov = document.createElement('div'); cx.ov.className = 'cx-ov'; cx.ov.hidden = true;
  el.appendChild(head); el.appendChild(tabs); el.appendChild(cx.tool); el.appendChild(cx.list); el.appendChild(cx.ov);
  el.addEventListener('click', cxOnClick);
  el.addEventListener('input', cxOnInput);
  el.addEventListener('change', cxOnChange);
  el.addEventListener('keydown', cxOnRowKey);
  if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') window.addEventListener('keydown', cxOnKey, true);   // 只登記一次(Esc 先關浮層 / 回上一頁;比 panelmgr 的 document 捕獲更早)
  document.body.appendChild(el);
  cx.el = el; cx.tabsEl = tabs;
  cx.title = head.querySelector ? head.querySelector('.cx-world') : null;
  if (typeof panelRegister === 'function') panelRegister('codex', { kind: 'big', el: el, close: cxHide });
  return el;
}
function cxHide() {
  cx.open = false; cx.ovId = '';
  if (cx.timer && typeof clearTimeout === 'function') clearTimeout(cx.timer);
  cx.timer = 0;
  if (cx.ov) cx.ov.hidden = true;
  if (cx.el) cx.el.hidden = true;
}
// opt: {tab, fig, skill}
function codexOpen(opt) {
  var el = cxEnsure();
  opt = opt || {};
  if (!el) return false;
  if (typeof panelOpen === 'function') panelOpen('codex');
  cx.open = true; el.hidden = false; cx.msg = ''; cx.ovId = '';
  if (opt.fig) { cx.tab = 'fig'; cx.stack = [{ k: 'f', id: opt.fig }]; }
  else if (opt.skill) { cx.tab = 'skill'; cx.stack = [{ k: 's', id: opt.skill }]; }
  else { if (opt.tab) cx.tab = opt.tab; cx.stack = []; }
  cxRender(true);
  return true;
}
function codexClose() {
  if (typeof panelIsOpen === 'function' && typeof panelClose === 'function' && panelIsOpen('codex')) panelClose('codex');
  else cxHide();
}
function codexToggle() { if (cx.open) codexClose(); else codexOpen(); }
function codexIsOpen() { return !!cx.open; }
function cxSel(name, val, opts) {
  return '<select data-cxf="' + name + '" aria-label="' + cxEsc(opts[0][1]) + '">' + opts.map(function (o) { return '<option value="' + cxEsc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + cxEsc(o[1]) + '</option>'; }).join('') + '</select>';
}
function cxFacOpts() {
  var idx = cxIndex(), seen = {}, list = [];
  idx.figs.forEach(function (it) { if (!seen[it.fac]) { seen[it.fac] = 1; list.push(it.fac); } });
  list.sort(function (a, b) { return a - b; });
  return [['-1', '全部陣營']].concat(list.map(function (f) { return [String(f), cxFacName(f)]; }));
}
function cxToolHtml() {
  var tl = (typeof BN_DATA !== 'undefined') ? BN_DATA.troopList : ['槍', '騎', '盾', '弓', '謀'];
  var ex = cxWorld() === 'han' ? '曹操、孔明' : cxIndex().figs.slice(0, 2).map(function (it) { return it.name; }).join('、');
  if (cx.tab === 'fig') return '<input type="search" data-cxin="q" placeholder="搜尋姓名,例如 ' + cxEsc(ex) + '" aria-label="搜尋武將" autocomplete="off" enterkeyhint="search" value="' + cxEsc(cx.q) + '">' +
    '<div class="cx-fs">' + cxSel('fac', cx.fac, cxFacOpts()) + cxSel('troop', cx.troop, [['', '全部兵種']].concat(tl.map(function (t) { return [t, t + '兵']; }))) +
    cxSel('gr', cx.gr, [['-1', '全部品階'], ['4', '金'], ['3', '紫']]) + cxSel('own', cx.own, [['', '全部'], ['y', '已擁有'], ['n', '未獲得']]) + '</div>';
  if (cx.tab === 'skill') return '<input type="search" data-cxin="skq" placeholder="搜尋戰法或武將姓名,例如 火攻、回復" aria-label="搜尋戰法" autocomplete="off" enterkeyhint="search" value="' + cxEsc(cx.skq) + '">' +
    '<div class="cx-fs">' + cxSel('cat', cx.cat, [['', '全部類別']].concat(CX.catOrder.map(function (c) { return [c, CX_CAT[c]]; }))) +
    cxSel('src', cx.src, [['', '全部來源'], ['fig', CX_SRC.fig], ['teach', CX_SRC.teach], ['generic', CX_SRC.generic], ['ult', CX_SRC.ult], ['bond', CX_SRC.bond]]) + '</div>';
  return '<div class="cx-fs">' + cxSel('tfac', cx.tfac, [['-1', '全部陣營']].concat(cxTeamFacs().map(function (f) { return [String(f), cxTeamFacName(f)]; }))) +
    '<button type="button" data-cx="rec">依我的名冊推薦</button></div>';
}
function cxTeamFacs() { var s = {}, out = []; cxTeams().forEach(function (t) { var k = cxWorld() === 'han' ? t.fac : t.world; if (!s[k]) { s[k] = 1; out.push(k); } }); return out; }
function cxTeamFacName(f) { return cxWorld() === 'han' ? cxFacName(+f) : (CX_RACE[f] || f); }
function cxListHtml() {
  var top = cx.stack.length ? cx.stack[cx.stack.length - 1] : null, h = '', list, n, om;
  if (top) return '<button type="button" class="cx-back" data-cx="back">‹ 返回</button>' + (top.k === 'f' ? cxFigDetailHtml(top.id) : cxSkillDetailHtml(top.id));
  if (cx.tab === 'fig') {
    list = cxFilterFigs({ q: cx.q, fac: +cx.fac, troop: cx.troop, gr: +cx.gr, own: cx.own });
    om = cxOwnMap();
    n = Math.min(list.length, (cx.page + 1) * CX.pageFig);
    h += '<div class="cx-sum">共 ' + list.length + ' 位' + (cx.own ? '' : ',已擁有 ' + list.filter(function (it) { return !!om[it.id]; }).length + ' 位') + '。未獲得的也能看戰法,方便規劃抽卡。</div>';
    if (!list.length) h += '<div class="cx-hint">找不到符合的武將,試試別的姓名或放寬篩選。</div>';
    list.slice(0, n).forEach(function (it) { h += cxFigRowHtml(it, om); });
    if (n < list.length) h += '<button type="button" class="cx-more" data-cx="more">再顯示 ' + Math.min(CX.pageFig, list.length - n) + ' 位(還有 ' + (list.length - n) + ' 位)</button>';
    return h;
  }
  if (cx.tab === 'skill') {
    list = cxFilterSkills({ q: cx.skq, cat: cx.cat, src: cx.src });
    n = Math.min(list.length, (cx.page + 1) * CX.pageSk);
    h += '<div class="cx-sum">共 ' + list.length + ' 個戰法。點一下看完整說明與誰會。</div>';
    if (!list.length) h += '<div class="cx-hint">找不到符合的戰法。</div>';
    list.slice(0, n).forEach(function (it) { h += cxSkillRowHtml(it); });
    if (n < list.length) h += '<button type="button" class="cx-more" data-cx="more">再顯示 ' + Math.min(CX.pageSk, list.length - n) + ' 個(還有 ' + (list.length - n) + ' 個)</button>';
    return h;
  }
  if (cx.msg) h += '<div class="cx-msg">' + cxEsc(cx.msg) + '</div>';
  h += cxRecHtml() + cxRulesHtml();
  list = cxTeams().filter(function (t) { return +cx.tfac < 0 || String(cxWorld() === 'han' ? t.fac : t.world) === String(cx.tfac); });
  h += '<div class="cx-sec">各陣營配隊建議(' + list.length + ' 組)</div>';
  if (!list.length) h += '<div class="cx-hint">這個世界還沒有配隊建議。</div>';
  list.forEach(function (t) { h += cxTeamHtml(t); });
  return h;
}
function cxRender(tool) {
  if (!cx.el) return;
  if (cx.title) cx.title.textContent = cxWorldTxt();
  if (cx.tabsEl) cx.tabsEl.innerHTML = CX_TABS.map(function (t) { return '<button type="button" class="cx-tab' + (cx.tab === t[0] ? ' on' : '') + '" data-cx="tab" data-k="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  if (tool) cx.tool.innerHTML = cxT(cxToolHtml());
  cx.tool.hidden = cx.stack.length > 0;
  cxPaint();
  cxRenderOv();
}
// 魔幻世界用語替換(fx_text.js fxText;歷史世界原樣)
function cxT(s) { return (typeof fxText === 'function') ? fxText(s) : s; }
function cxPaint() { if (cx.list) cx.list.innerHTML = cxT(cxListHtml()); }
function cxRenderOv() {
  var o, it, h;
  if (!cx.ov) return;
  if (!cx.ovId || !(o = cxSkInfo(cx.ovId))) { cx.ov.hidden = true; cx.ov.innerHTML = ''; return; }
  it = cxIndex().skById[cx.ovId];
  h = '<div class="cx-ovb"><h4>' + cxEsc(o.title) + '</h4><div>' + (o.tags || []).map(function (t) { return '<span class="cx-src">' + cxEsc(t) + '</span>'; }).join('') + '</div>' +
    o.lines.map(function (l) { return '<div class="cx-l"><b class="cx-k">' + cxEsc(l[0]) + '</b> ' + cxEsc(l[1]) + '</div>'; }).join('') +
    (it && it.owners.length ? '<div class="cx-l"><b class="cx-k">誰會</b>' + it.owners.map(cxFigLink).join('、') + '</div>' : '') +
    '<div class="cx-l"><button type="button" data-cx="ovx">關閉</button><button type="button" data-cx="skd" data-k="' + cxEsc(cx.ovId) + '">戰法詳情</button></div></div>';
  cx.ov.innerHTML = cxT(h); cx.ov.hidden = false;
}
function cxPush(v) {
  if (cx.list) cx.scroll[cx.stack.length] = cx.list.scrollTop | 0;
  cx.stack.push(v); cx.ovId = '';
  cxRender(false);
  if (cx.list) cx.list.scrollTop = 0;
}
function cxBack() {
  if (!cx.stack.length) return false;
  cx.stack.pop(); cx.ovId = '';
  cxRender(false);
  if (cx.list && cx.scroll[cx.stack.length] !== undefined) cx.list.scrollTop = cx.scroll[cx.stack.length];
  return true;
}
function cxOnClick(e) {
  var t = e.target && e.target.closest ? e.target.closest('[data-cx]') : null, a, k, team;
  if (!t || t.disabled) { if (e.target === cx.ov) { cx.ovId = ''; cxRenderOv(); } return; }
  a = t.getAttribute('data-cx'); k = t.getAttribute('data-k') || '';
  if (a === 'close') codexClose();
  else if (a === 'tab') { if (cx.tab !== k) { cx.tab = k; cx.page = 0; } cx.stack = []; cx.ovId = ''; cx.msg = ''; cxRender(true); }
  else if (a === 'fig') cxPush({ k: 'f', id: k });
  else if (a === 'skd') cxPush({ k: 's', id: k });
  else if (a === 'sk') { cx.ovId = k; cxRenderOv(); }
  else if (a === 'ovx') { cx.ovId = ''; cxRenderOv(); }
  else if (a === 'back') cxBack();
  else if (a === 'more') { cx.page++; cxPaint(); }
  else if (a === 'roster') codexGoRoster(k);
  else if (a === 'rec') { cx.rec = cxRecommend(); cx.msg = ''; cxRender(false); }
  else if (a === 'applyrec') { if (cx.rec && cx.rec.slots.length) { var r = cxApplySlots(cx.rec.slots); cx.msg = r.ok ? '已套用推薦陣容到布陣(' + r.placed + ' 人),下次出戰時生效。' : '無法套用。'; cxToast(cx.msg); } cxRender(false); }
  else if (a === 'apply') { team = cxTeams().filter(function (x) { return x.id === k; })[0]; if (team) cxApplyTeam(team); cxRender(false); }
}
function cxOnRowKey(e) {
  var t = e.target;
  if (!t || (e.key !== 'Enter' && e.key !== ' ') || !t.getAttribute || t.getAttribute('role') !== 'button' || !t.getAttribute('data-cx') || t.tagName === 'BUTTON') return;
  if (e.preventDefault) e.preventDefault();
  cxOnClick({ target: t });
}
function cxOnInput(e) {
  var t = e.target, f = t && t.getAttribute ? t.getAttribute('data-cxin') : null;
  if (!f) return;
  if (cx.timer && typeof clearTimeout === 'function') clearTimeout(cx.timer);
  cx.timer = setTimeout(function () { cx.timer = 0; cx[f] = String(t.value || '').slice(0, 20); cx.page = 0; cxPaint(); }, CX.debounce);
}
function cxOnChange(e) {
  var t = e.target, f = t && t.getAttribute ? t.getAttribute('data-cxf') : null;
  if (!f) return;
  cx[f] = t.value; cx.page = 0;
  cxPaint();
}
// 設定篩選 / 關鍵字並重畫(測試與外部用)
function cxSet(o) { Object.keys(o || {}).forEach(function (k) { cx[k] = o[k]; }); cx.page = 0; if (cx.list) cxPaint(); }
function cxOnKey(e) {
  if (!cx.open || !e || (e.key !== 'Escape' && e.key !== 'Esc')) return;
  if (cx.ovId) { cx.ovId = ''; cxRenderOv(); }
  else if (!cxBack()) return;
  if (e.stopPropagation) e.stopPropagation();
  if (e.preventDefault) e.preventDefault();
}
// 跳到名冊 / 卡包詳情(cardsui.js;開卡牌面板時圖鑑由 panelmgr 互斥關閉)
function codexGoRoster(fig) {
  var om = cxOwnMap()[fig];
  if (!om || typeof cardsUiOpen !== 'function' || typeof cu === 'undefined') return false;
  cardsUiOpen(om.list === 'bag' ? 'B' : 'R');
  if (om.list === 'bag') cu.bid = om.e.id; else cu.detail = om.e.id;
  if (typeof cardsUiRender === 'function') cardsUiRender();
  return true;
}

// ───────── 抽卡開獎:最終排列加「看戰法」 ─────────
function codexRevealHtml(list) {
  return cxT('<div class="cx-rvh">本批戰法(完整說明:卡牌面板 →「圖鑑」)</div>' + (list || []).map(function (c) {
    var rows = [], main;
    if (typeof bnCardSkillRows === 'function') { try { rows = bnCardSkillRows(c); } catch (e) { rows = []; } }
    main = rows.filter(function (r) { return r.cat !== 'passive'; }).concat(rows.filter(function (r) { return r.cat === 'passive'; })).slice(0, 3);
    return '<div class="cx-rvr g' + (c.gr | 0) + '"><b>' + cxEsc(c.name) + (c.fig ? '<small>名人</small>' : '') + '</b><span>' + (main.length ? main.map(function (r) { return '<i class="cx-tag t-' + cxEsc(r.cat) + '">' + (CX_CAT[r.cat] || '') + '</i>' + cxEsc(r.name); }).join(' ') + (rows.length > 3 ? ' <small>+' + (rows.length - 3) + '</small>' : '') : '<small>無戰法</small>') + '</span></div>';
  }).join(''));
}
function codexRevealHook(s) {
  var b, sh, bot;
  if (!s || !s.root || !s.btn || !s.list || typeof document === 'undefined' || s.cxHooked) return false;
  s.cxHooked = true;
  bot = s.btn.parentNode || null;
  sh = document.createElement('div'); sh.className = 'cx-rvs'; sh.hidden = true;
  sh.innerHTML = codexRevealHtml(s.list);
  sh.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); sh.hidden = true; });
  b = document.createElement('button'); b.type = 'button'; b.className = 'cx-rvb'; b.textContent = '看戰法';
  b.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); sh.hidden = !sh.hidden; });
  s.root.appendChild(sh);
  if (bot && bot.insertBefore) bot.insertBefore(b, s.btn); else s.root.appendChild(b);
  return true;
}
