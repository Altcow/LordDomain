// worldwizard.js — 「建立新世界 / 重新開始」精靈面板:選世界風格 → 即時預覽(旗幟、副標、簡介、代表建築、代表人物、特色)→ 取名、選起手範本 → 確認(沿用 saveslots 的先備份流程)。
// 資料在 worldpacks.js(WORLD_PACKS / flagDraw);世界 meta(packs / fresh)在 saveslots.js。面板走 panelmgr.js(panelRegister / panelOpen kind:'big');沒有 panelmgr 時自管顯示 / 關閉。
// 風格寫入:確認後把 {pack, tpl} 記進 worlds.v1 的 fresh[n];該世界下次「全新啟動」時 main.js 呼叫 worldWizardBoot(true) → themeSet(風格)+ 套用起手範本。ES2017;載入時只宣告。
// 新範本來源(typeof 守衛):全域陣列 TEMPLATES112(若有),每筆 {id, name, note};沒有時取 TEMPLATES 內 112×112 經營範本(js/templates112.js 以 TEMPLATES.push 加入);皆無時只有預設「空白起手(city_lv01)」。範本依風格過濾(tplThemeOkFor)。

var wwEl = null, wwBody = null, wwBusy = false, wwOpen = false, wwSt = null, wwRefs = null;

function wwCss() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('wwCss')) return;
  var st = document.createElement('style');
  st.id = 'wwCss';
  st.textContent =
    '#wwPanel{position:fixed;left:0;top:0;right:0;bottom:0;z-index:41;display:flex;flex-direction:column;background:#1b222d;color:#f3ead7;font-size:14px;box-sizing:border-box;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);max-width:100%;overflow:hidden}' +
    '#wwPanel[hidden]{display:none}' +
    '#wwPanel *{box-sizing:border-box}' +
    '#wwPanel .wwh{display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.15);flex:0 0 auto}' +
    '#wwPanel .wwh b{flex:1;min-width:0;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#wwPanel .wwx{flex:0 0 auto;min-width:44px;min-height:44px;font-size:20px}' +
    '#wwPanel .wwbody{flex:1 1 auto;min-width:0;overflow-y:auto;overflow-x:hidden;padding:8px 16px 16px;-webkit-overflow-scrolling:touch}' +
    '#wwPanel .wwlab{display:block;margin:10px 0 4px;font-size:13px;opacity:.8;font-weight:bold}' +
    '#wwPanel select,#wwPanel input.wwname{display:block;width:100%;max-width:100%;min-height:44px;padding:0 8px;font-size:16px;border-radius:8px;background:#26303f;color:#f3ead7;border:1px solid rgba(255,255,255,.3)}' +
    '#wwPanel .wwprev{margin-top:10px;padding:10px;border:1px solid rgba(240,180,90,.5);border-radius:10px;background:rgba(255,255,255,.05);min-width:0;overflow:hidden}' +
    '#wwPanel .wwtop{display:flex;gap:12px;align-items:center;min-width:0}' +
    '#wwPanel .wwflag{flex:0 0 auto;width:96px;height:64px;display:block}' +
    '#wwPanel .wwtt{flex:1 1 auto;min-width:0}' +
    '#wwPanel .wwpn{font-size:17px;font-weight:bold;color:#f0b45a;word-break:break-all}' +
    '#wwPanel .wwsub{margin-top:2px;font-size:12px;opacity:.85;word-break:break-all}' +
    '#wwPanel .wwtag{margin-top:6px;font-size:12px;color:#9fd47a;word-break:break-all}' +
    '#wwPanel .wwtag[hidden]{display:none}' +
    '#wwPanel .wwintro{margin:10px 0 0;line-height:1.6;word-break:break-all}' +
    '#wwPanel .wwsec{margin:12px 0 4px;font-size:12px;opacity:.75;font-weight:bold}' +
    '#wwPanel .wwrow{display:flex;gap:6px;min-width:0}' +
    '#wwPanel .wwth{flex:1 1 0;min-width:0;max-width:25%;height:88px;display:flex;align-items:center;justify-content:center;border-radius:6px;overflow:hidden;background:rgba(255,255,255,.06)}' +
    '#wwPanel .wwth img{display:block;max-width:100%;max-height:84px;width:auto;height:auto;object-fit:contain}' +
    '#wwPanel .wwth .wwfb{font-size:26px;opacity:.7}' +
    '#wwPanel .wwpp{flex:0 0 auto;width:64px;min-width:0;text-align:center;font-size:12px}' +
    '#wwPanel .wwav{width:56px;height:56px;margin:0 auto 2px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.1)}' +
    '#wwPanel .wwav img{display:block;width:100%;height:100%;object-fit:cover}' +
    '#wwPanel .wwav .wwfb{font-size:26px;opacity:.7}' +
    '#wwPanel .wwpnm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#wwPanel .wwfeat{margin:0;padding:0 0 0 18px;line-height:1.6;word-break:break-all}' +
    '#wwPanel .wwpend{margin-top:6px;font-size:12px;color:#f0b45a;word-break:break-all}' +
    '#wwPanel .wwnote{margin-top:4px;font-size:12px;opacity:.8;word-break:break-all;min-height:1.2em}' +
    '#wwPanel .wwwarn{margin-top:12px;font-size:12px;opacity:.85;line-height:1.5;word-break:break-all}' +
    '#wwPanel .wwmsg{padding:0 16px 4px;font-size:13px;color:#f0b45a;flex:0 0 auto;min-height:1.2em}' +
    '#wwPanel .wwfoot{display:flex;gap:8px;padding:8px 16px;border-top:1px solid rgba(255,255,255,.15);flex:0 0 auto}' +
    '#wwPanel .wwfoot button{flex:1 1 0;min-width:0;min-height:44px;padding:0 4px;font-size:16px}' +
    '#wwPanel .wwfoot button.wwok{background:#6b4a1a;border-color:#f0b45a}' +
    '#wwPanel.busy .wwbody,#wwPanel.busy .wwfoot{pointer-events:none;opacity:.6}';
  document.head.appendChild(st);
}

