import React, { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { configureVideoPlayer, videoSource as buildVideoSource } from '../../utils/video'

const VIDEO_ARM_DELAY = 260

interface Props {
  /** URL absoluto da mídia. */
  uri: string
  /** Toca enquanto for verdade; pausa e rebobina quando deixar de ser. */
  active: boolean
}

/**
 * O vídeo de uma publicação da Home, a tocar sozinho enquanto está à vista.
 *
 * Vive num componente próprio por uma razão dura: `useVideoPlayer` é um hook e
 * não pode nascer dentro de uma condição. Se o leitor fosse criado na célula,
 * toda a publicação — fotografia, Círculo ou texto — carregava um leitor de
 * vídeo só para o caso de vir a precisar dele.
 *
 * Assim só existe leitor onde há vídeo, e só enquanto ele está à vista: quem
 * decide isso é a lista, pela viewabilidade, e não este componente.
 *
 * Com som, como a Feed imersiva. Só o vídeo à vista toca, portanto nunca há dois
 * a falar ao mesmo tempo.
 *
 * A source só é entregue depois de a célula permanecer ativa por um instante.
 * Assim uma passagem rápida não descarrega vídeo e a capa continua visível
 * enquanto o primeiro pequeno buffer fica pronto.
 *
 * Ao sair de vista o leitor pausa **e volta ao início**: reencontrar o vídeo a
 * meio, sem saber o que se perdeu, é pior do que recomeçá-lo.
 */
export default function HomeVideo({ uri, active }: Props) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    setArmed(false)
    if (!active) return
    const timer = setTimeout(() => setArmed(true), VIDEO_ARM_DELAY)
    return () => clearTimeout(timer)
  }, [active, uri])

  const player = useVideoPlayer(armed ? buildVideoSource(uri) : null, (instance) => {
    configureVideoPlayer(instance)
    instance.loop = true
    instance.muted = false
  })

  useEffect(() => {
    if (!player) return
    try {
      if (active && armed) player.play()
      else {
        player.pause()
        player.currentTime = 0
      }
    } catch {}
  }, [active, armed, player])

  // Não cobrir o poster com uma surface vazia durante a janela de proteção.
  if (!armed) return null

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
    />
  )
}
