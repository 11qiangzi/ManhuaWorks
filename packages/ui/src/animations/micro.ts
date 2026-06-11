/**
 * Micro-interactions - 10 个 hover/click/focus/disabled 微交互
 * 通过 CSS pseudo-class 触发 (零 JS)
 */
export interface MicroInteraction {
  name: string
  description: string
  css: string
}

export const microInteractions: MicroInteraction[] = [
  { name: 'hover-lift',
    description: 'Hover 时上浮 + 阴影增强',
    css: `.mi-hover-lift {
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.mi-hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-4);
}` },
  { name: 'hover-glow',
    description: 'Hover 时发光',
    css: `.mi-hover-glow {
  transition: box-shadow var(--dur-base) var(--ease-out);
}
.mi-hover-glow:hover {
  box-shadow: var(--glow-accent);
}` },
  { name: 'hover-scale',
    description: 'Hover 时放大',
    css: `.mi-hover-scale {
  transition: transform var(--dur-fast) var(--ease-out);
}
.mi-hover-scale:hover {
  transform: scale(1.05);
}` },
  { name: 'hover-tint',
    description: 'Hover 时背景变色',
    css: `.mi-hover-tint {
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.mi-hover-tint:hover {
  background-color: var(--bg-tertiary);
}` },
  { name: 'click-press',
    description: '点击时按下效果',
    css: `.mi-click-press {
  transition: transform var(--dur-fast) var(--ease-out);
}
.mi-click-press:active {
  transform: scale(0.96);
}` },
  { name: 'click-ripple',
    description: '点击涟漪效果',
    css: `.mi-click-ripple {
  position: relative;
  overflow: hidden;
}
.mi-click-ripple::after {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur-base) var(--ease-out);
}
.mi-click-ripple:active::after {
  opacity: 0.15;
  transition: opacity 0ms;
}` },
  { name: 'focus-ring',
    description: '键盘焦点环 (无障碍)',
    css: `.mi-focus-ring:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}` },
  { name: 'focus-glow',
    description: '键盘焦点发光 (无障碍)',
    css: `.mi-focus-glow:focus-visible {
  box-shadow: 0 0 0 3px var(--primary), 0 0 0 5px transparent;
  outline: none;
}` },
  { name: 'disabled-fade',
    description: '禁用状态灰显',
    css: `.mi-disabled-fade:disabled, .mi-disabled-fade[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}` },
  { name: 'disabled-strike',
    description: '禁用状态灰显 + 删除线',
    css: `.mi-disabled-strike:disabled, .mi-disabled-strike[aria-disabled="true"] {
  opacity: 0.5;
  text-decoration: line-through;
  cursor: not-allowed;
}` }
]

export function generateMicroCSS(): string {
  return microInteractions.map((m) => m.css).join('\n\n')
}

export const microNames: string[] = microInteractions.map((m) => m.name)
