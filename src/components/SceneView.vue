<template>
  <div class="scene-view" ref="root" @mousedown="onMouseDown" @mouseup="onMouseUp" @mousemove="onMouseMove" @keydown="onKey" tabindex="0">
    <!-- Canvas будет смонтирован движком -->
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { CargoItem, LoadArea, SceneSettings, SceneSummary } from '../types'
import { createSceneEngine, type SceneEngine } from '../engine/scene-engine'

const props = defineProps<{ 
  cargoItems: CargoItem[]
  loads: LoadArea[]
  settings: SceneSettings
}>()

const emit = defineEmits<{ (e:'updated', s: SceneSummary): void, (e:'changed'): void }>()

const root = ref<HTMLDivElement|null>(null)
let engine: SceneEngine | null = null

onMounted(() => {
  engine = createSceneEngine(root!.value!)
  engine.setLoad(props.loads[0])
  engine.setItems(props.cargoItems)
  engine.render()
  root.value?.focus()
})

onBeforeUnmount(() => { engine?.dispose(); engine=null })

function onMouseDown(e: MouseEvent){ engine?.input.onMouseDown(e) }
function onMouseUp(){ engine?.input.onMouseUp() }
function onMouseMove(e: MouseEvent){ engine?.input.onMouseMove(e) }
function onKey(e: KeyboardEvent){ engine?.input.onKey(e) }

watch(()=> props.loads, (nv)=>{ engine?.setLoad(nv[0]); engine?.render() }, { deep:true })
watch(()=> props.cargoItems, (nv)=>{ engine?.setItems(nv); engine?.render() }, { deep:true })

// Экспонируем полезные методы
function focus(){ root.value?.focus() }
function reset(){ engine?.controls.reset() }
async function screenshot(){ return engine?.screenshot() }

defineExpose({ focus, reset, screenshot })
</script>

<style scoped>
.scene-view { width:100%; height: calc(100vh - 110px); outline:none; }
</style>
