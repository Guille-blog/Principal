// Modelo de datos del proyecto. Todo lo que se guarda en el archivo .gantt.json está aquí.

/** Fecha de calendario en formato ISO `YYYY-MM-DD` (sin hora ni zona horaria). */
export type ISODate = string

/** Tipos de vínculo en notación española (MS Project ES): Fin-Comienzo, Comienzo-Comienzo, Fin-Fin, Comienzo-Fin. */
export type LinkType = 'FC' | 'CC' | 'FF' | 'CF'

export interface Dependency {
  /** uid de la tarea predecesora */
  predUid: number
  type: LinkType
  /** Desfase en días laborables (puede ser negativo = solape). */
  lag: number
}

/**
 * asap: lo antes posible (se coloca según predecesoras).
 * snet: "no comenzar antes de" la fecha `start` (se aplica automáticamente al fijar a mano el inicio
 * de una tarea con predecesoras, como hace MS Project).
 */
export type ConstraintType = 'asap' | 'snet'

export interface Task {
  /** Identificador interno estable (no cambia al reordenar). */
  uid: number
  name: string
  /** Nivel de esquema: 0 = primer nivel. Las tareas resumen se deducen del nivel de la fila siguiente. */
  level: number
  /** Inicio introducido por el usuario. En tareas sin predecesoras es su fecha de inicio. */
  start: ISODate
  /** Duración en días laborables. 0 = hito. */
  duration: number
  constraint: ConstraintType
  predecessors: Dependency[]
  /** id del gremio (ver Project.trades) */
  trade: string
  responsible: string
  /** 0..100 */
  progress: number
  notes: string
  /** Fecha límite opcional (fin como muy tarde). Genera holgura negativa si se incumple. */
  deadline?: ISODate
  /** Capítulo plegado en la vista. */
  collapsed?: boolean
}

export interface Trade {
  id: string
  name: string
  color: string
}

export interface Holiday {
  date: ISODate
  name: string
}

export interface WorkCalendarDef {
  /** Días laborables indexados por getUTCDay(): 0 = domingo … 6 = sábado. */
  workWeek: boolean[]
  holidays: Holiday[]
}

export interface ProjectInfo {
  name: string
  client: string
  location: string
  manager: string
  revision: string
  /** Fecha de inicio del proyecto: valor por defecto de las tareas nuevas. */
  start: ISODate
  /** Fecha de fin contractual opcional. Si el cálculo la supera, aparecen holguras negativas. */
  deadline?: ISODate
}

export interface Project {
  schemaVersion: number
  info: ProjectInfo
  calendar: WorkCalendarDef
  trades: Trade[]
  tasks: Task[]
  /** Umbral (días) a partir del cual una tarea se considera "casi crítica". */
  nearCriticalThreshold: number
}

export const SCHEMA_VERSION = 1
