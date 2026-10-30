// npc.js — NPC 戰鬥陣與 AI 襲擊(PLAN_TD_MASTER §6.1)
// 外部全域(執行期才使用):game world TEMPLATES OBJECTS MAX_H MAP_W MAP_H T_LAKE T_RIVER T_ROAD
//   clearBoard canPlace place paintTerrain fillRect idx tplCells boardToJSON

// NPC 戰鬥陣。tpl 為 templates.js 的範本 id;add 為增補物件(範本座標,格式同範本 objects);
// marks 缺省沿用範本的 marks。diff:1 易、2 中、3 難
const NPC_BASES = [
  { id: 'huangjin', name: '黃巾營寨', tpl: 'camp_square', diff: 1, intro: '黃巾賊眾據方城而守,帥帳居中,四角箭樓相望。', add: [] },
  { id: 'shankou', name: '山口隘道', tpl: 'camp_pass', diff: 2, intro: '山賊扼守谷口,兩側高台居高臨下,谷北帥帳穩坐。', add: [] },
  {
    id: 'jun', name: '東漢郡城', tpl: 'jun', diff: 3, intro: '郡城四門內側皆設箭樓與屯兵營,城主府居中,護城壕環繞。',
    add: [
      { type: 'tower', at: [21, 10] }, { type: 'muster', at: [30, 10] },
      { type: 'tower', at: [26, 43] }, { type: 'muster', at: [26, 39] },
      { type: 'tower', at: [12, 27] }, { type: 'muster', at: [16, 27] },
      { type: 'tower', at: [42, 27] }, { type: 'muster', at: [38, 27] }
    ],
    marks: {
      deploy: [
        { r: [12, 1, 28, 4], kind: 'front' }, { r: [12, 51, 28, 4], kind: 'front' },
        { r: [1, 12, 4, 28], kind: 'flank' }, { r: [51, 12, 4, 28], kind: 'flank' }
      ],
      rally: []
    }
  }
];

// 在 game.backup 狀態下直接建攻擊棋盤。applyTemplate 於備份中不套用,故此處依同樣規則放置地形與物件。
// 回傳放置失敗的物件描述陣列
function npcBuildBoard(t, add, marks) {
  clearBoard();
  const ox = (MAP_W - t.w) >> 1, oy = (MAP_H - t.h) >> 1;
  const R = (x0, y0, w, h, fn) => fillRect(ox + x0, oy + y0, ox + x0 + w - 1, oy + y0 + h - 1, fn);
  (t.heights || []).forEach(a => R(a[1], a[2], a[3], a[4], (x, y) => { world.height[idx(x, y)] = Math.min(MAX_H, a[0]); }));
  (t.water || []).forEach(op => {
    const r = op.rect, hl = op.hole, tt = op.t === 'river' ? T_RIVER : T_LAKE;
    R(r[0], r[1], r[2], r[3], (x, y) => {
      const lx = x - ox, ly = y - oy;
      if (hl && lx >= hl[0] && lx < hl[0] + hl[2] && ly >= hl[1] && ly < hl[1] + hl[3]) return;
      paintTerrain(x, y, tt, op.flow || 0);
    });
  });
  (t.roads || []).forEach(r => R(r[0], r[1], r[2], r[3], (x, y) => paintTerrain(x, y, T_ROAD, 0)));
  (t.block || []).forEach(a => R(a[1], a[2], a[3], a[4], (x, y) => { world.block[idx(x, y)] = a[0]; }));
  (t.zone || []).forEach(a => R(a[1], a[2], a[3], a[4], (x, y) => { world.zone[idx(x, y)] = a[0]; }));

  const mk = marks || t.marks || {};
  const shift = r => [ox + r[0], oy + r[1], r[2], r[3]];
  (mk.deploy || []).forEach(d => world.marks.deploy.push(Object.assign({}, d, { r: shift(d.r) })));
  (mk.rally || []).forEach(p => world.marks.rally.push(Object.assign({}, p, { x: ox + p.x, y: oy + p.y })));
  (mk.aiEntry || []).forEach(a => world.marks.aiEntry.push(Object.assign({}, a, { r: shift(a.r) })));

  const fails = [];
  (t.objects || []).concat(add || []).forEach(e => {
    const rot = e.rot || 0;
    tplCells(e).forEach(p => {
      const x = ox + p[0], y = oy + p[1];
      if (!OBJECTS[e.type] || !canPlace(e.type, x, y, rot)) { fails.push(e.type + '@' + p[0] + ',' + p[1]); return; }
      place(e.type, x, y, rot);
    });
  });
  return fails;
}

// 前提:game.backup 已存在且 game.mode === 'attack';回傳 boardToJSON(world),失敗回 null
function npcLoadIntoWorld(id) {
  const b = NPC_BASES.find(v => v.id === id);
  const t = b && TEMPLATES.find(v => v.id === b.tpl);
  if (!game.backup || game.mode !== 'attack' || !t) {
    console.warn('[npc] ' + id + ': 需在 boardBackup() 後且 mode 為 attack 時載入');
    return null;
  }
  const fails = npcBuildBoard(t, b.add, b.marks);
  if (fails.length) console.warn('[npc] ' + id + ': ' + fails.length + ' failed', fails.slice(0, 20).join(' '));
  return boardToJSON(world);
}

// 戰報事件文字(A §4.6);{unit} 兵種名、{bld} 建築名、{n} 數量,由呼叫端代入
const REPORT_TEXT = {
  drum: '三通鼓響,各部次第進軍。',
  breach: '{unit}先登,率先破{bld}。',
  gateBreak: '{bld}被攻破,城門洞開。',
  coreHurt: '{bld}受創過半,守軍為之動搖。',
  trapKill: '伏機發動,{unit}遭陷阱所殺,共 {n} 人。',
  ambush: '伏兵自側翼突入,陣線為之一亂。',
  slayer: '{bld}陷落,敵將授首。',
  retreat: '鳴金收兵。'
};

// 六級評價(§1.9 / §5.3);name 為評價名,text 為一句評語
const GRADE_TEXT = {
  grand: { name: '大捷', text: '敵寨盡墮,旌旗易幟,此役足以震動一郡。' },
  minor: { name: '小勝', text: '核心既破,餘部潰散,雖未盡殲,已足以奏凱。' },
  pyrrhic: { name: '慘勝', text: '雖得寨柵,將士傷亡慘重,勝得沉痛。' },
  narrow: { name: '險勝', text: '險中求勝,寨門幾度易手,終賴將士死戰。' },
  defeat: { name: '敗績', text: '未能破其核心,士卒折損,只得退師整補。' },
  rout: { name: '潰敗', text: '兵敗如山倒,諸部不復成列,倉皇撤回。' }
};

// 三功勞 = 三顆星本身(§1.9 / §5.3);星 1:斬將(破核心)、2:陷陣(破壞過半)、3:蕩平(全破)
const MERIT_TEXT = {
  slayer: { star: 1, name: '斬將', text: '破其核心,斬將奪旗。' },
  siege: { star: 2, name: '陷陣', text: '破壞過半,敵陣動搖。' },
  sweep: { star: 3, name: '蕩平', text: '敵營盡毀,無一殘存。' }
};
