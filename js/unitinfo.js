// unitinfo.js — 兵種說明(圖鑑、說明卡、戰鬥小氣泡共用)
// 全部由 UNITS 即時推導,不寫死數字:放置單位的數值取 UNIT_PLACE_STAT(或 UNITS[k].place),
// 地形取 TERRAIN_BONUS、克制取 COUNTER / TD_COMBAT、守軍取 BUILD_COMBAT;缺表時以 typeof 守衛退回通用文字。
// 純函式:unitInfo(id)、unitBubbleText(id)、unitDexGroups();DOM(僅瀏覽器):unitCardOpen(id)、unitDexOpen()。
// 依賴:units.js(UNITS 必要)、battleui.js 的 UNIT_ICON(圖示,缺則用通用字)、prog.js 的 progUnlockLv / progLv(開放等級,缺則視為開放)。

const UI_ROLE = { shield: '盾兵', archer: '弓手', cavalry: '騎兵', siege: '器械' };
const UI_PROFILE = {
  foot: '步兵:能攀越高差 1 層的陡坡',
  horse: '騎兵:不能攀爬,只走平路與緩坡',
  heavy: '器械:不能攀爬,行動緩慢,地形影響大'
};
// 目標偏好首位的白話說明(與 units.js TARGET_CLASSES 十種一一對應)
const UI_PREF = {
  core: '優先攻擊帥帳',
  defense: '優先攻擊防禦建築(箭樓、弩台)',
  resource: '優先搶資源(輜重車)',
  storage: '優先攻擊糧囤(倉庫)',
  barracks: '優先攻擊屯兵營與將旗',
  house: '優先搶民房(營帳)',
  wall: '優先破牆與城門',
  trap: '優先觸發已揭露的機關',
  unit: '優先攻擊敵方單位',
  any: '依距離攻擊最近的一般建築'
};
const UI_PREF_SHORT = {
  core: '帥帳', defense: '防禦建築', resource: '輜重', storage: '糧囤', barracks: '屯兵營與將旗',
  house: '民房營帳', wall: '城牆城門', trap: '機關', unit: '敵軍', any: '一般建築'
};
// 沒有 habitText 時,名號由目標偏好首位生成
const UI_NICK = {
  core: '直取帥帳', defense: '專打箭樓', resource: '專搶輜重', storage: '專劫糧倉', barracks: '直攻營壘',
  house: '見帳就搶', wall: '專破城牆', trap: '專踩機關', unit: '追獵敵兵', any: '穩步推進'
};
const UI_STAT_KEYS = ['hp', 'atk', 'aspd', 'dps', 'def', 'range', 'spd'];
const UI_STAT_LABEL = { hp: '兵力', atk: '每擊傷害', aspd: '攻速', dps: '平均傷害', def: '防禦', range: '射程', spd: '移速' };
const UI_STAR_WORD = {
  hp: ['極脆', '脆弱', '中等', '耐打', '極耐打'],
  atk: ['極輕', '較輕', '中等', '較重', '極重'],
  aspd: ['很慢', '慢', '中等', '快', '很快'],
  dps: ['極低', '偏低', '中等', '偏高', '極高'],
  def: ['極薄', '較薄', '中等', '厚實', '極厚'],
  range: ['近身', '短程', '中程', '遠程', '極遠'],
  spd: ['極慢', '偏慢', '中等', '偏快', '極快']
};
const UI_TAG = { plain: '平地', road: '道路', slope: '斜坡', hill: '丘陵', high: '高地', wall: '城牆', forest: '林地', gorge: '峽谷', shore: '岸邊', shallow: '淺水' };
const UI_TAG_KEY = { atk: '攻', dmgIn: '受傷', spd: '速' };
const UI_TIP_CLS = {
  shield: '站在前排擋住敵軍,適合護衛弓手與器械。',
  archer: '放在盾兵後方,遠距離消耗敵軍。',
  cavalry: '適合繞後劫掠,避開弓手與器械的射程。',
  siege: '射程遠但笨重,需要盾兵保護側翼。'
};
const UI_EN_FAC = ['yellow', 'bandit', 'hu', 'pirate', 'both'];

