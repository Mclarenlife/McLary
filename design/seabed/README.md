# McLary seabed models

`McLary-seabed.blend` contains the authored galleon and limestone ruins in separate collections. The ruin collection is hidden in the saved wreck review view; enable it in the Outliner to edit it. Materials and generated textures are packed into the Blend file.

The ship includes solid curved planks, frames, a breached hold, raised stern cabin, cannon ports, deck gratings, stairs, a capstan, barrels, shrouds, ratlines, crow's nests, torn sails and barnacle growth. The masonry includes individual fluted stone drums, mouldings, carved capitals, stepped foundations, arch voussoirs and rubble.

The 17 columns now have individually seeded silhouettes: diagonal and stepped fractures, hollow-looking broken rims, shifted drums, and partial scroll or split capitals. Foreground stumps expose their fracture cores; taller survivors retain the distant architectural scale. `asset-stats.json` records their placements and profiles. Stone uses quiet mineral grain, sparse algae, world-scaled planar mapping on blocks and cylindrical mapping on shafts, with fractional offsets per piece instead of a repeated full-image square.

Regenerate using Blender:

```powershell
blender --background --factory-startup --python scripts/build-seabed-assets.py
```

The generator saves this editable source, a studio render in `artifacts/blender-wreck-review.png`, and Draco-compressed GLB files in `public/models`. The website preloads both assets before entering the experience, with local decoder files and an existing procedural fallback for loading failures.

All model geometry and material textures were authored for this project. The bundled decoder is from the installed Three.js package; its license is included beside the decoder files.
