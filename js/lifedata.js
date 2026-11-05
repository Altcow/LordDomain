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

// 居民類型:w 基礎權重;spd 格/秒;looks 為 ART.UNIT 的 NPC 外觀 key;
// to 為目的地建築權重(空 = 只會離城);needs 為至少需要其中一種建築才會生成;stop 為途中停點;
// night:'no' 夜間不出現,'only' 只在夜間出現,其餘夜間權重大幅降低(只剩巡夜與醉漢)
const LIFE_TYPES = {
  civ:     { name: '平民', looks: ['man', 'man2', 'woman', 'woman2'], w: 30, spd: 0.9, to: { house: 3, market: 2 } },
  elder:   { name: '老人', looks: ['elder'], w: 5, spd: 0.5, to: { house: 3, market: 1 }, needs: ['house'] },
  kid:     { name: '孩童', looks: ['kid', 'kid2'], w: 8, spd: 1.2, to: { house: 3 }, needs: ['house'], night: 'no' },
  farmer:  { name: '農夫', looks: ['farmer'], w: 10, spd: 0.8, to: { house: 3, lumber: 1, quarry: 1 }, needs: ['house'] },
  vendor:  { name: '商販', looks: ['peddler'], w: 8, spd: 0.7, to: {}, needs: ['market'], stop: 'market' },
  scholar: { name: '書生', looks: ['scholar'], w: 4, spd: 0.7, to: { research: 2, palace: 1 } },
  beggar:  { name: '乞丐', looks: ['beggar'], w: 3, spd: 0.5, to: { market: 2, palace: 2 } },
  smith:   { name: '工匠', looks: ['smith'], w: 5, spd: 0.8, to: { lumber: 2, quarry: 2, house: 1 }, needs: ['lumber', 'quarry'] },
  soldier: { name: '巡邏兵', looks: ['patrol'], w: 6, spd: 0.8, to: { palace: 2, archer: 1, shield: 1, cavalry: 1, siege: 1 }, needs: ['palace', 'archer', 'shield', 'cavalry', 'siege'] },
  drunk:   { name: '醉漢', looks: ['man'], w: 4, spd: 0.5, to: { market: 2, house: 1, tavern: 2, shop_wine: 1 }, needs: ['market', 'tavern', 'shop_wine', 'inn'], night: 'only' },
  // 更夫:夜間保底,只由 lifeNightTick 生成(w = 0,不參與一般抽籤),提燈沿兩個停點來回慢走
  watch:   { name: '更夫', looks: ['elder'], w: 0, spd: 0.45, to: {}, night: 'only' },
  // 商隊只由邊界入口生成(lifeSpawnCaravan),不參與一般抽籤(w = 0)
  caravan: { name: '商隊', looks: ['porter'], w: 0, spd: 0.7, to: {} },
  // 苦力只由港口設施生成(lifePortTick),不參與一般抽籤(w = 0);人數另計,不占居民目標人數
  coolie:  { name: '苦力', looks: ['coolie_sack', 'coolie_crate', 'coolie_barrow', 'porter'], w: 0, spd: 0.75, to: {} }
};

// 港口苦力:有下列設施且該設施有門格(相鄰可走道路)時,在設施之間來回搬運;沒有港口設施 = 不生成
// per:每個有門格的設施貢獻幾名苦力(取整進位);max:全場苦力上限(手機效能);empty:放下貨後換成的空手外觀
const LIFE_PORT_TYPES = {
  dock: 1, pier_plank: 1, wharf_platform: 1, mooring_post: 1, warehouse_port: 1, crane_pole: 1, fish_market: 1, shipyard: 1,
  cargo_sacks: 1, cargo_crates: 1, cargo_jars: 1, cargo_salt: 1, cargo_silk: 1
};
const LIFE_PORT = {
  per: 1.5, max: 12,
  empty: { coolie_sack: 'coolie_free', coolie_crate: 'coolie_free', coolie_barrow: 'coolie_barrow0', porter: 'coolie_free' }
};
const LIFE_COOLIE_LINES = [
  '嘿喲,這包可真沉!', '糧船一到就沒得歇了。', '小心腳下,別絆著纜繩。', '貨棧那邊還要三十袋呢。',
  '今天的工錢可得算清楚。', '起重的繩子要拉緊了!', '這箱子裡裝的是絲綢,輕點放。', '再搬兩趟就能歇口氣。',
  '碼頭上風大,涼快。', '讓一讓,獨輪車過了!'
];

