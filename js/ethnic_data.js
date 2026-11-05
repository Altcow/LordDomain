// ethnic_data.js — 路人種族外觀資料(PLAN_ETHNIC §1/§2):族別表、區域/地形權重、名人→族別對照、辨識度規則。
// 純資料 + 少量純函式,不讀寫 world、不畫圖。缺此檔時 crowdLook / citytraffic 退回舊的全漢行為。
// 守則:辨識靠服飾、髮式、帽、配件與配色,不靠膚色與五官;膚色全族共用同一組色階(依職業戶外度,不依族別)。
// 色票皆 PLACEHOLDER;文案不使用貶抑稱呼(見 ETHNIC_BANNED_WORDS 與 tools/test_ethnic_data.js)。

// 膚色色階(全族共用):預設值與範圍
const ETHNIC_SKIN = {
  1: { def: '#ffe0c0', lo: '#ffe6cc', hi: '#ffdcb8' },
  2: { def: '#ffd9b0', lo: '#ffdcb8', hi: '#f2c89c' },
  3: { def: '#e8bd8c', lo: '#f2c89c', hi: '#dcaa7a' },
  4: { def: '#c99468', lo: '#dcaa7a', hi: '#c08a5e' }
};

// 族別表。cloth1/cloth2/leather/accent/flag1/flag2/pattern 為 token 預設;heads/props 為頭飾與道具(路人不持兵器);
// jobs=出現白名單(該族常見職業,其餘退回漢);fac=陣營權重 [魏,蜀,吳,黃巾,中立](合計 100);rel=史料可靠度 A/B/C;
// pool=false 表示本版不進路人池(預留);robeKind=left 左衽 / lapel 翻領 / right 右衽;key=辨識主鍵帽型
const ETHNIC_LOOK = {
  han: { id: 'han', name: '漢人', rel: 'A', pool: true, robeKind: 'right',
    intro: '耕田讀書,築城開市,天下十之八九是這樣過日子的人。衣冠隨身分,有麻有絲,也有短褐。',
    cloth1: null, cloth2: null, leather: '#5a4a3a', accent: '#e3b95c', flag1: null, flag2: null, pattern: 'plain',
    heads: null, props: null, jobs: null, fac: [20, 20, 20, 20, 20], key: 'bun' },
  xiongnu: { id: 'xiongnu', name: '匈奴人', rel: 'B', pool: true, robeKind: 'left',
    intro: '南匈奴內附并州已久,牧馬、從軍、互市都有他們的身影。毛皮帽護著耳朵,是塞外風雪裡練出來的穿法。',
    cloth1: '#7a5430', cloth2: '#2f4468', leather: '#5a3a22', accent: '#efe6d2', flag1: '#7a5430', flag2: '#efe6d2', pattern: 'deer_zigzag',
    heads: ['furcap', 'furcap', 'furcap', 'furcap'], props: ['pole', null, 'staff', null], jobs: ['vendor', 'guard', 'knight', 'porter'],
    fac: [20, 0, 0, 10, 70], key: 'furcap' },
  wuhuan: { id: 'wuhuan', name: '烏桓人', rel: 'B', pool: true, robeKind: 'left',
    intro: '上谷寧城設有護烏桓校尉的營府,每到互市便牽羊扛皮貨進城。頭頂剃淨、兩側留髮,是他們「輕便」的講究。',
    cloth1: '#a8542c', cloth2: '#c89a4a', leather: '#6a4428', accent: '#d9b23c', flag1: '#a8542c', flag2: '#c89a4a', pattern: 'arrow3',
    heads: ['kun', 'kun', 'woman', 'kun'], props: ['pole', 'staff', null, 'pole'], jobs: ['vendor', 'woman', 'porter'],
    fac: [10, 10, 0, 0, 80], key: 'kun' },
  xianbei: { id: 'xianbei', name: '鮮卑人', rel: 'B', pool: true, robeKind: 'left',
    intro: '草原上諸部分合不定,擅養馬,也會打製小件金飾。髮間一點金葉,是遠遠就認得出的記號。',
    cloth1: '#2f5a3c', cloth2: '#6a4a2a', leather: '#5a4026', accent: '#d9b23c', flag1: '#2f5a3c', flag2: '#d9b23c', pattern: 'leaf_gold',
    heads: ['kun', 'kun', 'kun', 'kun'], props: ['pole', null, 'staff', null], jobs: ['vendor', 'knight', 'porter'],
    fac: [10, 0, 0, 5, 85], key: 'kun' },
  qiang: { id: 'qiang', name: '羌人', rel: 'B', pool: true, robeKind: 'left',
    intro: '西羌依水草遷徙,趕著羊群過隴山,也常和涼州漢人交換糧布。羌笛的調子悠長,是涼州夜裡常聽見的聲音。',
    cloth1: '#cfc8b8', cloth2: '#2a2623', leather: '#4a3a2a', accent: '#9a4a32', flag1: '#cfc8b8', flag2: '#2a2623', pattern: 'felt_diamond',
    heads: ['loose', 'loose', 'scarf', 'loose'], props: ['staff', 'pole', null, 'staff'], jobs: ['vendor', 'porter', 'farmer'],
    fac: [15, 15, 0, 0, 70], key: 'loose' },
  di: { id: 'di', name: '氐人', rel: 'C', pool: false, robeKind: 'right',
    intro: '武都山裡的氐人會織布、會種田,還養豬牛驢騾。衣色愛用青與絳,日子過得與漢人鄰里相近。(依史載略作想像)',
    cloth1: '#3e6a8a', cloth2: '#9a2f35', leather: '#5a4a3a', accent: '#e8e2d0', flag1: '#3e6a8a', flag2: '#9a2f35', pattern: 'stripe_v',
    heads: ['scarf', 'scarf', 'scarf', 'scarf'], props: ['pole', null, 'staff', null], jobs: ['farmer', 'vendor', 'porter'],
    fac: [30, 20, 0, 0, 50], key: 'scarf' },
  xiyu: { id: 'xiyu', name: '西域商人', rel: 'B', pool: true, robeKind: 'lapel',
    intro: '從康居、粟弋遠道而來,翻領長袍、尖頂氈帽,牽著駱駝馱絲綢與香料。洛陽貴戚近年頗愛他們的樂器與舞。',
    cloth1: '#2f4f8a', cloth2: '#b0603a', leather: '#4a3524', accent: '#e3b95c', flag1: '#2f4f8a', flag2: '#f1ead8', pattern: 'grape_diamond',
    heads: ['peak', 'peak', 'peak', 'peak'], props: ['pole', null, 'staff', null], jobs: ['vendor', 'artist', 'porter'],
    fac: [15, 15, 10, 0, 60], key: 'peak' },
  nanman: { id: 'nanman', name: '五溪人', rel: 'B', pool: true, robeKind: 'right',
    intro: '五溪山深水急,當地人織木皮、染草實,愛穿五色相間的衣。與漢官訂的鹽布之約,往往是山外往來的起點。',
    cloth1: '#c8452f', cloth2: '#3f8a5a', leather: '#6a4a2a', accent: '#e3b95c', flag1: '#c8452f', flag2: '#3f8a5a', pattern: 'stripe5',
    palette5: ['#c8452f', '#e3b95c', '#3f8a5a', '#2f6fa3', '#f4ead2'],
    heads: ['zhui_feather', 'zhui_feather', 'hat', 'zhui_feather'], props: ['pole', null, 'staff', null], jobs: ['vendor', 'woodcut', 'fisher'],
    fac: [0, 60, 10, 0, 30], key: 'zhui_feather' },
  shanyue: { id: 'shanyue', name: '山越人', rel: 'B', pool: true, robeKind: 'right',
    intro: '江東群山之中,山越人背著竹簍下山,賣筍、藥材與獸皮。斑布短衣與竹笠,是山路上最好認的裝束。',
    cloth1: '#35557a', cloth2: '#e8e2d0', leather: '#6a4a2a', accent: '#b8a060', flag1: '#35557a', flag2: '#e8e2d0', pattern: 'check',
    heads: ['zhui_hat', 'zhui_hat', 'zhui_hat', 'zhui_hat'], props: ['pole', null, 'staff', null], jobs: ['vendor', 'woodcut', 'porter', 'fisher'],
    fac: [0, 0, 35, 10, 55], key: 'zhui_hat' }
};
const ETHNIC_LIST = Object.keys(ETHNIC_LOOK);
const ETHNIC_POOL = ETHNIC_LIST.filter(function (k) { return ETHNIC_LOOK[k].pool; });

