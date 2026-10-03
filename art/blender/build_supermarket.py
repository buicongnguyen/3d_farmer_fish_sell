"""Willowmere Supermarket: the big shop east of Willow & Co., in the same toy style as the town kit.

Run:  blender --background --factory-startup --python art/blender/build_supermarket.py
Writes public/assets/models/supermarket.glb (one mesh, `supermarket`) and art/previews/supermarket.webp.
A file of its own, so the town kit (town.glb) is not rewritten.

Contract (glTF, Y up, front faces +Z, origin = ground centre, metres):
  supermarket   footprint <= 15 x 8 (walls 14.2 x 7), walk, planters and trolley bay to z +5.6, h <= 8.6.
                Every material is opaque (the glass too), so the building joins the village's one baked draw.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import style as S
from style import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'models', 'supermarket.glb')
PREVIEW = os.path.join(ROOT, 'art', 'previews', 'supermarket.webp')

reset_scene()
M = {
    'wall': mat('Super wall', '#FFF6E4', .7), 'red': mat('Super red', '#F0463C', .45), 'red_dark': mat('Super red dark', '#C22F2A', .5),
    'white': mat('Trim', 'white', .55), 'glass': mat('Glass', '#8FE6FF', .12), 'glass_dark': mat('Super glass deep', '#4FB7E0', .15),
    'stone': mat('Stone', 'stone', .85), 'stone_dark': mat('Stone dark', 'stone_dark', .85), 'charcoal': mat('Charcoal', 'charcoal', .6),
    'wood': mat('Wood', 'wood', .7), 'wood_light': mat('Wood light', 'wood_light', .7), 'leaf': mat('Leaf', 'leaf', .6), 'leaf_light': mat('Leaf light', 'leaf_light', .6),
    'sun': mat('Petal sun', 'sun', .5), 'rose': mat('Petal rose', 'rose', .5), 'orange': mat('Company orange', 'tangerine', .45),
    'green': mat('Super green', '#3FBF4A', .5), 'steel': mat('Super steel', '#C9D2DE', .35, .3), 'brick': mat('Brick', '#D9663F', .8), 'soil': mat('Soil', 'soil', .9),
    'violet': mat('Petal violet', 'violet', .5), 'teal': mat('Company teal', 'teal', .35),
}
W, D, H, Z0 = 14.2, 7.0, 4.3, .3
FRONT = -D / 2
p = []

# ---- body: a wide single storey on a low plinth, a red band and a parapet
p.append(box('base', (15, 7.8, Z0), (0, 0, Z0 / 2), M['stone'], bev=.08, seg=2))
p.append(box('wall', (W, D, H), (0, 0, Z0 + H / 2), M['wall'], bev=.06, seg=2))
p.append(box('band', (W + .16, D + .16, .5), (0, 0, Z0 + H - .1), M['red'], bev=.06, seg=2))
p.append(box('parapet', (W + .3, D + .3, .3), (0, 0, Z0 + H + .3), M['white'], bev=.06, seg=2))
p.append(box('roof', (W - .5, D - .5, .1), (0, 0, Z0 + H + .42), M['stone'], bev=0))
for sx in (-1, 1):  # corner piers
    p.append(box('pier', (.5, .5, H), (sx * (W / 2 - .1), FRONT + .1, Z0 + H / 2), M['red'], bev=.08, seg=2))

# ---- the glass front: two long shop windows either side of the doors, with the shelves seen through them
def shop_window(cx, w):
    zc, h = Z0 + 1.55, 2.5
    out = [box('glass', (w, .1, h), (cx, FRONT - .02, zc), M['glass'], bev=0),
           box('sill', (w + .2, .34, .3), (cx, FRONT - .1, Z0 + .15), M['stone_dark'], bev=.04, seg=1),
           box('head', (w + .2, .2, .16), (cx, FRONT - .08, zc + h / 2 + .06), M['white'], bev=.03, seg=1)]
    n = max(2, round(w / 1.5))
    for k in range(n + 1):
        out.append(box('mull', (.1, .16, h), (cx - w / 2 + k * w / n, FRONT - .09, zc), M['white'], bev=0))
    # Shelves and what is on them: three rows of little coloured goods.
    goods = ['red', 'sun', 'green', 'orange', 'violet', 'teal', 'rose', 'leaf_light']
    for row in range(3):
        z = Z0 + .75 + row * .72
        out.append(box('shelf', (w - .3, .06, .07), (cx, FRONT - .075, z), M['wood_light'], bev=0))
        m = int((w - .5) / .42)
        for i in range(m):
            x = cx - (w - .5) / 2 + (i + .5) * (w - .5) / m
            tall = .22 + ((i * 7 + row * 3) % 4) * .06
            out.append(box('good', (.26, .05, tall), (x, FRONT - .078, z + .035 + tall / 2), M[goods[(i + row * 3) % len(goods)]], bev=0))
    return out

p += shop_window(-4.35, 4.9) + shop_window(4.35, 4.9)

# ---- sliding doors in the middle, a welcome mat
p.append(box('doorframe', (3.1, .2, 2.9), (0, FRONT - .05, Z0 + 1.45), M['white'], bev=.05, seg=2))
for sx in (-1, 1):
    p.append(box('door', (1.3, .1, 2.5), (sx * .68, FRONT - .13, Z0 + 1.3), M['glass_dark'], bev=.02, seg=1))
    p.append(box('handle', (.07, .08, .9), (sx * .16, FRONT - .2, Z0 + 1.3), M['steel'], bev=0))
p.append(box('transom', (2.7, .1, .3), (0, FRONT - .13, Z0 + 2.72), M['green'], bev=.02, seg=1))
p.append(box('mat', (2.8, 1.3, .05), (0, FRONT - .9, Z0 + .02), M['green'], bev=0))
p.append(box('walk', (15, 1.9, .12), (0, FRONT - 1.05, .06), M['stone'], bev=.03, seg=1))

# ---- the striped awning along the whole front
AW_Z, AW_D, n = Z0 + 3.55, 1.25, 14
for i in range(n):
    x = -W / 2 + (i + .5) * W / n
    p.append(box('awning', (W / n + .005, AW_D, .12), (x, FRONT - AW_D / 2 + .05, AW_Z - .12), M['red' if i % 2 == 0 else 'white'], bev=0, rot=(-.2, 0, 0)))
    p.append(cyl('scallop', W / n / 2, .1, (x, FRONT - AW_D + .1, AW_Z - .27), M['red' if i % 2 == 0 else 'white'], verts=10, rot=(math.pi / 2, 0, 0), bev=0))
p.append(box('awbar', (W + .1, .1, .1), (0, FRONT - .03, AW_Z + .06), M['red_dark'], bev=0))

# ---- the big sign board on the roof: a red board, a white trolley and three bars of "lettering"
SZ = Z0 + H + 1.75
p.append(box('signback', (9.6, .36, 2.5), (0, FRONT + .5, SZ), M['red'], bev=.16, seg=3))
p.append(box('signrim', (9.9, .26, 2.8), (0, FRONT + .56, SZ), M['white'], bev=.18, seg=3))
for sx in (-1, 1):
    p.append(box('signpost', (.24, .24, 1.0), (sx * 3.6, FRONT + .62, Z0 + H + .7), M['charcoal'], bev=0))
def trolley_logo(cx, y, cz, s):
    out = [box('lb', (1.1 * s, .1, .62 * s), (cx + .1 * s, y, cz + .1 * s), M['white'], bev=.04, seg=1),
           box('lh', (.5 * s, .1, .1 * s), (cx - .68 * s, y, cz + .42 * s), M['white'], bev=0),
           box('lh', (.1 * s, .1, .5 * s), (cx - .48 * s, y, cz + .2 * s), M['white'], bev=0)]
    for k in range(3):
        out.append(box('lg', (.07 * s, .12, .5 * s), (cx - .2 * s + k * .3 * s, y - .02, cz + .1 * s), M['red'], bev=0))
    for dx in (-.25, .45):
        out.append(cyl('lw', .13 * s, .1, (cx + dx * s, y, cz - .38 * s), M['white'], verts=12, rot=(math.pi / 2, 0, 0), bev=0))
    return out
p += trolley_logo(-3.3, FRONT + .28, SZ, 1.25)
for k, (w, c) in enumerate(((5.2, 'white'), (4.2, 'sun'), (3.0, 'white'))):
    p.append(box('bar', (w, .12, .34), (1.1 - (5.2 - w) / 2, FRONT + .28, SZ + .62 - k * .62), M[c], bev=.08, seg=2))

# ---- roof: a skylight row, two air units
for k in range(3):
    p.append(box('sky', (2.2, 1.5, .3), (-4 + k * 4, 1.2, Z0 + H + .5), M['glass'], bev=.1, seg=2))
for x in (-5.4, 5.4):
    p.append(box('air', (1.3, 1.0, .7), (x, 2.2, Z0 + H + .7), M['steel'], bev=.08, seg=2))
    p.append(cyl('fan', .34, .08, (x, 2.2, Z0 + H + 1.08), M['charcoal'], verts=14, bev=0))

# ---- side walls: a window band on each, a delivery door at the back of the east side
for sx in (-1, 1):
    p.append(box('sidewin', (.1, 4.2, 1.2), (sx * (W / 2 + .02), -.6, Z0 + 2.3), M['glass'], bev=0))
    for k in range(4):
        p.append(box('sidemull', (.14, .1, 1.2), (sx * (W / 2 + .05), -2.7 + k * 1.4, Z0 + 2.3), M['white'], bev=0))
p.append(box('delivery', (.12, 1.9, 2.3), (W / 2 + .03, 2.3, Z0 + 1.15), M['steel'], bev=0))
for k in range(5):
    p.append(box('slat', (.14, 1.9, .05), (W / 2 + .05, 2.3, Z0 + .3 + k * .45), M['stone_dark'], bev=0))

# ---- out front under the awning: crates of fruit and greens on the left of the doors
def crate(x, y, color):
    out = [box('crate', (1.0, .7, .5), (x, y, Z0 + .37), M['wood'], bev=.04, seg=1),
           box('crateleg', (.9, .6, .14), (x, y, Z0 + .07), M['wood_light'], bev=0)]
    for i in range(4):
        for j in range(2):
            out.append(ico('fruit', .15, (x - .33 + i * .22, y - .14 + j * .28, Z0 + .68), M[color], subdiv=1))
    return out
for i, c in enumerate(('red', 'orange', 'green', 'sun')):
    p += crate(-6.1 + i * 1.2, FRONT - .75, c)

# ---- the trolley bay on the right: a little roofed rail with a row of trolleys
BX, BY = 4.9, FRONT - 1.15
for sx in (-1, 1):
    p.append(box('baypost', (.1, .1, 1.5), (BX + sx * 1.5, BY - .55, Z0 + .75), M['steel'], bev=0))
    p.append(box('baypost', (.1, .1, 1.5), (BX + sx * 1.5, BY + .55, Z0 + .75), M['steel'], bev=0))
p.append(box('bayroof', (3.3, 1.4, .1), (BX, BY, Z0 + 1.55), M['green'], bev=.04, seg=1))
p.append(box('bayrail', (3.0, .06, .06), (BX, BY - .55, Z0 + .6), M['steel'], bev=0))
def trolley(x, y):
    out = [box('tb', (.42, .78, .36), (x, y, Z0 + .62), M['steel'], bev=.03, seg=1),
           box('ti', (.34, .7, .06), (x, y, Z0 + .8), M['charcoal'], bev=0),
           box('th', (.46, .07, .07), (x, y + .44, Z0 + .92), M['red'], bev=0),
           box('tf', (.36, .7, .05), (x, y, Z0 + .28), M['stone_dark'], bev=0)]
    for dx in (-.16, .16):
        for dy in (-.3, .3):
            out.append(cyl('tw', .08, .05, (x + dx, y + dy, Z0 + .1), M['charcoal'], verts=8, rot=(0, math.pi / 2, 0), bev=0))
    return out
for k in range(5):
    p += trolley(BX - 1.1 + k * .55, BY + .02)

# ---- planters at both ends of the walk, a bin, a bench
def planter(x, y, w):
    out = [box('planter', (w, .8, .55), (x, y, Z0 + .28), M['brick'], bev=.06, seg=2), box('psoil', (w - .16, .64, .06), (x, y, Z0 + .56), M['soil'], bev=0)]
    n = max(2, int(w / .55))
    for i in range(n):
        bx = x - w / 2 + (i + .5) * w / n
        out.append(ico('bush', .34, (bx, y, Z0 + .8), M['leaf' if i % 2 else 'leaf_light'], subdiv=2, scale=(1, 1, .85)))
        out.append(ico('bloom', .1, (bx + .12, y - .22, Z0 + 1.0), M[('rose', 'sun', 'violet')[i % 3]], subdiv=1))
    return out
p += planter(-6.6, FRONT - 1.68, 1.5) + planter(1.9, FRONT - 1.68, .9) + planter(-1.9, FRONT - 1.68, .9)
p.append(box('bench', (1.6, .45, .1), (-3.6, FRONT - 1.72, Z0 + .42), M['wood_light'], bev=.03, seg=1))
for sx in (-1, 1):
    p.append(box('benchleg', (.1, .4, .4), (-3.6 + sx * .65, FRONT - 1.72, Z0 + .2), M['charcoal'], bev=0))

model = join(p, 'supermarket')
print(f'supermarket: {triangles(model)} triangles')
xs = [v.co.x for v in model.data.vertices]; ys = [v.co.y for v in model.data.vertices]; zs = [v.co.z for v in model.data.vertices]
print('bounds x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f' % (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)))
size = export_glb([model], OUT)
print('supermarket.glb', size, 'bytes')

studio('#6FD24A', (1400, 1000))
game_camera((0, -1, 2.5), 22)
render(PREVIEW)
