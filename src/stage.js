/* The maquette: one WebGL scene that the letter drives from start to finish.
   Everything here is a function of the state passed to apply(); nothing animates on its own
   except the small breathing of the camera and the fire of 31 July. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {EXAGGERATION, HEART, STREET_ABBATUCCI, STREET_HOME, toLat, toLon, toX, toZ} from './geo.js';

const SEA = new THREE.Color().setRGB(.313, .401, .344);
const ERAS = ['terrier', '1951', '1975', '2024'];
const PRINTED = new Set(['Patine du relief', 'Terre du golfe', 'Eau du golfe', 'Ouvrages du port']);
const DEG = Math.PI / 180;
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

function ribbon(points, groundAt, width, lift) {
  const fine = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const pieces = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / .004));
    for (let k = 0; k < pieces; k++) fine.push([x0 + (x1 - x0) * k / pieces, z0 + (z1 - z0) * k / pieces]);
  }
  fine.push(points[points.length - 1]);
  const position = [], index = [];
  fine.forEach(([x, z], i) => {
    const [px, pz] = fine[Math.max(0, i - 1)], [nx, nz] = fine[Math.min(fine.length - 1, i + 1)];
    const length = Math.hypot(nx - px, nz - pz) || 1, ox = -(nz - pz) / length * width / 2, oz = (nx - px) / length * width / 2;
    const y = groundAt(x, z) + lift;
    position.push(x + ox, y, z + oz, x - ox, y, z - oz);
    if (i) index.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2, i * 2 - 1, i * 2 + 1);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setIndex(index);
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
    uHeart: {value: heart}, uInk: {value: new THREE.Color('#5d3a25')}, uLiftA: {value: 1}, uLiftB: {value: 1}, uBox: {value: new THREE.Vector4()}
  };
  const built = {uRise: {value: 0}, uCore: {value: 0}, uHeart: {value: heart}, uNight: {value: 0}};

  function graftEra(material, side, printed) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, era, {uSide: side, uPrint: {value: printed ? 1 : 0}, uPatina: {value: material.name === 'Patine du relief' ? 1 : material.name === 'Eau du golfe' ? 2 : 0}});
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vEraUv;\nvarying vec3 vEraPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEraUv = uv;\nvEraPos = (modelMatrix * vec4(transformed, 1.)).xyz;');
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

  /* load everything the first scenes need */
  const [gltf, region] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL('portivechju.glb?v=rivages-1', base).href),
    loadRegion(base)
  ]);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  scene.add(model);

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
  });
  houses.visible = false;
  town.visible = false;
  scene.add(town);

  /* the country around the tile */
  const hole = box.clone();
  hole.min.x += .16; hole.min.z += .16; hole.max.x -= .16; hole.max.z -= .16;
  const land = new THREE.Mesh(
    buildRegion(region, low ? 3 : 2, hole, box, townHeight),
    graftLevels(new THREE.MeshStandardMaterial({vertexColors: true, roughness: .92, metalness: 0}))
  );
  scene.add(land);
  const outline = new THREE.Shape([[-220, -220], [220, -220], [220, 220], [-220, 220]].map(([x, y]) => new THREE.Vector2(x, y)));
  const inner = [[box.min.x + .03, -box.max.z + .03], [box.min.x + .03, -box.min.z - .03], [box.max.x - .03, -box.min.z - .03], [box.max.x - .03, -box.max.z + .03]];
  outline.holes.push(new THREE.Path(inner.map(([x, y]) => new THREE.Vector2(x, y))));
  const water = new THREE.Mesh(new THREE.ShapeGeometry(outline), new THREE.MeshStandardMaterial({color: SEA, roughness: .92, metalness: 0}));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -.004;
  scene.add(water);

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
    scene.add(group);
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
  fire.position.set(toX(fireAt[0]), heightAt(...fireAt) + .012, toZ(fireAt[1]));
  const fireLight = new THREE.PointLight('#ff8a3c', 0, .5, 1.6);
  fireLight.position.copy(fire.position);
  scene.add(fireLight);
  const lamp = spark('#ffc27a', .026);
  const lampAt = STREET_HOME[3];
  lamp.position.set(toX(lampAt[0]), heightAt(...lampAt) + .012, toZ(lampAt[1]));

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

    /* camera */
    const az = (cam.az + Math.sin(time * .11) * cam.sway) * DEG, el = (cam.el + Math.sin(time * .083 + 1.3) * cam.sway * .22) * DEG;
    target.set(toX(cam.lon), cam.y, toZ(cam.lat));
    offset.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).multiplyScalar(cam.dist);
    camera.position.copy(target).add(offset);
    const floor = heightAt(toLon(camera.position.x), toLat(camera.position.z)) + .012;
    if (camera.position.y < floor) camera.position.y = floor;
    camera.fov = cam.fov;
    camera.near = Math.max(.003, cam.dist * .02);
    camera.far = 330;
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
    fireLight.intensity = flame * .012;
    lamp.visible = state.lamp > .01;
    lamp.material.opacity = state.lamp;

    const key = [look.sunAz.toFixed(1), look.sunEl.toFixed(1), state.rise.toFixed(3), state.core.toFixed(3)].join();
    if (key !== shadowKey) { shadowKey = key; renderer.shadowMap.needsUpdate = true; }
  }

  function render() {
    renderer.render(scene, camera);
    dirty = false;
  }

  /* Where a place falls on screen, in CSS pixels. */
  function project(lon, lat, y) {
    probe.set(toX(lon), y, toZ(lat)).project(camera);
    return {x: (probe.x * .5 + .5) * width, y: (.5 - probe.y * .5) * height, visible: probe.z > -1 && probe.z < 1};
  }

  function dispose() {
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return {apply, render, resize, project, heightAt, mapsReady, dispose, get dirty() { return dirty; }, renderer, camera, scene};
}
