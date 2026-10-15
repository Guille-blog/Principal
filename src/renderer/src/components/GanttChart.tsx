// Diagrama de Gantt en SVG, virtualizado en ambos ejes, con arrastre, redimensionado y creación de vínculos.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { dayToISO, formatES, isoToDay, todayISO } from '@core/dates'
import { LINK_TYPE_LABEL } from '@core/predecessors'
import { linkKey, type ScheduleResult, type TaskSchedule } from '@core/schedule'
import type { Project, Task } from '@core/types'
import { linkPath } from '../geometry'
import { ticks, tiersFor } from '../timescale'
import { HEADER_H, ROW_H } from './TaskTable'

export interface GanttHandle {
  scrollToDay(day: number, align?: 'start' | 'center'): void
  viewportWidth(): number
}

interface Props {
  project: Project
  schedule: ScheduleResult
  rows: number[]
  summary: boolean[]
  dayWidth: number
  rangeStart: number
  rangeEnd: number
  scrollTop: number
  criticalMode: boolean
  selected: Set<number>
  onScroll(top: number, height: number): void
  onSelect(uid: number, mods: { shift: boolean; ctrl: boolean }): void
  onMove(uid: number, startDay: number): void
  onResize(uid: number, finishDay: number): void
  onLink(predUid: number, succUid: number): void
  onOpenTask(uid: number): void
  onZoom(dir: 1 | -1): void
}

type Drag =
  | { mode: 'move' | 'resize'; uid: number; x0: number; deltaDays: number; moved: boolean }
  | { mode: 'link'; uid: number; x: number; y: number; target: number | null }

interface Geo {
  pos: number
  x1: number
  x2: number
  cy: number
  s: TaskSchedule
  task: Task
  summary: boolean
}

const BAR_H = 16

