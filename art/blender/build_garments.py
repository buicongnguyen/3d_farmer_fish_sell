"""Willowmere's village garments: the 13 clothes of the Finch atelier (wm-garments.glb) and Pip's 4 (wm-kids.glb).

Until now the 13 "outfits" were one torso in 13 colours. Each is a real garment now, modelled on top of the explorer
rig (kit/hero_spec.py) with the framework of Zoo Garden's wearable kit (kit/build_wear.py: shell lathes, sleeves,
sheets, tubes, decals). The same rules apply:

  * one empty per garment at the origin, named `garment_<id>` (`kid_<id>` for Pip); inside it one mesh per hero part
    it follows, named `<node>@body`, `<node>_sleeve_l@arm-left`, `<node>_sleeve_r@arm-right`, `<node>_l@leg-left`,
    `<node>_r@leg-right` (trouser legs and nothing else may follow the legs: a skirt is part of the body and ends
    above the knee, flared wide enough that a full walk stride stays inside it);
  * the main cloth is the material `Hero shirt <id>` (tinted at runtime by the Colour row and by Pip's outfit colour);
    `Hero shirt shade <id>` is its darker tone (ribs, collars, cuffs; drawn at 72% of the colour); every other
    material is fixed (`Wear <id> <name>`: buttons, trims, a blouse under a pinafore);
  * modelled at the chibi hero's size and pivots; the game fits it to every height and build.

Run from the repository root:

    blender -b --factory-startup --python art/blender/build_garments.py -- [--render] [--install] [--only ids] [--debug DIR]

Outputs: art/generated/garments/{wm-garments,wm-kids}.glb, icons (160 px webp) and, with --install, copies the two GLBs
to public/assets/models and the icons to public/assets/icons/items (garment_<id>.webp, kid_<id>.webp).
"""
import json
import math
import os
import shutil
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'kit'))
import build_wear as W  # noqa: E402
from build_wear import (RAD, TAU, UP, ARM_X, ARM_Y, circle, decal, ellipsoid, facing, flower, fluffy_ring, frame, leaf_outline,
                        lathe, on_shell, prism, rect, shell, shell_decal, shell_r, shirt_profile, sheet, slab, sleeve_profile,
                        stag, strap, surface_path, torus, tube, xf, back_r, bow)  # noqa: E402

REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
GEN = os.path.join(REPO, 'art', 'generated', 'garments')
PUB_MODELS = os.path.join(REPO, 'public', 'assets', 'models')
PUB_ICONS = os.path.join(REPO, 'public', 'assets', 'icons', 'items')

# id, name, colour (content.mjs OUTFITS / KID_OUTFITS: the garment's own colour, tinted by the Colour row)
PLAYER = [('meadow', 'Meadow linen tunic', '#849978'), ('harbor', 'Harbor sailor blouse', '#668caa'), ('rose', 'Rose cardigan', '#c77c89'),
          ('honey', 'Honey overalls', '#d4a44f'), ('plum', 'Plum knit jumper', '#8f76a0'), ('clay', "Potter's apron", '#b97052'),
          ('sage', 'Sage gardener vest', '#52968b'), ('midnight', 'Midnight overcoat', '#45546e'), ('ivory', 'Sunday linen shirt', '#e5d5b5'),
          ('coral', 'Summer coral top', '#e78366'), ('fern', 'Woodland jacket', '#527153'), ('festival', 'Festival velvet jacket', '#964e66'),
          ('sky', 'Cloud puff-sleeve blouse', '#a7c4cb')]
KIDS = [('sunny', 'Sunshine pinafore', '#e8b950'), ('rain', 'Puddle-jump coat', '#68a8b7'), ('berry', 'Berry cardigan', '#bf7199'),
        ('party', 'Festival dress', '#a48cc3')]
NODE = {}
COLOUR = {}
for _id, _name, _col in PLAYER:
    NODE[_id] = 'garment_' + _id
for _id, _name, _col in KIDS:
    NODE[_id] = 'kid_' + _id
LABEL = {NODE[i]: n for i, n, _ in PLAYER + KIDS}
HEX = {NODE[i]: c for i, _, c in PLAYER + KIDS}
FILES = {'wm-garments.glb': [NODE[i] for i, _, _ in PLAYER], 'wm-kids.glb': [NODE[i] for i, _, _ in KIDS]}

# the shared framework works on kinds; a garment may follow the body, the arms and (trousers only) the legs
W.KIND.update({n: 'garment' for n in LABEL})
W.LABEL.update(LABEL)
W.TRI_LIMIT['garment'] = 2200
W.ALLOWED_PARTS['garment'] = ('body', 'arm-left', 'arm-right', 'leg-left', 'leg-right')
W.ICON_VIEW['garment'] = dict(heading=-30, elevation=14)
W.ICON_OVERRIDE.update({'garment_midnight': dict(heading=-24), 'kid_party': dict(heading=-26)})
W.ICONS = os.path.join(GEN, 'icons')
W.PREVIEWS = os.path.join(REPO, 'art', 'previews', 'garments')
W.MANIFEST = os.path.join(GEN, 'garments-manifest.json')
GLB_LIMIT = {'wm-garments.glb': 520 * 1024, 'wm-kids.glb': 260 * 1024}


def shade_of(hex_colour, k=0.72):
    v = hex_colour.lstrip('#')
    return '#' + ''.join('%02x' % round(int(v[i:i + 2], 16) * k) for i in (0, 2, 4))


def lighter(hex_colour, k=0.35):
    v = hex_colour.lstrip('#')
    return '#' + ''.join('%02x' % round(int(v[i:i + 2], 16) + (255 - int(v[i:i + 2], 16)) * k) for i in (0, 2, 4))


class Gm(W.Item):
    """A garment: `cloth` and `shade` are the tinted materials, `m` makes fixed ones."""

    def __init__(self, gid):
        self.gid = gid
        super().__init__(NODE[gid])
        self.col = HEX[NODE[gid]]

    def cloth(self, rough=0.55):
        return W.wm(f'Hero shirt {self.id}', self.col, rough)

    def shade(self, rough=0.55):
        return W.wm(f'Hero shirt shade {self.id}', shade_of(self.col), rough)


