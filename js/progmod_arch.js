// js/progmod_arch.js — 戰陣路線原型生成器(R01~R12)。由 tools/prog/arch_pack.js 自動產生,勿手改;來源:tools/prog/arch_lib.js + arch_r*.js。
// 純函式:依賴遊戲全域 OBJECTS / progLandSide / progWallCap / progFenceCap / progGateCap / progCampCp / progCampTier / progTrapTotal / CAMP_CAPS / CAMP_CP_PCT / PROG_UNLOCK_CAMP / PROG_UNLOCK_TERRAIN(units.js、progdata.js)。
// 用法:PROGMOD_ARCH.ARCHS.R03.build({ lv, seed, p }).toJSON()(js/progmod.js 的 progModBuild 包了這層)。確定性:只用 seed 雜湊亂數,不用 Math.random / Date。
const PROGMOD_ARCH = (function () {
  'use strict';
  const LIB = (function () {
  const MAP = 56;
  const N = MAP * MAP;
  const DIRS = [[-1, 0], [0, -1], [1, 0], [0, 1]];

  const GAME = {
    OBJECTS: function () { return OBJECTS; },
    progLandSide: function (lv) { return progLandSide(lv); },
    progWallCap: function (lv) { return progWallCap(lv); },
    progFenceCap: function (lv) { return progFenceCap(lv); },
    progGateCap: function (lv) { return progGateCap(lv); },
    progCampCp: function (lv) { return progCampCp(lv); },
    progCampTier: function (lv) { return progCampTier(lv); },
    progTrapTotal: function (lv) { return progTrapTotal(lv); },
    CAMP_CAPS: function () { return CAMP_CAPS; },
    CAMP_CP_PCT: function () { return CAMP_CP_PCT; },
    PROG_UNLOCK_CAMP: function () { return PROG_UNLOCK_CAMP; },
    PROG_UNLOCK_TERRAIN: function () { return PROG_UNLOCK_TERRAIN; }
  };

  let _obj = null;
  function objInfo(type) {
    if (!_obj) _obj = {};
    if (!_obj[type]) {
      const d = GAME.OBJECTS()[type];
      if (!d) throw new Error('未知物件: ' + type);
      const cb = d.cb || {};
      _obj[type] = { w: d.w, h: d.h, swap: !!d.swap, on: d.on.slice(), cp: cb.cp || 0, block: cb.block || 'none',
        cat: cb.cat || null, hp: cb.hp || 0, atk: cb.atk || 0, range: cb.range || 0, minRange: cb.minRange || 0 };
    }
    return _obj[type];
  }
  function fpOf(type, rot) { const d = objInfo(type); return d.swap && (rot & 1) ? [d.h, d.w] : [d.w, d.h]; }

  const COUNT_KEYS = ['hq', 'gate', 'zhalou', 'pili', 'fengsui', 'gutai', 'dilou', 'muster', 'banner', 'fakecamp'];
  function capsFor(lv) {
    const c = {
      lv: lv,
      side: GAME.progLandSide(lv),
      wall: GAME.progWallCap(lv),
      fence: GAME.progFenceCap(lv),
      gate: GAME.progGateCap(lv),
      cp: GAME.progCampCp(lv),
      tier: GAME.progCampTier(lv),
      trap: GAME.progTrapTotal(lv),
      pctMax: Math.floor(GAME.progCampCp(lv) * GAME.CAMP_CP_PCT()),
      count: {},
      unlock: {},
      raise: false, water: false
    };
    const caps = GAME.CAMP_CAPS();
    COUNT_KEYS.forEach(function (k) { c.count[k] = caps[k][c.tier - 1]; });
    c.count.gate = c.gate;
    const un = GAME.PROG_UNLOCK_CAMP();
    Object.keys(un).forEach(function (l) { un[l].forEach(function (t) { c.unlock[t] = +l; }); });
    c.unlock.tree = 1; c.unlock.stone = 1;          // 共用物件,與經營同 Lv1(PROG_UNLOCK_ESTATE)
    const ter = GAME.PROG_UNLOCK_TERRAIN();
    Object.keys(ter).forEach(function (l) {
      if (+l <= lv && ter[l].indexOf('raise') >= 0) c.raise = true;
      if (+l <= lv && ter[l].indexOf('lake') >= 0) c.water = true;
    });
    return c;
  }
  function unlockLv(type) {
    const c = capsFor(1);
    return c.unlock[type] || null;
  }

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash32(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  const TOWER_TYPES = ['tower', 'qtower', 'ztower', 'lianu', 'huojian', 'xunyan', 'nutai', 'chuangtai', 'shitai', 'pili',
    'wanglou', 'qiangzhen', 'ponu', 'dilou'];

  class Plan {
    constructor(arch, opt) {
      this.arch = arch;
      this.lv = opt.lv | 0;
      this.seed = opt.seed >>> 0;
      this.caps = capsFor(this.lv);
      const land = opt.side || this.caps.side;
      if (land > this.caps.side) throw new Error('side ' + land + ' 超過 Lv' + this.lv + ' 土地 ' + this.caps.side);
      const o0 = (MAP - land) >> 1, inset = Math.max(0, 5 - o0);
      this.land = land;
      this.S = land - 2 * inset;                       // 原型作畫用的邊長(≤ 土地)
      this.o = o0 + inset;
      this.rng = makeRng(hash32(arch + ':' + this.seed));
      this.ori = opt.ori != null ? (opt.ori & 7) : Math.floor(this.rng() * 8);
      this.p = opt.p || {};
      this.terrain = new Uint8Array(N);
      this.height = new Uint8Array(N);
      this.occ = new Int32Array(N);
      this.objs = [];
      this.routes = [];        // [{ pts:[[x,y]...], W }]
      this.maskRects = [];     // 額外併入 route mask 的矩形 [x,y,w,h]
      this.chokes = [];        // [{ x, y, w, h, name }]
      this.traps = [];         // 陷阱預留格 [[x,y]]
      this.rally = [];
      this.fails = [];
      this.n = { wall: 0, fence: 0, gate: 0, cp: 0, cpBy: {}, count: {} };
    }
    gi(x, y) { return (y + this.o) * MAP + (x + this.o); }
    inL(x, y) { return x >= 0 && y >= 0 && x < this.S && y < this.S; }
    free(x, y) { return this.inL(x, y) && !this.occ[this.gi(x, y)]; }
    H(x, y) { return this.inL(x, y) ? this.height[this.gi(x, y)] : 0; }
    R(n) { return Math.floor(this.rng() * n); }

    setH(x0, y0, x1, y1, h) {
      if (h > 0 && !this.caps.raise) { this.fails.push('height@Lv' + this.lv + ' 未開放'); return false; }
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (this.inL(x, y) && !this.occ[this.gi(x, y)]) this.height[this.gi(x, y)] = h;
      return true;
    }
    water(x0, y0, x1, y1, kind) {
      if (!this.caps.water) { this.fails.push('water@Lv' + this.lv + ' 未開放'); return false; }
      const t = kind === 'river' ? 2 : 1;
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (this.inL(x, y) && !this.occ[this.gi(x, y)]) this.terrain[this.gi(x, y)] = t;
      return true;
    }
    road(x0, y0, x1, y1) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (this.inL(x, y) && this.terrain[this.gi(x, y)] === 0) this.terrain[this.gi(x, y)] = 3;
    }

    budgetWhy(type) {
      const c = this.caps, d = objInfo(type);
      if (!c.unlock[type] || c.unlock[type] > this.lv) return 'lock';
      if (type === 'wall' && this.n.wall + 1 > c.wall) return 'wallcap';
      if (type === 'lujiao' && this.n.fence + 1 > c.fence) return 'fencecap';
      if (c.count[type] != null && (this.n.count[type] || 0) + 1 > c.count[type]) return 'count';
      if (d.cp > 0) {
        if (this.n.cp + d.cp > c.cp) return 'cp';
        if ((this.n.cpBy[type] || 0) + d.cp > c.pctMax) return 'cp%';
      }
      return null;
    }
    wallSafe(x, y, w, h) {
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) {
          const h0 = this.height[this.gi(xx, yy)];
          const nb = [[xx + 1, yy], [xx - 1, yy], [xx, yy + 1], [xx, yy - 1]];
          for (let k = 0; k < 4; k++) {
            const nx = nb[k][0], ny = nb[k][1];
            const hn = this.inL(nx, ny) ? this.height[this.gi(nx, ny)] : 0;
            if (Math.abs(hn - h0) === 1) return false;
          }
        }
      return true;
    }
    can(type, x, y, rot) {
      rot = rot | 0;
      if (this.budgetWhy(type)) return false;
      const fp = fpOf(type, rot), d = objInfo(type);
      if (!this.inL(x, y) || !this.inL(x + fp[0] - 1, y + fp[1] - 1)) return false;
      if (d.block === 'wall' && !this.wallSafe(x, y, fp[0], fp[1])) return false;
      const h0 = this.height[this.gi(x, y)];
      for (let yy = y; yy < y + fp[1]; yy++)
        for (let xx = x; xx < x + fp[0]; xx++) {
          const i = this.gi(xx, yy);
          if (this.occ[i] || this.height[i] !== h0 || d.on.indexOf(this.terrain[i]) < 0) return false;
        }
      return true;
    }
    put(type, x, y, rot, quiet) {
      rot = rot | 0;
      if (!this.can(type, x, y, rot)) {
        if (!quiet) this.fails.push(type + '@' + x + ',' + y + (this.budgetWhy(type) ? '(' + this.budgetWhy(type) + ')' : ''));
        return false;
      }
      const fp = fpOf(type, rot), d = objInfo(type);
      this.objs.push({ type: type, x: x, y: y, rot: rot });
      const k = this.objs.length;
      for (let yy = y; yy < y + fp[1]; yy++) for (let xx = x; xx < x + fp[0]; xx++) this.occ[this.gi(xx, yy)] = k;
      if (type === 'wall') this.n.wall++;
      if (type === 'lujiao') this.n.fence++;
      if (type === 'gate') this.n.gate++;
      this.n.count[type] = (this.n.count[type] || 0) + 1;
      if (d.cp > 0) { this.n.cp += d.cp; this.n.cpBy[type] = (this.n.cpBy[type] || 0) + d.cp; }
      return true;
    }
    tryPut(type, x, y, rot) { return this.put(type, x, y, rot, true); }
    putAt(type, cands, rot) {
      for (let k = 0; k < cands.length; k++) if (this.tryPut(type, cands[k][0], cands[k][1], rot)) return cands[k];
      this.fails.push(type + '@cands(' + (this.budgetWhy(type) || 'full') + ')');
      return null;
    }
    line(x0, y0, x1, y1, type, skip) {
      type = type || 'wall';
      let n = 0;
      if (y0 === y1) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (!(skip && skip(x, y0)) && this.put(type, x, y0, 0, true)) n++; }
      else if (x0 === x1) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) if (!(skip && skip(x0, y)) && this.put(type, x0, y, 0, true)) n++; }
      else throw new Error('line 只接受軸向');
      return n;
    }
    barrier(x, y, prefer) {
      if (!this.free(x, y)) return !!this.occ[this.gi(x, y)];
      if (prefer === 'lujiao' && this.tryPut('lujiao', x, y)) return true;
      if (this.tryPut('wall', x, y)) return true;
      if (this.tryPut('lujiao', x, y)) return true;
      this.fails.push('barrier@' + x + ',' + y);
      return false;
    }
    bline(x0, y0, x1, y1, prefer, skip) {
      if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { if (!(skip && skip(x, y0))) this.barrier(x, y0, prefer); }
      else for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { if (!(skip && skip(x0, y))) this.barrier(x0, y, prefer); }
    }
    ring(x0, y0, x1, y1, prefer, gaps) {
      const sk = function (x, y) { return (gaps || []).some(function (r) { return x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3]; }); };
      this.bline(x0, y0, x1, y0, prefer, sk);
      this.bline(x0, y1, x1, y1, prefer, sk);
      this.bline(x0, y0 + 1, x0, y1 - 1, prefer, sk);
      this.bline(x1, y0 + 1, x1, y1 - 1, prefer, sk);
    }
    gate(x, y, vertical) { return this.put('gate', x, y, vertical ? 1 : 0); }

    route(pts, W) { this.routes.push({ pts: pts.map(function (p) { return [p[0], p[1]]; }), W: W || 3 }); }
    maskRect(x, y, w, h) { this.maskRects.push([x, y, w, h]); }
    choke(x, y, w, h, name, opt) {
      const c = { x: x, y: y, w: w, h: h, name: name };
      if (opt && opt.must === false) c.must = false;
      if (opt && opt.only) c.only = opt.only;
      this.chokes.push(c);
      this.maskRect(x, y, w, h);
    }
    trap(x, y) { if (this.free(x, y)) this.traps.push([x, y]); }
    rallyAt(x, y, name) { this.rally.push({ x: x, y: y, name: name }); }

    towers(cands, types, max) {
      const out = [];
      let ti = 0;
      for (let k = 0; k < cands.length && (max == null || out.length < max); k++) {
        for (let tries = 0; tries < types.length; tries++) {
          const t = types[(ti + tries) % types.length];
          if (this.tryPut(t, cands[k][0], cands[k][1])) { out.push([t, cands[k][0], cands[k][1]]); ti = (ti + tries + 1) % types.length; break; }
        }
      }
      return out;
    }
    avail(list) { const c = this.caps, lv = this.lv; return list.filter(function (t) { return c.unlock[t] && c.unlock[t] <= lv; }); }
    blocks(x0, y0, x1, y1, types, singles) {
      const ty = this.avail(types || ['tent', 'wagon', 'granary', 'tower']);
      const one = this.avail(singles || ['qtower', 'banner', 'wanglou', 'fengsui']);
      let k = 0, n = 0;
      for (let y = y0; y + 1 <= y1; y += 2)
        for (let x = x0; x + 1 <= x1; x += 2) {
          for (let j = 0; j < ty.length; j++) if (this.tryPut(ty[(k + j) % ty.length], x, y)) { k = (k + j + 1) % ty.length; n++; break; }
        }
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          if (!this.free(x, y)) continue;
          let ok = false;
          for (let j = 0; j < one.length && !ok; j++) ok = this.tryPut(one[j], x, y);
          if (!ok) this.fails.push('block@' + x + ',' + y);
        }
      return n;
    }
    thick(x0, y0, x1, y1, dx, dy, n) {
      for (let k = 1; k <= n; k++) this.bline(x0 + dx * k, y0 + dy * k, x1 + dx * k, y1 + dy * k);
    }
    fillSolids(cands, types) {
      const ty = this.avail(types || ['tent', 'wagon', 'granary']);
      let n = 0;
      for (let k = 0; k < cands.length; k++)
        for (let j = 0; j < ty.length; j++) if (this.tryPut(ty[(k + j) % ty.length], cands[k][0], cands[k][1])) { n++; break; }
      return n;
    }

    layout(rows, ox, oy, opt) {
      opt = opt || {};
      const self = this, H = rows.length, W = rows[0].length, used = new Uint8Array(W * H);
      const at = function (c, r) { return c >= 0 && r >= 0 && c < W && r < H ? rows[r][c] : ' '; };
      const free = function (c, r, ch) { return at(c, r) === ch && !used[r * W + c]; };
      const mark = function (c, r, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used[(r + j) * W + c + i] = 1; };
      const block2 = function (c, r, ch) { return free(c, r, ch) && free(c + 1, r, ch) && free(c, r + 1, ch) && free(c + 1, r + 1, ch); };
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (!free(c, r, 'G')) continue;
        if (free(c + 1, r, 'G') && free(c + 2, r, 'G')) { this.gate(ox + c, oy + r, false); mark(c, r, 3, 1); }
        else if (free(c, r + 1, 'G') && free(c, r + 2, 'G')) { this.gate(ox + c, oy + r, true); mark(c, r, 1, 3); }
        else { this.fails.push('layout:G@' + c + ',' + r); mark(c, r, 1, 1); }
      }
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (free(c, r, 'H')) { this.put('hq', ox + c, oy + r); mark(c, r, 4, 4); }
      const tw = this.avail(opt.towers || ['tower', 'nutai', 'lianu']), one = this.avail(['qtower', 'wanglou']);
      let ti = 0;
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (block2(c, r, 'T')) {
          let ok = false;
          for (let k = 0; k < tw.length && !ok; k++) ok = this.tryPut(tw[(ti + k) % tw.length], ox + c, oy + r);
          if (!ok) { const fb = this.avail(['tent', 'wagon', 'granary']); for (let q = 0; q < fb.length && !ok; q++) ok = this.tryPut(fb[q], ox + c, oy + r); }   // 塔額度用完 → 改實心補位(保持隔牆)
          if (ok) ti++; else this.fails.push('layout:T@' + c + ',' + r);
          mark(c, r, 2, 2);
        }
      }
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (free(c, r, 't')) { if (!this.tryPut(one[0] || 'qtower', ox + c, oy + r)) this.fails.push('layout:t@' + c + ',' + r); mark(c, r, 1, 1); }
      const ty = this.avail(opt.solids || ['tent', 'wagon', 'granary']);
      let k = 0;
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (block2(c, r, 'o')) {
        let ok = false;
        for (let j = 0; j < ty.length && !ok; j++) if (this.tryPut(ty[(k + j) % ty.length], ox + c, oy + r)) { ok = true; k = (k + j + 1) % ty.length; }
        if (!ok) this.fails.push('layout:o@' + c + ',' + r);
        mark(c, r, 2, 2);
      }
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (free(c, r, 'o')) {
        let ok = false;
        for (let j = 0; j < one.length && !ok; j++) ok = this.tryPut(one[j], ox + c, oy + r);
        if (!ok) this.fails.push('layout:o1@' + c + ',' + r);
        mark(c, r, 1, 1);
      }
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (at(c, r) === '#') this.barrier(ox + c, oy + r);
      for (let r = 0; r < H; r++) {
        let c = 0;
        while (c < W) {
          const ch = at(c, r);
          if (ch === ',' || ch === '^') { let e = c; while (e + 1 < W && (at(e + 1, r) === ',' || at(e + 1, r) === '^')) e++; this.maskRect(ox + c, oy + r, e - c + 1, 1); c = e + 1; } else c++;
        }
        for (let c2 = 0; c2 < W; c2++) if (at(c2, r) === '^') this.trap(ox + c2, oy + r);
      }
      (opt.chokes || []).forEach(function (q) { self.choke(ox + q[0], oy + q[1], q[2], q[3], q[4], q[5]); });
    }

    spendCp(frac, prefer) {
      const self = this, S = this.S;
      const want = Math.floor(this.caps.cp * (frac != null ? frac : 0.85));
      const ty = this.avail(prefer || ['tower', 'nutai', 'lianu', 'huojian', 'ponu', 'ztower', 'chuangtai', 'shitai', 'dilou', 'xunyan', 'qiangzhen', 'wanglou', 'qtower']);
      const mask = this.routeCells();
      const maskSet = new Set(mask.map(function (c) { return c[1] * S + c[0]; }));
      const trapSet = new Set(this.traps.map(function (c) { return c[1] * S + c[0]; }));
      const seen = new Set(), cands = [];
      for (let k = mask.length - 1; k >= 0; k -= 3) {
        for (let dy = -3; dy <= 2; dy++)
          for (let dx = -3; dx <= 2; dx++) {
            const x = mask[k][0] + dx, y = mask[k][1] + dy, key = y * S + x;
            if (seen.has(key)) continue;
            seen.add(key);
            cands.push([x, y]);
          }
      }
      const clear = function (t, x, y) {
        const fp = fpOf(t, 0);
        for (let yy = y; yy < y + fp[1]; yy++)
          for (let xx = x; xx < x + fp[0]; xx++) {
            if (maskSet.has(yy * S + xx) || trapSet.has(yy * S + xx)) return false;
            if (!self.inL(xx, yy)) return false;
            const h0 = self.height[self.gi(xx, yy)];
            const nb = [[xx + 1, yy], [xx - 1, yy], [xx, yy + 1], [xx, yy - 1]];
            for (let q = 0; q < 4; q++) {
              const nx = nb[q][0], ny = nb[q][1];
              if (self.inL(nx, ny) && maskSet.has(ny * S + nx) && self.height[self.gi(nx, ny)] === h0) return false;
            }
          }
        return true;
      };
      let ti = 0;
      for (let k = 0; k < cands.length && this.n.cp < want; k++) {
        for (let j = 0; j < ty.length; j++) {
          const t = ty[(ti + j) % ty.length];
          if (clear(t, cands[k][0], cands[k][1]) && this.tryPut(t, cands[k][0], cands[k][1])) { ti = (ti + j + 1) % ty.length; break; }
        }
      }
    }

    redFill(x0, y0, x1, y1) {
      const self = this, S = this.S;
      const maskSet = new Set(this.routeCells().map(function (c) { return c[1] * S + c[0]; }));
      const isRedObj = function (k) { const d = objInfo(self.objs[k - 1].type); return d.hp > 0 || d.block === 'solid' || d.block === 'wall'; };
      let guard = 0;
      const skip = new Set();
      const trapSet = new Set(this.traps.map(function (c) { return c[1] * S + c[0]; }));
      for (;;) {
        const red = new Uint8Array(S * S);
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) {
            const k = this.occ[this.gi(x, y)];
            if (!k || !isRedObj(k)) continue;
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (this.inL(x + dx, y + dy)) red[(y + dy) * S + x + dx] = 1;
          }
        let hole = null;
        for (let y = y0; y <= y1 && !hole; y++)
          for (let x = x0; x <= x1 && !hole; x++) {
            const i = this.gi(x, y);
            if (red[y * S + x] || this.occ[i] || this.terrain[i] === 1 || this.terrain[i] === 2 || skip.has(y * S + x)) continue;
            hole = [x, y];
          }
        if (!hole || guard++ > 400) break;
        const types = ['wall', 'lujiao', 'tent', 'wagon', 'granary', 'qtower', 'banner', 'wanglou', 'fengsui'];
        let best = null, bs = -Infinity;
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            const x = hole[0] + dx, y = hole[1] + dy;
            if (!this.free(x, y) || x < x0 || y < y0 || x > x1 || y > y1 || trapSet.has(y * S + x)) continue;
            let t = null;
            for (let q = 0; q < types.length && !t; q++) if (this.can(types[q], x, y, 0)) t = types[q];
            if (!t) continue;
            const fp = fpOf(t, 0);
            let gain = 0;
            for (let yy = y - 3; yy < y + fp[1] + 3; yy++)
              for (let xx = x - 3; xx < x + fp[0] + 3; xx++)
                if (xx >= x0 && yy >= y0 && xx <= x1 && yy <= y1 && !red[yy * S + xx] && !this.occ[this.gi(xx, yy)]) gain++;
            if (maskSet.has(y * S + x)) gain -= 1000;   // 路線格最後才用
            if (gain > bs) { bs = gain; best = [x, y, t]; }
          }
        if (!best || !this.tryPut(best[2], best[0], best[1])) {
          this.fails.push('redFill@' + hole[0] + ',' + hole[1]);
          skip.add(hole[1] * S + hole[0]);
        }
      }
    }

    xf(x, y) {
      const S = this.S;
      if (this.ori & 4) x = S - 1 - x;
      for (let k = 0; k < (this.ori & 3); k++) { const nx = S - 1 - y; y = x; x = nx; }
      return [x, y];
    }
    xfVec(dx, dy) {
      if (this.ori & 4) dx = -dx;
      for (let k = 0; k < (this.ori & 3); k++) { const nx = -dy; dy = dx; dx = nx; }
      return [dx, dy];
    }
    routeCells() {
      const set = new Set(), self = this;
      function add(x, y) { if (self.inL(x, y)) set.add(y * self.S + x); }
      this.routes.forEach(function (r) {
        const h = (r.W - 1) >> 1;
        for (let k = 0; k + 1 < r.pts.length; k++) {
          const a = r.pts[k], b = r.pts[k + 1];
          const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
          for (let s = 0; s <= steps; s++) {
            const x = Math.round(a[0] + (b[0] - a[0]) * s / steps), y = Math.round(a[1] + (b[1] - a[1]) * s / steps);
            for (let dy = -h; dy <= h; dy++) for (let dx = -h; dx <= h; dx++) add(x + dx, y + dy);
          }
        }
      });
      this.maskRects.forEach(function (r) { for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) add(x, y); });
      return Array.from(set).sort(function (a, b) { return a - b; }).map(function (v) { return [v % self.S, Math.floor(v / self.S)]; });
    }
    toJSON() {
      const self = this, o = this.o, S = this.S;
      const G2 = function (p) { const q = self.xf(p[0], p[1]); return [q[0] + o, q[1] + o]; };
      const terrain = new Array(N).fill(0), height = new Array(N).fill(0), zero = new Array(N).fill(0);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const s = this.gi(x, y), q = G2([x, y]), d = q[1] * MAP + q[0];
          terrain[d] = this.terrain[s]; height[d] = this.height[s];
        }
      const objects = this.objs.map(function (ob) {
        const fp = fpOf(ob.type, ob.rot);
        let mx = Infinity, my = Infinity;
        for (let yy = ob.y; yy < ob.y + fp[1]; yy++)
          for (let xx = ob.x; xx < ob.x + fp[0]; xx++) { const q = G2([xx, yy]); if (q[0] < mx) mx = q[0]; if (q[1] < my) my = q[1]; }
        const v = DIRS[ob.rot & 3], nv = self.xfVec(v[0], v[1]);
        let rot = 0;
        for (let k = 0; k < 4; k++) if (DIRS[k][0] === nv[0] && DIRS[k][1] === nv[1]) rot = k;
        return { type: ob.type, x: mx, y: my, rot: rot, facing: rot };
      });
      objects.sort(function (a, b) { return a.type < b.type ? -1 : a.type > b.type ? 1 : (a.y - b.y) || (a.x - b.x); });
      const rect = function (r) {
        const a = G2([r.x, r.y]), b = G2([r.x + r.w - 1, r.y + r.h - 1]);
        const c = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]) + 1, h: Math.abs(a[1] - b[1]) + 1, name: r.name };
        if (r.must === false) c.must = false;
        if (r.only) c.only = r.only;
        return c;
      };
      return {
        v: 1,
        terrain: terrain, height: height, flow: zero.slice(), block: zero.slice(), zone: zero.slice(),
        objects: objects,
        marks: { deploy: [], rally: this.rally.map(function (r, k) { const q = G2([r.x, r.y]); return { id: 'r' + (k + 1), x: q[0], y: q[1], name: r.name }; }), aiEntry: [] },
        route: {
          W: this.routes.length ? this.routes[0].W : 3,
          path: this.routes.map(function (r) { return r.pts.map(G2); }),
          cells: this.routeCells().map(G2)
        },
        chokes: this.chokes.map(rect),
        traps: this.traps.map(G2),
        meta: {
          arch: this.arch, lv: this.lv, side: this.land, design: S, seed: this.seed, ori: this.ori, p: this.p,
          counts: { wall: this.n.wall, fence: this.n.fence, gate: this.n.gate, cp: this.n.cp, cpBy: this.n.cpBy,
            towers: this.objs.filter(function (ob) { return TOWER_TYPES.indexOf(ob.type) >= 0; }).length },
          caps: { wall: this.caps.wall, fence: this.caps.fence, gate: this.caps.gate, cp: this.caps.cp, trap: this.caps.trap },
          fails: this.fails.slice()
        }
      };
    }
  }

  return { MAP: MAP, N: N, DIRS: DIRS, TOWER_TYPES: TOWER_TYPES, objInfo: objInfo, fpOf: fpOf, capsFor: capsFor, makeRng: makeRng, hash32: hash32, Plan: Plan };
  })();
  const ARCHS = {};
  (function () {
    const L = LIB, module = { exports: null };
    function plan(S, p) {
      const m = 1, a = m + 1, b = S - 2 - m, W = p.w || 3, rMin = p.ridge || 2;
      const hx = Math.floor((S - 4) / 2), hy = Math.floor((S - 4) / 2) - (p.up || 0);
      const top = hy + 5, H = b - top + 1, cx = hx + 1;
      const D = Math.min(hx, hy, S - 1 - (hx + 3), S - 1 - (hy + 3)) - m + 4;
      const lim = 2 * D + 12 - (p.slack != null ? p.slack : 4);
      const nMax = Math.max(1, Math.min(p.legs || 9, Math.floor((H + rMin) / (W + rMin))));
      for (let n = nMax; n >= 1; n--) {
        for (let f = (p.mouth != null ? p.mouth : 0.6); f >= 0; f -= 0.1) {
          const r = n > 1 ? Math.floor((H - n * W) / (n - 1)) : 0;
          const legs = [];
          for (let i = 0; i < n; i++) legs.push(top + i * (W + r));
          if (n > 1) legs[n - 1] = b - W + 1;
          const conLastE = n > 1 ? ((n - 2) % 2 === 0) : true;
          let mx;
          if (n === 1) mx = Math.round(cx + (b - W + 1 - cx) * f);
          else mx = conLastE ? Math.round((b - W + 1) - (b - W + 1 - a) * f) : Math.round(a + (b - W + 1 - a) * f);
          mx = Math.max(a, Math.min(b - W + 1, mx));
          const route = [[mx + 1, S - 1], [mx + 1, legs[n - 1] + 1]];
          if (n === 1) route[1] = [mx + 1, top + 1];
          for (let i = n - 1; i >= 0; i--) {
            const y = legs[i] + 1;
            if (i === 0) { route.push([cx + 1, y]); route.push([cx + 1, hy + 4]); break; }
            const xc = ((i - 1) % 2 === 0) ? b - 1 : a + 1;
            route.push([xc, y]); route.push([xc, legs[i - 1] + 1]);
          }
          let len = 0;
          for (let k = 0; k + 1 < route.length; k++) len += Math.abs(route[k + 1][0] - route[k][0]) + Math.abs(route[k + 1][1] - route[k][1]);
          len += 3 - 1;                                   // 部署格到外環約 3 格(扣掉終點鄰格)
          if (len <= lim || (n === 1 && f < 0.05)) return { m: m, a: a, b: b, W: W, hx: hx, hy: hy, top: top, cx: cx, n: n, r: r, legs: legs, mx: mx, route: route, len: len, lim: lim };
        }
      }
      return null;
    }

    module.exports = {
      id: 'R01', name: '蛇形迴廊', minLv: 5,
      desc: '整營升為高台,南半挖出蛇形谷道直抵中央帥帳;谷口城門一道,谷道之間的高台脊上擺塔夾射,攻方須來回折返。',
      plan: plan,
      build: function (opt) {
        const P = new L.Plan('R01', opt), S = P.S, p = P.p;
        const g = plan(S, p);
        const m = g.m, a = g.a, b = g.b, W = g.W, hx = g.hx, hy = g.hy, n = g.n, legs = g.legs, mx = g.mx, cx = g.cx, top = g.top;
        P.setH(m, m, S - 1 - m, S - 1 - m, 2);
        P.setH(hx - 1, hy - 1, hx + 4, hy + 4, 0);         // 中央谷地 6×6
        for (let i = 0; i < n; i++) {
          const y0 = legs[i];
          if (i === 0) P.setH(cx, y0, n === 1 ? Math.max(cx, mx) + W - 1 : b, y0 + W - 1, 0);
          else P.setH(a, y0, b, y0 + W - 1, 0);
          if (i + 1 < n) { const xc = (i % 2 === 0) ? b - W + 1 : a; P.setH(xc, y0, xc + W - 1, legs[i + 1] + W - 1, 0); }
        }
        if (n === 1) { P.setH(Math.min(mx, cx), legs[0], Math.max(mx, cx) + W - 1, legs[0] + W - 1, 0); P.setH(mx, legs[0], mx + W - 1, S - 1 - m, 0); }
        if (n > 1) {
          const conE = ((n - 2) % 2 === 0), y0 = legs[n - 1];
          if (conE) P.setH(a, y0, mx - 1, y0 + W - 1, 2); else P.setH(mx + W, y0, b, y0 + W - 1, 2);
        }
        P.setH(cx, top - 1, cx + W - 1, top - 1, 0);      // 谷地入口
        P.setH(mx, S - 1 - m, mx + W - 1, S - 1 - m, 0);  // 谷口
        P.gate(mx, S - 1 - m, false);
        P.ring(m, m, S - 1 - m, S - 1 - m, null, [[mx, S - 1 - m, W, 1]]);
        P.put('hq', hx, hy);
        const tw = P.avail(['tower', 'nutai', 'lianu', 'huojian', 'ponu', 'ztower', 'dilou', 'chuangtai', 'shitai', 'wanglou', 'qtower']);
        P.towers([[hx - 3, hy], [hx + 5, hy + 3], [hx - 3, hy + 3], [hx + 5, hy], [hx + 1, hy - 3]], tw, 4);
        for (let i = 0; i + 1 < n; i++) {
          const ry = legs[i] + W, xc = (i % 2 === 0) ? b - W + 1 : a;
          P.towers(i % 2 === 0 ? [[xc - 3, ry], [xc - 3, ry + 2], [xc - 5, ry], [xc - 3, ry + Math.max(0, g.r - 2)]] : [[xc + W + 1, ry], [xc + W + 1, ry + 2], [xc + W + 3, ry], [xc + W + 1, ry + Math.max(0, g.r - 2)]], tw, 3);
          for (let x = a + W + 2; x + 1 < b - W - 1; x += 5) P.towers([[x, ry]], tw.slice(i % tw.length).concat(tw));
        }
        P.towers([[mx - 3, S - 1 - m - 3], [mx + W + 1, S - 1 - m - 3], [mx - 3, S - 1 - m - 2], [mx + W + 1, S - 1 - m - 2]], tw, 2);
        for (let x = a + 1; x + 1 < hx - 2; x += 4) P.towers([[x, top - 3]], tw);
        P.route(g.route, W);
        P.maskRect(hx - 1, hy - 1, 6, 6);
        P.choke(mx, S - 1 - m, W, 1, '谷口城門');
        P.choke(cx, top - 1, W, 1, '谷地口');
        if (n > 1) P.choke(b - W + 1, legs[0] + W, W, Math.min(2, g.r), '第一折');
        P.trap(mx + 1, legs[n - 1] + 1);
        for (let i = 0; i + 1 < n; i++) { const xc = (i % 2 === 0) ? b - 1 : a + 1; P.trap(xc, legs[i] + W); }
        P.trap(cx + 1, top);
        P.rallyAt(cx + 1, top, '谷地口');
        P.spendCp(p.cpUse);
        P.redFill(m, m, S - 1 - m, S - 1 - m);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    module.exports = {
      id: 'R02', name: '雙門甕城', minLv: 4,
      desc: '外門在南牆東段,門內是沿南牆向西的甕城長院,內門在甕城西端北側(與外門錯開);入內門後谷道北上折東到中央帥帳。甕城三面高台,即殺傷區。',
      build: function (opt) {
        const P = new L.Plan('R02', opt), S = P.S, p = P.p;
        const m = 1, a = m + 1, b = S - 2 - m, yS = S - 1 - m, I = b - a + 1, W = 3;
        const c = Math.floor((S - 1) / 2);
        const q = p.q != null ? p.q : Math.min(Math.round(I * 0.15), 4);  // 甕城向兩側伸出的長度(大土地封頂,維持路徑上限)
        const g1x = Math.min(b - 2, c + 2 + q);                     // 外門 x(3 格)
        const by0 = yS - W;                                      // 甕城列 by0..yS-1
        const g2x = Math.max(a, c - 5 - q);                      // 內門 x(甕城西端)
        const hx = c - 1, hy = Math.max(a + 2, Math.min(by0 - 8, Math.floor((S - 4) / 2) - 1));
        P.setH(m, m, S - 1 - m, yS, 2);
        P.setH(g2x, by0, g1x + 2, yS - 1, 0);                    // 甕城
        P.setH(g1x, yS, g1x + 2, yS, 0);                         // 外門
        P.setH(g2x, hy + 1, g2x + W - 1, by0 - 1, 0);            // 內谷道北上
        P.setH(g2x, hy + 1, hx - 1, hy + 3, 0);                  // 折東
        P.setH(hx - 1, hy - 1, hx + 4, hy + 4, 0);               // 中央谷地
        P.gate(g1x, yS, false);
        P.ring(m, m, S - 1 - m, yS, null, [[g1x, yS, 3, 1]]);
        P.gate(g2x, by0 - 1, false);
        P.put('hq', hx, hy);
        const tw = P.avail(['tower', 'nutai', 'lianu', 'huojian', 'xunyan', 'ponu', 'ztower', 'chuangtai', 'shitai', 'dilou', 'wanglou', 'qtower']);
        P.towers([[g1x - 3, by0 - 2], [g1x + 3, by0 - 2], [g1x + 4, by0 - 4]], P.avail(['tower', 'nutai', 'lianu', 'ponu', 'qtower']), 2);
        const bank = [];
        for (let x = g2x + W + 2; x + 1 < g1x - 3; x += 4) bank.push([x, by0 - 2]);
        P.towers(bank, tw);
        P.towers([[g2x + W, by0 - 4], [g2x + W, by0 - 7], [g2x + W + 2, hy + 4]], tw.slice(2).concat(tw), 2);
        P.towers([[hx - 3, hy - 3], [hx + 5, hy], [hx + 5, hy + 3], [hx + 1, hy - 3]], tw, 3);
        P.route([[g1x + 1, S - 1], [g1x + 1, yS - 1], [g2x + 1, yS - 2], [g2x + 1, hy + 2], [hx, hy + 2]], W);
        P.maskRect(g2x, by0, g1x + 3 - g2x, W);                  // 甕城整院
        P.maskRect(hx - 1, hy - 1, 6, 6);
        P.choke(g1x, yS, 3, 1, '外門');
        P.choke(g2x, by0 - 1, 3, 1, '內門');
        for (let x = g2x + 2; x < g1x && P.traps.length < 4; x += 3) P.trap(x, by0 + 1);
        P.trap(g2x + 1, by0 - 2);
        P.rallyAt(g2x + 1, by0 + 1, '甕城西端');
        P.spendCp(p.cpUse);
        P.redFill(m, m, S - 1 - m, yS);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    module.exports = {
      id: 'R03', name: '谷道夾擊', minLv: 5,
      desc: '高台中央一條直谷通帥帳,谷口與谷頭各一道關門;谷內實心短屏左右交錯迫敵蛇行,兩側高台沿谷擺塔居高夾射。',
      build: function (opt) {
        const P = new L.Plan('R03', opt), S = P.S, p = P.p;
        const m = 1, yS = S - 1 - m;
        const Wv = p.wv || (S >= 40 ? 5 : 4);
        const pitch = p.pitch || (S >= 40 ? 3 : 2);                          // 屏距(列)
        const hx = Math.floor((S - 4) / 2), hy = Math.max(m + 4, Math.floor((S - 4) / 2) - (p.up != null ? p.up : (S >= 44 ? 1 : Math.round(S / 10))));
        const vx = hx + 2 - (Wv >> 1);
        P.setH(m, m, S - 1 - m, yS, 2);
        P.setH(hx - 1, hy - 1, hx + 4, hy + 4, 0);
        P.setH(vx, hy + 5, vx + Wv - 1, yS, 0);
        const gx = vx + ((Wv - 3) >> 1), ky = hy + 5;
        P.gate(gx, yS, false);
        P.bline(vx, yS, vx + Wv - 1, yS, null, function (x) { return x >= gx && x < gx + 3; });
        P.ring(m, m, S - 1 - m, yS, null, [[vx, yS, Wv, 1]]);
        P.gate(gx, ky, false);
        P.bline(vx, ky, vx + Wv - 1, ky, null, function (x) { return x >= gx && x < gx + 3; });
        P.put('hq', hx, hy);
        const tw = P.avail(['tower', 'nutai', 'lianu', 'huojian', 'ponu', 'ztower', 'chuangtai', 'shitai', 'dilou', 'wanglou', 'qtower']);
        P.towers([[hx - 3, hy], [hx + 5, hy + 2], [hx - 3, hy + 3], [hx + 5, hy - 1], [hx + 1, hy - 3]], tw, 4);
        for (let y = yS - 3; y >= ky + 1; y -= 4) {
          P.towers([[vx - 3, y]], tw);
          P.towers([[vx + Wv + 1, y - 2]], tw.slice(3).concat(tw));
        }
        P.towers([[gx - 4, yS - 3], [gx + 5, yS - 3]], tw, 2);
        const baffles = [];
        let k = 0;
        for (let y = yS - 3; y >= ky + 3; y -= pitch, k++) {
          const x0 = k % 2 === 0 ? vx : vx + 1, x1 = x0 + Wv - 2;
          P.blocks(x0, y, x1, y, [], ['qtower', 'banner', 'wanglou', 'fengsui']);
          baffles.push([y, k % 2 === 0 ? vx + Wv - 1 : vx]);
        }
        const route = [[vx + (Wv >> 1), S - 1], [vx + (Wv >> 1), yS]];
        baffles.forEach(function (bf) { route.push([bf[1], bf[0] + 1]); route.push([bf[1], bf[0] - 1]); });
        route.push([vx + (Wv >> 1), ky]); route.push([vx + (Wv >> 1), hy + 4]);
        P.route(route, 3);
        P.maskRect(vx, ky, Wv, yS - ky + 1);
        P.maskRect(hx - 1, hy - 1, 6, 6);
        P.choke(gx, yS, 3, 1, '谷口關門');
        P.choke(gx, ky, 3, 1, '谷頭關門');
        if (baffles.length) P.choke(vx, baffles[0][0], Wv, 1, '第一道屏');
        baffles.forEach(function (bf, i) { if (i < 4) P.trap(bf[1], bf[0] - 1); });
        P.trap(vx + (Wv >> 1), ky + 1);
        P.rallyAt(vx + (Wv >> 1), ky + 1, '谷頭');
        P.spendCp(p.cpUse);
        P.redFill(m, m, S - 1 - m, yS);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    module.exports = {
      id: 'R04', name: '階梯高台', minLv: 4,
      desc: '城內迴廊環繞中央高台;步兵須在東面台階連爬兩層上台(被俯射),騎兵只能繞半圈走北面階梯,步騎分兩路。',
      build: function (opt) {
        const P = new L.Plan('R04', opt), S = P.S, p = P.p;
        const m = 1, F0 = m, F1 = S - 1 - m, wk = p.walk || 3;
        const K0 = F0 + 1 + wk, K1 = F1 - 1 - wk;
        const cx = Math.floor((S - 1) / 2), gx = cx - 1;
        const sy = Math.floor((K0 + K1) / 2) - 1;             // 東面台階 y(3 格)
        const west2 = p.west2 != null ? !!p.west2 : S >= 40;
        P.setH(F0, F0, F1, F0, 2); P.setH(F0, F1, F1, F1, 2); P.setH(F0, F0, F0, F1, 2); P.setH(F1, F0, F1, F1, 2);
        P.setH(gx, F1, gx + 2, F1, 0);
        P.setH(K0, K0, K1, K1, 2);
        P.setH(K1 + 1, sy, K1 + 1, sy + 2, 1);
        const wy0 = sy + 4;
        if (west2) P.setH(K0 - 1, wy0, K0 - 1, wy0 + 2, 1);
        for (let x = gx; x < gx + 3; x++) P.put('stairs', x, K0 - 1);
        P.gate(gx, F1, false);
        P.ring(F0, F0, F1, F1, null, [[gx, F1, 3, 1]]);
        const hx = Math.floor((K0 + K1) / 2) - 1, hy = Math.floor((K0 + K1) / 2) - 1;
        P.put('hq', hx, hy);
        const tw = P.avail(['tower', 'nutai', 'lianu', 'huojian', 'ponu', 'ztower', 'chuangtai', 'shitai', 'dilou', 'wanglou', 'qtower']);
        P.towers([[hx - 3, hy], [hx + 5, hy + 2], [hx - 3, hy + 3], [hx + 1, hy - 3]], tw, 4);
        P.towers([[K1 - 1, sy - 3], [K1 - 1, sy + 4], [K1 - 3, sy]], tw, 3);
        P.towers([[gx - 3, K0], [gx + 4, K0]], tw, 2);
        if (west2) P.towers([[K0, wy0 - 3], [K0, wy0 + 4]], tw, 2);
        const edge = [];
        for (let t = K0 + 4; t + 1 <= K1 - 1; t += 5) { edge.push([t, K1 - 1]); edge.push([K0, t]); }
        P.towers(edge, tw.slice(2).concat(tw));
        P.towers([[gx - 2, F1 - 2], [gx - 4, F1 - 2], [gx - 6, F1 - 2]], P.avail(['nutai', 'tower', 'lianu', 'qtower']), 2);
        const wy = F1 - 1 - (wk >> 1), wn = F0 + 1 + (wk >> 1), wxE = F1 - 1 - (wk >> 1), wxW = F0 + 1 + (wk >> 1);
        P.route([[gx + 1, S - 1], [gx + 1, wy], [wxE, wy], [wxE, sy + 1], [hx + 4, sy + 1]], wk);
        P.route([[wxE, sy + 1], [wxE, wn], [gx + 1, wn], [gx + 1, hy + 4]], wk);
        P.route([[gx + 1, wy], [wxW, wy], [wxW, wn], [gx + 1, wn]], wk);
        if (west2) P.route([[wxW, wy0 + 1], [hx, wy0 + 1]], 3);
        P.maskRect(hx - 1, hy - 1, 6, 6);
        P.maskRect(hx + 3, Math.min(hy, sy) - 1, K1 + 2 - hx - 3, Math.max(hy + 4, sy + 3) - Math.min(hy, sy) + 2);   // 台階上到帥帳的高台面
        if (west2) P.maskRect(K0 - 1, wy0 - 1, hx - K0 + 2, 5);
        P.choke(gx, F1, 3, 1, '城門');
        P.choke(K1 + 1, sy, 1, 3, '東台階', { only: 'foot', must: !west2 });
        P.choke(gx, K0 - 1, 3, 1, '北階梯', { only: 'horse' });
        P.trap(K1 + 2, sy - 1); P.trap(K1 + 2, sy + 3); P.trap(gx + 1, K0 - 2); P.trap(gx + 3, F1 - 1);
        P.rallyAt(wxE, sy + 1, '東台階下');
        P.spendCp(p.cpUse);
        P.redFill(F0, F0, F1, F1);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    module.exports = {
      id: 'R05', name: '棋盤隔間', minLv: 4,
      desc: '高台中挖出方室棋盤,帥帳居中室;室間脊上擺塔,只在指定處開門,東西兩條等長路線斜穿各室抵中室,中室兩門各設城門。',
      build: function (opt) {
        const P = new L.Plan('R05', opt), S = P.S, p = P.p;
        const m = 1, a = m + 1, b = S - 2 - m, yS = S - 1 - m, I = b - a + 1;
        const g = p.g || (I <= 30 ? 3 : 5), rg = 2;
        const rs = Math.floor((I - rg * (g - 1)) / g);
        const off = a + Math.floor((I - (rs * g + rg * (g - 1))) / 2);
        const rx = function (i) { return off + i * (rs + rg); };        // 室 i 的左上 x(y 同)
        const c = (g - 1) >> 1;
        let paths;
        if (g === 3) paths = [[[1, 2], [2, 2], [2, 1], [1, 1]], [[1, 2], [0, 2], [0, 1], [1, 1]]];
        else paths = [[[1, 4], [2, 4], [3, 4], [3, 3], [2, 3], [2, 2]], [[1, 4], [0, 4], [0, 3], [0, 2], [1, 2], [2, 2]]];
        if (p.single) paths = [paths[0]];
        P.setH(m, m, S - 1 - m, yS, 2);
        const used = {};
        paths.forEach(function (pt) { pt.forEach(function (r) { used[r[0] + ',' + r[1]] = 1; }); });
        Object.keys(used).forEach(function (k) { const i = +k.split(',')[0], j = +k.split(',')[1]; P.setH(rx(i), rx(j), rx(i) + rs - 1, rx(j) + rs - 1, 0); });
        const doors = [];                                  // [x, y, w, h, 'H'|'V', 是否進中室]
        let flip = 0;
        paths.forEach(function (pt) {
          for (let k = 0; k + 1 < pt.length; k++) {
            const A = pt[k], B = pt[k + 1];
            const key = [A, B].map(String).sort().join('|');
            if (doors.some(function (d) { return d.key === key; })) continue;
            const toC = B[0] === c && B[1] === c;
            flip++;
            if (A[1] === B[1]) {                           // 東西相鄰:門穿直脊
              const xg = rx(Math.min(A[0], B[0])) + rs;
              const yd = toC ? rx(A[1]) + ((rs - 3) >> 1) : (flip % 2 ? rx(A[1]) : rx(A[1]) + rs - 2);
              const h = toC ? 3 : 2;
              P.setH(xg, yd, xg + rg - 1, yd + h - 1, 0);
              doors.push({ key: key, x: xg, y: yd, w: rg, h: h, v: true, toC: toC });
            } else {                                       // 南北相鄰:門穿橫脊
              const yg = rx(Math.min(A[1], B[1])) + rs;
              const xd = toC ? rx(A[0]) + ((rs - 3) >> 1) : (flip % 2 ? rx(A[0]) + rs - 2 : rx(A[0]));
              const w = toC ? 3 : 2;
              P.setH(xd, yg, xd + w - 1, yg + rg - 1, 0);
              doors.push({ key: key, x: xd, y: yg, w: w, h: rg, v: false, toC: toC });
            }
          }
        });
        const e0 = paths[0][0], gx = rx(e0[0]) + ((rs - 3) >> 1);
        P.setH(gx, rx(e0[1]) + rs, gx + 2, yS, 0);
        P.gate(gx, yS, false);
        P.ring(m, m, S - 1 - m, yS, null, [[gx, yS, 3, 1]]);
        doors.forEach(function (d) {
          if (!d.toC) return;
          if (d.v) P.gate(d.x + (d.w >> 1), d.y, true); else P.gate(d.x, d.y + (d.h >> 1), false);
        });
        const hx = rx(c) + ((rs - 4) >> 1);
        P.put('hq', hx, hx);
        const tw = P.avail(['tower', 'nutai', 'lianu', 'huojian', 'ponu', 'ztower', 'chuangtai', 'shitai', 'dilou', 'wanglou', 'qtower']);
        P.towers([[hx - 3, hx - 3], [hx + 5, hx + 5], [hx - 3, hx + 5], [hx + 5, hx - 3]].map(function (q) { return [Math.max(a, q[0]), Math.max(a, q[1])]; }), tw, 3);
        doors.forEach(function (d, k) {
          const cand = d.v ? [[d.x, d.y - 2], [d.x, d.y + d.h], [d.x, d.y - 3], [d.x, d.y + d.h + 1]] : [[d.x - 2, d.y], [d.x + d.w, d.y], [d.x - 3, d.y], [d.x + d.w + 1, d.y]];
          P.towers(cand, tw.slice(k % tw.length).concat(tw), 2);
        });
        P.towers([[gx - 3, yS - 2], [gx + 4, yS - 2], [gx - 3, yS - 3], [gx + 4, yS - 3]], tw, 2);
        paths.forEach(function (pt, pi) {
          const pts = [[gx + 1, S - 1]];
          pt.forEach(function (r) { pts.push([rx(r[0]) + (rs >> 1), rx(r[1]) + (rs >> 1)]); });
          P.route(pts, 3);
        });
        Object.keys(used).forEach(function (k) { const i = +k.split(',')[0], j = +k.split(',')[1]; P.maskRect(rx(i), rx(j), rs, rs); });
        doors.forEach(function (d) { P.maskRect(d.x, d.y, d.w, d.h); });
        P.maskRect(gx, rx(e0[1]) + rs, 3, yS - rx(e0[1]) - rs + 1);
        P.choke(gx, yS, 3, 1, '城門');
        doors.forEach(function (d, k) {
          if (d.toC) P.choke(d.x, d.y, d.w, d.h, '中室門' + (k + 1), { must: false });
          else if (k < 3) P.choke(d.x, d.y, d.w, d.h, '室門' + (k + 1), { must: false });
        });
        doors.forEach(function (d) { P.trap(d.x + (d.v ? (d.x < hx ? -1 : d.w) : 0), d.y + (d.v ? 0 : (d.y < hx ? -1 : d.h))); });
        P.rallyAt(rx(c) + (rs >> 1), rx(c) + rs - 1, '中室');
        P.spendCp(p.cpUse);
        P.redFill(m, m, S - 1 - m, yS);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    module.exports = {
      id: 'R06', name: '護城壕吊橋', minLv: 4,
      desc: '營外水壕一圈,只在南面架吊橋進城門;帥帳在中央高台,登台階梯只在北面,攻方過橋後須沿台下迴廊繞半圈受俯射。無水等級改為乾壕高台與階梯。',
      build: function (opt) {
        const P = new L.Plan('R06', opt), S = P.S, p = P.p;
        const wet = P.caps.water && p.dry !== true;
        const m = wet ? 3 : 1;                               // 外環位置(水壕在 m−2..m−1)
        const F0 = m, F1 = S - 1 - m;                        // 外環
        const wk = p.walk || 3;                              // 迴廊寬
        const K0 = F0 + 1 + wk, K1 = F1 - 1 - wk;            // 內台(或下沉谷地)範圍
        const cx = Math.floor((S - 1) / 2);                  // 南北軸
        const hx = cx - 1, hy = Math.floor((K0 + K1) / 2) - 1;
        const gx = cx - 1;                                   // 城門 x(3 寬)
        const sy = Math.floor((K0 + K1) / 2) - 1;            // 東面登台階梯 y(3 寬)
        if (wet) {
          P.water(F0 - 2, F0 - 2, F1 + 2, F0 - 1, 'lake'); P.water(F0 - 2, F1 + 1, F1 + 2, F1 + 2, 'lake');
          P.water(F0 - 2, F0, F0 - 1, F1, 'lake'); P.water(F1 + 1, F0, F1 + 2, F1, 'lake');
          for (let y = F1 + 1; y <= F1 + 2; y++) for (let x = gx; x < gx + 3; x++) P.put('bridge', x, y);
          P.setH(K0, K0, K1, K1, 2);
          for (let y = sy; y < sy + 3; y++) P.put('stairs', K1 + 1, y);
        } else {
          P.setH(F0, F0, F1, F1, 2);
          P.setH(K0, K0, K1, K1, 0);
          for (let x = gx; x < gx + 3; x++) P.put('stairs', x, F1 + 1);
          for (let y = sy; y < sy + 3; y++) P.put('stairs', K1, y);
        }
        P.gate(gx, F1, false);
        P.ring(F0, F0, F1, F1, null, [[gx, F1, 3, 1]]);
        const hy2 = sy - 1;
        P.put('hq', hx, hy2);
        const tw = P.avail(['tower', 'nutai', 'lianu', 'huojian', 'ponu', 'ztower', 'chuangtai', 'shitai', 'dilou', 'wanglou', 'qtower']);
        P.towers([[hx - 3, hy2], [hx + 5, hy2], [hx - 3, hy2 + 3], [hx + 5, hy2 + 3]], tw, 4);
        const edge = [];
        for (let t = K0 + 6; t + 1 <= K1 - 1; t += 4) { edge.push([K0 + (wet ? 0 : -3), t]); edge.push([K1 - (wet ? 1 : -2), t]); }
        for (let t = K0 + 1; t + 1 <= K1 - 1; t += 4) edge.push([t, K1 - (wet ? 1 : -2)]);
        P.towers(edge, tw.slice(2).concat(tw));
        P.towers([[gx - 2, F1 - 2], [gx - 4, F1 - 2], [gx - 6, F1 - 2]], P.avail(['nutai', 'tower', 'lianu', 'qtower']), 2);
        const wy = F1 - 1 - (wk >> 1), wn = F0 + 1 + (wk >> 1), wxW = F0 + 1 + (wk >> 1), wxE = F1 - 1 - (wk >> 1);
        P.route([[gx + 1, S - 1], [gx + 1, wy], [wxE, wy], [wxE, sy + 1], [hx + 4, sy + 1]], wk);
        P.maskRect(hx + 4, sy, K1 + 2 - hx - 4, 3);
        P.maskRect(hx - 1, hy2 - 1, 6, 6);
        P.choke(gx, F1 + (wet ? 1 : 1), 3, wet ? 2 : 1, wet ? '吊橋' : '登城階梯');
        P.choke(wet ? K1 + 1 : K1, sy, 1, 3, '登台口');
        P.choke(gx, F1, 3, 1, '城門', { must: false });
        P.trap(gx + 3, F1 - 1); P.trap(wxE, wy); P.trap(wxE, sy - 2); P.trap(wxE, sy + 4);
        P.rallyAt(wxE, sy + 1, '登台口');
        P.spendCp(p.cpUse);
        P.redFill(F0, F0, F1, F1);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    module.exports = {
      id: 'R07', name: '外柵誘導', minLv: 5,
      desc: '營城在北、外場在南;兩道斜柵由城門兩側拉到南角成漏斗,把攻勢收束到門前頸口受塔集火;入城後走 U 形谷道到中央帥帳。',
      build: function (opt) {
        const P = new L.Plan('R07', opt), S = P.S, p = P.p;
        const m = 1, a = m + 1, b = S - 2 - m;
        const Fy = p.fy || Math.round(S * 0.62);               // 營城南緣(外環)列
        const c = Math.floor((S - 1) / 2), W = 3;
        const hx = c - 1, hy = Math.max(a + 2, Math.floor((m + Fy) / 2) - 2);
        const xw = Math.max(a + 1, hx - 5 - (p.west != null ? p.west : 6));    // U 形西段 x
        P.setH(m, m, S - 1 - m, Fy, 2);
        P.setH(hx - 1, hy - 1, hx + 4, hy + 4, 0);
        const y1 = Fy - 1 - W;                                 // 第一段(向西)起列
        P.setH(c - 1, y1, c + 1, Fy, 0);                       // 城門 → 北上
        P.setH(xw, y1, c + 1, y1 + W - 1, 0);                  // 向西
        P.setH(xw, hy + 1, xw + W - 1, y1 + W - 1, 0);         // 北上
        P.setH(xw, hy + 1, hx - 1, hy + 3, 0);                 // 向東進谷地
        P.gate(c - 1, Fy, false);
        P.ring(m, m, S - 1 - m, Fy, null, [[c - 1, Fy, 3, 1]]);
        P.put('hq', hx, hy);
        const depth = S - 1 - Fy;
        const armL = [], armR = [];
        for (let d = 1; d <= depth; d++) {
          const y = Fy + d;
          armL.push([c - 2 - d, y]); armR.push([c + 2 + d, y]);
        }
        armL.concat(armR).forEach(function (q) { if (P.inL(q[0], q[1])) P.barrier(q[0], q[1], 'lujiao'); });
        P.barrier(c - 2, Fy + 1, 'lujiao'); P.barrier(c + 2, Fy + 1, 'lujiao');
        const tw = P.avail(['tower', 'nutai', 'lianu', 'huojian', 'ponu', 'ztower', 'chuangtai', 'shitai', 'dilou', 'wanglou', 'qtower']);
        P.towers([[c - 4, Fy - 2], [c + 3, Fy - 2], [c - 6, Fy - 2], [c + 5, Fy - 2]], tw, 4);
        const inner = [];
        for (let d = 4; d + 2 <= depth; d += 3) { inner.push([c - 1 - d, Fy + d + 1]); inner.push([c + d, Fy + d + 1]); }
        P.towers(inner, P.avail(['qiangzhen', 'tower', 'nutai', 'lianu', 'qtower']), 4);
        P.towers([[hx - 3, hy], [hx + 5, hy], [hx + 5, hy + 3], [hx + 1, hy - 3]], tw, 3);
        P.towers([[xw + W + 1, y1 - 3], [xw - 3 < a ? xw + W + 1 : xw - 3, y1 - 6], [c + 3, y1], [xw + W + 1, hy + 5]], tw.slice(2).concat(tw), 3);
        P.route([[c, S - 1], [c, Fy], [c, y1 + 1], [xw + 1, y1 + 1], [xw + 1, hy + 2], [hx, hy + 2]], W);
        for (let d = 1; d <= depth; d++) { const y = Fy + d, x0 = Math.max(0, c - 1 - d), x1 = Math.min(S - 1, c + 1 + d); P.maskRect(x0, y, x1 - x0 + 1, 1); }
        P.maskRect(hx - 1, hy - 1, 6, 6);
        P.choke(c - 1, Fy, 3, 1, '城門頸口');
        P.choke(xw, y1, W, W, '西折');
        P.trap(c, Fy + 2); P.trap(c - 1, Fy + 3); P.trap(c + 1, Fy + 3); P.trap(xw + 1, y1 + 1); P.trap(xw + 1, hy + 4);
        P.rallyAt(c, Fy + 2, '頸口');
        P.spendCp(p.cpUse);
        P.redFill(m, m, S - 1 - m, Fy);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    module.exports = {
      id: 'R08', name: '伏擊口袋', minLv: 5,
      desc: '南牆開寬大的假正門,門後是下沉口袋,四周高台伏塔、地面是陷阱區、死角放誘餌;真出口藏在口袋西北角的窄門,再折回東進帥帳。',
      build: function (opt) {
        const P = new L.Plan('R08', opt), S = P.S, p = P.p;
        const m = 1, a = m + 1, b = S - 2 - m, yS = S - 1 - m, I = b - a + 1;
        const c = Math.floor((S - 1) / 2);
        const pw = p.pw || Math.min(c + 4 - a, Math.max(13, Math.round(I * 0.36)));           // 口袋寬(大土地時封頂,口袋改靠中)
        const px0 = c + 4 - pw;
        const ph = p.ph || Math.max(5, Math.round(I * 0.22));
        const px1 = px0 + pw - 1, py0 = yS - ph;
        const hx = Math.max(px0 + 6, c - 1), hy = Math.max(a + 2, Math.min(py0 - 7, Math.floor((S - 4) / 2) - 2));
        const ex = px0, gx = px1 - 3;
        P.setH(m, m, S - 1 - m, yS, 2);
        P.setH(px0, py0, px1, yS - 1, 0);                          // 口袋
        P.setH(ex, hy + 1, ex + 2, py0 - 1, 0);                  // 出口窄道北上(3 格)
        P.setH(ex, hy + 1, hx - 1, hy + 3, 0);                   // 折向東
        P.setH(hx - 1, hy - 1, hx + 4, hy + 4, 0);               // 谷地
        P.setH(gx - 1, yS, gx + 3, yS, 0);
        P.gate(gx, yS, false);
        P.barrier(gx - 1, yS, 'lujiao'); P.barrier(gx + 3, yS, 'lujiao');
        P.ring(m, m, S - 1 - m, yS, null, [[gx - 1, yS, 5, 1]]);
        P.gate(ex, py0 - 1, false);
        P.put('hq', hx, hy);
        const tw = P.avail(['tower', 'nutai', 'lianu', 'huojian', 'xunyan', 'ponu', 'ztower', 'chuangtai', 'shitai', 'dilou', 'wanglou', 'qtower']);
        P.towers([[gx + 4, yS - 3], [gx - 3, yS - 2], [gx + 4, yS - 5]], P.avail(['tower', 'nutai', 'lianu', 'qtower']), 2);
        const rim = [];
        for (let x = px0 + 4; x + 1 < px1; x += 4) rim.push([x, py0 - 2]);
        for (let y = py0; y + 1 < yS - 1 && px0 > a + 3; y += 4) rim.push([px0 - 3, y]);
        for (let y = py0; y + 1 < yS - 3; y += 4) rim.push([px1 + 1, y]);
        P.towers(rim, tw);
        P.towers([[ex + 3, py0 - 3], [ex + 3, py0 - 6], [ex + 3, hy + 4]], tw.slice(3).concat(tw), 2);
        P.towers([[hx - 3, hy - 3], [hx + 5, hy], [hx + 5, hy + 3], [hx + 1, hy - 3]], tw, 3);
        P.fillSolids([[px0, yS - 2], [px0 + 2, yS - 2], [px0, yS - 4]], ['fakecamp', 'tent', 'banner']);
        P.route([[gx + 1, S - 1], [gx + 1, yS - 1], [ex + 1, py0], [ex + 1, hy + 2], [hx, hy + 2]], 3);
        P.maskRect(px0, py0, px1 - px0 + 1, ph);                     // 口袋整區(殺傷區)
        P.maskRect(hx - 1, hy - 1, 6, 6);
        P.choke(gx, yS, 3, 1, '假正門');
        P.choke(ex, py0 - 1, 3, 1, '出口窄門');
        for (let k = 0; k < 6; k++) P.trap(gx - 2 - k * 2, yS - 2 - (k % 3));
        P.trap(ex + 1, py0); P.trap(ex + 2, py0 + 1);
        P.rallyAt(ex + 1, py0, '口袋出口');
        P.spendCp(p.cpUse);
        P.redFill(m, m, S - 1 - m, yS);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    function small(P) {
      const S = P.S, x0 = (S - 12) >> 1, y0 = (S - 14) >> 1;      // 外郭左上(局部);內部 x0+1..x0+10, y0+1..y0+12
      const X = function (dx) { return x0 + dx; }, Y = function (dy) { return y0 + dy; };
      P.put('hq', X(3), Y(3));
      const tw = P.avail(['tower', 'nutai']);
      P.put(tw[0] || 'tent', X(1), Y(3)) || P.put('tent', X(1), Y(3));            // 西側(帥帳旁)
      P.put(tw[0] || 'tent', X(7), Y(5)) || P.put('tent', X(7), Y(5));            // 東側(帥帳旁)
      P.put(tw[0] || 'tent', X(1), Y(7)) || P.put('tent', X(1), Y(7));            // 西下(內門旁)
      P.blocks(X(1), Y(1), X(8), Y(2), ['tent', 'wagon', 'granary']);
      P.blocks(X(1), Y(5), X(2), Y(6), ['tent', 'wagon', 'granary']);
      P.blocks(X(7), Y(3), X(8), Y(4), ['wagon', 'tent', 'granary']);
      P.blocks(X(7), Y(7), X(8), Y(8), ['wagon', 'tent', 'granary']);
      P.blocks(X(1), Y(9), X(2), Y(10), ['wagon', 'tent', 'granary']);
      P.blocks(X(1), Y(11), X(10), Y(12), ['wagon', 'tent', 'granary', 'muster', 'fakecamp']);
      P.gate(X(3), Y(8), false);
      P.putAt('qtower', [[X(6), Y(8)]]) || P.put('wall', X(6), Y(8));
      const door = !P.p.open && P.caps.gate >= 2;
      P.ring(x0, y0, x0 + 11, y0 + 13, null, [[X(9), y0, door ? 3 : 2, 1]]);
      if (door) P.gate(X(9), y0, false);
      P.thick(x0 + 11, Y(7), x0 + 11, Y(10), 1, 0, 1);
      P.towers([[X(8), y0 - 2], [X(11), y0 - 2], [X(6), y0 - 2]], P.avail(['qtower', 'wanglou']), 3);
      P.route([[X(9) + 0.5 | 0, 0], [X(9), Y(1)], [X(9), Y(9)], [X(4), Y(9)], [X(4), Y(7)]], 3);
      P.maskRect(X(9), Y(1), 2, 10);                 // 東迴廊
      P.maskRect(X(3), Y(9), 8, 2);                  // 南迴廊
      P.maskRect(X(3), Y(7), 4, 2);                  // 帥帳口
      P.maskRect(X(9) - 1, y0, 4, 1);
      P.choke(X(9), y0, door ? 3 : 2, 1, door ? '外郭門' : '外郭開口');
      P.choke(X(3), Y(8), 3, 1, '內門');
      P.choke(X(3), Y(7), 4, 1, '帥帳口');
      P.trap(X(9), Y(9)); P.trap(X(6), Y(10)); P.trap(X(10), Y(4));
      P.rallyAt(X(9), Y(9), '東南轉角');
      P.spendCp(P.p.cpUse);
      P.redFill(x0, y0, x0 + 11, y0 + 13);
    }

    function big(P) {
      const S = P.S, p = P.p;
      const m = 1, F0 = m, F1 = S - 1 - m;
      const c = Math.floor((S - 1) / 2), gx = c - 1;
      const hx = c - 1, hy = c - 1;                              // 帥帳置中
      const K0 = hx - 5, K1 = hx + 8;                            // 內城土台圈(宮城 8×8 + 內庭 2 + 土台 1)
      const ey = hy;                                             // 東內門 y(3 格)
      P.setH(F0, F0, F1, F0, 2); P.setH(F0, F1, F1, F1, 2); P.setH(F0, F0, F0, F1, 2); P.setH(F1, F0, F1, F1, 2);
      P.setH(gx, F1, gx + 2, F1, 0);
      P.setH(K0, K0, K1, K0, 2); P.setH(K0, K1, K1, K1, 2); P.setH(K0, K0, K0, K1, 2); P.setH(K1, K0, K1, K1, 2);
      P.setH(K1, ey, K1, ey + 2, 0);
      P.gate(gx, F1, false);
      P.ring(F0, F0, F1, F1, null, [[gx, F1, 3, 1]]);
      P.gate(K1, ey, true);
      P.ring(K0, K0, K1, K1, null, [[K1, ey, 1, 3]]);
      P.put('hq', hx, hy);
      const tw = P.avail(['tower', 'nutai', 'lianu', 'huojian', 'ponu', 'ztower', 'chuangtai', 'shitai', 'dilou', 'xunyan']);
      P.blocks(hx + 1, hy - 2, hx + 5, hy - 1, tw.concat(['tent', 'wagon', 'granary']));    // 北側(西北角 3×2 留作宮城口,需與帥帳正交相鄰)
      P.blocks(hx - 2, hy + 4, hx + 5, hy + 5, tw.slice(2).concat(tw).concat(['tent', 'wagon', 'granary']));
      P.blocks(hx + 4, hy, hx + 5, hy + 3, tw.slice(4).concat(tw).concat(['tent', 'wagon', 'granary']));
      P.blocks(hx - 2, hy, hx - 1, hy + 3, ['tent', 'wagon', 'granary']);
      const gt = P.avail(['nutai', 'tower', 'lianu', 'ponu', 'qtower']);
      P.towers([[gx - 3, F1 - 2], [gx + 4, F1 - 2], [gx - 5, F1 - 2]], gt, 2);
      P.towers([[K1 + 2, ey - 3], [K1 + 2, ey + 4], [K1 + 3, ey - 5]], gt, 2);
      const mid = [];
      for (let t = K1 + 2; t + 1 < F1 - 1; t += 4) for (let u = K1 + 2; u + 1 < F1 - 1; u += 4) mid.push([t, u]);
      P.towers(mid, tw, 4);
      P.route([[gx + 1, S - 1], [gx + 1, F1 - 1], [K1 + 1, ey + 1], [K1 - 1, ey + 1]], 3);
      P.maskRect(gx, K1 + 1, F1 - gx, F1 - K1 - 1);          // 迴廊東南象限
      P.maskRect(K1 + 1, ey - 1, F1 - K1 - 1, K1 - ey + 1);
      P.maskRect(K0 + 1, K0 + 1, K1 - K0 - 1, 2);            // 內庭北
      P.maskRect(K0 + 1, K1 - 2, K1 - K0 - 1, 2);            // 內庭南
      P.maskRect(K1 - 2, K0 + 1, 2, K1 - K0 - 1);            // 內庭東
      P.maskRect(K0 + 1, K0 + 1, 2, K1 - K0 - 1);            // 內庭西
      P.maskRect(hx - 2, hy - 2, 3, 2);                      // 宮城口(西北角)
      P.choke(gx, F1, 3, 1, '外郭南門');
      P.choke(K1, ey, 1, 3, '內城東門');
      P.choke(hx - 2, hy - 2, 3, 2, '宮城西北口');
      P.trap(gx + 3, F1 - 1); P.trap(K1 + 1, ey + 3); P.trap(K1 - 1, ey - 2); P.trap(K0 + 1, hy);
      P.rallyAt(K1 - 1, ey + 1, '東內門內');
      P.spendCp(P.p.cpUse);
      P.redFill(F0, F0, F1, F1);
    }

    module.exports = {
      id: 'R09', name: '外郭內城', minLv: 1,
      desc: '外郭一圈、內城一圈(大型再加宮城);入口與內門錯開,攻方須在兩圈之間的迴廊繞行,內城內再繞宮城到背面的口。小型版是 Lv1 新手陣。',
      build: function (opt) {
        const P = new L.Plan('R09', opt);
        if (P.p.small === true || P.S < 30) small(P); else big(P);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    module.exports = {
      id: 'R10', name: '斜坡殺戮道', minLv: 4,
      desc: '進門即之字坡道:下段向東、斜坡上中段折回向西、再上斜坡登頂到帥帳;上下段之間隔著連續塔列,不能中途爬上,全程被兩側塔夾射。',
      build: function (opt) {
        const P = new L.Plan('R10', opt), S = P.S, p = P.p;
        const m = 1, a = m + 1, b = S - 2 - m, yS = S - 1 - m;
        const c = Math.floor((S - 1) / 2);
        const lift = p.lift != null ? p.lift : Math.max(0, yS - 14 - Math.floor((S - 4) / 2));   // 大土地時整組坡道上移,城門到下段之間是一條入城甬道
        const yB = yS - lift;
        const hx = c - 1, hy = yB - 14;
        const D = Math.min(hy - m, (S - 1) - (hy + 3) - m) + 4;
        const lim = 2 * D + 12 - 4;
        const legLen = Math.max(5, Math.min(b - c, Math.floor((lim - 14 - lift) / 2), p.leg || 99));
        const xE = c + legLen;                                  // 下段 / 中段的東端
        const r1 = yB - 3, sep = yB - 5, r2 = yB - 8, top = yB - 10;   // 下段起列、隔列、中段起列、頂台緣列
        P.setH(m, m, S - 1 - m, yS, 2);
        P.setH(c - 1, yS, c + 1, yS, 0);                        // 城門處
        P.setH(c - 1, r1, xE, yB - 1, 0);                       // 下段
        if (lift > 0) P.setH(c - 1, yB, c + 1, yS - 1, 0);      // 入城甬道
        P.setH(c, r2, xE, sep + 1, 1);                          // 中段 + 隔列 + 東端平台
        P.gate(c - 1, yS, false);
        P.ring(m, m, S - 1 - m, yS, null, [[c - 1, yS, 3, 1]]);
        P.put('ramp', xE - 2, r1, 1); P.put('ramp', c, r2, 1);
        P.put('hq', hx, hy);
        const tw = P.avail(['tower', 'nutai', 'lianu', 'huojian', 'ponu', 'ztower', 'dilou', 'chuangtai', 'shitai']);
        const cheap = ['tent', 'wagon', 'granary', 'muster', 'fakecamp'];
        P.blocks(c, sep, xE - 3, sep + 1, tw.concat(cheap), ['qtower', 'wanglou', 'banner', 'fengsui', 'wall']);
        P.blocks(c + 3, top, xE + 1 > b ? b : xE + 1, top + 1, tw.slice(1).concat(tw).concat(cheap), ['qtower', 'wanglou', 'banner', 'fengsui', 'wall']);
        P.towers([[hx - 3, hy], [hx + 5, hy], [hx - 3, hy + 3], [hx + 1, hy - 3], [hx - 3, hy - 3]], P.avail(['tower', 'nutai', 'lianu', 'ztower', 'qtower']), 3);
        const gt = P.avail(['nutai', 'tower', 'lianu', 'ponu', 'qtower']);
        P.towers(lift >= 3 ? [[c - 3, yS - 2], [c + 2, yS - 2], [c - 5, yS - 2]] : [[c - 3, yS - 2], [c - 5, yS - 2], [c - 3, yS - 4]], gt, 2);
        P.route([[c, S - 1], [c, r1 + 1], [xE - 1, r1 + 1], [xE - 1, r2 + 1], [c + 1, r2 + 1], [c + 1, hy + 4]], 3);
        P.maskRect(xE - 2, r2, 3, yB - r2);                      // 東端平台與斜坡
        if (lift > 0) P.maskRect(c - 1, yB, 3, lift);
        P.maskRect(hx - 1, hy - 1, 6, 6);
        P.maskRect(c - 1, r1, 1, 3);
        P.choke(c - 1, yS, 3, 1, '城門');
        P.choke(xE - 2, sep, 3, 3, '東坡');
        P.choke(c, r2 - 2, 3, 2, '登頂坡');
        P.trap(c + 2, r1 + 1); P.trap(xE - 1, r1 + 2); P.trap(xE - 2, r2 + 1); P.trap(c + 2, r2 + 1);
        P.rallyAt(xE - 1, r2 + 1, '中段東端');
        P.spendCp(p.cpUse);
        P.redFill(m, m, S - 1 - m, yS);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    module.exports = {
      id: 'R11', name: '髮夾巷', minLv: 1,
      desc: '南牆東段一道城門,門內下巷向西、折角北上、上巷向東走到帥帳;兩巷以實心隔開。只折一次,所以破牆也省不了多少路,機器人會乖乖打門。',
      build: function (opt) {
        const P = new L.Plan('R11', opt), S = P.S;
        const rows = [
          '##############',
          '#oooooooooooo#',
          '#oooooooooooo#',
          '#ttooTTHHHHoo#',
          '#ttooTTHHHHoo#',
          '#,,,,,,HHHHoo#',
          '#,,,,,,HHHHoo#',
          '#,,ooTTooooTT#',
          '#,,ooTTooooTT#',
          '#,,,,,,,,,,,,#',
          '#,,,,,,,,,,,,#',
          '#########GGG##'
        ];
        const ox = (S - 14) >> 1, oy = (S - 12) >> 1;
        P.layout(rows, ox, oy, { chokes: [[9, 11, 3, 1, '城門'], [1, 7, 2, 2, '折角'], [3, 5, 4, 2, '帥帳口']] });
        P.thick(ox, oy + 4, ox, oy + 10, -1, 0, 1);       // 折角西牆加厚(框外一層)
        P.trap(ox + 6, oy + 9); P.trap(ox + 2, oy + 8); P.trap(ox + 5, oy + 5);
        P.rallyAt(ox + 6, oy + 9, '下巷');
        P.route([[ox + 10, S - 1], [ox + 10, oy + 11]], 3);             // 門前進路(補塔不可擋)
        P.towers([[ox + 8, oy + 12], [ox + 4, oy + 12], [ox + 12, oy + 12]], P.avail(['qtower', 'wanglou']), 3);
        P.spendCp(P.p.cpUse);
        P.redFill(ox, oy, ox + 13, oy + 11);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  (function () {
    const L = LIB, module = { exports: null };
    module.exports = {
      id: 'R12', name: '環廊護城', minLv: 1,
      desc: '南牆正中一道城門,帥帳居中,三面實心只露北面;環廊繞帥帳一圈,攻方須走西路或東路繞到北面才打得到帥帳。北牆加厚。',
      build: function (opt) {
        const P = new L.Plan('R12', opt), S = P.S;
        const rows = [
          '##############',
          '#,,,,,,,,,,,,#',
          '#,,,,,,,,,,,,#',
          '#,,TTHHHHTT,,#',
          '#,,TTHHHHTT,,#',
          '#,,ooHHHHoo,,#',
          '#,,ooHHHHoo,,#',
          '#,,ooTToooo,,#',
          '#,,ooTToooo,,#',
          '#,,,,,,,,,,,,#',
          '#,,,,,,,,,,,,#',
          '######GGG#####'
        ];
        const ox = (S - 14) >> 1, oy = (S - 12) >> 1;
        P.layout(rows, ox, oy, { chokes: [[6, 11, 3, 1, '城門'], [5, 1, 4, 2, '帥帳北面']] });
        P.thick(ox, oy, ox + 13, oy, 0, -1, 1);          // 北牆加厚(框外一層)
        P.trap(ox + 7, oy + 9); P.trap(ox + 2, oy + 6); P.trap(ox + 11, oy + 6); P.trap(ox + 6, oy + 1);
        P.rallyAt(ox + 7, oy + 9, '南廳');
        P.route([[ox + 7, S - 1], [ox + 7, oy + 11]], 3);              // 門前進路(補塔不可擋)
        P.towers([[ox + 4, oy + 12], [ox + 10, oy + 12], [ox + 2, oy + 12]], P.avail(['qtower', 'wanglou']), 3);
        P.spendCp(P.p.cpUse);
        P.redFill(ox, oy, ox + 13, oy + 11);
        return P;
      }
    };
    ARCHS[module.exports.id] = module.exports;
  })();
  return { L: LIB, ARCHS: ARCHS };
})();
