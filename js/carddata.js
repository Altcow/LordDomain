// js/carddata.js — 卡牌與酒館 第一階段純資料(PLAN_CARDS.md v3:§2.2~2.6、§3A、§3.5、§4.4、§4.13、§5.4、§7.1;城建專注模式)。
// 數字多為 PLACEHOLDER。戰、統、謀與名人專屬詞條資料保留但第一階段不啟用(CARD_TRAITS.cls / card.trn 標示)。
// 驗證:node tools/test_cards.js(含名人表 lint)。不寫 DOM、不讀時間。ES2017;不用 ?. ??。
// 【占位,待手填】名人的職業欄位(CARD_FIGS 無 ja/main)目前由五維自動推導(cards.js cardFigJobs);之後可逐位寫入 CARD_FIG_JOB_OVERRIDE 覆寫,不必改 CARD_FIGS。
// 全域名稱:CARD_GRADE CARD_STATS CARD_LEARN CARD_FAC CARD_ROWS CARD_JOB_TIERPCT CARD_JOBS CARD_JOB_BY_ID CARD_JOB_PORTRAIT CARD_POST_GROUP CARD_VENUE_ORDER CARD_VENUES
//          CARD_EXAM_SUBJECTS CARD_COST CARD_DRAW CARD_STARTER CARD_CFG CARD_BAG CARD_FURNACE CARD_FIG_WEIGHT CARD_UPGRADE CARD_NAME_SUR CARD_NAME_GIV CARD_TRAITS CARD_TRAIT_BY_ID CARD_SKILLS CARD_SKILL_BY_ID CARD_SKILL_BY_ROW CARD_FIGS CARD_FIG_BY_ID CARD_FIG_JOB_OVERRIDE CARD_VISIT

// 品階(§3A.1):lo/hi 生成參數;stCap 單項基礎上限;tai 才帶;jobSlots 職業詞條槽;jobMax 職業最高階;learn 學養型分布(通才/偏才/專才/宗師 %);trN 一般詞條數;skn 技能數(第一階段只記數量)
var CARD_GRADE = [
  { id: 0, name: '白', ch: '白', corner: 0, css: '--gr0', lo: 20, hi: 60, stCap: 70,  tai: [150, 240], jobSlots: [1, 3], jobMax: 1, learn: [100, 0, 0, 0],  trN: [0, 1], skn: 0, cost: 1,  line: '市井百工,一技傍身' },
  { id: 1, name: '青', ch: '青', corner: 1, css: '--gr1', lo: 28, hi: 68, stCap: 78,  tai: [210, 280], jobSlots: [2, 3], jobMax: 2, learn: [70, 30, 0, 0],  trN: [1, 1], skn: 0, cost: 2,  line: '鄉里能手' },
  { id: 2, name: '藍', ch: '藍', corner: 2, css: '--gr2', lo: 35, hi: 75, stCap: 85,  tai: [250, 320], jobSlots: [3, 4], jobMax: 3, learn: [45, 45, 10, 0], trN: [1, 2], skn: 1, cost: 4,  line: '一方幹才' },
  { id: 3, name: '紫', ch: '紫', corner: 3, css: '--gr3', lo: 42, hi: 82, stCap: 92,  tai: [290, 360], jobSlots: [4, 5], jobMax: 4, learn: [30, 40, 25, 5], trN: [1, 2], skn: 2, cost: 8,  line: '州郡英才' },
  { id: 4, name: '金', ch: '金', corner: 4, css: '--gr4', lo: 0,  hi: 0,  stCap: 100, tai: [0, 999],   jobSlots: [5, 6], jobMax: 4, learn: [0, 0, 0, 0],    trN: [2, 3], skn: 3, cost: 16, line: '名垂青史(名人)' }
];
var CARD_STATS = ['統', '武', '智', '政', '魅'];
var CARD_LEARN = ['通才', '偏才', '專才', '宗師'];
var CARD_FAC = ['魏', '蜀', '吳', '黃巾', '中立'];

// 職業(§4.13.2):行、id、名、四階名、效率對象、主職司、標籤、宗師舞台。階值 I/II/III/IV 累計 5/15/30/55 %
var CARD_JOB_TIERPCT = [0, 5, 15, 30, 55];
var CARD_ROWS = ['農', '工', '商', '文', '醫', '政', '武'];
var CARD_JOBS = [
  { id: 'nongshi',  row: '農', name: '農事', t: ['耕夫', '老農', '力田', '農師'],     eff: '田類糧產', post: '田曹', tag: '農家', stage: '耬車作坊或常平倉' },
  { id: 'xumu',     row: '農', name: '畜牧', t: ['牧童', '牧人', '廄長', '牧監'],     eff: '牲口棚、馬場產出', post: '牧苑', tag: '農家', stage: '馬場' },
  { id: 'yulie',    row: '農', name: '漁獵', t: ['網戶', '漁人', '漁師', '澤虞'],     eff: '魚場糧產與商', post: '牧苑', tag: '水軍', stage: '魚場 + 曬魚架' },
  { id: 'linmu',    row: '農', name: '林木', t: ['樵夫', '伐木工', '林師', '山虞'],   eff: '伐木產木', post: '工曹', tag: '工匠', stage: '伐木場 ≥ 3' },
  { id: 'zhishui',  row: '農', name: '治水', t: ['井匠', '渠工', '陂長', '都水'],     eff: '供水容量、洪災 −', post: '水曹', tag: '農家', stage: '堤或翻車' },
  { id: 'yingzao',  row: '工', name: '營造', t: ['泥瓦匠', '木作', '大匠', '將作'],   eff: '城市升級資源 −、大工程花費 −', post: '將作', tag: '工匠', stage: '縣衙(任一段)' },
  { id: 'yetie',    row: '工', name: '冶鐵', t: ['鍛工', '鐵匠', '冶師', '鐵官'],     eff: '鐵錠產出', post: '冶坊', tag: '工匠', stage: '冶鐵坊(水排)' },
  { id: 'taoci',    row: '工', name: '陶瓷', t: ['陶工', '窯匠', '陶師', '陶正'],     eff: '陶窯產與商', post: '窯坊', tag: '工匠', stage: '陶窯 ≥ 2' },
  { id: 'fangzhi',  row: '工', name: '紡織', t: ['繅絲人', '織工', '錦匠', '織室'],   eff: '麻布、布帛產出;染坊', post: '織坊', tag: '工匠', stage: '染坊' },
  { id: 'niangzao', row: '工', name: '釀造', t: ['酒童', '釀工', '酒師', '酒正'],     eff: '酒館、茶館商與心', post: '酒食坊', tag: '工匠', stage: '酒館 + 茶館' },
  { id: 'jiqiao',   row: '工', name: '機巧', t: ['木匠', '巧手', '機匠', '神工'],     eff: '水車、翻車、石磨、耬車的「→田」加成', post: '將作(輔)', tag: '工匠', stage: '翻車' },
  { id: 'caishi',   row: '工', name: '採石', t: ['石工', '鑿工', '石師', '石官'],     eff: '採石產石', post: '工曹', tag: '工匠', stage: '採石場 ≥ 3' },
  { id: 'zaozhi',   row: '工', name: '造紙', t: ['漚麻工', '抄紙工', '紙匠', '紙師'], eff: '紙產出、造紙坊學識', post: '紙坊', tag: '工匠', stage: '造紙坊 + 書肆' },
  { id: 'shangcai', row: '商', name: '商才', t: ['貨郎', '坐賈', '大賈', '陶朱'],     eff: '市集、店鋪商稅', post: '市令', tag: '商賈', stage: '市樓' },
  { id: 'jisuan',   row: '商', name: '計算', t: ['算童', '書算', '計吏', '度支'],     eff: '稅收損耗 −', post: '戶曹', tag: '官僚', stage: '錢莊' },
  { id: 'zhouche',  row: '商', name: '舟車', t: ['腳夫', '車把式', '漕長', '轉運'],   eff: '道路暢通、碼頭與驛站商、商隊收益', post: '驛傳', tag: '水軍', stage: '碼頭或驛站 + 石板路' },
  { id: 'ciling',   row: '商', name: '辭令', t: ['跑腿', '說客', '行人', '鴻臚'],     eff: '外交關係變化、掌櫃招募', post: '驛傳(輔)、掌櫃、中正(輔)', tag: '士人', stage: '驛站' },
  { id: 'wenshu',   row: '文', name: '文書', t: ['書童', '書佐', '主簿', '尚書'],     eff: '學識、政令維持費 −', post: '學官', tag: '士人', stage: '精舍或學院 ≥ 3 級' },
  { id: 'jiaohua',  row: '文', name: '教化', t: ['塾師', '經師', '博士', '祭酒'],     eff: '教化、學院進修花費 −', post: '學官、學院教習、中正', tag: '士人', stage: '學院 ≥ 4 級' },
  { id: 'yuewu',    row: '文', name: '樂舞', t: ['樂童', '樂工', '樂師', '協律'],     eff: '樂類建築的民心與文', post: '樂府', tag: '士人', stage: '戲台' },
  { id: 'tianwen',  row: '文', name: '天文', t: ['卜者', '日者', '靈台郎', '太史'],   eff: '天災機率 −、預警 +', post: '靈台', tag: '方士', stage: '祠廟或觀' },
  { id: 'lvfa',     row: '文', name: '律法', t: ['亭卒', '游徼', '賊曹', '廷尉'],     eff: '治安', post: '賊曹', tag: '官僚', stage: '縣衙' },
  { id: 'yishu',    row: '醫', name: '醫術', t: ['藥童', '郎中', '醫師', '國手'],     eff: '疫病風險 −、疫情恢復 +', post: '醫署', tag: '醫者', stage: '醫館' },
  { id: 'paochu',   row: '醫', name: '庖廚', t: ['灶下', '庖人', '膳夫', '太官'],     eff: '食需求覆蓋、米舖心、糧耗 −', post: '酒食坊', tag: '工匠', stage: '米舖 + 酒館' },
  { id: 'lizhi',    row: '政', name: '吏治', t: ['鄉吏', '掾史', '長史', '令尹'],     eff: '太守升級折扣、政令維持費 −', post: '太守、戶曹(輔)', tag: '官僚', stage: '郡府(縣衙第 2 段)' },
  { id: 'bingshi',  row: '武', name: '兵事', t: ['什長', '屯長', '軍侯', '校尉'],     eff: '文字守城城防分(和平模式時隱藏)', post: '尉曹', tag: '將門', stage: '兵營 ≥ 2' }
];
var CARD_JOB_BY_ID = {};
CARD_JOBS.forEach(function (j) { CARD_JOB_BY_ID[j.id] = j; });
// 路人頭像檔名對照:職業 id → assets/portraits/generic/<此值>_<a|b|c>.webp(26 職業 × 3 變體 = 78 張)
var CARD_JOB_PORTRAIT = {
  nongshi: 'nongshi',
  xumu: 'xumu',
  yulie: 'yulie',
  linmu: 'linmu',
  zhishui: 'zhishui',
  yingzao: 'yingzao',
  yetie: 'yetie',
  taoci: 'taoci',
  fangzhi: 'fangzhi',
  niangzao: 'niangzao',
  jiqiao: 'jiqiao',
  caishi: 'caishi',
  zaozhi: 'zaozhi',
  shangcai: 'shangcai',
  jisuan: 'jisuan',
  zhouche: 'zhouche',
  ciling: 'ciling',
  wenshu: 'wenshu',
  jiaohua: 'jiaohua',
  yuewu: 'yuewu',
  tianwen: 'tianwen',
  lvfa: 'lvfa',
  yishu: 'yishu',
  paochu: 'paochu',
  lizhi: 'lizhi',
  bingshi: 'bingshi'
};
// 派工頁(lordhallui LH_SLOTS 的 grp:文 / 商 / 工)對照:職業行 → 群組字
var CARD_POST_GROUP = { '農': '工', '工': '工', '商': '商', '文': '文', '醫': '文', '政': '文', '武': '工' };

