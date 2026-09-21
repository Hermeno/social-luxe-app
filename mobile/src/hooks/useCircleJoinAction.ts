import { useMemo } from 'react'

import { confirm } from '../components/confirm'
import type { Strings } from '../i18n'
import { useAuthStore } from '../store/auth.store'
import { useCircleJoinStore } from '../store/circleJoin.store'
import { useFollowStore } from '../store/follow.store'
import { circleRelation, type CircleRelation } from '../screens/HomeScreen/homePostShape'
import type { Post } from '../types'

/**
 * O que um Círculo publicado oferece a quem o está a ver.
 *
 *   review   sou o anfitrião e há pedidos à espera da minha decisão;
 *   pending  pedi para entrar e ainda não decidiram;
 *   join     não estive lá, mas sigo alguém que esteve — posso pedir;
 *   none     nada a oferecer: já estou no Círculo, ou não conheço ninguém dele.
 *
 * Uma só leitura para a Home e para a imersiva: as duas mostram o mesmo
 * convite, e não podem discordar sobre quem o pode ver. O servidor volta a
 * verificar tudo — isto só decide o que se desenha.
 */
export type CircleJoinAction =
  | { kind: 'review'; count: number; relation: CircleRelation }
  | { kind: 'pending'; relation: CircleRelation }
  | { kind: 'join'; relation: CircleRelation }
  | { kind: 'none'; relation: CircleRelation | null }

export default function useCircleJoinAction(post: Post): CircleJoinAction {
  const myId = useAuthStore((state) => state.user?.id)
  const relation = useMemo(() => circleRelation(post, myId), [post, myId])
  const momentId = relation?.momentId ?? ''
  const incoming = useCircleJoinStore((state) => (
    momentId ? state.incoming.reduce((count, request) => count + (request.momentId === momentId ? 1 : 0), 0) : 0
  ))
  const pending = useCircleJoinStore((state) => !!momentId && !!state.pending[momentId])
  const followsSomeone = useFollowStore((state) => (
    !!relation && relation.participantIds.some((id) => state.followingIds.has(id))
  ))

  if (!relation || !myId) return { kind: 'none', relation }
  if (relation.isHost) return incoming > 0 ? { kind: 'review', count: incoming, relation } : { kind: 'none', relation }
  if (relation.inCircle) return { kind: 'none', relation }
  if (pending) return { kind: 'pending', relation }
  if (followsSomeone) return { kind: 'join', relation }
  return { kind: 'none', relation }
}

/**
 * O que acontece ao tocar no convite, seja ele qual for. Um só sítio para a
 * Home e a imersiva: abrir a câmara, abrir os pedidos, ou desistir do meu —
 * este com confirmação, porque apaga a fotografia.
 */
export async function performCircleJoinAction(
  action: CircleJoinAction,
  t: Strings,
  onError: (message: string) => void,
) {
  const store = useCircleJoinStore.getState()
  switch (action.kind) {
    case 'review':
      store.openReview(action.relation.momentId)
      return
    case 'join':
      store.openJoin({ momentId: action.relation.momentId, hostName: action.relation.hostName })
      return
    case 'pending': {
      const ok = await confirm({
        title: t.circleJoin_cancelTitle,
        message: t.circleJoin_cancelMsg,
        confirmText: t.circleJoin_cancelConfirm,
        cancelText: t.circleJoin_keep,
        destructive: true,
      })
      if (!ok) return
      try {
        await store.cancel(action.relation.momentId)
      } catch (err: any) {
        onError(err?.response?.data?.message || t.circleJoin_failed)
      }
      return
    }
    default:
  }
}
