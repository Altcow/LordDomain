// saveslots.js — 多存檔槽(20 手動槽 + 2 復原槽 undo1/undo2)。資料放 IndexedDB「lorddomain-saves」:store slots(內容)/ meta(摘要),key = 1..20 / 'undo1' / 'undo2'。
// 內容 = 進度類 localStorage 鍵的整組字串 {v:1, keys:{key:string}},以 CompressionStream('gzip') 壓縮(無該 API 退回 raw,meta.enc 標示,讀取依 enc 判斷)。
// 鍵分類見 tools/savekeys.md:進度鍵(SAVE_SLOT_KEYS)進槽;偏好鍵(SAVE_PREF_KEYS)讀檔後保留目前值;備份/損毀副本鍵不動。
// 讀檔 = 先備份目前到復原槽 → saveSuspend=true(map.js saveWorld 等不再寫 localStorage)→ 整組取代進度鍵 → 設 noOffline 旗標 → location.reload()。
// 純邏輯、無 DOM(介面在 savesui.js)。ES2017,載入時只宣告。

var SAVE_SLOT_COUNT = 20;
var SAVE_UNDO_IDS = ['undo1', 'undo2'];
var SAVE_DB_NAME = 'lorddomain-saves';
var SAVE_KEY_MAIN = 'lorddomain.save.v1';
var SAVE_KEY_PROG = 'lorddomain.prog.v1';
var SAVE_NOOFFLINE_KEY = 'lorddomain.load.noOffline';   // 讀檔後第一次啟動跳過離線結算,main.js 啟動時消耗並清除

// 進度鍵:整組進槽;讀檔時槽內沒有的會被移除(避免殘留)
var SAVE_SLOT_KEYS = ['lorddomain.save.v1', 'lorddomain.prog.v1', 'lorddomain.fish.v1', 'lorddomain.pet.v1'];
// 暫態進度鍵:不進槽,但讀檔 / 重新開始時一律清掉(與舊盤面綁定,留著會錯亂)
var SAVE_TRANSIENT_KEYS = ['lorddomain.draft.v1'];
// 偏好鍵:不進槽,讀檔 / 重新開始後保留目前值
var SAVE_PREF_KEYS = [
  'lorddomain.settings.v1', 'lorddomain.mute', 'lorddomain.bgm.pick', 'lorddomain.bgm.rot', 'lorddomain.art.v1', 'lorddomain.life.v1',
  'lorddomain.render', 'lorddomain.fps', 'lorddomain.powersave', 'lorddomain.cityonly', 'lorddomain.adv.mode', 'lorddomain.guide.v1', 'lorddomain.id.v1',
  'lorddomain.ui.top', 'lorddomain.ui.cat', 'lorddomain.ui.camptop', 'lorddomain.ui.campcat', 'lorddomain.ui.variant', 'lorddomain.ui.wallskin',
  'lorddomain.ui.mode', 'lorddomain.ui.prevMode', 'lorddomain.ui.compact', 'lorddomain.ui.bpreview', 'lorddomain.ui.fsTipDismissed'
];
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
  return { lv: lv, pop: pop, techN: techN };
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
  return (sum.lv ? 'Lv' + sum.lv : '') + '城 · 人口' + sum.pop + ' · ' + savesTimeText(ts);
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

// ───────── 寫槽 / 讀槽 ─────────
function savesValidId(id) { return (typeof id === 'number' && id >= 1 && id <= SAVE_SLOT_COUNT && id === Math.floor(id)) || SAVE_UNDO_IDS.indexOf(id) >= 0; }

// 把 snap 寫入 id(寫入失敗:舊內容保留,reject)
async function savesWriteSnap(id, snap, name, livePop, ver) {
  var str = JSON.stringify(snap), enc = await savesEncode(str), sum = savesSummarize(snap, livePop), ts = Date.now();
  var meta = { name: name || savesDefaultName(sum, ts), ts: ts, ver: ver || 0, pop: sum.pop, lv: sum.lv, techN: sum.techN, kb: savesKb(enc.bytes), enc: enc.enc };
  await savesIdbPut(id, { enc: enc.enc, data: enc.data }, meta);
  return meta;
}

