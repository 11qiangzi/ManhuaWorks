/**
 * useMusicCrossLink - 音乐跨模块联动 composable
 *
 * 模块间音乐数据传递：配乐生成器 → 目标编辑器（漫改/宣传片/短视频/小说）
 */

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MusicCrossLinkData {
  title: string
  duration: number
  genre: string
  /** 情绪/风格 */
  mood: string
  voice: string
  sourceEditor: string
  description?: string
  /** BPM */
  bpm?: number
  lyrics?: string
  timestamp: number
}

export type TargetEditor = 'manga' | 'promo' | 'ad-short' | 'novel'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'manhuaworks:music-cross-link'

const EDITOR_ROUTES: Record<TargetEditor, string> = {
  manga: '/create/animation',
  promo: '/create/promo',
  'ad-short': '/create/ad-video',
  novel: '/create/novel',
}

/* ------------------------------------------------------------------ */
/*  Pure helpers (no Vue dependency)                                   */
/* ------------------------------------------------------------------ */

/** 保存音乐数据供目标编辑器读取 */
export function saveMusicForEditor(musicData: MusicCrossLinkData, targetEditor: TargetEditor): void {
  try {
    const payload = {
      ...musicData,
      targetEditor,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

/** 读取并清除音乐联动数据 */
export function loadMusicFromEditor(): (MusicCrossLinkData & { targetEditor: TargetEditor }) | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(STORAGE_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  Composable                                                         */
/* ------------------------------------------------------------------ */

export function useMusicCrossLink() {
  const router = useRouter()

  const preLoadedMusic = ref<MusicCrossLinkData | null>(null)

  /** 发送音乐数据并导航到目标编辑器 */
  function sendMusic(musicData: MusicCrossLinkData, targetEditor: TargetEditor): void {
    saveMusicForEditor(musicData, targetEditor)
    router.push(EDITOR_ROUTES[targetEditor])
  }

  /** 接收并加载来自其他模块的音乐数据 */
  function receiveMusic(): MusicCrossLinkData | null {
    const data = loadMusicFromEditor()
    if (data) {
      preLoadedMusic.value = data
    }
    return data
  }

  /** 检查是否有预加载的音乐数据 */
  function hasPreLoadedMusic(): boolean {
    return sessionStorage.getItem(STORAGE_KEY) !== null
  }

  /** 清除预加载的音乐数据 */
  function clearPreLoadedMusic(): void {
    preLoadedMusic.value = null
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return {
    preLoadedMusic,
    sendMusic,
    receiveMusic,
    hasPreLoadedMusic,
    clearPreLoadedMusic,
  }
}
