// savesui.js — 存檔管理面板(20 槽清單 + 復原點)與設定頁「存檔與重新開始」區塊的節點。邏輯在 saveslots.js。
// 面板走 panelmgr.js(panelRegister / panelOpen kind:'big');沒有 panelmgr 時自管顯示 / 關閉。ES2017,載入時只宣告。

var svEl = null, svListEl = null, svInfoEl = null, svMsgEl = null, svBusy = false, svOpen = false;

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
    '#svPanel.busy .svlist{pointer-events:none;opacity:.6}';
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
  el.setAttribute('aria-label', '存檔管理');
  var h = svNode('div', 'svh');
  h.appendChild(svNode('b', '', '存檔管理'));
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
  var s = [savesTimeText(m.ts)];
  if (m.lv) s.push('Lv' + m.lv);
  s.push('人口 ' + m.pop);
  s.push('科技 ' + m.techN);
  s.push(m.kb + ' KB' + (m.enc === 'raw' ? '(未壓縮)' : ''));
  return s.join(' · ');
}

function svRow(id, m) {
  var row = svNode('div', 'svrow' + (m ? '' : ' empty')), t = svNode('div', 'svt'), b = svNode('div', 'svb');
  t.appendChild(svNode('span', 'svn', typeof id === 'number' ? '#' + id : (id === 'undo1' ? '復原 1' : '復原 2')));
  t.appendChild(svNode('span', 'svnm', m ? m.name : '空'));
  row.appendChild(t);
  if (m) row.appendChild(svNode('div', 'svs', svStats(m)));
  if (typeof id === 'number') {
    b.appendChild(svBtn('存', function () { svDoSave(id); }));
    if (m) {
      b.appendChild(svBtn('讀', function () { svDoLoad(id); }));
      b.appendChild(svBtn('改名', function () { svDoRename(id, m); }));
      b.appendChild(svBtn('刪', function () { svDoDelete(id); }, 'danger'));
    }
  } else if (m) {
    b.appendChild(svBtn('還原到此', function () { svDoLoad(id); }));
  }
  row.appendChild(b);
  return row;
}

async function svRender() {
  var list, u, mb;
  if (!svListEl) return;
  svListEl.innerHTML = '';
  if (!savesAvailable()) {
    svInfoEl.textContent = '此裝置無法使用多存檔(瀏覽器未提供儲存空間,可能是隱私模式)。遊戲本身的自動存檔不受影響。';
    return;
  }
  try { list = await savesListMeta(); u = await savesUsage(); } catch (e) {
    svInfoEl.textContent = '此裝置無法使用多存檔(讀取失敗)。遊戲本身的自動存檔不受影響。';
    return;
  }
  mb = Math.round(u.totalKb / 102.4) / 10;
  svInfoEl.textContent = '已用 ' + u.slotsUsed + ' / ' + SAVE_SLOT_COUNT + ' 槽 · 多存檔共 ' + u.totalKb + ' KB' +
    (u.hasEstimate ? ' · 瀏覽器儲存 ' + Math.round(u.usage / 1048576 * 10) / 10 + ' / ' + Math.round(u.quota / 1048576) + ' MB' : '') + ' · 此裝置可存 ' + u.canSlots + ' 槽';
  var i;
  for (i = 1; i <= SAVE_SLOT_COUNT; i++) svListEl.appendChild(svRow(i, list[i]));
  svListEl.appendChild(svNode('div', 'svsec', '復原點(重大操作前自動備份,最近 2 份)'));
  SAVE_UNDO_IDS.forEach(function (id) { svListEl.appendChild(svRow(id, list[id])); });
  void mb;
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

function svDoSave(id) {
  return svWrap(async function () {
    var r = await savesSave(id, { confirm: svConfirm, name: '' });
    if (r.ok) svSay('已存入第 ' + id + ' 槽');
    else if (r.reason === 'write') svSay('寫入失敗,第 ' + id + ' 槽維持原內容');
    else if (r.reason === 'declined') svSay('已取消');
    else svSay('無法存檔');
  });
}

function svDoLoad(id) {
  var m = savesMetaCache[id];
  if (!m) return;
  if (!svConfirm('讀取' + (typeof id === 'number' ? '第 ' + id + ' 槽' : '復原點') + '「' + m.name + '」?\n(' + savesTimeText(m.ts) + ')\n\n目前進度會先自動備份到復原點,可從「復原」找回;讀檔後頁面會重新載入。')) return;
  return svWrap(async function () {
    var r = await savesLoad(id);
    if (r.ok) svSay('讀取中…');
    else if (r.reason === 'newer') svSay('此存檔來自較新版本,請先更新 App');
    else if (r.reason === 'nobackup') svSay('無法建立復原點,未讀檔');
    else svSay('讀檔失敗(' + r.reason + ')');
  });
}

function svDoRename(id, m) {
  var nm = typeof prompt === 'function' ? prompt('第 ' + id + ' 槽新名稱', m.name) : null;
  if (nm === null) return;
  return svWrap(async function () {
    var r = await savesRename(id, nm);
    svSay(r.ok ? '已改名' : '名稱不可為空');
  });
}

function svDoDelete(id) {
  return svWrap(async function () {
    var r = await savesDelete(id, { confirm: svConfirm });
    svSay(r.ok ? '已刪除第 ' + id + ' 槽' : '已取消');
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

// 設定頁「復原上一步」:讀 undo1 的摘要、確認後還原(讀檔流程會先把目前狀態再備份)
async function savesUiUndo() {
  var list, m;
  if (!savesAvailable()) { savesToast('此裝置無法使用多存檔,沒有復原點'); return; }
  try { list = await savesListMeta(); } catch (e) { savesToast('讀取復原點失敗'); return; }
  m = list.undo1;
  if (!m) { savesToast('目前沒有可復原的備份'); return; }
  if (!svConfirm('復原到「' + m.name + '」?\n(' + savesTimeText(m.ts) + ' · 人口 ' + m.pop + ')\n\n目前狀態會先備份,可再復原回來;完成後頁面會重新載入。')) return;
  var r = await savesLoad('undo1');
  if (!r.ok && r.reason === 'nobackup') savesToast('無法建立復原點,未復原');
}
