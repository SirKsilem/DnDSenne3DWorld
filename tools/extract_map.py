#!/usr/bin/env python3
"""
Turn the Holmstead city map (data/holmstead/source-map.jpg) into data the 3D world loads:

  world.json      wall, tower, gate, castle and quay geometry (metres)
  buildings.json  building footprints as polygons (metres)
  heights.bin     terrain height grid (int16, centimetres)
  ground.jpg      ground colour texture (streets, fields, roads, grass)
  landuse.png     coarse land-use grid used to place trees
  minimap.jpg     the map itself, smaller, for the in-game minimap

You only need to run this again if the map image changes:

    pip install numpy opencv-python-headless
    python3 tools/extract_map.py

It relies on the map's colours (buildings, river, black walls) and on a few hand-placed
road lines below, so a very different map will need those adjusting.
"""
import json
import math
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'holmstead')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT, 'source-map.jpg')

M_PER_PX = 200 / 575          # from the map's scale bar
COL_BUILDING = (155, 147, 136)
COL_WATER = (105, 95, 93)
COL_WATER_DARK = (60, 55, 50)
CASTLE_CENTER = (2030, 2270)  # px, roughly
COMPASS_BOX = (3650, 3300)    # ignore everything right/below this (the compass rose)
HEIGHT_CELL = 2.5             # metres between height samples
LANDUSE_CELL = 5.0
CITY_GROUND = 3.0             # street level inside the walls (water level is 0)

# Roads outside the walls, traced by hand from the map (pixel coordinates).
ROADS = [
    [(870, 1280), (640, 1110), (320, 985), (0, 880)],                                   # west gate road
    [(1060, 2520), (1005, 2650), (900, 2850), (815, 3170), (690, 3430), (430, 3700), (130, 3830), (0, 3850)],  # Fish Road
    [(2350, 3040), (2360, 3220), (2370, 3500), (2375, 3919)],                           # south road
    [(3060, 1490), (3115, 1370), (3210, 1190), (3340, 1005), (3530, 855), (3850, 705), (4280, 640)],  # River Road
    [(3185, 2225), (3340, 2265), (3510, 2315), (3600, 2460), (3680, 2600), (3980, 2780), (4280, 2985)],  # Monastery Road
]

# Bridges over the river: two ends in pixels and a width in metres.
BRIDGES = [
    dict(a=(2226, 980), b=(2356, 1042), width=4.5, kind='wood'),   # north footbridge (West Village - Oldtown)
    dict(a=(2098, 1482), b=(2219, 1548), width=4.5, kind='wood'),  # footbridge (Hightown - Oldtown)
    dict(a=(1660, 1700), b=(1708, 1882), width=9.0, kind='stone'),  # main bridge (Hightown - market)
]

S = M_PER_PX


def log(*a):
    print(*a, flush=True)


def to_world(px, py):
    return (px - W / 2) * S, (py - H / 2) * S


def r1(v):
    return round(float(v), 1)


img = cv2.imread(SRC)
if img is None:
    sys.exit(f'Could not read {SRC}')
rgb = img[:, :, ::-1].astype(np.int16)
H, W = rgb.shape[:2]
log(f'map {W}x{H}px, {W * S:.0f} x {H * S:.0f} m')


def near(c, tol):
    return (np.abs(rgb - np.array(c, dtype=np.int16)).max(2) < tol).astype(np.uint8)


def ellipse(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (r, r))


not_compass = np.ones((H, W), np.uint8)
not_compass[COMPASS_BOX[1]:, COMPASS_BOX[0]:] = 0

# ---------------------------------------------------------------- water
water = near(COL_WATER, 24) | near(COL_WATER_DARK, 18)
water = cv2.morphologyEx(water, cv2.MORPH_CLOSE, ellipse(7))
water = cv2.morphologyEx(water, cv2.MORPH_OPEN, ellipse(15))
n, lab, st, _ = cv2.connectedComponentsWithStats(water, 8)
water = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 15000]).astype(np.uint8)
# The map draws the wide bridge as land; carve the river back underneath every bridge.
closed = cv2.morphologyEx(water, cv2.MORPH_CLOSE, ellipse(81))
for br in BRIDGES:
    band = np.zeros_like(water)
    cv2.line(band, br['a'], br['b'], 1, thickness=int(br['width'] / S) + 30)
    water |= closed & band
log('water px', int(water.sum()))

# ---------------------------------------------------------------- towers, gates
dark = (rgb.max(2) < 70).astype(np.uint8) & not_compass
blobs_m = cv2.morphologyEx(dark, cv2.MORPH_OPEN, ellipse(27))
n, lab, st, cen = cv2.connectedComponentsWithStats(blobs_m, 8)
blobs = [dict(x=float(cen[i][0]), y=float(cen[i][1]), w=int(st[i, 2]), h=int(st[i, 3]),
              fill=st[i, 4] / (st[i, 2] * st[i, 3])) for i in range(1, n)]
