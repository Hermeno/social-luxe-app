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

interface MediaDownload {
  url: string
  fileName?: string
}

async function saveMediaDownloadsToGallery(downloads: MediaDownload[]): Promise<void> {
  const t = tr()
  try {
    const validDownloads = downloads.filter(({ url }) => url.trim().length > 0)
    if (validDownloads.length === 0) throw new Error('no media to save')

    // O download só precisa adicionar ficheiros; não pede acesso de leitura à
    // biblioteca inteira do utilizador.
    const perm = await MediaLibrary.requestPermissionsAsync(true)
    if (!perm.granted) { toast.error(t.dl_perm_title, t.dl_perm_msg); return }

    for (const [index, download] of validDownloads.entries()) {
      const name = download.fileName ?? nameFromUrl(download.url)
      const local = `${FileSystem.cacheDirectory}${Date.now()}-${index}-${name}`
      const { uri } = await FileSystem.downloadAsync(download.url, local)
      await MediaLibrary.saveToLibraryAsync(uri)
    }

    toast.success(t.dl_saved_title, t.dl_saved_msg)
  } catch {
    toast.error(t.error, t.dl_fail)
  }
}

// Guarda uma imagem/vídeo na galeria do telemóvel
export async function saveMediaToGallery(url: string, fileName?: string): Promise<void> {
  return saveMediaDownloadsToGallery([{ url, fileName }])
}

// Guarda uma lista de imagens/vídeos, pedindo permissão e notificando uma só vez
export async function saveMediaListToGallery(urls: string[]): Promise<void> {
  return saveMediaDownloadsToGallery(urls.map((url) => ({ url })))
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
