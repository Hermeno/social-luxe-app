# Luxey Feed System v1.0 — Especificação final

## 1. Diagnóstico e direção visual

A melhor ideia presente nas referências é a **mídia circular como assinatura visual**, porque ela diferencia o produto sem precisar de decoração. A referência de círculo grande prova que o conteúdo fotográfico pode ser o elemento dominante; porém, a versão escura com uma foto circular isolada perde o contexto coletivo do produto. A versão branca com galeria lateral tem melhor continuidade de leitura e foi reaproveitada apenas para álbuns. A referência imersiva full-screen tem a hierarquia correta de mídia primeiro, mas os ícones de avião de papel/bookmark e o chrome “story” não devem ser copiados.

A versão v1.0 segue cinco decisões:
1. **Home branca e contínua:** sem cards externos. A separação acontece por espaço + divisor de 1 unidade.
2. **Círculo é uma composição de fotografias circulares, não uma fila de stories:** cada perspetiva continua sendo fotografia e autoria.
3. **Tipos de post têm anatomias relacionadas, mas não idênticas:** Círculo = cluster; álbum = galeria horizontal; foto/vídeo = mídia direta; texto = bloco tipográfico.
4. **Imersiva é uma rota, não um tab:** ocupa a tela e mantém comentário na zona inferior reservada.
5. **Branding fica concentrado nos anéis de identidade e estados semânticos:** nada de espalhar gradiente pelo layout.

### Observado nas referências
- Foto circular grande tem forte reconhecimento e boa relação conteúdo/interface.
- A galeria branca permite “ver o próximo” sem adicionar chrome.
- A imersiva com fotografia quase full-screen é a referência mais forte para a rota Immersive.
- As versões com stories no topo, cards escuros arredondados, vidro e botão “+” central parecem outra rede social e contradizem o produto especificado.

### Precisa de validação contra assets oficiais
- Stops exatos do anel azul → violeta → magenta.
- Dimensão ótica real do wordmark oficial.
- Geometria final dos SVGs de navegação e `feed-icons/`.
- Cor semântica atual de “liked” caso já exista token no projeto.

---

## 2. Base de layout

**Frame de referência:** 390×844 unidades lógicas.  
**Safe areas:** sempre dinâmicas; 390×844 não significa `paddingTop` ou `paddingBottom` fixos.

### Home
- Margem horizontal de texto/metadados: 14–16.
- Header: 56 de altura + safe-top.
- TabBar: 56 de conteúdo + safe-bottom. No protótipo plano ela aparece com 74 totais apenas para simular um inset inferior.
- Separador entre posts: 1 unidade `#E7E9EC`.
- Espaço visual de encerramento do post: 12 depois de comentário/legenda.
- Alvos de toque: **mín. 44×44 iOS, 48×48 Android**.
- Ícones de ação: glifo até 28 dentro de caixa visual 32; não confundir com hit target.
- Ícones comuns da navegação: 26 óticos dentro de hit target.

### 360
- Margens: 12.
- Tamanhos de ícone e hit target **não diminuem**.
- Stage do Círculo escala geometricamente para caber na largura restante.
- Texto de autoria mantém 1 linha; contexto pode truncar.
- `Criar` vira apenas o asset/ícone correspondente somente se o projeto já possuir uma forma acessível equivalente; caso contrário mantém texto.

### 430
- Margens: 16.
- Mídia simples pode usar toda a largura.
- Cluster do Círculo cresce no máximo até 398 de largura.
- Não aumentar tipografia apenas porque há mais largura.

### Fonte ampliada
- Até `fontScale 1.15`: layout normal.
- 1.16–1.35: contexto pode ir para segunda linha; ações mantêm hit targets.
- >1.35: ações mantêm ícone e deslocam contagens para acessibilidade/tooltip quando necessário; não reduzir fonte abaixo do token para “fazer caber”.
- Legendas longas: máximo de 3 linhas na Home antes de “mais”; imersiva pode expandir por overlay próprio.

---

## 3. Cores por papel

| Papel | Valor |
|---|---|
| Home background | `#FFFFFF` |
| Texto principal | `#0F1115` |
| Texto secundário | `#555C65` |
| Texto terciário | `#737B85` |
| Divisor | `#E7E9EC` |
| Placeholder/skeleton | `#EEF0F2` |
| Immersive background | `#0B141A` |
| Immersive secondary surface | `#101B21` |
| Texto immersive | `#F7F8F9` |
| Texto secundário immersive | `#C4CBD0` |
| Erro | `#B42318` |

