/**
 * O nome de utilizador tal como se mostra: sem `@` à frente.
 *
 * O prefixo saiu de toda a app — da autenticação ao último ecrã. Quem mostra um
 * handle passa por aqui em vez de o escrever à mão, por dois motivos: para não
 * voltar a aparecer um `@` esquecido num ecrã qualquer, e porque há valores
 * gravados que já trazem o `@` colado (a base não os normaliza) — a limpeza
 * tem de existir num sítio só.
 */
export function displayHandle(username: string | null | undefined): string {
  return (username ?? '').trim().replace(/^@+/, '')
}
