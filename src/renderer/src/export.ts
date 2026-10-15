// Exportación del diagrama a PDF (páginas A3/A4 apaisadas con cajetín) y PNG.
import { formatES, isoToDay, todayISO } from '@core/dates'
import { summaryFlags, visibleIndices } from '@core/hierarchy'
import { linkKey, type ScheduleResult } from '@core/schedule'
import type { Project } from '@core/types'
import { linkPath, type BarBox } from './geometry'
import { ticks, tiersFor } from './timescale'

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
const CRIT = '#d92d34'
const NEAR = '#e08a00'

interface Layout {
  width: number
  height: number
  rowH: number
  headerH: number
  titleH: number
  margin: number
}

const COLS = [
  { key: 'row', label: '#', w: 30, align: 'end' },
  { key: 'name', label: 'Tarea', w: 270, align: 'start' },
  { key: 'dur', label: 'Dur.', w: 40, align: 'end' },
  { key: 'start', label: 'Inicio', w: 68, align: 'start' },
  { key: 'finish', label: 'Fin', w: 68, align: 'start' },
  { key: 'float', label: 'Holg.', w: 40, align: 'end' }
] as const
const TABLE_W = COLS.reduce((a, c) => a + c.w, 0)

export interface ExportInput {
  project: Project
  schedule: ScheduleResult
  critical: boolean
  respectCollapsed: boolean
}

function rowsFor(input: ExportInput): number[] {
  return input.respectCollapsed ? visibleIndices(input.project.tasks) : input.project.tasks.map((_, i) => i)
}

/** Rango temporal que cubre el proyecto con un pequeño margen. */
function timeRange(input: ExportInput): [number, number] {
  const s = input.schedule
  let from = isoToDay(s.projectStart) - 3
  let to = isoToDay(s.projectFinish) + 6
  if (input.project.info.deadline) to = Math.max(to, isoToDay(input.project.info.deadline) + 4)
  if (to - from < 14) to = from + 14
  for (const t of s.list) if (t) from = Math.min(from, t.startDay - 1)
  return [from, to]
}

