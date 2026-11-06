// js/traffic_sprites.js — 『城鎮交通』外部圖(assets/traffic/ 12 張)掛到街景交通:平時在城裡道路上走動的馬、客篷車、獨輪車、牛板車、驢馱貨、雙馬貨車。
// 純視覺:車仍是 citytraffic.js 的街景角色(wagon / rider,n.ext = true),走路 / 掉頭 / 入口離場 / 停靠全沿用 citylife.js 的道路圖;本檔只決定「這輛車是哪種車」「畫哪張圖」。
// 掛點:citylife.js lifeDrawOne(開頭)→ trafficSpriteDraw;lifeDrawDiag → trafficHidden。citytraffic.js:lifeXTargets → trafficTargetsClamp、lifeTrafficBuild → trafficBuildZones、
//   lifeTrafficReset → trafficReset、lifeXSpawnWagon → trafficWagonPick、tick 的 wagon / rider 生成 → trafficSeeded、生成後 n.tv = trafficMake(kind)。全部 typeof 守衛。
// 視角:圖有 SE(車頭朝右下 = 世界 +x)與 NE(車頭朝右上 = 世界 -y)兩張;朝左下(+y)= SE 水平鏡像、朝左上(-x)= NE 水平鏡像。
//   ※ 獨輪車兩張圖的車把都朝上方(SE 圖車把在左上、NE 圖車把在右上),車頭實際是:SE 圖朝右下、NE 圖朝左下。故獨輪車四向改用:+x、-x 用 SE 圖,+y、-y 用 NE 圖,皆不鏡像
//   (往下走 = 推著走,往上走 = 車把在前拉著走),見 TRS_KINDS.wheelbarrow.swap。
// 缺圖 / 載入失敗 / 烘焙例外 → trafficSpriteDraw 回 false,citylife 沿用原本的程式繪製車馬(chibi 外觀),不報錯。
// 尺寸:每種車依視覺佔地 fp(格)縮放,寬 = (fw + fd) × 32 × TRS_FILL,錨點 = 腳底中心(圖寬 50%、圖高 TRS_AY)。烘焙成 ART.cache 的 'chibi|trv_*' 鍵並登記 LIFE.variantIds → 計入 LIFE_SPR_BUDGET(18MB)。
// 數量:wagon + rider 合計上限(組)= 高 / 滿 6、一般 4、少 2,低階機 / 省電最多 2,再乘 lifeStreetMul;夜間減半。縮放 < 0.5 / 拍照 / 錄影不畫(車照常走)。
// 確定性:wagon / rider 的生成決策(車型、入口、出口、停靠點)在 trafficSeeded 內改用種子亂數,種子 = hash(世界, 道路簽章, 日號, 時段, 流水號)。
// 繪製不配置:每種車 × 視角有固定 slot,快取命中免組字串;每幀只做數值運算與 rq* 呼叫。ES2017;不用 ?. ??
var TRS_DIR = 'assets/traffic/';
var TRS_FILL = 0.9;     // 圖寬 = 視覺佔地菱形寬 × 此比例
var TRS_AY = 0.9;       // 錨點(腳底)在圖高的比例
var TRS_FLOOR = 3;   // 小城保底車馬數(受 trafficCap 約束,夜間 / 低階 / 省電隨 cap 下降)
var TRS_CAP = { off: 0, low: 2, mid: 4, high: 6, crowd: 6 };   // 街景車馬(組)上限,依有效密度
var TRS_KINDS = {
  horse:       { fp: [1, 1], rw: 96,  name: '馬' },
  carriage:    { fp: [1, 2], rw: 142, name: '馬拉客篷車' },
  wheelbarrow: { fp: [1, 1], rw: 110, name: '獨輪車', swap: true },
  oxcart:      { fp: [1, 2], rw: 136, name: '牛拉板車' },
  donkey:      { fp: [1, 1], rw: 89,  name: '驢馱貨' },
  wagon:       { fp: [2, 2], rw: 155, name: '雙馬大貨車' }
};
// 地點類別 → 車型(靠近該類建築出現;一般道路則是客篷車 / 獨輪車)
var TRS_ZONE_KIND = { wood: 'oxcart', market: 'donkey', depot: 'wagon' };
var TRS_ZONE_MAX = 24;
var TRS_ZONE_TYPES = {
  wood: { lumber: 1, deco_lumberyard: 1, woodpile: 1, sawbench: 1, lograft: 1, quarry: 1, mine_entrance: 1 },   // 伐木場 / 採石場 / 木料倉
  depot: { warehouse_port: 1, post_station: 1, dock: 1, wharf_platform: 1, crane_pole: 1, granary_round: 1 }    // 庫房 / 驛站 / 碼頭
};

