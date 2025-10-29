import type { CargoItem, LoadArea } from '../types'
import * as THREE from 'three'

export type Orientation = [number,number,number]
export type Placement = { id:number, pos:THREE.Vector3, rot:Orientation, size:{ln:number,wd:number,hg:number}, layer:number, excluded?:{reason:string} }

export type PackSettings = {
  snap?: number
  allowHang?: number
  supportRatioMin?: number
  units?: { size: 'mm'|'cm'|'m', weight: 'kg'|'t' }
}

const U = {
  toMeters(v:number, u:'mm'|'cm'|'m'){ return u==='mm'? v/1000 : u==='cm'? v/100 : v },
  toKg(v:number, u:'kg'|'t'){ return u==='t'? v*1000 : v }
}

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

export function snapTo(value:number, step=0.05){ return Math.round(value/step)*step }

function edgeSnap(x:number, edges:number[], tol:number){
  for(const e of edges){ if(Math.abs(x-e)<=tol) return e } return x
}

export function packItems(items: CargoItem[], area: LoadArea, opts:PackSettings={}){
  const snap = opts.snap ?? 0.05
  const allowHang = opts.allowHang ?? 0.05
  const supportMin = opts.supportRatioMin ?? 0.6

  const placements: Placement[]=[]
  const excluded: Placement[]=[]
  const layers: Placement[][]=[[]]
  const layerHeights:number[]=[0]

  let x=0, z=0, row=0

  // Precompute edge lists for snapping (0 and dimension, and accumulated row/col edges)
  let edgesX:number[]=[0], edgesZ:number[]=[0]

  for(const it of items){
    const count=Math.max(1, it.cn||1)
    for(let c=0;c<count;c++){
      const orientations = getOrientations(it)
      let rot = orientations[0]
      let size = orientedSize(it, rot)

      if(z + size.wd > area.wd){ z=0; x+=row; row=0 }
      if(z + size.wd > area.wd && orientations[1]){ const alt=orientedSize(it,orientations[1]); if(z+alt.wd<=area.wd){ rot=orientations[1]; size=alt } }

      const hUsed = layerHeights.reduce((a,b)=>a+b,0)
      if(hUsed + size.hg > area.hg){ excluded.push({ id:it.id, pos:new THREE.Vector3(), rot, size, layer:layers.length-1, excluded:{reason:'height'} }); continue }
      if(x + size.ln > area.ln*(1+allowHang)){ excluded.push({ id:it.id, pos:new THREE.Vector3(), rot, size, layer:layers.length-1, excluded:{reason:'length'} }); continue }

      // Snap to edges (edge-to-edge)
      const pxRaw = x + size.ln/2
      const pzRaw = z + size.wd/2
      const px = snapTo(edgeSnap(pxRaw, edgesX.map(e=> e + size.ln/2), snap), snap)
      const pz = snapTo(edgeSnap(pzRaw, edgesZ.map(e=> e + size.wd/2), snap), snap)
      const py = snapTo(hUsed + size.hg/2, snap)

      const placement: Placement={ id:it.id, pos:new THREE.Vector3(px,py,pz), rot, size, layer: layers.length-1 }

      // Stability check with support ratio
      if(placement.layer>0){
        const below = layers[placement.layer-1]
        // compute overlapped area sum
        const supported = below.reduce((acc,b)=>{
          const dx = Math.abs(placement.pos.x - b.pos.x)
          const dz = Math.abs(placement.pos.z - b.pos.z)
          const ox = Math.max(0, (b.size.ln/2 + placement.size.ln/2) - dx)
          const oz = Math.max(0, (b.size.wd/2 + placement.size.wd/2) - dz)
          return acc + (ox*oz)
        }, 0)
        const areaTop = placement.size.ln*placement.size.wd
        if(supported/areaTop < supportMin){ excluded.push({ ...placement, excluded:{reason:'stability'} }); continue }
      }

      placements.push(placement)
      layers[layers.length-1].push(placement)

      // advance row & edges
      z += size.wd
      row = Math.max(row, size.ln)
      edgesZ.push(z)
      // When row filled, add a new layer trigger on next overflow
      if(x + row >= area.ln*0.999){
        layers.push([]); layerHeights.push(size.hg); x=0; z=0; row=0; edgesX=[0]; edgesZ=[0]
      }
    }
  }

  return { placements, excluded }
}
