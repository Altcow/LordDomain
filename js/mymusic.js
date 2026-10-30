// mymusic.js — 自訂音樂 AU6(PLAN_AUDIO §9.3)。玩家自選的本機音檔只存在 IndexedDB `lorddomain-mymusic`,不上傳、不分享。
// 全域:MYMUSIC、mymusicAdd、mymusicList、mymusicRemove、mymusicActive、mymusicPreview、mymusicOpen(內部前綴 mm)。
// 播放:HTMLAudioElement;有 AU.ctx 時經 MediaElementSource → 增益節點 → AU.buses.music,否則退回 el.volume(iOS 會忽略 el.volume)。

const MM_DB_NAME = 'lorddomain-mymusic';
const MM_STORE = 'tracks';
const MM_MAX_FILE = 30 * 1024 * 1024;
const MM_SOFT_TOTAL = 200 * 1024 * 1024;
const MM_PREVIEW_MS = 15000;
const MM_FADE_S = 1.5;
const MM_SCENES = [['estate', '經營'], ['design', '戰鬥布置'], ['battle', '戰鬥'], ['fishing', '釣魚']];
// bgmScene() 的場景名 → 自訂音樂場景標籤;win / lose 不套用自訂歌(null)
const MM_BGM_SCENE = { estate_day: 'estate', design: 'design', scout: 'battle', battle: 'battle', fishing: 'fishing' };

let mmOK = typeof indexedDB !== 'undefined' && !!indexedDB;
let mmDbP = null;
let mmCache = [];
let mmFailed = {};
let mmAud = null;
let mmSrcNode = null;
let mmGainNode = null;
let mmUseGain = false;
let mmGraphTried = false;
let mmCur = null;
let mmCurUrl = '';
let mmWant = false;
let mmQueue = [];
let mmKey = '';
let mmPreview = null;
let mmPreviewTimer = null;
let mmSeq = 0;
let mmShown = 0;
let mmRampId = 0;
let mmProcOff = false;
let mmLastAllowed = false;
let mmStatus = '';
let mmInited = false;
let mmRoot = null;
let mmBodyEl = null;
let mmFileEl = null;

function mmDom(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function mmWarn(msg, e) {
  console.warn('[au] mymusic ' + msg, e);
}

function mmDb() {
  if (!mmDbP) {
    mmDbP = new Promise(function (resolve, reject) {
      const req = indexedDB.open(MM_DB_NAME, 1);
      req.onupgradeneeded = function (ev) {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(MM_STORE)) db.createObjectStore(MM_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function (ev) { resolve(ev.target.result); };
      req.onerror = function () { reject(req.error || new Error('open failed')); };
    }).catch(function (e) {
      mmWarn('IndexedDB 無法開啟,功能隱藏', e);
      mmOK = false;
      throw e;
    });
  }
  return mmDbP;
}

function mmReq(mode, fn) {
  return mmDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MM_STORE, mode);
      const req = fn(tx.objectStore(MM_STORE));
      req.onsuccess = function (ev) { resolve(ev.target.result); };
      req.onerror = function () { reject(req.error || new Error('request failed')); };
      tx.onabort = function () { reject(tx.error || new Error('transaction aborted')); };
    });
  });
}

function mmUpdate(id, fn) {
  return mmDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MM_STORE, 'readwrite');
      const st = tx.objectStore(MM_STORE);
      const g = st.get(id);
      g.onsuccess = function () {
        if (g.result) {
          fn(g.result);
          st.put(g.result);
        }
      };
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error('update failed')); };
      tx.onabort = function () { reject(tx.error || new Error('update aborted')); };
    });
  });
}

function mmMeta(r) {
  return {
    id: r.id, name: r.name, type: r.type, size: r.size, dur: r.dur, ts: r.ts,
    scenes: Array.isArray(r.scenes) ? r.scenes : []
  };
}

