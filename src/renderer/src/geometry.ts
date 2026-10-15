import type { LinkType } from '@core/types'

export interface BarBox {
  x1: number
  x2: number
  cy: number
}

/** Trazado ortogonal de un vínculo entre dos barras (estilo MS Project). */
export function linkPath(p: BarBox, s: BarBox, type: LinkType, rowH: number): string {
  const fromEnd = type === 'FC' || type === 'FF'
  const toStart = type === 'FC' || type === 'CC'
  const sx = fromEnd ? p.x2 : p.x1
  const sy = p.cy
  const sdir = fromEnd ? 1 : -1
  const tx = toStart ? s.x1 : s.x2
  const ty = s.cy
  const tdir = toStart ? 1 : -1 // sentido de entrada de la flecha
  const gap = 8
  const px = sx + sdir * gap
  if ((tx - px) * tdir >= 4) return `M${sx} ${sy} H${px} V${ty} H${tx - tdir}`
  const down = ty > sy ? 1 : -1
  const ex = tx - tdir * gap
  const my = sy + (down * rowH) / 2
  return `M${sx} ${sy} H${px} V${my} H${ex} V${ty} H${tx - tdir}`
}
