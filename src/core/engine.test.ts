import { describe, expect, it } from 'vitest'
import { WorkCalendar } from './calendar'
import { dayToISO, isoToDay, parseDateES } from './dates'
import { computeWBS, indent, outdent, removeTasks, visibleIndices } from './hierarchy'
import { easterSunday, spanishNationalHolidays } from './holidays'
import { formatPredecessors, parsePredecessors } from './predecessors'
import { createEmptyProject, newTask, parseProjectFile, serializeProject } from './project'
import { createSampleProject } from './sample'
import { computeSchedule } from './schedule'
import type { Project, Task } from './types'

// 19/10/2026 es lunes
const MON = '2026-10-19'
const LV = { workWeek: [false, true, true, true, true, true, false], holidays: [] }

interface Spec {
  name: string
  d: number
  preds?: string
  level?: number
  start?: string
  snet?: boolean
}

function makeProject(specs: Spec[], opts: Partial<Project['info']> = {}, holidays: string[] = []): Project {
  const p = createEmptyProject(MON)
  p.info = { ...p.info, ...opts }
  p.calendar = { ...LV, holidays: holidays.map((date) => ({ date, name: 'F' })) }
  p.tasks = specs.map((s, i) => ({
    ...newTask(i + 1, s.start ?? MON, s.level ?? 0, s.name),
    duration: s.d,
    constraint: s.snet ? 'snet' : 'asap'
  }))
  specs.forEach((s, i) => {
    if (!s.preds) return
    const r = parsePredecessors(s.preds, p.tasks, i)
    expect(r.errors).toEqual([])
    p.tasks[i].predecessors = r.deps
  })
  return p
}

const byName = (p: Project, r: ReturnType<typeof computeSchedule>, name: string) => {
  const t = p.tasks.find((x) => x.name === name) as Task
  return r.byUid.get(t.uid)!
}

describe('fechas', () => {
  it('interpreta formatos españoles', () => {
    expect(parseDateES('19/10/2026', 2000)).toBe('2026-10-19')
    expect(parseDateES('1/2/26', 2000)).toBe('2026-02-01')
    expect(parseDateES('05.03', 2027)).toBe('2027-03-05')
    expect(parseDateES('31/02/2026', 2026)).toBeNull()
    expect(parseDateES('hola', 2026)).toBeNull()
  })
  it('ida y vuelta ISO ↔ número de día', () => {
    for (const iso of ['1999-12-31', '2026-10-19', '2030-02-28', '1969-07-20']) expect(dayToISO(isoToDay(iso))).toBe(iso)
  })
})

describe('calendario laboral', () => {
  const cal = new WorkCalendar({ ...LV, holidays: [{ date: '2026-10-12', name: 'Fiesta Nacional' }] })
  it('salta fines de semana', () => {
    expect(dayToISO(cal.finishForDuration(isoToDay(MON), 5))).toBe('2026-10-23')
    expect(dayToISO(cal.finishForDuration(isoToDay(MON), 6))).toBe('2026-10-26')
    expect(dayToISO(cal.nextWorkday(isoToDay('2026-10-24')))).toBe('2026-10-26')
    expect(dayToISO(cal.prevWorkday(isoToDay('2026-10-25')))).toBe('2026-10-23')
  })
  it('salta festivos', () => {
    // viernes 9 + lunes 12 festivo → 2 días acaban el martes 13
    expect(dayToISO(cal.finishForDuration(isoToDay('2026-10-09'), 2))).toBe('2026-10-13')
    expect(cal.isWorkday(isoToDay('2026-10-12'))).toBe(false)
    expect(cal.workdaysInclusive(isoToDay('2026-10-05'), isoToDay('2026-10-16'))).toBe(9)
  })
  it('ordinal y dayOfOrdinal son inversos en días laborables', () => {
    for (let d = isoToDay('2025-01-01'); d < isoToDay('2027-01-01'); d++) {
      if (cal.isWorkday(d)) expect(cal.dayOfOrdinal(cal.ordinal(d))).toBe(d)
    }
  })
  it('semana laboral de 6 días', () => {
    const c6 = new WorkCalendar({ workWeek: [false, true, true, true, true, true, true], holidays: [] })
    expect(dayToISO(c6.finishForDuration(isoToDay(MON), 6))).toBe('2026-10-24')
  })
})

