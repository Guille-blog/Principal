# Auditoría de la Fase 1

Fecha: 15/10/2026. Se han verificado tres cosas por separado: el motor de cálculo, la interfaz (en navegador) y la aplicación de escritorio (Electron real con pantalla virtual).

## 1. Motor de cálculo (CPM)

| Prueba | Resultado |
|---|---|
| Tests unitarios (`src/core/engine.test.ts`): calendario, festivos, notación, FC/CC/FF/CF con desfases ±, ciclos, fecha contractual, restricciones, resúmenes, archivo, rendimiento con 500 tareas | **34 / 34** |
| Tests de propiedades (`src/core/cpm.property.test.ts`): 300 redes aleatorias con los 4 tipos de vínculo, desfases negativos, hitos, festivos y semanas de 6 días | **300 / 300** |

Qué comprueban los tests de propiedades en cada red:
- Se cumplen **todas** las restricciones de vínculo.
- Cada tarea empieza lo antes posible.
- La **holgura total es exacta**: retrasar una tarea su holgura no mueve el fin de obra, y retrasarla un día más lo mueve exactamente un día.
- La holgura libre no desplaza a ninguna otra tarea.
- Todos los tramos de las cadenas críticas son vínculos críticos.

## 2. Interfaz (29 comprobaciones de extremo a extremo)

Todas superadas:
- Alta rápida escribiendo en la última fila.
- Notación de predecesoras.
- Rechazo de fechas inválidas.
- Bloqueo de ciclos y de vínculos a capítulos.
- Sangría para crear capítulos, numeración EDT y duración agregada del capítulo.
- Plegar y desplegar capítulos.
- Supr, deshacer y rehacer.
- Copiar y pegar tareas (con reasignación de vínculos internos) y pegado de bloques desde Excel.
- Diálogo de tarea.
- Panel crítico: indicadores, avisos y tabla de holguras.
- Fecha contractual incumplida, que provoca holgura negativa y errores.
- Cambio de calendario con recálculo, gremios, zoom y tema oscuro.
- Proyecto de 500 tareas:
  - solo se dibujan unas 29 filas;
  - editar y recalcular tarda menos de 200 ms;
  - el panel crítico abre al instante.
- Ningún error de JavaScript en toda la sesión.

## 3. Aplicación de escritorio (21 comprobaciones)

Todas superadas:
- Pantalla de bienvenida y API de escritorio disponible.
- Título de la ventana con marca "●" cuando hay cambios sin guardar.
- Guardado atómico, sin dejar temporales.
- Exportación a PDF A3 y A4 y a PNG.
- Cierre con cambios sin guardar, en sus tres respuestas (Guardar / No guardar / Cancelar).
- Copia de recuperación tras un cierre brusco, con oferta de restaurarla.
- Apertura de un archivo pasado al ejecutable (doble clic en `.gantt.json`).
- Lista de recientes en el menú.
- Archivo dañado: muestra un mensaje claro y la aplicación no se cuelga.
- PDF de 500 tareas: 10 hojas A3 con cajetín numerado; tarda unos 2,4 s.

## 4. Defectos encontrados y corregidos

| Defecto | Impacto | Corrección |
|---|---|---|
| Al cambiar el zoom o plegar capítulos con el diagrama desplazado, el área visible podía quedar con ancho o alto negativo | Error de dibujo en la consola durante un instante | Se acota la ventana visible en ambos ejes |
| El título del documento no reflejaba "●" con cambios sin guardar (sí lo hacía la ventana) | Cosmético | Se sincronizan ambos títulos |
| El workflow de Windows generaba el `.exe` pero acababa en error al intentar publicarlo como release | No se descargaba el instalador | `electron-builder --publish never` |
| La aplicación usaba el icono genérico de Electron | Imagen | Icono propio (`build/icon.png`) |

## 5. Lo que no se ha podido verificar aquí

- **Ejecución en Windows real.** Las pruebas se han hecho en Linux con el mismo Electron. El instalador se compila en `windows-latest` (GitHub Actions), pero nadie lo ha instalado ni abierto todavía en un PC con Windows.
- **Atajos del menú nativo** (Ctrl+S, F9, Ctrl+P) pulsados con el teclado real. Se han probado las mismas acciones lanzándolas desde el menú.
- **Festivos oficiales.** Se calculan correctamente según su regla, pero el calendario oficial de cada año y comunidad hay que revisarlo con el BOE y el boletín autonómico.

## 6. Mejoras detectadas (no son defectos)

- En el PDF, todas las hojas usan la misma escala de tiempo que el proyecto completo. En obras largas, cada hoja muestra barras pequeñas. Opción para la Fase 2: escala por hoja o zoom configurable al exportar.
- El instalador no está firmado digitalmente, por eso Windows muestra el aviso de SmartScreen.
