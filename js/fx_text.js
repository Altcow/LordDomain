// js/fx_text.js — 魔幻世界的「文字與事件」覆寫(PLAN_FANTASY_B B-4):路人姓名、職業四階名 / 職司 / 標籤、招募場所與考科、官階、詞條說明、
// 路人台詞、NPC 招呼、天災名、守城警語、遊歷英雄文案、討伐 6 章文字、名人卡「異界來客 / 遠客」標示。資料在 fx_text_data.js(texts_map.json 產生)與 fx_stages_data.js。
// 隔離作法:在既有資料表的欄位掛 getter(fxPack() 為 null 時回原值),或包住「回傳字串」的面板函式(歷史世界原樣回傳),所以歷史世界輸出逐位不變;
// 只有少數組字串的地方加一行 typeof 守衛的呼叫(cards.js cardGenName、npcvisit.js 路過文案)。
// 載入順序:所有資料與面板檔之後(index.html 放在 minimap.js 後、main.js 前)。ES2017;不用 ?. ??。不發聲。
// 全域:FX_TXT fxTxPack fxText fxTextInstall fxGenName fxVisitText fxFigMark fxJobRow fxVenue fxRankName fxSilHtml fxTxBossSlot
var FX_TXT = { inst: false, terms: {}, cache: {}, wrapped: {} };

function fxTxPack() { try { return (typeof fxPack === 'function') ? fxPack() : null; } catch (e) { return null; } }
function fxTxD(key) { return (typeof FX_TEXT_DATA !== 'undefined' && FX_TEXT_DATA[key]) || null; }
function fxTxC(p, key, mk) { var c = FX_TXT.cache[p] || (FX_TXT.cache[p] = {}); if (!(key in c)) c[key] = mk(); return c[key]; }

// ───────── 查詢 ─────────
function fxJobRow(id, p) { var J = fxTxD('jobs'); if (!J) return null; p = p || fxTxPack(); return (p && J[p] && J[p][id]) || (J.common && J.common[id]) || null; }
function fxVenue(v, p) {
  var V = fxTxD('venues'), c, o = {}, k;
  if (!V) return null;
  p = p || fxTxPack();
  c = (V.common && V.common[v]) || {};
  for (k in c) o[k] = c[k];
  if (p && V[p] && V[p][v]) for (k in V[p][v]) o[k] = V[p][v][k];
  return o;
}
function fxRankName(i, p) { var R = fxTxD('ranks'); p = p || fxTxPack(); return (p && R && R[p] && R[p][i]) || null; }
function fxObjNow(type) { var t = (typeof fxGoType === 'function') ? fxGoType(type) : type; return (typeof OBJECTS !== 'undefined' && OBJECTS[t]) ? OBJECTS[t].name : null; }
// 殿試台建築名(B-1 未改名的漢式名)
var FX_OBJ_TXT = { dian_shi_tai: { elf: '世界樹召集台', dwarf: '山王召見廳', kingdom: '御前召見台' }, kao_chang: { elf: '試煉場', dwarf: '試煉場', kingdom: '試煉場' },
  lou_che_fang: { elf: '播種機關坊', dwarf: '播種機關坊', kingdom: '播種機關坊' }, fan_che: { elf: '翻水轉輪', dwarf: '翻水轉輪', kingdom: '翻水轉輪' } };
// 建造預覽的防災軸名(天災名取自 texts_map events.hazards)
var FX_HAZ_LABEL = { common: { locust: '防蟲群' }, elf: { fire: '防林火', locust: '防枯葉蟲' }, dwarf: { fire: '防爐火', flood: '防湧水' }, kingdom: {} };

