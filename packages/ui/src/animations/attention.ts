/**
 * Attention animations - 提示动效
 * 6 类 (shake/flash/tada/wobble/jello/heartbeat) × 20 个变体
 */
import type { AnimationVariant } from './entrance'

export const attentionAnimations: AnimationVariant[] = [
  // ---- shake (4)
  { name: 'shake', category: 'shake', duration: '600ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: translateX(0) } 10%, 30%, 50%, 70%, 90% { transform: translateX(-10px) } 20%, 40%, 60%, 80% { transform: translateX(10px) }' },
  { name: 'shake-soft', category: 'shake', duration: '500ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: translateX(0) } 25% { transform: translateX(-4px) } 50% { transform: translateX(4px) } 75% { transform: translateX(-4px) }' },
  { name: 'shake-vertical', category: 'shake', duration: '600ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: translateY(0) } 10%, 30%, 50%, 70%, 90% { transform: translateY(-8px) } 20%, 40%, 60%, 80% { transform: translateY(8px) }' },
  { name: 'head-shake', category: 'shake', duration: '600ms', easing: 'ease-in-out',
    keyframes: '0%, 50%, 100% { transform: translateX(0) } 10%, 30% { transform: translateX(-6px) rotate(-3deg) } 20%, 40% { transform: translateX(6px) rotate(3deg) }' },

  // ---- flash (3)
  { name: 'flash', category: 'flash', duration: '800ms', easing: 'ease-in-out',
    keyframes: '0%, 50%, 100% { opacity: 1 } 25%, 75% { opacity: 0 }' },
  { name: 'flash-once', category: 'flash', duration: '500ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { opacity: 1 } 50% { opacity: 0.3 }' },
  { name: 'glow-flash', category: 'flash', duration: '1200ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { box-shadow: 0 0 0 0 transparent } 50% { box-shadow: 0 0 24px 8px var(--primary) }' },

  // ---- tada (3)
  { name: 'tada', category: 'tada', duration: '1000ms', easing: 'ease-in-out',
    keyframes: '0% { transform: scale(1) rotate(0) } 10%, 20% { transform: scale(0.9) rotate(-3deg) } 30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg) } 40%, 60%, 80% { transform: scale(1.1) rotate(-3deg) } 100% { transform: scale(1) rotate(0) }' },
  { name: 'tada-soft', category: 'tada', duration: '800ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: scale(1) } 25% { transform: scale(1.05) rotate(2deg) } 50% { transform: scale(0.98) rotate(-2deg) } 75% { transform: scale(1.03) rotate(1deg) }' },
  { name: 'pop', category: 'tada', duration: '500ms', easing: 'ease-out',
    keyframes: '0% { transform: scale(1) } 50% { transform: scale(1.15) } 100% { transform: scale(1) }' },

  // ---- wobble (3)
  { name: 'wobble', category: 'wobble', duration: '800ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: translateX(0) rotate(0) } 15% { transform: translateX(-25%) rotate(-5deg) } 30% { transform: translateX(20%) rotate(3deg) } 45% { transform: translateX(-15%) rotate(-3deg) } 60% { transform: translateX(10%) rotate(2deg) } 75% { transform: translateX(-5%) rotate(-1deg) }' },
  { name: 'wobble-vertical', category: 'wobble', duration: '800ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: translateY(0) rotate(0) } 15% { transform: translateY(-8px) rotate(-2deg) } 30% { transform: translateY(6px) rotate(1deg) } 45% { transform: translateY(-4px) rotate(-1deg) } 60% { transform: translateY(2px) }' },
  { name: 'swing', category: 'wobble', duration: '800ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: rotate(0) } 20% { transform: rotate(15deg) } 40% { transform: rotate(-10deg) } 60% { transform: rotate(5deg) } 80% { transform: rotate(-5deg) }' },

  // ---- jello (3)
  { name: 'jello', category: 'jello', duration: '900ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: skewX(0) skewY(0) } 30% { transform: skewX(-25deg) skewY(-12.5deg) } 40% { transform: skewX(15deg) skewY(7.5deg) } 50% { transform: skewX(-15deg) skewY(-7.5deg) } 65% { transform: skewX(10deg) skewY(5deg) } 75% { transform: skewX(-5deg) skewY(-2.5deg) }' },
  { name: 'jello-diag', category: 'jello', duration: '900ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: scale3d(1, 1, 1) } 30% { transform: scale3d(1.25, 0.75, 1) } 40% { transform: scale3d(0.75, 1.25, 1) } 50% { transform: scale3d(1.15, 0.85, 1) } 65% { transform: scale3d(0.95, 1.05, 1) } 75% { transform: scale3d(1.05, 0.95, 1) }' },
  { name: 'wiggle', category: 'jello', duration: '600ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: rotate(0) } 25% { transform: rotate(5deg) } 50% { transform: rotate(-5deg) } 75% { transform: rotate(3deg) }' },

  // ---- heartbeat (4)
  { name: 'heartbeat', category: 'heartbeat', duration: '1300ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: scale(1) } 14% { transform: scale(1.3) } 28% { transform: scale(1) } 42% { transform: scale(1.3) } 70% { transform: scale(1) }' },
  { name: 'heartbeat-fast', category: 'heartbeat', duration: '800ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: scale(1) } 25% { transform: scale(1.2) } 50% { transform: scale(1) } 75% { transform: scale(1.15) }' },
  { name: 'pulse', category: 'heartbeat', duration: '1500ms', easing: 'ease-in-out',
    keyframes: '0%, 100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.05); opacity: 0.85 }' },
  { name: 'ping', category: 'heartbeat', duration: '1200ms', easing: 'cubic-bezier(0, 0, 0.2, 1)',
    keyframes: '0% { transform: scale(1); opacity: 1 } 75%, 100% { transform: scale(2); opacity: 0 }' }
]

export function generateAttentionCSS(): string {
  return attentionAnimations.map((a) => `
@keyframes ${a.name} {
  ${a.keyframes}
}
.anim-${a.name} {
  animation: ${a.name} ${a.duration} ${a.easing} ${a.delay ?? '0ms'} both;
}
`).join('\n')
}

export const attentionNames: string[] = attentionAnimations.map((a) => a.name)
