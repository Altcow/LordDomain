// 科研院與科技（PLAN_TECH.md）：資料表＋研發邏輯＋效果查詢。依賴 map.js 的 world / canAfford / spend / gain / dealCache
const LAB_TYPE = 'research';
const TECH_TREES = { mil: '軍事', eco: '經濟' };
// 階：time 研發秒數；cost 一般節點成本（兵種解鎖節點以 TECHS[id].cost 覆寫）
const TECH_TIER = {
  1: { name: '一階', time: 300,   cost: { coin: 120,   wood: 25,   stone: 15 } },
  2: { name: '二階', time: 900,   cost: { coin: 400,   wood: 75,   stone: 50 } },
  3: { name: '三階', time: 2700,  cost: { coin: 1200,  wood: 225,  stone: 150 } },
  4: { name: '四階', time: 8100,  cost: { coin: 4000,  wood: 750,  stone: 500 } },
  5: { name: '五階', time: 24300, cost: { coin: 12000, wood: 2250, stone: 1500 } }
};
// tree 所屬樹; tier 階; req 前置(全部完成才可研發); cost 覆寫成本; unlock 解鎖兵種 id(顯示用, 判斷以 TROOPS[t].needTech 為準)
// fx 效果: { type: 'pct', key, value } → techMul(key) = 1 + Σvalue;  { type: 'add', key, value } → techAdd(key) = Σvalue
const TECHS = {
  // ── 軍事 27 ──
  m_drill:    { tree: 'mil', tier: 1, icon: '🥁', name: '操練',     req: [],                          desc: '練兵與升階時間 −10%',          fx: [{ type: 'pct', key: 'train.time', value: -0.1 }] },
  m_buqu:     { tree: 'mil', tier: 2, icon: '🚩', name: '部曲',     req: ['m_drill'],                 desc: '每座盾兵營容量 +20',           fx: [{ type: 'add', key: 'camp.cap.shield', value: 20 }] },
  m_nu:       { tree: 'mil', tier: 2, icon: '🔩', name: '弩機',     req: ['m_drill'],                 desc: '每座弓箭營容量 +16',           fx: [{ type: 'add', key: 'camp.cap.archer', value: 16 }] },
  m_horse:    { tree: 'mil', tier: 2, icon: '🐴', name: '馬政',     req: ['m_drill'],                 desc: '每座騎兵營容量 +10',           fx: [{ type: 'add', key: 'camp.cap.cavalry', value: 10 }] },
  m_med:      { tree: 'mil', tier: 2, icon: '🌿', name: '醫術',     req: ['m_drill'],                 desc: '傷兵治療時間 −25%',            fx: [{ type: 'pct', key: 'heal.time', value: -0.25 }] },
  u_shield2:  { tree: 'mil', tier: 2, icon: '🛡️', name: '刀盾兵',   req: ['m_drill'],                 desc: '解鎖 盾 Lv2 招募與升階', unlock: 'shield2',   cost: { coin: 750,   wood: 250,  stone: 100 },  fx: [] },
  u_archer2:  { tree: 'mil', tier: 2, icon: '🏹', name: '弓兵',     req: ['m_drill'],                 desc: '解鎖 弓 Lv2 招募與升階', unlock: 'archer2',   cost: { coin: 600,   wood: 320 },               fx: [] },
  u_cavalry2: { tree: 'mil', tier: 2, icon: '🐎', name: '輕騎',     req: ['m_horse'],                 desc: '解鎖 騎 Lv2 招募與升階', unlock: 'cavalry2',  cost: { coin: 1130,  wood: 250,  stone: 100 },  fx: [] },
  u_siege2:   { tree: 'mil', tier: 2, icon: '🏹', name: '床弩',     req: ['m_nu'],                    desc: '解鎖 器械 Lv2 招募與升階', unlock: 'siege2',  cost: { coin: 540,   wood: 300,  stone: 120 },  fx: [] },
  m_iron:     { tree: 'mil', tier: 3, icon: '⚒️', name: '冶鐵',     req: ['u_shield2'],               desc: '升階費用 −10%',                fx: [{ type: 'pct', key: 'promo.cost', value: -0.1 }] },
  m_bingfa:   { tree: 'mil', tier: 3, icon: '📖', name: '孫吳兵法', req: ['u_shield2', 'u_archer2'],  desc: '我軍傷害 +5%',                 fx: [{ type: 'pct', key: 'army.dmg', value: 0.05 }] },
  m_gongshu:  { tree: 'mil', tier: 3, icon: '🪚', name: '公輸',     req: ['m_iron', 'u_siege2'],      desc: '器械營容量 +2 台',             fx: [{ type: 'add', key: 'camp.cap.siege', value: 2 }] },
  u_shield3:  { tree: 'mil', tier: 3, icon: '🔱', name: '長戟兵',   req: ['u_shield2', 'm_iron'],     desc: '解鎖 盾 Lv3 招募與升階', unlock: 'shield3',   cost: { coin: 1800,  wood: 600,  stone: 230 },  fx: [] },
  u_archer3:  { tree: 'mil', tier: 3, icon: '🎯', name: '弩手',     req: ['u_archer2', 'm_nu'],       desc: '解鎖 弓 Lv3 招募與升階', unlock: 'archer3',   cost: { coin: 1440,  wood: 780 },               fx: [] },
  u_cavalry3: { tree: 'mil', tier: 3, icon: '🏇', name: '突騎',     req: ['u_cavalry2', 'm_iron'],    desc: '解鎖 騎 Lv3 招募與升階', unlock: 'cavalry3',  cost: { coin: 2700,  wood: 600,  stone: 230 },  fx: [] },
  u_siege3:   { tree: 'mil', tier: 3, icon: '⚙️', name: '連弩車',   req: ['u_siege2', 'm_gongshu'],   desc: '解鎖 器械 Lv3 招募與升階', unlock: 'siege3',  cost: { coin: 1300,  wood: 720,  stone: 290 },  fx: [] },
  m_steel:    { tree: 'mil', tier: 4, icon: '🗡️', name: '百煉鋼',   req: ['m_iron', 'm_bingfa'],      desc: '我軍傷害 +5%',                 fx: [{ type: 'pct', key: 'army.dmg', value: 0.05 }] },
  m_mafei:    { tree: 'mil', tier: 4, icon: '🍵', name: '麻沸散',   req: ['m_med', 'm_iron'],         desc: '治療費 −40%、床位不足時不治率減半', fx: [{ type: 'pct', key: 'heal.cost', value: -0.4 }, { type: 'pct', key: 'hosp.die', value: -0.5 }] },
  u_shield4:  { tree: 'mil', tier: 4, icon: '⚔️', name: '鐵衛',     req: ['u_shield3', 'm_steel'],    desc: '解鎖 盾 Lv4 招募與升階', unlock: 'shield4',   cost: { coin: 3800,  wood: 1300, stone: 500 },  fx: [] },
  u_archer4:  { tree: 'mil', tier: 4, icon: '🎯', name: '強弩手',   req: ['u_archer3', 'm_steel'],    desc: '解鎖 弓 Lv4 招募與升階', unlock: 'archer4',   cost: { coin: 3040,  wood: 1600 },              fx: [] },
  u_cavalry4: { tree: 'mil', tier: 4, icon: '🏇', name: '屯騎',     req: ['u_cavalry3', 'm_steel'],   desc: '解鎖 騎 Lv4 招募與升階', unlock: 'cavalry4',  cost: { coin: 5750,  wood: 1300, stone: 500 },  fx: [] },
  u_siege4:   { tree: 'mil', tier: 4, icon: '🪨', name: '發石車',   req: ['u_siege3', 'm_steel'],     desc: '解鎖 器械 Lv4 招募與升階', unlock: 'siege4',  cost: { coin: 2770,  wood: 1540, stone: 610 },  fx: [] },
  m_beijun:   { tree: 'mil', tier: 5, icon: '🎌', name: '北軍五校', req: ['m_steel'],                 desc: '戰後陣亡 −15%(轉為傷兵)',      fx: [{ type: 'pct', key: 'cas.dead', value: -0.15 }] },
  u_shield5:  { tree: 'mil', tier: 5, icon: '🐯', name: '虎賁玄甲',   req: ['u_shield4', 'm_beijun'],   desc: '解鎖 盾 Lv5 招募與升階', unlock: 'shield5',   cost: { coin: 7600,  wood: 2500, stone: 1000 }, fx: [] },
  u_archer5:  { tree: 'mil', tier: 5, icon: '🦅', name: '射聲神弩',   req: ['u_archer4', 'm_beijun'],   desc: '解鎖 弓 Lv5 招募與升階', unlock: 'archer5',   cost: { coin: 6100,  wood: 3300 },              fx: [] },
  u_cavalry5: { tree: 'mil', tier: 5, icon: '🐲', name: '羽林鐵騎',   req: ['u_cavalry4', 'm_beijun'],  desc: '解鎖 騎 Lv5 招募與升階', unlock: 'cavalry5',  cost: { coin: 11500, wood: 2560, stone: 1000 }, fx: [] },
  u_siege5:   { tree: 'mil', tier: 5, icon: '⚡', name: '霹靂雷車',   req: ['u_siege4', 'm_beijun'],    desc: '解鎖 器械 Lv5 招募與升階', unlock: 'siege5',  cost: { coin: 5530,  wood: 3080, stone: 1230 }, fx: [] },
  // ── 經濟 20 ──
  e_tuntian:  { tree: 'eco', tier: 1, icon: '🌾', name: '屯田',     req: [],                          desc: '民房產出 +10%',                fx: [{ type: 'pct', key: 'prod.house', value: 0.1 }] },
  e_yuheng:   { tree: 'eco', tier: 2, icon: '🪓', name: '虞衡',     req: ['e_tuntian'],               desc: '伐木場產出 +20%',              fx: [{ type: 'pct', key: 'prod.lumber', value: 0.2 }] },
  e_shigong:  { tree: 'eco', tier: 2, icon: '⛏️', name: '石工',     req: ['e_tuntian'],               desc: '採石場產出 +20%',              fx: [{ type: 'pct', key: 'prod.quarry', value: 0.2 }] },
  e_shiling:  { tree: 'eco', tier: 2, icon: '🏪', name: '市令',     req: ['e_tuntian'],               desc: '市集產出 +15%',                fx: [{ type: 'pct', key: 'prod.market', value: 0.15 }] },
  e_dongguan: { tree: 'eco', tier: 2, icon: '📚', name: '東觀校書', req: ['e_tuntian'],               desc: '之後的研發時間 −10%',          fx: [{ type: 'pct', key: 'research.time', value: -0.1 }] },
  e_yizhan:   { tree: 'eco', tier: 2, icon: '📮', name: '郵驛',     req: ['e_tuntian'],               desc: '離線累積上限 +2 小時',         fx: [{ type: 'add', key: 'offline.cap', value: 7200 }] },
  e_suanchou: { tree: 'eco', tier: 3, icon: '🧮', name: '算籌',     req: ['e_shiling'],               desc: '商店買價 −10%',                fx: [{ type: 'pct', key: 'shop.buy', value: -0.1 }] },
  e_jiangzuo: { tree: 'eco', tier: 3, icon: '📐', name: '將作',     req: ['e_yuheng', 'e_shigong'],   desc: '建築成本 −10%、待購上限 +100', fx: [{ type: 'pct', key: 'build.cost', value: -0.1 }, { type: 'add', key: 'pend.max', value: 100 }] },
  e_daitian:  { tree: 'eco', tier: 3, icon: '🌱', name: '代田法',   req: ['e_yuheng'],                desc: '民房產出 +15%',                fx: [{ type: 'pct', key: 'prod.house', value: 0.15 }] },
  e_tieguan:  { tree: 'eco', tier: 3, icon: '🔨', name: '鐵官',     req: ['e_yuheng', 'e_shigong'],   desc: '伐木場、採石場產出 +20%',      fx: [{ type: 'pct', key: 'prod.lumber', value: 0.2 }, { type: 'pct', key: 'prod.quarry', value: 0.2 }] },
  e_changping:{ tree: 'eco', tier: 3, icon: '🏛️', name: '常平倉',   req: ['e_yizhan'],                desc: '離線效率 +5%(50%→55%)',        fx: [{ type: 'add', key: 'offline.rate', value: 0.05 }] },
  e_junshu:   { tree: 'eco', tier: 4, icon: '🛒', name: '均輸',     req: ['e_suanchou'],              desc: '商店賣價 +50%',                fx: [{ type: 'pct', key: 'shop.sell', value: 0.5 }] },
  e_pingzhun: { tree: 'eco', tier: 4, icon: '⚖️', name: '平準',     req: ['e_suanchou'],              desc: '每日特賣價格 −10%',            fx: [{ type: 'pct', key: 'deal.price', value: -0.1 }] },
  e_wuzhu:    { tree: 'eco', tier: 4, icon: '🪙', name: '五銖錢',   req: ['e_shiling', 'e_suanchou'], desc: '市集產出 +20%',                fx: [{ type: 'pct', key: 'prod.market', value: 0.2 }] },
  e_caoyun:   { tree: 'eco', tier: 4, icon: '⛵', name: '漕運',     req: ['e_changping'],             desc: '離線累積上限 +2 小時',         fx: [{ type: 'add', key: 'offline.cap', value: 7200 }] },
  e_dajiang:  { tree: 'eco', tier: 4, icon: '🏗️', name: '將作大匠', req: ['e_jiangzuo', 'e_tieguan'], desc: '建築成本再 −10%',              fx: [{ type: 'pct', key: 'build.cost', value: -0.1 }] },
  e_hushi:    { tree: 'eco', tier: 5, icon: '🤝', name: '互市',     req: ['e_pingzhun', 'e_junshu'],  desc: '每日特賣每件限購 +1',          fx: [{ type: 'add', key: 'deal.limit', value: 1 }] },
  e_shiyi:    { tree: 'eco', tier: 5, icon: '🏯', name: '食邑',     req: ['e_daitian', 'e_wuzhu'],    desc: '城主府產出 +30%',              fx: [{ type: 'pct', key: 'prod.palace', value: 0.3 }] },
  e_taicang:  { tree: 'eco', tier: 5, icon: '📦', name: '太倉',     req: ['e_caoyun'],                desc: '離線效率 +5%(55%→60%)',        fx: [{ type: 'add', key: 'offline.rate', value: 0.05 }] },
  e_yantie:   { tree: 'eco', tier: 5, icon: '🧂', name: '鹽鐵官營', req: ['e_tieguan', 'e_wuzhu'],   desc: '所有建築產出 +10%',            fx: [{ type: 'pct', key: 'prod.all', value: 0.1 }] }
};

