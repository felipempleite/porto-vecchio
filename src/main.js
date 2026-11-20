/* Portivechju — Lettre à ceux qui reviennent.
   The page is ordinary HTML. This script reads the scroll position, turns it into a place
   in the score (scenes.js) and hands the result to the maquette (stage.js). Without WebGL,
   or when the reader asks for less motion, the same score is played with still images. */
import {Color} from 'three';
import {toLat, toLon, toX, toZ} from './geo.js';
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
const DEG = Math.PI / 180;

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

/* What the maquette is told besides the camera and the light; each is a number that scrolling blends. */
const DIALS = {era: 0, rise: 0, core: 0, streets: 0, fire: 0, lamp: 0, stretch: 1, walls: 0, salt: 0, rail: 0, folk: 0, tide: 0, sail: 0, guests: 0};
/* These wait for the camera to land when a scene asks for it (arrive). */
const LATE = new Set(['walls', 'salt', 'rail']);

/* Both ways of writing a camera come down to the same thing: a point looked at, and where the camera is around it.
   ground is the place whose height the camera is measured from; free cameras drift a little and make room for the text. */
function camera(cam) {
  if (!cam.eye) {
    return {
      lon: cam.at[0], lat: cam.at[1], ground: cam.at, lift: cam.lift || 0, y: cam.lift || 0, az: cam.az, el: cam.el, dist: cam.dist,
      fov: cam.fov || 30, frame: 0, free: 1, floor: cam.floor ?? .012, near: cam.near ?? Math.max(.003, cam.dist * .02)
    };
  }
  const heading = cam.heading * DEG, pitch = cam.pitch * DEG;
  const x = toX(cam.eye[0]) + cam.reach * Math.cos(pitch) * Math.sin(heading), z = toZ(cam.eye[1]) - cam.reach * Math.cos(pitch) * Math.cos(heading);
  const lift = cam.alt + cam.reach * Math.sin(pitch);
  return {
    lon: toLon(x), lat: toLat(z), ground: cam.eye, lift, y: lift, az: cam.heading + 180, el: -cam.pitch, dist: cam.reach,
    fov: cam.fov || 30, frame: cam.frame || 0, focus: cam.focus ?? .5, free: 0, floor: cam.floor ?? .0008, near: cam.near ?? .001
  };
}

const keys = steps.map(step => {
  const scene = SCENES[index.get(step.dataset.scene)];
  if (!scene) throw new Error('Scène inconnue : ' + step.dataset.scene);
  /* a scene may frame itself differently on an upright screen (tall) */
  const wide = camera(scene.cam), upright = scene.tall ? camera({...scene.cam, ...scene.tall}) : wide;
  const key = {scene, step, side: step.dataset.side || 'left', cam: wide, wide, upright, look: LOOKS[scene.look], labels: new Set(scene.labels || [])};
  for (const name in DIALS) key[name] = scene[name] ?? DIALS[name];
  return key;
});

const look = Object.fromEntries(Object.entries(LOOKS.aube).map(([name, value]) => [name, value.isColor ? new Color() : 0]));
const state = {cam: {sway: 0}, look, ...DIALS, shiftX: 0, shiftY: 0};

const stacked = () => narrow.matches || innerWidth < innerHeight;
/* A window narrower than the photograph shows a strip of it: which strip, and how far the camera must follow. */
function strip(cam) {
  const share = Math.min(1, innerWidth / innerHeight / cam.frame);
  const middle = clamp(cam.focus, share / 2, 1 - share / 2);
  return {slide: share < 1 ? (middle - share / 2) / (1 - share) : .5, shift: (.5 - middle) / share};
}
function shift(key) {
  if (key.cam.frame) return [strip(key.cam).shift, 0];
  if (!key.cam.free) return [0, 0];
  if (stacked()) return [0, key.side === 'centre' ? .1 : -.17];
  return [key.side === 'centre' ? 0 : key.side === 'right' ? -.17 : .17, 0];
}
/* A camera that stands in for a photograph sees what the photograph shows, however the window crops it. */
function field(cam) {
  if (!cam.frame) return cam.fov;
  return 2 * Math.atan(Math.tan(cam.fov * DEG / 2) * Math.min(1, cam.frame / (innerWidth / innerHeight))) / DEG;
}

