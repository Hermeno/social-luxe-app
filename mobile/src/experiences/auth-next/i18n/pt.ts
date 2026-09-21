/**
 * O dicionário português do módulo.
 *
 * Escrito de raiz — o módulo não edita nem herda o `i18n/` da aplicação. O tom é
 * o de alguém a explicar uma tarefa, não a vendê-la: frases curtas, factuais,
 * sem entusiasmo fabricado e sem prometer nada que o ecrã não faça.
 */
export const PT = {
  // ── Comum ────────────────────────────────────────────────────────────────
  continue: 'Continuar',
  back: 'Voltar',
  close: 'Fechar',
  cancel: 'Cancelar',
  skip: 'Pular',
  skipForNow: 'Ignorar por agora',
  retry: 'Tentar novamente',
  loading: 'A carregar',
  search: 'Pesquisar',
  clear: 'Limpar',
  brand: 'Luxey',

  // ── Erros partilhados ────────────────────────────────────────────────────
  errOffline: 'Sem ligação à internet.',
  errTimeout: 'A ligação demorou demasiado.',
  errUnknown: 'Não foi possível completar a operação.',

  // ── A00 Arranque ─────────────────────────────────────────────────────────
  bootLabel: 'A preparar a aplicação',

  // ── A01 Telefone ─────────────────────────────────────────────────────────
  phoneTitle: 'Qual é o seu número de telefone?',
  phoneIntro: 'Vamos verificar se já existe uma conta.',
  phoneLabel: 'Número de telefone',
  phonePlaceholder: 'Número de telefone',
  phoneCountryLabel: 'Indicativo do país',
  phoneTooShort: 'Introduza o número completo.',
  phoneCheckFailed: 'Não foi possível verificar este número.',
  // Informativo, não um link: não há destinos reais para onde enviar ninguém.
  legalPrefix: 'Ao continuar, aceita os nossos ',
  legalTerms: 'Termos de Utilização',
  legalAnd: ' e a ',
  legalPrivacy: 'Política de Privacidade',

  // ── A02 Países ───────────────────────────────────────────────────────────
  countryTitle: 'Selecionar país',
  countrySearch: 'Pesquisar país ou indicativo',
  countryEmpty: 'Nenhum país corresponde a essa pesquisa.',
  countrySelected: 'Selecionado',

  // ── A03 Entrar ───────────────────────────────────────────────────────────
  signInTitle: 'Bem-vindo de volta',
  signInIntro: 'Introduza a sua palavra-passe para entrar na sua conta.',
  signInPasswordLabel: 'Palavra-passe',
  signInAction: 'Entrar',
  signInSwitch: 'Trocar conta',
  signInEmpty: 'Introduza a sua palavra-passe.',
  signInFailed: 'Não foi possível entrar.',
  passwordShow: 'Mostrar palavra-passe',
  passwordHide: 'Ocultar palavra-passe',

  // ── A04 Criar senha ──────────────────────────────────────────────────────
  passwordTitle: 'Crie a sua senha',
  passwordIntro: 'Escolha uma senha segura para proteger a sua conta.',
  passwordLabel: 'Senha',
  ruleLength: 'Pelo menos 8 caracteres',
  ruleNumber: 'Pelo menos um número',
  ruleUpper: 'Pelo menos uma letra maiúscula',
  ruleMet: 'cumprido',
  rulePending: 'por cumprir',

  // ── A05 Identidade ───────────────────────────────────────────────────────
  identityTitle: 'Qual é a sua identidade?',
  identityIntro: 'Este é o nome que aparecerá no seu perfil. O identificador é opcional.',
  nameLabel: 'Nome',
  namePlaceholder: 'O seu nome',
  nameTooShort: 'O nome precisa de pelo menos 2 caracteres.',
  handleLabel: 'Identificador (opcional)',
  handlePlaceholder: 'Escolha nas sugestões',
  handleSuggestions: 'Sugestões de identificadores',
  handleRefresh: 'Ver outras sugestões',
  handleLoading: 'A procurar identificadores',
  handleNone: 'Sem sugestões para este nome.',
  handleFailed: 'Não foi possível obter sugestões. Pode continuar sem identificador.',
  handleNote: 'O identificador é opcional e as sugestões não garantem reserva.',
  handleReassigned: 'O servidor atribuiu o identificador {handle}.',
  registerFailed: 'Não foi possível criar a conta.',
  createAccount: 'Criar conta',

  // ── P01 Fotografia ───────────────────────────────────────────────────────
  photoTitle: 'Adicione uma fotografia',
  photoIntro: 'Uma boa foto ajuda outras pessoas a reconhecerem-no.',
  photoTake: 'Tirar fotografia',
  photoPick: 'Escolher da galeria',
  photoRetake: 'Trocar fotografia',
  photoUse: 'Usar esta fotografia',
  photoEmptyLabel: 'Sem fotografia',
  photoUploading: 'A enviar fotografia',
  photoUploadFailed: 'Não foi possível enviar a fotografia.',
  photoPermCamera: 'A Luxey precisa de acesso à câmara para tirar esta fotografia.',
  photoPermGallery: 'A Luxey precisa de acesso à galeria para escolher esta fotografia.',
  photoPermOpen: 'Abrir definições',

  // ── P02 Interesses ───────────────────────────────────────────────────────
  interestsTitle: 'Quais são os seus interesses?',
  interestsIntro: 'Escolha pelo menos 3 interesses para personalizar a sua experiência.',
  interestsNeed: 'Escolha pelo menos 3.',
  interestsNeedMore: '{count} selecionados · escolha mais {missing}',
  interestsNeedOne: '{count} selecionados · escolha mais 1',
  interestsChosen: '{count} selecionados',
  interestsSaveFailed: 'Não foi possível guardar os seus interesses.',

  // ── P03 Sugestões ────────────────────────────────────────────────────────
  suggestionsTitle: 'Veja algumas sugestões para seguir',
  suggestionsIntro: 'Conecte-se com pessoas que partilham dos mesmos interesses. É opcional.',
  suggestionsFollowAll: 'Seguir todos',
  suggestionsSkip: 'Continuar sem seguir ninguém',
  suggestionsDone: 'Continuar',
  follow: 'Seguir',
  following: 'A seguir',
  followFailed: 'Não foi possível seguir {name}.',
  followAllPartial: 'Algumas pessoas não puderam ser seguidas.',
  suggestionsEmpty: 'Ainda não temos sugestões para si.',
  suggestionsFailed: 'Não foi possível carregar as sugestões.',
  commonInterests: 'Interesses em comum: {list}',

  // ── L01 Idioma ───────────────────────────────────────────────────────────
  languageTitle: 'Qual é o seu idioma preferido?',
  languageIntro: 'Pode alterar esta opção mais tarde nas definições da aplicação.',
  languagePt: 'Português',
  languagePtSub: 'A nossa língua principal',
  languageEn: 'English',
  languageEnSub: 'A global community',
  preview: 'Pré-visualização',
  previewGreeting: 'Olá!',
  previewBody: 'Bem-vindo à Luxey. Uma comunidade de pessoas reais, com interesses reais.',

  // ── X01 Aparência ────────────────────────────────────────────────────────
  appearanceTitle: 'Personalize a sua experiência',
  appearanceIntro: 'Escolha a aparência que mais combina consigo. É opcional e pode alterar mais tarde.',
  themeLabel: 'Tema',
  themeLight: 'Claro',
  themeDark: 'Escuro',
  themeAuto: 'Auto',
  textSizeLabel: 'Tamanho do texto',
  sizeXs: 'Muito pequeno',
  sizeSm: 'Pequeno',
  sizeMd: 'Médio',
  sizeLg: 'Grande',
  sizeXl: 'Muito grande',
  accentLabel: 'Cor de destaque',
  accentBlue: 'Azul',
  accentIndigo: 'Índigo',
  accentViolet: 'Violeta',
  accentPurple: 'Púrpura',
  accentMagenta: 'Magenta',
  appearanceSave: 'Guardar preferências',
  appearanceSkip: 'Continuar sem personalizar',
  // O alcance real da escolha, dito no ecrã em vez de prometido em silêncio.
  appearanceScope: 'Por agora estas preferências aplicam-se a este percurso.',
  previewPostAuthor: 'Luxey',
  previewPostTime: 'há 2 h',
  previewPostBody: 'Nada aqui se faz sozinho.',
}

export type Strings = typeof PT
