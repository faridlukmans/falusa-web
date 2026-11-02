(function () {
  'use strict';

  var root = document.documentElement;
  var header = document.getElementById('siteHeader');
  var themeToggle = document.getElementById('themeToggle');
  var menuToggle = document.getElementById('menuToggle');
  var navLinks = document.getElementById('navLinks');
  var year = document.getElementById('year');

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#fdf8f3' : '#0b0705');
    if (themeToggle) {
      themeToggle.setAttribute(
        'aria-label',
        theme === 'light' ? 'Aktifkan tema gelap' : 'Aktifkan tema terang'
      );
    }
  }

  applyTheme(safeGet('campfire-theme') || systemTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      safeSet('campfire-theme', next);
    });
  }

  if (year) year.textContent = String(new Date().getFullYear());

  /* Header shadow on scroll */
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Mobile menu */
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    navLinks.addEventListener('click', function (event) {
      if (event.target.tagName === 'A') {
        navLinks.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Reveal on scroll */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

      reveals.forEach(function (el) { observer.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('in'); });
    }
  }

  /* Ember particles */
  var emberBox = document.getElementById('embers');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (emberBox && !reduceMotion) {
    var count = window.innerWidth < 620 ? 12 : 22;

    for (var i = 0; i < count; i += 1) {
      var dot = document.createElement('span');
      dot.className = 'ember-particle';
      dot.style.left = Math.random() * 100 + '%';
      dot.style.setProperty('--drift', (Math.random() * 120 - 60).toFixed(0) + 'px');
      dot.style.animationDuration = (7 + Math.random() * 9).toFixed(1) + 's';
      dot.style.animationDelay = (Math.random() * 10).toFixed(1) + 's';
      dot.style.opacity = '0';
      emberBox.appendChild(dot);
    }
  }

  /* Notify form (frontend only — backend belum ada) */
  var form = document.getElementById('notifyForm');
  var emailInput = document.getElementById('notifyEmail');
  var msg = document.getElementById('notifyMsg');

  function setMsg(text, kind) {
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'form-msg' + (kind ? ' ' + kind : '');
  }

  if (form && emailInput) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var value = emailInput.value.trim();

      if (!value) {
        setMsg('Email belum diisi.', 'err');
        emailInput.focus();
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        setMsg('Format email tidak valid.', 'err');
        emailInput.focus();
        return;
      }

      setMsg('Tercatat. Formulir masih lokal di browser — backend belum aktif.', 'ok');
      form.reset();
    });

    emailInput.addEventListener('input', function () {
      if (msg && msg.textContent) setMsg('', '');
    });
  }

  /* ---------------------------------------------------------------
     Suara api unggun — dibuat dengan Web Audio API, tanpa file audio.
     Default mati (kebijakan autoplay browser); dinyalakan lewat tombol.
     --------------------------------------------------------------- */

  function initFireSound() {
    var btn = document.getElementById('fireSound');
    if (!btn) return;

    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { btn.hidden = true; return; }

    var actx = null;
    var master = null;
    var noise = null;
    var crackleTimer = 0;
    var popTimer = 0;
    var enabled = false;

    function makeNoise(seconds) {
      var len = Math.max(1, Math.floor(actx.sampleRate * seconds));
      var buf = actx.createBuffer(1, len, actx.sampleRate);
      var data = buf.getChannelData(0);
      var last = 0;

      for (var i = 0; i < len; i += 1) {
        var white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }

      return buf;
    }

    function build() {
      if (actx) return;

      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0;
      master.connect(actx.destination);

      noise = makeNoise(3);

      var rumble = actx.createBufferSource();
      rumble.buffer = noise;
      rumble.loop = true;

      var lp = actx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      lp.Q.value = 0.7;

      var rumbleGain = actx.createGain();
      rumbleGain.gain.value = 0.18;

      rumble.connect(lp);
      lp.connect(rumbleGain);
      rumbleGain.connect(master);
      rumble.start();
    }

    function fade(value, seconds) {
      if (!master || !actx) return;
      var now = actx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(value, now + seconds);
    }

    function crackle() {
      if (!enabled || !actx) return;

      var t = actx.currentTime;
      var dur = 0.02 + Math.random() * 0.12;
      var offset = Math.random() * Math.max(0.01, noise.duration - dur - 0.05);

      var src = actx.createBufferSource();
      src.buffer = noise;

      var bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700 + Math.random() * 2800;
      bp.Q.value = 0.9 + Math.random() * 1.8;

      var gain = actx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.04 + Math.random() * 0.2, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      var pan = null;
      if (actx.createStereoPanner) {
        pan = actx.createStereoPanner();
        pan.pan.value = Math.random() * 1.3 - 0.65;
      }

      src.connect(bp);
      bp.connect(gain);

      if (pan) {
        gain.connect(pan);
        pan.connect(master);
      } else {
        gain.connect(master);
      }

      src.start(t, offset, dur);

      src.onended = function () {
        try {
          src.disconnect();
          bp.disconnect();
          gain.disconnect();
          if (pan) pan.disconnect();
        } catch (e) { /* ignore */ }
      };

      crackleTimer = window.setTimeout(crackle, 40 + Math.random() * 190);
    }

    function pop() {
      if (!enabled || !actx) return;

      var t = actx.currentTime;
      var osc = actx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80 + Math.random() * 90, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.14);

      var gain = actx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.07 + Math.random() * 0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.22);

      osc.onended = function () {
        try { osc.disconnect(); gain.disconnect(); } catch (e) { /* ignore */ }
      };

      popTimer = window.setTimeout(pop, 2200 + Math.random() * 4800);
    }

    function start() {
      build();
      if (actx.state === 'suspended') actx.resume();

      enabled = true;
      fade(0.55, 0.9);

      window.clearTimeout(crackleTimer);
      window.clearTimeout(popTimer);
      crackle();
      pop();

      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', 'Matikan suara api unggun');
    }

    function stop() {
      enabled = false;
      window.clearTimeout(crackleTimer);
      window.clearTimeout(popTimer);
      if (actx) fade(0, 0.35);

      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Nyalakan suara api unggun');
    }

    btn.addEventListener('click', function () {
      if (enabled) stop();
      else start();
    });

    document.addEventListener('visibilitychange', function () {
      if (!actx) return;

      if (document.hidden) {
        window.clearTimeout(crackleTimer);
        window.clearTimeout(popTimer);
        if (actx.state === 'running') actx.suspend();
      } else if (enabled) {
        if (actx.state === 'suspended') actx.resume();
        crackle();
        pop();
      }
    });
  }

  initFireSound();
})();
