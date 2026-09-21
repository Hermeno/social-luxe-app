/**
 * Assinatura cromática oficial da Luxey.
 *
 * Os cinco pontos foram amostrados da referência: azul à esquerda, violeta no
 * centro e magenta à direita. É uma progressão linear — não um espectro de oito
 * cores — e fica reservada aos anéis de identidade.
 */
export const brandPalette = {
  blue:    '#2F49FD',
  indigo:  '#4F4AFB',
  violet:  '#7A47F5',
  purple:  '#A544ED',
  magenta: '#C846E2',
  // Sem `as const`: com ele cada valor ganhava o seu próprio tipo literal e um
  // `useState(brandPalette.blue)` passava a só aceitar `'#2F49FD'` — o ecrã de
  // Aparência, que guarda o acento escolhido, deixava de compilar.
}

export const colors = {
  // A interface é neutra por defeito. Cor de marca exige um papel explícito
  // (`accent`, `heart`, estado semântico ou gradiente), nunca um botão genérico.
  primary:      '#000000',
  primaryMid:   '#1A1A1A',
  primaryLight: '#D1D1D6',
  secondary:    '#555555',
  // Violeta é o ponto sólido da assinatura usado por controlos; a progressão
  // completa pertence aos anéis.
  accent:       brandPalette.violet,

  black:        '#000000',
  white:        '#FFFFFF',
  offWhite:     '#FAF8F6',

  // Campo de comentário embutido na navigation.
  //
  // É a segunda superfície da imersiva: um degrau acima de `feedSurface`, para
  // o campo se ler como objecto pousado sobre o fundo em vez de um buraco nele.
  // O tom é o do Feed System (#101B21); a transparência de 4% fica porque a
  // barra atravessa mídia e um sólido cortava a fotografia a direito.
  commentField: 'rgba(16,27,33,0.96)',

  // Fundo da feed principal — e SÓ da feed. É o que se vê por trás dos posts,
  // nas faixas acima e abaixo de imagens que não enchem a altura, e na tab bar
  // enquanto a feed está aberta. O resto da app continua branco.
  //
  // Ponto único: toda a feed lê daqui (célula, media, álbum, ecrã vazio e tab
  // bar). É uma das duas excepções cromáticas mantidas por decisão de produto.
  feedSurface: '#0B141A',
  // Aliases antigos permanecem por compatibilidade, mas já não introduzem
  // outras cores na plataforma.
  feedSurfaceSlate:    '#0B141A',
  feedSurfaceGraphite: '#0B141A',

  gray100: '#F7F7F7',
  gray200: '#EAEAEA',
  gray300: '#D1D1D6',
  gray400: '#ABABAB',
  gray500: '#808080',
  gray600: '#555555',
  gray800: '#1A1A1A',   // texto principal — preto nítido (era #333, parecia mole)
  dark:    '#000000',

  // Fallback sólido para contextos que não conseguem desenhar o espectro. Os
  // anéis de avatar reais usam `gradients.avatarRing`.
  ring:         brandPalette.violet,
  ringMuted:    'rgba(0,0,0,0.12)',   // quem não publicou

  overlay:      'rgba(0,0,0,0.4)',
  overlayLight: 'rgba(0,0,0,0.2)',
  transparent:  'transparent',

  // Estados funcionais usam geometria, texto e posição para comunicar o papel;
  // a cor fica deliberadamente dentro da paleta oficial.
  error:   brandPalette.purple,
  success: brandPalette.blue,
  warning: brandPalette.violet,
  info:    brandPalette.indigo,

  // Cores semânticas de features
  heart: brandPalette.magenta,
  gold:  brandPalette.violet,
}

/**
 * As folhas claras que assentam sobre a Feed escura.
 *
 * O painel de pesquisa, a folha de opções do post e o modal de publicações do
 * autor são superfícies claras dentro de um ecrã escuro, e cada uma tinha
 * inventado os seus cinzentos: quarenta hexadecimais espalhados por três
 * ficheiros, com quatro contornos entre `#D1D1CC` e `#E7E7E3` e sete pretos
 * entre `#0A0A0A` e `#343538`. Nenhum par distinguível a olho, todos diferentes
 * no código — que é a definição de valor arbitrário.
 *
 * Sete degraus cobrem os quarenta. São cinzentos quentes de propósito: a marca
 * é fria (azul→magenta) e uma folha morna afasta-se dela em vez de lhe competir.
 */
export const sheet = {
  /** Fundo da folha. */
  surface:     '#FCFCFA',
  /** Um degrau abaixo — campo de pesquisa, linha seleccionada, célula vazia. */
  surfaceSunk: '#F2F2EF',
  /** Contorno e separadores. */
  line:        '#E1E1DD',
  /** Contorno que precisa de se ler sobre `surfaceSunk`. */
  lineStrong:  '#D5D4D0',
  /** Título, nome, ícone de navegação. */
  ink:         '#17181B',
  /** Corpo de texto — um degrau abaixo do título, ainda a preto. */
  inkSoft:     '#2A2A2E',
  /** Legenda, contexto, rótulo secundário. */
  inkMuted:    '#77787C',
  /** Marca de água — ícone de imagem em falta, estado vazio. */
  inkFaint:    '#A8AAAD',
} as const

export const gradients = {
  brand:      [brandPalette.blue, brandPalette.indigo, brandPalette.violet, brandPalette.purple, brandPalette.magenta] as const,
  /**
   * Anel oficial: a ordem acompanha a referência da esquerda para a direita.
   * `BrandAvatarRing` aplica estes pontos num gradiente linear horizontal.
   */
  avatarRing: [
    brandPalette.blue,
    brandPalette.indigo,
    brandPalette.violet,
    brandPalette.purple,
    brandPalette.magenta,
  ] as const,
  feedBottom: ['transparent', 'rgba(0,0,0,0.92)'] as const,
  // O véu da feed (`feedVeil`/`feedVeilStops`) viveu aqui com vinte linhas de
  // raciocínio e zero utilizações: o scrim foi removido por decisão de produto —
  // a mancha escura via-se — e o contraste passou para `feedTextShadow`, um halo
  // colado às letras. Um token morto com raciocínio escrito é pior que nenhum:
  // lê-se como se estivesse em uso. Se o scrim voltar, volta com ele.
  feedTop:    ['rgba(0,0,0,0.28)', 'transparent'] as const,
  tabBar:     ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.92)'] as const,
}
