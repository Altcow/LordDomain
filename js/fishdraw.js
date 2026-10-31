// fishdraw.js — 釣魚繪製(F0):水下剖面、船與漁人、魚的向量圖、線與鉤、瞄準虛線、角度盤、拉力條、結果卡。
// 座標為邏輯 390×844;縮放由 fishui.js 在呼叫前用 ctx.setTransform 設好。內部輔助函式皆以 fd 開頭。
var fdSpr = {};
var fdPal = {
  day:   { sky: ['#9fd9ee', '#dff4fa'], water: ['#6fd0c8', '#2f93b0', '#1f6a90', '#154a6a'], sand: '#d8c18c', rock: '#3b3428' },
  dusk:  { sky: ['#f2b58a', '#ffe3c2'], water: ['#5aa9a0', '#2b6f88', '#1f4f6e', '#163a57'], sand: '#c9a878', rock: '#3a2c24' },
  night: { sky: ['#1b2a4a', '#2a3d62'], water: ['#1d4f63', '#143a52', '#0e2c40', '#0a2032'], sand: '#4d4a44', rock: '#1c1d22' }
};

function fdTodKey() {
  var v = typeof ART_TOD === 'string' ? ART_TOD : 'noon';
  if (v === 'night') return 'night';
  if (v === 'dusk' || v === 'dawn') return 'dusk';
  return 'day';
}