// ───────── 用語替換表(依族,首次使用時建立;長詞在前)─────────
function fxTerms(p) {
  var R, P, E, G, T, gw, list, xs;
  if (FX_TXT.terms[p]) return FX_TXT.terms[p];
  R = (fxTxD('ranks') || {})[p] || []; P = fxTxD('posts') || {}; gw = fxTxD('guardWarn') || {};
  E = fxVenue('E', p) || {}; G = fxVenue('G', p) || {}; T = fxVenue('T', p) || {};
  xs = (typeof fxTechName === 'function') ? fxTechName('ed_xuexiao') : null;
  list = [
    ['近來黃巾餘黨出沒,務必小心。', gw[p] || gw.common], ['九品中正考課', E.alias], ['天子親策', G.alias], ['招賢酒肆', T.alias],
    ['縣試品評', E.name ? E.name + '品評' : null], ['舊殿試', G.name ? '舊' + G.name : null], ['殿試台', (FX_OBJ_TXT.dian_shi_tai || {})[p]],
    ['縣試', E.name], ['殿試', G.name], ['徵辟', G.orgName],
    ['黃巾餘黨', '林道盜匪'], ['黃巾', '盜匪'], ['太平道', '邪教'],
    ['郡國學校', xs], ['縣衙大堂', fxObjNow('xian_ya')], ['縣衙', fxObjNow('xian_ya')], ['郡府', fxObjNow('palace')], ['翻車', fxObjNow('fan_che')],
    ['里正', R[0]], ['亭長', R[1]], ['縣尉', R[2]], ['縣令', R[3]], ['刺史', R[5]], ['太守', P['太守']],
    ['五銖錢', '銅幣'], ['五銖', '銅幣'], ['胡餅', '麵餅'], ['糖餳', '蜜糖'],
    ['名垂青史', '傳說留名'], ['州郡英才', '一方英才'], ['史實依據', '傳說'], ['史實設定', '傳說設定'], ['東漢', '這片土地']
  ].filter(function (x) { return x[1] && x[1] !== x[0]; });
  list = (fxTxD('terms') || []).concat(list);   // 通用詞改名(gen_fx_text.js TERMS)排前面
  FX_TXT.terms[p] = list;
  return list;
}
var FX_TERM_KEYS = ['黃巾', '九品中正', '天子', '招賢酒肆', '縣試', '殿試', '徵辟', '太平道', '郡國學校', '縣衙', '郡府', '翻車', '縣學', '郡學', '太學', '庠舍',
  '里正', '亭長', '縣尉', '縣令', '刺史', '太守', '五銖', '胡餅', '糖餳', '名垂青史', '州郡英才', '史實', '東漢',
  '兵書', '軍令', '流寇', '傳檄', '連夜趕工', '耬車', '翻水車', '考場'];
function fxTermHit(s) { var i; if (typeof s !== 'string') return false; for (i = 0; i < FX_TERM_KEYS.length; i++) if (s.indexOf(FX_TERM_KEYS[i]) >= 0) return true; return false; }
// 魔幻世界:把字串裡的漢式用語換成本族說法;歷史世界原樣回傳
function fxText(s, p) {
  var L, i;
  p = p || fxTxPack();
  if (!p || typeof s !== 'string' || !s) return s;
  L = fxTerms(p);
  for (i = 0; i < L.length; i++) if (s.indexOf(L[i][0]) >= 0) s = s.split(L[i][0]).join(L[i][1]);
  return s;
}

// ───────── getter 掛點 ─────────
// 在 obj[key] 掛 getter:歷史世界回原值;魔幻世界回 fn(原值, 族),fn 回 null / undefined 時用原值。已有 getter(B-3 的討伐關卡文字)時以它為原值
function fxTxDef(obj, key, fn) {
  var d, base, g;
  if (!obj) return false;
  d = Object.getOwnPropertyDescriptor(obj, key);
  if (!d || d.configurable === false) return false;
  if (d.get && d.get.fxTxt) return false;
  base = d.value;
  g = function () { var b = d.get ? d.get.call(obj) : base, p = fxTxPack(), v; if (!p) return b; v = fn(b, p); return (v === null || v === undefined) ? b : v; };
  g.fxTxt = 1;
  try {
    Object.defineProperty(obj, key, { enumerable: d.enumerable !== false, configurable: true, get: g, set: d.get ? d.set : function (v) { base = v; } });
  } catch (e) { return false; }
  return true;
}
function fxTxDefText(obj, key) { if (obj && fxTermHit(obj[key])) fxTxDef(obj, key, function (b, p) { return fxText(b, p); }); }
function fxTxDefArr(arr) { var i; if (!arr || !arr.length) return; for (i = 0; i < arr.length; i++) fxTxDefText(arr, i); }

