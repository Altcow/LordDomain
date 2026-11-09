// js/academyui.js — 名冊詳情的「學院進修」區塊(cardsui.js cuDetailHtml 掛 cuAcademyHtml;npcui.js cuNpcClick 掛 cuAcademyClick)。
// 引擎在 academy.js,數值在 carddata.js CARD_ACADEMY。顯示:院級 / 進修席、進修進度(課數、速成、退學)、可選課程與花費 / 未達原因。不發聲。ES2017;不用 ?. ??。
// 全域名稱:cuAcademyHtml cuAcademyClick

var CU_AC_ACTS = { acgo: 1, acrush: 1, acquit: 1, acquity: 1, acquitn: 1, acl: 1, actch: 1, acxun: 1, acsw: 1, acswf: 1, aclec: 1 };
function cuAcStudyLabel(e, s) {
  if (s.k === 'up') return '升階 ' + CARD_GRADE[e.gr].name + '→' + CARD_GRADE[Math.min(4, e.gr + 1)].name;
  if (s.k === 'swap') return '轉職 ' + acadJobName(s.f) + '→' + acadJobName(s.j);
  return (s.k === 'adv' ? '精進 ' : '習藝 ') + acadJobName(s.j);
}
// 旬報計課說明 + 「結束本旬」鈕(有人在學才出現)
function cuAcXunHtml(cs, I) {
  var X = academyXunInfo(cs, Date.now()), h;
  if (!I.lv) return '';
  h = '<div class="cusub" style="opacity:1">1 課 = 1 次旬報。旬報在三種時候結算:施政動作(蓋、拆、研發)滿 ' + X.acts + ' 次、本機換日後第一次開啟、或按「結束本旬」。每天最多 ' + X.max + ' 次,離線回來只補 1 次。<br>今日旬報 ' + X.n + '/' + X.max + ' · 施政動作 ' + X.a + '/' + X.acts + '</div>';
  if (X.students) h += '<button class="cub" data-a="acxun"' + (X.n >= X.max ? ' disabled' : '') + '>結束本旬(在學的人各上 1 課)</button>' + (X.n >= X.max ? '<div class="cusub" style="opacity:1"><span class="cuwarn">今天的旬報已滿 ' + X.max + ' 次,明天再來</span></div>' : '');
  return h;
}
// 名師講學(只在教習自己的詳情顯示;院 5)
function cuAcLectureHtml(cs, e, I) {
  var L = CARD_ACADEMY.lecture, c, job;
  if (!e.tch || I.lv < L.academy) return '';
  c = academyLectureCheck(cs, e, Date.now()); job = c.job;
  return '<div class="cusub" style="opacity:1"><b>名師講學</b>:' + (job ? '宗師職業「' + cuEsc(acadJobName(job)) + '」,同職業的在學者 ' + c.targets.length + ' 人各少 ' + L.cut + ' 課' : '教習要有宗師(IV 階)職業才能講學') +
    '<br>' + cuEsc('碎片 ' + L.shards + '、金幣 ' + L.coin + ' · 今日還可 ' + c.left + ' 次') + (c.ok ? '' : '<br><span class="cuwarn">' + cuEsc(c.reasons.join(';')) + '</span>') +
    '<br><button class="cub" data-a="aclec" data-id="' + e.id + '"' + (c.ok ? '' : ' disabled') + '>開講</button></div>';
}
// 轉職:先選要換掉的 I 階職業,再選新職業
function cuAcSwapHtml(cs, e, now) {
  var ones = Object.keys(e.ja).filter(function (k) { return e.ja[k] === 1; }), chk, h, f = (cu.acs === e.id) ? cu.acsf : null, chips = '';
  h = '<button class="cub" data-a="acsw" data-id="' + e.id + '">' + (cu.acs === e.id ? '收起轉職' : '轉職(把一個 I 階職業換成別的)') + '</button>';
  if (cu.acs !== e.id) return h;
  chk = academyCheck(cs, e, 'swap', f, now, null);
  h += '<div class="cusub" style="opacity:1">' + cuEsc(cuAcCostText(chk.cost)) + cuAcTeachText(chk.teach) + (ones.length ? '' : '<br><span class="cuwarn">沒有 I 階的職業可以轉</span>') + (chk.ok ? '' : '<br><span class="cuwarn">' + cuEsc(chk.reasons.join(';')) + '</span>') + '<br>1. 換掉哪一個:</div><div class="cuchips">';
  ones.forEach(function (k) { chips += '<button class="cub' + (f === k ? ' on' : '') + '" data-a="acswf" data-id="' + e.id + '" data-f="' + k + '">' + (f === k ? '✔ ' : '') + cuEsc(acadJobName(k)) + '</button>'; });
  h += chips + '</div>';
  if (!f) return h;
  chips = '';
  h += '<div class="cusub" style="opacity:1">2. 改學什麼(「' + cuEsc(acadJobName(f)) + '」會換成新職業 I 階):</div><div class="cuchips">';
  CARD_JOBS.forEach(function (j) {
    if (e.ja[j.id]) return;
    chips += '<button class="cub" data-a="acgo" data-id="' + e.id + '" data-k="swap" data-j="' + f + '" data-t="' + j.id + '"' + (chk.ok ? '' : ' disabled') + '>' + cuEsc(j.name) + '</button>';
  });
  return h + chips + '</div>';
}

