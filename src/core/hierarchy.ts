// Estructura jerárquica (EDT) sobre una lista plana ordenada de tareas con nivel de esquema.
import type { Task } from './types'

/** Corrige niveles imposibles: la primera fila es nivel 0 y ninguna fila puede bajar más de un nivel respecto a la anterior. */
export function normalizeLevels(tasks: Task[]): Task[] {
  let prev = -1
  let changed = false
  const out = tasks.map((t) => {
    const lvl = Math.max(0, Math.min(t.level, prev + 1))
    prev = lvl
    if (lvl !== t.level) {
      changed = true
      return { ...t, level: lvl }
    }
    return t
  })
  return changed ? out : tasks
}

export function isSummaryAt(tasks: Task[], index: number): boolean {
  return index + 1 < tasks.length && tasks[index + 1].level > tasks[index].level
}

export function summaryFlags(tasks: Task[]): boolean[] {
  return tasks.map((_, i) => isSummaryAt(tasks, i))
}

/** Numeración EDT: 1, 1.1, 1.1.1, 2 … */
export function computeWBS(tasks: Task[]): string[] {
  const counters: number[] = []
  return tasks.map((t) => {
    counters.length = t.level + 1
    counters[t.level] = (counters[t.level] ?? 0) + 1
    for (let i = 0; i < t.level; i++) if (!counters[i]) counters[i] = 1
    return counters.join('.')
  })
}

/** Índice (exclusivo) donde termina el bloque de descendientes de la fila `index`. */
export function subtreeEnd(tasks: Task[], index: number): number {
  const lvl = tasks[index].level
  let j = index + 1
  while (j < tasks.length && tasks[j].level > lvl) j++
  return j
}

/** Índices de los antecesores (capítulos) de la fila `index`, del más cercano al más lejano. */
export function ancestorsOf(tasks: Task[], index: number): number[] {
  const res: number[] = []
  let lvl = tasks[index].level
  for (let i = index - 1; i >= 0 && lvl > 0; i--) {
    if (tasks[i].level < lvl) {
      res.push(i)
      lvl = tasks[i].level
    }
  }
  return res
}

/** Filas visibles teniendo en cuenta capítulos plegados. */
export function visibleIndices(tasks: Task[]): number[] {
  const res: number[] = []
  let i = 0
  while (i < tasks.length) {
    res.push(i)
    if (tasks[i].collapsed && isSummaryAt(tasks, i)) i = subtreeEnd(tasks, i)
    else i++
  }
  return res
}

/** Aumenta sangría de las filas indicadas (Alt+Mayús+→). Arrastra a sus descendientes. */
export function indent(tasks: Task[], indices: number[]): Task[] {
  const set = new Set(indices)
  const out = tasks.map((t) => ({ ...t }))
  const done = new Set<number>()
  for (const i of [...set].sort((a, b) => a - b)) {
    if (i === 0 || done.has(i)) continue
    if (out[i].level > out[i - 1].level) continue // ya es hija de la anterior: no puede bajar más
    const end = subtreeEnd(tasks, i)
    for (let j = i; j < end; j++) {
      out[j].level += 1
      done.add(j)
    }
  }
  return normalizeLevels(out)
}

/** Reduce sangría (Alt+Mayús+←). Arrastra a sus descendientes. */
export function outdent(tasks: Task[], indices: number[]): Task[] {
  const out = tasks.map((t) => ({ ...t }))
  const done = new Set<number>()
  for (const i of [...new Set(indices)].sort((a, b) => a - b)) {
    if (done.has(i) || out[i].level === 0) continue
    const end = subtreeEnd(tasks, i)
    for (let j = i; j < end; j++) {
      out[j].level = Math.max(0, out[j].level - 1)
      done.add(j)
    }
  }
  return normalizeLevels(out)
}

/** Elimina tareas (y sus descendientes) y limpia los vínculos que apuntaban a ellas. */
export function removeTasks(tasks: Task[], indices: number[]): Task[] {
  const kill = new Set<number>()
  for (const i of indices) {
    const end = subtreeEnd(tasks, i)
    for (let j = i; j < end; j++) kill.add(j)
  }
  const killedUids = new Set([...kill].map((i) => tasks[i].uid))
  const kept = tasks
    .filter((_, i) => !kill.has(i))
    .map((t) =>
      t.predecessors.some((p) => killedUids.has(p.predUid))
        ? { ...t, predecessors: t.predecessors.filter((p) => !killedUids.has(p.predUid)) }
        : t
    )
  return normalizeLevels(kept)
}

/** Mueve un bloque (fila + descendientes) una posición arriba/abajo entre sus hermanas. */
export function moveBlock(tasks: Task[], index: number, dir: -1 | 1): { tasks: Task[]; newIndex: number } {
  const lvl = tasks[index].level
  const end = subtreeEnd(tasks, index)
  if (dir === -1) {
    let p = index - 1
    while (p >= 0 && tasks[p].level > lvl) p--
    if (p < 0 || tasks[p].level < lvl) return { tasks, newIndex: index }
    const block = tasks.slice(index, end)
    const prev = tasks.slice(p, index)
    return { tasks: [...tasks.slice(0, p), ...block, ...prev, ...tasks.slice(end)], newIndex: p }
  }
  if (end >= tasks.length || tasks[end].level !== lvl) return { tasks, newIndex: index }
  const nextEnd = subtreeEnd(tasks, end)
  const block = tasks.slice(index, end)
  const next = tasks.slice(end, nextEnd)
  return { tasks: [...tasks.slice(0, index), ...next, ...block, ...tasks.slice(nextEnd)], newIndex: index + next.length }
}
