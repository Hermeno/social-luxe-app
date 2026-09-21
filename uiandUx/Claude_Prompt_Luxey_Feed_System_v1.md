# PROMPT EXECUTÁVEL PARA CLAUDE — LUXEY FEED SYSTEM v1.0

Você vai implementar **Luxey Feed System v1.0** na aplicação real existente. Este prompt é autocontido. Não presuma acesso a nenhuma conversa anterior.

## Arquivos de referência que acompanham esta tarefa
1. `Luxey_Feed_System_v1_Prototype.html` — vistas planas de H01, H02, I01, I02, C01 e S01.
2. `Luxey_Feed_System_v1_Spec.md` — especificação normativa completa.
3. Assets oficiais já existentes no repositório, especialmente:
   - `mobile/src/assets/feed-icons/heart.svg`
   - `mobile/src/assets/feed-icons/heart-solid.svg`
   - `mobile/src/assets/feed-icons/chat-outline.svg`
   - `mobile/src/assets/feed-icons/repost.svg`
   - `mobile/src/assets/feed-icons/share.svg`
   - `mobile/src/assets/feed-icons/option.svg`
   - `mobile/src/assets/feed-icons/author-posts.svg`
   - SVGs efetivamente usados em `mobile/src/assets/icons/`
   - assinatura/wordmark oficial já usado pelo componente `Wordmark`
4. Qualquer screenshot/reference fornecido junto desta entrega é **referência visual**, mas SVGs oficiais + especificação escrita têm precedência quando houver divergência.

## Precedência obrigatória
1. **Assets oficiais** definem identidade e geometria dos ícones/wordmark.
2. **Luxey Feed System v1.0 Spec** define layout, hierarquia, estados e comportamento visual novos.
3. **Código real existente** define contratos de dados, regras de negócio, cache, expiração, offline, paginação e permissões que precisam ser preservados.
4. Se uma imagem de referência contradizer SVG ou medida explícita, NÃO adivinhe: siga o SVG/Spec e documente a diferença.

---

# FASE 0 — INSPEÇÃO ANTES DE EDITAR

Antes de alterar qualquer arquivo:

1. Execute `git status` e identifique alterações locais. Não sobrescreva trabalho não relacionado.
2. Leia `mobile/package.json` e confirme versões reais de:
   - React Native
   - Expo
   - TypeScript
   - React Navigation
   - Zustand
   - SQLite
   - `expo-image`
   - `expo-video`
   - `react-native-svg`
   - animação já instalada
3. Localize e leia os componentes reais:
   - `HomeScreen/`
   - `FeedScreen/`
   - `components/TabBar/`
   - `PostActionIcon`
   - `FeedIcon`
   - `Icon`
   - `Wordmark`
   - `theme/`
   - hook `useFeed()`
   - `feed.store`
4. Confirme as rotas e contratos:
   - `Feed → HomeScreen`
   - `Immersive → FeedScreen`
   - como o post selecionado é passado
   - como índice/offset são restaurados ao voltar
5. Confirme os SVGs atualmente importados. **Ignore `design/icons-v2/` se não estiver ligado à app.**
6. Procure regras reais de:
   - expiração/24h/extensões
   - guest
   - like
   - repost
   - comment
   - share
   - seguir
   - author posts
   - Círculo
   - offline queues
   - cache/SQLite
   - paginação
7. Verifique `useFeed()`: trate cada instância como estado próprio apoiado por SQLite/API. Não o transforme em “lista global Zustand”. `feed.store` apenas coordena sinais/passagem de posts conforme arquitetura existente.
8. Registre num comentário de implementação ou relatório final qualquer divergência descoberta entre Spec e contrato real. Regra de negócio real vence; o layout deve se adaptar sem destruir funcionalidade.

**Não instale dependências. Não atualize stack por conveniência.**

---

# FASE 1 — TOKENS

Centralize tokens novos no sistema de `theme/` existente, sem criar um segundo theme paralelo.