var TRS = { on: true, imgs: {}, slots: {}, ser: { wagon: 0, rider: 0 }, att: { wagon: 0, rider: 0 }, bakes: 0, draws: 0, loadAll: false };

(function () {   // 每種車 × 兩視角的固定 slot 與縮放
  var k, K, f;
  for (k in TRS_KINDS) {
    K = TRS_KINDS[k];
    K.s = (K.fp[0] + K.fp[1]) * 32 * TRS_FILL / K.rw;
    TRS.slots[k] = {};
    for (f = 0; f < 2; f++) {
      var file = f === 0 ? 'SE' : 'NE';
      TRS.slots[k][file] = { url: TRS_DIR + 'tr_' + k + '_' + file + '.webp', res: 0, tod: '', key: '', spr: null };
    }
  }
})();

// ───────── 視角 ─────────
// 世界移動方向 → 螢幕斜向:+x = SE(右下)、+y = SW(左下)、-x = NW(左上)、-y = NE(右上);取主軸(車走格中心線,幾乎永遠軸向)
function trafficDirOf(fx, fy) {
  if (Math.abs(fx) >= Math.abs(fy)) return fx >= 0 ? 'SE' : 'NW';
  return fy >= 0 ? 'SW' : 'NE';
}
// 回傳 { file: 'SE' | 'NE', flip: bool }(純函式,可測)
function trafficView(kind, dir) {
  var K = TRS_KINDS[kind];
  if (K && K.swap) return { file: (dir === 'SE' || dir === 'NW') ? 'SE' : 'NE', flip: false };
  if (dir === 'SE') return { file: 'SE', flip: false };
  if (dir === 'NE') return { file: 'NE', flip: false };
  if (dir === 'SW') return { file: 'SE', flip: true };
  return { file: 'NE', flip: true };
}

// ───────── 載入 ─────────
// 圖載入狀態:'ok' / 'loading' / 'fail';第一次呼叫才建立 Image(執行期載入,不進預快取)
function trafficImgState(url) {
  var rec = TRS.imgs[url], img;
  if (rec) return rec.state;
  rec = TRS.imgs[url] = { img: null, state: 'loading' };
  try {
    if (typeof Image === 'undefined') { rec.state = 'fail'; return rec.state; }
    img = new Image();
    img.onload = function () { rec.state = (img.naturalWidth || img.width) > 0 ? 'ok' : 'fail'; };
    img.onerror = function () { rec.state = 'fail'; };
    rec.img = img;
    img.src = url;
  } catch (e) { rec.state = 'fail'; }
  return rec.state;
}
function trafficPreload() {
  var k, f;
  if (TRS.loadAll) return;
  TRS.loadAll = true;
  for (k in TRS.slots) for (f in TRS.slots[k]) trafficImgState(TRS.slots[k][f].url);
}
function trafficSpritesOn() { return TRS.on; }
function trafficSetOn(v) { TRS.on = !!v; }
// 某車型兩張圖都載入成功
function trafficKindReady(kind) {
  var S = TRS.slots[kind];
  return !!S && trafficImgState(S.SE.url) === 'ok' && trafficImgState(S.NE.url) === 'ok';
}

// ───────── 隱藏閘門 ─────────
function trafficHidden() {
  if (typeof LIFE !== 'undefined' && LIFE.small) return true;   // 縮放 < 0.5
  if (typeof uiIsPhoto === 'function' && uiIsPhoto()) return true;
  if (typeof REC !== 'undefined' && REC && (REC.state === 'recording' || REC.state === 'countdown' || REC.state === 'plan')) return true;
  return false;
}

