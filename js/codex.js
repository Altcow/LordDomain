// js/codex.js — 配隊建議面板(圖鑑):基本原則 + 各陣營 / 羈絆建議隊伍 + 依名冊推薦(可一鍵套用到布陣)。
// 武將 / 戰法的完整介紹(人物、戰法、兵種卡、隊伍)已移到卡包「大全」分頁(js/cardsui_codex.js);本檔保留索引 cxIndex、名人示意卡 cxCard、戰法列 cxSkillRows 等資料函式供大全使用。
// 入口:卡包標題列「圖鑑」鈕(cardsui.js 一行 typeof 守衛呼叫 codexBtnHtml / codexOpen);全域搜尋(search.js)的武將 / 戰法結果經 codexSearch / codexSrHtml / codexOpenKey 開大全詳情。
// 抽卡開獎最終排列加「看戰法」鈕(cardsreveal.js rvFinal 一行呼叫 codexRevealHook)。面板以 panelmgr 登錄為 big('codex')。
// 索引 cxIndex 首次開啟時建立並快取;世界切換(fxPack)後失效重建。歷史世界只列 CARD_FIGS,魔幻世界只列 FX_FIGS(fx_cards.js fxFigSrc)。
// 戰法文字一律取自 bn_text.js(bnCardSkillRows / bnSkillInfo / bnSkillShort);配隊資料 js/codex_teams_data.js(tools/gen_codex_teams.js 產生)。
// 布陣套用只寫 bnui.js 既有的當前陣容(bnu.data.cur → bnUiSave),不改戰鬥版面。不發聲。外部全域一律 typeof 守衛。ES2017;不用 ?. ??。
// 2026-11-15 R6:配隊建議只列「全員第一季武將」的隊伍(cxTeams;替代人選也只留第一季)、每格標出戰法(skc,已解鎖亮 / 未解鎖灰並標「拆〇〇」)、套用到布陣後問「也套用戰法?」(skrTeamPlan + skrApply);cxRecommend 的 withSkills 見該函式。
// 全域名稱:CX cx codexOpen codexClose codexToggle codexIsOpen codexBtnHtml codexOpenKey codexSearch codexSrHtml codexGoRoster codexRevealHook codexRevealHtml
//   cxIndex cxCard cxSkillRows cxFullPoolRows cxOwnMap cxTraitList cxBondsOf cxFigLink cxTeams cxTeamOwn cxTeamPlan cxApplySlots cxRecommend cxRulesHtml

