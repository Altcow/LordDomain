// js/tutorial.js — 新手教學引擎(T0~T11):狀態、步驟推進、獎勵、修復提示、md_cesuo 免費覆寫。文案在 tutorial_data.js,卡片在 nextstepui.js。
// 狀態存 world.city.tut = { v:1, step:'T0'..'T11'|'END', skipped, grants:{…}, at:{步驟:時間}, hold? },跟著存檔走(goods.js goodsNormCity → tutNormSave)。
// 只有全新世界(main.js boot 的 freshWorld)才會建立 tut;舊存檔沒有 tut = 已畢業,不開教學。END 之後 tut 仍保留(給學識獎勵與免費研茅廁是否已用掉的記錄)。
// 教學期間 nsCompute 只回傳教學卡(nextstep.js 短路)。顧問照常計算、只更新角標。
// 全域名稱:tutActive tutStartNew tutNormSave tutCompute tutAct tutStart tutGrad tutSkip tutFreeTech tutUseFree tutProgress tutCover
// ES2017;不用 ?. ??。

var TUT_GRANT_KEYS = ['xue1', 'md', 'skip', 'grad', 't9'];
var TUT_HOLD_MS = 5000;         // T8 三根長條綠色需維持的時間
var TUT_IDLE_MS = 90000;        // 同一步閒置超過此時間,卡片加註「幫你選好位置」
var TUT_T9_GUARANTEE_MS = 900000; // T9 起算 15 分鐘仍未排入,補到學識 10(保底)
var TUT_MD_SECONDS = 30;        // md_cesuo 教學免費覆寫的研發秒數

function tutCity() { return (typeof world !== 'undefined' && world && world.city && typeof world.city === 'object') ? world.city : null; }
function tutClock() { return (typeof nsRt !== 'undefined' && nsRt && typeof nsRt.clock === 'function') ? nsRt.clock() : Date.now(); }
function tutActive() { var c = tutCity(); return !!(c && c.tut && c.tut.step !== 'END'); }
function tutHas() { var c = tutCity(); return !!(c && c.tut); }
function tutGraduated() { var c = tutCity(); return !!(c && c.tut && c.tut.step === 'END'); }
function tutProgress(step) { var i = TUT_IDS.indexOf(step); return i < 0 ? '' : i + '/' + TUT_TOTAL; }

function tutStartNew() {
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
  return o;
}

function tutSetStep(t, step, now) {
  t.step = step;
  t.at[step] = now;
  delete t.hold;
}

// 教學期間 md_cesuo 成本歸零、研發 30 秒,只一次(citytech.js techCostOf / techDurationOf / techPay 掛點)
function tutFreeTech(id) {
  var c = tutCity();
  return !!(id === 'md_cesuo' && c && c.tut && !c.tut.grants.md && typeof techDone === 'function' && !techDone('md_cesuo'));
}
function tutUseFree(id) {
  var c = tutCity();
  if (id === 'md_cesuo' && c && c.tut && !c.tut.grants.md) c.tut.grants.md = 1;
}

function tutCnt(s, id) { return (s && s.cnt && s.cnt[id]) || 0; }
function tutWater() { return (typeof cityFxCity === 'function') ? cityFxCity('water') : 0; }
function tutSani() { return (typeof cityFxCity === 'function') ? cityFxCity('sani') : 0; }
function tutFood() { return (typeof cityFxCity === 'function') ? cityFxCity('food') : 0; }
function tutFields(s) { var n = 0; if (typeof NS_FIELD_TYPES !== 'undefined') NS_FIELD_TYPES.forEach(function (k) { n += tutCnt(s, k); }); return n; }
function tutQueued(id) { var ts = (typeof techState === 'function') ? techState() : null; if (!ts) return false; return (ts.cur || []).some(function (c) { return c.id === id; }) || (ts.queue || []).indexOf(id) >= 0; }
function tutDoneTech(id) { return (typeof techDone === 'function') ? !!techDone(id) : false; }
function tutXue() { var ts = (typeof techState === 'function') ? techState() : null; return ts ? Math.floor(ts.xue || 0) : 0; }
function tutGrantXue(t, key, n) {
  var ts = (typeof techState === 'function') ? techState() : null;
  if (!ts || t.grants[key]) return;
  ts.xue = (ts.xue || 0) + n;
  t.grants[key] = 1;
}

