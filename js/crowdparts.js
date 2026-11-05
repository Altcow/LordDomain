// crowdparts.js — 路人職業與外觀零件化:職業表 + 由 (職業, 種子) 確定性組出外觀的純函式 crowdLook(job, seed)。
// 純資料與純函式,不讀寫 world、不碰戰鬥;外觀回傳 ART.UNIT 相容的 spec(id 為量化後的 cp_<職業>_<0..7>,每職業 ≤ 8 變體,
// 因此既有的離屏精靈快取鍵數量有上限)。citytraffic.js 以 typeof crowdSpecFor 偵測,模組缺失時退回舊的固定外觀。
// 辨識度:同職業 8 個變體兩兩「衣色 + 髮色」必不同,且「帽型 / 配件」至少一項不同(見 tools/test_crowdparts.js)。

const CROWD_VARIANTS = 8;
// 8 色衣料(色相彼此拉開)、髮色、帽色、配件色
const CROWD_TUNIC = [['#c96a3a', '#7a3a1a'], ['#4a7fb0', '#2c4f73'], ['#6fa04a', '#3e6a2c'], ['#b8433c', '#7a2420'],
  ['#8a5ab0', '#58367a'], ['#d9b23c', '#8a6a1c'], ['#3fa3a0', '#1f6a68'], ['#9a8a7a', '#5a4a3a']];
const CROWD_HAIR = ['#2b1d1b', '#5a3a2a', '#8a5a2b', '#3a3a44', '#6a4a3a', '#1f1a2b', '#7a5a3a', '#4a2a2a'];
const CROWD_HATCOL = ['#e3b95c', '#3e5c7a', '#d23a2c', '#f4ead2', '#6a8a4a', '#2b1d1b', '#a8692f', '#8a6ab0'];
const CROWD_ACCCOL = ['#a8692f', '#6f7e8c', '#d23a2c', '#e3b95c', '#3e5c7a', '#6a8a4a', '#8a5ab0', '#f4ead2'];

// heads/props 各 4 項:v%4 選帽型、floor(v/2)%4 選配件(8 變體兩兩至少一項不同)
// walk=步速倍率;pause=駐足秒數範圍;work=工作動作標籤(行為腳本掛點,由 citylife 的 act 對應)
const CROWD_JOBS = {
  farmer:   { name: '農夫', heads: ['hat', 'scarf', 'hat', 'scarf'], props: [null, 'staff', 'pole', 'hammer'], scale: 1, walk: 0.8, pause: [2, 6], work: 'hoe' },
  vendor:   { name: '商販', heads: ['hat', 'scarf', 'bun', 'hat'], props: ['pole', null, 'pole', 'staff'], scale: 1, walk: 0.7, pause: [4, 10], work: 'sell' },
  scholar:  { name: '書生', heads: ['scarf', 'bun', 'scarf', 'bun'], props: [null, 'staff', null, 'staff'], scale: 1, walk: 0.7, pause: [3, 8], work: 'read', robe: true },
  guard:    { name: '衛兵', heads: ['helmet', 'scarf', 'helmet', 'scarf'], props: [null, 'staff', null, 'staff'], scale: 1.02, walk: 0.75, pause: [3, 9], work: 'watch' },
  smith:    { name: '工匠', heads: ['scarf', 'hat', 'scarf', 'hat'], props: ['hammer', null, 'hammer', 'pole'], scale: 1, walk: 0.8, pause: [3, 8], work: 'hammer' },
  monk:     { name: '僧侶', heads: ['bun', 'bun', 'scarf', 'bun'], props: ['staff', null, 'staff', null], scale: 1, walk: 0.5, pause: [4, 10], work: 'pray', robe: true },
  doctor:   { name: '郎中', heads: ['scarf', 'bun', 'hat', 'scarf'], props: [null, 'staff', 'pole', null], scale: 1, walk: 0.7, pause: [3, 8], work: 'heal', robe: true },
  woodcut:  { name: '樵夫', heads: ['scarf', 'fur', 'scarf', 'hat'], props: ['hammer', 'pole', 'hammer', 'staff'], scale: 1.03, walk: 0.8, pause: [2, 6], work: 'chop' },
  fisher:   { name: '漁夫', heads: ['hat', 'hat', 'scarf', 'hat'], props: ['pole', 'staff', null, 'pole'], scale: 1, walk: 0.7, pause: [4, 12], work: 'fish' },
  kid:      { name: '孩童', heads: ['kid', 'kid', 'kid', 'kid'], props: [null, null, null, null], scale: 0.78, walk: 1.2, pause: [1, 3], work: 'play' },
  elder:    { name: '老者', heads: ['bun', 'bun', 'scarf', 'bun'], props: ['staff', 'staff', null, 'staff'], scale: 0.97, walk: 0.5, pause: [4, 12], work: 'rest', robe: true, whiteHair: true },
  woman:    { name: '婦人', heads: ['woman', 'woman', 'woman', 'woman'], props: [null, 'pole', null, null], scale: 0.98, walk: 0.8, pause: [2, 7], work: 'weave', robe: true },
  official: { name: '官吏', heads: ['scarf', 'bun', 'scarf', 'bun'], props: [null, 'staff', null, 'staff'], scale: 1, walk: 0.7, pause: [3, 8], work: 'ledger', robe: true },
  knight:   { name: '騎士', heads: ['helmet', 'helmet', 'scarf', 'helmet'], props: [null, null, null, null], scale: 1.04, walk: 0.9, pause: [2, 5], work: 'patrol', armor: '#9a7a52' },
  escort:   { name: '鏢師', heads: ['scarf', 'scarf', 'helmet', 'scarf'], props: [null, null, 'staff', null], scale: 1.03, walk: 0.85, pause: [3, 7], work: 'escort' },
  artist:   { name: '藝人', heads: ['bun', 'hat', 'scarf', 'woman'], props: ['staff', null, 'pole', null], scale: 1, walk: 0.8, pause: [6, 16], work: 'perform', robe: true },
  chair:    { name: '轎夫', heads: ['scarf', 'scarf', 'hat', 'scarf'], props: ['pole', 'pole', 'pole', 'pole'], scale: 1.02, walk: 0.85, pause: [2, 5], work: 'carry' },
  porter:   { name: '挑夫', heads: ['scarf', 'scarf', 'hat', 'scarf'], props: ['pole', 'pole', null, 'pole'], scale: 1, walk: 0.75, pause: [2, 6], work: 'carry' },
  beggar:   { name: '乞丐', heads: ['scarf', 'bun', 'scarf', 'hat'], props: ['staff', null, 'staff', null], scale: 0.97, walk: 0.5, pause: [5, 14], work: 'beg', ragged: true },
  noble:    { name: '貴族', heads: ['bun', 'scarf', 'bun', 'woman'], props: [null, 'staff', null, null], scale: 1.02, walk: 0.6, pause: [4, 10], work: 'stroll', robe: true, rich: true }
};
const CROWD_JOB_LIST = Object.keys(CROWD_JOBS);

