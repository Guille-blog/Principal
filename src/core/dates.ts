// Utilidades de fecha sin zona horaria: se trabaja con "número de día" (días desde 1970-01-01 UTC).
import type { ISODate } from './types'

const MS_DAY = 86_400_000

export function isoToDay(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY)
}

export function dayToISO(day: number): ISODate {
  const dt = new Date(day * MS_DAY)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 0 = domingo … 6 = sábado */
export function weekdayOfDay(day: number): number {
  // 1970-01-01 fue jueves (4)
  return (((day + 4) % 7) + 7) % 7
}

export function dayToDate(day: number): Date {
  return new Date(day * MS_DAY)
}

export function todayISO(): ISODate {
  const now = new Date()
  return dayToISO(Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_DAY))
}

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  return dayToISO(isoToDay(iso)) === iso
}

/** Formato español dd/mm/aaaa */
export function formatES(iso: ISODate | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Interpreta una fecha escrita por el usuario: dd/mm/aaaa, dd/mm/aa, dd-mm-aaaa, dd.mm.aaaa, dd/mm (año de referencia)
 * o ISO aaaa-mm-dd. Devuelve null si no es válida.
 */
export function parseDateES(text: string, refYear: number): ISODate | null {
  const t = text.trim()
  if (!t) return null
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number)
    return build(y, m, d)
  }
  const parts = t.split(/[/.\-\s]+/).filter(Boolean)
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null
  const d = Number(parts[0])
  const m = Number(parts[1])
  let y = parts.length === 3 ? Number(parts[2]) : refYear
  if (parts.length === 3 && parts[2].length <= 2) y = 2000 + y
  return build(y, m, d)
}

function build(y: number, m: number, d: number): ISODate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return isValidISO(iso) ? iso : null
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const WEEKDAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const monthName = (m: number): string => MONTHS[m]
export const monthShort = (m: number): string => MONTHS_SHORT[m]
export const weekdayLetter = (wd: number): string => WEEKDAYS_SHORT[wd]
export const weekdayName = (wd: number): string => WEEKDAYS[wd]

/** Número de semana ISO-8601 */
export function isoWeek(day: number): number {
  const wd = (weekdayOfDay(day) + 6) % 7 // lunes = 0
  const thursday = day - wd + 3
  const dt = dayToDate(thursday)
  const jan1 = Math.round(Date.UTC(dt.getUTCFullYear(), 0, 1) / MS_DAY)
  return Math.floor((thursday - jan1) / 7) + 1
}
