// js/tutorial.js — 新手教學引擎(T0~T11):狀態、步驟推進、獎勵、修復提示、md_cesuo 免費覆寫、卡片「把茅廁排到最前」、「前往」自動找位置。文案在 tutorial_data.js,卡片在 nextstepui.js。
// 狀態存 world.city.tut = { v:1, step:'T0'..'T11'|'END', skipped, grants:{…}, at:{步驟:時間}, hold?, gs?, gsn? },跟著存檔走(goods.js goodsNormCity → tutNormSave)。
// 只有全新世界(main.js boot 的 freshWorld)才會建立 tut;舊存檔沒有 tut = 已畢業,不開教學。END 之後 tut 仍保留(給學識獎勵與免費研茅廁是否已用掉的記錄)。
// 教學期間 nsCompute 只回傳教學卡(nextstep.js 短路)。顧問照常計算、只更新角標。
// 時鐘回撥:at / hold 若晚於現在時間,一律拉回現在,不讓閒置計時或保底計時停住。
// 全域名稱:tutActive tutHas tutGraduated tutStartNew tutNormSave tutCompute tutAct tutStart tutGrad tutSkip tutExpedite tutGoBuild tutSpotNear tutFreeTech tutUseFree tutProgress tutStarted
// ES2017;不用 ?. ??。

var TUT_GRANT_KEYS = ['xue1', 'md', 'skip', 'grad', 't9'];
var TUT_SEEN_KEYS = ['cards', 'detail', 'team'];   // 卡包教學步驟的『看過』旗標:C1 打開過卡片面板、C3 看過卡詳情、C4 先記著(戰鬥未開放時)
var TUT_HOLD_MS = 5000;         // T8 三根長條綠色需維持的時間
var TUT_IDLE_MS = 90000;        // 同一步閒置超過此時間,卡片加註「幫你選好位置」
var TUT_T9_GUARANTEE_MS = 900000; // T9 起算 15 分鐘仍未排入,補到學識 10(保底)
var TUT_MD_SECONDS = 30;        // md_cesuo 教學免費覆寫的研發秒數
var TUT_SPOT_R = { privy: 5, well: 6, field_sprout: 3, house: 6, market: 6, notice_board: 6 };   // 自動找位置的半徑:茅廁 / 水井 / 田 對民房;民房 對水井(與 cityfx_data CITY_FX.r 一致)
var TUT_SHOP_TRY_MAX = 60;      // 商店聚光孔教學:連續 60 次(約 1.5 分鐘)叫不出來就放棄並記為看過

function tutCity() { if (typeof goodsCity === 'function' && typeof world !== 'undefined' && world) goodsCity(); return (typeof world !== 'undefined' && world && world.city && typeof world.city === 'object') ? world.city : null; }   // 先正規化:goodsCity 可能換掉 world.city 物件(tut 會被複製),之後持有的 t 不能變孤兒
function tutClock() { return (typeof nsRt !== 'undefined' && nsRt && typeof nsRt.clock === 'function') ? nsRt.clock() : Date.now(); }
function tutActive() { if (!featureOn('tutorial')) return false; /* @DORMANT tutorial:舊教學休眠(v60),程式與存檔保留 */ var c = tutCity(); return !!(c && c.tut && c.tut.step !== 'END'); }
function tutHas() { var c = tutCity(); return !!(c && c.tut); }
function tutGraduated() { var c = tutCity(); return !!(c && c.tut && c.tut.step === 'END'); }
function tutProgress(step) { var i = TUT_IDS.indexOf(step); return i < 0 ? '' : i + '/' + TUT_TOTAL; }
// 卡包教學的『看過』旗標(cardsui.js 點開卡詳情時呼叫 tutSeen('detail');C4 的『先記著』鈕 tutAct('teamok'))
function tutSeen(k) { var c = tutCity(); if (!c || !c.tut || TUT_SEEN_KEYS.indexOf(k) < 0) return false; if (!c.tut.seen) c.tut.seen = {}; c.tut.seen[k] = 1; return true; }
function tutHasSeen(k) { var c = tutCity(); return !!(c && c.tut && c.tut.seen && c.tut.seen[k]); }
function tutToast(m) { if (typeof showToast === 'function') showToast(m); }

