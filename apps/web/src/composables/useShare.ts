/**
 * useShare -- 作品分享 composable
 * P3-2: 零成本获客引擎 -- 分享机制
 *
 * 功能:
 * 1. 生成分享 URL（含作品类型 + 作品 ID）
 * 2. 水印 URL 生成（品牌叠加层）
 * 3. 各平台分享跳转（微信/小红书/抖音/B站）
 * 4. 复制链接到剪贴板
 *
 * 分享 URL 格式: {origin}/share/{workType}/{workId}
 */

import { ref, computed } from 'vue'
import { BRAND } from '@/config/branding'

/** 作品类型 */
export type ShareWorkType = 'manga' | 'promo' | 'ad-short' | 'ad-image' | 'music' | 'novel'

/** 分享数据 */
export interface ShareData {
  /** 作品标题 */
  title: string
  /** 作品描述 */
  description: string
  /** 分享 URL（完整路径，若为空则自动生成） */
  url: string
  /** 作品缩略图 URL */
  imageUrl?: string
  /** 作品类型 */
  workType: ShareWorkType
  /** 作品 ID（用于自动生成 URL） */
  workId?: string
}

/** 分享平台 */
export type SharePlatform = 'wechat' | 'xiaohongshu' | 'douyin' | 'bilibili' | 'copy'

/** 作品类型 -> 品牌子名映射 */
const WORK_TYPE_LABELS: Record<ShareWorkType, string> = {
  manga: BRAND.subNames.manhua,
  promo: BRAND.subNames.promo,
  'ad-short': BRAND.subNames.video,
  'ad-image': BRAND.subNames.ad,
  music: BRAND.subNames.music,
  novel: BRAND.subNames.novel,
}

/** 作品类型 -> emoji 映射 */
const WORK_TYPE_ICONS: Record<ShareWorkType, string> = {
  manga: '\ud83d\udcd6',
  promo: '\ud83c\udfac',
  'ad-short': '\ud83d\udcf1',
  'ad-image': '\ud83d\uddbc',
  music: '\ud83c\udfb5',
  novel: '\u270d\ufe0f',
}

/**
 * useShare 主函数
 */
