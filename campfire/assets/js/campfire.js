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
})();
