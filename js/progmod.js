// progmod.js — 戰陣模塊庫執行期(PLAN_PROGRESSION §5;PLAN_ROUTES §7~§9)。瀏覽器與 node(vm / require)皆可載入。
// 75 筆模塊記錄只存參數(id / lv / 原型 / seed / diff / 可選 p、minAt),整張棋盤由 js/progmod_arch.js 的原型生成器即時產生(確定性:同記錄 → 同結果)。
// 提供:progModBuild(rec, atLv) 完整生成結果(boardToJSON 格式 + route / chokes / traps / meta)、progModBoard 只含棋盤欄位(給 boardFromJSON / 戰鬥地圖)、
//       progModList(lv) 該等級 ±2 的模塊、progModDraw(lv, seed, n) 抽 n 張(預設 3,盡量不同原型)、progModCard 卡面資訊。
// 外部全域(呼叫時才用):PROGMOD_ARCH(progmod_arch.js)及其依賴的 OBJECTS / progLandSide 等(units.js、progdata.js)。
// node 端:先把遊戲腳本載入同一個 vm context,再載入本檔;或 require 本檔(此時須自行把上述全域放到 globalThis)。

// 抽選卡張數 PROG_MOD.show(3)、等級範圍 ±PROG_MOD.window(2):progdata.js 的 PROG_MOD(PLAN §5.2);PROG_MODS(progdata.js 的空陣列)在下面填入。
const PROG_MOD_KEEP = ['v', 'terrain', 'height', 'flow', 'block', 'zone', 'objects', 'marks'];   // 棋盤欄位(其餘為 route / chokes / traps / meta)

