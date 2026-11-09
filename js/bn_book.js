// js/bn_book.js — 討伐戰法學習(PLAN_BATTLE_A §4.8 / B4 最小可用版):兵書研讀、名人傳授、研兵(兵種強化)。入口在名冊詳情(cardsui.js 一行 typeof 守衛呼叫 bnBookHtml)。
// 與 PLAN 的落差(最小版):研讀 / 傳授當場生效,不佔學院席位、不需課時;研兵改為「兵種強化」(全名冊同兵種共享等級),不是學院課程。
// 規則:路人學習欄數 = bn_units.js bnSlotCount(白 0、青藍 1、紫金 2;宗師或升階 2 次 +1,上限 2);每欄可指定一個戰法,沒指定的欄位照舊自動配(bnLearnMerge)。
//   兵書:消耗 1 本(庫存在 lorddomain.bn.v1 的 books,討伐掉落;經 bnUiLoad / bnUiSave 讀寫),把該通用戰法放進指定欄。
//   傳授:名冊中的名人把自己『可學習』的戰法教給路人;每位名人每個戰法可教 1 + 信物 人;花碎片與金幣(BNBOOK.teach)。名人本身不消耗。
//   學養限制:通才不限;其他學養只能學「兵種適性 B 以上」或「出身職業相符」的戰法(名人戰法看該名人的兵種)。
//   研兵:每個兵種 0~5 級,每級該兵種名冊人物在討伐中兵力 / 攻擊 / 謀略 / 治療 +2%(敵人不吃);花碎片與金幣(BNBOOK.drillCost)。
// 存檔:世界內 'lorddomain.bnbook.v1'(進度鍵 SAVE_SLOT_KEYS;有值才寫):{v:1, learn:{entryId:[各欄戰法 id 或 null]}, taught:{'名人entryId|戰法id':人數}, drill:{兵種:級}}。壞檔 / 缺欄位 = 空。
// 對 bn_units.js 提供:bnBookLearnOf(card)(名冊卡的指定學習欄,沒有回 null)、bnBookDrillOf(card, troop)(研兵加成比例)。不發聲、不寫 DOM 以外的東西。ES2017;不用 ?. ??。
// 全域:BNBOOK bnbk bnBookLoad bnBookSave bnBookLearnOf bnBookDrillOf bnBookFit bnBookBooks bnBookTeachers bnBookUseBook bnBookTeach bnBookDrill bnBookReset bnBookHtml bnBookAct bnBookOnClick

var BNBOOK = {
  key: 'lorddomain.bnbook.v1', drillMax: 5, drillPer: 0.02, teach: { shards: 20, coin: 1500 },
  drillCost: function (lv) { return { shards: 10 * (lv + 1), coin: 800 * (lv + 1) }; }
};
var bnbk = { raw: null, d: null, pick: null, teachOpen: null, msg: '' };