// 讀出不含 blob 的清單(用游標,避免一次把整批音檔讀進記憶體)
function mmRefresh() {
  if (!mmOK) return Promise.resolve(mmCache);
  return mmDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      const out = [];
      const tx = db.transaction(MM_STORE, 'readonly');
      const req = tx.objectStore(MM_STORE).openCursor();
      req.onsuccess = function (ev) {
        const cur = ev.target.result;
        if (cur) {
          out.push(mmMeta(cur.value));
          cur.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = function () { reject(req.error); };
    });
  }).then(function (list) {
    list.sort(function (a, b) { return a.ts - b.ts; });
    mmCache = list;
    return mmCache;
  }, function (e) {
    mmWarn('清單讀取失敗', e);
    return mmCache;
  });
}

function mmGetBlob(id) {
  if (!mmOK) return Promise.resolve(null);
  return mmReq('readonly', function (st) { return st.get(id); }).then(function (r) {
    return r && r.blob ? r.blob : null;
  });
}

function mmNewId() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function mmCanPlay(type) {
  if (!type) return true;
  try {
    return new Audio().canPlayType(type) !== '';
  } catch (e) {
    mmWarn('canPlayType 失敗', e);
    return false;
  }
}

// 用暫時的 <audio> 讀長度;讀不到就視為無法播放
function mmProbe(file) {
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    let done = false;
    let timer = null;
    const finish = function (ok, val) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      try { URL.revokeObjectURL(url); } catch (e) { mmWarn('revoke 失敗', e); }
      a.onloadedmetadata = null;
      a.onerror = null;
      if (ok) resolve(val);
      else reject(new Error('probe failed'));
    };
    timer = setTimeout(function () { finish(false); }, 8000);
    a.preload = 'metadata';
    a.onloadedmetadata = function () { finish(isFinite(a.duration) && a.duration > 0, a.duration); };
    a.onerror = function () { finish(false); };
    a.src = url;
  });
}

function mmAddOne(f, res) {
  const name = f.name || '未命名';
  if (!f.size) {
    res.skipped.push({ name: name, reason: '檔案是空的' });
    return Promise.resolve();
  }
  if (f.size > MM_MAX_FILE) {
    res.skipped.push({ name: name, reason: '超過單檔 30 MB' });
    return Promise.resolve();
  }
  if (!mmCanPlay(f.type)) {
    const ogg = /ogg/i.test(f.type || '');
    res.skipped.push({ name: name, reason: ogg ? '不支援 Ogg(需 iOS 18.4 以上)' : '格式不支援' });
    return Promise.resolve();
  }
  return mmProbe(f).then(function (dur) {
    const rec = {
      id: mmNewId(), name: name, type: f.type || '', size: f.size,
      dur: Math.round(dur), ts: Date.now(), scenes: ['estate'], blob: f
    };
    return mmReq('readwrite', function (st) { return st.put(rec); }).then(function () {
      res.added++;
    }, function (e) {
      const quota = !!e && e.name === 'QuotaExceededError';
      mmWarn('寫入失敗', e);
      res.skipped.push({ name: name, reason: quota ? '空間不足' : '寫入失敗' });
    });
  }, function () {
    res.skipped.push({ name: name, reason: '無法播放' });
  });
}

// 接受 File、FileList 或陣列;回傳 {added, skipped:[{name, reason}], warn}
function mmAdd(input) {
  const files = !input ? [] : (input.length !== undefined ? Array.prototype.slice.call(input) : [input]);
  const res = { added: 0, skipped: [], warn: '' };
  if (!mmOK) {
    res.skipped.push({ name: '', reason: '此裝置不支援自訂音樂' });
    return Promise.resolve(res);
  }
  let p = Promise.resolve();
  files.forEach(function (f) {
    p = p.then(function () { return mmAddOne(f, res); });
  });
  return p.then(function () { return mmRefresh(); }).then(function () {
    const total = mmCache.reduce(function (s, t) { return s + t.size; }, 0);
    if (res.added && total > MM_SOFT_TOTAL) res.warn = '總量已超過建議上限 200 MB(仍可使用,但裝置空間會被占用)';
    return res;
  });
}

function mmSoft(e) {
  mmWarn('操作失敗', e);
}

function mmSetScenes(id, scenes) {
  if (!mmOK) return Promise.resolve();
  const list = Array.isArray(scenes) ? scenes : [];
  const want = MM_SCENES.map(function (s) { return s[0]; }).filter(function (k) { return list.indexOf(k) >= 0; });
  return mmUpdate(id, function (r) { r.scenes = want; }).then(function () {
    return mmRefresh();
  }).then(mmAfterChange).catch(mmSoft);
}

