# Luxee · pacote de ícones v2

34 glifos redesenhados a partir do kit de referência (10 ago 2026).
**Nada está ligado à app.** `mobile/src/assets/icons/` continua intacto até haver luz verde.

## Regras do sistema

| | |
|---|---|
| Grelha | 24×24 |
| Área viva | 3–21 (3 unidades de ar em volta) |
| Traço | 1.75 em repouso · 2.25 ativo |
| Terminais | `stroke-linecap` e `stroke-linejoin` redondos |
| Interior | **vazado, sempre** |
| Cor | `currentColor` — o glifo nunca traz cor própria |

O interior vazado é a regra que segura o conjunto. Não existe versão sólida de nenhum
glifo: o estado resolve-se com **cor + espessura**. Um coração gostado é o mesmo coração,
a carmim e com traço 2.25. Isto corta o número de ficheiros a meio e faz com que a
transição entre estados nunca salte de forma.

Única exceção: os três pontos do `more-vertical`. São marcas, não formas — não têm
interior para vazar.

## Conteúdo

```
svg/            34 ficheiros, prontos para src/assets/icons
tokens.ts       paleta e mapa de estados
manifest.json   lista de nomes
preview.html    página de revisão (é o que está publicado)
preview.template.html   fonte da página; os SVG são injetados na build
```

## Ficheiros por categoria

- **Feed** — `heart` `heart-plus` `comment` `share` `bookmark` `remix` `more-vertical` `music`
- **Navegação** — `home` `search` `plus` `bell` `user`
- **Perfil e social** — `user-plus` `user-check` `user-minus` `invite` `send` `users` `verified`
- **Vídeo** — `play` `pause` `volume` `volume-off` `fullscreen` `pip` `speed` `rewind-10` `forward-10`
- **Captura e sistema** — `camera` `video` `image` `live` `settings`

## Adotar

```bash
cp design/icons-v2/svg/*.svg mobile/src/assets/icons/
cd mobile && npm run icons     # regenera src/components/Icon/paths.ts
```

O `<Icon>` e o `build-icons.mjs` não precisam de alterações — o pacote foi desenhado
contra o pipeline que já existe.

### O que parte

- `play` deixa de ser sólido; o ponto sólido da `camera` sai.
- `share` passa a ser a seta curva. A caixa-com-seta que tinha esse nome vira `invite`.
- `comment` substitui `message` no feed (setinha à direita).
- O «Mais» do feed passa a `more-vertical`.

67 ficheiros ainda chamam Ionicons. A troca faz-se pelo mapa `ION` em
`mobile/src/components/Icon/aliases.ts`, não ecrã a ecrã.

## Reconstruir a pré-visualização

```bash
node design/icons-v2/build-preview.mjs
```

## Por decidir

O kit de referência vive sobre preto; a app está em branco puro. Os fundos ficaram
intactos — só entram os ícones e a paleta de acentos.