// 居民密度(設定面板『居民密度』):每個值是「時段與季節倍率之前」的基礎人數上限
const LIFE_DENSITY = { off: 0, low: 12, mid: 60, high: 120, crowd: 200 };
const LIFE_DENSITY_DEFAULT = 'mid';

// 時段人流倍率(PLAN_CITYLIFE §5.1 的人流倍率;清晨 0.5、早市與午間 1.0、黃昏 0.8、夜 0.3)
const LIFE_TOD_MUL = { dawn: 0.5, noon: 1, dusk: 0.8, night: 0.3 };
const LIFE_WINTER_MUL = 0.7;

// 結伴 / 縱隊的服色變化:civil 外觀多一組替代服色(變體總數約 2 × civil 外觀數,遠低於 40)
const LIFE_ALT_TINTS = [
  { tunic: '#8fb37a', trim: '#4f6b3a' },
  { tunic: '#c97a5a', trim: '#7a3a1a' }
];

// 可成為居民目的地的建築(門格存在才算;其餘建築不是目的地)
const LIFE_DEST_TYPES = ['house', 'market', 'palace', 'research', 'lumber', 'quarry', 'archer', 'shield', 'cavalry', 'siege', 'tavern', 'shop_wine', 'inn'];   // 後三者:酒館小聚與醉漢(夜間保底)

// 外觀找不到 ART 時的占位服色
const LIFE_PH_COL = {
  civ: '#6fa0c8', elder: '#a89a86', kid: '#ffd24a', farmer: '#c9a46a', vendor: '#7f9e4c',
  scholar: '#f4ead2', beggar: '#8a7a66', smith: '#6a5650', soldier: '#d23a2c',
  drunk: '#9a7a4a', watch: '#d8b24a', caravan: '#c8a060', coolie: '#b89868'
};

// ---------------- 街景角色(js/citytraffic.js 使用;資料表驅動) ----------------
// 走販 / 馬車 / 騎馬者 / 站崗與巡邏衛兵 / 叫賣者 / 圍觀者 / 車夫。與一般居民、苦力各自獨立計數,不占居民目標人數。
// 類型表在 citytraffic.js 載入時併入 LIFE_TYPES(w = 0,不參與一般抽籤);bub = 頭上泡泡種類、bubP = 週期秒、frr = 走路動畫速率(格/秒的步頻)。
const LIFE_XTYPES = {
  peddler:      { name: '走販', looks: ['peddler', 'hawker_cart'], w: 0, spd: 0.65, to: {}, bub: 'talk', bubP: 5 },
  wagon:        { name: '馬車', looks: ['wagon_goods', 'wagon_hay', 'wagon_fancy'], w: 0, spd: 0.95, to: {}, frr: 3 },
  rider:        { name: '騎馬者', looks: ['courier', 'courier_w', 'qingqi'], w: 0, spd: 2.5, to: {}, frr: 8 },
  guard_post:   { name: '城衛兵', looks: ['patrol', 'changji', 'daodun'], w: 0, spd: 0.7, to: {} },
  guard_patrol: { name: '巡邏衛兵', looks: ['patrol'], w: 0, spd: 0.75, to: {} },
  hawker:       { name: '叫賣者', looks: ['hawker_tray', 'hawker_cart', 'peddler'], w: 0, spd: 0, to: {}, bub: 'talk', bubP: 6 },
  onlooker:     { name: '圍觀者', looks: ['man', 'man2', 'woman', 'woman2', 'elder', 'kid'], w: 0, spd: 0, to: {}, bub: 'question', bubP: 11 },
  hand:         { name: '車夫', looks: ['porter', 'coolie_free'], w: 0, spd: 0, to: {} }
};
const LIFE_XPH_COL = {
  peddler: '#7f9e4c', wagon: '#a8692f', rider: '#3e8a6a', guard_post: '#d23a2c', guard_patrol: '#d23a2c',
  hawker: '#e3b95c', onlooker: '#8fb0c8', hand: '#b89868'
};
// 卡片上的細分身分(依外觀)
const LIFE_LOOK_TITLE = {
  wagon_goods: '運貨馬車', wagon_hay: '運草牛車', wagon_fancy: '載客馬車', courier: '快馬信使', courier_w: '騎士', qingqi: '輕騎傳令',
  hawker_tray: '叫賣胡餅的小販', hawker_cart: '推車叫賣的小販', changji: '長戟衛兵', daodun: '刀盾衛兵'
};

