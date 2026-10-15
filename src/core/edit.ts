// Operaciones de edición sobre el proyecto (puras: devuelven un proyecto nuevo o un error).
import { isoToDay, dayToISO, parseDateES } from './dates'
import { isSummaryAt, normalizeLevels, subtreeEnd } from './hierarchy'
import { formatPredecessors, parsePredecessors } from './predecessors'
import { newTask, nextUid } from './project'
import { computeSchedule, rowOfUidMap, type ScheduleResult } from './schedule'
import type { Dependency, LinkType, Project, Task } from './types'

export type EditResult = { project: Project } | { error: string }

export type FieldKey = 'name' | 'duration' | 'start' | 'finish' | 'preds' | 'trade' | 'responsible' | 'progress' | 'deadline' | 'notes'

function replaceTask(p: Project, uid: number, patch: Partial<Task>): Project {
  return { ...p, tasks: p.tasks.map((t) => (t.uid === uid ? { ...t, ...patch } : t)) }
}

function refYear(p: Project): number {
  return Number(p.info.start.slice(0, 4)) || new Date().getFullYear()
}

/** Texto que se muestra/edita en una celda. */
export function fieldText(p: Project, s: ScheduleResult, rows: Map<number, number>, t: Task, field: FieldKey): string {
  const sc = s.byUid.get(t.uid)
  switch (field) {
    case 'name':
      return t.name
    case 'duration':
      return String(sc?.duration ?? t.duration)
    case 'start':
      return sc?.start ?? t.start
    case 'finish':
      return sc?.finish ?? t.start
    case 'preds':
      return formatPredecessors(t.predecessors, rows)
    case 'trade':
      return p.trades.find((x) => x.id === t.trade)?.name ?? ''
    case 'responsible':
      return t.responsible
    case 'progress':
      return String(t.progress)
    case 'deadline':
      return t.deadline ?? ''
    case 'notes':
      return t.notes
  }
}

/** Aplica un valor escrito por el usuario en una celda. */
export function applyField(p: Project, s: ScheduleResult, uid: number, field: FieldKey, raw: string): EditResult {
  const index = p.tasks.findIndex((t) => t.uid === uid)
  if (index < 0) return { error: 'La tarea no existe.' }
  const t = p.tasks[index]
  const summary = isSummaryAt(p.tasks, index)
  const text = raw.trim()
  const sc = s.byUid.get(uid)
  switch (field) {
    case 'name':
      return { project: replaceTask(p, uid, { name: raw.trim() }) }
    case 'responsible':
      return { project: replaceTask(p, uid, { responsible: text }) }
    case 'notes':
      return { project: replaceTask(p, uid, { notes: raw }) }
    case 'trade': {
      const tr = p.trades.find((x) => x.id === text || x.name.toLowerCase() === text.toLowerCase())
      if (!tr) return { error: `Gremio desconocido: "${text}"` }
      return { project: replaceTask(p, uid, { trade: tr.id }) }
    }
    case 'progress': {
      const v = Number(text.replace('%', '').replace(',', '.'))
      if (!Number.isFinite(v) || v < 0 || v > 100) return { error: 'El avance debe estar entre 0 y 100 %.' }
      return { project: replaceTask(p, uid, { progress: Math.round(v) }) }
    }
    case 'duration': {
      if (summary) return { error: 'La duración de un capítulo se calcula a partir de sus tareas.' }
      const m = /^(\d+(?:[.,]\d+)?)\s*(d|días|dias|día|dia|s|sem|semanas?)?$/i.exec(text)
      if (!m) return { error: 'Duración no válida. Ejemplos: 5, 5d, 2sem, 0 (hito).' }
      let v = Number(m[1].replace(',', '.'))
      if (m[2] && /^s/i.test(m[2])) v *= p.calendar.workWeek.filter(Boolean).length
      v = Math.round(v)
      if (v > 5000) return { error: 'Duración excesiva.' }
      return { project: replaceTask(p, uid, { duration: v }) }
    }
    case 'start': {
      if (summary) return { error: 'El inicio de un capítulo se calcula a partir de sus tareas.' }
      const d = parseDateES(text, refYear(p))
      if (!d) return { error: 'Fecha no válida. Formato: dd/mm/aaaa.' }
      return { project: setStart(p, s, t, d) }
    }
    case 'finish': {
      if (summary) return { error: 'El fin de un capítulo se calcula a partir de sus tareas.' }
      const d = parseDateES(text, refYear(p))
      if (!d) return { error: 'Fecha no válida. Formato: dd/mm/aaaa.' }
      if (!sc) return { error: 'Sin programación.' }
      if (t.duration === 0) return { project: setStart(p, s, t, d) }
      const fin = isoToDay(d)
      if (fin < sc.startDay) return { error: 'El fin no puede ser anterior al inicio.' }
      const dur = s.calendar.workdaysInclusive(sc.startDay, fin)
      if (dur <= 0) return { error: 'El fin cae en un día no laborable anterior al primer día de trabajo.' }
      return { project: replaceTask(p, uid, { duration: dur }) }
    }
    case 'deadline': {
      if (!text) return { project: replaceTask(p, uid, { deadline: undefined }) }
      const d = parseDateES(text, refYear(p))
      if (!d) return { error: 'Fecha no válida. Formato: dd/mm/aaaa.' }
      return { project: replaceTask(p, uid, { deadline: d }) }
    }
    case 'preds': {
      if (summary) return { error: 'En esta versión los vínculos se ponen en tareas, no en capítulos.' }
      const r = parsePredecessors(text, p.tasks, index)
      if (r.errors.length) return { error: r.errors.join('. ') }
      const summaryPred = r.deps.find((d) => isSummaryAt(p.tasks, p.tasks.findIndex((x) => x.uid === d.predUid)))
      if (summaryPred) return { error: 'No se puede vincular a un capítulo: vincula sus tareas concretas.' }
      return setPredecessors(p, s, uid, r.deps)
    }
  }
}

