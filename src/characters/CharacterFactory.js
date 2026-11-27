import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/SkeletonUtils.js";

const MODEL_URL = new URL("../../assets/models/HumanModels.glb", import.meta.url);
const RIG_NAMES = Object.freeze({
  male: "Man",
  female: "Woman"
});

let modelPromise = null;

function loadModel() {
  if (!modelPromise) {
    modelPromise = new GLTFLoader().loadAsync(MODEL_URL.href).catch(error => {
      modelPromise = null;
      throw new Error(`Unable to load procedural character pack at ${MODEL_URL.pathname}: ${error.message}`);
    });
  }
  return modelPromise;
}

/**
 * Creates a normalized, rigged character instance.
 *
 * The source GLB contains both rigged characters and additional non-rigged /
 * high-poly variants. We clone the complete scene so SkeletonUtils can remap
 * all 152 bones correctly, then show only the requested rigged mesh.
 *
 * @param {{gender?: "male"|"female", height?: number}} options
 * @returns {Promise<THREE.Group>}
 */
export async function createCharacter({ gender = "male", height = 1.72 } = {}) {
  const nodeName = RIG_NAMES[gender];
  if (!nodeName) throw new Error(`Unsupported character gender: ${gender}`);

  const gltf = await loadModel();
  const instance = cloneSkeleton(gltf.scene);
  const selected = instance.getObjectByName(nodeName);

  if (!selected?.isSkinnedMesh) {
    throw new Error(`Rigged character node "${nodeName}" was not found in HumanModels.glb`);
  }

  instance.traverse(object => {
    if (object.isMesh) {
      object.visible = object === selected;
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = false;
    }
  });

  const bounds = new THREE.Box3().setFromObject(selected);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) {
    throw new Error(`Character "${nodeName}" has invalid model bounds`);
  }

  const scale = height / size.y;
  instance.scale.setScalar(scale);
  instance.updateMatrixWorld(true);
  const normalizedBounds = new THREE.Box3().setFromObject(selected);
  const center = normalizedBounds.getCenter(new THREE.Vector3());
  instance.position.set(-center.x, -normalizedBounds.min.y, -center.z);
  instance.userData.characterGender = gender;
  instance.userData.rigged = true;
  instance.userData.hasAnimationClips = gltf.animations.length > 0;
  instance.userData.skeleton = selected.skeleton;

  return instance;
}

/** Returns the two supported character choices for UI / lobby use. */
export function getCharacterChoices() {
  return Object.freeze([
    Object.freeze({ id: "male", label: "Male", rigNode: RIG_NAMES.male }),
    Object.freeze({ id: "female", label: "Female", rigNode: RIG_NAMES.female })
  ]);
}
