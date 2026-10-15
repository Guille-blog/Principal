# Análisis de soluciones de referencia

Este análisis sirve para decidir qué copiar y qué mejorar en Gantt Obra. Se basa en la documentación pública de cada producto, en comparativas de 2026 y en la experiencia de uso habitual en obra.

> **Advertencia sobre las fuentes.** Buena parte de las comparativas que se publican en internet las escriben los propios fabricantes o páginas con comisiones de afiliación ([TeamGantt](https://www.teamgantt.com/gantt-chart-software), [Instagantt](https://www.instagantt.com/guides/top-gantt-chart-software), [ProjectManager](https://www.projectmanager.com/es/que-es-projectlibre)). Sus conclusiones se han tomado como indicios, no como datos contrastados.

## Resumen por producto

| Producto | Lo que hace bien | Defectos de uso | Qué tomamos / mejoramos |
|---|---|---|---|
| **MS Project** | Motor CPM completo (FC/CC/FF/CF con desfases), resúmenes, restricciones, calendarios. Es el estándar en obra. | Curva de aprendizaje alta. Licencias caras. Restricciones "ocultas" que desplazan tareas sin que el usuario lo vea. El camino crítico se muestra pero no se explica. Sólo considera crítica la holgura 0. | Copiamos la notación de predecesoras (`3FC+2d`), la jerarquía por sangría y la regla "mover a mano = No comenzar antes de". **Mejoramos** en tres cosas: la restricción se ve con un icono y hay un aviso; un panel explica en lenguaje claro qué es crítico y por qué; y se muestran las tareas casi críticas con un umbral configurable. |
| **Primavera P6** | Holgura total y libre, barras de holgura y cadena de lógica conductora ("driving"). | Pensado para grandes oficinas técnicas; es excesivo para un jefe de obra. | Copiamos las barras de holgura total (línea discontinua tras la tarea), la holgura libre y la identificación de los vínculos conductores para pintar sólo las flechas críticas. |
| **GanttProject** | Gratuito, de escritorio y sin conexión. | Interfaz anticuada, edición lenta y apenas avisa de lógica incompleta. | Mantenemos el enfoque de escritorio sin conexión y lo hacemos con una interfaz moderna. |
| **ProjectLibre** | Clon libre de MS Project. Abre archivos `.mpp`. | Rendimiento irregular, sin soporte, funciones limitadas en la versión gratuita. | La compatibilidad MS Project XML queda prevista para la Fase 2. |
| **TeamGantt / Instagantt** | Muy visuales: arrastrar y soltar, colores, curva de aprendizaje casi nula. | Ligeros en el cálculo: según sus propias comparativas, el camino crítico no está en todos los planes o es básico. Son web y de suscripción. | Copiamos la estética, el arrastre de barras, el redimensionado y la creación de vínculos arrastrando un punto de la barra. Lo mejoramos con un cálculo CPM riguroso. |
| **Smartsheet** | Una hoja de cálculo como interfaz, que es muy familiar. | Diagrama poco cuidado; caro a partir de unos 10 usuarios. | La tabla funciona como Excel: navegación con teclado y pegado de celdas desde Excel. |
| **Monday / ClickUp / Asana** | Integración con la gestión de tareas del equipo. | El Gantt es una vista más; las dependencias reales sólo están en los planes caros. | No aplica. Nos centramos en la planificación de obra. |
| **DHTMLX / Bryntum / Frappe** (librerías) | Componentes Gantt completos. | DHTMLX Pro y Bryntum son de pago; Frappe se queda corto (sin CPM ni tipos de vínculo). | Dibujo propio en SVG con virtualización: sin licencias y con control total. |

## Problemas de obra que el software genérico no resuelve

1. **Calendario laboral español.** Pocos productos traen los festivos nacionales precargados. Ninguno avisa de que hay que añadir los autonómicos y locales, ni de los festivos que caen en domingo y que algunas comunidades trasladan al lunes.
2. **Lógica incompleta.** Las tareas sin predecesora o sin sucesora quedan "sueltas" y falsean el camino crítico. MS Project no avisa de ello por defecto.
3. **Restricciones de fecha ocultas.** Al mover una barra a mano se crea una restricción que "congela" la tarea, y el camino crítico deja de reflejar la lógica real.
4. **Plazo contractual.** Hay que ver con claridad si se cumple y con qué margen; si no se cumple, aparecen holguras negativas.
5. **Lectura por gremios.** El jefe de obra necesita saber qué subcontratas están en el camino crítico para vigilarlas y no dejarlas sin recursos.

## Mejoras que incorpora Gantt Obra (Fase 1)

- **Botón «Camino crítico» (F9)** con:
  - indicadores de duración, fin previsto, número de críticas y margen contractual;
  - una explicación redactada;
  - la secuencia de cada cadena crítica, con los tipos de vínculo;
  - las tareas casi críticas con umbral configurable;
  - una tabla de holgura total y libre;
  - avisos de lógica (ciclos, tareas sueltas, restricciones, holgura negativa, vínculos a capítulos).
- **Reparto por gremio** de los días que suma el camino crítico.
- **Bloqueo de dependencias circulares** al escribirlas, indicando el ciclo concreto.
- **Barras de holgura** al estilo P6 y resto de tareas atenuadas cuando se activa el camino crítico.
- **Festivos nacionales automáticos**, calculados para cualquier año (Viernes Santo incluido), con aviso explícito para revisar el BOE y añadir los autonómicos y locales.
- **Exportación con cajetín** (obra, cliente, emplazamiento, jefe de obra, plazo, emisión, revisión, hoja) y leyenda por gremios, en A3 o A4 apaisado.
- **Edición rápida tipo Excel:** alta de tareas escribiendo en la última fila y pegado directo desde Excel.
