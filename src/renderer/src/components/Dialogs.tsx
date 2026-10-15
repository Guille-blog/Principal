// Diálogos: datos de obra, calendario laboral, gremios, tarea, exportación y ayuda.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatES, isoToDay, parseDateES, weekdayName, weekdayOfDay } from '@core/dates'
import { mergeHolidays, spanishNationalHolidays, sundayHolidays } from '@core/holidays'
import { formatDependency, LINK_TYPE_LABEL } from '@core/predecessors'
import type { ScheduleResult } from '@core/schedule'
import type { Dependency, Holiday, LinkType, Project, ProjectInfo, Task, Trade } from '@core/types'
import { Icon } from './Icon'

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose(): void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-label={title}>
        <header>
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} title="Cerrar">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  )
}

function DateInput({ value, onChange, allowEmpty, refYear }: { value?: string; onChange(v: string | undefined): void; allowEmpty?: boolean; refYear: number }) {
  const [text, setText] = useState(formatES(value))
  const [bad, setBad] = useState(false)
  useEffect(() => setText(formatES(value)), [value])
  return (
    <input
      className={bad ? 'bad' : ''}
      value={text}
      placeholder="dd/mm/aaaa"
      onChange={(e) => {
        setText(e.target.value)
        if (!e.target.value.trim() && allowEmpty) {
          setBad(false)
          onChange(undefined)
          return
        }
        const d = parseDateES(e.target.value, refYear)
        setBad(!d)
        if (d) onChange(d)
      }}
    />
  )
}

// ---------------- Datos de la obra ----------------
export function ProjectInfoDialog({ project, onSave, onClose }: { project: Project; onSave(info: ProjectInfo): void; onClose(): void }) {
  const [info, setInfo] = useState(project.info)
  const y = Number(info.start.slice(0, 4))
  const set = (k: keyof ProjectInfo, v: string | undefined): void => setInfo({ ...info, [k]: v })
  return (
    <Modal
      title="Datos de la obra"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={() => onSave(info)}>
            Aceptar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label>Obra / proyecto</label>
        <input value={info.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        <label>Cliente / promotor</label>
        <input value={info.client} onChange={(e) => set('client', e.target.value)} />
        <label>Emplazamiento</label>
        <input value={info.location} onChange={(e) => set('location', e.target.value)} />
        <label>Jefe de obra</label>
        <input value={info.manager} onChange={(e) => set('manager', e.target.value)} />
        <label>Revisión</label>
        <input value={info.revision} onChange={(e) => set('revision', e.target.value)} />
        <label>Inicio del proyecto</label>
        <DateInput value={info.start} onChange={(v) => v && set('start', v)} refYear={y} />
        <label>Fecha contractual de fin</label>
        <DateInput value={info.deadline} onChange={(v) => set('deadline', v)} allowEmpty refYear={y} />
      </div>
      <p className="hint">
        La fecha de inicio se usa para las tareas sin predecesoras nuevas y como límite inferior del cálculo. Si fijas una fecha contractual y la planificación
        la supera, verás holguras negativas y el aviso correspondiente.
      </p>
    </Modal>
  )
}

// ---------------- Calendario laboral ----------------
export function CalendarDialog({ project, schedule, onSave, onClose }: { project: Project; schedule: ScheduleResult; onSave(workWeek: boolean[], holidays: Holiday[]): void; onClose(): void }) {
  const [week, setWeek] = useState(project.calendar.workWeek)
  const [hols, setHols] = useState<Holiday[]>(project.calendar.holidays)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [err, setErr] = useState('')
  const startYear = Number(schedule.projectStart.slice(0, 4))
  const endYear = Number(schedule.projectFinish.slice(0, 4))
  const sundays = useMemo(() => sundayHolidays(hols), [hols])

  const add = (): void => {
    const d = parseDateES(newDate, startYear)
    if (!d) return setErr('Fecha no válida')
    if (hols.some((h) => h.date === d)) return setErr('Ese día ya está en la lista')
    setHols([...hols, { date: d, name: newName.trim() || 'Festivo' }].sort((a, b) => a.date.localeCompare(b.date)))
    setNewDate('')
    setNewName('')
    setErr('')
  }
  const loadNational = (): void => {
    let list = hols
    for (let y = startYear; y <= Math.max(endYear, startYear + 1); y++) list = mergeHolidays(list, spanishNationalHolidays(y))
    setHols(list)
  }
  const order = [1, 2, 3, 4, 5, 6, 0]
  return (
    <Modal
      title="Calendario laboral"
      wide
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={!week.some(Boolean)} onClick={() => onSave(week, hols)}>
            Aplicar
          </button>
        </>
      }
    >
      <h4>Semana laboral</h4>
      <div className="week-row">
        {order.map((d) => (
          <label key={d} className={`day-toggle${week[d] ? ' on' : ''}`}>
            <input type="checkbox" checked={week[d]} onChange={(e) => setWeek(week.map((v, i) => (i === d ? e.target.checked : v)))} />
            {weekdayName(d)}
          </label>
        ))}
      </div>
      <h4>
        Festivos <span className="dim">({hols.length})</span>
      </h4>
      <div className="hol-actions">
        <button onClick={loadNational}>
          <Icon name="calendar" /> Cargar festivos nacionales {startYear}
          {endYear > startYear ? `–${endYear}` : ''}
        </button>
        <button onClick={() => setHols([])} disabled={!hols.length}>
          Vaciar lista
        </button>
      </div>
      <div className="alert warning">
        <Icon name="warn" />
        <p>
          Los festivos nacionales se generan automáticamente (incluido Viernes Santo). Debes <b>revisarlos con el BOE</b> del año y <b>añadir los festivos
          autonómicos y locales</b> del municipio de la obra (2 locales + los de la comunidad). Algunas comunidades trasladan al lunes los festivos que caen en
          domingo{sundays.length ? ` (este año: ${sundays.map((h) => formatES(h.date)).join(', ')})` : ''}.
        </p>
      </div>
      <div className="hol-add">
        <input value={newDate} onChange={(e) => setNewDate(e.target.value)} placeholder="dd/mm/aaaa" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre (p. ej. San Isidro — local)" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="primary" onClick={add}>
          <Icon name="plus" /> Añadir
        </button>
        {err && <span className="err">{err}</span>}
      </div>
      <div className="hol-list">
        {hols.map((h) => {
          const wd = weekdayOfDay(isoToDay(h.date))
          return (
            <div key={h.date} className={`hol-item${!week[wd] ? ' off' : ''}`}>
              <span className="hol-date">{formatES(h.date)}</span>
              <span className="hol-wd">{weekdayName(wd)}</span>
              <input value={h.name} onChange={(e) => setHols(hols.map((x) => (x.date === h.date ? { ...x, name: e.target.value } : x)))} />
              <button className="icon-btn" title="Quitar" onClick={() => setHols(hols.filter((x) => x.date !== h.date))}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          )
        })}
        {!hols.length && <p className="dim">Sin festivos. Ojo: el plazo calculado no descontará ningún festivo.</p>}
      </div>
    </Modal>
  )
}

