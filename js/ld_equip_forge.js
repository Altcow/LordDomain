// js/ld_equip_forge.js — 鍛造(只有武器、防具;設計_裝備與尋訪_定案.md 第三節、任務卡 4)。前綴 forge。純邏輯,無 DOM。
// 配方讀 mat.js 的 MAT_RECIPE、文用 world.res.coin(res4.js);成功率 白 100 / 藍 85 / 紫 65 / 金 50;失敗損一半主材(向下取整)+ 半價文,其他材料照扣;
// 同品質連敗 20 次,第 21 次必成(計數分品質、成功歸零、存在 gear.v1 的 fail)。先把扣材料 / 計數器寫進存檔再回傳,重整不重抽。
// 全域:forgeOpen forgeCost forgeCan forgeDo forgeFails forgeRate。ES2017;不用 ?. ??。

function forgeOpen() {
  var fame = (typeof fameGet === 'function') ? fameGet() : 0, any = false, k, n;
  if (typeof unlockOn === 'function' && unlockOn() && typeof unlockIs === 'function') return !!unlockIs('forge');   // ld_open_unlock.js 的開放表(名聲 500 或第一份材料)
  if (fame >= GEAR_CFG.forge.openFame) return true;
  if (typeof matAll === 'function') { n = matAll(); for (k in n) if (Object.prototype.hasOwnProperty.call(n, k) && k !== 'm_whet' && n[k] > 0) any = true; }
  return any;   // 第一次拿到鍛造材料
}
function forgeRate(q) { return GEAR_CFG.forge.rate[q] || 0; }
function forgeFails(q) { return gearRead().fail[q] | 0; }
// 本次花費 {mats:{id:n}, coin, main:{id,n}};kind = wpn | arm
function forgeCost(kind, q, soul) {
  var rec, mats, k, m;
  if (typeof MAT_RECIPE === 'undefined' || !MAT_RECIPE[q]) return null;
  rec = MAT_RECIPE[q];
  mats = {};
  for (k in rec[kind === 'wpn' ? 'weapon' : 'armor']) mats[k] = rec[kind === 'wpn' ? 'weapon' : 'armor'][k];
  for (k in rec.common) mats[k] = (mats[k] || 0) + rec.common[k];
  if (soul && q === 3) mats.m_soul = 1;
  m = gearMainMatN({ slot: kind, q: q });
  return { mats: mats, coin: rec.coin, main: m };
}
// 檢查(不扣):{ok, reason?, lack:{id:缺幾個}, coinLack}
function forgeCan(kind, q, soul) {
  var c = forgeCost(kind, q, soul), st, lack = {}, k, have = 0, coinLack = 0;
  if (!c) return { ok: false, reason: 'bad' };
  st = (typeof matAll === 'function') ? matAll() : {};
  for (k in c.mats) if ((st[k] | 0) < c.mats[k]) lack[k] = c.mats[k] - (st[k] | 0);
  have = (typeof res4Get === 'function') ? res4Get('coin') : 0;
  if (have < c.coin) coinLack = c.coin - have;
  if (Object.keys(lack).length) return { ok: false, reason: 'mat', lack: lack, coinLack: coinLack };
  if (coinLack) return { ok: false, reason: 'coin', lack: lack, coinLack: coinLack };
  return { ok: true, lack: lack, coinLack: 0 };
}
// 鍛造一次。reason:bad 參數 / closed 未開放(opt.ignoreOpen 略過)/ mat 材料不足 / coin 文不足 — 這三種都整筆不扣
// 回 {ok, success, pity(保底觸發), item(入庫結果 gearAdd), cost, lost:{mats, coin}, fails(之後的連敗數)}
function forgeDo(kind, type, q, soul, opt) {
  var C = GEAR_CFG, st, can, cost, r, success, pity, made, add = null, lostMain = 0, lostCoin = 0, refund = {}, gotCoin = 0;
  opt = opt || {};
  if (C.forge.kinds.indexOf(kind) < 0 || C.typesOf[kind].indexOf(type) < 0 || q !== (q | 0) || q < 0 || q > 3) return { ok: false, reason: 'bad' };
  soul = !!soul && q === 3;
  if (!opt.ignoreOpen && !forgeOpen()) return { ok: false, reason: 'closed' };
  can = forgeCan(kind, q, soul);
  if (!can.ok) return { ok: false, reason: can.reason, lack: can.lack, coinLack: can.coinLack };
  cost = forgeCost(kind, q, soul);
  st = gearRead();
  r = gearRng(st, 'forge');
  pity = (st.fail[q] | 0) >= C.forge.pity;
  success = pity || r() < forgeRate(q);
  if (!matSpend(cost.mats) || !res4Spend({ coin: cost.coin })) return { ok: false, reason: 'mat' };
  if (success) {
    st.fail[q] = 0;
    made = gearMake(kind, q, type, r, soul);
    gearWrite(st);
    add = gearAdd(made);
  } else {
    st.fail[q] = (st.fail[q] | 0) + 1;
    lostMain = Math.floor(cost.main.n / 2);
    lostCoin = Math.floor(cost.coin / 2);
    refund[cost.main.id] = cost.main.n - lostMain;
    gotCoin = cost.coin - lostCoin;
    gearWrite(st);
    if (refund[cost.main.id] > 0) matGrant(refund);
    if (gotCoin > 0) res4Add({ coin: gotCoin });
  }
  return { ok: true, success: success, pity: pity && success, item: add, cost: cost, lost: success ? { mats: cost.mats, coin: cost.coin } : { mats: (function () { var o = {}, k; for (k in cost.mats) o[k] = cost.mats[k]; o[cost.main.id] = lostMain; return o; })(), coin: lostCoin }, fails: st.fail[q] | 0 };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { forgeDo: forgeDo };
