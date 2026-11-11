// js/items.js — 道具系統 v0(純邏輯,無 DOM;介面在 js/items_ui.js,卡包分頁的『道具』子頁)。
// 道具與貨幣分開:文 / 抽數 / 碎片是貨幣(頂列與抽卡頁),道具是要點開『使用』才生效的東西(新手禮包、任務令、活動券…)。
// 存檔:localStorage 'lorddomain.items.v1'(世界內進度鍵,SAVE_SLOT_KEYS;切換世界 / 回溯點時整組取代)= {v:1, n:{道具id:數量}, seen:{道具id:1 已查看}, notice:0|1 待顯示的新禮包提示(進遊戲 toast 一次), gv:已發放的新手禮包版本(itemGiftGrant 與禮包同一次寫入)}。
// 未知道具 id 讀入時保留(不刪),但不顯示、不計紅點。壞值 = 空背包。
// 新手禮包(v60):cardsGiftCheck 經 itemGiftGrant(ver) 發放(禮包 +1、gv 發放版本、notice 提示,同一次寫入,不會只寫到一半);使用(itemUse)才入大池 CARD_GIFT.pulls 抽。
// 紅點:禮包(dotUntilUsed)持有中一律紅點,直到使用為止;其他道具持有且未查看才紅點(開過選單即已查看)。
// 全域名稱:ITEMS ITEM_CATS ITEMS_KEY ITEMS_VER ITEMS_STACK_DEF ITEM_ORDER itemDef itemsNorm itemsRead itemsWrite itemsGet itemAdd itemUse itemCount itemList itemDot itemHasNew itemMarkSeen itemsNoticeSet itemsNoticeTake itemGiftGrant。ES2017;不用 ?. ??。

var ITEMS_KEY = 'lorddomain.items.v1';
var ITEMS_VER = 1;
var ITEMS_STACK_DEF = 99;   // 未設 max 的道具預設堆疊上限
var ITEM_CATS = [['gift', '禮包'], ['quest', '任務'], ['event', '活動'], ['misc', '雜項']];
// 道具資料表:cat 類別(ITEM_CATS)、max 堆疊上限、usable 可否使用、effect 使用效果型別(pulls 入大池抽數 / toast 占位提示)、color 稀有度顏色
var ITEMS = {
  gift_newbie: { id: 'gift_newbie', name: '新手禮包', cat: 'gift', desc: '內含大池 2000 抽。點『使用』後入大池,次數不受上限截斷。', max: 99, usable: true, effect: 'pulls', color: '#c39a2e', dotUntilUsed: true },
  quest_token: { id: 'quest_token', name: '任務令', cat: 'quest', desc: '任務用道具(占位,尚未接任務)。使用後消耗,目前只顯示提示。', max: 99, usable: true, effect: 'toast', color: '#3e8a74' },
  event_ticket: { id: 'event_ticket', name: '活動券', cat: 'event', desc: '活動用道具(占位,尚未接活動)。使用後消耗,目前只顯示提示。', max: 99, usable: true, effect: 'toast', color: '#76489a' }
};
var ITEM_ORDER = Object.keys(ITEMS);

