/**
 * useSwipe - 移动端滑动手势
 * - 检测上下左右 4 个方向
 * - 阈值: 距离 > 50px 且 速度 > 0.3 px/ms
 */
import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export interface SwipeEvent {
  direction: SwipeDirection
  distance: number
  duration: number
  velocity: number
  startX: number
  startY: number
  endX: number
  endY: number
}

export interface UseSwipeOptions {
  threshold?: number       // px
  velocity?: number        // px/ms
  timeout?: number         // ms
  onSwipe?: (e: SwipeEvent) => void
  trackTouch?: boolean
  trackMouse?: boolean
}

export interface UseSwipeReturn {
  handlers: {
    onTouchStart: (e: TouchEvent) => void
    onTouchMove: (e: TouchEvent) => void
    onTouchEnd: (e: TouchEvent) => void
    onMouseDown: (e: MouseEvent) => void
    onMouseMove: (e: MouseEvent) => void
    onMouseUp: (e: MouseEvent) => void
  }
  isTracking: Ref<boolean>
}

export function useSwipe(options: UseSwipeOptions = {}): UseSwipeReturn {
  const threshold = options.threshold ?? 50
  const velocity = options.velocity ?? 0.3
  const timeout = options.timeout ?? 1000
  const trackTouch = options.trackTouch ?? true
  const trackMouse = options.trackMouse ?? true

  const isTracking = ref(false)
  let startX = 0
  let startY = 0
  let startT = 0
  let active = false
  let lastX = 0
  let lastY = 0

  function begin(x: number, y: number) {
    active = true
    startX = lastX = x
    startY = lastY = y
    startT = Date.now()
    isTracking.value = true
  }

  function end(x: number, y: number) {
    if (!active) return
    active = false
    isTracking.value = false
    const dx = x - startX
    const dy = y - startY
    const dt = Date.now() - startT
    if (dt > timeout) return
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    const dist = Math.max(absX, absY)
    if (dist < threshold) return
    const v = dist / Math.max(dt, 1)
    if (v < velocity) return
    let direction: SwipeDirection
    if (absX > absY) direction = dx > 0 ? 'right' : 'left'
    else direction = dy > 0 ? 'down' : 'up'
    options.onSwipe?.({
      direction, distance: dist, duration: dt, velocity: v,
      startX, startY, endX: x, endY: y
    })
  }

  function onTouchStart(e: TouchEvent) {
    if (!trackTouch) return
    const t = e.touches[0]
    if (t) begin(t.clientX, t.clientY)
  }
  function onTouchMove(e: TouchEvent) {
    if (!trackTouch || !active) return
    const t = e.touches[0]
    if (t) { lastX = t.clientX; lastY = t.clientY }
  }
  function onTouchEnd(e: TouchEvent) {
    if (!trackTouch || !active) return
    const t = e.changedTouches[0]
    if (t) end(t.clientX, t.clientY)
  }

  function onMouseDown(e: MouseEvent) {
    if (!trackMouse) return
    begin(e.clientX, e.clientY)
  }
  function onMouseMove(e: MouseEvent) {
    if (!trackMouse || !active) return
    lastX = e.clientX; lastY = e.clientY
  }
  function onMouseUp(e: MouseEvent) {
    if (!trackMouse || !active) return
    end(e.clientX, e.clientY)
  }

  // 注册全局 mouse listeners (mouseup 经常在元素外触发)
  onMounted(() => {
    if (!trackMouse || typeof window === 'undefined') return
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  })
  onBeforeUnmount(() => {
    if (!trackMouse || typeof window === 'undefined') return
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  })

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseMove, onMouseUp },
    isTracking
  }
}
