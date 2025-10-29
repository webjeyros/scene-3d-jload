<template>
  <div ref="container" class="three-root"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CargoItem, LoadArea, SceneSettings, SceneSummary } from '../types'

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

// Основные группы
const root = new THREE.Group()
const cargoGroup = new THREE.Group()
const loadsGroup = new THREE.Group()

// Единицы измерения: используем метры
function m(v:number){ return v }

// Материалы
const matCargo = new THREE.MeshLambertMaterial({ color: 0x6aaaff, transparent: true, opacity: 0.9 })
const matCargoExcluded = new THREE.MeshLambertMaterial({ color: 0xff6f6a, transparent: true, opacity: 0.7 })
const matLoad = new THREE.MeshLambertMaterial({ color: 0x87c38f, wireframe: true, opacity: .6, transparent: true })

onMounted(() => {
  init()
  renderScene()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  controls?.dispose()
  renderer?.dispose()
  scene?.clear()
})

function init(){
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf7f9fc)

  const width = container.value!.clientWidth
  const height = container.value!.clientHeight || 600

  camera = new THREE.PerspectiveCamera(60, width/height, 0.01, 100)
  camera.position.set(4, 3, 4)

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.value!.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = true
  controls.target.set(0, 0.75, 0)

  // Свет
  scene.add(new THREE.AmbientLight(0xffffff, .8))
  const dir = new THREE.DirectionalLight(0xffffff, .8)
  dir.position.set(3, 5, 2)
  scene.add(dir)

  // Сетка пола
  const grid = new THREE.GridHelper(20, 20, 0x999999, 0xcccccc)
  grid.position.y = 0
  scene.add(grid)

  // Оси
  const axes = new THREE.AxesHelper(2)
  scene.add(axes)

  root.add(loadsGroup)
  root.add(cargoGroup)
  scene.add(root)

  window.addEventListener('resize', onResize)

  buildLoads()
  buildCargo()
  updateSummary()
}

function onResize(){
  const width = container.value!.clientWidth
  const height = container.value!.clientHeight || 600
  camera.aspect = width/height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

function renderScene(){
  frameId = requestAnimationFrame(renderScene)
  controls.update()
  renderer.render(scene, camera)
}

function buildLoads(){
  while(loadsGroup.children.length) loadsGroup.remove(loadsGroup.children[0])
  props.loads.forEach((l,i)=>{
    const geo = new THREE.BoxGeometry(m(l.ln), m(l.hg), m(l.wd))
    const mesh = new THREE.Mesh(geo, matLoad)
    mesh.name = `load-${l.id}`
    // Центрируем по полу, оси: X=length, Z=width, Y=height
    mesh.position.set(m(l.ln/2), m(l.hg/2), m(l.wd/2))
    loadsGroup.add(mesh)
  })
}

function colorFromHex(hex?:string){
  if(!hex) return 0x6aaaff
  return parseInt(hex.replace('#','0x'))
}

function buildCargo(){
  while(cargoGroup.children.length) cargoGroup.remove(cargoGroup.children[0])

  // Простейший укладчик: построчно, пока помещается в первую площадку
  const load = props.loads[0]
  if(!load) return

  const L = m(load.ln), W = m(load.wd), H = m(load.hg)

  let x=0, z=0, rowMaxDepth=0

  props.cargoItems.forEach(item=>{
    const itemL = m(item.ln)
    const itemW = m(item.wd)
    const itemH = m(item.hg)
    const count = Math.max(1, item.cn||1)

    for(let c=0;c<count;c++){
      // перенос строки по ширине платформы
      if(z + itemW > W){
        z = 0
        x += rowMaxDepth
        rowMaxDepth = 0
      }
      // если по длине не помещается — помечаем как исключённый
      const excluded = (x + itemL > L) || (itemH > H)

      const geo = new THREE.BoxGeometry(itemL, itemH, itemW)
      const mat = excluded ? matCargoExcluded.clone() : new THREE.MeshLambertMaterial({ color: colorFromHex(item.color) })
      const box = new THREE.Mesh(geo, mat)
      box.position.set(x + itemL/2, itemH/2, z + itemW/2)
      cargoGroup.add(box)

      if(!excluded){
        z += itemW
        rowMaxDepth = Math.max(rowMaxDepth, itemL)
      }
    }
  })
}

function updateSummary(){
  const load = props.loads[0]
  const totalVolume = (props.cargoItems.reduce((acc, it)=> acc + (it.ln*it.wd*it.hg)*(it.cn||1), 0))
  const freeVolume = Math.max(0, (load?.ln||0)*(load?.wd||0)*(load?.hg||0) - totalVolume)
  const weight = props.cargoItems.reduce((acc,it)=> acc + (it.wg||0)*(it.cn||1), 0)
  const count = props.cargoItems.reduce((acc,it)=> acc + (it.cn||1), 0)
  emit('updated', { count, weight, volume: round3(totalVolume), freeVolume: round3(freeVolume) })
}

function round3(n:number){ return Math.round(n*1000)/1000 }

// Публичные методы
function reset(){
  controls.reset()
}

async function toBlob(): Promise<Blob | null> {
  return new Promise((resolve)=> renderer.domElement.toBlob((b)=> resolve(b)))
}

// Watchers
watch(()=> props.loads, ()=>{ buildLoads(); buildCargo(); updateSummary() }, { deep: true })
watch(()=> props.cargoItems, ()=>{ buildCargo(); updateSummary() }, { deep: true })

defineExpose({ reset, toBlob })
</script>

<style scoped>
.three-root { width: 100%; height: calc(100vh - 110px); }
canvas { display:block; width:100%; height:100%; }
</style>
