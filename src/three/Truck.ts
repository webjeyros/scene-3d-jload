import * as THREE from 'three'
import { loadFBX } from './FBX'

export type TruckOptions = { scale?: number, animateWheels?: boolean }

// Normalize and place truck parts relative to cargo body dims
export async function buildTruck(root: THREE.Group, dims: { ln:number, wd:number, hg:number }, opts: TruckOptions = {}){
  const scale = opts.scale ?? 0.01
  const truck = new THREE.Group()
  truck.name = 'truck'

  // Load assets
  const [head, wheels, panel, panelC] = await Promise.all([
    loadFBX('/models/truck_head.fbx', scale),
    loadFBX('/models/wheels.fbx', scale),
    loadFBX('/models/panel.fbx', scale),
    loadFBX('/models/panel_c.fbx', scale)
  ])

  // Ensure clean transforms
  ;[head, wheels, panel, panelC].forEach(o=>{
    o.position.set(0,0,0); o.rotation.set(0,0,0); o.updateMatrixWorld()
  })

  const L = dims.ln
  const W = dims.wd
  const H = dims.hg

  // Build cargo body: floor + sides + back, all centered on positive quadrant
  const body = new THREE.Group(); body.name='cargo-body'
  const floor = panel.clone(); floor.scale.set(L, 0.02, W); floor.position.set(L/2, 0.0, W/2)
  const left = panelC.clone(); left.scale.set(L, H, 0.02); left.position.set(L/2, H/2, 0)
  const right = panelC.clone(); right.scale.set(L, H, 0.02); right.position.set(L/2, H/2, W)
  const back = panelC.clone(); back.scale.set(0.02, H, W); back.position.set(L, H/2, W/2)
  body.add(floor,left,right,back)

  // Place cabin flush to body front (slightly negative X), sit on ground Y=0
  const cabinBBox = new THREE.Box3().setFromObject(head)
  const cabinSize = new THREE.Vector3(); cabinBBox.getSize(cabinSize)
  const cabinLen = cabinSize.x || 1
  head.position.set(-cabinLen*0.9, 0, W/2 - cabinSize.z/2)

  // Wheels: align under body center line, Y at ground
  const wheelsBBox = new THREE.Box3().setFromObject(wheels)
  const wheelsSize = new THREE.Vector3(); wheelsBBox.getSize(wheelsSize)
  wheels.position.set(L*0.5, 0, W/2)

  // Guard against NaN scales/positions
  head.updateMatrixWorld(true); wheels.updateMatrixWorld(true); body.updateMatrixWorld(true)

  truck.add(body, head, wheels)
  root.add(truck)
}
