// saveslots.js — 平行世界(WORLD_COUNT 個獨立進度)+ 每世界 SNAPSHOTS_PER_WORLD 個回溯點 + 2 個復原槽。術語見 tools/savekeys.md。
// 資料放 IndexedDB「lorddomain-saves」:store slots(內容)/ meta(摘要),key = 1..WORLD_COUNT(非使用中世界的快照)/ 'w{世界}s{1..N}'(回溯點)/ 'undo1' / 'undo2'。
// 使用中世界仍放原 localStorage 進度鍵;世界狀態(使用中、名稱、離開時間、pending 切換標記)放 localStorage 'lorddomain.worlds.v1'。
// 內容 = 進度類 localStorage 鍵的整組字串 {v:1, keys:{key:string}},以 CompressionStream('gzip') 壓縮(無該 API 退回 raw,meta.enc 標示,讀取依 enc 判斷)。
// 鍵分類見 tools/savekeys.md:進度鍵(SAVE_SLOT_KEYS)進槽;偏好鍵(SAVE_PREF_KEYS)讀檔後保留目前值;備份/損毀副本鍵不動。
// 切換世界 = 目前世界寫回自己的槽並驗證 → 備份復原槽 → pending 標記 → saveSuspend=true → 整組取代進度鍵 → 更新 worlds → location.reload();切回的世界依自己的 lastTs 走離線結算。
// 純邏輯、無 DOM(介面在 savesui.js)。ES2017,載入時只宣告。

var WORLD_COUNT = 3;             // 平行世界數(可調高;UI 與儲存鍵依此產生)
var SNAPSHOTS_PER_WORLD = 3;     // 每個世界的回溯點數
var SAVE_SLOT_COUNT = WORLD_COUNT;
var WORLDS_KEY = 'lorddomain.worlds.v1';
var WORLDS_LOCK_KEY = 'lorddomain.worlds.lock';
var WORLDS_LOCK_MS = 30000;
var SAVE_LEGACY_KEY = 'lorddomain.legacymig.v1';   // 舊版(v31)手動存檔槽遷移進度 {n:已轉成回溯點的數量, done}
var WORLD_TAG_KEY = 'lorddomain.ui.worldtag';   // '0' = 關閉世界小標籤
var SAVE_UNDO_IDS = ['undo1', 'undo2'];
var SAVE_DB_NAME = 'lorddomain-saves';
var SAVE_KEY_MAIN = 'lorddomain.save.v1';
var SAVE_KEY_PROG = 'lorddomain.prog.v1';
var SAVE_NOOFFLINE_KEY = 'lorddomain.load.noOffline';   // 舊版旗標(已不再使用);啟動時若殘留一律清除

// 進度鍵:整組進槽;讀檔時槽內沒有的會被移除(避免殘留)
var SAVE_SLOT_KEYS = ['lorddomain.save.v1', 'lorddomain.prog.v1', 'lorddomain.fish.v1', 'lorddomain.pet.v1', 'lorddomain.caravan.v1', 'lorddomain.visit.v1', 'lorddomain.bn.v1', 'lorddomain.bnlog.v1', 'lorddomain.bnteam.v1', 'lorddomain.bnbook.v1', 'lorddomain.bnskc.v1', 'lorddomain.tourney.v1', 'lorddomain.wm.v1'];
// 暫態進度鍵:不進槽,但讀檔 / 重新開始時一律清掉(與舊盤面綁定,留著會錯亂)
var SAVE_TRANSIENT_KEYS = ['lorddomain.draft.v1'];
// 偏好鍵:不進槽,讀檔 / 重新開始後保留目前值
var SAVE_PREF_KEYS = [
  'lorddomain.settings.v1', 'lorddomain.mute', 'lorddomain.bgm.pick', 'lorddomain.bgm.rot', 'lorddomain.art.v1', 'lorddomain.life.v1',
  'lorddomain.render', 'lorddomain.fps', 'lorddomain.powersave', 'lorddomain.cityonly', 'lorddomain.adv.mode', 'lorddomain.adv.faceHide', 'lorddomain.guide.v1', 'lorddomain.id.v1',
  'lorddomain.ui.top', 'lorddomain.ui.cat', 'lorddomain.ui.camptop', 'lorddomain.ui.campcat', 'lorddomain.ui.variant', 'lorddomain.ui.wallskin',
  'lorddomain.ui.mode', 'lorddomain.ui.prevMode', 'lorddomain.ui.compact', 'lorddomain.ui.bpreview', 'lorddomain.ui.fsTipDismissed', 'lorddomain.ui.worldtag', 'lorddomain.ui.settingsTab', 'lorddomain.extsprites', 'lorddomain.nextstep', 'lorddomain.uiicons', 'lorddomain.terraintex', 'lorddomain.ui.minimap', 'lorddomain.bn.pref', 'lorddomain.bnshare.pref', 'lorddomain.ui.autoBrowse', 'lorddomain.ui.installTip', 'lorddomain.ui.doorMarks',
  'lorddomain.goods.mode', 'lorddomain.goods.auto'
];
// 世界管理鍵:不進槽、不清除(世界清單 / 跨分頁鎖)
var SAVE_WORLD_KEYS = ['lorddomain.worlds.v1', 'lorddomain.worlds.lock', 'lorddomain.legacymig.v1'];
// 備份 / 損毀副本鍵:不進槽、不清除
var SAVE_BACKUP_KEYS = ['lorddomain.save.pre112.v1', 'lorddomain.save.prenl.v1', 'lorddomain.save.corrupt.v1', 'lorddomain.save.legacy.v1', 'lorddomain.save.legacy.at.v1'];
// 記錄類鍵:不進槽、不清除(錄影 / 路點,量大且與進度無關)
var SAVE_RECORD_KEYS = ['lorddomain.replays.v1', 'lorddomain.rec.waypoints'];

var savesDb = null, savesDbFail = false, savesDbPromise = null;
var savesMetaCache = {};
var savesForceRaw = false;      // 測試 / 緊急:強制不壓縮
var savesAppVerNum = 0;         // 目前 App 版本數字(v30 → 30);0 = 未知,不做版本檢查
var savesReloadFn = null;       // 測試可替換;預設 location.reload()

function savesAvailable() {
  try { return typeof indexedDB !== 'undefined' && !!indexedDB && !savesDbFail; } catch (e) { return false; }
}

// ───────── IndexedDB 小封裝 ─────────
function savesOpen() {
  if (savesDb) return Promise.resolve(savesDb);
  if (savesDbPromise) return savesDbPromise;
  if (!savesAvailable()) return Promise.reject(new Error('noidb'));
  savesDbPromise = new Promise(function (res, rej) {
    var req;
    try { req = indexedDB.open(SAVE_DB_NAME, 1); } catch (e) { savesDbFail = true; savesDbPromise = null; rej(e); return; }
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains('slots')) db.createObjectStore('slots');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = function () { savesDb = req.result; res(savesDb); };
    req.onerror = function () { savesDbFail = true; savesDbPromise = null; rej(req.error || new Error('open-failed')); };
    req.onblocked = function () { savesDbPromise = null; rej(new Error('blocked')); };
  });
  return savesDbPromise;
}

