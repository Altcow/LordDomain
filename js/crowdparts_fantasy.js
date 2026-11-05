// crowdparts_fantasy.js — 魔幻世界(精靈 / 矮人 / 王國人類)路人外觀:種族資料 + 由世界風格主題決定種族池 + 居民外觀生成。
// 掛點(皆 typeof 守衛,缺本檔 = 完全沿用舊行為):
//   crowdparts.js crowdLook(job, seed, ethnic):ethnic 為 'elf' / 'dwarf' / 'human' 時由 fantasyApply 覆寫外觀
//   ethnic_data.js ethnicPick:魔幻世界直接回該族(不走東漢區域權重);歷史風格世界 fantasyRace() 回 null = 不變
//   citylife.js lifeNew:fantasyResidentSpec(類型, 外觀 key) 換掉一般居民 / 衛兵的 ART.UNIT 外觀
//   citytraffic.js lifeXEmit:路人 / 叫賣 / 走販的族別改走 fantasyRace()
// 繪製零件在 art.js:build(stout / slim)、headDy、ear、beard(字串)、apron、pauld、vine、頭飾 leaf / dhelm / dhood / coif / beret / kettle。
// 世界風格主題 id 由 theme_skin.js 提供;本檔只以字串比對 world.city.theme,不修改主題表。膚色沿用全族共用色階(不在此指定)。
// 快取 id:cp_<職業>_<0..3>_<elf|dwarf|human>(每職業 4 變體;同一世界只會有一族,總量 < 職業數 × 4)。

const FANTASY_THEME_RACE = { elf: 'elf', dwarf: 'dwarf', kingdom: 'human' };
const FANTASY_GUARDISH = { guard: 1, knight: 1, escort: 1 };
const FANTASY_ELITE = { scholar: 1, official: 1, noble: 1, doctor: 1, monk: 1, artist: 1, elder: 1 };

const FANTASY_RACES = {
  elf: {
    name: '精靈', build: 'slim', headDy: -2.4, scale: 1.1, ear: 'long', pants: '#8a7a5a', beard: 'none',
    cloth: [['#ece6d6', '#5f9a4a'], ['#a8cf7a', '#ece6d6'], ['#6f8fb8', '#ece6d6'], ['#d8e6b8', '#4f7a3a']],
    hair: ['#e2e0d6', '#e8d48a', '#8a7a66', '#4a3428'],
    heads: { guard: ['scarf', 'none', 'scarf', 'leaf'], elite: ['leaf', 'none', 'leaf', 'leaf'], civil: ['leaf', 'none', 'leaf', 'scarf'] },
    headCols: { guard: ['#4f7a3a', '#5a4030', '#5f9a4a', '#a8cf7a'], elite: ['#a8cf7a', '#ece6d6', '#e4ef9a', '#6f8fb8'], civil: ['#a8cf7a', '#ece6d6', '#e4ef9a', '#6f9a58'] },
    armor: '#6f8a52', vine: '#5f9a4a'
  },
  dwarf: {
    name: '矮人', build: 'stout', headDy: 3.4, scale: 1, pants: '#4a3a32', beard: ['long', 'braid', 'twin', 'fork'],
    cloth: [['#8a2f2a', '#8a8a84'], ['#8a8a84', '#8a2f2a'], ['#5a6a8a', '#c88a3a'], ['#6a4a3a', '#d9a23c']],
    hair: ['#a8542c', '#5a3a2a', '#2b1d1b', '#8a8a84'],
    heads: { guard: ['dhelm', 'dhelm', 'dhelm', 'dhood'], elite: ['dhood', 'none', 'dhelm', 'dhood'], civil: ['dhood', 'dhelm', 'none', 'dhood'] },
    headCols: { guard: ['#8a8f99', '#b0703a', '#6f7e8c', '#6a4a32'], elite: ['#6a4a32', '#6a4a32', '#c88a3a', '#5a5a62'], civil: ['#6a4a32', '#8a8f99', '#6a4a32', '#5a5a62'] },
    armor: '#7a7a82', apron: '#6a4428', apronJobs: { smith: 1, vendor: 1, woodcut: 1, porter: 1, farmer: 1, chair: 1 },
    pauld: '#9a9aa2', pauldJobs: { guard: 1, knight: 1, escort: 1, smith: 1 }
  },
  human: {
    name: '人類', build: null, headDy: 0, scale: 1, pants: '#4a3a2a', beard: 'keep',
    cloth: [['#4a6a8a', '#c8cdd2'], ['#a8342a', '#2f4a8a'], ['#8a6a4a', '#c9a46a'], ['#6b7a5a', '#d8cdb0']],
    hair: ['#d9b25a', '#a8542c', '#6a4a3a', '#2b1d1b'],
    heads: { guard: ['kettle', 'kettle', 'helmet', 'kettle'], elite: ['beret', 'none', 'beret', 'coif'], civil: ['coif', 'beret', 'coif', 'none'] },
    headCols: { guard: ['#8a8f99', '#6f7e8c', '#9a9aa2', '#7a7a82'], elite: ['#a8342a', '#ece6d6', '#2f4a8a', '#ece6d6'], civil: ['#ece6d6', '#8a6a4a', '#d8cdb0', '#ece6d6'] },
    armor: '#7a5a3a', apron: '#7a5a3a', apronJobs: { smith: 1 }, capeJobs: { noble: 1, knight: 1, official: 1, guard: 1 }, capeCols: ['#2f4a8a', '#a8342a', '#2f4a8a', '#a8342a']
  }
};

