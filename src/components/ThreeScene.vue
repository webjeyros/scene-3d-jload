<template>
  <div ref="container" class="three-root" @mousedown="onMouseDown" @mouseup="onMouseUp" @mousemove="onMouseMove" @keydown="onKey" tabindex="0"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CargoItem, LoadArea, SceneSettings, SceneSummary } from '../types'
import { buildTruck } from '../three/Truck'
import { basicPlace } from '../pack/Rules'

const props = defineProps<{ 
  cargoItems: CargoItem[]
  loads: LoadArea[]
  settings: SceneSettings
}>()

const emit = defineEmits<{ (e:'updated', s: SceneSummary): void }>()

const container = ref<HTMLDivElement | null>(null)
let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let controls: OrbitControls
let frameId = 0

// Drag helpers
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let dragging = false
let dragTarget: THREE.Mesh | null = null

const root = new THREE.Group()
const cargoGroup = new THREE.Group()
const loadsGroup = new THREE.Group()

const matExcluded = new THREE.MeshLambertMaterial({ color: 0xff6f6a, transparent: true, opacity: 0.7 })

onMounted(() => { init(); renderScene() })
onBeforeUnmount(() => { cancelAnimationFrame(frameId); controls?.dispose(); renderer?.dispose(); scene?.clear(); window.removeEventListener('resize', onResize) })

function init(){
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf7f9fc)
  const width = container.value!.clientWidth
  const height = container.value!.clientHeight || 600
  camera = new THREE.PerspectiveCamera(60, width/height, 0.01, 200)
  camera.position.set(4, 3, 4)
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.value!.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = true
  controls.target.set(0, 0.75, 0)
  scene.add(new THREE.AmbientLight(0xffffff, .8))
  const dir = new THREE.DirectionalLight(0xffffff, .8); dir.position.set(3,5,2); scene.add(dir)
  const grid = new THREE.GridHelper(20, 20, 0x999999, 0xcccccc); grid.position.y = 0; scene.add(grid)
  const axes = new THREE.AxesHelper(2); scene.add(axes)
  root.add(loadsGroup); root.add(cargoGroup); scene.add(root)
  window.addEventListener('resize', onResize)
  buildLoads()
  buildTruck(root, { ln: props.loads[0]?.ln||3, wd: props.loads[0]?.wd||2, hg: props.loads[0]?.hg||2 }, { animateWheels:false })
  autoPlace()
  updateSummary()
  container.value?.focus()
}

function onResize(){
  const width = container.value!.clientWidth
  const height = container.value!.clientHeight || 600
  camera.aspect = width/height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

function renderScene(){ frameId = requestAnimationFrame(renderScene); controls.update(); renderer.render(scene, camera) }

function buildLoads(){
  while(loadsGroup.children.length) loadsGroup.remove(loadsGroup.children[0])
  const l = props.loads[0]
  if(!l) return
  const geo = new THREE.BoxGeometry(l.ln, l.hg, l.wd)
  const mat = new THREE.MeshLambertMaterial({ color: 0x87c38f, wireframe: true, transparent: true, opacity:.6 })
  const mesh = new THREE.Mesh(geo, mat); mesh.name='load-0'; mesh.position.set(l.ln/2, l.hg/2, l.wd/2)
  loadsGroup.add(mesh)
}

function color(hex?:string){ return hex? parseInt(hex.replace('#','0x')): 0x6aaaff }

function autoPlace(){
  while(cargoGroup.children.length) cargoGroup.remove(cargoGroup.children[0])
  const l = props.loads[0]
  if(!l) return
  const { placements, excluded } = basicPlace(props.cargoItems, l, { snap: 0.05 })
  for (const p of placements){
    const it = props.cargoItems.find(i=> i.id===p.id)!;
    const geo = new THREE.BoxGeometry(it.ln, it.hg, it.wd)
    const mat = new THREE.MeshLambertMaterial({ color: color(it.color) })
    const box = new THREE.Mesh(geo, mat)
    box.userData.__item = it
    box.position.set(p.x, p.y, p.z)
    box.rotation.set(p.rx, p.ry, p.rz)
    cargoGroup.add(box)
  }
  for (const p of excluded){
    const it = props.cargoItems.find(i=> i.id===p.id)!;
    const geo = new THREE.BoxGeometry(it.ln, it.hg, it.wd)
    const mat = matExcluded.clone()
    const box = new THREE.Mesh(geo, mat)
    box.userData.__item = it
    box.position.set(p.x, it.hg/2, p.z)
    box.rotation.set(p.rx, p.ry, p.rz)
    cargoGroup.add(box)
  }
}

// Drag operations
function screenToRay(x:number,y:number){
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((x-rect.left)/rect.width)*2 - 1
  mouse.y = -((y-rect.top)/rect.height)*2 + 1
  raycaster.setFromCamera(mouse, camera)
}

function pickCargo(evt: MouseEvent){
  screenToRay(evt.clientX, evt.clientY)
  const hits = raycaster.intersectObjects(cargoGroup.children, true)
  const hit = hits.find(h=> (h.object as any).userData?.__item)
  return hit?.object as THREE.Mesh | undefined
}

function onMouseDown(evt: MouseEvent){ if(evt.button!==0) return; const obj = pickCargo(evt); if(obj){ dragging = true; dragTarget = obj } }
function onMouseUp(){ dragging=false; dragTarget=null }
function onMouseMove(evt: MouseEvent){
  if(!dragging || !dragTarget) return
  const y = (dragTarget.geometry as THREE.BoxGeometry).parameters.height/2
  const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -y)
  screenToRay(evt.clientX, evt.clientY)
  const p = new THREE.Vector3(); raycaster.ray.intersectPlane(plane, p)
  const step = 0.05; p.x = Math.round(p.x/step)*step; p.z = Math.round(p.z/step)*step
  const L = props.loads[0]?.ln||3, W = props.loads[0]?.wd||2
  const l = (dragTarget.geometry as THREE.BoxGeometry).parameters.width
  const w = (dragTarget.geometry as THREE.BoxGeometry).parameters.depth
  p.x = THREE.MathUtils.clamp(p.x, l/2, L - l/2)
  p.z = THREE.MathUtils.clamp(p.z, w/2, W - w/2)
  dragTarget.position.x = p.x; dragTarget.position.z = p.z
}

function onKey(evt: KeyboardEvent){
  if(!dragTarget) return
  const rotStep = Math.PI/2
  if(evt.key==='ArrowLeft' || evt.key==='ArrowRight'){
    dragTarget.rotation.y += (evt.key==='ArrowLeft'? -rotStep: rotStep)
  }
  if(evt.key==='ArrowUp' || evt.key==='ArrowDown'){
    // вертикальная смена — упрощённо вращаем вокруг X, учитывайте ov в Rules при авторазмещении
    dragTarget.rotation.x += (evt.key==='ArrowUp'? -rotStep: rotStep)
  }
}

// Expose
function reset(){ controls.reset() }
async function toBlob(): Promise<Blob | null> { return new Promise((resolve)=> renderer.domElement.toBlob((b)=> resolve(b))) }

watch(()=> props.loads, ()=>{ buildLoads(); autoPlace(); updateSummary() }, { deep:true })
watch(()=> props.cargoItems, ()=>{ autoPlace(); updateSummary() }, { deep:true })

defineExpose({ reset, toBlob })
</script>

<style scoped>
.three-root { width: 100%; height: calc(100vh - 110px); outline: none; }
canvas { display:block; width:100%; height:100%; cursor: default; }
</style>
