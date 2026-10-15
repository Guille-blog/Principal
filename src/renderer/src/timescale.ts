// Escala temporal de dos niveles para el diagrama (pantalla y exportación).
import { dayToDate, isoWeek, monthName, monthShort, weekdayLetter, weekdayOfDay } from '@core/dates'

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter'

export const ZOOMS: ZoomLevel[] = ['day', 'week', 'month', 'quarter']
export const ZOOM_DAY_WIDTH: Record<ZoomLevel, number> = { day: 30, week: 11, month: 3.4, quarter: 1.25 }
export const ZOOM_LABEL: Record<ZoomLevel, string> = { day: 'Día', week: 'Semana', month: 'Mes', quarter: 'Trim.' }

export type Unit = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface Tick {
  start: number
  end: number
  label: string
  /** Etiqueta secundaria (p. ej. número de semana). */
  sub?: string
  weekend?: boolean
}

/** Niveles de escala adecuados para un ancho de día dado. */
export function tiersFor(dayWidth: number): [Unit, Unit] {
  if (dayWidth >= 18) return ['month', 'day']
  if (dayWidth >= 6) return ['month', 'week']
  if (dayWidth >= 2.2) return ['year', 'month']
  return ['year', 'quarter']
}

function unitStart(day: number, unit: Unit): number {
  const dt = dayToDate(day)
  const y = dt.getUTCFullYear()
  const m = dt.getUTCMonth()
  switch (unit) {
    case 'day':
      return day
    case 'week':
      return day - ((weekdayOfDay(day) + 6) % 7)
    case 'month':
      return Math.round(Date.UTC(y, m, 1) / 86_400_000)
    case 'quarter':
      return Math.round(Date.UTC(y, m - (m % 3), 1) / 86_400_000)
    case 'year':
      return Math.round(Date.UTC(y, 0, 1) / 86_400_000)
  }
}

function unitNext(start: number, unit: Unit): number {
  const dt = dayToDate(start)
  const y = dt.getUTCFullYear()
  const m = dt.getUTCMonth()
  switch (unit) {
    case 'day':
      return start + 1
    case 'week':
      return start + 7
    case 'month':
      return Math.round(Date.UTC(y, m + 1, 1) / 86_400_000)
    case 'quarter':
      return Math.round(Date.UTC(y, m + 3, 1) / 86_400_000)
    case 'year':
      return Math.round(Date.UTC(y + 1, 0, 1) / 86_400_000)
  }
}

function label(start: number, unit: Unit, pxWidth: number): { label: string; sub?: string } {
  const dt = dayToDate(start)
  const y = dt.getUTCFullYear()
  const m = dt.getUTCMonth()
  switch (unit) {
    case 'day':
      return { label: String(dt.getUTCDate()), sub: weekdayLetter(weekdayOfDay(start)) }
    case 'week':
      return { label: `${dt.getUTCDate()} ${monthShort(m)}`, sub: `S${isoWeek(start)}` }
    case 'month': {
      const full = monthName(m)
      if (pxWidth > 150) return { label: `${cap(full)} ${y}` }
      if (pxWidth > 70) return { label: cap(full) }
      return { label: cap(monthShort(m)) }
    }
    case 'quarter':
      return { label: `T${Math.floor(m / 3) + 1}${pxWidth > 70 ? ` ${y}` : ''}` }
    case 'year':
      return { label: String(y) }
  }
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Intervalos de una unidad que cubren [from, to). */
export function ticks(from: number, to: number, unit: Unit, dayWidth: number): Tick[] {
  const res: Tick[] = []
  let s = unitStart(from, unit)
  while (s < to) {
    const e = unitNext(s, unit)
    const l = label(s, unit, (e - s) * dayWidth)
    res.push({ start: s, end: e, ...l, weekend: unit === 'day' ? [0, 6].includes(weekdayOfDay(s)) : undefined })
    s = e
  }
  return res
}
