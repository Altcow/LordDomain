// savesui.js — 世界管理面板「我的世界(N)」(每世界:進入 / 重新開始 / 改名 / 刪除 + 回溯點)、頂列世界小標籤、設定頁「世界與重新開始」用的函式。邏輯在 saveslots.js。
// 面板走 panelmgr.js(panelRegister / panelOpen kind:'big');沒有 panelmgr 時自管顯示 / 關閉。ES2017,載入時只宣告。

var svEl = null, svListEl = null, svInfoEl = null, svMsgEl = null, svBusy = false, svOpen = false, svRbOpen = {};

function svCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('svCss')) return;
  var st = document.createElement('style');
  st.id = 'svCss';
  st.textContent =
    '#svPanel{position:fixed;left:0;top:0;right:0;bottom:0;z-index:41;display:flex;flex-direction:column;background:#1b222d;color:#f3ead7;font-size:14px;box-sizing:border-box;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}' +
    '#svPanel[hidden]{display:none}' +
    '#svPanel .svh{display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.15);flex:0 0 auto}' +
    '#svPanel .svh b{flex:1;min-width:0;font-size:17px}' +
    '#svPanel .svx{flex:0 0 auto;min-width:44px;min-height:44px;font-size:20px}' +
    '#svPanel .svinfo{padding:8px 16px;font-size:13px;opacity:.85;flex:0 0 auto;word-break:break-all}' +
    '#svPanel .svmsg{padding:0 16px 6px;font-size:13px;color:#f0b45a;flex:0 0 auto;min-height:1.2em}' +
    '#svPanel .svlist{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:0 16px 16px;-webkit-overflow-scrolling:touch}' +
    '#svPanel .svrow{margin:8px 0;padding:8px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(255,255,255,.05);min-width:0}' +
    '#svPanel .svrow.empty{opacity:.75}' +
    '#svPanel .svt{display:flex;gap:8px;align-items:baseline;min-width:0}' +
    '#svPanel .svn{flex:0 0 auto;font-weight:bold;color:#f0b45a}' +
    '#svPanel .svnm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#svPanel .svs{margin:2px 0 6px;font-size:12px;opacity:.8;word-break:break-all}' +
    '#svPanel .svb{display:flex;gap:6px}' +
    '#svPanel .svb button{flex:1 1 0;min-width:0;min-height:44px;padding:0 4px}' +
    '#svPanel .svb button.danger{background:#6b2b2b;border-color:#c96a5f}' +
    '#svPanel .svsec{margin:14px 0 2px;font-size:13px;opacity:.75;font-weight:bold}' +
    '#svPanel .svrow.active{border-color:#f0b45a;background:rgba(240,180,90,.12)}' +
    '#svPanel .svbadge{flex:0 0 auto;font-size:11px;padding:1px 6px;border-radius:8px;background:#f0b45a;color:#1b222d}' +
    '#svPanel .svb{flex-wrap:wrap}' +
    '#svPanel .svb button{flex:1 1 72px}' +
    '#svPanel .svb button:disabled{opacity:.6}' +
    '#svPanel .svtog{width:100%;margin-top:6px;min-height:36px;text-align:left}' +
    '#svPanel .svrbs{margin-top:6px;min-width:0}' +
    '#svPanel .svrb{margin:6px 0 0;padding:6px;border-left:3px solid rgba(240,180,90,.5);background:rgba(0,0,0,.18);min-width:0}' +
    '#svPanel .svrb.empty{opacity:.7}' +
    '#svPanel .svrbt{display:flex;gap:8px;align-items:baseline;min-width:0}' +
    '#svPanel.busy .svlist{pointer-events:none;opacity:.6}' +
    '#svPanel .svpk{display:flex;align-items:center;gap:6px;margin:2px 0;font-size:12px;opacity:.9;min-width:0}' +
    '#svPanel .svflag{flex:0 0 auto;width:24px;height:16px}' +
    '#svPanel .svpkn{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#worldTag{flex:0 0 auto;box-sizing:border-box;max-width:3.6em;overflow:hidden;white-space:nowrap;font-size:10px;line-height:1;padding:3px 4px;border:1px solid rgba(255,255,255,.28);border-radius:6px;opacity:.8;cursor:pointer;color:#f0e6cf}' +
    '#worldTag[hidden]{display:none}' +
    'body.sandbox #worldTag,body.atk-mode #worldTag,body.replay-mode #worldTag{display:none}';
  document.head.appendChild(st);
}

