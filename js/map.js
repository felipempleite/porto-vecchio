/* Carte flottante liée au défilement — données © OpenStreetMap contributors (ODbL) */
(function () {
  'use strict';
  var inset = document.getElementById('map-inset');
  if (!inset) return;
  var toggle = inset.querySelector('.map-inset__toggle');
  var placeEl = inset.querySelector('.map-inset__place');
  var svg = inset.querySelector('.map-region');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* chapitre -> lieux allumés + légende */
  var MAP = {
    citadelle: [['citadelle'], 'La citadelle'],
    paoli: [['marine'], 'La Marine, le port'],
    sel: [['salines'], 'Les salines'],
    liege: [['marine'], 'La Marine, le port'],
    montagne: [['ospedale'], 'L’Ospédale'],
    mer: [['palombaggia', 'santa-giulia', 'cala-rossa'], 'Les plages du sud'],
    crepuscule: [['citadelle'], 'La citadelle'],
    langue: [['citadelle', 'zicavo'], 'Toute l’île'],
    'rocca-serra': [['citadelle', 'maison'], 'Portivechju'],
    abbatucci: [['zicavo', 'taravo'], 'Zicavo, le Taravo'],
    'deux-lignees': [['zicavo', 'taravo', 'maison'], 'De Zicavo à la mer'],
    maison: [['maison'], 'La maison'],
    envoi: [['maison'], 'La maison']
  };
  var sections = Object.keys(MAP).map(function (id) { return document.getElementById(id); }).filter(Boolean);
  var current = null, peekTimer = null;
  var wide = window.matchMedia('(min-width: 1180px)');

  function setPlace(id) {
    if (id === current) return;
    current = id;
    var visible = !!id;
    inset.classList.toggle('is-visible', visible);
    if (!visible) { collapse(); return; }
    var spec = MAP[id];
    svg.querySelectorAll('[data-place]').forEach(function (el) {
      el.classList.toggle('is-active', spec[0].indexOf(el.getAttribute('data-place')) !== -1);
    });
    svg.classList.toggle('has-town-active', spec[0].indexOf('maison') !== -1);
    placeEl.textContent = spec[1];
    if (!reduced.matches) {
      inset.classList.remove('is-pulse'); void inset.offsetWidth; inset.classList.add('is-pulse');
      /* grand écran : la carte se montre un instant à chaque nouveau lieu, puis se replie */
      if (wide.matches) {
        inset.classList.add('is-peek');
        clearTimeout(peekTimer);
        peekTimer = setTimeout(function () { inset.classList.remove('is-peek'); }, 3200);
      }
    }
  }

  function collapse() {
    inset.classList.remove('is-expanded');
    toggle.setAttribute('aria-expanded', 'false');
  }

  var ticking = false;
  function update() {
    ticking = false;
    var mid = window.innerHeight * 0.5, found = null;
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { found = sections[i].id; break; }
    }
    setPlace(found);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  toggle.addEventListener('click', function () {
    var open = !inset.classList.contains('is-expanded');
    inset.classList.toggle('is-expanded', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') collapse(); });
  document.addEventListener('click', function (e) { if (!inset.contains(e.target)) collapse(); });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