// 招募場所(§2.3、§2.4、§2.5):periodMs 期長(招募歲鐘 = 真實時間);cap 累積上限;gr 品階機率(%,白青藍紫金);
// floor 批內保底品階(至少 1 位 ≥);upper 十批保底的「上等」(gr = 品階;zhuan = 1 表示紫須專才以上);bFig 紫中 B 級名人機率;aFig 金 = A 級名人
// 2026-11-09 起酒館 / 縣試的節奏與每批張數改由 CARD_DRAW 決定(periodMs / cap / unit 只留給舊資料參考;batch = 一批最多張數)
var CARD_VENUE_ORDER = ['T', 'E', 'G'];
var CARD_VENUES = {
  T: { id: 'T', name: '酒館', alias: '招賢酒肆', periodMs: 3600000, cap: 48, batch: 7, gr: [65, 30, 5, 0, 0], floor: 1, upper: { gr: 2, zhuan: 0 }, gate: 'cardpack', org: 'bu', orgName: '布衣', bFig: 0, aFig: 0, theme: 'wind', unit: '1 歲' },
  E: { id: 'E', name: '縣試', alias: '九品中正考課', periodMs: 14400000, cap: 12, batch: 7, gr: [30, 40, 24, 6, 0], floor: 2, upper: { gr: 3, zhuan: 0 }, gate: 'exam', org: 'pin', orgName: '縣試', bFig: 0.16, aFig: 0, theme: 'subject', unit: '4 歲',
       starGr: { 2: [24.6, 40, 27.6, 7.8, 0], 3: [19.2, 40, 31.2, 9.6, 0] } },
  G: { id: 'G', name: '殿試', alias: '天子親策', periodMs: 86400000, cap: 2, batch: 7, gr: [6, 30, 38, 20, 6], floor: 3, upper: { gr: 3, zhuan: 1 }, gate: 'dianshi', org: 'dian', orgName: '徵辟', bFig: 0.16, aFig: 1, theme: 'faction', unit: '1 日' }
};
// 縣試科目(§2.3):依期輪替;該科職業權重 ×3(jobs 指定職業,rows 指定整行)
var CARD_EXAM_SUBJECTS = [
  { id: 'xiaolian', name: '孝廉', jobs: ['lizhi', 'lvfa'] },
  { id: 'maocai', name: '茂才', jobs: ['wenshu', 'jiaohua'] },
  { id: 'mingjing', name: '明經', jobs: ['jiaohua', 'wenshu'] },
  { id: 'mingfa', name: '明法', jobs: ['lvfa', 'jisuan'] },
  { id: 'xianliang', name: '賢良方正', jobs: ['lizhi', 'ciling'] },
  { id: 'bing', name: '勇猛知兵法', jobs: ['bingshi'] },
  { id: 'baigong', name: '百工', rows: ['工'] },
  { id: 'litian', name: '力田', rows: ['農'] }
];

// 遣散碎片(2026-11-09 使用者決議:酒令與『任用』已移除,抽到的卡直接進名冊):CARD_GRADE[gr].cost = 路人遣散換得的碎片基準(× CARD_DRAW.relRate),宗師型 +zongBonus
var CARD_COST = { zongBonus: 4 };
// 抽卡節奏『每日一抽』(2026-11-09 使用者決議;數值皆 PLACEHOLDER)。酒館(T)、縣試(E)各自計時:新存檔第一次進入立刻有 1 批;之後每 gap 小時 1 批、每批 size 張;
//   離線最多累積 stock 批(不無限堆積);size / gap 依科技升級(取已研成的最高一階)。指名(G)不靠計時,仍用指名券。
//   pity = 酒館 / 縣試連續幾批沒出上等,下一批保底(指名仍用 CARD_CFG.pityBatches)。
//   舊存檔遷移(cs.v < 2,一次性):酒令 1 → 碎片 wineShard;里程碑原 +10 令 → +mileShard 碎;請回流浪名人原 10 令 → recallShard 碎;遣散路人碎片 = cost × relRate(與舊規則同值)
//   階梯節點選在簡化科技樹(citysimple.js,預設開)裡仍各自獨立的文教節點:書肆(第 2 時代)→ 東觀校書(第 3)→ 鴻都門學(第 4);
//   (舉孝廉在簡化樹併入了開酒館 / 考場的節點、月旦評 / 察舉考課 / 太學都併入鴻都門學,所以不用)。完整科技樹同樣有這三個節點。
//   2026-11-09 改『抽卡次數制』(使用者決議):不再分批。全域一個次數錢包 cs.pl.n(酒館池 T、縣試池 E 共用),每 gap 小時 +size.n 抽(離線依時間補算),累積上限 cap(100;新手禮與關卡贈抽不受上限截斷);
//   每抽 1 次出 1 張,單抽或連抽(一次最多 maxOne 張走同一段開卡特效)。pity = 連續幾『張』沒出上等,下一張必出(原 5 批 × 4 張 ≈ 20 張);floorMin = 連抽張數 ≥ 此值才套用『批內底線 / 學院生徒』。stock 只留給舊存檔遷移(舊批數 × 當階張數 → 次數)
var CARD_DRAW = {
  stock: 2, cap: 100, maxOne: 10, floorMin: 7,
  size: [{ n: 4 }, { n: 5, tech: 'wr_shusi' }, { n: 6, tech: 'e_wuzhu' }, { n: 7, tech: 'ed_hongdu' }],
  gap: [{ h: 24 }, { h: 18, tech: 'wr_shusi' }, { h: 12, tech: 'e_wuzhu' }, { h: 8, tech: 'ed_hongdu' }],
  pity: 20,
  wineShard: 5, mileShard: 50, recallShard: 50, relRate: 1
};
// 首次通關各章頭目關(bn_stages.js 第 6 關)送抽卡次數(寫進任務清單;cs.boss 記錄防重領)
var CARD_BOSS = { pulls: 10 };
// 新手禮包(使用者回饋「前期抽卡太小氣」;數值皆 PLACEHOLDER)。新世界第一次開招賢面板時一次性領取,存 cs.starter(cards.js cardsStarter*;舊存檔已有卡片或已畢業教學 = 不適用、不補發)。
//   pulls 張,分 batches 批開(沿用開批 → 抽卡特效 → 入卡包,不自動熔爐);gr = 禮包每張的基本品階機率(白青藍紫金 %),再套保底:至少 goldGuarantee 張金(名人;魔幻世界優先本族英雄)、另至少 purpleGuarantee 張紫
//   namedTokens 指名券(指名池還沒研發也能用這幾張);禮包的卡與抽卡一樣直接進名冊(名冊滿了先放卡包)
//   新手期:領取後的前 nbCards 張(酒館 / 縣試開批的卡)改用 nbGr 品階機率,並有逐張保底:連續 nbPurple − 1 張沒有紫以上 → 下一張必紫;連續 nbGold − 1 張沒有金 → 下一張必金(名人)
//   (每日一抽後每批 4 張:nbPurple 10 → 8、nbGold 50 → 30,讓前一兩週仍有紫金進帳)
var CARD_STARTER = {
  pulls: 36, legacyPulls: 20, batches: 3, gr: [20, 40, 30, 10, 0], goldGuarantee: 1, purpleGuarantee: 2, namedTokens: 3,
  nbCards: 100, nbGr: { T: [52, 30, 10, 6, 2], E: [26, 38, 26, 8, 2] }, nbPurple: 8, nbGold: 30
};
var CARD_CFG = {
  capBase: 14,             // 名額基數:缺官階模組(lordhallui)時的退路(§7A.1 Lv10 = 14);可由 cardsCapBonus() 追加
  capRank0: 10, capPerRank: 2, capMax: 40,   // 無等級版名額 = 10 + 官階等級 × 2,上限 40(官階等級 = lordhallui 官階表序號 1~);官階降低不踢人,只是新抽到的卡先放卡包
  waitSeats: 5,            // 待定席(卡包上線後任用不再進待定席;只保留舊存檔既有的待定席人物)
  tokMax: 5,               // 名人信物上限
  paceMin: 10,             // 時鐘回撥容忍(分鐘)
  fameAfter: 20, fameStep: 0.2, goldMax: 8,   // 殿試名人緣(百分點);goldMax = 金階機率上限(基礎 6 + 最多再加 2,原 2 + 2 = 4 同幅度)
  pityBatches: 9,          // 連續 9 批無上等 → 第 10 批保底
  upMax: 2, privStCap: 92  // 升階次數、路人基礎單項上限
};
// 升階條件(§3A.5;PLACEHOLDER)。ctx 欄位:academy 院級、lv 人物等級、cityLv 城級、xue 學識、coin 金幣、lessons 課數、flag 事件旗標
var CARD_UPGRADE = [
  { from: 0, to: 1, route: '學院進修', academy: 3, lv: 5,  jobMin: 1, xue: 120,  coin: 1500,  lessons: 2 },
  { from: 1, to: 2, route: '學院進修', academy: 4, lv: 10, jobMin: 2, xue: 300,  coin: 5000,  lessons: 3 },
  { from: 2, to: 3, route: '縣試品評', academy: 4, lv: 0,  jobMin: 3, xue: 500,  coin: 12000, lessons: 0, cityLv: 15, flag: 'pinping' },
  { from: 3, to: 4, route: '立傳',     academy: 0, lv: 20, jobMin: 4, xue: 1500, coin: 30000, lessons: 0, flag: 'lizhuan' }
];
// 學院(§7B;數值皆 PLACEHOLDER,集中於此)。院級 = 學舍 / 學宮 / 精舍建築數 + 科技(academyLevel);進修花費以『碎片』與金幣為主
// (碎片 = 卡片熔爐所得,同一碎片池 cs.shards;碎片不再自動轉酒令,付費直接扣 cs.shards)
var CARD_ACADEMY = {
  // 旬報計課(PLAN_CARDS §7B.3、PLAN_CITY §16.2):1 課 = 1 次旬報。旬報觸發:施政動作累計 acts 次(放置 / 拆除 / 研發,5 秒內連續刷算 1 次)、本機換日後第一次開啟、名冊「結束本旬」鈕;每本機日最多 dayMax 次
  xun: { acts: 12, dayMax: 6 },
  rushRate: 0.5,       // 速成:剩餘課數立即結業,額外花 原碎片 × 此值
  quitRefund: 0.5,     // 退學:退還已付碎片 / 金幣的比例
  seats: [0, 2, 3, 4, 5, 6],   // 進修席(依院級 0~5)
  teachers: [0, 0, 1, 1, 2, 2],   // 教習席(依院級 0~5;PLAN §7B.2,PLACEHOLDER)
  teachPerTier: 0.05,             // 教習:進修花費 −(教習教化階 × 此值)(PLAN §7B.3,PLACEHOLDER)
  teachLessonTier: 3, teachLessonCut: 1,   // 教習與學生同職業且教習 ≥ 此階 → 課數 −cut(最少 1)
  // 院級條件:tech 科技、school 學舍 + 學宮數、jing 精舍數、gong 學宮數(逐級累積判定,取連續達成的最高級)
  levels: [null,
    { name: '庠舍', tech: 'ed_xuexiao', school: 1, jing: 0, gong: 0 },
    { name: '縣學', tech: 'ed_xuexiao', school: 2, jing: 0, gong: 0 },
    { name: '書院', tech: 'wr_jingshe', school: 2, jing: 1, gong: 0 },
    { name: '郡學', tech: 'e_dongguan', school: 3, jing: 1, gong: 0 },
    { name: '太學', tech: 'ed_taixue',  school: 3, jing: 1, gong: 1 }],
  learn: { academy: 1, shards: 10, coin: 300, lessons: 1 },   // 習藝:新增一個職業 I 階(需空槽)
  swap: { academy: 3, shards: 15, coin: 400, lessons: 1 },    // 轉職:一條 I 階職業換成別職業 I 階(PLAN §7B.3 / §4.13;碎片 PLACEHOLDER)
  // 名師講學(院 5,PLACEHOLDER):教習有宗師(IV 階)職業 → 每本機日 daily 次,同職業的在學者各少 cut 課;花費碎片 / 金幣
  lecture: { academy: 5, tier: 4, shards: 30, coin: 3000, daily: 1, cut: 1 },
  // 生徒(PLAN §7B.3,院 2 起):每批縣試的最後一位換成本院生徒(非名人、至少青;院 blueLv 起 blueP 機率至少藍);
  // 有教習時 biasP 機率帶教習的主職業 I 階;教習為宗師時必帶該宗師職業 I~II 階(PLACEHOLDER)
  pupil: { academy: 2, minGr: 1, blueLv: 4, blueP: 0.3, biasP: 0.4 },
  adv: [null,                                                    // 精進:依『目前階』1/2/3 → +1 階;gr = 最低品階,tenure = 派駐年資(天)
    { academy: 2, gr: 1, shards: 20,  coin: 600,  lessons: 2, tenure: 0 },
    { academy: 3, gr: 2, shards: 60,  coin: 2000, lessons: 3, tenure: 0 },
    { academy: 5, gr: 3, shards: 150, coin: 8000, lessons: 4, tenure: 8 }],
  up: [                                                          // 升階:依目前品階 0(白→青)/ 1(青→藍);院級與職業階條件沿用 CARD_UPGRADE
    { shards: 40,  coin: 1500, lessons: 2 },
    { shards: 100, coin: 5000, lessons: 3 }]
};