// 路人族別權重(合計 100,含漢)。邊州非漢合計上限 20~24%,中原 ≤ 4%(PLAN_ETHNIC §2.4.2、§6 預設)
const CROWD_ETHNIC_MIX = {
  zhongyuan: { han: 96, xiyu: 4 },
  bei: { han: 80, xiongnu: 7, wuhuan: 5, xianbei: 3, qiang: 1, xiyu: 4 },
  liang: { han: 76, xiongnu: 3, xianbei: 1, qiang: 11, di: 2, xiyu: 7 },
  jing: { han: 91, xiyu: 2, nanman: 7 },
  yang: { han: 92, xiyu: 1, shanyue: 7 },
  yi: { han: 85, qiang: 3, di: 5, xiyu: 2, nanman: 5 },
  jiao: { han: 93, xiyu: 3, nanman: 2, shanyue: 2 }
};
const CROWD_ETHNIC_CAP = { zhongyuan: 4, bei: 20, liang: 24, jing: 9, yang: 8, yi: 15, jiao: 7 };
// 地形加成(乘法再正規化)
const ETHNIC_TERRAIN_BOOST = {
  sand: { xiyu: 1.8, qiang: 1.3, xiongnu: 1.3 },
  snow: { xiongnu: 1.4, wuhuan: 1.4, xianbei: 1.4, qiang: 1.2 },
  ranch: { xiongnu: 1.5, wuhuan: 1.5, xianbei: 1.5, qiang: 1.5 },
  forest: { shanyue: 1.5, nanman: 1.5, di: 1.5 },
  market: { xiyu: 1.3 }
};