def maker(fn):
    """Register a builder under its garment node name."""
    def build():
        it = fn()
        return it
    build.__name__ = NODE[fn.__name__.split('_', 1)[1]]
    W.BUILDERS[build.__name__] = build
    return fn


def sleeves_for(it, z_cuff=0.8, r=0.156, cuff=0.012, cuff_h=0.05, puff=0.0, bell=0.0, body=None, cuffm=None, top=None, extra=None):
    W.sleeves(it, sleeve_profile(z_cuff, r, cuff=cuff, cuff_h=cuff_h, bell=bell, puff=puff), stag(cuffm, body, top, extra))
    W.finish_sleeves(it)


def buttons(it, prof, az, zs, material, r=0.016, dome=0.01, lift=0.004):
    for z in zs:
        shell_decal(it, prof, circle(7, r), material, az, z, dome, lift=lift)


def front_band(it, prof, az, z0, z1, material, width=0.026, lift=0.006):
    it.add('body', strap(prof, [(az, z0), (az * 0.9, (z0 + z1) / 2), (az * 0.8, z1)], lift, width, 0.011), material)


def ring(it, part, r, z, minor, material, segs=16, sides=6, dz=0.0):
    it.add(part, torus(r, minor, segs, sides, rz=minor * 0.8).moved((0, 0.0, z)), material)


def pouch(it, prof, material, az0, az1, z_top, z_bot, bulge=0.012, lift=0.014, nu=5, nv=3, front=None):
    rf = shell_r(prof)

    def p(u, v):
        az = az0 + (az1 - az0) * u
        z = z_top + (z_bot - z_top) * v
        r = rf(z) + lift + bulge * math.sin(math.pi * u) + 0.02 * v * (z < 0.5)
        return (r * math.sin(RAD(az)), -r * math.cos(RAD(az)), z)
    it.add('body', sheet(p, nu, nv, 0.018, tag=lambda i, j, fr: material))


def bib(it, prof, material, top_az, bot_az, z_top, z_bot, lift=0.016, nu=6, nv=6, bulge=0.0, edge=None):
    rf = shell_r(prof)

    def p(u, v):
        half = top_az + (bot_az - top_az) * v
        az = -half + 2 * half * u
        z = z_top + (z_bot - z_top) * v
        r = rf(max(z, 0.46)) + lift + bulge * v * v + (0.46 - z) * 0.2 * (z < 0.46)
        return (r * math.sin(RAD(az)), -r * math.cos(RAD(az)), z)
    it.add('body', sheet(p, nu, nv, 0.014, tag=lambda i, j, fr: material))


def hood_down(it, cloth, rim, lift_z=1.14):
    """A hood lying on the shoulders behind the neck (as the kit's hoodie)."""
    prof = [(0.43 + 0.1 * math.cos(TAU * j / 6), lift_z + 0.08 * math.sin(TAU * j / 6)) for j in range(6)]
    it.add('body', lathe(prof, 12, closed=True, arc=(RAD(12), RAD(168)),
                         mod=lambda th, i: (1.0 + 0.14 * math.sin(th) ** 2, 0.02 * math.sin(th)),
                         tag=lambda b, s: rim if b in (2, 3) else cloth))


def trouser_leg(it, x, top, hem, r_top, r_hem, material, cuff_material=None, sides=10):
    """A trouser leg tube on the right leg, mirrored by the caller (follows the leg, stretched to every leg length)."""
    g = tube([(x, 0.0, top), (x, 0.0, hem + 0.06), (x, 0.0, hem)], [r_top, (r_top + r_hem) / 2, r_hem], sides, ang0=TAU / sides / 2,
             cap_start=True, cap_end=True)
    it.add('leg-right', g, material)
    if cuff_material:
        it.add('leg-right', torus(r_hem, 0.022, 14, 6, rz=0.03).moved((x, 0.0, hem + 0.03)), cuff_material)


# ================================================================ the 13 garments of the Finch atelier
@maker
def garment_meadow():
    it = Gm('meadow')
    cloth, shade = it.cloth(), it.shade()
    cream = it.m('stitch', '#FFF1D2', 0.55)
    wood = it.m('toggle', '#C77A3A', 0.5)
    prof = shirt_profile(0.56, 0.036, 0.04, flare_top=0.74, zs=(0.64, 0.72, 0.8, 0.95), bands=[(0.56, 0.6, 0.012), (1.0, 1.035, 0.012)])

    def fn(z, az, b, s):
        if b == -2 or z < 0.6 or 0.995 <= z <= 1.04:
            return shade
        return cloth
    shell(it, prof, fn)
    buttons(it, prof, 0, (0.9, 0.78), wood, 0.019)
    for sx in (-1, 1):                                                           # patch pockets with a stitched edge
        shell_decal(it, prof, rect(0.12, 0.1), shade, 40 * sx, 0.7, 0.008)
        shell_decal(it, prof, rect(0.1, 0.012), cream, 40 * sx, 0.745, 0.004, lift=0.007)
    for sx in (-1, 1):                                                           # laced neck ties
        a, _ = on_shell(prof, 6 * sx, 1.02, 0.014)
        b_, _ = on_shell(prof, 8 * sx, 0.95, 0.02)
        c, _ = on_shell(prof, 9 * sx, 0.9, 0.024)
        it.add('body', tube([a, b_, c], 0.009, 4, cap_start=True, cap_end=True), cream)
    sleeves_for(it, 0.8, 0.156, cuff_h=0.06, body=cloth, cuffm=shade, top=cloth)
    it.note = 'Short linen work tunic (hem at the hip, z 0.56): patch pockets, laced neck; the legs stay bare.'
    return it


