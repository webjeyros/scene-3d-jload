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

export async function loadCargoMesh(kind: 'pallet'|'pallet_box'|'box', size:{ln:number,wd:number,hg:number}){
  try{
    if(kind==='pallet_box'){
      const fbx = await loadFBX('/models/pallet_box.fbx', 0.01)
      const box = new THREE.Box3().setFromObject(fbx); const s=new THREE.Vector3(); box.getSize(s)
      const sx = size.ln/(s.x||1), sy=size.hg/(s.y||1), sz=size.wd/(s.z||1)
      fbx.scale.multiply(new THREE.Vector3(sx,sy,sz))
      return fbx
    }
    if(kind==='pallet'){
      const fbx = await loadFBX('/models/pallet.fbx', 0.01)
      const box = new THREE.Box3().setFromObject(fbx); const s=new THREE.Vector3(); box.getSize(s)
      const sx = size.ln/(s.x||1), sy=size.hg/(s.y||1), sz=size.wd/(s.z||1)
      fbx.scale.multiply(new THREE.Vector3(sx,sy,sz))
      return fbx
    }
  }catch(_e){ /* fallback to box */ }
  const mat = new THREE.MeshLambertMaterial({ color: 0x6aaaff, transparent:true, opacity:.9 })
  return new THREE.Mesh(new THREE.BoxGeometry(size.ln, size.hg, size.wd), mat)
}
