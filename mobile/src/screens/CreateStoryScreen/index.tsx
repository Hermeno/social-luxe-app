import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { createStory } from '../../services/story.service'
import { colors, fonts, spacing, radius } from '../../theme'

const { width, height } = Dimensions.get('window')

export default function CreateStoryScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const [mediaUri, setMediaUri] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [loading, setLoading] = useState(false)

  async function pickMedia() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      allowsEditing: true,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setMediaUri(asset.uri)
    setMediaType(asset.type === 'video' ? 'video' : 'image')
  }

  async function publish() {
    if (!mediaUri) return
    setLoading(true)
    try {
      await createStory(mediaUri, mediaType)
      nav.goBack()
    } catch {
      Alert.alert('Erro', 'Não foi possível publicar o story.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="close" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.title}>Novo Story</Text>
        <View style={{ width: 36 }} />
      </View>

      {mediaUri ? (
        <View style={s.previewWrap}>
          <Image source={{ uri: mediaUri }} style={s.preview} resizeMode="cover" />
          <TouchableOpacity style={s.changeBtn} onPress={pickMedia}>
            <Ionicons name="images-outline" size={20} color={colors.white} />
            <Text style={s.changeText}>Alterar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={s.pickArea} onPress={pickMedia} activeOpacity={0.8}>
          <Ionicons name="images-outline" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={s.pickText}>Toque para escolher foto ou vídeo</Text>
        </TouchableOpacity>
      )}

      <View style={[s.footer, { paddingBottom: bottom + spacing.md }]}>
        <TouchableOpacity
          style={[s.publishBtn, (!mediaUri || loading) && s.publishDisabled]}
          onPress={publish}
          disabled={!mediaUri || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={s.publishText}>Publicar Story</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0A0A0A' },
  header:         {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn:        { width: 36, alignItems: 'flex-start' },
  title:          { color: colors.white, fontFamily: fonts.bold, fontSize: 18 },
  previewWrap:    { flex: 1, position: 'relative' },
  preview:        { width, flex: 1 },
  changeBtn:      {
    position: 'absolute', top: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  changeText:     { color: colors.white, fontFamily: fonts.medium, fontSize: 13 },
  pickArea:       {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: spacing.md, marginVertical: spacing.lg,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed', borderRadius: radius.lg, gap: spacing.md,
  },
  pickText:       { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
  footer:         { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  publishBtn:     {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: 16, alignItems: 'center',
  },
  publishDisabled:{ opacity: 0.45 },
  publishText:    { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
})
