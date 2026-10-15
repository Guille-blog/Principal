// Modo navegador (sin Electron): útil para desarrollo rápido de la interfaz y pruebas visuales.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: { alias: { '@core': resolve(__dirname, 'src/core') } },
  plugins: [react()],
  server: { port: 5173 }
})
