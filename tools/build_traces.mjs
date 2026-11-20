// Lines the maquette draws on top of the relief: walls and bastions, the church, the old
// railway, and the paths its little lights follow. Writes src/traces.js.
//
//   node tools/build_traces.mjs [cache-dir]
//
// Walls, bastions, church and railway come from OpenStreetMap (ODbL). The paths are not
// historical routes: they are the gentlest way over the relief of assets/relief/region.png
// between two places, which is enough to say "up to the mountain and back".
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateSync} from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = resolve(process.argv[2] || join(root, '.cache-osm'));
mkdirSync(cache, {recursive: true});
const agent = {'user-agent': 'portivechju-site/1.0 (github.com/felipempleite/porto-vecchio)'};

async function cached(name, load) {
  const file = join(cache, name);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const data = await load();
  writeFileSync(file, JSON.stringify(data));
  return data;
}

/* ---------- OpenStreetMap ---------- */

const town = await cached('vieille-ville.json', async () => {
  const response = await fetch('https://api.openstreetmap.org/api/0.6/map.json?bbox=9.2755,41.5885,9.2845,41.5940', {headers: agent});
  if (!response.ok) throw new Error('OpenStreetMap: ' + response.status);
  return response.json();
});
const nodes = new Map(town.elements.filter(e => e.type === 'node').map(e => [e.id, [e.lon, e.lat]]));
const ways = town.elements.filter(e => e.type === 'way').map(e => ({id: e.id, tags: e.tags || {}, line: e.nodes.map(id => nodes.get(id))}));
const round = point => [+point[0].toFixed(6), +point[1].toFixed(6)];

const WALLS = ways.filter(way => way.tags.barrier === 'city_wall').map(way => way.line.map(round));
const BASTIONS = ways
  .filter(way => /^Bastion |^Porte Génoise$/.test(way.tags.name || ''))
  .map(way => ({name: way.tags.name, ring: way.line.slice(0, -1).map(round)}))
  .sort((a, b) => a.name.localeCompare(b.name));
const church = ways.find(way => way.tags.name === 'Église Saint-Jean Baptiste');
const CHURCH = church.line.slice(0, -1).map(round);

const railways = await cached('voie-ferree.json', async () => {
  const query = '[out:json][timeout:50];(way["railway"="abandoned"](41.55,9.25,41.81,9.42););out geom tags;';
  for (const host of ['https://overpass-api.de', 'https://overpass.openstreetmap.fr', 'https://overpass.private.coffee']) {
    try {
      const response = await fetch(host + '/api/interpreter', {method: 'POST', headers: agent, body: new URLSearchParams({data: query})});
      if (response.ok) return await response.json();
    } catch {}
  }
  throw new Error('Overpass ne répond pas');
});

/* The line as it ran in 1935, from the edge of the map to the station. Ways marked
   « tracé à vérifier » (the extension towards Bonifacio, never opened) are left out. */
const metres = (a, b) => Math.hypot((a[0] - b[0]) * 83300, (a[1] - b[1]) * 111200);
function chain(elements, from, to) {
  const points = [], edges = new Map();
  const id = point => {
    const key = point[0].toFixed(6) + ',' + point[1].toFixed(6);
    if (!edges.has(key)) { edges.set(key, []); points.push({key, point}); }
    return key;
  };
  const link = (a, b, length) => { edges.get(a).push([b, length]); edges.get(b).push([a, length]); };
  const ends = [];
  for (const way of elements) {
    if (/vérifier/.test(way.tags?.note || '')) continue;
    const line = way.geometry.map(g => [g.lon, g.lat]);
    for (let i = 0; i < line.length - 1; i++) link(id(line[i]), id(line[i + 1]), metres(line[i], line[i + 1]));
    ends.push(line[0], line[line.length - 1]);
  }
  /* mappers left small gaps at bridges and crossings */
  for (const a of ends) for (const b of ends) {
    const gap = metres(a, b);
    if (gap > 0 && gap < 400) link(id(a), id(b), gap * 3);
  }
  const nearest = target => points.reduce((best, p) => metres(p.point, target) < metres(best.point, target) ? p : best).key;
  const start = nearest(from), goal = nearest(to);
  const cost = new Map([[start, 0]]), back = new Map(), open = new Set([start]);
  while (open.size) {
    let here = null;
    for (const key of open) if (here === null || cost.get(key) < cost.get(here)) here = key;
    open.delete(here);
    if (here === goal) break;
    for (const [next, length] of edges.get(here)) {
      const total = cost.get(here) + length;
      if (total < (cost.get(next) ?? Infinity)) { cost.set(next, total); back.set(next, here); open.add(next); }
    }
  }
  if (!back.has(goal)) throw new Error('La voie ferrée est interrompue');
  const path = [];
  for (let key = goal; key; key = back.get(key)) path.unshift(key.split(',').map(Number));
  return path;
}

