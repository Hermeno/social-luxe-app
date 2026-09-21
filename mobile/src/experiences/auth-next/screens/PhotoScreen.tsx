import React, { useCallback, useState } from 'react'
import { Image, Linking, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

import Icon from '../../../components/Icon'
import AuthScreen from '../components/AuthScreen'
import { Notice, PrimaryButton, QuietAction, SecondaryButton } from '../components/primitives'
import { useT } from '../i18n'
import { useTheme } from '../theme/ThemeProvider'
import { uploadAvatar } from '../adapters/profile.adapter'
import { classify, type Failure } from '../adapters/errors'
import { space } from '../theme/tokens'

interface Props {
  photoUri: string | null
  onPhotoChange: (uri: string | null) => void
  onDone: () => void
  onBack?: () => void
}

/**
 * P01 — a fotografia.
 *
 * É opcional, e o ecrã comporta-se como tal: `Ignorar por agora` está sempre lá,
 * não há aviso a dizer que o perfil fica incompleto, e continuar sem foto não
 * custa um segundo toque de confirmação.
 *
 * As permissões são pedidas **depois** da escolha, nunca antes. Pedir câmara e
 * galeria ao entrar no ecrã gasta as duas autorizações de uma vez para uma
 * pessoa que talvez não vá usar nenhuma — e no iOS a recusa é definitiva.
 *
 * O recorte é o nativo do picker (`allowsEditing`, 1:1), o mesmo que o
 * onboarding actual usa. Um segundo editor dentro deste módulo seria outro
 * comportamento para a mesma tarefa no mesmo produto.
 *
 * Uma pré-visualização NÃO é um envio. Enquanto o servidor não confirmar, o que
 * está no ecrã é um ficheiro no telefone, e a falha de envio diz isso em vez de
 * deixar a pessoa a pensar que a foto ficou guardada.
 */
export default function PhotoScreen({ photoUri, onPhotoChange, onDone, onBack }: Props) {
  const { palette, text, accent } = useTheme()
  const t = useT()
  const { width } = useWindowDimensions()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [permissionDenied, setPermissionDenied] = useState<'camera' | 'gallery' | null>(null)

  // O disco ocupa pouco mais de metade da largura: grande o bastante para ser o
  // assunto do ecrã, pequeno o bastante para os dois comandos caberem sem scroll.
  const disc = Math.min(220, Math.round(width * 0.56))

  const take = useCallback(async () => {
    setFailure(null)
    const { granted } = await ImagePicker.requestCameraPermissionsAsync()
    if (!granted) { setPermissionDenied('camera'); return }
    setPermissionDenied(null)
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 })
    // Cancelar não é erro e não apaga o que já estava escolhido.
    if (!result.canceled && result.assets[0]) onPhotoChange(result.assets[0].uri)
  }, [onPhotoChange])

  const pick = useCallback(async () => {
    setFailure(null)
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!granted) { setPermissionDenied('gallery'); return }
    setPermissionDenied(null)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) onPhotoChange(result.assets[0].uri)
  }, [onPhotoChange])

  const confirm = useCallback(async () => {
    if (!photoUri) { onDone(); return }
    setBusy(true)
    setFailure(null)
    try {
      await uploadAvatar(photoUri)
      onDone()
    } catch (error) {
      // A pré-visualização fica: quem escolheu a foto não a perde por o envio
      // ter falhado, e pode repetir sem voltar à galeria.
      setFailure(classify(error, t, t.photoUploadFailed))
    } finally {
      setBusy(false)
    }
  }, [onDone, photoUri, t])

  return (
    <AuthScreen
      title={t.photoTitle}
      intro={t.photoIntro}
      onBack={onBack}
      footer={(
        <>
          {photoUri ? (
            <>
              <PrimaryButton label={t.photoUse} onPress={confirm} busy={busy} />
              <SecondaryButton label={t.photoRetake} onPress={pick} icon="image" disabled={busy} />
            </>
          ) : (
            <>
              <PrimaryButton label={t.photoTake} onPress={take} icon="camera" />
              <SecondaryButton label={t.photoPick} onPress={pick} icon="image" />
            </>
          )}
          <QuietAction label={t.skipForNow} onPress={onDone} disabled={busy} />
        </>
      )}
    >
      <View style={s.stage}>
        <View
          style={[
            s.disc,
            {
              width: disc,
              height: disc,
              borderRadius: disc / 2,
              backgroundColor: palette.field,
              // O anel só aparece quando há fotografia. Um anel à volta de um
              // vazio parece um estado carregado que não existe.
              borderColor: photoUri ? accent : 'transparent',
              borderWidth: photoUri ? 2 : 0,
            },
          ]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={photoUri ? t.photoRetake : t.photoEmptyLabel}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.photo} resizeMode="cover" />
          ) : (
            <Icon name="user" size={Math.round(disc * 0.34)} color={palette.inkFaint} strokeWidth={1.4} />
          )}
        </View>

        {busy && (
          <Text style={[text('help'), { color: palette.inkMuted }]} accessibilityLiveRegion="polite">
            {t.photoUploading}
          </Text>
        )}

        {permissionDenied && (
          <Notice
            message={permissionDenied === 'camera' ? t.photoPermCamera : t.photoPermGallery}
            onRetry={() => { Linking.openSettings().catch(() => {}) }}
            retryLabel={t.photoPermOpen}
            tone="muted"
          />
        )}

        {failure && (
          <Notice message={failure.message} onRetry={confirm} retryLabel={t.retry} />
        )}
      </View>
    </AuthScreen>
  )
}

const s = StyleSheet.create({
  stage: { alignItems: 'center', gap: space.lg, paddingTop: space.sm },
  disc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
})