// ---------------- Gremios ----------------
export function TradesDialog({ project, onSave, onClose }: { project: Project; onSave(trades: Trade[]): void; onClose(): void }) {
  const [trades, setTrades] = useState(project.trades)
  const used = new Set(project.tasks.map((t) => t.trade))
  return (
    <Modal
      title="Gremios y subcontratas"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={!trades.length || trades.some((t) => !t.name.trim())} onClick={() => onSave(trades)}>
            Aceptar
          </button>
        </>
      }
    >
      <div className="trade-list">
        {trades.map((t) => (
          <div key={t.id} className="trade-item">
            <input type="color" value={t.color} onChange={(e) => setTrades(trades.map((x) => (x.id === t.id ? { ...x, color: e.target.value } : x)))} />
            <input value={t.name} onChange={(e) => setTrades(trades.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))} />
            <button
              className="icon-btn"
              disabled={used.has(t.id) || trades.length === 1}
              title={used.has(t.id) ? 'En uso por alguna tarea' : 'Eliminar'}
              onClick={() => setTrades(trades.filter((x) => x.id !== t.id))}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => setTrades([...trades, { id: `g${Date.now().toString(36)}`, name: 'Nuevo gremio', color: '#3b82f6' }])}>
        <Icon name="plus" /> Añadir gremio / subcontrata
      </button>
    </Modal>
  )
}

