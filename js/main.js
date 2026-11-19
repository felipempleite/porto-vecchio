/* ==========================================================================
   Portivechju — Lettre à ceux qui reviennent
   Scrollytelling progressif (GSAP ScrollTrigger + repli natif)
   ========================================================================== */

(function () {
  'use strict';

  var docEl = document.documentElement;
  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var prefersReducedMotion = reducedMotionQuery.matches;

  /* Indique au garde-fou de index.html que le script est prêt */
  window.__pvReady = true;

  /* ---------- Utilitaires ---------- */

  function parseDelay(el) {
    var raw = el.style.getPropertyValue('--d') || '';
    var val = parseFloat(raw);
    return Number.isFinite(val) ? val : 0;
  }

  function revealImmediately(el) {
    el.classList.add('is-revealed', 'is-visible');
    el.style.opacity = '';
    el.style.transform = '';
  }

  /* ---------- En-tête, barre de progression & sommaire ---------- */

  function initChrome() {
    var progressBar = document.querySelector('.progress span');
    var header = document.querySelector('.site-header');
    var tocDetails = document.querySelector('.toc details');
    var tocSummary = tocDetails ? tocDetails.querySelector('summary') : null;
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
    var sections = Array.prototype.slice.call(
      document.querySelectorAll('main > section[id], footer[id]')
    );

    var linkById = new Map();
    tocLinks.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      if (id) linkById.set(id, link);
    });

    /* Fermeture ergonomique du sommaire */
    if (tocDetails) {
      tocLinks.forEach(function (link) {
        link.addEventListener('click', function () {
          tocDetails.open = false;
        });
      });

      document.addEventListener('click', function (event) {
        if (tocDetails.open && !tocDetails.contains(event.target)) {
          tocDetails.open = false;
        }
      });

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && tocDetails.open) {
          tocDetails.open = false;
          if (tocSummary) tocSummary.focus();
        }
      });
    }

    var currentActiveId = null;
    var ticking = false;

    function updateOnScroll() {
      ticking = false;

      var scrollY = window.scrollY || window.pageYOffset || 0;
      var maxScroll = Math.max(1, docEl.scrollHeight - window.innerHeight);
      var ratio = Math.min(1, Math.max(0, scrollY / maxScroll));

      if (progressBar) {
        progressBar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
      }

      if (header) {
        header.classList.toggle('is-scrolled', scrollY > 40);
      }

      /* Détermine la section active sous l'en-tête */
      var probeY = header ? Math.max(36, header.offsetHeight * 0.65) : 48;
      var activeSection = null;
      var readingProbe = window.innerHeight * 0.34;
      var readingSection = null;

      for (var i = 0; i < sections.length; i++) {
        var rect = sections[i].getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom > probeY) {
          activeSection = sections[i];
        }
        if (rect.top <= readingProbe && rect.bottom > readingProbe) {
          readingSection = sections[i];
        }
      }

      if (header && activeSection) {
        var isDarkSurface =
          activeSection.classList.contains('is-dark') ||
          activeSection.classList.contains('hero');
        header.classList.toggle('is-on-light', !isDarkSurface);
      }

      var targetSection = readingSection || activeSection;
      var nextId = targetSection ? targetSection.id : null;
      if (nextId !== currentActiveId) {
        if (currentActiveId && linkById.has(currentActiveId)) {
          linkById.get(currentActiveId).removeAttribute('aria-current');
        }
        if (nextId && linkById.has(nextId)) {
          linkById.get(nextId).setAttribute('aria-current', 'location');
        }
        currentActiveId = nextId;
      }
    }

    function requestUpdate() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateOnScroll);
      }
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    window.addEventListener('load', requestUpdate, { once: true });
    updateOnScroll();
  }

  /* ---------- Crédits (repli si la liste HTML est vide) ---------- */

  function ensureCredits() {
    var list = document.getElementById('credits-list');
    if (!list || list.children.length > 0 || typeof window.fetch !== 'function') {
      return;
    }

    fetch('assets/credits.json')
      .then(function (res) {
        return res.ok ? res.json() : [];
      })
      .then(function (items) {
        if (!Array.isArray(items) || items.length === 0) return;
        var frag = document.createDocumentFragment();

        items.forEach(function (item) {
          var li = document.createElement('li');

          var desc = document.createElement('span');
          desc.className = 'cr-desc';
          desc.textContent = item.desc || item.title || item.slug || '';

          var meta = document.createElement('span');
          meta.className = 'cr-meta';
          meta.appendChild(document.createTextNode((item.artist_clean || item.artist || '') + ' · '));

          if (item.licurl) {
            var licLink = document.createElement('a');
            licLink.href = item.licurl;
            licLink.textContent = item.lic || 'Licence';
            meta.appendChild(licLink);
          } else {
            meta.appendChild(document.createTextNode(item.lic === 'Public domain' ? 'Domaine public' : (item.lic || '')));
          }

          if (item.page) {
            meta.appendChild(document.createTextNode(' · '));
            var srcLink = document.createElement('a');
            srcLink.href = item.page;
            srcLink.textContent = 'source';
            meta.appendChild(srcLink);
          }

          li.appendChild(desc);
          li.appendChild(meta);
          frag.appendChild(li);
        });

        list.appendChild(frag);
      })
      .catch(function () {
        /* Silence en cas d'ouverture hors serveur HTTP */
      });
  }

  /* ---------- Repli sans GSAP (IntersectionObserver) ---------- */

  function initFallbackMotion() {
    var timelines = document.querySelectorAll('.timeline');
    timelines.forEach(function (tl) {
      tl.style.setProperty('--tl-progress', '1');
    });

    var heroReveals = document.querySelectorAll('.hero .reveal');
    heroReveals.forEach(function (el) {
      el.classList.add('is-visible');
    });

    var reveals = Array.prototype.slice.call(
      document.querySelectorAll('.reveal:not(.hero .reveal)')
    );

    if (!('IntersectionObserver' in window)) {
      reveals.forEach(revealImmediately);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );

    reveals.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------- Chorégraphie GSAP + ScrollTrigger ---------- */

  function initGsapMotion() {
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;

    docEl.classList.add('js-gsap');
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    var handled = new WeakSet();

    /* 1. Ouverture (Hero) */
    var hero = document.querySelector('.hero');
    if (hero) {
      var heroReveals = Array.prototype.slice.call(hero.querySelectorAll('.reveal'));
      heroReveals.forEach(function (el) {
        handled.add(el);
        gsap.fromTo(
          el,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 1.05,
            delay: 0.12 + parseDelay(el),
            ease: 'power2.out',
            clearProps: 'transform',
            onComplete: function () {
              el.classList.add('is-revealed');
            }
          }
        );
      });

      /* l'image et l'éventuelle boucle vidéo bougent ensemble */
      var heroImg = hero.querySelectorAll('.hero__media img, .hero__media video');
      if (heroImg.length) {
        gsap.fromTo(
          heroImg,
          { scale: 1.04, yPercent: -3 },
          {
            scale: 1.1,
            yPercent: 7,
            ease: 'none',
            scrollTrigger: {
              trigger: hero,
              start: 'top top',
              end: 'bottom top',
              scrub: true
            }
          }
        );
      }

      var scrollCue = hero.querySelector('.scroll-cue');
      if (scrollCue) {
        gsap.to(scrollCue, {
          opacity: 0,
          y: 12,
          ease: 'none',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: '28% top',
            scrub: true
          }
        });
      }
    }

    /* 2. Parallaxe lente sur les visuels plein-cadre et fonds */
    var parallaxNodes = document.querySelectorAll('[data-parallax]');
    parallaxNodes.forEach(function (container) {
      var img = container.querySelector('img');
      if (!img) return;
      var rawAmount = parseFloat(container.getAttribute('data-parallax'));
      var amount = Number.isFinite(rawAmount) ? Math.min(Math.max(rawAmount, 3), 7.5) : 6;

      gsap.fromTo(
        img,
        { yPercent: -amount },
        {
          yPercent: amount,
          ease: 'none',
          scrollTrigger: {
            trigger: container,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        }
      );
    });

    /* 3. Respiration très lente des fonds persistants (sticky-bg) */
    var stickySections = document.querySelectorAll('.has-sticky-bg');
    stickySections.forEach(function (section) {
      var bgImg = section.querySelector('.sticky-bg img');
      if (!bgImg) return;

      gsap.fromTo(
        bgImg,
        { scale: 1 },
        {
          scale: 1.07,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        }
      );
    });

    /* 4. Révélations plein-cadre (clip-path doux) */
    var clipReveals = document.querySelectorAll('.reveal.reveal--clip');
    clipReveals.forEach(function (fig) {
      if (handled.has(fig)) return;
      handled.add(fig);

      var media = fig.querySelector('.bleed__media');
      ScrollTrigger.create({
        trigger: fig,
        start: 'top 86%',
        once: true,
        onEnter: function () {
          gsap.to(fig, {
            opacity: 1,
            duration: 0.9,
            ease: 'power2.out',
            onComplete: function () {
              fig.classList.add('is-revealed');
            }
          });
          if (media) {
            gsap.to(media, {
              clipPath: 'inset(0% 0% 0% 0%)',
              duration: 1.2,
              ease: 'power2.out',
              clearProps: 'clipPath'
            });
          }
        }
      });
    });

    /* 5. Groupes à apparition étagée ([data-stagger]) */
    var staggerGroups = document.querySelectorAll('[data-stagger]');
    staggerGroups.forEach(function (group) {
      var items = Array.prototype.slice
        .call(group.querySelectorAll('.reveal'))
        .filter(function (el) {
          return !handled.has(el);
        });

      if (items.length === 0) return;
      items.forEach(function (el) {
        handled.add(el);
      });

      ScrollTrigger.create({
        trigger: group,
        start: 'top 86%',
        once: true,
        onEnter: function () {
          gsap.to(items, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            stagger: 0.11,
            ease: 'power2.out',
            clearProps: 'transform',
            onComplete: function () {
              items.forEach(function (el) {
                el.classList.add('is-revealed');
              });
            }
          });
        }
      });
    });

    /* 6. Éléments .reveal individuels restants */
    var remainingReveals = document.querySelectorAll('.reveal');
    remainingReveals.forEach(function (el) {
      if (handled.has(el)) return;
      handled.add(el);

      var delay = parseDelay(el);
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.92,
            delay: delay,
            ease: 'power2.out',
            clearProps: 'transform',
            onComplete: function () {
              el.classList.add('is-revealed');
            }
          });
        }
      });
    });

    /* 7. Tracé progressif des ornements SVG (vague, crête, blason) */
    var ornamentPaths = document.querySelectorAll('.ornament path');
    ornamentPaths.forEach(function (path) {
      if (typeof path.getTotalLength !== 'function') return;
      var len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(path, {
        strokeDashoffset: 0,
        duration: 1.4,
        ease: 'power2.inOut',
        scrollTrigger: {
          trigger: path.closest('svg') || path,
          start: 'top 86%',
          once: true
        }
      });
    });

    var blazon = document.querySelector('.blazon svg');
    if (blazon) {
      var strokes = Array.prototype.slice.call(blazon.querySelectorAll('path'));
      strokes.forEach(function (path) {
        if (typeof path.getTotalLength !== 'function') return;
        var len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      });

      gsap.to(strokes, {
        strokeDashoffset: 0,
        duration: 1.15,
        stagger: 0.06,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: blazon,
          start: 'top 84%',
          once: true
        }
      });
    }

    /* 8. Chemin montagne -> mer (confluence, pathLength="1") */
    var confluence = document.querySelector('.confluence');
    var confluencePath = confluence ? confluence.querySelector('.confluence__line path') : null;
    if (confluence && confluencePath) {
      gsap.set(confluencePath, { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.to(confluencePath, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: confluence,
          start: 'top 82%',
          end: 'center 48%',
          scrub: 0.65
        }
      });
    }

    /* 9. Axe progressif des deux frises familiales */
    var timelines = document.querySelectorAll('.timeline');
    timelines.forEach(function (timeline) {
      ScrollTrigger.create({
        trigger: timeline,
        start: 'top 72%',
        end: 'bottom 68%',
        scrub: 0.25,
        onUpdate: function (self) {
          timeline.style.setProperty('--tl-progress', self.progress.toFixed(4));
        }
      });
    });

    /* Recalcul des repères une fois polices et images stabilisées */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        ScrollTrigger.refresh();
      });
    }
    window.addEventListener(
      'load',
      function () {
        ScrollTrigger.refresh();
      },
      { once: true }
    );
  }

  /* ---------- Lancement ---------- */

  initChrome();
  ensureCredits();

  if (prefersReducedMotion) {
    document.querySelectorAll('.timeline').forEach(function (tl) {
      tl.style.setProperty('--tl-progress', '1');
    });
    return;
  }

  if (typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined') {
    initGsapMotion();
  } else {
    initFallbackMotion();
  }
})();
