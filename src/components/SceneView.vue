<template>
  <div class="scene-view" ref="root" @mousedown="onMouseDown" @mouseup="onMouseUp" @mousemove="onMouseMove" @keydown="onKey" tabindex="0">
    <div class="toolbar">
      <button @click="onReset" title="Сброс вида (Ctrl+0)">Сброс</button>
      <button @click="onScreenshot" title="Скриншот сцены (Ctrl+P)">Скриншот</button>
      <button @click="onPrevArea" title="Предыдущая площадка (PgUp)">← Площадка</button>
      <button @click="onNextArea" title="Следующая площадка (PgDn)">Площадка →</button>
      <span class="metrics">
        Мест: {{ metrics.count }} · Масса: {{ metrics.weight }} кг · Объем: {{ metrics.volume }} м³ · Свободно: {{ metrics.freeVolume }} м³
      </span>
    </div>

    <div class="hints">
      <span>Левая кнопка — вращение / перетаскивание груза</span>
      <span>Правая кнопка — панорама</span>
      <span>Колесо — масштаб</span>
      <span>Стрелки — поворот места на 90°</span>
      <span>Ctrl+S — сохранить · Ctrl+R — перерасчет</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, reactive, watch } from 'vue'
import type { CargoItem, LoadArea, SceneSettings, SceneSummary } from '../types'
import { createSceneEngine, type SceneEngine } from '../engine/scene-engine'

const props = defineProps<{ 
  cargoItems: CargoItem[]
  loads: LoadArea[]
  settings: SceneSettings
}>()

const emit = defineEmits<{ (e:'updated', s: SceneSummary): void, (e:'changed'): void, (e:'hotkey', k:string): void }>()

const root = ref<HTMLDivElement|null>(null)
let engine: SceneEngine | null = null
const areaIndex = ref(0)
const metrics = reactive<SceneSummary>({ count:0, weight:0, volume:0, freeVolume:0 })

onMounted(() => {
  engine = createSceneEngine(root!.value!)
  engine.setLoad(props.loads[areaIndex.value])
  engine.setItems(props.cargoItems)
  engine.render()
  root.value?.focus()
})

onBeforeUnmount(() => { engine?.dispose(); engine=null })

function onMouseDown(e: MouseEvent){ engine?.input.onMouseDown(e) }
function onMouseUp(){ engine?.input.onMouseUp() }
function onMouseMove(e: MouseEvent){ engine?.input.onMouseMove(e) }

function onKey(e: KeyboardEvent){
  // Hotkeys 1-в-1
  if(e.ctrlKey && e.key.toLowerCase()==='s'){ e.preventDefault(); emit('hotkey','save') }
  if(e.ctrlKey && e.key.toLowerCase()==='r'){ e.preventDefault(); emit('hotkey','recalc') }
  if(e.ctrlKey && (e.key==='0')){ e.preventDefault(); onReset() }
  if(e.key==='PageUp'){ e.preventDefault(); onPrevArea() }
  if(e.key==='PageDown'){ e.preventDefault(); onNextArea() }
  // Повороты мест — перенесём в engine позже
  engine?.input.onKey(e)
}

watch(()=> props.loads, (nv)=>{ engine?.setLoad(nv[areaIndex.value]); engine?.render() }, { deep:true })
watch(()=> props.cargoItems, (nv)=>{ engine?.setItems(nv); engine?.render() }, { deep:true })

async function onScreenshot(){ await engine?.screenshot() }
function onReset(){ engine?.controls.reset() }
function onPrevArea(){ if(areaIndex.value>0){ areaIndex.value--; engine?.setLoad(props.loads[areaIndex.value]) } }
function onNextArea(){ if(areaIndex.value<props.loads.length-1){ areaIndex.value++; engine?.setLoad(props.loads[areaIndex.value]) } }

function focus(){ root.value?.focus() }
function reset(){ engine?.controls.reset() }
async function screenshot(){ return engine?.screenshot() }

defineExpose({ focus, reset, screenshot })
</script>

<style scoped>
.scene-view { width:100%; height: calc(100vh - 110px); outline:none; position: relative; }
.toolbar { position:absolute; top:8px; left:8px; display:flex; gap:8px; align-items:center; background:rgba(255,255,255,.85); border-radius:8px; padding:6px 8px; box-shadow:0 1px 3px rgba(0,0,0,.1) }
.toolbar button { padding:4px 8px; }
.toolbar .metrics { margin-left:8px; color:#333; font-size:.9rem }
.hints { position:absolute; bottom:8px; left:8px; display:flex; gap:12px; background:rgba(255,255,255,.85); border-radius:8px; padding:6px 8px; box-shadow:0 1px 3px rgba(0,0,0,.1); font-size:.85rem; color:#333 }
</style>
