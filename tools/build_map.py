"""Build the two hand-styled SVG maps from OpenStreetMap data (© OpenStreetMap contributors, ODbL).
Inputs (not committed, re-fetch with Overpass / OSM API): osm.json (coastline, Taravo, Ospedale lake), town.json (old-town streets/buildings).
Usage: python3 tools/build_map.py <osm.json> <town.json>  -> assets/map/region.svg, assets/map/vieille-ville.svg
"""
import json, math, sys, os
from shapely.geometry import LineString, Polygon, box, Point, MultiPolygon
from shapely.ops import linemerge, polygonize, unary_union

osm = json.load(open(sys.argv[1])); town = json.load(open(sys.argv[2]))
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'map'); os.makedirs(OUT, exist_ok=True)

# ---------- region ----------
LON0, LON1, LAT0, LAT1 = 8.78, 9.45, 41.36, 41.96
C = math.cos(math.radians((LAT0 + LAT1) / 2)); W = 600
K = W / ((LON1 - LON0) * C); H = round((LAT1 - LAT0) * K)
P = lambda lon, lat: ((lon - LON0) * C * K, (LAT1 - lat) * K)
frame = box(LON0, LAT0, LON1, LAT1)

def coords(e): return [(g['lon'], g['lat']) for g in e['geometry']]
coast = [LineString(coords(e)) for e in osm['elements'] if e.get('tags', {}).get('natural') == 'coastline']
merged = linemerge(coast)
lines = list(merged.geoms) if hasattr(merged, 'geoms') else [merged]
closed = [Polygon(l.coords) for l in lines if l.is_ring and len(l.coords) > 3]
openl = [l for l in lines if not l.is_ring]
big = box(8.5, 41.3, 9.6, 42.0)
pieces = list(polygonize(unary_union(openl + [big.exterior])))
mainland = [p for p in pieces if p.contains(Point(9.05, 41.8))]
land = unary_union(mainland + [c for c in closed if c.area > 2e-7]).intersection(frame)
land = land.simplify(0.0009, preserve_topology=True)

def path(geom):
    polys = geom.geoms if hasattr(geom, 'geoms') else [geom]
    out = []
    for pg in polys:
        if pg.geom_type != 'Polygon' or pg.area < 2e-7: continue
        for ring in [pg.exterior, *pg.interiors]:
            pts = [P(*c) for c in ring.coords]
            out.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z')
    return ''.join(out)

def lpath(ls):
    pts = [P(*c) for c in ls.coords]
    return 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)

taravo = linemerge([LineString(coords(e)) for e in osm['elements'] if e.get('tags', {}).get('waterway') == 'river'])
taravo = taravo.intersection(land.buffer(0.002)).simplify(0.0008)
tar_d = ''.join(lpath(g) for g in (taravo.geoms if hasattr(taravo, 'geoms') else [taravo]))
lake = [Polygon(coords(e)) for e in osm['elements'] if e.get('tags', {}).get('natural') == 'water' and e['type'] == 'way']
lake_d = path(unary_union(lake)) if lake else ''
lake_c = unary_union(lake).centroid if lake else Point(9.205, 41.665)

# places: (id, label, lon, lat, label anchor, dx, dy)
places = [
 ('citadelle', 'La citadelle', 9.2800, 41.5915, 'start', 9, -4),
 ('maison', 'La maison', 9.2791, 41.5912, 'end', -9, 10),
 ('salines', 'Les salines', 9.2881, 41.5835, 'start', 9, 8),
 ('marine', 'La Marine', 9.2845, 41.5945, 'start', 9, -10),
 ('ospedale', "L'Ospédale", lake_c.x, lake_c.y, 'end', -9, 4),
 ('palombaggia', 'Palombaggia', 9.3218, 41.5561, 'start', 9, 4),
 ('santa-giulia', 'Santa Giulia', 9.2722, 41.5275, 'end', -9, 6),
 ('cala-rossa', 'Cala Rossa', 9.3489, 41.6205, 'start', 9, 4),
 ('zicavo', 'Zicavo', 9.1301, 41.9080, 'start', 9, 4),
]
orient = [('Bonifacio', 9.1591, 41.3872), ('Propriano', 8.9040, 41.6759), ('Sartène', 8.9747, 41.6215)]