castle_b = [b for b in blobs if math.hypot(b['x'] - CASTLE_CENTER[0], b['y'] - CASTLE_CENTER[1]) < 400]
city_b = [b for b in blobs if b not in castle_b]


def order_ring(pts):
    cx = sum(p['x'] for p in pts) / len(pts)
    cy = sum(p['y'] for p in pts) / len(pts)
    return sorted(pts, key=lambda p: math.atan2(p['y'] - cy, p['x'] - cx)), (cx, cy)


def frac_on(mask, a, b, steps=60):
    hits = 0
    for t in np.linspace(0.1, 0.9, steps):
        x = int(a['x'] + (b['x'] - a['x']) * t)
        y = int(a['y'] + (b['y'] - a['y']) * t)
        hits += mask[y, x] > 0
    return hits / steps


def ring_geometry(pts, is_gate):
    """Walk round a ring of towers. Two blocks close together form a gate; the rest are towers
    joined by wall segments ('water' where the wall crosses the river)."""
    k = len(pts)
    gate_pairs = [i for i in range(k) if is_gate(pts[i], pts[(i + 1) % k])]
    in_gate = {j for i in gate_pairs for j in (i, (i + 1) % k)}
    towers, gates, segs = [], [], []
    for i in range(k):
        a, b = pts[i], pts[(i + 1) % k]
        ax, az = to_world(a['x'], a['y'])
        bx, bz = to_world(b['x'], b['y'])
        if i in gate_pairs:
            gates.append(dict(a=[r1(ax), r1(az)], b=[r1(bx), r1(bz)]))
        else:
            segs.append([r1(ax), r1(az), r1(bx), r1(bz), 'water' if frac_on(water, a, b) > 0.25 else 'wall'])
        if i not in in_gate:
            towers.append([r1(ax), r1(az), r1(max(a['w'], a['h']) * S / 2)])
    return towers, gates, segs


city_pts, city_c = order_ring(city_b)
city_towers, city_gates, city_segs = ring_geometry(
    city_pts, lambda a, b: math.hypot(a['x'] - b['x'], a['y'] - b['y']) < 110)
log(f'city: {len(city_towers)} towers, {len(city_gates)} gates, {len(city_segs)} wall segments '
    f'({sum(s[4] == "water" for s in city_segs)} over water)')

castle_pts, castle_c = order_ring(castle_b)
gate_idx = max(range(len(castle_pts)), key=lambda i: castle_pts[i]['fill'])  # the square gate block
castle_towers, castle_gates, castle_segs = [], [], []
for i, p in enumerate(castle_pts):
    x, z = to_world(p['x'], p['y'])
    if i == gate_idx:
        castle_gates.append([r1(x), r1(z)])
    else:
        castle_towers.append([r1(x), r1(z), r1(max(p['w'], p['h']) * S / 2)])
    q = castle_pts[(i + 1) % len(castle_pts)]
    qx, qz = to_world(q['x'], q['y'])
    castle_segs.append([r1(x), r1(z), r1(qx), r1(qz), 'wall'])
log(f'castle: {len(castle_towers)} towers, gate at {castle_gates}')

city_poly = np.array([[p['x'], p['y']] for p in city_pts], np.int32)
castle_poly = np.array([[p['x'], p['y']] for p in castle_pts], np.int32)
in_city = np.zeros((H, W), np.uint8)
cv2.fillPoly(in_city, [city_poly], 1)
in_castle = np.zeros((H, W), np.uint8)
cv2.fillPoly(in_castle, [castle_poly], 1)

# ---------------------------------------------------------------- buildings
bmask = near(COL_BUILDING, 22) & not_compass
bmask = cv2.morphologyEx(bmask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
bmask[cv2.dilate(in_castle, ellipse(41)) > 0] = 0
n, lab, st, _ = cv2.connectedComponentsWithStats(bmask, 4)
buildings = []
for i in range(1, n):
    x, y, w, h, area = st[i]
    if area < 120:
        continue
    pad = 4
    x0, y0 = max(x - pad, 0), max(y - pad, 0)
    sub = (lab[y0:y + h + pad, x0:x + w + pad] == i).astype(np.uint8)
    sub = cv2.dilate(sub, np.ones((3, 3), np.uint8), iterations=2)  # cover the drawn outline so neighbours touch
    cs, _ = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cs, key=cv2.contourArea)
    poly = cv2.approxPolyDP(c, 2.2, True)[:, 0, :]
    if len(poly) < 3:
        continue
    pts = []
    for px, py in poly:
        wx, wz = to_world(px + x0, py + y0)
        pts += [r1(wx), r1(wz)]
    cx, cy = x + w / 2, y + h / 2
    buildings.append(dict(p=pts, c=int(in_city[int(cy), int(cx)])))
