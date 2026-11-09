// js/bldtag.js — 點建築的「名稱標籤」與「可進入標記」。
// 標籤 #bldTag:瀏覽模式輕點建築 → 建築頭上顯示名稱(魔幻世界用 fxObjName);有室內空間者加「🚪 可進入」與〔進入〕鈕,點鈕才進室內(避免誤入)。
//   同一時間只顯示一個;再點同一棟 / 點別棟 / 點空地或居民 / 開大面板(body.panel-cover)/ 進入放置(body.ui-placing)/ 離開經營板 → 消失。
//   沒有室內的建築:仍走 ui.js tapObjectAt 原行為(人事提示、高亮;城主府 / 考場 / 熔爐 / 研究院等開面板者不顯示標籤、照舊開面板)。
// 可進入標記:偏好 lorddomain.ui.doorMarks('0' = 關,預設開);縮放 ≥ BT.minZoom、非省電、非放置、非拍照、無大面板時,可進入建築頭上畫小門 🚪(彼此不重疊)。
// 可進入清單不手寫:由室內掛點的對照表即時取得 —— interiors_pack1_data.js IP_BLD、interiors_pack2_data.js IP2_BLD(需場景定義成功)、酒館 tavern(tavern_scene.js tavernSceneEnter)。
// 掛點:ui.js tapObjectAt 呼叫 bldTagTake / bldTagTap;ui.js draftFloatSync(每幀)呼叫 bldTagSync;render.js 每幀呼叫 bldDoorDraw。外部全域一律 typeof 守衛。ES2017;不用 ?. ??。
// 全域名稱:BT bldEnterable bldEnterTypes bldName bldTagShow bldTagHide bldTagTake bldTagTap bldTagCur bldTagSync bldTagEnter bldDoorOn bldDoorSet bldDoorDraw bldDoorList

var BT = { key: 'lorddomain.ui.doorMarks', minZoom: 0.5, el: null, o: null, sig: '', door: null, doors: [] };

// ───── 可進入判定(與 tapObjectAt 的室內掛點同一份對照表) ─────
function bldEnterable(type) {
  var m;
  if (!type) return false;
  if (typeof IP_BLD !== 'undefined' && (m = IP_BLD[type]) && typeof interiorPackDef === 'function') { try { if (interiorPackDef(m.id)) return true; } catch (e) { /* 場景定義失敗 = 不可進入 */ } }
  if (typeof IP2_BLD !== 'undefined' && (m = IP2_BLD[type]) && typeof ip2Ready !== 'undefined' && ip2Ready && typeof interiorPackDef === 'function') { try { if (interiorPackDef(m.id)) return true; } catch (e2) { /* 同上 */ } }
  if (type === 'tavern' && typeof tavernSceneEnter === 'function') return true;
  return false;
}
// 目前可進入的建築 type 清單(只列 OBJECTS 有的;排序固定)
function bldEnterTypes() {
  var ids = [], add = function (k) {
    if (ids.indexOf(k) >= 0 || typeof OBJECTS === 'undefined' || !OBJECTS[k] || !bldEnterable(k)) return;
    if (typeof fxHiddenObj === 'function' && fxHiddenObj(k)) return;   // 魔幻世界:本族看不到的漢式件不列
    ids.push(k);
  };
  if (typeof IP_BLD !== 'undefined') Object.keys(IP_BLD).forEach(add);
  if (typeof IP2_BLD !== 'undefined') Object.keys(IP2_BLD).forEach(add);
  add('tavern');
  return ids;
}
function bldName(type) {
  var v = null;
  if (typeof fxPack === 'function' && typeof fxObjName === 'function' && fxPack()) v = fxObjName(type);
  if (v) return v;
  return (typeof OBJECTS !== 'undefined' && OBJECTS[type]) ? OBJECTS[type].name : String(type);
}
// 點了會開自己面板的建築(城主府 / 考場 / 殿試台 / 熔爐 / 研究院):不顯示標籤,照舊開面板
function bldTagPass(type) {
  if (typeof LH_TYPE !== 'undefined' && type === LH_TYPE) return true;
  if (typeof CU_TYPE_TAB !== 'undefined' && CU_TYPE_TAB[type]) return true;
  if (type === 'furnace_card') return true;
  if (typeof LAB_TYPE !== 'undefined' && type === LAB_TYPE) return true;
  return false;
}