function svNode(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function svBtn(label, fn, cls) {
  var b = svNode('button', cls || '', label);
  b.addEventListener('click', fn);
  return b;
}

function svHide() {
  if (svEl) svEl.hidden = true;
  svOpen = false;
}

function svClose() {
  if (typeof panelClose === 'function' && typeof panelIsOpen === 'function' && panelIsOpen('saves')) { panelClose('saves'); return; }
  svHide();
}

function svEnsure() {
  if (svEl) return svEl;
  if (typeof document === 'undefined' || !document.body) return null;
  svCss();
  var el = svNode('div', '');
  el.id = 'svPanel';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '我的世界');
  var h = svNode('div', 'svh');
  h.appendChild(svNode('b', '', '我的世界(' + WORLD_COUNT + ')'));
  var x = svBtn('✕', svClose, 'svx');
  x.setAttribute('aria-label', '關閉');
  h.appendChild(x);
  svInfoEl = svNode('div', 'svinfo', '');
  svMsgEl = svNode('div', 'svmsg', '');
  svListEl = svNode('div', 'svlist');
  el.appendChild(h);
  el.appendChild(svInfoEl);
  el.appendChild(svMsgEl);
  el.appendChild(svListEl);
  document.body.appendChild(el);
  svEl = el;
  if (typeof panelRegister === 'function') panelRegister('saves', { kind: 'big', el: el, onClose: function () { svOpen = false; } });
  return el;
}

function svSay(msg) { if (svMsgEl) svMsgEl.textContent = msg || ''; }

function svStats(m) {
  var s = [];
  if (m.lv) s.push('Lv' + m.lv);
  s.push('人口 ' + m.pop);
  s.push('科技 ' + m.techN);
  if (m.kb) s.push(m.kb + ' KB' + (m.enc === 'raw' ? '(未壓縮)' : ''));
  return s.join(' · ');
}

function svAway(ts) {
  var sec = Math.max(0, (Date.now() - ts) / 1000);
  return sec < 60 ? '剛離開' : '離開 ' + savesAwayText(sec);
}

function svRbRow(n, k, m, isActive) {
  var row = svNode('div', 'svrb' + (m ? '' : ' empty')), t = svNode('div', 'svrbt'), b = svNode('div', 'svb');
  t.appendChild(svNode('span', 'svn', '回溯點 ' + k));
  t.appendChild(svNode('span', 'svnm', m ? m.name : '空'));
  row.appendChild(t);
  if (m) row.appendChild(svNode('div', 'svs', savesTimeText(m.ts) + ' · ' + svStats(m)));
  b.appendChild(svBtn(m ? '覆蓋' : '建立', function () { svDoRbSave(n, k, m); }));
  if (m) {
    b.appendChild(svBtn('回到此點', function () { svDoRbRestore(n, k, m, isActive); }));
    b.appendChild(svBtn('改名', function () { svDoRbRename(n, k, m); }));
    b.appendChild(svBtn('刪除', function () { svDoRbDelete(n, k); }, 'danger'));
  }
  row.appendChild(b);
  return row;
}

// 世界風格小列:小旗 + 風格名稱(使用中世界看目前城市風格,其餘看 worlds.v1 的 packs;舊世界無欄位 = 漢)
function svPackLine(n, isActive, w) {
  var id = (isActive && typeof themeGet === 'function') ? themeGet() : (typeof worldsPackOf === 'function' ? worldsPackOf(n, w) : 'han'), line = svNode('div', 'svpk'), cv, p;
  if (typeof worldPackGet !== 'function') { line.hidden = true; return line; }
  p = worldPackGet(id);
  cv = svNode('canvas', 'svflag');
  cv.setAttribute('aria-hidden', 'true');
  try { if (typeof flagDraw === 'function') flagDraw(cv, p.id, 24, 16); } catch (e) { /* 略過 */ }
  line.appendChild(cv);
  line.appendChild(svNode('span', 'svpkn', '風格:' + p.name));
  return line;
}

