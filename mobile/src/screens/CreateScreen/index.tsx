import React, { useState } from 'react'
import { Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useNavigation } from '@react-navigation/native'
import { colors, spacing, radius } from '../../theme'
import MediaPreview from './MediaPreview'
import PickButtons from './PickButtons'
import { createPost } from '../../services/post.service'

type Media = { uri: string; type: 'image' | 'video' }

export default function CreateScreen() {
  const nav = useNavigation()
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
      <Text style={s.title}>Nova Publicação</Text>
      {media
        ? <MediaPreview uri={media.uri} type={media.type} onRemove={() => setMedia(null)} />
        : <PickButtons onPickImage={() => pickMedia('image')} onPickVideo={() => pickMedia('video')} />
      }
      <TextInput style={s.caption} placeholder="Escreva uma legenda..." placeholderTextColor={colors.gray400}
        value={caption} onChangeText={setCaption} multiline maxLength={200} />
      <TouchableOpacity style={[s.publishBtn, (!media || loading) && s.disabled]} onPress={handlePublish} disabled={!media || loading}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={s.publishText}>Publicar</Text>}
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.white },
  content:    { paddingBottom: 100 },
  title:      { fontSize: 20, fontWeight: '700', color: colors.gray800, padding: spacing.lg, paddingTop: 60 },
  caption:    { margin: spacing.lg, backgroundColor: colors.gray100, borderRadius: radius.md, padding: spacing.md, minHeight: 80, fontSize: 15, color: colors.gray800, textAlignVertical: 'top' },
  publishBtn: { marginHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  disabled:   { opacity: 0.5 },
  publishText:{ color: colors.white, fontWeight: '700', fontSize: 16 },
})
