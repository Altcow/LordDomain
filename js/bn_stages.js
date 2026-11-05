// js/bn_stages.js — 戰鬥 A 模式 B3:討伐關卡資料(6 章 × 6 關)、敵將產生、每日流寇、軍令 / 獎勵 / 上限規則、存檔欄位正規化。PLAN_BATTLE_A §5、§8。
// 設計原則:戰鬥沒有小兵,每個單位都是一位武將;敵方每關 = 3~5 位『敵將』(各有名字、稱號、外觀鍵 foe:*)。兵種(盾步騎弓謀)只代表武將的戰鬥類型。
// 依賴(載入順序):carddata.js、cards.js(可缺)、bn_data.js、bn_skills_data.js、bn_units.js。純邏輯、無 DOM;外部全域(world cardsGet 等)一律 typeof 守衛,測試以 env 注入。
// 所有數字 PLACEHOLDER(v 陣列由 tools/bn_stage_check.js 解出,見 tools/bn_stage_report.md)。ES2017;不用 ?. ??。
// 全域:BN_STG BN_STG_ARCH BN_CHAPTERS BN_STAGES BN_STG_BY_ID bnStgById bnStgFoes bnStgSolveV bnStgBountyDef bnStgEnv bnStgDayNo bnStgWeekNo bnStgNorm bnStgPack bnStgOrders bnStgGoldCap bnStgUnlock bnStgCanStart bnStgRewards bnStgSettle bnStgBountySettle bnStgChapterStars

var BN_STG = {
  perDay: 5, store: 5,                       // 軍令:每日 +5、最多存 store(=perDay 即每日重置;PLAN 預設存 10 可改此值)
  goldFloor: 300, goldHalf: 0.5, goldCapMax: 30000,   // 每日討伐金幣上限 = clamp(每小時金幣產出 × 0.5, 保底, 上限)
  shardWeek: 20, bookWeek: 2,                // 戰鬥碎片 / 兵書 週上限
  gold1: 600, repeatDiv: 5, star3Gold: 200, star3Shards: 2,   // 首通 600 × 章、重複 = 首通 / 5、三星額外
  shards1: 5, shardsRep: 1, bookRepP: 0.05, matRepP: 0.5,
  bounty: { gold: 200, shards: 1, goods: 1, lo: 0.95, hi: 1.05, k: 1.15 },   // 敵方戰力 × k = 建議戰力口徑(流寇敵將編制較整齊、無名人,實測 k=1.15 使最強隊勝率約 45~55%)
  // 敵將五維基準 v(逐關,36 個;由 tools/bn_stage_check.js 解出);grOf = 各章敵將品階
  v: [26.8,30.5,22.5,28.6,33.2,32.5,37.7,41.9,51.4,45,47.4,45.2,41.4,41.9,45.6,47.7,51,47.6,49.5,51.3,60.7,59.5,59.4,61.5,50.5,55,68.3,60.5,68.6,76.1,63.5,66.4,68.8,70.5,67.7,69],
  grOf: [0, 0, 1, 1, 2, 2, 3],
  // 各章第 j 關起,敵將多帶一個戰法(依站位輪替)
  extraFrom: 3,
  rk: [1.193,1.194,1.035,0.983,0.986,1.05,1.168,1.133,0.99,1.057,1.005,1.05,1.128,1.171,1.033,1.104,1.05,1.067,1.063,1.088,1,0.983,1.025,0.993,1.121,1.106,0.986,1.06,1.014,1,1.042,1.014,1,0.98,1.083,1.019],                                    // 逐關建議戰力校正(36 個;使『我方戰力 = 建議戰力』約 50% 勝率,由 bn_stage_check --tune 解出)
  recK: 1.0                                  // 建議戰力 = 敵將隊戰力 × recK(使『我方戰力 = 建議戰力』約 50% 勝率;由 bn_stage_check --kfit 解出)
};

