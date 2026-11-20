/* Portivechju — Lettre à ceux qui reviennent.
   The page is ordinary HTML. This script reads the scroll position, turns it into a place
   in the score (scenes.js) and hands the result to the maquette (stage.js). Without WebGL,
   or when the reader asks for less motion, the same score is played with still images. */
import {Color} from 'three';
import {LABELS, LOOKS, SCENES} from './scenes.js';

const root = document.documentElement;
root.classList.replace('no-js', 'ready');
const query = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const steps = [...document.querySelectorAll('main [data-scene]')];
const canvas = document.getElementById('maquette');
const platesHost = document.getElementById('plates');
const labelsHost = document.getElementById('labels');
const bar = document.querySelector('.progress span');
const index = new Map(SCENES.map((scene, i) => [scene.id, i]));

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);

/* ---------- images ---------- */

const narrow = matchMedia('(max-width: 760px)');
const WIDEST = {'rue-camille': 1280};
function source(name) {
  const [folder, file] = name.split('/');
  if (folder === 'relief') return `assets/relief/${file}.webp`;
  return `assets/img/${file}-${narrow.matches ? 960 : WIDEST[file] || 1920}.webp`;
}
const plates = new Map();
function plate(name) {
  let image = plates.get(name);
  if (!image) {
    image = new Image();
    image.alt = '';
    image.decoding = 'async';
    image.className = 'plate plate--' + name.split('/')[0];
    image.dataset.name = name.split('/')[1];
    image.style.opacity = 0;
    image.src = source(name);
    platesHost.append(image);
    plates.set(name, image);
  }
  return image;
}

/* ---------- the score ---------- */

const keys = steps.map(step => {
  const scene = SCENES[index.get(step.dataset.scene)];
  if (!scene) throw new Error('Scène inconnue : ' + step.dataset.scene);
  return {
    scene, step,
    side: step.dataset.side || 'left',
    cam: {lon: scene.cam.at[0], lat: scene.cam.at[1], y: scene.cam.lift, az: scene.cam.az, el: scene.cam.el, dist: scene.cam.dist, fov: scene.cam.fov || 30},
    look: LOOKS[scene.look],
    era: scene.era || 0, rise: scene.rise || 0, core: scene.core || 0, streets: scene.streets || 0, fire: scene.fire || 0, lamp: scene.lamp || 0,
    labels: new Set(scene.labels || [])
  };
});

const look = Object.fromEntries(Object.entries(LOOKS.aube).map(([name, value]) => [name, value.isColor ? new Color() : 0]));
const state = {cam: {sway: 0}, look, era: 0, rise: 0, core: 0, streets: 0, fire: 0, lamp: 0, shiftX: 0, shiftY: 0};

const stacked = () => narrow.matches || innerWidth < innerHeight;
function shift(key) {
  if (stacked()) return [0, key.side === 'centre' ? .1 : -.17];
  return [key.side === 'centre' ? 0 : key.side === 'right' ? -.17 : .17, 0];
}

function compose(at) {
  const i = Math.min(keys.length - 2, Math.floor(at)), t = clamp(at - i), a = keys[i], b = keys[i + 1];
  const turn = ((b.cam.az - a.cam.az + 540) % 360) - 180;
  const tall = clamp(1.3 / (innerWidth / innerHeight), 1, 2.1) ** .8;
  /* long journeys rise before they land, so the camera never skims through a hillside */
  const leap = Math.abs(Math.log(b.cam.dist / a.cam.dist)) + Math.hypot((b.cam.lon - a.cam.lon) * 83, (b.cam.lat - a.cam.lat) * 111) / Math.max(a.cam.dist, b.cam.dist);
  const arc = Math.sin(Math.PI * t) * Math.min(1, leap / 2.2);
  Object.assign(state.cam, {
    lon: lerp(a.cam.lon, b.cam.lon, t), lat: lerp(a.cam.lat, b.cam.lat, t), y: lerp(a.cam.y, b.cam.y, t),
    az: a.cam.az + turn * t, el: lerp(a.cam.el, b.cam.el, t) + arc * 13,
    dist: Math.exp(lerp(Math.log(a.cam.dist), Math.log(b.cam.dist), t)) * tall * (1 + arc * .35),
    fov: lerp(a.cam.fov, b.cam.fov, t), sway: reduced ? 0 : 1.1
  });
  for (const name in look) {
    if (look[name].isColor) look[name].copy(a.look[name]).lerp(b.look[name], t);
    else look[name] = lerp(a.look[name], b.look[name], t);
  }
  for (const name of ['era', 'rise', 'core', 'streets', 'fire', 'lamp']) state[name] = lerp(a[name], b[name], t);
  const [ax, ay] = shift(a), [bx, by] = shift(b);
  state.shiftX = lerp(ax, bx, t);
  state.shiftY = lerp(ay, by, t);
  return {i, t, a, b};
}

