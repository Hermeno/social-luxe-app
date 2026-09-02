# Ícones da feed · folha de medidas

`index.html` é a folha para redesenhar os ícones das duas feeds à mão: cada glifo
ampliado sobre grelha de px reais, a tinta medida marcada por cima, e o mesmo
desenho ao lado em tamanho 1:1 sobre a superfície onde vive.

```bash
node design/feed-icons/build.mjs      # precisa do Chrome instalado
```

Sai `index.html` e `measurements.json`. Se mexeste num SVG, corre primeiro
`npm run icons` ou `npm run icons:feed` dentro de `mobile/` — a página lê os
`paths.ts` gerados, não os SVG.

## O que está lá dentro

| | |
|---|---|
| Feed inicial | `HomeScreen` — 11 ícones |
| Feed imersiva | `FeedScreen` — 21 ícones |
| Barra de navegação | `TabBar` — 7 ícones, no ecrã nas duas |

Os três botões no topo escondem a grelha, escondem a caixa de tinta e ligam o
**modo decalque**, que apaga o glifo até 22% para se poder desenhar por cima.
Em impressão cada ecrã começa numa página nova.

## As medidas

**Tinta** são os pixels realmente pintados, contados num render supersampled do
Chrome — não a caixa da geometria, que ignora o traço e as bicas dos cantos.
**Ocupa** é o maior lado da tinta a dividir pela caixa; entre 78% e 80% o conjunto
lê alinhado.

**Traço** é a espessura que o olho recebe, por `2·área/perímetro`. Existe porque
o que o ficheiro declara não é comparável entre famílias: num desenho com o
contorno cozido no preenchimento o ficheiro só declara o reforço (`boostPx 0.5`)
e num raster não declara nada. A coluna **declara** guarda o valor de origem ao
lado, para se ver a diferença.

Na fila de acções da Home, a 28 de caixa: comentar 1.94 · gostar 1.74 ·
partilhar 1.69 · repostar 1.62 · mais 1.59.

## Três origens, não duas

- **`icons`** — o design system. Grelha 24×24, área viva 2..22, traço posto pelo
  componente.
- **`feed-icons`** — a feed. Cada desenho traz a caixa da sua origem e o build
  reenquadra-a para a tinta ocupar 0.78 do lado.
- **`ficheiro`** — o coração da Luxey (`LikeIcon`). Não é SVG: é o PNG desenhado
  à mão, escalado. Ocupa 0.72 da caixa, e é só isso que muda entre um sítio e
  outro.

## Ficheiros

```
build.mjs           gera a página e o JSON; reimplementa a pintura dos componentes
specs.mjs           o inventário — cada uso, com os valores já resolvidos
index.html          a página (gerada)
measurements.json   as mesmas medidas, para copiar (gerado)
```

Quando um ícone mudar de tamanho ou de sítio, é o `specs.mjs` que se corrige —
as linhas `where` apontam para o ficheiro e a linha de onde o número veio.