function setStart(p: Project, _s: ScheduleResult, t: Task, iso: string): Project {
  // En una tarea con predecesoras, fijar el inicio a mano equivale a "No comenzar antes de" (como MS Project).
  return replaceTask(p, t.uid, { start: iso, constraint: t.predecessors.length ? 'snet' : 'asap' })
}

/** Cambia las predecesoras comprobando que no se cree un ciclo. */
export function setPredecessors(p: Project, s: ScheduleResult, uid: number, deps: Dependency[]): EditResult {
  const patch: Partial<Task> = { predecessors: deps }
  if (!deps.length) {
    // Al quitar todas las predecesoras, la tarea se queda donde estaba (no salta al inicio del proyecto).
    const sc = s.byUid.get(uid)
    if (sc) patch.start = sc.isMilestone ? dayToISO(sc.milestoneAt) : sc.start
    patch.constraint = 'asap'
  }
  const next = replaceTask(p, uid, patch)
  const cyc = cycleError(next)
  return cyc ? { error: cyc } : { project: next }
}

function cycleError(p: Project): string | null {
  const r = computeSchedule(p)
  const c = r.issues.find((i) => i.code === 'cycle')
  return r.hasCycle && c ? `No se puede: ${c.message.split(' El camino')[0]}` : null
}

export function addLink(p: Project, s: ScheduleResult, predUid: number, succUid: number, type: LinkType = 'FC', lag = 0): EditResult {
  if (predUid === succUid) return { error: 'Una tarea no puede vincularse consigo misma.' }
  const pi = p.tasks.findIndex((t) => t.uid === predUid)
  const si = p.tasks.findIndex((t) => t.uid === succUid)
  if (pi < 0 || si < 0) return { error: 'Tarea no encontrada.' }
  if (isSummaryAt(p.tasks, pi) || isSummaryAt(p.tasks, si)) return { error: 'No se puede vincular un capítulo: usa sus tareas.' }
  const succ = p.tasks[si]
  if (succ.predecessors.some((d) => d.predUid === predUid)) return { error: 'Esas tareas ya están vinculadas.' }
  return setPredecessors(p, s, succUid, [...succ.predecessors, { predUid, type, lag }])
}

/** Vincula en cadena (FC) las tareas seleccionadas, en orden de fila. */
export function linkChain(p: Project, s: ScheduleResult, uids: number[]): EditResult {
  const rows = rowOfUidMap(p.tasks)
  const ordered = uids
    .filter((u) => !isSummaryAt(p.tasks, rows.get(u) as number))
    .sort((a, b) => (rows.get(a) as number) - (rows.get(b) as number))
  if (ordered.length < 2) return { error: 'Selecciona al menos dos tareas (no capítulos) para vincularlas.' }
  let cur = p
  let sched = s
  for (let i = 1; i < ordered.length; i++) {
    const succ = cur.tasks.find((t) => t.uid === ordered[i]) as Task
    if (succ.predecessors.some((d) => d.predUid === ordered[i - 1])) continue
    const r = addLink(cur, sched, ordered[i - 1], ordered[i])
    if ('error' in r) return r
    cur = r.project
    sched = computeSchedule(cur)
  }
  return { project: cur }
}