## Cores
- `feed.background = #FFFFFF`
- `feed.textPrimary = #0F1115`
- `feed.textSecondary = #555C65`
- `feed.textTertiary = #737B85`
- `feed.divider = #E7E9EC`
- `feed.placeholder = #EEF0F2`
- `immersive.background = #0B141A`
- `immersive.surface = #101B21`
- `immersive.textPrimary = #F7F8F9`
- `immersive.textSecondary = #C4CBD0`
- `error = #B42318`

`#B4B4B4` não deve ser usado como cor principal de ícone pequeno em fundo branco. Os SVGs continuam usando `currentColor`; ajuste o token de repouso para `#4D545C`.

## Brand ring
NÃO copie os stops provisórios do HTML. Extraia/repita exatamente os valores oficiais já usados pelo app. Se os valores estiverem duplicados hoje, centralize sem mudar aparência.

## Tipografia Home
Continuar Plus Jakarta Sans existente:
- username `13/18 700`
- contexto `11/15 500`
- legenda `12/17 400`
- autor dentro da legenda `12/17 700`
- contador `10/14 600`
- text-post `22/29 650`
- header Criar `13/18 700`

## Immersive
Continuar fonte de sistema usada hoje:
- autor `13/18 700`
- legenda `12/17 400`
- seguir `10/14 700`
- contagem lateral `9/12 600`
- comentário `12/16 400`
- metadata comentário `10/14 500`

---

# FASE 2 — H01 HOME

## Header
Altura de conteúdo = `56`, além do safe-area top.
Ordem:
`Wordmark | spacer | Search | Criar`.

- Search: hit target 48.
- Criar: hit target >=48, texto simples; não criar pill decorativa.
- Não adicionar stories.
- Não adicionar sino/notificação a menos que o componente atual tenha contrato funcional obrigatório; se existir, documente e encaixe sem aumentar o header desnecessariamente.

## Bottom navigation
Ordem obrigatória:
`Início → Pesquisa → Círculo → Mensagens → Perfil`.

- Círculo fica no centro.
- Círculo NÃO é Criar.
- Não adicionar Reels.
- Immersive NÃO recebe tab.
- Use os SVGs reais de `mobile/src/assets/icons/` e o retrato no Perfil.
- ícone nav comum: ~26 óticos.
- hit target: min 44 iOS / 48 Android.
- tab content height = 56 + safe-bottom.

## Post header
- alvo de altura 50.
- identidade/avatar 34.
- nome 1 linha, ellipsis.
- contexto 1 linha; em fontScale maior pode ir a 2.
- `option.svg` hit target 48.

## Círculo
Criar/reutilizar componente compartilhado apenas se fizer sentido, preferencialmente algo como `CircleMediaComposition`, sem abstrações artificiais.

A composição deve ser determinística:
- use `captureOrder`/timestamp existente; fallback `participantId`.
- memoize por `postId + participant signature`.
- nunca use `Math.random()`.

Base 390:
- stage 390×316.
- 2: círculos 196, centros aprox. 135/255 no eixo X.
- 3: círculos 156, composição triangular.
- 4: círculos 138, composição 2×2 sobreposta.
- 5: centro 156 + 4 satélites 112.
- 6–8: centro 148 + satélites 100–106; último slot = fotografia real + overlay `+N`.
- >8: máximo 6 fotografias simultâneas; nunca converter pessoas em dots abstratos.

Cada slot:
- crop circular real;
- brand ring oficial;
- possibilidade de label curto do primeiro nome quando necessário;
- acessibilidade “Perspetiva de {nome}”.

A mesma publicação deve renderizar a mesma geometria na Home e ao retornar da Immersive.

## Ações Home
Ordem:
1. `heart.svg` / `heart-solid.svg`
2. `chat-outline.svg`
3. `repost.svg`
4. `share.svg`

`option.svg` fica no header.
`author-posts.svg` só onde a funcionalidade atual permite.

- caixa do glifo: 32
- glifo até 28
- stroke real do SVG continua 1.75/currentColor
- hit target min 48 Android / 44 iOS
- `share` pode ficar alinhado à direita
- não trocar share por avião de papel
- não trocar option por ellipsis

Preserve strings PT/EN atuais e o formatter de contagens existente.

