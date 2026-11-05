// js/tavern_i1.js — 酒館 I1(PLAN_INTERIORS §1(e)(f)(g)):二樓包間收益、客座小事件、掌櫃職司連動、帳房 / 事件 / 包間面板。
// 資料在 tavern_data.js(TAVERN_ECON / TAVERN_EVENTS,數值全 PLACEHOLDER);存檔欄位在 tavern_scene.js tavernNormSave(world.city.tavern:at / cf / inc / tot / ev,有值才寫)。
// 收益:每遊戲小時(真實 120 秒)結算一次 = 客座消費 + 包間費(包間只影響收入,與抽卡無關;使用者決議),入帳 world.res.coin;以牆鐘時間 tv.at 推進——
//   距上次結算 ≤ 300 秒視為線上(全額);更久視為離線 → 沿用 offlineCapSec()(8 小時 + 科技)上限與 offlineRate() 倍率。主迴圈只呼叫 tavernTick(dt)(每 5 秒檢查一次),不新增計時器。
// 客座小事件:每 10 分鐘一批(沿用 I0 的時間桶),該批是否有事件、哪位客人、什麼事件由(酒館種子, 日號, 批號)確定性決定;每日處理上限 TAVERN_ECON.evDayMax;獎勵很小。
// 掌櫃職司:名冊人物派駐在酒館(npcdata.js 職司 keep)→ 收入與事件獎勵 +min(keepCap, 人事乘區% × keepScale + 詞條),酒館室內掌櫃換成該人物外觀。
// 面板為室內 layer 內的 DOM(#tv1Panel),只在開啟時重繪;不增加每幀成本。不發聲(僅 toast)。ES2017;不用 ?. ??。
// 全域名稱:TV1 tavernBuilt tavernHourIncome tavernRoomOcc tavernKeeperPerson tavernKeepBonus tavernEconSettle tavernTick tavernEventFor tavernEventOutcome tavernEventApply
//          tavernLvUpInfo tavernLvUp tavernRoomUpInfo tavernRoomUp tavernI1Enter tavernI1Offer tavernI1OpenRoom tavernI1OpenEvent tavernI1OpenLedger tavernI1Close tavernI1Leave tavernI1DrawMark tavernI1Act

var TV1 = { acc: 0, last: null, panel: null, chip: null, btn: null, mode: '', roomI: 0, evRes: null, msg: '' };
var TAVERN_LV_NAMES = ['酒肆', '酒舍', '酒樓', '名樓', '天下名樓'];