// 職司字串:'太守、戶曹(輔)' → 逐詞換
function fxPostText(s, p) {
  var P = fxTxD('posts') || {}, ks = Object.keys(P).sort(function (a, b) { return b.length - a.length; }), i, out = s, tok = [];
  if (typeof s !== 'string') return s;
  for (i = 0; i < ks.length; i++) if (out.indexOf(ks[i]) >= 0) { out = out.split(ks[i]).join('\u0001' + tok.length + '\u0002'); tok.push(P[ks[i]]); }
  return out.replace(/\u0001(\d+)\u0002/g, function (m, n) { return tok[+n]; });
}
// 宗師舞台:依 NPC_STAGE 的建築清單,以本族看得到的建築名重組(例:「長老議環」);無資料回 null
function fxStageText(jobId, p) {
  var S = (typeof NPC_STAGE !== 'undefined') ? NPC_STAGE[jobId] : null, parts = [];
  if (!S || !S.length) return null;
  S.forEach(function (g) {
    var nm = [];
    g[0].forEach(function (t) { var n = fxObjNow(t); if (n && nm.indexOf(n) < 0) nm.push(n); });
    if (nm.length) parts.push(nm.join('或') + (g[1] > 1 ? ' ≥ ' + g[1] : ''));
  });
  return parts.length ? parts.join(' + ') : null;
}
// 路人姓名(魔幻世界依族取字;歷史世界回 null,呼叫端不消耗亂數)
function fxGenName(r, sex) {
  var p = fxTxPack(), N = fxTxD('names'), n, P;
  if (!p || !N || !N[p]) return null;
  n = N[p]; P = (sex === 'f' && n.f.length) ? n.f : n.m;
  return n.sur[Math.floor(r() * n.sur.length)] + P[Math.floor(r() * P.length)];
}
// 居民小卡姓名(LIFE_NAMES 20 個,確定性組字)
function fxResidentNames(p) {
  return fxTxC(p, 'res', function () {
    var n = (fxTxD('names') || {})[p], out = [], i, P;
    if (!n) return null;
    for (i = 0; i < 20; i++) { P = (i % 3 === 2 && n.f.length) ? n.f : n.m; out.push(n.sur[(i * 7) % n.sur.length] + P[(i * 5) % P.length]); }
    return out;
  });
}
// 遊歷英雄進城文案(npcvisit.js 卡片):依英雄的族;他族加「遠客」。esc = 呼叫端的 HTML 跳脫函式。歷史世界回 null
function fxVisitText(e, esc) {
  var p = fxTxPack(), V = fxTxD('visit'), f, race, t;
  if (!p || !V || !e) return null;
  fxVisitTypeInstall();
  f = (typeof FX_FIG_BY_ID !== 'undefined') ? FX_FIG_BY_ID[e.fig] : null;
  race = (f && f.race) || p;
  t = (V[race] && V[race].arrive) || V.common.arrive;
  t = t.replace('{name}', e.name || '');
  if (race !== p) t = '遠客 · ' + t;
  return esc ? esc(t) : t;
}
function fxVisitTypeInstall() {
  var V = fxTxD('visit');
  if (typeof LIFE_TYPES !== 'undefined' && LIFE_TYPES.visitor && V) fxTxDef(LIFE_TYPES.visitor, 'name', function () { return V.common.label; });
}
// 名人卡標示:魔幻世界裡的東漢名人(舊存檔)= 「異界來客」;他族傳說英雄 = 「遠客」;其餘空字串
function fxFigMark(c) {
  var p = fxTxPack(), f;
  if (!p || !c || !c.fig) return '';
  f = (typeof FX_FIG_BY_ID !== 'undefined') ? FX_FIG_BY_ID[c.fig] : null;
  if (!f) return ' · 異界來客';
  return f.race !== p ? ' · 遠客' : '';
}