// work(tx, box) 內發出請求並把結果放進 box;交易 complete 才 resolve(寫入以 abort 視為失敗,舊內容不變)
function savesTx(mode, stores, work) {
  return savesOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx, box = {};
      try {
        tx = db.transaction(stores, mode);
        work(tx, box);
      } catch (e) { rej(e); return; }
      tx.oncomplete = function () { res(box); };
      tx.onerror = function () { rej(tx.error || new Error('tx-error')); };
      tx.onabort = function () { rej(tx.error || new Error('tx-abort')); };
    });
  });
}

function savesIdbGet(id) {
  return savesTx('readonly', ['slots', 'meta'], function (tx, box) {
    var a = tx.objectStore('slots').get(id), b = tx.objectStore('meta').get(id);
    a.onsuccess = function () { box.rec = a.result; };
    b.onsuccess = function () { box.meta = b.result; };
  }).then(function (box) { return { rec: box.rec || null, meta: box.meta || null }; });
}

function savesIdbPut(id, rec, meta) {
  return savesTx('readwrite', ['slots', 'meta'], function (tx) {
    tx.objectStore('slots').put(rec, id);
    tx.objectStore('meta').put(meta, id);
  }).then(function () { savesMetaCache[id] = meta; });
}

function savesIdbDel(id) {
  return savesTx('readwrite', ['slots', 'meta'], function (tx) {
    tx.objectStore('slots').delete(id);
    tx.objectStore('meta').delete(id);
  }).then(function () { delete savesMetaCache[id]; });
}

// ───────── 壓縮 ─────────
function savesPipe(stream, u8) {
  var w = stream.writable.getWriter(), r = stream.readable.getReader(), chunks = [], total = 0;
  var wp = w.write(u8).then(function () { return w.close(); });
  function pump() {
    return r.read().then(function (x) {
      if (x.done) return;
      chunks.push(x.value); total += x.value.length;
      return pump();
    });
  }
  return Promise.all([wp, pump()]).then(function () {
    var out = new Uint8Array(total), o = 0;
    chunks.forEach(function (c) { out.set(c, o); o += c.length; });
    return out;
  });
}

// → { enc:'gzip'|'raw', data:ArrayBuffer|string, bytes }
async function savesEncode(str) {
  if (!savesForceRaw && typeof CompressionStream === 'function' && typeof TextEncoder === 'function') {
    try {
      var z = await savesPipe(new CompressionStream('gzip'), new TextEncoder().encode(str));
      var ab = new ArrayBuffer(z.length);
      new Uint8Array(ab).set(z);
      return { enc: 'gzip', data: ab, bytes: z.length };
    } catch (e) { /* 壓縮失敗:退回 raw */ }
  }
  return { enc: 'raw', data: str, bytes: typeof TextEncoder === 'function' ? new TextEncoder().encode(str).length : str.length * 2 };
}

async function savesDecode(rec) {
  if (!rec) throw new Error('empty');
  if (rec.enc === 'raw') return String(rec.data);
  if (rec.enc !== 'gzip') throw new Error('enc?');
  if (typeof DecompressionStream !== 'function') throw new Error('nodecompress');
  var u8 = await savesPipe(new DecompressionStream('gzip'), new Uint8Array(rec.data));
  return new TextDecoder().decode(u8);
}

// ───────── 捕捉 / 摘要 ─────────
function savesLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

// 先把記憶體寫進 localStorage(saveWorld / progSave),再讀進度鍵
function savesFlush() {
  try { if (typeof saveWorld === 'function') saveWorld(); } catch (e) { /* 略過 */ }
  try { if (typeof progSave === 'function' && typeof prog !== 'undefined' && prog) progSave(); } catch (e2) { /* 略過 */ }
}

function savesCapture() {
  var keys = {};
  SAVE_SLOT_KEYS.forEach(function (k) { var v = savesLsGet(k); if (v !== null) keys[k] = v; });
  return { v: 1, keys: keys };
}

function savesSummarize(snap, livePop) {
  var lv = 0, techN = 0, pop = livePop >= 0 ? livePop : 0, s, p;
  try { p = JSON.parse(snap.keys[SAVE_KEY_PROG]); if (p && p.lv > 0) lv = p.lv | 0; } catch (e) { /* 略過 */ }
  try {
    s = JSON.parse(snap.keys[SAVE_KEY_MAIN]);
    if (s && s.city && s.city.tech && s.city.tech.done) techN = Object.keys(s.city.tech.done).filter(function (k) { return s.city.tech.done[k]; }).length;
  } catch (e2) { /* 略過 */ }
  return { lv: lv, pop: pop, techN: techN, wid: savesSnapWorldId(snap.keys[SAVE_KEY_MAIN]) };
}

function savesLivePop() {
  try { if (typeof cityscoreGet === 'function') { var S = cityscoreGet(); if (S && S.pop >= 0) return S.pop; } } catch (e) { /* 略過 */ }
  return -1;
}

function savesTwo(n) { return (n < 10 ? '0' : '') + n; }
function savesTimeText(ts) {
  var d = new Date(ts);
  return savesTwo(d.getMonth() + 1) + '/' + savesTwo(d.getDate()) + ' ' + savesTwo(d.getHours()) + ':' + savesTwo(d.getMinutes());
}
function savesDefaultName(sum, ts) {
  return (sum.lv ? 'Lv' + sum.lv : '') + '城 · 人口' + (typeof fmtPop === 'function' ? fmtPop(sum.pop) : sum.pop) + ' · ' + savesTimeText(ts);
}
function savesCleanName(n) { return Array.from(String(n == null ? '' : n).trim()).slice(0, 20).join(''); }
function savesKb(bytes) { return Math.max(0.1, Math.round(bytes / 102.4) / 10); }

// ───────── 版本 ─────────
function savesVerNum(text) { var m = /(\d+)/.exec(String(text || '')); return m ? parseInt(m[1], 10) : 0; }
function savesLoadAppVer() {
  if (savesAppVerNum > 0) return Promise.resolve(savesAppVerNum);
  if (typeof stVerText === 'string' && savesVerNum(stVerText) > 0) { savesAppVerNum = savesVerNum(stVerText); return Promise.resolve(savesAppVerNum); }
  if (typeof fetch !== 'function') return Promise.resolve(0);
  return fetch('sw.js', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
    var m = /const VERSION = '([^']+)'/.exec(t);
    if (m) savesAppVerNum = savesVerNum(m[1]);
    return savesAppVerNum;
  }).catch(function () { return 0; });
}

// ───────── 提示 ─────────
function savesToast(msg) { try { if (typeof showToast === 'function') showToast(msg); } catch (e) { /* 略過 */ } }


