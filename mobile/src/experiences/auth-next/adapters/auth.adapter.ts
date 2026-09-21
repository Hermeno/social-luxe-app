import { checkPhone as checkPhoneApi, getUsernameOptions } from '../../../services/auth.service'
import { useAuthStore } from '../../../store/auth.store'
import { displayHandle } from '../../../utils/handle'
import type { User } from '../../../types'

/**
 * A fronteira entre este módulo e a autenticação da aplicação.
 *
 * Nada aqui reimplementa autenticação. `login` e `register` passam pelo
 * `auth.store` existente — é ele que guarda o token, limpa as caches da
 * identidade anterior e reinicia as stores por dono. Reescrever esse trabalho
 * do lado de cá seria criar uma segunda verdade sobre quem está autenticado.
 *
 * O adaptador existe por três razões: dar ao módulo uma superfície pequena e
 * tipada, manter num só sítio o conhecimento de como o contrato antigo se
 * comporta, e garantir que nenhum ecrã novo importa directamente um serviço
 * antigo — o dia em que um destes contratos mudar, muda aqui.
 */

export interface PhoneCheck {
  exists: boolean
}

export async function checkPhone(e164: string): Promise<PhoneCheck> {
  const result = await checkPhoneApi(e164)
  return { exists: Boolean(result?.exists) }
}

export async function suggestHandles(name: string): Promise<string[]> {
  const result = await getUsernameOptions(name)
  // A base vem separada das opções; ao ecrã só interessam identificadores
  // apresentáveis, e sem o `@` que alguns valores gravados trazem colado.
  return (result?.options ?? []).map(displayHandle).filter(Boolean)
}

export async function signIn(e164: string, password: string): Promise<User> {
  await useAuthStore.getState().login(e164, password)
  const user = useAuthStore.getState().user
  if (!user) throw new Error('')
  return user
}

/**
 * Cria a conta. É aqui — e só aqui — que a conta passa a existir.
 *
 * O servidor pode devolver um identificador diferente do escolhido: a sugestão
 * nunca foi uma reserva, e entre a escolher e a submeter alguém pode ter ficado
 * com ele. Quem chama compara `requestedHandle` com o `user.username` devolvido
 * e diz-lhe a verdade em vez de continuar a mostrar o que ela escolheu.
 */
export async function createAccount(input: {
  name: string
  e164: string
  countryCode: string
  password: string
  handle?: string
}): Promise<{ user: User; assignedHandle: string | null }> {
  await useAuthStore.getState().register(
    input.name,
    input.e164,
    input.countryCode,
    input.password,
    input.password,
    input.handle,
  )
  const user = useAuthStore.getState().user
  if (!user) throw new Error('')
  return { user, assignedHandle: displayHandle(user.username) || null }
}

export function currentUser(): User | null {
  return useAuthStore.getState().user
}

export function isAuthenticated(): boolean {
  return useAuthStore.getState().isAuthenticated
}

/** Restaura a sessão guardada. O A00 espera por isto antes de decidir o destino. */
export async function restoreSession(): Promise<User | null> {
  await useAuthStore.getState().loadUser()
  return useAuthStore.getState().user
}

/** Sair da conta em que se entrou — o "Trocar conta" do A03. */
export async function signOut(): Promise<void> {
  await useAuthStore.getState().logout()
}
