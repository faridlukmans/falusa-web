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
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f8fc' : '#070a12');
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', theme === 'light' ? 'Aktifkan tema gelap' : 'Aktifkan tema terang');
    }
  }

  applyTheme(safeGet('falusa-theme') || systemTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      safeSet('falusa-theme', next);
    });
  }

  function closeMenu() {
    if (!navLinks || !menuToggle) return;
    navLinks.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Buka menu');
  }

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function (event) {
      event.stopPropagation();
      var isOpen = navLinks.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.setAttribute('aria-label', isOpen ? 'Tutup menu' : 'Buka menu');
    });

    navLinks.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeMenu();
    });

    document.addEventListener('click', function (event) {
      if (!navLinks.classList.contains('is-open')) return;
      if (navLinks.contains(event.target) || menuToggle.contains(event.target)) return;
      closeMenu();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });
  }

  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (year) year.textContent = String(new Date().getFullYear());

  var revealItems = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealItems.forEach(function (item) { observer.observe(item); });
  } else {
    revealItems.forEach(function (item) { item.classList.add('is-visible'); });
  }
})();