// ───────── 烘焙與繪製 ─────────
function trafficMk(w, h) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
// 烘焙一張(視角 × 解析度 × 時段):縮放到佔地大小、時段乘色、腳下柔影;存入 ART.cache(key 'chibi|trv_<kind>_<file>|<tod>|<res>')
function trafficBake(kind, file, res, tod, slot, tint) {
  var A = ART, K = TRS_KINDS[kind], img = TRS.imgs[slot.url] && TRS.imgs[slot.url].img, iw, ih, w, h, pad = 5, cw, ch, body, bx, tmp, tc, out, ox, td, c, key, id;
  if (!img) return null;
  iw = img.naturalWidth || img.width; ih = img.naturalHeight || img.height;
  w = iw * K.s; h = ih * K.s;
  cw = Math.ceil((w + pad * 2) * res); ch = Math.ceil((h + pad * 2) * res);
  td = A.todOf({ tod: tod });
  body = trafficMk(cw, ch); bx = body.getContext('2d');
  bx.imageSmoothingEnabled = true;
  bx.drawImage(img, pad * res, pad * res, w * res, h * res);
  if (td && td.mul) {
    tmp = trafficMk(cw, ch); tc = tmp.getContext('2d');
    tc.drawImage(body, 0, 0); tc.globalCompositeOperation = 'multiply'; tc.fillStyle = td.mul; tc.fillRect(0, 0, cw, ch);
    tc.globalCompositeOperation = 'destination-in'; tc.drawImage(body, 0, 0); tc.globalCompositeOperation = 'source-over';
    body = tmp;
  }
  if (tint) { tmp = trafficMk(cw, ch); tc = tmp.getContext('2d'); tc.drawImage(body, 0, 0); tc.globalCompositeOperation = 'source-atop'; tc.globalAlpha = 0.22; tc.fillStyle = tint; tc.fillRect(0, 0, cw, ch); tc.globalAlpha = 1; tc.globalCompositeOperation = 'source-over'; body = tmp; }   // 染色(caravan_vis 車隊依品階上色;只染有像素處)
  out = trafficMk(cw, ch); ox = out.getContext('2d');
  ox.fillStyle = 'rgba(30,40,20,' + (0.24 * (td && td.shadow !== undefined ? td.shadow : 1)).toFixed(3) + ')';
  ox.beginPath();
  ox.ellipse((pad + w / 2) * res, (pad + h * TRS_AY) * res, w * 0.36 * res, Math.max(3, w * 0.09) * res, 0, 0, Math.PI * 2);
  ox.fill();
  ox.drawImage(body, 0, 0);
  id = 'trv_' + kind + '_' + file + (tint ? '_' + tint.slice(1) : '');
  key = 'chibi|' + id + '|' + tod + '|' + res;
  c = { cv: out, l: -w / 2 - pad, t: -h * TRS_AY - pad, res: res, bytes: out.width * out.height * 4, last: ++A.cacheTick };
  A.cache[key] = c; A.cacheCount++; A.cacheBytes += c.bytes;
  if (typeof LIFE !== 'undefined' && LIFE.variantIds) LIFE.variantIds[id] = true;   // 計入居民 sprite 預算(lifeSprTrim)
  A.evict(key);
  slot.key = key;
  return c;
}
// 取 sprite:slot 命中免組字串;未命中才查快取 / 烘焙(每幀烘焙數受 LIFE_BAKE_MAX 限制,超過回 null → 這一幀畫程式繪製的車)
function trafficSprite(kind, file, res, tod) { return trafficSpriteSlot(TRS.slots[kind][file], kind, file, res, tod, ''); }
// 同 trafficSprite,但 slot 與染色由呼叫端指定(caravan_vis 的車隊用);tint = '#rrggbb' 或 '' = 不染。缺圖 / 烘焙失敗回 null
function trafficSpriteSlot(slot, kind, file, res, tod, tint) {
  var A = ART, c, id = 'trv_' + kind + '_' + file + (tint ? '_' + tint.slice(1) : ''), key = 'chibi|' + id + '|' + tod + '|' + res;
  if (slot.spr && slot.res === res && slot.tod === tod && A.cache[slot.key] === slot.spr) { slot.spr.last = ++A.cacheTick; return slot.spr; }
  if (trafficImgState(slot.url) !== 'ok') return null;
  c = A.cache[key];
  if (c) { A.touch(key); slot.key = key; }
  else {
    if (typeof LIFE !== 'undefined' && typeof LIFE_BAKE_MAX !== 'undefined' && LIFE.bakes >= LIFE_BAKE_MAX) return null;
    try { c = trafficBake(kind, file, res, tod, slot, tint); } catch (e) { TRS.imgs[slot.url].state = 'fail'; return null; }
    if (!c) return null;
    if (typeof LIFE !== 'undefined') LIFE.bakes++;
    TRS.bakes++;
  }
  slot.spr = c; slot.res = res; slot.tod = tod;
  return c;
}
// 畫一輛車(lifeDrawOne 開頭呼叫)。回傳 true = 已畫;false = 沒有可用圖,呼叫端走原本的程式繪製
function trafficSpriteDraw(ctx, n, res, tod, alpha) {
  var tv = n.tv, v, spr;
  if (!TRS.on || !tv || typeof ART === 'undefined' || !ART.cache || !TRS.slots[tv.kind]) return false;
  v = trafficView(tv.kind, trafficDirOf(n.fx, n.fy));
  spr = trafficSprite(tv.kind, v.file, res, tod || 'noon');
  if (!spr) return false;
  if (v.flip) { rqSave(ctx); rqTranslate(ctx, n.px, 0); rqScale(ctx, -1, 1); rqTranslate(ctx, -n.px, 0); }
  rqSprite(ctx, spr, n.px + spr.l, n.py + spr.t, spr.cv.width / spr.res, spr.cv.height / spr.res, alpha);
  if (v.flip) rqRestore(ctx);
  TRS.draws++;
  return true;
}

