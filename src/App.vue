<template>
  <div class="app">
    <header class="toolbar">
      <h1>Scene 3D JetLoader</h1>
      <div class="actions">
        <input type="file" accept="application/json" @change="onImport" />
        <button @click="onExport">Экспорт JSON</button>
        <button @click="resetScene">Сброс</button>
        <button @click="exportScreenshot">Скриншот</button>
      </div>
    </header>

    <main class="content">
      <section class="scene-panel">
        <SceneView
          ref="sceneRef"
          :cargo-items="cargoItems"
          :loads="loads"
          :settings="settings"
          @hotkey="onHotkey"
        />
      </section>

      <aside class="side-panel">
        <div class="card">
          <h3>Настройки сцены</h3>
          <label><input type="number" step="0.005" v-model.number="settings.snap"/> snap (м)</label>
          <label><input type="number" step="0.01" v-model.number="settings.allowHang"/> свес (доля)</label>
          <label><input type="number" step="0.01" v-model.number="settings.supportRatioMin"/> устойчивость (доля)</label>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import SceneView from './components/SceneView.vue'
import type { CargoItem, LoadArea } from './types'
import { importJload, exportJload } from './io/JloadCodec'

const sceneRef = ref<InstanceType<typeof SceneView> | null>(null)

const cargoItems = ref<CargoItem[]>([
  { id: 1, nm: 'Новое место 1', ln: 0.7, wd: 0.5, hg: 0.5, wg: 100, cn: 3, color: '#938fe0', pg: 2 },
  { id: 2, nm: 'Новое место 2', ln: 1.0, wd: 1.0, hg: 1.0, wg: 10,  cn: 1, color: '#b4eecb', pg: 1 }
])

const loads = ref<LoadArea[]>([
  { id: 1, nm: 'Газель 3м', ln: 3.09, wd: 2.078, hg: 1.9, wg: 1570 }
])

const settings = reactive({ snap: .05, allowHang: .05, supportRatioMin: .6, units: { size:'m', weight:'kg' } })

watch(settings, (nv)=>{ sceneRef.value?.reset(); }, { deep:true })

function resetScene() { sceneRef.value?.reset() }

async function exportScreenshot() {
  const blob = await sceneRef.value?.screenshot()
  if (blob) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'scene.png'
    a.click()
    URL.revokeObjectURL(a.href)
  }
}

function onHotkey(k:string){ if(k==='recalc'){ /* можно вызвать свои процедуры */ } }

function onImport(ev: Event){
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if(!file) return
  const reader = new FileReader()
  reader.onload = ()=>{
    try {
      const json = JSON.parse(String(reader.result))
      const data = importJload(json)
      loads.value = data.loads
      cargoItems.value = data.cargo
    } catch (e){ console.error(e) }
  }
  reader.readAsText(file)
}

function onExport(){
  const json = exportJload(loads.value, cargoItems.value)
  const blob = new Blob([JSON.stringify(json,null,2)], { type:'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'jload-scene.json'
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<style scoped>
.app { display:flex; flex-direction:column; min-height:100vh; font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; }
.toolbar { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#1976d2; color:#fff; }
.actions button { margin-left: 8px; }
.content { display:grid; grid-template-columns: 1fr 360px; gap:16px; padding:16px; flex:1; }
.card { background:#fff; border-radius:8px; padding:12px; box-shadow:0 1px 3px rgba(0,0,0,.1); margin-bottom:12px; }
.scene-panel { background:#f7f9fc; border-radius:8px; overflow:hidden; }
.side-panel { max-height: calc(100vh - 100px); overflow:auto; }
</style>
