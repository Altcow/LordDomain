// audiocache.js — 合成樣本持久快取(IndexedDB 'lorddomain-audiocache')。
// 只管「樣本 PCM 取得」這一層:第一次合成完以 Int16 存進 IndexedDB,之後啟動非同步讀回記憶體,命中就不再合成。
// 呼叫端(audio / bgm / sfxwar / ambient)用 audio.js 的 auCached(key, sr, renderFn, sig) 取得 Float32Array;
// 任何失敗(無痕、空間滿、IndexedDB 不可用、資料損壞、版本/雜湊不符)一律退回 renderFn(),不影響遊戲。
// 合成演算法改動時遞增 AUDIO_SYNTH_VER,舊資料會在下次載入時被丟棄並刪除。

const AUDIO_SYNTH_VER = 1;
const AC_DB_NAME = 'lorddomain-audiocache';
const AC_STORE = 'samples';
const AC_MAX_BYTES = 20 * 1024 * 1024;
const AC_MAX_SAMPLES = 22050 * 30;
const AC_FLUSH_MS = 40;
const AC_MAX_PENDING = 400;

const AC = {
  ok: typeof indexedDB !== 'undefined' && !!indexedDB,
  loaded: false,
  dbP: null,
  mem: {},
  index: {},
  used: {},
  total: 0,
  pending: [],
  timer: null,
  gen: 0,
  stats: { hit: 0, miss: 0, written: 0, evicted: 0, bad: 0, wfail: 0 }
};

function acWarn(msg, e) {
  console.warn('[au] cache ' + msg, e);
}

function acHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

function acCrc(a) {
  let h = 0x811c9dc5;
  for (let i = 0; i < a.length; i++) {
    h ^= a[i] & 0xffff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function acDb() {
  if (!AC.dbP) {
    AC.dbP = new Promise(function (resolve, reject) {
      const req = indexedDB.open(AC_DB_NAME, 1);
      req.onupgradeneeded = function (ev) {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(AC_STORE)) db.createObjectStore(AC_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function (ev) { resolve(ev.target.result); };
      req.onerror = function () { reject(req.error || new Error('open failed')); };
    }).catch(function (e) {
      AC.ok = false;
      AC.dbP = null;
      throw e;
    });
  }
  return AC.dbP;
}

// 單一請求包成 Promise;fn(store) 回傳 request
function acReq(mode, fn) {
  return acDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(AC_STORE, mode);
      const req = fn(tx.objectStore(AC_STORE));
      req.onsuccess = function (ev) { resolve(ev.target.result); };
      req.onerror = function () { reject(req.error || new Error('request failed')); };
      tx.onabort = function () { reject(tx.error || new Error('transaction aborted')); };
    });
  });
}

// 記錄是否可信:版本、型別、長度上限、長度與資料一致、校驗碼
function acValid(rec) {
  if (!rec || rec.ver !== AUDIO_SYNTH_VER) return false;
  const d = rec.data;
  if (!d || Object.prototype.toString.call(d) !== '[object Int16Array]') return false;
  if (!(rec.n > 0) || rec.n > AC_MAX_SAMPLES || d.length !== rec.n) return false;
  if (!(rec.sr > 0) || rec.sr > 192000) return false;
  return acCrc(d) === rec.crc;
}

function acLoadAll() {
  return acDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(AC_STORE, 'readonly');
      const st = tx.objectStore(AC_STORE);
      const rows = [];
      const req = st.openCursor();
      req.onsuccess = function (ev) {
        const c = ev.target.result;
        if (c) {
          rows.push(c.value);
          c.continue();
        } else {
          resolve(rows);
        }
      };
      req.onerror = function () { reject(req.error || new Error('cursor failed')); };
      tx.onabort = function () { reject(tx.error || new Error('transaction aborted')); };
    });
  });
}

function acDelete(id) {
  return acReq('readwrite', function (st) { return st.delete(id); }).catch(function () { /* 靜默 */ });
}

// 啟動時呼叫一次(載入腳本即自動執行);非同步,失敗只關閉快取
function acInit() {
  if (!AC.ok || AC.loaded || AC.loading) return Promise.resolve(false);
  AC.loading = true;
  const gen = AC.gen;
  let rows;
  try {
    rows = acLoadAll();
  } catch (e) {
    AC.ok = false;
    AC.loading = false;
    return Promise.resolve(false);
  }
  return rows.then(function (list) {
    AC.loading = false;
    if (gen !== AC.gen) return false;
    list.forEach(function (rec) {
      if (!rec || typeof rec.id !== 'string') return;
      if (!acValid(rec)) {
        AC.stats.bad++;
        acDelete(rec.id);
        return;
      }
      if (!AC.index[rec.id]) {
        AC.index[rec.id] = { bytes: rec.n * 2, ts: rec.ts || 0 };
        AC.total += rec.n * 2;
      }
      AC.mem[rec.id] = rec;
    });
    AC.loaded = true;
    return true;
  }).catch(function (e) {
    AC.loading = false;
    AC.ok = false;
    acWarn('load failed, fallback to synth', e);
    return false;
  });
}

