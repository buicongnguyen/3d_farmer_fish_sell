"""Willowmere rural kit: an American country village in the Zoo Garden toy style.

Run:  blender --background --factory-startup --python art/blender/build_rural.py
Writes public/assets/models/rural.glb (one top-level joined mesh per piece) and
art/previews/rural.webp (game camera; family materials tinted per house for the preview only).

Contract (glTF, Y up, front faces +Z, origin = ground centre, metres):
  home_t0   log cabin (starter home), door centred      <= 5 x 4,  h <= 4.5
  home_t1   clapboard cottage + little porch            <= 7 x 5.4 (porch to z +4),   h <= 6
  home_t2   two-storey farmhouse, porch with railing    <= 8 x 6   (porch to z +4.5), h <= 8
  home_t3   big farmhouse, wrap porch, wing, dormers    <= 10 x 7  (porch to z +4.5), h <= 8.5
  farm_a..d saltbox, gambrel (Dutch colonial), L-shaped ranch, foursquare
                                                        <= 8 x 6.5 (porch to z +4.5), h <= 8
            home_* and farm_* share the family materials 'Siding' (clapboard walls),
            'Roof', 'Roof Trim' and 'Accent' (doors, shutters). home_t0's logs use 'Log';
            its gable boards are 'Siding'.
  barn      red gambrel barn                            <= 8 x 7,  h <= 7.5
  silo      round silo with dome                        r <= 1.6,  h <= 8
  picket_fence  2.0 m segment along X, origin at its centre (posts at both ends; tiles at 2.0 m)
  rail_fence    2.5 m split-rail segment along X (posts at both ends; tiles at 2.5 m)
  mailbox, hay_round, tractor (<= 2.5 x 2.5, h <= 2.6), stump (r <= .5)
  pond_dock 2 x 4 m, runs from the origin (shore end) to z +4; deck top at y .35, piles reach y -1
  windmill  lattice tower (no rotor) with head, shaft and tail vane, base r <= 1.5, h <= 7
  windmill_rotor  18-blade wheel, origin at the hub; spin it about its local Z axis.
            Place it at the tower's local position (0, 6.25, 0.62): hub height 6.25 m,
            0.62 m in front (+Z) of the tower axis. The tail vane is part of `windmill`
            (it must not spin with the wheel).
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import style as S
from style import *
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'models', 'rural.glb')
PREVIEW = os.path.join(ROOT, 'art', 'previews', 'rural.webp')
EXTRA = os.environ.get('RURAL_EXTRA_PREVIEWS')  # optional folder for close-up sheets

reset_scene()
M = {
    # Family materials: the game recolours these per household.
    'siding': mat('Siding', '#F4EEDF', .7), 'roof': mat('Roof', '#D9473C', .55),
    'roof_trim': mat('Roof Trim', '#A9322C', .5), 'accent': mat('Accent', '#2D6BD3', .5),
    # Shared kit materials.
    'trim': mat('Trim', 'white', .55), 'glass': mat('Glass', '#8FE6FF', .12),
    'wood': mat('Wood', 'wood', .7), 'wood_light': mat('Wood light', 'wood_light', .7),
    'wood_dark': mat('Wood dark', 'wood_dark', .7), 'porch': mat('Porch floor', '#D99A5B', .7),
    'stone': mat('Stone', 'stone', .85), 'stone_dark': mat('Stone dark', 'stone_dark', .85),
    'brick': mat('Brick', '#D2603F', .8), 'gold': mat('Gold', 'gold', .3, .4),
    'log': mat('Log', '#C0733A', .75), 'log_end': mat('Log end', '#F2BE78', .7), 'log_dark': mat('Log dark', '#7A4122', .8),
    'leaf': mat('Leaf', 'leaf', .6), 'leaf_light': mat('Leaf light', 'leaf_light', .6), 'leaf_dark': mat('Leaf dark', 'leaf_dark', .6),
    'rose': mat('Petal rose', 'rose', .5), 'sun': mat('Petal sun', 'sun', .5), 'violet': mat('Petal violet', 'violet', .5),
    'soil': mat('Soil', 'soil', .9), 'charcoal': mat('Charcoal', 'charcoal', .6), 'iron': mat('Iron', 'iron', .5, .3),
    'metal': mat('Galvanized', '#D3DDEA', .35, .55), 'lamp': mat('Lamp glow', '#FFE08A', .3, emit='#FFD35C', emit_strength=1.5),
    'barn': mat('Barn red', '#D8312C', .6), 'barn_roof': mat('Barn roof', '#4F5F8F', .5), 'barn_roof_trim': mat('Barn roof trim', '#39466E', .5),
    'hay': mat('Hay', 'straw', .75), 'hay_light': mat('Hay light', 'straw_light', .75), 'hay_dark': mat('Hay dark', 'straw_dark', .75),
    'silo': mat('Silo', '#2F7FE0', .45), 'silo_dome': mat('Silo dome', '#E3EAF3', .3, .5),
    'rotor_red': mat('Rotor red', '#E8362F', .45),
    'tractor': mat('Tractor red', '#E5302B', .4), 'tractor_hub': mat('Tractor yellow', '#FFC22E', .45),
    'tire': mat('Tire', '#2E3038', .85), 'seat': mat('Tractor seat', '#2F9A3A', .6), 'chrome': mat('Chrome', '#E6EDF5', .25, .8),
    'mailbox': mat('Mailbox', '#9FB8DA', .35, .5), 'flag_red': mat('Flag red', '#E8333B', .5), 'flag_blue': mat('Flag blue', '#2B4C9B', .5),
    'rope': mat('Rope', '#E8C48C', .8), 'bark': mat('Bark', 'bark', .85), 'wood_end': mat('Wood end', '#F4C985', .7),
    'ring': mat('Wood ring', '#DFA35E', .7), 'water': mat('Trough water', '#39C3F0', .1),
}

# ------------------------------------------------------------------ helpers
def turn(objs, ang, at=(0, 0, 0)):
    """Rotate parts built around the origin about Z, then move them to `at`."""
    c, s = math.cos(ang), math.sin(ang)
    for o in objs:
        x, y, z = o.location
        o.location = (at[0] + x * c - y * s, at[1] + x * s + y * c, at[2] + z)
        o.rotation_euler.z += ang
    return objs

FACE = {'-y': 0, '+x': math.pi / 2, '-x': -math.pi / 2, '+y': math.pi}

def z_at(prof, u):
    for (u0, z0), (u1, z1) in zip(prof, prof[1:]):
        if u0 <= u <= u1 and u1 > u0:
            return z0 + (z1 - z0) * (u - u0) / (u1 - u0)
    return prof[0][1] if u < prof[0][0] else prof[-1][1]

def span_at(prof, zt):
    """The [u0, u1] range where the top line `prof` is at or above height zt."""
    us = []
    for (u0, z0), (u1, z1) in zip(prof, prof[1:]):
        if z0 >= zt:
            us.append(u0)
        if z1 >= zt:
            us.append(u1)
        if (z0 - zt) * (z1 - zt) < 0:
            us.append(u0 + (zt - z0) * (u1 - u0) / (z1 - z0))
    return (min(us), max(us)) if us else None

def clad_face(prof, z0, style='clap', mat_='siding', row=.3, pitch=.45):
    """Cladding for one wall built on the local -Y plane. prof = [(u, top z)] left to right."""
    p = []
    if style == 'clap':
        ztop = max(z for _, z in prof)
        k = 0
        while True:
            zb = z0 + k * row
            zt = zb + row
            if zt > ztop + .06:
                break
            sp = span_at(prof, min(zt - .02, ztop - .01))
            if not sp or sp[1] - sp[0] < .12:
                break
            u0, u1 = sp
            # Boards tilt top-out: the game camera looks down ~42 degrees and reads the steps as clapboard.
            p.append(box('clap', (u1 - u0 + .02, .05, row), ((u0 + u1) / 2, -.035, zb + row / 2), M[mat_], bev=0, rot=(.28, 0, 0)))
            k += 1
    elif style == 'batten':
        u_min, u_max = prof[0][0], prof[-1][0]
        n = max(1, int((u_max - u_min) / pitch))
        for i in range(1, n):
            u = u_min + i * (u_max - u_min) / n
            zt = z_at(prof, u) - .1
            if zt - z0 < .15:
                continue
            p.append(box('batt', (.09, .07, zt - z0), (u, -.035, (z0 + zt) / 2), M[mat_], bev=.015, seg=1))
    return p

def roof_profile(prof, L, ov_eave=.45, ov_end=.4, t=.22, roof='roof', trim='roof_trim', rake='trim', shingles=2,
                 eave_r=.14, ridge_r=.2):
    """Roof slabs along X over a roof line prof = [(y, z)] from the front eave to the back eave."""
    pts = [Vector(q) for q in prof]
    d = (pts[1] - pts[0]).normalized()
    pts[0] = pts[0] - d * ov_eave
    d = (pts[-1] - pts[-2]).normalized()
    pts[-1] = pts[-1] + d * ov_eave
    Lr = L + 2 * ov_end
    p = []
    for a_, b_ in zip(pts, pts[1:]):
        dy, dz = b_.x - a_.x, b_.y - a_.y
        seg = math.hypot(dy, dz)
        a = math.atan2(dz, dy)
        ny, nz = -math.sin(a), math.cos(a)
        my, mz = (a_.x + b_.x) / 2 + ny * t / 2, (a_.y + b_.y) / 2 + nz * t / 2
        p.append(box('slab', (Lr, seg + .04, t), (0, my, mz), M[roof], bev=.07, seg=1, rot=(a, 0, 0)))
        for k in range(1, shingles + 1):
            f = k / (shingles + 1)
            p.append(cyl('shingle', .05, Lr - .12, (0, a_.x + dy * f + ny * t, a_.y + dz * f + nz * t), M[trim], verts=6, bev=0, rot=(0, math.pi / 2, 0)))
        if rake:
            for sx in (-1, 1):
                p.append(box('rake', (.12, seg + .02, .3), (sx * (Lr / 2 + .03), my - ny * .06, mz - nz * .06), M[rake], bev=0, rot=(a, 0, 0)))
    for q in pts[1:-1]:
        p.append(cyl('ridge', ridge_r, Lr + .12, (0, q.x, q.y + t * .75), M[trim], verts=10, rot=(0, math.pi / 2, 0), bev=0))
    for q in (pts[0], pts[-1]):
        p.append(cyl('eave', eave_r, Lr + .06, (0, q.x, q.y + t * .35), M[trim], verts=10, rot=(0, math.pi / 2, 0), bev=0))
    return p

def block(cx, cy, W, D, z0, prof, axis='x', wall='siding', clad='clap', roof='roof', trim='roof_trim', rake='trim',
          ov_eave=.45, ov_end=.4, shingles=2, corners='trim', faces=('-y', '+y', '+x', '-x'), roof_on=True):
    """Clad walls under a roof line. prof is [(across, z)] from the front eave to the back eave in the frame
    where the ridge runs along X; axis='y' turns the finished block so the ridge runs front to back."""
    Wl, Dl = (D, W) if axis == 'y' else (W, D)
    zf, zb = prof[0][1], prof[-1][1]
    p = []
    outline = [(-Dl / 2, z0), (Dl / 2, z0)] + [tuple(q) for q in reversed(prof)]
    p.append(extrude_outline('walls', outline, Wl, (0, 0, 0), M[wall], rot=(0, 0, math.pi / 2), bev=0))
    rows = max(1, round((zf - z0) / .3))
    row = (zf - z0) / rows
    if clad:
        fp = {'-y': ([(-Wl / 2, zf), (Wl / 2, zf)], (0, -Dl / 2)), '+y': ([(-Wl / 2, zb), (Wl / 2, zb)], (0, Dl / 2)),
              '+x': (list(prof), (Wl / 2, 0)), '-x': ([(-u, z) for u, z in reversed(prof)], (-Wl / 2, 0))}
        # In the turned frame the gable ends become the front and back.
        remap = {'-y': '+x', '+y': '-x', '+x': '+y', '-x': '-y'} if axis == 'y' else {f: f for f in fp}
        inv = {v: k for k, v in remap.items()}
        for f in faces:
            lf = inv[f]
            fprof, at = fp[lf]
            p += turn(clad_face(fprof, z0 + .03, clad, wall, row), FACE[lf], (at[0], at[1], 0))
    if corners:
        for sx in (-1, 1):
            for sy, h in ((-1, zf - z0), (1, zb - z0)):
                p.append(box('corner', (.18, .18, h), (sx * Wl / 2, sy * Dl / 2, z0 + h / 2), M[corners], bev=0))
    if roof_on:
        p += roof_profile(prof, Wl, ov_eave, ov_end, roof=roof, trim=trim, rake=rake, shingles=shingles)
    return turn(p, math.pi / 2 if axis == 'y' else 0, (cx, cy, 0))

def foundation(W, D, h, cx=0, cy=0, m='stone'):
    return [box('found', (W + .3, D + .3, h), (cx, cy, h / 2), M[m], bev=.08, seg=1)]

def window(at, face='-y', w=.85, h=1.2, shutters=True, flowers=False, head=True, muntins=True):
    fw = .12
    p = [box('wf', (w + 2 * fw, .14, h + 2 * fw), (0, -.07, 0), M['trim'], bev=.03, seg=1),
         box('wg', (w, .06, h), (0, -.13, 0), M['glass'], bev=0),
         box('wmr', (w, .05, .055), (0, -.165, 0), M['trim'], bev=0),
         box('sill', (w + .38, .24, .08), (0, -.14, -h / 2 - fw - .02), M['trim'], bev=0)]
    if muntins:
        p += [box('wmv', (.04, .04, h), (0, -.165, 0), M['trim'], bev=0)]
        if h > .8:
            p += [box('wmh', (w, .04, .035), (0, -.165, s * h / 4), M['trim'], bev=0) for s in (-1, 1)]
    if head:
        p.append(box('head', (w + .44, .22, .1), (0, -.12, h / 2 + fw + .05), M['trim'], bev=0))
    if shutters:
        sw = min(w * .45, .4)
        for sx in (-1, 1):
            x = sx * (w / 2 + fw + sw / 2 + .02)
            p.append(box('sh', (sw, .07, h + .1), (x, -.1, 0), M['accent'], bev=0))
    if flowers:
        p.append(box('fb', (w + .3, .3, .24), (0, -.28, -h / 2 - .32), M['wood'], bev=.04, seg=1))
        for i, k in enumerate(('rose', 'sun', 'violet')):
            x = -w / 2 + .1 + i * (w - .2) / 2
            p.append(ico('fl', .1, (x, -.3, -h / 2 - .14), M[k], subdiv=1))
            p.append(ico('lf', .13, (x + .1, -.24, -h / 2 - .2), M['leaf'], subdiv=1, scale=(1, 1, .7)))
    return turn(p, FACE[face], at)

def door(at, face='-y', w=.95, h=2.0, fan=False, color='accent'):
    p = [box('dfl', (.14, .18, h + .1), (-w / 2 - .07, -.09, .05), M['trim'], bev=.02, seg=1),
         box('dfr', (.14, .18, h + .1), (w / 2 + .07, -.09, .05), M['trim'], bev=.02, seg=1),
         box('dft', (w + .46, .22, .16), (0, -.1, h / 2 + .1), M['trim'], bev=.03, seg=1),
         box('dd', (w, .1, h), (0, -.07, 0), M[color], bev=.03, seg=1),
         box('dw', (w * .62, .04, h * .26), (0, -.13, h * .2), M['glass'], bev=0),
         box('dwm', (.035, .05, h * .26), (0, -.15, h * .2), M[color], bev=0),
         box('dwm', (w * .62, .05, .035), (0, -.15, h * .2), M[color], bev=0),
         sphere('dk', .055, (w / 2 - .14, -.16, -.05), M['gold'], segs=8, rings=6)]
    for sx in (-1, 1):
        p.append(box('dp', (w * .32, .04, h * .3), (sx * w * .21, -.13, -h * .22), M[color], bev=.015, seg=1))
    if fan:
        p.append(cyl('fan', w / 2 + .1, .16, (0, -.09, h / 2 + .18), M['trim'], verts=16, rot=(math.pi / 2, 0, 0), bev=.02))
        p.append(cyl('fang', w / 2 - .04, .06, (0, -.17, h / 2 + .18), M['glass'], verts=16, rot=(math.pi / 2, 0, 0), bev=0))
        p.append(box('fanb', (w + .5, .24, .1), (0, -.1, h / 2 + .19), M['trim'], bev=.02, seg=1))
    return turn(p, FACE[face], at)

def chimney(x, y, z0, h, m='brick', w=.62):
    return [box('chim', (w, w, h), (x, y, z0 + h / 2), M[m], bev=.05, seg=1),
            box('chimc', (w + .18, w + .18, .18), (x, y, z0 + h - .02), M['stone_dark'], bev=.04, seg=1),
            box('chimb', (w - .1, w - .1, .3), (x, y, z0 + h + .1), M['charcoal'], bev=.03, seg=1)]

def porch(x0, x1, depth, deck_z, beam_z, roof_z, cols, wall_y=0.0, steps=None, rails=True, side_rails=(True, True),
          roof=True, col_style='round', step_n=2, step_d=.28, roof_ov=.28):
    """A porch on a wall facing -Y at wall_y. steps = (x centre, width)."""
    p = []
    w, xc, yf = x1 - x0, (x0 + x1) / 2, wall_y - depth
    p.append(box('deck', (w, depth, .2), (xc, wall_y - depth / 2, deck_z - .1), M['porch'], bev=.04, seg=1))
    if deck_z > .3:
        p.append(box('skirt', (w - .12, depth - .1, deck_z - .2), (xc, wall_y - depth / 2 + .02, (deck_z - .2) / 2), M['wood_dark'], bev=0))
    p.append(box('fascia', (w + .04, .07, .16), (xc, yf, deck_z - .1), M['trim'], bev=.02, seg=1))
    n = max(2, int(w / .6))
    for i in range(1, n):
        p.append(box('plank', (.025, depth - .08, .02), (x0 + i * w / n, wall_y - depth / 2, deck_z + .005), M['wood'], bev=0))
    cy = yf + .18
    for x in cols:
        if col_style == 'round':
            p += [box('cb', (.28, .28, .16), (x, cy, deck_z + .08), M['trim'], bev=0),
                  cyl('col', .095, beam_z - deck_z - .2, (x, cy, (deck_z + beam_z) / 2), M['trim'], verts=8, bev=.0),
                  box('cc', (.28, .28, .12), (x, cy, beam_z - .16), M['trim'], bev=0)]
        else:  # Craftsman: brick pier and a tapered square post.
            p += [box('pier', (.44, .44, .6), (x, cy, deck_z + .3), M['brick'], bev=.04, seg=1),
                  box('pierc', (.5, .5, .08), (x, cy, deck_z + .62), M['trim'], bev=.02, seg=1),
                  cyl('post', .2, beam_z - deck_z - .76, (x, cy, (deck_z + .66 + beam_z - .1) / 2), M['trim'], verts=4,
                      radius_top=.14, bev=.02, rot=(0, 0, math.pi / 4))]
    p.append(box('beam', (w + .06, .24, .22), (xc, cy, beam_z - .02), M['trim'], bev=0))
    if roof:
        y_back, y_front = wall_y + .05, yf - roof_ov
        z_back, z_front = roof_z, beam_z + .12
        a = math.atan2(z_back - z_front, y_back - y_front)
        seg = math.hypot(y_back - y_front, z_back - z_front)
        p.append(box('proof', (w + .3, seg, .16), (xc, (y_back + y_front) / 2, (z_back + z_front) / 2 + .08), M['roof'], bev=.05, seg=2, rot=(a, 0, 0)))
        p.append(cyl('proofe', .1, w + .34, (xc, y_front - .02, z_front + .06), M['roof_trim'], verts=10, rot=(0, math.pi / 2, 0), bev=0))
        for k in (1, 2):
            f = k / 3
            p.append(cyl('pshing', .04, w + .2, (xc, y_front + (y_back - y_front) * f, z_front + (z_back - z_front) * f + .17), M['roof_trim'], verts=6, rot=(0, math.pi / 2, 0), bev=0))
    if rails:
        rz = deck_z
        def rail(xa, xb, ya, yb):
            L = math.hypot(xb - xa, yb - ya)
            ang = math.atan2(yb - ya, xb - xa)
            mx, my = (xa + xb) / 2, (ya + yb) / 2
            q = [box('rt', (L, .1, .07), (mx, my, rz + .82), M['trim'], bev=0, rot=(0, 0, ang)),
                 box('rb', (L, .07, .06), (mx, my, rz + .14), M['trim'], bev=0, rot=(0, 0, ang))]
            k = max(1, int(L / .24))
            for i in range(1, k):
                f = i / k
                q.append(box('bal', (.05, .05, .66), (xa + (xb - xa) * f, ya + (yb - ya) * f, rz + .48), M['trim'], bev=0))
            return q
        sc = sorted(cols)
        for a_, b_ in zip(sc, sc[1:]):
            if steps and a_ < steps[0] < b_:
                continue
            p += rail(a_ + .12, b_ - .12, cy, cy)
        if side_rails[0]:
            p += rail(sc[0], sc[0], cy + .12, wall_y - .05)
        if side_rails[1]:
            p += rail(sc[-1], sc[-1], cy + .12, wall_y - .05)
    if steps:
        sx, sw = steps
        for i in range(step_n):
            top = deck_z * (step_n - i) / (step_n + 1)
            p.append(box('step', (sw, step_d + .04, top), (sx, yf - step_d * (i + .5), top / 2), M['porch'], bev=.03, seg=1))
    return p

def gable_porch_roof(xc, y_wall, depth, w, beam_z, rise):
    """A little front-gable roof over a stoop, with its own triangle in Siding."""
    prof = [(-w / 2, beam_z + .1), (0, beam_z + .1 + rise), (w / 2, beam_z + .1)]
    p = roof_profile(prof, depth, ov_eave=.25, ov_end=.2, t=.16, shingles=1, eave_r=.1, ridge_r=.14)
    turn(p, math.pi / 2, (xc, y_wall - depth / 2, 0))
    p.append(extrude_outline('pgable', [(-w / 2 + .05, 0), (w / 2 - .05, 0), (0, rise - .05)], .12, (xc, y_wall - depth + .02, beam_z + .1), M['siding'], bev=.02))
    p += turn(clad_face([(-w / 2, beam_z + .1), (0, beam_z + .1 + rise - .1), (w / 2, beam_z + .1)], beam_z + .12, 'clap', 'siding', .22),
              0, (xc, y_wall - depth - .04, 0))
    p.append(cyl('pvent', .17, .08, (xc, y_wall - depth - .12, beam_z + .1 + rise * .38), M['trim'], verts=12, rot=(math.pi / 2, 0, 0), bev=.02))
    return p

def bush(at, r=.42, flowers=('rose', 'sun'), seed=1):
    x, y, z = at
    p = [blob('bush', r, (x, y, z + r * .75), M['leaf'], scale=(1.15, 1, .85), subdiv=2, seed=seed)]
    for i, f in enumerate(flowers):
        a = seed * 1.7 + i * 2.1
        p.append(ico('bf', r * .2, (x + math.cos(a) * r * .7, y - r * .6, z + r * (1.0 + .2 * i)), M[f], subdiv=1))
    return p

def flower_bed(x0, x1, y, z=0.0):
    p = [box('bed', (x1 - x0, .5, .16), ((x0 + x1) / 2, y, z + .08), M['soil'], bev=.05, seg=1)]
    n = max(2, int((x1 - x0) / .42))
    for i in range(n):
        x = x0 + .15 + i * (x1 - x0 - .3) / max(1, n - 1)
        p.append(ico('bl', .13, (x, y + .05, z + .25), M['leaf'], subdiv=1, scale=(1, 1, .8)))
        p.append(ico('bf', .08, (x + .03, y - .1, z + .34), M[('rose', 'sun', 'violet')[i % 3]], subdiv=1))
    return p

def us_flag(at, side=-1):
    """A little flag on a pole leaning out from a porch post."""
    x, y, z = at
    p = [beam('fpole', (x, y, z), (x + side * .2, y - .6, z + .5), .045, M['trim'], bev=0)]
    fx, fy, fz = x + side * .2, y - .6, z + .5
    ox = side * .02
    for i in range(5):
        p.append(box('stripe', (.72, .03, .09), (fx + side * .36 + ox, fy, fz - .045 - i * .09), M['flag_red' if i % 2 == 0 else 'trim'], bev=0))
    p.append(box('canton', (.3, .04, .22), (fx + side * .15 + ox, fy - .01, fz - .11), M['flag_blue'], bev=0))
    for k, (dx, dz) in enumerate(((.07, -.06), (.2, -.06), (.135, -.12), (.07, -.17), (.2, -.17))):
        p.append(ico('star', .022, (fx + side * dx + ox, fy - .035, fz + dz), M['trim'], subdiv=0))
    return p

def rocker(at, ang=0.0):
    x, y, z = at
    p = [box('rs', (.48, .45, .06), (0, 0, .42), M['wood'], bev=.02, seg=1),
         box('rbk', (.48, .06, .55), (0, .22, .72), M['wood'], bev=.02, seg=1, rot=(-.15, 0, 0)),
         box('rl', (.05, .05, .36), (-.2, -.15, .24), M['wood_dark'], bev=0), box('rl', (.05, .05, .36), (.2, -.15, .24), M['wood_dark'], bev=0),
         box('rl', (.05, .05, .36), (-.2, .15, .24), M['wood_dark'], bev=0), box('rl', (.05, .05, .36), (.2, .15, .24), M['wood_dark'], bev=0),
         box('rr', (.05, .7, .05), (-.2, 0, .05), M['wood_dark'], bev=.02, seg=1), box('rr', (.05, .7, .05), (.2, 0, .05), M['wood_dark'], bev=.02, seg=1),
         box('cush', (.4, .38, .06), (0, -.02, .48), M['rose'], bev=.03, seg=1)]
    return turn(p, ang, (x, y, z))

def round_vent(at, face='-y', r=.32):
    return turn([cyl('vent', r, .1, (0, -.05, 0), M['trim'], verts=14, rot=(math.pi / 2, 0, 0), bev=0),
                 cyl('ventg', r * .72, .06, (0, -.09, 0), M['glass'], verts=16, rot=(math.pi / 2, 0, 0), bev=0),
                 box('ventm', (.04, .04, r * 1.4), (0, -.12, 0), M['trim'], bev=0),
                 box('ventm', (r * 1.4, .04, .04), (0, -.12, 0), M['trim'], bev=0)], FACE[face], at)

def gable_dormer(x, y_front, z_floor, w=1.05, h=1.0, depth=1.7, rise=.55):
    p = [box('dorm', (w, depth, h), (x, y_front + depth / 2, z_floor + h / 2), M['siding'], bev=.03, seg=1)]
    p += turn(clad_face([(-w / 2, z_floor + h), (w / 2, z_floor + h)], z_floor + .05, 'clap', 'siding', .25), 0, (x, y_front, 0))
    for sx in (-1, 1):
        p.append(box('dcorner', (.12, .12, h), (x + sx * w / 2, y_front, z_floor + h / 2), M['trim'], bev=0))
    prof = [(-w / 2 - .02, z_floor + h), (0, z_floor + h + rise), (w / 2 + .02, z_floor + h)]
    r = roof_profile(prof, depth, ov_eave=.18, ov_end=.12, t=.14, shingles=0, eave_r=.08, ridge_r=.11, rake=None)
    p += turn(r, math.pi / 2, (x, y_front + depth / 2, 0))
    p.append(extrude_outline('dgable', [(-w / 2, 0), (w / 2, 0), (0, rise - .04)], .1, (x, y_front - .02, z_floor + h), M['siding'], bev=.01))
    p += window((x, y_front, z_floor + h * .5), w=w * .5, h=h * .55, shutters=False, head=False)
    return p

def finish(parts, name):
    if os.environ.get('RURAL_DEBUG') == name:
        dg = bpy.context.evaluated_depsgraph_get()
        tally = {}
        for o in parts:
            me = o.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            key = o.name.split('.')[0]
            tally[key] = tally.get(key, 0) + len(me.loop_triangles)
            o.evaluated_get(dg).to_mesh_clear()
        for k, v in sorted(tally.items(), key=lambda kv: -kv[1])[:25]:
            print(f'  part {k:10s} {v}')
    return join(parts, name)

# -------------------------------------------------------------------- homes
def home_t0():
    """Starter log cabin: a front gable over a log box, stone chimney, woodpile."""
    W, D, z0 = 3.4, 2.8, .25
    p = [box('found', (W + .45, D + .45, z0), (0, 0, z0 / 2), M['stone'], bev=.08, seg=2),
         box('core', (W - .1, D - .1, 2.1), (0, 0, z0 + 1.05), M['log_dark'], bev=0)]
    r, pitch = .15, .28
    for k in range(7):
        zf = z0 + r + k * pitch
        zs = zf + pitch / 2
        for sy in (-1, 1):
            p.append(cyl('log', r, W + .5, (0, sy * D / 2, zf), M['log'], verts=8, bev=0, rot=(0, math.pi / 2, 0)))
        for sx in (-1, 1):
            p.append(cyl('log', r, D + .5, (sx * W / 2, 0, zs), M['log'], verts=8, bev=0, rot=(math.pi / 2, 0, 0)))
            p.append(cyl('end', r * .78, .04, (sx * W / 2, -(D / 2 + .26), zs), M['log_end'], verts=8, bev=0, rot=(math.pi / 2, 0, 0)))
    top = z0 + r + 6 * pitch + pitch / 2 + r  # side-log top: the eaves rest here
    rise = 1.3
    # Front and back gables in board-and-batten Siding.
    for sy in (-1, 1):
        tri = [(-W / 2 - .2, 0), (W / 2 + .2, 0), (0, rise + .1)]
        p.append(extrude_outline('gable', tri, .14, (0, sy * (D / 2 + .02), top - .14), M['siding'], bev=.02))
    battens = clad_face([(-W / 2 - .2, top - .1), (0, top + rise), (W / 2 + .2, top - .1)], top - .12, 'batten', 'siding', pitch=.32)
    p += turn(battens, 0, (0, -D / 2 - .06, 0))
    prof = [(-W / 2 - .15, top), (0, top + rise), (W / 2 + .15, top)]
    p += turn(roof_profile(prof, D, ov_eave=.42, ov_end=.42, shingles=2), math.pi / 2)
    p.append(cyl('loftv', .2, .08, (0, -D / 2 - .14, top + .45), M['trim'], verts=12, rot=(math.pi / 2, 0, 0), bev=.02))
    p.append(cyl('loftg', .14, .06, (0, -D / 2 - .17, top + .45), M['glass'], verts=12, rot=(math.pi / 2, 0, 0), bev=0))
    fy = -D / 2 - .1
    p += door((0, fy, z0 + .92), w=.86, h=1.84)
    for sx in (-1, 1):
        p += window((sx * 1.15, fy, 1.42), w=.52, h=.6, shutters=False, flowers=True, muntins=True)
    p.append(box('stoop', (1.5, .42, .22), (0, -D / 2 - .37, .11), M['porch'], bev=.04, seg=1))
    p.append(box('lampb', (.08, .1, .2), (.66, fy - .14, 1.95), M['charcoal'], bev=.02, seg=1))
    p.append(sphere('lamp', .1, (.66, fy - .2, 1.82), M['lamp'], segs=10, rings=6))
    # Stone chimney on the right wall.
    cx = W / 2 + .38
    p += [box('chb', (.56, .62, 1.3), (cx, .25, .65), M['stone'], bev=.06, seg=2),
          box('chs', (.46, .5, 3.0), (cx, .25, 2.75), M['stone'], bev=.06, seg=2),
          box('chc', (.56, .6, .14), (cx, .25, 4.2), M['stone_dark'], bev=.04, seg=1)]
    for i, z in enumerate((.5, 1.0, 1.7, 2.4, 3.1, 3.7)):
        p.append(box('chst', (.2, .04, .12), (cx + (.08 if i % 2 else -.08), .25 - .3 + (0 if z < 1.3 else .06), z), M['stone_dark'], bev=.02, seg=1))
    # Woodpile on the left.
    for row in range(3):
        for col in range(3 - (row == 2)):
            zz = .11 + row * .19
            xx = -W / 2 - .26 - col * .19 + (row % 2) * .095
            p.append(cyl('fw', .1, .6, (xx, -.1, zz), M['log'], verts=7, bev=0, rot=(math.pi / 2, 0, 0)))
            p.append(cyl('fwe', .075, .03, (xx, -.41, zz), M['log_end'], verts=7, bev=0, rot=(math.pi / 2, 0, 0)))
    p += bush((-1.6, -D / 2 - .32, 0), .26, seed=3) + bush((1.6, -D / 2 - .32, 0), .26, ('violet', 'sun'), seed=5)
    return finish(p, 'home_t0')

def home_t1():
    W, D, z0 = 5.8, 4.2, .45
    p = foundation(W, D, z0)
    p += block(0, 0, W, D, z0, [(-D / 2, 3.05), (0, 4.85), (D / 2, 3.05)], ov_eave=.45, ov_end=.4)
    fy = -D / 2 - .02
    p += door((0, fy, z0 + 1.0), w=.95, h=2.0)
    for sx in (-1, 1):
        p += window((sx * 2.05, fy, 1.95), w=.75, h=1.15, flowers=True)
        p += window((sx * W / 2 + sx * .02, .2, 1.95), '+x' if sx > 0 else '-x', w=.8, h=1.1)
        p += round_vent((sx * W / 2 + sx * .05, 0, 3.75), '+x' if sx > 0 else '-x', .28)
    p += porch(-1.5, 1.5, 1.3, z0, 2.6, 2.7, [-1.35, 1.35], wall_y=-D / 2, steps=(0, 1.5), rails=True, roof=False, step_d=.27)
    p += gable_porch_roof(0, -D / 2, 1.35, 3.3, 2.6, .85)
    p += chimney(1.6, .7, 4.0, 1.65)
    p += bush((-2.55, -2.5, 0), .38, seed=2) + bush((2.55, -2.5, 0), .38, ('violet', 'rose'), seed=4)
    p += flower_bed(-1.45, -.85, -3.75) + flower_bed(.85, 1.45, -3.75)
    return finish(p, 'home_t1')

def home_t2():
    W, D, z0 = 6.4, 4.8, .5
    p = foundation(W, D, z0)
    p += block(0, 0, W, D, z0, [(-D / 2, 5.1), (0, 6.95), (D / 2, 5.1)], ov_eave=.45, ov_end=.4)
    p.append(box('floorband', (W + .16, D + .16, .16), (0, 0, 2.95), M['trim'], bev=.03, seg=1))
    # Centre cross gable over the porch: the classic I-house farmhouse face.
    p += block(0, -1.55, 2.3, 1.7, 5.0, [(-1.15, 5.14), (0, 6.35), (1.15, 5.14)], axis='y', ov_eave=.3, ov_end=.35,
               shingles=1, faces=('-y',))
    fy = -D / 2 - .02
    p += window((0, fy, 5.62), w=.5, h=.62, shutters=False, head=False)
    p.append(extrude_outline('ghead', [(-.42, 0), (.42, 0), (0, .3)], .14, (0, fy - .1, 6.02), M['trim'], bev=.02))
    p += door((0, fy, z0 + 1.0), w=.95, h=1.95)
    for sx in (-1, 1):
        p += window((sx * 2.0, fy, 1.95), w=.85, h=1.3)
        p += window((sx * 2.0, fy, 4.05), w=.8, h=1.0)
        side = '+x' if sx > 0 else '-x'
        p += window((sx * W / 2 + sx * .02, .3, 1.95), side, w=.8, h=1.2) + window((sx * W / 2 + sx * .02, .3, 4.05), side, w=.8, h=1.0)
    p += window((0, fy, 4.05), w=.62, h=1.0, shutters=False)
    cols = [-3.05, -1.0, 1.0, 3.05]
    p += porch(-3.2, 3.2, 1.6, z0, 2.6, 3.0, cols, wall_y=-D / 2, steps=(0, 1.6), step_d=.24)
    p += us_flag((-3.05, -3.82, 1.9), 1)
    p += rocker((-2.0, -3.15, z0), .3) + rocker((2.0, -3.15, z0), -.3)
    p += chimney(-2.3, .8, 6.1, 1.6)
    p += bush((-3.45, -3.75, 0), .36, seed=6) + bush((3.45, -3.75, 0), .36, ('violet', 'sun'), seed=7)
    p += flower_bed(-2.9, -1.0, -4.2) + flower_bed(1.0, 2.9, -4.2)
    return finish(p, 'home_t2')

def home_t3():
    z0 = .5
    p = foundation(5.8, 5.0, z0, cx=-.9) + foundation(2.6, 4.5, z0, cx=3.3, cy=-.25)
    p += block(-.9, 0, 5.8, 5.0, z0, [(-2.5, 5.1), (0, 7.1), (2.5, 5.1)], ov_eave=.45, ov_end=.4, faces=('-y', '+y', '-x'))
    p.append(box('floorband', (5.96, 5.16, .16), (-.9, 0, 2.95), M['trim'], bev=.03, seg=1))
    p += block(3.3, -.25, 2.6, 4.5, z0, [(-1.3, 3.4), (0, 4.9), (1.3, 3.4)], axis='y', ov_eave=.3, ov_end=.35, faces=('-y', '+y', '+x'))
    for x in (-2.6, .8):
        p += gable_dormer(x, -1.55, 5.65, w=1.05, h=1.0, depth=1.7)
    fy = -2.52
    p += door((-.9, fy, z0 + 1.0), w=1.0, h=1.95, fan=False)
    for x in (-2.6, .8):
        p += window((x, fy, 1.95), w=.85, h=1.3) + window((x, fy, 4.05), w=.8, h=1.0)
    p += window((-.9, fy, 4.05), w=.62, h=1.0, shutters=False)
    p += window((3.3, fy, 1.85), w=1.25, h=1.2, flowers=True)
    p += round_vent((3.3, fy, 4.0), '-y', .3)
    p += window((4.62, .2, 1.9), '+x', w=.8, h=1.1)
    for y in (-1.0, 1.1):
        p += window((-3.82, y, 1.95), '-x', w=.8, h=1.2) + window((-3.82, y, 4.05), '-x', w=.8, h=1.0)
    cols = [-4.7, -3.0, -1.75, -.05, 1.5, 3.0, 4.45]
    p += porch(-4.82, 4.6, 1.5, z0, 2.6, 3.0, cols, wall_y=-2.5, steps=(-.9, 1.4), side_rails=(False, True), step_d=.24)
    side = porch(-1.85, 2.5, 1.0, z0, 2.6, 3.0, [-1.7, -.2, 1.25], wall_y=0, side_rails=(True, False), roof_ov=.06)
    p += turn(side, -math.pi / 2, (-3.8, 0, 0))
    p += us_flag((-4.7, -3.82, 1.9), 1)
    p += rocker((-2.3, -3.2, z0), .25) + rocker((1.0, -3.2, z0), -.25)
    p += chimney(-3.1, .6, 6.3, 1.9) + chimney(3.3, 1.2, 4.2, 1.1)
    p += bush((-4.3, -4.18, 0), .34, seed=8) + bush((4.3, -4.18, 0), .34, ('violet', 'rose'), seed=9)
    p += flower_bed(-3.0, -1.8, -4.2) + flower_bed(0.0, 2.9, -4.2)
    return finish(p, 'home_t3')

# ---------------------------------------------------------- neighbour farms
def farm_a():
    """Saltbox colonial: two storeys at the front, a long roof sweeping down at the back."""
    W, D, z0 = 6.4, 5.2, .45
    p = foundation(W, D, z0)
    p += block(0, 0, W, D, z0, [(-2.6, 4.95), (-.9, 6.75), (2.6, 2.65)], ov_eave=.4, ov_end=.4)
    fy = -D / 2 - .02
    p += door((0, fy, z0 + 1.0), w=.95, h=1.95, fan=True)
    for sx in (-1, 1):
        p += window((sx * 1.9, fy, 1.9), w=.8, h=1.25, flowers=True) + window((sx * 1.9, fy, 3.85), w=.8, h=1.05)
        side = '+x' if sx > 0 else '-x'
        p += window((sx * W / 2 + sx * .02, -1.2, 1.9), side, w=.75, h=1.15) + window((sx * W / 2 + sx * .02, -1.4, 3.85), side, w=.7, h=.95)
    p += window((0, fy, 3.85), w=.7, h=1.05)
    p += porch(-1.2, 1.2, 1.2, z0, 2.75, 2.8, [-1.05, 1.05], wall_y=-D / 2, steps=(0, 1.4), rails=False, roof=False, step_d=.27)
    p += gable_porch_roof(0, -D / 2, 1.25, 2.7, 2.75, .7)
    p += chimney(0, -.9, 6.0, 1.65, w=.9)
    p += bush((-2.7, -3.05, 0), .4, seed=10) + bush((2.7, -3.05, 0), .4, ('sun', 'violet'), seed=11)
    p += flower_bed(-2.6, -1.3, -3.25) + flower_bed(1.3, 2.6, -3.25)
    return finish(p, 'farm_a')

def farm_b():
    """Dutch colonial with a gambrel roof, three gabled dormers and a columned stoop."""
    W, D, z0 = 6.6, 5.4, .4
    p = foundation(W, D, z0)
    prof = [(-2.7, 3.0), (-2.15, 5.0), (0, 6.15), (2.15, 5.0), (2.7, 3.0)]
    p += block(0, 0, W, D, z0, prof, ov_eave=.45, ov_end=.4)
    for x in (-2.0, 0, 2.0):
        p += gable_dormer(x, -2.95, 3.45, w=.95, h=1.05, depth=1.2, rise=.48)
    fy = -D / 2 - .02
    p += door((0, fy, z0 + .95), w=.95, h=1.9)
    for sx in (-1, 1):
        p += window((sx * 2.0, fy, 1.75), w=.95, h=1.2, flowers=True)
        side = '+x' if sx > 0 else '-x'
        p += window((sx * W / 2 + sx * .02, -.4, 1.75), side, w=.8, h=1.1) + window((sx * W / 2 + sx * .02, -.8, 4.4), side, w=.6, h=.8)
    p += porch(-1.2, 1.2, 1.25, z0, 2.5, 2.62, [-1.05, 1.05], wall_y=-D / 2, steps=(0, 1.4), rails=False, step_d=.25)
    # Exterior brick chimney on the right gable.
    p += [box('chb', (.8, .9, 2.4), (3.55, .4, 1.2), M['brick'], bev=.06, seg=2)] + chimney(3.55, .4, 2.3, 4.3, w=.6)
    p += bush((-2.9, -3.15, 0), .38, seed=12) + bush((2.9, -3.15, 0), .38, ('rose', 'violet'), seed=13)
    p += flower_bed(-2.7, -1.35, -3.3) + flower_bed(1.35, 2.7, -3.3)
    return finish(p, 'farm_b')

def farm_c():
    """L-shaped ranch: a long low wing with a porch and a front-gable wing with a picture window."""
    z0 = .35
    p = foundation(4.6, 4.2, z0, cx=-1.2, cy=.2) + foundation(2.7, 5.6, z0, cx=2.15, cy=-.5)
    p += block(-1.2, .2, 4.6, 4.2, z0, [(-2.1, 2.85), (0, 4.05), (2.1, 2.85)], ov_eave=.42, ov_end=.35, faces=('-y', '+y', '-x'))
    p += block(2.15, -.5, 2.7, 5.6, z0, [(-1.35, 2.85), (0, 4.25), (1.35, 2.85)], axis='y', ov_eave=.38, ov_end=.35, faces=('-y', '+y', '+x', '-x'))
    fy = -1.92
    p += door((-1.6, fy, z0 + .97), w=.95, h=1.95)
    p += window((-2.85, fy, 1.75), w=1.0, h=1.0) + window((-.3, fy, 1.75), w=.9, h=1.0)
    p += window((2.15, -3.32, 1.65), w=1.35, h=1.05, flowers=True)
    p += round_vent((2.15, -3.32, 3.4), '-y', .26)
    p += window((3.52, .6, 1.7), '+x', w=.9, h=1.0) + window((-3.52, .2, 1.7), '-x', w=.9, h=1.0)
    p += porch(-3.5, .8, 1.4, z0, 2.35, 2.55, [-3.35, -2.25, -.95, .65], wall_y=-1.9, steps=(-1.6, 1.3), side_rails=(True, False), step_d=.27)
    p += us_flag((-3.35, -3.12, 1.75), 1)
    p += [box('bench', (1.0, .38, .08), (-.1, -2.2, z0 + .45), M['wood'], bev=.02, seg=1)]
    p += [box('benchl', (.08, .34, .44), (x, -2.2, z0 + .22), M['wood_dark'], bev=0) for x in (-.5, .3)]
    p += chimney(-3.0, 1.1, 3.4, 1.6)
    p += bush((1.25, -3.75, 0), .36, seed=14) + bush((3.1, -3.75, 0), .36, ('violet', 'sun'), seed=15)
    p += flower_bed(-3.4, -2.3, -3.6) + flower_bed(-.9, .6, -3.6)
    return finish(p, 'farm_c')

def hip_roof(W, D, zb, rise, ov=.45, cx=0, cy=0):
    hx, hy = W / 2 + ov, D / 2 + ov
    roof = cone('hip', 1.0, 1.0, (0, 0, 0), M['roof'], verts=4)
    roof.rotation_euler = (0, 0, math.pi / 4)
    S._apply_all([roof])
    roof.scale = (hx / .7071, hy / .7071, rise)
    roof.location = (cx, cy, zb + rise / 2)
    bevel(roof, .08, 3)
    p = [roof, box('rim', (2 * hx + .1, 2 * hy + .1, .2), (cx, cy, zb), M['roof_trim'], bev=.07, seg=2)]
    for f in (.3, .6):
        ax, ay, z = (1 - f) * hx, (1 - f) * hy, zb + f * rise + .02
        for sy in (-1, 1):
            p.append(cyl('hs', .05, 2 * ax, (cx, cy + sy * ay, z), M['roof_trim'], verts=6, bev=0, rot=(0, math.pi / 2, 0)))
        for sx in (-1, 1):
            p.append(cyl('hs', .05, 2 * ay, (cx + sx * ax, cy, z), M['roof_trim'], verts=6, bev=0, rot=(math.pi / 2, 0, 0)))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(beam('hipr', (cx + sx * hx, cy + sy * hy, zb + .1), (cx, cy, zb + rise + .05), .16, M['roof_trim'], bev=.04))
    return p

def walls_box(cx, cy, W, D, z0, z1):
    p = [box('wall', (W, D, z1 - z0), (cx, cy, (z0 + z1) / 2), M['siding'], bev=.03, seg=1)]
    rows = max(1, round((z1 - z0) / .3))
    row = (z1 - z0) / rows
    for f, L, at in (('-y', W, (cx, cy - D / 2)), ('+y', W, (cx, cy + D / 2)), ('+x', D, (cx + W / 2, cy)), ('-x', D, (cx - W / 2, cy))):
        p += turn(clad_face([(-L / 2, z1), (L / 2, z1)], z0 + .03, 'clap', 'siding', row), FACE[f], (at[0], at[1], 0))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(box('corner', (.18, .18, z1 - z0), (cx + sx * W / 2, cy + sy * D / 2, (z0 + z1) / 2), M['trim'], bev=0))
    return p

def farm_d():
    """American foursquare: a two-storey cube, hipped roof and dormer, Craftsman porch."""
    W, D, z0, z1 = 6.0, 5.5, .55, 5.35
    p = foundation(W, D, z0, m='brick') + walls_box(0, 0, W, D, z0, z1)
    p.append(box('floorband', (W + .16, D + .16, .16), (0, 0, 3.0), M['trim'], bev=.03, seg=1))
    p += hip_roof(W, D, z1 + .05, 2.0, ov=.42)
    # Hipped front dormer.
    p.append(box('hdorm', (1.7, 1.5, .95), (0, -1.15, 6.25), M['siding'], bev=.03, seg=1))
    p += turn(clad_face([(-.85, 6.72), (.85, 6.72)], 5.8, 'clap', 'siding', .23), 0, (0, -1.9, 0))
    dr = cone('dhip', 1.0, 1.0, (0, 0, 0), M['roof'], verts=4)
    dr.rotation_euler = (0, 0, math.pi / 4)
    S._apply_all([dr])
    dr.scale = (1.15 / .7071, 1.0 / .7071, .55)
    dr.location = (0, -1.15, 6.72 + .27)
    p.append(bevel(dr, .05, 2))
    p.append(box('drim', (2.35, 2.05, .12), (0, -1.15, 6.72), M['roof_trim'], bev=.04, seg=1))
    for x in (-.4, .4):
        p += window((x, -1.92, 6.25), w=.42, h=.5, shutters=False, head=False, muntins=False)
    fy = -D / 2 - .02
    p += door((1.2, fy, z0 + 1.0), w=1.0, h=1.95)
    p += window((-1.5, fy, 2.0), w=1.55, h=1.25, shutters=False)
    p += window((-1.5, fy, 4.15), w=.85, h=1.05) + window((1.5, fy, 4.15), w=.85, h=1.05)
    for sx in (-1, 1):
        side = '+x' if sx > 0 else '-x'
        p += window((sx * W / 2 + sx * .02, -.8, 2.0), side, w=.8, h=1.2) + window((sx * W / 2 + sx * .02, -.8, 4.15), side, w=.8, h=1.05)
    p += porch(-3.0, 3.0, 1.2, z0, 2.75, 3.15, [-2.8, -.3, 2.8], wall_y=-D / 2, steps=(1.2, 1.4), side_rails=(True, True),
               col_style='square', step_d=.24)
    p += chimney(2.3, 1.1, 5.9, 1.8)
    p += bush((-3.25, -4.05, 0), .34, seed=16) + bush((3.25, -4.05, 0), .34, ('rose', 'sun'), seed=17)
    p += flower_bed(-2.6, -.6, -4.2)
    return finish(p, 'farm_d')

# ---------------------------------------------------------------- farm yard
def barn():
    W, D, z0 = 5.8, 6.2, .2
    p = [box('slab', (W + .3, D + .3, z0), (0, 0, z0 / 2), M['stone'], bev=.06, seg=1)]
    prof = [(-2.9, 3.1), (-2.1, 4.75), (0, 5.65), (2.1, 4.75), (2.9, 3.1)]
    p += block(0, 0, W, D, z0, prof, axis='y', wall='barn', clad='batten', roof='barn_roof', trim='barn_roof_trim',
               rake='trim', ov_eave=.32, ov_end=.3, shingles=2)
    fy = -D / 2 - .07
    # Big double doors with white frames and X braces.
    for sx in (-1, 1):
        cx = sx * .64
        p.append(box('door', (1.24, .08, 2.5), (cx, fy - .02, z0 + 1.25), M['barn'], bev=.02, seg=1))
        for (bw, bh, bx, bz) in ((1.24, .14, 0, 2.43), (1.24, .14, 0, .07), (.14, 2.5, -.55, 1.25), (.14, 2.5, .55, 1.25)):
            p.append(box('dfr', (bw, .07, bh), (cx + bx, fy - .08, z0 + bz), M['trim'], bev=.02, seg=1))
        for a in (1, -1):
            p.append(beam('dx', (cx - .5 * a, fy - .09, z0 + .14), (cx + .5 * a, fy - .09, z0 + 2.36), .11, M['trim'], bev=.01))
        p.append(box('handle', (.06, .06, .34), (cx - sx * .45, fy - .14, z0 + 1.25), M['charcoal'], bev=.02, seg=1))
    p.append(box('track', (3.3, .1, .12), (0, fy - .06, z0 + 2.62), M['charcoal'], bev=.02, seg=1))
    # Hayloft door, hay poking out and the hoist beam under a little hood.
    p.append(box('loft', (1.0, .08, 1.05), (0, fy - .02, 4.05), M['barn'], bev=.02, seg=1))
    for (bw, bh, bx, bz) in ((1.0, .12, 0, .5), (1.0, .12, 0, -.5), (.12, 1.05, -.45, 0), (.12, 1.05, .45, 0)):
        p.append(box('lfr', (bw, .07, bh), (bx, fy - .08, 4.05 + bz), M['trim'], bev=.02, seg=1))
    for a in (1, -1):
        p.append(beam('lx', (-.4 * a, fy - .09, 3.6), (.4 * a, fy - .09, 4.5), .09, M['trim'], bev=.01))
    for i, x in enumerate((-.32, -.05, .22, .4)):
        p.append(blob('hay', .16, (x, fy - .14, 3.56 + (i % 2) * .04), M['hay'], scale=(1.3, .7, .6), subdiv=1, seed=20 + i))
    p.append(box('hoist', (.16, .5, .16), (0, fy - .05, 5.08), M['wood'], bev=.03, seg=1))
    p.append(cyl('hook', .06, .28, (0, fy - .25, 4.9), M['iron'], verts=8, bev=0))
    hood = [(-.5, 0), (.5, 0), (0, .38)]
    p.append(extrude_outline('hood', hood, .7, (0, fy + .05, 5.18), M['barn_roof'], bev=.03))
    for sx in (-1, 1):
        x = sx * 2.15
        p.append(box('win', (.55, .06, .55), (x, fy - .02, 2.0), M['glass'], bev=0))
        p.append(box('wfa', (.08, .06, .55), (x, fy - .06, 2.0), M['trim'], bev=0))
        p.append(box('wfb', (.55, .06, .08), (x, fy - .06, 2.0), M['trim'], bev=0))
        for (bw, bh, bx, bz) in ((.71, .1, 0, .32), (.71, .1, 0, -.32), (.1, .55, -.32, 0), (.1, .55, .32, 0)):
            p.append(box('wfr', (bw, .08, bh), (x + bx, fy - .05, 2.0 + bz), M['trim'], bev=.02, seg=1))
    # Lean-to shed on the right.
    lean = block(3.28, .1, .76, 4.4, z0, [(-.38, 2.3), (.38, 3.0)], axis='y', wall='barn', clad='batten', roof='barn_roof',
                 trim='barn_roof_trim', rake='trim', ov_eave=.1, ov_end=.25, shingles=1, faces=('-y', '+y', '+x'))
    p += lean
    p.append(box('leandoor', (.56, .08, 1.7), (3.28, -2.14, z0 + .85), M['wood_dark'], bev=.02, seg=1))
    for a in (1, -1):
        p.append(beam('ldx', (3.28 - .22 * a, -2.2, z0 + .1), (3.28 + .22 * a, -2.2, z0 + 1.6), .07, M['trim'], bev=0))
    # Cupola with a rooster weathervane.
    ct = 5.65 + .2
    p.append(box('cup', (.82, .82, .62), (0, 0, ct + .25), M['barn'], bev=.03, seg=1))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(box('cupc', (.1, .1, .62), (sx * .41, sy * .41, ct + .25), M['trim'], bev=.02, seg=1))
    for k in range(3):
        p.append(box('louv', (.5, .04, .06), (0, -.43, ct + .1 + k * .14), M['trim'], bev=0, rot=(.4, 0, 0)))
    p.append(cone('cupr', .72, .5, (0, 0, ct + .82), M['barn_roof_trim'], verts=4, rot=(0, 0, math.pi / 4)))
    p.append(box('cupe', (1.04, 1.04, .08), (0, 0, ct + .58), M['trim'], bev=.02, seg=1))
    p.append(cyl('vrod', .025, .55, (0, 0, ct + 1.2), M['charcoal'], verts=6, bev=0))
    p.append(box('varr', (.7, .03, .03), (0, 0, ct + 1.25), M['charcoal'], bev=0))
    p.append(cone('vtip', .06, .14, (.38, 0, ct + 1.25), M['charcoal'], verts=6, rot=(0, math.pi / 2, 0)))
    rooster = [(-.18, 0), (.12, 0), (.18, .1), (.14, .2), (.2, .28), (.12, .3), (.06, .18), (-.06, .12), (-.2, .3), (-.22, .12)]
    p.append(extrude_outline('rooster', rooster, .03, (0, 0, ct + 1.28), M['charcoal'], bev=0))
    p.append(sphere('vball', .05, (0, 0, ct + 1.0), M['gold'], segs=8, rings=6))
    return finish(p, 'barn')

def silo():
    r = 1.35
    p = [cyl('base', 1.5, .3, (0, 0, .15), M['stone'], verts=28, bev=.05, seg=2)]
    p.append(lathe('body', [(r, .25), (r, 6.35)], (0, 0, 0), M['silo'], segments=32, cap_bottom=False, cap_top=True))
    for z in (1.25, 2.45, 3.65, 4.85, 6.05):
        p.append(torus('band', r + .01, .055, (0, 0, z), M['trim'], major_segs=28, minor_segs=4))
    dome = [(r + .07, 6.3)] + [((r + .07) * math.cos(a), 6.3 + 1.2 * math.sin(a)) for a in (math.radians(d) for d in (20, 40, 60, 75, 88))] + [(0, 7.5)]
    p.append(lathe('dome', dome, (0, 0, 0), M['silo_dome'], segments=32, cap_bottom=True))
    p.append(torus('drim', r + .08, .07, (0, 0, 6.33), M['silo_dome'], major_segs=32, minor_segs=6))
    p.append(cyl('vent', .2, .2, (0, 0, 7.55), M['silo_dome'], verts=12, bev=.03))
    p.append(cone('ventc', .3, .22, (0, 0, 7.76), M['silo'], verts=12))
    # Ladder up the front and a chute.
    y = -r - .1
    for sx in (-1, 1):
        p.append(box('lr', (.06, .06, 6.2), (sx * .22, y, 3.35), M['metal'], bev=0))
        p.append(box('lst', (.06, .14, .06), (sx * .22, y + .06, 1.0), M['metal'], bev=0))
        p.append(box('lst', (.06, .14, .06), (sx * .22, y + .06, 5.8), M['metal'], bev=0))
    for k in range(17):
        p.append(box('rung', (.44, .04, .04), (0, y, .6 + k * .35), M['metal'], bev=0))
    p.append(box('hatch', (.5, .08, .7), (.55, -r + .02, .75), M['silo_dome'], bev=.03, seg=1, rot=(0, 0, -.4)))
    return finish(p, 'silo')

def picket_fence():
    p = []
    for sx in (-1, 1):
        p.append(box('post', (.12, .12, .95), (sx * 1.0, 0, .475), M['trim'], bev=.02, seg=1))
        p.append(cone('cap', .1, .1, (sx * 1.0, 0, 1.0), M['trim'], verts=4, rot=(0, 0, math.pi / 4)))
    for z in (.26, .64):
        p.append(box('rail', (1.9, .04, .08), (0, .04, z), M['trim'], bev=0))
    outline = [(-.045, 0), (.045, 0), (.045, .74), (0, .84), (-.045, .74)]
    for i in range(8):
        x = -.77 + i * .22
        p.append(extrude_outline('picket', outline, .03, (x, -.0, .04), M['trim'], bev=0))
    return finish(p, 'picket_fence')

def rail_fence():
    p = []
    for sx in (-1, 1):
        p.append(cyl('post', .085, 1.1, (sx * 1.25, 0, .55), M['wood'], verts=7, bev=0, rot=(0, 0, sx * .3)))
        p.append(cone('ptop', .085, .08, (sx * 1.25, 0, 1.14), M['wood'], verts=7))
    for k, (z, dy) in enumerate(((.32, .02), (.62, -.02), (.92, .02))):
        p.append(cyl('rail', .06, 2.62, (0, dy, z), M['wood_light'], verts=5, bev=0, rot=(0, math.pi / 2, 0)))
    return finish(p, 'rail_fence')

def mailbox():
    p = [box('post', (.12, .12, 1.0), (0, 0, .5), M['wood'], bev=.02, seg=1),
         box('arm', (.14, .56, .07), (0, -.08, .99), M['wood'], bev=.02, seg=1),
         box('mbody', (.3, .56, .15), (0, -.12, 1.1), M['mailbox'], bev=.02, seg=1),
         cyl('mtop', .15, .56, (0, -.12, 1.175), M['mailbox'], verts=12, bev=0, rot=(math.pi / 2, 0, 0)),
         box('mdoor', (.31, .03, .16), (0, -.415, 1.1), M['mailbox'], bev=.01, seg=1),
         cyl('mdoort', .155, .03, (0, -.415, 1.175), M['mailbox'], verts=12, bev=0, rot=(math.pi / 2, 0, 0)),
         box('latch', (.06, .03, .04), (0, -.435, 1.25), M['charcoal'], bev=0),
         box('flagarm', (.025, .05, .3), (.165, -.02, 1.27), M['flag_red'], bev=0),
         box('flag', (.025, .2, .13), (.165, -.1, 1.37), M['flag_red'], bev=0)]
    p += [ico('mfl', .1, (.07, -.08, .12), M['leaf'], subdiv=1, scale=(1, 1, .8)), ico('mfl', .09, (-.08, .06, .1), M['leaf'], subdiv=1),
          ico('mf', .05, (.08, -.15, .2), M['sun'], subdiv=1), ico('mf', .05, (-.1, .0, .18), M['rose'], subdiv=1)]
    return finish(p, 'mailbox')

def hay_round():
    r, w = .62, 1.05
    p = [cyl('bale', r, w, (0, 0, r), M['hay'], verts=16, bev=.07, seg=1, rot=(0, math.pi / 2, 0))]
    for sx in (-1, 1):
        p.append(cyl('swirl', r * .62, .03, (sx * (w / 2 + .005), 0, r), M['hay_light'], verts=10, bev=0, rot=(0, math.pi / 2, 0)))
        p.append(cyl('swirl', r * .28, .04, (sx * (w / 2 + .01), 0, r), M['hay_dark'], verts=8, bev=0, rot=(0, math.pi / 2, 0)))
    for x in (-.25, .25):
        p.append(cyl('twine', r + .012, .05, (x, 0, r), M['hay_dark'], verts=16, bev=0, rot=(0, math.pi / 2, 0)))
    return finish(p, 'hay_round')

def stump():
    prof = [(.47, 0), (.4, .08), (.34, .2), (.33, .4), (.35, .5)]
    p = [lathe('trunk', prof, (0, 0, 0), M['bark'], segments=14, cap_bottom=False, cap_top=True)]
    for i in range(4):
        a = i * math.tau / 4 + .4
        p.append(ico('root', .16, (math.cos(a) * .3, math.sin(a) * .3, .06), M['bark'], subdiv=1, scale=(1.2, .8, .6), rot=(0, 0, a)))
    p.append(cyl('top', .32, .04, (0, 0, .51), M['wood_end'], verts=14, bev=0))
    p.append(cyl('ring', .21, .01, (0, 0, .535), M['ring'], verts=14, bev=0))
    p.append(cyl('core', .14, .012, (0, 0, .542), M['wood_end'], verts=12, bev=0))
    p.append(cyl('pith', .04, .014, (0, 0, .55), M['ring'], verts=8, bev=0))
    # An axe bitten into the top.
    p.append(beam('handle', (.02, -.05, .55), (.22, -.32, 1.05), .055, M['wood_light'], bev=.015))
    p.append(box('axe', (.24, .05, .16), (.0, -.03, .57), M['iron'], bev=.02, seg=1, rot=(0, -.15, -.95)))
    p.append(box('edge', (.05, .055, .17), (-.08, .08, .55), M['chrome'], bev=.01, seg=1, rot=(0, -.15, -.95)))
    p.append(ico('moss', .1, (.3, -.2, .1), M['leaf_light'], subdiv=1, scale=(1.2, 1, .5)))
    return finish(p, 'stump')

def pond_dock():
    p = []
    deck = .35
    n = 13
    for i in range(n):
        p.append(box('plank', (2.0, .27, .07), (0, -.16 - i * .3, deck - .035), M['wood_light' if i % 2 else 'wood'], bev=.02, seg=1))
    for sx in (-1, 1):
        p.append(box('stringer', (.12, 4.0, .16), (sx * .7, -2.0, deck - .15), M['wood_dark'], bev=.02, seg=1))
    for y in (-.25, -2.0, -3.82):
        for sx in (-1, 1):
            p.append(cyl('pile', .12, 1.6, (sx * .85, y, -.2), M['wood_dark'], verts=10, bev=0))
            p.append(sphere('pcap', .12, (sx * .85, y, .6), M['wood_dark'], segs=10, rings=5, scale=(1, 1, .5)))
    for sx in (-1, 1):
        p.append(torus('rope', .11, .03, (sx * .85, -3.82, .4), M['rope'], major_segs=12, minor_segs=5))
    p.append(box('step', (1.4, .4, .18), (0, .05, .09), M['stone'], bev=.04, seg=1))
    # Lantern post at the end and a coil of rope.
    p.append(box('lpost', (.1, .1, 1.3), (.7, -3.6, deck + .65), M['wood_dark'], bev=.02, seg=1))
    p.append(box('larm', (.36, .06, .06), (.56, -3.6, deck + 1.26), M['wood_dark'], bev=0))
    p.append(box('lcage', (.16, .16, .22), (.42, -3.6, deck + 1.08), M['charcoal'], bev=.03, seg=1))
    p.append(sphere('lglow', .065, (.42, -3.6, deck + 1.07), M['lamp'], segs=8, rings=6))
    p.append(torus('coil', .16, .05, (-.5, -3.3, deck + .05), M['rope'], major_segs=14, minor_segs=5))
    p.append(torus('coil', .1, .045, (-.5, -3.3, deck + .12), M['rope'], major_segs=12, minor_segs=5))
    return finish(p, 'pond_dock')

def tractor():
    p = []
    ry, rr, rw = .45, .62, .34
    fy_, fr, fw = -.85, .34, .22
    for sx in (-1, 1):
        x = sx * .73
        p.append(cyl('rtire', rr, rw, (x, ry, rr), M['tire'], verts=20, bev=.07, seg=1, rot=(0, math.pi / 2, 0)))
        for k in range(12):
            a = k * math.tau / 12
            p.append(box('lug', (rw * .9, .13, .07), (x, ry + math.cos(a) * (rr + .01), rr + math.sin(a) * (rr + .01)), M['tire'], bev=0, rot=(a - math.pi / 2, 0, 0)))
        p.append(cyl('rhub', .36, rw + .03, (x, ry, rr), M['tractor_hub'], verts=16, bev=.03, rot=(0, math.pi / 2, 0)))
        p.append(cyl('rcap', .12, rw + .09, (x, ry, rr), M['tractor'], verts=10, bev=.02, rot=(0, math.pi / 2, 0)))
        x = sx * .5
        p.append(cyl('ftire', fr, fw, (x, fy_, fr), M['tire'], verts=14, bev=.05, seg=1, rot=(0, math.pi / 2, 0)))
        p.append(cyl('fhub', .2, fw + .03, (x, fy_, fr), M['tractor_hub'], verts=12, bev=.02, rot=(0, math.pi / 2, 0)))
        # Fender over the rear wheel.
        arc = [((rr + .1) * math.cos(a), (rr + .1) * math.sin(a)) for a in (math.radians(d) for d in range(15, 166, 15))]
        arc += [((rr + .02) * math.cos(a), (rr + .02) * math.sin(a)) for a in (math.radians(d) for d in range(165, 14, -15))]
        p.append(extrude_outline('fender', [(-u, v) for u, v in arc], rw + .1, (sx * .73, ry, rr), M['tractor'], rot=(0, 0, math.pi / 2), bev=.02))
        p.append(cyl('hl', .08, .06, (sx * .25, -1.22, 1.05), M['lamp'], verts=10, bev=.01, rot=(math.pi / 2, 0, 0)))
    p.append(beam('faxle', (-.45, fy_, fr), (.45, fy_, fr), .1, M['charcoal'], bev=.02))
    p.append(beam('raxle', (-.6, ry, rr), (.6, ry, rr), .12, M['charcoal'], bev=.02))
    p.append(box('engine', (.5, 1.2, .38), (0, -.55, .62), M['charcoal'], bev=.06, seg=2))
    p.append(box('hood', (.72, 1.25, .52), (0, -.6, 1.02), M['tractor'], bev=.16, seg=3))
    p.append(box('grille', (.6, .06, .44), (0, -1.24, .98), M['chrome'], bev=.03, seg=1))
    for k in range(4):
        p.append(box('gbar', (.5, .03, .04), (0, -1.28, .82 + k * .1), M['charcoal'], bev=0))
    for sx in (-1, 1):
        p.append(box('stripe', (.02, 1.0, .08), (sx * .365, -.6, 1.12), M['trim'], bev=0))
    p.append(box('body', (.78, .75, .62), (0, .35, .9), M['tractor'], bev=.12, seg=2))
    p.append(box('plat', (1.5, .62, .06), (0, .42, 1.25), M['tractor'], bev=.03, seg=1))
    p.append(box('seatb', (.12, .12, .2), (0, .5, 1.36), M['charcoal'], bev=.02, seg=1))
    p.append(box('seat', (.52, .44, .12), (0, .55, 1.5), M['seat'], bev=.05, seg=2))
    p.append(box('seatback', (.52, .1, .4), (0, .78, 1.72), M['seat'], bev=.05, seg=2, rot=(-.2, 0, 0)))
    p.append(beam('column', (0, -.05, 1.2), (0, .14, 1.72), .07, M['charcoal'], bev=0))
    p.append(torus('wheel', .2, .03, (0, .15, 1.74), M['charcoal'], major_segs=16, minor_segs=5, rot=(-.6, 0, 0)))
    p.append(cyl('stack', .055, .8, (.18, -.8, 1.65), M['charcoal'], verts=8, bev=0))
    p.append(cyl('stackc', .075, .08, (.18, -.8, 2.07), M['chrome'], verts=8, bev=.01))
    p.append(cyl('intake', .06, .3, (-.18, -.65, 1.42), M['chrome'], verts=8, bev=.01))
    p.append(sphere('intakec', .09, (-.18, -.65, 1.6), M['chrome'], segs=8, rings=5))
    p.append(box('hitch', (.2, .3, .08), (0, .98, .5), M['charcoal'], bev=.02, seg=1))
    p.append(box('weight', (.62, .16, .26), (0, -1.28, .48), M['tractor_hub'], bev=.04, seg=1))
    return finish(p, 'tractor')

def windmill():
    """Lattice tower with the head, shaft and tail vane. The wheel (windmill_rotor) hangs at (0, -0.62, 6.25)."""
    p = []
    b, t, H = .95, .2, 5.9
    def corner(sx, sy, z):
        k = b + (t - b) * z / H
        return (sx * k, sy * k, z)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(beam('leg', corner(sx, sy, 0), corner(sx, sy, H), .1, M['metal'], bev=.0))
            p.append(box('foot', (.26, .26, .12), (sx * b, sy * b, .06), M['stone'], bev=.03, seg=1))
    stages = [0.25, 1.65, 2.95, 4.1, 5.1, H]
    sides = [((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))]
    for (a, c) in sides:
        for z in stages[1:]:
            p.append(beam('girt', corner(*a, z), corner(*c, z), .06, M['metal'], bev=0))
        for z0, z1 in zip(stages, stages[1:]):
            p.append(beam('brace', corner(*a, z0), corner(*c, z1), .04, M['metal'], bev=0))
            p.append(beam('brace', corner(*c, z0), corner(*a, z1), .04, M['metal'], bev=0))
    # Ladder on the front face.
    for sx in (-1, 1):
        p.append(beam('lad', (sx * .18, -b - .05, .0), (sx * .14, -t - .05, H), .045, M['metal'], bev=0))
    for k in range(14):
        z = .4 + k * .4
        y = -(b + (t - b) * z / H) - .05
        p.append(box('lrung', (.34, .035, .035), (0, y, z), M['metal'], bev=0))
    p.append(box('plat', (1.0, 1.0, .08), (0, 0, H + .02), M['wood'], bev=.02, seg=1))
    for k in range(4):
        p.append(box('platb', (.98, .1, .02), (0, -.36 + k * .24, H + .07), M['wood_dark'], bev=0))
    # Head: turntable, gearbox, shaft to the hub, tail boom and vane.
    p.append(cyl('turn', .22, .18, (0, 0, H + .15), M['iron'], verts=12, bev=.02))
    p.append(box('gear', (.34, .7, .32), (0, -.12, 6.25), M['rotor_red'], bev=.08, seg=2))
    p.append(cyl('shaft', .06, .3, (0, -.55, 6.25), M['iron'], verts=8, bev=0, rot=(math.pi / 2, 0, 0)))
    tail = [beam('boom', (0, .2, 6.3), (0, 1.75, 6.45), .07, M['iron'], bev=0),
            beam('boomb', (0, .15, 6.15), (0, 1.3, 6.42), .04, M['iron'], bev=0)]
    vane = [(0, -.05), (1.3, -.32), (1.3, .52), (0, .2)]
    tail.append(extrude_outline('vane', vane, .04, (0, 1.2, 6.25), M['rotor_red'], rot=(0, 0, math.pi / 2), bev=.01))
    tail.append(extrude_outline('vanes', [(.2, .02), (1.2, -.18), (1.2, .02), (.2, .1)], .05, (0, 1.2, 6.25 + .07), M['trim'], rot=(0, 0, math.pi / 2), bev=0))
    p += turn(tail, .55)  # swung aside a little, as when the mill furls; reads better from the game camera
    # Pump rod, pump stand and a little water trough.
    p.append(cyl('rod', .03, H - .6, (0, -.08, (H - .6) / 2 + .6), M['iron'], verts=6, bev=0))
    p.append(cyl('pump', .12, .7, (0, -.08, .35), M['iron'], verts=10, bev=.02))
    p.append(beam('spout', (0, -.15, .55), (0, -.5, .5), .07, M['iron'], bev=0))
    p.append(box('trough', (1.1, .5, .38), (0, -.82, .19), M['wood'], bev=.04, seg=2))
    p.append(box('water', (.98, .38, .04), (0, -.82, .36), M['water'], bev=0))
    return finish(p, 'windmill')

def windmill_rotor():
    """Origin at the hub; the wheel turns about local Z (glTF), which is Blender -Y."""
    p = []
    n, r0, r1 = 18, .32, 1.25
    for i in range(n):
        a = i * math.tau / n
        rc = (r0 + r1) / 2
        p.append(box('blade', (r1 - r0, .025, .24), (math.cos(a) * rc, 0, -math.sin(a) * rc), M['rotor_red' if i % 2 else 'trim'],
                     bev=0, rot=(.45, a, 0)))
    for rr in (.62, r1 - .02):
        p.append(torus('wring', rr, .03, (0, -.03, 0), M['metal'], major_segs=36, minor_segs=5, rot=(math.pi / 2, 0, 0)))
    for i in range(6):
        a = i * math.tau / 6 + .17
        p.append(beam('arm', (math.cos(a) * .12, -.05, -math.sin(a) * .12), (math.cos(a) * r1, .0, -math.sin(a) * r1), .045, M['iron'], bev=0))
    p.append(cyl('hub', .16, .26, (0, 0, 0), M['iron'], verts=12, bev=.03, rot=(math.pi / 2, 0, 0)))
    p.append(cone('nose', .16, .24, (0, -.24, 0), M['rotor_red'], verts=12, rot=(math.pi / 2, 0, 0)))
    return finish(p, 'windmill_rotor')

# ------------------------------------------------------------ build + export
builders = [home_t0, home_t1, home_t2, home_t3, farm_a, farm_b, farm_c, farm_d, barn, silo, picket_fence, rail_fence,
            mailbox, windmill, windmill_rotor, hay_round, tractor, pond_dock, stump]
models = []
for fn in builders:
    models.append(fn())

def bounds(o):
    xs = [v.co.x for v in o.data.vertices]
    ys = [v.co.y for v in o.data.vertices]
    zs = [v.co.z for v in o.data.vertices]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)

total = 0
for m in models:
    x0, x1, y0, y1, z0, z1 = bounds(m)
    tri = triangles(m)
    total += tri
    # Blender -Y is glTF +Z (front).
    print(f'{m.name:15s} {tri:6d} tris  x {x0:6.2f}..{x1:5.2f}  z(front) {-y1:6.2f}..{-y0:5.2f}  h {z1:5.2f}  (y min {z0:5.2f})')
print('total triangles', total)
size = export_glb(models, OUT)
print('rural.glb', size, 'bytes')

# ------------------------------------------------------------------ preview
# Tint each house's family materials the way the game will, so the sheet shows the variety.
FAMILIES = [
    ('#F6EFDF', '#D9473C', '#A9322C', '#2B4C9B'), ('#FFD866', '#3FA34D', '#2A7A36', '#E8433A'),
    ('#8FD0F5', '#4A5D8C', '#33416A', '#E8433A'), ('#F7F0E2', '#2F9A5A', '#1F7444', '#C9302C'),
    ('#D9443A', '#4A5068', '#33384C', '#FFFDF6'), ('#9BD67A', '#9A5A33', '#74401F', '#FFF1D2'),
    ('#FFB08A', '#5B6FB0', '#3F4E86', '#2F9A5A'), ('#7FE0C0', '#D9473C', '#A9322C', '#FFC83A'),
]
names = ('Siding', 'Roof', 'Roof Trim', 'Accent')
for m, fam in zip(models[:8], FAMILIES):
    for slot in m.material_slots:
        if slot.material and slot.material.name in names:
            col = fam[names.index(slot.material.name)]
            copy = slot.material.copy()
            bsdf = next(n for n in copy.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            bsdf.inputs['Base Color'].default_value = rgba(col)
            slot.material = copy

by = {m.name: m for m in models}
def put(name, x, y, rz=0.0):
    o = by[name]
    o.location = (x, y, 0)
    o.rotation_euler = (0, 0, rz)
    return o

layout = {
    'home_t0': (-16, 17), 'home_t1': (-9.5, 17), 'home_t2': (-1, 17), 'home_t3': (9.5, 17),
    'farm_a': (-14, 1), 'farm_b': (-4.7, 1), 'farm_c': (4.7, 1), 'farm_d': (14, 1),
    'barn': (-15, -15), 'silo': (-9.6, -14), 'windmill': (-5, -14), 'tractor': (-1, -16.5),
    'pond_dock': (17.5, -12.5), 'mailbox': (8.4, -17.5), 'hay_round': (1.6, -13.8), 'stump': (11.5, -17.5),
    'picket_fence': (5.0, -14.5), 'rail_fence': (11.4, -14.5),
}
for name, (x, y) in layout.items():
    put(name, x, y)
rot = by['windmill_rotor']
rot.location = (-5, -14 - .62, 6.25)
rot.rotation_euler = (0, .3, 0)

dups = []
def dup(name, x, y, rz=0.0):
    o = by[name].copy()
    bpy.context.scene.collection.objects.link(o)
    o.location = (x, y, 0)
    o.rotation_euler = (0, 0, rz)
    dups.append(o)
    return o
dup('picket_fence', 7.0, -14.5)
dup('picket_fence', 3.0, -14.5)
dup('rail_fence', 13.9, -14.5)
dup('hay_round', 3.0, -13.4, .5)
dup('mailbox', 7.6, -17.5)

studio('#6FD24A', (1800, 1560))
game_camera((0, 1.0, 2.5), 43)
render(PREVIEW)
print('preview', PREVIEW)

if EXTRA:
    os.makedirs(EXTRA, exist_ok=True)
    cam = bpy.context.scene.camera
    def shot(target, scale, fname, res=(1600, 900)):
        bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = res
        cam.data.ortho_scale = scale
        tx, ty, tz = target
        cam.location = (tx, ty - 25.4, tz + 23.0)
        render(os.path.join(EXTRA, fname))
    shot((-3.5, 17, 3), 30, 'homes.png')
    shot((0, 1, 3), 36, 'farms.png')
    shot((-9, -14.5, 3), 18, 'yard.png')
    shot((7, -15.5, .6), 16, 'props.png')
