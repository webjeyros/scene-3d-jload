import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CargoItem, LoadArea } from '../types'

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
  rootGroup.add(loadsGroup, itemsGroup)
  scene.add(rootGroup)

  // State
  let currentLoad: LoadArea | undefined
  let currentItems: CargoItem[] = []
  let frame = 0

  function resize(){
    const w = root.clientWidth
    const h = root.clientHeight || 600
    camera.aspect = w/h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
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

  function setItems(items: CargoItem[]){
    currentItems = items.slice()
    while(itemsGroup.children.length) itemsGroup.remove(itemsGroup.children[0])
    // Простое размещение по рядам (временное, до переноса полноценной логики)
    if(!currentLoad) return
    const L=currentLoad.ln, W=currentLoad.wd, H=currentLoad.hg
    let x=0, z=0, row=0
    for(const it of currentItems){
      const count=Math.max(1, it.cn||1)
      for(let c=0;c<count;c++){
        const l=it.ln, w=it.wd, h=it.hg
        if(z + w > W){ z=0; x+=row; row=0 }
        const excluded = (x + l > L) || (h>H)
        const geo = new THREE.BoxGeometry(l,h,w)
        const mat = new THREE.MeshLambertMaterial({ color: excluded? 0xff6f6a: (it.color? parseInt(it.color.replace('#','0x')): 0x6aaaff), transparent:true, opacity: excluded? .7: .9 })
        const box = new THREE.Mesh(geo, mat)
        box.userData.__item = it
        box.position.set(x + l/2, h/2, z + w/2)
        itemsGroup.add(box)
        if(!excluded){ z += w; row = Math.max(row, l) }
      }
    }
  }

  function render(){
    frame = requestAnimationFrame(render)
    controls.update()
    renderer.render(scene, camera)
  }

  function dispose(){
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', resize)
    controls.dispose()
    renderer.dispose()
    scene.clear()
  }

  function screenshot(): Promise<Blob|null>{
    return new Promise(resolve=> renderer.domElement.toBlob(b=> resolve(b)))
  }

  // Простые обработчики ввода (перенос полноценной логики в следующих коммитах)
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  let dragging=false
  let dragTarget: THREE.Mesh | null = null

  function setRay(e:MouseEvent){
    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((e.clientX-rect.left)/rect.width)*2 - 1
    mouse.y = -((e.clientY-rect.top)/rect.height)*2 + 1
    raycaster.setFromCamera(mouse, camera)
  }

  function onMouseDown(e:MouseEvent){
    if(e.button!==0) return
    setRay(e)
    const hit = raycaster.intersectObjects(itemsGroup.children,true).find(h=> (h.object as any).userData?.__item)
    if(hit){ dragging=true; dragTarget = hit.object as THREE.Mesh }
  }
  function onMouseUp(){ dragging=false; dragTarget=null }
  function onMouseMove(e:MouseEvent){
    if(!dragging || !dragTarget || !currentLoad) return
    setRay(e)
    const y = (dragTarget.geometry as THREE.BoxGeometry).parameters.height/2
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -y)
    const p = new THREE.Vector3(); raycaster.ray.intersectPlane(plane,p)
    const step=0.05; p.x=Math.round(p.x/step)*step; p.z=Math.round(p.z/step)*step
    const L=currentLoad.ln, W=currentLoad.wd
    const l=(dragTarget.geometry as THREE.BoxGeometry).parameters.width
    const w=(dragTarget.geometry as THREE.BoxGeometry).parameters.depth
    p.x = THREE.MathUtils.clamp(p.x, l/2, L-l/2)
    p.z = THREE.MathUtils.clamp(p.z, w/2, W-w/2)
    dragTarget.position.x=p.x; dragTarget.position.z=p.z
  }
  function onKey(e:KeyboardEvent){ /* переносим позже полноценные hotkeys */ }

  return {
    scene, camera, renderer, controls, root,
    input:{ onMouseDown, onMouseUp, onMouseMove, onKey },
    setLoad, setItems, render, dispose, screenshot
  }
}