// ───────── 數量 ─────────
function trafficCap() {
  var base = TRS_CAP[typeof lifeEffDensity === 'function' ? lifeEffDensity() : 'mid'] || 0, c, m;
  if (base <= 0) return 0;
  if ((typeof isPowerSave === 'function' && isPowerSave()) || (typeof lifeLowEnd === 'function' && lifeLowEnd())) base = Math.min(base, 2);
  m = typeof lifeStreetMul === 'function' ? lifeStreetMul() : 1;
  c = Math.max(1, Math.round(base * m));
  if (LIFE.tod === 'night') c = Math.max(1, Math.ceil(c / 2));
  return c;
}
// wagon + rider 的目標合計不超過 trafficCap();騎馬者佔約 1/3,至少 1(上限 1 時只留一輛車)
function trafficTargetsClamp(tg) {
  var cap = trafficCap(), rd, wg, fl;
  if (cap <= 0) { tg.wagon = 0; tg.rider = 0; return tg; }
  if (cap === 1) { rd = 0; wg = 1; } else { rd = Math.max(1, Math.floor(cap / 3)); wg = cap - rd; }
  if (tg.rider > rd) tg.rider = rd;
  if (tg.wagon > wg) tg.wagon = wg;
  // 保底:有路網時(原始需求 > 0)小城也至少常有 min(cap, 3) 輛車馬(車 2 : 馬 1),不再被小城的低需求拉到 1~2 輛
  if (tg.wagon + tg.rider > 0 && cap >= 2) {
    fl = Math.min(cap, TRS_FLOOR);
    while (tg.wagon + tg.rider < fl) { if (tg.wagon <= tg.rider * 2 && tg.wagon < wg) tg.wagon++; else if (tg.rider < rd) tg.rider++; else tg.wagon++; }
  }
  return tg;
}

// ───────── 地點 ─────────
function trafficZoneOf(t) {
  if (TRS_ZONE_TYPES.wood[t]) return 'wood';
  if (TRS_ZONE_TYPES.depot[t]) return 'depot';
  if (t === 'market' || t.indexOf('stall_') === 0 || t.indexOf('shop_') === 0) return 'market';
  return '';
}
function trafficSample(list, max) {
  var out = [], step, i;
  if (list.length <= max) return list;
  step = list.length / max;
  for (i = 0; i < max; i++) out.push(list[Math.floor(i * step)]);
  return out;
}
// 重建道路圖後(lifeTrafficBuild 結尾)呼叫:各類地點的門格(相鄰可走道路格),每類最多 TRS_ZONE_MAX 格
function trafficBuildZones(ok) {
  var R = LIFE.road, X = R && R.x, objs = (typeof world !== 'undefined' && world && world.objects) || [], L = { wood: [], market: [], depot: [] }, seen = {}, i, o, cat, d;
  trafficPreload();
  if (!X) return;
  for (i = 0; i < objs.length; i++) {
    o = objs[i];
    cat = trafficZoneOf(o.type);
    if (!cat) continue;
    d = lifeFindDoor(o, ok);
    if (!d || seen[cat + d.cell]) continue;
    seen[cat + d.cell] = 1;
    L[cat].push(d.cell);
  }
  X.zone = { wood: trafficSample(L.wood, TRS_ZONE_MAX), market: trafficSample(L.market, TRS_ZONE_MAX), depot: trafficSample(L.depot, TRS_ZONE_MAX) };
}

