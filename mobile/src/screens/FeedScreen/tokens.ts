import { Platform } from 'react-native'
import { colors, fonts, typography } from '../../theme'

// Instagram usa a fonte nativa do sistema, não uma display geométrica. No
// Android isto dá Roboto; no iOS, San Francisco. A marca continua no wordmark e
// nos ícones — o texto funcional deixa o conteúdo falar.
const FEED_UI_FONT_MEDIUM = Platform.select({
  android: 'sans-serif-medium',
  ios: 'System',
  default: fonts.medium,
}) ?? fonts.medium

const FEED_UI_FONT_BOLD = Platform.select({
  android: 'sans-serif',
  ios: 'System',
  default: fonts.bold,
}) ?? fonts.bold

// O nome é o único texto da publicação que recebe o peso máximo. No Android,
// `sans-serif-black` aponta para o corte 900 real do Roboto; assim não dependemos
// de um 700 sintetizado para tentar criar hierarquia.
const FEED_UI_FONT_BLACK = Platform.select({
  android: 'sans-serif-black',
  ios: 'System',
  default: fonts.extraBold,
}) ?? fonts.extraBold

/** Caixas por papel; todos os SVG usam grelha 24×24 e traço de 1.75. */
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
  /** Ações de publicação, com a mesma caixa na Home e na Feed imersiva. */
  action: 32,
  /** Sobreposições no centro da mídia — play de vídeo. */
  overlay: 64,
  /** O coração do duplo toque. Não é um ícone, é um gesto a confirmar-se. */
  burst: 104,
} as const

/**
 * Geometria da coluna de acções.
 *
 * A coluna precisa de uma cadência, não de alturas escolhidas por componente.
 * Cada item ocupa 54pt e deixa 6pt até ao seguinte: os centros dos glifos
 * ficam sempre a 60pt uns dos outros. Dentro do item, 32 + 4 + 16 reserva a
 * mesma caixa para glifo e métrica, mesmo quando a métrica está vazia. Sobra
 * 1pt em cima e em baixo e o alvo táctil continua bem acima dos 44pt mínimos.
 */
export const feedRail = {
  width: 64,
  itemHeight: 54,
  itemGap: 6,
  iconStageWidth: 48,
  iconStageHeight: feedIcon.action,
  iconToMetricGap: 4,
  metricSlotHeight: 16,
} as const

/**
 * O vazio entre o fundo da caixa do último item da coluna e a tinta do ícone.
 *
 * Todos os itens da coluna medem o mesmo: o ícone em cima, uma folga e o espaço
 * do contador por baixo — reservado mesmo nas acções que não têm número, senão
 * os ícones deixavam de assentar na mesma grelha. O efeito é que a tinta do
 * último ícone fica bem acima do fundo da sua caixa.
 *
 * À esquerda não há nada disto: a última linha de texto acaba onde a caixa
 * acaba. Encostar as duas caixas ao mesmo fundo, como se fez antes, punha os
 * ícones 22pt acima do texto — que é precisamente a distância que este valor
 * mede, e que agora o bloco do autor usa para subir até à mesma linha.
 *
 * Derivado e não escrito à mão: se um dos degraus da coluna mudar, esta conta
 * muda com ele e o alinhamento não se desfaz em silêncio.
 */
export const feedRailTailInset = (
  (feedRail.itemHeight - (feedRail.iconStageHeight + feedRail.iconToMetricGap + feedRail.metricSlotHeight)) / 2
  + feedRail.iconToMetricGap
  + feedRail.metricSlotHeight
)

/**
 * Largura máxima da coluna editorial da pausa do Círculo e do CTA que a fecha.
 * Partilhar a medida mantém as duas margens na mesma régua também em ecrãs
 * largos; no telemóvel, ambas continuam simplesmente a 16px das bordas.
 */
export const FEED_CONTENT_MAX_WIDTH = 390

/**
 * Tipografia do cromado da Feed.
 *
 * Três tamanhos, mais o título curto e o badge técnico. A altura nunca cresce:
 * todos os papéis abaixo são iguais ou menores que os valores que substituem.
 * Os tamanhos e as alturas ficam intactos. A publicação ganha dois papéis
 * explícitos: `author` em 900 e `content` em 700. Os controlos continuam em 700;
 * contexto e métricas ficam em 500. A hierarquia deixa de depender de diferenças
 * quase imperceptíveis sem tornar nenhuma linha maior.
 */
export const feedType = {
  title: {
    fontFamily: FEED_UI_FONT_BOLD,
    fontWeight: '700',
    fontSize: typography.section,
    lineHeight: 21,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  author: {
    fontFamily: FEED_UI_FONT_BLACK,
    fontWeight: '900',
    fontSize: typography.secondary,
    lineHeight: 17,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  primary: {
    fontFamily: FEED_UI_FONT_BOLD,
    fontWeight: '700',
    fontSize: typography.secondary,
    lineHeight: 17,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  content: {
    fontFamily: FEED_UI_FONT_BOLD,
    fontWeight: '700',
    fontSize: typography.secondary,
    lineHeight: 17,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  copy: {
    fontFamily: FEED_UI_FONT_MEDIUM,
    fontWeight: '500',
    fontSize: typography.secondary,
    lineHeight: 17,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  meta: {
    fontFamily: FEED_UI_FONT_MEDIUM,
    fontWeight: '500',
    fontSize: typography.meta,
    lineHeight: 14,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  badge: {
    fontFamily: FEED_UI_FONT_MEDIUM,
    fontWeight: '500',
    fontSize: typography.badge,
    lineHeight: 11,
    letterSpacing: 0,
    includeFontPadding: false,
  },
} as const

/** Traço base em unidades da grelha 24×24; escala junto com o ícone. */
export const FEED_STROKE = 1.75

/**
 * Tinta dos controlos de uma publicação — gostar, comentar, repostar, partilhar,
 * o menu e os atalhos que vivem na mesma fila.
 *
 * Um só cinzento, e é essa a razão de existir. Já esteve partido em dois — quase
 * preto sobre o papel da Home, branco sobre a fotografia — e isso é decidir a
 * tinta pelo fundo em vez de pelo papel do glifo. Um comando não é conteúdo: não
 * compete com a fotografia nem com o nome de quem publicou, e a partir do momento
 * em que a tinta é a mesma nos dois sítios deixa de haver uma escolha por ecrã.
 *
 * Sobre mídia não precisa de branco para se ler: por baixo da fila corre sempre
 * um véu, e é ele que segura o contraste.
 *
 * Os estados accionados continuam a ter cor própria — o coração gostado, o
 * repost feito. É o repouso que é neutro.
 */
export const ACTION_INK = '#B4B4B4'

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
 * a fotografia. Uma sombra de 1px fica colada ao glifo: preserva contraste sem
 * engrossar nem desfocar a letra, que era o que o antigo raio de 3px fazia.
 *
 * É a mesma que o FeedHeader já pratica, para o topo e o fundo do ecrã tratarem
 * o texto da mesma maneira.
 *
 * Nota honesta: isto não é medível pela régua do WCAG, que só sabe comparar duas
 * cores planas. Na prática resolve; numa auditoria formal, o número que conta
 * continua a ser o do véu.
 */
export const feedTextShadow = {
  textShadowColor: 'rgba(0,0,0,0.48)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 1,
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
