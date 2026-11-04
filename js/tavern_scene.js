// js/tavern_scene.js — 酒館室內場景(PLAN_INTERIORS I0):以 interior.js 的資料表描述「招賢酒肆」兩層等角房間,掌櫃可點 → 開招募介面(cardsui.js 總覽分頁)。
// 資料在 tavern_data.js(台詞 / 色票 / 點位)。存檔:world.city.tavern = { lv, rooms:[], seed }(goods.js goodsNormCity 帶過 tavernNormSave);I0 只用 seed,包間收益 / 客座事件 / 掌櫃職司連動屬 I1 以後。
// 客座:每 10 分鐘(本機時間桶)換一批,同(種子, 桶, 時段)同客人;外觀用 crowdparts.js 的 crowdLook,族別依 ethnic 規則(缺省漢);客人不存檔。
// 酒館建築點擊:cardsui.js cardsUiTap 優先呼叫 tavernSceneEnter();不可用(非經營模式 / 缺模組)時退回開招募介面。不發聲。ES2017;不用 ?. ??。
// 全域名稱:tavernNormSave tavernGet tavernPeriod tavernGuestsFor tavernSceneEnter tavernSceneDef tavernKeeperSpec TAVERN_DEF

var TAVERN_DEF = null;
var TAVERN_ROOM_USES = ['coin', 'xue', 'wang', 'mood', 'rec'];   // 預留:酒錢 / 茶敘 / 雅集 / 說書 / 引薦(I1)

