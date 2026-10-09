/**
 * Catálogo de interesses — a lista oficial, num só lugar.
 *
 * Viveu dentro do ecrã de onboarding, que deixou de ser montado quando a
 * experiência `auth-next` passou a cobrir a entrada. O ecrã saiu; os dados
 * ficaram, porque o passo dos interesses e o editar de perfil leem os dois
 * daqui e têm de concordar à letra: o `id` é o valor guardado e enviado à API.
 *
 * O `id` nunca se traduz. `en` é o rótulo em inglês; em português mostra-se o
 * próprio `id`.
 */
export const INTERESTS: { id: string; en: string; emoji: string }[] = [
  { id: 'Fotografia',       en: 'Photography',     emoji: '📷' }, { id: 'Música',          en: 'Music',          emoji: '🎵' },
  { id: 'Viagens',          en: 'Travel',          emoji: '✈️' }, { id: 'Culinária',        en: 'Cooking',        emoji: '🍳' },
  { id: 'Moda',             en: 'Fashion',         emoji: '👗' }, { id: 'Arte',            en: 'Art',            emoji: '🎨' },
  { id: 'Desporto',         en: 'Sports',          emoji: '⚽️' }, { id: 'Tecnologia',      en: 'Technology',     emoji: '💻' },
  { id: 'Fitness',          en: 'Fitness',         emoji: '💪' }, { id: 'Cinema',          en: 'Cinema',         emoji: '🎬' },
  { id: 'Natureza',         en: 'Nature',          emoji: '🌿' }, { id: 'Negócios',        en: 'Business',       emoji: '💼' },
  { id: 'Dança',            en: 'Dance',           emoji: '💃' }, { id: 'Literatura',      en: 'Literature',     emoji: '📚' },
  { id: 'Jogos',            en: 'Games',           emoji: '🎮' }, { id: 'Bem-estar',       en: 'Wellness',       emoji: '🧘' },
  { id: 'Animais',          en: 'Animals',         emoji: '🐾' }, { id: 'Arquitectura',    en: 'Architecture',   emoji: '🏛️' },
  { id: 'Automóveis',       en: 'Cars',            emoji: '🚗' }, { id: 'Beleza',          en: 'Beauty',         emoji: '💄' },
  { id: 'Podcast',          en: 'Podcast',         emoji: '🎙️' }, { id: 'Espiritualidade', en: 'Spirituality',   emoji: '✨' },
  { id: 'Política',         en: 'Politics',        emoji: '🏛️' }, { id: 'Ciência',         en: 'Science',        emoji: '🔬' },
  { id: 'Sustentabilidade', en: 'Sustainability',  emoji: '🌍' }, { id: 'Voluntariado',    en: 'Volunteering',   emoji: '🤝' },
  { id: 'Empreendedorismo', en: 'Entrepreneurship', emoji: '🚀' }, { id: 'Investimento',   en: 'Investing',      emoji: '📈' },
  { id: 'Futebol',          en: 'Football',        emoji: '🏆' }, { id: 'Basquete',        en: 'Basketball',     emoji: '🏀' },
  { id: 'Surf',             en: 'Surfing',         emoji: '🏄' }, { id: 'Corrida',         en: 'Running',        emoji: '🏃' },
  { id: 'Yoga',             en: 'Yoga',            emoji: '🧘‍♀️' }, { id: 'Meditação',      en: 'Meditation',     emoji: '🕊️' },
  { id: 'Gastronomia',      en: 'Gastronomy',      emoji: '🍽️' }, { id: 'Vinho',           en: 'Wine',           emoji: '🍷' },
  { id: 'Tatuagem',         en: 'Tattoo',          emoji: '🖋️' }, { id: 'Graffiti',        en: 'Graffiti',       emoji: '🎨' },
  { id: 'Teatro',           en: 'Theatre',         emoji: '🎭' }, { id: 'Comédia',         en: 'Comedy',         emoji: '😂' },
]