function wwNode(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function wwClear(e) { if (!e) return; while (e.firstChild) e.removeChild(e.firstChild); }
function wwConfirmFn() { return (wwSt && typeof wwSt.confirm === 'function') ? wwSt.confirm : (typeof confirm === 'function' ? confirm : null); }

// 圖 + 回退:src 空或載入失敗 → 換成 fallback 文字(建築 🏠 / 人物 👤)
function wwImgBox(box, src, alt, glyph) {
  var img, fb;
  function fall() { wwClear(box); box.appendChild(wwNode('span', 'wwfb', glyph)); box.setAttribute('data-fallback', '1'); }
  if (!src) { fall(); return box; }
  img = wwNode('img', '');
  img.alt = alt;
  img.src = src;
  img.setAttribute('loading', 'lazy');
  img.onerror = fall;
  box.appendChild(img);
  return box;
}

// 起手範本清單:預設 + 新範本(若有);依選到的風格過濾(魔幻風格只列同風格範本,歷史風格不列魔幻範本;pid 省略且精靈未開 = 不過濾)
function wwTemplates(pid) {
  var list = [{ id: 'city_lv01', name: '空白起手(city_lv01)', note: '從 1 級小村開始(預設)' }], src = [];
  if (typeof TEMPLATES112 !== 'undefined' && Array.isArray(TEMPLATES112)) src = TEMPLATES112;
  else if (typeof TEMPLATES !== 'undefined' && Array.isArray(TEMPLATES)) src = TEMPLATES.filter(function (t) { return t && t.w === 112 && (!t.kind || t.kind === 'estate') && !t.hidden; });   // js/templates112.js 實際是 TEMPLATES.push(...)(TEMPLATES112 不存在):改取 TEMPLATES 內 112×112 經營範本
  pid = pid || (wwSt && wwSt.pack) || '';
  src.forEach(function (t) {
    if (pid && typeof tplThemeOkFor === 'function' && !tplThemeOkFor(t, pid)) return;
    if (t && typeof t.id === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(t.id) && t.id !== 'city_lv01' && !list.some(function (x) { return x.id === t.id; }))
      list.push({ id: t.id, name: String(t.name || t.id), note: String(t.note || '') });
  });
  return list;
}

function wwDefaultName(n) { return (typeof worldLabel === 'function') ? worldLabel(n) : ('平行世界 ' + (n < 10 ? '0' : '') + n); }

function wwEnsure() {
  var el, h, x, b, foot, ok, cancel, sel, i, ids, o, bodyEl;
  if (wwEl) return wwEl;
  if (typeof document === 'undefined' || !document.body) return null;
  wwCss();
  el = wwNode('div', '');
  el.id = 'wwPanel';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '世界風格');
  h = wwNode('div', 'wwh');
  wwRefs = { title: wwNode('b', '', '建立新世界') };
  h.appendChild(wwRefs.title);
  x = wwNode('button', 'wwx', '✕');
  x.setAttribute('aria-label', '關閉');
  x.addEventListener('click', function () { wwCancel(); });
  h.appendChild(x);
  bodyEl = wwNode('div', 'wwbody');
  wwBody = bodyEl;
  b = bodyEl;
  b.appendChild(wwNode('label', 'wwlab', '世界風格'));
  sel = wwNode('select', 'wwsel');
  sel.setAttribute('aria-label', '世界風格');
  ids = WORLD_PACKS.map(function (p) { return p.id; });
  for (i = 0; i < ids.length; i++) { o = wwNode('option', '', WORLD_PACKS[i].name + (WORLD_PACKS[i].fantasy ? '(魔幻 · 試玩)' : '')); o.value = ids[i]; sel.appendChild(o); }
  sel.addEventListener('change', function () { wwSelect(sel.value); });
  wwRefs.sel = sel;
  b.appendChild(sel);
  // 預覽區:旗幟 + 名稱副標 / 簡介 / 代表建築 / 代表人物 / 特色 / 待補圖提示
  wwRefs.prev = wwNode('div', 'wwprev');
  wwRefs.flag = wwNode('canvas', 'wwflag');
  wwRefs.flag.setAttribute('aria-label', '風格旗幟');
  wwRefs.pname = wwNode('div', 'wwpn', '');
  wwRefs.psub = wwNode('div', 'wwsub', '');
  wwRefs.top = wwNode('div', 'wwtop');
  wwRefs.tt = wwNode('div', 'wwtt');
  wwRefs.tt.appendChild(wwRefs.pname);
  wwRefs.tt.appendChild(wwRefs.psub);
  wwRefs.top.appendChild(wwRefs.flag);
  wwRefs.top.appendChild(wwRefs.tt);
  wwRefs.tag = wwNode('div', 'wwtag', '');
  wwRefs.intro = wwNode('p', 'wwintro', '');
  wwRefs.blds = wwNode('div', 'wwrow');
  wwRefs.pend = wwNode('div', 'wwpend', '');
  wwRefs.ppl = wwNode('div', 'wwrow');
  wwRefs.feats = wwNode('ul', 'wwfeat');
  wwRefs.prev.appendChild(wwRefs.top);
  wwRefs.prev.appendChild(wwRefs.tag);
  wwRefs.prev.appendChild(wwRefs.intro);
  wwRefs.prev.appendChild(wwNode('div', 'wwsec', '代表建築'));
  wwRefs.prev.appendChild(wwRefs.blds);
  wwRefs.prev.appendChild(wwRefs.pend);
  wwRefs.prev.appendChild(wwNode('div', 'wwsec', '代表人物'));
  wwRefs.prev.appendChild(wwRefs.ppl);
  wwRefs.prev.appendChild(wwNode('div', 'wwsec', '特色'));
  wwRefs.prev.appendChild(wwRefs.feats);
  b.appendChild(wwRefs.prev);
  b.appendChild(wwNode('label', 'wwlab', '世界名稱'));
  wwRefs.name = wwNode('input', 'wwname');
  wwRefs.name.type = 'text';
  wwRefs.name.setAttribute('maxlength', '20');
  wwRefs.name.setAttribute('aria-label', '世界名稱');
  b.appendChild(wwRefs.name);
  b.appendChild(wwNode('label', 'wwlab', '起手範本'));
  wwRefs.tpl = wwNode('select', 'wwtpl');
  wwRefs.tpl.setAttribute('aria-label', '起手範本');
  wwRefs.tpl.addEventListener('change', function () { wwTplNote(); });
  b.appendChild(wwRefs.tpl);
  wwRefs.tplNote = wwNode('div', 'wwnote', '');
  b.appendChild(wwRefs.tplNote);
  wwRefs.warn = wwNode('div', 'wwwarn', '');
  b.appendChild(wwRefs.warn);
  wwRefs.msg = wwNode('div', 'wwmsg', '');
  foot = wwNode('div', 'wwfoot');
  ok = wwNode('button', 'wwok', '建立');
  ok.addEventListener('click', function () { wwSubmit(); });
  cancel = wwNode('button', 'wwcancel', '取消');
  cancel.addEventListener('click', function () { wwCancel(); });
  wwRefs.ok = ok; wwRefs.cancel = cancel;
  foot.appendChild(ok);
  foot.appendChild(cancel);
  el.appendChild(h);
  el.appendChild(bodyEl);
  el.appendChild(wwRefs.msg);
  el.appendChild(foot);
  document.body.appendChild(el);
  wwEl = el;
  if (typeof panelRegister === 'function') panelRegister('worldwizard', { kind: 'big', el: el, onClose: function () { wwOpen = false; } });
  return el;
}