export function useShare() {
  /** 分享操作是否正在进行 */
  const sharing = ref(false)

  /** 复制链接成功状态 */
  const copySuccess = ref(false)

  /** 当前分享的平台（用于 UI 提示） */
  const activePlatform = ref<SharePlatform | null>(null)

  /**
   * 生成分享 URL
   * 格式: {origin}/share/{workType}/{workId}
   */
  function generateShareUrl(data: ShareData): string {
    if (data.url) return data.url
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const workId = data.workId || 'preview'
    return `${origin}/share/${data.workType}/${workId}`
  }

  /**
   * 生成水印图片 URL
   * 在服务端渲染水印叠加层，此处返回带水印参数的 URL
   * 前端使用 CSS 叠加层实现水印效果
   */
  function generateWatermarkUrl(imageUrl: string): string {
    // 前端水印通过 CSS overlay 实现，此处返回原图 URL
    // 实际生产环境可接入图片处理服务添加服务端水印
    return imageUrl
  }

  /**
   * 获取分享文案（用于社交平台粘贴）
   */
  function getShareText(data: ShareData): string {
    const label = WORK_TYPE_LABELS[data.workType] || BRAND.nameCn
    const url = generateShareUrl(data)
    return `${data.title} -- 用${BRAND.nameCn}AI创作\n${data.description}\n\n${label} \u00b7 ${BRAND.tone}\n${url}`
  }

  /**
   * 获取作品类型标签
   */
  function getWorkTypeLabel(workType: ShareWorkType): string {
    return WORK_TYPE_LABELS[workType] || workType
  }

  /**
   * 获取作品类型图标
   */
  function getWorkTypeIcon(workType: ShareWorkType): string {
    return WORK_TYPE_ICONS[workType] || '\ud83c\udfa8'
  }

  /**
   * 复制到剪贴板（内部工具函数）
   */
  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        return true
      }
      // 降级方案: execCommand
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }

  /**
   * 复制链接到剪贴板
   */
  async function copyLink(data: ShareData): Promise<boolean> {
    const url = generateShareUrl(data)
    const text = getShareText(data)
    const ok = await copyToClipboard(text)
    if (ok) {
      copySuccess.value = true
      activePlatform.value = 'copy'
      setTimeout(() => { copySuccess.value = false }, 3000)
    }
    return ok
  }

  /**
   * 分享到微信
   * 微信无 Web Share Intent，复制链接 + 提示用户去微信粘贴
   */
  async function shareToWechat(data: ShareData): Promise<boolean> {
    sharing.value = true
    activePlatform.value = 'wechat'
    const url = generateShareUrl(data)
    const text = getShareText(data)
    const ok = await copyToClipboard(text)
    sharing.value = false
    if (ok) {
      copySuccess.value = true
      setTimeout(() => { copySuccess.value = false }, 5000)
    }
    return ok
  }

  /**
   * 分享到小红书
   * 小红书无标准 Web Intent，通过 URL scheme 或复制链接
   */
  async function shareToXiaohongshu(data: ShareData): Promise<void> {
    sharing.value = true
    activePlatform.value = 'xiaohongshu'

    // 小红书分享页（H5）
    const url = generateShareUrl(data)
    const title = encodeURIComponent(data.title)
    const desc = encodeURIComponent(data.description)

    // 尝试小红书 URL scheme
    const xhsUrl = `xhsdiscover://post?title=${title}&content=${desc}&url=${encodeURIComponent(url)}`
    try {
      window.location.href = xhsUrl
      // 如果未安装则回退到 H5 页面
      setTimeout(() => {
        window.open(`https://www.xiaohongshu.com/publish?title=${title}&content=${desc}`, '_blank')
      }, 1500)
    } catch {
      // 降级: 复制链接
      await copyToClipboard(getShareText(data))
      copySuccess.value = true
      setTimeout(() => { copySuccess.value = false }, 3000)
    }

    sharing.value = false
  }

  /**
   * 分享到抖音
   * 通过抖音 H5 分享页
   */
  async function shareToDouyin(data: ShareData): Promise<void> {
    sharing.value = true
    activePlatform.value = 'douyin'

    const url = generateShareUrl(data)
    const title = encodeURIComponent(data.title)
    const desc = encodeURIComponent(data.description)

    // 抖音 H5 分享
    const douyinUrl = `https://www.douyin.com/share?title=${title}&desc=${desc}&link=${encodeURIComponent(url)}`

    try {
      // 尝试抖音 App scheme
      const schemeUrl = `snssdk1128://share?title=${title}&content=${desc}&link=${encodeURIComponent(url)}`
      window.location.href = schemeUrl
      setTimeout(() => {
        window.open(douyinUrl, '_blank')
      }, 1500)
    } catch {
      await copyToClipboard(getShareText(data))
      copySuccess.value = true
      setTimeout(() => { copySuccess.value = false }, 3000)
    }

    sharing.value = false
  }

  /**
   * 分享到 B 站
   * 通过 B 站动态发布页
   */
  async function shareToBilibili(data: ShareData): Promise<void> {
    sharing.value = true
    activePlatform.value = 'bilibili'

    const url = generateShareUrl(data)
    const title = encodeURIComponent(data.title)
    const desc = encodeURIComponent(data.description)
    const shareText = encodeURIComponent(getShareText(data))

    // B 站动态发布页
    const biliUrl = `https://www.bilibili.com/dynamic/new?content=${shareText}`

    window.open(biliUrl, '_blank')
    sharing.value = false
  }

  /**
   * 通用分享（按平台分发）
   */
  async function share(platform: SharePlatform, data: ShareData): Promise<boolean> {
    switch (platform) {
      case 'wechat':
        return shareToWechat(data)
      case 'xiaohongshu':
        await shareToXiaohongshu(data)
        return true
      case 'douyin':
        await shareToDouyin(data)
        return true
      case 'bilibili':
        await shareToBilibili(data)
        return true
      case 'copy':
        return copyLink(data)
      default:
        return false
    }
  }

  return {
    /** 状态 */
    sharing,
    copySuccess,
    activePlatform,
    /** 工具函数 */
    generateShareUrl,
    generateWatermarkUrl,
    getShareText,
    getWorkTypeLabel,
    getWorkTypeIcon,
    /** 分享操作 */
    copyLink,
    shareToWechat,
    shareToXiaohongshu,
    shareToDouyin,
    shareToBilibili,
    share,
  }
}
