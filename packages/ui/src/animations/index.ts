/**
 * Animation registry
 * 100+ animations across 6 categories
 */
import { entranceAnimations, generateEntranceCSS, entranceNames } from './entrance'
import { exitAnimations, generateExitCSS, exitNames } from './exit'
import { attentionAnimations, generateAttentionCSS, attentionNames } from './attention'
import { loadingAnimations, generateLoadingCSS, loadingNames } from './loading'
import { pageTransitions, routeTransitions, generateTransitionCSS, transitionNames } from './transition'
import { microInteractions, generateMicroCSS, microNames } from './micro'

export {
  entranceAnimations, generateEntranceCSS, entranceNames,
  exitAnimations, generateExitCSS, exitNames,
  attentionAnimations, generateAttentionCSS, attentionNames,
  loadingAnimations, generateLoadingCSS, loadingNames,
  pageTransitions, routeTransitions, generateTransitionCSS, transitionNames,
  microInteractions, generateMicroCSS, microNames
}

export type AnimationCategory = 'entrance' | 'exit' | 'attention' | 'loading' | 'transition' | 'micro'

/** all animation names */
export const allAnimationNames: string[] = [
  ...entranceNames, ...exitNames, ...attentionNames, ...loadingNames, ...transitionNames, ...microNames
]

/** look up an animation by name across all categories */
export function findAnimation(name: string) {
  return [...entranceAnimations, ...exitAnimations, ...attentionAnimations, ...loadingAnimations, ...pageTransitions, ...routeTransitions].find((a) => a.name === name) ?? null
}

/** generate one CSS bundle with all animations */
export function generateAllAnimationsCSS(): string {
  return [
    '/* === entrance === */',
    generateEntranceCSS(),
    '/* === exit === */',
    generateExitCSS(),
    '/* === attention === */',
    generateAttentionCSS(),
    '/* === loading === */',
    generateLoadingCSS(),
    '/* === transition === */',
    generateTransitionCSS(),
    '/* === micro === */',
    generateMicroCSS(),
    '/* === prefers-reduced-motion === */',
    '@media (prefers-reduced-motion: reduce) { .anim-*, [class*="anim-"] { animation: none !important; transition: none !important; } }'
  ].join('\n\n')
}

/** total animation count */
export const totalAnimationCount = allAnimationNames.length

export { entranceAnimations as default }

export type { AnimationVariant } from './entrance'
