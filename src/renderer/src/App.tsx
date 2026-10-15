import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatES, isoToDay, todayISO } from '@core/dates'
import {
  addLink,
  applyField,
  clearConstraints,
  indexAfter,
  insertTask,
  linkChain,
  moveTask,
  pasteTasks,
  resizeTask,
  setPredecessors,
  unlink,
  type FieldKey
} from '@core/edit'
import { indent, moveBlock, outdent, removeTasks, subtreeEnd, summaryFlags, visibleIndices } from '@core/hierarchy'
import { createEmptyProject, parseProjectFile, serializeProject } from '@core/project'
import { createSampleProject } from '@core/sample'
import { computeSchedule, rowOfUidMap } from '@core/schedule'
import type { Project, Task } from '@core/types'
import { CriticalPanel } from './components/CriticalPanel'
import { CalendarDialog, ExportDialog, HelpDialog, ProjectInfoDialog, TaskDialog, TradesDialog, type ExportOptions } from './components/Dialogs'
import { GanttChart, type GanttHandle } from './components/GanttChart'
import { Icon } from './components/Icon'
import { COLUMNS, ROW_H, TaskTable, type ActiveCell } from './components/TaskTable'
import { buildPdfHtml, buildPng } from './export'
import { api, isDesktop } from './platform'
import { useDocument } from './store'
import { ZOOMS, ZOOM_DAY_WIDTH, ZOOM_LABEL, type ZoomLevel } from './timescale'

type DialogState =
  | null
  | { kind: 'info' | 'calendar' | 'trades' | 'help' }
  | { kind: 'export'; format: 'pdf' | 'png' }
  | { kind: 'task'; uid: number }

interface Toast {
  id: number
  text: string
  level: 'error' | 'info' | 'ok'
}

const LS = {
  get<T>(k: string, def: T): T {
    try {
      const v = localStorage.getItem(`gantt-obra:${k}`)
      return v === null ? def : (JSON.parse(v) as T)
    } catch {
      return def
    }
  },
  set(k: string, v: unknown): void {
    try {
      localStorage.setItem(`gantt-obra:${k}`, JSON.stringify(v))
    } catch {
      /* sin almacenamiento */
    }
  }
}

