# LUXEY DESIGN SYSTEM
## Feed Mobile — React Native

**Version:** 1.0
**Scope:** Luxey social feed, short-form video feed, post actions, top navigation, captions, author metadata, reply composer, overlays and motion.
**Primary stack:** React Native
**Design intent:** Premium, minimal, social-first, content-first, distinctive, scalable.

---

# 0. ESTADO — O QUE FOI RECONCILIADO E O QUE FALTA DECIDIR

> Este bloco não fazia parte do documento original. Existe porque o documento foi
> confrontado com o código real da app, duas vezes: uma auditoria em 2026-08-25 e
> a sua aplicação em 2026-08-27. **Enquanto restar um ponto aberto, o documento
> não é fonte da verdade — é uma proposta com um ponto por decidir.**

### 0.1 A cor da marca — RESOLVIDO EM FAMÍLIA, FALTA O VALOR ⚠️

A auditoria anterior registou aqui um conflito de famílias: o documento propunha
azul→roxo e o código era laranja/carmim. **Isso deixou de ser verdade.** Em
2026-08-27 a paleta do produto passou a azul→magenta, amostrada de uma imagem de
referência. Documento e código estão hoje na mesma faixa. Sobram valores:

| | 5 pontos |
|---|---|
| `mobile/src/theme/colors.ts` | `#2F49FD` `#5948F9` `#7A47F5` `#9C45EE` `#C246E6` |
| Secção 6 deste documento | `#3943FF` `#5144F7` `#7542F2` `#9A40EB` `#B545E8` |

**Recomendação: o documento cede.** Os hexes do código saíram de uma referência
visual; os da secção 6 foram propostos no abstracto. Até isso ser decidido, a
secção 6 e a secção 9 descrevem cores que a app não usa.

### 0.2 A superfície da Feed — o código decide

Documento: `surfaceDark #11161C`. Código: `feedSurface #0B141A`, com o raciocínio
e os valores já testados escritos em `colors.ts`. Mexer nisto é mudar a cor de
toda a Feed — célula, mídia, álbum, ecrã vazio e barra. Fica como está.

### 0.3 A secção 14 (scrims) não se aplica à Feed principal — FECHADO

O documento pede um scrim inferior de 250–320px até `rgba(0,0,0,0.55)`. Esse véu
existiu, foi calibrado em três valores sucessivos (0.92 → 0.62 → 0.22) e foi
removido por decisão explícita: a mancha escura via-se. A protecção passou para
`feedTextShadow`, um halo de 3px colado às letras.

Os tokens órfãos que tinham sobrado desse véu (`gradients.feedVeil`,
`feedVeilStops`) foram apagados em 2026-08-27 — estavam definidos com vinte
linhas de raciocínio e zero utilizações, e liam-se como se estivessem em uso.
Se o scrim voltar, é uma escolha de produto e volta com os seus tokens.

### 0.4 As escalas — RESOLVIDO

O documento trazia escalas de `spacing`, `radius` e `typography` diferentes das
que a app pratica, e ter duas escalas é pior do que ter uma imperfeita. Ficou
assim, e é este o acordo:

| Escala | Quem ganhou | Porquê |
|---|---|---|
| `spacing` | **o documento** | a escala da app saltava de 4 para 8 e de 8 para 16, e o código votava com os pés: usava 6, 9, 10, 11, 12 e 14 nesses vãos. Foi alargada para `2·4·6·8·12·16·20·24·32·48` — a ladeira fina que o documento propunha — sem renomear nenhum degrau existente |
| `typography` | **o código** | sete degraus com salto real, com o raciocínio escrito. Ganhou o par que lhe faltava: `leading`, a entrelinha de cada degrau. Sem ela, a Feed tinha inventado quinze alturas de linha |
| `radius` | **o código** | `8·12·16·24·999`, com `999` a marcar o círculo em vez de meia-altura à mão |
| ícones | **o código** | `feedIcon`, alargado com dois degraus que a interface real exigia: `control: 20` (o vão entre 16 e 28, onde treze sítios tinham posto 17, 19, 20 e 21) e `badge: 9` (dentro de uma forma fixa, a mesma excepção que `typography.badge` abre para o texto) |

### 0.5 O que a aplicação da auditoria mudou no código — 2026-08-27

Tokens novos: `leading`, `sheet` (as folhas claras sobre a Feed escura),
`feedLine` e `feedFill` (traço e preenchimento sobre a mídia, que o `feedInk` não
cobria), `feedIcon.control`, `feedIcon.badge`, `RAIL_CLEARANCE`.

Resolvido: a família `Ionicons` saiu da Feed (o único ficheiro que a usava era
código órfão), oito espessuras de traço passaram a uma, vinte e três níveis de
branco passaram a seis tokens, quarenta cinzentos ad-hoc passaram a sete, quatro
margens de ecrã diferentes passaram a uma, e todos os alvos tocáveis da Feed têm
rótulo de acessibilidade ou estão explicitamente escondidos do leitor de ecrã.

---

# 1. PRODUCT DESIGN PRINCIPLE

Luxey must feel like a mature global social product.

The interface must never compete with the content.