**Não usar `#B4B4B4` para ícone informacional sobre branco.** O contraste é insuficiente para elementos pequenos. O SVG continua `currentColor`; a proposta troca apenas o token de cor de repouso para `#4D545C` na Home. Sobre mídia escura, usar `#F7F8F9`.  
**Brand ring:** usar exatamente os stops oficiais quando os assets forem inspecionados; os três tons do protótipo são apenas placeholders de papel semântico.

---

## 4. Tipografia

### Home — Plus Jakarta Sans
| Uso | Tamanho / entrelinha | Peso |
|---|---|---|
| username | 13/18 | 700 |
| contexto | 11/15 | 500 |
| legenda | 12/17 | 400 |
| legenda autor | 12/17 | 700 |
| contador ação | 10/14 | 600 |
| texto-post principal | 22/29 | 650 |
| Header `Criar` | 13/18 | 700 |

### Immersive — fonte de sistema existente
| Uso | Tamanho / entrelinha | Peso |
|---|---|---|
| autor | 13/18 | 700 |
| legenda | 12/17 | 400 |
| seguir | 10/14 | 700 |
| contagem lateral | 9/12 | 600 |
| comentários | 12/16 | 400 |
| metadata comentário | 10/14 | 500 |

---

## 5. H01 — Home / primeira dobra

### Header
- Wordmark oficial à esquerda.
- Pesquisa: hit target 48.
- `Criar`: hit target mínimo 48, sem pill decorativa.
- Nada de stories/círculos horizontais no topo.
- Nada de sino/notificações no header se o contrato atual não o exige.

### Cabeçalho do post
- Altura alvo: 50.
- Avatar/identidade: 34.
- Nome: 1 linha.
- Contexto: tipo + local/tempo quando existir.
- `option.svg`: hit target 48.

### Círculo — stage
Base 390:
- largura: 390.
- altura: 316.
- área útil horizontal: 362.
- Cada fotografia é recortada em círculo e preserva rosto/conteúdo.
- Rótulo interno opcional com primeiro nome; só aparece quando necessário para desambiguar autores.

#### Geometria estável
A composição **não pode depender de random**. Ordenar participantes por:
1. `captureOrder`/timestamp do momento, se o contrato já fornece;
2. senão por `participantId` estável.

Layouts:
- **2 pessoas:** dois círculos `196`, centros aproximados `(135,158)` e `(255,158)`, sobreposição parcial.
- **3 pessoas:** três círculos `156`, triângulo com centros `(125,112)`, `(265,112)`, `(195,226)`.
- **4 pessoas:** quatro círculos `138`, grid 2×2 sobreposto com centros `(126,108)`, `(264,108)`, `(126,226)`, `(264,226)`.
- **5 pessoas:** centro `156`, quatro satélites `112` conforme H01.
- **6–8 pessoas:** centro `148`, até cinco satélites `100–106`; o último slot recebe a fotografia real do próximo participante e overlay `+N`.
- **>8:** renderizar no máximo 6 perspetivas simultâneas; a sexta continua sendo foto, com `+N`, nunca um ponto abstrato.
- Overflow abre lista/strip de participantes ou a perspetiva selecionada conforme o contrato existente.
- Mesmo post + mesmos participantes = mesma geometria em todos os renders.

### Ações
Ordem visual:
`heart → comment → repost → share`.
- Usar `heart.svg` / `heart-solid.svg`.
- `chat-outline.svg`.
- `repost.svg`.
- `share.svg`.
- `option.svg`.
- `author-posts.svg` somente onde a ação realmente existe.
- Contadores grandes: `1,2 mil`, `12,4 mil`, etc., usando a função de formatação existente; não reinventar locale.
- Ações indisponíveis não deixam buraco arbitrário; o layout redistribui mantendo `share` à direita.

### Legenda
- 0 linhas: ação fecha o post sem reserva vazia.
- 1–3 linhas: mostra direto.
- >3 linhas: clamp + `mais`.
- Comentário único: `Ver comentário`.
- Muitos: string localizada existente.

---

## 6. H02 — continuação / tipos de post

### Foto única
- Sem card.
- `width: 100%`.
- Proporção nativa quando razoável.
- Para conteúdo muito alto: limitar a altura visível inicial e abrir imersiva ao toque.
- Não cortar rosto/conteúdo apenas para preencher.