function mmRemove(id) {
  if (!mmOK) return Promise.resolve();
  if (mmPreview === id) mmPreviewEnd();
  return mmReq('readwrite', function (st) { return st.delete(id); }).then(function () {
    return mmRefresh();
  }).then(mmAfterChange).catch(mmSoft);
}

function mmClear() {
  if (!mmOK) return Promise.resolve();
  mmPreview = null;
  return mmReq('readwrite', function (st) { return st.clear(); }).then(function () {
    mmFailed = {};
    return mmRefresh();
  }).then(mmAfterChange).catch(mmSoft);
}

function mmUsage() {
  const bytes = mmCache.reduce(function (s, t) { return s + t.size; }, 0);
  let est = null;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) est = navigator.storage.estimate();
  } catch (e) {
    mmWarn('storage.estimate 失敗', e);
  }
  return Promise.resolve(est).then(function (e) {
    return { bytes: bytes, quota: e && e.quota ? e.quota : 0 };
  }, function () {
    return { bytes: bytes, quota: 0 };
  });
}

function mmAfterChange() {
  if (mmRoot && mmRoot.classList.contains('mm-open')) mmRender();
}

// ---- 播放 ----

function mmCustom() {
  const c = auCfg().custom || AUDIO_SETTINGS_DEFAULT.custom;
  return { on: !!c.on, mode: c.mode === 'mix' ? 'mix' : 'replace', shuffle: c.shuffle !== false };
}

function mmSetCfg(path, v) {
  if (typeof settingsSet === 'function') settingsSet(path, v);
  else mmWarn('settings 不可用,無法儲存設定', path);
  mmTick();
}

function mmBusLevel() {
  const cfg = auCfg();
  return cfg.music.on ? cfg.music.vol * (cfg.quiet ? 0.3 : 1) : 0;
}

function mmApplyVol() {
  if (mmUseGain || !mmAud) return;
  mmAud.volume = Math.max(0, Math.min(1, mmShown * mmBusLevel()));
}

function mmAudio() {
  if (!mmAud) {
    mmAud = new Audio();
    mmAud.preload = 'auto';
    mmAud.onended = function () {
      if (mmPreview) mmPreviewEnd();
      else if (mmCur) mmNext();
    };
    mmAud.onerror = function () {
      if (!mmCur || mmPreview) return;
      mmWarn('播放失敗,略過此首', mmCur);
      mmFailed[mmCur] = true;
      mmCur = null;
      mmNext();
    };
  }
  return mmAud;
}

// 第一次有 AU.ctx 時接上增益節點;之後都走增益路徑
function mmEnsureGraph() {
  if (mmGraphTried) return mmUseGain;
  if (typeof AU !== 'object' || !AU || !AU.ctx || !AU.buses || !AU.buses.music) return false;
  mmGraphTried = true;
  try {
    const src = AU.ctx.createMediaElementSource(mmAudio());
    const g = AU.ctx.createGain();
    g.gain.value = mmShown;
    src.connect(g);
    g.connect(AU.buses.music);
    mmSrcNode = src;
    mmGainNode = g;
    mmAudio().volume = 1;
    mmUseGain = true;
  } catch (e) {
    mmWarn('MediaElementSource 不可用,改用 el.volume', e);
    mmUseGain = false;
  }
  return mmUseGain;
}

// 淡入淡出:增益路徑用 GainNode 排程;否則用 setTimeout 步進 el.volume
function mmSetLevel(target, sec) {
  const from = mmShown;
  const id = ++mmRampId;
  if (mmUseGain) {
    try {
      const c = AU.ctx;
      const g = mmGainNode.gain;
      const now = c.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      if (sec > 0) g.linearRampToValueAtTime(target, now + sec);
      else g.setValueAtTime(target, now);
    } catch (e) {
      mmWarn('增益排程失敗', e);
      mmGainNode.gain.value = target;
    }
    mmShown = target;
    return;
  }
  if (!(sec > 0)) {
    mmShown = target;
    mmApplyVol();
    return;
  }
  const n = Math.max(1, Math.round(sec * 20));
  let i = 0;
  const step = function () {
    if (id !== mmRampId) return;
    i++;
    mmShown = from + (target - from) * Math.min(1, i / n);
    mmApplyVol();
    if (i < n) setTimeout(step, 50);
  };
  setTimeout(step, 50);
}