The feed should feel: premium, quiet, precise, modern, fast, content-first,
visually consistent, recognizable as Luxey, refined without decorative excess.

Do not add styling unless it improves:

1. hierarchy
2. clarity
3. usability
4. recognition
5. interaction feedback
6. brand identity

**Polish > decoration.**

---

# 2. NON-NEGOTIABLE RULES

Never introduce: arbitrary font sizes · arbitrary spacing · arbitrary border
radius · mixed icon families · excessive pills · unnecessary cards · gratuitous
gradients · glassmorphism without functional reason · decorative shadows ·
excessive borders · colorful icon containers · SaaS-style card layouts ·
childlike UI patterns · AI-generated-looking UI patterns.

Do not redesign components simply to make them look different.
Every visual decision must have a product rationale.

---

# 3. VISUAL HIERARCHY

1. Media / video
2. Author identity
3. Caption / content
4. Primary actions
5. Metadata
6. Navigation / secondary controls

If the logo, Create button, reply box or any overlay visually dominates the
content, reduce its visual weight.

---

# 4. SPACING SYSTEM

```ts
export const spacing = {
  xxs: 2, xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 20, xxxl: 24, huge: 32,
}
```

**Feed defaults**

```
screenHorizontalPadding: 16
topBarHorizontalPadding: 16
bottomContentPadding: 16

avatarToUsernameGap: 10
usernameToMetadataGap: 8
authorRowToCaptionGap: 10

iconToCounterGap: 5
actionGroupGap: 18
```

Avoid magic numbers such as 13, 17, 19, 21, 23, 27, 31 unless optical alignment
genuinely requires them.

---

# 5. TYPOGRAPHY

```ts
export const typography = {
  actionCounter: { fontSize: 12, lineHeight: 15, fontWeight: '500' },
  metadata:      { fontSize: 14, lineHeight: 18, fontWeight: '400' },
  caption:       { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  username:      { fontSize: 16, lineHeight: 20, fontWeight: '600' },
  input:         { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  button:        { fontSize: 14, lineHeight: 18, fontWeight: '500' },
}
```

Do not use bold everywhere. 600 for author emphasis, 500 for counters and
actionable labels, 400 for captions and supporting text.

---

# 6. COLOR SYSTEM  ⚠️ ver §0.1

```ts
export const colors = {
  white: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.78)',
  textMuted: 'rgba(255,255,255,0.58)',
  surfaceDark: '#11161C',
  surfaceOverlay: 'rgba(10,14,18,0.86)',
  borderSubtle: 'rgba(255,255,255,0.10)',
  borderMedium: 'rgba(255,255,255,0.20)',
  iconInactive: '#FFFFFF',
  iconSecondary: 'rgba(255,255,255,0.78)',
}
```

**Brand gradient (em conflito com a paleta real — ver §0.1):**
`#3943FF` `#5144F7` `#7542F2` `#9A40EB` `#B545E8`

Use strategically for: selected states, premium states, creation flows, selected
reactions, brand moments, progress indicators.

Do NOT use on every icon, CTA, border or surface, nor as decoration.

---

# 7. ICONOGRAPHY

```ts
export const iconSize = { navigation: 24, secondary: 25, action: 27 }
```

Action rail: Like/Comment/Repost/Share/Save `27`, Menu `25`.
Stroke weight target: **1.8 – 2.0**.
Touch target minimum **44×44**, preferred **48×48**.

---

# 8. ACTION RAIL

```
48 touch target
↓ 27 visual icon
↓ 5 gap
↓ 12sp counter
```

Vertical gap between action groups: **18–20**. Right screen padding: **12–16**.

---

# 9. ACTIVE STATES  ⚠️ ver §0.1

Default icons `#FFFFFF`. Selected state `#B545E8` (em conflito com a marca real).
Use branded active states selectively. Do not turn the rail into a rainbow.

---

# 10. AVATAR SYSTEM

Feed author avatar **40×40**, border `1` `rgba(255,255,255,0.20)`.
No heavy shadows. No thick decorative border.

---

# 11. TOP BAR

Content height **56** (safe area separate) · horizontal padding **16** · back icon
**24** with **44** touch target · logo visual height **26–30**.

Create button: height **38**, horizontal padding **14**, radius **19**,
borderWidth **1**, background `rgba(0,0,0,0.15)`, border `rgba(255,255,255,0.35)`.

---

# 12. BORDER RADIUS SYSTEM

```ts
export const radius = { xs: 6, sm: 10, md: 16, lg: 22, full: 999 }
```

Avatar `full` · Reply input `22` · Create `full / 19` · Thumbnail `8–10` ·
Cards: avoid unless structurally necessary.

---

# 13. REPLY COMPOSER

Height **50** · horizontal margin **16** · horizontal padding **16** ·
borderRadius **22**.
Background `rgba(18,22,28,0.92)` · border `rgba(255,255,255,0.08)` ·
placeholder `rgba(255,255,255,0.62)`.

---

# 14. MEDIA OVERLAYS / SCRIMS  ⚠️ ver §0.3

