# Luxee · ícones refinados das duas feeds

Os 33 SVGs de `mobile/src/assets/feed-icons/` foram refinados mantendo as metáforas e os estados originais. Os contornos antes incorporados em formas preenchidas passaram a traçados editáveis; os estados sólidos continuam sólidos. Os 15 controlos de interface que precisaram de correções também foram ajustados em `mobile/src/assets/icons/`.

## Sistema

- Canvas e `viewBox`: **24×24**.
- Área viva máxima: **20×20**, com tinta dentro de **2..22**, incluindo metade do traço.
- Traço principal: **1,75** em unidades do SVG, com `round` nos terminais e junções.
- Cor: `currentColor`.
- As compensações de escala e posição vivem na geometria. Formas densas podem ocupar menos área; chevrons e barras mantêm suas proporções.
- Os pares coração, balão, gota e vídeo compartilham o mesmo contorno externo entre outline e preenchido.
- Na aplicação: ações **32px** nas duas feeds; navegação **26px**. O traço escala junto com o desenho.

`FeedIcon` apenas renderiza as formas geradas. Não acrescenta contornos a preenchimentos, não muda a espessura por ícone e não reenquadra o `viewBox`. `PostActionIcon` compartilha os mesmos desenhos entre o feed inicial e o feed de vídeos em tela cheia, mantendo a seleção do coração.

## Entrega e comparação

Abra **[index.html](index.html)**. A folha inclui antes/depois, ampliação sobre grelha, amostras a 24/28/32px, fundos claro/escuro e faixas com os tamanhos reais das duas feeds e da navegação. É uma conferência vetorial, não uma captura do aplicativo.

- `originals/`: SVGs de feed anteriores e `runtime.json`, snapshot da geometria antes do refinamento.
- `originals-ui/`: SVGs de interface anteriores às correções.
- `../../mobile/src/assets/feed-icons/`: SVGs finais, limpos e editáveis.
- `../../mobile/src/assets/icons/`: controlos compartilhados da interface.

O comparativo de feed usa o enquadramento anterior do app e as compensações de espessura das ações; as referências originais permanecem disponíveis separadamente. A coluna de interface mostra diretamente o SVG anterior.

## Reconstruir e conferir

```bash
cd mobile
npm run icons
npm run icons:feed
npm run icons:feed:measure
cd ..
node design/feed-icons/build.mjs
```

A medição precisa de Chrome local (`CHROME_PATH` pode substituir o caminho padrão do macOS). Rasteriza a 16× e verifica:

1. tinta dentro da margem de 2 unidades;
2. paridade pixel a pixel entre o SVG e as formas geradas para `FeedIcon`;
3. contorno externo estável entre estados outline e preenchido.

`mobile/src/assets/feed-icons/_bounds.json` guarda medidas de tinta, centro de massa e paridade. Serve apenas para auditoria: **não altera os desenhos na geração**. O build também rejeita viewBoxes, espessuras e terminais incompatíveis, assim como elementos que o renderer nativo não suporta.

`specs.mjs`, `measurements.json` e `nav-ruler.mjs` pertencem à auditoria anterior. Não orientam a família refinada nem são importados pela nova folha; a fonte de verdade agora é o SVG.
