# Prompt — App de escritorio de Diagrama de Gantt para obra (Fase 1)

## Rol y contexto

Actúa como desarrollador senior de aplicaciones de escritorio y experto en planificación de obra (método CPM / PERT, MS Project, Primavera P6).

El usuario es Jefe de Obra en una empresa de instalaciones integrales (electricidad, climatización, fontanería, domótica y telecomunicaciones). Coordina gremios y subcontratas y trabaja con Excel, Presto, AutoCAD y Revit. Necesita una herramienta de planificación **rápida de rellenar, muy visual y técnicamente rigurosa**, no un juguete.

## Objetivo

Construir una **aplicación de escritorio para Windows** que funcione **100 % sin conexión**: un diagrama de Gantt interactivo en el que se puedan introducir tareas y fechas de forma sencilla y calcular el **camino crítico** con un botón.

## Paso previo obligatorio: análisis de referencia

Antes de programar, analiza las soluciones existentes: MS Project, Primavera P6, GanttProject, ProjectLibre, TeamGantt, Instagantt, Smartsheet, ClickUp/Monday (vista Gantt) y librerías como DHTMLX Gantt, Frappe Gantt y Bryntum.

Resume en `docs/ANALISIS_REFERENCIAS.md`:
- lo que hace bien cada una;
- sus defectos de usabilidad;
- qué incorporas y qué mejoras.

El resultado tiene que ser **más ágil que MS Project** y **más riguroso que las herramientas web ligeras**.

## Stack técnico

- **Electron + TypeScript + Vite**, con React para la interfaz.
- Gantt **renderizado a medida** (SVG o Canvas), sin depender de librerías Gantt de pago. Justifica la elección si usas alguna librería de apoyo.
- Instalador `.exe` con `electron-builder` (NSIS).
- Persistencia en **archivos locales** `.gantt.json` (Abrir / Guardar / Guardar como), con autoguardado y lista de recientes.
- Motor de cálculo (CPM y calendario) en un **módulo puro e independiente de la interfaz**, con **tests unitarios** (Vitest).

## Funcionalidades de la Fase 1

### 1. Entrada de tareas (prioridad: rapidez)

Tabla tipo hoja de cálculo a la izquierda, sincronizada con las barras a la derecha. Columnas:
- **ID / EDT**: numeración jerárquica automática (1, 1.1, 1.2…).
- **Nombre**.
- **Inicio**, **Fin** y **Duración** en días laborables. Al editar dos de ellas se recalcula la tercera.
- **Predecesoras**, en notación tipo MS Project: `3`, `3FC`, `3CC+2d`, `5FF-1d`, `4CF`. Tipos: FC, CC, FF y CF, con desfase positivo o negativo.
- **Gremio / Subcontrata**, que asigna el color: Electricidad, Climatización, Fontanería, Domótica, Telecomunicaciones, Obra civil y Otros (editables).
- **Responsable**.
- **% avance**.
- **Notas**.

Además:
- Navegación con teclado como en Excel: Enter, Tab, flechas, F2, Supr, Ctrl+C/V y Ctrl+Z/Y (deshacer y rehacer ilimitados).
- **Jerarquía**: capítulos y subtareas con sangría (Alt+Mayús+→ / ←) y plegar/desplegar. Las tareas resumen calculan sus fechas a partir de sus hijas y no se pueden editar directamente.
- **Hitos**: duración 0 y se dibujan con forma de rombo.
- Alta rápida: escribir en la última fila vacía crea la tarea.

### 2. Diagrama

- Barras **arrastrables** para mover la tarea y **estirables** para cambiar su duración, con ajuste al día.
- Barra interna que muestra el % de avance.
- **Flechas de dependencia** que se crean arrastrando de una barra a otra.
- Zoom por día, semana, mes y trimestre (Ctrl+rueda), con escala temporal en dos niveles.
- Línea vertical de **"Hoy"**, festivos y fines de semana sombreados.
- Información al pasar el ratón: fechas, duración, holgura y predecesoras.
- Tema claro y oscuro con estética moderna y profesional. La legibilidad manda sobre la decoración.