function tutStartNew() {
  if (!featureOn('tutorial')) return false;   // @DORMANT tutorial:舊教學休眠(v60),全新世界不建 tut
  var c = tutCity();
  if (!c || c.tut) return false;
  c.tut = { v: 1, step: 'T0', skipped: false, grants: {}, at: {} };
  return true;
}

// 讀檔正規化:非法值一律丟棄(回 null = 不開教學且視為已畢業;存檔沒有 tut 時也是這樣)
function tutNormSave(v) {
  var o, k;
  if (!v || typeof v !== 'object') return null;
  if (v.step !== 'END' && TUT_IDS.indexOf(v.step) < 0) return null;
  o = { v: 1, step: v.step, skipped: !!v.skipped, grants: {}, at: {} };
  if (v.grants && typeof v.grants === 'object') for (k in v.grants) if (TUT_GRANT_KEYS.indexOf(k) >= 0 && v.grants[k]) o.grants[k] = 1;
  if (v.at && typeof v.at === 'object') for (k in v.at) if (TUT_IDS.indexOf(k) >= 0 && typeof v.at[k] === 'number' && isFinite(v.at[k])) o.at[k] = v.at[k];
  if (typeof v.hold === 'number' && isFinite(v.hold)) o.hold = v.hold;
  if (v.seen && typeof v.seen === 'object') { TUT_SEEN_KEYS.forEach(function (k) { if (v.seen[k]) { if (!o.seen) o.seen = {}; o.seen[k] = 1; } }); }
  if (v.gs) o.gs = 1;
  if (v.gsp) o.gsp = 1;
  if (typeof v.gsn === 'number' && isFinite(v.gsn)) o.gsn = v.gsn;
  return o;
}

function tutSetStep(t, step, now) {
  t.step = step;
  t.at[step] = now;
  delete t.hold;
}

// 簡化城市模式(citysimple.js):教學改成「蓋建築 ↔ 研科技」;教學用科技 / 建築見 TECH_SIMPLE.tut = { t1, b1, t2, b2 }
function tutSimple() { return typeof citySimpleOn === 'function' && citySimpleOn() && typeof csTreeOn === 'function' && csTreeOn(); }
function tutS(k) { return TECH_SIMPLE.tut[k]; }
function tutFreeId() { return tutSimple() ? tutS('t1') : 'md_cesuo'; }
// 教學期間 md_cesuo(簡化模式:第一項教學科技)成本歸零、研發 30 秒,只一次(citytech.js techCostOf / techDurationOf / techPay 掛點)
function tutFreeTech(id) {
  var c = tutCity(), f = tutFreeId();
  return !!(id === f && c && c.tut && !c.tut.grants.md && typeof techDone === 'function' && !techDone(f));
}
function tutUseFree(id) {
  var c = tutCity();
  if (id === tutFreeId() && c && c.tut && !c.tut.grants.md) c.tut.grants.md = 1;
}

