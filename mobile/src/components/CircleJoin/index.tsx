import React from 'react'

import CircleJoinCamera from './CircleJoinCamera'
import CircleJoinReview from './CircleJoinReview'

/**
 * As duas superfícies de entrar num Círculo depois, montadas uma vez na raiz.
 * Qualquer publicação as abre pelo `useCircleJoinStore` — assim não há uma
 * câmara nem uma folha por cada post da lista.
 */
export default function CircleJoinHost() {
  return (
    <>
      <CircleJoinCamera />
      <CircleJoinReview />
    </>
  )
}