### 3. Calendario laboral

- Por defecto de lunes a viernes, configurable.
- Festivos editables, con plantilla precargada de **festivos nacionales de España** del año en curso y posibilidad de añadir los autonómicos y locales.
- **Todas** las duraciones, desfases y cálculos CPM se hacen en **días laborables**.

### 4. Botón «Camino crítico»

- Cálculo **CPM completo**:
  - pasada hacia delante para obtener ES y EF;
  - pasada hacia atrás para obtener LS y LF;
  - **holgura total** y **holgura libre** de cada tarea;
  - soporte de los cuatro tipos de vínculo con desfase.
- Resalta en rojo las tareas y vínculos críticos (holgura total ≤ 0).
- Abre un **panel explicativo** con:
  - la secuencia del camino crítico en orden (Tarea A → Tarea B → …) y la duración de cada tarea;
  - la duración total del proyecto y su fecha de fin;
  - una tabla de holguras de todas las tareas, ordenada de menor a mayor;
  - las **tareas casi críticas** (holgura ≤ X días, configurable);
  - un texto en lenguaje claro que explique **por qué** esas tareas son críticas y qué supone retrasarlas.
- **Validaciones con aviso explícito**:
  - dependencias circulares, que bloquean el cálculo e indican el ciclo;
  - tareas sin predecesoras ni sucesoras (abiertas), que distorsionan el camino crítico;
  - holguras negativas cuando hay restricciones de fecha incompatibles;
  - si no hay ninguna dependencia, explicar que **sin vínculos no existe camino crítico**.

### 5. Archivo y exportación (Fase 1)

- Guardar y abrir `.gantt.json` con un esquema versionado (`schemaVersion`) para no romper archivos en el futuro.
- Exportar el diagrama a **PDF y PNG** (A3 / A4 apaisado) con cajetín: obra, fecha y revisión.
- Proyecto de ejemplo precargado con una instalación integral realista: replanteo, rozas, canalizaciones, cableado, cuadros, climatización, fontanería, ICT, domótica KNX, pruebas, legalización y entrega.

## Fuera de alcance en la Fase 1 (preparar la arquitectura para ello)

- Importar y exportar en Excel y MS Project XML.
- Línea base y comparación entre planificado y real.
- Recursos y cargas por gremio.
- Restricciones de fecha avanzadas («no comenzar antes de», etc.).
- Multiproyecto.

## Criterios de calidad y aceptación

1. Los tests unitarios del motor CPM cubren, como mínimo:
   - una cadena lineal;
   - ramas paralelas;
   - los vínculos FC, CC, FF y CF con desfase positivo y negativo;
   - la detección de ciclos;
   - el salto de festivos y fines de semana.
2. Rendimiento fluido con **500 tareas**: arrastre sin tirones y recálculo en menos de 100 ms.
3. Ninguna acción pierde datos: autoguardado y aviso de cambios sin guardar al cerrar.
4. Interfaz completamente en **español** y fechas en formato `dd/mm/aaaa`.
5. `README.md` con instrucciones para instalar, ejecutar en desarrollo, generar el `.exe` y los atajos de teclado.

## Forma de trabajo

- Desarrolla en la rama `claude/gantt-desktop-app-t6x3lg`, con commits pequeños y descriptivos.
- Orden:
  1. Análisis de referencias.
  2. Motor de cálculo con sus tests.
  3. Interfaz de tabla.
  4. Diagrama.
  5. Camino crítico.
  6. Exportación.
  7. Empaquetado.
- Si una decisión de diseño tiene alternativas relevantes, elige la más robusta, justifícala brevemente en `docs/DECISIONES.md` y continúa sin bloquearte.
- Al terminar, entrega:
  - un resumen de lo hecho;
  - las limitaciones conocidas;
  - una lista priorizada de mejoras para la Fase 2.
