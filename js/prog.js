// js/prog.js — 城市等級系統:存讀檔與防呆、開放查詢、升級、戰鬥結算、材料轉換、舊存檔遷移、測試用函式。
// PLAN_PROGRESSION.md §2 §3.3 §8。數字與表格只在 js/progdata.js;本檔只呼叫其函式與常數。
// 外部全域(world、saveWorld、NPC_BASES)一律 typeof 守衛,與載入順序無關。
// 全域名稱只用 prog / progXxx(附錄 A);高於此的名稱都是本檔內部輔助函式。

var prog = null;   // 目前城市等級存檔(progLoad 設定);null = 尚未載入

// 把任意值夾到 [lo, hi] 的整數;非有限數字回 def
function progInt(v, lo, hi, def) {
  if (typeof v !== 'number' || !isFinite(v)) return def;
  v = Math.floor(v);
  return v < lo ? lo : (v > hi ? hi : v);
}

// 新玩家的預設存檔(§8.1 結構)
function progBlank() {
  var d = {
    v: 1, lv: 1, xp: 0, mats: {}, legacy: false,
    ftue: { step: '', off: false, done: {} },
    seen: {},
    npc: { seq: 0, slots: [] },
    ghost: { seq: 0, slots: [] },
    bossBest: {},
    friendHits: {},
    mod: { seq: 0, fav: [], my: [] },
    lastEstate: null
  };
  Object.keys(PROG_MATS).forEach(function (id) { d.mats[id] = 0; });
  for (var i = 0; i < PROG_MOD.mySlots; i++) d.mod.my.push(null);
  return d;
}

// 型別修正與越界修正;壞掉的欄位退回預設,不丟例外。錯版本或非物件 → 新玩家。
function progNorm(raw) {
  var b = progBlank(), k, id, i, src;
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return b;
  b.lv = progInt(raw.lv, 1, PROG_LV_MAX, 1);
  b.xp = progInt(raw.xp, 0, Number.MAX_SAFE_INTEGER, 0);
  if (raw.mats && typeof raw.mats === 'object') {
    Object.keys(PROG_MATS).forEach(function (m) { b.mats[m] = progInt(raw.mats[m], 0, Number.MAX_SAFE_INTEGER, 0); });
  }
  b.legacy = raw.legacy === true;
  if (raw.ftue && typeof raw.ftue === 'object') {
    b.ftue.step = typeof raw.ftue.step === 'string' ? raw.ftue.step : '';
    b.ftue.off = raw.ftue.off === true;
    if (raw.ftue.done && typeof raw.ftue.done === 'object') {
      for (k in raw.ftue.done) if (raw.ftue.done[k] === true) b.ftue.done[k] = true;
    }
  }
  if (raw.seen && typeof raw.seen === 'object') {
    for (k in raw.seen) if (raw.seen[k] === true) b.seen[k] = true;
  }
  if (raw.bossBest && typeof raw.bossBest === 'object') {
    PROG_BOSSES.forEach(function (bs) { b.bossBest[bs.id] = progInt(raw.bossBest[bs.id], 0, PROG_STAR_MAX, 0); });
  }
  if (raw.friendHits && typeof raw.friendHits === 'object') {
    for (k in raw.friendHits) b.friendHits[k] = progInt(raw.friendHits[k], 1, Number.MAX_SAFE_INTEGER, 1);
  }
  progPruneHits(b);
  if (raw.npc && typeof raw.npc === 'object') {
    b.npc.seq = progInt(raw.npc.seq, 0, Number.MAX_SAFE_INTEGER, 0);
    if (Array.isArray(raw.npc.slots)) b.npc.slots = raw.npc.slots.filter(progIsObj).slice(0, PROG_NPC_SLOTS);
  }
  if (raw.ghost && typeof raw.ghost === 'object') {
    b.ghost.seq = progInt(raw.ghost.seq, 0, Number.MAX_SAFE_INTEGER, 0);
    if (Array.isArray(raw.ghost.slots)) b.ghost.slots = raw.ghost.slots.filter(progIsObj).slice(0, PROG_GHOST_SLOTS);
  }
  if (raw.mod && typeof raw.mod === 'object') {
    b.mod.seq = progInt(raw.mod.seq, 0, Number.MAX_SAFE_INTEGER, 0);
    if (Array.isArray(raw.mod.fav)) b.mod.fav = raw.mod.fav.filter(function (x) { return typeof x === 'string'; }).slice(0, PROG_MOD.favMax);
    if (Array.isArray(raw.mod.my)) {
      src = raw.mod.my;
      for (i = 0; i < PROG_MOD.mySlots; i++) b.mod.my[i] = progIsObj(src[i]) ? src[i] : null;
    }
  }
  if (progIsObj(raw.lastEstate)) b.lastEstate = raw.lastEstate;
  return b;
}

function progIsObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

// friendHits 超過上限時刪最舊的(物件鍵依插入順序)
function progPruneHits(p) {
  var keys = Object.keys(p.friendHits);
  while (keys.length > PROG_FRIEND_HIST) delete p.friendHits[keys.shift()];
}

function progSaveExists() {
  try { return localStorage.getItem(PROG_SAVE_KEY) !== null; } catch (e) { return false; }
}

// 讀取城市等級存檔到 prog。壞 JSON / 錯版本 → 新玩家(不崩潰)。
// 本身不存在、且沒有舊主存檔時才寫入新玩家存檔;有舊主存檔時不寫,讓 progMigrateReset 能判定遷移。
function progLoad() {
  var raw = null, d = null;
  try { raw = localStorage.getItem(PROG_KEY); } catch (e) { raw = null; }
  if (raw !== null) { try { d = JSON.parse(raw); } catch (e2) { d = null; } }
  prog = progNorm(d);
  if (raw === null && !progSaveExists()) progSave();
  return prog;
}

function progSave() {
  if (!prog) return false;
  try { localStorage.setItem(PROG_KEY, JSON.stringify(prog)); return true; } catch (e) { return false; }
}

function progGet() {
  if (!prog) progLoad();
  return prog;
}

function progLv() { return progGet().lv; }

// 開放等級:kind 為 'estate' | 'camp' | 'obj'(經營或戰陣皆可) | 'terrain' | 'trap' | 'unit' | 'feature'。
// 回傳開放的最低等級;表中沒有的 id 回 null(由呼叫端決定,例如 'tech' 尚未接入)。
function progUnlockLv(kind, id) {
  var tabs = [], best = null;
  if (kind === 'estate') tabs = [PROG_UNLOCK_ESTATE];
  else if (kind === 'camp') tabs = [PROG_UNLOCK_CAMP];
  else if (kind === 'obj') tabs = [PROG_UNLOCK_ESTATE, PROG_UNLOCK_CAMP];
  else if (kind === 'terrain') tabs = [PROG_UNLOCK_TERRAIN];
  else if (kind === 'trap') tabs = [PROG_UNLOCK_TRAP];
  else if (kind === 'unit') tabs = [PROG_UNLOCK_UNIT];
  else if (kind === 'feature') tabs = [PROG_UNLOCK_FEATURE];
  tabs.forEach(function (t) {
    Object.keys(t).forEach(function (L) {
      if (t[L].indexOf(id) >= 0 && (best === null || +L < best)) best = +L;
    });
  });
  return best;
}

// 舊玩家判定(§8.2):沒有 prog 存檔,但有舊主存檔
function progNeedsMigrate() {
  try { return localStorage.getItem(PROG_KEY) === null && localStorage.getItem(PROG_SAVE_KEY) !== null; } catch (e) { return false; }
}

