// Interruptores de funcionalidade.
//
// Servem para tirar uma feature das mãos dos utilizadores sem apagar o código
// nem mexer no servidor. Pôr a `true` volta a ligá-la — as rotas da API, os
// serviços e os ecrãs continuam todos lá.

/**
 * União — conta partilhada por duas pessoas, com perfil e conversa próprios.
 *
 * Desligada na primeira versão de testes: é a feature com mais superfície por
 * explicar e a que menos gente vai ter condições de experimentar (precisa de
 * duas pessoas a aceitar antes de existir sequer alguma coisa para ver).
 */
export const UNION_ENABLED = false