/** Dibuja una página (o la imagen completa) como SVG. */
function renderSVG(input: ExportInput, rows: number[], L: Layout, page: { n: number; total: number }): string {
  const { project, schedule, critical } = input
  const summary = summaryFlags(project.tasks)
  const [d0, d1] = timeRange(input)
  const chartX = L.margin + TABLE_W
  const chartW = L.width - L.margin - chartX
  const dw = chartW / (d1 - d0)
  const X = (d: number): number => chartX + (d - d0) * dw
  const top = L.margin + L.headerH
  const bodyH = rows.length * L.rowH
  const cal = schedule.calendar
  const trade = new Map(project.trades.map((t) => [t.id, t]))
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.width} ${L.height}" width="${L.width}" height="${L.height}" font-family="${FONT}">`)
  out.push(`<rect width="${L.width}" height="${L.height}" fill="#fff"/>`)
  out.push(
    `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5b6675"/></marker><marker id="ac" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${CRIT}"/></marker></defs>`
  )

  // Fondo: no laborables
  if (dw >= 2.5) {
    for (let d = d0; d < d1; d++) if (!cal.isWorkday(d)) out.push(`<rect x="${X(d)}" y="${top}" width="${dw}" height="${bodyH}" fill="${cal.isHoliday(d) ? '#fde8e8' : '#f1f3f6'}"/>`)
  }
  // Escala
  const [tu, bu] = tiersFor(dw)
  const hh = L.headerH / 2
  out.push(`<rect x="${L.margin}" y="${L.margin}" width="${L.width - 2 * L.margin}" height="${L.headerH}" fill="#eef1f5"/>`)
  for (const t of ticks(d0, d1, tu, dw)) {
    const x = Math.max(X(t.start), chartX)
    out.push(`<line x1="${X(t.start)}" x2="${X(t.start)}" y1="${L.margin}" y2="${top + bodyH}" stroke="#c4cad3" stroke-width="0.8"/>`)
    if (X(t.end) - x > 24) out.push(`<text x="${x + 4}" y="${L.margin + hh - 6}" font-size="10" font-weight="600" fill="#1f2937">${esc(t.label)}</text>`)
  }
  for (const t of ticks(d0, d1, bu, dw)) {
    const w = (t.end - t.start) * dw
    if (X(t.start) >= chartX) out.push(`<line x1="${X(t.start)}" x2="${X(t.start)}" y1="${L.margin + hh}" y2="${top + bodyH}" stroke="#e1e5ea" stroke-width="0.5"/>`)
    if (w >= 13 && X(t.start) >= chartX && X(t.end) <= L.width - L.margin) out.push(`<text x="${X(t.start) + w / 2}" y="${L.margin + L.headerH - 6}" font-size="${w > 22 ? 9 : 7}" text-anchor="middle" fill="#4b5563">${esc(t.label)}</text>`)
  }
  out.push(`<line x1="${chartX}" x2="${L.width - L.margin}" y1="${L.margin + hh}" y2="${L.margin + hh}" stroke="#c4cad3" stroke-width="0.8"/>`)
  // Cabecera de tabla
  let cx = L.margin
  for (const c of COLS) {
    const tx = c.align === 'end' ? cx + c.w - 5 : cx + 5
    out.push(`<text x="${tx}" y="${L.margin + L.headerH - 8}" font-size="10" font-weight="700" fill="#1f2937" text-anchor="${c.align}">${c.label}</text>`)
    cx += c.w
  }

  // Filas
  const geo = new Map<number, BarBox & { pos: number }>()
  rows.forEach((idx, pos) => {
    const t = project.tasks[idx]
    const s = schedule.list[idx]
    if (!s) return
    const cy = top + pos * L.rowH + L.rowH / 2
    if (s.isMilestone) geo.set(t.uid, { x1: X(s.milestoneAt) - 5, x2: X(s.milestoneAt) + 5, cy, pos })
    else geo.set(t.uid, { x1: X(s.startDay), x2: X(s.finishDay + 1), cy, pos })
  })
  rows.forEach((idx, pos) => {
    const t = project.tasks[idx]
    const s = schedule.list[idx]
    const y = top + pos * L.rowH
    if (pos % 2 === 1) out.push(`<rect x="${L.margin}" y="${y}" width="${TABLE_W}" height="${L.rowH}" fill="#f8fafc"/>`)
    out.push(`<line x1="${L.margin}" x2="${L.width - L.margin}" y1="${y + L.rowH}" y2="${y + L.rowH}" stroke="#e5e7eb" stroke-width="0.5"/>`)
    const isCrit = critical && s?.critical && !schedule.hasCycle
    const fs = Math.min(10, L.rowH * 0.55)
    const ty = y + L.rowH / 2 + fs * 0.36
    const color = isCrit ? CRIT : '#111827'
    const weight = summary[idx] ? 700 : 400
    let x = L.margin
    for (const c of COLS) {
      let v = ''
      if (c.key === 'row') v = String(idx + 1)
      if (c.key === 'name') v = t.name
      if (c.key === 'dur') v = s ? `${s.duration}d` : ''
      if (c.key === 'start') v = s ? formatES(s.start) : ''
      if (c.key === 'finish') v = s ? formatES(s.finish) : ''
      if (c.key === 'float') v = s && !summary[idx] && !schedule.hasCycle ? String(s.totalFloat) : ''
      const indent = c.key === 'name' ? t.level * 10 : 0
      const maxChars = Math.floor((c.w - indent - 8) / (fs * 0.52))
      if (v.length > maxChars) v = v.slice(0, Math.max(1, maxChars - 1)) + '…'
      const tx = c.align === 'end' ? x + c.w - 5 : x + 5 + indent
      out.push(`<text x="${tx}" y="${ty}" font-size="${fs}" font-weight="${weight}" fill="${c.key === 'row' ? '#6b7280' : color}" text-anchor="${c.align}">${esc(v)}</text>`)
      x += c.w
    }
    if (!s) return
    const g = geo.get(t.uid) as BarBox
    const bh = L.rowH * 0.5
    const by = y + (L.rowH - bh) / 2
    if (summary[idx]) {
      const fill = isCrit ? CRIT : '#334155'
      const w = Math.max(1.5, g.x2 - g.x1)
      out.push(`<rect x="${g.x1}" y="${by + 1}" width="${w}" height="${bh * 0.45}" fill="${fill}"/>`)
      out.push(`<path d="M${g.x1} ${by + 1 + bh * 0.45} l0 ${bh * 0.4} l${bh * 0.4} ${-bh * 0.4}z M${g.x1 + w} ${by + 1 + bh * 0.45} l0 ${bh * 0.4} l${-bh * 0.4} ${-bh * 0.4}z" fill="${fill}"/>`)
    } else if (s.isMilestone) {
      const mx = (g.x1 + g.x2) / 2
      const r = bh * 0.7
      out.push(`<path d="M${mx} ${g.cy - r}L${mx + r} ${g.cy}L${mx} ${g.cy + r}L${mx - r} ${g.cy}z" fill="${isCrit ? CRIT : '#111827'}"/>`)
      out.push(`<text x="${mx + r + 3}" y="${g.cy + 3}" font-size="${fs - 1}" fill="#374151">${formatES(s.start)}</text>`)
    } else {
      const base = trade.get(t.trade)?.color ?? '#6b7a8f'
      const fill = critical ? (isCrit ? CRIT : s.nearCritical ? NEAR : base) : base
      const w = Math.max(1.5, g.x2 - g.x1)
      if (critical && s.totalFloat > 0 && !schedule.hasCycle) {
        const lx = X(isoToDay(s.lateFinish) + 1)
        out.push(`<line x1="${g.x2}" x2="${lx}" y1="${by + bh + 2}" y2="${by + bh + 2}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="2 2"/>`)
      }
      out.push(`<rect x="${g.x1}" y="${by}" width="${w}" height="${bh}" rx="2" fill="${fill}"/>`)
      if (t.progress > 0) out.push(`<rect x="${g.x1}" y="${by + bh * 0.35}" width="${(w * t.progress) / 100}" height="${bh * 0.3}" fill="#000" fill-opacity="0.35"/>`)
    }
  })

  // Vínculos
  for (const idx of rows) {
    const t = project.tasks[idx]
    const g = geo.get(t.uid)
    if (!g || summary[idx]) continue
    for (const d of t.predecessors) {
      const p = geo.get(d.predUid)
      if (!p) continue
      const c = critical && schedule.criticalLinks.has(linkKey(d.predUid, t.uid))
      out.push(`<path d="${linkPath(p, g, d.type, L.rowH)}" fill="none" stroke="${c ? CRIT : '#5b6675'}" stroke-width="${c ? 1.2 : 0.7}" marker-end="url(#${c ? 'ac' : 'a'})"/>`)
    }
  }

  // Hoy y fecha contractual
  const today = isoToDay(todayISO())
  if (today >= d0 && today < d1) out.push(`<line x1="${X(today) + dw / 2}" x2="${X(today) + dw / 2}" y1="${top}" y2="${top + bodyH}" stroke="#2563eb" stroke-width="1" stroke-dasharray="4 3"/>`)
  if (project.info.deadline) {
    const dx = X(isoToDay(project.info.deadline) + 1)
    out.push(`<line x1="${dx}" x2="${dx}" y1="${top}" y2="${top + bodyH}" stroke="#7c3aed" stroke-width="1.2" stroke-dasharray="6 3"/>`)
  }

  // Marco
  out.push(`<rect x="${L.margin}" y="${L.margin}" width="${L.width - 2 * L.margin}" height="${L.headerH + bodyH}" fill="none" stroke="#9aa3ae" stroke-width="0.8"/>`)
  out.push(`<line x1="${chartX}" x2="${chartX}" y1="${L.margin}" y2="${top + bodyH}" stroke="#9aa3ae" stroke-width="0.8"/>`)

  // Cajetín
  out.push(titleBlock(input, L, page))
  out.push('</svg>')
  return out.join('')
}

