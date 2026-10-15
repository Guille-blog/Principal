// Motor de programación: método del camino crítico (CPM) con vínculos FC/CC/FF/CF y desfases.
//
// Modelo temporal: cada tarea ocupa un intervalo semiabierto de ordinales laborables [ES, EF), con EF = ES + duración.
// Un hito (duración 0) es un instante: ES = EF.
//
// Restricciones (pasada hacia delante), para un vínculo pred → succ con desfase L:
//   FC: succ.ES ≥ pred.EF + L
//   CC: succ.ES ≥ pred.ES + L
//   FF: succ.EF ≥ pred.EF + L   →  succ.ES ≥ pred.EF + L − d(succ)
//   CF: succ.EF ≥ pred.ES + L   →  succ.ES ≥ pred.ES + L − d(succ)
// Pasada hacia atrás (límite para el LF del predecesor):
//   FC: pred.LF ≤ succ.LS − L
//   CC: pred.LF ≤ succ.LS − L + d(pred)
//   FF: pred.LF ≤ succ.LF − L
//   CF: pred.LF ≤ succ.LF − L + d(pred)
// Holgura total = LS − ES. Holgura libre = margen hasta afectar al inicio temprano de alguna sucesora.
import { WorkCalendar } from './calendar'
import { dayToISO, isoToDay } from './dates'
import { computeWBS, summaryFlags } from './hierarchy'
import type { Dependency, ISODate, Project, Task } from './types'

export interface TaskSchedule {
  uid: number
  index: number
  wbs: string
  isSummary: boolean
  isMilestone: boolean
  /** Ordinales laborables (sólo tareas no resumen). */
  es: number
  ef: number
  ls: number
  lf: number
  totalFloat: number
  freeFloat: number
  critical: boolean
  nearCritical: boolean
  /** Fechas para mostrar (ISO). En hitos start = finish. */
  start: ISODate
  finish: ISODate
  lateStart: ISODate
  lateFinish: ISODate
  /** Días naturales para dibujar: la barra va de startDay (inicio del día) a finishDay (fin del día). */
  startDay: number
  finishDay: number
  /** Posición del hito en días naturales (frontera entre días). */
  milestoneAt: number
  /** Duración mostrada en laborables (en resúmenes: laborables entre inicio y fin). */
  duration: number
  /** Predecesoras que determinan el inicio temprano (vínculos "conductores"). */
  drivingPreds: number[]
  /** La restricción "no comenzar antes de" retrasa la tarea respecto a lo que permiten sus predecesoras. */
  constraintDelays: boolean
}

export type IssueLevel = 'error' | 'warning' | 'info'

export interface ScheduleIssue {
  level: IssueLevel
  code: 'cycle' | 'summary-link' | 'missing-link' | 'no-links' | 'no-predecessors' | 'no-successors' | 'negative-float' | 'constraint' | 'deadline'
  message: string
  uids: number[]
}

export interface ScheduleResult {
  byUid: Map<number, TaskSchedule>
  list: TaskSchedule[]
  projectStart: ISODate
  projectFinish: ISODate
  /** Duración del proyecto en días laborables. */
  projectDuration: number
  /** Cadenas críticas (uids en orden), de más larga a más corta. */
  criticalPaths: number[][]
  /** Vínculos críticos, clave `${predUid}>${succUid}` */
  criticalLinks: Set<string>
  issues: ScheduleIssue[]
  hasCycle: boolean
  linkCount: number
  calendar: WorkCalendar
}

interface Edge {
  pred: number // índice de nodo
  succ: number
  dep: Dependency
}

export const linkKey = (predUid: number, succUid: number): string => `${predUid}>${succUid}`