/* ---------- labels ---------- */

const labels = new Map();
for (const [id, label] of Object.entries(LABELS)) {
  const element = document.createElement('span');
  element.className = 'label label--' + label.kind;
  element.textContent = label.text;
  element.style.opacity = 0;
  labelsHost.append(element);
  labels.set(id, {...label, element, y: 0, half: 0});
}

/* ---------- scroll ---------- */

let centres = [];
function measure() {
  centres = steps.map(step => {
    const card = step.querySelector('.card') || step, box = card.getBoundingClientRect();
    /* On a phone the card rises over the maquette: the scene must be in place as it arrives, not once it fills the screen. */
    const anchor = stacked() && !step.classList.contains('step--title') ? Math.min(box.height / 2, innerHeight * .12) : box.height / 2;
    return box.top + scrollY + anchor;
  });
  for (const label of labels.values()) label.half = label.element.offsetWidth / 2;
  const end = document.getElementById('credits');
  endTop = end ? end.getBoundingClientRect().top + scrollY : Infinity;
}
function wanted() {
  const y = scrollY + innerHeight * .5;
  if (y <= centres[0]) return 0;
  for (let i = 0; i < centres.length - 1; i++) {
    if (y < centres[i + 1]) return i + ease(clamp(((y - centres[i]) / (centres[i + 1] - centres[i]) - .22) / .56));
  }
  return centres.length - 1;
}

/* ---------- drawing ---------- */

let peek = null;
let stage = null, mode = 'stills', shown = -1, handover = 1, last = 0, slow = 0, ratio = 1, sized = [0, 0], endTop = Infinity, idle = 0;

function still(key) { return key.scene.plate || key.scene.still; }

function draw(now) {
  requestAnimationFrame(draw);
  const seconds = now / 1000, dt = Math.min(.1, seconds - last || .016);
  last = seconds;
  const goal = wanted();
  const before = shown;
  if (shown < 0 || reduced || mode !== '3d' || query.has('net')) shown = goal;
  else shown += (goal - shown) * (1 - Math.exp(-dt * 5.5));
  if (Math.abs(goal - shown) < 4e-4) shown = goal;
  const moving = Math.abs(shown - before) > 1e-5;

  const {t, a, b} = compose(shown);
  if (peek) {
    Object.assign(state.cam, peek.cam);
    for (const name of ['era', 'rise', 'core', 'streets', 'fire', 'lamp']) if (name in peek) state[name] = peek[name];
    if (peek.look) for (const name in look) { if (look[name].isColor) look[name].copy(LOOKS[peek.look][name]); else look[name] = LOOKS[peek.look][name]; }
    state.shiftX = state.shiftY = 0;
  }

  /* photographs laid over the maquette */
  if (mode === '3d' && handover > 0) handover = Math.max(0, handover - dt / 1.2);
  const weights = new Map();
  const add = (name, weight) => { if (name && weight > 0) weights.set(name, Math.min(1, (weights.get(name) || 0) + weight)); };
  add(a.scene.plate, 1 - t); add(b.scene.plate, t);
  let covered = 0;
  for (const weight of weights.values()) covered = Math.max(covered, weight);
  if (mode !== '3d' || handover > 0) {
    const share = mode === '3d' ? handover : 1;
    for (const [key, weight] of [[a, 1 - t], [b, t]]) if (!key.scene.plate) add(still(key), weight * share);
  }
  for (const [name, weight] of weights) plate(name).style.opacity = ease(weight).toFixed(3);
  for (const [name, image] of plates) if (!weights.has(name) && image.style.opacity !== '0') image.style.opacity = 0;

  if (bar) bar.style.transform = `scaleX(${clamp(scrollY / Math.max(1, root.scrollHeight - innerHeight)).toFixed(4)})`;
  const current = Math.round(shown);
  if (root.dataset.scene !== keys[current].scene.id) root.dataset.scene = keys[current].scene.id;

  if (mode !== '3d' || scrollY + 2 >= endTop) return;
  if (!moving && covered >= .999 && !peek) return;
  if (!moving && !peek && (idle ^= 1)) return;

  stage.apply(state, seconds);
  stage.render();

  for (const [id, label] of labels) {
    const weight = ((a.labels.has(id) ? 1 - t : 0) + (b.labels.has(id) ? t : 0)) * (1 - covered);
    if (weight < .02) { if (label.element.style.opacity !== '0') label.element.style.opacity = 0; continue; }
    const spot = stage.project(label.at[0], label.at[1], label.y);
    label.element.style.opacity = spot.visible ? ease(clamp(weight * 1.6 - .6)).toFixed(3) : 0;
    const x = Math.min(innerWidth - label.half - 8, Math.max(label.half + 8, spot.x));
    label.element.style.transform = `translate(${x.toFixed(1)}px, ${spot.y.toFixed(1)}px)`;
  }

  /* weak machines: give up sharpness before smoothness */
  slow = dt > .034 ? slow + 1 : Math.max(0, slow - 2);
  if (slow > 45 && ratio > 1) { slow = 0; ratio = Math.max(1, ratio - .25); fit(true); }
}