// 挑 wagon 的車型與沿途停靠格(在 trafficSeeded 內呼叫 → 確定性)。有停靠點:客棧 = 客篷車,其餘(驛站 / 碼頭 / 庫房…)= 雙馬貨車;
// 沒有:依附近地點加權抽 牛板車(伐木 / 採石)/ 驢(市集 / 商鋪)/ 雙馬貨車(庫房 / 驛站 / 碼頭),一般道路 = 客篷車 / 獨輪車。回傳 { kind, cell(-1 = 無) }
function trafficWagonPick(dock, s, D) {
  var X = LIFE.road && LIFE.road.x, Z = X && X.zone, opts = [], tot = 0, i, r, cat, list = null, cell = -1, kind;
  if (dock) return { kind: dock.type === 'inn' ? 'carriage' : 'wagon', cell: -1 };
  opts.push({ kind: 'carriage', cat: '', w: 3 }, { kind: 'wheelbarrow', cat: '', w: 2 });
  if (Z) for (cat in TRS_ZONE_KIND) if (Z[cat] && Z[cat].length) opts.push({ kind: TRS_ZONE_KIND[cat], cat: cat, w: 3 });
  for (i = 0; i < opts.length; i++) tot += opts[i].w;
  r = Math.random() * tot; kind = opts[opts.length - 1];
  for (i = 0; i < opts.length; i++) { r -= opts[i].w; if (r < 0) { kind = opts[i]; break; } }
  if (kind.cat) {
    list = Z[kind.cat].filter(function (c) { return c !== s.start && D && D[c] >= 0; });
    if (list.length) cell = list[Math.floor(Math.random() * list.length)];
    else kind = opts[0];
  }
  return { kind: kind.kind, cell: cell };
}
function trafficMake(kind) { return { kind: kind }; }

// ───────── 確定性 ─────────
// 種子 = hash(世界編號, 道路簽章, 日號, 時段, 各角色流水號);同一世界同一天同一時段,第 k 次成功生成的決策永遠相同
function trafficSeedOf(world, sig, day, tod, serial) {
  var h, tc = 0, i;
  for (i = 0; i < tod.length; i++) tc = (tc * 31 + tod.charCodeAt(i)) | 0;
  h = lifeHash(0x7a11c0de, world | 0);
  h = lifeHash(h, sig | 0);
  h = lifeHash(h, day | 0);
  h = lifeHash(h, tc);
  return lifeHash(h, serial | 0);
}
function trafficSeed(serial) {
  var w = 1;
  try { w = (typeof worldsActive === 'function') ? (worldsActive() | 0) : 1; } catch (e) { w = 1; }
  return trafficSeedOf(w, LIFE.road ? LIFE.road.sig : 0, Math.floor(Date.now() / 86400000), LIFE.tod || 'noon', serial);
}
// 在 fn 執行期間 Math.random 換成種子亂數(同 lifePrefill 做法);結束必還原。role = 'wagon' | 'rider',各自獨立流水號:
// 成功(回傳 > 0)才前進;失敗時若當幀距離場預算還有(= 不是被預算擋下,而是這組決策本身走不通)才換一組決策,
// 被距離場預算擋下的失敗不消耗種子 → 不同機器 / 不同居民亂數下,第 k 輛車的決策仍相同
function trafficSeeded(role, fn) {
  var mr = Math.random, bud = LIFE.bfsBudget, r;
  Math.random = lifeRng(trafficSeed((TRS.ser[role] | 0) * 64 + (TRS.att[role] | 0) + (role === 'rider' ? 7919000 : 0)));
  try { r = fn(); } finally { Math.random = mr; }
  if (r > 0) { TRS.ser[role] = (TRS.ser[role] | 0) + 1; TRS.att[role] = 0; }
  else if (bud > 0) TRS.att[role] = ((TRS.att[role] | 0) + 1) % 64;
  return r;
}
// 開場預布點(擺在路上中途而非入口進場):各角色前 3 輛,改以角色流水號決定(不看全體 xSeed 剩餘數)→ 種子決策不受其他角色生成時機影響
function trafficMid(role) { return (TRS.ser[role] | 0) < 3; }
function trafficReset() { TRS.ser = { wagon: 0, rider: 0 }; TRS.att = { wagon: 0, rider: 0 }; }

// 開發 / 測試用:各車型現存數(不含淡出中)
function trafficStats() {
  var o = { total: 0 }, L = LIFE.npcs, i, n;
  for (i = 0; i < L.length; i++) {
    n = L[i];
    if (!n.tv || n.dead || n.st === 'fade') continue;
    o.total++; o[n.tv.kind] = (o[n.tv.kind] || 0) + 1;
  }
  return o;
}
