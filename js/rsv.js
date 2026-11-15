// js/rsv.js — 預備兵 / 征兵 / 補兵(校場)純邏輯(補兵・名聲・鍛造材料 設計 第 1 節;無 DOM)。數值全部 PLACEHOLDER,集中在 RSV_CFG。
// 預備兵是「人數」;每張卡滿兵 = RSV_CFG.cardFull(1000)。地圖模組以比例 trp[卡].r 記兵力,本檔不讀不寫 trp:回城呼叫 rsvHeal、之後 rsvHealSweep 由呼叫端把 add 加到自己的 trp。
// 存檔:localStorage 'lorddomain.rsv.v1' = {v:1, n 存量, q:[{n,g,t0,t1}] 征兵佇列, ft 自然招募上次結算, auto 自動補兵 0/1, lack:{t,n} 補不滿, done:[{t,n,kind}]}(SAVE_SLOT_KEYS)。
// 時間只存時間戳;rsvSettle(now) 結算到期征兵 + 自然招募;時鐘倒退(now < ft)凍結不倒算。壞檔 / 壞值 → 正規化,不丟例外。
// 依賴(存在才用):res4.js(res4Has / res4Spend / res4Add 糧)、bnteam.js(bnTeamPresetGet 隊伍順序)、cityBldLv('drill')(校場等級,內政未做前固定等級 1)。
// 賽季:存檔多一欄 ss(季號戳記,由 season.js 蓋章;rsvNorm 保留);rsvSeasonReset(idx, tStart) 冪等:n=startN、q=[]、lack 清空、ft=tStart,done / auto 保留。
// 首頁經營掛鉤(hm_core.js 存在才用):rsvCap 改讀 hmLv('yard') × hmMul('rsvCap')、rsvSpeedMul = hmMul('rsvSpeed')、自然招募 × hmMul('rsvFree');未載入時行為不變。
// 全域:RSV_CFG RSV_KEY rsvGet rsvCap rsvCardFull rsvSpeedMul rsvSettle rsvOrderMax rsvRecruit rsvCancel rsvHeal rsvOrder rsvHealSweep rsvSetAuto rsvBadge rsvTakeDone rsvNorm rsvSeasonReset。ES2017;不用 ?. ??。

var RSV_KEY = 'lorddomain.rsv.v1';
var RSV_CFG = {
  cardFull: 1000,                                                      // 每張卡滿兵
  capByLv: [6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000],    // 校場等級 1~8 的預備兵上限;內政未做前固定用 [0]
  slots: 2,                                                            // 征兵佇列格數(並行)
  orderMin: 100, orderMax: 3000,                                       // 單張征兵單人數
  grainPer: 1,                                                         // 每 1 兵花 1 糧
  minPer100: 1,                                                        // 每 100 兵 1 分鐘
  freePerHour: 300, freeMaxHours: 12,                                  // 自然招募(鄉勇自願投軍)與離線上限
  autoHeal: true,                                                      // 自動補兵預設開
  startN: 3000,                                                        // 新存檔初始預備兵
  doneMax: 20
};
var RSV_MIN = 60000, RSV_HOUR = 3600000;