describe('festivos nacionales', () => {
  it('calcula la Pascua', () => {
    expect(easterSunday(2024)).toBe('2024-03-31')
    expect(easterSunday(2025)).toBe('2025-04-20')
    expect(easterSunday(2026)).toBe('2026-04-05')
  })
  it('incluye Viernes Santo', () => {
    expect(spanishNationalHolidays(2026).map((h) => h.date)).toContain('2026-04-03')
  })
})

describe('predecesoras', () => {
  const tasks = [1, 2, 3, 4].map((i) => newTask(i * 10, MON, 0, `T${i}`))
  it('interpreta la notación', () => {
    const r = parsePredecessors('1; 2CC+2d, 3FF-1, 4cf', tasks, 5)
    expect(r.errors).toEqual([])
    expect(r.deps).toEqual([
      { predUid: 10, type: 'FC', lag: 0 },
      { predUid: 20, type: 'CC', lag: 2 },
      { predUid: 30, type: 'FF', lag: -1 },
      { predUid: 40, type: 'CF', lag: 0 }
    ])
    const rows = new Map(tasks.map((t, i) => [t.uid, i]))
    expect(formatPredecessors(r.deps, rows)).toBe('1;2CC+2d;3FF-1d;4CF')
  })
  it('acepta siglas inglesas', () => {
    expect(parsePredecessors('2FS+1', tasks, 0).deps[0]).toEqual({ predUid: 20, type: 'FC', lag: 1 })
  })
  it('detecta errores', () => {
    expect(parsePredecessors('9', tasks, 0).errors.length).toBe(1)
    expect(parsePredecessors('1', tasks, 0).errors.length).toBe(1)
    expect(parsePredecessors('2XX', tasks, 0).errors.length).toBe(1)
    expect(parsePredecessors('2;2', tasks, 0).errors.length).toBe(1)
  })
})

