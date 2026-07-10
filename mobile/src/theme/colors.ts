export const colors = {
  primary:      '#CA2851',
  primaryMid:   '#FF6766',
  primaryLight: '#FFB173',
  secondary:    '#FFB173',
  accent:       '#CA2851',

  black:        '#000000',
  white:        '#FFFFFF',
  offWhite:     '#F7F7F7',

  gray100: '#F7F7F7',
  gray200: '#EAEAEA',
  gray300: '#D1D1D6',
  gray400: '#ABABAB',
  gray500: '#808080',
  gray600: '#555555',
  gray800: '#333333',
  dark:    '#000000',

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
  brand:      ['#CA2851', '#FF6766', '#FFB173'] as const,
  feedBottom: ['transparent', 'rgba(0,0,0,0.92)'] as const,
  feedTop:    ['rgba(0,0,0,0.28)', 'transparent'] as const,
  tabBar:     ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.92)'] as const,
}