function tavernInt(v, lo, hi, d) { return (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d; }
// 正規化 world.city.tavern;hint 給定時(新資料)種子由 hint 雜湊而來,否則亂數(只在缺種子時發生一次)
function tavernNormSave(v, hint) {
  var n = { lv: 1, rooms: [], seed: 0 };
  if (v && typeof v === 'object') {
    n.lv = tavernInt(v.lv, 1, 5, 1);
    if (Array.isArray(v.rooms)) {
      n.rooms = v.rooms.slice(0, 6).map(function (r) {
        if (!r || typeof r !== 'object') return null;
        return { lv: tavernInt(r.lv, 1, 5, 1), use: TAVERN_ROOM_USES.indexOf(r.use) >= 0 ? r.use : 'coin', staff: (typeof r.staff === 'string' && r.staff) ? r.staff.slice(0, 20) : null };
      }).filter(function (r) { return !!r; });
    }
    if (typeof v.seed === 'number' && isFinite(v.seed) && v.seed > 0) n.seed = v.seed >>> 0;
  }
  if (!n.seed) n.seed = (hint !== undefined) ? (interiorHash('tavern', hint) || 1) : (((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0) || 1);
  return n;
}
// 取得(必要時建立)world.city.tavern;舊存檔缺欄位時補上,種子由名冊種子衍生(同存檔恆同)
function tavernGet() {
  var c = (typeof goodsCity === 'function') ? goodsCity() : ((typeof world !== 'undefined' && world) ? world.city : null), cs;
  if (!c) return null;
  if (!c.tavern || typeof c.tavern !== 'object' || !c.tavern.seed) {
    cs = (typeof cardsGet === 'function') ? cardsGet() : null;
    c.tavern = tavernNormSave(c.tavern, cs ? cs.seed : 'x');
  }
  return c.tavern;
}
// 時段:day / dusk / night(小時 0~23)
function tavernPeriod(hour) {
  var H = TAVERN_CFG.hours;
  if (hour >= H.dayFrom && hour < H.duskFrom) return 'day';
  if (hour >= H.duskFrom && hour < H.nightFrom) return 'dusk';
  return 'night';
}
// 客座:純函式。回 [{seat, job, key, eth, kind, phase, per}],人數 3~10(≤ 座位數),座位互異;同 (seed, bucket, period, lv, region) 結果恆同
function tavernGuestsFor(seed, bucket, period, lv, region) {
  var seats = TAVERN_TABLES.length * 2, r = interiorRng(interiorHash('tavSeat', seed, bucket, period)), O = TAVERN_CFG.occ[period] || TAVERN_CFG.occ.day, A = TAVERN_CFG.anim, out = [], order = [], i, j, t, n, job, rr;
  n = Math.round(seats * (O[0] + (O[1] - O[0]) * r()));
  n = Math.max(TAVERN_CFG.guestMin, Math.min(TAVERN_CFG.guestMax, seats, n + (lv > 1 ? lv - 1 : 0)));
  for (i = 0; i < seats; i++) order.push(i);
  for (i = seats - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = order[i]; order[i] = order[j]; order[j] = t; }
  for (i = 0; i < n; i++) {
    job = TAVERN_GUEST_JOBS[Math.floor(r() * TAVERN_GUEST_JOBS.length)];
    rr = r();
    out.push({ seat: order[i], job: job, key: Math.floor(r() * 1e6), eth: (typeof ethnicPick === 'function') ? ethnicPick(region || 'zhongyuan', rr) : 'han',
      kind: Math.floor(r() * A.kinds), phase: Math.round(r() * 100 * A.period[1]) / 100, per: Math.round((A.period[0] + (A.period[1] - A.period[0]) * r()) * 100) / 100 });
  }
  return out;
}
function tavernKeeperSpec() {
  var base = (typeof crowdLook === 'function') ? crowdLook('vendor', 'keeper', 'han') : null;
  if (!base) return null;
  return Object.assign({}, base, { id: 'tv_keeper', head: 'hat', headCol: '#3e5c7a', tunic: '#8a5a2a', trim: '#f4ead2', pants: '#5a4a3a', prop: undefined, beard: false, scale: 1.02 });
}

// ───────── 場景定義 ─────────
function tavernPal(S) {
  var theme = (typeof themeGet === 'function') ? themeGet() : 'han', p = Object.assign({}, TAVERN_PALS[theme] || TAVERN_PALS.han);
  p.tint = S.period === 'night' ? 'rgba(24,26,70,.24)' : (S.period === 'dusk' ? 'rgba(130,70,24,.12)' : null);
  S.theme = theme;
  return p;
}
function tavernStoolDepth(seat) { return seat.at[0] + 1 + seat.at[1] + 1 - 0.7; }
function tavernMakeGuests(S) {
  var d = S.def, list = [];
  S.guestData.forEach(function (g) {
    var seat = d.seats[g.seat], spec = (typeof crowdLook === 'function') ? crowdLook(g.job, g.key, g.eth) : null;
    list.push({
      floor: seat.floor, depth: tavernStoolDepth(seat) + 0.01, guest: g,
      draw: function (ctx, fl, t) {
        var tt = t + g.phase, cyc = tt % g.per, lift = 0, dy = 3, frame = Math.floor(tt * 1.4) % 2, p = interiorPt(d, fl, seat.at[0] + 0.5, seat.at[1] + 0.5, 6), k;
        if (g.kind === 0) { k = cyc - (g.per - 1.4); if (k > 0) lift = Math.sin(k / 1.4 * Math.PI) * 9; }
        else if (g.kind === 1) { k = cyc - (g.per - 0.9); if (k > 0) dy += Math.sin(k / 0.9 * Math.PI) * 1.8; }
        else dy += Math.sin(tt * 1.3) * 0.6;
        interiorDrawPerson(ctx, S, spec, seat.face, frame, p[0], p[1], { dy: dy, after: lift > 0 ? function (c) {
          c.fillStyle = S.pal.cupC; c.strokeStyle = 'rgba(60,40,20,.7)'; c.lineWidth = 0.8;
          c.beginPath(); c.arc(seat.face === 3 ? 9 : -9, -22 - lift, 2.6, 0, Math.PI * 2); c.fill(); c.stroke();
        } : null });
      }
    });
  });
  return list;
}
function tavernMakeNpcs(S) {
  var d = S.def, npc = d.npcs[0], spec = tavernKeeperSpec();
  return [{
    floor: npc.floor, depth: npc.at[0] + 1 + npc.at[1] + 1, spot: { id: 'keeper', act: npc.act }, hitW: 24, hitH: 50,
    footPt: function (SS) { return interiorPt(d, SS.L.floors[npc.floor], npc.at[0] + 0.5, npc.at[1] + 0.5, 0); },
    draw: function (ctx, fl, t) {
      var p = interiorPt(d, fl, npc.at[0] + 0.5, npc.at[1] + 0.5, 0), bow = S.bowAt !== undefined && (t - S.bowAt) < 0.7 && (t - S.bowAt) >= 0;
      interiorDrawPerson(ctx, S, spec, 0, Math.floor(t * 1.2) % 2, p[0], p[1], { dy: bow ? 2 : 0, sy: bow ? 0.94 : 1, after: function (c) {
        c.fillStyle = 'rgba(244,234,210,.92)'; c.strokeStyle = 'rgba(60,40,20,.5)'; c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(-5, -27); c.lineTo(5, -27); c.lineTo(6.5, -8); c.lineTo(-6.5, -8); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#e8e2cf'; c.fillRect(5, -34, 3.2, 8);
      } });
    }
  }];
}
// 掌櫃頭上泡泡(每 bubbleCycle 秒顯示 bubbleOn 秒,台詞輪播)
function tavernDrawTop(ctx, S, t) {
  var C = TAVERN_CFG, cyc = t % C.bubbleCycle, idx, line, w, p, x, y, h = 15;
  if (cyc > C.bubbleOn || !S.npcEnts.length) return;
  idx = (Math.floor(t / C.bubbleCycle) + S.lineBase) % TAVERN_LINES.length;
  line = TAVERN_LINES[idx];
  ctx.font = '9px sans-serif';
  w = Math.ceil(ctx.measureText(line).width) + 12;
  p = S.npcEnts[0].footPt(S);
  x = p[0] - w / 2 + 12; y = p[1] - 66;
  ctx.fillStyle = 'rgba(255,250,236,.96)'; ctx.strokeStyle = 'rgba(70,46,24,.85)'; ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x + 5, y); ctx.lineTo(x + w - 5, y); ctx.quadraticCurveTo(x + w, y, x + w, y + 5); ctx.lineTo(x + w, y + h - 5); ctx.quadraticCurveTo(x + w, y + h, x + w - 5, y + h);
  ctx.lineTo(p[0] + 6, y + h); ctx.lineTo(p[0] + 2, y + h + 6); ctx.lineTo(p[0] - 2, y + h); ctx.lineTo(x + 5, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - 5); ctx.lineTo(x, y + 5); ctx.quadraticCurveTo(x, y, x + 5, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2a1c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(line, x + w / 2, y + h / 2 + 0.5);
}
function tavernOnEnter(S) {
  var now = new Date(), tv = tavernGet(), seed = tv ? tv.seed : 1, region = (typeof world !== 'undefined' && world && world.ethRegion) || 'zhongyuan';
  S.period = tavernPeriod(now.getHours());
  S.bucket = Math.floor(now.getTime() / TAVERN_CFG.bucketMs);
  S.seed = seed;
  S.guestData = tavernGuestsFor(seed, S.bucket, S.period, tv ? tv.lv : 1, region);
  S.lineBase = interiorHash('tavLine', seed, S.bucket) % TAVERN_LINES.length;
}
function tavernOnAct(S, spot) {
  if (spot && spot.act === 'recruit') {
    S.bowAt = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) / 1000;
    if (typeof cardsUiOpen === 'function') cardsUiOpen('O');
  }
}
function tavernSub() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null;
  return cs ? '🎴 ' + cs.tok + ' · 🎫 ' + (cs.nameTokens | 0) : '';
}
function tavernSceneDef() {
  var L;
  if (TAVERN_DEF) return TAVERN_DEF;
  if (typeof interiorDefine !== 'function') return null;
  L = tavernLayoutBuild();
  TAVERN_DEF = interiorDefine({
    id: 'tavern', name: '招賢酒肆', bld: ['tavern'], floors: L.floors, props: L.props, seats: L.seats, npcs: L.npcs, lights: L.lights,
    pal: tavernPal, makeGuests: tavernMakeGuests, makeNpcs: tavernMakeNpcs, drawTop: tavernDrawTop, onEnter: tavernOnEnter, onAct: tavernOnAct,
    title: function () { return '招賢酒肆'; }, sub: tavernSub
  });
  return TAVERN_DEF;
}
// 進入酒館室內;成功回 true。缺模組 / 非經營模式回 false(呼叫端退回招募介面)
function tavernSceneEnter() {
  if (typeof interiorEnter !== 'function' || !tavernSceneDef()) return false;
  try { return !!interiorEnter('tavern'); } catch (e) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[tavern] enter failed', e);
    if (typeof interiorActive === 'function' && interiorActive()) { try { interiorLeave(true); } catch (e2) { /* 略過 */ } }
    return false;
  }
}
if (typeof interiorDefine === 'function') tavernSceneDef();
