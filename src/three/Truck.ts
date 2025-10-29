import * as THREE from 'three'
import { loadFBX } from './FBX'

export type TruckOptions = { scale?: number, animateWheels?: boolean }

// Heuristic placement that aligns cabin and wheelset with cargo body
export async function buildTruck(root: THREE.Group, dims: { ln:number, wd:number, hg:number }, opts: TruckOptions = {}){
  const scale = opts.scale ?? 0.01
  const truck = new THREE.Group(); truck.name='truck'

  const [head, wheels, panel, panelC] = await Promise.all([
    loadFBX('/models/truck_head.fbx', scale),
    loadFBX('/models/wheels.fbx', scale),
    loadFBX('/models/panel.fbx', scale),
    loadFBX('/models/panel_c.fbx', scale)
  ])

  ;[head,wheels,panel,panelC].forEach(o=>{ o.position.set(0,0,0); o.rotation.set(0,0,0); o.updateMatrixWorld() })

  const L=dims.ln, W=dims.wd, H=dims.hg

  // Cargo body in +X/+Z
  const body = new THREE.Group(); body.name='cargo-body'
  const floor = panel.clone(); floor.scale.set(L, 0.02, W); floor.position.set(L/2, 0.0, W/2)
  const left = panelC.clone(); left.scale.set(L, H, 0.02); left.position.set(L/2, H/2, 0)
  const right = panelC.clone(); right.scale.set(L, H, 0.02); right.position.set(L/2, H/2, W)
  const back = panelC.clone(); back.scale.set(0.02, H, W); back.position.set(L, H/2, W/2)
  body.add(floor,left,right,back)

  // Compute cabin bbox in its local space
  const cabinBBox = new THREE.Box3().setFromObject(head)
  const cabinSize = new THREE.Vector3(); cabinBBox.getSize(cabinSize)

  // Some models are oriented Z-forward; align so X-forward
  if (cabinSize.z > cabinSize.x) {
    head.rotation.y = -Math.PI/2
    head.updateMatrixWorld(true)
  }

  // Re-calc after rotation
  const cabinBBox2 = new THREE.Box3().setFromObject(head)
  const cs = new THREE.Vector3(); cabinBBox2.getSize(cs)

  // Place cabin just before body at X = -cs.x, centered by Z
  head.position.set(-cs.x*0.55, 0, W*0.5 - cs.z*0.5)

  // Wheels alignment: under body centerline, a bit inset from rear
  const wheelsBBox = new THREE.Box3().setFromObject(wheels)
  const ws = new THREE.Vector3(); wheelsBBox.getSize(ws)
  wheels.position.set(L*0.65, 0, W*0.5)

  // Final grouping
  truck.add(body, head, wheels)
  root.add(truck)
}