// BEGIN PROG_MOD_DATA (tools/prog/mods75_gen.js 產生,勿手改)
const PROG_MOD_DATA = [
  { id: "m01a", lv: 1, arch: "R12", seed: 353, diff: 0, p: { cpUse: 0.6 } },
  { id: "m01b", lv: 1, arch: "R09", seed: 269, diff: 1, p: { cpUse: 0.8 } },
  { id: "m01c", lv: 1, arch: "R11", seed: 311, diff: 2, p: { cpUse: 1 } },
  { id: "m02a", lv: 2, arch: "R09", seed: 282, diff: 0, minAt: 1, p: { open: true, cpUse: 0.6 } },
  { id: "m02b", lv: 2, arch: "R12", seed: 372, diff: 1, minAt: 1, p: { cpUse: 0.8 } },
  { id: "m02c", lv: 2, arch: "R11", seed: 328, diff: 2, minAt: 1, p: { cpUse: 1 } },
  { id: "m03a", lv: 3, arch: "R09", seed: 295, diff: 0, minAt: 1, p: { cpUse: 0.6 } },
  { id: "m03b", lv: 3, arch: "R12", seed: 391, diff: 1, minAt: 1, p: { cpUse: 0.8 } },
  { id: "m03c", lv: 3, arch: "R11", seed: 345, diff: 2, minAt: 1, p: { cpUse: 1 } },
  { id: "m04a", lv: 4, arch: "R10", seed: 1044, diff: 0, p: { cpUse: 0.6 } },
  { id: "m04b", lv: 4, arch: "R02", seed: 1041, diff: 1, p: { cpUse: 1 } },
  { id: "m04c", lv: 4, arch: "R08", seed: 1047, diff: 2, p: { cpUse: 0.8 } },
  { id: "m05a", lv: 5, arch: "R07", seed: 1053, diff: 0, p: { cpUse: 0.8 } },
  { id: "m05b", lv: 5, arch: "R05", seed: 1057, diff: 1, minAt: 4, p: { cpUse: 0.6 } },
  { id: "m05c", lv: 5, arch: "R04", seed: 1052, diff: 2, minAt: 4, p: { cpUse: 1 } },
  { id: "m06a", lv: 6, arch: "R01", seed: 1060, diff: 0, minAt: 5, p: { cpUse: 0.6 } },
  { id: "m06b", lv: 6, arch: "R03", seed: 1063, diff: 1, minAt: 4, p: { pitch: 2, wv: 5, up: 3, cpUse: 0.8 } },
  { id: "m06c", lv: 6, arch: "R02", seed: 1066, diff: 2, minAt: 4, p: { q: 5, cpUse: 1 } },
  { id: "m07a", lv: 7, arch: "R10", seed: 1074, diff: 0, minAt: 5, p: { cpUse: 0.6 } },
  { id: "m07b", lv: 7, arch: "R08", seed: 1070, diff: 1, p: { pw: 16, ph: 8, cpUse: 0.8 } },
  { id: "m07c", lv: 7, arch: "R07", seed: 1077, diff: 2, minAt: 5, p: { cpUse: 1 } },
  { id: "m08a", lv: 8, arch: "R06", seed: 1081, diff: 0, p: { cpUse: 0.6 } },
  { id: "m08b", lv: 8, arch: "R01", seed: 1084, diff: 1, minAt: 6, p: { cpUse: 0.8 } },
  { id: "m08c", lv: 8, arch: "R04", seed: 1086, diff: 2, minAt: 6, p: { cpUse: 1 } },
  { id: "m09a", lv: 9, arch: "R06", seed: 1098, diff: 0, minAt: 8, p: { cpUse: 0.8 } },
  { id: "m09b", lv: 9, arch: "R03", seed: 1094, diff: 1, minAt: 7, p: { pitch: 2, wv: 5, up: 3, cpUse: 1 } },
  { id: "m09c", lv: 9, arch: "R05", seed: 1092, diff: 2, p: { g: 5, cpUse: 0.6 } },
  { id: "m10a", lv: 10, arch: "R10", seed: 1108, diff: 0, minAt: 8, p: { cpUse: 0.6 } },
  { id: "m10b", lv: 10, arch: "R07", seed: 1104, diff: 1, minAt: 8, p: { cpUse: 1 } },
  { id: "m10c", lv: 10, arch: "R08", seed: 1102, diff: 2, minAt: 8, p: { pw: 16, cpUse: 0.8 } },
  { id: "m11a", lv: 11, arch: "R04", seed: 1114, diff: 0, minAt: 9, p: { cpUse: 0.8 } },
  { id: "m11b", lv: 11, arch: "R01", seed: 1117, diff: 1, minAt: 9, p: { w: 3, ridge: 2, mouth: 0.85, up: 0, cpUse: 0.6 } },
  { id: "m11c", lv: 11, arch: "R02", seed: 1112, diff: 2, minAt: 9, p: { q: 6, cpUse: 1 } },
  { id: "m12a", lv: 12, arch: "R05", seed: 1123, diff: 0, minAt: 10, p: { cpUse: 0.6 } },
  { id: "m12b", lv: 12, arch: "R07", seed: 1126, diff: 1, minAt: 10, p: { cpUse: 0.8 } },
  { id: "m12c", lv: 12, arch: "R03", seed: 1120, diff: 2, minAt: 10, p: { pitch: 2, wv: 5, up: 3, cpUse: 1 } },
  { id: "m13a", lv: 13, arch: "R06", seed: 1132, diff: 0, p: { cpUse: 0.8 } },
  { id: "m13b", lv: 13, arch: "R01", seed: 1138, diff: 1, minAt: 11, p: { cpUse: 0.6 } },
  { id: "m13c", lv: 13, arch: "R04", seed: 1135, diff: 2, minAt: 11, p: { cpUse: 1 } },
  { id: "m14a", lv: 14, arch: "R10", seed: 1143, diff: 0, minAt: 12, p: { cpUse: 0.8 } },
  { id: "m14b", lv: 14, arch: "R05", seed: 1140, diff: 1, minAt: 12, p: { cpUse: 0.6 } },
  { id: "m14c", lv: 14, arch: "R02", seed: 1148, diff: 2, minAt: 12, p: { q: 6, cpUse: 1 } },
  { id: "m15a", lv: 15, arch: "R09", seed: 1155, diff: 0, minAt: 13, p: { cpUse: 0.6 } },
  { id: "m15b", lv: 15, arch: "R06", seed: 1157, diff: 1, minAt: 13, p: { cpUse: 0.8 } },
  { id: "m15c", lv: 15, arch: "R03", seed: 1150, diff: 2, minAt: 13, p: { pitch: 2, wv: 5, up: 2, cpUse: 1 } },
  { id: "m16a", lv: 16, arch: "R08", seed: 1161, diff: 0, minAt: 14, p: { pw: 19, cpUse: 0.6 } },
  { id: "m16b", lv: 16, arch: "R01", seed: 1165, diff: 1, minAt: 14, p: { cpUse: 0.8 } },
  { id: "m16c", lv: 16, arch: "R04", seed: 1168, diff: 2, minAt: 14, p: { cpUse: 1 } },
  { id: "m17a", lv: 17, arch: "R09", seed: 1176, diff: 0, minAt: 15, p: { cpUse: 0.6 } },
  { id: "m17b", lv: 17, arch: "R03", seed: 1175, diff: 1, minAt: 15, p: { pitch: 2, wv: 5, up: 1, cpUse: 1 } },
  { id: "m17c", lv: 17, arch: "R05", seed: 1172, diff: 2, minAt: 15, p: { cpUse: 0.8 } },
  { id: "m18a", lv: 18, arch: "R08", seed: 1184, diff: 0, minAt: 16, p: { pw: 19, cpUse: 0.6 } },
  { id: "m18b", lv: 18, arch: "R10", seed: 1187, diff: 1, minAt: 16, p: { cpUse: 0.8 } },
  { id: "m18c", lv: 18, arch: "R06", seed: 1180, diff: 2, p: { cpUse: 1 } },
  { id: "m19a", lv: 19, arch: "R09", seed: 1198, diff: 0, minAt: 17, p: { cpUse: 0.6 } },
  { id: "m19b", lv: 19, arch: "R07", seed: 1191, diff: 1, minAt: 17, p: { west: 9, cpUse: 1 } },
  { id: "m19c", lv: 19, arch: "R02", seed: 1193, diff: 2, minAt: 17, p: { q: 6, cpUse: 0.8 } },
  { id: "m20a", lv: 20, arch: "R10", seed: 1203, diff: 0, minAt: 18, p: { cpUse: 0.6 } },
  { id: "m20b", lv: 20, arch: "R01", seed: 1200, diff: 1, minAt: 18, p: { w: 3, ridge: 2, mouth: 0.85, up: 0, cpUse: 0.8 } },
  { id: "m20c", lv: 20, arch: "R03", seed: 1208, diff: 2, minAt: 18, p: { pitch: 2, wv: 5, up: 2, cpUse: 1 } },
  { id: "m21a", lv: 21, arch: "R05", seed: 1211, diff: 0, minAt: 19, p: { cpUse: 0.6 } },
  { id: "m21b", lv: 21, arch: "R07", seed: 1218, diff: 1, minAt: 19, p: { west: 9, cpUse: 1 } },
  { id: "m21c", lv: 21, arch: "R08", seed: 1215, diff: 2, minAt: 19, p: { pw: 19, cpUse: 0.8 } },
  { id: "m22a", lv: 22, arch: "R09", seed: 1228, diff: 0, minAt: 20, p: { cpUse: 0.6 } },
  { id: "m22b", lv: 22, arch: "R06", seed: 1220, diff: 1, p: { cpUse: 1 } },
  { id: "m22c", lv: 22, arch: "R02", seed: 1224, diff: 2, minAt: 20, p: { q: 6, cpUse: 0.8 } },
  { id: "m23a", lv: 23, arch: "R05", seed: 1232, diff: 0, minAt: 21, p: { cpUse: 0.6 } },
  { id: "m23b", lv: 23, arch: "R08", seed: 1233, diff: 1, minAt: 21, p: { pw: 19, cpUse: 0.8 } },
  { id: "m23c", lv: 23, arch: "R03", seed: 1236, diff: 2, minAt: 21, p: { pitch: 2, wv: 5, up: 2, cpUse: 1 } },
  { id: "m24a", lv: 24, arch: "R10", seed: 1245, diff: 0, minAt: 22, p: { cpUse: 0.6 } },
  { id: "m24b", lv: 24, arch: "R07", seed: 1247, diff: 1, minAt: 22, p: { west: 9, cpUse: 1 } },
  { id: "m24c", lv: 24, arch: "R01", seed: 1242, diff: 2, minAt: 22, p: { w: 3, ridge: 2, mouth: 0.85, up: 0, cpUse: 0.8 } },
  { id: "m25a", lv: 25, arch: "R09", seed: 1255, diff: 0, minAt: 23, p: { cpUse: 0.6 } },
  { id: "m25b", lv: 25, arch: "R05", seed: 1252, diff: 1, minAt: 23, p: { cpUse: 0.8 } },
  { id: "m25c", lv: 25, arch: "R10", seed: 1257, diff: 2, minAt: 23, p: { cpUse: 1 } }
];
// END PROG_MOD_DATA
if (typeof PROG_MODS !== 'undefined' && PROG_MODS.length === 0) PROG_MOD_DATA.forEach(function (m) { PROG_MODS.push(m); });
function progModAll() { return typeof PROG_MODS !== 'undefined' && PROG_MODS.length ? PROG_MODS : PROG_MOD_DATA; }