function crowdHash(s) {
  s = String(s);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 種子 → 變體編號 0..7(確定性;同 (職業, 種子) 恆同)
function crowdVariant(job, seed) { return crowdHash(job + '|' + seed) % CROWD_VARIANTS; }

// 純函式:(職業, 種子) → 外觀 spec。未知職業回 null。
function crowdLook(job, seed, ethnic) {
  const J = CROWD_JOBS[job];
  if (!J) return null;
  const v = crowdVariant(job, seed), jh = crowdHash(job);
  const tun = CROWD_TUNIC[(v + jh) % 8];
  const hairI = (v * 3 + (jh >>> 3)) % 8;
  const hatI = v % 4, accI = Math.floor(v / 2) % 4;
  const spec = {
    id: 'cp_' + job + '_' + v, name: J.name, civil: true, cp: true, job: job, v: v,
    tunic: J.rich ? CROWD_TUNIC[v][0] : J.ragged ? ['#8a7a66', '#7a8a76', '#8a7076', '#7a7a8a', '#8a8266', '#76827a', '#8a6e5e', '#6e7a86'][v] : tun[0],
    trim: J.rich ? '#ffc94a' : J.ragged ? CROWD_TUNIC[v][1] : tun[1],
    pants: '#5a4a3a',
    head: J.heads[hatI], headCol: CROWD_HATCOL[(v * 5 + 1) % 8],
    hair: J.whiteHair ? '#e8e4dc' : CROWD_HAIR[hairI],
    scale: Math.round(J.scale * (1 + ((v % 3) - 1) * 0.02) * 1000) / 1000, // 身材微調 ±2%
    dims: { hue: (v + jh) % 8, hair: hairI, hat: hatI, acc: accI }
  };
  if (J.robe) spec.robe = true;
  if (J.armor) spec.armor = J.armor;
  if (J.whiteHair || ((job === 'scholar' || job === 'official') && v % 4 === 3)) spec.beard = true;
  const p = J.props[accI];
  if (p) { spec.prop = p; if (p === 'staff') spec.staffCol = CROWD_ACCCOL[v]; }
  if (ethnic && ethnic !== 'han' && !(typeof fantasyApply === 'function' && fantasyApply(spec, job, J, jh, v, ethnic))) crowdEthnicApply(spec, job, J, jh, v, ethnic); // 魔幻種族(crowdparts_fantasy.js)優先; 缺 ETHNIC_LOOK / 不在白名單時原樣回漢外觀
  return spec;
}

// 色值明暗微調(f>1 變亮、f<1 變暗)
function crowdShade(hex, f) {
  let o = '#';
  for (let i = 1; i < 7; i += 2) { const c = Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(i, 2), 16) * f))); o += (c < 16 ? '0' : '') + c.toString(16); }
  return o;
}