function tutCnt(s, id) { return (s && s.cnt && s.cnt[id]) || 0; }
function tutWater() { return (typeof cityFxCity === 'function') ? cityFxCity('water') : 0; }
function tutSani() { return (typeof cityFxCity === 'function') ? cityFxCity('sani') : 0; }
function tutFood() { return (typeof cityFxCity === 'function') ? cityFxCity('food') : 0; }
function tutFields(s) { var n = 0; if (typeof NS_FIELD_TYPES !== 'undefined') NS_FIELD_TYPES.forEach(function (k) { n += tutCnt(s, k); }); return n; }
function tutQueued(id) { var ts = (typeof techState === 'function') ? techState() : null; if (!ts) return false; return (ts.cur || []).some(function (c) { return c.id === id; }) || (ts.queue || []).indexOf(id) >= 0; }
function tutInCur(id) { var ts = (typeof techState === 'function') ? techState() : null; return !!ts && (ts.cur || []).some(function (c) { return c.id === id; }); }
function tutDoneTech(id) { return (typeof techDone === 'function') ? !!techDone(id) : false; }
// 已開始研發或已研成(排在序列裡不算)
function tutStarted(id) { return tutDoneTech(id) || tutInCur(id); }
function tutXue() { var ts = (typeof techState === 'function') ? techState() : null; return ts ? Math.floor(ts.xue || 0) : 0; }
function tutGrantXue(t, key, n) {
  var ts = (typeof techState === 'function') ? techState() : null;
  if (!ts || t.grants[key]) return;
  ts.xue = (ts.xue || 0) + n;
  t.grants[key] = 1;
}

// 簡化模式:教學科技以外,有沒有再排 / 研 / 研成任何一項
function tutOtherTech() {
  var ts = (typeof techState === 'function') ? techState() : null, skip = [tutS('t1'), tutS('t2')], k;
  if (!ts) return false;
  if ((ts.cur || []).some(function (c) { return skip.indexOf(c.id) < 0; }) || (ts.queue || []).some(function (id) { return skip.indexOf(id) < 0; })) return true;
  for (k in ts.done) if (skip.indexOf(k) < 0 && typeof techNode === 'function' && techNode(k) && techNode(k).id === k) return true;
  return false;
}
function tutDoneSimple(step, s) {
  switch (step) {
    case 'T1': return s.houses >= 1;
    case 'T2': return tutCnt(s, 'research') >= 1;
    case 'T3': return tutStarted(tutS('t1'));
    case 'T4': return tutDoneTech(tutS('t1'));
    case 'T5': return tutCnt(s, tutS('b1')) >= 1;
    case 'T6': return tutQueued(tutS('t2')) || tutDoneTech(tutS('t2'));
    case 'T7': return tutDoneTech(tutS('t2'));
    case 'T8': return tutCnt(s, tutS('b2')) >= 1;
    case 'T9': return s.houses >= 4;
    case 'T10': return tutOtherTech();
    default: return false;
  }
}
function tutRepairSimple(step, s) {
  var labs = tutCnt(s, 'research'), t1 = tutS('t1'), t2 = tutS('t2'), have, min, miss, c;
  if (step === 'T3' && !tutStarted(t1) && tutQueued(t1)) return { text: '先研〈' + tutTechName(t1) + '〉,其他之後再研。', why: '它排在序列後面,研完再研別的科技。', go: { kind: 'tech', id: t1 } };
  if ((step === 'T4' && !tutDoneTech(t1)) || (step === 'T7' && !tutDoneTech(t2))) { if (labs < 1) return { text: '研究院不見了,研發停住了,再蓋一座吧。', go: { kind: 'build', type: 'research' } }; }
  if (step === 'T6' && !tutQueued(t2) && !tutDoneTech(t2)) {
    miss = (typeof techNeedMiss === 'function') ? techNeedMiss(t2) : [];
    if (miss.length) return { text: '〈' + tutTechName(t2) + '〉要先蓋' + techNeedName(miss[0]) + ',先去蓋一座。', why: '這就是「前置建築」:蓋好才能研。', go: { kind: 'build', type: miss[0] } };
    c = (typeof techCostOf === 'function') ? techCostOf(t2) : null;
    have = tutXue();
    if (c && have < c.xue) {
      min = Math.ceil((c.xue - have) / Math.max(1, labs));
      return { text: '學識 ' + have + '/' + c.xue + ',約 ' + min + ' 分鐘後夠;先排進研發序列,夠了會自動開始。', why: '排入即算完成,序列會自動開工。', go: { kind: 'tech', id: t2 } };
    }
  }
  return null;
}
function tutTechName(id) { var n = (typeof techNode === 'function') ? techNode(id) : null; return n ? ((typeof techLabelOf === 'function') ? techLabelOf(n) : n.name) : id; }
// 文案代入 {t1}{b1}{t2}{b2}(魔幻世界用本族名)
function tutFill(v) {
  var map;
  if (typeof v !== 'string') return v;
  map = { t1: tutTechName(tutS('t1')), t2: tutTechName(tutS('t2')), b1: techNeedName(tutS('b1')), b2: techNeedName(tutS('b2')) };
  return v.replace(/\{(t1|t2|b1|b2)\}/g, function (m, k) { return map[k]; });
}
function tutFillGo(go) {
  var o = {}, k;
  for (k in go) o[k] = go[k];
  if (o.id && /^\{t[12]\}$/.test(o.id)) o.id = tutS(o.id.slice(1, 3));
  if (o.type && /^\{b[12]\}$/.test(o.type)) o.type = tutS(o.type.slice(1, 3));
  return o;
}

