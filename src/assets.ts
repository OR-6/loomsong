/**
 * Asset manifest (evaluated by both the runtime and the editor; keep it pure).
 * Models are authored in Blender by tools/blender/*.py (see docs/ART-DIRECTION.md).
 */
import { AssetType, defineAssets } from '@iwsdk/core';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  loom: {
    url: publicAssetUrl('models/loom.glb'),
    type: AssetType.GLTF,
    name: 'Toy loom (frame, lever knob, bobbin)',
  },
  pip: {
    url: publicAssetUrl('models/pip.glb'),
    type: AssetType.GLTF,
    name: 'Pip, the shuttle songbird',
  },
});
