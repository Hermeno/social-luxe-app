import { useReducer, useCallback } from 'react'
import { TravelState, TravelAction, TravelPhase, TRAVEL_INITIAL } from './types'
import { TravelData, TravelObject } from '../../types'

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(s: TravelState, a: TravelAction): TravelState {
  switch (a.type) {
    case 'LOAD':
      return { ...s, phase: 'LOADING', error: null }

    case 'LOAD_OK':
      return { ...s, phase: 'DISPLAYING', data: a.data, error: null }

    case 'LOAD_ERR':
      return { ...s, phase: 'ERROR', error: a.error }

    case 'OPEN_PICKER':
      return s.phase === 'DISPLAYING' ? { ...s, phase: 'ADDING_OBJECT' } : s

    case 'CLOSE_PICKER':
      return s.phase === 'ADDING_OBJECT' ? { ...s, phase: 'DISPLAYING' } : s

    case 'ADD_OBJECT': {
      if (!s.data) return s
      const updated: TravelData = {
        ...s.data,
        objects: [...s.data.objects, a.object],
        stats:   { ...s.data.stats, totalObjects: s.data.stats.totalObjects + 1 },
      }
      return { ...s, phase: 'DISPLAYING', data: updated }
    }

    case 'REMOVE_START':
      return { ...s, phase: 'REMOVING_OBJECT', removingId: a.id }

    case 'REMOVE_OK': {
      if (!s.data) return s
      const updated: TravelData = {
        ...s.data,
        objects: s.data.objects.filter((o) => o.id !== a.id),
        stats:   { ...s.data.stats, totalObjects: Math.max(0, s.data.stats.totalObjects - 1) },
      }
      return { ...s, phase: 'DISPLAYING', data: updated, removingId: null }
    }

    case 'REMOVE_ERR':
      return { ...s, phase: 'DISPLAYING', removingId: null }

    case 'RESET':
      return TRAVEL_INITIAL

    default:
      return s
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useTravelState() {
  const [state, dispatch] = useReducer(reducer, TRAVEL_INITIAL)
  return { state, dispatch }
}
