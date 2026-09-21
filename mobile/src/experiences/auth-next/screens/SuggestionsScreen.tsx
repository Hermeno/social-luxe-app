import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import AvatarImage from '../../../components/AvatarImage'
import AuthScreen from '../components/AuthScreen'
import { Notice, PrimaryButton, QuietAction } from '../components/primitives'
import { fill, useI18n, useT } from '../i18n'
import { useTheme, hairline } from '../theme/ThemeProvider'
import {
  follow, followAll, followedNow, loadSuggestions, useFollowingIds, type SuggestedUser,
} from '../adapters/social.adapter'
import { displayHandle } from '../../../utils/handle'
import { labelForId } from '../data/interests'
import { classify, type Failure } from '../adapters/errors'
import { control, radius, space } from '../theme/tokens'

const AVATAR = 44

interface Props {
  onDone: () => void
  onSkip: () => void
  onBack?: () => void
}

/**
 * P03 — sugestões de pessoas.
 *
 * Regra dura deste ecrã: **nada acontece em silêncio**. Ninguém nasce
 * seleccionado, `Continuar` não segue ninguém, e `Seguir todos` é um toque
 * explícito e nomeado. Uma rede social que ganha ligações por omissão está a
 * decidir por quem ainda não decidiu.
 *
 * O contexto por pessoa sai dos dados que existem — interesses em comum, bio,
 * identificador. Não há percentagem de compatibilidade, não há "amigos em
 * comum" quando o serviço não os devolve, não há distância nem popularidade.
 * Números inventados sobre pessoas reais são o pior tipo de invenção.
 *
 * Uma falha a seguir alguém pertence à linha dessa pessoa, não ao ecrã: as
 * outras continuam a funcionar e o estado das já seguidas não se perde.
 */