// ───── 標籤 ─────
function bldTagEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function bldTagEl() {
  var el;
  if (BT.el) return BT.el;
  if (typeof document === 'undefined' || !document.body) return null;
  el = document.createElement('div');
  el.id = 'bldTag';
  el.hidden = true;
  el.addEventListener('pointerdown', function (e) { if (e.stopPropagation) e.stopPropagation(); });
  el.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (b && b.getAttribute('data-bt') === 'enter') bldTagEnter();
  });
  document.body.appendChild(el);
  BT.el = el;
  return el;
}
function bldTagCur() { return BT.o; }
function bldTagShow(o) {
  var el = bldTagEl(), ent, html;
  if (!el || !o) return false;
  ent = bldEnterable(o.type);
  BT.o = o;
  html = '<div class="bt-row"><b class="bt-nm">' + bldTagEsc(bldName(o.type)) + '</b>' + (ent ? '<span class="bt-door">🚪 可進入</span>' : '') + '</div>' +
    (ent ? '<button type="button" class="bt-go" data-bt="enter">進入</button>' : '');
  el.innerHTML = html;
  el.classList.toggle('bt-ent', ent);
  el.hidden = false;
  BT.sig = '';
  bldTagSync();
  return true;
}
function bldTagHide() {
  BT.o = null;
  BT.sig = '';
  if (BT.el && !BT.el.hidden) BT.el.hidden = true;
}
// 收起並回傳先前顯示的建築(tapObjectAt 開頭呼叫;再點同一棟 = 關閉)
function bldTagTake() { var o = BT.o; bldTagHide(); return o; }
// tapObjectAt 掛點:回 true = 已處理(不再走原行為);回 false = 繼續原行為
function bldTagTap(o, prev) {
  if (!o) return false;
  if (prev === o) return true;                       // 再點同一棟:標籤消失,不做別的
  if (bldEnterable(o.type)) {                        // 有室內:第一下只顯示標籤 + 〔進入〕
    bldTagShow(o);
    if (typeof fxMark === 'function') fxMark(o, 'tap');
    return true;
  }
  if (bldTagPass(o.type)) return false;              // 開面板的建築:照舊
  bldTagShow(o);                                     // 一般建築:顯示名稱,其餘原行為照舊
  return false;
}
function bldTagEnter() {
  var o = BT.o;
  bldTagHide();
  if (!o || typeof world === 'undefined' || !world || world.objects.indexOf(o) < 0) return false;
  if (typeof interiorPackTap === 'function' && interiorPackTap(o)) return true;
  if (typeof interiorPack2Tap === 'function' && interiorPack2Tap(o)) return true;
  if (typeof cardsUiTap === 'function' && cardsUiTap(o)) return true;
  return false;
}
// 建築頭頂的螢幕座標(粗估屋頂高度:依佔地放大)
function bldTopScreen(o) {
  var fp, h, c, t, s;
  if (typeof footprint !== 'function' || typeof gpt !== 'function' || typeof worldToScreen !== 'function') return null;
  fp = footprint(o.type, o.rot);
  h = (world.height[idx(o.x, o.y)] || 0) * HL;
  c = gpt(o.x + fp[0] / 2, o.y + fp[1] / 2, h);
  t = gpt(o.x, o.y, h);
  s = worldToScreen(c[0], t[1] - (14 + 9 * Math.max(fp[0], fp[1])));
  return s;
}
function bldTagBlocked() {
  var b = typeof document !== 'undefined' ? document.body : null;
  if (typeof game === 'undefined' || !game || game.mode !== 'estate') return true;
  if (typeof uiIsPhoto === 'function' && uiIsPhoto()) return true;
  if (typeof pano !== 'undefined' && pano && pano.open) return true;
  if (b && b.classList && (b.classList.contains('panel-cover') || b.classList.contains('ui-placing') || b.classList.contains('panel-fs') || b.classList.contains('in-interior'))) return true;
  return false;
}
// 每幀:跟著建築移動;不該顯示(面板 / 放置 / 建築已不在)就收起
function bldTagSync() {
  var o = BT.o, el = BT.el, p, vw, vh, w, hh, x, y, sig;
  if (!o || !el) return;
  if (bldTagBlocked() || typeof world === 'undefined' || world.objects.indexOf(o) < 0) { bldTagHide(); return; }
  p = bldTopScreen(o);
  if (!p) return;
  vw = (typeof viewport !== 'undefined' && viewport.w) || window.innerWidth || 0;
  vh = (typeof viewport !== 'undefined' && viewport.h) || window.innerHeight || 0;
  sig = Math.round(p[0]) + ',' + Math.round(p[1]) + ',' + vw + ',' + vh;
  if (sig === BT.sig) return;
  BT.sig = sig;
  w = el.offsetWidth || 120; hh = el.offsetHeight || 40;
  x = Math.max(4, Math.min(vw - w - 4, p[0] - w / 2));
  y = Math.max(40, Math.min(vh - hh - 4, p[1] - hh - 4));
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
}