// ───────── 討伐 6 章(fx_stages_data.js)─────────
function fxStgBossName(st) {   // 該關第一位(對照後的)魔幻頭目名字;有非英雄頭目(fxBoss)先用它
  var ch = (typeof BN_CHAPTERS !== 'undefined') ? BN_CHAPTERS[st.ch - 1] : null, k, e, m, f;
  if (!ch || typeof BN_STG_FX_FIG === 'undefined') return '';
  for (k = 0; k < st.foeIdx.length; k++) { e = ch.roster[st.foeIdx[k]]; if (e && e.fxBoss) return e.fxBoss.name; }
  for (k = 0; k < st.foeIdx.length; k++) {
    e = ch.roster[st.foeIdx[k]]; m = e && e.fig ? BN_STG_FX_FIG[e.fig] : null;
    f = m && typeof CARD_FIG_BY_ID !== 'undefined' ? CARD_FIG_BY_ID[m[0]] : null;
    if (f) return f.name;
  }
  return '';
}
// 名人敵將格換成非英雄頭目名(PLAN_FANTASY_B §4.7):只換名字與稱號,戰力 / 戰法 / 兵種沿用該格的英雄(fig);非魔幻世界回 null(不讀)
function fxTxBossSlot(ent, r) {
  try {
    Object.defineProperty(ent, 'fxBoss', { configurable: true, enumerable: false, get: function () { return fxTxPack() ? { name: r[0], title: r[1] } : null; } });
  } catch (e) { /* 略過 */ }
}
function fxStagesInstall() {
  var D = (typeof FX_STG_DATA !== 'undefined') ? FX_STG_DATA : null;
  if (!D || typeof BN_CHAPTERS === 'undefined' || typeof BN_STAGES === 'undefined') return false;
  BN_CHAPTERS.forEach(function (ch, c) {
    var X = D.ch[c];
    if (!X) return;
    fxTxDef(ch, 'name', function () { return X.name; });
    fxTxDef(ch, 'sub', function () { return X.sub; });
    ch.roster.forEach(function (ent, k) {
      var r = X.roster[k];
      if (r && ent && !Array.isArray(ent) && ent.fig) fxTxBossSlot(ent, r);
      if (!r || !Array.isArray(ent)) return;
      fxTxDef(ent, 1, function () { return r[0]; });
      fxTxDef(ent, 2, function () { return r[1]; });
    });
  });
  BN_STAGES.forEach(function (st) {
    var X = D.ch[st.ch - 1], s = X && X.stages[st.idx - 1];
    if (!s) return;
    fxTxDef(st, 'name', function () { return s[0].replace('{boss}', fxStgBossName(st)); });
    fxTxDef(st, 'desc', function () { return s[1].replace('{boss}', fxStgBossName(st)); });
  });
  if (typeof BN_STG_ARCH !== 'undefined' && D.looks) Object.keys(BN_STG_ARCH).forEach(function (k) {
    var a = BN_STG_ARCH[k];
    if (a && D.looks[a.look]) { var to = D.looks[a.look]; fxTxDef(a, 'look', function () { return to; }); }
  });
  if (typeof BN_STG_FIG_LOOK !== 'undefined' && D.looks) Object.keys(BN_STG_FIG_LOOK).forEach(function (k) {   // 名人頭目的外觀
    var to = D.looks[BN_STG_FIG_LOOK[k]];
    if (to) fxTxDef(BN_STG_FIG_LOOK, k, function () { return to; });
  });
  return true;
}

