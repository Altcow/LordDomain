// js/bn_book.js — 討伐研兵(PLAN_BATTLE_A §4.8 B4 最小版;2026-11-10 瘦身)。兵書研讀、名人傳授、學習欄已改由戰法傳承處理(bn_skcard.js),本檔只留研兵(兵種強化)。
// 研兵:每個兵種 0~5 級,每級該兵種名冊人物在討伐中兵力 / 攻擊 / 謀略 / 治療 +2%(敵人不吃);花碎片與金幣(BNBOOK.drillCost)。
// 存檔:世界內 'lorddomain.bnbook.v1'(進度鍵 SAVE_SLOT_KEYS;有值才寫):{v:1, drill:{兵種:級}}。舊檔的 learn / taught 欄讀入時忽略;壞檔 / 缺欄位 = 空。
// 對 bn_units.js 提供:bnBookDrillOf(card, troop)(研兵加成比例)。不發聲、不寫 DOM 以外的東西。ES2017;不用 ?. ??。
// 全域:BNBOOK bnbk bnBookLoad bnBookSave bnBookDrillOf bnBookDrill bnBookHtml bnBookAct bnBookOnClick

var BNBOOK = {
  key: 'lorddomain.bnbook.v1', drillMax: 5, drillPer: 0.02,
  drillCost: function (lv) { return { shards: 10 * (lv + 1), coin: 800 * (lv + 1) }; }
};
var bnbk = { raw: null, d: null, msg: '' };

function bnBookLsGet() { try { return localStorage.getItem(BNBOOK.key); } catch (e) { return null; } }
function bnBookLsSet(v) { try { if (v === null) localStorage.removeItem(BNBOOK.key); else localStorage.setItem(BNBOOK.key, v); return true; } catch (e) { return false; } }
function bnBookNew() { return { v: 1, drill: {} }; }
// 讀檔(依 localStorage 原字串快取;切換世界後字串變了就重讀)
function bnBookLoad() {
  var raw = bnBookLsGet(), o = null, d = bnBookNew();
  if (bnbk.d && raw === bnbk.raw) return bnbk.d;
  if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  if (o && typeof o === 'object' && o.drill && typeof o.drill === 'object' && typeof BN_DATA !== 'undefined') BN_DATA.troopList.forEach(function (t) { var v = (o.drill[t] | 0) || (t === '槍' ? o.drill['步'] | 0 : 0); if (v > 0) d.drill[t] = Math.min(BNBOOK.drillMax, v); });
  bnbk.raw = raw; bnbk.d = d;
  return d;
}
function bnBookHas(d) { return Object.keys(d.drill).length; }
// 有值才寫
function bnBookSave(d) {
  var raw;
  d = d || bnBookLoad();
  raw = bnBookHas(d) ? JSON.stringify({ v: 1, drill: d.drill }) : null;
  if (raw === null && bnBookLsGet() === null) return true;
  if (!bnBookLsSet(raw)) return false;
  bnbk.raw = raw; bnbk.d = d;
  return true;
}
function bnBookRoster() { var cs = (typeof cardsGet === 'function') ? cardsGet() : null; return cs && Array.isArray(cs.roster) ? cs.roster : null; }
function bnBookEntry(id) { var r = bnBookRoster() || [], i; for (i = 0; i < r.length; i++) if (r[i].id === id) return r[i]; return null; }
// 只對「真正在名冊裡的那張卡」生效(敵人樣板、隊伍代碼重建的卡沒有 entry id)
function bnBookIsRoster(card) { var e = card && card.id ? bnBookEntry(card.id) : null; return !!e && e.name === card.name; }
function bnBookDrillOf(card, troop) {
  if (!card || !bnBookIsRoster(card)) return 0;
  return (bnBookLoad().drill[troop] | 0) * BNBOOK.drillPer;
}
function bnBookRes() { return (typeof world !== 'undefined' && world && world.res) ? world.res : null; }
function bnBookPay(cs, cost) {
  var res = bnBookRes();
  if ((cs.shards | 0) < cost.shards) return '碎片需 ' + cost.shards + '(現有 ' + (cs.shards | 0) + ')';
  if (!res || (res.coin || 0) < cost.coin) return '金幣需 ' + cost.coin;
  cs.shards -= cost.shards; res.coin -= cost.coin;
  return '';
}
// 研兵:回 {ok, msg}
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

// ───────── 名冊詳情區塊(研兵;之後搬到傳承分頁 K6) ─────────
function bnBookEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bnBookBtn(label, act, args, dis) {
  return '<button class="cub"' + (dis ? ' disabled' : '') + ' data-bbk="' + act + '" data-bbv="' + bnBookEsc(args.join('|')) + '">' + bnBookEsc(label) + '</button>';
}
function bnBookOpen() { return typeof bnUnlocked !== 'function' || bnUnlocked(); }
// 魔幻世界顯示用語(fx_text.js fxText);歷史世界原樣回傳
function bnBookTx(s) { return (typeof fxText === 'function') ? fxText(s) : s; }
function bnBookHtml(cs, e) { return bnBookTx(bnBookHtml0(cs, e)); }
function bnBookHtml0(cs, e) {
  var h = '<div class="cusec">研兵(討伐)</div>', d, tr, lv, cost;
  if (!e || typeof bnDefaultTroop !== 'function' || typeof BN_DATA === 'undefined') return '';
  if (!bnBookOpen()) return h + '<div class="cusub">卡包至少 5 人後開放討伐,可研兵強化兵種。</div>';
  d = bnBookLoad();
  tr = bnDefaultTroop(e);
  lv = d.drill[tr] | 0;
  h += '<div class="cusub cuink">研兵(卡包內同兵種共享):' + tr + '兵 ' + lv + '/' + BNBOOK.drillMax + ' 級' + (lv ? ',討伐中兵力 / 攻擊 / 謀略 / 治療 +' + Math.round(lv * BNBOOK.drillPer * 100) + '%' : '') + '</div>';
  if (lv < BNBOOK.drillMax) { cost = BNBOOK.drillCost(lv); h += bnBookBtn('研兵:' + tr + '兵升 ' + (lv + 1) + ' 級(碎片 ' + cost.shards + '、金幣 ' + cost.coin + ')', 'drill', [e.id, tr]); }
  if (bnbk.msg) h += '<div class="cuwarn">' + bnBookEsc(bnbk.msg) + '</div>';
  return h;
}
// 動作(按鈕 data-bbk / data-bbv);回 true = 已處理(呼叫端重畫)
function bnBookAct(a, v) {
  var p = String(v || '').split('|'), cs = (typeof cardsGet === 'function') ? cardsGet() : null, r = null;
  if (!cs) return false;
  bnbk.msg = '';
  if (a === 'drill') r = bnBookDrill(cs, p[1]);
  else return false;
  if (r) {
    bnbk.msg = r.msg;
    if (r.ok && typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } }
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
