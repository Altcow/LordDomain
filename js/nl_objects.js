// nl_objects.js — 無等級版新建築物件登記(PLAN_NOLEVEL 附錄 A「建」類 + PLAN_TECHTREE「新美術」類,共 30 件)。
// 美術在 js/art_nl.js(A.def,w / d 須與此處 w / h 一致);非正方形者 swap:true。
// group = 建造選單分類(BUILD_GROUPS 的 id);本檔在 ui.js 之後載入,把 id 補進該群組 items(已在者不重複)。
// 解鎖歸屬(NL_OBJ_TECH)由 js/nolevel_data.js 負責,本檔不改 progdata;成本皆 PLACEHOLDER。
// 未收錄:鋪設型(漕渠、陶管下水、堤)與 29 件風格民居皮膚 / 城牆皮膚 / 地標(歸風格線)。

const NL_NEW_OBJECTS = {
  jingshe:        { name: '精舍',       icon: '📚', w: 3, h: 2, group: 'rite', tech: 'wr_jingshe',  cost: { coin: 120 } },
  xue_she:        { name: '學舍',       icon: '🏫', w: 3, h: 2, group: 'rite', tech: 'ed_xuexiao',  cost: { coin: 140 } },
  xue_gong:       { name: '學宮',       icon: '🎓', w: 3, h: 3, group: 'rite', tech: 'ed_taixue',   cost: { coin: 400 } },
  xian_ya:        { name: '縣衙',       icon: '🏛️', w: 3, h: 3, group: 'live', tech: 'bd_xianting', cost: { coin: 350 } },
  shi_lou:        { name: '市樓',       icon: '🏮', w: 2, h: 2, group: 'shop', tech: 'tr_qiting',   cost: { coin: 220 } },
  ting_she:       { name: '亭舍',       icon: '🚩', w: 2, h: 2, group: 'town', tech: 'ed_lvling',   cost: { coin: 60 } },
  li_men:         { name: '里門',       icon: '⛩️', w: 2, h: 1, group: 'road', tech: 'bd_lvli',     cost: { coin: 50 }, on: 'gr' },
  gong_men:       { name: '宮門',       icon: '🏯', w: 3, h: 2, group: 'road', tech: 'bd_gongzhi',  cost: { coin: 500 } },
  yu_tang:        { name: '公共浴堂',   icon: '♨️', w: 2, h: 2, group: 'live', tech: 'md_yuchi',    cost: { coin: 130 } },
  tai_yi_shu:     { name: '太醫署',     icon: '⚕️', w: 3, h: 2, group: 'live', tech: 'md_yiji',     cost: { coin: 300 } },
  wanghuo_lou:    { name: '望火樓',     icon: '🔔', w: 1, h: 1, group: 'town', tech: 'bd_wanghuo',  cost: { coin: 120 } },
  cao_cang:       { name: '漕倉',       icon: '📦', w: 3, h: 2, group: 'port', tech: 'e_caoyun',    cost: { coin: 260 } },
  changping_cang: { name: '常平倉',     icon: '🌾', w: 2, h: 2, group: 'farm', tech: 'e_changping', cost: { coin: 200 } },
  wen_shi:        { name: '溫室菜窖',   icon: '🥬', w: 2, h: 2, group: 'farm', tech: 'ag_wenshi',   cost: { coin: 110 } },
  jing_qu:        { name: '井渠',       icon: '💧', w: 2, h: 2, group: 'farm', tech: 'wa_jingqu',   cost: { coin: 160 } },
  shui_xie:       { name: '水榭',       icon: '🏞️', w: 2, h: 2, group: 'garden', tech: 'bd_yuanyou', cost: { coin: 150 } },
  lou_che_fang:   { name: '耬車作坊',   icon: '🛠️', w: 2, h: 2, group: 'farm', tech: 'ag_lou',      cost: { coin: 100 } },
  zao_zhi:        { name: '造紙坊',     icon: '📜', w: 2, h: 2, group: 'ind',  tech: 'wr_caihou',   cost: { coin: 140 } },
  qi_qi_fang:     { name: '漆器坊',     icon: '🏺', w: 2, h: 2, group: 'ind',  tech: 'cr_qiqi',     cost: { coin: 150 } },
  jin_fang:       { name: '錦坊',       icon: '🧵', w: 2, h: 2, group: 'ind',  tech: 'cr_jinzhi',   cost: { coin: 150 } },
  yu_qi_fang:     { name: '玉器坊',     icon: '💎', w: 2, h: 2, group: 'ind',  tech: 'cr_zhuoyu',   cost: { coin: 200 } },
  yin_lou:        { name: '銀樓',       icon: '🪙', w: 2, h: 2, group: 'shop', tech: 'cr_jinyin',   cost: { coin: 200 } },
  ci_yao:         { name: '瓷窯',       icon: '🍶', w: 2, h: 2, group: 'ind',  tech: 'cr_ciyao',    cost: { coin: 160 } },
  jiang_zuo:      { name: '將作監',     icon: '📐', w: 3, h: 2, group: 'ind',  tech: 'e_dajiang',   cost: { coin: 320 } },
  shui_pai:       { name: '冶鐵坊(水排)', icon: '⚒️', w: 3, h: 2, group: 'ind', tech: 'cr_shuipai', cost: { coin: 260 } },
  fan_che:        { name: '翻車',       icon: '⚙️', w: 1, h: 2, group: 'farm', tech: 'wa_fanche',   cost: { coin: 90 } },
  hun_tian:       { name: '渾天儀臺',   icon: '🔭', w: 2, h: 2, group: 'rite', tech: 'rl_huntian',  cost: { coin: 280 } },
  di_dong:        { name: '地動儀',     icon: '🏺', w: 1, h: 1, group: 'rite', tech: 'rl_didong',   cost: { coin: 240 } },
  shi_gong_qiao:  { name: '石拱橋',     icon: '🌉', w: 2, h: 1, group: 'road', tech: 'bd_qiao',     cost: { coin: 90 }, on: 'water' },
  ma_mian:        { name: '馬面',       icon: '🧱', w: 2, h: 2, group: 'road', tech: 'df_mamian',   cost: { coin: 120 } }
};

(function () {
  if (typeof OBJECTS === 'undefined') return;
  Object.keys(NL_NEW_OBJECTS).forEach(function (id) {
    var s = NL_NEW_OBJECTS[id];
    if (OBJECTS[id]) return;
    var o = { name: s.name, icon: s.icon, w: s.w, h: s.h, cost: s.cost, side: 'estate', nl: true,
      on: s.on === 'water' ? [T_LAKE, T_RIVER] : [T_GRASS, T_ROAD] };
    if (s.w !== s.h) o.swap = true;
    OBJECTS[id] = o;
  });
  if (typeof BUILD_GROUPS !== 'undefined') {
    Object.keys(NL_NEW_OBJECTS).forEach(function (id) {
      var g = BUILD_GROUPS.find(function (x) { return x.id === NL_NEW_OBJECTS[id].group; });
      if (g && g.items.indexOf(id) < 0) g.items.push(id);
    });
  }
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { NL_NEW_OBJECTS };
