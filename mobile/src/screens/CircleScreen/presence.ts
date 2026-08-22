// Quem avisa que alguém já disparou depende de onde o utilizador está.
//
// Com o ecrã do Círculo à frente, quem avisa é a faixa dentro do ecrã — vê-se
// o círculo todo e o relógio da ronda. Fora dele, quem avisa é uma notificação
// do sistema, senão o minuto passava sem se dar por nada.
//
// Este sinalizador é o que separa os dois casos. Fica fora do estado do React
// de propósito: é lido pelo RootNavigator dentro de um handler de socket, onde
// re-renderizar não serve para nada.
let active = false

export function setCircleScreenActive(value: boolean): void {
  active = value
}

export function isCircleScreenActive(): boolean {
  return active
}
