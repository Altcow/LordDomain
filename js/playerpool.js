// playerpool.js — 玩家陣地池(PLAN_LAYOUT §3.5):🎲 隨機戰鬥從這裡抽一個「玩家陣地」來打。
// 池 = 自己的戰鬥版面存檔格(world.layoutSlots.camp,通過 validateCamp 才入池,打自己只算練習)
//    + 預製「玩家風格」戰陣(camp_lv01 / camp_lianying / camp_square / camp_pass)
//    + poolProviders 掛勾(每個 provider 為 function(playerLv) 回傳條目陣列);內建 poolModProvider:戰陣模塊庫(js/progmod.js,玩家等級 ±2)。
// 抽選權重(POOL_WEIGHTS):模塊庫 60% / 預製 25% / 自己 15%(某一類沒有條目時,其餘類別按比例重分)。
// 條目:{ id, kind:'self'|'prefab'|'gen', name(陣地名), lvHint(適合城市等級下限), tpl|slot, practice }
// 外部全域(執行期才使用):world TEMPLATES OBJECTS hashStr boardFromJSON boardToJSON validateCamp tplCells npcBuildBoard scoutVisible progLv

const POOL_NAMES = [
  '陳留・張孟', '潁川・荀伯', '汝南・許叔', '南陽・黃承', '河內・司馬朗', '東郡・程昱', '沛國・曹仁', '下邳・陳登', '廣陵・張超', '會稽・朱儁',
  '長沙・孫堅', '江夏・黃祖', '襄陽・蒯越', '上黨・張楊', '太原・王允', '涿郡・劉備', '漁陽・鮮于輔', '北海・孔融', '東萊・太史慈', '弘農・楊彪'
];

// 預製玩家風格戰陣;lvHint 為適合城市等級下限(以 tools/camp_walls_audit.js 稽核過的四座為準)
const POOL_PREFABS = [
  { id: 'camp_lv01', tpl: 'camp_lv01', name: '新手戰陣', lvHint: 1 },
  { id: 'camp_lianying', tpl: 'camp_lianying', name: '連環營', lvHint: 3 },
  { id: 'camp_square', tpl: 'camp_square', name: '方城陣', lvHint: 5 },
  { id: 'camp_pass', tpl: 'camp_pass', name: '山口隘道陣', lvHint: 7 }
];

// 條目來源掛勾:push(function (lv) { return [條目…]; }),條目需自帶 loadJson(回傳 boardJSON);kind 為 'gen'
const poolProviders = [];

// 抽選權重(各類別的相對機率,集中在此;某類沒有條目時略過):gen = 戰陣模塊庫、prefab = 預製玩家風格戰陣、self = 自己的存檔格陣地
const POOL_WEIGHTS = { gen: 60, prefab: 25, self: 15 };

const POOL_LV_AHEAD = 2;       // 只抽 lvHint ≤ 玩家等級 + 2 的陣地
const POOL_PRACTICE_MUL = 0.5; // 打自己的陣地:資源與經驗倍率

function poolLv() {
  return typeof progLv === 'function' ? progLv() : 1;
}

// 自己戰鬥存檔格中通過 validateCamp 的版面(自己也算其中一個玩家)
function poolSelfEntries() {
  const out = [];
  const arr = typeof world !== 'undefined' && world && world.layoutSlots && world.layoutSlots.camp;
  if (!arr) return out;
  for (let n = 0; n < arr.length; n++) {
    const s = arr[n];
    if (!s || !s.board) continue;
    let ok = false;
    try {
      const bd = boardFromJSON(s.board);
      ok = !!bd && validateCamp(bd).errors.length === 0;
    } catch (e) { ok = false; }
    if (!ok) continue;
    const dn = '戰鬥 ' + (n + 1);
    out.push({
      id: 'self' + n, kind: 'self', slot: n, practice: true, lvHint: 1,   // 自己的陣地不受等級過濾
      name: s.name && s.name !== dn ? s.name : '〔你的陣地 ' + (n + 1) + '〕'
    });
  }
  return out;
}

function poolPrefabEntries() {
  return POOL_PREFABS.map(p => ({ id: p.id, kind: 'prefab', tpl: p.tpl, name: p.name, lvHint: p.lvHint, practice: false }));
}

// 全池(未過濾等級)
function poolAll() {
  let list = poolSelfEntries().concat(poolPrefabEntries());
  const lv = poolLv();
  poolProviders.forEach(f => {
    try { (f(lv) || []).forEach(e => { if (e && e.id) list.push(e); }); } catch (err) { console.warn('[pool] provider', err); }
  });
  return list;
}

// 依玩家等級過濾;池中只剩自己的陣地時補預製第一座
function poolEligible(lv) {
  const L = lv != null ? lv : poolLv();
  let list = poolAll().filter(e => e.lvHint <= L + POOL_LV_AHEAD);
  if (!list.some(e => e.kind !== 'self')) list = list.concat(poolPrefabEntries().slice(0, 1));
  return list;
}

// 難度 0~2:陣地適合等級比玩家高越多越難
function poolDiffOf(entry, lv) {
  if (entry.kind === 'self') return 1;
  const L = lv != null ? lv : poolLv();
  return Math.max(0, Math.min(2, (entry.lvHint | 0) - L + 1));
}

// 目標等級 T(獎勵公式用):自己 = 玩家等級,其餘 = lvHint
function poolTargetLv(entry, lv) {
  return entry.kind === 'self' ? Math.max(1, lv != null ? lv : poolLv()) : Math.max(1, entry.lvHint | 0);
}