## Caption
- sem caption: não reservar espaço
- até 3 linhas: mostrar
- >3: clamp + string localizada “mais”
- comentários usam strings existentes

---

# FASE 3 — H02 OUTROS TIPOS

## Foto
- sem card externo
- mídia direta
- respeitar proporção/focal content
- tap abre Immersive com o post selecionado

## Álbum
Implementar galeria horizontal coerente com v1:
- base 390: item dominante 316×246
- previews laterais ~56 parcialmente visíveis
- page snap horizontal
- indicador discreto `index / total`
- sem seta permanente em mobile
- pan horizontal deve vencer scroll vertical apenas quando intenção horizontal estiver clara

## Vídeo
PRESERVAR comportamento atual:
- selected by visibility
- pequeno atraso existente antes de carregar source
- toque abre Immersive
- não alterar autoplay/áudio silenciosamente

Poster primeiro. Não iniciar downloads de vários vídeos apenas porque estão pausados.

## Texto
- sem card genérico
- preservar cor/fonte de conteúdo escolhida pelo autor
- fallback neutro
- Home limita a 6 linhas antes de expandir/abrir

---

# FASE 4 — I01 IMMERSIVE

Background `#0B141A`.

A célula imersiva precisa calcular uma única `viewportHeight` consistente. A mesma altura deve alimentar:
- altura da célula
- snap interval
- offsets
- viewability

Não permita divergência entre esses valores.

## Mídia
- ocupa área entre top safe/chrome e comment zone
- `contain` por padrão
- 9:16 pode preencher
- 4:5 e landscape centralizados no dark background
- não crop agressivo só para preencher

## Top chrome
- back 48
- option 48 usando `option.svg`
- progress só quando existe progresso real de álbum/Círculo/mídia
- NÃO representar tempo até expiração

## Rail direito
Largura reservada ~60.
Ações:
`like → comment → repost → share → author-posts`, filtradas pelas permissões reais do tipo de post.

Cada ação:
- hit target >=48
- icon visual 32
- usar SVG oficial

## Author block
- left 12; right >=70 para não invadir rail
- fundo local de contraste somente atrás do texto quando necessário
- não aplicar scrim escuro global permanente
- `Seguir` somente quando permitido
- áudio somente quando o tipo realmente possui áudio

---

# FASE 5 — I02 CÍRCULO IMMERSIVE

- preservar ordem de participantes da Home
- participante ativo assume centro
- tap em satélite troca ativo sem trocar post
- manter autoria
- se houver vídeo, apenas participante ativo reproduz áudio
- nunca transformar o Círculo numa row de stories

---

# FASE 6 — C01 COMMENTS

Comments sheet:
- topo arredondado 24
- altura máx. ~64% da área disponível acima do teclado
- contagem no header
- botão visível de fechar
- drag down pode coexistir, mas não ser a única saída

Teclado:
- usar teclado nativo
- input docked ao teclado
- abrir teclado NÃO muda a altura/snap da mídia/célula por baixo
- sheet sobrepõe
- fechar restaura comment bar
- sair da Immersive restaura Home no mesmo `index + offset`

---

# FASE 7 — GESTOS

Respeitar handlers existentes; quando precisar arbitrar:

1. modal/sheet intercepta
2. botão intercepta
3. scrubber intercepta no hit slop
4. álbum/Círculo ganha pan se `abs(dx) > 12 && abs(dx) > 1.25 * abs(dy)`
5. feed vertical ganha depois do threshold atual
6. single tap vídeo = play/pause
7. double tap mídia = like e cancela single tap
8. toque em legenda/link não propaga para pause/like

Se o app já usa thresholds equivalentes, mantenha os existentes.

---

# FASE 8 — ESTADOS

Implementar/alinhar:
- initial loading
- refresh com conteúdo presente
- pagination
- empty
- offline
- media failure
- retry

Regras:
- refresh não zera lista
- offline mantém cache
- optimistic actions continuam na fila existente
- media failure preserva autoria/legenda
- retry recarrega apenas a mídia correspondente
- reduced motion remove animação desnecessária

---

# FASE 9 — PERFORMANCE

