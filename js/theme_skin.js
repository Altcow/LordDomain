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
    pal: { roof: '#7a7a72', wall: '#8f8f84', trim: '#2a2623', cloth1: '#cfc8b8', cloth2: '#2a2623', leather: '#4a3a2a', flag1: '#cfc8b8', flag2: '#2a2623', accent: '#9a4a32', pattern: 'felt_diamond' } }
};
const THEME_ORDER = ['han', 'bei', 'xiyu', 'nanman', 'qiang'];

function themeSkinHas(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(THEME_SKINS, id);
}
function themeIds() { return THEME_ORDER.filter(themeSkinHas); }
// 目前城市風格;未設定或未知 id 一律 'han'
function themeGet() {
  var c = (typeof world !== 'undefined' && world) ? world.city : null;
  return c && themeSkinHas(c.theme) ? c.theme : THEME_DEFAULT;
}
// 設定城市風格;未知 id 不動並回 false;設回漢 = 移除欄位(存檔不增)
function themeSet(id) {
  if (!themeSkinHas(id) || typeof world === 'undefined' || !world) return false;
  if (!world.city || typeof world.city !== 'object') return false;
  if (id === THEME_DEFAULT) delete world.city.theme; else world.city.theme = id;
  return true;
}
function themePal(id) { return themeSkinHas(id) ? THEME_SKINS[id].pal : THEME_SKINS[THEME_DEFAULT].pal; }
// 該主題此建築類型的 ART key('th_<主題>_<類型>');漢 / 無變體 / 未知 id 皆回 null(= 走原本 ART 定義)
function themeSkinOf(type, themeId) {
  if (!themeSkinHas(themeId) || themeId === THEME_DEFAULT) return null;
  return THEME_SKINS[themeId].types.indexOf(type) >= 0 ? 'th_' + themeId + '_' + type : null;
}
