// Puente seguro entre la interfaz y el proceso principal (contextIsolation activado).
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const api = {
  openFile: () => ipcRenderer.invoke('file:open'),
  openPath: (path: string) => ipcRenderer.invoke('file:open-path', path),
  saveFile: (path: string | null, content: string, suggestedName: string) => ipcRenderer.invoke('file:save', path, content, suggestedName),
  getRecent: () => ipcRenderer.invoke('file:recent'),
  getLaunchFile: () => ipcRenderer.invoke('app:launch-file'),
  setDirty: (dirty: boolean, title: string) => ipcRenderer.send('state:dirty', dirty, title),
  closeNow: () => ipcRenderer.send('app:close-now'),
  writeRecovery: (content: string) => ipcRenderer.send('recovery:write', content),
  clearRecovery: () => ipcRenderer.send('recovery:clear'),
  readRecovery: () => ipcRenderer.invoke('recovery:read'),
  exportPDF: (html: string, pageSize: 'A3' | 'A4', suggestedName: string) => ipcRenderer.invoke('export:pdf', html, pageSize, suggestedName),
  exportPNG: (base64: string, suggestedName: string) => ipcRenderer.invoke('export:png', base64, suggestedName),
  onMenu: (cb: (cmd: string, arg?: string) => void) => {
    const listener = (_e: IpcRendererEvent, cmd: string, arg?: string): void => cb(cmd, arg)
    ipcRenderer.on('menu', listener)
    return () => ipcRenderer.removeListener('menu', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