// 由樣本資料取得 Float32Array;命中時消耗記憶體副本。
// key:樣本鍵(不含版本);sig:配方簽章字串(雜湊進記錄)。
function acPcm(key, sr, fn, sig) {
  if (!AC.ok) return fn();
  const id = key;
  const h = acHash(String(sig == null ? '' : sig));
  const rec = AC.mem[id];
  if (rec) {
    delete AC.mem[id];
    try {
      if (rec.h === h && rec.sr === sr && acValid(rec)) {
        const d = rec.data;
        const out = new Float32Array(d.length);
        for (let i = 0; i < d.length; i++) out[i] = d[i] / 32767;
        AC.used[id] = 1;
        AC.stats.hit++;
        return out;
      }
    } catch (e) {
      acWarn('decode failed', e);
    }
    AC.stats.bad++;
    delete AC.index[id];
    acDelete(id);
  }
  const pcm = fn();
  AC.stats.miss++;
  AC.used[id] = 1;
  acQueue(id, h, sr, pcm);
  return pcm;
}

function acQueue(id, h, sr, pcm) {
  if (!AC.ok || !pcm || !pcm.length || pcm.length > AC_MAX_SAMPLES) return;
  if (AC.pending.length >= AC_MAX_PENDING) return;
  AC.pending.push({ id: id, h: h, sr: sr, pcm: pcm });
  if (!AC.timer && typeof setTimeout === 'function') AC.timer = setTimeout(acFlush, AC_FLUSH_MS);
}

function acQuant(pcm) {
  const d = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    let v = Math.round(pcm[i] * 32767);
    if (v > 32767) v = 32767;
    else if (v < -32767) v = -32767;
    d[i] = v;
  }
  return d;
}

// 容量不足時淘汰:先丟本次啟動沒用到的、舊的;回傳是否騰得出 need 位元組
function acMakeRoom(need) {
  if (AC.total + need <= AC_MAX_BYTES) return true;
  const ids = Object.keys(AC.index).sort(function (a, b) {
    const ua = AC.used[a] ? 1 : 0;
    const ub = AC.used[b] ? 1 : 0;
    if (ua !== ub) return ua - ub;
    return AC.index[a].ts - AC.index[b].ts;
  });
  for (let i = 0; i < ids.length && AC.total + need > AC_MAX_BYTES; i++) {
    if (AC.used[ids[i]]) break;
    AC.total -= AC.index[ids[i]].bytes;
    delete AC.index[ids[i]];
    delete AC.mem[ids[i]];
    AC.stats.evicted++;
    acDelete(ids[i]);
  }
  return AC.total + need <= AC_MAX_BYTES;
}

// 每次計時器只寫一筆,避免卡頓;失敗靜默(只計數)
function acFlush() {
  AC.timer = null;
  if (!AC.ok) {
    AC.pending = [];
    return;
  }
  const it = AC.pending.shift();
  if (it) {
    try {
      const old = AC.index[it.id];
      if (old) {
        AC.total -= old.bytes;
        delete AC.index[it.id];
      }
      const bytes = it.pcm.length * 2;
      if (acMakeRoom(bytes)) {
        const data = acQuant(it.pcm);
        const rec = { id: it.id, ver: AUDIO_SYNTH_VER, h: it.h, sr: it.sr, n: data.length, crc: acCrc(data), ts: Date.now(), data: data };
        AC.index[it.id] = { bytes: bytes, ts: rec.ts };
        AC.total += bytes;
        const gen = AC.gen;
        acReq('readwrite', function (st) { return st.put(rec); }).then(function () {
          AC.stats.written++;
        }).catch(function (e) {
          AC.stats.wfail++;
          if (gen === AC.gen && AC.index[it.id]) {
            AC.total -= AC.index[it.id].bytes;
            delete AC.index[it.id];
          }
        });
      }
    } catch (e) {
      AC.stats.wfail++;
    }
  }
  if (AC.pending.length && typeof setTimeout === 'function') AC.timer = setTimeout(acFlush, AC_FLUSH_MS);
}

// 設定頁「清除音效快取」:清空資料庫與記憶體副本;已建好的 AudioBuffer 不受影響
function acClear() {
  AC.gen++;
  AC.mem = {};
  AC.index = {};
  AC.used = {};
  AC.total = 0;
  AC.pending = [];
  if (AC.timer && typeof clearTimeout === 'function') clearTimeout(AC.timer);
  AC.timer = null;
  AC.loading = false;
  if (typeof indexedDB === 'undefined' || !indexedDB) return Promise.resolve(false);
  return acReq('readwrite', function (st) { return st.clear(); }).then(function () {
    return true;
  }).catch(function (e) {
    acWarn('clear failed', e);
    return false;
  });
}

function acStats() {
  return {
    ok: AC.ok, loaded: AC.loaded, hit: AC.stats.hit, miss: AC.stats.miss, written: AC.stats.written,
    evicted: AC.stats.evicted, bad: AC.stats.bad, wfail: AC.stats.wfail,
    count: Object.keys(AC.index).length, bytes: AC.total, pending: AC.pending.length
  };
}

try {
  if (AC.ok) acInit();
} catch (e) {
  AC.ok = false;
}