function fit(force) {
  if (!stage) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!force && w === sized[0] && Math.abs(h - sized[1]) < 130) return;
  sized = [w, h];
  stage.resize(w, h, ratio);
}

function arrange() {
  measure();
  fit(false);
}

/* ---------- start ---------- */

const reveal = new IntersectionObserver(entries => {
  for (const entry of entries) entry.target.classList.toggle('is-in', entry.isIntersecting);
}, {rootMargin: '-12% 0px -12% 0px'});
steps.forEach(step => reveal.observe(step));

document.querySelectorAll('.toc a').forEach(link => link.addEventListener('click', () => link.closest('details')?.removeAttribute('open')));

addEventListener('resize', arrange);
addEventListener('load', arrange);
document.fonts?.ready.then(arrange);
arrange();
root.dataset.stage = 'stills';
requestAnimationFrame(draw);

function webgl() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

async function begin() {
  if (reduced || query.has('fixe') || !webgl()) return;
  root.dataset.stage = 'loading';
  try {
    const weak = narrow.matches || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    const {createStage} = await import('./stage.js');
    stage = await createStage(canvas, {
      quality: weak ? 'low' : 'high',
      onLost() { mode = 'stills'; handover = 1; root.dataset.stage = 'stills'; }
    });
    ratio = Math.min(devicePixelRatio || 1, weak ? 1.5 : 2);
    for (const key of keys) key.cam.y += stage.heightAt(key.cam.lon, key.cam.lat);
    for (const label of labels.values()) label.y = stage.heightAt(label.at[0], label.at[1]) + label.lift;
    fit(true);
    stage.apply((compose(Math.max(0, shown)), state), 0);
    stage.render();
    mode = '3d';
    root.dataset.stage = '3d';
  } catch (error) {
    console.warn('La maquette n’a pas pu être affichée ; la lettre continue en images.', error);
    root.dataset.stage = 'stills';
  }
}
begin();

/* For checking a scene by name: __lettre.go('sel') */
window.__lettre = {
  go(id) { this.peek(null); const step = steps[keys.findIndex(key => key.scene.id === id)]; step?.scrollIntoView({block: 'center', behavior: 'instant'}); shown = -1; },
  /* Between two steps: __lettre.between('fievre', .5) */
  between(id, share) {
    this.peek(null);
    const i = keys.findIndex(key => key.scene.id === id);
    scrollTo({top: centres[i] + (centres[i + 1] - centres[i]) * share - innerHeight / 2, behavior: 'instant'});
    shown = -1;
  },
  /* A free look, for tuning: __lettre.peek({at: [lon, lat], az, el, dist, era, rise, look}) */
  peek(view) {
    peek = view && {...view, cam: {lon: view.at[0], lat: view.at[1], y: stage.heightAt(...view.at) + (view.lift || 0), az: view.az, el: view.el, dist: view.dist, fov: view.fov || 30, sway: 0}};
    platesHost.style.display = labelsHost.style.display = view ? 'none' : '';
  },
  get state() { return {mode, shown, ratio, scene: keys[Math.round(Math.max(0, shown))].scene.id}; }
};
