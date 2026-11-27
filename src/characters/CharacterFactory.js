import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/SkeletonUtils.js";

const MODEL_ZIP_URL = new URL("../../assets/models/human-models-set-malefemale-rigged.zip", import.meta.url);
const MODEL_ENTRY = "source/HumanModels.glb";
const RIG_NAMES = Object.freeze({
  male: "Man",
  female: "Woman"
});

let modelPromise = null;

async function extractZipEntry(zipBuffer, wantedName) {
  const view = new DataView(zipBuffer);
  const bytes = new Uint8Array(zipBuffer);
  const decoder = new TextDecoder();
  const minEocd = Math.max(0, bytes.length - 65557);
  let eocd = -1;

  for (let offset = bytes.length - 22; offset >= minEocd; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP central directory was not found");

  const entryCount = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory entry");
    }
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

    if (name === wantedName) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error("Invalid ZIP local file header");
      }
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);

      let result;
      if (method === 0) {
        result = compressed.buffer;
      } else if (method === 8) {
        if (typeof DecompressionStream === "undefined") {
          throw new Error("This browser cannot decompress the character ZIP");
        }
        const stream = new Blob([compressed]).stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));
        result = await new Response(stream).arrayBuffer();
      } else {
        throw new Error(`Unsupported ZIP compression method: ${method}`);
      }

      if (result.byteLength !== uncompressedSize) {
        throw new Error("Extracted character model size does not match ZIP metadata");
      }
      return result;
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`The ZIP does not contain ${wantedName}`);
}

function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const response = await fetch(MODEL_ZIP_URL.href);
      if (!response.ok) throw new Error(`Character ZIP request failed: HTTP ${response.status}`);
      const zipBuffer = await response.arrayBuffer();
      const glbBuffer = await extractZipEntry(zipBuffer, MODEL_ENTRY);
      return new GLTFLoader().parseAsync(glbBuffer, MODEL_ZIP_URL.href);
    })().catch(error => {
      modelPromise = null;
      throw new Error(`Unable to load character model from ${MODEL_ZIP_URL.pathname}: ${error.message}`);
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