// 目前世界的魔幻種族;歷史風格 / 預設 / 未知主題一律 null
function fantasyRace() {
  let th = null;
  try { th = (typeof world !== 'undefined' && world && world.city) ? world.city.theme : null; } catch (e) { th = null; }
  return (typeof th === 'string' && Object.prototype.hasOwnProperty.call(FANTASY_THEME_RACE, th)) ? FANTASY_THEME_RACE[th] : null;
}

// 覆寫 crowdLook 已組好的漢外觀 spec;回 true = 已處理(race 有效)
function fantasyApply(spec, job, J, jh, v, race) {
  const R = FANTASY_RACES[race];
  if (!R) return false;
  const v4 = v & 3, h0 = J.heads[v % 4];
  const kid = job === 'kid', woman = h0 === 'woman';
  const grp = FANTASY_GUARDISH[job] ? 'guard' : FANTASY_ELITE[job] ? 'elite' : 'civil';
  const ci = (v4 + (jh >>> 5)) % 4, hi = (v4 + (jh >>> 3)) % 4;
  spec.id = 'cp_' + job + '_' + v4 + '_' + race; spec.v = v4; spec.fr = race;
  if (!J.ragged) { spec.tunic = R.cloth[ci][0]; spec.trim = J.rich ? '#ffc94a' : R.cloth[ci][1]; }
  spec.pants = R.pants;
  if (!J.whiteHair) spec.hair = R.hair[hi];
  if (!kid && !woman) { spec.head = R.heads[grp][v4]; spec.headCol = R.headCols[grp][v4]; }
  else if (woman) spec.headCol = R.headCols.elite[v4];
  if (grp === 'guard') spec.armor = R.armor; else delete spec.armor;
  if (R.beard === 'none') delete spec.beard;
  else if (Array.isArray(R.beard)) { if (kid || woman) delete spec.beard; else spec.beard = J.whiteHair ? 'long' : R.beard[v4]; }
  if (R.ear) spec.ear = R.ear;
  if (!kid) {
    spec.scale = Math.round(spec.scale * R.scale * 1000) / 1000;
    if (R.build) { spec.build = R.build; spec.headDy = R.headDy; }
    if (R.vine && !J.ragged) spec.vine = R.vine;
    if (R.apron && R.apronJobs[job]) spec.apron = R.apron;
    if (R.pauld && R.pauldJobs[job] && !woman) spec.pauld = R.pauld;
    if (R.capeJobs && R.capeJobs[job] && (job === 'knight' || v4 % 2 === 0)) spec.cape = R.capeCols[v4];
    if (race === 'human' && grp === 'guard' && spec.head === 'helmet') spec.plume = R.capeCols[v4]; // 騎士盔纓紅 / 藍
  }
  spec.dims = { hue: ci, hair: hi, hat: v4, acc: v4 };
  return true;
}

// ---- 居民(一般居民 / 衛兵)外觀:ART.UNIT 外觀 key → 職業池;keep = 保留舊外觀的手持 / 武器形狀 ----
const FANTASY_LOOK_JOBS = {
  man: ['farmer', 'woodcut', 'porter', 'fisher'], man2: ['vendor', 'porter', 'smith', 'farmer'], woman: ['woman'], woman2: ['woman'],
  elder: ['elder'], kid: ['kid'], kid2: ['kid'], farmer: ['farmer'], peddler: ['vendor'], scholar: ['scholar'], beggar: ['beggar'], smith: ['smith'],
  patrol: ['guard'], changji: ['guard'], daodun: ['guard'], guard: ['guard'], porter: ['porter']
};
const FANTASY_KEEP = { peddler: 1, patrol: 1, changji: 1, daodun: 1, guard: 1, porter: 1 };
const FANTASY_SKIP_TYPES = { onlooker: 1, hawker: 1, peddler: 1, wagon: 1, rider: 1, hand: 1, caravan: 1, coolie: 1 };
const FANTASY_SPECS = {};

function fantasyLook(job, seed, race) {
  if (!FANTASY_RACES[race] || typeof crowdLook !== 'function') return null;
  return crowdLook(job, seed, race);
}

// 回 null = 非魔幻世界 / 不適用,呼叫端沿用 lifeSpecFor
function fantasyResidentSpec(key, look, rnd) {
  if (FANTASY_SKIP_TYPES[key]) return null;
  const race = fantasyRace();
  if (!race) return null;
  const jobs = FANTASY_LOOK_JOBS[look];
  if (!jobs || typeof crowdLook !== 'function' || typeof ART === 'undefined' || !ART || !ART.UNIT || !ART.UNIT[look]) return null;
  const base = ART.UNIT[look];
  if (base.draw || base.mount || base.fierce) return null;
  const r = rnd === undefined ? Math.random() : rnd;
  const job = jobs[Math.floor(r * jobs.length) % jobs.length];
  const L = crowdLook(job, Math.floor((r * 1e6) % 1e6), race);
  if (!L) return null;
  const keep = !!FANTASY_KEEP[look], id = keep ? L.id + '_' + look : L.id;
  let s = FANTASY_SPECS[id];
  if (!s) {
    s = Object.assign({}, base, L, { id: id });
    if (keep) {
      if (base.prop) { s.prop = base.prop; delete s.staffCol; if (base.staffCol) s.staffCol = base.staffCol; } else delete s.prop;
      ['weapon', 'shield', 'shieldCol', 'night'].forEach(function (k) { if (base[k]) s[k] = base[k]; else delete s[k]; });
    }
    FANTASY_SPECS[id] = s;
  }
  if (typeof LIFE !== 'undefined' && LIFE && LIFE.variantIds) LIFE.variantIds[id] = true;
  return s;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { FANTASY_THEME_RACE, FANTASY_RACES, fantasyRace, fantasyApply, fantasyLook, fantasyResidentSpec, FANTASY_SPECS };
