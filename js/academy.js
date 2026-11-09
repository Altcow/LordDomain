// js/academy.js — 學院系統引擎(PLAN_CARDS §7B、第四批決議 P4/P8;PLAN_INTERIORS §4 P6 請託『送學院進修』、P7 成長訓練)。
// 院級 1~5 依學舍 / 學宮 / 精舍建築數與科技決定(不另蓋『學院』建築,無升級按鈕);課程:升階(白→青、青→藍)、精進(職業 +1 階)、習藝(新增職業 I 階)。
// 花費以『碎片』(卡片熔爐所得,同一碎片池 cs.shards;碎片不再自動轉酒令,付費只扣 cs.shards)與金幣為主;數值全在 carddata.js 的 CARD_ACADEMY(PLACEHOLDER)。
// 進修狀態寫在名冊 entry.study(只有進修中才有欄位)、entry.sn(累計送去進修次數,>0 才寫);在學者不能派駐 / 遣散。1 課 = 1 次旬報(CARD_ACADEMY.xun;離線回來最多補 1 次)。
// 第三階段:轉職(kind 'swap')、名師講學(academyLecture)、生徒(academyPupilBatch,cards.js cardsGenBatch 呼叫)、旬報計課(academyXun;狀態 cs.acad,有值才寫)。
// 名人不進修;升星(cards.js cardsStarUp)與信物功能不在此實作。全部以 typeof 守衛外部模組。ES2017(不使用可選串接與空值合併運算子)。
// 全域名稱:academyLevel academySeats academyUsed academyCtx academyCheck academyStart academyRush academyQuit academyTick academyFinish academyErrandOk academyShardTotal academyInfo
//          academyXun academyXunEnd academyXunInfo academyAct academyNormSave academyLecture academyLectureCheck academyMasterJob academyPupilBatch

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
// 教習(第二階段,PLAN §7B.3):名冊人物可設為教習(entry.tch,有值才寫),占教習席(院級 2 起,CARD_ACADEMY.teachers)。在學者不當教習;開始進修時教習席空出(tch 清除)。
// 效果(自動選最有利的一位,教習不替自己上課):教習教化階 × teachPerTier = 花費 −%;教習與學生同職業且 ≥ teachLessonTier → 課數 −teachLessonCut(最少 1)。
function academyTeachFlagged(cs) { return (cs.roster || []).filter(function (e) { return e.tch && !e.study; }); }
function academyTeachSeats(lv) { return CARD_ACADEMY.teachers[Math.max(0, Math.min(CARD_ACADEMY.teachers.length - 1, lv | 0))] | 0; }
function academyTeachEffect(cs, e, kind, arg) {
  var A = CARD_ACADEMY, job = (kind === 'up') ? e.main : arg, lst, best = { t: null, pct: 0, cut: 0 }, i, t, cut, pct;
  lst = academyTeachFlagged(cs).slice(0, academyTeachSeats(academyLevel()));
  for (i = 0; i < lst.length; i++) {
    t = lst[i];
    if (t === e) continue;
    cut = (job && t.ja && (t.ja[job] | 0) >= A.teachLessonTier) ? A.teachLessonCut : 0;
    pct = ((t.ja && t.ja.jiaohua) | 0) * A.teachPerTier;
    if (cut > best.cut || (cut === best.cut && pct > best.pct)) best = { t: t, pct: pct, cut: cut };
  }
  return best;
}
// 設為教習的擋因:'' = 可設;none 查無此人 / study 在學中 / lv 院級未達 2 / seats 教習席已滿
function academyTeachBlock(cs, e) {
  var lv = academyLevel();
  if (!cs || !e) return 'none';
  if (e.study) return 'study';
  if (!academyTeachSeats(lv)) return 'lv';
  if (academyTeachFlagged(cs).length >= academyTeachSeats(lv)) return 'seats';
  return '';
}
// 設定 / 撤下教習。回 {ok, reason?}
function academyTeachSet(cs, e, on) {
  var why;
  if (!cs || !e) return { ok: false, reason: 'none' };
  if (!on) { delete e.tch; return { ok: true }; }
  if (e.tch) return { ok: true };
  why = academyTeachBlock(cs, e);
  if (why) return { ok: false, reason: why };
  e.tch = 1;
  return { ok: true };
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
// 碎片總額(碎)= cs.shards(碎片是核心貨幣;酒令已移除,舊存檔酒令已換成碎片)。付費直接扣 cs.shards
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
// kind 'swap':arg = 要換掉的 I 階職業,to = 新職業(to 省略 = 只看共同條件,給介面預覽用;academyStart 一定要給)
function academyCheck(cs, e, kind, arg, now, to) {
  var A = CARD_ACADEMY, why = [], lv = academyLevel(), cost = null, label = '', chk, rule, t, sl, ten, res = acadRes(), C, teach = null;
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
    if (sl.used + 1 > sl.cap) acadAddWhy(why, '職業槽已滿(可先轉職)');
  } else if (kind === 'swap') {
    C = A.swap;
    label = '轉職 ' + (arg ? acadJobName(arg) : '') + (to ? '→' + acadJobName(to) : '');
    cost = { shards: C.shards, coin: C.coin, lessons: C.lessons };
    if (lv < C.academy) acadAddWhy(why, '院級需 ' + C.academy);
    if (arg) {
      if (!e.ja || !e.ja[arg]) acadAddWhy(why, '尚未習得此職業');
      else if (e.ja[arg] !== 1) acadAddWhy(why, '只能轉 I 階的職業');
    }
    if (to) {
      if (!CARD_JOB_BY_ID[to]) acadAddWhy(why, '無此職業');
      else if (e.ja && e.ja[to]) acadAddWhy(why, '已習得此職業');
    }
  } else acadAddWhy(why, '未知課程');
  if (cost) {
    teach = academyTeachEffect(cs, e, kind === 'swap' ? 'learn' : kind, kind === 'swap' ? to : arg);   // 轉職:課數折扣看新職業(預覽未選新職業時只算花費折扣)
    if (teach.pct || teach.cut) cost = { shards: Math.floor(cost.shards * (1 - teach.pct) + 1e-9), coin: Math.floor(cost.coin * (1 - teach.pct) + 1e-9), lessons: Math.max(1, cost.lessons - teach.cut) };
    if (academyShardTotal(cs) < cost.shards) acadAddWhy(why, '碎片需 ' + cost.shards + '(現有 ' + academyShardTotal(cs) + ';到卡包熔爐熔卡可得)');
    if (!res || (res.coin || 0) < cost.coin) acadAddWhy(why, '金幣需 ' + cost.coin);
  }
  return { ok: why.length === 0, reasons: why, cost: cost, label: label, kind: kind, arg: arg, teach: teach };
}

