// ARQUIVO HISTÓRICO: inventário anterior ao refinamento. Não é usado pela folha atual.
// Inventário dos ícones que aparecem nas duas feeds.
//
// Cada linha é uma ocorrência real no código, com os valores já resolvidos:
// o que está no ficheiro é `size={feedIcon.action}`, aqui está 32. Os números
// vêm de tokens (`FeedScreen/tokens.ts`), de constantes locais do ecrã ou dos
// defaults do componente — a coluna `where` diz sempre de onde.

export const PALETTE = {
  ink: '#B4B4B4',               // ACTION_INK — a tinta dos controlos, igual nas duas feeds
  gray800: '#1A1A1A',
  white: '#FFFFFF',
  heart: '#C846E2',
  accent: '#7A47F5',
  black: '#000000',
  inkMuted: '#77787C',
  feedSurface: '#0B141A',
  mediaSecondary: 'rgba(255,255,255,0.96)',
  mediaMuted: 'rgba(255,255,255,0.78)',
}

const P = PALETTE

export const SCREENS = [
  {
    id: 'home',
    title: 'Feed inicial',
    route: 'Tab «Feed» → HomeScreen',
    surface: 'paper',
    note: 'Papel branco. Os controlos usam o ACTION_INK #B4B4B4; a cor só entra em estado accionado.',
  },
  {
    id: 'reels',
    title: 'Feed imersiva',
    route: 'Tab «Immersive» → FeedScreen',
    surface: 'media',
    note: 'O texto é branco sobre a fotografia; os controlos partilham o ACTION_INK #B4B4B4 com a Home.',
  },
  {
    id: 'nav',
    title: 'Barra de navegação',
    route: 'components/TabBar — está no ecrã nas duas feeds',
    surface: 'paper',
    note: 'Um só traço de 1.9 e a mesma massa em todos: 21pt de tinta no lado maior. Os tamanhos são medidos por `nav-ruler.mjs`, não estimados.',
  },
]

