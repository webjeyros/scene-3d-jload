import * as THREE from 'three'
import { loadFBX } from './FBX'

export type TruckOptions = { scale?: number, animateWheels?: boolean, offsets?: { x?: number, y?: number, z?: number } }

// Deterministic placement with explicit offsets and strict centering
export async function buildTruck(root: THREE.Group, dims: { ln:number, wd:number, hg:number }, opts: TruckOptions = {}){
  const scale = opts.scale ?? 0.01
  const off = opts.offsets ?? {}
  const truck = new THREE.Group(); truck.name='truck'

  const [head, wheels, panel, panelC] = await Promise.all([
    loadFBX('/models/truck_head.fbx', scale),
    loadFBX('/models/wheels.fbx', scale),
    loadFBX('/models/panel.fbx', scale),
    loadFBX('/models/panel_c.fbx', scale)
  ])

  ;[head,wheels,panel,panelC].forEach(o=>{ o.position.set(0,0,0); o.rotation.set(0,0,0); o.updateMatrixWorld(true) })

  const L=dims.ln, W=dims.wd, H=dims.hg

  const body = new THREE.Group(); body.name='cargo-body'
  const floor = panel.clone(); floor.scale.set(L, 0.02, W); floor.position.set(L/2, 0.01, W/2)
  const left = panelC.clone(); left.scale.set(L, H, 0.02); left.position.set(L/2, H/2, 0)
  const right = panelC.clone(); right.scale.set(L, H, 0.02); right.position.set(L/2, H/2, W)
  const back = panelC.clone(); back.scale.set(0.02, H, W); back.position.set(L, H/2, W/2)
  body.add(floor,left,right,back)

  // Orient cabin X-forward
  const bbPre = new THREE.Box3().setFromObject(head); const szPre = new THREE.Vector3(); bbPre.getSize(szPre)
  if (szPre.z > szPre.x) { head.rotation.y = -Math.PI/2; head.updateMatrixWorld(true) }

  const bbCab = new THREE.Box3().setFromObject(head); const cs = new THREE.Vector3(); bbCab.getSize(cs)
  // If bbox extremely large/small (bad FBX), normalize to reasonable cabin estimate
  if (!isFinite(cs.x) || cs.x<0.2 || cs.x>5) { cs.set(1.6, 2.2, 2.4) } // fallback typical truck head ~meters

  // Place cabin exactly in front with optional fine offsets
  const xCab = (-cs.x) + (off.x ?? 0)
  const yCab = (off.y ?? 0)
  const zCab = (W*0.5 - cs.z*0.5) + (off.z ?? 0)
  head.position.set(xCab, yCab, zCab)

  // Wheels position
  const xWh = L*0.7
  const yWh = 0
  const zWh = W*0.5
  wheels.position.set(xWh, yWh, zWh)

  truck.add(body, head, wheels)
  root.add(truck)
}
