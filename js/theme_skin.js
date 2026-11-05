// theme_skin.js — 各國建築風格皮膚的主題表與查詢(純外觀:不影響數值、尺寸、成本、模擬 checksum)
// 依 PLAN_ETHNIC §4:皮膚不綁族別,只綁玩家選擇的「城市風格」world.city.theme(預設 'han',舊存檔相容);
// 本檔只放資料與查詢,不依賴 ART。變體繪製(A.def 的 key 'th_<主題>_<類型>')在 art_theme.js。
// 快取鍵控制:每主題 ≤ 6 種建築類型,每種外觀變化 ≤ 2(art.js ART_SEED_VARIANTS 由 art_theme.js 登記)。
// 敏感守則(PLAN_ETHNIC §0.2):只用中性物理描述(氈、皮、土坯、竹木、石砌),不畫紋身 / 獵頭 / 後世元素。
// 色票 token 命名沿用 PLAN_ETHNIC §2.2:roof / wall / trim / cloth1 / cloth2 / leather / flag1 / flag2 / accent / pattern。
const THEME_DEFAULT = 'han';
const THEME_MAX_TYPES = 6;
const THEME_MAX_LOOKS = 2;
const THEME_SKINS = {
  han: { name: '漢', icon: '🏯', desc: '中原夯土、瓦頂(預設外觀)', types: [], looks: 1,
    pal: { roof: '#5a5a62', wall: '#cbb38a', trim: '#a8342a', cloth1: '#f4ead2', cloth2: '#c9b88e', leather: '#5a4a3a', flag1: '#a8342a', flag2: '#e3b95c', accent: '#e3b95c', pattern: 'plain' } },
  bei: { name: '北方', icon: '⛺', desc: '氈帳、皮革色、土坯(并涼幽邊郡風土)', looks: 2,
    types: ['tent', 'shack_lean', 'hut_mud', 'hut_plank', 'flagpole', 'cave_dwelling'],
    pal: { roof: '#cfc8b8', wall: '#b89a6a', trim: '#7a5430', cloth1: '#cfc8b8', cloth2: '#7a5430', leather: '#5a3a22', flag1: '#a8542c', flag2: '#c89a4a', accent: '#d9b23c', pattern: 'arrow3' } },
  xiyu: { name: '西域', icon: '🕌', desc: '土坯平頂、藍綠釉、拱與穹頂', looks: 2,
    types: ['tent', 'hut_mud', 'hut_plank', 'house_tile', 'flagpole', 'shack_lean'],
    pal: { roof: '#2f7a8a', wall: '#c8a878', trim: '#b0603a', cloth1: '#f1ead8', cloth2: '#2f4f8a', leather: '#4a3524', flag1: '#2f4f8a', flag2: '#f1ead8', accent: '#e3b95c', pattern: 'grape_diamond' } },
  nanman: { name: '南方', icon: '🎋', desc: '竹木、高腳、茅頂', looks: 2,
    types: ['hut_mud', 'hut_plank', 'bamboo_house', 'shack_lean', 'flagpole', 'house_tile'],
    pal: { roof: '#b8a060', wall: '#8a6a3a', trim: '#6a4a2a', cloth1: '#d8c47a', cloth2: '#3f8a5a', leather: '#6a4a2a', flag1: '#c8452f', flag2: '#3f8a5a', accent: '#e3b95c', pattern: 'stripe5' } },
  qiang: { name: '羌氐', icon: '🏔️', desc: '石砌碉房、氈白與黑邊', looks: 2,
    types: ['hut_mud', 'hut_plank', 'house_tile', 'tent', 'flagpole', 'cave_dwelling'],
    pal: { roof: '#7a7a72', wall: '#8f8f84', trim: '#2a2623', cloth1: '#cfc8b8', cloth2: '#2a2623', leather: '#4a3a2a', flag1: '#cfc8b8', flag2: '#2a2623', accent: '#9a4a32', pattern: 'felt_diamond' } },
  // 魔幻三族(PLAN_FANTASY;realm: 'fantasy' = 魔幻世界,與歷史風格互相隔離,見 themeRealm / themeSet)。types 只留旗桿(PLAN_FANTASY Q5)
  elf: { name: '精靈', icon: '🌳', desc: '活樹 · 白石 · 葉冠與藤橋(魔幻外觀 · 試玩)', looks: 1, realm: 'fantasy', types: ['flagpole'],
    pal: { roof: '#5f9a4a', wall: '#ece6d6', trim: '#c9c7bc', cloth1: '#a8cf7a', cloth2: '#6f8fb8', leather: '#5a4030', flag1: '#5f9a4a', flag2: '#ece6d6', accent: '#e4ef9a', pattern: 'leaf_arc' } },
  dwarf: { name: '矮人', icon: '⚒️', desc: '方石 · 鋼鐵與銅 · 熔爐火光(魔幻外觀 · 試玩)', looks: 1, realm: 'fantasy', types: ['flagpole'],
    pal: { roof: '#3e4248', wall: '#7d766c', trim: '#b86a3a', cloth1: '#8a2e24', cloth2: '#6f7880', leather: '#4e4a46', flag1: '#8a2e24', flag2: '#6f7880', accent: '#f08a2a', pattern: 'forge_chevron' } },
  kingdom: { name: '人類王國', icon: '🏰', desc: '石砌城堡 · 木骨白牆 · 紅藍旗(魔幻外觀 · 試玩)', looks: 1, realm: 'fantasy', types: ['flagpole'],
    pal: { roof: '#5a6878', wall: '#b5a894', trim: '#5a3e28', cloth1: '#f2ede2', cloth2: '#2f5a9a', leather: '#8e8270', flag1: '#b23a32', flag2: '#2f5a9a', accent: '#e3b95c', pattern: 'crown_quarter' } }
};
const THEME_ORDER = ['han', 'bei', 'xiyu', 'nanman', 'qiang', 'elf', 'dwarf', 'kingdom'];