function tvNow() { return Date.now(); }
function tvEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function tvFmt(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function tvDay(ms) {   // 本機日號(同 npcDayOf / cardsTz)
  return Math.floor((ms - new Date(ms).getTimezoneOffset() * 60000) / 86400000);
}
function tvToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function tvCoinAdd(n) { if (typeof world !== 'undefined' && world && world.res) world.res.coin = (world.res.coin || 0) + n; }
function tvCoinHave() { return (typeof world !== 'undefined' && world && world.res) ? (world.res.coin || 0) : 0; }

// 是否有酒館建築(沒有就不結算收益)
function tavernBuilt() {
  var objs, i;
  if (typeof npcCountType === 'function') return npcCountType('tavern') > 0;
  objs = (typeof world !== 'undefined' && world && Array.isArray(world.objects)) ? world.objects : [];
  for (i = 0; i < objs.length; i++) if (objs[i] && objs[i].type === 'tavern') return true;
  return false;
}

// ───────── 掌櫃職司 ─────────
// 派駐在酒館的名冊人物;無 → null。回 {id, name, gr, spec, e, pct}
function tavernKeeperPerson() {
  var info, id, ro, e = null, i, cs;
  if (typeof npcStaffInfo !== 'function') return null;
  try { info = npcStaffInfo('tavern'); } catch (er) { return null; }
  if (!info || !info.people || !info.people.length) return null;
  id = info.people[0].id;
  cs = (typeof cardsGet === 'function') ? cardsGet() : null;
  ro = (cs && cs.roster) || [];
  for (i = 0; i < ro.length; i++) if (ro[i].id === id) e = ro[i];
  if (!e) return null;
  return { id: e.id, name: e.name, gr: e.gr, e: e, pct: info.pct, spec: (typeof npcHeroSpec === 'function') ? npcHeroSpec(e) : null };
}
// 掌櫃加成:{bonus 0~keepCap, pct 人事乘區%, person}
function tavernKeepBonus() {
  var E = TAVERN_ECON, p = tavernKeeperPerson(), b = 0, tr, i;
  if (!p) return { bonus: 0, pct: 0, person: null };
  b = (p.pct || 0) / 100 * E.keepScale;
  tr = p.e.tr || [];
  for (i = 0; i < tr.length; i++) b += E.keepTraits[tr[i]] || 0;
  return { bonus: Math.max(0, Math.min(E.keepCap, b)), pct: p.pct || 0, person: p };
}

// ───────── 收益 ─────────
// 某包間在某遊戲小時(hourIdx)與時段(per)的入住狀態:{occ, lv, job, n}
function tvRoomOcc(tv, i, per, hourIdx) {
  var E = TAVERN_ECON, rl = tavernRoomLv(tv, i), r = interiorRng(interiorHash('tavRoom', tv.seed, hourIdx, i)), occ = r() < (E.roomOcc[per] || 0.5) + E.roomOccPerLv * (rl - 1);
  return { occ: occ, lv: rl, job: TAVERN_GUEST_JOBS[Math.floor(r() * TAVERN_GUEST_JOBS.length)], n: 2 };
}
// 某包間在時間 tMs 所屬遊戲小時的入住狀態(面板 / 門顯示用,與結算同源)
function tavernRoomOcc(tv, i, tMs) {
  return tvRoomOcc(tv, i, tavernPeriod(new Date(tMs).getHours()), Math.floor(tMs / (TAVERN_ECON.hourSec * 1000)));
}
// 某遊戲小時的基礎收入(未含掌櫃、離線倍率):{seat, room, total, guests}
function tavernHourIncome(tv, tMs) {
  var E = TAVERN_ECON, per = tavernPeriod(new Date(tMs).getHours()), bucket = Math.floor(tMs / TAVERN_CFG.bucketMs), hourIdx = Math.floor(tMs / (E.hourSec * 1000)), lv = Math.max(1, Math.min(5, tv.lv | 0)), n = tavernRoomCount(tv), i, st, room = 0, guests, seat;
  guests = tavernGuestCount(tv.seed, bucket, per, lv);
  seat = guests * (E.seatBase + E.seatPerLv * lv);
  for (i = 0; i < n; i++) {
    st = tvRoomOcc(tv, i, per, hourIdx);
    if (st.occ) room += E.roomFee[st.lv - 1] + E.roomEat[st.lv - 1];
  }
  return { seat: seat, room: room, guests: guests, total: Math.min(E.capHour[lv - 1], seat + room) };
}
// 入帳並記今日 / 累計
function tavernCredit(tv, whole, now) {
  var day;
  if (!(whole > 0)) return;
  tvCoinAdd(whole);
  day = tvDay(now);
  if (!tv.inc || tv.inc.d !== day) tv.inc = { d: day, c: 0 };
  tv.inc.c += whole;
  tv.tot = Math.min(1e12, (tv.tot || 0) + whole);
}
// 今日收入(跨日歸零)
function tavernIncomeToday(tv, now) { return (tv && tv.inc && tv.inc.d === tvDay(now || tvNow())) ? tv.inc.c : 0; }
// 結算。回 null(尚未滿 1 遊戲小時 / 無酒館)或 {coin, hours, offline, rate, bonus}
function tavernEconSettle(now) {
  var E = TAVERN_ECON, tv = (typeof tavernGet === 'function') ? tavernGet() : null, H = E.hourSec * 1000, el, offline, n, capSec, rate = 1, k, sum = 0, kb, coin, whole, res;
  if (!tv) return null;
  now = now || tvNow();
  if (!tavernBuilt()) { if (tv.at) delete tv.at; return null; }
  if (!tv.at || tv.at > now + 60000) { tv.at = now; return null; }   // 首次(不補發)/ 時鐘回撥
  el = now - tv.at;
  if (el < H) return null;
  offline = el / 1000 > E.gapSec;
  n = Math.floor(el / H);
  if (offline) {
    capSec = (typeof offlineCapSec === 'function') ? offlineCapSec() : E.capSecDefault;
    n = Math.min(n, Math.floor(capSec / E.hourSec));
    rate = (typeof offlineRate === 'function') ? offlineRate() : E.rateDefault;
  }
  kb = tavernKeepBonus().bonus;
  for (k = 0; k < n; k++) sum += tavernHourIncome(tv, tv.at + k * H).total;
  tv.at = offline ? now : tv.at + n * H;
  coin = sum * (1 + kb) * rate + (tv.cf || 0);
  whole = Math.floor(coin + 1e-9);
  coin -= whole;
  if (coin > 0.0001) tv.cf = Math.round(coin * 10000) / 10000; else delete tv.cf;
  tavernCredit(tv, whole, now);
  res = { coin: whole, hours: n, offline: offline, rate: rate, bonus: kb };
  TV1.last = res;
  return res;
}
// 主迴圈掛點(main.js frame):每 5 秒檢查一次;例外一律略過
function tavernTick(dt) {
  TV1.acc += dt || 0;
  if (TV1.acc < 5) return null;
  TV1.acc = 0;
  try {
    var r = tavernEconSettle(tvNow());
    if (r && TV1.chip) tavernI1Refresh();
    return r;
  } catch (e) { return null; }
}

// ───────── 升級 ─────────
function tvGoodsText(goods) {
  var out = [], id;
  for (id in (goods || {})) out.push(((typeof GOODS !== 'undefined' && GOODS[id]) ? GOODS[id].name : id) + ' ' + goods[id]);
  return out.join('、');
}
// 檢查並回 {ok, why, cost:{coin, goods}, need}
function tvCheckCost(cost) {
  var chk;
  if (tvCoinHave() < cost.coin) return { ok: false, why: 'coin' };
  if (cost.goods) {
    if (typeof cityGoodsReq !== 'function') return { ok: false, why: 'goods' };
    chk = cityGoodsReq(cost.goods);
    if (!chk.ok) return { ok: false, why: 'goods' };
  }
  return { ok: true };
}
function tvSpend(cost) {
  if (cost.goods && typeof cityGoodsSpend === 'function' && !cityGoodsSpend(cost.goods)) return false;
  tvCoinAdd(-cost.coin);
  return true;
}
function tavernLvUpInfo(tv) {
  var E = TAVERN_ECON, nx = tv.lv + 1, U, rank, chk;
  if (tv.lv >= 5) return { max: true, ok: false, why: 'max' };
  U = E.lvUp[nx - 1];
  rank = (typeof cardsRankLv === 'function') ? cardsRankLv() : 0;
  if (rank > 0 && rank < U.rank) return { next: nx, cost: U, ok: false, why: 'rank', rank: U.rank };
  if (U.gate && typeof nlFeatureOpen === 'function' && !nlFeatureOpen(U.gate)) return { next: nx, cost: U, ok: false, why: 'gate' };
  chk = tvCheckCost(U);
  return { next: nx, cost: U, ok: chk.ok, why: chk.ok ? '' : chk.why };
}
function tavernLvUp() {
  var tv = tavernGet(), info = tv ? tavernLvUpInfo(tv) : null, i, need;
  if (!info || !info.ok) return info || { ok: false, why: 'none' };
  if (!tvSpend(info.cost)) return { ok: false, why: 'goods' };
  tv.lv = info.next;
  need = tavernRoomCount(tv);
  while (tv.rooms.length < need) tv.rooms.push({ lv: 1, use: 'coin', staff: null });
  tvToast('酒肆升為「' + TAVERN_LV_NAMES[tv.lv - 1] + '」,新增包間');
  return { ok: true, lv: tv.lv };
}
function tavernRoomUpInfo(tv, i) {
  var E = TAVERN_ECON, rl = tavernRoomLv(tv, i), nx = rl + 1, cost, chk;
  if (i < 0 || i >= tavernRoomCount(tv)) return { ok: false, why: 'none' };
  if (rl >= 5) return { max: true, ok: false, why: 'max' };
  cost = { coin: Math.round(E.roomUpBase * Math.pow(E.roomUpMul, nx - 2)), goods: E.roomUpGoods[nx - 1] || null };
  chk = tvCheckCost(cost);
  return { next: nx, cost: cost, ok: chk.ok, why: chk.ok ? '' : chk.why };
}
function tavernRoomUp(i) {
  var tv = tavernGet(), info = tv ? tavernRoomUpInfo(tv, i) : null;
  if (!info || !info.ok) return info || { ok: false, why: 'none' };
  if (!tvSpend(info.cost)) return { ok: false, why: 'goods' };
  while (tv.rooms.length <= i) tv.rooms.push({ lv: 1, use: 'coin', staff: null });
  tv.rooms[i].lv = info.next;
  return { ok: true, lv: info.next };
}

// ───────── 小事件 ─────────
// 純函式:該批是否有事件。回 null 或 {id, gi 客人序, bucket, day}
function tavernEventFor(seed, day, bucket, period, nGuests) {
  var E = TAVERN_ECON, r, total = 0, x, i, ev, gi;
  if (!(nGuests >= 1)) return null;
  r = interiorRng(interiorHash('tavEv', seed, day, bucket));
  if (r() >= (E.evChance[period] || 0.4)) return null;
  for (i = 0; i < TAVERN_EVENTS.length; i++) total += TAVERN_EVENTS[i].w;
  x = r() * total;
  for (i = 0; i < TAVERN_EVENTS.length; i++) { x -= TAVERN_EVENTS[i].w; if (x < 0) break; }
  ev = TAVERN_EVENTS[Math.min(i, TAVERN_EVENTS.length - 1)];
  gi = Math.floor(r() * nGuests);
  return { id: ev.id, gi: gi, bucket: bucket, day: day };
}
function tvEventDef(id) { var i; for (i = 0; i < TAVERN_EVENTS.length; i++) if (TAVERN_EVENTS[i].id === id) return TAVERN_EVENTS[i]; return null; }
function tvRoll(r, rng) { return Math.floor(r[0] + rng() * (r[1] - r[0] + 1)); }
// 純函式:選項結果。qmul = 1 + 掌櫃加成。回 {res, coin, goods:{id:n}, fav, win}
function tavernEventOutcome(seed, day, bucket, evId, optIdx, qmul) {
  var def = tvEventDef(evId), opt, rng, pick, rw, out, id;
  if (!def) return null;
  opt = def.opts[optIdx];
  if (!opt) return null;
  qmul = qmul > 0 ? qmul : 1;
  rng = interiorRng(interiorHash('tavRw', seed, day, bucket, evId, optIdx));
  out = { res: '', coin: 0, goods: {}, fav: 0, win: null };
  if (opt.win) { out.win = rng() < 0.5; pick = out.win ? opt.win : opt.lose; } else pick = opt;
  out.res = pick.res;
  rw = pick.rw || {};
  if (rw.coin) out.coin = Math.max(1, Math.round(tvRoll(rw.coin, rng) * qmul));
  if (rw.goods) for (id in rw.goods) out.goods[id] = Math.max(1, Math.round(tvRoll(rw.goods[id], rng) * qmul));
  if (rw.fav) out.fav = rw.fav | 0;
  return out;
}
// 套用結果(入帳、記今日次數)。回 {text 獎勵摘要}
function tavernEventApply(S, out, now) {
  var tv = tavernGet(), day = tvDay(now), parts = [], id, kp, r, gname;
  if (out.coin > 0) { tavernCredit(tv, out.coin, now); parts.push('金幣 +' + out.coin); }
  for (id in out.goods) {
    if (typeof cityGoodsAdd === 'function' && typeof GOODS !== 'undefined' && GOODS[id]) { cityGoodsAdd(id, out.goods[id]); gname = GOODS[id].name; parts.push(gname + ' ×' + out.goods[id]); }
  }
  if (out.fav > 0) {
    kp = tavernKeeperPerson();
    if (kp && typeof npcFavAdd === 'function') {
      try { r = npcFavAdd((typeof cardsGet === 'function') ? cardsGet() : null, kp.e, now, 'tavern'); } catch (e) { r = null; }
      if (r && r.gain) parts.push(kp.name + ' 親近 +1');
    }
  }
  if (!tv.ev || tv.ev.d !== day) tv.ev = { d: day, n: 0, b: [] };
  tv.ev.n++;
  if (S && typeof S.bucket === 'number') { tv.ev.b.push(S.bucket); if (tv.ev.b.length > 8) tv.ev.b.shift(); }
  return { text: parts.join(' · ') };
}

// ───────── 場景掛點(tavern_scene.js 呼叫)─────────
function tavernI1Enter(S, nowDate) {
  var tv = tavernGet(), now = nowDate ? nowDate.getTime() : tvNow(), kp, i, last;
  if (!tv) return;
  try { tavernEconSettle(now); } catch (e) { /* 略過 */ }
  kp = tavernKeeperPerson();
  S.keeperPerson = kp;
  S.tvRooms = [];
  for (i = 0; i < tavernRoomCount(tv); i++) { var st = tavernRoomOcc(tv, i, now); S.tvRooms.push({ lv: st.lv, occ: st.occ }); }
  tavernI1BuildUi();
  tavernI1Refresh();
  last = TV1.last;
  if (last && last.offline && last.coin > 0 && !last.shown) { last.shown = true; tvToast('大人不在這幾日,包間收了' + tvFmt(last.coin) + '文酒錢,小的都記在帳上了。'); }
}
function tavernI1Offer(S, nowDate) {
  var tv = tavernGet(), now = nowDate ? nowDate.getTime() : tvNow(), day = tvDay(now), ev = (tv && tv.ev && tv.ev.d === day) ? tv.ev : null;
  S.evOffer = null; S.evDone = false;
  if (!tv || !S.guestShown) return;
  if (ev && (ev.n >= TAVERN_ECON.evDayMax || ev.b.indexOf(S.bucket) >= 0)) return;
  S.evOffer = tavernEventFor(tv.seed, day, S.bucket, S.period, S.guestShown.length);
}
// 事件客人頭上的「!」標記(drawTop 內每幀呼叫,極輕)
function tavernI1DrawMark(ctx, S, t) {
  var ent = null, i, p, y, a;
  for (i = 0; i < S.npcEnts.length; i++) if (S.npcEnts[i].spot && S.npcEnts[i].spot.kind === 'event') ent = S.npcEnts[i];
  if (!ent) return;
  p = ent.footPt(S);
  a = (typeof isPowerSave === 'function' && isPowerSave()) ? 0 : Math.abs(Math.sin(t * 3)) * 3;
  y = p[1] - 50 - a;
  ctx.fillStyle = '#ffd36a'; ctx.strokeStyle = 'rgba(90,50,10,.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(p[0], y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5a3210'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('!', p[0], y + 0.5);
}

// ───────── DOM:chip / 帳房鈕 / 面板 ─────────
function tvCss() {
  var st;
  if (typeof document === 'undefined' || !document.head || !document.createElement || document.getElementById('tv1Style')) return;
  st = document.createElement('style');
  st.id = 'tv1Style';
  st.textContent = '#tv1Chip{position:absolute;left:8px;top:calc(54px + env(safe-area-inset-top));z-index:3;padding:4px 9px;border-radius:10px;background:rgba(28,20,14,.78);color:#f4ead2;font-size:12px;line-height:1.35;pointer-events:none;white-space:nowrap}' +
    '#tv1Btn{position:absolute;left:8px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:3;min-width:84px;min-height:44px;border:none;border-radius:10px;background:rgba(122,74,36,.92);color:#f4ead2;font-size:15px}' +
    '#tv1Panel{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom));z-index:4;width:min(360px,calc(100vw - 20px));max-height:62vh;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:10px 12px;border-radius:12px;background:rgba(32,22,14,.95);color:#f4ead2;font-size:14px;line-height:1.5;box-shadow:0 4px 18px rgba(0,0,0,.5)}' +
    '#tv1Panel[hidden]{display:none}#tv1Panel .tvh{display:flex;align-items:center;gap:6px;margin-bottom:4px}#tv1Panel .tvh b{flex:1;font-size:16px}' +
    '#tv1Panel button{min-height:44px;margin:4px 6px 0 0;padding:6px 12px;border:none;border-radius:8px;background:#7a4a24;color:#f4ead2;font-size:14px}#tv1Panel button.tvx{min-width:44px;margin:0;background:rgba(255,255,255,.14);font-size:18px}' +
    '#tv1Panel button[disabled]{opacity:.4}#tv1Panel .tvr{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.08)}#tv1Panel .tvg{color:#f1d27a}#tv1Panel .tvd{opacity:.75;font-size:12px}#tv1Panel .tvt{margin:4px 0 6px}';
  document.head.appendChild(st);
}
function tavernI1BuildUi() {
  var st = (typeof interiorState === 'function') ? interiorState() : null, layer = st && st.layer, chip, btn, panel;
  if (!layer || typeof document === 'undefined') return;
  tvCss();
  chip = document.createElement('div'); chip.id = 'tv1Chip';
  btn = document.createElement('button'); btn.id = 'tv1Btn'; btn.textContent = '💰 帳房';
  panel = document.createElement('div'); panel.id = 'tv1Panel'; panel.hidden = true;
  [btn, panel].forEach(function (el) {
    el.addEventListener('pointerdown', function (e) { if (e && e.stopPropagation) e.stopPropagation(); });
    el.addEventListener('pointerup', function (e) { if (e && e.stopPropagation) e.stopPropagation(); });
  });
  btn.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); tavernI1OpenLedger(); });
  panel.addEventListener('click', function (e) {
    var t = e && e.target, a = null;
    while (t && t !== panel) { a = t.getAttribute ? t.getAttribute('data-a') : null; if (a) break; t = t.parentNode; }
    if (a) tavernI1Act(a, t.getAttribute('data-i'));
  });
  layer.appendChild(chip); layer.appendChild(btn); layer.appendChild(panel);
  TV1.chip = chip; TV1.btn = btn; TV1.panel = panel; TV1.mode = '';
}
function tavernI1Refresh() {
  var tv = tavernGet(), now = tvNow(), txt;
  if (!tv || !TV1.chip) return;
  txt = '今日收入 +' + tvFmt(tavernIncomeToday(tv, now)) + ' · 累計 ' + tvFmt(tv.tot || 0);
  if (TV1.chip.textContent !== txt) TV1.chip.textContent = txt;
}
function tvShow(html, mode) {
  if (!TV1.panel) return;
  TV1.panel.innerHTML = html;
  TV1.panel.hidden = false;
  TV1.mode = mode;
  if (TV1.btn) TV1.btn.hidden = true;
}
function tavernI1Close() {
  if (!TV1.panel || TV1.panel.hidden) return false;
  TV1.panel.hidden = true; TV1.mode = ''; TV1.evRes = null;
  if (TV1.btn) TV1.btn.hidden = false;
  return true;
}
function tavernI1Leave() { TV1.chip = null; TV1.btn = null; TV1.panel = null; TV1.mode = ''; TV1.evRes = null; }