function mmPlayEl() {
  if (typeof AU === 'object' && AU && AU.unlock) AU.unlock();
  mmEnsureGraph();
  let p = null;
  try {
    p = mmAudio().play();
  } catch (e) {
    mmWarn('play 失敗', e);
    return;
  }
  if (p && p.catch) p.catch(function (e) { mmWarn('play 被系統擋下,等待下一次點擊', e); });
}

function mmRevoke() {
  if (!mmCurUrl) return;
  try {
    URL.revokeObjectURL(mmCurUrl);
  } catch (e) {
    mmWarn('revoke 失敗', e);
  }
  mmCurUrl = '';
}

// 切到指定曲:正在播則先淡出再換;沒在播則直接淡入
function mmSwitchTo(id) {
  const seq = ++mmSeq;
  const go = function () {
    mmGetBlob(id).then(function (blob) {
      if (seq !== mmSeq) return;
      if (!blob) {
        mmWarn('找不到曲目,略過', id);
        mmFailed[id] = true;
        mmCur = null;
        mmNext();
        return;
      }
      mmRevoke();
      mmCurUrl = URL.createObjectURL(blob);
      mmCur = id;
      mmWant = true;
      mmAudio().src = mmCurUrl;
      mmSetLevel(0, 0);
      mmPlayEl();
      mmSetLevel(1, MM_FADE_S);
    }, function (e) {
      if (seq !== mmSeq) return;
      mmWarn('讀取曲目失敗', e);
      mmFailed[id] = true;
      mmCur = null;
      mmNext();
    });
  };
  if (mmCur && mmAud && !mmAud.paused) {
    mmSetLevel(0, MM_FADE_S);
    setTimeout(function () { if (seq === mmSeq) go(); }, MM_FADE_S * 1000);
  } else {
    go();
  }
}

// 下一首:隨機(不重複當前)或順序循環;只在 mmQueue 內挑、略過載入失敗的曲目
function mmNext() {
  const ids = mmQueue.filter(function (id) { return !mmFailed[id]; });
  if (!ids.length) {
    mmFadeStop();
    return;
  }
  const cfg = mmCustom();
  let pick;
  if (cfg.shuffle && ids.length > 1) {
    const others = ids.filter(function (id) { return id !== mmCur; });
    pick = others[Math.floor(Math.random() * others.length)];
  } else {
    const i = ids.indexOf(mmCur);
    pick = ids[(i + 1) % ids.length];
  }
  mmSwitchTo(pick);
}

// 淡出後暫停(場景沒有自訂歌時用)
function mmFadeStop() {
  const seq = ++mmSeq;
  mmCur = null;
  mmWant = false;
  mmSetLevel(0, MM_FADE_S);
  setTimeout(function () {
    if (seq === mmSeq && mmAud) mmAud.pause();
  }, MM_FADE_S * 1000);
}

// 立即停止並清空狀態(關閉自訂音樂時用)
function mmHardStop() {
  ++mmSeq;
  mmCur = null;
  mmWant = false;
  mmPreview = null;
  if (mmPreviewTimer) {
    clearTimeout(mmPreviewTimer);
    mmPreviewTimer = null;
  }
  if (mmAud) mmAud.pause();
  mmSetLevel(0, 0);
  mmQueue = [];
  mmKey = '';
}

function mmPreviewEnd() {
  mmPreview = null;
  if (mmPreviewTimer) {
    clearTimeout(mmPreviewTimer);
    mmPreviewTimer = null;
  }
  mmKey = '';
  mmFadeStop();
}

// 場景:bgmScene() 不存在時退回以遊戲模式判斷
function mmSceneNow() {
  let s;
  if (typeof bgmScene === 'function') {
    s = bgmScene();
  } else {
    s = (typeof game !== 'undefined' && game && (game.mode === 'attack' || game.mode === 'replay')) ? 'battle' : 'estate_day';
  }
  return Object.prototype.hasOwnProperty.call(MM_BGM_SCENE, s) ? MM_BGM_SCENE[s] : null;
}

