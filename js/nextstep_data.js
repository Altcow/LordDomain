// js/nextstep_data.js — 「推薦下一步」資料:開局引導鏈 NS_CHAIN(純資料,無 DOM)。引擎 nextstep.js、介面 nextstepui.js。
// 每步:id、icon、text(≤30 字,不命令式)、why(≤40 字)、go(前往動作,同 cityadvisor 的 go:build / panel / tech / camera,另加 bars)、
//   done(完成判定:cnt 建築數量 / houses 民居數 / techAny 已研發或排入第一項 / seen 開過某面板)、obj(要蓋的建築 id,用來判斷科技是否已解鎖)、needLab(需先有研究院)。
// text 可含 {n}:實際目標數 = min(done.n, 該建築的真實上限 nsCapOf);上限 0 的步驟略過(見 nextstep.js nsStepTarget)。
// 所有 obj / go.type / go.id 必須是 NL_OBJ_TECH 或 CITY_TECHS 的真實 id(tools/test_nextstep.js 會核對)。
// 前置科技未研發時,引擎自動插入「先研發 X」步驟;前置被時代擋住或已排入研發則略過該步(不卡死)。
// 全域名稱:NS_PREF_KEY NS_THROTTLE_MS NS_TIER_MARK NS_CHAIN NS_FIELD_TYPES
var NS_PREF_KEY = 'lorddomain.nextstep';       // 全域偏好 'on' / 'off'(預設 on)
var NS_THROTTLE_MS = 1500;                      // 計算節流,沿用顧問
// 教學已涵蓋的步驟(畢業後由教學標為已完成,不再重複推薦)
var NS_TUT_OVERLAP = ['n_house3', 'n_lab', 'n_tech', 'n_bars', 'n_privy', 'n_market', 'n_house6'];
var NS_TIER_MARK = { R: '■', Y: '▲', B: '●', C: '' };
var NS_FIELD_TYPES = ['field_sprout', 'field_millet', 'field_wheat', 'vegetable_plot'];

var NS_CHAIN = [
  { id: 'n_house', icon: '🏠', text: '不妨先蓋第一間民房,安頓百姓。', why: '有了人煙,城才活得起來,後面的事都由此而起。',
    go: { kind: 'build', type: 'house' }, obj: 'house', done: { k: 'cnt', t: ['house'], n: 1 } },
  { id: 'n_lumber', icon: '🪓', text: '何不蓋座伐木場,先備些木料?', why: '蓋房、鋪路都要木料,早些備著才不愁。',
    go: { kind: 'build', type: 'lumber' }, obj: 'lumber', done: { k: 'cnt', t: ['lumber'], n: 1 } },
  { id: 'n_well', icon: '💧', text: '民房旁不妨鑿一口水井。', why: '百姓要喝乾淨的水,有井衛生也跟著穩。',
    go: { kind: 'build', type: 'well' }, obj: 'well', done: { k: 'cnt', t: ['well'], n: 1 } },
  { id: 'n_field', icon: '🌾', text: '何不開一塊田,讓大家有飯吃?', why: '糧食是民心的底,田越近民居越好。',
    go: { kind: 'build', type: 'field_sprout' }, obj: 'field_sprout', done: { k: 'cnt', t: NS_FIELD_TYPES, n: 1 } },
  { id: 'n_house3', icon: '🏠', text: '再添兩間民房,湊成三戶。', why: '人多了才有稅收,也才有人手去做事。',
    go: { kind: 'build', type: 'house' }, obj: 'house', done: { k: 'houses', n: 3 } },
  { id: 'n_lab', icon: '📜', text: '不妨蓋座研究院,開啟學問。', why: '新建築都要靠研發解鎖,研究院是起點。',
    go: { kind: 'build', type: 'research' }, obj: 'research', done: { k: 'cnt', t: ['research'], n: 1 } },
  { id: 'n_tech', icon: '📜', text: '何不打開科技樹,研發第一項?', why: '挑一項喜歡的學問,研成後就能蓋新建築。',
    go: { kind: 'panel', id: 'tech' }, needLab: true, done: { k: 'techAny' } },
  { id: 'n_bars', icon: '🧭', text: '不妨看一眼民情長條圖。', why: '糧、水、衛生一目了然,出事前先有個底。',
    go: { kind: 'bars' }, done: { k: 'seen', id: 'bars' } },
  { id: 'n_road', icon: '🔲', text: '鋪一段石板路,讓人貨好走。', why: '路通了,人走得快,貨也送得準。',
    go: { kind: 'build', type: 'road_stone' }, obj: 'road_stone', done: { k: 'cnt', t: ['road_stone'], n: 3 } },
  { id: 'n_privy', icon: '🚻', text: '何不蓋座茅廁,顧一顧衛生?', why: '人一多就髒,茅廁能擋住疫病。',
    go: { kind: 'build', type: 'privy' }, obj: 'privy', done: { k: 'cnt', t: ['privy'], n: 1 } },
  { id: 'n_market', icon: '🏪', text: '不妨蓋座市集,商店才開得起來。', why: '有了市集,才能逛商店、做買賣。',
    go: { kind: 'build', type: 'market' }, obj: 'market', done: { k: 'cnt', t: ['market'], n: 1 } },
  { id: 'n_goods', icon: '📦', text: '有空看看庫房裡存了什麼。', why: '木料、石料夠不夠,庫房一看便知。',
    go: { kind: 'panel', id: 'goods' }, done: { k: 'seen', id: 'goods' } },
  { id: 'n_house6', icon: '🏠', text: '把民房擴到 {n} 間,城更像樣。', why: '住戶多了,各項民情才會真正吃緊。',
    go: { kind: 'build', type: 'house' }, obj: 'house', done: { k: 'houses', n: 6 } },
  { id: 'n_notice', icon: '📜', text: '何不立座告示牌,安定地方?', why: '人多了治安會鬆,告示牌能穩住秩序。',
    go: { kind: 'build', type: 'notice_board' }, obj: 'notice_board', done: { k: 'cnt', t: ['notice_board'], n: 1 } },
  { id: 'n_tavern', icon: '🍶', text: '不妨蓋座招賢館,招募第一位人物。', why: '招賢館聚四方賢才,是人物入城的門。',
    go: { kind: 'build', type: 'tavern' }, obj: 'tavern', done: { k: 'cnt', t: ['tavern'], n: 1 } },
  { id: 'n_story', icon: '🎙️', text: '何不蓋座說書台,添些樂子?', why: '有得消遣,民心自然安穩。',
    go: { kind: 'build', type: 'storyteller' }, obj: 'storyteller', done: { k: 'cnt', t: ['storyteller'], n: 1 } },
  { id: 'n_book', icon: '📖', text: '不妨蓋間書肆,教化百姓。', why: '教化高了,治安與研發都跟著受益。',
    go: { kind: 'build', type: 'shop_book' }, obj: 'shop_book', done: { k: 'cnt', t: ['shop_book'], n: 1 } },
  { id: 'n_house10', icon: '🏠', text: '把民房擴到 {n} 間,成個像樣的鎮。', why: '到這地步,民情長條圖會常有話要說。',
    go: { kind: 'build', type: 'house' }, obj: 'house', done: { k: 'houses', n: 10 } }
];
