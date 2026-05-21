import React, { useState } from 'react'
import { Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, radius, fonts } from '../../theme'
import MediaPreview from './MediaPreview'
import PickButtons from './PickButtons'
import { createPost } from '../../services/post.service'

type Media = { uri: string; type: 'image' | 'video' }

export default function CreateScreen() {
  const nav = useNavigation()
  const { top } = useSafeAreaInsets()
  const [media, setMedia] = useState<Media | null>(null)
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)

  async function pickMedia(type: 'image' | 'video') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return Alert.alert('Permissão negada', 'Precisamos acesso à galeria.')
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'video' ? 'videos' : 'images',
      quality: 0.85, videoMaxDuration: 60,
    })
    if (!result.canceled && result.assets[0]) setMedia({ uri: result.assets[0].uri, type })
  }

  async function handlePublish() {
    if (!media) return Alert.alert('Aviso', 'Selecione uma foto ou vídeo')
    setLoading(true)
    try {
      await createPost(media.uri, media.type === 'video' ? 'VIDEO' : 'IMAGE', caption.trim() || undefined)
      setMedia(null); setCaption('')
      Alert.alert('Publicado!', 'Sua publicação ficará visível por 24h.', [
        { text: 'OK', onPress: () => nav.navigate('Feed' as never) },
      ])
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao publicar')
    } finally { setLoading(false) }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={[s.header, { paddingTop: top + 16 }]}>
        <Text style={s.title}>Nova{'\n'}Publicação</Text>
        <View style={s.dot24h}>
          <Text style={s.dot24hText}>24h</Text>
        </View>
      </View>

      {media
        ? <MediaPreview uri={media.uri} type={media.type} onRemove={() => setMedia(null)} />
        : <PickButtons onPickImage={() => pickMedia('image')} onPickVideo={() => pickMedia('video')} />
      }

      <TextInput
        style={s.caption}
        placeholder="Escreva uma legenda..."
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={caption}
        onChangeText={setCaption}
        multiline
        maxLength={200}
      />

      <TouchableOpacity
        style={[s.publishBtn, (!media || loading) && s.disabled]}
        onPress={handlePublish}
        disabled={!media || loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={colors.white} />
          : <Text style={s.publishText}>Publicar</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0A0A0A' },
  content:    { paddingBottom: 120 },
  header:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.lg,
  },
  title:      {
    fontSize: 34,
    fontFamily: fonts.extraBold,
    color: colors.white,
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  dot24h:     {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
  },
  dot24hText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.5 },
  caption:    {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: '#1A1A1A',
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.white,
    textAlignVertical: 'top',
  },
  publishBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
  },
  disabled:   { opacity: 0.4 },
  publishText:{ color: colors.white, fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.2 },
})