/* ---------- relief ---------- */

function readPng(file) {
  const bytes = readFileSync(file);
  let at = 8, width = 0, height = 0, channels = 3;
  const chunks = [];
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at), type = bytes.toString('latin1', at + 4, at + 8), body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error('PNG inattendu');
      channels = {2: 3, 6: 4, 0: 1}[body[9]];
    }
    if (type === 'IDAT') chunks.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels, out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], row = y * stride, from = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? out[row + x - channels] : 0, up = y ? out[row - stride + x] : 0, corner = x >= channels && y ? out[row - stride + x - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - corner, pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - corner);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
      }
      out[row + x] = (raw[from + x] + predicted) & 255;
    }
  }
  return {width, height, channels, data: out};
}

const meta = JSON.parse(readFileSync(join(root, 'assets/relief/region.json'), 'utf8'));
const image = readPng(join(root, 'assets/relief/region.png'));
const {width, height} = image;
const high = new Float32Array(width * height);
for (let i = 0; i < high.length; i++) high[i] = (image.data[i * image.channels] * 256 + image.data[i * image.channels + 1]) * meta.metresPerUnit;
const cellX = (meta.east - meta.west) * 83.3 / (width - 1), cellY = (meta.north - meta.south) * 111.2 / (height - 1);
const cellOf = ([lon, lat]) => Math.round((meta.north - lat) / (meta.north - meta.south) * (height - 1)) * width + Math.round((lon - meta.west) / (meta.east - meta.west) * (width - 1));
const placeOf = cell => [meta.west + (cell % width) / (width - 1) * (meta.east - meta.west), meta.north - Math.floor(cell / width) / (height - 1) * (meta.north - meta.south)];

function snap(place, wet) {
  const start = cellOf(place), x0 = start % width, y0 = Math.floor(start / width);
  for (let reach = 0; reach < 40; reach++) {
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== reach) continue;
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if ((high[y * width + x] <= 0) === wet) return y * width + x;
    }
  }
  throw new Error('Rien à proximité de ' + place);
}

/* Cheapest way from one cell to every other: on land, steep steps cost dearly; at sea, only water counts. */
function spread(start, wet) {
  const cost = new Float64Array(width * height).fill(Infinity), back = new Int32Array(width * height).fill(-1);
  const heap = [[0, start]];
  cost[start] = 0;
  const push = item => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [spent, here] = pop();
    if (spent > cost[here]) continue;
    const x = here % width, y = Math.floor(here / width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if ((high[next] <= 0) !== wet) continue;
      const length = Math.hypot(dx * cellX, dy * cellY);
      let price = length;
      if (wet) {
        /* keep off the shore */
        let shore = 0;
        for (let sy = -3; sy <= 3; sy += 3) for (let sx = -3; sx <= 3; sx += 3) {
          const px = nx + sx, py = ny + sy;
          if (px >= 0 && py >= 0 && px < width && py < height && high[py * width + px] > 0) shore++;
        }
        price *= 1 + shore;
      } else {
        const grade = Math.abs(high[next] - high[here]) / 1000 / length;
        price *= 1 + (grade / .1) ** 2;
      }
      if (spent + price < cost[next]) { cost[next] = spent + price; back[next] = here; push([spent + price, next]); }
    }
  }
  return goal => {
    const path = [];
    for (let cell = goal; cell >= 0; cell = back[cell]) path.unshift(placeOf(cell));
    if (path.length < 2) throw new Error('Pas de chemin');
    return path;
  };
}

