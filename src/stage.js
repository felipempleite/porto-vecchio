/* The maquette: one WebGL scene that the letter drives from start to finish.
   Everything here is a function of the state passed to apply(). What moves on its own is small:
   the breathing of the camera, the fire of 31 July, the light on the water, and the beads that
   travel while a scene asks for them (the people of the mountain, one ship, a train, the summer crowd). */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {BELL_TOWER, EXAGGERATION, HEART, SALT_FIELD, STREET_ABBATUCCI, STREET_HOME, toLat, toLon, toX, toZ} from './geo.js';
import {BASTIONS, PATHS, RAIL, ROADS, SEAWAY, WALLS} from './traces.js';

const SEA = new THREE.Color().setRGB(.313, .401, .344);
const ERAS = ['terrier', '1951', '1975', '2024'];
const PRINTED = new Set(['Patine du relief', 'Terre du golfe', 'Eau du golfe', 'Ouvrages du port']);
const DEG = Math.PI / 180;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (lo, hi, v) => { const t = clamp((v - lo) / (hi - lo)); return t * t * (3 - 2 * t); };
const fract = v => v - Math.floor(v);
/* For shaders that write their own colour: the value as it should reach the screen. */
const paint = hex => new THREE.Color(hex).convertLinearToSRGB();
/* The aerial photographs are dark; lift them so they sit with the plaster. */
const LIFT = [1, 1, 1.55, 1.5, 1.6];

/* ---------- shaders grafted onto the standard material ---------- */

/* Plaster, with the hint of maquis and bare rock: one ramp for the tile and for the country around it. */
const TINTS = [[0, '#ddd3bc'], [140, '#d3cbb1'], [450, '#c2c0a4'], [850, '#b3b49b'], [1200, '#c9c5b4'], [1500, '#e4e0d4']]
  .map(([h, hex]) => [h, new THREE.Color(hex)]);
const glslColour = colour => `vec3(${colour.r.toFixed(4)}, ${colour.g.toFixed(4)}, ${colour.b.toFixed(4)})`;
const tintGlsl = 'vec3 plasterTint(float h) {\n  vec3 c = ' + glslColour(TINTS[0][1]) + ';\n' + TINTS.slice(1).map(([h, colour], i) =>
  `  c = mix(c, ${glslColour(colour)}, smoothstep(${(TINTS[i][0] * EXAGGERATION / 1000).toFixed(4)}, ${(h * EXAGGERATION / 1000).toFixed(4)}, h));`).join('\n') + '\n  return c;\n}\n';

/* Level lines engraved in the plaster: every 10 m and every 50 m of real height. */
const contourGlsl = tintGlsl + /* glsl */`
float grainHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float grainNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(grainHash(i), grainHash(i + vec2(1., 0.)), f.x), mix(grainHash(i + vec2(0., 1.)), grainHash(i + vec2(1., 1.)), f.x), f.y);
}
float levelLine(float h, float interval, float width) {
  float v = h / interval, w = fwidth(v);
  float line = 1. - smoothstep(width - .5, width + .5, abs(fract(v - .5) - .5) / max(w, 1e-6));
  return line * clamp(1. - w * 2.2, 0., 1.);
}
float levelLines(float h) {
  if (h < .0012) return 0.;
  return max(max(levelLine(h, .004, .5) * .42, levelLine(h, .02, .55) * .55), max(levelLine(h, .1, .9), levelLine(h, .5, 1.2)));
}
/* The surface of the maquette: tint by height, a little unevenness, level lines. */
vec3 plaster(vec3 at, float land) {
  vec3 colour = mix(${glslColour(SEA)}, plasterTint(at.y), land);
  float mottle = .45 * grainNoise(at.xz * 6.) + .25 * grainNoise(at.xz * 19. + 3.) + .18 * grainNoise(at.xz * 53. + 8.) + .12 * grainNoise(at.xz * 210. + 2.);
  return colour * mix(1., .92 + .14 * mottle, land) * (1. - .3 * levelLines(at.y) * land);
}
`;

const eraHead = contourGlsl + /* glsl */`
uniform sampler2D uMapA, uMapB;
uniform float uUseA, uUseB, uMix, uSide, uPrint, uPatina, uLiftA, uLiftB;
uniform vec2 uHeart;
uniform vec4 uBox;
uniform vec3 uInk;
varying vec2 vEraUv;
varying vec3 vEraPos;
/* 1 where the newer map has already soaked through. It spreads from the old town like ink in paper. */
float eraGrain() {
  return .5 * grainNoise(vEraPos.xz * 3.1) + .27 * grainNoise(vEraPos.xz * 7.3 + 5.) + .15 * grainNoise(vEraPos.xz * 17. + 11.) + .08 * grainNoise(vEraPos.xz * 41.);
}
float eraArrived(float grain) {
  float away = distance(vEraPos.xz, uHeart) / 2.7;
  float front = mix(-.3, 1.3, uMix);
  return 1. - smoothstep(front - .012, front + .012, away + (grain - .5) * .42);
}
/* The print stops short of the edge of the tile, the way ink stops on plaster. */
float eraMargin(float grain) {
  vec2 p = vEraPos.xz;
  float inside = min(min(p.x - uBox.x, uBox.z - p.x), min(p.y - uBox.y, uBox.w - p.y));
  return smoothstep(.02, .2, inside + (grain - .5) * .3);
}
`;
const eraBody = /* glsl */`
float eraGrainHere = eraGrain();
float eraHere = eraArrived(eraGrainHere);
if (uSide < -.5 && eraHere > .5) discard;
if (uSide > .5 && eraHere < .5) discard;
if (uPrint > .5) {
  float eraKeep = eraMargin(eraGrainHere);
  vec3 eraBare = uPatina > 1.5 ? ${glslColour(SEA)} : uPatina > .5 ? plaster(vEraPos, 1. - (1. - smoothstep(.12, .2, distance(diffuseColor.rgb, vec3(.313, .401, .344)))) * (1. - smoothstep(.001, .003, vEraPos.y))) : diffuseColor.rgb;
  vec3 eraA = mix(eraBare, min(texture2D(uMapA, vEraUv).rgb * uLiftA, 1.), uUseA * eraKeep);
  vec3 eraB = mix(eraBare, min(texture2D(uMapB, vEraUv).rgb * uLiftB, 1.), uUseB * eraKeep);
  diffuseColor.rgb = mix(eraA, eraB, eraHere);
  diffuseColor.rgb = mix(diffuseColor.rgb, uInk, eraHere * (1. - eraHere) * 2.6);
}
`;