function wwSay(msg) { if (wwRefs && wwRefs.msg) wwRefs.msg.textContent = msg || ''; }

// 依選到的風格即時更新整個預覽區
function wwSelect(id) {
  var p = worldPackGet(id), R = wwRefs, i, box, pp, nm, thumbPal;
  if (!R) return false;
  if (wwSt) wwSt.pack = p.id;
  if (R.sel && R.sel.value !== p.id) R.sel.value = p.id;
  R.pname.textContent = p.name;
  R.psub.textContent = p.sub;
  R.tag.textContent = p.fantasy ? '✦ ' + (p.tag || '魔幻外觀 · 試玩') + '(建立後不可與歷史風格互換)' : '';
  R.tag.hidden = !p.fantasy;
  wwFillTpl(p.id);
  R.intro.textContent = p.intro;
  try { flagDraw(R.flag, p.id, 96, 64); } catch (e) { /* 無 canvas:略過旗幟 */ }
  wwClear(R.blds);
  thumbPal = (typeof themePal === 'function') ? themePal(p.id) : null;
  for (i = 0; i < p.buildings.length; i++) {
    box = wwNode('div', 'wwth');
    if (p.buildingsPending && thumbPal) box.style.background = 'linear-gradient(180deg,' + thumbPal.roof + '55,' + thumbPal.wall + '66)';
    wwImgBox(box, worldPackBuildingSrc(p.buildings[i]), p.buildings[i], '🏠');
    box.setAttribute('data-id', p.buildings[i]);
    R.blds.appendChild(box);
  }
  R.pend.textContent = p.buildingsPending ? '※ 此風格的專屬建築圖尚在準備,縮圖暫以相近建築加風格底色代替;實際遊戲內仍會套用該風格的色票與變體。' : '';
  wwClear(R.ppl);
  for (i = 0; i < p.people.length; i++) {
    pp = wwNode('div', 'wwpp');
    box = wwNode('div', 'wwav');
    wwImgBox(box, p.people[i].src, p.people[i].name, '👤');
    box.setAttribute('data-id', p.people[i].id);
    pp.appendChild(box);
    nm = wwNode('div', 'wwpnm', p.people[i].name);
    pp.appendChild(nm);
    R.ppl.appendChild(pp);
  }
  wwClear(R.feats);
  for (i = 0; i < p.feats.length; i++) R.feats.appendChild(wwNode('li', '', p.feats[i]));
  return true;
}