function titleBlock(input: ExportInput, L: Layout, page: { n: number; total: number }): string {
  const { project, schedule, critical } = input
  const i = project.info
  const y = L.height - L.margin - L.titleH
  const w = L.width - 2 * L.margin
  const cells: [string, string, number][] = [
    ['PLANIFICACIÓN DE OBRA', i.name || 'Sin nombre', 0.3],
    ['Cliente / promotor', i.client, 0.14],
    ['Emplazamiento', i.location, 0.12],
    ['Jefe de obra', i.manager, 0.12],
    ['Plazo', `${formatES(schedule.projectStart)} → ${formatES(schedule.projectFinish)} (${schedule.projectDuration} d lab.)`, 0.16],
    ['Emisión · Revisión', `${formatES(todayISO())} · ${i.revision}`, 0.1],
    ['Hoja', `${page.n} / ${page.total}`, 0.06]
  ]
  const out: string[] = [`<g font-family="${FONT}">`]
  out.push(`<rect x="${L.margin}" y="${y}" width="${w}" height="${L.titleH}" fill="#fff" stroke="#374151" stroke-width="1"/>`)
  let x = L.margin
  const hTop = L.titleH * 0.62
  for (const [label, value, frac] of cells) {
    const cw = w * frac
    out.push(`<line x1="${x}" x2="${x}" y1="${y}" y2="${y + hTop}" stroke="#374151" stroke-width="0.8"/>`)
    out.push(`<text x="${x + 6}" y="${y + 12}" font-size="7.5" fill="#6b7280" letter-spacing="0.3">${esc(label.toUpperCase())}</text>`)
    const big = label === 'PLANIFICACIÓN DE OBRA'
    const maxChars = Math.floor((cw - 12) / (big ? 7.2 : 5.6))
    const v = value.length > maxChars ? value.slice(0, maxChars - 1) + '…' : value
    out.push(`<text x="${x + 6}" y="${y + (big ? 31 : 28)}" font-size="${big ? 13 : 10}" font-weight="${big ? 700 : 600}" fill="#111827">${esc(v)}</text>`)
    x += cw
  }
  out.push(`<line x1="${L.margin}" x2="${L.margin + w}" y1="${y + hTop}" y2="${y + hTop}" stroke="#374151" stroke-width="0.8"/>`)
  // Leyenda
  const ly = y + hTop + (L.titleH - hTop) / 2
  let lx = L.margin + 8
  const legend = (svg: string, text: string): void => {
    out.push(svg.replace(/\{x\}/g, String(lx)).replace(/\{y\}/g, String(ly)))
    out.push(`<text x="${lx + 22}" y="${ly + 3.5}" font-size="9" fill="#374151">${esc(text)}</text>`)
    lx += 30 + text.length * 5.2
  }
  if (critical) legend(`<rect x="{x}" y="${ly - 4}" width="16" height="8" rx="2" fill="${CRIT}"/>`, 'Tarea crítica')
  if (critical) legend(`<rect x="{x}" y="${ly - 4}" width="16" height="8" rx="2" fill="${NEAR}"/>`, 'Casi crítica')
  for (const t of project.trades.filter((tr) => project.tasks.some((x) => x.trade === tr.id))) {
    legend(`<rect x="{x}" y="${ly - 4}" width="16" height="8" rx="2" fill="${t.color}"/>`, t.name)
  }
  legend(`<path d="M${lx + 8} ${ly - 5}l5 5l-5 5l-5-5z" fill="#111827"/>`, 'Hito')
  if (critical) legend(`<line x1="{x}" x2="${lx + 16}" y1="${ly}" y2="${ly}" stroke="#9ca3af" stroke-dasharray="2 2"/>`, 'Holgura total')
  legend(`<line x1="${lx + 8}" x2="${lx + 8}" y1="${ly - 6}" y2="${ly + 6}" stroke="#2563eb" stroke-dasharray="3 2"/>`, 'Hoy')
  if (project.info.deadline) legend(`<line x1="${lx + 8}" x2="${lx + 8}" y1="${ly - 6}" y2="${ly + 6}" stroke="#7c3aed" stroke-dasharray="4 2"/>`, `Fecha contractual ${formatES(project.info.deadline)}`)
  out.push('</g>')
  return out.join('')
}

