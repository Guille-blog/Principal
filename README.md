# Gantt Obra

Aplicación de escritorio para Windows de **planificación de obra con diagrama de Gantt y camino crítico (CPM)**. Funciona sin conexión. Está pensada para jefes de obra de instalaciones (electricidad, climatización, fontanería, domótica y telecomunicaciones).

- La entrada de tareas funciona como una hoja de cálculo: se maneja con el teclado y admite pegar celdas desde Excel.
- Admite vínculos FC, CC, FF y CF con desfases en días laborables, usando la misma notación que MS Project (`3FC+2d`).
- Usa un calendario laboral con los festivos nacionales de España precargados, y permite añadir los autonómicos y locales.
- El botón **Camino crítico** (F9) calcula el CPM completo y lo explica con indicadores, secuencia, gremios implicados, tareas casi críticas, holguras y avisos de lógica.
- Exporta a PDF (A3 o A4 apaisado, con cajetín) y a PNG.

> Documentación de diseño: [análisis de referencias](docs/ANALISIS_REFERENCIAS.md) · [decisiones](docs/DECISIONES.md) · [especificación](docs/PROMPT_GANTT.md)

## Instalación (usuario final)

1. Descarga `GanttObra-Setup-x.y.z.exe`. Se genera automáticamente en GitHub Actions: pestaña **Actions → Instalador Windows → Artifacts**.
2. Ejecútalo. Windows SmartScreen avisará de que el instalador **no está firmado**: pulsa «Más información → Ejecutar de todas formas».
3. Se crean accesos directos en el escritorio y en el menú Inicio.

## Desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install          # instala dependencias (descarga Electron)
npm run dev          # abre la aplicación en modo desarrollo con recarga en caliente
npm test             # tests del motor de cálculo (Vitest)
npm run typecheck    # comprobación de tipos TypeScript
npm run web          # interfaz en el navegador (http://localhost:5173), sin Electron
```

### Generar el instalador `.exe`

En Windows:

```bash
npm run dist:win     # deja el instalador en release/
```

Desde Linux o macOS hace falta Wine. Es más sencillo usar el workflow `.github/workflows/build-windows.yml`, que compila en `windows-latest` en cada push.

## Uso rápido

| Acción | Cómo |
|---|---|
| Añadir tarea | Escribir en la última fila («Escribe aquí…») o pulsar **+ Tarea** |
| Editar celda | Escribir directamente, **Enter** o **F2**. **Enter** confirma y baja; **Tab** confirma y avanza; **Esc** cancela |
| Duración | `5`, `5d`, `2sem`; `0` = hito |
| Fechas | `dd/mm/aaaa`, `dd/mm/aa` o `dd/mm` |
| Predecesoras | `3` · `3FC+2d` · `4CC` · `5FF-1d` · `6CF`, separadas por `;` |
| Capítulos | **Alt+Mayús+→ / ←** (sangría) |
| Mover filas | **Alt+Mayús+↑ / ↓** |
| Insertar encima | **Insert** |
| Borrar tareas | Seleccionarlas desde la columna **#** y pulsar **Supr**, o usar el botón de papelera |
| Vincular en cadena | Seleccionar varias y pulsar **Ctrl+F2** |
| Deshacer / rehacer | **Ctrl+Z / Ctrl+Y** (ilimitado) |
| Copiar / pegar | **Ctrl+C / Ctrl+V**: copia tareas o pega bloques de celdas desde Excel |
| Diagrama | Arrastrar la barra para moverla, su borde derecho para estirarla y el círculo final hasta otra barra para vincular. **Ctrl+rueda** cambia el zoom |
| Detalle de tarea | Doble clic en la barra o en la columna # o EDT |
| Camino crítico | **F9** o el botón rojo |
| Guardar / abrir | **Ctrl+S / Ctrl+O** (archivos `.gantt.json`) |
| Exportar | **Ctrl+P** (PDF) o **Archivo → Exportar a PNG** |

### Reglas del cálculo que conviene conocer

- Todas las duraciones y desfases son **días laborables** según el calendario del proyecto.
- **Mover a mano** una tarea con predecesoras le pone una restricción **«No comenzar antes de»** (icono de chincheta). Puede ocultar el camino crítico real; quítala con el botón de la chincheta.
- Si defines una **fecha contractual** (Archivo → Datos de la obra) y la planificación la supera, aparecen **holguras negativas** y un aviso en rojo.
- **Sin vínculos no hay camino crítico.** El panel avisa de las tareas sin predecesora o sin sucesora: lo correcto es que sólo el hito de inicio no tenga predecesora y sólo el hito de fin no tenga sucesora.
- Los **festivos nacionales** se generan automáticamente, pero **hay que revisarlos con el BOE** de cada año y añadir los **autonómicos y locales** del municipio de la obra.

## Estructura

```
src/core/       Motor puro: calendario, CPM, jerarquía, edición, archivo (con tests)
src/main/       Proceso principal de Electron: ventana, menú, archivos, PDF
src/preload/    Puente seguro (contextBridge)
src/renderer/   Interfaz React: tabla, diagrama SVG, panel crítico, diálogos, exportación
```

## Limitaciones conocidas (Fase 1)

- No se pueden vincular capítulos (tareas resumen); hay que vincular sus tareas.
- Un único calendario por proyecto; no hay calendarios por recurso o gremio.
- No hay línea base ni comparación planificado/real; el % de avance no recalcula fechas.
- No importa ni exporta Excel ni MS Project XML.
- El instalador no está firmado digitalmente (aviso de SmartScreen).
