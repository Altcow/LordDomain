// js/academy.js — 學院系統引擎(PLAN_CARDS §7B、第四批決議 P4/P8;PLAN_INTERIORS §4 P6 請託『送學院進修』、P7 成長訓練)。
// 院級 1~5 依學舍 / 學宮 / 精舍建築數與科技決定(不另蓋『學院』建築,無升級按鈕);課程:升階(白→青、青→藍)、精進(職業 +1 階)、習藝(新增職業 I 階)。
// 花費以『碎片』(卡片熔爐所得,同一碎片池 cs.shards;碎片不再自動轉酒令,付費只扣 cs.shards)與金幣為主;數值全在 carddata.js 的 CARD_ACADEMY(PLACEHOLDER)。
// 進修狀態寫在名冊 entry.study(只有進修中才有欄位)、entry.sn(累計送去進修次數,>0 才寫);在學者不能派駐 / 請辭。1 課 = 遊玩中 CARD_ACADEMY.lessonSec 秒(離線不推進)。
// 名人不進修;升星(cards.js cardsStarUp)與信物功能不在此實作。全部以 typeof 守衛外部模組。ES2017(不使用可選串接與空值合併運算子)。
// 全域名稱:academyLevel academySeats academyUsed academyCtx academyCheck academyStart academyRush academyQuit academyTick academyFinish academyErrandOk academyShardTotal academyInfo

function acadObjs() { return (typeof world !== 'undefined' && world && Array.isArray(world.objects)) ? world.objects : []; }
function acadCount(type) {
  var objs = acadObjs(), n = 0, i;
  for (i = 0; i < objs.length; i++) if (objs[i] && (objs[i].type === type || (typeof fxAsList === 'function' && fxAsList(objs[i].type).indexOf(type) >= 0))) n++;   // 魔幻件視同漢式學舍 / 書院 / 學宮
  return n;
}
function acadHas(id) { return (typeof techDone === 'function') ? !!techDone(id) : false; }
function acadRes() { return (typeof world !== 'undefined' && world && world.res) ? world.res : null; }

// 院級 0~5:逐級檢查科技與建築數,取連續達成的最高級。env {has(techId), count(type)} 供測試注入
function academyLevel(env) {
  var A = CARD_ACADEMY, has = (env && env.has) || acadHas, cnt = (env && env.count) || acadCount, lv = 0, i, L, school, jing, gong;
  school = cnt('xue_she') + cnt('xue_gong'); jing = cnt('jingshe'); gong = cnt('xue_gong');
  for (i = 1; i < A.levels.length; i++) {
    L = A.levels[i];
    if (L.tech && !has(L.tech)) break;
    if (school < L.school || jing < (L.jing || 0) || gong < (L.gong || 0)) break;
    lv = i;
  }
  return lv;
}
function academySeats(lv) { return CARD_ACADEMY.seats[Math.max(0, Math.min(CARD_ACADEMY.seats.length - 1, lv | 0))] | 0; }
function academyUsed(cs) {
  var n = 0;
  (cs.roster || []).forEach(function (e) { if (e.study) n++; });
  return n;
}
function academyInfo(cs) {
  var lv = academyLevel();
  return { lv: lv, name: lv ? CARD_ACADEMY.levels[lv].name : '', seats: academySeats(lv), used: academyUsed(cs) };
}
// cardsUpgradeCheck 用的 ctx:院級取實際值;人物等級 / 城級 / 學識 / 金幣 / 課數在學院流程中不使用(資源改由 academyCheck 以碎片與金幣判定),故放行
function academyCtx() {
  var res = acadRes() || {};
  return { academy: academyLevel(), lv: 99, cityLv: 99, xue: 1e9, coin: 1e9, lessons: 99 };
}
// 碎片總額(碎)= cs.shards(碎片是核心貨幣,不再與酒令互換;酒令只用於任用)。付費直接扣 cs.shards
function academyShardTotal(cs) { return cs.shards | 0; }
function acadPayShards(cs, n) {
  if (n <= 0) return true;
  if (academyShardTotal(cs) < n) return false;
  cs.shards -= n;
  return true;
}
function acadRefundShards(cs, n) {
  if (n > 0) cardsShardGain(cs, n);
}
function acadJobName(id) { var j = CARD_JOB_BY_ID[id]; return j ? j.name : id; }
function acadTierName(id, t) { var j = CARD_JOB_BY_ID[id]; return j ? j.t[Math.max(0, Math.min(3, t - 1))] : ''; }
function acadAddWhy(why, s) { if (why.indexOf(s) < 0) why.push(s); }

