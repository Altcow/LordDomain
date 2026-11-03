// wallskin.js — 城牆外觀皮膚註冊表(純外觀:不影響數值、血量、阻擋、尋路、模擬 checksum)
// 物件可選欄位 skin(字串 id);未設定 = 現行預設外觀;未知 id 一律回退預設外觀,不拋例外。
// 繪製函式(ART 定義)在 art_wallskin.js 註冊,這裡只放資料與查詢,不依賴 ART。
//
// 擴充方式:
//  1. 新增皮膚:在 WALL_SKINS 加一筆 { name, icon, types: { 物件類型: ART 定義 key 或 null } },
//     並在 art_wallskin.js 用 A.def 定義對應的 ART key。UI 外觀小選單會自動列出。
//     types 的鍵 = 這個皮膚可套用的物件類型;值 null = 該類型的預設外觀(不另畫)。
//  2. 陣營主題(未實作,黃巾 / 南蠻 / 匈奴…):一個主題 id 對映到多種物件類型各自的皮膚,
//     例如 WALL_THEMES = { yellow: { wall: 'wall_yt', gate: 'gate_yt', tent: 'tent_yt', banner: 'banner_yt' } };
//     套用主題 = 對選取範圍內每個物件 o 設 o.skin = WALL_THEMES[theme][o.type](沒對映的類型保持不變)。
//     因為 skin 是「單一物件的字串 id」,主題只是批次寫入 skin,存檔 / 範本 / 回放格式不需再改。
//  3. 新的物件類型要支援皮膚:在該皮膚的 types 加上該類型即可(WALL_SKIN_FAMILY 決定「整段套用」的連通範圍)。
const WALL_SKINS = {
  wood:  { name: '木柵', icon: '🪵', types: { wall: 'wskin_wood_wall', gate: 'wskin_wood_gate', wall_courtyard: 'wskin_wood_wallc', gate_courtyard: 'wskin_wood_gatec' } },
  stone: { name: '石牆', icon: '🧱', types: { wall: null, gate: null, wall_courtyard: 'wskin_stone_wallc', gate_courtyard: 'wskin_stone_gatec' } },
  earth: { name: '土牆', icon: '🟫', types: { wall: 'wskin_earth_wall', gate: 'wskin_earth_gate', wall_courtyard: 'wskin_earth_wallc', gate_courtyard: 'wskin_earth_gatec' } }
};
// 該類型 skin 未設定時的外觀等同哪個皮膚(其餘類型的預設外觀不屬於任何皮膚,選單另提供「原樣」)
const WALL_SKIN_DEFAULT = { wall: 'stone', gate: 'stone' };
// 「整段套用」的連通族群:同族群、相鄰(含門的佔格)的物件視為同一段
const WALL_SKIN_FAMILY = { wall: 'main', gate: 'main', wall_courtyard: 'court', gate_courtyard: 'court' };

function wallSkinHas(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(WALL_SKINS, id);
}
// 該物件類型是否提供外觀選擇
function wallSkinCan(type) {
  for (const id in WALL_SKINS) {
    if (Object.prototype.hasOwnProperty.call(WALL_SKINS[id].types, type)) return true;
  }
  return false;
}
// 該類型可用的皮膚 id(依註冊順序)
function wallSkinIds(type) {
  return Object.keys(WALL_SKINS).filter(id => Object.prototype.hasOwnProperty.call(WALL_SKINS[id].types, type));
}
// 該類型此皮膚對應的 ART key;未知 id、不支援的類型、預設外觀皆回 null(= 走原本 ART 定義)
function wallSkinArt(type, id) {
  if (!wallSkinHas(id)) return null;
  const t = WALL_SKINS[id].types;
  return Object.prototype.hasOwnProperty.call(t, type) ? (t[type] || null) : null;
}
// 物件目前實際生效的皮膚 id('' = 原樣)
function wallSkinCur(o) {
  if (o && wallSkinHas(o.skin) && wallSkinIds(o.type).indexOf(o.skin) >= 0) return o.skin;
  return (o && WALL_SKIN_DEFAULT[o.type]) || '';
}
// 設定皮膚:'' 或與預設外觀相同者清除欄位(保持舊存檔 / 範本位元組不變)
function wallSkinSet(o, id) {
  if (!o) return;
  if (!id || !wallSkinHas(id) || id === WALL_SKIN_DEFAULT[o.type]) delete o.skin;
  else o.skin = id;
}
// 與 o 相連的同族群物件(含 o 自己);以 world.occ 四鄰判定
function wallSkinGroup(o) {
  const fam = WALL_SKIN_FAMILY[o.type];
  const out = [];
  if (!fam || typeof world === 'undefined') return [o];
  const seen = new Set([o]);
  const q = [o];
  while (q.length) {
    const c = q.pop();
    out.push(c);
    const fp = footprint(c.type, c.facing != null ? c.facing : c.rot);
    const around = [];
    for (let i = 0; i < fp[0]; i++) {
      around.push([c.x + i, c.y - 1], [c.x + i, c.y + fp[1]]);
    }
    for (let j = 0; j < fp[1]; j++) around.push([c.x - 1, c.y + j], [c.x + fp[0], c.y + j]);
    around.forEach(p => {
      if (p[0] < 0 || p[1] < 0 || p[0] >= boardW() || p[1] >= boardH()) return;
      const n = world.occ[idx(p[0], p[1])];
      const p2 = n ? world.objects[n - 1] : null;
      if (p2 && !seen.has(p2) && WALL_SKIN_FAMILY[p2.type] === fam) { seen.add(p2); q.push(p2); }
    });
  }
  return out;
}