const riseHead = /* glsl */`
attribute float aGround;
uniform float uRise, uCore;
uniform vec2 uHeart;
varying vec3 vBuilt;
varying vec2 vFacing;
varying float vAbove;
`;
const riseBody = /* glsl */`
float riseAway = distance(transformed.xz, uHeart);
float riseNow = clamp((uRise * 3.4 - riseAway) / .55, 0., 1.);
riseNow = riseNow * riseNow * (3. - 2. * riseNow);
riseNow = max(riseNow, uCore * (1. - smoothstep(.15, .19, riseAway)));
vAbove = transformed.y - aGround;
transformed.y = mix(aGround - .006, transformed.y, riseNow);
vBuilt = transformed;
vFacing = normal.xz;
`;
/* The walls go up in turn, around the rock, starting at the gate. */
const wallHead = /* glsl */`
attribute float aGround, aTurn;
uniform float uWalls;
`;
const wallBody = /* glsl */`
float wallNow = smoothstep(aTurn * .7, aTurn * .7 + .3, uWalls);
transformed.y = mix(aGround - .004, transformed.y, wallNow);
`;
const windowHead = /* glsl */`
uniform float uNight;
varying vec3 vBuilt;
varying vec2 vFacing;
varying float vAbove;
float paneHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 23758.5453); }
`;
const windowBody = /* glsl */`
if (uNight > .003) {
  float along = abs(vFacing.x) > abs(vFacing.y) ? vBuilt.z : vBuilt.x;
  vec2 pane = vec2(along / .0042, vAbove / .0052);
  vec2 cell = floor(pane), inside = fract(pane);
  float chance = paneHash(cell + floor(vBuilt.xz * 40.));
  float lit = step(.78, chance) * (.45 + .55 * fract(chance * 37.));
  lit *= smoothstep(.2, .3, inside.x) * smoothstep(.8, .7, inside.x) * smoothstep(.28, .38, inside.y) * smoothstep(.86, .76, inside.y);
  totalEmissiveRadiance += vec3(1., .62, .27) * lit * uNight * 2.6;
}
`;