svg = [f'<svg class="map-region" viewBox="0 0 {W} {H}" role="img" aria-labelledby="map-region-title map-region-desc" xmlns="http://www.w3.org/2000/svg">',
 '<title id="map-region-title">Carte du sud de la Corse</title>',
 '<desc id="map-region-desc">Le golfe de Porto-Vecchio, la citadelle, les salines, Palombaggia, Santa Giulia, Cala Rossa, la forêt et le lac de l’Ospédale, et plus au nord, la vallée du Taravo et Zicavo. Données © OpenStreetMap.</desc>',
 '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="6" class="map-hatch"/></pattern>',
 '<radialGradient id="glow"><stop offset="0" stop-color="var(--map-glow, #e2b07a)" stop-opacity=".85"/><stop offset="1" stop-color="var(--map-glow, #e2b07a)" stop-opacity="0"/></radialGradient></defs>',
 f'<rect class="map-sea" width="{W}" height="{H}"/>',
 f'<path class="map-land" d="{path(land)}"/>',
 f'<path class="map-land-hatch" d="{path(land)}" fill="url(#hatch)"/>',
 f'<path class="map-river" data-place="taravo" d="{tar_d}"/>']
if lake_d: svg.append(f'<path class="map-lake" d="{lake_d}"/>')
tx, ty = P(9.02, 41.80)
svg.append(f'<text class="map-label map-label--river" data-place="taravo" x="{tx:.0f}" y="{ty:.0f}" transform="rotate(-18 {tx:.0f} {ty:.0f})">vallée du Taravo</text>')
gx, gy = P(9.33, 41.60)
mx, my = P(9.43, 41.45)
svg.append(f'<text class="map-label map-label--sea map-label--big" x="{mx:.0f}" y="{my:.0f}" text-anchor="end">mer Tyrrhénienne</text>')
for name, lon, lat in orient:
    x, y = P(lon, lat)
    svg.append(f'<g class="map-orient"><circle cx="{x:.1f}" cy="{y:.1f}" r="2"/><text x="{x+6:.1f}" y="{y+4:.1f}">{name}</text></g>')
for pid, label, lon, lat, anchor, dx, dy in places:
    x, y = P(lon, lat)
    cls = 'map-place map-place--home' if pid == 'maison' else 'map-place'
    svg.append(f'<g class="{cls}" data-place="{pid}"><circle class="map-glow" cx="{x:.1f}" cy="{y:.1f}" r="22" fill="url(#glow)"/>'
               f'<circle class="map-dot" cx="{x:.1f}" cy="{y:.1f}" r="{4.2 if pid=="maison" else 3.4}"/>'
               f'<text class="map-label" x="{x+dx:.1f}" y="{y+dy:.1f}" text-anchor="{anchor}">{label}</text></g>')
# compass + scale (10 km)
km = 10 / (111.32 * C) * C * K  # 10 km in px (lon degrees * C * K)
sx, sy = 24, H - 26
svg.append(f'<g class="map-scale"><line x1="{sx}" y1="{sy}" x2="{sx+km:.1f}" y2="{sy}"/><line x1="{sx}" y1="{sy-4}" x2="{sx}" y2="{sy+4}"/><line x1="{sx+km:.1f}" y1="{sy-4}" x2="{sx+km:.1f}" y2="{sy+4}"/><text x="{sx}" y="{sy-8}">10 km</text></g>')
svg.append(f'<g class="map-north" transform="translate({W-34},{40})"><path d="M0,-16 L5,6 L0,2 L-5,6Z"/><text y="22" text-anchor="middle">N</text></g>')
svg.append('</svg>')
open(os.path.join(OUT, 'region.svg'), 'w').write('\n'.join(svg))