### Álbum
Direção inspirada na referência branca:
- central dominante: 316×246 na base 390.
- previews laterais: 56, parcialmente visíveis.
- scroll horizontal paginado.
- indicador discreto `1 / N`.
- não usar setas permanentes em mobile.
- swipe horizontal deve vencer o swipe vertical quando a intenção horizontal estiver clara.

### Vídeo
- Poster primeiro.
- Reprodução conforme comportamento **já existente**: item selecionado por visibilidade, pequeno atraso antes de carregar fonte, toque abre imersiva.
- Não mudar autoplay/áudio sem decisão de produto explícita.
- Não mostrar chrome persistente se o vídeo já está em autoplay; duração pode aparecer temporariamente.

### Texto
- Não transformar em card genérico.
- Usa cor/fonte escolhida pelo autor como conteúdo.
- Base neutra quando o autor não escolheu estilo.
- Máx. 6 linhas na Home antes de expandir/abrir imersiva.

---

## 7. I01 — Feed imersiva

### Estrutura
- Background: `#0B141A`.
- Mídia ocupa de safe-top/chrome até a área reservada de comentário.
- `resizeMode/objectFit`: **contain por padrão** para preservar conteúdo.
- 9:16 pode preencher.
- 4:5 e landscape permanecem centralizados em `#0B141A`; não forçar crop.
- A mídia não muda de altura quando comentário/teclado abre; o sheet fica por cima.

### Top chrome
- Back/close: 48 target.
- `option.svg`: 48 target.
- Barra de progresso **não representa expiração de 24 h**.
- Só aparece quando há progresso real de álbum/Círculo/mídia; post simples pode ocultá-la.

### Rail de ações
- largura reservada: 60.
- alvo por ação: ≥48×48.
- ícone: caixa visual 32.
- prioridade: like, comment, repost, share, author-posts quando permitido.
- nada de bookmark inventado.

### Autoria e legenda
- bloco inferior local, não um overlay escuro permanente em toda a imagem.
- fundo local `rgba(11,20,26,0.56)` ou equivalente somente sob texto quando necessário.
- largura termina antes do rail lateral.
- `Seguir` só aparece quando aplicável.
- áudio só em tipos que efetivamente tenham áudio.

### Proteção contra mídia clara/escura
- controles recebem contraste local: fundo circular/retangular com alpha baixo ou shadow curto.
- não aplicar uma camada escura global permanente.
- se a implementação já possui análise de luminância, pode alternar o reforço local; não adicionar processamento por frame.

---

## 8. I02 — Círculo imersivo

- Mantém a mesma ordem de participantes da Home.
- Participante ativo vai ao slot central.
- Tocar numa perspetiva troca o ativo **sem mudar de post**.
- Horizontal pan entre perspetivas é permitido se o contrato atual suporta.
- Não converter o Círculo numa sequência de stories.
- O contexto “Mesmo momento · N perspetivas” fica pequeno e periférico.
- Se houver vídeo numa perspetiva, apenas o ativo pode reproduzir áudio.

---

## 9. C01 — comentários + teclado

- Comments sheet: até ~64% da área disponível acima do teclado.
- `border-radius` apenas no topo: 24.
- Cabeçalho: contagem + botão visível de fechar.
- Drag down continua permitido, mas **não é a única forma de fechar**.
- Input fica acoplado ao teclado nativo.
- Abrir teclado não recalcula o snap da célula imersiva; sheet e input sobrepõem.
- Fechar comentários restaura o comentário-bar inferior.
- Sair da imersiva retorna à Home no mesmo `index + offset` anterior.

---

## 10. Gestos e precedência

1. Overlay/modal aberto intercepta os gestos.
2. Toque iniciado em hit target de botão executa só o botão.
3. Scrubber, quando existir, vence qualquer gesto se o toque começar no seu hit slop.
4. Álbum/Círculo: pan horizontal vence se `|dx| > 12` e `|dx| > 1.25×|dy|`.
5. Feed imersiva: pan vertical vence depois do limiar vertical do componente existente.
6. Single tap em vídeo = play/pause, mas aguarda a janela do double tap.
7. Double tap na mídia = like; cancela single tap.
8. Tocar em texto/legenda expandível não deve pausar vídeo por propagação.

Usar thresholds já existentes se equivalentes; não introduzir constantes conflitantes sem necessidade.

---

## 11. Estados

### Loading inicial
- Skeleton estático ou pulso de opacidade curto.
- Nada de shimmer pesado em todas as células.
- Somente células visíveis animam.

### Refresh com conteúdo
- Mantém conteúdo existente.
- Indicador pequeno no topo.
- Não zerar lista.

