# Character model asset

The supplied archive is stored at:

`assets/models/human-models-set-malefemale-rigged.zip`

The game extracts `source/HumanModels.glb` from this ZIP in the browser at runtime. You do not need to extract or upload a second copy of the GLB.

The GLB contains:
- `Man`: rigged male character
- `Woman`: rigged female character
- `Man (NonRig)` and `Woman (NonRig)`: non-rigged variants
- `Man (HighPoly)` and `Woman (HighPoly)`: high-poly variants

The rigged variants each contain a 152-joint skeleton. The file contains no animation clips, so characters load in their bind pose until procedural pose / animation logic is added.

The runtime loader in `src/characters/CharacterFactory.js` reads the ZIP from this directory, extracts only the rigged GLB entry, and hides the extra variants. Keep the archive filename and internal GLB path unchanged unless the loader is updated too.