function itemHas(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
// 道具定義(未知 id = null)
function itemDef(id) { return (typeof id === 'string' && itemHas(ITEMS, id)) ? ITEMS[id] : null; }
// 正規化(壞值 / 缺欄位 → 空背包;數量夾在 0..999999;未知 id 保留)
function itemsNorm(v) {
  var o = { v: ITEMS_VER, n: {}, seen: {}, notice: 0, gv: '' }, k, x;
  if (!v || typeof v !== 'object') return o;
  if (v.n && typeof v.n === 'object') {
    for (k in v.n) {
      if (!itemHas(v.n, k) || k.length > 40) continue;
      x = Math.floor(Number(v.n[k]));
      if (isFinite(x) && x > 0) o.n[k] = Math.min(999999, x);
    }
  }
  if (v.seen && typeof v.seen === 'object') {
    for (k in v.seen) if (itemHas(v.seen, k) && v.seen[k] && o.n[k]) o.seen[k] = 1;
  }
  if (v.notice) o.notice = 1;
  if (typeof v.gv === 'string' && v.gv.length <= 12) o.gv = v.gv;
  return o;
}
// 讀寫(localStorage 不可用 / 寫入失敗 → 不影響遊戲,只是不存)
function itemsRead() {
  var s = null;
  try { s = localStorage.getItem(ITEMS_KEY); } catch (e) { return itemsNorm(null); }
  if (!s) return itemsNorm(null);
  try { return itemsNorm(JSON.parse(s)); } catch (e2) { return itemsNorm(null); }
}
function itemsWrite(st) {
  try { localStorage.setItem(ITEMS_KEY, JSON.stringify(itemsNorm(st))); return true; } catch (e) { return false; }
}
function itemsGet() { return itemsRead(); }
function itemCount(id) { return itemsRead().n[id] | 0; }
// 加道具:回實際加入數(未知道具 / 超過堆疊上限的部分不加)。新加入的道具為未查看(紅點)
function itemAdd(id, n) {
  var d = itemDef(id), st, cur, add, cap;
  n = Math.floor(Number(n === undefined ? 1 : n));
  if (!d || !(n > 0)) return 0;
  st = itemsRead();
  cur = st.n[id] | 0;
  cap = d.max || ITEMS_STACK_DEF;
  add = Math.max(0, Math.min(n, cap - cur));
  if (add <= 0) return 0;
  st.n[id] = cur + add;
  delete st.seen[id];
  itemsWrite(st);
  return add;
}
// 使用道具:回 {ok, effect, msg}。成功才扣數量;效果在這裡執行(新手禮包 → 大池抽數,並把自動熔爐的『關』恢復預設)
function itemUse(id) {
  var d = itemDef(id), st, cs = null, msg;
  if (!d) return { ok: false, effect: '', msg: '未知的道具' };
  if (itemCount(id) < 1) return { ok: false, effect: d.effect, msg: '沒有這個道具' };
  if (!d.usable) return { ok: false, effect: d.effect, msg: '這個道具不能使用' };
  if (d.effect === 'pulls') {
    cs = (typeof cardsGet === 'function') ? cardsGet() : null;
    if (!cs) return { ok: false, effect: d.effect, msg: '尚無城邦資料' };
    cardsPullGrant(cs, CARD_GIFT.pulls, CARD_GIFT.pool);
    if (cs.bagAuto === -1) delete cs.bagAuto;   // 自動熔爐若為關(-1)改回預設(開,藍以下);使用者仍可在熔爐設定再關
    msg = '使用『' + d.name + '』,大池 +' + CARD_GIFT.pulls + ' 抽';
  } else if (d.effect === 'toast') {
    msg = '使用『' + d.name + '』(占位,效果尚未接上)';
  } else {
    return { ok: false, effect: d.effect, msg: '未知的效果' };
  }
  st = itemsRead();
  st.n[id] = (st.n[id] | 0) - 1;
  if (st.n[id] <= 0) { delete st.n[id]; delete st.seen[id]; } else st.seen[id] = 1;
  itemsWrite(st);
  if (cs && typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 存檔失敗不影響使用結果 */ } }
  return { ok: true, effect: d.effect, msg: msg };
}
// 清單:只列持有數 > 0 的已知道具(cat 省略 = 全部),依 ITEMS 宣告順序
function itemList(cat) {
  var st = itemsRead(), out = [], i, d;
  for (i = 0; i < ITEM_ORDER.length; i++) {
    d = ITEMS[ITEM_ORDER[i]];
    if (!(st.n[d.id] > 0) || (cat && d.cat !== cat)) continue;
    out.push({ id: d.id, name: d.name, cat: d.cat, desc: d.desc, max: d.max || ITEMS_STACK_DEF, usable: !!d.usable, effect: d.effect, color: d.color, n: st.n[d.id], seen: !!st.seen[d.id], dot: itemDot(d.id, st) });
  }
  return out;
}
// 單一道具是否顯示紅點(st 為 itemsRead 結果):禮包持有中一律紅點(直到使用);其他道具持有且未查看
function itemDot(id, st) {
  var d = itemDef(id);
  return !!d && st.n[id] > 0 && (!!d.dotUntilUsed || !st.seen[id]);
}
// 紅點:有任一道具符合 itemDot
function itemHasNew() {
  var st = itemsRead(), i;
  for (i = 0; i < ITEM_ORDER.length; i++) if (itemDot(ITEM_ORDER[i], st)) return true;
  return false;
}
// 標為已查看(點開道具選單時呼叫)。禮包不記已查看(紅點直到使用為止)。回是否有變更
function itemMarkSeen(id) {
  var st;
  if (!itemDef(id) || itemDef(id).dotUntilUsed) return false;
  st = itemsRead();
  if (!(st.n[id] > 0) || st.seen[id]) return false;
  st.seen[id] = 1;
  return itemsWrite(st);
}
// 進遊戲一次性提示旗標(新禮包發放時設,itemsSyncDots 顯示 toast 後清除)
function itemsNoticeSet(on) { var st = itemsRead(); st.notice = on ? 1 : 0; return itemsWrite(st); }
function itemsNoticeTake() {
  var st = itemsRead();
  if (!st.notice) return false;
  st.notice = 0;
  itemsWrite(st);
  return true;
}
// 新手禮包發放(原子):同一次 localStorage 寫入內加 1 個禮包、記下發放版本 gv、設進遊戲提示 notice。
// 回 1 = 本次發出;0 = 此版本已發過(gv 已等於 ver,不重發);-1 = 寫入失敗(未發,呼叫端不設旗標,下次再試)
function itemGiftGrant(ver) {
  var st, d = ITEMS.gift_newbie;
  if (!ver) return -1;
  st = itemsRead();
  if (st.gv === ver) return 0;
  st.n.gift_newbie = Math.min(d.max || ITEMS_STACK_DEF, (st.n.gift_newbie | 0) + 1);
  st.gv = ver;
  st.notice = 1;
  return itemsWrite(st) ? 1 : -1;
}