function bnBookLsGet() { try { return localStorage.getItem(BNBOOK.key); } catch (e) { return null; } }
function bnBookLsSet(v) { try { if (v === null) localStorage.removeItem(BNBOOK.key); else localStorage.setItem(BNBOOK.key, v); return true; } catch (e) { return false; } }
function bnBookNew() { return { v: 1, learn: {}, taught: {}, drill: {} }; }
// 讀檔(依 localStorage 原字串快取;切換世界後字串變了就重讀)
function bnBookLoad() {
  var raw = bnBookLsGet(), o = null, d = bnBookNew(), k;
  if (bnbk.d && raw === bnbk.raw) return bnbk.d;
  if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  if (o && typeof o === 'object') {
    if (o.learn && typeof o.learn === 'object') for (k in o.learn) {
      if (!Array.isArray(o.learn[k])) continue;
      var L = o.learn[k].slice(0, 3).map(function (id) { return (typeof id === 'string' && typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id] && BN_SKILLS[id].cat !== 'ult') ? id : null; });
      if (L.some(function (x) { return x; })) d.learn[String(k).slice(0, 40)] = L;
    }
    if (o.taught && typeof o.taught === 'object') for (k in o.taught) { var n = o.taught[k] | 0; if (n > 0) d.taught[String(k).slice(0, 80)] = Math.min(99, n); }
    if (o.drill && typeof o.drill === 'object' && typeof BN_DATA !== 'undefined') BN_DATA.troopList.forEach(function (t) { var v = o.drill[t] | 0; if (v > 0) d.drill[t] = Math.min(BNBOOK.drillMax, v); });
  }
  bnbk.raw = raw; bnbk.d = d;
  return d;
}
function bnBookHas(d) { return Object.keys(d.learn).length || Object.keys(d.taught).length || Object.keys(d.drill).length; }
// 有值才寫;名冊已沒有的人(遣散 / 請辭)順手清掉
function bnBookSave(d) {
  var ids = bnBookRosterIds(), raw;
  d = d || bnBookLoad();
  if (ids) Object.keys(d.learn).forEach(function (k) { if (!ids[k]) delete d.learn[k]; });
  raw = bnBookHas(d) ? JSON.stringify({ v: 1, learn: d.learn, taught: d.taught, drill: d.drill }) : null;
  if (raw === null && bnBookLsGet() === null) return true;
  if (!bnBookLsSet(raw)) return false;
  bnbk.raw = raw; bnbk.d = d;
  return true;
}
function bnBookRoster() { var cs = (typeof cardsGet === 'function') ? cardsGet() : null; return cs && Array.isArray(cs.roster) ? cs.roster : null; }
function bnBookRosterIds() { var r = bnBookRoster(), o = {}; if (!r) return null; r.forEach(function (e) { o[e.id] = 1; }); return o; }
function bnBookEntry(id) { var r = bnBookRoster() || [], i; for (i = 0; i < r.length; i++) if (r[i].id === id) return r[i]; return null; }
// 只對「真正在名冊裡的那張卡」生效(敵人樣板、隊伍代碼重建的卡沒有 entry id)
function bnBookIsRoster(card) { var e = card && card.id ? bnBookEntry(card.id) : null; return !!e && e.name === card.name; }
function bnBookLearnOf(card) {
  if (!card || card.fig || !bnBookIsRoster(card)) return null;
  var L = bnBookLoad().learn[card.id];
  return L && L.some(function (x) { return x; }) ? L.slice() : null;
}
function bnBookDrillOf(card, troop) {
  if (!card || !bnBookIsRoster(card)) return 0;
  return (bnBookLoad().drill[troop] | 0) * BNBOOK.drillPer;
}
function bnBookSkName(id) { return (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]) ? BN_SKILLS[id].name : id; }
// 能否學:回 '' = 可以;否則回原因
function bnBookFit(e, id) {
  var d = (typeof BN_SKILLS !== 'undefined') ? BN_SKILLS[id] : null, apt, f, troops, okT, okJ;
  if (!d || d.cat === 'ult') return '不是可學的戰法';
  if (e.fig) return '名人的戰法固定,不能另學';
  if (bnSlotCount(e) <= 0) return '白階沒有學習欄';
  if (d.fig && !d.learn) return '名人專屬戰法不能傳授';
  if ((e.learn | 0) === 0) return '';   // 通才:不限
  apt = bnAptOf(e).apt;
  if (d.fig) { troops = [BN_FIG_SKILLS[d.fig] ? BN_FIG_SKILLS[d.fig].troop : '']; okJ = false; }
  else { f = d.fit || {}; troops = f.troops || []; okJ = !!(f.jobs && e.ja && f.jobs.some(function (j) { return e.ja[j]; })); }
  okT = troops.some(function (t) { return apt[t] && apt[t] !== 'C'; });
  if (!troops.length && !(d.fit && d.fit.jobs)) okT = true;
  return okT || okJ ? '' : '學養非通才:需兵種適性 B 以上或職業相符(' + (troops.join('、') || '—') + '兵)';
}
// 兵書庫存(bn.v1 books)
function bnBookBooks() {
  var d = (typeof bnUiLoad === 'function') ? bnUiLoad() : null;
  return d && d.books ? d.books : {};
}
// 名冊中可傳授的名人:[{e, ids:[戰法 id], left:{id:剩餘人數}}]
function bnBookTeachers() {
  var r = bnBookRoster() || [], d = bnBookLoad(), out = [];
  r.forEach(function (e) {
    var fg = e.fig && typeof BN_FIG_SKILLS !== 'undefined' ? BN_FIG_SKILLS[e.fig] : null, ids, left = {};
    if (!fg) return;
    ids = [fg.passive].concat(fg.skills).filter(function (id) { return id && BN_SKILLS[id] && BN_SKILLS[id].learn && BN_SKILLS[id].cat !== 'ult'; });
    if (!ids.length) return;
    ids.forEach(function (id) { left[id] = Math.max(0, 1 + (e.tok | 0) - (d.taught[e.id + '|' + id] | 0)); });
    out.push({ e: e, ids: ids, left: left });
  });
  return out;
}
function bnBookRes() { return (typeof world !== 'undefined' && world && world.res) ? world.res : null; }
function bnBookPay(cs, cost) {
  var res = bnBookRes();
  if ((cs.shards | 0) < cost.shards) return '碎片需 ' + cost.shards + '(現有 ' + (cs.shards | 0) + ')';
  if (!res || (res.coin || 0) < cost.coin) return '金幣需 ' + cost.coin;
  cs.shards -= cost.shards; res.coin -= cost.coin;
  return '';
}
function bnBookSetSlot(e, slot, id) {
  var d = bnBookLoad(), n = bnSlotCount(e), L = (d.learn[e.id] || []).slice(0, n), i;
  while (L.length < n) L.push(null);
  for (i = 0; i < n; i++) if (L[i] === id) L[i] = null;   // 同一戰法只放一欄
  L[slot] = id;
  if (L.some(function (x) { return x; })) d.learn[e.id] = L; else delete d.learn[e.id];
  return bnBookSave(d);
}
function bnBookSlotOk(e, slot) { return slot >= 0 && slot < bnSlotCount(e); }
// 兵書研讀:回 {ok, msg}
function bnBookUseBook(cs, entryId, id, slot) {
  var e = bnBookEntry(entryId), why, bd;
  if (!e) return { ok: false, msg: '找不到此人' };
  why = bnBookFit(e, id);
  if (why) return { ok: false, msg: why };
  if (!bnBookSlotOk(e, slot)) return { ok: false, msg: '學習欄不存在' };
  bd = (typeof bnUiLoad === 'function') ? bnUiLoad() : null;
  if (!bd || !bd.books || !(bd.books[id] > 0)) return { ok: false, msg: '沒有「' + bnBookSkName(id) + '」兵書' };
  bd.books[id]--;
  if (bd.books[id] <= 0) delete bd.books[id];
  if (typeof bnUiSave === 'function') bnUiSave();
  bnBookSetSlot(e, slot, id);
  return { ok: true, msg: e.name + ' 研讀兵書,學會「' + bnBookSkName(id) + '」(第 ' + (slot + 1) + ' 欄)' };
}
// 名人傳授
function bnBookTeach(cs, teacherId, studentId, id, slot) {
  var t = bnBookEntry(teacherId), e = bnBookEntry(studentId), d = bnBookLoad(), why, k, cap, fg;
  if (!t || !e || !t.fig) return { ok: false, msg: '找不到教習或學生' };
  fg = BN_FIG_SKILLS[t.fig];
  if (!fg || [fg.passive].concat(fg.skills).indexOf(id) < 0 || !BN_SKILLS[id] || !BN_SKILLS[id].learn) return { ok: false, msg: '此名人不能傳授這個戰法' };
  why = bnBookFit(e, id);
  if (why) return { ok: false, msg: why };
  if (!bnBookSlotOk(e, slot)) return { ok: false, msg: '學習欄不存在' };
  k = t.id + '|' + id; cap = 1 + (t.tok | 0);
  if ((d.taught[k] | 0) >= cap) return { ok: false, msg: t.name + ' 的「' + bnBookSkName(id) + '」已傳 ' + cap + ' 人(信物越多可傳越多人)' };
  why = bnBookPay(cs, BNBOOK.teach);
  if (why) return { ok: false, msg: why };
  d.taught[k] = (d.taught[k] | 0) + 1;
  bnBookSave(d);
  bnBookSetSlot(e, slot, id);
  return { ok: true, msg: t.name + ' 傳授「' + bnBookSkName(id) + '」給 ' + e.name + '(第 ' + (slot + 1) + ' 欄)' };
}
// 研兵
function bnBookDrill(cs, troop) {
  var d = bnBookLoad(), lv = d.drill[troop] | 0, why;
  if (!BN_DATA.troops[troop]) return { ok: false, msg: '沒有這個兵種' };
  if (lv >= BNBOOK.drillMax) return { ok: false, msg: troop + '兵研兵已滿級' };
  why = bnBookPay(cs, BNBOOK.drillCost(lv));
  if (why) return { ok: false, msg: why };
  d.drill[troop] = lv + 1;
  bnBookSave(d);
  return { ok: true, msg: troop + '兵研兵升到 ' + (lv + 1) + ' 級(討伐中兵力 / 攻擊 / 謀略 / 治療 +' + Math.round((lv + 1) * BNBOOK.drillPer * 100) + '%)' };
}
function bnBookReset(entryId, slot) {
  var e = bnBookEntry(entryId);
  if (!e || !bnBookSlotOk(e, slot)) return { ok: false, msg: '學習欄不存在' };
  bnBookSetSlot(e, slot, null);
  return { ok: true, msg: '第 ' + (slot + 1) + ' 欄改回自動配' };
}