@maker
def garment_harbor():
    it = Gm('harbor')
    cloth, shade = it.cloth(), it.shade()
    navy = it.m('collar', '#27406B', 0.5)
    white = it.m('stripe', '#FFFDF7', 0.5)
    red = it.m('tie', '#D8243B', 0.45)
    prof = shirt_profile(0.46, 0.036, 0.025, bands=[(0.46, 0.5, 0.012)])

    def fn(z, az, b, s):
        if b == -2 or z < 0.5:
            return shade
        return cloth
    shell(it, prof, fn)
    rf = shell_r(prof)

    def flap(u, v):                                                              # the square sailor collar over the back
        az = 112 + 136 * u
        z = 1.1 - 0.3 * v
        r = back_r(prof, az, z) + 0.02 + 0.01 * math.sin(math.pi * u)
        return (r * math.sin(RAD(az)), -r * math.cos(RAD(az)), z)
    it.add('body', sheet(flap, 7, 4, 0.016, tag=lambda i, j, fr: navy if (j < 2 or not fr) else white if j == 2 else navy))
    for sx in (-1, 1):                                                           # the V of the collar, front, with its white stripe
        it.add('body', strap(prof, [(34 * sx, 1.1), (22 * sx, 0.99), (6 * sx, 0.87)], 0.013, 0.05, 0.014), navy)
        it.add('body', strap(prof, [(32 * sx, 1.07), (21 * sx, 0.975), (6.5 * sx, 0.865)], 0.024, 0.014, 0.008), white)
    q, nq = on_shell(prof, 0, 0.86, 0.03)
    bow(it, 'body', q, nq, red, red, 0.8)
    it.add('body', prism([(-0.03, 0.0), (0.03, 0.0), (0.012, -0.12), (-0.012, -0.12)], 0.014), red, facing(q, nq) @ xf((0.0, -0.02, 0.0)))
    sleeves_for(it, 0.8, 0.156, cuff_h=0.07, body=cloth, cuffm=navy, top=cloth, extra={3: white})
    it.note = 'Sailor-collar blouse: square back collar, striped V front, red neck tie.'
    return it


@maker
def garment_rose():
    it = Gm('rose')
    cloth, shade = it.cloth(), it.shade()
    tee = it.m('tee', '#FFF1D2', 0.55)
    cream = it.m('button', '#FFF8E8', 0.4)
    prof = shirt_profile(0.42, 0.04, 0.035, bands=[(0.42, 0.5, 0.012)])

    def fn(z, az, b, s):
        if b == -2:
            return tee
        if abs(az) < 12 and z > 0.5:
            return tee
        if z < 0.5:
            return shade
        return cloth
    shell(it, prof, fn)
    for sx in (-1, 1):
        front_band(it, prof, 13 * sx, 0.5, 1.06, shade, 0.026, 0.008)
        pouch(it, prof, shade, 28 * sx, 58 * sx, 0.68, 0.52)
    buttons(it, prof, 13, (0.58, 0.7, 0.82, 0.94), cream, 0.017, 0.012, 0.012)
    sleeves_for(it, 0.8, 0.156, cuff_h=0.075, body=cloth, cuffm=shade, top=cloth)
    it.note = 'Open-front knit cardigan: cream tee showing, four buttons, ribbed hem and cuffs, two pockets.'
    return it


@maker
def garment_honey():
    it = Gm('honey')
    cloth, shade = it.cloth(0.6), it.shade(0.6)
    shirt = it.m('shirt', '#FFF1D2', 0.55)
    gold = it.m('buckle', '#E7B23C', 0.4)
    thread = it.m('stitch', '#FFF1D2', 0.55)
    prof = shirt_profile(0.44, 0.04, 0.02, zs=(0.5, 0.62, 0.7, 0.8, 0.95))

    def fn(z, az, b, s):
        if b == -2:
            return shirt
        if z < 0.7 or (abs(az) < 44 and z < 1.0):
            return cloth
        return shirt
    shell(it, prof, fn)
    for sx in (-1, 1):
        pts = [(30 * sx, 0.99), (50 * sx, 1.11), (100 * sx, 1.14), (150 * sx, 1.0), (168 * sx, 0.82)]
        it.add('body', strap(prof, pts, 0.016, 0.042, 0.013), cloth)
        shell_decal(it, prof, circle(8, 0.024), gold, 33 * sx, 0.97, 0.012, lift=0.022)
    shell_decal(it, prof, rect(0.13, 0.095), shade, 0, 0.84, 0.008, lift=0.012)             # the bib pocket
    shell_decal(it, prof, rect(0.11, 0.012), thread, 0, 0.875, 0.004, lift=0.016)
    for sx in (-1, 1):
        shell_decal(it, prof, rect(0.1, 0.012), thread, 40 * sx, 0.7, 0.004, lift=0.016)
    trouser_leg(it, 0.18, 0.6, 0.2, 0.135, 0.135, cloth, shade)
    it.mirror('leg-right', 'leg-left')
    sleeves_for(it, 0.8, 0.152, cuff_h=0.045, body=shirt, cuffm=shirt, top=shirt)
    it.note = 'Bib overalls over a cream shirt: crossed straps, bib pocket, trouser legs with rolled cuffs.'
    return it


@maker
def garment_plum():
    it = Gm('plum')
    cloth, shade = it.cloth(0.6), it.shade(0.6)
    dark = it.m('leggings', '#4B3C5C', 0.7)
    prof = shirt_profile(0.56, 0.05, 0.04, flare_top=0.74, zs=(0.7, 0.8, 0.88, 0.97),
                         bands=[(0.56, 0.65, 0.026), (0.86, 0.885, 0.01), (0.94, 0.965, 0.01)])

    def fn(z, az, b, s):
        if b == -2 or z < 0.655 or 0.86 <= z <= 0.885 or 0.94 <= z <= 0.965:
            return shade
        return cloth if (s % 2 or z > 0.6) else shade
    shell(it, prof, fn)
    ring(it, 'body', 0.315, 1.105, 0.075, shade, 18, 7)                                       # the roll neck
    trouser_leg(it, 0.18, 0.62, 0.2, 0.11, 0.1, dark, shade)                                  # knit leggings
    it.mirror('leg-right', 'leg-left')
    sleeves_for(it, 0.8, 0.158, cuff=0.02, cuff_h=0.095, puff=0.025, body=cloth, cuffm=shade, top=cloth)
    it.note = 'Cropped chunky knit jumper (hem z 0.56, wide ribbed band) over dark knit leggings: ribbed cuffs, knit bands, roll neck.'
    return it


