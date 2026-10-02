# Asset provenance and rendering

The user requested reuse of their local reference projects. The reference projects were read and copied selectively; their source files were not modified.

| Runtime content | Local source | Adaptation |
|---|---|---|
| Crops, fruit, fish, scenery, animals, market stalls, well, kitchen, chest, garden bed | `cute_game/public/assets/models/` | Copied original GLB assets; named kit pieces loaded individually, colours baked into merged geometry; crop sprites rendered from the 3D models at startup |
| Adult character bodies | `cute_game/public/assets/models/hero-tall.glb`, `hero-girl-tall.glb` | Slimmed horizontal proportions, removed head sprout, recoloured shirts, rigid limb walking animation; smaller child variants |
| Indoor furniture | `cute_game/public/assets/models/house.glb` | Shared named meshes arranged into walkable cutaway rooms; purchased furniture and household upgrades alter the player’s room |
| Item icons | `cute_game/public/assets/icons/` | Existing crop, fish and material icons; local relative URLs |
| Jeep and motorcycle | `rambo/_3D/public/models/` | Scaled for the village; the jeep’s `jeep_Turret` and weapon descendants are removed before geometry is prepared |
| House direction | `3D_game_scene/src/world/interiors.js` and project documentation | Architectural and enterable-room reference only; simplified house geometry and layouts are newly authored here |
| Nunito variable font | `cute_game/node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2` | Self-hosted; upstream font license included at `public/assets/FONT-LICENSE.txt` |

The `cute_game/art/ASSET_GUIDE.md` states that its Blender art is original, with no reference-game assets extracted. The original editable Blender files remain in the reference project. No raw Blender authoring files, account data, environment files or secrets are published by this project.

No AI raster artwork or external CDN art was added. UI icons are small inline SVGs, houses are code geometry, crop billboards are rendered locally from the supplied GLBs, and the map is drawn with Canvas 2D.

The hashes in `asset-manifest.json` record the exact copied runtime model files. At runtime the jeep is made civilian by omitting its weapon assembly. This does not modify the reference model on disk.
