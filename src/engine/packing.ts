import type { CargoItem, LoadArea } from '../types'
import * as THREE from 'three'

export type Orientation = [number,number,number]
export type Placement = { id:number, pos:THREE.Vector3, rot:Orientation, size:{ln:number,wd:number,hg:number}, excluded?:{reason:string} }

// Allowed orientations depending on ov (overturn allowed)
export function getOrientations(item: CargoItem): Orientation[] {
  const ov = item.ov ?? 0
  const base: Orientation[] = [ [0,0,0], [0,Math.PI/2,0] ]
  return ov? base.concat([ [Math.PI/2,0,0], [0,0,Math.PI/2] ]) : base
}

export function orientedSize(item: CargoItem, rot: Orientation){
  const n = (v:number)=> Math.abs(Math.round(v/(Math.PI/2)))%2
  const rx=n(rot[0]), ry=n(rot[1]), rz=n(rot[2])
  let ln=item.ln, wd=item.wd, hg=item.hg
  if(ry===1){ [ln,wd]=[wd,ln] }
  if(rx===1){ [hg,ln]=[ln,hg] }
  if(rz===1){ [hg,wd]=[wd,hg] }
  return { ln, wd, hg }
}

// Stacking rules
export function canPlaceOnTop(top: CargoItem, bottom: CargoItem){
  const stTop = top.st ?? 0
  const stBottom = bottom.st ?? 3
  if(stTop===0) return false
  if(stBottom===2) return false // bottom accepts only above others
  const lmTop = top.lm ?? 0
  if(stTop===1 && lmTop>0 && (top.wg??0)>lmTop) return false
  return true
}

// Overhang and stability (simple model)
export function isStable(top: Placement, bottom: Placement, allowHang=0.15){
  const halfTop = new THREE.Vector2(top.size.ln/2, top.size.wd/2)
  const halfBottom = new THREE.Vector2(bottom.size.ln/2, bottom.size.wd/2)
  const dx = Math.abs(top.pos.x - bottom.pos.x)
  const dz = Math.abs(top.pos.z - bottom.pos.z)
  const overlapX = Math.max(0, halfBottom.x + halfTop.x - dx)
  const overlapZ = Math.max(0, halfBottom.y + halfTop.y - dz)
  const areaOverlap = overlapX*overlapZ
  const areaTop = top.size.ln*top.size.wd
  const ratio = areaOverlap/areaTop
  return ratio >= (1-allowHang)
}

// Snap helpers
export function snapTo(value:number, step=0.05){ return Math.round(value/step)*step }

export function packItems(items: CargoItem[], area: LoadArea, opts:{snap?:number, allowHang?:number}={}){
  const placements: Placement[]=[]
  const excluded: Placement[]=[]
  const step = opts.snap ?? 0.05
  const allowHang = opts.allowHang ?? 0.15

  let layers: Placement[][] = [[]]
  let layerHeights: number[] = [0]

  let cursorX=0, cursorZ=0, rowDepth=0

  for(const it of items){
    const count=Math.max(1, it.cn||1)
    for(let c=0;c<count;c++){
      // choose best orientation that fits width/height
      const orientations = getOrientations(it)
      let chosen:Orientation = orientations[0]
      let size = orientedSize(it, chosen)
      // if row overflow, new row
      if(cursorZ + size.wd > area.wd){ cursorZ=0; cursorX += rowDepth; rowDepth=0 }
      // try rotate to fit width
      if(cursorZ + size.wd > area.wd && orientations[1]){
        const alt=orientedSize(it, orientations[1])
        if(cursorZ + alt.wd <= area.wd){ chosen=orientations[1]; size=alt }
      }
      // height constraint
      const currentLayerIndex = layers.length-1
      const baseY = layerHeights.reduce((a,b)=>a+b,0)
      if(baseY + size.hg > area.hg){
        excluded.push({ id:it.id, pos:new THREE.Vector3(), rot:chosen, size, excluded:{reason:'height'} })
        continue
      }
      // length constraint (allow hang)
      if(cursorX + size.ln > area.ln*(1+allowHang)){
        excluded.push({ id:it.id, pos:new THREE.Vector3(), rot:chosen, size, excluded:{reason:'length'} })
        continue
      }
      // compute position
      const px = snapTo(cursorX + size.ln/2, step)
      const pz = snapTo(cursorZ + size.wd/2, step)
      const py = snapTo(baseY + size.hg/2, step)
      const placement: Placement = { id:it.id, pos:new THREE.Vector3(px,py,pz), rot:chosen, size }

      // stability: if not first layer, check against any below cell
      if(currentLayerIndex>0){
        const below = layers[currentLayerIndex-1]
        const stableSome = below.some(b=> isStable(placement, b, allowHang))
        if(!stableSome){
          excluded.push({ ...placement, excluded:{reason:'stability'} })
          continue
        }
      }

      placements.push(placement)
      layers[currentLayerIndex].push(placement)
      // update row
      cursorZ += size.wd
      rowDepth = Math.max(rowDepth, size.ln)

      // stacking: if item supports stacking and there is vertical space, optionally start next layer
      if((it.st??0)>0 && (it.lm??0)>=0){
        if(cursorX + rowDepth >= area.ln*0.95){
          // start new layer when line filled
          layers.push([])
          layerHeights.push(size.hg)
          cursorX=0; cursorZ=0; rowDepth=0
        }
      }
    }
  }

  return { placements, excluded }
}
