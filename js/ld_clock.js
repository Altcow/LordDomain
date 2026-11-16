// js/ld_clock.js — 時間替身(設計_M1視覺原型_實作計畫.md 第 3.5 節,W0)。
// 所有新地圖程式(wm_* 新檔)一律用 ldNow(),不直接呼叫 Date.now();本機 = Date.now(),共享世界接線時只改 ldClockSync。
// 純資料 + 純函式,不碰 DOM / 存檔;ES2017,不用 ?. ??。載入順序:features.js 之後、其他新地圖程式之前(index.html、sw.js PRECACHE 同步)。
// 全域名:LDCLK ldNow ldClockSync ldClockSet
var LDCLK = { off: 0, src: 'local' };   // off = 伺服器時間 − 本機時間(毫秒);src = 'local' | 'server'
// 目前時間(毫秒,同 Date.now 的刻度)
function ldNow() { return Date.now() + LDCLK.off; }
// 同步時鐘(本機實作:偏移歸零、永遠成功)。共享世界時改為:寫 .sv 再讀回算 off(共享世界規格 5.6),成功 cb(true)、失敗 cb(false)。
function ldClockSync(cb) {
  LDCLK.off = 0; LDCLK.src = 'local';
  if (cb) cb(true);
}
// 直接設定偏移(給 Firebase 接線與測試用):off 非有限數字時忽略
function ldClockSet(off, src) {
  off = Number(off);
  if (!isFinite(off)) return false;
  LDCLK.off = off; LDCLK.src = src === 'server' ? 'server' : 'local';
  return true;
}
