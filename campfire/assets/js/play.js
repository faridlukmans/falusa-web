(function () {
  'use strict';

  var canvas = document.getElementById('game');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  /* ---------------------------------------------------------------
     Konstanta dunia
     --------------------------------------------------------------- */

  var WORLD = 2600;
  var CX = WORLD / 2;
  var CY = WORLD / 2;
  var WIN_NIGHTS = 10;
  var BEST_KEY = 'campfire-best';
  var P_SPEED = 205;

  var view = { w: 0, h: 0, dpr: 1 };

  /* ---------------------------------------------------------------
     Util
     --------------------------------------------------------------- */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function dist(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function readBest() {
    var n = 0;
    try { n = parseInt(localStorage.getItem(BEST_KEY) || '0', 10); } catch (e) { n = 0; }
    return isFinite(n) && n > 0 ? n : 1;
  }

  function writeBest(n) {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------
     DOM
     --------------------------------------------------------------- */

  var el = {
    night: document.getElementById('hudNight'),
    phase: document.getElementById('hudPhase'),
    phaseChip: document.getElementById('hudPhaseChip'),
    timer: document.getElementById('hudTimer'),
    best: document.getElementById('hudBest'),
    barFuel: document.getElementById('barFuel'),
    valFuel: document.getElementById('valFuel'),
    barHp: document.getElementById('barHp'),
    valHp: document.getElementById('valHp'),
    barWood: document.getElementById('barWood'),
    valWood: document.getElementById('valWood'),
    toast: document.getElementById('toast'),
    hint: document.getElementById('hudHint'),
    start: document.getElementById('startOverlay'),
    pause: document.getElementById('pauseOverlay'),
    end: document.getElementById('endOverlay'),
    endEyebrow: document.getElementById('endEyebrow'),
    endTitle: document.getElementById('endTitle'),
    endText: document.getElementById('endText'),
    endNights: document.getElementById('endNights'),
    endWood: document.getElementById('endWood'),
    endBest: document.getElementById('endBest'),
    startBtn: document.getElementById('startBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    quitBtn: document.getElementById('quitBtn'),
    againBtn: document.getElementById('againBtn')
  };

  /* ---------------------------------------------------------------
     Input
     --------------------------------------------------------------- */

  var keys = { up: false, down: false, left: false, right: false, action: false };

  var KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'action', KeyE: 'action', Enter: 'action'
  };

  window.addEventListener('keydown', function (e) {
    var k = KEYMAP[e.code];
    if (!k) {
      if (e.code === 'Escape' && game && game.state === 'play') togglePause(true);
      return;
    }
    e.preventDefault();
    keys[k] = true;
    hideHint();
  });

  window.addEventListener('keyup', function (e) {
    var k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    keys[k] = false;
  });

  window.addEventListener('blur', function () {
    keys.up = keys.down = keys.left = keys.right = keys.action = false;
  });

  function bindTouch() {
    var buttons = document.querySelectorAll('.tbtn[data-key]');
    Array.prototype.forEach.call(buttons, function (btn) {
      var key = btn.getAttribute('data-key');

      var press = function (e) {
        e.preventDefault();
        keys[key] = true;
        hideHint();
        btn.classList.add('pressed');
      };

      var release = function (e) {
        e.preventDefault();
        keys[key] = false;
        btn.classList.remove('pressed');
      };

      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  }

  /* ---------------------------------------------------------------
     Ukuran canvas
     --------------------------------------------------------------- */

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = canvas.clientWidth || window.innerWidth;
    view.h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(view.w * view.dpr);
    canvas.height = Math.floor(view.h * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

  /* ---------------------------------------------------------------
     State game
     --------------------------------------------------------------- */

  var game = null;
  var toastTimer = 0;
  var hudAcc = 0;

  function makeTrees() {
    var rnd = mulberry32(20261101);
    var trees = [];
    var tries = 0;

    while (trees.length < 105 && tries < 5000) {
      tries += 1;
      var x = rnd() * WORLD;
      var y = rnd() * WORLD;
      var d = dist(x, y, CX, CY);

      if (d < 220 || d > 1240) continue;

      var ok = true;
      for (var i = 0; i < trees.length; i += 1) {
        if (dist(trees[i].x, trees[i].y, x, y) < 76) { ok = false; break; }
      }
      if (!ok) continue;

      trees.push({
        x: x,
        y: y,
        size: 0.82 + rnd() * 0.5,
        chops: 3,
        shake: 0,
        down: 0,
        respawn: 0
      });
    }

    return trees;
  }

  function makeGround() {
    var rnd = mulberry32(77003311);
    var blobs = [];
    for (var i = 0; i < 220; i += 1) {
      blobs.push({
        x: rnd() * WORLD,
        y: rnd() * WORLD,
        r: 26 + rnd() * 90,
        tone: rnd()
      });
    }
    return blobs;
  }

  function reset() {
    game = {
      state: 'menu',
      t: 0,
      night: 1,
      phase: 'day',
      phaseT: 30,
      woodTotal: 0,
      trees: makeTrees(),
      ground: makeGround(),
      wolves: [],
      parts: [],
      player: {
        x: CX,
        y: CY + 150,
        vx: 0,
        vy: 0,
        hp: 100,
        wood: 0,
        maxWood: 12,
        facing: -Math.PI / 2,
        hitCd: 0,
        feedCd: 0,
        chopT: 0
      },
      fire: { x: CX, y: CY, fuel: 80 },
      cam: { x: 0, y: 0 },
      emberAcc: 0
    };

    var c = camTarget();
    game.cam.x = c.x;
    game.cam.y = c.y;

    updateHud(true);
  }

  function camTarget() {
    var p = game.player;
    var x = view.w >= WORLD ? (WORLD - view.w) / 2 : clamp(p.x - view.w / 2, 0, WORLD - view.w);
    var y = view.h >= WORLD ? (WORLD - view.h) / 2 : clamp(p.y - view.h / 2, 0, WORLD - view.h);
    return { x: x, y: y };
  }

  /* ---------------------------------------------------------------
     Toast
     --------------------------------------------------------------- */

  function toast(text, kind) {
    if (!el.toast) return;
    el.toast.textContent = text;
    el.toast.className = 'toast show' + (kind ? ' ' + kind : '');
    toastTimer = 2.2;
  }

  function hideHint() {
    if (el.hint && !el.hint.classList.contains('hide')) el.hint.classList.add('hide');
  }

  /* ---------------------------------------------------------------
     Partikel
     --------------------------------------------------------------- */

  function addPart(x, y, vx, vy, life, color, size, gravity) {
    game.parts.push({
      x: x, y: y,
      vx: vx, vy: vy,
      life: life,
      max: life,
      color: color,
      size: size,
      g: gravity || 0
    });
  }

  function burst(x, y, count, color, spread) {
    for (var i = 0; i < count; i += 1) {
      var a = Math.random() * Math.PI * 2;
      var s = 20 + Math.random() * (spread || 70);
      addPart(x, y, Math.cos(a) * s, Math.sin(a) * s - 20, 0.4 + Math.random() * 0.4, color, 2 + Math.random() * 2, 180);
    }
  }

  /* ---------------------------------------------------------------
     Aksi gameplay
     --------------------------------------------------------------- */

  function damagePlayer(amount) {
    var p = game.player;
    p.hp = Math.max(0, p.hp - amount);
    if (p.hp <= 0 && game.state === 'play') endGame(false);
  }

  function nearestTree() {
    var p = game.player;
    var best = null;
    var bestD = 70;

    for (var i = 0; i < game.trees.length; i += 1) {
      var t = game.trees[i];
      if (t.down > 0) continue;
      var d = dist(p.x, p.y, t.x, t.y);
      if (d < bestD) { bestD = d; best = t; }
    }

    return best;
  }

  function nearestWolf() {
    var p = game.player;
    var best = null;
    var bestD = 82;

    for (var i = 0; i < game.wolves.length; i += 1) {
      var w = game.wolves[i];
      var d = dist(p.x, p.y, w.x, w.y);
      if (d < bestD) { bestD = d; best = w; }
    }

    return best;
  }

  function spawnWolves() {
    var count = Math.min(2 + game.night, 11);

    for (var i = 0; i < count; i += 1) {
      var a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      var r = 760 + Math.random() * 260;
      game.wolves.push({
        x: CX + Math.cos(a) * r,
        y: CY + Math.sin(a) * r,
        hp: 44,
        hitFlash: 0,
        atkCd: 0.6,
        wobble: Math.random() * Math.PI * 2
      });
    }
  }

  function startNight() {
    game.phase = 'night';
    game.phaseT = Math.min(34, 18 + game.night * 1.6);
    spawnWolves();
    toast('Malam ' + game.night + ' — serigala datang', 'warn');
  }

  function startDay() {
    game.phase = 'day';
    game.night += 1;
    game.wolves = [];

    if (game.night > WIN_NIGHTS) {
      endGame(true);
      return;
    }

    game.phaseT = 26;
    game.fire.fuel = Math.min(100, game.fire.fuel + 8);
    toast('Pagi. Bertahan sampai malam ' + game.night, '');
  }

  function endGame(win) {
    game.state = 'over';
    game.wolves = [];

    var best = readBest();
    var reached = win ? WIN_NIGHTS : Math.max(1, game.night - (game.phase === 'day' ? 1 : 0));
    if (reached < 1) reached = 1;
    if (reached > best) { best = reached; writeBest(best); }

    if (el.endEyebrow) el.endEyebrow.textContent = win ? 'Api masih menyala' : 'Api padam';
    if (el.endTitle) el.endTitle.textContent = win ? 'Kamu bertahan ' + WIN_NIGHTS + ' malam' : 'Kamu tidak bertahan';
    if (el.endText) {
      el.endText.textContent = win
        ? 'Prototipe selesai. Mekanik inti sudah jalan — sekarang saatnya menambah konten, bukan token.'
        : 'Dingin, lapar, dan serigala terlalu banyak. Coba lagi: kumpulkan kayu lebih awal sebelum malam tiba.';
    }
    if (el.endNights) el.endNights.textContent = String(reached);
    if (el.endWood) el.endWood.textContent = String(game.woodTotal);
    if (el.endBest) el.endBest.textContent = String(best);
    if (el.best) el.best.textContent = String(best);

    if (el.end) el.end.classList.add('show');
  }

  /* ---------------------------------------------------------------
     Update
     --------------------------------------------------------------- */

  function update(dt) {
    var g = game;
    var p = g.player;

    g.t += dt;

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0 && el.toast) el.toast.classList.remove('show');
    }

    /* Gerak */
    var mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);

    if (mx !== 0 || my !== 0) {
      var len = Math.sqrt(mx * mx + my * my);
      p.vx = (mx / len) * P_SPEED;
      p.vy = (my / len) * P_SPEED;
      p.facing = Math.atan2(p.vy, p.vx);
    } else {
      p.vx *= 0.8;
      p.vy *= 0.8;
    }

    p.x = clamp(p.x + p.vx * dt, 40, WORLD - 40);
    p.y = clamp(p.y + p.vy * dt, 40, WORLD - 40);

    p.hitCd = Math.max(0, p.hitCd - dt);
    p.feedCd = Math.max(0, p.feedCd - dt);

    /* Interaksi */
    var wolf = nearestWolf();
    var nearFire = dist(p.x, p.y, g.fire.x, g.fire.y) < 98;

    if (keys.action) {
      if (wolf) {
        if (p.hitCd <= 0) {
          wolf.hp -= 26;
          wolf.hitFlash = 1;
          p.hitCd = 0.4;
          burst(wolf.x, wolf.y, 5, '#ff6b6b', 50);
        }
      } else if (nearFire && p.wood > 0) {
        if (p.feedCd <= 0) {
          p.wood -= 1;
          g.fire.fuel = Math.min(100, g.fire.fuel + 10);
          p.feedCd = 0.2;
          burst(g.fire.x, g.fire.y - 6, 4, '#ffb86b', 45);
        }
      } else {
        var tree = nearestTree();

        if (tree) {
          if (p.wood >= p.maxWood) {
            if (toastTimer <= 0) toast('Kayu penuh — beri ke api dulu', 'warn');
            p.chopT = 0;
          } else {
            p.chopT += dt;
            tree.shake = 0.22;

            if (p.chopT >= 0.5) {
              p.chopT = 0;
              tree.chops -= 1;
              p.wood += 1;
              g.woodTotal += 1;
              burst(tree.x, tree.y - 20 * tree.size, 4, '#c89b6a', 40);

              if (tree.chops <= 0) {
                tree.down = 1;
                tree.respawn = 24;
                burst(tree.x, tree.y - 12, 10, '#276143', 90);
              }
            }
          }
        } else {
          p.chopT = 0;
        }
      }
    } else {
      p.chopT = 0;
    }

    /* Pohon */
    for (var i = 0; i < g.trees.length; i += 1) {
      var t = g.trees[i];
      if (t.shake > 0) t.shake = Math.max(0, t.shake - dt);
      if (t.down > 0) {
        t.respawn -= dt;
        if (t.respawn <= 0) {
          t.down = 0;
          t.chops = 3;
          t.shake = 0;
        }
      }
    }

    /* Api */
    var drain = (g.phase === 'night' ? 2.2 : 0.85) + g.night * 0.05;
    g.fire.fuel = Math.max(0, g.fire.fuel - drain * dt);

    /* Suhu */
    if (g.fire.fuel <= 0) {
      damagePlayer(4 * dt);
    } else if (g.phase === 'night' && dist(p.x, p.y, g.fire.x, g.fire.y) > 340) {
      damagePlayer(2.2 * dt);
    }

    if (g.phase === 'day' && p.hp < 100) {
      p.hp = Math.min(100, p.hp + 1.3 * dt);
    }

    /* Fase */
    g.phaseT -= dt;
    if (g.phaseT <= 0) {
      if (g.phase === 'day') startNight();
      else startDay();
      if (!game || game.state !== 'play') return;
    }

    /* Serigala */
    for (var w = g.wolves.length - 1; w >= 0; w -= 1) {
      var wo = g.wolves[w];
      wo.wobble += dt * 6;
      wo.hitFlash = Math.max(0, wo.hitFlash - dt * 4);

      var toPlayer = dist(wo.x, wo.y, p.x, p.y);
      var tx = g.fire.x;
      var ty = g.fire.y;
      var reach = 36;

      if (toPlayer < 170) {
        tx = p.x;
        ty = p.y;
        reach = 28;
      }

      var ang = Math.atan2(ty - wo.y, tx - wo.x);
      var sp = Math.min(185, 96 + g.night * 5);
      wo.x += Math.cos(ang) * sp * dt;
      wo.y += Math.sin(ang) * sp * dt;

      var targetDist = dist(wo.x, wo.y, tx, ty);
      if (targetDist <= reach) {
        wo.atkCd -= dt;
        if (wo.atkCd <= 0) {
          wo.atkCd = 0.55;
          if (toPlayer < 170) damagePlayer(6);
          else g.fire.fuel = Math.max(0, g.fire.fuel - 2.2);
        }
      }

      if (wo.hp <= 0) {
        burst(wo.x, wo.y, 12, '#8b1f1f', 100);
        g.wolves.splice(w, 1);
      }
    }

    /* Partikel */
    for (var pi = g.parts.length - 1; pi >= 0; pi -= 1) {
      var pt = g.parts[pi];
      pt.life -= dt;
      if (pt.life <= 0) { g.parts.splice(pi, 1); continue; }
      pt.vy += pt.g * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }

    /* Ember dari api */
    g.emberAcc += dt;
    var emberRate = 0.11;
    while (g.emberAcc > emberRate) {
      g.emberAcc -= emberRate;
      if (g.fire.fuel > 0) {
        addPart(
          g.fire.x + (Math.random() * 22 - 11),
          g.fire.y - 6,
          Math.random() * 26 - 13,
          -30 - Math.random() * 45,
          0.9 + Math.random() * 0.8,
          Math.random() > 0.4 ? '#ffb86b' : '#ff8a3d',
          1.5 + Math.random() * 1.6,
          -12
        );
      }
    }

    /* Kamera */
    var want = camTarget();
    var k = Math.min(1, dt * 9);
    g.cam.x += (want.x - g.cam.x) * k;
    g.cam.y += (want.y - g.cam.y) * k;

    updateHud(false, dt);
  }

  /* ---------------------------------------------------------------
     HUD
     --------------------------------------------------------------- */

  function updateHud(force, dt) {
    if (!game) return;

    if (!force) {
      hudAcc += dt || 0;
      if (hudAcc < 0.1) return;
      hudAcc = 0;
    }

    var p = game.player;
    var fuelPct = Math.round((game.fire.fuel / 100) * 100);
    var hpPct = Math.round((p.hp / 100) * 100);

    if (el.night) el.night.textContent = String(Math.min(game.night, WIN_NIGHTS));
    if (el.phase) el.phase.textContent = game.phase === 'night' ? 'Malam' : 'Siang';
    if (el.phaseChip) el.phaseChip.classList.toggle('night', game.phase === 'night');
    if (el.timer) el.timer.textContent = Math.max(0, Math.ceil(game.phaseT)) + 's';
    if (el.best) el.best.textContent = String(readBest());

    if (el.barFuel) {
      el.barFuel.style.width = fuelPct + '%';
      el.barFuel.classList.toggle('low', fuelPct <= 25);
    }
    if (el.valFuel) el.valFuel.textContent = fuelPct + '%';

    if (el.barHp) {
      el.barHp.style.width = hpPct + '%';
      el.barHp.classList.toggle('low', hpPct <= 30);
    }
    if (el.valHp) el.valHp.textContent = String(Math.ceil(p.hp));

    if (el.barWood) el.barWood.style.width = ((p.wood / p.maxWood) * 100) + '%';
    if (el.valWood) el.valWood.textContent = p.wood + ' / ' + p.maxWood;
  }

  /* ---------------------------------------------------------------
     Render
     --------------------------------------------------------------- */

  function tri(x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x - w / 2, y);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround() {
    var g = game;
    var x0 = g.cam.x - 60;
    var y0 = g.cam.y - 60;
    var x1 = g.cam.x + view.w + 60;
    var y1 = g.cam.y + view.h + 60;

    ctx.fillStyle = '#121d14';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    for (var i = 0; i < g.ground.length; i += 1) {
      var b = g.ground[i];
      if (b.x + b.r < x0 || b.x - b.r > x1 || b.y + b.r < y0 || b.y - b.r > y1) continue;

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.tone > 0.66
        ? 'rgba(28, 52, 32, 0.55)'
        : (b.tone > 0.33 ? 'rgba(16, 34, 21, 0.7)' : 'rgba(40, 58, 36, 0.35)');
      ctx.fill();
    }

    /* Lingkaran tanah terbuka di sekitar api */
    ctx.beginPath();
    ctx.arc(CX, CY, 200, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(52, 38, 24, 0.35)';
    ctx.fill();
  }

  function drawTree(t) {
    var s = t.size;

    if (t.down > 0) {
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 11 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#3a2a1c';
      ctx.fill();
      return;
    }

    var shake = t.shake > 0 ? Math.sin(game.t * 42) * t.shake * 14 : 0;

    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 3, 20 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fill();

    ctx.fillStyle = '#4a3524';
    ctx.fillRect(t.x - 3.5 * s + shake * 0.35, t.y - 20 * s, 7 * s, 22 * s);

    ctx.fillStyle = '#14361f';
    tri(t.x + shake * 0.7, t.y - 10 * s, 54 * s, 46 * s);

    ctx.fillStyle = '#1c4d2e';
    tri(t.x + shake * 0.9, t.y - 30 * s, 44 * s, 40 * s);

    ctx.fillStyle = '#276143';
    tri(t.x + shake, t.y - 50 * s, 32 * s, 34 * s);
  }

  function drawFire() {
    var f = game.fire;
    var t = game.t;

    var glowR = 120 + f.fuel * 1.7;
    var grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, glowR);
    if (f.fuel > 0) {
      grd.addColorStop(0, 'rgba(255, 176, 96, 0.32)');
      grd.addColorStop(0.45, 'rgba(255, 122, 48, 0.13)');
      grd.addColorStop(1, 'rgba(255, 122, 48, 0)');
    } else {
      grd.addColorStop(0, 'rgba(120, 120, 120, 0.1)');
      grd.addColorStop(1, 'rgba(120, 120, 120, 0)');
    }
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(f.x, f.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    /* Batu api */
    for (var i = 0; i < 8; i += 1) {
      var a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(a) * 30, f.y + Math.sin(a) * 20, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#4a4038';
      ctx.fill();
    }

    /* Kayu bakar */
    ctx.save();
    ctx.translate(f.x, f.y + 6);
    ctx.rotate(0.32);
    ctx.fillStyle = '#3d2716';
    ctx.fillRect(-24, -4, 48, 8);
    ctx.rotate(-0.64);
    ctx.fillRect(-24, -4, 48, 8);
    ctx.restore();

    if (f.fuel <= 0) {
      /* Asap saja */
      var smoke = Math.sin(t * 2) * 3;
      ctx.beginPath();
      ctx.arc(f.x + smoke, f.y - 16, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(140, 140, 150, 0.16)';
      ctx.fill();
      return;
    }

    var scale = 0.55 + (f.fuel / 100) * 0.75;
    var flick = 1 + Math.sin(t * 9) * 0.06 + Math.sin(t * 21) * 0.04;

    ctx.save();
    ctx.translate(f.x, f.y - 2);

    ctx.beginPath();
    ctx.moveTo(0, -46 * scale * flick);
    ctx.bezierCurveTo(16 * scale, -30 * scale, 20 * scale, -10 * scale, 0, 2);
    ctx.bezierCurveTo(-20 * scale, -10 * scale, -16 * scale, -30 * scale, 0, -46 * scale * flick);
    ctx.fillStyle = 'rgba(255, 138, 61, 0.9)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -32 * scale * flick);
    ctx.bezierCurveTo(10 * scale, -21 * scale, 13 * scale, -7 * scale, 0, 1);
    ctx.bezierCurveTo(-13 * scale, -7 * scale, -10 * scale, -21 * scale, 0, -32 * scale * flick);
    ctx.fillStyle = 'rgba(255, 196, 110, 0.95)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -18 * scale * flick);
    ctx.bezierCurveTo(5 * scale, -12 * scale, 6 * scale, -4 * scale, 0, 0);
    ctx.bezierCurveTo(-6 * scale, -4 * scale, -5 * scale, -12 * scale, 0, -18 * scale * flick);
    ctx.fillStyle = 'rgba(255, 246, 214, 0.95)';
    ctx.fill();

    ctx.restore();
  }

  function drawPlayer() {
    var p = game.player;

    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 11, 13, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    /* Tubuh */
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#f0dfc6';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(120, 72, 30, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    /* Arah hadap */
    var fx = p.x + Math.cos(p.facing) * 7;
    var fy = p.y + Math.sin(p.facing) * 7;
    ctx.beginPath();
    ctx.arc(fx, fy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2415';
    ctx.fill();

    /* Indikator kayu yang dibawa */
    if (p.wood > 0) {
      var shown = Math.min(p.wood, 6);
      for (var i = 0; i < shown; i += 1) {
        ctx.fillStyle = '#a9743f';
        ctx.fillRect(p.x - 10 + (i % 3) * 7, p.y - 22 - Math.floor(i / 3) * 5, 5, 3);
      }
    }

    /* Progress memotong */
    if (p.chopT > 0) {
      var w = 26;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(p.x - w / 2, p.y - 40, w, 4);
      ctx.fillStyle = '#ffb86b';
      ctx.fillRect(p.x - w / 2, p.y - 40, w * Math.min(1, p.chopT / 0.5), 4);
    }
  }

  function drawWolf(w) {
    var wob = Math.sin(w.wobble) * 2;

    ctx.beginPath();
    ctx.ellipse(w.x, w.y + 10, 15, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.fill();

    ctx.fillStyle = w.hitFlash > 0.4 ? '#c94b4b' : '#2b2433';
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Kepala */
    ctx.beginPath();
    ctx.arc(w.x + wob, w.y - 8, 8, 0, Math.PI * 2);
    ctx.fillStyle = w.hitFlash > 0.4 ? '#e06060' : '#352c3f';
    ctx.fill();

    /* Telinga */
    ctx.fillStyle = '#241d2c';
    tri(w.x + wob - 5, w.y - 15, 6, 7);
    tri(w.x + wob + 5, w.y - 15, 6, 7);

    /* Mata */
    ctx.fillStyle = '#ff5c5c';
    ctx.beginPath();
    ctx.arc(w.x + wob - 3, w.y - 9, 1.7, 0, Math.PI * 2);
    ctx.arc(w.x + wob + 3, w.y - 9, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles() {
    for (var i = 0; i < game.parts.length; i += 1) {
      var p = game.parts[i];
      var a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawNight() {
    if (game.phase !== 'night') return;

    var f = game.fire;
    var fx = f.x - game.cam.x;
    var fy = f.y - game.cam.y;
    var strength = 0.86;
    var hole = 150 + f.fuel * 2.6;

    var grd = ctx.createRadialGradient(fx, fy, 0, fx, fy, hole);
    grd.addColorStop(0, 'rgba(6, 9, 20, 0)');
    grd.addColorStop(0.5, 'rgba(6, 9, 20, 0.34)');
    grd.addColorStop(1, 'rgba(6, 9, 20, ' + strength + ')');

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, view.w, view.h);

    /* Vignette tetap */
    var vig = ctx.createRadialGradient(
      view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35,
      view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.78
    );
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function render() {
    if (!game) return;

    ctx.clearRect(0, 0, view.w, view.h);

    ctx.save();
    ctx.translate(-game.cam.x, -game.cam.y);

    drawGround();
    drawFire();

    /* Pohon & pemain & serigala diurutkan berdasarkan y agar terlihat benar */
    var drawables = [];
    var i;

    for (i = 0; i < game.trees.length; i += 1) {
      var t = game.trees[i];
      if (t.x < game.cam.x - 90 || t.x > game.cam.x + view.w + 90) continue;
      if (t.y < game.cam.y - 110 || t.y > game.cam.y + view.h + 90) continue;
      drawables.push({ y: t.y, kind: 'tree', ref: t });
    }

    drawables.push({ y: game.player.y, kind: 'player', ref: game.player });

    for (i = 0; i < game.wolves.length; i += 1) {
      drawables.push({ y: game.wolves[i].y, kind: 'wolf', ref: game.wolves[i] });
    }

    drawables.sort(function (a, b) { return a.y - b.y; });

    for (i = 0; i < drawables.length; i += 1) {
      var d = drawables[i];
      if (d.kind === 'tree') drawTree(d.ref);
      else if (d.kind === 'player') drawPlayer();
      else drawWolf(d.ref);
    }

    drawParticles();

    ctx.restore();

    drawNight();
  }

  /* ---------------------------------------------------------------
     Alur game
     --------------------------------------------------------------- */

  function begin() {
    reset();
    game.state = 'play';
    if (el.start) el.start.classList.remove('show');
    if (el.end) el.end.classList.remove('show');
    if (el.pause) el.pause.classList.remove('show');
    hideHint();
    toast('Kumpulkan kayu sebelum malam tiba', '');
  }

  function togglePause(show) {
    if (!game) return;

    if (show && game.state === 'play') {
      game.state = 'pause';
      if (el.pause) el.pause.classList.add('show');
    } else if (!show && game.state === 'pause') {
      game.state = 'play';
      if (el.pause) el.pause.classList.remove('show');
    }
  }

  if (el.startBtn) el.startBtn.addEventListener('click', begin);
  if (el.againBtn) el.againBtn.addEventListener('click', begin);
  if (el.resumeBtn) el.resumeBtn.addEventListener('click', function () { togglePause(false); });
  if (el.quitBtn) el.quitBtn.addEventListener('click', function () { window.location.href = 'index.html'; });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game && game.state === 'play') togglePause(true);
  });

  /* ---------------------------------------------------------------
     Loop
     --------------------------------------------------------------- */

  var last = 0;

  function frame(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;

    if (game && game.state === 'play') update(dt);

    render();
    window.requestAnimationFrame(frame);
  }

  resize();
  reset();
  bindTouch();
  if (el.best) el.best.textContent = String(readBest());
  window.requestAnimationFrame(frame);
})();
