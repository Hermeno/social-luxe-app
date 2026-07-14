import * as FileSystem from 'expo-file-system/legacy'
import * as MediaLibrary from 'expo-media-library'
import { Linking } from 'react-native'
import { toast } from './toast'
import { useI18n } from '../i18n'
import { PT } from '../i18n/pt'
import { EN } from '../i18n/en'

// Dicionário atual sem hook (para uso fora de componentes)
function tr() {
  return useI18n.getState().lang === 'en' ? EN : PT
}

function nameFromUrl(url: string, fallback = 'luxee-file'): string {
  const clean = url.split('?')[0]
  return clean.split('/').pop() || fallback
}

// Guarda uma imagem/vídeo na galeria do telemóvel
export async function saveMediaToGallery(url: string, fileName?: string): Promise<void> {
  const t = tr()
  try {
    const perm = await MediaLibrary.requestPermissionsAsync()
    if (!perm.granted) { toast.error(t.dl_perm_title, t.dl_perm_msg); return }

    const name  = fileName ?? nameFromUrl(url)
    const local = `${FileSystem.cacheDirectory}${Date.now()}-${name}`
    const { uri } = await FileSystem.downloadAsync(url, local)
    await MediaLibrary.saveToLibraryAsync(uri)
    toast.success(t.dl_saved_title, t.dl_saved_msg)
  } catch {
    toast.error(t.error, t.dl_fail)
  }
}

// Abre/descarrega um documento (pdf, doc, zip…) — o sistema trata do download
export async function openDocument(url: string): Promise<void> {
  const t = tr()
  try {
    const can = await Linking.canOpenURL(url)
    if (!can) throw new Error('cannot open')
    await Linking.openURL(url)
  } catch {
    toast.error(t.error, t.dl_fail)
  }
}
