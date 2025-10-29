import * as THREE from 'three'
import { loadFBX } from '../three/FBX'

export type TruckOptions = { scale?: number, animateWheels?: boolean, offsets?: { x?: number, y?: number, z?: number }, wheelOffset?: { x?: number, y?: number, z?: number } }

export async function buildTruck(root: THREE.Group, dims: { ln:number, wd:number, hg:number }, opts: TruckOptions = {}){
  const scale = opts.scale ?? 0.01
  const off = opts.offsets ?? {}
  const woff = opts.wheelOffset ?? {}
  const truck = new THREE.Group(); truck.name='truck'

  const [head, wheels] = await Promise.all([
    loadFBX('/models/truck_head.fbx', scale),
    loadFBX('/models/wheels.fbx', scale)
  ])

  ;[head,wheels].forEach(o=>{ o.position.set(0,0,0); o.rotation.set(0,0,0); o.updateMatrixWorld(true) })

  const L=dims.ln, W=dims.wd, H=dims.hg

  // Orient cabin X-forward if needed
  const bbPre = new THREE.Box3().setFromObject(head); const szPre = new THREE.Vector3(); bbPre.getSize(szPre)
  if (szPre.z > szPre.x) { head.rotation.y = -Math.PI/2; head.updateMatrixWorld(true) }

  const bbCab = new THREE.Box3().setFromObject(head); const cs = new THREE.Vector3(); bbCab.getSize(cs)
  if (!isFinite(cs.x) || cs.x<0.2 || cs.x>5) { cs.set(1.6, 2.2, 2.4) }

  head.position.set((-cs.x) + (off.x ?? 0), (off.y ?? 0), (W*0.5 - cs.z*0.5) + (off.z ?? 0))

  // Wheels orientation and placement
  const wb = new THREE.Box3().setFromObject(wheels); const ws = new THREE.Vector3(); wb.getSize(ws)
  if (ws.z > ws.x) { wheels.rotation.y = -Math.PI/2; wheels.updateMatrixWorld(true) }
  wheels.position.set(L*0.65 + (woff.x ?? 0), 0 + (woff.y ?? 0), W*0.5 + (woff.z ?? 0))

  // Simple cargo body as wireframe box
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), new THREE.MeshLambertMaterial({ color: 0x87c38f, wireframe:true, transparent:true, opacity:.12 }))
  body.position.set(L/2, H/2, W/2)

  truck.add(body, head, wheels)
  root.add(truck)
}
