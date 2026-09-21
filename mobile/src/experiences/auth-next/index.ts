/**
 * Luxey — experiência de autenticação, identidade e personalização.
 *
 * Superfície pública do módulo. Quem o monta só precisa de duas coisas: o
 * componente e a forma do resultado.
 *
 *   import AuthNextExperience from './experiences/auth-next'
 *
 *   <AuthNextExperience onComplete={({ reason }) => { ... }} />
 *
 * O módulo não decide para onde se vai a seguir. Home, feed, perfil e navegação
 * principal não lhe pertencem — `onComplete` é a fronteira.
 */
export { default } from './AuthNextExperience'
export { default as AuthNextExperience } from './AuthNextExperience'
export type { AuthNextProps } from './AuthNextExperience'
export type { Step } from './state/flow'
export { ThemeProvider, useTheme } from './theme/ThemeProvider'
export { I18nProvider, useI18n, useT } from './i18n'