// 敵將類型(只是戰鬥類型 + 外觀 + 戰法):prof = 五維相對比例 [統 武 智 政 魅]
var BN_STG_ARCH = {
  bd_blade: { look: 'bandit_blade', troop: '步', prof: [1, 1.1, 0.8, 0.8, 0.9], skills: ['g_zhan'], ult: 'u_inf' },
  bd_hunter: { look: 'bandit_hunter', troop: '弓', prof: [0.9, 1.1, 0.9, 0.8, 0.9], skills: ['g_lianshe'], ult: 'u_arc' },
  bd_chief: { look: 'bandit_chief', troop: '步', prof: [1.1, 1.15, 0.85, 0.85, 1], hpK: 1.2, skills: ['g_chongfeng'], ult: 'u_inf' },
  yt_blade: { look: 'yt_blade', troop: '步', prof: [1, 1.1, 0.8, 0.85, 0.9], skills: ['g_zhan'], ult: 'u_inf' },
  yt_brute: { look: 'yt_brute', troop: '盾', prof: [1.15, 1, 0.7, 0.8, 0.9], skills: ['g_tiebi'], ult: 'u_shield' },
  yt_mystic: { look: 'yt_mystic', troop: '謀', prof: [0.8, 0.7, 1.15, 1, 0.9], skills: ['g_huogong'], ult: 'u_str' },
  yt_healer: { look: 'yt_mystic', troop: '謀', prof: [0.85, 0.7, 1.05, 1.15, 0.9], skills: ['g_liaoshang'], ult: 'u_heal' },
  cl_shield: { look: 'clan_shield', troop: '盾', prof: [1.15, 1, 0.75, 0.9, 0.9], skills: ['g_gushou'], ult: 'u_shield' },
  cl_xbow: { look: 'clan_xbow', troop: '弓', prof: [0.9, 1.1, 0.95, 0.85, 0.9], skills: ['g_qishe'], ult: 'u_arc' },
  cl_scholar: { look: 'clan_retainer', troop: '謀', prof: [0.8, 0.7, 1.15, 1.05, 0.95], skills: ['g_lijian'], ult: 'u_str' },
  cl_retainer: { look: 'clan_retainer', troop: '騎', prof: [1, 1.15, 0.9, 0.85, 1], hpK: 1.1, skills: ['g_xianzhen'], ult: 'u_cav' },
  hu_rider: { look: 'hu_rider', troop: '騎', prof: [0.95, 1.15, 0.8, 0.8, 0.95], skills: ['g_chongfeng'], ult: 'u_cav' },
  hu_archer: { look: 'hu_archer', troop: '弓', prof: [0.9, 1.1, 0.9, 0.8, 0.9], skills: ['g_chuanyun'], ult: 'u_arc' },
  hu_shaman: { look: 'hu_shaman', troop: '謀', prof: [0.8, 0.7, 1.15, 1, 0.95], skills: ['g_leifa'], ult: 'u_str' },
  rb_captain: { look: 'clan_retainer', troop: '步', prof: [1.1, 1.1, 0.85, 0.9, 1], hpK: 1.15, skills: ['g_poqiang'], ult: 'u_inf' }
};