// 開始進修:扣費、佔席、卸除派駐。回 {ok, reasons?, entry?}
function academyStart(cs, e, kind, arg, now, to) {
  var chk = academyCheck(cs, e, kind, arg, now, to), res = acadRes();
  if (kind === 'swap' && (!arg || !to) && chk.ok) return { ok: false, reasons: ['請選擇要換掉的職業與新職業'] };
  if (!chk.ok) return { ok: false, reasons: chk.reasons };
  if (!acadPayShards(cs, chk.cost.shards)) return { ok: false, reasons: ['碎片不足'] };
  res.coin -= chk.cost.coin;
  e.study = { k: kind, n: chk.cost.lessons, l: 0, p: 0, cs: chk.cost.shards, cc: chk.cost.coin };
  if (kind === 'swap') { e.study.j = to; e.study.f = arg; }
  else if (kind !== 'up') e.study.j = arg;
  if (chk.teach && chk.teach.t) e.study.t = chk.teach.t.id;   // 教習 id(只用於顯示)
  delete e.tch;   // 在學者不當教習,教習席空出
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
  } else if (s.k === 'swap') {
    if (e.ja[s.f] === 1 && !e.ja[s.j]) {
      delete e.ja[s.f]; e.ja[s.j] = 1;
      if (e.main === s.f || !e.ja[e.main]) e.main = s.j;
      ok = true; text = e.name + ' 轉職結業,「' + acadJobName(s.f) + '」改為「' + acadJobName(s.j) + '」';
    }
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
// ───────── 旬報計課(PLAN_CITY §16.2 的學院子集;城市的旬報狀態機尚未實作,這裡只推進課數)─────────
// 狀態 cs.acad(有值才寫):d 本機日號(只增不減:時鐘回撥時沿用舊日、不重置次數)、n 該日已結算旬報數、a 施政動作累計、x 旬報總序號、ld / ln 名師講學的日號 / 當日次數。
// 離線:回來時不論離開幾天,換日只補 1 次旬報(離線上限);施政動作只在遊玩中累計。
function acadDay(now) { var t = (typeof now === 'number' && isFinite(now)) ? now : Date.now(); return Math.floor((t - cardsTz(t)) / 86400000); }
function acadSt(cs) { return cs.acad || (cs.acad = {}); }
// 依本機日更新;回 {day, fresh 剛換日}。第一次(舊存檔無 d)只記日,不送課
function acadRoll(cs, now) {
  var S = acadSt(cs), day = acadDay(now);
  if (typeof S.d !== 'number') { S.d = day; S.n = 0; return { day: day, fresh: false }; }
  if (day > S.d) { S.d = day; S.n = 0; return { day: day, fresh: true }; }
  return { day: S.d, fresh: false };
}
// 結算一次旬報:每位在學者 +1 課,滿課結業。why 'day' | 'act' | 'manual'。回 {ok, reason?, lessons, done:[academyFinish 結果]}
function academyXun(cs, why, now) {
  var X = CARD_ACADEMY.xun, S, res = { ok: false, reason: '', why: why, lessons: 0, done: [] };
  if (!cs || !cs.roster) { res.reason = 'none'; return res; }
  acadRoll(cs, now); S = cs.acad;
  if ((S.n | 0) >= X.dayMax) { res.reason = 'cap'; return res; }
  S.n = (S.n | 0) + 1; S.x = (S.x | 0) + 1;
  cs.roster.slice().forEach(function (e) {
    var s = e.study;
    if (!s) return;
    s.l = Math.min(s.n, (s.l | 0) + 1); s.p = 0; res.lessons++;
    if (s.l >= s.n) res.done.push(academyFinish(cs, e));
  });
  res.ok = true;
  return res;
}
// 名冊「結束本旬」鈕:沒有在學者時不結算(不浪費當日次數)
function academyXunEnd(cs, now) {
  if (!cs || !academyUsed(cs)) return { ok: false, reason: 'idle', lessons: 0, done: [] };
  return academyXun(cs, 'manual', now);
}
// 施政動作 +n;累計滿 acts 次結算一次旬報(當日已達上限 → 動作數停在 acts,換日後的第一個動作再結算)。回旬報結果陣列
// report = true:直接提示與存檔(研發完成時呼叫)
function academyAct(cs, n, now, report) {
  var X = CARD_ACADEMY.xun, S, out = [], r;
  if (!cs) return out;
  S = acadSt(cs);
  S.a = Math.min(X.acts, (S.a | 0) + Math.max(0, n | 0));
  while (S.a >= X.acts) {
    r = academyXun(cs, 'act', now);
    if (!r.ok) break;
    S.a -= X.acts; out.push(r);
  }
  if (report) acadReport(out);
  return out;
}
// 介面用(不改狀態):{n 今日已結算, max, a 施政動作, acts, students}
function academyXunInfo(cs, now) {
  var X = CARD_ACADEMY.xun, S = (cs && cs.acad) || {}, day = acadDay(now), n = (typeof S.d === 'number' && S.d >= day) ? (S.n | 0) : 0;
  return { n: n, max: X.dayMax, a: S.a | 0, acts: X.acts, students: cs ? academyUsed(cs) : 0 };
}
// 旬報結果 → 提示與存檔;回結業人數
function acadReport(list) {
  var done = 0, lessons = 0, shown = 0;
  list.forEach(function (r) {
    if (!r || !r.ok) return;
    lessons += r.lessons;
    r.done.forEach(function (f) { done++; if (f.text && typeof showToast === 'function') { try { showToast(f.text); shown++; } catch (er) { /* 略過 */ } } });
  });
  if (lessons > done && typeof showToast === 'function') { try { showToast('旬報:在學的人各上完一課'); } catch (er) { /* 略過 */ } }
  if (lessons && typeof saveWorld === 'function') { try { saveWorld(); } catch (er) { /* 略過 */ } }
  return done;
}
// 施政動作的偵測:主迴圈每 5 秒比對建築數,有變化算 1 次(一次拖曳刷整片也只算 1);研發完成由 cards.js cardsOnTechDone 呼叫 academyAct。換世界(cs 換物件)時只重設基準
var acadSeen = { cs: null, n: -1 };
// 主迴圈掛點(cards.js cardsNamedTick 每 5 秒呼叫):換日旬報 + 施政動作。回結業人數
function academyTick(dt, now) {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, t = (typeof now === 'number') ? now : Date.now(), out = [], n;
  if (!cs || !cs.roster) return 0;
  if (acadRoll(cs, t).fresh) out.push(academyXun(cs, 'day', t));
  n = acadObjs().length;
  if (acadSeen.cs === cs && acadSeen.n >= 0 && n !== acadSeen.n) out = out.concat(academyAct(cs, 1, t));
  acadSeen.cs = cs; acadSeen.n = n;
  return acadReport(out);
}
// 存讀檔(cards.js cardsNormSave 呼叫):正規化 cs.acad,預設值不寫
function academyNormSave(n, v) {
  var a = v && v.acad, o = {}, X = CARD_ACADEMY.xun, k = 0;
  if (!a || typeof a !== 'object') return;
  if (typeof a.d === 'number' && isFinite(a.d) && a.d >= 0) { o.d = Math.min(1e7, a.d | 0); k++; if (cardNum(a.n, 0, X.dayMax, 0) | 0) o.n = cardNum(a.n, 0, X.dayMax, 0) | 0; }
  if (cardNum(a.a, 0, X.acts, 0) | 0) { o.a = cardNum(a.a, 0, X.acts, 0) | 0; k++; }
  if (cardNum(a.x, 0, 1e9, 0) | 0) { o.x = cardNum(a.x, 0, 1e9, 0) | 0; k++; }
  if (typeof a.ld === 'number' && isFinite(a.ld) && a.ld >= 0 && (cardNum(a.ln, 0, 99, 0) | 0)) { o.ld = Math.min(1e7, a.ld | 0); o.ln = cardNum(a.ln, 0, 99, 0) | 0; k++; }
  if (k) n.acad = o;
}

// ───────── 名師講學(院 5;PLAN §7B.3)─────────
// 宗師職業:教習身上 IV 階的職業(主職業優先);無 → null
function academyMasterJob(t) {
  var T = CARD_ACADEMY.lecture.tier, k;
  if (!t || !t.ja) return null;
  if (t.main && (t.ja[t.main] | 0) >= T) return t.main;
  for (k in t.ja) if ((t.ja[k] | 0) >= T) return k;
  return null;
}
function acadSeated(cs) { return academyTeachFlagged(cs).slice(0, academyTeachSeats(academyLevel())); }
function acadStudyJob(e) { var s = e.study; return s ? (s.k === 'up' ? e.main : s.j) : null; }
// 回 {ok, reasons[], job, targets[], cost, left 今日剩餘次數}
function academyLectureCheck(cs, t, now) {
  var L = CARD_ACADEMY.lecture, why = [], lv = academyLevel(), job, S, day = acadDay(now), used, res = acadRes(), tg = [];
  if (!cs || !t) return { ok: false, reasons: ['查無此人'], job: null, targets: [], cost: null, left: 0 };
  job = academyMasterJob(t); S = cs.acad || {};
  if (lv < L.academy) acadAddWhy(why, '院級需 ' + L.academy + '(太學)');
  if (!t.tch || acadSeated(cs).indexOf(t) < 0) acadAddWhy(why, '需先設為教習');
  if (!job) acadAddWhy(why, '教習要有一個宗師(IV 階)職業');
  used = (typeof S.ld === 'number' && S.ld >= day) ? (S.ln | 0) : 0;
  if (used >= L.daily) acadAddWhy(why, '今日已講學(每日 ' + L.daily + ' 次)');
  if (job) (cs.roster || []).forEach(function (e) { if (e !== t && e.study && acadStudyJob(e) === job && e.study.l < e.study.n) tg.push(e); });
  if (job && !tg.length) acadAddWhy(why, '沒有學「' + acadJobName(job) + '」的在學者');
  if (academyShardTotal(cs) < L.shards) acadAddWhy(why, '碎片需 ' + L.shards);
  if (!res || (res.coin || 0) < L.coin) acadAddWhy(why, '金幣需 ' + L.coin);
  return { ok: why.length === 0, reasons: why, job: job, targets: tg, cost: { shards: L.shards, coin: L.coin }, left: Math.max(0, L.daily - used) };
}
// 講學一次:扣費、記當日次數,同職業在學者各少 cut 課(滿課即結業)。回 {ok, reasons?, n, job, done[]}
function academyLecture(cs, t, now) {
  var c = academyLectureCheck(cs, t, now), L = CARD_ACADEMY.lecture, S, day = acadDay(now), done = [];
  if (!c.ok) return { ok: false, reasons: c.reasons };
  if (!acadPayShards(cs, L.shards)) return { ok: false, reasons: ['碎片不足'] };
  acadRes().coin -= L.coin;
  S = acadSt(cs);
  if (!(typeof S.ld === 'number' && S.ld >= day)) { S.ld = day; S.ln = 0; }
  S.ln = (S.ln | 0) + 1;
  c.targets.forEach(function (e) {
    e.study.l = Math.min(e.study.n, e.study.l + L.cut);
    if (e.study.l >= e.study.n) done.push(academyFinish(cs, e));
  });
  return { ok: true, n: c.targets.length, job: c.job, done: done };
}

// ───────── 生徒(院 2 起;PLAN §7B.3)─────────
// 教習的職業:tj = 第一位在席教習的主職業;mj = 在席教習中的宗師職業
function acadPupilJobs(cs) {
  var seat = acadSeated(cs), tj = null, mj = null, i;
  for (i = 0; i < seat.length; i++) { if (!mj) mj = academyMasterJob(seat[i]); if (!tj && seat[i].main) tj = seat[i].main; }
  return { tj: tj, mj: mj };
}
// 讓卡片帶上職業 job(t 階,受品階上限);槽不夠時先拿掉非主職業,仍不夠就降成 I 階,再不夠就放棄
function acadForceJob(c, job, t) {
  var G = CARD_GRADE[c.gr], cap = G.jobSlots[1], ks;
  function used() { var s = 0, k; for (k in c.ja) s += c.ja[k]; return s; }
  if (!CARD_JOB_BY_ID[job] || c.ja[job]) return;
  t = Math.max(1, Math.min(t, G.jobMax));
  while (used() + t > cap) {
    ks = Object.keys(c.ja).filter(function (k) { return k !== c.main; });
    if (ks.length) delete c.ja[ks[ks.length - 1]];
    else if (t > 1) t = 1;
    else return;
  }
  c.ja[job] = t;
  if (!c.main) c.main = job;
}
// cards.js cardsGenBatch 呼叫(只限縣試):把最後一位(跳過名人與 avoid 內的保底位)換成本院生徒。確定性:hash(seed, 'E', key, slot, 'pupil')。回換掉的位置,-1 = 沒有生徒
function academyPupilBatch(cs, key, cands, avoid) {
  var P = CARD_ACADEMY.pupil, lv = academyLevel(), i, r, gr, c, J;
  if (!cs || !cands || !cands.length || lv < P.academy) return -1;
  avoid = avoid || [];
  for (i = cands.length - 1; i >= 0; i--) if (avoid.indexOf(i) < 0 && !cands[i].fig) break;
  if (i < 0) return -1;
  r = cardRng(cardHash(cs.seed, 'E', key, i, 'pupil'));
  gr = Math.max(P.minGr, cands[i].gr | 0);
  if (lv >= P.blueLv && r() < P.blueP) gr = Math.max(gr, 2);
  c = cardGen(cs, 'E', key, i, Math.min(3, gr), 'pupil', { noFig: true });
  J = acadPupilJobs(cs);
  if (J.mj) acadForceJob(c, J.mj, r() < 0.5 ? 1 : 2);
  else if (J.tj && r() < P.biasP) acadForceJob(c, J.tj, 1);
  c.pu = lv;
  cands[i] = c;
  return i;
}
function academyPupilName(pu) { var L = CARD_ACADEMY.levels[Math.max(1, Math.min(5, pu | 0))]; return (L ? L.name : '學院') + '生徒'; }
// 請託用:學院已開、此人可進修且尚有席位
function academyErrandOk(cs, e) {
  var lv = academyLevel();
  return lv >= 1 && !!e && !e.fig && !e.study && academyUsed(cs) < academySeats(lv);
}
