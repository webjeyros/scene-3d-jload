import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CargoItem, LoadArea } from '../types'
import { packItems, snapTo, type PackSettings } from './packing'
import { loadCargoMesh } from './models'

export type SceneEngine = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  root: HTMLElement
  input: {
    onMouseDown(e:MouseEvent):void
    onMouseUp():void
    onMouseMove(e:MouseEvent):void
    onKey(e:KeyboardEvent):void
  }
  setLoad(load: LoadArea|undefined): void
  setItems(items: CargoItem[]): void
  setSettings(s: Partial<PackSettings>): void
  getPlacements(): { id:number, x:number, y:number, z:number, rx:number, ry:number, rz:number }[]
  render(): void
  dispose(): void
  screenshot(): Promise<Blob|null>
}

export function createSceneEngine(root: HTMLElement): SceneEngine {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf7f9fc)

  const width = root.clientWidth
  const height = root.clientHeight || 600

  const camera = new THREE.PerspectiveCamera(60, width/height, 0.01, 300)
  camera.position.set(4,3,4)

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  root.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = true
  controls.target.set(0,0.75,0)

  // Lights & helpers
  scene.add(new THREE.AmbientLight(0xffffff, .8))
  const dir = new THREE.DirectionalLight(0xffffff, .8); dir.position.set(3,5,2); scene.add(dir)
  const grid = new THREE.GridHelper(20, 20, 0x999999, 0xcccccc); grid.position.y=0; scene.add(grid)
  const axes = new THREE.AxesHelper(2); scene.add(axes)

  // Groups
  const rootGroup = new THREE.Group()
  const loadsGroup = new THREE.Group()
  const itemsGroup = new THREE.Group()
  const excludedGroup = new THREE.Group()
  rootGroup.add(loadsGroup, itemsGroup, excludedGroup)
  scene.add(rootGroup)

  const matExcluded = new THREE.MeshLambertMaterial({ color: 0xff6f6a, transparent:true, opacity:.7 })

  // State
  let currentLoad: LoadArea | undefined
  let currentItems: CargoItem[] = []
  let settings: PackSettings = { snap:.05, allowHang:.05, supportRatioMin:.6, units:{ size:'m', weight:'kg' } }
  let lastPlacements: { id:number, x:number, y:number, z:number, rx:number, ry:number, rz:number }[] = []

  let frame = 0
  let activeMesh: THREE.Object3D | null = null

  function resize(){ const w=root.clientWidth, h=root.clientHeight||600; camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h) }
  window.addEventListener('resize', resize)

  function setLoad(load?: LoadArea){
    currentLoad = load
    while(loadsGroup.children.length) loadsGroup.remove(loadsGroup.children[0])
    if(!load) return
    const geo = new THREE.BoxGeometry(load.ln, load.hg, load.wd)
    const mat = new THREE.MeshLambertMaterial({ color: 0x87c38f, wireframe: true, transparent:true, opacity:.15 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(load.ln/2, load.hg/2, load.wd/2)
    loadsGroup.add(mesh)
  }

  function setSettings(s: Partial<PackSettings>){ settings = { ...settings, ...s } ; rebuild() }

  async function rebuild(){
    while(itemsGroup.children.length) itemsGroup.remove(itemsGroup.children[0])
    while(excludedGroup.children.length) excludedGroup.remove(excludedGroup.children[0])
    lastPlacements = []
    if(!currentLoad) return
    const { placements, excluded } = packItems(currentItems, currentLoad, settings)
    for(const p of placements){
      const it = currentItems.find(i=> i.id===p.id)!
      const kind: any = it.pg===1? 'pallet': (it.pg===2? 'pallet_box': 'box')
      const mesh = await loadCargoMesh(kind, { ln:p.size.ln, wd:p.size.wd, hg:p.size.hg })
      mesh.userData.__item = it
      mesh.position.copy(p.pos)
      mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2])
      itemsGroup.add(mesh)
      lastPlacements.push({ id:it.id, x:p.pos.x, y:p.pos.y, z:p.pos.z, rx:p.rot[0], ry:p.rot[1], rz:p.rot[2] })
    }
    for(const p of excluded){
      const it = currentItems.find(i=> i.id===p.id)!
      const geo = new THREE.BoxGeometry(p.size.ln, p.size.hg, p.size.wd)
      const box = new THREE.Mesh(geo, matExcluded.clone())
      box.userData.__item = it
      const px = p.pos?.x ?? snapTo(p.size.ln/2, settings.snap)
      const pz = p.pos?.z ?? snapTo(p.size.wd/2, settings.snap)
      const py = p.pos?.y ?? snapTo(p.size.hg/2, settings.snap)
      box.position.set(px, py, pz)
      excludedGroup.add(box)
    }
  }

  function setItems(items: CargoItem[]){ currentItems = items.slice(); rebuild() }
  function render(){ frame = requestAnimationFrame(render); controls.update(); renderer.render(scene, camera) }
  function dispose(){ cancelAnimationFrame(frame); window.removeEventListener('resize', resize); controls.dispose(); renderer.dispose(); scene.clear() }
  function screenshot(): Promise<Blob|null>{ return new Promise(resolve=> renderer.domElement.toBlob(b=> resolve(b))) }
  function getPlacements(){ return lastPlacements.slice() }

  // Input (drag/rotate)
  const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2()
  let dragging=false; let dragTarget: THREE.Object3D | null = null

  function setRay(e:MouseEvent){ const r = renderer.domElement.getBoundingClientRect(); mouse.x=((e.clientX-r.left)/r.width)*2-1; mouse.y= -((e.clientY-r.top)/r.height)*2+1; raycaster.setFromCamera(mouse, camera) }

  function onMouseDown(e:MouseEvent){ if(e.button!==0) return; setRay(e); const hit = raycaster.intersectObjects([...itemsGroup.children],true)[0]; if(hit){ dragging=true; dragTarget = hit.object; activeMesh = hit.object } }
  function onMouseUp(){ dragging=false; dragTarget=null }
  function onMouseMove(e:MouseEvent){ if(!dragging||!dragTarget||!currentLoad) return; setRay(e); const bbox = new THREE.Box3().setFromObject(dragTarget); const size = new THREE.Vector3(); bbox.getSize(size); const y = size.y/2; const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -y); const p = new THREE.Vector3(); raycaster.ray.intersectPlane(plane,p); const step=settings.snap||.05; p.x=snapTo(p.x,step); p.z=snapTo(p.z,step); const L=currentLoad.ln, W=currentLoad.wd; p.x=THREE.MathUtils.clamp(p.x,size.x/2,L-size.x/2); p.z=THREE.MathUtils.clamp(p.z,size.z/2,W-size.z/2); dragTarget.position.x=p.x; dragTarget.position.z=p.z }
  function onKey(e:KeyboardEvent){ if(!activeMesh) return; if(e.key==='ArrowLeft' || e.key==='ArrowRight'){ const s = (e.key==='ArrowLeft'? -1:1); activeMesh.rotation.y += s*Math.PI/2 } if(e.key==='ArrowUp' || e.key==='ArrowDown'){ const s = (e.key==='ArrowUp'? -1:1); activeMesh.rotation.x += s*Math.PI/2 } }

  return { scene, camera, renderer, controls, root, input:{ onMouseDown,onMouseUp,onMouseMove,onKey }, setLoad, setItems, setSettings, getPlacements, render, dispose, screenshot }
}
