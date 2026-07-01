import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { colors, fonts } from '../../theme'
import * as unionService from '../../services/union.service'
import * as userService from '../../services/user.service'
import { useUnionStore } from '../../store/union.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { API_BASE } from '../../config'

type Nav = StackNavigationProp<AppStackParams>

// Quick-label suggestions
const LABEL_SUGGESTIONS = ['Casal', 'Namorados', 'Gémeos', 'Irmãos', 'Melhores amigos', 'Sócios', 'Dupla criativa', 'BFFs']

interface SearchUser { id: string; name: string; avatar: string | null; bio: string | null }

function resolveAvatar(uri: string | null | undefined): string | null {
  if (!uri) return null
  return uri.startsWith('http') ? uri : `${API_BASE}${uri}`
}

type Step = 'details' | 'invite'

export default function CreateUnionScreen() {
  const nav    = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const addUnion = useUnionStore((s) => s.addUnion)

  const [step,          setStep]          = useState<Step>('details')
  const [unionName,     setUnionName]     = useState('')
  const [unionLabel,    setUnionLabel]    = useState('')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [selectedUser,  setSelectedUser]  = useState<SearchUser | null>(null)
  const [searching,     setSearching]     = useState(false)
  const [loading,       setLoading]       = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(q: string) {
    setSearchQuery(q)
    setSelectedUser(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const users = await userService.searchUsers(q)
        setSearchResults(users)
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 250)
  }

  async function handleCreate() {
    if (!unionName.trim() || !selectedUser) return
    setLoading(true)
    try {
      const union = await unionService.createUnion(
        selectedUser.id,
        unionName.trim(),
        unionLabel.trim() || undefined,
      )
      addUnion(union)
      nav.replace('UnionProfile', { unionId: union.id })
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível criar a união')
    } finally {
      setLoading(false)
    }
  }

  function Header({ title, onBack }: { title: string; onBack: () => void }) {
    return (
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>
    )
  }

  // ─── Step 1: Details (name + label) ───────────────────────────────────────
  if (step === 'details') {
    return (
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="Nova União" onBack={() => nav.goBack()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Text style={s.stepTitle}>Como se chama a vossa união?</Text>
          <Text style={s.stepSub}>Pode ser o nome dos dois, algo que vos representa — completamente livre.</Text>

          <TextInput
            style={s.nameInput}
            placeholder="Ex: João & Maria, As Gémeas Silva…"
            placeholderTextColor={colors.gray400}
            value={unionName}
            onChangeText={setUnionName}
            maxLength={40}
            autoFocus
            returnKeyType="next"
          />
          <Text style={s.charCount}>{unionName.length}/40</Text>

          <Text style={s.labelTitle}>O que são? <Text style={s.labelOpt}>(opcional)</Text></Text>
          <Text style={s.labelSub}>Escreve o vínculo ou escolhe uma sugestão.</Text>

          <TextInput
            style={s.labelInput}
            placeholder="Casal, Namorados, Sócios…"
            placeholderTextColor={colors.gray400}
            value={unionLabel}
            onChangeText={setUnionLabel}
            maxLength={30}
            returnKeyType="done"
          />

          {/* Quick suggestions */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestScroll} contentContainerStyle={s.suggestRow}>
            {LABEL_SUGGESTIONS.map((sug) => (
              <TouchableOpacity
                key={sug}
                style={[s.suggestPill, unionLabel === sug && s.suggestPillOn]}
                onPress={() => setUnionLabel(unionLabel === sug ? '' : sug)}
                activeOpacity={0.8}
              >
                <Text style={[s.suggestPillTxt, unionLabel === sug && s.suggestPillTxtOn]}>{sug}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[s.nextBtn, !unionName.trim() && s.nextBtnOff]}
            onPress={() => unionName.trim() && setStep('invite')}
            disabled={!unionName.trim()}
            activeOpacity={0.88}
          >
            <Text style={s.nextBtnTxt}>Continuar</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // ─── Step 2: Invite person ────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Convidar Pessoa" onBack={() => setStep('details')} />
      <View style={s.content}>

        {/* Union preview badge */}
        <View style={s.unionPreview}>
          <View style={s.unionPreviewIcon}>
            <Text style={s.unionPreviewIconTxt}>💑</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.unionPreviewName} numberOfLines={1}>{unionName}</Text>
            {unionLabel ? <Text style={s.unionPreviewLabel}>{unionLabel}</Text> : null}
          </View>
        </View>

        <Text style={s.stepTitle}>Quem é o outro membro?</Text>
        <Text style={s.stepSub}>Escreve o nome — os resultados aparecem em tempo real.</Text>

        {/* Search field */}
        <View style={[s.searchWrap, searchQuery.length > 0 && s.searchWrapActive]}>
          <Ionicons name="search-outline" size={18} color={searchQuery.length > 0 ? colors.primary : colors.gray400} />
          <TextInput
            style={s.searchInput}
            placeholder="Nome do utilizador…"
            placeholderTextColor={colors.gray400}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoFocus
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
          />
          {searching
            ? <ActivityIndicator size="small" color={colors.primary} />
            : searchQuery.length > 0
              ? <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setSelectedUser(null) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.gray300} />
                </TouchableOpacity>
              : null
          }
        </View>

        {/* Selected user */}
        {selectedUser && (
          <View style={s.selectedUserRow}>
            <View style={s.selectedUserAvatarWrap}>
              {resolveAvatar(selectedUser.avatar)
                ? <Image source={{ uri: resolveAvatar(selectedUser.avatar)! }} style={s.selectedUserAvatar} contentFit="cover" cachePolicy="memory-disk" />
                : <View style={[s.selectedUserAvatar, s.avatarFallback]}>
                    <Text style={s.avatarInitial}>{selectedUser.name.charAt(0).toUpperCase()}</Text>
                  </View>
              }
              <View style={s.selectedCheckBadge}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.selectedUserName}>{selectedUser.name}</Text>
              <Text style={s.selectedUserBio} numberOfLines={1}>{selectedUser.bio ?? 'Membro selecionado'}</Text>
            </View>
            <TouchableOpacity
              style={s.clearSelectedBtn}
              onPress={() => { setSelectedUser(null); setSearchQuery('') }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color={colors.gray500} />
            </TouchableOpacity>
          </View>
        )}

        {/* Results dropdown */}
        {!selectedUser && searchQuery.trim().length > 0 && (
          <View style={s.resultsContainer}>
            {searching && searchResults.length === 0 ? (
              <View style={s.resultsLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={s.resultsLoadingTxt}>A pesquisar…</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={s.resultsEmpty}>
                <Ionicons name="person-outline" size={28} color={colors.gray300} />
                <Text style={s.resultsEmptyTxt}>Nenhum utilizador encontrado</Text>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                {searchResults.map((u, idx) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[s.resultRow, idx < searchResults.length - 1 && s.resultRowBorder]}
                    onPress={() => { setSelectedUser(u); setSearchResults([]) }}
                    activeOpacity={0.7}
                  >
                    <View style={s.resultAvatarWrap}>
                      {resolveAvatar(u.avatar)
                        ? <Image source={{ uri: resolveAvatar(u.avatar)! }} style={s.resultAvatar} contentFit="cover" cachePolicy="memory-disk" />
                        : <View style={[s.resultAvatar, s.avatarFallback]}>
                            <Text style={s.avatarInitial}>{u.name.charAt(0).toUpperCase()}</Text>
                          </View>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultName}>{u.name}</Text>
                      {u.bio
                        ? <Text style={s.resultBio} numberOfLines={1}>{u.bio}</Text>
                        : <Text style={s.resultBioMuted}>Sem bio</Text>
                      }
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[s.nextBtn, s.createBtn, (!selectedUser || loading) && s.nextBtnOff]}
          onPress={handleCreate}
          disabled={!selectedUser || loading}
          activeOpacity={0.88}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.nextBtnTxt}>Criar União 💑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.semiBold, fontSize: 16, color: colors.black },

  stepTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.black, marginTop: 20, letterSpacing: -0.4 },
  stepSub:   { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500, marginTop: 6, lineHeight: 20, marginBottom: 20 },

  nameInput: {
    fontFamily: fonts.medium, fontSize: 20, color: colors.black,
    borderBottomWidth: 2, borderBottomColor: colors.primary,
    paddingVertical: 10, letterSpacing: -0.3,
  },
  charCount: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray400, alignSelf: 'flex-end', marginTop: 6 },

  labelTitle: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.black, marginTop: 28 },
  labelOpt:   { fontFamily: fonts.regular, fontSize: 15, color: colors.gray400 },
  labelSub:   { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500, marginTop: 3, marginBottom: 12 },

  labelInput: {
    fontFamily: fonts.medium, fontSize: 16, color: colors.black,
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
  },

  suggestScroll: { marginBottom: 4 },
  suggestRow:    { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  suggestPill: {
    borderWidth: 1.5, borderColor: colors.gray200,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.white,
  },
  suggestPillOn:    { backgroundColor: colors.primary, borderColor: colors.primary },
  suggestPillTxt:   { fontFamily: fonts.medium, fontSize: 13, color: colors.gray600 },
  suggestPillTxtOn: { color: colors.white },

  // Union preview
  unionPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.gray100, borderRadius: 16, padding: 14, marginVertical: 16,
  },
  unionPreviewIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFF5F7', alignItems: 'center', justifyContent: 'center',
  },
  unionPreviewIconTxt: { fontSize: 24 },
  unionPreviewName:    { fontFamily: fonts.bold, fontSize: 16, color: colors.black },
  unionPreviewLabel:   { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500, marginTop: 2 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.gray100, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1.5, borderColor: 'transparent', marginBottom: 12,
  },
  searchWrapActive: { backgroundColor: '#FFF5F7', borderColor: `${colors.primary}40` },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.black, padding: 0 },

  // Selected user
  selectedUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF5F7', borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: 16, padding: 14, marginBottom: 4,
  },
  selectedUserAvatarWrap: { position: 'relative' },
  selectedUserAvatar: { width: 52, height: 52, borderRadius: 26 },
  selectedCheckBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  selectedUserName: { fontFamily: fonts.bold, fontSize: 15, color: colors.black },
  selectedUserBio:  { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500, marginTop: 2 },
  clearSelectedBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center',
  },

  // Results dropdown
  resultsContainer: {
    borderWidth: 1, borderColor: colors.gray200, borderRadius: 16,
    overflow: 'hidden', backgroundColor: colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  resultsLoading:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 24 },
  resultsLoadingTxt: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500 },
  resultsEmpty:      { alignItems: 'center', paddingVertical: 28, gap: 8 },
  resultsEmptyTxt:   { fontFamily: fonts.medium, fontSize: 14, color: colors.gray400 },

  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  resultRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100 },
  resultAvatarWrap: { position: 'relative' },
  resultAvatar:  { width: 48, height: 48, borderRadius: 24 },
  resultName:    { fontFamily: fonts.semiBold, fontSize: 15, color: colors.black, letterSpacing: -0.2 },
  resultBio:     { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500, marginTop: 2 },
  resultBioMuted:{ fontFamily: fonts.regular, fontSize: 13, color: colors.gray300, marginTop: 2 },

  avatarFallback: { backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { fontFamily: fonts.bold, fontSize: 18, color: colors.gray600 },

  // Footer
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray100 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 26, backgroundColor: colors.black,
  },
  nextBtnOff: { opacity: 0.25 },
  nextBtnTxt: { fontFamily: fonts.bold, fontSize: 16, color: colors.white, letterSpacing: -0.3 },
  createBtn:  { backgroundColor: colors.primary },
})
