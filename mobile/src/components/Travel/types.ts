import { TravelData, TravelObject } from '../../types'

export type TravelPhase =
  | 'IDLE'
  | 'LOADING'
  | 'DISPLAYING'
  | 'ADDING_OBJECT'
  | 'REMOVING_OBJECT'
  | 'UPDATING_STATS'
  | 'ERROR'

export interface TravelState {
  phase:      TravelPhase
  data:       TravelData | null
  error:      string | null
  // transient — the object being removed
  removingId: string | null
}

export const TRAVEL_INITIAL: TravelState = {
  phase:      'IDLE',
  data:       null,
  error:      null,
  removingId: null,
}

export type TravelAction =
  | { type: 'LOAD' }
  | { type: 'LOAD_OK';      data: TravelData }
  | { type: 'LOAD_ERR';     error: string }
  | { type: 'OPEN_PICKER' }
  | { type: 'CLOSE_PICKER' }
  | { type: 'ADD_OBJECT';   object: TravelObject }
  | { type: 'REMOVE_START'; id: string }
  | { type: 'REMOVE_OK';    id: string }
  | { type: 'REMOVE_ERR' }
  | { type: 'RESET' }