export const GanttChart = forwardRef<GanttHandle, Props>(function GanttChart(props, ref) {
  const { project, schedule, rows, summary, dayWidth: dw, rangeStart, rangeEnd, criticalMode, selected } = props
  const bodyRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ left: 0, top: 0, width: 800, height: 600 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hover, setHover] = useState<{ uid: number; x: number; y: number } | null>(null)
  const anchor = useRef<{ day: number; offset: number } | null>(null)
  const raf = useRef(0)

  const totalW = Math.max(1, (rangeEnd - rangeStart) * dw)
  const totalH = (rows.length + 1) * ROW_H + 40
  const X = useCallback((day: number) => (day - rangeStart) * dw, [rangeStart, dw])

  useImperativeHandle(ref, () => ({
    scrollToDay(day, align = 'start') {
      const el = bodyRef.current
      if (!el) return
      el.scrollLeft = Math.max(0, X(day) - (align === 'center' ? el.clientWidth / 2 : 40))
    },
    viewportWidth: () => bodyRef.current?.clientWidth ?? 800
  }))

  // Sincronización vertical con la tabla
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (el && Math.abs(el.scrollTop - props.scrollTop) > 0.5) el.scrollTop = props.scrollTop
  }, [props.scrollTop])

  // Mantener el día bajo el ratón al hacer zoom
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (el && anchor.current) {
      el.scrollLeft = Math.max(0, X(anchor.current.day) - anchor.current.offset)
      anchor.current = null
      readView()
    }
  }, [dw]) // eslint-disable-line react-hooks/exhaustive-deps

  const readView = (): void => {
    const el = bodyRef.current
    if (!el) return
    setView({ left: el.scrollLeft, top: el.scrollTop, width: el.clientWidth, height: el.clientHeight })
  }

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      readView()
      props.onScroll(el.scrollTop, el.clientHeight)
    })
    ro.observe(el)
    readView()
    const wheel = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const offset = e.clientX - rect.left
      anchor.current = { day: rangeStartRef.current + (el.scrollLeft + offset) / dwRef.current, offset }
      props.onZoom(e.deltaY > 0 ? -1 : 1)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', wheel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const rangeStartRef = useRef(rangeStart)
  rangeStartRef.current = rangeStart
  const dwRef = useRef(dw)
  dwRef.current = dw

  const onScroll = (): void => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = bodyRef.current
      if (!el) return
      readView()
      props.onScroll(el.scrollTop, el.clientHeight)
    })
  }

  // ---------- Geometría ----------
  const geo = useMemo(() => {
    const m = new Map<number, Geo>()
    rows.forEach((idx, pos) => {
      const task = project.tasks[idx]
      const s = schedule.list[idx]
      if (!s) return
      const cy = pos * ROW_H + ROW_H / 2
      if (s.isMilestone) {
        const x = (s.milestoneAt - rangeStart) * dw
        m.set(task.uid, { pos, x1: x - 7, x2: x + 7, cy, s, task, summary: false })
      } else {
        m.set(task.uid, { pos, x1: (s.startDay - rangeStart) * dw, x2: (s.finishDay + 1 - rangeStart) * dw, cy, s, task, summary: summary[idx] })
      }
    })
    return m
  }, [rows, project.tasks, schedule, rangeStart, dw, summary])

  const tradeColor = useMemo(() => new Map(project.trades.map((t) => [t.id, t.color])), [project.trades])

  // ---------- Interacción ----------
  const posFromClientY = (clientY: number): number => {
    const el = bodyRef.current as HTMLDivElement
    const y = clientY - el.getBoundingClientRect().top + el.scrollTop
    return Math.floor(y / ROW_H)
  }

  const beginDrag = (e: React.PointerEvent, uid: number, mode: 'move' | 'resize' | 'link'): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    props.onSelect(uid, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })
    const el = bodyRef.current as HTMLDivElement
    const rect = el.getBoundingClientRect()
    if (mode === 'link') setDrag({ mode, uid, x: e.clientX - rect.left + el.scrollLeft, y: e.clientY - rect.top + el.scrollTop, target: null })
    else setDrag({ mode, uid, x0: e.clientX, deltaDays: 0, moved: false })
  }

  useEffect(() => {
    if (!drag) return
    const el = bodyRef.current as HTMLDivElement
    const move = (e: PointerEvent): void => {
      if (drag.mode === 'link') {
        const rect = el.getBoundingClientRect()
        const pos = posFromClientY(e.clientY)
        const idx = rows[pos]
        const target = idx !== undefined && !summary[idx] && project.tasks[idx].uid !== drag.uid ? project.tasks[idx].uid : null
        setDrag({ ...drag, x: e.clientX - rect.left + el.scrollLeft, y: e.clientY - rect.top + el.scrollTop, target })
      } else {
        const deltaDays = Math.round((e.clientX - drag.x0) / dw)
        if (deltaDays !== drag.deltaDays || (!drag.moved && Math.abs(e.clientX - drag.x0) > 3)) {
          setDrag({ ...drag, deltaDays, moved: drag.moved || Math.abs(e.clientX - drag.x0) > 3 })
        }
      }
    }
    const up = (): void => {
      const g = geo.get(drag.uid)
      if (drag.mode === 'link') {
        if (drag.target !== null) props.onLink(drag.uid, drag.target)
      } else if (drag.moved && drag.deltaDays !== 0 && g) {
        if (drag.mode === 'move') props.onMove(drag.uid, (g.s.isMilestone ? g.s.milestoneAt : g.s.startDay) + drag.deltaDays)
        else props.onResize(drag.uid, g.s.finishDay + drag.deltaDays)
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [drag, dw, geo, rows, summary, project.tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Ventana visible ----------
  const x0 = Math.max(0, view.left - 300)
  const x1v = Math.min(totalW, view.left + view.width + 300)
  const y0 = Math.max(0, view.top - ROW_H * 4)
  const y1 = Math.min(totalH, view.top + view.height + ROW_H * 4)
  const firstPos = Math.floor(y0 / ROW_H)
  const lastPos = Math.ceil(y1 / ROW_H)
  const dayFrom = Math.floor(rangeStart + x0 / dw)
  const dayTo = Math.ceil(rangeStart + x1v / dw)
  const [topUnit, bottomUnit] = tiersFor(dw)
  const topTicks = ticks(dayFrom, dayTo, topUnit, dw)
  const bottomTicks = ticks(dayFrom, dayTo, bottomUnit, dw)
  const cal = schedule.calendar
  const today = isoToDay(todayISO())

  // Fondo: días no laborables y rejilla
  const background: JSX.Element[] = []
  if (dw >= 5) {
    for (let d = dayFrom; d < dayTo; d++) {
      if (!cal.isWorkday(d)) {
        background.push(<rect key={`nw${d}`} x={X(d)} y={y0} width={dw} height={y1 - y0} className={cal.isHoliday(d) ? 'bg-holiday' : 'bg-weekend'} />)
      }
    }
  }
  for (const t of bottomTicks) background.push(<line key={`g${t.start}`} x1={X(t.start)} x2={X(t.start)} y1={y0} y2={y1} className="grid-v" />)
  for (const t of topTicks) background.push(<line key={`G${t.start}`} x1={X(t.start)} x2={X(t.start)} y1={y0} y2={y1} className="grid-v strong" />)

  const rowBands: JSX.Element[] = []
  for (let pos = firstPos; pos < Math.min(lastPos, rows.length); pos++) {
    const t = project.tasks[rows[pos]]
    if (selected.has(t.uid)) rowBands.push(<rect key={`sel${t.uid}`} x={x0} y={pos * ROW_H} width={x1v - x0} height={ROW_H} className="row-sel" />)
    rowBands.push(<line key={`rl${pos}`} x1={x0} x2={x1v} y1={(pos + 1) * ROW_H} y2={(pos + 1) * ROW_H} className="grid-h" />)
  }

  // ---------- Vínculos ----------
  const links: JSX.Element[] = []
  for (const g of geo.values()) {
    for (const dep of g.task.predecessors) {
      const p = geo.get(dep.predUid)
      if (!p || p.summary || g.summary) continue
      const top = Math.min(p.pos, g.pos)
      const bottom = Math.max(p.pos, g.pos)
      if (bottom < firstPos || top > lastPos) continue
      const isCrit = criticalMode && schedule.criticalLinks.has(linkKey(dep.predUid, g.task.uid))
      const d = linkPath(p, g, dep.type, ROW_H)
      links.push(
        <path key={`${dep.predUid}-${g.task.uid}`} d={d} className={`link${isCrit ? ' crit' : ''}${criticalMode && !isCrit ? ' faded' : ''}`} markerEnd={`url(#${isCrit ? 'arrowCrit' : 'arrow'})`}>
          <title>{`${LINK_TYPE_LABEL[dep.type]}${dep.lag ? ` ${dep.lag > 0 ? '+' : ''}${dep.lag} d` : ''}`}</title>
        </path>
      )
    }
  }

  // ---------- Barras ----------
  const bars: JSX.Element[] = []
  for (let pos = firstPos; pos < Math.min(lastPos, rows.length); pos++) {
    const t = project.tasks[rows[pos]]
    const g = geo.get(t.uid)
    if (!g) continue
    const s = g.s
    let dx = 0
    let dwExtra = 0
    if (drag && drag.mode !== 'link' && drag.uid === t.uid && drag.moved) {
      if (drag.mode === 'move') dx = drag.deltaDays * dw
      else dwExtra = drag.deltaDays * dw
    }
    const yTop = pos * ROW_H + (ROW_H - BAR_H) / 2
    const color = tradeColor.get(t.trade) ?? '#6b7a8f'
    const state = s.critical ? 'crit' : s.nearCritical ? 'near' : 'normal'
    const mouse = {
      onMouseEnter: (e: React.MouseEvent) => setHover({ uid: t.uid, x: e.clientX, y: e.clientY }),
      onMouseMove: (e: React.MouseEvent) => setHover({ uid: t.uid, x: e.clientX, y: e.clientY }),
      onMouseLeave: () => setHover(null),
      onDoubleClick: () => props.onOpenTask(t.uid)
    }
    const label = (x: number): JSX.Element => (
      <text x={x + 8} y={pos * ROW_H + ROW_H / 2 + 4} className={`bar-label${criticalMode && s.critical ? ' crit' : ''}`}>
        {t.name}
        {criticalMode && !s.critical && !schedule.hasCycle && s.totalFloat > 0 && !g.summary ? `  · holgura ${s.totalFloat} d` : ''}
        {!criticalMode && t.responsible && !g.summary ? `  · ${t.responsible}` : ''}
      </text>
    )

    if (g.summary) {
      const w = Math.max(2, g.x2 - g.x1)
      bars.push(
        <g key={t.uid} className={`summary-bar${criticalMode && s.critical ? ' crit' : ''}`} {...mouse} onPointerDown={(e) => (e.button === 0 ? props.onSelect(t.uid, { shift: e.shiftKey, ctrl: e.ctrlKey }) : undefined)}>
          <rect x={g.x1} y={yTop + 2} width={w} height={7} rx={1.5} />
          <path d={`M${g.x1} ${yTop + 9} l0 6 l6 -6 z`} />
          <path d={`M${g.x1 + w} ${yTop + 9} l0 6 l-6 -6 z`} />
          {label(g.x1 + w)}
        </g>
      )
      continue
    }

    if (s.isMilestone) {
      const cx = (g.x1 + g.x2) / 2 + dx
      const cy = pos * ROW_H + ROW_H / 2
      bars.push(
        <g key={t.uid} className={`milestone ${criticalMode ? state : ''}`} {...mouse}>
          <path d={`M${cx} ${cy - 8} L${cx + 8} ${cy} L${cx} ${cy + 8} L${cx - 8} ${cy} Z`} onPointerDown={(e) => beginDrag(e, t.uid, 'move')} className="ms-shape" />
          <circle cx={cx + 14} cy={cy} r={4} className="link-handle" onPointerDown={(e) => beginDrag(e, t.uid, 'link')} />
          <text x={cx + 12} y={cy + 4} className={`bar-label${criticalMode && s.critical ? ' crit' : ''}`}>
            {t.name} · {formatES(s.start).slice(0, 5)}
          </text>
        </g>
      )
      continue
    }

    const x = g.x1 + dx
    const w = Math.max(3, g.x2 - g.x1 + dwExtra)
    const fill = criticalMode ? (state === 'crit' ? 'var(--critical)' : state === 'near' ? 'var(--near)' : color) : color
    bars.push(
      <g key={t.uid} className={`task-bar ${criticalMode ? state : ''}${selected.has(t.uid) ? ' sel' : ''}`} {...mouse}>
        {criticalMode && s.totalFloat > 0 && !schedule.hasCycle && (
          <g className="float-bar">
            <line x1={x + w} x2={X(isoToDay(s.lateFinish) + 1)} y1={yTop + BAR_H + 3} y2={yTop + BAR_H + 3} />
            <line x1={X(isoToDay(s.lateFinish) + 1)} x2={X(isoToDay(s.lateFinish) + 1)} y1={yTop + BAR_H} y2={yTop + BAR_H + 6} />
          </g>
        )}
        <rect x={x} y={yTop} width={w} height={BAR_H} rx={4} fill={fill} className="bar-body" onPointerDown={(e) => beginDrag(e, t.uid, 'move')} />
        {t.progress > 0 && <rect x={x} y={yTop} width={(w * t.progress) / 100} height={BAR_H} rx={4} className="bar-progress" pointerEvents="none" />}
        {t.deadline && (
          <path d={`M${X(isoToDay(t.deadline) + 1)} ${pos * ROW_H + 3} l-5 -0 l5 7 l5 -7 z`} className={`deadline-mark${s.totalFloat < 0 ? ' late' : ''}`}>
            <title>Fecha límite: {formatES(t.deadline)}</title>
          </path>
        )}
        <rect x={x + w - 6} y={yTop} width={8} height={BAR_H} className="resize-handle" onPointerDown={(e) => beginDrag(e, t.uid, 'resize')} />
        <circle cx={x + w + 9} cy={yTop + BAR_H / 2} r={4} className="link-handle" onPointerDown={(e) => beginDrag(e, t.uid, 'link')} />
        {label(x + w + 6)}
      </g>
    )
  }

  // Guía de arrastre (fechas)
  let dragInfo: JSX.Element | null = null
  if (drag && drag.mode !== 'link' && drag.moved) {
    const g = geo.get(drag.uid)
    if (g) {
      const s = g.s
      const ns = drag.mode === 'move' ? cal.nextWorkday((s.isMilestone ? s.milestoneAt : s.startDay) + drag.deltaDays) : s.startDay
      const nf = drag.mode === 'move' ? (s.isMilestone ? ns : cal.finishForDuration(ns, s.duration)) : cal.prevWorkday(s.finishDay + drag.deltaDays)
      const txt = drag.mode === 'move' ? `${formatES(dayToISO(ns))} → ${formatES(dayToISO(nf))}` : `Fin: ${formatES(dayToISO(nf))} (${Math.max(1, cal.workdaysInclusive(s.startDay, nf))} d)`
      dragInfo = (
        <g className="drag-info">
          <rect x={X(ns) - 4} y={g.pos * ROW_H - 22} width={txt.length * 6.6 + 12} height={18} rx={4} />
          <text x={X(ns) + 2} y={g.pos * ROW_H - 9}>
            {txt}
          </text>
        </g>
      )
    }
  }
  let linkGhost: JSX.Element | null = null
  if (drag && drag.mode === 'link') {
    const g = geo.get(drag.uid)
    if (g) {
      linkGhost = <path d={`M${g.x2} ${g.cy} L${drag.x} ${drag.y}`} className="link-ghost" />
    }
  }

  const deadlineX = project.info.deadline ? X(isoToDay(project.info.deadline) + 1) : null
  const hoverTask = hover ? project.tasks.find((t) => t.uid === hover.uid) : undefined
  const hoverSched = hover ? schedule.byUid.get(hover.uid) : undefined

  return (
    <div className="gantt-pane">
      <div className="gantt-head" style={{ height: HEADER_H }}>
        <svg width={view.width} height={HEADER_H} className="timescale">
          <g transform={`translate(${-view.left},0)`}>
            {topTicks.map((t) => (
              <g key={`t${t.start}`}>
                <line x1={X(t.start)} x2={X(t.start)} y1={0} y2={HEADER_H} className="ts-line strong" />
                <text x={Math.max(X(t.start), view.left) + 6} y={17} className="ts-top">
                  {t.label}
                </text>
              </g>
            ))}
            <line x1={view.left} x2={view.left + view.width} y1={26} y2={26} className="ts-line" />
            {bottomTicks.map((t) => {
              const w = (t.end - t.start) * dw
              const nonWork = bottomUnit === 'day' && !cal.isWorkday(t.start)
              return (
                <g key={`b${t.start}`}>
                  {nonWork && <rect x={X(t.start)} y={26} width={w} height={26} className={cal.isHoliday(t.start) ? 'bg-holiday' : 'bg-weekend'} />}
                  {t.start === today && bottomUnit === 'day' && <rect x={X(t.start)} y={26} width={w} height={26} className="ts-today" />}
                  <line x1={X(t.start)} x2={X(t.start)} y1={26} y2={HEADER_H} className="ts-line" />
                  {w >= 16 && (
                    <text x={X(t.start) + w / 2} y={bottomUnit === 'day' ? 38 : 43} textAnchor="middle" className="ts-bottom">
                      {t.label}
                    </text>
                  )}
                  {t.sub && w >= 16 && (
                    <text x={X(t.start) + w / 2} y={bottomUnit === 'day' ? 49 : 34} textAnchor="middle" className="ts-sub">
                      {t.sub}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>
      <div className="gantt-body" ref={bodyRef} onScroll={onScroll}>
        <div style={{ width: totalW, height: totalH, position: 'relative' }}>
          <svg
            className={`gantt-svg${drag ? ' dragging' : ''}`}
            style={{ position: 'absolute', left: x0, top: y0 }}
            width={Math.max(1, x1v - x0)}
            height={Math.max(1, y1 - y0)}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget || (e.target as Element).classList.contains('row-hit')) {
                const pos = posFromClientY(e.clientY)
                const idx = rows[pos]
                if (idx !== undefined) props.onSelect(project.tasks[idx].uid, { shift: e.shiftKey, ctrl: e.ctrlKey })
              }
            }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" className="arrow-head" />
              </marker>
              <marker id="arrowCrit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" className="arrow-head crit" />
              </marker>
            </defs>
            <g transform={`translate(${-x0},${-y0})`}>
              <rect x={x0} y={y0} width={x1v - x0} height={y1 - y0} className="row-hit" />
              {background}
              {rowBands}
              {today >= dayFrom && today <= dayTo && (
                <g className="today">
                  <line x1={X(today) + dw / 2} x2={X(today) + dw / 2} y1={y0} y2={y1} />
                </g>
              )}
              {deadlineX !== null && (
                <g className="contract">
                  <line x1={deadlineX} x2={deadlineX} y1={y0} y2={y1} />
                  <text x={deadlineX - 4} y={y0 + 14} textAnchor="end">
                    Fecha contractual {formatES(project.info.deadline)}
                  </text>
                </g>
              )}
              {links}
              {bars}
              {linkGhost}
              {dragInfo}
            </g>
          </svg>
        </div>
      </div>
      {hover && hoverTask && hoverSched && !drag && (
        <div className="tooltip" style={{ left: Math.min(hover.x + 14, window.innerWidth - 300), top: Math.min(hover.y + 16, window.innerHeight - 220) }}>
          <div className="tt-title">
            {hoverSched.wbs} · {hoverTask.name || '(sin nombre)'}
          </div>
          <div className="tt-grid">
            <span>Inicio</span>
            <b>{formatES(hoverSched.start)}</b>
            <span>Fin</span>
            <b>{formatES(hoverSched.finish)}</b>
            <span>Duración</span>
            <b>{hoverSched.duration} días lab.</b>
            {!hoverSched.isSummary && !schedule.hasCycle && (
              <>
                <span>Holgura total</span>
                <b className={hoverSched.totalFloat <= 0 ? 'crit-txt' : ''}>{hoverSched.totalFloat} d</b>
                <span>Holgura libre</span>
                <b>{hoverSched.freeFloat} d</b>
                <span>Inicio tardío</span>
                <b>{formatES(hoverSched.lateStart)}</b>
              </>
            )}
            {!hoverSched.isSummary && (
              <>
                <span>Gremio</span>
                <b>{project.trades.find((x) => x.id === hoverTask.trade)?.name}</b>
              </>
            )}
            <span>Avance</span>
            <b>{hoverTask.progress} %</b>
          </div>
          {hoverSched.critical && !schedule.hasCycle && <div className="tt-crit">Tarea crítica: cualquier retraso retrasa el fin de obra.</div>}
          {hoverSched.constraintDelays && <div className="tt-note">Restricción "no comenzar antes de" activa.</div>}
          <div className="tt-hint">Arrastra para mover · borde derecho para estirar · círculo para vincular</div>
        </div>
      )}
    </div>
  )
})
