// Festivos nacionales de España.
//
// IMPORTANTE: el calendario oficial lo publica cada año el BOE (Resolución de la Dirección General de Trabajo) y las
// comunidades autónomas pueden sustituir o trasladar algunos festivos (p. ej. 6 de enero, Jueves Santo, festivos que
// caen en domingo). Esta plantilla genera los festivos comunes "no sustituibles" y los habituales; SIEMPRE debe
// revisarse con el BOE/boletín autonómico y añadir los festivos autonómicos y locales de la obra.
import { dayToISO, isoToDay, weekdayOfDay } from './dates'
import type { Holiday, ISODate } from './types'

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
export function easterSunday(year: number): ISODate {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function spanishNationalHolidays(year: number): Holiday[] {
  const goodFriday = dayToISO(isoToDay(easterSunday(year)) - 2)
  const y = String(year)
  const list: Holiday[] = [
    { date: `${y}-01-01`, name: 'Año Nuevo' },
    { date: `${y}-01-06`, name: 'Epifanía del Señor' },
    { date: goodFriday, name: 'Viernes Santo' },
    { date: `${y}-05-01`, name: 'Fiesta del Trabajo' },
    { date: `${y}-08-15`, name: 'Asunción de la Virgen' },
    { date: `${y}-10-12`, name: 'Fiesta Nacional de España' },
    { date: `${y}-11-01`, name: 'Todos los Santos' },
    { date: `${y}-12-06`, name: 'Día de la Constitución' },
    { date: `${y}-12-08`, name: 'Inmaculada Concepción' },
    { date: `${y}-12-25`, name: 'Natividad del Señor' }
  ]
  return list.sort((a, b) => a.date.localeCompare(b.date))
}

/** Festivos nacionales que caen en domingo: candidatos a traslado al lunes según cada comunidad autónoma. */
export function sundayHolidays(holidays: Holiday[]): Holiday[] {
  return holidays.filter((h) => weekdayOfDay(isoToDay(h.date)) === 0)
}

/** Une listas de festivos sin duplicar fechas (prevalece el nombre existente). */
export function mergeHolidays(existing: Holiday[], extra: Holiday[]): Holiday[] {
  const map = new Map(existing.map((h) => [h.date, h]))
  for (const h of extra) if (!map.has(h.date)) map.set(h.date, h)
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}