// ───────── 世界 / 回溯點 識別 ─────────
function savesIsWorldId(id) { return typeof id === 'number' && id >= 1 && id <= WORLD_COUNT && id === Math.floor(id); }
function savesRbId(n, k) { return 'w' + n + 's' + k; }
function savesParseRb(id) {
  var m = /^w(\d+)s(\d+)$/.exec(String(id)), n, k;
  if (!m) return null;
  n = parseInt(m[1], 10); k = parseInt(m[2], 10);
  return (n >= 1 && n <= WORLD_COUNT && k >= 1 && k <= SNAPSHOTS_PER_WORLD) ? { w: n, k: k } : null;
}
function savesValidId(id) { return savesIsWorldId(id) || SAVE_UNDO_IDS.indexOf(id) >= 0 || !!savesParseRb(id); }
function worldLabel(n) { return '平行世界 ' + savesTwo(n); }
function worldTitle(n, name) { return worldLabel(n) + (name ? ' · ' + name : ''); }
function worldTagText(n) { return '世 ' + savesTwo(n); }
function worldTagOn() { return savesLsGet(WORLD_TAG_KEY) !== '0'; }
function savesAwayText(sec) {
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return (h > 0 ? h + ' 小時 ' : '') + m + ' 分';
}

// 快照 / 存檔字串內的世界編號(0 = 舊存檔沒有此欄位)
function savesSnapWorldId(str) {
  try { var s = JSON.parse(str); return s && savesIsWorldId(s.worldId) ? s.worldId : 0; } catch (e) { return 0; }
}
function savesSnapMatch(snap, n) {
  var wid = savesSnapWorldId(snap && snap.keys && snap.keys[SAVE_KEY_MAIN]);
  return wid === 0 || wid === n;
}
// 套用前把主存檔的 worldId / worldName 改成目標世界;opts.now = lastTs 設為現在(回溯 / 復原用,不補發離線)
function savesRestamp(keys, n, opts) {
  var out = {}, k, s, w = worldsGet();
  for (k in keys) out[k] = keys[k];
  try {
    s = JSON.parse(out[SAVE_KEY_MAIN]);
    s.worldId = n;
    if (w.names[n]) s.worldName = w.names[n]; else delete s.worldName;
    if (opts && opts.now) s.lastTs = Date.now();
    out[SAVE_KEY_MAIN] = JSON.stringify(s);
  } catch (e) { /* 主存檔不是 JSON:原樣 */ }
  return out;
}

// ───────── 世界清單(localStorage 小檔,同步讀寫) ─────────
function worldsNorm(v) {
  var w = { active: 1, names: {}, lastActive: {} }, k, nm = v && v.names, la = v && v.lastActive;
  if (!v || typeof v !== 'object') return w;
  if (savesIsWorldId(v.active)) w.active = v.active;
  if (nm && typeof nm === 'object') for (k in nm) if (savesIsWorldId(+k) && typeof nm[k] === 'string') w.names[k] = savesCleanName(nm[k]);
  if (la && typeof la === 'object') for (k in la) if (savesIsWorldId(+k) && typeof la[k] === 'number') w.lastActive[k] = la[k];
  worldsNormPacks(v, w);
  if (v.pending && savesIsWorldId(v.pending.from) && savesIsWorldId(v.pending.to)) w.pending = { from: v.pending.from, to: v.pending.to };
  if (v.arrived && savesIsWorldId(v.arrived.to)) w.arrived = { to: v.arrived.to, left: typeof v.arrived.left === 'number' ? v.arrived.left : null, fresh: !!v.arrived.fresh };
  return w;
}
// 世界風格 meta(js/worldwizard.js):packs[n] = {id:風格 id, ver:1}(無欄位 = han);fresh[n] = {pack, tpl} 為「下次此世界全新啟動」時套用的一次性設定,啟動後即清除
function worldsPackOk(p) { return !!p && typeof p === 'object' && typeof p.id === 'string' && /^[a-z0-9_]{1,16}$/.test(p.id); }
function worldsNormPacks(v, w) {
  var k, f;
  if (v.packs && typeof v.packs === 'object') {
    for (k in v.packs) if (savesIsWorldId(+k) && worldsPackOk(v.packs[k])) { if (!w.packs) w.packs = {}; w.packs[k] = { id: v.packs[k].id, ver: 1 }; }
  }
  if (v.fresh && typeof v.fresh === 'object') {
    for (k in v.fresh) {
      f = v.fresh[k];
      if (savesIsWorldId(+k) && f && typeof f === 'object' && typeof f.pack === 'string' && /^[a-z0-9_]{1,16}$/.test(f.pack)) {
        if (!w.fresh) w.fresh = {};
        w.fresh[k] = { pack: f.pack, tpl: typeof f.tpl === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(f.tpl) ? f.tpl : '' };
      }
    }
  }
}
function worldsPut(w) {
  try { localStorage.setItem(WORLDS_KEY, JSON.stringify(w)); return true; } catch (e) { return false; }
}
// 無此鍵(舊使用者升級 / 全新)→ 既有進度視為第 1 世界
function worldsGet() {
  var raw = savesLsGet(WORLDS_KEY), w;
  if (raw !== null) { try { return worldsNorm(JSON.parse(raw)); } catch (e) { /* 損毀:重建 */ } }
  w = worldsNorm(null);
  w.lastActive[1] = Date.now();
  worldsPut(w);
  return w;
}
function worldsActive() { return worldsGet().active; }
// 清掉空的 packs / fresh 物件(沒有內容時不留欄位,舊存檔位元組不變)
function worldsPackPrune(w) {
  if (w.packs && !Object.keys(w.packs).length) delete w.packs;
  if (w.fresh && !Object.keys(w.fresh).length) delete w.fresh;
}
// 世界 n 的風格 id(舊世界 / 無欄位 / 未知 = 'han')
function worldsPackOf(n, w) { var m = w || worldsGet(), p = m.packs && m.packs[n]; return p ? p.id : 'han'; }
// 把使用中世界目前的城市風格記進 meta(w 為呼叫端持有的 worlds 物件,不自行寫入);回 true = 有變動
function worldsPackNote(w, n) {
  var cur;
  if (typeof themeGet !== 'function' || n !== w.active) return false;
  cur = themeGet();
  if (worldsPackOf(n, w) === cur && (cur === 'han' || (w.packs && w.packs[n]))) return false;
  if (cur === 'han' && !(w.packs && w.packs[n])) return false;
  if (!w.packs) w.packs = {};
  w.packs[n] = { id: cur, ver: 1 };
  return true;
}
// map.js saveWorldObj 呼叫:把世界編號 / 名稱寫進該世界自己的主存檔
function worldsStamp(o) {
  var w = worldsGet();
  o.worldId = w.active;
  if (w.names[w.active]) o.worldName = w.names[w.active]; else delete o.worldName;
}
// 進度鍵裡的 worldId 與 worlds.active 不一致(例如還原了舊備份)→ 以進度鍵為準
function worldsHeal() {
  var w = worldsGet(), wid = savesSnapWorldId(savesLsGet(SAVE_KEY_MAIN));
  if (wid && wid !== w.active) { w.active = wid; w.lastActive[wid] = Date.now(); worldsPut(w); return wid; }
  return 0;
}

