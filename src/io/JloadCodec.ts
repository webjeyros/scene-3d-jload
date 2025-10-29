import type { CargoItem, LoadArea, SceneSettings, SceneSummary } from '../types'

export type JloadProject = {
  units: { size: '0'|'1'|'2', wght: '0'|'1' }
  loads: LoadArea[]
  cargo: CargoItem[]
}

export function importJload(json: any): { loads: LoadArea[], cargo: CargoItem[] } {
  // Minimal compatible mapping; expects mm (size: '2' = m) and kg (wght: '1' = t) in original
  // Here we interpret numbers as meters/kg already for simplicity
  const loads = (json.loads||[]).map((l:any)=> ({ id:l.id, nm:l.nm, ln:Number(l.ln), wd:Number(l.wd), hg:Number(l.hg), wg:Number(l.wg||0) }))
  const cargo = (json.cargo||[]).map((c:any)=> ({ id:c.id, nm:c.nm, ln:Number(c.ln), wd:Number(c.wd), hg:Number(c.hg), wg:Number(c.wg||0), cn:Number(c.cn||1), color:c.color }))
  return { loads, cargo }
}

export function exportJload(loads: LoadArea[], cargo: CargoItem[]) {
  return {
    version: 1,
    units: { size: '2', wght: '0' },
    loads: loads.map(l=> ({ id:l.id, nm:l.nm, ln:l.ln, wd:l.wd, hg:l.hg, wg:l.wg||0 })),
    cargo: cargo.map(c=> ({ id:c.id, nm:c.nm, ln:c.ln, wd:c.wd, hg:c.hg, wg:c.wg||0, cn:c.cn||1, color:c.color }))
  }
}