function poolNameOf(entry, seed) {
  if (entry.kind === 'self') return entry.name;
  return POOL_NAMES[hashStr(entry.id + ':' + (seed >>> 0)) % POOL_NAMES.length];
}

// 加權抽取:先依 POOL_WEIGHTS 決定類別(只計有條目的類別),再在類別內均勻抽;同 seed 決定性
function poolPick(list, sd) {
  const by = {};
  list.forEach(e => { (by[e.kind] = by[e.kind] || []).push(e); });
  const kinds = Object.keys(by).filter(k => by[k].length);
  let total = 0;
  kinds.forEach(k => { total += (POOL_WEIGHTS[k] != null ? POOL_WEIGHTS[k] : 10); });
  let u = (hashStr('poolcls:' + sd) % 100000) / 100000 * total, kind = kinds[kinds.length - 1];
  for (let i = 0; i < kinds.length; i++) {
    const w = POOL_WEIGHTS[kinds[i]] != null ? POOL_WEIGHTS[kinds[i]] : 10;
    if (u < w) { kind = kinds[i]; break; }
    u -= w;
  }
  const arr = by[kind];
  return arr[hashStr('pool:' + sd) % arr.length];
}

// 抽一個:seed 決定性;skipId 為「換一個」時排除的目前條目(池只剩 1 個時才允許重複)
// 回傳抽中描述:{ id, entry, lord(假玩家名), name(陣地名), lvHint, T, diff, practice, seed, stats }
function poolDraw(seed, lv, skipId) {
  const L = lv != null ? lv : poolLv();
  let list = poolEligible(L);
  if (skipId && list.length > 1) list = list.filter(e => e.id !== skipId);
  const sd = seed >>> 0;
  const e = poolPick(list, sd);
  return poolDescribe(e, sd, L);
}

function poolDescribe(e, seed, lv) {
  const L = lv != null ? lv : poolLv();
  const self = e.kind === 'self';
  return {
    id: e.id, entry: e, seed: seed >>> 0, kind: e.kind, practice: !!e.practice, name: e.name,
    lord: self ? '你自己' : poolNameOf(e, seed), lvHint: e.lvHint, T: poolTargetLv(e, L), diff: poolDiffOf(e, L),
    stats: poolStats(e)
  };
}

function poolObjList(e) {
  if (e.kind === 'self') {
    const s = world.layoutSlots.camp[e.slot];
    return s && s.board ? (s.board.objects || []).map(o => o.type) : [];
  }
  if (e.kind === 'prefab') {
    const t = TEMPLATES.find(v => v.id === e.tpl);
    const list = [];
    if (t) (t.objects || []).forEach(o => { tplCells(o).forEach(() => list.push(o.type)); });
    return list;
  }
  return typeof e.types === 'function' ? e.types() : (e.types || []);
}

// 縮略資訊:物件數(不含陷阱與偵察看不到的)、牆數、塔數
function poolStats(e) {
  let objs = 0, walls = 0, towers = 0;
  poolObjList(e).forEach(t => {
    const d = OBJECTS[t];
    if (!d) return;
    const cat = (d.cb && d.cb.cat) || '';
    if (cat === 'trap') return;
    if (typeof scoutVisible === 'function' && !scoutVisible(t)) return;
    objs++;
    if (cat === 'wall') walls++;
    else if (cat === 'defense') towers++;
  });
  return { objs: objs, walls: walls, towers: towers };
}

// 載入為戰鬥地圖(前提:game.backup 已存在且 game.mode === 'attack'),回傳 boardJSON(gar:null = 守軍依建築預設);失敗回 null
function poolLoadIntoWorld(e) {
  if (!game.backup || game.mode !== 'attack') {
    console.warn('[pool] ' + e.id + ': 需在 boardBackup() 後且 mode 為 attack 時載入');
    return null;
  }
  if (e.kind === 'self') {
    const s = world.layoutSlots.camp[e.slot];
    if (!s || !s.board) return null;
    const j = JSON.parse(JSON.stringify(s.board));
    j.gar = null;
    return j;
  }
  if (e.kind === 'prefab') {
    const t = TEMPLATES.find(v => v.id === e.tpl);
    if (!t) return null;
    const fails = npcBuildBoard(t, [], null, []);
    if (fails.length) console.warn('[pool] ' + e.id + ': ' + fails.length + ' failed', fails.slice(0, 20).join(' '));
    const j = boardToJSON(world);
    j.gar = null;
    return j;
  }
  if (typeof e.loadJson === 'function') {
    const j = e.loadJson();
    if (j) j.gar = j.gar || null;
    return j || null;
  }
  return null;
}

// ---- 戰陣模塊庫提供者(js/progmod.js;沒載入該檔時回傳空陣列)----
// 玩家等級 ±2 的模塊(progModList 已依等級過濾),每筆當作一位「玩家」的陣地;假玩家名依 poolNameOf 的名字池;lvHint = 模塊等級
function poolModProvider(lv) {
  if (typeof progModList !== 'function' || typeof PROGMOD_ARCH === 'undefined') return [];
  return progModList(lv).map(m => {
    const a = progModArch(m.arch);
    let types = null;
    return {
      id: 'mod:' + m.id, kind: 'gen', mod: m.id, name: a ? a.name : m.id, lvHint: m.lv, practice: false,
      types: () => types || (types = progModBuild(m).objects.map(o => o.type)),
      loadJson: () => progModBoard(m)
    };
  });
}
poolProviders.push(poolModProvider);