// 路人姓名(占位字表,非史實人物)
var CARD_NAME_SUR = ['趙', '錢', '孫', '李', '周', '吳', '鄭', '王', '馮', '陳', '褚', '衛', '蔣', '沈', '韓', '楊', '朱', '秦', '尤', '許', '何', '呂', '施', '張', '孔', '曹', '嚴', '華', '金', '魏', '陶', '姜', '戚', '謝', '鄒', '喻', '柏', '竇', '章', '雲', '蘇', '潘', '葛', '范', '彭', '郎', '魯', '韋', '昌', '馬', '苗', '鳳', '花', '方', '俞', '任', '袁', '柳', '鮑', '史', '唐', '費', '廉', '岑', '薛', '雷', '賀', '倪', '湯', '滕', '殷', '羅', '畢', '郝', '安', '常', '樂', '時', '傅', '皮', '卞', '齊', '康', '伍', '余', '元', '顧', '孟', '平', '黃', '穆', '蕭', '尹'];
var CARD_NAME_GIV = ['安', '博', '成', '達', '恩', '福', '貴', '和', '吉', '堅', '良', '明', '寧', '慶', '榮', '盛', '順', '泰', '偉', '賢', '信', '義', '勇', '玉', '源', '遠', '忠', '仲', '叔', '季', '伯', '昌', '壽', '誠', '儉', '禮', '儒', '松', '柏', '山', '川', '石', '田', '稼', '耕', '織', '鐵', '舟', '渡', '岳', '嵩', '彥', '清', '廣', '恭', '敏', '純'];