// 單位數值:放置單位優先取 UNIT_PLACE_STAT(個體屬性),否則取 UNITS 基準值
// atk = 每擊傷害;cd = 攻擊間隔秒(放置與守軍共用 UNITS.cd);aspd = 每秒出手次數;dps = atk ÷ cd(平均傷害)
function uiStat(id) {
  const d = UNITS[id];
  const p = (typeof UNIT_PLACE_STAT !== 'undefined' && UNIT_PLACE_STAT[id]) || d.place || null;
  const cd = d.cd > 0 ? d.cd : 1;
  const atk = p ? p.atk : d.atk;
  const base = { cd: cd, aspd: 1 / cd, dps: atk / cd };
  if (!p) return Object.assign({ hp: d.hp, atk: d.atk, def: d.def, range: d.range, spd: d.spd, pop: d.pop, placed: false }, base);
  return Object.assign({ hp: p.hp, atk: p.atk, def: p.def, range: d.range, spd: d.spd, pop: p.pop, placed: true }, base);
}
// 同一池(放置 / 非放置)內的相對星等 1~5:以名次百分比換算,同值者並列
function uiStar(key, id, placed) {
  const pool = Object.keys(UNITS).filter(k => uiStat(k).placed === placed);
  if (pool.length < 2) return 3;
  const v = uiStat(id)[key];
  let below = 0, same = 0;
  pool.forEach(k => { const x = uiStat(k)[key]; if (x < v) below++; else if (x === v) same++; });
  const pct = (below + (same - 1) / 2) / (pool.length - 1);
  return Math.max(1, Math.min(5, 1 + Math.round(pct * 4)));
}
function uiRound(v) { return Math.round(v * 10) / 10; }
function uiStatValue(key, s) {
  if (key === 'range') return uiRound(s.range) + ' 格';
  if (key === 'aspd') return '每 ' + uiRound(s.cd) + ' 秒一擊';
  if (key === 'dps') return uiRound(s.dps) + ' /秒';
  return String(uiRound(s[key]));
}
function uiStatRow(key, id, s) {
  const star = uiStar(key, id, s.placed);
  return { label: UI_STAT_LABEL[key], value: uiStatValue(key, s), star: star, word: UI_STAR_WORD[key][star - 1] };
}
// 出手與每擊的一句白話(由星等推導):力大出手慢 / 出手快每擊輕 等
function uiStyleText(stats) {
  const h = stats.atk.star, a = stats.aspd.star;
  if (h >= 4 && a <= 2) return '力大無窮但出手慢,每一擊很重' + (stats.dps.star >= 4 ? ';平均傷害也在高段。' : stats.dps.star <= 2 ? ';平均傷害偏低。' : ';平均傷害中等。');
  if (h <= 2 && a >= 4) return '出手快、每一擊輕,靠連綿不絕的攻勢取勝。';
  if (h >= 4 && a >= 4) return '每擊重又出手快,攻勢凌厲。';
  if (h <= 2 && a <= 2) return '每擊輕又出手慢,攻擊力偏弱。';
  return '每擊與出手節奏均衡。';
}

// 目標偏好白話:首位說明 + 其次(其餘類別);resource+storage 合併為「優先搶資源與倉庫」
function uiPrefText(prefs) {
  const p = prefs || [];
  if (!p.length) return '依距離攻擊最近目標';
  let head, rest;
  if (p[0] === 'resource' && p[1] === 'storage') { head = '優先搶資源與倉庫'; rest = p.slice(2); }
  else { head = UI_PREF[p[0]] || '依距離攻擊最近目標'; rest = p.slice(1); }
  if (!rest.length) return head;
  return head + ';其次' + rest.map(k => UI_PREF_SHORT[k] || '其他目標').join('、');
}

