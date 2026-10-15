// Tabla de tareas tipo hoja de cálculo, virtualizada y sincronizada con el diagrama.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { formatES } from '@core/dates'
import type { FieldKey } from '@core/edit'
import { formatPredecessors } from '@core/predecessors'
import type { ScheduleResult } from '@core/schedule'
import type { Project, Task } from '@core/types'
import { Icon } from './Icon'

export const ROW_H = 30
export const HEADER_H = 52

export type ColKey = 'row' | 'wbs' | FieldKey | 'float'

export interface ColumnDef {
  key: ColKey
  label: string
  width: number
  align?: 'left' | 'right' | 'center'
  editable: boolean
  kind?: 'date' | 'select' | 'number'
}

export const COLUMNS: ColumnDef[] = [
  { key: 'row', label: '#', width: 40, align: 'right', editable: false },
  { key: 'wbs', label: 'EDT', width: 52, editable: false },
  { key: 'name', label: 'Nombre de tarea', width: 280, editable: true },
  { key: 'duration', label: 'Duración', width: 72, align: 'right', editable: true, kind: 'number' },
  { key: 'start', label: 'Inicio', width: 92, editable: true, kind: 'date' },
  { key: 'finish', label: 'Fin', width: 92, editable: true, kind: 'date' },
  { key: 'preds', label: 'Predecesoras', width: 112, editable: true },
  { key: 'trade', label: 'Gremio', width: 130, editable: true, kind: 'select' },
  { key: 'responsible', label: 'Responsable', width: 120, editable: true },
  { key: 'progress', label: '% Av.', width: 58, align: 'right', editable: true, kind: 'number' },
  { key: 'float', label: 'Holgura', width: 68, align: 'right', editable: false },
  { key: 'deadline', label: 'F. límite', width: 92, editable: true, kind: 'date' },
  { key: 'notes', label: 'Notas', width: 200, editable: true }
]

export interface ActiveCell {
  row: number
  col: number
}

interface Props {
  project: Project
  schedule: ScheduleResult
  rows: number[]
  rowOfUid: Map<number, number>
  summary: boolean[]
  scrollTop: number
  viewport: number
  width: number
  active: ActiveCell
  selected: Set<number>
  criticalMode: boolean
  colWidths: Record<string, number>
  focusToken: number
  onColWidth(key: string, w: number): void
  onScrollBy(dy: number): void
  onActivate(cell: ActiveCell, mods: { shift: boolean; ctrl: boolean; rowHeader?: boolean }): void
  onCommit(rowPos: number, field: FieldKey, text: string): boolean
  onClear(rowPos: number, field: FieldKey): void
  onToggle(uid: number): void
  onOpenTask(uid: number): void
  onDeleteRows(): void
}