// 課程檢查。kind 'up' | 'adv'(arg = 職業 id) | 'learn'(arg = 職業 id);now 毫秒(派駐年資用)
// 回 {ok, reasons[], cost:{shards,coin,lessons}|null, label, kind, arg}
function academyCheck(cs, e, kind, arg, now) {
  var A = CARD_ACADEMY, why = [], lv = academyLevel(), cost = null, label = '', chk, rule, t, sl, ten, res = acadRes(), C;
  if (!cs || !e) return { ok: false, reasons: ['查無此人'], cost: null, label: '', kind: kind, arg: arg };
  if (e.fig) acadAddWhy(why, '名人不進修');
  if (e.study) acadAddWhy(why, '已在進修中');
  if (lv < 1) acadAddWhy(why, '學院尚未開放(研〈郡國學校〉並建學舍)');
  else if (academyUsed(cs) >= academySeats(lv)) acadAddWhy(why, '進修席已滿(' + academyUsed(cs) + '/' + academySeats(lv) + ')');
  if (kind === 'up') {
    chk = cardsUpgradeCheck(e, academyCtx());
    rule = chk.rule;
    C = A.up[e.gr];
    label = '升階 ' + CARD_GRADE[e.gr].name + (rule ? '→' + CARD_GRADE[rule.to].name : '');
    if (!rule) acadAddWhy(why, '已是最高品階');
    else if (rule.route !== '學院進修' || !C) acadAddWhy(why, '此階須經「' + rule.route + '」(尚未開放)');
    else cost = { shards: C.shards, coin: C.coin, lessons: C.lessons };
    chk.reasons.forEach(function (s) { if (!/^學識需|^金幣需|^需完成|^人物等級需|^城級需/.test(s)) acadAddWhy(why, s); });
  } else if (kind === 'adv') {
    t = e.ja ? (e.ja[arg] | 0) : 0;
    rule = A.adv[t];
    label = '精進 ' + acadJobName(arg) + (t ? ' ' + acadTierName(arg, t) + '→' + acadTierName(arg, t + 1) : '');
    if (!t) acadAddWhy(why, '尚未習得此職業');
    else if (!rule) acadAddWhy(why, '此職業已達最高階');
    else {
      cost = { shards: rule.shards, coin: rule.coin, lessons: rule.lessons };
      if (lv < rule.academy) acadAddWhy(why, '院級需 ' + rule.academy);
      if (e.gr < rule.gr) acadAddWhy(why, '品階需 ' + CARD_GRADE[rule.gr].name + ' 以上');
      if (t + 1 > CARD_GRADE[e.gr].jobMax) acadAddWhy(why, '品階 ' + CARD_GRADE[e.gr].name + ' 職業最高 ' + ['', 'I', 'II', 'III', 'IV'][CARD_GRADE[e.gr].jobMax] + ' 階');
      sl = cardsJobSlots(e);
      if (sl.used + 1 > sl.cap) acadAddWhy(why, '職業槽已滿');
      if (rule.tenure) {
        ten = (typeof npcTenureDays === 'function') ? npcTenureDays(e, now || Date.now()) : 0;
        if (ten < rule.tenure) acadAddWhy(why, '派駐年資需 ' + rule.tenure + ' 天(現 ' + ten + ')');
      }
    }
  } else if (kind === 'learn') {
    label = '習藝 ' + acadJobName(arg);
    C = A.learn;
    cost = { shards: C.shards, coin: C.coin, lessons: C.lessons };
    if (!CARD_JOB_BY_ID[arg]) acadAddWhy(why, '無此職業');
    else if (e.ja && e.ja[arg]) acadAddWhy(why, '已習得此職業');
    if (lv < C.academy) acadAddWhy(why, '院級需 ' + C.academy);
    sl = cardsJobSlots(e);
    if (sl.used + 1 > sl.cap) acadAddWhy(why, '職業槽已滿');
  } else acadAddWhy(why, '未知課程');
  if (cost) {
    if (academyShardTotal(cs) < cost.shards) acadAddWhy(why, '碎片需 ' + cost.shards + '(現有 ' + academyShardTotal(cs) + ';到卡包熔爐熔卡可得)');
    if (!res || (res.coin || 0) < cost.coin) acadAddWhy(why, '金幣需 ' + cost.coin);
  }
  return { ok: why.length === 0, reasons: why, cost: cost, label: label, kind: kind, arg: arg };
}