// 手動存檔。已有內容時須 opts.confirm(msg) 回 true 才覆蓋(預設不覆蓋);回 {ok, reason, meta}
async function savesSave(id, opts) {
  var o = opts || {}, old, ask, snap, ver;
  if (!savesAvailable() || typeof id !== 'number' || !savesValidId(id)) return { ok: false, reason: 'unavailable' };
  try { old = await savesIdbGet(id); } catch (e) { return { ok: false, reason: 'idb' }; }
  if (old.meta) {
    ask = typeof o.confirm === 'function' ? o.confirm : null;
    if (!ask || !ask('覆蓋第 ' + id + ' 槽「' + old.meta.name + '」?(存於 ' + savesTimeText(old.meta.ts) + ')')) return { ok: false, reason: 'declined' };
  }
  savesFlush();
  snap = savesCapture();
  ver = await savesLoadAppVer();
  try {
    return { ok: true, meta: await savesWriteSnap(id, snap, savesCleanName(o.name) || '', savesLivePop(), ver) };
  } catch (e2) {
    savesToast('存檔空間不足或寫入失敗,第 ' + id + ' 槽維持原內容');
    return { ok: false, reason: 'write' };
  }
}

// 復原槽備份:輪替 undo1 → undo2,新備份寫入 undo1(最近 2 份)。快照在呼叫當下同步取得;label = 備份原因
function savesBackupUndo(label) {
  var snap, pop, ts = Date.now();
  if (!savesAvailable()) return Promise.resolve({ ok: false, reason: 'unavailable' });
  savesFlush();
  snap = savesCapture();
  pop = savesLivePop();
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

// 整組取代進度鍵;失敗還原。keysObj = null 表示全清(重新開始)
function savesApplyKeys(keysObj) {
  var before = {}, i, k;
  for (i = 0; i < SAVE_SLOT_KEYS.length; i++) before[SAVE_SLOT_KEYS[i]] = savesLsGet(SAVE_SLOT_KEYS[i]);
  try {
    SAVE_SLOT_KEYS.forEach(function (key) {
      if (keysObj && typeof keysObj[key] === 'string') localStorage.setItem(key, keysObj[key]);
      else localStorage.removeItem(key);
    });
    SAVE_TRANSIENT_KEYS.forEach(function (key) { localStorage.removeItem(key); });
    if (keysObj) localStorage.setItem(SAVE_NOOFFLINE_KEY, '1');
    return true;
  } catch (e) {
    for (k in before) { try { if (before[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, before[k]); } catch (e2) { /* 略過 */ } }
    return false;
  }
}

// 讀檔:id = 1..20 / 'undo1' / 'undo2'。opts.skipBackup 略過自動復原備份。成功會 reload;回 {ok, reason}
async function savesLoad(id, opts) {
  var o = opts || {}, got, str, snap, appVer, b;
  if (!savesAvailable() || !savesValidId(id)) return { ok: false, reason: 'unavailable' };
  try { got = await savesIdbGet(id); } catch (e) { return { ok: false, reason: 'idb' }; }
  if (!got.rec || !got.meta) return { ok: false, reason: 'empty' };
  appVer = await savesLoadAppVer();
  if (appVer > 0 && got.meta.ver > appVer) {
    savesToast('此存檔來自較新版本(v' + got.meta.ver + '),請先更新 App 再讀取');
    return { ok: false, reason: 'newer' };
  }
  try {
    str = await savesDecode(got.rec);
    snap = JSON.parse(str);
    if (!snap || typeof snap.keys !== 'object' || typeof snap.keys[SAVE_KEY_MAIN] !== 'string') throw new Error('shape');
    JSON.parse(snap.keys[SAVE_KEY_MAIN]);
  } catch (e2) {
    savesToast('此存檔無法讀取(內容損毀),目前進度未變更');
    return { ok: false, reason: 'corrupt' };
  }
  if (!o.skipBackup) {
    b = await savesBackupUndo('讀檔前');
    if (!b.ok) return { ok: false, reason: 'nobackup' };
  }
  savesSuspendOn();
  if (!savesApplyKeys(snap.keys)) {
    savesSuspendOff();
    savesToast('讀檔失敗(儲存空間不足),目前進度未變更');
    return { ok: false, reason: 'apply' };
  }
  savesReload();
  return { ok: true };
}

// 重新開始:備份後清掉全部進度鍵(偏好保留),reload 後走既有新遊戲流程(progBoot + 預設範本)
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

// 清除陣地:只清戰陣板(camp);經營、科技、卡牌、庫房不動。僅經營模式可用
function savesClearCamp() {
  if (typeof game === 'undefined' || game.mode !== 'estate' || game.backup || world.board !== 'estate') return { ok: false, reason: 'mode' };
  world.stash = null;
  try { if (typeof pendClear === 'function') pendClear(); } catch (e) { /* 略過 */ }
  saveWorld();
  try { if (typeof mapeditUpdateDot === 'function') mapeditUpdateDot(); } catch (e2) { /* 略過 */ }
  return { ok: true };
}

// 清空領地:清經營板建築與地形,資源與科技進度保留(與 ui.js btnClear 同流程,無確認)
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

// 三個動作的說明文案(確認視窗與測試共用)
var SAVE_ACTIONS = {
  camp: { title: '清除陣地', text: '會清掉:戰鬥陣(戰陣板)上的全部布置。\n保留:領地建築與地形、資源、科技、卡牌、庫房、城市等級。\n清除前會自動建立復原點,可從設定「復原上一步」找回。' },
  estate: { title: '清空領地', text: '會清掉:領地(經營板)上的全部建築與地形。\n保留:資源、科技進度、卡牌、庫房、城市等級、戰鬥陣。\n清除前會自動建立復原點,可從設定「復原上一步」找回。' },
  all: { title: '重新開始', text: '會清掉:所有進度(領地、戰鬥陣、資源、科技、卡牌、城市等級、釣魚與仙獸)。\n保留:聲音、畫質、介面等偏好設定,以及你的手動存檔槽。\n重新開始前會自動建立復原點,可從設定「復原上一步」找回。' }
};

// 執行一個動作:先彈說明確認(opts.confirm 可替換),備份復原點,再執行。回 {ok, reason}
async function savesDoAction(kind, opts) {
  var o = opts || {}, a = SAVE_ACTIONS[kind], ask = typeof o.confirm === 'function' ? o.confirm : (typeof confirm === 'function' ? confirm : null), b, r;
  if (!a) return { ok: false, reason: 'kind' };
  if (!ask || !ask(a.title + '\n\n' + a.text)) return { ok: false, reason: 'declined' };
  if (kind !== 'all' && (typeof game === 'undefined' || game.mode !== 'estate' || game.backup)) { savesToast('請先回到領地畫面再操作'); return { ok: false, reason: 'mode' }; }
  b = await savesBackupUndo(a.title);
  if (!b.ok && !ask('無法建立復原點,之後將無法復原。仍要「' + a.title + '」嗎?')) return { ok: false, reason: 'nobackup' };
  if (kind === 'camp') r = savesClearCamp();
  else if (kind === 'estate') r = savesClearEstate();
  else r = await savesRestartAll({ skipBackup: true });
  if (r.ok && kind !== 'all') savesToast(a.title + '完成(可從設定「復原上一步」找回)');
  return r;
}

// 復原上一步:讀 undo1(讀檔流程會再把目前狀態備份,所以可以來回)
function savesUndo() { return savesLoad('undo1'); }

// ───────── 改名 / 刪除 / 列表 ─────────
async function savesRename(id, name) {
  var got, nm = savesCleanName(name);
  if (!nm || typeof id !== 'number' || !savesValidId(id)) return { ok: false, reason: 'name' };
  try {
    got = await savesIdbGet(id);
    if (!got.rec || !got.meta) return { ok: false, reason: 'empty' };
    got.meta.name = nm;
    await savesIdbPut(id, got.rec, got.meta);
    return { ok: true };
  } catch (e) { return { ok: false, reason: 'idb' }; }
}

async function savesDelete(id, opts) {
  var o = opts || {}, m = savesMetaCache[id];
  if (typeof id !== 'number' || !savesValidId(id)) return { ok: false, reason: 'unavailable' };
  if (typeof o.confirm === 'function' && !o.confirm('刪除第 ' + id + ' 槽' + (m ? '「' + m.name + '」' : '') + '?刪除後無法復原。')) return { ok: false, reason: 'declined' };
  try { await savesIdbDel(id); return { ok: true }; } catch (e) { return { ok: false, reason: 'idb' }; }
}

// 讀全部摘要(設定頁開啟時才呼叫)→ { 1: meta|null, ..., undo1: meta|null, undo2: meta|null }
async function savesListMeta() {
  var box = await savesTx('readonly', ['meta'], function (tx, b) {
    var st = tx.objectStore('meta'), ks = st.getAllKeys(), vs = st.getAll();
    ks.onsuccess = function () { b.k = ks.result; };
    vs.onsuccess = function () { b.v = vs.result; };
  });
  var out = {}, i;
  savesMetaCache = {};
  for (i = 1; i <= SAVE_SLOT_COUNT; i++) out[i] = null;
  SAVE_UNDO_IDS.forEach(function (u) { out[u] = null; });
  (box.k || []).forEach(function (k, j) { if (savesValidId(k)) { out[k] = box.v[j]; savesMetaCache[k] = box.v[j]; } });
  return out;
}

// 用量:{ usage, quota, totalKb, slotsUsed, canSlots }。navigator.storage.estimate 缺失時只有 totalKb
async function savesUsage() {
  var list = await savesListMeta(), totalKb = 0, used = 0, est = null, avg, free, can = SAVE_SLOT_COUNT, i;
  for (i = 1; i <= SAVE_SLOT_COUNT; i++) if (list[i]) { used++; totalKb += list[i].kb || 0; }
  SAVE_UNDO_IDS.forEach(function (u) { if (list[u]) totalKb += list[u].kb || 0; });
  try { if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate(); } catch (e) { est = null; }
  if (est && est.quota > 0) {
    avg = used ? totalKb * 1024 / (used + 0) : 200 * 1024;
    free = Math.max(0, est.quota - (est.usage || 0));
    can = Math.min(SAVE_SLOT_COUNT, used + Math.floor(free / Math.max(1024, avg)));
  }
  return { usage: est ? est.usage || 0 : 0, quota: est ? est.quota || 0 : 0, totalKb: Math.round(totalKb * 10) / 10, slotsUsed: used, canSlots: can, hasEstimate: !!(est && est.quota > 0) };
}

// ───────── 啟動掛點 ─────────
// main.js 啟動時、applyOfflineGains 之前呼叫:有 noOffline 旗標就清掉並把 lastTs 設為現在(整組離線結算都不會補發)。回傳是否消耗了旗標
function savesConsumeNoOffline() {
  var f = savesLsGet(SAVE_NOOFFLINE_KEY);
  if (f === null) return false;
  try { localStorage.removeItem(SAVE_NOOFFLINE_KEY); } catch (e) { /* 略過 */ }
  try { if (typeof world !== 'undefined' && world) world.lastTs = Date.now(); } catch (e2) { /* 略過 */ }
  return true;
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
