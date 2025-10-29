import * as THREE from 'three'
import { loadFBX } from './FBX'

export type TruckOptions = { scale?: number, animateWheels?: boolean }

// Deterministic placement: cabin exactly at X=0..cabinLen, body strictly [0..L]x[0..W] at Y=0
export async function buildTruck(root: THREE.Group, dims: { ln:number, wd:number, hg:number }, opts: TruckOptions = {}){
  const scale = opts.scale ?? 0.01
  const truck = new THREE.Group(); truck.name='truck'

  const [head, wheels, panel, panelC] = await Promise.all([
    loadFBX('/models/truck_head.fbx', scale),
    loadFBX('/models/wheels.fbx', scale),
    loadFBX('/models/panel.fbx', scale),
    loadFBX('/models/panel_c.fbx', scale)
  ])

  // Reset transforms
  ;[head,wheels,panel,panelC].forEach(o=>{ o.position.set(0,0,0); o.rotation.set(0,0,0); o.scale.multiplyScalar(1); o.updateMatrixWorld(true) })

  const L=dims.ln, W=dims.wd, H=dims.hg

  // Body aligned to +X/+Z on ground
  const body = new THREE.Group(); body.name='cargo-body'
  const floor = panel.clone(); floor.scale.set(L, 0.02, W); floor.position.set(L/2, 0.01, W/2)
  const left = panelC.clone(); left.scale.set(L, H, 0.02); left.position.set(L/2, H/2, 0)
  const right = panelC.clone(); right.scale.set(L, H, 0.02); right.position.set(L/2, H/2, W)
  const back = panelC.clone(); back.scale.set(0.02, H, W); back.position.set(L, H/2, W/2)
  body.add(floor,left,right,back)

  // Compute cabin bbox and re-orient so X is forward
  const orientCabinXForward = () => {
    const bb = new THREE.Box3().setFromObject(head); const s = new THREE.Vector3(); bb.getSize(s)
    if (s.z > s.x) { head.rotation.y = -Math.PI/2; head.updateMatrixWorld(true) }
  }
  orientCabinXForward()
  // Recompute size after rotate
  const bb2 = new THREE.Box3().setFromObject(head); const cs = new THREE.Vector3(); bb2.getSize(cs)

  // Place cabin strictly before body: [ -cs.x .. 0 ] along X, centered by Z
  head.position.set(-cs.x * 0.98, 0, W*0.5 - cs.z*0.5)

  // Wheels: under body centerline; shift to rear third
  const wb = new THREE.Box3().setFromObject(wheels); const ws = new THREE.Vector3(); wb.getSize(ws)
  wheels.position.set(L*0.7, 0, W*0.5)

  // Final group
  truck.add(body, head, wheels)
  root.add(truck)
}