// 一個世界一列:標題 = 平行世界 NN · 名稱;進入 / 重新開始 / 改名 / 刪除;可展開回溯點
function svRow(n, m, w, list, live) {
  var isActive = w.active === n, name = w.names[n] || '', row = svNode('div', 'svrow' + (isActive ? ' active' : '') + (m || isActive ? '' : ' empty')), t = svNode('div', 'svt'), b = svNode('div', 'svb'), i, box, cur, open;
  t.appendChild(svNode('span', 'svn', worldLabel(n)));
  t.appendChild(svNode('span', 'svnm', name || (m || isActive ? '' : '空世界')));
  if (isActive) t.appendChild(svNode('span', 'svbadge', '使用中'));
  row.appendChild(t);
  if (m || isActive) row.appendChild(svPackLine(n, isActive, w));
  if (isActive) row.appendChild(svNode('div', 'svs', '目前世界 · ' + svStats(live)));
  else if (m) row.appendChild(svNode('div', 'svs', svAway(w.lastActive[n] || m.ts) + ' · ' + svStats(m)));
  else row.appendChild(svNode('div', 'svs', '空世界:進入後從頭開始'));
  if (isActive) { cur = svBtn('目前世界', function () {}); cur.disabled = true; b.appendChild(cur); }
  else if (m) b.appendChild(svBtn('進入', function () { svDoEnter(n, m); }));
  else b.appendChild(svBtn('建立新世界', function () { svDoCreate(n); }));
  if (m || isActive) b.appendChild(svBtn('重新開始', function () { svDoRestart(n); }, 'danger'));
  b.appendChild(svBtn('改名', function () { svDoRename(n, name); }));
  if (m && !isActive) b.appendChild(svBtn('刪除', function () { svDoRemove(n, 'delete'); }, 'danger'));
  row.appendChild(b);
  if (m || isActive) {
    open = !!svRbOpen[n];
    row.appendChild(svBtn((open ? '▾ ' : '▸ ') + '回溯點(' + SNAPSHOTS_PER_WORLD + ')', function () { svRbOpen[n] = !svRbOpen[n]; svRender(); }, 'svtog'));
    if (open) {
      box = svNode('div', 'svrbs');
      for (i = 1; i <= SNAPSHOTS_PER_WORLD; i++) box.appendChild(svRbRow(n, i, list[savesRbId(n, i)], isActive));
      row.appendChild(box);
    }
  }
  return row;
}

function svUndoRow(id, m) {
  var row = svNode('div', 'svrow' + (m ? '' : ' empty')), t = svNode('div', 'svt');
  t.appendChild(svNode('span', 'svn', id === 'undo1' ? '復原 1' : '復原 2'));
  t.appendChild(svNode('span', 'svnm', m ? m.name : '空'));
  row.appendChild(t);
  if (m) row.appendChild(svNode('div', 'svs', svStats(m) + (m.wid ? ' · ' + worldLabel(m.wid) : '')));
  return row;
}