// 一般詞條(§4.4;cls:war 戰 / cmd 統 / plan 謀 / econ 經 / life 生 / trait 性 / odd 怪人;city = 1 城建相關第一階段啟用;pw 強度;neg 負面;conv 已併入職業線(舊 id 保留、新生成不抽);ex 互斥)
// 取捨類 §4.4A 與連動詞條第一階段未收錄。戰統謀(city = 0)只存資料,卡面折疊為「武略」。
var CARD_TRAITS = [
  { id: 'shanshe', n: '善射', cls: 'war', pw: 1, d: '弓弩部隊攻擊 +6 %' },
  { id: 'shenshe', n: '神射', cls: 'war', pw: 3, d: '弓弩部隊攻擊 +12 %、射程 +0.5' },
  { id: 'xianzhen', n: '陷陣', cls: 'war', pw: 2, d: '近戰接戰前 10 秒傷害 +15 %' },
  { id: 'xiandeng', n: '先登', cls: 'war', pw: 2, d: '對城牆、城門傷害 +15 %' },
  { id: 'pocheng', n: '破城', cls: 'war', pw: 2, d: '器械對建築 +10 %' },
  { id: 'qishe', n: '騎射', cls: 'war', pw: 1, d: '騎兵受遠程傷害 −10 %' },
  { id: 'tuji', n: '突擊', cls: 'war', pw: 2, d: '鋒矢衝鋒傷害 +15 %' },
  { id: 'jianshou', n: '堅守', cls: 'war', pw: 1, d: '守方:部隊受傷 −8 %' },
  { id: 'liyong', n: '膂力', cls: 'war', pw: 1, d: '武力 +5(計算時加入)' },
  { id: 'wanren', n: '萬人敵', cls: 'war', pw: 3, d: '部隊攻擊 +10 %' },
  { id: 'kangqi', n: '拒騎', cls: 'war', pw: 1, d: '被騎兵衝擊的傷害 ×0.8' },
  { id: 'shuizhan', n: '水戰', cls: 'war', pw: 1, d: '淺水與岸邊作戰不受減益' },
  { id: 'shanzhan', n: '山戰', cls: 'war', pw: 1, d: '丘陵與林地移動 +10 %' },
  { id: 'busheshe', n: '不善射', cls: 'war', pw: 1, neg: 1, d: '弓弩 −8 %;近戰 +3 %' },
  { id: 'zhijun', n: '治軍嚴整', cls: 'cmd', pw: 1, d: '潰退門檻再 −3 %' },
  { id: 'tixu', n: '體恤士卒', cls: 'cmd', pw: 1, d: '背水死戰時攻擊加成 +10 %' },
  { id: 'fengshi', n: '鋒矢陣法', cls: 'cmd', pw: 2, d: '鋒矢陣型特性 ×1.3' },
  { id: 'yuanzhen', n: '圓陣固守', cls: 'cmd', pw: 2, d: '圓陣特性 ×1.3' },
  { id: 'yanxing', n: '雁行陣法', cls: 'cmd', pw: 2, d: '雁行特性 ×1.3' },
  { id: 'bazhen', n: '八陣', cls: 'cmd', pw: 3, d: '所有陣型特性 ×1.15' },
  { id: 'chengbing', n: '精練', cls: 'cmd', pw: 2, d: '單軍兵力上限 +30' },
  { id: 'guwu', n: '鼓舞', cls: 'cmd', pw: 2, d: '光環:3 格內友軍攻擊 +4 %' },
  { id: 'suwei', n: '宿衛', cls: 'cmd', pw: 1, d: '帥帳 4 格內作戰時受傷 −10 %(守方)' },
  { id: 'yanfa', n: '嚴刑峻法', cls: 'cmd', pw: 1, neg: 1, city: 1, d: '潰退門檻 −5 %;派駐產出 −5 %' },
  { id: 'huogong', n: '火攻', cls: 'plan', pw: 2, d: '火攻起火機率 ×1.5' },
  { id: 'guantian', n: '觀天', cls: 'plan', pw: 1, d: '出征可先看到天氣表前 2 時段' },
  { id: 'ditinq', n: '地聽', cls: 'plan', pw: 2, d: '偵察時 4 格內暗陷阱現形' },
  { id: 'shibing', n: '識破', cls: 'plan', pw: 1, d: '伏兵預警再 +1 秒' },
  { id: 'maifu', n: '設伏', cls: 'plan', pw: 2, d: '守方:伏兵首擊 +20 %' },
  { id: 'gongjiang', n: '匠心', cls: 'plan', pw: 2, d: '工兵施工速度 +15 %' },
  { id: 'yishu', n: '疑兵', cls: 'plan', pw: 1, d: '守方:疑營持續時間 ×1.5' },
  { id: 'suanwu', n: '算無遺策', cls: 'plan', pw: 3, d: '智力的效果 ×1.3' },
  { id: 'shuigong', n: '水攻', cls: 'plan', pw: 2, d: '水相關地形事件效果 ×1.3' },
  { id: 'duomou', n: '多謀少決', cls: 'plan', pw: 1, neg: 1, d: '智力 +8;放行延遲 +3 秒' },
  { id: 'tuntian', n: '屯田', cls: 'econ', pw: 2, city: 1, conv: 'nongshi:2', d: '「農」職產出再 +8 %(已併入農事 II)' },
  { id: 'huozhi', n: '貨殖', cls: 'econ', pw: 2, city: 1, conv: 'shangcai:2', d: '「商」職產出再 +8 %(已併入商才 II)' },
  { id: 'yingzao', n: '營造', cls: 'econ', pw: 2, city: 1, conv: 'yingzao:2', d: '「工」職產出再 +8 %(已併入營造 II)' },
  { id: 'qinzheng', n: '勤政', cls: 'econ', pw: 1, city: 1, d: '所有職務 +3 %' },
  { id: 'lianli', n: '廉吏', cls: 'econ', pw: 1, city: 1, d: '「太守」職升級折扣 +2 %' },
  { id: 'juxian', n: '舉賢', cls: 'econ', pw: 3, city: 1, d: '「掌櫃」職:十批保底改為第 9 批觸發' },
  { id: 'mingwang', n: '名望', cls: 'econ', pw: 2, city: 1, d: '「掌櫃」職:名人機率再 ×1.1' },
  { id: 'jingxue', n: '經學', cls: 'econ', pw: 1, city: 1, conv: 'jiaohua:1', d: '「學」職科研花費再 −5 %(已併入教化 I)' },
  { id: 'suanshu', n: '心算', cls: 'econ', pw: 1, city: 1, conv: 'jisuan:1', d: '「商」職商店價格再 −2 %(已併入計算 I)' },
  { id: 'yeli', n: '冶鐵', cls: 'econ', pw: 1, city: 1, conv: 'yetie:1', d: '戰後鐵錠掉落 +1(已併入冶鐵 I)' },
  { id: 'shusheng', n: '書生氣', cls: 'econ', pw: 1, neg: 1, city: 1, d: '學職 +5 %;擔任將領時攻擊 −5 %' },
  { id: 'tanlan', n: '貪財', cls: 'econ', pw: 1, neg: 1, city: 1, d: '商職 +10 %;商店價格 +2 %' },
  { id: 'yufu', n: '漁父', cls: 'life', pw: 1, city: 1, conv: 'yulie:1', d: '釣魚咬鉤提示 +0.2 秒(已併入漁獵 I)' },
  { id: 'aishou', n: '愛獸', cls: 'life', pw: 1, city: 1, d: '仙獸苑圖鑑顯示合照(純趣味)' },
  { id: 'haojiu', n: '好酒', cls: 'life', pw: 1, city: 1, d: '城內夜間走去酒館;當酒館掌櫃時加成略高' },
  { id: 'shanyue', n: '善樂', cls: 'life', pw: 1, city: 1, d: '城內常有吹塤場面;不影響數值' },
  { id: 'yishu2', n: '通醫', cls: 'life', pw: 2, city: 1, d: '本軍負傷機率 −50 %;轉換時送醫術 I' },
  { id: 'xiangma', n: '相馬', cls: 'life', pw: 1, city: 1, conv: 'xumu:1', d: '騎兵移速 +5 %(已併入畜牧 I)' },
  { id: 'shunhua', n: '健步', cls: 'life', pw: 1, d: '步兵移速 +5 %' },
  { id: 'chuyi', n: '廚藝', cls: 'life', pw: 1, city: 1, conv: 'paochu:1', d: '城內施粥場面(已併入庖廚 I)' },
  { id: 'jinshen', n: '謹慎', cls: 'trait', pw: 1, city: 1, ex: ['lumang'], d: '受伏擊傷害 −15 %;移速 −5 %' },
  { id: 'lumang', n: '魯莽', cls: 'trait', pw: 1, neg: 1, city: 1, ex: ['jinshen'], d: '攻擊 +6 %;受伏擊傷害 +20 %' },
  { id: 'zhongyi', n: '忠義', cls: 'trait', pw: 2, city: 1, d: '不會潰退(死戰)' },
  { id: 'fanfu', n: '反覆', cls: 'trait', pw: 1, neg: 1, city: 1, d: '攻擊 +8 %;結義不可' },
  { id: 'gaoao', n: '傲上', cls: 'trait', pw: 1, neg: 1, city: 1, d: '統帥 +4;太守、掌櫃職務無效' },
  { id: 'baonue', n: '暴躁', cls: 'trait', pw: 1, neg: 1, city: 1, d: '攻擊 +8 %;偶爾誤傷身邊人' },
  { id: 'weihuo', n: '畏火', cls: 'trait', pw: 1, neg: 1, city: 1, d: '本軍受火傷害 ×1.4' },
  { id: 'qingdi', n: '輕敵', cls: 'trait', pw: 1, neg: 1, city: 1, d: '戰鬥前 30 秒攻擊 +10 %,之後受傷 +5 %' },
  { id: 'kuanhou', n: '寬厚', cls: 'trait', pw: 1, city: 1, d: '光環:3 格內友軍潰退門檻 −2 %' },
  { id: 'haoxue', n: '好學', cls: 'trait', pw: 1, city: 1, d: '經驗 +20 %' },
  { id: 'dutu', n: '賭徒', cls: 'odd', pw: 2, d: '每場開戰攻擊 ×1.25 或 ×0.85(確定性)' },
  { id: 'jiuxian', n: '酒仙', cls: 'odd', pw: 2, city: 1, ex: ['jinshen'], d: '好酒加醉態:攻擊 +12 %,陣型特性無效' },
  { id: 'fujiang', n: '福將', cls: 'odd', pw: 1, d: '本軍永不負傷;攻擊 −5 %' },
  { id: 'wancheng', n: '大器晚成', cls: 'odd', pw: 2, city: 1, d: 'Lv15 起每升一級五項各 +1' },
  { id: 'fengdian', n: '狂生', cls: 'odd', pw: 1, neg: 1, city: 1, d: '智 +10、魅 −20;不能擔任太守和掌櫃' },
  { id: 'qihuo', n: '乞活', cls: 'odd', pw: 2, d: '兵力 < 50 % 時攻擊 +15 %' },
  { id: 'tianzhen', n: '赤子', cls: 'odd', pw: 1, city: 1, d: '所有屬性效果 ×0.9;城內孩童圍觀' },
  { id: 'zhuanyun', n: '轉運', cls: 'odd', pw: 2, d: '器械或工兵軍將領:器材兵額 −20 %' },
  { id: 'chengyu', n: '乘雨', cls: 'odd', pw: 2, d: '雨天攻擊 +10 %、移速不受雨減' },
  { id: 'zhoushi', n: '舟師', cls: 'odd', pw: 2, d: '浮橋施工 +30 %;水城攻擊 +8 %' },
  { id: 'shuoke', n: '說客', cls: 'odd', pw: 2, d: '借出客將可用次數 3 → 5' },
  { id: 'jiren', n: '吉人天相', cls: 'odd', pw: 1, city: 1, d: '每次城市升級 +10 碎片;沒有戰鬥效果' }
];
var CARD_TRAIT_BY_ID = {};
CARD_TRAITS.forEach(function (t) { CARD_TRAIT_BY_ID[t.id] = t; });

// 戰場技能(PLACEHOLDER;品階 skn 決定張數,依職業行取用,不足以通用技補;戰事重開後生效,城建專注模式不啟用)。type:主動 / 被動 / 光環;cd 秒(被動、光環為 0);d 內 {v} 取 v 值,改 v 說明自動更新
var CARD_SKILLS = [
  { id: 'sk_nong', row: '農', n: '開倉賑軍', type: '光環', cd: 0, v: 5, d: '3 格內友軍補給消耗 −{v} %' },
  { id: 'sk_gong', row: '工', n: '連夜趕工', type: '被動', cd: 0, v: 15, d: '工兵施工速度 +{v} %' },
  { id: 'sk_shang', row: '商', n: '軍市互易', type: '被動', cd: 0, v: 10, d: '戰後繳獲金幣 +{v} %' },
  { id: 'sk_wen', row: '文', n: '傳檄動搖', type: '主動', cd: 75, v: 8, d: '敵軍士氣 −{v} %,持續 15 秒' },
  { id: 'sk_yi', row: '醫', n: '戰地療傷', type: '主動', cd: 60, v: 10, d: '友軍恢復 {v} % 兵力' },
  { id: 'sk_zheng', row: '政', n: '號令三軍', type: '主動', cd: 90, v: 10, d: '全軍攻擊 +{v} %,持續 10 秒' },
  { id: 'sk_wu', row: '武', n: '衝鋒陷陣', type: '主動', cd: 45, v: 20, d: '下一次接戰傷害 +{v} %' },
  { id: 'sk_gen', row: '通', n: '臨陣應變', type: '被動', cd: 0, v: 5, d: '部隊受傷 −{v} %' }
];
var CARD_SKILL_BY_ID = {}, CARD_SKILL_BY_ROW = {};
CARD_SKILLS.forEach(function (k) { CARD_SKILL_BY_ID[k.id] = k; CARD_SKILL_BY_ROW[k.row] = k; });