let techSet = {};                      // 已研發 id → true（由 world.tech.done 重建）
let techFx = { pct: {}, add: {} };     // 效果快取
let techOfflineDone = '';              // applyOfflineGains 內完成的研發 id（給 UI 顯示一次後清空）

function techRebuild() {
  techSet = {};
  techFx = { pct: {}, add: {} };
  world.tech.done.forEach(id => {
    const T = TECHS[id];
    if (!T) return;
    techSet[id] = true;
    T.fx.forEach(f => {
      const m = f.type === 'add' ? techFx.add : techFx.pct;
      m[f.key] = (m[f.key] || 0) + f.value;
    });
  });
}

function techHas(id) { return techSet[id] === true; }
function techMul(key) { return Math.max(0.1, 1 + (techFx.pct[key] || 0)); }
function techAdd(key) { return techFx.add[key] || 0; }
function techAvailable(id) { const T = TECHS[id]; return !!T && T.req.every(techHas); }
function techCost(id) { const T = TECHS[id]; return T.cost || TECH_TIER[T.tier].cost; }
function techTime(id) { return Math.ceil(TECH_TIER[TECHS[id].tier].time * techMul('research.time')); }
function labBuilt() { return estateObjects().some(o => o.type === LAB_TYPE); }

// '' = 可研發；否則回傳原因字串
function canResearch(id) {
  if (!isUnlocked('tech', id)) return '尚未開放';
  const T = TECHS[id];
  if (!T) return '未知科技';
  if (techHas(id)) return '已研發';
  if (world.tech.cur) return '正在研發「' + TECHS[world.tech.cur.id].name + '」';
  if (!labBuilt()) return '需要科研院';
  const miss = T.req.filter(r => !techHas(r));
  if (miss.length) return '需先研發 ' + miss.map(r => TECHS[r].name).join('、');
  if (!canAfford(techCost(id))) return '資源不足';
  return '';
}

