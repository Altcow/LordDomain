// js/tavern_scene.js — 酒館室內場景(PLAN_INTERIORS I0):以 interior.js 的資料表描述「招賢酒肆」兩層等角房間,掌櫃可點 → 開招募介面(cardsui.js 總覽分頁)。
// 資料在 tavern_data.js(台詞 / 色票 / 點位)。存檔:world.city.tavern = { lv, rooms:[], seed }(goods.js goodsNormCity 帶過 tavernNormSave);I0 只用 seed,包間收益 / 客座事件 / 掌櫃職司連動屬 I1 以後。
// 客座:每 10 分鐘(本機時間桶)換一批,同(種子, 桶, 時段)同客人;外觀用 crowdparts.js 的 crowdLook,族別依 ethnic 規則(缺省漢);客人不存檔。
// 酒館建築點擊:cardsui.js cardsUiTap 優先呼叫 tavernSceneEnter();不可用(非經營模式 / 缺模組)時退回開招募介面。不發聲。ES2017;不用 ?. ??。
// I1(包間收益 / 客座小事件 / 掌櫃職司連動):收益與事件邏輯、面板在 tavern_i1.js(以 typeof 守衛呼叫);本檔負責存檔欄位、二樓包間門(可點)、掌櫃外觀(派駐名冊人物時換成其外觀)、事件標記。
// 存檔擴充欄位(有值才寫):at 上次結算時間 ms、cf 金幣小數、inc {d,c} 今日收入、tot 累計收入、ev {d,n,b[]} 今日已處理事件。
// 全域名稱:tavernNormSave tavernGet tavernPeriod tavernGuestsFor tavernGuestCount tavernRoomCount tavernRoomLv tavernSceneEnter tavernSceneDef tavernKeeperSpec TAVERN_DEF

var TAVERN_DEF = null;
var TAVERN_ROOM_USES = ['coin', 'xue', 'wang', 'mood', 'rec'];   // 預留:酒錢 / 茶敘 / 雅集 / 說書 / 引薦(使用者決議:包間只影響收入,I1 一律當 coin)

