// glr.js — 經營板繪圖後端:薄介面 rq*(R0.5)+ WebGL 合成原型(R1)。PLAN_RENDER.md「R0.5/R1 實作紀錄」
// 載入順序:art.js 之後、render.js 之前。本檔只在 draw() 執行期被呼叫,載入時不碰 DOM。
//
// 架構(旗標 RENDER.backend = 'c2d' | 'gl',預設 'c2d';localStorage 'lorddomain.render',網址 ?gl=1 / ?gl=0 暫時覆蓋):
//   c2d  :rq* 全部直接轉成原本的 ctx 呼叫(drawImage / fill / save / translate…),輸出與改前逐指令相同。
//   gl   :三層疊放 —— #game(2D,底:背景 + 地形 + 其他 2D)→ GL 畫布(中:物件 sprite、遠景色塊、居民 sprite 與色點)
//          → 疊加層 2D 畫布(頂:預覽 / 草稿 / 光暈 / 動畫件 / HUD)。物件與居民依畫家順序進同一個批次,一幀一次 drawElements。
//   只有 draw() 以 #game 的 ctx 呼叫 rqBegin 的那一幀才可能走 GL;其餘 ctx(戰鬥、釣魚、寵物、單位資訊、全景離屏)一律走 c2d。
//   GL 自動停用條件:不支援 / 建立失敗 / context lost 兩次 / 非經營模式 / 拍照 / 錄影(body.shooting、photo-mode)/ 全景。
// 規則:新的繪圖功能一律用 rq* 與本檔路徑實作,不得在經營板熱路徑直接加 ctx.drawImage(PLAN_RENDER.md「WebGL 開發守則」)。

var RENDER_KEY = 'lorddomain.render';
var RENDER = {
  backend: 'c2d',      // 偏好旗標('c2d' | 'gl');設定頁與網址參數寫這裡
  active: false,       // 本幀實際走 GL
  status: 'off',       // off | init | ready | lost | failed | disabled
  reason: '',          // 最近一次停用 / 失敗原因
  lostCount: 0, notified: false,
  caps: null,          // { version, maxTex, maxUnits, renderer }
  err: '',             // 最近一次 GL 提交例外(除錯用)
  stats: { frames: 0, quads: 0, draws: 0, uploads: 0, uploadPx: 0, fallback: 0, pages: 0, resets: 0, lastMs: 0, aborts: 0, bakes: 0, bakeMs: 0, terrDraws: 0, terrBytes: 0, terrEvict: 0 }
};