// 章資料:roster 項目 = [類型, 名字, 稱號] 或 {fig, title}(名人敵將,用名人戰法);extra = 後段關卡加帶的戰法;mats = 材料(主, 副);books = 兵書(戰法 id)
var BN_CHAPTERS = [
  { n: 1, name: '山賊', sub: '盤踞山林的劫道匪首', rank: 1, extra: ['g_poqiang'], mats: ['g_tiekuang', 'mat_niupi'], books: ['g_zhan', 'g_lianshe', 'g_chongfeng'],
    roster: [['bd_blade', '虎三', '山賊刀客'], ['bd_blade', '黑牛', '山賊悍匪'], ['bd_hunter', '賈七', '山賊獵手'], ['bd_hunter', '山貓', '山賊弓匪'], ['bd_chief', '周大膽', '山賊頭目'], ['bd_chief', '鐵頭陳', '黑風寨主']] },
  { n: 2, name: '黃巾餘黨', sub: '符水與黃旗下的流竄敵將', rank: 2, extra: ['g_zhuiji', 'g_lijian'], mats: ['g_ma', 'mat_mabu'], books: ['g_huogong', 'g_zhenshe', 'g_liaoshang'],
    roster: [['yt_blade', '趙黃', '黃巾刀手'], ['yt_blade', '孫鐵', '黃巾悍將'], ['yt_brute', '熊九', '黃巾力士'], ['yt_mystic', '張某', '黃巾方士'], ['yt_healer', '李靈', '符水師'], { fig: 'mayuanyi', title: '黃巾密使' }, { fig: 'guanhai', title: '黃巾渠帥' }, { fig: 'zhangmancheng', title: '黃巾大帥' }] },
  { n: 3, name: '黃巾主力', sub: '太平道三兄弟麾下的精銳敵將', rank: 3, extra: ['g_zhenshe', 'g_fuhuo'], mats: ['mat_mabu', 'g_ma'], books: ['g_fuhuo', 'g_tiebi', 'g_qingxin'],
    roster: [['yt_blade', '馮武', '黃巾大刀手'], ['yt_blade', '魯猛', '黃巾驍將'], ['yt_brute', '岩勇', '黃巾力士長'], ['yt_mystic', '玄真', '太平道方士'], ['yt_healer', '清塵', '符水師'], { fig: 'zhangniujiao', title: '黃巾渠帥' }, { fig: 'zhangliang', title: '人公將軍' }, { fig: 'zhangbao', title: '地公將軍' }, { fig: 'zhangjiao', title: '天公將軍' }] },
  { n: 4, name: '世家私兵', sub: '塢堡豪強養的家將門客', rank: 4, extra: ['g_yuanhu', 'g_poqiang', 'g_jixing'], mats: ['mat_tieding', 'g_muban'], books: ['g_gushou', 'g_yuanhu', 'g_qishe'],
    roster: [['cl_shield', '錢固', '部曲督'], ['cl_shield', '衛成', '部曲長'], ['cl_xbow', '郗平', '強弩手'], ['cl_xbow', '魏勁', '弩將'], ['cl_scholar', '蘇墨', '門客'], ['cl_scholar', '顧謀', '幕客'], ['cl_retainer', '郭驍', '家將'], ['cl_retainer', '韓崇', '家將統領']] },
  { n: 5, name: '邊境胡騎', sub: '塞外南下的胡人部落敵將', rank: 5, extra: ['g_zhuiji', 'g_lixian', 'g_xianji'], mats: ['mat_niupi', 'mat_niujin'], books: ['g_chuanyun', 'g_banma', 'g_xianji'],
    roster: [['hu_rider', '呼延烈', '胡騎小帥'], ['hu_rider', '賀蘭鷹', '胡騎勇士'], ['hu_archer', '阿古拔', '射鵰手'], ['hu_archer', '塔爾罕', '神射手'], ['hu_shaman', '蘇日娜', '部落巫女'], ['hu_shaman', '帖木', '薩滿'], { fig: 'yufuluo', title: '南匈奴單于' }] },
  { n: 6, name: '郡國叛軍', sub: '割據一方的叛將與其麾下敵將', rank: 6, extra: ['g_haoling', 'g_jiesha', 'g_zhenshe'], mats: ['mat_tieding', 'mat_qingtong'], books: ['g_jiesha', 'g_haoling', 'g_jixing'],
    roster: [['cl_shield', '莫忠', '郡兵督'], ['cl_shield', '嚴固', '盾卒長'], ['cl_xbow', '沈疾', '強弩都尉'], ['rb_captain', '屈烈', '叛軍校尉'], ['cl_scholar', '陸機', '叛軍參軍'], ['cl_retainer', '項猛', '叛將'], { fig: 'yudu', title: '黑山渠帥' }, { fig: 'zhangyan', title: '黑山首領' }, { fig: 'dongzhuo', title: '涼州叛將' }] }
];

