/**
 * Page / route transition animations
 * 6 page + 6 route = 12 个变体
 * 与 Vue <Transition> 配合使用
 */
import type { AnimationVariant } from './entrance'

export const pageTransitions: AnimationVariant[] = [
  { name: 'page-fade', category: 'fade', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { opacity: 0 } to { opacity: 1 }' },
  { name: 'page-slide-up', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: translateY(30px); opacity: 0 } to { transform: translateY(0); opacity: 1 }' },
  { name: 'page-slide-left', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: translateX(40px); opacity: 0 } to { transform: translateX(0); opacity: 1 }' },
  { name: 'page-scale', category: 'scale', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: scale(0.95); opacity: 0 } to { transform: scale(1); opacity: 1 }' },
  { name: 'page-flip', category: 'flip', duration: 'var(--dur-slow)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: perspective(1200px) rotateY(8deg); opacity: 0 } to { transform: perspective(1200px) rotateY(0); opacity: 1 }' },
  { name: 'page-zoom-blur', category: 'scale', duration: 'var(--dur-slow)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: scale(1.05); filter: blur(8px); opacity: 0 } to { transform: scale(1); filter: blur(0); opacity: 1 }' }
]

export const routeTransitions: AnimationVariant[] = [
  { name: 'route-push', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: translateX(60px); opacity: 0 } to { transform: translateX(0); opacity: 1 }' },
  { name: 'route-pop', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: translateX(-60px); opacity: 0 } to { transform: translateX(0); opacity: 1 }' },
  { name: 'route-fade-cross', category: 'fade', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { opacity: 0 } to { opacity: 1 }' },
  { name: 'route-slide-down', category: 'slide', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: translateY(-40px); opacity: 0 } to { transform: translateY(0); opacity: 1 }' },
  { name: 'route-zoom', category: 'scale', duration: 'var(--dur-base)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: scale(0.85); opacity: 0 } to { transform: scale(1); opacity: 1 }' },
  { name: 'route-rotate-in', category: 'rotate', duration: 'var(--dur-slow)', easing: 'var(--ease-out)',
    keyframes: 'from { transform: perspective(1200px) rotateX(-15deg); opacity: 0 } to { transform: perspective(1200px) rotateX(0); opacity: 1 }' }
]

export function generateTransitionCSS(): string {
  return [...pageTransitions, ...routeTransitions].map((a) => `
@keyframes ${a.name} {
  ${a.keyframes}
}
.${a.name}-enter-active, .${a.name}-leave-active {
  animation: ${a.name} ${a.duration} ${a.easing} both;
}
.${a.name}-enter-from, .${a.name}-leave-to {
  /* hooks for users to override initial state */
}
`).join('\n')
}

export const transitionNames: string[] = [...pageTransitions, ...routeTransitions].map((a) => a.name)