// ───── 可進入標記(小門) ─────
function bldDoorOn() {
  var v = null;
  try { v = typeof uiStorageGet === 'function' ? uiStorageGet(BT.key) : localStorage.getItem(BT.key); } catch (e) { v = null; }
  return v !== '0';
}
function bldDoorSet(on) {
  try { if (typeof uiStorageSet === 'function') uiStorageSet(BT.key, on ? '1' : '0'); else localStorage.setItem(BT.key, on ? '1' : '0'); } catch (e) { /* 偏好存不了不影響遊戲 */ }
}
// 本幀要畫的門標記(螢幕座標;已去重疊)。純計算,測試可直接呼叫
function bldDoorList() {
  var out = [], vw, vh, cache = {}, i, o, p, r, j, hit, R = 11;
  if (!bldDoorOn() || bldTagBlocked()) return out;
  if (typeof view === 'undefined' || !view || view.zoom < BT.minZoom) return out;
  if (typeof isPowerSave === 'function' && isPowerSave()) return out;
  if (typeof hide !== 'undefined' && hide && hide.on) return out;
  if (typeof world === 'undefined' || !world || !world.objects) return out;
  vw = (typeof viewport !== 'undefined' && viewport.w) || 0; vh = (typeof viewport !== 'undefined' && viewport.h) || 0;
  for (i = 0; i < world.objects.length; i++) {
    o = world.objects[i];
    if (o === BT.o) continue;                          // 已顯示標籤者不重複畫門
    if (cache[o.type] === undefined) cache[o.type] = bldEnterable(o.type);
    if (!cache[o.type]) continue;
    p = bldTopScreen(o);
    if (!p || p[0] < -R || p[1] < -R || p[0] > vw + R || p[1] > vh + R) continue;
    r = { x: p[0], y: p[1] };
    hit = false;
    for (j = 0; j < out.length; j++) if (Math.abs(out[j].x - r.x) < R * 2 && Math.abs(out[j].y - r.y) < R * 2) { hit = true; break; }
    if (!hit) out.push(r);
  }
  return out;
}
// render.js 每幀(螢幕座標)呼叫
function bldDoorDraw(ctx) {
  var list = bldDoorList(), i, d;
  BT.doors = list;
  if (!list.length || !ctx) return;
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (i = 0; i < list.length; i++) {
    d = list[i];
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(20,26,36,.82)';
    ctx.strokeStyle = '#f0b45a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText('🚪', d.x, d.y + 1);
  }
  ctx.restore();
}