// ───────── 名冊詳情區塊 ─────────
function bnBookEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bnBookBtn(label, act, args, dis) {
  return '<button class="cub"' + (dis ? ' disabled' : '') + ' data-bbk="' + act + '" data-bbv="' + bnBookEsc(args.join('|')) + '">' + bnBookEsc(label) + '</button>';
}
function bnBookOpen() { return typeof bnUnlocked !== 'function' || bnUnlocked(); }
// 魔幻世界顯示用語(fx_text.js fxText:兵書 → 戰技卷 …);歷史世界原樣回傳
function bnBookTx(s) { return (typeof fxText === 'function') ? fxText(s) : s; }
function bnBookHtml(cs, e) { return bnBookTx(bnBookHtml0(cs, e)); }
function bnBookHtml0(cs, e) {
  var h = '<div class="cusec">戰法學習(討伐)</div>', d, n, spec, L, i, books, tr, lv, cost, pk;
  if (!e || typeof bnUnitSpec !== 'function' || typeof BN_SKILLS === 'undefined') return '';
  if (!bnBookOpen()) return h + '<div class="cusub">開放討伐(官階亭長、名冊 3 人)後,可用兵書、名人傳授學戰法,並研兵強化兵種。</div>';
  d = bnBookLoad();
  tr = bnDefaultTroop(e);
  if (e.fig) {
    var T = bnBookTeachers().filter(function (x) { return x.e.id === e.id; })[0];
    h += '<div class="cusub cuink">名人戰法固定。' + (T ? '可傳授給路人:' + T.ids.map(function (id) { return '「' + bnBookEsc(bnBookSkName(id)) + '」剩 ' + T.left[id] + ' 人'; }).join('、') + '(每個戰法可傳 1 + 信物 人;到路人的名冊詳情選「名人傳授」)' : '沒有可傳授的戰法。') + '</div>';
  } else {
    n = bnSlotCount(e);
    spec = bnUnitSpec(e, { troop: tr });
    L = d.learn[e.id] || [];
    if (n <= 0) h += '<div class="cusub">白階沒有學習欄;升到青階後可用兵書學戰法。</div>';
    else {
      h += '<div class="cusub cuink">學習欄 ' + n + ' 個(沒指定的欄位自動配):</div>';
      for (i = 0; i < n; i++) {
        var cur = spec.skills[1 + i];
        h += '<div class="cusub" style="opacity:1">第 ' + (i + 1) + ' 欄:「' + bnBookEsc(cur ? bnBookSkName(cur) : '—') + '」' + (L[i] ? '(已學)' : '(自動)') + (L[i] ? ' ' + bnBookBtn('改回自動', 'reset', [e.id, i]) : '') + '</div>';
      }
      pk = bnbk.pick && bnbk.pick.e === e.id ? bnbk.pick : null;
      if (pk) {
        h += '<div class="cuwarn">把「' + bnBookEsc(bnBookSkName(pk.id)) + '」放進哪一欄?' + (pk.kind === 'teach' ? '(花碎片 ' + BNBOOK.teach.shards + '、金幣 ' + BNBOOK.teach.coin + ')' : '(消耗 1 本兵書)') + '</div>';
        for (i = 0; i < n; i++) h += bnBookBtn('第 ' + (i + 1) + ' 欄' + (spec.skills[1 + i] ? '(換掉「' + bnBookSkName(spec.skills[1 + i]) + '」)' : ''), pk.kind === 'teach' ? 'teachdo' : 'bookdo', [e.id, pk.id, i, pk.t || '']);
        h += bnBookBtn('取消', 'cancel', [e.id]);
      } else {
        books = bnBookBooks();
        var bk = Object.keys(books).filter(function (id) { return books[id] > 0 && BN_SKILLS[id]; });
        h += '<div class="cusub cuink">兵書(討伐掉落):' + (bk.length ? '' : '還沒有兵書;討伐首通、重複勝利可得。') + '</div>';
        bk.forEach(function (id) { var why = bnBookFit(e, id), has = spec.skills.indexOf(id) >= 0 && L.indexOf(id) >= 0; h += bnBookBtn('研讀「' + bnBookSkName(id) + '」(剩 ' + books[id] + ' 本)' + (why ? ' — ' + why : has ? ' — 已學會' : ''), 'book', [e.id, id], !!why || has); });
        var TS = bnBookTeachers();
        if (TS.length) {
          if (bnbk.teachOpen !== e.id) h += bnBookBtn('名人傳授 ▸(名冊中 ' + TS.length + ' 位名人可教)', 'topen', [e.id]);
          else {
            h += bnBookBtn('名人傳授 ▾ 收起', 'tclose', [e.id]);
            TS.forEach(function (T) {
              T.ids.forEach(function (id) {
                var why = bnBookFit(e, id) || (T.left[id] <= 0 ? '已傳滿' : '') || (L.indexOf(id) >= 0 ? '已學會' : '');
                h += bnBookBtn(T.e.name + ' 教「' + bnBookSkName(id) + '」(剩 ' + T.left[id] + ' 人)' + (why ? ' — ' + why : ''), 'teach', [e.id, id, T.e.id], !!why);
              });
            });
            h += '<div class="cusub">傳授每次花碎片 ' + BNBOOK.teach.shards + '、金幣 ' + BNBOOK.teach.coin + ';名人本身不消耗。</div>';
          }
        }
      }
    }
  }
  lv = d.drill[tr] | 0;
  h += '<div class="cusub cuink">研兵(全名冊同兵種共享):' + tr + '兵 ' + lv + '/' + BNBOOK.drillMax + ' 級' + (lv ? ',討伐中兵力 / 攻擊 / 謀略 / 治療 +' + Math.round(lv * BNBOOK.drillPer * 100) + '%' : '') + '</div>';
  if (lv < BNBOOK.drillMax) { cost = BNBOOK.drillCost(lv); h += bnBookBtn('研兵:' + tr + '兵升 ' + (lv + 1) + ' 級(碎片 ' + cost.shards + '、金幣 ' + cost.coin + ')', 'drill', [e.id, tr]); }
  if (bnbk.msg) h += '<div class="cuwarn">' + bnBookEsc(bnbk.msg) + '</div>';
  return h;
}
// 動作(按鈕 data-bbk / data-bbv);回 true = 已處理(呼叫端重畫)
function bnBookAct(a, v) {
  var p = String(v || '').split('|'), cs = (typeof cardsGet === 'function') ? cardsGet() : null, r = null;
  if (!cs) return false;
  bnbk.msg = '';
  if (a === 'book') bnbk.pick = { kind: 'book', e: p[0], id: p[1] };
  else if (a === 'teach') bnbk.pick = { kind: 'teach', e: p[0], id: p[1], t: p[2] };
  else if (a === 'cancel') bnbk.pick = null;
  else if (a === 'topen') bnbk.teachOpen = p[0];
  else if (a === 'tclose') bnbk.teachOpen = null;
  else if (a === 'bookdo') r = bnBookUseBook(cs, p[0], p[1], +p[2]);
  else if (a === 'teachdo') r = bnBookTeach(cs, p[3], p[0], p[1], +p[2]);
  else if (a === 'reset') r = bnBookReset(p[0], +p[1]);
  else if (a === 'drill') r = bnBookDrill(cs, p[1]);
  else return false;
  if (r) {
    bnbk.msg = r.msg;
    if (r.ok) { bnbk.pick = null; if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } } }
  }
  return true;
}
function bnBookOnClick(ev) {
  var b = ev && ev.target, a;
  while (b && b.getAttribute && !b.getAttribute('data-bbk')) b = b.parentNode;
  if (!b || !b.getAttribute) return;
  a = b.getAttribute('data-bbk');
  if (b.disabled) return;
  if (ev.stopPropagation) ev.stopPropagation();
  if (bnBookAct(a, b.getAttribute('data-bbv')) && typeof cardsUiRender === 'function') cardsUiRender();
}
if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') document.addEventListener('click', bnBookOnClick, true);