Top scrim: height **120–150**, `rgba(0,0,0,0.32)` → transparent.
Bottom scrim: height **250–320**, transparent → `rgba(0,0,0,0.55)`.

Use scrims for readability, not decoration.

---

# 15. BOTTOM CONTENT AREA

Side padding **16**. Rhythm: `Avatar + Username + Metadata` ↓10 `Caption` ↓16
`Bottom controls / safe area`. Protected right area for the rail: **72–80**.

---

# 16. CONTENT DENSITY

Preferred density: **Balanced → Moderately high**. The video should occupy the
majority of perceived screen space.

---

# 17. MOTION SYSTEM

```ts
export const motion = { micro: 140, standard: 200, modal: 260 }
```

Micro 120–180ms · UI transition 180–240ms · Modal/sheet 240–300ms.
Like interaction: scale `1 → 1.12 → 1`.

---

# 18. ACCESSIBILITY

Touch targets ≥44×44 · strong text contrast · never state by color alone ·
respect safe areas · icon buttons need accessibility labels · readable captions
over bright media · scalable text where technically appropriate.

---

# 19. COMPONENT CONSISTENCY

Consistent across the feed: icon family, icon stroke, avatar sizes, font sizes,
font weights, spacing, opacity, radius, touch targets, borders, animation timing.

Any new magic number must be justified.

---

# 20. REACT NATIVE IMPLEMENTATION TOKENS  ⚠️ ver §0.1 e §0.4

```ts
export const luxeyFeedTokens = {
  spacing: { xxs: 2, xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 20, xxxl: 24, huge: 32 },
  radius:  { xs: 6, sm: 10, md: 16, lg: 22, full: 999 },
  typography: {
    counter:  { fontSize: 12, lineHeight: 15, fontWeight: '500' },
    metadata: { fontSize: 14, lineHeight: 18, fontWeight: '400' },
    caption:  { fontSize: 15, lineHeight: 20, fontWeight: '400' },
    username: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
    input:    { fontSize: 15, lineHeight: 20, fontWeight: '400' },
    button:   { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  },
  icons: { navigation: 24, secondary: 25, action: 27 },
  avatar: { feed: 40 },
  touchTarget: { minimum: 44, preferred: 48 },
  colors: {
    white: '#FFFFFF',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.78)',
    textMuted: 'rgba(255,255,255,0.58)',
    surfaceDark: '#11161C',
    surfaceOverlay: 'rgba(10,14,18,0.86)',
    borderSubtle: 'rgba(255,255,255,0.10)',
    borderMedium: 'rgba(255,255,255,0.20)',
    active: '#B545E8',
  },
  brandGradient: ['#3943FF', '#5144F7', '#7542F2', '#9A40EB', '#B545E8'],
  motion: { micro: 140, standard: 200, modal: 260 },
}
```

---

# 21. PRIORITY FOR CURRENT LUXEY FEED

**P0** — Standardize icon family · standardize icon sizes and stroke · reduce
visual weight of reply composer · add controlled scrims · normalize typography
hierarchy · normalize screen paddings · fix action rail alignment · ensure all
tap targets ≥44×44.

**P1** — Simplify top bar · refine Create button · improve author/caption spacing ·
reduce secondary metadata contrast · protect content from rail overlap ·
introduce brand active-state colour selectively.

**P2** — Optical icon alignment · micro motion · like animation · subtle brand
moments · fine-tune scrim intensity by content.

---

# 22. CLAUDE CODE / UI-UX PRO MAX RULES

When modifying the Luxey feed:

- Read this file before editing any feed UI.
- Inspect existing components before creating new ones.
- Reuse tokens instead of creating new values.
- Do not redesign functionality without explicit instruction.
- Do not alter navigation logic unless required.
- Do not introduce a new icon family.
- Do not introduce random border-radius or spacing values.
- Do not introduce new colors without updating tokens.
- Do not add decorative gradients.
- Do not add shadows unless there is a clear hierarchy reason.
- Preserve performance, safe areas and accessibility.
- Prefer refinement over reconstruction.

---

# 23. AUDIT CHECKLIST BEFORE MERGE

- [ ] Content still dominates the UI
- [ ] Icon family is consistent
- [ ] Action icons have consistent visual weight
- [ ] Touch targets are at least 44×44
- [ ] Username uses the correct hierarchy
- [ ] Metadata is visually secondary
- [ ] Caption is readable
- [ ] No text collides with action rail
- [ ] Top bar is not visually dominant
- [ ] Reply composer is visually quiet
- [ ] Top and bottom readability are protected
- [ ] Spacing, radius and colors use defined tokens
- [ ] No unnecessary cards or gratuitous gradients
- [ ] UI remains usable over bright and dark media
- [ ] Safe areas are respected
- [ ] Tested on multiple screen sizes
- [ ] Final result looks more refined, not merely more decorated

---

# 24. FINAL DESIGN STANDARD

If all brand names disappeared from the screen, would the interface still look
intentionally designed, mature, coherent and premium?

The Luxey identity should emerge from proportion, typography, rhythm, spacing,
icon precision, interaction, selected use of brand color and composition — not
from excessive decoration.

**Content first. Precision always. Luxey identity through restraint.**