// 卡包開場步驟(C1~C4,兩種模式共用)的完成條件:C1 打開過卡片面板(cardsui.js cardsUiOpen 寫入 tutSeen('cards');補償自動發放不需領取)、C2 抽過卡、C3 看過卡詳情、C4 組了隊(討伐陣容有人)或按了『先記著』
function tutTeamFormed() {
  var d = null, i;
  if (typeof bnUiLoad !== 'function') return false;
  try { d = bnUiLoad(); } catch (e) { return false; }
  if (!d) return false;
  if (d.cur && d.cur.slots && d.cur.slots.length >= 3) return true;
  for (i = 0; i < (d.forms || []).length; i++) if (d.forms[i] && d.forms[i].slots && d.forms[i].slots.length >= 3) return true;
  return false;
}
function tutDoneCards(step) {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null;
  if (!cs) return true;
  switch (step) {
    case 'C1': return tutHasSeen('cards');
    case 'C2': return (cs.pl && ((cs.pl.T && (cs.pl.T.tot | 0) >= 1) || (cs.pl.E && (cs.pl.E.tot | 0) >= 1))) || cs.roster.length > 0;
    case 'C3': return tutHasSeen('detail');
    case 'C4': return tutHasSeen('team') || tutTeamFormed();
    default: return false;
  }
}
// 步驟完成條件(T0 / T11 只由按鈕推進,這裡不判斷)
function tutDone(step, s, mem, t, now) {
  if (step.charAt(0) === 'C') return tutDoneCards(step);
  if (tutSimple()) return tutDoneSimple(step, s);
  switch (step) {
    case 'T1': return s.houses >= 1 && tutWater() >= 80;   // 沒有民房時城市飲水值不具意義
    case 'T2': return s.houses >= 3;
    case 'T3': return tutCnt(s, 'research') >= 1;
    case 'T4': return tutStarted('md_cesuo');              // 排在序列後面不算,要排到最前並開始研
    case 'T5': return tutDoneTech('md_cesuo') && !!(mem && mem.seen && mem.seen.bars);
    case 'T6': return tutCnt(s, 'privy') >= 1 && cityFxHouseCover('privy') >= 1;
    case 'T7': return tutFields(s) >= 3;
    case 'T8':
      if (s.houses >= 4 && tutFood() >= 100 && tutWater() >= 80 && tutSani() >= 60) {
        if (typeof t.hold === 'number' && t.hold > now) t.hold = now;
        if (typeof t.hold !== 'number') t.hold = now;
        return now - t.hold >= TUT_HOLD_MS;
      }
      delete t.hold;
      return false;
    case 'T9': return tutQueued('e_shiling') || tutDoneTech('e_shiling');
    case 'T10': return tutDoneTech('e_shiling');   // 市集 Lv1 名額為 0(progProdCap),教學只到市令研成
    default: return false;
  }
}

