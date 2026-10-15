// Proceso principal de Electron: ventana, menú en español, archivos, exportación y protección ante cierre.
import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { existsSync, promises as fs } from 'node:fs'
import { join, basename } from 'node:path'
import { tmpdir } from 'node:os'

const FILE_FILTERS = [{ name: 'Proyecto Gantt Obra', extensions: ['gantt.json', 'json'] }]
const MAX_RECENT = 10

let win: BrowserWindow | null = null
let dirty = false
let forceClose = false
let launchFile: string | null = findFileArg(process.argv)

const userFile = (name: string): string => join(app.getPath('userData'), name)
const recoveryPath = (): string => userFile('recuperacion.gantt.json')

function findFileArg(argv: string[]): string | null {
  const f = argv.slice(1).find((a) => /\.json$/i.test(a) && existsSync(a))
  return f ?? null
}

async function readRecent(): Promise<string[]> {
  try {
    const list = JSON.parse(await fs.readFile(userFile('recientes.json'), 'utf8'))
    return Array.isArray(list) ? list.filter((p) => typeof p === 'string' && existsSync(p)) : []
  } catch {
    return []
  }
}

async function addRecent(path: string): Promise<void> {
  const list = [path, ...(await readRecent()).filter((p) => p !== path)].slice(0, MAX_RECENT)
  await fs.writeFile(userFile('recientes.json'), JSON.stringify(list), 'utf8')
  app.addRecentDocument(path)
  await buildMenu()
}

function send(cmd: string, arg?: string): void {
  win?.webContents.send('menu', cmd, arg)
}

async function buildMenu(): Promise<void> {
  const recent = await readRecent()
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Nuevo proyecto', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'Abrir proyecto de ejemplo', click: () => send('sample') },
        { label: 'Abrir…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        {
          label: 'Abrir reciente',
          submenu: recent.length
            ? recent.map((p) => ({ label: p, click: () => send('open-path', p) }))
            : [{ label: '(vacío)', enabled: false }]
        },
        { type: 'separator' },
        { label: 'Guardar', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'Guardar como…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('save-as') },
        { type: 'separator' },
        { label: 'Exportar a PDF…', accelerator: 'CmdOrCtrl+P', click: () => send('export-pdf') },
        { label: 'Exportar a PNG…', click: () => send('export-png') },
        { type: 'separator' },
        { label: 'Datos de la obra…', click: () => send('project-info') },
        { label: 'Calendario laboral…', click: () => send('calendar') },
        { label: 'Gremios…', click: () => send('trades') },
        { type: 'separator' },
        { label: 'Salir', role: 'quit' }
      ]
    },
    {
      label: 'Edición',
      submenu: [
        { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', click: () => send('undo'), registerAccelerator: false },
        { label: 'Rehacer', accelerator: 'CmdOrCtrl+Y', click: () => send('redo'), registerAccelerator: false },
        { type: 'separator' },
        { label: 'Insertar tarea', accelerator: 'Insert', click: () => send('insert'), registerAccelerator: false },
        { label: 'Insertar hito', click: () => send('insert-milestone') },
        { label: 'Eliminar tarea', click: () => send('delete') },
        { label: 'Aumentar sangría', accelerator: 'Alt+Shift+Right', click: () => send('indent'), registerAccelerator: false },
        { label: 'Reducir sangría', accelerator: 'Alt+Shift+Left', click: () => send('outdent'), registerAccelerator: false },
        { label: 'Mover arriba', accelerator: 'Alt+Shift+Up', click: () => send('move-up'), registerAccelerator: false },
        { label: 'Mover abajo', accelerator: 'Alt+Shift+Down', click: () => send('move-down'), registerAccelerator: false },
        { type: 'separator' },
        { label: 'Vincular tareas seleccionadas', accelerator: 'CmdOrCtrl+F2', click: () => send('link'), registerAccelerator: false },
        { label: 'Desvincular tareas', click: () => send('unlink') },
        { label: 'Quitar restricción de fecha', click: () => send('clear-constraint') },
        { type: 'separator' },
        { label: 'Cortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Pegar', role: 'paste' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Camino crítico', accelerator: 'F9', click: () => send('critical') },
        { type: 'separator' },
        { label: 'Zoom: días', click: () => send('zoom', 'day') },
        { label: 'Zoom: semanas', click: () => send('zoom', 'week') },
        { label: 'Zoom: meses', click: () => send('zoom', 'month') },
        { label: 'Zoom: trimestres', click: () => send('zoom', 'quarter') },
        { label: 'Ir a hoy', accelerator: 'CmdOrCtrl+T', click: () => send('today') },
        { label: 'Ajustar al proyecto', click: () => send('fit') },
        { type: 'separator' },
        { label: 'Tema claro / oscuro', click: () => send('theme') },
        { type: 'separator' },
        { label: 'Pantalla completa', role: 'togglefullscreen' },
        { label: 'Herramientas de desarrollo', role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        { label: 'Atajos de teclado', accelerator: 'F1', click: () => send('help') },
        { label: 'Acerca de Gantt Obra', click: () => dialog.showMessageBox({ type: 'info', title: 'Gantt Obra', message: `Gantt Obra ${app.getVersion()}`, detail: 'Planificación de obra con camino crítico (CPM).' }) }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Gantt Obra',
    backgroundColor: '#0f1720',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => win?.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on('close', (e) => {
    if (forceClose || !dirty || !win) return
    e.preventDefault()
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Guardar', 'No guardar', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
      title: 'Cambios sin guardar',
      message: 'El proyecto tiene cambios sin guardar.',
      detail: '¿Quieres guardarlos antes de salir?'
    })
    if (choice === 0) send('save-and-close')
    else if (choice === 1) {
      forceClose = true
      fs.rm(recoveryPath(), { force: true }).finally(() => win?.close())
    }
  })
  win.on('closed', () => (win = null))

  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// ---------- IPC ----------
ipcMain.handle('file:open', async () => {
  if (!win) return null
  const r = await dialog.showOpenDialog(win, { title: 'Abrir proyecto', filters: FILE_FILTERS, properties: ['openFile'] })
  if (r.canceled || !r.filePaths[0]) return null
  return readProject(r.filePaths[0])
})

ipcMain.handle('file:open-path', async (_e, path: string) => readProject(path))

async function readProject(path: string): Promise<{ path: string; content: string } | { error: string }> {
  try {
    const content = await fs.readFile(path, 'utf8')
    await addRecent(path)
    return { path, content }
  } catch (err) {
    return { error: `No se pudo leer ${path}: ${(err as Error).message}` }
  }
}

ipcMain.handle('file:save', async (_e, path: string | null, content: string, suggestedName: string) => {
  if (!win) return null
  let target = path
  if (!target) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Guardar proyecto',
      defaultPath: `${sanitize(suggestedName)}.gantt.json`,
      filters: FILE_FILTERS
    })
    if (r.canceled || !r.filePath) return null
    target = r.filePath
  }
  // Escritura atómica: primero a temporal y luego renombrar, para no corromper el archivo si falla a mitad.
  const tmp = `${target}.tmp`
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, target)
  await fs.rm(recoveryPath(), { force: true })
  await addRecent(target)
  return target
})

