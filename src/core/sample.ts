// Proyecto de ejemplo: instalaciones integrales de un edificio plurifamiliar.
import { parsePredecessors } from './predecessors'
import { createEmptyProject, newTask, nextMonday } from './project'
import type { Project } from './types'

type Row = [level: number, name: string, duration: number, trade: string, preds: string]

const ROWS: Row[] = [
  [0, 'Inicio de obra (acta de replanteo)', 0, 'otros', ''],
  [0, 'Preliminares', 0, 'otros', ''],
  [1, 'Replanteo de instalaciones en obra', 3, 'otros', '1'],
  [1, 'Coordinación BIM e interferencias (Revit)', 4, 'otros', '3CC'],
  [1, 'Acopio de materiales', 5, 'otros', '3CC+1d'],
  [0, 'Rozas y canalizaciones', 0, 'otros', ''],
  [1, 'Rozas y pasos de forjado', 8, 'civil', '3;4'],
  [1, 'Canalización eléctrica empotrada', 10, 'elec', '7CC+3d'],
  [1, 'Canalización ICT', 6, 'telco', '8CC+2d'],
  [1, 'Red de saneamiento colgado', 7, 'fonta', '4;5'],
  [1, 'Red de fontanería AF/ACS', 9, 'fonta', '7CC+2d'],
  [1, 'Red de conductos de climatización', 10, 'clima', '4;7CC+4d'],
  [0, 'Cableado e instalaciones interiores', 0, 'otros', ''],
  [1, 'Cableado de circuitos interiores', 12, 'elec', '8'],
  [1, 'Cableado ICT (RTV, telefonía, fibra)', 6, 'telco', '9'],
  [1, 'Cuadros eléctricos y CGP', 5, 'elec', '14CC+6d'],
  [1, 'Bus KNX y cableado de domótica', 5, 'domo', '14CC+4d'],
  [1, 'Líneas frigoríficas y drenajes', 6, 'clima', '12'],
  [1, 'Ayudas de albañilería: tapado de rozas', 6, 'civil', '11;14;15'],
  [0, 'Equipos y acabados', 0, 'otros', ''],
  [1, 'Unidades interiores y exteriores de climatización', 6, 'clima', '18'],
  [1, 'Aparatos sanitarios y grifería', 5, 'fonta', '19'],
  [1, 'Mecanismos y luminarias', 6, 'elec', '19'],
  [1, 'Recinto RITI/RITS y cabecera ICT', 4, 'telco', '15'],
  [1, 'Programación KNX (ETS) y visualización', 4, 'domo', '17;23'],
  [0, 'Pruebas y puesta en marcha', 0, 'otros', ''],
  [1, 'Pruebas de estanqueidad y presión (fontanería)', 2, 'fonta', '22;10'],
  [1, 'Verificaciones REBT (aislamiento, tierras, diferenciales)', 2, 'elec', '23;16'],
  [1, 'Puesta en marcha y equilibrado (RITE)', 3, 'clima', '21;28'],
  [1, 'Certificación ICT (mediciones)', 2, 'telco', '24'],
  [1, 'Pruebas funcionales de domótica', 2, 'domo', '25'],
  [0, 'Legalización y entrega', 0, 'otros', ''],
  [1, 'Documentación final: CIE, certificados RITE, boletín ICT', 5, 'otros', '27;28;29;30'],
  [1, 'Inspección OCA (si procede)', 1, 'otros', '33FC+3d'],
  [0, 'Entrega de obra', 0, 'otros', '34;31']
]

export function createSampleProject(start: string = nextMonday()): Project {
  const p = createEmptyProject(start)
  p.info = {
    ...p.info,
    name: 'Edificio plurifamiliar 24 viviendas — Instalaciones',
    client: 'Promotora (ejemplo)',
    location: 'Madrid',
    manager: 'Jefe de Obra',
    revision: 'Rev. 0'
  }
  p.tasks = ROWS.map(([level, name, duration, trade], i) => {
    const isSummary = i + 1 < ROWS.length && ROWS[i + 1][0] > level
    return { ...newTask(i + 1, start, level, name), duration: isSummary ? 1 : duration, trade }
  })
  ROWS.forEach(([, , , , preds], i) => {
    if (!preds) return
    const res = parsePredecessors(preds, p.tasks, i)
    if (res.errors.length) throw new Error(`Ejemplo mal definido en fila ${i + 1}: ${res.errors.join(', ')}`)
    p.tasks[i].predecessors = res.deps
  })
  return p
}