/** Elimina los vínculos entre las tareas seleccionadas (o todas sus predecesoras si sólo hay una). */
export function unlink(p: Project, s: ScheduleResult, uids: number[]): Project {
  const set = new Set(uids)
  let cur = p
  for (const uid of uids) {
    const t = cur.tasks.find((x) => x.uid === uid) as Task
    const keep = set.size === 1 ? [] : t.predecessors.filter((d) => !set.has(d.predUid))
    if (keep.length !== t.predecessors.length) {
      const r = setPredecessors(cur, s, uid, keep)
      if ('project' in r) cur = r.project
    }
  }
  return cur
}

export function clearConstraints(p: Project, uids: number[]): Project {
  const set = new Set(uids)
  return { ...p, tasks: p.tasks.map((t) => (set.has(t.uid) && t.constraint === 'snet' ? { ...t, constraint: 'asap' } : t)) }
}

/** Arrastre de barra: nuevo inicio en día natural. */
export function moveTask(p: Project, s: ScheduleResult, uid: number, startDay: number): Project {
  const t = p.tasks.find((x) => x.uid === uid)
  if (!t) return p
  const day = s.calendar.nextWorkday(startDay)
  return setStart(p, s, t, dayToISO(day))
}

/** Estirar barra: nuevo fin en día natural. */
export function resizeTask(p: Project, s: ScheduleResult, uid: number, finishDay: number): Project {
  const sc = s.byUid.get(uid)
  if (!sc || sc.isSummary) return p
  const dur = Math.max(1, s.calendar.workdaysInclusive(sc.startDay, finishDay))
  return replaceTask(p, uid, { duration: dur })
}

/** Inserta una tarea en la posición `index` (antes de la fila que ocupa ese índice). */
export function insertTask(p: Project, index: number, opts: { level?: number; start?: string; name?: string; milestone?: boolean; trade?: string } = {}): { project: Project; uid: number } {
  const uid = nextUid(p.tasks)
  const prev = p.tasks[Math.min(index, p.tasks.length) - 1]
  const level = opts.level ?? (p.tasks[index]?.level ?? prev?.level ?? 0)
  const t = newTask(uid, opts.start ?? p.info.start, level, opts.name ?? '')
  if (opts.milestone) t.duration = 0
  if (opts.trade) t.trade = opts.trade
  const tasks = [...p.tasks.slice(0, index), t, ...p.tasks.slice(index)]
  return { project: { ...p, tasks: normalizeLevels(tasks) }, uid }
}

/** Duplica tareas (para pegar): copia con uids nuevos y reasigna vínculos internos. */
export function pasteTasks(p: Project, at: number, copied: Task[]): { project: Project; uids: number[] } {
  let uid = nextUid(p.tasks)
  const map = new Map<number, number>()
  for (const t of copied) map.set(t.uid, uid++)
  const existing = new Set(p.tasks.map((t) => t.uid))
  const baseLevel = Math.min(...copied.map((t) => t.level))
  const targetLevel = p.tasks[at]?.level ?? p.tasks[at - 1]?.level ?? 0
  const clones = copied.map((t) => ({
    ...t,
    uid: map.get(t.uid) as number,
    level: t.level - baseLevel + targetLevel,
    collapsed: false,
    predecessors: t.predecessors
      .filter((d) => map.has(d.predUid) || existing.has(d.predUid))
      .map((d) => ({ ...d, predUid: map.get(d.predUid) ?? d.predUid }))
  }))
  const tasks = normalizeLevels([...p.tasks.slice(0, at), ...clones, ...p.tasks.slice(at)])
  const next = { ...p, tasks }
  // Si el pegado creara un ciclo (vínculos con tareas externas), se descartan esos vínculos externos.
  if (computeSchedule(next).hasCycle) {
    const own = new Set(clones.map((c) => c.uid))
    next.tasks = next.tasks.map((t) => (own.has(t.uid) ? { ...t, predecessors: t.predecessors.filter((d) => own.has(d.predUid)) } : t))
  }
  return { project: next, uids: clones.map((c) => c.uid) }
}

/** Índice donde insertar "debajo" de una fila (después de su bloque si es capítulo plegado). */
export function indexAfter(p: Project, index: number): number {
  if (index < 0) return p.tasks.length
  const t = p.tasks[index]
  if (isSummaryAt(p.tasks, index) && t.collapsed) return subtreeEnd(p.tasks, index)
  return index + 1
}