// ---------------- Tarea (detalle) ----------------
export function TaskDialog({
  project,
  schedule,
  task,
  isSummary,
  onSave,
  onClose
}: {
  project: Project
  schedule: ScheduleResult
  task: Task
  isSummary: boolean
  onSave(t: Task): string | null
  onClose(): void
}) {
  const [t, setT] = useState<Task>(task)
  const [error, setError] = useState<string | null>(null)
  const s = schedule.byUid.get(task.uid)
  const rows = useMemo(() => new Map(project.tasks.map((x, i) => [x.uid, i])), [project.tasks])
  const candidates = project.tasks.filter((x, i) => x.uid !== task.uid && !(i + 1 < project.tasks.length && project.tasks[i + 1].level > x.level))
  const y = Number(project.info.start.slice(0, 4))
  const setDep = (i: number, patch: Partial<Dependency>): void => setT({ ...t, predecessors: t.predecessors.map((d, k) => (k === i ? { ...d, ...patch } : d)) })
  return (
    <Modal
      title={`Tarea ${(rows.get(task.uid) ?? 0) + 1}${s ? ` · EDT ${s.wbs}` : ''}`}
      wide
      onClose={onClose}
      footer={
        <>
          {error && <span className="err">{error}</span>}
          <button onClick={onClose}>Cancelar</button>
          <button
            className="primary"
            onClick={() => {
              const e = onSave(t)
              if (e) setError(e)
            }}
          >
            Aceptar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label>Nombre</label>
        <input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} autoFocus />
        {!isSummary && (
          <>
            <label>Duración (días lab.)</label>
            <input type="number" min={0} value={t.duration} onChange={(e) => setT({ ...t, duration: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
            <label>{t.predecessors.length ? 'No comenzar antes de' : 'Inicio'}</label>
            <div className="inline">
              <DateInput value={t.start} onChange={(v) => v && setT({ ...t, start: v, constraint: t.predecessors.length ? 'snet' : 'asap' })} refYear={y} />
              {t.constraint === 'snet' && (
                <button onClick={() => setT({ ...t, constraint: 'asap' })} title="La tarea se programará lo antes posible según sus predecesoras">
                  Quitar restricción
                </button>
              )}
            </div>
            <label>Gremio</label>
            <select value={t.trade} onChange={(e) => setT({ ...t, trade: e.target.value })}>
              {project.trades.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>
          </>
        )}
        <label>Responsable</label>
        <input value={t.responsible} onChange={(e) => setT({ ...t, responsible: e.target.value })} />
        <label>% avance</label>
        <input type="number" min={0} max={100} value={t.progress} onChange={(e) => setT({ ...t, progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
        <label>Fecha límite</label>
        <DateInput value={t.deadline} onChange={(v) => setT({ ...t, deadline: v })} allowEmpty refYear={y} />
        <label>Notas</label>
        <textarea rows={3} value={t.notes} onChange={(e) => setT({ ...t, notes: e.target.value })} />
      </div>
      {!isSummary && (
        <>
          <h4>Predecesoras</h4>
          <table className="dep-table">
            <thead>
              <tr>
                <th>Tarea</th>
                <th>Tipo</th>
                <th>Desfase (d)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {t.predecessors.map((d, i) => (
                <tr key={i}>
                  <td>
                    <select value={d.predUid} onChange={(e) => setDep(i, { predUid: Number(e.target.value) })}>
                      {candidates.map((c) => (
                        <option key={c.uid} value={c.uid}>
                          {(rows.get(c.uid) ?? 0) + 1} · {c.name || '(sin nombre)'}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={d.type} onChange={(e) => setDep(i, { type: e.target.value as LinkType })}>
                      {(Object.keys(LINK_TYPE_LABEL) as LinkType[]).map((k) => (
                        <option key={k} value={k}>
                          {k} — {LINK_TYPE_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="number" value={d.lag} onChange={(e) => setDep(i, { lag: Math.round(Number(e.target.value) || 0) })} />
                  </td>
                  <td>
                    <button className="icon-btn" onClick={() => setT({ ...t, predecessors: t.predecessors.filter((_, k) => k !== i) })} title="Quitar">
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            disabled={!candidates.length}
            onClick={() => {
              const used = new Set(t.predecessors.map((d) => d.predUid))
              const c = candidates.find((x) => !used.has(x.uid))
              if (c) setT({ ...t, predecessors: [...t.predecessors, { predUid: c.uid, type: 'FC', lag: 0 }] })
            }}
          >
            <Icon name="plus" /> Añadir predecesora
          </button>
          <p className="hint">
            Notación rápida en la tabla: {t.predecessors.map((d) => formatDependency(d, rows)).join(';') || '—'} · FC fin-comienzo, CC comienzo-comienzo, FF
            fin-fin, CF comienzo-fin. Desfase negativo = solape.
          </p>
        </>
      )}
      {s && !s.isSummary && !schedule.hasCycle && (
        <div className="calc-box">
          <div>
            <span>Inicio temprano</span>
            <b>{formatES(s.start)}</b>
          </div>
          <div>
            <span>Fin temprano</span>
            <b>{formatES(s.finish)}</b>
          </div>
          <div>
            <span>Inicio tardío</span>
            <b>{formatES(s.lateStart)}</b>
          </div>
          <div>
            <span>Fin tardío</span>
            <b>{formatES(s.lateFinish)}</b>
          </div>
          <div>
            <span>Holgura total</span>
            <b className={s.totalFloat <= 0 ? 'crit-txt' : ''}>{s.totalFloat} d</b>
          </div>
          <div>
            <span>Holgura libre</span>
            <b>{s.freeFloat} d</b>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ---------------- Exportar ----------------
export interface ExportOptions {
  format: 'pdf' | 'png'
  pageSize: 'A3' | 'A4'
  critical: boolean
  collapsed: boolean
}

export function ExportDialog({ initial, onExport, onClose }: { initial: ExportOptions; onExport(o: ExportOptions): void; onClose(): void }) {
  const [o, setO] = useState(initial)
  return (
    <Modal
      title="Exportar diagrama"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={() => onExport(o)}>
            <Icon name="export" /> Exportar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label>Formato</label>
        <div className="seg">
          <button className={o.format === 'pdf' ? 'on' : ''} onClick={() => setO({ ...o, format: 'pdf' })}>
            PDF
          </button>
          <button className={o.format === 'png' ? 'on' : ''} onClick={() => setO({ ...o, format: 'png' })}>
            PNG
          </button>
        </div>
        {o.format === 'pdf' && (
          <>
            <label>Papel (apaisado)</label>
            <div className="seg">
              <button className={o.pageSize === 'A3' ? 'on' : ''} onClick={() => setO({ ...o, pageSize: 'A3' })}>
                A3
              </button>
              <button className={o.pageSize === 'A4' ? 'on' : ''} onClick={() => setO({ ...o, pageSize: 'A4' })}>
                A4
              </button>
            </div>
          </>
        )}
        <label>Resaltar camino crítico</label>
        <input type="checkbox" checked={o.critical} onChange={(e) => setO({ ...o, critical: e.target.checked })} />
        <label>Respetar capítulos plegados</label>
        <input type="checkbox" checked={o.collapsed} onChange={(e) => setO({ ...o, collapsed: e.target.checked })} />
      </div>
      <p className="hint">Incluye cajetín con obra, cliente, jefe de obra, fecha de emisión y revisión (edítalos en Archivo › Datos de la obra).</p>
    </Modal>
  )
}

// ---------------- Ayuda ----------------
export function HelpDialog({ onClose }: { onClose(): void }) {
  const keys: [string, string][] = [
    ['Flechas, Tab, Inicio/Fin, AvPág/RePág', 'Moverse por la tabla'],
    ['Enter o F2 / escribir directamente', 'Editar la celda (Enter confirma y baja, Tab confirma y avanza, Esc cancela)'],
    ['Supr', 'Vaciar la celda (o borrar tareas si están seleccionadas desde la columna #)'],
    ['Insert', 'Insertar tarea encima'],
    ['Alt+Mayús+→ / ←', 'Aumentar / reducir sangría (crear capítulos)'],
    ['Alt+Mayús+↑ / ↓', 'Mover tarea arriba / abajo'],
    ['Ctrl+Z / Ctrl+Y', 'Deshacer / rehacer (ilimitado)'],
    ['Ctrl+C / Ctrl+V', 'Copiar / pegar tareas o pegar celdas desde Excel'],
    ['Ctrl+F2', 'Vincular tareas seleccionadas en cadena (FC)'],
    ['F9', 'Mostrar camino crítico'],
    ['Ctrl+rueda', 'Zoom en el diagrama'],
    ['Ctrl+S / Ctrl+O / Ctrl+N', 'Guardar / abrir / nuevo'],
    ['Ctrl+P', 'Exportar a PDF']
  ]
  return (
    <Modal title="Atajos y ayuda rápida" wide onClose={onClose}>
      <table className="keys">
        <tbody>
          {keys.map(([k, v]) => (
            <tr key={k}>
              <td>
                <kbd>{k}</kbd>
              </td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>Predecesoras</h4>
      <p>
        Escribe el número de fila de la tarea anterior: <code>3</code>. Con tipo y desfase: <code>3FC+2d</code> (espera 2 días), <code>4CC</code> (empiezan
        juntas), <code>5FF-1d</code> (acaba 1 día antes que la 5), <code>6CF</code>. Varias separadas con <code>;</code>.
      </p>
      <h4>En el diagrama</h4>
      <p>Arrastra una barra para moverla, su borde derecho para cambiar la duración y el círculo de su extremo hasta otra barra para vincularlas.</p>
      <p>
        Mover a mano una tarea que tiene predecesoras le pone una restricción <b>"No comenzar antes de"</b> (icono de chincheta). Puede ocultar el camino
        crítico real; quítala con el botón <b>Quitar restricción</b>.
      </p>
    </Modal>
  )
}