// ───────── 路人剪影(PLAN Q12 第一版):魔幻世界的路人卡(非名人、無 fig)不用漢服頭像,改畫依族 / 性別的剪影,顏色取陣營色 ─────────
// 回 svg 字串;非魔幻世界、名人卡回 null(呼叫端 cardsui.js cuSilPortrait 退回原頭像)
function fxSilHtml(c) {
  var p = fxTxPack(), race, col = '', extra = '', i, F;
  if (!p || !c || c.fig) return null;
  race = (typeof FX_FAC_RACE !== 'undefined' && FX_FAC_RACE[c.fac]) || p;
  F = (typeof FX_FAC_LIST !== 'undefined') ? FX_FAC_LIST : [];
  for (i = 0; i < F.length; i++) if (F[i].fac === c.fac) col = F[i].col;
  if (c.sex === 'f') extra += '<path d="M12 13c0-8 16-8 16 0v7c0 2-1 3-2 3H14c-1 0-2-1-2-3z"/>';   // 長髮
  if (race === 'elf') extra += '<path d="M12.5 13L6 9.5 12.5 16zM27.5 13L34 9.5 27.5 16z"/>';       // 尖耳
  if (race === 'dwarf' && c.sex !== 'f') extra += '<path d="M14 20q6 16 12 0z"/>';                 // 鬍鬚
  return '<svg class="cusil fxsil" viewBox="0 0 40 40" aria-hidden="true"' + (col ? ' style="fill:' + col + '"' : '') + '><circle cx="20" cy="14" r="7.5"/><path d="M5 40c0-9 6-14.5 15-14.5S35 31 35 40z"/>' + extra + '</svg>';
}