// 名人 100 位(前 70 位 PLAN_CARDS §5.4,由表格轉出,不另編造;後 30 位為戰鬥改版新增,見 new_heroes_draft.md):id、名、字、陣營(0 魏 1 蜀 2 吳 3 黃巾 4 中立)、籍貫、五維[統武智政魅]、才、
// tr = [詞條名, 專屬(1/0), 說明]、bio 史實依據(簡)、fb 陣營依據、gr 品階(4 = A 級名人 金、3 = B 級名人 紫)、birth 生卒。職業欄由引擎依五維自動推導(未於 §5.4 手填)。
var CARD_FIGS = [
  {id:"caocao",name:"曹操",zi:"孟德",fac:0,home:"沛國譙",st:[96,72,92,94,90],tai:444,tr:[["唯才是舉",1,""],["屯田",0],["兵法",0,"陣法全 ×1.1"]],bio:"求賢令、許下屯田、注《孫子》",fb:"史",gr:4,birth:"155–220"},
  {id:"xunyu",name:"荀彧",zi:"文若",fac:0,home:"潁川潁陰",st:[60,30,93,98,90],tai:371,tr:[["王佐之才",1,"太守折扣 ×1.5"],["舉賢",0],["勤政",0]],bio:"何顒稱「王佐才」;薦戲志才、郭嘉",fb:"史",gr:4,birth:"163–212"},
  {id:"guojia",name:"郭嘉",zi:"奉孝",fac:0,home:"潁川陽翟",st:[55,25,100,70,76],tai:326,tr:[["算無遺策",0],["識破",0],["不治行檢",1,"派駐職務無效"]],bio:"料孫策必死於匹夫;陳群數廷訴其不治行檢",fb:"史",gr:4,birth:"170–207"},
  {id:"jiaxu",name:"賈詡",zi:"文和",fac:0,home:"武威姑臧",st:[72,40,97,76,60],tai:345,tr:[["算無遺策",0],["謹慎",0],["設伏",0]],bio:"陳壽評「算無遺策,經達權變」;闔門自守",fb:"史(先事董卓、張繡,199 歸曹)",gr:4,birth:"147–223"},
  {id:"simayi",name:"司馬懿",zi:"仲達",fac:0,home:"河內溫縣",st:[92,60,96,88,70],tai:406,tr:[["謹慎",0],["堅守",0],["隱忍",1,"守方受傷 −5 %,攻方放行延遲 +2 秒"]],bio:"稱風痹不應辟命;堅守不戰",fb:"史",gr:4,birth:"179–251"},
  {id:"dianwei",name:"典韋",zi:"",fac:0,home:"陳留己吾",st:[50,94,30,20,56],tai:250,tr:[["宿衛",0],["膂力",0],["忠義",0]],bio:"宛城宿衛死戰;「好酒食,飲啖兼人」",fb:"史",gr:4,birth:"?–197"},
  {id:"xiahoudun",name:"夏侯惇",zi:"元讓",fac:0,home:"沛國譙",st:[82,82,62,76,80],tai:382,tr:[["屯田",0],["勤政",0],["清儉",1,"商職無效,農職 +5 %"]],bio:"斷太壽水作陂,身自負土;性清儉",fb:"史",gr:4,birth:"?–220"},
  {id:"zhangliao",name:"張遼",zi:"文遠",fac:0,home:"雁門馬邑",st:[92,92,78,55,80],tai:397,tr:[["陷陣",0],["突擊",0],["威震逍遙",1,"本軍攻擊 +10 %,敵軍數 > 我軍數時"]],bio:"合肥以八百人破孫權",fb:"史(先事丁原、董卓、呂布,198 歸曹)",gr:4,birth:"169–222"},
  {id:"xunyou",name:"荀攸",zi:"公達",fac:0,home:"潁川潁陰",st:[70,40,94,78,72],tai:354,tr:[["識破",0],["設伏",0],["謹慎",0]],bio:"曹操謀主,「前後凡畫奇策十二」;白馬聲東擊西",fb:"史",gr:3,birth:"157–214"},
  {id:"xuchu",name:"許褚",zi:"仲康",fac:0,home:"譙國譙縣",st:[55,93,35,25,56],tai:264,tr:[["宿衛",0],["虎癡",1,"武力 +3,智力 −5"]],bio:"「力如虎而癡」,號虎癡",fb:"史",gr:4,birth:"?–?"},
  {id:"caoren",name:"曹仁",zi:"子孝",fac:0,home:"沛國譙",st:[88,86,62,60,75],tai:371,tr:[["堅守",0],["江陵突圍",1,"被 ≥ 2 支敵軍接觸時攻擊 +10 %"]],bio:"江陵拒周瑜經年;率數十騎突圍救牛金",fb:"史",gr:3,birth:"168–223"},
  {id:"xiahouyuan",name:"夏侯淵",zi:"妙才",fac:0,home:"沛國譙",st:[84,86,58,55,70],tai:353,tr:[["三日五百",1,"步兵移速 +10 %"],["輕敵",0]],bio:"軍中語「三日五百,六日一千」;曹操戒以「為將當有怯弱時」;定軍山戰歿",fb:"史",gr:4,birth:"?–219"},
  {id:"xuhuang",name:"徐晃",zi:"公明",fac:0,home:"河東楊縣",st:[86,87,65,50,68],tai:356,tr:[["謹慎",0],["長驅直入",1,"對守方建築 4 格內的敵部隊攻擊 +10 %"]],bio:"樊城解圍,曹操令稱其功踰孫武、穰苴;「常遠斥候」",fb:"史",gr:4,birth:"?–227"},
  {id:"zhongyao",name:"鍾繇",zi:"元常",fac:0,home:"潁川長社",st:[45,20,82,92,80],tai:319,tr:[["勤政",0],["鎮撫關中",1,"太守折扣 +3 %;籍貫涼州人物在職時職務 +5 %"]],bio:"以司隸校尉督關中,馬騰、韓遂遣子入侍",fb:"史",gr:3,birth:"151–230"},
  {id:"liubei",name:"劉備",zi:"玄德",fac:1,home:"涿郡涿縣",st:[76,70,72,76,98],tai:392,tr:[["織席販履",1,"商職 +5 %"],["寬厚",0],["屢敗屢起",1,"潰退後回到部署區即重整,1 次"]],bio:"少時販履織席;屢敗而不撓",fb:"史",gr:4,birth:"161–223"},
  {id:"guanyu",name:"關羽",zi:"雲長",fac:1,home:"河東解縣",st:[92,97,72,60,88],tai:409,tr:[["萬人敵",0],["忠義",0],["傲上",0]],bio:"「萬人之敵」;封還所賜辭曹;「善待卒伍而驕於士大夫」",fb:"史",gr:4,birth:"?–220"},
  {id:"zhangfei",name:"張飛",zi:"益德",fac:1,home:"涿郡",st:[82,97,50,40,55],tai:324,tr:[["萬人敵",0],["據水斷橋",1,"守方:橋格 2 格內受傷 −20 %"],["暴躁",0]],bio:"長坂據水斷橋;「暴而無恩」",fb:"史",gr:4,birth:"?–221"},
  {id:"zhaoyun",name:"趙雲",zi:"子龍",fac:1,home:"常山真定",st:[82,92,72,65,82],tai:393,tr:[["一身是膽",1,"被伏擊時不潰退"],["謹慎",0],["宿衛",0]],bio:"漢水開營門偃旗;長坂護後主",fb:"史(先從公孫瓚)",gr:4,birth:"?–229"},
  {id:"zhugeliang",name:"諸葛亮",zi:"孔明",fac:1,home:"琅邪陽都",st:[90,40,100,98,92],tai:420,tr:[["八陣",0],["勤政",0],["奇謀為短",1,"謀類詞條效果 ×0.8"]],bio:"推演兵法作八陣圖;陳壽評治戎為長,奇謀為短",fb:"史",gr:4,birth:"181–234"},
  {id:"machao",name:"馬超",zi:"孟起",fac:1,home:"扶風茂陵",st:[85,94,50,30,84],tai:343,tr:[["騎射",0],["相馬",0],["羌胡敬服",1,"胡騎部隊攻擊 +8 %"]],bio:"「信著北土,威武並昭」;羌胡多附",fb:"史(先據涼州、依張魯,214 歸劉備)",gr:4,birth:"176–222"},
  {id:"pangtong",name:"龐統",zi:"士元",fac:1,home:"襄陽",st:[74,38,96,75,88],tai:371,tr:[["設伏",0],["識破",0],["鳳雛",1,"謀類技能冷卻 −10 %"]],bio:"司馬徽稱「南州士之冠冕」;雒城中流矢卒",fb:"史",gr:4,birth:"179–214"},
  {id:"fazheng",name:"法正",zi:"孝直",fac:1,home:"扶風郿",st:[72,42,94,74,62],tai:344,tr:[["算無遺策",0],["山戰",0],["睚眥必報",1,"宿怨羈絆效果 ×1.5"]],bio:"陳壽評「奇畫策算」;定軍山之謀;「一餐之德,睚眥之怨,無不報復」",fb:"史",gr:4,birth:"176–220"},
  {id:"weiyan",name:"魏延",zi:"文長",fac:1,home:"義陽",st:[88,92,62,52,66],tai:360,tr:[["陷陣",0],["傲上",0],["鎮守漢中",1,"守方:本軍受傷 −8 %"]],bio:"拔為漢中督;「性矜高,當時皆避下之」",fb:"史",gr:4,birth:"?–234"},
  {id:"huangzhong",name:"黃忠",zi:"漢升",fac:1,home:"南陽",st:[80,92,55,45,72],tai:344,tr:[["先登",0],["陷陣",0]],bio:"常先登陷陣,定軍山斬夏侯淵",fb:"史(先事劉表、韓玄)",gr:4,birth:"?–220"},
  {id:"mizhu",name:"糜竺",zi:"子仲",fac:1,home:"東海朐縣",st:[30,30,66,80,86],tai:292,tr:[["貨殖",0],["富甲一方",1,"每次城市升級 +25 碎片"]],bio:"祖世貨殖,僮客萬人;傾家資助劉備",fb:"史",gr:4,birth:"?–221"},
  {id:"maliang",name:"馬良",zi:"季常",fac:1,home:"襄陽宜城",st:[50,30,82,80,85],tai:327,tr:[["說客",0],["招納五溪",1,"籍貫武陵、五溪的人物出現率 ×1.5;與沙摩柯同場兩軍攻擊 +8 %"]],bio:"「馬氏五常,白眉最良」;入武陵招納五溪蠻夷",fb:"史",gr:3,birth:"187–222"},
  {id:"xushu",name:"徐庶",zi:"元直",fac:1,home:"潁川長社",st:[74,72,86,65,75],tai:372,tr:[["識破",0],["舉賢",0]],bio:"少好擊劍;薦諸葛亮;母為曹公所獲,辭先主北去",fb:"史(208 後入魏;以薦諸葛亮之事歸蜀)",gr:4,birth:"?–?"},
  {id:"shamoke",name:"沙摩柯",zi:"新",fac:1,home:"武陵五溪",st:[70,86,35,25,70],tai:286,tr:[["山戰",0],["膂力",0]],bio:"五溪蠻夷首領,夷陵隨劉備,為吳軍所斬",fb:"史",gr:3,birth:"?–222"},
  {id:"sunjian",name:"孫堅",zi:"文臺",fac:2,home:"吳郡富春",st:[88,90,70,55,82],tai:385,tr:[["先登",0],["萬人敵",0],["輕敵",0]],bio:"宛城討黃巾先登;陽人破董卓軍;峴山中伏身亡",fb:"史",gr:4,birth:"155–191"},
  {id:"sunce",name:"孫策",zi:"伯符",fac:2,home:"吳郡富春",st:[88,95,70,55,92],tai:400,tr:[["突擊",0],["轉鬥千里",1,"騎兵移速 +8 %"],["輕敵",0]],bio:"渡江轉鬥;輕出遇刺",fb:"史",gr:4,birth:"175–200"},
  {id:"zhouyu",name:"周瑜",zi:"公瑾",fac:2,home:"廬江舒縣",st:[92,70,100,70,92],tai:424,tr:[["火攻",0],["水戰",0],["顧曲周郎",1,"4 格內友軍受混亂時間 −30 %;城內吹奏場面"]],bio:"赤壁火攻;「曲有誤,周郎顧」",fb:"史",gr:4,birth:"175–210"},
  {id:"lusu",name:"魯肅",zi:"子敬",fac:2,home:"臨淮東城",st:[78,55,88,83,88],tai:392,tr:[["指囷相贈",1,"農職 +5 %"],["寬厚",0],["名望",0]],bio:"指囷予周瑜;榻上策",fb:"史",gr:4,birth:"172–217"},
  {id:"ganning",name:"甘寧",zi:"興霸",fac:2,home:"巴郡臨江",st:[82,92,60,40,72],tai:346,tr:[["水戰",0],["百騎劫營",1,"第 1 波部隊攻擊 +10 %"],["暴躁",0]],bio:"少時錦帆游俠;濡須夜襲曹營",fb:"史(先依劉表、黃祖)",gr:4,birth:"?–?"},
  {id:"sunquan",name:"孫權",zi:"仲謀",fac:2,home:"吳郡富春",st:[77,60,80,80,96],tai:393,tr:[["舉賢",0],["寬厚",0],["知人善任",1,"派駐職務 +5 %"]],bio:"陳壽評「屈身忍辱,任才尚計」;拔呂蒙、陸遜",fb:"史",gr:4,birth:"182–252"},
  {id:"luxun",name:"陸遜",zi:"伯言",fac:2,home:"吳郡吳縣",st:[88,58,96,78,73],tai:393,tr:[["火攻",0],["謹慎",0],["夷陵持重",1,"守方:開戰前 60 秒本軍受傷 −10 %"]],bio:"夷陵相持七八月,「各持一把茅,以火攻拔之」",fb:"史",gr:4,birth:"183–245"},
  {id:"lvmeng",name:"呂蒙",zi:"子明",fac:2,home:"汝南富陂",st:[82,78,80,55,61],tai:356,tr:[["設伏",0],["好學",0],["白衣渡江",1,"第 1 波本軍隱匿至首擊"]],bio:"白衣搖櫓襲荊州;孫權勸學(「吳下阿蒙」見《江表傳》,史注)",fb:"史",gr:4,birth:"178–220"},
  {id:"zhangzhao",name:"張昭",zi:"子布",fac:2,home:"彭城",st:[35,20,82,94,86],tai:317,tr:[["勤政",0],["剛愎",0],["託孤重臣",1,"太守折扣 ×1.2"]],bio:"孫策臨終託以孫權;剛直數犯顏",fb:"史",gr:4,birth:"156–236"},
  {id:"taishici",name:"太史慈",zi:"子義",fac:2,home:"東萊黃縣",st:[75,95,62,40,80],tai:352,tr:[["神射",0],["忠義",0]],bio:"猿臂善射,弦不虛發;神亭與孫策酣鬥",fb:"史(先事劉繇)",gr:4,birth:"166–206"},
  {id:"huanggai",name:"黃蓋",zi:"公覆",fac:2,home:"零陵泉陵",st:[74,80,64,55,70],tai:343,tr:[["火攻",0],["詐降",1,"開戰後 10 秒內不被守方優先鎖定"]],bio:"赤壁詐降縱火;「每所征討,士卒皆爭為先」",fb:"史",gr:4,birth:"?–?"},
  {id:"zhoutai",name:"周泰",zi:"幼平",fac:2,home:"九江下蔡",st:[66,86,40,35,62],tai:289,tr:[["宿衛",0],["忠義",0]],bio:"宣城衛孫權,身被十二創",fb:"史",gr:3,birth:"?–?"},
  {id:"chengpu",name:"程普",zi:"德謀",fac:2,home:"右北平土垠",st:[78,76,58,50,68],tai:330,tr:[["治軍嚴整",0],["程公",1,"本軍潰退門檻 −3 %"]],bio:"隨孫堅、孫策、孫權三世;赤壁左右督;時人呼程公",fb:"史",gr:3,birth:"?–?"},
  {id:"shixie",name:"士燮",zi:"威彥",fac:2,home:"蒼梧廣信",st:[30,15,78,84,82],tai:289,tr:[["經學",0],["保境安民",1,"農、商職 +5 %"]],bio:"保交州二十餘年;210 年後奉孫權節度",fb:"史(210 年附孫權)",gr:3,birth:"137–226"},
  {id:"zhangjiao",name:"張角",zi:"",fac:3,home:"鉅鹿",st:[86,50,94,72,100],tai:402,tr:[["太平道",1,"魅力光環半徑 ×2"],["通醫",0],["蒼天已死",1,"全軍攻擊 +5 %,潰退門檻 +3 %"]],bio:"太平道、符水療病;置三十六方;黃巾起事",fb:"史",gr:4,birth:"?–184"},
  {id:"zhangbao",name:"張寶",zi:"新",fac:3,home:"鉅鹿",st:[80,70,80,55,95],tai:380,tr:[["觀天",0],["鼓舞",0],["地公將軍",1,"黃巾兵種受傷 −8 %"]],bio:"稱地公將軍;下曲陽為皇甫嵩所破",fb:"史",gr:4,birth:"?–184"},
  {id:"zhangliang",name:"張梁",zi:"新",fac:3,home:"鉅鹿",st:[88,82,66,52,84],tai:372,tr:[["堅守",0],["治軍嚴整",0],["人公將軍",1,"黃巾兵種攻擊 +8 %"]],bio:"稱人公將軍;廣宗「眾精勇,嵩不能克」",fb:"史",gr:4,birth:"?–184"},
  {id:"zhangniujiao",name:"張牛角",zi:"新",fac:3,home:"博陵",st:[82,82,60,50,86],tai:360,tr:[["先登",0],["魯莽",0],["黑山之首",1,"丘陵、林地移速 +10 %"]],bio:"與褚燕(張燕)合眾;攻癭陶中流矢,囑眾奉燕為帥",fb:"史(黑山,黃巾相關)",gr:4,birth:"?–?"},
  {id:"zhangmancheng",name:"張曼成",zi:"新",fac:3,home:"南陽",st:[84,80,66,54,95],tai:379,tr:[["先登",0],["鼓舞",0],["神上使",1,"全軍黃巾兵種潰退門檻 −3 %"]],bio:"南陽黃巾稱「神上使」,殺太守褚貢",fb:"史",gr:4,birth:"?–184"},
  {id:"mayuanyi",name:"馬元義",zi:"新",fac:3,home:"不詳",st:[70,66,84,62,95],tai:377,tr:[["說客",0],["識破",0],["大方",1,"伏兵類技能首擊 +10 %"]],bio:"太平道大方,往來京師謀內應,事洩車裂",fb:"史",gr:4,birth:"?–184"},
  {id:"guanhai",name:"管亥",zi:"新",fac:3,home:"青州",st:[84,92,52,35,78],tai:341,tr:[["陷陣",0],["魯莽",0],["膂力",0]],bio:"青州黃巾圍北海孔融於都昌,太史慈突圍求救",fb:"史",gr:4,birth:"?–?"},
  {id:"zhanglu",name:"張魯",zi:"公祺",fac:3,home:"沛國豐",st:[74,50,86,96,98],tai:404,tr:[["五斗米道",1,"魅力光環半徑 ×1.5"],["寬厚",0],["義舍",1,"農職 +5 %"]],bio:"五斗米道,據漢中近三十年,作義舍;215 降曹",fb:"相近(道教起事;後歸曹)",gr:4,birth:"?–216"},
  {id:"guotai",name:"郭太",zi:"新",fac:3,home:"西河",st:[82,80,64,46,80],tai:352,tr:[["山戰",0],["設伏",0],["白波谷",1,"山地伏兵首擊 +10 %"]],bio:"「黃巾餘賊郭太等起於西河白波谷」",fb:"史(白波,黃巾餘部)",gr:4,birth:"?–?"},
  {id:"boca",name:"波才",zi:"",fac:3,home:"潁川",st:[70,72,52,30,70],tai:294,tr:[["魯莽",0],["畏火",0]],bio:"潁川黃巾渠帥,先敗朱儁;長社依草結營,遭皇甫嵩火攻",fb:"史",gr:4,birth:"?–184"},
  {id:"zhangyan",name:"張燕",zi:"",fac:3,home:"常山真定",st:[74,80,62,52,78],tai:346,tr:[["飛燕",1,"步兵移速 +8 %"],["山戰",0]],bio:"「剽悍捷速過人」號飛燕;黑山眾;205 年歸曹",fb:"史(黑山,黃巾相關;後歸曹)",gr:4,birth:"不詳"},
  {id:"liupi",name:"劉辟",zi:"新",fac:3,home:"汝南",st:[70,74,52,42,68],tai:306,tr:[["健步",0],["堅守",0]],bio:"汝南黃巾,叛曹應袁紹,迎劉備略許下",fb:"史",gr:3,birth:"?–?"},
  {id:"yudu",name:"于毒",zi:"新",fac:3,home:"不詳",st:[72,76,50,38,66],tai:302,tr:[["山戰",0],["先登",0]],bio:"黑山帥,攻東武陽為曹操所破,後為袁紹所斬",fb:"史(黑山,黃巾相關)",gr:3,birth:"?–193"},
  {id:"yuji",name:"于吉",zi:"新",fac:3,home:"琅邪",st:[30,20,86,45,92],tai:273,tr:[["通醫",0],["觀天",0]],bio:"往來吳會,燒香讀道書,制作符水以治病;為孫策所殺",fb:"相近(太平道源流;史注《江表傳》)",gr:4,birth:"?–200"},
  {id:"dongzhuo",name:"董卓",zi:"仲穎",fac:4,home:"隴西臨洮",st:[86,90,70,50,56],tai:352,tr:[["騎射",0],["膂力",0],["暴躁",0]],bio:"「雙帶兩鞬,左右馳射」;「粗猛有謀」;殘暴",fb:"史",gr:4,birth:"?–192"},
  {id:"lvbu",name:"呂布",zi:"奉先",fac:4,home:"五原九原",st:[88,100,48,35,76],tai:347,tr:[["飛將",1,"騎兵攻擊 +12 %"],["騎射",0],["反覆",0]],bio:"號「飛將」;轅門射戟;屢叛其主",fb:"史",gr:4,birth:"?–199"},
  {id:"yuanshao",name:"袁紹",zi:"本初",fac:4,home:"汝南汝陽",st:[80,65,70,72,96],tai:383,tr:[["四世三公",1,"名望 ×1.2"],["多謀少決",0],["名望",0]],bio:"四世三公;官渡之敗",fb:"史",gr:4,birth:"?–202"},
  {id:"huangfusong",name:"皇甫嵩",zi:"義真",fac:4,home:"安定朝那",st:[95,75,82,70,82],tai:404,tr:[["火攻",0],["體恤士卒",1,"全軍潰退門檻 −3 %"],["治軍嚴整",0]],bio:"長社縱火破波才;營幔修立然後就舍",fb:"史(漢臣)",gr:4,birth:"?–195"},
  {id:"luzhi",name:"盧植",zi:"子幹",fac:4,home:"涿郡",st:[84,62,84,82,95],tai:407,tr:[["經學",0],["治軍嚴整",0],["師門",0,"劉備、公孫瓚"]],bio:"師事馬融;圍張角於廣宗;劉備、公孫瓚曾從學",fb:"史(漢臣)",gr:4,birth:"?–192"},
  {id:"gongsunzan",name:"公孫瓚",zi:"伯珪",fac:4,home:"遼西令支",st:[86,88,62,63,80],tai:379,tr:[["白馬義從",1,"騎兵攻擊 +8 %"],["騎射",0],["輕敵",0]],bio:"白馬義從;界橋之敗",fb:"史",gr:4,birth:"?–199"},
  {id:"zhujun",name:"朱儁",zi:"公偉",fac:4,home:"會稽上虞",st:[85,78,75,75,72],tai:385,tr:[["先登",0],["寬厚",0],["宛城破圍",1,"對城牆、城門傷害 +8 %"]],bio:"圍宛城破黃巾;「好義輕財,鄉閭敬之」",fb:"史(漢臣)",gr:4,birth:"?–195"},
  {id:"zhengxuan",name:"鄭玄",zi:"康成",fac:4,home:"北海高密",st:[35,12,94,78,98],tai:317,tr:[["經學",0],["師門",0],["遍注群經",1,"學職科研花費 −8 %"]],bio:"遍注群經,門生數千",fb:"史(士人)",gr:4,birth:"127–200"},
  {id:"mateng",name:"馬騰",zi:"壽成",fac:4,home:"扶風茂陵",st:[82,86,58,60,90],tai:376,tr:[["騎射",0],["寬厚",0],["涼州豪帥",1,"騎兵、胡騎移速 +5 %"]],bio:"據涼州,「性賢厚,人多敬之」;208 年入朝",fb:"史",gr:4,birth:"?–212"},
  {id:"xurong",name:"徐榮",zi:"",fac:4,home:"遼東",st:[88,78,76,55,58],tai:355,tr:[["設伏",0],["治軍嚴整",0]],bio:"汴水敗曹操;梁東敗孫堅",fb:"史(董卓部)",gr:3,birth:"?–192"},
  {id:"huatuo",name:"華佗",zi:"元化",fac:4,home:"沛國譙",st:[15,20,86,45,72],tai:238,tr:[["通醫",0],["五禽戲",1,"本軍負傷場次 −1,城內晨練場面"]],bio:"麻沸散;五禽之戲",fb:"史(醫者)",gr:4,birth:"?–208"},
  {id:"caiyong",name:"蔡邕",zi:"伯喈",fac:4,home:"陳留圉縣",st:[30,15,90,82,92],tai:309,tr:[["經學",0],["熹平石經",1,"學職 +10 %"]],bio:"175 年書石經;焦尾琴",fb:"史(士人)",gr:4,birth:"133–192"},
  {id:"youtu",name:"尤突",zi:"",fac:4,home:"丹陽",st:[60,72,47,35,62],tai:276,tr:[["山戰",0],["丹陽宗帥",1,"山地格守方受傷 −8 %"]],bio:"丹陽宗帥,受曹公印綬,為陸遜所破",fb:"史(山越,外族)",gr:3,birth:"?–?"},
  {id:"yufuluo",name:"於夫羅",zi:"",fac:4,home:"南匈奴",st:[80,86,52,50,78],tai:346,tr:[["騎射",0],["南匈奴單于",1,"胡騎部隊移速 +8 %"]],bio:"南匈奴單于,寓居河東平陽",fb:"史(外族)",gr:3,birth:"?–195"},
  // 戰鬥改版新增 30 位(tools/battle_skills/new_heroes_draft.md;頭像 / 全身圖在 assets/portraits、assets/fullbody,id 同):魏 6、蜀 6、吳 6、黃巾 6、中立 6
  {id:"zhenji",name:"甄姬",zi:"",fac:0,home:"中山無極",st:[30,20,82,70,98],tai:300,tr:[["洛神",1,"(傳說)凌波微步"],["善樂",0],["謹慎",0]],bio:"先為袁熙妻,鄴城破後為曹丕夫人,明帝之母;傳說為〈洛神賦〉原型",fb:"史(曹丕夫人)",gr:4,birth:"183–221"},
  {id:"caiyan",name:"蔡琰",zi:"文姬",fac:0,home:"陳留圉縣",st:[28,15,90,75,88],tai:296,tr:[["文姬歸漢",1],["善樂",0],["經學",0]],bio:"蔡邕之女,沒於南匈奴十二年,曹操以金璧贖回;默寫亡書四百餘篇",fb:"史(曹操贖回)",gr:3,birth:"?–?"},
  {id:"caozhi",name:"曹植",zi:"子建",fac:0,home:"沛國譙",st:[40,35,95,60,90],tai:320,tr:[["才高八斗",1],["好酒",0],["狂生",0]],bio:"建安文學代表,銅雀臺援筆立成;任性飲酒,擅開司馬門",fb:"史",gr:3,birth:"192–232"},
  {id:"yangxiu",name:"楊修",zi:"德祖",fac:0,home:"弘農華陰",st:[35,25,92,72,70],tai:294,tr:[["雞肋",1],["識破",0],["傲上",0]],bio:"曹操主簿,解「一合酥」「雞肋」;為曹操所殺",fb:"史",gr:3,birth:"175–219"},
  {id:"pangde",name:"龐德",zi:"令明",fac:0,home:"南安狟道",st:[80,92,50,40,68],tai:330,tr:[["抬櫬決死",1],["騎射",0],["忠義",0]],bio:"常乘白馬,射中關羽額;樊城被擒不屈而死",fb:"史(先從馬超、張魯,215 歸曹)",gr:3,birth:"?–219"},
  {id:"zhanghe",name:"張郃",zi:"儁乂",fac:0,home:"河間鄚縣",st:[88,85,72,55,68],tai:368,tr:[["識變善陣",1],["山戰",0],["謹慎",0]],bio:"官渡歸曹;街亭破馬謖;木門道中伏弩而死",fb:"史(先事韓馥、袁紹)",gr:4,birth:"?–231"},
  {id:"ganfuren",name:"甘夫人",zi:"",fac:1,home:"沛",st:[25,10,70,78,92],tai:275,tr:[["玉人",1,"(傳說)"],["寬厚",0]],bio:"劉備之妾,劉禪生母;長坂為趙雲所護",fb:"史",gr:3,birth:"?–?"},
  {id:"mifuren",name:"糜夫人",zi:"",fac:1,home:"東海朐縣",st:[25,15,68,70,85],tai:263,tr:[["託孤",1,"(演義)"],["忠義",0]],bio:"糜竺之妹,劉備夫人;長坂坡託阿斗於趙雲為演義情節",fb:"史(演義情節)",gr:3,birth:"?–?"},
  {id:"masu",name:"馬謖",zi:"幼常",fac:1,home:"襄陽宜城",st:[60,40,88,72,70],tai:330,tr:[["攻心為上",1],["說客",0],["輕敵",0]],bio:"好論軍計;街亭違亮節度,為張郃所破",fb:"史",gr:3,birth:"190–228"},
  {id:"huangyueying",name:"黃月英",zi:"",fac:1,home:"沔南",st:[45,40,92,80,62],tai:319,tr:[["機關巧思",1,"(傳說)"],["匠心",0],["好學",0]],bio:"黃承彥之女、諸葛亮之妻;「月英」之名與機關發明為民間傳說",fb:"史(諸葛亮妻;名為傳說)",gr:4,birth:"?–?"},
  {id:"zhoucang",name:"周倉",zi:"",fac:1,home:"關西",st:[65,85,35,25,62],tai:272,tr:[["扛刀",1,"(演義)"],["忠義",0],["水戰",0]],bio:"演義人物:為關羽扛刀,水擒龐德;史書無此人",fb:"演義",gr:3,birth:"?–219"},
  {id:"yanyan",name:"嚴顏",zi:"",fac:1,home:"巴郡臨江",st:[80,80,58,55,72],tai:345,tr:[["斷頭將軍",1],["堅守",0],["大器晚成",0]],bio:"劉璋巴郡太守,為張飛所擒,不屈,張飛壯而釋之",fb:"史(先事劉璋)",gr:3,birth:"?–?"},
  {id:"sunshangxiang",name:"孫尚香",zi:"",fac:2,home:"吳郡富春",st:[68,82,62,45,85],tai:342,tr:[["諸兄之風",1],["騎射",0],["傲上",0]],bio:"孫權之妹,嫁劉備;「才捷剛猛,有諸兄之風」,侍婢百餘人皆執刀",fb:"史(史稱孫夫人;孫尚香為戲曲名)",gr:4,birth:"?–?"},
  {id:"lingtong",name:"凌統",zi:"公績",fac:2,home:"吳郡餘杭",st:[80,88,58,50,78],tai:354,tr:[["父仇",1],["忠義",0],["暴躁",0]],bio:"凌操之子;逍遙津死戰護孫權;與甘寧有殺父之仇",fb:"史",gr:4,birth:"189–217"},
  {id:"daqiao",name:"大喬",zi:"",fac:2,home:"廬江皖縣",st:[25,10,72,70,96],tai:273,tr:[["江東雙璧",1],["善樂",0]],bio:"橋公長女,孫策所納",fb:"史",gr:3,birth:"?–?"},
  {id:"xiaoqiao",name:"小喬",zi:"",fac:2,home:"廬江皖縣",st:[25,10,78,68,96],tai:277,tr:[["顧曲知音",1],["善樂",0]],bio:"橋公次女,周瑜之妻",fb:"史",gr:3,birth:"?–?"},
  {id:"dingfeng",name:"丁奉",zi:"承淵",fac:2,home:"廬江安豐",st:[80,84,62,50,66],tai:342,tr:[["雪中短兵",1],["先登",0],["大器晚成",0]],bio:"歷仕孫權至孫皓;東興之戰雪中脫甲短兵破魏軍",fb:"史",gr:3,birth:"?–271"},
  {id:"kanze",name:"闞澤",zi:"德潤",fac:2,home:"會稽山陰",st:[40,25,85,82,72],tai:304,tr:[["傭書",1],["說客",0],["好學",0]],bio:"家貧傭書而博學;演義為黃蓋送詐降書",fb:"史",gr:3,birth:"?–243"},
  {id:"nanhua",name:"南華老仙",zi:"",fac:3,home:"不詳",st:[40,20,98,60,95],tai:313,tr:[["太平要術",1,"(演義)"],["觀天",0],["通醫",0]],bio:"演義第一回授張角《太平要術》的老仙人",fb:"演義",gr:4,birth:"不詳"},
  {id:"chengyuanzhi",name:"程遠志",zi:"",fac:3,home:"不詳",st:[70,80,40,30,65],tai:285,tr:[["五萬犯境",1,"(演義)"],["魯莽",0]],bio:"演義黃巾大將,率五萬人犯涿郡,為關羽所斬",fb:"演義",gr:3,birth:"?–184"},
  {id:"dengmao",name:"鄧茂",zi:"",fac:3,home:"不詳",st:[62,76,38,28,55],tai:259,tr:[["搶功",1,"(演義)"],["健步",0]],bio:"演義程遠志副將,為張飛所刺",fb:"演義",gr:3,birth:"?–184"},
  {id:"peiyuanshao",name:"裴元紹",zi:"",fac:3,home:"不詳",st:[60,74,40,30,55],tai:259,tr:[["臥牛山寨",1,"(演義)"],["貪財",0]],bio:"演義黃巾餘黨,臥牛山盜趙雲之馬被殺",fb:"演義",gr:3,birth:"?–?"},
  {id:"heyi",name:"何儀",zi:"",fac:3,home:"汝南",st:[72,72,45,35,62],tai:286,tr:[["汝南聚眾",1],["堅守",0]],bio:"汝南、潁川黃巾渠帥,為曹操所破(演義為許褚所擒)",fb:"史+演義",gr:3,birth:"?–196"},
  {id:"zhangkai",name:"張闓",zi:"",fac:3,home:"不詳",st:[55,76,55,30,40],tai:256,tr:[["劫財",1,"(裴注)"],["貪財",0],["反覆",0]],bio:"陶謙部將,殺曹嵩取其財(裴注引說);演義作黃巾餘黨",fb:"裴注+演義",gr:3,birth:"?–?"},
  {id:"diaochan",name:"貂蟬",zi:"",fac:4,home:"不詳",st:[30,15,90,72,100],tai:307,tr:[["連環計",1,"(演義)"],["善樂",0],["說客",0]],bio:"演義人物;史載呂布與董卓侍婢私通",fb:"演義",gr:4,birth:"?–?"},
  {id:"zuoci",name:"左慈",zi:"元放",fac:4,home:"廬江",st:[40,30,96,55,90],tai:311,tr:[["方術",1],["觀天",0],["識破",0]],bio:"《後漢書·方術傳》有傳;演義戲弄曹操",fb:"史(方士)",gr:4,birth:"?–?"},
  {id:"panfeng",name:"潘鳳",zi:"",fac:4,home:"不詳",st:[60,75,30,30,70],tai:265,tr:[["無雙上將",1,"(演義)"],["輕敵",0]],bio:"演義韓馥部將,號無雙上將,為華雄所斬",fb:"演義",gr:3,birth:"?–191"},
  {id:"caoxing",name:"曹性",zi:"",fac:4,home:"不詳",st:[62,82,48,30,52],tai:274,tr:[["暗箭",1],["神射",0]],bio:"呂布部將;演義射瞎夏侯惇左目",fb:"史(呂布部將)+演義",gr:3,birth:"?–?"},
  {id:"huaxiong",name:"華雄",zi:"",fac:4,home:"關西",st:[78,90,40,30,60],tai:298,tr:[["連勝",1],["膂力",0],["輕敵",0]],bio:"董卓都督,陽人之戰為孫堅所斬(演義為關羽溫酒所斬)",fb:"史(董卓部)",gr:4,birth:"?–191"},
  {id:"yuanshu",name:"袁術",zi:"公路",fac:4,home:"汝南汝陽",st:[72,60,68,62,85],tai:347,tr:[["僭號仲家",1],["名望",0],["傲上",0]],bio:"袁紹從弟;得傳國璽,僭號稱帝於壽春",fb:"史",gr:4,birth:"?–199"}
];
// 名人職業覆寫表(之後逐位手填;cards.js 的 cardFigJobs 優先讀此表,查無才由五維推導):{ 名人id: { ja: { 職業id: 階(1~4) }, main: '主職業id' } }。目前為空。
var CARD_FIG_JOB_OVERRIDE = {};
// 名人抽取權重(獨立欄位好微調;抽金 / 抽紫名人與指名池皆依此加權,數字越大越容易抽到;缺項視為 金 10 / 紫 6):
//   金階:主公級 曹操 / 劉備 / 孫權 = 1;頂級 10 人 = 3;其餘 = 10。紫階:較有名者 10 人 = 3;其餘 = 6。
// 指名池(陣營模式)只在該陣營名人內加權。
var CARD_FIG_WEIGHT = {
  caocao: 1, liubei: 1, sunquan: 1,
  lvbu: 3, guanyu: 3, zhangfei: 3, zhugeliang: 3, simayi: 3, zhouyu: 3, zhaoyun: 3, sunce: 3, machao: 3, zhangjiao: 3,
  xunyu: 10, guojia: 10, jiaxu: 10, dianwei: 10, xiahoudun: 10, zhangliao: 10, xunyou: 6,
  pangtong: 10, fazheng: 10, weiyan: 10,
  sunjian: 10, lusu: 10, ganning: 10, luxun: 10, lvmeng: 10, zhangzhao: 10,
  zhangbao: 10, zhangliang: 10, zhangniujiao: 10, zhangmancheng: 10, mayuanyi: 10, guanhai: 10, zhanglu: 10, guotai: 10,
  dongzhuo: 10, yuanshao: 10, huangfusong: 10, luzhi: 10, gongsunzan: 10, zhujun: 10, zhengxuan: 10, mateng: 10,
  xuchu: 10, caoren: 6, xiahouyuan: 10, xuhuang: 10, huangzhong: 10, xushu: 10, taishici: 10, huanggai: 10, huatuo: 3, caiyong: 3,
  zhongyao: 6, mizhu: 10, maliang: 6, shamoke: 6, zhoutai: 6, chengpu: 6, shixie: 6,
  boca: 10, zhangyan: 10, liupi: 6, yudu: 6, yuji: 10, xurong: 6, youtu: 6, yufuluo: 6,
  // 戰鬥改版新增 30 位(貂蟬、孫尚香、甄姬較有名 = 3)
  zhenji: 3, caiyan: 6, caozhi: 6, pangde: 6, zhanghe: 10, huangyueying: 10, sunshangxiang: 3, lingtong: 10, nanhua: 10, diaochan: 3, zuoci: 10,
  yangxiu: 6, ganfuren: 6, mifuren: 6, masu: 6, zhoucang: 6, yanyan: 6, daqiao: 6, xiaoqiao: 6, dingfeng: 6, kanze: 6, chengyuanzhi: 6, dengmao: 6, peiyuanshao: 6, heyi: 6, zhangkai: 6, panfeng: 6, caoxing: 6, huaxiong: 10, yuanshu: 10
};
// 在野名人路過(js/npcvisit.js;使用者決議,數值皆 PLACEHOLDER)。名人來源 CARD_FIGS(金 / 紫階),依上面 CARD_FIG_WEIGHT 加權(缺項 金 10 / 紫 6),已在名冊 / 卡包的不來。
//   countW = 每日 0 / 1 / 2 位的權重;startMin~endMin = 一天中可抵達的時段(分鐘,本機時間,白天);windowMin = 預定抵達後多久內才演(過了不補演);
//   stops = 逛的停點數範圍;standSec = 每站停留秒數範圍;maxLifeSec = 單次停留上限(超過就離城);cap / capLow = 同時最多幾位(一般 / 省電或低階機);
//   rewardDayMax = 每日小獎勵次數上限;reward = 依品階(3 紫 / 4 金)首次點擊的小獎勵(shards 碎片;原酒令 1 已換成碎片 5;不碰抽卡機率與卡包);aura = 光環 / 小星顏色
var CARD_VISIT = {
  on: true, countW: [30, 45, 25], startMin: 420, endMin: 1110, windowMin: 45, stops: [3, 6], standSec: [6, 10], maxLifeSec: 300,
  cap: 2, capLow: 1, rewardDayMax: 2, reward: { 3: { shards: 5 }, 4: { shards: 8 } }, aura: { 3: '#b48cf0', 4: '#f0c850' }
};
// 卡包(PLAN_CARDS 第四批決議;數字多為 PLACEHOLDER)。2026-11-09 起:開批的卡先進名冊,名冊滿了才放卡包 cs.bag(暫存);名冊有空位時卡包的卡自動補進名冊。卡包不佔名冊名額。
var CARD_BAG = {
  capBase: 100, capPerRank: 80, capMax: 500,   // 容量 = 100 + (官階等級 − 1) × 80,上限 500(官階表 6 階:100/180/260/340/420/500;缺官階資料 = 100)
  batchNeed: 7,                // 開一批需要的空位(名冊 + 卡包 + 溢出區合計;空位不足則該批暫存不開)
  autoDefault: -1,             // 自動熔爐預設:關(-1);0 = 品階 ≤ 白
  autoMax: 2,                  // 自動熔爐最高可設到藍(紫以上不提供自動)
  figDupShard: { 3: 8, 4: 16 }, // 名人重複且信物已滿(CARD_CFG.tokMax)時轉成的碎片數
  overMs: 24 * 3600000,        // 溢出區:卡包滿時多出的卡進溢出區(cs.bagOver),真實時間 24 小時倒數;有空位依剩餘時間短者先納入,歸零自動熔成碎片(名人不入溢出區)
  overWarnMs: 2 * 3600000      // 剩餘不足 2 小時:UI 換提示色
};
// 卡片熔爐(使用者決議;卡包的『分解』整合改名『卡片熔爐』,碎片可 (1)強化武將升星 (2)兌換指名券)。數字皆 PLACEHOLDER。
//   shard[品階 0~3] = 路人熔鍊碎片(白青藍紫);zongBonus = 宗師型(learn 3)額外;starHalf = 帶星的卡額外 +星數 × 品階基礎 × 此值;fig[品階] = 手動熔名人(二次確認,不入一鍵 / 自動)
//   starCost[品階][星 0→1 … 4→5] = 升星碎片;figMul = 名人 ×;tokOff = 每個信物抵費用比例,上限 tokOffMax(信物仍上限 CARD_CFG.tokMax、不可直接兌換)
//   starBonus = 每星攻 / 防 / HP 加成(乘算係數),skillStar 星起解鎖技能強化旗標,markStar 星 = 專屬標記;starMax 星上限
//   exchange = 碎片換指名券:shards 碎 = 1 張,weekMax 張 / 週(週界線同既有 7 日週:cards.js cardsWeekNo)
var CARD_FURNACE = {
  shard: [2, 4, 8, 16], zongBonus: 8, starHalf: 0.5, fig: { 3: 20, 4: 40 },
  starMax: 5,
  starCost: [[10, 20, 40, 80, 160], [15, 30, 60, 120, 240], [20, 40, 80, 160, 320], [30, 60, 120, 240, 480], [40, 80, 160, 320, 640]],   // 白 青 藍 紫 金(金 = 白 ×4)
  figMul: 2, tokOff: 0.3, tokOffMax: 0.9,
  starBonus: { atk: 0.04, def: 0.04, hp: 0.04, skillStar: 3, markStar: 5 },
  exchange: { shards: 120, weekMax: 3 }
};
var CARD_FIG_BY_ID = {};
CARD_FIGS.forEach(function (f) { CARD_FIG_BY_ID[f.id] = f; });
if (typeof module !== 'undefined' && module.exports) module.exports = { CARD_GRADE: CARD_GRADE, CARD_JOBS: CARD_JOBS, CARD_TRAITS: CARD_TRAITS, CARD_FIGS: CARD_FIGS, CARD_VENUES: CARD_VENUES };