function startResearch(id) {
  const why = canResearch(id);
  if (why) return why;
  spend(techCost(id));
  const t = techTime(id);
  world.tech.cur = { id: id, left: t, total: t };
  return '';
}

// 取消：全額退還、進度歸零。回傳被取消的 id（無則 ''）
function cancelResearch() {
  const c = world.tech.cur;
  if (!c) return '';
  gain(techCost(c.id), 1);
  world.tech.cur = null;
  return c.id;
}

// 推進研發；無科研院時暫停（進度保留）。完成回傳 id，否則 ''
function tickResearch(dt) {
  const c = world.tech.cur;
  if (!c || !(dt > 0) || !labBuilt()) return '';
  c.left -= dt;
  if (c.left > 0) return '';
  world.tech.cur = null;
  if (!techHas(c.id)) world.tech.done.push(c.id);
  techRebuild();
  dealCache = null;
  return c.id;
}

// 離線：與資源同一個 sec（已受 offlineCapSec 限制），全速；一次最多完成 1 項
function applyOfflineResearch(sec) { return tickResearch(sec); }

function techReset() {
  world.tech = { done: [], cur: null };
  techRebuild();
  dealCache = null;
}

function normTech(v) {
  const out = { done: [], cur: null };
  if (!v || typeof v !== 'object') return out;
  (Array.isArray(v.done) ? v.done : []).forEach(id => {
    if (typeof id === 'string' && TECHS[id] && out.done.indexOf(id) < 0) out.done.push(id);
  });
  const c = v.cur;
  if (c && typeof c === 'object' && TECHS[c.id] && out.done.indexOf(c.id) < 0 &&
      typeof c.total === 'number' && isFinite(c.total) && c.total > 0 &&
      typeof c.left === 'number' && isFinite(c.left)) {
    out.cur = { id: c.id, left: Math.max(0, Math.min(c.left, c.total)), total: c.total };
  }
  return out;
}

// ── 效果套用輔助（map.js / ui.js 呼叫）──
function objCost(type) {
  const c = OBJECTS[type].cost, m = techMul('build.cost'), r = {};
  for (const k in c) r[k] = Math.ceil(c[k] * m - 1e-9);
  return r;
}
function shopPrice(kind, mode) {
  const s = SHOP[kind];
  return mode === 'buy' ? Math.ceil(s.buy * SHOP_LOT * techMul('shop.buy') - 1e-9) : Math.floor(s.sell * SHOP_LOT * techMul('shop.sell') + 1e-9);
}
function offlineCapSec() { return OFFLINE_CAP_SEC + techAdd('offline.cap'); }
function offlineRate() { return OFFLINE_RATE + techAdd('offline.rate'); }
function pendMax() { return PEND_MAX + techAdd('pend.max'); }