function mmIdsFor(scene) {
  return mmCache.filter(function (t) {
    return t.scenes.indexOf(scene) >= 0 && !mmFailed[t.id];
  }).map(function (t) { return t.id; });
}

// 替換模式且該場景有自訂歌時,讓程序化 BGM 靜音 / 暫停
function mmProcSet(off) {
  if (off === mmProcOff) return;
  mmProcOff = off;
  if (typeof bgmSetEnabled === 'function') {
    try {
      bgmSetEnabled(!off);
    } catch (e) {
      mmWarn('bgmSetEnabled 失敗', e);
    }
  }
}

function mmRetarget(ids) {
  mmQueue = ids;
  if (!ids.length) {
    if (mmCur) mmFadeStop();
    return;
  }
  if (mmCur && ids.indexOf(mmCur) >= 0) return;
  mmNext();
}

// 每 500 ms 輪詢:同步場景、設定(開關 / 音量 / 模式)與背景狀態
function mmTick() {
  if (!mmOK || typeof document === 'undefined') return;
  const cfg = mmCustom();
  const hidden = !!document.hidden;
  if (!cfg.on && !mmPreview) {
    if (mmCur || (mmAud && !mmAud.paused)) mmHardStop();
    mmProcSet(false);
    mmLastAllowed = false;
    return;
  }
  const allowed = auCfg().music.on && !hidden;
  if (hidden) {
    if (mmAud && !mmAud.paused) mmAud.pause();
    mmLastAllowed = false;
    return;
  }
  if (!mmPreview) {
    const scene = mmSceneNow();
    const ids = scene ? mmIdsFor(scene) : [];
    const key = scene + '|' + ids.join(',') + '|' + cfg.mode + '|' + (cfg.shuffle ? 1 : 0);
    if (key !== mmKey) {
      mmKey = key;
      mmRetarget(ids);
    }
    mmProcSet(cfg.mode === 'replace' && ids.length > 0);
  }
  if (mmAud) {
    if (!allowed && !mmAud.paused) mmAud.pause();
    else if (allowed && !mmLastAllowed && mmCur && mmWant) mmPlayEl();
  }
  mmLastAllowed = allowed;
  mmApplyVol();
}

function mymusicPreview(id) {
  if (!mmOK) return Promise.resolve(false);
  return mmGetBlob(id).then(function (blob) {
    if (!blob) return false;
    if (mmPreviewTimer) clearTimeout(mmPreviewTimer);
    ++mmSeq;
    mmPreview = id;
    mmRevoke();
    mmCurUrl = URL.createObjectURL(blob);
    mmCur = id;
    mmWant = true;
    mmAudio().src = mmCurUrl;
    mmSetLevel(0, 0);
    mmPlayEl();
    mmSetLevel(1, MM_FADE_S);
    mmPreviewTimer = setTimeout(mmPreviewEnd, MM_PREVIEW_MS);
    return true;
  }, function (e) {
    mmWarn('試聽失敗', e);
    return false;
  });
}

// ---- 面板 ----

function mmMB(b) {
  return (b / 1048576).toFixed(1) + ' MB';
}

function mmTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function mmUsageText(u) {
  const bytes = u ? u.bytes : mmCache.reduce(function (s, t) { return s + t.size; }, 0);
  let s = mmCache.length + ' 首 · ' + mmMB(bytes) + ' / 建議上限 200 MB';
  if (bytes > MM_SOFT_TOTAL) s += '(已超過建議上限)';
  if (u && u.quota) s += ' · 本站配額約 ' + mmMB(u.quota);
  return s;
}

function mmRow(label, control) {
  const row = mmDom('div', 'mm-row');
  row.appendChild(mmDom('span', 'mm-lbl', label));
  row.appendChild(control);
  return row;
}

function mmSwitch(on, onChange) {
  const b = mmDom('button', on ? 'mm-on' : '', on ? '開' : '關');
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', on ? 'true' : 'false');
  b.addEventListener('click', function () { onChange(!on); });
  return b;
}

