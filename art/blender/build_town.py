"""Willowmere town kit: family houses and civic buildings in the Zoo Garden toy style.

Run:  blender --background --factory-startup --python art/blender/build_town.py
Writes public/assets/models/town.glb (one top-level mesh per building) and
art/previews/town.webp.

Contract (glTF, Y up, front faces +Z, origin = ground centre, metres):
  house_*   walls 7 x 5.4, roof overhang <= 8.2 x 6.6, porch to z +4.7, h <= 6.6
            Materials 'Roof', 'Roof Trim' and 'Accent' are recoloured per family at runtime.
  school, hospital, police, company   footprint <= 10.6 x 7.6 (porch to z +5), h <= 9.5
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import style as S
from style import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'models', 'town.glb')
PREVIEW = os.path.join(ROOT, 'art', 'previews', 'town.webp')

reset_scene()
M = {
    'wall': mat('Wall', 'cream', .75), 'roof': mat('Roof', '#EF5A3C', .5), 'roof_trim': mat('Roof Trim', '#B9372A', .5),
    'accent': mat('Accent', '#38A8EE', .5), 'trim': mat('Trim', 'white', .55), 'wood': mat('Wood', 'wood', .7),
    'wood_dark': mat('Wood dark', 'wood_dark', .7), 'stone': mat('Stone', 'stone', .85), 'stone_dark': mat('Stone dark', 'stone_dark', .85),
    'glass': mat('Glass', '#8FE6FF', .12), 'gold': mat('Gold', 'gold', .3, .4), 'brick': mat('Brick', '#D9663F', .8),
    'leaf': mat('Leaf', 'leaf', .6), 'leaf_light': mat('Leaf light', 'leaf_light', .6), 'rose': mat('Petal rose', 'rose', .5),
    'sun': mat('Petal sun', 'sun', .5), 'violet': mat('Petal violet', 'violet', .5), 'soil': mat('Soil', 'soil', .9),
    'charcoal': mat('Charcoal', 'charcoal', .6), 'straw': mat('Straw', 'straw', .7), 'straw_dark': mat('Straw dark', 'straw_dark', .7),
    # Civic palettes keep their own names so family tinting never touches them.
    'school_wall': mat('School wall', 'honey', .7), 'school_roof': mat('School roof', '#E8463A', .5),
    'hosp_wall': mat('Hospital wall', 'white', .6), 'mint': mat('Hospital mint', '#3CCFAE', .5), 'red': mat('Cross red', 'red', .45),
    'police_wall': mat('Police wall', '#E3EEFB', .6), 'navy': mat('Police navy', '#2D58C8', .5), 'siren_red': mat('Siren red', '#FF3B4E', .3, emit='#FF3B4E', emit_strength=1.2),
    'siren_blue': mat('Siren blue', '#2F8BFF', .3, emit='#2F8BFF', emit_strength=1.2),
    'co_wall': mat('Company wall', '#F6F2EA', .6), 'tangerine': mat('Company orange', 'tangerine', .45), 'teal': mat('Company teal', 'teal', .35),
}

# --------------------------------------------------------------- helpers
def turn(objs, ang, at=(0, 0, 0)):
    """Rotate parts built for a -Y wall about Z and move them to `at`."""
    c, s = math.cos(ang), math.sin(ang)
    for o in objs:
        x, y, z = o.location
        o.location = (at[0] + x * c - y * s, at[1] + x * s + y * c, at[2] + z)
        o.rotation_euler.z += ang
    return objs

FACE = {'-y': 0, '+x': math.pi / 2, '-x': -math.pi / 2, '+y': math.pi}

def window(at, face='-y', w=1.0, h=1.1, shutters=True, flowers=True, frame='trim', shutter='accent', arch=False):
    p = [box('wf', (w + .22, .14, h + .22), (0, -.05, 0), M[frame], bev=.05, seg=2),
         box('wg', (w, .06, h), (0, -.12, 0), M['glass'], bev=.02, seg=1),
         box('wm', (.07, .05, h), (0, -.16, 0), M[frame], bev=0), box('wm', (w, .05, .07), (0, -.16, 0), M[frame], bev=0),
         box('ws', (w + .4, .3, .1), (0, -.16, -h / 2 - .12), M[frame], bev=.03, seg=2)]
    if arch:
        p.append(cyl('wa', w / 2 + .11, .14, (0, -.05, h / 2), M[frame], verts=16, rot=(math.pi / 2, 0, 0), bev=.03))
        p.append(cyl('wa', w / 2, .06, (0, -.12, h / 2), M['glass'], verts=16, rot=(math.pi / 2, 0, 0), bev=0))
    if shutters:
        for sx in (-1, 1):
            p.append(box('sh', (w * .42, .08, h + .08), (sx * (w / 2 + w * .21 + .14), -.06, 0), M[shutter], bev=.03, seg=2))
    if flowers:
        p.append(box('fb', (w + .22, .32, .26), (0, -.3, -h / 2 - .32), M['wood'], bev=.04, seg=2))
        p.append(box('fs', (w + .05, .2, .06), (0, -.3, -h / 2 - .17), M['soil'], bev=0))
        for i, k in enumerate(('rose', 'sun', 'violet', 'rose')):
            x = -w / 2 + .14 + i * (w - .28) / 3
            p.append(ico('fl', .1, (x, -.32, -h / 2 - .06), M[k], subdiv=1))
            p.append(ico('lf', .12, (x + .1, -.26, -h / 2 - .12), M['leaf'], subdiv=1, scale=(1, 1, .7)))
    return turn(p, FACE[face], at)

def door(at, face='-y', w=1.15, h=1.75, color='accent', double=False):
    p = [box('df', (w + .3, .16, h + .15), (0, -.05, -.075), M['trim'], bev=.05, seg=2),
         cyl('da', w / 2 + .15, .16, (0, -.05, h / 2), M['trim'], verts=18, rot=(math.pi / 2, 0, 0), bev=.03),
         box('dd', (w, .12, h), (0, -.12, 0), M[color], bev=.04, seg=2),
         cyl('dt', w / 2, .12, (0, -.12, h / 2), M[color], verts=18, rot=(math.pi / 2, 0, 0), bev=.03),
         cyl('dw', .17, .06, (0 if not double else -.28, -.2, h / 2 - .05), M['glass'], verts=12, rot=(math.pi / 2, 0, 0), bev=0),
         sphere('dk', .07, (w / 2 - .18, -.22, -.1), M['gold'], segs=8, rings=6)]
    if double:
        p.append(box('dl', (.05, .05, h + w * .4), (0, -.19, 0), M['trim'], bev=0))
        p.append(sphere('dk', .07, (-w / 2 + .18, -.22, -.1), M['gold'], segs=8, rings=6))
    return turn(p, FACE[face], at)

def flower_pot(at, r=.25):
    x, y, z = at
    return [cyl('pot', r, r * 1.3, (x, y, z + r * .65), M['brick'], verts=12, radius_top=r * 1.2, bev=.03),
            ico('bush', r * 1.25, (x, y, z + r * 1.6), M['leaf'], subdiv=2, scale=(1, 1, .85)),
            ico('bl', r * .3, (x + r * .5, y - r * .7, z + r * 1.9), M['rose'], subdiv=1),
            ico('bl', r * .3, (x - r * .6, y - r * .5, z + r * 1.7), M['sun'], subdiv=1)]

def foundation(W, D, h=.5, mat_='stone'):
    return [box('base', (W + .4, D + .4, h), (0, 0, h / 2), M[mat_], bev=.14, seg=2)]

def walls(W, D, H, z0=.5, wall='wall', posts=True, band='wood_dark'):
    p = [box('wall', (W, D, H), (0, 0, z0 + H / 2), M[wall], bev=.06, seg=2)]
    if posts:
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.append(box('post', (.3, .3, H), (sx * W / 2, sy * D / 2, z0 + H / 2), M['wood'], bev=.06, seg=2))
    if band:
        p.append(box('band', (W + .14, D + .14, .2), (0, 0, z0 + H), M[band], bev=.05, seg=2))
    return p

def gable_roof(W, D, top, rh, ov=.55, roof='roof', trim='roof_trim', gable_wall='wall', ends=True):
    """Ridge along X: slopes face the front (-Y) and back."""
    p, t = [], .3
    a = math.atan2(rh, D / 2)
    Ls = (D / 2 + ov) / math.cos(a)
    for side in (-1, 1):
        d = (side * math.cos(a), -math.sin(a))
        n = (side * math.sin(a), math.cos(a))
        cy = d[0] * Ls / 2 + n[0] * t / 2
        cz = top + rh + d[1] * Ls / 2 + n[1] * t / 2
        p.append(box('slab', (W + 2 * ov, Ls, t), (0, cy, cz), M[roof], bev=.1, seg=3, rot=(-side * a, 0, 0)))
        ey, ez = side * (D / 2 + ov), top + rh - (D / 2 + ov) * math.tan(a)
        p.append(cyl('eave', .17, W + 2 * ov + .1, (0, ey, ez), M[trim], verts=12, rot=(0, math.pi / 2, 0), bev=.03))
        # Chunky tile rows give the roof a hand-made rhythm.
        for k in (1, 2):
            f = k / 3
            p.append(cyl('tile', .07, W + 2 * ov - .1, (0, ey * (1 - f) + 0, ez + (top + rh + t - ez) * f + .04), M[trim], verts=8, rot=(0, math.pi / 2, 0), bev=0))
    p.append(cyl('ridge', .22, W + 2 * ov + .2, (0, 0, top + rh + t * .9), M[trim], verts=14, rot=(0, math.pi / 2, 0), bev=.03))
    if ends:
        for sx in (-1, 1):
            p.append(extrude_outline('gable', [(-D / 2, 0), (D / 2, 0), (0, rh)], .22, (sx * (W / 2 - .1), 0, top), M[gable_wall], rot=(0, 0, math.pi / 2), bev=.03))
        p.append(cyl('attic', .38, .1, (W / 2 + .03, 0, top + rh * .4), M['trim'], verts=16, rot=(0, math.pi / 2, 0), bev=.03))
        p.append(cyl('attic', .28, .1, (W / 2 + .07, 0, top + rh * .4), M['glass'], verts=16, rot=(0, math.pi / 2, 0), bev=0))
    return p

def front_gable_roof(W, D, top, rh, ov=.5):
    """Ridge along Y: the triangle faces the camera."""
    p = gable_roof(D, W, top, rh, ov, ends=False)
    for o in p:
        x, y, z = o.location
        o.location = (-y, x, z)
        o.rotation_euler.z += math.pi / 2
    for sy in (-1, 1):
        p.append(extrude_outline('gable', [(-W / 2, 0), (W / 2, 0), (0, rh)], .22, (0, sy * (D / 2 - .1), top), M['wall'], bev=.03))
    p.append(cyl('attic', .45, .1, (0, -D / 2 - .03, top + rh * .42), M['trim'], verts=18, rot=(math.pi / 2, 0, 0), bev=.03))
    p.append(cyl('attic', .34, .1, (0, -D / 2 - .07, top + rh * .42), M['glass'], verts=18, rot=(math.pi / 2, 0, 0), bev=0))
    p.append(box('attic', (.06, .04, .62), (0, -D / 2 - .13, top + rh * .42), M['trim'], bev=0))
    return p

def chimney(x, y, z0, h=1.7):
    return [box('chim', (.72, .72, h), (x, y, z0 + h / 2), M['brick'], bev=.06, seg=2),
            box('chim', (.9, .9, .2), (x, y, z0 + h), M['stone_dark'], bev=.05, seg=2)]

def porch(W, D, depth=1.9, posts=True, awning=True, z_top=2.9, roof='roof'):
    y0 = -D / 2
    p = [box('deck', (W, depth, .22), (0, y0 - depth / 2 + .05, .3), M['wood_light'] if 'wood_light' in M else M['wood'], bev=.05, seg=2),
         box('step', (1.6, .5, .14), (0, y0 - depth - .2, .1), M['wood'], bev=.04, seg=2)]
    for i in range(int(W / .5)):
        p.append(box('plank', (.03, depth - .05, .02), (-W / 2 + .25 + i * .5, y0 - depth / 2 + .05, .42), M['wood_dark'], bev=0))
    if posts:
        for sx in (-1, 1):
            p.append(box('pp', (.18, .18, z_top - .4), (sx * (W / 2 - .2), y0 - depth + .15, .4 + (z_top - .4) / 2), M['trim'], bev=.04, seg=2))
    if awning:
        p.append(box('aw', (W + .3, depth + .5, .16), (0, y0 - depth / 2 + .1, z_top), M[roof], bev=.06, seg=2, rot=(-.16, 0, 0)))
        p.append(cyl('awe', .1, W + .35, (0, y0 - depth - .12, z_top - .2), M['roof_trim'] if roof == 'roof' else M[roof], verts=10, rot=(0, math.pi / 2, 0), bev=0))
    return p

M['wood_light'] = mat('Wood light', 'wood_light', .7)

def finish(parts, name):
    obj = join(parts, name)
    return obj

# ------------------------------------------------------------- houses (7 x 5.4)
W, D = 7.0, 5.4

def house_gable():
    p = foundation(W, D) + walls(W, D, 2.9) + gable_roof(W, D, 3.4, 2.1)
    p += door((0, -D / 2, 1.42))
    for x in (-2.2, 2.2):
        p += window((x, -D / 2, 2.0))
    p += window((W / 2, .6, 2.0), '+x') + window((-W / 2, .6, 2.0), '-x', flowers=False)
    p += chimney(1.9, .9, 4.3) + porch(3.2, D, 1.8, z_top=2.75)
    p += flower_pot((-1.9, -D / 2 - 1.2, .4)) + flower_pot((1.9, -D / 2 - 1.2, .4))
    return finish(p, 'house_gable')

def house_front():
    p = foundation(W, D) + walls(W, D, 2.8) + front_gable_roof(W, D, 3.3, 2.6, .5)
    p += door((-1.6, -D / 2, 1.4))
    p += window((1.5, -D / 2, 2.0), w=1.6, h=1.15)
    p += window((W / 2, -1, 2.0), '+x') + window((W / 2, 1.2, 2.0), '+x', flowers=False) + window((-W / 2, 0, 2.0), '-x', flowers=False)
    p += chimney(-2.1, 1.2, 4.4)
    # A wrap-around porch with railing.
    p += porch(W - .2, D, 1.6, posts=True, awning=True, z_top=2.6)
    for i in range(9):
        x = -W / 2 + .6 + i * .75
        if abs(x + 1.6) < .7:
            continue
        p.append(box('rail', (.08, .08, .55), (x, -D / 2 - 1.4, .7), M['trim'], bev=0))
    p.append(box('railtop', (W - .5, .12, .1), (0, -D / 2 - 1.4, 1.0), M['trim'], bev=.03))
    return finish(p, 'house_front')

def house_tall():
    w = 6.2
    p = foundation(w, D) + walls(w, D, 4.4) + gable_roof(w, D, 4.9, 1.7, .5)
    p.append(box('floor', (w + .12, D + .12, .14), (0, 0, 2.55), M['wood_dark'], bev=.04))
    p += door((-1.5, -D / 2, 1.42))
    p += window((1.4, -D / 2, 1.75), w=1.3)
    for x in (-1.5, 1.4):
        p += window((x, -D / 2, 3.6), w=.95, h=1.0)
    p += window((w / 2, 0, 1.75), '+x') + window((w / 2, 0, 3.6), '+x', flowers=False)
    p += window((-w / 2, 0, 3.6), '-x', flowers=False)
    # Little balcony over the door.
    p.append(box('balc', (1.6, .7, .12), (-1.5, -D / 2 - .35, 2.75), M['wood'], bev=.04))
    for i in range(5):
        p.append(box('bal', (.06, .06, .5), (-2.2 + i * .35, -D / 2 - .66, 3.05), M['trim'], bev=0))
    p.append(box('balt', (1.6, .1, .08), (-1.5, -D / 2 - .66, 3.32), M['trim'], bev=0))
    p += chimney(1.6, 1.0, 5.6, 1.1)
    p += [box('step', (1.6, 1.0, .2), (-1.5, -D / 2 - .5, .3), M['stone'], bev=.05), box('step', (1.6, .5, .14), (-1.5, -D / 2 - 1.2, .1), M['stone'], bev=.04)]
    p += flower_pot((.4, -D / 2 - .7, .5), .22) + flower_pot((2.6, -D / 2 - .7, .5), .22)
    return finish(p, 'house_tall')

def house_hip():
    p = foundation(W, D) + walls(W, D, 2.8)
    roof = cone('hip', 1.0, 1.0, (0, 0, 0), M['roof'], verts=4)
    roof.rotation_euler = (0, 0, math.pi / 4)
    S._apply_all([roof])
    roof.scale = ((W + 1.2) / 1.414, (D + 1.2) / 1.414, 2.3)
    roof.location = (0, 0, 3.3 + 1.15)
    bevel(roof, .12, 3)
    p.append(roof)
    p.append(box('rim', (W + .9, D + .9, .22), (0, 0, 3.32), M['roof_trim'], bev=.08, seg=2))
    # Dormer.
    p.append(box('dorm', (1.5, 1.2, 1.1), (0, -D / 2 + .9, 4.1), M['wall'], bev=.05))
    dorm_roof = extrude_outline('dormr', [(-1.05, 0), (1.05, 0), (0, .8)], 1.6, (0, -D / 2 + .85, 4.6), M['roof'], bev=.06)
    p.append(dorm_roof)
    p += window((0, -D / 2 + .3, 4.1), w=.7, h=.6, shutters=False, flowers=False)
    p += door((1.8, -D / 2, 1.4))
    p += window((-1.6, -D / 2, 1.95), w=1.7, h=1.1)
    p += window((W / 2, 0, 1.95), '+x') + window((-W / 2, 0, 1.95), '-x', flowers=False)
    p += chimney(-2.2, 1.0, 4.0, 1.6)
    p += [box('step', (1.7, 1.1, .2), (1.8, -D / 2 - .55, .3), M['wood'], bev=.05), box('step', (1.7, .5, .14), (1.8, -D / 2 - 1.3, .1), M['wood'], bev=.04)]
    p += flower_pot((-.1, -D / 2 - .8, .4)) + flower_pot((-3.0, -D / 2 - .8, .4), .22)
    # Bench under the big window.
    p += [box('bench', (1.5, .45, .1), (-1.6, -D / 2 - .5, .85), M['wood'], bev=.03)] + [box('bl', (.1, .4, .45), (x, -D / 2 - .5, .62), M['wood_dark'], bev=.02) for x in (-2.2, -1.0)]
    return finish(p, 'house_hip')

# window() faces axis-aligned walls; the round cottage needs angled windows.
def angled_window(cx, cy, z, ang):
    parts = window((0, 0, 0), w=.85, h=.95, shutters=False)
    turn(parts, ang, (cx, cy, z))
    return parts

def house_round_v2():
    r = 2.6
    p = [cyl('base', r + .35, .5, (0, 0, .25), M['stone'], verts=18, bev=.12),
         cyl('wall', r, 2.8, (0, 0, 1.9), M['wall'], verts=18, bev=.05)]
    for i in range(9):
        a = i * math.tau / 9 + .35
        p.append(box('beam', (.22, .22, 2.8), (math.cos(a) * r, math.sin(a) * r, 1.9), M['wood'], bev=.05, rot=(0, 0, a)))
    p.append(cyl('band', r + .1, .2, (0, 0, 3.3), M['wood_dark'], verts=18, bev=.04))
    for rad, z, h in ((3.55, 3.75, .8), (2.75, 4.55, .8), (1.85, 5.3, .7)):
        p.append(cyl('thatch', rad, h, (0, 0, z), M['roof'], verts=14, radius_top=rad * .78, bev=.14, seg=3))
        p.append(torus('rim', rad - .05, .16, (0, 0, z - h / 2 + .05), M['roof_trim'], major_segs=28, minor_segs=8))
    p.append(cyl('stem', .06, .5, (0, 0, 5.95), M['leaf'], verts=6, bev=0))
    for sx in (-1, 1):
        p.append(ico('sprout', .22, (sx * .2, 0, 6.2), M['leaf_light'], subdiv=1, scale=(1.4, .6, .35), rot=(0, sx * .5, 0)))
    p += door((0, -r + .04, 1.42))
    for a in (-1.0, 1.0, 2.3):
        cx, cy = math.sin(a) * r, -math.cos(a) * r
        p += angled_window(cx, cy, 2.0, a)
    p += chimney(1.3, 1.2, 5.0, 1.2)
    p += [box('deck', (2.4, 1.6, .22), (0, -r - .6, .3), M['wood_light'], bev=.05), box('step', (1.4, .5, .14), (0, -r - 1.6, .1), M['wood'], bev=.04)]
    p += flower_pot((-1.1, -r - .9, .41), .22) + flower_pot((1.1, -r - .9, .41), .22)
    return finish(p, 'house_round')

# ------------------------------------------------------------- civic buildings
def school():
    w, d = 10.0, 6.4
    p = foundation(w, d, .5, 'stone') + walls(w, d, 3.6, wall='school_wall', posts=False, band='trim')
    p += gable_roof(w, d, 4.1, 1.9, .55, roof='school_roof', trim='trim', gable_wall='school_wall')
    # Entrance block with a clock gable.
    p.append(box('entry', (3.2, 1.2, 4.2), (0, -d / 2 - .45, .5 + 2.1), M['school_wall'], bev=.06))
    p.append(extrude_outline('eg', [(-1.9, 0), (1.9, 0), (0, 1.5)], 1.6, (0, -d / 2 - .4, 4.7), M['school_roof'], bev=.08))
    p.append(cyl('clock', .55, .14, (0, -d / 2 - 1.12, 4.0), M['trim'], verts=24, rot=(math.pi / 2, 0, 0), bev=.04))
    p.append(cyl('clockr', .62, .1, (0, -d / 2 - 1.08, 4.0), M['gold'], verts=24, rot=(math.pi / 2, 0, 0), bev=.02))
    p.append(box('hand', (.06, .04, .4), (0, -d / 2 - 1.22, 4.15), M['charcoal'], bev=0))
    p.append(box('hand', (.3, .04, .06), (.12, -d / 2 - 1.22, 4.0), M['charcoal'], bev=0))
    p += door((0, -d / 2 - 1.05, 1.55), w=1.6, h=1.9, color='school_roof', double=True)
    for x in (-3.6, -2.2, 2.2, 3.6):
        p += window((x, -d / 2, 2.2), w=1.0, h=1.5, shutters=False, flowers=False, arch=True)
    for y in (-1.6, 1.6):
        p += window((w / 2, y, 2.2), '+x', w=1.1, h=1.5, shutters=False, flowers=False, arch=True)
        p += window((-w / 2, y, 2.2), '-x', w=1.1, h=1.5, shutters=False, flowers=False, arch=True)
    # Bell tower on the ridge.
    p.append(box('tower', (1.3, 1.3, 1.2), (0, .2, 6.6), M['trim'], bev=.06))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(box('tp', (.18, .18, 1.0), (sx * .5, .2 + sy * .5, 7.7), M['trim'], bev=.03))
    p.append(sphere('bell', .32, (0, .2, 7.65), M['gold'], segs=14, rings=8, scale=(1, 1, 1.15)))
    p.append(cone('tr', 1.15, 1.2, (0, .2, 8.75), M['school_roof'], verts=4, rot=(0, 0, math.pi / 4)))
    p.append(box('trb', (1.6, 1.6, .16), (0, .2, 8.2), M['school_roof'], bev=.05))
    # Flagpole and a little slide.
    p.append(cyl('pole', .07, 6.2, (-w / 2 - .2, -d / 2 - 1.6, 3.1), M['trim'], verts=8, bev=0))
    p.append(sphere('poleb', .13, (-w / 2 - .2, -d / 2 - 1.6, 6.25), M['gold'], segs=8, rings=6))
    p.append(box('flag', (1.2, .05, .75), (-w / 2 + .45, -d / 2 - 1.6, 5.6), M['accent'], bev=.02))
    p.append(ico('flags', .16, (-w / 2 + .45, -d / 2 - 1.65, 5.6), M['sun'], subdiv=1, scale=(1, .4, 1)))
    p += [box('sl', (.8, 2.4, .12), (w / 2 - .8, -d / 2 - 1.6, .9), M['sun'], bev=.04, rot=(.55, 0, 0)),
          box('sla', (.12, .12, 1.8), (w / 2 - 1.15, -d / 2 - .55, 1.0), M['red'], bev=.03), box('sla', (.12, .12, 1.8), (w / 2 - .45, -d / 2 - .55, 1.0), M['red'], bev=.03),
          box('slt', (.9, .5, .1), (w / 2 - .8, -d / 2 - .55, 1.85), M['red'], bev=.03)]
    p += [box('walk', (2.4, 1.2, .14), (0, -d / 2 - 1.7, .08), M['stone_dark'], bev=.04)]
    p += flower_pot((-2.0, -d / 2 - 1.5, 0), .3) + flower_pot((2.0, -d / 2 - 1.5, 0), .3)
    return finish(p, 'school')

def hospital():
    w, d = 10.0, 6.6
    p = foundation(w, d, .45, 'stone_dark') + walls(w, d, 4.8, z0=.45, wall='hosp_wall', posts=False, band='mint')
    p.append(box('parapet', (w + .2, d + .2, .5), (0, 0, 5.5), M['hosp_wall'], bev=.08))
    p.append(box('parcap', (w + .35, d + .35, .14), (0, 0, 5.8), M['mint'], bev=.05))
    p.append(box('mid', (w + .12, d + .12, .16), (0, 0, 2.75), M['mint'], bev=.04))
    # Big red cross on a white disc above the entrance.
    p.append(box('crossbg', (2.2, .3, 2.2), (0, -d / 2 - .15, 5.0), M['hosp_wall'], bev=.3, seg=4))
    p.append(box('cross', (1.6, .2, .5), (0, -d / 2 - .32, 5.0), M['red'], bev=.06))
    p.append(box('cross', (.5, .2, 1.6), (0, -d / 2 - .32, 5.0), M['red'], bev=.06))
    # Glass entrance with canopy.
    p.append(box('glassdoor', (2.2, .12, 1.9), (0, -d / 2 - .06, 1.45), M['glass'], bev=.03))
    p.append(box('gdf', (2.4, .16, .12), (0, -d / 2 - .08, 2.45), M['mint'], bev=.02))
    p.append(box('gdm', (.08, .14, 1.9), (0, -d / 2 - .1, 1.45), M['mint'], bev=0))
    p.append(box('canopy', (3.8, 2.0, .2), (0, -d / 2 - 1.0, 2.85), M['mint'], bev=.07))
    for sx in (-1, 1):
        p.append(cyl('cp', .1, 2.35, (sx * 1.7, -d / 2 - 1.8, 1.65), M['trim'], verts=10, bev=0))
    for x in (-3.8, -2.4, 2.4, 3.8):
        p += window((x, -d / 2, 1.6), w=1.0, h=1.0, shutters=False, flowers=False, frame='mint')
        p += window((x, -d / 2, 3.9), w=1.0, h=1.0, shutters=False, flowers=False, frame='mint')
    for y in (-1.6, 1.6):
        for z in (1.6, 3.9):
            p += window((w / 2, y, z), '+x', w=1.1, h=1.0, shutters=False, flowers=False, frame='mint')
            p += window((-w / 2, y, z), '-x', w=1.1, h=1.0, shutters=False, flowers=False, frame='mint')
    # Rooftop: a little garden and vent.
    p.append(box('vent', (1.4, 1.0, .7), (2.8, 1.2, 6.1), M['stone'], bev=.08))
    p += flower_pot((-3.0, 1.2, 5.75), .3) + flower_pot((-1.9, 1.5, 5.75), .25)
    p += [box('ramp', (2.6, 1.6, .16), (0, -d / 2 - 1.9, .09), M['stone'], bev=.05)]
    p += [box('bench', (1.4, .45, .1), (3.4, -d / 2 - 1.0, .55), M['wood'], bev=.03)] + [box('bl', (.1, .4, .5), (x, -d / 2 - 1.0, .3), M['wood_dark'], bev=.02) for x in (2.85, 3.95)]
    p += flower_pot((-3.2, -d / 2 - 1.0, 0), .3)
    return finish(p, 'hospital')

def star(r1, r2, n=5):
    return [((r1 if i % 2 == 0 else r2) * math.sin(i * math.pi / n), (r1 if i % 2 == 0 else r2) * math.cos(i * math.pi / n)) for i in range(2 * n)]

def police():
    w, d = 9.4, 6.2
    p = foundation(w, d, .45, 'stone_dark') + walls(w, d, 3.6, z0=.45, wall='police_wall', posts=False, band='navy')
    roof = cone('hip', 1.0, 1.0, (0, 0, 0), M['navy'], verts=4)
    roof.rotation_euler = (0, 0, math.pi / 4)
    S._apply_all([roof])
    roof.scale = ((w + 1.0) / 1.414, (d + 1.0) / 1.414, 1.8)
    roof.location = (0, 0, 4.05 + .9)
    bevel(roof, .1, 3)
    p.append(roof)
    p.append(box('rim', (w + .8, d + .8, .22), (0, 0, 4.1), M['trim'], bev=.08))
    # Siren light bar on the roof.
    p.append(box('lb', (1.6, .5, .18), (0, 0, 5.75), M['charcoal'], bev=.05))
    p.append(box('lr', (.65, .42, .32), (-.38, 0, 5.98), M['siren_red'], bev=.1, seg=3))
    p.append(box('lbl', (.65, .42, .32), (.38, 0, 5.98), M['siren_blue'], bev=.1, seg=3))
    # Entrance with a gold star on a navy shield.
    p.append(box('entry', (3.0, 1.1, 3.3), (-1.6, -d / 2 - .4, .45 + 1.65), M['police_wall'], bev=.06))
    p.append(box('entryr', (3.4, 1.5, .22), (-1.6, -d / 2 - .45, 3.85), M['navy'], bev=.07))
    p.append(extrude_outline('shield', [(-.65, .5), (.65, .5), (.65, -.1), (0, -.7), (-.65, -.1)], .14, (-1.6, -d / 2 - 1.0, 3.0), M['navy'], bev=.04))
    p.append(extrude_outline('star', star(.42, .18), .12, (-1.6, -d / 2 - 1.1, 2.95), M['gold'], bev=.03))
    p += door((-1.6, -d / 2 - .95, 1.4), w=1.4, h=1.7, color='navy', double=True)
    # Garage with a striped roller door.
    p.append(box('gar', (2.6, .14, 2.3), (2.6, -d / 2 - .04, 1.6), M['trim'], bev=.05))
    for i in range(6):
        p.append(box('gs', (2.3, .1, .3), (2.6, -d / 2 - .1, .65 + i * .37), M['navy'] if i % 2 else M['police_wall'], bev=.02))
    p += window((-3.8, -d / 2, 2.2), w=.9, h=1.0, shutters=True, flowers=True, shutter='navy')
    for y in (-1.4, 1.4):
        p += window((w / 2, y, 2.2), '+x', w=1.0, h=1.0, shutters=True, flowers=False, shutter='navy')
        p += window((-w / 2, y, 2.2), '-x', w=1.0, h=1.0, shutters=True, flowers=False, shutter='navy')
    # Lamp post and traffic cones.
    p.append(cyl('lamp', .07, 3.0, (1.0, -d / 2 - 1.9, 1.5), M['charcoal'], verts=8, bev=0))
    p.append(sphere('lampb', .22, (1.0, -d / 2 - 1.9, 3.1), M['siren_blue'], segs=10, rings=8))
    for x in (3.6, 4.2):
        p.append(cone('tc', .2, .55, (x, -d / 2 - 1.6, .32), M['tangerine'], verts=10))
        p.append(box('tcb', (.4, .4, .06), (x, -d / 2 - 1.6, .04), M['tangerine'], bev=.02))
    p += [box('walk', (3.0, 1.3, .14), (-1.6, -d / 2 - 1.6, .08), M['stone'], bev=.04), box('drive', (2.8, 2.0, .06), (2.6, -d / 2 - 1.0, .04), M['stone_dark'], bev=.02)]
    return finish(p, 'police')

def company():
    w, d = 8.4, 6.2
    floors, fh = 3, 2.25
    H = floors * fh
    p = foundation(w, d, .4, 'stone_dark') + walls(w, d, H, z0=.4, wall='co_wall', posts=False, band=None)
    for f in range(floors):
        z = .4 + f * fh
        p.append(box('band', (w + .16, d + .16, .22), (0, 0, z + fh), M['tangerine'], bev=.06))
        if f == 0:
            continue
        # Ribbon windows wrap the front and the camera-side wall.
        p.append(box('rib', (w - 1.0, .12, 1.15), (0, -d / 2 - .03, z + fh * .52), M['teal'], bev=.04))
        p.append(box('rib', (.12, d - 1.0, 1.15), (w / 2 + .03, 0, z + fh * .52), M['teal'], bev=.04))
        p.append(box('rib', (.12, d - 1.0, 1.15), (-w / 2 - .03, 0, z + fh * .52), M['teal'], bev=.04))
        for k in range(1, 6):
            p.append(box('mull', (.07, .16, 1.15), (-w / 2 + .5 + k * (w - 1.0) / 6, -d / 2 - .06, z + fh * .52), M['co_wall'], bev=0))
        for k in range(1, 4):
            p.append(box('mull', (.16, .07, 1.15), (w / 2 + .06, -d / 2 + .5 + k * (d - 1.0) / 4, z + fh * .52), M['co_wall'], bev=0))
    # Ground floor lobby.
    p.append(box('lobby', (3.4, .12, 1.7), (0, -d / 2 - .05, 1.35), M['glass'], bev=.03))
    p.append(box('lm', (.08, .14, 1.7), (0, -d / 2 - .1, 1.35), M['charcoal'], bev=0))
    p.append(box('canopy', (4.4, 1.6, .18), (0, -d / 2 - .8, 2.35), M['tangerine'], bev=.07))
    for x in (-3.0, 3.0):
        p += window((x, -d / 2, 1.4), w=1.1, h=1.1, shutters=False, flowers=False, frame='trim')
    # Roof sign, water tank and solar panels.
    top = .4 + H + .1
    p.append(box('parapet', (w + .2, d + .2, .3), (0, 0, top), M['co_wall'], bev=.06))
    p.append(box('sign', (3.4, .4, 1.0), (0, -d / 2 + .6, top + .75), M['tangerine'], bev=.12, seg=3))
    p.append(cyl('logo', .34, .1, (-1.1, -d / 2 + .36, top + .75), M['co_wall'], verts=18, rot=(math.pi / 2, 0, 0), bev=.02))
    p.append(ico('logol', .2, (-1.1, -d / 2 + .3, top + .78), M['leaf'], subdiv=1, scale=(1, .4, 1.3)))
    for k in range(3):
        p.append(box('bar', (1.5 - k * .35, .1, .14), (.55 - k * .15, -d / 2 + .38, top + 1.0 - k * .25), M['co_wall'], bev=.03))
    p.append(cyl('tank', .7, 1.2, (2.6, 1.4, top + .75), M['stone'], verts=16, bev=.08))
    p.append(cone('tankr', .78, .4, (2.6, 1.4, top + 1.55), M['tangerine'], verts=16))
    for k in range(2):
        p.append(box('solar', (1.5, 1.0, .08), (-2.2 + k * 1.7, 1.6, top + .5), M['navy'], bev=.02, rot=(-.4, 0, 0)))
    p += flower_pot((-2.1, -d / 2 - 1.2, 0), .35) + flower_pot((2.1, -d / 2 - 1.2, 0), .35)
    p += [box('walk', (3.4, 1.6, .12), (0, -d / 2 - 1.2, .07), M['stone'], bev=.04)]
    return finish(p, 'company')

# ------------------------------------------------------------- build + export
models = [house_gable(), house_front(), house_tall(), house_hip(), house_round_v2(), school(), hospital(), police(), company()]
for m in models:
    print(f'{m.name}: {triangles(m)} triangles')
size = export_glb(models, OUT)
print('town.glb', size, 'bytes')

# Preview sheet in the game camera.
layout = [(-16, 10), (-8, 10), (0, 10), (8, 10), (16, 10), (-18, -4), (-6, -4), (6, -4), (18, -4)]
for m, (x, y) in zip(models, layout):
    m.location = (x, y, 0)
studio('#6FD24A', (1800, 1100))
game_camera((0, 3, 2), 46)
render(PREVIEW)