// 依風格重填起手範本下拉:保留仍可選的目前值,否則回空白起手
function wwFillTpl(pid) {
  var R = wwRefs, list = wwTemplates(pid), i, op, keep;
  if (!R || !R.tpl) return;
  keep = R.tpl.value;
  wwClear(R.tpl);
  for (i = 0; i < list.length; i++) { op = wwNode('option', '', list[i].name); op.value = list[i].id; R.tpl.appendChild(op); }
  R.tpl.value = list.some(function (x) { return x.id === keep; }) ? keep : 'city_lv01';
  wwTplNote();
}

function wwTplNote() {
  var R = wwRefs, list = wwTemplates(), i;
  if (!R) return;
  for (i = 0; i < list.length; i++) if (list[i].id === R.tpl.value) { R.tplNote.textContent = list[i].note || ''; if (wwSt) wwSt.tpl = list[i].id; return; }
  R.tplNote.textContent = '';
}

function wwWarnText(st) {
  if (st.kind === 'create') return '建立後會切換到新世界並重新載入頁面。目前世界會先存回它自己的位置(不會被覆蓋),並備份到復原點,可從設定「復原上一步」找回。';
  if (st.n === worldsActive()) return '重新開始會清掉這個世界的全部進度(領地、戰陣、資源、科技、卡牌、城市等級、釣魚與仙獸);保留偏好設定、其他世界與此世界的回溯點。會先自動備份到復原點,可從設定「復原上一步」找回。';
  return '重新開始會清掉這個世界的全部進度(變成空世界,下次進入以新風格從頭開始);保留名稱、回溯點、其他世界與偏好設定。會先備份到復原點,可從設定「復原上一步」找回。';
}