// 舊存檔遷移(§8.2,Q2 覆寫:一律從 1 級開始)。
// 順序:①原樣備份到 PROG_LEGACY_KEY 並驗證 ②寫備份時間 ③移除主存檔 ④寫入新玩家 prog。
// 任一步失敗就停在原地(下次啟動會重試),不會丟資料。
// 呼叫時機:啟動流程中 loadWorld() / 任何 saveWorld() 之前。
function progMigrateReset() {
  var raw = null, old = null, at = '';
  if (!progNeedsMigrate()) { progLoad(); return { migrated: false, reason: 'not-needed' }; }
  try {
    raw = localStorage.getItem(PROG_SAVE_KEY);
    old = localStorage.getItem(PROG_LEGACY_KEY);
    if (old !== null && old !== raw) return { migrated: false, reason: 'legacy-conflict' };
    if (old === null) localStorage.setItem(PROG_LEGACY_KEY, raw);
    if (localStorage.getItem(PROG_LEGACY_KEY) !== raw) return { migrated: false, reason: 'backup-verify-failed' };
    at = new Date().toISOString();
    localStorage.setItem(PROG_LEGACY_AT_KEY, at);
    localStorage.removeItem(PROG_SAVE_KEY);
  } catch (e) {
    return { migrated: false, reason: 'storage-error' };
  }
  prog = progNorm(null);
  progSave();
  return { migrated: true, reason: '', at: at };
}

var PROG_RES_NAME = { coin: '金', wood: '木', stone: '石' };
var PROG_FTUE_TEXT = { houses2: '蓋好 2 座民房', npcWin1: '野營勝 1 場', campSet: '套用或調整戰陣 1 次', ghostWin1: '他城勝 1 場' };

function progBossName(id) {
  var found = null;
  if (typeof NPC_BASES !== 'undefined' && NPC_BASES) {
    NPC_BASES.forEach(function (b) { if (b.id === id) found = b; });
  }
  return found ? found.name : id;
}

function progBossDef(id) {
  var found = null;
  PROG_BOSSES.forEach(function (b) { if (b.id === id) found = b; });
  return found;
}

// 升級檢查:回傳 {ok, reason};reason 為給玩家看的原因字串(ok 時為空字串)
function progCanUpgrade() {
  var p = progGet(), c, k, id, have, need;
  if (p.lv >= PROG_LV_MAX) return { ok: false, reason: '已達最高等級' };
  c = progUpgradeCost(p.lv);
  if (c.ftue && !p.ftue.done[c.ftue]) return { ok: false, reason: '尚未完成教學:' + (PROG_FTUE_TEXT[c.ftue] || c.ftue) };
  if (c.boss && (p.bossBest[c.boss] || 0) < 1) return { ok: false, reason: '需先在首領營「' + progBossName(c.boss) + '」取得 1★' };
  if (p.xp < c.xp) return { ok: false, reason: '經驗不足(' + p.xp + ' / ' + c.xp + ')' };
  for (id in c.mats) {
    have = p.mats[id] || 0;
    need = c.mats[id];
    if (have < need) return { ok: false, reason: '材料不足:' + PROG_MATS[id].name + '(' + have + ' / ' + need + ')' };
  }
  if (typeof world === 'undefined' || !world || !world.res) return { ok: false, reason: '資源尚未載入' };
  for (k in c.res) {
    have = world.res[k] || 0;
    need = c.res[k];
    if (have < need) return { ok: false, reason: '資源不足:' + (PROG_RES_NAME[k] || k) + '(' + Math.floor(have) + ' / ' + need + ')' };
  }
  return { ok: true, reason: '' };
}

// 升級:扣資源、材料、經驗 → 等級 +1 → 先 progSave() 再 saveWorld()(§8.1 寫入順序)
function progDoUpgrade() {
  var p = progGet(), chk = progCanUpgrade(), c, k, id;
  if (!chk.ok) return chk;
  c = progUpgradeCost(p.lv);
  for (k in c.res) world.res[k] = (world.res[k] || 0) - c.res[k];
  for (id in c.mats) p.mats[id] -= c.mats[id];
  p.xp -= c.xp;
  p.lv += 1;
  progSave();
  if (typeof saveWorld === 'function') saveWorld();
  return { ok: true, reason: '', lv: p.lv };
}

// 確定性亂數:同 (pid, seed, tag) 永遠得到同一個 [0,1) 值
function progHash(str) {
  var h = 0, i;
  for (i = 0; i < str.length; i++) h = (Math.imul(h, PROG_RNG.mul) + str.charCodeAt(i)) | 0;
  h = Math.imul(h ^ (h >>> PROG_RNG.shift), PROG_RNG.mix);
  h = h ^ (h >>> PROG_RNG.shift);
  return (h >>> 0) / PROG_RNG.span;
}

