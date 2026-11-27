# Character model asset

Place the supplied `HumanModels.glb` file in this directory.

Expected path:
`assets/models/HumanModels.glb`

The GLB supplied for KORR EDORE contains:
- `Man`: rigged male character
- `Woman`: rigged female character
- `Man (NonRig)` and `Woman (NonRig)`: non-rigged variants
- `Man (HighPoly)` and `Woman (HighPoly)`: high-poly variants

The rigged variants each contain a 152-joint skeleton. The file contains no animation clips, so characters load in their bind pose until procedural pose / animation logic is added.

The runtime loader in `src/characters/CharacterFactory.js` deliberately selects only the rigged variants. It clones the full scene with Three.js SkeletonUtils so the skeleton references remain valid, then hides the extra variants.

Keep this asset local to the project. Do not rename the GLB or the rigged scene nodes without updating the loader.