function mmSeg(options, current, onPick) {
  const wrap = mmDom('div', 'mm-seg');
  options.forEach(function (o) {
    const b = mmDom('button', o[0] === current ? 'mm-on' : '', o[1]);
    b.setAttribute('aria-pressed', o[0] === current ? 'true' : 'false');
    b.addEventListener('click', function () { onPick(o[0]); });
    wrap.appendChild(b);
  });
  return wrap;
}

function mmTrackRow(t) {
  const row = mmDom('div', 'mm-track');
  const line = mmDom('div', 'mm-row');
  line.appendChild(mmDom('span', 'mm-name', t.name));
  const play = mmDom('button', '', '▶');
  play.setAttribute('aria-label', '試聽 15 秒');
  play.addEventListener('click', function () { mymusicPreview(t.id); });
  const del = mmDom('button', '', '✕');
  del.setAttribute('aria-label', '刪除');
  del.addEventListener('click', function () {
    if (confirm('刪除「' + t.name + '」?')) mmRemove(t.id);
  });
  line.appendChild(play);
  line.appendChild(del);
  row.appendChild(line);
  row.appendChild(mmDom('div', 'mm-meta', mmTime(t.dur) + ' · ' + mmMB(t.size)));
  const chips = mmDom('div', 'mm-row');
  MM_SCENES.forEach(function (s) {
    const on = t.scenes.indexOf(s[0]) >= 0;
    const b = mmDom('button', on ? 'mm-on' : '', s[1]);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', function () {
      const next = on ? t.scenes.filter(function (k) { return k !== s[0]; }) : t.scenes.concat([s[0]]);
      mmSetScenes(t.id, next);
    });
    chips.appendChild(b);
  });
  row.appendChild(chips);
  return row;
}

function mmRender() {
  if (!mmRoot || !mmBodyEl) return;
  const cfg = mmCustom();
  mmBodyEl.innerHTML = '';
  mmBodyEl.appendChild(mmRow('啟用', mmSwitch(cfg.on, function (v) { mmSetCfg('custom.on', v); mmRender(); })));
  mmBodyEl.appendChild(mmDom('p', 'mm-hint', '歌曲只存在這支手機,不會上傳或分享;清除網站資料會一併清掉。'));
  mmBodyEl.appendChild(mmDom('p', 'mm-hint', 'iPhone 只能從「檔案」App 選歌,Apple Music 的歌選不到。'));
  mmBodyEl.appendChild(mmRow('用法', mmSeg([['replace', '取代內建'], ['mix', '與內建輪播']], cfg.mode, function (v) {
    mmSetCfg('custom.mode', v);
    mmRender();
  })));
  mmBodyEl.appendChild(mmRow('隨機播放', mmSwitch(cfg.shuffle, function (v) {
    mmSetCfg('custom.shuffle', v);
    mmRender();
  })));
  const add = mmDom('button', 'mm-add', '＋ 加入音樂檔(可多選)');
  add.addEventListener('click', function () { if (mmFileEl) mmFileEl.click(); });
  mmBodyEl.appendChild(add);
  const usage = mmDom('p', 'mm-usage', mmUsageText());
  mmBodyEl.appendChild(usage);
  mmUsage().then(function (u) { usage.textContent = mmUsageText(u); });
  if (mmStatus) mmBodyEl.appendChild(mmDom('p', 'mm-status', mmStatus));
  if (!mmCache.length) {
    mmBodyEl.appendChild(mmDom('p', 'mm-hint', '尚未加入歌曲。'));
  }
  mmCache.forEach(function (t) { mmBodyEl.appendChild(mmTrackRow(t)); });
  const counts = MM_SCENES.map(function (s) {
    return s[1] + ' ' + mmCache.filter(function (t) { return t.scenes.indexOf(s[0]) >= 0; }).length + ' 首';
  }).join(' / ');
  mmBodyEl.appendChild(mmDom('p', 'mm-hint', '各場景清單:' + counts));
  const clr = mmDom('button', 'mm-danger', '全部刪除');
  clr.addEventListener('click', function () {
    if (confirm('刪除全部自訂音樂?此動作無法復原。')) mmClear();
  });
  mmBodyEl.appendChild(clr);
}

