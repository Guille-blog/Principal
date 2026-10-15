// Acceso a las funciones de escritorio. Si la interfaz se ejecuta en un navegador (modo `npm run web`),
// se usa una implementación alternativa con descargas y localStorage.

export interface OpenResult {
  path: string
  content: string
}

export interface DesktopApi {
  openFile(): Promise<OpenResult | null>
  openPath(path: string): Promise<OpenResult | { error: string }>
  saveFile(path: string | null, content: string, suggestedName: string): Promise<string | null>
  getRecent(): Promise<string[]>
  getLaunchFile(): Promise<OpenResult | { error: string } | null>
  setDirty(dirty: boolean, title: string): void
  closeNow(): void
  writeRecovery(content: string): void
  clearRecovery(): void
  readRecovery(): Promise<{ content: string; mtime: number } | null>
  exportPDF(html: string, pageSize: 'A3' | 'A4', suggestedName: string): Promise<string | null>
  exportPNG(base64: string, suggestedName: string): Promise<string | null>
  onMenu(cb: (cmd: string, arg?: string) => void): () => void
}

declare global {
  interface Window {
    api?: DesktopApi
  }
}

const RECOVERY_KEY = 'gantt-obra:recuperacion'

function download(name: string, blob: Blob): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

const browserApi: DesktopApi = {
  openFile: () =>
    new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json,application/json'
      input.onchange = async () => {
        const f = input.files?.[0]
        resolve(f ? { path: f.name, content: await f.text() } : null)
      }
      input.click()
    }),
  openPath: async (path) => ({ error: `No disponible en el navegador: ${path}` }),
  saveFile: async (path, content, suggestedName) => {
    const name = path ?? `${suggestedName || 'proyecto'}.gantt.json`
    download(name, new Blob([content], { type: 'application/json' }))
    try {
      localStorage.removeItem(RECOVERY_KEY)
    } catch {
      /* sin almacenamiento */
    }
    return name
  },
  getRecent: async () => [],
  getLaunchFile: async () => null,
  setDirty: (_dirty, title) => {
    document.title = title
  },
  closeNow: () => window.close(),
  writeRecovery: (content) => {
    try {
      localStorage.setItem(RECOVERY_KEY, JSON.stringify({ content, mtime: Date.now() }))
    } catch {
      /* sin almacenamiento */
    }
  },
  clearRecovery: () => {
    try {
      localStorage.removeItem(RECOVERY_KEY)
    } catch {
      /* sin almacenamiento */
    }
  },
  readRecovery: async () => {
    try {
      const raw = localStorage.getItem(RECOVERY_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  exportPDF: async (html) => {
    const w = window.open('', '_blank')
    if (!w) return null
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 300)
    return 'impresión'
  },
  exportPNG: async (base64, suggestedName) => {
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    download(`${suggestedName}.png`, new Blob([bytes], { type: 'image/png' }))
    return `${suggestedName}.png`
  },
  onMenu: () => () => undefined
}

export const api: DesktopApi = window.api ?? browserApi
export const isDesktop = Boolean(window.api)