// ───────── 跨分頁鎖 ─────────
async function worldsWithLock(fn) {
  var busyMsg = '另一個分頁正在操作世界,請稍後再試', tok, cur, parts;
  if (typeof navigator !== 'undefined' && navigator && navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request('lorddomain-worlds', { ifAvailable: true }, async function (lock) {
      if (!lock) { savesToast(busyMsg); return { ok: false, reason: 'busy' }; }
      return fn();
    });
  }
  tok = String(Math.random());
  cur = savesLsGet(WORLDS_LOCK_KEY);
  if (cur) { parts = cur.split('|'); if (Date.now() - (+parts[0] || 0) < WORLDS_LOCK_MS) { savesToast(busyMsg); return { ok: false, reason: 'busy' }; } }
  try { localStorage.setItem(WORLDS_LOCK_KEY, Date.now() + '|' + tok); } catch (e) { /* 鎖寫不進去:照做 */ }
  try { return await fn(); } finally {
    if ((savesLsGet(WORLDS_LOCK_KEY) || '').split('|')[1] === tok) { try { localStorage.removeItem(WORLDS_LOCK_KEY); } catch (e2) { /* 略過 */ } }
  }
}

// ───────── 寫槽 / 讀槽 ─────────
// 把 snap 寫入 id(寫入失敗:舊內容保留,reject)
async function savesWriteSnap(id, snap, name, livePop, ver) {
  var str = JSON.stringify(snap), enc = await savesEncode(str), sum = savesSummarize(snap, livePop), ts = Date.now();
  var meta = { name: name || '', ts: ts, ver: ver || 0, pop: sum.pop, lv: sum.lv, techN: sum.techN, wid: sum.wid, kb: savesKb(enc.bytes), enc: enc.enc };
  await savesIdbPut(id, { enc: enc.enc, data: enc.data }, meta);
  return meta;
}

// 讀並驗證一個槽:{ok, snap, meta} 或 {ok:false, reason:'empty'|'idb'|'corrupt'}
async function savesReadSnap(id) {
  var got, snap;
  try { got = await savesIdbGet(id); } catch (e) { return { ok: false, reason: 'idb' }; }
  if (!got.rec || !got.meta) return { ok: false, reason: 'empty' };
  try {
    snap = JSON.parse(await savesDecode(got.rec));
    if (!snap || typeof snap.keys !== 'object' || typeof snap.keys[SAVE_KEY_MAIN] !== 'string') throw new Error('shape');
    JSON.parse(snap.keys[SAVE_KEY_MAIN]);
  } catch (e2) { return { ok: false, reason: 'corrupt' }; }
  return { ok: true, snap: snap, meta: got.meta };
}

// 復原槽備份:輪替 undo1 → undo2,新備份寫入 undo1(最近 2 份)。快照在呼叫當下同步取得;label = 備份原因;
// over = {snap, pop} 時備份指定快照(例如非使用中世界的槽內容)而不是目前狀態
function savesBackupUndo(label, over) {
  var snap, pop, ts = Date.now();
  if (!savesAvailable()) return Promise.resolve({ ok: false, reason: 'unavailable' });
  if (over) { snap = over.snap; pop = over.pop >= 0 ? over.pop : 0; } else { savesFlush(); snap = savesCapture(); pop = savesLivePop(); }
  return (async function () {
    var ver = await savesLoadAppVer(), cur;
    try {
      cur = await savesIdbGet('undo1');
      if (cur.rec && cur.meta) await savesIdbPut('undo2', cur.rec, cur.meta);
      return { ok: true, meta: await savesWriteSnap('undo1', snap, '復原點:' + (label || '手動') + ' · ' + savesTimeText(ts), pop, ver) };
    } catch (e) {
      savesToast('無法建立復原點(儲存空間不足或不可用)');
      return { ok: false, reason: 'write' };
    }
  })();
}

function savesSuspendOn() { try { saveSuspend = true; } catch (e) { /* map.js 未載入 */ } }
function savesSuspendOff() { try { saveSuspend = false; } catch (e) { /* 略過 */ } }

function savesReload() {
  try {
    if (typeof savesReloadFn === 'function') savesReloadFn();
    else if (typeof location !== 'undefined' && location.reload) location.reload();
  } catch (e) { /* 略過 */ }
}