@maker
def garment_clay():
    it = Gm('clay')
    cloth, shade = it.cloth(0.6), it.shade(0.6)
    shirt = it.m('shirt', '#FFF1D2', 0.55)
    dark = it.m('smudge', '#7B4630', 0.6)
    prof = shirt_profile(0.46, 0.036, 0.02)
    shell(it, prof, lambda z, az, b, s: shirt)
    bib(it, prof, cloth, 21, 62, 1.0, 0.33, 0.02, 7, 7, 0.05)
    for sx in (-1, 1):                                                                        # neck loop over the shoulders
        it.add('body', strap(prof, [(21 * sx, 0.99), (30 * sx, 1.12), (62 * sx, 1.16), (118 * sx, 1.11), (150 * sx, 0.96)], 0.014, 0.032, 0.012), shade)
    it.add('body', strap(prof, [(-64, 0.64), (-100, 0.65), (-150, 0.65), (180, 0.66), (150, 0.65), (100, 0.65), (64, 0.64)], 0.026, 0.04, 0.012), shade)
    r_back = back_r(prof, 180, 0.66) + 0.04
    bow(it, 'body', Vector((0, r_back, 0.66)), Vector((0, 1, 0)), shade, shade, 1.1)
    shell_decal(it, prof, rect(0.15, 0.11), shade, 0, 0.58, 0.008, lift=0.05)               # pocket
    for az, z, r in ((-14, 0.86, 0.035), (16, 0.76, 0.028), (30, 0.5, 0.04)):
        shell_decal(it, prof, circle(7, r), dark, az, z, 0.006, lift=0.04)
    sleeves_for(it, 0.8, 0.152, cuff_h=0.04, body=shirt, cuffm=shirt, top=shirt)
    it.note = "Potter's apron over a cream shirt: bib, pocket, neck loop, waist tie and bow behind."
    return it


@maker
def garment_sage():
    it = Gm('sage')
    cloth, shade = it.cloth(0.6), it.shade(0.6)
    shirt = it.m('shirt', '#FFF1D2', 0.55)
    wood = it.m('handle', '#8A4B25', 0.5)
    steel = it.m('trowel', '#B9C0CC', 0.4)
    brass = it.m('button', '#E7B23C', 0.4)
    prof = shirt_profile(0.44, 0.04, 0.025, bands=[(0.44, 0.48, 0.012)])

    def fn(z, az, b, s):
        if b == -2 or (abs(az) < 11 and z > 0.5):
            return shirt
        if z < 0.485:
            return shade
        return cloth
    shell(it, prof, fn)
    for sx in (-1, 1):
        front_band(it, prof, 11 * sx, 0.5, 1.05, shade, 0.022, 0.008)
    buttons(it, prof, 11, (0.62, 0.78, 0.94), brass, 0.016, 0.01, 0.012)
    pouch(it, prof, shade, -58, -26, 0.8, 0.5, 0.016, 0.016, 5, 4)                           # the tool pocket, trowel poking out
    p, n = on_shell(prof, -42, 0.82, 0.03)
    m = facing(p, n)
    it.add('body', prism([(-0.012, 0.0), (0.012, 0.0), (0.012, 0.09), (-0.012, 0.09)], 0.022), wood, m @ xf((0.0, 0.0, 0.0)))
    it.add('body', prism([(-0.02, 0.09), (0.02, 0.09), (0.0, 0.17)], 0.012), steel, m @ xf((0.0, 0.0, 0.0)))
    ring(it, 'body', 0.325, 1.095, 0.045, shirt, 16, 6)
    sleeves_for(it, 0.8, 0.152, cuff_h=0.05, body=shirt, cuffm=shade, top=shirt)
    it.note = 'Gardener vest over a cream shirt: front placket and buttons, tool pocket with a trowel.'
    return it


@maker
def garment_midnight():
    it = Gm('midnight')
    cloth, shade = it.cloth(0.5), it.shade(0.5)
    gold = it.m('button', '#E7B23C', 0.4)
    prof = shirt_profile(0.3, 0.04, 0.18, flare_top=0.82, zs=(0.36, 0.45, 0.55, 0.7, 0.85, 0.97), bands=[(0.3, 0.34, 0.014)])

    def fn(z, az, b, s):
        if b == -2 or z < 0.34:
            return shade
        if abs(az) < 36 and z > 0.84:
            return shade
        return cloth
    shell(it, prof, fn)
    for sx in (-1, 1):                                                                        # lapels, double row of buttons
        it.add('body', strap(prof, [(38 * sx, 1.1), (24 * sx, 0.98), (9 * sx, 0.8), (7 * sx, 0.5)], 0.013, 0.05, 0.014), shade)
        buttons(it, prof, 12 * sx, (0.9, 0.76, 0.62, 0.48), gold, 0.017, 0.012, 0.016)
        pouch(it, prof, shade, 46 * sx, 74 * sx, 0.55, 0.42, 0.01, 0.016, 4, 2)
    ring(it, 'body', 0.325, 1.105, 0.06, shade, 18, 6)                                        # the stand collar
    it.add('body', torus(shell_r(prof)(0.66) + 0.012, 0.022, 20, 6, rz=0.03).moved((0, 0.0, 0.66)), shade)  # the belt
    shell_decal(it, prof, rect(0.05, 0.04), gold, 0, 0.66, 0.01, lift=0.034)
    for sx in (-1, 1):                                                                        # shoulder straps
        it.add('body', strap(prof, [(60 * sx, 1.1), (75 * sx, 1.03)], 0.016, 0.05, 0.012), shade)
    sleeves_for(it, 0.8, 0.158, cuff=0.014, cuff_h=0.07, bell=0.01, body=cloth, cuffm=shade, top=cloth)
    it.note = 'Long overcoat to z 0.30 (mid-thigh): collar, lapels, double buttons, flap pockets; the flared hem clears a full stride.'
    return it