Obrigatório:
- preservar virtualização
- Home tem altura variável; NÃO inventar `getItemLayout` fixo
- dimensões previsíveis quando possível
- `expo-image` com tamanho adequado + cache
- posters de vídeo
- prefetch limitado
- um único player com áudio
- background/route/overlay devem reconciliar reprodução
- não assumir “pause = sem download”
- não aumentar buffers, clipping ou número de players sem medir

Meta inicial de design:
- imagens: ~1 viewport à frente
- vídeo: poster à frente; source apenas conforme seleção atual
- players decoded: ativo + no máximo 1 vizinho se a arquitetura atual suportar e os testes confirmarem memória aceitável

---

# FASE 10 — ACESSIBILIDADE

Adicionar/confirmar labels:
- Gostar / Remover gosto
- Comentar
- Repostar
- Partilhar
- Opções
- Ver publicações de {autor}
- Ver perspetiva de {participante}

Usar selected state para like e tab ativo.
Não depender só de cor.
Respeitar fontScale.
Reduced Motion:
- like sem scale
- circle switch fade <=100 ms
- comments <=100 ms ou instantâneo
- skeleton estático

---

# FASE 11 — ANIMAÇÕES

- like scale: 160 ms
- circle active switch: transform/opacity 180 ms
- comments open: translateY 220 ms
- comments close: 180 ms
- tab feedback: 120 ms
- skeleton pulse: 1200 ms apenas em visíveis

Não animar todas as células durante scroll.

---

# FASE 12 — IMPLEMENTAÇÃO POR PARTES VERIFICÁVEIS

Implemente em etapas, e após cada etapa rode as verificações disponíveis:

1. tokens + icon wrappers
2. Home header + TabBar
3. Círculo Home
4. foto/álbum/vídeo/texto Home
5. Immersive base
6. Círculo Immersive
7. comments/keyboard
8. loading/offline/error
9. accessibility/reduced motion
10. performance cleanup

Mapeie as mudanças preferencialmente para os componentes reais:
- `HomeScreen/`
- `FeedScreen/`
- `components/TabBar/`
- `PostActionIcon`
- `FeedIcon`
- `Icon`
- `Wordmark`
- `theme/`

Extraia componente apenas quando houver reutilização real entre Home/Immersive.

---

# FASE 13 — VALIDAÇÃO OBRIGATÓRIA

Produza capturas nas mesmas dimensões do design:
- 360×[viewport real]
- 390×844 lógico
- 430×[viewport real]

Comparar:
- H01 Home primeira dobra
- H02 tipos
- I01 mídia
- I02 Círculo
- C01 comentários + teclado
- S01 loading/offline/media error

Testes de fluxo:
- abrir post da Home → Immersive → voltar à mesma posição
- like Home ↔ Immersive consistente
- repost Home ↔ Immersive consistente
- comentários consistentes
- alternar tabs e voltar
- background/foreground com vídeo
- rede offline → ação otimista → reconnect
- media fail → retry
- expiração conforme regra real
- guest restrictions
- scroll prolongado

Performance:
- testar em build apropriada e equipamento real/emulador representativo
- registrar equipamento, build, duração, fps/jank e memória que as ferramentas disponíveis realmente fornecerem
- NÃO declarar 60 fps se não mediu
- NÃO declarar “sem leak” só porque compilou

---

# ENTREGA FINAL DO CLAUDE

Entregar:
1. resumo objetivo das decisões implementadas;
2. lista de arquivos alterados;
3. capturas H01/H02/I01/I02/C01/S01;
4. comandos/testes executados + resultados;
5. métricas de performance realmente medidas;
6. verificações não realizadas, explicitamente marcadas;
7. diferenças residuais do design e justificativa;
8. confirmação de que:
   - não adicionou Reels como tab;
   - Círculo continua central na navegação;
   - Criar continua no header;
   - SVGs oficiais foram reutilizados;
   - `useFeed()` não virou store global;
   - cache/SQLite/API/offline/paginação foram preservados;
   - Home continua virtualizada e com alturas variáveis;
   - Immersive mantém snap/cell height/offset coerentes.

Não entregue demo paralela como solução final. Implemente na aplicação real.