var CX = { pageFig: 20, pageSk: 30, srMax: 10, debounce: 150, catOrder: ['command', 'active', 'pursuit', 'passive', 'ult'] };
var CX_TABS = [['team', '配隊']];
var CX_CAT = { command: '指揮', active: '主動', pursuit: '追擊', passive: '被動', ult: '大招' };
var CX_SRC = { fig: '名人專屬', teach: '名人戰法・可傳承', generic: '通用戰法', ult: '兵種大招(路人)', bond: '專屬聯動' };
var CX_POS = ['副將(前鋒)', '副將(中衛)', '主將'];   // 3 人制站位 row 0 / 1 / 2
var CX_RACE = { elf: '精靈', dwarf: '矮人', kingdom: '王國' };
var cx = { el: null, tool: null, list: null, ov: null, title: null, open: false, tab: 'team', stack: [], ovId: '', q: '', fac: -1, troop: '', gr: -1, own: '', skq: '', cat: '', src: '', tfac: -1,
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
    sk = [fs.passive].concat(Object.keys(bondSet).filter(function (k) { return bondSet[k] === f.id; })).concat(fs.ult ? [fs.ult] : []).concat((typeof BN_KIT_BY !== 'undefined' && BN_KIT_BY.figs && BN_KIT_BY.figs[f.id] && BN_KIT_BY.figs[f.id].legacy) ? [BN_KIT_BY.figs[f.id].legacy] : []).filter(function (k, i, a) { return k && typeof BN_SKILLS !== 'undefined' && BN_SKILLS[k] && a.indexOf(k) === i; });   // 2026-11-13 第一季:併入傳承(新配武將戰法池為空,固定 + 被動 + 傳承);2026-11-15 傳承一人一個:不再列可拆池 fs.skills
    it = { id: f.id, f: f, name: String(f.name), zi: f.zi && f.zi !== '新' ? String(f.zi) : '', fac: f.fac, gr: f.gr, troop: fs.troop, row: fs.row === '前' ? 0 : fs.row === '中' ? 1 : 2, sk: sk, race: f.race || '' };
    it.nn = cxNorm(it.name + it.zi); it.idn = cxNorm(f.id);
    figs.push(it); byId[f.id] = it;
    sk.concat((fs.skills || []).filter(function (k) { return k && typeof BN_SKILLS !== 'undefined' && BN_SKILLS[k] && sk.indexOf(k) < 0; })).forEach(function (k) { (own[k] = own[k] || []).push(f.id); });   // 戰法圖鑑(skills / skById / own)仍登錄名人的整個戰法池;it.sk(人物頁顯示)不含可拆池
  });
  if (typeof BN_SKILLS !== 'undefined') Object.keys(BN_SKILLS).forEach(function (k) {
    var d = BN_SKILLS[k], it;
    if (d.fig && !own[k]) return;              // 他世界名人的戰法不列
    if (!d.fig && !d.generic && !ultBy[k] && !own[k]) return;   // own[k]:被名人當固定 / 被動 / 傳承用的通用戰法(2026-11-13 第一季借用)
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
  if (!cx.cards[id] && typeof cardFromFig === 'function') { try { cx.cards[id] = cardFromFig(f, 'E', 0); } catch (e) { cx.cards[id] = null; } }
  return cx.cards[id] || null;
}
function cxSkillRows(id) {
  var c = cxCard(id), it = cxIndex().byId[id], rows = [];
  if (!cxOwnMap()[id]) { rows = cxFullPoolRows(id); if (rows.length) return rows; }   // 未獲得名人:固定 / 被動 / 聯動 / 傳承(可拆池不再列,一人一個傳承)
  if (c && typeof bnCardSkillRows === 'function') { try { rows = bnCardSkillRows(c); } catch (e) { rows = []; } }
  if (!rows.length && it) rows = it.sk.map(function (k, i) { var d = BN_SKILLS[k]; return { id: k, cat: d.cat, name: d.name, role: d.cat === 'ult' ? 'ult' : (i === 0 && d.cat === 'passive' ? 'passive' : 'skill'), head: '', body: d.desc || '' }; });
  return rows;
}
// 未獲得名人的全池列表(B2 後名人只顯示固定 / 被動 / 聯動 / 已裝選擇槽;圖鑑武將頁列固定 / 被動 / 聯動 / 傳承,傳承標示「傳承」;2026-11-15 起不再列可拆池)
function cxFullPoolRows(id) {
  var K = (typeof BN_KIT_BY !== 'undefined' && BN_KIT_BY.figs) ? BN_KIT_BY.figs[id] : null, out = [];
  if (!K || typeof BN_SKILLS === 'undefined') return out;
  function add(sid, role) {
    var d = BN_SKILLS[sid], p, lg = sid === K.legacy;
    if (!d || out.some(function (r) { return r.id === sid; })) return;
    p = bnSkillParts(sid);
    out.push({ id: sid, role: lg ? 'legacy' : role, cat: d.cat, name: d.name, head: (lg ? '傳承・' : '') + p.head, body: p.body, desc: p.desc, cd: d.cd || 0, rate: d.rate, fig: d.fig || '', flavor: (typeof BN_FLAVOR !== 'undefined' && BN_FLAVOR[sid]) || '' });
  }
  if (K.passive) add(K.passive, 'passive');
  (K.bondFix || []).forEach(function (sid) { add(sid, 'bond'); });
  if (K.fixed) add(K.fixed, 'ult');
  if (K.legacy) add(K.legacy, 'legacy');
  return out;
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
// o: {q, cat, src} → 戰法項目陣列(關鍵字比對戰法名;也比對持有者姓名)
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
  if (it.src === 'generic') return '通用戰法(路人可傳承習得)';
  if (it.src === 'ult') return it.troops.join('、') + '兵路人的大招';
  if (it.src === 'bond') return '專屬聯動(' + it.owners.map(function (f) { return idx.byId[f] ? idx.byId[f].name : f; }).join('、') + ')';
  names = it.owners.map(function (f) { return idx.byId[f] ? idx.byId[f].name : f; });
  return (names.length > n ? names.slice(0, n).join('、') + ' 等' : names.join('、')) + (it.src === 'teach' ? '(可傳承)' : '');
}
// 全域搜尋(search.js)的武將 / 戰法結果:開卡包『大全』詳情(cuCodexOpenKey);查無或大全未載入時退回配隊頁
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

// ───────── 配隊:資料 / 擁有度 / 套用 ─────────
function cxS01(fig) { return typeof CARD_S01_FIGS === 'undefined' || !CARD_S01_FIGS || CARD_S01_FIGS.indexOf(fig) >= 0; }   // 第一季(抽得到)的名人;沒有名單資料時視為都可
function cxTeams() {   // 目前世界的建議隊伍(js/codex_teams_data.js);歷史世界只列全員第一季武將的隊伍,替代人選也只留第一季
  var w = cxWorld(), byId = cxIndex().byId, s01 = (w === 'han');
  if (typeof CODEX_TEAMS === 'undefined' || !CODEX_TEAMS || !Array.isArray(CODEX_TEAMS.teams)) return [];
  return CODEX_TEAMS.teams.filter(function (t) { return t.world === w && t.slots.every(function (s) { return !!byId[s.fig] && (!s01 || cxS01(s.fig)); }); }).map(function (t) {
    if (!s01 || t.slots.every(function (s) { return (s.alt || []).every(cxS01); })) return t;
    return Object.assign({}, t, { slots: t.slots.map(function (s) { return Object.assign({}, s, { alt: (s.alt || []).filter(cxS01) }); }) });
  });
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
  if (!p.slots.length) { cx.msg = '卡包裡沒有這組的任何人(含替代人選),無法套用。'; return { ok: false, placed: 0, missing: p.missing }; }
  r = cxApplySlots(p.slots);
  if (!r.ok) { cx.msg = r.reason === 'nobn' ? '布陣功能尚未載入。' : '無法套用。'; return { ok: false, placed: 0, missing: p.missing }; }
  cx.msg = '已套用「' + t.name + '」到布陣:' + r.placed + ' 人上陣' + (p.used.some(function (u) { return u.alt; }) ? '(部分用替代人選)' : '') + (p.missing.length ? ';缺 ' + p.missing.join('、') + ',該位置留空' : '') + '。下次出戰時生效。';
  cxToast(cx.msg);
  return { ok: true, placed: r.placed, missing: p.missing, eids: p.slots.map(function (x) { return x.id; }) };
}
function cxSkillsOfEntry(e, troop) {
  if (typeof bnCardSkillRows !== 'function') return [];
  try { return bnCardSkillRows(e, { troop: troop }); } catch (er) { return []; }
}
function cxIsSupport(rows) {
  return rows.some(function (r) { var d = BN_SKILLS[r.id], ex = ((d.params || {}).extra || []).map(function (x) { return x.kind; }); return /^(heal_|revive|cleanse|shield_)/.test(d.kind) || ex.some(function (k) { return /^(heal_|shield_)/.test(k); }); });
}
// 依你「已擁有、可上陣」的名冊挑最適合的 3 人(主將 + 2 副將;品階不是依據,看實際戰力與搭配):排除外勤 / 委任 / 駐守中的人;
// 候選取戰力前段 + 盾槍兵 + 輔助各幾位,3 人所有組合逐一打分:三人戰力合計 × 陣營加成 × 前排(盾 / 槍兵)× 輔助(治療 / 護盾)× 羈絆。
// 站位:盾 / 槍兵守前鋒(row 0),其餘戰力較高者當主將(row 2),剩下中衛(row 1);沒有盾槍則兵力較高者守前鋒。回 {picks:[{e,troop,row,col,why}], fac, reasons(白話,第 1 句可直接當提示), slots}
function cxRecommend(opts) {
  opts = opts || {};
  var skipN = 0, cap = (typeof opts.cap === 'number') ? opts.cap : ((typeof BN_COST_CFG !== 'undefined') ? BN_COST_CFG.cap : 9999), cs = (typeof cardsGet === 'function') ? cardsGet() : null, list, busyN = 0, picks = [], reasons = [], bondNames = [], cand, tri = null, triV = -1, i, j, k, a, b, c, v, rest, front, fcnt = {}, fac = -1, fm = 0, spdTop;
  var ro = (cs && cs.roster) || [];
  function isFront(x) { return x.troop === '盾' || x.troop === '槍'; }
  function facMult(n) { var f = (typeof BN_BONDS !== 'undefined' && BN_BONDS.fac) ? BN_BONDS.fac[Math.min(5, n)] : null; return f ? 1 + (f.atk || 0) + (f.hp || 0) / 2 : 1; }
  function value(t) {
    var cnt = {}, m = 0, s = 0, mult = 1, p, q;
    t.forEach(function (x) { s += x.pw; var f = x.e.fac; if (f !== 4 && f !== undefined) { cnt[f] = (cnt[f] || 0) + 1; if (cnt[f] > m) m = cnt[f]; } });
    if (m >= 3) mult *= facMult(m);
    if (t.some(isFront)) mult *= 1.1;
    if (t.some(function (x) { return x.sup; })) mult *= 1.08;
    for (p = 0; p < t.length; p++) for (q = p + 1; q < t.length; q++) if (t[p].e.fig && t[q].e.fig && cxBondPair(t[p].e.fig, t[q].e.fig)) mult *= 1.04;
    return s * mult;
  }
  function costOf(x) { return (typeof bnCostOf === 'function') ? bnCostOf(x.e) : 0; }
  function triCost(t) { var c = 0; t.forEach(function (x) { c += costOf(x); }); return c; }
  list = ro.filter(function (e) {
    var ub = (e && typeof cardsUseBlock === 'function') ? cardsUseBlock(e, 'team') : { ok: true };
    if (!ub.ok) { busyN++; return false; }
    if (typeof opts.skip === 'function' && opts.skip(e)) { skipN++; return false; }   // 已在其他隊的武將不可再用
    return true;
  }).map(function (e) {
    var tr = (typeof bnDefaultTroop === 'function') ? bnDefaultTroop(e) : '槍', sp = null, pw = 0, rows;
    try { sp = bnUnitSpec(e, { troop: tr }); pw = bnPower(sp); } catch (er) { sp = null; }
    rows = sp ? cxSkillsOfEntry(e, tr) : [];
    return { e: e, troop: tr, sp: sp, pw: pw, sup: sp ? cxIsSupport(rows) : false };
  }).filter(function (x) { return x.sp; });
  if (!list.length) return { picks: [], fac: -1, reasons: [skipN ? '卡包裡可用的人都已經在其他隊伍,先下陣一些再推薦。' : (busyN ? '卡包裡的人都在外勤、委任或駐守中,先讓他們回來再推薦。' : '卡包還沒有可上陣的人。')], slots: [] };
  list.sort(function (p, q) { return q.pw - p.pw; });
  cand = list.slice(0, 12);
  [isFront, function (x) { return x.sup; }].forEach(function (pred) { list.filter(pred).slice(0, 3).forEach(function (x) { if (cand.indexOf(x) < 0) cand.push(x); }); });
  function sameFig(t) { return t.some(function (x, p) { return x.e.fig && t.some(function (y, q) { return q > p && y.e.fig === x.e.fig; }); }); }   // 同名名人不可同隊
  if (cand.length <= 3 && !sameFig(cand) && triCost(cand) <= cap) tri = cand.slice();
  else for (i = 0; i < cand.length; i++) for (j = i + 1; j < cand.length; j++) for (k = j + 1; k < cand.length; k++) {
    a = [cand[i], cand[j], cand[k]];
    if (sameFig(a) || triCost(a) > cap) continue;   // 同名 / 統御超過一隊上限的組合不考慮
    v = value(a);
    if (v > triV) { triV = v; tri = a; }
  }
  if (!tri) {   // 沒有合法的 3 人組合(人太少或統御都太高):退成 2 人 / 1 人,再不行取統御最低的
    cand.forEach(function (x) { if (!tri && costOf(x) <= cap) tri = [x]; });
    cand.forEach(function (x) { cand.forEach(function (y) { var t = [x, y]; if (x !== y && !sameFig(t) && triCost(t) <= cap && (!tri || tri.length < 2 || value(t) > value(tri))) tri = t; }); });
    if (!tri) tri = [cand.slice().sort(function (p, q) { return costOf(p) - costOf(q); })[0]];
  }
  front = tri.filter(isFront).sort(function (p, q) { return q.pw - p.pw; })[0] || (tri.length > 1 ? tri : []).filter(function (x) { return x.troop === '騎'; }).sort(function (p, q) { return q.sp.stats.hp - p.sp.stats.hp; })[0] || null;
  if (!front && tri.length > 1) front = tri.slice().sort(function (p, q) { return q.sp.stats.hp - p.sp.stats.hp; })[0];
  rest = tri.filter(function (x) { return x !== front; }).sort(function (p, q) { return q.pw - p.pw; });
  (front && tri.length > 1 ? [rest[0], front].concat(rest.slice(1)) : rest).forEach(function (x, idx) {
    var row = tri.length === 1 ? 2 : [2, 0, 1][idx], why;
    if (row === 0) why = isFront(x) ? '放最前面擋傷害(' + x.troop + '兵耐打)' : '放最前面,隊裡數他兵力較高';
    else if (row === 1) why = x.sup ? '會治療或護盾,放中間照顧隊友' : '放中間補輸出';
    else why = x.sup ? '當主將:戰力高,還會治療或護盾' : '當主將:隊裡戰力最高,放後方比較安全';
    picks.push({ e: x.e, troop: x.troop, row: row, col: 0, why: why });
  });
  tri.forEach(function (x) { var f = x.e.fac; if (f !== 4 && f !== undefined) { fcnt[f] = (fcnt[f] || 0) + 1; if (fcnt[f] > fm) { fm = fcnt[f]; fac = +f; } } });
  if (fm >= 3) reasons.push('3 人同為' + cxFacName(fac) + ',有陣營加成(' + cxFacBonusTxt(3) + ')。');
  else if (fm === 2) { reasons.push('其中 2 人同為' + cxFacName(fac) + ',再補 1 位同陣營就有陣營加成;這次以戰力與前後排搭配為主。'); }
  else reasons.push('卡包湊不出同陣營的 3 人,這次以戰力與前後排搭配為主。');
  if (tri.length < 3) reasons.push('卡包目前只有 ' + tri.length + ' 位可上陣,先全放上去;多抽幾位再來推薦會更完整。');
  else {
    spdTop = tri.slice().sort(function (p, q) { return q.sp.stats.spd - p.sp.stats.spd; })[0];
    reasons.push(spdTop.e.name + '速度最快,通常搶先出手。');
  }
  if (tri.length > 1 && !tri.some(isFront)) reasons.push('隊裡沒有盾 / 槍兵,前排會比較脆,建議再招一位。');
  if (!tri.some(function (x) { return x.sup; })) reasons.push('卡包沒有會治療或護盾的人,建議抽一位補上(到「戰法」分頁搜尋「回復」)。');
  if (typeof BN_BONDS !== 'undefined') BN_BONDS.special.forEach(function (bd) { var n = tri.filter(function (x) { return x.e.fig && bd.members.indexOf(x.e.fig) >= 0; }).length; if (n >= bd.need) bondNames.push(bd.name); });
  if (bondNames.length) reasons.push('還觸發羈絆:' + bondNames.join('、') + '。');
  if (busyN) reasons.push('另有 ' + busyN + ' 位在外勤、委任或駐守中,沒有列入。');
  if (skipN) reasons.push('另有 ' + skipN + ' 位已在其他隊伍,沒有列入。');
  var res = { picks: picks, fac: fm >= 2 ? fac : -1, reasons: reasons, slots: picks.map(function (p) { return { id: p.e.id, row: p.row, col: p.col, troop: p.troop }; }) };
  if (opts.withSkills === true && typeof skrTeamPlan === 'function') res.skills = skrTeamPlan(cs, picks.map(function (p) { return p.e; }), opts.skrOpt);   // 可選:附推薦戰法分配(js/skill_rec.js);不帶參數時回傳與原本完全相同
  return res;
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
  h += '<div class="cx-l"><b class="cx-k">站位</b>一隊 3 人:主將守後方,副將一在中衛、副將二在前鋒,前鋒最先被打,適合兵力高、防禦好的盾 / 槍兵;弓、謀打得遠但不耐打,放中衛或主將。弓兵站後方時受到近戰普攻傷害 −' + cxPct(1 - D.archerBackTaken) + '。</div>';
  h += '<div class="cx-l"><b class="cx-k">兵種相剋</b>' + prey.join(';') + '。' + (preyRows ? '<br>' + preyRows + '<br>' : '') + '騎兵每場第一次普攻 ×' + D.cavCharge + ';謀士主動戰法發動率 +' + cxPct(D.mageRateBonus) + '。</div>';
  h += '<div class="cx-l"><b class="cx-k">治療與禁療</b>單次治療最多回復兵力上限的 ' + cxPct(D.healCap.single) + ';敵人的「禁療」會讓治療變少。第 ' + D.fatigue.start + ' 回合起雙方疲兵:每回合受到傷害 +' + cxPct(D.fatigue.dmg) + '、受到治療 −' + cxPct(D.fatigue.heal) + ',所以隊伍至少帶 1 位治療或護盾。</div>';
  h += '<div class="cx-l"><b class="cx-k">陣營加成</b>同一陣營上陣 ' + fac.join(';') + '(取人數最多的陣營;中立不計,加成上限 攻擊 ' + cxPct((B.cap || D.bondCap).atk) + '、兵力 ' + cxPct((B.cap || D.bondCap).hp) + ')。</div>';
  h += '<div class="cx-l"><b class="cx-k">職業羈絆</b>主職業同標籤 2 人生效:' + tag.join('、') + '(例如 2 位醫者 → 治療 +' + cxPct((B.tag['醫者'] || {}).heal || 0) + ')。</div>';
  sp = B.special.filter(function (b) { return b.members.every(function (m) { return !!cxIndex().byId[m]; }); });   // 只列目前世界的人
  if (sp.length) h += '<div class="cx-l"><b class="cx-k">名人組合</b>' + sp.map(function (b) { return b.name + '(' + b.members.map(function (m) { return (CARD_FIG_BY_ID[m] || {}).name || m; }).join('、') + ',' + b.need + ' 人)'; }).join(';') + '。另外很多名人有自己的羈絆,在「武將」頁的「羈絆」欄可看到夥伴。</div>';
  if (typeof BN_COMBOS !== 'undefined' && BN_COMBOS.reactions) h += '<details class="cx-rx"><summary>組合技(' + BN_COMBOS.reactions.length + ' 種,先上狀態再打會觸發)</summary>' + BN_COMBOS.reactions.map(function (x) { return '<div class="cx-l">' + cxEsc(cxRxTxt(x)) + '</div>'; }).join('') + '</details>';
  return h + '</details>';
}
// ───────── 戰法(R6):每格的戰法名 + 取得狀態;套用戰法 ─────────
function cxSkName(id) { return (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]) ? BN_SKILLS[id].name : String(id); }
function cxSkOwned(id) { try { return typeof bnSkcOwned === 'function' && bnSkcOwned(id); } catch (e) { return false; } }
// 未解鎖戰法的取得提示:「拆〇〇」/「兵書」
function cxSkSrcTag(id) {
  var src, cs = (typeof cardsGet === 'function') ? cardsGet() : null;
  if (typeof skrSource !== 'function') return '未解鎖';
  src = skrSource(cs, id);
  if (src.fig) return '拆' + (typeof skrFigName === 'function' ? skrFigName(src.fig) : src.fig);
  return src.k === 'book' ? '兵書' : src.k === 'inhRoster' ? '拆紫路人' : '暫時無法取得';
}
function cxSkLine(ids) {   // 一格的戰法列:已解鎖亮、未解鎖灰並標「拆〇〇」;點戰法名開戰法詳情
  var ok;
  if (!ids || !ids.length) return '';
  ok = ids.filter(function (id) { return typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]; });
  if (!ok.length) return '';
  return '<small class="cx-sks">戰法:' + ok.map(function (id) {
    var own = cxSkOwned(id);
    return '<a class="cx-sk ' + (own ? 'on' : 'off') + '" role="button" data-cx="sk" data-k="' + cxEsc(id) + '">' + cxEsc(cxSkName(id)) + (own ? '' : '(' + cxEsc(cxSkSrcTag(id)) + ')') + '</a>';
  }).join('、') + '</small>';
}
function cxRecSkIds(r, eid) {   // 依我的卡包推薦:某人的推薦戰法(已分配到的 + 還缺的)
  var per, out = [];
  if (!r || !r.skills || !Array.isArray(r.skills.per)) return out;
  per = r.skills.per.filter(function (x) { return x.eid === eid; })[0];
  if (!per) return out;
  per.sel.forEach(function (id) { if (id && out.indexOf(id) < 0) out.push(id); });
  per.miss.forEach(function (m) { if (out.indexOf(m.id) < 0) out.push(m.id); });
  return out;
}
// 套用後的「也套用戰法?」:用這幾位名冊武將重算分配(看你現有解鎖與裝備),有東西可裝或有缺的才問
function cxSkPlan(eids) {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, es;
  if (typeof skrTeamPlan !== 'function' || !cs || !eids || !eids.length) return null;
  es = eids.map(function (id) { var f = (typeof cardsFind === 'function') ? cardsFind(cs, id) : null; return f ? f.e : null; }).filter(function (e) { return !!e; });
  return es.length ? skrTeamPlan(cs, es) : null;
}
function cxSkAskSet(eids) {
  var p = cxSkPlan(eids);
  cx.skAsk = (p && p.ok && p.per.some(function (x) { return x.changes.length || x.miss.length; })) ? { eids: eids } : null;
}
function cxSkAskHtml() {
  var p, can;
  if (!cx.skAsk) return '';
  p = cxSkPlan(cx.skAsk.eids);
  if (!p || !p.ok) return '';
  can = p.per.some(function (x) { return x.changes.length; });
  return '<div class="cx-team cx-ask"><div class="cx-th"><b>也套用戰法?</b></div><div class="cx-l">' + cxEsc(p.summary) + '</div><div class="cx-slots">' + p.per.map(function (x) {
    return '<div class="cx-slot"><b>' + cxEsc(x.name) + '</b>' + cxSkLine(x.sel.filter(function (i) { return !!i; }).concat(x.miss.map(function (m) { return m.id; }))) + '</div>';
  }).join('') + '</div><div class="cx-l">' + (can ? '<button type="button" data-cx="skyes">套用戰法</button> ' : '') + '<button type="button" data-cx="skno">' + (can ? '先不用' : '收起') + '</button></div></div>';
}
function cxSkApply() {
  var p = cx.skAsk ? cxSkPlan(cx.skAsk.eids) : null, cs = (typeof cardsGet === 'function') ? cardsGet() : null, r;
  if (!p || !p.ok || typeof skrApply !== 'function') { cx.msg = '戰法推薦功能尚未載入。'; cx.skAsk = null; return false; }
  r = skrApply(cs, p);
  if (!r.ok) { cx.msg = '無法套用戰法:' + (r.reason === 'busy' ? '對方在隊伍或外勤中' : '請稍後再試') + '。'; return false; }
  if (typeof ldHeroSync === 'function') ldHeroSync(); else if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
  cx.msg = (r.text || '戰法已套用') + (p.miss.length ? ';缺 ' + p.miss.map(function (m) { return '『' + cxSkName(m.id) + '』(' + ((m.src && m.src.text) || '目前無法取得') + ')'; }).join('、') : '') + '。';
  cx.skAsk = null; cxToast(cx.msg);
  return true;
}
function cxTeamHtml(t) {
  var o = cxTeamOwn(t), h;
  h = '<div class="cx-team"><div class="cx-th"><b>' + cxEsc(t.name) + '</b><span class="cx-own' + (o.roster >= o.n ? ' on' : '') + '">我已擁有 ' + o.own + '/' + o.n + '</span></div>';
  h += '<div class="cx-l cx-dim">' + cxEsc(t.role) + '</div><div class="cx-slots">';
  t.slots.slice().sort(function (a, b) { return b.row - a.row; }).forEach(function (s) {
    h += '<div class="cx-slot"><small>' + CX_POS[s.row] + '・' + cxEsc(s.troop) + '</small>' + cxFigLink(s.fig) + cxSkLine(s.skc) + (s.alt && s.alt.length ? '<small>替代:' + s.alt.map(cxFigLink).join('、') + '</small>' : '') + '</div>';
  });
  h += '</div><div class="cx-l">' + cxEsc(t.why) + '</div>';
  if (t.bonds && t.bonds.length) h += '<div class="cx-l"><b class="cx-k">羈絆</b>' + cxEsc(t.bonds.join('、')) + '</div>';
  h += '<div class="cx-l">' + (o.roster < o.n ? '<small>卡包可上陣 ' + o.roster + ' 人' + (o.alt ? '、另 ' + o.alt + ' 格可用替代人選' : '') + (o.own > o.roster ? ';有人在待定席或流浪中,卡包有空位時才能上陣' : '') + '</small>' : '') +
    '<button type="button" data-cx="apply" data-k="' + cxEsc(t.id) + '"' + (o.roster + o.alt ? '' : ' disabled') + '>一鍵套用到布陣</button></div>';
  return h + '</div>';
}
function cxRecHtml() {
  var r = cx.rec, h;
  if (!r) return '';
  h = '<div class="cx-team cx-rec"><div class="cx-th"><b>依我的卡包推薦</b></div><div class="cx-l cx-dim">只從你已擁有、現在能上陣的武將挑 3 人,看實際戰力與搭配,不看品階顏色。</div>';
  if (!r.picks.length) return h + '<div class="cx-l">' + cxEsc(r.reasons.join('')) + '</div></div>';
  h += '<div class="cx-slots">' + r.picks.map(function (p) { return '<div class="cx-slot"><small>' + CX_POS[p.row] + '・' + cxEsc(p.troop) + '</small><b>' + cxEsc(p.e.name) + '</b><small>' + cxEsc(p.why) + '</small>' + cxSkLine(cxRecSkIds(r, p.e.id)) + '</div>'; }).join('') + '</div>';
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
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '配隊建議');
  head = document.createElement('div'); head.className = 'cx-head';
  head.innerHTML = '<b>配隊建議</b><small class="cx-world"></small><button type="button" class="cx-x" data-cx="close" aria-label="關閉配隊建議">✕</button>';
  tabs = document.createElement('div'); tabs.className = 'cx-tabs';
  cx.tool = document.createElement('div'); cx.tool.className = 'cx-tool';
  cx.list = document.createElement('div'); cx.list.className = 'cx-list';
  el.appendChild(head); el.appendChild(tabs); el.appendChild(cx.tool); el.appendChild(cx.list);
  el.addEventListener('click', cxOnClick);
  el.addEventListener('change', cxOnChange);
  el.addEventListener('keydown', cxOnRowKey);
  document.body.appendChild(el);
  cx.el = el; cx.tabsEl = tabs;
  cx.title = head.querySelector ? head.querySelector('.cx-world') : null;
  if (typeof panelRegister === 'function') panelRegister('codex', { kind: 'big', el: el, close: cxHide });
  return el;
}
function cxHide() {
  cx.open = false;
  if (cx.timer && typeof clearTimeout === 'function') clearTimeout(cx.timer);
  cx.timer = 0;
  if (cx.el) cx.el.hidden = true;
}
// opt: {tab, fig, skill}
// opt: {tab, fig, skill}。fig / skill 開卡包『大全』詳情(cardsui_codex.js);其餘開配隊頁
function codexOpen(opt) {
  var el;
  opt = opt || {};
  if ((opt.fig || opt.skill) && typeof cuCodexOpenKey === 'function' && cuCodexOpenKey(opt.fig ? 'f:' + opt.fig : 's:' + opt.skill)) return true;
  el = cxEnsure();
  if (!el) return false;
  if (typeof panelOpen === 'function') panelOpen('codex');
  cx.open = true; el.hidden = false; cx.msg = ''; cx.tab = 'team'; cx.stack = [];
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
function cxToolHtml() {
  return '<div class="cx-fs">' + cxSel('tfac', cx.tfac, [['-1', '全部陣營']].concat(cxTeamFacs().map(function (f) { return [String(f), cxTeamFacName(f)]; }))) +
    '<button type="button" data-cx="rec">依我的卡包推薦</button></div>';
}
function cxTeamFacs() { var s = {}, out = []; cxTeams().forEach(function (t) { var k = cxWorld() === 'han' ? t.fac : t.world; if (!s[k]) { s[k] = 1; out.push(k); } }); return out; }
function cxTeamFacName(f) { return cxWorld() === 'han' ? cxFacName(+f) : (CX_RACE[f] || f); }
function cxListHtml() {
  var h = '', list;
  if (cx.msg) h += '<div class="cx-msg">' + cxEsc(cx.msg) + '</div>';
  h += cxSkAskHtml() + cxRecHtml() + cxRulesHtml();
  list = cxTeams().filter(function (t) { return +cx.tfac < 0 || String(cxWorld() === 'han' ? t.fac : t.world) === String(cx.tfac); });
  h += '<div class="cx-sec">各陣營配隊建議(' + list.length + ' 組)</div>';
  if (!list.length) h += '<div class="cx-hint">這個世界還沒有配隊建議。</div>';
  list.forEach(function (t) { h += cxTeamHtml(t); });
  h += '<div class="cx-hint">武將與戰法的完整介紹(人物、戰法、兵種卡、隊伍)在卡片「大全」分頁。</div>';
  return h;
}
function cxRender(tool) {
  if (!cx.el) return;
  if (cx.title) cx.title.textContent = cxWorldTxt();
  if (cx.tabsEl) cx.tabsEl.innerHTML = CX_TABS.map(function (t) { return '<button type="button" class="cx-tab' + (cx.tab === t[0] ? ' on' : '') + '" data-cx="tab" data-k="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  if (tool) cx.tool.innerHTML = cxT(cxToolHtml());
  cx.tool.hidden = false;
  cxPaint();
}
// 魔幻世界用語替換(fx_text.js fxText;歷史世界原樣)
function cxT(s) { return (typeof fxText === 'function') ? fxText(s) : s; }
function cxPaint() { if (cx.list) cx.list.innerHTML = cxT(cxListHtml()); }
function cxOnClick(e) {
  var t = e.target && e.target.closest ? e.target.closest('[data-cx]') : null, a, k, team, r;
  if (!t || t.disabled) return;
  a = t.getAttribute('data-cx'); k = t.getAttribute('data-k') || '';
  if (a === 'close') codexClose();
  else if (a === 'tab') { cx.tab = k; cx.msg = ''; cxRender(true); }
  else if (a === 'fig') codexOpenKey('f:' + k);
  else if (a === 'skd') codexOpenKey('s:' + k);
  else if (a === 'roster') codexGoRoster(k);
  else if (a === 'rec') { cx.rec = cxRecommend({ withSkills: true }); cx.msg = ''; cx.skAsk = null; cxRender(false); }
  else if (a === 'applyrec') { if (cx.rec && cx.rec.slots.length) { r = cxApplySlots(cx.rec.slots); cx.msg = r.ok ? '已套用推薦陣容到布陣(' + r.placed + ' 人),下次出戰時生效。' : '無法套用。'; cxToast(cx.msg); if (r.ok) cxSkAskSet(cx.rec.slots.map(function (x) { return x.id; })); } cxRender(false); }
  else if (a === 'apply') { team = cxTeams().filter(function (x) { return x.id === k; })[0]; r = team ? cxApplyTeam(team) : null; cx.skAsk = null; if (r && r.ok) cxSkAskSet(r.eids); cxRender(false); }
  else if (a === 'skyes') { cxSkApply(); cxRender(false); }
  else if (a === 'skno') { cx.skAsk = null; cxRender(false); }
  else if (a === 'sk') { if (typeof ldNavPush === 'function') ldNavPush('skill', { id: k }); else codexOpenKey('s:' + k); }
}
function cxOnRowKey(e) {
  var t = e.target;
  if (!t || (e.key !== 'Enter' && e.key !== ' ') || !t.getAttribute || t.getAttribute('role') !== 'button' || !t.getAttribute('data-cx') || t.tagName === 'BUTTON') return;
  if (e.preventDefault) e.preventDefault();
  cxOnClick({ target: t });
}
function cxOnChange(e) {
  var t = e.target, f = t && t.getAttribute ? t.getAttribute('data-cxf') : null;
  if (!f) return;
  cx[f] = t.value; cx.page = 0;
  cxPaint();
}
// 設定篩選 / 關鍵字並重畫(測試與外部用)
function cxSet(o) { Object.keys(o || {}).forEach(function (k) { cx[k] = o[k]; }); cx.page = 0; if (cx.list) cxPaint(); }
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
  return cxT('<div class="cx-rvh">本批戰法(完整說明:卡片 →「大全」)</div>' + (list || []).map(function (c) {
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
