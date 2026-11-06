// js/installtip.js — 加到主畫面提示卡:進入遊戲約 90 秒後,且非戰鬥 / 非放置 / 沒有大面板或對話框時才出現(否則每 15 秒再試,最多約 30 分鐘)。
// Android Chrome:beforeinstallprompt 事件,卡上「安裝」鈕;iPhone Safari 沒有該事件,顯示「分享 → 加入主畫面」圖文步驟。
// 偏好 lorddomain.ui.installTip = JSON {n:已顯示次數(上限 2), off:1 = 按過「不再提醒」或已安裝}。以主畫面 app 執行(standalone)時完全不顯示。
// 不遮擋操作:只佔底部一條窄卡,可按 ✕ 關閉。ES2017;全部 try/catch 包住存取 localStorage。
(function () {
  'use strict';

  var KEY = 'lorddomain.ui.installTip';
  var MAX_SHOW = 2;
  var FIRST_MS = 90000;
  var RETRY_MS = 15000;
  var MAX_TRIES = 120;

  var deferred = null;     // beforeinstallprompt 事件(Android)
  var card = null;
  var shownThisLoad = false;
  var tries = 0;

  function readPref() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && typeof v === 'object') return { n: Math.max(0, Math.min(MAX_SHOW, +v.n || 0)), off: v.off ? 1 : 0 };
    } catch (e) {
      console.warn('[itp] pref read failed', e);
    }
    return { n: 0, off: 0 };
  }
  function writePref(p) {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch (e) {
      console.warn('[itp] pref write failed', e);
    }
  }

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e) { /* 略過 */ }
    return window.navigator.standalone === true;
  }

  function isIOSSafari() {
    var ua = navigator.userAgent || '';
    var ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
  }

  // 目前能提供的加入方式:'android'(有 deferred 事件)、'ios'(Safari 圖文)、'' (都沒有,不顯示)
  function platformKind() {
    if (deferred) return 'android';
    if (isIOSSafari()) return 'ios';
    return '';
  }

  // 戰鬥、放置、布置、面板、對話框、設定頁、既有的加到主畫面小提示(fsTip)開著時都不打擾
  function busy() {
    var b = document.body;
    if (!b || document.hidden) return true;
    if (typeof game !== 'undefined' && game && game.mode !== 'estate') return true;
    if (['sandbox', 'atk-mode', 'replay-mode', 'camp-mode', 'photo-mode', 'shooting'].some(function (c) { return b.classList.contains(c); })) return true;
    if (typeof ui !== 'undefined' && ui && (ui.tool !== null || ui.editing)) return true;
    if (typeof draft !== 'undefined' && draft) return true;
    if (typeof pend !== 'undefined' && pend && pend.list && pend.list.length) return true;
    if (typeof panelKindOpen === 'function' && (panelKindOpen('big') || panelKindOpen('card'))) return true;
    if (typeof ldAnyOpen === 'function' && ldAnyOpen()) return true;
    if (['leaveDlg', 'settleDlg'].some(function (id) { const e = document.getElementById(id); return !!e && !e.hidden; })) return true;
    if (typeof stIsOpen !== 'undefined' && stIsOpen) return true;
    if (document.getElementById('fsTip')) return true;
    return false;
  }

  function hide() {
    if (card) {
      card.remove();
      card = null;
    }
  }

  function markOff() {
    var p = readPref();
    p.off = 1;
    writePref(p);
  }

  function btn(text, label, cls, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.setAttribute('aria-label', label);
    if (cls) b.className = cls;
    b.addEventListener('click', onClick);
    return b;
  }

  function install() {
    var ev = deferred;
    deferred = null;
    if (!ev) {
      hide();
      return;
    }
    try {
      ev.prompt();
      Promise.resolve(ev.userChoice).then(function (c) {
        if (c && c.outcome === 'accepted') markOff();
        hide();
      }).catch(function () { hide(); });
    } catch (e) {
      console.warn('[itp] prompt failed', e);
      hide();
    }
  }

  function neverAgain() {
    markOff();
    hide();
  }

  function show(kind, p) {
    shownThisLoad = true;
    p.n += 1;
    writePref(p);
    card = document.createElement('div');
    card.id = 'installTip';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', '加到主畫面');

    var head = document.createElement('div');
    head.className = 'itp-head';
    var title = document.createElement('b');
    title.textContent = '要把城主領地放到主畫面嗎?';
    head.appendChild(title);
    head.appendChild(btn('✕', '關閉提示', 'itp-x', hide));
    card.appendChild(head);

    var body = document.createElement('div');
    body.className = 'itp-body';
    if (kind === 'android') {
      body.textContent = '加到主畫面後從圖示開啟,畫面更大,不用再找網址。';
    } else {
      body.textContent = '加到主畫面後從圖示開啟,畫面更大。做法:';
      var ol = document.createElement('ol');
      ['點 Safari 下方的「分享」鈕(方框加箭頭的圖示)', '往下滑,點「加入主畫面」', '右上角按「加入」'].forEach(function (s) {
        var li = document.createElement('li');
        li.textContent = s;
        ol.appendChild(li);
      });
      body.appendChild(ol);
    }
    card.appendChild(body);

    var row = document.createElement('div');
    row.className = 'itp-row';
    if (kind === 'android') row.appendChild(btn('安裝', '安裝到主畫面', 'itp-ok', install));
    row.appendChild(btn('不再提醒', '以後不再顯示加到主畫面的提示', 'itp-no', neverAgain));
    card.appendChild(row);

    document.body.appendChild(card);
  }

  function tryShow() {
    if (card || shownThisLoad) return;
    tries++;
    var p = readPref();
    if (p.off || p.n >= MAX_SHOW || isStandalone()) return;
    var kind = platformKind();
    if (!kind) {
      schedule();
      return;
    }
    if (busy()) {
      schedule();
      return;
    }
    show(kind, p);
  }

  function schedule() {
    if (tries < MAX_TRIES) setTimeout(tryShow, RETRY_MS);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    markOff();
    hide();
  });

  function start() {
    if (isStandalone()) return;
    var p = readPref();
    if (p.off || p.n >= MAX_SHOW) return;
    setTimeout(tryShow, FIRST_MS);
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