describe('CPM', () => {
  it('cadena lineal', () => {
    const p = makeProject([
      { name: 'A', d: 3 },
      { name: 'B', d: 2, preds: '1' },
      { name: 'C', d: 4, preds: '2' }
    ])
    const r = computeSchedule(p)
    expect(byName(p, r, 'A')).toMatchObject({ start: '2026-10-19', finish: '2026-10-21', totalFloat: 0, critical: true })
    expect(byName(p, r, 'B')).toMatchObject({ start: '2026-10-22', finish: '2026-10-23' })
    expect(byName(p, r, 'C')).toMatchObject({ start: '2026-10-26', finish: '2026-10-29' })
    expect(r.projectDuration).toBe(9)
    expect(r.projectFinish).toBe('2026-10-29')
    expect(r.criticalPaths).toEqual([[1, 2, 3]])
  })

  it('ramas paralelas: holgura total y libre', () => {
    const p = makeProject([
      { name: 'Inicio', d: 0 },
      { name: 'A', d: 5, preds: '1' },
      { name: 'B', d: 2, preds: '1' },
      { name: 'C', d: 1, preds: '3' },
      { name: 'Fin', d: 0, preds: '2;4' }
    ])
    const r = computeSchedule(p)
    expect(byName(p, r, 'A').critical).toBe(true)
    expect(byName(p, r, 'B')).toMatchObject({ totalFloat: 2, freeFloat: 0, critical: false })
    expect(byName(p, r, 'C')).toMatchObject({ totalFloat: 2, freeFloat: 2 })
    const fin = byName(p, r, 'Fin')
    expect(fin.isMilestone).toBe(true)
    expect(fin.start).toBe('2026-10-23') // fin de jornada del viernes en que acaba A
    expect(byName(p, r, 'Inicio').start).toBe('2026-10-19')
    expect(r.criticalPaths).toEqual([[1, 2, 5]])
    expect(r.criticalLinks.has('1>2')).toBe(true)
    expect(r.criticalLinks.has('1>3')).toBe(false)
  })

  it('casi críticas según umbral', () => {
    const p = makeProject([
      { name: 'A', d: 10 },
      { name: 'B', d: 7 },
      { name: 'C', d: 2 },
      { name: 'Fin', d: 0, preds: '1;2;3' }
    ])
    p.nearCriticalThreshold = 5
    const r = computeSchedule(p)
    expect(byName(p, r, 'B')).toMatchObject({ totalFloat: 3, nearCritical: true })
    expect(byName(p, r, 'C')).toMatchObject({ totalFloat: 8, nearCritical: false })
  })

  it('vínculo CC con desfase positivo', () => {
    const p = makeProject([
      { name: 'A', d: 5 },
      { name: 'B', d: 3, preds: '1CC+2d' }
    ])
    const r = computeSchedule(p)
    expect(byName(p, r, 'B')).toMatchObject({ start: '2026-10-21', finish: '2026-10-23' })
  })

  it('vínculo FF con desfase negativo', () => {
    const p = makeProject([
      { name: 'A', d: 5 },
      { name: 'B', d: 3, preds: '1FF-1d' }
    ])
    const r = computeSchedule(p)
    expect(byName(p, r, 'B')).toMatchObject({ start: '2026-10-20', finish: '2026-10-22' })
    // B puede acabar el viernes sin retrasar nada → holgura 1
    expect(byName(p, r, 'B').totalFloat).toBe(1)
  })

  it('vínculo FF positivo conduce el fin del proyecto', () => {
    const p = makeProject([
      { name: 'A', d: 5 },
      { name: 'B', d: 2, preds: '1FF+2d' }
    ])
    const r = computeSchedule(p)
    expect(byName(p, r, 'B')).toMatchObject({ start: '2026-10-26', finish: '2026-10-27', critical: true })
    expect(byName(p, r, 'A').critical).toBe(true)
  })

  it('vínculo CF', () => {
    const p = makeProject([
      { name: 'A', d: 2 },
      { name: 'B', d: 3, preds: '1CF+5d' }
    ])
    const r = computeSchedule(p)
    // B debe terminar no antes del inicio de A + 5 → fin el viernes (23), inicio el miércoles (21)
    expect(byName(p, r, 'B')).toMatchObject({ start: '2026-10-21', finish: '2026-10-23' })
  })

  it('vínculo FC con solape (desfase negativo)', () => {
    const p = makeProject([
      { name: 'A', d: 5 },
      { name: 'B', d: 2, preds: '1FC-2d' }
    ])
    const r = computeSchedule(p)
    expect(byName(p, r, 'B')).toMatchObject({ start: '2026-10-22', finish: '2026-10-23' })
  })

  it('desfase en días laborables saltando festivo', () => {
    const p = makeProject(
      [
        { name: 'A', d: 1 },
        { name: 'B', d: 1, preds: '1FC+1d' }
      ],
      {},
      ['2026-10-20']
    )
    const r = computeSchedule(p)
    expect(byName(p, r, 'B').start).toBe('2026-10-22')
  })

  it('duraciones que cruzan fin de semana y festivo', () => {
    const p = makeProject([{ name: 'A', d: 6, start: '2026-10-08' }], {}, ['2026-10-12'])
    const r = computeSchedule(p)
    // jue 8, vie 9, (lun 12 festivo) mar 13, mié 14, jue 15, vie 16
    expect(byName(p, r, 'A').finish).toBe('2026-10-16')
  })

  it('detecta dependencias circulares', () => {
    const p = makeProject([
      { name: 'A', d: 2, preds: '3' },
      { name: 'B', d: 2, preds: '1' },
      { name: 'C', d: 2, preds: '2' },
      { name: 'D', d: 1 }
    ])
    const r = computeSchedule(p)
    expect(r.hasCycle).toBe(true)
    const cyc = r.issues.find((i) => i.code === 'cycle')!
    expect(new Set(cyc.uids)).toEqual(new Set([1, 2, 3]))
    expect(r.criticalPaths).toEqual([])
  })

  it('fecha contractual incumplida → holgura negativa', () => {
    const p = makeProject(
      [
        { name: 'A', d: 3 },
        { name: 'B', d: 3, preds: '1' }
      ],
      { deadline: '2026-10-23' }
    )
    const r = computeSchedule(p)
    expect(byName(p, r, 'B').totalFloat).toBe(-1)
    expect(byName(p, r, 'A').critical).toBe(true)
    expect(r.issues.some((i) => i.code === 'negative-float')).toBe(true)
    expect(r.issues.some((i) => i.code === 'deadline')).toBe(true)
  })

  it('restricción "no comenzar antes de" en tarea con predecesoras', () => {
    const p = makeProject([
      { name: 'A', d: 2 },
      { name: 'B', d: 2, preds: '1', start: '2026-10-26', snet: true }
    ])
    const r = computeSchedule(p)
    expect(byName(p, r, 'B')).toMatchObject({ start: '2026-10-26', constraintDelays: true })
    expect(byName(p, r, 'A').totalFloat).toBe(3)
    expect(r.issues.some((i) => i.code === 'constraint')).toBe(true)
  })

  it('avisa si no hay vínculos', () => {
    const p = makeProject([
      { name: 'A', d: 2 },
      { name: 'B', d: 2 }
    ])
    expect(computeSchedule(p).issues.some((i) => i.code === 'no-links')).toBe(true)
  })

  it('resúmenes agregan fechas de sus hijas', () => {
    const p = makeProject([
      { name: 'Cap', d: 1 },
      { name: 'A', d: 3, level: 1 },
      { name: 'B', d: 2, level: 1, preds: '2' }
    ])
    const r = computeSchedule(p)
    expect(byName(p, r, 'Cap')).toMatchObject({ isSummary: true, start: '2026-10-19', finish: '2026-10-23', duration: 5, critical: true })
  })

  it('ignora vínculos a capítulos con aviso', () => {
    const p = makeProject([
      { name: 'Cap', d: 1 },
      { name: 'A', d: 3, level: 1 },
      { name: 'B', d: 2, preds: '1' }
    ])
    const r = computeSchedule(p)
    expect(r.issues.some((i) => i.code === 'summary-link')).toBe(true)
  })

  it('rendimiento: 500 tareas en < 100 ms', () => {
    const specs: Spec[] = []
    for (let i = 0; i < 500; i++) {
      const preds = i === 0 ? undefined : i % 7 === 0 ? `${i};${Math.max(1, i - 5)}CC+1d` : String(i)
      specs.push({ name: `T${i}`, d: 1 + (i % 5), preds })
    }
    const p = makeProject(specs, {}, ['2026-12-08', '2026-12-25', '2027-01-01'])
    computeSchedule(p) // calentamiento
    const t0 = performance.now()
    const r = computeSchedule(p)
    const ms = performance.now() - t0
    expect(r.hasCycle).toBe(false)
    expect(ms).toBeLessThan(100)
  })

  it('el proyecto de ejemplo se calcula sin errores', () => {
    const p = createSampleProject(MON)
    const r = computeSchedule(p)
    expect(r.hasCycle).toBe(false)
    expect(r.criticalPaths.length).toBeGreaterThan(0)
    expect(r.issues.filter((i) => i.level === 'error')).toEqual([])
  })
})