// 各類上限(最高密度時);實際人數 = 上限 × 密度倍率,且全體另受 LIFE_ALL_MAX 約束
const LIFE_XCAP = { peddler: 6, wagon: 4, rider: 4, guard_post: 16, guard_patrol: 3, hawker: 8, onlooker: 12, hand: 4 };
const LIFE_XSQUAD = [2, 4];                       // 巡邏小隊人數
const LIFE_XMUL = { off: 0, low: 0.3, mid: 0.7, high: 1, crowd: 1 };
const LIFE_ALL_MAX = { off: 0, low: 26, mid: 100, high: 190, crowd: 280 }; // 全體路人(居民 + 苦力 + 街景角色)人數上限,低階手機再 ×0.5
const LIFE_XCD = { peddler: 6, wagon: 14, rider: 9, hawker: 3, onlooker: 1.5, guard_post: 0.5, guard_patrol: 6 }; // 同類兩次生成的最短間隔(秒)
const LIFE_PARK = { min: 60, max: 180, handChance: 0.6 }; // 馬車停靠秒數、旁邊出現車夫 / 苦力的機率

// 可停靠點:門格(相鄰可走道路格)。cap = 同一格最多幾輛車
const LIFE_DOCK_TYPES = {
  inn: 1, post_station: 1, dock: 2, warehouse_port: 2, wharf_platform: 2, fish_market: 1, shipyard: 1, crane_pole: 1
};
// 軍事 / 城防建築權重(w 累計成「軍事分數」,決定衛兵人數);wall 為每段牆,權重低
const LIFE_MIL = {
  wall: { w: 0.125, k: 'wall' }, wall_courtyard: { w: 0.125, k: 'wall' },
  gate: { w: 2, k: 'gate' }, gate_courtyard: { w: 2, k: 'gate' }, toll_gate: { w: 2, k: 'gate' },
  beacon: { w: 1, k: 'tower' }, deco_watchtower: { w: 1, k: 'tower' }, drum_tower: { w: 1, k: 'tower' },
  army_camp: { w: 2, k: 'camp' }, archer: { w: 1, k: 'camp' }, shield: { w: 1, k: 'camp' }, cavalry: { w: 1, k: 'camp' }, siege: { w: 1, k: 'camp' }
};
const LIFE_POST_W = { palace: 3, gate: 4, camp: 3, tower: 2, wall: 1 }; // 站崗點挑選權重

// 專屬台詞(貼近東漢)
const LIFE_LINES = {
  coolie: LIFE_COOLIE_LINES,
  peddler: [
    '新鮮的胡餅,剛出爐的!', '糖餳!又香又甜的糖餳!', '針線頭繩,走過路過瞧一瞧。', '買把蔥吧,清早才拔的。',
    '涼水一碗,一個五銖錢!', '補鍋補碗嘍——', '客官,來塊餅墊墊肚子?', '今年的新棗,脆甜得很!'
  ],
  wagon: [
    '這車粟米要趕在天黑前進倉。', '馬兒累了,在這歇歇腳。', '借過借過,車沉得很!', '前頭那家客棧還有空房嗎?',
    '聽說北邊的路不太平。', '輪子又鬆了,得找人緊一緊。', '運的是上好的絲綢,可不敢顛。', '到驛站換匹馬,明早接著趕路。'
  ],
  rider: [
    '讓道!快馬傳信!', '軍情急報,閒人讓開!', '駕——!', '公文在身,恕不下馬!', '驛站還有多遠?', '城主安好!在下趕路,失禮了!'
  ],
  guard_post: [
    '有令牌嗎?', '城門重地,閒人勿近。', '站住,通報姓名!', '近來黃巾餘黨出沒,務必小心。',
    '夜裡城門要早閉。', '奉城主之令,在此把守。', '看什麼看,往前走!', '換崗的怎麼還沒來……'
  ],
  guard_patrol: [
    '巡邏中,各處如常。', '都跟緊,別落隊!', '前面街口再看一圈。', '夜裡留神火燭。', '有事報與城主府。', '可疑之人,一律盤查。'
  ],
  hawker: [
    '新鮮的胡餅,熱乎乎的!', '上好的麥餅,來嚐嚐!', '賣漿賣漿,冰涼解渴!', '包子,剛出籠的包子!',
    '走過路過,別錯過!', '五銖錢一個,不貴不貴!', '客官請看,這是今早現做的。'
  ],
  onlooker: [
    '這是在賣什麼?', '哎呀,看著真香。', '讓我瞧瞧,別擠!', '這價錢也太貴了吧。', '聽說這家的餅最好吃。', '我再看看,不急。'
  ],
  hand: [
    '馬還沒餵呢。', '卸貨,輕點放!', '這車貨不能耽擱。', '給馬添點草料。', '歇一會兒再趕路。', '客官住店?後院有馬棚。'
  ]
};
