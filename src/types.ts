export type CargoItem = {
  id: number
  nm: string
  ln: number // длина (м)
  wd: number // ширина (м)
  hg: number // высота (м)
  wg?: number // масса брутто (кг)
  cn?: number // количество штук
  color?: string
}

export type LoadArea = {
  id: number
  nm: string
  ln: number // длина (м)
  wd: number // ширина (м)
  hg: number // высота (м)
  wg?: number // тоннаж (кг)
}

export type SceneSettings = {
  snap: boolean
  hang: boolean
}

export type SceneSummary = {
  count: number
  weight: number
  volume: number
  freeVolume: number
}
