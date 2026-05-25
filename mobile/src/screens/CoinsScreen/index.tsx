import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { getBalance, getCoinHistory, sendCoins, CoinTransaction } from '../../services/coin.service'
import { useAuthStore } from '../../store/auth.store'
import { api } from '../../services/api'
import { ApiResponse } from '../../types'
import { colors, fonts, spacing, radius } from '../../theme'
import AvatarImage from '../../components/AvatarImage'

interface UserResult {
  id: string
  name: string
  avatar: string | null
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m atrás`
  if (m < 1440) return `${Math.floor(m / 60)}h atrás`
  return `${Math.floor(m / 1440)}d atrás`
}

export default function CoinsScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const { user } = useAuthStore()
  const [balance, setBalance] = useState(0)
  const [history, setHistory] = useState<CoinTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [sendModalVisible, setSendModalVisible] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    Promise.all([getBalance(), getCoinHistory()])
      .then(([bal, hist]) => {
        setBalance(bal)
        setHistory(hist)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function searchUsers(q: string) {
    setUserSearch(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    try {
      const res = await api.get<ApiResponse<UserResult[]>>(`/users/search?q=${encodeURIComponent(q)}`)
      setSearchResults(res.data.data)
    } catch {}
  }

  async function handleSend() {
    if (!selectedUser) return Alert.alert('Selecione um usuário')
    const amt = parseInt(amount, 10)
    if (isNaN(amt) || amt <= 0) return Alert.alert('Valor inválido')
    if (amt > balance) return Alert.alert('Saldo insuficiente')
    setSending(true)
    try {
      await sendCoins(selectedUser.id, amt, undefined, message || undefined)
      setBalance((b) => b - amt)
      setSendModalVisible(false)
      setSelectedUser(null)
      setAmount('')
      setMessage('')
      setUserSearch('')
      Alert.alert('Sucesso', `${amt} Luxe Coins enviados para ${selectedUser.name}!`)
      getCoinHistory().then(setHistory).catch(() => {})
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar coins.')
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>Luxe Coins</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Seu saldo</Text>
            <Text style={s.balanceAmount}>💎 {balance.toLocaleString()}</Text>
            <Text style={s.balanceSub}>Luxe Coins</Text>
            <TouchableOpacity
              style={s.sendBtn}
              onPress={() => setSendModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane-outline" size={18} color={colors.white} />
              <Text style={s.sendBtnText}>Enviar Coins</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.sectionLabel}>Histórico</Text>

          <FlatList
            data={history}
            keyExtractor={(t) => t.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.list}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Text style={s.emptyText}>Nenhuma transação ainda</Text>
              </View>
            }
            renderItem={({ item }: { item: CoinTransaction }) => {
              const isReceived = item.receiver.id === user?.id
              const other = isReceived ? item.sender : item.receiver
              return (
                <View style={s.txRow}>
                  <AvatarImage uri={other.avatar} size={44} />
                  <View style={s.txInfo}>
                    <Text style={s.txName}>{other.name}</Text>
                    {item.message && (
                      <Text style={s.txMsg} numberOfLines={1}>{item.message}</Text>
                    )}
                    <Text style={s.txTime}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  <Text style={[s.txAmount, isReceived ? s.received : s.sent]}>
                    {isReceived ? '+' : '-'}{item.amount} 💎
                  </Text>
                </View>
              )
            }}
          />
        </>
      )}

      <Modal visible={sendModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[s.modal, { paddingBottom: bottom + spacing.md }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Enviar Coins</Text>
            <TouchableOpacity onPress={() => setSendModalVisible(false)}>
              <Ionicons name="close" size={26} color={colors.gray800} />
            </TouchableOpacity>
          </View>

          {selectedUser ? (
            <View style={s.selectedUser}>
              <AvatarImage uri={selectedUser.avatar} size={40} />
              <Text style={s.selectedName}>{selectedUser.name}</Text>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <Ionicons name="close-circle" size={20} color={colors.gray400} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={s.searchInput}
                placeholder="Buscar usuário..."
                placeholderTextColor={colors.gray400}
                value={userSearch}
                onChangeText={searchUsers}
              />
              {searchResults.slice(0, 5).map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={s.searchResult}
                  onPress={() => { setSelectedUser(u); setSearchResults([]) }}
                >
                  <AvatarImage uri={u.avatar} size={36} />
                  <Text style={s.searchResultName}>{u.name}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <TextInput
            style={s.amountInput}
            placeholder="Quantidade de coins"
            placeholderTextColor={colors.gray400}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
          <TextInput
            style={s.messageInput}
            placeholder="Mensagem (opcional)"
            placeholderTextColor={colors.gray400}
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity
            style={[s.confirmBtn, (!selectedUser || !amount || sending) && s.confirmDisabled]}
            onPress={handleSend}
            disabled={!selectedUser || !amount || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.confirmText}>Confirmar Envio</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.white },
  header:         {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn:        { width: 36 },
  title:          { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  balanceCard:    {
    marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg,
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.lg, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,75,110,0.25)',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  balanceLabel:   { color: colors.gray400, fontFamily: fonts.regular, fontSize: 13 },
  balanceAmount:  { color: colors.gray800, fontFamily: fonts.extraBold, fontSize: 48 },
  balanceSub:     { color: colors.gray400, fontFamily: fonts.medium, fontSize: 14, marginBottom: spacing.sm },
  sendBtn:        {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 4,
  },
  sendBtnText:    { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  sectionLabel:   {
    color: 'rgba(255,255,255,0.4)', fontFamily: fonts.medium, fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  list:           { paddingHorizontal: spacing.md, paddingBottom: 20 },
  emptyWrap:      { alignItems: 'center', paddingTop: 40 },
  emptyText:      { color: 'rgba(255,255,255,0.3)', fontFamily: fonts.regular, fontSize: 14 },
  txRow:          {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  txInfo:         { flex: 1, gap: 2 },
  txName:         { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 14 },
  txMsg:          { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12 },
  txTime:         { color: colors.gray400, fontFamily: fonts.regular, fontSize: 11 },
  txAmount:       { fontFamily: fonts.bold, fontSize: 15 },
  received:       { color: '#4CAF50' },
  sent:           { color: colors.primary },
  modal:          { flex: 1, backgroundColor: colors.white, padding: spacing.lg, gap: spacing.md },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle:     { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },
  selectedUser:   {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.gray100, borderRadius: radius.md, padding: spacing.md,
  },
  selectedName:   { flex: 1, color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 15 },
  searchInput:    {
    backgroundColor: colors.gray100, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.gray800, fontFamily: fonts.regular, fontSize: 15,
  },
  searchResult:   {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200,
  },
  searchResultName:   { color: colors.gray800, fontFamily: fonts.medium, fontSize: 14 },
  amountInput:    {
    backgroundColor: colors.gray100, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.gray800, fontFamily: fonts.regular, fontSize: 15,
  },
  messageInput:   {
    backgroundColor: colors.gray100, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.gray800, fontFamily: fonts.regular, fontSize: 15,
    minHeight: 60, textAlignVertical: 'top',
  },
  confirmBtn:     {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm,
  },
  confirmDisabled:{ opacity: 0.4 },
  confirmText:    { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
})