// 開始進修:扣費、佔席、卸除派駐。回 {ok, reasons?, entry?}
function academyStart(cs, e, kind, arg, now) {
  var chk = academyCheck(cs, e, kind, arg, now), res = acadRes();
  if (!chk.ok) return { ok: false, reasons: chk.reasons };
  if (!acadPayShards(cs, chk.cost.shards)) return { ok: false, reasons: ['碎片不足'] };
  res.coin -= chk.cost.coin;
  e.study = { k: kind, n: chk.cost.lessons, l: 0, p: 0, cs: chk.cost.shards, cc: chk.cost.coin };
  if (kind !== 'up') e.study.j = arg;
  e.sn = (e.sn | 0) + 1;
  if (e.at) { e.at = null; delete e.since; }
  if (typeof npcStaffDirty === 'function') npcStaffDirty();
  return { ok: true, entry: e, label: chk.label };
}
// 速成:剩餘課數立即結業,額外花 已付碎片 × rushRate
function academyRush(cs, e) {
  var s = e && e.study, extra;
  if (!s) return { ok: false, reason: 'none' };
  extra = Math.ceil(s.cs * CARD_ACADEMY.rushRate);
  if (!acadPayShards(cs, extra)) return { ok: false, reason: 'shards', need: extra };
  s.l = s.n; s.p = 0;
  return { ok: true, extra: extra, fin: academyFinish(cs, e) };
}
// 退學:退還已付碎片 / 金幣的 quitRefund,進度作廢
function academyQuit(cs, e) {
  var s = e && e.study, rs, rc, res = acadRes();
  if (!s) return { ok: false, reason: 'none' };
  rs = Math.floor(s.cs * CARD_ACADEMY.quitRefund); rc = Math.floor(s.cc * CARD_ACADEMY.quitRefund);
  acadRefundShards(cs, rs);
  if (res) res.coin = (res.coin || 0) + rc;
  delete e.study;
  return { ok: true, shards: rs, coin: rc };
}
// 結業:套用效果。條件已變(例如職業槽被占)→ 全額退費。回 {ok, text}
function academyFinish(cs, e) {
  var s = e.study, res = acadRes(), t, ok = false, text = '', sl, pass = { academy: 99, lv: 99, cityLv: 99, xue: 1e9, coin: 1e9, lessons: 99 };
  if (!s) return { ok: false, text: '' };
  if (s.k === 'up') {
    if (cardsUpgradeCheck(e, pass).ok) { cardsUpgrade(e, pass); ok = true; text = e.name + ' 進修結業,升為「' + CARD_GRADE[e.gr].name + '」階'; }
  } else if (s.k === 'adv') {
    t = e.ja[s.j] | 0; sl = cardsJobSlots(e);
    if (t >= 1 && t < 4 && t + 1 <= CARD_GRADE[e.gr].jobMax && sl.used + 1 <= sl.cap) { e.ja[s.j] = t + 1; ok = true; text = e.name + ' 進修結業,' + acadJobName(s.j) + '精進為「' + acadTierName(s.j, t + 1) + '」'; }
  } else if (s.k === 'learn') {
    sl = cardsJobSlots(e);
    if (!e.ja[s.j] && sl.used + 1 <= sl.cap) { e.ja[s.j] = 1; if (!e.main) e.main = s.j; ok = true; text = e.name + ' 進修結業,習得「' + acadJobName(s.j) + '」'; }
  }
  if (ok) { cardsRefreshEntry(e); }
  else {
    acadRefundShards(cs, s.cs);
    if (res) res.coin = (res.coin || 0) + s.cc;
    text = e.name + ' 的進修因條件改變無法結業,已全額退費';
  }
  delete e.study;
  if (typeof npcStaffDirty === 'function') npcStaffDirty();
  return { ok: ok, text: text };
}
// 主迴圈掛點(cards.js cardsNamedTick 每 5 秒呼叫):在學者累積遊玩秒數,每滿 lessonSec 秒 1 課。回結業人數
function academyTick(dt) {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, done = 0, A = CARD_ACADEMY;
  if (!cs || !cs.roster) return 0;
  cs.roster.slice().forEach(function (e) {
    var s = e.study, r;
    if (!s) return;
    s.p += dt || 0;
    while (s.p >= A.lessonSec && s.l < s.n) { s.p -= A.lessonSec; s.l++; }
    if (s.l >= s.n) {
      r = academyFinish(cs, e); done++;
      if (r.text && typeof showToast === 'function') { try { showToast(r.text); } catch (er) { /* 略過 */ } }
    }
  });
  if (done && typeof saveWorld === 'function') { try { saveWorld(); } catch (er) { /* 略過 */ } }
  return done;
}
// 請託用:學院已開、此人可進修且尚有席位
function academyErrandOk(cs, e) {
  var lv = academyLevel();
  return lv >= 1 && !!e && !e.fig && !e.study && academyUsed(cs) < academySeats(lv);
}
