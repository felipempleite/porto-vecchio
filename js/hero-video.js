/* Boucle vidéo du héros — strictement optionnelle.
   Ne charge rien tant que <video data-ready> n'est pas posé, ni si l'on préfère moins d'animations,
   ni en mode « économie de données » / connexion lente. L'image reste toujours l'affiche. */
(function () {
  'use strict';
  var v = document.querySelector('.hero__video');
  if (!v || !v.hasAttribute('data-ready')) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var slow = conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''));
  if (reduced.matches || slow) return;

  [['webm', 'video/webm'], ['mp4', 'video/mp4']].forEach(function (f) {
    var src = v.getAttribute('data-' + f[0]);
    if (src && v.canPlayType(f[1])) { var s = document.createElement('source'); s.src = src; s.type = f[1]; v.appendChild(s); }
  });
  if (!v.querySelector('source')) return;
  v.muted = true;
  var hero = v.closest('.hero');
  v.addEventListener('playing', function () { v.classList.add('is-playing'); if (hero) hero.classList.add('has-video'); });
  v.addEventListener('error', function () { v.remove(); }, true);

  function stop() { v.pause(); v.classList.remove('is-playing'); if (hero) hero.classList.remove('has-video'); }
  function start() { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  if (reduced.addEventListener) reduced.addEventListener('change', function (e) { if (e.matches) stop(); });

  /* ne joue que lorsque le héros est visible */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting && !reduced.matches) start(); else v.pause(); });
    }, { threshold: 0.05 }).observe(v.closest('.hero') || v);
  } else { start(); }
})();