export default function App() {
  const doc = useDocument(createEmptyProject())
  const { project, commit } = doc
  const [welcome, setWelcome] = useState(true)
  const [recent, setRecent] = useState<string[]>([])
  const schedule = useMemo(() => computeSchedule(project), [project])
  const summary = useMemo(() => summaryFlags(project.tasks), [project.tasks])
  const rows = useMemo(() => visibleIndices(project.tasks), [project.tasks])
  const rowOfUid = useMemo(() => rowOfUidMap(project.tasks), [project.tasks])
  const posOfUid = useMemo(() => new Map(rows.map((idx, pos) => [project.tasks[idx].uid, pos])), [rows, project.tasks])

  const [active, setActive] = useState<ActiveCell>({ row: 0, col: 2 })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const anchorPos = useRef(0)
  const [criticalMode, setCriticalMode] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [zoom, setZoom] = useState<ZoomLevel>(LS.get('zoom', 'day'))
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(600)
  const [theme, setTheme] = useState<'light' | 'dark'>(LS.get('theme', 'light'))
  const [dialog, setDialog] = useState<DialogState>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [tableWidth, setTableWidth] = useState<number>(LS.get('tableWidth', 640))
  const [colWidths, setColWidths] = useState<Record<string, number>>(LS.get('colWidths', {}))
  const [focusToken, setFocusToken] = useState(0)
  const [exportOpts, setExportOpts] = useState<Omit<ExportOptions, 'format'>>({ pageSize: 'A3', critical: true, collapsed: false })
  const clipboard = useRef<{ text: string; tasks: Task[] } | null>(null)
  const ganttRef = useRef<GanttHandle>(null)
  const pendingScroll = useRef<number | null>(null)

  const dayWidth = ZOOM_DAY_WIDTH[zoom]

  // ---------- Utilidades ----------
  const toast = useCallback((text: string, level: Toast['level'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-3), { id, text, level }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), level === 'error' ? 6000 : 3500)
  }, [])

  const refocus = (): void => setFocusToken((n) => n + 1)

  const selectedIndices = (): number[] => {
    const set = selected.size ? selected : new Set(rows[active.row] !== undefined ? [project.tasks[rows[active.row]].uid] : [])
    return [...set].map((u) => rowOfUid.get(u)).filter((i): i is number => i !== undefined).sort((a, b) => a - b)
  }

  const focusTask = (uid: number, p: Project = project): void => {
    // Despliega capítulos que oculten la tarea
    let tasks = p.tasks
    const idx = tasks.findIndex((t) => t.uid === uid)
    if (idx < 0) return
    let changed = false
    for (let i = idx - 1, lvl = tasks[idx].level; i >= 0 && lvl > 0; i--) {
      if (tasks[i].level < lvl) {
        lvl = tasks[i].level
        if (tasks[i].collapsed) {
          tasks = tasks.map((t, k) => (k === i ? { ...t, collapsed: false } : t))
          changed = true
        }
      }
    }
    if (changed) commit({ ...p, tasks })
    const pos = visibleIndices(tasks).indexOf(idx)
    setActive((a) => ({ row: pos, col: a.col }))
    setSelected(new Set([uid]))
    anchorPos.current = pos
    ensureVisible(pos)
    const s = schedule.byUid.get(uid)
    if (s) ganttRef.current?.scrollToDay(s.isMilestone ? s.milestoneAt : s.startDay, 'center')
  }

  const ensureVisible = (pos: number): void => {
    setScrollTop((st) => {
      if (pos * ROW_H < st) return pos * ROW_H
      if ((pos + 1) * ROW_H > st + viewportH - 8) return (pos + 1) * ROW_H - viewportH + 8
      return st
    })
  }

  // ---------- Archivo ----------
  const confirmDiscard = (): boolean => !doc.dirty || window.confirm('Hay cambios sin guardar. ¿Descartarlos?')

  const loadProject = (p: Project, path: string | null, dirty = false): void => {
    doc.load(p, path, dirty)
    setWelcome(false)
    setActive({ row: 0, col: 2 })
    setSelected(new Set())
    setScrollTop(0)
    const first = computeSchedule(p)
    pendingScroll.current = isoToDay(first.projectStart) - 2
    refocus()
  }

  const openContent = (content: string, path: string | null): void => {
    try {
      loadProject(parseProjectFile(content), path)
      toast(`Abierto: ${path ?? ''}`, 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const save = async (as = false): Promise<boolean> => {
    try {
      const path = await api.saveFile(as ? null : doc.filePath, serializeProject(project), project.info.name)
      if (!path) return false
      doc.markSaved(path)
      toast('Proyecto guardado', 'ok')
      api.getRecent().then(setRecent)
      return true
    } catch (e) {
      toast(`Error al guardar: ${(e as Error).message}`, 'error')
      return false
    }
  }

  const doExport = async (o: ExportOptions): Promise<void> => {
    setDialog(null)
    setExportOpts({ pageSize: o.pageSize, critical: o.critical, collapsed: o.collapsed })
    const input = { project, schedule, critical: o.critical, respectCollapsed: o.collapsed }
    try {
      const name = `${project.info.name || 'planificacion'} - Gantt`
      const r = o.format === 'pdf' ? await api.exportPDF(buildPdfHtml(input, o.pageSize), o.pageSize, name) : await api.exportPNG(await buildPng(input), name)
      if (r) toast(`Exportado: ${r}`, 'ok')
    } catch (e) {
      toast(`Error al exportar: ${(e as Error).message}`, 'error')
    }
  }

  // ---------- Edición ----------
  const tryCommit = (r: { project: Project } | { error: string }): boolean => {
    if ('error' in r) {
      toast(r.error, 'error')
      return false
    }
    commit(r.project)
    return true
  }

  const onCellCommit = (rowPos: number, field: FieldKey, text: string): boolean => {
    let p = project
    let uid: number
    if (rowPos >= rows.length) {
      const last = p.tasks[p.tasks.length - 1]
      const ins = insertTask(p, p.tasks.length, { level: last?.level ?? 0, start: p.info.start })
      p = ins.project
      uid = ins.uid
    } else {
      uid = project.tasks[rows[rowPos]].uid
    }
    const r = applyField(p, p === project ? schedule : computeSchedule(p), uid, field, text)
    if ('error' in r) {
      toast(r.error, 'error')
      return false
    }
    commit(r.project)
    return true
  }

  const onCellClear = (rowPos: number, field: FieldKey): void => {
    const t = project.tasks[rows[rowPos]]
    if (!t) return
    if (field === 'preds') tryCommit(setPredecessors(project, schedule, t.uid, []))
    else tryCommit(applyField(project, schedule, t.uid, field, ''))
  }

  const onActivate = (cell: ActiveCell, mods: { shift: boolean; ctrl: boolean; rowHeader?: boolean }): void => {
    setActive(cell)
    ensureVisible(cell.row)
    const t = project.tasks[rows[cell.row]]
    if (!t) {
      setSelected(new Set())
      return
    }
    if (mods.shift) {
      const a = Math.min(anchorPos.current, cell.row)
      const b = Math.max(anchorPos.current, cell.row)
      const s = new Set<number>()
      for (let i = a; i <= b && i < rows.length; i++) s.add(project.tasks[rows[i]].uid)
      setSelected(s)
    } else if (mods.ctrl) {
      const s = new Set(selected)
      if (s.has(t.uid)) s.delete(t.uid)
      else s.add(t.uid)
      setSelected(s)
      anchorPos.current = cell.row
    } else {
      setSelected(new Set([t.uid]))
      anchorPos.current = cell.row
    }
  }

  const insertAt = (index: number, opts: Parameters<typeof insertTask>[2] = {}): void => {
    const ref = project.tasks[index] ?? project.tasks[index - 1]
    const start = ref ? schedule.byUid.get(ref.uid)?.start ?? project.info.start : project.info.start
    const r = insertTask(project, index, { start, trade: ref && !summary[rowOfUid.get(ref.uid) ?? -1] ? ref.trade : undefined, ...opts })
    commit(r.project)
    const pos = visibleIndices(r.project.tasks).indexOf(index)
    setActive({ row: pos, col: 2 })
    setSelected(new Set([r.uid]))
    anchorPos.current = pos
    ensureVisible(pos)
    refocus()
  }

  const addBelow = (milestone = false): void => {
    const idx = rows[active.row]
    if (idx === undefined) return insertAt(project.tasks.length, { milestone, level: project.tasks[project.tasks.length - 1]?.level ?? 0, name: milestone ? 'Hito' : '' })
    const t = project.tasks[idx]
    const isSum = summary[idx] && !t.collapsed
    insertAt(indexAfter(project, idx), { level: isSum ? t.level + 1 : t.level, milestone, name: milestone ? 'Hito' : '' })
  }

  const deleteSelected = (): void => {
    const idx = selectedIndices()
    if (!idx.length) return
    const n = idx.reduce((acc, i) => acc + (subtreeEnd(project.tasks, i) - i), 0)
    commit({ ...project, tasks: removeTasks(project.tasks, idx) })
    setSelected(new Set())
    toast(`${n} ${n === 1 ? 'tarea eliminada' : 'tareas eliminadas'} (Ctrl+Z para deshacer)`)
    refocus()
  }

  const copySelection = (e: ClipboardEvent): void => {
    const idx = selectedIndices()
    if (!idx.length) return
    const set = new Set<number>()
    for (const i of idx) for (let j = i; j < subtreeEnd(project.tasks, i); j++) set.add(j)
    const tasks = [...set].sort((a, b) => a - b).map((i) => project.tasks[i])
    const text = tasks
      .map((t) => {
        const s = schedule.byUid.get(t.uid)
        return [t.name, s?.duration ?? t.duration, formatES(s?.start), formatES(s?.finish), project.trades.find((x) => x.id === t.trade)?.name ?? '', t.responsible, t.progress].join('\t')
      })
      .join('\n')
    e.clipboardData?.setData('text/plain', text)
    e.preventDefault()
    clipboard.current = { text, tasks }
    toast(`${tasks.length} tareas copiadas`)
  }

  const pasteText = (text: string): void => {
    const at = rows[active.row] !== undefined ? indexAfter(project, rows[active.row]) : project.tasks.length
    if (clipboard.current && clipboard.current.text === text.replace(/\r/g, '')) {
      const r = pasteTasks(project, at, clipboard.current.tasks)
      commit(r.project)
      setSelected(new Set(r.uids))
      toast(`${r.uids.length} tareas pegadas`, 'ok')
      return
    }
    // Pegado desde Excel: celdas a partir de la celda activa
    const lines = text.replace(/\r/g, '').split('\n')
    if (lines[lines.length - 1] === '') lines.pop()
    let p = project
    let errors = 0
    let created = 0
    let visRows = rows
    lines.forEach((line, li) => {
      const cells = line.split('\t')
      const pos = active.row + li
      let uid: number
      if (pos >= visRows.length) {
        const r = insertTask(p, p.tasks.length, { level: p.tasks[p.tasks.length - 1]?.level ?? 0, start: p.info.start })
        p = r.project
        uid = r.uid
        visRows = visibleIndices(p.tasks)
        created++
      } else uid = p.tasks[visRows[pos]].uid
      cells.forEach((val, ci) => {
        const col = COLUMNS[active.col + ci]
        if (!col || !col.editable || !val.trim()) return
        const r = applyField(p, computeSchedule(p), uid, col.key as FieldKey, val)
        if ('error' in r) errors++
        else p = r.project
      })
    })
    commit(p)
    toast(`Pegado: ${lines.length} filas${created ? ` (${created} nuevas)` : ''}${errors ? ` · ${errors} celdas no válidas ignoradas` : ''}`, errors ? 'error' : 'ok')
  }

  const zoomBy = (dir: 1 | -1): void => {
    setZoom((z) => {
      const i = ZOOMS.indexOf(z) - dir
      return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i))]
    })
  }

  const fitProject = (): void => {
    const width = (ganttRef.current?.viewportWidth() ?? 900) - 120
    const span = Math.max(7, isoToDay(schedule.projectFinish) - isoToDay(schedule.projectStart) + 1)
    const z = ZOOMS.find((k) => span * ZOOM_DAY_WIDTH[k] <= width) ?? 'quarter'
    setZoom(z)
    pendingScroll.current = isoToDay(schedule.projectStart) - 2
  }

  // ---------- Comandos ----------
  const run = (cmd: string, arg?: string): void => {
    switch (cmd) {
      case 'new':
        if (confirmDiscard()) loadProject(createEmptyProject(), null)
        return
      case 'sample':
        if (confirmDiscard()) loadProject(createSampleProject(), null, true)
        return
      case 'open':
        if (!confirmDiscard()) return
        api.openFile().then((r) => r && openContent(r.content, r.path))
        return
      case 'open-path':
        if (!arg || !confirmDiscard()) return
        api.openPath(arg).then((r) => ('error' in r ? toast(r.error, 'error') : openContent(r.content, r.path)))
        return
      case 'save':
        void save(false)
        return
      case 'save-as':
        void save(true)
        return
      case 'save-and-close':
        save(false).then((ok) => ok && api.closeNow())
        return
      case 'export-pdf':
        setDialog({ kind: 'export', format: 'pdf' })
        return
      case 'export-png':
        setDialog({ kind: 'export', format: 'png' })
        return
      case 'undo':
        doc.undo()
        return
      case 'redo':
        doc.redo()
        return
      case 'insert': {
        const idx = rows[active.row]
        insertAt(idx ?? project.tasks.length, { level: idx !== undefined ? project.tasks[idx].level : undefined })
        return
      }
      case 'add':
        addBelow(false)
        return
      case 'insert-milestone':
        addBelow(true)
        return
      case 'delete':
        deleteSelected()
        return
      case 'indent':
      case 'outdent': {
        const idx = selectedIndices()
        if (idx.length) commit({ ...project, tasks: (cmd === 'indent' ? indent : outdent)(project.tasks, idx) })
        return
      }
      case 'move-up':
      case 'move-down': {
        const idx = rows[active.row]
        if (idx === undefined) return
        const r = moveBlock(project.tasks, idx, cmd === 'move-up' ? -1 : 1)
        if (r.tasks !== project.tasks) {
          commit({ ...project, tasks: r.tasks })
          const pos = visibleIndices(r.tasks).indexOf(r.newIndex)
          setActive((a) => ({ ...a, row: pos }))
          ensureVisible(pos)
        }
        return
      }
      case 'link': {
        const uids = selectedIndices().map((i) => project.tasks[i].uid)
        if (tryCommit(linkChain(project, schedule, uids))) toast('Tareas vinculadas (Fin-Comienzo)', 'ok')
        return
      }
      case 'unlink': {
        const uids = selectedIndices().map((i) => project.tasks[i].uid)
        if (uids.length) commit(unlink(project, schedule, uids))
        return
      }
      case 'clear-constraint': {
        const uids = selectedIndices().map((i) => project.tasks[i].uid)
        commit(clearConstraints(project, uids))
        return
      }
      case 'critical':
        if (criticalMode && panelOpen) {
          setCriticalMode(false)
          setPanelOpen(false)
        } else {
          setCriticalMode(true)
          setPanelOpen(true)
        }
        return
      case 'zoom':
        if (arg && ZOOMS.includes(arg as ZoomLevel)) setZoom(arg as ZoomLevel)
        return
      case 'today':
        ganttRef.current?.scrollToDay(isoToDay(todayISO()), 'center')
        return
      case 'fit':
        fitProject()
        return
      case 'theme':
        setTheme((t) => (t === 'light' ? 'dark' : 'light'))
        return
      case 'help':
        setDialog({ kind: 'help' })
        return
      case 'project-info':
      case 'calendar':
      case 'trades':
        setDialog({ kind: cmd === 'project-info' ? 'info' : cmd })
        return
    }
  }
  const runRef = useRef(run)
  runRef.current = run

  // ---------- Efectos ----------
  useEffect(() => api.onMenu((cmd, arg) => runRef.current(cmd, arg)), [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    LS.set('theme', theme)
  }, [theme])
  useEffect(() => LS.set('zoom', zoom), [zoom])
  useEffect(() => LS.set('tableWidth', tableWidth), [tableWidth])
  useEffect(() => LS.set('colWidths', colWidths), [colWidths])

  useEffect(() => {
    const title = `${doc.dirty ? '● ' : ''}${project.info.name || 'Sin título'} — Gantt Obra`
    api.setDirty(doc.dirty, title)
  }, [doc.dirty, project.info.name])

  // Desplazamiento horizontal pendiente (tras cargar o ajustar)
  useEffect(() => {
    if (pendingScroll.current !== null && !welcome) {
      const d = pendingScroll.current
      pendingScroll.current = null
      requestAnimationFrame(() => ganttRef.current?.scrollToDay(d))
    }
  })

  // Autoguardado de recuperación cada 30 s
  const autosaveRef = useRef({ project, dirty: doc.dirty, path: doc.filePath })
  autosaveRef.current = { project, dirty: doc.dirty, path: doc.filePath }
  useEffect(() => {
    const id = setInterval(() => {
      const a = autosaveRef.current
      if (a.dirty) api.writeRecovery(JSON.stringify({ path: a.path, project: a.project }))
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  // Arranque: archivo de lanzamiento o recuperación
  useEffect(() => {
    ;(async () => {
      setRecent(await api.getRecent())
      const launch = await api.getLaunchFile()
      if (launch && 'content' in launch) return openContent(launch.content, launch.path)
      const rec = await api.readRecovery()
      if (rec) {
        const when = new Date(rec.mtime).toLocaleString('es-ES')
        if (window.confirm(`Se encontró una copia de recuperación del ${when} (la aplicación se cerró sin guardar). ¿Restaurarla?`)) {
          try {
            const { path, project: p } = JSON.parse(rec.content)
            loadProject(parseProjectFile(JSON.stringify(p)), path ?? null, true)
            toast('Copia de recuperación restaurada. Guarda el proyecto para conservarla.', 'ok')
          } catch {
            toast('La copia de recuperación está dañada.', 'error')
          }
        } else api.clearRecovery()
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Atajos globales
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tgt = e.target as HTMLElement
      if (dialog || welcome) return
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT')) return
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      const go = (cmd: string, arg?: string): void => {
        e.preventDefault()
        runRef.current(cmd, arg)
      }
      if (ctrl && !e.shiftKey && k === 'z') return go('undo')
      if (ctrl && (k === 'y' || (e.shiftKey && k === 'z'))) return go('redo')
      if (e.key === 'Insert') return go('insert')
      if (e.altKey && e.shiftKey && e.key === 'ArrowRight') return go('indent')
      if (e.altKey && e.shiftKey && e.key === 'ArrowLeft') return go('outdent')
      if (e.altKey && e.shiftKey && e.key === 'ArrowUp') return go('move-up')
      if (e.altKey && e.shiftKey && e.key === 'ArrowDown') return go('move-down')
      if (ctrl && e.key === 'F2') return go('link')
      if (ctrl && e.shiftKey && e.key === 'F2') return go('unlink')
      if (!isDesktop) {
        if (ctrl && k === 's') return go(e.shiftKey ? 'save-as' : 'save')
        if (ctrl && k === 'o') return go('open')
        if (ctrl && k === 'p') return go('export-pdf')
        if (e.key === 'F9') return go('critical')
        if (e.key === 'F1') return go('help')
      }
    }
    const onCopy = (e: ClipboardEvent): void => {
      const tgt = e.target as HTMLElement
      if (dialog || welcome || tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') return
      copySelection(e)
    }
    const onPaste = (e: ClipboardEvent): void => {
      const tgt = e.target as HTMLElement
      if (dialog || welcome || tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') return
      const text = e.clipboardData?.getData('text/plain')
      if (text) {
        e.preventDefault()
        pasteText(text)
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
    }
  })

  // ---------- Rango temporal ----------
  const [rangeStart, rangeEnd] = useMemo(() => {
    let min = isoToDay(project.info.start)
    let max = isoToDay(schedule.projectFinish)
    for (const s of schedule.list) {
      if (!s) continue
      min = Math.min(min, s.startDay)
      max = Math.max(max, s.finishDay, isoToDay(s.lateFinish))
    }
    if (project.info.deadline) max = Math.max(max, isoToDay(project.info.deadline))
    const today = isoToDay(todayISO())
    if (Math.abs(today - min) < 365 * 2) {
      min = Math.min(min, today)
      max = Math.max(max, today)
    }
    // inicio del mes anterior, para que el rango no "salte" con cada cambio pequeño
    const dt = new Date((min - 20) * 86_400_000)
    const start = Math.round(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1) / 86_400_000)
    return [start, max + 120]
  }, [project.info.start, project.info.deadline, schedule])

  const maxScroll = Math.max(0, (rows.length + 1) * ROW_H + 40 - viewportH)
  const errorCount = schedule.issues.filter((i) => i.level === 'error').length
  const warnCount = schedule.issues.filter((i) => i.level === 'warning').length
  const criticalCount = schedule.list.filter((s) => s && !s.isSummary && s.critical).length

  // ---------- Render ----------
  if (welcome) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          <div className="brand big">
            <GanttLogo /> Gantt Obra
          </div>
          <p className="tagline">Planificación de obra con camino crítico. Rápida de rellenar, rigurosa en el cálculo.</p>
          <div className="welcome-actions">
            <button className="big-btn primary" onClick={() => loadProject(createEmptyProject(), null)}>
              <Icon name="file" size={22} />
              <span>
                <b>Nuevo proyecto</b>
                <small>Empieza con una planificación vacía</small>
              </span>
            </button>
            <button className="big-btn" onClick={() => api.openFile().then((r) => r && openContent(r.content, r.path))}>
              <Icon name="open" size={22} />
              <span>
                <b>Abrir proyecto…</b>
                <small>Archivo .gantt.json</small>
              </span>
            </button>
            <button className="big-btn" onClick={() => loadProject(createSampleProject(), null, true)}>
              <Icon name="critical" size={22} />
              <span>
                <b>Proyecto de ejemplo</b>
                <small>Instalaciones de un edificio de 24 viviendas</small>
              </span>
            </button>
          </div>
          {recent.length > 0 && (
            <div className="recent">
              <h4>Recientes</h4>
              {recent.map((p) => (
                <button key={p} onClick={() => run('open-path', p)} title={p}>
                  {p.split(/[\\/]/).pop()}
                  <small>{p}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <Toasts toasts={toasts} />
      </div>
    )
  }

  const activeTask = project.tasks[rows[active.row]]
  const dialogTask = dialog?.kind === 'task' ? project.tasks.find((t) => t.uid === dialog.uid) : undefined

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand" onClick={() => setDialog({ kind: 'info' })} title="Datos de la obra">
          <GanttLogo />
          <div className="brand-text">
            <span className="proj-name">
              {project.info.name || 'Sin título'}
              {doc.dirty && <span className="dirty-dot" title="Cambios sin guardar" />}
            </span>
            <span className="proj-sub">{doc.filePath ? doc.filePath.split(/[\\/]/).pop() : 'Sin guardar'}</span>
          </div>
        </div>
        <div className="tb-group">
          <TB icon="file" title="Nuevo (Ctrl+N)" onClick={() => run('new')} />
          <TB icon="open" title="Abrir (Ctrl+O)" onClick={() => run('open')} />
          <TB icon="save" title="Guardar (Ctrl+S)" onClick={() => run('save')} />
        </div>
        <div className="tb-group">
          <TB icon="undo" title="Deshacer (Ctrl+Z)" onClick={() => run('undo')} disabled={!doc.canUndo} />
          <TB icon="redo" title="Rehacer (Ctrl+Y)" onClick={() => run('redo')} disabled={!doc.canRedo} />
        </div>
        <div className="tb-group">
          <TB icon="plus" label="Tarea" title="Nueva tarea debajo (Insert inserta encima)" onClick={() => run('add')} />
          <TB icon="diamond" label="Hito" title="Nuevo hito debajo" onClick={() => run('insert-milestone')} />
          <TB icon="trash" title="Eliminar tareas seleccionadas" onClick={() => run('delete')} disabled={!activeTask} />
          <TB icon="outdent" title="Reducir sangría (Alt+Mayús+←)" onClick={() => run('outdent')} />
          <TB icon="indent" title="Aumentar sangría: crear capítulo (Alt+Mayús+→)" onClick={() => run('indent')} />
        </div>
        <div className="tb-group">
          <TB icon="link" title="Vincular seleccionadas en cadena FC (Ctrl+F2)" onClick={() => run('link')} disabled={selected.size < 2} />
          <TB icon="unlink" title="Desvincular seleccionadas" onClick={() => run('unlink')} disabled={!activeTask} />
          <TB icon="pin" title="Quitar restricción 'No comenzar antes de'" onClick={() => run('clear-constraint')} disabled={!activeTask || activeTask.constraint !== 'snet'} />
        </div>
        <div className="tb-group seg">
          {ZOOMS.map((z) => (
            <button key={z} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>
              {ZOOM_LABEL[z]}
            </button>
          ))}
        </div>
        <div className="tb-group">
          <TB icon="today" title="Ir a hoy" onClick={() => run('today')} />
          <TB icon="fit" title="Ajustar al proyecto" onClick={() => run('fit')} />
          <TB icon="calendar" title="Calendario laboral y festivos" onClick={() => run('calendar')} />
          <TB icon="users" title="Gremios" onClick={() => run('trades')} />
          <TB icon="export" title="Exportar PDF / PNG (Ctrl+P)" onClick={() => run('export-pdf')} />
        </div>
        <div className="tb-spacer" />
        <button className={`critical-btn${criticalMode ? ' on' : ''}`} onClick={() => run('critical')} title="Calcular y explicar el camino crítico (F9)">
          <Icon name="critical" size={18} />
          Camino crítico
          {!schedule.hasCycle && schedule.linkCount > 0 && <span className="cb-count">{criticalCount}</span>}
        </button>
        <div className="tb-group">
          <TB icon={theme === 'light' ? 'moon' : 'sun'} title="Tema claro / oscuro" onClick={() => run('theme')} />
          <TB icon="help" title="Ayuda y atajos (F1)" onClick={() => run('help')} />
        </div>
      </header>

      {schedule.hasCycle && (
        <div className="banner error">
          <Icon name="warn" /> {schedule.issues.find((i) => i.code === 'cycle')?.message}
        </div>
      )}

      <main className="main">
        <TaskTable
          project={project}
          schedule={schedule}
          rows={rows}
          rowOfUid={rowOfUid}
          summary={summary}
          scrollTop={scrollTop}
          viewport={viewportH}
          width={tableWidth}
          active={active}
          selected={selected}
          criticalMode={criticalMode}
          colWidths={colWidths}
          focusToken={focusToken}
          onColWidth={(k, w) => setColWidths((c) => ({ ...c, [k]: w }))}
          onScrollBy={(dy) => setScrollTop((s) => Math.max(0, Math.min(maxScroll, s + dy)))}
          onActivate={onActivate}
          onCommit={onCellCommit}
          onClear={onCellClear}
          onToggle={(uid) => commit({ ...project, tasks: project.tasks.map((t) => (t.uid === uid ? { ...t, collapsed: !t.collapsed } : t)) })}
          onOpenTask={(uid) => setDialog({ kind: 'task', uid })}
          onDeleteRows={deleteSelected}
        />
        <div
          className="splitter"
          onMouseDown={(e) => {
            e.preventDefault()
            const x0 = e.clientX
            const w0 = tableWidth
            const move = (ev: MouseEvent): void => setTableWidth(Math.max(240, Math.min(window.innerWidth - 300, w0 + ev.clientX - x0)))
            const up = (): void => {
              window.removeEventListener('mousemove', move)
              window.removeEventListener('mouseup', up)
            }
            window.addEventListener('mousemove', move)
            window.addEventListener('mouseup', up)
          }}
        />
        <GanttChart
          ref={ganttRef}
          project={project}
          schedule={schedule}
          rows={rows}
          summary={summary}
          dayWidth={dayWidth}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          scrollTop={scrollTop}
          criticalMode={criticalMode}
          selected={selected}
          onScroll={(top, h) => {
            setScrollTop(top)
            setViewportH(h)
          }}
          onSelect={(uid, mods) => {
            const pos = posOfUid.get(uid)
            if (pos !== undefined) onActivate({ row: pos, col: active.col }, mods)
          }}
          onMove={(uid, day) => commit(moveTask(project, schedule, uid, day))}
          onResize={(uid, day) => commit(resizeTask(project, schedule, uid, day))}
          onLink={(pred, succ) => {
            if (tryCommit(addLink(project, schedule, pred, succ))) toast(`Vínculo creado: ${(rowOfUid.get(pred) ?? 0) + 1} → ${(rowOfUid.get(succ) ?? 0) + 1} (FC)`, 'ok')
          }}
          onOpenTask={(uid) => setDialog({ kind: 'task', uid })}
          onZoom={zoomBy}
        />
        {panelOpen && (
          <CriticalPanel
            project={project}
            schedule={schedule}
            onClose={() => {
              setPanelOpen(false)
              setCriticalMode(false)
            }}
            onFocusTask={(uid) => focusTask(uid)}
            onThreshold={(v) => commit({ ...project, nearCriticalThreshold: v })}
          />
        )}
      </main>

      <footer className="statusbar">
        <span>
          Inicio <b>{formatES(schedule.projectStart)}</b>
        </span>
        <span>
          Fin <b>{formatES(schedule.projectFinish)}</b>
        </span>
        <span>
          Duración <b>{schedule.projectDuration} d lab.</b>
        </span>
        {project.info.deadline && (
          <span className={isoToDay(schedule.projectFinish) > isoToDay(project.info.deadline) ? 'st-bad' : ''}>
            Contractual <b>{formatES(project.info.deadline)}</b>
          </span>
        )}
        <span>
          Tareas <b>{schedule.list.filter((s) => s && !s.isSummary).length}</b>
        </span>
        <span>
          Vínculos <b>{schedule.linkCount}</b>
        </span>
        <span className="st-spacer" />
        {(errorCount > 0 || warnCount > 0) && (
          <button
            className={`st-issues ${errorCount ? 'err' : 'warn'}`}
            onClick={() => {
              setPanelOpen(true)
              setCriticalMode(true)
            }}
          >
            <Icon name="warn" size={14} /> {errorCount ? `${errorCount} errores` : ''} {warnCount ? `${warnCount} avisos` : ''}
          </button>
        )}
        <span className="dim">Calendario: {project.calendar.workWeek.filter(Boolean).length} días/sem · {project.calendar.holidays.length} festivos</span>
      </footer>

      {dialog?.kind === 'info' && (
        <ProjectInfoDialog
          project={project}
          onClose={() => setDialog(null)}
          onSave={(info) => {
            commit({ ...project, info })
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'calendar' && (
        <CalendarDialog
          project={project}
          schedule={schedule}
          onClose={() => setDialog(null)}
          onSave={(workWeek, holidays) => {
            commit({ ...project, calendar: { workWeek, holidays } })
            setDialog(null)
            toast('Calendario actualizado: fechas recalculadas', 'ok')
          }}
        />
      )}
      {dialog?.kind === 'trades' && (
        <TradesDialog
          project={project}
          onClose={() => setDialog(null)}
          onSave={(trades) => {
            commit({ ...project, trades })
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'export' && <ExportDialog initial={{ ...exportOpts, format: dialog.format }} onClose={() => setDialog(null)} onExport={doExport} />}
      {dialogTask && (
        <TaskDialog
          project={project}
          schedule={schedule}
          task={dialogTask}
          isSummary={summary[rowOfUid.get(dialogTask.uid) ?? -1]}
          onClose={() => setDialog(null)}
          onSave={(t) => {
            const { predecessors, ...rest } = t
            const base = { ...project, tasks: project.tasks.map((x) => (x.uid === t.uid ? { ...x, ...rest } : x)) }
            const r = setPredecessors(base, computeSchedule(base), t.uid, predecessors)
            if ('error' in r) return r.error
            // setPredecessors puede reajustar inicio/restricción; respetamos lo editado en el diálogo si hay predecesoras
            commit(predecessors.length ? { ...r.project, tasks: r.project.tasks.map((x) => (x.uid === t.uid ? { ...x, start: t.start, constraint: t.constraint } : x)) } : r.project)
            setDialog(null)
            refocus()
            return null
          }}
        />
      )}
      <Toasts toasts={toasts} />
    </div>
  )
}

function TB({ icon, title, onClick, disabled, label }: { icon: string; title: string; onClick(): void; disabled?: boolean; label?: string }) {
  return (
    <button className={`tb-btn${label ? ' with-label' : ''}`} title={title} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={17} />
      {label && <span>{label}</span>}
    </button>
  )
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.level}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

function GanttLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="logo" aria-hidden>
      <rect width="28" height="28" rx="7" className="logo-bg" />
      <rect x="5" y="7" width="10" height="3.6" rx="1.5" fill="#fff" />
      <rect x="10" y="12.2" width="9" height="3.6" rx="1.5" fill="#fff" opacity="0.85" />
      <rect x="14" y="17.4" width="9" height="3.6" rx="1.5" fill="#ff6b6b" />
    </svg>
  )
}