@maker
def garment_ivory():
    it = Gm('ivory')
    cloth, shade = it.cloth(0.6), it.shade(0.6)
    pearl = it.m('button', '#FFFDF7', 0.35)
    slate = it.m('trousers', '#4F5E73', 0.6)
    prof = shirt_profile(0.6, 0.036, 0.0, zs=(0.7, 0.8, 0.95), bands=[(0.6, 0.63, 0.008)])
    shell(it, prof, lambda z, az, b, s: shade if (b == -2 or z < 0.62) else cloth)
    it.add('body', strap(prof, [(0, 0.63), (0, 0.8), (0, 1.03)], 0.01, 0.032, 0.012), shade)
    buttons(it, prof, 0, (0.7, 0.8, 0.9), pearl, 0.015, 0.01, 0.016)
    trouser_leg(it, 0.18, 0.66, 0.2, 0.125, 0.115, slate, shade)
    it.mirror('leg-right', 'leg-left')
    for sx in (-1, 1):                                                                        # collar points
        q, nq = on_shell(prof, 10 * sx, 1.0, 0.026)
        tri = [(0.0, 0.0), (0.07 * sx, -0.012), (0.02 * sx, -0.1)]
        if sx < 0:
            tri = list(reversed(tri))
        it.add('body', prism(tri, 0.02), shade, facing(q, nq, spin=0) @ xf((0.0, 0.0, 0.0)))
    shell_decal(it, prof, rect(0.1, 0.1), shade, -38, 0.82, 0.006, lift=0.008)
    sleeves_for(it, 0.8, 0.152, cuff_h=0.06, body=cloth, cuffm=shade, top=cloth)
    shell_decal(it, prof, circle(6, 0.012), pearl, -38, 0.84, 0.006, lift=0.016)
    it.note = 'Sunday shirt tucked into slate trousers: collar points, button placket, chest pocket, buttoned cuffs.'
    return it


@maker
def garment_coral():
    it = Gm('coral')
    cloth, shade = it.cloth(0.55), it.shade(0.55)
    white = it.m('dot', '#FFFDF7', 0.5)
    denim = it.m('shorts', '#F4EBD8', 0.6)
    prof = shirt_profile(0.6, 0.038, 0.05, flare_top=0.78, zs=(0.68, 0.8, 0.95), bands=[(0.6, 0.63, 0.01)])

    def fn(z, az, b, s):
        if b == -2:
            return shade
        if z > 1.0 and abs(az) < 50:
            return shade                                                                      # the scoop neck lining
        return cloth
    shell(it, prof, fn)
    it.add('body', fluffy_ring(0.455, 0.615, 0.05, 0.03, 24, 12, amp=0.03, dz=0.014), shade)  # hem frill
    trouser_leg(it, 0.18, 0.64, 0.38, 0.14, 0.14, denim, shade)                                 # short shorts
    it.mirror('leg-right', 'leg-left')
    for az, z in ((-30, 0.76), (-8, 0.88), (24, 0.7), (40, 0.93), (-48, 0.68)):
        shell_decal(it, prof, circle(6, 0.02), white, az, z, 0.006, lift=0.006)
    cap = [(0.17, 0.99), (0.19, 1.045), (0.15, 1.15), (0.0, 1.238)]                           # flutter caps over the shoulders
    it.add('arm-right', lathe(cap, 9, phase=TAU / 18, cap_bottom=True).moved((ARM_X, ARM_Y, 0.0)), cloth)
    it.add('arm-right', lathe([(0.176, 0.97), (0.19, 0.99), (0.17, 1.01)], 9, phase=TAU / 18).moved((ARM_X, ARM_Y, 0.0)), shade)
    W.finish_sleeves(it)
    it.note = 'Sleeveless crop top over cream shorts (the game paints the arms bare): scoop neck, hem frill, flutter caps, dots.'
    return it


@maker
def garment_fern():
    it = Gm('fern')
    cloth, shade = it.cloth(0.6), it.shade(0.6)
    leaf = it.m('leaf patch', '#7FD25A', 0.5)
    brass = it.m('zip', '#E7B23C', 0.4)
    bark = it.m('trousers', '#6B5A3E', 0.65)
    prof = shirt_profile(0.54, 0.04, 0.02, zs=(0.62, 0.8, 0.95), bands=[(0.54, 0.6, 0.014)])

    def fn(z, az, b, s):
        if b == -2 or z < 0.595:
            return shade
        return cloth
    shell(it, prof, fn)
    it.add('body', strap(prof, [(0, 0.6), (0, 0.8), (0, 1.04)], 0.012, 0.022, 0.012), shade)
    shell_decal(it, prof, circle(6, 0.017), brass, 0, 0.98, 0.012, lift=0.014)
    for sx in (-1, 1):
        pouch(it, prof, shade, 28 * sx, 58 * sx, 0.84, 0.66, 0.014, 0.014, 5, 3)
        shell_decal(it, prof, rect(0.14, 0.03), cloth, 43 * sx, 0.84, 0.01, lift=0.034)
    trouser_leg(it, 0.18, 0.62, 0.2, 0.13, 0.12, bark, shade)
    it.mirror('leg-right', 'leg-left')
    shell_decal(it, prof, leaf_outline(0.12, 0.04, 2), leaf, 22, 0.92, 0.006, lift=0.006, spin=-40)
    hood_down(it, cloth, shade)
    ring(it, 'body', 0.32, 1.1, 0.045, shade, 16, 6)
    a = Vector((math.cos(RAD(-35)), 0.0, math.sin(RAD(-35))))
    it.add('arm-right', slab(leaf_outline(0.17, 0.05, 2), 0.02, centre=(0.07, 0.0)), leaf, frame((ARM_X + 0.1, ARM_Y - 0.1, 0.99), a, (0, 1, 0)))
    sleeves_for(it, 0.8, 0.158, cuff=0.012, cuff_h=0.06, body=cloth, cuffm=shade, top=cloth)
    it.note = 'Short zipped woodland jacket (hip length) over bark-brown trousers: hood lying down, flap pockets, leaf patches.'
    return it


