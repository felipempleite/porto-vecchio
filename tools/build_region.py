"""Regional relief for the web page, from Quenza to Santa Giulia.

    python3 tools/build_region.py [cache-dir]

Reads the IGN elevation tiles (WMTS, WGS84G level 11, about 38 m) and writes
assets/relief/region.png with region.json beside it. Heights are stored on 16 bits,
high byte in red and low byte in green, so that the browser can read them from an
ordinary image. Sea and missing values are stored as zero. Needs numpy.
"""
import json
import struct
import sys
import urllib.request
import zlib
from pathlib import Path

import numpy as np

WEST, SOUTH, EAST, NORTH = 9.08, 41.50, 9.42, 41.80
WIDTH, HEIGHT = 744, 656          # about 50 m, a little coarser than the tiles
STEP = 0.25                       # metres per stored unit
TILE = 360 / 4096

root = Path(__file__).resolve().parent.parent
cache = Path(sys.argv[1]) if len(sys.argv) > 1 else root / '.cache-ign'
cache.mkdir(parents=True, exist_ok=True)
tiles = {}


def tile(i, j):
    if (i, j) not in tiles:
        local = cache / f'ign-11-{i}-{j}.bil'
        if not local.exists():
            url = ('https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile'
                   '&LAYER=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES&STYLE=normal'
                   f'&TILEMATRIXSET=WGS84G&TILEMATRIX=11&TILEROW={j}&TILECOL={i}'
                   '&FORMAT=image%2Fx-bil%3Bbits%3D32')
            with urllib.request.urlopen(url, timeout=60) as response:
                local.write_bytes(response.read())
        raw = local.read_bytes()
        try:
            raw = zlib.decompress(raw)
        except zlib.error:
            pass
        tiles[i, j] = np.frombuffer(raw, '<f4').reshape(256, 256)
    return tiles[i, j]


def sample(lon, lat):
    """Bilinear reading across tile borders."""
    px, py = (180 + lon) / TILE * 256 - .5, (90 - lat) / TILE * 256 - .5
    x0, y0 = int(np.floor(px)), int(np.floor(py))
    fx, fy = px - x0, py - y0
    total = 0.0
    for dy, wy in ((0, 1 - fy), (1, fy)):
        for dx, wx in ((0, 1 - fx), (1, fx)):
            x, y = x0 + dx, y0 + dy
            h = float(tile(x // 256, y // 256)[y % 256, x % 256])
            total += wx * wy * (h if h > -100 else 0.0)
    return max(0.0, total)


grid = np.zeros((HEIGHT, WIDTH), np.float64)
for row in range(HEIGHT):
    lat = NORTH - (NORTH - SOUTH) * row / (HEIGHT - 1)
    for col in range(WIDTH):
        grid[row, col] = sample(WEST + (EAST - WEST) * col / (WIDTH - 1), lat)

stored = np.clip(np.round(grid / STEP), 0, 65535).astype(np.uint16)
pixels = np.zeros((HEIGHT, WIDTH, 3), np.uint8)
pixels[..., 0] = stored >> 8
pixels[..., 1] = stored & 255


def chunk(kind, data):
    body = kind + data
    return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body))


# PNG filter 1 (difference with the pixel on the left) suits smooth relief.
shifted = np.zeros_like(pixels)
shifted[:, 1:] = pixels[:, :-1]
filtered = (pixels.astype(np.int16) - shifted).astype(np.uint8)
lines = b''.join(b'\x01' + filtered[row].tobytes() for row in range(HEIGHT))
png = (b'\x89PNG\r\n\x1a\n'
       + chunk(b'IHDR', struct.pack('>IIBBBBB', WIDTH, HEIGHT, 8, 2, 0, 0, 0))
       + chunk(b'IDAT', zlib.compress(lines, 9))
       + chunk(b'IEND', b''))
out = root / 'assets' / 'relief'
(out / 'region.png').write_bytes(png)
(out / 'region.json').write_text(json.dumps({
    'west': WEST, 'south': SOUTH, 'east': EAST, 'north': NORTH,
    'width': WIDTH, 'height': HEIGHT, 'metresPerUnit': STEP,
    'highest': round(float(grid.max()), 1),
    'source': 'IGN, RGE ALTI, WMTS ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES, WGS84G niveau 11',
}, ensure_ascii=False, indent=1) + '\n')
print('region.png', len(png), 'bytes; highest point', grid.max(), 'm')
