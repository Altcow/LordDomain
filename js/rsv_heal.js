// js/rsv_heal.js — 隊伍內頁「補兵」(2026-11-18,設計_校場與補兵UI_需求.md):3 位武將各一條兵力拉條(+ 可輸入的數字),按〔確認〕才扣預備兵;〔一鍵補兵〕補到滿。
// 純邏輯(無 DOM,node 可測)+ 套用(扣預備兵走 rsvHeal(…, manual)、兵力比例寫回地圖模組 W.trp 走 wdTrpSet)。校場畫面只留徵兵,補兵全部在這裡。
// 兵力單位 = 兵(整數);每張卡滿兵 RSV_CFG.cardFull(1000);W.trp[id].r = 比例 0~1。行軍中(wdIsField)的卡不能補(locked)。
// 一鍵補兵規則(預備兵不夠時):先補「兵力比例最低」者到滿,再補下一個;比例相同依傳入順序(隊內:主將 > 副將 1 > 副將 2)。補到預備兵用完為止。
// 公開:rsvHealFull() rsvHealRow(W, cs, id) rsvHealUsed(rows, targets) rsvHealClamp(rows, reserve, targets, id, want) rsvHealAllPlan(rows, reserve) rsvHealApply(W, cs, adds, now)
// ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:rsv.js、wd_core.js 之後。

function rsvHealFull() { return (typeof RSV_CFG !== 'undefined' && RSV_CFG.cardFull > 0) ? RSV_CFG.cardFull : 1000; }
// 一張卡的補兵資料:{id, r, cur 目前兵數, full 滿兵, locked 行軍中不能補}
function rsvHealRow(W, cs, id) {
  var full = rsvHealFull(), o = W && W.trp ? W.trp[id] : null, r = o && typeof o.r === 'number' ? Math.max(0, Math.min(1, o.r)) : 1, e = null, locked = false;
  try { e = (typeof wdCard === 'function' && cs) ? wdCard(cs, id) : null; locked = !!(e && typeof wdIsField === 'function' && wdIsField(e)); } catch (er) { locked = false; }
  return { id: id, r: r, cur: Math.round(r * full), full: full, locked: locked };
}
function rsvHealInt(x, lo, hi) { x = Math.floor(+x); if (!isFinite(x)) x = lo; return Math.max(lo, Math.min(hi, x)); }
// targets = {id: 想補到的兵數};已選補兵總量 = Σ max(0, min(full, 目標) − 目前)(鎖定的卡不算)
function rsvHealUsed(rows, targets) {
  var s = 0;
  (rows || []).forEach(function (x) {
    var t = targets && targets[x.id] !== undefined ? targets[x.id] : x.cur;
    if (!x.locked) s += Math.max(0, Math.min(x.full, Math.floor(+t || 0)) - x.cur);
  });
  return s;
}
// 把某張卡的目標夾在 [目前, 滿兵],且不超過「預備兵 − 其他卡已選的補兵量」;回 {v, capped}(capped = 被預備兵限制住)
function rsvHealClamp(rows, reserve, targets, id, want) {
  var row = null, others = 0, room, v;
  (rows || []).forEach(function (x) {
    if (x.id === id) row = x;
    else if (!x.locked) others += Math.max(0, Math.min(x.full, Math.floor(+(targets && targets[x.id] !== undefined ? targets[x.id] : x.cur) || 0)) - x.cur);
  });
  if (!row) return { v: 0, capped: false };
  if (row.locked) return { v: row.cur, capped: false };
  room = Math.max(0, Math.floor(+reserve || 0) - others);
  v = rsvHealInt(want, row.cur, row.full);
  if (v - row.cur > room) return { v: row.cur + room, capped: true };
  return { v: v, capped: false };
}
// 一鍵補兵計畫:rows = [{id, r, cur, full, locked}](傳入順序 = 同比例時的先後);回 {adds:[{id, add}], used, left}
function rsvHealAllPlan(rows, reserve) {
  var left = Math.max(0, Math.floor(+reserve || 0)), adds = [], used = 0;
  (rows || []).map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return !o.x.locked && o.x.cur < o.x.full; })
    .sort(function (a, b) { return (a.x.cur - b.x.cur) || (a.i - b.i); })
    .forEach(function (o) {
      var give = Math.min(left, o.x.full - o.x.cur);
      if (give > 0) { adds.push({ id: o.x.id, add: give }); left -= give; used += give; }
    });
  return { adds: adds, used: used, left: left };
}
// 套用:adds = [{id, add(兵數)}] → 扣預備兵(rsvHeal manual)並把比例寫回 W.trp;回 {n 補到的卡數, used 實際扣的預備兵}
function rsvHealApply(W, cs, adds, now) {
  var n = 0, used = 0, full = rsvHealFull(), before = (typeof rsvGet === 'function') ? rsvGet().n : 0, after;
  now = typeof now === 'number' && isFinite(now) ? now : Date.now();
  if (typeof rsvHeal !== 'function' || typeof wdTrpSet !== 'function' || !W || !W.trp) return { n: 0, used: 0 };
  (adds || []).forEach(function (a) {
    var o = W.trp[a.id], row = rsvHealRow(W, cs, a.id), got, add = Math.max(0, Math.min(row.full - row.cur, Math.floor(+a.add || 0)));
    if (!a || row.locked || add <= 0) return;
    got = rsvHeal(cs, a.id, add / full, now, true);
    if (typeof got === 'number' && isFinite(got) && got > 0) { wdTrpSet(W, a.id, Math.min(1, row.r + got), now); n++; }
    void o;
  });
  after = (typeof rsvGet === 'function') ? rsvGet().n : 0;
  used = Math.max(0, before - after);
  if (n && typeof wdUiSave === 'function') { try { wdUiSave(); } catch (e) { /* 存檔失敗不影響補兵 */ } }
  return { n: n, used: used };
}