// 開啟精靈。opts: {kind:'create'|'restart', n:世界編號, from:'saves'|'settings', confirm:替代確認函式(測試用)}
function worldWizardOpen(opts) {
  var o = opts || {}, kind = o.kind === 'create' ? 'create' : 'restart', n = o.n, w, el, list, i, op, cur, nm;
  if (typeof worldsGet !== 'function' || typeof WORLD_PACKS === 'undefined') return false;
  w = worldsGet();
  if (!(typeof n === 'number' && n >= 1 && n <= WORLD_COUNT)) n = w.active;
  el = wwEnsure();
  if (!el) return false;
  cur = (n === w.active && typeof themeGet === 'function') ? themeGet() : worldsPackOf(n, w);
  wwSt = { kind: kind, n: n, from: o.from || '', confirm: o.confirm || null, pack: kind === 'create' ? WORLD_PACK_DEFAULT : (worldPackHas(cur) ? cur : WORLD_PACK_DEFAULT), tpl: 'city_lv01' };
  wwRefs.title.textContent = (kind === 'create' ? '建立新世界 · ' : '重新開始 · ') + wwDefaultName(n);
  wwRefs.ok.textContent = kind === 'create' ? '建立' : '重新開始';
  nm = w.names[n] || '';
  wwRefs.name.value = nm || wwDefaultName(n);
  wwClear(wwRefs.tpl);
  list = wwTemplates(wwSt.pack);
  for (i = 0; i < list.length; i++) { op = wwNode('option', '', list[i].name); op.value = list[i].id; wwRefs.tpl.appendChild(op); }
  wwRefs.tpl.value = 'city_lv01';
  wwTplNote();
  wwRefs.warn.textContent = wwWarnText(wwSt);
  wwSay('');
  wwSelect(wwSt.pack);
  wwOpen = true;
  if (typeof panelOpen === 'function' && typeof panelRegister === 'function') panelOpen('worldwizard', { kind: 'big' });
  el.hidden = false;
  return true;
}

function wwHide() {
  if (wwEl) wwEl.hidden = true;
  wwOpen = false;
}
function wwClose() {
  if (typeof panelClose === 'function' && typeof panelIsOpen === 'function' && panelIsOpen('worldwizard')) { panelClose('worldwizard'); return; }
  wwHide();
}
function wwCancel() {
  var from = wwSt ? wwSt.from : '';
  if (wwBusy) return;
  wwClose();
  if (from === 'saves' && typeof savesUiOpen === 'function') savesUiOpen();
}

function wwSetMeta(w, n, pack, tpl, name, withFresh) {
  var lab = wwDefaultName(n);
  if (!w.packs) w.packs = {};
  w.packs[n] = { id: pack, ver: WORLD_PACK_VER };
  if (withFresh) { if (!w.fresh) w.fresh = {}; w.fresh[n] = { pack: pack, tpl: tpl === 'city_lv01' ? '' : tpl }; }
  if (name && name !== lab) w.names[n] = savesCleanName(name); else delete w.names[n];
}

function wwConfirmText(st, name, p, tplName) {
  var head = (st.kind === 'create' ? '建立新世界 ' : '重新開始 ') + wwDefaultName(st.n) + (name && name !== wwDefaultName(st.n) ? '「' + name + '」' : '') + '?\n\n風格:' + p.name + '\n起手:' + tplName + '\n\n';
  if (st.kind === 'create') return head + '會清掉:無(這是新的空世界)。\n保留:目前世界(會先存回自己的位置並備份到復原點)、其他世界與偏好設定。\n建立後頁面會重新載入;可從設定「復原上一步」找回切換前的狀態。';
  if (st.n === worldsActive()) return head + '會清掉:目前這個世界的所有進度(領地、戰陣、資源、科技、卡牌、城市等級、釣魚與仙獸),並改用新風格。\n保留:聲音、畫質、介面等偏好設定、其他世界、此世界的回溯點。\n重新開始前會自動建立復原點,可從設定「復原上一步」找回。完成後頁面會重新載入。';
  return head + '會清掉:這個世界的全部進度(變成空世界,下次進入以新風格從頭開始)。\n保留:回溯點、其他世界與偏好設定。\n會先把這個世界備份到復原點,可從設定「復原上一步」找回。';
}

