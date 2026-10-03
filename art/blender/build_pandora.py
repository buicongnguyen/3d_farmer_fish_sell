"""The Pandora box: an ornate little chest on a plinth, in the Zoo Garden toy style.

Run:  blender --background --factory-startup --python art/blender/build_pandora.py
Writes public/assets/models/pandora-box.glb and art/previews/pandora-box.webp (closed and open, side by side).

Contract (glTF, Y up, front faces +Z, origin = ground centre, metres, authored at the house kit's 1 m scale):
  pandora_base   the plinth and the chest body (lacquer, gold trim, lock plate, ring handles), <= 0.7 x 0.5, h 0.66
  pandora_lid    the domed lid; its ORIGIN IS THE HINGE (back top edge of the body), so the game opens it by turning it
                 about its local X axis (rotation.x = -1.9 is wide open, 0 is shut)
  pandora_glow   everything that glows: the seam between lid and body, the keyhole gem and the rune studs.
                 Material 'Pandora glow' (emissive); the game draws it unlit and pulses it.
  pandora_inner  the light inside the chest, a slab just under the rim (material 'Pandora light'); the game shows it
                 only while the box is open.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from style import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'models', 'pandora-box.glb')
PREVIEW = os.path.join(ROOT, 'art', 'previews', 'pandora-box.webp')

reset_scene()
M = {
    'lacquer': mat('Pandora lacquer', '#7A3FE0', .35), 'lacquer_dark': mat('Pandora lacquer dark', '#4B23A8', .4),
    'gold': mat('Pandora gold', '#FFC83A', .28, .45), 'gold_dark': mat('Pandora gold dark', '#E0931A', .3, .45),
    'wood': mat('Pandora plinth', '#8A4B25', .7), 'wood_light': mat('Pandora plinth light', '#C77A3A', .7),
    'velvet': mat('Pandora velvet', '#D8243B', .8),
    'glow': mat('Pandora glow', '#FFD9FF', .3, emit='#FF8CF5', emit_strength=3.0),
    'light': mat('Pandora light', '#FFF3C4', .3, emit='#FFE28A', emit_strength=4.0),
}

W, D, H = .60, .40, .26          # chest body: width (x), depth (y), height (z)
PLINTH = .34                     # the body stands this high
TOP = PLINTH + H                 # the rim, where the lid meets the body
HINGE = (0, D / 2, TOP)          # Blender +Y is the back
ARCH = .17                       # how high the lid's dome rises

# ---------------------------------------------------------------- plinth and body
# Small prop, seen from a few metres: one bevel segment is enough (the whole box stays near 2,000 triangles).
base = []
base.append(box('plinth_foot', (.62, .50, .07), (0, 0, .035), M['wood'], .02, 1))
base.append(box('plinth_stem', (.46, .34, .20), (0, 0, .17), M['wood_light'], .03, 1))
base.append(box('plinth_top', (.68, .50, .07), (0, 0, PLINTH - .035), M['wood'], .02, 1))
base.append(box('plinth_cloth', (.60, .42, .012), (0, 0, PLINTH + .004), M['velvet'], 0))
for sx in (-1, 1):
    for sy in (-1, 1):
        base.append(sphere('plinth_stud', .028, (sx * .27, sy * .21, .075), M['gold'], 8, 5))
# The body stops a little under the rim: the gold rim frames the opening and the light inside sits recessed in it.
BODY = H - .05
base.append(box('body', (W, D, BODY), (0, 0, PLINTH + BODY / 2), M['lacquer'], .03, 2))
# Inset panels on the front, back and sides give the lacquer two tones.
base.append(box('panel_front', (W - .2, .012, H - .12), (0, -D / 2 - .002, PLINTH + BODY / 2), M['lacquer_dark'], 0))
base.append(box('panel_back', (W - .2, .012, H - .12), (0, D / 2 + .002, PLINTH + BODY / 2), M['lacquer_dark'], 0))
for sx in (-1, 1):
    base.append(box('panel_side', (.012, D - .16, H - .12), (sx * (W / 2 + .002), 0, PLINTH + BODY / 2), M['lacquer_dark'], 0))
# Gold: corner posts, the rim, feet, the lock plate and ring handles.
for sx in (-1, 1):
    for sy in (-1, 1):
        base.append(box('corner', (.07, .07, H + .004), (sx * (W / 2 - .02), sy * (D / 2 - .02), PLINTH + H / 2), M['gold'], .016, 1))
        base.append(sphere('corner_foot', .045, (sx * (W / 2 - .02), sy * (D / 2 - .02), PLINTH + .03), M['gold_dark'], 8, 5))
base.append(box('rim_front', (W + .02, .06, .05), (0, -D / 2 + .012, TOP - .03), M['gold'], .01, 1))
base.append(box('rim_back', (W + .02, .06, .05), (0, D / 2 - .012, TOP - .03), M['gold'], .01, 1))
for sx in (-1, 1):
    base.append(box('rim_side', (.06, D + .02, .05), (sx * (W / 2 - .012), 0, TOP - .03), M['gold'], .01, 1))
    base.append(torus('handle', .055, .014, (sx * (W / 2 + .03), 0, PLINTH + H / 2 - .02), M['gold_dark'], 10, 5, rot=(0, math.pi / 2, 0)))
    base.append(sphere('handle_boss', .03, (sx * (W / 2 + .012), 0, PLINTH + H / 2 + .035), M['gold'], 8, 5))
base.append(extrude_outline('lock_plate', [(-.07, .0), (.07, .0), (.07, -.07), (0, -.125), (-.07, -.07)], .03, (0, -D / 2 - .012, TOP - .04), M['gold'], bev=0))
base_obj = join(base, 'pandora_base')

# ---------------------------------------------------------------- lid (origin at the hinge)
def arch(width, rise, steps=8, lift=0.0):
    """Outline (x, z) of a low dome: flat bottom, rounded top."""
    points = [(-width / 2, lift)]
    for i in range(steps + 1):
        a = math.pi - i * math.pi / steps
        points.append((math.cos(a) * width / 2, lift + .05 + math.sin(a) * rise))
    points.append((width / 2, lift))
    return points

lid = []
# extrude_outline runs the outline (x, z) along Y; turned a quarter about Z the arch spans the chest's depth.
lid.append(extrude_outline('lid_shell', arch(D, ARCH), W, (0, 0, TOP + .012), M['lacquer'], rot=(0, 0, math.pi / 2), bev=.012))
for x in (-.19, 0, .19):
    lid.append(extrude_outline('lid_band', arch(D + .02, ARCH + .012), .05, (x, 0, TOP + .012), M['gold'], rot=(0, 0, math.pi / 2), bev=0))
for sx in (-1, 1):
    lid.append(extrude_outline('lid_cap', arch(D + .016, ARCH + .008), .03, (sx * (W / 2 - .006), 0, TOP + .012), M['gold_dark'], rot=(0, 0, math.pi / 2), bev=0))
lid.append(box('lid_lip', (W + .024, .03, .034), (0, -D / 2 - .004, TOP + .03), M['gold'], .008, 1))
lid.append(sphere('lid_knob', .04, (0, 0, TOP + .012 + .05 + ARCH + .02), M['gold'], 10, 6))
lid_obj = join(lid, 'pandora_lid')
bpy.context.scene.cursor.location = HINGE
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.context.scene.cursor.location = (0, 0, 0)

# ---------------------------------------------------------------- glow (seam, gem, rune studs) and the light inside
glow = []
glow.append(box('seam_front', (W - .1, .016, .016), (0, -D / 2 - .003, TOP + .004), M['glow'], 0))
for sx in (-1, 1):
    glow.append(box('seam_side', (.016, D - .1, .016), (sx * (W / 2 + .003), 0, TOP + .004), M['glow'], 0))
glow.append(ico('gem', .034, (0, -D / 2 - .03, TOP - .09), M['glow'], 1, scale=(1, .6, 1.25), smooth_shading=False))
for sx in (-1, 1):
    for z in (.07, .15):
        glow.append(ico('rune', .017, (sx * .2, -D / 2 - .012, PLINTH + z), M['glow'], 1, smooth_shading=False))
glow_obj = join(glow, 'pandora_glow')
inner_obj = join([box('inner', (W - .1, D - .1, .02), (0, 0, TOP - .045), M['light'], 0)], 'pandora_inner')

parts = [base_obj, lid_obj, glow_obj, inner_obj]
size = export_glb(parts, OUT)
print('pandora-box.glb', size, 'bytes;', ', '.join(f'{o.name} {triangles(o)} tris' for o in parts))

# ---------------------------------------------------------------- preview: shut on the left, open on the right
for obj in parts:
    obj.location.x -= .55
for obj in parts:
    copy = obj.copy()
    copy.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(copy)
    copy.location.x += 1.1
    if obj is lid_obj:
        copy.rotation_euler = (math.radians(-105), 0, 0)   # Blender X: a negative angle lifts the front edge up and back
studio('#C98A55', (1200, 800))
game_camera((0, 0, .45), 2.6)
render(PREVIEW)
print('preview', PREVIEW)
