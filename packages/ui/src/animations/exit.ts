/**
 * Exit animations - 出场动效
 * 20 个变体 (与 entrance 6 类对齐: fade/slide/scale/bounce/rotate/flip)
 */
import type { AnimationVariant } from './entrance'

export const exitAnimations: AnimationVariant[] = [
  // ---- fade (4)
  { name: 'fade-out', category: 'fade', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { opacity: 1 } to { opacity: 0 }' },
  { name: 'fade-out-up', category: 'fade', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(-20px) }' },
  { name: 'fade-out-down', category: 'fade', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(20px) }' },
  { name: 'fade-out-fast', category: 'fade', duration: 'var(--dur-fast)', easing: 'var(--ease-in)',
    keyframes: 'from { opacity: 1 } to { opacity: 0 }' },

  // ---- slide (4)
  { name: 'slide-out-right', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: translateX(0) } to { transform: translateX(100%) }' },
  { name: 'slide-out-left', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: translateX(0) } to { transform: translateX(-100%) }' },
  { name: 'slide-out-up', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: translateY(0) } to { transform: translateY(-100%) }' },
  { name: 'slide-out-down', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: translateY(0) } to { transform: translateY(100%) }' },

  // ---- scale (3)
  { name: 'scale-out', category: 'scale', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: scale(1); opacity: 1 } to { transform: scale(0.6); opacity: 0 }' },
  { name: 'scale-out-bounce', category: 'scale', duration: 'var(--dur-slow)', easing: 'var(--ease-in)',
    keyframes: '0% { transform: scale(1); opacity: 1 } 60% { transform: scale(1.1) } 100% { transform: scale(0); opacity: 0 }' },
  { name: 'scale-out-soft', category: 'scale', duration: 'var(--dur-base)', easing: 'var(--ease-in-out)',
    keyframes: 'from { transform: scale(1); opacity: 1 } to { transform: scale(0.95); opacity: 0 }' },

  // ---- bounce (3)
  { name: 'bounce-out', category: 'bounce', duration: 'var(--dur-slow)', easing: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
    keyframes: '0% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.2) } 100% { transform: scale(0); opacity: 0 }' },
  { name: 'bounce-out-down', category: 'bounce', duration: 'var(--dur-slow)', easing: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
    keyframes: '0% { transform: translateY(0); opacity: 1 } 60% { transform: translateY(20px) } 100% { transform: translateY(-60px); opacity: 0 }' },
  { name: 'bounce-out-up', category: 'bounce', duration: 'var(--dur-slow)', easing: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
    keyframes: '0% { transform: translateY(0); opacity: 1 } 60% { transform: translateY(-20px) } 100% { transform: translateY(60px); opacity: 0 }' },

  // ---- rotate (3)
  { name: 'rotate-out', category: 'rotate', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: rotate(0) scale(1); opacity: 1 } to { transform: rotate(180deg) scale(0.5); opacity: 0 }' },
  { name: 'rotate-out-cw', category: 'rotate', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: rotate(0); opacity: 1 } to { transform: rotate(-180deg); opacity: 0 }' },
  { name: 'roll-out', category: 'rotate', duration: 'var(--dur-slow)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: translateX(0) rotate(0); opacity: 1 } to { transform: translateX(100%) rotate(120deg); opacity: 0 }' },

  // ---- flip (3)
  { name: 'flip-out-x', category: 'flip', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: perspective(400px) rotateX(0); opacity: 1 } to { transform: perspective(400px) rotateX(90deg); opacity: 0 }' },
  { name: 'flip-out-y', category: 'flip', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: perspective(400px) rotateY(0); opacity: 1 } to { transform: perspective(400px) rotateY(90deg); opacity: 0 }' },
  { name: 'flip-out-diag', category: 'flip', duration: 'var(--dur-base)', easing: 'var(--ease-in)',
    keyframes: 'from { transform: perspective(400px) rotate3d(1, 1, 0, 0); opacity: 1 } to { transform: perspective(400px) rotate3d(1, 1, 0, 90deg); opacity: 0 }' }
]

export function generateExitCSS(): string {
  return exitAnimations.map((a) => `
@keyframes ${a.name} {
  ${a.keyframes}
}
.anim-${a.name} {
  animation: ${a.name} ${a.duration} ${a.easing} ${a.delay ?? '0ms'} both;
}
`).join('\n')
}

export const exitNames: string[] = exitAnimations.map((a) => a.name)