export default function SuggestionsScreen({ onDone, onSkip, onBack }: Props) {
  const { palette, text, accent } = useTheme()
  const { lang } = useI18n()
  const t = useT()

  const [users, setUsers] = useState<SuggestedUser[] | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const followingIds = useFollowingIds()

  const load = useCallback(async () => {
    setFailure(null)
    setUsers(null)
    try {
      setUsers(await loadSuggestions())
    } catch (error) {
      setFailure(classify(error, t, t.suggestionsFailed))
      setUsers([])
    }
  }, [t])

  useEffect(() => { void load() }, [load])

  const markPending = (id: string, on: boolean) => {
    setPending((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleOne = useCallback(async (user: SuggestedUser) => {
    if (pending.has(user.id)) return
    markPending(user.id, true)
    setRowError(null)
    try {
      await follow(user)
    } catch {
      setRowError({ id: user.id, message: fill(t.followFailed, { name: user.name }) })
    } finally {
      markPending(user.id, false)
    }
  }, [pending, t])

  const followEveryone = useCallback(async () => {
    if (!users || users.length === 0 || bulkBusy) return
    setBulkBusy(true)
    setRowError(null)
    const targets = users.filter((user) => !followingIds.has(user.id))
    try {
      await followAll(targets)
      // Falha parcial: o store pode ter seguido uns e não outros. Em vez de
      // afirmar que correu tudo bem, comparamos com o que ficou mesmo seguido.
      const after = followedNow()
      const missed = targets.filter((user) => !after.has(user.id))
      if (missed.length > 0) setRowError({ id: '', message: t.followAllPartial })
    } catch {
      setRowError({ id: '', message: t.followAllPartial })
    } finally {
      setBulkBusy(false)
    }
  }, [bulkBusy, followingIds, t, users])

  const loading = users === null
  const empty = !loading && users.length === 0 && !failure
  const anyFollowed = Boolean(users?.some((user) => followingIds.has(user.id)))

  return (
    <AuthScreen
      title={t.suggestionsTitle}
      intro={t.suggestionsIntro}
      onBack={onBack}
      scroll={false}
      contentStyle={s.content}
      headerRight={<QuietAction label={t.skip} onPress={onSkip} tone="muted" />}
      footer={(
        anyFollowed
          ? <PrimaryButton label={t.suggestionsDone} onPress={onDone} />
          // Sem ninguém seguido, o comando principal é sair sem seguir. Pôr um
          // "Continuar" neutro por cima de uma lista intocada sugere que falta
          // fazer alguma coisa aqui — e não falta.
          : <PrimaryButton label={t.suggestionsSkip} onPress={onSkip} />
      )}
    >
      {loading ? (
        <View style={s.state}>
          <ActivityIndicator color={accent} />
        </View>
      ) : failure ? (
        <View style={s.state}>
          <Notice message={failure.message} onRetry={load} retryLabel={t.retry} />
        </View>
      ) : empty ? (
        <View style={s.state}>
          <Text style={[text('intro'), { color: palette.inkMuted }]}>{t.suggestionsEmpty}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          initialNumToRender={8}
          windowSize={7}
          ListHeaderComponent={(
            <View style={s.header}>
              <PrimaryButton
                label={t.suggestionsFollowAll}
                onPress={followEveryone}
                icon="user-plus"
                busy={bulkBusy}
              />
              {rowError?.id === '' && <Notice message={rowError.message} tone="muted" />}
            </View>
          )}
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: palette.line }]} />
          )}
          renderItem={({ item }) => {
            const isFollowing = followingIds.has(item.id)
            const busy = pending.has(item.id)
            const handle = displayHandle(item.username)
            // O campo real do serviço é `sharedInterests`; os ids são os do catálogo
            // e só aqui se traduzem para o que se lê.
            const shared = (item.sharedInterests ?? []).map((id: string) => labelForId(id, lang))
            const context = shared.length > 0
              ? fill(t.commonInterests, { list: shared.slice(0, 2).join(lang === 'pt' ? ' e ' : ' and ') })
              : (item.bio?.trim() || '')

            return (
              <View style={s.row}>
                <AvatarImage uri={item.avatar} name={item.name} size={AVATAR} />
                <View style={s.rowText}>
                  <Text style={[text('row'), { color: palette.ink }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!!handle && (
                    <Text style={[text('help'), { color: palette.inkMuted }]} numberOfLines={1}>
                      {handle}
                    </Text>
                  )}
                  {!!context && (
                    <Text style={[text('help'), { color: palette.inkMuted }]} numberOfLines={2}>
                      {context}
                    </Text>
                  )}
                  {rowError?.id === item.id && (
                    <Text style={[text('error'), { color: palette.danger }]}>{rowError.message}</Text>
                  )}
                </View>

                <Pressable
                  onPress={() => { void toggleOne(item) }}
                  disabled={busy}
                  style={({ pressed }) => [
                    s.followBtn,
                    {
                      backgroundColor: isFollowing ? palette.field : palette.surface,
                      borderColor: isFollowing ? palette.line : palette.lineStrong,
                      opacity: pressed || busy ? 0.6 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${isFollowing ? t.following : t.follow} ${item.name}`}
                  accessibilityState={{ selected: isFollowing, busy }}
                >
                  <Text
                    style={[text('rowSub'), { color: isFollowing ? palette.inkMuted : palette.ink }]}
                    numberOfLines={1}
                  >
                    {isFollowing ? t.following : t.follow}
                  </Text>
                </Pressable>
              </View>
            )
          }}
        />
      )}
    </AuthScreen>
  )
}

const s = StyleSheet.create({
  content: { flex: 1 },
  state: { paddingTop: space.block, alignItems: 'flex-start' },
  list: { paddingBottom: space.block },
  header: { paddingBottom: space.xl, gap: space.md },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  separator: { height: hairline, marginLeft: AVATAR + space.md },
  followBtn: {
    minWidth: 88,
    height: control.target - 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
