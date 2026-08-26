/**
 * Ícones da Feed — tamanho e espessura.
 *
 * Antes disto a Feed tinha 14 tamanhos de ícone diferentes (9, 10, 12, 13, 14,
 * 17, 19, 20, 21, 28, 30, 34, 46, 62) e três famílias a coexistir no mesmo ecrã:
 * `FeedIcon`, o `Icon` do design system e `Ionicons` do @expo/vector-icons.
 * Três grelhas, três espessuras, três maneiras de desenhar o mesmo contorno.
 *
 * Quatro degraus chegam para toda a Feed. Cada um existe porque tem um papel
 * diferente, não porque alguém precisou de um valor intermédio.
 */
export const feedIcon = {
  /** Emblemas dentro de uma forma de tamanho fixo — megafone, dispositivo. */
  inline: 12,
  /** Ícones que acompanham texto numa linha — setas, chevrons. */
  small: 16,
  /** Coluna de acções do post e navegação. O mesmo valor nos dois, que era a
   *  intenção original escrita na TabBar e que se tinha perdido (rail a 30). */
  action: 28,
  /** Sobreposições no centro da mídia — play de vídeo. */
  overlay: 64,
  /** O coração do duplo toque. Não é um ícone, é um gesto a confirmar-se. */
  burst: 104,
} as const

/**
 * Espessura ótica dos contornos, em px do tamanho renderizado.
 *
 * 1.9 px a 28 px de caixa dá a mesma razão que o Instagram pratica (2 px numa
 * grelha de 24) — o traço lê-se limpo sobre fotografia sem engrossar o desenho.
 * Passa-se via `strokePx` do FeedIcon, que converte para as unidades da caixa
 * de cada desenho: é isto que faz famílias diferentes terem a mesma espessura.
 */
export const FEED_STROKE = 1.9

/**
 * Tinta do texto sobre a mídia.
 *
 * A Feed tinha doze níveis de branco transparente — 0.95, 0.94, 0.92, 0.90,
 * 0.88, 0.78, 0.72, 0.68, 0.65, 0.62, 0.58, 0.22 — nenhum deles token. Com doze
 * valores espalhados por catorze ficheiros não há como verificar contraste:
 * são doze medições em vez de três.
 *
 * Três níveis chegam. O véu de legibilidade por baixo faz o trabalho pesado;
 * estes só precisam de separar três graus de importância, não de compensar um
 * fundo imprevisível.
 */
export const feedInk = {
  /** Nome do autor. O que identifica a publicação nunca é transparente. */
  primary: '#FFFFFF',
  /** Descrição e controlos de texto. */
  secondary: 'rgba(255,255,255,0.96)',
  /**
   * Contexto, tempo, contadores — tudo o que se lê depois do resto.
   *
   * Esteve em 0.58 e depois em 0.62, quando havia um véu escuro por baixo a
   * segurar o contraste. Sem véu, quem segura é a sombra colada às letras, e aí
   * mais transparência não acrescenta hierarquia nenhuma: só apaga o texto.
   * A hierarquia faz-se no tamanho e no peso; 0.78 chega para a distinguir.
   */
  muted: 'rgba(255,255,255,0.78)',
} as const

/**
 * Sombra do texto sobre a mídia.
 *
 * Um véu escuro grande o suficiente para dar contraste lê-se como mancha e suja
 * a fotografia. Esta sombra faz o mesmo trabalho num raio de 3px à volta das
 * letras: o olho não a vê como sombra — vê o texto mais nítido — mas o contraste
 * local sobe o suficiente para branco assentar sobre qualquer foto.
 *
 * É a mesma que o FeedHeader já pratica, para o topo e o fundo do ecrã tratarem
 * o texto da mesma maneira.
 *
 * Nota honesta: isto não é medível pela régua do WCAG, que só sabe comparar duas
 * cores planas. Na prática resolve; numa auditoria formal, o número que conta
 * continua a ser o do véu.
 */
export const feedTextShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const