const PAGE_PX = { A3: { w: 1587, h: 1123 }, A4: { w: 1123, h: 794 } }

export function buildPdfHtml(input: ExportInput, pageSize: 'A3' | 'A4'): string {
  const { w, h } = PAGE_PX[pageSize]
  const L: Layout = { width: w, height: h, rowH: pageSize === 'A3' ? 18 : 16, headerH: 34, titleH: 66, margin: 22 }
  const rows = rowsFor(input)
  const avail = h - 2 * L.margin - L.headerH - L.titleH - 6
  // Si cabe en una hoja, se aprovecha el alto disponible con filas algo mayores (máx. 26 px)
  if (rows.length * L.rowH < avail) L.rowH = Math.min(26, Math.floor(avail / Math.max(1, rows.length)))
  const perPage = Math.max(1, Math.floor(avail / L.rowH))
  const pages: number[][] = []
  for (let i = 0; i < Math.max(rows.length, 1); i += perPage) pages.push(rows.slice(i, i + perPage))
  const mm = pageSize === 'A3' ? { w: 420, h: 297 } : { w: 297, h: 210 }
  const body = pages.map((r, i) => `<div class="page">${renderSVG(input, r, L, { n: i + 1, total: pages.length })}</div>`).join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(input.project.info.name)}</title><style>
@page { size: ${pageSize} landscape; margin: 0 }
html, body { margin: 0; padding: 0; background: #fff }
.page { width: ${mm.w}mm; height: ${mm.h}mm; overflow: hidden; page-break-after: always; break-after: page }
.page:last-child { page-break-after: auto; break-after: auto }
.page svg { width: 100%; height: 100%; display: block }
</style></head><body>${body}</body></html>`
}

/** PNG de alta resolución con todas las filas. Devuelve base64 (sin cabecera data:). */
export async function buildPng(input: ExportInput): Promise<string> {
  const rows = rowsFor(input)
  const L: Layout = { width: 2400, height: 0, rowH: 22, headerH: 40, titleH: 70, margin: 24 }
  L.height = 2 * L.margin + L.headerH + rows.length * L.rowH + L.titleH + 10
  const svg = renderSVG(input, rows, L, { n: 1, total: 1 })
  const img = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('No se pudo generar la imagen'))
      img.src = url
    })
    const scale = L.height * 2 * L.width * 2 > 200_000_000 ? 1 : 2
    const canvas = document.createElement('canvas')
    canvas.width = L.width * scale
    canvas.height = L.height * scale
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL('image/png').split(',')[1]
  } finally {
    URL.revokeObjectURL(url)
  }
}