ipcMain.handle('file:recent', async () => readRecent())

ipcMain.on('state:dirty', (_e, isDirty: boolean, title: string) => {
  dirty = isDirty
  win?.setTitle(title)
  win?.setDocumentEdited(isDirty)
})

ipcMain.on('app:close-now', () => {
  forceClose = true
  win?.close()
})

ipcMain.handle('app:launch-file', async () => {
  const f = launchFile
  launchFile = null
  return f ? readProject(f) : null
})

ipcMain.on('recovery:write', (_e, content: string) => {
  fs.writeFile(recoveryPath(), content, 'utf8').catch(() => undefined)
})
ipcMain.on('recovery:clear', () => {
  fs.rm(recoveryPath(), { force: true }).catch(() => undefined)
})
ipcMain.handle('recovery:read', async () => {
  try {
    const st = await fs.stat(recoveryPath())
    return { content: await fs.readFile(recoveryPath(), 'utf8'), mtime: st.mtimeMs }
  } catch {
    return null
  }
})

ipcMain.handle('export:pdf', async (_e, html: string, pageSize: 'A3' | 'A4', suggestedName: string) => {
  if (!win) return null
  const r = await dialog.showSaveDialog(win, {
    title: 'Exportar a PDF',
    defaultPath: `${sanitize(suggestedName)}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (r.canceled || !r.filePath) return null
  const tmp = join(tmpdir(), `gantt-obra-${Date.now()}.html`)
  await fs.writeFile(tmp, html, 'utf8')
  const pw = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
  try {
    await pw.loadFile(tmp)
    const pdf = await pw.webContents.printToPDF({
      landscape: true,
      pageSize,
      printBackground: true,
      margins: { marginType: 'none' },
      preferCSSPageSize: true
    })
    await fs.writeFile(r.filePath, pdf)
    shell.openPath(r.filePath)
    return r.filePath
  } finally {
    pw.destroy()
    fs.rm(tmp, { force: true }).catch(() => undefined)
  }
})

ipcMain.handle('export:png', async (_e, base64: string, suggestedName: string) => {
  if (!win) return null
  const r = await dialog.showSaveDialog(win, {
    title: 'Exportar a PNG',
    defaultPath: `${sanitize(suggestedName)}.png`,
    filters: [{ name: 'Imagen PNG', extensions: ['png'] }]
  })
  if (r.canceled || !r.filePath) return null
  await fs.writeFile(r.filePath, Buffer.from(base64, 'base64'))
  shell.openPath(r.filePath)
  return r.filePath
})

function sanitize(name: string): string {
  return (basename(name || 'proyecto').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'proyecto').slice(0, 120)
}

// ---------- Ciclo de vida ----------
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    const f = findFileArg(argv)
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
      if (f) send('open-path', f)
    }
  })
  app.whenReady().then(async () => {
    app.setAppUserModelId('es.talat.ganttobra')
    await buildMenu()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
