import * as THREE from 'three'
import { loadFBX } from './FBX'

export async function buildTruck(root: THREE.Group, dims: { ln:number, wd:number, hg:number }){
  const truck = new THREE.Group()
  truck.name = 'truck'

  // Load parts from jload repo paths (models should be copied under public/models)
  const head = await loadFBX('/models/truck_head.fbx', 0.01)
  const wheels = await loadFBX('/models/wheels.fbx', 0.01)
  const panel = await loadFBX('/models/panel.fbx', 0.01)
  const panelC = await loadFBX('/models/panel_c.fbx', 0.01)

  // Positioning: floor at y=0, truck head near x=0
  head.position.set(0, 0, 0)
  wheels.position.set(0, 0, 0)

  // Scale/load body panels to match dims
  const body = new THREE.Group()
  const length = dims.ln
  const width = dims.wd
  const height = dims.hg

  const floor = panel.clone()
  floor.scale.set(length, 0.02, width)
  floor.position.set(length/2, 0.01, width/2)
  const left = panelC.clone()
  left.scale.set(length, height, 0.02)
  left.position.set(length/2, height/2, 0)
  const right = panelC.clone()
  right.scale.set(length, height, 0.02)
  right.position.set(length/2, height/2, width)
  const back = panelC.clone()
  back.scale.set(0.02, height, width)
  back.position.set(length, height/2, width/2)

  body.add(floor, left, right, back)

  truck.add(head, wheels, body)
  root.add(truck)
}