// 完成時的獎勵(只給一次)
function tutRewardOn(step, t, s) {
  if (step === (tutSimple() ? 'T2' : 'T3')) tutGrantXue(t, 'xue1', 10);   // 蓋好研究院的那一步
}

// 修復 / 退回提示:回傳 {text, why, go, alt} 覆蓋該步文案;沒有則 null
function tutRepair(step, s, t) {
  var labs = tutCnt(s, 'research'), have, min;
  if (tutSimple()) return tutRepairSimple(step, s);
  if (step === 'T1' && tutCnt(s, 'well') >= 1 && tutWater() < 80) return { text: '這口井離民房還是太遠,在民房旁再鑿一口。', go: { kind: 'build', type: 'well' } };
  if (step === 'T2' && tutWater() < 80) return { text: '新民房也要在井邊,否則會缺水。', go: { kind: 'build', type: 'house' } };
  if (step === 'T4' && !tutStarted('md_cesuo') && tutQueued('md_cesuo')) return { text: '先研茅廁,其他之後再研。', why: '茅廁排在序列前面,研完再研別的科技。', go: { kind: 'tech', id: 'md_cesuo' } };
  if (step === 'T5' && !tutDoneTech('md_cesuo') && labs < 1) return { text: '研究院不見了,研發停住了,再蓋一座吧。', go: { kind: 'build', type: 'research' } };
  if (step === 'T6' && tutCnt(s, 'privy') >= 1 && cityFxHouseCover('privy') < 1) return { text: '這座茅廁離民房太遠,再蓋一座靠近民房的。', go: { kind: 'build', type: 'privy' } };
  if (step === 'T8' && s.houses >= 4) {
    if (tutWater() < 80) return { text: '有新民房喝不到水,在它旁邊再鑿一口井。', go: { kind: 'build', type: 'well' } };
    if (tutSani() < 60) return { text: '有民房離茅廁太遠,在那一坊再蓋一座茅廁。', go: { kind: 'build', type: 'privy' } };
    if (tutFood() < 100) return { text: '糧不夠吃,再開一塊田。', go: { kind: 'build', type: 'field_sprout' } };
  }
  if (step === 'T9' && !tutQueued('e_shiling') && !tutDoneTech('e_shiling')) {
    have = tutXue();
    if (have < 10) {
      min = Math.ceil((10 - have) / Math.max(1, labs));
      return { text: '學識 ' + have + '/10,約 ' + min + ' 分鐘後夠;先排進研發序列,夠了會自動開始。', why: '排入即算完成,序列會自動開工。', go: { kind: 'tech', id: 'e_shiling' } };
    }
  }
  if (step === 'T10' && !tutDoneTech('e_shiling')) return { text: '市令研發中,研成後就能蓋市集。', why: '研發中可以先去做別的事。', go: { kind: 'tech', id: 'e_shiling' } };
  return null;
}

// 商店聚光孔教學(guide.js 主題 shop):畢業卡按「好」之後才叫出(不擋畢業卡),且要商店功能已開放;不走自動播放守衛。叫不出來(有面板開著或目標不在畫面)就稍後重試,多次失敗則記為看過
function tutShopGuide(t) {
  var ok = false, gs;
  if (t.gs) return;
  if (typeof isUnlocked === 'function' && !isUnlocked('feature', 'shop')) return;
  if (typeof guidePlay !== 'function' || typeof gdLoad !== 'function' || typeof gdSave !== 'function') { t.gs = 1; return; }
  gs = gdLoad();
  if (!(typeof gdBusy === 'function' && gdBusy())) ok = guidePlay('shop');
  if (ok) { t.gs = 1; gs.seen.shop = 1; gdSave(); return; }
  t.gsn = (t.gsn || 0) + 1;
  if (t.gsn >= TUT_SHOP_TRY_MAX) { t.gs = 1; gs.seen.shop = 1; gdSave(); }
}