export function TaskTable(props: Props) {
  const { project, schedule, rows, rowOfUid, summary, scrollTop, viewport, active, selected, criticalMode, colWidths } = props
  const bodyRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  const rowSelMode = useRef(false)

  const cols = COLUMNS.map((c) => ({ ...c, width: colWidths[c.key] ?? c.width }))
  const totalW = cols.reduce((a, c) => a + c.width, 0)
  const lefts: number[] = []
  cols.reduce((acc, c, i) => ((lefts[i] = acc), acc + c.width), 0)

  useLayoutEffect(() => {
    if (bodyRef.current && Math.abs(bodyRef.current.scrollTop - scrollTop) > 0.5) bodyRef.current.scrollTop = scrollTop
  }, [scrollTop])

  useEffect(() => {
    if (!editing) rootRef.current?.focus({ preventScroll: true })
  }, [props.focusToken, editing])

  useEffect(() => {
    const el = inputRef.current
    if (editing && el) {
      el.focus()
      if (el instanceof HTMLInputElement) {
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    }
  }, [editing?.row, editing?.col])

  // Asegura que la celda activa sea visible horizontalmente
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const l = lefts[active.col]
    const r = l + cols[active.col].width
    if (l < el.scrollLeft) el.scrollLeft = l
    else if (r > el.scrollLeft + el.clientWidth) el.scrollLeft = r - el.clientWidth
  }, [active.col]) // eslint-disable-line react-hooks/exhaustive-deps

  const taskAt = (pos: number): Task | undefined => (pos < rows.length ? project.tasks[rows[pos]] : undefined)

  const displayValue = (t: Task, idx: number, key: ColKey): string => {
    const sc = schedule.byUid.get(t.uid)
    switch (key) {
      case 'row':
        return String(idx + 1)
      case 'wbs':
        return sc?.wbs ?? ''
      case 'name':
        return t.name
      case 'duration':
        return sc ? `${sc.duration} d` : ''
      case 'start':
        return formatES(sc?.start)
      case 'finish':
        return formatES(sc?.finish)
      case 'preds':
        return formatPredecessors(t.predecessors, rowOfUid)
      case 'trade':
        return summary[idx] ? '' : project.trades.find((x) => x.id === t.trade)?.name ?? ''
      case 'responsible':
        return t.responsible
      case 'progress':
        return `${t.progress} %`
      case 'float':
        return sc && !schedule.hasCycle ? `${sc.totalFloat} d` : '—'
      case 'deadline':
        return formatES(t.deadline)
      case 'notes':
        return t.notes
    }
  }

  const editValue = (t: Task | undefined, key: ColKey): string => {
    if (!t) return ''
    const sc = schedule.byUid.get(t.uid)
    switch (key) {
      case 'duration':
        return String(sc?.duration ?? t.duration)
      case 'progress':
        return String(t.progress)
      case 'trade':
        return t.trade
      default: {
        const idx = rowOfUid.get(t.uid) as number
        return displayValue(t, idx, key)
      }
    }
  }

  const canEdit = (pos: number, col: number): boolean => {
    const c = cols[col]
    if (!c.editable) return false
    const t = taskAt(pos)
    if (!t) return true // fila nueva
    const idx = rowOfUid.get(t.uid) as number
    if (summary[idx] && ['duration', 'start', 'finish', 'preds', 'trade'].includes(c.key)) return false
    return true
  }

  const startEdit = (pos: number, col: number, initial?: string): void => {
    if (!canEdit(pos, col)) return
    const t = taskAt(pos)
    setEditing({ row: pos, col, value: initial ?? editValue(t, cols[col].key) })
  }

  const editRef = useRef(editing)
  editRef.current = editing

  const commit = (move: 'down' | 'right' | 'left' | 'up' | 'none'): void => {
    const ed = editRef.current
    if (!ed) return
    editRef.current = null // evita doble confirmación (Enter + blur)
    const { row, col, value } = ed
    const key = cols[col].key as FieldKey
    const t = taskAt(row)
    const original = editValue(t, key)
    let ok = true
    if (value !== original || !t) {
      if (t || value.trim() !== '') ok = props.onCommit(row, key, value)
    }
    if (!ok) {
      // Con Enter/Tab se mantiene la edición para corregir; al salir de la celda se descarta.
      if (move === 'none') setEditing(null)
      else editRef.current = ed
      return
    }
    setEditing(null)
    const next = { row, col }
    if (move === 'down') next.row = Math.min(rows.length, row + 1)
    if (move === 'up') next.row = Math.max(0, row - 1)
    if (move === 'right') next.col = nextEditable(col, 1)
    if (move === 'left') next.col = nextEditable(col, -1)
    props.onActivate(next, { shift: false, ctrl: false })
  }

  const nextEditable = (col: number, dir: 1 | -1): number => {
    let c = col + dir
    while (c >= 0 && c < cols.length && !cols[c].editable) c += dir
    return c < 0 || c >= cols.length ? col : c
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (editing) return
    const { row, col } = active
    const shift = e.shiftKey
    const ctrl = e.ctrlKey || e.metaKey
    const move = (r: number, c: number): void => {
      e.preventDefault()
      rowSelMode.current = false
      props.onActivate({ row: Math.max(0, Math.min(rows.length, r)), col: Math.max(0, Math.min(cols.length - 1, c)) }, { shift, ctrl: false })
    }
    if (e.altKey) return // atajos de sangría/mover los gestiona la aplicación
    switch (e.key) {
      case 'ArrowDown':
        return move(row + 1, col)
      case 'ArrowUp':
        return move(row - 1, col)
      case 'ArrowRight':
        return move(row, col + 1)
      case 'ArrowLeft':
        return move(row, col - 1)
      case 'PageDown':
        return move(row + Math.floor(viewport / ROW_H), col)
      case 'PageUp':
        return move(row - Math.floor(viewport / ROW_H), col)
      case 'Home':
        return ctrl ? move(0, col) : move(row, 2)
      case 'End':
        return ctrl ? move(rows.length, col) : move(row, cols.length - 1)
      case 'Tab':
        e.preventDefault()
        return props.onActivate({ row, col: nextEditable(col, shift ? -1 : 1) }, { shift: false, ctrl: false })
      case 'Enter':
      case 'F2':
        e.preventDefault()
        return startEdit(row, col)
      case 'Delete':
        e.preventDefault()
        if (rowSelMode.current || cols[col].key === 'row') return props.onDeleteRows()
        if (taskAt(row) && canEdit(row, col) && ['preds', 'responsible', 'notes', 'deadline', 'name'].includes(cols[col].key)) {
          props.onClear(row, cols[col].key as FieldKey)
        }
        return
      case 'Backspace':
        e.preventDefault()
        return startEdit(row, col, '')
      case 'Escape':
        rowSelMode.current = false
        return
    }
    if (!ctrl && e.key.length === 1) {
      e.preventDefault()
      startEdit(row, col, e.key)
    }
  }

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - 4)
  const last = Math.min(rows.length + 1, Math.ceil((scrollTop + viewport) / ROW_H) + 4)
  const items: JSX.Element[] = []
  for (let pos = first; pos < last; pos++) {
    const t = taskAt(pos)
    const idx = t ? (rowOfUid.get(t.uid) as number) : -1
    const sc = t ? schedule.byUid.get(t.uid) : undefined
    const isSel = t ? selected.has(t.uid) : false
    const cls = ['tr']
    if (!t) cls.push('phantom')
    if (isSel) cls.push('selected')
    if (t && summary[idx]) cls.push('summary')
    if (criticalMode && sc?.critical) cls.push('critical')
    if (criticalMode && sc?.nearCritical) cls.push('near')
    items.push(
      <div key={t ? t.uid : 'new'} className={cls.join(' ')} style={{ top: pos * ROW_H, width: totalW }}>
        {cols.map((c, ci) => {
          const isActive = active.row === pos && active.col === ci
          const isEditing = editing && editing.row === pos && editing.col === ci
          const style = { left: lefts[ci], width: c.width }
          const cellCls = ['td', `c-${c.key}`, c.align ? `al-${c.align}` : '', isActive ? 'active' : '', !canEdit(pos, ci) && c.editable ? 'ro' : '']
          if (isEditing) {
            return (
              <div key={c.key} className={cellCls.join(' ') + ' editing'} style={style}>
                {c.kind === 'select' ? (
                  <select
                    ref={(el) => (inputRef.current = el)}
                    value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    onKeyDown={(e) => editKeys(e)}
                    onBlur={() => commit('none')}
                  >
                    {project.trades.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    ref={(el) => (inputRef.current = el)}
                    value={editing.value}
                    placeholder={c.kind === 'date' ? 'dd/mm/aaaa' : c.key === 'preds' ? 'ej. 3;4CC+2d' : t ? '' : 'Nueva tarea…'}
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    onKeyDown={(e) => editKeys(e)}
                    onBlur={() => commit('none')}
                    spellCheck={c.key === 'name' || c.key === 'notes'}
                  />
                )}
              </div>
            )
          }
          let content: JSX.Element | string = t ? displayValue(t, idx, c.key) : c.key === 'name' ? 'Escribe aquí para añadir una tarea…' : ''
          if (t && c.key === 'name') {
            content = (
              <>
                <span className="indent" style={{ width: t.level * 18 }} />
                {summary[idx] ? (
                  <button
                    className="toggle"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onToggle(t.uid)
                    }}
                    title={t.collapsed ? 'Desplegar' : 'Plegar'}
                  >
                    <Icon name={t.collapsed ? 'chevronRight' : 'chevronDown'} size={14} />
                  </button>
                ) : (
                  <span className="toggle-ph" />
                )}
                {sc?.isMilestone && <span className="ms-ico">◆</span>}
                {!summary[idx] && !sc?.isMilestone && <span className="trade-dot" style={{ background: project.trades.find((x) => x.id === t.trade)?.color }} />}
                <span className="name-text">{t.name || <em className="dim">(sin nombre)</em>}</span>
                {t.constraint === 'snet' && (
                  <span className="badge-snet" title={`Restricción: no comenzar antes del ${formatES(t.start)}`}>
                    <Icon name="pin" size={12} />
                  </span>
                )}
              </>
            )
          }
          if (t && c.key === 'progress' && !summary[idx]) {
            content = (
              <span className="pct">
                <span className="pct-bar" style={{ width: `${t.progress}%` }} />
                <span className="pct-txt">{t.progress} %</span>
              </span>
            )
          }
          const floatCls = c.key === 'float' && sc && !schedule.hasCycle ? (sc.totalFloat < 0 ? 'neg' : sc.totalFloat === 0 ? 'zero' : '') : ''
          return (
            <div
              key={c.key}
              className={cellCls.join(' ') + (floatCls ? ` ${floatCls}` : '')}
              style={style}
              onMouseDown={(e) => {
                if (e.button !== 0) return
                rowSelMode.current = c.key === 'row'
                props.onActivate({ row: pos, col: ci }, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, rowHeader: c.key === 'row' })
              }}
              onDoubleClick={() => (t && (c.key === 'row' || c.key === 'wbs') ? props.onOpenTask(t.uid) : startEdit(pos, ci))}
              title={c.key === 'notes' && t ? t.notes : undefined}
            >
              {content}
            </div>
          )
        })}
      </div>
    )
  }

  function editKeys(e: ReactKeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(e.shiftKey ? 'up' : 'down')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commit(e.shiftKey ? 'left' : 'right')
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(null)
    }
    e.stopPropagation()
  }

  // Redimensionar columnas desde la cabecera
  const startResize = (key: string, startX: number, startW: number): void => {
    const onMove = (ev: MouseEvent): void => props.onColWidth(key, Math.max(36, startW + ev.clientX - startX))
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="table-pane" ref={rootRef} tabIndex={0} onKeyDown={onKeyDown} style={{ width: props.width }}>
      <div className="thead" style={{ height: HEADER_H }}>
        <div className="thead-inner" style={{ width: totalW, transform: `translateX(${-scrollLeft}px)` }}>
          {cols.map((c, i) => (
            <div key={c.key} className={`th al-${c.align ?? 'left'}`} style={{ left: lefts[i], width: c.width }}>
              <span>{c.label}</span>
              <span className="col-resize" onMouseDown={(e) => (e.preventDefault(), startResize(c.key, e.clientX, c.width))} />
            </div>
          ))}
        </div>
      </div>
      <div
        className="tbody"
        ref={bodyRef}
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
        onWheel={(e) => {
          if (e.ctrlKey) return
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) props.onScrollBy(e.deltaY)
        }}
      >
        <div className="tbody-inner" style={{ height: (rows.length + 1) * ROW_H + 40, width: totalW }}>
          {items}
        </div>
      </div>
    </div>
  )
}