async function svRender() {
  var list, u, w, i, live, snap;
  if (!svListEl) return;
  svListEl.innerHTML = '';
  if (!savesAvailable()) {
    svInfoEl.textContent = '此裝置無法多世界(瀏覽器未提供儲存空間,可能是隱私模式)。目前世界照常可玩,自動儲存不受影響。';
    return;
  }
  try { list = await savesListMeta(); u = await savesUsage(); } catch (e) {
    svInfoEl.textContent = '此裝置無法多世界(讀取失敗)。目前世界照常可玩,自動儲存不受影響。';
    return;
  }
  w = worldsGet();
  if (typeof worldsPackNote === 'function' && worldsPackNote(w, w.active)) worldsPut(w);
  savesFlush();
  snap = savesCapture();
  live = savesSummarize(snap, savesLivePop());
  svInfoEl.textContent = '每個世界各自獨立、資源不互通;切走的世界不會運作,切回時會補算離開期間的離線進度。 多世界共用 ' + u.totalKb + ' KB' +
    (u.hasEstimate ? ' · 瀏覽器儲存 ' + Math.round(u.usage / 1048576 * 10) / 10 + ' / ' + Math.round(u.quota / 1048576) + ' MB' : '') + '。';
  for (i = 1; i <= WORLD_COUNT; i++) svListEl.appendChild(svRow(i, list[i], w, list, live));
  svListEl.appendChild(svNode('div', 'svsec', '復原點(重新開始 / 刪除 / 切換前自動備份,最近 2 份;用設定的「復原上一步」救回)'));
  SAVE_UNDO_IDS.forEach(function (id) { svListEl.appendChild(svUndoRow(id, list[id])); });
}

async function svWrap(fn) {
  if (svBusy) return;
  svBusy = true;
  if (svEl) svEl.classList.add('busy');
  try { await fn(); } catch (e) { svSay('操作失敗'); }
  svBusy = false;
  if (svEl) svEl.classList.remove('busy');
  if (svOpen) await svRender();
}

function svConfirm(msg) { return typeof confirm === 'function' ? confirm(msg) : false; }

function svReasonText(r) {
  var t = { busy: '另一個分頁正在操作世界', write: '寫入失敗,未變更', nobackup: '無法建立復原點,未執行', mismatch: '內容的世界編號不符,已拒絕', newer: '內容來自較新版本,請先更新 App', corrupt: '內容損毀', idb: '儲存空間無法使用', unavailable: '此裝置無法多世界', active: '使用中的世界不能刪除', declined: '已取消', empty: '空世界' };
  return t[r] || ('失敗(' + r + ')');
}

function svDoEnter(n, m) {
  var w = worldsGet();
  if (!svConfirm('進入 ' + worldTitle(n, w.names[n]) + (m ? '' : '(新世界)') + '?\n\n目前的 ' + worldTitle(w.active, w.names[w.active]) + ' 會先存回它自己的位置(不會被覆蓋或倒轉),並備份到復原點。' + (m ? '\n離開期間會補算離線進度。' : '\n新世界會從頭開始。') + '\n進入後頁面會重新載入。')) return;
  return svWrap(async function () {
    var r = await worldsEnter(n);
    svSay(r.ok ? '切換中…' : svReasonText(r.reason));
  });
}

// 建立新世界 / 重新開始:開風格精靈(js/worldwizard.js);沒有精靈時退回原本流程
function svDoCreate(n) {
  if (typeof worldWizardOpen === 'function' && worldWizardOpen({ kind: 'create', n: n, from: 'saves' })) return;
  return svDoEnter(n, null);
}

function svDoRestart(n) {
  if (typeof worldWizardOpen === 'function' && worldWizardOpen({ kind: 'restart', n: n, from: 'saves' })) return;
  return svDoRemove(n, 'restart');
}

function svDoRemove(n, kind) {
  return svWrap(async function () {
    var r = await worldsRemove(n, kind, { confirm: svConfirm });
    if (r.ok) svSay(kind === 'delete' ? '已刪除 ' + worldLabel(n) + '(可從「復原上一步」救回)' : (n === worldsGet().active ? '重新開始中…' : '已重新開始 ' + worldLabel(n) + '(可從「復原上一步」救回)'));
    else svSay(svReasonText(r.reason));
  });
}

function svDoRename(n, cur) {
  var nm = typeof prompt === 'function' ? prompt(worldLabel(n) + ' 的新名稱', cur || '') : null;
  if (nm === null) return;
  return svWrap(async function () {
    var r = await worldsRename(n, nm);
    svSay(r.ok ? '已改名' : '名稱不可為空');
    svTagSync();
  });
}

function svDoRbSave(n, k) {
  return svWrap(async function () {
    var r = await worldsRbSave(n, k, { confirm: svConfirm });
    svSay(r.ok ? '已建立 ' + worldLabel(n) + ' 的回溯點 ' + k : svReasonText(r.reason));
  });
}