function rsvInt(x, lo, hi, d) {
  x = typeof x === 'number' && isFinite(x) ? Math.floor(x) : d;
  return Math.max(lo, Math.min(hi, x));
}
function rsvDefault(now) {
  return { v: 1, n: Math.min(RSV_CFG.startN, rsvCap()), q: [], ft: now, auto: RSV_CFG.autoHeal ? 1 : 0, lack: { t: 0, n: 0 }, done: [] };
}
// 正規化:壞檔 → 預設;數量夾住;佇列超過格數只留前面
function rsvNorm(raw, now) {
  var o, cap = rsvCap(), q = [];
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return rsvDefault(now);
  o = rsvDefault(now);
  o.n = rsvInt(raw.n, 0, cap, o.n);
  (Array.isArray(raw.q) ? raw.q : []).forEach(function (x) {
    var n, t0, t1;
    if (!x || typeof x !== 'object' || q.length >= RSV_CFG.slots) return;
    n = rsvInt(x.n, 1, RSV_CFG.orderMax, 0);
    if (n < 1) return;
    t0 = rsvInt(x.t0, 0, 1e15, now);
    t1 = rsvInt(x.t1, 0, 1e15, t0);
    if (t1 < t0) t1 = t0;
    q.push({ n: n, g: rsvInt(x.g, 0, 1e9, n * RSV_CFG.grainPer), t0: t0, t1: t1 });
  });
  o.q = q;
  o.ft = rsvInt(raw.ft, 0, 1e15, now);
  o.auto = raw.auto === 0 || raw.auto === false ? 0 : 1;
  if (typeof raw.ss === 'number' && isFinite(raw.ss) && raw.ss >= 0) o.ss = Math.floor(raw.ss);   // 賽季季號戳記:有才保留
  if (raw.lack && typeof raw.lack === 'object') o.lack = { t: rsvInt(raw.lack.t, 0, 1e15, 0), n: rsvInt(raw.lack.n, 0, 1e9, 0) };
  o.done = (Array.isArray(raw.done) ? raw.done : []).filter(function (d) { return d && typeof d === 'object'; }).slice(-RSV_CFG.doneMax).map(function (d) {
    return { t: rsvInt(d.t, 0, 1e15, 0), n: rsvInt(d.n, 0, 1e9, 0), kind: d.kind === 'free' ? 'free' : 'q' };
  });
  return o;
}
function rsvRead(now) {
  var s = null;
  now = typeof now === 'number' ? now : Date.now();
  try { s = localStorage.getItem(RSV_KEY); } catch (e) { return rsvDefault(now); }
  if (!s) return rsvDefault(now);
  try { return rsvNorm(JSON.parse(s), now); } catch (e2) { return rsvDefault(now); }
}
function rsvWrite(st) {
  try { localStorage.setItem(RSV_KEY, JSON.stringify(st)); return true; } catch (e) { return false; }
}
function rsvQueued(st) { var s = 0; st.q.forEach(function (x) { s += x.n; }); return s; }

// ───────── 對外:查詢 ─────────
function rsvGet() { return rsvRead(Date.now()); }
// 首頁經營乘數(hm_core.js 的 hmMul;未載入 / 非有限正數 → 1)
function rsvHmMul(k) {
  var m = 1;
  if (typeof hmMul === 'function') { try { m = Number(hmMul(k)); } catch (e) { m = 1; } }
  return isFinite(m) && m > 0 ? m : 1;
}
function rsvCap() {
  var lv = 0, yl = 0, yc = 1000;
  if (typeof hmLv === 'function') {   // 首頁經營:校場(yard)等級 + 屯兵 / 演武場乘數
    try { yl = Number(hmLv('yard')) || 0; } catch (e0) { yl = 0; }
    if (typeof HM_CFG !== 'undefined' && HM_CFG && typeof HM_CFG.yardCap === 'number') yc = HM_CFG.yardCap;
    return Math.round((RSV_CFG.capByLv[0] + yc * Math.max(0, yl)) * rsvHmMul('rsvCap'));
  }
  if (typeof cityBldLv === 'function') { try { lv = cityBldLv('drill') | 0; } catch (e) { lv = 0; } }
  if (lv >= 1) return RSV_CFG.capByLv[Math.min(lv, RSV_CFG.capByLv.length) - 1];
  return RSV_CFG.capByLv[0];
}
function rsvCardFull(entry) { return RSV_CFG.cardFull; }
function rsvSpeedMul() { return rsvHmMul('rsvSpeed'); }   // 首頁經營募兵令折扣;hm_core 未載入 → 1

// ───────── 結算 ─────────
// 結算到期征兵 + 自然招募。回 {added, free, done:[{t,n,kind:'q'}]};有變動才寫存檔。時鐘倒退 → 凍結
function rsvSettle(now) {
  var st, raw = null, cap = rsvCap(), fr = RSV_CFG.freePerHour * rsvHmMul('rsvFree'), out = { added: 0, free: 0, done: [] }, changed = false, left = [], el, g, room, last;
  now = typeof now === 'number' && isFinite(now) ? now : Date.now();
  try { raw = localStorage.getItem(RSV_KEY); } catch (e) { raw = null; }
  st = rsvRead(now);
  if (!raw) changed = true;
  if (now < st.ft) return out;   // 時鐘倒退:凍結
  st.q.slice().sort(function (a, b) { return a.t1 - b.t1; }).forEach(function (x) {
    var add;
    if (x.t1 > now) { left.push(x); return; }
    add = Math.max(0, Math.min(x.n, cap - st.n));
    st.n += add;
    out.added += add; out.done.push({ t: x.t1, n: x.n, kind: 'q' });
    st.done.push({ t: x.t1, n: x.n, kind: 'q' });
    changed = true;
  });
  st.q = st.q.filter(function (x) { return x.t1 > now; });
  // 自然招募:存量 + 佇列 < 上限才累積;離線最多算 freeMaxHours 小時
  el = now - st.ft;
  if (el > 0) {
    room = cap - st.n - rsvQueued(st);
    if (room <= 0) { st.ft = now; changed = true; }
    else {
      g = Math.floor(Math.min(el, RSV_CFG.freeMaxHours * RSV_HOUR) * fr / RSV_HOUR);
      if (g > 0) {
        if (g >= room || el > RSV_CFG.freeMaxHours * RSV_HOUR) { g = Math.min(g, room); st.ft = now; }
        else st.ft += Math.round(g * RSV_HOUR / fr);
        st.n += g; out.added += g; out.free = g; changed = true;
        last = st.done[st.done.length - 1];
        if (last && last.kind === 'free') { last.n += g; last.t = now; } else st.done.push({ t: now, n: g, kind: 'free' });
      } else if (el > RSV_CFG.freeMaxHours * RSV_HOUR) { st.ft = now; changed = true; }
    }
  }
  if (st.done.length > RSV_CFG.doneMax) st.done = st.done.slice(-RSV_CFG.doneMax);
  if (changed) rsvWrite(st);
  return out;
}