@maker
def garment_festival():
    it = Gm('festival')
    cloth, shade = it.cloth(0.4), it.shade(0.4)
    gold = it.m('gold trim', '#F5B21E', 0.38)
    prof = shirt_profile(0.4, 0.04, 0.075, flare_top=0.68, zs=(0.46, 0.55, 0.7, 0.85, 0.97), bands=[(0.4, 0.44, 0.016), (0.94, 0.965, 0.01)])

    def fn(z, az, b, s):
        if 0.4 <= z <= 0.44 or 0.94 <= z <= 0.965:
            return gold
        if b == -2:
            return shade
        return cloth
    shell(it, prof, fn)
    for z in (0.9, 0.76, 0.62):                                                               # frogging: gold bars with knots
        pts = [(-26, z - 0.01), (-12, z + 0.01), (0, z), (12, z + 0.01), (26, z - 0.01)]
        it.add('body', tube(surface_path(prof, pts, 0.014), 0.011, 4, cap_start=True, cap_end=True), gold)
        for sx in (-1, 1):
            shell_decal(it, prof, circle(7, 0.02), gold, 27 * sx, z - 0.01, 0.014, lift=0.012)
    for sx in (-1, 1):
        front_band(it, prof, 27 * sx, 0.45, 1.08, gold, 0.016, 0.01)
    for az, z in ((-62, 0.78), (60, 0.66), (150, 0.8), (-140, 0.62)):
        shell_decal(it, prof, flower(5, 0.06, 0.4, 10), gold, az, z, 0.01, lift=0.006)
    ring(it, 'body', 0.325, 1.105, 0.055, shade, 18, 6)                                       # mandarin collar
    ring(it, 'body', 0.325, 1.075, 0.014, gold, 18, 5)
    sleeves_for(it, 0.8, 0.158, cuff=0.014, cuff_h=0.07, body=cloth, cuffm=gold, top=cloth, extra={3: shade})
    it.note = 'Velvet festival jacket: gold hem and cuffs, three pairs of gold frogging, collar, flower trim.'
    return it


@maker
def garment_sky():
    it = Gm('sky')
    cloth, shade = it.cloth(0.55), it.shade(0.55)
    white = it.m('cloud', '#FFFDF7', 0.5)
    ribbon = it.m('ribbon', '#FFFDF7', 0.5)
    prof = shirt_profile(0.56, 0.036, 0.0, zs=(0.66, 0.8, 0.95), bands=[(0.56, 0.59, 0.01), (0.99, 1.02, 0.012)])
    shell(it, prof, lambda z, az, b, s: shade if (b == -2 or 0.56 <= z <= 0.59 or 0.99 <= z <= 1.02) else cloth)
    navy = it.m('skirt', '#5C7FA3', 0.6)
    it.add('body', lathe([(0.66, 0.4), (0.61, 0.44), (0.54, 0.5), (0.46, 0.55), (0.4, 0.6)], 20, phase=TAU / 40, tag=lambda b, s: navy if s % 2 else shade))  # pleated skirt
    it.add('body', fluffy_ring(0.325, 1.085, 0.045, 0.03, 20, 10, amp=0.03, dz=0.012), shade)  # ruffled collar
    q, nq = on_shell(prof, 0, 1.0, 0.04)
    bow(it, 'body', q, nq, ribbon, ribbon, 0.85)
    for cx, cz, r in ((-0.0, 0.8, 0.045), (0.06, 0.78, 0.035), (-0.06, 0.78, 0.035)):         # an embroidered cloud
        shell_decal(it, prof, circle(8, r), white, cx * 300, cz, 0.008, lift=0.006)
    sleeves_for(it, 0.84, 0.158, cuff=0.014, cuff_h=0.05, puff=0.07, body=cloth, cuffm=shade, top=cloth)
    it.note = 'Puff-sleeve blouse over a pleated blue skirt: round ruffled collar with a bow, elastic cuffs, embroidered cloud.'
    return it


# ================================================================ Pip's four
def scallop(r, z, rr, rz, segs, bumps, amp, dz, tag=None):
    return fluffy_ring(r, z, rr, rz, segs, bumps, amp=amp, dz=dz, tag=tag)


@maker
def garment_sunny():
    it = Gm('sunny')
    cloth, shade = it.cloth(0.55), it.shade(0.55)
    blouse = it.m('blouse', '#FFFDF7', 0.55)
    brass = it.m('button', '#FFF8E8', 0.4)
    prof = shirt_profile(0.36, 0.04, 0.13, flare_top=0.78, zs=(0.45, 0.55, 0.7, 0.85, 0.97), bands=[(0.36, 0.4, 0.012)])

    def fn(z, az, b, s):
        if b == -2:
            return blouse
        if z < 0.78 or (abs(az) < 30 and z < 1.0):
            return shade if z < 0.4 else cloth
        return blouse
    shell(it, prof, fn)
    for sx in (-1, 1):                                                                        # wide crossing straps
        pts = [(24 * sx, 0.99), (46 * sx, 1.11), (96 * sx, 1.14), (140 * sx, 1.05), (172 * sx, 0.95), (-176 * sx, 0.84), (-152 * sx, 0.74)]
        it.add('body', strap(prof, pts, 0.016, 0.05, 0.013), cloth)
        shell_decal(it, prof, circle(8, 0.022), brass, 26 * sx, 0.96, 0.012, lift=0.024)
    shell_decal(it, prof, rect(0.12, 0.1), shade, 0, 0.84, 0.008, lift=0.014)
    shell_decal(it, prof, rect(0.1, 0.012), brass, 0, 0.88, 0.004, lift=0.018)
    it.add('body', fluffy_ring(0.325, 1.08, 0.04, 0.03, 18, 9, amp=0.03, dz=0.01), blouse)
    sleeves_for(it, 0.98, 0.158, cuff=0.014, cuff_h=0.05, puff=0.07, body=blouse, cuffm=blouse, top=blouse)
    it.note = 'Sleeveless A-line pinafore with crossing straps and a bib pocket over a short puff-sleeve blouse (arms bare).'
    return it