// 第三參數:非漢族別覆寫外觀(變體降為 4:v4 = v & 3,id 為 cp_<職業>_<v4>_<族別>)。族別不存在 / 不進池 / 職業不在該族白名單 => 不動(退回漢)
function crowdEthnicApply(spec, job, J, jh, v, ethnic) {
  if (typeof ETHNIC_LOOK === 'undefined') return;
  const L = ETHNIC_LOOK[ethnic];
  if (!L || !L.pool || !L.jobs || L.jobs.indexOf(job) < 0) return;
  const v4 = v & 3;
  spec.id = 'cp_' + job + '_' + v4 + '_' + ethnic; spec.v = v4; spec.eth = ethnic; spec.robeKind = L.robeKind;
  if (L.pattern) spec.pat = L.pattern;
  const c1 = L.cloth1, c2 = L.cloth2;
  const tun = [[c1, c2], [c2, c1], [crowdShade(c1, 1.12), c2], [crowdShade(c2, 0.88), c1]][v4];
  if (!J.rich && !J.ragged) { spec.tunic = tun[0]; spec.trim = tun[1]; }
  spec.pants = L.leather;
  const hairI = (v4 * 3 + (jh >>> 3)) % 8;
  if (!J.whiteHair) spec.hair = CROWD_HAIR[hairI];
  if (J.heads[v % 4] !== 'woman' && J.heads[v % 4] !== 'kid') {
    const h = L.heads[v4];
    spec.head = (typeof ETHNIC_HEAD_DRAW !== 'undefined' && h in ETHNIC_HEAD_DRAW) ? ETHNIC_HEAD_DRAW[h] : h;
    spec.headCol = [L.accent, c2, c1, L.leather][v4];
  }
  const p = L.props[v4];
  spec.prop = p || undefined; if (!p) delete spec.prop;
  delete spec.staffCol;
  if (p === 'staff') spec.staffCol = CROWD_ACCCOL[v4];
  spec.dims = { hue: v4, hair: hairI, hat: v4, acc: v4 };
}

// 行為腳本掛點:走路速度倍率、駐足秒數範圍、工作動作標籤
function crowdBehavior(job) {
  const J = CROWD_JOBS[job];
  return J ? { walk: J.walk, pause: J.pause.slice(), work: J.work } : null;
}

// 兩外觀的差異維度數(衣色 / 髮色 / 帽 / 配件),供辨識度檢查
function crowdDiff(a, b) {
  let d = 0;
  if (a.tunic !== b.tunic) d++;
  if (a.hair !== b.hair) d++;
  if (a.head !== b.head || a.headCol !== b.headCol) d++;
  if (a.prop !== b.prop || a.staffCol !== b.staffCol) d++;
  return d;
}

// 街景角色 → 可抽的職業;base 為舊的固定外觀(ART.UNIT)。回傳合併後的 spec(以 id 快取,總數 ≤ 職業數 × 8),不適用時回 null 讓呼叫端沿用舊外觀
const CROWD_ROLE_JOBS = {
  onlooker: ['farmer', 'vendor', 'scholar', 'smith', 'monk', 'doctor', 'woodcut', 'kid', 'elder', 'woman', 'official', 'artist', 'beggar', 'noble', 'fisher', 'porter'],
  hawker: ['vendor'], peddler: ['vendor', 'porter']
};
const CROWD_SPECS = {};
function crowdSpecFor(role, base, rnd, ethnic) {
  const jobs = CROWD_ROLE_JOBS[role];
  if (!jobs || !base || base.draw || base.mount || base.fierce) return null;
  const r = rnd === undefined ? Math.random() : rnd;
  const job = jobs[Math.floor(r * jobs.length) % jobs.length];
  const L = crowdLook(job, Math.floor((r * 1e6) % 1e6), ethnic);
  if (!L) return null;
  const keep = role !== 'onlooker'; // 挑擔 / 托盤 / 推車沿用舊外觀的形狀,只換服色髮色
  const id = keep ? L.id + '_' + base.id : L.id;
  let s = CROWD_SPECS[id];
  if (!s) {
    s = Object.assign({}, base, L, { id: id });
    if (keep) { if (!L.fr) { s.head = base.head; s.scale = base.scale; delete s.robe; } s.prop = base.prop; } // 魔幻種族保留自己的頭飾與體型
    CROWD_SPECS[id] = s;
  }
  return s;
}