// 變體上限與快取鍵上限(crowdLook 第三參數用):漢 8、非漢每職業 4
const ETHNIC_VARIANTS_HAN = 8;
const ETHNIC_VARIANTS_OTHER = 4;
const ETHNIC_CACHE_MAX = 56; // 每族(含各白名單職業 × 4 變體)的快取鍵上限

// 專屬帽型 → 目前 art.js headgear 已支援的繪製型(新帽型尚未入 art.js 前的退路;空字串 = 不戴帽,露出髮式)
const ETHNIC_HEAD_DRAW = { furcap: 'fur', kun: '', loose: '', peak: 'hat', zhui_feather: 'bun', zhui_hat: 'hat' };

// 辨識度規則:不同族別同職業的剪影差(衣色/髮色/帽/配件維度)至少 2;非漢族必有專屬帽型(key)
const ETHNIC_DISTINCT = { minCrossDiff: 2, minVariantsDiff: 1 };

// 禁用字詞(簡介與文案不得出現;「胡」僅限史料詞組,不單獨出現)
const ETHNIC_BANNED_WORDS = ['胡虜', '蠻夷', '夷狄', '野人', '生番', '化外', '山賊', '番人', '蠻子', '蠻族'];
const ETHNIC_HU_ALLOWED = ['胡商', '胡樂', '胡空侯', '胡床', '胡笛', '胡舞'];