function progModGet(id) {
  const all = progModAll();
  for (let k = 0; k < all.length; k++) if (all[k].id === id) return all[k];
  return null;
}
function progModArch(id) { return PROGMOD_ARCH.ARCHS[id] || null; }

// 實例化:atLv 預設取記錄自己的等級(土地、牆柵門上限、CP、開放物件全取 atLv;骨架與參數取記錄)
function progModBuild(rec, atLv) {
  if (typeof rec === 'string') rec = progModGet(rec);
  if (!rec) return null;
  const a = progModArch(rec.arch);
  if (!a) throw new Error('未知原型: ' + rec.arch);
  const plan = a.build({ lv: atLv || rec.lv, seed: rec.seed, side: rec.side, ori: rec.ori, p: rec.p || {} });
  const j = plan.toJSON();
  j.meta.id = rec.id || null;
  j.meta.name = a.name;
  return j;
}
// 只含棋盤欄位的 JSON(boardFromJSON / battleInit 的 map 用;不帶 route / chokes / traps / meta,體積小、也不會被存進戰鬥錄影)
function progModBoard(rec, atLv) {
  const j = progModBuild(rec, atLv);
  if (!j) return null;
  const o = {};
  PROG_MOD_KEEP.forEach(function (k) { o[k] = j[k]; });
  return o;
}

