/**
 * Entrance animations - 入场动效
 * 6 类 (fade/slide/scale/bounce/rotate/flip) × ≥ 20 个变体
 * CSS keyframes only (no JS animation libs)
 */

export type AnimationCategory =
  | 'fade' | 'slide' | 'scale' | 'bounce' | 'rotate' | 'flip'
  | 'shake' | 'flash' | 'tada' | 'wobble' | 'jello' | 'heartbeat'
  | 'spinner' | 'pulse' | 'dots' | 'bars' | 'ring' | 'dual-ring' | 'orbit' | 'square-wave'

export interface AnimationVariant {
  name: string
  category: AnimationCategory
  duration: string
  delay?: string
  easing: string
  keyframes: string
}

/** 20 个 fade/slide/scale/bounce/rotate/flip 入场变体 */
export const entranceAnimations: AnimationVariant[] = [
  // ---- fade (4)
  { name: 'fade-in', category: 'fade', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { opacity: 0 } to { opacity: 1 }' },
  { name: 'fade-in-up', category: 'fade', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) }' },
  { name: 'fade-in-down', category: 'fade', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { opacity: 0; transform: translateY(-20px) } to { opacity: 1; transform: translateY(0) }' },
  { name: 'fade-in-slow', category: 'fade', duration: 'var(--dur-slow)', easing: 'var(--ease-in-out)',
    keyframes: 'from { opacity: 0 } to { opacity: 1 }' },

  // ---- slide (4)
  { name: 'slide-in-right', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: translateX(100%) } to { transform: translateX(0) }' },
  { name: 'slide-in-left', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: translateX(-100%) } to { transform: translateX(0) }' },
  { name: 'slide-in-up', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: translateY(100%) } to { transform: translateY(0) }' },
  { name: 'slide-in-down', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: translateY(-100%) } to { transform: translateY(0) }' },

  // ---- scale (3)
  { name: 'scale-in', category: 'scale', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: scale(0.6); opacity: 0 } to { transform: scale(1); opacity: 1 }' },
  { name: 'scale-in-bounce', category: 'scale', duration: 'var(--dur-slow)', easing: 'var(--ease-out)',
    keyframes: '0% { transform: scale(0.3); opacity: 0 } 60% { transform: scale(1.1); opacity: 1 } 100% { transform: scale(1) }' },
  { name: 'scale-in-soft', category: 'scale', duration: 'var(--dur-base)', easing: 'var(--ease-in-out)',
    keyframes: 'from { transform: scale(0.95); opacity: 0 } to { transform: scale(1); opacity: 1 }' },

  // ---- bounce (3)
  { name: 'bounce-in', category: 'bounce', duration: 'var(--dur-slow)', easing: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
    keyframes: '0% { transform: scale(0); opacity: 0 } 50% { transform: scale(1.2) } 100% { transform: scale(1); opacity: 1 }' },
  { name: 'bounce-in-up', category: 'bounce', duration: 'var(--dur-slow)', easing: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
    keyframes: '0% { transform: translateY(60px); opacity: 0 } 60% { transform: translateY(-20px) } 100% { transform: translateY(0); opacity: 1 }' },
  { name: 'bounce-in-down', category: 'bounce', duration: 'var(--dur-slow)', easing: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
    keyframes: '0% { transform: translateY(-60px); opacity: 0 } 60% { transform: translateY(20px) } 100% { transform: translateY(0); opacity: 1 }' },

  // ---- rotate (3)
  { name: 'rotate-in', category: 'rotate', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: rotate(-180deg) scale(0.5); opacity: 0 } to { transform: rotate(0) scale(1); opacity: 1 }' },
  { name: 'rotate-in-cw', category: 'rotate', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: rotate(180deg); opacity: 0 } to { transform: rotate(0); opacity: 1 }' },
  { name: 'roll-in', category: 'rotate', duration: 'var(--dur-slow)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: translateX(-100%) rotate(-120deg); opacity: 0 } to { transform: translateX(0) rotate(0); opacity: 1 }' },

  // ---- flip (3)
  { name: 'flip-in-x', category: 'flip', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: perspective(400px) rotateX(90deg); opacity: 0 } to { transform: perspective(400px) rotateX(0); opacity: 1 }' },
  { name: 'flip-in-y', category: 'flip', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: perspective(400px) rotateY(90deg); opacity: 0 } to { transform: perspective(400px) rotateY(0); opacity: 1 }' },
  { name: 'flip-in-diag', category: 'flip', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: perspective(400px) rotate3d(1, 1, 0, 90deg); opacity: 0 } to { transform: perspective(400px) rotate3d(1, 1, 0, 0); opacity: 1 }' }
]

/** generate CSS string for all entrance animations */
export function generateEntranceCSS(): string {
  return entranceAnimations.map((a) => `
@keyframes ${a.name} {
  ${a.keyframes}
}
.anim-${a.name} {
  animation: ${a.name} ${a.duration} ${a.easing} ${a.delay ?? '0ms'} both;
}
`).join('\n')
}

export const entranceNames: string[] = entranceAnimations.map((a) => a.name)
