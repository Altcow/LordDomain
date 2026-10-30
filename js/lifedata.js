// lifedata.js — 居民人流資料(PLAN_CITYLIFE.md C0):類型、姓名、通用台詞
// 只放資料,不含執行邏輯;執行期邏輯在 citylife.js。

// 東漢風姓名(C0 小卡用,隨機指派給居民)
const LIFE_NAMES = [
  '趙元', '劉六', '陳伯', '許明', '馬三', '王禾', '李伯起', '周大', '郭仲', '程黑',
  '韓二', '甘子', '丁阿奴', '薛石', '盧仲', '鄭寡', '袁阿三', '吳長', '蔡伯', '孟元'
];

// 通用招呼語(C0 小卡用;C1 會換成依才能、時段的完整模板)
const LIFE_GREET = [
  '城主安好。', '今日風涼,城主也出來走走?', '路上小心,別踩了泥。', '粟價又高了,唉。',
  '城主府的瓦新換過了?', '小人這就回家去。', '天晴好種地。', '聽說西邊的河又漲了。',
  '孩子們,別跑遠了!', '您也來逛市集?', '這鋤頭是新打的,好用得很。', '家裡還等著我下鍋呢。',
  '今年的收成還可以。', '路過借個道,失禮了。', '城牆修得真結實。', '年成不好,大家省著點用。',
  '請城主安。', '早啊,今兒天氣真好。', '你聽,市集那邊又吵起來了。', '牛車明天要進城呢。',
  '晚了,快回屋吧。', '這布料可是好貨。', '咱們這小城,近來熱鬧多了。', '勞煩讓一讓。',
  '城主,小人有句實話。', '水井的水甜,來一口?', '老天爺,保佑今年別鬧災。', '我家的狗又跑丟了。',
  '街上這麼多人,真是好景象。', '讀了書才知道道理。'
];

// 居民類型(C0 最小集):w 基礎權重;spd 格/秒;looks 為 ART.UNIT 的 NPC 外觀 key;
// to 為目的地建築權重(空 = 只會離城);needs 為至少需要其中一種建築才會生成;stop 為途中停點
const LIFE_TYPES = {
  civ:     { name: '平民', looks: ['man', 'man2', 'woman', 'woman2'], w: 30, spd: 0.9, to: { house: 3, market: 2 } },
  elder:   { name: '老人', looks: ['elder'], w: 5, spd: 0.5, to: { house: 3, market: 1 }, needs: ['house'] },
  kid:     { name: '孩童', looks: ['kid', 'kid2'], w: 8, spd: 1.2, to: { house: 3 }, needs: ['house'] },
  farmer:  { name: '農夫', looks: ['farmer'], w: 10, spd: 0.8, to: { house: 3, lumber: 1, quarry: 1 }, needs: ['house'] },
  vendor:  { name: '商販', looks: ['peddler'], w: 8, spd: 0.7, to: {}, needs: ['market'], stop: 'market' },
  scholar: { name: '書生', looks: ['scholar'], w: 4, spd: 0.7, to: { research: 2, palace: 1 } },
  beggar:  { name: '乞丐', looks: ['beggar'], w: 3, spd: 0.5, to: { market: 2, palace: 2 } },
  smith:   { name: '工匠', looks: ['smith'], w: 5, spd: 0.8, to: { lumber: 2, quarry: 2, house: 1 }, needs: ['lumber', 'quarry'] },
  soldier: { name: '巡邏兵', looks: ['patrol'], w: 6, spd: 0.8, to: { palace: 2, archer: 1, shield: 1, cavalry: 1, siege: 1 }, needs: ['palace', 'archer', 'shield', 'cavalry', 'siege'] }
};

// 可成為居民目的地的建築(門格存在才算;其餘建築不是目的地)
const LIFE_DEST_TYPES = ['house', 'market', 'palace', 'research', 'lumber', 'quarry', 'archer', 'shield', 'cavalry', 'siege'];

// 外觀找不到 ART 時的占位服色
const LIFE_PH_COL = {
  civ: '#6fa0c8', elder: '#a89a86', kid: '#ffd24a', farmer: '#c9a46a', vendor: '#7f9e4c',
  scholar: '#f4ead2', beggar: '#8a7a66', smith: '#6a5650', soldier: '#d23a2c'
};
