// Auditoría del motor CPM con redes aleatorias (todos los tipos de vínculo y desfases, con festivos).
// Propiedades comprobadas para cada red:
//  1. La programación temprana cumple todas las restricciones de vínculo.
//  2. Cada tarea arranca lo antes posible (algún vínculo, o el inicio del proyecto, la "conduce").
//  3. La holgura total es exacta: retrasar una tarea TF días no mueve el fin; TF+1 sí lo mueve.
//  4. La holgura libre no retrasa a ninguna sucesora.
//  5. Hay al menos un camino crítico y todos sus vínculos son críticos.
import { describe, expect, it } from 'vitest'
import { newTask, createEmptyProject } from './project'
import { computeSchedule, linkKey } from './schedule'
import type { Dependency, LinkType, Project } from './types'

const START = '2026-10-19'

/** Generador pseudoaleatorio reproducible (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomProject(seed: number): Project {
  const r = rng(seed)
  const n = 4 + Math.floor(r() * 18)
  const p = createEmptyProject(START)
  p.calendar = {
    workWeek: [false, true, true, true, true, true, r() < 0.2],
    holidays: [{ date: '2026-11-02', name: 'F' }, { date: '2026-12-08', name: 'F' }, { date: '2026-12-25', name: 'F' }]
  }
  const types: LinkType[] = ['FC', 'CC', 'FF', 'CF']
  p.tasks = Array.from({ length: n }, (_, i) => {
    const t = newTask(i + 1, START, 0, `T${i + 1}`)
    t.duration = r() < 0.12 ? 0 : 1 + Math.floor(r() * 8)
    return t
  })
  // Vínculos sólo hacia delante (garantiza red acíclica)
  for (let i = 1; i < n; i++) {
    const deps: Dependency[] = []
    const k = Math.floor(r() * 3)
    const used = new Set<number>()
    for (let j = 0; j < k; j++) {
      const pred = Math.floor(r() * i)
      if (used.has(pred)) continue
      used.add(pred)
      const lag = r() < 0.6 ? 0 : Math.floor(r() * 7) - 3
      deps.push({ predUid: pred + 1, type: types[Math.floor(r() * 4)], lag })
    }
    p.tasks[i].predecessors = deps
  }
  return p
}

function finishOrd(p: Project): number {
  const s = computeSchedule(p)
  return Math.max(...s.list.filter(Boolean).map((x) => x.ef))
}

describe('Auditoría CPM con redes aleatorias', () => {
  const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)

  it.each(SEEDS)('red aleatoria %i', (seed) => {
    const p = randomProject(seed)
    const s = computeSchedule(p)
    expect(s.hasCycle).toBe(false)
    const startOrd = s.calendar.ordinal(Math.round(Date.UTC(2026, 9, 19) / 86_400_000))
    const byUid = s.byUid
    const finish = Math.max(...s.list.map((x) => x.ef))

    for (const t of p.tasks) {
      const st = byUid.get(t.uid)!
      // 1 y 2: restricciones y arranque lo antes posible
      let lower = t.predecessors.length ? startOrd : startOrd
      for (const d of t.predecessors) {
        const pr = byUid.get(d.predUid)!
        const req =
          d.type === 'FC' ? pr.ef + d.lag : d.type === 'CC' ? pr.es + d.lag : d.type === 'FF' ? pr.ef + d.lag - st.duration : pr.es + d.lag - st.duration
        expect(st.es).toBeGreaterThanOrEqual(req)
        lower = Math.max(lower, req)
      }
      expect(st.es).toBe(lower)
      expect(st.ef).toBe(st.es + st.duration)
      expect(st.totalFloat).toBeGreaterThanOrEqual(0)
      expect(st.freeFloat).toBeLessThanOrEqual(st.totalFloat)
    }

    // 3: holgura total exacta (retrasando la tarea con restricción "no comenzar antes de")
    for (const t of p.tasks) {
      const st = byUid.get(t.uid)!
      const delayed = (k: number): Project => ({
        ...p,
        tasks: p.tasks.map((x) => (x.uid === t.uid ? { ...x, start: s.calendar.isoOfOrdinal(st.es + k), constraint: 'snet' as const } : x))
      })
      expect(finishOrd(delayed(st.totalFloat)), `T${t.uid} retrasada su holgura ${st.totalFloat}`).toBe(finish)
      expect(finishOrd(delayed(st.totalFloat + 1)), `T${t.uid} retrasada holgura+1`).toBe(finish + 1)
      // 4: holgura libre no mueve a ninguna otra tarea
      if (st.freeFloat > 0) {
        const s2 = computeSchedule(delayed(st.freeFloat))
        for (const o of p.tasks) if (o.uid !== t.uid) expect(s2.byUid.get(o.uid)!.es).toBe(byUid.get(o.uid)!.es)
      }
    }

    // 5: caminos críticos
    expect(s.criticalPaths.length).toBeGreaterThan(0)
    for (const path of s.criticalPaths) {
      for (const uid of path) expect(byUid.get(uid)!.critical).toBe(true)
      for (let i = 1; i < path.length; i++) expect(s.criticalLinks.has(linkKey(path[i - 1], path[i]))).toBe(true)
    }
  })
})