/* fewer points, rounder corners */
function tidy(path, tolerance, rounds = 2) {
  const keep = new Uint8Array(path.length);
  keep[0] = keep[path.length - 1] = 1;
  const stack = [[0, path.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = 0, at = -1;
    const ax = path[a][0] * 83.3, ay = path[a][1] * 111.2, bx = path[b][0] * 83.3, by = path[b][1] * 111.2, span = Math.hypot(bx - ax, by - ay) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const away = Math.abs((path[i][0] * 83.3 - ax) * (by - ay) - (path[i][1] * 111.2 - ay) * (bx - ax)) / span;
      if (away > worst) { worst = away; at = i; }
    }
    if (worst > tolerance) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  let line = path.filter((_, i) => keep[i]);
  for (let round = 0; round < rounds; round++) {
    const next = [line[0]];
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1];
      next.push([ax * .75 + bx * .25, ay * .75 + by * .25], [ax * .25 + bx * .75, ay * .25 + by * .75]);
    }
    next.push(line[line.length - 1]);
    line = next;
  }
  return line.map(point => [+point[0].toFixed(5), +point[1].toFixed(5)]);
}

const HEART = [9.2795, 41.5913], MARINE = [9.2863, 41.5901], STATION = [9.2835319, 41.59529];
const RAIL = tidy(chain(railways.elements, [9.3949, 41.801], STATION), .012, 0);

const overland = spread(snap(HEART, false), false);
const PATHS = Object.fromEntries(Object.entries({
  quenza: [9.1361, 41.7667], zonza: [9.1708, 41.7494], levie: [9.1225, 41.7033], ospedale: [9.1964, 41.6536]
}).map(([name, place]) => [name, tidy(overland(snap(place, false)), .07)]));
/* the two roads of summer: from Bastia in the north, from Figari and Bonifacio in the south-west */
const ROADS = Object.fromEntries(Object.entries({nord: [9.396, 41.799], sud: [9.105, 41.503]})
  .map(([name, place]) => [name, tidy(overland(snap(place, false)), .07).reverse()]));
const oversea = spread(snap(MARINE, true), true);
const SEAWAY = tidy(oversea(snap([9.419, 41.632], true)), .05);

const lines = [
  '/* Written by tools/build_traces.mjs — do not edit by hand.',
  '   Walls, bastions, church and railway: © OpenStreetMap contributors, ODbL.',
  '   PATHS, ROADS and SEAWAY are the gentlest way across the relief, not historical routes. */',
  'export const WALLS = ' + JSON.stringify(WALLS) + ';',
  'export const BASTIONS = ' + JSON.stringify(BASTIONS) + ';',
  'export const CHURCH = ' + JSON.stringify(CHURCH) + ';',
  'export const RAIL = ' + JSON.stringify(RAIL) + ';',
  'export const PATHS = ' + JSON.stringify(PATHS) + ';',
  'export const ROADS = ' + JSON.stringify(ROADS) + ';',
  'export const SEAWAY = ' + JSON.stringify(SEAWAY) + ';',
  ''
];
writeFileSync(join(root, 'src/traces.js'), lines.join('\n'));
const length = line => line.slice(1).reduce((sum, point, i) => sum + metres(point, line[i]), 0) / 1000;
console.log('walls', WALLS.length, '· bastions', BASTIONS.map(b => b.name).join(', '));
console.log('rail', RAIL.length, 'points,', length(RAIL).toFixed(1), 'km, ends', RAIL[0], RAIL[RAIL.length - 1]);
for (const [name, line] of [...Object.entries(PATHS), ...Object.entries(ROADS), ['seaway', SEAWAY]]) console.log(name, line.length, 'points,', length(line).toFixed(1), 'km');
