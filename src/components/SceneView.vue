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

    <div class="exclusions" v-if="exclusions.length">
      <h4>Исключения ({{ exclusions.length }})</h4>
      <ul>
        <li v-for="(ex,i) in exclusions" :key="i">#{{ ex.id }} — {{ ex.reason }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, reactive, watch } from 'vue'
import type { CargoItem, LoadArea, SceneSettings, SceneSummary } from '../types'
import { createSceneEngine, type SceneEngine } from '../engine/scene-engine'
import { packItems } from '../engine/packing'

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
const exclusions = ref<{id:number, reason:string}[]>([])

onMounted(async () => {
  engine = createSceneEngine(root!.value!)
  engine.setLoad(props.loads[areaIndex.value])
  engine.setItems(props.cargoItems)
  engine.render()
  recalcMetrics()
  root.value?.focus()
})

onBeforeUnmount(() => { engine?.dispose(); engine=null })

function onMouseDown(e: MouseEvent){ engine?.input.onMouseDown(e) }
function onMouseUp(){ engine?.input.onMouseUp() }
function onMouseMove(e: MouseEvent){ engine?.input.onMouseMove(e) }

function onKey(e: KeyboardEvent){
  if(e.ctrlKey && e.key.toLowerCase()==='s'){ e.preventDefault(); emit('hotkey','save') }
  if(e.ctrlKey && e.key.toLowerCase()==='r'){ e.preventDefault(); emit('hotkey','recalc'); recalcMetrics() }
  if(e.ctrlKey && (e.key==='0')){ e.preventDefault(); onReset() }
  if(e.key==='PageUp'){ e.preventDefault(); onPrevArea() }
  if(e.key==='PageDown'){ e.preventDefault(); onNextArea() }
  engine?.input.onKey(e)
}

watch(()=> props.loads, (nv)=>{ engine?.setLoad(nv[areaIndex.value]); engine?.render(); recalcMetrics() }, { deep:true })
watch(()=> props.cargoItems, (nv)=>{ engine?.setItems(nv); engine?.render(); recalcMetrics() }, { deep:true })

async function onScreenshot(){ await engine?.screenshot() }
function onReset(){ engine?.controls.reset() }
function onPrevArea(){ if(areaIndex.value>0){ areaIndex.value--; engine?.setLoad(props.loads[areaIndex.value]); recalcMetrics() } }
function onNextArea(){ if(areaIndex.value<props.loads.length-1){ areaIndex.value++; engine?.setLoad(props.loads[areaIndex.value]); recalcMetrics() } }

function recalcMetrics(){
  const load = props.loads[areaIndex.value]
  if(!load){ metrics.count=0; metrics.weight=0; metrics.volume=0; metrics.freeVolume=0; exclusions.value=[]; return }
  const result = packItems(props.cargoItems, load, { snap:.05, allowHang:.15 })
  const volItems = props.cargoItems.reduce((a,it)=> a + (it.ln*it.wd*it.hg)*(it.cn||1), 0)
  const volLoad = load.ln*load.wd*load.hg
  metrics.count = props.cargoItems.reduce((a,it)=> a + (it.cn||1), 0)
  metrics.weight = props.cargoItems.reduce((a,it)=> a + (it.wg||0)*(it.cn||1), 0)
  metrics.volume = Math.round(volItems*1000)/1000
  metrics.freeVolume = Math.max(0, Math.round((volLoad - volItems)*1000)/1000)
  exclusions.value = result.excluded.map(e=> ({ id:e.id, reason:e.excluded?.reason||'excluded' }))
}

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
.exclusions { position:absolute; right:8px; top:8px; background:rgba(255,255,255,.9); padding:8px 10px; border-radius:8px; max-width:300px; box-shadow:0 1px 3px rgba(0,0,0,.1) }
.exclusions h4 { margin:0 0 6px 0; font-size:.95rem }
.exclusions ul { margin:0; padding-left:18px }
</style>
