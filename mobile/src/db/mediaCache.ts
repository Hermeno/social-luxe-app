/**
 * Cache de média — hoje só a limpeza.
 *
 * O descarregador que enchia esta cache (`getOrDownload`, e o `prefetchMedia`
 * que o chamava) não era usado por nenhum ecrã e saiu. Ficaram as duas pontas
 * de limpeza, que continuam a valer: há aparelhos com ficheiros e registos
 * deixados por versões anteriores, e é isto que os apaga — `evictStaleMedia`
 * no arranque, `nukeMediaCache` ao terminar sessão.
 *
 * O vídeo corre do Cloudinary e as imagens usam a cache em disco do
 * expo-image, que o componente trata sozinho. Se um dia voltar a fazer sentido
 * guardar média localmente, volta com o seu escritor — não há nenhum agora.
 */

import * as FileSystem from 'expo-file-system/legacy'
import {
  deleteMediaCacheEntry,
  getStaleMediaEntries,
  clearAllMediaCache,
} from './database'

const CACHE_DIR = `${FileSystem.cacheDirectory}luxe_media/`
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Delete media files older than MAX_CACHE_AGE_MS and remove DB records.
 * Call this once on app start (from syncFeed / RootNavigator).
 */
export async function evictStaleMedia(): Promise<void> {
  try {
    const stale = await getStaleMediaEntries(MAX_CACHE_AGE_MS)
    await Promise.allSettled(
      stale.map(async ({ local_path }) => {
        await FileSystem.deleteAsync(local_path, { idempotent: true })
      }),
    )
    // Remove DB records (clearStaleCache handles posts; here we handle media)
    for (const { url } of stale) {
      await deleteMediaCacheEntry(url)
    }
  } catch {}
}

/**
 * Wipe ALL downloaded media (e.g. on logout).
 */
export async function nukeMediaCache(): Promise<void> {
  try {
    await clearAllMediaCache()
    const info = await FileSystem.getInfoAsync(CACHE_DIR)
    if (info.exists) await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true })
  } catch {}
}