// 推進:每次呼叫最多前進一步(讓玩家看得到每一步);回傳目前應顯示的教學卡,教學已結束回 null
function tutCompute(s, mem) {
  var c = tutCity(), t, now, step, d, why, go, text, idle, rp, alt = null;
  if (!c || !c.tut) return null;
  if (c.tut.step === 'END') { if (c.tut.gsp && !c.tut.gs) tutShopGuide(c.tut); return null; }
  t = c.tut;
  now = tutClock();
  if (typeof t.at[t.step] !== 'number' || t.at[t.step] > now) t.at[t.step] = now;
  step = t.step;
  if (step !== 'T0' && step !== 'T11' && tutDone(step, s, mem, t, now)) {
    tutRewardOn(step, t, s);
    step = TUT_IDS[TUT_IDS.indexOf(step) + 1];
    tutSetStep(t, step, now);
  }
  var sim = tutSimple(), gStep = sim ? 'T6' : 'T9', gId = sim ? tutS('t2') : 'e_shiling', gNeed = 10;
  if (sim && typeof techCostOf === 'function' && techCostOf(gId)) gNeed = techCostOf(gId).xue;
  if (t.step === gStep && !t.grants.t9 && now - (t.at[gStep] || now) >= TUT_T9_GUARANTEE_MS && !tutQueued(gId) && !tutDoneTech(gId)) {   // 保底:等太久補學識
    tutGrantXue(t, 't9', Math.max(0, gNeed - tutXue()));
  }
  d = sim ? (TUT_TEXT_SIMPLE[t.step] || TUT_TEXT_SIMPLE.T0) : (TUT_TEXT[t.step] || TUT_TEXT.T0);
  text = d.text; why = d.why; go = d.go;
  if (sim) { text = tutFill(text); why = tutFill(why); go = tutFillGo(go); }
  rp = tutRepair(t.step, s, t);
  if (rp) { text = rp.text; if (rp.why) why = rp.why; go = rp.go || go; alt = rp.alt || null; }
  if (sim && t.step === 'T3' && !alt && !tutStarted(tutS('t1'))) alt = { id: 'expedite', text: '先研〈' + tutTechName(tutS('t1')) + '〉,排到最前' };
  if (t.step === 'C4' && !alt) alt = { id: 'teamok', text: '先記著,之後再組' };
  if (!sim && t.step === 'T4' && !alt && !tutStarted('md_cesuo')) alt = { id: 'expedite', text: '先研茅廁,排到最前' };
  idle = now - (t.at[t.step] || now) >= TUT_IDLE_MS && go.kind === 'build';
  if (idle) why = (why ? why + ' ' : '') + '點「前往」,我幫你選好位置。';
  return { id: 'tut:' + t.step, src: 'tut', tier: 'T', icon: d.icon, text: text, why: why, go: go, progress: tutProgress(t.step), stepId: t.step, alt: alt };
}

// 卡片按鈕:T0 開始、T11 好、T4 把茅廁排到最前、C4 先記著
function tutAct(id) {
  if (id === 'start') return tutStart();
  if (id === 'grad') return tutGrad();
  if (id === 'expedite') return tutExpedite();
  if (id === 'teamok') { var cc = tutCity(); if (cc && cc.tut && cc.tut.step === 'C4') { tutSeen('team'); return true; } return false; }
  return false;
}
function tutStart() {
  var c = tutCity();
  if (!c || !c.tut || c.tut.step !== 'T0') return false;
  tutSetStep(c.tut, 'C1', tutClock());
  return true;
}
function tutGrad() {
  var c = tutCity(), t;
  if (!c || !c.tut || c.tut.step !== 'T11') return false;
  t = c.tut;
  tutGrantXue(t, 'grad', 10);
  tutSetStep(t, 'END', tutClock());
  t.gsp = 1;
  return true;
}
// 跳過:補發學識 20(只一次);md_cesuo 免費覆寫仍保留到研成為止
function tutSkip() {
  var c = tutCity(), t;
  if (!c || !c.tut || c.tut.step === 'END') return false;
  t = c.tut;
  tutGrantXue(t, 'skip', 20);
  t.skipped = true;
  tutSetStep(t, 'END', tutClock());
  return true;
}