describe('jerarquía', () => {
  const base = ['A', 'B', 'C', 'D'].map((n, i) => newTask(i + 1, MON, 0, n))
  it('sangrar y anular sangría', () => {
    let t = indent(base, [1, 2])
    expect(t.map((x) => x.level)).toEqual([0, 1, 1, 0])
    expect(computeWBS(t)).toEqual(['1', '1.1', '1.2', '2'])
    t = outdent(t, [1])
    expect(t.map((x) => x.level)).toEqual([0, 0, 1, 0])
  })
  it('plegar oculta descendientes', () => {
    const t = indent(base, [1, 2])
    t[0] = { ...t[0], collapsed: true }
    expect(visibleIndices(t)).toEqual([0, 3])
  })
  it('borrar limpia vínculos', () => {
    const t = base.map((x) => ({ ...x }))
    t[2].predecessors = [{ predUid: 2, type: 'FC', lag: 0 }]
    const out = removeTasks(t, [1])
    expect(out.length).toBe(3)
    expect(out[1].predecessors).toEqual([])
  })
})

describe('archivo', () => {
  it('guarda y carga sin pérdida', () => {
    const p = createSampleProject(MON)
    const back = parseProjectFile(serializeProject(p))
    expect(back).toEqual(JSON.parse(serializeProject(p)))
  })
  it('rechaza archivos no válidos', () => {
    expect(() => parseProjectFile('{}')).toThrow()
    expect(() => parseProjectFile('no json')).toThrow()
    expect(() => parseProjectFile(JSON.stringify({ schemaVersion: 99 }))).toThrow()
  })
})