(function () {
  var PAGE_MAX = 2048;       // atlas 頁邊長上限(iOS 保守:不碰 4096)
  var PAGES = 4;             // 同批最多 4 頁(fragment shader 4 個 sampler)= 最多 64 MB
  var MAXQ = 12000;          // 單批四邊形上限(Uint16 索引 ≤ 65535 頂點)
  var FLOATS = 6;            // 每頂點:x y u v color(uint32) tex
  var RESERVED_H = 40;       // page 0 頂部保留:白點 8×8 + 圓盤 32×32
  var UPLOAD_MS = 7;         // 每幀上傳時間預算(超過的 sprite 本幀改畫在疊加層,下一幀再傳)
  var DISC = 32;
  var TERR_CAP = 48 * 1024 * 1024;   // 地形分塊紋理總量上限(bytes,色圖 + 深度圖),超過以 LRU 淘汰
  var TERR_BAKE_MS = 10;     // 每幀地形分塊重烘時間預算(至少烘 1 塊)
  var SOFT_BAKE_MS = 6;      // GL 幀內 sprite 重烤(換季 / 換時段)每幀時間預算,超過者暫用舊版 sprite(art.js objSprite / chibiSprite)
  var TERR_PREFETCH = 1;     // 每幀最多預烘(視窗外一圈)幾塊

  var RQ = {
    gl: false, ctx: null, ov: null, base: null,
    ma: 1, mb: 0, mc: 0, md: 1, me: 0, mf: 0, ga: 1, ident: true,
    sp: 0, st: new Float64Array(8 * 8),
    va: 1, ve: 0, vf: 0, W: 1, H: 1, frame: 0, upMs: 0, shown: false, hold: 0,
    zq: 0, dinv: 0.005, dm: 200, add: false, sweep: false
  };
  var G = null;     // GL 狀態:{ gl, cv, ov, ovc, prog, loc, vbo, ibo, pages:[], dummy, f32, u32, n, ver, caps, ... }
  var colorMemo = {}, colorMemoN = 0;
  var testHooks = null;

  // ---------- 旗標存取 ----------
  function prefLoad() {
    var v = 'c2d';
    try { if (typeof localStorage !== 'undefined') { var s = localStorage.getItem(RENDER_KEY); if (s === 'gl' || s === 'c2d') v = s; } } catch (e) { /* 私密模式等:用預設 */ }
    try {
      if (typeof location !== 'undefined' && location.search) {
        var m = /[?&]gl=(\d)/.exec(location.search);
        if (m) v = m[1] === '1' ? 'gl' : 'c2d';
      }
    } catch (e2) { /* ignore */ }
    return v;
  }
  function prefSave(v) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(RENDER_KEY, v); } catch (e) { /* ignore */ }
  }
  // 設定頁 / 主控台用:切換後端。v = 'c2d' | 'gl';persist 預設 true
  function renderSetBackend(v, persist) {
    if (v !== 'gl') v = 'c2d';
    RENDER.backend = v;
    if (persist !== false) prefSave(v);
    if (v === 'gl') { RENDER.lostCount = 0; RENDER.notified = false; if (RENDER.status === 'disabled' || RENDER.status === 'failed') RENDER.status = 'off'; RENDER.reason = ''; }
    return v;
  }
  function renderGetBackend() { return RENDER.backend; }
  RENDER.backend = prefLoad();
  // 目前是否可用(設定頁顯示用):尚未嘗試過視為可用
  function renderGlUsable() { return RENDER.status !== 'failed'; }

  function notifyOnce(msg) {
    if (RENDER.notified) return;
    RENDER.notified = true;
    try { if (typeof showToast === 'function') showToast(msg); } catch (e) { /* ignore */ }
  }
  function failGl(reason, persistOff) {
    RENDER.status = 'failed';
    RENDER.reason = reason;
    RENDER.backend = 'c2d';
    if (persistOff) prefSave('c2d');
    RQ.gl = false; RENDER.active = false;
    notifyOnce('加速繪圖無法使用(' + reason + '),已改回標準繪圖');
  }

  // ---------- 顏色 ----------
  var scratch2d = null;
  function parseColor(str) {
    var c = colorMemo[str];
    if (c) return c;
    var r = 0, g = 0, b = 0, a = 1, m;
    if ((m = /^#([0-9a-f]{6})$/i.exec(str))) { var n = parseInt(m[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
    else if ((m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(str))) { r = parseInt(m[1] + m[1], 16); g = parseInt(m[2] + m[2], 16); b = parseInt(m[3] + m[3], 16); }
    else if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(str))) { r = +m[1]; g = +m[2]; b = +m[3]; a = m[4] === undefined ? 1 : +m[4]; }
    else if (typeof document !== 'undefined' && document.createElement) {
      try {
        if (!scratch2d) scratch2d = document.createElement('canvas').getContext('2d');
        scratch2d.fillStyle = '#000'; scratch2d.fillStyle = str;
        var s2 = String(scratch2d.fillStyle);
        if (s2 !== str) return (colorMemo[str] = parseColor(s2));
      } catch (e) { /* ignore */ }
    }
    c = [r, g, b, a];
    if (colorMemoN++ > 4000) { colorMemo = {}; colorMemoN = 0; }
    colorMemo[str] = c;
    return c;
  }
  function packColor(c, ga) {
    var a = c[3] * ga;
    if (a < 0) a = 0; else if (a > 1) a = 1;
    var r = Math.round(c[0] * a), g = Math.round(c[1] * a), b = Math.round(c[2] * a), al = Math.round(a * 255);
    return ((al << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  function packAlpha(ga) {
    var a = Math.round((ga < 0 ? 0 : ga > 1 ? 1 : ga) * 255);
    return ((a << 24) | (a << 16) | (a << 8) | a) >>> 0;
  }

  // ---------- 能力偵測 ----------
  function glrDetect() {
    var out = { ok: false, version: 0, maxTex: 0, maxUnits: 0, renderer: '', reason: '' };
    if (typeof document === 'undefined' || !document.createElement) { out.reason = 'no-dom'; return out; }
    var cv, gl = null;
    try {
      cv = document.createElement('canvas');
      gl = cv.getContext('webgl2', { depth: false, stencil: false, antialias: false });
      if (gl) out.version = 2;
      else { gl = cv.getContext('webgl', { depth: false, stencil: false, antialias: false }) || cv.getContext('experimental-webgl'); if (gl) out.version = 1; }
    } catch (e) { out.reason = 'context-error'; return out; }
    if (!gl) { out.reason = 'no-webgl'; return out; }
    out.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) | 0;
    out.maxUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) | 0;
    try { var ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) out.renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)); } catch (e2) { /* ignore */ }
    out.fragDepth = out.version === 2 || !!gl.getExtension('EXT_frag_depth');
    if (out.maxTex < 1024) out.reason = 'max-texture-' + out.maxTex;
    else if (!out.fragDepth) out.reason = 'no-frag-depth';
    else if (out.maxUnits < PAGES) out.reason = 'texture-units-' + out.maxUnits;
    else out.ok = true;
    try { var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch (e3) { /* ignore */ }
    return out;
  }

  // ---------- shader / 初始化 ----------
  // 物件批次:頂點 z 由 a_tex 帶入(a_tex = 頁號 + 4 * 對角線 d);深度只測不寫,與地形分塊的逐像素深度(對角線 d)比較 → 畫家順序遮擋
  var VS = 'attribute vec2 a_pos;attribute vec2 a_uv;attribute vec4 a_col;attribute float a_tex;' +
    'uniform vec4 u_xf;uniform float u_dinv;varying vec2 v_uv;varying vec4 v_col;varying float v_tex;' +
    'void main(){float pg=mod(a_tex,4.0);float zi=(a_tex-pg)*0.25;' +
    'gl_Position=vec4(a_pos*u_xf.xy+u_xf.zw,1.0-2.0*(zi+1.5)*u_dinv,1.0);v_uv=a_uv;v_col=a_col;v_tex=pg;}';
  var FS = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
    'uniform sampler2D u_t0;uniform sampler2D u_t1;uniform sampler2D u_t2;uniform sampler2D u_t3;' +
    'varying vec2 v_uv;varying vec4 v_col;varying float v_tex;' +
    'void main(){vec4 c;if(v_tex<0.5)c=texture2D(u_t0,v_uv);else if(v_tex<1.5)c=texture2D(u_t1,v_uv);' +
    'else if(v_tex<2.5)c=texture2D(u_t2,v_uv);else c=texture2D(u_t3,v_uv);gl_FragColor=c*v_col;}';
  // 地形分塊:色圖 u_c(預乘 alpha)+ 深度圖 u_dm(R = 塊內對角線 + 1,A = 覆蓋);gl_FragDepth = 1 - (d + 1) / 總數;u_tint = 時段乘色(合成時套用)
  var TVS3 = '#version 300 es\nin vec2 a_pos;in vec2 a_uv;uniform vec4 u_xf;out vec2 v_uv;void main(){gl_Position=vec4(a_pos*u_xf.xy+u_xf.zw,0.0,1.0);v_uv=a_uv;}';
  var TFS3 = '#version 300 es\nprecision highp float;uniform sampler2D u_c;uniform sampler2D u_dm;uniform vec3 u_tint;uniform float u_base;uniform float u_dinv;in vec2 v_uv;out vec4 o;' +
    'void main(){vec4 c=texture(u_c,v_uv);if(c.a<0.003)discard;vec4 d=texture(u_dm,v_uv);' +
    'float dl=d.a>0.5?floor(d.r/d.a*255.0+0.5)-1.0:0.0;gl_FragDepth=1.0-(u_base+dl+1.0)*u_dinv;o=vec4(c.rgb*u_tint,c.a);}';
  var TVS1 = 'attribute vec2 a_pos;attribute vec2 a_uv;uniform vec4 u_xf;varying vec2 v_uv;void main(){gl_Position=vec4(a_pos*u_xf.xy+u_xf.zw,0.0,1.0);v_uv=a_uv;}';
  var TFS1 = '#extension GL_EXT_frag_depth : enable\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
    'uniform sampler2D u_c;uniform sampler2D u_dm;uniform vec3 u_tint;uniform float u_base;uniform float u_dinv;varying vec2 v_uv;' +
    'void main(){vec4 c=texture2D(u_c,v_uv);if(c.a<0.003)discard;vec4 d=texture2D(u_dm,v_uv);' +
    'float dl=d.a>0.5?floor(d.r/d.a*255.0+0.5)-1.0:0.0;gl_FragDepthEXT=1.0-(u_base+dl+1.0)*u_dinv;gl_FragColor=vec4(c.rgb*u_tint,c.a);}';

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    return s;
  }

  function newPage(g) {
    var gl = g.gl, size = g.pageSize, p = { idx: g.pages.length, tex: gl.createTexture(), size: size, shelves: [], shelfY: 0, slots: [], live: 0, used: 0, resets: 0, hot: 0 };
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, p.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    if (p.idx === 0) {
      p.shelfY = RESERVED_H;
      // 白點(純色四邊形的取樣點)與圓盤(居民色點)
      var white = new Uint8Array(8 * 8 * 4);
      for (var i = 0; i < white.length; i++) white[i] = 255;
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, white);
      var disc = new Uint8Array(DISC * DISC * 4), rr = DISC / 2 - 0.5;
      for (var y = 0; y < DISC; y++) for (var x = 0; x < DISC; x++) {
        var d = Math.sqrt((x - 15.5) * (x - 15.5) + (y - 15.5) * (y - 15.5)), a = Math.max(0, Math.min(1, rr + 0.5 - d)), o = (y * DISC + x) * 4;
        disc[o] = disc[o + 1] = disc[o + 2] = 255; disc[o + 3] = Math.round(a * 255);
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 8, 0, DISC, DISC, gl.RGBA, gl.UNSIGNED_BYTE, disc);
      p.whiteU = 4 / size; p.whiteV = 4 / size;
      p.discU0 = 8 / size; p.discV0 = 0; p.discU1 = (8 + DISC) / size; p.discV1 = DISC / size;
    }
    g.pages.push(p);
    RENDER.stats.pages = g.pages.length;
    return p;
  }

  function glrBuild(g) {
    var gl = g.gl;
    var vs = compile(gl, gl.VERTEX_SHADER, VS), fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'a_pos'); gl.bindAttribLocation(prog, 1, 'a_uv'); gl.bindAttribLocation(prog, 2, 'a_col'); gl.bindAttribLocation(prog, 3, 'a_tex');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
    g.prog = prog;
    g.uXf = gl.getUniformLocation(prog, 'u_xf');
    g.uDinv = gl.getUniformLocation(prog, 'u_dinv');
    gl.useProgram(prog);
    for (var i = 0; i < PAGES; i++) gl.uniform1i(gl.getUniformLocation(prog, 'u_t' + i), i);
    // 地形分塊 program(WebGL2 用 GLSL ES 3.00;WebGL1 用 EXT_frag_depth)
    var tvs = compile(gl, gl.VERTEX_SHADER, g.ver === 2 ? TVS3 : TVS1), tfs;
    if (g.ver !== 2) gl.getExtension('EXT_frag_depth');
    tfs = compile(gl, gl.FRAGMENT_SHADER, g.ver === 2 ? TFS3 : TFS1);
    var tp = gl.createProgram();
    gl.attachShader(tp, tvs); gl.attachShader(tp, tfs);
    gl.bindAttribLocation(tp, 0, 'a_pos'); gl.bindAttribLocation(tp, 1, 'a_uv');
    gl.linkProgram(tp);
    if (!gl.getProgramParameter(tp, gl.LINK_STATUS)) throw new Error('link-terrain: ' + gl.getProgramInfoLog(tp));
    g.tprog = tp;
    g.tXf = gl.getUniformLocation(tp, 'u_xf'); g.tTint = gl.getUniformLocation(tp, 'u_tint'); g.tBase = gl.getUniformLocation(tp, 'u_base'); g.tDinv = gl.getUniformLocation(tp, 'u_dinv');
    gl.useProgram(tp);
    gl.uniform1i(gl.getUniformLocation(tp, 'u_c'), 0); gl.uniform1i(gl.getUniformLocation(tp, 'u_dm'), 1);
    g.tvbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g.tvbo);
    gl.bufferData(gl.ARRAY_BUFFER, 64, gl.DYNAMIC_DRAW);
    g.terr = { map: {}, cells: {}, bytes: 0, scratch: null, dscratch: null };
    gl.useProgram(prog);
    g.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, g.f32.byteLength, gl.DYNAMIC_DRAW);
    g.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.clearDepth(1);
    gl.disable(gl.CULL_FACE); gl.disable(gl.STENCIL_TEST); gl.disable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    // 未使用的 sampler 單位綁 1×1 暫用貼圖(避免 incomplete texture 警告)
    g.dummy = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.dummy);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    g.pages = [];
    newPage(g);
    g.n = 0;
  }

  function placeLayer(el, base) {
    el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;display:none;';
    if (base.parentNode) base.parentNode.insertBefore(el, base.nextSibling);
  }

  // 建立 GL 畫布與疊加層(只做一次);成功回傳 G
  function glrInit() {
    if (G) return G;
    RENDER.status = 'init';
    var base = RQ.base;
    if (!base || !base.parentNode) { failGl('no-canvas', false); return null; }
    var det = glrDetect();
    RENDER.caps = det;
    if (!det.ok) { failGl(det.reason || 'unsupported', true); return null; }
    var g = null;
    try {
      var cv = document.createElement('canvas');
      var gl = null, ver = 0;
      var opt = { alpha: true, premultipliedAlpha: true, antialias: false, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: 'default' };
      if (det.version === 2) { gl = cv.getContext('webgl2', opt); ver = 2; }
      if (!gl) { gl = cv.getContext('webgl', opt) || cv.getContext('experimental-webgl', opt); ver = 1; }
      if (!gl) { failGl('no-context', true); return null; }
      var ovc = document.createElement('canvas'), ov = ovc.getContext('2d');
      if (!ov) { failGl('no-overlay', true); return null; }
      var f32 = new Float32Array(MAXQ * 4 * FLOATS);
      var idx = new Uint16Array(MAXQ * 6);
      for (var q = 0, v = 0; q < MAXQ; q++, v += 4) { var o = q * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
      g = { gl: gl, cv: cv, ovc: ovc, ov: ov, ver: ver, pageSize: Math.min(PAGE_MAX, det.maxTex), f32: f32, u32: new Uint32Array(f32.buffer), idx: idx, n: 0, pages: [], lost: false, seq: 0 };
      if (testHooks && testHooks.pageSize) g.pageSize = testHooks.pageSize;
      glrBuild(g);
      placeLayer(cv, base);
      placeLayer(ovc, cv);
      cv.addEventListener('webglcontextlost', function (e) { if (e && e.preventDefault) e.preventDefault(); glrOnLost(); }, false);
      cv.addEventListener('webglcontextrestored', function () { glrOnRestored(); }, false);
    } catch (e) {
      failGl('init-' + String(e && e.message || e).slice(0, 40), true);
      return null;
    }
    G = g;
    RENDER.status = 'ready';
    return G;
  }

  function resetPageSlots(p) {
    for (var i = 0; i < p.slots.length; i++) { var s = p.slots[i]; if (s.spr && s.spr.gl === s) s.spr.gl = null; s.spr = null; s.dead = true; }
    p.slots.length = 0; p.shelves.length = 0; p.shelfY = p.idx === 0 ? RESERVED_H : 0; p.live = 0; p.used = 0; p.hot = 0;
  }

  function glrOnLost() {
    RENDER.lostCount++;
    RENDER.status = 'lost';
    RQ.gl = false; RENDER.active = false;
    if (G) { G.lost = true; for (var i = 0; i < G.pages.length; i++) resetPageSlots(G.pages[i]); G.n = 0; G.terr = { map: {}, cells: {}, bytes: 0, scratch: G.terr && G.terr.scratch, dscratch: G.terr && G.terr.dscratch }; }
    if (RENDER.lostCount >= 2) {
      RENDER.reason = 'context-lost-x2';
      RENDER.backend = 'c2d';     // 只改本次執行,不覆寫 localStorage;使用者可在設定重新選
      RENDER.status = 'disabled';
      notifyOnce('加速繪圖多次中斷(裝置回收了 GPU 資源),已改回標準繪圖');
    }
  }
  function glrOnRestored() {
    if (!G) return;
    if (RENDER.status === 'disabled') return;
    try {
      glrBuild(G);
      G.lost = false; G.seq++;
      RENDER.status = 'ready';
    } catch (e) {
      RENDER.reason = 'restore-failed'; RENDER.status = 'disabled'; RENDER.backend = 'c2d';
      notifyOnce('加速繪圖無法恢復,已改回標準繪圖');
    }
  }

  // ---------- atlas ----------
  function shelfAlloc(p, w, h) {
    var pw = w + 1, ph = h + 1, best = null, bw = 1e9, i;
    if (pw > p.size || ph > p.size) return null;
    for (i = 0; i < p.shelves.length; i++) {
      var s = p.shelves[i];
      if (ph <= s.h && p.size - s.x >= pw && s.h - ph < bw) { best = s; bw = s.h - ph; }
    }
    if (best) { var x = best.x; best.x += pw; return { x: x, y: best.y }; }
    var sh = Math.min(p.size - p.shelfY, Math.ceil(ph / 16) * 16);
    if (sh < ph) return null;
    var ns = { y: p.shelfY, h: sh, x: pw };
    p.shelves.push(ns); p.shelfY += sh;
    return { x: 0, y: ns.y };
  }
  function allocSlot(g, w, h) {
    var i, p, pos;
    for (i = 0; i < g.pages.length; i++) { p = g.pages[i]; pos = shelfAlloc(p, w, h); if (pos) return { p: p, pos: pos }; }
    if (g.pages.length < PAGES) { p = newPage(g); pos = shelfAlloc(p, w, h); if (pos) return { p: p, pos: pos }; }
    // 全滿:挑「近 90 幀仍被用到的槽最少」的整頁重置(先 flush,避免已排入批次的四邊形取樣到被覆蓋的內容)
    var vic = null, vh = 1e9;
    for (i = 0; i < g.pages.length; i++) {
      p = g.pages[i]; var hot = 0;
      for (var k = 0; k < p.slots.length; k++) if (!p.slots[k].dead && p.slots[k].last >= RQ.frame - 90) hot++;
      p.hot = hot;
      if (hot < vh || (hot === vh && vic && p.resets < vic.resets)) { vh = hot; vic = p; }
    }
    flush();
    resetPageSlots(vic); vic.resets++;
    RENDER.stats.resets++;
    pos = shelfAlloc(vic, w, h);
    return pos ? { p: vic, pos: pos } : null;
  }
  // 把 sprite 記錄(ART.sprite 回傳的 { cv, … })上傳到 atlas;失敗回傳 null(呼叫端改走 2D)
  function upload(g, spr) {
    var cv = spr.cv;
    if (!cv || spr.glNo === g.seq) return null;
    var w = cv.width, h = cv.height;
    if (w < 1 || h < 1 || w + 1 > g.pageSize || h + 1 > g.pageSize) { spr.glNo = g.seq; return null; }
    if (RQ.upMs > UPLOAD_MS) return null;
    var t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    var a = allocSlot(g, w, h);
    if (!a) { spr.glNo = g.seq; return null; }
    var gl = g.gl, p = a.p, s = a.pos;
    try {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, p.tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, s.x, s.y, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    } catch (e) { spr.glNo = g.seq; return null; }
    var sz = p.size;
    var slot = { page: p.idx, x: s.x, y: s.y, w: w, h: h, u0: s.x / sz, v0: s.y / sz, u1: (s.x + w) / sz, v1: (s.y + h) / sz, last: RQ.frame, dead: false, spr: spr };
    p.slots.push(slot); p.live += w * h; p.used += w * h;
    spr.gl = slot;
    RENDER.stats.uploads++; RENDER.stats.uploadPx += w * h;
    if (typeof performance !== 'undefined') RQ.upMs += performance.now() - t0;
    return slot;
  }
  // ART 快取淘汰時呼叫:標記槽失效(空間待整頁重置回收)
  function glrRelease(spr) {
    var s = spr && spr.gl;
    if (!s) return;
    s.dead = true; s.spr = null; spr.gl = null;
    if (G && G.pages[s.page]) G.pages[s.page].live -= s.w * s.h;
  }

  // ---------- 批次 ----------
  function flush() {
    var g = G;
    if (!g || g.n === 0) return;
    var gl = g.gl, n = g.n;
    g.n = 0;
    if (g.lost) return;
    try {
      gl.useProgram(g.prog);
      // 物件 / 居民:深度只測不寫(對角線 d 與地形分塊比較);光暈批次(加法混色)不測深度
      if (RQ.add) { gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.ONE, gl.ONE); }
      else { gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
      for (var i = 0; i < PAGES; i++) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, i < g.pages.length ? g.pages[i].tex : g.dummy);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.f32.subarray(0, n * 4 * FLOATS));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ibo);
      gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2); gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 8);
      gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 24, 16);
      gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 24, 20);
      gl.drawElements(gl.TRIANGLES, n * 6, gl.UNSIGNED_SHORT, 0);
      RENDER.stats.draws++; RENDER.stats.quads += n;
    } catch (e) { RENDER.err = String(e && e.message || e).slice(0, 80); /* context lost 時由事件處理 */ }
  }

  // 寫一個四邊形(世界座標 → 套本地矩陣;基底矩陣在 shader 內)
  function emit(x0, y0, x1, y1, x2, y2, x3, y3, u0, v0, u1, v1, col, tex) {
    var g = G;
    if (g.n >= MAXQ) flush();
    var f = g.f32, u = g.u32, o = g.n * 4 * FLOATS;
    tex += RQ.zq;
    f[o] = x0; f[o + 1] = y0; f[o + 2] = u0; f[o + 3] = v0; u[o + 4] = col; f[o + 5] = tex;
    o += FLOATS;
    f[o] = x1; f[o + 1] = y1; f[o + 2] = u1; f[o + 3] = v0; u[o + 4] = col; f[o + 5] = tex;
    o += FLOATS;
    f[o] = x2; f[o + 1] = y2; f[o + 2] = u1; f[o + 3] = v1; u[o + 4] = col; f[o + 5] = tex;
    o += FLOATS;
    f[o] = x3; f[o + 1] = y3; f[o + 2] = u0; f[o + 3] = v1; u[o + 4] = col; f[o + 5] = tex;
    g.n++;
  }

  // ---------- 框架:begin / view / flush / end ----------
  function glrWanted(ctx) {
    if (RENDER.backend !== 'gl') return false;
    if (RENDER.status === 'failed' || RENDER.status === 'disabled') return false;
    var base = RQ.base || (RQ.base = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('game') : null);
    if (!base || ctx.canvas !== base) return false;
    if (typeof artIsOn === 'function' && !artIsOn()) return false;   // ART 關閉(舊式向量建築)只走 c2d
    if (typeof game !== 'undefined' && game && game.mode !== 'estate') return false;
    if (typeof pano !== 'undefined' && pano && pano.open) return false;
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      var cl = document.body.classList;
      if (cl.contains('shooting') || cl.contains('photo-mode')) return false;
    }
    return true;
  }
  function setLayers(show) {
    if (!G || RQ.shown === show) return;
    RQ.shown = show;
    G.cv.style.display = show ? 'block' : 'none';
    G.ovc.style.display = show ? 'block' : 'none';
  }

  function rqBegin(ctx) {
    RQ.frame++; RQ.upMs = 0;
    RQ.gl = false; RQ.ctx = ctx; RQ.ov = ctx; RQ.sp = 0; RQ.add = false; RQ.sweep = false; RQ.zq = 0;
    if (typeof ART !== 'undefined') { ART.bakeMs = 0; ART.bakeBudget = 0; }
    RQ.ma = 1; RQ.mb = 0; RQ.mc = 0; RQ.md = 1; RQ.me = 0; RQ.mf = 0; RQ.ga = 1; RQ.ident = true;
    RENDER.active = false;
    if (RENDER.backend !== 'gl' && !G) return false;
    if (!glrWanted(ctx)) { setLayers(false); return false; }
    if (!G && !glrInit()) { return false; }
    if (!G) return false;
    if (G.lost || (G.gl.isContextLost && G.gl.isContextLost())) { setLayers(false); return false; }
    var cv = ctx.canvas, W = cv.width, H = cv.height;
    try {
      if (G.cv.width !== W || G.cv.height !== H) { G.cv.width = W; G.cv.height = H; }
      if (G.ovc.width !== W || G.ovc.height !== H) { G.ovc.width = W; G.ovc.height = H; }
      var gl = G.gl;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.depthMask(false);
      var ov = G.ov;
      ov.setTransform(1, 0, 0, 1, 0, 0);
      ov.globalAlpha = 1; ov.globalCompositeOperation = 'source-over';
      ov.clearRect(0, 0, W, H);
    } catch (e) { failGl('frame-' + String(e && e.message || e).slice(0, 40), false); return false; }
    RQ.W = W; RQ.H = H; G.n = 0;
    RQ.ov = G.ov; RQ.gl = true; RENDER.active = true;
    if (typeof ART !== 'undefined') ART.bakeBudget = SOFT_BAKE_MS;
    setLayers(true);
    return true;
  }
  // 在 draw() 設好世界矩陣後呼叫:a = dpr·zoom,e / f = 平移(像素)
  function rqView(ctx, a, e, f) {
    if (!RQ.gl || ctx !== RQ.ctx) return;
    RQ.va = a; RQ.ve = e; RQ.vf = f;
    RQ.ov.setTransform(a, 0, 0, a, e, f);
    var g = G, gl = g.gl;
    try {
      gl.useProgram(g.prog);
      gl.uniform4f(g.uXf, 2 * a / RQ.W, -2 * a / RQ.H, 2 * e / RQ.W - 1, 1 - 2 * f / RQ.H);
      gl.useProgram(g.tprog);
      gl.uniform4f(g.tXf, 2 * a / RQ.W, -2 * a / RQ.H, 2 * e / RQ.W - 1, 1 - 2 * f / RQ.H);
      gl.useProgram(g.prog);
    } catch (err) { /* lost */ }
  }
  function rqFlush(ctx) { if (RQ.gl && ctx === RQ.ctx) flush(); }
  function rqEnd(ctx) {
    if (ctx !== RQ.ctx) return;
    if (RQ.gl) { flush(); RQ.add = false; RENDER.stats.frames++; }
    RQ.gl = false; RQ.ctx = null; RQ.ov = null; RENDER.active = false;
  }
  function rqOv(ctx) { return (RQ.gl && ctx === RQ.ctx) ? RQ.ov : ctx; }
  function rqActive(ctx) { return RQ.gl && ctx === RQ.ctx; }

  // ---------- 深度 / 中止 / 地形分塊 ----------
  // 物件在 GL 內以「對角線 d」當深度,與地形分塊逐像素的 d 比較:遮擋等同 Canvas 2D 的畫家順序(d 小者先畫、d 相同則物件在後)
  function rqDepthSetup(ctx, dm) {
    if (!(RQ.gl && ctx === RQ.ctx)) return;
    RQ.dm = dm; RQ.dinv = 1 / dm; RQ.zq = 4 * Math.max(0, dm - 3);
    var g = G, gl = g.gl;
    try {
      gl.useProgram(g.prog); gl.uniform1f(g.uDinv, RQ.dinv);
      gl.useProgram(g.tprog); gl.uniform1f(g.tDinv, RQ.dinv);
      gl.useProgram(g.prog);
    } catch (e) { /* lost */ }
  }
  function rqDepth(ctx, d) {
    if (!(RQ.gl && ctx === RQ.ctx)) return;
    d = d | 0;
    var mx = RQ.dm - 3;
    if (d < 0) d = 0; else if (d > mx) d = mx;
    RQ.zq = 4 * d;
  }
  // 本幀放棄 GL(地形分塊尚未烘好等):隱藏 GL / 疊加層,其餘改走 c2d;同幀的 sprite 順便上傳(預熱),下幀再試
  function rqAbort(ctx) {
    if (!(RQ.gl && ctx === RQ.ctx)) return;
    if (G) G.n = 0;
    RQ.gl = false; RQ.ov = ctx; RENDER.active = false; RQ.sweep = true; RQ.add = false;
    RENDER.stats.aborts++;
    setLayers(false);
    if (typeof ART !== 'undefined') ART.bakeBudget = 0;
  }
  function nowMs() { return typeof performance !== 'undefined' ? performance.now() : 0; }

  function terrScratch(T, name) {
    var s = T[name];
    if (!s) { var cv = document.createElement('canvas'); s = T[name] = { cv: cv, cx: cv.getContext('2d') }; }
    return s;
  }
  function terrFree(g, rec) {
    var T = g.terr, gl = g.gl;
    if (T.map[rec.key] === rec) delete T.map[rec.key];
    if (T.cells[rec.k] === rec) delete T.cells[rec.k];
    T.bytes -= rec.bytes; RENDER.stats.terrBytes = T.bytes;
    try { gl.deleteTexture(rec.tex); gl.deleteTexture(rec.dtex); } catch (e) { /* lost */ }
  }
  // 超過上限:LRU 淘汰最久沒畫的塊(本幀用到的不淘汰)
  function terrEvict(g) {
    var T = g.terr, cap = testHooks && testHooks.terrCap ? testHooks.terrCap : TERR_CAP;
    while (T.bytes > cap) {
      var vic = null, k;
      for (k in T.map) { var r = T.map[k]; if (r.last < RQ.frame && (!vic || r.last < vic.last)) vic = r; }
      if (!vic) break;
      terrFree(g, vic);
      RENDER.stats.terrEvict++;
    }
  }
  function terrTex(gl, tex, cv, filter) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  }
  // 烘一塊:p.bake(it, 色圖 ctx, 深度圖 ctx) 回傳水格清單;色圖變換 = res,深度圖變換 = 同一世界矩形縮到 dw × dh
  function terrBakeOne(g, it, p) {
    var T = g.terr, gl = g.gl, sc = terrScratch(T, 'sc'), ds = terrScratch(T, 'ds');
    var t0 = nowMs();
    if (sc.cv.width !== it.cw || sc.cv.height !== it.ch) { sc.cv.width = it.cw; sc.cv.height = it.ch; }
    else { sc.cx.setTransform(1, 0, 0, 1, 0, 0); sc.cx.clearRect(0, 0, it.cw, it.ch); }
    if (ds.cv.width !== it.dw || ds.cv.height !== it.dh) { ds.cv.width = it.dw; ds.cv.height = it.dh; }
    else { ds.cx.setTransform(1, 0, 0, 1, 0, 0); ds.cx.clearRect(0, 0, it.dw, it.dh); }
    var res = it.cw / it.rw, sx = it.dw / it.rw, sy = it.dh / it.rh;
    sc.cx.setTransform(res, 0, 0, res, -it.rx * res, -it.ry * res);
    ds.cx.setTransform(sx, 0, 0, sy, -it.rx * sx, -it.ry * sy);
    var water = p.bake(it, sc.cx, ds.cx) || null;
    sc.cx.setTransform(1, 0, 0, 1, 0, 0); ds.cx.setTransform(1, 0, 0, 1, 0, 0);
    var old = T.map[it.key];
    var rec = { key: it.key, k: it.k, sig: it.sig, tex: gl.createTexture(), dtex: gl.createTexture(), rx: it.rx, ry: it.ry, rw: it.rw, rh: it.rh, d0: it.d0, water: water,
      bytes: (it.cw * it.ch + it.dw * it.dh) * 4, last: RQ.frame };
    terrTex(gl, rec.tex, sc.cv, gl.LINEAR);
    terrTex(gl, rec.dtex, ds.cv, gl.NEAREST);
    if (old) terrFree(g, old);
    T.map[it.key] = rec; T.cells[it.k] = rec; T.bytes += rec.bytes;
    RENDER.stats.bakes++; RENDER.stats.bakeMs += nowMs() - t0; RENDER.stats.terrBytes = T.bytes;
    it.rec = rec;
    return rec;
  }
  // 地形分塊一幀:p = { lvl: 層級字串, items: [{ k, sig, d0, rx, ry, rw, rh, cw, ch, dw, dh, pre }](已依畫家順序排序), tint: [r,g,b], bake: fn, budgetMs? }
  // 回傳 true = 所有必要塊已畫出(p.out = 實際使用的塊記錄);false = 有塊尚未烘好 → 呼叫端應 rqAbort 並整幀走 c2d(烘焙已在本呼叫內分批進行)
  function rqTerrain(ctx, p) {
    if (!(RQ.gl && ctx === RQ.ctx) || !G || !G.terr) return false;
    var g = G, T = g.terr, gl = g.gl, items = p.items, need = [], i, it, rec, ok = true;
    p.out = [];
    for (i = 0; i < items.length; i++) {
      it = items[i]; it.key = it.k + '|' + p.lvl;
      rec = T.map[it.key];
      if (rec && rec.sig === it.sig) { rec.last = RQ.frame; it.rec = rec; continue; }
      it.rec = rec || T.cells[it.k] || null;
      if (it.rec) it.rec.last = RQ.frame;
      need.push(it);
    }
    if (need.length) {
      need.sort(function (a, b) { var ra = a.pre ? 2 : (a.rec ? 1 : 0), rb = b.pre ? 2 : (b.rec ? 1 : 0); return ra - rb; });
      var budget = p.budgetMs !== undefined ? p.budgetMs : (testHooks && testHooks.bakeMs !== undefined ? testHooks.bakeMs : TERR_BAKE_MS), t0 = nowMs(), baked = 0, pre = 0;
      try {
        for (i = 0; i < need.length; i++) {
          it = need[i];
          if (it.pre) { if (pre >= TERR_PREFETCH) continue; pre++; }
          if (baked > 0 && nowMs() - t0 > budget) break;
          terrBakeOne(g, it, p); baked++;
        }
      } catch (e) { RENDER.err = 'terr:' + String(e && e.message || e).slice(0, 60); return false; }
      terrEvict(g);
    }
    for (i = 0; i < items.length; i++) if (!items[i].pre && !items[i].rec) ok = false;
    if (!ok) return false;
    try {
      gl.useProgram(g.tprog);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3);
      gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.tvbo);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
      gl.uniform3f(g.tTint, p.tint[0], p.tint[1], p.tint[2]);
      var vb = g.tv || (g.tv = new Float32Array(16));
      for (i = 0; i < items.length; i++) {
        it = items[i]; rec = it.rec;
        if (it.pre || !rec) continue;
        vb[0] = rec.rx; vb[1] = rec.ry; vb[2] = 0; vb[3] = 0;
        vb[4] = rec.rx + rec.rw; vb[5] = rec.ry; vb[6] = 1; vb[7] = 0;
        vb[8] = rec.rx; vb[9] = rec.ry + rec.rh; vb[10] = 0; vb[11] = 1;
        vb[12] = rec.rx + rec.rw; vb[13] = rec.ry + rec.rh; vb[14] = 1; vb[15] = 1;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rec.tex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rec.dtex);
        gl.uniform1f(g.tBase, rec.d0);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, vb);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        p.out.push(rec);
        RENDER.stats.terrDraws++;
      }
      gl.depthMask(false);
      gl.useProgram(g.prog);
    } catch (e2) { RENDER.err = 'terr-draw:' + String(e2 && e2.message || e2).slice(0, 60); return false; }
    return true;
  }
  function glrTerrainInfo() {
    var T = G && G.terr, n = 0, k;
    if (T) for (k in T.map) n++;
    return { chunks: n, bytes: T ? T.bytes : 0, cap: testHooks && testHooks.terrCap ? testHooks.terrCap : TERR_CAP, bakes: RENDER.stats.bakes, evicts: RENDER.stats.terrEvict, aborts: RENDER.stats.aborts };
  }

  // 光暈(加法混色):rec = 預烘徑向漸層 { cv };回傳 true = 已進 GL 光暈批次;false = 呼叫端改畫 2D
  function rqGlow(ctx, rec, x, y, w, h, a) {
    if (!(RQ.gl && ctx === RQ.ctx)) return false;
    var s = rec.gl;
    if (!s || s.dead) s = upload(G, rec);
    if (!s) return false;
    s.last = RQ.frame;
    if (!RQ.add) { flush(); RQ.add = true; }
    emit(x, y, x + w, y, x + w, y + h, x, y + h, s.u0, s.v0, s.u1, s.v1, packAlpha(a), s.page);
    return true;
  }

  // ---------- 本地狀態(變換 / 全域透明度);c2d 時直接轉給 ctx ----------
  function rqSave(ctx) {
    if (!(RQ.gl && ctx === RQ.ctx)) { ctx.save(); return; }
    var s = RQ.st, o = RQ.sp * 8;
    if (o + 8 > s.length) return;
    s[o] = RQ.ma; s[o + 1] = RQ.mb; s[o + 2] = RQ.mc; s[o + 3] = RQ.md; s[o + 4] = RQ.me; s[o + 5] = RQ.mf; s[o + 6] = RQ.ga; s[o + 7] = RQ.ident ? 1 : 0;
    RQ.sp++;
  }
  function rqRestore(ctx) {
    if (!(RQ.gl && ctx === RQ.ctx)) { ctx.restore(); return; }
    if (RQ.sp <= 0) return;
    RQ.sp--;
    var s = RQ.st, o = RQ.sp * 8;
    RQ.ma = s[o]; RQ.mb = s[o + 1]; RQ.mc = s[o + 2]; RQ.md = s[o + 3]; RQ.me = s[o + 4]; RQ.mf = s[o + 5]; RQ.ga = s[o + 6]; RQ.ident = s[o + 7] === 1;
  }
  function rqAlpha(ctx, a) { if (RQ.gl && ctx === RQ.ctx) RQ.ga = a; else ctx.globalAlpha = a; }
  function rqAlphaMul(ctx, a) { if (RQ.gl && ctx === RQ.ctx) RQ.ga *= a; else ctx.globalAlpha *= a; }
  function rqTransform(ctx, a, b, c, d, e, f) {
    if (!(RQ.gl && ctx === RQ.ctx)) { ctx.transform(a, b, c, d, e, f); return; }
    var ma = RQ.ma, mb = RQ.mb, mc = RQ.mc, md = RQ.md;
    RQ.me = ma * e + mc * f + RQ.me; RQ.mf = mb * e + md * f + RQ.mf;
    RQ.ma = ma * a + mc * b; RQ.mb = mb * a + md * b; RQ.mc = ma * c + mc * d; RQ.md = mb * c + md * d;
    RQ.ident = false;
  }
  function rqTranslate(ctx, x, y) {
    if (!(RQ.gl && ctx === RQ.ctx)) { ctx.translate(x, y); return; }
    RQ.me += RQ.ma * x + RQ.mc * y; RQ.mf += RQ.mb * x + RQ.md * y;
    RQ.ident = false;
  }
  function rqScale(ctx, sx, sy) {
    if (!(RQ.gl && ctx === RQ.ctx)) { ctx.scale(sx, sy); return; }
    RQ.ma *= sx; RQ.mb *= sx; RQ.mc *= sy; RQ.md *= sy;
    RQ.ident = false;
  }
  // 需要在 GL 幀內仍用 2D 指令畫的東西(動畫件):取得已套用「基底 × 本地矩陣 + 透明度」的 2D ctx。layer 0 = 底層(#game),1 = 疊加層。
  // c2d 時回傳原 ctx 不動(原樣呼叫);用完必須呼叫 rqScopeEnd(ctx, 回傳值)
  function rqScope2D(ctx, layer) {
    if (!(RQ.gl && ctx === RQ.ctx)) return ctx;
    var t = layer ? RQ.ov : ctx, a = RQ.va;
    t.save();
    t.setTransform(a * RQ.ma, a * RQ.mb, a * RQ.mc, a * RQ.md, a * RQ.me + RQ.ve, a * RQ.mf + RQ.vf);
    t.globalAlpha = RQ.ga;
    return t;
  }
  function rqScopeEnd(ctx, t) { if (RQ.gl && ctx === RQ.ctx) t.restore(); }

  // ---------- 繪製基本件 ----------
  function xf(x, y, out, k) {
    if (RQ.ident) { out[k] = x; out[k + 1] = y; return; }
    out[k] = RQ.ma * x + RQ.mc * y + RQ.me; out[k + 1] = RQ.mb * x + RQ.md * y + RQ.mf;
  }
  var P8 = new Float64Array(8);

  function rqSprite(ctx, spr, x, y, w, h, alpha) {
    if (RQ.gl && ctx === RQ.ctx) {
      var g = G, s = spr.gl;
      if (!s || s.dead) s = upload(g, spr);
      if (s) {
        s.last = RQ.frame;
        var ga = alpha === undefined ? RQ.ga : RQ.ga * alpha;
        if (RQ.ident) emit(x, y, x + w, y, x + w, y + h, x, y + h, s.u0, s.v0, s.u1, s.v1, packAlpha(ga), s.page);
        else {
          xf(x, y, P8, 0); xf(x + w, y, P8, 2); xf(x + w, y + h, P8, 4); xf(x, y + h, P8, 6);
          emit(P8[0], P8[1], P8[2], P8[3], P8[4], P8[5], P8[6], P8[7], s.u0, s.v0, s.u1, s.v1, packAlpha(ga), s.page);
        }
        return;
      }
      // 未上傳(預算 / 過大 / 失敗):本幀改畫在疊加層(底層 2D 已被 GL 地形蓋住),遮擋順序暫時不準,下一幀即上傳
      RENDER.stats.fallback++;
      var t = rqScope2D(ctx, 1);
      if (alpha !== undefined) t.globalAlpha *= alpha;
      t.drawImage(spr.cv, x, y, w, h);
      rqScopeEnd(ctx, t);
      return;
    }
    if (RQ.sweep && G && !G.lost && ctx === RQ.ctx && (!spr.gl || spr.gl.dead)) upload(G, spr);   // 預熱:c2d 幀順便把 sprite 傳進 atlas
    if (alpha === undefined || alpha === 1) ctx.drawImage(spr.cv, x, y, w, h);
    else { var ga0 = ctx.globalAlpha; ctx.globalAlpha = ga0 * alpha; ctx.drawImage(spr.cv, x, y, w, h); ctx.globalAlpha = ga0; }
  }

  // 任意兩點粗線(水面流線 / 閃光、隱藏建築輪廓):GL 為一個細長四邊形;c2d 分支與 render.js edgeLine 逐指令相同
  function rqLine(ctx, x0, y0, x1, y1, lw, color, alpha) {
    if (RQ.gl && ctx === RQ.ctx) {
      var p = G.pages[0], col = packColor(parseColor(color), RQ.ga * alpha);
      var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L * lw / 2, ny = dx / L * lw / 2;
      var ax = x0 + nx, ay = y0 + ny, bx = x1 + nx, by = y1 + ny, cx = x1 - nx, cy = y1 - ny, ex = x0 - nx, ey = y0 - ny;
      if (RQ.ident) emit(ax, ay, bx, by, cx, cy, ex, ey, p.whiteU, p.whiteV, p.whiteU, p.whiteV, col, 0);
      else {
        xf(ax, ay, P8, 0); xf(bx, by, P8, 2); xf(cx, cy, P8, 4); xf(ex, ey, P8, 6);
        emit(P8[0], P8[1], P8[2], P8[3], P8[4], P8[5], P8[6], P8[7], p.whiteU, p.whiteV, p.whiteU, p.whiteV, col, 0);
      }
      return;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  // 任意四邊形純色(遠景建築色塊)
  function rqPoly4(ctx, x0, y0, x1, y1, x2, y2, x3, y3, color) {
    if (RQ.gl && ctx === RQ.ctx) {
      var p = G.pages[0], col = packColor(parseColor(color), RQ.ga);
      if (RQ.ident) emit(x0, y0, x1, y1, x2, y2, x3, y3, p.whiteU, p.whiteV, p.whiteU, p.whiteV, col, 0);
      else {
        xf(x0, y0, P8, 0); xf(x1, y1, P8, 2); xf(x2, y2, P8, 4); xf(x3, y3, P8, 6);
        emit(P8[0], P8[1], P8[2], P8[3], P8[4], P8[5], P8[6], P8[7], p.whiteU, p.whiteV, p.whiteU, p.whiteV, col, 0);
      }
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // 軸對齊矩形;alpha 選用(乘上目前透明度)
  function rqRect(ctx, x, y, w, h, color, alpha) {
    if (RQ.gl && ctx === RQ.ctx) {
      var p = G.pages[0], col = packColor(parseColor(color), alpha === undefined ? RQ.ga : RQ.ga * alpha);
      if (RQ.ident) emit(x, y, x + w, y, x + w, y + h, x, y + h, p.whiteU, p.whiteV, p.whiteU, p.whiteV, col, 0);
      else {
        xf(x, y, P8, 0); xf(x + w, y, P8, 2); xf(x + w, y + h, P8, 4); xf(x, y + h, P8, 6);
        emit(P8[0], P8[1], P8[2], P8[3], P8[4], P8[5], P8[6], P8[7], p.whiteU, p.whiteV, p.whiteU, p.whiteV, col, 0);
      }
      return;
    }
    if (alpha === undefined || alpha === 1) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
    else { var ga0 = ctx.globalAlpha; ctx.globalAlpha = ga0 * alpha; ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.globalAlpha = ga0; }
  }

  // 軸對齊橢圓 / 圓(居民占位小人與色點);rx === ry 時 c2d 用 arc,否則 ellipse(與原呼叫一致)
  function rqDisc(ctx, cx, cy, rx, ry, color) {
    if (RQ.gl && ctx === RQ.ctx) {
      var p = G.pages[0], col = packColor(parseColor(color), RQ.ga), k = DISC / 31, hx = rx * k, hy = ry * k;
      var x0 = cx - hx, y0 = cy - hy, x1 = cx + hx, y1 = cy + hy;
      if (RQ.ident) emit(x0, y0, x1, y0, x1, y1, x0, y1, p.discU0, p.discV0, p.discU1, p.discV1, col, 0);
      else {
        xf(x0, y0, P8, 0); xf(x1, y0, P8, 2); xf(x1, y1, P8, 4); xf(x0, y1, P8, 6);
        emit(P8[0], P8[1], P8[2], P8[3], P8[4], P8[5], P8[6], P8[7], p.discU0, p.discV0, p.discU1, p.discV1, col, 0);
      }
      return;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    if (rx === ry) ctx.arc(cx, cy, rx, 0, Math.PI * 2);
    else ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- 對外 ----------
  function glrStats() { return { status: RENDER.status, active: RENDER.active, backend: RENDER.backend, reason: RENDER.reason, pages: G ? G.pages.length : 0, pageSize: G ? G.pageSize : 0, ver: G ? G.ver : 0, stats: RENDER.stats }; }
  function glrTestInit(hooks) { testHooks = hooks || null; }
  function glrTestState() { return { G: G, RQ: RQ }; }
  function glrTestReset() { G = null; RQ.base = null; RQ.shown = false; RENDER.status = 'off'; RENDER.lostCount = 0; RENDER.notified = false; RENDER.reason = ''; RENDER.stats = { frames: 0, quads: 0, draws: 0, uploads: 0, uploadPx: 0, fallback: 0, pages: 0, resets: 0, lastMs: 0, aborts: 0, bakes: 0, bakeMs: 0, terrDraws: 0, terrBytes: 0, terrEvict: 0 }; }

  // 掛到全域(classic script 內以函式宣告無法跨 IIFE,故明確指派;vm 測試與瀏覽器皆適用)
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  root.rqBegin = rqBegin; root.rqView = rqView; root.rqFlush = rqFlush; root.rqEnd = rqEnd; root.rqOv = rqOv; root.rqActive = rqActive;
  root.rqSave = rqSave; root.rqRestore = rqRestore; root.rqAlpha = rqAlpha; root.rqAlphaMul = rqAlphaMul;
  root.rqTransform = rqTransform; root.rqTranslate = rqTranslate; root.rqScale = rqScale;
  root.rqScope2D = rqScope2D; root.rqScopeEnd = rqScopeEnd;
  root.rqDepthSetup = rqDepthSetup; root.rqDepth = rqDepth; root.rqAbort = rqAbort; root.rqTerrain = rqTerrain; root.rqLine = rqLine; root.rqGlow = rqGlow; root.glrTerrainInfo = glrTerrainInfo;
  root.rqSprite = rqSprite; root.rqPoly4 = rqPoly4; root.rqRect = rqRect; root.rqDisc = rqDisc;
  root.renderSetBackend = renderSetBackend; root.renderGetBackend = renderGetBackend; root.renderGlUsable = renderGlUsable;
  root.glrRelease = glrRelease; root.glrStats = glrStats; root.glrDetect = glrDetect;
  root.glrTestInit = glrTestInit; root.glrTestState = glrTestState; root.glrTestReset = glrTestReset;
  root.glrOnLost = glrOnLost; root.glrOnRestored = glrOnRestored;
})();