log('buildings', len(buildings))

# ---------------------------------------------------------------- fields (striped areas)
lum = rgb.mean(2)
stripes = ((lum > 60) & (lum < 160) & (bmask == 0) & (water == 0) & (in_city == 0)).astype(np.float32)
stripes[:, :][not_compass == 0] = 0
dens = cv2.boxFilter(stripes, -1, (25, 25))
fields = (dens > 0.16).astype(np.uint8)
fields = cv2.morphologyEx(fields, cv2.MORPH_OPEN, ellipse(21))
fields[cv2.dilate(in_city, ellipse(61)) > 0] = 0
n_f, field_lab = cv2.connectedComponents(cv2.erode(fields, ellipse(7)), 4)
log('field patches', n_f - 1)

# ---------------------------------------------------------------- roads (hand traced)
road_mask = np.zeros((H, W), np.uint8)
for road in ROADS:
    cv2.polylines(road_mask, [np.array(road, np.int32)], False, 1, thickness=int(6.5 / S))

# ---------------------------------------------------------------- heights
d_water_out = cv2.distanceTransform((1 - water).astype(np.uint8), cv2.DIST_L2, 5) * S  # metres to water
d_water_in = cv2.distanceTransform(water, cv2.DIST_L2, 5) * S
d_city = cv2.distanceTransform((1 - in_city).astype(np.uint8), cv2.DIST_L2, 5) * S
d_castle_in = cv2.distanceTransform(in_castle, cv2.DIST_L2, 5) * S


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


cols = int(W * S / HEIGHT_CELL) + 1
rows = int(H * S / HEIGHT_CELL) + 1
gx = np.clip((np.arange(cols) * HEIGHT_CELL / S).astype(int), 0, W - 1)
gy = np.clip((np.arange(rows) * HEIGHT_CELL / S).astype(int), 0, H - 1)
GX, GY = np.meshgrid(gx, gy)
wx, wz = GX * S, GY * S
hills = (np.sin(wx * 0.011 + 0.7) * np.cos(wz * 0.013 - 0.4) * 3.0
         + np.sin(wx * 0.027 + 2.1) * np.sin(wz * 0.023 + 1.3) * 1.3
         + np.sin(wx * 0.004 - 1.0) * 2.5)
ramp = smoothstep(25, 220, d_city[GY, GX])
land = CITY_GROUND + hills * ramp
outside = in_city[GY, GX] == 0
bank = smoothstep(0, 18, d_water_out[GY, GX])
land = np.where(outside, 0.5 + (land - 0.5) * bank, land)
land = land + 1.2 * smoothstep(0, 12, d_castle_in[GY, GX])  # the castle sits a little higher
riverbed = -1.2 - 2.8 * smoothstep(0, 12, d_water_in[GY, GX])
heights = np.where(water[GY, GX] > 0, riverbed, land)
(np.round(heights * 100).astype('<i2')).tofile(os.path.join(OUT, 'heights.bin'))
log(f'heights {cols}x{rows}, range {heights.min():.1f}..{heights.max():.1f} m')

# ---------------------------------------------------------------- ground texture (half resolution)
TW, TH = W // 2, H // 2
rng = np.random.default_rng(7)


def half(mask):
    return cv2.resize(mask.astype(np.float32), (TW, TH), interpolation=cv2.INTER_AREA)


