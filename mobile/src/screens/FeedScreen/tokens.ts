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
  /** Caixa das ações nas duas feeds; PostActionIcon centra nela o desenho de 28px. */
  action: 32,
  /** Sobreposições no centro da mídia — play de vídeo. */
  overlay: 64,
  /** O coração do duplo toque. Não é um ícone, é um gesto a confirmar-se. */
  burst: 104,
} as const

/**
 * O desenho de um ícone de acção dentro da sua caixa.
 *
 * `feedIcon.action` (32) é a caixa que fixa os centros e a cadência das duas
 * feeds; o desenho fica em 28 para o comando não competir com o conteúdo.
 * `PostActionIcon` centra um no outro — e o número vive aqui, e não numa
 * constante privada do componente, porque as duas feeds precisam dele para
 * alinhar margens (ver `FEED_GLYPH_INK_INSET`).
 */
export const FEED_GLYPH = 28

/**
 * O vazio entre a borda da caixa da acção e a tinta do glifo.
 *
 * Os SVG vivem numa grelha 24×24 com margem 3 de cada lado: a tinta ocupa
 * 18/24 — 75% do desenho. A 28px são 21 de tinta, mais os 2 que a caixa de 32
 * deixa à volta: 5,5 de vazio em cada lado.
 *
 * Sem este número, encostar um ícone à mesma régua do texto é adivinhar — era o
 * que a Home fazia com `SIDE - 4` na fila de acções e `-6` no menu, dois
 * palpites diferentes para a mesma pergunta. Com ele, quem quer a tinta na
 * margem escreve `SIDE - FEED_GLYPH_INK_INSET` e acerta.
 */
export const FEED_GLYPH_INK_INSET = (feedIcon.action - FEED_GLYPH * 0.75) / 2

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
 * A altura da coluna com `items` acções, do fundo da caixa do último ao topo
 * do primeiro.
 *
 * Para quem desenha por baixo da coluna e precisa de saber até onde ela sobe
 * sem a medir: a cadência é fixa, por isso a conta é exacta.
 */
export function feedRailHeight(items: number): number {
  return items * feedRail.itemHeight + Math.max(0, items - 1) * feedRail.itemGap
}

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

/**
 * Tipografia da Home.
 *
 * A escada global (`typography`/`leading`) tem cinco degraus e uma razão para
 * os ter: uma régua de 1 em 1 não é escada nenhuma. Mas o Feed System fixa a
 * hierarquia da página numa cadência mais apertada — 13, 12, 11, 10 — e ela
 * fecha em si mesma: o nome pesa acima da legenda por 1pt e por 300 de peso, o
 * contexto e o contador ficam abaixo de ambos.
 *
 * Fica aqui, ao lado do `feedType` que já faz o mesmo pela imersiva, e não
 * espalhado por `HomeFeedItem`: são os papéis de uma superfície, medidos uma vez.
 * Quem quiser um tamanho fora desta tabela na Home está a inventar um papel que
 * a página não tem.
 */
export const homeType = {
  /** Nome de quem publicou. Uma linha, sempre. */
  username:      { fontFamily: fonts.bold,     fontSize: 13, lineHeight: 18 },
  /** Tipo da publicação, local e tempo. */
  context:       { fontFamily: fonts.medium,   fontSize: 11, lineHeight: 15 },
  /** Legenda e o texto de ligação aos comentários. */
  caption:       { fontFamily: fonts.regular,  fontSize: 12, lineHeight: 17 },
  /** O nome do autor dentro da própria legenda. */
  captionAuthor: { fontFamily: fonts.bold,     fontSize: 12, lineHeight: 17 },
  /** Contador ao lado de uma acção. */
  metric:        { fontFamily: fonts.semiBold, fontSize: 10, lineHeight: 14 },
  /** `Criar`, no cabeçalho. */
  control:       { fontFamily: fonts.bold,     fontSize: 13, lineHeight: 18 },
  /**
   * Publicação de texto. O peso não está aqui de propósito: quem o escolhe é a
   * fonte do autor (`postFontStyle`), e o conteúdo manda sobre o cromado.
   */
  textPost:      { fontSize: 22, lineHeight: 29 },
} as const

/** Traço base em unidades da grelha 24×24; escala junto com o ícone. */
export const FEED_STROKE = 1.75