# ---------- old town ----------
TL0, TL1, TA0, TA1 = 9.2765, 9.2813, 41.5898, 41.5922
TC = math.cos(math.radians(41.591)); TW = 600
TK = TW / ((TL1 - TL0) * TC); TH = round((TA1 - TA0) * TK)
TP = lambda lon, lat: ((lon - TL0) * TC * TK, (TA1 - lat) * TK)
nodes = {e['id']: (e['lon'], e['lat']) for e in town['elements'] if e['type'] == 'node'}
def wcoords(e): return [nodes[n] for n in e['nodes'] if n in nodes]
def tpath(cs, close=False):
    pts = [TP(*c) for c in cs]
    return 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + ('Z' if close else '')
b_d, s_d, home_d, abb_d = [], [], [], []
for e in town['elements']:
    if e['type'] != 'way': continue
    t = e.get('tags', {}); cs = wcoords(e)
    if len(cs) < 2: continue
    if 'building' in t and len(cs) > 3: b_d.append(tpath(cs, True))
    elif 'highway' in t and t['highway'] not in ('service', 'track', 'path'):
        n = t.get('name', '')
        if n == 'Carrughju Dr Camille de Rocca Serra': home_d.append(tpath(cs))
        elif n == 'Carrughju Abbatucci': abb_d.append(tpath(cs))
        else: s_d.append(tpath(cs))
def mid(name):
    pts = [c for e in town['elements'] if e['type'] == 'way' and e.get('tags', {}).get('name') == name for c in wcoords(e)]
    return TP(sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
hx, hy = mid('Carrughju Dr Camille de Rocca Serra'); ax, ay = mid('Carrughju Abbatucci')
rx, ry = mid("Piazza'lla Ripublica")
t = [f'<svg class="map-town" viewBox="0 0 {TW} {TH}" role="img" aria-labelledby="map-town-title map-town-desc" xmlns="http://www.w3.org/2000/svg">',
 '<title id="map-town-title">La vieille ville de Porto-Vecchio</title>',
 '<desc id="map-town-desc">Plan des ruelles de la vieille ville : en ocre, la rue du Docteur-Camille-de-Rocca-Serra, où se trouve la maison ; en vert, la rue du Général-Abbatucci, qui la prolonge. Données © OpenStreetMap.</desc>',
 f'<rect class="town-bg" width="{TW}" height="{TH}"/>',
 f'<path class="town-buildings" d="{"".join(b_d)}"/>',
 f'<path class="town-streets" d="{"".join(s_d)}"/>',
 f'<path class="town-street town-street--abbatucci" d="{"".join(abb_d)}"/>',
 f'<path class="town-street town-street--home" d="{"".join(home_d)}"/>',
 f'<g class="town-pin"><circle cx="{hx:.1f}" cy="{hy:.1f}" r="16" class="town-pin__halo"/><circle cx="{hx:.1f}" cy="{hy:.1f}" r="5.5" class="town-pin__dot"/></g>',
 f'<text class="town-label town-label--home" x="{hx+22:.1f}" y="{hy+4:.1f}">la maison</text>',
 f'<text class="town-label town-label--street" x="{hx+22:.1f}" y="{hy+22:.1f}">rue du Docteur-Camille-de-Rocca-Serra</text>',
 f'<text class="town-label town-label--abbatucci" x="{ax-14:.1f}" y="{ay+4:.1f}" text-anchor="end">rue du Général-Abbatucci</text>',
 '</svg>']
open(os.path.join(OUT, 'vieille-ville.svg'), 'w').write('\n'.join(t))
print('region', W, H, 'town', TW, TH, 'sizes', os.path.getsize(os.path.join(OUT, 'region.svg')), os.path.getsize(os.path.join(OUT, 'vieille-ville.svg')))

# ---------- inject inline into index.html between markers ----------
idx = os.path.join(os.path.dirname(__file__), '..', 'index.html')
html = open(idx).read()
import re as _re
for key, fn in (('region', 'region.svg'), ('town', 'vieille-ville.svg')):
    body = open(os.path.join(OUT, fn)).read().replace(' xmlns="http://www.w3.org/2000/svg"', '')
    html, n = _re.subn(r'(<!-- map:%s -->).*?(<!-- /map:%s -->)' % (key, key), lambda m: m.group(1) + body + m.group(2), html, flags=_re.S)
    print('inject', key, n)
open(idx, 'w').write(html)
