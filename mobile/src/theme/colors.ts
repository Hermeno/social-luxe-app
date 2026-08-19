export const colors = {
  primary:      '#FF7A1C',
  primaryMid:   '#FF6766',
  primaryLight: '#FFB173',
  secondary:    '#FFB173',
  accent:       '#FF7A1C',

  black:        '#000000',
  white:        '#FFFFFF',
  offWhite:     '#F7F7F7',

  // Campo de comentário embutido na navigation
  commentField: '#fff',

  // Fundo da feed principal — e SÓ da feed. É o que se vê por trás dos posts,
  // nas faixas acima e abaixo de imagens que não enchem a altura, e na tab bar
  // enquanto a feed está aberta. O resto da app continua branco.
  //
  // Ponto único: toda a feed lê daqui (célula, media, álbum, ecrã vazio e tab
  // bar), por isso trocar é mexer numa linha só. Em experimentação — os valores
  // já testados ficam abaixo e nenhum se apaga enquanto a escolha não assentar.
  // feedSurface: '#1F2C34',
  feedSurface: '#0B141A',
  feedSurfaceSlate:    '#1C252C',   // azul-ardósia — o original, até 19/08/2026
  feedSurfaceGraphite: '#111314',   // grafite frio — 19/08/2026

  gray100: '#F7F7F7',
  gray200: '#EAEAEA',
  gray300: '#D1D1D6',
  gray400: '#ABABAB',
  gray500: '#808080',
  gray600: '#555555',
  gray800: '#1A1A1A',   // texto principal — preto nítido (era #333, parecia mole)
  dark:    '#000000',

  // Anéis à volta de avatares. Preto suave, nunca carmim: o anel emoldura o
  // rosto em vez de competir com ele. O carmim fica para acções.
  ring:         'rgba(0,0,0,0.55)',
  ringMuted:    'rgba(0,0,0,0.12)',   // quem não publicou

  overlay:      'rgba(0,0,0,0.4)',
  overlayLight: 'rgba(0,0,0,0.2)',
  transparent:  'transparent',

  // Cores funcionais — uma de cada, sempre estas
  error:   '#FF3B30',
  success: '#22C55E',
  warning: '#F59E0B',

  // Cores semânticas de features
  heart: '#FF4B6E',   // likes / love no feed escuro
  gold:  '#B8860B',   // reservado / destaque premium
}

export const gradients = {
  brand:      ['#FF7A1C', '#FF6766', '#FFB173'] as const,
  feedBottom: ['transparent', 'rgba(0,0,0,0.92)'] as const,
  feedTop:    ['rgba(0,0,0,0.28)', 'transparent'] as const,
  tabBar:     ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.92)'] as const,
}
