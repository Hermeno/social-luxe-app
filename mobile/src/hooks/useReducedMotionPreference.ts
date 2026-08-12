import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** Mantém as animações da app alinhadas com a preferência do sistema. */
export default function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (mounted) setReduced(value) })
      .catch(() => {})

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  return reduced
}