/**
 * Tinta de um controlo em repouso — gostar, comentar, repostar, partilhar, o
 * menu e os atalhos que vivem na mesma fila.
 *
 * Um comando não é conteúdo: não compete com a fotografia nem com o nome de
 * quem publicou. Mas "não competir" não é o mesmo que "não se ler", e era aí
 * que o valor único de `#B4B4B4` falhava: sobre a página branca dá 2,3:1 contra
 * o fundo, e um traço de 1,75 a esse contraste desaparece à luz do dia. Sobre a
 * mídia escura o mesmo cinzento tinha o problema simétrico.
 *
 * Passa a haver um valor por superfície, como já acontecia com o estado
 * accionado (`actionInkActive`). São os dois valores que o papel pede, não dois
 * gostos: `#4D545C` dá 7,4:1 sobre branco e continua claramente abaixo do preto
 * do nome; `#F7F8F9` é a mesma tinta que o texto imersivo usa.
 */
export const actionInkRest = {
  /** Sobre a página branca da Home. */
  page: '#4D545C',
  /** Sobre mídia — a coluna da imersiva, a fila sobre um vídeo da Home. */
  media: '#F7F8F9',
} as const

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
 * A mesma escada de três degraus, do lado da página branca.
 *
 * A Home é a outra metade das duas feeds e escrevia a tinta à mão em cada linha
 * — `gray800` no nome, `gray600` no rótulo, `gray500` no tempo, e depois
 * `gray600` outra vez num ícone que não é texto nenhum. São os mesmos três
 * papéis que o `feedInk` já nomeia sobre a mídia: identidade, leitura, contexto.
 *
 * Ficam lado a lado de propósito. Quando um papel muda, muda nos dois sítios ao
 * mesmo tempo, e uma publicação continua a ler-se igual quer esteja sobre papel
 * branco ou sobre vídeo.
 */
export const pageInk = {
  /** Nome, legenda — o que identifica e o que se lê. */
  primary: '#0F1115',
  /** Contadores e rótulos que acompanham uma acção. */
  secondary: '#555C65',
  /** Tempo, @handle, contexto — o que se lê depois do resto. */
  muted: '#737B85',
} as const

/**
 * O desenho da página branca que não é texto.
 *
 * Três valores, cada um com um papel que o `pageInk` não cobre: a linha que
 * separa duas publicações, o cinzento de um espaço à espera de conteúdo, e a
 * cor de uma falha. Antes vinham de `colors.gray200`/`gray100` — degraus de uma
 * escada neutra genérica, com a mesma coisa a valer para uma borda de campo de
 * texto e para o divisor da feed.
 */
export const pageLine = '#E7E9EC'
/** Fundo de um lugar reservado: esqueleto, mídia por carregar, disco vazio. */
export const pageSkeleton = '#EEF0F2'
/**
 * O mesmo lugar reservado, sobre o fundo da imersiva.
 *
 * O `pageSkeleton` num fundo `#0B141A` era um disco quase branco a piscar antes
 * de cada fotografia chegar. Este é a superfície secundária da imersiva do Feed
 * System: um degrau acima do fundo — vê-se a forma sem se ver uma mancha.
 */
export const feedSkeleton = '#101B21'
/** Falha de carregamento, retry, erro de envio — só dentro da feed. */
export const pageDanger = '#B42318'



/**
 * A tinta de um controlo já accionado — o gosto dado, o repost feito.
 *
 * Esteve em magenta e violeta, um por acção. Duas cores de marca dentro de uma
 * fila de comandos cinzentos fazem o estado gritar mais alto que a fotografia
 * que ele comenta, e obrigavam cada ecrã a escolher qual delas usar.
 *
 * O estado passa a dizer-se com a tinta do conteúdo da superfície: preto sobre
 * a página, branco sobre a mídia. O que confirma a acção é o desenho — o
 * coração enche-se, o repost ganha o "1" — e a tinta só o sublinha, sem trazer
 * uma terceira cor para dentro da publicação.
 */
export const actionInkActive = {
  page: colors.black,
  media: feedInk.primary,
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
 * A separação de um glifo pousado sobre a mídia.
 *
 * O que o `feedTextShadow` faz pelas letras, isto faz pelo desenho: uma sombra
 * de 1px colada ao traço, para um comando a #B4B4B4 continuar a ler-se sobre uma
 * fotografia clara sem precisar de disco, de véu ou de branco.
 *
 * Estava escrita quatro vezes — duas na coluna de acções, uma no gatilho do menu
 * e outra no botão de voltar — com dois pares de valores diferentes a tentar o
 * mesmo efeito. Sobre papel branco não se usa: aí uma sombra não separa nada,
 * só suja o glifo.
 */
export const feedGlyphShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.38,
  shadowRadius: 1.8,
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