const skyVertex = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  gl_Position.z = gl_Position.w;
}
`;
const skyFragment = /* glsl */`
uniform vec3 uTop, uHorizon, uSunColor, uSunDir;
uniform float uStars, uGlow;
varying vec3 vDir;
float skyHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  vec3 colour = mix(uHorizon, uTop, pow(smoothstep(0., .8, d.y), .6));
  colour = mix(colour, uHorizon, smoothstep(.02, -.12, d.y));
  float sun = max(dot(d, uSunDir), 0.);
  colour += uSunColor * (pow(sun, 420.) * 2.2 + pow(sun, 18.) * .32) * uGlow;
  if (uStars > .003) {
    vec2 grid = vec2(atan(d.z, d.x), asin(clamp(d.y, -1., 1.))) * 70.;
    vec2 cell = floor(grid);
    vec2 spot = fract(grid) - .5 - (vec2(skyHash(cell + 1.7), skyHash(cell + 9.2)) - .5) * .7;
    float star = step(.9, skyHash(cell)) * smoothstep(.09, 0., length(spot)) * (.35 + .65 * skyHash(cell + 4.4));
    colour += vec3(.92, .95, 1.) * star * uStars * smoothstep(.0, .25, d.y) * 1.6;
  }
  gl_FragColor = vec4(colour, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/* Beads that travel across the maquette, and one small ship. */
const beadVertex = /* glsl */`
attribute vec3 aColour;
attribute float aSize, aAlpha, aKind;
uniform float uScale;
varying vec3 vColour;
varying float vAlpha, vKind;
void main() {
  vColour = aColour; vAlpha = aAlpha; vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.);
  gl_PointSize = aSize * uScale;
}
`;
const beadFragment = /* glsl */`
varying vec3 vColour;
varying float vAlpha, vKind;
const vec3 INK = vec3(.17, .11, .08), RIM = vec3(.98, .95, .88);
void main() {
  vec2 p = gl_PointCoord;
  if (vKind > .5) {
    float e = .05;
    float mainsail = smoothstep(0., e, .48 - p.x) * smoothstep(0., e, .66 - p.y) * smoothstep(0., e, p.x - (.12 + (.66 - p.y) * .6));
    float jib = smoothstep(0., e, p.x - .54) * smoothstep(0., e, .66 - p.y) * smoothstep(0., e, (.54 + (p.y - .22) * .62) - p.x);
    float hull = smoothstep(0., e, p.y - .72) * smoothstep(0., e, .9 - p.y) * smoothstep(0., e, p.x - (.08 + (p.y - .72) * .8)) * smoothstep(0., e, (.92 - (p.y - .72) * .8) - p.x);
    float sails = max(mainsail, jib);
    gl_FragColor = vec4(mix(INK, vColour, sails), max(sails, hull) * vAlpha);
    return;
  }
  float d = length(p - .5) * 2.;
  float body = 1. - smoothstep(.5, .68, d), rim = 1. - smoothstep(.84, 1., d);
  gl_FragColor = vec4(mix(RIM, vColour, body), vAlpha * mix(rim * .8, 1., body));
}
`;

/* The railway, drawn the way maps draw one: a line with its sleepers. */
const railVertex = /* glsl */`
varying vec2 vRail;
void main() {
  vRail = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}
`;
const railFragment = /* glsl */`
uniform float uDrawn, uFade;
uniform vec3 uInk;
varying vec2 vRail;
void main() {
  if (vRail.y > uDrawn) discard;
  float across = abs(vRail.x);
  float line = 1. - smoothstep(.2, .34, across);
  float sleeper = (1. - smoothstep(.24, .32, abs(fract(vRail.y / .14) - .5))) * (1. - smoothstep(.8, 1., across));
  float head = 1. - smoothstep(0., .25, uDrawn - vRail.y);
  gl_FragColor = vec4(uInk, max(line, sleeper) * uFade * (1. - head * .6));
}
`;

/* Salt: basins that whiten one after the other. */
const saltVertex = /* glsl */`
attribute float aOrder, aTone;
uniform float uSalt;
varying float vSalt, vTone;
void main() {
  vTone = aTone;
  vSalt = smoothstep(aOrder * .78, aOrder * .78 + .22, uSalt);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}
`;
const saltFragment = /* glsl */`
uniform vec3 uWhite;
varying float vSalt, vTone;
void main() {
  if (vSalt < .004) discard;
  /* some basins still hold water, others have dried to salt */
  gl_FragColor = vec4(mix(uWhite, vec3(.74, .8, .79), vTone * vTone * .8), vSalt * .9);
}
`;

/* Sunlight broken up on the water, strongest when the sun is low. */
const glitterVertex = /* glsl */`
varying vec3 vSea;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.);
  vSea = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
const glitterFragment = /* glsl */`
uniform vec3 uSunDir, uSunColor;
uniform float uGlitter, uTime;
varying vec3 vSea;
float seaHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float seaNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(seaHash(i), seaHash(i + vec2(1., 0.)), f.x), mix(seaHash(i + vec2(0., 1.)), seaHash(i + vec2(1., 1.)), f.x), f.y);
}
void main() {
  vec3 toEye = cameraPosition - vSea;
  float span = length(toEye);
  vec3 view = toEye / span;
  /* small ripples tilt the surface; where one of them throws the sun at the eye, it sparkles */
  vec2 p = vSea.xz * 520.;
  vec2 tilt = vec2(seaNoise(p + uTime * vec2(.9, .4)) - .5, seaNoise(p + 31.7 - uTime * vec2(.5, .8)) - .5) * .2
    + vec2(seaNoise(p * .17 - uTime * .15) - .5, seaNoise(p * .17 + 7.3 + uTime * .12) - .5) * .1;
  vec3 normal = normalize(vec3(tilt.x, 1., tilt.y));
  float glint = pow(max(dot(reflect(-view, normal), uSunDir), 0.), 160.);
  float light = glint * 1.5 * uGlitter * smoothstep(40., 6., span);
  gl_FragColor = vec4(mix(uSunColor, vec3(1.), .35) * light, 1.);
}
`;

/* ---------- helpers ---------- */

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image introuvable : ' + url));
    image.src = url;
  });
}

async function loadRegion(base) {
  const [meta, image] = await Promise.all([
    fetch(new URL('region.json', base)).then(r => r.json()),
    loadImage(new URL('region.png', base).href)
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = meta.width; canvas.height = meta.height;
  const context = canvas.getContext('2d', {willReadFrequently: true, colorSpace: 'srgb'});
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, meta.width, meta.height).data;
  const metres = new Float32Array(meta.width * meta.height);
  for (let i = 0; i < metres.length; i++) metres[i] = (pixels[i * 4] * 256 + pixels[i * 4 + 1]) * meta.metresPerUnit;
  return {...meta, metres};
}

function sampler(region) {
  const {west, south, east, north, width, height, metres} = region;
  return (lon, lat) => {
    const fx = Math.min(width - 1.001, Math.max(0, (lon - west) / (east - west) * (width - 1)));
    const fy = Math.min(height - 1.001, Math.max(0, (north - lat) / (north - south) * (height - 1)));
    const x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y, i = y * width + x;
    return (metres[i] * (1 - tx) + metres[i + 1] * tx) * (1 - ty) + (metres[i + width] * (1 - tx) + metres[i + width + 1] * tx) * ty;
  };
}

function tint(metresHigh, out) {
  for (let i = 1; i < TINTS.length; i++) {
    if (metresHigh <= TINTS[i][0] || i === TINTS.length - 1) {
      const [h0, c0] = TINTS[i - 1], [h1, c1] = TINTS[i];
      return out.copy(c0).lerp(c1, Math.min(1, Math.max(0, (metresHigh - h0) / (h1 - h0))));
    }
  }
  return out.copy(TINTS[0][1]);
}

function buildRegion(region, step, hole, box, townHeight) {
  const {west, south, east, north, width, height, metres} = region;
  const cols = Math.floor((width - 1) / step) + 1, rows = Math.floor((height - 1) / step) + 1;
  const position = new Float32Array(cols * rows * 3), colour = new Float32Array(cols * rows * 3);
  const inside = new Uint8Array(cols * rows), under = new Uint8Array(cols * rows);
  const shade = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c, h = metres[r * step * width + c * step];
      const x = toX(west + (east - west) * c * step / (width - 1));
      const z = toZ(north - (north - south) * r * step / (height - 1));
      inside[i] = x > hole.min.x && x < hole.max.x && z > hole.min.z && z < hole.max.z ? 1 : 0;
      under[i] = x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z ? 1 : 0;
      position[i * 3] = x;
      position[i * 3 + 1] = h > 0 ? h * EXAGGERATION / 1000 : -.012;
      position[i * 3 + 2] = z;
      if (h > 0) tint(h, shade); else shade.copy(SEA);
      colour[i * 3] = shade.r; colour[i * 3 + 1] = shade.g; colour[i * 3 + 2] = shade.b;
    }
  }
  /* Stitch to the tile: the first row of points under it is pulled onto its edge, at its height;
     the rest runs a little below it. */
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      if (!under[i]) continue;
      let x = position[i * 3], z = position[i * 3 + 2], edge = false;
      if (!under[i - 1]) { x = box.min.x; edge = true; }
      if (!under[i + 1]) { x = box.max.x; edge = true; }
      if (!under[i - cols]) { z = box.min.z; edge = true; }
      if (!under[i + cols]) { z = box.max.z; edge = true; }
      const ground = townHeight(x, z);
      position[i * 3] = x;
      position[i * 3 + 1] = ground < .0005 ? -.012 : ground - (edge ? .0012 : .008);
      position[i * 3 + 2] = z;
    }
  }
  const index = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      if (inside[a] && inside[b] && inside[d] && inside[e]) continue;
      index.push(a, d, b, b, d, e);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1));
  geometry.computeVertexNormals();
  return geometry;
}

/* Height of the town tile on a regular grid, so that houses know where the ground is. */
function rasterise(meshes, box, size) {
  const grid = new Float32Array(size * size).fill(NaN);
  const spanX = box.max.x - box.min.x, spanZ = box.max.z - box.min.z;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const mesh of meshes) {
    const {position} = mesh.geometry.attributes, index = mesh.geometry.index;
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const ia = index ? index.getX(i) : i, ib = index ? index.getX(i + 1) : i + 1, ic = index ? index.getX(i + 2) : i + 2;
      a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld);
      const ax = (a.x - box.min.x) / spanX * (size - 1), az = (a.z - box.min.z) / spanZ * (size - 1);
      const bx = (b.x - box.min.x) / spanX * (size - 1), bz = (b.z - box.min.z) / spanZ * (size - 1);
      const cx = (c.x - box.min.x) / spanX * (size - 1), cz = (c.z - box.min.z) / spanZ * (size - 1);
      const area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
      const z0 = Math.max(0, Math.floor(Math.min(az, bz, cz))), z1 = Math.min(size - 1, Math.ceil(Math.max(az, bz, cz)));
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const u = ((bx - x) * (cz - z) - (cx - x) * (bz - z)) / area;
          const v = ((cx - x) * (az - z) - (ax - x) * (cz - z)) / area;
          const w = 1 - u - v;
          if (u < -.02 || v < -.02 || w < -.02) continue;
          const y = u * a.y + v * b.y + w * c.y, at = z * size + x;
          if (!(grid[at] >= y)) grid[at] = y;
        }
      }
    }
  }
  /* cells no triangle reached take the height of their neighbours */
  for (let pass = 0; pass < 12; pass++) {
    let holes = 0;
    const before = grid.slice();
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const at = z * size + x;
        if (!Number.isNaN(before[at])) continue;
        let sum = 0, count = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= size || nz >= size || Number.isNaN(before[nz * size + nx])) continue;
          sum += before[nz * size + nx]; count++;
        }
        if (count) grid[at] = sum / count; else holes++;
      }
    }
    if (!holes) break;
  }
  for (let i = 0; i < grid.length; i++) if (Number.isNaN(grid[i])) grid[i] = 0;
  return (x, z) => {
    const fx = Math.min(size - 1.001, Math.max(0, (x - box.min.x) / spanX * (size - 1)));
    const fz = Math.min(size - 1.001, Math.max(0, (z - box.min.z) / spanZ * (size - 1)));
    const gx = Math.floor(fx), gz = Math.floor(fz), tx = fx - gx, tz = fz - gz, i = gz * size + gx;
    return (grid[i] * (1 - tx) + grid[i + 1] * tx) * (1 - tz) + (grid[i + size] * (1 - tx) + grid[i + size + 1] * tx) * tz;
  };
}

/* Houses arrive quantised; bake them into plain kilometres so the shader can reason in world space. */
function bake(mesh, groundAt) {
  const source = mesh.geometry, from = source.attributes.position, fromNormal = source.attributes.normal;
  const position = new Float32Array(from.count * 3), normal = new Float32Array(from.count * 3), ground = new Float32Array(from.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < from.count; i++) {
    v.fromBufferAttribute(from, i).applyMatrix4(mesh.matrixWorld);
    position.set([v.x, v.y, v.z], i * 3);
    ground[i] = Math.min(v.y, groundAt(v.x, v.z));
    v.fromBufferAttribute(fromNormal, i).transformDirection(mesh.matrixWorld);
    normal.set([v.x, v.y, v.z], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('aGround', new THREE.BufferAttribute(ground, 1));
  geometry.setIndex(source.index);
  return geometry;
}

function densify(points, step) {
  const fine = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const pieces = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step));
    for (let k = 0; k < pieces; k++) fine.push([x0 + (x1 - x0) * k / pieces, z0 + (z1 - z0) * k / pieces]);
  }
  fine.push(points[points.length - 1]);
  return fine;
}

/* A flat band laid along a line. uv.x runs from -1 to 1 across it, uv.y is kilometres along it. */
function ribbon(points, groundAt, width, lift, step = .004) {
  const fine = densify(points, step);
  const position = [], uv = [], index = [];
  let along = 0;
  fine.forEach(([x, z], i) => {
    const [px, pz] = fine[Math.max(0, i - 1)], [nx, nz] = fine[Math.min(fine.length - 1, i + 1)];
    const length = Math.hypot(nx - px, nz - pz) || 1, ox = -(nz - pz) / length * width / 2, oz = (nx - px) / length * width / 2;
    const y = groundAt(x, z) + lift;
    if (i) along += Math.hypot(x - fine[i - 1][0], z - fine[i - 1][1]);
    position.push(x + ox, y, z + oz, x - ox, y, z - oz);
    uv.push(-1, along, 1, along);
    if (i) index.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2, i * 2 - 1, i * 2 + 1);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.userData.length = along;
  return geometry;
}

/* The walls of 1541–1544 where they still stand, from the lines and outlines of OpenStreetMap:
   a face down to the lower ground, a parapet a little above the higher. */
function buildWalls(groundAt) {
  const position = [], ground = [], turn = [];
  const hx = toX(HEART[0]), hz = toZ(HEART[1]);
  const bearing = (x, z) => Math.atan2(x - hx, hz - z);
  const gate = BASTIONS.find(bastion => /Porte/.test(bastion.name) && !/Bastion/.test(bastion.name)).ring[0];
  const start = bearing(toX(gate[0]), toZ(gate[1]));
  const order = (x, z) => fract((bearing(x, z) - start) / (2 * Math.PI) + 2);
  const put = (x, y, z, base, when) => { position.push(x, y, z); ground.push(base); turn.push(when); };
  /* corners are [x, y, z, base, when] */
  const quad = (a, b, c, d) => { for (const p of [a, b, c, a, c, d]) put(...p); };
  const PARAPET = .011, CURTAIN = .0075, FOOT = .003, HALF = .002;

  /* What still stands is drawn where OpenStreetMap has it. Between those pieces the circuit is
     restored the simplest way: straight from one outwork to the next, around all of them. */
  const standing = WALLS.map(line => line.map(([lon, lat]) => [toX(lon), toZ(lat)]));
  const stones = [...standing.flat(), ...BASTIONS.flatMap(({ring}) => ring.map(([lon, lat]) => [toX(lon), toZ(lat)]))]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turnOf = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = points => {
    const side = [];
    for (const point of points) {
      while (side.length > 1 && turnOf(side[side.length - 2], side[side.length - 1], point) <= 0) side.pop();
      side.push(point);
    }
    return side.slice(0, -1);
  };
  const circuit = [...half(stones), ...half([...stones].reverse())];
  circuit.push(circuit[0]);

  for (const [line, parapet] of [[circuit, CURTAIN], ...standing.map(line => [line, PARAPET])]) {
    const fine = densify(line, .004);
    const cuts = fine.map(([x, z], i) => {
      const [px, pz] = fine[Math.max(0, i - 1)], [nx, nz] = fine[Math.min(fine.length - 1, i + 1)];
      const length = Math.hypot(nx - px, nz - pz) || 1, ox = -(nz - pz) / length, oz = (nx - px) / length;
      const heights = [-.004, 0, .004].map(d => groundAt(x + ox * d, z + oz * d));
      return {x, z, ox, oz, top: Math.max(...heights) + parapet, base: Math.min(...heights) - FOOT, when: order(x, z)};
    });
    /* the top of a wall does not follow every bump of the ground */
    const tops = cuts.map((_, i) => {
      let sum = 0, count = 0;
      for (let k = Math.max(0, i - 2); k <= Math.min(cuts.length - 1, i + 2); k++) { sum += cuts[k].top; count++; }
      return sum / count;
    });
    cuts.forEach((cut, i) => { cut.top = tops[i]; });
    const corner = (cut, side, high) => [cut.x + cut.ox * HALF * side, high ? cut.top : cut.base, cut.z + cut.oz * HALF * side, cut.base, cut.when];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      quad(corner(a, 1, false), corner(b, 1, false), corner(b, 1, true), corner(a, 1, true));
      quad(corner(b, -1, false), corner(a, -1, false), corner(a, -1, true), corner(b, -1, true));
      quad(corner(a, 1, true), corner(b, 1, true), corner(b, -1, true), corner(a, -1, true));
    }
    for (const end of [cuts[0], cuts[cuts.length - 1]]) quad(corner(end, -1, false), corner(end, 1, false), corner(end, 1, true), corner(end, -1, true));
  }

  for (const {ring} of BASTIONS) {
    const points = ring.map(([lon, lat]) => [toX(lon), toZ(lat)]);
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length, cz = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    const heights = [...points, [cx, cz]].map(([x, z]) => groundAt(x, z));
    const top = Math.max(...heights) + PARAPET, base = Math.min(...heights) - FOOT, when = order(cx, cz);
    const corner = ([x, z], high) => [x, high ? top : base, z, base, when];
    points.forEach((point, i) => {
      const next = points[(i + 1) % points.length];
      quad(corner(point, false), corner(next, false), corner(next, true), corner(point, true));
    });
    for (const face of THREE.ShapeUtils.triangulateShape(points.map(([x, z]) => new THREE.Vector2(x, z)), [])) {
      for (const i of face) put(...corner(points[i], true));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('aGround', new THREE.Float32BufferAttribute(ground, 1));
  geometry.setAttribute('aTurn', new THREE.Float32BufferAttribute(turn, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/* BD TOPO gives every building a flat lid. Over each lid goes a low hipped roof, the tiles of the
   old town; and beside the church, the bell tower the survey leaves out. */
function buildRoofs(flat, groundAt) {
  const from = flat.attributes.position, low = flat.attributes.aGround, index = flat.index;
  const position = [], ground = [], colour = [];
  const tile = new THREE.Color('#cfa691'), shade = new THREE.Color();
  const put = (x, y, z, base, tone) => { position.push(x, y, z); ground.push(base); colour.push(tone.r, tone.g, tone.b); };

  const parent = new Int32Array(from.count).map((_, i) => i);
  const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const edges = new Map();
  for (let i = 0; i < index.count; i += 3) {
    const corners = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    parent[find(corners[1])] = find(corners[0]);
    parent[find(corners[2])] = find(corners[0]);
    for (let k = 0; k < 3; k++) {
      const a = corners[k], b = corners[(k + 1) % 3], key = a < b ? a * from.count + b : b * from.count + a;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const rims = new Map();
  for (const [key, used] of edges) {
    if (used !== 1) continue;
    const a = Math.floor(key / from.count), b = key % from.count, lid = find(a);
    let rim = rims.get(lid);
    if (!rim) rims.set(lid, rim = new Map());
    for (const [p, q] of [[a, b], [b, a]]) { if (!rim.has(p)) rim.set(p, []); rim.get(p).push(q); }
  }
  let lids = 0;
  for (const [lid, rim] of rims) {
    if (rim.size < 3 || [...rim.values()].some(next => next.length !== 2)) continue;
    const loop = [];
    for (let at = rim.keys().next().value, before = -1; loop.length <= rim.size;) {
      loop.push(at);
      const [one, two] = rim.get(at), next = one !== before ? one : two;
      before = at; at = next;
      if (at === loop[0]) break;
    }
    if (loop.length !== rim.size) continue;
    const points = loop.map(i => [from.getX(i), from.getZ(i), low.getX(i)]);
    const y = Math.max(...loop.map(i => from.getY(i)));
    /* the ridge runs along the longest side */
    let ax = 1, az = 0, longest = 0;
    points.forEach(([x, z], i) => {
      const [nx, nz] = points[(i + 1) % points.length], length = Math.hypot(nx - x, nz - z);
      if (length > longest) { longest = length; ax = (nx - x) / length; az = (nz - z) / length; }
    });
    let alongs = points.map(([x, z]) => x * ax + z * az), acrosses = points.map(([x, z]) => -x * az + z * ax);
    let length = Math.max(...alongs) - Math.min(...alongs), width = Math.max(...acrosses) - Math.min(...acrosses);
    if (width > length) { [ax, az] = [-az, ax]; [alongs, acrosses] = [acrosses, alongs.map(v => -v)]; [length, width] = [width, length]; }
    if (width < .003 || width > .022) continue;
    const middle = (Math.max(...alongs) + Math.min(...alongs)) / 2, centre = (Math.max(...acrosses) + Math.min(...acrosses)) / 2;
    const half = Math.max(0, (length - width * .8) / 2), rise = Math.min(.3 * width / 2, .0024) * EXAGGERATION;
    const ridge = alongs.map(along => {
      const s = middle + clamp(along - middle, -half, half);
      return [s * ax - centre * az, s * az + centre * ax];
    });
    shade.copy(tile).offsetHSL(0, 0, ((lid * 2654435761 >>> 0) / 4294967296 - .5) * .09);
    points.forEach(([x, z, base], i) => {
      const j = (i + 1) % points.length, [nx, nz, nextBase] = points[j], [rx, rz] = ridge[i], [sx, sz] = ridge[j];
      put(x, y, z, base, shade); put(nx, y, nz, nextBase, shade); put(sx, y + rise, sz, nextBase, shade);
      if (Math.hypot(sx - rx, sz - rz) < 1e-6) return;
      put(x, y, z, base, shade); put(sx, y + rise, sz, nextBase, shade); put(rx, y + rise, rz, base, shade);
    });
    lids++;
  }

  /* the bell tower */
  const {at, bearing, side, shaft, spire} = BELL_TOWER;
  const tx = toX(at[0]), tz = toZ(at[1]), base = groundAt(tx, tz), half = side / 2000;
  const cos = Math.cos(bearing * DEG), sin = Math.sin(bearing * DEG);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [tx + (u * cos - v * sin) * half, tz + (u * sin + v * cos) * half]);
  const top = base + shaft * EXAGGERATION / 1000, tip = top + spire * EXAGGERATION / 1000;
  const stone = new THREE.Color('#dccdb2'), cap = new THREE.Color('#c39680');
  corners.forEach(([x, z], i) => {
    const [nx, nz] = corners[(i + 1) % 4];
    put(x, base, z, base, stone); put(nx, base, nz, base, stone); put(nx, top, nz, base, stone);
    put(x, base, z, base, stone); put(nx, top, nz, base, stone); put(x, top, z, base, stone);
    put(x, top, z, base, cap); put(nx, top, nz, base, cap); put(tx, tip, tz, base, cap);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('aGround', new THREE.Float32BufferAttribute(ground, 1));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3));
  geometry.computeVertexNormals();
  geometry.userData.lids = lids;
  return geometry;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.25, 'rgba(255,255,255,.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ---------- the stage ---------- */

export async function createStage(canvas, {quality = 'high', onLost} = {}) {
  const base = new URL('assets/relief/', document.baseURI);
  const low = quality === 'low';
  const renderer = new THREE.WebGLRenderer({canvas, antialias: !low, powerPreference: 'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); onLost?.(); });

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 8, 60);
  const camera = new THREE.PerspectiveCamera(30, 1, .05, 160);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(low ? 2048 : 4096);
  Object.assign(sun.shadow.camera, {left: -1.75, right: 1.75, top: 1.75, bottom: -1.75, near: 1, far: 16});
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .0016;
  scene.add(hemisphere, sun, sun.target);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
      uniforms: {
        uTop: {value: new THREE.Color()}, uHorizon: {value: new THREE.Color()}, uSunColor: {value: new THREE.Color()},
        uSunDir: {value: new THREE.Vector3(0, 1, 0)}, uStars: {value: 0}, uGlow: {value: 1}
      }
    })
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  /* shared uniforms */
  const heart = new THREE.Vector2(toX(HEART[0]), toZ(HEART[1]));
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  blank.needsUpdate = true;
  const era = {
    uMapA: {value: blank}, uMapB: {value: blank}, uUseA: {value: 0}, uUseB: {value: 0}, uMix: {value: 0},
    uHeart: {value: heart}, uInk: {value: new THREE.Color('#5d3a25')}, uLiftA: {value: 1}, uLiftB: {value: 1}, uBox: {value: new THREE.Vector4()},
    uStretch: {value: 1}
  };
  const built = {uRise: {value: 0}, uCore: {value: 0}, uHeart: {value: heart}, uNight: {value: 0}};
  const rampart = {uWalls: {value: 0}};

  /* Everything that stands on the ground hangs from one group, so that heights can be shown
     doubled (the maquette) or true (where the page lines up with a photograph). */
  const world = new THREE.Group();
  scene.add(world);

  function graftEra(material, side, printed) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, era, {uSide: side, uPrint: {value: printed ? 1 : 0}, uPatina: {value: material.name === 'Patine du relief' ? 1 : material.name === 'Eau du golfe' ? 2 : 0}});
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uStretch;\nvarying vec2 vEraUv;\nvarying vec3 vEraPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEraUv = uv;\nvEraPos = (modelMatrix * vec4(transformed, 1.)).xyz;\nvEraPos.y /= uStretch;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + eraHead)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + eraBody);
    };
    material.customProgramCacheKey = () => 'era-' + (printed ? 'print' : 'plain') + material.name;
    material.roughness = .92;
    return material;
  }
  function graftLevels(material) {
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHigh;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHigh = transformed;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHigh;\n' + contourGlsl)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = plaster(vHigh, smoothstep(-.0045, .0004, vHigh.y));');
    };
    return material;
  }
  function graftRise(material, windows) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, built);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + riseHead)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + riseBody);
      if (windows) {
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + windowHead)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + windowBody);
      }
    };
    material.customProgramCacheKey = () => 'rise-' + (windows ? 'walls' : 'plain');
    return material;
  }
  function graftWalls(material) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, rampart);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + wallHead)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + wallBody);
    };
    material.customProgramCacheKey = () => 'rampart';
    return material;
  }

  /* load everything the first scenes need */
  const [gltf, region] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL('portivechju.glb?v=rivages-1', base).href),
    loadRegion(base)
  ]);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  world.add(model);

  const terrain = model.getObjectByName('Terrain');
  const reference = model.getObjectByName('RiveDeReference');
  const marks = model.getObjectByName('SignesDuTerrier');
  const houses = model.getObjectByName('Maisons');
  model.getObjectByName('Tranche').visible = false;
  const box = new THREE.Box3().setFromObject(terrain, true);
  era.uBox.value.set(box.min.x, box.min.z, box.max.x, box.max.z);

  /* shores: one per period; each carries its own side of the wipe */
  const shores = [reference, reference, ...['1951', '1975', '2024'].map(year => model.getObjectByName('Rivage' + year))];
  const sides = new Map();
  const still = {value: 0};
  terrain.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.material = graftEra(mesh.material.clone(), still, PRINTED.has(mesh.material.name));
    mesh.receiveShadow = true;
  });
  for (const shore of new Set(shores)) {
    const side = {value: 0};
    sides.set(shore, side);
    shore.traverse(mesh => {
      if (!mesh.isMesh) return;
      const printed = PRINTED.has(mesh.material.name);
      mesh.material = graftEra(mesh.material.clone(), side, printed);
      mesh.material.polygonOffset = true;
      mesh.material.polygonOffsetFactor = -1;
      mesh.material.polygonOffsetUnits = -2;
      mesh.receiveShadow = true;
    });
  }
  const ink = [];
  marks.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.material = mesh.material.clone();
    mesh.material.transparent = true;
    mesh.material.polygonOffset = true;
    mesh.material.polygonOffsetFactor = -2;
    mesh.material.polygonOffsetUnits = -4;
    ink.push(mesh.material);
  });

  /* ground heights */
  const groundMeshes = [];
  for (const part of [terrain, reference]) part.traverse(mesh => { if (mesh.isMesh && PRINTED.has(mesh.material.name)) groundMeshes.push(mesh); });
  const townHeight = rasterise(groundMeshes, box, 420);
  const regionHeight = sampler(region);
  function heightAt(lon, lat) {
    const x = toX(lon), z = toZ(lat);
    if (x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z) return Math.max(0, townHeight(x, z));
    return Math.max(0, regionHeight(lon, lat)) * EXAGGERATION / 1000;
  }

  /* houses */
  const town = new THREE.Group();
  const depth = graftRise(new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking}), false);
  houses.traverse(mesh => {
    if (!mesh.isMesh) return;
    const walls = /Murs/.test(mesh.material.name);
    const material = graftRise(new THREE.MeshStandardMaterial({
      color: walls ? '#e6dac2' : '#e9d3b4', roughness: .9, metalness: 0, side: THREE.DoubleSide
    }), walls);
    const copy = new THREE.Mesh(bake(mesh, townHeight), material);
    copy.customDepthMaterial = depth;
    copy.castShadow = copy.receiveShadow = true;
    copy.frustumCulled = false;
    town.add(copy);
    if (walls) return;
    const roofs = new THREE.Mesh(buildRoofs(copy.geometry, townHeight), graftRise(new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: .86, metalness: 0, side: THREE.DoubleSide
    }), false));
    roofs.customDepthMaterial = depth;
    roofs.castShadow = roofs.receiveShadow = true;
    roofs.frustumCulled = false;
    town.add(roofs);
  });
  houses.visible = false;
  town.visible = false;
  world.add(town);

  /* the walls of the citadel */
  const walls = new THREE.Mesh(buildWalls(townHeight), graftWalls(new THREE.MeshStandardMaterial({
    color: '#bfae8e', roughness: .95, metalness: 0, side: THREE.DoubleSide
  })));
  walls.customDepthMaterial = graftWalls(new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking}));
  walls.castShadow = walls.receiveShadow = true;
  walls.frustumCulled = false;
  walls.visible = false;
  world.add(walls);

  /* the country around the tile */
  const hole = box.clone();
  hole.min.x += .16; hole.min.z += .16; hole.max.x -= .16; hole.max.z -= .16;
  const land = new THREE.Mesh(
    buildRegion(region, low ? 3 : 2, hole, box, townHeight),
    graftLevels(new THREE.MeshStandardMaterial({vertexColors: true, roughness: .92, metalness: 0}))
  );
  world.add(land);
  const outline = new THREE.Shape([[-220, -220], [220, -220], [220, 220], [-220, 220]].map(([x, y]) => new THREE.Vector2(x, y)));
  const inner = [[box.min.x + .03, -box.max.z + .03], [box.min.x + .03, -box.min.z - .03], [box.max.x - .03, -box.min.z - .03], [box.max.x - .03, -box.max.z + .03]];
  outline.holes.push(new THREE.Path(inner.map(([x, y]) => new THREE.Vector2(x, y))));
  const water = new THREE.Mesh(new THREE.ShapeGeometry(outline), new THREE.MeshStandardMaterial({color: SEA, roughness: .92, metalness: 0}));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -.004;
  world.add(water);

  /* light on the water */
  const glitter = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.ShaderMaterial({
    vertexShader: glitterVertex, fragmentShader: glitterFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    /* the shores are drawn with the same offset: the light stays above their water and under their land */
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    uniforms: {uSunDir: {value: new THREE.Vector3(0, 1, 0)}, uSunColor: {value: new THREE.Color()}, uGlitter: {value: 0}, uTime: {value: 0}}
  }));
  glitter.rotation.x = -Math.PI / 2;
  glitter.position.y = .0007;
  glitter.renderOrder = 3;
  world.add(glitter);

  /* the salt pans: a grid inside the field, split in two by the main dyke */
  const salt = (() => {
    const [north, east, south, west] = SALT_FIELD.map(([lon, lat]) => [toX(lon), toZ(lat)]);
    const at = (u, v) => {
      const ax = north[0] + (east[0] - north[0]) * u, az = north[1] + (east[1] - north[1]) * u;
      const bx = west[0] + (south[0] - west[0]) * u, bz = west[1] + (south[1] - west[1]) * u;
      const x = ax + (bx - ax) * v, z = az + (bz - az) * v;
      return [x, townHeight(x, z) + .0022, z];
    };
    const columns = [[.02, .19], [.21, .38], [.44, .61], [.63, .8], [.82, .98]], rows = 7;
    const position = [], order = [], tone = [];
    columns.forEach(([u0, u1], column) => {
      for (let row = 0; row < rows; row++) {
        const v0 = (row + .06) / rows, v1 = (row + .94) / rows;
        const when = clamp((row + (column * 7 + row * 3) % 5 * .45) / (rows + 1.4));
        const grey = ((column * 5 + row * 3) % 7) / 6;
        for (const [u, v] of [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]]) { position.push(...at(u, v)); order.push(when); tone.push(grey); }
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('aOrder', new THREE.Float32BufferAttribute(order, 1));
    geometry.setAttribute('aTone', new THREE.Float32BufferAttribute(tone, 1));
    const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      vertexShader: saltVertex, fragmentShader: saltFragment, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {uSalt: {value: 0}, uWhite: {value: paint('#f3efe4')}}
    }));
    mesh.renderOrder = 4;
    mesh.visible = false;
    world.add(mesh);
    return mesh;
  })();

  /* the railway of 1935, from the northern edge of the map down to the station */
  const rail = new THREE.Mesh(
    ribbon(RAIL.map(([lon, lat]) => [toX(lon), toZ(lat)]), (x, z) => heightAt(toLon(x), toLat(z)), .06, .006, .02),
    new THREE.ShaderMaterial({
      vertexShader: railVertex, fragmentShader: railFragment, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {uDrawn: {value: 0}, uFade: {value: 0}, uInk: {value: paint('#3a2a22')}}
    })
  );
  rail.renderOrder = 5;
  rail.visible = false;
  world.add(rail);

  /* the two streets, and the fire of the last night of July */
  const streets = [[STREET_HOME, '#ffd08a'], [STREET_ABBATUCCI, '#ff9d6b']].map(([path, colour]) => {
    const points = path.map(([lon, lat]) => [toX(lon), toZ(lat)]);
    const group = new THREE.Group();
    for (const [width, opacity] of [[.0034, 1], [.013, .28]]) {
      const line = new THREE.Mesh(ribbon(points, townHeight, width, .0045), new THREE.MeshBasicMaterial({
        color: colour, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      }));
      line.renderOrder = 6;
      line.userData.opacity = opacity;
      group.add(line);
    }
    group.visible = false;
    world.add(group);
    return group;
  });
  const glow = glowTexture();
  const spark = (colour, size) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, color: colour, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    }));
    sprite.scale.setScalar(size);
    sprite.renderOrder = 7;
    sprite.visible = false;
    scene.add(sprite);
    return sprite;
  };
  const fire = spark('#ff8a3c', .05);
  const fireAt = [9.2796, 41.5911];
  fire.position.set(toX(fireAt[0]), 0, toZ(fireAt[1]));
  fire.userData.high = heightAt(...fireAt) + .012;
  const fireLight = new THREE.PointLight('#ff8a3c', 0, .5, 1.6);
  scene.add(fireLight);
  const lamp = spark('#ffc27a', .026);
  const lampAt = STREET_HOME[3];
  lamp.position.set(toX(lampAt[0]), 0, toZ(lampAt[1]));
  lamp.userData.high = heightAt(...lampAt) + .012;

  /* Beads that travel: the people of the mountain, one ship, the summer crowd, a train.
     The paths are the gentlest way over the relief, not surveyed roads. */
  const trackOf = (line, lift) => {
    const count = line.length, at = new Float32Array(count * 3), along = new Float32Array(count);
    line.forEach(([lon, lat], i) => {
      at.set([toX(lon), heightAt(lon, lat) + lift, toZ(lat)], i * 3);
      if (i) along[i] = along[i - 1] + Math.hypot(at[i * 3] - at[i * 3 - 3], at[i * 3 + 2] - at[i * 3 - 1]);
    });
    return {at, along, count};
  };
  const beads = [];
  const bead = (group, track, phase, size, colour, extra = {}) => beads.push({group, track, phase, size, colour: paint(colour), lag: 0, fade: 1, kind: 0, ...extra});
  Object.values(PATHS).forEach((line, p) => {
    const track = trackOf(line, .012);
    for (let k = 0; k < 22; k++) bead('folk', track, fract((k + p * .37) / 22 + .012 * ((k * 7) % 5)), 7.5, '#b8442b');
  });
  const seaway = trackOf(SEAWAY, .004);
  bead('ship', seaway, 0, 30, '#fff8ea', {kind: 1});
  for (let k = 1; k <= 14; k++) bead('ship', seaway, 0, 6 - k * .22, '#ffffff', {lag: .006 + k * .011, fade: .9 * (1 - k / 15)});
  /* the summer comes by two roads and by sea; only the last few kilometres are in the picture */
  const lastOf = (line, km) => {
    let i = line.length - 1;
    for (let length = 0; i > 0 && length < km; i--) length += Math.hypot((line[i][0] - line[i - 1][0]) * 83.3, (line[i][1] - line[i - 1][1]) * 111.2);
    return line.slice(i);
  };
  [lastOf(ROADS.nord, 9), lastOf(ROADS.sud, 9), lastOf([...SEAWAY].reverse(), 7)].forEach((line, p) => {
    const track = trackOf(line, p === 2 ? .004 : .012);
    const count = p === 2 ? 12 : 56;
    for (let k = 0; k < count; k++) bead('guests', track, fract((k + p * .29) / count + .004 * ((k * 5) % 7)), 8.5, '#b8442b');
  });
  const railway = trackOf(RAIL, .014);
  for (let k = 0; k < 4; k++) bead('train', railway, 0, k ? 8.5 : 10.5, k ? '#4a372c' : '#8c2f1f', {lag: k * .0075});
  const beadSpots = new Float32Array(beads.length * 3), beadAlpha = new Float32Array(beads.length);
  const beadGeometry = new THREE.BufferGeometry();
  beadGeometry.setAttribute('position', new THREE.BufferAttribute(beadSpots, 3));
  beadGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(beadAlpha, 1));
  beadGeometry.setAttribute('aColour', new THREE.Float32BufferAttribute(beads.flatMap(b => [b.colour.r, b.colour.g, b.colour.b]), 3));
  beadGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(beads.map(b => b.size), 1));
  beadGeometry.setAttribute('aKind', new THREE.Float32BufferAttribute(beads.map(b => b.kind), 1));
  const dots = new THREE.Points(beadGeometry, new THREE.ShaderMaterial({
    vertexShader: beadVertex, fragmentShader: beadFragment, transparent: true, depthTest: false, depthWrite: false, uniforms: {uScale: {value: 1}}
  }));
  dots.frustumCulled = false;
  dots.renderOrder = 8;
  dots.visible = false;
  scene.add(dots);
  const ends = share => smooth(0, .05, share) * (1 - smooth(.95, 1, share));

  function travel(time) {
    const {folk, tide, sail, guests, stretch} = state;
    const train = clamp(1 - Math.abs(state.rail - 1) * 2.5);
    let any = false;
    beads.forEach((one, i) => {
      let share = 0, alpha = 0;
      if (one.group === 'folk' && folk > .01) {
        /* either a steady descent, or the year: up for the summer, down again in the autumn */
        const down = 1 - fract(one.phase + time * .04);
        const season = .5 - .5 * Math.cos(time * .3);
        share = down + (clamp(season * 1.6 - one.phase * .6) - down) * tide;
        alpha = folk * ends(share);
      } else if (one.group === 'ship' && sail > .01) {
        share = fract(time * .03) ** 1.25 * 1.2 - one.lag;
        alpha = sail * ends(share) * one.fade;
      } else if (one.group === 'guests' && guests > .01) {
        share = fract(one.phase + time * .034);
        alpha = guests * ends(share);
      } else if (one.group === 'train' && train > .01) {
        /* only the last two thirds of the line are ever in the picture */
        share = .34 + fract(time * .055) * .74 - one.lag;
        alpha = train * ends(share);
      }
      beadAlpha[i] = alpha;
      if (alpha < .004) return;
      any = true;
      const {at, along, count} = one.track, want = clamp(share) * along[count - 1];
      let lo = 1, hi = count - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (along[mid] < want) lo = mid + 1; else hi = mid; }
      const t = (want - along[lo - 1]) / (along[lo] - along[lo - 1] || 1), a = (lo - 1) * 3, b = lo * 3;
      beadSpots[i * 3] = at[a] + (at[b] - at[a]) * t;
      beadSpots[i * 3 + 1] = (at[a + 1] + (at[b + 1] - at[a + 1]) * t) * stretch;
      beadSpots[i * 3 + 2] = at[a + 2] + (at[b + 2] - at[a + 2]) * t;
    });
    dots.visible = any;
    if (any) { beadGeometry.attributes.position.needsUpdate = true; beadGeometry.attributes.aAlpha.needsUpdate = true; }
  }

  /* period maps arrive in the background */
  const maps = new Map();
  const loader = new THREE.TextureLoader();
  let dirty = true;
  const mapsReady = Promise.all(ERAS.map((name, i) => loader.loadAsync(new URL('carte-' + name + '.webp', base).href).then(texture => {
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    maps.set(i + 1, texture);
    dirty = true;
  }, () => {})));

  /* ---------- per-frame ---------- */
  const state = {};
  const target = new THREE.Vector3(), offset = new THREE.Vector3(), sunDir = new THREE.Vector3(), probe = new THREE.Vector3();
  const centre = new THREE.Vector3((box.min.x + box.max.x) / 2, 0, (box.min.z + box.max.z) / 2);
  let width = 1, height = 1, shadowKey = '';

  function resize(w, h, ratio) {
    width = w; height = h;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    dots.material.uniforms.uScale.value = ratio * (w < 760 ? .85 : 1);
    dirty = true;
  }

  function setEra(value) {
    const from = Math.min(3, Math.max(0, Math.floor(value))), mix = Math.min(1, Math.max(0, value - from));
    era.uMapA.value = maps.get(from) || blank;
    era.uUseA.value = maps.has(from) ? 1 : 0;
    era.uMapB.value = maps.get(from + 1) || blank;
    era.uUseB.value = maps.has(from + 1) ? 1 : 0;
    era.uMix.value = mix;
    era.uLiftA.value = LIFT[from];
    era.uLiftB.value = LIFT[from + 1];
    const leaving = shores[from], arriving = shores[from + 1];
    for (const [shore, side] of sides) {
      if (leaving === arriving) { shore.visible = shore === leaving; side.value = 0; continue; }
      shore.visible = (shore === leaving && mix < 1) || (shore === arriving && mix > 0);
      side.value = shore === leaving ? -1 : 1;
      if (shore === leaving && mix <= 0) side.value = 0;
      if (shore === arriving && mix >= 1) side.value = 0;
    }
    const inked = Math.min(1, Math.max(0, 1 - Math.abs(value - 1) * 1.6));
    marks.visible = inked > .02;
    ink.forEach(material => { material.opacity = inked; });
  }

  function apply(next, time = 0) {
    Object.assign(state, next);
    const {cam, look} = state;
    const stretch = state.stretch;
    world.scale.y = stretch;
    era.uStretch.value = stretch;

    /* camera */
    const az = (cam.az + Math.sin(time * .11) * cam.sway) * DEG, el = (cam.el + Math.sin(time * .083 + 1.3) * cam.sway * .22) * DEG;
    target.set(toX(cam.lon), cam.y, toZ(cam.lat));
    offset.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).multiplyScalar(cam.dist);
    camera.position.copy(target).add(offset);
    const floor = heightAt(toLon(camera.position.x), toLat(camera.position.z)) * stretch + cam.floor;
    if (camera.position.y < floor) camera.position.y = floor;
    camera.fov = cam.fov;
    camera.near = cam.near;
    camera.far = cam.near < .002 ? 120 : 330;
    camera.lookAt(target);
    if (state.shiftX || state.shiftY) camera.setViewOffset(width, height, -state.shiftX * width, -state.shiftY * height, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    sky.scale.setScalar(120);

    /* light */
    const sunAz = look.sunAz * DEG, sunEl = look.sunEl * DEG;
    sunDir.set(Math.cos(sunEl) * Math.sin(sunAz), Math.sin(sunEl), -Math.cos(sunEl) * Math.cos(sunAz));
    sun.position.copy(centre).addScaledVector(sunDir, 8);
    sun.target.position.copy(centre);
    sun.target.updateMatrixWorld();
    sun.color.copy(look.sun);
    sun.intensity = look.sunPower;
    hemisphere.color.copy(look.above);
    hemisphere.groundColor.copy(look.below);
    hemisphere.intensity = look.fill;
    scene.fog.color.copy(look.haze);
    scene.fog.near = look.hazeNear;
    scene.fog.far = look.hazeFar;
    renderer.toneMappingExposure = look.exposure;
    const uniforms = sky.material.uniforms;
    uniforms.uTop.value.copy(look.top);
    uniforms.uHorizon.value.copy(look.haze);
    uniforms.uSunColor.value.copy(look.sun);
    uniforms.uSunDir.value.copy(sunDir);
    uniforms.uStars.value = look.night;
    uniforms.uGlow.value = look.glow;

    /* periods, houses, lights of the evening */
    setEra(state.era);
    built.uRise.value = state.rise;
    built.uCore.value = state.core;
    built.uNight.value = look.night;
    town.visible = state.rise > .001 || state.core > .001;
    rampart.uWalls.value = state.walls;
    walls.visible = state.walls > .001;
    salt.visible = state.salt > .001;
    salt.material.uniforms.uSalt.value = state.salt;
    const railFade = clamp(2 - state.rail);
    rail.visible = state.rail > .001 && railFade > .001;
    rail.material.uniforms.uDrawn.value = clamp(state.rail) * rail.geometry.userData.length;
    rail.material.uniforms.uFade.value = railFade * .9;
    glitter.visible = look.glitter > .01;
    glitter.material.uniforms.uGlitter.value = look.glitter;
    glitter.material.uniforms.uTime.value = time;
    glitter.material.uniforms.uSunDir.value.copy(sunDir);
    glitter.material.uniforms.uSunColor.value.copy(look.sun);
    travel(time);
    streets.forEach((group, i) => {
      const drawn = Math.min(1, Math.max(0, state.streets - i));
      group.visible = drawn > .001;
      group.children.forEach(line => {
        const whole = line.geometry.index.count;
        line.geometry.setDrawRange(0, Math.floor(whole / 6 * drawn) * 6);
        line.material.opacity = line.userData.opacity * Math.min(1, drawn * 4);
      });
    });
    const flame = state.fire * (.75 + .25 * Math.sin(time * 9.1) * Math.sin(time * 5.3 + 1.1));
    fire.visible = flame > .01;
    fire.material.opacity = flame;
    fire.scale.setScalar(.05 + .012 * Math.sin(time * 7.7));
    fire.position.y = fire.userData.high * stretch;
    fireLight.position.copy(fire.position);
    fireLight.intensity = flame * .012;
    lamp.visible = state.lamp > .01;
    lamp.material.opacity = state.lamp;
    lamp.position.y = lamp.userData.high * stretch;

    const key = [look.sunAz.toFixed(1), look.sunEl.toFixed(1), state.rise.toFixed(3), state.core.toFixed(3), state.walls.toFixed(3), stretch.toFixed(3)].join();
    if (key !== shadowKey) { shadowKey = key; renderer.shadowMap.needsUpdate = true; }
  }

  function render() {
    renderer.render(scene, camera);
    dirty = false;
  }

  /* Where a place falls on screen, in CSS pixels. ground is its height on the maquette, lift what is added above. */
  function project(lon, lat, ground, lift) {
    probe.set(toX(lon), (ground + lift) * state.stretch, toZ(lat)).project(camera);
    return {x: (probe.x * .5 + .5) * width, y: (.5 - probe.y * .5) * height, visible: probe.z > -1 && probe.z < 1};
  }

  function dispose() {
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return {apply, render, resize, project, heightAt, mapsReady, dispose, get dirty() { return dirty; }, renderer, camera, scene};
}