export function computeSchedule(project: Project): ScheduleResult {
  const cal = new WorkCalendar(project.calendar)
  const tasks = project.tasks
  const n = tasks.length
  const isSummary = summaryFlags(tasks)
  const wbs = computeWBS(tasks)
  const indexOfUid = new Map<number, number>()
  tasks.forEach((t, i) => indexOfUid.set(t.uid, i))
  const issues: ScheduleIssue[] = []
  const projectStartOrd = cal.ordinal(isoToDay(project.info.start))

  // ---- Grafo de vínculos entre tareas no resumen ----
  const edges: Edge[] = []
  const inEdges: Edge[][] = Array.from({ length: n }, () => [])
  const outEdges: Edge[][] = Array.from({ length: n }, () => [])
  const summaryLinkUids: number[] = []
  const missingLinkUids: number[] = []
  tasks.forEach((t, si) => {
    for (const dep of t.predecessors) {
      const pi = indexOfUid.get(dep.predUid)
      if (pi === undefined) {
        missingLinkUids.push(t.uid)
        continue
      }
      if (isSummary[pi] || isSummary[si]) {
        summaryLinkUids.push(t.uid)
        continue
      }
      const e: Edge = { pred: pi, succ: si, dep }
      edges.push(e)
      inEdges[si].push(e)
      outEdges[pi].push(e)
    }
  })
  if (summaryLinkUids.length) {
    issues.push({
      level: 'warning',
      code: 'summary-link',
      message:
        'Hay vínculos que apuntan a capítulos (tareas resumen). En esta versión se ignoran en el cálculo: vincula las tareas concretas del capítulo.',
      uids: [...new Set(summaryLinkUids)]
    })
  }
  if (missingLinkUids.length) {
    issues.push({ level: 'warning', code: 'missing-link', message: 'Hay vínculos a tareas que ya no existen (se ignoran).', uids: [...new Set(missingLinkUids)] })
  }

  // ---- Orden topológico (Kahn) y detección de ciclos ----
  const indeg = new Array<number>(n).fill(0)
  for (const e of edges) indeg[e.succ]++
  const order: number[] = []
  const queue: number[] = []
  for (let i = 0; i < n; i++) if (!isSummary[i] && indeg[i] === 0) queue.push(i)
  while (queue.length) {
    const i = queue.shift() as number
    order.push(i)
    for (const e of outEdges[i]) if (--indeg[e.succ] === 0) queue.push(e.succ)
  }
  const leafCount = isSummary.filter((s) => !s).length
  const hasCycle = order.length < leafCount
  if (hasCycle) {
    const cycle = findCycle(n, outEdges, indeg)
    issues.push({
      level: 'error',
      code: 'cycle',
      message: `Dependencia circular: ${cycle.map((i) => `fila ${i + 1} (${tasks[i].name || 'sin nombre'})`).join(' → ')} → … El camino crítico no se puede calcular hasta romper el ciclo.`,
      uids: cycle.map((i) => tasks[i].uid)
    })
    // Para poder dibujar algo, se procesan después los nodos atrapados en el ciclo ignorando sus vínculos.
    for (let i = 0; i < n; i++) if (!isSummary[i] && indeg[i] > 0) order.push(i)
  }

  // ---- Pasada hacia delante ----
  const dur = tasks.map((t) => Math.max(0, Math.round(t.duration)))
  const ES = new Array<number>(n).fill(0)
  const EF = new Array<number>(n).fill(0)
  const driving: number[][] = Array.from({ length: n }, () => [])
  const constraintDelays = new Array<boolean>(n).fill(false)
  /** Hitos anclados al final de la jornada anterior (los conduce un fin de predecesora). */
  const finishAnchored = new Array<boolean>(n).fill(false)
  const processed = new Array<boolean>(n).fill(false)
  for (const i of order) {
    const t = tasks[i]
    const ownStart = cal.ordinal(isoToDay(t.start))
    const validIn = inEdges[i].filter((e) => processed[e.pred])
    let es: number
    let drivers: number[] = []
    let anchoredToFinish = false
    if (validIn.length === 0) {
      es = ownStart
    } else {
      let linkES = -Infinity
      for (const e of validIn) {
        const req = requiredES(e, ES, EF, dur[i])
        if (req > linkES) {
          linkES = req
          drivers = [e.pred]
          anchoredToFinish = e.dep.type === 'FC' || e.dep.type === 'FF'
        } else if (req === linkES) {
          drivers.push(e.pred)
        }
      }
      linkES = Math.max(linkES, projectStartOrd)
      es = linkES
      if (t.constraint === 'snet' && ownStart > linkES) {
        es = ownStart
        drivers = []
        anchoredToFinish = false
        constraintDelays[i] = true
      }
    }
    ES[i] = es
    EF[i] = es + dur[i]
    driving[i] = drivers.map((p) => tasks[p].uid)
    finishAnchored[i] = dur[i] === 0 && anchoredToFinish
    processed[i] = true
  }

  // ---- Fin del proyecto y pasada hacia atrás ----
  const leaves = order
  let projectFinishOrd = -Infinity
  let projectStartMin = Infinity
  for (const i of leaves) {
    projectFinishOrd = Math.max(projectFinishOrd, EF[i])
    projectStartMin = Math.min(projectStartMin, ES[i])
  }
  if (!Number.isFinite(projectFinishOrd)) {
    projectFinishOrd = projectStartOrd
    projectStartMin = projectStartOrd
  }
  let terminalLF = projectFinishOrd
  if (project.info.deadline) {
    const dl = cal.ordinal(isoToDay(project.info.deadline) + 1)
    if (dl < terminalLF) terminalLF = dl
  }
  const LF = new Array<number>(n).fill(0)
  const LS = new Array<number>(n).fill(0)
  const validOut = (i: number): Edge[] => (hasCycle ? outEdges[i].filter((e) => indeg[e.succ] === 0 && indeg[e.pred] === 0) : outEdges[i])
  for (let k = leaves.length - 1; k >= 0; k--) {
    const i = leaves[k]
    let lf = terminalLF
    const outs = validOut(i)
    if (outs.length) {
      lf = Infinity
      for (const e of outs) lf = Math.min(lf, boundLF(e, LS, LF, dur[i]))
      // Una tarea nunca puede tener fin tardío posterior al fin (o fecha contractual) del proyecto.
      lf = Math.min(lf, terminalLF)
    }
    if (tasks[i].deadline) lf = Math.min(lf, cal.ordinal(isoToDay(tasks[i].deadline as string) + 1))
    LF[i] = lf
    LS[i] = lf - dur[i]
  }

  // ---- Holguras ----
  const TF = new Array<number>(n).fill(0)
  const FF = new Array<number>(n).fill(0)
  for (const i of leaves) {
    TF[i] = LS[i] - ES[i]
    const outs = validOut(i)
    let ff = outs.length ? Infinity : projectFinishOrd - EF[i]
    for (const e of outs) ff = Math.min(ff, linkSlack(e, ES, EF))
    FF[i] = Math.max(0, Math.min(ff, Math.max(TF[i], 0)))
  }
  const threshold = Math.max(0, project.nearCriticalThreshold ?? 5)
  const critical = (i: number): boolean => !hasCycle && TF[i] <= 0

  // ---- Resultado por tarea ----
  const byUid = new Map<number, TaskSchedule>()
  const list: TaskSchedule[] = new Array(n)
  for (let i = 0; i < n; i++) {
    if (isSummary[i]) continue
    const d = dur[i]
    const isMs = d === 0
    const startDay = cal.dayOfOrdinal(ES[i])
    const finishDay = isMs ? startDay : cal.dayOfOrdinal(EF[i] - 1)
    let msDay = startDay
    let milestoneAt = startDay
    if (isMs && finishAnchored[i]) {
      msDay = cal.dayOfOrdinal(ES[i] - 1)
      milestoneAt = msDay + 1
    }
    const lateStartDay = cal.dayOfOrdinal(LS[i])
    const lateFinishDay = d === 0 ? lateStartDay : cal.dayOfOrdinal(LF[i] - 1)
    const s: TaskSchedule = {
      uid: tasks[i].uid,
      index: i,
      wbs: wbs[i],
      isSummary: false,
      isMilestone: isMs,
      es: ES[i],
      ef: EF[i],
      ls: LS[i],
      lf: LF[i],
      totalFloat: TF[i],
      freeFloat: FF[i],
      critical: critical(i),
      nearCritical: !hasCycle && TF[i] > 0 && TF[i] <= threshold,
      start: dayToISO(isMs ? msDay : startDay),
      finish: dayToISO(isMs ? msDay : finishDay),
      lateStart: dayToISO(lateStartDay),
      lateFinish: dayToISO(lateFinishDay),
      startDay: isMs ? msDay : startDay,
      finishDay: isMs ? msDay : finishDay,
      milestoneAt,
      duration: d,
      drivingPreds: driving[i],
      constraintDelays: constraintDelays[i]
    }
    list[i] = s
    byUid.set(s.uid, s)
  }

  // ---- Resúmenes (de abajo arriba) ----
  for (let i = n - 1; i >= 0; i--) {
    if (!isSummary[i]) continue
    const lvl = tasks[i].level
    let sd = Infinity
    let fd = -Infinity
    let es = Infinity
    let ef = -Infinity
    let tf = Infinity
    let crit = false
    let near = false
    for (let j = i + 1; j < n && tasks[j].level > lvl; j++) {
      if (tasks[j].level !== lvl + 1) continue
      const c = list[j]
      sd = Math.min(sd, c.isMilestone ? c.milestoneAt : c.startDay)
      fd = Math.max(fd, c.isMilestone ? c.milestoneAt - 1 : c.finishDay)
      es = Math.min(es, c.es)
      ef = Math.max(ef, c.ef)
      tf = Math.min(tf, c.totalFloat)
      crit = crit || c.critical
      near = near || c.nearCritical
    }
    if (fd < sd) fd = sd
    const s: TaskSchedule = {
      uid: tasks[i].uid,
      index: i,
      wbs: wbs[i],
      isSummary: true,
      isMilestone: false,
      es,
      ef,
      ls: es + tf,
      lf: ef + tf,
      totalFloat: tf,
      freeFloat: 0,
      critical: crit,
      nearCritical: near,
      start: dayToISO(sd),
      finish: dayToISO(fd),
      lateStart: dayToISO(sd),
      lateFinish: dayToISO(fd),
      startDay: sd,
      finishDay: fd,
      milestoneAt: sd,
      duration: cal.workdaysInclusive(sd, fd),
      drivingPreds: [],
      constraintDelays: false
    }
    list[i] = s
    byUid.set(s.uid, s)
  }

  // ---- Vínculos críticos y cadenas ----
  const criticalLinks = new Set<string>()
  const critSucc: number[][] = Array.from({ length: n }, () => [])
  const critPredCount = new Array<number>(n).fill(0)
  if (!hasCycle) {
    for (const e of edges) {
      if (!critical(e.pred) || !critical(e.succ)) continue
      if (boundLF(e, LS, LF, dur[e.pred]) !== LF[e.pred]) continue
      criticalLinks.add(linkKey(tasks[e.pred].uid, tasks[e.succ].uid))
      critSucc[e.pred].push(e.succ)
      critPredCount[e.succ]++
    }
  }
  const criticalPaths: number[][] = []
  if (!hasCycle) {
    const MAX_PATHS = 20
    const starts = leaves.filter((i) => critical(i) && critPredCount[i] === 0).sort((a, b) => ES[a] - ES[b])
    const walk = (i: number, path: number[]): void => {
      if (criticalPaths.length >= MAX_PATHS) return
      const next = [...critSucc[i]].sort((a, b) => ES[a] - ES[b])
      if (!next.length) {
        criticalPaths.push([...path, i].map((k) => tasks[k].uid))
        return
      }
      for (const s of next) walk(s, [...path, i])
    }
    for (const s of starts) walk(s, [])
    const length = (p: number[]): number => p.reduce((acc, uid) => acc + dur[indexOfUid.get(uid) as number], 0)
    criticalPaths.sort((a, b) => length(b) - length(a))
  }

  // ---- Validaciones ----
  const leafIdx = leaves.filter((i) => !isSummary[i])
  if (edges.length === 0 && leafIdx.length > 1) {
    issues.push({
      level: 'warning',
      code: 'no-links',
      message:
        'No hay ninguna dependencia entre tareas. Sin vínculos no existe camino crítico real: cada tarea sólo depende de su fecha de inicio. Añade predecesoras (columna "Predecesoras").',
      uids: []
    })
  } else if (!hasCycle && leafIdx.length > 1) {
    const noPred = leafIdx.filter((i) => inEdges[i].length === 0)
    const noSucc = leafIdx.filter((i) => outEdges[i].length === 0)
    if (noPred.length > 1) {
      issues.push({
        level: 'warning',
        code: 'no-predecessors',
        message: `${noPred.length} tareas no tienen predecesoras. Lo correcto es que sólo el hito de inicio carezca de ellas; el resto quedan "sueltas" y pueden ocultar el camino crítico real.`,
        uids: noPred.map((i) => tasks[i].uid)
      })
    }
    if (noSucc.length > 1) {
      issues.push({
        level: 'warning',
        code: 'no-successors',
        message: `${noSucc.length} tareas no tienen sucesoras. Lo correcto es que sólo el hito de fin carezca de ellas; si no, su retraso no se refleja en la fecha de fin.`,
        uids: noSucc.map((i) => tasks[i].uid)
      })
    }
  }
  const constrained = leafIdx.filter((i) => constraintDelays[i])
  if (constrained.length) {
    issues.push({
      level: 'info',
      code: 'constraint',
      message: `${constrained.length} tareas tienen una restricción "No comenzar antes de" que las retrasa respecto a sus predecesoras (normalmente por haberlas movido a mano). Revisa si es intencionado; se puede quitar con "Quitar restricción".`,
      uids: constrained.map((i) => tasks[i].uid)
    })
  }
  const negative = leafIdx.filter((i) => TF[i] < 0)
  if (!hasCycle && negative.length) {
    issues.push({
      level: 'error',
      code: 'negative-float',
      message: `${negative.length} tareas tienen holgura NEGATIVA: con la lógica actual no se cumple la fecha contractual del proyecto o la fecha límite de alguna tarea. Hay que acortar duraciones, solapar tareas o renegociar plazos.`,
      uids: negative.map((i) => tasks[i].uid)
    })
  }
  if (project.info.deadline && projectFinishOrd > cal.ordinal(isoToDay(project.info.deadline) + 1)) {
    const over = projectFinishOrd - cal.ordinal(isoToDay(project.info.deadline) + 1)
    issues.push({
      level: 'error',
      code: 'deadline',
      message: `La fecha de fin calculada supera la fecha contractual en ${over} días laborables.`,
      uids: []
    })
  }

  const startDay = cal.dayOfOrdinal(projectStartMin)
  const finishDay = projectFinishOrd > projectStartMin ? cal.dayOfOrdinal(projectFinishOrd - 1) : startDay
  return {
    byUid,
    list,
    projectStart: dayToISO(startDay),
    projectFinish: dayToISO(finishDay),
    projectDuration: Math.max(0, projectFinishOrd - projectStartMin),
    criticalPaths,
    criticalLinks,
    issues,
    hasCycle,
    linkCount: edges.length,
    calendar: cal
  }
}

