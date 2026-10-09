import NetInfo, { NetInfoState } from '@react-native-community/netinfo'

type Listener = (isConnected: boolean) => void

// Optimistic start — NetInfo.fetch() corrects this within ~100ms.
// Pessimistic (false) caused a race: useFocusEffect fired before fetch() resolved,
// so the feed skipped its background sync and stayed empty on first open.
let _isConnected = true
const listeners = new Set<Listener>()

function applyState(connected: boolean) {
  if (connected === _isConnected) return
  _isConnected = connected
  console.log(`[NetInfo] ${connected ? '🟢 Online' : '🔴 Offline'}`)
  listeners.forEach((fn) => fn(connected))
}

// Initialise once at app start
export function initNetInfo(): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    applyState(!!(state.isConnected && state.isInternetReachable !== false))
  })

  // Resolve initial state eagerly — triggers listeners if we are actually online
  NetInfo.fetch().then((state) => {
    applyState(!!(state.isConnected && state.isInternetReachable !== false))
  })

  return unsubscribe
}

export function isConnected(): boolean {
  return _isConnected
}

export function onConnectivityChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

