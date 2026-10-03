# Asset provenance and rendering

The user requested reuse of their local reference projects. The reference projects were read and copied selectively; their source files were not modified.

| Runtime content | Local source | Adaptation |
|---|---|---|
| Crops, fruit, fish, scenery, animals, market stalls, well, kitchen, chest, garden bed | `cute_game/public/assets/models/` | Copied original GLB assets; named kit pieces loaded individually, colours baked into merged geometry; crop sprites rendered from the 3D models at startup |
| Adult character bodies | `cute_game/public/assets/models/hero-tall.glb`, `hero-girl-tall.glb` | Slimmed horizontal proportions, removed head sprout, recoloured shirts, rigid limb walking animation; smaller child variants |
| Indoor furniture | `cute_game/public/assets/models/house.glb` | Shared named meshes arranged into walkable cutaway rooms; purchased furniture and household upgrades alter the player’s room |
| Flying forest hawk | `cute_game/public/assets/models/forest-birds.glb` | Body and two rigid wing pivots baked separately; five pooled hawks with flap/glide animation |
| Flying gull | `race3D_game/public/models/bird.glb` | Copied as `field-gull.glb`; nine pooled gulls, three merged parts each |
| Rod fishing interaction | `cute_game/src/fishing.ts`, `src/fishing-view.ts`, `src/world.ts` | Cast/nibble/bite/tension simulation adapted to this game; bamboo rod attached to the supplied character’s hand, curved line, kit bobber, approach and landing animations |
| Item icons | `cute_game/public/assets/icons/` | Existing crop, fish and material icons; local relative URLs |
| Family houses, school, clinic, police station, Willow & Co. office (`town.glb`) | New: `art/blender/build_town.py` using the copied `cute_game` kit style (`art/blender/style.py`) | One mesh per building; family houses recolour their `Roof`, `Roof Trim` and `Accent` materials at load and bake to one draw. Preview: `art/previews/town.webp` |
| American rural kit (`rural.glb`): homes `home_t0`–`home_t3`, neighbour farmhouses `farm_a`–`farm_d`, barn, silo, picket and split-rail fences, mailbox, windmill + `windmill_rotor`, round hay bale, tractor, pond dock, stump | New: `art/blender/build_rural.py` using the same kit style (`art/blender/style.py`) | One joined mesh per piece. Homes and farmhouses share the family materials `Siding`, `Roof`, `Roof Trim` and `Accent`. The contract (footprints, windmill hub at (0, 6.25, 0.62)) is in the generator docstring. Preview: `art/previews/rural.webp`. No sibling-repo asset was reused: none of the user's other games has barns, silos, farmhouses, mailboxes, windmills or tractors. The nearest candidates were `3D_game_scene/public/models/{haybale,stump,dock,fence-wood}.glb` and `cute_game/public/assets/models/farm.glb` (`hay_bale`, `pen_fence`). They were reviewed and rejected because they are the wrong type (a square bale, a pen fence) or a muted style that does not match the vivid kit |
| Jeep and motorcycle | `rambo/_3D/public/models/` | Scaled for the village; the jeep’s `jeep_Turret` and weapon descendants are removed before geometry is prepared |
| House direction | `3D_game_scene/src/world/interiors.js` and project documentation | Architectural and enterable-room reference only; simplified house geometry and layouts are newly authored here |
| Nunito variable font | `cute_game/node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2` | Self-hosted; upstream font license included at `public/assets/FONT-LICENSE.txt` |

The `cute_game/art/ASSET_GUIDE.md` states that its Blender art is original, with no reference-game assets extracted. The original editable Blender files remain in the reference project. No raw Blender authoring files, account data, environment files or secrets are published by this project.

No AI raster artwork or external CDN art was added. UI icons are small inline SVGs, crop billboards are rendered locally from the supplied GLBs, and the map is drawn with Canvas 2D.

The hashes in `asset-manifest.json` record the exact copied runtime model files. At runtime the jeep is made civilian by omitting its weapon assembly. This does not modify the reference model on disk.
