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
  /**
   * Dentro de uma forma pequena e fixa — o emblema de câmara sobre o botão de
   * criar, de 17px. A mesma excepção que `typography.badge` abre para o texto:
   * aqui o tamanho é ditado pela forma que o contém, não pela leitura.
   */
  badge: 9,
  /** Emblemas dentro de uma forma de tamanho fixo — megafone, dispositivo. */
  inline: 12,
  /** Ícones que acompanham texto numa linha — setas, chevrons. */
  small: 16,
  /**
   * Glifos dentro de um controlo — cabeçalho, campo de pesquisa, linhas de menu.
   *
   * O degrau que faltava. Entre `small` e `action` havia um vão de 12px que a
   * interface real precisava de preencher, e preenchia-o à mão: 17, 19, 20 e 21
   * em treze sítios diferentes, todos a desenhar o mesmo papel. Quatro valores
   * a disputar uma posição é o sintoma de um degrau em falta, não de quatro
   * decisões.
   */
  control: 20,
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

/**
 * Os traços e as folgas claras sobre a mídia — tudo o que é desenho e não texto.
 *
 * O `feedInk` acima resolve a tinta; os contornos e os preenchimentos ficaram de
 * fora e continuaram a multiplicar-se: 0.14, 0.18, 0.22, 0.28, 0.42, 0.45, 0.46,
 * 0.85, 0.88, 0.92, 0.95. Forçá-los para dentro do `feedInk` seria errado — um
 * contorno de 1px e uma letra não precisam do mesmo contraste para se lerem — mas
 * deixá-los soltos era o mesmo problema com outro nome.
 */
export const feedLine = {
  /** Anel à volta de um rosto, halo do duplo toque — traço que se quer ver. */
  bright: 'rgba(255,255,255,0.88)',
  /** Contorno de um botão sobre a mídia. Abaixo disto some-se em foto clara. */
  strong: 'rgba(255,255,255,0.46)',
  /** Separador entre dois controlos da mesma linha. */
  medium: 'rgba(255,255,255,0.28)',
  /** O mesmo separador quando o estado já não precisa de se anunciar. */
  subtle: 'rgba(255,255,255,0.18)',
} as const

export const feedFill = {
  /** Preenchimento activo — traço de progresso, ponto da página actual. */
  solid: 'rgba(255,255,255,0.92)',
  /** A calha por baixo do preenchimento. Lê-se como sulco, não como barra. */
  track: 'rgba(255,255,255,0.22)',
  /** Realce enquanto o dedo está em cima. */
  press: 'rgba(255,255,255,0.14)',
} as const

/**
 * A folga que o conteúdo deixa à coluna de acções, do lado direito.
 *
 * A rail mede 64 e encosta à margem. O texto do autor parava a 78, os avatares
 * de quem comentou a 74 e o traço do tempo atravessava por baixo dos dois — três
 * respostas para a mesma pergunta, e só uma pode estar certa. 78 dá 14px de ar
 * entre a legenda e o primeiro ícone: chega para não se tocarem e não desperdiça
 * largura de leitura.
 */
export const RAIL_CLEARANCE = 78