// 名人→族別對照:[族別, 服飾風 dress, 待確認(1)]。族別只記自我歸屬明確者;血統猜測不上 eth,僅用 dress 調服飾。eth 不進任何數值公式
const ETHNIC_BY_FIG = {
  caocao: ['han', 'han'], xunyu: ['han', 'scholar'], guojia: ['han', 'scholar'], jiaxu: ['han', 'scholar'],
  simayi: ['han', 'scholar'], dianwei: ['han', 'han'], xiahoudun: ['han', 'han'], zhangliao: ['han', 'bei'],
  xunyou: ['han', 'scholar'], xuchu: ['han', 'han'], caoren: ['han', 'han'], xiahouyuan: ['han', 'han'],
  xuhuang: ['han', 'han'], zhongyao: ['han', 'scholar'], liubei: ['han', 'han'], guanyu: ['han', 'han'],
  zhangfei: ['han', 'han'], zhaoyun: ['han', 'han'], zhugeliang: ['han', 'scholar'], machao: ['han', 'liang', 1],
  pangtong: ['han', 'scholar'], fazheng: ['han', 'scholar'], weiyan: ['han', 'han', 1], huangzhong: ['han', 'han'],
  mizhu: ['han', 'han'], maliang: ['han', 'scholar'], xushu: ['han', 'han'], shamoke: ['nanman', 'nanman'],
  sunjian: ['han', 'han'], sunce: ['han', 'han'], zhouyu: ['han', 'scholar'], lusu: ['han', 'han'],
  ganning: ['han', 'han', 1], sunquan: ['han', 'han'], luxun: ['han', 'scholar'], lvmeng: ['han', 'han'],
  zhangzhao: ['han', 'scholar'], taishici: ['han', 'han'], huanggai: ['han', 'han'], zhoutai: ['han', 'han'],
  chengpu: ['han', 'bei'], shixie: ['han', 'south', 1], zhangjiao: ['han', 'daoist'], zhangbao: ['han', 'daoist'],
  zhangliang: ['han', 'daoist'], zhangniujiao: ['han', 'han', 1], zhangmancheng: ['han', 'daoist'],
  mayuanyi: ['han', 'daoist', 1], guanhai: ['han', 'han'], zhanglu: ['han', 'daoist'], guotai: ['han', 'han'],
  boca: ['han', 'han'], zhangyan: ['han', 'han', 1], liupi: ['han', 'han'], yudu: ['han', 'han', 1],
  yuji: ['han', 'daoist'], dongzhuo: ['han', 'liang', 1], lvbu: ['han', 'bei', 1], yuanshao: ['han', 'han'],
  huangfusong: ['han', 'han'], luzhi: ['han', 'scholar'], gongsunzan: ['han', 'bei'], zhujun: ['han', 'han'],
  zhengxuan: ['han', 'scholar'], mateng: ['han', 'liang', 1], xurong: ['han', 'han'], huatuo: ['han', 'han'],
  caiyong: ['han', 'scholar'], youtu: ['shanyue', 'shanyue'], yufuluo: ['xiongnu', 'xiongnu']

};
const ETHNIC_DRESS = ['han', 'liang', 'bei', 'south', 'daoist', 'scholar', 'nanman', 'shanyue', 'xiongnu'];

function ethnicOfFig(id) {
  const e = ETHNIC_BY_FIG[id];
  return e ? { eth: e[0], dress: e[1], unsure: !!e[2] } : null;
}

// 依區域權重(+可選地形旗標)抽族別;rnd 0..1。缺區域回 'han';pool=false 的族併入漢
function ethnicPick(region, rnd, flags) {
  if (typeof fantasyRace === 'function') { const fr = fantasyRace(); if (fr) return fr; } // 魔幻世界:整座城同一族(crowdparts_fantasy.js);歷史風格世界回 null = 不變
  const mix = CROWD_ETHNIC_MIX[region];
  if (!mix) return 'han';
  const w = {};
  Object.keys(mix).forEach(function (k) {
    const L = ETHNIC_LOOK[k];
    let x = mix[k], key = k;
    if (!L || !L.pool) key = 'han';
    else if (flags && k !== 'han') flags.forEach(function (f) { const b = ETHNIC_TERRAIN_BOOST[f]; if (b && b[k]) x *= b[k]; });
    w[key] = (w[key] || 0) + x;
  });
  const ks = Object.keys(w);
  let t = (rnd === undefined ? Math.random() : rnd) * ks.reduce(function (a, k) { return a + w[k]; }, 0);
  for (let i = 0; i < ks.length; i++) { t -= w[ks[i]]; if (t < 0) return ks[i]; }
  return 'han';
}
if (typeof module !== 'undefined' && module.exports) module.exports = { ETHNIC_SKIN, ETHNIC_LOOK, ETHNIC_LIST, ETHNIC_POOL, CROWD_ETHNIC_MIX, CROWD_ETHNIC_CAP, ETHNIC_TERRAIN_BOOST, ETHNIC_BY_FIG, ETHNIC_BANNED_WORDS, ETHNIC_HEAD_DRAW, ETHNIC_VARIANTS_OTHER, ETHNIC_CACHE_MAX, ETHNIC_DISTINCT, ethnicOfFig, ethnicPick };
