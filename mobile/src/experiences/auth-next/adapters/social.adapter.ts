import { getSuggestedUsers, type SuggestedUser } from '../../../services/follow.service'
import { useFollowStore } from '../../../store/follow.store'

/**
 * As sugestões de pessoas e o acto de seguir.
 *
 * Seguir passa pelo `follow.store` existente, que é quem mantém o conjunto de
 * `followingIds` que o resto da aplicação lê. Um seguir feito por fora dele
 * ficaria invisível no perfil e na feed até ao próximo arranque.
 */

export type { SuggestedUser }

/** O serviço devolve até ao limite pedido; o ecrã trabalha com 15. */
export const SUGGESTION_LIMIT = 15

export async function loadSuggestions(limit = SUGGESTION_LIMIT): Promise<SuggestedUser[]> {
  return getSuggestedUsers(limit)
}

/**
 * Segue uma pessoa. Nunca é chamado por um "Continuar".
 *
 * Uma operação social só acontece quando alguém a pede explicitamente — tocar
 * em `Seguir` nesta linha, ou em `Seguir todos`. Avançar no percurso não segue
 * ninguém, e nenhuma linha desta lista nasce pré-seleccionada.
 */
export async function follow(user: { id: string; name?: string | null; avatar?: string | null }): Promise<void> {
  await useFollowStore.getState().toggle(user.id, undefined, {
    name: user.name ?? '',
    avatar: user.avatar ?? null,
  })
}

export async function followAll(
  users: { id: string; name?: string | null; avatar?: string | null }[],
): Promise<void> {
  await useFollowStore.getState().followMany(users)
}

export function isFollowing(userId: string): boolean {
  return useFollowStore.getState().followingIds.has(userId)
}

/**
 * Quem está a ser seguido, de forma reactiva.
 *
 * As outras funções deste ficheiro chegam com uma leitura pontual; esta não —
 * a lista tem de se redesenhar quando o estado muda, e para isso é preciso
 * subscrever a store. Fica aqui e não no ecrã pela mesma razão que tudo o resto:
 * é a fronteira com a aplicação antiga, e o ecrã não deve saber onde ela está.
 */
export function useFollowingIds(): ReadonlySet<string> {
  return useFollowStore((state) => state.followingIds)
}

/**
 * O que ficou mesmo seguido depois de uma operação em lote.
 *
 * `followMany` pode ter sucesso parcial — uns passam, outros não. Comparar a
 * intenção com este conjunto é a única maneira honesta de saber se houve falha,
 * em vez de assumir que tudo correu bem por não ter havido excepção.
 */
export function followedNow(): ReadonlySet<string> {
  return useFollowStore.getState().followingIds
}
