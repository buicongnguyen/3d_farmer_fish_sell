"""Import check for the kit generators copied from Zoo Garden (round 8, step 0).

    blender -b --factory-startup --python art/blender/kit/check_imports.py

Imports each of the nine generators (and so the three libraries they pull in: build_weapons, hero_spec, build_items) inside
Blender, without running their main(): a generator that fails to import is a defect. build_cage.py has no
`if __name__ == '__main__'` guard, so it is not imported here: run it on its own (it writes art/generated/kit/models/cage.glb
and touches public/ only with `-- --install`).

Exit code 0 when every module imported, 1 otherwise. Nothing is written.
"""
import importlib
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

GENERATORS = ['build_nature', 'build_wilds', 'build_worlds_bright', 'build_worlds_harsh', 'build_dressing', 'build_creatures', 'build_titans', 'build_titan_icons']
LIBRARIES = ['style', 'build_weapons', 'hero_spec', 'build_items']

failed = []
for name in LIBRARIES + GENERATORS:
    try:
        module = importlib.import_module(name)
        entry = 'main' if hasattr(module, 'main') else '-'
        print(f'IMPORT OK   {name:22s} entry: {entry:5s} file: {os.path.basename(module.__file__)}')
    except Exception:  # noqa: BLE001 - report every failure, then fail at the end
        failed.append(name)
        print(f'IMPORT FAIL {name}')
        traceback.print_exc()

import bpy  # noqa: E402
print(f'Blender {bpy.app.version_string}: {len(LIBRARIES) + len(GENERATORS) - len(failed)} of {len(LIBRARIES) + len(GENERATORS)} modules imported')
sys.exit(1 if failed else 0)
