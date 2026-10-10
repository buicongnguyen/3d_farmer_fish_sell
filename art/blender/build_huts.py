"""The rescue huts: twelve small houses, one for every land that has a boss, each in its land's style.

Run:  blender --background --factory-startup --python art/blender/build_huts.py
Writes public/assets/models/rescue-huts.glb and art/previews/rescue-huts.webp.

Contract (glTF, Y up, front faces +Z, origin = ground centre, metres, the game's own scale: the player is about 2.3 m tall).
Every hut has the SAME front: the wall plane at z = +FRONT, a doorway (dark) left of centre and a barred window right of
centre, so one door, one bar and one captive fit them all (src/rescue-view.mjs holds the same numbers):
  hut_<style>     the hut and its ground patch, one mesh        styles: mushroom cottage blocks stilt adobe gingerbread
                                                                treehut igloo shack lavastone cloud lantern
  hut_door        a plank door; ORIGIN = ITS HINGE (the left edge, on the ground); the game stands it at HINGE and turns it
                  about Y to open it
  hut_bar         the beam and padlock across the shut door, in the door's own space (same origin)
  hut_captive     a little bust behind the window bars, in the hut's space. Materials 'Captive skin', 'Captive hair',
                  'Captive shirt', 'Captive eye': the game repaints hair and shirt for the person held
All colours are flat materials: the game bakes them into vertex colours and draws a hut as two meshes.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from style import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'models', 'rescue-huts.glb')
PREVIEW = os.path.join(ROOT, 'art', 'previews', 'rescue-huts.webp')

FRONT = 1.3                       # the front wall plane (Blender -Y)
DOOR_X, DOOR_W, DOOR_H = -.72, .95, 1.8
WIN_X, WIN_Z, WIN_W, WIN_H = .74, 1.4, .9, .8
HINGE = (DOOR_X - DOOR_W / 2, -FRONT - .1, 0)

reset_scene()
_m = {}
def M(hex_or_name):
    key = PALETTE.get(hex_or_name, hex_or_name).upper()
    if key not in _m:
        _m[key] = mat('Hut ' + key, key, .7)
    return _m[key]

def B(size, loc, color, bev=0, rot=(0, 0, 0)):
    return box('p', size, loc, M(color), bev, 1, rot)
def C(r, h, loc, color, verts=12, top=None, rot=(0, 0, 0)):
    return cyl('p', r, h, loc, M(color), verts, 0, 1, rot, top)
def K(r, h, loc, color, verts=12, rot=(0, 0, 0)):
    return cone('p', r, h, loc, M(color), verts, rot)
def S(r, loc, color, scale=None, segs=12, rings=6):
    return sphere('p', r, loc, M(color), segs, rings, scale)

def facade(wall, trim, patch, bars='iron', slab=True):
    """The shared front: an optional wall slab, the dark doorway in a frame, the barred window, the ground patch."""
    f = -FRONT
    out = [C(2.05, .04, (0, -.15, .02), patch, 16)]
    if slab:
        out.append(B((2.9, .16, 2.25), (0, f + .08, 1.125), wall))
    out.append(B((DOOR_W, .06, DOOR_H), (DOOR_X, f - .02, DOOR_H / 2), '#2A1D24'))
    for sx in (-1, 1):
        out.append(B((.12, .14, DOOR_H + .1), (DOOR_X + sx * (DOOR_W / 2 + .06), f - .04, (DOOR_H + .1) / 2), trim))
    out.append(B((DOOR_W + .34, .16, .14), (DOOR_X, f - .04, DOOR_H + .12), trim))
    out.append(B((.7, .5, .08), (DOOR_X, f - .28, .04), trim))                      # the doorstep
    out.append(B((WIN_W, .06, WIN_H), (WIN_X, f - .02, WIN_Z), '#2A1D24'))
    for sz in (-1, 1):
        out.append(B((WIN_W + .26, .16, .12), (WIN_X, f - .05, WIN_Z + sz * (WIN_H / 2 + .05)), trim))
    for sx in (-1, 1):
        out.append(B((.12, .14, WIN_H), (WIN_X + sx * (WIN_W / 2 + .06), f - .04, WIN_Z), trim))
    for dx in (-.27, .27):
        out.append(C(.03, WIN_H, (WIN_X + dx, f - .2, WIN_Z), bars, 5))
    return out

def gable(w, d, h, z, color, over=.2):
    """A gable roof along X (ridge runs front to back is avoided: the ridge is left-right, so the front shows a slope)."""
    out = []
    slope = math.atan2(h, d / 2 + over)
    length = math.hypot(h, d / 2 + over)
    for sy in (-1, 1):
        out.append(B((w + over * 2, length, .14), (0, sy * (d / 2 + over) / 2, z + h / 2), color, 0, (sy * -slope, 0, 0)))
    return out

huts = {}
def hut(style, parts):
    huts[style] = join(parts, 'hut_' + style)

# 1 Mushroom Forest: a fat stem under a red spotted cap
p = facade('cream', 'wood_dark', '#5FB548')
p += [C(1.32, 2.0, (0, .1, 1.0), 'cream', 14, 1.2), S(1.85, (0, .25, 2.45), 'red', (1, 1, .62), 16, 8), C(1.6, .12, (0, .25, 2.43), '#FFE2C4', 14)]
for a, r, z, s in ((20, 1.0, 3.3, .28), (140, 1.1, 3.22, .3), (255, 1.05, 3.26, .26), (320, .4, 3.52, .24), (80, 1.5, 2.85, .22), (200, 1.52, 2.82, .24), (290, 1.52, 2.82, .2)):
    p.append(S(s, (math.cos(math.radians(a)) * r, .25 + math.sin(math.radians(a)) * r, z), 'white', (1, 1, .45), 8, 4))
p += [S(.3, (-1.75, -1.2, .16), 'red', (1, 1, .7), 8, 4), C(.1, .2, (-1.75, -1.2, .08), 'cream', 6)]
hut('mushroom', p)

# 2 Blue Lake Meadow: a white cottage with a blue roof, a chimney and a flower box
p = facade('white', 'navy', '#5FB548')
p += [B((2.9, 2.5, 2.2), (0, .05, 1.1), 'white', .04)] + gable(2.9, 2.6, 1.05, 2.2, 'sky')
p += [B((2.9, .12, .95), (0, -1.2, 2.55), 'white', 0, (0, 0, 0)), B((.42, .42, 1.0), (.95, .55, 3.0), 'stone_light'), B((.52, .52, .12), (.95, .55, 3.5), 'stone_dark')]
p += [B((1.0, .22, .18), (WIN_X, -FRONT - .16, WIN_Z - WIN_H / 2 - .2), 'wood')]
for i, c in enumerate(('rose', 'sun', 'blossom')):
    p.append(S(.11, (WIN_X - .3 + i * .3, -FRONT - .18, WIN_Z - WIN_H / 2 - .06), c, None, 6, 4))
hut('cottage', p)

# 3 Toybox Land: stacked building blocks
p = facade('red', 'sun', '#E9C46A')
p += [B((2.9, 2.5, 2.2), (0, .05, 1.1), 'red', .08), B((1.5, 1.5, 1.0), (-.6, .1, 2.7), 'sun', .08), K(1.15, 1.0, (-.6, .1, 3.7), 'leaf', 4, (0, 0, math.radians(45)))]
p += [C(.55, 1.0, (.85, .1, 2.7), 'sky', 12), K(.62, .8, (.85, .1, 3.6), 'violet', 12), B((.5, .5, .5), (1.75, -1.0, .25), 'tangerine', .05, (0, 0, .4)), S(.24, (-1.8, -1.1, .24), 'sky', None, 8, 5)]
for x in (-1.0, 0, 1.0):
    p.append(C(.16, .1, (x, -.9, 2.25), '#C92F2F', 8))
hut('blocks', p)

# 4 Chomper Swamp: a reed hut on stilts under a thatch roof
p = facade('#8FA55A', 'wood_dark', '#6B7F3A')
p += [B((2.9, 2.5, 2.1), (0, .05, 1.15), '#8FA55A'), B((3.3, 2.9, .14), (0, .05, .07), 'wood'), K(2.2, 1.3, (0, .25, 3.0), 'straw_dark', 8), K(1.3, .7, (0, .25, 3.6), 'straw', 8)]
for sx in (-1, 1):
    for sy in (-1, 1):
        p.append(C(.11, 2.5, (sx * 1.52, .05 + sy * 1.32, 1.25), 'wood_dark', 6))
for x, y, h in ((-1.85, -1.0, .9), (-1.7, -1.2, .7), (1.8, -1.1, 1.0), (1.95, -.9, .75)):
    p += [C(.03, h, (x, y, h / 2), 'leaf_dark', 4), C(.06, .22, (x, y, h), 'soil', 5)]
hut('stilt', p)

# 5 Redrock Canyon: a round-cornered adobe with roof beams and a cactus
p = facade('#D98A56', '#8A4B25', '#D9A066')
p += [B((2.9, 2.5, 2.3), (0, .05, 1.15), '#D98A56', .2), B((3.0, 2.6, .3), (0, .05, 2.4), '#C7733F', .12), B((2.5, 2.1, .12), (0, .05, 2.5), '#B8642F')]
for x in (-1.1, -.37, .37, 1.1):
    p.append(C(.09, .5, (x, -FRONT - .1, 2.12), 'wood_dark', 6, None, (math.radians(90), 0, 0)))
p += [C(.2, .28, (1.8, -1.0, .14), '#B8642F', 8), C(.13, .7, (1.8, -1.0, .6), 'leaf', 7), S(.13, (1.8, -1.0, .95), 'leaf', None, 7, 4), C(.07, .3, (1.96, -1.0, .62), 'leaf', 5, None, (0, math.radians(60), 0)), S(.07, (1.8, -1.0, 1.1), 'rose', None, 5, 3)]
hut('adobe', p)

# 6 Candy Land: gingerbread walls, icing roof, sweets
p = facade('#B5723B', 'white', '#F7B7D2')
p += [B((2.9, 2.5, 2.2), (0, .05, 1.1), '#B5723B', .06)] + gable(2.9, 2.6, 1.15, 2.2, 'white', .28)
p += [B((2.9, .12, 1.0), (0, -1.2, 2.6), '#B5723B')]
for i, x in enumerate((-1.3, -.65, 0, .65, 1.3)):
    p.append(S(.14, (x, -FRONT - .32, 2.24), ('rose', 'sun', 'mint', 'sky', 'tangerine')[i], None, 7, 4))
for sx in (-1, 1):
    p += [C(.09, 1.6, (sx * 1.62, -FRONT - .1, .8), 'white', 7), S(.2, (sx * 1.62, -FRONT - .1, 1.72), 'red', None, 8, 5)]
    for z in (.3, .7, 1.1):
        p.append(C(.095, .14, (sx * 1.62, -FRONT - .1, z), 'red', 7))
p += [C(.3, .08, (0, -FRONT - .1, 2.75), 'rose', 10, None, (math.radians(90), 0, 0)), C(.14, .1, (0, -FRONT - .12, 2.75), 'white', 8, None, (math.radians(90), 0, 0))]
hut('gingerbread', p)

# 7 Wild Jungle: a hollow tree under a leaf canopy
p = facade('wood', 'wood_dark', '#3F9A3A')
p += [C(1.45, 2.5, (0, .1, 1.25), 'bark', 12, 1.2), C(1.7, .5, (0, .1, .25), 'bark', 12, 1.45)]
for x, y, z, r, c in ((0, .1, 3.3, 1.5, 'leaf'), (-1.1, .2, 2.9, 1.05, 'leaf_dark'), (1.15, 0, 2.95, 1.1, 'leaf_light'), (.2, -.8, 2.85, .9, 'leaf_light'), (0, 1.0, 2.9, 1.0, 'leaf_dark')):
    p.append(S(r, (x, y, z), c, (1, 1, .72), 10, 5))
p += [C(.04, 1.5, (-1.5, -1.05, 1.9), 'leaf_dark', 4), C(.04, 1.1, (1.62, -.9, 2.1), 'leaf_dark', 4), S(.14, (1.62, -.9, 1.5), 'sun', None, 6, 4), S(.12, (-.4, -1.15, 3.1), 'tangerine', None, 6, 4)]
hut('treehut', p)

# 8 Frost Land: an igloo with an ice doorway
p = facade('snow', '#7FC8F0', '#E8F4FF', 'stone_dark')
p += [S(1.75, (0, .15, .0), 'snow', (1, 1, 1.4), 16, 10), C(1.85, .3, (0, .15, .15), '#D6ECFA', 16)]
for a in range(0, 360, 45):
    p.append(B((.5, .06, .03), (math.cos(math.radians(a)) * 1.52, .15 + math.sin(math.radians(a)) * 1.52, 1.25), '#BBDDF2', 0, (0, 0, math.radians(a + 90))))
p += [K(.14, .5, (1.75, -1.05, .25), '#9FDFFF', 5), K(.1, .34, (1.95, -.85, .17), '#9FDFFF', 5), S(.3, (-1.85, -1.0, .2), 'snow', (1, 1, .7), 8, 4)]
hut('igloo', p)

# 9 Shell Beach: a plank shack with a striped slanted roof and a life ring
p = facade('wood_light', 'teal', '#F2DDA0')
p += [B((2.9, 2.5, 2.2), (0, .05, 1.1), 'wood_light')]
for i in range(6):
    p.append(B((.56, 3.1, .12), (-1.4 + i * .56, .05, 2.5), ('teal', 'white')[i % 2], 0, (math.radians(-12), 0, 0)))
p += [torus('ring', .26, .08, (0, -FRONT - .12, 2.0), M('red'), 10, 5, (math.radians(90), 0, 0))] if False else [C(.3, .1, (.0, -FRONT - .1, 2.02), 'red', 10, None, (math.radians(90), 0, 0)), C(.15, .12, (.0, -FRONT - .11, 2.02), 'white', 8, None, (math.radians(90), 0, 0))]
p += [B((.34, .07, 1.7), (1.85, -1.0, .9), 'sun', .03, (math.radians(-12), 0, 0)), B((.1, .08, 1.7), (1.85, -1.03, .9), 'tangerine', 0, (math.radians(-12), 0, 0)), S(.2, (-1.8, -1.15, .1), '#FFB7C5', (1, 1, .5), 8, 4)]
hut('shack', p)

# 10 Ember Fields: black stone with glowing cracks
p = facade('charcoal', '#FF8A2A', '#4A3A3A', '#FFB347')
p += [B((2.9, 2.5, 2.2), (0, .05, 1.1), 'charcoal', .1), K(2.35, 1.3, (0, .05, 2.85), '#2B2E3A', 4, (0, 0, math.radians(45))), S(.3, (0, .05, 3.45), 'lava', None, 8, 5)]
for x, z, w, r in ((-1.3, 1.9, .5, .5), (.1, 2.05, .6, -.3), (1.25, .5, .45, .9), (-.1, 2.0, .3, 1.2)):
    p.append(B((w, .04, .07), (x, -FRONT - .0, z), 'lava', 0, (0, r, 0)))
for sx in (-1, 1):
    p.append(B((.04, .6, .07), (sx * 1.46, .2, 1.3), 'lava', 0, (sx * .5, 0, 0)))
p += [S(.36, (1.8, -1.0, .2), 'charcoal', (1, 1, .7), 6, 4), S(.22, (-1.85, -1.1, .12), '#2B2E3A', (1, 1, .7), 6, 4), S(.1, (1.8, -1.0, .44), 'lava', None, 5, 3)]
hut('lavastone', p)

# 11 Cloud Meadow: a house made of cloud, with a gold star
p = facade('white', 'sky_light', '#EAF6FF', '#F5B21E')
for x, y, z, r in ((0, .2, 1.3, 1.6), (-1.05, .3, 1.0, 1.15), (1.1, .25, 1.05, 1.2), (-.5, .1, 2.35, 1.1), (.6, .2, 2.45, 1.05), (0, .9, 1.6, 1.3)):
    p.append(S(r, (x, y, z), 'white', (1, 1, .85), 12, 6))
p += [S(.5, (-1.7, -.9, .35), 'white', (1, 1, .7), 8, 4), S(.42, (1.75, -1.0, .3), 'white', (1, 1, .7), 8, 4), K(.3, .5, (0, .15, 3.7), 'sun', 5), K(.3, .5, (0, .15, 3.42), 'sun', 5, (math.radians(180), 0, 0))]
hut('cloud', p)

# 12 Night Land: a six-sided lantern house
p = facade('#2B2F5E', '#F5B21E', '#3A3560', '#F5B21E')
p += [C(1.5, 2.3, (0, .1, 1.15), '#2B2F5E', 6), C(1.62, .14, (0, .1, 2.34), '#F5B21E', 6), K(1.85, 1.0, (0, .2, 2.95), '#6B4BD8', 6), K(1.0, .7, (0, .2, 3.6), '#8E6BFF', 6), S(.16, (0, .2, 4.02), 'sun', None, 6, 4)]
for a in (60, 120, 180, 240, 300):
    p.append(B((.7, .06, 1.0), (math.cos(math.radians(a + 90)) * 1.31, .1 + math.sin(math.radians(a + 90)) * 1.31, 1.35), 'honey', 0, (0, 0, math.radians(a))))
p += [C(.03, 1.5, (1.95, -1.0, .75), '#F5B21E', 5), B((.3, .04, .04), (1.82, -1.0, 1.5), '#F5B21E'), B((.2, .2, .28), (1.7, -1.0, 1.3), 'honey'), K(.17, .14, (1.7, -1.0, 1.5), '#6B4BD8', 4)]
hut('lantern', p)

# ---------------------------------------------------------------- the door, its bar, the captive
door = [B((DOOR_W, .09, DOOR_H), (DOOR_W / 2, 0, DOOR_H / 2), 'wood', .02)]
for i in range(1, 4):
    door.append(B((.02, .1, DOOR_H - .1), (DOOR_W * i / 4, -.005, DOOR_H / 2), 'wood_dark'))
for z in (.3, DOOR_H - .3):
    door.append(B((DOOR_W - .06, .11, .1), (DOOR_W / 2, -.01, z), 'iron'))
door.append(S(.06, (DOOR_W - .14, -.08, DOOR_H / 2 + .05), 'gold', None, 6, 4))
door_obj = join(door, 'hut_door')
bar = [B((DOOR_W + .5, .1, .16), (DOOR_W / 2, -.1, DOOR_H / 2 - .12), 'wood_dark', .02)]
for sx in (0, 1):
    bar.append(B((.1, .16, .34), (-.2 + sx * (DOOR_W + .4), -.08, DOOR_H / 2 - .12), 'iron'))
bar += [B((.3, .1, .26), (DOOR_W / 2, -.18, DOOR_H / 2 - .16), 'gold', .03), torus('shackle', .1, .028, (DOOR_W / 2, -.18, DOOR_H / 2 + .0), M('stone_dark'), 8, 4, (math.radians(90), 0, 0))]
bar_obj = join(bar, 'hut_bar')

skin, hair, shirt, eye = mat('Captive skin', '#FFD2AE', .7), mat('Captive hair', '#7C4527', .7), mat('Captive shirt', '#FF00FF', .7), mat('Captive eye', '#2A1D24', .7)
cy = -FRONT - .0
cap = [sphere('c', .27, (WIN_X, cy, WIN_Z + .05), skin, 12, 7), sphere('c', .285, (WIN_X, cy + .05, WIN_Z + .11), hair, 12, 6, (1, 1, .95)),
       box('c', (.62, .26, .3), (WIN_X, cy + .02, WIN_Z - .35), shirt, .08, 1)]
for sx in (-1, 1):
    cap.append(sphere('c', .04, (WIN_X + sx * .1, cy - .24, WIN_Z + .06), eye, 6, 4))
    cap.append(sphere('c', .07, (WIN_X + sx * .27, cy - .2, WIN_Z - .12), skin, 6, 4))        # hands on the bars
cap_obj = join(cap, 'hut_captive')

parts = list(huts.values()) + [door_obj, bar_obj, cap_obj]
size = export_glb(parts, OUT)
print('rescue-huts.glb', size, 'bytes;', ', '.join(f'{o.name} {triangles(o)}' for o in parts), '; total', sum(triangles(o) for o in parts))

# ---------------------------------------------------------------- preview: the twelve in a 4 x 3 grid, shut and barred
for i, o in enumerate(huts.values()):
    gx, gy = (i % 4 - 1.5) * 5.2, (1 - i // 4) * 7.6
    o.location = (gx, gy, 0)
    for src in (door_obj, bar_obj, cap_obj):
        c = src.copy(); c.data = src.data.copy(); bpy.context.scene.collection.objects.link(c)
        c.location = (gx + (HINGE[0] if src is not cap_obj else 0), gy + (HINGE[1] if src is not cap_obj else 0), 0)
for src in (door_obj, bar_obj, cap_obj):
    src.location = (0, 0, -50)
studio('#7DD957', (1600, 1200))
game_camera((0, 0, 1.2), 25)
render(PREVIEW)
print('preview', PREVIEW)
