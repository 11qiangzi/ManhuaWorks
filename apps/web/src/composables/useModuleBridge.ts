/**

 * useModuleBridge.ts - 跨模块数据流转 composable

 */

import { ref, computed, onMounted } from 'vue'

import { useRouter, useRoute } from 'vue-router'

export type ModuleId = 'story' | 'animation' | 'promo' | 'ad-short' | 'ad-image' | 'music'

export interface StoryBridgeData {

  source: 'story'

  title: string

  chapters: Array<{

    number: number

    title: string

    content: string

    mood: string

    wordCount: number

  }>

  characters: Array<{

    name: string

    archetype: string

    appearance: string

    personality: string

    imagePrompt: string

    referenceImages: Array<{ url: string; type: string }>

  }>

  scenes: Array<{

    name: string

    location: string

    atmosphere: string

    imagePrompt: string

    referenceImages: Array<{ url: string; type: string }>

  }>

  exportedAt: string

}

export interface ShotBridgeData {

  shotId: string

  shotNumber: number

  title: string

  durationSec: number

  mood: string

  craftPrompt: string

  dialogue: string

  imageUrl?: string

  videoUrl?: string

}

export interface VideoBridgeData {

  source: 'animation' | 'promo' | 'ad-short'

  projectTitle: string

  shots: ShotBridgeData[]

  totalDurationSec: number

  exportedAt: string

}

export interface MusicBridgeData {

  source: 'music'

  mode: 'independent' | 'for-video'

  title: string

  audioUrl: string

  durationSec: number

  format: string

  bpm?: number

  mood?: string

  segments?: Array<{

    shotId: string

    startTimeSec: number

    endTimeSec: number

    audioUrl: string

    mood: string

  }>

  exportedAt: string

}

export type BridgeData = StoryBridgeData | VideoBridgeData | MusicBridgeData

const BRIDGE_PREFIX = 'mhw:bridge:'

const BRIDGE_KEYS = {
  storyToAnimation: `${BRIDGE_PREFIX}story::animation`,
  videoToMusic: `${BRIDGE_PREFIX}video::music`,
  musicToVideo: `${BRIDGE_PREFIX}music::video`,
  generic: (from: ModuleId, to: ModuleId) => `${BRIDGE_PREFIX}${from}::${to}`,
} as const

export function useModuleBridge(currentModule: ModuleId) {

  const router = useRouter()

  const route = useRoute()

  function sendTo(targetModule: ModuleId, data: BridgeData) {

    const key = BRIDGE_KEYS.generic(currentModule, targetModule)

    try {

      sessionStorage.setItem(key, JSON.stringify({

        ...data,

        _meta: {

          from: currentModule,

          to: targetModule,

          timestamp: new Date().toISOString(),

        },

      }))

    } catch (e) {

    }

  }

  function receiveFrom<T extends BridgeData>(sourceModule: ModuleId): T | null {

    const key = BRIDGE_KEYS.generic(sourceModule, currentModule)

    try {

      const raw = sessionStorage.getItem(key)

      if (!raw) return null

      const parsed = JSON.parse(raw) as T & { _meta?: { from: string; to: string; timestamp: string } }

      return parsed

    } catch {

      return null

    }

  }

  function consumeFrom<T extends BridgeData>(sourceModule: ModuleId): T | null {

    const data = receiveFrom<T>(sourceModule)

    if (data) {

      const key = BRIDGE_KEYS.generic(sourceModule, currentModule)

      sessionStorage.removeItem(key)

    }

    return data

  }

  function hasDataFrom(sourceModule: ModuleId): boolean {

    const key = BRIDGE_KEYS.generic(sourceModule, currentModule)

    return sessionStorage.getItem(key) !== null

  }

  function navigateTo(targetModule: ModuleId, data: BridgeData) {

    sendTo(targetModule, data)

    const routeMap: Record<ModuleId, string> = {

      story: '/create/novel',

      animation: '/create/animation',

      promo: '/create/promo',

      'ad-short': '/create/ad-video',

      'ad-image': '/create/ad-image',

      music: '/create/music',

    }

    router.push({ path: routeMap[targetModule], query: { from: currentModule } })

  }

  function sendStoryToAnimation(data: StoryBridgeData) {

    sendTo('animation', data)

    try {
      sessionStorage.setItem(BRIDGE_KEYS.storyToAnimation, JSON.stringify(data))
    } catch { /* ignore */ }

    navigateTo('animation', data)

  }

  function sendVideoToMusic(data: VideoBridgeData) {

    sendTo('music', data)

    try {

      sessionStorage.setItem(BRIDGE_KEYS.videoToMusic, JSON.stringify(data))

    } catch { /* ignore */ }

    navigateTo('music', data)

  }

  function sendMusicToVideo(data: MusicBridgeData, targetModule: ModuleId) {

    sendTo(targetModule, data)

    try {

      sessionStorage.setItem(BRIDGE_KEYS.musicToVideo, JSON.stringify(data))

    } catch { /* ignore */ }

    navigateTo(targetModule, data)

  }

  const fromModule = computed<ModuleId | null>(() => {

    const q = route.query.from as string

    if (q && ['story', 'animation', 'promo', 'ad-short', 'ad-image', 'music'].includes(q)) {

      return q as ModuleId

    }

    return null

  })

  const pendingData = ref<BridgeData | null>(null)

  onMounted(() => {

    if (fromModule.value) {

      pendingData.value = receiveFrom(fromModule.value)

    }

    if (!pendingData.value) {

      if (currentModule === 'animation') {

        try {

          const raw = sessionStorage.getItem(BRIDGE_KEYS.storyToAnimation)

          if (raw) pendingData.value = JSON.parse(raw)

        } catch { /* ignore */ }

      }

      if (currentModule === 'music') {

        try {

          const raw = sessionStorage.getItem(BRIDGE_KEYS.videoToMusic)

          if (raw) pendingData.value = JSON.parse(raw)

        } catch { /* ignore */ }

      }

    }

  })

  return {

    sendTo,

    receiveFrom,

    consumeFrom,

    hasDataFrom,

    navigateTo,

    sendStoryToAnimation,

    sendVideoToMusic,

    sendMusicToVideo,

    pendingData,

    currentModule,

  }

}

