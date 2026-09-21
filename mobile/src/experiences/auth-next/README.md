# Luxey — auth-next

Experiência **nova** de autenticação, identidade e personalização. Escrita de
raiz; nenhum ficheiro preexistente foi editado, substituído, movido ou apagado
para a construir.

## Onde vive e porquê aqui

O contrato pedia `experiences/auth-next/` na raiz do repositório. Não é possível
sem alterar a configuração do projeto original: o `projectRoot` do Metro é
`mobile/`, o projeto não tem `metro.config.js`, e código fora dessa raiz não é
resolúvel sem criar um — o que mudaria o comportamento de toda a aplicação.

O módulo vive em **`mobile/src/experiences/auth-next/`**: pasta nova, dentro do
projeto Expo, zero alterações de configuração.

## Correr

```sh
cd mobile/src/experiences/auth-next/dev
npx expo start          # --ios | --android
```

A pasta `dev/` é um anfitrião Expo próprio (`package.json`, `app.json`,
`metro.config.js`, `index.js`). Não instala dependências: o `metro.config.js`
aponta `watchFolders` e `nodeModulesPaths` para `mobile/`, onde tudo já está.

Verificação de que empacota:

```sh
npm --prefix . run bundle   # expo export --platform ios
```

## Ecrãs

| | |
|---|---|
| A00 | `screens/BootScreen.tsx` — arranque; resolve idioma, tema, sessão e destino |
| A01 | `screens/PhoneScreen.tsx` — telefone + PT/EN |
| A02 | `screens/CountrySheet.tsx` — folha de países, pesquisa por nome ou indicativo |
| A03 | `screens/SignInScreen.tsx` — entrar |
| A04 | `screens/PasswordScreen.tsx` — criar senha |
| A05 | `screens/IdentityScreen.tsx` — nome + identificador; **cria a conta** |
| P01 | `screens/PhotoScreen.tsx` — fotografia (opcional) |
| P02 | `screens/InterestsScreen.tsx` — interesses (mínimo 3) |
| P03 | `screens/SuggestionsScreen.tsx` — sugestões (opcional) |
| L01 | `screens/LanguageScreen.tsx` — idioma |
| X01 | `screens/AppearanceScreen.tsx` — aparência |

**Não** contém Home, feed, perfil, navegação principal, ecrã de permissões nem
página comemorativa. A saída é `onComplete()`.

## Montar

```tsx
import AuthNextExperience from './experiences/auth-next'

<AuthNextExperience onComplete={({ reason, completedOptional }) => {
  // quem monta decide para onde se vai a seguir
}} />
```

Traz os seus próprios providers de idioma e tema. Espera encontrar por fora
`GestureHandlerRootView`, `SafeAreaProvider`, `KeyboardProvider` e as faces
`Jakarta-*` carregadas — ver `dev/App.tsx`.

## O que consome (apenas leitura, sem alterar a fonte)

Tudo passa por `adapters/`. Nenhum ecrã importa um serviço antigo directamente.

- `services/auth.service` — `checkPhone`, `getUsernameOptions`
- `store/auth.store` — `login`, `register`, `loadUser`, `logout`, `refreshUser`
- `services/api` — `PUT /users/profile` (avatar), `PUT /users/interests`
- `services/follow.service` + `store/follow.store` — sugestões, seguir
- `services/netinfo.service` — `isConnected`
- `utils/handle` — `displayHandle`
- `components/Icon`, `components/AvatarImage`
- `screens/OnboardingScreen` — só a constante `INTERESTS` (os ids persistidos)

Assets reutilizados: `assets/files/luxee-wordmark.png`,
`assets/files/luxee-L-symbol.png`, `assets/Plus_Jakarta_Sans/static/*`.

Chaves de armazenamento partilhadas com a aplicação, com as mesmas formas de
valor: `@language`, `@theme`, `@text_size`, `@accent_color`, `interests`,
`onboarding_done`. Foi uma escolha — ver o comentário em
`theme/ThemeProvider.tsx`.

## Limites conhecidos

- **Erros de login não distinguem 401 de 500.** O interceptor de
  `services/api.ts` rejeita sempre com `new Error(mensagem)` e o estado HTTP não
  sobrevive. Consequência assumida: nunca dizemos "senha incorreta" por conta
  própria. Ver `adapters/errors.ts`.
- **X01 aplica-se a este percurso**, não à aplicação inteira — os ecrãs antigos
  não consomem estes tokens. O ecrã diz isso; a preferência fica guardada nas
  chaves que as Definições já leem.
- **Sem ícone de olho riscado** na família própria da app. O estado
  mostrar/ocultar diz-se pela tinta do glifo e pelo rótulo anunciado.
- **Catálogo de países copiado**, não importado: a lista original vive dentro do
  componente do ecrã antigo e não é exportada.
