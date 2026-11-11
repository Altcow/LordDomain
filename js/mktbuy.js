// js/mktbuy.js — 市集收購指定貨品:缺材料(建築材料成本 bmc.js、庫房工坊缺料)時,可到市集用金幣收購缺的貨品。
// 規則(全部 PLACEHOLDER,數值平衡最後統一做):
//   · 要有市集建築(場上至少 1 座 market)
//   · 單價 = 貨品基價 ×1.5(買貴賣便宜:溢出自動賣是基價 ×0.6,來回只會虧,不能洗錢);小數以 world.city.coinFrac 累計
//   · 每貨每日上限(依階別):T0 原料 40、T1 20、T2 10、T3 6;T4 醇酒與以上不收購。依本機日期換日,存在 world.city.mkt
//   · 可收購:T0~T3 的木 / 石 / 糧 / 麻 / 鐵礦 / 絲 / 生漆與 T1~T3 加工品;不可:legacy(獎勵專屬)、later(尚無來源)、魔幻特色貨品(pack)
//   · 買進入庫存有容量上限(goodsCapOf);已滿或不足以整批時只收得下的部分;木 / 石無上限
//   · 不接自動調度(goods auto 偏好)
// 介面:mktBuyInfo(id, n) → { id, name, n, can, left, room, unit, total, coin, ok, why };mktBuy(id, n) → { ok, n, paid, why };mktBuyUi(id, n, done) 彈確認(缺口 / 單價 / 總價 / 確認)。
// 外部全域一律 typeof 守衛;ES2017;不用 ?. ??

var MKT_BUY_MUL = 1.5;
var MKT_BUY_DAILY = [40, 20, 10, 6];   // 依貨品階別 T0~T3 的每日每貨上限;T4 以上不收購
var MKT_WHY = { nomarket: '要先蓋「市集」才能收購', no: '市集不收購這種貨品', daily: '今天這種貨品的收購額度用完了', full: '庫房這種貨品已滿', coin: '金幣不足', world: '目前不能收購' };

function mktDayKey() { try { return typeof todayKey === 'function' ? todayKey() : new Date().toISOString().slice(0, 10); } catch (e) { return ''; } }
// 讀檔正規化(goods.js goodsNormCity 呼叫):{ day, n:{ 貨品id: 今日已收購數 } };壞值丟棄
function mktNormSave(v) {
  var out = { day: '', n: {} }, k;
  if (!v || typeof v !== 'object' || typeof v.day !== 'string') return null;
  out.day = v.day;
  if (v.n && typeof v.n === 'object') for (k in v.n) if (typeof GOODS !== 'undefined' && GOODS[k] && typeof v.n[k] === 'number' && isFinite(v.n[k]) && v.n[k] > 0) out.n[k] = Math.floor(v.n[k]);
  return out;
}
function mktState() {   // 取得今日狀態(換日就歸零);無城市資料回 null
  var c = typeof goodsCity === 'function' ? goodsCity() : null, day = mktDayKey();
  if (!c) return null;
  if (!c.mkt || c.mkt.day !== day) c.mkt = { day: day, n: {} };
  return c.mkt;
}
function mktHasMarket() {
  var i;
  if (typeof world === 'undefined' || !world || !world.objects) return false;
  for (i = 0; i < world.objects.length; i++) if (world.objects[i] && world.objects[i].type === 'market') return true;
  return false;
}
// 這種貨品市集收不收
function mktBuyable(id) {
  var g = typeof GOODS !== 'undefined' ? GOODS[id] : null;
  if (!g || g.legacy || g.later || g.pack) return false;
  if (typeof goodsAvail === 'function' && !goodsAvail(id)) return false;
  return g.tier >= 0 && g.tier < MKT_BUY_DAILY.length;
}
function mktDailyLimit(id) { return mktBuyable(id) ? MKT_BUY_DAILY[GOODS[id].tier] : 0; }
function mktUsed(id) { var s = mktState(); return s ? (s.n[id] || 0) : 0; }
function mktUnit(id) { return typeof goodsPrice === 'function' ? goodsPrice(id) * MKT_BUY_MUL : 0; }