// 地形加成(由 TERRAIN_BONUS[cls] 推導):取影響最大的三種地形
function uiTerrainText(cls) {
  const T = typeof TERRAIN_BONUS !== 'undefined' ? TERRAIN_BONUS[cls] : null;
  if (!T) return '';
  const rows = [];
  Object.keys(T).forEach(tag => {
    const e = T[tag] || {};
    const parts = [];
    let mag = 0;
    ['atk', 'dmgIn', 'spd'].forEach(k => {
      if (!e[k]) return;
      parts.push(UI_TAG_KEY[k] + (e[k] > 0 ? '+' : '−') + Math.round(Math.abs(e[k]) * 100) + '%');
      mag += Math.abs(e[k]);
    });
    if (parts.length && UI_TAG[tag]) rows.push({ name: UI_TAG[tag], text: parts.join(' '), mag: mag });
  });
  if (!rows.length) return '';
  rows.sort((a, b) => b.mag - a.mag);
  return '地形:' + rows.slice(0, 3).map(r => r.name + '(' + r.text + ')').join('、');
}

// 特性清單(每項一句白話)
function uiTraits(d) {
  const t = [];
  if (UI_PROFILE[d.profile]) t.push(UI_PROFILE[d.profile]);
  if (d.cautious) t.push('謹慎:不主動衝入,遇敵先停頓觀望');
  if (d.charge) t.push('衝鋒:從高處往低處衝下後,下一擊傷害 ×' + d.charge);
  if (d.scout) t.push('探路:半徑 ' + d.scout + ' 格內揭露隱藏的建築與機關');
  if (d.trapTaken != null) t.push('破陷:踩到機關時傷害只剩 ' + Math.round(d.trapTaken * 100) + '%');
  if (d.minRange) t.push('近身死角:' + d.minRange + ' 格內打不到');
  if (d.aoe) t.push('範圍傷害:落點 ' + uiRound(d.aoe) + ' 格內波及,最多 ' + (d.aoeMax || 1) + ' 個目標' + (d.splash != null ? '(波及傷害 ×' + d.splash + ')' : ''));
  if (d.ignoreTroops) t.push('不理守軍:路上有守軍也不停下,直奔目標');
  if (d.bldOther != null) t.push('建築傷害:打城牆以外的建築只有 ' + Math.round(d.bldOther * 100) + '%');
  if (d.swim) t.push('涉水:能從水路摸上岸');
  if (d.aura) t.push('光環:半徑 ' + d.aura.r + ' 格內友軍攻擊 +' + Math.round(d.aura.atk * 100) + '%');
  if (d.boss) t.push('具名首領:戰力遠高於一般兵');
  const terr = uiTerrainText(d.cls);
  if (terr) t.push(terr);
  return t;
}

// 克制與被克(由 COUNTER 與 TD_COMBAT 推導;與 counterMul 同一規則)
function uiCounter(d) {
  const up = typeof TD_COMBAT !== 'undefined' && TD_COMBAT.counterUp != null ? 1 + TD_COMBAT.counterUp : 1.5;
  const down = typeof TD_COMBAT !== 'undefined' && TD_COMBAT.counterDown != null ? 1 - TD_COMBAT.counterDown : 0.5;
  const C = typeof COUNTER !== 'undefined' ? COUNTER : {};
  const beats = C[d.cls] || [];
  const beaten = Object.keys(C).filter(k => (C[k] || []).indexOf(d.cls) >= 0);
  const nm = c => UI_ROLE[c] || c;
  let strong = beats.length
    ? '克制:對' + beats.map(nm).join('、') + '造成 ×' + uiRound(up) + ' 傷害,受其攻擊只剩 ×' + uiRound(down)
    : '克制:沒有明顯克制的兵種';
  let weak = beaten.length
    ? '被克:遇' + beaten.map(nm).join('、') + '時,我方只造成 ×' + uiRound(down) + ' 傷害,受其攻擊 ×' + uiRound(up)
    : '被克:沒有明顯被克的兵種';
  if (d.vs) Object.keys(d.vs).forEach(k => { strong += ';對' + nm(k) + '另 ×' + uiRound(d.vs[k]); });
  if (d.def <= 2) weak += '(本身防禦低,近身易潰)';
  if (d.hp >= 150) strong += '(本身耐打)';
  return { strong: strong, weak: weak };
}

