// Responsible for loading FBX assets with caching and unit normalization (meters)
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as THREE from 'three'

const cache = new Map<string, THREE.Object3D>()

export async function loadFBX(path: string, scaleToMeters = 1): Promise<THREE.Object3D> {
  if (cache.has(path)) return cache.get(path)!.clone()
  const loader = new FBXLoader()
  const obj = await loader.loadAsync(path)
  obj.traverse((child: any) => {
    if (child.isMesh) {
      child.castShadow = false
      child.receiveShadow = true
    }
  })
  obj.scale.setScalar(scaleToMeters)
  cache.set(path, obj)
  return obj.clone()
}