// 36 關:[名稱, 說明, 場景, 敵將在該章 roster 的索引...]
var BN_STG_DEF = [
  [['山腳劫道', '山賊刀客虎三領著同夥,在山道口攔路搶劫商旅。', 'hill', 0, 2, 1, 3],
    ['林間埋伏', '獵手賈七與山貓藏身樹林,等著放冷箭。', 'hill', 0, 1, 2, 3],
    ['糧車被劫', '黑牛劫走官府糧車,敵將們正在林邊分贓。', 'plain', 1, 0, 2, 3, 4],
    ['黑風寨前哨', '山賊頭目周大膽守住寨外的木柵。', 'hill', 4, 1, 2, 3, 0],
    ['寨門把關', '周大膽親自守寨門,五名敵將據險而守。', 'hill', 4, 0, 1, 2, 3],
    ['黑風寨主', '寨主鐵頭陳憑山勢拒守,是這一帶最凶悍的山賊。', 'hill', 5, 4, 0, 2, 3]],
  [['潁川流竄', '黃巾殘黨在潁川一帶流竄,方士張某作法助陣。', 'plain', 0, 2, 3, 1, 4],
    ['符水村', '符水師李靈以符水蠱惑村民,敵將們結陣護法。', 'plain', 0, 1, 2, 4, 3],
    ['荊州密使', '黃巾密使馬元義潛入荊州,身邊有力士護衛。', 'plain', 5, 2, 0, 4, 3],
    ['黃旗營地', '黃旗營中敵將齊聚,方士與符水師互相呼應。', 'plain', 0, 1, 2, 3, 4],
    ['北海圍城', '渠帥管亥圍攻北海城,麾下敵將士氣正盛。', 'plain', 6, 2, 3, 4, 0],
    ['宛城餘燼', '黃巾大帥張曼成據守宛城,是餘黨中最強的一支。', 'plain', 7, 2, 1, 3, 4]],
  [['廣宗外圍', '太平道主力駐紮廣宗,外圍有刀手與力士巡守。', 'plain', 0, 2, 3, 1, 4],
    ['符水大帳', '大帳之中方士與符水師輪番施法,力士守住帳門。', 'plain', 0, 1, 2, 4, 3],
    ['渠帥張牛角', '渠帥張牛角率驍勇敵將出戰,聲勢浩大。', 'plain', 5, 2, 3, 4, 0],
    ['黃天之陣', '黃天當立的旗號下,敵將們結成連環陣。', 'rain', 1, 0, 2, 3, 4],
    ['人公將軍張梁', '張梁身先士卒,旁有力士、方士與符水師護衛。', 'plain', 6, 2, 3, 4, 0],
    ['天公將軍張角', '張角與張寶、張梁三兄弟同陣,太平道最後的決戰。', 'rain', 8, 7, 6, 3, 4]],
  [['塢堡外牆', '世家塢堡外,部曲督錢固列陣迎客。', 'plain', 0, 2, 4, 1, 3],
    ['弩樓守將', '弩將魏勁居高臨下,弓弩手密集齊射。', 'plain', 0, 3, 2, 4, 1],
    ['門客議事', '蘇墨與顧謀兩位門客坐鎮中堂,謀略百出。', 'plain', 1, 4, 5, 2, 0],
    ['家將巡營', '家將郭驍帶隊巡營,盾將與弩手協防。', 'plain', 6, 0, 3, 5, 1],
    ['私兵演武', '各家將在演武場合練,攻守兼備。', 'plain', 6, 0, 1, 2, 4],
    ['家將統領韓崇', '統領韓崇是世家最倚重的家將,身後諸將環伺。', 'plain', 7, 6, 0, 3, 5]],
  [['塞外哨探', '胡騎小帥呼延烈率勇士南下探路。', 'plain', 0, 2, 4, 1, 3],
    ['草原遊獵', '射鵰手塔爾罕與阿古拔在草原上遊射。', 'plain', 0, 2, 3, 4, 1],
    ['薩滿祭壇', '薩滿帖木與部落巫女主持祭祀,騎將護衛祭壇。', 'rain', 1, 0, 5, 4, 3],
    ['部落營寨', '部落營寨中騎將與射手交錯布陣。', 'plain', 0, 1, 2, 3, 5],
    ['長城缺口', '胡騎敵將傾巢而出,衝擊長城缺口。', 'hill', 1, 0, 2, 3, 4],
    ['南匈奴單于', '單于於夫羅親率各部敵將南侵,是邊境最大的威脅。', 'plain', 6, 1, 3, 4, 5]],
  [['郡府叛亂', '郡兵督莫忠扣押太守,郡府成了叛軍據點。', 'plain', 0, 2, 4, 1, 3],
    ['黑山渠帥于毒', '于毒據黑山為亂,校尉屈烈與參軍陸機隨侍。', 'hill', 6, 3, 4, 2, 0],
    ['校尉謀反', '叛軍校尉屈烈拉攏盾卒與強弩,封鎖城門。', 'plain', 3, 0, 1, 2, 4],
    ['黑山首領張燕', '張燕輕捷善戰,麾下有驍將與弩手。', 'hill', 7, 5, 2, 4, 3],
    ['叛軍會盟', '各路叛將會盟,同時出戰,陣容整齊。', 'plain', 5, 3, 0, 2, 4],
    ['涼州董卓', '董卓以涼州猛將為班底,是郡國叛軍中最難纏的對手。', 'plain', 8, 5, 3, 2, 4]]
];

var BN_STAGES = [], BN_STG_BY_ID = {};
(function () {
  var c, j, ch, df, st, i, n = 0, bookList;
  for (c = 0; c < BN_CHAPTERS.length; c++) {
    ch = BN_CHAPTERS[c];
    for (j = 0; j < 6; j++) {
      df = BN_STG_DEF[c][j];
      st = { id: ch.n + '-' + (j + 1), ch: ch.n, idx: j + 1, name: df[0], desc: df[1], scene: df[2], boss: j === 5, rank: ch.rank, order: n, foeIdx: df.slice(3), book: ch.books[j % ch.books.length], v: 0 };
      BN_STAGES.push(st); BN_STG_BY_ID[st.id] = st; n++;
    }
  }
})();
function bnStgById(id) { return BN_STG_BY_ID[id] || null; }
function bnStgChapter(n) { return BN_CHAPTERS[n - 1] || null; }
function bnStgRecK(st) { var k = st ? BN_STG.rk[st.order] : 0; return BN_STG.recK * (typeof k === 'number' && k > 0 ? k : 1); }
function bnStgV(st) {
  var v = BN_STG.v && BN_STG.v[st.order];
  return typeof v === 'number' && v > 0 ? v : 40 + st.order;
}