def noise(scale, amp):
    small = rng.random((TH // scale + 2, TW // scale + 2)).astype(np.float32)
    return (cv2.resize(small, (TW, TH), interpolation=cv2.INTER_CUBIC) - 0.5) * 2 * amp


tex = np.zeros((TH, TW, 3), np.float32)
grass = np.array([96, 128, 62], np.float32)
tex[:] = grass
tex += noise(60, 14)[..., None] * np.array([0.8, 1.0, 0.5])
tex += noise(8, 6)[..., None]
city_h = half(in_city)[..., None]
cobble = np.array([150, 138, 120], np.float32) + noise(4, 9)[..., None] + noise(40, 8)[..., None]
tex = tex * (1 - city_h) + cobble * city_h
castle_h = half(in_castle)[..., None]
tex = tex * (1 - castle_h) + (np.array([132, 128, 122], np.float32) + noise(3, 10)[..., None]) * castle_h

# fields: original stripes become furrows, each patch gets its own crop colour
crops = np.array([[196, 168, 88], [170, 150, 70], [120, 140, 60], [150, 160, 78], [186, 150, 90], [104, 120, 56], [205, 182, 110]], np.float32)
fl_half = cv2.resize(field_lab.astype(np.int32), (TW, TH), interpolation=cv2.INTER_NEAREST)
fh = half(fields)[..., None]
crop_col = crops[(fl_half * 7919) % len(crops)]
furrow = half(stripes)[..., None]
field_col = crop_col * (1 - 0.45 * furrow) + noise(6, 6)[..., None]
tex = tex * (1 - fh) + field_col * fh

# green plots on the map (temple and shrine gardens)
green = (np.abs(rgb - np.array([212, 228, 214])).max(2) < 25).astype(np.uint8)
gh = half(green)[..., None]
tex = tex * (1 - gh) + np.array([110, 150, 80], np.float32) * gh

rh = half(cv2.GaussianBlur(road_mask.astype(np.float32), (9, 9), 3))[..., None]
tex = tex * (1 - rh) + (np.array([150, 128, 92], np.float32) + noise(4, 10)[..., None]) * rh
wh = half(water)[..., None]
tex = tex * (1 - wh) + np.array([70, 64, 52], np.float32) * wh
cv2.imwrite(os.path.join(OUT, 'ground.jpg'), np.clip(tex, 0, 255).astype(np.uint8)[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 82])

# ---------------------------------------------------------------- land use grid for trees
LU = {'grass': 0, 'water': 1, 'city': 2, 'field': 3, 'road': 4, 'building': 5}
lc, lr = int(W * S / LANDUSE_CELL), int(H * S / LANDUSE_CELL)
small = lambda m: cv2.resize(m.astype(np.float32), (lc, lr), interpolation=cv2.INTER_AREA)
lu = np.zeros((lr, lc), np.uint8)
lu[small(fields) > 0.4] = LU['field']
lu[small(cv2.dilate(in_city, ellipse(51))) > 0.05] = LU['city']
lu[small(road_mask) > 0.05] = LU['road']
lu[small(bmask) > 0.1] = LU['building']
lu[small(water) > 0.05] = LU['water']
cv2.imwrite(os.path.join(OUT, 'landuse.png'), lu * 40)

# ---------------------------------------------------------------- quays (river edges inside the walls)
quays = []
cs, _ = cv2.findContours(water, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
city_inner = cv2.erode(in_city, ellipse(31))
for c in cs:
    poly = cv2.approxPolyDP(c, 1.5, True)[:, 0, :].astype(float)
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        L = math.hypot(*(b - a))
        pieces = max(1, int(math.ceil(L * S / 4)))
        for k in range(pieces):
            p = a + (b - a) * (k / pieces)
            q = a + (b - a) * ((k + 1) / pieces)
            m = (p + q) / 2
            if city_inner[int(m[1]), int(m[0])] == 0:
                continue
            ax, az = to_world(*p)
            bx, bz = to_world(*q)
            quays.append([r1(ax), r1(az), r1(bx), r1(bz)])
log('quay pieces', len(quays))

# ---------------------------------------------------------------- minimap + json
mini = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
cv2.imwrite(os.path.join(OUT, 'minimap.jpg'), mini, [cv2.IMWRITE_JPEG_QUALITY, 80])

x0, z0 = to_world(0, 0)
world = {
    'name': 'Holmstead',
    'metersPerPixel': S,
    'image': [W, H],
    'bounds': [r1(x0), r1(z0), r1(x0 + W * S), r1(z0 + H * S)],
    'cityGround': CITY_GROUND,
    'heightmap': {'file': 'heights.bin', 'cols': cols, 'rows': rows, 'cell': HEIGHT_CELL, 'x0': r1(x0), 'z0': r1(z0), 'scale': 0.01},
    'landuse': {'file': 'landuse.png', 'cols': lc, 'rows': lr, 'cell': LANDUSE_CELL, 'codes': LU},
    'ground': 'ground.jpg',
    'minimap': 'minimap.jpg',
    'cityWall': {'towers': city_towers, 'gates': city_gates, 'segments': city_segs},
    'castle': {'towers': castle_towers, 'gates': castle_gates, 'segments': castle_segs,
               'polygon': [[r1(v) for v in to_world(p['x'], p['y'])] for p in castle_pts]},
    'cityPolygon': [[r1(v) for v in to_world(p['x'], p['y'])] for p in city_pts],
    'quays': quays,
    'roads': [[[r1(v) for v in to_world(x, y)] for x, y in road] for road in ROADS],
    'bridges': [dict(a=[r1(v) for v in to_world(*br['a'])], b=[r1(v) for v in to_world(*br['b'])], width=br['width'], kind=br['kind']) for br in BRIDGES],
}
json.dump(world, open(os.path.join(OUT, 'world.json'), 'w'), separators=(',', ':'))
json.dump(buildings, open(os.path.join(OUT, 'buildings.json'), 'w'), separators=(',', ':'))
log('done')