// ───────── 安裝(載入時一次)─────────
function fxTextInstall() {
  var J = fxTxD('jobs'), L = fxTxD('life'), H = fxTxD('hazards'), N = fxTxD('npc'), EX = fxTxD('exam'), TG = fxTxD('tags');
  if (FX_TXT.inst || !J) return false;
  FX_TXT.inst = true;
  if (typeof CARD_JOBS !== 'undefined') CARD_JOBS.forEach(function (j) {
    var id = j.id;
    fxTxDef(j, 'name', function (b, p) { var r = fxJobRow(id, p); return r ? r[0] : null; });
    fxTxDef(j, 't', function (b, p) { return fxTxC(p, 'jt:' + id, function () { var r = fxJobRow(id, p); return r ? r.slice(1, 5) : null; }); });
    fxTxDef(j, 'post', function (b, p) { return fxPostText(b, p); });
    fxTxDef(j, 'tag', function (b) { return TG && TG[b]; });
    fxTxDef(j, 'eff', function (b, p) { return fxText(b, p); });
    fxTxDef(j, 'stage', function (b, p) { return fxStageText(id, p) || fxText(b, p); });
  });
  if (typeof CARD_VENUES !== 'undefined') Object.keys(CARD_VENUES).forEach(function (v) {
    ['name', 'alias', 'orgName'].forEach(function (k) { fxTxDef(CARD_VENUES[v], k, function (b, p) { var o = fxVenue(v, p); return o && o[k]; }); });
  });
  if (typeof CU_TAB_NAME !== 'undefined') fxTxDef(CU_TAB_NAME, 'E', function (b, p) { var o = fxVenue('E', p); return o && o.name; });
  if (typeof CARD_EXAM_SUBJECTS !== 'undefined' && EX) CARD_EXAM_SUBJECTS.forEach(function (s) { fxTxDef(s, 'name', function () { return EX[s.id]; }); });
  if (typeof LH_RANKS !== 'undefined') LH_RANKS.forEach(function (r, i) { fxTxDef(r, 'n', function (b, p) { return fxRankName(i, p); }); });
  if (typeof NPC_POSTS !== 'undefined') NPC_POSTS.forEach(function (o) { fxTxDef(o, 'name', function (b, p) { return fxPostText(b, p); }); fxTxDefText(o, 'eff'); });
  if (typeof CARD_TRAITS !== 'undefined') CARD_TRAITS.forEach(function (t) { fxTxDefText(t, 'd'); });
  if (typeof BNT_CITY !== 'undefined') Object.keys(BNT_CITY).forEach(function (k) { fxTxDefText(BNT_CITY, k); });
  if (typeof CARD_GRADE !== 'undefined') CARD_GRADE.forEach(function (g) { fxTxDefText(g, 'line'); });
  // 魔幻英雄專屬詞條說明(魔幻專用資料,直接改字):太守職 → 城主府總管職
  // 魔幻科技說明裡殘留的「(殿試)」(fx_tech_data.js,魔幻專用資料):換成本族召見場所名
  if (typeof FX_TECH_DATA !== 'undefined' && FX_TECH_DATA.nodes) Object.keys(FX_TECH_DATA.nodes).forEach(function (p) {
    var S = FX_TECH_DATA.nodes[p], G = fxVenue('G', p);
    if (S && G && G.name) Object.keys(S).forEach(function (id) { if (S[id] && typeof S[id][1] === 'string' && S[id][1].indexOf('殿試') >= 0) S[id][1] = S[id][1].split('殿試').join(G.name); });
  });
  if (typeof FX_FIGS !== 'undefined') FX_FIGS.forEach(function (f) { (f.tr || []).forEach(function (t) { if (typeof t[2] === 'string') t[2] = t[2].split('太守').join(((fxTxD('posts') || {})['太守']) || '總管'); }); });
  // 路人台詞 / 居民姓名 / 招呼
  if (typeof LIFE_LINES !== 'undefined') Object.keys(LIFE_LINES).forEach(function (k) {
    fxTxDef(LIFE_LINES, k, function (b, p) { return fxTxC(p, 'life:' + k, function () { return (L && L[p] && L[p][k]) || (Array.isArray(b) ? b.map(function (s) { return fxText(s, p); }) : null); }); });
  });
  if (typeof LIFE_LOOK_TITLE !== 'undefined') Object.keys(LIFE_LOOK_TITLE).forEach(function (k) { fxTxDefText(LIFE_LOOK_TITLE, k); });
  if (typeof LIFE_GREET !== 'undefined') fxTxDefArr(LIFE_GREET);
  if (typeof LIFE_NAMES !== 'undefined') LIFE_NAMES.forEach(function (x, i) { fxTxDef(LIFE_NAMES, i, function (b, p) { var r = fxResidentNames(p); return r && r[i % r.length]; }); });
  if (typeof NPC_TALK_GENERIC !== 'undefined' && N) NPC_TALK_GENERIC.forEach(function (x, i) {
    fxTxDef(NPC_TALK_GENERIC, i, function (b, p) { var a = (N[p] || []).concat(N.common || []); return fxText(a[i % a.length], p); });
  });
  if (typeof NPC_TALK_JOB !== 'undefined') Object.keys(NPC_TALK_JOB).forEach(function (k) { fxTxDefArr(NPC_TALK_JOB[k]); });
  if (typeof NPC_TALK_PRIV !== 'undefined') Object.keys(NPC_TALK_PRIV).forEach(function (k) { fxTxDefArr(NPC_TALK_PRIV[k]); });
  // 天災名(建造預覽的防災軸)
  if (typeof BPV_FX_NAME !== 'undefined') ['fire', 'flood', 'locust'].forEach(function (k) {
    fxTxDef(BPV_FX_NAME, k, function (b, p) { return (FX_HAZ_LABEL[p] && FX_HAZ_LABEL[p][k]) || FX_HAZ_LABEL.common[k]; });
  });
  if (typeof OBJECTS !== 'undefined') Object.keys(FX_OBJ_TXT).forEach(function (t) { if (OBJECTS[t]) fxTxDef(OBJECTS[t], 'name', function (b, p) { return FX_OBJ_TXT[t][p]; }); });
  fxVisitTypeInstall();
  fxStagesInstall();
  fxTextWrapAll();
  return true;
}

