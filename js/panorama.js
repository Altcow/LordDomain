// 全景離屏繪製（PLAN 11.3）：全景預覽入口與 DOM 已移除；保留 renderPanorama 與 pano 物件（pano.open 恆為 false，citylife.js / render.js / recorder.js 仍以它判斷）
const PANO_PAD = 8, PANO_TOP = MAX_H * HL + 64, PANO_BOTTOM = HL + 8;
const pano = { open: false, busy: false, token: 0, blob: null, file: null, url: '', mode: '', w: 0, h: 0, ms: 0, encMs: 0 };

function panoBounds() {
  const left = isoX(0, MAP_H) - PANO_PAD, right = isoX(MAP_W, 0) + PANO_PAD;
  const top = isoY(0, 0, 0) - PANO_TOP, bottom = isoY(MAP_W, MAP_H, 0) + PANO_BOTTOM;
  return { cx: (left + right) / 2, cy: (top + bottom) / 2, w: right - left, h: bottom - top };
}

// 暫改 view/viewport/preview 以 draw() 畫到離屏 canvas，finally 一律還原
function renderPanorama(maxSide) {
  const b = panoBounds();
  const s = Math.min(1, maxSide / Math.max(b.w, b.h));
  const w = Math.round(b.w * s), h = Math.round(b.h * s);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  if (!c) throw new Error('2d context unavailable');
  const saved = { x: view.x, y: view.y, zoom: view.zoom, w: viewport.w, h: viewport.h, dpr: viewport.dpr, pv: preview.visible };
  const t0 = performance.now();
  try {
    view.x = b.cx;
    view.y = b.cy;
    view.zoom = s;
    viewport.w = w;
    viewport.h = h;
    viewport.dpr = 1;
    preview.visible = false;
    draw(c, performance.now() / 1000);
  } finally {
    view.x = saved.x;
    view.y = saved.y;
    view.zoom = saved.zoom;
    viewport.w = saved.w;
    viewport.h = saved.h;
    viewport.dpr = saved.dpr;
    preview.visible = saved.pv;
  }
  return { canvas: cv, w: w, h: h, ms: performance.now() - t0 };
}