export const SPECS = [
  // ─── Feed inicial ─────────────────────────────────────────────────────────
  { screen: 'home', group: 'Cabeçalho', label: 'Procurar',
    comp: 'Icon', name: 'search', size: 24, color: P.gray800,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'HomeScreen/HomeHeader.tsx:46' },

  { screen: 'home', group: 'Cabeçalho', label: 'Criar', on: P.accent,
    comp: 'Icon', name: 'plus', size: 20, color: P.white,
    props: { strokeWidth: 2, absoluteStrokeWidth: true },
    where: 'HomeScreen/HomeHeader.tsx:56', note: 'Dentro da pastilha violeta.' },

  { screen: 'home', group: 'Fila de acções', label: 'Gostar · repouso', star: true,
    comp: 'FeedIcon', name: 'heart', size: 28, color: P.ink, props: {},
    where: 'HomeScreen/HomeFeedItem.tsx:200',
    note: 'O ficheiro `instagram-heart-icon.svg`, tal como veio. É um contorno preenchido — a espessura está cozida na geometria (8.06% da tinta) e por isso o `strokePx` não lhe toca; quem manda nela é o desenho, não o ecrã.' },

  { screen: 'home', group: 'Fila de acções', label: 'Gostar · gostado', star: true,
    comp: 'FeedIcon', name: 'heart-solid', size: 28, color: P.heart, props: {},
    where: 'HomeScreen/HomeFeedItem.tsx:200',
    note: 'O segundo subcaminho do mesmo ficheiro: o contorno de fora, sem o furo. Não é desenho novo nem deslocamento calculado, por isso os dois estados assentam no mesmo pixel. Gostar troca de forma, não só de cor.' },

  { screen: 'home', group: 'Fila de acções', label: 'Comentar',
    comp: 'FeedIcon', name: 'chat-outline', size: 28, color: P.ink,
    props: { boostPx: 0.26 },
    where: 'HomeScreen/HomeFeedItem.tsx:238',
    note: 'Contorno cozido no preenchimento: sobe-se com `boostPx`, não com `strokePx`.' },

  { screen: 'home', group: 'Fila de acções', label: 'Repostar',
    comp: 'FeedIcon', name: 'repost', size: 28, color: P.ink,
    props: { boostPx: 0.08 },
    where: 'HomeScreen/HomeFeedItem.tsx:253',
    note: 'É a referência de peso da fila — não leva reforço nenhum.' },

  { screen: 'home', group: 'Fila de acções', label: 'Partilhar',
    comp: 'FeedIcon', name: 'share', size: 28, color: P.ink,
    props: { boostPx: 0.51 },
    where: 'HomeScreen/HomeFeedItem.tsx:272' },

  { screen: 'home', group: 'Publicação', label: 'Mais',
    comp: 'FeedIcon', name: 'option', size: 28, color: P.ink, star: true,
    props: { weight: 'regular' },
    where: 'FeedScreen/PostOptionsMenu.tsx:356 · triggerSize de HomeFeedItem.tsx:281',
    note: 'Barras a 3.4 e já não a 2.5: três traços soltos não têm contorno a fechá-los e lêem-se mais leves que um balão do mesmo peso.' },

  { screen: 'home', group: 'Publicação', label: 'Verificado',
    comp: 'Icon', name: 'verified', size: 14, color: P.black, props: {},
    where: 'components/VerifiedBadge.tsx:28', note: 'Forma preenchida: o traço não lhe toca.' },

  { screen: 'home', group: 'Publicação', label: 'Reproduzir', on: 'media',
    comp: 'Icon', name: 'play', size: 26, color: P.ink,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'HomeScreen/HomeFeedItem.tsx:355' },

  { screen: 'home', group: 'Publicação', label: 'Capturado juntos',
    comp: 'Icon', name: 'users', size: 22, color: P.gray800,
    props: { strokeWidth: 1.7, absoluteStrokeWidth: true },
    where: 'HomeScreen/HomeFeedItem.tsx:388',
    note: 'Único 1.7 da feed — os vizinhos andam em 1.9.' },

  // ─── Feed imersiva ────────────────────────────────────────────────────────
  { screen: 'reels', group: 'Coluna de acções', label: 'Gostar · repouso', star: true,
    comp: 'FeedIcon', name: 'heart', size: 32, color: P.ink, props: {},
    where: 'FeedScreen/ActionBar.tsx:519',
    note: 'O mesmo desenho da Home, só maior — a régua ótica é a mesma nas duas feeds. Sem `weight`: o contorno já nasce com o peso da fila.' },

  { screen: 'reels', group: 'Coluna de acções', label: 'Gostar · gostado', star: true,
    comp: 'FeedIcon', name: 'heart-solid', size: 32, color: P.heart, props: {},
    where: 'FeedScreen/ActionBar.tsx:519' },

  { screen: 'reels', group: 'Coluna de acções', label: 'Coração da explosão',
    comp: 'FeedIcon', name: 'heart-solid', size: 12, color: P.heart, props: {},
    where: 'FeedScreen/ActionBar.tsx:531', note: 'Partículas que saem do toque.' },

  { screen: 'reels', group: 'Coluna de acções', label: 'Comentar',
    comp: 'FeedIcon', name: 'chat-outline', size: 32, color: P.ink,
    props: { boostPx: 0.297 },
    where: 'FeedScreen/ActionBar.tsx:543' },

  { screen: 'reels', group: 'Coluna de acções', label: 'Repostar',
    comp: 'FeedIcon', name: 'repost', size: 32, color: P.ink,
    props: { boostPx: 0.091 },
    where: 'FeedScreen/ActionBar.tsx:574' },

  { screen: 'reels', group: 'Coluna de acções', label: 'Partilhar',
    comp: 'FeedIcon', name: 'share', size: 32, color: P.ink,
    props: { boostPx: 0.583 },
    where: 'FeedScreen/ActionBar.tsx:599' },

  { screen: 'reels', group: 'Coluna de acções', label: 'Publicações do autor',
    comp: 'FeedIcon', name: 'author-posts', size: 32, color: P.ink,
    props: { strokePx: 1.943 },
    where: 'FeedScreen/ActionBar.tsx:654' },

  { screen: 'reels', group: 'Coluna de acções', label: 'Mais',
    comp: 'FeedIcon', name: 'option', size: 32, color: P.ink, star: true,
    props: { weight: 'regular' },
    where: 'FeedScreen/PostOptionsMenu.tsx:356 · triggerSize de ActionBar.tsx:638' },

  { screen: 'reels', group: 'Sobre a mídia', label: 'Duplo toque',
    comp: 'FeedIcon', name: 'heart-solid', size: 104, color: P.mediaSecondary, props: {},
    where: 'FeedScreen/FeedItem.tsx:694', note: 'Não é um ícone: é o gesto a confirmar-se.' },

  { screen: 'reels', group: 'Sobre a mídia', label: 'Reproduzir',
    comp: 'Icon', name: 'play', size: 64, color: P.ink,
    props: { strokeWidth: 1.75 },
    where: 'FeedScreen/FeedItem.tsx:699',
    note: 'Sem `absoluteStrokeWidth`: o traço escala com a caixa e chega aos 4.7px — é o mais grosso da feed.' },

  { screen: 'reels', group: 'Cabeçalho', label: 'Voltar',
    comp: 'Icon', name: 'arrow-left', size: 20, color: P.white,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'FeedScreen/FeedHeader.tsx:152' },

  { screen: 'reels', group: 'Cabeçalho', label: 'Procurar', on: 'paper',
    comp: 'Icon', name: 'search', size: 20, color: P.inkMuted,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'FeedScreen/FeedHeader.tsx:51', note: 'Dentro da folha clara de pesquisa.' },

  { screen: 'reels', group: 'Cabeçalho', label: 'Limpar', on: 'paper',
    comp: 'Icon', name: 'close', size: 16, color: P.inkMuted,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'FeedScreen/FeedHeader.tsx:73' },

  { screen: 'reels', group: 'Legenda', label: 'Verificado',
    comp: 'Icon', name: 'verified', size: 14, color: P.white, props: {},
    where: 'FeedScreen/PostInfo.tsx:289' },

  { screen: 'reels', group: 'Legenda', label: 'Anúncio',
    comp: 'Icon', name: 'megaphone', size: 12, color: P.white,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'FeedScreen/PostInfo.tsx:306' },

  { screen: 'reels', group: 'Legenda', label: 'Dispositivo',
    comp: 'Icon', name: 'smartphone', size: 12, color: P.mediaMuted,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'FeedScreen/PostInfo.tsx:318' },

  { screen: 'reels', group: 'Cartões', label: 'Avançar',
    comp: 'FeedIcon', name: 'chevron-right', size: 12, color: P.mediaSecondary, props: {},
    where: 'FeedScreen/TasteCard.tsx:120' },

  { screen: 'reels', group: 'Cartões', label: 'Convite · câmara',
    comp: 'Icon', name: 'camera', size: 20, color: P.mediaMuted,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'FeedScreen/FeedInvite.tsx:120' },

  { screen: 'reels', group: 'Cartões', label: 'Convite · pessoa',
    comp: 'Icon', name: 'user', size: 16, color: P.mediaMuted,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'FeedScreen/FeedInvite.tsx:120' },

  { screen: 'reels', group: 'Cartões', label: 'Convite · juntar', on: 'paper',
    comp: 'Icon', name: 'plus', size: 12, color: P.feedSurface,
    props: { strokeWidth: 2, absoluteStrokeWidth: true },
    where: 'FeedScreen/FeedInvite.tsx:133' },

  { screen: 'reels', group: 'Cartões', label: 'Momento · juntar',
    comp: 'FeedIcon', name: 'baseline-plus', size: 12.4, color: P.white,
    props: { weight: 'medium' },
    where: 'FeedScreen/CollectiveMomentCarousel.tsx:492',
    note: 'Tamanho vivo: 0.62 do emblema, que tem 20 no mínimo.' },

  // ─── Barra de navegação ───────────────────────────────────────────────────
  { screen: 'nav', group: 'Separadores', label: 'Início',
    comp: 'Icon', name: 'home', size: 26.07, color: P.ink,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'components/TabBar/index.tsx:59', note: 'Tamanho medido pela régua, não estimado.' },

  { screen: 'nav', group: 'Separadores', label: 'Procurar',
    comp: 'Icon', name: 'search', size: 25.04, color: P.ink, star: true,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'components/TabBar/index.tsx:60', note: 'Desenho novo. Vinha como contorno preenchido de raio 384 numa caixa de 1024; aqui é traçado, para o peso vir do componente.' },

  { screen: 'nav', group: 'Separadores', label: 'Círculo',
    comp: 'Icon', name: 'circle-add', size: 25.38, color: P.ink,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'components/TabBar/index.tsx:61', note: 'Tamanho medido pela régua, não estimado.' },

  { screen: 'nav', group: 'Separadores', label: 'Mensagens',
    comp: 'FeedIcon', name: 'chat-outline', size: 26.25, color: P.ink, star: true,
    props: { boostPx: 0.5 },
    where: 'components/TabBar/index.tsx:70',
    note: 'Andava a 21 e lia 20% mais pequeno que os vizinhos: a família da feed enche 0.78 da caixa e os `ui` a esta escala enchem 0.83, por isso o mesmo alvo de tinta pede-lhe uma caixa maior.' },

  { screen: 'nav', group: 'Separadores', label: 'Perfil',
    comp: 'Icon', name: 'user', size: 25.04, color: P.ink, star: true,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'components/TabBar/index.tsx:71', note: 'Desenho novo, reescalado para caber na área viva com o traço da família.' },

  { screen: 'nav', group: 'Atalhos do compositor', label: 'Criar',
    comp: 'Icon', name: 'plus', size: 24.86, color: P.accent,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'components/TabBar/index.tsx:712', note: 'Medido com o alvo em 18pt de tinta.' },

  { screen: 'nav', group: 'Atalhos do compositor', label: 'Círculo',
    comp: 'Icon', name: 'circle-add', size: 21.39, color: P.accent,
    props: { strokeWidth: 1.9, absoluteStrokeWidth: true },
    where: 'components/TabBar/index.tsx:741', note: 'Medido com o alvo em 18pt de tinta.' },
]
