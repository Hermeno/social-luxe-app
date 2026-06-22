import React, { useRef } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Animated, Modal, FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TravelObject } from '../../types'
import { fonts } from '../../theme'
import { useAuthStore } from '../../store/auth.store'

// ── Emoji picker catalogue ────────────────────────────────────────────────────
const EMOJI_GROUPS = [
  { label: 'Travel', emojis: ['✈️','🌍','🗺️','🧳','🏖️','🏔️','🗼','🗽','🏝️','⛵','🚂','🚀','🌋','🏕️','🎡','🏟️'] },
  { label: 'Nature', emojis: ['🌴','🌊','🌺','🦜','🐬','🦁','🐘','🦋','🌸','🌿','🍃','🌞','🌈','⭐','🌙','❄️'] },
  { label: 'Food',   emojis: ['🍕','🍜','🍱','🥘','🍛','🥗','🍣','🍔','🌮','🥐','☕','🍷','🥭','🍍','🍑','🫐'] },
  { label: 'Vibes',  emojis: ['❤️','🔥','⚡','💎','👑','🎉','💫','✨','🎯','💡','🤙','🙌','👀','💯','🚀','🎶'] },
]

// ── Single object pill ────────────────────────────────────────────────────────
function ObjectPill({
  obj, canRemove, isRemoving, onRemove,
}: {
  obj: TravelObject
  canRemove: boolean
  isRemoving: boolean
  onRemove: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1, tension: 120, friction: 8, useNativeDriver: true,
    }).start()
  }, [])

  return (
    <Animated.View style={[p.pill, { transform: [{ scale: scaleAnim }], opacity: isRemoving ? 0.4 : 1 }]}>
      <Text style={p.emoji}>{obj.value}</Text>
      {canRemove && !isRemoving && (
        <TouchableOpacity onPress={onRemove} style={p.removeBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="close-circle" size={13} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      )}
    </Animated.View>
  )
}

const p = StyleSheet.create({
  pill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius:    20,
    paddingHorizontal: 8,
    paddingVertical:   5,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             3,
  },
  emoji:     { fontSize: 18 },
  removeBtn: { marginLeft: 2 },
})

// ── Emoji picker sheet ────────────────────────────────────────────────────────
function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [tab, setTab] = React.useState(0)
  const group = EMOJI_GROUPS[tab]

  return (
    <View style={ep.sheet}>
      {/* Handle */}
      <View style={ep.handle} />

      {/* Tab bar */}
      <View style={ep.tabs}>
        {EMOJI_GROUPS.map((g, i) => (
          <TouchableOpacity key={g.label} onPress={() => setTab(i)} style={ep.tab} activeOpacity={0.7}>
            <Text style={[ep.tabLbl, i === tab && ep.tabActive]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={onClose} style={ep.closeBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={18} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Grid */}
      <FlatList
        data={group.emojis}
        keyExtractor={(e) => e}
        numColumns={8}
        contentContainerStyle={ep.grid}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPick(item)} style={ep.cell} activeOpacity={0.7}>
            <Text style={ep.emojiCell}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const ep = StyleSheet.create({
  sheet:  { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  tabs:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 4 },
  tab:    { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabLbl: { fontSize: 12, fontFamily: fonts.medium, color: '#999' },
  tabActive: { color: '#CA2851', fontFamily: fonts.bold },
  closeBtn: { paddingHorizontal: 4 },
  grid:   { paddingHorizontal: 8 },
  cell:   { flex: 1 / 8, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emojiCell: { fontSize: 24 },
})

// ── Main TravelObjects component ──────────────────────────────────────────────
interface Props {
  postId:      string
  postOwnerId: string
  objects:     TravelObject[]
  pickerOpen:  boolean
  removingId:  string | null
  onOpenPicker: () => void
  onClosePicker: () => void
  onAdd:    (emoji: string) => void
  onRemove: (objectId: string) => void
}

export default function TravelObjects({
  postOwnerId, objects, pickerOpen, removingId,
  onOpenPicker, onClosePicker, onAdd, onRemove,
}: Props) {
  const { user } = useAuthStore()
  const isOwner = user?.id === postOwnerId

  return (
    <>
      <View style={s.row}>
        {/* Objects strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
          {objects.map((obj) => (
            <ObjectPill
              key={obj.id}
              obj={obj}
              canRemove={isOwner || obj.user.id === user?.id}
              isRemoving={removingId === obj.id}
              onRemove={() => onRemove(obj.id)}
            />
          ))}
        </ScrollView>

        {/* Add button */}
        <TouchableOpacity onPress={onOpenPicker} style={s.addBtn} activeOpacity={0.8}>
          <Text style={s.addBtnTxt}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Picker modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={onClosePicker}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClosePicker} />
        <EmojiPicker onPick={(e) => { onAdd(e); onClosePicker() }} onClose={onClosePicker} />
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strip:  { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  addBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(202,40,81,0.85)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  addBtnTxt: { color: '#fff', fontSize: 18, lineHeight: 22 },
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
})