function progRand(pid, seed, tag) {
  return progHash(String(pid) + ':' + String(seed) + ':' + String(tag));
}

// 指定品階、且 from 含該陣營的材料 id;無則放寬為同品階全部
function progMatsFrom(tier, fac) {
  var out = [];
  Object.keys(PROG_MATS).forEach(function (id) {
    var m = PROG_MATS[id];
    if (m.tier === tier && (!fac || m.from.indexOf(fac) >= 0)) out.push(id);
  });
  if (!out.length) Object.keys(PROG_MATS).forEach(function (id) { if (PROG_MATS[id].tier === tier) out.push(id); });
  return out;
}

// 戰鬥結算(§3.3)。info:{kind:'ghost'|'friend'|'npc'|'boss', T, stars, pct(0~1), grade, diff, seed, pid, snapHash, id(首領), fac}
// 掉落只由 (pid, seed, 戰鬥參數) 決定,同 seed 重算結果相同。
// 會更新 prog(經驗、材料、friendHits、bossBest)與 world.res(資源),並 progSave();world 的存檔由呼叫端 saveWorld()。
function progOnBattle(info) {
  var p = progGet(), R = PROG_REWARD, out = { res: { coin: 0, wood: 0, stone: 0 }, xp: 0, mats: {}, bossFirst: false };
  var kind, T, stars, diff, pct, lvd, mult, rep, base, k, xpv, xpMul = 1, bdef = null, fac, pidKey, seedV,
    commons, uncommons, rares, cnt, off, i, id, prevBest, bf, rareOk, pool;
  if (!info || typeof info !== 'object') return out;
  kind = info.kind;
  T = progInt(info.T, 1, PROG_LV_MAX, 1);
  stars = progInt(info.stars, 0, PROG_STAR_MAX, 0);
  diff = progInt(info.diff, 0, PROG_DIFF_MAX, 0);
  pct = Math.max(0, Math.min(1, +info.pct || 0));
  lvd = R.lvDiff(T, p.lv);
  xpv = Math.round(R.xpBase(T) * lvd * (R.gradeXp[info.grade] || 0));
  if (p.lv >= PROG_LV_MAX) xpv = 0;
  pidKey = String(info.pid || info.id || kind);
  seedV = info.seed;

  if (kind === 'ghost' || kind === 'friend') {
    mult = 1;
    if (kind === 'friend') {
      k = String(info.snapHash || '');
      rep = (p.friendHits[k] || 0) + 1;
      p.friendHits[k] = rep;
      progPruneHits(p);
      mult = R.friendRepeat[Math.min(rep, R.friendRepeat.length) - 1];
    }
    base = R.lootBase(T);
    for (k in base) out.res[k] = Math.floor(base[k] * lvd * pct * R.starLoot(stars) * mult);
  } else if (kind === 'npc' || kind === 'boss') {
    base = R.lootBase(T);
    for (k in base) out.res[k] = Math.floor(base[k] * lvd * pct * R.starLoot(stars) * R.npcResRate);
    if (kind === 'boss') bdef = progBossDef(info.id);
    fac = info.fac || (bdef ? bdef.fac : '');
    commons = progMatsFrom('c', fac);
    uncommons = progMatsFrom('u', fac);
    rares = progMatsFrom('r', fac);
    cnt = Math.floor(R.dropCommon(T, stars));
    if (commons.length && cnt > 0) {
      off = Math.floor(progRand(pidKey, seedV, 'cs') * commons.length);
      for (i = 0; i < cnt; i++) {
        id = commons[(off + i) % commons.length];
        out.mats[id] = (out.mats[id] || 0) + 1;
      }
    }
    if (uncommons.length && progRand(pidKey, seedV, 'u') < R.dropUncommonP(stars, diff)) {
      id = uncommons[Math.floor(progRand(pidKey, seedV, 'u2') * uncommons.length)];
      out.mats[id] = (out.mats[id] || 0) + 1;
    }
    rareOk = stars === PROG_STAR_MAX && (diff === PROG_DIFF_MAX || kind === 'boss');
    if (rareOk && rares.length && progRand(pidKey, seedV, 'r') < R.dropRareP) {
      id = rares[Math.floor(progRand(pidKey, seedV, 'r2') * rares.length)];
      out.mats[id] = (out.mats[id] || 0) + 1;
    }
    if (bdef) {
      prevBest = p.bossBest[bdef.id] || 0;
      if (stars > prevBest) {
        out.bossFirst = true;
        bf = R.bossFirst[stars];
        if (bf) {
          xpMul = bf.xpMul || 1;
          if (bf.rare) {
            pool = progMatsFrom('r', 'boss');
            id = pool[Math.floor(progRand(pidKey, seedV, 'bf') * pool.length)];
            out.mats[id] = (out.mats[id] || 0) + 1;
          }
        }
        p.bossBest[bdef.id] = stars;
      }
    }
  }

  xpv = Math.round(xpv * xpMul);
  out.xp = xpv;
  p.xp += xpv;
  for (id in out.mats) p.mats[id] = (p.mats[id] || 0) + out.mats[id];
  if (typeof world !== 'undefined' && world && world.res) {
    for (k in out.res) world.res[k] = (world.res[k] || 0) + out.res[k];
  }
  progSave();
  return out;
}