// 玩家等級 lv 可用的模塊:等級落在 lv ± range,且在 lv 實例化仍通過檢查(minAt ≤ lv;高於自己等級的模塊以自己的等級布置)
function progModList(lv) {
  const L = Math.max(1, lv | 0), r = PROG_MOD.window;
  return progModAll().filter(function (m) { return m.lv >= L - r && m.lv <= L + r && (m.minAt || m.lv) <= L; });
}
// 該玩家等級下的實際布置等級
function progModAtLv(rec, lv) { return Math.min(rec.lv, Math.max(1, lv | 0)); }

// 確定性抽 n 張(預設 PROG_MOD.show):同 (lv, seed) 永遠同一批;先依序挑不同原型,不夠再補同原型
function progModDraw(lv, seed, n) {
  n = n || PROG_MOD.show;
  const list = progModList(lv).slice();
  const R = PROGMOD_ARCH.L;
  const rng = R.makeRng(R.hash32('moddraw:' + (lv | 0) + ':' + (seed >>> 0)));
  for (let i = list.length - 1; i > 0; i--) {   // Fisher-Yates
    const j = Math.floor(rng() * (i + 1)), t = list[i];
    list[i] = list[j]; list[j] = t;
  }
  const out = [], seen = {};
  list.forEach(function (m) { if (out.length < n && !seen[m.arch]) { seen[m.arch] = 1; out.push(m); } });
  list.forEach(function (m) { if (out.length < n && out.indexOf(m) < 0) out.push(m); });
  return out;
}

// 卡面資訊:{ rec, id, name, desc, diff, lv, atLv, cp, cap, towers, wall, gate }(會實例化一次)
function progModCard(rec, lv) {
  const at = progModAtLv(rec, lv), j = progModBuild(rec, at), a = progModArch(rec.arch), c = j.meta.counts;
  return { rec: rec, id: rec.id, name: a.name, desc: a.desc || '', diff: rec.diff | 0, lv: rec.lv, atLv: at, cp: c.cp, cap: j.meta.caps.cp,
    towers: c.towers, wall: c.wall, gate: c.gate };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROG_MOD_DATA: PROG_MOD_DATA, progModAll: progModAll, progModGet: progModGet, progModBuild: progModBuild, progModBoard: progModBoard,
    progModList: progModList, progModAtLv: progModAtLv, progModDraw: progModDraw, progModCard: progModCard };
}