// ───────── 征兵 ─────────
// 現在最多可下單人數 = min(單張上限, 上限 − 存量 − 佇列中, 糧 ÷ grainPer)
function rsvOrderMax() {
  var st = rsvRead(Date.now()), room = rsvCap() - st.n - rsvQueued(st), grain = (typeof res4Get === 'function') ? res4Get('grain') : 0;
  return Math.max(0, Math.min(RSV_CFG.orderMax, room, Math.floor(grain / RSV_CFG.grainPer)));
}
// 下單 → {ok, reason, slot};reason:'slot' 無空格 / 'min' 太少 / 'cap' 超上限 / 'grain' 糧不足
function rsvRecruit(n, now) {
  var st, room, cost, ms;
  now = typeof now === 'number' && isFinite(now) ? now : Date.now();
  rsvSettle(now);
  st = rsvRead(now);
  n = typeof n === 'number' && isFinite(n) ? Math.floor(n) : 0;
  if (st.q.length >= RSV_CFG.slots) return { ok: false, reason: 'slot', slot: -1 };
  if (n < RSV_CFG.orderMin) return { ok: false, reason: 'min', slot: -1 };
  room = rsvCap() - st.n - rsvQueued(st);
  if (n > RSV_CFG.orderMax || n > room) return { ok: false, reason: 'cap', slot: -1 };
  cost = n * RSV_CFG.grainPer;
  if (typeof res4Has !== 'function' || !res4Has({ grain: cost }) || !res4Spend({ grain: cost })) return { ok: false, reason: 'grain', slot: -1 };
  ms = Math.ceil(n / 100 * RSV_CFG.minPer100 * rsvSpeedMul() * RSV_MIN);
  st.q.push({ n: n, g: cost, t0: now, t1: now + ms });
  rsvWrite(st);
  return { ok: true, reason: '', slot: st.q.length - 1 };
}
// 取消:退還「尚未完成比例」的糧(四捨五入),已過的時間不退。先結算,已完成的單不能取消
function rsvCancel(slotIdx, now) {
  var st, x, frac, refund;
  now = typeof now === 'number' && isFinite(now) ? now : Date.now();
  rsvSettle(now);
  st = rsvRead(now);
  slotIdx = slotIdx | 0;
  x = st.q[slotIdx];
  if (!x) return { ok: false, refund: 0 };
  frac = x.t1 > x.t0 ? Math.max(0, Math.min(1, (x.t1 - now) / (x.t1 - x.t0))) : 0;
  refund = Math.round(x.g * frac);
  st.q.splice(slotIdx, 1);
  rsvWrite(st);
  if (refund > 0 && typeof res4Add === 'function') res4Add({ grain: refund });
  return { ok: true, refund: refund };
}

