import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../../../services/api'
import { useAuthStore } from '../../../store/auth.store'

/**
 * Perfil: fotografia e interesses.
 *
 * Os dois pontos finais são os que o onboarding actual já usa —
 * `PUT /users/profile` em multipart para o avatar e `PUT /users/interests` para
 * os interesses. Não há aqui serviço novo nem backend novo.
 */

/** A chave de interesses que a aplicação já escreve localmente. */
const KEY_INTERESTS = 'interests'

/**
 * Envia a fotografia.
 *
 * Devolve o `avatar` que o servidor confirmou. Quem chama não deve tratar o URI
 * local como prova de nada: uma pré-visualização é o ficheiro no telefone, e o
 * envio pode falhar depois de ela já estar no ecrã.
 */
export async function uploadAvatar(localUri: string): Promise<string | null> {
  const form = new FormData()
  form.append('avatar', { uri: localUri, name: 'avatar.jpg', type: 'image/jpeg' } as any)
  await api.put('/users/profile', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  await useAuthStore.getState().refreshUser()
  return useAuthStore.getState().user?.avatar ?? null
}

/**
 * Guarda os interesses.
 *
 * A cópia local é escrita primeiro e o servidor a seguir. Se o servidor recusar,
 * a chamada falha e quem chama mantém o ecrã — a lista local sozinha não conta
 * como guardada, e é por isso que a ordem importa: local primeiro não é
 * optimismo, é ter o que reenviar.
 */
export async function saveInterests(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEY_INTERESTS, JSON.stringify(ids)).catch(() => {})
  await api.put('/users/interests', { interests: ids })
  await useAuthStore.getState().refreshUser().catch(() => {})
}

export async function readSavedInterests(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_INTERESTS)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

/**
 * A marca de onboarding concluído.
 *
 * Fica escrita logo a seguir aos interesses, e não no fim de tudo — que é o
 * momento que a aplicação já pratica. As sugestões são opcionais: quem fechar a
 * app nelas não pode ser obrigado a repetir a senha, o nome e os interesses
 * para voltar a chegar ali.
 */
const KEY_ONBOARDING = 'onboarding_done'

export async function markOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(KEY_ONBOARDING, '1').catch(() => {})
}

export async function isOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_ONBOARDING)) === '1'
  } catch {
    return false
  }
}
