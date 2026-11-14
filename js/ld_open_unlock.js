// js/ld_open_unlock.js — 功能開放(設計_開場解鎖_預約_活動_定案.md 5.2 / 卡 1;純邏輯,無 DOM)。前綴 unlock / ldOpen。資料表在 ld_open_data.js(UNLOCK_CFG)。
// 存檔:localStorage 'lorddomain.unlock.v1' = {v:1, ev:{事件名:時刻}, got:{id:開放時刻(1 = 開局)}, shown:{id:1 已跳過慶祝}, legacy:0|1};已加入 SAVE_SLOT_KEYS。
// 開放條件是「或」:名聲達標(fameGet)或事件發生過。舊存檔(第一次載入就判定:名聲 > 0、名冊 > 10 張、或禮包已用掉)→ legacy = 1,全部直接開放、不跳慶祝。
// 只在旗標 ldui(且 shell)開啟時生效:關閉時 unlockIs 一律回 true、其餘函式不動作(@DORMANT ldui)。讀寫失敗 / 壞檔 → 正規化,不丟例外。
// 全域:UNLOCK_KEY unlockOn unlockIs unlockMark unlockSync unlockTakeCelebrate unlockLockText unlockRead unlockWrite unlockNorm unlockPeek unlockLegacyCheck ldOpenLsGet ldOpenLsSet。ES2017;不用 ?. ??。

var UNLOCK_KEY = 'lorddomain.unlock.v1';

function ldOpenLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function ldOpenLsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function ldOpenNum(x, lo, hi, d) { x = typeof x === 'number' && isFinite(x) ? Math.floor(x) : d; return Math.max(lo, Math.min(hi, x)); }
function unlockOn() { return typeof featureOn === 'function' && featureOn('ldui') && (typeof shellOn !== 'function' || shellOn()); }   // @DORMANT ldui(shell 外殼關閉時新首頁不存在,一併不生效)
function unlockWorldReady() { return typeof worldReadyFlag === 'undefined' || !!worldReadyFlag; }

function unlockDefault() { return { v: 1, ev: {}, got: {}, shown: {}, legacy: 0 }; }
function unlockNorm(raw) {
  var o = unlockDefault();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  ['ev', 'got', 'shown'].forEach(function (f) {
    if (raw[f] && typeof raw[f] === 'object' && !Array.isArray(raw[f])) Object.keys(raw[f]).slice(0, 60).forEach(function (k) { if (k.length <= 20 && raw[f][k]) o[f][k] = ldOpenNum(raw[f][k], 1, 1e15, 1); });
  });
  o.legacy = raw.legacy ? 1 : 0;
  return o;
}
// 舊存檔判定(6):名聲 > 0,或名冊 > 10 張,或禮包已發(items.gv 有值)且數量 0。⚠ 新存檔開局名冊張數待確認(此處門檻 10)
function unlockLegacyCheck() {
  var cs = null, st = null;
  try { if (typeof fameGet === 'function' && fameGet() > 0) return true; } catch (e) { /* 略過 */ }
  try { cs = typeof cardsGet === 'function' ? cardsGet() : null; if (cs && cs.roster && cs.roster.length > 10) return true; } catch (e2) { /* 略過 */ }
  try { if (typeof itemsRead === 'function' && typeof itemCount === 'function') { st = itemsRead(); if (st.gv && itemCount('gift_newbie') === 0) return true; } } catch (e3) { /* 略過 */ }
  return false;
}
// 讀(缺 / 壞 → 判定新舊並寫入;世界尚未載入 → 暫回「舊存檔」而不寫入,免得把占位狀態判成新存檔)
function unlockRead() {
  var s = ldOpenLsGet(UNLOCK_KEY), o = null, d;
  if (s) { try { o = unlockNorm(JSON.parse(s)); } catch (e) { o = null; } }
  if (o) return o;
  d = unlockDefault();
  if (!unlockWorldReady()) { d.legacy = 1; return d; }
  d.legacy = unlockLegacyCheck() ? 1 : 0;
  UNLOCK_CFG.forEach(function (c) { if (c.start || d.legacy) { d.got[c.id] = 1; d.shown[c.id] = 1; } });
  unlockWrite(d);
  return d;
}
function unlockWrite(st) { return ldOpenLsSet(UNLOCK_KEY, JSON.stringify(st)); }
function unlockCfg(id) { var i; for (i = 0; i < UNLOCK_CFG.length; i++) if (UNLOCK_CFG[i].id === id) return UNLOCK_CFG[i]; return null; }
function unlockMet(c, st) {
  var f = 0;
  if (c.start) return true;
  if (c.ev && st.ev[c.ev]) return true;
  if (c.fame !== null && c.fame !== undefined) { try { f = typeof fameGet === 'function' ? fameGet() : 0; } catch (e) { f = 0; } if (f >= c.fame) return true; }
  return false;
}
// 是否已開放(未知 id 視為開放;ldui 關閉 = 全開)
function unlockIs(id) {
  var c, st;
  if (!unlockOn()) return true;
  c = unlockCfg(id);
  if (!c) return true;
  st = unlockRead();
  return !!st.legacy || !!st.got[id] || unlockMet(c, st);
}
// 不寫檔的查詢(顯示用,不觸發舊存檔判定寫入):同 unlockIs,但缺存檔時回「開局可見」
function unlockPeek(id) { return unlockIs(id); }
// 依目前名聲 / 事件重算,回「新開放」的 id 陣列(寫 got)
function unlockSync(now) {
  var st, out = [], ch = false;
  if (!unlockOn()) return out;
  st = unlockRead();
  UNLOCK_CFG.forEach(function (c) {
    if (st.got[c.id]) return;
    if (st.legacy || unlockMet(c, st)) { st.got[c.id] = ldOpenNum(now, 1, 1e15, Date.now()) || 1; if (st.legacy) st.shown[c.id] = 1; else out.push(c.id); ch = true; }
  });
  if (ch) unlockWrite(st);
  return out;
}
// 記事件(只記第一次);回新開放的 id 陣列
function unlockMark(evName, now) {
  var st;
  if (!unlockOn() || typeof evName !== 'string' || !evName) return [];
  st = unlockRead();
  if (st.ev[evName]) return [];
  st.ev[evName] = ldOpenNum(now, 1, 1e15, Date.now()) || 1;
  unlockWrite(st);
  return unlockSync(now);
}
// 取 1 個尚未慶祝的 id(一次只回 1 個,寫入 shown);開局就開的(got = 1)與舊存檔不慶祝
function unlockTakeCelebrate() {
  var st, i, c;
  if (!unlockOn()) return null;
  st = unlockRead();
  if (st.legacy) return null;
  for (i = 0; i < UNLOCK_CFG.length; i++) {
    c = UNLOCK_CFG[i];
    if (st.got[c.id] > 1 && !st.shown[c.id]) { st.shown[c.id] = 1; unlockWrite(st); return c.id; }
  }
  return null;
}
// 灰木牌文字:「名聲 800 開放」/「打完第一場戰鬥開放」;已開放 / 未知 → ''。有事件條件(txt)時事件優先
function unlockLockText(id) {
  var c;
  if (unlockIs(id)) return '';
  c = unlockCfg(id);
  if (!c) return '';
  if (c.ev && c.txt) return c.txt;
  if (c.fame !== null && c.fame !== undefined) return '名聲 ' + c.fame.toLocaleString() + ' 開放';
  return c.txt || '';
}
if (typeof module !== 'undefined' && module.exports) module.exports = { unlockIs: unlockIs };
