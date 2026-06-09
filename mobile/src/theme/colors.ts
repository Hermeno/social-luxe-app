export const colors = {
  primary:      '#4C8CE4',
  primaryLight: '#74A7EC',
  secondary:    '#00C48C',
  accent:       '#EC4899',

  black:        '#000000',
  white:        '#FFFFFF',
  offWhite:     '#F8F8FA',

  gray100: '#F5F5F7',
  gray200: '#EAEAEA',
  gray300: '#D1D1D6',
  gray400: '#ABABAB',
  gray500: '#808080',
  gray600: '#555555',
  gray800: '#1A1A1A',
  dark:    '#1A1A1A',

  overlay:      'rgba(0,0,0,0.4)',
  overlayLight: 'rgba(0,0,0,0.2)',
  transparent:  'transparent',
}

export const gradients = {
  feedBottom: ['transparent', 'rgba(0,0,0,0.92)'] as const,
  feedTop:    ['rgba(0,0,0,0.28)', 'transparent'] as const,
  tabBar:     ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.92)'] as const,
}