// T4「把茅廁排到最前」:茅廁移到研發序列最前並開始研;研發槽滿時,把正在研的第一項全額退款、退回序列第二位(進度歸零),再開工
function tutExpedite() {
  var c = tutCity(), ts, sim = tutSimple(), id = sim ? tutS('t1') : 'md_cesuo', victim, nm = sim ? tutTechName(id) : '圊溷(茅廁)';
  if (!c || !c.tut || c.tut.step !== (sim ? 'T3' : 'T4') || typeof techState !== 'function' || typeof techQueueAdd !== 'function') return false;
  if (tutStarted(id)) return false;
  if (typeof techSlots === 'function' && techSlots() < 1) { tutToast('要先蓋研究院,才能研發。'); return false; }
  ts = techState();
  if (ts.queue.indexOf(id) < 0 && !techQueueAdd(id).ok) { tutToast('研發序列滿了,先移除一項再排' + (sim ? '〈' + nm + '〉' : '茅廁') + '。'); return false; }
  techQueueMove(id, 0);
  if (ts.cur.length >= techSlots()) {
    victim = ts.cur[0];
    if (victim && techCancel(victim.id)) ts.queue.splice(1, 0, victim.id);
  }
  techFillSlots(tutClock());
  if (!tutStarted(id)) { tutToast((sim ? '〈' + nm + '〉' : '茅廁') + '還沒開工,看看金幣或學識是否足夠。'); return false; }
  tutToast('已把〈' + nm + '〉排到最前,開始研發。');
  return true;
}

