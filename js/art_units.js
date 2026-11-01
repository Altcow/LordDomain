// art_units.js — 美術人物、兵種、NPC、動物外觀(PLAN_ART_STYLE §4.1);依賴 art.js、art_objects.js 之後載入

(function (A) {
  // ---- 動物(身體模板 + 花色參數);2 張原畫(正/背)+ 翻轉 ----
  A.ANIMAL = {
    ox: { body: '#b06a38', belly: '#f0d0a0', head: '#9a5a2e', size: 1.2, horn: '#f6ecd0' },
    buffalo: { body: '#5a5560', belly: '#8a8590', head: '#4a4550', size: 1.25, horn: '#e8e0d0' },
    horse: { body: '#a0603a', belly: '#c8885a', head: '#a0603a', size: 1.25, mane: '#3a2420', neck: true },
    whitehorse: { body: '#f4efe6', belly: '#ffffff', head: '#f4efe6', size: 1.25, mane: '#c8c0b4', neck: true },
    donkey: { body: '#9a9490', belly: '#ece8e2', head: '#9a9490', size: 0.95, longEar: true, mane: '#4a4440' },
    pig: { body: '#ffb5a8', belly: '#ffd0c8', head: '#ffb5a8', size: 0.85, snout: true },
    blackpig: { body: '#3e3640', belly: '#5a525c', head: '#3e3640', size: 0.85, snout: true },
    sheep: { body: '#fbf6ea', belly: '#ece4d2', head: '#3a3236', size: 0.85, wool: true },
    goat: { body: '#e8dcc4', belly: '#f8f0e0', head: '#e8dcc4', size: 0.8, horn: '#a08a6a', beard: true },
    dog: { body: '#e0a85a', belly: '#fbe6c4', head: '#e0a85a', size: 0.65, upEar: true },
    cat: { body: '#f0a040', belly: '#fff0dc', head: '#f0a040', size: 0.5, upEar: true },
    chicken: { bird: true, body: '#fffaf0', size: 0.55, comb: true },
    rooster: { bird: true, body: '#d8642a', size: 0.62, comb: true, tail: '#2a5a3a' },
    duck: { bird: true, body: '#fdfdf6', size: 0.55, bill: '#ffa830' },
    goose: { bird: true, body: '#fffaf0', size: 0.75, bill: '#ff9a20', longNeck: true },
    pigeon: { bird: true, body: '#a8b4c4', size: 0.42 },
    camel: { body: '#d9b076', belly: '#ecca94', head: '#d9b076', size: 1.35, neck: true, hump: true }
  };

  Object.keys(A.ANIMAL).forEach(function (id) {
    var a = A.ANIMAL[id];
    A.def(id, {
      w: 1, d: 1, hmax: a.neck ? 52 : 40, shadow: 'ellipse', light: true, animal: true,
      build: function (m, v) {
        m.custom(0, 0, 1, 1, 0, function (ctx, mm) {
          var c = mm.pt(0.5, 0.5, 0), f = mm.f;
          ctx.save(); ctx.translate(c[0], c[1] + 3); if (f === 2 || f === 3) ctx.scale(-1, 1);
          A.animalRaw(ctx, a, f === 1 || f === 2, v.level === 2 ? 1 : 0); ctx.restore();
        });
      }
    });
  });

  // ---- 單位外觀 ----
  A.UNIT.militia = { id: 'militia', name: '民兵', tunic: '#d9b277', trim: '#a8692f', pants: '#7a5233', head: 'scarf', headCol: '#d23a2c', weapon: 'spear', night: 'lantern' };
  A.UNIT.hjzong = { id: 'hjzong', name: '黃巾賊眾', tunic: '#a67845', trim: '#6b4a2e', pants: '#5e4630', head: 'yellow', headCol: '#ffd23a', weapon: 'spear', fierce: true };
  A.UNIT.daodun = { id: 'daodun', name: '刀盾兵', tunic: '#d23a2c', trim: '#ffc94a', pants: '#5a3a2a', head: 'helmet', headCol: '#6f7e8c', armor: '#9a7a52', weapon: 'dao', shield: 'rect', shieldCol: '#d23a2c' };
  A.UNIT.gongbing = { id: 'gongbing', name: '弓兵', tunic: '#f0dfb6', trim: '#d23a2c', pants: '#6b4a2e', head: 'bun', headCol: '#d23a2c', weapon: 'bow' };
  A.UNIT.hunter = { id: 'hunter', name: '獵戶', tunic: '#6e7a4a', trim: '#8a5a2b', pants: '#4a3a2a', head: 'fur', headCol: '#8a6a4a', weapon: 'bow', cape: '#9a6b3c', draw: drawHunter };
  A.UNIT.zeishuai = { id: 'zeishuai', name: '賊帥(具名)', tunic: '#3a3a44', trim: '#ffd23a', pants: '#2b1d1b', head: 'yellow', headCol: '#ffd23a', weapon: 'ji', fierce: true, beard: true, cape: '#8a2a22', armor: '#5a4a3a' };
  // ---- 環境 NPC(人流)外觀:同一 chibi 模板的參數組合 ----
  var NPC = {
    man: { name: '平民男', tunic: '#6fa0c8', trim: '#3e5c7a', pants: '#6b4a2e', civil: true },
    man2: { name: '平民男(頭巾)', tunic: '#c96a3a', trim: '#7a3a1a', pants: '#5a4a3a', head: 'scarf', headCol: '#3e5c7a', civil: true },
    woman: { name: '平民女', tunic: '#ff9ab0', trim: '#e83a5a', robe: true, head: 'woman', headCol: '#e83a5a', civil: true },
    woman2: { name: '平民女(綠)', tunic: '#8fd0c0', trim: '#3fa385', robe: true, head: 'woman', headCol: '#ffc94a', civil: true },
    elder: { name: '老人', tunic: '#a89a86', trim: '#6a5a4a', robe: true, hair: '#e8e4dc', beard: true, head: 'bun', headCol: '#6a5a4a', prop: 'staff', staffCol: '#a8692f', civil: true },
    kid: { name: '小孩', tunic: '#ffd24a', trim: '#d23a2c', pants: '#d23a2c', head: 'kid', headCol: '#d23a2c', scale: 0.78, civil: true },
    kid2: { name: '小孩(綠)', tunic: '#7ccc4c', trim: '#3e5c7a', pants: '#3e5c7a', head: 'kid', headCol: '#3e5c7a', scale: 0.78, civil: true },
    farmer: { name: '農夫(扛鋤)', tunic: '#c9a46a', trim: '#8a5a2b', pants: '#6b4a2e', prop: 'hoe', civil: true },
    peddler: { name: '商販(挑擔)', tunic: '#7f9e4c', trim: '#5a6e2e', pants: '#5a4a3a', head: 'hat', headCol: '#e3b95c', prop: 'pole', civil: true },
    beggar: { name: '乞丐', tunic: '#8a7a66', trim: '#5a4a3a', pants: '#6a5a4a', hair: '#4a3a32', prop: 'bowl', civil: true },
    scholar: { name: '書生', tunic: '#f4ead2', trim: '#3e5c7a', robe: true, head: 'guan', prop: 'scroll', civil: true },
    smith: { name: '鐵匠', tunic: '#6a5650', trim: '#3a2a26', pants: '#3a2a26', armor: '#8a6a4a', head: 'scarf', headCol: '#6f7e8c', prop: 'hammer', civil: true },
    merchant: { name: '富商', tunic: '#7a5cc8', trim: '#ffc94a', robe: true, head: 'guan', beard: true, prop: 'basket', civil: true },
    taoist: { name: '道士', tunic: '#3e5c7a', trim: '#f4ead2', robe: true, head: 'bun', headCol: '#ffc94a', beard: true, prop: 'staff', staffCol: '#f4ead2', civil: true },
    monk: { name: '僧人(浮屠)', tunic: '#e3a23a', trim: '#b8322c', robe: true, hair: '#ffd9b0', prop: 'staff', staffCol: '#ffc94a', civil: true },
    envoy: { name: '使者(持節)', tunic: '#d23a2c', trim: '#ffc94a', robe: true, head: 'guan', beard: true, prop: 'staff', staffCol: '#d23a2c', civil: true },
    patrol: { name: '巡邏兵', tunic: '#d23a2c', trim: '#ffc94a', pants: '#5a3a2a', head: 'helmet', headCol: '#6f7e8c', armor: '#9a7a52', weapon: 'spear', night: 'lantern' },
    bannerman: { name: '旗手', tunic: '#d23a2c', trim: '#ffc94a', pants: '#5a3a2a', head: 'helmet', headCol: '#6f7e8c', flag: '#d23a2c' },
    general: { name: '將領', tunic: '#b8322c', trim: '#ffc94a', pants: '#3a2a26', head: 'helmet', headCol: '#ffc94a', plume: '#d23a2c', armor: '#e0b04a', cape: '#d23a2c', beard: true, fierce: true, weapon: 'ji' },
    rider: { name: '輕騎', tunic: '#d23a2c', trim: '#ffc94a', head: 'helmet', headCol: '#6f7e8c', weapon: 'spear', mount: 'horse' },
    tuqi: { name: '突騎', tunic: '#5a3a2a', trim: '#ffc94a', head: 'helmet', headCol: '#4a4e56', armor: '#8a8f99', weapon: 'ji', mount: 'whitehorse' },
    scout: { name: '斥候', tunic: '#7f9e4c', trim: '#3a2a26', head: 'scarf', headCol: '#3a2a26', weapon: 'bow', mount: 'donkey' },
    changji: { name: '長戟兵', tunic: '#d23a2c', trim: '#ffc94a', pants: '#5a3a2a', head: 'helmet', headCol: '#6f7e8c', armor: '#8a8f99', weapon: 'ji' },
    guard: { name: '商隊護衛', tunic: '#3e5c7a', trim: '#ffc94a', pants: '#3a2a26', head: 'scarf', headCol: '#2b1d1b', weapon: 'dao', shield: 'round', shieldCol: '#a8692f' },
    porter: { name: '挑夫', tunic: '#d9b277', trim: '#a8692f', pants: '#6b4a2e', head: 'scarf', headCol: '#f4ead2', prop: 'pole', civil: true },
    hjlishi: { name: '黃巾力士', tunic: '#8a5a2b', trim: '#ffd23a', pants: '#3a2a26', head: 'yellow', headCol: '#ffd23a', weapon: 'dao', shield: 'round', shieldCol: '#ffd23a', fierce: true, scale: 1.12 },
    huqi: { name: '胡騎', tunic: '#5a7ab0', trim: '#e8dcc4', head: 'fur', headCol: '#8a6a4a', weapon: 'bow', mount: 'horse', fierce: true },
    shuizei: { name: '水賊', tunic: '#3a6a7a', trim: '#e8dcc4', pants: '#2b1d1b', head: 'scarf', headCol: '#2b1d1b', weapon: 'dao', fierce: true }
  };
  Object.keys(NPC).forEach(function (k) { NPC[k].id = k; A.UNIT[k] = NPC[k]; });

  // ---- 戰鬥單位(UNITS key)補齊;已存在者(militia、hunter、daodun、gongbing、hjzong、zeishuai,以及與 NPC 共用的 tuqi、huqi、hjlishi、changji、shuizei)沿用上方定義 ----
  // 騎兵:mount 為 A.ANIMAL 的馬;scale 0.9 讓騎兵高度約 44px(人物 translate 固定 (1,-13),無法只靠馬縮小)
  A.UNIT.qingqi = { id: 'qingqi', name: '輕騎', tunic: '#6f8fb0', trim: '#ffc94a', head: 'scarf', headCol: '#3a2a26', armor: '#9a7a52', weapon: 'spear', mount: 'horse', scale: 0.9 };
  A.UNIT.chihou = { id: 'chihou', name: '斥候', tunic: '#7f9e4c', trim: '#3a2a26', head: 'scarf', headCol: '#3a2a26', weapon: 'bow', mount: 'horse', scale: 0.9 };
  A.UNIT.hushe = { id: 'hushe', name: '胡騎射手', tunic: '#5a7ab0', trim: '#e8dcc4', head: 'fur', headCol: '#8a6a4a', weapon: 'bow', mount: 'horse', scale: 0.9 };
  // 敵軍(山賊):棕 / 灰綠服色與頭巾、帽區分
  A.UNIT.szdao = { id: 'szdao', name: '山賊刀手', tunic: '#8a5a3a', trim: '#3a2a26', pants: '#3a2a26', head: 'scarf', headCol: '#6b4226', weapon: 'dao', shield: 'round', shieldCol: '#6b4226', fierce: true };
  A.UNIT.szgong = { id: 'szgong', name: '山賊弓手', tunic: '#6b5a3a', trim: '#3a2a26', pants: '#4a3a2a', head: 'hat', headCol: '#5a4a2a', weapon: 'bow', fierce: true };
  // 器械:spec.draw 取代人物身體繪製(見下方 chibiRaw 包裝);座標同人物(腳底 y=0,正面朝 +x)
  A.UNIT.chuangnu = { id: 'chuangnu', name: '床弩', tunic: '#d23a2c', trim: '#ffc94a', pants: '#5a3a2a', headCol: '#6f7e8c', draw: drawChuangnu };
  A.UNIT.chongche = { id: 'chongche', name: '衝車', tunic: '#d23a2c', trim: '#ffc94a', pants: '#5a3a2a', headCol: '#6f7e8c', draw: drawChongche };
  A.UNIT.toushi = { id: 'toushi', name: '投石車', tunic: '#d23a2c', trim: '#ffc94a', pants: '#5a3a2a', headCol: '#6f7e8c', draw: drawToushi };
  A.UNIT.zeishuai.scale = 1.3;

  // 操作員(簡化 Q 版):shade 為後排較暗者
  function crew(ctx, s, x, bob, back, shade) {
    var C = A.C, tun = shade ? A.tone(s.tunic, 0.78) : s.tunic, pn = A.tone(s.pants || C.wood[0], shade ? 0.78 : 1);
    A.poly(ctx, [[x - 3.4, -6], [x - 0.6, -6], [x - 0.8, -0.5], [x - 3.6, -0.5]], pn, 0.5);
    A.poly(ctx, [[x + 0.6, -6], [x + 3.4, -6], [x + 3.8, -0.5], [x + 0.8, -0.5]], pn, 0.5);
    A.poly(ctx, [[x - 4.6, -17 + bob], [x + 4.6, -17 + bob], [x + 5, -6], [x - 5, -6]], tun, 0.7);
    A.line(ctx, [x + 3.2, -15 + bob], [x + 8, -11 + bob], tun, 2.6);
    A.circle(ctx, x + 8, -11 + bob, 1.8, C.skin, 0.5);
    A.circle(ctx, x, -25 + bob, 7.4, C.hair, 0.6);
    if (!back) {
      A.ellipse(ctx, x - 0.8, -24 + bob, 5.4, 5.2, C.skin, 0.5);
      A.circle(ctx, x - 2.6, -24.6 + bob, 0.7, '#1a120e'); A.circle(ctx, x + 0.6, -24.6 + bob, 0.7, '#1a120e');
    }
    A.poly(ctx, [[x - 7.2, -26 + bob], [x + 7.2, -26 + bob], [x + 5.6, -30 + bob], [x - 5.6, -30 + bob]], s.headCol || C.hair, 0.5);
  }
  // 床弩:木座車 + 橫向弩臂(弦與箭)+ 兩名操作員
  function drawChuangnu(ctx, s, back, fr) {
    var C = A.C, bob = fr === 1 ? -0.8 : 0;
    crew(ctx, s, -19, bob, back, true);
    A.poly(ctx, [[-2, -7], [16, -7], [16, -4], [-2, -4]], C.wood[0], 0.6);
    A.poly(ctx, [[-4, -15], [20, -15], [20, -11], [-4, -11]], C.wood[1], 0.7);
    A.ellipse(ctx, 0, -3, 3.4, 4.2, C.wood[0], 0.7); A.ellipse(ctx, 12, -3, 3.4, 4.2, C.wood[0], 0.7);
    ctx.beginPath(); ctx.arc(14, -13, 11, -1.25, 1.25);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = C.wood[2]; ctx.lineWidth = 1.6; ctx.stroke();
    A.line(ctx, [17.5, -23.4], [9, -13], '#e6dcc0', 0.8); A.line(ctx, [17.5, -2.6], [9, -13], '#e6dcc0', 0.8);
    A.line(ctx, [6, -13], [24, -13], C.ink, 1.6);
    A.poly(ctx, [[23, -14.8], [27, -13], [23, -11.2]], '#e6eef4', 0.5);
    crew(ctx, s, -9, bob, back, false);
  }
  // 投石車:A 形支架 + 配重杆 + 投臂與石彈,一名操作員
  function drawToushi(ctx, s, back, fr) {
    var C = A.C, bob = fr === 1 ? -0.8 : 0;
    A.poly(ctx, [[-2, -6], [18, -6], [18, -2], [-2, -2]], C.wood[0], 0.6);
    A.ellipse(ctx, 1, -2.5, 3.2, 3.8, C.wood[1], 0.7); A.ellipse(ctx, 15, -2.5, 3.2, 3.8, C.wood[1], 0.7);
    A.line(ctx, [4, -6], [9, -19], C.ink, 3.2); A.line(ctx, [4, -6], [9, -19], C.wood[1], 1.6);
    A.line(ctx, [14, -6], [9, -19], C.ink, 3.2); A.line(ctx, [14, -6], [9, -19], C.wood[1], 1.6);
    A.poly(ctx, [[-4, -11], [2, -11], [2, -5], [-4, -5]], C.stone[0], 0.6);
    A.line(ctx, [-1, -6], [22, -36], C.ink, 3.4); A.line(ctx, [-1, -6], [22, -36], C.wood[2], 1.8);
    A.poly(ctx, [[19, -38], [25, -37], [23, -32], [20, -32]], C.wood[0], 0.6);
    A.circle(ctx, 22, -40, 2.6, C.stone[1], 0.6);
    crew(ctx, s, -12, bob, back, false);
  }
  // 衝車:有頂棚的木車 + 前伸撞木(鐵頭)+ 兩名推車者
  function drawChongche(ctx, s, back, fr) {
    var C = A.C, bob = fr === 1 ? -0.8 : 0;
    crew(ctx, s, -19, bob, back, true);
    A.poly(ctx, [[-4, -6], [22, -6], [22, -2], [-4, -2]], C.wood[0], 0.6);
    A.ellipse(ctx, 0, -2, 3.2, 3.6, C.wood[1], 0.7); A.ellipse(ctx, 18, -2, 3.2, 3.6, C.wood[1], 0.7);
    A.poly(ctx, [[-4, -6], [-2, -22], [18, -22], [20, -6]], '#9a8a66', 0.7);
    A.line(ctx, [-2, -22], [18, -22], C.wood[0], 2.4);
    A.line(ctx, [-1, -17], [19, -17], A.tone('#9a8a66', 0.8), 0.8);
    A.poly(ctx, [[12, -12], [28, -12], [28, -8], [12, -8]], C.wood[1], 0.7);
    A.poly(ctx, [[26, -15], [30, -10], [26, -5]], C.stone[0], 0.8);
    crew(ctx, s, -9, bob, back, false);
  }

  // 獵戶:皮帽 + 獸皮披肩(spec.cape)+ 右肩箭袋(箭羽露出);人物本體、短弓與姿勢沿用人物繪製
  function drawHunter(ctx, s, back, fr) {
    var bob = fr === 1 ? -1 : 0;
    chibiRawBase(ctx, s, back, fr);
    A.poly(ctx, [[3.4, -21 + bob], [7.4, -21 + bob], [9.4, -6 + bob], [5.4, -5 + bob]], '#7a5232', 0.6);
    A.poly(ctx, [[3.4, -21 + bob], [7.4, -21 + bob], [7.4, -19 + bob], [3.4, -19 + bob]], '#4a3422', 0.4);
    A.line(ctx, [4.4, -21 + bob], [3.4, -26 + bob], '#e6dcc0', 1);
    A.line(ctx, [6, -21 + bob], [6.8, -26 + bob], '#e6dcc0', 1);
    A.line(ctx, [5.2, -21 + bob], [5.6, -27 + bob], '#c8523a', 1);
  }

  // 包裝 chibiRaw:spec.draw 存在時改由其繪製(器械用),否則走原本的人物繪製
  var chibiRawBase = A.chibiRaw;
  A.chibiRaw = function (ctx, s, back, fr) {
    if (s.draw) s.draw(ctx, s, back, fr); else chibiRawBase(ctx, s, back, fr);
  };
})(ART);
