/* ============================================================
   F9XR iCryptos Dashboards - Shared Site Behaviour
   1. Lucide icon hydration
   2. Nav dropdown enhancement (details and summary based)
   3. Footer labelling and reveal runway measurement
   4. Direction aware view transitions
   Runs on every page. Safe to load with the defer attribute.
   ============================================================ */

(function () {
  'use strict';

  /* ---------- 1. Lucide icons ---------- */
  function hydrateIcons() {
    if (typeof window.lucide === 'undefined' || typeof window.lucide.createIcons !== 'function') {
      return;
    }
    try {
      window.lucide.createIcons({
        attrs: {
          'aria-hidden': 'true',
          focusable: 'false'
        }
      });
    } catch (err) {
      /* icon hydration is progressive enhancement only */
    }
  }

  /* ---------- 2. Dropdown behaviour ---------- */
  function closeAllDropdowns(except) {
    var open = document.querySelectorAll('details.cp-nav-dd[open]');
    open.forEach(function (details) {
      if (except && details === except) return;
      details.removeAttribute('open');
    });
  }

  function initDropdowns() {
    var dropdowns = Array.prototype.slice.call(document.querySelectorAll('details.cp-nav-dd'));

    dropdowns.forEach(function (dd) {
      var summary = dd.querySelector('summary');
      if (!summary) return;

      summary.setAttribute('aria-haspopup', 'true');
      summary.setAttribute('aria-expanded', 'false');

      var sync = function () {
        summary.setAttribute('aria-expanded', dd.hasAttribute('open') ? 'true' : 'false');
      };
      sync();

      dd.addEventListener('toggle', sync);

      /* Close the panel after following a link inside it */
      dd.querySelectorAll('a[href]').forEach(function (link) {
        link.addEventListener('click', function () {
          closeAllDropdowns(null);
        });
      });

      /* Enter and Space toggle natively on summary, this keeps Escape working */
      dd.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && dd.hasAttribute('open')) {
          e.stopPropagation();
          dd.removeAttribute('open');
          summary.focus();
        }
      });
    });

    /* Click outside closes */
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('details.cp-nav-dd')) return;
      closeAllDropdowns(null);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllDropdowns(null);
    });
  }

  /* ---------- 3. Reveal footer height hint for assistive tech ---------- */
  function markReveal() {
    var footer = document.querySelector('.cp-footer-reveal .cp-footer, .cp-footer-static .cp-footer');
    if (footer && !footer.hasAttribute('aria-label')) {
      footer.setAttribute('aria-label', 'Site footer');
    }
  }

  /* ---------- 3b. Reveal runway and trigger ----------
     assets/site.css parks .cp-footer-reveal off the bottom of the
     viewport with a transform. This measures the real footer height
     into --cp-foot-h (shell clearance so the fixed footer never
     covers the last content or the pager) and flips .is-revealed
     when the visitor reaches the end of the page. */
  var runwayTimer = null;

  function revealTarget() {
    return document.querySelector('.cp-footer-reveal');
  }

  function isStaticFooter(footer) {
    return getComputedStyle(footer).position !== 'fixed';
  }

  function measureRunway() {
    var body = document.body;
    var shell = document.querySelector('.cp-reveal-shell');
    var footer = revealTarget();
    if (!body || !footer || !body.classList.contains('cp-reveal-body')) return;

    if (isStaticFooter(footer)) {
      if (shell) shell.style.removeProperty('--cp-foot-h');
      return;
    }

    var height = Math.ceil(footer.getBoundingClientRect().height);
    if (!height) return;
    /* Extra slack keeps the pager clear of the fixed footer edge */
    if (shell) shell.style.setProperty('--cp-foot-h', height + 32 + 'px');
  }

  function updateReveal() {
    var footer = revealTarget();
    if (!footer || isStaticFooter(footer)) return;

    var viewport = window.innerHeight;
    var doc = document.documentElement;
    var distance = doc.scrollHeight - (window.scrollY + viewport);
    var threshold = Math.max(120, Math.round(viewport * 0.18));

    if (distance <= threshold) {
      footer.classList.add('is-revealed');
      footer.removeAttribute('aria-hidden');
    } else {
      footer.classList.remove('is-revealed');
      footer.setAttribute('aria-hidden', 'true');
    }
  }

  /* Kept intentionally cheap: two cached scroll reads and a class
     toggle. Called directly so it does not depend on rAF firing. */
  function onScroll() {
    updateReveal();
  }

  function scheduleRunwaySync() {
    if (runwayTimer) window.clearTimeout(runwayTimer);
    runwayTimer = window.setTimeout(function () {
      measureRunway();
      updateReveal();
    }, 120);
  }

  function initRevealRunway() {
    measureRunway();
    updateReveal();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', scheduleRunwaySync);
    window.addEventListener('orientationchange', scheduleRunwaySync);
    window.addEventListener('load', function () {
      measureRunway();
      updateReveal();
    });

    /* Late webfont metrics change the footer height */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        measureRunway();
        updateReveal();
      }).catch(function () {});
    }

    /* Content can grow after load (lazy images, injected widgets) */
    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(scheduleRunwaySync);
      ro.observe(document.body);
    }
  }

  /* ---------- 4. Direction aware view transitions ----------
     assets/view-transitions.css animates the root snapshot up or
     down depending on html.vt-forward or html.vt-back. We persist
     the direction across the navigation so the arriving document
     knows which way the visitor was travelling through the
     hierarchy. Works with or without the Navigation API. */
  var VT_DIR_KEY = 'cp-vt-dir';

  function depthOf(pathname) {
    return pathname.split('/').filter(Boolean).length;
  }

  function applyStoredDirection() {
    var dir = null;
    try {
      dir = sessionStorage.getItem(VT_DIR_KEY);
    } catch (err) {
      dir = null;
    }
    if (dir === 'forward' || dir === 'back') {
      document.documentElement.classList.add('vt-' + dir);
    }
  }

  function rememberDirection(targetUrl) {
    var dir = 'forward';
    try {
      var target = new URL(targetUrl, location.href);
      if (target.origin === location.origin) {
        dir = depthOf(target.pathname) > depthOf(location.pathname) ? 'forward' : 'back';
      }
    } catch (err) {
      dir = 'forward';
    }
    try {
      sessionStorage.setItem(VT_DIR_KEY, dir);
    } catch (err) {
      /* private mode, direction hint is optional */
    }
    return dir;
  }

  function initViewTransitionDirection() {
    applyStoredDirection();

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      var link = e.target.closest ? e.target.closest('a[href]') : null;
      if (!link) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      var href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return;

      var url;
      try {
        url = new URL(href, location.href);
      } catch (err) {
        return;
      }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return;

      rememberDirection(url.href);
    });
  }

  function init() {
    hydrateIcons();
    initDropdowns();
    markReveal();
    initRevealRunway();
    initViewTransitionDirection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Re-hydrate icons if they are injected later */
  window.addEventListener('load', hydrateIcons);
})();
