/* The film: the same letter, played on a clock instead of the scroll bar.
   The voice is the clock. For every moment it says where the page should be (a place in the score),
   which line to show, and what has been cued on the maquette. Anything the reader does to scroll
   stops it; it can be picked up again from wherever the reader has gone. */
import {FILM} from './film.js';

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = t => t * t * (3 - 2 * t);
const minutes = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createCinema({root, scenes, headings, onStart, onStop}) {
  const host = document.getElementById('film');
  const steps = FILM.steps;
  if (!host || steps.length !== scenes.length || steps.some((step, i) => step.id !== scenes[i].id)) return null;

  const chapter = host.querySelector('.film__chapter'), words = host.querySelector('.film__line'), under = host.querySelector('.film__sub');
  const block = host.querySelector('.film__words'), toggle = host.querySelector('[data-film="toggle"]');
  const sound = host.querySelector('[data-film="sound"]'), clockFace = host.querySelector('.film__time');
  const openers = [...document.querySelectorAll('[data-film="start"], [data-film="open"]')];
  /* a journey with its own phases (a photograph that waits, walls that rise once the camera has landed) is not eased twice */
  const phased = scenes.map((scene, i) => !!(scene.arrive || (i && scenes[i - 1].hold)));

  let state = 'off', clock = 0, last = 0, audio = null, silent = false, frozen = false, shownKey = '', swapAt = 0, wantedCaption = null;

  function set(next) {
    state = next;
    root.dataset.film = next;
    host.hidden = next === 'off';
    toggle.textContent = next === 'on' ? 'Pause' : next === 'ended' ? 'Revoir le film' : 'Reprendre le film';
    for (const opener of openers) if (opener.dataset.film === 'open') opener.hidden = next !== 'off';
  }

  /* where the page is at a given second: step i while it is held, between i - 1 and i while the camera travels */
  function placeAt(time) {
    let i = 0;
    while (i < steps.length - 1 && time >= steps[i + 1].from) i++;
    if (!i || time >= steps[i].arrive) return i;
    const share = clamp((time - steps[i].from) / (steps[i].arrive - steps[i].from));
    return i - 1 + (phased[i] ? share : ease(share));
  }
  function stepAt(time) {
    let i = 0;
    while (i < steps.length - 1 && time >= steps[i + 1].from) i++;
    return i;
  }

  function caption(time) {
    const i = stepAt(time), step = steps[i];
    if (time < step.voice - .15) return i && headings[i] && time > step.from + .5 ? {key: 'h' + i, heading: headings[i]} : null;
    for (let k = 0; k < step.lines.length; k++) {
      const line = step.lines[k], until = k + 1 < step.lines.length ? step.lines[k + 1].at - .15 : line.end + .9;
      if (time >= line.at - .15 && time < Math.min(until, line.end + 1.6)) return line.quiet ? null : {key: i + '.' + k, line};
    }
    return null;
  }
  function paint(now) {
    const next = frozen ? wantedCaption : caption(clock), key = next ? next.key : '';
    if (key === shownKey) return;
    if (block.classList.contains('is-on') && !frozen) { block.classList.remove('is-on'); swapAt = now + .24; shownKey = '~'; wantedCaption = next; return; }
    if (now < swapAt) return;
    shownKey = key;
    if (!next) { block.classList.remove('is-on'); return; }
    block.dataset.kind = next.heading ? 'chapter' : next.line.kind || 'line';
    chapter.textContent = next.heading ? next.heading.kicker : '';
    words.textContent = next.heading ? next.heading.title : next.line.text;
    under.textContent = next.heading ? '' : next.line.sub || '';
    block.classList.add('is-on');
  }

  function listen() {
    if (audio) return;
    audio = new Audio();
    audio.preload = 'auto';
    audio.src = FILM.audio;
    audio.addEventListener('error', () => { silent = true; });
    /* the system may stop the sound (a call, headphones pulled out): stop with it */
    audio.addEventListener('pause', () => { if (state === 'on' && !audio.ended && !silent && clock < FILM.length - 1) pause(); });
  }
  function seek(time) {
    clock = clamp(time, 0, FILM.length);
    if (!audio) return;
    const go = () => { try { audio.currentTime = Math.min(clock, (audio.duration || FILM.length) - .05); } catch {} };
    if (audio.readyState >= 1) go(); else audio.addEventListener('loadedmetadata', go, {once: true});
  }

  function play(time) {
    listen();
    if (time != null) seek(time);
    if (clock >= FILM.length - .5) seek(0);
    frozen = false;
    last = 0;
    set('on');
    onStart(placeAt(clock));
    const started = audio.play();
    if (started) started.then(() => { silent = false; }, () => { silent = true; });
  }
  function pause() {
    if (state !== 'on') return;
    set('paused');
    if (audio && !audio.paused) audio.pause();
    block.classList.remove('is-on');
    shownKey = '';
    onStop();
  }
  function close() {
    if (state === 'on') pause();
    set('off');
  }

  set('off');

  return {
    length: FILM.length,
    get playing() { return state === 'on'; },
    get time() { return clock; },
    get sounding() { return !!audio && !silent && !audio.paused && !audio.muted; },
    playFrom(time) { play(time); },
    /* Jump straight to a step/chapter while keeping the film playing */
    jump(index) {
      const i = clamp(Math.round(index), 0, steps.length - 1);
      const lead = headings[i] ? 1.4 : .6;
      play(i ? Math.max(steps[i].from, steps[i].voice - lead) : 0);
    },
    placeAt, stepAt,
    /* Called once per frame while playing: moves the clock and returns the place in the score. */
    frame(now) {
      if (state !== 'on') return null;
      const dt = last ? Math.min(.1, now - last) : 0;
      last = now;
      if (!frozen) {
        const sounding = audio && !silent && !audio.paused && !audio.ended;
        const stalled = audio && !silent && !audio.ended && (audio.paused || audio.readyState < 3);
        if (!stalled) clock += dt;
        if (sounding) {
          const drift = audio.currentTime - clock;
          clock = Math.abs(drift) > .4 ? audio.currentTime : clock + drift * .06;
        }
        if (clock >= FILM.length) { clock = FILM.length; set('ended'); if (audio) audio.pause(); block.classList.remove('is-on'); shownKey = ''; onStop(); return null; }
      }
      paint(now);
      const text = minutes(clock) + ' / ' + minutes(FILM.length);
      if (clockFace.textContent !== text) clockFace.textContent = text;
      return placeAt(clock);
    },
    /* Seconds since something was cued in a step, negative before it; null when there is no film to follow. */
    since(i, name) {
      if (state === 'off' || state === 'ended' || !(name in steps[i].cues)) return null;
      return clock - steps[i].cues[name];
    },
    /* How far a pinned picture has come in: 1 outside the film, 0 until its line is spoken. */
    pinned(i, id) {
      if (state !== 'on') return 1;
      const at = steps[i].pins[id];
      if (at == null) return 1;
      return clamp((clock - at) / .7);
    },
    /* Start, or pick up again. place is where the reader is in the score. */
    resume(place) {
      if (state === 'ended') return play(0);
      const near = Math.abs(placeAt(clock) - place) < .3 && state === 'paused';
      if (near) return play(null);
      /* elsewhere: the chapter the reader is in, from its first word, the camera already there */
      const i = clamp(Math.round(place), 0, steps.length - 1);
      play(i ? Math.max(steps[i].from, steps[i].voice - .6) : 0);
    },
    pause, close,
    toggle(place) { if (state === 'on') pause(); else this.resume(place); },
    mute() {
      listen();
      audio.muted = !audio.muted;
      sound.setAttribute('aria-pressed', String(audio.muted));
      sound.textContent = audio.muted ? 'Son coupé' : 'Son';
    },
    /* For checking a moment of the film without playing it. */
    preview(time) {
      clock = clamp(time, 0, FILM.length);
      frozen = true;
      last = 0;
      set('on');
      onStart(placeAt(clock));
      wantedCaption = caption(clock);
      shownKey = '~';
      swapAt = 0;
    }
  };
}