function mmAddFiles(list) {
  mmStatus = '加入中…';
  mmRender();
  return mymusicAdd(list).then(function (res) {
    const lines = ['已加入 ' + res.added + ' 首'];
    res.skipped.forEach(function (s) { lines.push((s.name ? s.name + ':' : '') + s.reason); });
    if (res.warn) lines.push(res.warn);
    mmStatus = lines.join('\n');
    mmRender();
    return res;
  });
}

function mmClose() {
  if (mmRoot) mmRoot.classList.remove('mm-open');
}

function mmBuildRoot() {
  mmRoot = mmDom('div', '');
  mmRoot.id = 'mmRoot';
  const mask = mmDom('div', 'mm-mask');
  mask.addEventListener('click', mmClose);
  const drawer = mmDom('div', 'mm-drawer');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', '自訂音樂');
  drawer.appendChild(mmDom('div', 'mm-grip'));
  const head = mmDom('div', 'mm-head');
  head.appendChild(mmDom('span', 'mm-title', '自訂音樂'));
  const x = mmDom('button', '', '✕');
  x.setAttribute('aria-label', '關閉');
  x.addEventListener('click', mmClose);
  head.appendChild(x);
  drawer.appendChild(head);
  mmBodyEl = mmDom('div', 'mm-body');
  drawer.appendChild(mmBodyEl);
  const foot = mmDom('div', 'mm-foot');
  const done = mmDom('button', 'mm-done', '完成');
  done.addEventListener('click', mmClose);
  foot.appendChild(done);
  drawer.appendChild(foot);
  mmFileEl = document.createElement('input');
  mmFileEl.type = 'file';
  mmFileEl.accept = 'audio/*';
  mmFileEl.multiple = true;
  mmFileEl.style.display = 'none';
  mmFileEl.addEventListener('change', function () {
    const picked = Array.prototype.slice.call(mmFileEl.files || []);
    mmFileEl.value = '';
    if (picked.length) mmAddFiles(picked);
  });
  mmRoot.appendChild(mask);
  mmRoot.appendChild(drawer);
  mmRoot.appendChild(mmFileEl);
  document.body.appendChild(mmRoot);
}

function mymusicOpen() {
  if (!mmOK || typeof document === 'undefined') return;
  if (typeof AU === 'object' && AU && AU.unlock) AU.unlock();
  if (!mmRoot) mmBuildRoot();
  mmRoot.classList.add('mm-open');
  mmRender();
  mmRefresh().then(mmRender);
}

function mmBuildUI() {
  if (typeof window !== 'undefined' && typeof window.settingsAddRow === 'function') {
    try {
      window.settingsAddRow('自訂音樂 ›', mymusicOpen);
      return;
    } catch (e) {
      mmWarn('settingsAddRow 失敗,改用浮動按鈕', e);
    }
  }
  const b = mmDom('button', '', '🎵 我的音樂');
  b.id = 'mmFab';
  b.setAttribute('aria-label', '自訂音樂');
  b.addEventListener('click', mymusicOpen);
  document.body.appendChild(b);
}

function mmInit() {
  if (mmInited || !mmOK || typeof document === 'undefined' || !document.addEventListener) return;
  mmInited = true;
  document.addEventListener('visibilitychange', mmTick, false);
  document.addEventListener('pointerdown', function () {
    mmLastAllowed = false;
    mmTick();
  }, true);
  setInterval(mmTick, 500);
  mmDb().then(mmRefresh).then(function () {
    if (mmOK) mmBuildUI();
  }, function () {
    mmOK = false;
  });
}

// ---- 公開 API ----

const MYMUSIC = {
  supported: function () { return mmOK; },
  add: mmAdd,
  list: function () { return mmRefresh().then(function (l) { return l.slice(); }); },
  setScenes: mmSetScenes,
  remove: mmRemove,
  clear: mmClear,
  blobUrl: function (id) {
    return mmGetBlob(id).then(function (b) { return b ? URL.createObjectURL(b) : null; });
  },
  usage: mmUsage
};

function mymusicAdd(input) { return MYMUSIC.add(input); }
function mymusicList() { return MYMUSIC.list(); }
function mymusicRemove(id) { return MYMUSIC.remove(id); }
function mymusicActive() { return !!(mmCur && mmAud && !mmAud.paused); }

if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mmInit);
  else mmInit();
}
