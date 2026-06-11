/**
 * Loading animations - 加载动效
 * 8 类 (spinner/pulse/dots/bars/ring/dual-ring/orbit/square-wave) × 20 个变体
 * 注意: loading 动效是循环的 (infinite)
 */
import type { AnimationVariant } from './entrance'

export const loadingAnimations: AnimationVariant[] = [
  // ---- spinner (3) - 旋转
  { name: 'spinner', category: 'spinner', duration: '800ms', easing: 'linear',
    keyframes: 'from { transform: rotate(0) } to { transform: rotate(360deg) }' },
  { name: 'spinner-slow', category: 'spinner', duration: '1500ms', easing: 'linear',
    keyframes: 'from { transform: rotate(0) } to { transform: rotate(360deg) }' },
  { name: 'spinner-fast', category: 'spinner', duration: '400ms', easing: 'linear',
    keyframes: 'from { transform: rotate(0) } to { transform: rotate(360deg) }' },

  // ---- pulse (3) - 缩放
  { name: 'pulse-load', category: 'pulse', duration: '1200ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.4; transform: scale(0.85) }' },
  { name: 'pulse-load-fast', category: 'pulse', duration: '700ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { opacity: 1 } 50% { opacity: 0.3 }' },
  { name: 'pulse-glow', category: 'pulse', duration: '1500ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { box-shadow: 0 0 0 0 var(--primary) } 50% { box-shadow: 0 0 0 16px transparent }' },

  // ---- dots (3) - 跳跳
  { name: 'dots-bounce', category: 'dots', duration: '600ms', easing: 'ease-in-out',
    keyframes: '0%, 80%, 100% { transform: translateY(0) } 40% { transform: translateY(-8px) }' },
  { name: 'dots-fade', category: 'dots', duration: '900ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { opacity: 0.3; transform: scale(0.8) } 50% { opacity: 1; transform: scale(1.1) }' },
  { name: 'dots-pulse', category: 'dots', duration: '1000ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: scale(0.6); opacity: 0.5 } 50% { transform: scale(1); opacity: 1 }' },

  // ---- bars (3) - 条形
  { name: 'bars-wave', category: 'bars', duration: '900ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: scaleY(0.4) } 50% { transform: scaleY(1) }' },
  { name: 'bars-stretch', category: 'bars', duration: '1000ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: scaleY(0.3) } 50% { transform: scaleY(1) }' },
  { name: 'bars-fade', category: 'bars', duration: '800ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { opacity: 0.3; transform: scaleY(0.5) } 50% { opacity: 1; transform: scaleY(1) }' },

  // ---- ring (2)
  { name: 'ring-rotate', category: 'ring', duration: '1200ms', easing: 'linear',
    keyframes: 'from { transform: rotate(0) } to { transform: rotate(360deg) }' },
  { name: 'ring-pulse', category: 'ring', duration: '2000ms', easing: 'ease-out',
    keyframes: '0% { transform: scale(0.8); opacity: 1 } 100% { transform: scale(1.4); opacity: 0 }' },

  // ---- dual-ring (2)
  { name: 'dual-ring', category: 'dual-ring', duration: '1500ms', easing: 'linear',
    keyframes: '0% { transform: rotate(0) } 100% { transform: rotate(360deg) }' },
  { name: 'dual-ring-counter', category: 'dual-ring', duration: '1500ms', easing: 'linear',
    keyframes: '0% { transform: rotate(0) } 100% { transform: rotate(-360deg) }' },

  // ---- orbit (2)
  { name: 'orbit', category: 'orbit', duration: '2000ms', easing: 'linear',
    keyframes: 'from { transform: rotate(0) translateX(20px) rotate(0) } to { transform: rotate(360deg) translateX(20px) rotate(-360deg) }' },
  { name: 'orbit-fast', category: 'orbit', duration: '1000ms', easing: 'linear',
    keyframes: 'from { transform: rotate(0) translateX(16px) rotate(0) } to { transform: rotate(360deg) translateX(16px) rotate(-360deg) }' },

  // ---- square-wave (2)
  { name: 'square-wave', category: 'square-wave', duration: '1200ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: scaleX(0.2) } 50% { transform: scaleX(1) }' },
  { name: 'square-wave-pulse', category: 'square-wave', duration: '1500ms', easing: 'ease-in-out',
    keyframes: '0% { transform: scale(1); opacity: 0.7 } 50% { transform: scale(0.6); opacity: 1 } 100% { transform: scale(1); opacity: 0.7 }' }
]

export function generateLoadingCSS(): string {
  return loadingAnimations.map((a) => `
@keyframes ${a.name} {
  ${a.keyframes}
}
.anim-${a.name} {
  animation: ${a.name} ${a.duration} ${a.easing} infinite;
}
`).join('\n')
}

export const loadingNames: string[] = loadingAnimations.map((a) => a.name)