// 整組取代進度鍵;失敗還原。keysObj = null 表示全清(重新開始 / 新世界)
function savesApplyKeys(keysObj) {
  var before = {}, i, k;
  for (i = 0; i < SAVE_SLOT_KEYS.length; i++) before[SAVE_SLOT_KEYS[i]] = savesLsGet(SAVE_SLOT_KEYS[i]);
  try {
    SAVE_SLOT_KEYS.forEach(function (key) {
      if (keysObj && typeof keysObj[key] === 'string') localStorage.setItem(key, keysObj[key]);
      else localStorage.removeItem(key);
    });
    SAVE_TRANSIENT_KEYS.forEach(function (key) { localStorage.removeItem(key); });
    return true;
  } catch (e) {
    for (k in before) { try { if (before[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, before[k]); } catch (e2) { /* 略過 */ } }
    return false;
  }
}

async function savesVerOk(meta) {
  var appVer = await savesLoadAppVer();
  if (appVer > 0 && meta.ver > appVer) { savesToast('此內容來自較新版本(v' + meta.ver + '),請先更新 App'); return false; }
  return true;
}

// 把復原點 / 回溯點套到「目前使用中的世界」(id = 'undo1' / 'undo2' / 回溯點 id)。先備份目前狀態;lastTs 設為現在(不補發離線);成功會 reload
async function savesLoad(id, opts) {
  var o = opts || {}, rd, b, w = worldsGet(), rb;
  if (!savesAvailable() || (SAVE_UNDO_IDS.indexOf(id) < 0 && !savesParseRb(id))) return { ok: false, reason: 'unavailable' };
  rd = await savesReadSnap(id);
  if (!rd.ok) { if (rd.reason === 'corrupt') savesToast('此內容無法讀取(損毀),目前進度未變更'); return { ok: false, reason: rd.reason }; }
  rb = savesParseRb(id);
  if (!savesSnapMatch(rd.snap, rb ? rb.w : w.active)) { savesToast('內容的世界編號不符,已拒絕'); return { ok: false, reason: 'mismatch' }; }
  if (!(await savesVerOk(rd.meta))) return { ok: false, reason: 'newer' };
  if (!o.skipBackup) {
    b = await savesBackupUndo(rb ? '回到回溯點前' : '復原前');
    if (!b.ok) return { ok: false, reason: 'nobackup' };
  }
  savesSuspendOn();
  if (!savesApplyKeys(savesRestamp(rd.snap.keys, w.active, { now: true }))) {
    savesSuspendOff();
    savesToast('套用失敗(儲存空間不足),目前進度未變更');
    return { ok: false, reason: 'apply' };
  }
  savesReload();
  return { ok: true };
}

// 重新開始目前世界:備份後清掉全部進度鍵(偏好、其他世界、回溯點保留),reload 後走既有新遊戲流程
async function savesRestartAll(opts) {
  var o = opts || {}, b;
  if (!o.skipBackup) {
    b = await savesBackupUndo('重新開始前');
    if (!b.ok && !o.force) return { ok: false, reason: 'nobackup' };
  }
  savesSuspendOn();
  if (!savesApplyKeys(null)) { savesSuspendOff(); savesToast('重新開始失敗(儲存空間不可用)'); return { ok: false, reason: 'apply' }; }
  savesReload();
  return { ok: true };
}

// 清除陣地:只清目前世界的戰陣板(camp);經營板、科技、卡牌、庫房不動。僅經營模式可用
function savesClearCamp() {
  if (typeof game === 'undefined' || game.mode !== 'estate' || game.backup || world.board !== 'estate') return { ok: false, reason: 'mode' };
  world.stash = null;
  try { if (typeof pendClear === 'function') pendClear(); } catch (e) { /* 略過 */ }
  saveWorld();
  try { if (typeof mapeditUpdateDot === 'function') mapeditUpdateDot(); } catch (e2) { /* 略過 */ }
  return { ok: true };
}

// 清空領地:清目前世界經營板的建築與地形,資源與科技進度保留(與 ui.js btnClear 同流程,無確認)
function savesClearEstate() {
  if (typeof game === 'undefined' || game.mode !== 'estate' || game.backup || world.board !== 'estate') return { ok: false, reason: 'mode' };
  if (typeof draftDiscard === 'function') draftDiscard();
  if (typeof pendClear === 'function') pendClear();
  if (typeof hideReset === 'function') hideReset();
  clearWorld();
  saveWorld();
  if (typeof updateResBar === 'function') updateResBar();
  return { ok: true };
}

// 動作說明文案(確認視窗與測試共用)
var SAVE_ACTIONS = {
  camp: { title: '清除陣地', text: '只影響目前這個世界,不影響其他世界。\n會清掉:戰陣板(戰鬥陣)上的全部布置。\n保留:經營領地的建築與地形、資源、科技、卡牌、庫房、城市等級。\n清除前會自動建立復原點,可從設定「復原上一步」找回。' },
  estate: { title: '清空領地', text: '只影響目前這個世界,不影響其他世界。\n會清掉:經營領地(經營板)上的全部建築與地形。\n保留:資源、科技進度、卡牌、庫房、城市等級、戰陣板。\n清除前會自動建立復原點,可從設定「復原上一步」找回。' },
  all: { title: '重新開始目前世界', text: '會清掉:目前這個世界的所有進度(領地、戰陣、資源、科技、卡牌、城市等級、釣魚與仙獸)。\n保留:聲音、畫質、介面等偏好設定、其他世界、此世界的回溯點。\n重新開始前會自動建立復原點,可從設定「復原上一步」找回。' }
};

// 執行一個動作:先彈說明確認(opts.confirm 可替換),備份復原點,再執行。回 {ok, reason}
async function savesDoAction(kind, opts) {
  var o = opts || {}, a = SAVE_ACTIONS[kind], ask = typeof o.confirm === 'function' ? o.confirm : (typeof confirm === 'function' ? confirm : null), b, r;
  if (!a) return { ok: false, reason: 'kind' };
  if (!ask || !ask(a.title + '\n\n' + a.text)) return { ok: false, reason: 'declined' };
  if (kind !== 'all' && (typeof game === 'undefined' || game.mode !== 'estate' || game.backup)) { savesToast('請先回到領地畫面再操作'); return { ok: false, reason: 'mode' }; }
  if (kind === 'all') {
    return worldsWithLock(async function () {
      var bk = await savesBackupUndo(a.title);
      if (!bk.ok && !ask('無法建立復原點,之後將無法復原。仍要「' + a.title + '」嗎?')) return { ok: false, reason: 'nobackup' };
      return savesRestartAll({ skipBackup: true });
    });
  }
  b = await savesBackupUndo(a.title);
  if (!b.ok && !ask('無法建立復原點,之後將無法復原。仍要「' + a.title + '」嗎?')) return { ok: false, reason: 'nobackup' };
  r = kind === 'camp' ? savesClearCamp() : savesClearEstate();
  if (r.ok) savesToast(a.title + '完成(可從設定「復原上一步」找回)');
  return r;
}

// ───────── 切換 / 重新開始 / 刪除 世界 ─────────
// 進入世界 to(空世界 = 新世界)。目前世界先寫回自己的槽並驗證,失敗就不切換;成功會 reload
async function worldsEnter(to) {
  if (!featureOn('multiworld')) return { ok: false, reason: 'dormant' };   // @DORMANT multiworld
  if (!savesAvailable()) return { ok: false, reason: 'unavailable' };
  if (!savesIsWorldId(to)) return { ok: false, reason: 'id' };
  return worldsWithLock(async function () {
    var w = worldsGet(), from = w.active, rd, keys = null, snap, ver, meta, chk, b, left, fresh = false;
    if (to === from) return { ok: false, reason: 'same' };
    if (savesLegacyPending()) { savesToast('舊存檔還在轉移中,暫時不能切換世界,請重新開啟 App 後再試'); return { ok: false, reason: 'legacy' }; }
    ver = await savesLoadAppVer();
    rd = await savesReadSnap(to);
    if (rd.reason === 'idb') { savesToast('讀取失敗,未切換'); return { ok: false, reason: 'idb' }; }
    if (rd.reason === 'corrupt') { savesToast(worldLabel(to) + ' 的內容損毀,未切換'); return { ok: false, reason: 'corrupt' }; }
    if (rd.ok) {
      if (!savesSnapMatch(rd.snap, to)) { savesToast(worldLabel(to) + ' 的內容編號不符,已拒絕進入'); return { ok: false, reason: 'mismatch' }; }
      if (!(await savesVerOk(rd.meta))) return { ok: false, reason: 'newer' };
      keys = rd.snap.keys;
    } else fresh = true;
    savesFlush();
    snap = savesCapture();
    try {
      meta = await savesWriteSnap(from, snap, w.names[from] || '', savesLivePop(), ver);
      chk = await savesIdbGet(from);
      if (!chk.rec || !chk.meta || chk.meta.ts !== meta.ts) throw new Error('verify');
    } catch (e) {
      savesToast('目前世界寫回失敗(儲存空間不足?),未切換');
      return { ok: false, reason: 'write' };
    }
    b = await savesBackupUndo('切換世界前');
    if (!b.ok) return { ok: false, reason: 'nobackup' };
    w = worldsGet();
    left = w.lastActive[to] || null;
    worldsPackNote(w, from);
    w.pending = { from: from, to: to };
    if (!worldsPut(w)) { savesToast('無法記錄切換狀態,未切換'); return { ok: false, reason: 'apply' }; }
    savesSuspendOn();
    if (!savesApplyKeys(keys ? savesRestamp(keys, to, {}) : null)) {
      savesSuspendOff();
      delete w.pending; worldsPut(w);
      savesToast('切換失敗(儲存空間不足),目前世界未變更');
      return { ok: false, reason: 'apply' };
    }
    delete w.pending;
    w.active = to; w.lastActive[from] = Date.now(); w.lastActive[to] = Date.now();
    w.arrived = { to: to, left: left, fresh: fresh };
    worldsPut(w);
    savesReload();
    return { ok: true, fresh: fresh };
  });
}

// 啟動時掛點(index.html → main.js):有 pending(切換途中被打斷)就依 pending 完成或回復,再呼叫 fn(boot)
function worldsStartup(fn) {
  var w = null, existed = savesLsGet(WORLDS_KEY) !== null;
  try { localStorage.removeItem(SAVE_NOOFFLINE_KEY); } catch (e) { /* 略過 */ }
  try { w = worldsGet(); } catch (e2) { w = null; }
  if (w && w.pending) {
    worldsRecover(w).then(function () { fn(); }, function () { fn(); });
    return;
  }
  try { worldsHeal(); } catch (e3) { /* 略過 */ }
  if (savesAvailable()) {
    if (!existed && !savesLegacyState()) {   // 第一次建立世界清單:先記下「遷移未完成」,失敗時下次啟動重試
      if (!savesLegacyPut({ n: 0, done: false })) { try { localStorage.removeItem(WORLDS_KEY); } catch (e4) { /* 略過 */ } fn(); return; }
    }
    if (savesLegacyPending()) {
      savesLegacyMigrate().then(function () { fn(); }, function () { fn(); });
      return;
    }
  }
  fn();
}

// ───────── 舊版(v31)手動存檔槽遷移 ─────────
// 舊版把快照放 IndexedDB 數字鍵 1~20。新版數字鍵 1~WORLD_COUNT 是「世界快照」,所以要在第一次建立世界清單時搬走:
// 有內容的前 SNAPSHOTS_PER_WORLD 個依槽號順序 → 平行世界 01 的回溯點 1~3;其餘改名 legacy{n} 保留(介面不顯示,日後可救回)。
// 每筆「先寫入新鍵並驗證、記下進度、才刪舊鍵」;任何一步失敗都不刪舊槽,下次啟動從進度繼續。復原槽 undo1/undo2 不動。
function savesLegacyState() {
  var raw = savesLsGet(SAVE_LEGACY_KEY), s;
  if (raw === null) return null;
  try { s = JSON.parse(raw); return { n: s && s.n > 0 ? s.n | 0 : 0, done: !!(s && s.done) }; } catch (e) { return { n: 0, done: false }; }
}
function savesLegacyPut(st) {
  try { localStorage.setItem(SAVE_LEGACY_KEY, JSON.stringify({ n: st.n, done: !!st.done })); return true; } catch (e) { return false; }
}
function savesLegacyPending() { var s = savesLegacyState(); return !!s && !s.done; }

// 回傳 {rec, meta} 供寫入回溯點,或 null(內容不是可用快照 / 世界編號不符 → 改存 legacy)。舊快照沒有 worldId 視為相符並補上 1
async function savesLegacyConvert(rec, meta, i, appVer) {
  var snap, main, enc, mt, k;
  try {
    snap = JSON.parse(await savesDecode(rec));
    main = JSON.parse(snap.keys[SAVE_KEY_MAIN]);
  } catch (e) { return null; }
  if (!savesSnapMatch(snap, 1)) return null;
  mt = {};
  for (k in meta) mt[k] = meta[k];
  mt.name = savesCleanName(meta.name) || '舊存檔 ' + i;
  mt.wid = 1;
  if (appVer > 0 && meta.ver > appVer) mt.legacy = true;   // 來自較新版本:仍搬移,讀取時照常被版本檢查擋下
  if (main && typeof main === 'object' && !savesIsWorldId(main.worldId)) {
    main.worldId = 1;
    snap.keys[SAVE_KEY_MAIN] = JSON.stringify(main);
    enc = await savesEncode(JSON.stringify(snap));
    mt.kb = savesKb(enc.bytes); mt.enc = enc.enc;
    return { rec: { enc: enc.enc, data: enc.data }, meta: mt };
  }
  return { rec: rec, meta: mt };
}

async function savesLegacyMigrate() {
  var st = savesLegacyState() || { n: 0, done: false }, box, i, rec, meta, dest, conv, chk, appVer, moved = 0, kept = 0;
  if (st.done) return { ok: true, moved: 0, kept: 0 };
  try {
    appVer = await savesLoadAppVer();
    box = await savesTx('readonly', ['slots', 'meta'], function (tx, b) {
      var n;
      b.r = {}; b.m = {};
      for (n = 1; n <= 20; n++) (function (k) {
        var a = tx.objectStore('slots').get(k), c = tx.objectStore('meta').get(k);
        a.onsuccess = function () { b.r[k] = a.result; };
        c.onsuccess = function () { b.m[k] = c.result; };
      })(n);
    });
    for (i = 1; i <= 20; i++) {
      rec = box.r[i];
      if (!rec) continue;
      meta = box.m[i] || { name: '', ts: 0, ver: 0, pop: 0, lv: 0, techN: 0, kb: 0, enc: rec.enc };
      conv = st.n < SNAPSHOTS_PER_WORLD ? await savesLegacyConvert(rec, meta, i, appVer) : null;
      if (conv) {
        dest = savesRbId(1, st.n + 1);
        await savesIdbPut(dest, conv.rec, conv.meta);
        chk = await savesIdbGet(dest);
        if (!chk.rec || !chk.meta) throw new Error('verify');
        st.n++;
        if (!savesLegacyPut(st)) throw new Error('state');
        moved++;
      } else {
        dest = 'legacy' + i;
        await savesIdbPut(dest, rec, meta);
        chk = await savesIdbGet(dest);
        if (!chk.rec || !chk.meta) throw new Error('verify');
        kept++;
      }
      await savesIdbDel(i);
    }
    st.done = true;
    if (!savesLegacyPut(st)) throw new Error('state');
  } catch (e) {
    savesToast('舊存檔轉移失敗(儲存空間不足?),舊存檔都還在,下次開啟 App 會再試');
    return { ok: false, moved: moved, kept: kept };
  }
  if (moved || kept) savesToast('已把舊存檔轉成「' + worldLabel(1) + '」的回溯點' + (kept ? '(另有 ' + kept + ' 個舊存檔已保留)' : ''));
  return { ok: true, moved: moved, kept: kept };
}

// 完成或回復被打斷的切換:先試把目標快照套上(完成);失敗再用來源槽快照(回復);都不行只清 pending
async function worldsRecover(w) {
  var p = w.pending, rd, ok = false, done = 0;
  if (w.active === p.to) { delete w.pending; worldsPut(w); return; }
  if (savesAvailable()) {
    rd = await savesReadSnap(p.to);
    if (rd.ok && savesSnapMatch(rd.snap, p.to)) ok = savesApplyKeys(savesRestamp(rd.snap.keys, p.to, {}));
    else if (rd.reason === 'empty') ok = savesApplyKeys(null);
    if (ok) done = p.to;
    else {
      rd = await savesReadSnap(p.from);
      if (rd.ok && savesSnapMatch(rd.snap, p.from) && savesApplyKeys(savesRestamp(rd.snap.keys, p.from, {}))) done = p.from;
    }
  }
  w = worldsGet();
  delete w.pending;
  if (done) { w.active = done; w.lastActive[done] = Date.now(); if (done === p.to) w.arrived = { to: done, left: null, fresh: rd && rd.reason === 'empty' }; }
  worldsPut(w);
  savesToast(done === p.to ? '已完成上次被中斷的世界切換' : (done ? '上次切換被中斷,已回到 ' + worldLabel(done) : '上次切換被中斷,無法確認內容'));
}

// 切換後第一次啟動、離線結算之後呼叫:顯示「離開 N 小時 M 分,已補發離線進度」。回傳是否已顯示
function worldsArrivalToast(sec, before) {
  var w = worldsGet(), a = w.arrived, gained = [], k, d, away, head, tail, R = (typeof RESOURCES !== 'undefined') ? RESOURCES : null;
  if (!a) return false;
  delete w.arrived;
  worldsPut(w);
  head = worldTitle(a.to, w.names[a.to]);
  if (a.fresh) { savesToast('已進入新的 ' + head); return true; }
  if (R && before) for (k in R) {
    d = Math.floor(typeof world !== 'undefined' && world.res ? (world.res[k] || 0) : 0) - Math.floor(before[k] || 0);
    if (d > 0) gained.push(R[k].icon + d);
  }
  away = a.left ? Math.max(0, (Date.now() - a.left) / 1000) : sec;
  tail = gained.length ? '已補發離線進度:' + gained.join(' ') : '離線期間沒有新進度';
  savesToast(head + ' 離開 ' + savesAwayText(away) + ',' + tail);
  return true;
}

// 重新開始 / 刪除某個世界。kind = 'restart' | 'delete'。使用中世界只能重新開始(刪除需先切走)
async function worldsRemove(n, kind, opts) {
  var o = opts || {}, ask = typeof o.confirm === 'function' ? o.confirm : (typeof confirm === 'function' ? confirm : null), w = worldsGet(), text, rd, b, i;
  if (!savesIsWorldId(n) || (kind !== 'restart' && kind !== 'delete')) return { ok: false, reason: 'id' };
  if (n === w.active) {
    if (kind === 'delete') { savesToast('使用中的世界不能刪除,請先切換到其他世界'); return { ok: false, reason: 'active' }; }
    return savesDoAction('all', opts);
  }
  if (!savesAvailable()) return { ok: false, reason: 'unavailable' };
  if (savesLegacyPending()) { savesToast('舊存檔還在轉移中,暫時不能操作其他世界,請重新開啟 App 後再試'); return { ok: false, reason: 'legacy' }; }
  text = kind === 'delete'
    ? '刪除 ' + worldTitle(n, w.names[n]) + '?\n\n會清掉:這個世界的全部進度與它的 ' + SNAPSHOTS_PER_WORLD + ' 個回溯點、名稱。\n保留:其他世界與偏好設定。\n刪除前會把這個世界備份到復原點,可從設定「復原上一步」救回(回溯點不會備份)。'
    : '重新開始 ' + worldTitle(n, w.names[n]) + '?\n\n會清掉:這個世界的全部進度(變成空世界,下次進入從頭開始)。\n保留:名稱、它的回溯點、其他世界與偏好設定。\n會先把這個世界備份到復原點,可從設定「復原上一步」救回。';
  if (!ask || !ask(text)) return { ok: false, reason: 'declined' };
  return worldsWithLock(async function () {
    rd = await savesReadSnap(n);
    if (rd.reason === 'idb') return { ok: false, reason: 'idb' };
    if (rd.ok) {
      b = await savesBackupUndo(kind === 'delete' ? '刪除' + worldLabel(n) + '前' : '重新開始' + worldLabel(n) + '前', { snap: rd.snap, pop: rd.meta.pop });
      if (!b.ok) return { ok: false, reason: 'nobackup' };
    }
    try {
      await savesIdbDel(n);
      if (kind === 'delete') for (i = 1; i <= SNAPSHOTS_PER_WORLD; i++) await savesIdbDel(savesRbId(n, i));
    } catch (e) { return { ok: false, reason: 'idb' }; }
    w = worldsGet();
    if (kind === 'delete') { delete w.names[n]; delete w.lastActive[n]; }
    if (w.packs) delete w.packs[n];
    if (w.fresh) delete w.fresh[n];
    worldsPackPrune(w);
    worldsPut(w);
    return { ok: true };
  });
}

async function worldsRename(n, name) {
  var w, nm = savesCleanName(name);
  if (!savesIsWorldId(n) || !nm) return { ok: false, reason: 'name' };
  w = worldsGet();
  w.names[n] = nm;
  if (!worldsPut(w)) return { ok: false, reason: 'ls' };
  if (n === w.active) { try { if (typeof saveWorld === 'function') saveWorld(); } catch (e) { /* 略過 */ } }
  else { try { await savesRename(n, nm); } catch (e2) { /* 略過 */ } }
  return { ok: true };
}

// ───────── 回溯點(只屬於該世界) ─────────
// 建立 / 覆蓋世界 n 的回溯點 k。已有內容須 opts.confirm 回 true;使用中世界存目前狀態,其他世界複製槽內快照
async function worldsRbSave(n, k, opts) {
  var o = opts || {}, id, old, ask, w = worldsGet(), snap, pop, ver, rd, nm;
  if (!savesAvailable() || !savesIsWorldId(n) || !(k >= 1 && k <= SNAPSHOTS_PER_WORLD)) return { ok: false, reason: 'unavailable' };
  id = savesRbId(n, k);
  try { old = await savesIdbGet(id); } catch (e) { return { ok: false, reason: 'idb' }; }
  if (old.meta) {
    ask = typeof o.confirm === 'function' ? o.confirm : null;
    if (!ask || !ask('覆蓋 ' + worldLabel(n) + ' 的回溯點 ' + k + '「' + old.meta.name + '」?(存於 ' + savesTimeText(old.meta.ts) + ')')) return { ok: false, reason: 'declined' };
  }
  return worldsWithLock(async function () {
    if (n === w.active) { savesFlush(); snap = savesCapture(); pop = savesLivePop(); }
    else {
      rd = await savesReadSnap(n);
      if (!rd.ok) { savesToast(worldLabel(n) + ' 是空世界,無法建立回溯點'); return { ok: false, reason: 'empty' }; }
      snap = rd.snap; pop = rd.meta.pop;
    }
    ver = await savesLoadAppVer();
    nm = savesCleanName(o.name) || ('回溯點 ' + k + ' · ' + savesTimeText(Date.now()));
    try { return { ok: true, meta: await savesWriteSnap(id, snap, nm, pop, ver) }; } catch (e2) {
      savesToast('儲存空間不足或寫入失敗,回溯點 ' + k + ' 維持原內容');
      return { ok: false, reason: 'write' };
    }
  });
}

// 回到世界 n 的回溯點 k:只倒轉該世界自己,先備份目前狀態到復原點,lastTs 設為現在(不補發離線)。使用中世界會 reload
async function worldsRbRestore(n, k) {
  var id = savesRbId(n, k), w = worldsGet(), rd, cur, b;
  if (!savesAvailable() || !savesParseRb(id)) return { ok: false, reason: 'unavailable' };
  if (n === w.active) return worldsWithLock(function () { return savesLoad(id); });
  return worldsWithLock(async function () {
    rd = await savesReadSnap(id);
    if (!rd.ok) return { ok: false, reason: rd.reason };
    if (!savesSnapMatch(rd.snap, n)) { savesToast('回溯點的世界編號不符,已拒絕'); return { ok: false, reason: 'mismatch' }; }
    if (!(await savesVerOk(rd.meta))) return { ok: false, reason: 'newer' };
    cur = await savesReadSnap(n);
    if (cur.ok) { b = await savesBackupUndo('回到回溯點前', { snap: cur.snap, pop: cur.meta.pop }); if (!b.ok) return { ok: false, reason: 'nobackup' }; }
    try { await savesWriteSnap(n, { v: 1, keys: savesRestamp(rd.snap.keys, n, { now: true }) }, w.names[n] || '', rd.meta.pop, rd.meta.ver); } catch (e) { return { ok: false, reason: 'write' }; }
    return { ok: true, reload: false };
  });
}

async function worldsRbDelete(n, k) {
  var id = savesRbId(n, k);
  if (!savesAvailable() || !savesParseRb(id)) return { ok: false, reason: 'unavailable' };
  try { await savesIdbDel(id); return { ok: true }; } catch (e) { return { ok: false, reason: 'idb' }; }
}

// ───────── 復原 / 改名 / 列表 ─────────
// 復原上一步:undo1 屬於使用中世界 → 套回目前世界(讀取時目前狀態會再備份,可來回);屬於別的世界 → 救回到那個世界自己的槽
async function savesUndo() {
  var rd = await savesReadSnap('undo1'), wid, w = worldsGet(), cur, b;
  if (!rd.ok) return { ok: false, reason: rd.reason };
  wid = savesSnapWorldId(rd.snap.keys[SAVE_KEY_MAIN]);
  if (!wid || wid === w.active) return worldsWithLock(function () { return savesLoad('undo1'); });
  return worldsWithLock(async function () {
    cur = await savesReadSnap(wid);
    if (cur.ok) { b = await savesBackupUndo('救回' + worldLabel(wid) + '前', { snap: cur.snap, pop: cur.meta.pop }); if (!b.ok) return { ok: false, reason: 'nobackup' }; }
    try { await savesWriteSnap(wid, rd.snap, worldsGet().names[wid] || '', rd.meta.pop, rd.meta.ver); } catch (e) { return { ok: false, reason: 'write' }; }
    savesToast('已救回 ' + worldLabel(wid) + ',可從「我的世界」進入');
    return { ok: true, restoredWorld: wid };
  });
}

// 回溯點 / 復原槽改名(世界名稱用 worldsRename)
async function savesRename(id, name) {
  var got, nm = savesCleanName(name);
  if (!nm || !savesValidId(id)) return { ok: false, reason: 'name' };
  try {
    got = await savesIdbGet(id);
    if (!got.rec || !got.meta) return { ok: false, reason: 'empty' };
    got.meta.name = nm;
    await savesIdbPut(id, got.rec, got.meta);
    return { ok: true };
  } catch (e) { return { ok: false, reason: 'idb' }; }
}

// 讀全部摘要(面板開啟時才呼叫)→ { 1..WORLD_COUNT, 'w1s1'.., undo1, undo2 }: meta|null
async function savesListMeta() {
  var box = await savesTx('readonly', ['meta'], function (tx, b) {
    var st = tx.objectStore('meta'), ks = st.getAllKeys(), vs = st.getAll();
    ks.onsuccess = function () { b.k = ks.result; };
    vs.onsuccess = function () { b.v = vs.result; };
  });
  var out = {}, i, j;
  savesMetaCache = {};
  for (i = 1; i <= WORLD_COUNT; i++) {
    out[i] = null;
    for (j = 1; j <= SNAPSHOTS_PER_WORLD; j++) out[savesRbId(i, j)] = null;
  }
  SAVE_UNDO_IDS.forEach(function (u) { out[u] = null; });
  (box.k || []).forEach(function (k, idx) { if (savesValidId(k)) { out[k] = box.v[idx]; savesMetaCache[k] = box.v[idx]; } });
  return out;
}

// 用量:{ usage, quota, totalKb, worldsUsed, hasEstimate }
async function savesUsage() {
  var list = await savesListMeta(), totalKb = 0, used = 0, est = null, k;
  for (k in list) if (list[k]) { totalKb += list[k].kb || 0; if (/^\d+$/.test(k)) used++; }
  try { if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate(); } catch (e) { est = null; }
  return { usage: est ? est.usage || 0 : 0, quota: est ? est.quota || 0 : 0, totalKb: Math.round(totalKb * 10) / 10, worldsUsed: used, hasEstimate: !!(est && est.quota > 0) };
}

// ───────── 啟動掛點 ─────────
// 舊版「讀檔後不補發離線」旗標已取消(切回的世界依自己的 lastTs 正常離線結算);保留函式為無操作,只清殘留旗標
function savesConsumeNoOffline() {
  var f = savesLsGet(SAVE_NOOFFLINE_KEY);
  if (f !== null) { try { localStorage.removeItem(SAVE_NOOFFLINE_KEY); } catch (e) { /* 略過 */ } }
  return false;
}

// 啟動時嘗試要求持久儲存(失敗無妨)
function savesPersist() {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      var p = navigator.storage.persist();
      if (p && p.catch) p.catch(function () { /* 略過 */ });
    }
  } catch (e) { /* 略過 */ }
}
savesPersist();