function svDoRbRestore(n, k, m, isActive) {
  if (!svConfirm('回到 ' + worldLabel(n) + ' 的回溯點 ' + k + '「' + m.name + '」?\n(' + savesTimeText(m.ts) + ')\n\n只倒轉這個世界,不影響其他世界;目前狀態會先備份到復原點。回到之後不會補發離線進度。' + (isActive ? '\n完成後頁面會重新載入。' : ''))) return;
  return svWrap(async function () {
    var r = await worldsRbRestore(n, k);
    svSay(r.ok ? (isActive ? '回溯中…' : '已回到回溯點(進入該世界即可看到)') : svReasonText(r.reason));
  });
}

function svDoRbRename(n, k, m) {
  var nm = typeof prompt === 'function' ? prompt('回溯點 ' + k + ' 新名稱', m.name) : null;
  if (nm === null) return;
  return svWrap(async function () {
    var r = await savesRename(savesRbId(n, k), nm);
    svSay(r.ok ? '已改名' : '名稱不可為空');
  });
}

function svDoRbDelete(n, k) {
  if (!svConfirm('刪除 ' + worldLabel(n) + ' 的回溯點 ' + k + '?刪除後無法復原。')) return;
  return svWrap(async function () {
    var r = await worldsRbDelete(n, k);
    svSay(r.ok ? '已刪除回溯點 ' + k : svReasonText(r.reason));
  });
}

function savesUiOpen() {
  var el = svEnsure();
  if (!el) return false;
  svOpen = true;
  svSay('');
  if (typeof panelOpen === 'function' && typeof panelRegister === 'function') panelOpen('saves', { kind: 'big' });
  el.hidden = false;
  svRender();
  return true;
}

// 設定頁「復原上一步」:讀 undo1 的摘要、確認後救回(套回目前世界時,目前狀態會先再備份,可來回)
async function savesUiUndo() {
  var list, m, r;
  if (!savesAvailable()) { savesToast('此裝置無法多世界,沒有復原點'); return; }
  try { list = await savesListMeta(); } catch (e) { savesToast('讀取復原點失敗'); return; }
  m = list.undo1;
  if (!m) { savesToast('目前沒有可復原的備份'); return; }
  if (!svConfirm('復原到「' + m.name + '」?\n(' + savesTimeText(m.ts) + ' · 人口 ' + m.pop + (m.wid ? ' · ' + worldLabel(m.wid) : '') + ')\n\n目前狀態會先備份,可再復原回來。' + (m.wid && m.wid !== worldsActive() ? '這份屬於其他世界,會救回到它自己的位置,不會動到目前世界。' : '完成後頁面會重新載入。'))) return;
  r = await savesUndo();
  if (!r.ok) savesToast(svReasonText(r.reason));
}

// ───────── 頂列世界小標籤(「世 07」) ─────────
function svTagSync() {
  if (typeof document === 'undefined' || !document.getElementById) return null;
  var bar = document.getElementById('topbar'), tag = document.getElementById('worldTag'), w = worldsGet(), after;
  if (!bar) return null;
  svCss();
  if (!tag) {
    tag = svNode('span', '', '');
    tag.id = 'worldTag';
    tag.setAttribute('role', 'button');
    tag.addEventListener('click', function () { savesUiOpen(); });
    after = document.getElementById('title');
    if (after && after.nextSibling) bar.insertBefore(tag, after.nextSibling); else bar.appendChild(tag);
  }
  tag.textContent = worldTagText(w.active);
  tag.title = worldTitle(w.active, w.names[w.active]) + '(點一下開啟我的世界)';
  tag.setAttribute('aria-label', tag.title);
  tag.hidden = !worldTagOn();
  return tag;
}
if (typeof document !== 'undefined' && document.addEventListener) {
  if (document.readyState !== 'loading') { try { svTagSync(); } catch (e) { /* 略過 */ } }
  else document.addEventListener('DOMContentLoaded', function () { try { svTagSync(); } catch (e) { /* 略過 */ } });
}
