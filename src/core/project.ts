// Creación, migración y validación de proyectos.
import { dayToISO, isoToDay, isValidISO, todayISO, weekdayOfDay } from './dates'
import { mergeHolidays, spanishNationalHolidays } from './holidays'
import { normalizeLevels } from './hierarchy'
import { SCHEMA_VERSION, type Dependency, type Project, type Task, type Trade } from './types'

export const DEFAULT_TRADES: Trade[] = [
  { id: 'elec', name: 'Electricidad', color: '#f2b705' },
  { id: 'clima', name: 'Climatización', color: '#2b8cd6' },
  { id: 'fonta', name: 'Fontanería', color: '#16a3a3' },
  { id: 'domo', name: 'Domótica', color: '#8e5cd9' },
  { id: 'telco', name: 'Telecomunicaciones', color: '#e0672b' },
  { id: 'civil', name: 'Obra civil', color: '#8a7663' },
  { id: 'otros', name: 'Otros', color: '#6b7a8f' }
]

/** Lunes de la semana próxima (o hoy si es lunes). */
export function nextMonday(fromISO: string = todayISO()): string {
  const d = isoToDay(fromISO)
  const wd = weekdayOfDay(d)
  const add = wd === 1 ? 0 : (8 - wd) % 7
  return dayToISO(d + add)
}

export function nationalHolidaysForRange(startYear: number, endYear: number) {
  let list = spanishNationalHolidays(startYear)
  for (let y = startYear + 1; y <= endYear; y++) list = mergeHolidays(list, spanishNationalHolidays(y))
  return list
}

export function createEmptyProject(start: string = nextMonday()): Project {
  const y = Number(start.slice(0, 4))
  return {
    schemaVersion: SCHEMA_VERSION,
    info: { name: 'Nueva obra', client: '', location: '', manager: '', revision: 'Rev. 0', start },
    calendar: {
      workWeek: [false, true, true, true, true, true, false],
      holidays: nationalHolidaysForRange(y, y + 1)
    },
    trades: DEFAULT_TRADES.map((t) => ({ ...t })),
    tasks: [],
    nearCriticalThreshold: 5
  }
}

export function nextUid(tasks: Task[]): number {
  return tasks.reduce((m, t) => Math.max(m, t.uid), 0) + 1
}

export function newTask(uid: number, start: string, level = 0, name = ''): Task {
  return {
    uid,
    name,
    level,
    start,
    duration: 1,
    constraint: 'asap',
    predecessors: [],
    trade: 'otros',
    responsible: '',
    progress: 0,
    notes: ''
  }
}

/** Carga y valida un archivo .gantt.json. Lanza Error con mensaje en español si no es válido. */
export function parseProjectFile(text: string): Project {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  if (!raw || typeof raw !== 'object') throw new Error('El archivo no contiene un proyecto.')
  const r = raw as Partial<Project> & { schemaVersion?: number }
  if (typeof r.schemaVersion !== 'number') throw new Error('Falta "schemaVersion": no parece un archivo de Gantt Obra.')
  if (r.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`El archivo es de una versión más moderna de la aplicación (esquema ${r.schemaVersion}). Actualiza la aplicación.`)
  }
  return migrate(r)
}

function migrate(r: Partial<Project>): Project {
  const base = createEmptyProject(r.info?.start && isValidISO(r.info.start) ? r.info.start : undefined)
  const trades = Array.isArray(r.trades) && r.trades.length ? r.trades : base.trades
  const tradeIds = new Set(trades.map((t) => t.id))
  const tasksRaw = Array.isArray(r.tasks) ? r.tasks : []
  const uids = new Set<number>()
  const tasks: Task[] = tasksRaw.map((t, i) => {
    let uid = Number.isInteger(t.uid) && t.uid > 0 && !uids.has(t.uid) ? t.uid : 0
    if (!uid) uid = 100000 + i
    uids.add(uid)
    return {
      uid,
      name: String(t.name ?? ''),
      level: Number.isInteger(t.level) && t.level >= 0 ? t.level : 0,
      start: isValidISO(t.start) ? t.start : base.info.start,
      duration: Number.isFinite(t.duration) && t.duration >= 0 ? Math.round(t.duration) : 1,
      constraint: t.constraint === 'snet' ? 'snet' : 'asap',
      predecessors: Array.isArray(t.predecessors) ? (t.predecessors as Dependency[]).filter(validDep) : [],
      trade: tradeIds.has(t.trade) ? t.trade : trades[trades.length - 1].id,
      responsible: String(t.responsible ?? ''),
      progress: Math.max(0, Math.min(100, Number(t.progress) || 0)),
      notes: String(t.notes ?? ''),
      ...(t.deadline && isValidISO(t.deadline) ? { deadline: t.deadline } : {}),
      ...(t.collapsed ? { collapsed: true } : {})
    }
  })
  return {
    schemaVersion: SCHEMA_VERSION,
    info: { ...base.info, ...(r.info ?? {}) },
    calendar: {
      workWeek: Array.isArray(r.calendar?.workWeek) && r.calendar.workWeek.length === 7 ? r.calendar.workWeek.map(Boolean) : base.calendar.workWeek,
      holidays: Array.isArray(r.calendar?.holidays) ? r.calendar.holidays.filter((h) => h && isValidISO(h.date)) : base.calendar.holidays
    },
    trades,
    tasks: normalizeLevels(tasks),
    nearCriticalThreshold: Number.isFinite(r.nearCriticalThreshold) ? Math.max(0, Number(r.nearCriticalThreshold)) : 5
  }
}

function validDep(d: Dependency): boolean {
  return !!d && Number.isInteger(d.predUid) && ['FC', 'CC', 'FF', 'CF'].includes(d.type) && Number.isFinite(d.lag)
}

export function serializeProject(p: Project): string {
  return JSON.stringify(p, null, 2)
}
