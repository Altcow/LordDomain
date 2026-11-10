// js/portrait_gender.js — 頭像性別表:依頭像實際畫面(臉、髮型、服飾)逐張目視判定,'m' 男 / 'f' 女。
// 鍵:'generic/<職業頭像id>_<a|b|c>'(78)、'biaoshi_NN'(30)、名人 id(100)。拿不準者仍給最可能值,見下方 UNSURE 註記。
// 不確定(依畫面最可能值標記):generic/bingshi_b(f) caishi_c(m) ciling_a(f) jiaohua_a(m) jisuan_a(f) lizhi_a(m) lvfa_c(m) niangzao_a(m) shangcai_c(m) yetie_c(m) yuewu_a(f) zaozhi_c(m) zhishui_c(m);biaoshi_21(m) biaoshi_23(f) biaoshi_25(m)。
// 全域名稱:PORTRAIT_GENDER portraitGenderOf
var PORTRAIT_GENDER = {
  'generic/bingshi_a': 'm', 'generic/bingshi_b': 'f', 'generic/bingshi_c': 'm', 'generic/caishi_a': 'm', 'generic/caishi_b': 'm', 'generic/caishi_c': 'm',
  'generic/ciling_a': 'f', 'generic/ciling_b': 'm', 'generic/ciling_c': 'm', 'generic/fangzhi_a': 'f', 'generic/fangzhi_b': 'm', 'generic/fangzhi_c': 'm',
  'generic/jiaohua_a': 'm', 'generic/jiaohua_b': 'm', 'generic/jiaohua_c': 'm', 'generic/jiqiao_a': 'm', 'generic/jiqiao_b': 'm', 'generic/jiqiao_c': 'm',
  'generic/jisuan_a': 'f', 'generic/jisuan_b': 'm', 'generic/jisuan_c': 'm', 'generic/linmu_a': 'm', 'generic/linmu_b': 'f', 'generic/linmu_c': 'm',
  'generic/lizhi_a': 'm', 'generic/lizhi_b': 'm', 'generic/lizhi_c': 'm', 'generic/lvfa_a': 'f', 'generic/lvfa_b': 'm', 'generic/lvfa_c': 'm',
  'generic/niangzao_a': 'm', 'generic/niangzao_b': 'm', 'generic/niangzao_c': 'm', 'generic/nongshi_a': 'm', 'generic/nongshi_b': 'f', 'generic/nongshi_c': 'm',
  'generic/paochu_a': 'm', 'generic/paochu_b': 'f', 'generic/paochu_c': 'f', 'generic/shangcai_a': 'f', 'generic/shangcai_b': 'm', 'generic/shangcai_c': 'm',
  'generic/taoci_a': 'm', 'generic/taoci_b': 'f', 'generic/taoci_c': 'f', 'generic/tianwen_a': 'm', 'generic/tianwen_b': 'f', 'generic/tianwen_c': 'm',
  'generic/wenshu_a': 'f', 'generic/wenshu_b': 'f', 'generic/wenshu_c': 'm', 'generic/xumu_a': 'm', 'generic/xumu_b': 'f', 'generic/xumu_c': 'm',
  'generic/yetie_a': 'm', 'generic/yetie_b': 'm', 'generic/yetie_c': 'm', 'generic/yingzao_a': 'm', 'generic/yingzao_b': 'm', 'generic/yingzao_c': 'm',
  'generic/yishu_a': 'f', 'generic/yishu_b': 'm', 'generic/yishu_c': 'm', 'generic/yuewu_a': 'f', 'generic/yuewu_b': 'm', 'generic/yuewu_c': 'f',
  'generic/yulie_a': 'm', 'generic/yulie_b': 'f', 'generic/yulie_c': 'm', 'generic/zaozhi_a': 'm', 'generic/zaozhi_b': 'f', 'generic/zaozhi_c': 'm',
  'generic/zhishui_a': 'm', 'generic/zhishui_b': 'f', 'generic/zhishui_c': 'm', 'generic/zhouche_a': 'm', 'generic/zhouche_b': 'f', 'generic/zhouche_c': 'm',
  'biaoshi_01': 'm', 'biaoshi_02': 'm', 'biaoshi_03': 'm', 'biaoshi_04': 'f', 'biaoshi_05': 'm', 'biaoshi_06': 'm',
  'biaoshi_07': 'm', 'biaoshi_08': 'm', 'biaoshi_09': 'f', 'biaoshi_10': 'm', 'biaoshi_11': 'm', 'biaoshi_12': 'm',
  'biaoshi_13': 'm', 'biaoshi_14': 'f', 'biaoshi_15': 'm', 'biaoshi_16': 'm', 'biaoshi_17': 'm', 'biaoshi_18': 'f',
  'biaoshi_19': 'm', 'biaoshi_20': 'm', 'biaoshi_21': 'm', 'biaoshi_22': 'm', 'biaoshi_23': 'f', 'biaoshi_24': 'm',
  'biaoshi_25': 'm', 'biaoshi_26': 'm', 'biaoshi_27': 'm', 'biaoshi_28': 'm', 'biaoshi_29': 'f', 'biaoshi_30': 'm',
  'boca': 'm', 'caiyong': 'm', 'caocao': 'm', 'caoren': 'm', 'chengpu': 'm', 'dianwei': 'm',
  'dongzhuo': 'm', 'fazheng': 'm', 'ganning': 'm', 'gongsunzan': 'm', 'guanhai': 'm', 'guanyu': 'm',
  'guojia': 'm', 'guotai': 'm', 'huangfusong': 'm', 'huanggai': 'm', 'huangzhong': 'm', 'huatuo': 'm',
  'jiaxu': 'm', 'liubei': 'm', 'liupi': 'm', 'lusu': 'm', 'luxun': 'm', 'luzhi': 'm',
  'lvbu': 'm', 'lvmeng': 'm', 'machao': 'm', 'maliang': 'm', 'mateng': 'm', 'mayuanyi': 'm',
  'mizhu': 'm', 'pangtong': 'm', 'shamoke': 'm', 'shixie': 'm', 'simayi': 'm', 'sunce': 'm',
  'sunjian': 'm', 'sunquan': 'm', 'taishici': 'm', 'weiyan': 'm', 'xiahoudun': 'm', 'xiahouyuan': 'm',
  'xuchu': 'm', 'xuhuang': 'm', 'xunyou': 'm', 'xunyu': 'm', 'xurong': 'm', 'xushu': 'm',
  'youtu': 'm', 'yuanshao': 'm', 'yudu': 'm', 'yufuluo': 'm', 'yuji': 'm', 'zhangbao': 'm',
  'zhangfei': 'm', 'zhangjiao': 'm', 'zhangliang': 'm', 'zhangliao': 'm', 'zhanglu': 'm', 'zhangmancheng': 'm',
  'zhangniujiao': 'm', 'zhangyan': 'm', 'zhangzhao': 'm', 'zhaoyun': 'm', 'zhengxuan': 'm', 'zhongyao': 'm',
  'zhoutai': 'm', 'zhouyu': 'm', 'zhugeliang': 'm', 'zhujun': 'm',
  // 戰鬥改版新增 30 位名人(依人物設定:9 位女性)
  'zhenji': 'f', 'caiyan': 'f', 'caozhi': 'm', 'yangxiu': 'm', 'pangde': 'm', 'zhanghe': 'm',
  'ganfuren': 'f', 'mifuren': 'f', 'masu': 'm', 'huangyueying': 'f', 'zhoucang': 'm', 'yanyan': 'm',
  'sunshangxiang': 'f', 'lingtong': 'm', 'daqiao': 'f', 'xiaoqiao': 'f', 'dingfeng': 'm', 'kanze': 'm',
  'nanhua': 'm', 'chengyuanzhi': 'm', 'dengmao': 'm', 'peiyuanshao': 'm', 'heyi': 'm', 'zhangkai': 'm',
  'diaochan': 'f', 'zuoci': 'm', 'panfeng': 'm', 'caoxing': 'm', 'huaxiong': 'm', 'yuanshu': 'm',
  // 2026-11-10 新名人 7 位(皆男)
  'taoqian': 'm', 'wangping': 'm', 'gaoshun': 'm', 'caochun': 'm', 'chendao': 'm', 'quyi': 'm', 'liuzhang': 'm'
};
// 查表:key 為上述鍵;查無回 null。魔幻英雄(js/fx_cards.js 登錄進 CARD_FIG_BY_ID,帶 sex)不列在本表,改查其 sex 欄
function portraitGenderOf(key) {
  var f = (typeof CARD_FIG_BY_ID !== 'undefined' && key) ? CARD_FIG_BY_ID[key] : null;
  return (typeof PORTRAIT_GENDER !== 'undefined' && PORTRAIT_GENDER[key]) || (f && (f.sex === 'm' || f.sex === 'f') ? f.sex : null) || null;
}
