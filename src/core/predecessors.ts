// Notación de predecesoras tipo MS Project (en español):
//   "3"          → Fin-Comienzo con la fila 3
//   "3FC+2d"     → Fin-Comienzo con 2 días laborables de espera
//   "4CC"        → Comienzo-Comienzo
//   "5FF-1d"     → Fin-Fin con 1 día de solape
//   "6CF"        → Comienzo-Fin
// Varias predecesoras se separan con ";" o ",". Se aceptan también las siglas inglesas (FS, SS, SF).
// Los números hacen referencia al número de FILA visible en la tabla (como el "Id" de MS Project); internamente se
// guardan por uid, de modo que al insertar o reordenar filas el texto se actualiza solo.
import type { Dependency, LinkType, Task } from './types'

const TYPE_ALIASES: Record<string, LinkType> = {
  FC: 'FC',
  FS: 'FC',
  CC: 'CC',
  SS: 'CC',
  FF: 'FF',
  CF: 'CF',
  SF: 'CF'
}

export interface ParseResult {
  deps: Dependency[]
  errors: string[]
}

const TOKEN = /^(\d+)\s*([A-Za-z]{2})?\s*(?:([+-])\s*(\d+)\s*(?:d|días|dias|día|dia)?)?$/i

/**
 * @param text   texto escrito por el usuario
 * @param tasks  lista de tareas (orden de filas)
 * @param selfIndex índice de la fila que se está editando
 */
export function parsePredecessors(text: string, tasks: Task[], selfIndex: number): ParseResult {
  const deps: Dependency[] = []
  const errors: string[] = []
  const seen = new Set<number>()
  const tokens = text
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const tok of tokens) {
    const m = TOKEN.exec(tok)
    if (!m) {
      errors.push(`"${tok}" no tiene un formato válido (ej.: 3, 3FC+2d, 4CC, 5FF-1d)`)
      continue
    }
    const row = Number(m[1])
    const type = m[2] ? TYPE_ALIASES[m[2].toUpperCase()] : 'FC'
    if (!type) {
      errors.push(`"${m[2]}" no es un tipo de vínculo válido (FC, CC, FF, CF)`)
      continue
    }
    const lag = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0
    const idx = row - 1
    if (idx < 0 || idx >= tasks.length) {
      errors.push(`La fila ${row} no existe`)
      continue
    }
    if (idx === selfIndex) {
      errors.push('Una tarea no puede ser predecesora de sí misma')
      continue
    }
    const predUid = tasks[idx].uid
    if (seen.has(predUid)) {
      errors.push(`La fila ${row} está repetida`)
      continue
    }
    seen.add(predUid)
    deps.push({ predUid, type, lag })
  }
  return { deps, errors }
}

export function formatDependency(dep: Dependency, rowOfUid: Map<number, number>): string {
  const row = rowOfUid.get(dep.predUid)
  if (row === undefined) return '?'
  let s = String(row + 1)
  if (dep.type !== 'FC' || dep.lag !== 0) s += dep.type
  if (dep.lag !== 0) s += `${dep.lag > 0 ? '+' : '-'}${Math.abs(dep.lag)}d`
  return s
}

export function formatPredecessors(deps: Dependency[], rowOfUid: Map<number, number>): string {
  return deps.map((d) => formatDependency(d, rowOfUid)).join(';')
}

export const LINK_TYPE_LABEL: Record<LinkType, string> = {
  FC: 'Fin-Comienzo',
  CC: 'Comienzo-Comienzo',
  FF: 'Fin-Fin',
  CF: 'Comienzo-Fin'
}