// 魚的向量圖:朝右游(頭在右),長度 96 單位;sil = 剪影。快取在 fdSpr。
function fdDrawFish(c, look, sil) {
  var cx = 82, cy = 45, x0 = 34, x1 = 130, hh = 96 * look.body[1] / 2, back = look.c[0], belly = look.c[1],
    fin = look.c[2], ink = '#2b2b3a', i, gx, gy, px, py;
  if (sil) { back = '#15304a'; belly = back; fin = back; }
  c.lineJoin = 'round';
  c.lineWidth = 2.2;
  c.strokeStyle = ink;
  c.fillStyle = fin;
  c.beginPath();
  if (look.tail === 'round') c.ellipse(x0 + 4, cy, 12, hh * 0.9, 0, 0, Math.PI * 2);
  else { c.moveTo(x0 + 10, cy); c.lineTo(x0 - 14, cy - hh * 1.2); c.lineTo(x0 - 6, cy); c.lineTo(x0 - 14, cy + hh * 1.2); c.closePath(); }
  c.fill();
  if (!sil) c.stroke();
  c.beginPath();
  if (look.dorsal === 'long') { c.moveTo(x0 + 30, cy - hh * 0.8); c.quadraticCurveTo(x0 + 62, cy - hh - hh * 0.9, x0 + 88, cy - hh * 0.7); }
  else { c.moveTo(x0 + 46, cy - hh * 0.8); c.lineTo(x0 + 60, cy - hh - hh * 0.8); c.lineTo(x0 + 72, cy - hh * 0.6); }
  c.closePath();
  c.fill();
  if (!sil) c.stroke();
  c.beginPath();
  c.ellipse(cx, cy, (x1 - x0) / 2, hh, 0, 0, Math.PI * 2);
  c.fillStyle = back;
  c.fill();
  if (!sil) {
    c.save();
    c.clip();
    c.fillStyle = belly;
    c.beginPath();
    c.ellipse(cx, cy + hh * 0.55, (x1 - x0) / 2, hh * 0.7, 0, 0, Math.PI * 2);
    c.fill();
    if (look.pat === 'scale') {
      c.strokeStyle = look.patC; c.globalAlpha = 0.45; c.lineWidth = 1.2;
      for (gy = 0; gy < 4; gy++) for (gx = 0; gx < 9; gx++) {
        px = x0 + 14 + gx * 9 + (gy % 2) * 4.5; py = cy - hh * 0.7 + gy * hh * 0.45;
        c.beginPath(); c.arc(px, py, 4, 0, Math.PI); c.stroke();
      }
      c.globalAlpha = 1; c.lineWidth = 2.2; c.strokeStyle = ink;
    } else if (look.pat === 'hband') {
      c.fillStyle = look.patC; c.globalAlpha = 0.55;
      c.fillRect(x0, cy - hh * 0.15, x1 - x0, hh * 0.3);
      c.globalAlpha = 1;
    } else if (look.pat === 'mottle') {
      c.fillStyle = look.patC; c.globalAlpha = 0.6;
      for (i = 0; i < 14; i++) {
        c.beginPath(); c.arc(x0 + 10 + ((i * 37) % 80), cy - hh + ((i * 23) % Math.max(1, 2 * hh)), 2.5, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
    c.restore();
    c.beginPath();
    c.ellipse(cx, cy, (x1 - x0) / 2, hh, 0, 0, Math.PI * 2);
    c.strokeStyle = ink;
    c.stroke();
  }
  c.beginPath();
  c.ellipse(x1 - 44, cy + hh * 0.35, 9, 4, -0.3, 0, Math.PI * 2);
  c.fillStyle = fin;
  c.fill();
  if (!sil) c.stroke();
  if (look.barbel) {
    c.strokeStyle = ink; c.lineWidth = 1.8;
    for (i = 0; i < look.barbel; i++) {
      c.beginPath();
      c.moveTo(x1 - 6, cy + hh * 0.3 + i * 3);
      c.quadraticCurveTo(x1 + 8, cy + hh * 0.6 + i * 2, x1 + 16 + i * 2, cy + hh * 0.9 + 4 + i * 6);
      c.stroke();
    }
  }
  if (!sil) {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x1 - 14, cy - hh * 0.3, 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = ink; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#1b1b24';
    c.beginPath(); c.arc(x1 - 13, cy - hh * 0.3, 2.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x1 - 14.5, cy - hh * 0.3 - 1.2, 0.9, 0, Math.PI * 2); c.fill();
    c.strokeStyle = ink; c.lineWidth = 1.4;
    c.beginPath(); c.arc(x1 - 1, cy + hh * 0.1, 3, 0.2, 1.4); c.stroke();
  }
}

function fishSprite(fi, sil) {
  var key = fi + (sil ? 's' : 'c'), cv;
  if (fdSpr[key]) return fdSpr[key];
  cv = document.createElement('canvas');
  cv.width = 160; cv.height = 90;
  fdDrawFish(cv.getContext('2d'), FISH[fi].look, sil);
  fdSpr[key] = cv;
  return cv;
}

// 把魚畫在 (x, y)(身體中心);f 需含 sp、len、dir。
function fdFish(ctx, f, x, y) {
  var k = f.len / 96;
  ctx.save();
  ctx.translate(x, y);
  if (f.dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(fishSprite(f.sp, false), -82 * k, -45 * k, 160 * k, 90 * k);
  ctx.restore();
}

// 船與漁人(Q 版簡版):舴艋舟、蓑衣、斗笠、竿。side = 竿尖在船的左(-1)或右(1)。
// skin:'raft' 竹筏(預設)、'wu' 烏篷船(旗子)、'hua' 畫舫(燈籠)。整體隨水面下移(dy)。
function fdBoat(c, x, side, skin) {
  var dy = FISH_LAYER.surf - 42, hull = '#8a5a2b', trim = '#c08a4a';
  if (skin === 'wu') { hull = '#4f3d2c'; trim = '#d8c7a0'; }
  else if (skin === 'hua') { hull = '#8b1e3f'; trim = '#e6b84a'; }
  c.save();
  c.translate(0, dy);
  c.lineJoin = 'round';
  c.strokeStyle = '#3d2612'; c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x - 34, 36); c.lineTo(x + 34, 36); c.quadraticCurveTo(x + 30, 52, x + 6, 52);
  c.lineTo(x - 10, 52); c.quadraticCurveTo(x - 30, 50, x - 34, 36); c.closePath();
  c.fillStyle = hull; c.fill(); c.stroke();
  c.fillStyle = trim; c.fillRect(x - 34, 34, 68, 4);
  if (skin === 'wu') {
    c.beginPath(); c.moveTo(x - 30, 34); c.lineTo(x - 30, 2); c.stroke();
    c.fillStyle = '#4f8a5a';
    c.beginPath(); c.moveTo(x - 30, 2); c.lineTo(x - 16, 7); c.lineTo(x - 30, 12); c.closePath(); c.fill(); c.stroke();
  } else if (skin === 'hua') {
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.arc(x + 30, 22, 5, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.fillStyle = '#4d6b5a';
  c.beginPath(); c.ellipse(x - 2, 27, 11, 9, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#f4cfa6';
  c.beginPath(); c.arc(x + 1, 15, 6, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#e6c57f';
  c.beginPath(); c.moveTo(x + 1, 2); c.lineTo(x - 8, 10); c.lineTo(x + 10, 10); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(x + 1, 10, 15, 3.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = '#5a3b1a'; c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(x + side * 4, 18); c.lineTo(x + side * 14, 34); c.stroke();
  c.restore();
}

// 角度盤:下半圓,θ = 0 為正下方,右正左負,刻度每 15°;超出上限的刻度變灰。
function fdDial(c, ang, maxA) {
  var u = FISH_LAYER.ui, cx = u.dialX, cy = u.dialY, R = u.dialR, th, a, col;
  c.save();
  c.fillStyle = 'rgba(12,20,30,.6)';
  c.beginPath(); c.arc(cx, cy, R + 8, 0, Math.PI); c.closePath(); c.fill();
  c.lineWidth = 2;
  for (th = -90; th <= 90; th += 15) {
    a = Math.PI / 2 - th * Math.PI / 180;
    col = Math.abs(th) <= maxA ? '#e8e8e8' : '#666b75';
    c.strokeStyle = col;
    c.beginPath();
    c.moveTo(cx + (R - 8) * Math.cos(a), cy + (R - 8) * Math.sin(a));
    c.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
    c.stroke();
  }
  a = Math.PI / 2 - ang * Math.PI / 180;
  c.strokeStyle = '#ffd24a'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + (R - 14) * Math.cos(a), cy + (R - 14) * Math.sin(a)); c.stroke();
  c.fillStyle = '#ffffff'; c.font = '600 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText((ang > 0 ? '+' : '') + Math.round(ang) + '°', cx, cy + 22);
  c.restore();
}

function fdCard(c, card) {
  var a, col, name;
  if (!card) return;
  a = Math.min(1, card.t * 6);
  c.save();
  c.globalAlpha = a;
  c.fillStyle = 'rgba(12,20,30,.9)';
  c.beginPath(); c.roundRect ? c.roundRect(60, 214, 270, 120, 14) : c.rect(60, 214, 270, 120); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (card.kind === 'catch') {
    col = FISH_RARITY[FISH[card.fi].rar].c;
    name = FISH[card.fi].name;
    c.fillStyle = col; c.fillRect(60, 214, 270, 6);
    fdFish(c, { sp: card.fi, len: 76, dir: 1 }, 150, 270);
    c.fillStyle = '#ffffff'; c.font = '700 20px sans-serif';
    c.fillText(name + '  ' + card.cm + ' cm', 230, 262);
    c.font = '600 13px sans-serif';
    c.fillStyle = '#ffd24a';
    c.fillText('+' + card.pts + ' 分  ' + (card.isNew ? '新收錄!  ' : '') + (card.gold ? '金框' : ''), 230, 288);
  } else {
    c.fillStyle = '#ffffff'; c.font = '700 20px sans-serif';
    c.fillText(card.kind === 'escape' ? '脫鉤了' : '空鉤', 195, 262);
    c.font = '13px sans-serif'; c.fillStyle = '#c9d3dd';
    var msg = { bottom: '撞到水底', obs: '撞到石頭', bounds: '鉤子飛出畫面', abort: '收回', escape: '魚掙脫了' };
    c.fillText(msg[card.why] || '', 195, 290);
  }
  c.restore();
}

function fdTension(c, v) {
  var x = 85, y = 372, w = 220, h = 14;
  c.save();
  c.fillStyle = 'rgba(12,20,30,.7)'; c.fillRect(x - 4, y - 22, w + 8, h + 30);
  c.fillStyle = '#ffffff'; c.font = '600 13px sans-serif'; c.textAlign = 'center';
  c.fillText('拉力 ' + Math.round(v) + '%', x + w / 2, y - 10);
  c.fillStyle = '#3a4656'; c.fillRect(x, y, w, h);
  c.fillStyle = v < 25 || v > 85 ? '#e0644a' : '#7ed37a';
  c.fillRect(x, y, w * Math.max(0, Math.min(100, v)) / 100, h);
  c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.strokeRect(x, y, w, h);
  c.restore();
}

// 一幀的完整畫面。t 為場景時間(秒),用來擺動水草、波紋與魚鰭。
function fishDrawFrame(ctx, t) {
  var FL = FISH_LAYER, W = FL.W, H = FL.H, surf = FL.surf, fl = FL.floor, tod = fdTodKey(), P = fdPal[tod],
    g, i, x, o, f, y, j, wy, pr, tip, side, gm;
  ctx.clearRect(0, 0, W, H);
  g = ctx.createLinearGradient(0, 0, 0, surf);
  g.addColorStop(0, P.sky[0]); g.addColorStop(1, P.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, surf + 2);
  g = ctx.createLinearGradient(0, surf, 0, fl);
  g.addColorStop(0, P.water[0]); g.addColorStop(0.38, P.water[1]); g.addColorStop(0.7, P.water[2]); g.addColorStop(1, P.water[3]);
  ctx.fillStyle = g; ctx.fillRect(0, surf, W, fl - surf);
  // 光柱(夜晚只留一道月光)
  ctx.fillStyle = tod === 'night' ? 'rgba(200,220,255,.05)' : 'rgba(255,255,255,.07)';
  for (i = 0; i < (tod === 'night' ? 1 : 3); i++) {
    x = 70 + i * 120 + Math.sin(t * 0.4 + i) * 14;
    ctx.beginPath();
    ctx.moveTo(x - 6, surf); ctx.lineTo(x + 6, surf); ctx.lineTo(x + 40, fl); ctx.lineTo(x - 30, fl); ctx.closePath(); ctx.fill();
  }
  // 層與層之間的淡亮帶
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
  [FL[2][0], FL[3][0]].forEach(function (yy) {
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
  });
  // 底沙與岩床(操作帶)
  ctx.fillStyle = P.sand; ctx.fillRect(0, fl, W, 40);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  for (i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(20 + i * 46, fl + 14 + (i % 3) * 7, 5 + (i % 2) * 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = P.rock; ctx.fillRect(0, 730, W, H - 730);
  // 障礙物
  for (i = 0; i < fs.obs.length; i++) {
    o = fs.obs[i];
    if (o.weed) {
      ctx.strokeStyle = '#2f7d4b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (j = 0; j < 4; j++) {
        x = o.x + 4 + j * 7;
        ctx.beginPath();
        ctx.moveTo(x, o.y + o.h);
        ctx.quadraticCurveTo(x + Math.sin(t * 1.6 + o.ph + j) * 6, o.y + o.h * 0.5, x + Math.sin(t * 1.6 + o.ph + j) * 9, o.y);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    } else {
      ctx.fillStyle = '#7b776d'; ctx.strokeStyle = '#4b4840'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.ellipse(o.x + o.w * 0.4, o.y + o.h * 0.35, o.w * 0.2, o.h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 氣泡
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
  for (i = 0; i < fs.bub.length; i++) {
    ctx.beginPath(); ctx.arc(fs.bub[i].x, fs.bub[i].y, fs.bub[i].r, 0, Math.PI * 2); ctx.stroke();
  }
  // 魚(含已勾住的魚;勾住時在拉扯中小幅抖動)
  for (i = 0; i < fs.fishes.length; i++) {
    f = fs.fishes[i];
    if (!f.alive) continue;
    if (f.attached) {
      x = f.x + (fs.fight && fs.fight.fish === f ? Math.sin(t * 18) * 2.5 : 0);
      y = f.y0;
    } else {
      x = f.x;
      y = f.y0 + 2.5 * Math.sin(f.phi + t * (2 + FISH[f.sp].spd * 0.8));
    }
    fdFish(ctx, { sp: f.sp, len: f.len, dir: f.dir }, x, y);
  }
  // 水面(正弦波)
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (x = 0; x <= W; x += 6) {
    wy = surf + 2.2 * Math.sin(x * 0.09 + t * 2.2) + 1.2 * Math.sin(x * 0.23 - t * 1.3);
    if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
  }
  ctx.stroke();
  // 瞄準虛線(只在瞄準狀態)
  side = fs.angle < 0 ? -1 : 1;
  tip = [fs.boatX + side * 14, fishTipY()];
  if (fs.phase === 'aim') {
    pr = fishPredict(fs.angle);
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (j = 0; j < pr.pts.length; j++) {
      if (j === 0) ctx.moveTo(pr.pts[j][0], pr.pts[j][1]); else ctx.lineTo(pr.pts[j][0], pr.pts[j][1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (pr.end === 'obs') {
      ctx.strokeStyle = '#ff8a7a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pr.pos[0] - 4, pr.pos[1] - 4); ctx.lineTo(pr.pos[0] + 4, pr.pos[1] + 4);
      ctx.moveTo(pr.pos[0] + 4, pr.pos[1] - 4); ctx.lineTo(pr.pos[0] - 4, pr.pos[1] + 4); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pr.pos[0], pr.pos[1], 4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  // 船與漁人
  fdBoat(ctx, fs.boatX, side, fs.save && fishSkinOk(fs.save.opt.skin) ? fs.save.opt.skin : 'raft');
  // 線與鉤(非瞄準時)
  if (fs.hook && fs.phase !== 'aim') {
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    for (j = 0; j < fs.hook.path.length; j++) ctx.lineTo(fs.hook.path[j][0], fs.hook.path[j][1]);
    ctx.lineTo(fs.hook.pos[0], fs.hook.pos[1]);
    ctx.stroke();
    ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fs.hook.pos[0], fs.hook.pos[1], 3, 0, Math.PI * 2); ctx.stroke();
  }
  // 角度盤
  gm = fishGear().angMax;
  fdDial(ctx, fs.angle, gm);
  // 連擊、分數與清單在 DOM 的 HUD(fishui.js)顯示
  if (fs.fight) fdTension(ctx, fs.fight.tension);
  fdCard(ctx, fs.card);
}