function themeSkinHas(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(THEME_SKINS, id);
}
function themeIds() { return THEME_ORDER.filter(themeSkinHas); }
// 目前城市風格;未設定或未知 id 一律 'han'
function themeGet() {
  var c = (typeof world !== 'undefined' && world) ? world.city : null;
  return c && themeSkinHas(c.theme) ? c.theme : THEME_DEFAULT;
}
// 風格所屬領域:'fantasy'(魔幻三族 elf / dwarf / kingdom)或 'history'(漢與歷史風格)
function themeRealm(id) { return themeSkinHas(id) && THEME_SKINS[id].realm === 'fantasy' ? 'fantasy' : 'history'; }
// 目前城市風格 cur 可否換成 to(隔離規則,PLAN_FANTASY Q7):同風格永遠可;歷史風格之間可互切;魔幻世界建立後不可換(含魔幻族之間),歷史世界也不可切到魔幻
function themeSwitchOk(cur, to) {
  if (!themeSkinHas(to)) return false;
  cur = themeSkinHas(cur) ? cur : THEME_DEFAULT;
  if (cur === to) return true;
  return themeRealm(cur) === 'history' && themeRealm(to) === 'history';
}
// 設定「城市風格」輪替用清單:歷史世界 = 歷史風格;魔幻世界 = 只有自己(不可換)
function themeCycleIds(cur) {
  cur = themeSkinHas(cur) ? cur : themeGet();
  return themeIds().filter(function (id) { return themeSwitchOk(cur, id); });
}
// 範本是否適用於風格 cur(範本有 theme 欄位):戰陣範本不受限;魔幻世界只列同風格範本(與無主題的預設範本);歷史世界不列魔幻範本
function tplThemeOkFor(t, cur) {
  var th = t && t.theme;
  if (!t || (t.kind && t.kind !== 'estate')) return true;
  if (themeRealm(cur) === 'fantasy') return th === cur || (!th && t.isDefault === true);
  return !th || themeRealm(th) !== 'fantasy';
}
function tplThemeOk(t) { return tplThemeOkFor(t, themeGet()); }
// 設定城市風格;未知 id 不動並回 false;設回漢 = 移除欄位(存檔不增)。跨領域 / 魔幻世界換風格被隔離規則擋下(回 false);新世界建立時用 opts.init = true 放行
function themeSet(id, opts) {
  if (!themeSkinHas(id) || typeof world === 'undefined' || !world) return false;
  if (!world.city || typeof world.city !== 'object') return false;
  if (!(opts && opts.init) && !themeSwitchOk(themeGet(), id)) return false;
  if (id === THEME_DEFAULT) delete world.city.theme; else world.city.theme = id;
  return true;
}
function themePal(id) { return themeSkinHas(id) ? THEME_SKINS[id].pal : THEME_SKINS[THEME_DEFAULT].pal; }
// 該主題此建築類型的 ART key('th_<主題>_<類型>');漢 / 無變體 / 未知 id 皆回 null(= 走原本 ART 定義)
function themeSkinOf(type, themeId) {
  if (!themeSkinHas(themeId) || themeId === THEME_DEFAULT) return null;
  return THEME_SKINS[themeId].types.indexOf(type) >= 0 ? 'th_' + themeId + '_' + type : null;
}
