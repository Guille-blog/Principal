// Panel explicativo del camino crítico.
import { useMemo, useState } from 'react'
import { formatES, isoToDay } from '@core/dates'
import { LINK_TYPE_LABEL } from '@core/predecessors'
import type { ScheduleIssue, ScheduleResult } from '@core/schedule'
import type { Project } from '@core/types'
import { Icon } from './Icon'

interface Props {
  project: Project
  schedule: ScheduleResult
  onClose(): void
  onFocusTask(uid: number): void
  onThreshold(v: number): void
}

export function CriticalPanel({ project, schedule, onClose, onFocusTask, onThreshold }: Props) {
  const [pathIdx, setPathIdx] = useState(0)
  const [tab, setTab] = useState<'path' | 'floats' | 'issues'>('path')
  const taskOf = useMemo(() => new Map(project.tasks.map((t, i) => [t.uid, { t, row: i + 1 }])), [project.tasks])
  const tradeOf = useMemo(() => new Map(project.trades.map((t) => [t.id, t])), [project.trades])
  const leaves = schedule.list.filter((s) => s && !s.isSummary)
  const critical = leaves.filter((s) => s.critical)
  const near = leaves.filter((s) => s.nearCritical).sort((a, b) => a.totalFloat - b.totalFloat)
  const paths = schedule.criticalPaths
  const path = paths[Math.min(pathIdx, Math.max(0, paths.length - 1))] ?? []
  const errors = schedule.issues.filter((i) => i.level === 'error')
  const contractMargin = project.info.deadline
    ? schedule.calendar.workdaysInclusive(isoToDay(schedule.projectFinish) + 1, isoToDay(project.info.deadline)) -
      schedule.calendar.workdaysInclusive(isoToDay(project.info.deadline) + 1, isoToDay(schedule.projectFinish))
    : null

  // Reparto por gremio del camino crítico
  const byTrade = new Map<string, { n: number; days: number }>()
  for (const uid of path) {
    const s = schedule.byUid.get(uid)
    const t = taskOf.get(uid)?.t
    if (!s || !t || s.isMilestone) continue
    const e = byTrade.get(t.trade) ?? { n: 0, days: 0 }
    e.n++
    e.days += s.duration
    byTrade.set(t.trade, e)
  }
  const tradeSummary = [...byTrade.entries()].sort((a, b) => b[1].days - a[1].days)

  const explanation = (): string => {
    if (schedule.hasCycle) return 'Hay una dependencia circular: hasta que se elimine no puede calcularse el camino crítico.'
    if (schedule.linkCount === 0) return 'No hay vínculos entre tareas. Sin dependencias no existe un camino crítico real: añade predecesoras para que el cálculo tenga sentido.'
    const pathTasks = path.filter((u) => !schedule.byUid.get(u)?.isMilestone)
    const parts: string[] = []
    parts.push(
      `La obra dura ${schedule.projectDuration} días laborables, del ${formatES(schedule.projectStart)} al ${formatES(schedule.projectFinish)}.`
    )
    parts.push(
      `El camino crítico es la cadena de ${pathTasks.length} tareas vinculadas cuya suma de duraciones y desfases fija esa fecha de fin: ninguna tiene holgura, así que un día de retraso en cualquiera de ellas es un día de retraso en la entrega (salvo que se recupere en otra tarea crítica).`
    )
    if (tradeSummary.length) {
      const top = tradeSummary
        .slice(0, 3)
        .map(([id, v]) => `${tradeOf.get(id)?.name ?? id} (${v.n} tareas, ${v.days} d)`)
        .join(', ')
      parts.push(`Los gremios que más pesan en el camino crítico son: ${top}. Son los que hay que vigilar y no dejar sin recursos.`)
    }
    if (near.length) {
      parts.push(
        `Además hay ${near.length} tareas casi críticas (holgura ≤ ${project.nearCriticalThreshold} d): un retraso pequeño en ellas las convierte en críticas y puede cambiar el camino.`
      )
    }
    if (paths.length > 1) parts.push(`Existen ${paths.length} cadenas críticas en paralelo: cualquiera de ellas determina el fin.`)
    if (contractMargin !== null) {
      parts.push(
        contractMargin >= 0
          ? `Respecto a la fecha contractual (${formatES(project.info.deadline)}) queda un margen de ${contractMargin} días laborables.`
          : `La fecha contractual (${formatES(project.info.deadline)}) se INCUMPLE en ${-contractMargin} días laborables: hay que acortar el camino crítico (más recursos, solapes CC/FC negativos, turnos) o renegociar.`
      )
    }
    return parts.join(' ')
  }

  const sortedFloats = [...leaves].sort((a, b) => a.totalFloat - b.totalFloat || a.index - b.index)

  return (
    <aside className="side-panel">
      <header className="sp-head">
        <div className="sp-title">
          <Icon name="critical" size={18} /> Camino crítico
        </div>
        <button className="icon-btn" onClick={onClose} title="Cerrar">
          <Icon name="close" />
        </button>
      </header>

      <div className="kpis">
        <div className="kpi">
          <span>Duración</span>
          <b>{schedule.projectDuration} d</b>
          <small>laborables</small>
        </div>
        <div className="kpi">
          <span>Fin previsto</span>
          <b>{formatES(schedule.projectFinish)}</b>
          <small>desde {formatES(schedule.projectStart)}</small>
        </div>
        <div className="kpi crit">
          <span>Tareas críticas</span>
          <b>{schedule.hasCycle ? '—' : critical.length}</b>
          <small>de {leaves.length}</small>
        </div>
        <div className={`kpi ${contractMargin !== null && contractMargin < 0 ? 'bad' : ''}`}>
          <span>Margen contractual</span>
          <b>{contractMargin === null ? '—' : `${contractMargin > 0 ? '+' : ''}${contractMargin} d`}</b>
          <small>{project.info.deadline ? formatES(project.info.deadline) : 'sin fecha fijada'}</small>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="alert error">
          <Icon name="warn" />
          <div>{errors.map((e) => <p key={e.code}>{e.message}</p>)}</div>
        </div>
      )}

      <p className="explain">{explanation()}</p>

      <div className="tabs">
        <button className={tab === 'path' ? 'on' : ''} onClick={() => setTab('path')}>
          Secuencia
        </button>
        <button className={tab === 'floats' ? 'on' : ''} onClick={() => setTab('floats')}>
          Holguras
        </button>
        <button className={tab === 'issues' ? 'on' : ''} onClick={() => setTab('issues')}>
          Avisos {schedule.issues.length > 0 && <span className="count">{schedule.issues.length}</span>}
        </button>
      </div>

      <div className="sp-body">
        {tab === 'path' && (
          <>
            {paths.length > 1 && (
              <div className="path-tabs">
                {paths.map((_, i) => (
                  <button key={i} className={i === pathIdx ? 'on' : ''} onClick={() => setPathIdx(i)}>
                    Cadena {i + 1}
                  </button>
                ))}
              </div>
            )}
            {path.length === 0 && <p className="dim">No hay camino crítico que mostrar.</p>}
            <ol className="chain">
              {path.map((uid, i) => {
                const s = schedule.byUid.get(uid)
                const info = taskOf.get(uid)
                if (!s || !info) return null
                const next = path[i + 1]
                const dep = next ? taskOf.get(next)?.t.predecessors.find((d) => d.predUid === uid) : undefined
                const trade = tradeOf.get(info.t.trade)
                return (
                  <li key={uid} onClick={() => onFocusTask(uid)}>
                    <span className={`node${s.isMilestone ? ' ms' : ''}`} />
                    <div className="chain-main">
                      <div className="chain-name">
                        <span className="row-no">{info.row}</span> {info.t.name || '(sin nombre)'}
                      </div>
                      <div className="chain-meta">
                        {s.isMilestone ? `Hito · ${formatES(s.start)}` : `${formatES(s.start)} → ${formatES(s.finish)} · ${s.duration} d`}
                        {trade && !s.isMilestone && (
                          <span className="chip" style={{ borderColor: trade.color, color: trade.color }}>
                            {trade.name}
                          </span>
                        )}
                      </div>
                      {dep && (dep.type !== 'FC' || dep.lag !== 0) && (
                        <div className="chain-link">
                          ↓ con la siguiente: {LINK_TYPE_LABEL[dep.type]}
                          {dep.lag ? ` ${dep.lag > 0 ? '+' : ''}${dep.lag} d` : ''}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
            {near.length > 0 && (
              <>
                <h4>
                  Casi críticas (holgura ≤
                  <input type="number" min={0} max={60} value={project.nearCriticalThreshold} onChange={(e) => onThreshold(Math.max(0, Number(e.target.value) || 0))} className="mini-input" />
                  d)
                </h4>
                <ul className="near-list">
                  {near.map((s) => {
                    const info = taskOf.get(s.uid)
                    return (
                      <li key={s.uid} onClick={() => onFocusTask(s.uid)}>
                        <span className="row-no">{info?.row}</span>
                        <span className="nl-name">{info?.t.name}</span>
                        <span className="nl-float">{s.totalFloat} d</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            {near.length === 0 && (
              <p className="dim small">
                Sin tareas casi críticas con umbral de
                <input type="number" min={0} max={60} value={project.nearCriticalThreshold} onChange={(e) => onThreshold(Math.max(0, Number(e.target.value) || 0))} className="mini-input" />
                días.
              </p>
            )}
          </>
        )}

        {tab === 'floats' && (
          <table className="float-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Tarea</th>
                <th title="Holgura total: lo que puede retrasarse sin retrasar el fin de obra">H. total</th>
                <th title="Holgura libre: lo que puede retrasarse sin retrasar a ninguna sucesora">H. libre</th>
              </tr>
            </thead>
            <tbody>
              {sortedFloats.map((s) => {
                const info = taskOf.get(s.uid)
                return (
                  <tr key={s.uid} onClick={() => onFocusTask(s.uid)} className={s.critical ? 'crit' : s.nearCritical ? 'near' : ''}>
                    <td>{info?.row}</td>
                    <td>{info?.t.name}</td>
                    <td className="num">{schedule.hasCycle ? '—' : s.totalFloat}</td>
                    <td className="num">{schedule.hasCycle ? '—' : s.freeFloat}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {tab === 'issues' && (
          <>
            {schedule.issues.length === 0 && (
              <div className="alert ok">
                <Icon name="info" /> La lógica de la planificación no presenta avisos.
              </div>
            )}
            {schedule.issues.map((iss) => (
              <IssueCard key={iss.code} issue={iss} rowOf={(u) => taskOf.get(u)} onFocusTask={onFocusTask} />
            ))}
          </>
        )}
      </div>
    </aside>
  )
}

function IssueCard({ issue, rowOf, onFocusTask }: { issue: ScheduleIssue; rowOf: (uid: number) => { t: { name: string }; row: number } | undefined; onFocusTask(uid: number): void }) {
  return (
    <div className={`alert ${issue.level}`}>
      <Icon name={issue.level === 'info' ? 'info' : 'warn'} />
      <div>
        <p>{issue.message}</p>
        {issue.uids.length > 0 && (
          <div className="issue-tasks">
            {issue.uids.slice(0, 30).map((u) => {
              const r = rowOf(u)
              return r ? (
                <button key={u} onClick={() => onFocusTask(u)} title={r.t.name}>
                  {r.row}
                </button>
              ) : null
            })}
            {issue.uids.length > 30 && <span>… y {issue.uids.length - 30} más</span>}
          </div>
        )}
      </div>
    </div>
  )
}
