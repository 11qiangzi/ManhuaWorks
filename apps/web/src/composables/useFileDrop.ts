/**
 * useFileDrop — 统一的「点击 + 拖拽 + 键盘」文件选择交互外壳
 *
 * 只负责交互层，不碰具体文件处理逻辑：
 *  - 拦截浏览器对「系统文件拖入」的默认行为（避免拖文件打开新标签）
 *  - 维护拖入高亮状态（用进出计数防子元素闪烁）
 *  - 暴露键盘可达的打开方法（Enter / Space）
 *
 * 具体「拿到文件后怎么处理」（读文本 / 转 dataURL / 上传资产服务）由各视图自行决定，
 * 通过 onFiles 回调拿到 File[]。
 *
 * 用法：
 *   const { isDragging, openPicker, onDragOver, onDragEnter, onDragLeave, onDrop, onKeyOpen } =
 *     useFileDrop((files: File[]) => { files.forEach(handleFile) })
 *
 * <div
 *   role="button" tabindex="0"
 *   :class="{ 'is-dragging': isDragging }"
 *   @click="openPicker(fileInput)"
 *   @keydown.enter.prevent="openPicker(fileInput)"
 *   @keydown.space.prevent="openPicker(fileInput)"
 *   @dragover.prevent="onDragOver"
 *   @dragenter.prevent="onDragEnter"
 *   @dragleave.prevent="onDragLeave"
 *   @drop="onDrop"
 * >
 *   <input ref="fileInput" type="file" hidden @change="onFileInput" />
 * </div>
 */

import { ref } from 'vue'

export function useFileDrop(onFiles: (files: File[]) => void) {
  const isDragging = ref(false)
  let _depth = 0

  /** 打开系统文件选择框（点击 / 键盘触发） */
  function openPicker(input: HTMLInputElement | null) {
    input?.click()
  }

  /** 键盘触发：Enter / Space 打开文件框 */
  function onKeyOpen(e: KeyboardEvent, input: HTMLInputElement | null) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker(input)
    }
  }

  /** dragover 仅拦截默认行为，防止 drop 不触发 / 浏览器导航 */
  function onDragOver(e: DragEvent) {
    e.preventDefault()
  }

  /** 拖入（含子元素 enter 计数），置高亮 */
  function onDragEnter(e: DragEvent) {
    e.preventDefault()
    _depth++
    isDragging.value = true
  }

  /** 拖离（含子元素 leave 计数），归零时取消高亮，避免子元素闪烁 */
  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    _depth--
    if (_depth <= 0) {
      _depth = 0
      isDragging.value = false
    }
  }

  /** 释放：提取文件并回调，重置状态 */
  function onDrop(e: DragEvent) {
    e.preventDefault()
    _depth = 0
    isDragging.value = false
    const files = e.dataTransfer?.files
    if (files && files.length) onFiles(Array.from(files))
  }

  return { isDragging, openPicker, onKeyOpen, onDragOver, onDragEnter, onDragLeave, onDrop }
}