@maker
def garment_rain():
    it = Gm('rain')
    cloth, shade = it.cloth(0.45), it.shade(0.45)
    lining = it.m('lining', '#F3D255', 0.5)
    wood = it.m('toggle', '#C77A3A', 0.5)
    cord = it.m('loop', '#3A3D4A', 0.5)
    prof = shirt_profile(0.38, 0.042, 0.1, flare_top=0.74, zs=(0.45, 0.55, 0.7, 0.85, 0.97), bands=[(0.38, 0.41, 0.012)])
    shell(it, prof, lambda z, az, b, s: shade if (b == -2 or z < 0.41) else cloth)
    for z in (0.9, 0.74, 0.58):                                                               # toggles with loops
        a, _ = on_shell(prof, -10, z, 0.02)
        p, n = on_shell(prof, 8, z, 0.032)
        it.add('body', tube([a, a + (p - a) * 0.5, p], 0.008, 4, cap_start=True, cap_end=True), cord)
        it.add('body', tube([p + Vector((0, 0, 0.04)), p + Vector((0, 0, -0.04))], 0.014, 6, cap_start=True, cap_end=True), wood)
    it.add('body', strap(prof, [(0, 0.4), (0, 0.8), (0, 1.04)], 0.01, 0.014, 0.01), lining)
    for sx in (-1, 1):
        pouch(it, prof, shade, 28 * sx, 62 * sx, 0.7, 0.5, 0.014, 0.016, 5, 3)
        shell_decal(it, prof, rect(0.15, 0.03), lining, 45 * sx, 0.7, 0.008, lift=0.036)
    hood_down(it, cloth, lining, 1.14)
    sleeves_for(it, 0.8, 0.16, cuff=0.014, cuff_h=0.055, body=cloth, cuffm=lining, top=cloth)
    it.note = 'Hooded rain coat (hood resting at the back): three wooden toggles, flap pockets, yellow lining at cuffs and hood.'
    return it


@maker
def garment_berry():
    it = Gm('berry')
    cloth, shade = it.cloth(0.6), it.shade(0.6)
    tee = it.m('tee', '#FFF1D2', 0.55)
    cream = it.m('button', '#FFF8E8', 0.4)
    prof = shirt_profile(0.4, 0.04, 0.06, bands=[(0.4, 0.48, 0.012)])

    def fn(z, az, b, s):
        if b == -2 or (abs(az) < 12 and z > 0.48):
            return tee
        if z < 0.48:
            return shade
        return cloth
    shell(it, prof, fn)
    for sx in (-1, 1):
        front_band(it, prof, 13 * sx, 0.48, 1.06, shade, 0.026, 0.008)
    buttons(it, prof, 13, (0.56, 0.68, 0.8, 0.92, 1.02), cream, 0.016, 0.012, 0.012)
    pouch(it, prof, shade, -58, -30, 0.7, 0.54, 0.012, 0.014, 4, 3)
    sleeves_for(it, 0.8, 0.158, cuff_h=0.07, body=cloth, cuffm=shade, top=cloth)
    it.note = 'Open knit cardigan: five cream buttons, ribbed hem and cuffs, a pocket, cream tee.'
    return it


@maker
def garment_party():
    it = Gm('party')
    cloth, shade = it.cloth(0.45), it.shade(0.45)
    cream = it.m('trim', '#FFF1D2', 0.5)
    gold = it.m('gold', '#F5B21E', 0.4)
    prof = shirt_profile(0.5, 0.036, 0.0, zs=(0.58, 0.68, 0.8, 0.95), bands=[(0.57, 0.605, 0.012)])
    shell(it, prof, lambda z, az, b, s: shade if (b == -2 or 0.57 <= z <= 0.605) else cloth)
    # the flared tiered skirt: two scalloped tiers, part of the body and ending above the knee
    skirt1 = [(0.55, 0.36), (0.52, 0.39), (0.48, 0.46), (0.43, 0.54), (0.4, 0.57)]
    skirt2 = [(0.6, 0.3), (0.57, 0.33), (0.52, 0.4), (0.46, 0.47), (0.42, 0.5)]
    for sk, tint in ((skirt2, shade), (skirt1, cloth)):
        it.add('body', lathe(sk, 24, phase=TAU / 48, tag=lambda b, s, t=tint: t,
                             mod=lambda th, i: (1.0 + (0.02 * math.cos(12 * th) if i <= 1 else 0.0), 0.01 * math.cos(12 * th) if i <= 1 else 0.0)))
    for az in range(0, 360, 30):
        shell_decal(it, prof, circle(5, 0.016), gold, az if az <= 180 else az - 360, 0.585, 0.008, lift=0.02)
    for az, z in ((-30, 0.4), (10, 0.36), (45, 0.44), (-70, 0.46), (80, 0.34)):                # little star trim on the skirt
        r = 0.5
        d = Vector((math.sin(RAD(az)), -math.cos(RAD(az)), 0.0))
        p = d * r + Vector((0, 0, z))
        it.add('body', decal(W.star(5, 0.035, 0.015), 0.008), gold, facing(p, d + Vector((0, 0, 0.5)), up=(0, 0, 1)))
    r_back = back_r(prof, 180, 0.6) + 0.04
    bow(it, 'body', Vector((0, r_back, 0.6)), Vector((0, 1, 0)), cloth, shade, 1.25)           # the back bow with ribbons
    for sx in (-1, 1):
        it.add('body', tube([Vector((0.03 * sx, r_back + 0.02, 0.58)), Vector((0.07 * sx, r_back + 0.05, 0.46)), Vector((0.1 * sx, r_back + 0.07, 0.34))],
                            [(0.03, 0.008), (0.03, 0.008), (0.03, 0.008)], 4, cap_end=True, ref=(0, 1, 0)), shade)
    shell_decal(it, prof, flower(5, 0.05, 0.4, 10), cream, 0, 0.92, 0.01, lift=0.01)
    shell_decal(it, prof, circle(6, 0.016), gold, 0, 0.92, 0.008, lift=0.02)
    ring(it, 'body', 0.325, 1.085, 0.03, cream, 18, 5)
    sleeves_for(it, 0.98, 0.158, cuff=0.014, cuff_h=0.05, puff=0.075, body=cloth, cuffm=cream, top=cloth)
    it.note = 'Festival dress: bodice, puff sleeves, two scalloped skirt tiers ending above the knee, back bow, star trim (arms bare).'
    return it


