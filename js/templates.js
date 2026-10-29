// 範本：一鍵套用的預設城鎮。座標為範本座標，套用時置中加偏移（見 PLAN 10.3）
const DEFAULT_TEMPLATE = 'demo';
const TEMPLATE_KEEP_RES = false;

const TEMPLATES = [
  {
    id: 'demo', name: '城主府小鎮', desc: '原示範場景：高台城主府、兩河合流注入大湖。',
    w: 40, h: 40, focus: [13, 10], legacy: 'demo'
  },
  {
    id: 'jun', name: '東漢郡城', desc: '方城四門與護城壕、井字街、郡府高台、武庫倉廩、東西二市與六里，城外關廂、農田與塢堡。',
    w: 56, h: 56, focus: [27, 17],
    heights: [[1, 23, 14, 8, 7], [1, 49, 49, 7, 7]],
    water: [{ t: 'lake', rect: [6, 6, 43, 43], hole: [8, 8, 39, 39] }],
    roads: [
      [26, 0, 3, 6], [26, 49, 3, 7], [0, 26, 6, 3], [49, 26, 7, 3],
      [26, 8, 3, 2], [26, 45, 3, 2], [8, 26, 2, 3], [45, 26, 2, 3],
      [10, 26, 35, 3], [26, 29, 3, 16], [19, 10, 17, 2], [19, 25, 17, 1], [26, 21, 3, 4],
      [18, 10, 1, 35], [36, 10, 1, 35], [10, 18, 8, 1], [37, 18, 8, 1], [10, 36, 35, 1],
      [12, 0, 1, 5], [40, 0, 1, 5], [0, 15, 5, 1], [0, 40, 5, 1], [13, 50, 1, 6], [41, 50, 1, 6], [50, 10, 6, 1], [50, 42, 6, 1]
    ],
    objects: [
      { type: 'gate', pts: [[26, 9], [26, 45], [26, 24], [51, 49]] },
      { type: 'gate', pts: [[9, 26], [45, 26]], rot: 1 },
      { type: 'wall', ring: [9, 9, 37, 37], skip: [[26, 9, 3, 1], [26, 45, 3, 1], [9, 26, 1, 3], [45, 26, 1, 3]] },
      { type: 'bridge', rect: [26, 6, 3, 2], rot: 1 },
      { type: 'bridge', rect: [26, 47, 3, 2], rot: 1 },
      { type: 'bridge', rect: [6, 26, 2, 3] },
      { type: 'bridge', rect: [47, 26, 2, 3] },
      { type: 'wall', ring: [19, 12, 17, 13], skip: [[26, 24, 3, 1]] },
      { type: 'palace', at: [25, 15] },
      { type: 'stairs', line: [26, 21, 28, 21, 1], rot: 1 },
      { type: 'house', grid: [20, 14, 1, 3, 0, 3], rot: 3 },
      { type: 'house', grid: [33, 14, 1, 3, 0, 3], rot: 3 },
      { type: 'tree', line: [23, 13, 30, 13, 1] },
      { type: 'wall', ring: [10, 10, 8, 8], skip: [[17, 14, 1, 1]] },
      { type: 'quarry', grid: [11, 11, 2, 2, 4, 4] },
      { type: 'wall', ring: [37, 10, 8, 8], skip: [[37, 14, 1, 1]] },
      { type: 'lumber', grid: [38, 11, 2, 2, 4, 4] },
      { type: 'house', grid: [11, 20, 2, 2, 3, 3], rot: 3 },
      { type: 'house', grid: [38, 20, 2, 2, 3, 3], rot: 3 },
      { type: 'wall', ring: [10, 29, 8, 7], skip: [[14, 29, 1, 1], [17, 32, 1, 1]] },
      { type: 'market', grid: [11, 30, 2, 2, 4, 3] },
      { type: 'wall', ring: [37, 29, 8, 7], skip: [[41, 29, 1, 1], [37, 32, 1, 1]] },
      { type: 'market', grid: [38, 30, 2, 2, 4, 3] },
      { type: 'wall', ring: [19, 29, 7, 7], skip: [[22, 35, 1, 1]] },
      { type: 'house', grid: [20, 30, 2, 2, 3, 3], rot: 3 },
      { type: 'wall', ring: [29, 29, 7, 7], skip: [[32, 35, 1, 1]] },
      { type: 'house', grid: [30, 30, 2, 2, 3, 3], rot: 3 },
      { type: 'wall', ring: [10, 37, 8, 8], skip: [[17, 40, 1, 1]] },
      { type: 'house', grid: [11, 38, 3, 2, 2, 3], rot: 3 },
      { type: 'wall', ring: [19, 37, 7, 8], skip: [[22, 37, 1, 1]] },
      { type: 'house', grid: [20, 38, 2, 2, 3, 3], rot: 3 },
      { type: 'wall', ring: [29, 37, 7, 8], skip: [[32, 37, 1, 1]] },
      { type: 'house', grid: [30, 38, 2, 2, 3, 3], rot: 3 },
      { type: 'wall', ring: [37, 37, 8, 8], skip: [[37, 40, 1, 1]] },
      { type: 'house', grid: [38, 38, 3, 2, 2, 3], rot: 3 },
      { type: 'house', grid: [22, 50, 2, 2, 2, 3], rot: 3 },
      { type: 'house', grid: [29, 50, 2, 2, 2, 3], rot: 3 },
      { type: 'house', grid: [50, 24, 2, 2, 3, 5], rot: 3 },
      { type: 'wall', ring: [49, 49, 7, 7], skip: [[51, 49, 3, 1]] },
      { type: 'stairs', at: [52, 48], rot: 3 },
      { type: 'house', pts: [[50, 50], [53, 50], [53, 53]], rot: 3 },
      { type: 'lumber', at: [50, 53] },
      { type: 'tree', ring: [8, 8, 39, 39], parity: 0, skip: [[26, 8, 3, 1], [26, 46, 3, 1], [8, 26, 1, 3], [46, 26, 1, 3]] },
      { type: 'tree', line: [0, 5, 24, 5, 2] },
      { type: 'tree', line: [30, 5, 48, 5, 2] },
      { type: 'tree', line: [5, 6, 5, 24, 2] },
      { type: 'tree', line: [5, 30, 5, 48, 2] },
      { type: 'tree', line: [6, 49, 20, 49, 2] },
      { type: 'tree', line: [34, 49, 48, 49, 2] },
      { type: 'tree', line: [49, 0, 49, 20, 2] },
      { type: 'tree', line: [49, 34, 49, 46, 2] }
    ]
  }
];