// 使用建議:依特徵挑一句,無特徵則依兵科(s 為 uiStat 結果,供重擊慢速判斷)
function uiTip(d, s) {
  const pref = (d.targetPrefs || [])[0];
  if (d.scout) return '先放一隊斥候探路,找出機關與隱藏建築後再放主力。';
  if (d.minRange) return '近身有死角,請讓盾兵或弓手護在前面。';
  if (pref === 'defense') return '會先拔除箭樓與弩台,為後續主力開路。';
  if (pref === 'unit') return '會先找敵方單位下手,適合清掃外圍的弓手與騎兵。';
  if (d.cautious) return '單獨放會停頓,宜與盾兵同一路推進。';
  if (d.charge) return '從高處往低處放,衝鋒的第一擊最痛。';
  if (d.ignoreTroops) return '不理守軍直衝目標,守軍分散時最有效。';
  if (d.aoe) return '對密集的敵群最有效,少放在單打獨鬥的目標上。';
  if (s && s.cd >= 2.5 && s.atk >= 20) return '每擊重、出手慢,適合擋在前面吸收攻擊' + (pref === 'wall' ? '並破牆。' : '。');
  return UI_TIP_CLS[d.cls] || '依情況搭配使用。';
}

// 單一兵種的完整說明;id 不存在回傳 null
function unitInfo(id) {
  const d = typeof UNITS !== 'undefined' ? UNITS[id] : null;
  if (!d) return null;
  const s = uiStat(id);
  const cw = uiCounter(d);
  const stats = {};
  UI_STAT_KEYS.forEach(k => { stats[k] = uiStatRow(k, id, s); });
  return {
    style: uiStyleText(stats),
    id: id,
    name: d.name,
    nick: d.habitText || UI_NICK[(d.targetPrefs || [])[0]] || '穩步推進',
    habit: d.habitText || null,
    role: UI_ROLE[d.cls] || d.cls || '兵種',
    fac: d.fac,
    placed: s.placed,
    pop: s.pop,
    stats: stats,
    prefText: uiPrefText(d.targetPrefs),
    traits: uiTraits(d),
    strong: cw.strong,
    weak: cw.weak,
    tip: uiTip(d, s)
  };
}

// 戰鬥中點單位的小氣泡文字:名稱 ・ 名號(一行)
function unitBubbleText(id) {
  const I = unitInfo(id);
  return I ? I.name + ' ・ ' + I.nick : String(id);
}

// 圖鑑分類:我方(han、both)、敵方(黃巾、山賊、胡、水賊、both)、守軍(BUILD_COMBAT 駐軍 + npc)
function unitDexGroups() {
  const ids = Object.keys(UNITS);
  const gar = {};
  if (typeof BUILD_COMBAT !== 'undefined') {
    Object.keys(BUILD_COMBAT).forEach(b => Object.keys(BUILD_COMBAT[b].garrison || {}).forEach(u => { gar[u] = true; }));
  }
  return [
    { key: 'han', label: '我方', ids: ids.filter(k => UNITS[k].fac === 'han' || UNITS[k].fac === 'both') },
    { key: 'enemy', label: '敵方', ids: ids.filter(k => UI_EN_FAC.indexOf(UNITS[k].fac) >= 0) },
    { key: 'garrison', label: '守軍', ids: ids.filter(k => gar[k] || UNITS[k].fac === 'npc') }
  ];
}

// ---- DOM(僅瀏覽器;node 測試不會呼叫)----
let uiMaskEl = null, uiCardEl = null, uiDexEl = null, uiDexTab = 'han';

function uiEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function uiLockLv(id) {
  return typeof progUnlockLv === 'function' ? progUnlockLv('unit', id) : null;
}
function uiLocked(id) {
  const L = uiLockLv(id);
  return L !== null && L !== undefined && L > (typeof progLv === 'function' ? progLv() : 1);
}
function uiIcon(id) {
  return (typeof UNIT_ICON !== 'undefined' && UNIT_ICON[id]) || '⚔';
}
function uiEnsure() {
  if (uiCardEl) return;
  uiMaskEl = uiEl('div', ''); uiMaskEl.id = 'unitCardMask'; uiMaskEl.hidden = true;
  uiMaskEl.addEventListener('click', unitCardClose);
  uiCardEl = uiEl('div', ''); uiCardEl.id = 'unitCard'; uiCardEl.hidden = true;
  uiCardEl.setAttribute('role', 'dialog'); uiCardEl.setAttribute('aria-label', '兵種說明');
  uiDexEl = uiEl('div', ''); uiDexEl.id = 'unitDex'; uiDexEl.hidden = true;
  uiDexEl.setAttribute('role', 'dialog'); uiDexEl.setAttribute('aria-label', '兵種圖鑑');
  uiDexEl.addEventListener('click', uiDexClick);
  document.body.appendChild(uiMaskEl);
  document.body.appendChild(uiCardEl);
  document.body.appendChild(uiDexEl);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!uiCardEl.hidden) unitCardClose();
    else if (!uiDexEl.hidden) uiDexClose();
  });
}
function uiSection(parent, title) {
  const sec = uiEl('div', 'uc-sec');
  sec.appendChild(uiEl('h4', '', title));
  parent.appendChild(sec);
  return sec;
}
function uiCardBuild(id) {
  const I = unitInfo(id);
  const wrap = uiEl('div', 'uc-wrap');
  const head = uiEl('div', 'uc-head');
  head.appendChild(uiEl('span', 'uc-ico', uiIcon(id)));
  const tt = uiEl('div', 'uc-tt');
  tt.appendChild(uiEl('b', '', I.name + '　' + I.nick));
  tt.appendChild(uiEl('small', '', I.role + ' · ' + (I.placed ? '人口 ' + I.pop : '非我軍放置')));
  head.appendChild(tt);
  const x = uiEl('button', 'uc-x', '✕');
  x.setAttribute('aria-label', '關閉');
  x.addEventListener('click', unitCardClose);
  head.appendChild(x);
  wrap.appendChild(head);

  const body = uiEl('div', 'uc-body');
  const top = uiEl('div', 'uc-top');
  const cv = document.createElement('canvas');
  cv.className = 'uc-prev';
  cv.width = 192; cv.height = 224;
  top.appendChild(cv);
  const meta = uiEl('div', 'uc-meta');
  meta.appendChild(uiEl('div', '', '職業:' + I.role));
  meta.appendChild(uiEl('div', '', '人口:' + I.pop + (I.placed ? '' : '(不佔我方人口)')));
  if (uiLocked(id)) meta.appendChild(uiEl('div', 'uc-lock', '🔒 Lv ' + uiLockLv(id) + ' 開放'));
  top.appendChild(meta);
  body.appendChild(top);

  const st = uiSection(body, '數值');
  st.appendChild(uiEl('p', '', I.style));
  UI_STAT_KEYS.forEach(k => {
    const r = I.stats[k];
    const row = uiEl('div', 'uc-stat');
    row.appendChild(uiEl('span', 'uc-sl', r.label));
    row.appendChild(uiEl('span', 'uc-sv', r.value));
    const bars = uiEl('span', 'uc-stars');
    for (let i = 1; i <= 5; i++) bars.appendChild(uiEl('i', i <= r.star ? 'on' : ''));
    row.appendChild(bars);
    row.appendChild(uiEl('span', 'uc-sw', r.word));
    st.appendChild(row);
  });

  uiSection(body, '目標偏好').appendChild(uiEl('p', '', I.prefText));
  const tr = uiSection(body, '特性');
  const ul = uiEl('ul', '');
  I.traits.forEach(t => ul.appendChild(uiEl('li', '', t)));
  tr.appendChild(ul);
  const cw = uiSection(body, '克制 / 被克');
  cw.appendChild(uiEl('p', '', I.strong));
  cw.appendChild(uiEl('p', '', I.weak));
  uiSection(body, '使用建議').appendChild(uiEl('p', '', I.tip));
  wrap.appendChild(body);
  return { wrap: wrap, cv: cv };
}
// 外觀預覽:用既有人物繪製(ART.chibiPose),與戰場同一套 spec(look 優先,其次 id)
function uiPreviewDraw(cv, id) {
  if (typeof ART === 'undefined' || !ART.chibiPose || !ART.UNIT) return;
  const d = UNITS[id];
  const spec = ART.UNIT[d.look] || ART.UNIT[id];
  if (!spec) return;
  const ctx = cv.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ART.chibiPose(ctx, { spec: spec, x: 48, y: 96, f: 3, fr: 0 }, 2, 'noon');
}
function unitCardOpen(id) {
  if (typeof document === 'undefined' || !unitInfo(id)) return;
  uiEnsure();
  uiCardEl.innerHTML = '';
  const built = uiCardBuild(id);
  uiCardEl.appendChild(built.wrap);
  uiPreviewDraw(built.cv, id);
  uiMaskEl.hidden = false;
  uiCardEl.hidden = false;
}
function unitCardClose() {
  if (uiCardEl) uiCardEl.hidden = true;
  if (uiMaskEl) uiMaskEl.hidden = true;
}
function uiDexRender() {
  const groups = unitDexGroups();
  const cur = groups.filter(g => g.key === uiDexTab)[0] || groups[0];
  uiDexEl.innerHTML = '';
  const head = uiEl('div', 'ud-head');
  head.appendChild(uiEl('b', '', '兵種圖鑑'));
  const x = uiEl('button', 'ud-x', '✕');
  x.setAttribute('data-dex-close', '1');
  x.setAttribute('aria-label', '關閉');
  head.appendChild(x);
  uiDexEl.appendChild(head);
  const tabs = uiEl('div', 'ud-tabs');
  groups.forEach(g => {
    const b = uiEl('button', g.key === cur.key ? 'on' : '', g.label + ' ' + g.ids.length);
    b.setAttribute('data-dtab', g.key);
    tabs.appendChild(b);
  });
  uiDexEl.appendChild(tabs);
  const list = uiEl('div', 'ud-list');
  cur.ids.forEach(id => {
    const I = unitInfo(id);
    const lk = uiLocked(id);
    const row = uiEl('button', 'ud-row' + (lk ? ' lock' : ''));
    row.setAttribute('data-dex', id);
    row.appendChild(uiEl('span', 'ud-ico', uiIcon(id)));
    const tx = uiEl('span', 'ud-tx');
    tx.appendChild(uiEl('b', '', I.name));
    tx.appendChild(uiEl('small', '', I.nick + ' · ' + I.role + (I.placed ? ' · 人口 ' + I.pop : '')));
    row.appendChild(tx);
    row.appendChild(uiEl('span', 'ud-tag', lk ? '🔒 Lv ' + uiLockLv(id) + ' 開放' : '›'));
    list.appendChild(row);
  });
  uiDexEl.appendChild(list);
}
function uiDexClick(e) {
  const t = e.target.closest('[data-dtab],[data-dex],[data-dex-close]');
  if (!t) return;
  if (t.hasAttribute('data-dex-close')) { uiDexClose(); return; }
  if (t.hasAttribute('data-dtab')) { uiDexTab = t.getAttribute('data-dtab'); uiDexRender(); return; }
  unitCardOpen(t.getAttribute('data-dex'));
}
function unitDexOpen() {
  if (typeof document === 'undefined') return;
  uiEnsure();
  uiDexRender();
  uiDexEl.hidden = false;
}
function uiDexClose() {
  if (uiDexEl) uiDexEl.hidden = true;
}
