// Rules for rotations (rt), overturn (ov), stacking (st) and load limits (lm)
import type { CargoItem, LoadArea } from '../types'

export type Placement = {
  id: number
  x: number, y: number, z: number
  rx: number, ry: number, rz: number
  excluded?: { reason: string }
}

export function allowedOrientations(item: CargoItem, ov=0): Array<[number,number,number]> {
  // ov=0 — запрет кантования: только поворот вокруг Y (горизонтально), без переворота по X/Z
  // ov=1 — разрешаем перевороты
  const base: Array<[number,number,number]> = [ [0,0,0], [0,Math.PI/2,0] ]
  return ov? base.concat([ [Math.PI/2,0,0], [0,0,Math.PI/2] ]) : base
}

export function sizeOf(item: CargoItem, rot:[number,number,number]){
  // returns oriented dimensions (ln, wd, hg) after rotation by multiples of 90°
  const RY = Math.abs(Math.round(rot[1]/(Math.PI/2))) % 2
  const RX = Math.abs(Math.round(rot[0]/(Math.PI/2))) % 2
  const RZ = Math.abs(Math.round(rot[2]/(Math.PI/2))) % 2
  let ln=item.ln, wd=item.wd, hg=item.hg
  if (RY===1){ [ln, wd] = [wd, ln] }
  if (RX===1){ [hg, ln] = [ln, hg] }
  if (RZ===1){ [hg, wd] = [wd, hg] }
  return { ln, wd, hg }
}

export function canStack(top: CargoItem, bottom: CargoItem){
  // st: 0 — нет, 1 — верх только при ограничении lm, 2 — только сверху, 3 — да
  if ((top.st??0)===0) return false
  if ((bottom.st??0)===2) return false // bottom only top of others
  if ((top.st??0)===1 && (top.lm??0)>0 && (top.wg??0) > (top.lm??0)) return false
  return true
}

export function withinArea(dim:{ln:number,wd:number,hg:number}, area:LoadArea){
  return dim.ln<=area.ln+1e-6 && dim.wd<=area.wd+1e-6 && dim.hg<=area.hg+1e-6
}

export function basicPlace(items: CargoItem[], area: LoadArea, opts:{ov?:number,snap?:number}={}){
  const placements: Placement[] = []
  const excluded: Placement[] = []
  let x=0, z=0, row=0
  const step = opts.snap ?? 0.05

  for (const it of items){
    const count = Math.max(1, it.cn||1)
    const orientations = allowedOrientations(it, it.ov||0)
    for (let c=0;c<count;c++){
      // choose orientation that fits best width, else fallback
      let chosen:[number,number,number] = orientations[0]
      let dim = sizeOf(it, chosen)
      if (z + dim.wd > area.wd){ z = 0; x += row; row=0 }
      // try rotate if doesn't fit width
      if (z + dim.wd > area.wd && orientations[1]){
        const d2 = sizeOf(it, orientations[1]); if (z + d2.wd <= area.wd){ chosen=orientations[1]; dim=d2 }
      }
      const place: Placement = { id: it.id, x:0,y:0,z:0, rx:chosen[0], ry:chosen[1], rz:chosen[2] }
      // check length/height
      if (x + dim.ln > area.ln || dim.hg > area.hg){ place.excluded={reason: x+dim.ln>area.ln? 'length':'height'}; excluded.push(place); continue }
      // snap and set position (centered)
      const cx = x + dim.ln/2
      const cz = z + dim.wd/2
      place.x = Math.round(cx/step)*step
      place.z = Math.round(cz/step)*step
      place.y = dim.hg/2
      placements.push(place)
      z += dim.wd
      row = Math.max(row, dim.ln)
    }
  }
  return { placements, excluded }
}