function compose(at) {
  const i = Math.min(keys.length - 2, Math.floor(at)), raw = clamp(at - i), a = keys[i], b = keys[i + 1];
  /* a photograph may fade before the camera leaves (hold), or come in after it has landed (arrive) */
  const hold = a.scene.hold || 0, arrive = b.scene.arrive || 0;
  const t = hold || arrive ? ease(clamp((raw - hold) / (1 - hold - arrive))) : raw;
  const after = arrive ? clamp((raw - 1 + arrive) / arrive) : -1;
  /* once landed: first the walls, the salt, the rails; the houses last */
  const late = after < 0 ? t : ease(clamp(after / .7)), last = after < 0 ? t : ease(clamp((after - .55) / .45));
  const turn = ((b.cam.az - a.cam.az + 540) % 360) - 180;
  const free = lerp(a.cam.free, b.cam.free, t);
  const tall = lerp(1, clamp(1.3 / (innerWidth / innerHeight), 1, 2.1) ** .8, free);
  /* long journeys rise before they land, so the camera never skims through a hillside */
  const leap = Math.abs(Math.log(b.cam.dist / a.cam.dist)) + Math.hypot((b.cam.lon - a.cam.lon) * 83, (b.cam.lat - a.cam.lat) * 111) / Math.max(a.cam.dist, b.cam.dist);
  const arc = Math.sin(Math.PI * t) * Math.min(1, leap / 2.2);
  Object.assign(state.cam, {
    lon: lerp(a.cam.lon, b.cam.lon, t), lat: lerp(a.cam.lat, b.cam.lat, t), y: lerp(a.cam.y, b.cam.y, t),
    az: a.cam.az + turn * t, el: lerp(a.cam.el, b.cam.el, t) + arc * 13,
    dist: Math.exp(lerp(Math.log(a.cam.dist), Math.log(b.cam.dist), t)) * tall * (1 + arc * .35),
    fov: lerp(field(a.cam), field(b.cam), t), sway: reduced ? 0 : 1.1 * free,
    floor: lerp(a.cam.floor, b.cam.floor, t), near: Math.exp(lerp(Math.log(a.cam.near), Math.log(b.cam.near), t))
  });
  for (const name in look) {
    if (look[name].isColor) look[name].copy(a.look[name]).lerp(b.look[name], t);
    else look[name] = lerp(a.look[name], b.look[name], t);
  }
  for (const name in DIALS) state[name] = lerp(a[name], b[name], LATE.has(name) ? late : name === 'core' ? last : t);
  const [ax, ay] = shift(a), [bx, by] = shift(b);
  state.shiftX = lerp(ax, bx, t);
  state.shiftY = lerp(ay, by, t);
  return {i, t, raw, a, b, hold, arrive};
}

/* ---------- labels ---------- */

const labels = new Map();
for (const [id, label] of Object.entries(LABELS)) {
  const element = document.createElement('span');
  element.className = 'label label--' + label.kind;
  element.textContent = label.text;
  element.style.opacity = 0;
  labelsHost.append(element);
  labels.set(id, {...label, element, ground: 0, half: 0});
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

  const {t, raw, a, b, hold, arrive} = compose(shown);
  if (peek) {
    Object.assign(state.cam, peek.cam, {fov: field(peek.cam)});
    for (const name in DIALS) if (name in peek) state[name] = peek[name];
    if (peek.look) for (const name in look) { if (look[name].isColor) look[name].copy(LOOKS[peek.look][name]); else look[name] = LOOKS[peek.look][name]; }
    state.shiftX = peek.cam.frame ? strip(peek.cam).shift : 0;
    state.shiftY = 0;
  }

  /* photographs laid over the maquette */
  if (mode === '3d' && handover > 0) handover = Math.max(0, handover - dt / 1.2);
  const weights = new Map();
  const add = (name, weight) => { if (name && weight > 0) weights.set(name, Math.min(1, (weights.get(name) || 0) + weight)); };
  add(a.scene.plate, hold ? 1 - clamp(raw / hold) : 1 - raw);
  add(b.scene.plate, arrive ? clamp((raw - 1 + arrive) / arrive) : raw);
  let covered = 0;
  for (const weight of weights.values()) covered = Math.max(covered, weight);
  if (mode !== '3d' || handover > 0) {
    const share = mode === '3d' ? handover : 1;
    for (const [key, weight] of [[a, 1 - raw], [b, raw]]) if (!key.scene.plate) add(still(key), weight * share);
  }
  if (peek) { weights.clear(); if (peek.plate) weights.set(peek.plate, peek.mix ?? .5); }
  for (const [name, weight] of weights) plate(name).style.opacity = (peek ? weight : ease(weight)).toFixed(3);
  for (const [name, image] of plates) if (!weights.has(name) && image.style.opacity !== '0') image.style.opacity = 0;

  if (bar) bar.style.transform = `scaleX(${clamp(scrollY / Math.max(1, root.scrollHeight - innerHeight)).toFixed(4)})`;
  const current = Math.round(shown);
  if (root.dataset.scene !== keys[current].scene.id) { root.dataset.scene = keys[current].scene.id; root.dataset.side = keys[current].side; }

  if (mode !== '3d' || scrollY + 2 >= endTop) return;
  if (!moving && covered >= .999 && !peek) return;
  if (!moving && !peek && (idle ^= 1)) return;

  stage.apply(state, seconds);
  stage.render();

  for (const [id, label] of labels) {
    const weight = ((a.labels.has(id) ? 1 - t : 0) + (b.labels.has(id) ? t : 0)) * (1 - covered);
    if (weight < .02) { if (label.element.style.opacity !== '0') label.element.style.opacity = 0; continue; }
    const spot = stage.project(label.at[0], label.at[1], label.ground, label.lift);
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
  for (const key of keys) key.cam = stacked() ? key.upright : key.wide;
  for (const key of keys) if (key.cam.frame && key.scene.plate) plate(key.scene.plate).style.objectPosition = (strip(key.cam).slide * 100).toFixed(1) + '% 50%';
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
    for (const key of keys) for (const cam of [key.wide, key.upright]) cam.y = cam.lift + stage.heightAt(...cam.ground) * key.stretch;
    for (const label of labels.values()) label.ground = stage.heightAt(label.at[0], label.at[1]);
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
  /* A free look, for tuning: __lettre.peek({at: [lon, lat], az, el, dist, era, rise, look}), or with eye, alt, heading,
     pitch and reach. plate and mix lay a photograph over it. */
  peek(view) {
    peek = null;
    if (view) {
      const cam = camera(view);
      cam.y = cam.lift + stage.heightAt(...cam.ground) * (view.stretch ?? 1);
      peek = {...view, cam: {...cam, sway: 0}};
    }
    labelsHost.style.display = document.querySelector('.veil').style.display = view ? 'none' : '';
  },
  get state() { return {mode, shown, ratio, scene: keys[Math.round(Math.max(0, shown))].scene.id}; }
};
