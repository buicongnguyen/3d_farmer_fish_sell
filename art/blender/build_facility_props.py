"""Willowmere facility props: the little kit for the insides of the School, Clinic, Police Station, Willow & Co. and
the Supermarket (src/facility-plans.mjs). One GLB, one mesh per prop, every name starts with fp_.

Run:  blender --background --factory-startup --python art/blender/build_facility_props.py
Writes public/assets/models/facility-props.glb and prints each prop's triangles and size (width x height x depth).

Contract (glTF, Y up, front faces +Z, origin = ground centre, metres, scale 1; the game places them at K = 1.2 like the house kit).
Hung props (fp_blackboard, fp_noticeboard, fp_hiringboard, fp_clock) have their back at z = 0 and are placed by their centre height.
Every material is opaque and flat (World.bake turns them into vertex colours so a room merges into a few draws).
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from style import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'models', 'facility-props.glb')
reset_scene()
C = {}
def m(name, color, rough=.6, metal=0.):
    C[name] = mat('FP ' + name, color, rough, metal); return C[name]
for n, c in {'white': '#FFFDF6', 'cream': '#FFF1D2', 'red': '#EF3B3B', 'redd': '#C22F2A', 'green': '#3FBF4A', 'greend': '#2F9A3A', 'blue': '#35B6F2', 'bluel': '#BFE9FF',
             'navy': '#2B4C9B', 'wood': '#C77A3A', 'woodl': '#E3A05A', 'woodd': '#8A4B25', 'steel': '#C9D2DE', 'iron': '#5B6477', 'charcoal': '#3A3D4A',
             'sun': '#FFC83A', 'orange': '#FF8A2A', 'carrot': '#F0802A', 'radish': '#E0506E', 'pumpkin': '#FF7A1A', 'berry': '#8E5BD0', 'apple': '#E8433A', 'leaf': '#4FBF3A',
             'rose': '#FF5C8A', 'teal': '#18B8C9', 'board': '#2F5D4E', 'boardl': '#3E7A66', 'chalk': '#F4FAFF', 'cork': '#C98F55', 'paper': '#FFF6D8', 'glass': '#7FE3FF',
             'skin': '#F4C9A0', 'police': '#2F4C86', 'hosp': '#E8F6FF', 'carpet': '#7C8FB8', 'stone': '#B9C0CC'}.items():
    m(n, c, .35 if n in ('steel', 'glass') else .6, .25 if n == 'steel' else 0.)

def bx(name, w, d, h, x, y, z, mt, bev=.02, seg=1, rot=0.):
    """A box of width w, depth d (toward the front), height h; (x, y) on the floor plan (y toward the front), z the bottom."""
    return box(name, (w, d, h), (x, -y, z + h / 2), C[mt], bev=bev, seg=seg, rot=(0, 0, rot))
def cl(name, r, h, x, y, z, mt, verts=12, rt=None):
    return cyl(name, r, h, (x, -y, z + h / 2), C[mt], verts=verts, bev=0, seg=1, radius_top=rt)
def ball(name, r, x, y, z, mt, sub=1, sc=None):
    return ico(name, r, (x, -y, z), C[mt], subdiv=sub, scale=sc)

props = []   # (name, parts)
def prop(name, parts): props.append((name, parts))

# ------------------------------------------------------------------ supermarket
def shelf():  # a gondola, 2.0 wide, 0.5 deep, 1.7 high, goods facing +Z
    p = [bx('back', 2.0, .06, 1.7, 0, -.22, .08, 'steel'), bx('base', 2.0, .5, .1, 0, 0, 0, 'iron'),
         bx('endl', .06, .5, 1.7, -.97, 0, .08, 'white'), bx('endr', .06, .5, 1.7, .97, 0, .08, 'white'),
         bx('top', 2.0, .52, .08, 0, 0, 1.74, 'red', bev=.03)]
    goods = ['carrot', 'radish', 'apple', 'berry', 'pumpkin', 'sun', 'leaf', 'blue', 'orange']
    for t in range(4):
        z = .22 + t * .4
        p.append(bx('tier', 1.9, .48, .05, 0, 0, z, 'woodl'))
        for i in range(9):
            c = goods[(i * 2 + t * 3) % len(goods)]
            p.append(bx('good', .15, .15, .22 + ((i + t) % 3) * .05, -.82 + i * .205, .1, z + .05, c, bev=0))
    return p
prop('fp_shelf', shelf())
def produce_bin():  # 1.0 wide, .8 deep, 0.75 high
    p = [bx('crate', 1.0, .8, .45, 0, 0, 0, 'wood', bev=.03), bx('lip', 1.06, .86, .06, 0, 0, .43, 'woodl'), bx('slope', 1.0, .5, .1, 0, .45, 0, 'woodd')]
    for i, c in enumerate(('carrot', 'apple', 'berry')):
        for j in range(3):
            p.append(ball('mound', .17, -.3 + i * .3, -.05 + (j % 2) * .12 - .1, .55 + .06 * (j == 1), c))
        p.append(ball('mound', .17, -.3 + i * .3, .12, .52, c))
    p.append(bx('sign', .5, .04, .3, 0, -.38, .58, 'white'))
    p.append(bx('signr', .5, .045, .08, 0, -.38, .78, 'red'))
    return p
prop('fp_bin', produce_bin())
def chiller():  # open cold case 2.0 x .8 x 1.3
    p = [bx('body', 2.0, .8, .8, 0, 0, 0, 'white', bev=.04), bx('well', 1.84, .62, .1, 0, 0, .78, 'bluel'), bx('back', 2.0, .12, 1.3, 0, -.34, 0, 'blue'),
         bx('canopy', 2.0, .36, .1, 0, -.2, 1.22, 'teal'), bx('kick', 2.0, .78, .12, 0, 0, 0, 'iron')]
    goods = ['white', 'blue', 'apple', 'sun', 'leaf', 'rose']
    for i in range(10):
        p.append(bx('pack', .13, .13, .22 + (i % 3) * .05, -.86 + i * .19, -.08, .86, goods[i % 6], bev=0))
        p.append(bx('pack', .13, .13, .22, -.86 + i * .19, .14, .86, goods[(i + 2) % 6], bev=0))
    return p
prop('fp_chiller', chiller())
prop('fp_register', [bx('base', .5, .42, .16, 0, 0, 0, 'charcoal', bev=.03), bx('screen', .34, .06, .2, 0, -.1, .16, 'iron', rot=0), bx('face', .28, .02, .14, 0, -.07, .19, 'glass'),
                     bx('keys', .32, .22, .05, 0, .06, .16, 'sun', bev=.01), bx('drawer', .46, .06, .06, 0, .22, .04, 'steel')])
def cart():
    p = [bx('basket', .6, .9, .05, 0, 0, .34, 'steel'), bx('floor', .52, .8, .05, 0, 0, .14, 'iron'), bx('sidel', .04, .9, .34, -.3, 0, .36, 'steel'), bx('sider', .04, .9, .34, .3, 0, .36, 'steel'),
         bx('frontb', .6, .04, .34, 0, .45, .36, 'steel'), bx('backb', .6, .04, .34, 0, -.45, .36, 'steel'), bx('handle', .64, .05, .05, 0, -.55, .88, 'red'),
         bx('post', .05, .05, .52, -.28, -.5, .38, 'steel'), bx('postr', .05, .05, .52, .28, -.5, .38, 'steel')]
    for dx in (-.24, .24):
        for dy in (-.35, .35):
            p.append(cl('wheel', .07, .05, dx, dy, .02, 'charcoal', 8))
    p.append(ball('apple', .13, -.1, .1, .5, 'apple')); p.append(ball('carrot', .12, .12, -.1, .5, 'carrot'))
    return p
prop('fp_cart', cart())
prop('fp_crate', [bx('crate', .8, .6, .55, 0, 0, 0, 'wood', bev=.03), bx('slatl', .84, .04, .12, 0, .3, .12, 'woodl'), bx('slatr', .84, .04, .12, 0, .3, .34, 'woodl'),
                  bx('lid', .76, .56, .05, 0, 0, .55, 'woodd'), bx('tag', .2, .02, .14, 0, .31, .2, 'white')])
prop('fp_boxes', [bx('a', .8, .6, .5, -.2, 0, 0, 'woodl', bev=.03), bx('b', .6, .5, .4, .3, .05, 0, 'wood', bev=.03), bx('c', .55, .45, .4, -.1, 0, .5, 'cream', bev=.03),
                  bx('tape', .8, .1, .02, -.2, 0, .5, 'woodd'), bx('lab', .22, .02, .16, .3, .31, .15, 'white'), bx('labc', .2, .02, .14, -.1, .23, .65, 'red')])

# ------------------------------------------------------------------ school
def blackboard():  # hung: 3.2 wide, 1.4 high, back at z 0
    p = [bx('frame', 3.2, .08, 1.4, 0, .04, -.7, 'woodd', bev=.02), bx('board', 3.0, .02, 1.2, 0, .09, -.6, 'board'), bx('ledge', 3.0, .14, .06, 0, .1, -.78, 'woodl')]
    p += [bx('chalk', .1, .03, .03, -.6 + i * .3, .12, -.74, 'chalk') for i in range(3)]
    p += [bx('line', 1.2 - .2 * i, .01, .05, -.7 + .1 * i, .1, .3 - i * .3, 'chalk') for i in range(3)]
    p.append(bx('sum', .5, .01, .05, .85, .1, .05, 'sun')); p.append(bx('sum2', .4, .01, .05, .9, .1, -.1, 'rose'))
    return p
prop('fp_blackboard', blackboard())
def schooldesk():  # desk .9 x .6 and a chair behind it (at -z)
    p = [bx('top', .9, .6, .06, 0, 0, .55, 'woodl', bev=.02), bx('rack', .8, .4, .05, 0, .05, .25, 'wood'), bx('seat', .4, .4, .05, 0, -.62, .34, 'blue', bev=.02),
         bx('backr', .4, .05, .3, 0, -.82, .4, 'blue', bev=.02)]
    for dx in (-.38, .38):
        p.append(bx('leg', .05, .05, .55, dx, .22, 0, 'iron', bev=0)); p.append(bx('legb', .05, .05, .55, dx, -.22, 0, 'iron', bev=0))
    for dx in (-.15, .15): p.append(bx('chl', .04, .04, .34, dx, -.8, 0, 'iron', bev=0)); p.append(bx('chf', .04, .04, .34, dx, -.45, 0, 'iron', bev=0))
    p.append(bx('book', .22, .3, .04, -.2, .02, .61, 'red', bev=.01)); p.append(bx('paper', .24, .3, .01, .2, .02, .61, 'paper', bev=0))
    return p
prop('fp_schooldesk', schooldesk())
prop('fp_seesaw', [bx('plank', 2.0, .3, .08, 0, 0, .42, 'sun', bev=.03), bx('pivot', .12, .5, .4, 0, 0, 0, 'red', bev=.03), bx('seatl', .3, .3, .06, -.8, 0, .5, 'blue'), bx('seatr', .3, .3, .06, .8, 0, .5, 'blue'),
                   bx('handl', .04, .04, .22, -.8, .1, .5, 'iron', bev=0), bx('handr', .04, .04, .22, .8, .1, .5, 'iron', bev=0)])
prop('fp_sandbox', [bx('sidea', 1.6, .1, .24, 0, .75, 0, 'woodl'), bx('sideb', 1.6, .1, .24, 0, -.75, 0, 'woodl'), bx('sidec', .1, 1.4, .24, .75, 0, 0, 'woodl'), bx('sided', .1, 1.4, .24, -.75, 0, 0, 'woodl'),
                    bx('sand', 1.5, 1.4, .16, 0, 0, 0, 'sun'), ball('castle', .22, .2, .1, .2, 'orange', 1, (1, 1, .7)), bx('bucket', .14, .14, .14, -.35, .2, .16, 'red')])

# ------------------------------------------------------------------ clinic
def hospital_bed():  # 1.0 x 2.0, head at -z
    p = [bx('frame', 1.0, 2.0, .12, 0, 0, .3, 'white', bev=.03), bx('mattress', .92, 1.9, .16, 0, .02, .4, 'hosp', bev=.04, seg=2), bx('sheet', .9, 1.2, .08, 0, .35, .52, 'bluel', bev=.03),
         bx('pillow', .6, .36, .1, 0, -.65, .56, 'white', bev=.04, seg=2), bx('head', 1.0, .06, .7, 0, -1.0, .3, 'teal', bev=.03), bx('foot', 1.0, .06, .45, 0, 1.0, .3, 'teal', bev=.03),
         bx('raill', .04, 1.0, .06, -.5, .1, .62, 'steel'), bx('railr', .04, 1.0, .06, .5, .1, .62, 'steel')]
    for dx in (-.45, .45):
        for dy in (-.9, .9): p.append(cl('wheel', .07, .05, dx, dy, 0, 'charcoal', 8)); p.append(bx('leg', .05, .05, .22, dx, dy, .08, 'steel', bev=0))
    return p
prop('fp_hospitalbed', hospital_bed())
prop('fp_curtain', [bx('rail', 1.8, .05, .05, 0, 0, 1.9, 'steel'), bx('cloth', 1.7, .04, 1.45, 0, 0, .42, 'bluel', bev=.01), bx('stripe', 1.7, .05, .12, 0, 0, 1.2, 'teal', bev=0),
                    bx('footl', .06, .3, .06, -.85, 0, 0, 'steel'), bx('footr', .06, .3, .06, .85, 0, 0, 'steel'), bx('polel', .04, .04, 1.9, -.88, 0, 0, 'steel'), bx('poler', .04, .04, 1.9, .88, 0, 0, 'steel')])
def medcabinet():  # 1.6 x .5 x 2.0
    p = [bx('body', 1.6, .5, 2.0, 0, 0, 0, 'white', bev=.04), bx('glass', 1.4, .02, 1.1, 0, .26, .75, 'glass'), bx('plinth', 1.6, .5, .12, 0, 0, 0, 'iron'),
         bx('crossv', .12, .02, .36, 0, .26, 1.62, 'green'), bx('crossh', .36, .02, .12, 0, .26, 1.74, 'green')]
    for t in range(3):
        p.append(bx('shelf', 1.4, .4, .03, 0, 0, .55 + t * .35, 'steel'))
        for i in range(6): p.append(cl('bottle', .05, .2 + (i % 2) * .05, -.55 + i * .22, .05, .58 + t * .35, ('red', 'blue', 'sun', 'green', 'rose', 'orange')[(i + t) % 6], 8))
    return p
prop('fp_medcabinet', medcabinet())
prop('fp_waitbench', [bx('seat', 2.0, .5, .1, 0, 0, .42, 'teal', bev=.04), bx('back', 2.0, .08, .5, 0, -.22, .5, 'teal', bev=.04), bx('legl', .08, .46, .42, -.9, 0, 0, 'steel'), bx('legr', .08, .46, .42, .9, 0, 0, 'steel'),
                      bx('armm', .06, .44, .2, 0, 0, .52, 'bluel')])
prop('fp_ivstand', [cl('pole', .025, 1.9, 0, 0, .08, 'steel', 8), bx('foot', .5, .5, .06, 0, 0, 0, 'iron', bev=.02), bx('bag', .16, .06, .26, 0, .04, 1.55, 'glass'), bx('hook', .3, .04, .04, 0, 0, 1.88, 'steel'), bx('tube', .02, .02, .5, .03, .06, 1.1, 'white', bev=0)])

# ------------------------------------------------------------------ police
def cellbars():  # a barred front 2.4 wide, 2.4 high
    p = [bx('top', 2.4, .1, .12, 0, 0, 2.28, 'iron'), bx('bot', 2.4, .1, .12, 0, 0, 0, 'iron'), bx('post', .12, .1, 2.4, -1.14, 0, 0, 'iron'), bx('postr', .12, .1, 2.4, 1.14, 0, 0, 'iron')]
    for i in range(11): p.append(cl('bar', .025, 2.16, -1.0 + i * .2, 0, .12, 'steel', 8))
    p.append(bx('lock', .1, .14, .16, .85, 0, 1.0, 'sun', bev=.02))
    return p
prop('fp_cellbars', cellbars())
prop('fp_cellbed', [bx('lower', .95, 1.9, .1, 0, 0, .28, 'steel'), bx('mattress', .9, 1.8, .1, 0, 0, .38, 'carpet', bev=.03), bx('pillow', .5, .3, .08, 0, -.7, .48, 'white', bev=.03),
                    bx('upper', .95, 1.9, .06, 0, 0, 1.0, 'steel'), bx('mattu', .9, 1.8, .08, 0, 0, 1.06, 'navy', bev=.03), bx('postfl', .06, .06, 1.5, -.46, .9, 0, 'iron', bev=0),
                    bx('postfr', .06, .06, 1.5, .46, .9, 0, 'iron', bev=0), bx('postbl', .06, .06, 1.5, -.46, -.9, 0, 'iron', bev=0), bx('postbr', .06, .06, 1.5, .46, -.9, 0, 'iron', bev=0)])
def evidence_shelf():  # 1.6 x .5 x 1.9, boxes and bags
    p = [bx('back', 1.6, .05, 1.9, 0, -.22, 0, 'iron'), bx('sidel', .05, .5, 1.9, -.78, 0, 0, 'iron'), bx('sider', .05, .5, 1.9, .78, 0, 0, 'iron')]
    for t in range(4):
        p.append(bx('tier', 1.6, .5, .04, 0, 0, .1 + t * .5, 'steel'))
        for i in range(3):
            p.append(bx('box', .36 - (i == 1) * .06, .34, .28 - (t == 3) * .06, -.5 + i * .5, 0, .14 + t * .5, ('woodl', 'cream', 'wood', 'police')[(i + t) % 4], bev=.02))
        p.append(bx('tag', .1, .01, .08, -.5 + (t % 3) * .5, .18, .22 + t * .5, 'red', bev=0))
    return p
prop('fp_evidenceshelf', evidence_shelf())
prop('fp_noticeboard', [bx('frame', 1.8, .06, 1.1, 0, .03, -.55, 'woodd'), bx('cork', 1.68, .02, .98, 0, .07, -.49, 'cork'), bx('p1', .4, .01, .5, -.5, .09, -.4, 'paper', bev=0), bx('p2', .36, .01, .44, .1, .09, -.35, 'white', bev=0),
                        bx('p3', .32, .01, .4, .6, .09, -.45, 'sun', bev=0), bx('pin1', .05, .02, .05, -.5, .1, -.2, 'red', bev=0), bx('pin2', .05, .02, .05, .1, .1, -.16, 'blue', bev=0), bx('pin3', .05, .02, .05, .6, .1, -.28, 'green', bev=0)])
prop('fp_filecabinet', [bx('body', .6, .6, 1.3, 0, 0, 0, 'steel', bev=.03), bx('d1', .5, .03, .28, 0, .31, .1, 'iron'), bx('d2', .5, .03, .28, 0, .31, .5, 'iron'), bx('d3', .5, .03, .28, 0, .31, .9, 'iron'),
                        bx('h1', .16, .03, .04, 0, .34, .26, 'sun', bev=0), bx('h2', .16, .03, .04, 0, .34, .66, 'sun', bev=0), bx('h3', .16, .03, .04, 0, .34, 1.06, 'sun', bev=0)])

# ------------------------------------------------------------------ company
def officedesk():  # 1.5 x .8; a monitor and keyboard on top, the worker sits behind (-z)
    p = [bx('top', 1.5, .8, .06, 0, 0, .68, 'woodl', bev=.02), bx('panel', 1.4, .04, .5, 0, .3, .2, 'wood'), bx('legl', .06, .7, .68, -.7, 0, 0, 'white', bev=.01), bx('legr', .06, .7, .68, .7, 0, 0, 'white', bev=.01),
         bx('drawer', .5, .5, .4, .45, -.1, .26, 'white', bev=.02), bx('dh', .2, .02, .04, .45, .16, .5, 'steel', bev=0),
         bx('mon', .56, .05, .38, -.2, -.15, .98, 'charcoal', bev=.02), bx('face', .5, .02, .32, -.2, -.12, 1.0, 'blue', bev=0), bx('stand', .1, .1, .22, -.2, -.15, .74, 'iron'),
         bx('kb', .42, .14, .02, -.2, .12, .74, 'white', bev=0), bx('mug', .1, .1, .1, .5, .18, .74, 'red', bev=.02), bx('pad', .22, .3, .02, .1, .1, .74, 'paper', bev=0)]
    return p
prop('fp_officedesk', officedesk())
prop('fp_meetingtable', [bx('top', 3.2, 1.2, .08, 0, 0, .7, 'woodl', bev=.04, seg=2), bx('basel', .5, .8, .7, -1.0, 0, 0, 'woodd'), bx('baser', .5, .8, .7, 1.0, 0, 0, 'woodd'),
                         bx('padm', .3, .24, .01, 0, 0, .78, 'paper', bev=0), bx('pad1', .3, .24, .01, -.9, .2, .78, 'white', bev=0), bx('pad2', .3, .24, .01, .9, -.2, .78, 'white', bev=0), bx('cup', .1, .1, .12, .3, .1, .78, 'red', bev=.02)])
def hiringboard():  # hung 2.4 x 1.4
    p = [bx('frame', 2.4, .07, 1.4, 0, .035, -.7, 'woodd'), bx('cork', 2.28, .02, 1.28, 0, .08, -.64, 'cork'), bx('banner', 1.6, .02, .26, 0, .1, -.1 + .26, 'orange', bev=0)]
    cols = ['paper', 'white', 'sun', 'bluel', 'rose', 'paper', 'white', 'leaf']
    for i in range(8):
        p.append(bx('card', .42, .01, .5, -.9 + (i % 4) * .6, .095, -.35 - (i // 4) * .52 + .1, cols[i], bev=0))
        p.append(bx('pin', .05, .02, .05, -.9 + (i % 4) * .6, .105, -.1 - (i // 4) * .52, 'red', bev=0))
    return p
prop('fp_hiringboard', hiringboard())
prop('fp_watercooler', [bx('base', .4, .4, .8, 0, 0, 0, 'white', bev=.03), cl('jug', .15, .4, 0, 0, .8, 'blue', 12), bx('tapb', .06, .06, .06, 0, .2, .65, 'red', bev=0), bx('tap', .1, .03, .03, 0, .22, .62, 'steel', bev=0)])
prop('fp_coffee', [bx('body', .45, .4, .5, 0, 0, 0, 'charcoal', bev=.03), bx('top', .45, .3, .06, 0, 0, .5, 'red', bev=.02), bx('cup', .1, .1, .1, 0, .12, .1, 'white', bev=.02), bx('pot', .18, .18, .18, .1, .1, .06, 'glass', bev=.02)])
prop('fp_clock', [cyl('rim', .3, .06, (0, -.03, 0), C['woodd'], verts=20, bev=0, seg=1, rot=(math.pi / 2, 0, 0)), cyl('face', .26, .02, (0, -.07, 0), C['white'], verts=20, bev=0, seg=1, rot=(math.pi / 2, 0, 0)),
                  bx('h1', .03, .02, .18, 0, .09, .08, 'charcoal', bev=0), bx('h2', .14, .02, .03, .06, .09, 0, 'charcoal', bev=0)])

# ------------------------------------------------------------------ bakery
for n, c in {'brick': '#D9663F', 'brickd': '#A9492B', 'loaf': '#D8944A', 'loafd': '#B87333', 'crust': '#E9B66A', 'flour': '#FFF6E4', 'pie': '#E8A04A', 'cream': '#FFF1D2', 'pink': '#FF9CC8'}.items():
    m(n, c, .7)
def oven():  # brick bread oven 2.0 x 1.2 x 2.0 with a glowing mouth and a chimney
    p = [bx('base', 2.0, 1.2, .5, 0, 0, 0, 'brickd', bev=.04), bx('dome', 1.8, 1.0, .9, 0, 0, .5, 'brick', bev=.12, seg=2), bx('hood', 1.2, .8, .5, 0, -.1, 1.4, 'brick', bev=.08, seg=2),
         bx('chim', .45, .45, .7, 0, -.2, 1.9, 'brickd', bev=.04), bx('mouth', .8, .1, .5, 0, .52, .7, 'charcoal', bev=.04), bx('fire', .6, .05, .3, 0, .56, .72, 'orange', bev=0),
         bx('arch', .95, .12, .1, 0, .52, 1.2, 'cream', bev=.02), bx('shelf', 1.9, .5, .06, 0, .4, .52, 'woodd')]
    p += [bx('log', .5, .2, .16, -.6 + i * .6, .5, .08, 'woodl', bev=.03) for i in range(2)]
    return p
prop('fp_oven', oven())
def breadshelf():  # 1.8 x .6 x 1.7 with loaves
    p = [bx('back', 1.8, .06, 1.7, 0, -.25, 0, 'woodd'), bx('sidel', .06, .6, 1.7, -.87, 0, 0, 'wood'), bx('sider', .06, .6, 1.7, .87, 0, 0, 'wood'), bx('top', 1.8, .62, .06, 0, 0, 1.68, 'orange', bev=.03)]
    for t in range(4):
        p.append(bx('tier', 1.7, .55, .05, 0, 0, .1 + t * .4, 'woodl'))
        for i in range(5):
            p.append(ball('loaf', .13, -.65 + i * .32, .05, .3 + t * .4, ('loaf', 'crust', 'loafd')[(i + t) % 3], 1, (1.4, 1, .8)))
    return p
prop('fp_breadshelf', breadshelf())
def cakecase():  # glass pastry counter 2.0 x .8 x 1.2
    p = [bx('base', 2.0, .8, .7, 0, 0, 0, 'cream', bev=.04), bx('kick', 2.0, .78, .1, 0, 0, 0, 'brickd'), bx('glass', 1.9, .7, .45, 0, 0, .7, 'glass', bev=.02), bx('lid', 2.0, .8, .06, 0, 0, 1.15, 'orange', bev=.03), bx('tray', 1.8, .6, .04, 0, 0, .72, 'white')]
    for i in range(5):
        p.append(cl('pie', .17, .1, -.75 + i * .38, 0, .76, ('pie', 'crust', 'pink', 'pie', 'loaf')[i], 12)); p.append(ball('top', .08, -.75 + i * .38, 0, .88, ('berry', 'apple', 'sun', 'red', 'pink')[i]))
    return p
prop('fp_cakecase', cakecase())
prop('fp_sacks', [bx('a', .6, .45, .7, -.3, 0, 0, 'flour', bev=.14, seg=2), bx('b', .6, .45, .7, .3, .05, 0, 'cream', bev=.14, seg=2), bx('c', .6, .45, .65, 0, -.05, .7, 'flour', bev=.14, seg=2), bx('tie', .2, .2, .06, 0, -.05, 1.3, 'red', bev=.02), bx('tag', .2, .02, .16, -.3, .24, .3, 'orange', bev=0)])
prop('fp_trays', [bx('rack', .9, .6, 1.5, 0, 0, 0, 'steel', bev=.02)] + sum([[bx('tray', .84, .56, .03, 0, 0, .15 + t * .32, 'iron', bev=0), ball('l1', .1, -.2, 0, .24 + t * .32, 'loaf', 1, (1.4, 1, .7)), ball('l2', .1, .2, 0, .24 + t * .32, 'crust', 1, (1.4, 1, .7))] for t in range(4)], []))
prop('fp_breadbasket', [cyl('basket', .3, .22, (0, 0, .11), C['woodl'], verts=14, bev=0, seg=1, radius_top=.36)] + [ball('loaf', .13, -.12 + i * .12, (i % 2) * .08 - .04, .26, ('loaf', 'crust', 'loafd')[i % 3], 1, (1.3, 1, .8)) for i in range(3)])

# ------------------------------------------------------------------ barns (Moss barn, Vale workshop)
for n, c in {'hay': '#F2B33D', 'hayl': '#FFD35C', 'hayd': '#D98B1F', 'milk': '#FFFDF6'}.items():
    m(n, c, .85)
def hay():  # three stacked bales 1.0 x .6 x .5 each, strapped
    p = []
    for x, y, z in ((-.5, 0, 0), (.5, 0, 0), (0, 0, .5)):
        p.append(bx('bale', 1.0, .6, .5, x, y, z, 'hay', bev=.05, seg=2))
        p.append(bx('strap1', .06, .62, .52, x - .25, y, z - .01, 'woodd', bev=0)); p.append(bx('strap2', .06, .62, .52, x + .25, y, z - .01, 'woodd', bev=0))
        p.append(bx('tuft', .4, .3, .06, x, y + .1, z + .5, 'hayl', bev=.02))
    return p
prop('fp_hay', hay())
prop('fp_stall', [bx('floor', 2.0, 1.8, .06, 0, 0, 0, 'hayd', bev=.02), bx('postl', .12, .12, 1.4, -.95, .85, 0, 'wood', bev=.02), bx('postr', .12, .12, 1.4, .95, .85, 0, 'wood', bev=.02), bx('railt', 2.0, .08, .1, 0, .85, 1.2, 'woodl'),
                  bx('railm', 2.0, .08, .1, 0, .85, .8, 'woodl'), bx('railb', 2.0, .08, .1, 0, .85, .4, 'woodl'), bx('sidel', .08, 1.8, .9, -.95, 0, 0, 'wood', bev=.02), bx('sider', .08, 1.8, .9, .95, 0, 0, 'wood', bev=.02),
                  bx('manger', 1.0, .4, .3, 0, -.7, .5, 'woodd', bev=.03), bx('straw', 1.5, 1.0, .1, 0, .1, .06, 'hay', bev=.04)])
prop('fp_toolrack', [bx('board', 1.8, .06, .9, 0, .03, -.45, 'woodd'), bx('railh', 1.6, .06, .05, 0, .09, -.1, 'iron'), bx('fork', .05, .05, 1.0, -.6, .1, -.45, 'woodl'), bx('forkh', .3, .04, .04, -.6, .1, .0, 'iron'),
                     bx('rake', .05, .05, .9, -.15, .1, -.45, 'woodl'), bx('rakeh', .3, .04, .1, -.15, .1, -.9, 'iron'), bx('spade', .05, .05, .8, .3, .1, -.45, 'woodl'), bx('blade', .2, .03, .25, .3, .1, -.9, 'steel'),
                     bx('hammer', .04, .04, .4, .7, .1, -.3, 'woodl'), bx('head', .18, .06, .08, .7, .1, -.1, 'iron')])
prop('fp_trough', [bx('body', 1.6, .5, .3, 0, 0, .1, 'woodd', bev=.04), bx('feed', 1.4, .36, .06, 0, 0, .38, 'hay', bev=.02), bx('legl', .1, .4, .12, -.7, 0, 0, 'wood'), bx('legr', .1, .4, .12, .7, 0, 0, 'wood')])
prop('fp_pail', [cyl('pail', .2, .3, (0, 0, .15), C['steel'], verts=12, bev=0, seg=1, radius_top=.25), cyl('milk', .21, .02, (0, 0, .29), C['milk'], verts=12, bev=0, seg=1), bx('handle', .5, .03, .03, 0, 0, .4, 'iron', bev=0)])
prop('fp_anvil', [bx('base', .5, .4, .35, 0, 0, 0, 'wood', bev=.03), bx('waist', .3, .2, .15, 0, 0, .35, 'iron', bev=.03), bx('top', .8, .25, .15, 0, 0, .5, 'charcoal', bev=.04), bx('horn', .3, .12, .1, .5, 0, .52, 'charcoal', bev=.03)])
prop('fp_lumber', [bx('p%d' % i, 1.8, .3, .1, 0, 0, .05 + i * .12, ('woodl', 'wood', 'woodd')[i % 3], bev=.01) for i in range(6)] + [bx('sl', .1, .4, .12, -.7, 0, 0, 'iron'), bx('sr', .1, .4, .12, .7, 0, 0, 'iron')])

# ------------------------------------------------------------------ little things to tap (talk-things.mjs)
prop('fp_printer', [bx('stand', .7, .55, .6, 0, 0, 0, 'woodl', bev=.03), bx('body', .62, .5, .26, 0, 0, .6, 'white', bev=.04), bx('lid', .62, .3, .05, 0, -.1, .86, 'steel', bev=.02), bx('slot', .44, .06, .04, 0, .23, .7, 'charcoal', bev=0),
                    bx('page', .36, .3, .015, 0, .34, .69, 'paper', bev=0), bx('tray', .46, .3, .03, 0, .34, .64, 'steel', bev=.01), bx('light', .06, .03, .03, .22, .25, .8, 'green', bev=0), bx('jam', .3, .2, .1, -.05, -.02, .9, 'paper', bev=.03, rot=.4)])
prop('fp_suggestbox', [bx('post', .14, .14, .8, 0, 0, 0, 'wood', bev=.02), bx('foot', .4, .4, .06, 0, 0, 0, 'woodd', bev=.02), bx('box', .5, .36, .4, 0, 0, .8, 'orange', bev=.04), bx('lid', .54, .4, .06, 0, 0, 1.2, 'redd', bev=.02),
                       bx('slit', .3, .04, .03, 0, .1, 1.255, 'charcoal', bev=0), bx('note', .22, .02, .16, 0, .19, .92, 'paper', bev=0), bx('slip', .16, .01, .12, .05, .1, 1.24, 'paper', bev=0, rot=.3)])
prop('fp_bell', [cl('base', .13, .03, 0, 0, 0, 'woodd'), cl('dome', .11, .09, 0, 0, .03, 'sun', 12, .05), ball('knob', .03, 0, 0, .14, 'steel')])
prop('fp_sampletray', [bx('tray', .7, .45, .04, 0, 0, 0, 'steel', bev=.01), bx('sign', .3, .03, .22, 0, -.2, .04, 'white', bev=.01), bx('signr', .3, .035, .06, 0, -.2, .26, 'red', bev=.01)] +
     [bx('bite', .09, .09, .08, -.24 + (i % 4) * .16, .02 + (i // 4) * .14, .04, ('sun', 'apple', 'cream', 'leaf')[i % 4], bev=.01) for i in range(8)] + [bx('pick', .012, .012, .12, -.24 + (i % 4) * .16, .02 + (i // 4) * .14, .1, 'woodl', bev=0) for i in range(8)])
prop('fp_scale', [bx('plate', .5, .5, .08, 0, .1, 0, 'steel', bev=.03), bx('mat', .4, .4, .02, 0, .1, .08, 'teal', bev=.01), bx('pole', .07, .07, 1.3, 0, -.2, 0, 'white', bev=.01), bx('head', .34, .08, .3, 0, -.18, 1.3, 'white', bev=.04),
                  bx('dial', .24, .02, .2, 0, -.13, 1.35, 'bluel', bev=0), bx('needle', .02, .02, .12, .03, -.118, 1.4, 'red', bev=0, rot=0)])
prop('fp_eyechart', [bx('board', .7, .04, 1.0, 0, .02, -.5, 'white', bev=.01), bx('rim', .76, .03, .06, 0, .02, .47, 'teal', bev=0)] +
     [bx('row%d' % r, .1 * (5 - r) if r < 2 else .5, .012, max(.03, .16 - r * .03), 0, .046, .28 - r * .17, 'charcoal', bev=0) for r in range(5)])
prop('fp_petcage', [bx('tray', .7, .45, .08, 0, 0, 0, 'blue', bev=.02), bx('straw', .64, .4, .03, 0, 0, .08, 'sun', bev=0), bx('roof', .7, .45, .04, 0, 0, .46, 'blue', bev=.02)] +
     [bx('bar', .015, .015, .38, -.33 + i * .11, .21, .08, 'steel', bev=0) for i in range(7)] + [bx('barb', .015, .015, .38, -.33 + i * .11, -.21, .08, 'steel', bev=0) for i in range(7)] +
     [cl('wheel', .13, .05, .18, -.05, .12, 'rose', 10), ball('hamster', .08, -.14, .05, .17, 'woodl', 1, (1.3, 1, 1)), ball('head', .05, -.23, .08, .2, 'woodl'), ball('ear', .018, -.24, .05, .25, 'rose'), bx('house', .18, .16, .14, -.2, -.1, .1, 'apple', bev=.02)])
prop('fp_basket', [cl('basket', .3, .36, 0, 0, 0, 'woodl', 12, .38), cl('rim', .4, .05, 0, 0, .34, 'wood', 12), bx('scarf', .4, .12, .1, .05, .05, .36, 'rose', bev=.03, rot=.5), bx('glove', .14, .2, .12, -.14, -.08, .37, 'blue', bev=.04),
                   bx('brolly', .05, .05, .7, .16, -.1, .1, 'navy', bev=.01), ball('hat', .12, -.02, .14, .42, 'sun', 1, (1, 1, .6)), bx('tag', .3, .02, .16, 0, .39, .12, 'paper', bev=0)])

# Hung props: lift them so the back is at z = 0 and the origin is at the board's centre height: handled by their own boxes (negative z). Clocks:
# the clock is a cylinder standing up; turn it to face the front.
objs = []
for name, parts in props:
    o = join(parts, name); objs.append(o)
    xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]; zs = [v.co.z for v in o.data.vertices]
    print('%-18s tris %4d  w %.2f d %.2f h %.2f' % (name, triangles(o), max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)))
size = export_glb(objs, OUT)
print('facility-props.glb', size, 'bytes,', sum(triangles(o) for o in objs), 'triangles,', len(objs), 'props')
