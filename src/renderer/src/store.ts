// Estado del documento con deshacer/rehacer ilimitado (pila de instantáneas inmutables).
import { useCallback, useReducer } from 'react'
import type { Project } from '@core/types'

interface DocState {
  project: Project
  past: Project[]
  future: Project[]
  filePath: string | null
  saved: Project
}

type Action =
  | { type: 'commit'; project: Project }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'load'; project: Project; filePath: string | null; dirty?: boolean }
  | { type: 'saved'; filePath: string }

function reducer(s: DocState, a: Action): DocState {
  switch (a.type) {
    case 'commit':
      if (a.project === s.project) return s
      return { ...s, project: a.project, past: [...s.past, s.project], future: [] }
    case 'undo': {
      if (!s.past.length) return s
      const prev = s.past[s.past.length - 1]
      return { ...s, project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future] }
    }
    case 'redo': {
      if (!s.future.length) return s
      const [next, ...rest] = s.future
      return { ...s, project: next, past: [...s.past, s.project], future: rest }
    }
    case 'load':
      return { project: a.project, past: [], future: [], filePath: a.filePath, saved: a.dirty ? ({} as Project) : a.project }
    case 'saved':
      return { ...s, filePath: a.filePath, saved: s.project }
  }
}

export function useDocument(initial: Project) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ project: initial, past: [], future: [], filePath: null, saved: initial }))
  const commit = useCallback((project: Project) => dispatch({ type: 'commit', project }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const load = useCallback((project: Project, filePath: string | null, dirty = false) => dispatch({ type: 'load', project, filePath, dirty }), [])
  const markSaved = useCallback((filePath: string) => dispatch({ type: 'saved', filePath }), [])
  return {
    project: state.project,
    filePath: state.filePath,
    dirty: state.project !== state.saved,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit,
    undo,
    redo,
    load,
    markSaved
  }
}