// 材料轉換:同品階 matConvert 個 → 1 個指定材料(不跨品階)
function progMatConvert(fromId, toId) {
  var p = progGet(), n = PROG_REWARD.matConvert, have;
  if (!PROG_MATS[fromId] || !PROG_MATS[toId]) return { ok: false, reason: '未知材料' };
  if (fromId === toId) return { ok: false, reason: '同一種材料無法轉換' };
  if (PROG_MATS[fromId].tier !== PROG_MATS[toId].tier) return { ok: false, reason: '只能同品階轉換' };
  have = p.mats[fromId] || 0;
  if (have < n) return { ok: false, reason: '材料不足:' + PROG_MATS[fromId].name + '(' + have + ' / ' + n + ')' };
  p.mats[fromId] -= n;
  p.mats[toId] = (p.mats[toId] || 0) + 1;
  progSave();
  return { ok: true, reason: '' };
}

// ───── 測試用(只供介面「測試工具」區使用;正式流程不呼叫)─────
// 直接設為 n 級:補足該級升級所需的經驗、材料、資源(只加不扣),並滿足首領與教學條件。
function progDebugSetLv(n) {
  var p = progGet(), L = progInt(n, 1, PROG_LV_MAX, 1), c, id, k;
  p.lv = L;
  if (L < PROG_LV_MAX) {
    c = progUpgradeCost(L);
    p.xp = c.xp;
    for (id in c.mats) p.mats[id] = Math.max(p.mats[id] || 0, c.mats[id]);
    if (c.boss) p.bossBest[c.boss] = Math.max(p.bossBest[c.boss] || 0, 1);
    if (c.ftue) p.ftue.done[c.ftue] = true;
    if (typeof world !== 'undefined' && world && world.res) {
      for (k in c.res) world.res[k] = Math.max(world.res[k] || 0, c.res[k]);
    }
  } else {
    p.xp = 0;
  }
  progSave();
  if (typeof saveWorld === 'function') saveWorld();
  return p.lv;
}

// 測試用:資源(world.res 內所有鍵與金木石)與各材料補滿到 PROG_DEBUG_GRANT
function progDebugGrantAll() {
  var p = progGet(), keys = ['coin', 'wood', 'stone'];
  if (typeof world !== 'undefined' && world && world.res) {
    Object.keys(world.res).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    keys.forEach(function (k) { world.res[k] = PROG_DEBUG_GRANT; });
  }
  Object.keys(PROG_MATS).forEach(function (id) { p.mats[id] = PROG_DEBUG_GRANT; });
  progSave();
  if (typeof saveWorld === 'function') saveWorld();
  return { ok: true };
}

// 測試用:升一級,忽略首領條件與資源
function progDebugUp() {
  var p = progGet();
  if (p.lv < PROG_LV_MAX) p.lv += 1;
  progSave();
  return p.lv;
}