# ================================================================ contract
def check(gid, stats, entry):
    errors = []
    s = stats
    if s['triangles'] > W.TRI_LIMIT['garment']:
        errors.append(f"{s['triangles']} triangles > {W.TRI_LIMIT['garment']}")
    names = [p['name'] for p in s['pieces']]
    for p in s['pieces']:
        if not p['name'].endswith('@' + p['part']) or not p['name'].startswith(gid):
            errors.append(f"piece name {p['name']}")
        cx = (p['bounds']['min'][0] + p['bounds']['max'][0]) / 2
        if p['part'].endswith('-left') and cx >= 0:
            errors.append(f"{p['name']} sits on the right")
        if p['part'].endswith('-right') and cx <= 0:
            errors.append(f"{p['name']} sits on the left")
        if p['part'].startswith('leg') and p['bounds']['min'][2] < 0.12:
            errors.append(f"{p['name']} reaches z {p['bounds']['min'][2]}: a leg piece must stop above the shoes")
    parts = [p['part'] for p in s['pieces']]
    if 'body' not in parts:
        errors.append('no @body piece')
    if ('arm-left' in parts) != ('arm-right' in parts) or ('leg-left' in parts) != ('leg-right' in parts):
        errors.append('one-sided pieces')
    if f'Hero shirt {gid}' not in s['materials']:
        errors.append('no tintable cloth (Hero shirt <id>) material')
    body = next((p for p in s['pieces'] if p['part'] == 'body'), None)
    if body and body['bounds']['min'][2] < 0.2:
        errors.append(f"the body piece reaches z {body['bounds']['min'][2]} (skirts and coats must end above the knee, z >= 0.2)")
    return errors


def build_all(only=None):
    W.reset_scene()
    ids = [n for f in FILES.values() for n in f if not only or n in only]
    entries = {n: W.realise(W.BUILDERS[n]()) for n in ids}
    stats, failures = {}, []
    for n in ids:
        stats[n] = W.item_stats(entries[n])
        entries[n]['stats'] = stats[n]
        failures += [f'{n}: {e}' for e in check(n, stats[n], entries[n])]
    return entries, stats, failures


def preview(entries, hero, out_name, ids, cell=(220, 300), cols=6):
    cells = [([i], f"{W.LABEL[i]}  {entries[i]['stats']['triangles']}", ((0, 0, 1.0), 2.85, 30, 12)) for i in ids]
    cells += [([i], 'back', ((0, 0, 1.0), 2.85, 150, 14)) for i in ids]
    W.render_grid(entries, hero, cells, cell, cols, os.path.join(W.PREVIEWS, out_name), ground='#8FDC6A')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opts = dict(render='--render' in argv, install='--install' in argv, debug=None, only=None, icons='--no-icons' not in argv)
    if '--debug' in argv:
        opts['debug'] = argv[argv.index('--debug') + 1]
    if '--only' in argv:
        opts['only'] = [NODE.get(x, x) for x in argv[argv.index('--only') + 1].split(',')]
    entries, stats, failures = build_all(opts['only'])
    for n, s in stats.items():
        parts = ', '.join(f"{p['part']} {p['triangles']}" for p in s['pieces'])
        print(f"  {n:18s} {s['triangles']:5d} tris  [{parts}]  {len(s['materials'])} mats")
    manifest = dict(generator='art/blender/build_garments.py', blender=bpy.app.version_string, items=stats, files={})
    if not opts['only']:
        for fname, ids in FILES.items():
            objs = []
            for n in ids:
                objs.append(entries[n]['empty'])
                objs += [o for _, o in entries[n]['pieces']]
            path = os.path.join(GEN, fname)
            size = W.export_wear(objs, path)
            manifest['files'][fname] = dict(bytes=size, items=ids, triangles=sum(stats[i]['triangles'] for i in ids))
            print(f'  {fname} {size} bytes ({size / 1024:.1f} KB)')
            if size > GLB_LIMIT[fname]:
                failures.append(f'{fname} is {size} bytes (> {GLB_LIMIT[fname]})')
    if opts['icons']:
        sizes = W.render_icons(entries, list(entries))
        manifest['icons'] = sizes
        print('  icons', len(sizes), 'largest', max(sizes.values()))
        if opts['debug']:
            W.contact_sheet(list(entries), os.path.join(opts['debug'], 'garment-icons.webp'))
    if opts['render']:
        hero, _ = W.load_hero()
        ids = list(entries)
        for fname, group in FILES.items():
            g = [i for i in group if i in entries]
            if g:
                preview(entries, hero, fname.replace('.glb', '.webp'), g, cols=min(6, len(g)))
    W.save_manifest(manifest)
    if failures:
        raise RuntimeError('Garment contract failures:\n  ' + '\n  '.join(failures))
    if opts['install'] and not opts['only']:
        for fname in FILES:
            shutil.copy2(os.path.join(GEN, fname), os.path.join(PUB_MODELS, fname))
        for n in entries:
            shutil.copy2(os.path.join(W.ICONS, n + '.webp'), os.path.join(PUB_ICONS, n + '.webp'))
        print('installed', len(FILES), 'models and', len(entries), 'icons')
    print('\nGarments OK')


if __name__ == '__main__':
    main()
