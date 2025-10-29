import * as THREE from 'three'
import { loadFBX } from './FBX'

export type TruckOptions = { scale?: number, animateWheels?: boolean, offsets?: { x?: number, y?: number, z?: number }, wheelOffset?: { x?: number, y?: number, z?: number } }

// Deterministic assembly: cargo body [0..L]x[0..W] @ Y=0; cabin [-cabX..0]; wheels anchored to body frame
export async function buildTruck(root: THREE.Group, dims: { ln:number, wd:number, hg:number }, opts: TruckOptions = {}){
  const scale = opts.scale ?? 0.01
  const off = opts.offsets ?? {}
  const woff = opts.wheelOffset ?? {}
  const truck = new THREE.Group(); truck.name='truck'

  const [head, wheels, panel, panelC] = await Promise.all([
    loadFBX('/models/truck_head.fbx', scale),
    loadFBX('/models/wheels.fbx', scale),
    loadFBX('/models/panel.fbx', scale),
    loadFBX('/models/panel_c.fbx', scale)
  ])

  // Reset transforms
  ;[head,wheels,panel,panelC].forEach(o=>{ o.position.set(0,0,0); o.rotation.set(0,0,0); o.updateMatrixWorld(true) })

  const L=dims.ln, W=dims.wd, H=dims.hg

  // Cargo body in +X/+Z
  const body = new THREE.Group(); body.name='cargo-body'
  const materialWire = new THREE.MeshLambertMaterial({ color: 0x87c38f, wireframe: true, transparent: true, opacity: .15 })
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L, 0.02, W), materialWire); floor.position.set(L/2, 0.01, W/2)
  const left  = new THREE.Mesh(new THREE.BoxGeometry(L, H, 0.02), materialWire); left.position.set(L/2, H/2, 0)
  const right = new THREE.Mesh(new THREE.BoxGeometry(L, H, 0.02), materialWire); right.position.set(L/2, H/2, W)
  const back  = new THREE.Mesh(new THREE.BoxGeometry(0.02, H, W), materialWire); back.position.set(L, H/2, W/2)
  body.add(floor,left,right,back)

  // Orient cabin X-forward
  const bbPre = new THREE.Box3().setFromObject(head); const szPre = new THREE.Vector3(); bbPre.getSize(szPre)
  if (szPre.z > szPre.x) { head.rotation.y = -Math.PI/2; head.updateMatrixWorld(true) }

  const bbCab = new THREE.Box3().setFromObject(head); const cs = new THREE.Vector3(); bbCab.getSize(cs)
  if (!isFinite(cs.x) || cs.x<0.2 || cs.x>5) { cs.set(1.6, 2.2, 2.4) }

  const xCab = (-cs.x) + (off.x ?? 0)
  const yCab = (off.y ?? 0)
  const zCab = (W*0.5 - cs.z*0.5) + (off.z ?? 0)
  head.position.set(xCab, yCab, zCab)

  // Wheels: align axle along X, centered in Z, slightly below floor if needed
  const wb = new THREE.Box3().setFromObject(wheels); const ws = new THREE.Vector3(); wb.getSize(ws)
  // Try to detect axle orientation: if ws.z > ws.x -> rotate to align along X
  if (ws.z > ws.x) { wheels.rotation.y = -Math.PI/2; wheels.updateMatrixWorld(true) }
  const xWh = L*0.65 + (woff.x ?? 0)
  const yWh = 0 + (woff.y ?? 0)
  const zWh = W*0.5 + (woff.z ?? 0)
  wheels.position.set(xWh, yWh, zWh)

  truck.add(body, head, wheels)
  root.add(truck)
}
