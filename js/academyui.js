// js/academyui.js — 名冊詳情的「學院進修」區塊(cardsui.js cuDetailHtml 掛 cuAcademyHtml;npcui.js cuNpcClick 掛 cuAcademyClick)。
// 引擎在 academy.js,數值在 carddata.js CARD_ACADEMY。顯示:院級 / 進修席、進修進度(課數、速成、退學)、可選課程與花費 / 未達原因。不發聲。ES2017;不用 ?. ??。
// 全域名稱:cuAcademyHtml cuAcademyClick

var CU_AC_ACTS = { acgo: 1, acrush: 1, acquit: 1, acquity: 1, acquitn: 1, acl: 1 };

function cuAcCostText(c) { return '碎片 ' + c.shards + '、金幣 ' + c.coin + '、' + c.lessons + ' 課'; }
function cuAcCourseRow(chk, attrs, btn) {
  return '<div class="cusub" style="opacity:1;margin:3px 0">' + cuEsc(chk.label) + (chk.cost ? '<br>' + cuEsc(cuAcCostText(chk.cost)) : '') +
    (chk.ok ? '' : '<br><span class="cuwarn">' + cuEsc(chk.reasons.join(';')) + '</span>') +
    '<br><button class="cub" data-a="acgo" ' + attrs + (chk.ok ? '' : ' disabled') + '>' + btn + '</button></div>';
}
function cuAcademyHtml(cs, e) {
  var A = CARD_ACADEMY, I = academyInfo(cs), s = e.study, h = '<div class="cusec">學院進修</div>', now = Date.now(), min = Math.round(A.lessonSec / 60), chk, k, first = null, rows = '', chips = '';
  h += '<div class="cusub" style="opacity:1">' + (I.lv ? '學院:' + cuEsc(I.name) + '(院級 ' + I.lv + ')· 進修席 ' + I.used + '/' + I.seats : '學院尚未開放(研〈郡國學校〉並建學舍)') +
    ' · 已進修 ' + (e.sn | 0) + ' 次 · 升階 ' + (e.up | 0) + '/' + CARD_CFG.upMax + '<br>1 課約遊玩 ' + min + ' 分鐘(離線不推進);花費以碎片(卡包分解所得)與金幣支付。</div>';
  if (e.fig) return h + '<div class="cusub">名人不進修、不升階。</div>';
  if (s) {
    h += '<div class="cusub" style="opacity:1"><b>進修中</b>:' + cuEsc(s.k === 'up' ? '升階 ' + CARD_GRADE[e.gr].name + '→' + CARD_GRADE[Math.min(4, e.gr + 1)].name : (s.k === 'adv' ? '精進 ' : '習藝 ') + acadJobName(s.j)) +
      ' · 第 ' + Math.min(s.n, s.l + 1) + '/' + s.n + ' 課(本課 ' + Math.floor(s.p) + '/' + A.lessonSec + ' 秒)<br>進修期間不能派駐、不能請辭。</div>';
    h += '<button class="cub" data-a="acrush" data-id="' + e.id + '">速成(再花 ' + Math.ceil(s.cs * A.rushRate) + ' 碎,立即結業)</button>';
    if (cu.acq === e.id) h += '<div class="cuwarn">退學將作廢進度,只退還一半碎片與金幣。</div><button class="cub" data-a="acquitn" data-id="' + e.id + '">不退學</button><button class="cub warn" data-a="acquity" data-id="' + e.id + '">確定退學</button>';
    else h += '<button class="cub warn" data-a="acquit" data-id="' + e.id + '">退學</button>';
    return h;
  }
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
  return h;
}
function cuAcMsg(m) { if (typeof cu !== 'undefined') cu.msg = m; }
function cuAcSave() { if (typeof cuSave === 'function') cuSave(); else if (typeof saveWorld === 'function') { try { saveWorld(); } catch (er) { /* 略過 */ } } }
// 回 true = 已處理。f = cardsFind 結果(可為 null)
function cuAcademyClick(a, b, cs, f) {
  var r, e, k, j;
  if (!CU_AC_ACTS[a]) return false;
  if (!f) return true;
  e = f.e;
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
  r = academyStart(cs, e, k, j, Date.now());
  if (r.ok) { cu.acl = null; cuAcMsg('已送去進修:' + r.label); cuAcSave(); if (typeof cardsSyncTalents === 'function') cardsSyncTalents(); }
  else cuAcMsg(r.reasons.join(';'));
  return true;
}