// 買 n 件的整數金幣價(含小數):回傳 { whole, frac }
function mktCost(id, n) {
  var tot = mktUnit(id) * n, whole = Math.floor(tot + 1e-9);
  return { whole: whole, frac: Math.max(0, tot - whole) };
}
// 以目前 coinFrac 實際要付的整數金幣(小數部分先欠,累計滿 1 才多付)
function mktPay(id, n) {
  var c = typeof goodsCity === 'function' ? goodsCity() : null, k = mktCost(id, n), cf = c ? (c.coinFrac || 0) : 0, left = cf - k.frac, pay = k.whole;
  if (left < -1e-9) { pay += 1; left += 1; }
  return { pay: pay, coinFrac: Math.max(0, Math.min(0.9999, left)) };
}

function mktBuyInfo(id, n) {
  var out = { id: id, name: typeof goodsName === 'function' ? goodsName(id) : id, n: 0, can: 0, left: 0, room: 0, unit: 0, total: 0, coin: 0, ok: false, why: '' }, st, used, lim, have, cap, p;
  n = Math.max(1, Math.floor(+n || 1));
  out.n = n;
  if (typeof world === 'undefined' || !world || !world.res || typeof goodsCity !== 'function' || !goodsCity()) { out.why = 'world'; return out; }
  out.coin = Math.floor(world.res.coin || 0);
  if (!mktBuyable(id)) { out.why = 'no'; return out; }
  out.unit = mktUnit(id);
  if (!mktHasMarket()) { out.why = 'nomarket'; return out; }
  st = mktState();
  used = st ? (st.n[id] || 0) : 0;
  lim = mktDailyLimit(id);
  out.left = Math.max(0, lim - used);
  have = typeof cityGoodsHave === 'function' ? cityGoodsHave(id) : 0;
  cap = typeof goodsCapOf === 'function' ? goodsCapOf(id) : Infinity;
  out.room = cap === Infinity ? Infinity : Math.max(0, Math.floor(cap - have));
  out.can = Math.min(n, out.left, out.room);
  if (out.can <= 0) { out.why = out.left <= 0 ? 'daily' : 'full'; return out; }
  p = mktPay(id, out.can);
  out.total = p.pay;
  if (out.coin < p.pay) { out.why = 'coin'; return out; }
  out.ok = true;
  return out;
}

// 收購:n 超過額度 / 容量時只收得下的部分(至少 1 件才成交)。成功入庫、扣金幣、記今日用量
function mktBuy(id, n) {
  if (!featureOn('citysim')) return { ok: false, n: 0, paid: 0, why: 'dormant' };   // @DORMANT citysim
  var info = mktBuyInfo(id, n), p, c, st;
  if (!info.ok) return { ok: false, n: 0, paid: 0, why: info.why };
  p = mktPay(id, info.can);
  c = goodsCity();
  st = mktState();
  world.res.coin = (world.res.coin || 0) - p.pay;
  c.coinFrac = p.coinFrac;
  cityGoodsAdd(id, info.can);
  st.n[id] = (st.n[id] || 0) + info.can;
  if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 存檔失敗不影響成交 */ } }
  return { ok: true, n: info.can, paid: p.pay, why: '' };
}

function mktToast(m) { if (typeof showToast === 'function') showToast(m); }
// 確認視窗:缺口 / 可收購 / 單價 / 總價 → 確認後成交。done(result) 成交後呼叫
function mktBuyUi(id, n, done) {
  if (!featureOn('citysim')) return false;   // @DORMANT citysim
  var info = mktBuyInfo(id, n), msg, run;
  if (!info.can) { mktToast(MKT_WHY[info.why] || '無法收購'); return false; }
  msg = '缺口 ' + info.n + ' 件' + (info.can < info.n ? '(今日只能再收購 ' + info.can + ' 件)' : '') + '　單價 🪙' + (Math.round(info.unit * 100) / 100) + '　總價 🪙' + info.total +
    '　(現有金幣 ' + info.coin + ',今日還可收購 ' + info.left + ' 件)' + (info.why === 'coin' ? '　金幣不足' : '');
  run = function () {
    var r = mktBuy(id, info.can);
    if (r.ok) mktToast('已收購 ' + info.name + ' ×' + r.n + ',花費 🪙' + r.paid); else mktToast(MKT_WHY[r.why] || '無法收購');
    if (done) done(r);
  };
  if (info.why === 'coin') { mktToast('金幣不足:收購 ' + info.name + ' ×' + info.can + ' 要 🪙' + info.total); return false; }
  if (typeof ldConfirm === 'function') ldConfirm('市集收購 ' + info.name, msg, '確認收購', run);
  else if (typeof confirm === 'function' && confirm('市集收購 ' + info.name + '\n' + msg)) run();
  return true;
}
