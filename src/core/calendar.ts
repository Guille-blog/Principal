// Calendario laboral: convierte entre días naturales y "ordinales laborables".
//
// El ordinal de un día es el número de días laborables estrictamente anteriores a él (respecto a una base fija).
// Así, en un día laborable el ordinal es su índice; en un día no laborable coincide con el del siguiente laborable.
// Todo el cálculo CPM se hace en ordinales, por lo que fines de semana y festivos quedan excluidos de forma natural.
import { dayToISO, isoToDay, weekdayOfDay } from './dates'
import type { ISODate, WorkCalendarDef } from './types'

/** 1970-01-05 fue lunes */
const BASE_MONDAY = 4

export class WorkCalendar {
  private readonly week: boolean[]
  private readonly perWeek: number
  /** Prefijo de días laborables en una semana que empieza en lunes: prefix[r] = laborables en los r primeros días. */
  private readonly prefix: number[]
  /** Festivos que caen en día laborable de la semana tipo, ordenados (número de día). */
  private readonly holidayDays: number[]
  private readonly holidaySet: Set<number>

  constructor(def: WorkCalendarDef) {
    this.week = def.workWeek.length === 7 ? [...def.workWeek] : [false, true, true, true, true, true, false]
    if (!this.week.some(Boolean)) {
      // Un calendario sin días laborables haría imposible cualquier cálculo: se fuerza L-V.
      this.week = [false, true, true, true, true, true, false]
    }
    this.perWeek = this.week.filter(Boolean).length
    this.prefix = [0]
    for (let i = 0; i < 7; i++) this.prefix.push(this.prefix[i] + (this.week[(1 + i) % 7] ? 1 : 0))
    const days = new Set<number>()
    for (const h of def.holidays) {
      const d = isoToDay(h.date)
      if (Number.isFinite(d) && this.week[weekdayOfDay(d)]) days.add(d)
    }
    this.holidayDays = [...days].sort((a, b) => a - b)
    this.holidaySet = days
  }

  isWorkday(day: number): boolean {
    return this.week[weekdayOfDay(day)] && !this.holidaySet.has(day)
  }

  isHoliday(day: number): boolean {
    return this.holidaySet.has(day)
  }

  /** Número de días laborables anteriores a `day` (relativo a una base fija). Monótono no decreciente. */
  ordinal(day: number): number {
    const diff = day - BASE_MONDAY
    const weeks = Math.floor(diff / 7)
    const rem = diff - weeks * 7
    return weeks * this.perWeek + this.prefix[rem] - this.holidaysBefore(day)
  }

  /** Día natural del laborable con ordinal `k`. */
  dayOfOrdinal(k: number): number {
    // Estimación inicial y búsqueda binaria del menor día cuyo ordinal siguiente supera k.
    const est = BASE_MONDAY + Math.floor((k * 7) / this.perWeek)
    let lo = est - 14
    let hi = est + 14
    while (this.ordinal(lo) > k) lo -= Math.max(14, hi - lo)
    while (this.ordinal(hi + 1) <= k) hi += Math.max(14, hi - lo)
    // invariante: ordinal(lo) <= k < ordinal(hi + 1)
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (this.ordinal(mid + 1) > k) hi = mid
      else lo = mid + 1
    }
    return lo
  }

  nextWorkday(day: number): number {
    return this.dayOfOrdinal(this.ordinal(day))
  }

  prevWorkday(day: number): number {
    return this.dayOfOrdinal(this.ordinal(day + 1) - 1)
  }

  /** Días laborables entre dos fechas, ambas incluidas. */
  workdaysInclusive(fromDay: number, toDay: number): number {
    if (toDay < fromDay) return 0
    return this.ordinal(toDay + 1) - this.ordinal(fromDay)
  }

  /** Fecha de fin de una tarea que empieza en `startDay` (se ajusta al siguiente laborable) y dura `duration` laborables. */
  finishForDuration(startDay: number, duration: number): number {
    const s = this.ordinal(startDay)
    return duration <= 0 ? this.dayOfOrdinal(s) : this.dayOfOrdinal(s + duration - 1)
  }

  ordinalISO(iso: ISODate): number {
    return this.ordinal(isoToDay(iso))
  }

  isoOfOrdinal(k: number): ISODate {
    return dayToISO(this.dayOfOrdinal(k))
  }

  private holidaysBefore(day: number): number {
    const arr = this.holidayDays
    let lo = 0
    let hi = arr.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (arr[mid] < day) lo = mid + 1
      else hi = mid
    }
    return lo
  }
}