// ───────── 包住回傳字串的面板函式(魔幻世界過一次 fxText;歷史世界原樣)─────────
var FX_TXT_WRAP = ['cuRosterHtml', 'cuDrawTabHtml', 'cuDrawPoolHtml', 'cuDrawNamedHtml', 'cuRosterPageHtml', 'cuVenueHtml', 'cuLastHtml', 'cardsUiInfoHtml', 'cuNpcDetailHtml', 'cuRosterTabHtml', 'cuFurnaceTabHtml', 'cuFurnaceSetPop', 'cuHelpBtn',
  'lhHtmlOverview', 'lhHtmlJobs', 'lhHtmlPosts', 'bnMapRewardHtml', 'nextStepHtml', 'cuArtCard', 'tuLabel', 'tuDesc'];
function fxTxGlobal() { return (typeof window !== 'undefined' && window) ? window : (typeof globalThis !== 'undefined' ? globalThis : null); }
function fxTxWrap(name, post) {
  var g = fxTxGlobal(), f = g ? g[name] : null, w;
  if (typeof f !== 'function' || f.fxTxt || FX_TXT.wrapped[name]) return false;
  w = function () { var r = f.apply(this, arguments), p = fxTxPack(); return p ? post(r, p, arguments) : r; };
  w.fxTxt = 1; w.fxOrig = f;
  try { g[name] = w; } catch (e) { return false; }
  FX_TXT.wrapped[name] = 1;
  return true;
}
function fxTextWrapAll() {
  FX_TXT_WRAP.forEach(function (n) { fxTxWrap(n, function (r, p) { return fxText(r, p); }); });
  fxTxWrap('cardsUiHtmlCard', function (r, p, a) { var m = fxFigMark(a[0]); r = fxText(r, p); return (m && typeof r === 'string') ? r.replace(' · 名人', ' · 名人' + m) : r; });
  fxTxWrap('cardsUiInfo', function (o, p) {
    var r = {}, k;
    if (!o || !o.lines) return o;
    for (k in o) r[k] = o[k];   // 複本:不改到呼叫端可能快取的原物件
    r.title = fxText(o.title, p);
    r.lines = o.lines.map(function (l) { return [l[0] === '史實依據' ? '傳說' : fxText(l[0], p), fxText(l[1], p)]; });
    return r;
  });
  fxTxWrap('techUiUnlockNames', function (r, p) { return Array.isArray(r) ? r.map(function (s) { return fxText(s, p); }) : r; });   // 回陣列
  fxTxWrap('bnStgMakeFoe', function (r, p, a) { var b = a[0] && a[0].fxBoss; if (b && r) { r.name = b.name; r.title = b.title; } return r; });
  fxTxWrap('bnStgBounty', function (t) { var D = typeof FX_STG_DATA !== 'undefined' ? FX_STG_DATA : null, ch; if (t && D && D.bounty) { ch = BN_CHAPTERS[t.ch - 1]; t.desc = D.bounty.replace('{ch}', ch ? ch.name : ''); } return t; });
  // 提示訊息(showToast):改的是「輸入」字串(例:「官階達『亭長』後開放戰鬥」)
  (function () {
    var g = fxTxGlobal(), o = g ? g.showToast : null, w;
    if (typeof o !== 'function' || o.fxTxt) return;
    w = function (m) { var p = fxTxPack(); return o.call(this, p ? fxText(m, p) : m); };
    w.fxTxt = 1; w.fxOrig = o;
    try { g.showToast = w; } catch (e) { /* 略過 */ }
  })();
}

fxTextInstall();