// 找位置用的占地檢查:與「放下去」同一套規則(土地、待購、數量上限、解鎖、地形、高度)
function tutPlaceOk(type, x, y) {
  if (typeof pendFailReason === 'function') return pendFailReason(type, x, y, 0) === '未知原因';
  return false;
}
function tutRoadNear(type, x, y) {
  var fp = (typeof footprint === 'function') ? footprint(type, 0) : [1, 1], xx, yy;
  if (typeof world === 'undefined' || !world || typeof isRoadLikeTerrain !== 'function') return false;
  for (yy = y - 1; yy <= y + fp[1]; yy++) for (xx = x - 1; xx <= x + fp[0]; xx++) {
    if (xx >= x && xx < x + fp[0] && yy >= y && yy < y + fp[1]) continue;
    if (typeof inBounds === 'function' && inBounds(xx, yy) && isRoadLikeTerrain(world.terrain[idx(xx, yy)])) return true;
  }
  return false;
}
// 自動找位置:茅廁 / 水井 / 田 放在民房半徑內的空地(優先接道路、覆蓋最多民房);民房放在水井半徑內。回傳 {cell, x, y, road, why}
function tutSpotNear(type) {
  var objs = (typeof world !== 'undefined' && world && Array.isArray(world.objects)) ? world.objects : [], houses = [], wells = [], anc, R, best = null, a, dx, dy, x, y, cover, d2, sc, road, i, why;
  var none = function (w) { return { cell: null, x: 0, y: 0, road: false, why: w }; };
  objs.forEach(function (o) {
    if (!o) return;
    if (typeof CITYFX_HOUSES !== 'undefined' && CITYFX_HOUSES[o.type]) houses.push(o);
    else if (o.type === 'well') wells.push(o);
  });
  if (tutSimple() && (type === 'house' || type === 'market' || type === 'notice_board' || type === 'research' || !TUT_SPOT_R[type])) {   // 簡化模式:蓋在現有民房 / 城主府附近即可,不必靠水井
    anc = houses.length ? houses : objs.filter(function (o) { return o && o.type === 'palace'; });
    R = TUT_SPOT_R[type] || 8; why = '這一棟請自己挑一塊空地放下去。';
    var tt = (typeof fxGoType === 'function') ? fxGoType(type) : type;   // 魔幻世界:以本族建築檢查占地
    if (!anc.length) return none(why);
    for (a = 0; a < anc.length; a++) for (dx = -R; dx <= R; dx++) for (dy = -R; dy <= R; dy++) {
      d2 = dx * dx + dy * dy; x = anc[a].x + dx; y = anc[a].y + dy;
      if (d2 > R * R || (typeof inBounds === 'function' && !inBounds(x, y)) || !tutPlaceOk(tt, x, y)) continue;
      road = tutRoadNear(tt, x, y); sc = (road ? 1000 : 0) - d2;
      if (!best || sc > best.sc) best = { x: x, y: y, road: road, sc: sc };
    }
    if (!best) return none('附近找不到能放的空地,試試拉近視野,或自己挑一塊。');
    return { cell: { x: best.x, y: best.y }, x: best.x, y: best.y, road: best.road, why: '' };
  }
  if (type === 'house') { anc = wells; R = TUT_SPOT_R.well; why = '還沒有水井,先鑿一口井再蓋民房。'; }
  else if (TUT_SPOT_R[type]) { anc = houses; R = TUT_SPOT_R[type]; why = '還沒有民房,先蓋民房。'; }
  else return none('這一棟請自己挑一塊空地放下去。');
  if (!anc.length) return none(why);
  for (a = 0; a < anc.length; a++) {
    for (dx = -R; dx <= R; dx++) for (dy = -R; dy <= R; dy++) {
      d2 = dx * dx + dy * dy;
      if (d2 > R * R) continue;
      x = anc[a].x + dx; y = anc[a].y + dy;
      if (typeof inBounds === 'function' && !inBounds(x, y)) continue;
      cover = 0;
      if (type !== 'house') for (i = 0; i < houses.length; i++) { var ex = houses[i].x - x, ey = houses[i].y - y; if (ex * ex + ey * ey <= R * R) cover++; }
      if (type !== 'house' && cover < 1) continue;
      if (!tutPlaceOk(type, x, y)) continue;
      road = tutRoadNear(type, x, y);
      sc = (road ? 1000 : 0) + cover * 100 - d2;
      if (!best || sc > best.sc) best = { x: x, y: y, road: road, sc: sc };
    }
  }
  if (!best) return none('民房 ' + R + ' 格內找不到能放的空地(可能被佔滿或地形不合),試試拉近視野,或自己挑一塊。');
  return { cell: { x: best.x, y: best.y }, x: best.x, y: best.y, road: best.road, why: '' };
}
// 卡片「前往」蓋建築:自動找位置、鏡頭移過去、選好工具、高亮預覽;找不到時說明原因,仍切到該工具讓玩家自己放
function tutGoBuild(type) {
  var sp = tutSpotNear(type), tool = (typeof fxGoType === 'function') ? fxGoType(type) : type;
  if (sp.cell && typeof centerOnCell === 'function') { centerOnCell(sp.x, sp.y); if (typeof clampView === 'function') clampView(); }
  if (typeof setTool === 'function' && typeof OBJECTS !== 'undefined' && OBJECTS[tool]) setTool(tool);
  if (sp.cell && typeof preview === 'object' && preview) { preview.tool = tool; preview.x = sp.x; preview.y = sp.y; preview.ok = true; preview.visible = true; }
  if (!sp.cell) tutToast(sp.why);
  else if (!sp.road) tutToast('附近沒有接路的空地,先幫你選了鄰近的空地(綠色高亮),點一下就能蓋。');
  else tutToast('幫你選好位置了(綠色高亮),點一下就能蓋。');
  return !!sp.cell;
}