// ───────── 補兵 ─────────
function rsvNeed(r) { return Math.max(0, Math.ceil((1 - r) * RSV_CFG.cardFull - 1e-6)); }
// 地圖回城呼叫:扣預備兵,回實際補到的比例(0..wantRatio);預備兵 0 / 自動補兵關閉(manual 不為真)→ 0。manual = 校場「一鍵補兵」
function rsvHeal(cs, cardId, wantRatio, now, manual) {
  var st, full = RSV_CFG.cardFull, need, give;
  now = typeof now === 'number' && isFinite(now) ? now : Date.now();
  if (typeof wantRatio !== 'number' || !isFinite(wantRatio) || wantRatio <= 0) return 0;
  wantRatio = Math.min(1, wantRatio);
  st = rsvRead(now);
  if (!st.auto && !manual) return 0;
  need = Math.max(1, Math.ceil(wantRatio * full - 1e-6));
  give = Math.min(st.n, need);
  if (give <= 0) {
    st.lack = { t: now, n: st.lack.n + need };
    rsvWrite(st);
    return 0;
  }
  st.n -= give;
  if (give < need) st.lack = { t: now, n: st.lack.n + (need - give) };
  rsvWrite(st);
  return Math.min(wantRatio, give / full);
}
// 隊伍順序:第 1 隊 > … > 第 5 隊 > 不在隊伍的卡;同隊:主將 > 副將 1 > 副將 2(依預設隊伍的 slot 順序)
function rsvTeamRank() {
  var m = {}, i, p, k;
  if (typeof bnTeamPresetGet !== 'function') return m;
  for (i = 1; i <= 5; i++) {
    p = bnTeamPresetGet(i);
    if (!p) break;
    for (k = 0; k < (p.slots || []).length; k++) if (m[p.slots[k].id] === undefined) m[p.slots[k].id] = i * 10 + (2 - ((p.slots[k].row | 0) % 3));   // 主將 row 2 → 0、副將一 row 1 → 1、副將二 row 0 → 2
  }
  return m;
}
function rsvOrderList(list) {
  var rank = rsvTeamRank();
  return list.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
    var ra = rank[a.x.id] === undefined ? 1000 : rank[a.x.id], rb = rank[b.x.id] === undefined ? 1000 : rank[b.x.id], pa = a.x.r === undefined ? 0 : a.x.r, pb = b.x.r === undefined ? 0 : b.x.r;
    return ra - rb || pa - pb || a.i - b.i;
  }).map(function (o) { return o.x; });
}
// cardIds(id 陣列)→ 依優先順序排好的新陣列
function rsvOrder(cs, cardIds) {
  return rsvOrderList((cardIds || []).map(function (id) { return { id: id }; })).map(function (o) { return o.id; });
}
// list = [{id, r}](在城、沒滿兵的卡與目前比例)→ [{id, add}](add = 比例,呼叫端加到自己的 trp);auto 關閉直接回 []
function rsvHealSweep(cs, list, now) {
  var st, out = [], lack = 0, full = RSV_CFG.cardFull, newLack;
  now = typeof now === 'number' && isFinite(now) ? now : Date.now();
  st = rsvRead(now);
  if (!st.auto) return out;
  rsvOrderList((list || []).filter(function (x) { return x && typeof x.id === 'string' && typeof x.r === 'number' && x.r < 1; })).forEach(function (x) {
    var need = rsvNeed(x.r), give = Math.min(st.n, need);
    if (give > 0) { st.n -= give; out.push({ id: x.id, add: give / full }); }
    lack += need - give;
  });
  newLack = lack > 0 ? { t: now, n: lack } : { t: 0, n: 0 };
  if (out.length || newLack.n !== st.lack.n) { st.lack = newLack; rsvWrite(st); }
  return out;
}
function rsvSetAuto(on) {
  var st = rsvRead(Date.now());
  st.auto = on ? 1 : 0;
  return rsvWrite(st);
}
// 校場匾額紅點:佇列有空格且未滿,或補不滿
function rsvBadge() {
  var st = rsvRead(Date.now());
  return (st.q.length < RSV_CFG.slots && st.n + rsvQueued(st) < rsvCap()) || st.lack.n > 0;
}
// 收成清單取走完成紀錄(取完清空)
function rsvTakeDone() {
  var st = rsvRead(Date.now()), d = st.done;
  if (!d.length) return [];
  st.done = [];
  rsvWrite(st);
  return d;
}
// 賽季重置(冪等):ss >= idx → {skipped:true};否則預備兵 = startN(夾上限)、征兵佇列清空(不退糧)、補不滿紀錄清空、自然招募從 tStart 起算;done / auto 保留
function rsvSeasonReset(idx, tStart) {
  var st, now = Date.now();
  idx = typeof idx === 'number' && isFinite(idx) ? Math.floor(idx) : 0;
  tStart = typeof tStart === 'number' && isFinite(tStart) ? Math.floor(tStart) : now;
  st = rsvRead(now);
  if (typeof st.ss === 'number' && st.ss >= idx) return { skipped: true };
  st.n = Math.min(RSV_CFG.startN, rsvCap());
  st.q = [];
  st.lack = { t: 0, n: 0 };
  st.ft = Math.max(0, tStart);
  st.ss = idx;
  rsvWrite(st);
  return { skipped: false };
}