// 步驟完成條件(T0 / T11 只由按鈕推進,這裡不判斷)
function tutDone(step, s, mem, t, now) {
  switch (step) {
    case 'T1': return s.houses >= 1 && tutWater() >= 80;   // 沒有民房時城市飲水值不具意義
    case 'T2': return s.houses >= 3;
    case 'T3': return tutCnt(s, 'research') >= 1;
    case 'T4': return tutQueued('md_cesuo') || tutDoneTech('md_cesuo');
    case 'T5': return tutDoneTech('md_cesuo') && !!(mem && mem.seen && mem.seen.bars);
    case 'T6': return tutCnt(s, 'privy') >= 1 && cityFxHouseCover('privy') >= 1;
    case 'T7': return tutFields(s) >= 3;
    case 'T8':
      if (s.houses >= 6 && tutFood() >= 100 && tutWater() >= 80 && tutSani() >= 60) {
        if (typeof t.hold !== 'number') t.hold = now;
        return now - t.hold >= TUT_HOLD_MS;
      }
      delete t.hold;
      return false;
    case 'T9': return tutQueued('e_shiling') || tutDoneTech('e_shiling');
    case 'T10': return tutCnt(s, 'market') >= 1;
    default: return false;
  }
}

// 完成時的獎勵(只給一次)
function tutRewardOn(step, t, s) {
  if (step === 'T3') tutGrantXue(t, 'xue1', 10);
}

// 修復 / 退回提示:回傳 {text, why, go} 覆蓋該步文案;沒有則 null
function tutRepair(step, s, t) {
  var labs = tutCnt(s, 'research'), have, min;
  if (step === 'T1' && tutCnt(s, 'well') >= 1 && tutWater() < 80) return { text: '這口井離民房還是太遠,在民房旁再鑿一口。', go: { kind: 'build', type: 'well' } };
  if (step === 'T2' && tutWater() < 80) return { text: '新民房也要在井邊,否則會缺水。', go: { kind: 'build', type: 'house' } };
  if (step === 'T4' && !tutDoneTech('md_cesuo') && !tutQueued('md_cesuo')) return null;
  if (step === 'T5' && !tutDoneTech('md_cesuo') && labs < 1) return { text: '研究院不見了,研發停住了,再蓋一座吧。', go: { kind: 'build', type: 'research' } };
  if (step === 'T6' && tutCnt(s, 'privy') >= 1 && cityFxHouseCover('privy') < 1) return { text: '這座茅廁離民房太遠,再蓋一座靠近民房的。', go: { kind: 'build', type: 'privy' } };
  if (step === 'T8' && s.houses >= 6) {
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

// 推進:每次呼叫最多前進一步(讓玩家看得到每一步);回傳目前應顯示的教學卡,教學已結束回 null
function tutCompute(s, mem) {
  var c = tutCity(), t, now, step, rp, d, why, go, text, idle;
  if (!c || !c.tut || c.tut.step === 'END') return null;
  t = c.tut;
  now = tutClock();
  if (typeof t.at[t.step] !== 'number') t.at[t.step] = now;
  step = t.step;
  if (step !== 'T0' && step !== 'T11' && tutDone(step, s, mem, t, now)) {
    tutRewardOn(step, t, s);
    step = TUT_IDS[TUT_IDS.indexOf(step) + 1];
    tutSetStep(t, step, now);
  }
  if (t.step === 'T9' && !t.grants.t9 && now - (t.at.T9 || now) >= TUT_T9_GUARANTEE_MS && !tutQueued('e_shiling') && !tutDoneTech('e_shiling')) {
    tutGrantXue(t, 't9', Math.max(0, 10 - tutXue()));
  }
  d = TUT_TEXT[t.step] || TUT_TEXT.T0;
  text = d.text; why = d.why; go = d.go;
  rp = tutRepair(t.step, s, t);
  if (rp) { text = rp.text; if (rp.why) why = rp.why; go = rp.go || go; }
  idle = now - (t.at[t.step] || now) >= TUT_IDLE_MS && go.kind === 'build';
  if (idle) why = (why ? why + ' ' : '') + '點「前往」,我幫你選好位置。';
  return { id: 'tut:' + t.step, src: 'tut', tier: 'T', icon: d.icon, text: text, why: why, go: go, progress: tutProgress(t.step), stepId: t.step };
}

// 卡片按鈕:T0 開始、T11 好
function tutAct(id) {
  if (id === 'start') return tutStart();
  if (id === 'grad') return tutGrad();
  return false;
}
function tutStart() {
  var c = tutCity();
  if (!c || !c.tut || c.tut.step !== 'T0') return false;
  tutSetStep(c.tut, 'T1', tutClock());
  return true;
}
function tutGrad() {
  var c = tutCity(), t;
  if (!c || !c.tut || c.tut.step !== 'T11') return false;
  t = c.tut;
  tutGrantXue(t, 'grad', 10);
  tutSetStep(t, 'END', tutClock());
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
