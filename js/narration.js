/* « Écouter la lettre » — lecteur sobre, jamais de lecture automatique.
   Met en évidence le chapitre lu et, si « Suivre » est coché, fait défiler la page jusqu'à lui. */
(function () {
  'use strict';
  var player = document.getElementById('narrator');
  var audio = document.getElementById('narration-audio');
  var dataEl = document.getElementById('narration-chapters');
  if (!player || !audio || !dataEl || !audio.canPlayType) return;

  var chapters = JSON.parse(dataEl.textContent);
  var total = chapters[chapters.length - 1].end;
  var toggles = document.querySelectorAll('[data-narration-toggle]');
  var seek = player.querySelector('.narrator__seek');
  var ticks = player.querySelector('.narrator__ticks');
  var curEl = player.querySelector('.narrator__cur');
  var durEl = player.querySelector('.narrator__dur');
  var chapEl = player.querySelector('.narrator__chapter');
  var follow = player.querySelector('.narrator__follow input');
  var closeBtn = player.querySelector('.narrator__close');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var body = document.body;

  /* titres lisibles, tirés du sommaire */
  var names = { ouverture: 'Ouverture' };
  document.querySelectorAll('.toc a[href^="#"]').forEach(function (a) {
    var id = a.getAttribute('href').slice(1);
    var label = a.cloneNode(true); var num = label.querySelector('span'); if (num) num.remove();
    names[id] = label.textContent.trim();
  });

  /* l'interface n'apparaît qu'avec JavaScript */
  document.querySelectorAll('.listen-btn, .listen-cta').forEach(function (el) { el.hidden = false; });

  chapters.forEach(function (c, i) {
    if (i === 0) return;
    var t = document.createElement('i'); t.style.left = (c.start / total * 100) + '%'; ticks.appendChild(t);
  });

  function fmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  durEl.textContent = fmt(total);

  function chapterAt(t) {
    for (var i = chapters.length - 1; i >= 0; i--) if (t >= chapters[i].start - 0.05) return i;
    return 0;
  }

  var lastUserScroll = 0, programmaticUntil = 0, currentIdx = -1, started = false;
  ['wheel', 'touchmove', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      if (ev === 'keydown' && !/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key)) return;
      if (Date.now() > programmaticUntil) lastUserScroll = Date.now();
    }, { passive: true });
  });

  function goTo(id) {
    var el = document.getElementById(id);
    if (!el) return;
    programmaticUntil = Date.now() + 1500;
    el.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function setChapter(i) {
    if (i === currentIdx) return;
    var prev = chapters[currentIdx]; currentIdx = i;
    if (prev) { var pe = document.getElementById(prev.id); if (pe) pe.classList.remove('is-narrated'); }
    var c = chapters[i], el = document.getElementById(c.id);
    if (el) el.classList.add('is-narrated');
    chapEl.textContent = names[c.id] || '';
    if (started && !audio.paused && follow.checked && Date.now() - lastUserScroll > 6000) goTo(c.id);
  }

  function sync() {
    var t = audio.currentTime || 0;
    if (!seek.matches(':active')) seek.value = Math.round(t);
    seek.style.setProperty('--p', (t / total * 100) + '%');
    curEl.textContent = fmt(t);
    setChapter(chapterAt(t));
  }

  function visibleChapter() {
    var mid = window.innerHeight / 2;
    for (var i = 0; i < chapters.length; i++) {
      var el = document.getElementById(chapters[i].id); if (!el) continue;
      var r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) return i;
    }
    return -1;
  }

  function play() {
    player.hidden = false; body.classList.add('has-narrator');
    if (!started) {
      /* depuis l'en-tête, on commence au chapitre que l'on est en train de lire */
      var v = visibleChapter();
      if (v > 1) { try { audio.currentTime = chapters[v].start; } catch (e) {} }
    }
    var p = audio.play();
    if (p && p.catch) p.catch(function (err) { player.classList.add('has-error'); chapEl.textContent = 'Lecture impossible (' + err.name + ')'; });
  }

  toggles.forEach(function (b) {
    b.addEventListener('click', function () { if (audio.paused) play(); else audio.pause(); });
  });
  audio.addEventListener('play', function () {
    started = true; lastUserScroll = 0; body.classList.add('is-narrating');
    toggles.forEach(function (b) { b.setAttribute('aria-label', 'Mettre la lecture en pause'); b.setAttribute('aria-pressed', 'true'); });
  });
  audio.addEventListener('pause', function () {
    body.classList.remove('is-narrating');
    toggles.forEach(function (b) { b.setAttribute('aria-label', 'Écouter la lettre'); b.setAttribute('aria-pressed', 'false'); });
  });
  audio.addEventListener('timeupdate', sync);
  audio.addEventListener('seeked', sync);
  audio.addEventListener('ended', function () { audio.currentTime = 0; started = false; sync(); });
  audio.addEventListener('error', function () { player.classList.add('has-error'); chapEl.textContent = 'Fichier audio indisponible'; }, true);

  seek.addEventListener('input', function () {
    audio.currentTime = Number(seek.value); sync();
    lastUserScroll = 0; if (follow.checked) goTo(chapters[chapterAt(audio.currentTime)].id);
  });
  follow.addEventListener('change', function () { if (follow.checked && !audio.paused) { lastUserScroll = 0; goTo(chapters[currentIdx].id); } });
  closeBtn.addEventListener('click', function () {
    audio.pause(); player.hidden = true; body.classList.remove('has-narrator');
    var c = chapters[currentIdx]; if (c) { var el = document.getElementById(c.id); if (el) el.classList.remove('is-narrated'); }
    currentIdx = -1;
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new window.MediaMetadata({ title: 'Lettre à ceux qui reviennent', artist: 'Portivechju', album: 'Lecture à voix haute' });
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
  }
  sync();
  currentIdx = -1; chapEl.textContent = names.ouverture;
})();