// ───────── 敵將產生 ─────────
function bnStgMakeFoe(ent, v, ch, pos, st) {
  var fig = ent.fig ? BN_FIG_SKILLS[ent.fig] : null, arch = fig ? null : BN_STG_ARCH[ent[0]], troop = fig ? fig.troop : arch.troop, p = arch ? arch.prof : [1, 1, 1, 1, 1],
    gr = BN_STG.grOf[ch.n] | 0, vk = ent.vk || (st && st.boss && pos === 0 ? 1.05 : 1), card, spec, apt = {}, i, ex;
  card = { id: 'foe', name: fig ? fig.name : ent[1], fig: fig ? ent.fig : '', fac: fig ? fig.fac : 4, gr: gr, st: p.map(function (x) { return Math.max(1, Math.round(v * vk * x)); }), tok: 0, up: 0, ja: {}, tr: [], main: '', learn: 0, sex: '' };
  if (!fig) apt[troop] = 'A';
  spec = bnUnitSpec(card, { troop: troop, apt: fig ? undefined : apt });
  if (!fig) {
    spec.skills = arch.skills.slice();
    ex = ch.extra;
    if (st && st.idx >= BN_STG.extraFrom && ex.length) { ex = ex[pos % ex.length]; if (spec.skills.indexOf(ex) < 0) spec.skills.push(ex); }
    spec.ult = arch.ult;
    if (arch.hpK) spec.stats.hp = Math.round(spec.stats.hp * arch.hpK);
  }
  spec.look = 'foe:' + (fig ? (ent.look || BN_STG_FIG_LOOK[fig.troop] || 'yt_blade') : arch.look);
  spec.title = ent.title || ent[2] || '';
  spec.foe = 1;
  return spec;
}
var BN_STG_FIG_LOOK = { '步': 'bandit_chief', '盾': 'yt_brute', '騎': 'clan_retainer', '弓': 'hu_archer', '謀': 'yt_mystic' };
// 依 roster 條目與基準 v 組成敵方隊伍。回 {units, power, list, bonds}
function bnStgBuildTeam(ents, v, ch, st) {
  var specs = ents.map(function (e, k) { return bnStgMakeFoe(e, v, ch, k, st); }), team, power = 0;
  bnAutoLayout(specs, null);
  team = bnBuildTeam(specs);
  team.units.forEach(function (u) { power += bnPower(u); });
  return { units: team.units, power: power, rec: Math.round(power * bnStgRecK(st)), bonds: team.bonds.concat(team.formation), list: team.units.map(function (u) { return { name: u.name, title: u.title || '', troop: u.troop, look: u.look, fig: u.fig || '' }; }) };
}
// 某關的敵將隊伍(v 可覆寫,工具用)
function bnStgFoes(id, vOverride) {
  var st = bnStgById(id), ch, ents, r;
  if (!st) return null;
  ch = bnStgChapter(st.ch);
  ents = st.foeIdx.map(function (i) { return ch.roster[i]; });
  r = bnStgBuildTeam(ents, vOverride || bnStgV(st), ch, st);
  r.stage = st;
  return r;
}
// 解出讓隊伍戰力 = target 的 v(二分)
function bnStgSolveV(ents, ch, st, target) {
  var lo = 8, hi = 160, mid, k, p;
  for (k = 0; k < 16; k++) {
    mid = (lo + hi) / 2;
    p = bnStgBuildTeam(ents, mid, ch, st).power;
    if (p < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
function bnStgSolveStage(id, target) {
  var st = bnStgById(id), ch = bnStgChapter(st.ch);
  return bnStgSolveV(st.foeIdx.map(function (i) { return ch.roster[i]; }), ch, st, target);
}

// ───────── 每日流寇(種子 = hash(世界種子, 日號);敵方戰力 = 我方最強隊 × 0.95~1.05)─────────
// 回 {id:'B', name, desc, ch, units, power, list, seedKey}
function bnStgBounty(worldSeed, dayNo, myPower, maxCh) {
  var rng = bnRng(bnHash('bnbounty', worldSeed | 0, dayNo | 0)), cn = 1 + Math.floor(rng() * Math.max(1, Math.min(6, maxCh || 1))), ch = bnStgChapter(cn), pool = [], ents = [], k, r, tgt, v, team;
  for (k = 0; k < ch.roster.length; k++) if (!ch.roster[k].fig) pool.push(ch.roster[k]);
  while (ents.length < 5 && pool.length) { k = Math.floor(rng() * pool.length); ents.push(pool.splice(k, 1)[0]); }
  r = rng();
  tgt = Math.max(300, (myPower || 1500)) * (BN_STG.bounty.lo + (BN_STG.bounty.hi - BN_STG.bounty.lo) * r) / BN_STG.bounty.k;
  v = bnStgSolveV(ents, ch, null, tgt);
  team = bnStgBuildTeam(ents, v, ch, null);
  team.rec = Math.round(team.power * BN_STG.bounty.k);
  team.id = 'B'; team.name = '每日流寇'; team.ch = cn; team.desc = '今日出沒的' + ch.name + '流寇,實力與你的最強隊伍相當。'; team.scene = '';
  return team;
}

// ───────── 環境(測試可注入)─────────
function bnStgEnv(over) {
  var e = {
    now: function () { return Date.now(); },
    rank: function () { try { return (typeof cardsRankLv === 'function') ? cardsRankLv() : 0; } catch (x) { return 0; } },
    income: function () { try { return (typeof productionPerSec === 'function') ? ((productionPerSec().coin || 0) * 3600) : 0; } catch (x) { return 0; } },
    coin: function (n) { if (typeof world !== 'undefined' && world && world.res) { world.res.coin = (world.res.coin || 0) + n; return true; } return false; },
    goods: function (id, n) { return (typeof cityGoodsAdd === 'function') ? cityGoodsAdd(id, n) : 0; },
    shards: function (n) { if (typeof cardsGet === 'function' && typeof cardsShardGain === 'function') { cardsShardGain(cardsGet(), n); return true; } return false; },
    tokens: function (n) { if (typeof cardsGet === 'function' && typeof cardsAddNameTokens === 'function') { cardsAddNameTokens(cardsGet(), n); return true; } return false; }
  }, k;
  if (over) for (k in over) e[k] = over[k];
  return e;
}
function bnStgDayNo(now) { var d = new Date(now); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); }
function bnStgWeekNo(now) {
  if (typeof cardsWeekNo === 'function') return cardsWeekNo(now);
  return Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / (7 * 86400000));
}

// ───────── 存檔欄位(lorddomain.bn.v1 擴充;有值才寫、壞值夾住)─────────
function bnStgInt(v, lo, hi) { v = +v; if (!isFinite(v)) return lo; v = Math.floor(v); return v < lo ? lo : (v > hi ? hi : v); }
function bnStgNew() { return { got: {}, day: null, bounty: null, wk: null, gold: null, books: {} }; }
function bnStgNorm(o, d) {
  var k, v;
  d.got = {}; d.day = null; d.bounty = null; d.wk = null; d.gold = null; d.books = {};
  if (!o || typeof o !== 'object') return d;
  if (o.got && typeof o.got === 'object') for (k in o.got) if (BN_STG_BY_ID[k]) { v = bnStgInt(o.got[k], 0, 3); if (v) d.got[k] = v; }
  if (o.day && typeof o.day === 'object') { d.day = { d: bnStgInt(o.day.d, 0, 1e7), left: bnStgInt(o.day.left, 0, 99) }; if (!d.day.d) d.day = null; }
  if (o.bounty && typeof o.bounty === 'object') { v = bnStgInt(o.bounty.d, 0, 1e7); if (v && o.bounty.done) d.bounty = { d: v, done: 1 }; }
  if (o.wk && typeof o.wk === 'object') { d.wk = { w: bnStgInt(o.wk.w, 0, 1e7), shards: bnStgInt(o.wk.shards, 0, 9999), books: bnStgInt(o.wk.books, 0, 99) }; if (!d.wk.w) d.wk = null; }
  if (o.gold && typeof o.gold === 'object') { d.gold = { d: bnStgInt(o.gold.d, 0, 1e7), got: bnStgInt(o.gold.got, 0, 1e7) }; if (!d.gold.d) d.gold = null; }
  if (o.books && typeof o.books === 'object') for (k in o.books) if (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[k]) { v = bnStgInt(o.books[k], 0, 999); if (v) d.books[k] = v; }
  return d;
}
function bnStgHas(d) { return Object.keys(d.got || {}).length || d.day || d.bounty || d.wk || d.gold || Object.keys(d.books || {}).length; }
// 要併入存檔 JSON 的欄位(只含有值者)
function bnStgPack(d) {
  var o = {};
  if (d.got && Object.keys(d.got).length) o.got = d.got;
  if (d.day) o.day = d.day;
  if (d.bounty) o.bounty = d.bounty;
  if (d.wk) o.wk = d.wk;
  if (d.gold) o.gold = d.gold;
  if (d.books && Object.keys(d.books).length) o.books = d.books;
  return o;
}

// ───────── 軍令 / 上限 ─────────
function bnStgOrders(d, env) {
  var today = bnStgDayNo(env.now()), o = d.day, left;
  if (!o) left = BN_STG.perDay;
  else if (today > o.d) left = Math.min(BN_STG.store, o.left + BN_STG.perDay);
  else left = Math.min(BN_STG.store, o.left);
  return { left: left, max: BN_STG.perDay };
}
function bnStgSpendOrder(d, env) {
  var cur = bnStgOrders(d, env), today = bnStgDayNo(env.now());
  d.day = { d: Math.max(today, d.day ? d.day.d : 0), left: Math.max(0, cur.left - 1) };
}
function bnStgGoldCap(env) {
  var inc = +env.income() || 0;
  return Math.max(BN_STG.goldFloor, Math.min(BN_STG.goldCapMax, Math.round(inc * BN_STG.goldHalf)));
}
function bnStgGoldGot(d, env) {
  var today = bnStgDayNo(env.now());
  return d.gold && d.gold.d >= today ? d.gold.got : 0;
}
function bnStgWeek(d, env) {
  var w = bnStgWeekNo(env.now());
  if (d.wk && d.wk.w >= w) return { shards: d.wk.shards, books: d.wk.books };
  return { shards: 0, books: 0 };
}

// 解鎖:章 n 需官階第 n 階;章內依序;新章需前章頭目已過。clear = d.clear。回 {ok, why}
function bnStgUnlock(clear, id, env) {
  var st = bnStgById(id), prev;
  if (!st) return { ok: false, why: '無此關卡' };
  if (env.rank() < st.rank) return { ok: false, why: '官階達「' + (typeof LH_RANKS !== 'undefined' && LH_RANKS[st.rank - 1] ? LH_RANKS[st.rank - 1].n : '第 ' + st.rank + ' 階') + '」開放' };
  if (st.idx > 1) prev = st.ch + '-' + (st.idx - 1);
  else if (st.ch > 1) prev = (st.ch - 1) + '-6';
  if (prev && !((clear[prev] | 0) >= 1)) return { ok: false, why: '先通過 ' + prev };
  return { ok: true, why: '' };
}
// 能否開打:解鎖 + 軍令(未通關過的首通免軍令)。回 {ok, why, free}
function bnStgCanStart(d, id, env) {
  var u = bnStgUnlock(d.clear || {}, id, env), first;
  if (!u.ok) return { ok: false, why: u.why, free: false };
  first = !(((d.got || {})[id] | 0) & 1);
  if (first) return { ok: true, why: '', free: true };
  if (bnStgOrders(d, env).left < 1) return { ok: false, why: '今日軍令已用完', free: false };
  return { ok: true, why: '', free: false };
}
function bnStgChapterStars(clear, n) {
  var s = 0, j;
  for (j = 1; j <= 6; j++) s += (clear[n + '-' + j] | 0);
  return s;
}

// ───────── 獎勵 ─────────
function bnStgRewards(id) {
  var st = bnStgById(id), ch, n, m, g1;
  if (!st) return null;
  ch = bnStgChapter(st.ch); n = st.ch; m = ch.mats; g1 = BN_STG.gold1 * n;
  return {
    first: { gold: g1, goods: [[m[0], 2 + (st.idx >= 5 ? 1 : 0)]].concat(st.boss ? [[m[1], 1]] : []), shards: BN_STG.shards1, book: [st.book, 1], token: st.boss ? 1 : 0 },
    repeat: { gold: Math.round(g1 / BN_STG.repeatDiv), goods: [m[0], 1], goodsP: BN_STG.matRepP, shards: BN_STG.shardsRep, book: st.book, bookP: BN_STG.bookRepP },
    star3: { gold: BN_STG.star3Gold * n, shards: BN_STG.star3Shards }
  };
}
function bnStgFrac(seed, tag, id) { return bnHash('bnrw', seed | 0, tag, id) / 4294967296; }
// 發獎共用:gold/shards/books 受上限;goods/token 不受。回報告;實際寫入走 env
function bnStgGrant(d, env, want, rep) {
  var cap = bnStgGoldCap(env), got = bnStgGoldGot(d, env), wk = bnStgWeek(d, env), today = bnStgDayNo(env.now()), w = bnStgWeekNo(env.now()), g, s, b;
  rep.cap = { gold: cap, goldGot: got, shardLeft: BN_STG.shardWeek - wk.shards, bookLeft: BN_STG.bookWeek - wk.books };
  g = Math.max(0, Math.min(want.gold || 0, cap - got));
  s = Math.max(0, Math.min(want.shards || 0, BN_STG.shardWeek - wk.shards));
  b = Math.max(0, Math.min(want.books || 0, BN_STG.bookWeek - wk.books));
  rep.cut = { gold: (want.gold || 0) - g, shards: (want.shards || 0) - s, books: (want.books || 0) - b };
  if (g > 0) { env.coin(g); d.gold = { d: Math.max(today, d.gold ? d.gold.d : 0), got: (d.gold && d.gold.d >= today ? d.gold.got : 0) + g }; }
  if (s > 0) env.shards(s);
  if (b > 0 && want.bookId) { d.books[want.bookId] = (d.books[want.bookId] | 0) + b; rep.bookId = want.bookId; }
  if (s > 0 || b > 0) d.wk = { w: Math.max(w, d.wk ? d.wk.w : 0), shards: wk.shards + s, books: wk.books + b };
  (want.goods || []).forEach(function (x) { if (x[1] > 0) { env.goods(x[0], x[1]); rep.goods.push({ id: x[0], n: x[1] }); } });
  if (want.token > 0) { env.tokens(want.token); rep.token = want.token; }
  rep.gold = g; rep.shards = s; rep.books = b;
  return rep;
}
// 討伐結算。res = {winner, stars, seed}。d 為 bn 存檔資料(clear、got、day、gold、wk、books 會被改)。回報告 {win, first, star3, order, gold, shards, books, goods, token, cut, cap}
function bnStgSettle(d, id, res, env) {
  var st = bnStgById(id), rep = { win: false, id: id, first: false, star3: false, order: 0, gold: 0, shards: 0, books: 0, goods: [], token: 0, cut: { gold: 0, shards: 0, books: 0 }, cap: null }, rw, got, first, stars, want, f;
  env = bnStgEnv(env);
  if (!st || !res || res.winner !== 'A') return rep;
  d.clear = d.clear || {}; d.got = d.got || {}; d.books = d.books || {};
  rw = bnStgRewards(id); stars = bnStgInt(res.stars, 1, 3); got = d.got[id] | 0; first = !(got & 1);
  rep.win = true; rep.first = first; rep.stars = stars;
  want = { gold: 0, shards: 0, books: 0, goods: [], token: 0, bookId: st.book };
  if (first) {
    want.gold += rw.first.gold; want.shards += rw.first.shards; want.books += rw.first.book[1]; want.goods = rw.first.goods.map(function (x) { return [x[0], x[1]]; }); want.token = rw.first.token;
    got |= 1;
  } else {
    bnStgSpendOrder(d, env); rep.order = 1;
    want.gold += rw.repeat.gold; want.shards += rw.repeat.shards;
    if (bnStgFrac(res.seed, 'm', id) < rw.repeat.goodsP) want.goods.push([rw.repeat.goods[0], rw.repeat.goods[1]]);
    if (bnStgFrac(res.seed, 'b', id) < rw.repeat.bookP) want.books += 1;
  }
  if (stars >= 3 && !(got & 2)) { want.gold += rw.star3.gold; want.shards += rw.star3.shards; got |= 2; rep.star3 = true; }
  bnStgGrant(d, env, want, rep);
  d.got[id] = got;
  d.clear[id] = Math.max(d.clear[id] | 0, stars);
  return rep;
}
function bnStgBountyDone(d, env) { return !!(d.bounty && d.bounty.done && d.bounty.d >= bnStgDayNo(env.now())); }
function bnStgBountySettle(d, res, env) {
  var rep = { win: false, id: 'B', first: false, gold: 0, shards: 0, books: 0, goods: [], token: 0, cut: { gold: 0, shards: 0, books: 0 }, cap: null }, today, want, mats;
  env = bnStgEnv(env);
  if (!res || res.winner !== 'A') return rep;
  rep.win = true;
  if (bnStgBountyDone(d, env)) { rep.already = true; return rep; }
  today = bnStgDayNo(env.now());
  mats = bnStgChapter(Math.max(1, Math.min(6, res.ch | 0 || 1))).mats[0];
  want = { gold: BN_STG.bounty.gold, shards: BN_STG.bounty.shards, books: 0, goods: [[mats, BN_STG.bounty.goods]], token: 0 };
  bnStgGrant(d, env, want, rep);
  d.bounty = { d: Math.max(today, d.bounty ? d.bounty.d : 0), done: 1 };
  rep.first = true;
  return rep;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { BN_STG: BN_STG };
