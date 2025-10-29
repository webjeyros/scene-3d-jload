import * as THREE from 'three'
import { loadFBX } from './FBX'

export type TruckOptions = { scale?: number, animateWheels?: boolean }

export async function buildTruck(root: THREE.Group, dims: { ln:number, wd:number, hg:number }, opts: TruckOptions = {}){
  const scale = opts.scale ?? 0.01
  const truck = new THREE.Group()
  truck.name = 'truck'

  const head = await loadFBX('/models/truck_head.fbx', scale)
  const wheels = await loadFBX('/models/wheels.fbx', scale)
  const panel = await loadFBX('/models/panel.fbx', scale)
  const panelC = await loadFBX('/models/panel_c.fbx', scale)

  // Align axes: X forward (length), Z right (width), Y up (height)
  head.rotation.set(0, 0, 0)
  head.position.set(0, 0, 0)
  wheels.position.set(0, 0, 0)

  const body = new THREE.Group()
  const L = dims.ln, W = dims.wd, H = dims.hg

  // Simple body from panels, floor at y=0
  const floor = panel.clone(); floor.scale.set(L, 0.02, W); floor.position.set(L/2, 0.01, W/2)
  const left = panelC.clone(); left.scale.set(L, H, 0.02); left.position.set(L/2, H/2, 0)
  const right = panelC.clone(); right.scale.set(L, H, 0.02); right.position.set(L/2, H/2, W)
  const back = panelC.clone(); back.scale.set(0.02, H, W); back.position.set(L, H/2, W/2)

  body.add(floor, left, right, back)

  // Place cabin near x= -L*0.15 visually
  head.position.x = -Math.min(1.5, L*0.15)
  wheels.position.y = 0

  truck.add(head, wheels, body)
  root.add(truck)

  // Optional simple wheel animation binding
  if (opts.animateWheels) {
    (truck as any).__animate = (delta:number)=>{
      wheels.traverse((c:any)=>{ if(c.isMesh){ c.rotation.x += delta*0.5 } })
    }
  }
}