function tavernInt(v, lo, hi, d) { return (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d; }
// 正規化 world.city.tavern;v58-C 起酒館無升級:lv 與包間一律最高級 5(舊存檔的 lv / 包間等級讀入時忽略),包間固定 6 間;hint 給定時(新資料)種子由 hint 雜湊而來,否則亂數(只在缺種子時發生一次)
function tavernNormSave(v, hint) {
  var n = { lv: 5, rooms: [], seed: 0 };
  if (v && typeof v === 'object') {
    if (Array.isArray(v.rooms)) {
      n.rooms = v.rooms.slice(0, 6).map(function (r) {
        if (!r || typeof r !== 'object') return null;
        return { lv: 5, use: TAVERN_ROOM_USES.indexOf(r.use) >= 0 ? r.use : 'coin', staff: (typeof r.staff === 'string' && r.staff) ? r.staff.slice(0, 20) : null };
      }).filter(function (r) { return !!r; });
    }
    if (typeof v.seed === 'number' && isFinite(v.seed) && v.seed > 0) n.seed = v.seed >>> 0;
    if (typeof v.at === 'number' && isFinite(v.at) && v.at > 0) n.at = Math.floor(v.at);
    if (typeof v.cf === 'number' && isFinite(v.cf) && v.cf > 0) n.cf = Math.min(0.9999, v.cf);
    if (typeof v.tot === 'number' && isFinite(v.tot) && v.tot > 0) n.tot = Math.min(1e12, Math.floor(v.tot));
    if (v.inc && typeof v.inc === 'object' && typeof v.inc.d === 'number' && isFinite(v.inc.d) && typeof v.inc.c === 'number' && isFinite(v.inc.c) && v.inc.c > 0) n.inc = { d: Math.floor(v.inc.d), c: Math.min(1e9, Math.floor(v.inc.c)) };
    if (v.ev && typeof v.ev === 'object' && typeof v.ev.d === 'number' && isFinite(v.ev.d)) {
      var evn = tavernInt(v.ev.n, 0, 99, 0), evb = Array.isArray(v.ev.b) ? v.ev.b.filter(function (x) { return typeof x === 'number' && isFinite(x); }).map(Math.floor).slice(-8) : [];
      if (evn > 0 || evb.length) n.ev = { d: Math.floor(v.ev.d), n: evn, b: evb };
    }
  }
  while (n.rooms.length < 6) n.rooms.push({ lv: 5, use: 'coin', staff: null });
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
// 包間數(依酒館 lv,v58-C 起恆為 6 間)與單間等級(v58-C 起恆為 Lv5);缺的視為 Lv1
function tavernRoomCount(tv) {
  var R = (typeof TAVERN_ECON !== 'undefined') ? TAVERN_ECON.roomsByLv : [2, 3, 4, 5, 6];
  return R[Math.max(1, Math.min(5, (tv && tv.lv) | 0 || 1)) - 1];
}
function tavernRoomLv(tv, i) {
  var r = tv && tv.rooms && tv.rooms[i];
  return r ? tavernInt(r.lv, 1, 5, 1) : 1;
}
// 時段:day / dusk / night(小時 0~23)
function tavernPeriod(hour) {
  var H = TAVERN_CFG.hours;
  if (hour >= H.dayFrom && hour < H.duskFrom) return 'day';
  if (hour >= H.duskFrom && hour < H.nightFrom) return 'dusk';
  return 'night';
}
// 客人數(與 tavernGuestsFor 同一個亂數首抽,I1 結算用,不組外觀)
function tavernGuestCount(seed, bucket, period, lv) {
  var r = interiorRng(interiorHash('tavSeat', seed, bucket, period)), O = TAVERN_CFG.occ[period] || TAVERN_CFG.occ.day, seats = TAVERN_TABLES.length * 2, n = Math.round(seats * (O[0] + (O[1] - O[0]) * r()));
  return Math.max(TAVERN_CFG.guestMin, Math.min(TAVERN_CFG.guestMax, seats, n + (lv > 1 ? lv - 1 : 0)));
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
function tavernKeeperSpec(person) {
  var base;
  if (person && person.spec) return person.spec;   // 派駐『掌櫃』職司的名冊人物:用其城內外觀(npcHeroSpec)
  base = (typeof crowdLook === 'function') ? crowdLook('vendor', 'keeper', 'han') : null;
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
  (S.guestShown || S.guestData).forEach(function (g) {
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
  var d = S.def, npc = d.npcs[0], person = S.keeperPerson || null, spec = tavernKeeperSpec(person), list;
  list = [{
    floor: npc.floor, depth: npc.at[0] + 1 + npc.at[1] + 1, spot: { id: 'keeper', act: npc.act }, hitW: 24, hitH: 50,
    footPt: function (SS) { return interiorPt(d, SS.L.floors[npc.floor], npc.at[0] + 0.5, npc.at[1] + 0.5, 0); },
    draw: function (ctx, fl, t) {
      var p = interiorPt(d, fl, npc.at[0] + 0.5, npc.at[1] + 0.5, 0), bow = S.bowAt !== undefined && (t - S.bowAt) < 0.7 && (t - S.bowAt) >= 0;
      interiorDrawPerson(ctx, S, spec, 0, Math.floor(t * 1.2) % 2, p[0], p[1], { dy: bow ? 2 : 0, sy: bow ? 0.94 : 1, after: person ? null : function (c) {
        c.fillStyle = 'rgba(244,234,210,.92)'; c.strokeStyle = 'rgba(60,40,20,.5)'; c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(-5, -27); c.lineTo(5, -27); c.lineTo(6.5, -8); c.lineTo(-6.5, -8); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#e8e2cf'; c.fillRect(5, -34, 3.2, 8);
      } });
    }
  }];
  // 二樓包間門:每間一個可點熱區(draw 為空,門本身烘在背景)
  d.props.forEach(function (pr) {
    if (pr.kind !== 'rdoor') return;
    list.push({
      floor: pr.floor, depth: pr.at[0] + pr.size[0] + 0.5, spot: { kind: 'room', i: pr.room }, hitW: 24 * pr.size[0], hitH: 40,
      footPt: function (SS) { return interiorPt(d, SS.L.floors[pr.floor], pr.at[0] + pr.size[0] / 2, 0.6, 0); },
      draw: function () {}
    });
  });
  // 客座小事件:有事件的那位客人頭上顯示標記,點他開事件面板
  if (S.evOffer && S.guestShown && S.guestShown[S.evOffer.gi]) {
    (function () {
      var g = S.guestShown[S.evOffer.gi], seat = d.seats[g.seat];
      list.push({
        floor: seat.floor, depth: tavernStoolDepth(seat) + 0.02, spot: { kind: 'event' }, hitW: 24, hitH: 50,
        footPt: function (SS) { return interiorPt(d, SS.L.floors[seat.floor], seat.at[0] + 0.5, seat.at[1] + 0.5, 6); },
        draw: function () {}
      });
    })();
  }
  return list;
}
// 掌櫃頭上泡泡(每 bubbleCycle 秒顯示 bubbleOn 秒,台詞輪播)
function tavernDrawTop(ctx, S, t) {
  var C = TAVERN_CFG, cyc = t % C.bubbleCycle, idx, line, w, p, x, y, h = 15;
  if (S.evOffer && !S.evDone && typeof tavernI1DrawMark === 'function') tavernI1DrawMark(ctx, S, t);
  if (S.keeperPerson && S.npcEnts.length) {   // 派駐掌櫃:名牌(畫在最上層,免被櫃台擋住)
    p = S.npcEnts[0].footPt(S);
    ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    w = Math.ceil(ctx.measureText(S.keeperPerson.name).width) + 8;
    ctx.fillStyle = 'rgba(30,20,12,.7)'; ctx.fillRect(p[0] - w / 2, p[1] - 4, w, 10);
    ctx.fillStyle = '#f4ead2'; ctx.fillText(S.keeperPerson.name, p[0], p[1] + 1.5);
  }
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
// 依包間數重排二樓門 / 窗(進場時呼叫,先於背景烘焙)
function tavernApplyRooms(def, n) {
  def.props = def.props.filter(function (p) { return !/^(door2|win2)/.test(p.id); }).concat(tavernRoomProps(n));
}
// 包間門:門框 + 等級金點 + 有客時門縫透光(烘進背景;S.tvRooms[i] = {lv, occ})
if (typeof INTERIOR_KINDS !== 'undefined' && INTERIOR_KINDS.door) {
  INTERIOR_KINDS.rdoor = {
    bake: function (ctx, S, fl, p, pal) {
      var st = S.tvRooms && S.tvRooms[p.room], c = p.at[0], w = p.size[0], k, pt, lv;
      INTERIOR_KINDS.door.bake(ctx, S, fl, p, pal);
      if (!st) return;
      lv = st.lv | 0;
      ctx.fillStyle = pal.accent;
      for (k = 0; k < lv; k++) {
        pt = interiorPt(S.def, fl, c + w / 2 + (k - (lv - 1) / 2) * 0.17, 0, 18);
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 1.25, 0, Math.PI * 2); ctx.fill();
      }
      if (st.occ) itrPoly(ctx, itrWallQuad(S, fl, 'x', c + 0.14, c + w - 0.14, 0, 3.2), '#ffd36a');
    }
  };
}
function tavernOnEnter(S) {
  var now = new Date(), tv = tavernGet(), seed = tv ? tv.seed : 1, region = (typeof world !== 'undefined' && world && world.ethRegion) || 'zhongyuan', n, i;
  if (typeof tavernI1Enter === 'function') { try { tavernI1Enter(S, now); } catch (e) { if (typeof console !== 'undefined' && console.warn) console.warn('[tavern] i1 enter', e); } }
  n = tavernRoomCount(tv);
  S.rooms = n;
  if (!S.tvRooms) { S.tvRooms = []; for (i = 0; i < n; i++) S.tvRooms.push({ lv: tavernRoomLv(tv, i), occ: false }); }
  tavernApplyRooms(S.def, n);
  S.period = tavernPeriod(now.getHours());
  S.bucket = Math.floor(now.getTime() / TAVERN_CFG.bucketMs);
  S.seed = seed;
  S.guestData = tavernGuestsFor(seed, S.bucket, S.period, tv ? tv.lv : 1, region);
  S.guestShown = S.guestData.slice(0, Math.max(1, 14 - n));   // 動態小人預算:客人 + 掌櫃 + 包間熱區 + 事件標記 ≤ 16
  S.lineBase = interiorHash('tavLine', seed, S.bucket) % TAVERN_LINES.length;
  if (typeof tavernI1Offer === 'function') { try { tavernI1Offer(S, now); } catch (e2) { S.evOffer = null; } }
}
function tavernOnAct(S, spot) {
  if (spot && spot.kind === 'room') { if (typeof tavernI1OpenRoom === 'function') tavernI1OpenRoom(S, spot.i); return; }
  if (spot && spot.kind === 'event') { if (typeof tavernI1OpenEvent === 'function') tavernI1OpenEvent(S); return; }
  if (spot && spot.act === 'recruit') {
    S.bowAt = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) / 1000;
    if (typeof cardsUiOpen === 'function') cardsUiOpen('O');
  }
}
function tavernSub() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null;
  return cs ? '卡包 ' + cs.roster.length + '/' + ((typeof cardsCap === 'function') ? cardsCap() : 0) + ' · 小池 ' + cardsPulls(cs, 'T') + ' · 大池 ' + cardsPulls(cs, 'E') : '';
}
function tavernSceneDef() {
  var L;
  if (TAVERN_DEF) return TAVERN_DEF;
  if (typeof interiorDefine !== 'function') return null;
  L = tavernLayoutBuild();
  TAVERN_DEF = interiorDefine({
    id: 'tavern', name: '招賢酒肆', bld: ['tavern'], floors: L.floors, props: L.props, seats: L.seats, npcs: L.npcs, lights: L.lights,
    pal: tavernPal, makeGuests: tavernMakeGuests, makeNpcs: tavernMakeNpcs, drawTop: tavernDrawTop, onEnter: tavernOnEnter, onAct: tavernOnAct,
    title: function () { return '招賢酒肆'; }, sub: tavernSub,
    closeSub: function () { return (typeof tavernI1Close === 'function') ? tavernI1Close() : false; }, onLeave: function (S) { if (typeof tavernI1Leave === 'function') tavernI1Leave(S); }
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