function tvCostText(c) { return tvFmt(c.coin) + ' 金' + (c.goods ? '、' + tvGoodsText(c.goods) : ''); }
function tvWhy(info) {
  if (info.why === 'rank') return '官階未達';
  if (info.why === 'gate') return '科技未研';
  if (info.why === 'goods') return '貨品不足';
  if (info.why === 'coin') return '金幣不足';
  return '';
}
function tavernI1Rebuild() {   // 酒館 / 包間升級後:重排門、重烘背景、重建實體
  var S = (typeof interiorState === 'function' && interiorState().open) ? interiorState().S : null, tv = tavernGet(), n, i, now = tvNow(), st;
  if (!S || !tv) return;
  n = tavernRoomCount(tv);
  S.rooms = n; S.tvRooms = [];
  for (i = 0; i < n; i++) { st = tavernRoomOcc(tv, i, now); S.tvRooms.push({ lv: st.lv, occ: st.occ }); }
  tavernApplyRooms(S.def, n);
  S.guestShown = S.guestData.slice(0, Math.max(1, 14 - n));
  if (S.evOffer && S.evOffer.gi >= S.guestShown.length) S.evOffer = null;
  if (typeof itrResize === 'function') itrResize();
}

function tavernI1OpenLedger() {
  var tv = tavernGet(), now = tvNow(), kb, up, n, i, h, rows = '', st, upTxt, hr;
  if (!tv) return;
  kb = tavernKeepBonus();
  up = tavernLvUpInfo(tv);
  n = tavernRoomCount(tv);
  hr = tavernHourIncome(tv, now);
  h = '<div class="tvh"><b>帳房 · ' + TAVERN_LV_NAMES[tv.lv - 1] + ' Lv' + tv.lv + '</b><button class="tvx" data-a="x" aria-label="關閉">✕</button></div>';
  h += '<div class="tvr"><span>今日收入</span><span class="tvg">+' + tvFmt(tavernIncomeToday(tv, now)) + '</span></div>';
  h += '<div class="tvr"><span>累計收入</span><span>' + tvFmt(tv.tot || 0) + '</span></div>';
  h += '<div class="tvr"><span>本時預估(每遊戲小時)</span><span>約 ' + tvFmt(hr.total * (1 + kb.bonus)) + '</span></div>';
  h += '<div class="tvr"><span>掌櫃</span><span>' + (kb.person ? tvEsc(kb.person.name) + ' (+' + Math.round(kb.bonus * 100) + '%)' : '尚無人派駐') + '</span></div>';
  h += '<div class="tvr"><span>今日小事件</span><span>' + ((tv.ev && tv.ev.d === tvDay(now)) ? tv.ev.n : 0) + ' / ' + TAVERN_ECON.evDayMax + '</span></div>';
  for (i = 0; i < n; i++) {
    st = tavernRoomOcc(tv, i, now);
    rows += '<div class="tvr"><button data-a="room" data-i="' + i + '">' + '甲乙丙丁戊己'.charAt(i) + '房 Lv' + st.lv + '</button><span>' + (st.occ ? '客人入住' : '空房') + '</span></div>';
  }
  h += '<div class="tvt tvd">包間(點選查看)</div>' + rows;
  if (up.max) upTxt = '<div class="tvd">酒肆已是最高等級</div>';
  else upTxt = '<button data-a="lup"' + (up.ok ? '' : ' disabled') + '>升為「' + TAVERN_LV_NAMES[up.next - 1] + '」 ' + tvCostText(up.cost) + '</button>' + (up.ok ? '' : '<div class="tvd">' + tvWhy(up) + (up.why === 'rank' ? '(需官階 ' + up.rank + ' 級)' : '') + '</div>');
  h += '<div class="tvt">' + upTxt + '</div>';
  if (TV1.msg) h += '<div class="tvd">' + tvEsc(TV1.msg) + '</div>';
  tvShow(h, 'ledger');
}
function tavernI1OpenRoom(S, i) {
  var tv = tavernGet(), now = tvNow(), st, info, h, E = TAVERN_ECON, jn;
  if (!tv || i < 0 || i >= tavernRoomCount(tv)) return;
  TV1.roomI = i;
  st = tavernRoomOcc(tv, i, now);
  info = tavernRoomUpInfo(tv, i);
  jn = TAVERN_JOB_NAMES[st.job] || '客人';
  h = '<div class="tvh"><b>' + '甲乙丙丁戊己'.charAt(i) + '房 · Lv' + st.lv + '</b><button class="tvx" data-a="x" aria-label="關閉">✕</button></div>';
  h += '<div class="tvr"><span>狀態</span><span class="tvg">' + (st.occ ? '客人入住(' + jn + ' ' + st.n + ' 位)' : '空房') + '</span></div>';
  h += '<div class="tvr"><span>包廂費(每遊戲小時)</span><span>' + E.roomFee[st.lv - 1] + ' 文' + (st.occ ? '' : '(有客才收)') + '</span></div>';
  h += '<div class="tvr"><span>客人消費(每遊戲小時)</span><span>' + E.roomEat[st.lv - 1] + ' 文</span></div>';
  h += '<div class="tvr"><span>入住機率</span><span>約 ' + Math.round(((E.roomOcc[tavernPeriod(new Date(now).getHours())] || 0.5) + E.roomOccPerLv * (st.lv - 1)) * 100) + '%</span></div>';
  if (info.max) h += '<div class="tvd">此間已是最高等級</div>';
  else h += '<button data-a="rup"' + (info.ok ? '' : ' disabled') + '>升到 Lv' + info.next + ' ' + tvCostText(info.cost) + '</button>' + (info.ok ? '' : '<div class="tvd">' + tvWhy(info) + '</div>');
  h += '<div><button data-a="ledger">帳房總覽</button></div>';
  tvShow(h, 'room');
}
function tavernI1OpenEvent(S) {
  var def, o, tv = tavernGet(), job, guest, h, i;
  S = S || ((typeof interiorState === 'function' && interiorState().open) ? interiorState().S : null);
  if (!S || !S.evOffer || S.evDone) return;
  o = S.evOffer;
  def = tvEventDef(o.id);
  if (!def || !tv) return;
  guest = S.guestShown && S.guestShown[o.gi];
  job = (guest && TAVERN_JOB_NAMES[guest.job]) || '客人';
  h = '<div class="tvh"><b>' + tvEsc(def.name) + '</b><button class="tvx" data-a="x" aria-label="關閉">✕</button></div>';
  h += '<div class="tvt">' + tvEsc(def.intro.replace('{job}', job)) + '</div>';
  for (i = 0; i < def.opts.length; i++) h += '<button data-a="opt" data-i="' + i + '">' + tvEsc(def.opts[i].t) + '</button>';
  TV1.evRes = null;
  tvShow(h, 'event');
}
function tavernI1Pick(i) {
  var S = (typeof interiorState === 'function' && interiorState().open) ? interiorState().S : null, tv = tavernGet(), now = tvNow(), o, def, out, ap, h, kb;
  if (!S || !S.evOffer || S.evDone || !tv) return null;
  o = S.evOffer;
  def = tvEventDef(o.id);
  kb = tavernKeepBonus();
  out = tavernEventOutcome(tv.seed, o.day, o.bucket, o.id, i | 0, 1 + kb.bonus);
  if (!out) return null;
  ap = tavernEventApply(S, out, now);
  S.evDone = true;
  TV1.evRes = { out: out, text: ap.text };
  h = '<div class="tvh"><b>' + tvEsc(def.name) + '</b><button class="tvx" data-a="x" aria-label="關閉">✕</button></div>';
  h += '<div class="tvt">' + tvEsc(out.res) + '</div>';
  if (ap.text) h += '<div class="tvr"><span>獎勵</span><span class="tvg">' + tvEsc(ap.text) + '</span></div>';
  h += '<button data-a="x">好</button>';
  tvShow(h, 'result');
  tavernI1Refresh();
  return out;
}
function tavernI1Act(a, idx) {
  var r, i = idx === null || idx === undefined ? 0 : (idx | 0);
  if (a === 'x') { tavernI1Close(); return; }
  if (a === 'opt') { tavernI1Pick(i); return; }
  if (a === 'room') { tavernI1OpenRoom(null, i); return; }
  if (a === 'ledger') { TV1.msg = ''; tavernI1OpenLedger(); return; }
  if (a === 'rup') {
    r = tavernRoomUp(TV1.roomI);
    if (r.ok) { tavernI1Rebuild(); tvToast('包間升為 Lv' + r.lv); }
    tavernI1OpenRoom(null, TV1.roomI);
    tavernI1Refresh();
    return;
  }
  if (a === 'lup') {
    r = tavernLvUp();
    TV1.msg = r.ok ? '' : '無法升級';
    if (r.ok) tavernI1Rebuild();
    tavernI1OpenLedger();
    tavernI1Refresh();
  }
}