function requiredES(e: Edge, ES: number[], EF: number[], dSucc: number): number {
  const L = e.dep.lag
  switch (e.dep.type) {
    case 'FC':
      return EF[e.pred] + L
    case 'CC':
      return ES[e.pred] + L
    case 'FF':
      return EF[e.pred] + L - dSucc
    case 'CF':
      return ES[e.pred] + L - dSucc
  }
}

function boundLF(e: Edge, LS: number[], LF: number[], dPred: number): number {
  const L = e.dep.lag
  switch (e.dep.type) {
    case 'FC':
      return LS[e.succ] - L
    case 'CC':
      return LS[e.succ] - L + dPred
    case 'FF':
      return LF[e.succ] - L
    case 'CF':
      return LF[e.succ] - L + dPred
  }
}

/** Margen del vínculo en la programación temprana (para la holgura libre). */
function linkSlack(e: Edge, ES: number[], EF: number[]): number {
  const L = e.dep.lag
  switch (e.dep.type) {
    case 'FC':
      return ES[e.succ] - (EF[e.pred] + L)
    case 'CC':
      return ES[e.succ] - (ES[e.pred] + L)
    case 'FF':
      return EF[e.succ] - (EF[e.pred] + L)
    case 'CF':
      return EF[e.succ] - (ES[e.pred] + L)
  }
}

/** Devuelve los índices de un ciclo entre los nodos que no pudieron ordenarse. */
function findCycle(n: number, outEdges: Edge[][], indeg: number[]): number[] {
  const inCycleSet = (i: number): boolean => indeg[i] > 0
  const color = new Array<number>(n).fill(0)
  const stack: number[] = []
  let found: number[] = []
  const dfs = (u: number): boolean => {
    color[u] = 1
    stack.push(u)
    for (const e of outEdges[u]) {
      const v = e.succ
      if (!inCycleSet(v)) continue
      if (color[v] === 1) {
        found = stack.slice(stack.indexOf(v))
        return true
      }
      if (color[v] === 0 && dfs(v)) return true
    }
    stack.pop()
    color[u] = 2
    return false
  }
  for (let i = 0; i < n; i++) if (inCycleSet(i) && color[i] === 0 && dfs(i)) break
  return found
}

/** Ayuda para la interfaz: tareas resumen y su uid → índice. */
export function rowOfUidMap(tasks: Task[]): Map<number, number> {
  const m = new Map<number, number>()
  tasks.forEach((t, i) => m.set(t.uid, i))
  return m
}