// [建立] / [重新開始]:確認 → 寫 meta → 走既有流程(worldsEnter / savesDoAction('all') / worldsRemove);失敗還原 meta
async function wwSubmit() {
  var st = wwSt, R = wwRefs, ask, p, name, tpl, tplName, w, prev, r, n, list, i, isActive;
  if (!st || wwBusy) return { ok: false, reason: 'busy' };
  ask = wwConfirmFn();
  p = worldPackGet(st.pack);
  name = savesCleanName(R.name.value) || wwDefaultName(st.n);
  tpl = R.tpl.value || 'city_lv01';
  list = wwTemplates();
  tplName = tpl;
  for (i = 0; i < list.length; i++) if (list[i].id === tpl) tplName = list[i].name;
  n = st.n;
  if (!ask || !ask(wwConfirmText(st, name, p, tplName))) return { ok: false, reason: 'declined' };
  wwBusy = true;
  if (wwEl) wwEl.classList.add('busy');
  try {
    w = worldsGet();
    isActive = n === w.active;
    prev = { pack: w.packs && w.packs[n] ? { id: w.packs[n].id, ver: 1 } : null, fresh: w.fresh && w.fresh[n] ? w.fresh[n] : null, name: w.names[n] };
    if (st.kind === 'create' || isActive) {
      wwSetMeta(w, n, p.id, tpl, name, true);
      worldsPut(w);
      if (st.kind === 'create') r = await worldsEnter(n);
      else r = await savesDoAction('all', { confirm: function (m) { return /無法建立復原點/.test(m) ? ask(m) : true; } });
      if (!r || !r.ok) {
        w = worldsGet();
        if (prev.pack) { w.packs = w.packs || {}; w.packs[n] = prev.pack; } else if (w.packs) delete w.packs[n];
        if (prev.fresh) { w.fresh = w.fresh || {}; w.fresh[n] = prev.fresh; } else if (w.fresh) delete w.fresh[n];
        if (prev.name !== undefined) w.names[n] = prev.name; else delete w.names[n];
        worldsPackPrune(w);
        worldsPut(w);
        wwSay(typeof svReasonText === 'function' ? svReasonText(r ? r.reason : 'write') : '操作失敗');
        return r || { ok: false, reason: 'write' };
      }
    } else {
      r = await worldsRemove(n, 'restart', { confirm: function () { return true; } });
      if (!r.ok) { wwSay(typeof svReasonText === 'function' ? svReasonText(r.reason) : '操作失敗'); return r; }
      w = worldsGet();
      wwSetMeta(w, n, p.id, tpl, name, true);
      worldsPut(w);
    }
    wwClose();
    if (typeof savesToast === 'function' && !(st.kind === 'create' || isActive)) savesToast(wwDefaultName(n) + ' 已重新開始(' + p.name + ',可從「復原上一步」救回)');
    if (typeof svTagSync === 'function') { try { svTagSync(); } catch (e0) { /* 略過 */ } }
    if (st.from === 'saves' && !(st.kind === 'create' || isActive) && typeof savesUiOpen === 'function') savesUiOpen();
    return r;
  } catch (e) {
    wwSay('操作失敗');
    return { ok: false, reason: 'error' };
  } finally {
    wwBusy = false;
    if (wwEl) wwEl.classList.remove('busy');
  }
}

// 啟動掛點(main.js,loadWorld 之後):fresh = 這次是全新世界(沒有存檔可讀)。有此世界的一次性 fresh 設定且確實全新 → 套風格與起手範本;一律清除設定,並把風格記進 packs
function worldWizardBoot(fresh) {
  var w, f, did = false, t;
  if (typeof worldsGet !== 'function') return false;
  w = worldsGet();
  f = w.fresh && w.fresh[w.active];
  if (f) {
    delete w.fresh[w.active];
    worldsPackPrune(w);
    if (fresh) {
      if (typeof themeSet === 'function') themeSet(f.pack, { init: true });   // 新世界建立風格:放行隔離規則(之後不可跨領域 / 魔幻換風格)
      if (f.tpl && typeof applyTemplate === 'function') {
        t = (typeof TEMPLATES !== 'undefined') ? TEMPLATES : null;
        if (t && !t.some(function (x) { return x.id === f.tpl; }) && typeof TEMPLATES112 !== 'undefined' && Array.isArray(TEMPLATES112)) {
          TEMPLATES112.forEach(function (x) { if (x && x.id === f.tpl && typeof x.w === 'number') t.push(x); });
        }
        applyTemplate(f.tpl);
      }
      if (!w.packs) w.packs = {};
      w.packs[w.active] = { id: typeof themeGet === 'function' ? themeGet() : f.pack, ver: WORLD_PACK_VER };
      did = true;
    }
    worldsPut(w);
  }
  return did;
}