function cuAcCostText(c) { return '碎片 ' + c.shards + '、金幣 ' + c.coin + '、' + c.lessons + ' 課'; }
function cuAcTeachText(t) {   // 課程列的教習效果(只在有教習時顯示)
  var p = [];
  if (!t || !t.t) return '';
  if (t.pct) p.push('花費 −' + Math.round(t.pct * 100) + ' %');
  if (t.cut) p.push('課數 −' + t.cut);
  return '<br>' + cuEsc('教習 ' + t.t.name + ':' + p.join('、'));
}
function cuAcTeachWhy(code) {
  return ({ none: '查無此人', study: '在學中不能當教習', lv: '院級 2 起才有教習席', seats: '教習席已滿' })[code] || '無法設為教習';
}
function cuAcCourseRow(chk, attrs, btn) {
  return '<div class="cusub" style="opacity:1;margin:3px 0">' + cuEsc(chk.label) + (chk.cost ? '<br>' + cuEsc(cuAcCostText(chk.cost)) : '') + cuAcTeachText(chk.teach) +
    (chk.ok ? '' : '<br><span class="cuwarn">' + cuEsc(chk.reasons.join(';')) + '</span>') +
    '<br><button class="cub" data-a="acgo" ' + attrs + (chk.ok ? '' : ' disabled') + '>' + btn + '</button></div>';
}
function cuAcademyHtml(cs, e) {
  var A = CARD_ACADEMY, I = academyInfo(cs), s = e.study, h = '<div class="cusec">學院進修</div>', now = Date.now(), chk, k, first = null, rows = '', chips = '';
  h += '<div class="cusub" style="opacity:1">' + (I.lv ? '學院:' + cuEsc(I.name) + '(院級 ' + I.lv + ')· 進修席 ' + I.used + '/' + I.seats : '學院尚未開放(研〈郡國學校〉並建學舍)') +
    ' · 已進修 ' + (e.sn | 0) + ' 次 · 升階 ' + (e.up | 0) + '/' + CARD_CFG.upMax + (e.pu ? '<br>出身:' + cuEsc(academyPupilName(e.pu)) + '(學院栽培的人)' : '') + '<br>花費以碎片(卡片熔爐所得)與金幣支付。</div>';
  if (I.lv >= A.pupil.academy) h += '<div class="cusub" style="opacity:1">生徒:縣試池連抽 ' + CARD_DRAW.floorMin + ' 張以上時,最後一張是本院生徒(至少青' + (I.lv >= A.pupil.blueLv ? ',有機會藍' : '') + ';有教習時常帶教習的職業)。</div>';
  h += cuAcXunHtml(cs, I);
  if (e.fig) return h + '<div class="cusub">名人不進修、不升階。</div>';
  h += '<div class="cusub" style="opacity:1">' + (academyTeachSeats(I.lv) ? '教習席 ' + academyTeachFlagged(cs).length + '/' + academyTeachSeats(I.lv) + '(教習:進修花費 −教化階 × ' + Math.round(A.teachPerTier * 100) + ' %;同職業且教習 III 以上,課數 −' + A.teachLessonCut + ';自動選最有利的一位)' : '教習席於院級 2 起開放') + '</div>';
  if (s) {
    h += '<div class="cusub" style="opacity:1"><b>進修中</b>:' + cuEsc(cuAcStudyLabel(e, s)) +
      ' · 已上 ' + Math.min(s.n, s.l) + '/' + s.n + ' 課' + (s.t && cardsFind(cs, s.t) ? '<br>教習:' + cuEsc(cardsFind(cs, s.t).e.name) : '') + '<br>進修期間不能派駐、不能遣散。</div>';
    h += '<button class="cub" data-a="acrush" data-id="' + e.id + '">速成(再花 ' + Math.ceil(s.cs * A.rushRate) + ' 碎,立即結業)</button>';
    if (cu.acq === e.id) h += '<div class="cuwarn">退學將作廢進度,只退還一半碎片與金幣。</div><button class="cub" data-a="acquitn" data-id="' + e.id + '">不退學</button><button class="cub warn" data-a="acquity" data-id="' + e.id + '">確定退學</button>';
    else h += '<button class="cub warn" data-a="acquit" data-id="' + e.id + '">退學</button>';
    return h;
  }
  if (e.tch) h += '<button class="cub" data-a="actch" data-id="' + e.id + '">撤下教習</button>';
  else {
    var tw = academyTeachBlock(cs, e);
    h += '<button class="cub" data-a="actch" data-id="' + e.id + '"' + (tw ? ' disabled' : '') + '>設為教習(占教習席)</button>' + (tw ? '<div class="cusub" style="opacity:1"><span class="cuwarn">' + cuEsc(cuAcTeachWhy(tw)) + '</span></div>' : '');
  }
  h += cuAcLectureHtml(cs, e, I);
  chk = academyCheck(cs, e, 'up', null, now);
  rows += cuAcCourseRow(chk, 'data-id="' + e.id + '" data-k="up"', '送去進修');
  for (k in e.ja) if (e.ja[k] < 4) rows += cuAcCourseRow(academyCheck(cs, e, 'adv', k, now), 'data-id="' + e.id + '" data-k="adv" data-j="' + k + '"', '送去進修');
  h += rows;
  Object.keys(CARD_JOB_BY_ID).forEach(function (id) { if (!first && !e.ja[id]) first = id; });
  if (first) {
    chk = academyCheck(cs, e, 'learn', first, now);
    h += '<button class="cub" data-a="acl" data-id="' + e.id + '">' + (cu.acl === e.id ? '收起習藝' : '習藝(新增一個職業 I 階)') + '</button>';
    if (cu.acl === e.id) {
      h += '<div class="cusub" style="opacity:1">' + cuEsc(cuAcCostText(chk.cost)) + (chk.ok ? '' : '<br><span class="cuwarn">' + cuEsc(chk.reasons.join(';')) + '</span>') + '</div><div class="cuchips">';
      CARD_JOBS.forEach(function (j) {
        if (e.ja[j.id]) return;
        chips += '<button class="cub" data-a="acgo" data-id="' + e.id + '" data-k="learn" data-j="' + j.id + '"' + (chk.ok ? '' : ' disabled') + '>' + cuEsc(j.name) + '</button>';
      });
      h += chips + '</div>';
    }
  }
  if (I.lv >= A.swap.academy) h += cuAcSwapHtml(cs, e, now);
  else if (I.lv) h += '<div class="cusub">轉職於院級 ' + A.swap.academy + ' 起開放。</div>';
  return h;
}
function cuAcMsg(m) { if (typeof cu !== 'undefined') cu.msg = m; }
function cuAcSave() { if (typeof cuSave === 'function') cuSave(); else if (typeof saveWorld === 'function') { try { saveWorld(); } catch (er) { /* 略過 */ } } }
// 回 true = 已處理。f = cardsFind 結果(可為 null)
function cuAcademyClick(a, b, cs, f) {
  var r, e, k, j;
  if (!CU_AC_ACTS[a]) return false;
  if (a === 'acxun') {
    r = academyXunEnd(cs, Date.now());
    if (r.ok) { acadReport([r]); cuAcMsg(r.done.length ? r.done.map(function (x) { return x.text; }).join(';') : '本旬結束:在學的 ' + r.lessons + ' 人各上完一課'); cuAcSave(); }
    else cuAcMsg(r.reason === 'cap' ? '今天的旬報已滿,明天再來' : '目前沒有人在學');
    return true;
  }
  if (!f) return true;
  e = f.e;
  if (a === 'acsw') { cu.acs = (cu.acs === e.id) ? null : e.id; cu.acsf = null; return true; }
  if (a === 'acswf') { cu.acsf = b.getAttribute('data-f'); return true; }
  if (a === 'aclec') {
    r = academyLecture(cs, e, Date.now());
    if (r.ok) { cuAcMsg('名師講學:' + r.n + ' 人各少 1 課' + (r.done.length ? ';' + r.done.map(function (x) { return x.text; }).join(';') : '')); cuAcSave(); }
    else cuAcMsg(r.reasons.join(';'));
    return true;
  }
  if (a === 'actch') { r = academyTeachSet(cs, e, !e.tch); cuAcMsg(r.ok ? (e.tch ? '已設為教習' : '已撤下教習') : cuAcTeachWhy(r.reason)); cuAcSave(); return true; }
  if (a === 'acl') { cu.acl = (cu.acl === e.id) ? null : e.id; return true; }
  if (a === 'acquit') { cu.acq = e.id; return true; }
  if (a === 'acquitn') { cu.acq = null; return true; }
  if (a === 'acquity') {
    cu.acq = null; r = academyQuit(cs, e);
    cuAcMsg(r.ok ? '已退學,退還碎片 ' + r.shards + '、金幣 ' + r.coin : '無法退學');
    cuAcSave(); return true;
  }
  if (a === 'acrush') {
    r = academyRush(cs, e);
    if (r.ok) { cuAcMsg(r.fin.text || '已結業'); cuAcSave(); } else cuAcMsg(r.reason === 'shards' ? '碎片不足(需 ' + r.need + ')' : '無法速成');
    return true;
  }
  k = b.getAttribute('data-k'); j = b.getAttribute('data-j');
  r = academyStart(cs, e, k, j, Date.now(), b.getAttribute('data-t'));
  if (r.ok) { cu.acl = null; cu.acs = null; cu.acsf = null; cuAcMsg('已送去進修:' + r.label); cuAcSave(); if (typeof cardsSyncTalents === 'function') cardsSyncTalents(); }
  else cuAcMsg(r.reasons.join(';'));
  return true;
}