### Paginação
- loader inline de 44–48 de altura no fim.
- erro de paginação preserva itens e mostra retry local.

### Vazio
- mensagem clara + ação apropriada conforme produto.
- sem ilustração genérica inventada.

### Offline
- banner compacto.
- conteúdo cacheado continua visível.
- ações otimistas entram na fila existente.

### Falha de mídia
- autoria e legenda permanecem.
- placeholder neutro + `Tentar novamente`.
- acessibilidade anuncia erro e retry.

---

## 12. Performance

- Meta: 60 fps em aparelho representativo; é meta de medição, não promessa.
- Manter virtualização.
- Home tem alturas variáveis: **não adicionar `getItemLayout` fixo**.
- Imersiva: cell height, `snapToInterval`/offset e viewport têm de usar a mesma altura calculada.
- `expo-image`: pedir dimensões próximas ao tamanho exibido; cache e progressive loading.
- Vídeo: poster primeiro; fonte real só para item selecionado segundo comportamento atual.
- Um único player com áudio por vez.
- Ao ir para background, mudar rota ou abrir overlay bloqueante: pausar/reconciliar player.
- Não manter players residentes “por segurança” sem medir memória. Meta operacional inicial: ativo + no máximo 1 vizinho preparado, se o código atual permitir.
- Prefetch de imagens: ~1 viewport à frente; vídeo: poster, não download indiscriminado.
- Cálculo da geometria do Círculo deve ser memoizado por `postId + participant signature`, nunca por frame.

---

## 13. Acessibilidade

- Labels: “Gostar”, “Remover gosto”, “Comentar”, “Repostar”, “Partilhar”, “Opções”, “Ver publicações de {autor}”.
- `accessibilityState.selected` para liked/active tab.
- Ordem de leitura Home: autor/contexto → mídia → legenda → ações → comentários.
- Imersiva: back → autor/contexto → mídia → ações → comentário.
- Não comunicar estado apenas por cor.
- Texto mínimo funcional deve respeitar font scale.
- Contraste AA para texto e controles essenciais.
- Reduced Motion: remover pulso/spring; usar transição instantânea ou fade ≤120 ms.

---

## 14. Animações

| Evento | Propriedade | Duração | Motivo | Reduced Motion |
|---|---|---:|---|---|
| like | scale 1→1.08→1 | 160 ms | feedback | sem scale |
| troca perspetiva Círculo | transform/opacity | 180 ms | continuidade espacial | fade 100 ms |
| abrir comentários | translateY | 220 ms | relação sheet/tela | 100 ms ou instantâneo |
| fechar comentários | translateY | 180 ms | saída | 100 ms |
| tab active | opacity/transform mínimo | 120 ms | orientação | instantâneo |
| skeleton pulse | opacity | 1200 ms | carregamento | estático |

Não animar todas as células durante scroll.

---

## 15. Matriz de interação

| Ação | Resultado | Loading/erro | Acessibilidade |
|---|---|---|---|
| like | otimista + `heart-solid.svg` | rollback/toast discreto | selected + label alternado |
| comment | abre sheet | retry local no envio | foco vai para sheet; input nomeado |
| repost | ação conforme regra do post | pending otimista existente | anuncia estado |
| share | abre share flow atual | sem inventar fallback | label “Partilhar” |
| option | menu contextual | preserva post | foco preso no menu |
| mídia Home | abre Immersive com post selecionado | poster/placeholder | label descreve tipo |
| foto do Círculo | ativa perspetiva | mantém anterior se falhar | “Ver perspetiva de X” |
| seguir | otimista | rollback | selected/following |
| retry mídia | recarrega só mídia | mantém legenda | anuncia loading/erro |
| fechar Immersive | volta ao índice/offset anterior | n/a | back padrão |

---

## 16. Revisão crítica antes de fechar

Corrigido na v1.0:
- removidos stories da Home;
- removido bookmark inventado;
- removidos cards escuros pesados na Home;
- Círculo deixou de ser uma única foto redonda e passou a mostrar múltiplas perspetivas;
- `Criar` não substitui o tab Círculo;
- imersiva continua sem tab próprio;
- contraste de ações em branco não depende de `#B4B4B4`;
- comentário tem botão visível de fechar;
- keyboard não redimensiona a célula imersiva;
- ícones do protótipo são apenas placeholders de posição, não novos assets.

### Pendências reais
1. validar wordmark e stops do brand ring;
2. validar todos os SVGs no repositório;
3. comparar implementação real em 360/390/430;
4. medir fps/memória em aparelho e build representativos.
