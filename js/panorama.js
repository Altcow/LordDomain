// 全景預覽（PLAN 11.3）：離屏一次繪製整張地圖，以 <img> 顯示，可儲存
const PANO_MAX_SIDE = 2048;
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

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function panoFileName() {
  const d = new Date(), p = n => (n < 10 ? '0' : '') + n;
  return 'lorddomain-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.png';
}

function panoSaveMode(file) {
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (coarse && navigator.share && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) return 'share';
    } catch (e) {
      console.warn('[pano] canShare failed', e);
    }
  }
  return isIOS() ? 'longpress' : 'download';
}

function setPanoMsg(text) {
  document.getElementById('panoMsg').textContent = text;
}

function panoReadyMsg() {
  if (pano.mode === 'share') return '按「儲存圖片」可存到相簿';
  if (pano.mode === 'longpress') return '長按圖片可儲存';
  return '全景 ' + pano.w + '×' + pano.h;
}

function openPanorama() {
  if (pano.open) return;
  toggleShop(false);
  toggleTplMenu(false);
  pano.open = true;
  pano.busy = true;
  const token = ++pano.token;
  document.getElementById('panoImg').removeAttribute('src');
  document.getElementById('panoSave').disabled = true;
  setPanoMsg('產生中…');
  document.getElementById('pano').hidden = false;
  requestAnimationFrame(() => setTimeout(() => buildPanorama(token), 0));
}

function buildPanorama(token) {
  if (token !== pano.token) return;
  let r;
  try {
    r = renderPanorama(PANO_MAX_SIDE);
  } catch (e) {
    console.error('[pano] render failed', e);
    panoFail();
    return;
  }
  pano.w = r.w;
  pano.h = r.h;
  pano.ms = r.ms;
  const t1 = performance.now();
  r.canvas.toBlob(blob => {
    r.canvas.width = 0;
    r.canvas.height = 0;
    if (token !== pano.token) return;
    if (!blob) {
      console.error('[pano] toBlob returned null');
      panoFail();
      return;
    }
    pano.encMs = performance.now() - t1;
    console.info('[pano] ' + pano.w + 'x' + pano.h + ' draw ' + pano.ms.toFixed(1) + 'ms, encode ' + pano.encMs.toFixed(0) + 'ms, ' + Math.round(blob.size / 1024) + 'KB');
    pano.blob = blob;
    pano.file = new File([blob], panoFileName(), { type: 'image/png' });
    pano.mode = panoSaveMode(pano.file);
    pano.url = URL.createObjectURL(blob);
    document.getElementById('panoImg').src = pano.url;
    document.getElementById('panoSave').disabled = false;
    pano.busy = false;
    setPanoMsg(panoReadyMsg());
  }, 'image/png');
}

function panoFail() {
  closePanorama();
  showToast('全景產生失敗');
}

function closePanorama() {
  if (!pano.open) return;
  pano.open = false;
  pano.busy = false;
  pano.token++;
  document.getElementById('pano').hidden = true;
  document.getElementById('panoImg').removeAttribute('src');
  if (pano.url) URL.revokeObjectURL(pano.url);
  pano.url = '';
  pano.blob = null;
  pano.file = null;
  pano.mode = '';
}

function savePanorama() {
  if (!pano.file) return;
  if (pano.mode === 'share') {
    navigator.share({ files: [pano.file], title: '城主領地 全景' }).catch(e => {
      if (e && e.name === 'AbortError') return;
      console.warn('[pano] share failed', e);
      pano.mode = isIOS() ? 'longpress' : 'download';
      setPanoMsg(pano.mode === 'longpress' ? '請長按圖片，選「加入照片」' : '分享失敗，請再按一次改為下載');
    });
    return;
  }
  if (pano.mode === 'longpress') {
    setPanoMsg('請長按圖片，選「加入照片」');
    return;
  }
  const a = document.createElement('a');
  a.href = pano.url;
  a.download = pano.file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
